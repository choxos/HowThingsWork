import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {UPRIGHT as C, UPRIGHT_DEFAULTS as D, UPRIGHT_DOMAINS, uprightPlan, sampleUpright, uprightFanRise, uprightLosses, uprightLanePhase} from './upright-vacuum-physics.js';
import {UG, MM, point, bagPoint, uprightPaths, uprightBelt, uprightBeltGeometry, uprightDuctGeometry, annulusGeometry, plateGeometry, tracePoint} from './upright-vacuum-geometry.js';

const TAU = 2 * Math.PI, BLUE = 0x477f9b;
export const uprightChartPoint = (flow, pressure) => point([-135 + flow / C.freeFlow * 270, -100 + pressure / C.shutoff * 210, 0]);
function surface(kit, geometry, color, parent, opacity = 1) {
  const mesh = kit.cylinder(1, 1, [0, 0, 0], color, parent);mesh.geometry.dispose();mesh.geometry = geometry;mesh.material = mesh.material.clone();mesh.material.side = THREE.DoubleSide;
  if (opacity < 1) {mesh.material.transparent = true;mesh.material.opacity = opacity;mesh.material.depthWrite = false;}
  return mesh;
}

function drawUprightApparatus(kit, system) {
  const {part} = kit, paths = uprightPaths(), beltPath = uprightBelt();
  const box = (size, pos, color, parent) => kit.box(point(size), point(pos), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(point(a), point(b), radius * MM, color, parent);
  const ring = (inner, outer, depth, pos, color, parent, axis = 'z', opacity = 1, start = 0, span = TAU) => {
    const mesh = surface(kit, annulusGeometry(inner, outer, depth, start, span), color, parent, opacity);mesh.position.set(...point(pos));
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;if (axis === 'x') mesh.rotation.z = -Math.PI / 2;return mesh;
  };
  const plate = (width, height, depth, pos, hole, color, parent, axis = 'z', opacity = 1) => {
    const mesh = surface(kit, plateGeometry(width, height, depth, hole), color, parent, opacity);mesh.position.set(...point(pos));
    if (axis === 'x') mesh.rotation.y = Math.PI / 2;if (axis === 'y') mesh.rotation.x = -Math.PI / 2;return mesh;
  };
  const body = new THREE.Group();system.add(body);
  const intake = part('intake', 'Floor head and brush drive', 'A belt turns a supported brush over the carpet. The front slot admits air; raising the whole head also opens the side and rear edges. The wheels remain on the floor.', [0, 0, 0], body);
  const drive = part('drive', 'Motor and direct-air fan', 'A common shaft turns the motor rotor, impeller and small belt pulley. In this direct-air layout the dust-laden stream crosses the fan before reaching the bag.', [0, 0, 0], body);
  const collection = part('collection', 'Duct, bag and handle', 'The fan sends dirty air through a hollow discharge duct into a supported paper bag. Air leaves through paper and the outer cover. Markers retained on the paper do not recirculate.', [0, 0, 0], body);

  const casing = part('casing', 'Cutaway head and chassis', 'The original teaching head is 350 mm long and 300 mm wide inside its skirts. A 6 mm front slot stays open at working height. Most front-facing surfaces are transparent or cut away for inspection.', [0, 0, 0], intake);
  const frontWall = box([4, 74, 300], [-177, 48, 0], 'metal', casing);
  frontWall.material = frontWall.material.clone();Object.assign(frontWall.material, {transparent: true, opacity: .18, depthWrite: false});
  const rearWall = box([4, 195, 304], [177, 102.5, 0], 'metal', casing);
  const sideWalls = [-152, 152].map(z => box([350, 80, 4], [0, 45, z], 'metal', casing));
  sideWalls[0].material = sideWalls[0].material.clone();Object.assign(sideWalls[0].material, {transparent: true, opacity: .22, depthWrite: false});
  const roof = box([130, 4, 300], [-110, 82, 0], 'leaf', casing);roof.material = roof.material.clone();Object.assign(roof.material, {transparent: true, opacity: .22, depthWrite: false});
  for (const z of [-152, 152]) box([218, 4, 12], [66, 200, z], 'metal', casing);
  box([4, 117, 304], [-41, 143.5, 0], 'metal', casing).material = new THREE.MeshToonMaterial({color: 0xb4c5b0, transparent: true, opacity: .12, depthWrite: false});
  const floor = part('floor', 'Carpet and sample', 'Six markers start loose and six stand for a selected fiber-bound sample. The sample is illustrative; no mass, adhesion force or cleaning percentage is inferred.', [0, 0, 0], system);floor.userData.explosionExcluded = true;
  box([440, 5, 410], [-25, 2.5, 0], 'wood', floor);
  const fibers = [];
  for (let lane = 0; lane < 6; lane++) for (let j = -1; j <= 1; j++) fibers.push(rod([-113 + j * 4, 5, -100 + lane * 40], [-113 + j * 4, 9, -100 + lane * 40], .5, 'leaf', floor));

  const height = part('height', 'Wheels and height supports', 'Four wheels stay on the carpet. Guided vertical supports raise the head 12 mm without changing the alignment of its belt and shaft. This is an idealized height mechanism.', [0, 0, 0], intake);
  const wheels = [], wheelAxles = [], guides = [], sleeves = [];
  for (const x of [-20, 150]) for (const z of [-190, 190]) {
    const wheel = kit.disk(25 * MM, 14 * MM, point([x, 30, z]), 'ink', height);wheels.push(wheel);
    wheelAxles.push(rod([x, 30, z - 10], [x, 30, z + 10], 4, 'metal', height));
    const stem = box([8, 48, 8], [x, 54, z], 'metal', height);guides.push(stem);
    const sleeve = ring(6, 10, 20, [x, 75, z], 'gold', height, 'y');sleeves.push(sleeve);
    rod([x, 78, z], [x, 78, Math.sign(z) * 152], 5, 'metal', height);
  }

  const brush = part('brush', 'Brush roll and bearings', 'Four rows of bristles sweep six teaching lanes. The first bottom encounter frees each selected bound marker. A raised head misses the carpet. Real adhesion and bristle forces are not calculated.', point(UG.brush), intake);
  const roller = new THREE.Group();brush.add(roller);
  ring(5, 14, 292, [0, 0, 0], 'wood', roller);
  const brushAxle = rod([0, 0, -181], [0, 0, 153], 5, 'ink', roller);
  const bristles = [];
  for (let lane = 0; lane < 6; lane++) for (let row = 0; row < C.brushRows; row++) {
    const angle = uprightLanePhase(lane) + row * TAU / C.brushRows, z = -100 + lane * 40;
    const bristle = rod([14 * Math.cos(angle), 14 * Math.sin(angle), z], [30 * Math.cos(angle), 30 * Math.sin(angle), z], 1.5, 'ink', roller);bristles.push(bristle);
  }
  const brushBearings = [-149, 149].map(z => ring(5.05, 11, 6, [0, 0, z], 'gold', brush));
  for (const z of [-149, 149]) {box([24, 6, 12], [0, -14, z], 'metal', brush);rod([-9, -11, z], [-9, 0, z], 3, 'metal', brush);}

  const belt = part('belt', 'Brush belt and pulleys', 'An 8 mm driving radius and 24 mm driven radius give three motor turns for one brush turn. The open belt runs around exact outer tangents. Removing it leaves the fan turning but stops this brush.', [0, 0, 0], intake);
  const beltMesh = surface(kit, uprightBeltGeometry(beltPath), 'ink', belt);
  const pulleys = [UG.fan, UG.brush].map((center, i) => {
    const pulley = new THREE.Group();pulley.position.set(...point([center[0], center[1], UG.beltZ]));belt.add(pulley);const pitch = i ? 24 : 8;
    ring(5, pitch - 1, 8, [0, 0, 0], 'gold', pulley);
    for (const z of [-5, 5]) ring(5, pitch + 2, 2, [0, 0, z], 'metal', pulley);
    rod([5, 0, -6.2], [pitch + 1, 0, -6.2], 1, 'cream', pulley);return pulley;
  });
  const beltMarks = Array.from({length: 8}, () => kit.sphere(.9 * MM, [0, 0, 0], 'gold', belt));

  const housing = part('housing', 'Fan housing and outlet collector', 'A stationary housing surrounds the impeller. The round axial eye admits dirty air; the side collector connects to the discharge tube. Open cutaway surfaces expose the passages.', [0, 0, 0], drive);
  const fanWall = ring(70, 74, 40, UG.fan, 'blue', housing, 'z', .55, Math.PI / 2 + .32, TAU - .64);
  const eyePlate = ring(28, 74, 4, [45, 100, -22], 'metal', housing, 'z', .45);
  const fanBack = ring(12, 74, 4, [45, 100, 22], 'metal', housing, 'z', .55);
  const fanBearing = ring(5.05, 12, 8, [45, 100, 24], 'ink', housing);
  for (const z of [-22, 22]) box([52, 21, 8], [45, 15.5, z], 'metal', housing);
  const collector = ring(20, 22, 10, [120, 100, 0], 'blue', housing, 'x', .5);
  for (const y of [78, 122]) box([22, 4, 44], [117, y, 0], 'blue', housing);
  box([22, 44, 4], [117, 100, 22], 'blue', housing);

  const gate = part('gate', 'Fan-inlet sealing gate', 'An ideal annular plate closes the fan eye around its shaft. The brush chamber remains exposed to the carpet. At zero flow the gate supports pressure times its annular area; the bag stays vented to the room.', [0, 0, 0], drive);
  const gatePlate = ring(5, 28, 3, [45, 100, -25.5], 'red', gate);rod([65, 120, -27], [79, 134, -27], 3, 'red', gate);

  const impeller = part('impeller', 'Direct-air centrifugal impeller', 'The impeller takes air in near its axis and sends it outward between eight radial blades. This layout places the fan before the bag. Traces indicate the route; blade-scale fluid and particle collisions are not solved.', point(UG.fan), drive);
  const frontShroud = ring(27, 66, 3, [0, 0, -12], 'gold', impeller, 'z', .2), backShroud = ring(5, 66, 3, [0, 0, 12], 'metal', impeller);
  ring(5, 11, 30, [0, 0, 0], 'ink', impeller);
  const blades = [];
  for (let i = 0; i < 8; i++) {const blade = box([46, 4, 21], [0, 0, 0], 'gold', impeller);blade.geometry.translate(42 * MM, 0, 0);blade.rotation.z = i * TAU / 8;blades.push(blade);}
  const shaft = part('shaft', 'Common motor and fan shaft', 'The rotor, fan and small pulley share this shaft. Both shaft bearings are mounted to the chassis. The large brush pulley is on a separate parallel shaft.', point(UG.fan), drive);
  const shaftMesh = rod([0, 0, -181], [0, 0, 152], 5, 'ink', shaft);rod([5, 0, -160], [5, 0, 148], .8, 'cream', shaft);
  const motor = part('motor', 'Motor and mounting feet', 'A prescribed-speed rotor turns inside a fixed stator. Turning the motor off stops both fan and brush. Startup, torque, electrical consumption and load-dependent speed are outside this lesson.', [0, 0, 0], drive);
  const stator = ring(30, 45, 90, [45, 100, 100], 'gold', motor, 'z', 1, Math.PI / 2, Math.PI);
  const motorEnds = [55, 145].map(z => ring(12, 45, 5, [45, 100, z], 'metal', motor));
  const motorBearings = [55, 145].map(z => ring(5.05, 12, 6, [45, 100, z], 'ink', motor));
  const rotor = new THREE.Group();rotor.position.set(...point([45, 100, 100]));motor.add(rotor);ring(5, 25, 70, [0, 0, 0], 'metal', rotor);
  for (let i = 0; i < 8; i++) {const a = i * TAU / 8;rod([25 * Math.cos(a), 25 * Math.sin(a), -32], [25 * Math.cos(a), 25 * Math.sin(a), 32], 2, 'wood', rotor);}
  for (const z of [55, 145]) box([60, 50, 12], [45, 30, z], 'metal', motor);
  const forwardBearing = ring(5.05, 12, 7, [45, 100, -145], 'ink', motor);
  box([32, 84, 12], [45, 47, -145], 'metal', motor);
  const indicator = box([16, 10, 6], [77, 71, -153], 'leaf', motor);indicator.material = indicator.material.clone();

  const duct = part('duct', 'Hollow discharge duct', 'A 40 mm clear bore carries the dirty stream from the collector to the upper part of the bag. The drawn centerline is 750 mm long, matching the flow model. Both ends remain open.', [0, 0, 0], collection);
  const ductMesh = surface(kit, uprightDuctGeometry(paths.curve), 'blue', duct, .33);
  const bag = part('bag', 'Paper bag and retained sample', 'Air escapes through porous paper. Twelve enlarged markers stop on its inner surface. The selected resistance factor represents loading, not a calibrated percentage full or filtration efficiency.', point(UG.bagBottom), collection);bag.rotation.z = -UG.lean;
  const bagPaper = [], paperBox = (size, pos) => {const mesh = box(size, pos, 'cream', bag);mesh.material = mesh.material.clone();Object.assign(mesh.material, {transparent: true, opacity: .38, depthWrite: false});bagPaper.push(mesh);return mesh;};
  const bagFloor = plate(202, 112, 2, [0, -1, 0], {radius: 22}, 'cream', bag, 'y');bagPaper.push(bagFloor);
  paperBox([202, 2, 112], [0, UG.bagHeight + 1, 0]);paperBox([2, UG.bagHeight, 112], [-101, UG.bagHeight / 2, 0]);paperBox([2, UG.bagHeight, 112], [101, UG.bagHeight / 2, 0]);paperBox([202, UG.bagHeight, 2], [0, UG.bagHeight / 2, 56]);
  const frontPaper = paperBox([202, UG.bagHeight, 2], [0, UG.bagHeight / 2, -56]);frontPaper.material.opacity = .16;
  for (const x of [-101, 101]) for (const z of [-56, 56]) rod([x, 0, z], [x, UG.bagHeight, z], 1, 'wood', bag);
  const bagCollar = ring(20, 26, 8, [0, 0, 0], 'ink', bag, 'y');
  const capture = part('capture', 'Retained dust on paper', 'This outlined paper patch makes all twelve retained markers easy to inspect. The enlarged markers stop at its inner surface; the paper continues to pass air.', [0, 0, 0], bag);
  capture.userData.explosionExcluded = true;
  for (const x of [-42, 42]) rod([x, paths.fill + 18, -55], [x, paths.fill + 66, -55], .65, 'wood', capture);
  for (const h of [paths.fill + 18, paths.fill + 66]) rod([-42, h, -55], [42, h, -55], .65, 'wood', capture);
  const cover = part('cover', 'Porous outer cover', 'A second porous layer surrounds the paper bag. Its section-average pressure is above the room while air flows. The open front is a teaching cutaway; fabric deformation is not predicted.', point(UG.bagBottom), collection);cover.rotation.z = -UG.lean;
  const coverMeshes = [];
  for (const x of [-126, 126]) coverMeshes.push(box([2, UG.bagHeight + 20, 142], [x, UG.bagHeight / 2, 0], 'leaf', cover));
  coverMeshes.push(box([252, UG.bagHeight + 20, 2], [0, UG.bagHeight / 2, 71], 'leaf', cover));
  coverMeshes.forEach(mesh => {mesh.material = mesh.material.clone();Object.assign(mesh.material, {transparent: true, opacity: .2, depthWrite: false});});
  const coverFloor = plate(252, 142, 2, [0, -10, 0], {radius: 23}, 'metal', cover, 'y');coverMeshes.push(coverFloor);
  box([252, 2, 142], [0, UG.bagHeight + 10, 0], 'metal', cover);
  const handle = part('handle', 'Handle and bag supports', 'A rigid handle connects to the chassis. Brackets support the bag at its base and top; the duct is not used as a structural support.', [0, 0, 0], collection);
  const handleBottom = bagPoint(160, -80), handleTop = bagPoint(160, 820);
  rod(handleBottom, handleTop, 10, 'metal', handle);rod([handleTop[0], handleTop[1], -70], [handleTop[0], handleTop[1], 70], 12, 'ink', handle);
  rod([174, 165, 0], handleBottom, 9, 'metal', handle);
  for (const h of [-10, UG.bagHeight + 10]) rod(bagPoint(126, h), bagPoint(160, h), 5, 'metal', handle);

  const air = part('air', 'Airflow tracers', 'Blue markers trace a representative stream through the head, fan, discharge duct, paper and outer cover. Section-average transport is slowed 300 times. These paths do not solve three-dimensional turbulence.', [0, 0, 0], body);air.userData.explosionExcluded = true;
  const dots = Array.from({length: 60}, () => kit.sphere(1.6 * MM, [0, 0, 0], BLUE, air));
  const dust = part('dust', 'Conserved dust sample', 'Six initially loose and six selected fiber-bound markers form a fixed sample. A modeled bristle encounter releases bound markers; flowing air then carries them to the paper. Counts always sum to twelve.', [0, 0, 0], body);dust.userData.explosionExcluded = true;
  const grains = Array.from({length: C.markerCount}, (_, i) => kit.sphere(3 * MM, [0, 0, 0], i < 6 ? 'clay' : 'gold', dust));
  return {body, intake, drive, collection, casing, frontWall, rearWall, sideWalls, roof, floor, fibers, height, wheels, wheelAxles, guides, sleeves, brush, roller, brushAxle, bristles, brushBearings, belt, beltPath, beltMesh, pulleys, beltMarks, housing, fanWall, eyePlate, fanBack, fanBearing, collector, gate, gatePlate, impeller, frontShroud, backShroud, blades, shaft, shaftMesh, motor, stator, motorEnds, motorBearings, rotor, forwardBearing, indicator, duct, ductMesh, bag, bagPaper, bagFloor, frontPaper, bagCollar, capture, cover, coverMeshes, coverFloor, handle, handleBottom, handleTop, air, dots, dust, grains, paths};
}

export function createUprightVacuumModel() {
  const kit = houseModel('Upright vacuum cleaner'), {root, part, control} = kit;
  const system = part('system', 'Upright vacuum cleaner', 'An original direct-air upright with a connected belt-driven brush. Follow a finite sample through an open head, centrifugal fan, hollow duct and paper bag. This is a teaching apparatus, not a measured commercial cleaner.');
  const p = drawUprightApparatus(kit, system);
  const box = (size, pos, color, parent) => kit.box(point(size), point(pos), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(point(a), point(b), radius * MM, color, parent);
  const label = (parent, text, pos, height = 16, width) => {const mesh = textLabel(parent, text, {position: point(pos), height: height * MM, ...(width ? {width: width * MM} : {})});mesh.raycast = () => {};return mesh;};
  const fanChart = part('fan-chart', 'Fan and path curves', 'The intersection of assigned fan and resistance curves gives steady flow. A blocked fan eye permits zero flow; a stopped motor supplies zero pressure rise.', point([700, 500, 0]), system);
  const budgetChart = part('budget-chart', 'Pressure-loss budget', 'The flowing head, duct, bag, cover and outlet losses add to the fan total-pressure rise. A sealed gate can support static pressure while all dissipative losses and flow power vanish.', point([700, 500, 0]), system);
  for (const [chart, id] of [[fanChart, 'fan-chart'], [budgetChart, 'budget-chart']]) {chart.userData.inspectionOnly = id;chart.userData.explosionExcluded = true;box([390, 400, 1], [0, 0, -3], 'cream', chart).material = new THREE.MeshBasicMaterial({color: 0xf8f5e9});}
  kit.rod(uprightChartPoint(0, 0), uprightChartPoint(C.freeFlow, 0), .7 * MM, 'ink', fanChart);kit.rod(uprightChartPoint(0, 0), uprightChartPoint(0, C.shutoff), .7 * MM, 'ink', fanChart);
  chartText(fanChart, uprightChartPoint, {title: 'Find the operating flow', size: 20 * MM, x: {min: 0, max: C.freeFlow, title: 'Flow (L/s)', ticks: [[0, '0'], [.0175, '17.5'], [.035, '35']]}, y: {min: 0, max: C.shutoff, title: 'Total pressure (kPa)', ticks: [[0, '0'], [2500, '2.5'], [5000, '5']]}, legend: [['Fan', 0xc14f39], ['Air path', BLUE]]});
  const fanLine = lineObject(201, 0xc14f39, fanChart), pathLine = lineObject(202, BLUE, fanChart), operatingDot = kit.sphere(3 * MM, [0, 0, 0], 'clay', fanChart);
  const fanCaption = label(fanChart, '', [0, -180, 2], 17, 355);
  const lossKeys = ['head', 'duct', 'bag', 'cover', 'outlet'], lossNames = ['Head', 'Duct', 'Bag', 'Cover', 'Outlet'];
  rod([-145, -100, 0], [150, -100, 0], .7, 'ink', budgetChart);rod([-145, -100, 0], [-145, 110, 0], .7, 'ink', budgetChart);
  label(budgetChart, 'Flowing pressure losses', [0, 158, 0], 20, 340);label(budgetChart, '5 kPa', [-167, 110, 0], 15);label(budgetChart, '0', [-163, -100, 0], 15);
  const bars = lossKeys.map((key, i) => {const x = -112 + i * 55;label(budgetChart, lossNames[i], [x, -126, 0], 15);return box([32, 1, 8], [x, -100, 0], ['metal', 'blue', 'wood', 'gold', 'leaf'][i], budgetChart);});
  const barLabels = bars.map(bar => label(budgetChart, '', [bar.position.x / MM, -82, 7], 15, 53));
  const budgetCaption = label(budgetChart, '', [0, -175, 0], 17, 355);
  const specs = {
    belt: ['Brush drive', '', [{value: 1, label: 'Belt fitted'}, {value: 0, label: 'Belt removed'}], 'Removing the belt stops the brush while the motor and fan keep turning. Every setting change starts a fresh trial.'],
    height: ['Head height', '', [{value: 0, label: 'Brush touches carpet'}, {value: 1, label: 'Raised 12 mm'}], 'Raising the whole head keeps the shafts aligned but takes the bristles off the carpet. More air can enter around the edges.'],
    seal: ['Fan inlet', '', [{value: 0, label: 'Open eye'}, {value: 1, label: 'Sealed eye'}], 'An ideal teaching gate closes the annular fan inlet. Brush action can continue while air transport stops.'],
    bag: ['Bag resistance', '× clean', null, 'Assigned multiplier from 1 to 4. This is not a percentage-full or dust-mass calibration.'],
    cover: ['Outer cover', '', [{value: 0, label: 'Clean'}, {value: 1, label: 'Loaded'}], 'Loading triples the assigned outer-cover resistance.'],
    motor: ['Motor', '', [{value: 1, label: 'Running'}, {value: 0, label: 'Off'}], 'Compare prescribed steady running with off. Startup, coasting and load-dependent speed are not predicted.'],
  };
  for (const [key, [min, max, step]] of Object.entries(UPRIGHT_DOMAINS)) {const [name, unit, options, help] = specs[key];control(key, name, min, max, step, D[key], unit, help, options, {primary: key === 'belt'});}
  let clock = 0, lastClock = 0, key = '', initialTime = null, preparedSettings = null, disposed = false;
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== key) {
      key = nextKey;clock = initialTime ?? 0;lastClock = 0;
      for (let i = 0; i <= 200; i++) fanLine.geometry.attributes.position.array.set(uprightChartPoint(C.freeFlow * i / 200, values.motor ? uprightFanRise(C.freeFlow * i / 200) : 0), i * 3);
      let pathPoints;
      if (values.seal) pathPoints = [uprightChartPoint(0, 0), uprightChartPoint(0, C.shutoff)];
      else {
        let lo = 0, hi = C.freeFlow;
        if (uprightLosses(values, hi).total > C.shutoff) for (let i = 0; i < 60; i++) {const mid = (lo + hi) / 2;if (uprightLosses(values, mid).total < C.shutoff) lo = mid;else hi = mid;}
        pathPoints = Array.from({length: 202}, (_, i) => {const flow = hi * i / 201;return uprightChartPoint(flow, uprightLosses(values, flow).total);});
      }
      pathPoints.forEach((position, i) => pathLine.geometry.attributes.position.array.set(position, i * 3));pathLine.geometry.setDrawRange(0, pathPoints.length);
      for (const line of [fanLine, pathLine]) {line.geometry.attributes.position.needsUpdate = true;line.geometry.computeBoundingSphere();}
    }
    const s = sampleUpright(values, clock), lift = values.height * C.raisedBy * 1000, route = p.paths.air[values.height];
    p.body.position.y = lift * MM;
    // Wheels and fixed lower guide rods stay on the floor as their sleeves,
    // head, bearings, fan, brush and bag move upward together.
    p.wheels.forEach(wheel => {wheel.position.y = (30 - lift) * MM;});
    p.wheelAxles.forEach(axle => {axle.position.y = (30 - lift) * MM;});
    p.guides.forEach(guide => {guide.position.y = (54 - lift) * MM;});
    p.beltMesh.visible = Boolean(values.belt);p.gate.visible = Boolean(values.seal);
    p.impeller.rotation.z = p.shaft.rotation.z = p.rotor.rotation.z = p.pulleys[0].rotation.z = s.motorAngle;
    p.roller.rotation.z = p.pulleys[1].rotation.z = s.brushAngle;
    p.indicator.material.color.setHex(values.motor ? 0x91aa7e : 0xc14f39);
    p.beltMarks.forEach((mark, i) => {mark.visible = Boolean(values.belt);const distance = -s.beltSpeed * s.elapsed * 1000 + i * p.beltPath.length / p.beltMarks.length, at = p.beltPath.at(distance);mark.position.set(...point([at.point[0], at.point[1], at.point[2] - 4.5]));});
    const paperColor = new THREE.Color(0xf0dfaf).lerp(new THREE.Color(0x9b8865), (values.bag - 1) / 3);
    p.bagPaper.forEach(mesh => mesh.material.color.copy(paperColor));p.coverMeshes.forEach(mesh => mesh.material.color.setHex(values.cover ? 0x68745d : 0x91aa7e));
    p.dots.forEach((dot, i) => {dot.visible = s.flow > 0;if (dot.visible) dot.position.set(...point(tracePoint(route, (s.volume + i * route.volume / p.dots.length) % route.volume)));});
    let bound = 0, loose = 0, inTransit = 0, collected = 0;
    const markerStates = [];
    p.grains.forEach((grain, i) => {
      const trace = p.paths.dust[values.height][i], release = s.releaseTimes[i], released = release !== null && clock >= release;
      const volume = released ? s.flow * (clock - release) / C.slowdown : 0;
      let state;
      if (!released) {bound++;state = 'bound';}
      else if (volume >= trace.route.volume) {collected++;state = 'collected';}
      else if (volume <= trace.entryVolume) {loose++;state = 'loose';}
      else {inTransit++;state = 'in transit';}
      grain.position.set(...point(tracePoint(trace.route, volume)));markerStates.push({state, volume, release});
    });
    operatingDot.position.set(...uprightChartPoint(s.flow, s.pressure));
    fanCaption.userData.setText(`${fixed(s.flow * 1000, 2)} L/s · ${fixed(s.pressure / 1000, 2)} kPa${values.seal ? ' · eye sealed' : ''}`);
    bars.forEach((bar, i) => {const h = s.drops[lossKeys[i]] / C.shutoff * 210;bar.visible = h > 0;bar.scale.y = Math.max(.0001, h);bar.position.y = (-100 + h / 2) * MM;barLabels[i].position.y = (-82 + h) * MM;barLabels[i].userData.setText(fixed(s.drops[lossKeys[i]] / 1000, 2));});
    budgetCaption.userData.setText(s.sealPressure ? 'Sealed: 5 kPa static; losses zero.' : `Total ${fixed(s.total / 1000, 2)} kPa · all bars in kPa`);
    const cause = !values.motor ? 'Motor off: no brush drive or airflow' : values.seal ? 'Brush action without air transport' : !values.belt ? 'Airflow continues; brush drive disconnected' : values.height ? 'Brush turns above the carpet' : 'Brush releases; airflow carries; paper retains';
    return {state: {...s, bound, loose, inTransit, collected, markerStates}, readings: [
      r('Your result', `${collected} of 12 markers retained · ${bound} still bound`, `${cause}. ${fixed(s.clock, 1)} of 90 trace seconds.`),
      r('Dust account', `${bound} + ${loose} + ${inTransit} + ${collected} = 12`, 'Bound to fibers + loose near the inlet + in transit + retained on paper. This selected sample is not a measured cleaning percentage.'),
      r('Brush drive', `${fixed(s.motorRpm, 0)} rpm motor · ${fixed(s.brushRpm, 0)} rpm brush`, `8 mm and 24 mm pitch radii. ${values.belt ? 'No slip is assumed.' : 'Belt removed.'} ${s.brushContact ? 'Bristles reach the carpet.' : 'Bristles miss the carpet by 12 mm.'}`),
      r('Airflow', `${fixed(s.flow * 1000, 2)} L/s`, 'Assigned steady fan and system curves. Raising the head can increase flow without releasing this bound sample.'),
      r('Average entry speed', `${fixed(s.slotSpeed, 2)} m/s`, `Across ${fixed(s.slotArea * 1e6, 0)} mm² of open edges. Duct mean speed ${fixed(s.ductSpeed, 2)} m/s. The floor velocity field is not resolved.`),
      r('Fan total-pressure rise', `${fixed(s.pressure / 1000, 2)} kPa`, 'Total pressure includes kinetic energy per volume. It is distinct from local static pressure.'),
      r('Bag and cover pressure', `${fixed(s.bagPressure / 1000, 2)} / ${fixed(s.coverPressure / 1000, 2)} kPa above room`, 'Broad-plenum section-average estimates. Positive pressure drives air outward; fabric shape and local jet pressure are not predicted.'),
      r('Flowing pressure losses', lossKeys.map((k, i) => `${lossNames[i]} ${fixed(s.drops[k] / 1000, 2)}`).join(' · ') + ' kPa', s.sealPressure ? 'No flow means zero dissipative losses. Static pressure acts across the closed gate.' : 'These losses add to the fan total-pressure rise.'),
      r('Gate holding force', `${fixed(s.holdingForce, 2)} N`, 'Uniform static pressure difference times the annular eye area, excluding the 5 mm shaft radius.'),
      r('Power delivered to air', `${fixed(s.airPower, 2)} W`, 'Total-pressure rise × volume flow. Electrical consumption and cleaning effectiveness are not predicted.'),
      r('Represented interval', `${fixed(s.elapsed, 3)} s · ${fixed(s.volume * 1000, 2)} L transported`, 'Drive and transport slowed 300×, played at 3×. Every changed setting starts a fresh sample.'),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values);if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null;preparedSettings = null;}return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null;preparedSettings = null;clock = Math.min(C.duration, clock + dt * C.playbackSpeed);}return render();};
  result.animate = time => {const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0;if (Number.isFinite(time)) lastClock = time;return result.advance(dt);};
  result.reset = ({time = 0, settings} = {}) => {preparedSettings = {...(settings ?? result.defaults)};uprightPlan(preparedSettings);if (!Number.isFinite(time) || time < 0 || time > C.duration) throw new RangeError('Invalid upright trace checkpoint');initialTime = time;key = '';clock = lastClock = 0;return render(preparedSettings);};
  result.replayState = () => ({time: 0, settings: result.getState().values});
  const inspect = (name, id, view = 'iso', isolate = false) => ({label: name, part: id, view, isolate, replay: false, run: () => render()});
  result.actions = [inspect('Inspect: complete cleaner', 'system'), inspect('Inspect: brush and carpet', 'intake', 'front'), inspect('Inspect: belt and pulleys', 'belt', 'front', true), inspect('Inspect: height supports', 'height'), inspect('Inspect: motor and fan', 'drive'), inspect('Inspect: impeller passages', 'impeller', 'front', true), inspect('Inspect: hollow discharge duct', 'duct'), inspect('Inspect: retained sample', 'capture', 'front'), inspect('Inspect: outer cover', 'cover'), inspect('Compare fan and path curves', 'fan-chart', 'front', true), inspect('Compare pressure losses', 'budget-chart', 'front', true)];
  result.playback = {label: 'Run brush and airflow trace', description: 'Ninety slowed trace seconds, played at 3×. The represented steady interval is 0.3 seconds. Experiments open at named checkpoints.', stepLabel: 'Advance one trace second', advance: result.advance, step: () => result.advance(1 / C.playbackSpeed), complete: () => clock >= C.duration, blocked: () => false};
  result.initialPart = result.autoFramePart = 'system';result.initialView = 'iso';result.frameVisibleOnly = true;result.framePadding = .7;result.selectionOutline = false;result.transparentBackground = true;
  result.viewDirections = {iso: [1.4, .6, -2.7], front: [0, .05, -3], back: [0, .05, 3], side: [2.7, .6, -.2]};
  result.partViewDirections = {'fan-chart': {front: [0, 0, 3]}, 'budget-chart': {front: [0, 0, 3]}, intake: {front: [-2.8, 1.2, -1.2]}, drive: {iso: [1.6, .9, 2.5]}, brush: {bottom: [1, -2, -2]}, bag: {front: [0, 0, -3]}};
  result.thumbnailOmit = [fanChart, budgetChart, p.air, p.dust];
  for (const item of result.parts) {item.maxZoom = 300;item.framePadding = ['fan-chart', 'budget-chart'].includes(item.id) ? .57 : .68;}
  result.topology = {...p, system, MM, UG, fanChart, budgetChart, fanLine, pathLine, operatingDot, bars, barLabels};
  const dispose = result.dispose;result.dispose = () => {if (disposed) return;disposed = true;dispose();};return result;
}

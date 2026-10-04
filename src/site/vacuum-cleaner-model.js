import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {CLEANER as C, CLEANER_DEFAULTS as D, CLEANER_DOMAINS, CLEANER_NOZZLES, cleanerFanRise, cleanerLosses, cleanerPlan, sampleCleaner} from './vacuum-cleaner-physics.js';
import {MM, G, point, cleanerPaths, tracePoint, annulusGeometry, plateGeometry, creviceGeometry, creviceTip, creviceDirection} from './vacuum-cleaner-geometry.js';

const TAU = 2 * Math.PI, BLUE = 0x477f9b;
export const cleanerChartPoint = (flow, pressure) => point([-135 + flow / C.freeFlow * 270, -100 + pressure / C.shutoff * 210, 0]);
function surface(kit, geometry, color, parent, opacity = 1) {
  const mesh = kit.cylinder(1, 1, [0, 0, 0], color, parent);mesh.geometry.dispose();mesh.geometry = geometry;mesh.material = mesh.material.clone();mesh.material.side = THREE.DoubleSide;
  if (opacity < 1) {mesh.material.transparent = true;mesh.material.opacity = opacity;mesh.material.depthWrite = false;}
  return mesh;
}

export function createVacuumCleanerModel() {
  const kit = houseModel('Vacuum cleaner'), {root, part, control} = kit, paths = cleanerPaths();
  const box = (size, pos, color, parent) => kit.box(point(size), point(pos), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(point(a), point(b), radius * MM, color, parent);
  const label = (parent, text, pos, height = 12, width) => {const mesh = textLabel(parent, text, {position: point(pos), height: height * MM, ...(width ? {width: width * MM} : {})});mesh.raycast = () => {};return mesh;};
  const ring = (inner, outer, height, pos, color, parent, axis = 'x', opacity = 1, start = 0, span = TAU) => {
    const mesh = surface(kit, annulusGeometry(inner, outer, height, start, span), color, parent, opacity);mesh.position.set(...point(pos));if (axis === 'x') mesh.rotation.z = -Math.PI / 2;if (axis === 'z') mesh.rotation.x = Math.PI / 2;return mesh;
  };
  const plate = (width, height, depth, pos, hole, color, parent, axis = 'x') => {
    const mesh = surface(kit, plateGeometry(width, height, depth, hole), color, parent);mesh.position.set(...point(pos));if (axis === 'x') mesh.rotation.y = Math.PI / 2;if (axis === 'y') mesh.rotation.x = -Math.PI / 2;return mesh;
  };
  const pipe = (a, b, parent, color = 'metal', opacity = .35) => {
    const av = new THREE.Vector3(...point(a)), bv = new THREE.Vector3(...point(b)), delta = bv.clone().sub(av);
    const mesh = surface(kit, annulusGeometry(G.pipeInner, G.pipeOuter, delta.length() / MM), color, parent, opacity);mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());return mesh;
  };
  const system = part('system', 'Vacuum cleaner', 'A cutaway canister cleaner. An assigned fan curve drives air through a real connected inlet, bag, pre-motor filter and outlet. Enlarged loose-dust tracers stay in the bag. They do not predict pickup efficiency.');
  const intake = part('intake', 'Head, wand and hose', 'The intake carries room air and loose dust to the canister. The wand and curved hose together have the 2.6 m length used by the flow calculation.', [0, 0, 0], system);
  const collection = part('collection', 'Case, bag and filter', 'The bag retains the illustrated dust while air crosses its porous wall. A separate pre-motor filter protects the blower. Front and top surfaces are cut away.', [0, 0, 0], system);
  const drive = part('drive', 'Motor, shaft and blower', 'A common shaft turns the motor rotor and centrifugal impeller. The impeller accepts air near its axis and sends it outward into a collector and exhaust duct. Rotation is separately slowed for inspection.', [0, 0, 0], system);

  const nozzle = part('nozzle', 'Interchangeable inlet head', 'The floor head has a 250 by 6 mm front entry; the crevice mouth is 25 by 12 mm. Both connect to the same wand. A sealing plate can close the floor opening.', [0, 0, 0], intake);
  const head = new THREE.Group();nozzle.add(head);
  box([4, 42, 250], [-423, 27, 180], 'metal', head);
  box([4, 48, 258], [-337, 24, 180], 'metal', head);
  for (const z of [53, 307]) box([90, 48, 4], [-380, 24, z], 'metal', head);
  const headRoof = plate(90, 258, 3, [-380, 48, 180], {x: G.neck[0] + 380, radius: 19}, 'metal', head, 'y');headRoof.material.transparent = true;headRoof.material.opacity = .35;headRoof.material.depthWrite = false;
  const headNeck = pipe(G.neck, G.wandStart, head);
  const headCollar = ring(19, 25, 4, G.neck, 'ink', head, 'y');
  const tool = surface(kit, creviceGeometry(), 'metal', nozzle, .5);tool.position.set(...point(creviceTip));tool.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...creviceDirection).negate());
  const seal = part('seal', 'Inlet sealing plate', 'This ideal plate covers only the 250 by 6 mm front opening. Pressure difference times that opening area gives its holding force. It is an experiment inside the model.', [0, 0, 0], nozzle);
  const sealPlate = box([3, 6, 250], [-426.5, 3, 180], 'red', seal);
  box([7, 18, 22], [-432, 10, 180], 'red', seal);

  const wand = part('wand', 'Hollow rigid wand', 'A 32 mm clear bore carries the air and tracers up to the hose. Both ends are open, with an explicitly drawn wall.', [0, 0, 0], intake);
  const wandTube = pipe(G.wandStart, G.handle, wand);
  const hose = part('hose', 'Hollow flexible hose', 'The hose loops behind the wand to keep the complete apparatus compact. Its 32 mm bore joins the wand directly to the bag inlet; the drawing and flow calculation use the same total pipe length.', [0, 0, 0], intake);
  const outerGeometry = new THREE.TubeGeometry(paths.hoseCurve, 480, G.pipeOuter, 24, false);outerGeometry.scale(MM, MM, MM);
  const hoseOuter = surface(kit, outerGeometry, 'blue', hose, .27);
  const innerGeometry = new THREE.TubeGeometry(paths.hoseCurve, 480, G.pipeInner, 24, false);innerGeometry.scale(MM, MM, MM);
  const hoseInner = surface(kit, innerGeometry, 'blue', hose, .2);hoseInner.material.side = THREE.BackSide;
  const hoseEnds = [0, 1].map(t => {const mesh = surface(kit, new THREE.RingGeometry(G.pipeInner * MM, G.pipeOuter * MM, 64), 'blue', hose);mesh.position.copy(paths.hoseCurve.getPointAt(t)).multiplyScalar(MM);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), paths.hoseCurve.getTangentAt(t));return mesh;});

  const casing = part('casing', 'Cutaway case and wheeled chassis', 'The sealed case guides air through the filtering and blower stages. Its front wall and most of its roof are removed in this teaching view. Wheels, axles and motor supports remain connected to the chassis.', [0, 0, 0], collection);
  box([470, 8, 290], [235, 76, 0], 'cream', casing);
  box([470, 280, 6], [235, 220, -145], 'cream', casing);
  box([470, 8, 46], [235, 360, -122], 'cream', casing);
  const inletWall = plate(290, 280, 6, [0, 220, 0], {radius: 18}, 'cream', casing);
  const outletWall = plate(290, 280, 6, [470, 220, 0], {width: 100, height: 50, y: 105}, 'cream', casing);
  const wheels = [], axles = [];
  for (const x of [60, 400]) {
    axles.push(rod([x, 36, -168], [x, 36, 168], 5, 'metal', casing));
    for (const z of [-156, 156]) {const wheel = kit.disk(36 * MM, 22 * MM, point([x, 36, z]), 'ink', casing);wheels.push(wheel);box([16, 38, 10], [x, 54, Math.sign(z) * 136], 'metal', casing);}
  }
  label(casing, 'Front and roof cut away', [225, 374, -110], 11, 300);

  const bag = part('bag', 'Porous dust bag', 'Loose-dust markers enter through the round collar and remain inside this cutaway bag. Air passes through the paper. The selected resistance factor represents accumulated loading; it is not a percentage-full calibration.', [0, 0, 0], collection);
  const bagPaper = [];
  const paperBox = (size, pos) => {const mesh = box(size, pos, 'cream', bag);mesh.material = mesh.material.clone();mesh.material.transparent = true;mesh.material.opacity = .42;mesh.material.depthWrite = false;bagPaper.push(mesh);return mesh;};
  paperBox([200, 2, 200], [130, 119, 0]);paperBox([200, 2, 200], [130, 321, 0]);paperBox([200, 202, 2], [130, 220, -101]);paperBox([2, 202, 202], [231, 220, 0]);
  const bagFront = plate(202, 202, 2, [29, 220, 0], {radius: 16}, 'cream', bag);bagPaper.push(bagFront);
  const bagCollar = pipe(G.inlet, G.bagEntry, bag, 'ink', .5);
  for (const z of [-101, 101]) for (const y of [119, 321]) rod([30, y, z], [232, y, z], 1, 'wood', bag);
  for (let y = 140; y <= 300; y += 40) rod([231.8, y, -98], [231.8, y, 98], .7, 'wood', bag);

  const filter = part('filter', 'Pleated pre-motor filter', 'Porous pleats intercept finer dust before it reaches the blower. The surrounding partition closes the bypass path. Loading multiplies this example filter resistance by three; no filtration efficiency is predicted.', [0, 0, 0], collection);
  const filterPartition = plate(284, 276, 28, [252, 218, 0], {width: 200, height: 200, y: 2}, 'metal', filter);
  const pleats = [];
  for (let i = 0; i < 24; i++) {const z0 = -100 + i * 200 / 24, z1 = -100 + (i + 1) * 200 / 24, x0 = i % 2 ? 258 : 246, x1 = i % 2 ? 246 : 258;const mesh = surface(kit, new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...point([x0, 120, z0]), ...point([x1, 120, z1]), ...point([x1, 320, z1]), ...point([x0, 120, z0]), ...point([x1, 320, z1]), ...point([x0, 320, z0])], 3)), 'metal', filter);mesh.geometry.computeVertexNormals();pleats.push(mesh);}

  const blower = part('blower', 'Blower housing and collector', 'The axial eye admits filtered air. Radial passages between rotating blades send it outward; the stationary collector directs it toward the outlet. The top outlet and cutaway surfaces expose that change of direction.', [0, 0, 0], drive);
  const housing = ring(78, 82, 42, [308, 230, 0], 'blue', blower, 'x', .55, -Math.PI / 2 + .45, TAU - .9);
  const inletRing = ring(26, 82, 4, [285, 230, 0], 'metal', blower, 'x', .5);
  const rearPlate = ring(12, 82, 4, [331, 230, 0], 'metal', blower, 'x', .5);
  const blowerBearing = ring(5.1, 12, 8, [331, 230, 0], 'ink', blower);
  for (const x of [283, 333]) box([18, 68, 65], [x, 114, 0], 'metal', blower);

  const impeller = part('impeller', 'Centrifugal impeller', 'The impeller turns with the drive shaft. Air enters around its hub and travels outward between the blades. The assigned fan curve represents its settled pressure-flow behavior; blade aerodynamics are not solved.', point([G.fanX, G.axisY, 0]), drive);
  const frontShroud = ring(25, 68, 3, [-10, 0, 0], 'gold', impeller, 'x', .25), backShroud = ring(5, 68, 3, [10, 0, 0], 'metal', impeller);
  const hub = ring(5, 11, 26, [0, 0, 0], 'ink', impeller), blades = [];
  for (let i = 0; i < 8; i++) {const blade = box([17, 40, 4], [0, 0, 0], 'gold', impeller);blade.geometry.translate(0, 46 * MM, 0);blade.rotation.x = TAU * i / 8;blades.push(blade);}
  const shaft = part('shaft', 'Common motor and impeller shaft', 'This continuous shaft joins the rotor to the impeller through the housing bearings. All three turn through the same angle; the supporting case stays fixed.', point([0, G.axisY, 0]), drive);
  const shaftMesh = rod([295, 0, 0], [438, 0, 0], G.shaftRadius, 'ink', shaft);box([130, 2, 2], [366, 5, 0], 'cream', shaft);
  const motor = part('motor', 'Motor and supporting feet', 'A simplified powered rotor drives the shaft inside a fixed stator. The control selects steady running or off. No torque curve, electrical consumption, startup, cooling or load-dependent speed is predicted.', [0, 0, 0], drive);
  const stator = ring(30, 44, 90, [390, 230, 0], 'gold', motor, 'x', 1, Math.PI / 2, Math.PI);
  const motorEnds = [345, 435].map(x => ring(12, 44, 5, [x, 230, 0], 'metal', motor));
  const motorBearings = [345, 435].map(x => ring(5.1, 12, 5, [x, 230, 0], 'ink', motor));
  const rotor = new THREE.Group();rotor.position.set(...point([390, 230, 0]));motor.add(rotor);
  ring(5, 24, 70, [0, 0, 0], 'metal', rotor);
  for (let i = 0; i < 8; i++) {const a = TAU * i / 8;rod([-33, 24 * Math.cos(a), 24 * Math.sin(a)], [33, 24 * Math.cos(a), 24 * Math.sin(a)], 2, 'wood', rotor);}
  for (const x of [363, 417]) box([20, 106, 55], [x, 133, 0], 'metal', motor);
  const indicator = box([18, 14, 6], [414, 160, 32], 'leaf', motor);indicator.material = indicator.material.clone();

  const exhaust = part('exhaust', 'Exhaust duct and grille', 'The collected air leaves through a duct and an open grille. A 100 by 50 mm opening with five 4 mm bars leaves 4000 square millimeters of open area, the value used in the flow calculation.', [0, 0, 0], drive);
  const collectorFloor = plate(190, 100, 3, [380, 299, 0], {x: -72, width: 44, height: 72}, 'blue', exhaust, 'y');
  box([190, 3, 100], [380, 351, 0], 'blue', exhaust);box([190, 52, 3], [380, 325, -51], 'blue', exhaust);box([3, 52, 100], [285, 325, 0], 'blue', exhaust);
  const grille = [];
  for (const z of [-40, -20, 0, 20, 40]) grille.push(box([4, 50, 4], [474, 325, z], 'ink', exhaust));

  const air = part('air', 'Moving air tracers', 'Blue tracers follow a continuous representative route, slowed thirty times. The route uses section-average speeds. It does not resolve three-dimensional jets or turbulence. Air tracers recirculate as a visual stream; dust tracers do not.', [0, 0, 0], system);air.userData.explosionExcluded = true;
  const dots = Array.from({length: 48}, () => kit.sphere(1.8 * MM, [0, 0, 0], BLUE, air));
  const dust = part('dust', 'Loose dust and retained sample', 'Twelve enlarged representative markers start outside the head, travel into the bag and stay there. Counts always add to twelve. The fixed bag setting is not changed by this tiny sample. Pickup forces, adhesion and filter efficiency are outside this trace.', [0, 0, 0], system);dust.userData.explosionExcluded = true;
  const grains = Array.from({length: C.markerCount}, () => kit.sphere(2.3 * MM, [0, 0, 0], 'clay', dust));
  const floor = box([300, 4, 340], [-470, -2, 180], 'wood', dust);floor.userData.explosionExcluded = true;

  const fanChart = part('fan-chart', 'Fan and flow-resistance curves', 'The fan and path curves meet at the operating point. A sealed inlet forces zero flow; switching the motor off removes the pressure rise. These are assigned total-pressure characteristics, not product measurements.', point([750, 400, 0]), system);
  const budgetChart = part('budget-chart', 'Pressure-loss budget', 'For flowing air the component losses sum to the fan total-pressure rise. A sealed opening supports a static pressure difference but dissipates no flow power, so these loss bars are zero.', point([750, 400, 0]), system);
  for (const chart of [fanChart, budgetChart]) {chart.userData.inspectionOnly = chart === fanChart ? 'fan-chart' : 'budget-chart';chart.userData.explosionExcluded = true;box([390, 400, 1], [0, 0, -3], 'cream', chart).material = new THREE.MeshBasicMaterial({color: 0xf8f5e9});}
  kit.rod(cleanerChartPoint(0, 0), cleanerChartPoint(C.freeFlow, 0), .7 * MM, 'ink', fanChart);kit.rod(cleanerChartPoint(0, 0), cleanerChartPoint(0, C.shutoff), .7 * MM, 'ink', fanChart);
  chartText(fanChart, cleanerChartPoint, {title: 'Find the operating flow', size: 20 * MM, x: {min: 0, max: C.freeFlow, title: 'Flow (L/s)', ticks: [[0, '0'], [.0175, '17.5'], [.035, '35']]}, y: {min: 0, max: C.shutoff, title: 'Total pressure (kPa)', ticks: [[0, '0'], [3500, '3.5'], [7000, '7']]}, legend: [['Fan', 0xc14f39], ['Air path', BLUE]]});
  const fanLine = lineObject(201, 0xc14f39, fanChart), pathLine = lineObject(202, BLUE, fanChart), operatingDot = kit.sphere(3 * MM, [0, 0, 0], 'clay', fanChart);
  const fanCaption = label(fanChart, '', [0, -180, 2], 17, 350);
  const lossKeys = ['head', 'hose', 'bag', 'filter', 'outlet'], lossNames = ['Head', 'Hose', 'Bag', 'Filter', 'Outlet'];
  rod([-145, -100, 0], [150, -100, 0], .7, 'ink', budgetChart);rod([-145, -100, 0], [-145, 110, 0], .7, 'ink', budgetChart);
  label(budgetChart, 'Flowing pressure losses', [0, 158, 0], 20, 340);label(budgetChart, '7 kPa', [-167, 110, 0], 15);label(budgetChart, '0', [-163, -100, 0], 15);
  const bars = lossKeys.map((key, i) => {const x = -112 + i * 55;label(budgetChart, lossNames[i], [x, -126, 0], 15);return box([32, 1, 8], [x, -100, 0], ['metal', 'blue', 'wood', 'gold', 'leaf'][i], budgetChart);});
  const barLabels = bars.map(bar => label(budgetChart, '', [bar.position.x / MM, -82, 7], 15, 53));
  const budgetCaption = label(budgetChart, '', [0, -175, 0], 17, 355);

  // Face the intake toward the angled camera while keeping charts upright.
  const apparatus = new THREE.Group();system.add(apparatus);apparatus.add(intake, collection, drive, air, dust);apparatus.rotation.y = Math.PI / 2;

  const specs = {
    nozzle: ['Inlet head', '', CLEANER_NOZZLES.map(({value, label}) => ({value, label})), 'Choose a wide floor entry, a narrow crevice mouth, or a sealed floor entry. Every changed setting starts a fresh trace.'],
    bag: ['Bag resistance', '× clean', null, 'Assigned pressure-drop multiplier from 1 to 4. It represents loading, not percentage full or a measured dust mass.'],
    filter: ['Pre-motor filter', '', [{value: 0, label: 'Clean'}, {value: 1, label: 'Loaded'}], 'Loaded multiplies the assigned filter resistance by three.'],
    motor: ['Motor', '', [{value: 1, label: 'Running'}, {value: 0, label: 'Off'}], 'Select prescribed steady running or no drive. Startup and coast-down are outside this comparison.'],
  };
  for (const [key, [min, max, step]] of Object.entries(CLEANER_DOMAINS)) {const [name, unit, options, help] = specs[key];control(key, name, min, max, step, D[key], unit, help, options, {primary: key === 'nozzle'});}
  let clock = 0, lastClock = 0, key = '', initialTime = null, preparedSettings = null, disposed = false;
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== key) {
      key = nextKey;clock = initialTime ?? 0;lastClock = 0;
      for (let i = 0; i <= 200; i++) fanLine.geometry.attributes.position.array.set(cleanerChartPoint(C.freeFlow * i / 200, values.motor ? cleanerFanRise(C.freeFlow * i / 200) : 0), i * 3);
      let pathPoints;
      if (values.nozzle === 2) pathPoints = [cleanerChartPoint(0, 0), cleanerChartPoint(0, C.shutoff)];
      else {
        let lo = 0, hi = C.freeFlow;
        if (cleanerLosses(values, hi).total > C.shutoff) for (let i = 0; i < 60; i++) {const mid = (lo + hi) / 2;if (cleanerLosses(values, mid).total < C.shutoff) lo = mid;else hi = mid;}
        const end = hi;pathPoints = Array.from({length: 202}, (_, i) => {const flow = end * i / 201;return cleanerChartPoint(flow, cleanerLosses(values, flow).total);});
      }
      pathPoints.forEach((p, i) => pathLine.geometry.attributes.position.array.set(p, i * 3));pathLine.geometry.setDrawRange(0, pathPoints.length);
      for (const line of [fanLine, pathLine]) {line.geometry.attributes.position.needsUpdate = true;line.geometry.computeBoundingSphere();}
    }
    const s = sampleCleaner(values, clock), fitted = values.nozzle === 1 ? 1 : 0, route = paths.air[fitted], movedVolume = s.volume;
    head.visible = values.nozzle !== 1;tool.visible = values.nozzle === 1;seal.visible = values.nozzle === 2;
    const angle = values.motor ? TAU * clock : 0;impeller.rotation.x = shaft.rotation.x = rotor.rotation.x = angle;
    indicator.material.color.setHex(values.motor ? 0x91aa7e : 0xc14f39);
    const paperColor = new THREE.Color(0xf0dfaf).lerp(new THREE.Color(0x9b8865), (values.bag - 1) / 3);
    bagPaper.forEach(mesh => mesh.material.color.copy(paperColor));pleats.forEach(mesh => mesh.material.color.setHex(values.filter ? 0x6b7365 : 0xb4c5b0));
    dots.forEach((dot, i) => {dot.visible = s.flow > 0;if (dot.visible) dot.position.set(...point(tracePoint(route, (movedVolume + i * route.volume / dots.length) % route.volume)));});
    let onFloor = 0, inTransit = 0, collected = 0;
    grains.forEach((grain, i) => {const trace = paths.dust[fitted][i];grain.position.set(...point(tracePoint(trace.route, movedVolume)));if (movedVolume >= trace.route.volume) collected++;else if (movedVolume <= trace.entryVolume) onFloor++;else inTransit++;});
    floor.position.x = (fitted ? -445 : -470) * MM;floor.scale.z = fitted ? .2 : 1;
    operatingDot.position.set(...cleanerChartPoint(s.flow, s.pressure));
    fanCaption.userData.setText(`${fixed(s.flow * 1000, 2)} L/s · ${fixed(s.pressure / 1000, 2)} kPa${values.nozzle === 2 ? ' · sealed inlet' : ''}`);
    bars.forEach((bar, i) => {const h = s.drops[lossKeys[i]] / C.shutoff * 210;bar.visible = h > 0;bar.scale.y = Math.max(.0001, h);bar.position.y = (-100 + h / 2) * MM;barLabels[i].position.y = (-82 + h) * MM;barLabels[i].userData.setText(fixed(s.drops[lossKeys[i]] / 1000, 2));});
    budgetCaption.userData.setText(s.sealPressure ? 'Sealed: 7 kPa static; losses zero.' : `Total ${fixed(s.total / 1000, 2)} kPa · all bars in kPa`);
    return {state: {...s, onFloor, inTransit, collected}, readings: [
      r('Your result', s.blocked || `${collected} of ${C.markerCount} dust markers retained in the bag`, `${fixed(s.clock, 1)} of 30 trace seconds. Changing a setting starts a fresh sample.`),
      r('Dust account', `${onFloor} + ${inTransit} + ${collected} = ${C.markerCount}`, 'Outside the inlet + in transit + retained. Dust never respawns or passes through the fan.'),
      r('Airflow', `${fixed(s.flow * 1000, 2)} L/s`, 'Assigned fan and path curves determine this constant-density steady flow.'),
      r('Speed at the opening', `${fixed(s.slotSpeed, 2)} m/s`, `Average hose speed ${fixed(s.hoseSpeed, 2)} m/s. These are section averages, not a resolved velocity field.`),
      r('Fan total-pressure rise', `${fixed(s.pressure / 1000, 2)} kPa`, 'Total pressure includes kinetic energy per volume. It is not a local static-pressure map.'),
      r('Pressure differences along the path', lossKeys.map((k, i) => `${lossNames[i]} ${fixed(s.drops[k] / 1000, 2)}`).join(' · ') + ' kPa', s.sealPressure ? 'With zero flow these losses vanish. The static difference is across the sealing plate.' : 'The five flowing losses sum to the fan rise.'),
      r('Holding force on sealing plate', `${fixed(s.holdingForce, 2)} N`, s.nozzle.sealed ? 'Pressure difference × 250 by 6 mm opening area.' : 'No sealing plate in the open path.'),
      r('Power delivered to air', `${fixed(s.airPower, 2)} W`, 'Fan total-pressure rise × volume flow. This does not predict electrical power or cleaning effectiveness.'),
      r('Time and transported air', `${fixed(s.elapsed, 3)} s · ${fixed(s.volume * 1000, 2)} L`, 'Air and dust paths are slowed 30×. Fan rotation is separately slowed. The sample is illustrative, not a cleaning-rate measurement.'),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values);if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null;preparedSettings = null;}return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null;preparedSettings = null;clock = Math.min(C.duration, clock + dt * C.playbackSpeed);}return render();};
  result.animate = time => {const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0;if (Number.isFinite(time)) lastClock = time;return result.advance(dt);};
  result.reset = ({time = 0, settings} = {}) => {preparedSettings = {...(settings ?? result.defaults)};cleanerPlan(preparedSettings);if (!Number.isFinite(time) || time < 0 || time > C.duration) throw new RangeError('Invalid vacuum trace checkpoint');initialTime = time;key = '';clock = lastClock = 0;return render(preparedSettings);};
  result.replayState = () => ({time: 0, settings: result.getState().values});
  const inspect = (name, id, view = 'iso', isolate = false) => ({label: name, part: id, view, isolate, replay: false, run: () => render()});
  result.actions = [inspect('Inspect: complete cleaner', 'system'), inspect('Inspect: inlet head', 'nozzle'), inspect('Inspect: hollow hose', 'hose'), inspect('Inspect: bag and retained dust', 'bag', 'side'), inspect('Inspect: pre-motor filter', 'filter', 'front', true), inspect('Inspect: common drive', 'drive', 'side'), inspect('Inspect: impeller passages', 'impeller', 'side', true), inspect('Inspect: exhaust grille', 'exhaust'), inspect('Compare fan and path curves', 'fan-chart', 'front', true), inspect('Compare pressure losses', 'budget-chart', 'front', true)];
  result.playback = {label: 'Run the dust trace', description: 'Thirty seconds of slowed tracing, played at 2×. One represented second of steady airflow. Presets open at named checkpoints.', stepLabel: 'Advance one trace second', advance: result.advance, step: () => result.advance(1 / C.playbackSpeed), complete: () => clock >= C.duration, blocked: () => false};
  result.initialPart = result.autoFramePart = 'system';result.initialView = 'iso';result.frameVisibleOnly = true;result.framePadding = .7;result.selectionOutline = false;result.transparentBackground = true;result.thumbnailOmit = [fanChart, budgetChart, air, dust];
  result.viewDirections = {iso: [2.4, .9, .3], side: [2.7, 1.3, 0]};
  result.partViewDirections = {nozzle: {iso: [.4, 1, 2.7], bottom: [1.2, -1.5, 2.4]}, impeller: {side: [.5, .5, 2.7]}};
  for (const p of result.parts) {p.maxZoom = 300;p.framePadding = ['fan-chart', 'budget-chart'].includes(p.id) ? .57 : .68;}
  result.topology = {MM, G, paths, system, apparatus, collectorFloor, intake, collection, drive, nozzle, head, headRoof, headNeck, headCollar, tool, seal, sealPlate, wand, wandTube, hose, hoseOuter, hoseInner, hoseEnds, casing, inletWall, outletWall, wheels, axles, bag, bagPaper, bagFront, bagCollar, filter, filterPartition, pleats, blower, housing, inletRing, rearPlate, blowerBearing, impeller, frontShroud, backShroud, hub, blades, shaft, shaftMesh, motor, stator, motorEnds, motorBearings, rotor, indicator, exhaust, grille, air, dots, dust, grains, floor, fanChart, budgetChart, fanLine, pathLine, operatingDot, bars, barLabels};
  const dispose = result.dispose;result.dispose = () => {if (disposed) return;disposed = true;dispose();};return result;
}

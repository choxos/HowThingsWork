import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, fillLine, solidArrow} from './scene-kit.js';
import {sampleOven, spotSpacing, fieldPhase, stirShift, turns, stirs, OVEN, STIRRING, FIELDS, OVEN_DEFAULTS as D, OVEN_DOMAINS} from './microwave-physics.js';

const MM = 0.004, TAU = Math.PI * 2;
const PLATE_TOP = 14, FOOD_BOTTOM = 17, FOOD_TOP = FOOD_BOTTOM + OVEN.height * 1000;
const CHART = {left: -135, width: 360, bottom: 310, height: 120, z: -110};
const COLD = new THREE.Color(0x4f86c6), HOT = new THREE.Color(0xd23b1f);
export const foodColor = T => COLD.clone().lerp(HOT, Math.max(0, Math.min(1, (T - 20) / 80)));
export const chartPoint = (t, T) => [(CHART.left + t / OVEN.duration * CHART.width) * MM, (CHART.bottom + (T - 20) / 80 * CHART.height) * MM, CHART.z * MM];

export function createMicrowaveModel() {
  const kit = houseModel('Microwave oven'), {root, part, control, finish, covers} = kit;
  const textures = [], labels = [];
  const system = part('system', 'Microwave oven', 'Electrical energy becomes microwaves, then thermal energy in the food. The cutaway reveals connected parts; removing a wall in this teaching view does not open a real oven.');
  const box = (size, pos, color, parent, cover = false) => { const m = kit.box(size.map(v => v * MM), pos.map(v => v * MM), color, parent); if (cover) covers.push(m); return m; };
  const cylinder = (radius, height, pos, color, parent) => kit.cylinder(radius * MM, height * MM, pos.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  function horizontalPanel(parent, y, left, right, back, front, hole, thickness = 4, cover = false) {
    const [x0, x1, z0, z1] = hole, pieces = [];
    for (const [a, b, c, d] of [[left, x0, back, front], [x1, right, back, front], [x0, x1, back, z0], [x0, x1, z1, front]]) {
      if (b > a && d > c) pieces.push(box([b - a, thickness, d - c], [(a + b) / 2, y, (c + d) / 2], 'metal', parent, cover));
    }
    return pieces;
  }
  function label(text, pos, width, parent, color = '#394233', height = 11) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    let texture;
    if (canvas) {
      canvas.height = 96; canvas.width = Math.ceil(96 * width / height);
      const ctx = canvas.getContext('2d'); ctx.font = '76px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, 48, canvas.width * 0.98);
      texture = new THREE.CanvasTexture(canvas);
    } else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * MM, height * MM), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide}));
    mesh.position.set(...pos.map(v => v * MM)); mesh.userData.labelText = text; mesh.raycast = () => {}; parent.add(mesh); labels.push(mesh);
    return mesh;
  }
  function arrow(a, b, color, parent, thickness = 1.2) {
    const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const m = solidArrow(kit, color, parent, thickness * MM); m.position.set(...a.map(v => v * MM)); m.userData.setDirection(v); m.userData.setLength(v.length() * MM); return m;
  }

  const cavity = part('cavity', 'Reflecting cavity and chassis', 'Conducting walls reflect microwaves. The ceiling has a real waveguide opening, and the floor has an opening for the turntable shaft.', [0, 0, 0], system);
  const floor = horizontalPanel(cavity, 2, -154, 250, -154, 154, [-6, 6, -6, 6]);
  box([304, 220, 4], [0, 110, -152], 'metal', cavity);
  box([4, 220, 300], [-152, 110, 0], 'metal', cavity);
  box([4, 220, 300], [152, 110, 0], 'metal', cavity, true);
  const roof = horizontalPanel(cavity, 222, -154, 154, -154, 154, [10, 70, -85, 5], 4, true);
  for (const x of [-130, 225]) for (const z of [-125, 125]) cylinder(11, 32, [x, -16, z], 'ink', cavity);
  const cabinet = part('cabinet', 'Outer cabinet', 'The outer cabinet surrounds the cooking cavity and electrical compartment. Look inside removes selected panels without changing the physical experiment.', [0, 0, 0], system);
  box([414, 3, 314], [48, 305.5, -1], 'cream', cabinet);
  for (const x of [-157.5, 253.5]) box([3, 337, 314], [x, 137, -1], 'cream', cabinet);
  box([414, 337, 3], [48, 137, -156.5], 'cream', cabinet);
  box([414, 82, 6], [48, 263, 155], 'cream', cabinet);
  box([414, 32, 6], [48, -16, 155], 'cream', cabinet);
  covers.push(cabinet);

  const door = part('door', 'Door and shielding screen', 'The conducting screen has 1.55 mm openings on a 2 mm pitch. It transmits visible light while strongly attenuating microwaves. The surrounding frame, seals and interlocks also matter; the screen is not a promise of zero leakage.', [0, 0, 0], system);
  for (const x of [-139, 139]) box([22, 220, 10], [x, 110, 158], 'ink', door);
  for (const y of [12.5, 207.5]) box([256, 25, 10], [0, y, 158], 'ink', door);
  const glass = box([256, 170, 2], [0, 110, 158], 'blue', door);
  glass.material = glass.material.clone(); glass.material.transparent = true; glass.material.opacity = 0.18; glass.material.depthWrite = false;
  const screen = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({color: 0x45664b}), 129 + 86);
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
  let n = 0;
  for (let x = -128; x <= 128; x += 2) screen.setMatrixAt(n++, matrix.compose(new THREE.Vector3(x * MM, 110 * MM, 160 * MM), q, new THREE.Vector3(0.45 * MM, 170 * MM, 0.45 * MM)));
  for (let y = 25; y <= 195; y += 2) screen.setMatrixAt(n++, matrix.compose(new THREE.Vector3(0, y * MM, 160 * MM), q, new THREE.Vector3(256 * MM, 0.45 * MM, 0.45 * MM)));
  screen.count = n; screen.instanceMatrix.needsUpdate = true; door.add(screen);
  for (const y of [55, 165]) { cylinder(5, 28, [-153, y, 156], 'metal', door); rod([135, y, 164], [135, y, 183], 4, 'metal', door); }
  rod([135, 55, 183], [135, 165, 183], 6, 'cream', door);
  covers.push(door);
  const interlock = part('interlock', 'Door latch and interlock switches', 'Door hooks operate switches that interrupt microwave generation when the door opens. These switches are shown as a connected inspection detail, not a repair diagram.', [0, 0, 0], system);
  for (const y of [55, 165]) { box([12, 18, 16], [159, y, 139], 'ink', interlock); box([7, 6, 18], [150, y, 150], 'gold', door); rod([159, y, 130], [183, 90, 115], 1.5, 'clay', interlock); }

  const source = part('source', 'Electrical supply and microwave source', 'A power supply drives the magnetron; its antenna couples microwave energy into a hollow waveguide. The 800 W setting describes microwave output, not wall-plug electrical consumption.', [0, 0, 0], system);
  const supply = part('supply', 'Magnetron power supply', 'The teaching oven uses conventional on/off bursts. Lower power shortens each on period. Inverter ovens can regulate output differently.', [0, 0, 0], source);
  box([65, 10, 90], [200, 9, -40], 'ink', supply);
  box([60, 72, 85], [200, 50, -40], 'metal', supply);
  for (const x of [192, 208]) rod([x, 86, -20], [x, 125, -20], 2, 'clay', supply);
  const magnetron = part('magnetron', 'Magnetron and antenna', 'The magnetron converts supplied electrical energy into 2.45 GHz microwaves. Its antenna projects through the waveguide wall. Fins remove waste heat; efficiency and cooling are outside the thermal experiment.', [0, 0, 0], source);
  box([70, 90, 80], [200, 170, -40], 'metal', magnetron);
  for (let i = 0; i < 5; i++) box([74, 3, 84], [200, 135 + i * 16, -40], 'ink', magnetron);
  for (const y of [130, 210]) box([17, 4, 90], [158.5, y, -40], 'metal', magnetron);
  const antenna = cylinder(7, 33, [200, 230.5, -40], 'gold', magnetron); antenna.material = antenna.material.clone();
  const waveguide = part('waveguide', 'Hollow waveguide and cavity inlet', 'A 90 mm broad, 40 mm high guide carries microwave energy to a ceiling opening. Cutaway panels reveal the hollow passage. The chosen dimensions admit the dominant guide mode at 2.45 GHz; this is not a tuned appliance design.', [0, 0, 0], source);
  const guideFloor = horizontalPanel(waveguide, 235, 70, 240, -85, 5, [191, 209, -49, -31], 2);
  const guideRoof = horizontalPanel(waveguide, 277, 10, 240, -85, 5, [36, 44, -44, -36], 2, true);
  for (const z of [-86, 6]) {
    box([230, 40, 2], [125, 256, z], 'metal', waveguide, z > 0);
    box([60, 20, 2], [40, 226, z], 'metal', waveguide, z > 0);
  }
  box([2, 60, 90], [9, 246, -40], 'metal', waveguide);
  box([2, 40, 90], [241, 256, -40], 'metal', waveguide);
  box([2, 20, 90], [71, 226, -40], 'metal', waveguide);
  const inletCover = horizontalPanel(waveguide, 215.5, 10, 70, -85, 5, [36, 44, -44, -36], 1);
  for (const m of inletCover) { m.material = m.material.clone(); m.material.color.set(0xf0dfaf); m.material.transparent = true; m.material.opacity = 0.18; m.material.depthWrite = false; }

  const stirrer = part('stirrer', 'Mode stirrer and drive', 'Rotating metal blades change how waves reflect, changing the heating pattern. Here one eight-second turn moves a prescribed pattern through one cycle. The pattern is illustrative, not a computed field around these blades.', [0, 0, 0], system);
  cylinder(12, 20, [40, 288, -40], 'ink', stirrer);
  cylinder(3, 90, [40, 243, -40], 'metal', stirrer);
  const blades = new THREE.Group(); blades.position.set(40 * MM, 198 * MM, -40 * MM); stirrer.add(blades);
  cylinder(6, 10, [0, 0, 0], 'ink', blades);
  for (let i = 0; i < 4; i++) {
    const blade = box([43, 2, 15], [0, 0, 0], 'metal', blades); blade.geometry.translate(27 * MM, 0, 0); blade.rotation.set(0, i * TAU / 4, 0.18);
  }

  const drive = part('turntable-drive', 'Turntable drive and rollers', 'The motor below the floor turns a shaft through the chassis. A roller ring supports the plate while the central coupling turns it.', [0, 0, 0], system);
  cylinder(19, 20, [0, -16, 0], 'ink', drive);
  cylinder(4, 33, [0, -9.5, 0], 'metal', drive);
  const rollerRing = kit.ring(80 * MM, 1.5 * MM, [0, 5.5 * MM, 0], 'ink', drive); rollerRing.rotation.x = Math.PI / 2;
  const coupling = new THREE.Group(), rollers = []; drive.add(coupling); cylinder(7, 2, [0, 7, 0], 'cream', coupling);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3, roller = cylinder(2, 9, [80 * Math.cos(a), 6, 80 * Math.sin(a)], 'cream', drive); rollers.push(roller);
    roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    rod([0, 7, 0], [17 * Math.cos(a), 7, 17 * Math.sin(a)], 1, 'cream', coupling);
  }
  const turntable = part('turntable', 'Rotating glass plate', 'The plate turns at six revolutions per minute of oven time. Each food volume follows its actual circular path through the prescribed field; the model does not instantly average a whole revolution.', [0, 0, 0], drive);
  const plate = cylinder(125, 6, [0, 11, 0], 'blue', turntable);
  plate.material = plate.material.clone(); plate.material.transparent = true; plate.material.opacity = 0.3; plate.material.depthWrite = false;
  const marker = box([5, 1, 30], [0, 14.5, 104], 'ink', turntable);
  const bowl = part('bowl', 'Open glass bowl', 'The container rests on the plate and holds the sample. Microwaves pass through this idealized container; its own heat capacity and absorption are omitted.', [0, 0, 0], turntable);
  const bowlBase = cylinder(1, 3, [0, 15.5, 0], 'cream', bowl);
  const bowlWall = surface(kit, new THREE.BufferGeometry(), 'cream', bowl, true);
  bowlBase.material = bowlBase.material.clone();
  for (const m of [bowlBase, bowlWall]) { m.material.transparent = true; m.material.opacity = m === bowlBase ? 0.65 : 0.3; m.material.depthWrite = false; }
  const bowlRim = kit.ring(1, 1.5 * MM, [0, 69 * MM, 0], 'cream', bowl); bowlRim.rotation.x = Math.PI / 2;
  const food = part('food', 'Food temperature field', 'A nonflowing, water-like sample, 5 cm deep. Blue is 20°C and red is 100°C. Top and side colors come directly from the same finite volumes used for the heat ledger. The minimum and maximum include the interior.', [0, 0, 0], bowl);
  const foodGeometry = new THREE.BufferGeometry(), vertices = [], thermalIndices = [];
  const planeCount = 1 + (OVEN.rings - 1) * OVEN.sectors;
  function triangle(points, cell) { for (const p of points) { vertices.push(...p); thermalIndices.push(cell); } }
  const radial = (r, a, y) => [r * Math.cos(a), y * MM, r * Math.sin(a)];
  for (let j = 0; j < OVEN.sectors; j++) {
    const a = j * TAU / OVEN.sectors, b = (j + 1) * TAU / OVEN.sectors;
    triangle([[0, FOOD_TOP * MM, 0], radial(1 / OVEN.rings, b, FOOD_TOP), radial(1 / OVEN.rings, a, FOOD_TOP)], (OVEN.layers - 1) * planeCount);
    for (let ring = 1; ring < OVEN.rings; ring++) {
      const cell = (OVEN.layers - 1) * planeCount + 1 + (ring - 1) * OVEN.sectors + j;
      const p = radial(ring / OVEN.rings, a, FOOD_TOP), q = radial(ring / OVEN.rings, b, FOOD_TOP), u = radial((ring + 1) / OVEN.rings, a, FOOD_TOP), v = radial((ring + 1) / OVEN.rings, b, FOOD_TOP);
      triangle([p, q, u], cell); triangle([q, v, u], cell);
    }
    for (let layer = 0; layer < OVEN.layers; layer++) {
      const y0 = FOOD_BOTTOM + layer * OVEN.height * 1000 / OVEN.layers, y1 = FOOD_BOTTOM + (layer + 1) * OVEN.height * 1000 / OVEN.layers;
      const cell = layer * planeCount + 1 + (OVEN.rings - 2) * OVEN.sectors + j;
      const p = radial(1, a, y0), q = radial(1, b, y0), u = radial(1, a, y1), v = radial(1, b, y1);
      triangle([p, u, q], cell); triangle([q, u, v], cell);
    }
  }
  foodGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  foodGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(vertices.length), 3));
  foodGeometry.computeVertexNormals();
  const thermalMesh = new THREE.Mesh(foodGeometry, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide, toneMapped: false})); food.add(thermalMesh);

  const field = part('field', 'Prescribed field and energy guides', 'Orange arrows show the route of microwave energy. Rings mark maxima of a chosen heating pattern, 6.1 cm apart. They are teaching guides, not visible beams or an exact field solution for the oven.', [0, 0, 0], system);
  field.userData.explosionExcluded = true;
  const energyArrows = [
    arrow([200, 247, -40], [110, 256, -40], 0xc17c37, field),
    arrow([110, 256, -40], [25, 256, -63], 0xc17c37, field),
    arrow([25, 250, -63], [25, 219, -63], 0xc17c37, field),
    arrow([25, 185, -63], [0, 83, 0], 0xc17c37, field),
  ];
  const spots = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const spot = kit.ring(4 * MM, 0.7 * MM, [0, 0, 0], 'red', field); spot.rotation.x = Math.PI / 2;
    spot.material = spot.material.clone(); spot.material.transparent = true; spot.userData.cell = [i, j]; spots.push(spot);
  }
  field.traverse(o => { if (o.geometry) o.raycast = () => {}; });

  const panel = part('timer', 'Timer and burst-power control', 'Gold marks the selected heating time; red marks the power level. The light shows microwave output. At half power this conventional supply runs for 10 seconds, then rests for 10 seconds.', [0, 0, 0], system);
  box([96, 220, 10], [203, 110, 154], 'cream', panel);
  box([66, 158, 5], [203, 112, 161], 'ink', panel);
  const timeBar = box([11, 1, 3], [190, 37, 165], 'gold', panel), powerBar = box([11, 1, 3], [216, 37, 165], 'red', panel);
  const progress = kit.sphere(4 * MM, [190 * MM, 37 * MM, 169 * MM], 'cream', panel);
  const lamp = kit.sphere(6 * MM, [203 * MM, 207 * MM, 164 * MM], 'ink', panel); lamp.material = lamp.material.clone();
  label('TIME', [190, 22, 168], 24, panel, '#394233', 7); label('POWER', [216, 22, 168], 29, panel, '#394233', 7);
  rod([203, 110, 149], [220, 86, -10], 1.5, 'clay', supply);

  const chart = part('chart', 'Temperature and energy comparison', 'Blue tracks the coldest finite volume, red the hottest, and green the mass-weighted mean. Standing redistributes heat while the mean stays fixed in this insulated model. The dark vertical line marks when RF input stops.', [0, 0, 0], system);
  chart.userData.explosionExcluded = true;
  chart.position.y = 40 * MM;
  label('Modeled temperatures · °C', [45, 465, CHART.z], 280, chart, '#394233', 17);
  for (const T of [20, 60, 100]) {
    rod(chartPoint(0, T).map(v => v / MM), chartPoint(300, T).map(v => v / MM), 0.35, 'metal', chart);
    label(String(T), [CHART.left - 18, CHART.bottom + (T - 20) / 80 * CHART.height, CHART.z], 28, chart, '#394233', 14);
  }
  for (const t of [0, 60, 120, 180, 240, 300]) label(String(t), [CHART.left + t / 300 * CHART.width, CHART.bottom - 13, CHART.z], 34, chart, '#394233', 14);
  label('Oven time · s', [45, CHART.bottom - 30, CHART.z], 130, chart, '#394233', 12);
  const minLine = lineObject(302, 0x4f86c6, chart), maxLine = lineObject(302, 0xd23b1f, chart), meanLine = lineObject(302, 0x45664b, chart);
  const heatEnd = lineObject(2, 0x79806f, chart), cursor = lineObject(2, 0x171e16, chart);
  for (const [text, x, color] of [['Coldest', -90, '#4f86c6'], ['Mean', 45, '#45664b'], ['Hottest', 180, '#d23b1f']]) label(text, [x, 445, CHART.z], 85, chart, color, 14);

  const molecules = part('molecules', 'Polar molecules and dielectric heating', 'The electric field exerts torque on polar molecules. Their response lags the changing field, transferring energy into disordered molecular motion. This enlarged, enormously slowed sketch shows alignment, not a literal trajectory at 2.45 GHz.', [0, 0, 0], system);
  molecules.userData.explosionExcluded = true;
  label('Inside the food', [-267, 221, 40], 150, molecules, '#394233', 12);
  label('Polar molecule · enlarged', [-267, 205, 40], 173, molecules, '#394233', 10);
  const molecule = new THREE.Group(); molecule.position.set(-267 * MM, 154 * MM, 40 * MM); molecules.add(molecule);
  kit.sphere(8 * MM, [0, 0, 0], 'red', molecule);
  for (const sign of [-1, 1]) {
    const a = sign * 52.25 * Math.PI / 180, p = [15 * Math.cos(a), 15 * Math.sin(a), 0];
    rod([0, 0, 0], p, 2, 'cream', molecule); kit.sphere(5 * MM, p.map(v => v * MM), 'cream', molecule);
    label('+', [p[0], p[1], 5.3], 6, molecule, '#394233', 6);
  }
  label('−', [0, 0, 8.3], 9, molecule, '#fffbea', 8);
  const electricField = arrow([-317, 181, 40], [-217, 181, 40], 0xb9903e, molecules, 1.5);
  label('Reversing electric field', [-267, 115, 40], 166, molecules, '#394233', 10);
  label('Motion shown slowly', [-267, 99, 40], 155, molecules, '#394233', 9);
  for (let i = 0; i < 5; i++) {
    const swatch = box([21, 8, 2], [-311 + i * 22, 64, 40], 'cream', molecules);
    swatch.material = new THREE.MeshBasicMaterial({color: foodColor(20 + 20 * i), toneMapped: false});
    label(String(20 + 20 * i), [-311 + i * 22, 52, 40], 19, molecules, '#394233', 8);
  }
  label('Temperature colors · °C', [-267, 36, 40], 160, molecules, '#394233', 9);
  for (const guide of [chart, molecules]) guide.traverse(o => { if (o.geometry) o.raycast = () => {}; });

  const specs = {
    level: ['Microwave power level', '%', null, '800 W while on. This conventional supply switches in 20 s cycles. Zero is an RF-off comparison. Changing a heating setting starts a new trial.'],
    seconds: ['Heating time', 's', null, 'Requested heating duration. The experiment then stands until 300 s. RF input ends early if a cell reaches the 100°C model limit.'],
    mass: ['Food mass', 'kg', null, 'A nonflowing water-like sample, 5 cm deep. More mass makes it wider. The chosen absorbed fraction depends on mass.'],
    stirring: ['Move food or field', '', STIRRING, 'A turntable moves the food; a mode stirrer changes the wave pattern. Each moves through actual simulated time.'],
    field: ['Compare field position', '', FIELDS, 'Choose where the illustrative hot spots fall. The center need not be a cold spot. Each change resets the trial.'],
  };
  for (const [key, [min, max, step]] of Object.entries(OVEN_DOMAINS)) {
    const [name, unit, options, help] = specs[key];
    control(key, name, min, max, step, D[key], unit, help, options, {primary: key === 'stirring'});
  }

  let clock = 0, lastClock = 0, disposed = false, physicalKey = '', chartKey = '', oldRadius = -1;
  const result = finish(values => {
    const key = JSON.stringify(values);
    if (key !== physicalKey) { clock = lastClock = 0; physicalKey = key; }
    const s = sampleOven(values, clock), radius = s.grid.radius * 1000;
    if (radius !== oldRadius) {
      oldRadius = radius;
      bowlBase.scale.set((radius + 3), 1, (radius + 3));
      bowlWall.geometry.dispose();
      bowlWall.geometry = new THREE.LatheGeometry([[radius + 3, 14], [radius + 3, 69], [radius, 69], [radius, 17], [radius + 3, 14]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), 64);
      bowlRim.geometry.dispose(); bowlRim.geometry = new THREE.TorusGeometry((radius + 1.5) * MM, 1.5 * MM, 8, 64);
      thermalMesh.scale.set(radius * MM, 1, radius * MM);
    }
    const color = foodGeometry.attributes.color;
    for (let i = 0; i < thermalIndices.length; i++) { const c = foodColor(s.temperatures[thermalIndices[i]]); color.setXYZ(i, c.r, c.g, c.b); }
    color.needsUpdate = true;
    turntable.rotation.y = turns(values.stirring) ? TAU * s.motionClock / 10 : 0;
    coupling.rotation.y = turntable.rotation.y;
    blades.rotation.y = stirs(values.stirring) ? TAU * s.motionClock / 8 : 0;
    const [dx, dz] = stirs(values.stirring) ? stirShift(s.motionClock) : [0, 0];
    const shift = fieldPhase(values.field) / TAU, spacing = spotSpacing() * 1000;
    for (const spot of spots) {
      const [i, j] = spot.userData.cell, x = (i + 0.5 - shift) * spacing + dx * 1000, z = (j + 0.5 - shift) * spacing + dz * 1000;
      spot.visible = Math.abs(x) < 143 && Math.abs(z) < 143;
      spot.position.set(x * MM, (FOOD_TOP + 4) * MM, z * MM);
      spot.material.color.set(s.on ? 0xc14f39 : 0x7d8970); spot.material.opacity = s.on ? 0.7 : 0.22;
    }
    for (const a of energyArrows) a.visible = s.on;
    antenna.material.color.set(s.on ? 0xffb347 : 0x8a7d55); lamp.material.color.set(s.on ? 0xffd166 : 0x374736);
    const period = TAU * s.motionClock / 20, direction = s.on && Math.sin(period) < 0 ? -1 : 1;
    electricField.visible = s.on;
    electricField.position.x = (direction > 0 ? -317 : -217) * MM;
    electricField.userData.setDirection(new THREE.Vector3(direction, 0, 0));
    molecule.rotation.z = s.on ? Math.PI / 2 * (1 - Math.tanh(3 * Math.sin(period - 0.5))) : 0;
    for (const [bar, fraction] of [[timeBar, values.seconds / 300], [powerBar, values.level / 100]]) {
      bar.visible = fraction > 0; bar.scale.y = Math.max(1e-6, fraction * 150); bar.position.y = (37 + fraction * 75) * MM;
    }
    progress.position.y = (37 + clock / 300 * 150) * MM;
    if (key !== chartKey) {
      chartKey = key;
      for (const [line, name] of [[minLine, 'minT'], [meanLine, 'meanT'], [maxLine, 'maxT']]) fillLine(line, s.samples.map(sample => chartPoint(sample.t, sample[name])));
      fillLine(heatEnd, [chartPoint(s.heatEnd, 20), chartPoint(s.heatEnd, 100)]);
    }
    fillLine(cursor, [chartPoint(clock, 20), chartPoint(clock, 100)].map(p => [p[0], p[1], p[2] + 0.5 * MM]));
    const outcome = s.limited ? '100°C model limit reached; RF off, sample standing' : {
      ready: 'Ready · Play starts a fresh heating trial',
      heating: 'Heating · microwave output on',
      resting: values.level === 0 ? 'RF off comparison · no heat input' : 'Heating timer running · output rests between bursts',
      standing: 'Standing · heat spreads without further input',
      done: 'Trial complete · compare the temperature range',
    }[s.mode];
    return {state: s, readings: [
      r('Your result', outcome, s.limited ? 'The experiment stops RF at its modeling limit. This is not a real oven auto-cutoff.' : 'Settings reset the trial. Inspect either the end of heating or the final standing period.'),
      r('Oven clock', fixed(clock, 1) + ' s', 'Ten oven seconds pass per playback second; the trial ends at 300 s.'),
      r('Coldest · mean · hottest', [s.minT, s.meanT, s.maxT].map(T => fixed(T, 1) + '°C').join(' · '), 'All food volumes, including the interior. Blue/green/red chart lines use these same temperatures.'),
      r('Microwave output', (s.on ? '800' : '0') + ' W', 'At ' + values.level + '%, output runs ' + fixed(s.onFor, 0) + ' s per 20 s cycle. Inverter ovens can use a different method.'),
      r('Power deposited in food', fixed(s.on ? OVEN.magnetron * s.share : 0, 0) + ' W', 'Chosen coupling: ' + fixed(s.share * 100, 1) + '% for this mass. Undeposited output is outside the sample energy ledger.'),
      r('Energy gained by food', fixed(s.absorbed / 1000, 2) + ' kJ', 'Equals the sum of each volume’s mass × heat capacity × temperature rise. No evaporation or heat loss is modeled.'),
      r('RF input ends', fixed(s.heatEnd, 1) + ' s', s.limitTime === null ? 'At the selected timer setting.' : 'Earlier than requested because a modeled volume reaches 100°C. Standing continues.'),
      r('Wavelength · pattern spacing', fixed(s.wavelength * 100, 1) + ' cm · ' + fixed(s.spacing * 100, 1) + ' cm', 'The chosen pattern uses half-wavelength spacing. A real loaded cavity has a more complex three-dimensional field.'),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(OVEN.duration, clock + dt * OVEN.speedUp); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; physicalKey = ''; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect end of heating', part: 'food', view: 'top', isolate: true, replay: false, run() { clock = result.getState().heatEnd; return render(); }},
    {label: 'Inspect after standing', part: 'food', view: 'top', isolate: true, replay: false, run() { clock = OVEN.duration; return render(); }},
    {label: 'Inspect first 5 seconds', part: 'system', view: 'front', replay: false, run() { clock = 5; return render(); }},
  ];
  result.playback = {label: 'Start the heating trial', description: 'Heating followed by standing to 300 oven seconds. RF stops at the timer or the 100°C model limit. Temperatures are illustrative, not cooking instructions.', stepLabel: 'Advance ten oven seconds', advance: result.advance, step: () => result.advance(1), complete: () => result.getState().complete, blocked: () => false};
  result.resultPart = {id: 'food', context: 'bowl', label: 'Inspect food temperatures', view: 'top', available: () => clock > 0, focusOnComplete: false};
  root.rotation.set(0.2, -0.4, 0);
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.5; result.selectionOutline = false; result.transparentBackground = true;
  result.thumbnailOmit = [field, chart, molecules];
  result.frameBoundsForPart = id => {
    if (id !== 'system') return null;
    root.updateWorldMatrix(true, false);
    return new THREE.Box3(new THREE.Vector3(-365 * MM, -35 * MM, -158 * MM), new THREE.Vector3(255 * MM, 514 * MM, 185 * MM)).applyMatrix4(root.matrixWorld);
  };
  result.topology = {MM, PLATE_TOP, FOOD_BOTTOM, FOOD_TOP, CHART, system, cavity, floor, roof, cabinet, door, glass, screen, interlock, source, supply, magnetron, antenna, waveguide, guideFloor, guideRoof, inletCover, stirrer, blades, drive, coupling, rollers, rollerRing, turntable, plate, marker, bowl, bowlBase, bowlWall, bowlRim, food, thermalMesh, thermalIndices, field, spots, energyArrows, panel, timeBar, powerBar, progress, lamp, chart, minLine, maxLine, meanLine, heatEnd, cursor, molecules, molecule, electricField, labels, textures};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; for (const texture of textures) texture.dispose(); dispose(); } };
  return result;
}

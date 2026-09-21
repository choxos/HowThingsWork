import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, fillLine, solidArrow, surface} from './scene-kit.js';
import {sampleToaster, toasterPlan, resistance, stripDeflection, TOASTER, TIMERS, STARTS, BREADS, TOASTER_DEFAULTS as D, TOASTER_DOMAINS} from './toaster-physics.js';

const MM = 0.004, SPEED = 5, DOWN = 65, UP = 145, CARD_Z = 18;
const STRIP = {x: 85, y: 75, z: 45, length: 50, thickness: 0.5, width: 6};
const CHART = {left: -140, width: 280, bottom: 50, height: 150, minimum: -20, maximum: 300};
const SAMPLES = Math.ceil((TOASTER.cutout + TOASTER.release + TOASTER.after) / (TOASTER.step * TOASTER.every)) + 6;
const stops = (list, x) => {
  if (x <= list[0][0]) return new THREE.Color(list[0][1]);
  for (let i = 1; i < list.length; i++) if (x <= list[i][0]) return new THREE.Color(list[i - 1][1]).lerp(new THREE.Color(list[i][1]), (x - list[i - 1][0]) / (list[i][0] - list[i - 1][0]));
  return new THREE.Color(list.at(-1)[1]);
};
export const glowColor = T => stops([[350, 0x5b5b55], [525, 0x7a1e12], [700, 0xd2381c], [900, 0xff8a2a]], T);
export const toastColor = B => stops([[Math.log2(0.02), 0xf0dfaf], [Math.log2(0.4), 0xe8c27a], [Math.log2(2), 0xc98a3d], [Math.log2(8), 0x6e4424], [Math.log2(30), 0x2a1c14]], Math.log2(Math.max(B, 1e-6)));
export const chartPoint = (t, T) => [(CHART.left + t / TOASTER.cutout * CHART.width) * MM, (CHART.bottom + (T - CHART.minimum) / (CHART.maximum - CHART.minimum) * CHART.height) * MM, 0];
export const stripPoint = (bend, along, offset = 0) => [(STRIP.x + bend * 1000 * (along / STRIP.length) ** 2 + offset) * MM, (STRIP.y + along) * MM, STRIP.z * MM];

export function createToasterModel() {
  const kit = houseModel('Toaster'), {root, part, control, finish, covers} = kit;
  const box = (size, pos, color, parent) => kit.box(size.map(v => v * MM), pos.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const labels = [], textures = [];
  function label(text, pos, width, parent, color = '#394233', height = 15) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    let ctx, texture;
    if (canvas) { canvas.height = 96; canvas.width = Math.ceil(96 * width / height); ctx = canvas.getContext('2d'); texture = new THREE.CanvasTexture(canvas); }
    else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * MM, height * MM), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide}));
    mesh.position.set(...pos.map(v => v * MM)); parent.add(mesh); labels.push(mesh);
    mesh.userData.setText = value => {
      if (mesh.userData.labelText === value) return;
      mesh.userData.labelText = value;
      if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = '76px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, canvas.width / 2, 48, canvas.width * 0.98); }
      texture.needsUpdate = true;
    };
    mesh.userData.setText(text); return mesh;
  }
  const system = part('system', 'Toaster', 'A single-slot teaching cutaway. Current heats two ribbons; a sensor contact or a timer energizes the release coil. The catch lets go, the main switch opens and the spring lifts the rack. Dimensions and motion timings are chosen for this model.');
  const body = part('case', 'Case and guides', 'The case supports the mica cards, spring seat and sliding carriage. Look inside removes the front and right covers.', [0, 0, 0], system);
  box([320, 4, 150], [0, 2, 0], 'metal', body);
  box([320, 196, 4], [0, 102, -75], 'metal', body);
  box([4, 196, 150], [-160, 102, 0], 'metal', body);
  covers.push(box([4, 196, 150], [160, 102, 0], 'metal', body), box([320, 196, 4], [0, 102, 75], 'metal', body));
  box([320, 4, 55], [0, 200, -47.5], 'metal', body);
  box([320, 4, 55], [0, 200, 47.5], 'metal', body);
  for (const x of [-92, 76]) rod([x, 4, 0], [x, 185, 0], 1.5, 'metal', body);
  box([16, 4, 16], [-92, 6, 0], 'ink', body);
  box([8, 24, 16], [120, 16, -12], 'ink', body);

  const elements = part('elements', 'Heating elements', 'Two nichrome ribbons supported on mica, one facing each side of the bread. The electrical model uses a 15 Ω cold series load and the published Nikrothal 80 resistance factors.', [0, 0, 0], system);
  const wires = [-1, 1].map(side => {
    const card = box([132, 136, 1], [0, 124, side * (CARD_Z + 1.5)], 'cream', elements);
    card.material = card.material.clone(); card.material.transparent = true; card.material.opacity = 0.28; card.material.depthWrite = false;
    const points = [];
    for (let i = 0; i <= 20; i++) points.push([(-58 + i * 5.8) * MM, (i % 2 ? 186 : 62) * MM, side * CARD_Z * MM]);
    const wire = kit.tube(points, 0.65 * MM, 'metal', elements); wire.material = wire.material.clone();
    rod([-66, 4, side * (CARD_Z + 1.5)], [-66, 192, side * (CARD_Z + 1.5)], 1, 'metal', elements);
    return wire;
  });
  const carriage = part('carriage', 'Carriage and lever', 'The bread rests on the rack. Its left arm compresses the spring. Its right tab is caught beneath the latch ledge. The handle lowers this whole assembly.', [0, UP * MM, 0], system);
  const rack = box([130, 3, 30], [0, -1.5, 0], 'metal', carriage);
  const springArm = box([40, 3, 14], [-80, -1.5, 0], 'metal', carriage);
  box([120, 3, 12], [120, -1.5, 0], 'metal', carriage);
  box([22, 12, 26], [180, -1.5, 0], 'ink', carriage);
  box([4, 27, 8], [100, -14.5, 0], 'metal', carriage);
  const tab = box([12, 4, 8], [100, -27, 0], 'metal', carriage);
  const bread = part('bread', 'Slice of bread', 'A chosen 50 g slice, 15 mm thick. Each face develops a dry crust. The graph separates the hot face from the cooler middle; colors follow an illustrative index.', [0, 0, 0], carriage);
  const faces = [-1, 1].map(side => box([120, 110, 2], [0, 55, side * 6.5], 'cream', bread));
  faces[0].material = faces[0].material.clone(); faces[1].material = faces[0].material;
  box([119, 109, 11], [0, 55, 0], 'cream', bread);

  const springPart = part('spring', 'Carriage spring', 'A compression spring between the base seat and the carriage arm. It remains compressed even with the rack raised; release lets it extend. The animation prescribes motion rather than solving spring forces.', [0, 0, 0], system);
  const spring = kit.spring([-92 * MM, 8.8 * MM, 0], 5 * MM, (UP - 12.6) * MM, 10, springPart, 0.8 * MM);

  const springEnds = [8.8, UP - 3.8].map(y => { const end = kit.ring(5 * MM, 0.8 * MM, [-92 * MM, y * MM, 0], 'metal', springPart); end.rotation.x = Math.PI / 2; return end; });

  const release = part('release', 'Sensor and release mechanism', 'Follow the connected chain: sensor contact, energized solenoid, moving catch, released carriage and open main switch.', [0, 0, 0], system);
  const latchPart = part('latch', 'Catch and retaining ledge', 'The ledge touches the top of the carriage tab and blocks its upward motion. The coil attracts an iron shoe on this pivoted catch, moving the ledge clear.', [120 * MM, 16 * MM, 0], release);
  kit.disk(2.2 * MM, 24 * MM, [0, 0, -8 * MM], 'ink', latchPart);
  const hook = new THREE.Group(); latchPart.add(hook);
  box([4, 27, 8], [0, 13.5, 0], 'gold', hook);
  const ledge = box([20, 3, 8], [-8, 25.5, 0], 'gold', hook);
  rod([0, 12, 0], [5, 19, 0], 1.5, 'metal', hook);
  const shoe = box([2, 8, 10], [5, 19, 0], 'metal', hook);
  const returnSpring = kit.spring([0, 0, 0], 3.5 * MM, 5 * MM, 3, latchPart, 0.45 * MM);
  returnSpring.position.z = -4 * MM; returnSpring.rotation.x = -Math.PI / 2;

  const solenoidPart = part('solenoid', 'Release solenoid', 'A short current pulse magnetizes the iron core and attracts the catch’s iron shoe. The chosen pulse lasts 0.15 s. This is a sequence model, not a coil-force or AC waveform simulation.', [0, 0, 0], release);
  const core = rod([131, 35, 0], [150, 35, 0], 6, 'metal', solenoidPart);
  box([22, 6, 18], [140, 7, 0], 'ink', solenoidPart);
  box([6, 23, 12], [148, 21.5, 0], 'metal', solenoidPart);
  const coil = kit.spring([0, 0, 0], 8 * MM, 15 * MM, 12, solenoidPart, 0.8 * MM);
  coil.rotation.z = -Math.PI / 2; coil.position.set(133 * MM, 35 * MM, 0); coil.material = coil.material.clone();

  const stripPart = part('strip', 'Bimetal heat sensor', 'Two bonded layers expand differently, bending the warm strip toward the trip plate. The 50 mm strip uses a chosen specific deflection of 13.5 millionths per kelvin and a small-deflection beam shape. No separate strip heater is assumed.', [0, 0, 0], release);
  box([3, 71, 6], [85, 39.5, -20], 'cream', stripPart);
  rod([85, 75, -20], [85, 75, 45], 1.5, 'cream', stripPart);
  box([6, 4, 10], [85, 75, 45], 'ink', stripPart);
  const layers = [-1, 1].map(side => {
    const geometry = new THREE.BoxGeometry(0.25 * MM, STRIP.length * MM, STRIP.width * MM, 1, 40, 1);
    const mesh = surface(kit, geometry, side < 0 ? 'gold' : 'metal', stripPart);
    mesh.userData.original = geometry.attributes.position.array.slice(); mesh.userData.offset = side * 0.125;
    return mesh;
  });
  const tip = kit.sphere(1 * MM, [0, 0, 0], 'gold', stripPart);
  const adjustment = part('knob', 'Browning knob and trip plate', 'Turning the screw moves the trip plate. A farther plate needs a hotter, more bent sensor. The alternative electronic timer maps the same settings to fixed durations.', [0, 0, 0], release);
  box([3, 133, 6], [132, 70.5, -20], 'cream', adjustment);
  rod([132, 135, -20], [132, 135, 45], 1.5, 'cream', adjustment);
  const screw = rod([94, 135, 45], [147, 135, 45], 1, 'metal', adjustment);
  const knob = kit.cylinder(9 * MM, 6 * MM, [146 * MM, 135 * MM, 45 * MM], 'ink', adjustment); knob.rotation.z = Math.PI / 2;
  const pointer = new THREE.Group(); pointer.position.set(150 * MM, 135 * MM, 45 * MM); adjustment.add(pointer);
  box([1, 7, 1.5], [0, 4, 0], 'cream', pointer);
  const stop = box([1, 8, 10], [0, 125, 45], 'gold', adjustment);
  const follower = box([8, 18, 10], [0, 130, 45], 'cream', adjustment);

  const board = part('electronic', 'Electronic timer', 'This alternative counts a fixed number of seconds, then energizes the same release coil. The board indicator lights during the pulse. The chip replaces the sensor contacts; this is not an actual commercial circuit.', [0, 0, 0], release);
  box([45, 3, 30], [106, 75, 45], 'leaf', board);
  box([12, 4, 12], [103, 78.5, 45], 'ink', board);
  rod([94, 84, 45], [98, 78.5, 45], 0.75, 'gold', board);
  rod([108, 78.5, 45], [112, 84, 45], 0.75, 'gold', board);
  const timerContact = kit.sphere(2 * MM, [103 * MM, 82.5 * MM, 45 * MM], 'leaf', board); timerContact.material = timerContact.material.clone();

  const switchPart = part('switch', 'Main switch', 'An ideal snap switch set by the carriage and released with the catch. Closed contacts power the heating ribbons and release branch. Opening cuts both currents; the elements stay hot afterward.', [0, 0, 0], release);
  box([24, 5, 18], [116, 6.5, 28], 'cream', switchPart);
  const fixedContact = box([4, 2, 6], [124, 13, 28], 'gold', switchPart);
  const switchBlade = new THREE.Group(); switchBlade.position.set(108 * MM, 15 * MM, 28 * MM); switchPart.add(switchBlade);
  box([18, 2, 6], [8, 0, 0], 'gold', switchBlade);
  rod([108, 9, 28], [108, 15, 28], 1.5, 'gold', switchPart);
  rod([120, 16, 0], [120, 16, 20], 1.5, 'ink', switchPart);
  box([8, 8, 8], [120, 16, 24], 'ink', switchPart);

  const wiring = part('wiring', 'Electrical connections', 'Schematic insulated leads join the main switch, series heating ribbons and parallel release branch. Routing and wire thickness are chosen for clarity; this cutaway is not a wiring or repair guide.', [0, 0, 0], system);
  const paths = [
    [[155, 4, 65], [108, 4, 65], [108, 9, 28]],
    [[124, 12, 28], [124, 10, -30], [-58, 10, -30], [-58, 62, -18]],
    [[58, 62, -18], [68, 62, -18], [68, 50, 18], [58, 62, 18]],
    [[-58, 62, 18], [-70, 50, 28], [-70, 10, 60], [155, 10, 60]],
    [[148, 27, 0], [152, 20, 60], [155, 10, 60]],
  ];
  const conductors = paths.map(points => kit.tube(points.map(p => p.map(v => v * MM)), 0.75 * MM, 'wood', wiring));
  const supplyLead = lineObject(4, 0xae8056, wiring), contactLead = lineObject(4, 0xae8056, wiring), timerLead = lineObject(4, 0xae8056, wiring);
  const heat = part('heat', 'Heat reaching the bread', 'Equal-length arrows show direction from the two heating elements. Their lengths do not encode watts. Readings give the net heat reaching the bread.', [0, 0, 0], system);
  const arrows = [-1, 1].map(side => { const arrow = solidArrow(kit, 0xd9822b, heat, 0.65 * MM); arrow.position.set(0, 118 * MM, side * 16.5 * MM); arrow.userData.setDirection(new THREE.Vector3(0, 0, -side)); return arrow; });
  const chart = part('chart', 'Temperature chart', 'Full-trial curves use degrees Celsius: face red, middle blue, heat sensor gold. Horizontal axis counts heating seconds. Bread curves stop at removal; cooling of removed toast is not simulated. Open its inspection view to read the curves.', [0, 0, 0], root);
  chart.userData.inspectionOnly = 'chart';
  rod(chartPoint(0, -20).map(v => v / MM), chartPoint(300, -20).map(v => v / MM), 0.5, 'ink', chart);
  rod(chartPoint(0, -20).map(v => v / MM), chartPoint(0, 300).map(v => v / MM), 0.5, 'ink', chart);
  label('Temperature (°C)', [0, 218, 0], 130, chart);
  for (const T of [-20, 100, 200, 300]) label(String(T), [-156, chartPoint(0, T)[1] / MM, 0], 23, chart, '#394233', 13);
  for (const t of [0, 60, 120, 180, 240, 300]) label(String(t), [chartPoint(t, 0)[0] / MM, 37, 0], 25, chart, '#394233', 13);
  label('Heating time (seconds)', [0, 23, 0], 152, chart);
  label('Face', [-97, 240, 0], 35, chart, '#bd442c'); label('Middle', [-25, 240, 0], 46, chart, '#467aaa');
  const sensorLabel = label('Sensor', [58, 240, 0], 48, chart, '#997317');
  const currentLabel = label('Ready', [0, 0, 0], 220, chart);
  const faceLine = lineObject(SAMPLES, 0xbd442c, chart), middleLine = lineObject(SAMPLES, 0x467aaa, chart), stripLine = lineObject(SAMPLES, 0x997317, chart), tripLine = lineObject(2, 0x997317, chart), cursor = lineObject(2, 0x374736, chart);
  for (const guide of [heat, chart]) { guide.userData.explosionExcluded = true; guide.traverse(object => { object.raycast = () => {}; }); }
  const specs = {
    setting: ['Browning setting', '', null, 'Moves the trip plate, or selects 110–182 heating seconds for the electronic timer.'],
    timer: ['Release control', '', TIMERS, 'Compare the book’s heat-sensor contact with a fixed-time alternative.'],
    start: ['Starting toaster', '', STARTS, 'Warm start follows a fresh slice at this setting, then 30 seconds with the rack raised.'],
    bread: ['Bread', '', BREADS, 'Same mass and water content; frozen bread starts at −18°C instead of 20°C.'],
  };
  for (const [name, [min, max, step]] of Object.entries(TOASTER_DOMAINS)) { const [label, unit, options, help] = specs[name]; control(name, label, min, max, step, D[name], unit, help, options, {primary: name === 'timer'}); }
  let clock = 0, lastClock = 0, physicalKey = '', chartKey = '', disposed = false;
  const result = finish(values => {
    const key = JSON.stringify(values);
    if (key !== physicalKey) { clock = lastClock = 0; physicalKey = key; }
    const s = sampleToaster(values, clock), freeBend = stripDeflection(s.Tb - TOASTER.room), tripBend = stripDeflection(s.trip), bend = Math.min(freeBend, tripBend), y = DOWN + (UP - DOWN) * s.carriage;
    carriage.position.y = y * MM; spring.userData.setLength((y - 12.6) * MM); springEnds[1].position.y = (y - 3.8) * MM; hook.rotation.z = -0.22 * s.catch;
    switchBlade.rotation.z = s.on ? 0 : 0.22;
    for (const wire of wires) wire.material.color.copy(glowColor(s.Te));
    faces[0].material.color.copy(toastColor(s.browning)); coil.material.color.set(s.coilOn ? 0xe39331 : 0x9d6544);
    stripPart.visible = values.timer === 0; stop.visible = follower.visible = values.timer === 0; board.visible = values.timer === 1;
    timerContact.material.color.set(s.coilOn ? 0xe39331 : 0x91aa7e);
    for (const layer of layers) {
      const pos = layer.geometry.attributes.position, original = layer.userData.original;
      for (let i = 0; i < pos.count; i++) { const along = original[i * 3 + 1] / MM + STRIP.length / 2, point = stripPoint(bend, along, original[i * 3] / MM + layer.userData.offset); pos.setXYZ(i, point[0], point[1], point[2] + original[i * 3 + 2]); }
      pos.needsUpdate = true; layer.geometry.computeVertexNormals(); layer.geometry.computeBoundingBox(); layer.geometry.computeBoundingSphere();
    }
    tip.position.set(...stripPoint(bend, STRIP.length));
    stop.position.x = (STRIP.x + tripBend * 1000 + 1.5) * MM; follower.position.x = stop.position.x + 4.5 * MM;
    pointer.rotation.x = (tripBend * 1000 - stripDeflection(toasterPlan({...values, setting: 1}).trip) * 1000) * Math.PI * 2;
    fillLine(supplyLead, [[124, 12, 28], [80, 12, 60], [80, values.timer === 0 ? 75 : 84, 60], values.timer === 0 ? [85, 75, 45] : [94, 84, 45]].map(p => p.map(v => v * MM)));
    fillLine(contactLead, [[stop.position.x / MM, 125, 45], [120, 137, 55], [153, 48, 12], [133, 27, 0]].map(p => p.map(v => v * MM))); contactLead.visible = values.timer === 0;
    fillLine(timerLead, [[112, 84, 45], [120, 94, 55], [153, 48, 12], [133, 27, 0]].map(p => p.map(v => v * MM))); timerLead.visible = values.timer === 1;
    for (const arrow of arrows) arrow.userData.setLength(s.on && s.toBread + s.airToBread > 1e-9 ? 8 * MM : 0);
    if (key !== chartKey) {
      chartKey = key;
      const breadSamples = s.samples.filter(sample => sample.t < s.powerOff).concat(s.atPop);
      fillLine(faceLine, breadSamples.map(sample => chartPoint(sample.t, sample.surfaceT)));
      fillLine(middleLine, breadSamples.map(sample => chartPoint(sample.t, sample.middleT)));
      fillLine(stripLine, s.samples.map(sample => chartPoint(sample.t, sample.Tb)));
      fillLine(tripLine, values.timer === 0 ? [chartPoint(0, s.trip + TOASTER.room), chartPoint(TOASTER.cutout, s.trip + TOASTER.room)] : [chartPoint(s.duration, -20), chartPoint(s.duration, 300)]);
    }
    stripLine.visible = sensorLabel.visible = values.timer === 0;
    fillLine(cursor, [chartPoint(s.heatClock, -20), chartPoint(s.heatClock, 300)]);
    currentLabel.userData.setText(`${fixed(s.heatClock, 1)} s · ${s.phase}`);
    const amps = s.on ? TOASTER.volts / resistance(s.Te) : 0;
    return {state: {...s, bend, freeBend, tripBend}, readings: [
      r('Your result', s.ready ? 'Ready · press Play to lower the bread' : `${s.phase} · ${fixed(s.heatClock, 2)} heating seconds`, s.on ? `Face ${fixed(s.surfaceT, 1)}°C; middle ${fixed(s.middleT, 1)}°C.` : s.clock >= TOASTER.lower ? `${s.shade} in this illustrative color model.` : 'Rack raised; contacts open; both currents are zero.'),
      r('Elements', `${fixed(s.power, 0)} W · ${fixed(s.Te, 0)}°C`, s.on ? 'Electrical energy becomes heat in the ribbons.' : 'Power is off. Stored heat does not vanish when the switch opens.'),
      r('Element current', `${fixed(amps, 2)} A through ${fixed(resistance(s.Te), 2)} Ω`, '120 V supply; temperature correction follows Nikrothal 80 data.'),
      r('Release sequence', s.coilOn ? 'Coil on · catch retracting' : s.on ? 'Coil off · catch holding' : 'Main contacts open', values.timer === 0 ? `Sensor contact ${s.sensorContact ? 'closed' : 'open'}. Coil also requires the main switch to be closed.` : 'Fixed timer sends a short release pulse.'),
      r('Bread face', `${fixed(s.surfaceT, 1)}°C`, s.clock >= TOASTER.lower + s.powerOff ? 'Temperature at removal, held for comparison. Cooling outside the toaster is omitted.' : `${fixed(s.water * 1000, 2)} g water or ice left in outer layers; crust ${fixed(s.crust * 1000, 2)} mm.`),
      r('Middle of the slice', `${fixed(s.middleT, 1)}°C`),
      r('Browning', `${s.shade} · index ${fixed(s.browning, 2)}`, 'Chosen temperature-sensitive color rule, not a calibrated food-chemistry prediction.'),
      values.timer === 0 ? r('Sensor and trip plate', `${fixed(s.Tb, 1)}°C · ${fixed(bend * 1000, 2)} / ${fixed(tripBend * 1000, 2)} mm`, 'Bend stops at the contact plate. Contact force and temperature gradients along the strip are omitted.') : r('Electronic timer', `${fixed(Math.min(s.heatClock, s.duration), 1)} / ${s.duration} s`),
      r('Toaster interior', `${fixed(s.Ti, 1)}°C`, 'One thermal lump represents the air and surrounding structure.'),
      r('Energy supplied', `${fixed(s.energy / 1000, 2)} kJ`, `Elements ${fixed(s.elementEnergy / 1000, 2)} kJ; release pulse ${fixed(s.controlEnergy, 2)} J. Coil energy is separate from the heating network.`),
      r('Heat delivered to bread', `${fixed(s.bread / 1000, 2)} kJ`, `Heating-network balance: stored ${fixed(s.storedEnergy / 1000, 2)} + melting/evaporation ${fixed(s.latentEnergy / 1000, 2)} + room ${fixed(s.roomEnergy / 1000, 2)} kJ.`),
      r('Water evaporated', `${fixed(s.steam * 1000, 2)} g`),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(toasterPlan(result.getState().values).length, clock + dt * SPEED); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; physicalKey = ''; return render(result.defaults); };
  const inspect = time => { clock = time; return render(); };
  result.actions = [
    {label: 'Inspect: glowing elements', part: 'elements', view: 'front', replay: false, run: () => inspect(60 + TOASTER.lower)},
    {label: 'Inspect: sensor touches plate', part: 'release', view: 'front', replay: false, run() { render({timer: 0}); return inspect(TOASTER.lower + toasterPlan(result.getState().values).triggered); }},
    {label: 'Inspect: coil pulls catch', part: 'release', view: 'front', replay: false, run: () => inspect(TOASTER.lower + toasterPlan(result.getState().values).triggered + TOASTER.release * 0.75)},
    {label: 'Inspect: switch opens', part: 'release', view: 'front', replay: false, run: () => inspect(TOASTER.lower + toasterPlan(result.getState().values).powerOff)},
    {label: 'Inspect: toast raised', part: 'system', view: 'front', replay: false, run: () => inspect(toasterPlan(result.getState().values).popped)},
    {label: 'Inspect: temperature chart', part: 'chart', view: 'front', isolate: true, replay: false, run: () => render()},
  ];
  result.playback = {label: 'Lower the bread', description: 'Five heating seconds per playback second. Inspect buttons hold the fast release stages. Changing a setting starts a fresh trial.', stepLabel: 'Advance ten seconds', advance: result.advance, step: () => result.advance(10 / SPEED), complete: () => Boolean(result.getState().complete), blocked: () => false};
  result.frameBoundsForPart = id => {
    root.updateWorldMatrix(true, false);
    if (id === 'chart') return new THREE.Box3().setFromObject(chart);
    if (id !== 'system') return null;
    return new THREE.Box3(new THREE.Vector3(-165 * MM, -22 * MM, -80 * MM), new THREE.Vector3(195 * MM, 272 * MM, 80 * MM)).applyMatrix4(root.matrixWorld);
  };
  root.rotation.set(0.16, -0.25, 0); chart.quaternion.copy(root.quaternion).invert();
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.55; result.selectionOutline = false; result.transparentBackground = true; result.thumbnailOmit = [heat, chart];
  result.topology = {system, body, elements, wires, carriage, rack, springArm, tab, bread, faces, spring, springEnds, springPart, release, latchPart, hook, ledge, shoe, solenoidPart, core, coil, stripPart, layers, tip, stop, follower, screw, adjustment, pointer, board, timerContact, switchPart, switchBlade, fixedContact, wiring, conductors, supplyLead, contactLead, timerLead, heat, arrows, chart, faceLine, middleLine, stripLine, tripLine, cursor, labels, textures, MM, SPEED, DOWN, UP, STRIP, CARD_Z, CHART};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; textures.forEach(texture => texture.dispose()); dispose(); } };
  return result;
}

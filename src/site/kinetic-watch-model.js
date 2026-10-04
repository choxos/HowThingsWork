import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {surface, lineObject, textLabel, chartText} from './scene-kit.js';
import {spurGearShape} from './gear-geometry.js';
import {fixed} from './format.js';
import {KINETIC_WATCH as K, KINETIC_DEFAULTS as D, KINETIC_DOMAINS, KINETIC_MOTIONS, KINETIC_MODES, createKineticTimeline, kineticMotion, kineticInstantElectrical, kineticClock} from './kinetic-watch-physics.js';
import {KINETIC_GEARS as GEARS, KINETIC_ARBOR_POSITIONS as POSITION, kineticTrainAngles} from './kinetic-watch-train.js';

const MM = .04, TAU = 2 * Math.PI;
const BLUE = 0x164455, COPPER = 0xa95a38;
const timeText = seconds => seconds < 1 ? `${fixed(seconds * 1000, 2)} ms` : seconds < 60 ? `${fixed(seconds, 2)} s` : seconds < 86400 ? `${fixed(seconds / 3600, 2)} h` : `${fixed(seconds / 86400, 2)} days`;
const annulus = (outer, inner = 0) => {const shape = new THREE.Shape().absarc(0, 0, outer, 0, TAU, false); if (inner) shape.holes.push(new THREE.Path().absarc(0, 0, inner, 0, TAU, true)); return shape;};

export function createKineticWatchModel() {
  const kit = houseModel('Kinetic quartz watch'), {root, part, control, covers} = kit;
  const system = part('system', 'Kinetic quartz watch', 'An early capacitor watch shown open from the back. Wrist motion drives a generator; the capacitor powers a separate quartz-controlled motor. Read the watch face to see all three connected hands.');
  const physical = part('movement', 'Complete watch movement', 'One connected teaching movement. Its layers are spaced farther apart than a commercial caliber so their connections can be inspected.', [0, 0, 0], system);
  const extrude = (shape, depth, color, parent, position = [0, 0, 0]) => {const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 48}); geometry.scale(MM, MM, MM); const mesh = surface(kit, geometry, color, parent); mesh.position.set(...position.map(v => v * MM)); return mesh;};
  const box = (size, position, color, parent) => kit.box(size.map(v => v * MM), position.map(v => v * MM), color, parent);
  const disk = (radius, depth, position, color, parent) => kit.disk(radius * MM, depth * MM, position.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const group = (parent, position = [0, 0, 0]) => {const object = new THREE.Group(); object.position.set(...position.map(v => v * MM)); parent.add(object); return object;};
  const label = (parent, text, position, height = .65, color = 0x374736, width) => {const mesh = textLabel(parent, text, {position: position.map(v => v * MM), height: height * MM, ...(width ? {width: width * MM} : {}), color: typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color}); mesh.raycast = () => {}; return mesh;};
  const shapes = {}, shafts = [], bearings = [], arbors = {}, gears = {}, terminals = {}, wires = [];
  const plate = part('support', 'Plate, case and bearings', 'The common plate and removable bridges support both gear trains. Hollow center sleeves let seconds, minutes and hours turn at different speeds.', [0, 0, 0], physical);
  const base = annulus(15.5, .3);
  for (const name of ['generatingIntermediate', 'generator', 'motor', 'first', 'third']) base.holes.push(new THREE.Path().absarc(...POSITION[name], .14, 0, TAU, true));
  shapes.plate = extrude(base, .35, 'metal', plate, [0, 0, -.175]);
  covers.push(extrude(annulus(16, 15.55), 12.1, 'metal', plate, [0, 0, -6.5]));
  for (const sign of [-1, 1]) for (const x of [-5, 5]) box([1.5, 3, 2], [x, sign * 16, -1], 'metal', plate);
  for (const sign of [-1, 1]) rod([-5, sign * 17, -1], [5, sign * 17, -1], .3, 'ink', plate);

  const generatorTrain = part('generator-train', 'Weight and generator drive', 'Two 160:8 pairs multiply angular speed by 20 and then 20, giving 400 times the weight speed. The two meshes reverse direction twice. The complete assembly includes the weight and generating magnet.', [0, 0, 0], physical);
  const rotorPart = part('rotor', 'Oscillating weight', 'A heavy semicircular rim and light carrier share the first 160-tooth gear. The prescribed relative swing is ±90°. It can turn even when the capacitor is empty.', [0, 0, 0], generatorTrain);
  const weight = group(rotorPart); arbors.weight = weight;
  const rim = new THREE.Shape().absarc(0, 0, 14.8, Math.PI, TAU, false).absarc(0, 0, 12.1, TAU, Math.PI, true); rim.closePath();
  shapes.weight = extrude(rim, 1, 'gold', weight, [0, 0, 4.6]);
  for (const a of [Math.PI + .25, TAU - .25]) rod([0, 0, 4.9], [13 * Math.cos(a), 13 * Math.sin(a), 4.9], .2, 'metal', weight);
  extrude(annulus(.65, .32), .7, 'metal', weight, [0, 0, 4.5]);
  shafts.push(extrude(annulus(.3, .19), 4.65, 'ink', weight, [0, 0, .15]));
  bearings.push(extrude(annulus(.5, .31), .25, 'red', plate, [0, 0, .2]));
  extrude(annulus(.18, .085), 4.8, 'metal', plate, [0, 0, -.2]);
  extrude(annulus(.5, .085), .2, 'metal', plate, [0, 0, -.2]);

  const intermediate = part('generator-intermediate', 'Compound generating wheel', 'An eight-tooth pinion and a 160-tooth wheel are rigidly joined on the same arbor.', POSITION.generatingIntermediate.map(v => v * MM).concat(0), generatorTrain);
  arbors.generatingIntermediate = intermediate;
  shafts.push(disk(.1, 4.1, [0, 0, 2], 'ink', intermediate));

  const generator = part('generator', 'Magnet and generating coil', 'The small magnet turns inside stationary iron poles. Changing flux induces AC in the winding. Two leads carry that AC to the rectifier.', [0, 0, 0], generatorTrain);
  const magnetPart = part('generating-magnet', 'Generating magnet', 'Its electrical angle is exactly the angle driven by the 400:1 gear train. The signed emf changes with both magnetic position and direction of rotation.', POSITION.generator.map(v => v * MM).concat(0), generator);
  const magnet = group(magnetPart); arbors.generator = magnet;
  const poleDisk = (radius, start) => {const s = new THREE.Shape().moveTo(0, 0).absarc(0, 0, radius, start, start + Math.PI, false); s.closePath(); return s;};
  extrude(poleDisk(.7, 0), .7, 'red', magnet, [0, 0, .7]);
  extrude(poleDisk(.7, Math.PI), .7, 'blue', magnet, [0, 0, .7]);
  shafts.push(disk(.08, 3.9, [0, 0, 1.9], 'ink', magnet));
  const generatorCoil = part('generating-coil', 'Generating winding and iron poles', 'A closed iron return path couples the spinning magnet to a stationary multilayer winding. Visible turns show the winding bundle, not its complete microscopic wire count.', [0, 0, 0], generator);
  const gx = POSITION.generator[0], gy = POSITION.generator[1];
  for (const sign of [-1, 1]) {
    box([.8, .45, 1.4], [gx, gy + sign * 1.0, 1.05], 'metal', generatorCoil);
    rod([gx, gy + sign * 1.05, 1.05], [11.5, gy + sign * 1.05, 1.05], .27, 'metal', generatorCoil);
  }
  box([1.35, 2.1, 1.35], [11.5, gy, 1.05], 'metal', generatorCoil);
  function winding(owner, center, length, radius, turns) {
    const points = Array.from({length: turns * 16 + 1}, (_, i) => {const a = TAU * i / 16; return [center[0] + radius * Math.cos(a), center[1] - length / 2 + length * i / (turns * 16), center[2] + radius * Math.sin(a)];});
    const mesh = kit.tube(points.map(p => p.map(v => v * MM)), .027 * MM, COPPER, owner); return {mesh, points, ends: [points[0], points.at(-1)]};
  }
  const generatingWinding = winding(generatorCoil, [11.5, gy, 1.05], 1.8, 1.05, 32);
  terminals.generator = generatingWinding.ends;

  const store = part('store', 'Storage capacitor', 'An illustrative 0.33 F capacitor stores E = ½CV². Charge protection limits it to 2.20 V. The teaching movement starts at 0.60 V and stops at 0.50 V.', [-7 * MM, -4 * MM, 0], physical);
  shapes.capacitor = disk(3.4, 1.4, [0, 0, 1], 'ink', store);
  disk(3.15, .15, [0, 0, 1.78], 'metal', store);
  label(store, 'CAPACITOR', [0, .45, 1.88], .55); label(store, '0.33 F', [0, -.45, 1.88], .65);
  rod([-2.7, 0, 1.82], [-3.7, 0, 1.82], .09, COPPER, store); rod([2.7, 0, .4], [3.7, 0, .4], .09, COPPER, store);
  label(store, '−', [-2.2, 1.4, 1.9], .8); label(store, '+', [2.2, 1.4, 1.9], .7);
  terminals.store = [[-10.7, -4, 1.82], [-3.3, -4, .4]];

  const circuit = part('circuit', 'Rectifier, protection and divider', 'The rectifier steers either AC polarity into positive capacitor charge. Protection blocks excess charging. The powered oscillator circuit counts 32,768 crystal cycles to command each motor step.', [-6 * MM, 5 * MM, 0], physical);
  shapes.board = box([5.5, 5.5, .2], [0, 0, .4], 'leaf', circuit);
  box([2.8, 2.4, .55], [0, -.45, .8], 'ink', circuit);
  label(circuit, 'IC', [0, -.45, 1.13], .6);
  for (let i = 0; i < 4; i++) for (const sign of [-1, 1]) rod([sign * 1.4, -1.2 + i * .5, .65], [sign * 2.5, -1.2 + i * .5, .65], .065, COPPER, circuit);
  box([3.8, .8, .4], [0, 1.6, .7], 'ink', circuit);
  label(circuit, 'AC → DC', [0, 1.6, .93], .42);
  terminals.circuit = {ac1: [-3.5, 6.2, .65], ac2: [-3.5, 5.7, .65], plus: [-3.5, 4.8, .65], minus: [-8.5, 4.8, .65], quartz1: [-8.5, 4.3, .65], quartz2: [-8.5, 3.8, .65], motor1: [-3.5, 4.3, .65], motor2: [-3.5, 3.8, .65]};
  for (const [name, p] of Object.entries(terminals.circuit)) {const local = [p[0] + 6, p[1] - 5, p[2]]; disk(.12, .07, local, COPPER, circuit); if (name.startsWith('ac')) rod(local, [1.85, name === 'ac1' ? 1.4 : 1.8, .65], .04, COPPER, circuit);}

  const quartz = part('quartz', 'Quartz tuning-fork resonator', 'Two electrodes connect the resonator to the powered circuit. Its nominal frequency is 32,768 Hz at 25 °C. Physical vibration is too small and fast to see at this scale.', [-11 * MM, 4 * MM, 0], physical);
  const can = kit.cylinder(.65 * MM, 3 * MM, [0, 0, 1.05 * MM], 'metal', quartz);
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(.66 * MM, .66 * MM, 3 * MM, 32, 1, true, 0, Math.PI), can.material);
  capsule.position.copy(can.position); quartz.add(capsule); covers.push(can);
  const fork = group(quartz, [0, 0, 1.05]);
  box([.65, .35, .16], [0, -.9, 0], 'cream', fork);
  for (const sign of [-1, 1]) {box([.16, 1.65, .16], [sign * .25, .05, 0], 'cream', fork); rod([sign * .25, -.9, 0], [sign * .25, -1.8, 0], .045, COPPER, fork);}
  terminals.quartz = [[-11.25, 2.2, 1.05], [-10.75, 2.2, 1.05]];

  const handTrain = part('hand-train', 'Motor and hand reduction gears', 'Three connected reductions: motor to seconds 30:1, seconds to minutes 60:1, minutes to hours 12:1. Seconds and two hollow sleeves share the center.', [0, 0, 0], physical);
  const motor = part('motor', 'Quartz-controlled stepping motor', 'This second magnet is a motor, not the generator. Alternating coil pulses advance it by half a turn for each divided crystal second. Asymmetric stator gaps set the direction.', [0, 0, 0], handTrain);
  const motorRotor = part('motor-rotor', 'Stepping rotor and pinion', 'One completed electrical pulse advances this rotor by 180°. The first two gear pairs reduce its motion thirtyfold for the seconds hand.', POSITION.motor.map(v => v * MM).concat(0), motor);
  arbors.motor = motorRotor;
  extrude(poleDisk(.7, 0), .6, 'red', motorRotor, [0, 0, .6]);
  extrude(poleDisk(.7, Math.PI), .6, 'blue', motorRotor, [0, 0, .6]);
  shafts.push(disk(.1, 3.2, [0, 0, .2], 'ink', motorRotor));
  const motorStator = part('motor-coil', 'Motor winding and stator', 'A wound iron core leads to two magnetic poles around the rotor. The circuit reverses pulse polarity each second; a small asymmetry selects the same stepping direction each time.', [0, 0, 0], motor);
  box([1.4, .36, .6], [6.06, -5, .9], 'metal', motorStator);
  box([1.4, .36, .6], [5.94, -7, .9], 'metal', motorStator);
  for (const [a, b] of [[[6, -5, .9], [10, -5, .9]], [[10, -5, .9], [10, -7.95, .9]], [[6, -7, .9], [6, -10.05, .9]], [[6, -10.05, .9], [10, -10.05, .9]]]) rod(a, b, .22, 'metal', motorStator);
  const motorWinding = winding(motorStator, [10, -9, .9], 2.1, .75, 28);
  motorWinding.mesh.material = motorWinding.mesh.material.clone();
  box([.6, 2.2, .6], [10, -9, .9], 'metal', motorStator); terminals.motor = motorWinding.ends;

  const names = {first: 'First motor reduction wheel', seconds: 'Seconds wheel and center shaft', third: 'Compound minute reduction wheel', minute: 'Minute sleeve and cannon pinion', motion: 'Compound hour reduction wheel', hour: 'Hour wheel and sleeve'};
  for (const [name, title] of Object.entries(names)) arbors[name] = part(`${name}-wheel`, title, 'A supported arbor rigidly joins the gears shown on it. Each tooth pair has the same module, matching pitch circles and a separate axial plane.', POSITION[name].map(v => v * MM).concat(0), handTrain);
  for (const name of ['first', 'third']) shafts.push(disk(.1, 5.9, [0, 0, -2.65], 'ink', arbors[name]));
  shafts.push(disk(.07, 7.25, [0, 0, -3.325], 'ink', arbors.seconds));
  shafts.push(extrude(annulus(.15, .085), 3.4, 'metal', arbors.minute, [0, 0, -6.7]));
  shafts.push(extrude(annulus(.24, .17), 1.7, 'metal', arbors.hour, [0, 0, -6.55]));
  shafts.push(disk(.1, 1.9, [0, 0, -4.6], 'ink', arbors.motion));
  for (const [name, spec] of Object.entries(GEARS)) {
    const bore = spec.arbor === 'weight' ? .3 : spec.arbor === 'generator' ? .08 : spec.arbor === 'seconds' ? .07 : spec.arbor === 'minute' ? .15 : spec.arbor === 'hour' ? .24 : .1;
    const shape = spurGearShape({...spec, bore, samples: 16}), radius = spec.teeth * spec.module / 2;
    if (radius > 1.8) for (let i = 0; i < 4; i++) shape.holes.push(new THREE.Path().absarc(.58 * radius * Math.cos(i * TAU / 4), .58 * radius * Math.sin(i * TAU / 4), .23 * radius, 0, TAU, true));
    const mesh = extrude(shape, .16, spec.teeth <= 12 ? 'metal' : 'gold', arbors[spec.arbor], [0, 0, spec.z - .08]);
    mesh.rotation.z = spec.phase; Object.assign(mesh.userData, spec); gears[name] = mesh;
  }

  const bridges = part('bridges', 'Removable bearing bridges', 'Upper and lower bearings keep the tiny gears in mesh. These bridges hide in the cutaway view.', [0, 0, 0], plate); covers.push(bridges);
  for (const name of ['generatingIntermediate', 'generator']) {
    const [x, y] = POSITION[name], bore = name === 'generator' ? .085 : .11; bearings.push(extrude(annulus(.25, bore), .2, 'red', plate, [x, y, .2])); bearings.push(extrude(annulus(.25, bore), .2, 'red', bridges, [x, y, 3.85]));
    rod([x, y, 3.95], [13.5, 0, 3.95], .12, 'metal', bridges);
  }
  rod([13.5, 0, .3], [13.5, 0, 3.95], .18, 'metal', bridges);
  bearings.push(extrude(annulus(.5, .31), .2, 'red', bridges, [0, 0, 4.15])); rod([0, 0, 4.25], [-13.5, 0, 4.25], .12, 'metal', bridges); rod([-13.5, 0, .3], [-13.5, 0, 4.25], .18, 'metal', bridges);
  for (const name of ['motor', 'first', 'third']) {
    const [x, y] = POSITION[name]; bearings.push(extrude(annulus(.24, .11), .2, 'red', plate, [x, y, -.3]));
    const z = name === 'motor' ? 1.4 : -5.65;
    bearings.push(extrude(annulus(.24, .11), .2, 'red', bridges, [x, y, z]));
    rod([x, y, z + .1], [name === 'third' ? -13 : 13, y, z + .1], .12, 'metal', bridges);
    rod([name === 'third' ? -13 : 13, y, z + .1], [name === 'third' ? -13 : 13, y, -.1], .16, 'metal', bridges);
  }
  for (const z of [-3.8, -5.65]) {
    bearings.push(extrude(annulus(.24, .11), .18, 'red', bridges, [0, 5, z])); rod([0, 5.24, z + .09], [0, 13, z + .09], .12, 'metal', bridges);
  }
  rod([0, 13, -.1], [0, 13, -5.55], .16, 'metal', bridges);

  const face = part('face', 'Watch face and three hands', 'All three hands are connected to their own output arbors. Stored energy runs them even when the oscillating weight is still. A restart does not recover time lost while stopped.', [0, 0, 0], physical);
  shapes.face = extrude(annulus(15.3, .27), .12, 'cream', face, [0, 0, -6.2]);
  bearings.push(extrude(annulus(.4, .25), .2, 'metal', face, [0, 0, -6.25]));
  for (let i = 0; i < 60; i++) {const a = i * TAU / 60, tick = box([i % 5 ? .06 : .14, i % 5 ? .45 : 1, .04], [-14 * Math.sin(a), 14 * Math.cos(a), -6.23], 'ink', face); tick.rotation.z = a;}
  for (let i = 1; i <= 12; i++) {const a = i * TAU / 12, number = label(face, String(i), [-12.2 * Math.sin(a), 12.2 * Math.cos(a), -6.25], 1.1); number.rotation.y = Math.PI;}
  const faceTitle = label(face, 'KINETIC', [0, 5.4, -6.26], .7); faceTitle.rotation.y = Math.PI;
  const hands = {};
  for (const [name, length, width, z, bore, color] of [['hour', 8, .42, -6.45, .17, 'ink'], ['minute', 11.5, .25, -6.65, .085, 'ink'], ['seconds', 13.2, .08, -6.88, 0, 'red']]) {
    const hand = group(face, [0, 0, z]); box([width, length - .3, .1], [0, (length + .3) / 2, 0], color, hand); extrude(annulus(Math.max(.27, width), bore), .12, color, hand, [0, 0, -.06]); hands[name] = hand;
  }

  const wiring = part('wiring', 'Connected electrical paths', 'Two generator leads feed the rectifier. The capacitor supplies the circuit, whose separate pairs connect to the quartz resonator and motor winding. Paths represent insulated wires and board traces.', [0, 0, 0], physical);
  function connect(name, start, end, waypoints, color = COPPER) {
    const points = [start, ...waypoints, end]; const meshes = [];
    for (let i = 1; i < points.length; i++) meshes.push(rod(points[i - 1], points[i], .045, color, wiring));
    wires.push({name, points, meshes});
    disk(.12, .08, end, color, wiring);
  }
  connect('generator-ac-1', terminals.generator[0], terminals.circuit.ac1, [[12.55, 3.5, .6], [2, 3.5, .6], [2, 6.2, .65]]);
  connect('generator-ac-2', terminals.generator[1], terminals.circuit.ac2, [[12.55, 8.5, .6], [1.5, 8.5, .6], [1.5, 5.7, .65]]);
  connect('capacitor-positive', terminals.store[1], terminals.circuit.plus, [[-2.5, -4, .4], [-2.5, 4.8, .65]], 'red');
  connect('capacitor-negative', terminals.store[0], terminals.circuit.minus, [[-12, -4, 1.82], [-12, 1.7, .65], [-8.5, 1.7, .65]], BLUE);
  connect('quartz-1', terminals.quartz[0], terminals.circuit.quartz1, [[-11.25, 1.8, .65], [-9.1, 1.8, .65], [-9.1, 4.3, .65]]);
  connect('quartz-2', terminals.quartz[1], terminals.circuit.quartz2, [[-10.75, 2, .65], [-8.9, 2, .65], [-8.9, 3.8, .65]]);
  connect('motor-1', terminals.motor[0], terminals.circuit.motor1, [[11, -11.5, .65], [1, -11.5, .65], [1, -1.5, .65], [-1.5, -1.5, .65], [-1.5, 4.3, .65]]);
  connect('motor-2', terminals.motor[1], terminals.circuit.motor2, [[11.5, -7.5, .65], [1.5, -7.5, .65], [1.5, -1.3, .65], [-1.3, -1.3, .65], [-1.3, 3.8, .65]]);

  const guides = [];
  function guide(id, title, description) {const p = part(id, title, description, [0, 0, 0], system); p.userData.inspectionOnly = id; p.userData.explosionExcluded = true; guides.push(p); return p;}
  function panel(parent, width, height, x = 45) {const mesh = box([width, height, .1], [x, 0, -.1], 'cream', parent); mesh.material = new THREE.MeshBasicMaterial({color: 0xf8f5e9}); return mesh;}
  const reserveChart = guide('reserve-chart', 'Capacitor charge and reserve', 'An explanatory voltage plot, not a physical watch part. Each day starts at 9 am with the selected motion interval, then the watch rests.');
  const reservePoint = (day, voltage) => [(24 + day / 21 * 45) * MM, (-14 + voltage / 2.2 * 28) * MM, 0];
  panel(reserveChart, 68, 58);
  const reserveLine = lineObject(128, BLUE, reserveChart), reserveDot = kit.sphere(.28 * MM, [0, 0, 0], 'red', reserveChart);
  for (const [a, b] of [[[0, 0], [21, 0]], [[0, 0], [0, 2.2]]]) kit.rod(reservePoint(...a), reservePoint(...b), .035 * MM, 'ink', reserveChart);
  const thresholdLines = [.5, .6, 2.2].map(v => {const line = lineObject(2, v === .5 ? 0x9e3e2e : 0x71855d, reserveChart); line.geometry.attributes.position.array.set([...reservePoint(0, v), ...reservePoint(21, v)]); line.geometry.computeBoundingSphere(); return line;});
  chartText(reserveChart, reservePoint, {title: 'Charge and reserve', size: 4.4 * MM, x: {min: 0, max: 21, title: 'Days', ticks: [[0, '0'], [7, '7'], [14, '14'], [21, '21']]}, y: {min: 0, max: 2.2, title: 'Volts', ticks: [[0, '0'], [.5, '.50'], [1.2, '1.20'], [2.2, '2.20']]}});
  const waveform = guide('waveform', 'Generator voltage and rectification', 'An explanatory first-40-millisecond waveform at the selected starting capacitor voltage. Positive and negative emf both produce positive available bridge current. Charge protection can reject this current when the capacitor is full.');
  const voltagePoint = (time, voltage) => [(24 + time / .04 * 45) * MM, (-14 + (voltage + 8) / 16 * 28) * MM, 0];
  const currentPoint = (time, current) => [(24 + time / .04 * 45) * MM, (-14 + current / .025 * 28) * MM, 0];
  panel(waveform, 76, 58, 46);
  const emfLine = lineObject(2049, BLUE, waveform), currentLine = lineObject(2049, COPPER, waveform);
  const emfDot = kit.sphere(.22 * MM, [0, 0, 0], 'red', waveform), currentDot = kit.sphere(.22 * MM, [0, 0, 0], 'red', waveform);
  for (const [point, low, high] of [[voltagePoint, -8, 8], [currentPoint, 0, .025]]) {
    kit.rod(point(0, low), point(.04, low), .035 * MM, 'ink', waveform); kit.rod(point(0, low), point(0, high), .035 * MM, 'ink', waveform);
  }
  chartText(waveform, voltagePoint, {title: 'Generator and bridge', size: 4.4 * MM, x: {min: 0, max: .04, title: 'Milliseconds', ticks: [[0, '0'], [.02, '20'], [.04, '40']]}, y: {min: -8, max: 8, ticks: [[-8, '−8'], [0, '0'], [8, '+8']]}});
  label(waveform, 'AC volts', [31, 18.4, .1], 4.4, BLUE);
  label(waveform, 'DC mA', [65, 18.4, .1], 4.4, COPPER);
  for (const [current, text] of [[0, '0'], [.0125, '12.5'], [.025, '25']]) label(waveform, text, [77, -14 + current / .025 * 28, .1], 4.4, COPPER);
  kit.rod(currentPoint(.04, 0), currentPoint(.04, .025), .035 * MM, COPPER, waveform);
  const timing = guide('timing', 'Quartz and frequency divider', 'An explanatory count diagram, not a second physical movement. Fifteen binary divisions turn the resonator frequency into the motor command rate. Storage supplies the energy; quartz supplies the timing.');
  panel(timing, 52, 62, 44);
  label(timing, 'Quartz sets the pace', [44, 28, .1], 4);
  const dividerLabels = [], dividerLights = [], dividerStages = [0, 5, 10, 15];
  for (const [i, stage] of dividerStages.entries()) {
    const y = 17 - i * 12;
    label(timing, stage ? `After ${stage} halvings` : 'Crystal oscillator', [45, y + 5, .1], 3.2);
    dividerLabels.push(label(timing, '', [45, y, .1], 4.5, 0x374736, 38));
    const light = disk(.7, .05, [21, y, .15], 'ink', timing); light.material = light.material.clone(); dividerLights.push(light);
  }
  const timingState = label(timing, '', [44, -27, .1], 3, 0x374736, 46);

  const specs = {
    mode: ['Explore', '', KINETIC_MODES, 'Watch working shows 12 seconds at quarter speed. Generator close-up shows 40 ms at 1/400 speed. Charge and reserve shows 21 days at six hours per playback second.'],
    motion: ['Relative weight motion', '', KINETIC_MOTIONS, 'A prescribed ±90° sinusoidal weight swing. Still means no generation. These rates are not predictions for walking or running.'],
    minutes: ['Motion each day', 'min', null, 'The daily motion interval starts at 9 am. The watch rests afterward. Changing a setting starts a new trial.'],
    voltage: ['Starting capacitor voltage', 'V', null, 'The illustrative movement starts at 0.60 V, stops at 0.50 V and limits charging at 2.20 V.'],
    temperature: ['Crystal temperature', '°C', null, 'Representative uncompensated tuning-fork law: −0.035 ppm per degree squared from 25 °C.'],
  };
  for (const [key, [min, max, step]] of Object.entries(KINETIC_DOMAINS)) {const [title, unit, options, help] = specs[key]; control(key, title, min, max, step, D[key], unit, help, options, {primary: key === 'mode'});}
  let time = 0, initialTime = null, preparedSettings = null, lastClock = 0, key = '', timeline, chartKey = '', disposed = false;
  const timelines = new Map();
  function trialTimeline(values) {const key = JSON.stringify(values); if (!timelines.has(key)) {if (timelines.size >= 12) timelines.delete(timelines.keys().next().value); timelines.set(key, createKineticTimeline(values));} return timelines.get(key);}
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (key !== nextKey) {timeline = trialTimeline(values); time = Math.min(initialTime ?? 0, timeline.plan.mode.duration); lastClock = 0; key = nextKey;}
    const s = timeline.sample(time), angles = kineticTrainAngles(s);
    for (const [name, arbor] of Object.entries(arbors)) arbor.rotation.z = angles[name];
    for (const [name, hand] of Object.entries(hands)) hand.rotation.z = angles[name] + (name === 'hour' ? 1.5 * Math.PI : 0);
    const nextChartKey = JSON.stringify({...values, mode: 2});
    if (chartKey !== nextChartKey) {
      chartKey = nextChartKey; const reserve = trialTimeline({...values, mode: 2});
      const end = reserve.sample(21 * K.day), times = [0, ...end.events.map(event => event.time)];
      for (let day = 0; day < 21; day++) times.push(day * K.day + values.minutes * 60, (day + 1) * K.day);
      const ordered = [...new Set(times)].sort((a, b) => a - b), position = reserveLine.geometry.attributes.position;
      if (ordered.length > position.count) throw new RangeError('Reserve plot exceeds its event capacity');
      ordered.forEach((t, i) => position.array.set(reservePoint(t / K.day, reserve.sample(t).voltage), i * 3));
      const lastPoint = reservePoint(21, end.voltage);
      for (let i = ordered.length; i < position.count; i++) position.array.set(lastPoint, i * 3);
      reserveLine.geometry.setDrawRange(0, ordered.length);
      reserveLine.geometry.attributes.position.needsUpdate = true; reserveLine.geometry.computeBoundingSphere();
      for (let i = 0; i <= 2048; i++) {const t = .04 * i / 2048, motion = kineticMotion(s.motionFrequency, t, values.minutes > 0), e = kineticInstantElectrical(values.voltage, motion.emf); emfLine.geometry.attributes.position.array.set(voltagePoint(t, motion.emf), i * 3); currentLine.geometry.attributes.position.array.set(currentPoint(t, e.current), i * 3);}
      for (const line of [emfLine, currentLine]) {line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();}
      dividerLabels.forEach((mesh, i) => {const stage = dividerStages[i]; mesh.userData.setText(`${fixed(s.frequency / 2 ** stage, stage > 10 ? 5 : 2)} Hz`);});
    }
    reserveDot.position.set(...reservePoint(time / K.day, s.voltage));
    const waveTime = Math.min(.04, time), waveMotion = kineticMotion(s.motionFrequency, waveTime, values.minutes > 0), waveElectrical = kineticInstantElectrical(values.voltage, waveMotion.emf);
    emfDot.position.set(...voltagePoint(waveTime, waveMotion.emf)); currentDot.position.set(...currentPoint(waveTime, waveElectrical.current));
    const cycles = (s.clock % 1) * K.nominal;
    dividerLights.forEach((mesh, i) => mesh.material.color.set(s.running && Math.floor(2 * cycles / 2 ** dividerStages[i]) % 2 ? 0xe3b45e : 0x374736));
    timingState.userData.setText(`${s.running ? 'Running' : 'Stopped'} · ${s.ticks.toLocaleString('en-US')} steps`);
    const motorPolarity = s.running && s.phase < .02 && s.ticks > s.epochClock ? (s.ticks % 2 ? 0xc14f39 : 0x83b4c1) : COPPER;
    motorWinding.mesh.material.color.set(motorPolarity);
    const event = s.events.at(-1), status = !s.running ? 'Stopped' : s.protectedCharge ? 'Running · charge limited' : s.active ? 'Running · weight moving' : 'Running · using stored energy';
    return {state: {...s, angles}, readings: [
      r('Your result', status, `${timeText(time)} elapsed. ${s.running ? 'Quartz commands the motor.' : 'Wrist motion can still drive the generator.'}`),
      r('Watch face', kineticClock(s.ticks + 9 * 3600), `${s.ticks.toLocaleString('en-US')} completed motor pulses since the initial 9:00 setting. Lost time is not restored after a restart.`),
      r('Capacitor', `${fixed(s.voltage, 3)} V · ${fixed(s.energy, 4)} J`, `${fixed(s.level * 100, 1)}% of maximum energy; E = ½ × 0.33 F × V².`),
      r('Remaining reserve while still', s.running ? `${fixed(s.reserve / K.day, 3)} days` : 'None until restart', 'Time to the 0.50 V stop threshold at the current modeled load and leakage.'),
      r('Motion interval', s.active ? `${s.motionFrequency} complete cycles/s` : 'Still · no generation', `${values.minutes} min at 9 am each day; prescribed ±90° relative weight motion.`),
      r('Generator now', `${fixed(s.motion.magnetSpeed * 60 / TAU, 0)} rpm · ${fixed(s.motion.emf, 3)} V`, 'Signed speed and instantaneous AC emf. Two 160:8 meshes multiply speed 400 times.'),
      r('Bridge current now', `${fixed(s.instant.current * 1000, 4)} mA`, s.protectedCharge ? 'Available current before charge protection; the controller admits only what the load needs.' : 'Positive charging current from either AC polarity, after 0.30 V total bridge drop and 330 Ω winding resistance.'),
      r('Available mean bridge current', `${fixed(s.mean.current * 1000, 4)} mA`, 'Before charge protection. ' + (s.values.mode === 2 ? 'Cycle average applied only during the actual daily motion interval.' : 'Cycle average for comparison. This close-up integrates the instantaneous waveform.')),
      r('Movement consumption', `${fixed(s.current * 1e6, 4)} µA`, '0.25 µA circuit current plus 0.35 µC per motor pulse. Storage integration averages motor pulses; separate capacitor leakage is 0.02 µA.'),
      r('Quartz timing', `${fixed(s.frequency, 5)} Hz`, `Fifteen halvings give ${fixed(s.ratio, 8)} motor pulses/s while powered; ${fixed(s.rate, 3)} s/day rate offset.`),
      r('Energy accounted for', `${fixed(s.mechanical, 5)} J electromagnetic input`, `${fixed(s.copper + s.bridge, 5)} J generator/bridge loss; ${fixed(s.load, 5)} J circuit/motor; ${fixed(s.leak, 5)} J leakage. Residual ${fixed(s.energyResidual * 1e6, 3)} µJ.`),
      r('Latest threshold event', event ? `${event.type[0].toUpperCase() + event.type.slice(1)} at ${timeText(event.time)}` : 'No threshold crossed', 'Start 0.60 V; stop 0.50 V; full-charge limit 2.20 V. These are teaching settings, not a commercial reserve guarantee.'),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values); if (preparedSettings && Object.entries(preparedSettings).every(([key, value]) => result.getState().values[key] === value)) {initialTime = null; preparedSettings = null;} return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null; preparedSettings = null; time = Math.min(timeline.plan.mode.duration, time + dt * timeline.plan.mode.speed);} return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = ({time: prepared = 0, mode = 0, settings} = {}) => {if (!Number.isFinite(prepared) || prepared < 0 || prepared > 21 * K.day || ![0, 1, 2].includes(mode)) throw new RangeError('Invalid kinetic watch checkpoint'); initialTime = prepared; preparedSettings = {...(settings ?? {...result.defaults, mode})}; time = lastClock = 0; key = ''; return render(preparedSettings);};
  result.replayState = () => ({time: 0, mode: result.getState().values.mode});
  const inspect = (label, id, view = 'front', isolate = true) => ({label, part: id, view, isolate, replay: false, run: () => render()});
  result.actions = [inspect('Inspect: complete watch', 'movement', 'front', false), inspect('Read the watch face', 'face', 'back', false), inspect('Inspect: swinging weight', 'rotor', 'iso'), inspect('Inspect: generator gearing', 'generator-train', 'iso'), inspect('Inspect: generating magnet and coil', 'generator', 'front'), inspect('Inspect: capacitor', 'store', 'front'), inspect('Inspect: connected circuit', 'wiring', 'front', false), inspect('Inspect: quartz and divider', 'timing'), inspect('Inspect: stepping motor', 'motor', 'front'), inspect('Inspect: hand reduction', 'hand-train', 'iso'), inspect('Inspect: charge and reserve plot', 'reserve-chart'), inspect('Inspect: generator waveform', 'waveform')];
  result.playback = {label: 'Run the selected experiment', description: 'Watch working: quarter speed. Generator close-up: 1/400 speed. Charge and reserve: six hours per playback second. Stopped hands do not stop charging.', stepLabel: 'Advance one checkpoint', advance: result.advance, step: () => result.advance(timeline.plan.mode.step / timeline.plan.mode.speed), complete: () => time >= timeline.plan.mode.duration, blocked: () => false};
  result.initialPart = 'movement'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .6; result.selectionOutline = false; result.transparentBackground = true; result.thumbnailOmit = guides;
  for (const p of result.parts) {p.maxZoom = 300; p.framePadding = guides.includes(p.object) ? .55 : .6;}
  result.frameBoundsForPart = id => {root.updateMatrixWorld(true); if (id === 'system') return new THREE.Box3().setFromObject(physical); const p = result.parts.find(p => p.id === id); if (!p) return null; const bounds = new THREE.Box3().setFromObject(p.object); if (id === 'generator-train') bounds.union(new THREE.Box3().setFromObject(gears.weight)).union(new THREE.Box3().setFromObject(gears.magnetPinion)); return bounds;};
  result.topology = {system, physical, plate, rotorPart, weight, generatorTrain, intermediate, generator, magnetPart, magnet, generatorCoil, generatingWinding, store, circuit, quartz, fork, motor, motorRotor, motorStator, motorWinding, handTrain, face, hands, wiring, wires, terminals, bridges, shapes, shafts, bearings, arbors, gears, guides, reserveChart, reserveLine, reserveDot, thresholdLines, waveform, emfLine, currentLine, timing, dividerLabels, dividerLights, MM};
  const dispose = result.dispose; result.dispose = () => {if (disposed) return; disposed = true; dispose();};
  return result;
}

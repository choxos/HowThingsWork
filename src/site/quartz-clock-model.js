import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {surface, lineObject, textLabel, chartText} from './scene-kit.js';
import {spurGearShape} from './gear-geometry.js';
import {fixed} from './format.js';
import {QUARTZ_CLOCK as C, CLOCK_DEFAULTS as D, CLOCK_DOMAINS, CLOCK_MODES, quartzClockExperiment, sampleQuartzExperiment, clockFrequency, clockFaceTime, cantileverMode} from './quartz-clock-physics.js';
import {CLOCK_GEARS as GEARS, CLOCK_ARBOR_POSITIONS as POSITION, clockTrainAngles, clockHandAngles} from './quartz-clock-train.js';

const MM = .018, TAU = 2 * Math.PI, COPPER = 0xa95a38, BLUE = 0x164455;
const annulus = (outer, inner = 0) => {const s = new THREE.Shape().absarc(0, 0, outer, 0, TAU, false); if (inner) s.holes.push(new THREE.Path().absarc(0, 0, inner, 0, TAU, true)); return s;};
const elapsedText = t => t < .001 ? `${fixed(t * 1e6, 3)} µs` : t < 3600 ? `${fixed(t, 3)} s` : `${fixed(t / C.day, 3)} days`;

export function createQuartzClockModel() {
  const kit = houseModel('Quartz clock'), {root, part, control, covers} = kit;
  const system = part('system', 'Quartz clock', 'Battery energy sustains a quartz oscillator. A divider commands a separate motor; six meshing gear pairs move three concentric hand shafts.');
  const physical = part('movement', 'Complete clock movement', 'Original open teaching movement viewed from the back. The axial layers are spread apart so the gear connections can be inspected. Read the dial from the opposite side.', [0, 0, 0], system);
  const extrude = (shape, depth, color, parent, position = [0, 0, 0]) => {const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 48}); geometry.scale(MM, MM, MM); const mesh = surface(kit, geometry, color, parent); mesh.position.set(...position.map(v => v * MM)); return mesh;};
  const box = (size, position, color, parent) => kit.box(size.map(v => v * MM), position.map(v => v * MM), color, parent);
  const disk = (radius, depth, position, color, parent) => kit.disk(radius * MM, depth * MM, position.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const group = (parent, position = [0, 0, 0]) => {const object = new THREE.Group(); object.position.set(...position.map(v => v * MM)); parent.add(object); return object;};
  const label = (parent, text, position, height = 2, width) => {const mesh = textLabel(parent, text, {position: position.map(v => v * MM), height: height * MM, ...(width ? {width: width * MM} : {})}); mesh.raycast = () => {}; return mesh;};
  const shapes = {}, shafts = [], bearings = [], arbors = {}, gears = {}, terminals = {}, wires = [];
  const support = part('support', 'Case, plate and bearings', 'The plate and removable bridges hold each arbor between bearings. Independent hollow sleeves carry the minute and hour hands.', [0, 0, 0], physical);
  const plateShape = annulus(47, .55);
  for (const name of ['motor', 'first', 'third', 'motion']) plateShape.holes.push(new THREE.Path().absarc(...POSITION[name], .25, 0, TAU, true));
  shapes.plate = extrude(plateShape, 1.2, 'leaf', support, [0, 0, -.6]);
  covers.push(extrude(annulus(48, 47.2), 21, 'metal', support, [0, 0, -3]));
  bearings.push(extrude(annulus(1.1, .53), 2.6, 'metal', support, [0, 0, -1.6]));

  const battery = part('battery', 'Battery and spring contacts', 'An ideal 1.5 V cell supplies the oscillator and motor driver. Removing the cell opens both contacts and stops the model; changing this control starts a new experiment.', [0, 0, 0], physical);
  const cell = group(battery, [0, 30, 9]);
  const batteryBody = kit.cylinder(7.25 * MM, 49.5 * MM, [0, 0, 0], 'gold', cell); batteryBody.rotation.z = Math.PI / 2;
  rod([24.75, 0, 0], [25.75, 0, 0], 2.5, 'metal', cell);
  label(cell, '1.5 V', [0, 0, 7.4], 3); label(cell, '+', [21, 0, 7.4], 2.5); label(cell, '−', [-21, 0, 7.4], 2.5);
  for (const [x, sign] of [[-28.5, -1], [26.6, 1]]) {
    box([1, 7, 14], [x, 30, 7.5], 'ink', battery);
    if (sign > 0) rod([x - .5, 30, 9], [25.75, 30, 9], .45, 'metal', battery);
    else kit.tube(Array.from({length: 97}, (_, i) => [(-28 + 3.25 * i / 96) * MM, (30 + 1.8 * Math.cos(TAU * i / 32)) * MM, (9 + 1.8 * Math.sin(TAU * i / 32)) * MM]), .15 * MM, 'metal', battery);
    box([4, 7, 1], [x, 30, 1.1], 'ink', battery);
  }
  terminals.battery = {plus: [26.6, 30, 9], minus: [-28.5, 30, 9]};

  const circuit = part('circuit', 'Oscillator, divider and motor driver', 'Eight-pin clock circuit: power on pins 1 and 2, quartz on 8 and 7, motor on 5 and 3. Test pins 4 and 6 stay unused. Internal oscillator capacitors are 17 pF and 25 pF in this example.', [-28 * MM, -17 * MM, 0], physical);
  shapes.board = box([15, 16, 1], [0, 0, 2], 'leaf', circuit);
  for (const x of [-6.5, 6.5]) for (const y of [-6.5, 6.5]) rod([x, y, .6], [x, y, 1.5], .45, 'cream', circuit);
  box([6, 10, 2], [0, 0, 4], 'ink', circuit); label(circuit, 'CLOCK IC', [0, 0, 5.1], 1.25);
  const pinSpec = [['plus', 1, -1, 3.8], ['minus', 2, -1, 1.27], ['motor2', 3, -1, -1.27], ['test1', 4, -1, -3.8], ['motor1', 5, 1, -3.8], ['test2', 6, 1, -1.27], ['quartz2', 7, 1, 1.27], ['quartz1', 8, 1, 3.8]];
  terminals.circuit = {};
  for (const [name, number, sign, y] of pinSpec) {
    rod([sign * 3, y, 3.5], [sign * 6, y, 3.5], .16, COPPER, circuit);
    disk(.35, .15, [sign * 6, y, 3.5], COPPER, circuit); label(circuit, String(number), [sign * 4.5, y + .65, 3.7], .7);
    terminals.circuit[name] = [-28 + sign * 6, -17 + y, 3.5];
  }

  const quartz = part('quartz', 'Sealed quartz tuning fork', 'Two flexing tines form one resonator. The powered circuit sustains oscillation; the crystal does not supply energy. This cutaway shows an illustrative internal fork inside a 2 × 2 × 6.1 mm package.', [-29 * MM, 1 * MM, 8 * MM], physical);
  const quartzCan = box([2, 6.1, 2], [0, 0, 0], 'metal', quartz); covers.push(quartzCan);
  box([2, 6.1, .12], [0, 0, -.94], 'metal', quartz);
  box([2.4, 6.5, .5], [0, 0, -1.25], 'cream', quartz);
  for (const y of [-2.5, 2.5]) rod([0, y, -7.4], [0, y, -1.5], .4, 'cream', quartz);
  box([1.7, .35, .16], [0, -1.8, 0], 'cream', quartz);
  const tines = [];
  for (const sign of [-1, 1]) {
    const tine = surface(kit, new THREE.BoxGeometry(.24 * MM, 3.8 * MM, .12 * MM, 1, 32, 1), 'cream', quartz);
    tine.position.set(sign * .43 * MM, .275 * MM, 0);
    tines.push({mesh: tine, sign, initial: tine.geometry.attributes.position.array.slice()});
    rod([sign * .43, -1.8, 0], [sign * .5, -3.05, 0], .055, COPPER, quartz);
    rod([sign * .5, -3.05, 0], [sign * .5, -4.5, 0], .08, COPPER, quartz);
  }
  terminals.quartz = [[-29.5, -3.5, 8], [-28.5, -3.5, 8]];
  const trimmer = part('trimmer', 'Adjustable load capacitor', 'A small trimmer sits in parallel with the 17 pF oscillator-input capacitance. More load lowers frequency. The control changes capacitance directly; screw angle is only an illustrative adjustment indicator.', [-29 * MM, 16 * MM, 5 * MM], physical);
  disk(3, 2, [0, 0, 0], 'cream', trimmer); const screw = group(trimmer, [0, 0, 1.1]);
  for (const x of [-1.7, 1.7]) rod([x, 0, -4.4], [x, 0, -1], .35, 'cream', trimmer);
  disk(2.1, .25, [0, 0, 0], 'metal', screw); box([3, .35, .08], [0, 0, .2], 'ink', screw);
  rod([-2.8, 0, 0], [-4, 0, 0], .15, COPPER, trimmer); rod([2.8, 0, 0], [4, 0, 0], .15, COPPER, trimmer);
  terminals.trimmer = [[-33, 16, 5], [-25, 16, 5]];

  const handTrain = part('hand-train', 'Motor and hand reduction gears', 'Connected two-pair reductions give 30:1 from motor to seconds, 60:1 from seconds to minutes, and 12:1 from minutes to hours.', [0, 0, 0], physical);
  const motor = part('motor', 'Bipolar stepping motor', 'The chip alternates voltage polarity across a wound stator. An asymmetric magnetic circuit gives a consistent stepping direction. Each command advances this ideal rotor by 180°.', [0, 0, 0], handTrain);
  const motorRotor = part('motor-rotor', 'Two-pole rotor and pinion', 'This permanent magnet and its ten-tooth pinion share one shaft. One motor command makes a half-turn and moves the seconds hand by six degrees.', [12 * MM, -12 * MM, 0], motor); arbors.motor = motorRotor;
  for (const [start, color] of [[0, 'red'], [Math.PI, 'blue']]) {
    const shape = new THREE.Shape().moveTo(0, 0).absarc(0, 0, 1.4, start, start + Math.PI, false); shape.closePath(); extrude(shape, 1.2, color, motorRotor, [0, 0, 15]);
  }
  shafts.push(disk(.2, 17, [0, 0, 8], 'ink', motorRotor));
  const motorStator = part('motor-coil', 'Winding and iron stator', 'The winding surrounds the return limb of an iron magnetic circuit. Visible turns stand for a multilayer coil, not its complete microscopic wire count.', [0, 0, 0], motor);
  box([3, .65, 1.2], [12.12, -10, 15.6], 'metal', motorStator); box([3, .65, 1.2], [11.88, -14, 15.6], 'metal', motorStator);
  for (const [a, b] of [[[12, -10, 15.6], [26, -10, 15.6]], [[26, -10, 15.6], [26, -23, 15.6]], [[26, -23, 15.6], [12, -23, 15.6]], [[12, -23, 15.6], [12, -14, 15.6]]]) rod(a, b, .55, 'metal', motorStator);
  const windingPoints = Array.from({length: 32 * 16 + 1}, (_, i) => {const a = TAU * i / 16; return [26 + 1.7 * Math.cos(a), -21 + 10 * i / (32 * 16), 15.6 + 1.7 * Math.sin(a)];});
  const winding = kit.tube(windingPoints.map(p => p.map(v => v * MM)), .06 * MM, COPPER, motorStator); winding.material = winding.material.clone();
  for (const [x, y] of [[26, -10], [12, -23]]) {rod([x, y, .6], [x, y, 15.1], .65, 'cream', motorStator); disk(1.4, .4, [x, y, .8], 'cream', motorStator);}
  terminals.motor = [windingPoints[0], windingPoints.at(-1)];
  const names = {first: 'Compound seconds reduction wheel', seconds: 'Seconds arbor and wheel', third: 'Compound minute reduction wheel', minute: 'Minute sleeve and cannon pinion', motion: 'Compound hour reduction wheel', hour: 'Hour sleeve and wheel'};
  const roles = {first: 'A 60-tooth wheel and 10-tooth pinion share this arbor. The 60-tooth wheel is driven by the motor’s ten-tooth pinion.', seconds: 'A 50-tooth wheel receives motion from the first arbor’s ten-tooth pinion. This center shaft carries the seconds hand and another ten-tooth pinion.', third: 'A 60-tooth wheel and 10-tooth pinion provide the intermediate reduction between seconds and minutes.', minute: 'A 100-tooth wheel and 12-tooth cannon pinion share a hollow sleeve around the seconds shaft. The sleeve carries the minute hand.', motion: 'A 36-tooth wheel and 10-tooth pinion provide the intermediate reduction between minutes and hours.', hour: 'A 40-tooth wheel turns a hollow sleeve around the minute sleeve. It carries the hour hand.'};
  for (const [name, title] of Object.entries(names)) arbors[name] = part(`${name}-wheel`, title, roles[name], [...POSITION[name].map(v => v * MM), 0], handTrain);
  for (const [name, low, high] of [['first', -.4, 14], ['third', -.4, 10], ['motion', -.4, 6]]) shafts.push(disk(.2, high - low, [0, 0, (low + high) / 2], 'ink', arbors[name]));
  shafts.push(disk(.15, 19, [0, 0, 3.9], 'ink', arbors.seconds));
  shafts.push(extrude(annulus(.32, .18), 12.4, 'metal', arbors.minute, [0, 0, -4.9]));
  shafts.push(extrude(annulus(.5, .35), 7.8, 'metal', arbors.hour, [0, 0, -4.3]));
  for (const [name, spec] of Object.entries(GEARS)) {
    const bore = spec.arbor === 'seconds' ? .15 : spec.arbor === 'minute' ? .32 : spec.arbor === 'hour' ? .5 : .2;
    const shape = spurGearShape({...spec, bore, samples: 16}), radius = spec.teeth * spec.module / 2;
    if (radius > 3) for (let i = 0; i < 4; i++) shape.holes.push(new THREE.Path().absarc(.58 * radius * Math.cos(i * TAU / 4), .58 * radius * Math.sin(i * TAU / 4), .23 * radius, 0, TAU, true));
    const color = spec.teeth <= 12 ? 'metal' : ['first', 'seconds'].includes(spec.arbor) ? 'gold' : ['third', 'minute'].includes(spec.arbor) ? 'metal' : 'clay';
    const mesh = extrude(shape, .4, color, arbors[spec.arbor], [0, 0, spec.z - .2]); mesh.rotation.z = spec.phase; Object.assign(mesh.userData, spec); gears[name] = mesh;
  }
  const bridges = part('bridges', 'Removable bearing bridges', 'Each off-center shaft has a plate bearing and a bridge bearing. The center seconds shaft runs inside minute and hour sleeves. Bridges disappear in cutaway view.', [0, 0, 0], support); covers.push(bridges);
  for (const [name, top, anchor] of [['motor', 16.3, [32, -12]], ['first', 13.5, [32, 0]], ['third', 9.5, [-20, 6]], ['motion', 5.5, [0, 21]]]) {
    const [x, y] = POSITION[name];
    bearings.push(extrude(annulus(.65, .23), .7, 'red', support, [x, y, -.4]));
    bearings.push(extrude(annulus(.65, .23), .4, 'red', bridges, [x, y, top]));
    rod([x, y, top + .2], [...anchor, top + .2], .35, 'metal', bridges); rod([...anchor, .6], [...anchor, top + .2], .45, 'metal', bridges);
  }
  bearings.push(extrude(annulus(.65, .17), .4, 'red', bridges, [0, 0, 12.8]));
  rod([0, 0, 13], [-18, 14, 13], .3, 'metal', bridges); rod([-18, 14, .6], [-18, 14, 13], .45, 'metal', bridges);

  const face = part('face', 'Dial and three connected hands', 'The dial begins at 10:10:00. The seconds shaft, minute sleeve and hour sleeve carry their own hands. The displayed time counts exactly the same completed motor commands as the geometry.', [0, 0, 0], physical);
  shapes.face = extrude(annulus(46.8, .55), .6, 'cream', face, [0, 0, -2.2]);
  for (let i = 0; i < 60; i++) {const a = i * TAU / 60, tick = box([i % 5 ? .2 : .65, i % 5 ? 1.5 : 3.2, .15], [-43 * Math.sin(a), 43 * Math.cos(a), -2.3], 'ink', face); tick.rotation.z = a;}
  for (let i = 1; i <= 12; i++) {const a = i * TAU / 12, number = label(face, String(i), [-36.5 * Math.sin(a), 36.5 * Math.cos(a), -2.4], 4.5); number.rotation.y = Math.PI;}
  const faceTitle = label(face, 'QUARTZ', [0, 17, -2.4], 2.8); faceTitle.rotation.y = Math.PI;
  const hands = {};
  for (const [name, length, width, z, bore, color] of [['hour', 26, 1.3, -4.15, .35, 'ink'], ['minute', 36, .9, -4.75, .18, 'ink'], ['seconds', 41, .25, -5.5, 0, 'red']]) {
    const hand = group(face, [0, 0, z]); box([width, length - .8, .25], [0, (length + .8) / 2, 0], color, hand); extrude(annulus(Math.max(.8, width), bore), .3, color, hand, [0, 0, -.15]); hands[name] = hand;
  }

  const wiring = part('wiring', 'Connected electrical paths', 'The cell supplies pins 1 and 2. The fork connects pins 8 and 7. The trimmer connects pin 8 to positive supply, an AC ground. Pins 5 and 3 drive opposite ends of the motor winding.', [0, 0, 0], physical);
  function connect(name, start, end, waypoints, color = COPPER) {
    const points = [start, ...waypoints, end], meshes = [];
    for (let i = 1; i < points.length; i++) meshes.push(rod(points[i - 1], points[i], .13, color, wiring));
    wires.push({name, points, meshes}); disk(.3, .1, end, color, wiring);
  }
  connect('battery-positive', terminals.battery.plus, terminals.circuit.plus, [[30, 30, 2], [30, -30, 2], [-34, -30, 2]], 'red');
  connect('battery-negative', terminals.battery.minus, terminals.circuit.minus, [[-35, 30, 2], [-35, -15.73, 2]], BLUE);
  connect('quartz-input', terminals.quartz[0], terminals.circuit.quartz1, [[-29.5, -7, 3.5], [-22, -7, 3.5]]);
  connect('quartz-output', terminals.quartz[1], terminals.circuit.quartz2, [[-28.5, -8, 3.5], [-20, -8, 3.5], [-20, -15.73, 3.5]]);
  connect('trimmer-supply', terminals.trimmer[0], terminals.circuit.plus, [[-36, 16, 3], [-36, -13.2, 3]], 'red');
  connect('trimmer-input', terminals.trimmer[1], terminals.circuit.quartz1, [[-24, 16, 3], [-24, -7, 3], [-22, -7, 3.5]]);
  connect('motor-output-1', terminals.motor[0], terminals.circuit.motor1, [[28, -26, 3], [-22, -26, 3]]);
  connect('motor-output-2', terminals.motor[1], terminals.circuit.motor2, [[29, -11, 3], [29, -28, 3], [-37, -28, 3], [-37, -18.27, 3.5]]);

  const guides = [];
  const guide = (id, title, description) => {const object = part(id, title, description, [0, 0, 0], system); object.userData.inspectionOnly = id; object.userData.explosionExcluded = true; guides.push(object); return object;};
  const panel = (parent, width, height) => {const mesh = box([width, height, .2], [130, 0, -.2], 'cream', parent); mesh.material = new THREE.MeshBasicMaterial({color: 0xf8f5e9}); return mesh;};
  const timing = guide('timing', 'Fifteen binary divisions', 'A diagram of sampled logic levels, not a second physical chip. Fifteen flip-flops divide frequency by 32,768. The driver shapes alternating motor pulses from complete output periods.'); panel(timing, 92, 112);
  label(timing, 'From vibration to seconds', [130, 49, .1], 7.5);
  const stages = [0, 5, 10, 15], dividerLabels = [], dividerLights = [];
  for (const [i, stage] of stages.entries()) {
    const y = 31 - i * 21;
    label(timing, stage ? `${stage} binary divisions` : 'Crystal oscillator', [133, y + 8, .1], 6.2);
    dividerLabels.push(label(timing, '', [133, y, .1], 7.5, 70));
    const light = disk(1.4, .1, [91, y, .1], 'ink', timing); light.material = light.material.clone(); dividerLights.push(light);
  }
  const timingState = label(timing, '', [130, -48, .1], 5.8, 85);
  const temperatureChart = guide('temperature-chart', 'Temperature and clock rate', 'A calculated powered-oscillator response at the selected load capacitance. Negative rate means lost time. The marker identifies the selected temperature.'); panel(temperatureChart, 125, 110);
  const temperaturePoint = (temperature, rate) => [(90 + (temperature + 10) / 60 * 83) * MM, (-28 + (rate + 6) / 8 * 56) * MM, 0];
  const temperatureLine = lineObject(121, BLUE, temperatureChart), temperatureDot = kit.sphere(.65 * MM, [0, 0, 0], 'red', temperatureChart);
  for (const [a, b] of [[[-10, -6], [50, -6]], [[-10, -6], [-10, 2]], [[-10, 0], [50, 0]]]) kit.rod(temperaturePoint(...a), temperaturePoint(...b), .055 * MM, 'ink', temperatureChart);
  chartText(temperatureChart, temperaturePoint, {title: 'Powered clock rate', size: 8.2 * MM, x: {min: -10, max: 50, title: 'Temperature (°C)', ticks: [[-10, '−10'], [25, '25'], [50, '50']]}, y: {min: -6, max: 2, title: 'Seconds/day', ticks: [[-6, '−6'], [-3, '−3'], [0, '0'], [2, '+2']]}});

  const specs = {
    mode: ['Explore', '', CLOCK_MODES, 'Working: sixty motor commands in about one real minute. Crystal: four cycles at 1/65,536 speed with 5,000× deformation. Comparison: one day per playback second.'],
    temperature: ['Crystal temperature', '°C', null, 'Typical uncompensated tuning-fork coefficient: −0.035 ppm/°C² relative to 25 °C.'],
    trimmer: ['Trimmer capacitance', 'pF', null, 'Adds to the 17 pF input branch. Together with the 25 pF output branch it sets load capacitance. Changing any control starts a new experiment.'],
    battery: ['Battery', '', [{value: 1, label: 'Connected'}, {value: 0, label: 'Removed'}], 'The battery supplies energy; quartz supplies a stable resonance. Removed means no oscillator or motor commands.'],
  };
  for (const [key, [min, max, step]] of Object.entries(CLOCK_DOMAINS)) {const [title, unit, options, help] = specs[key]; control(key, title, min, max, step, D[key], unit, help, options, {primary: key === 'mode'});}
  let time = 0, initialTime = null, preparedSettings = null, lastClock = 0, key = '', chartKey = '', plan, disposed = false;
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (key !== nextKey) {plan = quartzClockExperiment(values); time = Math.min(initialTime ?? 0, plan.mode.duration); lastClock = 0; key = nextKey;}
    const s = sampleQuartzExperiment(values, time), angles = clockTrainAngles(s.ticks), handAngles = clockHandAngles(s.handsTime);
    for (const [name, arbor] of Object.entries(arbors)) arbor.rotation.z = angles[name];
    for (const [name, hand] of Object.entries(hands)) hand.rotation.z = handAngles[name];
    cell.position.z = (s.powered ? 9 : 28) * MM;
    screw.rotation.z = (values.trimmer - 1.5) / 28.5 * 1.5 * Math.PI;
    for (const {mesh, sign, initial} of tines) {
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {const fraction = Math.max(0, Math.min(1, initial[i * 3 + 1] / (3.8 * MM) + .5)); position.array[i * 3] = initial[i * 3] + sign * s.displayedDisplacement * 1000 * MM * cantileverMode(fraction);}
      position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    }
    winding.material.color.set(s.motorVoltage < 0 ? 0xc14f39 : s.motorVoltage > 0 ? 0x83b4c1 : COPPER);
    dividerLabels.forEach((mesh, i) => mesh.userData.setText(s.powered ? `${fixed(s.frequency / 2 ** stages[i], stages[i] === 15 ? 6 : 2)} Hz` : 'No signal'));
    dividerLights.forEach((mesh, i) => mesh.material.color.set(s.powered && (i === 0 ? Math.floor(s.cycles * 2) % 2 : s.dividers[stages[i] - 1]) ? 0xe3b45e : 0x374736));
    timingState.userData.setText(`${s.ticks.toLocaleString('en-US')} motor commands`);
    if (chartKey !== String(values.trimmer)) {chartKey = String(values.trimmer); for (let i = 0; i <= 120; i++) {const t = -10 + i / 2; temperatureLine.geometry.attributes.position.array.set(temperaturePoint(t, (clockFrequency(t, values.trimmer) / C.nominal - 1) * C.day), i * 3);} temperatureLine.geometry.attributes.position.needsUpdate = true; temperatureLine.geometry.computeBoundingSphere();}
    temperatureDot.position.set(...temperaturePoint(values.temperature, s.rate));
    return {state: {...s, angles, handAngles}, readings: [
      r('Your result', s.powered ? s.complete ? 'Experiment complete' : s.pulse ? 'Motor pulse' : 'Clock powered' : 'Battery removed · clock stopped', `${elapsedText(s.time)} elapsed. ${values.mode === 1 ? 'Four actual crystal cycles, slowed 65,536 times; deformation enlarged 5,000 times.' : values.mode === 2 ? 'Thirty-day comparison; one simulated day per playback second.' : 'Sixty-command experiment at real-time speed.'}`),
      r('Clock face', clockFaceTime(s.handsTime), `${s.ticks.toLocaleString('en-US')} completed motor commands since 10:10:00. Geometry and readout use the same commands.`),
      r('Quartz frequency', s.powered ? `${fixed(s.frequency, 5)} Hz` : 'No oscillation', `Calculated powered rate: ${fixed(s.rate, 4)} s/day. Typical temperature curve and ideal lossless load pulling; not a product accuracy guarantee.`),
      r('Load capacitance', `${fixed(s.load * 1e12, 4)} pF`, `(${17 + values.trimmer} pF × 25 pF) / (${17 + values.trimmer} pF + 25 pF). Stray capacitance is omitted.`),
      r('Divider', `${s.completedCycles.toLocaleString('en-US')} complete crystal cycles`, 'Fifteen binary stages halve frequency. Every 32,768 complete cycles command one motor step.'),
      r('Motor output', `${fixed(s.motorVoltage, 2)} V across the winding`, `${fixed(s.pulseWidth * 1000, 3)} ms modeled pulse width at this frequency. While powered, polarity alternates each command and both pins otherwise sit at supply voltage.`),
      r('Accumulated timing error', `${fixed(s.elapsedError, 6)} s`, 'Continuous divided-oscillator time minus real elapsed time. The physical hand advances only on completed motor commands.'),
      r('Hand-train reduction', '30:1 · 60:1 · 12:1', 'A motor half-turn makes a seconds-hand step of 6°, a minute-hand step of 0.1°, and an hour-hand step of 1/120°.'),
      r('Crystal displacement', s.powered ? `${fixed(s.displacement * 1e9, 2)} nm` : 'Stationary', `Chosen 20 nm peak tip amplitude, not a measured package specification. Display deformation: ${s.magnification.toLocaleString('en-US')}×; the two tines flex oppositely.`),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values); if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null; preparedSettings = null;} return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null; preparedSettings = null; time = Math.min(plan.mode.duration, time + dt * plan.mode.speed);} return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = ({time: prepared = 0, mode = 0, settings} = {}) => {if (!Number.isFinite(prepared) || prepared < 0 || prepared > 30 * C.day || ![0, 1, 2].includes(mode)) throw new RangeError('Invalid quartz clock checkpoint'); initialTime = prepared; preparedSettings = {...(settings ?? {...result.defaults, mode})}; time = lastClock = 0; key = ''; return render(preparedSettings);};
  result.replayState = () => ({time: 0, mode: result.getState().values.mode});
  const inspect = (label, id, view = 'front', isolate = true) => ({label, part: id, view, isolate, replay: false, run: () => render()});
  result.actions = [inspect('Inspect: complete movement', 'movement', 'front', false), inspect('Read the clock face', 'face', 'back', false), inspect('Inspect: battery contacts', 'battery'), inspect('Inspect: quartz fork', 'quartz'), inspect('Inspect: load trimmer', 'trimmer'), inspect('Inspect: clock circuit', 'circuit'), inspect('Trace the electrical connections', 'wiring', 'front', false), inspect('Inspect: frequency divider', 'timing'), inspect('Inspect: stepping motor', 'motor'), inspect('Inspect: connected hand gears', 'hand-train', 'iso'), inspect('Inspect: temperature response', 'temperature-chart')];
  result.playback = {label: 'Run the selected experiment', description: 'Working: real time. Crystal close-up: 1/65,536 speed and 5,000× deformation. Timing comparison: one day per second. Changing a setting starts a new experiment.', stepLabel: 'Advance one checkpoint', advance: result.advance, step: () => result.advance(plan.mode.step / plan.mode.speed), complete: () => time >= plan.mode.duration, blocked: () => false};
  result.initialPart = 'movement'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .6; result.selectionOutline = false; result.transparentBackground = true; result.thumbnailOmit = guides;
  for (const p of result.parts) {p.maxZoom = 300; p.framePadding = guides.includes(p.object) ? .55 : .6;}
  result.frameBoundsForPart = id => {root.updateMatrixWorld(true); const object = id === 'system' ? physical : result.parts.find(p => p.id === id)?.object; return object ? new THREE.Box3().setFromObject(object) : null;};
  result.topology = {system, physical, support, battery, cell, circuit, quartz, quartzCan, tines, trimmer, screw, motor, motorRotor, motorStator, winding, handTrain, face, hands, wiring, wires, terminals, bridges, shapes, shafts, bearings, arbors, gears, guides, timing, dividerLabels, dividerLights, temperatureChart, temperatureLine, temperatureDot, temperaturePoint, MM};
  const dispose = result.dispose; result.dispose = () => {if (disposed) return; disposed = true; dispose();};
  return result;
}

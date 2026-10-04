import * as THREE from 'three';
import {createGamesControllerModel, STICK_AT, CONTROLLER} from './games-controller-model.js';
import {PAD_DEFAULTS, PAD_DOMAINS, STICK, SPRING, FRICTION, CLOCKS, RELEASE_OPTIONS, potentiometer, tiltOf} from './games-controller-physics.js';
import {reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, textLabel} from './scene-kit.js';

const KEYS = ['release', 'gate', 'bits', 'deadzone'];
export const JOYSTICK_DEFAULTS = Object.freeze(Object.fromEntries(KEYS.map(key => [key, PAD_DEFAULTS[key]])));
export const JOYSTICK_DOMAINS = Object.freeze(Object.fromEntries(KEYS.map(key => [key, PAD_DOMAINS[key]])));
const pick = values => Object.fromEntries(KEYS.filter(key => key in values).map(key => [key, values[key]]));
const settings = values => ({...PAD_DEFAULTS, rumble: 0, ...pick(values)});
const DEG = Math.PI / 180;

// The accepted controller mechanism, mounted on its own illustrative test board.
// Hidden parent objects remain owned by the parent disposer; no geometry is copied
// into a second simulation, and controller instances are unaffected.
export function createJoystickModel() {
  const model = createGamesControllerModel(), t = model.topology, mm = t.MM;
  const raw = Object.fromEntries(['update', 'advance', 'animate', 'reset', 'getState'].map(key => [key, model[key]]));
  const rig = new THREE.Group(); rig.name = 'Joystick test rig'; model.root.add(rig);
  rig.add(t.stickMechanism, t.charts);
  t.system.visible = false;
  delete t.stickMechanism.userData.explosionCategory;
  t.joystick.userData.explosionCategory = t.pots.userData.explosionCategory = true;
  model.root.name = model.root.userData.machine = 'Joystick';
  const within = (object, parent) => {for (let current = object; current; current = current.parent) if (current === parent) return true; return false;};
  model.parts = model.parts.filter(part => within(part.object, t.stickMechanism) || ['timeline', 'map', 'adc'].includes(part.id));
  const partIds = new Set(model.parts.map(part => part.id));
  model.partViewDirections = Object.fromEntries(Object.entries(model.partViewDirections).filter(([id]) => partIds.has(id)));
  for (const part of model.parts) {
    if (part.id === 'stick-mechanism' || ['timeline', 'map', 'adc'].includes(part.id)) part.parentId = 'rig';
    if (part.id === 'joystick') part.name = 'Lever, frame and spring';
  }
  t.bounce.visible = t.latency.visible = false;
  const register = (id, name, description, object, parentId = 'rig') => {
    model.parts.push({id, name, description, object, parentId, maxZoom: 300, framePadding: .8});
    model.partViewDirections[id] = {front: [.65, 1.6, 3], side: [3, 1, 0], back: [-.65, 1.4, -3], top: [0, 3, 0], bottom: [0, -3, 0]};
    return object;
  };
  register('rig', 'Joystick test rig', 'A supported thumbstick, two voltage-divider sensors and an illustrative powered ADC board. The controller shell, button and rumble motors are outside this focused lesson.', rig, undefined);
  delete model.parts.at(-1).parentId;
  const electronics = register('test-electronics', 'Power and digitizing', 'A fixed 3.3 V supply powers both resistive tracks and the ideal ADC. Separate traces carry the two wiper voltages.', new THREE.Group());
  electronics.userData.explosionCategory = true; rig.add(electronics);
  const makePart = (id, name, description) => {const group = register(id, name, description, new THREE.Group(), 'test-electronics'); electronics.add(group); return group;};
  const boardPart = makePart('test-board', 'Test board and supports', 'The board supports the module and ADC; four standoffs meet its underside. This is an illustrative test fixture, not a commercial board layout.');
  const wirePart = makePart('sensor-wiring', 'Insulated sensor wiring', 'Ground and supply reach the fixed track ends. Each center terminal reaches a separate ADC input. Insulated jumpers pass at different heights where paths cross.');
  const adcPart = makePart('test-adc', 'Two-channel ADC', 'The ideal converter samples both sensor voltages every millisecond. Its code width changes with the selected bit depth.');
  const powerPart = makePart('test-power', '3.3 V supply terminals', 'An ideal external supply holds the two marked terminals at 3.3 V and ground. Supply electronics are outside the model.');
  const materials = {board: t.board.material, chip: t.chip.material, metal: t.boardSupports[0].material, trace: t.traces[0].material};
  const at = (x, y, z) => new THREE.Vector3(x * mm, y * mm, z * mm);
  const mesh = (geometry, position, material, parent) => {const object = new THREE.Mesh(geometry, material); object.position.copy(at(...position)); parent.add(object); return object;};
  const box = (size, position, material, parent) => mesh(new THREE.BoxGeometry(...size.map(value => value * mm)), position, material, parent);
  const board = box([70, 1.6, 44], [-45, CONTROLLER.pcb - .8, 38], materials.board, boardPart);
  const supports = [];
  for (const x of [-76, -14]) for (const z of [19, 57]) supports.push(mesh(new THREE.CylinderGeometry(mm * 1.5, mm * 1.5, mm * 12.4, 24), [x, 6.2, z], materials.metal, boardPart));
  const chip = box([8, 1.5, 8], [-24, 14.75, 44], materials.chip, adcPart);
  const adcPins = [];
  for (const [x, side] of [[-28, -1], [-20, 1]]) for (const z of [41, 47]) {
    const contact = box([1, .4, .8], [x + side * .35, 14.75, z], materials.trace, adcPart);
    const foot = box([.35, .75, .8], [x + side * .675, 14.375, z], materials.trace, adcPart);
    adcPins.push({contact, foot, point: [x + side * .7, 14.75, z]});
  }
  const terminals = [[-18, 14.3, 20], [-13, 14.3, 20]].map(position => mesh(new THREE.CylinderGeometry(mm * 1.1, mm * 1.1, mm * .6, 24), position, materials.trace, powerPart));
  const wires = [], sleeves = [], connections = [], insulation = new THREE.MeshStandardMaterial({color: 0x59665b, roughness: .8});
  function wire(name, points) {
    const net = name.includes('ground') ? 'ground' : name.includes('supply') ? 'supply' : name[0];
    const height = {ground: 14.8, supply: 15.6, X: 16.4, Y: 17.2}[net];
    points = points.map((point, i) => [point[0], i > 0 && i < points.length - 1 ? height : Math.max(14.3, point[1]), point[2]]);
    connections.push({name, net, points});
    for (let i = 1; i < points.length; i++) {
      const a = at(...points[i - 1]), b = at(...points[i]);
      const object = new THREE.Mesh(new THREE.CylinderGeometry(mm * .15, mm * .15, a.distanceTo(b), 10), materials.trace);
      object.position.copy(a).add(b).multiplyScalar(.5); object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); wirePart.add(object); wires.push(object);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(mm * .23, mm * .23, Math.max(.01 * mm, object.geometry.parameters.height - .5 * mm), 10), insulation);
      sleeve.position.copy(object.position); sleeve.quaternion.copy(object.quaternion); wirePart.add(sleeve); sleeves.push(sleeve);
    }
  }
  wire('X input', [[-63, 14.15, 41.5], [-63, 14.15, 48], [-28, 14.15, 48], [-28.7, 14.75, 47]]);
  wire('Y input', [[-53.5, 14.15, 32], [-52.8, 14.15, 32], [-45, 14.15, 32], [-45, 14.15, 40], [-28, 14.15, 40], [-28.7, 14.75, 41]]);
  wire('X ground', [[-65.5, 14.15, 41.5], [-76, 14.15, 41.5], [-76, 14.15, 22], [-18, 14.15, 22], [-18, 14.3, 20]]);
  wire('Y ground', [[-53.5, 14.15, 34.5], [-51, 14.15, 34.5], [-51, 14.15, 23], [-18, 14.15, 23], [-18, 14.3, 20]]);
  wire('X supply', [[-60.5, 14.15, 41.5], [-60.5, 14.15, 54], [-13, 14.15, 54], [-13, 14.3, 20]]);
  wire('Y supply', [[-53.5, 14.15, 29.5], [-53.5, 14.15, 25], [-15, 14.15, 25], [-15, 14.15, 20], [-13, 14.3, 20]]);
  wire('ADC ground', [[-18, 14.3, 20], [-18, 14.15, 39], [-19.3, 14.75, 41]]);
  wire('ADC supply', [[-13, 14.3, 20], [-13, 14.15, 47], [-19.3, 14.75, 47]]);
  for (const [text, x] of [['0 V', -19], ['3.3 V', -12]]) {const label = textLabel(powerPart, text, {height: mm * 2, position: [x * mm, 14.05 * mm, 17 * mm]}); label.rotation.x = -Math.PI / 2;}
  const adcLabel = textLabel(adcPart, 'ADC', {height: mm * 2.5, position: [-24 * mm, 15.51 * mm, 44 * mm], color: '#f5f0dc'}); adcLabel.rotation.x = -Math.PI / 2;
  model.partViewDirections['test-electronics'].front = [0, 3, 1.8];
  model.partViewDirections['test-adc'].front = [0, 3, 2];
  model.partViewDirections['test-power'].front = [0, 3, 0];

  const response = register('response', 'Game response', 'The latest game frame applies the selected circular dead zone to the received report, then rescales and clamps it. The arrow shows normalized command, not a mechanical force.', new THREE.Group());
  response.userData.inspectionOnly = 'response'; response.userData.explosionExcluded = true; rig.add(response);
  model.partViewDirections.response = {front: [0, 0, 3]};
  model.parts.find(part => part.id === 'response').framePadding = .62;
  const stroke = (points, color) => {const line = lineObject(points.length, color, response); line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([x, y]) => [x, y, 0]), 3)); return line;};
  const radius = .65;
  stroke(Array.from({length: 97}, (_, i) => [radius * Math.cos(i / 96 * Math.PI * 2), radius * Math.sin(i / 96 * Math.PI * 2)]), 0x667466);
  stroke([[-radius, 0], [radius, 0]], 0x667466); stroke([[0, -radius], [0, radius]], 0x667466);
  textLabel(response, 'Game command', {height: .18, position: [0, 1.12, 0], weight: 'bold'});
  const responseValue = textLabel(response, '0.0%', {height: .22, width: 1.8, position: [0, .86, 0], color: '#4b643c'});
  textLabel(response, 'Full scale = 100%', {height: .14, position: [0, -.84, 0]});
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, .01), radius, 0x4b643c, .10, .06); response.add(arrow);
  const zero = new THREE.Mesh(new THREE.RingGeometry(.035, .055, 32), new THREE.MeshBasicMaterial({color: 0x4b643c, side: THREE.DoubleSide})); zero.position.z = .015; response.add(zero);

  model.controls = model.controls.filter(control => KEYS.includes(control.key));
  model.defaults = {...JOYSTICK_DEFAULTS};
  model.covers = [...t.gates];
  model.initialPart = model.autoFramePart = 'rig'; model.initialIsolated = true; model.initialCutaway = false;
  model.thumbnailOmit = [t.charts, response];
  function output(s = raw.getState()) {
    const mapped = s.now.frame?.mapped || {normalized: 0, direction: [0, 0]}, strength = mapped.normalized;
    return {mapped, strength, vector: mapped.direction.map(value => value * strength)};
  }
  function readings(s = raw.getState()) {
    const n = s.now, divider = n.stick.angles.map(potentiometer), game = output(s), elapsed = fixed(n.t * 1000, 1);
    const stage = n.t < 0 ? 'held at the gate' : n.t === 0 ? 'release begins at the gate' : n.stick.moving ? n.stick.held ? 'thumb easing it back' : 'returning under spring force' : 'at rest';
    const signed = value => `${value < 0 ? '−' : ''}${fixed(Math.abs(value), 0)}`;
    return [
      r('Your result', n.t <= CLOCKS.start ? `Ready · ${RELEASE_OPTIONS[s.values.release].label}; press Play` : n.t >= CLOCKS.duration ? `Observation complete · ${fixed(s.restTilt, 2)}° resting tilt · ${fixed(game.strength * 100, 1)}% game command` : `${elapsed} ms · ${stage}`, 'This assigned return model is played 50 times slower. At completion the same settings replay; nonzero game commands would continue afterward.'),
      r('Stick tilt', `${fixed(tiltOf(n.stick.angles).alpha / DEG, 2)}° · ${stage}`, 'Total lever tilt differs from either yoke angle during diagonal motion.'),
      r('Yoke angles', `X ${fixed(n.stick.angles[0] / DEG, 2)}° · Y ${fixed(n.stick.angles[1] / DEG, 2)}°`, 'Each perpendicular slot lets the lever slide along it while transmitting the other component of tilt.'),
      r('Spring model', `${fixed(Math.abs(SPRING * n.stick.s) * 1000, 2)} mN m restoring · ${fixed(FRICTION * 1000, 2)} mN m friction limit`, 'Generalized torque along the chosen radial path in yoke-angle space. Spring, friction, inertia and damping are assigned, not inferred from a return tolerance.'),
      r('Divider voltages', `X ${fixed(divider[0].volts, 3)} V · Y ${fixed(divider[1].volts, 3)} V`, 'Continuous wiper voltages across fixed 3.3 V, 10 kΩ tracks. They can change between ADC samples.'),
      r('Track current', `${fixed(divider[0].current * 1000, 2)} mA in each track`, 'The wipers change the division of resistance, not total track current. Ideal high-impedance ADC inputs draw no current.'),
      r('ADC codes', `X ${n.sample.codes[0]} · Y ${n.sample.codes[1]} · ${s.bits} bits`, `Sampled every 1 ms. One voltage bin is ${fixed(1000 * STICK.supply / 2 ** s.bits, 3)} mV. Center calibration, noise and loading are omitted.`),
      r('Stick report', `X ${signed(n.report.report[0])} · Y ${signed(n.report.report[1])}`, 'Latest report received by the illustrative host, which polls every 8 ms. Reports map ADC bin midpoints to signed values.'),
      r('Game command', `${fixed(game.strength * 100, 1)}% · ${game.strength > 0 ? 'outside the dead zone' : 'no commanded movement'}`, `A fixed 60 Hz game clock applies the ${s.values.deadzone}% dead zone, rescales the remaining range and clamps diagonal magnitude. The response diagram shows this held command.`),
    ];
  }
  function refresh() {
    const game = output(); arrow.visible = game.strength > 1e-12; zero.visible = !arrow.visible;
    responseValue.userData.setText(`${fixed(game.strength * 100, 1)}%`);
    if (arrow.visible) {arrow.setDirection(new THREE.Vector3(...game.mapped.direction, 0).normalize()); arrow.setLength(radius * game.strength, Math.min(.10, radius * game.strength * .4), Math.min(.06, radius * game.strength * .24));}
    return readings();
  }
  model.update = (values = {}) => {raw.update(settings({...raw.getState().values, ...values})); return refresh();};
  for (const name of ['advance', 'animate']) model[name] = (...args) => {raw[name](...args); return refresh();};
  model.reset = (initial = {}) => {raw.reset({...initial, settings: settings({...JOYSTICK_DEFAULTS, ...(initial.settings || {})})}); return refresh();};
  model.getState = () => {const s = raw.getState(); return {...s, values: pick(s.values), gameOutput: output(s), dividers: s.now.stick.angles.map(potentiometer), readings: readings(s)};};
  model.replayState = () => ({settings: pick(raw.getState().values), time: 0});
  model.actions = [
    ['Inspect: complete test rig', 'rig'], ['Inspect: thumbstick and sensors', 'stick-mechanism'], ['Inspect: lever and yokes', 'joystick'], ['Inspect: return spring', 'return-spring'], ['Inspect: two potentiometers', 'pots'], ['Inspect: powered ADC board', 'test-electronics'], ['Read: stick over time', 'timeline'], ['Read: stick map', 'map'], ['Read: ADC steps', 'adc'], ['Read: game response', 'response'],
  ].map(([label, part]) => ({label, part, view: 'front', isolate: true, replay: false, run: () => refresh()}));
  model.playback = {...model.playback, label: 'Release the stick', description: 'Watch the assigned thumbstick return and its sampled output for 300 ms, played 50 times slower.', advance: model.advance, step: () => model.advance(.005 * t.SLOW)};
  model.joystickTopology = {rig, electronics, boardPart, board, supports, chip, adcPins, terminals, wirePart, wires, sleeves, connections, response, responseValue, arrow, zero, mm, radius, STICK_AT};
  model.reset();
  return model;
}

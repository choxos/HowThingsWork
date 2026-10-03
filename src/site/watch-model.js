import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, chartText, textLabel} from './scene-kit.js';
import {spurGearShape} from './gear-geometry.js';
import {sampleWatch, balance, ALLOYS, WATCH, SPRING_LENGTH, WATCH_DEFAULTS as D, WATCH_DOMAINS} from './watch-physics.js';
import {WATCH_ESCAPEMENT as E, WATCH_PALLETS, WATCH_FORK_WALLS, WATCH_FORK_HORNS, WATCH_BANK_PINS, WATCH_DART_LENGTH, WATCH_CONTACT_ANGLES as CONTACT, watchEscapeOutline, watchJewelOutline, watchSafetyRollerOutline, watchPalletContact} from './watch-escapement.js';
import {watchHairspring, watchMainspring, WATCH_HAIRSPRING as HAIR, WATCH_MAINSPRING as MAIN} from './watch-springs.js';
import {WATCH_TRAIN_GEARS, WATCH_ARBOR_POSITIONS as POSITION, watchTrainAngles} from './watch-train.js';

const MM = 0.04, TAU = 2 * Math.PI, DURATION = WATCH.duration;
const ALLOY_COLORS = [0x374736, 0x164455];
const LEVEL = {escape: 5.3, safety: 4.85, roller: 5.65, balance: 6.45, spring: 7.0, bridge: 7.8};
export const hairspringPoints = angle => watchHairspring({angle, length: SPRING_LENGTH * 1000}).points;
export const mainspringTurns = hours => MAIN.freeTurns + Math.max(0, WATCH.turns - hours / WATCH.hoursPerTurn);
export const mainspringPoints = hours => watchMainspring(Math.max(0, WATCH.turns - hours / WATCH.hoursPerTurn)).points;
export const ampPoint = (hours, degrees) => [(40 + hours / 44 * 30) * MM, (4.5 + degrees / 260 * 14) * MM, 0];
export const ratePoint = (temperature, rate) => [(40 + temperature / 40 * 30) * MM, (-19.5 + (rate + 250) / 500 * 14) * MM, 0];
export const escapeShape = () => {
  const shape = new THREE.Shape(watchEscapeOutline().map(p => new THREE.Vector2(...p)));
  shape.holes.push(new THREE.Path().absarc(0, 0, 0.05, 0, TAU, true));
  for (let i = 0; i < 4; i++) shape.holes.push(new THREE.Path().absarc(1.45 * Math.cos(i * TAU / 4), 1.45 * Math.sin(i * TAU / 4), 0.55, 0, TAU, true));
  return shape;
};

function ribbonGeometry(count) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
  const indices = [];
  for (let i = 0; i < count - 1; i++) for (let side = 0; side < 4; side++) {
    const a = i * 4 + side, b = i * 4 + (side + 1) % 4, c = (i + 1) * 4 + side, d = (i + 1) * 4 + (side + 1) % 4;
    indices.push(a, c, b, b, c, d);
  }
  indices.push(0, 1, 2, 0, 2, 3);
  const end = (count - 1) * 4;
  indices.push(end, end + 2, end + 1, end, end + 3, end + 2);
  geometry.setIndex(indices);
  return geometry;
}
function setRibbon(mesh, points, thickness, height, z) {
  if (mesh.userData.centerline === points) return;
  const positions = mesh.geometry.attributes.position, normals = mesh.geometry.attributes.normal;
  for (let i = 0; i < points.length; i++) {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const distance = Math.hypot(after[0] - before[0], after[1] - before[1]);
    const normal = [-(after[1] - before[1]) / distance, (after[0] - before[0]) / distance];
    for (let corner = 0; corner < 4; corner++) {
      const direction = corner === 0 || corner === 3 ? 1 : -1;
      positions.setXYZ(i * 4 + corner, (points[i][0] + direction * normal[0] * thickness / 2) * MM,
        (points[i][1] + direction * normal[1] * thickness / 2) * MM, (z + (corner < 2 ? -1 : 1) * height / 2) * MM);
      normals.setXYZ(i * 4 + corner, direction * normal[0] * Math.SQRT1_2, direction * normal[1] * Math.SQRT1_2, (corner < 2 ? -1 : 1) * Math.SQRT1_2);
    }
  }
  positions.needsUpdate = normals.needsUpdate = true; mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
  mesh.userData.centerline = points;
}

export function createWatchModel() {
  const kit = houseModel('Mechanical watch'), {root, part, control, covers} = kit;
  const system = part('system', 'Mechanical watch', 'An open watch movement. One mainspring drives the toothed train, detached lever and all three hands. The balance and hairspring set the beat.');
  const movement = part('movement', 'Complete watch movement', 'The assembled working mechanism, seen from the back. Use Read the watch face to see its dial.', [0, 0, 0], system);
  const physical = [], shafts = [], bearings = [], gearMeshes = {}, arbors = {};
  const shape = points => new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
  const annulus = (outer, inner) => { const s = new THREE.Shape().absarc(0, 0, outer, 0, TAU, false); if (inner) s.holes.push(new THREE.Path().absarc(0, 0, inner, 0, TAU, true)); return s; };
  function extrude(outline, depth, color, parent, position = [0, 0, 0]) {
    const geometry = new THREE.ExtrudeGeometry(outline, {depth, bevelEnabled: false, curveSegments: 48}); geometry.scale(MM, MM, MM);
    const mesh = surface(kit, geometry, color, parent); mesh.position.set(...position.map(v => v * MM)); return mesh;
  }
  const disk = (radius, depth, position, color, parent) => kit.disk(radius * MM, depth * MM, position.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const box = (size, position, color, parent) => kit.box(size.map(v => v * MM), position.map(v => v * MM), color, parent);
  const newGroup = (parent, position = [0, 0, 0]) => { const group = new THREE.Group(); group.position.set(...position.map(v => v * MM)); parent.add(group); return group; };
  function ribbon(count, color, parent) { return surface(kit, ribbonGeometry(count), color, parent, true); }

  const plate = part('plate', 'Plate, bearings and supports', 'The plate and jeweled bearings locate every arbor. A narrow upper bridge supports the balance staff, fixed stud and regulator.', [0, 0, 0], movement); physical.push(plate);
  const plateShape = annulus(14.5, 0);
  const locations = Object.entries(POSITION).filter(([name]) => name !== 'hour');
  for (const [name, [x, y]] of locations) plateShape.holes.push(new THREE.Path().absarc(x, y, name === 'barrel' ? 1.12 : 0.17, 0, TAU, true));
  extrude(plateShape, 0.5, 'metal', plate, [0, 0, -0.25]);
  covers.push(extrude(annulus(15.4, 14.7), 10.5, 'metal', plate, [0, 0, -2.4]));
  for (const [name, [x, y]] of locations) bearings.push(extrude(annulus(name === 'barrel' ? 1.3 : 0.25, name === 'barrel' ? 1.12 : name === 'escape' ? 0.055 : 0.11), 0.18, name === 'barrel' ? 'ink' : 'red', plate, [x, y, 0.25]));

  const barrel = part('barrel', 'Mainspring and barrel', 'The same 220 mm steel ribbon stays attached to a held arbor and turning barrel. Its 96-tooth gear drives the center pinion. Starting wind is prepared with the control; winding hardware is omitted.', [...POSITION.barrel.map(v => v * MM), 0], movement); physical.push(barrel);
  const barrelBody = newGroup(barrel); arbors.barrel = barrelBody;
  extrude(annulus(1.5, 1.14), 0.31, 'gold', barrelBody, [0, 0, 1.0]);
  extrude(annulus(5.35, 1.14), 0.16, 'gold', barrelBody, [0, 0, 1.15]);
  extrude(annulus(5.35, 5.15), 1.6, 'gold', barrelBody, [0, 0, 1.31]);
  const heldArbor = newGroup(barrel);
  const barrelArbor = disk(1.12, 3.25, [0, 0, 1.375], 'ink', heldArbor);
  const innerHook = rod([1.12, 0, 2.05], [1.2, 0, 2.05], 0.045, 'ink', heldArbor);
  rod([5, 0, 2.05], [5.2, 0, 2.05], 0.045, 'ink', barrelBody);
  const mainspring = ribbon(MAIN.segments + 1, 'metal', barrel);

  const train = part('train', 'Wheel train', 'Four meshing pairs multiply barrel speed by 8, 6, 10 and 16. The center wheel carries minutes; the fourth wheel carries seconds.', [0, 0, 0], movement); physical.push(train);
  const trainNames = {center: ['center-wheel', 'Center wheel and pinion'], third: ['third-wheel', 'Third wheel and pinion'], fourth: ['fourth-wheel', 'Fourth wheel and pinion']};
  for (const [name, [id, label]] of Object.entries(trainNames)) {
    const object = part(id, label, name === 'center' ? 'A 12-tooth pinion and 60-tooth wheel share the minute arbor.' : name === 'third' ? 'A 10-tooth pinion and 100-tooth wheel turn together, six times as fast as the center wheel.' : 'A 10-tooth pinion and 128-tooth wheel share the seconds arbor. At the nominal rate it turns once per minute.', [...POSITION[name].map(v => v * MM), 0], train);
    arbors[name] = object;
  }
  const escapement = part('escapement', 'Lever escapement', 'A 15-tooth ratchet wheel, two pallets, fork, flat-faced roller jewel and safety roller. The lever moves ten degrees between fixed banking pins.', [0, 0, 0], movement); physical.push(escapement);
  const escapeArbor = part('escape-wheel', 'Escape wheel and pinion', 'The eight-tooth pinion shares its shaft with the 15-tooth escape wheel. Pallet contacts lock, recoil slightly on unlocking, deliver impulse and release.', [...POSITION.escape.map(v => v * MM), 0], escapement);
  arbors.escape = escapeArbor;
  const escapeWheel = extrude(escapeShape(), 0.2, 'ink', escapeArbor, [0, 0, LEVEL.escape - 0.1]);
  const escapeStart = watchPalletContact(0, E.bank, 'lock').angle; escapeWheel.rotation.z = escapeStart;
  const lever = part('lever', 'Pallet lever and fork', 'The two ruby pallets are rigidly joined to the fork. Sloped locking faces draw it against a bank. The balance first unlocks it, then receives a push through the opposite fork wall.', [...POSITION.lever.map(v => v * MM), 0], escapement);
  const palletParts = WATCH_PALLETS.map((p, side) => part(`${side ? 'exit' : 'entry'}-pallet`, `${side ? 'Exit' : 'Entry'} pallet`, 'A locking face holds the tooth; the inclined working face transmits wheel torque. The real tooth tip stays on the surface until release.', [0, 0, 0], lever));
  const palletMeshes = WATCH_PALLETS.map((p, side) => {
    const mesh = extrude(shape(p.outline), 0.26, 'red', palletParts[side], [0, 0, LEVEL.escape - 0.13]);
    const mount = p.topCorner.map((v, i) => (v + p.topEdge[i]) / 2);
    rod([0, 0, LEVEL.escape], [...mount, LEVEL.escape], 0.09, 0x42626d, lever);
    return mesh;
  });
  rod([0, 0, LEVEL.escape], [0, 3.825, LEVEL.escape], E.stemRadius, 0x42626d, lever);
  box([2 * E.forkOuter, 0.15, 0.2], [0, 3.825, LEVEL.escape], 0x42626d, lever);
  const forkWalls = WATCH_FORK_WALLS.map(p => extrude(shape(p), 0.2, 0x42626d, lever, [0, 0, LEVEL.escape - 0.1]));
  const forkHorns = WATCH_FORK_HORNS.map(h => extrude(shape(h.outline), 0.2, 0x42626d, lever, [0, 0, LEVEL.escape - 0.1]));
  const dart = rod([0, 3.8, LEVEL.safety], [0, WATCH_DART_LENGTH, LEVEL.safety], E.dartRadius, 'ink', lever);
  kit.sphere(E.dartRadius * MM, [0, WATCH_DART_LENGTH * MM, LEVEL.safety * MM], 'ink', lever);
  rod([0, 3.8, LEVEL.safety], [0, 3.8, LEVEL.escape], 0.03, 'ink', lever);
  const bankPins = WATCH_BANK_PINS.map(([x, y]) => disk(E.bankPinRadius, LEVEL.escape + 0.25, [POSITION.lever[0] + x, POSITION.lever[1] + y, (LEVEL.escape + 0.25) / 2], 'ink', plate));

  const balancePart = part('balance', 'Balance wheel and rollers', 'A 49 mg rim with a mean radius of 4.5 mm. The wheel, collar, impulse jewel and notched safety roller turn on one staff; support-spoke inertia is neglected.', [...POSITION.balance.map(v => v * MM), 0], movement); physical.push(balancePart);
  const wheel = newGroup(balancePart);
  const balanceRim = extrude(annulus(4.65, 4.35), 0.3, 'gold', wheel, [0, 0, LEVEL.balance - 0.15]);
  const balanceSpoke = rod([-4.5, 0, LEVEL.balance], [4.5, 0, LEVEL.balance], 0.07, 'gold', wheel);
  disk(0.1, LEVEL.bridge + 0.1, [0, 0, (LEVEL.bridge + 0.1) / 2], 'ink', wheel);
  const roller = part('roller', 'Impulse jewel and safety roller', 'The flat face of the ruby enters the fork. The smaller notched roller and guard dart block accidental unlocking while the balance swings freely.', [0, 0, 0], wheel);
  const impulseRoller = disk(1.3, 0.1, [0, 0, LEVEL.roller], 'metal', roller);
  impulseRoller.material = impulseRoller.material.clone(); impulseRoller.material.transparent = true; impulseRoller.material.opacity = 0.12; impulseRoller.material.depthWrite = false;
  const jewel = extrude(shape(watchJewelOutline()), 0.45, 'red', roller, [0, 0, LEVEL.escape - 0.15]);
  const safetyRoller = extrude(shape(watchSafetyRollerOutline()), 0.12, 'metal', roller, [0, 0, LEVEL.safety - 0.06]);
  const collar = extrude(annulus(HAIR.inner, 0.105), 0.12, 'ink', wheel, [0, 0, LEVEL.spring - 0.06]);
  const neutralSpring = watchHairspring({length: SPRING_LENGTH * 1000});
  const collarMark = box([0.08, 0.08, 0.16], [HAIR.inner * Math.cos(neutralSpring.innerAngle), HAIR.inner * Math.sin(neutralSpring.innerAngle), LEVEL.spring], 'red', wheel);

  const hairspring = part('hairspring', 'Hairspring and regulator', 'The inner end follows the balance collar. A fixed stud anchors the outer terminal; two curb pins select the active length. The same ribbon remains present as the clamp moves.', [...POSITION.balance.map(v => v * MM), 0], movement); physical.push(hairspring);
  const coil = ribbon(HAIR.segments + 1, ALLOY_COLORS[1], hairspring);
  const terminal = ribbon(65, ALLOY_COLORS[1], hairspring);
  const regulator = newGroup(hairspring);
  rod([0, 0, 7.42], [3.45, 0, 7.42], 0.045, 'metal', regulator);
  const curbPins = [-1, 1].map(sign => disk(0.08, 0.48, [HAIR.outer + sign * (0.08 + HAIR.thickness / 2), 0, 7.18], 'ink', regulator));
  const stud = disk(0.09, 0.86, [0, HAIR.outer, 7.4], 'ink', hairspring);
  const bridge = part('balance-bridge', 'Balance bridge and upper bearing', 'The bridge holds the upper balance bearing, fixed stud and regulator above the moving wheel. Its supporting post stands outside the rim.', [0, 0, 0], plate);
  rod([POSITION.balance[0], POSITION.balance[1] + 5.2, 0], [POSITION.balance[0], POSITION.balance[1] + 5.2, LEVEL.bridge], 0.16, 'metal', bridge);
  rod([...POSITION.balance, LEVEL.bridge], [POSITION.balance[0], POSITION.balance[1] + 5.2, LEVEL.bridge], 0.12, 'metal', bridge);
  extrude(annulus(0.26, 0.11), 0.18, 'red', bridge, [...POSITION.balance, LEVEL.bridge - 0.09]);

  const dial = part('dial', 'Dial and hand reduction', 'The minute arbor drives a 12:36 pair, then a 10:40 pair on the hour sleeve. Both hands turn clockwise from the front; the separate seconds hand shares the fourth-wheel shaft.', [0, 0, 0], movement); physical.push(dial);
  const motionWork = part('motion-work', 'Twelve-to-one hand reduction', 'Two gear pairs reduce the minute arbor speed twelvefold. The hour sleeve surrounds the minute shaft.', [0, 0, 0], dial);
  arbors.motion = newGroup(motionWork, [...POSITION.motion, 0]); arbors.hour = newGroup(motionWork);
  const cannon = newGroup(motionWork);
  const face = part('watch-face', 'Watch face and hands', 'The seconds hand shares the fourth-wheel arbor; concentric minute and hour hands use the connected hand reduction.', [0, 0, 0], dial);
  const dialOutline = annulus(14.4, 0.2);
  dialOutline.holes.push(new THREE.Path().absarc(...POSITION.fourth, 0.11, 0, TAU, true));
  const dialFace = extrude(dialOutline, 0.12, 'cream', face, [0, 0, -1.86]); covers.push(face);
  for (let i = 0; i < 60; i++) {
    const a = i * TAU / 60, mark = box([i % 5 ? 0.06 : 0.14, i % 5 ? 0.45 : 0.9, 0.05], [-12.5 * Math.sin(a), 12.5 * Math.cos(a), -1.89], 'ink', face);
    mark.rotation.z = a;
  }
  for (let i = 1; i <= 12; i++) {
    const a = i * TAU / 12;
    const label = textLabel(face, String(i), {height: 1.0 * MM, position: [-10.8 * Math.sin(a) * MM, 10.8 * Math.cos(a) * MM, -1.93 * MM]});
    label.rotation.y = Math.PI; label.raycast = () => {};
  }
  kit.ring(2.25 * MM, 0.035 * MM, [...POSITION.fourth.map(v => v * MM), -1.94 * MM], 'ink', face);
  for (let i = 0; i < 60; i++) {
    const a = i * TAU / 60;
    const mark = box([0.025, i % 5 ? 0.12 : 0.23, 0.035], [POSITION.fourth[0] - 2.05 * Math.sin(a), POSITION.fourth[1] + 2.05 * Math.cos(a), -1.97], 'ink', face); mark.rotation.z = a;
  }
  function hand(length, width, z, owner, color, bore = 0) {
    const group = newGroup(face, [...POSITION[owner], z]);
    const start = bore ? 0.2 : 0;
    box([width, length - start, 0.08], [0, (length + start) / 2, 0], color, group);
    if (bore) extrude(annulus(width, bore), 0.11, color, group, [0, 0, -0.055]);
    else disk(Math.max(width, 0.12), 0.11, [0, 0, 0], color, group);
    return group;
  }
  const hourHand = hand(7, 0.28, -2.07, 'center', 'ink', 0.105);
  const minuteHand = hand(11.3, 0.15, -2.24, 'center', 'ink');
  const secondsHand = hand(2.05, 0.065, -2.12, 'fourth', 'red');
  const sleeve = extrude(annulus(0.19, 0.105), 1.15, 'metal', arbors.hour, [0, 0, -2.1]);

  for (const [name, spec] of Object.entries(WATCH_TRAIN_GEARS)) {
    const parent = name === 'cannon' ? cannon : arbors[spec.arbor];
    const outline = spurGearShape({...spec, samples: 16, bore: name === 'barrel' ? 1.14 : spec.arbor === 'escape' ? 0.05 : name === 'hour' ? 0.19 : 0.1});
    const radius = spec.teeth * spec.module / 2;
    if (radius > 1.5) for (let i = 0; i < 4; i++) outline.holes.push(new THREE.Path().absarc(0.58 * radius * Math.cos(i * TAU / 4), 0.58 * radius * Math.sin(i * TAU / 4), 0.22 * radius, 0, TAU, true));
    const gear = extrude(outline, 0.16, name.includes('Pinion') || name === 'cannon' ? 'metal' : 'gold', parent, [0, 0, spec.z - 0.08]);
    gear.rotation.z = spec.phase; Object.assign(gear.userData, {teeth: spec.teeth, module: spec.module, mountingPhase: spec.phase, pressureAngle: spec.pressureAngle}); gearMeshes[name] = gear;
  }
  const arborExtents = {center: [-2.28, 6.1], third: [-0.25, 6.1], fourth: [-2.2, 6.1], escape: [-0.25, 6.1], motion: [-1.1, 0.5]};
  for (const [name, [bottom, top]] of Object.entries(arborExtents)) shafts.push(disk(name === 'escape' ? 0.05 : 0.1, top - bottom, [0, 0, (top + bottom) / 2], 'ink', arbors[name]));
  shafts.push(disk(0.1, 6.35, [0, 0, 2.925], 'ink', lever));
  const trainBridge = part('train-bridge', 'Train bridge and upper bearings', 'A removable bridge carries the upper bearings for the wheel train and pallet lever. Cutaway hides it so the working contacts stay visible.', [0, 0, 0], plate);
  covers.push(trainBridge);
  const upperBearings = {};
  for (const name of ['center', 'third', 'fourth', 'escape', 'lever']) upperBearings[name] = extrude(annulus(0.25, name === 'escape' ? 0.055 : 0.11), 0.18, 'red', trainBridge, [...POSITION[name], 5.81]);
  for (const [a, b] of [['center', 'third'], ['third', 'fourth'], ['fourth', 'escape'], ['escape', 'lever']]) {
    const start = new THREE.Vector2(...POSITION[a]), end = new THREE.Vector2(...POSITION[b]), direction = end.clone().sub(start).normalize();
    start.addScaledVector(direction, 0.23); end.addScaledVector(direction, -0.23);
    rod([...start, 5.9], [...end, 5.9], 0.12, 'metal', trainBridge);
  }
  for (const [point, name] of [[[-1, -8], 'third'], [[9, -3.85], 'escape']]) {
    rod([...point, 0], [...point, 5.9], 0.16, 'metal', trainBridge);
    const end = new THREE.Vector2(...POSITION[name]), direction = new THREE.Vector2(...point).sub(end).normalize(); end.addScaledVector(direction, 0.23);
    rod([...point, 5.9], [...end, 5.9], 0.12, 'metal', trainBridge);
  }

  const charts = part('charts', 'Wind and temperature comparisons', 'These labeled comparison plots are explanatory panels, not physical watch parts. The red marker hides when no running rate exists.', [0, 0, 0], system);
  charts.userData.explosionExcluded = true; charts.userData.inspectionOnly = 'charts'; charts.position.set(-55 * MM, 0, 12 * MM);
  box([40, 49, 0.12], [55, -0.5, -0.1], 'cream', charts);
  const axis = (a, b) => kit.rod(a, b, 0.035 * MM, 'ink', charts);
  axis(ampPoint(0, 0), ampPoint(44, 0)); axis(ampPoint(0, 0), ampPoint(0, 260));
  axis(ratePoint(0, -250), ratePoint(40, -250)); axis(ratePoint(0, -250), ratePoint(0, 250)); axis(ratePoint(0, 0), ratePoint(40, 0));
  const stopLine = lineObject(2, 0x702e24, charts); stopLine.geometry.attributes.position.array.set([...ampPoint(0, WATCH.minimum * 180 / Math.PI), ...ampPoint(44, WATCH.minimum * 180 / Math.PI)]); stopLine.geometry.computeBoundingSphere();
  const ampLine = lineObject(177, 0x164455, charts), rateLines = ALLOYS.map((_, i) => lineObject(41, ALLOY_COLORS[i], charts));
  for (const line of [stopLine, ampLine, ...rateLines]) line.position.z = 0.08 * MM;
  const ampDot = kit.sphere(0.2 * MM, [0, 0, 0], 'red', charts), rateDot = kit.sphere(0.2 * MM, [0, 0, 0], 'red', charts);
  chartText(charts, ampPoint, {title: 'Predicted settled swing as wind is used', size: 1.5 * MM,
    x: {min: 0, max: 44, title: 'Equivalent hours of use at 4 Hz', ticks: [[0, '0'], [24, '24'], [44, '44']]},
    y: {min: 0, max: 260, title: 'Swing each way (degrees)', ticks: [[0, '0'], [130, '130'], [260, '260']]},
    legend: [['Settled swing', 0x164455], ['Engagement threshold', 0x702e24]]});
  chartText(charts, ratePoint, {title: 'Ideal-model rate against temperature', size: 1.5 * MM,
    x: {min: 0, max: 40, title: 'Temperature (°C)', ticks: [[0, '0'], [20, '20'], [40, '40']]},
    y: {min: -250, max: 250, title: 'Seconds per day, gained or lost', ticks: [[-250, '−250'], [0, '0'], [250, '+250']]},
    legend: [['Uncompensated', ALLOY_COLORS[0]], ['Ideally compensated', ALLOY_COLORS[1]]]});

  const specs = {
    index: ['Regulator', 'marks', null, 'Each mark toward fast moves the curb pins and shortens active spring length by 0.02%.'],
    alloy: ['Thermal response', '', ALLOYS.map(({value, label}) => ({value, label})), 'Declared teaching parameters compare uncompensated elasticity with exact ideal compensation. These are not commercial alloy specifications.'],
    temperature: ['Temperature', '°C', null, 'The nominal rate is four complete balance cycles per second at 20 °C.'],
    hours: ['Starting wind used', 'h at 4 Hz', null, 'Prepare the winding left after this many nominal hours. One barrel turn equals eight hours of nominal use.'],
  };
  for (const [name, [min, max, step]] of Object.entries(WATCH_DOMAINS)) {
    const [title, unit, options, help] = specs[name]; control(name, title, min, max, step, D[name], unit, help, options);
  }
  let time = 0, lastClock = 0, initialPhase = 0, key = '', chartKey = '', disposed = false, previousHairKey = '', previousHair, previousSpring;
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== key) { time = initialPhase / balance(values).frequency; lastClock = 0; key = nextKey; }
    const s = sampleWatch(values, time), angles = watchTrainAngles(s);
    for (const [name, object] of Object.entries(arbors)) object.rotation.z = angles[name];
    cannon.rotation.z = angles.center;
    hourHand.rotation.z = angles.hour; minuteHand.rotation.z = angles.center; secondsHand.rotation.z = angles.fourth;
    lever.rotation.z = s.lever; wheel.rotation.z = s.angle;
    const rimGrowth = 1 + WATCH.balanceExpansion * (values.temperature - WATCH.reference);
    balanceRim.scale.set(rimGrowth, rimGrowth, 1); balanceSpoke.scale.y = rimGrowth;
    const hairKey = [s.angle, values.index, s.growth].join('/');
    const hair = hairKey === previousHairKey ? previousHair : watchHairspring({angle: s.angle, index: values.index, growth: s.growth, length: SPRING_LENGTH * 1000});
    previousHairKey = hairKey; previousHair = hair;
    setRibbon(coil, hair.points, HAIR.thickness * s.growth, HAIR.height * s.growth, LEVEL.spring);
    setRibbon(terminal, hair.terminal, HAIR.thickness * s.growth, HAIR.height * s.growth, LEVEL.spring);
    coil.material.color.set(ALLOY_COLORS[values.alloy]); terminal.material.color.set(ALLOY_COLORS[values.alloy]);
    regulator.rotation.z = hair.outerAngle; regulator.scale.set(s.growth, s.growth, 1); stud.position.y = HAIR.outer * s.growth * MM;
    collar.scale.set(s.growth, s.growth, 1); collarMark.scale.set(s.growth, s.growth, 1);
    collarMark.position.x = HAIR.inner * Math.cos(neutralSpring.innerAngle) * s.growth * MM; collarMark.position.y = HAIR.inner * Math.sin(neutralSpring.innerAngle) * s.growth * MM;
    const spring = previousSpring?.remainingTurns === s.remainingTurns ? previousSpring : watchMainspring(s.remainingTurns); previousSpring = spring;
    setRibbon(mainspring, spring.points, MAIN.thickness, MAIN.height, 2.05);
    // The empty prepared state places the free spring and held arbor at the
    // stopped escapement's phase without adding winding to the spring.
    mainspring.rotation.z = heldArbor.rotation.z = s.running ? 0 : s.barrel;
    const nextChartKey = JSON.stringify({...values, hours: 0});
    if (chartKey !== nextChartKey) {
      chartKey = nextChartKey;
      for (let i = 0; i <= 176; i++) {
        const hours = i / 4;
        const remaining = WATCH.turns - hours / WATCH.hoursPerTurn;
        const amplitude = balance({...values, hours: 0}).predictedAmplitude * Math.sqrt(Math.max(0, remaining) / WATCH.turns);
        ampLine.geometry.attributes.position.array.set(ampPoint(hours, amplitude * 180 / Math.PI), i * 3);
      }
      ampLine.geometry.attributes.position.needsUpdate = true; ampLine.geometry.computeBoundingSphere();
      rateLines.forEach((line, alloy) => {
        for (let temperature = 0; temperature <= 40; temperature++) line.geometry.attributes.position.array.set(ratePoint(temperature, balance({...values, alloy, temperature, hours: 0}).rate), temperature * 3);
        line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();
      });
    }
    ampDot.position.set(...ampPoint(values.hours, s.predictedAmplitude * 180 / Math.PI));
    rateDot.visible = s.running; if (s.running) rateDot.position.set(...ratePoint(values.temperature, s.rate));
    const rateText = !s.running ? 'Unavailable while stopped' : Math.abs(s.rate) < 0.005 ? '0.00 s/day in this ideal model' : `${s.rate > 0 ? 'Gains' : 'Loses'} ${fixed(Math.abs(s.rate), 2)} s/day`;
    const shown = values.hours * 3600 + s.center / TAU * 3600;
    const whole = Math.floor(shown + 1e-8), dialText = `${Math.floor(whole / 3600) % 12 || 12}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
    return {state: {...s, hair, spring, trainAngles: angles, shown}, readings: [
      r('Your result', s.running ? `Running · ${rateText}` : 'Stopped · insufficient wind for repeated releases'),
      r('Working contact', s.stage, s.contactSide === null ? 'Both pallets are clear during the short wheel drop.' : `${s.contactSide ? 'Exit' : 'Entry'} pallet${s.contact ? `, ${s.contact.face} face` : ''}. ${s.forkContact || 'The balance is detached from the fork.'}`),
      r('Dial', dialText, `${s.beats} completed releases in this run. All three hands follow the same toothed train.`),
      r('Balance frequency', `${fixed(s.frequency, 6)} Hz`, `${fixed(s.beatsPerHour, 0)} beats per hour while running; two beats per complete cycle.`),
      r('Supported swing', `${fixed(s.predictedAmplitude * 180 / Math.PI, 2)}° each way`, s.running ? 'Settled energy balances mean work and loss; the displayed run is slowed tenfold.' : `Below the ${fixed(WATCH.minimum * 180 / Math.PI, 2)}° geometric engagement threshold. The balance is at rest.`),
      r('Rate', rateText, 'A steady-rate projection, not a day-long timing test.'),
      r('Active hairspring', `${fixed(hair.workingLength, 4)} mm`, `${fixed(s.kappa * 1e6, 4)} µN·m/rad. Whole ribbon including its fixed terminal: ${fixed(hair.totalLength, 4)} mm.`),
      r('Mainspring', `${fixed(s.torque * 1000, 4)} mN·m`, `${fixed(s.remainingTurns, 4)} turns remain; approximately ${fixed(s.usableHours, 2)} usable hours at the current ideal rate.`),
      r('Energy per beat', `${fixed(s.beatEnergy * 1e6, 4)} µJ`, s.running ? `Mean delivered power ${fixed(s.power * 1e6, 4)} µW; oscillator energy ${fixed(s.energy * 1e6, 4)} µJ.` : 'No continuing wheel motion or delivered power.'),
      r('Balance angle now', `${fixed(s.angle * 180 / Math.PI, 2)}°`, s.running ? `${fixed(time, 4)} s of watch time.` : 'Stationary spring and roller contact.'),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0 && result.getState().running) time = Math.min(DURATION, time + dt / WATCH.slow); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = ({phase = 0} = {}) => { if (!Number.isFinite(phase) || phase < 0 || phase > 1) throw new RangeError('Initial watch phase must be between zero and one'); initialPhase = phase; time = lastClock = 0; key = ''; return render(result.defaults); };
  const focus = (label, target, view = 'front', isolate = false) => ({label, part: target, view, isolate, replay: false, run: () => render()});
  result.actions = [focus('Inspect: complete watch', 'movement'), focus('Read the watch face', 'watch-face', 'back'), focus('Inspect: connected wheel train', 'train', 'iso', true), focus('Inspect: hand reduction', 'motion-work', 'iso', true), focus('Inspect: mainspring and barrel', 'barrel'), focus('Inspect: hairspring and regulator', 'hairspring'), focus('Inspect: wind and temperature charts', 'charts', 'front', true)];
  for (const side of [0, 1]) for (const [name, toward] of [['unlocking', (CONTACT.enter + CONTACT.unlock) / 2], ['impulse', 0], ['free drop', CONTACT.release + CONTACT.drop / 2]]) {
    result.actions.push({label: `Inspect: ${side ? 'exit' : 'entry'} ${name}`, part: 'escapement', view: 'front', isolate: false, replay: false, run() {
      const s = balance(result.getState().values); if (s.running) time = (side / 2 + Math.acos(-toward / s.amplitude) / TAU) / s.frequency; return render();
    }});
  }
  result.playback = {label: 'Run to the two-second checkpoint', description: 'Two watch seconds are shown at one-tenth speed. Inspection presets can start within that interval. Reset restores the starting wind and settings.', stepLabel: 'Advance one beat', advance: result.advance, step: () => result.advance(WATCH.slow / (2 * balance(result.getState().values).frequency)), complete: () => time >= DURATION, blocked: () => !result.getState().running};
  result.initialPart = 'movement'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.65; result.selectionOutline = false; result.transparentBackground = true;
  result.thumbnailOmit = [charts];
  for (const p of result.parts) if (['escapement', 'lever', 'entry-pallet', 'exit-pallet', 'roller', 'hairspring', 'motion-work'].includes(p.id)) { p.maxZoom = 300; p.framePadding = p.id.endsWith('pallet') ? 3 : 0.7; }
  result.frameBoundsForPart = id => {
    root.updateMatrixWorld(true);
    if (id === 'charts') return new THREE.Box3().setFromObject(charts);
    if (id === 'system' || id === 'movement') return new THREE.Box3().setFromObject(movement);
    if (id === 'escapement') { const b = new THREE.Box3().setFromObject(escapement); b.union(new THREE.Box3().setFromObject(roller)); return b; }
    return null;
  };
  result.topology = {system, movement, plate, physical, barrel, barrelArbor, heldArbor, innerHook, barrelBody, mainspring, train, trainBridge, upperBearings, arbors, gears: gearMeshes, shafts, bearings, escapement, escapeArbor, escapeWheel, escapeStart, lever, palletParts, palletMeshes, forkWalls, forkHorns, dart, bankPins, balancePart, wheel, balanceRim, balanceSpoke, roller, impulseRoller, jewel, safetyRoller, collar, collarMark, hairspring, coil, terminal, regulator, curbPins, stud, bridge, dial, face, dialFace, motionWork, cannon, sleeve, hourHand, minuteHand, secondsHand, charts, ampLine, ampDot, rateLines, rateDot, stopLine, MM, DURATION, LEVEL, POSITION, ALLOY_COLORS};
  const dispose = result.dispose; result.dispose = () => { if (disposed) return; disposed = true; dispose(); };
  return result;
}

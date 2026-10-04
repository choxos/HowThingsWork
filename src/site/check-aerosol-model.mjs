import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAerosolCanModel} from './aerosol-model.js';
import {AEROSOL as C, AEROSOL_DEFAULTS as D, sampleAerosol, aerosolInitialAmounts} from './aerosol-physics.js';
import {aerosolEquilibrium} from './aerosol-equilibrium.js';
import {CAN, BRIMFUL, MM, point, levelFor, volumeBelow, bottomAt, radiusAt, VALVE} from './aerosol-geometry.js';
import {aerosolLesson as lesson} from './aerosol-lesson.js';
import {tally, checkFinite, checkDisposal, checkControlsMove} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), m = createAerosolCanModel(), p = m.topology;
const vector = a => new THREE.Vector3(...a), world = a => p.holder.localToWorld(vector(point(a)));
const reset = (values = {}, time = 0) => {const settings = {...D, ...values};m.reset({settings, time});m.update(settings);m.root.updateMatrixWorld(true);return m.getState();};
const core = s => [s.clock, s.values, s.amounts, s.U, s.outLiquid, s.outVapor, s.heatAdded, s.energyOut];
m.root.position.set(.2, -.3, .4);m.root.rotation.set(.1, -.25, .2);reset();

// Independent cross-section integration and signed tetrahedra from the actual
// mesh. The drawn vessel, liquid surface and conserved inventory must agree.
function sliced(low, high, steps = 20000) {
  let total = 0;
  for (let i = 0; i < steps; i++) {
    const y = low + (i + .5) * (high - low) / steps;
    const outer = y <= CAN.wallTop ? 32.5 : 32.5 - 19 * (y - CAN.wallTop) / (165 - CAN.wallTop);
    const inner = y < 12 ? 30 * Math.sqrt(1 - y / 12) : 0;
    total += Math.PI * (outer ** 2 - inner ** 2) * (high - low) / steps;
  }
  return total;
}
function meshVolume(geometry) {
  const a = new THREE.Vector3(), b = a.clone(), c = a.clone(), positions = geometry.attributes.position, index = geometry.index;
  let sum = 0;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    a.fromBufferAttribute(positions, index ? index.getX(i) : i);b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1);c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2);
    sum += a.dot(b.cross(c));
  }
  return Math.abs(sum) / 6 / MM ** 3;
}
t.near(BRIMFUL, 500000, 1e-8, 'exact nominal interior volume');
t.near(sliced(0, 165), 500000, .02, 'vessel volume by independent slices');
for (const volume of [2, 4, 6, 50, 200, 373.8, 480].map(x => x * 1e-6)) for (const upright of [true, false]) {
  const level = levelFor(volume, upright);
  t.near(upright ? sliced(0, level) : sliced(level, 165), volume * 1e9, .02, 'liquid surface holds assigned volume');
}
const tube = p.tubeCurve, elbow = p.actuatorCurve;
t.near(tube.getPoint(0).distanceTo(vector(point([0, 146, 0]))), 0, 1e-12, 'tube enters housing inlet');
t.near(sliced(0, tube.getPoint(1).y / MM), 6000, .01, 'pickup height leaves six milliliters');
for (const q of tube.getSpacedPoints(4000)) {
  t.ok(q.y / MM - 1.5 > bottomAt(Math.hypot(q.x, q.z) / MM), 'tube clears domed floor');
  t.ok(Math.hypot(q.x, q.z) / MM + 1.5 < radiusAt(q.y / MM), 'tube clears outer wall');
}
for (let i = 1; i < 1000; i++) {
  const a = (i - .1) / 1000, b = (i + .1) / 1000, angle = tube.getTangentAt(a).angleTo(tube.getTangentAt(b));
  if (angle > 1e-8) t.ok(tube.getPointAt(a).distanceTo(tube.getPointAt(b)) / angle / MM > 17, 'dip-tube bend radius exceeds tube wall radius');
}
t.near(elbow.getLength() / MM, 3 * Math.PI / 2 + 7, 1e-12, 'actuator length from quarter-circle plus straight outlet');
t.near(elbow.getPointAt(0).distanceTo(vector(point([0, 180, 0]))), 0, 1e-12, 'elbow meets stem end');
t.near(elbow.getPointAt(1).distanceTo(vector(point([10, 183, 0]))), 0, 1e-12, 'elbow meets nozzle entrance');
t.near(elbow.getTangentAt(0).dot(vector([0, 1, 0])), 1, 1e-12, 'stem and elbow tangent match');
t.near(elbow.getTangentAt(1).dot(vector([1, 0, 0])), 1, 1e-12, 'elbow and nozzle tangent match');

let rays = 0;
function ray(a, b, objects, expected, message) {
  const from = world(a), to = world(b), delta = to.sub(from);
  const hits = new THREE.Raycaster(from, delta.clone().normalize(), 0, delta.length()).intersectObjects(objects, true);
  t.ok(Boolean(hits.length) === expected, message);rays++;return hits;
}
for (const orientation of [0, 1]) for (const button of [0, 1]) {
  const s = reset({orientation, button}, 5), d = s.press;
  for (const sign of [-1, 1]) {
    ray([0, 165 - d, sign * 7], [0, 165 - d, 0], [p.gasketMesh], !button, 'gasket blocks both ports only when released');
    ray([0, 165 - d, sign * 7], [0, 165 - d, 0], [p.stemWall], false, 'actual radial port leads into stem');
    ray([.8, 165 - d, sign * 7], [.8, 165 - d, 0], [p.stemWall], true, 'stem material remains beside opening');
  }
  ray([0, 181 - d, 0], [0, 160 - d, 0], [p.stemWall], false, 'stem bore is hollow');
  ray([0, 161 - d, 0], [0, 156 - d, 0], [p.stemPlug], true, 'stem bottom is blind');
  ray([17, 183 - d, 0], [9, 183 - d, 0], [p.insert], false, 'nozzle bore connects to outlet');
  ray([17, 183 - d, .4], [9, 183 - d, .4], [p.insert], true, 'material narrows nozzle to small exit');
  ray([0, 143, 0], [0, 150, 0], [p.housingBase], false, 'tube opens through housing floor');
  ray([2, 143, 0], [2, 150, 0], [p.housingBase], true, 'floor supports chamber around inlet');
  ray([0, 163, 0], [0, 169, 0], [p.cupMesh], false, 'cup has sliding stem opening');
  for (const [curve, object, press] of [[tube, p.dipTube, 0], [elbow, p.elbow, d]]) for (let i = 1; i < 20; i++) {
    const u = i / 20, q = curve.getPointAt(u).divideScalar(MM), tangent = curve.getTangentAt(u);q.y -= press;
    ray(q.clone().addScaledVector(tangent, -.1).toArray(), q.clone().addScaledVector(tangent, .1).toArray(), [object], false, 'curved conduit centerline is open');
    ray(q.toArray(), q.clone().add(vector([0, 0, 2])).toArray(), [object], true, 'curved conduit has actual inner and outer walls');
  }
  // Physical centerline passes beneath the spring, around its seat, through
  // the newly uncovered radial port and into the blind stem bore.
  if (button) {
    const route = [[0, 146, 0], [0, 147.125, 0], [0, 147.125, 3.9], [0, 165 - d, 3.9], [0, 165 - d, 0], [0, 180 - d, 0]];
    for (let i = 1; i < route.length; i++) ray(route[i - 1], route[i], [p.housingWall, p.housingBase, p.gasketMesh, p.stemWall, p.stemPlug, p.springSeat, p.spring], false, 'chamber route clears solid geometry');
  }
  const path = p.spring.geometry.parameters.path;
  t.near(path.getPoint(0).y / MM - .25, 147, 1e-9, 'spring supported on chamber floor');
  t.near(path.getPoint(1).y / MM + .25, 156.5 - d, 1e-9, 'spring meets moving seat');
}

let poses = 0;
for (const propellant of [0, 1]) for (let temperature = 0; temperature <= 50; temperature += 5) for (const orientation of [0, 1]) for (const button of [0, 1, 2, 3]) {
  const values = {propellant, temperature, orientation, button};
  for (const clock of [0, 5, 10, 60, 120, 150, 180]) {
    const s = reset(values, clock), ref = sampleAerosol(values, clock);poses++;
    for (const key of ['P', 'T', 'V', 'U', 'sprayedProduct', 'heatAdded', 'energyOut']) t.near(s[key], ref[key], 1e-12, 'mesh state agrees with conservation model: ' + key);
    t.near(s.left + s.totalOut, s.start, 1e-10, 'displayed total-mass account closes');
    assert.equal(s.press, s.down ? VALVE.travel : 0);
    t.near(p.holder.rotation.z, orientation ? Math.PI : 0, 1e-12, 'all physical parts invert together');
    t.near(p.stem.position.y / MM, -s.press, 1e-12, 'stem translates with button');
    t.near(p.actuator.position.y, p.stem.position.y, 1e-12, 'actuator socket stays joined to stem');
    const liquidVolume = s.upright ? volumeBelow(s.level) : BRIMFUL - volumeBelow(s.level);
    t.near(liquidVolume, s.V * 1e9, 1e-7, 'free-surface height follows remaining volume');
    t.near(meshVolume(p.liquid.geometry), s.V * 1e9, .003 * s.V * 1e9 + 45, 'actual liquid mesh represents inventory');
    for (const dot of p.gasDots) if (dot.visible) {
      const q = dot.position.clone().divideScalar(MM), radius = Math.hypot(q.x, q.z);
      t.ok(radius + .4 < radiusAt(q.y), 'headspace markers stay inside wall');
      t.ok(s.upright ? q.y - .4 > s.level : q.y + .4 < s.level, 'headspace markers lie on gas side of surface');
    }
    if (!s.down || !s.volumeRate && !s.gasRate) t.ok([...p.flowDots, ...p.sprayDots].every(dot => !dot.visible), 'closed or depressurized valve has no moving discharge markers');
    else t.ok(p.flowDots.every(dot => dot.visible) && p.sprayDots.some(dot => dot.visible), 'open pressurized route has visible discharge');
    const line = p.pressureLine.geometry.attributes.position;
    for (const i of [0, 20, 120, 240, 360]) {
      t.near(line.getX(i) / MM, -100 + s.plan.samples[i].t / 180 * 200, 1e-5, 'history time axis');
      t.near(line.getY(i) / MM, -65 + (s.plan.samples[i].P - C.atmosphere) / 1.2e6 * 150, 1e-5, 'history pressure axis');
    }
    t.near(p.cursor.geometry.attributes.position.getX(0) / MM, -100 + clock / 180 * 200, 1e-5, 'cursor marks current time');
    t.near(p.temperatureDot.position.x / MM, -100 + temperature / 50 * 200, 1e-10, 'temperature marker shows selected fresh charge');
    t.near(p.temperatureDot.position.y / MM, -65 + (s.plan.initial.P - C.atmosphere) / 1.2e6 * 150, 1e-10, 'temperature marker uses initial rather than current pressure');
    if (clock === 5) checkFinite(m.root, t);
  }
}
for (let temperature = 0; temperature <= 50; temperature++) for (const propellant of [0, 1]) {
  const pressure = aerosolEquilibrium(aerosolInitialAmounts({propellant}), temperature + 273.15).P, line = propellant ? p.nitrogenLine : p.liquefiedLine;
  t.near(line.geometry.attributes.position.getY(temperature) / MM, -65 + (pressure - C.atmosphere) / 1.2e6 * 150, 1e-5, 'fresh-charge temperature curve');
}
const expected = [{product: 0, massRate: 0}, {product: 5.72, massRate: 2.371}, {}, {}, {product: 62.45, gauge: 3.21, temperature: 18.64}, {product: 117.97, gasRate: .093}, {product: 117.97}, {}, {gauge: 1.47, massRate: 1.561}, {gauge: 8.37, massRate: 0}, {product: 0, temperature: 15.22}, {product: 0, gauge: 0}, {product: 11.44, massRate: 0}, {}, {}, {}];
assert.equal(lesson.tryIt.length, expected.length);
for (const [i, trial] of lesson.tryIt.entries()) for (const prior of [{button: 0, temperature: 50}, {propellant: 1, orientation: 1, temperature: 0}]) {
  reset(prior, 160);m.reset(trial.initialState);m.update(trial.values);const s = m.getState();
  assert.equal(s.clock, trial.initialState.time);assert.deepEqual(s.values, trial.values);
  const round = (n, digits = 2) => Number(n.toFixed(digits));
  const actual = {product: round(s.sprayedProduct * 1000), gauge: round(s.gauge / 1e5), temperature: round(s.T - 273.15), massRate: round(s.massRate * 1000, 3), gasRate: round(s.gasRate * 1000, 3)};
  for (const [key, value] of Object.entries(expected[i])) t.near(actual[key], value, 0, trial.title + ': ' + key);
  t.ok(m.parts.some(part => part.id === trial.part), 'preset has valid inspection target');
}
for (const action of m.actions) {reset({temperature: 5, orientation: 1}, 60);const before = core(m.getState());action.run();assert.deepEqual(core(m.getState()), before, 'inspection preserves elapsed time and inventories');t.ok(m.parts.some(part => part.id === action.part), 'action target exists');}
reset();m.playback.step();t.near(m.getState().clock, 5, 0, 'step advances five simulated seconds');m.advance(1);t.near(m.getState().clock, 11, 0, 'playback advances six simulated seconds per second');
m.advance(100);assert.equal(m.playback.complete(), true);const complete = core(m.getState());m.advance(1);assert.deepEqual(core(m.getState()), complete);
const replay = m.replayState();m.reset(replay);m.update(replay.settings);assert.equal(m.getState().clock, 0);assert.equal(m.getState().sprayedProduct, 0);
reset({}, 60);m.update({temperature: 50});assert.equal(m.getState().clock, 0);assert.equal(m.getState().sprayedProduct, 0);
for (const bad of [-1, 181, Infinity, NaN]) assert.throws(() => m.reset({time: bad}), RangeError);
checkControlsMove(m, () => [m.getState().P, p.holder.rotation.z, p.stem.position.y, p.gasDots[0].material.color.getHex()], model => model.advance(25), t);
t.ok(m.controls.find(c => c.key === 'propellant').primary, 'propellant selector visible immediately');
for (const chart of [p.pressureChart, p.temperatureChart, p.sealContact]) t.ok(chart.userData.inspectionOnly && chart.userData.explosionExcluded, 'inspection diagrams excluded from physical inventory');

let layouts = 0;const groupCounts = [];
for (const values of [{}, {orientation: 1}, {button: 0}]) for (const aspect of [1, 1.24]) {
  const model = createAerosolCanModel();model.reset({settings: {...D, ...values}, time: 60});model.update({...D, ...values});const before = JSON.stringify(core(model.getState()));
  const {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect);explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const box = new THREE.Box3();for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse));return box;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'grouped physical parts do not overlap');
  groupCounts.push(boxes.length);explosion.update(0);explosion.dispose();assert.equal(JSON.stringify(core(model.getState())), before);model.dispose();layouts++;
}
const resources = checkDisposal(m, t);
console.log(`PASS aerosol model: ${t.count} checks; ${poses} poses; ${rays} passage/wall rays; ${lesson.tryIt.length * 2} preset checkpoints; ${layouts} separated layouts (${groupCounts.join(',')} parts); ${resources} resources.`);

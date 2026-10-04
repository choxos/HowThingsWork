import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createUprightVacuumModel, uprightChartPoint} from './upright-vacuum-model.js';
import {UPRIGHT as C, UPRIGHT_DEFAULTS as D, sampleUpright} from './upright-vacuum-physics.js';
import {bagPoint} from './upright-vacuum-geometry.js';
import {uprightVacuumLesson as lesson} from './upright-vacuum-lesson.js';
import {tally, checkFinite, checkDisposal, checkControlsMove} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), m = createUprightVacuumModel(), p = m.topology, {MM, UG, paths} = p;
const mm = a => a.map(n => n * MM), vector = a => new THREE.Vector3(...a);
const world = (parent, a) => parent.localToWorld(vector(mm(a)));
const nearVector = (a, b, message, tolerance = 1e-8) => t.near(a.distanceTo(b), 0, tolerance, message);
const reset = (values = {}, time = 0) => {const settings = {...D, ...values};m.reset({settings, time});m.update(settings);m.root.updateMatrixWorld(true);return m.getState();};
const core = s => [s.clock, s.values, s.flow, s.pressure, s.volume, s.airEnergy, s.bound, s.loose, s.inTransit, s.collected];
m.root.position.set(.2, -.3, .4);m.root.rotation.set(.1, -.25, .2);reset();

// Exact belt geometry, checked against independent analytic length and
// numerical tangents. Both pulley centers and each wrap radius are inspected.
const belt = p.beltPath, centerDistance = Math.hypot(155, 65), beta = Math.asin(16 / centerDistance);
const independentLength = 2 * Math.sqrt(centerDistance ** 2 - 16 ** 2) + Math.PI * 32 + 32 * beta;
t.near(belt.length, independentLength, 1e-10, 'independent open-belt length');
let measuredLength = 0;
for (let i = 1; i <= 20000; i++) measuredLength += vector(belt.at(i * belt.length / 20000).point).distanceTo(vector(belt.at((i - 1) * belt.length / 20000).point));
t.near(measuredLength, independentLength, .0001, 'drawn belt length');
for (const section of belt.sections) {
  const start = belt.at(section.offset + 1e-7), end = belt.at(section.offset + section.length - 1e-7);
  const after = belt.at(section.offset + section.length + 1e-7);
  t.near(vector(end.tangent).dot(vector(after.tangent)), 1, 1e-8, 'belt tangent is continuous at each join');
  if (section.type === 'arc') for (let i = 1; i < 50; i++) {
    const state = belt.at(section.offset + section.length * i / 50), dx = state.point[0] - section.center[0], dy = state.point[1] - section.center[1];
    t.near(Math.hypot(dx, dy), section.radius, 1e-10, 'belt centerline follows pulley pitch radius');
    nearVector(vector(state.tangent).negate(), vector([-dy / section.radius, dx / section.radius, 0]), 'backward belt motion agrees with positive shaft rotation');
  } else {
    t.near(vector(start.tangent).dot(vector(start.normal)), 0, 1e-12, 'straight belt has perpendicular surface normal');
    for (const center of [belt.a, belt.b]) {const q = [start.point, end.point].sort((a, b) => Math.hypot(a[0] - center[0], a[1] - center[1]) - Math.hypot(b[0] - center[0], b[1] - center[1]))[0];t.near((q[0] - center[0]) * start.tangent[0] + (q[1] - center[1]) * start.tangent[1], 0, 1e-5, 'line touches pulley tangentially');}
  }
}

// Fine centerline integration and physical tube clearance. The outlet must
// rise out of the tube before the markers turn toward the paper surface.
const samples = paths.curve.getSpacedPoints(10000);let length = 0;
for (let i = 1; i < samples.length; i++) length += samples[i].distanceTo(samples[i - 1]);
t.near(length, 750, .02, 'actual hollow duct matches pressure-loss length');
nearVector(samples[0], vector(UG.fanExit), 'duct joins collector');
nearVector(samples.at(-1), vector(bagPoint(0, paths.fill)), 'duct outlet stays inside bag');
t.near(paths.curve.getTangentAt(0).dot(vector([1, 0, 0])), 1, 1e-5, 'collector and duct entrance align');
t.near(paths.curve.getTangentAt(1).dot(vector([Math.sin(UG.lean), Math.cos(UG.lean), 0])), 1, 1e-5, 'fill tube aligns with bag axis');
t.ok(paths.fill > 100 && paths.fill + 70 < UG.bagHeight, 'tube and capture patch clear bag roof');
for (const v of samples) t.ok(v.y - 22 > UG.floorTop, 'tube wall clears floor');
for (let i = 1; i < 1000; i++) {
  const u = i / 1000, a = paths.curve.getTangentAt(u - .0001), b = paths.curve.getTangentAt(u + .0001), angle = a.angleTo(b);
  if (angle > 1e-7) {const distance = paths.curve.getPointAt(u - .0001).distanceTo(paths.curve.getPointAt(u + .0001));t.ok(distance / angle > 69.99, 'tube bend radius exceeds wall radius without folds');}
}
const coarse = samples.filter((_, i) => i % 25 === 0);
for (let i = 0; i < coarse.length; i++) for (let j = i + 30; j < coarse.length; j++) t.ok(coarse[i].distanceTo(coarse[j]) > 44, 'nonadjacent tube segments have clear walls');

let rays = 0;
function ray(parent, origin, target, objects, expected, message) {
  const a = world(parent, origin), b = world(parent, target), delta = b.clone().sub(a);
  const hits = new THREE.Raycaster(a, delta.clone().normalize(), 0, delta.length()).intersectObjects(objects, true);
  t.ok(Boolean(hits.length) === expected, message);rays++;return hits;
}
for (const [plate, rHole] of [[p.bagFloor, 22], [p.coverFloor, 23]]) {
  ray(plate, [0, 0, -10], [0, 0, 10], [plate], false, 'bag or cover floor has a true bore');
  ray(plate, [rHole + 3, 0, -10], [rHole + 3, 0, 10], [plate], true, 'bag or cover material surrounds its bore');
}
for (const [object, inner, outer] of [[p.eyePlate, 28, 74], [p.fanBack, 12, 74], [p.fanBearing, 5.05, 12], [p.bagCollar, 20, 26], ...p.motorBearings.map(x => [x, 5.05, 12]), ...p.brushBearings.map(x => [x, 5.05, 11])]) {
  ray(object, [0, -50, 0], [0, 50, 0], [object], false, 'annular bore is open');
  ray(object, [(inner + outer) / 2, -50, 0], [(inner + outer) / 2, 50, 0], [object], true, 'annular wall exists');
}
for (let i = 0; i <= 20; i++) {
  const u = .005 + .99 * i / 20, center = paths.curve.getPointAt(u), tangent = paths.curve.getTangentAt(u), normal = vector([0, 0, 1]);
  const before = center.clone().addScaledVector(tangent, -3), after = center.clone().addScaledVector(tangent, 3);
  ray(p.body, before.toArray(), after.toArray(), [p.ductMesh], false, 'actual tube centerline is open');
  ray(p.body, center.toArray(), center.clone().addScaledVector(normal, 26).toArray(), [p.ductMesh], true, `hollow tube has inner and outer walls at ${u}`);
}
for (const z of [-149, -100, 0, 100, 149]) {
  ray(p.body, [-184, 8, z], [-168, 8, z], [p.frontWall], false, 'working-height inlet slot is open');
  ray(p.body, [-184, 16, z], [-168, 16, z], [p.frontWall], true, 'front lip exists above slot');
}
reset({seal: 1});
for (const radius of [8, 18, 26]) ray(p.body, [45 + radius, 100, -32], [45 + radius, 100, -20], [p.gatePlate], true, 'closed gate seals annular eye');
ray(p.body, [45, 100, -32], [45, 100, -20], [p.gatePlate], false, 'gate leaves shaft bore');
for (const segment of paths.dust[0][0].route.segments.filter(s => ['bag entry jet', 'capture on paper'].includes(s.label))) ray(p.body, segment.a, segment.b, [p.ductMesh], false, 'dust exits tube before crossing toward paper');

// Independent walk by physical duration in each section, rather than the
// runtime displaced-volume interpolation used by tracePoint().
function transported(route, Q, elapsed) {
  let remaining = elapsed;
  for (const segment of route.segments) {
    if (Q === 0) return segment.a;
    const duration = Math.hypot(...segment.b.map((v, k) => v - segment.a[k])) / 1000 * segment.area / Q;
    if (remaining < duration) return segment.a.map((v, k) => v + (segment.b[k] - v) * remaining / duration);
    remaining -= duration;
  }
  return route.segments.at(-1).b;
}
let poses = 0, markers = 0;
for (const height of [0, 1]) for (const belt of [0, 1]) for (const seal of [0, 1]) for (let bag = 1; bag <= 4; bag += .5) for (const cover of [0, 1]) for (const motor of [0, 1]) {
  const values = {height, belt, seal, bag, cover, motor};let previous = 0;
  for (const clock of [0, 1, 3, 15, 60, 90]) {
    const s = reset(values, clock), expected = sampleUpright(values, clock);poses++;
    t.ok(s.bound + s.loose + s.inTransit + s.collected === 12, 'sample always conserved');
    t.ok(s.collected >= previous, 'retained dust never respawns');previous = s.collected;
    for (const key of ['flow', 'pressure', 'volume', 'airEnergy', 'motorAngle', 'brushAngle']) t.near(s[key], expected[key], 1e-12, 'state matches independent physical module: ' + key);
    for (const object of [p.impeller, p.shaft, p.rotor, p.pulleys[0]]) t.near(object.rotation.z, s.motorAngle, 1e-12, 'common shaft angle');
    for (const object of [p.roller, p.pulleys[1]]) t.near(object.rotation.z, s.brushAngle, 1e-12, 'brush shaft angle');
    t.near(p.body.position.y / MM, height * 12, 1e-12, 'whole mechanism raises together');
    p.wheels.forEach((wheel, i) => {const a = m.root.worldToLocal(wheel.getWorldPosition(new THREE.Vector3()));t.near(a.y / MM, 30, 1e-8, 'wheel remains on floor');nearVector(wheel.getWorldPosition(new THREE.Vector3()), p.wheelAxles[i].getWorldPosition(new THREE.Vector3()), 'wheel axle remains centered');});
    assert.equal(p.gate.visible, Boolean(seal));assert.equal(p.beltMesh.visible, Boolean(belt));
    p.grains.forEach((grain, i) => {
      const trace = paths.dust[height][i], release = s.releaseTimes[i], elapsed = release === null ? 0 : Math.max(0, clock - release) / 300;
      nearVector(grain.position, vector(mm(transported(trace.route, s.flow, elapsed))), 'independent transported marker position');markers++;
      if (s.markerStates[i].state === 'collected') {const local = p.bag.worldToLocal(grain.getWorldPosition(new THREE.Vector3())).divideScalar(MM);t.ok(Math.abs(local.x) < 97 && local.y > 3 && local.y < UG.bagHeight - 3, 'captured marker lies inside bag');t.near(local.z, -52, 1e-8, 'enlarged marker touches inner paper surface');}
      if (s.markerStates[i].state === 'bound') {const local = m.root.worldToLocal(grain.getWorldPosition(new THREE.Vector3())).divideScalar(MM);t.near(local.y, 8, 1e-8, 'bound dust stays on carpet as head rises');}
    });
    if (!s.flow) {t.ok(p.dots.every(dot => !dot.visible), 'no air tracers without flow');t.ok(s.collected === 0 && s.inTransit === 0, 'no dust transport without flow');}
    if (clock === 90 && s.flow > 0) t.ok(s.collected === (s.brushActive ? 12 : 6), 'complete trial retains every mobile marker');
    nearVector(p.operatingDot.position, vector(uprightChartPoint(s.flow, s.pressure)), 'chart dot shows operating point');
    if (clock === 3) checkFinite(m.root, t);
  }
}
const expectedTrials = [{collected: 12}, {bound: 3, inTransit: 9}, {inTransit: 12}, {bound: 6, collected: 6}, {bound: 6, collected: 6}, {bound: 0, loose: 12}, {flow: 0, pressure: 5, force: 11.92}, {bound: 6, loose: 6}, {flow: 18.13, pressure: 3.66}, {collected: 12}, {collected: 12, flow: 22.74, coverPressure: 1.37}, {collected: 12, flow: 16.32, pressure: 3.91}, {flow: 18.13, pressure: 3.66}, {pressure: 3.91}, {}, {}];
assert.equal(lesson.tryIt.length, expectedTrials.length);
for (const [i, trial] of lesson.tryIt.entries()) for (const prior of [{motor: 0, seal: 1}, {belt: 0, height: 1, bag: 4, cover: 1}]) {
  reset(prior, 60);m.reset(trial.initialState);m.update(trial.values);const s = m.getState();
  assert.deepEqual(s.values, trial.values);assert.equal(s.clock, trial.initialState.time);
  const rounded = n => Number(n.toFixed(2)), observed = {bound: s.bound, loose: s.loose, inTransit: s.inTransit, collected: s.collected, flow: rounded(s.flow * 1000), pressure: rounded(s.pressure / 1000), coverPressure: rounded(s.coverPressure / 1000), force: rounded(s.holdingForce)};
  for (const [key, value] of Object.entries(expectedTrials[i])) t.near(observed[key], value, 0, trial.title + ': ' + key);
  t.ok(m.parts.some(part => part.id === trial.part), 'experiment inspection target exists');
}
for (const action of m.actions) {reset({height: 1, bag: 4}, 60);const before = core(m.getState());action.run();assert.deepEqual(core(m.getState()), before, 'inspection preserves experiment');t.ok(m.parts.some(part => part.id === action.part), 'action target exists');}
reset();m.playback.step();t.near(m.getState().clock, 1, 0, 'one trace second per step');m.advance(1);t.near(m.getState().clock, 4, 0, '3x playback');
m.advance(100);assert.equal(m.playback.complete(), true);const complete = p.grains.map(g => g.position.toArray());m.advance(1);assert.deepEqual(p.grains.map(g => g.position.toArray()), complete);
const replay = m.replayState();m.reset(replay);m.update(replay.settings);assert.equal(m.getState().clock, 0);assert.equal(m.getState().bound, 6);assert.equal(m.getState().loose, 6);
reset({}, 60);m.update({bag: 4});assert.equal(m.getState().clock, 0);assert.equal(m.getState().volume, 0);assert.equal(m.getState().airEnergy, 0);
for (const bad of [-1, 91, Infinity, NaN]) assert.throws(() => m.reset({time: bad}), RangeError);
checkControlsMove(m, () => [p.beltMesh.visible, p.body.position.y, p.gate.visible, p.bagPaper[0].material.color.getHex(), p.coverMeshes[0].material.color.getHex(), p.impeller.rotation.z], model => model.advance(1.1), t);
t.ok(m.controls.find(c => c.key === 'belt').primary, 'brush drive visible immediately');

let layouts = 0;const groupCounts = [];
for (const values of [{}, {belt: 0}, {seal: 1}, {height: 1}]) for (const aspect of [1, 1.24]) {
  const model = createUprightVacuumModel();model.reset({settings: {...D, ...values}, time: 60});model.update({...D, ...values});const before = JSON.stringify(core(model.getState()));
  const {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect);explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const box = new THREE.Box3();for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse));return box;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'grouped physical parts do not overlap');
  groupCounts.push(boxes.length);explosion.update(0);explosion.dispose();assert.equal(JSON.stringify(core(model.getState())), before);model.dispose();layouts++;
}
const resources = checkDisposal(m, t);m.dispose();
console.log(`PASS upright vacuum model: ${t.count} checks; ${poses} poses; ${markers} independently walked dust positions; ${rays} opening/wall rays; ${lesson.tryIt.length * 2} preset checkpoints; ${layouts} separated layouts (${groupCounts.join(',')} parts); ${resources} resources.`);

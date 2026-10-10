import assert from 'node:assert/strict';
import {FrontSide, Matrix4, Vector3} from 'three';
import {createLaserScanningModel, BENCH, PROFILE, SENSOR, CHART} from './laser-scanning-model.js';
import {SCAN_DEFAULTS, SCAN_DOMAINS, scanPlan} from './printing-physics.js';
import {laserScanningLesson as lesson} from './printing-lessons.js';
import {checkFinite, checkDisposal} from './model-check-kit.mjs';

let poses = 0, cloudPoints = 0, rayVertices = 0;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2e-6 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const vectorNear = (actual, expected) => expected.forEach((n, i) => near(actual[i], n));
const linePoints = line => {
  const count = line.geometry.drawRange.count, p = line.geometry.attributes.position;
  assert.ok(Number.isFinite(count) && count <= p.count);
  return Array.from({length: count}, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)]);
};
const m = createLaserScanningModel(), t = m.topology, matrix = new Matrix4();
const dot = (mesh, i) => { mesh.getMatrixAt(i, matrix); return new Vector3().setFromMatrixPosition(matrix); };
function pose() {
  const s = m.getState(), n = s.now; poses++;
  checkFinite(m.root);
  assert.ok(s.readings.every(r => !/NaN|Infinity|undefined/.test(r.value)));
  assert.equal(m.playback.complete(), s.clock >= 6);
  assert.equal(m.resultPart.available(), s.clock >= 6);
  vectorNear(t.targetBase.scale.toArray(), [24 * BENCH, 2 * BENCH, 24 * BENCH]);
  vectorNear(t.ridgeBlock.scale.toArray(), [12 * BENCH, Math.max(s.ridge, 1e-9) * BENCH, 4 * BENCH]);
  assert.equal(t.ridgeBlock.visible, s.ridge > 0);
  near(t.ridgeBlock.position.y, s.ridge / 2 * BENCH);
  near(t.target.position.z, (12 - s.clock * 4) * BENCH);
  near(t.laserHead.position.z, 0);
  near(t.receiverHead.position.z, -s.sideSign * s.baseline * BENCH);
  assert.ok(Math.abs(t.receiverHead.position.z) >= 4 * BENCH, 'camera remains outside the laser plane');
  near(PROFILE / BENCH, 3);
  assert.equal(t.cloudDots.count, n.held);
  n.cloud.forEach((point, i) => {
    const position = dot(t.cloudDots, i); vectorNear(position.toArray(), point.map(x => x * PROFILE));
    assert.ok(t.cloudDots.boundingBox.containsPoint(position));
    assert.ok(t.cloudDots.boundingSphere.containsPoint(position)); cloudPoints++;
  });
  if (s.clock === 0) {
    assert.equal(n.held, 0); assert.equal(t.cloudDots.boundingBox.isEmpty(), true);
    assert.equal(t.profileDots.count + t.missedDots.count, 0);
    assert.equal(linePoints(t.spotLine).length + linePoints(t.readLine).length, 0);
  } else if (n.profiles > 1) {
    assert.ok(new Set(n.cloud.map(point => point[2])).size > 1, 'acquired profiles occupy distinct Z positions');
  }
  const map = point => [point[0] * BENCH, point[1] * BENCH, (point[2] - n.position) * BENCH];
  const samples = s.clock ? n.current.samples : [];
  const expectedLines = [samples.flatMap(p => [p.laser, p.laserEnd]), samples.filter(p => p.lit && p.seen).flatMap(p => [p.target, p.receiver]), samples.filter(p => p.lit && !p.seen).flatMap(p => [p.receiver, p.receiverEnd])];
  [t.laserRays, t.seenRays, t.blockedRays].forEach((line, i) => {
    const points = linePoints(line); assert.equal(points.length, expectedLines[i].length);
    points.forEach((p, j) => { vectorNear(p, map(expectedLines[i][j])); rayVertices++; });
  });
  const profile = n.detailProfile, accepted = profile?.samples.filter(p => p.point) || [], missed = profile?.samples.filter(p => !p.point) || [];
  assert.equal(t.profileDots.count, accepted.length); assert.equal(t.missedDots.count, missed.length);
  accepted.forEach((p, i) => vectorNear(dot(t.profileDots, i).toArray(), [p.point[0] * PROFILE, -.25 + p.point[1] * PROFILE, .005]));
  missed.forEach((p, i) => vectorNear(dot(t.missedDots, i).toArray(), [p.x * PROFILE, -.4, .005]));
  const outline = linePoints(t.profileOutline);
  assert.equal(outline.length, profile ? 6 : 0);
  if (profile) {
    const h = Math.abs(profile.z) <= 2 ? s.ridge : 0;
    [[-12,0],[-6,0],[-6,h],[6,h],[6,0],[12,0]].forEach(([x,y], i) => vectorNear(outline[i], [x * PROFILE, -.25 + y * PROFILE, 0]));
  }
  const grid = linePoints(t.sensorGrid); assert.equal(grid.length, (s.subpixel + 1) * 2);
  grid.forEach((point, i) => vectorNear(point, [-SENSOR.width / 2 + Math.floor(i / 2) / s.subpixel * SENSOR.width, (i % 2 ? 1 : -1) * SENSOR.high / 2, .001]));
  const image = s.middle?.image, reached = s.middle?.reached, whole = image ? Math.round(image[1] / s.pixel) : 0;
  for (const [line, coordinate, half, z] of [[t.spotLine, image, .36, .003], [t.readLine, reached, .31, .004]]) {
    const points = linePoints(line); assert.equal(points.length, coordinate ? 2 : 0);
    if (coordinate) points.forEach((point, i) => vectorNear(point, [(coordinate[1] / s.pixel - whole) * SENSOR.width, (i ? 1 : -1) * half, z]));
  }
  near(s.magnification, SENSOR.width / s.pixel / BENCH);
  assert.equal(t.sensorScale.userData.labelText, `Pixel close-up: ${s.magnification.toFixed(0)}× the bench scale`);
  const curve = linePoints(t.resolutionCurve); assert.equal(curve.length, CHART.samples);
  curve.forEach((point, i) => {
    const depth = 53.5 + 25 * i / (CHART.samples - 1), microns = depth ** 2 * s.grid / (20 * s.baseline) * 1000;
    vectorNear(point, [CHART.x + i / (CHART.samples - 1) * CHART.w, CHART.y + (Math.log10(microns) + 1) / 4 * CHART.h, 0]);
    assert.ok(point[1] >= CHART.y - 1e-6 && point[1] <= CHART.y + CHART.h + 1e-6, 'fixed chart scale contains every supported curve');
  });
  return s;
}

assert.deepEqual(m.controls.map(c => c.key), Object.keys(SCAN_DEFAULTS));
assert.deepEqual(m.catalogParts.map(p => p.name).sort(), lesson.parts.map(p => p.name).sort());
assert.equal(m.parts.length, 6); assert.equal(m.catalogParts.length, 5);
t.system.traverse(o => { if (o.userData.textLabel) assert.equal(o.material.side, FrontSide); });
for (const id of ['profile', 'sensor', 'chart']) assert.deepEqual(m.inspectionObjects(id), [t[id]]);
for (const p of m.catalogParts) assert.equal(p.parentId, 'system');
pose();
for (const time of [1e-8, .25, 1, 2.5, 3, 3.5, 5.99, 6]) { m.reset(); m.advance(time); pose(); }
let controlValues = 0;
for (const [key, [min, max, step]] of Object.entries(SCAN_DOMAINS)) for (let value = min; value <= max + 1e-9; value += step) {
  m.reset(); m.update({[key]: value}); pose(); m.advance(3); pose(); m.advance(3); pose(); controlValues++;
}
for (let bits = 0; bits < 128; bits++) {
  m.reset(); m.update(Object.fromEntries(Object.entries(SCAN_DOMAINS).map(([key, domain], i) => [key, domain[(bits >> i) & 1]]))); m.advance(6); pose();
}
const outcomes = [[625,0,5.9999],[625,0,6.0232],[612,13,6.0008],[625,0,5.9999],[625,0,5.9998],[600,25,12.0001],[600,25,12.0001],[625,0,-.0006],[49,0,12.0001],[560,65,null]];
for (let i = 0; i < lesson.tryIt.length; i++) {
  const trial = lesson.tryIt[i];
  assert.deepEqual(Object.keys(trial.values), Object.keys(SCAN_DEFAULTS)); assert.equal(trial.reset, true);
  assert.equal(trial.isolate, trial.part !== 'system'); assert.equal(trial.view, 'front'); assert.ok(m.parts.some(p => p.id === trial.part));
  m.reset(); m.update(trial.values); assert.equal(m.getState().clock, 0); m.advance(6);
  const s = pose(); assert.deepEqual([s.now.held, s.now.gaps], outcomes[i].slice(0,2), trial.title);
  if (outcomes[i][2] === null) assert.equal(s.middle.point, null); else assert.ok(Math.abs(s.middle.measured - outcomes[i][2]) < .001, trial.title);
}
let histories = 0;
for (const before of lesson.tryIt) for (const after of lesson.tryIt) {
  m.reset(); m.update(before.values); m.advance(6); m.reset(); m.update(after.values);
  assert.equal(m.getState().now.held, 0); assert.equal(m.getState().clock, 0);
  m.advance(6); assert.deepEqual(m.getState().now.cloud, scanPlan(after.values).samples.filter(p => p.point).map(p => p.point)); histories++;
}
for (const action of m.actions) {
  m.reset(); action.run(); assert.equal(m.getState().clock, 0); assert.equal(m.getState().now.held, 0);
  m.advance(3); const before = m.getState().now; action.run(); assert.deepEqual(m.getState().now, before, 'inspection preserves actual acquisition');
}
m.reset(); m.advance(6); m.update({ridge: 12}); assert.equal(pose().clock, 0);
m.advance(3); m.update({ridge: 12}); assert.equal(m.getState().clock, 3, 'same value preserves progress');
for (const dt of [0, -1, NaN, Infinity]) { m.advance(dt); assert.equal(m.getState().clock, 3); }
for (const [key, value] of Object.entries({standoff:NaN, baseline:Infinity, pixel:.4, subpixel:.3, spacing:.5, side:.5})) {
  const before = m.getState(); m.update({[key]:value}); assert.deepEqual(m.getState().values, before.values); assert.equal(m.getState().clock, before.clock);
}
m.update({ridge:999}); assert.equal(m.getState().values.ridge, 12); m.update({ridge:-999}); assert.equal(m.getState().values.ridge, 0);
const partitions = [[6], [1,2,3], Array(60).fill(.1)]; let final;
for (const steps of partitions) { m.reset(); m.update({ridge:12,side:1}); for (const dt of steps) m.advance(dt); const s = pose(); if (final) assert.deepEqual(s.now.cloud, final); final = s.now.cloud; }
m.reset(); m.animate(1); m.animate(2); assert.equal(m.getState().clock, 2); m.reset(); m.playback.step(); assert.equal(m.getState().clock, 1);
for (let i = 0; i < 80; i++) scanPlan({standoff:53.5 + (i % 51) * .5, baseline:4 + Math.floor(i / 51)});
m.advance(1); assert.equal(m.getState().clock, 2, 'cache eviction does not reset acquisition');
const resourcesDisposed = checkDisposal(m);
console.log(JSON.stringify({ok:true, poses, cloudPoints, rayVertices, controlValues, presets:lesson.tryIt.length, histories, resourcesDisposed}));

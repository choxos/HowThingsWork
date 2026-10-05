import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadTrackingModel} from './head-tracking-model.js';
import {TRACKING_DEFAULTS as D, TRACKING_DOMAINS, sampleHeadTracking} from './head-tracking-physics.js';
import {headTrackingLesson as lesson} from './head-tracking-lesson.js';
import {houseComponents} from './house-components.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';

const t = tally(), near = (a, b, label, tolerance = 2e-10) => t.near(a, b, tolerance, label);
// Independent assigned trajectory and a closed-form weighted sum of errors.
// This does not iterate the implementation's angle-estimate recurrence.
function yaw(motion, time) {
  if (motion === 2 || time <= .5) return 0;
  if (motion === 0) {const u = Math.min(1, time - .5); return 60 * (10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5);}
  if (time >= 3) return 0;
  const sequence = [0, 25, -25, 25, -25, 0], j = Math.min(4, Math.floor((time - .5) / .5));
  const u = (time - .5 - j * .5) / .5;
  return sequence[j] + (sequence[j + 1] - sequence[j]) * (10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5);
}
function referenceError(values, k) {
  const gain = [0, .0001, .01][values.correction], q = 1 - gain;
  if (!gain) return values.offset * k / 1000 + values.scale / 100 * yaw(values.motion, k / 1000);
  let total = 0;
  for (let j = 1; j <= k; j++) {
    const current = yaw(values.motion, j / 1000), previous = yaw(values.motion, (j - 1) / 1000);
    const camera = yaw(values.motion, Math.floor(j * 60 / 1000) / 60);
    total += q ** (k - j) * (q * (values.offset / 1000 + values.scale / 100 * (current - previous)) + gain * (camera - current));
  }
  return total;
}
let independentCases = 0;
const stages = [0, 1, 16, 17, 33, 34, 49, 50, 499, 500, 501, 999, 1000, 1016, 1017, 1099, 1449, 1500, 2999, 3000];
for (const motion of [0, 1, 2]) for (const offset of [-2, 0, 2]) for (const scale of [-3, 0, 3]) for (const correction of [0, 1, 2]) {
  const values = {motion, offset, scale, correction};
  for (const k of stages) {
    const {tracking: s} = sampleHeadTracking(values, k / 1000), expectedError = referenceError(values, k);
    const head = yaw(motion, k / 1000), prevHead = yaw(motion, Math.max(0, k - 1) / 1000);
    const rate = k ? offset + (1 + scale / 100) * (head - prevHead) * 1000 : offset;
    const previous = prevHead + referenceError(values, Math.max(0, k - 1));
    near(s.truth, head, 'independent true direction'); near(s.error, expectedError, 'weighted-sum error');
    near(s.previous, previous, 'previous corrected direction'); near(s.rate, rate, 'interval-mean rate', 3e-7);
    near(s.increment, k ? rate / 1000 : 0, 'sample angle');
    near(s.integrated, previous + (k ? rate / 1000 : 0), 'before camera correction');
    near(s.estimate, head + expectedError, 'after camera correction');
    near(s.integrated + s.correction, s.estimate, 'visible arithmetic preserves the weighted average');
    const imageTime = Math.floor(k * 60 / 1000) / 60;
    near(s.camera, yaw(motion, imageTime), 'camera observes capture-time yaw');
    near(s.cameraTime, imageTime, 'held image timestamp'); near(s.cameraAge, k / 1000 - imageTime, 'sample-time image age');
    assert(s.cameraAge >= -1e-12 && s.cameraAge < 1 / 60);
    independentCases++;
  }
}
// Signed steady error and its finite-time geometric approach, both gains.
for (const offset of [-2, -.5, .5, 2]) for (const correction of [1, 2]) {
  const alpha = correction === 1 ? .0001 : .01, q = 1 - alpha, steady = q * offset / 1000 / alpha;
  for (const k of [1, 10, 100, 1000, 3000]) near(sampleHeadTracking({motion: 2, offset, correction}, k / 1000).tracking.error, steady * (1 - q ** k), 'stationary error follows the geometric series');
}
for (let k = 1; k <= 3000; k++) {
  assert.equal(sampleHeadTracking({}, k / 1000 - 1e-8).tracking.stage, k - 1);
  assert.equal(sampleHeadTracking({}, k / 1000).tracking.stage, k);
  assert.equal(sampleHeadTracking({}, k / 1000 + 1e-8).tracking.stage, k);
}
t.add(9000);
assert.equal(sampleHeadTracking({}, 10).tracking.stage, 3000);
checkRefusals(sampleHeadTracking, TRACKING_DOMAINS, t);

const model = createHeadTrackingModel(), registry = houseComponents['Head tracking'];
assert.equal(registry.createModel, createHeadTrackingModel); assert.equal(registry.lesson, lesson);
assert.equal(registry.part, 'system'); assert.equal(registry.view, 'front'); assert(registry.isolate);
assert.deepEqual(model.controls.map(c => c.key), Object.keys(D));
assert.deepEqual(model.controls.filter(c => c.primary).map(c => c.key), ['motion']);
assert.equal(model.parts.length, 23); assert.equal(model.actions.length, 8);
const luminance = hex => {
  const rgb = [hex >> 16, (hex >> 8) & 255, hex & 255].map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
};
const contrast = line => (luminance(0xfbf6e9) + .05) / (luminance(line.material.color.getHex()) + .05);
for (const line of model.topology.tracking.heading.lines) assert(contrast(line) >= 4.5, 'trace color also used by its small-text legend');
for (const plot of [model.topology.tracking.heading, model.topology.tracking.drift]) for (const line of [plot.axes, plot.cursor]) assert(contrast(line) >= 3, 'visible chart guides and sample cursor');

const namedStates = {
  'Start the tracker': s => assert.equal(s.stage, 0),
  'A reading during the turn': s => {near(s.estimate, 30, 'half-turn estimate');near(s.rate, 112.49970000036, 'peak interval rate');},
  'Add up the readings': s => {assert.equal(s.stage, 3000);near(s.estimate, 60, 'completed perfect turn');},
  'An offset': s => {near(s.truth, 0, 'still head');near(s.error, 1.5, 'positive offset');},
  'Reverse the offset': s => {near(s.increment, -.0005, 'negative sample');near(s.error, -1.5, 'negative offset');},
  'A scale error': s => {near(s.estimate, 61.8, '3 percent turn');near(s.error, 1.8, 'scale error');},
  'At the end of a swing': s => {near(s.truth, 25, 'first swing');near(s.estimate, 25.75, 'swing estimate');},
  'Shake it off': s => {near(s.truth, 0, 'returned head');near(s.error, 0, 'scale cancellation');},
  'A gentle pull': s => near(s.error, 1.295834864799363, 'finite gentle correction'),
  'A firm pull while still': s => {near(s.error, .0495, 'finite firm correction');near(s.correction, -.0005, 'offset balanced by correction');},
  'A firm pull during a turn': s => {assert.equal(s.stage, 1099);near(s.error, -.8337352868493753, 'largest lag with offset');},
  'Hold the camera measurement': s => {assert.equal(s.stage, 1016);near(s.camera, 30, 'held camera');near(s.cameraAge, .016, 'old camera age');assert(s.correction < 0);},
  'A fresh camera measurement': s => {assert.equal(s.stage, 1017);near(s.cameraTime, 61 / 60, 'new capture');near(s.cameraAge, 1 / 3000, 'fresh age');assert(s.correction > 0);},
  'Read the completed result': s => {assert.equal(s.stage, 3000);near(s.error, -.04014665894666081, 'default final result');},
};
assert.equal(lesson.tryIt.length, Object.keys(namedStates).length);
for (const trial of lesson.tryIt) {
  assert.deepEqual(Object.keys(trial.values), Object.keys(D)); assert(trial.reset && trial.isolate && trial.view === 'front');
  assert.deepEqual(trial.initialState.settings, trial.values); assert(model.parts.some(p => p.id === trial.part));
  model.reset(trial.initialState); const s = model.getState();
  namedStates[trial.title](s.tracking); assert.deepEqual(s.values, trial.values); assert.equal(s.clock, trial.initialState.time);
  assert.equal(s.readings.length, 9); assert(!/undefined|NaN|Infinity/.test(JSON.stringify(s.readings)));
  const [estimateLine] = model.topology.tracking.drift.lines;
  const positions = estimateLine.geometry.getAttribute('position');
  for (let k = 0; k < estimateLine.geometry.drawRange.count; k++) t.ok(positions.getY(k) >= -1.080001 && positions.getY(k) <= 1.120001, 'full drift trace fits its vertical scale');
}

let controlCases = 0;
for (const [key, [lo, hi, step]] of Object.entries(TRACKING_DOMAINS)) for (let i = 0; i <= Math.round((hi - lo) / step); i++) {
  const value = Number((lo + i * step).toFixed(6)), values = {...D, [key]: value};
  model.reset({time: 1.016}); model.update({[key]: value});
  const state = model.getState(); assert.equal(state.clock, 1.016); assert.deepEqual(state.values, values);
  near(state.tracking.error, referenceError(values, 1016), 'control effect agrees with weighted sum');
  assert.deepEqual(model.replayState(), {settings: values, time: 0});
  model.reset(model.replayState()); assert.equal(model.getState().tracking.stage, 0); assert.deepEqual(model.getState().values, values);
  controlCases++;
}
model.reset({settings: {motion: 1, offset: .5, scale: 3, correction: 2}, time: 1.016});
for (const action of model.actions) {
  const before = JSON.stringify(model.getState()); action.run(); assert.equal(JSON.stringify(model.getState()), before, action.label);
  assert.equal(action.replay, false); assert(action.isolate); assert(model.parts.some(part => part.id === action.part));
}
model.playback.step(); near(model.getState().clock, 1.026, 'step is ten simulated milliseconds');
model.advance(100); assert(model.playback.complete()); near(model.getState().clock, 3, 'completion stops at three seconds');
model.reset(model.replayState()); assert(!model.playback.complete()); assert.equal(model.getState().clock, 0);
for (const id of ['tracking-step', 'tracking-heading', 'tracking-drift']) {
  const part = model.parts.find(p => p.id === id); assert.equal(part.object.userData.inspectionOnly, id); assert(part.object.userData.explosionExcluded);
  assert.deepEqual(model.partViewDirections[id].front, [0, 0, 3]);
}
assert(!model.parts.some(p => ['timeline', 'errors', 'frames', 'view', 'optics', 'focus', 'sound'].includes(p.id)));
for (const [width, height] of [[760, 620], [360, 620]]) {
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .01, 100); camera.position.set(.7, 1.2, 3);camera.lookAt(0, 0, 0);camera.updateMatrixWorld();
  const before = JSON.stringify(model.getState()), explosion = createPartExplosion(model, camera, width / height, {width, height}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(category => category.id)), new Set(['headset', 'optical-module', 'electronic-module']));
  assert(!explosion.items.some(item => item.id.startsWith('tracking-') || ['wearer', 'camera', 'host', 'computer-links'].includes(item.id)));
  explosion.dispose(); assert.equal(JSON.stringify(model.getState()), before);
}
checkFinite(model.root, t); const resources = checkDisposal(model, t);
console.log(`PASS head tracking: ${t.count} checks, ${independentCases} independent weighted-sum cases, 9000 sample-boundary checks, ${lesson.tryIt.length} exact presets, ${controlCases} control values, ${model.actions.length} preserving actions, ${model.parts.length} parts, ${resources} resources released once.`);

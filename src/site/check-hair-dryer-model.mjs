import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHairDryerModel, DRYER, MM, CHART, COLORS, chartX, chartY, airColor} from './hair-dryer-model.js';
import {DRYER_DEFAULTS, DRYER_DOMAINS, DRYER_THERMAL, DRYER_AIR, dryerPlan, dryerAt} from './element-physics.js';
import {hairDryerLesson as lesson} from './element-lessons.js';
import {wireColor} from './element-scene.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {checkDisposal, checkFinite, tally} from './model-check-kit.mjs';

const model = createHairDryerModel(), T = model.topology, checks = tally();
const near = (a, b, tolerance, label) => assert(Math.abs(a - b) <= tolerance, `${label}: ${a} versus ${b}`);
const pose = (values = {}, seconds = 0) => { model.reset(); model.update(values); model.advance(seconds); model.root.updateMatrixWorld(true); return model.getState(); };
const linePoints = line => Array.from({length: Math.min(line.geometry.drawRange.count, line.geometry.attributes.position.count)}, (_, i) => new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position, i));
const bounds = object => new THREE.Box3().setFromObject(object);
const endpoint = (lead, last = false) => lead.geometry.parameters.path.points.at(last ? -1 : 0);
assert.deepEqual(model.controls.map(c => c.key), Object.keys(DRYER_DOMAINS));
for (const c of model.controls) assert.deepEqual([c.min, c.max, c.step, c.initial], [...DRYER_DOMAINS[c.key], DRYER_DEFAULTS[c.key]]);
assert.deepEqual(model.parts.filter(p => p.id !== 'system').map(p => p.name), lesson.parts.map(p => p.name));
assert(model.parts.every(p => p.description && (p.id === 'system' || p.parentId === 'system')));
assert.equal(model.parts.length, 11);
pose();
assert.equal(T.shell.geometry.type, 'CylinderGeometry'); assert.equal(T.grip.geometry.type, 'ExtrudeGeometry');
assert.equal(T.coil.geometry.type, 'TubeGeometry');
const size = bounds(T.shell).getSize(new THREE.Vector3());
near(size.x / MM, 200, 1e-5, 'barrel length'); near(size.y / MM, 78, 1e-5, 'barrel diameter');
assert(size.z / MM > 38, 'the half barrel has real depth');
assert(bounds(T.motorBody).max.x < bounds(T.rotor).min.x && bounds(T.rotor).max.x < bounds(T.coil).min.x, 'motor, fan and coil are ordered along the stream');
assert.equal(T.blades.length, 7);
for (const blade of T.blades) {
  const p = blade.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const world = blade.localToWorld(new THREE.Vector3().fromBufferAttribute(p, i));
    const local = T.fanPart.worldToLocal(world);
    assert(Math.hypot(local.y, local.z) / MM < 37, 'pitched blades clear the inner wall');
  }
}
let wireLength = 0, previous = T.wirePath.getPoint(0);
for (let i = 1; i <= 5000; i++) {
  const point = T.wirePath.getPoint(i / 5000); wireLength += previous.distanceTo(point); previous = point;
  near(Math.hypot(point.y, point.z) / MM, 23, 1e-10, 'coil radius');
  assert(Math.hypot(point.y, point.z) / MM + 0.6 < 37, 'drawn wire clears the wall');
}
near(wireLength / MM / 1000, 3.05, 0.0001, 'polygonal coil centerline length');
assert(90 / T.wirePath.turns > 1.2, 'enlarged adjacent turns do not collide');
near(T.coil.geometry.parameters.radius / MM, 0.6, 1e-12, 'wire drawing has threefold enlarged diameter');
near(endpoint(T.leads[3], true).distanceTo(T.wirePath.getPoint(0)), 0, 1e-12, 'live lead meets coil');
near(endpoint(T.leads[4]).distanceTo(T.wirePath.getPoint(1)), 0, 1e-12, 'neutral lead meets coil');
near(endpoint(T.leads[1]).distanceTo(endpoint(T.leads[2])), 0, 1e-12, 'motor and heater branches join after main switch');
near(endpoint(T.leads[0]).distanceTo(endpoint(T.leads[4], true)), 0, 1e-12, 'heater returns to supply');
assert(T.leads[4].geometry.parameters.path.points.some(p => p.distanceTo(endpoint(T.leads[5], true)) < 1e-12), 'motor joins the neutral return');
const clampBox = bounds(T.hairClamp);
for (const strand of T.strands) assert(clampBox.containsPoint(T.lock.localToWorld(strand.geometry.parameters.path.getPoint(0))), 'every hair strand starts inside its clamp');

const contactGap = () => T.cutPivot.localToWorld(new THREE.Vector3(23 * MM, 0, 0)).distanceTo(T.cutout.localToWorld(new THREE.Vector3(99 * MM, 47.5 * MM, 7 * MM)));
near(contactGap(), 0, 1e-12, 'closed bimetal contacts touch');
const motorAxis = () => new THREE.Vector3(1, 0, 0).applyQuaternion(T.rotor.quaternion);
let poses = 0, controlValues = 0;
for (const [key, [min, max, step]] of Object.entries(DRYER_DOMAINS)) for (let value = min; value <= max; value += step) {
  const input = {[key]: value}; controlValues++;
  const run = dryerPlan(input);
  for (const sample of run.track) { const now = dryerAt(run, sample.t); assert(now.outlet <= CHART.temperature[1] && now.hair <= CHART.temperature[1], 'temperature axis includes startup and completed states'); }
  for (const seconds of [0, 0.5, 1, 15, 30]) {
    const s = pose(input, seconds), n = s.now; poses++;
    assert.equal(n.t, seconds); assert.equal(n.power > 0, n.on);
    assert.deepEqual(motorAxis().toArray(), [1, 0, 0]);
    assert(T.coil.material.color.equals(wireColor(n.celsius)));
    assert.equal(T.obstruction.visible, Boolean(s.values.blocked));
    assert.equal(T.marks.every(m => m.visible), n.flow > 0);
    for (const [i, arrow] of T.airArrows.entries()) {
      assert.equal(arrow.userData.length > 0, n.flow > 0);
      arrow.traverse(o => { if (o.material) assert(o.material.color.equals(airColor(i ? n.outlet : s.values.room))); });
    }
    assert.equal(T.motorBody.material.color.getHex(), COLORS.motor, 'air marker colors do not alter the motor');
    if (n.closed) near(contactGap(), 0, 1e-12, 'closed contact geometry'); else assert(contactGap() / MM > 8, 'open contact gap');
    assert.equal(T.mainPivot.rotation.z === 0, seconds > 0);
    for (const drop of T.droplets) {
      assert.equal(drop.visible, n.water > 0);
      near(drop.scale.x ** 3, n.water / 0.00035, 1e-12, 'water marker volume follows remaining water');
    }
    assert.equal(T.vaporDots.every(dot => dot.visible), n.evaporation > 0);
    for (const {key: quantity, line} of T.curves) {
      const points = linePoints(line);
      assert.equal(points.length > 0, seconds > 0);
      assert(points.every(p => p.x <= chartX(s, n.t) + 1e-6), 'no future temperatures are drawn');
      if (points.length) {
        near(points.at(-1).x, chartX(s, n.t), 2e-6, 'chart ends at elapsed time');
        near(points.at(-1).y, chartY(n[quantity]), 2e-6, 'chart endpoint follows current state');
      }
    }
    assert(s.readings.every(r => !/NaN|undefined|Infinity|null/.test(r.value + (r.hint || ''))));
    if (seconds === 0 || seconds === 30) checkFinite(model.root, checks);
  }
}
pose({airflow: 20}, 2); const slowRotation = Math.abs(T.rotor.rotation.x);
pose({airflow: 45}, 2); assert(Math.abs(T.rotor.rotation.x) > slowRotation);
pose({}, 0.5); assert.equal(model.getState().now.on, true, 'there is no invented fan interlock');
for (const action of model.actions) {
  const before = model.getState().now;
  assert(Array.isArray(action.run()));
  assert.deepEqual(model.getState().now, before, 'inspection does not advance time');
  assert(model.parts.some(p => p.id === action.part));
  assert.equal(action.replay, false);
}
model.update({airflow: 20}); assert.equal(model.getState().now.t, 0); assert.equal(model.getState().now.water, 0.00035);
model.playback.step(); assert.equal(model.getState().now.t, 1);
model.update({airflow: 20}); assert.equal(model.getState().now.t, 1, 'unchanged controls preserve elapsed time');
model.reset(); model.animate(0); model.animate(0.4); model.animate(1); near(model.getState().now.t, 1, 1e-12, 'animation clock');
for (const dt of [NaN, Infinity, -1, 0]) { const before = model.getState().now; model.advance(dt); assert.deepEqual(model.getState().now, before); }
model.advance(1e5); assert(model.playback.complete() && model.resultPart.available()); assert.equal(model.resultPart.id, 'hair');
model.reset(); assert(!model.playback.complete() && !model.resultPart.available());
model.update({volts: 0}); assert(!model.playback.blocked()); model.advance(30); assert(model.getState().now.evaporated > 0);

assert.equal(lesson.tryIt.length, 7);
const trialResults = [];
for (const trial of lesson.tryIt) {
  assert.deepEqual(Object.keys(trial.values), Object.keys(DRYER_DEFAULTS));
  assert(trial.reset && trial.isolate === false && model.parts.some(p => p.id === trial.part));
  model.reset(); model.update(trial.values); assert.equal(model.getState().now.t, 0);
  model.advance(30); trialResults.push(model.getState());
}
near(trialResults[0].now.outlet, 65, 0.5, 'default trial copy'); near(trialResults[0].driedAt, 15, 0.5, 'drying-time copy');
near(trialResults[1].now.outlet, 97, 0.5, 'low-flow copy'); near(trialResults[2].now.outlet, 55, 0.5, 'high-flow copy');
assert(trialResults[1].driedAt < trialResults[0].driedAt && trialResults[2].driedAt > trialResults[0].driedAt);
assert(trialResults[3].opened > 0 && trialResults[3].now.water === 0.00035 && trialResults[3].now.flow === 0);
near(trialResults[4].now.power / 1000, 0.54, 0.005, 'reduced heater power copy'); near(trialResults[4].now.outlet, 32, 0.5, 'reduced heater temperature copy'); assert(trialResults[4].now.water > 0);
assert(trialResults[5].now.hair < 20 && trialResults[5].now.evaporated > 0 && trialResults[5].now.water > 0);
near(trialResults[6].now.outlet, 76, 0.5, 'warm-room copy'); assert(trialResults[6].driedAt < trialResults[0].driedAt);
assert.equal(lesson.quiz.answer, 0); assert.equal(lesson.quiz.options.length, 3);
assert.equal(heatingLessons['Hair dryer'], lesson);
assert(lesson.limits.includes('not measurements') && lesson.limits.includes('secondary thermal fuse') && lesson.limits.includes('50%'));
assert(lesson.deeper.some(item => item.body.includes('1,004.5')) && DRYER_AIR.heat === 1004.5);
assert(lesson.limits.includes('2.43 MJ/kg') && DRYER_THERMAL.latent === 2430e3);
const text = JSON.stringify(lesson);
assert(!/interlocked|without ever needing|true size|Plug it in in America|never heat/.test(text));
assert(!/[—–]| - |--/.test(text));
assert(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium|vapour)\b/i.test(text));
assert(lesson.sources.every(s => /^https:\/\//.test(s.url)) && new Set(lesson.sources.map(s => s.url)).size === lesson.sources.length);
const routed = createHeatingModel('Hair dryer'); assert.equal(routed.parts.length, 11); routed.dispose();
assert.equal(CHART.temperature[1], 250);
const corner = dryerPlan({volts: 240, airflow: 20, room: 30});
assert(corner.track.every(sample => dryerAt(corner, sample.t).outlet <= CHART.temperature[1]), 'maximum corner startup peak remains within chart');
assert.equal(DRYER.radius, 39);
const released = checkDisposal(model, checks);
console.log(JSON.stringify({passed: true, parts: 11, controls: 4, controlValues, poses, trials: 7, actions: 4, finiteChecks: checks.count, released}));

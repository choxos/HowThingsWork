import assert from 'node:assert/strict';
import * as THREE from 'three';
import {houseComponents} from './house-components.js';
import {polarizingSunglassesLesson as lesson} from './polarizers-lessons.js';
import {SUNGLASSES_DEFAULTS} from './polarizing-sunglasses-model.js';
import {createPartExplosion} from './part-explosion.js';

const component = houseComponents['Polarizing sunglasses'];
const model = component.createModel();
const near = (actual, expected, label = '') => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
const radians = degrees => degrees * Math.PI / 180;
const vectorNear = (actual, expected, label) => actual.forEach((value, i) => near(value, expected[i], label));
const vec = values => new THREE.Vector3(...values);
let states = 0, domainStates = 0, geometryPoints = 0;

// The trigonometric Fresnel form provides an independent route from the model's index/cosine form.
function expected(values) {
  const n = values.material ? 1.5 : 1.33;
  const theta = values.brewster ? Math.atan(n) : radians(values.incidence);
  const refracted = Math.asin(Math.sin(theta) / n);
  const rs = theta === 0 ? ((n - 1) / (n + 1)) ** 2 : (Math.sin(theta - refracted) / Math.sin(theta + refracted)) ** 2;
  const rp = theta === 0 ? rs : (Math.tan(theta - refracted) / Math.tan(theta + refracted)) ** 2;
  const source = values.power / 100, s = source * rs / 2, p = source * rp / 2;
  const axis = radians(values.analyzer);
  return {n, theta, refracted, rs, rp, source, s, p, reflected: s + p, output: values.glasses ? p * Math.cos(axis) ** 2 + s * Math.sin(axis) ** 2 : s + p};
}
function points(arrow, expectedPoints) {
  assert.equal(arrow.stroke.points.length, expectedPoints.length);
  arrow.stroke.points.forEach((point, i) => { vectorNear(point, expectedPoints[i], 'drawn ray'); geometryPoints++; });
}
function check() {
  const state = model.getState(), v = state.values, t = model.topology, e = expected(v), phase = state.progress;
  assert.equal(v.mode, 1);
  assert.equal(t.train.visible, false); assert.equal(t.glare.visible, true);
  near(state.reflection.angle, e.theta * 180 / Math.PI, 'incidence');
  near(state.reflection.refracted, e.refracted * 180 / Math.PI, 'refraction');
  near(state.reflection.Rs, e.rs, 's reflectance'); near(state.reflection.Rp, e.rp, 'p reflectance');
  near(state.sPower, e.s); near(state.pPower, e.p); near(state.reflectedPower, e.reflected); near(state.glareOutput, e.output);
  near(state.glareRejected, e.reflected ? 1 - e.output / e.reflected : 0);
  near(state.degree, e.reflected ? (e.s - e.p) / e.reflected : 0);
  assert.ok(e.output >= -1e-14 && e.output <= e.reflected + 1e-14 && e.reflected <= e.source + 1e-14);
  if (v.brewster) { near(e.rp, 0); near(e.rs, ((e.n ** 2 - 1) / (e.n ** 2 + 1)) ** 2); }
  const ki = [Math.sin(e.theta), -Math.cos(e.theta), 0], k = [Math.sin(e.theta), Math.cos(e.theta), 0];
  const kt = [Math.sin(e.refracted), -Math.cos(e.refracted), 0], sp = [0, 0, 1], pp = [-Math.cos(e.theta), Math.sin(e.theta), 0];
  for (const [name, direction] of Object.entries({incident: ki, reflected: k, transmitted: kt, sAxis: sp, pAxis: pp})) vectorNear(state.reflection[name], direction, name);
  const source = ki.map(x => -2.2 * x), lens = k.map(x => 1.9 * x), eye = k.map(x => 2.9 * x);
  vectorNear(model.parts.find(p => p.id === 'glare-source').object.position.toArray(), source, 'source');
  vectorNear(t.glasses.position.toArray(), lens, 'lens'); vectorNear(t.eye.position.toArray(), eye, 'eye');
  points(t.incident, v.power > 0 && phase > 0 ? [source, [0, 0, 0]] : []);
  points(t.reflected, v.power > 0 && phase >= .25 ? [[0, 0, 0], lens] : []);
  points(t.transmitted, v.power > 0 && phase >= .25 ? [[0, 0, 0], kt.map(x => x * 1.7)] : []);
  if (v.brewster) near(vec(k).dot(vec(kt)), 0, 'Brewster rays are perpendicular');
  const axis = vec(pp).multiplyScalar(Math.cos(radians(v.analyzer))).addScaledVector(vec(sp), Math.sin(radians(v.analyzer)));
  const drawnAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(t.glasses.quaternion);
  vectorNear(drawnAxis.toArray(), axis.toArray(), 'transmission axis'); near(drawnAxis.dot(vec(k)), 0);
  assert.equal(t.glasses.visible, Boolean(v.glasses));
  for (let i = 0; i < 2; i++) {
    const base = vec(k).multiplyScalar(1.05 + i * .3), field = vec(i ? sp : pp).multiplyScalar(2 * Math.sqrt(i ? e.s : e.p));
    const visible = v.power > 0 && phase >= .5 && field.length() >= 1e-7;
    points(t.glareE[i], visible ? [base.toArray(), base.clone().add(field).toArray()] : []);
    const magnetic = vec(k).cross(field);
    points(t.glareB[i], visible && v.magnetic ? [base.toArray(), base.clone().add(magnetic).toArray()] : []);
    near(field.dot(vec(k)), 0); near(field.dot(magnetic), 0); near(magnetic.dot(vec(k)), 0);
  }
  const out = vec(k).multiplyScalar(2.4), field = axis.clone().multiplyScalar(2 * Math.sqrt(e.output));
  points(t.outE, v.power > 0 && v.glasses && phase >= .75 && field.length() >= 1e-7 ? [out.toArray(), out.clone().add(field).toArray()] : []);
  for (const [i, bar] of t.glareBars.entries()) {
    const fraction = e.reflected ? (i ? e.output / e.reflected : 1) : 0;
    near(bar.scale.x, Math.max(.00001, fraction)); near(bar.position.x, .6 - (1 - fraction) * .7);
    assert.equal(bar.material.visible, phase >= .8 && fraction > 1e-12);
  }
  for (const control of model.controls) {
    const enabled = control.key === 'analyzer' ? Boolean(v.glasses) : control.key === 'incidence' ? !v.brewster : true;
    assert.equal(control.enabledWhen(v), enabled); assert.equal(control.visibleWhen(v), enabled);
  }
  assert.ok(state.readings.every(row => !/NaN|undefined|Infinity|null/.test(String(row.value))));
  if (!v.power) for (const label of ['Glare rejected', 'Reflected linear polarization']) assert.equal(state.readings.find(row => row.label === label).value, 'Unavailable: source off');
  model.root.updateMatrixWorld(true);
  model.root.traverse(object => assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
  states++; return state;
}

assert.deepEqual(model.controls.map(control => control.key).sort(), Object.keys(SUNGLASSES_DEFAULTS).sort());
assert.deepEqual(model.catalogParts.map(part => part.id), ['surface', 'glare-source', 'glasses', 'eye', 'glare-result']);
assert.deepEqual(model.parts.map(part => part.id), ['system', 'glare', 'surface', 'glare-source', 'glasses', 'eye', 'glare-result']);
assert.ok(Object.keys(component.values).every(key => Object.hasOwn(SUNGLASSES_DEFAULTS, key)));
assert.equal(component.part, 'glare'); assert.equal(model.initialPart, 'glare'); assert.equal(model.autoFramePart, 'glare');
assert.ok(model.actions.every(action => action.part === 'glare'));
assert.equal(check().elapsed, 0);
for (const control of model.controls) assert.equal(control.initial, SUNGLASSES_DEFAULTS[control.key]);
assert.equal(lesson.tryIt.length, 11);
for (const trial of lesson.tryIt) {
  assert.deepEqual(Object.keys(trial.values).sort(), Object.keys(SUNGLASSES_DEFAULTS).sort());
  assert.equal(trial.part, 'glare'); assert.equal(trial.reset, true); assert.equal(trial.isolate, false);
  model.reset(); model.update(trial.values); near(check().elapsed, 0);
  for (const [i, action] of model.actions.entries()) {
    action.run(); const state = check(); near(state.progress, [0, .25, .75, 1][i]);
    assert.deepEqual(state.values, {...model.defaults, ...trial.values});
  }
}
// Exhaust every effective combination. A removed filter makes its axis irrelevant;
// Brewster incidence replaces the manual angle rather than combining with it.
const angles = [...Array.from({length: 17}, (_, i) => ({brewster: 0, incidence: i * 5})), {brewster: 1, incidence: 55}];
for (const material of [0, 1]) for (const power of Array.from({length: 11}, (_, i) => i * 10)) for (const angle of angles) {
  for (const glasses of [0, 1]) for (const analyzer of glasses ? Array.from({length: 13}, (_, i) => i * 15) : [0]) for (const magnetic of [0, 1]) {
    model.update({material, power, ...angle, glasses, analyzer, magnetic}); model.actions[3].run(); check(); domainStates++;
  }
}
assert.equal(domainStates, 11088);
model.update({mode: 0, input: 1, inputAngle: 90, first: 90, middle: 90, insert: 1});
assert.equal(check().values.mode, 1, 'Unexposed train settings cannot change the sunglasses lesson.');
for (const step of [.02, .08, .17]) {
  model.reset();
  for (let i = 0; i < Math.ceil(8 / step) + 1; i++) model.advance(step);
  near(check().elapsed, 8); assert.equal(model.playback.complete(), true);
}
model.reset(); model.playback.step(); near(check().elapsed, .08);
model.advance(-1); model.advance(NaN); near(model.getState().elapsed, .08);
model.reset(); assert.equal(model.playback.complete(), false); assert.equal(model.resultPart.available(), false);
model.actions[3].run(); assert.equal(model.resultPart.available(), true); assert.equal(model.resultPart.id, 'glare-result');
for (const glasses of [0, 1]) {
  model.update({glasses}); model.root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
  const explosion = createPartExplosion(model, camera);
  assert.equal(explosion.items.length, glasses ? 4 : 3);
  assert.ok(explosion.items.every(item => ['surface', 'glare-source', 'glasses', 'glare-result'].includes(item.id)));
  explosion.dispose();
}
const resources = new Set();
model.root.traverse(object => {
  if (object.geometry) resources.add(object.geometry);
  for (const material of [object.material].flat().filter(Boolean)) {
    resources.add(material);
    for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
  }
});
const disposals = new Map([...resources].map(resource => [resource, 0]));
for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
model.dispose(); model.dispose(); assert.ok([...disposals.values()].every(count => count === 1));
console.log(JSON.stringify({passed: true, presets: lesson.tryIt.length, domainStates, states, geometryPoints, controls: model.controls.length, resources: resources.size}));

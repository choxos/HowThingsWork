import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElectricKettleModel, MM, FASTER, waterDepth, waterColor, chartX, chartY} from './electric-kettle-model.js';
import {KETTLE_DOMAINS, KETTLE_DEFAULTS, kettlePlan, kettleAt, KETTLE_THERMAL, KETTLE_WATER} from './element-physics.js';
import {fixed} from './format.js';
import {electricKettleLesson as lesson, electricKettleLimits} from './element-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {checkDisposal, checkFinite, checkTrialNumbers, checkQuotedText, tally} from './model-check-kit.mjs';

const model = createElectricKettleModel(), T = model.topology, checks = tally();
const near = (a, b, tol, label) => assert(Math.abs(a - b) <= tol, `${label}: ${a} versus ${b}`);
const pose = (values = {}, seconds = 0) => { model.reset(); model.update(values); model.advance(seconds / FASTER); model.root.updateMatrixWorld(true); return model.getState(); };
const linePoints = line => Array.from({length: Math.min(line.geometry.drawRange.count, line.geometry.attributes.position.count)}, (_, i) => new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position, i));
assert.deepEqual(model.controls.map(c => c.key), Object.keys(KETTLE_DOMAINS));
for (const c of model.controls) assert.deepEqual([c.min, c.max, c.step, c.initial], [...KETTLE_DOMAINS[c.key], KETTLE_DEFAULTS[c.key]]);
assert.deepEqual(model.parts.filter(p => p.id !== 'system').map(p => p.name), lesson.parts.map(p => p.name));
assert(model.parts.every(p => p.description && (p.id === 'system' || p.parentId === 'system')));
assert.equal(model.parts.length, 10);
assert.equal(T.pool.geometry.type, 'CylinderGeometry');
assert.equal(T.coil.geometry.type, 'TubeGeometry');
assert(T.shell.geometry.index.count < 64 * 30 * 6, 'vessel wall has a spout opening');
assert(T.innerWall.geometry.index.count < 64 * 30 * 6);
const boreOrigin = T.body.localToWorld(new THREE.Vector3(-65 * MM, 30 * MM, 0));
const boreDirection = new THREE.Vector3(-1, 0.65, 0).transformDirection(T.body.matrixWorld);
assert.equal(new THREE.Raycaster(boreOrigin, boreDirection).intersectObjects([T.shell, T.innerWall]).length, 0, 'spout centerline is not blocked by the vessel wall');
const ductOrigin = T.body.localToWorld(new THREE.Vector3(28 * MM, 66 * MM, 0));
const ductDirection = new THREE.Vector3(1, 0, 0).transformDirection(T.body.matrixWorld);
assert.equal(new THREE.Raycaster(ductOrigin, ductDirection).intersectObjects([T.shell, T.innerWall]).length, 0, 'vapor duct passes through an open vessel wall');
const bodySize = new THREE.Box3().setFromObject(T.body).getSize(new THREE.Vector3());
assert(bodySize.z > 0.7 && bodySize.y > 0.8, 'vessel has real depth and height');

let wireLength = 0, last = T.wirePath.getPoint(0);
const count = Math.ceil(T.wirePath.turns * 160);
for (let i = 1; i <= count; i++) {
  const point = T.wirePath.getPoint(i / count); wireLength += last.distanceTo(point); last = point;
  assert(Math.hypot(point.x, point.z) / MM + 0.275 < 70);
  assert(point.y / MM - 0.275 > -75);
  const center = T.sheathPath.getPoint(i / count);
  near(point.distanceTo(center) / MM, 2.2, 1e-10, 'coiled wire stays within insulation');
}
near(wireLength / MM / 1000, 5.2, 0.0004, 'independent polygonal wire length');
assert(44 * 7 * Math.PI / 4 / T.wirePath.turns > 0.55, 'neighboring wire turns do not intersect');
near(T.coil.geometry.parameters.radius / MM * 2, 0.55, 1e-12, 'actual wire diameter');
near(0.32 / T.insetTurns, 44 * 7 * Math.PI / 4 / T.wirePath.turns * MM * 5, 1e-12, 'inset pitch is magnified five times');
near(T.closeupWire.geometry.parameters.radius, T.coil.geometry.parameters.radius * 5, 1e-12, 'inset wire diameter is magnified five times');
for (const mass of [0.2, 0.3, 0.5, 1, 1.7]) {
  for (const seconds of [0, 300]) {
    const state = pose({mass}, seconds), depth = T.pool.scale.y / MM;
    const tubeVolume = Math.PI * 4 ** 2 * 44 * 7 * Math.PI / 4;
    const liquidVolume = Math.PI * 70 ** 2 * depth - tubeVolume;
    near(liquidVolume * 1000 / 1e9, state.now.liquidMass, 1e-12, 'rendered volume matches remaining liquid');
    assert(depth > 10 && depth < 150, 'minimum fill covers the tube; maximum fill leaves headspace');
    near(T.surface.position.y / MM, -75 + depth, 1e-10, 'surface meets the filled cylinder');
    near(T.pool.position.y / MM - depth / 2, -75, 1e-10, 'water rests on floor');
    assert(T.pool.material.color.equals(waterColor(state.now.water)));
  }
}
near(waterDepth(1) - waterDepth(0.2), 800000 / (Math.PI * 70 ** 2), 1e-12, 'fill increments follow cylindrical area');

const contactGap = (pivot, contact) => {
  model.root.updateMatrixWorld(true);
  return pivot.localToWorld(new THREE.Vector3(18 * MM, 0, 0)).distanceTo(contact.getWorldPosition(new THREE.Vector3()));
};
const standard = kettlePlan();
for (const [seconds, powered, steamClosed, dryClosed] of [[0, false, false, true], [1, true, true, true], [standard.firstBoil + 1, true, true, true], [standard.switched, false, false, true], [standard.duration, false, false, true]]) {
  const state = pose({}, seconds);
  assert.equal(state.now.on, powered);
  if (steamClosed) near(contactGap(T.switchPivot, T.switchContacts[1]), 0, 1e-12, 'closed steam contacts touch'); else assert(contactGap(T.switchPivot, T.switchContacts[1]) > 0.06);
  if (dryClosed) near(contactGap(T.dryPivot, T.dryContacts[1]), 0, 1e-12, 'closed dry contacts touch');
  assert.equal(T.discLayers[0].scale.y < 0, state.now.switched);
  assert.equal(T.bubbles.some(b => b.visible), state.now.boiling);
  if (!seconds) assert(T.vaporDots.every(dot => !dot.visible) && T.circulation.every(arrow => !arrow.visible));
  const upperLink = T.releaseLink.localToWorld(new THREE.Vector3(0, -T.releaseLink.geometry.parameters.height / 2, 0));
  const expectedDisc = T.steamSwitch.localToWorld(new THREE.Vector3(95 * MM, (34 + (state.now.switched ? -1.35 : 1.35)) * MM, 14 * MM));
  near(upperLink.distanceTo(expectedDisc), 0, 1e-10, 'release linkage stays attached to disc');
}
pose({}, standard.firstBoil + 0.4);
assert(T.vaporDots.some(dot => dot.visible), 'visible vapor begins after boiling');
pose({}, standard.duration);
assert(T.vaporDots.every(dot => !dot.visible), 'steam-flow cue stops after residual heat and transport delay');
const dry = kettlePlan({filled: 0});
pose({filled: 0}, dry.tripped + 0.001);
assert(contactGap(T.dryPivot, T.dryContacts[1]) > 0.06);
near(contactGap(T.switchPivot, T.switchContacts[1]), 0, 1e-12, 'steam contacts remain closed during dry trip');
assert(!T.pool.visible && !T.surface.visible && T.bubbles.every(b => !b.visible) && T.vaporDots.every(dot => !dot.visible));

for (const input of [{}, {filled: 0}, {mass: 0.2}, {volts: 120}]) {
  pose(input);
  assert(T.curves.every(({line}) => line.geometry.drawRange.count === 0), 'no future traces');
  const state = pose(input, 10);
  for (const {key, line} of T.curves) {
    const points = linePoints(line);
    if (key === 'water' && !state.wet) { assert.equal(points.length, 0); continue; }
    assert(points.length > 0 && points.every(p => p.x <= chartX(state, state.clock) + 1e-6));
    near(points.at(-1).x, chartX(state, state.now.t), 1e-6, 'trace ends at elapsed time');
    near(points.at(-1).y, chartY(state.now[key]), 1e-6, 'trace follows its thermal body');
  }
  assert.equal(model.getState().clock, 10);
  const before = JSON.stringify(model.getState().now);
  for (const action of model.actions) { assert.equal(action.replay, false); action.run(); assert.equal(JSON.stringify(model.getState().now), before, 'inspection leaves time and energy alone'); }
}

let controlValues = 0;
for (const [key, [lo, hi, step]] of Object.entries(KETTLE_DOMAINS)) {
  for (let i = 0; i <= Math.round((hi - lo) / step); i++) {
    pose({}, 30); const value = lo + i * step, changed = Math.abs(value - KETTLE_DEFAULTS[key]) > 1e-9;
    model.update({[key]: value}); const state = model.getState();
    near(state.values[key], value, 1e-10, 'control value'); assert.equal(state.clock, changed ? 0 : 30);
    if (changed) assert.equal(state.now.power + state.now.current + state.now.inputEnergy, 0);
    model.advance(0.3);
    assert(model.getState().readings.every(row => !/NaN|undefined|Infinity/.test(row.value + (row.hint || ''))));
    checkFinite(model.root, checks); controlValues++;
  }
}
assert.equal(controlValues, 79);
pose({volts: 0}); model.playback.step(); assert(model.playback.blocked()); assert.equal(model.getState().clock, 0);
pose(); model.playback.step(); assert.equal(model.getState().clock, 10);
model.advance(100); assert(model.playback.complete() && model.resultPart.available());
model.reset(); assert.equal(model.getState().clock, 0); assert.deepEqual(model.getState().values, model.defaults);
for (const invalid of [NaN, Infinity, -1, '1']) { model.advance(invalid); assert.equal(model.getState().clock, 0); }

const predictions = {
  'Boil a kettleful': plan => near(plan.firstBoil, 168, 0.5, 'standard first boil'),
  'Boil just a cupful': plan => near(plan.firstBoil, 35, 0.5, 'cup first boil'),
  'Fill it to the top': plan => near(plan.firstBoil, 285, 0.5, 'full first boil'),
  'Start with warm water': plan => near(plan.firstBoil, 120, 0.5, 'warm first boil'),
  'Try the same element at 120 V': plan => near(plan.settled.water, 56.7, 0.05, 'low-voltage result'),
  'Try the empty model': plan => near(plan.tripped, 4.16, 0.005, 'dry protection'),
  'Watch the steam switch': plan => assert(plan.switched > plan.firstBoil + 2),
};
checkTrialNumbers(lesson, {
  'Boil a kettleful': p => ({168: p.firstBoil, 172: p.switched}),
  'Boil just a cupful': p => ({35: p.firstBoil}),
  'Fill it to the top': p => ({605: p.needed / 1000, 285: p.firstBoil}),
  'Start with warm water': p => ({20: p.room, 251: p.needed / 1000, 120: p.firstBoil}),
  'Try the same element at 120 V': p => ({'2,217': standard.rating, 604: p.rating, 300: p.duration, '56.7': p.settled.water}),
  'Try the empty model': p => ({220: KETTLE_THERMAL.dryTrip, '4.16': p.tripped}),
  'Watch the steam switch': () => ({}),
}, kettlePlan, checks, model);
const atBoil = kettleAt(standard, standard.firstBoil + 1);
checkQuotedText(lesson.deeper.map(section => section.body).join(' '), {
  '355.8 kJ': `${fixed(standard.needed / 1000, 1)} kJ`,
  '285 °C': `${fixed(atBoil.celsius, 0)} °C`,
  '105 °C': `${fixed(atBoil.sheath, 0)} °C`,
  '2,256 kJ': `${fixed(KETTLE_WATER.vaporization / 1000, 0)} kJ`,
  '27%': `${fixed((120 / 230) ** 2 * 100, 0)}%`,
}, checks);
assert.equal(lesson.tryIt.length, 7);
for (const trial of lesson.tryIt) {
  assert(trial.reset && !trial.isolate && trial.view === 'reset');
  assert(model.parts.some(part => part.id === trial.part)); assert.deepEqual(Object.keys(trial.values), Object.keys(KETTLE_DEFAULTS));
  pose(trial.values, 300); predictions[trial.title](model.getState());
}
assert.equal(lesson.sources.length, 6);
assert(lesson.sources.every(source => source.url.startsWith('https://') && !source.url.includes('wikipedia')));
assert.equal(heatingLessons['Electric kettle'], lesson);
assert.equal(lesson.quiz.answer, 0);
assert(electricKettleLimits.includes('Preboiling evaporation') && electricKettleLimits.includes('teaching assumptions'));
near(KETTLE_THERMAL.steamTrip, 85, 0, 'declared steam threshold'); near(KETTLE_WATER.heat, 4186, 0, 'water heat capacity');
const routed = createHeatingModel('Electric kettle'); assert.deepEqual(routed.defaults, model.defaults); routed.dispose();
const released = checkDisposal(model, checks);
console.log(JSON.stringify({pass: true, parts: model.parts.length, controlValues, presets: lesson.tryIt.length, checkedWirePoints: count, wireLengthM: wireLength / MM / 1000, wireTurns: T.wirePath.turns, resourcesDisposedOnce: released}));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElectricHeatingModel, HEATER, MM, WIRE_TIMES, chartX, chartY} from './electric-heating-model.js';
import {HEATER_DEFAULTS, HEATER_DOMAINS, NIKROTHAL, heaterPlan, heaterAt, resistanceAt} from './element-physics.js';
import {wireColor} from './element-scene.js';
import {electricHeatingLesson as lesson} from './element-lessons.js';
import {tally, checkTrialNumbers, checkControlsMove, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createHeatingModel} from './heating-models.js';
import {heatingLessons} from './heating-lessons.js';

const t = tally(), model = createElectricHeatingModel(), g = model.topology;
const points = line => Array.from({length: Math.min(line.geometry.drawRange.count, line.geometry.attributes.position.count)}, (_, i) => new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position, i));
const set = (values = {}, seconds = 0) => {model.reset(); model.update(values); model.advance(seconds / 8); model.root.updateMatrixWorld(true); return model.getState();};
const snapshot = () => ({clock: model.getState().clock, now: model.getState().now, coil: g.coil.material.color.getHex(), tile: g.tile.material.color.getHex(), turns: g.coil.userData.turns, switch: g.switchPivot.rotation.z, dish: g.dish.visible, curve: points(g.curve).map(p => p.toArray())});
const localBounds = object => {object.geometry.computeBoundingBox(); return object.geometry.boundingBox.clone().applyMatrix4(object.matrix);};

assert.deepEqual(model.defaults, HEATER_DEFAULTS);
assert.deepEqual(model.controls.map(c => c.key), Object.keys(HEATER_DOMAINS));
for (const control of model.controls) assert.deepEqual([control.min, control.max, control.step, control.initial], [...HEATER_DOMAINS[control.key], HEATER_DEFAULTS[control.key]]);
assert.equal(heatingLessons['Electric heating'], lesson);
const routed = createHeatingModel('Electric heating'); assert.equal(routed.parts.length, model.parts.length); routed.dispose();
assert.equal(new Set(model.parts.map(p => p.id)).size, model.parts.length);
assert(model.parts.every(p => p.id === 'system' || p.parentId === 'system'));
assert(lesson.parts.every(p => model.parts.some(q => p.name === q.name)));
assert.equal(lesson.parts.length, model.parts.length - 1);
assert.equal(lesson.steps.length, 5); assert.equal(lesson.tryIt.length, 7);
assert(lesson.tryIt.every(p => p.reset && !p.isolate && p.view === 'reset' && model.parts.some(q => q.id === p.part)));

set();
const caseBounds = g.caseMeshes.slice(0, 4).reduce((bounds, object) => bounds.union(localBounds(object)), new THREE.Box3());
t.near(caseBounds.max.x - caseBounds.min.x, 600 * MM, 2e-7, '600 mm enclosure width');
t.near(caseBounds.max.y - caseBounds.min.y, 260 * MM, 2e-7, '260 mm enclosure height');
t.near(caseBounds.max.z - caseBounds.min.z, 150 * MM, 2e-7, '150 mm enclosure depth');
for (const foot of g.caseMeshes.slice(4)) t.near(localBounds(foot).max.y, caseBounds.min.y, 2e-7, 'feet touch the frame');
for (const terminal of g.terminals) {
  const bounds = localBounds(terminal);
  t.near(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), 0.565, 2e-7, 'ceramic support reaches side frame');
}
assert(g.dish.geometry.attributes.position.count > 100);
g.dish.geometry.computeBoundingBox();
assert(g.dish.geometry.boundingBox.max.z - g.dish.geometry.boundingBox.min.z > 0.2);
assert(g.tilePart.position.distanceTo(g.element.position) > 1);

let coilPoses = 0, maxLengthError = 0;
for (let length = 4; length <= 12; length += 0.5) {
  set({length});
  const path = g.coil.userData.path, geometry = g.coil.geometry, segments = geometry.parameters.tubularSegments, radial = geometry.parameters.radialSegments;
  assert(geometry.isBufferGeometry && geometry.type === 'TubeGeometry');
  t.near(Math.hypot(path.span, path.turns * 2 * Math.PI * path.radius), length * 1000 * MM, 1e-10, 'helical wire length');
  assert(path.span / path.turns > 0.0004 * 1000 * MM * WIRE_TIMES, 'drawn turns do not overlap');
  const centers = [];
  for (let ring = 0; ring <= segments; ring++) {
    const center = new THREE.Vector3();
    for (let face = 0; face < radial; face++) center.add(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, ring * (radial + 1) + face));
    center.divideScalar(radial); centers.push(center);
    t.near(center.distanceTo(path.getPoint(ring / segments)), 0, 5e-8, 'rendered ring follows helix');
    const surface = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, ring * (radial + 1));
    t.near(center.distanceTo(surface), 0.0004 * 1000 * MM * WIRE_TIMES / 2, 5e-8, 'drawn wire radius');
  }
  const measured = centers.slice(1).reduce((sum, point, i) => sum + point.distanceTo(centers[i]), 0) / (1000 * MM);
  maxLengthError = Math.max(maxLengthError, Math.abs(measured / length - 1));
  assert(Math.abs(measured / length - 1) < 0.003, 'tube polygon approximates full wire length within 0.3%');
  const leads = points(g.endLeads);
  t.near(leads[1].distanceTo(path.getPoint(0)), 0, 5e-8, 'first lead meets coil');
  t.near(leads[2].distanceTo(path.getPoint(1)), 0, 5e-8, 'return lead meets coil');
  for (const center of centers) assert(center.z + 0.0008 < HEATER.guardZ * MM - 0.003, 'coil stays clear of front guard');
  coilPoses++;
}

let sweptValues = 0;
for (const control of model.controls) for (let value = control.min; value <= control.max + 1e-9; value += control.step) {
  set(); model.advance(15);
  model.update({[control.key]: value});
  assert.equal(model.getState().clock, value === control.initial ? 120 : 0, 'actual changes clear the run');
  set({[control.key]: value});
  for (const seconds of [0, 1, 30, 120]) {
    const state = set({[control.key]: value}, seconds), now = state.now;
    if (value === 0 && control.key === 'volts') assert.equal(state.clock, 0);
    assert.equal(g.switchPivot.rotation.z === 0, now.on);
    if (now.on) {
      const closedEnd = new THREE.Vector3(0.14, 0, 0).applyMatrix4(g.switchPivot.matrixWorld);
      const fixedContact = new THREE.Vector3(-0.91, 0.55, 0).applyMatrix4(g.circuit.matrixWorld);
      t.near(closedEnd.distanceTo(fixedContact), 0, 1e-9, 'switch closes onto contact');
    }
    assert.equal(g.dish.visible, state.values.reflector === 1);
    assert.equal(g.coil.material.color.getHex(), wireColor(now.celsius).getHex());
    const drawnPower = g.beams.slice(0, 3).reduce((sum, arrow) => sum + arrow.userData.power, 0);
    t.near(drawnPower, now.radiated, 1e-9, 'radiation arrows partition one total');
    t.near(g.beams[3].userData.power, now.convected, 1e-9, 'air arrow carries convection');
    assert(g.beams.every(arrow => arrow.visible === (arrow.userData.power > 1e-8)));
    const curve = points(g.curve);
    assert.equal(curve.length > 0, state.clock > 0);
    if (curve.length) {
      t.near(curve.at(-1).x, chartX(state, now.t), 1e-7, 'chart ends at elapsed time');
      t.near(curve.at(-1).y, chartY(now.celsius), 1e-7, 'chart ends at current temperature');
      assert(curve.every(p => p.x <= chartX(state, now.t) + 1e-7), 'no unplayed history');
    }
    assert(state.readings.every(row => !/NaN|Infinity|undefined|null/.test(row.value + (row.hint || ''))));
  }
  sweptValues++;
}
assert.deepEqual(model.actions.map(action => action.view), ['front', 'iso', 'front', 'front']);
assert.equal(model.resultPart.view, 'iso');
for (const seconds of [0, 1, 120]) {
  set({}, seconds);
  for (const action of model.actions) {
    const before = snapshot(); action.run(); assert.deepEqual(snapshot(), before, 'inspection cannot alter physical state or recorded history');
  }
}
set({}, 120); model.update({volts: NaN, length: Infinity, room: undefined}); assert.equal(model.getState().clock, 120);
model.update({volts: 999}); assert.equal(model.getState().values.volts, 240); assert.equal(model.getState().clock, 0);
set({volts: 0}); model.advance(100); assert(model.playback.blocked()); assert.equal(model.getState().clock, 0);
for (const rate of [24, 60, 144]) {
  set(); for (let i = 0; i < rate * 15; i++) model.advance(1 / rate);
  assert(model.playback.complete()); assert.equal(model.getState().clock, 120); assert(model.resultPart.available());
}
set(); for (let i = 0; i < 4; i++) model.playback.step(); assert(model.playback.complete());
model.reset(); assert(!model.playback.complete() && !model.resultPart.available());
model.animate(0); model.animate(1); assert.equal(model.getState().clock, 8);
for (const dt of [0, -1, Infinity, NaN]) {const before = snapshot(); model.advance(dt); assert.deepEqual(snapshot(), before);}
checkControlsMove(model, snapshot, m => m.advance(15), t);
checkFinite(model.root, t);
const previousGeometry = g.coil.geometry; let oldDisposals = 0; previousGeometry.addEventListener('dispose', () => oldDisposals++);
model.update({length: 10}); assert.equal(oldDisposals, 1);

const defaultEnd = heaterAt(heaterPlan(), 120);
checkTrialNumbers(lesson, {
  'Switch it on cold': s => ({120: s.duration, 959: s.now.celsius, 972: s.now.power, 20: s.values.room, '32.8': s.now.tile}),
  'Take the reflector away': s => ({972: s.now.power, 649: defaultEnd.forward, 303: s.now.forward, '26.0': s.now.tile, '32.8': defaultEnd.tile}),
  'Wind in more wire': s => ({'104.1': resistanceAt(s.wire, s.values.room), 564: s.now.celsius, 487: s.now.power, '25.2': s.now.tile}),
  'Cut the element short': s => ({'1,425': s.now.power, '1,246': s.now.celsius, '1,200': NIKROTHAL.continuous, '39.9': s.now.tile}),
  'Lower the supply voltage': s => ({266: s.now.power, 585: s.now.celsius, '22.9': s.now.tile, 120: s.duration}),
  'Follow the heat out': s => ({866: s.now.radiated, 106: s.now.convected, '3.22': s.now.storedEnergy / 1000}),
  'Warm the room it stands in': s => ({960: s.now.celsius, '42.8': s.now.tile}),
}, values => set(values, 120), t, model);
assert.equal(lesson.quiz.answer, 0); assert.equal(lesson.quiz.options.length, 3);
const text = JSON.stringify(lesson);
assert(!/[—–]/.test(text)); assert(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium|vapour|sulphur)\b/i.test(text));
assert(lesson.sources.every(s => s.url.startsWith('https://') && !s.url.includes('wikipedia')));
assert.equal(new Set(lesson.sources.map(s => s.url)).size, lesson.sources.length);
const resources = checkDisposal(model, t);
console.log(JSON.stringify({pass: true, checks: t.count, coilPoses, sweptValues, maxDrawnLengthRelativeError: maxLengthError, presets: lesson.tryIt.length, readOnlyInspectionChecks: 12, resourcesDisposedOnce: resources}));

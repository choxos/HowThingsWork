import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPiezoelectricityModel} from './piezoelectricity-model.js';
import {piezoelectricityLesson as lesson} from './piezoelectricity-lesson.js';
import {PIEZO_DEFAULTS as D, piezoPlan, samplePiezoPlan} from './piezoelectricity-physics.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), model = createPiezoelectricityModel(), g = model.topology;
const equal = (a, b, message) => {assert.deepEqual(a, b, message); t.add();};
const expectedV = [0, 4.273985085902663, .004432205086115921, 5.746993041942353, -4.273790029898604, .092, .9100337304572212, 1.1422310737156038, 50, -50, 50, -.00036427687910162436, 0];
const ends = mesh => [-1, 1].map(sign => new THREE.Vector3(0, sign * mesh.geometry.parameters.height / 2, 0).applyMatrix4(mesh.matrixWorld));
const point = values => new THREE.Vector3(...values.map(v => v * g.MM));
const bounds = object => new THREE.Box3().setFromObject(object);
let presets = 0, layouts = 0;
function connectedGeometry() {
  model.root.updateMatrixWorld(true);
  const s = model.getState(), top = s.displayThickness * 1000;
  t.near(bounds(g.plate).min.y, 0, 3e-8, 'Fixed crystal lower face');
  t.near(bounds(g.plate).max.y, top * g.MM, 3e-8, 'Actual drawn thickness follows computed deformation');
  t.near(bounds(g.upperElectrode).min.y, bounds(g.plate).max.y, 3e-8, 'Upper electrode touches crystal');
  t.near(bounds(g.lowerElectrode).max.y, bounds(g.plate).min.y, 3e-8, 'Lower electrode touches crystal');
  t.near(bounds(g.upperPlaten).min.y, bounds(g.upperElectrode).max.y, 3e-8, 'Upper platen maintains contact');
  t.near(bounds(g.lowerPlaten).max.y, bounds(g.lowerElectrode).min.y, 3e-8, 'Lower platen maintains contact');
  t.near(ends(g.stem)[0].y, bounds(g.upperPlaten).max.y, 3e-8, 'Actuator stem meets platen');
  t.near(ends(g.stem)[1].y, 8.5 * g.MM, 3e-8, 'Actuator remains mounted in crossbar');
  t.near(ends(g.upperLead)[1].distanceTo(ends(g.positiveFlexible[0])[0]), 0, 2e-12, 'Moving electrode lead meets flexible wire');
  t.near(ends(g.positiveFlexible[0])[1].distanceTo(ends(g.positiveFlexible[1])[0]), 0, 2e-12, 'Moving wire segments meet');
  t.near(ends(g.positiveFlexible[1])[1].distanceTo(ends(g.positiveFlexible[2])[0]), 0, 2e-12, 'Flexible wire meets fixed bus');
  for (const item of g.switches) {
    const expected = item.name === 'source' ? s.values.mode === 1 : s.values.mode === 0 && (item.name === 'resistance' ? s.values.load !== 0 : s.values.capacitance !== 0);
    equal(item.connected, expected);
    t.near(ends(item.blade)[0].distanceTo(point([item.x, 1.9, 7])), 0, 2e-12, 'Switch blade remains at hinge');
    const gap = ends(item.blade)[1].distanceTo(point([item.x, 3.5, 7]));
    if (expected) t.near(gap, 0, 2e-12, 'Closed contact meets upper bus'); else t.ok(gap > g.MM, 'Open contact has a visible gap');
  }
  t.near(g.needlePivot.rotation.z, -s.voltage * Math.PI / (2 * g.plot().scale), 1e-12, 'Needle follows signed voltage on declared automatic scale');
  const plot = g.plot(); t.near(g.traceDot.position.y, 9 * g.MM * s.voltage / plot.scale, 1e-12, 'Plot marker follows same voltage');
}
for (const history of [{...D, force: 50, rise: 2, capacitance: 100, load: 0}, {...D, mode: 1, voltage: -50, blocked: 1}]) for (const [i, trial] of lesson.tryIt.entries()) {
  model.reset({time: 3, settings: history}); model.update(history);
  model.reset(trial.initialState); model.animate(0); model.update(model.defaults); model.update(trial.values);
  const s = model.getState(); equal(s.values, trial.values); equal(s.time, trial.initialState.time); equal(Object.keys(trial.values).sort(), Object.keys(D).sort());
  t.near(s.voltage, expectedV[i], 2e-11, trial.title);
  t.ok(model.parts.some(p => p.id === trial.part)); t.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(s.readings)));
  connectedGeometry(); checkFinite(model.root, t); presets++;
}
for (const p of lesson.parts) t.ok(model.parts.some(q => p.name === q.name), p.name);
for (const control of model.controls) for (const value of [control.min, control.max]) {
  model.reset(); model.update({[control.key]: value}); equal(model.getState().values[control.key], value); model.advance(.1); connectedGeometry(); checkFinite(model.root, t);
}
for (const mode of [0, 1]) for (const c of model.controls) {
  const expected = !['force', 'load', 'capacitance', 'voltage', 'blocked'].includes(c.key) || (mode === 0 ? ['force', 'load', 'capacitance'].includes(c.key) : ['voltage', 'blocked'].includes(c.key));
  equal(c.visibleWhen ? c.visibleWhen({...D, mode}) : true, expected, 'Only controls for the selected experiment are visible');
}
equal(model.controls.find(c => c.key === 'mode').primary, true);
model.reset(); model.root.updateMatrixWorld(true); equal(g.mounts.length, 8);
for (const {mesh, body} of g.mounts) {
  const post = bounds(mesh), component = bounds(body);
  t.near(post.min.z, bounds(g.panel).max.z, 3e-8, 'Mount touches panel');
  t.near(post.max.z, component.min.z, 3e-8, 'Mount touches component underside');
  t.ok(post.min.x >= component.min.x && post.max.x <= component.max.x && post.min.y >= component.min.y && post.max.y <= component.max.y, 'Mount inside footprint');
}
for (const wire of g.wires) wire.meshes.forEach((mesh, i) => ends(mesh).forEach((end, j) => t.near(end.distanceTo(point(wire.points[i + j])), 0, 2e-12, 'Assembled wire endpoints')));
let maximumPlotError = 0;
for (const values of [D, {...D, rise: .05, force: 50, load: 1}, {...D, rise: .05, force: 50, load: 2}, {...D, capacitance: 100, load: 3}, {...D, load: 0}, {...D, mode: 1, voltage: -50}]) {
  model.reset({settings: values}); const plot = g.plot(), positions = g.traceLine.geometry.attributes.position, p = piezoPlan(values);
  equal(g.traceLine.geometry.drawRange.count, plot.times.length);
  for (let i = 0; i < plot.times.length - 1; i++) {
    const time = (plot.times[i] + plot.times[i + 1]) / 2, drawn = (positions.getY(i) + positions.getY(i + 1)) / (18 * g.MM);
    maximumPlotError = Math.max(maximumPlotError, Math.abs(drawn - samplePiezoPlan(p, time).voltage / plot.scale));
  }
}
t.ok(maximumPlotError < .001, 'Voltage plot interpolation below 0.1% of its vertical scale');
for (const guide of g.guides) {equal(guide.userData.explosionExcluded, true); t.ok(model.thumbnailOmit.includes(guide));}
t.ok(model.frameBoundsForPart('system').max.x < 30 * g.MM, 'Inspection plots excluded from apparatus framing');
for (const mode of [0, 1]) {
  model.reset(); model.update({...D, mode}); model.playback.step(); t.near(model.getState().time, .25, 1e-12);
  model.advance(1000); t.ok(model.playback.complete()); const held = JSON.stringify(model.getState()); model.advance(1); equal(JSON.stringify(model.getState()), held);
  const values = model.getState().values; model.reset(model.replayState()); model.update(values); equal(model.getState().time, 0); t.ok(!model.playback.complete());
}
for (const action of model.actions) {model.reset({time: .5}); const held = JSON.stringify(model.getState()); action.run(); equal(JSON.stringify(model.getState()), held, 'Inspection preserves experiment'); t.ok(model.parts.some(p => p.id === action.part));}
for (const aspect of [1, 1.24]) for (const settings of [D, {...D, mode: 1, voltage: -50}]) {
  const m = createPiezoelectricityModel(); m.reset({time: 2, settings});
  const before = JSON.stringify(m.getState()), {camera} = frameModel(m, aspect), explosion = createPartExplosion(m, camera, aspect); explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const b = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) b.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return b;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Exploded groups do not overlap');
  equal(boxes.length, 8, 'Eight physical groups'); explosion.update(0); explosion.dispose(); equal(JSON.stringify(m.getState()), before); m.dispose(); layouts++;
}
const resources = checkDisposal(model, t);
console.log(JSON.stringify({passed: true, checks: t.count, presets, actions: model.actions.length, layouts, resources, mounts: g.mounts.length, maximumPlotError}));

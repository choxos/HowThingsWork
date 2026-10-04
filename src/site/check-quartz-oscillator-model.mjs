import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createQuartzOscillatorModel} from './quartz-oscillator-model.js';
import {quartzOscillatorLesson as lesson} from './quartz-oscillator-lesson.js';
import {OSCILLATOR_DEFAULTS as D, oscillatorPlan, oscillatorEnvelope} from './quartz-oscillator-physics.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), model = createQuartzOscillatorModel(), g = model.topology;
const equal = (a, b, message) => {assert.deepEqual(a, b, message); t.add();};
const expected = [.001, .8784392700720645, null, 7.910918194618743e-7, .5 / Math.E, .5 * Math.exp(-3), .5 * Math.exp(-4 / 3), .7979172348319902, 6.0558189821475125e-9, null, null, null];
let presets = 0, layouts = 0;
for (const history of [{...D, gain: 0, initial: 1, capacitor: 40}, {...D, mode: 1, gain: 10, capacitor: 12, resistance: 60}]) for (const [i, trial] of lesson.tryIt.entries()) {
  model.reset({time: 3, settings: history}); model.update(history);
  model.reset(trial.initialState); model.animate(0); model.update(model.defaults); model.update(trial.values);
  const s = model.getState(); equal(s.values, trial.values); equal(s.time, trial.initialState.time); equal(Object.keys(trial.values).sort(), Object.keys(D).sort());
  if (expected[i] !== null) t.near(s.amplitude, expected[i], 2e-12, trial.title);
  t.ok(model.parts.some(p => p.id === trial.part)); t.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(s.readings)));
  t.near(g.envelopeDot.position.y, (-9 + 19 * s.amplitude) * g.MM, 1e-12, 'Chart marker follows amplitude');
  for (const {mesh, sign, initial} of g.tines) {
    const position = mesh.geometry.attributes.position;
    for (let j = 0; j < position.count; j++) {
      if (Math.abs(initial[j * 3 + 1] / g.MM + 1.9) < 1e-6) t.near(position.getX(j), initial[j * 3], 1e-9, 'Fixed root');
      if (Math.abs(initial[j * 3 + 1] / g.MM - 1.9) < 1e-6) t.near(position.getX(j) - initial[j * 3], sign * .24 * g.MM * s.displayedDisplacement, 2e-9, 'Tip tracks envelope or real signed cycle');
    }
  }
  checkFinite(model.root, t); presets++;
}
for (const p of lesson.parts) t.ok(model.parts.some(q => p.name === q.name), p.name);
model.reset({settings: {...D, gain: 0, initial: 1, mode: 1}});
const positions = g.waveLine.geometry.attributes.position;
for (const [index, cycles] of [[16, .25], [48, .75], [80, 1.25], [112, 1.75]]) {
  const y = 9 * Math.exp(-cycles / (32768 * .46606691405936373)) * Math.sin(2 * Math.PI * cycles) * g.MM;
  t.near(positions.getY(index), y, 3e-8, 'Actual waveform includes negative peaks');
}
model.reset({time: .25 / 32768, settings: {...D, mode: 1}});
t.ok(model.getState().displayedDisplacement > .99, 'Tiny initial seed remains visible in explicitly normalized slow motion');
for (const control of model.controls) for (const value of [control.min, control.max]) {
  model.reset(); model.update({[control.key]: value}); equal(model.getState().values[control.key], value); model.advance(.1); checkFinite(model.root, t);
}
model.root.updateMatrixWorld(true); equal(g.wires.length, 11);
equal(g.mounts.length, 16);
const boardBounds = new THREE.Box3().setFromObject(g.board);
for (const {mesh, body} of g.mounts) {
  const post = new THREE.Box3().setFromObject(mesh), component = new THREE.Box3().setFromObject(body);
  t.near(post.min.z, boardBounds.max.z, 3e-8, 'Mount starts on the actual panel surface');
  t.near(post.max.z, component.min.z, 3e-8, 'Mount meets the actual component underside');
  t.ok(post.min.x >= component.min.x && post.max.x <= component.max.x && post.min.y >= component.min.y && post.max.y <= component.max.y, 'Mount lands inside component footprint');
}
let maximumPlotError = 0;
for (const values of [D, {...D, gain: 10, capacitor: 12}, {...D, gain: 0, initial: 1, resistance: 60}]) {
  model.reset({settings: values}); const line = g.envelopeLine.geometry.attributes.position, plan = oscillatorPlan(values);
  for (let i = 0; i < line.count - 1; i++) {
    const time = 8 * (i + .5) / (line.count - 1), drawn = ((line.getY(i) + line.getY(i + 1)) / (2 * g.MM) + 9) / 19;
    maximumPlotError = Math.max(maximumPlotError, Math.abs(drawn - oscillatorEnvelope(plan, time).amplitude));
  }
}
t.ok(maximumPlotError < .001, 'Fast-startup curve stays within 0.1% amplitude of its analytic marker');
for (const wire of g.wires) wire.meshes.forEach((mesh, i) => {
  const half = mesh.geometry.parameters.height / 2;
  for (const [j, y] of [-half, half].entries()) t.near(new THREE.Vector3(0, y, 0).applyMatrix4(mesh.matrixWorld).distanceTo(new THREE.Vector3(...wire.points[i + j].map(v => v * g.MM))), 0, 1e-12, 'Actual electrical segment endpoints meet');
});
for (const side of ['In', 'Out']) {
  const signal = g.wires.find(w => w.name === `signal-${side}`); equal(signal.points[0], g.terminals[`amp${side}`]); equal(signal.points.at(-1), g.terminals[`crystal${side}`]);
  equal(g.wires.find(w => w.name === `bias-${side}`).points[0], g.terminals[`bias${side}`]);
  equal(g.wires.find(w => w.name === `load-${side}`).points.at(-1), g.terminals[`cap${side}`]);
  equal(g.wires.find(w => w.name === `ground-${side}`).points[0], g.terminals[`ground${side}`]);
}
for (const guide of g.guides) {equal(guide.userData.explosionExcluded, true); t.ok(model.thumbnailOmit.includes(guide));}
const bounds = model.frameBoundsForPart('system'); t.ok(bounds.max.x < 20 * g.MM, 'Inspection plots do not enlarge circuit bounds');
for (const mode of [0, 1]) {
  model.reset(); model.update({...D, mode}); model.playback.step(); t.near(model.getState().time, oscillatorPlan({mode}).step, 1e-12);
  model.advance(1000000); t.ok(model.playback.complete()); const held = JSON.stringify(model.getState()); model.advance(1); equal(JSON.stringify(model.getState()), held);
  const values = model.getState().values; model.reset(model.replayState()); model.update(values); equal(model.getState().time, 0); t.ok(!model.playback.complete());
}
for (const action of model.actions) {model.reset({time: .5}); const held = JSON.stringify(model.getState()); action.run(); equal(JSON.stringify(model.getState()), held, 'Inspection preserves experiment'); t.ok(model.parts.some(p => p.id === action.part));}
for (const aspect of [1, 1.24]) for (const settings of [D, {...D, mode: 1, initial: 1}]) {
  const m = createQuartzOscillatorModel(); m.reset({time: 0, settings});
  const before = JSON.stringify(m.getState()), {camera} = frameModel(m, aspect), explosion = createPartExplosion(m, camera, aspect); explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const b = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) b.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return b;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Exploded groups do not overlap');
  equal(boxes.length, 7, 'Seven real component groups; no detached-label pseudo-part'); explosion.update(0); explosion.dispose(); equal(JSON.stringify(m.getState()), before); m.dispose(); layouts++;
}
const resources = checkDisposal(model, t);
console.log(JSON.stringify({passed: true, checks: t.count, presets, actions: model.actions.length, layouts, resources, mounts: g.mounts.length, maximumPlotError}));

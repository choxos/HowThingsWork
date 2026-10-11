import assert from 'node:assert/strict';
import * as THREE from 'three';
import {houseComponents} from './house-components.js';
import {polarizingFilterLesson as lesson} from './polarizers-lessons.js';
import {createPartExplosion} from './part-explosion.js';

const component = houseComponents['Polarizing filter'];
const model = component.createModel();
const near = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const cos2 = degrees => Math.cos(degrees * Math.PI / 180) ** 2;
const expectedOutput = v => v.power / 100 * (v.input ? cos2(v.inputAngle - v.first) : .5) * (v.insert ? cos2(v.middle - v.first) * cos2(v.analyzer - v.middle) : cos2(v.analyzer - v.first));
let states = 0, fieldPoints = 0;

function check() {
  const state = model.getState(), v = state.values, t = model.topology;
  near(state.output, expectedOutput(v));
  near(state.output + state.absorbed, v.power / 100);
  near(state.stages.slice(1).reduce((sum, stage) => sum + stage.absorbed, 0), state.absorbed);
  assert.equal(v.mode, 0);
  assert.equal(t.train.visible, true);
  assert.equal(t.glare.visible, false);
  assert.equal(t.middle.visible, Boolean(v.insert));
  for (const key of ['first', 'middle', 'analyzer']) near(t[key].rotation.x, v[key] * Math.PI / 180);
  const powers = [v.power / 100, state.stages[1].power, v.insert ? state.stages[2].power : state.stages[1].power, state.output];
  for (const [i, bar] of t.meterBars.entries()) {
    near(bar.scale.x, Math.max(.00001, powers[i]));
    assert.equal(bar.material.visible, state.progress >= .8 && powers[i] > 1e-12);
  }
  assert.equal(t.meterRows[2].visible, Boolean(v.insert));
  near(t.detectorFace.material.color.r, .025 + (state.progress >= 1 ? state.output : 0) * .9);
  for (const [i, wave] of t.waves.entries()) {
    const stage = state.stages[i];
    if (!stage || stage.power < 1e-12) assert.equal(wave.e.points.length, 0);
    if (wave.e.points.length) {
      const angle = (stage.angle ?? v.inputAngle) * Math.PI / 180;
      for (const [j, point] of wave.e.points.entries()) {
        assert.ok(point.every(Number.isFinite));
        near(point[1] * Math.sin(angle) - point[2] * Math.cos(angle), 0);
        if (v.magnetic) {
          const b = wave.b.points[j];
          near(b[0], point[0]); near(b[1], -point[2]); near(b[2], point[1]);
        }
        fieldPoints++;
      }
    }
    if (!v.magnetic) assert.equal(wave.b.points.length, 0);
  }
  assert.equal(t.sourceFan.filter(arrow => arrow.stroke.object.visible).length, v.power > 0 && state.progress > 0 ? (v.input ? 1 : 8) : 0);
  model.root.updateMatrixWorld(true);
  model.root.traverse(object => assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
  states++;
  return state;
}

assert.deepEqual(model.catalogParts.map(part => part.id), ['first', 'middle', 'analyzer', 'source', 'result', 'meter']);
assert.ok(Object.keys(component.values).every(key => model.controls.some(control => control.key === key)));
assert.equal(component.part, 'train', 'The route frames the connected path.');
assert.equal(model.initialPart, 'train');
assert.equal(model.autoFramePart, 'train');
assert.ok(model.actions.every(action => action.part === 'train'));
assert.deepEqual(model.controls.map(control => control.key), ['power', 'input', 'inputAngle', 'first', 'analyzer', 'middle', 'insert', 'magnetic']);
assert.ok(model.parts.every(part => !part.id.includes('glare') && !['glasses', 'eye', 'surface'].includes(part.id)));
assert.equal(model.getState().elapsed, 0);
assert.equal(model.getState().values.insert, 1);

const outputs = [.5, 0, .25, .125, .09375, .09375, 0, 1, .5];
assert.equal(lesson.tryIt.length, outputs.length);
for (const [i, trial] of lesson.tryIt.entries()) {
  assert.deepEqual(Object.keys(trial.values).sort(), model.controls.map(control => control.key).sort());
  assert.equal(trial.part, 'train', trial.title);
  assert.equal(trial.reset, true);
  assert.equal(trial.isolate, false);
  model.reset(); model.update(trial.values);
  near(check().elapsed, 0);
  for (const [j, action] of model.actions.entries()) {
    action.run();
    const state = check();
    near(state.progress, [0, .25, .75, 1][j]);
    near(state.output, outputs[i]);
    assert.deepEqual(state.values, {...model.defaults, ...trial.values});
  }
}

// Exercise every retained control in the contexts that make it available.
for (const input of [0, 1]) for (const insert of [0, 1]) for (const magnetic of [0, 1]) {
  const values = {...model.defaults, input, insert, magnetic, inputAngle: 45, first: 30, analyzer: 60};
  for (const control of model.controls) {
    assert.equal(control.visibleWhen(values), control.enabledWhen(values));
    if (!control.enabledWhen(values)) continue;
    for (const value of control.options?.map(option => option.value) ?? [control.min, control.max]) {
      model.reset(); model.update({...values, [control.key]: value}); model.actions[3].run(); check();
    }
  }
}
for (const input of [0, 1]) for (const first of [0, 90, 180]) {
  model.reset(); model.update({input, inputAngle: 90, first, analyzer: first, insert: 0});
  model.actions[3].run();
  const state = check();
  if (input && first !== 90) assert.match(state.readings.find(row => row.label === 'Outcome').value, /no field component/);
}
model.update({mode: 1, material: 1, brewster: 1});
assert.equal(model.getState().values.mode, 0, 'Hidden parent modes cannot switch this component away from its lesson.');
for (const step of [.02, .08, .17]) {
  model.reset();
  for (let i = 0; i < Math.ceil(8 / step) + 1; i++) model.playback.advance(step);
  const state = check(); near(state.elapsed, 8); assert.equal(model.playback.complete(), true);
}
model.reset(); model.playback.step(); near(check().elapsed, .08);
model.advance(-1); model.advance(NaN); near(model.getState().elapsed, .08);
model.reset(); assert.equal(model.playback.complete(), false); assert.equal(model.resultPart.available(), false);
model.actions[3].run(); assert.equal(model.resultPart.available(), true);

for (const insert of [0, 1]) {
  model.update({insert}); model.root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
  const explosion = createPartExplosion(model, camera);
  assert.equal(explosion.items.length, insert ? 6 : 5);
  assert.ok(explosion.items.every(item => !['train', 'system', 'glare'].includes(item.id)));
  explosion.dispose();
}
const resources = new Set();
model.root.traverse(object => {
  if (object.geometry) resources.add(object.geometry);
  if (object.material) {
    resources.add(object.material);
    if (object.material.map) resources.add(object.material.map);
    if (object.material.gradientMap) resources.add(object.material.gradientMap);
  }
});
const disposals = new Map([...resources].map(resource => [resource, 0]));
for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
model.dispose(); model.dispose();
assert.ok([...disposals.values()].every(count => count === 1));
console.log(JSON.stringify({passed: true, presets: outputs.length, states, fieldPoints, controls: model.controls.length, resources: resources.size}));

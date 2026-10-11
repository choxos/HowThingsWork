import assert from 'node:assert/strict';
import * as THREE from 'three';
import {houseComponents} from './house-components.js';
import {LCD_DEFAULTS, sampleLCD} from './lcd-optics.js';

const component = houseComponents['Liquid crystals'], model = component.createModel();
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const patterns = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const trials = [
  ['Look at the undriven twist', .5, false], ['Switch the voltage on', 0, true],
  ['Take the driver away', .5, false], ['Reverse the field', 0, true],
  ['Turn the rear filter parallel', 0, false], ['Take the rear filter away', .5, true],
  ['Write a digit', 0, true], ['Make the parallel cell bright', .5, true],
  ['Light the cell from behind', .5, false], ['Block the backlight', 0, true],
  ['Remove the illumination', 0, true], ['Raise both electrodes together', .5, false],
  ['Inspect an unaddressed segment', .5, false],
];
assert.equal(component.part, 'system', 'Initial view includes directors, filters, driver and result');
assert.equal(component.isolate, false);
assert.deepEqual(component.lesson.tryIt.map(t => t.title), trials.map(t => t[0]));
let poses = 0;
for (const [i, trial] of component.lesson.tryIt.entries()) {
  assert.equal(trial.part, 'system', `${trial.title}: keep the connected mechanism in view`);
  assert.equal(trial.reset, true); assert.equal(trial.isolate, false); assert.equal(trial.view, 'front');
  assert.deepEqual(Object.keys(trial.values).sort(), Object.keys(LCD_DEFAULTS).sort());
  model.reset(); model.update(trial.values);
  assert.equal(model.resultPart.available(), false);
  for (const time of [0, 2, 6, 8]) {
    model.advance(time - model.getState().elapsed);
    const state = model.getState(); near(state.output, trials[i][1]);
    assert.equal(state.driven, trials[i][2]); near(state.elapsed, time);
    assert.deepEqual(state.values, trial.values);
    assert.equal(model.topology.field.object.visible, state.driven);
    assert.equal(model.topology.rear.group.visible, trial.values.analyzer !== 2);
    assert.equal(model.topology.mirror.group.visible, trial.values.lighting === 0);
    assert.equal(model.topology.backlight.group.visible, trial.values.lighting === 1);
    for (const {rod, fraction} of model.topology.directors) {
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(rod.quaternion);
      const expected = state.driven ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, Math.cos(fraction * Math.PI / 2), Math.sin(fraction * Math.PI / 2));
      near(axis.dot(expected), 1);
    }
    for (const control of model.controls) {
      const enabled = control.key === 'drive' ? !trial.values.mode : ['digit', 'segment'].includes(control.key) ? Boolean(trial.values.mode) : true;
      assert.equal(control.enabledWhen(state.values), enabled);
      assert.equal(control.visibleWhen(state.values), enabled);
    }
    if (time === 8) {
      near(model.topology.bars[1].scale.x, Math.max(.00001, state.output));
      assert.equal(model.topology.bars[1].material.visible, state.output > 1e-12);
      if (trial.values.mode) {
        const segment = model.topology.segments[trial.values.segment];
        near(model.topology.marker.position.x, segment.group.position.x);
        near(model.topology.marker.position.y, segment.group.position.y);
        for (let j = 0; j < 7; j++) near(model.topology.segments[j].mesh.material.color.r, .06 + 1.8 * state.segmentPowers[j]);
      } else near(model.topology.pixel.material.color.r, .06 + 1.8 * state.output);
    }
    model.root.updateMatrixWorld(true);
    model.root.traverse(object => assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
    poses++;
  }
  assert.equal(model.playback.complete(), true); assert.equal(model.resultPart.available(), true);
}

// Every effective control combination, including all eleven light levels.
let configurations = 0;
for (const lighting of [0, 1]) for (const analyzer of [0, 1, 2]) for (const battery of [0, 1]) for (const polarity of [0, 1]) for (const mode of [0, 1]) {
  const commands = mode ? patterns.flatMap((_, digit) => Array.from({length: 7}, (_, segment) => ({digit, segment}))) : [{drive: 0}, {drive: 1}];
  for (const command of commands) for (let power = 0; power <= 100; power += 10) {
    const s = sampleLCD({lighting, analyzer, battery, polarity, mode, power, ...command});
    const driven = Boolean(battery && (mode ? patterns[command.digit].includes('abcdefg'[command.segment]) : command.drive));
    const pass = analyzer === 2 || (analyzer === 0 ? !driven : driven);
    near(s.output, pass ? power / 200 : 0); assert.equal(s.driven, driven);
    near(s.common, battery ? polarity : 0); near(s.difference, driven ? 1 - 2 * polarity : 0);
    near(s.rms, driven ? 1 : 0); near(s.mean, 0);
    for (let i = 1; i < s.path.stages.length; i++) assert.ok(s.path.stages[i].power <= s.path.stages[i - 1].power + 1e-12);
    configurations++;
  }
}
model.dispose();
console.log(JSON.stringify({passed: true, presets: trials.length, poses, effectiveConfigurations: configurations, controls: 9}));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { createCdrModel } from './cdr-model.js';
import { cdrLesson as lesson } from './cdr-lesson.js';
import { CDR_DEFAULTS, CDR_DOMAINS, CDR_TIMING } from './cdr-physics.js';
import { houseComponents } from './house-components.js';
import { tally, checkFinite, checkDisposal } from './model-check-kit.mjs';

const t = tally(), model = createCdrModel(), g = model.topology, d = g.details, outcomes = [], controls = [];
assert.deepEqual(model.controls.map(c => c.key), Object.keys(CDR_DEFAULTS)); t.add();
t.ok(d.screen.material.map === g.fileTexture && g.screen.material.map === g.fileTexture, 'Computer and readback panel share the actual recovered-byte screen');
for (const trial of lesson.tryIt) {
  assert.deepEqual(trial.initialState.settings, trial.values); assert.deepEqual(Object.keys(trial.values), Object.keys(CDR_DEFAULTS)); t.add(2);
  t.ok(trial.reset && trial.isolate && model.parts.some(p => p.id === trial.part), 'Every named experiment defines its own starting state');
  model.reset({ settings: { high: 15, low: 0, medium: 2, power: 2, readLight: 0 }, time: 11 });
  model.reset(trial.initialState); assert.deepEqual(model.getState().values, trial.values); t.add();
  for (const time of [0, .5, 1, 1.98, 3.11, 4.4, 5, 5.5, 6, 7.5, 9.2, 10.5, 11]) {
    model.reset({ ...trial.initialState, time }); const s = model.getState(), p = model.scientificPlan();
    t.near(g.pickup.position.x, s.spiral.radiusMm * .01, 1e-12, 'Pickup follows the same written and read region');
    t.near(g.screw.rotation.x, (s.spiral.radiusMm - 25) * Math.PI, 1e-12, 'Screw and rail carriage stay connected');
    t.near(g.clampMark.position.x, -.035 * Math.sin(s.spiral.angle), 1e-12, 'Clamp rotation uses the physical channel clock');
    t.ok(g.outgoing.visible === Boolean(s.light) && g.returning.visible === Boolean(s.light), 'Both optical paths follow current exposure and readback light');
    t.near(g.outgoing.geometry.attributes.position.getY(3), .132, 1e-8, 'Beam reaches the recording layer above the clear substrate');
    t.ok(g.outgoing.material.color.getHex() === (s.exposing ? 0xc14f39 : 0x397b94), 'Recording pulses visibly differ from reading light');
    if (s.light) {
      const outgoing = d.outgoing.geometry.attributes.position, returning = d.returning.geometry.attributes.position;
      const point = (array, i) => new THREE.Vector3(array.getX(i), array.getY(i), 0);
      t.near(outgoing.getX(1), d.opticalSplitter.position.x, 1e-7, 'The diagram beam turns inside the splitter');
      t.near(outgoing.getY(1), d.opticalSplitter.position.y, 1e-7, 'The splitter lies on the incoming beam');
      const incoming = point(outgoing, 1).sub(point(outgoing, 0)).normalize(), reflected = point(outgoing, 2).sub(point(outgoing, 1)).normalize();
      t.near(incoming.reflect(new THREE.Vector3(-1, 1, 0).normalize()).distanceTo(reflected), 0, 1e-7, 'The 45-degree splitter redirects the incoming ray toward the objective');
      t.near(outgoing.getX(2), d.opticalObjective.position.x, 1e-7, 'The outgoing beam passes through the objective center');
      t.near(outgoing.getY(2), d.opticalObjective.position.y, 1e-7, 'The objective lies between splitter and dye');
      t.ok(Math.abs(returning.getX(1) - d.opticalObjective.position.x) < d.opticalObjective.geometry.parameters.width / 2, 'The returned beam crosses the objective aperture');
      t.ok(Math.abs(returning.getX(2) - d.opticalSplitter.position.x) < d.opticalSplitter.geometry.parameters.width / 2, 'The return path passes through the splitter');
      t.ok(Math.abs(returning.getX(3) - d.opticalDetector.position.x) < d.opticalDetector.geometry.parameters.width / 2, 'Returned light reaches the detector face');
      t.near(returning.getY(3), d.opticalDetector.position.y + d.opticalDetector.geometry.parameters.height / 2, 1e-7, 'The return path terminates on the detector');
    }
    t.ok(s.readings.every(r => !/(NaN|undefined|Infinity)/.test(r.value + ' ' + r.hint)), 'All learner readings remain finite');
    assert.deepEqual(g.screenSurface.rendered, { input: s.inputBits, output: s.outputBits, available: s.available, marks: s.storedMarks, phase: s.phase, occupied: s.values.medium !== 0 }); t.add();
    for (let i = 0; i < 40; i++) {
      t.ok(d.markCells[i].material.color.getHex() === (s.windowMarks[i] ? 0x705135 : 0xdace9c), 'Every drawn dye cell follows irreversible material state');
      t.ok(d.readDots[i].visible === (s.windowReceived[i] === 1), 'Visible read dots follow received transitions only');
      t.ok(d.readCells[i].material.color.getHex() === (s.windowReceived[i] === null ? 0xa8b4a4 : 0x397b94), 'Unread cells cannot look received');
      t.ok(d.nominalCells[i].material.color.getHex() === (p.program.marks[CDR_TIMING.windowStart + i] ? 0x705135 : 0xdace9c), 'Reference pulse panel uses the actual chosen channel');
    }
    t.ok(d.codeBits.every((bit, i) => bit.text.userData.labelText === p.program.trace.word[i]), 'Shown EFM word is generated from the selected source byte');
    t.ok(d.layerMark.visible === s.windowMarks.some(Boolean), 'Layer cutaway retains completed marks while the writing spot moves ahead');
    if (s.reading && !s.values.readLight) {
      t.ok(d.trackStage.userData.labelText.startsWith('Read light off: no transitions arrive'), 'The track does not claim transitions arrive during a dark scan');
      t.ok(d.layerStage.userData.labelText.startsWith('Read light off: no signal is retrieved'), 'The layers do not claim light retrieves data during a dark scan');
      t.ok(g.screenLabel.userData.labelText === 'READ LIGHT OFF: NO SIGNAL', 'The connected hardware labels the actual dark-read state');
    }
    if (s.outputBits) t.ok(d.codeResult.userData.labelText.includes(s.outputBits) && d.resultHeader.userData.labelText.includes(s.outputBits), 'Checked readback reaches the enlarged views');
    else t.ok(!d.codeResult.userData.labelText.startsWith('Checked user byte'), 'No unchecked result appears on the coding view');
    const before = structuredClone(s);
    for (const action of model.actions) { t.ok(action.replay === false, 'Inspection preserves progress'); action.run(); assert.deepEqual(model.getState(), before); t.add(); }
    checkFinite(model.root, t);
  }
  const final = model.getState(); outcomes.push({ title: trial.title, initial: trial.initialState, input: final.inputBits, output: final.outputBits, status: final.status, marks: final.storedMarks });
  model.reset(trial.initialState); model.advance(20); model.reset(model.replayState());
  t.near(model.getState().time, trial.initialState.time, 0, 'Replay restores the named starting point'); assert.deepEqual(model.getState().values, trial.values); t.add();
}
for (const control of model.controls) {
  const [lo, hi, step] = CDR_DOMAINS[control.key];
  for (let value = lo; value <= hi; value += step) {
    model.reset(); model.advance(3); model.update({ [control.key]: value }); const s = model.getState();
    t.near(s.values[control.key], value, 0, 'Every exposed control value is applied');
    t.near(s.time, value === CDR_DEFAULTS[control.key] ? 3 : 0, 1e-12, 'A changed control prepares a new experiment');
    model.playback.step(); checkFinite(model.root, t); model.advance(20); const end = model.getState();
    t.ok(g.screenSurface.rendered.output === end.outputBits, 'Each control reaches its actual readback surface');
    controls.push({ key: control.key, value, output: end.outputBits, marks: end.storedMarks });
  }
}
for (const time of [1, 2, 7, 8]) { model.reset({ time }); const cells = time < 5 ? model.getState().writeCells : model.getState().readCells; model.playback.step(); t.near((time < 5 ? model.getState().writeCells : model.getState().readCells) - cells, 1, 0, 'Step advances one cell in either magnified pass'); }
model.reset({ time: 5.5 }); model.playback.step(); t.near(model.getState().time, 5.55, 1e-12, 'Step advances the declared return interval');
model.reset({ time: 11 }); t.ok(g.screenSurface.rendered.output === '10100101', 'Completed default has actual readback');
model.update({ power: 1 }); t.ok(g.screenSurface.rendered.output === null && !g.screenSurface.rendered.available, 'A new experiment clears old successful output');
model.advance(11); t.ok(g.screenSurface.rendered.output === null && g.screenSurface.rendered.marks === 0, 'Failed writing cannot retain the old byte or dye');
for (const settings of [{ power: 1 }, { power: 2 }, { medium: 1 }]) {
  model.reset({ settings }); const paints = g.screenSurface.paintCount, marks = model.getState().storedMarks;
  model.advance(1);
  t.ok(g.screenSurface.paintCount > paints, 'Writing-pass progress repaints even when no new marks form');
  t.ok(model.getState().storedMarks === marks, 'Moving through a blocked or low-power write pass does not change the dye');
}
model.reset({ settings: { readLight: 0 }, time: 6 });
const darkReadPaints = g.screenSurface.paintCount, darkReadMarks = model.getState().storedMarks;
model.advance(1);
t.ok(g.screenSurface.paintCount > darkReadPaints, 'A dark read pass still repaints its scan progress');
t.ok(model.getState().storedMarks === darkReadMarks && model.getState().outputBits === null, 'Dark-pass progress neither erases marks nor invents readback');
for (const part of model.parts) t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(), part.id + ' contains geometry');
t.ok(lesson.parts.every(p => model.parts.some(x => x.name === p.name)), 'Lesson names identify actual inspectable parts');
assert.equal(houseComponents['CD-R'].createModel, createCdrModel); assert.equal(houseComponents['CD-R'].lesson, lesson); t.add(2);
const resources = checkDisposal(model, t), report = { passed: true, checks: t.count, outcomes, controls, resources, pixelScope: 'Native checks verify geometry, material colors and screen bindings. Canvas and GPU pixels require separate browser evidence.' };
if (process.env.EVIDENCE_DIR) { await mkdir(process.env.EVIDENCE_DIR, { recursive: true }); await writeFile(process.env.EVIDENCE_DIR + '/model.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: true, checks: t.count, experiments: outcomes.length, controls: controls.length, resources }));

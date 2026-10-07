import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { createDvdrModel } from './dvdr-model.js';
import { dvdrLesson as lesson } from './dvdr-lesson.js';
import { DVDR_DEFAULTS, DVDR_DOMAINS, DVDR_TIMING, DVDR_FILE_TRACE } from './dvdr-physics.js';
import { DVDR_FILE_NAMES } from './dvdr-files.js';
import { houseComponents } from './house-components.js';
import { tally, checkFinite, checkDisposal } from './model-check-kit.mjs';

const started = Date.now(), t = tally(), model = createDvdrModel(), g = model.topology, d = g.details, outcomes = [], controls = [], combinations = [];
assert.deepEqual(model.controls.map(c => c.key), Object.keys(DVDR_DEFAULTS)); t.add();
t.ok(d.screen.material.map === g.fileTexture && g.screen.material.map === g.fileTexture, 'Monitor and enlarged playback share the recovered-file surface.');
const inspectState = () => {
  const s = model.getState(), p = model.scientificPlan();
  t.near(g.pickup.position.x, s.spiral.radiusMm * .01, 1e-12, 'Pickup follows the physical spiral.');
  t.near(g.screw.rotation.x, (s.spiral.radiusMm - 24) * Math.PI, 1e-12, 'Illustrative 2 mm screw pitch moves the sled.');
  t.near(g.clampMark.position.x, -.035 * Math.sin(s.spiral.angle), 1e-12, 'Spindle angle follows the physical channel path.');
  t.ok(g.outgoing.visible === Boolean(s.light) && g.returning.visible === Boolean(s.light), 'Both light paths obey exposure state.');
  t.near(g.outgoing.geometry.attributes.position.getY(3), .126, 1e-8, 'The focused beam reaches the DVD recording layer at mid-thickness.');
  t.ok(g.outgoing.material.color.getHex() === (s.exposing ? 0xc14f39 : 0x397b94), 'Recording pulses visibly differ from low-power exposure.');
  if (s.light) {
    const outgoing = d.outgoing.geometry.attributes.position, returning = d.returning.geometry.attributes.position;
    const point = (array, i) => new THREE.Vector3(array.getX(i), array.getY(i), 0);
    t.near(outgoing.getX(1), d.opticalSplitter.position.x, 1e-7, 'Ray reaches splitter center.');
    t.near(outgoing.getY(1), d.opticalSplitter.position.y, 1e-7, 'Incoming ray lies on splitter.');
    const incoming = point(outgoing, 1).sub(point(outgoing, 0)).normalize(), reflected = point(outgoing, 2).sub(point(outgoing, 1)).normalize();
    t.near(incoming.reflect(new THREE.Vector3(-1, 1, 0).normalize()).distanceTo(reflected), 0, 1e-7, 'Splitter redirects the ray toward the objective.');
    t.near(outgoing.getX(2), d.opticalObjective.position.x, 1e-7, 'Objective lies on the outgoing beam.');
    t.near(outgoing.getY(2), d.opticalObjective.position.y, 1e-7, 'Ray passes through objective center.');
    t.ok(Math.abs(returning.getX(1) - d.opticalObjective.position.x) < d.opticalObjective.geometry.parameters.width / 2, 'Returned light crosses the objective aperture.');
    t.ok(Math.abs(returning.getX(2) - d.opticalSplitter.position.x) < d.opticalSplitter.geometry.parameters.width / 2, 'Returned light crosses the splitter.');
    t.ok(Math.abs(returning.getX(3) - d.opticalDetector.position.x) < d.opticalDetector.geometry.parameters.width / 2, 'Return beam reaches the detector.');
    t.near(returning.getY(3), d.opticalDetector.position.y + d.opticalDetector.geometry.parameters.height / 2, 1e-7, 'Return ray ends on the detector surface.');
  }
  t.ok(s.readings.every(r => !/(NaN|undefined|Infinity)/.test(r.value + ' ' + r.hint)), 'Readings contain finite values.');
  assert.deepEqual(g.screenSurface.rendered, { requested: s.requestedName, stored: s.storedName, available: s.available, frame: s.available ? s.frameIndex : null,
    bytes: s.entry?.size ?? 0, phase: s.phase, occupied: s.values.medium !== 0 }); t.add();
  for (let i = 0; i < 40; i++) {
    t.ok(d.markCells[i].material.color.getHex() === (s.windowMarks[i] ? 0x705135 : 0xd4b49c), 'Drawn material follows permanent marks.');
    t.ok(d.readDots[i].visible === (s.windowReceived[i] === 1), 'Read dots show actual received transitions.');
    t.ok(d.readCells[i].material.color.getHex() === (s.windowReceived[i] === null ? 0xa8b4a4 : 0x397b94), 'Unvisited cells remain unread.');
    t.ok(d.nominalCells[i].material.color.getHex() === (p.program.marks[DVDR_TIMING.windowStart + i] ? 0x705135 : 0xd4b49c), 'Reference chart uses the selected file pattern.');
  }
  t.ok(d.codeBits.every((bit, i) => Number(bit.text.userData.labelText) === p.program.channel.bits[DVDR_FILE_TRACE.firstCell + i]), 'Coding panel shows the actual generated EFMplus word.');
  t.ok(d.layerMark.visible === s.windowMarks.some(Boolean), 'Layer section retains material changes.');
  t.ok(d.pulseHeading.userData.labelText.includes(`TYPE ${s.values.pulseType + 1}`), 'Pulse diagram names the selected reference.');
  if (s.available) {
    t.ok(d.resultHeader.userData.labelText.includes(s.storedName) && d.fileRows[1].text.userData.labelText.includes(s.storedName), 'Recovered identity reaches enlarged result and directory.');
    t.ok(d.fileRows.every(row => row.box.material.color.getHex() === 0xd5e5d4), 'File pipeline releases only checked results.');
  } else t.ok(d.fileRows.every(row => row.box.material.color.getHex() === 0xe7dfce), 'Incomplete or failed reads do not claim recovered files.');
  if (!s.available && s.time >= 11) t.ok(s.readings.find(row => row.label === 'File and picture output').value === 'File unavailable; no movie output', 'Finished failed reads report unavailability instead of waiting.');
  if (s.reading && !s.values.readLight) {
    t.ok(d.trackStage.userData.labelText.startsWith('Read light off: no transitions'), 'Track explains dark readout.');
    t.ok(d.layerStage.userData.labelText.startsWith('Dark readout retrieves nothing'), 'Layer diagram does not claim light is arriving.');
    t.ok(g.screenLabel.userData.labelText === 'READ LIGHT OFF: NO SIGNAL', 'Monitor labels the actual read condition.');
  }
  checkFinite(model.root, t);
  return s;
};
for (const trial of lesson.tryIt) {
  assert.deepEqual(trial.initialState.settings, trial.values); assert.deepEqual(Object.keys(trial.values), Object.keys(DVDR_DEFAULTS)); t.add(2);
  t.ok(trial.reset && trial.isolate && model.parts.some(p => p.id === trial.part), 'Every experiment prepares an exact named starting state.');
  model.reset({ settings: { content: 2, medium: 2, power: 2, readLight: 0, pulseType: 2 }, time: 13.25 });
  model.reset(trial.initialState); assert.deepEqual(model.getState().values, trial.values); t.add();
  for (const time of [0, 1, 1.98, 3.11, 5, 5.5, 6, 7.5, 9.2, 10.5, 11, 11.04, 12.96, 13.25]) {
    model.reset({ ...trial.initialState, time }); inspectState();
  }
  const final = model.getState(); outcomes.push({ title: trial.title, initial: trial.initialState, requested: final.requestedName, stored: final.storedName, status: final.status, markedCells: final.storedMarks });
  const before = structuredClone(final);
  for (const action of model.actions) { t.ok(action.replay === false, 'Inspection preserves playback.'); action.run(); assert.deepEqual(model.getState(), before); t.add(); }
  model.reset(trial.initialState); model.advance(20); model.reset(model.replayState());
  t.near(model.getState().time, trial.initialState.time, 0, 'Replay restores the prepared checkpoint.'); assert.deepEqual(model.getState().values, trial.values); t.add();
}
for (const control of model.controls) {
  const [lo, hi, step] = DVDR_DOMAINS[control.key];
  for (let value = lo; value <= hi; value += step) {
    model.reset(); model.advance(3); model.update({ [control.key]: value });
    t.near(model.getState().time, value === DVDR_DEFAULTS[control.key] ? 3 : 0, 1e-12, 'Changed controls prepare a new region experiment.');
    model.playback.step(); inspectState(); model.advance(20); const end = inspectState();
    controls.push({ key: control.key, value, stored: end.storedName, marks: end.storedMarks });
  }
}
for (let content = 0; content < 3; content++) for (let medium = 0; medium < 4; medium++) for (let power = 0; power < 3; power++) for (let readLight = 0; readLight < 2; readLight++) for (let pulseType = 0; pulseType < 3; pulseType++) {
  const settings = { content, medium, power, readLight, pulseType };
  model.reset({ settings, time: 13.25 }); const s = inspectState();
  const expected = readLight && (medium || power === 0) ? DVDR_FILE_NAMES[medium ? medium - 1 : content].replace(';1', '') : null;
  t.ok(g.screenSurface.rendered.stored === expected, 'Every control combination reaches its material-derived file output.');
  combinations.push({ ...settings, stored: s.storedName, frame: g.screenSurface.rendered.frame });
}
const pulseShapes = [];
for (let pulseType = 0; pulseType < 3; pulseType++) { model.reset({ settings: { pulseType }, time: 1 }); pulseShapes.push(JSON.stringify(Array.from(d.pulseLine.geometry.attributes.position.array))); }
t.ok(new Set(pulseShapes).size === 3, 'All three controls change the drawn waveform, not only its label.');
for (const time of [1, 2, 7, 8]) {
  model.reset({ time }); const cells = time < 5 ? model.getState().writeCells : model.getState().readCells;
  model.playback.step(); t.near((time < 5 ? model.getState().writeCells : model.getState().readCells) - cells, 1, 0, 'Step advances one magnified channel cell.');
}
for (let frame = 0; frame < 49; frame++) {
  model.reset({ time: 11 + frame / 25 }); model.playback.step();
  t.near(model.getState().frameIndex, frame + 1, 0, 'Movie step advances exactly one recovered picture.');
}
model.reset({ time: 13.25 }); t.ok(g.screenSurface.rendered.stored === 'BALL.M2V', 'Completed default has the retrieved file.');
model.update({ power: 1 }); t.ok(!g.screenSurface.rendered.available && g.screenSurface.rendered.frame === null && g.screenSurface.rendered.stored === null, 'New controls immediately clear a successful movie.');
model.advance(20); t.ok(!g.screenSurface.rendered.available && model.getState().storedMarks === 0, 'Failed writing cannot retain old output.');
for (const settings of [{ power: 1 }, { power: 2 }, { medium: 1 }]) {
  model.reset({ settings }); const paints = g.screenSurface.paintCount, marks = model.getState().storedMarks; model.advance(1);
  t.ok(g.screenSurface.paintCount > paints && model.getState().storedMarks === marks, 'Blocked write progress repaints without changing material.');
}
model.reset({ settings: { readLight: 0 }, time: 6 }); const paints = g.screenSurface.paintCount, marks = model.getState().storedMarks; model.advance(1);
t.ok(g.screenSurface.paintCount > paints && model.getState().storedMarks === marks, 'Dark-read progress repaints without erasing marks.');
for (const part of model.parts) t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(), part.id + ' has geometry.');
t.ok(lesson.parts.every(part => model.parts.some(actual => actual.name === part.name)), 'Lesson parts match actual selectable components.');
assert.equal(houseComponents['DVD-R'].createModel, createDvdrModel); assert.equal(houseComponents['DVD-R'].lesson, lesson); t.add(2);
const resources = checkDisposal(model, t), report = { passed: true, checks: t.count, elapsedMs: Date.now() - started, outcomes, controls, combinations, resources,
  pixelScope: 'Native geometry, material colors, reference waveforms and output bindings. Actual canvas pixels and GPU playback need browser evidence.' };
if (process.env.EVIDENCE_DIR) { await mkdir(process.env.EVIDENCE_DIR, { recursive: true }); await writeFile(process.env.EVIDENCE_DIR + '/model.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: true, checks: t.count, experiments: outcomes.length, controls: controls.length, combinations: combinations.length, resources }));

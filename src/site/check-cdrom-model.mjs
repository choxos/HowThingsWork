import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { createCdromModel } from './cdrom-model.js';
import { cdRomLesson as lesson } from './cdrom-lesson.js';
import { CDROM_DEFAULTS, CDROM_DOMAINS } from './cdrom-physics.js';
import { houseComponents } from './house-components.js';
import { tally, checkFinite, checkDisposal } from './model-check-kit.mjs';

const t = tally(), model = createCdromModel(), g = model.topology, d = g.details, outcomes = [], controls = [];
assert.deepEqual(model.controls.map(c => c.key), Object.keys(CDROM_DEFAULTS)); t.add();
const texture = g.fileTexture;
t.ok(d.screen.material.map === texture && g.screen.material.map === texture, 'Computer and inspection panel share one retrieved-file surface');
for (const trial of lesson.tryIt) {
  assert.deepEqual(trial.initialState.settings, trial.values); assert.deepEqual(Object.keys(trial.values), Object.keys(CDROM_DEFAULTS)); t.add(2);
  t.ok(trial.reset && trial.isolate && model.parts.some(p => p.id === trial.part), 'Named experiment has a valid prepared state');
  model.reset({ settings: { content: 2, loss: 5, laser: 0, format: 2, depth: 3, location: 2 }, time: 10 });
  model.reset(trial.initialState); assert.deepEqual(model.getState().values, trial.values); t.add();
  for (const time of [...new Set([trial.initialState.time, 0, 2, 5, 5.25, 5.8, 6.5, 7, 7.5, 8.8, 9.5, 10])]) {
    model.reset({ ...trial.initialState, time }); const s = model.getState();
    t.near(g.pickup.position.x, s.spiral.radiusMm * .01, 1e-12, 'Pickup follows metadata seeks and the file spiral');
    t.near(g.screw.rotation.x, (s.spiral.radiusMm - 25) * Math.PI, 1e-12, 'Carriage screw follows physical radius');
    t.near(g.clampMark.position.x, -.035 * Math.sin(s.spiral.angle), 1e-12, 'Disc rotation follows read clock in correct direction');
    t.ok(g.outgoing.visible === (!!s.values.laser && s.reading), 'Optical path requires laser and reading stage');
    t.ok(g.returning.visible === g.outgoing.visible, 'Returned path follows illumination');
    t.near(g.outgoing.geometry.attributes.position.getY(3), .132, 1e-8, 'Focus is at the CD layer 1.2 mm above its read face');
    t.ok(s.readings.every(r => !/(NaN|undefined|Infinity)/.test(r.value + ' ' + r.hint)), 'Finite learner readings');
    assert.equal(g.fileTexture, texture); t.add();
    t.ok(g.screenSurface.rendered.available === s.fileReady, 'Screen availability follows the checked file');
    t.ok(g.screenSurface.rendered.bytes === (s.file?.length ?? 0), 'Screen receives only retrieved file length');
    t.ok(g.screenSurface.rendered.type === (s.output?.type ?? null), 'Screen format follows actual parsed output');
    const content = s.readings.find(r => r.label === 'Opened file contents').value;
    t.ok(s.readings.find(r => r.label === 'Opened file contents').wide, 'Recovered file uses full readout width');
    if (s.output?.type === 'text') assert.equal(content, s.output.text.replace(/\r\n/g, '\n').trim());
    else if (s.output?.type === 'data') t.ok(s.output.points.every(([x, y]) => content.includes(`${x} → ${y}`)), 'Readable page output includes every recovered CSV pair');
    else if (s.output?.type === 'picture') t.ok(content.includes(`${s.output.width} × ${s.output.height}`), 'Picture description uses decoded dimensions');
    else t.ok(content === 'No file contents available.' || content === 'Waiting for a complete, checked file.', 'Readable page output cannot retain an old file');
    t.add();
    t.ok(!s.fileReady || g.screenLabel.userData.labelText === s.entry.name.replace(';1', ''), 'Computer names the recovered file');
    if (!s.directoryReady) t.ok(d.rows.every(row => row.name.userData.labelText === 'Waiting'), 'Directory diagram does not reveal prefetched names');
    else t.ok(d.rows.every((row, i) => row.name.userData.labelText === s.directory[i].name), 'Directory labels use recovered metadata');
    const before = structuredClone(s);
    for (const action of model.actions) { t.ok(action.replay === false, 'Inspection preserves experiment'); action.run(); assert.deepEqual(model.getState(), before); t.add(); }
    checkFinite(model.root, t);
  }
  outcomes.push({ title: trial.title, initial: trial.initialState, result: model.getState().status, stats: model.getState().stats });
  model.reset(trial.initialState); model.advance(20); model.reset(model.replayState());
  t.near(model.getState().time, trial.initialState.time, 0, 'Replay restores named start time'); assert.deepEqual(model.getState().values, trial.values); t.add();
}
for (const control of model.controls) {
  const [lo, hi, step] = CDROM_DOMAINS[control.key];
  for (let value = lo; value <= hi; value += step) {
    model.reset(); model.advance(3); model.update({ [control.key]: value }); const s = model.getState();
    t.near(s.values[control.key], value, 0, 'Every exposed value applies');
    t.near(s.time, ['format', 'depth'].includes(control.key) || value === CDROM_DEFAULTS[control.key] ? 3 : 0, 1e-12, 'Only read changes restart');
    model.playback.step(); checkFinite(model.root, t);
    const f = model.scientificPlan().comparison;
    t.near(d.cover.scale.y, f.cover * .95, 1e-12, 'Optical format changes drawn clear-layer depth');
    t.ok(d.backing.visible === (f.backing > 0), 'CD diagram has no invented backing above the reflective layer');
    for (let wave = 0; wave < 3; wave++) for (let i = 0; i <= 180; i++) {
      const angle = i / 180 * 4 * Math.PI, first = Math.sin(angle), second = Math.sin(angle + f.radians), value = wave === 0 ? first : wave === 1 ? second : (first + second) / 2;
      t.near(d.phaseLines[wave].geometry.attributes.position.getY(i), [1.26, .20, -.86][wave] + .25 * value, 8e-8, 'Every wave point follows selected phase');
    }
    model.advance(20); const end = model.getState();
    t.ok(g.screenSurface.rendered.available === end.fileReady, 'Control change reaches consistent screen result');
    controls.push({ key: control.key, value, result: end.status });
  }
}
model.reset(); model.playback.step(); t.near(model.getState().receivedCells, 1, 0, 'Early step advances one channel cell');
model.reset({ time: 7.5 }); model.playback.step(); t.near(model.getState().time, 7.55, 1e-12, 'Later step advances declared read interval');
model.reset({ settings: { content: 1 }, time: 10 }); t.ok(model.getState().output.type === 'picture', 'Picture is available after success');
model.update({ loss: 4 }); t.ok(!g.screenSurface.rendered.available && g.screenSurface.rendered.type === null, 'A new failed read clears old successful picture');
model.advance(10); t.ok(!g.screenSurface.rendered.available, 'Unrecoverable file cannot leave stale pixels available');
for (const part of model.parts) t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(), part.id + ' contains geometry');
t.ok(lesson.parts.every(p => model.parts.some(x => x.name === p.name)), 'Lesson names match inspectable parts');
assert.equal(houseComponents['CD-ROM'].createModel, createCdromModel); assert.equal(houseComponents['CD-ROM'].lesson, lesson); t.add(2);
const resources = checkDisposal(model, t), report = { passed: true, checks: t.count, outcomes, controls, resources, pixelScope: 'Native run checks screen binding and state. Canvas pixels require browser evidence.' };
if (process.env.EVIDENCE_DIR) { await mkdir(process.env.EVIDENCE_DIR, { recursive: true }); await writeFile(process.env.EVIDENCE_DIR + '/model.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: true, checks: t.count, experiments: outcomes.length, controls: controls.length, resources }));

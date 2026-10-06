import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { createDvdModel } from './dvd-model.js';
import { dvdLesson as lesson } from './dvd-lesson.js';
import { DVD_DEFAULTS, DVD_DOMAINS, DVD_TIMING } from './dvd-physics.js';
import { dvdVideoRgba } from './dvd-video.js';
import { houseComponents } from './house-components.js';
import { tally, checkFinite, checkDisposal } from './model-check-kit.mjs';

const t = tally(), model = createDvdModel(), g = model.topology, d = g.details, outcomes = [], controls = [];
assert.deepEqual(model.controls.map(c => c.key), Object.keys(DVD_DEFAULTS)); t.add();
const image = g.videoTexture.image, pixels = image.data;
t.ok(image.width === 720 && image.height === 576 && g.videoTexture.flipY, 'Fixed, upright 720 by 576 texture');
for (const trial of lesson.tryIt) {
  assert.deepEqual(trial.initialState.settings, trial.values); assert.deepEqual(Object.keys(trial.values), Object.keys(DVD_DEFAULTS)); t.add(2);
  t.ok(trial.reset && trial.isolate && model.parts.some(p => p.id === trial.part), 'Named experiment has valid prepared state');
  model.reset({ settings: { content: 2, loss: 3, laser: 0, format: 0, depth: 3, radius: 58 }, time: 8 });
  model.reset(trial.initialState); assert.deepEqual(model.getState().values, trial.values); t.add();
  for (const time of [...new Set([trial.initialState.time, 0, 2, 4.8, 5.5, 6, 7, 7.04, DVD_TIMING.duration])]) {
    model.reset({ ...trial.initialState, time }); const s = model.getState(), p = model.scientificPlan();
    t.near(g.pickup.position.x, s.spiral.radiusMm * .01, 1e-12, 'Pickup follows outward spiral');
    t.near(g.screw.rotation.x, (s.spiral.radiusMm - 24) * Math.PI, 1e-12, 'Screw follows actual radius');
    t.near(g.clampMark.position.x, -.035 * Math.sin(s.spiral.angle), 1e-12, 'Disc rotation has correct direction');
    t.ok(g.outgoing.visible === (!!s.values.laser && s.time < 6), 'Optical path requires laser and reading stage');
    t.ok(g.returning.visible === g.outgoing.visible, 'Returned path follows illumination');
    t.near(g.outgoing.geometry.attributes.position.getY(3), .126, 1e-8, 'Focus is 0.6 mm above read face');
    t.ok(s.readings.every(r => !/(NaN|undefined|Infinity)/.test(r.value + ' ' + r.hint)), 'Finite learner readings');
    assert.equal(g.videoTexture.image, image); assert.equal(g.videoTexture.image.data, pixels); t.add(2);
    const expectedPixels = s.picture ? dvdVideoRgba(s.picture) : g.blankPixels;
    t.ok(pixels.length === expectedPixels.length && pixels.every((byte, i) => byte === expectedPixels[i]), 'Actual screen texture has exactly the decoded pixel bytes');
    t.ok(s.picture ? g.screenLabel.userData.labelText.includes(`FRAME ${s.frameIndex + 1} / 50`) : !g.screenLabel.userData.labelText.includes('DECODED'), 'Screen label follows recovered picture');
    for (let i = 0; i < 50; i++) {
      const frame = p.read?.video.frames.find(f => f.reference === i), available = frame?.valid && frame.end <= s.availableBytes;
      t.near(d.frameStrip[i].material.color.getHex(), available ? 0x78a477 : s.readComplete ? 0xc14f39 : 0xe7dfce, 0, 'Frame strip exposes only arrived validity');
    }
    const before = structuredClone(s);
    for (const action of model.actions) { t.ok(action.replay === false, 'Inspection preserves experiment'); action.run(); assert.deepEqual(model.getState(), before); t.add(); }
    checkFinite(model.root, t);
  }
  outcomes.push({ title: trial.title, initial: trial.initialState, result: model.getState().status, stats: model.getState().stats });
  model.reset(trial.initialState); model.advance(20); model.reset(model.replayState());
  t.near(model.getState().time, trial.initialState.time, 0, 'Replay returns to named prepared time'); assert.deepEqual(model.getState().values, trial.values); t.add();
}
for (const control of model.controls) {
  const [lo, hi, step] = DVD_DOMAINS[control.key];
  for (let value = lo; value <= hi; value += step) {
    model.reset(); model.advance(3); model.update({ [control.key]: value }); const s = model.getState();
    t.near(s.values[control.key], value, 0, 'Each exposed control value applies');
    t.near(s.time, ['format', 'depth'].includes(control.key) || value === DVD_DEFAULTS[control.key] ? 3 : 0, 1e-12, 'Only reading changes restart');
    model.playback.step(); checkFinite(model.root, t);
    const f = model.scientificPlan().comparison;
    t.near(g.pickup.position.x, model.getState().spiral.radiusMm * .01, 1e-12, 'Each radius moves the drawn pickup');
    t.near(d.cover.scale.y, f.cover * .95, 1e-12, 'Format changes drawn clear-layer depth');
    t.ok(d.backing.visible === (f.backing > 0), 'CD has no invented backing above its reflective layer');
    for (let wave = 0; wave < 3; wave++) for (let i = 0; i <= 180; i++) {
      const angle = i / 180 * 4 * Math.PI, first = Math.sin(angle), second = Math.sin(angle + f.radians);
      const value = wave === 0 ? first : wave === 1 ? second : (first + second) / 2;
      t.near(d.phaseLines[wave].geometry.attributes.position.getY(i), [1.26, .20, -.86][wave] + .25 * value, 8e-8, 'Every drawn wave point follows selected optical phase');
    }
    controls.push({ key: control.key, value });
  }
}
model.reset(); model.playback.step(); t.near(model.getState().receivedCells, 1, 0, 'Early step is one channel cell');
model.reset({ time: 6 }); model.playback.step(); t.near(model.getState().frameIndex, 1, 0, 'Video step is one frame');
model.reset({ settings: { loss: 3 }, time: 7 }); t.ok(model.getState().picture === null, 'Missing frame has no image');
model.playback.step(); t.ok(model.getState().picture?.reference === 26, 'Step restores next actual picture');
for (const part of model.parts) t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(), part.id + ' contains geometry');
t.ok(lesson.parts.every(p => model.parts.some(x => x.name === p.name)), 'Lesson names match inspectable parts');
assert.equal(houseComponents.DVD.createModel, createDvdModel); assert.equal(houseComponents.DVD.lesson, lesson); t.add(2);
const resources = checkDisposal(model, t), report = { passed: true, checks: t.count, outcomes, controls, resources };
if (process.env.EVIDENCE_DIR) { await mkdir(process.env.EVIDENCE_DIR, { recursive: true }); await writeFile(process.env.EVIDENCE_DIR + '/model.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: true, checks: t.count, experiments: outcomes.length, controls: controls.length, resources }));

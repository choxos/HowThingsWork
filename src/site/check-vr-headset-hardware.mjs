import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVrHeadsetModel, COLORS} from './vr-headset-model.js';
import {audioCue, AUDIO, VR_DEFAULTS as D, VR_DOMAINS} from './vr-headset-physics.js';
import {vrHeadsetLesson as lesson} from './vr-headset-lessons.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';

const t = tally(), model = createVrHeadsetModel(), q = model.hardware, p = model.topology, mm = p.MM;
const near = (a, b, message, tolerance = 1e-9) => t.near(a, b, tolerance, message);
const state = () => JSON.stringify(model.getState());
const bounds = object => new THREE.Box3().setFromObject(object);
const contact = (a, b, message) => near(a / mm, b / mm, message, 1e-4);
const diagrams = ['timeline', 'errors', 'frames', 'view', 'optics', 'focus', 'sound'];
assert.equal(model.parts.length, 27);
assert.equal(model.controls.length, 10);
assert.deepEqual(model.controls.filter(control => control.primary).map(control => control.key), ['motion']);
assert.deepEqual(model.covers, [q.front, q.lid]);
assert.equal(model.initialPart, 'system');
assert(model.initialCutaway && model.initialIsolated && model.includeCoversInSeparation);
for (const id of diagrams) {
  const part = model.parts.find(item => item.id === id);
  assert.equal(part.object.userData.inspectionOnly, id);
  assert(part.object.userData.explosionExcluded);
  assert.deepEqual(model.partViewDirections[id].front, [0, 0, 3]);
}

// Reconstruct direct acoustic paths in world coordinates. Production rotates
// the source into head coordinates; this calculation rotates the ears instead.
let acousticCases = 0;
for (let source = -90; source <= 90; source += 15) for (let yaw = -180; yaw <= 180; yaw++) {
  const a = source * Math.PI / 180, b = yaw * Math.PI / 180;
  const s = [2 * Math.sin(a), 2 * Math.cos(a)];
  const ears = [1, -1].map(side => [side * .08 * Math.cos(b), -side * .08 * Math.sin(b)]);
  const distances = ears.map(ear => Math.hypot(s[0] - ear[0], s[1] - ear[1]));
  const cue = audioCue(source, yaw, true), delay = (distances[1] - distances[0]) / 343;
  near(cue.left, distances[0], 'independent world-space left path');
  near(cue.right, distances[1], 'independent world-space right path');
  near(cue.delay, delay, 'independent interaural delay');
  near(cue.leftDelay, Math.max(0, -delay), 'left relative arrival');
  near(cue.rightDelay, Math.max(0, delay), 'right relative arrival');
  t.ok(Math.abs(cue.delay) <= .16 / 343 + 1e-12, 'triangle inequality bounds the two-ear delay');
  near(audioCue(-source, -yaw, true).delay, -delay, 'left-right reflection reverses delay');
  near(audioCue(source, yaw, false).delay, audioCue(source, 0, true).delay, 'frozen cues ignore head rotation');
  acousticCases++;
}
assert.deepEqual(AUDIO, {earHalfSpacing: .08, sourceDistance: 2, soundSpeed: 343});
near(audioCue(60, 60).delay, 0, 'facing source equalizes paths');
near(audioCue(60, 0).delay * 1000, .4038959966228836, 'left cue before the turn');

const promised = [
  s => s.clock === 0,
  s => s.clock === 0,
  s => s.now.showing && s.shownYaw === 0 && p.panelObjects.every(object => object.visible),
  s => s.image.fromEye > 0 && s.values.screen < 45,
  s => s.image.fromEye === null && s.image.focus === 0,
  s => Math.abs(s.eyes.conflict - 2.832080200501253) < 1e-9,
  s => Math.abs(s.eyes.aim - s.image.focus) < .002,
  s => s.now.showing && Math.abs(s.offNow) > Math.abs(s.now.showing.slip),
  s => s.clock === s.worstSlip.flash && s.values.prediction === 0 && Math.abs(s.offNow + 2.3718342538613797) < 1e-9,
  s => s.clock === s.worstSlip.flash && s.values.latency === 60 && Math.abs(s.offNow + 6.839214832563318) < 1e-9,
  s => s.clock === s.worstSlip.flash && s.values.prediction === 1 && Math.abs(s.offNow + .6523127662776966) < 1e-9,
  s => s.clock === 3 && Math.abs(s.now.estimate - 61.8) < 1e-9,
  s => s.clock === 3 && Math.abs(s.endDrift) < .005 && Math.abs(s.worstDrift.value + .5712774248896153) < 1e-9,
  s => s.clock === 3 && s.now.head.angle === 0 && Math.abs(s.now.estimate - 1.5) < 1e-9,
  s => s.now.flashing && s.now.showing.n === 90,
  s => s.clock === 0 && Math.abs(s.audio.delay * 1000 - .4038959966228836) < 1e-9,
  s => s.clock === 1.5 && Math.abs(s.audio.delay) < 1e-12,
  s => s.clock === 1.5 && Math.abs(s.audio.delay * 1000 - .4038959966228836) < 1e-9,
  s => s.clock === s.worstSlip.flash && s.values.motion === 1 && s.values.prediction === 0 && Math.abs(s.offNow - 18.323007489047413) < 1e-9,
  s => model.playback.complete() && s.readings[0].value.startsWith('Largest flash-onset error'),
];
assert.equal(promised.length, lesson.tryIt.length);
for (const [i, experiment] of lesson.tryIt.entries()) {
  model.reset({time: 2, settings: {motion: 1, screen: 41, offset: 2, soundTracking: 0}});
  model.reset(experiment.initialState); model.update(experiment.values);
  assert.deepEqual(model.getState().values, experiment.values);
  assert.deepEqual(experiment.initialState.settings, experiment.values);
  near(model.getState().clock, experiment.initialState.time, 'preset exact time');
  t.ok(promised[i](model.getState()), experiment.title + ' opens with its promised observation');
  assert(model.parts.some(part => part.id === experiment.part));
  checkFinite(model.root, t);
}
for (const action of model.actions) {
  model.reset({time: 1.137, settings: {motion: 1, offset: 1.3, screen: 42.7, soundDirection: -45}});
  const before = state(); action.run(); assert.equal(state(), before, action.label + ' preserves time and all settings');
}
let controlCases = 0;
for (const [key, [min, max, step]] of Object.entries(VR_DOMAINS)) for (let index = 0; index <= Math.round((max - min) / step); index++) {
  const value = Number((min + index * step).toFixed(5)), settings = {...D, [key]: value};
  model.reset({time: 3, settings}); assert(model.playback.complete());
  model.reset(model.replayState()); assert.deepEqual(model.getState().values, settings);
  near(model.getState().clock, 0, 'replay keeps settings and resets clock');
  model.playback.step(); near(model.getState().clock, .01, 'one step advances 10 ms');
  const before = state(); model.update({[key]: value}); assert.equal(state(), before, 'unchanged control preserves state');
  model.update({[key]: value === min ? min + step : min}); near(model.getState().clock, .01, 'editing preserves inspection time');
  for (const other of Object.keys(D).filter(other => other !== key)) assert.equal(model.getState().values[other], settings[other]);
  const s = model.getState(); assert(s.readings.every(reading => !/NaN|Infinity|undefined/.test(reading.value)));
  for (const [i, delay] of [s.audio.leftDelay, s.audio.rightDelay].entries()) near(p.soundRows[i].marker.position.x, -1.2 + 2.4 * delay / .0005, 'drawn ear delay');
  controlCases++;
}
model.reset({time: 1}); model.advance(.5); const once = model.getState().clock;
model.reset({time: 1}); for (let i = 0; i < 5; i++) model.advance(.1); near(model.getState().clock, once, 'frame partition preserves time');

// Measure actual solid supports and their mating surfaces.
model.reset(); model.root.updateMatrixWorld(true);
for (const post of q.boardPosts) {
  contact(bounds(post).min.y, -17 * mm, 'interface standoff meets case floor');
  contact(bounds(post).max.y, bounds(q.board).min.y, 'interface standoff meets board');
}
contact(bounds(q.controller).min.y, bounds(q.board).max.y, 'interface chip sits on board');
for (const post of q.sensorPosts) {
  contact(bounds(post).min.y, bounds(q.sensorBraces[0]).max.y, 'sensor standoff meets brace');
  contact(bounds(post).max.y, (54 - .8) * mm, 'sensor standoff meets sensor board');
}
for (const stem of q.lensStems) {
  contact(bounds(stem).min.y, 39.4 * mm, 'lens stem meets rim');
  contact(bounds(stem).max.y, q.lensBeam.position.y, 'lens stem meets bridge center');
}
for (const beam of [q.lensBeam, ...q.sensorBraces]) {
  contact(bounds(beam).min.x, -89 * mm, 'bridge reaches left inside wall');
  contact(bounds(beam).max.x, 89 * mm, 'bridge reaches right inside wall');
}
for (const screen of [41, 42, 43, 44, 45]) {
  model.update({screen}); model.root.updateMatrixWorld(true);
  for (const [i, shaft] of q.shafts.entries()) {
    contact(bounds(shaft).min.z, (99 + screen + 3) * mm, 'shaft meets panel back');
    contact(bounds(shaft).max.z, 151 * mm, 'shaft enters sleeve');
    contact(bounds(q.sleeves[i]).max.z, 153 * mm, 'sleeve meets front cover');
  }
}
t.ok(1.1 * Math.cos(Math.PI / 48) > 1, 'telescoping shafts clear polygonal sleeve bore');
const left = bounds(q.cups[0]), right = bounds(q.cups[1]);
near((left.max.x - left.min.x) / mm, 12, 'earcup cylinder axis is left-right', 1e-4);
near((right.max.y - right.min.y) / mm, 48, 'earcup face is vertical', 1e-4);
contact(bounds(q.hostBox).min.y, -130 * mm, 'host rests at camera support plane');
const ray = new THREE.Raycaster(new THREE.Vector3(-100, 45, 132).multiplyScalar(mm), new THREE.Vector3(1, 0, 0), 0, 15 * mm);
const walls = p.headset.children.filter(child => child.isMesh && child.visible);
assert.equal(ray.intersectObjects(walls, false).length, 0, 'side connector aperture is not blocked by the case wall');

// Every cable segment endpoint is measured from its rendered cylinder. The
// flexible outer route also clears the worn case and mannequin at all yaw poses.
let poses = 0;
for (let degrees = -25; degrees <= 60; degrees++) {
  const yaw = degrees * Math.PI / 180;
  q.update(yaw, 44); model.root.updateMatrixWorld(true);
  for (const connection of q.connections) for (const [i, mesh] of connection.meshes.entries()) {
    const height = mesh.geometry.parameters.height / 2;
    for (const [end, sign] of [[i, -1], [i + 1, 1]]) {
      const actual = new THREE.Vector3(0, sign * height, 0).applyMatrix4(mesh.matrix);
      near(actual.distanceTo(new THREE.Vector3(...connection.points[end]).multiplyScalar(mm)), 0, 'rendered cable meets its route node', 1e-7);
    }
  }
  for (const point of q.hostCable.points) {
    const v = new THREE.Vector3(...point).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
    t.ok(v.x < -94 || v.x > 94 || v.y < -22 || v.y > 67 || v.z < 92 || v.z > 158, 'headset cable clears worn case with its radius');
    t.ok((v.x / 74) ** 2 + (v.y / 102) ** 2 + (v.z / 94) ** 2 > 1, 'headset cable clears mannequin');
    t.ok(point[1] >= -128, 'cable stays above support plane');
  }
  for (const connection of [q.hostCable, q.cameraCable]) for (const point of connection.points.slice(0, -1)) {
    if (Math.hypot(...point.map((v, i) => v - connection.points.at(-1)[i])) < 4) continue; // terminal mates to the host face
    t.ok(point[0] < -292 || point[0] > -208 || point[1] < -132 || point[1] > -78 || point[2] < -107 || point[2] > -13, 'cables approach host from outside its case');
  }
  poses++;
}
model.reset();
for (const [width, height] of [[760, 620], [360, 620]]) {
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .01, 100);
  camera.position.set(.7, 1.2, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const before = state(), explosion = createPartExplosion(model, camera, width / height, {width, height}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(category => category.id)), new Set(['headset', 'optical-module', 'electronic-module']));
  assert(!explosion.items.some(item => [...diagrams, 'wearer', 'camera', 'host', 'computer-links'].includes(item.id)));
  const inverse = camera.quaternion.clone().invert(), rectangle = item => {
    const box = new THREE.Box3();
    for (const x of [item.bounds.min.x, item.bounds.max.x]) for (const y of [item.bounds.min.y, item.bounds.max.y]) for (const z of [item.bounds.min.z, item.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(item.group.position).applyQuaternion(inverse));
    return box;
  };
  for (let i = 0; i < explosion.items.length; i++) for (let j = i + 1; j < explosion.items.length; j++) {
    const a = rectangle(explosion.items[i]), b = rectangle(explosion.items[j]);
    t.ok(a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.y <= b.min.y || b.max.y <= a.min.y, 'separated headset parts do not overlap');
  }
  explosion.dispose(); assert.equal(state(), before, 'inventory preserves experiment state');
}
assert.equal(p.conflictLine.material.color.getHex(), COLORS.faint);
checkFinite(model.root, t); const resources = checkDisposal(model, t);
console.log(`PASS headset hardware: ${t.count} checks, ${acousticCases} independent acoustic cases, ${poses} cable poses, ${lesson.tryIt.length} exact presets, ${controlCases} control values, ${model.actions.length} preserving actions, ${model.parts.length} parts, ${resources} resources released once.`);

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLeverEscapementModel} from './lever-escapement-model.js';
import {createWatchModel} from './watch-model.js';
import {leverEscapementLesson as lesson} from './watch-lessons.js';
import {WATCH_DEFAULTS as D} from './watch-physics.js';
import {houseComponents} from './house-components.js';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
import {checkDisposal, checkFinite, tally} from './model-check-kit.mjs';

const t = tally(), m = createLeverEscapementModel(), original = createWatchModel();
const equal = (a, b, message) => {assert.deepEqual(a, b, message); t.add();};
const read = label => m.getState().readings.find(r => r.label === label);
const histories = [D, {...D, hours: 44}, {...D, index: -5, alloy: 0, temperature: 40, hours: 43}];
const stages = ['Locked; balance free', 'Unlocking', 'Taking up fork clearance', 'Impulse', 'Free drop', 'Drawing to the bank', 'Locked; balance free', 'Unlocking', 'Impulse', 'Free drop', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Stopped; no continuing drive', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free'];
const sides = [0, 0, 0, 0, null, 1, 1, 1, 1, null, 0, 0, 0, 0, 0, 0, 0, 0];
equal(lesson.tryIt.length, 18);
for (const [i, p] of lesson.tryIt.entries()) for (const history of histories) {
  m.reset(); m.update(history); m.advance(100);
  m.reset(p.initialState); const returned = m.update(p.values), s = m.getState();
  equal(s.values, p.values, p.title); equal(returned, s.readings, 'Returned readings use dedicated lesson');
  equal(s.stage, stages[i], p.title); equal(s.contactSide, sides[i], p.title);
  t.near(s.time, p.initialState.phase / s.frequency, 1e-12);
  t.ok(m.parts.some(part => part.id === p.part), 'Every preset targets visible mechanism geometry');
  if (i === 1) t.ok(s.escape < 0 && s.forkContact === 'balance drives fork', 'Unlocking shows recoil and reversed power path');
  if (i === 3 || i === 8) equal(s.forkContact, 'fork drives balance');
  if (i === 4 || i === 9) equal(s.contact, null, 'Free drop is a physical contact gap');
  if (i === 10) {equal(s.beats, 2); t.near(s.escape, 2 * Math.PI / 15, 1e-12);}
  if (i === 12) {t.near(s.amplitude * 180 / Math.PI, 163.47, .005); t.near(s.beatEnergy * 1e6, .0321, .00005);}
  if (i === 13) {t.near(s.amplitude * 180 / Math.PI, 36.55, .005); t.near(s.outsidePassage, 66.75, .005);}
  if (i === 14) equal([s.running, s.power, s.beatEnergy, s.outsidePassage], [false, 0, 0, null]);
  if (i === 15) t.near(s.rate, 43.23, .005);
  if (i === 16) t.near(s.rate, -99.21, .005);
  if (i === 17) t.near(s.frequency, 4, 1e-12);
  const held = JSON.stringify(s); m.advance(0); equal(JSON.stringify(m.getState()), held);
}
for (const entry of lesson.parts) t.ok(m.parts.some(part => part.name === entry.name), 'Glossary matches selection names');
equal(houseComponents['Lever escapement'].createModel, createLeverEscapementModel);
const profiles = [D, {...D, hours: 24}, {...D, hours: 43}, {...D, hours: 44}, {...D, index: 5, alloy: 0, temperature: 0}, {...D, index: -5, alloy: 0, temperature: 40}];
let poses = 0, integrationSamples = 0;
for (const values of profiles) {
  m.reset(); m.update(values);
  const s = m.getState(), dt = values.temperature - 20;
  const growth = 1 + (values.alloy ? 8e-6 : 11.5e-6) * dt;
  const inertia = 49e-6 * (.0045 * (1 + 12e-6 * dt)) ** 2;
  const referenceInertia = 49e-6 * .0045 ** 2;
  const modulus = 195e9 * (values.alloy ? inertia / referenceInertia / growth ** 3 : 1 - 240e-6 * dt);
  const neutralLength = 195e9 * .00012 * .00003 ** 3 / (12 * referenceInertia * (2 * Math.PI * 4) ** 2);
  const stiffness = modulus * .00012 * growth * (.00003 * growth) ** 3 / (12 * neutralLength * (1 - .0002 * values.index) * growth);
  t.near(s.frequency, Math.sqrt(stiffness / inertia) / (2 * Math.PI), 1e-12);
  const torque = 200e9 * .0012 * .00014 ** 3 / (12 * .22) * 2 * Math.PI * (5.5 - values.hours / 8);
  const work = .3 * torque * (2 * Math.PI / (15 * 7680)) / 2;
  t.near(s.beatEnergy, work, 1e-18);
  if (s.running) {
    let free = 0;
    for (let j = 0; j < 100000; j++) {
      const angle = s.amplitude * Math.cos(2 * Math.PI * (j + .5) / 100000);
      if (Math.abs(angle) > 18.2334023803 * Math.PI / 180) free++;
    }
    integrationSamples += 100000;
    t.near(s.outsidePassage, free / 1000, .004, 'Numerical time fraction agrees with reported free interval');
    t.near(2 * Math.PI * s.energy / 250, 2 * work, 1e-18, 'Work replaces settled cycle loss');
  }
  for (let i = 0; i <= 80; i++) {
    for (const model of [m, original]) {model.reset({phase: i / 80}); model.update(values); model.root.updateMatrixWorld(true);}
    const s = m.getState(), base = original.getState();
    for (const key of ['escape', 'lever', 'angle', 'time', 'stage', 'contactSide', 'forkContact', 'beats', 'power', 'rate']) equal(s[key], base[key], 'Focused wrapper preserves underlying physics');
    const objects = model => {const p = model.topology; return [...p.forkWalls, ...p.forkHorns, p.jewel, p.safetyRoller, p.dart, ...p.palletMeshes, p.escapeWheel];};
    const actual = objects(m), expected = objects(original);
    for (let j = 0; j < actual.length; j++) {
      equal(actual[j].geometry.attributes.position.array, expected[j].geometry.attributes.position.array, 'Finite geometry unchanged');
      for (let k = 0; k < 16; k++) t.near(actual[j].matrixWorld.elements[k], expected[j].matrixWorld.elements[k], 1e-12, 'Fork regrouping preserves actual world contacts');
    }
    equal(read('Working contact').value, s.stage);
    equal(m.playback.blocked(), !s.running);
    t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(s.readings)), 'Finite readouts');
    if (i % 20 === 0) checkFinite(m.root, t);
    poses++;
  }
}
for (const values of profiles) for (const action of m.actions) {
  m.reset(); m.update(values); const returned = action.run(), s = m.getState();
  equal(s.values, values, 'Inspection preserves chosen winding and thermal settings');
  equal(returned, s.readings);
  t.ok(m.parts.some(part => part.id === action.part), 'Every action targets a selectable part');
  if (s.running) {
    for (const [name, stage] of [['unlocking', 'Unlocking'], ['impulse', 'Impulse'], ['free drop', 'Free drop'], ['fork clearance', 'Taking up fork clearance'], ['draw', 'Drawing to the bank']])
      if (action.label.endsWith(name)) equal(s.stage, stage, action.label);
  }
}
for (const id of ['fork', 'guard-dart', 'safety-roller', 'impulse-jewel']) {
  const box = m.frameBoundsForPart(id);
  t.ok(!box.isEmpty() && box.getSize(new THREE.Vector3()).length() < 1, 'Close view includes finite working area');
}
m.reset(); m.playback.step(); equal(m.getState().beats, 1); m.playback.step(); equal(m.getState().beats, 2);
t.near(m.getState().escape, 2 * Math.PI / 15, 1e-12);
m.advance(100); t.ok(m.playback.complete()); t.near(m.getState().time, 2, 1e-12);
const completed = JSON.stringify(m.getState()); m.advance(10); equal(JSON.stringify(m.getState()), completed);
m.reset(); t.ok(!m.playback.complete()); m.update({hours: 44});
const stopped = JSON.stringify(m.getState()); m.playback.step(); m.animate(20); equal(JSON.stringify(m.getState()), stopped);
m.update({hours: 0}); t.ok(!m.playback.blocked());
for (const bad of [NaN, Infinity, -1, 1.01]) {assert.throws(() => m.reset({phase: bad}), RangeError); t.add();}
m.reset();
for (const cover of m.covers) cover.visible = false;
m.root.updateMatrixWorld(true);
for (const id of ['fork', 'guard-dart', 'safety-roller', 'impulse-jewel']) {
  const target = m.parts.find(part => part.id === id), box = new THREE.Box3().setFromObject(target.object);
  let reachable = false;
  for (let y = 1; y < 16 && !reachable; y++) for (let x = 1; x < 16 && !reachable; x++) {
    const origin = new THREE.Vector3(box.min.x + (box.max.x - box.min.x) * x / 16, box.min.y + (box.max.y - box.min.y) * y / 16, 2);
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1)).intersectObject(m.root, true);
    for (const hit of hits) {
      let shown = true, owner;
      for (let object = hit.object; object; object = object.parent) {
        if (!object.visible || object.userData.inspectionOnly) shown = false;
        owner ||= m.parts.find(part => part.object === object);
      }
      if (!shown || !owner) continue;
      reachable = owner.id === id;
      break;
    }
  }
  t.ok(reachable, 'Visible ' + id + ' has a direct front-view pointer target');
}
const resources = checkDisposal(m, t); original.dispose();
let layouts = 0;
for (const values of [D, {...D, hours: 44}]) for (const aspect of [1, 1.16]) {
  const model = createLeverEscapementModel(); model.update(values); for (const cover of model.covers) cover.visible = false;
  const held = JSON.stringify(model.getState()), {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect);
  explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {
    const box = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return box;
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
    t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Inventory groups do not overlap');
  t.ok(boxes.length > 10);
  explosion.update(0); explosion.dispose(); equal(JSON.stringify(model.getState()), held); model.dispose(); layouts++;
}
console.log(JSON.stringify({passed: true, checks: t.count, presets: lesson.tryIt.length, histories: histories.length, poses, integrationSamples, actions: m.actions.length, layouts, resources}));

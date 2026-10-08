import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElectronicInkModel} from './electronic-ink-model.js';
import {electronicInkLesson} from './electronic-ink-lesson.js';
import {INK_WORDS} from './electronic-ink-physics.js';

const model = createElectronicInkModel(), g = model.topology;
model.root.updateMatrixWorld(true);
const overlapVolume = (a, b) => {
  const overlap = new THREE.Box3().setFromObject(a).intersect(new THREE.Box3().setFromObject(b));
  const size = overlap.getSize(new THREE.Vector3());return size.x * size.y * size.z;
};
assert(overlapVolume(g.battery, g.rowDriver) < 1e-10, 'Battery and row driver need separate physical space');
for (const rail of g.rails) assert(overlapVolume(g.substrate, rail) < 1e-10, 'The backplane fits inside the display frame');
const near = (a, b, tolerance = 1e-8) => assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const pointNear = (a, b) => assert(a.distanceTo(b) < 1e-7, `${a.toArray()} != ${b.toArray()}`);
const snapshot = () => JSON.stringify(model.getState());
assert.equal(model.parts.length, 10);assert.equal(model.catalogParts.length, 8);assert.equal(model.controls.length, 4);
assert.equal(electronicInkLesson.tryIt.length, 8);
assert.equal(g.pixels.length, 119);assert.equal(g.electrodes.length, 119);assert.equal(g.transistors.length, 119);
const pigmentColors = g.whitePigment.map(mesh => mesh.material.color.getHex());
model.update({light: 0});
assert.deepEqual(g.whitePigment.map(mesh => mesh.material.color.getHex()), pigmentColors, 'Darkening the page must not darken the independently lit capsule diagram');
model.reset();
let combinations = 0;
for (let word = 0; word < 4; word++) for (const contrast of [0, 1]) for (const power of [0, 1]) for (const light of [0, 1]) {
  const settings = {word, contrast, power, light};model.reset({settings});
  for (const dt of [0, .2, .6, 1.4, 10]) {
    model.advance(dt);const state = model.getState(), {now} = state;
    assert.deepEqual(state.values, settings);
    assert(g.pixels.every(mesh => [mesh.material.color.r, mesh.material.color.g, mesh.material.color.b].every(Number.isFinite)));
    for (const mesh of [...g.blackPigment, ...g.whitePigment]) assert(mesh.position.length() + .075 <= .84 + 1e-8, 'Particle stays inside capsule');
    const particles = [...g.blackPigment, ...g.whitePigment];
    for (let a = 0; a < particles.length; a++) for (let b = a + 1; b < particles.length; b++) assert(particles[a].position.distanceTo(particles[b].position) >= .15, 'Pigments do not overlap');
    g.blackPigment.forEach(mesh => near(mesh.position.y, -.48 + .96 * now.pixels[now.selected]));
    g.whitePigment.forEach(mesh => near(mesh.position.y, .48 - .96 * now.pixels[now.selected]));
    for (const [arrow, direction] of [[g.fieldArrow, now.field], [g.blackArrow, now.blackForce], [g.whiteArrow, now.whiteForce]]) {
      assert.equal(arrow.visible, direction !== 0);
      if (direction) near(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion).y, direction);
    }
    assert(g.bottomText.userData.labelText.includes(`${now.voltage} V`));
    near(g.selectedRing.position.x, (now.selected % 17 - 8) * .18);near(g.selectedRing.position.y, .89 - Math.floor(now.selected / 17) * .18);
    if (!light) assert(g.pixels.every(mesh => mesh.material.color.getHex() === 0x29352c));
  }
  const final = model.getState();assert(final.now.complete && model.playback.complete());
  if (power) {
    assert.equal(final.now.readback.text, INK_WORDS[word].text);assert.equal(final.now.readback.contrast, contrast);
    assert(final.now.voltages.every(value => value === 0));
    if (light) final.now.pixels.forEach((value, i) => assert.equal(g.pixels[i].material.color.getHex(), value ? 0x29352c : 0xf5f1dc));
  } else assert(final.now.pixels.every(value => value === 0));
  const before = snapshot();for (const action of model.actions) {action.run();assert.equal(snapshot(), before, 'Inspection preserves state');}
  combinations++;
}
const outcomes = [];
for (const trial of electronicInkLesson.tryIt) {
  assert.deepEqual(trial.values, trial.initialState.settings);
  assert(model.parts.some(part => part.id === trial.part));assert(trial.reset && trial.isolate && trial.view === 'front');
  model.reset(trial.initialState);const initial = model.getState();model.advance(100);const final = model.getState();
  outcomes.push({title:trial.title,word:final.now.readback.text,contrast:final.now.readback.contrast,visible:final.now.visible});
  if (trial.values.power) {assert.equal(final.now.readback.text, INK_WORDS[trial.values.word].text);assert.equal(final.now.readback.contrast, trial.values.contrast);}
  else assert.deepEqual(final.now.pixels, initial.now.pixels);
  const replay = model.replayState();model.reset(replay);assert.deepEqual(model.getState().now.pixels, initial.plan.start);
  model.advance(100);assert.deepEqual(model.getState().now.pixels, final.now.pixels);
}
assert.deepEqual(outcomes.map(row => row.word), ['INK', 'CAR', 'INK', '', 'INK', 'INK', 'CAR', null]);
model.reset({settings:{word:0},pixels:INK_WORDS[0].pixels});
model.update({power:0,word:2});model.advance(10);assert.equal(model.getState().now.readback.text, 'INK');
model.update({power:1});model.advance(100);assert.equal(model.getState().now.readback.text, 'CAR');
model.update({light:0});const darkState = model.getState();model.update({light:1});assert.deepEqual(model.getState().now.pixels, darkState.now.pixels);assert.equal(model.getState().clock, darkState.clock);
model.reset();model.advance(.4);const before = snapshot();
for (const dt of [-1, NaN, Infinity, 0]) {model.advance(dt);assert.equal(snapshot(), before);}
for (const bad of [{word:7},{contrast:.5},{power:NaN},{light:Infinity},{ink:1},null,[]]) {assert.throws(() => model.update(bad));assert.equal(snapshot(), before);}
model.reset();model.root.updateMatrixWorld(true);
const assemblyBounds = new THREE.Box3().setFromObject(g.assembly), wholeBounds = new THREE.Box3().setFromObject(model.root);
pointNear(assemblyBounds.getCenter(new THREE.Vector3()), wholeBounds.getCenter(new THREE.Vector3()));
assert(Number.isFinite(model.overviewZoom) && model.overviewZoom > 0);
assert.equal(model.inspectionObjects('capsule')[0], g.capsule);assert.equal(g.capsule.userData.inspectionOnly, 'capsule');
assert.deepEqual(model.covers, [g.ink, g.common]);
const localBounds = mesh => new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).translate(mesh.position);
near(localBounds(g.support).max.z, localBounds(g.substrate).min.z, 1e-7);
near(localBounds(g.support).max.z, localBounds(g.battery).min.z, 1e-7);
near(localBounds(g.support).max.z, localBounds(g.controllerBoard).min.z, 1e-7);
near(localBounds(g.support).max.z, localBounds(g.switchBase).min.z, 1e-7);
near(localBounds(g.support).max.z, localBounds(g.rowDriver).min.z, 1e-7);
near(localBounds(g.support).max.z, localBounds(g.columnDriver).min.z, 1e-7);
near(localBounds(g.substrate).max.z, localBounds(g.electrodes[0]).min.z, 1e-7);
near(localBounds(g.electrodes[0]).max.z, localBounds(g.film).min.z, 1e-7);
near(localBounds(g.film).max.z, localBounds(g.pixels[0]).min.z, 1e-7);
near(localBounds(g.pixels[0]).max.z, localBounds(g.commonSheet).min.z, 1e-7);
near(localBounds(g.controllerBoard).max.z, localBounds(g.chip).min.z, 1e-7);
const end = new THREE.Vector3(.30,0,0).applyMatrix4(g.switchPivot.matrixWorld), contact = g.switchContacts[1].getWorldPosition(new THREE.Vector3());
pointNear(end,contact);model.update({power:0});model.root.updateMatrixWorld(true);
assert(new THREE.Vector3(.30,0,0).applyMatrix4(g.switchPivot.matrixWorld).distanceTo(contact)>.1);
const resources = new Set();
model.root.traverse(object => {
  if(object.geometry) {resources.add(object.geometry);assert([...object.geometry.attributes.position.array].every(Number.isFinite));}
  for(const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
    resources.add(material);for(const value of Object.values(material)) if(value?.isTexture) resources.add(value);
  }
});
const disposed = new Map([...resources].map(resource => [resource,0]));
for(const resource of resources) resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
model.dispose();model.dispose();assert([...disposed.values()].every(count=>count===1));
console.log(`PASS: ${combinations} model combinations, 8 prepared experiments, 10 parts, pigment bounds, nonintersection, field directions, physical contacts, inspection preservation and ${resources.size} singly disposed resources.`);

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {partOwner, partVisible, presentMechanism} from './kit.ts';
import {buildFlying} from './mechanisms/flying.ts';
import {buildGearsAndBelts} from './mechanisms/gears-and-belts.ts';
import {buildLightAndImages} from './mechanisms/light-and-images.ts';
import {buildScrews} from './mechanisms/screws.ts';
import {buildPrinting} from './mechanisms/printing.ts';

const state = {value: 32, variant: 'double', phase: 0.5, elapsed: 0};
test('double-start screws have two separate helices at the same lead', () => {
  const model = buildScrews();
  model.update(state);
  const ridges = model.parts.thread.children.filter((node): node is THREE.Mesh<THREE.TubeGeometry> =>
    node instanceof THREE.Mesh && node.geometry instanceof THREE.TubeGeometry && node.visible);
  assert.equal(ridges.length, 2);
  assert.ok(Math.abs(ridges[1].rotation.y - ridges[0].rotation.y - Math.PI) < 1e-10);
  model.update({...state, variant: 'single'});
  assert.equal(ridges.filter(node => node.visible).length, 1);
});
test('nut travel stays coupled to wrench turns up to the mechanical stop', () => {
  const model = buildScrews();
  for (const phase of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1]) {
    model.update({...state, phase});
    const turns = -model.parts.lever.rotation.y / (Math.PI * 2);
    assert.ok(Math.abs(model.parts.nut.position.y - (2 - turns * 32 * 2 * 0.008)) < 1e-10);
    assert.ok(model.parts.nut.position.y >= 0.72 - 1e-10);
  }
});

test('isolating the nested flap preserves its world transform and nearest ownership', () => {
  const model = buildFlying();
  model.update({...state, value: 10, variant: 'flaps'});
  const flap = model.parts.flap.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const wing = model.parts.wing.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.equal(partOwner(model, flap), 'flap');
  model.group.updateMatrixWorld(true);
  const before = flap.matrixWorld.clone();
  const presentation = presentMechanism(model, 'flap', true);
  assert.equal(presentation.isolating, true);
  assert.equal(partVisible(flap), true);
  assert.equal(partVisible(wing), false);
  model.group.updateMatrixWorld(true);
  assert.deepEqual(flap.matrixWorld.elements, before.elements);
  assert.equal(flap.material.emissiveIntensity, 0.09);
  assert.equal(wing.material.emissiveIntensity, 1);
  presentation.restore();
  assert.equal(partVisible(wing), true);
  assert.equal(flap.material.emissiveIntensity, 1);
  const wingPresentation = presentMechanism(model, 'wing', false);
  assert.equal(wing.material.emissiveIntensity, 0.09);
  assert.equal(flap.material.emissiveIntensity, 1);
  wingPresentation.restore();
});

test('presentation preserves model visibility and ignores isolation of an absent image', () => {
  const model = buildLightAndImages();
  model.update({...state, value: 110, variant: 'converging'});
  const presentation = presentMechanism(model, 'image', true);
  assert.equal(presentation.isolating, false);
  assert.equal(partVisible(model.parts.image), false);
  assert.equal(partVisible(model.parts.object.children[0]), true);
  presentation.restore();
  model.update({...state, value: 300, variant: 'converging'});
  const next = presentMechanism(model, 'image', true);
  assert.equal(next.isolating, true);
  assert.equal(partVisible(model.parts.image), true);
  assert.equal(partVisible(model.parts.object.children[0].children[0]), false);
  next.restore();
});

test('materials created or replaced during update receive the current highlight', () => {
  const model = buildGearsAndBelts();
  assert.equal(model.parts.belt.children.length, 0);
  for (const value of [12, 24]) {
    model.update({...state, value, variant: 'belt'});
    const material = (model.parts.belt.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material;
    material.emissiveIntensity = value / 10;
    const presentation = presentMechanism(model, 'belt', false);
    assert.equal(material.emissiveIntensity, 0.09);
    assert.equal(partVisible(model.parts.teeth.children[0]), false);
    presentation.restore();
    assert.equal(material.emissiveIntensity, value / 10);
  }
  model.update({...state, value: 12, variant: 'gears'});
  const presentation = presentMechanism(model, 'belt', true);
  assert.equal(presentation.isolating, false);
  assert.equal(partVisible(model.parts.belt.children[0]), false);
  assert.equal(partVisible(model.parts.teeth.children[0]), true);
  presentation.restore();
});


test('printing retains static instance buffers and still responds to both controls', () => {
  const model = buildPrinting();
  const input = {...state, value: 300, variant: 'process'};
  model.update(input);
  const screens = model.parts.dots.children as THREE.InstancedMesh[];
  const versions = screens.map(mesh => mesh.instanceMatrix.version);
  const counts = screens.map(mesh => mesh.count);
  const presentation = presentMechanism(model, 'angles', true);
  presentation.restore();
  model.update({...input, elapsed: 1});
  assert.deepEqual(screens.map(mesh => mesh.instanceMatrix.version), versions);
  assert.ok(screens.every(mesh => mesh.visible));
  model.update({...input, value: 75});
  assert.ok(screens.every((mesh, i) => mesh.count < counts[i]));
  model.update({...input, value: 75, variant: 'black'});
  assert.deepEqual(screens.map(mesh => mesh.visible), [false, false, false, true]);
  model.update(input);
  assert.deepEqual(screens.map(mesh => mesh.count), counts);
  assert.ok(screens.every(mesh => mesh.visible));
});

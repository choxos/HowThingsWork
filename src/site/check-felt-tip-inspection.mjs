import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFeltTipModel, MM} from './felt-tip-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkDisposal} from './model-check-kit.mjs';
const t = tally(), model = createFeltTipModel(), B = model.topology;
let poses = 0, inventories = 0, vertexSamples = 0;
// Float32 vertices have roughly 1e-8 scene-unit uncertainty at these dimensions.
const localBox = object => {object.geometry.computeBoundingBox(); return object.geometry.boundingBox.clone().applyMatrix4(object.matrix);};
for (const ink of [0, 1]) for (const speed of [5, 40]) for (const hold of [0, 4]) for (const time of [0, .5, 12]) {
  model.reset({settings: {ink, speed, hold}, time}); model.root.updateMatrixWorld(true);
  const tip = localBox(B.nibCone), shank = localBox(B.nibShank), core = localBox(B.core);
  t.near(tip.min.y, 0, 5e-8, 'square tip touches paper');
  t.near(tip.max.y, shank.min.y, 5e-8, 'taper and shank touch');
  t.near(shank.max.y, core.min.y, 5e-8, 'nib meets reservoir without gap or overlap');
  t.near(core.min.y / MM, 10, 1e-6, 'actual reservoir contact gives declared 10 mm wet path');
  const attr = B.nibCone.geometry.attributes.position;
  const base = new THREE.Box3();
  for (let i = 0; i < attr.count; i++) {const p = new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(B.nibCone.matrix); if (Math.abs(p.y) < 1e-9) base.expandByPoint(p);}
  t.near((base.max.x - base.min.x) / MM, 1, 1e-6, 'square contact length matches exposure law');
  t.near((base.max.z - base.min.z) / MM, 1, 1e-6, 'square contact width matches stain model');
  const neck = localBox(B.neckBack), body = localBox(B.bodyBack), holder = localBox(B.nibHolder);
  t.near(neck.max.y, body.min.y, 5e-8, 'body meets neck');
  t.near(neck.min.y, holder.min.y, 5e-8, 'square-hole nib support meets neck');
  t.ok(holder.min.y > shank.min.y && holder.max.y < shank.max.y, 'holder supports the shank');
  t.ok(core.max.y < localBox(B.rearPlug).min.y, 'air gap below vented plug');
  for (const mesh of [B.nibCone, B.nibShank, B.core, B.nibHolder, B.rearPlug, B.line, ...B.poreInks]) {
    const a = mesh.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {t.ok([a.getX(i), a.getY(i), a.getZ(i)].every(Number.isFinite), 'finite physical geometry'); vertexSamples++;}
  }
  poses++;
}
for (const pore of [5, 25]) for (const time of [0, 4]) for (const aspect of [.55, 1.3, 2]) {
  model.reset({settings: {pore}, time}); model.root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(40, aspect, .01, 200); camera.position.set(0, .2, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const before = new Map(); model.root.traverse(o => before.set(o.uuid, o.matrixWorld.clone()));
  const explosion = createPartExplosion(model, camera, aspect, {width: 600 * aspect, height: 600}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c => c.id)), new Set(['barrel', 'reservoir', 'nib']));
  const inverse = camera.quaternion.clone().invert();
  const projected = explosion.items.map(item => {
    const b = item.bounds.clone().translate(item.group.position), p = new THREE.Box3();
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) p.expandByPoint(new THREE.Vector3(x, y, z).applyQuaternion(inverse));
    return p;
  });
  for (let i = 0; i < projected.length; i++) for (let j = i + 1; j < projected.length; j++) {
    const a = projected[i], b = projected[j]; t.ok(a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y, 'inventory pieces have disjoint screen rectangles');
  }
  explosion.update(0); explosion.dispose(); model.root.updateMatrixWorld(true);
  model.root.traverse(o => assert.deepEqual(o.matrixWorld.elements, before.get(o.uuid).elements, 'reassembly restores every working transform'));
  inventories++;
}
// Replaced pore geometry is released immediately, then final resources once.
let replaced = 0;
for (const pore of [5, 10, 15, 20, 25]) {
  const old = [...B.poreInks.map(m => m.geometry)];
  old.forEach(g => g.addEventListener('dispose', () => replaced++));
  model.update({pore});
}
t.ok(replaced === 10, 'all replaced pore meshes released once');
const resources = checkDisposal(model, t);
console.log(JSON.stringify({passed: true, checks: t.count, poses, vertexSamples, inventories, resources}));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDipPenModel, MM, TIP_WINDOW} from './dip-pen-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkDisposal, checkFinite} from './model-check-kit.mjs';

const t = tally(), model = createDipPenModel(), B = model.topology;
let poses = 0, inventories = 0, vertices = 0;
const reset = (settings, time) => {model.reset({settings, time}); model.root.updateMatrixWorld(true); return model.getState();};
const material = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
function steelAt(x, y) {
  const mesh = new THREE.Mesh(B.plate.geometry, material); mesh.updateMatrixWorld();
  return new THREE.Raycaster(new THREE.Vector3(x * MM, y * MM, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mesh).length > 0;
}
function connected(geometry) {
  const a = geometry.attributes.position, index = geometry.index;
  const key = i => [a.getX(i), a.getY(i), a.getZ(i)].map(n => Math.round(n * 1e9)).join(',');
  const edges = new Map(), n = index ? index.count : a.count;
  for (let i = 0; i < n; i += 3) {
    const ids = [0, 1, 2].map(k => key(index ? index.getX(i + k) : i + k));
    for (const id of ids) {if (!edges.has(id)) edges.set(id, new Set()); for (const other of ids) edges.get(id).add(other);}
  }
  const visited = new Set(), todo = [edges.keys().next().value];
  while (todo.length) {const key = todo.pop(); if (visited.has(key)) continue; visited.add(key); for (const v of edges.get(key)) if (!visited.has(v)) todo.push(v);}
  return visited.size === edges.size;
}
for (const press of [0, .5, 1]) for (const load of [0, 2]) for (const time of [0, .25, .75, 1.25, 1.75, 2.1, 3, 6.2]) {
  const s = reset({press, load}, time), n = s.now;
  t.ok(connected(B.plate.geometry), 'two tines remain one connected steel sheet');
  for (const y of [.1, 3, 8.9, 10]) t.ok(!steelAt(0, y), 'slit and vent remain open');
  t.ok(steelAt(0, 12) && steelAt(-.5, 3) && steelAt(.5, 3), 'both tines join solid steel above vent');
  for (const mesh of [B.plate, ...B.detailTines, B.slotInk, B.detailInk]) {
    const a = mesh.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {t.ok([a.getX(i), a.getY(i), a.getZ(i)].every(Number.isFinite), 'finite replacement geometry'); vertices++;}
  }
  // Actual and enlarged tines use the same physical local endpoints.
  for (const [i, mesh] of B.detailTines.entries()) {
    const a = mesh.geometry.attributes.position, side = i ? 1 : -1;
    for (const y of [0, TIP_WINDOW]) {
      const xs = [];
      for (let j = 0; j < a.count; j++) if (Math.abs(a.getY(j) / MM - y) < 1e-5) xs.push(side * a.getX(j) / MM);
      t.near(Math.min(...xs), (.02 + .1 * n.force * (1 - y / 9)) / 2, 1e-7, 'enlarged inner edge matches actual slit');
      t.near(Math.max(...xs), .05 + 3.45 * y / 20 + .05 * n.force * (1 - y / 9), 1e-7, 'enlarged outer edge matches connected nib');
    }
  }
  const a = B.plate.geometry.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < a.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(B.plate.matrixWorld).divideScalar(MM);
    minY = Math.min(minY, p.y);
    if (n.x === 0 && p.y < 8) t.ok(Math.hypot(p.x, p.z) < 11.5, 'immersed nib clears inner well wall');
  }
  t.near(minY, n.height, 2e-6, 'lowest actual steel edge follows stated height');
  const holderBox = new THREE.Box3().setFromObject(B.holder);
  if (n.x === 0) t.ok(holderBox.min.y / MM > 8, 'holder stays above inkwell rim');
  t.ok(B.detailPaper.visible === n.touching, 'enlarged paper appears only at actual contact');
  t.ok(B.detailInk.visible === (n.remaining > 1e-12), 'both views agree whether ink remains');
  if (n.travel - n.inked >= 1.5) t.ok(!B.detailLine.visible, 'no invented trail behind an exhausted tip');
  checkFinite(model.root, t); poses++;
}
// Test the physical socket opening with rays through its transformed geometry.
reset({}, 0);
const socket = new THREE.Mesh(B.socket.geometry, material); socket.rotation.copy(B.socket.rotation); socket.position.copy(B.socket.position); socket.updateMatrixWorld();
for (const x of [-3.4, 0, 3.4]) {
  const hit = new THREE.Raycaster(new THREE.Vector3(x * MM, .4, 0), new THREE.Vector3(0, -1, 0)).intersectObject(socket);
  t.ok(hit.length === 0, 'steel shank fits inside continuous rectangular socket');
}
for (const z of [-.2, .2]) t.ok(new THREE.Raycaster(new THREE.Vector3(0, .4, z * MM), new THREE.Vector3(0, -1, 0)).intersectObject(socket).length > 0, 'wood supports both faces beside thin shank');
for (const press of [0, 1]) for (const time of [0, 6.2]) for (const aspect of [.55, 1.3, 2]) {
  reset({press}, time);
  const camera = new THREE.PerspectiveCamera(40, aspect, .01, 200); camera.position.set(0, .2, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const before = new Map(); model.root.traverse(o => before.set(o.uuid, o.matrixWorld.clone()));
  const explosion = createPartExplosion(model, camera, aspect, {width: 600 * aspect, height: 600}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c => c.id)), new Set(['holder', 'nib']));
  t.ok(explosion.items.length === 2, 'retained ink stays with its connected nib during separation');
  const inverse = camera.quaternion.clone().invert();
  const projected = explosion.items.map(item => {
    const b = item.bounds.clone().translate(item.group.position), p = new THREE.Box3();
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) p.expandByPoint(new THREE.Vector3(x, y, z).applyQuaternion(inverse));
    return p;
  });
  for (let i = 0; i < projected.length; i++) for (let j = i + 1; j < projected.length; j++) {
    const a = projected[i], b = projected[j]; t.ok(a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y, 'separated pieces occupy disjoint screen rectangles');
  }
  explosion.update(0); explosion.dispose(); model.root.updateMatrixWorld(true);
  model.root.traverse(o => assert.deepEqual(o.matrixWorld.elements, before.get(o.uuid).elements, 'reassembly restores working transform')); inventories++;
}
reset({press: 1}, 2.05);
const old = [B.plate, ...B.detailTines, B.slotInk, B.detailInk].map(m => m.geometry), counts = old.map(() => 0);
old.forEach((g, i) => g.addEventListener('dispose', () => counts[i]++)); model.advance(.05);
assert.deepEqual(counts, [1, 1, 1, 1, 1], 'replaced steel and ink geometries released immediately once');
material.dispose(); const resources = checkDisposal(model, t);
// Include construction-time copies that no longer occur in the live scene.
// A scene traversal alone cannot detect a material abandoned during setup.
const clone = THREE.Material.prototype.clone, copies = [];
let fresh;
try {
  THREE.Material.prototype.clone = function () {
    const material = clone.call(this), record = {disposed: 0}; copies.push(record);
    material.addEventListener('dispose', () => record.disposed++); return material;
  };
  fresh = createDipPenModel();
} finally {THREE.Material.prototype.clone = clone;}
fresh.dispose(); fresh.dispose();
t.ok(copies.every(copy => copy.disposed === 1), 'every construction-time material copy is released exactly once');
console.log(JSON.stringify({passed: true, checks: t.count, poses, vertices, inventories, resources}));

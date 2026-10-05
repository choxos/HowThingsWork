import * as THREE from 'three';
import {surface} from './scene-kit.js';

/** A leaf's visible deflection between its supports; no beam-stress solution. */
export function createStaplerLeaf(kit, parent, {from, to, width = 3, thickness = .25, scale = .01}) {
  const count = 33, geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(count * 4 * 3), indices = [];
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  for (let i = 0; i < count - 1; i++) for (let face = 0; face < 4; face++) {
    const a = i * 4 + face, b = i * 4 + (face + 1) % 4, c = b + 4, d = a + 4;
    indices.push(a, b, d, b, c, d);
  }
  indices.push(0, 3, 1, 1, 3, 2);
  const end = (count - 1) * 4;
  indices.push(end, end + 1, end + 3, end + 1, end + 2, end + 3);
  geometry.setIndex(indices);
  const mesh = surface(kit, geometry, 'metal', parent);
  mesh.userData.leafSpring = true;
  function update(upper, lower) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1), x = from + (to - from) * t;
      const lo = lower(x), hi = upper(x), gap = hi - lo;
      if (gap < thickness - 1e-9) throw new RangeError('Stapler leaf spring has insufficient clearance');
      const blend = 1 - t * t * (3 - 2 * t), y = lo + thickness / 2 + (gap - thickness) * blend;
      for (const [corner, dy, dz] of [[0, -1, -1], [1, 1, -1], [2, 1, 1], [3, -1, 1]]) {
        geometry.attributes.position.setXYZ(i * 4 + corner, x * scale, (y + dy * thickness / 2) * scale, dz * width / 2 * scale);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  return {mesh, update, from, to, width, thickness, count};
}

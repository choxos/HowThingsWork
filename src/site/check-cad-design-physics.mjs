import assert from 'node:assert/strict';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {designPlan, designAt, DESIGN_DEFAULTS, DESIGN_DOMAINS} from './printing-physics.js';
import {cupSurface, designLayerPaths} from './cad-design-geometry.js';

let checks = 0, meshes = 0, paths = 0;
const near = (a, b, tolerance = 1e-8) => { checks++; assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} != ${b}`); };
const d = DESIGN_DEFAULTS;
assert.equal(designPlan({...d, perimeters: 4}).thin, true, 'opposing four-loop shells must be reduced');

function checkMesh(mesh, expectedVolume) {
  const edges = new Map(); let volume = 0;
  for (const [a, b, c] of mesh.faces) {
    const p = mesh.vertices[a], q = mesh.vertices[b], r = mesh.vertices[c];
    const cross = [q[1] * r[2] - q[2] * r[1], q[2] * r[0] - q[0] * r[2], q[0] * r[1] - q[1] * r[0]];
    volume += p.reduce((sum, x, i) => sum + x * cross[i], 0) / 6;
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const key = [Math.min(x, y), Math.max(x, y)].join(':'), edge = edges.get(key) || [];
      edge.push(x < y ? 1 : -1); edges.set(key, edge);
    }
  }
  for (const orientations of edges.values()) { assert.equal(orientations.length, 2); assert.equal(orientations[0], -orientations[1]); }
  assert.equal(mesh.vertices.length - edges.size + mesh.faces.length, 2);
  near(volume, expectedVolume); meshes++;
}

function checkPlan(values) {
  const p = designPlan(values), n = p.facets, crossArea = r => {
    const ring = Array.from({length: n}, (_, i) => [r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n)]);
    return ring.reduce((sum, [x, y], i) => { const next = ring[(i + 1) % n]; return sum + x * next[1] - y * next[0]; }, 0) / 2;
  };
  const volume = crossArea(p.radius) * p.height - crossArea(p.radius - p.wall) * (p.height - p.wall);
  checkMesh(p.surface, volume); near(p.facetedVolume, volume);
  assert.equal(p.triangles, p.surface.faces.length);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p.surface.vertices.flat(), 3));
  geometry.setIndex(p.surface.faces.flat());
  const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  const binary = new STLExporter().parse(mesh, {binary: true});
  assert.equal(binary.byteLength, p.bytes); assert.equal(binary.getUint32(80, true), p.triangles);
  geometry.dispose(); material.dispose();
  let total = 0, materialVolume = 0, previousTop = 0;
  const distinct = new Set();
  for (const slice of p.slices) {
    near(slice.bottom, previousTop); near(slice.top - slice.bottom, slice.height); previousTop = slice.top;
    assert.ok(slice.height > 0 && slice.height <= p.layer + 1e-9);
    assert.equal(slice.floor, slice.middle < p.base);
    if (!distinct.has(slice.paths)) {
      distinct.add(slice.paths); let length = 0;
      const normals = Array.from({length: n}, (_, i) => [Math.cos(2 * Math.PI * i / n), Math.sin(2 * Math.PI * i / n)]);
      const outside = p.radius * Math.cos(Math.PI / n), inside = p.inner * Math.cos(Math.PI / n);
      const loops = slice.paths.filter(path => path.kind === 'perimeter');
      assert.equal(loops.length, slice.loopCount);
      for (let i = 0; i < loops.length; i++) for (let j = i + 1; j < loops.length; j++) {
        assert.ok(Math.abs(loops[i].apothem - loops[j].apothem) >= slice.spacing - 1e-9);
      }
      for (const path of slice.paths) {
        let measured = 0;
        for (let i = 1; i < path.points.length; i++) {
          const a = path.points[i - 1], b = path.points[i]; measured += Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let t = 0; t <= 1; t += .25) {
            const x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]);
            const dots = normals.map(([nx, ny]) => nx * x + ny * y);
            assert.ok(dots.every(dot => dot <= outside - p.width / 2 + 1e-8), 'path footprint outside object');
            if (!slice.floor) assert.ok(dots.some(dot => dot >= inside + p.width / 2 - 1e-8), 'path footprint inside pocket');
          }
        }
        near(measured, path.length); length += measured; paths++;
      }
      near(length, slice.length);
    }
    total += slice.length; materialVolume += slice.length * (p.width * slice.height - slice.height ** 2 * (1 - Math.PI / 4));
  }
  near(previousTop, p.height); near(total, p.totalPath); near(materialVolume, p.printVolume);
  assert.equal(p.layers, p.slices.length);
  assert.ok(p.slices.some(slice => Math.abs(slice.top - p.base) < 1e-9));
  near(designAt(p, p.duration).solid, volume);
}

checkPlan(d);
for (const [key, [min, max, step]] of Object.entries(DESIGN_DOMAINS)) {
  for (let value = min; value <= max + 1e-9; value += step) checkPlan({...d, [key]: Number(value.toFixed(8))});
  assert.throws(() => designPlan({...d, [key]: NaN}), RangeError);
}
for (let bits = 0; bits < 256; bits++) {
  const values = {...d}; Object.entries(DESIGN_DOMAINS).forEach(([key, domain], i) => { values[key] = domain[(bits >> i) & 1]; });
  checkPlan(values);
}
// Enumerate every setting that can change the wall-fitting decision; radius and height do not enter it.
let combinations = 0;
for (let n = 8; n <= 128; n += 8) for (let w = 8; w <= 30; w++) for (let h = 1; h <= 6; h++) for (let b = 7; b <= 14; b++) for (let loops = 1; loops <= 4; loops++) {
  const wall = w / 10, height = h / 20, width = b / 20, spacing = width - height * (1 - Math.PI / 4);
  const thickness = wall * Math.cos(Math.PI / n);
  const fits = Math.max(0, Math.floor((thickness - width) / spacing + 1 + 1e-9));
  const p = designLayerPaths({radius: 6, inner: 6 - wall, facets: n, width, perimeters: loops, infill: 0}, height);
  assert.equal(p.loopCount, Math.min(2 * loops, fits - fits % 2) || 1);
  assert.ok(width + (p.loopCount - 1) * spacing <= thickness + 1e-9);
  combinations++;
}
assert.equal(designPlan({...d, height: 24, layer: .05}).layers, 480);
const split = designPlan({...d, wall: .8, layer: .3});
assert.ok(split.slices.filter(s => s.height < .3 - 1e-9).length >= 1);
const many = designPlan({...d, wall: .8, width: .7, perimeters: 4});
assert.equal(many.wallSlice.loopCount, 1); assert.equal(many.thin, true);
checkMesh(cupSurface(12, 9.6, 32, 12, 0), 32 * 12 ** 2 * Math.sin(2 * Math.PI / 32) / 2 * 12);
console.log(JSON.stringify({ok: true, checks, meshes, paths, fittingCombinations: combinations}));

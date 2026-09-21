import * as THREE from 'three';

// Spherical involute flanks, extruded along rays from a common cone apex.
// Unwind a great-circle arc s from the base circle: azimuth = s/sin(base)
// minus atan2(sin(s), sin(base)*cos(s)). At pitch, sin(base)=sin(pitch)*cos(alpha).
// The two whisk gears share cone distance and have complementary pitch angles.
// This is an ideal rigid teaching gear, not a cutter or tooth-strength model.
const TAU = 2 * Math.PI;
const involute = (polar, base) => {
  const s = Math.acos(Math.min(1, Math.cos(polar) / Math.cos(base)));
  return s / Math.sin(base) - Math.atan2(Math.sin(s), Math.sin(base) * Math.cos(s));
};

export function whiskBevelSpec(teeth, mateTeeth) {
  const module = 2.5, pitch = Math.atan(teeth / mateTeeth);
  const distance = module * Math.hypot(teeth, mateTeeth) / 2;
  const base = Math.asin(Math.sin(pitch) * Math.cos(25 * Math.PI / 180));
  const root = pitch - Math.atan(1.25 * module / distance);
  const tip = pitch + Math.atan(module / distance);
  const half = Math.PI / (2 * teeth) - 0.025 / (module * teeth / 2);
  const halfAt = polar => half + involute(pitch, base) - involute(Math.max(polar, base), base);
  return {teeth, mateTeeth, module, pitch, distance, base, root, tip, halfAt, width: 8};
}

/** One tooth, axis +z, center on +x; dimensions in millimeters. */
export function whiskBevelTooth(spec) {
  const {root, base, tip, halfAt, distance, width} = spec;
  const flank = [[root, halfAt(root)]];
  for (let j = 0; j <= 40; j++) {
    const polar = Math.max(root, base) + (tip - Math.max(root, base)) * j / 40;
    flank.push([polar, halfAt(polar)]);
  }
  const outline = flank.map(([polar, half]) => [polar, -half]);
  for (let j = 1; j < 8; j++) outline.push([tip, -halfAt(tip) + 2 * halfAt(tip) * j / 8]);
  outline.push(...flank.toReversed());
  for (let j = 1; j < 8; j++) outline.push([root, halfAt(root) * (1 - 2 * j / 8)]);
  const direction = outline.map(([p, a]) => new THREE.Vector3(Math.sin(p) * Math.cos(a), Math.sin(p) * Math.sin(a), Math.cos(p)));
  const vertices = [distance - width, distance].flatMap(r => direction.flatMap(v => v.clone().multiplyScalar(r).toArray()));
  const n = direction.length, indices = [];
  const caps = THREE.ShapeUtils.triangulateShape(direction.map(v => new THREE.Vector2(v.x, v.y)), []);
  for (const [a, b, c] of caps) indices.push(c, b, a, a + n, b + n, c + n);
  for (let a = 0; a < n; a++) {
    const b = (a + 1) % n;
    indices.push(a, b, b + n, a, b + n, a + n);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.bevel = spec;
  return geometry;
}

/** Solid root cone with a bore; same apex and axis as the teeth. */
export function whiskBevelBody(spec, bore, back = spec.distance * Math.cos(spec.root)) {
  const {root, distance, width} = spec;
  const inner = distance - width;
  const points = [
    [bore, inner * Math.cos(root)], [inner * Math.sin(root), inner * Math.cos(root)],
    [distance * Math.sin(root), distance * Math.cos(root)], [distance * Math.sin(root), back], [bore, back],
    [bore, inner * Math.cos(root)],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  return new THREE.LatheGeometry(points, 144).rotateX(Math.PI / 2);
}

export function whiskBevelTeeth(spec, material) {
  const teeth = new THREE.InstancedMesh(whiskBevelTooth(spec), material, spec.teeth);
  const matrix = new THREE.Matrix4();
  for (let k = 0; k < spec.teeth; k++) teeth.setMatrixAt(k, matrix.makeRotationZ(k * TAU / spec.teeth));
  teeth.computeBoundingSphere();
  return teeth;
}

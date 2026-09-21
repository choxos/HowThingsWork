import * as THREE from 'three';

// Scene pieces shared by the house models, built on the house model kit so its
// dispose() releases them.

/** A mesh from the kit's material for `color`, carrying a geometry built elsewhere. */
export function surface(kit, geometry, color, parent, doubleSided = false) {
  const mesh = kit.box([1, 1, 1], [0, 0, 0], color, parent);
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  if (doubleSided) {
    mesh.material = mesh.material.clone();
    mesh.material.side = THREE.DoubleSide;
  }
  return mesh;
}

/** A polyline with room for `count` points; draw part of it with setDrawRange. */
export function lineObject(count, color, parent) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const object = new THREE.Line(geometry, new THREE.LineBasicMaterial({color}));
  object.frustumCulled = false;
  parent.add(object);
  return object;
}

/** Line segments with room for `count` pairs of points; draw them with fillLine. */
export function segmentLines(count, color, parent) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color}));
  object.frustumCulled = false;
  parent.add(object);
  return object;
}

/** Puts `points` into a line or line segments object, repeating the last in the room left over; returns how many it drew. */
export function fillLine(line, points) {
  const array = line.geometry.attributes.position.array, room = array.length / 3, n = Math.min(points.length, room);
  line.visible = n > 0;
  for (let i = 0; i < room; i++) array.set(n ? points[Math.min(i, n - 1)] : [0, 0, 0], i * 3);
  line.geometry.setDrawRange(0, n);
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.boundingBox = null;
  line.geometry.boundingSphere = null;
  return n;
}

/** A triangle strip of `count` vertex pairs, with room for normals. */
export function stripGeometry(count) {
  const geometry = new THREE.BufferGeometry(), index = [];
  for (let i = 1; i < count; i++) { const a = (i - 1) * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  geometry.setIndex(index);
  return geometry;
}

/**
 * A solid arrow along its local +y. setLength draws the exact length asked for,
 * so two arrows on one scale compare truly; userData.length reads it back.
 * `thickness` is the shaft radius in scene units.
 */
export function solidArrow(kit, color, parent, thickness) {
  const group = new THREE.Group(), shaft = kit.cylinder(1, 1, [0, 0, 0], 'ink', group), head = kit.cylinder(1, 1, [0, 0, 0], 'ink', group);
  shaft.material = shaft.material.clone();
  shaft.material.color.set(color);
  head.geometry.dispose();
  head.geometry = new THREE.ConeGeometry(1, 1, 16);
  head.material = shaft.material;
  parent.add(group);
  group.userData.length = 0;
  group.userData.setLength = length => {
    const headLength = Math.min(0.35 * length, 6 * thickness);
    group.userData.length = length;
    group.visible = length > 1e-9;
    shaft.scale.set(thickness, Math.max(1e-6, length - headLength), thickness);
    shaft.position.y = (length - headLength) / 2;
    head.scale.set(2.5 * thickness, headLength, 2.5 * thickness);
    head.position.y = length - headLength / 2;
  };
  group.userData.setDirection = direction => group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return group;
}

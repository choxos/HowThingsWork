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

/**
 * A line of flat text drawn on a canvas and laid on a plane `height` scene units
 * tall, facing +z in its parent. Its width follows the text unless given. The
 * texture is freed when the kit disposes the plane's material, so a model need
 * not track it. Outside a browser there is no canvas: the plane stays blank and
 * the model still builds. `mesh.userData.setText(text)` redraws it.
 */
export function textLabel(parent, text, {height, width, position = [0, 0, 0], color = '#394233', align = 'center', weight = ''} = {}) {
  const planeWidth = width ?? height * (0.56 * String(text).length + 0.6);
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  let ctx = null, texture;
  if (canvas) {
    canvas.height = 96; canvas.width = Math.max(8, Math.ceil(96 * planeWidth / height));
    ctx = canvas.getContext('2d'); texture = new THREE.CanvasTexture(canvas);
  } else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide});
  material.addEventListener('dispose', () => texture.dispose());
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, height), material);
  // Anchor the plane at its left, middle or right edge, like the text inside it.
  const shift = align === 'left' ? planeWidth / 2 : align === 'right' ? -planeWidth / 2 : 0;
  mesh.position.set(position[0] + shift, position[1], position[2]);
  mesh.userData.textLabel = true;
  // Move the label, keeping it anchored at the same edge as its text.
  mesh.userData.place = (x, y, z = position[2]) => mesh.position.set(x + shift, y, z);
  mesh.userData.setText = value => {
    if (mesh.userData.labelText === value) return;
    mesh.userData.labelText = value;
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${weight ? weight + ' ' : ''}72px sans-serif`; ctx.fillStyle = color; ctx.textBaseline = 'middle';
      ctx.textAlign = align;
      const x = align === 'left' ? 2 : align === 'right' ? canvas.width - 2 : canvas.width / 2;
      ctx.fillText(String(value), x, 50, canvas.width - 4);
      texture.needsUpdate = true;
    }
  };
  mesh.userData.setText(text);
  parent.add(mesh);
  return mesh;
}

/**
 * The words a chart needs to be read: a title above it, the scale values along
 * both axes, what each axis measures, and a key to its lines. Positions are in
 * the chart's own data, through the same `toPoint(x, y)` the chart is drawn with.
 * `spec`: {title, size, x: {min, max, title, ticks: [[value, text]]},
 * y: {min, max, title, ticks: [[value, text]]}, legend: [[text, color]], legendAt: [x, y]}.
 * The key is right-aligned and runs down, inside the plot, from `legendAt` or from
 * the top right corner.
 */
export function chartText(parent, toPoint, {title, size, x, y, legend = [], legendAt}) {
  const css = color => (typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color);
  const at = (px, py) => new THREE.Vector3(...toPoint(px, py));
  const left = at(x.min, y.min), right = at(x.max, y.min), top = at(x.min, y.max);
  // The chart's own directions, so a chart laid on a floor or tilted in the
  // scene gets its words in its own plane.
  const across = right.clone().sub(left).normalize(), up = top.clone().sub(left).normalize(), out = across.clone().cross(up).normalize();
  const turn = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, up, out));
  const lift = size * 0.1, labels = [];
  const put = (text, point, dx, dy, align, options = {}) => {
    const label = textLabel(parent, text, {height: size, align, ...options});
    const shift = label.position.x;
    label.position.copy(point).addScaledVector(across, dx + shift).addScaledVector(up, dy).addScaledVector(out, lift);
    label.quaternion.copy(turn);
    labels.push(label);
  };
  for (const [value, text] of x.ticks || []) put(text, at(value, y.min), 0, -1.1 * size, 'center');
  for (const [value, text] of y.ticks || []) put(text, at(x.min, value), -0.5 * size, 0, 'right');
  if (x.title) put(x.title, left.clone().lerp(right, 0.5), 0, -2.3 * size, 'center');
  if (y.title) put(y.title, top, 0, 1.0 * size, 'left');
  if (title) put(title, left.clone().lerp(right, 0.5).add(top.clone().sub(left)), 0, 2.4 * size, 'center', {weight: '600'});
  const key = legendAt ? at(...legendAt) : at(x.max, y.max);
  legend.forEach(([text, color], i) => put(text, key, 0, (-0.4 - 1.15 * i) * size, 'right', {color: css(color)}));
  return labels;
}

import * as THREE from 'three';

// Involute spur and internal gear outlines, in the length unit of the module.
//
// Convention: at rotation zero an external gear has a tooth centered on its +x
// axis, and an internal ring has a tooth (pointing inward) centered on its +x
// axis. Pitch radius is module times teeth over two; pressure angle 20 degrees;
// addendum one module and dedendum a quarter more. Each flank is thinned by
// `backlash` over two (in modules) along the pitch circle, so meshing teeth
// clear rather than touch. Below the base circle the
// flank runs radially to the root, which is how a small pinion is drawn when
// its involute would be undercut.

const inv = angle => Math.tan(angle) - angle;

/** Points around one gear-like outline: bumps of the given half-thickness at pitch, reaching `outer`, gaps reaching `inner`. */
function outlinePoints({teeth, module, pressureAngle, outer, inner, samples, offset, thin}) {
  const pitch = module * teeth / 2, base = pitch * Math.cos(pressureAngle);
  const halfAtPitch = Math.PI / (2 * teeth) - thin / pitch, halfAtBase = halfAtPitch + inv(pressureAngle);
  const halfAt = r => r <= base ? halfAtBase : halfAtBase - inv(Math.acos(base / r));
  let top = outer;
  while (halfAt(top) < 0.02 / teeth && top > pitch) top -= module * 0.02;
  const flank = [];
  const lowest = Math.max(inner, base);
  if (inner < base) flank.push([inner, halfAtBase]);
  for (let j = 0; j <= samples; j++) {
    const r = lowest + (top - lowest) * j / samples;
    flank.push([r, halfAt(r)]);
  }
  const points = [];
  for (let k = 0; k < teeth; k++) {
    const center = offset + k * 2 * Math.PI / teeth, next = center + 2 * Math.PI / teeth;
    for (const [r, half] of flank) points.push([r, center - half]);
    const tipHalf = halfAt(top);
    for (let j = 1; j < 4; j++) points.push([top, center - tipHalf + 2 * tipHalf * j / 4]);
    for (let i = flank.length - 1; i >= 0; i--) points.push([flank[i][0], center + flank[i][1]]);
    const gapFrom = center + flank[0][1], gapTo = next - flank[0][1];
    for (let j = 1; j < 4; j++) points.push([flank[0][0], gapFrom + (gapTo - gapFrom) * j / 4]);
  }
  return points.map(([r, angle]) => new THREE.Vector2(r * Math.cos(angle), r * Math.sin(angle)));
}

/** An external involute spur gear, with an optional bore. */
export function spurGearShape({teeth, module = 1, pressureAngle = Math.PI / 9, bore = 0, samples = 10, backlash = 0.06}) {
  const pitch = module * teeth / 2;
  const shape = new THREE.Shape(outlinePoints({teeth, module, pressureAngle, outer: pitch + module, inner: pitch - 1.25 * module, samples, offset: 0, thin: backlash * module / 2}));
  if (bore > 0) shape.holes.push(new THREE.Path().absarc(0, 0, bore, 0, Math.PI * 2, true));
  return shape;
}

/** An internal ring gear: a rim of the given outer radius around inward-pointing involute teeth. */
export function ringGearShape({teeth, module = 1, pressureAngle = Math.PI / 9, rim, samples = 10, backlash = 0.06}) {
  const pitch = module * teeth / 2;
  const shape = new THREE.Shape().absarc(0, 0, rim, 0, Math.PI * 2, false);
  // The ring's spaces are shaped like the teeth of an external gear with the
  // same count, reaching out to the ring's root; offsetting by half a pitch
  // puts a ring tooth on +x.
  const hole = outlinePoints({teeth, module, pressureAngle, outer: pitch + 1.25 * module, inner: pitch - module, samples, offset: Math.PI / teeth, thin: -backlash * module / 2});
  shape.holes.push(new THREE.Path(hole.reverse()));
  return shape;
}

export const pitchRadius = (teeth, module) => module * teeth / 2;

/**
 * A straight involute rack along +x with teeth pointing +y. The pitch line is
 * y = 0, tooth k is centered at x = k times the circular pitch, and a solid
 * back of `depth` sits below the root. A pinion of pitch radius r meshes when
 * its center is r above the pitch line, turned by +(shift / r) as the rack
 * shifts +x, with a tooth space on the rack side at no shift.
 */
export function rackShape({teeth, module = 1, pressureAngle = Math.PI / 9, depth = 3, backlash = 0.06}) {
  const edge = rackEdge({teeth, module, pressureAngle, backlash}), low = -1.25 * module, pitch = Math.PI * module;
  const shape = new THREE.Shape();
  shape.moveTo(-pitch / 2, low - depth);
  for (const [x, y] of edge) shape.lineTo(x, y);
  shape.lineTo((teeth - 0.5) * pitch, low - depth);
  shape.closePath();
  return shape;
}

/** The toothed edge of that rack, from x = -pitch/2 to (teeth - 1/2) pitch, as [x, y] pairs. */
export function rackEdge({teeth, module = 1, pressureAngle = Math.PI / 9, backlash = 0.06}) {
  const pitch = Math.PI * module, slope = Math.tan(pressureAngle), half = pitch / 4 - backlash * module / 2;
  const top = half - module * slope, root = half + 1.25 * module * slope, low = -1.25 * module;
  const points = [[-pitch / 2, low]];
  for (let k = 0; k < teeth; k++) {
    const x = k * pitch;
    points.push([x - root, low], [x - top, module], [x + top, module], [x + root, low]);
  }
  points.push([(teeth - 0.5) * pitch, low]);
  return points;
}

/** Rotation of a pinion meshing above a rack shifted by `shift`, per the rackShape convention. */
export const pinionOnRack = (teeth, module, shift) => -Math.PI / 2 - Math.PI / teeth + shift / (module * teeth / 2);

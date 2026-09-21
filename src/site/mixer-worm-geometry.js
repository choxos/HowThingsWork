import * as THREE from 'three';
import {wormDimensions} from './beaters-physics.js';

const TAU = Math.PI * 2;
const wrap = (x, period) => ((x + period / 2) % period + period) % period - period / 2;

// A straight-sided axial worm has z = h*psi +/- (pitch/4 - (rho-r)*tan(alpha)).
// Its wheel envelope satisfies n dot (v_worm - v_wheel) = 0. Solving that
// condition gives z below; undoing wheel rotation gives the conjugate flank.
// Lengths are millimeters. The relieved roots are not a manufacturing fillet.
export function wormWheelContact(spec, side, y, rho, flank) {
  const x = side * Math.sqrt(rho * rho - y * y);
  const z = (side * x - spec.radius) / (side * (flank * spec.tangent * x / rho + spec.h * y / (rho * rho)));
  const phase = Math.atan2(y, x) - (z - flank * (spec.pitch / 4 - (rho - spec.radius) * spec.tangent)) / spec.h;
  const angle = Math.atan2(-z, x - side * spec.center) + side * phase / spec.teeth;
  const center = side > 0 ? Math.PI : -Math.PI / spec.teeth;
  return {radius: Math.hypot(x - side * spec.center, z), angle: center + wrap(angle - center, TAU / spec.teeth), phase, x, y, z};
}

function wheelProfile(spec, side, y) {
  const period = TAU / spec.teeth;
  const curves = [-1, 1].map(flank => {
    let lo = spec.root, hi = spec.tip;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (wormWheelContact(spec, side, y, mid, flank).radius > spec.wheelTip) lo = mid; else hi = mid;
    }
    return Array.from({length: 33}, (_, i) => wormWheelContact(spec, side, y, spec.tip + (hi - spec.tip) * i / 32, flank));
  }).sort((a, b) => a[0].angle - b[0].angle);
  const a = curves[1], b = curves[0].toReversed().map(p => ({...p, angle: p.angle + period}));
  const tooth = [{radius: spec.wheelRoot, angle: a[0].angle}, ...a];
  for (let i = 1; i < 9; i++) tooth.push({radius: spec.wheelTip, angle: a.at(-1).angle + (b[0].angle - a.at(-1).angle) * i / 9});
  tooth.push(...b, {radius: spec.wheelRoot, angle: b.at(-1).angle});
  for (let i = 1; i < 9; i++) tooth.push({radius: spec.wheelRoot, angle: b.at(-1).angle + (a[0].angle + period - b.at(-1).angle) * i / 9});
  // ponytail: 0.02 mm relief covers finite tessellation; use a manufactured hob
  // profile and measured backlash before extending this teaching mesh to CAD.
  return Array.from({length: spec.teeth}, (_, i) => tooth.map(p => ({radius: p.radius - 0.02, angle: p.angle + i * period}))).flat();
}

function ringSolid(rings, bore, axis) {
  const positions = [], indices = [], count = rings[0].points.length, slices = rings.length - 1;
  const append = (radius, angle, along) => axis === 'y'
    ? positions.push(radius * Math.cos(angle), along, -radius * Math.sin(angle))
    : positions.push(radius * Math.cos(angle), radius * Math.sin(angle), along);
  for (const {along, points} of rings) for (const p of points) append(p.radius, p.angle, along);
  for (let j = 0; j < slices; j++) for (let i = 0; i < count; i++) {
    const a = j * count + i, b = j * count + (i + 1) % count, c = b + count, d = a + count;
    indices.push(a, b, c, a, c, d);
  }
  const inner = positions.length / 3;
  for (const {along, points} of rings) for (const p of points) append(bore, p.angle, along);
  for (const j of [0, slices]) for (let i = 0; i < count; i++) {
    const a = j * count + i, b = j * count + (i + 1) % count, c = inner + b, d = inner + a;
    if (j === 0) indices.push(a, d, c, a, c, b); else indices.push(a, b, c, a, c, d);
  }
  for (let j = 0; j < slices; j++) for (let i = 0; i < count; i++) {
    const a = inner + j * count + i, b = inner + j * count + (i + 1) % count, c = b + count, d = a + count;
    indices.push(a, d, c, a, c, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function mixerWheelGeometry(teeth, side) {
  const spec = wormDimensions(teeth);
  return ringSolid(Array.from({length: 17}, (_, i) => {
    const along = -spec.width / 2 + spec.width * i / 16;
    return {along, points: wheelProfile(spec, side, along)};
  }), 1.82, 'y');
}

export function mixerWormGeometry(teeth) {
  const spec = wormDimensions(teeth), profile = [];
  const halfAngle = radius => (spec.pitch / 4 - (radius - spec.radius) * spec.tangent) / spec.h;
  for (let i = 0; i <= 16; i++) {
    const radius = spec.root + (spec.tip - spec.root) * i / 16;
    profile.push({radius, angle: -halfAngle(radius)});
  }
  for (let i = 1; i < 9; i++) profile.push({radius: spec.tip, angle: -halfAngle(spec.tip) + 2 * halfAngle(spec.tip) * i / 9});
  for (let i = 0; i <= 16; i++) {
    const radius = spec.tip + (spec.root - spec.tip) * i / 16;
    profile.push({radius, angle: halfAngle(radius)});
  }
  for (let i = 1; i < 17; i++) profile.push({radius: spec.root, angle: halfAngle(spec.root) + (TAU - 2 * halfAngle(spec.root)) * i / 17});
  const slices = Math.ceil(spec.length / spec.pitch * 96);
  return ringSolid(Array.from({length: slices + 1}, (_, i) => {
    const along = -spec.length / 2 + spec.length * i / slices;
    return {along, points: profile.map(p => ({radius: p.radius, angle: p.angle + along / spec.h}))};
  }), 2.02, 'z');
}

import assert from 'node:assert/strict';
import {ESCAPEMENT as E, PALLETS, escapeOutline, impulseContact, rotate2, sampleEscapement, toWheel} from './clock-escapement.js';

const DEG = Math.PI / 180, EPS = 1e-5;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const edges = poly => poly.map((a, i) => [a, poly[(i + 1) % poly.length]]);
const bounds = poly => [Math.min(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[0])), Math.max(...poly.map(p => p[1]))];
function distance(p, a, b) {
  const v = sub(b, a), u = Math.max(0, Math.min(1, (sub(p, a)[0] * v[0] + sub(p, a)[1] * v[1]) / (v[0] ** 2 + v[1] ** 2)));
  return Math.hypot(p[0] - a[0] - u * v[0], p[1] - a[1] - u * v[1]);
}
function interior(p, segments, box) {
  if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3]) return false;
  let inside = false;
  for (const [a, b] of segments) if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  return inside && segments.every(([a, b]) => distance(p, a, b) > EPS);
}
function crossing(a, b, c, d) {
  if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) return false;
  const ab = sub(b, a), cd = sub(d, c), x = cross(ab, sub(c, a)), y = cross(ab, sub(d, a)), u = cross(cd, sub(a, c)), v = cross(cd, sub(b, c));
  return x * y < 0 && u * v < 0 && Math.min(Math.abs(x), Math.abs(y)) > EPS * Math.hypot(...ab) && Math.min(Math.abs(u), Math.abs(v)) > EPS * Math.hypot(...cd);
}

assert.ok(Math.abs(PALLETS[0].lockRadius - PALLETS[1].backRadius) < 1e-12);
assert.ok(Math.abs(PALLETS[1].lockRadius - PALLETS[0].backRadius) < 1e-12);
const original = escapeOutline(), stages = new Set();
let poses = 0, impulses = 0, locks = 0;
for (const amplitude of [1.121, 1.35, 2, 2.34, 3.2]) {
  let previous;
  for (let i = 0; i <= 1500; i++) {
    const s = sampleEscapement(i / 1500, amplitude * DEG), wheel = original.map(p => rotate2(p, -s.escape));
    const wheelEdges = edges(wheel), wheelBounds = bounds(wheel);
    assert.ok(!previous || s.escape >= previous.escape - 1e-12, 'Deadbeat wheel must not recoil');
    for (const pallet of PALLETS) {
      const poly = pallet.outline.map(p => toWheel(p, s.anchor)), segments = edges(poly), box = bounds(poly);
      const context = `${amplitude} degrees, phase ${i / 1500}, ${s.stage}, ${pallet.side}`;
      assert.ok(wheel.every(p => !interior(p, segments, box)), `Tooth inside pallet: ${context}`);
      assert.ok(poly.every(p => !interior(p, wheelEdges, wheelBounds)), `Pallet inside wheel: ${context}`);
      for (const [a, b] of wheelEdges) assert.ok(segments.every(([c, d]) => !crossing(a, b, c, d)), `Edges cross: ${context}`);
      if (s.contactSide === PALLETS.indexOf(pallet)) {
        assert.ok(Math.min(...segments.map(([a, b]) => distance(s.contact, a, b))) < EPS, `Contact leaves pallet: ${context}`);
        assert.ok(Math.min(...wheel.filter((_, k) => k % 3 === 0).map(p => Math.hypot(...sub(p, s.contact)))) < 1e-10, 'Contact must belong to an actual tooth');
      }
    }
    if (s.stage === 'Impulse') {
      const side = s.contactSide, pallet = PALLETS[side], a = toWheel(pallet.a, s.anchor), b = toWheel(pallet.b, s.anchor), v = sub(b, a), force = [-v[1], v[0]];
      const wheelTorque = -cross(s.contact, force), anchorTorque = cross(sub(s.contact, [0, E.pivotHeight]), force);
      assert.ok(wheelTorque > 0 && anchorTorque * pallet.direction > 0, 'Impulse must transfer positive work into the swinging anchor');
      const h = 1e-7, lo = Math.max(-E.lift, s.anchor - h), hi = Math.min(E.lift, s.anchor + h);
      const derivative = (impulseContact(side, hi).turn - impulseContact(side, lo).turn) / (hi - lo);
      assert.ok(Math.abs(derivative - anchorTorque / wheelTorque) < 1e-6, 'Contact motion must conserve virtual work');
      impulses++;
    }
    if (s.stage === 'Locked' && previous?.stage === 'Locked' && s.contactSide === previous.contactSide) {
      assert.ok(Math.abs(s.escape - previous.escape) < 1e-12, 'Train must hold still during lock');
      locks++;
    }
    stages.add(s.stage); previous = s; poses++;
  }
  assert.ok(Math.abs(previous.escape - 2 * Math.PI / E.teeth) < 1e-12, 'Two beats must advance one tooth');
}
for (const [phase, amplitude] of [[-1, .04], [NaN, .04], [0, 0], [0, E.lift + E.dropTravel], [0, .1], [0, Infinity]]) assert.throws(() => sampleEscapement(phase, amplitude), RangeError);
assert.deepEqual([...stages].sort(), ['Drop', 'Impulse', 'Locked']);
console.log(JSON.stringify({passed: true, poses, impulses, locks, fullBodyClearance: true, contactAndWork: true, clearanceToleranceMillimeters: EPS}));

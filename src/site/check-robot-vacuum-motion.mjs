import assert from 'node:assert/strict';
import {differentialStep} from './robot-vacuum-motion.js';

let checks = 0;
const near = (a, b, tolerance = 1e-10) => {assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} differs from ${b}`); checks++;};
const base = {x: .4, y: .2, h: .37, leftTravel: .8, rightTravel: -.2, distance: 2};
const copy = {...base};
const spin = differentialStep(base, -.14, .14, 1, .23);
near(spin.x, base.x); near(spin.y, base.y); near(spin.h - base.h, .28 / .23);
near(spin.leftTravel - base.leftTravel, -.14); near(spin.rightTravel - base.rightTravel, .14); near(spin.distance, base.distance);
const reverse = differentialStep(base, -.28, -.28, .03 / .28, .23);
near(Math.hypot(reverse.x - base.x, reverse.y - base.y), .03); near(reverse.leftTravel - base.leftTravel, -.03);
near(reverse.rightTravel - base.rightTravel, -.03); near(reverse.h, base.h);

// Independent Cartesian RK4 integration of dx/dt = v cos(h), dy/dt = v sin(h)
// and dh/dt = (right-left)/base. Includes both reverse and near-straight arcs.
function rk4(pose, left, right, time, width) {
  const steps = 1600, dt = time / steps, v = (left + right) / 2, omega = (right - left) / width;
  let {x, y, h} = pose;
  for (let i = 0; i < steps; i++) {
    x += dt * v / 6 * (Math.cos(h) + 4 * Math.cos(h + omega * dt / 2) + Math.cos(h + omega * dt));
    y += dt * v / 6 * (Math.sin(h) + 4 * Math.sin(h + omega * dt / 2) + Math.sin(h + omega * dt));
    h += dt * omega;
  }
  return {x, y, h};
}
let cases = 0;
for (const [left, right] of [[.28, .28], [-.28, -.28], [-.14, .14], [.14, -.14], [0, .28], [.28, 0], [.04, .49], [.28, .28 + 1e-12], [-.1, -.3]]) {
  for (const seconds of [0, .002, .02, .2, 1.29, 5]) {
    const exact = differentialStep(base, left, right, seconds, .23), reference = rk4(base, left, right, seconds, .23);
    for (const key of ['x', 'y', 'h']) near(exact[key], reference[key]);
    near(exact.leftTravel - base.leftTravel, left * seconds); near(exact.rightTravel - base.rightTravel, right * seconds);
    near(exact.distance - base.distance, Math.abs((left + right) / 2) * seconds);
    let split = base;
    for (let i = 0; i < 10; i++) split = differentialStep(split, left, right, seconds / 10, .23);
    for (const key of Object.keys(exact)) near(split[key], exact[key]);
    const undone = differentialStep(exact, -left, -right, seconds, .23);
    for (const key of ['x', 'y', 'h', 'leftTravel', 'rightTravel']) near(undone[key], base[key]);
    cases++;
  }
}
assert.deepEqual(base, copy, 'The integrator must not mutate its input');
for (const args of [[base, 0, 0, -1, .23], [base, 0, 0, 1, 0], [base, NaN, 0, 1, .23], [{...base, x: Infinity}, 0, 0, 1, .23]]) assert.throws(() => differentialStep(...args), RangeError);
console.log(`PASS robot differential drive: ${checks} checks; ${cases} independent RK4 comparisons`);

import assert from 'node:assert/strict';
import {drumSegment, stageMotion, WASHER_DRAWN_CAP, WASHER_PLAYBACK_RATE} from './washing-machine-motion.js';

let checks = 0;
function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`); checks++;
}
for (const [from, to, ramp, end] of [[0, 50, 5, 20], [50, 0, 5, 60], [0, 400, 60, 120], [0, 1400, 60, 360], [1400, 0, 30, 35], [50, 50, 0, 900], [0, 0, 0, 5]]) {
  // Independent midpoint quadrature of the physical and capped display speed.
  for (const time of [0, 0.03, ramp / 2, ramp, ramp + 0.013, end]) {
    const count = 100000, dt = time / count;
    let angle = 0, drawn = 0;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) * dt, rpm = ramp ? from + (to - from) * Math.min(1, t / ramp) : to;
      angle += rpm * Math.PI / 30 * dt;
      drawn += Math.min(WASHER_DRAWN_CAP, rpm) * Math.PI / 30 / WASHER_PLAYBACK_RATE * dt;
    }
    const s = drumSegment(from, to, ramp, time);
    near(s.angle, angle, 2e-5, 'physical angle integral');
    near(s.drawnAngle, drawn, 1e-6, 'display angle integral');
    const h = 1e-5, before = drumSegment(from, to, ramp, Math.max(0, time - h)), after = drumSegment(from, to, ramp, time + h);
    if (time > h) {
      near((after.angle - before.angle) / (2 * h), s.rpm * Math.PI / 30, 5e-5, 'angle derivative follows speed');
      near((after.drawnAngle - before.drawnAngle) / (2 * h), Math.min(120, s.rpm) * Math.PI / 1800, 1e-6, 'display derivative follows cap');
    }
  }
}
const stage = {start: 10, end: 40, rpmFrom: 1400, rpmTo: 0, ramp: 30, angle: 32, drawnAngle: 4};
near(stageMotion(stage, 10).angle, 32, 0, 'segment starts at accumulated angle');
near(stageMotion(stage, 40).angle, 32 + 1400 * Math.PI / 30 * 15, 1e-10, 'braking triangle area');
near(stageMotion(stage, 40).rpm, 0, 0, 'stopped at braking end');
for (const args of [[-1, 0, 1, 1], [0, NaN, 1, 1], [0, 1, -1, 1], [0, 1, 1, Infinity]]) {
  assert.throws(() => drumSegment(...args), RangeError); checks++;
}
console.log(`PASS washing-machine motion: ${checks} checks, 42 independent speed integrations`);

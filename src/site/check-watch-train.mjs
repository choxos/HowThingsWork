import assert from 'node:assert/strict';
import {spurGearShape} from './gear-geometry.js';
import {WATCH_TRAIN_GEARS as GEARS, WATCH_MESH_PAIRS as PAIRS, watchTrainAngles} from './watch-train.js';
import {sampleWatch, WATCH_RATIOS, ESCAPE_PER_WATCH_BARREL} from './watch-physics.js';

let checks = 0, meshPoses = 0;
const TAU = 2 * Math.PI;
const check = (condition, label) => { checks++; assert.ok(condition, label); };
const near = (a, b, tolerance, label) => check(Math.abs(a - b) <= tolerance, `${label}: ${a} versus ${b}`);
function inside([x, y], polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function crosses(a, b, c, d) {
  if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
    || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) return false;
  const x = cross(a, b, c), y = cross(a, b, d), u = cross(c, d, a), v = cross(c, d, b);
  return x * y < -1e-18 && u * v < -1e-18;
}
const points = (shape, angle, center) => shape.map(p => [p.x * Math.cos(angle) - p.y * Math.sin(angle) + center[0], p.x * Math.sin(angle) + p.y * Math.cos(angle) + center[1]]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const edges = (p, center, radius) => p.map((v, i) => [v, p[(i + 1) % p.length]]).filter(([a, b]) => Math.min(distance(a, center), distance(b, center)) < radius);

for (const [first, second] of PAIRS) {
  const a = GEARS[first], b = GEARS[second], ra = a.teeth * a.module / 2, rb = b.teeth * b.module / 2;
  near(distance(a.position, b.position), ra + rb, 1e-12, `Pitch circles meet ${first}/${second}`);
  near(a.z, b.z, 1e-12, `Engaged teeth share axial plane ${first}/${second}`);
  near(a.module, b.module, 1e-12, `Engaged tooth modules match ${first}/${second}`);
  check(a.teeth >= 2 / Math.sin(a.pressureAngle) ** 2 - 1e-10 && b.teeth >= 2 / Math.sin(b.pressureAngle) ** 2 - 1e-10, `Pinions avoid standard full-depth involute undercut ${first}/${second}`);
  const contactRatio = (Math.sqrt((ra + a.module) ** 2 - (ra * Math.cos(a.pressureAngle)) ** 2)
    + Math.sqrt((rb + b.module) ** 2 - (rb * Math.cos(b.pressureAngle)) ** 2)
    - (ra + rb) * Math.sin(a.pressureAngle)) / (Math.PI * a.module * Math.cos(a.pressureAngle));
  check(contactRatio > 1, `At least one tooth pair engaged ${first}/${second}`);
  const shapeA = spurGearShape({...a, samples: 16}).getPoints(1), shapeB = spurGearShape({...b, samples: 16}).getPoints(1);
  for (let i = 0; i <= 160; i++) {
    const angle = TAU / a.teeth * i / 160;
    const aa = points(shapeA, a.phase + angle, a.position), bb = points(shapeB, b.phase - angle * a.teeth / b.teeth, b.position);
    const nearA = aa.filter(p => distance(p, b.position) <= rb + b.module), nearB = bb.filter(p => distance(p, a.position) <= ra + a.module);
    check(nearA.every(p => !inside(p, bb)) && nearB.every(p => !inside(p, aa)), `No tooth body overlap ${first}/${second}, pose ${i}`);
    const edgesA = edges(aa, b.position, rb + b.module), edgesB = edges(bb, a.position, ra + a.module);
    check(edgesA.every(([p, q]) => edgesB.every(([r, s]) => !crosses(p, q, r, s))), `No flank crossing ${first}/${second}, pose ${i}`);
    meshPoses++;
  }
}

near(ESCAPE_PER_WATCH_BARREL, 7680, 0, 'Whole train tooth product');
near(WATCH_RATIOS.hand, 12, 0, 'Twelve minute turns per hour turn');
for (const values of [{}, {index: 5, temperature: 0, alloy: 0}, {hours: 24}, {hours: 43}, {hours: 44}]) {
  for (const time of [0, 0.06, 0.125, 0.19, 0.5, 1, 2]) {
    const state = sampleWatch(values, time), angles = watchTrainAngles(state);
    for (const [first, second] of PAIRS) {
      const a = GEARS[first], b = GEARS[second];
      near(a.teeth * angles[a.arbor] + b.teeth * angles[b.arbor], 0, 1e-8, `One connected ratio ${first}/${second}`);
    }
    near(angles.center / 12, angles.hour, 1e-12, 'Hour wheel remains on the minute train');
    if (state.running) {
      near(state.power / state.torque / 0.3, state.frequency * TAU / (15 * 7680), 1e-15, 'Power uses the actual train speed');
      near(state.beatEnergy * 2, state.energy * TAU / 250, 1e-18, 'Mean delivered work balances oscillator losses');
    } else near(state.power, 0, 0, 'Stopped train transfers no ongoing power');
  }
}
console.log(JSON.stringify({checks, meshPoses, meshPairs: PAIRS.length}, null, 2));

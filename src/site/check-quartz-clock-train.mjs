import assert from 'node:assert/strict';
import {spurGearShape} from './gear-geometry.js';
import {CLOCK_GEARS as GEARS, CLOCK_MESH_PAIRS as PAIRS, clockTrainAngles, clockHandAngles} from './quartz-clock-train.js';

let checks = 0, meshPoses = 0;
const TAU = 2 * Math.PI;
const check = (condition, label) => {checks++; assert.ok(condition, label);};
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
  return cross(a, b, c) * cross(a, b, d) < -1e-18 && cross(c, d, a) * cross(c, d, b) < -1e-18;
}
const points = (shape, angle, center) => shape.map(p => [p.x * Math.cos(angle) - p.y * Math.sin(angle) + center[0], p.x * Math.sin(angle) + p.y * Math.cos(angle) + center[1]]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const edges = (p, center, radius) => p.map((v, i) => [v, p[(i + 1) % p.length]]).filter(([a, b]) => Math.min(distance(a, center), distance(b, center)) < radius);
for (const [first, second] of PAIRS) {
  const a = GEARS[first], b = GEARS[second], ra = a.teeth * a.module / 2, rb = b.teeth * b.module / 2;
  near(distance(a.position, b.position), ra + rb, 1e-12, `${first}/${second} pitch circles meet`);
  near(a.z, b.z, 0, 'Axial mesh'); near(a.module, b.module, 0, 'Matching tooth module');
  check(Math.min(a.teeth, b.teeth) >= 2 / Math.sin(a.pressureAngle) ** 2 - 1e-10, 'No full-depth involute undercut');
  const ratio = (Math.sqrt((ra + a.module) ** 2 - (ra * Math.cos(a.pressureAngle)) ** 2) + Math.sqrt((rb + b.module) ** 2 - (rb * Math.cos(b.pressureAngle)) ** 2) - (ra + rb) * Math.sin(a.pressureAngle)) / (Math.PI * a.module * Math.cos(a.pressureAngle));
  check(ratio > 1, 'Continuous tooth contact');
  const shapeA = spurGearShape({...a, samples: 16}).getPoints(1), shapeB = spurGearShape({...b, samples: 16}).getPoints(1);
  for (let i = 0; i <= 160; i++) {
    const angle = TAU / a.teeth * i / 160, aa = points(shapeA, a.phase + angle, a.position), bb = points(shapeB, b.phase - angle * a.teeth / b.teeth, b.position);
    const nearA = aa.filter(p => distance(p, b.position) <= rb + b.module), nearB = bb.filter(p => distance(p, a.position) <= ra + a.module);
    check(nearA.every(p => !inside(p, bb)) && nearB.every(p => !inside(p, aa)), `No tooth overlap ${first}/${second}, pose ${i}`);
    const edgesA = edges(aa, b.position, rb + b.module), edgesB = edges(bb, a.position, ra + a.module);
    check(edgesA.every(([p, q]) => edgesB.every(([r, s]) => !crosses(p, q, r, s))), `No flank crossing ${first}/${second}, pose ${i}`);
    meshPoses++;
  }
}
for (const ticks of [0, 1, 2, 3, 59, 60, 3600, 43200, 2591840, 2592000, 2592035]) {
  const angles = clockTrainAngles(ticks), hands = clockHandAngles(ticks);
  for (const [first, second] of PAIRS) {
    const a = GEARS[first], b = GEARS[second]; near(a.teeth * angles[a.arbor] + b.teeth * angles[b.arbor], 0, 2e-8, 'Connected motion preserves every gear ratio');
  }
  for (const name of ['seconds', 'minute', 'hour']) near(angles[name], hands[name], 6e-11, `${name} hand shares its output arbor`);
}
console.log(JSON.stringify({passed: true, checks, meshPoses, meshPairs: PAIRS.length}));

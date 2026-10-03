import assert from 'node:assert/strict';
import {watchSpiral, watchHairspring, watchMainspring, WATCH_HAIRSPRING as H, WATCH_MAINSPRING as M} from './watch-springs.js';
import {SPRING_LENGTH} from './watch-physics.js';

let checks = 0, hairspringPoses = 0, mainspringPoses = 0, maxLengthError = 0, smallestHairSpacing = Infinity, smallestMainSpacing = Infinity;
const check = (condition, label) => { checks++; assert.ok(condition, label); };
const near = (a, b, tolerance, label) => check(Math.abs(a - b) <= tolerance, `${label}: ${a} versus ${b}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const length = p => p.slice(1).reduce((sum, q, i) => sum + distance(q, p[i]), 0);
function adjacentCoilSpacing(points, turns) {
  const perTurn = (points.length - 1) / turns;
  let minimum = Infinity;
  for (let i = 0; i < points.length - perTurn; i += 13) {
    for (let j = Math.max(i + 1, Math.floor(i + perTurn * 0.85)); j <= Math.min(points.length - 1, i + perTurn * 1.15); j++) {
      minimum = Math.min(minimum, distance(points[i], points[j]));
    }
  }
  return minimum;
}

for (let degrees = -320; degrees <= 320; degrees += 20) for (const index of [-5, 0, 5]) for (const growth of [0.99984, 1, 1.00016]) {
  const angle = degrees * Math.PI / 180;
  const s = watchHairspring({angle, index, growth, length: SPRING_LENGTH * 1000});
  const label = `${degrees} degrees / index ${index} / growth ${growth}`;
  hairspringPoses++;
  const measured = length(s.points), full = measured + length(s.terminal);
  maxLengthError = Math.max(maxLengthError, Math.abs(measured - s.workingLength));
  near(measured, SPRING_LENGTH * 1000 * (1 - H.index * index) * growth, 2e-8, `Active material length ${label}`);
  near(full, (SPRING_LENGTH * 1000 + H.terminal) * growth, 1e-5, `Whole material preserved when clamp moves ${label}`);
  near(distance(s.points.at(-1), s.terminal[0]), 0, 1e-12, `Active spring joins terminal at clamp ${label}`);
  near(s.terminal.at(-1)[0], H.outer * Math.cos(H.stud) * growth, 1e-12, `Fixed stud x ${label}`);
  near(s.terminal.at(-1)[1], H.outer * Math.sin(H.stud) * growth, 1e-12, `Fixed stud y ${label}`);
  near(s.points[0][0], H.inner * growth * Math.cos(s.innerAngle), 1e-12, `Inner end stays on rotating collar x ${label}`);
  near(s.points[0][1], H.inner * growth * Math.sin(s.innerAngle), 1e-12, `Inner end stays on rotating collar y ${label}`);
  const spacing = adjacentCoilSpacing(s.points, s.turns);
  smallestHairSpacing = Math.min(smallestHairSpacing, spacing);
  check(spacing > H.thickness * growth, `Hairspring coils do not cross ${label}`);
  const pinRadius = 0.08 * growth, wireRadius = H.thickness * growth / 2;
  for (const direction of [-1, 1]) {
    const radius = H.outer * growth + direction * (pinRadius + wireRadius);
    const pin = [radius * Math.cos(s.outerAngle), radius * Math.sin(s.outerAngle)];
    const clearance = Math.min(...[...s.points, ...s.terminal].map(point => distance(point, pin)));
    check(clearance >= pinRadius + wireRadius - 1e-8, `Ribbon clears real curb pin ${direction}, ${label}`);
    near(distance(s.points.at(-1), pin), pinRadius + wireRadius, 1e-12, `Ribbon touches real curb pin ${label}`);
  }
}

for (let i = 0; i <= 110; i++) {
  const winding = i / 20, s = watchMainspring(winding);
  mainspringPoses++;
  const measured = length(s.points);
  maxLengthError = Math.max(maxLengthError, Math.abs(measured - M.length));
  near(measured, M.length, 2e-8, `Mainspring does not create or remove ribbon at ${winding} turns`);
  near(s.points[0][0], M.inner, 1e-11, `Inner end fixed to held arbor at ${winding} turns`);
  near(s.points[0][1], 0, 1e-11, `Arbor attachment y at ${winding} turns`);
  near(s.points.at(-1)[0], M.outer * Math.cos(s.barrelAngle), 1e-11, `Barrel attachment x at ${winding} turns`);
  near(s.points.at(-1)[1], M.outer * Math.sin(s.barrelAngle), 1e-11, `Barrel attachment y at ${winding} turns`);
  const spacing = adjacentCoilSpacing(s.points, s.turns);
  smallestMainSpacing = Math.min(smallestMainSpacing, spacing);
  check(spacing > M.thickness, `Mainspring coils do not cross at ${winding} turns`);
  check(s.radii.every(r => r >= M.inner - 1e-10 && r <= M.outer + 1e-10), `Ribbon remains inside barrel at ${winding} turns`);
}

for (const winding of [-1, NaN, Infinity, M.windingTurns + 0.01]) { assert.throws(() => watchMainspring(winding), RangeError); checks++; }
for (const angle of [-4, 0, 4]) {
  const first = watchHairspring({angle, index: 2, length: SPRING_LENGTH * 1000});
  for (const other of [-5, 5, 0]) watchHairspring({angle: other, index: -5, length: SPRING_LENGTH * 1000});
  const repeated = watchHairspring({angle, index: 2, length: SPRING_LENGTH * 1000});
  for (let i = 0; i < first.points.length; i += 17) near(distance(first.points[i], repeated.points[i]), 0, 1e-8, 'Warm solver cache does not change spring geometry');
}
for (const turns of [0, 2.5, 5.5]) {
  const first = watchMainspring(turns); watchMainspring(1.25); watchMainspring(5);
  const repeated = watchMainspring(turns);
  for (let i = 0; i < first.points.length; i += 19) near(distance(first.points[i], repeated.points[i]), 0, 1e-8, 'Mainspring result does not depend on previous winding');
}
for (const args of [{angle: NaN}, {index: 6}, {growth: 0}, {length: 0}]) { assert.throws(() => watchHairspring({length: SPRING_LENGTH * 1000, ...args}), RangeError); checks++; }
assert.throws(() => watchSpiral({...M, turns: 10, outerAngle: 0, length: 1}), RangeError); checks++;
console.log(JSON.stringify({checks, hairspringPoses, mainspringPoses, maxLengthErrorMm: maxLengthError, smallestHairSpacingMm: smallestHairSpacing, smallestMainSpacingMm: smallestMainSpacing}, null, 2));

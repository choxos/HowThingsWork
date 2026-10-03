import assert from 'node:assert/strict';
import {ShapeUtils, Vector2} from 'three';
import {
  WATCH_DEGREE as D, WATCH_ESCAPEMENT as E, WATCH_PALLETS as PALLETS,
  WATCH_FORK_WALLS as WALLS, WATCH_FORK_HORNS as HORNS, WATCH_BANK_PINS as BANKS,
  WATCH_DART_LENGTH, WATCH_CONTACT_ANGLES as M,
  watchEscapeOutline, watchJewelOutline, watchSafetyRollerOutline,
  watchPalletContact, sampleWatchEscapement,
} from './watch-escapement.js';

let checks = 0, poses = 0, safetyPoses = 0;
const near = (a, b, tolerance, label) => { checks++; assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} versus ${b}`); };
const check = (condition, label) => { checks++; assert.ok(condition, label); };
const rotate = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const move = (p, q) => [p[0] + q[0], p[1] + q[1]];
const transform = (points, angle, position = [0, 0]) => points.map(p => move(rotate(p, angle), position));
const bounds = p => [Math.min(...p.map(q => q[0])), Math.max(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[1]))];
function gap(a, b) {
  const aa = bounds(a), bb = bounds(b), quick = Math.max(bb[0] - aa[1], aa[0] - bb[1], bb[2] - aa[3], aa[2] - bb[3]);
  if (quick > 0.001) return quick;
  let maximum = -Infinity;
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length < 1e-12) continue;
    const n = [-(q[1] - p[1]) / length, (q[0] - p[0]) / length];
    const av = a.map(v => n[0] * v[0] + n[1] * v[1]), bv = b.map(v => n[0] * v[0] + n[1] * v[1]);
    maximum = Math.max(maximum, Math.min(...av) - Math.max(...bv), Math.min(...bv) - Math.max(...av));
    if (maximum > 0.001) return maximum;
  }
  return maximum;
}
const triangulate = p => ShapeUtils.triangulateShape(p.map(q => new Vector2(...q)), []).map(t => t.map(i => p[i]));
const distanceToSegment = (p, a, b) => {
  const v = [b[0] - a[0], b[1] - a[1]], square = v[0] ** 2 + v[1] ** 2;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / square));
  return Math.hypot(p[0] - a[0] - t * v[0], p[1] - a[1] - t * v[1]);
};
const wheel = watchEscapeOutline(), teeth = triangulate(wheel), jewel = watchJewelOutline();
const roller = triangulate(watchSafetyRollerOutline());
const fork = [...WALLS, ...HORNS.flatMap(h => h.inner.slice(1).map((point, i) => [h.inner[i], point, h.outer[i + 1], h.outer[i]]))];
const dart = Array.from({length: 66}, (_, i) => {
  const a = i < 33 ? Math.PI * i / 32 : Math.PI + Math.PI * (i - 33) / 32;
  return [E.dartRadius * Math.cos(a), (i < 33 ? WATCH_DART_LENGTH : 3.8) + E.dartRadius * Math.sin(a)];
});
const startAngle = watchPalletContact(0, E.bank, 'lock').angle;
const rollerCollision = (lever, balance) => {
  const movingDart = transform(dart, lever), movingRoller = roller.map(p => transform(p, balance, [0, E.balanceDistance]));
  return movingRoller.some(triangle => gap(movingDart, triangle) < -1e-7);
};
const forkCollision = (lever, balance) => {
  const pin = transform(jewel, balance, [0, E.balanceDistance]);
  return fork.some(p => gap(transform(p, lever), pin) < -1e-7);
};

function inspect(phase, amplitude) {
  const s = sampleWatchEscapement(phase, amplitude), label = `${phase.toFixed(8)} / ${(amplitude / D).toFixed(1)} / ${s.stage}`;
  poses++;
  check(Math.abs(s.lever) <= E.bank + 1e-11, `Bank travel ${label}`);
  const polygons = PALLETS.map(p => transform(p.outline, s.lever, E.pivot));
  const movingTeeth = teeth.map(p => transform(p, startAngle - s.escape));
  for (const p of polygons) check(movingTeeth.every(t => gap(p, t) >= -1e-8), `Tooth/pallet body clearance ${label}`);
  if (s.contact) {
    const p = PALLETS[s.contactSide], a = move(rotate(p.corner, s.lever), E.pivot);
    const b = move(rotate(s.contact.face === 'lock' ? p.topCorner : p.edge, s.lever), E.pivot);
    near(distanceToSegment(s.contact.point, a, b), 0, 1e-9, `Contact on drawn pallet ${label}`);
    near(Math.min(...wheel.filter((_, i) => i % 3 === 1).map(t => {
      const point = rotate(t, startAngle - s.escape);
      return Math.hypot(point[0] - s.contact.point[0], point[1] - s.contact.point[1]);
    })), 0, 1e-9, `Contact on drawn tooth ${label}`);
  } else check(s.stage === 'Free drop', `Only drop loses pallet contact ${label}`);
  const pin = transform(jewel, s.balance, [0, E.balanceDistance]);
  const wallGaps = WALLS.map(p => gap(transform(p, s.lever), pin));
  check(fork.every(p => gap(transform(p, s.lever), pin) >= -1e-7), `Finite jewel/fork clearance ${label}`);
  if (s.forkContact) near(Math.min(...wallGaps), 0, 3e-5, `Finite jewel contact ${label}`);
  check(!rollerCollision(s.lever, s.balance), `Safety roller clearance ${label}`);
  const stemEnd = rotate([0, E.forkBottom], s.lever);
  for (const bank of BANKS) check(distanceToSegment(bank, [0, 0], stemEnd) >= E.stemRadius + E.bankPinRadius - 1e-10, `Bank pin clearance ${label}`);
  if (Math.abs(Math.abs(s.lever) - E.bank) < 1e-9) {
    near(Math.min(...BANKS.map(b => distanceToSegment(b, [0, 0], stemEnd))), E.stemRadius + E.bankPinRadius, 1e-9, `Lever rests on bank ${label}`);
  }
  return s;
}

const stages = new Set();
for (const degrees of [20, 240, 320]) {
  const amplitude = degrees * D;
  for (let i = 0; i <= 240; i++) stages.add(inspect(i / 240, amplitude).stage);
  const angles = new Set();
  for (let i = 0; i <= 200; i++) angles.add(M.enter - 0.01 * D + (M.leave - M.enter + 0.02 * D) * i / 200);
  for (const event of [M.enter, M.unlock, M.unlock + M.takeup, M.release, M.release + M.drop, M.release + M.drop + M.takeup, M.leave]) {
    for (const epsilon of [-1e-8, 0, 1e-8]) angles.add(event + epsilon);
  }
  for (let i = 0; i <= 30; i++) {
    angles.add(M.unlock + M.takeup * i / 30);
    angles.add(M.release + M.drop * i / 30);
  }
  for (const toward of angles) for (const side of [0, 1]) {
    const phase = side / 2 + Math.acos(-toward / amplitude) / (2 * Math.PI);
    stages.add(inspect(phase, amplitude).stage);
  }
  near(sampleWatchEscapement(1, amplitude).escape, 2 * Math.PI / E.teeth, 1e-12, 'One tooth per complete cycle');
  near(sampleWatchEscapement(7, amplitude).escape, 7 * 2 * Math.PI / E.teeth, 1e-12, 'No accumulated cycle error');
}
check(stages.size === 6, `All contact stages exercised: ${[...stages]}`);

for (const [side, p] of PALLETS.entries()) {
  for (let i = 1; i < 100; i++) {
    const angle = p.unlock + (p.release - p.unlock) * i / 100;
    const derivative = (watchPalletContact(side, angle + 1e-7).angle - watchPalletContact(side, angle - 1e-7).angle) / 2e-7;
    check(-derivative * -p.direction > 0, 'Wheel torque delivers positive work during pallet impulse');
    const lockedAngle = p.direction * E.bank + (p.unlock - p.direction * E.bank) * i / 100;
    const draw = (watchPalletContact(side, lockedAngle + 1e-7, 'lock').angle - watchPalletContact(side, lockedAngle - 1e-7, 'lock').angle) / 2e-7;
    check(-draw * p.direction > 0, 'Wheel torque draws each pallet toward its bank');
  }
}

for (let degrees = M.leave / D + 0.05; degrees <= 320; degrees += 1.25) for (const direction of [-1, 1]) {
  const balance = degrees * D * direction, bank = -E.bank * direction;
  let blocked = false;
  for (let step = 1; step <= 28 && !blocked; step++) {
    const lever = bank + direction * step * 0.05 * D;
    blocked = rollerCollision(lever, balance) || forkCollision(lever, balance);
  }
  safetyPoses++;
  check(blocked, `Guard or horn blocks accidental release at ${degrees.toFixed(3)} degrees, direction ${direction}`);
}

for (const args of [[-1, 2], [NaN, 2], [0, 0], [0, M.leave], [0, 2 * Math.PI]]) {
  assert.throws(() => sampleWatchEscapement(...args), RangeError); checks++;
}
console.log(JSON.stringify({checks, poses, safetyPoses, stages: [...stages], contactAnglesDegrees: Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v / D]))}, null, 2));

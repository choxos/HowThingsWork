const TAU = 2 * Math.PI;
export const WATCH_DEGREE = Math.PI / 180;
const D = WATCH_DEGREE;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const unit = a => Math.hypot(...a) > 1e-12 ? scale(a, 1 / Math.hypot(...a)) : [1, 0];
export const watchRotate = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

// Millimeters. Original English-form ratchet lever, following Playtner's
// distinction between locking draw, pallet lift, drop, and banking run.
export const WATCH_ESCAPEMENT = Object.freeze({
  teeth: 15, radius: 3, root: 2.4, bank: 5 * D, lock: 1.5 * D, run: 0.25 * D,
  draw: 12 * D, impulse: 10 * D, palletDepth: 0.65,
  pivot: Object.freeze([0, 3 / Math.cos(30 * D)]),
  balanceDistance: 5.5, impulseRadius: 1.2, jewelRadius: 0.16,
  slotHalfWidth: 0.175, forkBottom: 3.9, forkTop: 4.4, forkOuter: 0.46,
  guardRadius: 0.6, dartRadius: 0.025, guardFreedom: 1 * D,
  crescentRadius: 0.3, hornFreedom: 0.8 * D, hornThickness: 0.14,
  stemRadius: 0.08, bankPinRadius: 0.12, bankDistance: 1.8,
});
const E = WATCH_ESCAPEMENT;

export const watchPalletWorld = (point, lever) => add(E.pivot, watchRotate(point, lever));
export const WATCH_PALLETS = Object.freeze([0, 1].map(side => {
  const direction = side === 0 ? 1 : -1;
  const unlock = direction * (E.bank - E.lock), release = -direction * (E.bank - E.run);
  const angle = (side === 0 ? 120 : 60) * D;
  const corner = watchRotate(sub(polar(E.radius, angle), E.pivot), -unlock);
  const edge = watchRotate(sub(polar(E.radius, angle - E.impulse), E.pivot), -release);
  const bankPoint = watchPalletWorld(corner, direction * E.bank);
  const faceDirection = watchRotate(polar(1, Math.atan2(bankPoint[1], bankPoint[0]) - E.draw), -direction * E.bank);
  const topCorner = add(corner, scale(faceDirection, E.palletDepth));
  const topEdge = add(edge, scale(faceDirection, E.palletDepth));
  return Object.freeze({side, direction, unlock, release, angle, corner, edge, topCorner, topEdge, outline: [corner, edge, topEdge, topCorner]});
}));

export function watchPalletContact(side, lever, face = 'impulse') {
  const p = WATCH_PALLETS[side];
  if (!p || !Number.isFinite(lever) || !['lock', 'impulse'].includes(face)) throw new RangeError('Invalid watch pallet contact');
  const a = watchPalletWorld(p.corner, lever), b = watchPalletWorld(face === 'lock' ? p.topCorner : p.edge, lever);
  const v = sub(b, a), aa = dot(v, v), bb = 2 * dot(a, v), cc = dot(a, a) - E.radius ** 2;
  const discriminant = bb * bb - 4 * aa * cc;
  if (discriminant < 0) throw new RangeError('Watch pallet misses the escape-wheel circle');
  const roots = [(-bb - Math.sqrt(discriminant)) / (2 * aa), (-bb + Math.sqrt(discriminant)) / (2 * aa)];
  const fraction = roots.find(t => t >= -1e-8 && t <= 1 + 1e-8);
  if (fraction === undefined) throw new RangeError('Watch tooth lies beyond the working pallet face');
  const point = add(a, scale(v, fraction));
  return {point, fraction, angle: Math.atan2(point[1], point[0]), side, face};
}

export function watchEscapeOutline() {
  const outline = [];
  for (let tooth = 0; tooth < E.teeth; tooth++) {
    const angle = tooth * TAU / E.teeth;
    outline.push(watchRotate(add([E.radius, 0], polar(0.65, Math.PI - 24 * D)), angle));
    outline.push(polar(E.radius, angle));
    outline.push(polar(E.root, angle + 20 * D));
  }
  return outline;
}

const JEWEL_CENTER = E.jewelRadius / 7;
const JEWEL_HALF_FACE = E.jewelRadius * Math.sqrt(48 / 49);
export function watchJewelOutline(segments = 96) {
  const cut = Math.asin(-1 / 7);
  return Array.from({length: segments + 1}, (_, i) => {
    const a = cut + (Math.PI - 2 * cut) * i / segments;
    return [E.jewelRadius * Math.cos(a), -E.impulseRadius + JEWEL_CENTER + E.jewelRadius * Math.sin(a)];
  });
}

export const WATCH_FORK_WALLS = Object.freeze([
  [[-E.forkOuter, E.forkBottom], [-E.slotHalfWidth, E.forkBottom], [-E.slotHalfWidth, E.forkTop], [-E.forkOuter, E.forkTop]],
  [[E.slotHalfWidth, E.forkBottom], [E.forkOuter, E.forkBottom], [E.forkOuter, E.forkTop], [E.slotHalfWidth, E.forkTop]],
]);

// Support of the actual flat-faced jewel, not its circumscribed circle.
function jewelSupport(normal, balance) {
  const n = watchRotate(normal, -balance);
  const point = n[1] >= -1 / 7
    ? add([0, -E.impulseRadius + JEWEL_CENTER], scale(n, E.jewelRadius))
    : [Math.sign(n[0]) * JEWEL_HALF_FACE, -E.impulseRadius];
  return dot(normal, add([0, E.balanceDistance], watchRotate(point, balance)));
}

export function watchForkGap(outline, lever, balance) {
  const polygon = outline.map(point => watchRotate(point, lever));
  const center = add([0, E.balanceDistance], watchRotate([0, -E.impulseRadius + JEWEL_CENTER], balance));
  const axes = [watchRotate([0, 1], balance)];
  polygon.forEach((point, i) => {
    const v = sub(polygon[(i + 1) % polygon.length], point);
    axes.push(unit([-v[1], v[0]]), unit(sub(point, center)));
  });
  let separation = -Infinity;
  for (const n of axes) {
    const projections = polygon.map(point => dot(n, point));
    separation = Math.max(separation,
      Math.min(...projections) - jewelSupport(n, balance),
      -jewelSupport(scale(n, -1), balance) - Math.max(...projections));
  }
  return separation;
}

export function watchForkContact(side, balance) {
  if (![0, 1].includes(side) || !Number.isFinite(balance)) throw new RangeError('Invalid watch fork contact');
  const center = add([0, E.balanceDistance], watchRotate([0, -E.impulseRadius + JEWEL_CENTER], balance));
  const base = -Math.atan2(center[0], center[1]), direction = side ? 1 : -1;
  let low = base, high;
  for (let i = 1; i <= 50; i++) {
    high = base + direction * i * 0.1 * D;
    if (watchForkGap(WATCH_FORK_WALLS[side], high, balance) < 0) break;
    if (i === 50) return null;
  }
  for (let i = 0; i < 38; i++) {
    const middle = (low + high) / 2;
    if (watchForkGap(WATCH_FORK_WALLS[side], middle, balance) >= 0) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

const hornCenter = watchRotate([0, E.balanceDistance], -(E.bank - E.hornFreedom));
const hornRadius = Math.hypot(E.impulseRadius, JEWEL_HALF_FACE);
const hornStart = Math.atan2(-Math.sqrt(hornRadius ** 2 - (-E.slotHalfWidth - hornCenter[0]) ** 2), -E.slotHalfWidth - hornCenter[0]);
export const WATCH_FORK_HORNS = Object.freeze([0, 1].map(side => {
  const inner = [], outer = [], sign = side ? -1 : 1;
  for (let i = 0; i <= 64; i++) {
    const angle = hornStart + (-164 * D - hornStart) * i / 64;
    for (const [points, radius] of [[inner, hornRadius], [outer, hornRadius + E.hornThickness]]) {
      const point = add(hornCenter, polar(radius, angle));
      points.push([sign * point[0], point[1]]);
    }
  }
  return {inner, outer, outline: [...inner, ...outer.toReversed()]};
}));

const guardAngle = E.bank - E.guardFreedom;
export const WATCH_DART_LENGTH = E.balanceDistance * Math.cos(guardAngle)
  - Math.sqrt((E.guardRadius + E.dartRadius) ** 2 - (E.balanceDistance * Math.sin(guardAngle)) ** 2);

export const WATCH_BANK_PINS = Object.freeze([1, -1].map(sign => {
  const p = watchRotate([-E.stemRadius - E.bankPinRadius, E.bankDistance], E.bank);
  return [p[0] * sign, p[1]];
}));

export function watchSafetyRollerOutline() {
  const y = (E.crescentRadius ** 2 - 2 * E.guardRadius ** 2) / (2 * E.guardRadius);
  const x = Math.sqrt(E.guardRadius ** 2 - y * y), angle = Math.atan2(y, x);
  const notchAngle = Math.atan2(y + E.guardRadius, x), points = [];
  for (let i = 0; i <= 128; i++) points.push(polar(E.guardRadius, angle + (Math.PI - 2 * angle) * i / 128));
  for (let i = 0; i <= 64; i++) {
    const a = Math.PI - notchAngle - (Math.PI - 2 * notchAngle) * i / 64;
    points.push(add([0, -E.guardRadius], polar(E.crescentRadius, a)));
  }
  return points;
}

function angleAtLever(side, target, low, high) {
  for (let i = 0; i < 45; i++) {
    const middle = (low + high) / 2;
    const lever = watchForkContact(side, middle);
    if (lever === null) throw new RangeError('Missing fork contact during construction');
    if (lever > target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export const WATCH_CONTACT_ANGLES = Object.freeze({
  enter: angleAtLever(1, E.bank, -19 * D, -17 * D),
  unlock: angleAtLever(1, E.bank - E.lock, -14 * D, -11 * D),
  release: angleAtLever(0, -E.bank + E.run, 16 * D, 18 * D),
  leave: angleAtLever(0, -E.bank, 18 * D, 19 * D),
  takeup: 0.12 * D, drop: 0.12 * D,
});
const M = WATCH_CONTACT_ANGLES;
const initialAngle = watchPalletContact(0, E.bank, 'lock').angle;
const blend = (a, b, u) => a + (b - a) * u;

/** Prescribed settled balance motion; contacts are solved on the drawn solids.
 * Clearance travel is interpolated, not an impact or acceleration simulation.
 */
export function sampleWatchEscapement(phase, amplitude) {
  if (!Number.isFinite(phase) || phase < 0 || !Number.isFinite(amplitude)
    || amplitude <= M.leave || amplitude >= TAU + M.enter) throw new RangeError('Watch swing is outside the detached lever operating range');
  const half = Math.floor(phase * 2), side = half % 2, cycle = Math.floor(half / 2);
  const local = phase * 2 - half, direction = side ? -1 : 1;
  const toward = -amplitude * Math.cos(Math.PI * local), balance = direction * toward;
  let lever, stage, contactSide = side, face = 'lock', dropFraction = null, forkContact = null;
  if (toward <= M.enter) { lever = E.bank; stage = 'Locked; balance free'; }
  else if (toward < M.unlock) { lever = watchForkContact(1, toward); stage = 'Unlocking'; forkContact = 'balance drives fork'; }
  else if (toward < M.unlock + M.takeup) {
    lever = blend(E.bank - E.lock, watchForkContact(0, toward), (toward - M.unlock) / M.takeup);
    stage = 'Taking up fork clearance'; face = 'impulse';
  } else if (toward < M.release) {
    lever = watchForkContact(0, toward); stage = 'Impulse'; face = 'impulse'; forkContact = 'fork drives balance';
  } else if (toward < M.release + M.drop) {
    lever = -E.bank + E.run; stage = 'Free drop'; face = null; contactSide = null;
    dropFraction = (toward - M.release) / M.drop;
  } else if (toward < M.release + M.drop + M.takeup) {
    lever = blend(-E.bank + E.run, watchForkContact(0, toward), (toward - M.release - M.drop) / M.takeup);
    stage = 'Drawing to the bank'; contactSide = 1 - side;
  } else if (toward < M.leave) {
    lever = watchForkContact(0, toward); stage = 'Drawing to the bank'; contactSide = 1 - side; forkContact = 'fork drives balance';
  } else { lever = -E.bank; stage = 'Locked; balance free'; contactSide = 1 - side; }
  lever *= direction;
  const turnOffset = palletSide => -cycle * TAU / E.teeth + (side ? (palletSide ? 48 * D : -24 * D) : (palletSide ? 48 * D : 0));
  let contact = null, angle;
  if (dropFraction !== null) {
    const start = watchPalletContact(side, lever, 'impulse').angle + turnOffset(side);
    const end = watchPalletContact(1 - side, lever, 'lock').angle + turnOffset(1 - side);
    angle = blend(start, end, dropFraction);
  } else {
    contact = watchPalletContact(contactSide, lever, face);
    angle = contact.angle + turnOffset(contactSide);
  }
  return {
    balance, lever, escape: initialAngle - angle, stage, side, contactSide, contact,
    forkContact, dropFraction, beats: half + (contactSide === 1 - side ? 1 : 0),
  };
}

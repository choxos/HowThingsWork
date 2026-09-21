// Sardine-can key: a scored band torn out of the side of a can and wound onto
// a slotted key.
//
// Units: millimeters, newtons, newton millimeters for torque, seconds. Work is
// reported in joules.
//
// The can. A 105 by 76 mm rounded-rectangle tin with 15 mm corners and a wall
// of 0.20 mm tinplate. The band is the strip of wall between two score lines,
// 8 mm wide, running once around the can: 336 mm of metal. Taking it off frees
// the top of the can.
//
// The coil. The key's slot catches the tab and the strip winds on as an
// Archimedean spiral. After theta radians its centerline is at
//   rho(theta) = r + h/2 + h theta / (2 pi)
// so the length wound is
//   L(theta) = rho0 theta + h theta^2 / (4 pi),   rho0 = r + h/2
// and, inverted,
//   theta(L) = (2 pi / h) (sqrt(rho0^2 + h L / pi) - rho0).
// The peel point advances by the band length. The key axis follows an offset
// path, and its absolute rotation beta also includes the wall heading psi:
//   beta = theta + psi; d(beta)/ds = 1/rho + kappa.
// The thin-strip approximation neglects radial pitch in spiral arc length.
//
// Work per band length is 2 Fs + Mp (1/rho + kappa), with
// Mp = sigma w h^2 / 4. For a pure applied couple, virtual work gives
//   tau d(beta) = [2 Fs + Mp (1/rho + kappa)] ds
//   tau = 2 Fs rho / (1 + rho kappa) + Mp.
// Corner curvature lowers the tearing torque per shaft turn; it does not add
// a second bending torque after that rotation has already been counted.
// Finger force means equivalent tangential effort tau/R, not a contact-force
// prediction for a particular finger grip. Translational hand work is excluded.
//
// The fingers. They supply tau at the grip radius R, so F = tau / R, and the
// wheel-and-axle advantage R / rho shrinks as the coil grows. With a finger
// force limit the key stops at the first point where tau exceeds F R. Within
// one side or corner the need only rises, so that point is found exactly.
//
// Not modeled: elastic springback (3 to 7 percent of the bending work at these
// radii), friction in the slot and between layers, air gaps between layers, the
// tab and its first sharp bend, strain hardening, the Bauschinger effect on the
// corners, and the lid seam.

export const SARDINE_KEY_DEFAULTS = Object.freeze({effort: 15, grip: 10, shank: 2, score: 1, temper: 1});
export const SARDINE_KEY_DOMAINS = Object.freeze({effort: [2, 24, 0.5], grip: [6, 16, 1], shank: [1.5, 3, 0.25], score: [0, 2, 1], temper: [0, 3, 1]});
export const SARDINE_KEY_OPTIONS = Object.freeze({
  score: Object.freeze([
    {value: 0, label: 'Deep score: 6 N a line', tearPerLine: 6},
    {value: 1, label: 'Standard score: 10 N a line', tearPerLine: 10},
    {value: 2, label: 'Shallow score: 14 N a line', tearPerLine: 14},
  ]),
  temper: Object.freeze([
    {value: 0, label: 'TS230: 230 MPa', grade: 'TS230', yieldStrength: 230},
    {value: 1, label: 'TS275: 275 MPa', grade: 'TS275', yieldStrength: 275},
    {value: 2, label: 'TH415: 415 MPa', grade: 'TH415', yieldStrength: 415},
    {value: 3, label: 'TH550: 550 MPa', grade: 'TH550', yieldStrength: 550},
  ]),
});
export const SARDINE_KEY_CONSTANTS = Object.freeze({
  length: 105, breadth: 76, cornerRadius: 15, height: 30, bandCenter: 22,
  thickness: 0.2, bandWidth: 8, turnRate: 1.25, withdrawDuration: 0.4, liftDuration: 0.8, duration: 16,
});

const TAU = Math.PI * 2;
const TOLERANCE = 1e-9;

/** The band's path around the can mid-surface, starting at the tab. */
export function canSegments(c = SARDINE_KEY_CONSTANTS) {
  // The tab is in the middle of the front side, so the key starts facing the reader.
  const a = c.length / 2, b = c.breadth / 2, rc = c.cornerRadius, arc = Math.PI * rc / 2, half = a - rc;
  const list = [
    {kind: 'side', length: half, psi: 0, start: [0, b]},
    {kind: 'corner', length: arc, psi: 0, center: [a - rc, b - rc]},
    {kind: 'side', length: c.breadth - 2 * rc, psi: Math.PI / 2, start: [a, b - rc]},
    {kind: 'corner', length: arc, psi: Math.PI / 2, center: [a - rc, -(b - rc)]},
    {kind: 'side', length: c.length - 2 * rc, psi: Math.PI, start: [a - rc, -b]},
    {kind: 'corner', length: arc, psi: Math.PI, center: [-(a - rc), -(b - rc)]},
    {kind: 'side', length: c.breadth - 2 * rc, psi: 3 * Math.PI / 2, start: [-a, -(b - rc)]},
    {kind: 'corner', length: arc, psi: 3 * Math.PI / 2, center: [-(a - rc), b - rc]},
    {kind: 'side', length: half, psi: TAU, start: [-(a - rc), b]},
  ];
  let s = 0;
  for (const segment of list) { segment.from = s; s += segment.length; segment.to = s; segment.kappa = segment.kind === 'corner' ? 1 / rc : 0; }
  return list;
}

const SEGMENTS = canSegments();
export const BAND_LENGTH = SEGMENTS.at(-1).to;

function segmentAt(s) {
  return SEGMENTS.find(segment => s < segment.to) || SEGMENTS.at(-1);
}

/**
 * Where the peel line is after s millimeters of band, on the wall mid-surface.
 * psi is the heading: the direction of travel is (cos psi, -sin psi) in x and z,
 * and the outward normal is (sin psi, cos psi).
 */
export function canPoint(s) {
  const d = Math.max(0, Math.min(BAND_LENGTH, s)), segment = segmentAt(d), along = d - segment.from, rc = SARDINE_KEY_CONSTANTS.cornerRadius;
  if (segment.kind === 'side') {
    const psi = segment.psi;
    return {x: segment.start[0] + along * Math.cos(psi), z: segment.start[1] - along * Math.sin(psi), psi, kappa: 0, segment: SEGMENTS.indexOf(segment)};
  }
  const psi = segment.psi + along / rc;
  return {x: segment.center[0] + rc * Math.sin(psi), z: segment.center[1] + rc * Math.cos(psi), psi, kappa: 1 / rc, segment: SEGMENTS.indexOf(segment)};
}

export function woundLength(theta, rho0, h = SARDINE_KEY_CONSTANTS.thickness) {
  return rho0 * theta + h * theta * theta / (2 * TAU);
}

export function angleForLength(length, rho0, h = SARDINE_KEY_CONSTANTS.thickness) {
  return (TAU / h) * (Math.sqrt(rho0 * rho0 + h * length / Math.PI) - rho0);
}

// beta is shaft rotation relative to the fixed can, not merely turns wound.
// On a corner d(beta)/ds = 1/rho + kappa. Invert each monotone segment.
function lengthForKeyAngle(beta, rho0) {
  const segment = SEGMENTS.find(segment => beta < angleForLength(segment.to, rho0) + segment.psi + segment.kappa * segment.length) || SEGMENTS.at(-1);
  const a = segment.kappa * SARDINE_KEY_CONSTANTS.thickness / (2 * TAU);
  const b = 1 + segment.kappa * rho0, c = beta - segment.psi + segment.kappa * segment.from;
  const theta = a ? 2 * c / (b + Math.sqrt(b * b + 4 * a * c)) : c / b;
  return Math.max(0, Math.min(BAND_LENGTH, woundLength(theta, rho0)));
}

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected sardine-can key controls');
  for (const key of Object.keys(input)) if (!Object.hasOwn(SARDINE_KEY_DOMAINS, key)) throw new RangeError('Unknown control ' + key);
  const values = {...SARDINE_KEY_DEFAULTS, ...input};
  for (const [key, [lo, hi, step]] of Object.entries(SARDINE_KEY_DOMAINS)) {
    const n = values[key];
    if (!Number.isFinite(n) || n < lo || n > hi || Math.abs((n - lo) / step - Math.round((n - lo) / step)) > 1e-8) throw new RangeError('Invalid ' + key);
  }
  return values;
}

/** Everything that does not depend on time: the band, the coil and the force it will need. */
export function sardineKeyPlan(input = {}) {
  const values = validate(input), c = SARDINE_KEY_CONSTANTS, h = c.thickness;
  const tearPerLine = SARDINE_KEY_OPTIONS.score[values.score].tearPerLine, tear = 2 * tearPerLine;
  const temper = SARDINE_KEY_OPTIONS.temper[values.temper], plasticMoment = temper.yieldStrength * c.bandWidth * h * h / 4;
  const rho0 = values.shank + h / 2, thetaTotal = angleForLength(BAND_LENGTH, rho0, h), rhoFinal = rho0 + h * thetaTotal / TAU;
  const rhoAt = s => rho0 + h * angleForLength(s, rho0, h) / TAU;
  const torqueAt = s => { const rho = rhoAt(s), kappa = segmentAt(Math.min(BAND_LENGTH, Math.max(0, s))).kappa; return tear * rho / (1 + rho * kappa) + plasticMoment; };
  const available = values.effort * values.grip;

  // The first point where the torque needed is more than the fingers can give.
  let stall = null;
  for (const segment of SEGMENTS) {
    const startTorque = torqueAt(segment.from);
    if (startTorque > available + TOLERANCE) { stall = segment.from; break; }
    const remainingTorque = available - plasticMoment;
    const denominator = tear - remainingTorque * segment.kappa;
    const rhoLimit = denominator > 0 ? remainingTorque / denominator : Infinity;
    const sLimit = woundLength((rhoLimit - rho0) * TAU / h, rho0, h);
    if (rhoLimit >= rho0 && sLimit < segment.to - TOLERANCE) { stall = Math.max(segment.from, sLimit); break; }
  }
  const segmentEnds = SEGMENTS.map(segment => ({s: segment.to, force: (tear * rhoAt(segment.to) / (1 + rhoAt(segment.to) * segment.kappa) + plasticMoment) / values.grip}));
  const peak = segmentEnds.reduce((best, point) => point.force > best.force ? point : best);
  return {
    values, tearPerLine, tear, temper: temper.grade, yieldStrength: temper.yieldStrength, plasticMoment, rho0, thetaTotal, turnsTotal: thetaTotal / TAU + 1, windingTurnsTotal: thetaTotal / TAU, keyAngleTotal: thetaTotal + TAU, rhoFinal,
    bandLength: BAND_LENGTH, available, rhoAt, keyAngleAt: s => angleForLength(s, rho0) + canPoint(s).psi, torqueAt, forceAt: s => torqueAt(s) / values.grip,
    forceAtStart: torqueAt(0) / values.grip, forceAtEnd: segmentEnds.at(-1).force, peakForce: peak.force, peakAt: peak.s,
    stallLength: stall, stallTheta: stall === null ? null : angleForLength(stall, rho0, h),
    freedTime: stall === null ? (thetaTotal + TAU) / (TAU * c.turnRate) : null,
  };
}

/** The state of one trial at a time: the fingers try turnRate turns a second. */
export function sampleSardineKey(input = {}, time = 0) {
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Invalid trial time');
  const plan = sardineKeyPlan(input), c = SARDINE_KEY_CONSTANTS, h = c.thickness, values = plan.values;
  const elapsed = Math.min(c.duration, time), attempted = TAU * c.turnRate * elapsed;
  const limit = plan.stallTheta === null ? plan.keyAngleTotal : plan.keyAngleAt(plan.stallLength);
  const keyAngle = Math.min(attempted, limit);
  const length = keyAngle >= plan.keyAngleTotal ? BAND_LENGTH : keyAngle >= limit && plan.stallLength !== null ? plan.stallLength : lengthForKeyAngle(keyAngle, plan.rho0);
  const theta = angleForLength(length, plan.rho0);
  const rho = plan.rho0 + h * theta / TAU, point = canPoint(length), kappa = segmentAt(Math.min(length, BAND_LENGTH)).kappa;
  const stalled = plan.stallTheta !== null && attempted >= limit;
  const freed = plan.stallTheta === null && attempted >= plan.keyAngleTotal;
  const cornerWound = SEGMENTS.filter(segment => segment.kind === 'corner').reduce((sum, segment) => sum + Math.max(0, Math.min(length, segment.to) - segment.from), 0);
  const torque = plan.tear * rho / (1 + rho * kappa) + plan.plasticMoment;
  // Once the band is off, the key and its coil come away first, then the lid.
  const afterFree = freed ? elapsed - plan.freedTime : 0;
  const ease = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  const keyWithdraw = freed ? ease(afterFree / c.withdrawDuration) : 0;
  const lidLift = freed ? ease((afterFree - c.withdrawDuration) / c.liftDuration) : 0;
  const mode = elapsed === 0 ? 'ready' : freed ? 'freed' : stalled ? 'stalled' : 'winding';
  return {
    ...plan, elapsed, attempted, theta, keyAngle, turns: keyAngle / TAU, windingTurns: theta / TAU, woundLength: length, remainingLength: BAND_LENGTH - length, fraction: length / BAND_LENGTH,
    coilRadius: rho, coilOuterRadius: rho + h / 2, point, kappa, onCorner: kappa > 0,
    torque, fingerForce: torque / values.grip, stripPull: torque * (1 / rho + kappa), advantage: values.grip * (1 / rho + kappa),
    tearWork: plan.tear * length / 1000, bendWork: plan.plasticMoment * (theta + cornerWound / c.cornerRadius) / 1000,
    work: (plan.tear * length + plan.plasticMoment * (theta + cornerWound / c.cornerRadius)) / 1000,
    fingerTravel: values.grip * keyAngle, stalled, freed, keyWithdraw, lidLift, mode,
    complete: freed ? afterFree >= c.withdrawDuration + c.liftDuration : elapsed >= c.duration,
    // A key that cannot even start still lets Play run for a moment, so the
    // reader sees it try and stop rather than a button that does nothing.
    blocked: stalled && elapsed > 0,
  };
}

/** The trial time at which a given length of band would be off, ignoring any stall. */
export function timeForLength(input, length) {
  const plan = sardineKeyPlan(input);
  return plan.keyAngleAt(Math.max(0, Math.min(BAND_LENGTH, length))) / (TAU * SARDINE_KEY_CONSTANTS.turnRate);
}

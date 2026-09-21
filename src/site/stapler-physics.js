import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Stapler: one slow press of a desktop stapler, from the arm at rest until the
// staple's crown sits on the paper.
//
// Units: millimeters, newtons and seconds; work in joules.
//
// Exact, from the sources: each staple's wire, crown and legs; how much of
// each leg comes out through the back of the stack, and where the folded legs
// end; the lever, for pushes straight down: the hand's force times its
// distance from the hinge equals the blade's force times the blade's
// distance; and the cube law for folding a round wire, whose bending moment
// at full yield is its strength times d³/6.
//
// Illustrative: every force along the stroke (the two springs, breaking the
// staple off its strip, piercing, friction in the paper and folding), sized
// so a 26/6 staple's hardest push, pressed over the blade, stays within the
// 15 to 30 pounds-force a patent gives for a conventional stapler, from 1 to
// 25 sheets; the stapler's own dimensions; and 0.1 mm for every sheet, inside
// the 97 to 114 μm of 20-pound bond paper.
// ---------------------------------------------------------------------------

/** Newtons in one pound-force, by definition. */
export const LBF = 0.45359237 * 9.80665;

/**
 * Staple sizes from the table on Wikipedia's staple page: the wire's gauge and
 * the leg's length make the name, and the crown is measured across its
 * outside. The table gives 24/8 no crown width; it is taken as 24/6's.
 */
export const STAPLES = Object.freeze([
  Object.freeze({name: '26/6', wire: 0.405, crown: 12.7, leg: 6}),
  Object.freeze({name: '24/6', wire: 0.511, crown: 12.9, leg: 6}),
  Object.freeze({name: '24/8', wire: 0.511, crown: 12.9, leg: 8}),
]);

/** One sheet of paper, mm. */
export const SHEET = 0.1;

/**
 * The stapler, measured from the hinge along the base and up from the anvil's
 * face. Every staple rides in the magazine with its crown at the same height,
 * so shorter legs end higher above the paper.
 */
export const STAPLER = Object.freeze({
  blade: 160,
  gap: 9,
  recess: 0.5,
  longest: 8,
  speed: 4,
});

/** The illustrative forces, all felt at the blade. Per-leg forces are doubled for the two legs. */
export const FORCES = Object.freeze({
  magazine: 3,
  magazineRate: 0.2,
  spring: 5,
  springRate: 0.5,
  breakOff: 40,
  breakTravel: 0.15,
  cut: 6,
  friction: 12,
  fold: 28,
});

export const STAPLE_OPTIONS = Object.freeze(STAPLES.map((staple, value) => Object.freeze({value, label: `${staple.name}: ${staple.wire} mm wire, ${staple.leg} mm legs`})));
export const ANVIL_OPTIONS = Object.freeze([
  Object.freeze({value: 0, label: 'Permanent: legs folded inward'}),
  Object.freeze({value: 1, label: 'Temporary: legs folded outward'}),
]);

export const STAPLER_DEFAULTS = Object.freeze({sheets: 10, staple: 0, anvil: 0, hand: 160});
export const STAPLER_DOMAINS = Object.freeze({sheets: [1, 70, 1], staple: [0, 2, 1], anvil: [0, 1, 1], hand: [80, 160, 10]});

export const PHASES = Object.freeze({
  closing: 'Lowering the magazine onto the paper',
  breaking: 'Breaking the staple off the strip',
  free: 'Giving way',
  piercing: 'Piercing the paper',
  folding: 'Folding the legs',
  seated: 'Crown down on the paper',
});

/** A round wire's full plastic section modulus, d³/6, mm³: its bending moment at full yield is its strength times this. */
export const plasticModulus = wire => wire ** 3 / 6;

/** Each leg's folding force, N: the thinnest wire's, scaled by the plastic modulus. */
export const foldForce = wire => FORCES.fold * plasticModulus(wire) / plasticModulus(STAPLES[0].wire);

/** The return spring between arm and magazine, u mm into the drive. */
const springAt = u => FORCES.spring + FORCES.springRate * u;

/** Everything about one press that does not change as it goes. */
export function staplerPlan(input = {}) {
  const values = validateControls(input, STAPLER_DEFAULTS, STAPLER_DOMAINS, 'stapler');
  const staple = STAPLES[values.staple], {wire, crown, leg} = staple;
  const stack = values.sheets * SHEET;
  const below = leg - wire;
  const through = below - stack;
  const half = (crown - wire) / 2;
  const inward = values.anvil === 0;
  const folded = Math.max(0, through);
  const meet = inward && folded > half;
  const ratio = STAPLER.blade / values.hand;
  const fold = foldForce(wire);

  const closed = STAPLER.gap - stack;
  const recess = STAPLER.recess + STAPLER.longest - leg;
  const broken = closed + FORCES.breakTravel;
  const touch = closed + recess;
  const anvil = through > 0 ? touch + stack : null;
  const seat = touch + below;

  const plan = {
    values, staple, wire, crown, leg, stack, below, through, half, inward, folded, meet,
    overlap: meet ? 2 * (folded - half) : 0,
    tipGap: inward ? 2 * (half - folded) : 2 * (half + folded),
    ratio, fold, foldRatio: fold / FORCES.fold,
    closed, recess, broken, touch, anvil, seat, duration: seat / STAPLER.speed,
  };

  // The force is linear and rising inside each stage, so each stage's hardest
  // moment is at its end, approached from inside the stage.
  const pierced = through > 0 ? stack : below;
  const ends = [
    {phase: 'closing', drop: closed, force: FORCES.magazine + FORCES.magazineRate * closed},
    {phase: 'breaking', drop: broken, force: springAt(FORCES.breakTravel) + FORCES.breakOff},
    {phase: 'free', drop: touch, force: springAt(recess)},
    {phase: 'piercing', drop: touch + pierced, force: springAt(recess + pierced) + 2 * (FORCES.cut + FORCES.friction * pierced)},
  ];
  if (through > 0) ends.push({phase: 'folding', drop: seat, force: springAt(recess + below) + 2 * (fold + FORCES.friction * stack)});
  const peak = ends.reduce((best, end) => (end.force > best.force ? end : best));
  plan.peak = Object.freeze({...peak});
  plan.handPeak = peak.force * ratio;
  plan.work = workTo(plan, seat);
  plan.profile = Object.freeze(profileOf(plan).map(point => Object.freeze(point)));
  return Object.freeze(plan);
}

/** The blade's force at a drop, mm from rest; at a jump, the value just after it. */
export function bladeForce(plan, drop) {
  const {closed, recess, stack, below, through, fold} = plan;
  if (drop < closed) return FORCES.magazine + FORCES.magazineRate * drop;
  const u = drop - closed, spring = springAt(u);
  if (u < FORCES.breakTravel) return spring + FORCES.breakOff * u / FORCES.breakTravel;
  if (u < recess) return spring;
  const inside = u - recess;
  if (through > 0 && inside >= stack) return spring + 2 * (fold + FORCES.friction * stack);
  return spring + 2 * (FORCES.cut + FORCES.friction * Math.min(inside, below));
}

/** Which stage the press is in at a drop. */
export function phaseAt(plan, drop) {
  if (drop >= plan.seat) return 'seated';
  if (drop < plan.closed) return 'closing';
  const u = drop - plan.closed;
  if (u < FORCES.breakTravel) return 'breaking';
  if (u < plan.recess) return 'free';
  if (plan.through > 0 && u - plan.recess >= plan.stack) return 'folding';
  return 'piercing';
}

/** The work done at the blade up to a drop, J. */
export function workTo(plan, drop) {
  const s = Math.min(Math.max(drop, 0), plan.seat);
  const close = Math.min(s, plan.closed);
  let work = FORCES.magazine * close + FORCES.magazineRate * close * close / 2;
  const u = Math.max(0, s - plan.closed);
  work += FORCES.spring * u + FORCES.springRate * u * u / 2;
  const b = Math.min(u, FORCES.breakTravel);
  work += FORCES.breakOff * b * b / (2 * FORCES.breakTravel);
  const inside = Math.max(0, u - plan.recess);
  const pierced = Math.min(inside, plan.through > 0 ? plan.stack : plan.below);
  work += 2 * (FORCES.cut * pierced + FORCES.friction * pierced * pierced / 2);
  if (plan.through > 0) work += 2 * (plan.fold + FORCES.friction * plan.stack) * Math.max(0, inside - plan.stack);
  return work / 1000;
}

/** The force against the drop as a polyline, with each jump drawn as a vertical step. */
function profileOf(plan) {
  const {closed, recess, stack, below, through, fold, touch, anvil, seat} = plan;
  const bt = FORCES.breakTravel, points = [
    {drop: 0, force: FORCES.magazine},
    {drop: closed, force: FORCES.magazine + FORCES.magazineRate * closed},
    {drop: closed, force: springAt(0)},
    {drop: closed + bt, force: springAt(bt) + FORCES.breakOff},
    {drop: closed + bt, force: springAt(bt)},
    {drop: touch, force: springAt(recess)},
    {drop: touch, force: springAt(recess) + 2 * FORCES.cut},
  ];
  if (through > 0) {
    points.push(
      {drop: anvil, force: springAt(recess + stack) + 2 * (FORCES.cut + FORCES.friction * stack)},
      {drop: anvil, force: springAt(recess + stack) + 2 * (fold + FORCES.friction * stack)},
      {drop: seat, force: springAt(recess + below) + 2 * (fold + FORCES.friction * stack)},
    );
  } else {
    points.push({drop: seat, force: springAt(recess + below) + 2 * (FORCES.cut + FORCES.friction * below)});
  }
  return points;
}

/** The press at a moment of the slow playback. */
export function staplerAt(plan, time) {
  const t = validTime(time), drop = Math.min(plan.seat, STAPLER.speed * t);
  const blade = bladeForce(plan, drop);
  const inside = Math.max(0, drop - plan.closed - plan.recess);
  return {
    t, drop, phase: phaseAt(plan, drop), done: drop >= plan.seat,
    blade, hand: blade * plan.ratio, handTravel: drop / plan.ratio,
    nose: STAPLER.gap - Math.min(drop, plan.closed),
    crownTop: STAPLER.gap + STAPLER.recess + STAPLER.longest - drop,
    inPaper: Math.min(inside, plan.stack, plan.below),
    reach: plan.through > 0 ? Math.max(0, Math.min(inside - plan.stack, plan.through)) : 0,
    work: workTo(plan, drop),
  };
}

export const sampleStapler = (input, time = 0) => staplerAt(staplerPlan(input), time);

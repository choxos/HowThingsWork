import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Pens and capillary action: the physics behind the ballpoint pen, the
// felt-tip pen, the dip pen and the capillary bench beside it.
//
// Exact, for the constants below:
// - Jurin's law, h = 2γ cos θ / (ρ g r): how high a liquid stands in a tube of
//   radius r. Two plates a gap d apart lift it 2γ cos θ / (ρ g d), so d·h is
//   the same everywhere between them.
// - The pull of a curved surface, 2γ cos θ / r, balancing the column's weight.
// - The rise over time of a channel dipped into a liquid, from Poiseuille's law
//   with the column's weight and no inertia: k t = −L − L∞ ln(1 − L/L∞), where L
//   is the length of liquid in the channel, L∞ its final length and
//   k = ρ g gap² / (8 η) in a tube, ρ g gap² / (12 η) between plates.
// - Washburn's equation, L² = γ r t cos θ / (2 η), for wicking with no weight.
// - A ball rolling without slipping turns once for every π d of line.
// - The share of the ink's weight along the refill: the cosine of its angle
//   to straight down.
// - Flow between two plates at a given pull grows with the cube of the gap.
//
// Illustrative, stated where they are used: the bench's dip and wedge, the
// nib's size, slit and springiness, the refill's bore and ink column, the
// felt tip's pores and contact, and how fast paper drinks ink.
// ---------------------------------------------------------------------------

/** Gravity, m/s², as the capillary action page's worked example uses it. */
export const G = 9.81;

/**
 * Liquids, SI units: surface tension N/m, density kg/m³, viscosity Pa·s and the
 * contact angle on glass, degrees. Water and ethanol at 20 °C; mercury's
 * surface tension at 20 °C, its density near room temperature and its
 * viscosity at 25 °C.
 */
export const LIQUIDS = Object.freeze([
  Object.freeze({name: 'Water', tension: 0.0728, density: 1000, viscosity: 1.0016e-3, angle: 0}),
  Object.freeze({name: 'Ethanol', tension: 0.02227, density: 789.45, viscosity: 1.2e-3, angle: 0}),
  Object.freeze({name: 'Mercury', tension: 0.4865, density: 13546, viscosity: 1.526e-3, angle: 140}),
]);
export const [WATER, ETHANOL, MERCURY] = LIQUIDS;

const cosine = liquid => Math.cos(liquid.angle * Math.PI / 180);

/** The pull of the curved surface in a tube of radius `gap`, or between plates `gap` apart, Pa; negative pushes the liquid down. */
export const pullOf = (liquid, gap) => 2 * liquid.tension * cosine(liquid) / gap;

/** Jurin's height for a tube of radius `gap`, or plates `gap` apart, m above the liquid outside. */
export const jurinHeight = (liquid, gap) => pullOf(liquid, gap) / (liquid.density * G);

/** The capillary length, m: Jurin's law holds only in tubes narrower than this. */
export const capillaryLength = liquid => Math.sqrt(liquid.tension / (liquid.density * G));

/** Poiseuille's factor for a round tube and for the gap between two plates. */
export const TUBE = 8;
export const PLATES = 12;

/** A channel of `gap` m (tube radius or plate gap) dipped `depth` m: its rate k, m/s, and final length eq, m, from its bottom end. */
export function channel(liquid, gap, shape, depth) {
  return Object.freeze({gap, shape, depth, k: liquid.density * G * gap * gap / (shape * liquid.viscosity), eq: depth + jurinHeight(liquid, gap)});
}

/** The time for the liquid in a channel to reach `length` m, s. */
export function riseTime(ch, length) {
  if (length <= 0) return 0;
  if (!(ch.eq > length)) return Infinity;
  const x = length / ch.eq;
  return ch.eq * (-x - Math.log1p(-x)) / ch.k;
}

/**
 * The length of liquid in a channel after `time` s, m. With y = 1 − L/L∞ the
 * rise law reads ln y − y = −1 − k t / L∞, whose root has ln y between
 * −1 − k t / L∞ and −k t / L∞; bisection finds it to the last digit.
 */
export function riseAt(ch, time) {
  if (!(ch.eq > 0) || !(time > 0)) return 0;
  const tau = ch.k * time / ch.eq;
  let lo = -1 - tau, hi = -tau;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2;
    if (mid - Math.expm1(mid) + tau > 0) hi = mid; else lo = mid;
  }
  return ch.eq * -Math.expm1((lo + hi) / 2);
}

/** Washburn's wicking length after `time` s in a pore of radius `radius` m, with no weight, m. */
export const washburnLength = (liquid, radius, time) => Math.sqrt(liquid.tension * radius * time * cosine(liquid) / (2 * liquid.viscosity));

/** Washburn's time to wick `length` m along a pore of radius `radius` m, s. */
export const washburnTime = (liquid, radius, length) => 2 * liquid.viscosity * length * length / (liquid.tension * radius * cosine(liquid));

// ---------------------------------------------------------------------------
// The capillary bench and the dip pen.
// ---------------------------------------------------------------------------

/** The bench, mm: tube and wedge dipped `depth` into the dish; the wedge's plates open from `narrow` to `wide` across `width`. */
export const BENCH = Object.freeze({depth: 15, tall: 185, narrow: 0.1, wide: 1.0, width: 40});

/** The playback clock: each second shows ten times the time the one before, from 1 ms to 1,000 s. */
export const CLOCK = Object.freeze({first: 0.001, decades: 6, seconds: 6});
export const clockTime = seconds => CLOCK.first * (10 ** (Math.min(Math.max(seconds, 0), CLOCK.seconds) * CLOCK.decades / CLOCK.seconds) - 1);
export const clockSeconds = time => Math.log10(1 + Math.max(time, 0) / CLOCK.first) * CLOCK.seconds / CLOCK.decades;

/** The dip pen's steel nib, mm and N: tip to vent hole, the slit's gap at rest, the dip, how far a newton splays the tines, the line with no press. */
export const NIB = Object.freeze({length: 30, width: 7, thick: 0.25, slit: 10, vent: 1, gap: 0.02, dip: 3, compliance: 0.1, tip: 0.1});

export const LIQUID_OPTIONS = Object.freeze(LIQUIDS.map((liquid, value) => Object.freeze({value, label: liquid.name})));
export const DIP_DEFAULTS = Object.freeze({press: 0, liquid: 0, radius: 0.2});
export const DIP_DOMAINS = Object.freeze({press: [0, 1, 0.1], liquid: [0, 2, 1], radius: [0.1, 0.5, 0.05]});

/** The wedge's gap, mm, at `x` mm across it from its narrow edge. */
export const wedgeGap = x => BENCH.narrow + (BENCH.wide - BENCH.narrow) * x / BENCH.width;

/** Where across the wedge its gap equals `gap` mm, mm from the narrow edge. */
export const wedgeAt = gap => (gap - BENCH.narrow) / (BENCH.wide - BENCH.narrow) * BENCH.width;

/** The liquid between the wedge's plates `x` mm across, after `time` s: the strip's length from the plates' bottom edge, mm. Each strip rises on its own. */
export const wedgeLength = (liquid, x, time) => 1000 * riseAt(channel(liquid, wedgeGap(x) / 1000, PLATES, BENCH.depth / 1000), time);

export function dipPenPlan(input = {}) {
  const values = validateControls(input, DIP_DEFAULTS, DIP_DOMAINS, 'dip pen');
  const splay = NIB.compliance * values.press, tipGap = NIB.gap + splay;
  const slit = channel(WATER, NIB.gap / 1000, PLATES, NIB.dip / 1000);
  const liquid = LIQUIDS[values.liquid], r = values.radius / 1000, depth = BENCH.depth / 1000;
  const tube = channel(liquid, r, TUBE, depth), plates = channel(liquid, r, PLATES, depth);
  const enters = tube.eq > 0;
  return Object.freeze({
    values, liquid, radius: values.radius,
    splay, tipGap, line: NIB.tip + splay, flow: (tipGap / NIB.gap) ** 3,
    hold: 1000 * jurinHeight(WATER, tipGap / 1000), holdRest: 1000 * jurinHeight(WATER, NIB.gap / 1000),
    slit, fill: riseTime(slit, NIB.slit / 1000),
    height: 1000 * jurinHeight(liquid, r), pull: pullOf(liquid, r), head: liquid.density * G * depth,
    capillary: 1000 * capillaryLength(liquid), tube, plates, enters,
    tube90: enters ? riseTime(tube, 0.9 * tube.eq) : null, plates90: enters ? riseTime(plates, 0.9 * plates.eq) : null,
    duration: CLOCK.seconds,
  });
}

/** The dip pen and bench `time` s after both are dipped; lengths mm, the slit's from the tip and the tube's and plates' from their bottom ends. */
export function dipPenAt(plan, time) {
  const t = validTime(time), vent = NIB.slit;
  const slit = Math.min(1000 * riseAt(plan.slit, t), vent), tube = 1000 * riseAt(plan.tube, t), plates = 1000 * riseAt(plan.plates, t);
  return {t, slit, filled: slit >= vent, tube, level: plan.enters ? tube - BENCH.depth : null, plates, plateLevel: plan.enters ? plates - BENCH.depth : null};
}

export const sampleDipPen = (input, time = 0) => dipPenAt(dipPenPlan(input), time);

// ---------------------------------------------------------------------------
// The ballpoint pen.
// ---------------------------------------------------------------------------

/** Standard ball diameters, mm. */
export const BALL_SIZES = Object.freeze([0.3, 0.38, 0.4, 0.5, 0.7, 0.8, 1.0, 1.2, 1.4]);

/** The line, mm at mm/s; the refill's bore, a radius, and its column of ink, mm; the Space Pen's nitrogen, kPa. */
export const BALLPOINT = Object.freeze({line: 50, speed: 10, boreRadius: 1, column: 60, nitrogen: 310});

/** Where the pen writes: the share of the ink's weight along the refill toward the ball, the cosine of the refill's angle to straight down. */
export const PLACES = Object.freeze([
  Object.freeze({label: 'On a desk: pointing down', angle: 0, share: 1}),
  Object.freeze({label: 'On a wall: sideways', angle: 90, share: 0}),
  Object.freeze({label: 'On the ceiling: pointing up', angle: 180, share: -1}),
  Object.freeze({label: 'In orbit: nothing weighs', angle: null, share: 0}),
]);
export const REFILLS = Object.freeze(['Ordinary: open at the back', 'Pressurized: nitrogen behind a float']);

export const BALL_OPTIONS = Object.freeze(BALL_SIZES.map(value => Object.freeze({value, label: `${value.toFixed(value === 0.38 ? 2 : 1)} mm${value === 0.7 ? ': fine' : value === 1 ? ': medium' : value === 1.4 ? ': broad' : ''}`})));
export const PLACE_OPTIONS = Object.freeze(PLACES.map((place, value) => Object.freeze({value, label: place.label})));
export const REFILL_OPTIONS = Object.freeze(REFILLS.map((label, value) => Object.freeze({value, label})));
export const BALLPOINT_DEFAULTS = Object.freeze({ball: 0.7, place: 0, refill: 0});
export const BALLPOINT_DOMAINS = Object.freeze({ball: [0.3, 1.4, 0.01], place: [0, 3, 1], refill: [0, 1, 1]});

export function ballpointPlan(input = {}) {
  const values = validateControls(input, BALLPOINT_DEFAULTS, BALLPOINT_DOMAINS, 'ballpoint pen');
  if (!BALL_SIZES.includes(values.ball)) throw new RangeError('Invalid ball');
  const place = PLACES[values.place], pressurized = values.refill === 1, circumference = Math.PI * values.ball;
  const feeds = pressurized || place.share >= 0;
  return Object.freeze({
    values, ball: values.ball, place, pressurized, circumference, feeds,
    turns: BALLPOINT.line / circumference, delay: circumference / 2,
    head: WATER.density * G * BALLPOINT.column / 1000 * place.share,
    weight: WATER.density * G * BALLPOINT.column / 1000,
    duration: BALLPOINT.line / BALLPOINT.speed,
  });
}

/** The pen `time` s into its line: travel mm, the ball's turn in radians, how far round the ball the ink has come, mm of its surface, and the line laid, mm. */
export function ballpointAt(plan, time) {
  const t = validTime(time), travel = Math.min(BALLPOINT.line, BALLPOINT.speed * t);
  return {
    t, travel, done: travel >= BALLPOINT.line,
    turn: travel / (plan.ball / 2), turns: travel / plan.circumference,
    ink: plan.feeds ? Math.min(travel, plan.delay) : 0,
    line: plan.feeds ? Math.max(0, travel - plan.delay) : 0,
  };
}

export const sampleBallpoint = (input, time = 0) => ballpointAt(ballpointPlan(input), time);

// ---------------------------------------------------------------------------
// The felt-tip pen.
// ---------------------------------------------------------------------------

/** Stand-in inks: water for a water-based ink, ethanol for an alcohol-based one. */
export const INKS = Object.freeze([WATER, ETHANOL]);
export const INK_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'Water-based ink (as water)'}), Object.freeze({value: 1, label: 'Alcohol-based ink (as ethanol)'})]);

/** The felt tip, mm, μm, s and mm/s^½: pore radii, the nib's length and contact, the stroke, the rest, and the paper's pace for water. */
export const FELT = Object.freeze({reservoirPore: 50, nibPore: 10, nib: 10, contact: 1, line: 40, rest: 2, pace: 0.5});
export const FELT_DEFAULTS = Object.freeze({ink: 0, speed: 20});
export const FELT_DOMAINS = Object.freeze({ink: [0, 1, 1], speed: [5, 40, 5]});

/** How fast an ink soaks in, relative to water: the square root of surface tension times cos θ over viscosity. */
export const paceRatio = liquid => Math.sqrt((liquid.tension * cosine(liquid) / liquid.viscosity) / (WATER.tension / WATER.viscosity));

export function feltTipPlan(input = {}) {
  const values = validateControls(input, FELT_DEFAULTS, FELT_DOMAINS, 'felt-tip pen');
  const ink = INKS[values.ink], pace = FELT.pace * paceRatio(ink);
  const dwell = FELT.contact / values.speed, spread = pace * Math.sqrt(dwell);
  const stroke = FELT.line / values.speed;
  return Object.freeze({
    values, ink, speed: values.speed, pace, dwell, spread, width: FELT.contact + 2 * spread,
    nibPull: pullOf(ink, FELT.nibPore * 1e-6), reservoirPull: pullOf(ink, FELT.reservoirPore * 1e-6),
    hold: jurinHeight(ink, FELT.nibPore * 1e-6), wick: washburnTime(ink, FELT.nibPore * 1e-6, FELT.nib / 1000),
    stroke, duration: stroke + FELT.rest,
    blot: FELT.contact / 2 + pace * Math.sqrt(dwell + FELT.rest),
  });
}

/** The felt tip `time` s into its stroke and rest: travel mm, rest s, and the blot's radius where it stops, mm. */
export function feltTipAt(plan, time) {
  const t = validTime(time), travel = Math.min(FELT.line, plan.speed * t), rest = Math.min(FELT.rest, Math.max(0, t - plan.stroke));
  return {t, travel, rest, done: t >= plan.duration, blot: rest > 0 ? FELT.contact / 2 + plan.pace * Math.sqrt(plan.dwell + rest) : 0};
}

export const sampleFeltTip = (input, time = 0) => feltTipAt(feltTipPlan(input), time);

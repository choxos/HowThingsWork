import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Lightning conductor: a storm's field gathered at a pointed air terminal and
// the corona it drives; a strike carrying the lightning current IEC 62305
// gives, run down a down conductor into an earth rod; the voltages that
// current raises along the conductor and in the ground; and the separation
// distance that keeps a side flash off a pipe beside the conductor.
//
// The currents follow Heidler, Flisowski, Zischank, Bouquegneau and Mazzetti,
// "Parameters of lightning current given in IEC 62305" (29th ICLP, 2008): the
// function i = (I/k)(t/τ1)^10/(1 + (t/τ1)^10)·exp(−t/τ2) with its Table 5
// constants for the first short stroke (10/350 μs) and the subsequent short
// stroke (0.25/100 μs), its Table 4 charges, specific energies and average
// steepness, and the 280 kA/μs steepest rise. DEHN's Lightning Protection
// Guide (2015) gives each level's minimum current, its probabilities and its
// rolling sphere, r = 10·I^0.65; the induction factors and s = ki·kc·l/km; the
// earth rod's RA = ρ/(2πl)·ln(2l/r), rods of 9 m, an earth resistance of 10 Ω
// or less; an 8 mm conductor; and a step of 1 m. The IET's "Separation from
// lightning conductors" gives a down conductor's self-inductance of about
// 1 µH/m. Stolzenburg and Marshall (arXiv 2108.04138) give Moore's
// semi-ellipsoid, Etip/Eambient = [η0(η0² − 1)(arccoth η0 − 1/η0)]⁻¹ with
// η0 = (1 − a/c)^−1/2, and corona starting at 67 V/m/Pa, 6.79 MV/m at sea
// level. Wikipedia gives air's dielectric strength of 3 MV/m, copper's
// resistivity, the standard atmosphere, μ0 and the average flash.
//
// The potential about the air terminal is the exact one for a grounded
// conducting prolate spheroid in a uniform field, Φ = −E0 f η (ξ − ξ0 Q1(ξ)/Q1(ξ0))
// in prolate spheroidal coordinates about foci ±f, whose gradient at the tip
// is Moore's enhancement.
//
// Not from a source: a house with one down conductor 10 m long from the air
// terminal's foot to a bonding bar at the ground, so kc = 1, and a metal pipe
// on the same wall beside it, as tall, bonded to it at the bottom, with air
// between them; the air terminal as Moore's semi-ellipsoid 2 m tall on a roof
// taken as flat ground, in the storm's field there, with the house's own
// effect on that field left out, and the roof taken as flat for the rolling
// sphere too; the conductor at copper's resistance at 20 °C with no skin
// effect; one earth rod 9 m long and 20 mm across in uniform soil, at its low
// frequency resistance, with its inductance and the soil's ionization left
// out, and the ground's potential taken as that of a line of current spread
// evenly along the rod; a person 5 m from the rod; a gap that breaks down at
// the field making level I's separation distance just hold its subsequent
// stroke, 3.49 MV/m, with what the current does after a flash left out; a
// strike that attaches to the air terminal; and a clock on which each tenfold
// in time takes 2 s, from 0.1 μs to 5 ms.
// ---------------------------------------------------------------------------

export const MU_0 = 1.25663706127e-6;
export const ATMOSPHERE = 101325;

/** Heidler et al. 2008, Table 5: the first short stroke's constants; Table 4: its peaks (A), charges (C) and specific energies (J/Ω) for LPL I, II, and III and IV, and its wave form T1/T2 (s). */
export const FIRST = Object.freeze({key: 'first', name: 'first short stroke', label: '10/350 μs', front: 10e-6, tail: 350e-6, k: 0.93, tau1: 19.0e-6, tau2: 485e-6, peak: Object.freeze([200e3, 150e3, 100e3]), charge: Object.freeze([100, 75, 50]), energy: Object.freeze([10e6, 5.6e6, 2.5e6])});
/** The subsequent short stroke: Table 5's constants, and Table 4's peaks (A), average front steepness (A/s) and wave form (s). */
export const SUBSEQUENT = Object.freeze({key: 'subsequent', name: 'subsequent short stroke', label: '0.25/100 μs', front: 0.25e-6, tail: 100e-6, k: 0.993, tau1: 0.454e-6, tau2: 143e-6, peak: Object.freeze([50e3, 37.5e3, 25e3]), steepness: Object.freeze([200e9, 150e9, 100e9])});
export const STROKES = Object.freeze([FIRST, SUBSEQUENT]);
/** The function's exponent; LPL I's steepest rise, 280 kA/μs; the 30% and 90% levels the average steepness is taken between; the long stroke's charge (C) over 0.5 s, and the whole flash's, for LPL I, II, and III and IV. */
export const HEIDLER = Object.freeze({exponent: 10, steepest: 280e9, band: Object.freeze([0.3, 0.9]), long: Object.freeze([200, 150, 100]), longTime: 0.5, flash: Object.freeze([300, 225, 150])});

/** DEHN Tables 2.7.1, 2.7.2, 5.1.1.1 and 5.6.1: each level's column in Heidler's tables, its induction factor, its rolling sphere radius (m), its minimum peak (A), and the probabilities that a current is above that minimum and below the maximum. */
export const LEVELS = Object.freeze([
  Object.freeze({name: 'I', column: 0, ki: 0.08, radius: 20, minimum: 3e3, above: 0.99, below: 0.99}),
  Object.freeze({name: 'II', column: 1, ki: 0.06, radius: 30, minimum: 5e3, above: 0.97, below: 0.98}),
  Object.freeze({name: 'III', column: 2, ki: 0.04, radius: 45, minimum: 10e3, above: 0.91, below: 0.95}),
  Object.freeze({name: 'IV', column: 2, ki: 0.04, radius: 60, minimum: 16e3, above: 0.84, below: 0.95}),
]);

/** DEHN, Lightning Protection Guide: r = 10·I^0.65 (m, kA); kc for one down conductor; km for air and for solid building materials; an earth resistance of 10 Ω or less; earth rods of 9 m proven advantageous, 5 m the least for classes III and IV; an 8 mm conductor, 50 mm²; its 22 K rise in copper at 10 MJ/Ω; the step of 1 m; the first negative stroke's peaks and wave form; and Figure 2.2.4's 100 kA through 10 Ω making 1,000 kV. */
export const DEHN = Object.freeze({strike: Object.freeze({coefficient: 10, exponent: 0.65}), kc: 1, air: 1, solid: 0.5, earth: 10, rod: 9, shortest: 5, diameter: 8e-3, area: 50e-6, copperRise: 22, step: 1, firstNegative: Object.freeze({peak: Object.freeze([100e3, 75e3, 50e3]), label: '1/200 μs'}), example: Object.freeze({current: 100e3, resistance: 10, volts: 1000e3})});

/** IET, Separation from lightning conductors: a down conductor's self-inductance of about 1 µH/m (H/m); rises of perhaps 20 kA/µs or up to 100 kA/µs (A/s); 200 kV or 1 MV at 10 m; and the waves a type 1 and a type 2 surge protective device are made for. */
export const IET = Object.freeze({inductance: 1e-6, rises: Object.freeze([20e9, 100e9]), height: 10, volts: Object.freeze([200e3, 1e6]), type1: '10/350 μs', type2: '8/20 μs'});

/** Stolzenburg and Marshall: Loeb's 67 V/m/Pa and 6.79 MV/m at sea level; point discharge from about 3 kV/m in Florida and 5 kV/m in New Mexico; corona ions up to at least 300 m; surface fields rarely above 8 kV/m in Florida and typically under 12 kV/m in New Mexico, and fields inside clouds ten times more; Moore's 1% of the tip's field 50 tip radii above it; about 30 nA from a tree 1.4 m tall at 6.4 kV/m; corona pulses at 50 kHz; and two points on their Figure 1. */
export const CORONA = Object.freeze({detach: 67, onset: 6.79e6, starts: Object.freeze([3e3, 5e3]), ions: 300, surface: Object.freeze([8e3, 12e3]), inside: 10, falloff: Object.freeze({share: 0.01, radii: 50}), tree: Object.freeze({current: 30e-9, height: 1.4, field: 6.4e3}), pulses: 50e3, figure: Object.freeze([Object.freeze({ratio: 1250, ambient: 6e3, tip: 2.30e6}), Object.freeze({ratio: 2000, ambient: 20e3, tip: 11.44e6})])});

/** Wikipedia: air's dielectric strength, 3 MV/m, and corona's critical field, roughly 30 kV/cm; the field near the surface in fair weather, about 100 V/m; an average negative flash's 30 kA and 15 C; positive lightning under 5%; a rise of 1 to 10 μs and a decay over 50 to 200 μs; the Lightning rod page's 680:1; copper's resistivity at 20 °C; and the Inductance page's 200 nH/m for a straight wire. */
export const PAGES = Object.freeze({air: 3e6, corona: 3e6, fairWeather: 100, flashCurrent: 30e3, flashCharge: 15, positive: 0.05, rise: Object.freeze([1e-6, 10e-6]), decay: Object.freeze([50e-6, 200e-6]), ratio: 680, copper: 1.68e-8, wire: 200e-9});

/** Not from a source, each said in the lesson's limits: the air terminal's height (m), the down conductor's length (m), the rod's radius (m), the person's distance from the rod (m), the house's width (m), the clock (s), the chart's samples, the close up's window about the tip (m), the equipotentials' spacing (V) and how many at most, the points on each side of a curve, and the reach and samples of the ground's potential (m). */
export const DECLARED = Object.freeze({height: 2, length: 10, rodRadius: 0.01, person: 5, house: 12, clock: Object.freeze({start: 1e-7, end: 5e-3, decade: 2}), samples: 241, window: Object.freeze({half: 7.5e-3, below: 5e-3, above: 10e-3}), spacing: 1000, contours: 40, points: 24, reach: 20, ground: 121});

export const LIGHTNING_DEFAULTS = Object.freeze({field: 10, tip: 0.5, level: 0, stroke: 0, soil: 100, gap: 1});
export const LIGHTNING_DOMAINS = Object.freeze({field: Object.freeze([0, 20, 1]), tip: Object.freeze([0.5, 25, 0.5]), level: Object.freeze([0, 3, 1]), stroke: Object.freeze([0, 1, 1]), soil: Object.freeze([50, 1000, 50]), gap: Object.freeze([0.1, 1.2, 0.05])});
export const LEVEL_OPTIONS = Object.freeze(LEVELS.map((level, value) => Object.freeze({value, label: `Level ${level.name}`})));
export const STROKE_OPTIONS = Object.freeze([Object.freeze({value: 0, label: `First short stroke, ${FIRST.label}`}), Object.freeze({value: 1, label: `Subsequent short stroke, ${SUBSEQUENT.label}`})]);

// ---------------------------------------------------------------------------
// Numerical helpers: 16-point Gauss–Legendre panels, golden section and bisection.
// ---------------------------------------------------------------------------

const GAUSS = (() => {
  const n = 16, nodes = [], weights = [];
  const legendre = x => { let p0 = 1, p1 = x; for (let j = 2; j <= n; j++) [p0, p1] = [p1, ((2 * j - 1) * x * p1 - (j - 1) * p0) / j]; return [p1, n * (x * p1 - p0) / (x * x - 1)]; };
  for (let i = 1; i <= n; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5));
    for (let iteration = 0; iteration < 50; iteration++) { const [value, slope] = legendre(x), step = value / slope; x -= step; if (Math.abs(step) < 1e-16) break; }
    const slope = legendre(x)[1];
    nodes.push(x);
    weights.push(2 / ((1 - x * x) * slope * slope));
  }
  return Object.freeze({nodes: Object.freeze(nodes), weights: Object.freeze(weights)});
})();
const gauss = (fn, a, b) => { const half = (b - a) / 2, middle = (a + b) / 2; let sum = 0; for (let i = 0; i < GAUSS.nodes.length; i++) sum += GAUSS.weights[i] * fn(middle + half * GAUSS.nodes[i]); return sum * half; };
/** ∫ fn from 0 to `upTo` over a stroke's panels: one up to a twentieth of τ1, then eight to a decade out to 60 τ2. */
const integrate = (edges, fn, upTo = Infinity) => { let sum = 0; for (let j = 1; j < edges.length && edges[j - 1] < upTo; j++) sum += gauss(fn, edges[j - 1], Math.min(edges[j], upTo)); return sum; };
const panelsOf = stroke => { const edges = [0], first = 0.05 * stroke.tau1, last = 60 * stroke.tau2; for (let k = 0; first * 10 ** (k / 8) < last; k++) edges.push(first * 10 ** (k / 8)); edges.push(last); return Object.freeze(edges); };
/** Where a function with one maximum on [lo, hi] peaks. */
const peakOf = (fn, lo, hi) => {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - ratio * (b - a), d = a + ratio * (b - a), fc = fn(c), fd = fn(d);
  for (let k = 0; k < 200 && b - a > 1e-15 * b; k++) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - ratio * (b - a); fc = fn(c); } else { a = c; c = d; fc = fd; d = a + ratio * (b - a); fd = fn(d); }
  }
  return (a + b) / 2;
};
/** Where fn, negative at lo and positive at hi, crosses zero. */
const rootOf = (fn, lo, hi) => { let a = lo, b = hi; for (let k = 0; k < 200; k++) { const m = (a + b) / 2; if (m <= a || m >= b) break; if (fn(m) < 0) a = m; else b = m; } return (a + b) / 2; };

// ---------------------------------------------------------------------------
// The strike.
// ---------------------------------------------------------------------------

/** The current, A, at t seconds after the strike attaches, for a stroke whose table peak is `peak`. */
export function currentOf(stroke, peak, t) {
  if (!(t > 0)) return 0;
  const x = (t / stroke.tau1) ** HEIDLER.exponent;
  return peak / stroke.k * (x / (1 + x)) * Math.exp(-t / stroke.tau2);
}
/** Its rate of change, A/s: the function differentiated. */
export function slopeOf(stroke, peak, t) {
  if (!(t > 0)) return 0;
  const x = (t / stroke.tau1) ** HEIDLER.exponent;
  return peak / stroke.k * Math.exp(-t / stroke.tau2) * (x / (1 + x)) * (HEIDLER.exponent / (t * (1 + x)) - 1 / stroke.tau2);
}

/** The down conductor, 8 mm copper 10 m long: its cross section (m²), resistance per meter and in all (Ω), and its inductance at 1 µH/m (H). */
export const CONDUCTOR = (() => { const area = Math.PI * (DEHN.diameter / 2) ** 2, perMeter = PAGES.copper / area; return Object.freeze({area, perMeter, resistance: perMeter * DECLARED.length, inductance: IET.inductance * DECLARED.length}); })();

/** Each stroke's shape for a table peak of 1 A: when it peaks and how high, its 10%, 30% and 90% times on the front, its half value on the tail, its steepest rise and when, the average steepness from 30% to 90%, and its charge and specific energy. */
export const SHAPES = Object.freeze(STROKES.map(stroke => {
  const current = t => currentOf(stroke, 1, t), slope = t => slopeOf(stroke, 1, t);
  const peakTime = peakOf(current, stroke.tau1, 10 * stroke.tau1), top = current(peakTime);
  const rise = share => rootOf(t => current(t) - share * top, 0, peakTime);
  const [t10, t30, t90] = [0.1, HEIDLER.band[0], HEIDLER.band[1]].map(rise);
  const half = rootOf(t => top / 2 - current(t), peakTime, 60 * stroke.tau2);
  const steepestTime = peakOf(slope, stroke.tau1 / 10, peakTime), edges = panelsOf(stroke);
  return Object.freeze({edges, peakTime, top, t10, t30, t90, half, steepestTime, steepest: slope(steepestTime), average: (HEIDLER.band[1] - HEIDLER.band[0]) * top / (t90 - t30), charge: integrate(edges, current), energy: integrate(edges, t => current(t) ** 2)});
}));

/** The voltage across the gap, V, for each ampere of table peak: 1 µH/m along the 10 m times di/dt, and the copper's resistance times i. The pipe, bonded at the bottom, shares the earth's rise. */
const gapPerAmpere = (stroke, t) => CONDUCTOR.inductance * slopeOf(stroke, 1, t) + CONDUCTOR.resistance * currentOf(stroke, 1, t);
/** When each stroke's gap voltage peaks, on its front, and how high for each ampere of table peak. */
export const GAP_PEAKS = Object.freeze(STROKES.map((stroke, index) => { const time = peakOf(t => gapPerAmpere(stroke, t), stroke.tau1 / 10, SHAPES[index].peakTime); return Object.freeze({time, volts: gapPerAmpere(stroke, time)}); }));
/** The field, V/m, at which the model's gap breaks down: the one at which level I's separation distance just holds its subsequent stroke. */
export const WITHSTAND = GAP_PEAKS[1].volts * SUBSEQUENT.peak[0] / (LEVELS[0].ki * DEHN.kc * DECLARED.length / DEHN.air);

// ---------------------------------------------------------------------------
// The point.
// ---------------------------------------------------------------------------

/** Moore's field enhancement at the tip of a semi-ellipsoid c tall with tip radius a, from c/a. */
export function enhancementOf(ratio) {
  const excess = 1 / (ratio - 1), eta = Math.sqrt(1 + excess), above = excess / (eta + 1);
  return 1 / (eta * excess * (0.5 * Math.log((eta + 1) / above) - 1 / eta));
}

/** The Legendre function of the second kind, Q1(x) = (x/2)·ln((x + 1)/(x − 1)) − 1, for x > 1, and its slope. */
export const legendreQ1 = x => x / 2 * Math.log((x + 1) / (x - 1)) - 1;
const legendreQ1Slope = x => 0.5 * Math.log((x + 1) / (x - 1)) - x / ((x - 1) * (x + 1));

/** A prolate spheroid c tall above the ground with tip radius a: its half width b, foci at ±f and surface ξ0 = c/f. */
export function spheroidOf(tip, height = DECLARED.height) {
  const b = Math.sqrt(tip * height), f = Math.sqrt(height * height - tip * height), xi = height / f;
  return Object.freeze({a: tip, b, c: height, f, xi, q: legendreQ1(xi)});
}
const shapeG = (s, xi) => xi - s.xi * legendreQ1(xi) / s.q;
const shapeSlope = (s, xi) => 1 - s.xi * legendreQ1Slope(xi) / s.q;

/** Prolate spheroidal coordinates (ξ, η) of a point r from the axis and z above the ground. */
export function prolateOf(s, r, z) { const near = Math.hypot(r, z - s.f), far = Math.hypot(r, z + s.f); return {xi: (near + far) / (2 * s.f), eta: (far - near) / (2 * s.f)}; }
/** The potential, V, outside the grounded spheroid in an ambient field pointing up (V/m). */
export function potentialAt(s, ambient, r, z) { const {xi, eta} = prolateOf(s, r, z); return -ambient * s.f * eta * shapeG(s, xi); }
function fieldOf(s, ambient, xi, eta) {
  const g = shapeG(s, xi), slope = shapeSlope(s, xi), across = (1 - eta) * (1 + eta), along = (xi - 1) * (xi + 1);
  return ambient * Math.sqrt((eta * eta * slope * slope * along + g * g * across) / (along + across));
}
/** The field's size, V/m, at a point outside the spheroid. */
export function fieldAt(s, ambient, r, z) { const {xi, eta} = prolateOf(s, r, z); return fieldOf(s, ambient, xi, eta); }
/** The field, V/m, on the axis at a height z above the ground, above the tip. */
export const axisFieldAt = (s, ambient, z) => ambient * shapeSlope(s, z / s.f);

/** The point at (ξ, u), u = √(1 − η²): its distance from the axis and its height above the tip, m. */
const pointOf = (s, xi, u) => [s.f * Math.sqrt((xi - 1) * (xi + 1)) * u, s.f * xi * Math.sqrt((1 - u) * (1 + u)) - s.c];
/** The ξ outside the surface where `below(ξ)` stops holding, found by halving ξ − 1 geometrically. */
function xiWhere(s, below) {
  let lo = s.xi, hi = 1 + 2 * (s.xi - 1);
  while (below(hi)) { lo = hi; hi = 1 + 2 * (hi - 1); }
  for (let k = 0; k < 40; k++) { const middle = 1 + Math.sqrt((lo - 1) * (hi - 1)); if (below(middle)) lo = middle; else hi = middle; }
  return 1 + Math.sqrt((lo - 1) * (hi - 1));
}

/** The equipotentials in the close up's window, 1 kV apart: each a list of [x, y] m about the tip, running from the window's edge on the left over the axis to its edge on the right. */
function contoursOf(s, ambient) {
  if (!(ambient > 0)) return [];
  const {half, below, above} = DECLARED.window, reach = -potentialAt(s, ambient, 0, s.c + above), count = Math.min(DECLARED.contours, Math.floor(reach / DECLARED.spacing + 1e-9)), lines = [];
  for (let k = 1; k <= count; k++) {
    const volts = k * DECLARED.spacing;
    const at = u => { const target = volts / (ambient * s.f * Math.sqrt((1 - u) * (1 + u))); return pointOf(s, xiWhere(s, xi => shapeG(s, xi) < target), u); };
    const inside = u => { const [x, y] = at(u); return x <= half && y >= -below; };
    let lo = 0, hi = 1 - 1e-9;
    for (let j = 0; j < 36; j++) { const middle = (lo + hi) / 2; if (inside(middle)) lo = middle; else hi = middle; }
    const right = Array.from({length: DECLARED.points + 1}, (_, j) => at(lo * j / DECLARED.points));
    lines.push({volts, points: [...right.slice(1).reverse().map(([x, y]) => [-x, y]), ...right]});
  }
  return lines;
}

/** Where the field is at least air's 3 MV/m about the tip, or null: for each u out to where the surface field falls to 3 MV/m, the surface point and the boundary point, [x, y] m about the tip; and how far the boundary reaches above the tip on the axis. */
function zoneOf(s, ambient) {
  const strength = PAGES.air;
  if (!(ambient > 0) || !(fieldOf(s, ambient, s.xi, 1) >= strength)) return null;
  const edge = rootOf(u => strength - fieldOf(s, ambient, s.xi, Math.sqrt((1 - u) * (1 + u))), 0, 1);
  const rows = Array.from({length: DECLARED.points + 1}, (_, j) => {
    const u = edge * j / DECLARED.points, eta = Math.sqrt((1 - u) * (1 + u)), xi = j === DECLARED.points ? s.xi : xiWhere(s, candidate => fieldOf(s, ambient, candidate, eta) >= strength);
    return {surface: pointOf(s, s.xi, u), boundary: pointOf(s, xi, u)};
  });
  return {edge, height: rows[0].boundary[1], rows};
}

// ---------------------------------------------------------------------------
// The ground, the levels and the clock.
// ---------------------------------------------------------------------------

/** DEHN's earth rod, 9 m long and 20 mm across, in soil of resistivity ρ (Ω·m): RA = ρ/(2πl)·ln(2l/r). */
export const rodResistanceOf = soil => soil / (2 * Math.PI * DEHN.rod) * Math.log(2 * DEHN.rod / DECLARED.rodRadius);
/** The ground's potential, V, at a distance from the rod when it carries a current: a line of current spread evenly along the rod, ρI/(2πl)·asinh(l/x). */
export const groundPotentialOf = (soil, current, distance) => soil * current / (2 * Math.PI * DEHN.rod) * Math.asinh(DEHN.rod / distance);
/** DEHN's final striking distance, m, for a peak current in A. */
export const strikeRadiusOf = current => DEHN.strike.coefficient * (current / 1000) ** DEHN.strike.exponent;
/** How far from the air terminal's foot a rolling sphere resting on the roof, taken as flat, touches it when it also touches the tip. */
export const roofTouchOf = radius => Math.sqrt((2 * radius - DECLARED.height) * DECLARED.height);

/** The run: real seconds of Play from 0.1 μs to 5 ms, each tenfold in time taking 2 s. */
export const RUN = DECLARED.clock.decade * Math.log10(DECLARED.clock.end / DECLARED.clock.start);
/** The time since the strike attached, s, after `seconds` of Play; zero before Play. */
export const timeOfClock = seconds => (seconds > 0 ? DECLARED.clock.start * 10 ** (Math.min(seconds, RUN) / DECLARED.clock.decade) : 0);
/** The seconds of Play that reach a time since the strike attached. */
export const clockOfTime = t => (t > DECLARED.clock.start ? Math.min(RUN, DECLARED.clock.decade * Math.log10(t / DECLARED.clock.start)) : 0);

const plans = new Map();

export function lightningPlan(input = {}) {
  const values = validateControls(input, LIGHTNING_DEFAULTS, LIGHTNING_DOMAINS, 'lightning conductor');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const level = LEVELS[values.level], stroke = STROKES[values.stroke], shape = SHAPES[values.stroke], gapPeak = GAP_PEAKS[values.stroke];
  const peak = stroke.peak[level.column], top = peak * shape.top, ambient = values.field * 1000, tip = values.tip / 1000;
  const spheroid = spheroidOf(tip), ratio = DECLARED.height / tip, enhancement = enhancementOf(ratio), tipField = enhancement * ambient;
  const gapMax = gapPeak.volts * peak, withstand = WITHSTAND * values.gap, earthResistance = rodResistanceOf(values.soil);
  const flash = gapMax > withstand * (1 + 1e-9) ? rootOf(t => gapPerAmpere(stroke, t) * peak - withstand, 0, gapPeak.time) : null;
  const near = groundPotentialOf(values.soil, top, DECLARED.person), far = groundPotentialOf(values.soil, top, DECLARED.person + DEHN.step);
  const {start, end} = DECLARED.clock;
  const plan = {
    values, level, stroke, shape, peak, top, ambient, tip, spheroid, ratio, enhancement, tipField,
    corona: tipField >= CORONA.onset, onsetField: CORONA.onset / enhancement,
    falloff: ambient > 0 ? axisFieldAt(spheroid, ambient, spheroid.c + CORONA.falloff.radii * tip) / tipField : null,
    zone: zoneOf(spheroid, ambient), contours: contoursOf(spheroid, ambient),
    steepest: shape.steepest * peak, steepestTime: shape.steepestTime, steepestCurrent: currentOf(stroke, peak, shape.steepestTime),
    peakTime: shape.peakTime, charge: shape.charge * peak, energy: shape.energy * peak * peak, average: shape.average * peak,
    inductiveMax: CONDUCTOR.inductance * shape.steepest * peak,
    gapMax, gapTime: gapPeak.time, gapField: gapMax / values.gap, withstand, flash, threshold: gapMax / WITHSTAND,
    separation: level.ki * DEHN.kc * DECLARED.length / DEHN.air,
    earthResistance, earthMax: earthResistance * top,
    step: {near, far, volts: near - far},
    strikeRadius: strikeRadiusOf(level.minimum), roofTouch: roofTouchOf(level.radius),
    duration: RUN,
  };
  plan.samples = Array.from({length: DECLARED.samples}, (_, j) => { const t = start * (end / start) ** (j / (DECLARED.samples - 1)), current = currentOf(stroke, peak, t); return {t, current, gap: gapPerAmpere(stroke, t) * peak, earth: earthResistance * current}; });
  plan.ground = Array.from({length: DECLARED.ground}, (_, j) => { const x = DECLARED.rodRadius * (DECLARED.reach / DECLARED.rodRadius) ** (j / (DECLARED.ground - 1)); return {x, volts: groundPotentialOf(values.soil, top, x)}; });
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The strike at t seconds after it attaches: the current and its rate of change, the voltages along the conductor, across the gap and at the earth, the field across the gap, the charge gone to earth so far, whether the gap has flashed, and the step voltage 5 m out. */
export function lightningAt(plan, time) {
  const t = validTime(time), {stroke, peak} = plan, current = currentOf(stroke, peak, t), slope = slopeOf(stroke, peak, t);
  const inductive = CONDUCTOR.inductance * slope, resistive = CONDUCTOR.resistance * current, gap = inductive + resistive, earth = plan.earthResistance * current;
  return {
    t, current, slope, inductive, resistive, gap, earth, top: earth + gap, field: gap / plan.values.gap, share: current / plan.top,
    charge: integrate(plan.shape.edges, u => currentOf(stroke, peak, u), t), flashed: plan.flash !== null && t >= plan.flash,
    step: plan.step.volts * current / plan.top,
  };
}

export const sampleLightning = (input = {}, time = 0) => lightningAt(lightningPlan(input), time);

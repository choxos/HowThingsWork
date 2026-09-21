import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Burglar alarms that watch a walker cross: an active infrared beam barrier,
// whose receiver sounds when its beam stays blocked long enough, and a passive
// infrared movement detector, whose lens sends each zone of the room onto one
// of two pyroelectric elements wired against each other.
//
// Exact within the model: the beam's power falling as the square of the span;
// the time a body of fixed depth covers a line at a steady speed; the exitance
// a surface sends past a long-pass filter, from Planck's law summed as its
// series; each zone's directions through a thin lens; the solid angle a body
// covers in each zone; and a band-pass of a thermal lag and an electrical leak,
// stepped exactly for power that changes linearly over each millisecond.
//
// Sourced: Optex's AX-100TFR (rated for 30 m, its beam arriving to 265 m,
// interruption settings of 50, 100, 250 and 500 ms, a 2 s alarm, 4 beam
// channels); Vishay's TSAL6100 emitter (940 nm, 170 mW/sr at 100 mA and 1,450
// mW/sr in 100 μs pulses of 1 A) and BPV10NF photodiode (60 μA at 1 mW/cm²,
// with a daylight blocking filter); Panasonic's PaPIRs test (5 m, 4 °C over a
// background at 25 °C, 1 m/s, a target 700 by 250 mm, a 2.6 s hold, and 1.4
// times as far at 8 °C); Excelitas's LHi 968 (two elements of 2 by 1 mm, 4,000
// V/W at 1 Hz, a 1% match, 20 to 50 μV of noise); Murata's IRA-E700 (a 5 μm
// long-pass filter, 45° each side); human skin's emissivity of 0.97 to 0.999;
// σ and Wien's b; the exact SI values of h, kB and c.
//
// Declared, not from a source: the beam taken as a line between the lenses,
// and its arrival distance as where it falls to the receiver's threshold;
// flashes 1,000 times a second; skin at an emissivity of 0.98; a lens of 5
// facets of 12.5 mm focal length in one row at the body's middle; elements 1 mm
// apart; a thermal time constant of 0.1 s and an electrical one of 1 s; a
// threshold of 50 μV, the sheet's largest noise; everything in view warming
// together; and the facets' collecting area, chosen so Panasonic's test target
// just reaches the threshold at 5 m.
// ---------------------------------------------------------------------------

export const SIGMA = 5.670374419e-8;
export const WIEN = 2.897771955e-3;
export const PLANCK = 6.62607015e-34;
export const BOLTZMANN = 1.380649e-23;
export const LIGHT = 299792458;
/** Planck's second radiation constant hc/kB, m·K. */
export const C2 = PLANCK * LIGHT / BOLTZMANN;
export const KELVIN = 273.15;

/** Optex AX-100TFR: rated range and maximum arrival distance, m; interruption settings, ms, and their names; the initial setting; beam channels; the alarm period, s; installation height, m; seconds of weak beam before a trouble signal; and the AX-200TFR's range and arrival distance. */
export const OPTEX = Object.freeze({
  model: 'AX-100TFR', range: 30, arrival: 265, holds: Object.freeze([50, 100, 250, 500]), names: Object.freeze(['Running', 'Jogging', 'Walking', 'Slow movement']),
  initial: 50, channels: 4, alarm: 2, height: Object.freeze([0.7, 1]), trouble: 20, larger: Object.freeze({model: 'AX-200TFR', range: 60, arrival: 530}),
});

/** Vishay TSAL6100: peak wavelength, nm; angle of half intensity, degrees; radiant intensity, W/sr, steady at 100 mA for 20 ms and in 100 μs pulses of 1 A. */
export const EMITTER = Object.freeze({model: 'TSAL6100', wavelength: 940, halfAngle: 10, steady: Object.freeze({current: 0.1, width: 0.02, intensity: 0.17}), pulsed: Object.freeze({current: 1, width: 100e-6, intensity: 1.45})});

/** Vishay BPV10NF: reverse light current, A, at an irradiance of 1 mW/cm² (10 W/m²) and 940 nm; angle of half sensitivity, degrees; dark current, A; half sensitivity band, nm. */
export const RECEIVER = Object.freeze({model: 'BPV10NF', current: 60e-6, irradiance: 10, wavelength: 940, halfAngle: 20, dark: 0.1e-9, band: Object.freeze([780, 1050])});

/** Panasonic PaPIRs: detection distance, m; temperature difference, °C, over a background at an ambient of 25 °C; speed, m/s; target, m; zones; field of view, degrees; lens diameter, mm; output hold, s; the doubled difference and how much farther it reaches, with its example distance; the analog sensors' speeds, m/s. */
export const PAPIRS = Object.freeze({
  distance: 5, contrast: 4, ambient: 25, speed: 1, target: Object.freeze({height: 0.7, width: 0.25}), zones: 64, field: Object.freeze([106, 97]), lens: 9.5, hold: 2.6,
  doubled: 8, farther: 1.4, far: 7, analog: Object.freeze([0.5, 1.5]),
});

/** Excelitas LHi 968: element height and width, mm; responsivity, V/W, at 1 Hz; match of the two elements; noise, V peak to peak, over 0.3 to 10 Hz; field of view, degrees. */
export const PYRO = Object.freeze({
  model: 'LHi 968', element: Object.freeze({height: 2, width: 1}), responsivity: Object.freeze({min: 3300, typical: 4000, at: 1}),
  match: Object.freeze({typical: 0.01, max: 0.1}), noise: Object.freeze({typical: 20e-6, max: 50e-6, band: Object.freeze([0.3, 10])}), field: 100,
});

/** Murata IRA-E700: the filter's cut-on, m; field of view each side, degrees; electrode height and width, mm. */
export const MURATA = Object.freeze({model: 'IRA-E700', filter: 5e-6, field: 45, electrode: Object.freeze({height: 2, width: 1})});

/** Human skin's emissivity, from the Emissivity page's table. */
export const SKIN = Object.freeze([0.97, 0.999]);
/** The typical walking speed, m/s. */
export const WALKING = 1.4;

/** Not from a source, each said in the lessons' limits: skin's emissivity; the lens's focal length, mm, element gap, mm, and facets; the elements' thermal and electrical time constants, s; the threshold, V; beam flashes a second; each watch, s; the step and chart samples; and the tolerance a threshold is reached to. */
export const DECLARED = Object.freeze({emissivity: 0.98, focal: 12.5, gap: 1, facets: 5, thermal: 0.1, electrical: 1, threshold: 50e-6, rate: 1000, beamWatch: 4, zoneWatch: 12, step: 1e-3, samples: 481, tolerance: 1e-9});

export const MODE_OPTIONS = Object.freeze([{value: 0, label: 'Active infrared beam'}, {value: 1, label: 'Passive infrared zones'}].map(Object.freeze));
export const HOLD_OPTIONS = Object.freeze(OPTEX.holds.map((ms, i) => Object.freeze({value: ms, label: `${OPTEX.names[i]}, ${ms} ms`})));
export const INTRUDER_DEFAULTS = Object.freeze({mode: 0, speed: 1, span: 30, hold: 50, range: 5, contrast: 4, warming: 0});
export const INTRUDER_DOMAINS = Object.freeze({mode: Object.freeze([0, 1, 1]), speed: Object.freeze([0, 6, 0.1]), span: Object.freeze([5, 30, 1]), hold: Object.freeze([50, 500, 50]), range: Object.freeze([1, 10, 0.5]), contrast: Object.freeze([0, 12, 0.5]), warming: Object.freeze([0, 30, 1])});
/** The method each control works in; null where it works in both. */
export const CONTROL_MODES = Object.freeze({mode: null, speed: null, span: 0, hold: 0, range: 1, contrast: 1, warming: 1});

// ---------------------------------------------------------------------------
// Infrared from a warm surface.
// ---------------------------------------------------------------------------

/** The share of a black body's exitance below a wavelength, for λT in m·K: (15/π⁴) Σ e^(−nz)/n (z³ + 3z²/n + 6z/n² + 6/n³), z = c₂/(λT). */
export function shareBelow(lambdaT) {
  const z = C2 / lambdaT;
  let sum = 0;
  for (let n = 1; n <= 400; n++) {
    const term = Math.exp(-n * z) / n * (z ** 3 + 3 * z * z / n + 6 * z / n ** 2 + 6 / n ** 3);
    sum += term;
    if (term <= 1e-17 * sum) break;
  }
  return 15 / Math.PI ** 4 * sum;
}

/** A black body's exitance, W/m², at wavelengths longer than `cut`, m. */
export const exitanceAbove = (kelvin, cut = MURATA.filter) => SIGMA * kelvin ** 4 * (1 - shareBelow(cut * kelvin));
/** Where a black body's spectrum per wavelength peaks, m. */
export const peakWavelength = kelvin => WIEN / kelvin;

// ---------------------------------------------------------------------------
// The lens, its zones and the body in them.
// ---------------------------------------------------------------------------

/**
 * The lens, angles in radians from the detector's axis, positive to the right:
 * each facet's axis, the + zone and the − zone it gives, a zone's width and
 * elevation, the step from one facet's zones to the next, the solid angle one
 * element sees through every facet, the outermost edge, and the middle of a +
 * zone about its facet's axis. A ray from θ through facet k lands 12.5 mm
 * behind it at −f·tan(θ − θk), so the element on the left sees the zone on the
 * right: that element is the + one.
 */
export const LENS = (() => {
  const f = DECLARED.focal, inner = Math.atan(DECLARED.gap / 2 / f), outer = Math.atan((DECLARED.gap / 2 + PYRO.element.width) / f);
  const pitch = 2 * (inner + outer), axes = Array.from({length: DECLARED.facets}, (_, k) => (k - (DECLARED.facets - 1) / 2) * pitch);
  const across = outer - inner, elevation = 2 * Math.atan(PYRO.element.height / 2 / f);
  return Object.freeze({
    focal: f, inner, outer, pitch, across, elevation, axes: Object.freeze(axes),
    plus: Object.freeze(axes.map(axis => Object.freeze([axis + inner, axis + outer]))), minus: Object.freeze(axes.map(axis => Object.freeze([axis - outer, axis - inner]))),
    solid: DECLARED.facets * across * elevation, edge: axes[axes.length - 1] + outer, center: (inner + outer) / 2,
  });
})();

/** Where a body walking at `x`, m, along a line `depth` m in front of the lens falls in the zones: its bearing and half width, radians, the elevation it shares with a zone, and the solid angle, sr, it covers in the + zones and in the − zones. */
export function coverOf(x, depth) {
  const r = Math.hypot(x, depth), theta = Math.atan2(x, depth), half = Math.atan(PAPIRS.target.width / 2 / r);
  const tall = Math.min(LENS.elevation, 2 * Math.atan(PAPIRS.target.height / 2 / r));
  const sum = zones => { let total = 0; for (const [a, b] of zones) total += Math.max(0, Math.min(theta + half, b) - Math.max(theta - half, a)); return total; };
  return {r, theta, half, tall, plus: sum(LENS.plus) * tall, minus: sum(LENS.minus) * tall};
}

// ---------------------------------------------------------------------------
// The elements: a thermal lag and an electrical leak.
// ---------------------------------------------------------------------------

/** The band-pass's gain at `hz` against an ideal flat response: ωτe/√(1 + ω²τe²) · 1/√(1 + ω²τth²). */
export const bandGain = hz => { const w = 2 * Math.PI * hz; return w * DECLARED.electrical / Math.sqrt(1 + (w * DECLARED.electrical) ** 2) / Math.sqrt(1 + (w * DECLARED.thermal) ** 2); };
/** Volts per watt at `hz`: the sheet's typical 4,000 V/W at 1 Hz, shaped by the band-pass. */
export const responsivityAt = hz => PYRO.responsivity.typical * bandGain(hz) / bandGain(PYRO.responsivity.at);
/** The band-pass's scale, V/W, so that it gives the sheet's responsivity at 1 Hz. */
export const GAIN = PYRO.responsivity.typical / bandGain(PYRO.responsivity.at);
/** The band-pass as two lags of the same power: output = GAIN · τe/(τe − τth) · (thermal lag − electrical lag). */
export const SPLIT = DECLARED.electrical / (DECLARED.electrical - DECLARED.thermal);

/** A first-order lag of time constant `tau` after `dt`, its input moving linearly from `p0` to `p1`. */
export function lagStep(x, p0, p1, dt, tau) {
  const slope = (p1 - p0) / dt, e = Math.exp(-dt / tau);
  return p1 - slope * tau + (x - p0 + slope * tau) * e;
}

const PLUS_A = Float64Array.from(LENS.plus, zone => zone[0]), PLUS_B = Float64Array.from(LENS.plus, zone => zone[1]);
const MINUS_A = Float64Array.from(LENS.minus, zone => zone[0]), MINUS_B = Float64Array.from(LENS.minus, zone => zone[1]);

/** The power, W, on the + element and the − element at a time, and what both share, for a walk and a collecting area, written into `out`. The + and − carry the elements' match; the shared warming is left unmatched. The same sums as coverOf, without allocating. */
function inputsOf(values, area) {
  const {speed, range, contrast, warming} = values, eps = DECLARED.emissivity, m = PYRO.match.typical, zones = DECLARED.facets;
  const room0 = PAPIRS.ambient + KELVIN, background0 = exitanceAbove(room0), start = range * Math.tan(LENS.center) - speed * DECLARED.zoneWatch / 2;
  const body0 = eps * (exitanceAbove(room0 + contrast) - background0), scale = area / Math.PI, depth2 = range * range;
  const halfWidth = PAPIRS.target.width / 2, halfHeight = PAPIRS.target.height / 2;
  const into = (out, t) => {
    let body = body0, common = 0;
    if (warming) {
      const room = room0 + warming * t / 60, background = exitanceAbove(room);
      body = eps * (exitanceAbove(room + contrast) - background);
      common = scale * (background - background0) * LENS.solid;
    }
    const x = start + speed * t, r = Math.sqrt(x * x + depth2), theta = Math.atan2(x, range), half = Math.atan(halfWidth / r), low = theta - half, high = theta + half;
    const tall = Math.min(LENS.elevation, 2 * Math.atan(halfHeight / r));
    let plus = 0, minus = 0;
    for (let k = 0; k < zones; k++) {
      const onPlus = Math.min(high, PLUS_B[k]) - Math.max(low, PLUS_A[k]), onMinus = Math.min(high, MINUS_B[k]) - Math.max(low, MINUS_A[k]);
      if (onPlus > 0) plus += onPlus;
      if (onMinus > 0) minus += onMinus;
    }
    out[0] = (1 + m / 2) * (common + scale * body * plus * tall);
    out[1] = (1 - m / 2) * (common + scale * body * minus * tall);
    out[2] = common;
    return out;
  };
  return {start, into, at: t => into(new Float64Array(3), t)};
}

/** One step of the six lags: each element's power and the shared power, through the thermal lag and the electrical lag. */
function stepLags(state, p, q, dt) {
  for (let i = 0; i < 3; i++) {
    state[2 * i] = lagStep(state[2 * i], p[i], q[i], dt, DECLARED.thermal);
    state[2 * i + 1] = lagStep(state[2 * i + 1], p[i], q[i], dt, DECLARED.electrical);
  }
}
const outputOf = state => GAIN * SPLIT * ((state[0] - state[1]) - (state[2] - state[3]));
const aloneOf = state => GAIN * SPLIT * (state[4] - state[5]);

/**
 * Watches the zones for 12 s: the scene before the watch is taken as it is at
 * its start, so every lag starts settled. Returns the peak output and when, when
 * the output first reached the threshold and which way, each stretch it stayed
 * there, what one element alone would give from the shared warming, and with
 * `samples` the chart with the lags' state at each sample.
 */
function watchZones(values, area, samples = 0) {
  const dt = DECLARED.step, n = Math.round(DECLARED.zoneWatch / dt), every = samples > 1 ? n / (samples - 1) : 0, reach = DECLARED.threshold * (1 - DECLARED.tolerance);
  const inputs = inputsOf(values, area);
  let p = inputs.into(new Float64Array(3), 0), q = new Float64Array(3);
  const state = Float64Array.of(p[0], p[0], p[1], p[1], p[2], p[2]), chart = [], overs = [];
  const record = t => chart.push(Object.freeze({t, x: inputs.start + values.speed * t, plus: p[0], minus: p[1], common: p[2], output: outputOf(state), single: aloneOf(state), state: Object.freeze(Array.from(state))}));
  if (every) record(0);
  let peak = 0, peakAt = 0, alarmAt = null, sign = 0, single = 0, over = false;
  for (let k = 1; k <= n; k++) {
    const t = k * dt;
    inputs.into(q, t);
    stepLags(state, p, q, dt);
    [p, q] = [q, p];
    const v = outputOf(state), size = Math.abs(v);
    if (size > peak) { peak = size; peakAt = t; }
    if (size >= reach) {
      if (alarmAt === null) { alarmAt = t; sign = Math.sign(v); }
      if (!over) overs.push([t, t]);
      overs[overs.length - 1][1] = t;
      over = true;
    } else over = false;
    single = Math.max(single, Math.abs(aloneOf(state)));
    if (every && k % every === 0) record(t);
  }
  return {peak, peakAt, alarmAt, sign, overs: Object.freeze(overs.map(Object.freeze)), single, chart: Object.freeze(chart), inputs};
}

/** The facets' collecting area, m²: the area that brings Panasonic's test target, at 5 m, 4 °C over the background and 1 m/s, just to the threshold. */
export const AREA = DECLARED.threshold / watchZones({speed: PAPIRS.speed, range: PAPIRS.distance, contrast: PAPIRS.contrast, warming: 0}, 1).peak;

const reaches = new Map();

/** The farthest path, m, within the range control's 1 to 10 m, at which a walk trips the detector: searched down the control's 0.5 m steps, then halved 14 times; null if it never does, 10 if it still does there. */
export function farthestOf(speed, contrast, warming) {
  const key = `${speed}:${contrast}:${warming}`;
  if (reaches.has(key)) return reaches.get(key);
  const [lowest, highest, step] = INTRUDER_DOMAINS.range, reach = DECLARED.threshold * (1 - DECLARED.tolerance), trips = range => watchZones({speed, range, contrast, warming}, AREA).peak >= reach;
  let found = null;
  if (speed > 0) for (let i = Math.round((highest - lowest) / step); i >= 0; i--) { const range = lowest + i * step; if (trips(range)) { found = range; break; } }
  if (found !== null && found < highest) {
    let near = found, far = found + step;
    for (let i = 0; i < 14; i++) { const middle = (near + far) / 2; if (trips(middle)) near = middle; else far = middle; }
    found = near;
  }
  if (reaches.size >= 64) reaches.clear();
  reaches.set(key, found);
  return found;
}

// ---------------------------------------------------------------------------
// Plans.
// ---------------------------------------------------------------------------

/** The beam barrier: how many times the threshold its beam arrives at, how long the body covers the line and when, whether and when the alarm sounds, and how fast a walker the setting still catches. */
function beamOf(values) {
  const {speed, span, hold} = values, watch = DECLARED.beamWatch, depth = PAPIRS.target.width;
  const margin = (OPTEX.arrival / span) ** 2, still = speed === 0;
  const blockedFor = still ? null : depth / speed, start = still ? null : watch / 2 - depth / (2 * speed), end = still ? null : watch / 2 + depth / (2 * speed);
  const alarms = still || blockedFor * 1000 >= hold * (1 - DECLARED.tolerance);
  const alarmAt = still ? 0 : alarms ? start + hold / 1000 : null;
  return {
    watch, depth, margin, still, blockedFor, start, end, alarms, alarmAt, alarmEnds: alarmAt === null ? null : alarmAt + OPTEX.alarm,
    pulses: hold * DECLARED.rate / 1000, fastest: depth / (hold / 1000), boost: EMITTER.pulsed.intensity / EMITTER.steady.intensity,
    bareCurrent: RECEIVER.current * (EMITTER.pulsed.intensity / span ** 2) / RECEIVER.irradiance,
  };
}

/** The passive detector's watch, with what the body sends and how its zones fall at the path. */
function zonesOf(values) {
  const {speed, range, contrast, warming} = values, run = watchZones(values, AREA, DECLARED.samples);
  const room = PAPIRS.ambient + KELVIN, body = room + contrast;
  const zoneWidth = range * (Math.tan(LENS.outer) - Math.tan(LENS.inner)), pitchAt = range * (Math.tan(LENS.center + LENS.pitch) - Math.tan(LENS.center));
  const crossing = speed > 0 ? speed / pitchAt : null;
  return {
    ...run, watch: DECLARED.zoneWatch, room, body, still: speed === 0,
    total: DECLARED.emissivity * SIGMA * (body ** 4 - room ** 4), band: DECLARED.emissivity * (exitanceAbove(body) - exitanceAbove(room)), peaks: [peakWavelength(body), peakWavelength(room)],
    zoneWidth, pitchAt, crossing, responsivity: crossing === null ? null : responsivityAt(crossing),
    stillPlus: run.inputs.at(0)[0], stillMinus: run.inputs.at(0)[1],
    farthest: farthestOf(speed, contrast, warming),
  };
}

const plans = new Map();

/** Everything about a watch that does not change as the clock runs. The passive detector is worked out only when it is the method chosen. */
export function intruderPlan(input = {}) {
  const values = validateControls(input, INTRUDER_DEFAULTS, INTRUDER_DOMAINS, 'burglar alarm');
  if (!OPTEX.holds.includes(values.hold)) throw new RangeError('Invalid hold');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const beam = beamOf(values), zones = values.mode === 1 ? zonesOf(values) : null;
  const plan = {values, mode: values.mode, beam, zones, watch: values.mode === 0 ? beam.watch : zones.watch};
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The lags stepped on from the chart sample before `t`, the last part of a step taking its input partway along that step's line. */
function zonesNow(zones, t, speed) {
  const dt = DECLARED.step, stride = DECLARED.zoneWatch / (DECLARED.samples - 1), j = Math.min(zones.chart.length - 1, Math.floor(t / stride + 1e-9));
  const sample = zones.chart[j], state = [...sample.state], from = Math.round(sample.t / dt), whole = Math.floor(t / dt + 1e-9);
  let p = zones.inputs.at(from * dt);
  for (let k = from + 1; k <= whole; k++) { const q = zones.inputs.at(k * dt); stepLags(state, p, q, dt); p = q; }
  const rest = t - whole * dt;
  if (rest > 1e-12) {
    const next = zones.inputs.at((whole + 1) * dt), share = rest / dt, q = p.map((value, i) => value + (next[i] - value) * share);
    stepLags(state, p, q, rest);
    p = q;
  }
  return {x: zones.inputs.start + speed * t, plus: p[0], minus: p[1], common: p[2], output: outputOf(state), single: aloneOf(state)};
}

/** The watch `time` seconds in. */
export function intruderAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.watch), done = time >= plan.watch;
  if (plan.mode === 0) {
    const b = plan.beam, x = b.still ? 0 : plan.values.speed * (t - b.watch / 2), blocked = b.still || Math.abs(x) < b.depth / 2;
    const blockedSoFar = !blocked ? 0 : b.still ? t : t - b.start;
    return {
      time, t, done, x, blocked, level: blocked ? 0 : b.margin, blockedSoFar, missed: blocked ? Math.floor(blockedSoFar * DECLARED.rate + 1e-9) : 0,
      alarm: b.alarmAt !== null && t >= b.alarmAt, sounding: b.alarmAt !== null && t >= b.alarmAt && t < b.alarmEnds,
    };
  }
  const z = plan.zones, now = zonesNow(z, t, plan.values.speed), last = z.overs.filter(([start]) => start <= t).pop();
  return {
    time, t, done, ...now,
    alarm: z.alarmAt !== null && t >= z.alarmAt, sounding: Boolean(last) && t < Math.min(last[1], t) + PAPIRS.hold,
  };
}

export const sampleIntruder = (input = {}, time = 0) => intruderAt(intruderPlan(input), time);

// Checks the burglar alarm model, its beam barrier and its passive infrared
// movement detector, against the sheets typed in again and the physics worked
// out by other routes: Planck's law integrated numerically against the series
// the module sums and against the percentile table, Wien's constant found by
// maximizing the spectrum, the zones traced ray by ray onto the elements, the
// body's cover of them measured by sampling, the band-pass integrated again by
// Runge and Kutta at a quarter of the step, and every post, body, zone, facet,
// bar and curve read back off the drawing at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './intruder-physics.js';
import * as M from './intruder-model.js';
import * as L from './intruder-lessons.js';
import {houseComponents} from './house-components.js';
import {safetyLessons} from './safety-lessons.js';
import {createSafetyModel} from './safety-models.js';
import {previewEntryIds, publishedEntryIds} from './published-catalog.js';
import {neighborhoodCatalog} from './catalog-data.js';

const t = tally();
const counts = {samples: 0, steps: 0, rays: 0, poses: 0, points: 0, numbers: 0};
const deg = radians => radians * 180 / Math.PI;
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
/** A list the way the lessons write one: a, b, c and d. */
const listOf = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0]);

// ---------------------------------------------------------------------------
// 1. The sheets, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  sigma: 5.670374419e-8, wien: 2.897771955e-3, planck: 6.62607015e-34, boltzmann: 1.380649e-23, light: 299792458, zero: 273.15,
  optex: {range: 30, arrival: 265, holds: [50, 100, 250, 500], names: ['Running', 'Jogging', 'Walking', 'Slow movement'], initial: 50, channels: 4, alarm: 2, height: [0.7, 1], trouble: 20, larger: {range: 60, arrival: 530}},
  emitter: {wavelength: 940, halfAngle: 10, steady: {mA: 100, ms: 20, mWsr: 170}, pulsed: {A: 1, us: 100, mWsr: 1450}},
  receiver: {uA: 60, mWcm2: 1, wavelength: 940, halfAngle: 20, darkNa: 0.1, band: [780, 1050]},
  papirs: {distance: 5, contrast: 4, ambient: 25, speed: 1, target: [700, 250], zones: 64, field: [106, 97], lens: 9.5, hold: 2.6, doubled: 8, farther: 1.4, far: 7, analog: [0.5, 1.5]},
  pyro: {element: [2, 1], responsivity: [3300, 4000], at: 1, match: [1, 10], noise: [20, 50], band: [0.3, 10], field: 100},
  murata: {filter: 5, field: 45, electrode: [2, 1]},
  skin: [0.97, 0.999], walking: 1.4,
  // The Planck page's percentiles: the share of the total below each λT, μm·K.
  percentiles: [[1448, 0.01], [2195, 0.1], [2898, 0.25], [4107, 0.5], [9376, 0.9]],
};

t.ok(P.SIGMA === SRC.sigma && P.WIEN === SRC.wien && P.PLANCK === SRC.planck && P.BOLTZMANN === SRC.boltzmann && P.LIGHT === SRC.light && P.KELVIN === SRC.zero, 'σ, Wien’s b and the exact SI values of h, kB and c');
t.near(P.SIGMA, 2 * Math.PI ** 5 * SRC.boltzmann ** 4 / (15 * SRC.light ** 2 * SRC.planck ** 3), relative(P.SIGMA, 1e-9), 'σ = 2π⁵k⁴/(15c²h³)');
t.near(P.C2, SRC.planck * SRC.light / SRC.boltzmann, relative(P.C2, 1e-15), 'the second radiation constant hc/kB');
t.ok(P.OPTEX.range === SRC.optex.range && P.OPTEX.arrival === SRC.optex.arrival && P.OPTEX.initial === SRC.optex.initial && P.OPTEX.channels === SRC.optex.channels && P.OPTEX.alarm === SRC.optex.alarm && P.OPTEX.trouble === SRC.optex.trouble, 'the AX-100TFR: 30 m rated, 265 m of arrival, a first setting of 50 ms, 4 channels, a 2 s alarm and 20 s to a trouble signal');
assert.deepEqual([...P.OPTEX.holds], SRC.optex.holds);
assert.deepEqual([...P.OPTEX.names], SRC.optex.names);
assert.deepEqual([...P.OPTEX.height], SRC.optex.height);
t.ok(P.OPTEX.larger.range === SRC.optex.larger.range && P.OPTEX.larger.arrival === SRC.optex.larger.arrival, 'the AX-200TFR: 60 m rated and 530 m of arrival');
t.near(P.OPTEX.larger.arrival / P.OPTEX.larger.range, P.OPTEX.arrival / P.OPTEX.range, 1e-12, 'both models carry the same spare beam');
t.ok(P.EMITTER.wavelength === SRC.emitter.wavelength && P.EMITTER.halfAngle === SRC.emitter.halfAngle, 'the TSAL6100 at 940 nm, half intensity at 10°');
t.near(P.EMITTER.steady.intensity, SRC.emitter.steady.mWsr / 1000, 1e-15, '170 mW/sr at a steady 100 mA');
t.near(P.EMITTER.pulsed.intensity, SRC.emitter.pulsed.mWsr / 1000, 1e-15, '1,450 mW/sr in flashes of 1 A');
t.ok(P.EMITTER.steady.current === SRC.emitter.steady.mA / 1000 && P.EMITTER.pulsed.current === SRC.emitter.pulsed.A && P.EMITTER.steady.width === SRC.emitter.steady.ms / 1000, 'the currents and the width the steady figure is given at');
t.near(P.EMITTER.pulsed.width, SRC.emitter.pulsed.us * 1e-6, 1e-15, 'and flashes of 100 μs');
t.near(P.RECEIVER.current, SRC.receiver.uA * 1e-6, 1e-18, 'the BPV10NF: 60 μA');
t.near(P.RECEIVER.irradiance, SRC.receiver.mWcm2 * 10, 1e-12, 'at 1 mW/cm², which is 10 W/m²');
t.near(P.RECEIVER.dark, SRC.receiver.darkNa * 1e-9, 1e-21, 'a dark current of 0.1 nA');
t.ok(P.RECEIVER.wavelength === SRC.receiver.wavelength && P.RECEIVER.halfAngle === SRC.receiver.halfAngle, 'peak sensitivity at 940 nm, half at 20°');
assert.deepEqual([...P.RECEIVER.band], SRC.receiver.band);
t.ok(P.PAPIRS.distance === SRC.papirs.distance && P.PAPIRS.contrast === SRC.papirs.contrast && P.PAPIRS.ambient === SRC.papirs.ambient && P.PAPIRS.speed === SRC.papirs.speed && P.PAPIRS.zones === SRC.papirs.zones && P.PAPIRS.lens === SRC.papirs.lens && P.PAPIRS.hold === SRC.papirs.hold, 'PaPIRs: 5 m at 4 °C over 25 °C at 1 m/s, 64 zones behind a 9.5 mm lens, held 2.6 s');
t.ok(P.PAPIRS.target.height === SRC.papirs.target[0] / 1000 && P.PAPIRS.target.width === SRC.papirs.target[1] / 1000, 'a target 700 by 250 mm');
t.ok(P.PAPIRS.doubled === SRC.papirs.doubled && P.PAPIRS.farther === SRC.papirs.farther && P.PAPIRS.far === SRC.papirs.far, 'at 8 °C about 1.4 times as far, which the sheet puts at 7 m');
assert.deepEqual([...P.PAPIRS.field], SRC.papirs.field);
assert.deepEqual([...P.PAPIRS.analog], SRC.papirs.analog);
t.ok(P.PYRO.element.height === SRC.pyro.element[0] && P.PYRO.element.width === SRC.pyro.element[1] && P.MURATA.electrode.height === SRC.murata.electrode[0] && P.MURATA.electrode.width === SRC.murata.electrode[1], 'two elements of 2 by 1 mm on both sheets');
t.ok(P.PYRO.responsivity.min === SRC.pyro.responsivity[0] && P.PYRO.responsivity.typical === SRC.pyro.responsivity[1] && P.PYRO.responsivity.at === SRC.pyro.at && P.PYRO.field === SRC.pyro.field, '3,300 to 4,000 V/W at 1 Hz over a 100° view');
t.near(P.PYRO.match.typical, SRC.pyro.match[0] / 100, 1e-15, 'a match of 1%');
t.near(P.PYRO.match.max, SRC.pyro.match[1] / 100, 1e-15, 'and 10% at worst');
t.near(P.PYRO.noise.typical, SRC.pyro.noise[0] * 1e-6, 1e-18, 'noise of 20 μV peak to peak');
t.near(P.PYRO.noise.max, SRC.pyro.noise[1] * 1e-6, 1e-18, 'and 50 μV at worst');
assert.deepEqual([...P.PYRO.noise.band], SRC.pyro.band);
t.near(P.MURATA.filter, SRC.murata.filter * 1e-6, 1e-18, 'a filter that opens at 5 μm');
t.ok(P.MURATA.field === SRC.murata.field, 'a 45° view either side');
assert.deepEqual([...P.SKIN], SRC.skin);
t.ok(P.WALKING === SRC.walking, 'a typical walk of 1.4 m/s');
t.ok(P.DECLARED.threshold === P.PYRO.noise.max, 'the threshold is the sheet’s largest noise');
t.ok(P.DECLARED.samples === 481 && Math.abs(P.DECLARED.zoneWatch / (P.DECLARED.samples - 1) - 0.025) < 1e-15 && Math.abs(P.DECLARED.zoneWatch / P.DECLARED.step - 12000) < 1e-9, 'the watch is stepped every millisecond and kept every 25 ms');
t.ok(P.DECLARED.emissivity >= P.SKIN[0] && P.DECLARED.emissivity <= P.SKIN[1], 'the emissivity taken for skin is inside the page’s range');
assert.deepEqual(JSON.parse(JSON.stringify(P.INTRUDER_DOMAINS)), {mode: [0, 1, 1], speed: [0, 6, 0.1], span: [5, 30, 1], hold: [50, 500, 50], range: [1, 10, 0.5], contrast: [0, 12, 0.5], warming: [0, 30, 1]});
assert.deepEqual({...P.INTRUDER_DEFAULTS}, {mode: 0, speed: 1, span: 30, hold: 50, range: 5, contrast: 4, warming: 0});
t.ok(P.INTRUDER_DEFAULTS.span === P.OPTEX.range && P.INTRUDER_DEFAULTS.hold === P.OPTEX.initial && P.INTRUDER_DEFAULTS.range === P.PAPIRS.distance && P.INTRUDER_DEFAULTS.contrast === P.PAPIRS.contrast && P.INTRUDER_DEFAULTS.speed === P.PAPIRS.speed, 'every default is a figure from a sheet');
t.ok(P.INTRUDER_DOMAINS.span[1] === P.OPTEX.range && P.INTRUDER_DOMAINS.range[1] === 2 * P.PAPIRS.distance, 'the posts reach the rated range, and the path twice the specified distance');
assert.deepEqual(P.HOLD_OPTIONS.map(option => [option.value, option.label]), SRC.optex.holds.map((ms, i) => [ms, `${SRC.optex.names[i]}, ${ms} ms`]));
assert.deepEqual(P.MODE_OPTIONS.map(option => [option.value, option.label]), [[0, 'Active infrared beam'], [1, 'Passive infrared zones']]);

// Planck's law, integrated numerically against the series the module sums.
const spectral = (lambda, kelvin) => 2 * SRC.planck * SRC.light ** 2 / lambda ** 5 / (Math.exp(SRC.planck * SRC.light / (lambda * SRC.boltzmann * kelvin)) - 1);
function integrate(from, to, kelvin, steps = 6000) {
  const a = Math.log(from), b = Math.log(to), h = (b - a) / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const weight = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2, lambda = Math.exp(a + i * h);
    sum += weight * spectral(lambda, kelvin) * lambda;
    counts.steps++;
  }
  return sum * h / 3 * Math.PI;
}
for (const kelvin of [293.15, 298.15, 302.15, 306.15, 500]) {
  // Far enough either way that what is left outside is beneath the tolerance.
  const below = integrate(1e-7, P.MURATA.filter, kelvin, 12000), above = integrate(P.MURATA.filter, 0.05, kelvin, 24000);
  t.near(below / (below + above), P.shareBelow(P.MURATA.filter * kelvin), 2e-8, `${kelvin} K: the share below 5 μm, integrated and summed`);
  t.near(P.exitanceAbove(kelvin), above, relative(above, 1e-7), `${kelvin} K: the exitance past the filter`);
  t.near(below + above, SRC.sigma * kelvin ** 4, relative(SRC.sigma * kelvin ** 4, 1e-7), `${kelvin} K: both halves make σT⁴`);
}
for (const [lambdaT, share] of SRC.percentiles) t.near(P.shareBelow(lambdaT * 1e-6), share, 2e-4, `the page’s percentile at ${lambdaT} μm·K`);
{
  // Out at 10,000 μm·K the series needs far more terms than it does at the filter, so a sum cut short shows here.
  const kelvin = 500, cut = 20e-6;
  const below = integrate(1e-7, cut, kelvin, 12000), above = integrate(cut, 0.05, kelvin, 24000);
  t.near(P.shareBelow(cut * kelvin), below / (below + above), 1e-9, 'the series is summed far enough to hold at long wavelengths too');
}
{
  // Wien's constant, found by maximizing the spectrum at a temperature.
  const kelvin = 302.15;
  let low = 1e-6, high = 40e-6;
  for (let i = 0; i < 200; i++) {
    const third = (high - low) / 3, a = low + third, b = high - third;
    if (spectral(a, kelvin) < spectral(b, kelvin)) low = a; else high = b;
  }
  t.near((low + high) / 2 * kelvin, SRC.wien, 1e-9, 'Wien’s b, from where the spectrum peaks');
  t.near(P.peakWavelength(kelvin), SRC.wien / kelvin, 1e-15, 'and the peak the module gives');
}

// The beam: the spare power by irradiance, and the interruption by walking it out.
for (const span of [5, 10, 17, 30]) {
  for (const speed of [0, 0.4, 1, 1.4, 3, 5, 6]) {
    for (const hold of P.OPTEX.holds) {
      const plan = P.intruderPlan({mode: 0, span, speed, hold}), b = plan.beam;
      const near = P.EMITTER.pulsed.intensity / span ** 2, far = P.EMITTER.pulsed.intensity / P.OPTEX.arrival ** 2;
      t.near(b.margin, near / far, relative(b.margin, 1e-12), `${span} m: the beam arrives as many times over as the irradiances compare`);
      t.near(b.bareCurrent, P.RECEIVER.current * near / P.RECEIVER.irradiance, relative(b.bareCurrent, 1e-12), 'the bare photodiode’s current from its own sheet');
      // Walk the body past the line in 20 μs steps and time the interruption.
      const step = 2e-5;
      let covered = 0, first = null, last = null;
      for (let k = 0; k <= Math.round(P.DECLARED.beamWatch / step); k++) {
        const time = k * step, x = speed === 0 ? 0 : speed * (time - P.DECLARED.beamWatch / 2);
        if (Math.abs(x) < P.PAPIRS.target.width / 2) { covered += step; if (first === null) first = time; last = time; }
        counts.steps++;
      }
      if (speed === 0) t.ok(b.blockedFor === null && b.start === null && b.alarmAt === 0 && covered > P.DECLARED.beamWatch - step, 'standing on the line covers it for the whole watch, and the alarm is already sounding');
      else {
        t.near(b.blockedFor, covered, 2 * step, `${speed} m/s: the body covers the line as long as walking it out says`);
        t.near(b.start, first, 2 * step, 'and from when');
        t.near(b.end, last, 2 * step, 'until when');
        if (Math.abs(covered * 1000 - hold) > 0.1) t.ok(b.alarms === (covered * 1000 > hold), `${speed} m/s at ${hold} ms: it sounds only if the cover outlasts the setting`);
        t.ok(b.alarms ? Math.abs(b.alarmAt - (b.start + hold / 1000)) < 1e-12 : b.alarmAt === null, 'and then the setting after the beam went dark');
      }
      t.near(b.fastest, P.PAPIRS.target.width / (hold / 1000), relative(b.fastest, 1e-12), 'the fastest walker a setting still catches');
      t.ok(b.pulses === hold, `${hold} ms of flashes at 1,000 a second is ${hold} flashes`);
      counts.samples++;
    }
  }
}
t.ok([5, 2.5, 1, 0.5].every((speed, i) => Math.abs(P.intruderPlan({mode: 0, hold: P.OPTEX.holds[i]}).beam.fastest - speed) < 1e-12), 'the four settings catch 5, 2.5, 1 and 0.5 m/s and slower');

// The lens: every zone traced ray by ray onto the elements it belongs to.
{
  const f = P.DECLARED.focal, inner = P.DECLARED.gap / 2, outer = P.DECLARED.gap / 2 + P.PYRO.element.width;
  for (const [k, axis] of P.LENS.axes.entries()) {
    for (let i = 0; i <= 400; i++) {
      const angle = axis - 0.35 + 0.7 * i / 400, lands = -f * Math.tan(angle - axis);
      const onPlus = lands <= -inner + 1e-12 && lands >= -outer - 1e-12, onMinus = lands >= inner - 1e-12 && lands <= outer + 1e-12;
      const inPlus = angle >= P.LENS.plus[k][0] - 1e-12 && angle <= P.LENS.plus[k][1] + 1e-12;
      const inMinus = angle >= P.LENS.minus[k][0] - 1e-12 && angle <= P.LENS.minus[k][1] + 1e-12;
      t.ok(onPlus === inPlus && onMinus === inMinus, `facet ${k}: a ray at ${deg(angle).toFixed(2)}° lands on the element its zone says`);
      counts.rays++;
    }
  }
  const edges = [...P.LENS.plus, ...P.LENS.minus].flat().sort((a, b) => a - b);
  for (let i = 1; i < edges.length; i++) t.ok(edges[i] - edges[i - 1] > 1e-9, 'no two zones touch or overlap');
  t.near(P.LENS.pitch, 2 * (Math.atan(inner / f) + Math.atan(outer / f)), 1e-15, 'the step from one facet to the next leaves gaps as wide as the zones');
  t.near(P.LENS.across, P.LENS.plus[0][1] - P.LENS.plus[0][0], 1e-15, 'a zone is as wide as the element behind it');
  t.ok(deg(P.LENS.edge) < P.MURATA.field, 'every zone is inside the sheet’s 45°');
  t.ok(deg(2 * P.LENS.edge) < P.PYRO.field, 'and inside the detector’s 100° view');
  t.near(P.LENS.solid, P.DECLARED.facets * P.LENS.across * P.LENS.elevation, 1e-18, 'an element sees one zone through each facet');
}

// What a body covers of the zones, measured by sampling its angular extent.
for (const depth of [1, 2.5, 5, 7.5, 10]) {
  for (const x of [-9, -4.3, -1.2, 0, 0.42, 1.7, 3.3, 8]) {
    const cover = P.coverOf(x, depth), samples = 20000, low = cover.theta - cover.half, high = cover.theta + cover.half;
    const inside = zones => { let hits = 0; for (let i = 0; i < samples; i++) { const angle = low + (high - low) * (i + 0.5) / samples; if (zones.some(([a, b]) => angle >= a && angle <= b)) hits++; } return (high - low) * hits / samples; };
    t.near(cover.plus, inside(P.LENS.plus) * cover.tall, 3e-4 * Math.max(cover.plus, 1e-4) + 1e-6, `${x} m at ${depth} m: what the + zones catch of the body`);
    t.near(cover.minus, inside(P.LENS.minus) * cover.tall, 3e-4 * Math.max(cover.minus, 1e-4) + 1e-6, 'and what the − zones catch');
    t.near(cover.half, Math.atan(P.PAPIRS.target.width / 2 / Math.hypot(x, depth)), 1e-15, 'the body’s half width from where it stands');
    t.ok(cover.tall <= P.LENS.elevation + 1e-15 && cover.tall > 0, 'never taller than the zone itself');
    counts.samples++;
  }
}

// The band-pass: its gain against an independent integration of the two lags.
for (const hz of [0.2, 0.5, 1, 2, 3.52]) {
  const cycles = 24, step = 1 / hz / 4000;
  // One sweep of the whole run, keeping the largest swing after it has settled.
  let warm = 0, leak = 0, largest = 0;
  const steps = Math.round(cycles / hz / step);
  for (let k = 0; k < steps; k++) {
    const time = k * step, p0 = Math.sin(2 * Math.PI * hz * time), pm = Math.sin(2 * Math.PI * hz * (time + step / 2)), p1 = Math.sin(2 * Math.PI * hz * (time + step));
    const advance = (state, tau) => { const k1 = (p0 - state) / tau, k2 = (pm - (state + step / 2 * k1)) / tau, k3 = (pm - (state + step / 2 * k2)) / tau, k4 = (p1 - (state + step * k3)) / tau; return state + step / 6 * (k1 + 2 * k2 + 2 * k3 + k4); };
    warm = advance(warm, P.DECLARED.thermal);
    leak = advance(leak, P.DECLARED.electrical);
    if (k > steps * 0.6) largest = Math.max(largest, Math.abs(P.GAIN * P.SPLIT * (warm - leak)));
    counts.steps++;
  }
  t.near(largest, P.responsivityAt(hz), relative(P.responsivityAt(hz), 2e-3), `${hz} Hz: the volts a watt of swing gives, integrated again`);
}
t.near(P.responsivityAt(P.PYRO.responsivity.at), P.PYRO.responsivity.typical, relative(P.PYRO.responsivity.typical, 1e-12), 'the sheet’s 4,000 V/W at 1 Hz');
t.ok(P.responsivityAt(0.05) < P.PYRO.responsivity.typical && P.responsivityAt(20) < P.PYRO.responsivity.typical, 'and less both slower and faster');

// A whole watch integrated again, with the powers worked out from the geometry.
function ownWatch(values, step = 2.5e-4, until = P.DECLARED.zoneWatch) {
  const {speed, range, contrast, warming} = values, room0 = P.PAPIRS.ambient + P.KELVIN, background0 = P.exitanceAbove(room0);
  const start = range * Math.tan(P.LENS.center) - speed * P.DECLARED.zoneWatch / 2, match = P.PYRO.match.typical;
  const powers = time => {
    const room = room0 + warming * time / 60, background = P.exitanceAbove(room), body = P.DECLARED.emissivity * (P.exitanceAbove(room + contrast) - background);
    const cover = P.coverOf(start + speed * time, range), common = P.AREA * (background - background0) / Math.PI * P.LENS.solid;
    return [(1 + match / 2) * (common + P.AREA * body / Math.PI * cover.plus), (1 - match / 2) * (common + P.AREA * body / Math.PI * cover.minus), common];
  };
  const state = [powers(0)[0], powers(0)[0], powers(0)[1], powers(0)[1], powers(0)[2], powers(0)[2]];
  let peak = 0, peakAt = 0, alarmAt = null, single = 0, output = 0;
  for (let k = 0; k < Math.round(until / step); k++) {
    const time = k * step, p0 = powers(time), pm = powers(time + step / 2), p1 = powers(time + step);
    for (let i = 0; i < 3; i++) {
      for (const [slot, tau] of [[2 * i, P.DECLARED.thermal], [2 * i + 1, P.DECLARED.electrical]]) {
        const value = state[slot];
        const k1 = (p0[i] - value) / tau, k2 = (pm[i] - (value + step / 2 * k1)) / tau, k3 = (pm[i] - (value + step / 2 * k2)) / tau, k4 = (p1[i] - (value + step * k3)) / tau;
        state[slot] = value + step / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
      }
    }
    output = P.GAIN * P.SPLIT * ((state[0] - state[1]) - (state[2] - state[3]));
    const size = Math.abs(output);
    if (size > peak) { peak = size; peakAt = time + step; }
    if (alarmAt === null && size >= P.DECLARED.threshold * (1 - P.DECLARED.tolerance)) alarmAt = time + step;
    single = Math.max(single, Math.abs(P.GAIN * P.SPLIT * (state[4] - state[5])));
    counts.steps++;
  }
  return {peak, peakAt, alarmAt, single, output};
}
{
  // Between the moments it keeps, the pair is stepped on from the last of them.
  const plan = P.intruderPlan({mode: 1});
  for (const time of [0.0125, 3.3333, 6.0125, 9.7771]) {
    const own = ownWatch(plan.values, 2.5e-4, time).output, mine = P.intruderAt(plan, time).output;
    t.near(mine, own, relative(Math.max(Math.abs(own), 2e-6), 8e-3), `${time} s: the output between kept moments, integrated again`);
    counts.poses++;
  }
  // Part way through a step the output lies between the grid moments either side, in proportion to how far it has come.
  for (const time of [3.3335, 6.0135, 9.7775]) {
    const step = P.DECLARED.step, before = Math.floor(time / step + 1e-9) * step, share = (time - before) / step;
    const from = P.intruderAt(plan, before).output, to = P.intruderAt(plan, before + step).output, mine = P.intruderAt(plan, time).output;
    const reached = (mine - from) / (to - from);
    t.ok(Math.abs(reached - share) < 0.02, `${time} s: the part of a step taken carries the output ${f2(100 * share)}% of the way to the next moment, not ${f2(100 * reached)}%`);
    counts.poses++;
  }
}
const walks = [{}, {range: 3}, {contrast: 8, range: 7}, {speed: 0.1}, {speed: 6}, {speed: 0}, {speed: 0, warming: 30}, {range: 10, contrast: 12}, {speed: 1.4, range: 2}];
for (const values of walks) {
  const plan = P.intruderPlan({mode: 1, ...values}), z = plan.zones, own = ownWatch(plan.values);
  t.near(z.peak, own.peak, relative(Math.max(own.peak, 1e-7), 5e-3), `${JSON.stringify(values)}: the largest swing, integrated again by Runge and Kutta`);
  if (own.peak > 2e-6) t.near(z.peakAt, own.peakAt, 0.02, 'and when it came');
  t.near(z.single, own.single, relative(Math.max(own.single, 1e-7), 5e-3), 'what one element alone would give');
  t.ok((z.alarmAt === null) === (own.alarmAt === null), 'both routes agree whether it sounded');
  if (z.alarmAt !== null) t.near(z.alarmAt, own.alarmAt, 0.03, 'and when');
  counts.poses++;
}

// The calibration, the inverse square and what the pair rejects.
{
  const standard = P.intruderPlan({mode: 1}).zones;
  t.near(standard.peak, P.DECLARED.threshold, relative(P.DECLARED.threshold, 1e-9), 'the fitted area brings Panasonic’s target to the threshold at 5 m');
  t.ok(P.AREA > 0 && P.AREA < 1e-6, 'and that area is under a square millimeter');
  const far = P.farthestOf(P.PAPIRS.speed, P.PAPIRS.doubled, 0), near = P.farthestOf(P.PAPIRS.speed, P.PAPIRS.contrast, 0);
  t.near(near, P.PAPIRS.distance, 5e-3, 'so its reach at 4 °C is the sheet’s 5 m');
  t.ok(Math.abs(far / near - Math.SQRT2) < 0.05, 'and at twice the difference it reaches about √2 times as far');
  t.ok(Math.abs(far / near - P.PAPIRS.farther) < 0.06 && Math.abs(far - P.PAPIRS.far) < 0.35, 'close to the sheet’s about 1.4 times and 7 m');
  // Far out, where the body is smaller than a zone, the swing falls as the square of the distance.
  const ratio = range => P.intruderPlan({mode: 1, range}).zones.peak * range ** 2;
  t.ok(Math.abs(ratio(8) / ratio(10) - 1) < 0.06, 'at 8 and 10 m the swing times the distance squared hardly moves');
  // With nothing but warming, the pair gives the match times what one element gives.
  for (const warming of [4, 12, 30]) {
    const only = P.intruderPlan({mode: 1, contrast: 0, speed: 0, warming}).zones;
    t.near(only.peak, only.single * P.PYRO.match.typical, relative(only.single * P.PYRO.match.typical, 1e-9), `${warming} °C a minute: the pair keeps only the 1% the elements differ by`);
    t.ok(only.alarmAt === null, 'and never sounds on it');
  }
  const still = P.intruderPlan({mode: 1, speed: 0}).zones;
  t.ok(still.peak === 0 && still.alarmAt === null && still.farthest === null && still.crossing === null && still.stillPlus > 0, 'a body standing in a + zone gives a steady power and no output at all');
  t.ok(P.intruderPlan({mode: 1, contrast: 0}).zones.peak === 0, 'a body at the room’s own temperature gives nothing either');
}

// Nothing in any state is infinite, and "never" is null.
for (const values of [{mode: 0, speed: 0}, {mode: 0, speed: 6, hold: 500}, {mode: 1, speed: 0}, {mode: 1, contrast: 0}, {mode: 1, speed: 6}, {mode: 1, range: 10, warming: 30}]) {
  const plan = P.intruderPlan(values);
  const walk = (value, path = 'state') => {
    if (typeof value === 'number') t.ok(Number.isFinite(value), `${path} is finite`);
    else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (value && typeof value === 'object' && !(value instanceof Float64Array)) for (const [key, item] of Object.entries(value)) if (typeof item !== 'function') walk(item, `${path}.${key}`);
  };
  walk({...plan, zones: plan.zones ? {...plan.zones, chart: plan.zones.chart.slice(0, 4), inputs: undefined} : null});
  for (const time of [0, 0.5, plan.watch / 2, plan.watch, plan.watch + 5]) walk(P.intruderAt(plan, time), `at ${time}`);
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createIntruderModel(), T = model.topology;
// Line geometry is kept as 32 bit floats, so points read back carry that much rounding.
const drawnTol = 1e-5;
const pointsOf = line => { const array = line.geometry.attributes.position.array, drawn = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(drawn) ? Math.min(drawn, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const at = (values, time) => { model.reset(); model.update(values); model.advance(time); model.root.updateMatrixWorld(true); return model.getState(); };
t.ok(M.timesSmaller(M.BEAM_M) === 100 && M.timesSmaller(M.CROSS_M) === 20 && M.timesSmaller(M.ZONE_M) === 50 && M.timesLarger(M.LENS_MM) === 8, 'the scales the text states: 100, 20 and 50 times smaller, and 8 times larger');
t.ok(M.niceTop(0.9e-9) === 1e-9 && M.niceTop(1.1e-9) === 2e-9 && M.niceTop(2.1e-9) === 5e-9 && M.niceTop(5.1e-9) === 1e-8, 'a panel’s top rounds up through 1, 2 and 5');
t.near(M.outputY(0, 1e-6), M.OUTPUT.y + M.OUTPUT.h / 2, 1e-12, 'nothing from the pair sits in the middle of its panel');
t.near(M.outputY(1e-6, 1e-6), M.OUTPUT.y + M.OUTPUT.h, 1e-12, 'its top at the frame’s top and');
t.near(M.outputY(-1e-6, 1e-6), M.OUTPUT.y, 1e-12, 'as far below the middle as above it');
t.near(M.powerY(2e-9, 2e-9), M.POWER.y + M.POWER.h, 1e-12, 'the power panel filled to its own top');

const beamPoses = [];
for (const span of [10, 20, 30]) for (const speed of [0, 1, 3, 6]) for (const hold of [50, 250, 500]) beamPoses.push({mode: 0, span, speed, hold});
for (const pose of beamPoses) {
  // Every setting read back from the plan, so a pose that leaves one out still names it.
  const plan = P.intruderPlan(pose), values = plan.values, b = plan.beam;
  for (const time of [0, 1.7, 2, 2.4, P.DECLARED.beamWatch]) {
    const state = at(values, time), now = state.now;
    counts.poses++;
    // The posts and the beam between them.
    const half = values.span / 2 * M.BEAM_M;
    t.near(T.transmitter.position.x + T.transmitter.scale.x / 2, -half, 1e-12, `${values.span} m: the transmitter at its end of the span`);
    t.near(T.receiver.position.x - T.receiver.scale.x / 2, half, 1e-12, 'and the receiver at the other');
    const near = pointsOf(T.beamNear), far = pointsOf(T.beamFar);
    t.ok(Math.abs(near[0][0] + half) < drawnTol && Math.abs(near[1][0]) < drawnTol && Math.abs(far[0][0]) < drawnTol && Math.abs(far[1][0] - half) < drawnTol, 'the beam drawn from post to post through the crossing');
    t.ok((T.beamFar.material.color.getHex() === M.COLORS.dim) === now.blocked, now.blocked ? 'the far half goes gray while the body covers the line' : 'and is lit while it does not');
    t.ok((T.beamLamp.material.color.getHex() === M.COLORS.alarm) === now.sounding, 'the lamp lights while the receiver sounds');
    t.near(T.beamWalker.position.y, Math.max(-M.BEAM.reach, Math.min(M.BEAM.reach, now.x)) * M.BEAM_M, 1e-12, 'the walker where the clock has carried it');
    // The crossing, close up, with the body at its true depth.
    t.near(T.crossBody.scale.y, M.CROSS.body[1] * M.CROSS_M, 1e-12, 'the body 250 mm deep along its path');
    t.near(T.crossBody.scale.x, M.CROSS.body[0] * M.CROSS_M, 1e-12, 'and 450 mm across it');
    t.near(T.crossBody.position.y, now.x * M.CROSS_M, 1e-12, 'drawn where the walker is');
    const depth = pointsOf(T.crossDepth);
    if (T.crossDepth.visible) t.near(Math.abs(depth[5][1] - depth[4][1]), M.CROSS.body[1] * M.CROSS_M, drawnTol, 'the bracket measures the same depth');
    t.ok((T.crossFar.material.color.getHex() === M.COLORS.dim) === now.blocked, 'the beam past the body dims with it');
    // The chart: the level, the setting waited out, the alarm and the flashes.
    const curve = pointsOf(T.beamCurve), floor = M.beamY(0), top = M.beamY(b.margin);
    if (b.still) t.ok(curve.length === 2 && curve.every(([, y]) => Math.abs(y - floor) < drawnTol), 'nothing arrives for the whole watch while the body stands on the line');
    else {
      t.ok(curve.length === 6 && Math.abs(curve[0][1] - top) < drawnTol && Math.abs(curve[2][1] - floor) < drawnTol && Math.abs(curve[5][1] - top) < drawnTol, 'the level drops to the floor and comes back');
      t.near(curve[1][0], M.beamX(b.start), drawnTol, 'dropping when the body reaches the line');
      t.near(curve[3][0], M.beamX(b.end), drawnTol, 'and coming back when it leaves');
      t.near((curve[3][0] - curve[2][0]) / M.BEAMCHART.w * P.DECLARED.beamWatch, b.blockedFor, 2e-5, 'the dark stretch as long as the interruption');
    }
    t.near(M.beamY(b.margin) - M.beamY(b.margin / 10), M.BEAMCHART.h / (M.BEAMCHART.high - M.BEAMCHART.low), 1e-12, 'each step of the scale ten times the one below');
    const bracket = pointsOf(T.beamHold);
    t.near((bracket[1][0] - bracket[0][0]) / M.BEAMCHART.w * P.DECLARED.beamWatch * 1000, values.hold, 0.05, 'the bracket as long as the setting');
    t.ok(T.beamOutput.visible === (b.alarmAt !== null && now.t >= b.alarmAt), 'an alarm bar only once the clock has reached the alarm');
    if (T.beamOutput.visible) t.near(T.beamOutput.scale.x, M.beamX(Math.min(b.alarmEnds, now.t)) - M.beamX(b.alarmAt), drawnTol, 'as long as it has been sounding');
    t.ok(T.crossAhead.visible === (Math.abs(now.x) > M.CROSS.half), 'a triangle on the path only while the walker is outside the close up');
    if (T.crossAhead.visible) t.near(T.crossAhead.position.y, Math.sign(now.x) * M.CROSS.half * M.CROSS_M, 1e-12, 'at the edge it is coming from');
    // What the receiver has now, against the interruption walked out above rather than against itself.
    const inside = b.still || (now.t > b.start && now.t < b.end);
    t.ok(now.blocked === inside, 'the beam is blocked exactly while the body covers the line');
    t.near(now.level, inside ? 0 : b.margin, 1e-12, 'and nothing arrives while it is');
    if (now.blocked) t.near(now.missed, Math.floor((now.t - (b.still ? 0 : b.start)) * P.DECLARED.rate + 1e-9), 1, 'the flashes missed counted from when the body reached the line');
    t.ok(now.alarm === (b.alarms && now.t >= (b.still ? 0 : b.start + values.hold / 1000)), 'the alarm on once the beam has stayed dark for the setting, and latched after');
    const cursor = pointsOf(T.beamCursor);
    t.near((cursor[0][0] + cursor[1][0]) / 2, M.beamX(now.t), drawnTol, 'the cursor at the clock');
    t.near(cursor[0][1], M.beamY(now.level), drawnTol, 'and at what arrives now');
    const strip = pointsOf(T.flashes);
    t.ok(strip.length === 2 * (Math.round(M.BEAMCHART.strip.window * P.DECLARED.rate) + 1), '41 flashes drawn around the clock');
    let lit = 0, dark = 0;
    for (let i = 0; i < strip.length; i += 2) {
      const tall = strip[i + 1][1] - strip[i][1] > M.BEAMCHART.strip.h * 0.5;
      if (tall) lit++; else dark++;
      counts.points++;
    }
    t.ok(now.blocked ? dark > 0 : lit > 0, 'flashes stop arriving while the body covers the line');
    if (b.still) t.ok(lit === 0, 'and never arrive while it stands there');
  }
}

{
  // Just either side of the interruption the line is clear, which a body taken as twice its depth would not leave it.
  for (const speed of [1, 3, 6]) {
    const plan = P.intruderPlan({mode: 0, speed}), b = plan.beam, quarter = P.PAPIRS.target.width / (4 * speed);
    t.ok(!P.intruderAt(plan, b.start - quarter).blocked, `${speed} m/s: the beam still arrives a quarter of the crossing before the body reaches the line`);
    t.ok(!P.intruderAt(plan, b.end + quarter).blocked, 'and again once it is past');
    t.ok(P.intruderAt(plan, b.start + quarter).blocked && P.intruderAt(plan, b.end - quarter).blocked, 'and nothing arrives in between');
    counts.samples += 4;
  }
}

const zonePoses = [];
for (const range of [1.5, 3, 5, 8, 10]) for (const speed of [0, 0.5, 1, 6]) for (const contrast of [0, 4, 8]) zonePoses.push({mode: 1, range, speed, contrast});
zonePoses.push({mode: 1, speed: 0, warming: 30}, {mode: 1, speed: 1.4, warming: 12, contrast: 12});
for (const pose of zonePoses) {
  const plan = P.intruderPlan(pose), values = plan.values, z = plan.zones;
  for (const time of [0, 3, 6.5, P.DECLARED.zoneWatch]) {
    const state = at(values, time), now = state.now;
    counts.poses++;
    // The zones: a wedge for each, at the angles the lens gives, facing the viewer.
    const positions = T.wedges.geometry.attributes.position.array, colors = T.wedges.geometry.attributes.color.array;
    t.ok(positions.length === 2 * P.DECLARED.facets * 9, 'ten wedges drawn');
    t.ok(T.wedges.material.color.getHex() === 0xffffff && T.wedges.material.vertexColors, 'their material white, so each wedge shows its own color and not that color times another');
    [...P.LENS.plus, ...P.LENS.minus].forEach(([from, to], k) => {
      const base = k * 9, reach = M.ZONEVIEW.reach * M.ZONE_M;
      t.ok(Math.abs(positions[base]) < 1e-12 && Math.abs(positions[base + 1]) < 1e-12, 'each wedge starts at the lens');
      t.near(Math.atan2(positions[base + 3], positions[base + 4]), to, 1e-6, 'its far edge at the zone’s edge');
      t.near(Math.atan2(positions[base + 6], positions[base + 7]), from, 1e-6, 'and its near edge at the other');
      t.near(Math.hypot(positions[base + 3], positions[base + 4]), reach, drawnTol, 'drawn out to the same reach');
      const cross = (positions[base + 3] - positions[base]) * (positions[base + 7] - positions[base + 1]) - (positions[base + 4] - positions[base + 1]) * (positions[base + 6] - positions[base]);
      t.ok(cross > 0, 'and wound to face the viewer');
      const warm = colors[k * 9] > colors[k * 9 + 2];
      t.ok(warm === (k < P.DECLARED.facets), k < P.DECLARED.facets ? 'gold for a + zone' : 'blue for a − zone');
      counts.points++;
    });
    // The walker on its path.
    t.near(T.zoneWalker.position.y, values.range * M.ZONE_M, 1e-12, 'the path at the distance set');
    t.near(T.zoneWalker.position.x, now.x * M.ZONE_M, 1e-12, 'the walker where the clock has carried it');
    t.near(T.zoneWalker.scale.x, M.ZONEVIEW.body[0] * M.ZONE_M, 1e-9, 'drawn 450 mm across, the disk of radius one half scaled to its width');
    t.ok(pointsOf(T.zonePath).every(([, y]) => Math.abs(y - values.range * M.ZONE_M) < drawnTol), 'and the path drawn straight across at that distance');
    t.ok((T.zoneLamp.material.color.getHex() === M.COLORS.alarm) === now.sounding, 'the lamp lights while the detector sounds');
    // The lens: the elements, the facets and where the body lands.
    t.near(T.elementPlus.position.x + T.elementPlus.scale.x / 2, -P.DECLARED.gap / 2 * M.LENS_MM, 1e-12, 'the + element beside the gap');
    t.near(T.elementMinus.position.x - T.elementMinus.scale.x / 2, P.DECLARED.gap / 2 * M.LENS_MM, 1e-12, 'and the − element the other side');
    t.near(T.elementPlus.scale.x, P.PYRO.element.width * M.LENS_MM, 1e-12, 'each 1 mm wide');
    const facets = pointsOf(T.facetLines);
    P.LENS.axes.forEach((axis, k) => {
      const base = k * (1 + M.LENSVIEW.grooves) * 2, middle = [(facets[base][0] + facets[base + 1][0]) / 2, (facets[base][1] + facets[base + 1][1]) / 2];
      t.near(Math.hypot(middle[0], middle[1]), P.DECLARED.focal * M.LENS_MM, drawnTol, `facet ${k} at the focal length from the elements`);
      t.near(Math.atan2(middle[0], middle[1]), axis, drawnTol, 'on its own axis');
      counts.points++;
    });
    const cover = P.coverOf(now.x, values.range), bars = pointsOf(T.images), half = M.LENSVIEW.plane / 2 * M.LENS_MM;
    let expected = 0;
    P.LENS.axes.forEach(axis => {
      const lands = angle => -P.DECLARED.focal * Math.tan(angle - axis) * M.LENS_MM;
      const low = lands(cover.theta + cover.half), high = lands(cover.theta - cover.half);
      if (Math.min(high, half) - Math.max(low, -half) > 0) {
        const bar = bars[2 * expected];
        t.near(bar[0], Math.max(low, -half), drawnTol, 'the body’s image where the facet puts it');
        t.near(bars[2 * expected + 1][0], Math.min(high, half), drawnTol, 'and as wide as the body looks through it');
        expected++;
      }
      counts.rays++;
    });
    t.ok(bars.length === 2 * expected, 'a bar under every facet that can see the body, and no others');
    // What the pair reads now, against the moment the chart kept and the walk's own arithmetic.
    const stride = P.DECLARED.zoneWatch / (P.DECLARED.samples - 1), index = Math.round(time / stride);
    if (Math.abs(index * stride - time) < 1e-12) {
      t.near(now.output, z.chart[index].output, 1e-15, 'at a moment it keeps, the pair reads exactly what the chart holds');
      t.near(now.plus, z.chart[index].plus, 1e-15, 'and so does each element');
    }
    t.near(now.x, values.range * Math.tan(P.LENS.center) - values.speed * P.DECLARED.zoneWatch / 2 + values.speed * time, 1e-12, 'the walker where its own speed has carried it');
    // The two panels.
    const tops = state.tops;
    const largestPower = Math.max(...z.chart.map(sample => Math.max(sample.plus, sample.minus))), largestOutput = Math.max(z.peak, z.single, P.DECLARED.threshold * 1.2);
    t.ok(tops.power >= largestPower && tops.output >= largestOutput, 'each panel reaches past the largest it has to show');
    t.ok(tops.power <= Math.max(5 * largestPower, 1.0000001e-9) && tops.output <= Math.max(5 * largestOutput, 1.0000001e-6), 'and no further than the next round number above it');
    const shadeOf = (color, share) => new THREE.Color(M.COLORS.ground).lerp(new THREE.Color(color), Math.max(0, Math.min(1, share)));
    const sameColor = (a, b) => Math.abs(a.r - b.r) < 1e-6 && Math.abs(a.g - b.g) < 1e-6 && Math.abs(a.b - b.b) < 1e-6;
    t.ok(sameColor(T.elementPlus.material.color, shadeOf(M.COLORS.plus, now.plus / tops.strongest)), 'the + element shaded by the power reaching it');
    t.ok(sameColor(T.elementMinus.material.color, shadeOf(M.COLORS.minus, now.minus / tops.strongest)), 'and the − element by its own');
    const plusPoints = pointsOf(T.plusCurve), outputPoints = pointsOf(T.outputCurve), guide = pointsOf(T.outputGuide);
    t.ok(plusPoints.length === P.DECLARED.samples && guide.length === P.DECLARED.samples, 'every sample of the watch drawn');
    for (let i = 0; i < P.DECLARED.samples; i += 37) t.near(z.chart[i].t, i * P.DECLARED.zoneWatch / (P.DECLARED.samples - 1), 1e-12, 'each sample kept at its own moment of the watch');
    for (let i = 0; i < P.DECLARED.samples; i += 40) {
      const sample = z.chart[i];
      t.near(plusPoints[i][0], M.zoneX(M.POWER, sample.t), drawnTol, 'across in time');
      t.near(plusPoints[i][1], M.powerY(sample.plus, tops.power), drawnTol, 'up in power');
      t.near(guide[i][1], M.outputY(sample.output, tops.output), drawnTol, 'and the faint line at what the pair gives');
      counts.points++;
    }
    if (time > 0) {
      t.ok(outputPoints.length === z.chart.filter(sample => sample.t < now.t).length + 1, 'the dark curve as far as the clock');
      t.near(outputPoints.at(-1)[1], M.outputY(now.output, tops.output), drawnTol, 'ending at the output now');
    } else t.ok(!T.outputCurve.visible, 'nothing drawn dark before Play');
    t.ok(T.singleCurve.visible === (values.warming > 0), 'what one element alone would give, only when something is warming');
    const lines = pointsOf(T.thresholdLines);
    t.near(lines[0][1], M.outputY(P.DECLARED.threshold, tops.output), drawnTol, 'the threshold drawn either way');
    t.near(lines[2][1], M.outputY(-P.DECLARED.threshold, tops.output), drawnTol, 'above and below the middle');
  }
}

// Only the method chosen is drawn, and the parts keep clear of one another.
{
  const boxOf = object => {
    const box = new THREE.Box3(), local = new THREE.Box3();
    object.traverse(child => {
      for (let node = child; node; node = node.parent) if (!node.visible) return;
      if (!child.geometry) return;
      child.geometry.computeBoundingBox();
      box.union(local.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld));
    });
    return box;
  };
  for (const values of [{mode: 0, span: 5}, {mode: 0, span: 30}, {mode: 1, range: 1}, {mode: 1, range: 10}]) {
    at(values, 2);
    const shown = values.mode === 0 ? ['beam', 'crossing', 'signal'] : ['zones', 'lens', 'signal'], hidden = values.mode === 0 ? ['zones', 'lens'] : ['beam', 'crossing'];
    const boxes = shown.map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
    t.ok(boxes.every(([, box]) => !box.isEmpty()), `mode ${values.mode}: every part of this method drawn`);
    t.ok(hidden.every(id => boxOf(model.parts.find(item => item.id === id).object).isEmpty()), 'and none of the other method');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, A] = boxes[i], [b, B] = boxes[j];
      t.ok(A.max.x + 0.04 <= B.min.x || B.max.x + 0.04 <= A.min.x || A.max.y + 0.04 <= B.min.y || B.max.y + 0.04 <= A.min.y, `the ${a} and the ${b} clear of each other`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes or a sheet gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const beamOnly = values => P.intruderPlan({...P.INTRUDER_DEFAULTS, mode: 0, ...values}).beam;
const zonesOnly = values => P.intruderPlan({...P.INTRUDER_DEFAULTS, mode: 1, ...values}).zones;

checkTrialNumbers(L.activeBurglarAlarmLesson, {
  'Walk through the beam': s => ({[f0(s.beam.margin)]: s.beam.margin, 250: s.beam.blockedFor * 1000, 50: s.values.hold, '1.93': s.beam.alarmAt}),
  'Wait out a slow crossing': s => { t.ok(!s.beam.alarms, 'the slow movement setting lets a walker through'); return {250: s.beam.blockedFor * 1000, 500: s.values.hold, '0.5': s.beam.fastest}; },
  'Jog past the walking setting': s => { t.ok(!s.beam.alarms, 'and so does the walking setting for a jogger'); return {'3.0': s.values.speed, 83: s.beam.blockedFor * 1000, '1.0': s.beam.fastest}; },
  'Stand in the beam': s => { t.ok(s.beam.still && s.beam.alarmAt === 0, 'a body standing on the line sounds it at once'); return {}; },
  'Bring the posts closer': s => ({702: s.beam.margin, 78: beamOnly({}).margin, 1: P.EMITTER.pulsed.current, '87.0': s.beam.bareCurrent * 1e9, 870: s.beam.bareCurrent / P.RECEIVER.dark}),
  'Send nothing out': s => ({4: s.values.contrast, '23.2': s.zones.band, '5.0': s.values.range, '50.0': P.DECLARED.threshold * 1e6, '6.07': s.zones.alarmAt}),
  'Stand still in the zones': s => ({'11.87': s.zones.stillPlus * 1e9, '0.0': s.zones.peak * 1e6}),
}, run, t);

checkTrialNumbers(L.passiveInfraredLesson, {
  'Walk across the zones': s => ({'50.0': P.DECLARED.threshold * 1e6, '6.07': s.zones.alarmAt, '0.59': s.zones.crossing, '4,332': s.zones.responsivity}),
  'Follow a direction onto an element': s => ({'12.5': P.DECLARED.focal, '5.0': s.values.range, '0.40': s.zones.zoneWidth, '1.71': s.zones.pitchAt}),
  'Come closer': s => ({'0.24': s.zones.zoneWidth, '81.7': s.zones.peak * 1e6, 10: s.zones.overs.length}),
  'Twice as warm as the room': s => ({'47.3': s.zones.band, '23.2': zonesOnly({}).band, '7.3': s.zones.farthest, '1.45': s.zones.farthest / zonesOnly({}).farthest, '5.0': zonesOnly({}).farthest, 4: P.PAPIRS.contrast, '1.4': P.PAPIRS.farther, 7: P.PAPIRS.far}),
  'Stand still in a zone': s => ({'11.87': s.zones.stillPlus * 1e9, '0.0': s.zones.peak * 1e6}),
  'Warm the whole view': s => ({'67.9': s.zones.single * 1e6, 1: P.PYRO.match.typical * 100, '0.9': s.zones.peak * 1e6}),
  'Run past': s => ({'3.52': s.zones.crossing, '1,970': s.zones.responsivity, '4,000': P.PYRO.responsivity.typical, 1: P.PYRO.responsivity.at, '20.8': s.zones.peak * 1e6, 10: P.INTRUDER_DOMAINS.range[1]}),
}, run, t);

// Free text: each snippet computed, and every number in the text inside a checked snippet.
const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
}
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
const expectNone = (lesson, name, except = []) => { for (const [where, text] of texts(lesson)) if (!except.includes(where)) covered(text, {}, `${name} ${where}`); };
const standard = zonesOnly({}), byTen = beamOnly({span: 10}), byThirty = beamOnly({});
const beamSnippets = {
  [`a line between the two lenses`]: 'a line between the two lenses',
  [`arrival distance of ${f0(P.OPTEX.arrival)} m`]: 'arrival distance of 265 m',
  [`flashes ${f0(P.DECLARED.rate)} times a second`]: 'flashes 1,000 times a second',
};
const zoneSnippets = {
  [`${f0(P.DECLARED.facets)} facets in one row of ${f1(P.DECLARED.focal)} mm focal length`]: '5 facets in one row of 12.5 mm focal length',
  [`elements ${f0(P.DECLARED.gap)} mm apart`]: 'elements 1 mm apart',
  [`thermal lag of ${f1(P.DECLARED.thermal)} s and electrical leak of ${f1(P.DECLARED.electrical)} s`]: 'thermal lag of 0.1 s and electrical leak of 1.0 s',
  [`threshold of ${f1(P.DECLARED.threshold * 1e6)} μV`]: 'threshold of 50.0 μV',
  [`collecting area of ${f3(P.AREA * 1e6)} mm²`]: 'collecting area of 0.230 mm²',
  [`at the ${f0(P.PAPIRS.distance)} m its sheet specifies`]: 'at the 5 m its sheet specifies',
  [`${f0(P.PAPIRS.target.height * 1000)} by ${f0(P.PAPIRS.target.width * 1000)} mm`]: '700 by 250 mm',
};
covered(L.beamLimits, beamSnippets, 'beam limits');
covered(L.zoneLimits, zoneSnippets, 'zone limits');

expectNone(L.activeBurglarAlarmLesson, 'Active burglar alarm');
covered(L.activeBurglarAlarmLesson.deeper[0].body, {
  [`rates the ${P.OPTEX.model} for ${f0(P.OPTEX.range)} m and gives ${f0(P.OPTEX.arrival)} m`]: 'rates the AX-100TFR for 30 m and gives 265 m',
  [`at ${f0(P.OPTEX.range)} m the receiver has ${f0(byThirty.margin)} times what it needs, and at ${f0(10)} m ${f0(byTen.margin)} times`]: 'at 30 m the receiver has 78 times what it needs, and at 10 m 702 times',
  [`more than ${f0(P.OPTEX.trouble)} s`]: 'more than 20 s',
}, 'Active deeper 1');
covered(L.activeBurglarAlarmLesson.deeper[1].body, {
  [`Vishay’s ${P.EMITTER.model} gives ${f0(P.EMITTER.pulsed.intensity * 1000)} mW/sr in ${f0(P.EMITTER.pulsed.width * 1e6)} μs flashes of ${f0(P.EMITTER.pulsed.current)} A against ${f0(P.EMITTER.steady.intensity * 1000)} mW/sr at a steady ${f0(P.EMITTER.steady.current * 1000)} mA, ${f1(byThirty.boost)} times as much`]: 'Vishay’s TSAL6100 gives 1,450 mW/sr in 100 μs flashes of 1 A against 170 mW/sr at a steady 100 mA, 8.5 times as much',
  [`${f0(P.OPTEX.channels)} such rates`]: '4 such rates',
  [`flashed at ${f0(P.EMITTER.pulsed.current)} A, the emitter would drive ${f1(byThirty.bareCurrent * 1e9)} nA through a BPV10NF photodiode ${f0(P.OPTEX.range)} m away, ${f0(byThirty.bareCurrent / P.RECEIVER.dark)} times its dark current of ${f1(P.RECEIVER.dark * 1e9)} nA`]: 'flashed at 1 A, the emitter would drive 9.7 nA through a BPV10NF photodiode 30 m away, 97 times its dark current of 0.1 nA',
}, 'Active deeper 2');
covered(L.activeBurglarAlarmLesson.deeper[2].body, {
  [`offers ${listOf(P.OPTEX.holds.map(ms => f0(ms)))} ms`]: 'offers 50, 100, 250 and 500 ms',
  [`target is ${f0(P.PAPIRS.target.width * 1000)} mm deep`]: 'target is 250 mm deep',
  [`at ${listOf(P.OPTEX.holds.map(hold => f1(beamOnly({hold}).fastest)))} m/s or slower`]: 'at 5.0, 2.5, 1.0 and 0.5 m/s or slower',
  [`a typical walk of ${f1(P.WALKING)} m/s covers the line for ${f0(beamOnly({speed: P.WALKING}).blockedFor * 1000)} ms`]: 'a typical walk of 1.4 m/s covers the line for 179 ms',
}, 'Active deeper 3');
covered(L.activeBurglarAlarmLesson.deeper[3].body, {
  [`puts at ${f2(P.SKIN[0])} to ${f3(P.SKIN[1])}`]: 'puts at 0.97 to 0.999',
  [`at ${f0(P.PAPIRS.contrast)} °C over a room at ${f0(P.PAPIRS.ambient)} °C sends ${f1(standard.total)} W/m² more`]: 'at 4 °C over a room at 25 °C sends 24.0 W/m² more',
  [`${f1(standard.band)} W/m² of that, ${f0(100 * standard.band / standard.total)}%, lies beyond the ${f0(P.MURATA.filter * 1e6)} μm`]: '23.2 W/m² of that, 96%, lies beyond the 5 μm',
  [`at ${f2(standard.peaks[0] * 1e6)} μm and the room’s at ${f2(standard.peaks[1] * 1e6)} μm`]: 'at 9.59 μm and the room’s at 9.72 μm',
  [`around the ${f0(10)} μm`]: 'around the 10 μm',
}, 'Active deeper 4');
{
  const warmed = zonesOnly({speed: 0, warming: 30});
  covered(L.activeBurglarAlarmLesson.deeper[4].body, {
    [`warming at ${f0(30)} °C a minute, one element alone would give ${f1(warmed.single * 1e6)} μV, past the ${f1(P.DECLARED.threshold * 1e6)} μV threshold`]: 'warming at 30 °C a minute, one element alone would give 67.9 μV, past the 50.0 μV threshold',
    [`matched to ${f0(P.PYRO.match.typical * 100)}% on the LHi 968’s sheet, gives ${f1(warmed.peak * 1e6)} μV`]: 'matched to 1% on the LHi 968’s sheet, gives 0.9 μV',
  }, 'Active deeper 5');
}
covered(L.activeBurglarAlarmLesson.deeper[5].body, {}, 'Active deeper 6');
covered(L.activeBurglarAlarmLesson.quiz.explanation, {
  [`after the ${f0(P.OPTEX.initial)} ms it waits out`]: 'after the 50 ms it waits out',
  [`keeps the + element ${f2(zonesOnly({speed: 0}).stillPlus * 1e9)} nW above the − element`]: 'keeps the + element 11.87 nW above the − element',
  [`holds at ${f1(0)} μV`]: 'holds at 0.0 μV',
}, 'Active quiz');
covered(L.activeBurglarAlarmLesson.limits, {...beamSnippets, ...zoneSnippets, [`${f0(P.DECLARED.beamWatch)} s of it for the beam and ${f0(P.DECLARED.zoneWatch)} s for the zones`]: '4 s of it for the beam and 12 s for the zones'}, 'Active limits');

expectNone(L.passiveInfraredLesson, 'Passive infrared movement detector');
covered(L.passiveInfraredLesson.deeper[0].body, {
  [`emissivity of ${f2(P.DECLARED.emissivity)}, inside the ${f2(P.SKIN[0])} to ${f3(P.SKIN[1])}`]: 'emissivity of 0.98, inside the 0.97 to 0.999',
  [`a body ${f0(P.PAPIRS.contrast)} °C over a room at ${f0(P.PAPIRS.ambient)} °C sends ${f1(standard.total)} W/m² more`]: 'a body 4 °C over a room at 25 °C sends 24.0 W/m² more',
  [`${f1(standard.band)} W/m² of that, ${f0(100 * standard.band / standard.total)}%, lies beyond the ${f0(P.MURATA.filter * 1e6)} μm`]: '23.2 W/m² of that, 96%, lies beyond the 5 μm',
  [`body’s peak at ${f2(standard.peaks[0] * 1e6)} μm and the room’s at ${f2(standard.peaks[1] * 1e6)} μm`]: 'body’s peak at 9.59 μm and the room’s at 9.72 μm',
}, 'Passive deeper 1');
covered(L.passiveInfraredLesson.deeper[1].body, {
  [`${f0(P.PYRO.element.width)} mm wide and ${f0(P.PYRO.element.height)} mm tall and sits ${f1(P.DECLARED.focal)} mm behind a facet, which makes a zone ${f2(deg(P.LENS.across))}° wide and ${f2(deg(P.LENS.elevation))}° tall; the ${f0(P.DECLARED.gap)} mm gap`]: '1 mm wide and 2 mm tall and sits 12.5 mm behind a facet, which makes a zone 4.55° wide and 9.15° tall; the 1 mm gap',
  [`Five facets put ${f0(2 * P.DECLARED.facets)} zones across ${f0(deg(2 * P.LENS.edge))}°, and at ${f0(P.PAPIRS.distance)} m each is ${f2(standard.zoneWidth)} m wide with the next + zone ${f2(standard.pitchAt)} m along`]: 'Five facets put 10 zones across 87°, and at 5 m each is 0.40 m wide with the next + zone 1.71 m along',
  [`packs ${f0(P.PAPIRS.zones)} zones behind a lens ${f1(P.PAPIRS.lens)} mm across`]: 'packs 64 zones behind a lens 9.5 mm across',
}, 'Passive deeper 2');
covered(L.passiveInfraredLesson.deeper[2].body, {
  [`thermal lag of ${f1(P.DECLARED.thermal)} s and an electrical leak of ${f1(P.DECLARED.electrical)} s`]: 'thermal lag of 0.1 s and an electrical leak of 1.0 s',
  [`the sheet’s ${f0(P.PYRO.responsivity.typical)} V/W at ${f0(P.PYRO.responsivity.at)} Hz into ${f0(standard.responsivity)} V/W at the ${f2(standard.crossing)} Hz of a walk and ${f0(zonesOnly({speed: 6}).responsivity)} V/W at the ${f2(zonesOnly({speed: 6}).crossing)} Hz of a run`]: 'the sheet’s 4,000 V/W at 1 Hz into 4,332 V/W at the 0.59 Hz of a walk and 1,970 V/W at the 3.52 Hz of a run',
  [`threshold, ${f1(P.DECLARED.threshold * 1e6)} μV`]: 'threshold, 50.0 μV',
  [`the ${P.PYRO.model}’s sheet`]: 'the LHi 968’s sheet',
  [`over its ${f1(P.PYRO.noise.band[0])} to ${f0(P.PYRO.noise.band[1])} Hz band`]: 'over its 0.3 to 10 Hz band',
}, 'Passive deeper 3');
{
  const warmed = zonesOnly({speed: 0, warming: 30});
  covered(L.passiveInfraredLesson.deeper[3].body, {
    [`warming at ${f0(30)} °C a minute, one element alone would give ${f1(warmed.single * 1e6)} μV and the pair ${f1(warmed.peak * 1e6)} μV, all of it the ${f0(P.PYRO.match.typical * 100)}%`]: 'warming at 30 °C a minute, one element alone would give 67.9 μV and the pair 0.9 μV, all of it the 1%',
  }, 'Passive deeper 4');
}
{
  const far = P.farthestOf(P.PAPIRS.speed, P.PAPIRS.doubled, 0);
  covered(L.passiveInfraredLesson.deeper[4].body, {
    [`reaches the threshold at ${f1(standard.farthest)} m at ${f0(P.PAPIRS.contrast)} °C; at ${f0(P.PAPIRS.doubled)} °C the same walk reaches ${f1(far)} m, ${f2(far / standard.farthest)} times as far, against the about ${f1(P.PAPIRS.farther)} times, and the ${f0(P.PAPIRS.far)} m`]: 'reaches the threshold at 5.0 m at 4 °C; at 8 °C the same walk reaches 7.3 m, 1.45 times as far, against the about 1.4 times, and the 7 m',
    [`only ${f0(1)} °C from the room`]: 'only 1 °C from the room',
  }, 'Passive deeper 5');
}
covered(L.passiveInfraredLesson.deeper[5].body, {}, 'Passive deeper 6');
covered(L.passiveInfraredLesson.quiz.explanation, {
  [`warming at ${f0(30)} °C a minute, one element alone would read ${f1(zonesOnly({speed: 0, warming: 30}).single * 1e6)} μV, past the ${f1(P.DECLARED.threshold * 1e6)} μV threshold, while the matched pair gives ${f1(zonesOnly({speed: 0, warming: 30}).peak * 1e6)} μV`]: 'warming at 30 °C a minute, one element alone would read 67.9 μV, past the 50.0 μV threshold, while the matched pair gives 0.9 μV',
}, 'Passive quiz');
covered(L.passiveInfraredLesson.limits, {...zoneSnippets, [`drawn ${f0(M.timesSmaller(M.ZONE_M))} times smaller than true size and the lens and elements ${f0(M.timesLarger(M.LENS_MM))} times larger`]: 'drawn 50 times smaller than true size and the lens and elements 8 times larger', [`${f0(P.DECLARED.zoneWatch)} s of it`]: '12 s of it'}, 'Passive limits');

// The model's own words: its scales, its watches and the figures the reader sees.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`${f0(M.timesSmaller(M.BEAM_M))} times smaller than true size with the crossing ${f0(M.timesSmaller(M.CROSS_M))} times smaller`]: '100 times smaller than true size with the crossing 20 times smaller',
  [`its zones ${f0(M.timesSmaller(M.ZONE_M))} times smaller and its lens and elements ${f0(M.timesLarger(M.LENS_MM))} times larger`]: 'its zones 50 times smaller and its lens and elements 8 times larger',
  [`${f0(P.DECLARED.beamWatch)} s of it for the beam and ${f0(P.DECLARED.zoneWatch)} s for the zones`]: '4 s of it for the beam and 12 s for the zones',
}, 'system text');
covered(partText('beam'), {[`${f0(M.timesSmaller(M.BEAM_M))} times smaller than true size`]: '100 times smaller than true size'}, 'beam text');
covered(partText('crossing'), {[`${f0(M.timesSmaller(M.CROSS_M))} times smaller than true size`]: '20 times smaller than true size', [`${f0(P.PAPIRS.target.width * 1000)} mm deep`]: '250 mm deep'}, 'crossing text');
covered(partText('zones'), {[`${f0(M.timesSmaller(M.ZONE_M))} times smaller than true size`]: '50 times smaller than true size', [`lens’s ${f0(P.DECLARED.facets)} facets`]: 'lens’s 5 facets'}, 'zones text');
covered(partText('lens'), {[`${f0(M.timesLarger(M.LENS_MM))} times larger than true size`]: '8 times larger than true size', [`${f1(P.DECLARED.focal)} mm in front`]: '12.5 mm in front'}, 'lens text');
covered(partText('signal'), {[`the ${f0(M.BEAMCHART.strip.window * 1000)} ms around the clock`]: 'the 40 ms around the clock', [`${f0(P.DECLARED.threshold * 1e6)} μV either way`]: '50 μV either way'}, 'signal text');

{
  model.reset();
  const beamReadings = model.getState().readings, find = label => beamReadings.find(item => item.label === label);
  t.ok(beamReadings.map(item => item.label).join() === 'Your result,Beam,Covered,Setting,Receiver now,Flashes,Sounder,Drawn', 'eight readings in beam mode, the result first');
  t.ok(find('Beam').value === '78 times the threshold' && find('Covered').value === '250 ms' && find('Setting').value === '50 ms' && find('Flashes').value === '1,000 a second' && find('Sounder').value === 'quiet' && find('Drawn').value === '100 times smaller', 'and they carry the lesson’s figures');
  checkQuotedText(find('Beam').hint, {'265 m as the farthest': `${f0(P.OPTEX.arrival)} m as the farthest`, '78 times stronger': `${f0(byThirty.margin)} times stronger`}, t);
  checkQuotedText(find('Setting').hint, {'above 5.0 m/s': `above ${f1(byThirty.fastest)} m/s`}, t);
  checkQuotedText(find('Receiver now').hint, {'9.7 nA over 30 m, 97 times its dark current': `${f1(byThirty.bareCurrent * 1e9)} nA over ${f0(P.OPTEX.range)} m, ${f0(byThirty.bareCurrent / P.RECEIVER.dark)} times its dark current`}, t);
  model.update({mode: 1});
  const zoneReadings = model.getState().readings, zone = label => zoneReadings.find(item => item.label === label);
  t.ok(zoneReadings.map(item => item.label).join() === 'Your result,Output,Body,Zones,Elements now,Crossing,Warming,Reaches,Drawn', 'nine readings in passive infrared mode');
  t.ok(zone('Output').value === '50.0 μV at most' && zone('Body').value === '23.2 W/m² more' && zone('Zones').value === '0.40 m wide' && zone('Crossing').value === '0.59 Hz' && zone('Reaches').value === '5.0 m' && zone('Warming').value === 'nothing warming', 'and they carry the passive lesson’s figures');
  checkQuotedText(zone('Body').hint, {'24.0 W/m² more': `${f1(standard.total)} W/m² more`, '9.59 μm': `${f2(standard.peaks[0] * 1e6)} μm`}, t);
  checkQuotedText(zone('Zones').hint, {'0.40 m across': `${f2(standard.zoneWidth)} m across`, '1.71 m along the path': `${f2(standard.pitchAt)} m along the path`}, t);
  checkQuotedText(zone('Reaches').hint, {'out to 5.0 m': `out to ${f1(standard.farthest)} m`}, t);
  checkQuotedText(zone('Elements now').hint, {'0.230 mm²': `${f3(P.AREA * 1e6)} mm²`}, t);
  model.update({contrast: P.PAPIRS.doubled});
  const warmer = model.getState().readings.find(item => item.label === 'Reaches');
  t.ok(warmer.value === `${f1(P.farthestOf(P.PAPIRS.speed, P.PAPIRS.doubled, 0))} m` && warmer.value !== `${f1(model.getState().values.range)} m`, 'the reach reading follows this walk, not the path it is set on');
  model.update({contrast: P.PAPIRS.contrast});
  t.ok(!zoneReadings.some(item => /times the threshold|flashes|Optex/i.test(item.value + (item.hint || ''))), 'nothing about the beam while the passive detector is chosen');
  t.ok(!beamReadings.some(item => /element|zone|μV/i.test(item.value + (item.hint || ''))), 'and nothing about the elements while the beam is chosen');
}

for (const lesson of [L.activeBurglarAlarmLesson, L.passiveInfraredLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  t.ok(lesson.steps.length === 5 && lesson.tryIt.length === 7 && lesson.deeper.length === 6 && lesson.parts.length >= 4, 'five steps, seven trials, six deeper sections');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), 'every trial on a part the model has');
}
t.ok(safetyLessons['Active burglar alarm'] === L.activeBurglarAlarmLesson, 'the safety corner’s lesson is this one');
{
  const component = houseComponents['Passive infrared movement detector'];
  t.ok(component.machine === 'Active burglar alarm' && component.part === 'lens' && component.lesson === L.passiveInfraredLesson && component.intro === L.passiveInfraredLesson.simple && component.view === 'front' && component.isolate === false, 'the movement detector routes to the alarm’s lens with its own lesson');
  assert.deepEqual(component.values, {mode: 1});
  t.ok(L.passiveInfraredLesson.tryIt.every(item => item.values.mode === 1), 'and every one of its trials watches the passive detector');
}
{
  // The safety corner builds this model for the name, and both pages are routed in the preview alone.
  const built = createSafetyModel('Active burglar alarm');
  t.ok(built && built.controls.map(control => control.key).join() === model.controls.map(control => control.key).join() && built.parts.map(part => part.id).join() === model.parts.map(part => part.id).join(), 'the safety corner builds this model for the alarm');
  built?.dispose();
  for (const [id, name] of [['active-burglar-alarm', 'Active burglar alarm'], ['passive-infrared-movement-detector', 'Passive infrared movement detector']]) {
    t.ok(neighborhoodCatalog.entries.some(entry => entry.id === id && entry.name === name), `${id} is the catalog’s entry for ${name}`);
    t.ok(previewEntryIds.includes(id) && !publishedEntryIds.includes(id), `${id} is built into the preview and stays unpublished`);
  }
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) {
  const [low, high, step] = P.INTRUDER_DOMAINS[control.key];
  t.ok(control.min === low && control.max === high && control.step === step && control.initial === P.INTRUDER_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`);
  const mode = P.CONTROL_MODES[control.key];
  if (mode === null) t.ok(!control.enabledWhen || (control.enabledWhen({mode: 0}) && control.enabledWhen({mode: 1})), `${control.key} works in both methods`);
  else t.ok(control.enabledWhen({mode}) && !control.enabledWhen({mode: 1 - mode}), `${control.key} is offered only with its own method`);
}
t.ok(model.controls.map(control => control.key).join() === 'mode,speed,span,hold,range,contrast,warming', 'seven controls');

// Every control changes both the readings and the drawing, in the method that offers it.
{
  const drawing = () => JSON.stringify([
    T.transmitter.position.x, T.beamWalker.position.y, T.beamFar.material.color.getHex(), pointsOf(T.beamCurve), pointsOf(T.beamHold).slice(0, 2), pointsOf(T.flashes).slice(0, 8), T.beamOutput.scale.x, T.beamOutput.visible,
    T.zoneWalker.position.x, T.zoneWalker.position.y, pointsOf(T.images), pointsOf(T.plusCurve).slice(0, 30), pointsOf(T.outputGuide).slice(0, 30), pointsOf(T.thresholdLines), T.elementPlus.material.color.getHex(), T.singleCurve.visible,
  ]);
  const look = values => { model.reset(); model.update(values); model.advance(2.4); model.root.updateMatrixWorld(true); return [JSON.stringify(model.getState().readings), drawing()]; };
  for (const control of model.controls) {
    const mode = P.CONTROL_MODES[control.key] === null ? 0 : P.CONTROL_MODES[control.key];
    const other = control.options ? control.options.find(option => option.value !== control.initial).value : control.initial === control.max ? control.min : control.max;
    const before = look({mode}), after = look({mode, [control.key]: other});
    t.ok(after[0] !== before[0], `${control.key} changes the readings`);
    t.ok(after[1] !== before[1], `${control.key} changes the drawing`);
  }
}
checkRefusals(P.sampleIntruder, P.INTRUDER_DOMAINS, t);
for (const bad of [75, 150, 300, 550]) assert.throws(() => P.sampleIntruder({hold: bad}), RangeError, `a setting the receiver does not have, ${bad} ms, is refused`);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the watch');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.5, 1e-12, 'a step advances half a second of real time');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'and changes the readings');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through');
  model.animate(0);
  model.animate(0.25);
  t.near(model.getState().clock, 0.75, 1e-12, 'animation carries the clock by the time that passed');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available() && !model.playback.blocked(), 'the watch over, with something to inspect');
  model.update({mode: 1});
  t.ok(!model.playback.complete(), 'and the longer watch of the zones is not over at the same clock');
  model.advance(1e3);
  t.ok(model.playback.complete(), 'until it runs on');
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0, `${action.label} returns readings`);
    t.ok(model.parts.some(part => part.id === action.part), 'and names a part the model has');
    checkFinite(model.root, t);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  for (const values of [...beamPoses.slice(0, 6), ...zonePoses.slice(0, 6)]) for (const time of [0, 2, 100]) {
    at(values, time);
    t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'every reading a number or a phrase');
    t.ok(model.getState().readings.every(item => !/[—–]| - |--/.test(item.value + (item.hint || ''))), 'and no dashes in any of them');
  }
}
const released = checkDisposal((() => { const fresh = M.createIntruderModel(); fresh.update({mode: 1}); fresh.advance(3); return fresh; })(), t);
model.dispose();

console.log(`PASS burglar alarms: ${t.count} checks, ${counts.steps} steps integrated by other routes, ${counts.rays} rays traced onto the elements, ${counts.samples} covers and interruptions measured, ${counts.poses} poses, ${counts.points} drawn points, ${counts.numbers} quoted numbers traced, 2 lessons, ${released} resources released exactly once.`);

import {validateControls, validTime, clamp} from './physics-kit.js';

// Spin dryer: a perforated drum that flings water out of wet laundry, and the
// sprung cabinet that an unbalanced load shakes.
//
// Units: SI inside. Readings convert to rpm, grams, percent, millimeters.
//
// Pressing the water out. The laundry lies as a layer 40 mm thick against the
// drum wall, 150 mm from the axis. Spinning at w, the water in it feels a
// pressure across the layer of rho w^2 (R^2 - (R - t)^2) / 2. Water sits in the
// fabric's pores, held by capillary suction 2 gamma cos(theta) / r, with
// gamma = 0.072 N/m and cos(theta) = 0.9. Pores wider than the radius where the
// two balance empty; narrower ones keep their water. Pore radii follow a
// log-normal spread around 5 µm with a spread of 1.2 in their logarithm.
//
// How wet. Soaked cotton holds 1.5 kg of water for each kilogram of fiber;
// 0.45 kg of that sits inside the fibers themselves and cannot be spun out. The
// rest is shared among the pores, so the water left at a speed is 0.45 plus
// 1.05 times the share of pore space in pores too narrow to empty. The water
// takes time to find its way out: it approaches that level with a time
// constant of 15 s at a pressure of 100 kPa, shorter in proportion as the
// pressure rises.
//
// The spin. The drum speeds up evenly for 20 s, holds its speed, and stops at
// three minutes. Its motor works against windage and bearing drag of 150 W at
// 2,800 rpm, rising as the cube of the speed.
//
// Shaking. An unbalanced lump of wet laundry at the drum wall pulls with m r w^2.
// The cabinet, 25 kg on springs of 40 kN/m damped at a tenth of critical, moves
// X = m r w^2 / sqrt((k - M w^2)^2 + (c w)^2), largest when the drum passes the
// cabinet's own natural speed on the way up.
//
// Not modeled: water re-wetting the laundry, the layer's changing thickness,
// air drag on the water, the motor's electrical losses, and the shaking's
// effect on the drum's speed.

export const SPIN = Object.freeze({
  g: 9.81, radius: 0.15, layer: 0.04, density: 1000, tension: 0.072, wetting: 0.9, pore: 5e-6, spread: 1.2,
  soaked: 1.5, bound: 0.45, drain: 15, reference: 1e5, ramp: 20, duration: 180, windage: 150, windageSpeed: 2800,
  cabinet: 25, spring: 4e4, damping: 0.1, latent: 2.26e6, every: 1,
});
export const SPIN_DEFAULTS = Object.freeze({rpm: 2800, load: 2, imbalance: 0.1});
export const SPIN_DOMAINS = Object.freeze({rpm: [500, 3000, 100], load: [1, 4, 0.5], imbalance: [0, 0.3, 0.05]});

const TAU = Math.PI * 2;
export const omegaOf = rpm => rpm * TAU / 60;
/** Pressure across the laundry layer at a spin speed. */
export const layerPressure = w => SPIN.density * w * w * (SPIN.radius ** 2 - (SPIN.radius - SPIN.layer) ** 2) / 2;
/** The widest pore that can still hold its water against that pressure. */
export const holdingRadius = pressure => pressure > 0 ? 2 * SPIN.tension * SPIN.wetting / pressure : Infinity;

/** The standard normal distribution function, by the Abramowitz and Stegun rational approximation (error under 1.5e-7). */
export function normalShare(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = Math.exp(-z * z / 2) / Math.sqrt(TAU);
  const tail = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - tail : tail;
}

/** Water left per kilogram of fiber once the pores have drained as far as a speed allows. */
export function equilibriumMoisture(w) {
  const r = holdingRadius(layerPressure(w));
  const filled = Number.isFinite(r) ? normalShare((Math.log(r) - Math.log(SPIN.pore)) / SPIN.spread) : 1;
  return SPIN.bound + (SPIN.soaked - SPIN.bound) * filled;
}

export const drainTime = w => { const pressure = layerPressure(w); return pressure > 0 ? SPIN.drain * SPIN.reference / pressure : Infinity; };
export const speedAt = (rpm, time) => (time >= SPIN.duration ? 0 : omegaOf(rpm) * clamp(time / SPIN.ramp));
export const windagePower = w => SPIN.windage * (w / omegaOf(SPIN.windageSpeed)) ** 3;

export function shaking(imbalance, w) {
  const f = SPIN, k = f.spring, M = f.cabinet, c = 2 * f.damping * Math.sqrt(k * M), force = imbalance * f.radius * w * w;
  return {force, amplitude: force / Math.sqrt((k - M * w * w) ** 2 + (c * w) ** 2), natural: Math.sqrt(k / M)};
}

const cache = new Map();

export function spinPlan(input = {}) {
  const values = validateControls(input, SPIN_DEFAULTS, SPIN_DOMAINS, 'spin dryer');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const f = SPIN, dt = 0.01, samples = [];
  let moisture = f.soaked, energy = 0, peak = {amplitude: 0, rpm: 0};
  for (let n = 0; ; n++) {
    const t = n * dt, w = speedAt(values.rpm, t), eq = equilibriumMoisture(w), tau = drainTime(w), shake = shaking(values.imbalance, w);
    if (n % (f.every / dt) === 0) samples.push({t, w, moisture, eq, energy, amplitude: shake.amplitude, force: shake.force});
    if (t >= f.duration + 5 - 1e-9) break;
    if (shake.amplitude > peak.amplitude) peak = {amplitude: shake.amplitude, rpm: w * 60 / TAU};
    if (moisture > eq && Number.isFinite(tau)) moisture = eq + (moisture - eq) * Math.exp(-dt / tau);
    const accelerating = t < f.ramp ? values.load * (f.soaked + 1) * f.radius ** 2 * omegaOf(values.rpm) / f.ramp * w : 0;
    energy += (windagePower(w) + accelerating) * dt;
  }
  const end = samples.find(sample => sample.t >= f.duration - 1e-9);
  const removed = (f.soaked - end.moisture) * values.load;
  const plan = {
    values, samples, natural: shaking(0, 0).natural, peak, final: end.moisture, removed, spinEnergy: end.energy, evaporationEnergy: removed * f.latent,
    gForce: omegaOf(values.rpm) ** 2 * f.radius / f.g, pressure: layerPressure(omegaOf(values.rpm)), holding: holdingRadius(layerPressure(omegaOf(values.rpm))),
    equilibrium: equilibriumMoisture(omegaOf(values.rpm)), running: shaking(values.imbalance, omegaOf(values.rpm)),
  };
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

export function sampleSpin(input = {}, time = 0) {
  validTime(time);
  const plan = spinPlan(input), clock = Math.min(SPIN.duration + 5, time), index = Math.min(plan.samples.length - 2, Math.floor(clock / SPIN.every));
  const a = plan.samples[index], b = plan.samples[index + 1], u = clamp((clock - a.t) / (b.t - a.t));
  const now = {...plan, clock};
  for (const key of ['moisture', 'energy']) now[key] = a[key] + (b[key] - a[key]) * u;
  now.w = speedAt(plan.values.rpm, clock);
  const shake = shaking(plan.values.imbalance, now.w);
  now.force = shake.force;
  now.amplitude = shake.amplitude;
  now.equilibriumNow = equilibriumMoisture(now.w);
  now.rpmNow = now.w * 60 / TAU;
  now.complete = clock >= SPIN.duration + 5;
  return now;
}

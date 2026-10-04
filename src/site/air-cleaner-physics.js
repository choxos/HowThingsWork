import {validateControls, validTime} from './physics-kit.js';

// SI throughout. These are assigned classroom dimensions and material values,
// not the specification, certification or measured CADR of a commercial product.
//
// Particle mobility: slip-corrected Stokes drag and Stokes-Einstein diffusion.
// Fibrous mat: Kuwabara interception and the diffusion correlation in Vosburgh
// et al. (2017), equations 4-6; inertial term from Cheng (2016), equations 28-31.
// https://stacks.cdc.gov/view/cdc/47892/cdc_47892_DS1.pdf
// https://stacks.cdc.gov/view/cdc/218757/cdc_218757_DS1.pdf
// We use the explicit Kuwabara expression, not the inverted R factor printed
// in equation 24 of the latter report. R <= .3 for every selectable diameter.
// The independent-mechanism combination and uniform-fiber mat remain idealizations.
//
// Charging: field and diffusion charging with SI Coulomb constant, followed by
// slip-corrected electrical drift. See EPA ESP manual, section 3.1.4:
// https://www.epa.gov/sites/default/files/2020-07/documents/cs6ch3.pdf
// A Poisson distribution is an assigned charge-spread approximation. Collection
// here uses uniform plug flow, NOT the turbulent-mixing Deutsch equation:
// The charging grid has its own clear area, so exposure uses Q/A_charge.
// This is the bulk speed between its plates; local wire blockage is neglected.
// Collection uses Q/A_collect. A particle n charges strong drifts w(n)*L/U; uniform entry positions give
// min(w(n)*L/(U*gap), 1). Only the lower-potential surface collects positive dust.
//
// Room: initially neutral, well mixed, no new source or resuspension. Fan-assisted
// charging-only mode charges particles on successive passes, not instantly all
// over the room. Two compartments track neutral and charged aerosol; assigned
// charge relaxation and wall field are illustrative. No ozone/health prediction.
export const AIR = Object.freeze({viscosity: 1.81e-5, temperature: 293.15, path: 66e-9, density: 1.204, g: 9.81, boltzmann: 1.380649e-23, charge: 1.602176634e-19, permittivity: 8.8541878128e-12});
export const FILTER = Object.freeze({fiber: 10e-6, solidity: .1, thickness: .002, area: 1.2, density: 1000});
export const PRECIPITATOR = Object.freeze({wireVoltage: 7000, chargeField: 5.6e5, ions: 5e14, mobility: 1.5e-4, ionSpeed: 240, zone: .025, chargingOpen: 12 * (.025 - .0008) * .2, dielectric: 2.5, plateVoltage: 3000, gap: .006, thickness: .0008, plates: 45, length: .1, width: .2, open: 44 * .006 * .2});
export const ROOM = Object.freeze({height: 2.5, ventilation: .5 / 3600, field: 20, neutralization: Math.LN2 / 600, duration: 3600, speed: 60});
export const FAN = Object.freeze({radius: .1, hub: .027, area: Math.PI * (.1 ** 2 - .027 ** 2)});
export const SIZES = Object.freeze([1e-8, 3e-8, 1e-7, 3e-7, 5e-7, 1e-6, 3e-6]);
export const FLOWS = Object.freeze([0, 60, 120, 200]);
export const METHOD_OPTIONS = Object.freeze([{value: 0, label: 'Fibrous filter'}, {value: 1, label: 'Electrostatic cleaner'}, {value: 2, label: 'Ionizer without plates'}]);
export const AIR_CLEANER_DEFAULTS = Object.freeze({mode: 1, size: 3, fan: 3, voltage: 1, room: 30});
export const AIR_CLEANER_DOMAINS = Object.freeze({mode: [0, 2, 1], size: [0, 6, 1], fan: [0, 3, 1], voltage: [0, 1, 1], room: [30, 90, 30]});
const {viscosity: mu, temperature: T, boltzmann: k, charge: e, permittivity: eps0} = AIR;
const cap = x => Math.max(0, Math.min(1, x));
export const slip = d => 1 + AIR.path / d * (2.34 + 1.05 * Math.exp(-.39 * d / AIR.path));
export const diffusivity = d => k * T * slip(d) / (3 * Math.PI * mu * d);
export const settling = d => FILTER.density * d * d * AIR.g * slip(d) / (18 * mu);
export const driftSpeed = (charges, d, E) => charges * e * E * slip(d) / (3 * Math.PI * mu * d);

export function fiberCapture(d, U) {
  if (!(d > 0) || d > 3e-6 || !(U > 0)) throw new RangeError('Invalid fibrous-filter state');
  const {fiber: df, solidity: a, thickness: thickness} = FILTER;
  const kuwabara = -.5 * Math.log(a) - .75 + a - a * a / 4, R = d / df, peclet = U * df / diffusivity(d);
  const fiberKn = 2 * AIR.path / df, correction = 1 + .388 * fiberKn * ((1 - a) * peclet / kuwabara) ** (1 / 3);
  const diffusion = cap(1.6 * (1 - a) / kuwabara * peclet ** (-2 / 3) * correction);
  const interception = cap((1 + R) / (2 * kuwabara) * (2 * Math.log1p(R) - 1 + a + (1 - a / 2) / (1 + R) ** 2 - a / 2 * (1 + R) ** 2));
  const stokes = FILTER.density * d * d * slip(d) * U / (18 * mu * df);
  const J = (29.6 - 28 * a ** .63) * R * R - 27.5 * R ** 2.8;
  const impaction = cap(stokes * J / (2 * kuwabara * kuwabara));
  const single = 1 - (1 - diffusion) * (1 - interception) * (1 - impaction);
  const penetration = Math.exp(-4 * a * single * thickness / (Math.PI * df * (1 - a)));
  return {kuwabara, R, peclet, stokes, diffusion, interception, impaction, single, penetration, efficiency: 1 - penetration};
}

export function charging(d, U, enabled = true) {
  const p = PRECIPITATOR, K = 1 / (4 * Math.PI * eps0), tau = 4 * eps0 / (p.ions * e * p.mobility);
  if (!enabled || U === 0) return {time: 0, tau, saturation: 0, field: 0, diffusion: 0, total: 0};
  if (!(d > 0) || !(U > 0)) throw new RangeError('Invalid charging state');
  const time = p.zone / U, saturation = 3 * p.dielectric / (p.dielectric + 2) * Math.PI * eps0 * p.chargeField * d * d / e;
  const field = saturation * time / (time + tau);
  const diffusion = d * k * T / (2 * K * e * e) * Math.log1p(Math.PI * K * d * p.ionSpeed * e * e * p.ions * time / (2 * k * T));
  return {time, tau, saturation, field, diffusion, total: field + diffusion};
}

// Recurrence from the modal probability avoids underflow for large mean charge.
// Bounds leave less than machine precision of probability in the omitted tails
// over this model's domain; normalization also removes roundoff from factorials.
export function chargeDistribution(mean) {
  if (!Number.isFinite(mean) || mean < 0 || mean > 1e5) throw new RangeError('Invalid mean charge');
  if (mean === 0) return [{n: 0, probability: 1}];
  const mode = Math.floor(mean), spread = Math.ceil(12 * Math.sqrt(mean) + 32), low = Math.max(0, mode - spread), high = mode + spread;
  const weights = new Array(high - low + 1).fill(0);weights[mode - low] = 1;
  for (let n = mode; n > low; n--) weights[n - 1 - low] = weights[n - low] * n / mean;
  for (let n = mode + 1; n <= high; n++) weights[n - low] = weights[n - 1 - low] * mean / n;
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((weight, i) => ({n: i + low, probability: weight / sum}));
}
export function chargeQuantile(distribution, fraction) {
  let sum = 0;for (const {n, probability} of distribution) {sum += probability;if (fraction <= sum) return n;}return distribution.at(-1).n;
}
export function plateCatch(d, U, enabled = true) {
  if (U === 0 || !enabled) return 0;
  const p = PRECIPITATOR, perCharge = driftSpeed(1, d, p.plateVoltage / p.gap) * p.length / (U * p.gap);
  return chargeDistribution(charging(d, U * p.open / p.chargingOpen).total).reduce((sum, {n, probability}) => sum + probability * Math.min(n * perCharge, 1), 0);
}
const cache = new Map();
export function airCleanerPlan(input = {}) {
  const values = validateControls(input, AIR_CLEANER_DEFAULTS, AIR_CLEANER_DOMAINS, 'air cleaner'), key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const d = SIZES[values.size], hourly = FLOWS[values.fan], Q = hourly / 3600, enabled = values.voltage === 1 && Q > 0;
  const U = Q / (values.mode === 0 ? FILTER.area : values.mode === 1 ? PRECIPITATOR.open : FAN.area);
  const chargeU = values.mode === 1 ? Q / PRECIPITATOR.chargingOpen : U;
  const charge = charging(d, chargeU, enabled && values.mode !== 0), distribution = chargeDistribution(charge.total);
  const capture = values.mode === 0 && Q > 0 ? fiberCapture(d, U) : null;
  const efficiency = values.mode === 0 ? capture?.efficiency ?? 0 : values.mode === 1 ? plateCatch(d, U, enabled) : 0;
  const cadr = Q * efficiency, volume = values.room, floor = volume / ROOM.height, surfaces = 2 * floor + 4 * Math.sqrt(floor) * ROOM.height;
  const chargedFraction = -Math.expm1(-charge.total), conditionalCharge = chargedFraction > 0 ? charge.total / chargedFraction : 0;
  const roomDrift = values.mode === 2 ? driftSpeed(conditionalCharge, d, ROOM.field) : 0;
  const rates = {cleaner: cadr / volume, ventilation: ROOM.ventilation, settling: settling(d) / ROOM.height, charging: values.mode === 2 ? Q / volume * chargedFraction : 0, relaxation: values.mode === 2 ? ROOM.neutralization : 0, drift: roomDrift * surfaces / volume};
  const plan = {values, d, hourly, Q, U, chargeU, enabled, charge, distribution, chargedFraction, conditionalCharge, capture, efficiency, cadr, volume, floor, surfaces, roomDrift, rates, changes: hourly / volume};
  if (cache.size >= 128) cache.delete(cache.keys().next().value);cache.set(key, plan);return plan;
}
const integralExp = (rate, time) => rate === 0 ? time : -Math.expm1(-rate * time) / rate;
/** Exact integration of the two-compartment room and its three absorbing sinks. */
export function sampleAirCleaner(input = {}, time = 0) {
  validTime(time);const plan = airCleanerPlan(input), clock = Math.min(time, ROOM.duration), r = plan.rates;
  const base = r.ventilation + r.settling, beta = r.charging, gamma = r.relaxation, delta = r.drift;
  let neutral, charged, integralNeutral, integralCharged;
  if (beta === 0) {
    const rate = base + r.cleaner;neutral = Math.exp(-rate * clock);charged = 0;integralNeutral = integralExp(rate, clock);integralCharged = 0;
  } else {
    // Separate base loss from the charging/relaxation matrix. Its eigenvalues
    // are real. Compute the smaller decay via the determinant to avoid loss
    // of precision when electrical deposition is weak.
    const sum = beta + gamma + delta, discriminant = Math.sqrt(sum * sum - 4 * beta * delta);
    const slow = 2 * beta * delta / (sum + discriminant), fast = sum - slow;
    const denominator = fast - slow, a = (fast - beta) / denominator, b = (beta - slow) / denominator;
    const es = Math.exp(-(base + slow) * clock), ef = Math.exp(-(base + fast) * clock);
    neutral = a * es + b * ef;charged = beta / denominator * (es - ef);
    const is = integralExp(base + slow, clock), iff = integralExp(base + fast, clock);
    integralNeutral = a * is + b * iff;integralCharged = beta / denominator * (is - iff);
  }
  const remaining = neutral + charged, integrated = integralNeutral + integralCharged;
  const collected = r.cleaner * integrated, settled = r.settling * integrated, electricalDeposit = delta * integralCharged, ventilated = r.ventilation * integrated;
  return {...plan, clock, neutral, charged, remaining, collected, settled, electricalDeposit, deposited: settled + electricalDeposit, ventilated, withoutCleaner: Math.exp(-base * clock)};
}

import {validateControls, validTime} from './physics-kit.js';

// Air cleaner: a fan drawing room air past one of three ways of catching
// particles, and the room's air cleared over an hour.
//
// Units: SI inside. Readings convert to micrometers, cubic meters an hour,
// percent, pascals, watts and minutes.
//
// Particles, unit density, in air at 20 °C. Slip correction
// C = 1 + (lambda / d)(2.34 + 1.05 exp(-0.39 d / lambda)), lambda = 66 nm;
// diffusion coefficient D = k T C / (3 pi mu d); settling speed
// v = rho d^2 g C / (18 mu).
//
// HEPA-grade filter, after Hinds, Aerosol Technology, chapter 9. A mat of
// fibers 0.6 um across, 4% solid and 0.4 mm thick, pleated into 1.85 m^2,
// which the air crosses at U = Q / A. With Kuwabara's factor
// Ku = -ln(alpha) / 2 - 3/4 + alpha - alpha^2 / 4, one fiber catches:
//   by interception, E_R = (1 - alpha) R^2 / (Ku (1 + R)), with R = d / d_f;
//   by diffusion, E_D = 2 Pe^(-2/3), with Pe = U d_f / D;
//   by diffusion onto the interception zone, E_DR = 1.24 R^(2/3) / sqrt(Ku Pe);
//   by impaction, E_I = Stk J / (2 Ku^2), with Stk = rho d^2 C U / (18 mu d_f)
//     and J = (29.6 - 28 alpha^0.62) R^2 - 27.5 R^2.8 below R = 0.4, 2 above;
//   by settling, E_G = (v / U)(1 + R);
// each at most 1, together 1 - (1 - E_R)(1 - E_D)(1 - E_DR)(1 - E_I)(1 - E_G).
// The mat lets through exp(-4 alpha E t / (pi d_f (1 - alpha))), and costs a
// pressure drop, by Davies, of mu U t 64 alpha^1.5 (1 + 56 alpha^3) / d_f^2.
//
// Two-stage electrostatic precipitator. Ionizing wires at 7 kV charge the
// particles as they cross a 25 mm zone with a field of 5.6e5 V/m and 5e14 ions
// in each cubic meter, of mobility 1.5e-4 m^2/(V s) and mean speed 240 m/s.
// Field charging, n_f = (3 eps / (eps + 2)) pi eps0 E d^2 / e times t / (t + tau)
// with tau = 4 eps0 / (N e Z) and eps = 2.5; diffusion charging by White's
// equation, n_d = (d k T / (2 K e^2)) ln(1 + pi K d c N e^2 t / (2 k T)). Then
// plates 6 mm apart and 100 mm long, at 5 kV: the particles drift across at
// w = n e E C / (3 pi mu d), and the Deutsch equation catches
// 1 - exp(-w L / (U s)) of them, the air crossing 0.06 m^2 of channels. The
// charges on particles of one size spread about their mean as a Poisson
// distribution, so the share caught is averaged over them, which comes to
// 1 - exp(-n (1 - exp(-a))) with a the exponent for one charge: a particle with
// no charge is never caught.
//
// Ionizer without plates. The same charging, then no plates: charged particles
// drift to the room's 64 m^2 of walls, floor and ceiling in a room field taken
// as 20 V/m, as if every particle in the room carried that charge.
//
// The room: 30 m^3 with 12 m^2 of floor. Clean outdoor air replaces its air
// half a time an hour, particles settle onto the floor, and the cleaner
// removes its clean air delivery rate, CADR = Q times the share it catches.
// The concentration falls as exp(-(CADR / V + ventilation + settling + drift) t).
//
// The fan moves 60, 120 or 200 m^3 an hour against the filter or plates and
// 25 Pa of grilles, at 30% efficiency; the corona draws 0.15 mA at 7 kV.
//
// Not modeled: particles bouncing off fibers, filters loading up, charge
// leaking away, ozone from the corona, particles of other densities and shapes,
// and the room's air mixing imperfectly.

export const AIR = Object.freeze({viscosity: 1.81e-5, temperature: 293.15, path: 66e-9, g: 9.81, boltzmann: 1.380649e-23, charge: 1.602176634e-19, permittivity: 8.8541878128e-12});
export const FILTER = Object.freeze({fiber: 0.6e-6, solidity: 0.04, thickness: 4e-4, area: 1.85, density: 1000});
export const PRECIPITATOR = Object.freeze({wireVoltage: 7000, chargeField: 5.6e5, ions: 5e14, mobility: 1.5e-4, ionSpeed: 240, zone: 0.025, dielectric: 2.5, plateVoltage: 5000, gap: 0.006, length: 0.1, open: 0.06, corona: 1.5e-4});
export const ROOM = Object.freeze({volume: 30, floor: 12, surfaces: 64, ventilation: 0.5 / 3600, field: 20, minutes: 60});
export const FAN = Object.freeze({efficiency: 0.3, grille: 25});
export const SIZES = Object.freeze([1e-8, 3e-8, 1e-7, 3e-7, 1e-6, 3e-6, 1e-5]);
export const FLOWS = Object.freeze([60, 120, 200]);
export const METHOD_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'HEPA filter'}), Object.freeze({value: 1, label: 'Electrostatic precipitator'}), Object.freeze({value: 2, label: 'Ionizer without plates'})]);
export const AIR_CLEANER_DEFAULTS = Object.freeze({mode: 0, size: 3, fan: 2});
export const AIR_CLEANER_DOMAINS = Object.freeze({mode: [0, 2, 1], size: [0, 6, 1], fan: [0, 2, 1]});

const {viscosity: mu, temperature: T, boltzmann: k, charge: e, permittivity: eps0} = AIR;
export const slip = d => 1 + AIR.path / d * (2.34 + 1.05 * Math.exp(-0.39 * d / AIR.path));
export const diffusivity = d => k * T * slip(d) / (3 * Math.PI * mu * d);
export const settling = d => FILTER.density * d * d * AIR.g * slip(d) / (18 * mu);
const atMost1 = x => Math.max(0, Math.min(1, x));

/** What a HEPA-grade mat catches of particles of diameter d when the air crosses it at U. */
export function fiberCapture(d, U) {
  const {fiber: df, solidity: a, thickness: t} = FILTER;
  const kuwabara = -Math.log(a) / 2 - 0.75 + a - a * a / 4, R = d / df, peclet = U * df / diffusivity(d);
  const stokes = FILTER.density * d * d * slip(d) * U / (18 * mu * df), J = R < 0.4 ? (29.6 - 28 * a ** 0.62) * R * R - 27.5 * R ** 2.8 : 2;
  const parts = {
    interception: atMost1((1 - a) * R * R / (kuwabara * (1 + R))),
    diffusion: atMost1(2 * peclet ** (-2 / 3)),
    both: atMost1(1.24 * R ** (2 / 3) / Math.sqrt(kuwabara * peclet)),
    impaction: atMost1(stokes * J / (2 * kuwabara * kuwabara)),
    settling: atMost1(settling(d) / U * (1 + R)),
  };
  const single = 1 - Object.values(parts).reduce((pass, E) => pass * (1 - E), 1);
  const penetration = Math.exp(-4 * a * single * t / (Math.PI * df * (1 - a)));
  return {kuwabara, R, peclet, stokes, ...parts, single, penetration, efficiency: 1 - penetration};
}
export const filterDrop = U => mu * U * FILTER.thickness * 64 * FILTER.solidity ** 1.5 * (1 + 56 * FILTER.solidity ** 3) / FILTER.fiber ** 2;

/** Charges a particle picks up crossing the ionizing zone at speed U. */
export function charging(d, U) {
  const p = PRECIPITATOR, time = p.zone / U, K = 1 / (4 * Math.PI * eps0);
  const tau = 4 * eps0 / (p.ions * e * p.mobility), saturation = 3 * p.dielectric / (p.dielectric + 2) * Math.PI * eps0 * p.chargeField * d * d / e;
  const field = saturation * time / (time + tau);
  const diffusion = d * k * T / (2 * K * e * e) * Math.log(1 + Math.PI * K * d * p.ionSpeed * e * e * p.ions * time / (2 * k * T));
  return {time, tau, saturation, field, diffusion, total: field + diffusion};
}
export const driftSpeed = (charges, d, E) => charges * e * E * slip(d) / (3 * Math.PI * mu * d);

/**
 * Share caught between the plates, averaged over a Poisson spread of charges
 * about the mean: with a = w1 L / (U s) for a single charge, the average of
 * 1 - exp(-n a) is, by the Poisson generating function, 1 - exp(-mean (1 - exp(-a))).
 */
export function plateCatch(d, U) {
  const p = PRECIPITATOR, mean = charging(d, U).total, perCharge = driftSpeed(1, d, p.plateVoltage / p.gap) * p.length / (U * p.gap);
  return 1 - Math.exp(-mean * (1 - Math.exp(-perCharge)));
}

const cache = new Map();

export function airCleanerPlan(input = {}) {
  const values = validateControls(input, AIR_CLEANER_DEFAULTS, AIR_CLEANER_DOMAINS, 'air cleaner');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const d = SIZES[values.size], hourly = FLOWS[values.fan], Q = hourly / 3600, p = PRECIPITATOR;
  const catchAt = size => {
    if (values.mode === 0) return fiberCapture(size, Q / FILTER.area).efficiency;
    if (values.mode === 1) return plateCatch(size, Q / p.open);
    return 0;
  };
  const U = values.mode === 0 ? Q / FILTER.area : Q / p.open, capture = values.mode === 0 ? fiberCapture(d, U) : null, charge = values.mode === 0 ? null : charging(d, U);
  const plateDrift = values.mode === 1 ? driftSpeed(charge.total, d, p.plateVoltage / p.gap) : 0, roomDrift = values.mode === 2 ? driftSpeed(charge.total, d, ROOM.field) : 0;
  const efficiency = catchAt(d), cadr = Q * efficiency;
  const rates = {cleaner: cadr / ROOM.volume, ventilation: ROOM.ventilation, settling: settling(d) * ROOM.floor / ROOM.volume, drift: roomDrift * ROOM.surfaces / ROOM.volume};
  const total = rates.cleaner + rates.ventilation + rates.settling + rates.drift;
  const drop = (values.mode === 0 ? filterDrop(U) : 0) + FAN.grille, corona = values.mode === 0 ? 0 : p.wireVoltage * p.corona;
  const curve = Array.from({length: 61}, (_, i) => { const size = 10 ** (-8 + 3 * i / 60); return {size, efficiency: catchAt(size)}; });
  const plan = {
    values, d, hourly, Q, U, capture, charge, plateDrift, roomDrift, efficiency, cadr, rates, total, halfTime: Math.LN2 / total,
    changes: Q / ROOM.volume * 3600, drop, fanPower: drop * Q / FAN.efficiency, corona, electrical: drop * Q / FAN.efficiency + corona, curve,
  };
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** The room some seconds after the cleaner was switched on. */
export function sampleAirCleaner(input = {}, time = 0) {
  validTime(time);
  const plan = airCleanerPlan(input), clock = Math.min(time, ROOM.minutes * 60);
  return {...plan, clock, remaining: Math.exp(-plan.total * clock), withoutCleaner: Math.exp(-(plan.total - plan.rates.cleaner - plan.rates.drift) * clock)};
}

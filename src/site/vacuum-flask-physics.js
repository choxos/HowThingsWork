import {validateControls, validTime, clamp} from './physics-kit.js';

// Vacuum flask: four ways heat gets in or out, and what each part of the flask
// does to one of them.
//
// Units: SI inside. Readings convert to watts, degrees Celsius, hours.
//
// The drink. Half a liter of water, 2,093 J per degree, plus 75 J per degree
// for the inner wall, all at one temperature T. The room is at 20 degrees.
//
// Radiation. The inner wall radiates to the outer wall across the gap. Between
// two equal-area planar gray surfaces the net flow is sigma A (T^4 - Ta^4) /
// (2 / e - 1), with A = 0.032 m^2. Silvering brings e down to 0.03, which cuts
// radiation by a factor of about 54 compared with bare glass at 0.9.
//
// Gas in the gap. Air in a 5 mm gap conducts k A dT / gap with k = 0.026 W per
// meter per degree. A vacuum has almost nothing left to carry heat; the model
// keeps a thousandth of the air's conduction for the gas that remains.
//
// The neck. Where the two walls join, heat creeps along the wall itself: a
// 0.5 mm wall 20 mm long around a 50 mm neck. Glass, at 1 W per meter per
// degree, passes far less than stainless steel at 16.
//
// The top. Chosen effective sensible-heat conductances are 0.02 W/K with the
// stopper and 0.3 W/K without it. Evaporation is not a reversible conductance
// and is omitted, along with humidity, mass loss and evaporative cooling.
//
// The temperature follows C dT/dt = -(losses), integrated in one-minute steps
// over a day. Starting cold instead, the same paths carry heat in.
//
// These are illustrative constant properties, not a product-retention model.
// Not modeled: evaporation, temperature gradients or flow inside the drink,
// exterior/support heat storage, pouring, or curved-surface radiation factors.

export const FLASK = Object.freeze({
  water: 0.5, specificHeat: 4186, wallCapacity: 75, room: 20, area: 0.032, sigma: 5.670374419e-8, gap: 0.005, air: 0.026,
  vacuumShare: 1e-3, neckPerimeter: Math.PI * 0.05, neckWall: 0.0005, neckLength: 0.02, stopper: 0.02, openTop: 0.3, step: 60, duration: 24 * 3600, reference: 60,
});
export const FLASK_DEFAULTS = Object.freeze({silvered: 1, vacuum: 1, neck: 0, stopper: 1, start: 90});
export const FLASK_DOMAINS = Object.freeze({silvered: [0, 1, 1], vacuum: [0, 1, 1], neck: [0, 1, 1], stopper: [0, 1, 1], start: [4, 95, 1]});

/** Heat flows out of the drink at temperature T (in watts, negative means heat flowing in), by path. */
export function heatPaths(values, T) {
  const f = FLASK, Ta = f.room, e = values.silvered ? 0.03 : 0.9, K = 273.15;
  const radiation = f.sigma * f.area * ((T + K) ** 4 - (Ta + K) ** 4) / (2 / e - 1);
  const gas = f.air * f.area * (T - Ta) / f.gap * (values.vacuum ? f.vacuumShare : 1);
  const neck = (values.neck ? 16 : 1) * f.neckPerimeter * f.neckWall / f.neckLength * (T - Ta);
  const top = (values.stopper ? f.stopper : f.openTop) * (T - Ta);
  return {radiation, gas, neck, top, total: radiation + gas + neck + top};
}

export const flaskCapacity = () => FLASK.water * FLASK.specificHeat + FLASK.wallCapacity;

const cache = new Map();

export function flaskPlan(input = {}) {
  const values = validateControls(input, FLASK_DEFAULTS, FLASK_DOMAINS, 'vacuum flask');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const C = flaskCapacity(), dt = FLASK.step, samples = [];
  let T = values.start, crossed = null;
  const energy = {radiation: 0, gas: 0, neck: 0, top: 0};
  for (let n = 0; n * dt <= FLASK.duration; n++) {
    samples.push({t: n * dt, T, energy: {...energy}});
    if (n * dt === FLASK.duration) break;
    const q1 = heatPaths(values, T), q2 = heatPaths(values, T - dt * q1.total / (2 * C));
    const q3 = heatPaths(values, T - dt * q2.total / (2 * C)), q4 = heatPaths(values, T - dt * q3.total / C);
    const next = T - dt * (q1.total + 2 * q2.total + 2 * q3.total + q4.total) / (6 * C);
    for (const key of Object.keys(energy)) energy[key] += dt * (q1[key] + 2 * q2[key] + 2 * q3[key] + q4[key]) / 6;
    if (crossed === null && T >= FLASK.reference && next < FLASK.reference) crossed = n * dt + dt * (T - FLASK.reference) / (T - next);
    T = next;
  }
  const plan = {values, capacity: C, samples, aboveReferenceUntil: values.start <= FLASK.reference ? 0 : crossed, startPaths: heatPaths(values, values.start)};
  if (cache.size >= 32) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

export function sampleFlask(input = {}, hours = 0) {
  validTime(hours);
  const plan = flaskPlan(input), seconds = Math.min(FLASK.duration, hours * 3600);
  const index = Math.min(plan.samples.length - 2, Math.floor(seconds / FLASK.step)), a = plan.samples[index], b = plan.samples[index + 1];
  const fraction = clamp((seconds - a.t) / (b.t - a.t)), T = a.T + (b.T - a.T) * fraction;
  const paths = heatPaths(plan.values, T);
  const energy = Object.fromEntries(Object.keys(a.energy).map(key => [key, a.energy[key] + (b.energy[key] - a.energy[key]) * fraction]));
  return {...plan, hours: seconds / 3600, T, paths, energy, lost: plan.capacity * (plan.values.start - T), complete: seconds >= FLASK.duration};
}

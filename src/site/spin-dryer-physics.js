import {validateControls, validTime, clamp} from './physics-kit.js';

// Original teaching apparatus, SI units. The pore-volume distribution and
// drainage law are illustrative choices, not a fitted cotton/product model.
// Extraction and steady forced vibration are deliberately separate experiments.
export const SPIN = Object.freeze({
  g: 9.81, radius: .15, layer: .04, tubRadius: .185, eccentricity: .13,
  density: 1000, tension: .072, wetting: .9, pore: 5e-6, spread: 1.2,
  soaked: 1.5, residual: .45, drain: 15, reference: 1e5,
  ramp: 20, brakeStart: 180, duration: 200, steadyDuration: 12,
  movingMass: 25, spring: 4e4, dt: .02, every: 1,
  cycleSpeed: 6, cycleSlowdown: 2400, steadySlowdown: 200,
});
export const SPIN_DEFAULTS = Object.freeze({experiment: 0, rpm: 2800, load: 2, wall: 1, lid: 1, imbalance: .1, damping: .1});
export const SPIN_DOMAINS = Object.freeze({experiment: [0, 1, 1], rpm: [0, 3000, 50], load: [1, 4, .5], wall: [0, 1, 1], lid: [0, 1, 1], imbalance: [0, .3, .05], damping: [.05, .4, .05]});
export const EXPERIMENTS = [{value: 0, label: 'Spin and collect water'}, {value: 1, label: 'Steady vibration'}];
const TAU = 2 * Math.PI;
export const omegaOf = rpm => rpm * TAU / 60;
export const layerPressure = w => SPIN.density * w ** 2 * (SPIN.radius ** 2 - (SPIN.radius - SPIN.layer) ** 2) / 2;
export const holdingRadius = pressure => pressure > 0 ? 2 * SPIN.tension * SPIN.wetting / pressure : Infinity;
/** Standard normal CDF; absolute approximation error below 1.5e-7. */
export function normalShare(z) {
  const t = 1 / (1 + .2316419 * Math.abs(z)), d = Math.exp(-z * z / 2) / Math.sqrt(TAU);
  const tail = d * t * (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - tail : tail;
}
/** Synthetic pore-volume distribution: no universal fiber-bound fraction. */
export function equilibriumMoisture(w) {
  const radius = holdingRadius(layerPressure(w));
  const share = Number.isFinite(radius) ? normalShare(Math.log(radius / SPIN.pore) / SPIN.spread) : 1;
  return SPIN.residual + (SPIN.soaked - SPIN.residual) * share;
}
export const drainTime = w => w > 0 ? SPIN.drain * SPIN.reference / layerPressure(w) : Infinity;
/** Finite linear run-up and braking; no instantaneous stop. */
export function speedAt(rpm, time) {
  const top = omegaOf(rpm);
  if (time <= SPIN.ramp) return top * clamp(time / SPIN.ramp);
  if (time < SPIN.brakeStart) return top;
  return top * clamp((SPIN.duration - time) / (SPIN.duration - SPIN.brakeStart));
}
/** Exact integral of the prescribed angular speed, including braking. */
export function rotationAt(rpm, time) {
  const t = Math.min(SPIN.duration, Math.max(0, time)), w = omegaOf(rpm);
  if (t <= SPIN.ramp) return w * t * t / (2 * SPIN.ramp);
  if (t <= SPIN.brakeStart) return w * (t - SPIN.ramp / 2);
  const u = t - SPIN.brakeStart;
  return w * (SPIN.brakeStart - SPIN.ramp / 2 + u - u * u / (2 * (SPIN.duration - SPIN.brakeStart)));
}
/** Steady response to rotating imbalance, not response during a speed ramp.
 * M x'' + c x' + k x = m e w² cos(wt), with an identical quadrature axis.
 * The same slowed phase drives the eccentric marker and displacement. */
export function shaking(imbalance, w, damping = SPIN_DEFAULTS.damping) {
  const mass = SPIN.movingMass, k = SPIN.spring, c = 2 * damping * Math.sqrt(k * mass);
  const force = imbalance * SPIN.eccentricity * w * w, stiffness = k - mass * w * w;
  const natural = Math.sqrt(k / mass), peakW = natural / Math.sqrt(1 - 2 * damping ** 2);
  return {force, amplitude: force / Math.hypot(stiffness, c * w), lag: w > 0 ? Math.atan2(c * w, stiffness) : 0,
    natural, peakW, peakAmplitude: imbalance * SPIN.eccentricity / (2 * mass * damping * Math.sqrt(1 - damping ** 2)), dampingCoefficient: c};
}
/** Drop just outside a hole, with purely tangential exit speed. Ignore air drag
 * and radial exit speed. Gravity curves its vertical trajectory; its top-view
 * path is straight. Return position relative to the drum axis in meters. */
export function dropFlight(w, angle, age, height = 0) {
  const hitTime = w > 0 ? Math.sqrt(SPIN.tubRadius ** 2 - SPIN.radius ** 2) / (SPIN.radius * w) : Infinity;
  const t = Math.min(Math.max(0, age), hitTime), r = SPIN.radius;
  return {x: r * Math.cos(angle) - r * w * t * Math.sin(angle), y: height - SPIN.g * t * t / 2,
    z: -r * Math.sin(angle) - r * w * t * Math.cos(angle), hitTime, caught: age >= hitTime};
}
export const extractionRate = (moisture, w, open = true) => open && w > 0 ? Math.max(0, moisture - equilibriumMoisture(w)) / drainTime(w) : 0;
const cache = new Map();
export function spinPlan(input = {}) {
  const values = validateControls(input, SPIN_DEFAULTS, SPIN_DOMAINS, 'spin dryer'), key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const duration = values.experiment === 1 ? SPIN.steadyDuration : SPIN.duration;
  const count = Math.round(SPIN.duration / SPIN.dt), moisture = new Float64Array(count + 1);
  moisture[0] = SPIN.soaked;
  const enabled = values.lid === 1 && values.wall === 1 && values.experiment === 0;
  for (let i = 1; i <= count; i++) {
    const w = values.lid ? speedAt(values.rpm, (i - .5) * SPIN.dt) : 0, eq = equilibriumMoisture(w);
    moisture[i] = enabled && moisture[i - 1] > eq ? eq + (moisture[i - 1] - eq) * Math.exp(-SPIN.dt / drainTime(w)) : moisture[i - 1];
  }
  const plan = {values, duration, moisture, final: moisture[count], samples: []};
  for (let t = 0; t <= SPIN.duration; t += SPIN.every) plan.samples.push({t, moisture: moisture[Math.round(t / SPIN.dt)], collected: values.load * (SPIN.soaked - moisture[Math.round(t / SPIN.dt)])});
  if (cache.size >= 24) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}
export function sampleSpinPlan(plan, time = 0) {
  validTime(time);
  const v = plan.values, steady = v.experiment === 1, clock = Math.min(time, plan.duration);
  const w = v.lid ? steady ? omegaOf(v.rpm) : speedAt(v.rpm, clock) : 0;
  const index = Math.min(plan.moisture.length - 1, Math.floor(clock / SPIN.dt)), u = clock - index * SPIN.dt;
  let moisture = plan.moisture[index];
  // Integrate the fractional interval with the same exponential midpoint law.
  const midW = v.lid ? speedAt(v.rpm, index * SPIN.dt + u / 2) : 0, eq = equilibriumMoisture(midW);
  if (!steady && v.wall && v.lid && moisture > eq && u > 0) moisture = eq + (moisture - eq) * Math.exp(-u / drainTime(midW));
  const removed = v.load * (SPIN.soaked - moisture), retained = v.load * moisture;
  const shake = shaking(v.imbalance, w, v.damping);
  const angle = steady ? w * clock / SPIN.steadySlowdown : rotationAt(v.lid ? v.rpm : 0, clock) / SPIN.cycleSlowdown;
  const displacement = steady ? [shake.amplitude * Math.cos(angle - shake.lag), -shake.amplitude * Math.sin(angle - shake.lag)] : [0, 0];
  const blocked = v.lid === 0 ? 'Lid open: interlock prevents rotation' : v.rpm === 0 ? 'Zero speed: drum remains still' : !steady && v.wall === 0 ? 'Sealed drum: no exit for water' : '';
  const phase = blocked || (steady ? 'Steady vibration at fixed speed' : clock === 0 ? 'Ready to spin' : clock < SPIN.ramp ? 'Accelerating' : clock < SPIN.brakeStart ? 'Spinning and collecting' : clock < SPIN.duration ? 'Braking' : 'Stopped: collected water stays outside');
  return {values: v, clock, duration: plan.duration, complete: clock >= plan.duration, steady, phase, blocked,
    w, rpmNow: w * 60 / TAU, gForce: w * w * SPIN.radius / SPIN.g, angle, displacement, shake,
    moisture, retained, removed, initialWater: v.load * SPIN.soaked, rate: steady ? 0 : v.load * extractionRate(moisture, w, Boolean(v.lid && v.wall)),
    pressure: layerPressure(w), holding: holdingRadius(layerPressure(w)), equilibrium: equilibriumMoisture(w), final: plan.final};
}
export const sampleSpin = (input = {}, time = 0) => sampleSpinPlan(spinPlan(input), time);

import {validateControls, validTime} from './physics-kit.js';

// Rounded textbook reference properties, not a calibrated sample at one exact
// temperature. Equilibrium only; the explanation clock is not a filling time.
export const CAPILLARY = Object.freeze({gravity: 9.81, length: 220, wedgeWidth: 40, narrowGap: .1, wideGap: 1, duration: 6});
export const CAPILLARY_FLUIDS = Object.freeze([
  Object.freeze({name: 'Water', tension: .0728, density: 1000, angle: 0, color: 0x347ba3}),
  Object.freeze({name: 'Ethanol', tension: .0223, density: 790, angle: 0, color: 0x776697}),
  Object.freeze({name: 'Mercury', tension: .465, density: 13600, angle: 140, color: 0x7a8790}),
]);
export const CAPILLARY_DEFAULTS = Object.freeze({liquid: 0, radius: .2, depth: 15, wetting: 0});
export const CAPILLARY_DOMAINS = Object.freeze({liquid: [0, 2, 1], radius: [.1, .5, .05], depth: [5, 60, 5], wetting: [0, 3, 1]});
export const CAPILLARY_ANGLES = Object.freeze([null, 60, 90, 120]);
export const CAPILLARY_WETTING = Object.freeze([
  Object.freeze({value: 0, label: 'Reference liquid and glass'}),
  Object.freeze({value: 1, label: 'Assigned contact angle: 60°'}),
  Object.freeze({value: 2, label: 'Assigned contact angle: 90°'}),
  Object.freeze({value: 3, label: 'Assigned contact angle: 120°'}),
]);

/** Signed ideal height and pressure for a tube radius or parallel-plate gap. */
export function capillaryBalance(liquid, angle, sizeMm, depthMm) {
  const raw = Math.cos(angle * Math.PI / 180), cosine = Math.abs(raw) < 1e-12 ? 0 : raw;
  const pressure = 2 * liquid.tension * cosine / (sizeMm * .001);
  const height = pressure / (liquid.density * CAPILLARY.gravity) * 1000;
  const accessible = depthMm + height > 0;
  return {pressure, height, accessible, length: accessible ? depthMm + height : 0,
    liquidGauge: -pressure, entranceHead: liquid.density * CAPILLARY.gravity * depthMm * .001};
}

export function capillaryPlan(input = {}) {
  const values = validateControls(input, CAPILLARY_DEFAULTS, CAPILLARY_DOMAINS, 'capillary action');
  const liquid = CAPILLARY_FLUIDS[values.liquid], angle = CAPILLARY_ANGLES[values.wetting] ?? liquid.angle;
  const tube = capillaryBalance(liquid, angle, values.radius, values.depth);
  const capillaryLength = Math.sqrt(liquid.tension / (liquid.density * CAPILLARY.gravity)) * 1000;
  return Object.freeze({values, liquid, angle, tube, capillaryLength, duration: CAPILLARY.duration,
    radius: values.radius, depth: values.depth, height: tube.height, pull: tube.pressure,
    head: tube.entranceHead, enters: tube.accessible});
}

/** Guide stages leave the equilibrium geometry and physical readings unchanged. */
export function capillaryAt(plan, time) {
  const t = Math.min(plan.duration, validTime(time));
  return {t, stage: t === 0 ? 'ready' : t < 2 ? 'contact' : t < 4 ? 'pressure' : t < plan.duration ? 'height' : 'complete',
    done: t >= plan.duration, level: plan.tube.accessible ? plan.tube.height : null};
}
export const sampleCapillary = (input, time = 0) => capillaryAt(capillaryPlan(input), time);
export const capillaryGap = x => CAPILLARY.narrowGap + (CAPILLARY.wideGap - CAPILLARY.narrowGap) * x / CAPILLARY.wedgeWidth;
export const capillaryWedge = (plan, x) => capillaryBalance(plan.liquid, plan.angle, capillaryGap(x), plan.depth);

/** Spherical-cap reference: height relative to the wall contact, in millimeters.
 * This local small-Bond-number approximation neglects gravity across the cap.
 */
export function capillarySurface(angle, radius, radialPosition) {
  const cosine = Math.cos(angle * Math.PI / 180);
  if (Math.abs(cosine) < 1e-12) return 0;
  const R = radius / Math.abs(cosine), s = Math.max(0, Math.min(radius, radialPosition));
  const edge = Math.sqrt(Math.max(0, R * R - radius * radius));
  return -Math.sign(cosine) * (Math.sqrt(Math.max(0, R * R - s * s)) - edge);
}

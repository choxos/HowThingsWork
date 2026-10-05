import {validateControls, validTime} from './physics-kit.js';
import {CLOCKS, VR_DEFAULTS, VR_DOMAINS, vrPlan, vrAt} from './vr-headset-physics.js';

export const TRACKING_KEYS = Object.freeze(['motion', 'offset', 'scale', 'correction']);
export const TRACKING_DEFAULTS = Object.freeze(Object.fromEntries(TRACKING_KEYS.map(key => [key, VR_DEFAULTS[key]])));
export const TRACKING_DOMAINS = Object.freeze(Object.fromEntries(TRACKING_KEYS.map(key => [key, VR_DOMAINS[key]])));

/** The last completed 1 ms integration and correction. At stage zero the
 * registered direction is initialized, so no sample has been integrated yet. */
export function trackingStep(plan, time) {
  const now = vrAt(plan, validTime(time)), k = now.stage;
  const previous = plan.estimate[Math.max(0, k - 1)];
  const increment = k ? plan.gyro[k] / CLOCKS.gyro : 0;
  const integrated = previous + increment;
  const correction = k ? plan.alpha * (plan.camera[k] - integrated) : 0;
  const sampleTime = k / CLOCKS.gyro;
  return {time: now.t, stage: k, sampleTime, previous, rate: plan.gyro[k], increment,
    integrated, camera: plan.camera[k], cameraTime: now.imageTime,
    cameraAge: sampleTime - now.imageTime, alpha: plan.alpha, correction,
    estimate: plan.estimate[k], truth: plan.truth[k], error: plan.estimate[k] - plan.truth[k]};
}

export function sampleHeadTracking(input = {}, time = 0) {
  const values = validateControls(input, TRACKING_DEFAULTS, TRACKING_DOMAINS, 'head tracking');
  const plan = vrPlan(values);
  return {...plan, values, tracking: trackingStep(plan, time)};
}

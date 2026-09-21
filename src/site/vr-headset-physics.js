import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Virtual reality headset: head tracking, latency and the lenses, about one
// axis, the head's yaw.
//
// Tracking follows LaValle's Virtual Reality, chapter 9, section 9.1. The
// gyroscope is sampled 1,000 times a second, as the Oculus Rift's is and as an
// MPU-6050's can be, and reads ω̂ = a + bω (his equation 9.1): an offset a and
// a scale b, here the head's mean rate over each millisecond so that a perfect
// gyroscope adds up exactly. The estimate adds up the readings (9.9). A camera
// fixed in the room measures the true yaw 60 times a second; its latest image
// is held for 16 or 17 gyroscope stages, and a complementary filter blends it
// in with gain α (9.10), at every stage, into the estimate carried forward
// from the stage before, so that a small gain pulls the drift out slowly.
//
// Rendering follows chapters 6 and 7: a frame is started 90 times a second for
// the estimate at its start, and lights the display for 2 ms (low persistence)
// once the latency has passed. With prediction, the frame is drawn for the
// yaw expected when it lights, carried forward at the gyroscope's latest rate.
//
// The lenses follow chapter 4: a thin lens of 45 mm focal length, as in Google
// Cardboard, with the screen at or inside its focal length makes a virtual
// image (1/s1 + 1/s2 = 1/f). The eyes aim at the virtual object (vergence) and
// focus on the virtual image (accommodation); the difference in diopters is
// the vergence and accommodation conflict.
//
// Head motions: a smooth turn of 60° to the left in 1 s, or a shake of 25°
// each way in half-second swings, each swing a minimum-jerk blend.
//
// Not modeled: pitch, roll and position; the accelerometer's and the
// magnetometer's corrections; noise and quantization in the gyroscope; the
// camera's own errors and delay; scan-out; lens distortion.
// ---------------------------------------------------------------------------

export const CLOCKS = Object.freeze({gyro: 1000, camera: 60, frame: 90, flash: 0.002, duration: 3});
export const HEAD = Object.freeze({start: 0.5, turn: 60, turnTime: 1, swing: 25, swingTime: 0.5});
export const SHAKE = Object.freeze([0, HEAD.swing, -HEAD.swing, HEAD.swing, -HEAD.swing, 0]);
export const LENS = Object.freeze({focal: 45, relief: 15, halfView: 30, radius: 17, ipd: 63, comfort: 0.4});
export const GAINS = Object.freeze([0, 1e-4, 1e-2]);

const options = labels => Object.freeze(labels.map((label, value) => Object.freeze({value, label})));
export const MOTION_OPTIONS = options(['Turn to look left', 'Shake your head', 'Hold still']);
export const PREDICTION_OPTIONS = options(['No prediction', 'Predict ahead']);
export const CORRECTION_OPTIONS = options(['No correction', 'Camera, α = 0.0001', 'Camera, α = 0.01']);

export const VR_DEFAULTS = Object.freeze({motion: 0, latency: 20, prediction: 1, offset: 0, scale: 0, correction: 1, screen: 44, distance: 2});
export const VR_DOMAINS = Object.freeze({motion: [0, 2, 1], latency: [5, 100, 5], prediction: [0, 1, 1], offset: [-2, 2, 0.1], scale: [-3, 3, 0.5], correction: [0, 2, 1], screen: [41, 45, 0.1], distance: [0.3, 10, 0.1]});

/** The minimum-jerk blend from 0 to 1 at s in [0, 1]: its value and its first and second derivatives in s. */
export function minimumJerk(s) {
  if (s <= 0) return [0, 0, 0];
  if (s >= 1) return [1, 0, 0];
  return [s ** 3 * (10 + s * (6 * s - 15)), 30 * s * s * (1 - s) ** 2, 60 * s * (1 - s) * (1 - 2 * s)];
}

/** The head's true yaw at time t in seconds: degrees to the left, degrees per second and degrees per second squared. */
export function headYaw(motion, t) {
  let from = 0, to = 0, span = 1, begin = 0;
  if (motion === 0) [to, span, begin] = [HEAD.turn, HEAD.turnTime, HEAD.start];
  else if (motion === 1) {
    const swing = Math.floor((t - HEAD.start) / HEAD.swingTime);
    if (swing >= 0 && swing < SHAKE.length - 1) [from, to, span, begin] = [SHAKE[swing], SHAKE[swing + 1], HEAD.swingTime, HEAD.start + swing * HEAD.swingTime];
  }
  const [value, first, second] = minimumJerk((t - begin) / span), change = to - from;
  return {angle: from + change * value, rate: change / span * first, acceleration: change / span ** 2 * second};
}

const tracks = new Map();

/** The gyroscope's readings, the camera's images and the estimate at every stage, and every frame of the run. */
function track(values) {
  const key = [values.motion, values.latency, values.prediction, values.offset, values.scale, values.correction].join('|');
  if (tracks.has(key)) return tracks.get(key);
  const N = CLOCKS.duration * CLOCKS.gyro, scale = 1 + values.scale / 100, alpha = GAINS[values.correction];
  const truth = new Float64Array(N + 1), gyro = new Float64Array(N + 1), camera = new Float64Array(N + 1), estimate = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) truth[k] = headYaw(values.motion, k / CLOCKS.gyro).angle;
  gyro[0] = values.offset;
  camera[0] = estimate[0] = truth[0];
  let worstDrift = {stage: 0, value: 0};
  for (let k = 1; k <= N; k++) {
    gyro[k] = values.offset + scale * (truth[k] - truth[k - 1]) * CLOCKS.gyro;
    camera[k] = headYaw(values.motion, Math.floor(k * CLOCKS.camera / CLOCKS.gyro) / CLOCKS.camera).angle;
    estimate[k] = alpha * camera[k] + (1 - alpha) * (estimate[k - 1] + gyro[k] / CLOCKS.gyro);
    if (Math.abs(estimate[k] - truth[k]) > Math.abs(worstDrift.value)) worstDrift = {stage: k, value: estimate[k] - truth[k]};
  }

  const frames = [], latency = values.latency / 1000;
  for (let n = 0; ; n++) {
    const t = n / CLOCKS.frame, flash = t + latency;
    if (flash > CLOCKS.duration + 1e-12) break;
    const stage = Math.floor(n * CLOCKS.gyro / CLOCKS.frame), horizon = flash - stage / CLOCKS.gyro;
    const shown = estimate[stage] + (values.prediction ? gyro[stage] * horizon : 0), head = headYaw(values.motion, flash).angle;
    frames.push(Object.freeze({n, t, flash, stage, estimate: estimate[stage], rate: gyro[stage], horizon, shown, head, slip: shown - head}));
  }
  let worstSlip = frames[0];
  for (const frame of frames) if (Math.abs(frame.slip) > Math.abs(worstSlip.slip)) worstSlip = frame;
  let peakRate = 0;
  for (let k = 0; k <= N; k++) peakRate = Math.max(peakRate, Math.abs(headYaw(values.motion, k / CLOCKS.gyro).rate));

  const run = Object.freeze({N, alpha, scale, latency, truth, gyro, camera, estimate, frames: Object.freeze(frames), worstSlip, worstDrift, endDrift: estimate[N] - truth[N], peakRate});
  if (tracks.size > 24) tracks.delete(tracks.keys().next().value);
  tracks.set(key, run);
  return run;
}

/**
 * Where the lens puts the screen's virtual image: millimeters from the lens,
 * meters from the eye, and the focus it asks of the eye in diopters. With the
 * screen at the focal length the image is infinitely far: its distances are
 * null and its focus 0, so that every number in a state stays finite.
 */
export function lensImage(screen) {
  const power = 1 / screen - 1 / LENS.focal;
  if (power === 0) return {distance: null, fromEye: null, focus: 0, magnification: null};
  const distance = 1 / power, fromEye = (distance + LENS.relief) / 1000;
  return {distance, fromEye, focus: 1 / fromEye, magnification: distance / screen};
}

/** The tangent of the direction the eye sees a screen point in, per millimeter of the point's height, from the virtual image. */
export const viewSlope = screen => LENS.focal / (screen * LENS.focal + LENS.relief * (LENS.focal - screen));

/** A ray from the screen point at `height` that passes the pupil `pupil` millimeters off the axis: where it meets the lens and its slopes before and after. */
export function rayThrough(screen, height, pupil) {
  const r = LENS.relief, lens = (height * r / screen + pupil) / (1 + r / screen - r / LENS.focal), before = (lens - height) / screen;
  return {lens, before, after: before - lens / LENS.focal};
}

/** The eyes on a virtual object `distance` meters straight ahead, focused on the virtual image at `focus` diopters. */
export function eyesOn(distance, focus) {
  const aim = 1 / distance, conflict = Math.abs(aim - focus);
  return {
    aim, conflict, comfortable: conflict <= LENS.comfort + 1e-12,
    vergence: 2 * Math.atan(LENS.ipd / 2000 / distance), turn: Math.atan(LENS.ipd / 2000 / distance),
    near: 1 / (focus + LENS.comfort), far: focus > LENS.comfort ? 1 / (focus - LENS.comfort) : null,
  };
}

const plans = new Map();

export function vrPlan(input = {}) {
  const values = validateControls(input, VR_DEFAULTS, VR_DOMAINS, 'virtual reality headset');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const image = lensImage(values.screen), slope = viewSlope(values.screen);
  const plan = Object.freeze({
    values, ...track(values), image, slope, eyes: eyesOn(values.distance, image.focus),
    halfAngle: Math.atan(LENS.halfView * slope), duration: CLOCKS.duration,
  });
  if (plans.size > 24) plans.delete(plans.keys().next().value);
  plans.set(key, plan);
  return plan;
}

/** Everything the headset, the camera and the display are doing at `time` seconds into the run. */
export function vrAt(plan, time) {
  const t = Math.max(0, Math.min(plan.duration, time)), head = headYaw(plan.values.motion, t);
  const stage = Math.min(plan.N, Math.floor(t * CLOCKS.gyro + 1e-9)), image = Math.floor(stage * CLOCKS.camera / CLOCKS.gyro);
  const started = Math.min(plan.frames.length - 1, Math.floor(t * CLOCKS.frame + 1e-9)), lit = Math.floor((t - plan.latency) * CLOCKS.frame + 1e-9);
  const rendering = started >= 0 && started < plan.frames.length ? plan.frames[started] : null;
  const showing = lit >= 0 ? plan.frames[Math.min(lit, plan.frames.length - 1)] : null;
  return {
    t, head, stage, estimate: plan.estimate[stage], gyro: plan.gyro[stage], drift: plan.estimate[stage] - plan.truth[stage],
    image, imageTime: image / CLOCKS.camera, camera: plan.camera[stage], rendering, showing,
    flashing: Boolean(showing) && t < showing.flash + CLOCKS.flash - 1e-12,
  };
}

/** The plan and the moment `time` seconds into the run. */
export function sampleVr(input = {}, time = 0) {
  const plan = vrPlan(input);
  return {...plan, now: vrAt(plan, validTime(time))};
}

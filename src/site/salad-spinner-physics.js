import {validateControls, validTime, clamp} from './physics-kit.js';

// Salad spinner: a crank, an epicyclic gear, and a basket that spins water off.
//
// Units: SI inside (meters, kilograms, seconds, newtons). Readings convert.
//
// The gear. The crank turns the gear ring, 72 teeth. Three planet gears turn on
// pins fixed in the lid, so the carrier does not move, and they drive the sun
// gear in the middle. With the carrier held, the sun turns Zr/Zs times as fast
// as the ring and the other way round, and each planet turns Zr/Zp times as fast
// as the ring, the same way. Three planets fit evenly only when Zr + Zs divides
// by three. The sun drives the basket through a one-way clutch, so the basket
// can run on when the crank stops.
//
// The spin-up. While the clutch holds, the basket is geared to the crank, so
// the hand feels the basket's moment of inertia times the square of the ratio:
//   G^2 I dw/dt = F R - G tau(G w).
// The hand pushes with its whole force until the crank reaches the rate it is
// aiming for, then holds that rate with the torque it takes, never more than
// its limit.
//
// The coast. When the hand stops, the clutch lets go and only drag, and the
// brake if it is pressed, slow the basket:
//   I dW/dt = -(tau0 + c1 W + c2 W^2 + brake).
//
// The water. A drop of radius a on a leaf is held by surface tension along its
// contact line, about gamma (2a) (cos theta_r - cos theta_a). Spinning needs an
// inward force of its mass times W^2 r to keep it on its circle. For a
// hemispherical drop the two match at
//   a_c = sqrt(3 gamma dcos / (pi rho W^2 r)):
// bigger drops leave, smaller ones stay. The washed salad carries drops from
// 0.2 to 3 mm in radius, spread evenly in log size by volume, in a layer 70 to
// 110 mm from the axis. A drop that has left does not come back, so the water
// left depends on the fastest the basket has turned so far. One part in twenty
// of the water is a film on the leaves that no spinning throws off.
//
// Not modeled: how the film and water trapped in folds really vary, drops
// caught by other leaves on the way out, salad shifting as it spins, the
// inertia lost with the water, gear friction and backlash, and the air flow
// in the bowl.

export const SPINNER_DEFAULTS = Object.freeze({sun: 18, rate: 2.5, force: 10, crank: 4, load: 150, brake: 1});
export const SPINNER_DOMAINS = Object.freeze({sun: [12, 24, 6], rate: [0.5, 3, 0.25], force: [2, 20, 1], crank: [1, 8, 0.5], load: [50, 300, 25], brake: [0, 1, 1]});
export const SPINNER_CONSTANTS = Object.freeze({
  ringTeeth: 72, module: 0.8e-3, crankRadius: 0.045,
  basketRadius: 0.110, saladInner: 0.070, basketInertia: 1.4e-3, bowlRadius: 0.125,
  dragStatic: 3e-3, dragLinear: 6e-5, dragQuadratic: 4e-7, brakeTorque: 0.04,
  surfaceTension: 0.072, hysteresis: 0.3, waterDensity: 1000, dropMin: 0.2e-3, dropMax: 3e-3, filmShare: 0.05, waterPerSalad: 0.2,
  step: 5e-4, sampleEvery: 10, duration: 180,
});

const TAU = Math.PI * 2;
const C = SPINNER_CONSTANTS;

export const gearTeeth = sun => ({ring: C.ringTeeth, sun, planet: (C.ringTeeth - sun) / 2});
export const gearRatio = sun => C.ringTeeth / sun;

/** Drag torque on the basket at speed W, not counting the brake. */
export const dragTorque = W => W > 0 ? C.dragStatic + C.dragLinear * W + C.dragQuadratic * W * W : 0;

/** Radius of the smallest drop thrown off at distance r from the axis when turning at W. */
export function criticalDrop(W, r) {
  return W > 0 ? Math.sqrt(3 * C.surfaceTension * C.hysteresis / (Math.PI * C.waterDensity * W * W * r)) : Infinity;
}

/** Share of the water volume in drops smaller than a. */
export function volumeBelow(a) {
  return clamp(Math.log(a / C.dropMin) / Math.log(C.dropMax / C.dropMin));
}

/** Share of the salad's water still on it after turning at most W: the film, plus drops too small to leave, averaged over the salad layer by volume. */
export function waterLeftShare(W, layers = 64) {
  const r0 = C.saladInner, r1 = C.basketRadius;
  let sum = 0, weight = 0;
  for (let i = 0; i < layers; i++) {
    const r = r0 + (r1 - r0) * (i + 0.5) / layers;
    sum += r * volumeBelow(criticalDrop(W, r));
    weight += r;
  }
  return C.filmShare + (1 - C.filmShare) * sum / weight;
}

const cache = new Map();

/** The whole trial for one setting, integrated once and sampled every few milliseconds. */
export function spinnerPlan(input = {}) {
  const values = validateControls(input, SPINNER_DEFAULTS, SPINNER_DOMAINS, 'salad spinner');
  if ((C.ringTeeth + values.sun) % 3 !== 0) throw new RangeError('Three planets do not fit this sun');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);

  const G = gearRatio(values.sun), saladMass = values.load / 1000, water = saladMass * C.waterPerSalad;
  const inertia = C.basketInertia + (saladMass + water) * (C.saladInner ** 2 + C.basketRadius ** 2) / 2;
  const handTorque = values.force * C.crankRadius, target = values.rate * TAU, brake = values.brake ? C.brakeTorque : 0;
  const samples = [];
  let t = 0, w = 0, W = 0, crankAngle = 0, basketAngle = 0, handWork = 0, dragWork = 0, brakeWork = 0, fastest = 0, stoppedAt = null, heldFrom = null, reached = false;
  const steps = Math.round(C.duration / C.step);
  const record = (holding, torque) => samples.push({t, w, W, crankAngle, basketAngle, handWork, dragWork, brakeWork, fastest, holding, torque});
  record(false, 0);
  for (let n = 1; n <= steps; n++) {
    const dt = C.step;
    let torque = 0, holding = false;
    if (t < values.crank - 1e-12) {
      // Engaged: basket speed is G times crank speed.
      const hold = G * dragTorque(G * target);
      if (w >= target - 1e-12 && hold <= handTorque) {
        holding = true;
        torque = hold;
        w = target;
      } else {
        torque = handTorque;
        const accel = W0 => (handTorque - G * dragTorque(G * W0)) / (G * G * inertia);
        const k1 = accel(w), k2 = accel(w + 0.5 * dt * k1), k3 = accel(w + 0.5 * dt * k2), k4 = accel(w + dt * k3);
        const next = w + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
        if (next >= target && hold <= handTorque) { w = target; holding = true; } else w = Math.max(0, next);
      }
      const previousW = W;
      W = G * w;
      handWork += torque * w * dt;
      dragWork += dragTorque(0.5 * (previousW + W)) * 0.5 * (previousW + W) * dt;
      crankAngle += w * dt;
      basketAngle += W * dt;
      if (holding && heldFrom === null) heldFrom = t + dt;
      reached = reached || holding;
    } else {
      // The hand stops the crank; the clutch lets the basket run on.
      w = 0;
      if (W > 0) {
        const decel = V => (dragTorque(V) + brake) / inertia;
        const k1 = decel(W), k2 = decel(Math.max(0, W - 0.5 * dt * k1)), k3 = decel(Math.max(0, W - 0.5 * dt * k2)), k4 = decel(Math.max(0, W - dt * k3));
        const next = W - dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
        const mean = 0.5 * (W + Math.max(0, next));
        dragWork += dragTorque(mean) * mean * dt;
        brakeWork += brake * mean * dt;
        basketAngle += mean * dt;
        W = Math.max(0, next);
        if (W === 0) stoppedAt = t + dt;
      }
    }
    fastest = Math.max(fastest, W);
    t = n * dt;
    if (n % C.sampleEvery === 0) {
      record(holding, torque);
      if (stoppedAt !== null) break;
    }
  }
  const plan = {
    values, G, teeth: gearTeeth(values.sun), inertia, reflectedInertia: G * G * inertia, handTorque, target, brake, saladMass, water, samples,
    heldFrom, reached, stoppedAt, releaseTime: values.crank, holdTorque: G * dragTorque(G * target),
    topSpeed: samples.reduce((top, sample) => Math.max(top, sample.W), 0),
  };
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** The trial at a time: speeds, angles, energies and the water left. */
export function sampleSpinner(input = {}, time = 0) {
  validTime(time);
  const plan = spinnerPlan(input), elapsed = Math.min(C.duration, time), samples = plan.samples, spacing = C.step * C.sampleEvery;
  const index = Math.min(samples.length - 2, Math.floor(elapsed / spacing)), a = samples[index], b = samples[index + 1], f = clamp((elapsed - a.t) / (b.t - a.t));
  const mix = key => a[key] + (b[key] - a[key]) * f;
  const resting = plan.stoppedAt !== null && elapsed >= plan.stoppedAt, cranking = elapsed > 0 && elapsed < plan.values.crank;
  const W = resting ? 0 : mix('W'), w = cranking ? mix('w') : 0, fastest = Math.max(a.fastest, Math.min(b.fastest, Math.max(a.fastest, W)));
  const share = waterLeftShare(fastest), left = plan.water * share;
  const kinetic = 0.5 * plan.inertia * W * W;
  const mode = elapsed === 0 ? 'ready' : cranking ? (b.holding ? 'holding' : 'spinning up') : W > 0 ? (plan.brake ? 'braking' : 'coasting') : 'stopped';
  return {
    ...plan, elapsed, W, w, rpm: W * 60 / TAU, crankRate: w / TAU, planetRate: w * C.ringTeeth / plan.teeth.planet / TAU,
    crankAngle: mix('crankAngle'), basketAngle: mix('basketAngle'), handWork: mix('handWork'), dragWork: mix('dragWork'), brakeWork: mix('brakeWork'), kinetic,
    torque: cranking ? b.torque : 0, handForce: (cranking ? b.torque : 0) / C.crankRadius,
    fastest, waterShare: share, waterLeft: left, waterOff: plan.water - left, wallAcceleration: W * W * C.basketRadius,
    wallDrop: fastest > 0 ? criticalDrop(fastest, C.basketRadius) : null, innerDrop: fastest > 0 ? criticalDrop(fastest, C.saladInner) : null, mode,
    complete: plan.stoppedAt !== null && elapsed >= plan.stoppedAt,
  };
}

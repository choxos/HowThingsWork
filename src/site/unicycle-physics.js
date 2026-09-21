import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Unicycle: balancing forward and back by pedaling the wheel under a lean.
//
// The unicycle and its rider move in one vertical plane. The wheel rolls
// without slipping; the frame and the rider lean together as one rigid body
// about the wheel's axle. Lagrange's equations for the wheel angle φ and the
// lean θ (forward positive), with a torque τ from the legs on the wheel and
// −τ on the body, give
//   p φ̈ + q cos θ θ̈ − q sin θ θ̇² = τ
//   q cos θ φ̈ + s θ̈ − m g l sin θ = −τ
// with p = (2M + m) r², q = m r l, s = m l², a wheel of mass M carried at its
// rim and a rider of mass m at their center of mass, l above the axle.
//
// A rider's legs hold the cranks: they set how fast the cranks turn relative
// to the body, and the torque that takes follows from the equations above. It
// is capped at the rider's whole weight pushed at right angles to the crank,
// at every crank angle. Holding the cranks still, the unicycle and rider fall
// together as one body pivoting on the tire, e times further every 1/w
// seconds, w² = m g l / (p + 2q + s).
//
// The rider is a practiced one whose reflexes match the unicycle: the crank
// acceleration they ask for answers the lean, how fast it changes and how far
// their speed is from the speed they want, each as they sensed it one reaction
// delay ago, with strengths in units of w. Before the run the rider was
// upright and still, so a starting lean is noticed only after the delay; the
// speed they want is their own and acts at once.
//
// The rider's size is the mean of the 6,068 US Army personnel measured in
// ANSUR II (2012): 79.7 kg, crotch height 825 mm, trochanterion height 883 mm.
// Seated upright with legs straight to a pedal at the bottom, the saddle is at
// crotch height above that pedal and the center of mass 10 cm above the
// trochanter, as for a standing adult.
//
// The run takes fourth-order Runge-Kutta steps of half a millisecond, and at
// every stage the rider senses the state one delay earlier.
//
// Critical delays come from the D-subdivision of the linearized loop: the
// delays at which a root of λ³ − λ + B(λ) e^(−λτ) crosses the imaginary axis.
//
// Not modeled: balance from side to side and steering; dead spots, where a
// pedal pushed straight down turns a vertical crank not at all; the tire's
// squash and rolling resistance; the frame's and the cranks' own mass; the
// body bending; slipping.
// ---------------------------------------------------------------------------

export const GRAVITY = 9.81;
/** The mean ANSUR II adult, men and women together, and where the center of mass sits above the trochanter. */
export const RIDER = Object.freeze({mass: 79.7, inseam: 0.825, trochanter: 0.883, aboveTrochanter: 0.1});
export const WHEELS = Object.freeze([20, 24, 29, 36]);
export const WHEEL_MASS = 2;
export const SEATS = Object.freeze([null, 1.5, 2, 3.05]);
export const REFLEXES = Object.freeze({lean: 0.8, rate: 1.8, speed: 0.1});
export const RUN = Object.freeze({duration: 10, step: 0.0005, fall: 45});

const DEG = Math.PI / 180;
const options = labels => Object.freeze(labels.map((label, value) => Object.freeze({value, label})));
export const RIDER_OPTIONS = options(['Pedals to balance', 'Holds the cranks still']);
export const SEAT_OPTIONS = options(['Standard: legs straight at the bottom', 'Giraffe: saddle 1.5 m up', 'Giraffe: saddle 2.0 m up', 'Giraffe: saddle 3.05 m up']);
export const WHEEL_OPTIONS = options(WHEELS.map(inch => `${inch}-inch wheel`));

export const UNICYCLE_DEFAULTS = Object.freeze({rider: 0, lean: 3, speed: 0, delay: 190, seat: 0, wheel: 1, crank: 125});
export const UNICYCLE_DOMAINS = Object.freeze({rider: [0, 1, 1], lean: [0, 25, 1], speed: [0, 3, 0.1], delay: [0, 400, 10], seat: [0, 3, 1], wheel: [0, 3, 1], crank: [75, 170, 1]});

/** Everything about the unicycle and rider that the settings fix: sizes in meters, masses in kilograms. */
export function unicycleBody(values) {
  const r = WHEELS[values.wheel] * 0.0254 / 2, crank = values.crank / 1000, m = RIDER.mass;
  const standard = r - crank + RIDER.inseam, seat = SEATS[values.seat] ?? standard;
  const above = RIDER.trochanter + RIDER.aboveTrochanter - RIDER.inseam, height = seat + above, l = height - r;
  const p = (2 * WHEEL_MASS + m) * r * r, q = m * r * l, s = m * l * l, weight = m * GRAVITY, Gl = weight * l, J = p + 2 * q + s;
  const w = Math.sqrt(Gl / J), crankAxle = seat - RIDER.inseam + crank;
  return Object.freeze({
    r, crank, standard, seat, above, height, l, p, q, s, weight, Gl, J, w, b: (p + q) / J, rho: r / height,
    cap: weight * crank, crankAxle, giraffe: crankAxle > r + 1e-9, perTurn: 2 * Math.PI * r,
  });
}

/** The lean's and the wheel's angular accelerations, the legs' torque and the ground's push, for a crank acceleration u relative to the body. */
export function accelerations(body, lean, rate, u) {
  const c = Math.cos(lean), sn = Math.sin(lean), spin = body.q * sn * rate * rate;
  let lean2 = (body.Gl * sn + spin - (body.p + body.q * c) * u) / (body.p + 2 * body.q * c + body.s), wheel2 = u + lean2;
  let torque = body.p * wheel2 + body.q * c * lean2 - spin, clamped = false;
  if (Math.abs(torque) > body.cap) {
    torque = Math.sign(torque) * body.cap;
    clamped = true;
    const B = body.q * c, det = body.p * body.s - B * B, e = torque + spin, f = body.Gl * sn - torque;
    wheel2 = (e * body.s - B * f) / det;
    lean2 = (body.p * f - B * e) / det;
  }
  const m = RIDER.mass, ground = (WHEEL_MASS + m) * body.r * wheel2 + m * body.l * (c * lean2 - sn * rate * rate);
  return {lean2, wheel2, torque, clamped, ground};
}

/** The crank acceleration relative to the body that the rider's reflexes ask for, from what they sensed and the speed they want. */
export function reflex(body, sensed, goal, gains = REFLEXES) {
  const w = body.w;
  return w * w / body.b * ((1 + gains.lean) * (sensed.lean + gains.speed * (sensed.speed - goal) / (w * body.height)) + gains.rate * sensed.rate / w);
}

/**
 * The shortest reaction delay, in seconds, at which the linearized loop with
 * these reflexes stops returning to upright: the first crossing of the
 * imaginary axis by a root of λ³ − λ + B(λ) e^(−λτ), λ and τ in units of w.
 */
export function criticalDelay(body, gains = REFLEXES) {
  const A1 = 1 + gains.lean, kv = A1 * gains.speed, beta = (1 - body.b) / body.b;
  const C2 = gains.rate - body.rho * beta * kv, C0 = body.rho * kv / body.b;
  // |A(iΩ)|² = |B(iΩ)|² as a cubic in X = Ω².
  const coefficients = [1, 2 - C2 * C2, 1 + 2 * C0 * C2 - A1 * A1, -C0 * C0];
  const f = X => ((X + coefficients[1]) * X + coefficients[2]) * X + coefficients[3];
  // The cubic's turning points split (0, ∞) into stretches with at most one root each.
  const turning = [], disc = coefficients[1] ** 2 - 3 * coefficients[2];
  if (disc > 0) for (const sign of [-1, 1]) turning.push((-coefficients[1] + sign * Math.sqrt(disc)) / 3);
  const edges = [1e-12, ...turning.filter(X => X > 1e-12).sort((x, y) => x - y)];
  let top = 1;
  while (f(top) <= 0) top *= 2;
  edges.push(top);
  let best = Infinity;
  for (let i = 0; i + 1 < edges.length; i++) {
    let lo = edges[i], hi = edges[i + 1];
    if (Math.sign(f(lo)) === Math.sign(f(hi))) continue;
    for (let k = 0; k < 200 && hi - lo > 1e-15 * Math.max(1, hi); k++) {
      const mid = (lo + hi) / 2;
      if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid; else hi = mid;
    }
    const X = (lo + hi) / 2, W = Math.sqrt(X);
    const Ai = -W * (X + 1), Br = C0 - C2 * X, Bi = A1 * W;
    // −A/B with A = i·Ai.
    const re = -(Ai * Bi) / (Br * Br + Bi * Bi), im = -(Ai * Br) / (Br * Br + Bi * Bi);
    let tau = -Math.atan2(im, re);
    tau -= 2 * Math.PI * Math.floor(tau / (2 * Math.PI));
    best = Math.min(best, tau / W);
  }
  return best / body.w;
}

/** The longest delay that reflexes to the lean and its rate alone can approach but never reach: √2 / w. */
export const delayLimit = body => Math.SQRT2 / body.w;

const rides = new Map();

/** The whole run, one sample every half millisecond, and what it came to. */
function ride(values) {
  const key = [values.rider, values.lean, values.speed, values.delay, values.seat, values.wheel, values.crank].join('|');
  if (rides.has(key)) return rides.get(key);
  const body = unicycleBody(values), dt = RUN.step, N = Math.round(RUN.duration / dt), lag = Math.round(values.delay / 1000 / dt);
  const lean = new Float64Array(N + 1), rate = new Float64Array(N + 1), wheel = new Float64Array(N + 1), spin = new Float64Array(N + 1);
  const torque = new Float64Array(N + 1), ground = new Float64Array(N + 1), command = new Float64Array(N + 1), clamped = new Uint8Array(N + 1);
  let state = [values.lean * DEG, 0, 0, 0], fell = null;
  const derivative = ([th, dth, , dph], u) => { const a = accelerations(body, th, dth, u); return [dth, a.lean2, dph, a.wheel2]; };
  // What the rider senses at sample index x, whole or half way between two
  // samples: the state one delay earlier, upright and still before the run,
  // and half way along the line between two samples. The starting lean is
  // noticed at the start of a step, never at the end of the step before it.
  const senses = (x, stage, end) => {
    if (lag === 0) return {lean: stage[0], rate: stage[1], speed: stage[3] * body.r};
    const back = x - lag, j = Math.floor(back);
    if (back < 0 || (back === 0 && end)) return {lean: 0, rate: 0, speed: 0};
    if (back === j) return {lean: lean[j], rate: rate[j], speed: spin[j] * body.r};
    return {lean: (lean[j] + lean[j + 1]) / 2, rate: (rate[j] + rate[j + 1]) / 2, speed: (spin[j] + spin[j + 1]) / 2 * body.r};
  };
  const ask = (x, stage, end = false) => (values.rider === 1 ? 0 : reflex(body, senses(x, stage, end), values.speed));
  for (let k = 0; k <= N; k++) {
    [lean[k], rate[k], wheel[k], spin[k]] = state;
    if (fell !== null) continue;
    const u = ask(k, state), now = accelerations(body, state[0], state[1], u);
    command[k] = u;
    torque[k] = now.torque;
    ground[k] = now.ground;
    clamped[k] = now.clamped ? 1 : 0;
    if (k === N) break;
    const k1 = derivative(state, u), s2 = state.map((x, i) => x + dt / 2 * k1[i]), k2 = derivative(s2, ask(k + 0.5, s2));
    const s3 = state.map((x, i) => x + dt / 2 * k2[i]), k3 = derivative(s3, ask(k + 0.5, s3)), s4 = state.map((x, i) => x + dt * k3[i]), k4 = derivative(s4, ask(k + 1, s4, true));
    const next = state.map((x, i) => x + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    if (Math.abs(next[0]) >= RUN.fall * DEG) fell = (k + (RUN.fall * DEG - Math.abs(state[0])) / (Math.abs(next[0]) - Math.abs(state[0]))) * dt;
    state = next;
  }

  const last = fell === null ? N : Math.min(N, Math.ceil(fell / dt));
  let peak = 0, peakAt = 0, rollback = 0, peakTorque = 0, clampTime = 0;
  for (let k = 0; k <= last; k++) {
    if (Math.abs(lean[k]) > Math.abs(peak)) [peak, peakAt] = [lean[k], k * dt];
    rollback = Math.min(rollback, wheel[k] * body.r);
    peakTorque = Math.max(peakTorque, Math.abs(torque[k]));
    if (clamped[k] && k < last) clampTime += dt;
  }
  const run = Object.freeze({
    N, dt, lag, body, lean, rate, wheel, spin, torque, ground, command, clamped, fell,
    peakLean: peak / DEG, peakAt, rollback, peakTorque, clampTime,
    endTravel: wheel[N] * body.r, endSpeed: spin[N] * body.r, endLean: lean[N] / DEG, wheelTurns: wheel[N] / (2 * Math.PI),
  });
  if (rides.size > 24) rides.delete(rides.keys().next().value);
  rides.set(key, run);
  return run;
}

const plans = new Map();

export function unicyclePlan(input = {}) {
  const values = validateControls(input, UNICYCLE_DEFAULTS, UNICYCLE_DOMAINS, 'unicycle');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const run = ride(values);
  const plan = Object.freeze({values, ...run, critical: criticalDelay(run.body), limit: delayLimit(run.body), duration: RUN.duration});
  if (plans.size > 24) plans.delete(plans.keys().next().value);
  plans.set(key, plan);
  return plan;
}

/** The unicycle, the rider and the legs' push at `time` seconds into the run. */
export function unicycleAt(plan, time) {
  const t = Math.max(0, Math.min(plan.duration, time)), k = Math.min(plan.N, Math.floor(t / plan.dt + 1e-9)), j = k - plan.lag;
  const fallen = plan.fell !== null && t >= plan.fell;
  return {
    t, k, lean: plan.lean[k] / DEG, rate: plan.rate[k] / DEG, wheel: plan.wheel[k], crank: plan.wheel[k] - plan.lean[k],
    travel: plan.wheel[k] * plan.body.r, speed: plan.spin[k] * plan.body.r,
    torque: fallen ? 0 : plan.torque[k], ground: fallen ? 0 : plan.ground[k], clamped: !fallen && plan.clamped[k] === 1,
    sensed: plan.values.rider === 1 ? null : (j >= 0 ? plan.lean[j] / DEG : 0), fallen,
  };
}

/** The plan and the moment `time` seconds into the run. */
export function sampleUnicycle(input = {}, time = 0) {
  const plan = unicyclePlan(input);
  return {...plan, now: unicycleAt(plan, validTime(time))};
}

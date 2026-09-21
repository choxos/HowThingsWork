// Checks the unicycle against physics derived again here, not against itself.
//
// 1. The equations: Newton and Euler for the wheel and the rider, forces and
//    all, solved as one linear system at random states, against the Lagrange
//    accelerations the model uses; the reflex rule; the sizes and inertias.
// 2. Energy: along whole runs, the change in kinetic and potential energy,
//    worked out from the velocities, matches the work the legs do.
// 3. The runs integrated again, five times finer, with Newton and Euler, the
//    rider sensing continuously at every stage.
// 4. The fall: a held unicycle's lean grows as cosh(w t).
// 5. Critical delays found again by the Mikhailov phase criterion on the
//    loop linearized from Newton and Euler, for 48 unicycles, and runs just
//    either side; the lean-only ceiling approached over a grid of reflexes.
// 6. What the lessons say, every quoted number computed here.
// 7. The drawing held to the state: wheel, frame, cranks, pedals, legs, the
//    center of mass, both arrows, the ground marks and every chart point.
// 8. Controls, sampling, finiteness, refusals and disposal.

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {unicyclePlan, sampleUnicycle, unicycleBody, accelerations, reflex, criticalDelay, delayLimit, RIDER, WHEELS, WHEEL_MASS, SEATS, REFLEXES, RUN, GRAVITY, RIDER_OPTIONS, UNICYCLE_DEFAULTS, UNICYCLE_DOMAINS} from './unicycle-physics.js';
import {createUnicycleModel, M, SLOW, DRAW, GROUND, CHARTS} from './unicycle-model.js';
import {unicycleLesson} from './unicycle-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), DEG = Math.PI / 180, Z_AXIS = new THREE.Vector3(0, 0, 1);
/** What the sources say: ANSUR II's head counts and mean stature, a visual reaction, unicycle cranks and the tallest giraffe. */
const SOURCE = Object.freeze({men: 4082, women: 1986, stature: 1.714, visual: 190, indoor: 100, shortest: 79, mountain: 125, giraffe: 3.05, aboveTrochanter: 0.1});
const settings = values => ({...UNICYCLE_DEFAULTS, ...values});

t.ok(RIDER.aboveTrochanter === SOURCE.aboveTrochanter && SEATS[SEATS.length - 1] === SOURCE.giraffe && SEATS.slice(1).every((seat, i, list) => i === 0 || seat > list[i - 1]), 'the center of mass 10 cm above the trochanter, and giraffes up to 3.05 m');
t.ok(RUN.duration / RUN.step === Math.round(RUN.duration / RUN.step) && UNICYCLE_DOMAINS.delay[2] / 1000 / RUN.step === Math.round(UNICYCLE_DOMAINS.delay[2] / 1000 / RUN.step), 'every delay is a whole number of steps');

// ---------------------------------------------------------------------------
// 1. The equations.
// ---------------------------------------------------------------------------

/** Sizes worked out again: the wheel's radius, the saddle, the center of mass, the moment of inertia about the contact. */
function geometryOf(values) {
  const r = WHEELS[values.wheel] * 0.0254 / 2, c = values.crank / 1000, m = RIDER.mass, Mw = WHEEL_MASS, g = GRAVITY;
  const seat = values.seat === 0 ? r - c + RIDER.inseam : SEATS[values.seat], H = seat + RIDER.trochanter + RIDER.aboveTrochanter - RIDER.inseam, l = H - r;
  // About the contact point: a hoop of mass M (M r² about its center, plus M r²) and a point mass m at height H.
  const J = 2 * Mw * r * r + m * H * H, w = Math.sqrt(m * g * l / J), b = (2 * Mw * r * r + m * r * H) / J;
  return {r, c, m, Mw, g, seat, H, l, J, w, b, cap: m * g * c, crankAxle: seat - RIDER.inseam + c};
}

const A6 = new Float64Array(36), B6 = new Float64Array(6), X6 = new Float64Array(6);
function solve6(rows, rhs) {
  A6.set(rows);
  B6.set(rhs);
  for (let col = 0; col < 6; col++) {
    let pivot = col;
    for (let row = col + 1; row < 6; row++) if (Math.abs(A6[row * 6 + col]) > Math.abs(A6[pivot * 6 + col])) pivot = row;
    if (pivot !== col) {
      for (let k = 0; k < 6; k++) [A6[col * 6 + k], A6[pivot * 6 + k]] = [A6[pivot * 6 + k], A6[col * 6 + k]];
      [B6[col], B6[pivot]] = [B6[pivot], B6[col]];
    }
    for (let row = col + 1; row < 6; row++) {
      const f = A6[row * 6 + col] / A6[col * 6 + col];
      if (f === 0) continue;
      for (let k = col; k < 6; k++) A6[row * 6 + k] -= f * A6[col * 6 + k];
      B6[row] -= f * B6[col];
    }
  }
  for (let row = 5; row >= 0; row--) {
    let sum = B6[row];
    for (let k = row + 1; k < 6; k++) sum -= A6[row * 6 + k] * X6[k];
    X6[row] = sum / A6[row * 6 + row];
  }
  return [...X6];
}

/**
 * Newton and Euler. Unknowns: the wheel's and the lean's angular
 * accelerations, the legs' torque τ on the wheel, the ground's push F along
 * the ground, and the rider's push on the axle (−Ax, −Ay). The wheel: M r φ̈ =
 * F + Ax and M r² φ̈ = τ − r F. The rider, a point: m ẍ = −Ax, m ÿ = −Ay − m g,
 * and no net torque about itself, τ = l cos θ Ax − l sin θ Ay. Then either the
 * cranks turn at u relative to the body, or the legs give all they can.
 */
function newtonEuler(G, lean, rate, u) {
  const cos = Math.cos(lean), sin = Math.sin(lean), spin = rate * rate;
  const rows = [
    G.Mw * G.r, 0, 0, -1, -1, 0,
    G.Mw * G.r * G.r, 0, -1, G.r, 0, 0,
    G.m * G.r, G.m * G.l * cos, 0, 0, 1, 0,
    0, -G.m * G.l * sin, 0, 0, 0, 1,
    0, 0, -1, 0, G.l * cos, -G.l * sin,
  ];
  const rhs = [0, 0, G.m * G.l * sin * spin, G.m * G.l * cos * spin - G.m * G.g, 0];
  let x = solve6([...rows, 1, -1, 0, 0, 0, 0], [...rhs, u]), clamped = false;
  if (Math.abs(x[2]) > G.cap) {
    x = solve6([...rows, 0, 0, 1, 0, 0, 0], [...rhs, Math.sign(x[2]) * G.cap]);
    clamped = true;
  }
  return {wheel2: x[0], lean2: x[1], torque: x[2], ground: x[3], clamped};
}

const SAMPLES = [
  {}, {seat: 1}, {seat: 2}, {seat: 3}, {wheel: 0, crank: 75}, {wheel: 3, crank: 170}, {wheel: 2, seat: 2, crank: 100}, {crank: 79}, {wheel: 0, seat: 3},
].map(settings);
let random = 20260915;
const next = () => (random = (random * 1103515245 + 12345) % 2147483648) / 2147483648;
let statesSolved = 0;
for (const values of SAMPLES) {
  const body = unicycleBody(values), G = geometryOf(values);
  for (const key of ['r', 'seat', 'l', 'cap', 'crankAxle', 'w', 'b']) t.near(body[key === 'r' ? 'r' : key], G[key], 1e-12 * (1 + Math.abs(G[key])), `${key} worked out again`);
  t.near(body.height, G.H, 1e-12, 'the center of mass height');
  t.near(body.J, G.J, 1e-9, 'the moment of inertia about the contact point');
  t.near(body.crank, G.c, 1e-15, 'the crank length');
  t.near(body.perTurn, 2 * Math.PI * G.r, 1e-12, 'a turn of the cranks rolls the tire’s circumference');
  t.ok(body.giraffe === (values.seat > 0), 'only a taller saddle needs a chain');
  t.near(body.standard - (body.r - body.crank), RIDER.inseam, 1e-12, 'a standard saddle is a leg’s length above the lowest pedal');
  for (let i = 0; i < 2500; i++) {
    const lean = (2 * next() - 1) * 60 * DEG, rate = (2 * next() - 1) * 300 * DEG, u = (2 * next() - 1) * 250;
    const a = accelerations(body, lean, rate, u), e = newtonEuler(G, lean, rate, u);
    for (const key of ['wheel2', 'lean2', 'torque', 'ground']) t.near(a[key], e[key], 1e-8 * (1 + Math.abs(e[key])), `${key} at a random state`);
    t.ok(a.clamped === e.clamped, 'the legs reach their limit at the same states');
    t.ok(Math.abs(a.torque) <= G.cap * (1 + 1e-12), 'never more than the rider’s weight on the crank');
    const sensed = {lean: (2 * next() - 1) * 20 * DEG, rate: (2 * next() - 1) * 60 * DEG, speed: 4 * next() - 1}, goal = 3 * next();
    const expected = G.w * G.w / G.b * ((1 + REFLEXES.lean) * (sensed.lean + REFLEXES.speed * (sensed.speed - goal) / (G.w * G.H)) + REFLEXES.rate * sensed.rate / G.w);
    t.near(reflex(body, sensed, goal), expected, 1e-9 * (1 + Math.abs(expected)), 'the reflex rule as the header states it');
    statesSolved++;
  }
  // Pedaling the cranks forward speeds the wheel forward and pitches the rider back.
  const push = newtonEuler(G, 0, 0, 1);
  t.ok(push.wheel2 > 0 && push.lean2 < 0, 'the same torque speeds the wheel and turns the body back');
}
// Tall pendulums fall more slowly.
for (let wheel = 0; wheel < WHEELS.length; wheel++) {
  const rates = SEATS.map((_, seat) => geometryOf(settings({wheel, seat})).w);
  t.ok(rates.every((w, i) => i === 0 || w < rates[i - 1]), 'the taller the saddle, the slower the fall');
}

// ---------------------------------------------------------------------------
// 2. Energy.
// ---------------------------------------------------------------------------

const energy = (G, lean, rate, spin) => {
  const vx = G.r * spin + G.l * Math.cos(lean) * rate, vy = -G.l * Math.sin(lean) * rate;
  return 0.5 * G.Mw * (G.r * spin) ** 2 + 0.5 * G.Mw * G.r * G.r * spin * spin + 0.5 * G.m * (vx * vx + vy * vy) + G.m * G.g * (G.r + G.l * Math.cos(lean));
};
let energySteps = 0;
for (const values of [{}, {rider: 1}, {lean: 0, speed: 1.5}, {delay: 300, seat: 3}, {lean: 0, speed: 3, wheel: 3}].map(settings)) {
  const plan = unicyclePlan(values), G = geometryOf(values), last = plan.fell === null ? plan.N : Math.floor(plan.fell / plan.dt) - 1;
  const start = energy(G, plan.lean[0], plan.rate[0], plan.spin[0]);
  let work = 0, worst = 0;
  for (let k = 0; k < last; k++) {
    const end = newtonEuler(G, plan.lean[k + 1], plan.rate[k + 1], plan.command[k + 1]);
    t.ok(!plan.clamped[k] && !end.clamped, 'these runs stay within the legs’ limit');
    work += (plan.torque[k] * (plan.spin[k] - plan.rate[k]) + end.torque * (plan.spin[k + 1] - plan.rate[k + 1])) / 2 * plan.dt;
    worst = Math.max(worst, Math.abs(energy(G, plan.lean[k + 1], plan.rate[k + 1], plan.spin[k + 1]) - start - work));
    energySteps++;
  }
  t.ok(worst < 1e-4, `energy gained is the legs’ work, to ${worst.toExponential(1)} J`);
}

// ---------------------------------------------------------------------------
// 3. The runs integrated again.
// ---------------------------------------------------------------------------

const fineCache = new Map();
/**
 * A run five times finer, Newton and Euler at every stage. The rider senses
 * continuously: at each stage the state one delay earlier comes from the fine
 * history, and half way between two samples from the cubic through their
 * values and rates.
 */
function fineRide(input) {
  const values = settings(input), key = JSON.stringify(values);
  if (fineCache.has(key)) return fineCache.get(key);
  const G = geometryOf(values), sub = 5, coarse = RUN.step, dt = coarse / sub, steps = Math.round(RUN.duration / dt), samples = steps / sub;
  const lag = Math.round(values.delay / 1000 / dt);
  const out = {lean: new Float64Array(samples + 1), rate: new Float64Array(samples + 1), wheel: new Float64Array(samples + 1), spin: new Float64Array(samples + 1), torque: new Float64Array(samples + 1), clamped: new Uint8Array(samples + 1)};
  const history = {lean: new Float64Array(steps + 1), rate: new Float64Array(steps + 1), spin: new Float64Array(steps + 1)};
  const senses = (x, stage, end) => {
    if (lag === 0) return [stage[0], stage[1], stage[3] * G.r];
    const back = x - lag;
    // The starting lean arrives with a jump, noticed from the start of a step on.
    if (back < 0 || (back === 0 && end)) return [0, 0, 0];
    const j = Math.floor(back);
    if (back === j) return [history.lean[j], history.rate[j], history.spin[j] * G.r];
    return [(history.lean[j] + history.lean[j + 1]) / 2 + dt * (history.rate[j] - history.rate[j + 1]) / 8, (history.rate[j] + history.rate[j + 1]) / 2, (history.spin[j] + history.spin[j + 1]) / 2 * G.r];
  };
  const ask = (x, stage, end = false) => {
    if (values.rider === 1) return 0;
    const [lean, rate, speed] = senses(x, stage, end);
    return G.w * G.w / G.b * ((1 + REFLEXES.lean) * (lean + REFLEXES.speed * (speed - values.speed) / (G.w * G.H)) + REFLEXES.rate * rate / G.w);
  };
  const f = (stage, u) => { const a = newtonEuler(G, stage[0], stage[1], u); return [stage[1], a.lean2, stage[3], a.wheel2]; };
  let s = [values.lean * DEG, 0, 0, 0], fell = null;
  for (let i = 0; i <= steps; i++) {
    const onSample = i % sub === 0, j = i / sub;
    [history.lean[i], history.rate[i], history.spin[i]] = [s[0], s[1], s[3]];
    if (onSample) [out.lean[j], out.rate[j], out.wheel[j], out.spin[j]] = s;
    if (fell !== null) continue;
    const u0 = ask(i, s);
    if (onSample) { const a = newtonEuler(G, s[0], s[1], u0); out.torque[j] = a.torque; out.clamped[j] = a.clamped ? 1 : 0; }
    if (i === steps) break;
    const k1 = f(s, u0), s2 = s.map((x, n) => x + dt / 2 * k1[n]), k2 = f(s2, ask(i + 0.5, s2));
    const s3 = s.map((x, n) => x + dt / 2 * k2[n]), k3 = f(s3, ask(i + 0.5, s3)), s4 = s.map((x, n) => x + dt * k3[n]), k4 = f(s4, ask(i + 1, s4, true));
    const after = s.map((x, n) => x + dt / 6 * (k1[n] + 2 * k2[n] + 2 * k3[n] + k4[n]));
    if (Math.abs(after[0]) >= RUN.fall * DEG) fell = (i + (RUN.fall * DEG - Math.abs(s[0])) / (Math.abs(after[0]) - Math.abs(s[0]))) * dt;
    s = after;
  }
  const last = fell === null ? samples : Math.min(samples, Math.ceil(fell / coarse));
  let peak = 0, rollback = 0, peakTorque = 0, clampTime = 0;
  for (let k = 0; k <= last; k++) {
    if (Math.abs(out.lean[k]) > Math.abs(peak)) peak = out.lean[k];
    rollback = Math.min(rollback, out.wheel[k] * G.r);
    peakTorque = Math.max(peakTorque, Math.abs(out.torque[k]));
    if (out.clamped[k] && k < last) clampTime += coarse;
  }
  const run = {...out, G, values, fell, peakLean: peak / DEG, rollback, peakTorque, clampTime, endTravel: out.wheel[samples] * G.r, endSpeed: out.spin[samples] * G.r, endLean: out.lean[samples] / DEG, turns: out.wheel[samples] / (2 * Math.PI)};
  fineCache.set(key, run);
  return run;
}

const RUNS = [...unicycleLesson.tryIt.map(trial => trial.values), settings({seat: 1, wheel: 0, crank: 170}), settings({seat: 2, wheel: 2, lean: 10}), settings({lean: 0, speed: 3, wheel: 3}), settings({delay: 0, lean: 8})];
let runsAgain = 0;
const agreement = [];
for (const values of RUNS) {
  const plan = unicyclePlan(values), fine = fineRide(values), falls = plan.fell !== null;
  const until = falls ? Math.floor(Math.min(plan.fell, fine.fell ?? Infinity) / plan.dt) - 1 : plan.N;
  let worst = 0;
  for (let k = 0; k <= until; k++) worst = Math.max(worst, Math.abs(plan.lean[k] - fine.lean[k]), Math.abs(plan.wheel[k] - fine.wheel[k]) * fine.G.r);
  agreement.push(worst);
  t.ok(worst < (falls ? 1e-3 : 1e-5), `${JSON.stringify(values)}: the run integrated again agrees to ${worst.toExponential(1)}`);
  t.ok(falls === (fine.fell !== null), 'falls or stays up either way');
  if (falls) {
    t.near(plan.fell, fine.fell, 2e-3, 'the moment of the fall');
    const step = Math.floor(plan.fell / plan.dt + 1e-12), before = Math.abs(plan.lean[step]), after = Math.abs(plan.lean[step + 1]), edge = RUN.fall * DEG;
    t.ok(before < edge && after >= edge, 'the lean crosses the fall line within the step the fall is timed in');
    t.near(plan.fell, (step + (edge - before) / (after - before)) * plan.dt, 1e-12, 'the fall timed where the lean crosses the line, between samples');
  } else {
    t.near(plan.peakLean, fine.peakLean, 1e-3, 'the largest lean');
    t.near(plan.rollback, fine.rollback, 1e-5, 'the roll back');
    t.near(plan.endTravel, fine.endTravel, 1e-4, 'the distance rolled');
  }
  t.near(plan.peakTorque, fine.peakTorque, 1e-2, 'the hardest push');
  t.near(plan.clampTime, fine.clampTime, 2 * RUN.step, 'time at the legs’ limit');
  runsAgain++;
}

// ---------------------------------------------------------------------------
// 4. The fall of a held unicycle.
// ---------------------------------------------------------------------------

{
  const values = settings({rider: 1, lean: 1}), plan = unicyclePlan(values), G = geometryOf(values);
  let sum = 0, count = 0;
  for (let k = 400; k <= plan.N; k += 50) {
    if (plan.lean[k] > 2.5 * DEG) break;
    sum += Math.acosh(plan.lean[k] / plan.lean[0]) / (k * plan.dt);
    count++;
  }
  t.ok(count > 10, 'enough of the fall to fit');
  t.near(sum / count, G.w, 0.002 * G.w, 'a held unicycle’s lean grows as cosh(w t), w² = m g l / J about the contact');
}

// ---------------------------------------------------------------------------
// 5. Critical delays.
// ---------------------------------------------------------------------------

/** The loop linearized about upright from Newton and Euler: θ̈ = aT θ + aU u, φ̈ = bT θ + bU u. */
function linearized(values) {
  const G = geometryOf(values), eps = 1e-7, rest = newtonEuler(G, 0, 0, 0), tipped = newtonEuler(G, eps, 0, 0), pushed = newtonEuler(G, 0, 0, 1);
  return {G, aT: (tipped.lean2 - rest.lean2) / eps, aU: pushed.lean2 - rest.lean2, bT: (tipped.wheel2 - rest.wheel2) / eps, bU: pushed.wheel2 - rest.wheel2};
}

/** The loop's characteristic function divided by λ, with u = e^(−λτ)(kT θ + kR θ̇ + kV r φ̇). */
function loopFunction(lin, tau, re, im) {
  const {G, aT, aU, bT, bU} = lin, k = G.w * G.w / G.b;
  const kT = k * (1 + REFLEXES.lean), kR = k * REFLEXES.rate / G.w, kV = k * (1 + REFLEXES.lean) * REFLEXES.speed / (G.w * G.H) * G.r;
  const eMag = Math.exp(-re * tau), eRe = eMag * Math.cos(-im * tau), eIm = eMag * Math.sin(-im * tau);
  const l2Re = re * re - im * im, l2Im = 2 * re * im;
  const pRe = kT + kR * re, pIm = kR * im, stRe = eRe * pRe - eIm * pIm, stIm = eRe * pIm + eIm * pRe;
  const spRe = kV * (eRe * re - eIm * im), spIm = kV * (eRe * im + eIm * re);
  const m11Re = l2Re - aT - aU * stRe, m11Im = l2Im - aU * stIm, m12Re = -aU * spRe, m12Im = -aU * spIm;
  const m21Re = -bT - bU * stRe, m21Im = -bU * stIm, m22Re = l2Re - bU * spRe, m22Im = l2Im - bU * spIm;
  const dRe = m11Re * m22Re - m11Im * m22Im - (m12Re * m21Re - m12Im * m21Im), dIm = m11Re * m22Im + m11Im * m22Re - (m12Re * m21Im + m12Im * m21Re);
  const n = re * re + im * im;
  return [(dRe * re + dIm * im) / n, (dIm * re - dRe * im) / n];
}

/** Mikhailov: no roots with positive real part when the phase turns by 3·π/2 from Ω = 0 up, starting positive. */
function loopStable(lin, tau) {
  const eps = 1e-6, begin = loopFunction(lin, tau, 0, eps);
  if (!(begin[0] > 0)) return false;
  let previous = Math.atan2(begin[1], begin[0]), turn = 0;
  for (let i = 1, N = 16000; i <= N; i++) {
    const q = loopFunction(lin, tau, 0, eps + 400 * (i / N) ** 2), angle = Math.atan2(q[1], q[0]);
    let step = angle - previous;
    step -= 2 * Math.PI * Math.round(step / (2 * Math.PI));
    turn += step;
    previous = angle;
  }
  return Math.abs(turn / (Math.PI / 2) - 3) < 0.3;
}

const criticalCache = new Map();
function criticalAgain(values) {
  const key = JSON.stringify([values.seat, values.wheel, values.crank]);
  if (criticalCache.has(key)) return criticalCache.get(key);
  const lin = linearized(values);
  assert.ok(loopStable(lin, 0), 'stable with no delay');
  let lo = 0, hi = 0.01;
  while (loopStable(lin, hi)) { lo = hi; hi += 0.01; assert.ok(hi < 2, 'a critical delay exists'); }
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (loopStable(lin, mid)) lo = mid; else hi = mid; }
  criticalCache.set(key, (lo + hi) / 2);
  return (lo + hi) / 2;
}

let criticals = 0;
for (const seat of [0, 1, 2, 3]) for (const wheel of [0, 1, 2, 3]) for (const crank of [75, 125, 170]) {
  const values = settings({seat, wheel, crank}), again = criticalAgain(values), body = unicycleBody(values);
  t.near(criticalDelay(body), again, 3e-4, `seat ${seat}, wheel ${wheel}, crank ${crank}: the critical delay found again`);
  t.near(delayLimit(body), Math.SQRT2 / geometryOf(values).w, 1e-12, 'the lean-only ceiling, √2 / w');
  t.ok(again < delayLimit(body), 'these reflexes stay under the ceiling');
  criticals++;
}

// Runs just either side of three critical delays. Swings to one side and to
// the other can differ in size, so each swing is compared with the one two
// before it, to the same side.
const swingsOf = (run, dt, from) => {
  const sizes = [], end = run.fell === null ? run.lean.length - 1 : Math.floor(run.fell / dt);
  for (let k = 1; k < end; k++) if (Math.sign(run.rate[k]) !== Math.sign(run.rate[k - 1]) && k * dt > from) sizes.push(Math.abs(run.lean[k]));
  return sizes;
};
const shrinking = sizes => sizes.length >= 4 && sizes.every((size, i) => i < 2 || size < sizes[i - 2]);
const growing = sizes => sizes.length >= 4 && sizes.every((size, i) => i < 2 || size > sizes[i - 2]);
for (const [values, below, above] of [[{lean: 1}, 250, 270], [{lean: 1, wheel: 3}, 290, 300], [{lean: 1, seat: 3}, 380, 390]]) {
  const critical = criticalAgain(settings(values)) * 1000;
  t.ok(below < critical && critical < above, `${below} ms < ${critical.toFixed(1)} ms < ${above} ms`);
  const calm = unicyclePlan({...values, delay: below}), wild = unicyclePlan({...values, delay: above});
  t.ok(calm.fell === null && shrinking(swingsOf(calm, calm.dt, 4)), 'just under the critical delay every swing is smaller than the last one to that side');
  t.ok(wild.fell === null && growing(swingsOf(wild, wild.dt, 4)), 'just over it every swing is larger');
}

// Reflexes to the lean and its rate alone: λ² − 1 + ((1 + a) + c λ) e^(−λτ), in units of w.
const leanOnly = (a, c) => { const X = ((c * c - 2) + Math.sqrt((c * c - 2) ** 2 + 4 * ((1 + a) ** 2 - 1))) / 2, W = Math.sqrt(X); return Math.atan2(c * W, 1 + a) / W; };
function leanOnlyStable(a, c, tau) {
  const value = W => { const eRe = Math.cos(W * tau), eIm = -Math.sin(W * tau), pRe = 1 + a, pIm = c * W; return [-W * W - 1 + eRe * pRe - eIm * pIm, eRe * pIm + eIm * pRe]; };
  const begin = value(0);
  if (!(begin[0] > 0)) return false;
  let previous = Math.atan2(begin[1], begin[0]), turn = 0;
  for (let i = 1, N = 20000; i <= N; i++) {
    const q = value(60 * (i / N) ** 2), angle = Math.atan2(q[1], q[0]);
    let step = angle - previous;
    step -= 2 * Math.PI * Math.round(step / (2 * Math.PI));
    turn += step;
    previous = angle;
  }
  return Math.abs(turn / (Math.PI / 2) - 2) < 0.3;
}
for (const [a, c] of [[0.8, 1.8], [0.3, 1.2], [1e-4, 1.4143], [2, 0.5]]) {
  const tau = leanOnly(a, c);
  t.ok(leanOnlyStable(a, c, 0.99 * tau) && !leanOnlyStable(a, c, 1.01 * tau), `lean-only reflexes ${a}, ${c}: the crossing at ${tau.toFixed(4)} found both ways`);
}
let ceiling = 0;
for (const a of [1e-4, 1e-3, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 4]) for (let c = 0.2; c <= 4.0001; c += 0.0025) {
  const tau = leanOnly(a, c);
  t.ok(tau < Math.SQRT2, 'no lean-only reflexes reach √2');
  ceiling = Math.max(ceiling, tau);
}
t.ok(ceiling > 0.99 * Math.SQRT2, `but they come within ${((1 - ceiling / Math.SQRT2) * 100).toFixed(2)}% of it`);

// ---------------------------------------------------------------------------
// 6. What the lessons say.
// ---------------------------------------------------------------------------

const trialRun = values => ({plan: unicyclePlan(values), fine: fineRide(values)});
const same = (value, again, digits, label) => { assert.equal(fixed(value, digits), fixed(again, digits), label); t.add(); };
const ms = seconds => seconds * 1000;
const claims = {
  'Hold the cranks still': ({plan, fine}, trial) => {
    assert.ok(fine.fell !== null);
    same(plan.fell, fine.fell, 2, 'the fall, as the model shows it');
    return {[fixed(trial.values.lean, 0)]: trial.values.lean, [fixed(1 / fine.G.w, 2)]: 1 / fine.G.w, [fixed(RUN.fall, 0)]: RUN.fall, [fixed(fine.fell, 2)]: fine.fell};
  },
  'Pedal under the lean': ({plan, fine}, trial) => {
    assert.ok(fine.fell === null && Math.abs(fine.endLean) < 0.005 && Math.abs(plan.endLean) < 0.005, 'ends upright');
    same(plan.peakLean, fine.peakLean, 2, 'the largest lean');
    same(plan.endTravel, fine.endTravel, 2, 'the distance rolled');
    return {[fixed(trial.values.delay, 0)]: trial.values.delay, [fixed(fine.peakLean, 2)]: fine.peakLean, [fixed(fine.endTravel, 2)]: fine.endTravel};
  },
  'React more slowly': ({plan, fine}, trial) => {
    // A slowly growing swing makes the moment of the fall sensitive to how often the rider senses, so it is quoted to a tenth of a second.
    assert.ok(fine.fell !== null);
    same(plan.fell, fine.fell, 1, 'the fall');
    assert.ok(growing(swingsOf(fine, RUN.step, 0.5)), 'the swings grow');
    const critical = criticalAgain(trial.values);
    same(ms(plan.critical), ms(critical), 0, 'the critical delay, as the model reports it');
    return {[fixed(ms(critical), 0)]: ms(critical), [fixed(trial.values.delay, 0)]: trial.values.delay, [fixed(fine.fell, 1)]: fine.fell};
  },
  'A giraffe': ({plan, fine}, trial) => {
    assert.ok(fine.fell === null && trial.values.seat === SEATS.length - 1, 'stays up, on the tallest saddle');
    same(plan.peakLean, fine.peakLean, 2, 'the largest lean');
    const critical = criticalAgain(trial.values);
    return {[fixed(SEATS[trial.values.seat], 2)]: SEATS[trial.values.seat], [fixed(fine.G.H, 2)]: fine.G.H, [fixed(1 / fine.G.w, 2)]: 1 / fine.G.w, [fixed(ms(critical), 0)]: ms(critical), [fixed(fine.peakLean, 2)]: fine.peakLean};
  },
  'A hard shove': ({plan, fine}, trial) => {
    assert.ok(fine.fell !== null && fine.clampTime > 0.3, 'held at the limit, then falls');
    same(plan.fell, fine.fell, 2, 'the fall');
    return {[fixed(trial.values.crank, 0)]: trial.values.crank, [fixed(fine.G.cap, 1)]: fine.G.cap, [fixed(fine.fell, 2)]: fine.fell};
  },
  'Longer cranks': ({plan, fine}) => {
    assert.ok(fine.fell === null && fine.clampTime === 0, 'recovers within the limit');
    same(plan.peakTorque, fine.peakTorque, 1, 'the hardest push');
    same(plan.peakLean, fine.peakLean, 2, 'the largest lean');
    return {[fixed(fine.G.cap, 1)]: fine.G.cap, [fixed(fine.peakTorque, 1)]: fine.peakTorque, [fixed(fine.peakLean, 2)]: fine.peakLean};
  },
  'Ride off': ({plan, fine}, trial) => {
    assert.ok(fine.fell === null && Math.abs(fine.endSpeed - trial.values.speed) < 0.005, 'reaches the speed wanted');
    same(-plan.rollback * 100, -fine.rollback * 100, 1, 'the roll back');
    same(plan.peakLean, fine.peakLean, 2, 'the largest lean');
    return {[fixed(-fine.rollback * 100, 1)]: -fine.rollback * 100, [fixed(fine.peakLean, 2)]: fine.peakLean, [fixed(trial.values.speed, 1)]: trial.values.speed};
  },
  'A bigger wheel': ({plan, fine}, trial) => {
    const smaller = fineRide({...trial.values, wheel: 1});
    assert.ok(trial.values.wheel === WHEELS.length - 1 && fine.fell === null && smaller.fell === null, 'the biggest wheel');
    same(plan.wheelTurns, fine.turns, 2, 'the turns');
    same(unicyclePlan({...trial.values, wheel: 1}).wheelTurns, smaller.turns, 2, 'the turns on a 24-inch wheel');
    return {[fixed(WHEELS[trial.values.wheel], 0)]: WHEELS[trial.values.wheel], [fixed(2 * Math.PI * fine.G.r, 3)]: 2 * Math.PI * fine.G.r, [fixed(WHEELS[1], 0)]: WHEELS[1], [fixed(2 * Math.PI * smaller.G.r, 3)]: 2 * Math.PI * smaller.G.r, [fixed(RUN.duration, 0)]: RUN.duration, [fixed(fine.turns, 2)]: fine.turns, [fixed(smaller.turns, 2)]: smaller.turns};
  },
};
checkTrialNumbers(unicycleLesson, claims, trialRun, t);
t.ok(unicycleLesson.tryIt[0].instruction.includes(RIDER_OPTIONS[1].label) && unicycleLesson.tryIt[1].instruction.includes(RIDER_OPTIONS[0].label), 'the instructions name the rider’s options');

const standard = geometryOf(settings({})), giraffe = geometryOf(settings({seat: 3})), weight = RIDER.mass * GRAVITY;
const defaultRun = fineRide({}), rideOff = fineRide({lean: 0, speed: 1.5}), limit = Math.SQRT2 / standard.w;
checkQuotedText(unicycleLesson.steps.map(step => step.body).join(' '), {[`${fixed(standard.H, 2)} m above the ground`]: '1.16 m above the ground'}, t);
checkQuotedText(unicycleLesson.deeper.map(item => item.body).join(' '), {
  [`every ${fixed(1 / standard.w, 2)} s on a standard unicycle`]: 'every 0.40 s on a standard unicycle',
  [`every ${fixed(1 / giraffe.w, 2)} s on a giraffe with its saddle ${fixed(SOURCE.giraffe, 2)} m up`]: 'every 0.60 s on a giraffe with its saddle 3.05 m up',
  [`whole weight, ${fixed(weight, 0)} N, gives ${fixed(weight * 0.079, 1)} N·m on a ${fixed(79, 0)} mm crank and ${fixed(weight * 0.125, 1)} N·m on a ${fixed(125, 0)} mm one`]: 'whole weight, 782 N, gives 61.8 N·m on a 79 mm crank and 97.7 N·m on a 125 mm one',
  [`commonly use ${fixed(SOURCE.indoor, 0)} mm cranks, some as short as ${fixed(SOURCE.shortest, 0)} mm, while mountain riders use cranks longer than ${fixed(SOURCE.mountain, 0)} mm`]: 'commonly use 100 mm cranks, some as short as 79 mm, while mountain riders use cranks longer than 125 mm',
  [`takes about ${fixed(SOURCE.visual, 0)} ms`]: 'takes about 190 ms',
  [`delays under ${fixed(ms(criticalAgain(settings({}))), 0)} ms`]: 'delays under 260 ms',
  [`a delay of ${fixed(ms(limit), 0)} ms or more`]: 'a delay of 568 ms or more',
}, t);
checkQuotedText(unicycleLesson.quiz.explanation, {[`rolled back ${fixed(-rideOff.rollback * 100, 1)} cm`]: 'rolled back 5.2 cm'}, t);
checkQuotedText(unicycleLesson.limits, {
  [`${fixed(RIDER.mass, 1)} kg`]: '79.7 kg', [`crotch height of ${fixed(RIDER.inseam * 1000, 0)} mm`]: 'crotch height of 825 mm', [`trochanterion height of ${fixed(RIDER.trochanter * 1000, 0)} mm`]: 'trochanterion height of 883 mm',
  [`the ${fixed(SOURCE.men + SOURCE.women, 0)} US Army personnel`]: 'the 6,068 US Army personnel', [`${fixed(RIDER.aboveTrochanter * 100, 0)} cm above the trochanter`]: '10 cm above the trochanter',
  [`a ${fixed(WHEEL_MASS, 0)} kg wheel`]: 'a 2 kg wheel', [`a lean of ${fixed(RUN.fall, 0)}°`]: 'a lean of 45°', [`plays at ${['', 'full', 'half'][SLOW]} speed`]: 'plays at half speed',
}, t);

// ---------------------------------------------------------------------------
// 7. The drawing.
// ---------------------------------------------------------------------------

const model = createUnicycleModel(), topo = model.topology, root = model.root;
const describe = id => model.parts.find(item => item.id === id).description;
checkQuotedText(describe('ground'), {[`a mark every ${fixed(GROUND.tick, 1)} m`]: 'a mark every 0.5 m'}, t);
checkQuotedText(describe('wheel'), {[`${WHEELS.slice(0, -1).join(', ')} or ${WHEELS[WHEELS.length - 1]} inches across`]: '20, 24, 29 or 36 inches across'}, t);
checkQuotedText(describe('rider'), {[`the ${fixed(SOURCE.men + SOURCE.women, 0)} US Army personnel`]: 'the 6,068 US Army personnel', [`${fixed(RIDER.mass, 1)} kg, legs ${fixed(RIDER.inseam * 1000, 0)} mm`]: '79.7 kg, legs 825 mm'}, t);
checkQuotedText(describe('center'), {[`${fixed((standard.H - standard.seat) * 1000, 0)} mm above the saddle`]: '158 mm above the saddle'}, t);
checkQuotedText(describe('push'), {[`${fixed(DRAW.perNewton * 1000, 0)} m long for every 1,000 N`]: '1 m long for every 1,000 N'}, t);
checkQuotedText(describe('lean'), {[`the ${fixed(RUN.duration, 0)} s run, from ${fixed(CHARTS.lean.range, 0)}° back`]: 'the 10 s run, from 20° back', [`to ${fixed(CHARTS.lean.range, 0)}° forward`]: 'to 20° forward'}, t);
checkQuotedText(describe('speed'), {[`from ${fixed(-CHARTS.speed.v0, 0)} m/s backward`]: 'from 1 m/s backward', [`to ${fixed(CHARTS.speed.v1, 0)} m/s forward`]: 'to 3 m/s forward'}, t);
checkQuotedText(describe('torque'), {[`${fixed(CHARTS.torque.range, 0)} N·m either way`]: '150 N·m either way'}, t);

const rootTurn = new THREE.Quaternion();
const toGround = vector => root.worldToLocal(vector).divideScalar(M);
const placeOf = object => toGround(object.getWorldPosition(new THREE.Vector3()));
const endsOf = mesh => [0.5, -0.5].map(y => toGround(new THREE.Vector3(0, y, 0).applyMatrix4(mesh.matrixWorld)));
const pointsOf = line => {
  if (!line.visible) return [];
  const array = line.geometry.attributes.position.array, count = Math.min(array.length / 3, line.geometry.drawRange.count), out = [];
  for (let i = 0; i < count; i++) out.push(toGround(new THREE.Vector3(array[3 * i], array[3 * i + 1], array[3 * i + 2]).applyMatrix4(line.matrixWorld)));
  return out;
};
const TOL = 3e-5;
const at = (point, [x, y, z], label, tolerance = TOL) => { t.near(point.x, x, tolerance, `${label}: x`); t.near(point.y, y, tolerance, `${label}: y`); t.near(point.z, z, tolerance, `${label}: z`); };
const turn = ([x, y], angle) => { const v = new THREE.Vector3(x, y, 0).applyAxisAngle(Z_AXIS, angle); return [v.x, v.y]; };

function kneeAgain(hip, foot, forward) {
  const half = RIDER.inseam / 2, dx = foot[0] - hip[0], dy = foot[1] - hip[1], d = Math.hypot(dx, dy);
  if (d >= 2 * half - 1e-12) return [hip[0] + dx / d * half, hip[1] + dy / d * half];
  const along = d / 2, across = Math.sqrt(half * half - along * along), mx = hip[0] + dx / d * along, my = hip[1] + dy / d * along, nx = -dy / d, ny = dx / d;
  const one = [mx + nx * across, my + ny * across], two = [mx - nx * across, my - ny * across];
  const ahead = point => (point[0] - hip[0]) * forward[0] + (point[1] - hip[1]) * forward[1];
  return ahead(one) >= ahead(two) ? one : two;
}

const chartXAgain = (box, time) => box.x + time / RUN.duration * box.w;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const leanYAgain = degrees => CHARTS.lean.y + CHARTS.lean.h * (0.5 + clamp(degrees, -CHARTS.lean.range, CHARTS.lean.range) / (2 * CHARTS.lean.range));
const speedYAgain = speed => CHARTS.speed.y + CHARTS.speed.h * (clamp(speed, CHARTS.speed.v0, CHARTS.speed.v1) - CHARTS.speed.v0) / (CHARTS.speed.v1 - CHARTS.speed.v0);
const torqueYAgain = torque => CHARTS.torque.y + CHARTS.torque.h * (0.5 + clamp(torque, -CHARTS.torque.range, CHARTS.torque.range) / (2 * CHARTS.torque.range));

const DRAWN = [...RUNS];
const TIMES = [0, 0.1, 0.19, 0.35, 0.9, 1.36, 2, 4.86, 7.5, 10];
let moments = 0;
for (const values of DRAWN) {
  const plan = unicyclePlan(values), G = geometryOf(values);
  model.reset();
  model.update(values);
  root.updateMatrixWorld(true);
  root.getWorldQuaternion(rootTurn).invert();

  // The charts, which change only with the settings.
  const last = plan.fell === null ? plan.N : Math.min(plan.N, Math.floor(plan.fell / plan.dt)), shown = Math.floor(last / CHARTS.every) + 1;
  const series = (line, box, y) => {
    const points = pointsOf(line);
    assert.equal(points.length, shown, 'one chart point every 10 ms until the run ends');
    points.forEach((point, i) => at(point, [chartXAgain(box, i * CHARTS.every * plan.dt), y(i * CHARTS.every), CHARTS.z], 'chart point'));
  };
  series(topo.leanLine, CHARTS.lean, k => leanYAgain(plan.lean[k] / DEG));
  if (values.rider === 1) t.ok(pointsOf(topo.sensedLine).length === 0, 'no noticed lean for a rider who holds still');
  else series(topo.sensedLine, CHARTS.lean, k => leanYAgain(k >= plan.lag ? plan.lean[k - plan.lag] / DEG : 0));
  series(topo.speedLine, CHARTS.speed, k => speedYAgain(plan.spin[k] * G.r));
  series(topo.torqueLine, CHARTS.torque, k => torqueYAgain(plan.torque[k]));
  pointsOf(topo.goalLine).forEach((point, i) => at(point, [CHARTS.speed.x + i * CHARTS.speed.w, speedYAgain(values.speed), CHARTS.z], 'the speed wanted'));
  const caps = pointsOf(topo.capLines);
  [[0, G.cap], [CHARTS.torque.w, G.cap], [0, -G.cap], [CHARTS.torque.w, -G.cap]].forEach(([dx, torque], i) => at(caps[i], [CHARTS.torque.x + dx, torqueYAgain(torque), CHARTS.z], 'the legs’ limit'));

  // Sizes that do not move.
  topo.wheels.forEach((group, i) => t.ok(group.visible === (i === values.wheel), 'only the chosen wheel is shown'));
  const tire = topo.wheels[values.wheel].children[0].geometry.parameters;
  t.near((tire.radius + tire.tube) / M, G.r, 1e-12, 'the tire drawn at true size');
  t.ok(topo.bearing.visible === (values.seat > 0) && topo.sprockets.every(ring => ring.visible === (values.seat > 0)) && (pointsOf(topo.chain).length > 0) === (values.seat > 0), 'a chain only on a giraffe');

  for (const time of TIMES) {
    model.reset();
    model.update(values);
    model.playback.advance(time * SLOW);
    root.updateMatrixWorld(true);
    const state = model.getState(), k = Math.min(plan.N, Math.floor(time / plan.dt + 1e-9)), fallen = plan.fell !== null && time >= plan.fell;
    t.near(state.clock, time, 1e-12, 'the clock');
    const theta = plan.lean[k], phi = plan.wheel[k], travel = phi * G.r;
    const ground = ([x, y]) => { const [gx, gy] = turn([x, y], -theta); return [gx, gy + G.r]; };

    // The wheel turns about its axle: follow the red valve.
    const rim = G.r - 2 * DRAW.tire - DRAW.rim, valve = turn([0, rim - DRAW.valve], -phi);
    at(placeOf(topo.wheels[values.wheel].children[topo.wheels[values.wheel].children.length - 1]), [valve[0], valve[1] + G.r, 0.02], 'the valve');

    // The frame leans with the rider.
    const top = G.seat - G.r, crown = Math.min(DRAW.crown, top - 0.15), saddle = ground([0.02, top - DRAW.saddle[1] / 2]);
    at(placeOf(topo.saddle), [saddle[0], saddle[1], 0], 'the saddle');
    topo.forks.forEach((fork, i) => {
      const z = (i ? -1 : 1) * DRAW.fork, [upper, lower] = endsOf(fork);
      at(upper, [...ground([0, crown]), z], 'the fork crown');
      at(lower, [...ground([0, 0]), z], 'the fork at the axle');
    });
    const [postTop, postBottom] = endsOf(topo.post);
    at(postTop, [...ground([0, top - DRAW.saddle[1]]), 0], 'the seat post top');
    at(postBottom, [...ground([0, crown]), 0], 'the seat post bottom');
    const head = ground([0, top + (SOURCE.stature - RIDER.inseam) - DRAW.head]);
    at(placeOf(topo.head), [head[0], head[1], 0], 'the head, its top a seated stature above the saddle');

    // The cranks turn with the wheel, one turn for one turn.
    const hub = ground([0, G.crankAxle - G.r]), direction = turn([1, 0], -phi);
    const pedals = [1, -1].map(side => [hub[0] + side * G.c * direction[0], hub[1] + side * G.c * direction[1]]);
    topo.crankArms.forEach((arm, i) => {
      const side = i ? -1 : 1, [outer, inner] = endsOf(arm);
      at(outer, [...pedals[i], side * DRAW.crankZ], 'the crank’s pedal end');
      at(inner, [...hub, side * DRAW.crankZ], 'the crank at its axle');
    });
    topo.pedals.forEach((pedal, i) => {
      at(placeOf(pedal), [...pedals[i], (i ? -1 : 1) * DRAW.pedalZ], 'the pedal');
      const flat = new THREE.Vector3(1, 0, 0).applyQuaternion(pedal.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootTurn);
      t.near(flat.y, 0, 1e-9, 'pedals stay level');
    });

    // The legs from the hips to the pedals, knees forward.
    const hip = ground([0, top]), forward = turn([1, 0], -theta);
    topo.legs.forEach(([thigh, shin], i) => {
      const side = i ? -1 : 1, knee = kneeAgain(hip, pedals[i], forward), [kneeTop, hipEnd] = endsOf(thigh), [footEnd, kneeBottom] = endsOf(shin);
      at(hipEnd, [...hip, side * DRAW.legZ], 'the hip');
      at(kneeTop, [...knee, side * DRAW.legZ], 'the knee, from the thigh');
      at(kneeBottom, [...knee, side * DRAW.legZ], 'the knee, from the shin');
      at(footEnd, [...pedals[i], side * DRAW.pedalZ], 'the foot on its pedal');
      t.near(Math.hypot(knee[0] - hip[0], knee[1] - hip[1]), RIDER.inseam / 2, 1e-9, 'a thigh half a leg long');
    });

    // The center of mass, the pendulum and what the rider has noticed.
    const com = ground([0, G.l]);
    at(placeOf(topo.centerRing), [...com, DRAW.centerZ], 'the center of mass');
    const pendulum = pointsOf(topo.pendulum);
    at(pendulum[0], [0, 0, DRAW.centerZ], 'the pendulum at the contact');
    at(pendulum[1], [...com, DRAW.centerZ], 'the pendulum at the center of mass');
    const noticed = pointsOf(topo.noticed);
    if (values.rider === 1) t.ok(noticed.length === 0, 'nothing noticed by a rider who holds still');
    else {
      const seenLean = k >= plan.lag ? plan.lean[k - plan.lag] : 0, [sx, sy] = turn([0, G.l], -seenLean);
      at(noticed[1], [sx, sy + G.r, DRAW.centerZ], 'the noticed lean');
    }

    // The foot's push and the ground's push, on one scale.
    const sensed = k >= plan.lag ? [plan.lean[k - plan.lag], plan.rate[k - plan.lag], plan.spin[k - plan.lag] * G.r] : [0, 0, 0];
    const u = values.rider === 1 ? 0 : G.w * G.w / G.b * ((1 + REFLEXES.lean) * (sensed[0] + REFLEXES.speed * (sensed[1 + 1] - values.speed) / (G.w * G.H)) + REFLEXES.rate * sensed[1] / G.w);
    if (!fallen) t.near(plan.command[k], u, 1e-9 * (1 + Math.abs(u)), 'the command the reflexes give');
    const forces = fallen ? {torque: 0, ground: 0} : newtonEuler(G, theta, plan.rate[k], u);
    const pushes = pedals.map(pedal => { const o = [pedal[0] - hub[0], pedal[1] - hub[1]], sign = forces.torque < 0 ? -1 : 1; return [sign * o[1] / G.c, -sign * o[0] / G.c]; });
    const pick = pushes[0][1] <= 0 ? 0 : 1, length = Math.abs(forces.torque) / G.c * DRAW.perNewton;
    t.near(topo.pedalArrow.userData.length, length * M, 1e-9 + 1e-7 * length, 'the foot’s push: 1 m for 1,000 N');
    if (length > 1e-6) {
      at(placeOf(topo.pedalArrow), [pedals[pick][0] - pushes[pick][0] * length, pedals[pick][1] - pushes[pick][1] * length, DRAW.arrowZ], 'the push ends on the pushed pedal');
      const pointing = new THREE.Vector3(0, 1, 0).applyQuaternion(topo.pedalArrow.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootTurn);
      t.near(pointing.x, pushes[pick][0], 1e-6, 'pushed at right angles to the crank: x');
      t.near(pointing.y, pushes[pick][1], 1e-6, 'pushed at right angles to the crank: y');
      t.ok(pointing.y <= 1e-9, 'the drawn foot pushes down, not up');
    } else t.ok(!topo.pedalArrow.visible, 'no push, no arrow');
    const shove = Math.abs(forces.ground) * DRAW.perNewton;
    t.near(topo.groundArrow.userData.length, shove * M, 1e-9 + 1e-7 * shove, 'the ground’s push on the same scale');
    if (shove > 1e-6) {
      const sign = forces.ground < 0 ? -1 : 1, along = new THREE.Vector3(0, 1, 0).applyQuaternion(topo.groundArrow.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootTurn);
      at(placeOf(topo.groundArrow), [-sign * shove, DRAW.groundY, DRAW.groundZ], 'the ground’s push ends at the tire');
      t.near(along.x, sign, 1e-6, 'the ground’s push points the way it pushes');
      t.near(along.y, 0, 1e-6, 'the ground’s push lies along the ground');
    }

    // The ground's marks, and where the tire started.
    const ticks = pointsOf(topo.groundTicks).filter((_, i) => i % 2 === 0).map(point => point.x).sort((x, y) => x - y), expected = [];
    for (let n = -20; n <= 200; n++) { const x = n * GROUND.tick - travel; if (x >= GROUND.from - 1e-9 && x <= GROUND.to + 1e-9) expected.push(x); }
    if (Math.abs(travel) < 200 * GROUND.tick) {
      assert.equal(ticks.length, expected.length, 'every mark on the visible ground');
      ticks.forEach((x, i) => t.near(x, expected[i], TOL, 'a ground mark'));
    }
    const start = pointsOf(topo.startMark);
    if (-travel >= GROUND.from && -travel <= GROUND.to) at(start[0], [-travel, 0, 0], 'where the tire started');
    else t.ok(start.length === 0, 'the start off the visible ground');

    // The cursors.
    for (const [cursor, box] of [[topo.leanCursor, CHARTS.lean], [topo.speedCursor, CHARTS.speed], [topo.torqueCursor, CHARTS.torque]]) {
      const [lower, upper] = pointsOf(cursor);
      at(lower, [chartXAgain(box, time), box.y, CHARTS.z], 'a cursor');
      at(upper, [chartXAgain(box, time), box.y + box.h, CHARTS.z], 'a cursor');
    }
    moments++;
  }
}

// A leg reaches a pedal at the bottom exactly straight, on every saddle.
for (const values of SAMPLES) {
  const G = geometryOf(values);
  t.near(G.seat - (G.crankAxle - G.c), RIDER.inseam, 1e-12, 'a straight leg to the lowest pedal');
}

// ---------------------------------------------------------------------------
// 8. Readings, controls, sampling, refusals and disposal.
// ---------------------------------------------------------------------------

model.reset();
model.playback.advance(RUN.duration * SLOW);
t.ok(model.playback.complete(), 'the run completes');
const hints = () => Object.fromEntries(model.getState().readings.map(item => [item.label, `${item.value} ${item.hint || ''}`]));
let words = hints();
checkQuotedText(words['Your result'], {[`leaned at most ${fixed(defaultRun.peakLean, 2)}° and rolled ${fixed(defaultRun.endTravel, 2)} m`]: 'leaned at most 3.72° and rolled 0.61 m'}, t);
checkQuotedText(words['Lean'], {[`every ${fixed(1 / standard.w, 2)} s`]: 'every 0.40 s', [`${fixed(standard.H, 2)} m up`]: '1.16 m up'}, t);
checkQuotedText(words['Rider'], {[`sensed ${fixed(UNICYCLE_DEFAULTS.delay, 0)} ms ago`]: 'sensed 190 ms ago', [`delays under ${fixed(ms(criticalAgain(settings({}))), 0)} ms`]: 'delays under 260 ms', [`a delay of ${fixed(ms(limit), 0)} ms or more`]: 'a delay of 568 ms or more', [`about ${fixed(SOURCE.visual, 0)} ms`]: 'about 190 ms'}, t);
checkQuotedText(words['Pedals'], {[`weight, ${fixed(weight, 0)} N, at right angles to a ${fixed(125, 0)} mm crank`]: 'weight, 782 N, at right angles to a 125 mm crank', [`took ${fixed(defaultRun.peakTorque, 1)} N·m`]: 'took 12.3 N·m', [`at most ${fixed(standard.cap, 1)} N·m`]: 'at most 97.7 N·m'}, t);
checkQuotedText(words['Wheel'], {[`A ${fixed(24, 0)}-inch wheel rolls ${fixed(2 * Math.PI * standard.r, 3)} m`]: 'A 24-inch wheel rolls 1.915 m', [`turn ${fixed(16 / 3.6 / (2 * Math.PI * standard.r) * 60, 0)} times a minute`]: 'turn 139 times a minute'}, t);
checkQuotedText(words['Unicycle'], {[`${fixed((standard.H - standard.seat) * 1000, 0)} mm above the saddle, ${fixed(standard.H, 2)} m above the ground`]: '158 mm above the saddle, 1.16 m above the ground', [`saddle ${fixed(standard.seat, 2)} m up`]: 'saddle 1.00 m up'}, t);
model.reset();
model.update({lean: 0, speed: 1.5});
model.playback.advance(RUN.duration * SLOW);
words = hints();
checkQuotedText(words['Wheel'], {[`first rolled back ${fixed(-rideOff.rollback * 100, 1)} cm`]: 'first rolled back 5.2 cm'}, t);
model.reset();
model.update({delay: 300});
model.playback.advance(RUN.duration * SLOW);
words = hints();
const slow = fineRide({delay: 300});
checkQuotedText(words['Your result'], {[`Fell ${fixed(slow.fell, 2)} s in, leaning past ${fixed(RUN.fall, 0)}°`]: 'Fell 4.87 s in, leaning past 45°'}, t);
t.ok(words['Pedals'].includes(`at their limit for ${fixed(ms(unicyclePlan(settings({delay: 300})).clampTime), 0)} ms`) && Math.abs(slow.clampTime - unicyclePlan(settings({delay: 300})).clampTime) <= 1.5 * RUN.step, 'the time at the legs’ limit, as integrated again');
t.ok(words['Rider'].startsWith('Rider Could not catch the lean') || words['Rider'].startsWith('Could not catch the lean'), 'a fallen rider could not catch the lean');
model.reset();
t.ok(hints()['Your result'].startsWith('Ready · pedals to balance; press Play'), 'ready at the start');

const snapshot = () => JSON.stringify({
  turns: [topo.wheel.rotation.z, topo.body.rotation.z, topo.cranks.rotation.z, topo.cranks.position.y, topo.saddle.position.y],
  wheels: topo.wheels.map(group => group.visible),
  places: [topo.centerRing, topo.pedalArrow, topo.groundArrow, topo.head].map(object => object.position.toArray()),
  lengths: [topo.pedalArrow.userData.length, topo.groundArrow.userData.length, ...topo.legs.flat().map(mesh => mesh.scale.y), ...topo.crankArms.map(mesh => mesh.scale.y)],
  lines: [topo.leanLine, topo.sensedLine, topo.speedLine, topo.torqueLine, topo.goalLine, topo.capLines, topo.groundTicks].map(line => [line.visible, line.geometry.drawRange.count, ...line.geometry.attributes.position.array.slice(0, 60)]),
});
checkControlsMove(model, snapshot, m => m.playback.advance(0.8 * SLOW), t);
for (const time of [0, 3, 10, 25]) t.near(sampleUnicycle({}, time).now.t, Math.min(RUN.duration, time), 1e-12, 'sampling clamps to the run');
model.reset();
model.update({lean: 25, crank: 75, wheel: 3, seat: 2, delay: 400});
model.playback.advance(RUN.duration * SLOW);
checkFinite(model.root, t);
checkRefusals(sampleUnicycle, UNICYCLE_DOMAINS, t);
const resources = checkDisposal(model, t);

console.log(`PASS unicycle: ${t.count} checks, ${statesSolved} states solved by Newton and Euler, ${energySteps} steps of energy balanced, ${runsAgain} runs integrated again, ${criticals} critical delays found again, ${moments} drawn moments, ${unicycleLesson.tryIt.length} trials, ${resources} resources released exactly once.`);

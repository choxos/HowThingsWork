import assert from 'node:assert/strict';
import {OSCILLATOR as C, OSCILLATOR_DEFAULTS as D, oscillatorPlan, oscillatorEnvelope, sampleOscillator} from './quartz-oscillator-physics.js';
let checks = 0, integrations = 0, roots = 0;
const ok = (v, s) => {assert.ok(v, s); checks++;};
const near = (x, y, eps, s) => ok(Math.abs(x - y) <= eps, `${s}: ${x} versus ${y}`);
const p = oscillatorPlan();
near(p.frequency, 32768, 1e-10, 'Specified loaded reference');
near(p.load, 12.5e-12, 1e-25, 'Equal capacitor series combination');
near(p.amplitudeTau, .46606691405936373, 1e-14, '2L/R amplitude time constant');
near(p.quality, 47978.65634333203, 1e-7, 'Q from motional RLC');
// Independent complex-admittance zero: lossless RLC motional branch in
// parallel with C0 and the external series capacitors. Bisection, not the
// production resonance formula.
for (let cap = 12; cap <= 40; cap += .5) {
  const plan = oscillatorPlan({capacitor: cap}), L = p.inductance, c = 2.25e-15, shunt = .9e-12 + cap * .5e-12;
  const susceptance = f => {const w = 2 * Math.PI * f; return w * shunt - 1 / (w * L - 1 / (w * c));};
  let lo = 32765.3, hi = 32780;
  for (let i = 0; i < 70; i++) {const mid = (lo + hi) / 2; if (susceptance(mid) > 0) hi = mid; else lo = mid;}
  near(plan.frequency, (lo + hi) / 2, 2e-8, 'Independent BVD root'); roots++;
  near(plan.criticalGain, 4 * plan.resistance * (2 * Math.PI * plan.frequency) ** 2 * shunt ** 2, 1e-18, 'Equal-load critical transconductance');
  for (const gain of [0, .1, .8, 1, 6, 10]) for (const resistance of [45, 60]) for (const initial of [0, 1]) {
    const input = {capacitor: cap, gain, resistance, initial}, q = oscillatorPlan(input);
    let previousLoss = 0, previousInput = 0;
    for (const t of [0, 1e-9, .01, .25, 1, 4, 8]) {
      const s = sampleOscillator(input, t);
      ok(s.energy >= 0 && s.fraction < 1 && s.amplitude >= 0, 'Positive bounded energy');
      ok(s.inputPower >= 0 && s.lossPower >= 0 && s.lossPower < C.maximumDrive, 'Nonnegative power below data-sheet drive maximum');
      near(s.initialEnergy + s.suppliedEnergy, s.energy + s.lostEnergy, 2e-21, 'Integrated energy balance');
      ok(s.lostEnergy + 1e-22 >= previousLoss && s.suppliedEnergy + 1e-22 >= previousInput, 'Cumulative input and heat cannot decrease');
      previousLoss = s.lostEnergy; previousInput = s.suppliedEnergy;
      if (gain === 0) {near(s.amplitude, (initial ? .5 : .001) * Math.exp(-t / q.amplitudeTau), 1e-15, 'Free decay'); near(s.suppliedEnergy, 0, 1e-22, 'No energy from disabled amplifier');}
    }
  }
}
// Independently integrate energy, delivered work, and heat together. This
// checks the analytic solution and its integral rather than its own identity.
function integrate(plan, time) {
  const {margin: g, decay: k, initialEnergyFraction: e} = plan;
  const derivative = ([x]) => {const loss = k * x, input = loss * g * (1 - x); return [input - loss, input, loss];};
  let s = [e, 0, 0]; const steps = Math.ceil(time / .00025), h = time / steps;
  for (let i = 0; i < steps; i++) {
    const a = derivative(s), b = derivative(s.map((v, j) => v + h * a[j] / 2)), c = derivative(s.map((v, j) => v + h * b[j] / 2)), d = derivative(s.map((v, j) => v + h * c[j]));
    s = s.map((v, j) => v + h * (a[j] + 2 * b[j] + 2 * c[j] + d[j]) / 6);
  }
  return s;
}
for (const margin of [0, .000001, .3, .99, 1 - 1e-10, 1, 1 + 1e-10, 1.01, 2, p.margin, 27.52333325022581]) for (const initialEnergyFraction of [1e-6, .25]) for (const time of [.1, 1, 8]) {
  const q = {...p, margin, initialEnergyFraction}, a = oscillatorEnvelope(q, time), independent = integrate(q, time);
  near(a.fraction, independent[0], 5e-9, 'Independent RK4 stored energy');
  near(a.suppliedEnergy / p.energyScale, independent[1], 6e-8, 'Independent RK4 input');
  near(a.lostEnergy / p.energyScale, independent[2], 6e-8, 'Independent RK4 heat');
  integrations++;
}
const decay = oscillatorPlan({gain: 0, initial: 1});
near(oscillatorEnvelope(decay, decay.amplitudeTau).amplitude, .5 / Math.E, 1e-15, 'One time constant leaves 36.8 percent of starting amplitude');
near(oscillatorEnvelope(decay, decay.amplitudeTau).energy / oscillatorEnvelope(decay, 0).energy, Math.exp(-2), 1e-15, 'Energy decays twice as fast');
for (const t of [0, .25, .5, .75, 1, 1.25]) {
  const s = sampleOscillator({mode: 1, initial: 1, gain: 0}, t * p.period);
  near(s.displacement, s.amplitude * Math.sin(2 * Math.PI * t), 2e-15, 'Signed physical cycle phase');
}
ok(sampleOscillator({gain: 1, capacitor: 12}, 8).amplitude > .79, 'Light load sustains with 1 µS');
ok(sampleOscillator({gain: 1, capacitor: 40}, 8).amplitude < 1e-8, 'Same amplifier fails with heavy load');
ok(oscillatorPlan({resistance: 60}).amplitudeTau < p.amplitudeTau, 'More loss shortens decay');
for (const bad of [null, [], {unknown: 1}, {gain: NaN}, {gain: 11}, {gain: .01}, {capacitor: 41}, {mode: 2}, {initial: .5}]) {assert.throws(() => oscillatorPlan(bad)); checks++;}
for (const bad of [-1, NaN, Infinity]) {assert.throws(() => sampleOscillator(D, bad)); checks++;}
console.log(JSON.stringify({passed: true, checks, integrations, roots}));

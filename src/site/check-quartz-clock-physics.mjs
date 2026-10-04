import assert from 'node:assert/strict';
import {QUARTZ_CLOCK as C, CLOCK_DEFAULTS as D, crystalLoad, clockFrequency, quartzClockExperiment as plan, sampleQuartzExperiment as sample, clockFaceTime, cantileverMode} from './quartz-clock-physics.js';

let checks = 0, resonanceSolutions = 0, binaryCycles = 0;
const check = (v, why) => {checks++; assert.ok(v, why);};
const near = (a, b, epsilon, why) => check(Math.abs(a - b) <= epsilon, `${why}: ${a} versus ${b}`);
near(crystalLoad(8), 12.5e-12, 1e-26, 'Equal 25 pF branches give 12.5 pF load');
near(clockFrequency(25, 8), 32768, 0, 'Calibrated reference');
near(plan({temperature: 0}).rate, -1.89, 1e-10, 'Independent temperature result');
near(plan({temperature: -10}).rate, -3.7044, 1e-10, 'Cold endpoint');
// Solve the lossless crystal-plus-load susceptance zero independently, without
// the production load-pulling formula. L is calibrated once at the reference.
const Lref = (1 + 2.25e-15 / (13.4e-12)) / ((2 * Math.PI * 32768) ** 2 * 2.25e-15);
for (const temperature of [-10, 0, 20, 25, 35, 50]) for (const trimmer of [1.5, 8, 15, 30]) {
  const load = 1e-12 / (1 / (17 + trimmer) + 1 / 25), factor = 1 - .035e-6 * (temperature - 25) ** 2;
  const L = Lref / factor ** 2, Cm = 2.25e-15, capacitance = .9e-12 + load;
  const series = 1 / Math.sqrt(L * Cm);
  let low = series * (1 + 1e-10), high = series * 1.01;
  for (let i = 0; i < 90; i++) {const mid = (low + high) / 2, admittance = mid * capacitance - 1 / (mid * L - 1 / (mid * Cm)); if (admittance < 0) low = mid; else high = mid;}
  near(clockFrequency(temperature, trimmer), (low + high) / (4 * Math.PI), 2e-10, 'Independent BVD resonance'); resonanceSolutions++;
}
for (let trimmer = 1.5; trimmer < 30; trimmer += .5) check(clockFrequency(25, trimmer) > clockFrequency(25, trimmer + .5), 'Increasing load slows the crystal');
for (let delta = 0; delta <= 25; delta++) near(clockFrequency(25 - delta, 8), clockFrequency(25 + delta, 8), 0, 'Temperature symmetry');
const bits = new Array(15).fill(0);
for (let n = 0; n <= 32768; n++) {
  const s = sample({}, n / 32768); assert.deepEqual(s.dividers, bits); checks++;
  near(s.ticks, n === 32768 ? 1 : 0, 0, 'One motor command per 32768 crystal cycles');
  for (let k = 0; k < bits.length; k++) {bits[k] = 1 - bits[k]; if (bits[k]) break;} binaryCycles++;
}
for (const values of [{}, {temperature: -10, trimmer: 30}, {temperature: 50, trimmer: 1.5}, {trimmer: 1.5}]) {
  const p = plan(values);
  for (let tick = 1; tick <= 59; tick++) {
    const time = tick / p.ratio;
    const before = sample(values, time - 1e-6), at = sample(values, time), active = sample(values, time + p.pulseWidth / 2), after = sample(values, time + p.pulseWidth + 1e-7);
    near(before.ticks, tick - 1, 0, 'No early hand step'); near(at.ticks, tick, 0, 'Step at the command');
    check(at.pulse && active.pulse && !after.pulse, 'Pulse width follows exactly 1536 cycles');
    near(active.motorVoltage, tick % 2 ? -1.5 : 1.5, 0, 'Output polarity alternates');
    near(after.motorVoltage, 0, 0, 'No differential voltage between commands');
    near(after.motor1, 1.5, 0, 'Both outputs idle high'); near(after.motor2, 1.5, 0, 'Both outputs idle high');
  }
  near(sample(values, p.mode.duration).ticks, 60, 0, 'Working trial finishes on sixtieth command');
  const end = sample({...values, mode: 2}, 30 * 86400);
  near(end.elapsedError, p.rate * 30, 1e-9, 'Rate integrates over thirty days');
  near(end.handsTime, 36600 + end.ticks, 0, 'Hands preserve starting setting');
}
for (const mode of [0, 1, 2]) for (const battery of [0, 1]) {
  const values = {...D, mode, battery}, p = plan(values), start = sample(values, 0), end = sample(values, p.mode.duration * 2);
  check(!start.complete && end.complete && end.time === p.mode.duration, 'Finite experiment completion');
  if (!battery) {check(end.ticks === 0 && end.cycles === 0 && end.motorVoltage === 0 && end.displacement === 0, 'Disconnected battery stops every powered process'); assert.deepEqual(end.dividers, new Array(15).fill(0)); checks++;}
}
const slow = plan({mode: 1}); near(slow.mode.duration * slow.frequency, 4, 0, 'Four actual crystal cycles');
near(sample({mode: 1}, 1 / (slow.frequency * 4)).displayedDisplacement, .0001, 1e-15, 'Declared 5000-fold deformation');
near(cantileverMode(0), 0, 0, 'Tine root fixed'); near(cantileverMode(1), 1, 0, 'Normalized tip');
near(cantileverMode(.000001) / .000001, 0, .00001, 'Clamped root slope');
const h = .0001, second = (cantileverMode(1) - 2 * cantileverMode(1 - h) + cantileverMode(1 - 2 * h)) / h ** 2;
near(second, 0, .0001, 'Free-end bending moment');
check(clockFaceTime(36600) === '10:10:00' && clockFaceTime(43200) === '12:00:00' && clockFaceTime(86401) === '12:00:01', 'Dial formatting and wrap');
for (const values of [null, [], {other: 1}, {mode: .5}, {mode: 3}, {temperature: Infinity}, {temperature: -11}, {trimmer: 2.2}, {battery: .5}]) {assert.throws(() => plan(values)); checks++;}
for (const time of [-1, NaN, Infinity]) {assert.throws(() => sample({}, time)); checks++;}
for (const x of [-1, NaN, Infinity, 1.1]) {assert.throws(() => cantileverMode(x)); checks++;}
console.log(JSON.stringify({passed: true, checks, resonanceSolutions, binaryCycles}));

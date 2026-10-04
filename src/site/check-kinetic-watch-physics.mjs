import assert from 'node:assert/strict';
import {KINETIC_WATCH as K, KINETIC_DEFAULTS as D, KINETIC_DOMAINS, kineticWatchPlan, kineticMotion, kineticInstantElectrical, kineticMeanElectrical, createKineticTimeline, kineticClock} from './kinetic-watch-physics.js';
import {tally, checkRefusals} from './model-check-kit.mjs';

const t = tally(), TAU = 2 * Math.PI;
checkRefusals((input, time = 0) => createKineticTimeline(input).sample(time), KINETIC_DOMAINS, t);
for (const time of [-1, NaN, Infinity]) assert.throws(() => createKineticTimeline().sample(time));
for (const frequency of [.5, 1, 2]) for (let time = 0; time < 1 / frequency; time += .000317) {
  const s = kineticMotion(frequency, time), h = 1e-9;
  const flux = dt => .001 * Math.cos(400 * Math.PI / 2 * Math.sin(TAU * frequency * (time + dt)));
  t.near(s.emf, -(flux(h) - flux(-h)) / (2 * h), 5e-6, 'Independent numerical Faraday derivative');
  t.near(s.magnet, s.weight * 400, 1e-12); t.near(s.magnetSpeed, s.weightSpeed * 400, 1e-12);
  const e = kineticInstantElectrical(1.2, s.emf);
  t.near(e.mechanical, 1.2 * e.current + e.copper + e.bridge, 2e-16, 'Instant electromagnetic work is capacitor input plus copper and rectifier loss');
  t.ok(e.current >= 0); t.near(e.current, kineticInstantElectrical(1.2, -s.emf).current, 0, 'Both AC polarities charge with the same DC polarity');
}

let quadratureCases = 0;
for (const frequency of [.5, 1, 2]) for (const voltage of [0, .3, .6, 1.2, 1.8, 2.2]) {
  const n = 262144, sums = {current: 0, copper: 0, bridge: 0, mechanical: 0};
  for (let i = 0; i < n; i++) {
    const phase = TAU * (i + .5) / n, theta = 400 * Math.PI / 2 * Math.sin(phase), omega = 400 * Math.PI / 2 * TAU * frequency * Math.cos(phase);
    const emf = Math.abs(.001 * omega * Math.sin(theta)), current = Math.max(0, (emf - voltage - .3) / 330);
    sums.current += current / n; sums.copper += current ** 2 * 330 / n; sums.bridge += .3 * current / n; sums.mechanical += emf * current / n;
  }
  const measured = kineticMeanElectrical(voltage, frequency);
  for (const key of Object.keys(sums)) t.near(measured[key], sums[key], Math.max(2e-7 * (key === 'current' ? 1 : 8), sums[key] * .0005), `Cycle quadrature ${frequency} Hz, ${voltage} V, ${key}`);
  t.near(measured.mechanical, voltage * measured.current + measured.copper + measured.bridge, 1e-14);
  quadratureCases++;
}
t.near(kineticMeanElectrical(1.2, 0).current, 0, 0);
for (const voltage of [0, .5, .59, .6, 1.2, 2.2]) {
  const plan = kineticWatchPlan({mode: 2, motion: 0, voltage}), run = createKineticTimeline(plan.values);
  const untilStop = voltage >= .6 ? .33 * (voltage - .5) / (.62e-6) : 0;
  for (const time of [0, 1, 3600, 86400, 8 * 86400, 21 * 86400]) {
    const s = run.sample(time), powered = Math.min(time, untilStop);
    const expected = Math.max(0, voltage - ((voltage >= .6 ? .62e-6 : .02e-6) * powered + .02e-6 * (time - powered)) / .33);
    t.near(s.voltage, expected, 3e-14, 'Exact discharge with stopped-circuit load removed');
    t.near(s.powered, powered, 1e-8); t.near(s.mechanical, 0, 0); t.near(s.energyResidual, 0, 2e-14);
    t.ok(s.ticks <= Math.floor(time + 1e-7));
  }
}
t.near(kineticWatchPlan({temperature: 0}).rate, -.035e-6 * 25 ** 2 * 86400, 1e-11);
t.near(kineticWatchPlan({temperature: 50}).frequency, kineticWatchPlan({temperature: 0}).frequency, 0);
assert.equal(kineticClock(3661), '1:01:01'); assert.equal(kineticClock(0), '12:00:00');

let resolvedSteps = 0;
for (const values of [{voltage: 1.2, motion: 2}, {voltage: .59, motion: 2}, {voltage: 2.19, motion: 3}]) {
  const plan = kineticWatchPlan(values), dt = .000005, end = 2;
  let voltage = values.voltage, running = voltage >= .6, powered = 0, firstStart = null;
  for (let i = 0; i < end / dt; i++) {
    const time = (i + .5) * dt, f = plan.motionFrequency, phi = TAU * f * time;
    const angle = 400 * Math.PI / 2 * Math.sin(phi), omega = 400 * Math.PI / 2 * TAU * f * Math.cos(phi);
    const current = Math.max(0, (Math.abs(.001 * omega * Math.sin(angle)) - voltage - .3) / 330);
    voltage = Math.max(0, Math.min(2.2, voltage + dt * (current - (running ? .6e-6 : 0) - .02e-6) / .33));
    powered += running ? dt : 0;
    if (!running && voltage >= .6) {running = true; firstStart ??= (i + 1) * dt;}
    if (running && voltage <= .5) running = false;
    resolvedSteps++;
  }
  const s = createKineticTimeline(values).sample(end);
  t.near(s.voltage, voltage, 2e-6, 'Waveform error below two microvolts versus independent small-step midpoint integration');
  t.near(s.powered, powered, 5e-5); t.near(s.energyResidual, 0, 1e-8);
  if (firstStart !== null) t.near(s.events.find(e => e.type === 'started').time, firstStart, 5e-5);
}

let independentDays = 0;
for (const values of [{voltage: 0, motion: 2, minutes: .5}, {voltage: .6, motion: 1, minutes: .5}, {voltage: 1.2, motion: 2, minutes: 2}, {voltage: 2.2, motion: 3, minutes: 2}]) {
  const run = createKineticTimeline({...values, mode: 2}), frequency = [0, .5, 1, 2][values.motion];
  let voltage = values.voltage, running = voltage >= .6, powered = 0;
  for (let day = 0; day < 21; day++) {
    const dt = .05;
    for (let step = 0; step < values.minutes * 60 / dt; step++) {
      const drain = (running ? .6e-6 : 0) + .02e-6;
      const slope = v => (kineticMeanElectrical(v, frequency).current - drain) / .33;
      voltage = Math.max(0, Math.min(2.2, voltage + dt * slope(voltage + dt / 2 * slope(voltage))));
      powered += running ? dt : 0;
      if (!running && voltage >= .6) running = true;
      if (running && voltage <= .5) running = false;
    }
    const afterMotion = run.sample(day * 86400 + values.minutes * 60);
    t.near(afterMotion.voltage, voltage, 3e-7, 'Independent fine-step daily charging');
    const rest = 86400 - values.minutes * 60;
    const poweredRest = running ? Math.min(rest, .33 * (voltage - .5) / .62e-6) : 0;
    voltage = Math.max(0, voltage - .62e-6 * poweredRest / .33 - .02e-6 * (rest - poweredRest) / .33);
    powered += poweredRest; if (poweredRest < rest) running = false;
    const end = run.sample((day + 1) * 86400);
    t.near(end.voltage, voltage, 3e-7, 'Charging and resting intervals preserve chronology');
    t.near(end.powered, powered, 1.2, 'Independent stop/restart duration across 21 days');
    assert.equal(end.running, running); independentDays++;
  }
}

let histories = 0;
for (const motion of [0, 1, 2, 3]) for (const minutes of [0, .5, 2, 20]) for (const voltage of [0, .59, 1.2, 2.2]) {
  const values = {...D, mode: 2, motion, minutes, voltage}, run = createKineticTimeline(values);
  const ordered = [0, 10, 30, 60, 120, 1200, 3600, 86400, 86410, 86520, 7 * 86400, 21 * 86400];
  const states = ordered.map(time => run.sample(time));
  for (const s of states) {
    t.ok(s.voltage >= 0 && s.voltage <= 2.2); t.ok(s.energy >= 0 && s.energy <= s.maximumEnergy + 1e-12);
    t.near(s.energyResidual, 0, 1e-7, 'Integrated energy balance');
    t.ok(s.running ? s.voltage >= .5 - 1e-9 : s.voltage < .6 + 1e-9);
    t.ok(s.powered <= s.time + 1e-8); t.ok(s.ticks <= s.powered + 1e-7);
    if (!s.active) t.near(s.motion.magnetSpeed, 0, 0);
  }
  for (let i = states.length - 1; i >= 0; i--) {
    const s = run.sample(ordered[i]); t.near(s.voltage, states[i].voltage, 0, 'Backward inspection preserves deterministic trajectory'); t.near(s.clock, states[i].clock, 0);
  }
  const completion = states.at(-1), held = run.sample(100 * 86400); assert.deepEqual(held, completion);
  histories++;
}
const cold = createKineticTimeline({mode: 2, voltage: 0, minutes: .5});
const first = cold.sample(10), overnight = cold.sample(3600), later = cold.sample(3 * 86400);
t.ok(first.voltage > 0 && !first.running && first.motion.magnetSpeed !== 0, 'Empty storage does not freeze mechanically driven generator');
t.ok(overnight.voltage > 0 && !overnight.active, 'Short charging interval survives even when daily net energy is negative');
t.ok(later.events.some(e => e.type === 'started'), 'Several short sessions eventually cross startup threshold');
const full = createKineticTimeline({mode: 2, voltage: 2.2, minutes: 20, motion: 3}).sample(600);
t.near(full.voltage, 2.2, 0); t.ok(full.protectedCharge); t.near(full.energyResidual, 0, 1e-9);
console.log(JSON.stringify({passed: true, checks: t.count, quadratureCases, resolvedSteps, independentDays, histories}));

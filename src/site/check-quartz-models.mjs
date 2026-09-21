// Quartz clock, quartz oscillator, piezoelectricity and kinetic quartz watch:
// the tine's frequency from the cantilever's own mode equation, the crystal's
// temperature curve, the divider and motor, the energy budgets and the
// piezoelectric plate from their formulas, the drawings held to the state, and
// every number all four lessons quote held to the models.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleQuartzClock, quartzClockPlan, sampleKinetic, kineticPlan, tineLength, tineFrequency, crystalFrequency, dailyRate, averageCurrent, ACTIVITIES, QUARTZ, QUARTZ_CLOCK_DOMAINS, KINETIC_DOMAINS} from './quartz-physics.js';
import {createQuartzClockModel, createKineticWatchModel, clockChartPoint, kineticChartPoint, tineSway, rotorSwing, FORCE_SCALE} from './quartz-models.js';
import {quartzClockLesson, quartzOscillatorLesson, piezoelectricityLesson, kineticWatchLesson} from './quartz-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), TAU = Math.PI * 2;

// 1. The fork, from the cantilever's mode equation 1 + cos(bL) cosh(bL) = 0.
{
  let lo = 1.5, hi = 2.5;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if ((1 + Math.cos(lo) * Math.cosh(lo)) * (1 + Math.cos(mid) * Math.cosh(mid)) <= 0) hi = mid; else lo = mid; }
  const beta = (lo + hi) / 2, L = tineLength(), E = 78.7e9, rho = 2650, thick = 0.25e-3, wide = 0.35e-3;
  const I = wide * thick ** 3 / 12, A = wide * thick;
  t.near(beta, 1.875, 1e-3, 'first cantilever mode');
  t.near(beta ** 2 / (TAU * L ** 2) * Math.sqrt(E * I / (rho * A)), 32768, 0.05, 'the tines ring at 32,768 Hz');
  t.near(tineFrequency(L), 32768, 1e-6, 'tine length for 32,768 Hz');
  t.near(tineFrequency(L / 2), 4 * 32768, 1e-6, 'half the length, four times the frequency');
}
for (const trim of [-10, 0, 0.5, 5]) for (const temperature of [-10, 0, 20, 25, 35, 50]) {
  const f = crystalFrequency(temperature, trim), expected = 32768 * (1 + trim * 1e-6) * (1 - 0.034e-6 * (temperature - 25) ** 2);
  t.near(f, expected, 1e-9, 'crystal frequency');
  t.near(dailyRate(f), 86400 * (expected - 32768) / 32768, 1e-9, 'seconds a day');
  t.near(crystalFrequency(50 - temperature, trim), f, 1e-9, 'the curve is symmetric about 25 °C');
}
for (const time of [0, 0.99999, 1, 2.5, 59.9, 60]) {
  const s = sampleQuartzClock({temperature: 25}, time);
  assert.equal(s.steps, Math.floor(time + 1e-9), 'a step each second');
  t.near(s.rotor, s.steps * Math.PI, 1e-12, 'half a turn a step');
  t.near(s.secondsHand, s.steps * TAU / 60, 1e-12, 'six degrees a step');
  s.dividers.forEach((state, k) => assert.equal(state, Math.floor(32768 * time / 2 ** k) % 2, `divider stage ${k}`));
}
{
  const p = quartzClockPlan({});
  t.near(p.stages[15], p.frequency / 32768, 1e-12, 'fifteen halvings');
  t.near(p.current, 3e-3 * 0.032 + 10e-6, 1e-15, 'clock current');
  t.near(p.life, 2.4 / p.current / 8760, 1e-9, 'AA life in years');
  t.near(p.ringDown, 60000 / (Math.PI * p.frequency), 1e-12, 'ring-down time constant');
  for (const squeeze of [0, 10, 20, 50]) {
    const q = quartzClockPlan({squeeze}), C = 4.5 * 8.854e-12 * 1e-4 / 1e-3;
    t.near(q.charge, 2.31e-12 * squeeze, 1e-20, 'charge from the squeeze');
    t.near(q.voltage, 2.31e-12 * squeeze / C, 1e-9, 'voltage on the plate');
  }
}
for (const activity of [0, 1, 2]) for (const worn of [0, 2, 8, 16]) for (const start of [0, 20, 100]) {
  const values = {activity, worn, start}, k = kineticPlan(values), use = (0.3e-3 * 0.005 + 0.1e-6) * 1.5, store = 5 * 3.6 * 1.5;
  t.near(k.consumption, use, 1e-15, 'watch power');
  t.near(k.daily, [2e-6, 10e-6, 30e-6][activity] * worn * 3600 - use * 86400, 1e-12, 'energy balance each day');
  t.near(k.reserve, store / use / 86400, 1e-9, 'reserve off the wrist');
  for (const days of [0, 7, 30]) t.near(sampleKinetic(values, days).energy, Math.min(store, Math.max(0, start / 100 * store + k.daily * days)), 1e-9, 'stored energy by day');
}

// 2. The quartz clock drawing.
const clock = createQuartzClockModel(), c = clock.topology, MM = c.MM;
clock.root.position.set(0.2, -0.1, 0.1);
for (const values of [{}, {temperature: -10, trim: 5}, {squeeze: 50}, {squeeze: 0, temperature: 25}]) for (const time of [0, 0.3, 1.01, 7.3, 60]) {
  clock.reset(); clock.update(values); clock.advance(time);
  clock.root.updateMatrixWorld(true);
  const s = clock.getState();
  for (const tine of c.tines) t.near(tine.rotation.z, -tine.userData.side * 0.3 * Math.sin(TAU * 2 * time) / c.L, 1e-12, 'tines sway');
  c.lamps.forEach((lamp, k) => assert.equal(lamp.material.color.getHex(), s.dividers[k] ? 0xe3b45e : 0x374736, `lamp ${k} shows its stage`));
  t.near(c.rotor.rotation.z, s.rotor, 1e-12, 'rotor at its step');
  t.near(c.secondsHand.rotation.z, -s.secondsHand, 1e-12, 'seconds hand');
  t.near(c.minuteHand.rotation.z, -TAU * (c.START + s.steps) / 3600, 1e-12, 'minute hand');
  t.near(c.squeeze.userData.length / MM, s.values.squeeze * FORCE_SCALE, 1e-9, 'squeeze arrow at 0.5 mm a newton');
  t.near(c.needle.rotation.z, -Math.min(1, s.voltage / 30) * Math.PI / 2 + Math.PI / 4, 1e-12, 'meter needle at the voltage');
  t.near(c.dot.position.y, clockChartPoint(s.values.temperature, s.rate)[1], 1e-12, 'chart dot');
  t.near(c.curve.geometry.attributes.position.getY(10), clockChartPoint(0, dailyRate(crystalFrequency(0, s.values.trim)))[1], 1e-6, 'chart curve');
  checkFinite(clock.root, t);
}
checkControlsMove(clock, () => [c.dot.position.toArray(), c.curve.geometry.attributes.position.getY(0), c.squeeze.userData.length, c.needle.rotation.z], model => model.advance(1.5), t);

// 3. The kinetic watch drawing.
const watch = createKineticWatchModel(), w = watch.topology;
for (const values of [{}, {activity: 0, worn: 16}, {worn: 0, start: 100}, {activity: 2, worn: 2, start: 0}]) for (const days of [0, 0.1, 0.5, 7.25, 30]) {
  watch.reset(); watch.update(values); watch.advance(days);
  watch.root.updateMatrixWorld(true);
  const s = watch.getState(), hour = (days % 1) * 24, worn = s.running && s.values.worn > 0 && hour < s.values.worn;
  const swing = worn ? [0.25, 0.9, 1.4][s.values.activity] * Math.sin(TAU * [1, 3, 6][s.values.activity] * days * 24) : 0;
  t.near(w.rotor.rotation.z, swing, 1e-12, 'weight swings only while worn');
  t.near(w.magnet.rotation.z, swing * 100, 1e-9, 'generator geared up a hundredfold');
  t.near(w.bar.scale.x, Math.max(1e-3, s.level), 1e-12, 'store bar at its level');
  t.near(w.rateNeedle.rotation.z, -Math.max(-1, Math.min(1, s.rate / 2)) * Math.PI / 4, 1e-12, 'rate needle at the wrist’s rate');
  t.near(w.levelLine.geometry.attributes.position.getY(7), kineticChartPoint(7, sampleKinetic(s.values, 7).level)[1], 1e-6, 'level chart');
  checkFinite(watch.root, t);
}
checkControlsMove(watch, () => [w.bar.scale.x, w.levelLine.geometry.attributes.position.getY(15), w.rotor.rotation.z, w.rateNeedle.rotation.z], model => model.advance(5.1), t);

// 4. The lessons, the text, refusals and disposal.
const runClock = values => { clock.reset(); clock.update(values); clock.advance(60); return clock.getState(); };
checkTrialNumbers(quartzClockLesson, {
  'Run a minute': st => ({'32,767.9721': st.frequency, '0.850': -st.ppm, '0.073': -st.rate, '2.20': -st.month}),
  'At its best temperature': st => (t.near(st.rate, 0, 1e-12, 'perfect time'), {'32,768': st.frequency}),
  'A cold room': st => ({'25': QUARTZ.turnover - st.values.temperature, '21.250': -st.ppm, '1.836': -st.rate, '55.08': -st.month}),
  'A warm room': st => ({'3.400': -st.ppm, '0.294': -st.rate}),
  'Trim it': st => ({'20': st.values.temperature, '0.359': st.rate, '4.150': st.ppm}),
  'Count down to seconds': () => ({'32,768': QUARTZ.nominal, '2': 2, '15': QUARTZ.stages, '1': 1}),
  'The stepping motor': () => ({'30': QUARTZ.secondsRatio, '1': 1, '6': 360 / 60}),
  'The battery': st => ({'106.0': st.current * 1e6, '32': QUARTZ.clock.pulse * 1000, '2.58': st.life}),
}, runClock, t);
checkTrialNumbers(quartzOscillatorLesson, {
  'A fork of quartz': st => ({'2.59': st.tine * 1000, '0.25': QUARTZ.thickness * 1000, '32,768': QUARTZ.nominal}),
  'Ringing on and on': st => ({'60,000': QUARTZ.Q, '0.583': st.ringDown, '19,000': Math.round(st.ringDown * st.frequency / 1000) * 1000}),
  'Why 32,768': () => ({'32,768': 2 ** 15, '2': 2, '15': QUARTZ.stages, '1': 1}),
  'Cold quartz': st => ({'35': QUARTZ.turnover - st.values.temperature, '41.650': -st.ppm, '3.599': -st.rate}),
  'Pull it to time': st => ({'0.043': st.rate, '15.8': st.year}),
  'A hot room': st => (t.near(st.ppm, quartzClockPlan({...st.values, temperature: 0}).ppm, 1e-9, 'same as 0 °C'), {'21.250': -st.ppm, '0': 0}),
}, runClock, t);
checkTrialNumbers(piezoelectricityLesson, {
  'Squeeze the plate': st => ({'23.10': st.charge * 1e12, '1': 1, '5.80': st.voltage}),
  'Squeeze harder': st => ({'115.50': st.charge * 1e12, '28.99': st.voltage}),
  'Let go': st => ({'0.00': st.voltage}),
  'Every newton counts': st => ({'2.31': QUARTZ.piezo * 1e12, '20': st.values.squeeze, '46.20': st.charge * 1e12, '11.60': st.voltage}),
  'A tiny capacitor': st => ({'3.98': st.capacitance * 1e12}),
  'Both ways at once': () => ({'32,768': QUARTZ.nominal}),
}, runClock, t);
const runWatch = values => { watch.reset(); watch.update(values); watch.advance(30); return watch.getState(); };
checkTrialNumbers(kineticWatchLesson, {
  'Wear it walking': st => ({'10': st.harvest * 1e6, '8': st.values.worn, '0.288': st.harvest * st.values.worn * 3600, '0.207': st.consumption * 86400, '0.081': st.daily}),
  'A desk job': st => ({'2': st.harvest * 1e6, '0.150': -st.daily, '36.1': st.empty}),
  'Left in a drawer': st => ({'2.40': st.consumption * 1e6, '27': st.store, '130.2': st.reserve}),
  'Breaking even': st => ({'5.76': st.wearToBreakEven}),
  'A long day on your feet': st => ({'0.369': st.daily, '58.6': st.full}),
  'A short run': st => (t.ok(st.daily > 0, 'just beats it'), {'30': st.harvest * 1e6, '2': st.values.worn, '0.207': st.consumption * 86400}),
  'A cold wrist': st => ({'21.250': -(st.frequency / QUARTZ.nominal - 1) * 1e6, '1.836': -st.rate}),
  'Where the power goes': () => ({'5': QUARTZ.watch.pulse * 1000, '0.3': QUARTZ.watch.motor * 1000, '1.5': QUARTZ.watch.motor * QUARTZ.watch.pulse * 1e6, '1.6': averageCurrent(QUARTZ.watch) * 1e6}),
}, runWatch, t);
checkQuotedText(quartzClockLesson.deeper.map(section => section.body).join(' '), {'60,000': fixed(QUARTZ.Q, 0), '0.034 parts per million': `${fixed(-QUARTZ.parabola * 1e6, 3)} parts per million`}, t);
checkQuotedText(quartzOscillatorLesson.deeper.map(section => section.body).join(' '), {'0.583 s': `${fixed(quartzClockPlan({}).ringDown, 3)} s`}, t);
checkQuotedText(kineticWatchLesson.deeper.map(section => section.body).join(' '), {'about 2.4 µW': `about ${fixed(kineticPlan({}).consumption * 1e6, 1)} µW`}, t);
checkQuotedText(clock.parts.map(part => part.description).join(' '), {'2.59 mm': `${fixed(tineLength() * 1000, 2)} mm`, '2,400 mAh': `${fixed(QUARTZ.clock.capacity, 0)} mAh`}, t);
checkQuotedText(watch.parts.map(part => part.description).join(' '), {'27 J': `${fixed(kineticPlan({}).store, 0)} J`}, t);
checkRefusals(sampleQuartzClock, QUARTZ_CLOCK_DOMAINS, t);
checkRefusals(sampleKinetic, KINETIC_DOMAINS, t);
const resources = checkDisposal(clock, t) + checkDisposal(watch, t);
console.log(`PASS quartz models: ${t.count} checks, ${quartzClockLesson.tryIt.length + quartzOscillatorLesson.tryIt.length + piezoelectricityLesson.tryIt.length + kineticWatchLesson.tryIt.length} trials, ${resources} resources`);

// Pendulum clock and anchor escapement: the period against the exact
// elliptic integral and a direct integration of the swing, the energy balance,
// the rates by temperature, the drawing held to the clock's state, and every
// number both lessons quote held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleClock, clockPlan, swing, circularError, hotLength, weightPower, DESIGN_PERIOD, RODS, CARE, CLOCK, CLOCK_DEFAULTS as D, CLOCK_DOMAINS} from './pendulum-clock-physics.js';
import {createPendulumClockModel, chartPoint, weightHeight, rateChange, escapeWheelShape} from './pendulum-clock-model.js';
import {pendulumClockLesson, anchorEscapementLesson} from './pendulum-clock-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), g = 9.81, TAU = Math.PI * 2;

// 1. The period, three ways.
const agm = (a, b) => { for (let i = 0; i < 40; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)]; return a; };
const integrated = (L, theta0) => {
  // Release from theta0 and time the quarter swing to the bottom, in small RK4 steps with a final interpolation.
  const f = ([th, w]) => [w, -g / L * Math.sin(th)];
  let state = [theta0, 0], time = 0;
  const dt = 1e-4;
  while (true) {
    const k1 = f(state), k2 = f(state.map((v, i) => v + dt / 2 * k1[i])), k3 = f(state.map((v, i) => v + dt / 2 * k2[i])), k4 = f(state.map((v, i) => v + dt * k3[i]));
    const next = state.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    if (next[0] <= 0) return 4 * (time + dt * state[0] / (state[0] - next[0]));
    state = next; time += dt;
  }
};
for (const L of [0.25, 0.9938, 1.0]) for (const degrees of [0.5, 2.34, 3.02, 10]) {
  const theta = degrees * Math.PI / 180, small = TAU * Math.sqrt(L / g), exact = small / agm(1, Math.cos(theta / 2));
  t.near(small * circularError(theta), exact, (degrees <= 3.1 ? 1e-9 : 1e-6) * exact, 'series circular error against the elliptic integral');
  if (degrees === 2.34 || degrees === 10) t.near(integrated(L, theta), exact, 2e-7 * exact, 'the swing integrated step by step takes the elliptic period');
}

// 2. The swing's balance, the rod and the rate.
for (const rod of [0, 1, 2]) for (const temperature of [10, 20, 30]) for (const weight of [1, 3, 5]) for (const care of [0, 1]) for (const length of [990, 993.8, 1000]) {
  const values = {length, rod, temperature, weight, care}, s = swing(values), plan = clockPlan(values);
  const L = length / 1000 * (1 + RODS[rod].expansion * (temperature - 20));
  t.near(s.L, L, 1e-15, 'rod length in the warmth');
  const power = weight * g * 0.15 / 86400 * 0.25, energy = 1.5 * g * L * s.theta ** 2 / 2;
  t.near(TAU * energy / CARE[care].Q, power * s.period, 1e-9 * power * s.period, 'each period the swing loses what the weight gives');
  t.near(s.period, TAU * Math.sqrt(L / g) * circularError(s.theta), 1e-15, 'period of the settled swing');
  assert.equal(plan.running, s.theta >= Math.PI / 180, 'stops below a degree');
  if (plan.running) t.near(plan.rate, 86400 * (DESIGN_PERIOD / s.period - 1), 1e-9, 'rate from the ratio of periods');
  t.near(plan.beatEnergy, power * s.period / 2, 1e-15, 'energy each beat');
}
t.near(DESIGN_PERIOD, swing(D).period, 0, 'the train is cut for the default pendulum');
t.near(clockPlan({}).rate, 0, 1e-9, 'the default clock keeps time');
for (const rod of [0, 1, 2]) {
  const slope = (clockPlan({rod, temperature: 21}).rate - clockPlan({rod, temperature: 19}).rate) / 2;
  t.near(slope, -86400 * RODS[rod].expansion / 2, 0.01 * 86400 * RODS[rod].expansion / 2, 'each degree loses half the rod’s expansion of a day');
}
for (const time of [0, 0.3, 1, 1.5, 17.77, 59.9]) {
  const s = sampleClock({}, time), T = s.period;
  t.near(s.angle, s.theta * Math.sin(TAU * time / T), 1e-15, 'pendulum angle');
  assert.equal(s.beats, Math.floor(2 * time / T + 0.5), 'a beat at each end of the swing');
  t.near(s.escape, s.beats * TAU / 60, 1e-15, 'half a tooth of a 30-tooth wheel each beat');
  t.near(s.clockSeconds, time * DESIGN_PERIOD / T, 1e-12, 'clock time runs by the ratio of periods');
}
{
  const shape = escapeWheelShape(), points = shape.getPoints(1);
  t.near(points.length, 30 * 3 + 1, 1, 'three corners to each of 30 teeth');
  t.near(Math.max(...points.map(p => Math.hypot(p.x, p.y))), 28, 1e-9, 'tooth tips at 28 mm');
}

// 3. The drawing.
const m = createPendulumClockModel(), p = m.topology, MM = p.MM;
m.root.position.set(0.3, 0.1, -0.2);
for (const values of [{}, {length: 990, rod: 1, temperature: 30}, {weight: 5}, {care: 1, weight: 1}, {rod: 2, weight: 1, length: 1000}]) for (const time of [0, 0.5, 1.2, 33.3, 60]) {
  m.reset(); m.update(values); m.advance(time);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), L = s.values.length;
  t.near(p.pendulum.rotation.z, s.angle, 1e-15, 'pendulum at its angle');
  t.near(p.anchor.rotation.z, s.angle, 1e-15, 'anchor rocks with the pendulum');
  t.near(p.rod.scale.y / MM, L, 1e-9, 'rod as long as the pendulum');
  assert.equal(p.rod.material.color.getHex(), [0x7a8b83, 0xc9a227, 0x2f6690][s.values.rod], 'rod colored by its metal');
  t.near(p.bob.position.y / MM, -L, 1e-9, 'bob at the rod’s end');
  t.near(p.escapeWheel.rotation.z, -s.escape, 1e-15, 'escape wheel steps');
  t.near(p.secondsHand.rotation.z, -s.escape, 1e-15, 'seconds hand on the escape arbor');
  t.near(p.minuteHand.rotation.z, -TAU * (p.START + s.clockSeconds) / 3600, 1e-12, 'minute hand at the clock’s time');
  t.near(p.hourHand.rotation.z, -TAU * (p.START + s.clockSeconds) / 43200, 1e-12, 'hour hand at the clock’s time');
  const height = s.values.weight / (11340 * Math.PI * 0.025 ** 2) * 1000;
  t.near(p.lead.scale.y / MM, height, 1e-9, 'lead weight as tall as its mass needs');
  t.near(weightHeight(s.values.weight), height, 1e-9, 'weight height');
  for (const [rod, line] of p.lines.entries()) for (const i of [0, 7, 20]) {
    const change = s.running ? clockPlan({...s.values, rod, temperature: 10 + i}).rate - clockPlan({...s.values, rod, temperature: 20}).rate : 0;
    t.near(line.geometry.attributes.position.getY(i), chartPoint(10 + i, change)[1], 1e-6, 'rate chart for each rod');
  }
  t.near(p.marker.position.y, chartPoint(s.values.temperature, rateChange(s.values, s.values.rod, s.values.temperature))[1], 1e-12, 'the dot is this clock');
  if (!s.running) { t.near(p.pendulum.rotation.z, 0, 0, 'a stopped pendulum hangs still'); t.near(p.escapeWheel.rotation.z, 0, 0, 'a stopped wheel stays put'); }
  checkFinite(m.root, t);
}
checkControlsMove(m, () => [p.rod.material.color.getHex(), p.pendulum.rotation.z, p.rod.scale.y, p.lead.scale.y, p.marker.position.y, p.lines[0].geometry.attributes.position.getY(0), p.minuteHand.rotation.z], model => model.advance(0.37), t);

// 4. Both lessons, the text, refusals and disposal.
const run = values => { m.reset(); m.update(values); m.advance(1); return m.getState(); };
const deg = st => st.theta * 180 / Math.PI;
checkTrialNumbers(pendulumClockLesson, {
  'Keep time': st => ({'2.34': deg(st), '0.00': Math.abs(st.rate)}),
  'Raise the bob a millimeter': st => ({'43.50': st.rate, '304.5': st.week}),
  'A warm room': st => (t.ok(st.rate < 0, 'loses'), {'114.3': st.growth * 1e6, '4.97': -st.rate}),
  'A brass rod': st => ({'188.8': st.growth * 1e6, '8.21': -st.rate}),
  'An invar rod': st => ({'11.9': st.growth * 1e6, '0.52': -st.rate}),
  'A lighter weight': st => ({'4.26': st.beatEnergy * 1e6, '1.35': deg(st), '6.01': st.rate}),
  'A dirty clock': st => (t.ok(st.running, 'still running'), {'1.10': deg(st), '7.01': st.rate}),
  'Too little to go on': st => (t.ok(!st.running, 'stopped'), {'0.78': deg(st), '1': CLOCK.release * 180 / Math.PI}),
}, run, t);
checkTrialNumbers(anchorEscapementLesson, {
  'Tick and tock': () => ({'30': CLOCK.teeth, '6': 360 / (2 * CLOCK.teeth)}),
  'A push every beat': st => (t.near(st.lossPerSwing, st.beatEnergy, 1e-9 * st.beatEnergy, 'a beat’s push is a beat’s loss'), {'12.77': st.beatEnergy * 1e6}),
  'Weight into swing': st => ({'3': st.values.weight, '0.15': CLOCK.fall, '12.77': st.power * 1e6}),
  'A heavier weight, a wider swing': st => ({'5': st.values.weight, '21.29': st.beatEnergy * 1e6, '3.02': deg(st)}),
  'The escapement follows the pendulum': st => ({'0.99952': st.period / 2, '1.00002': clockPlan({}).period / 2}),
  'Too weak to unlock': st => (t.ok(!st.running, 'stopped'), {'0.78': deg(st)}),
}, run, t);
checkQuotedText(pendulumClockLesson.deeper.map(section => section.body).join(' '), {
  '43.5 s': `${fixed(clockPlan({length: 992.8}).rate, 1)} s`,
  '11.5 millionths': `${fixed(RODS[0].expansion * 1e6, 1)} millionths`, 'brass by 19': `brass by ${fixed(RODS[1].expansion * 1e6, 0)}`, '1.2 millionths': `${fixed(RODS[2].expansion * 1e6, 1)} millionths`,
  '2.34 degrees': `${fixed(clockPlan({}).theta * 180 / Math.PI, 2)} degrees`, '104 parts per million': `${fixed((clockPlan({}).period / clockPlan({}).small - 1) * 1e6, 0)} parts per million`,
}, t);
checkQuotedText(anchorEscapementLesson.deeper.map(section => section.body).join(' '), {'30-tooth': `${CLOCK.teeth}-tooth`}, t);
checkQuotedText(pendulumClockLesson.limits, {'1.5 kg': `${CLOCK.bob} kg`, '9.81 m/s²': `${CLOCK.g} m/s²`, '0.15 m a day': `${CLOCK.fall} m a day`, 'Q of 3,000': `Q of ${fixed(CARE[0].Q, 0)}`, '1,000 when dirty': `${fixed(CARE[1].Q, 0)} when dirty`}, t);
checkQuotedText(m.parts.map(part => part.description).join(' '), {'1.5 kg': `${CLOCK.bob} kg`, '30 teeth': `${CLOCK.teeth} teeth`, '15 cm a day': `${fixed(CLOCK.fall * 100, 0)} cm a day`}, t);
checkRefusals(sampleClock, CLOCK_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS pendulum clock model: ${t.count} checks, ${pendulumClockLesson.tryIt.length + anchorEscapementLesson.tryIt.length} trials, ${resources} resources`);

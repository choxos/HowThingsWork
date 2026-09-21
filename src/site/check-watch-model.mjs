// Mechanical watch, lever escapement and hairspring: the spring's stiffness
// and the balance's period from their formulas, isochronism by direct
// integration, the energy balance, the temperature slope by linearization,
// the drawing held to the state, and every number all three lessons quote held
// to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleWatch, balance, barrelTorque, balanceInertia, SPRING_LENGTH, ALLOYS, WATCH, WATCH_DEFAULTS as D, WATCH_DOMAINS} from './watch-physics.js';
import {createWatchModel, hairspringPoints, mainspringPoints, mainspringTurns, ampPoint, ratePoint, escapeShape} from './watch-model.js';
import {watchLesson, leverEscapementLesson, hairspringLesson} from './watch-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), TAU = Math.PI * 2, deg = x => x * 180 / Math.PI;

// 1. Stiffness, inertia, period.
t.near(balanceInertia(), 49e-6 * 0.0045 ** 2, 1e-18, 'balance inertia');
t.near(SPRING_LENGTH, 195e9 * 0.12e-3 * 0.03e-3 ** 3 / (12 * 49e-6 * 0.0045 ** 2 * (TAU * 4) ** 2), 1e-15, 'spring length for 4 Hz');
for (const index of [-5, 0, 3]) for (const alloy of [0, 1]) for (const temperature of [0, 20, 40]) for (const hours of [0, 20, 42, 43, 44]) {
  const values = {index, alloy, temperature, hours}, b = balance(values), a = ALLOYS[alloy], dT = temperature - 20, grow = 1 + a.expansion * dT;
  const kappa = 195e9 * (1 + a.elastic * dT) * 0.12e-3 * grow * (0.03e-3 * grow) ** 3 / (12 * SPRING_LENGTH * (1 - 2e-4 * index) * grow);
  const inertia = 49e-6 * (0.0045 * (1 + 12e-6 * dT)) ** 2;
  t.near(b.kappa, kappa, 1e-12 * kappa, 'hairspring stiffness from its shape and metal');
  t.near(b.period, TAU * Math.sqrt(inertia / kappa), 1e-12, 'period of the balance');
  const torque = hours <= 42 ? 0.012 * (1 - 0.6 * hours / 42) : Math.max(0, 0.012 * 0.4 * (1 - (hours - 42) / 2));
  t.near(barrelTorque(hours), torque, 1e-15, 'mainspring torque');
  const power = 0.3 * torque * 6.5 * TAU / (42 * 3600);
  t.near(TAU * (kappa * b.amplitude ** 2 / 2) / 250, power * b.period, 1e-9 * power * b.period + 1e-18, 'each period the swing loses what the mainspring gives');
  assert.equal(b.running, b.amplitude >= 110 * Math.PI / 180, 'the lever needs 110 degrees');
  if (b.running) t.near(b.rate, 86400 * (b.frequency / 4 - 1), 1e-9, 'rate against 4 Hz');
}
t.near(balance({}).frequency, 4, 1e-12, 'the default watch beats at exactly 4 Hz');
t.near(balance({index: 1}).rate, 86400 * (1 / Math.sqrt(1 - 2e-4) - 1), 1e-9, 'a regulator mark shortens the spring by 0.02%');
for (const alloy of [0, 1]) {
  const a = ALLOYS[alloy], slope = (balance({alloy, temperature: 21}).rate - balance({alloy, temperature: 19}).rate) / 2;
  t.near(slope, 86400 * (a.elastic + 3 * a.expansion - 2 * 12e-6) / 2, 0.01 * Math.abs(86400 * (a.elastic + 3 * a.expansion - 2 * 12e-6) / 2), 'rate per degree from the modulus, the spring and the balance');
}
// Isochronism: a balance pushed back in proportion to its angle takes the same time for any swing.
for (const degrees of [142.4, 318.3]) {
  const b = balance({}), f = ([th, w]) => [w, -b.kappa / b.inertia * th], dt = b.period / 20000;
  let state = [degrees * Math.PI / 180, 0], time = 0;
  for (;;) {
    const k1 = f(state), k2 = f(state.map((v, i) => v + dt / 2 * k1[i])), k3 = f(state.map((v, i) => v + dt / 2 * k2[i])), k4 = f(state.map((v, i) => v + dt * k3[i]));
    const next = state.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    if (next[0] <= 0) { time += dt * state[0] / (state[0] - next[0]); break; }
    state = next; time += dt;
  }
  t.near(4 * time, b.period, 1e-9, `a ${degrees} degree swing takes the same period`);
}
// 0.0019 s and 0.005 s put the balance inside and just beyond the lever's lift, where the fork follows the roller.
for (const time of [0, 0.0019, 0.005, 0.07, 0.3, 1.23, 1.99]) {
  const s = sampleWatch({}, time);
  t.near(s.angle, s.amplitude * Math.sin(TAU * s.frequency * time), 1e-12, 'balance angle');
  assert.equal(s.beats, Math.floor(2 * s.frequency * time + 1e-9), 'a beat each time the balance passes the middle');
  t.near(s.escape, s.beats * TAU / 30, 1e-15, 'half a tooth of 15 each beat');
  t.near(s.seconds, s.escape / 16, 1e-15, 'the fourth wheel turns a sixteenth as fast');
  t.near(Math.abs(s.fork), Math.abs(s.angle) >= 26 * Math.PI / 180 ? 10 * Math.PI / 180 : 10 * Math.PI / 180 * Math.abs(s.angle) / (26 * Math.PI / 180), 1e-12, 'lever follows the roller only inside the lift');
}
assert.equal(escapeShape().getPoints(1).length, 15 * 3 + 2, 'fifteen teeth of three corners, the start and its closing repeat');

// 2. The drawing.
const m = createWatchModel(), p = m.topology, MM = p.MM;
m.root.position.set(0.1, -0.2, 0.3);
for (const values of [{}, {alloy: 0, temperature: 40, index: -3}, {hours: 43}, {hours: 44}, {index: 5, temperature: 0}]) for (const playback of [0, 0.6, 3.1, 11, 20]) {
  m.reset(); m.update(values); m.advance(playback);
  m.root.updateMatrixWorld(true);
  const s = m.getState();
  t.near(s.time, Math.min(2, playback / 10), 1e-12, 'watch time slowed tenfold');
  t.near(p.wheel.rotation.z, s.angle, 1e-15, 'balance at its angle');
  t.near(p.lever.rotation.z, s.fork, 1e-15, 'lever at its angle');
  t.near(p.escapeWheel.rotation.z, -s.escape, 1e-15, 'escape wheel steps');
  t.near(p.secondsHand.rotation.z, -s.seconds, 1e-15, 'seconds hand on the fourth wheel');
  t.near(p.regulator.rotation.z, s.values.index * 3 * Math.PI / 180, 1e-15, 'regulator at its mark');
  assert.equal(p.coil.material.color.getHex(), p.ALLOY_COLORS[s.values.alloy]);
  const coil = p.coil.geometry.attributes.position, last = coil.count - 1;
  t.near(Math.atan2(coil.getY(last), coil.getX(last)), Math.PI / 2, 1e-6, 'outer end held at the stud');
  t.near(Math.hypot(coil.getX(last), coil.getY(last)) / MM, 3.2, 1e-5, 'outer coil at 3.2 mm');
  const inner = Math.atan2(coil.getY(0), coil.getX(0)), expected = Math.PI / 2 - TAU * 12 + s.angle;
  t.near(Math.cos(inner), Math.cos(expected), 1e-6, 'inner end turns with the balance');
  t.near(Math.sin(inner), Math.sin(expected), 1e-6, 'inner end turns with the balance');
  t.near(Math.hypot(coil.getX(0), coil.getY(0)) / MM, 0.8, 1e-5, 'inner coil at 0.8 mm');
  const spring = p.mainspring.geometry.attributes.position, turns = mainspringTurns(s.values.hours), probe = 157, share = probe / (spring.count - 1);
  t.near(Math.atan2(spring.getY(probe), spring.getX(probe)), Math.atan2(Math.sin(TAU * turns * share), Math.cos(TAU * turns * share)), 1e-5, 'mainspring coiled by its hours');
  t.near(p.ampDot.position.y, ampPoint(s.values.hours, deg(s.amplitude))[1], 1e-12, 'swing chart dot');
  t.near(p.ampLine.geometry.attributes.position.getY(30), ampPoint(30, deg(balance({...s.values, hours: 30}).amplitude))[1], 1e-6, 'swing chart line');
  for (const [alloy, line] of p.rateLines.entries()) t.near(line.geometry.attributes.position.getY(35), ratePoint(35, balance({...s.values, alloy, temperature: 35, hours: 0}).rate)[1], 1e-6, 'rate chart for each alloy');
  t.near(p.rateDot.position.y, ratePoint(s.values.temperature, s.rate ?? 0)[1], 1e-12, 'rate chart dot');
  checkFinite(m.root, t);
}
checkControlsMove(m, () => [p.regulator.rotation.z, p.coil.material.color.getHex(), p.rateDot.position.toArray(), p.ampDot.position.toArray(), p.mainspring.geometry.attributes.position.getX(200)], model => model.advance(0.9), t);

// 3. The lessons, the text, refusals and disposal.
const run = values => { m.reset(); m.update(values); m.advance(3); return m.getState(); };
checkTrialNumbers(watchLesson, {
  'Wind it and watch': st => ({'318.3': deg(st.amplitude), '4': st.frequency, '28,800': st.beatsPerHour, '0.00': Math.abs(st.rate)}),
  'Move the regulator': st => ({'0.02': WATCH.index * 100, '8.64': st.rate}),
  'A day later': st => (t.near(st.rate, 0, 1e-9, 'still keeps time'), {'7.89': st.torque * 1000, '258.0': deg(st.amplitude)}),
  'Nearly run down': st => ({'2.40': st.torque * 1000, '142.4': deg(st.amplitude)}),
  'Stopped': st => (t.ok(!st.running, 'stopped'), {'110': deg(WATCH.minimum)}),
  'A steel hairspring in summer': st => ({'99.21': -st.rate}),
  'Nivarox in summer': st => ({'2.59': st.rate}),
  'Where the energy goes': st => ({'0.972': st.power * 1e6, '0.122': st.beatEnergy * 1e6, '9.67': st.energy * 1e6}),
}, run, t);
checkTrialNumbers(leverEscapementLesson, {
  'Lock, unlock, push': () => ({'10': deg(WATCH.fork), '15': WATCH.teeth, '12': 360 / (2 * WATCH.teeth)}),
  'Counting to sixty': st => ({'8': 2 * st.frequency, '16': WATCH.fourth, '1': 1}),
  'A push every beat': st => (t.near(TAU * st.energy / WATCH.Q / 2, st.beatEnergy, 1e-9 * st.beatEnergy, 'a beat’s push is a beat’s loss'), {'0.122': st.beatEnergy * 1e6}),
  'Free most of the time': st => ({'26': deg(WATCH.lift) / 2, '318.3': deg(st.amplitude)}),
  'A weaker push': st => (t.ok(st.running, 'still running'), {'221.8': deg(st.amplitude), '0.059': st.beatEnergy * 1e6}),
  'Too little swing': st => (t.ok(!st.running, 'stopped'), {'110': deg(WATCH.minimum)}),
}, run, t);
checkTrialNumbers(hairspringLesson, {
  'The spring sets the beat': st => ({'84.00': st.length * 1000, '0.03': WATCH.thickness * 1000, '0.627': st.kappa * 1e6, '9.92': st.inertia / 1e-10, '4': st.frequency}),
  'A shorter spring, a faster beat': st => ({'0.10': 5 * WATCH.index * 100, '43.23': st.rate}),
  'Steel softens in the heat': st => ({'0.624': st.kappa * 1e6, '198.56': -st.rate}),
  'And stiffens in the cold': st => ({'198.02': st.rate}),
  'The compensating alloy': st => ({'2.59': st.rate}),
  'Wide and narrow swings': st => ({'221.8': deg(st.amplitude), '0.250000': st.period}),
}, run, t);
checkQuotedText(watchLesson.deeper.map(section => section.body).join(' '), {'about 10 s a day': `about ${fixed(Math.abs(balance({alloy: 0, temperature: 21}).rate - balance({alloy: 0, temperature: 20}).rate), 0)} s a day`, 'about 42 hours': `about ${WATCH.reserve} hours`}, t);
checkQuotedText(hairspringLesson.deeper.map(section => section.body).join(' '), {'10% thinner is 27% softer': `10% thinner is ${fixed((1 - 0.9 ** 3) * 100, 0)}% softer`}, t);
checkQuotedText(watchLesson.limits, {'49 mg': `${fixed(WATCH.mass * 1e6, 0)} mg`, '4.5 mm': `${fixed(WATCH.radius * 1000, 1)} mm`, '195 GPa': `${fixed(WATCH.modulus / 1e9, 0)} GPa`, '0.02%': `${fixed(WATCH.index * 100, 2)}%`, 'Q of 250': `Q of ${WATCH.Q}`}, t);
checkQuotedText(m.parts.map(part => part.description).join(' '), {'84 mm long': `${fixed(SPRING_LENGTH * 1000, 0)} mm long`, '0.12 mm tall': `${fixed(WATCH.width * 1000, 2)} mm tall`, '10 degrees': `${fixed(deg(WATCH.fork), 0)} degrees`, '15-tooth': `${WATCH.teeth}-tooth`}, t);
checkRefusals(sampleWatch, WATCH_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS watch model: ${t.count} checks, ${watchLesson.tryIt.length + leverEscapementLesson.tryIt.length + hairspringLesson.tryIt.length} trials, ${resources} resources`);

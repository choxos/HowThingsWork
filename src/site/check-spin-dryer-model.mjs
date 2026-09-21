// Spin dryer: the layer pressure integrated through the layer, the pore
// spread integrated directly, the drainage and energy integrated again, the
// cabinet's shaking from a direct integration of its forced motion, the drawing
// held to the state, and every number the lesson quotes held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleSpin, spinPlan, layerPressure, holdingRadius, normalShare, equilibriumMoisture, drainTime, speedAt, windagePower, shaking, omegaOf, SPIN, SPIN_DOMAINS} from './spin-dryer-physics.js';
import {createSpinDryerModel, laundryColor, moisturePoint, shakePoint, drawnDrumAngle, swayAt, jugLevel} from './spin-dryer-model.js';
import {spinDryerLesson} from './spin-dryer-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), TAU = Math.PI * 2;

// 1. Pressure, pores and the water left.
for (const rpm of [500, 1400, 2800]) {
  const w = omegaOf(rpm);
  let pressure = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) { const r = 0.11 + (i + 0.5) * 0.04 / N; pressure += 1000 * w * w * r * 0.04 / N; }
  t.near(layerPressure(w), pressure, 1e-6 * pressure, 'pressure across the layer');
  t.near(holdingRadius(pressure), 2 * 0.072 * 0.9 / pressure, 1e-15, 'widest pore that holds');
  // Share of pore space in pores narrower than that, integrated over the log-normal spread.
  const cut = Math.log(holdingRadius(pressure) / 5e-6) / 1.2;
  let share = 0;
  for (let i = 0; i < 200000; i++) { const z = -12 + (i + 0.5) * (cut + 12) / 200000; share += Math.exp(-z * z / 2) / Math.sqrt(TAU) * (cut + 12) / 200000; }
  t.near(normalShare(cut), share, 2e-7, 'normal distribution share');
  t.near(equilibriumMoisture(w), 0.45 + 1.05 * share, 1e-6, 'water left once drained');
  t.near(drainTime(w), 15 * 1e5 / pressure, 1e-9, 'drain time constant');
}
for (const values of [{}, {rpm: 800}, {rpm: 1400, load: 4}]) {
  const plan = spinPlan(values), full = {rpm: 2800, load: 2, imbalance: 0.1, ...values};
  let moisture = 1.5, energy = 0;
  const dt = 0.002;
  for (let n = 0; n * dt < 180 - 1e-9; n++) {
    const time = n * dt, w = omegaOf(full.rpm) * Math.min(1, time / 20), eq = equilibriumMoisture(w), tau = drainTime(w);
    if (moisture > eq) moisture = eq + (moisture - eq) * Math.exp(-dt / tau);
    energy += (150 * (w / omegaOf(2800)) ** 3 + (time < 20 ? full.load * 2.5 * 0.15 ** 2 * omegaOf(full.rpm) / 20 * w : 0)) * dt;
  }
  t.near(plan.final, moisture, 2e-4, `${JSON.stringify(values)}: water left after the spin`);
  t.near(plan.removed, (1.5 - moisture) * full.load, 5e-4, 'water spun out');
  t.near(plan.spinEnergy, energy, 2e-3 * energy, 'energy spent spinning');
  t.near(plan.evaporationEnergy, plan.removed * 2.26e6, 1e-6, 'energy to boil the same water away');
}
// Shaking: integrate the cabinet's forced motion until it settles, and measure its swing.
for (const [imbalance, rpm] of [[0.1, 200], [0.1, 382], [0.3, 500], [0.1, 2800]]) {
  const w = omegaOf(rpm), M = 25, k = 4e4, c = 2 * 0.1 * Math.sqrt(k * M), F = imbalance * 0.15 * w * w;
  let x = 0, v = 0, time = 0, biggest = 0;
  const dt = Math.min(2e-4, 2 * Math.PI / w / 200), settle = 20 * M / c;
  const accel = (tt, xx, vv) => (F * Math.cos(w * tt) - c * vv - k * xx) / M;
  while (time < settle + 4 * Math.PI / w) {
    const k1v = accel(time, x, v), k1x = v, k2v = accel(time + dt / 2, x + dt / 2 * k1x, v + dt / 2 * k1v), k2x = v + dt / 2 * k1v;
    const k3v = accel(time + dt / 2, x + dt / 2 * k2x, v + dt / 2 * k2v), k3x = v + dt / 2 * k2v, k4v = accel(time + dt, x + dt * k3x, v + dt * k3v), k4x = v + dt * k3v;
    x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x); v += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v); time += dt;
    if (time > settle) biggest = Math.max(biggest, Math.abs(x));
  }
  t.near(shaking(imbalance, w).amplitude, biggest, 0.01 * biggest, `shaking at ${rpm} rpm`);
}
t.near(shaking(0, 0).natural * 60 / TAU, Math.sqrt(4e4 / 25) * 60 / TAU, 1e-9, 'natural shaking speed');

// 2. The drawing.
const m = createSpinDryerModel(), p = m.topology, MM = p.MM;
m.root.position.set(0.2, -0.4, 0.3);
for (const values of [{}, {rpm: 800, imbalance: 0.3}, {imbalance: 0, load: 4}, {rpm: 500}]) for (const clock of [0, 5, 12.7, 30, 120, 185]) {
  m.reset(); m.update(values); m.advance(clock / p.SPEED_UP);
  m.root.updateMatrixWorld(true);
  const s = m.getState();
  t.near(s.clock, clock, 1e-9, 'clock six times playback');
  t.near(p.shell.position.x / MM / 1000, s.amplitude * Math.sin(TAU * 4 * clock), 1e-12, 'cabinet sways at its true amplitude');
  const ramp = 20, tt = Math.min(clock, 180);
  t.near(p.spinner.rotation.y, TAU * s.values.rpm / 2800 * (tt <= ramp ? tt * tt / (2 * ramp) : ramp / 2 + tt - ramp), 1e-9, 'drum drawn turning in proportion to its speed');
  assert.equal(p.lump.visible, s.values.imbalance > 0);
  if (s.values.imbalance > 0) t.near(p.lump.scale.x / MM, Math.cbrt(3 * s.values.imbalance / 1000 / (4 * Math.PI)) * 1000, 1e-9, 'lump drawn as big as its wet laundry');
  const wet = new THREE.Color(0x4f6272).lerp(new THREE.Color(0xf0dfaf), Math.max(0, Math.min(1, (1.5 - s.moisture) / 1.05)));
  t.ok(Math.abs(p.layerMesh.material.color.r - wet.r) < 1e-9, 'laundry colored by its water');
  const shown = Math.round(p.DROPS * Math.max(0, Math.min(1, Math.max(0, s.moisture - s.equilibriumNow) / 0.3)));
  assert.equal(p.drops.filter(drop => drop.visible).length, s.w > 0 ? shown : 0, 'drops flying as fast as water leaves');
  const removed = (1.5 - s.moisture) * s.values.load, level = Math.max(1e-3, Math.min(p.JUG.height - 2, removed / 1000 / (Math.PI * ((p.JUG.radius - 2) / 1000) ** 2) * 1000));
  t.near(p.collected.scale.y / MM, level, 1e-9, 'jug holds the water spun out');
  const moisture = p.moistureLine.geometry.attributes.position;
  for (const i of [0, 15, 90, 185]) t.near(moisture.getY(i), moisturePoint(s.samples[i].t, s.samples[i].moisture)[1], 1e-6, 'water chart');
  t.near(p.shakeLine.geometry.attributes.position.getY(8), shakePoint(400, shaking(s.values.imbalance, omegaOf(400)).amplitude)[1], 1e-6, 'shaking chart');
  t.near(p.shakeDot.position.y, shakePoint(s.rpmNow, s.amplitude)[1], 1e-12, 'shaking dot at now');
  checkFinite(m.root, t);
}
checkControlsMove(m, () => [p.moistureLine.geometry.attributes.position.getY(40), p.shakeDot.position.toArray(), p.lump.visible, p.lump.scale.x, p.spinner.rotation.y, p.collected.scale.y], model => model.advance(25 / p.SPEED_UP), t);

// 3. The lesson, the text, refusals and disposal.
const run = values => { m.reset(); m.update(values); m.advance(100); return m.getState(); };
checkTrialNumbers(spinDryerLesson, {
  'Spin a load': st => ({'1,315': st.gForce, '30': 30, '150': 1.5 * 100, '46.8': sampleSpin(st.values, 30).moisture * 100, '45.9': st.final * 100, '2.081': st.removed}),
  'Why it stops at 46%': st => ({'447.1': st.pressure / 1000, '0.29': st.holding * 1e6, '45': SPIN.bound * 100, '100': 100}),
  'A washing machine’s spin': st => ({'329': st.gForce, '56.7': st.final * 100, '1.866': st.removed}),
  'A gentle spin': st => ({'107': st.gForce, '86.9': st.final * 100, '1.738': st.final * st.values.load}),
  'Spinning beats heating': st => ({'2.081': st.removed, '29.6': st.spinEnergy / 1000, '4.70': st.evaporationEnergy / 1e6, '159': st.evaporationEnergy / st.spinEnergy}),
  'The shake on the way up': st => ({'386': st.peak.rpm, '382': st.natural * 60 / TAU, '0.1': st.values.imbalance, '3.01': st.peak.amplitude * 1000, '0.61': st.running.amplitude * 1000}),
  'A badly balanced load': st => ({'3,869': st.running.force, '9.04': st.peak.amplitude * 1000, '386': st.peak.rpm}),
  'A balanced load': st => (t.near(st.final, spinPlan({}).final, 1e-12, 'the same water out'), {'0.00': st.peak.amplitude * 1000}),
}, run, t);
checkQuotedText(spinDryerLesson.deeper.map(section => section.body).join(' '), {'44 m/s': `${fixed(omegaOf(2800) * SPIN.radius, 0)} m/s`}, t);
checkQuotedText(spinDryerLesson.limits, {'300 mm': `${fixed(SPIN.radius * 2000, 0)} mm`, '40 mm layer': `${fixed(SPIN.layer * 1000, 0)} mm layer`, '0.072 N/m': `${SPIN.tension} N/m`, '150 W': `${SPIN.windage} W`, '25 kg': `${SPIN.cabinet} kg`}, t);
checkQuotedText(m.parts.map(part => part.description).join(' '), {'44 m/s': `${fixed(omegaOf(2800) * SPIN.radius, 0)} m/s`, 'over 1,300 times': `over ${fixed(Math.floor(omegaOf(2800) ** 2 * SPIN.radius / SPIN.g / 100) * 100, 0)} times`, '40 mm thick': `${fixed(SPIN.layer * 1000, 0)} mm thick`}, t);
checkRefusals(sampleSpin, SPIN_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS spin dryer model: ${t.count} checks, ${spinDryerLesson.tryIt.length} trials, ${resources} resources`);

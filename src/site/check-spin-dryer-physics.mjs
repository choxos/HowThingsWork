import assert from 'node:assert/strict';
import {SPIN as S, SPIN_DEFAULTS as D, SPIN_DOMAINS, sampleSpin, spinPlan, sampleSpinPlan, speedAt, rotationAt, layerPressure, holdingRadius, normalShare, equilibriumMoisture, shaking, dropFlight, omegaOf} from './spin-dryer-physics.js';
import {tally, checkRefusals} from './model-check-kit.mjs';
const t = tally(), TAU = Math.PI * 2;
// Integrate the normal density independently; the model uses a rational CDF.
for (const z of [-8, -5, -3, -1, 0, 1, 3, 5, 8]) {
  let area = 0; const n = 20000, h = (z + 12) / n;
  for (let i = 0; i < n; i++) {const x = -12 + (i + .5) * h; area += Math.exp(-x * x / 2) / Math.sqrt(TAU) * h;}
  t.near(normalShare(z), area, 1.6e-7, 'independent integrated pore-volume distribution');
}
for (const rpm of [0, 50, 400, 800, 1400, 2800, 3000]) {
  const w = rpm * TAU / 60; let pressure = 0;
  for (let i = 0; i < 10000; i++) pressure += 1000 * w * w * (.11 + (i + .5) * .04 / 10000) * .04 / 10000;
  t.near(layerPressure(w), pressure, 1e-6, 'radial liquid pressure integral');
  if (rpm) t.near(holdingRadius(pressure), 2 * .072 * .9 / pressure, 1e-15, 'capillary pressure balance');
  else assert.equal(holdingRadius(0), Infinity);
  for (const time of [.1, 1.37, 19.99, 20, 75, 179.99, 180, 190, 199.99, 200]) {
    const dt = 1e-4, numerical = (rotationAt(rpm, time + dt) - rotationAt(rpm, time - dt)) / (2 * dt);
    t.near(numerical, speedAt(rpm, time), w * dt / 80 + 2e-7, 'angle derivative equals prescribed speed, including transition endpoints');
  }
  t.near(speedAt(rpm, 200), 0, 0, 'finite brake reaches rest');
  t.near(rotationAt(rpm, 300), w * 180, 1e-10, 'exact total angle with two finite ramps');
}
// Independent CDF implementation (erfc approximation from Numerical Recipes),
// independent RK4 drainage integration, and independent speed schedule.
function cdf(z) {
  const x = Math.abs(z) / Math.SQRT2, u = 1 / (1 + .5 * x);
  const erfc = u * Math.exp(-x * x - 1.26551223 + u * (1.00002368 + u * (.37409196 + u * (.09678418 + u * (-.18628806 + u * (.27886807 + u * (-1.13520398 + u * (1.48851587 + u * (-.82215223 + u * .17087277)))))))));
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}
function referenceRate(v, time, m) {
  const rpm = !v.lid ? 0 : time < 20 ? v.rpm * time / 20 : time < 180 ? v.rpm : Math.max(0, v.rpm * (200 - time) / 20);
  const w = rpm * TAU / 60, pressure = 1000 * w * w * (.15 ** 2 - .11 ** 2) / 2;
  if (!v.wall || !v.lid || v.experiment || !pressure) return 0;
  const radius = 2 * .072 * .9 / pressure, equilibrium = .45 + 1.05 * cdf(Math.log(radius / 5e-6) / 1.2);
  return -Math.max(0, m - equilibrium) * pressure / 1.5e6;
}
let integrations = 0;
for (const input of [{}, {rpm: 50}, {rpm: 400}, {rpm: 800}, {rpm: 1400}, {rpm: 3000}, {load: 4}, {load: 1}, {wall: 0}, {lid: 0}, {rpm: 0}, {experiment: 1}]) {
  const v = {...D, ...input}, plan = spinPlan(v), dt = .005; let moisture = 1.5;
  for (let i = 0; i < 40000; i++) {
    const time = i * dt, k1 = referenceRate(v, time, moisture), k2 = referenceRate(v, time + dt / 2, moisture + dt * k1 / 2), k3 = referenceRate(v, time + dt / 2, moisture + dt * k2 / 2), k4 = referenceRate(v, time + dt, moisture + dt * k3);
    moisture += dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    if (i % 137 === 0 && !v.experiment) t.near(sampleSpinPlan(plan, (i + 1) * dt).moisture, moisture, 1.5e-6, 'independent RK4 intermediate moisture');
  }
  t.near(plan.final, moisture, 1.5e-6, 'independent RK4 final moisture'); integrations++;
}
let balances = 0;
for (const rpm of [0, 50, 400, 800, 1400, 2800, 3000]) for (const load of [1, 2, 4]) for (const wall of [0, 1]) for (const lid of [0, 1]) {
  const plan = spinPlan({rpm, load, wall, lid}); let previous = 1.5;
  for (let i = 0; i <= 400; i++) {
    const s = sampleSpinPlan(plan, i / 2);
    t.near(s.retained + s.removed, load * 1.5, 1e-12, 'complete water conservation');
    t.ok(s.moisture <= previous + 1e-12 && s.moisture >= .45, 'no water creation or rewetting');
    t.ok(s.rate >= 0 && s.removed >= 0, 'nonnegative extraction and collection');
    if (!wall || !lid || !rpm) {t.near(s.moisture, 1.5, 0, 'closed boundary or stationary load retains water'); t.near(s.rate, 0, 0, 'blocked drainage exactly zero');}
    previous = s.moisture; balances++;
  }
}
// Independent integration of the forced 2D support from rest. Compare a settled
// orbit to the analytical amplitude and phase, never to a run-up claim.
let oscillatorRuns = 0;
for (const [rpm, mass, damping] of [[200, .1, .1], [400, .3, .05], [400, .3, .3], [2800, .3, .1]]) {
  const w = rpm * TAU / 60, F = mass * .13 * w * w, c = 2 * damping * Math.sqrt(40000 * 25), dt = .0002;
  const derivative = (time, a) => [a[1], (F * Math.cos(w * time) - c * a[1] - 40000 * a[0]) / 25, a[3], (-F * Math.sin(w * time) - c * a[3] - 40000 * a[2]) / 25];
  let a = [0, 0, 0, 0];
  for (let i = 0; i < 60000; i++) {const time = i * dt, k1 = derivative(time, a), k2 = derivative(time + dt / 2, a.map((x, j) => x + dt * k1[j] / 2)), k3 = derivative(time + dt / 2, a.map((x, j) => x + dt * k2[j] / 2)), k4 = derivative(time + dt, a.map((x, j) => x + dt * k3[j])); a = a.map((x, j) => x + dt * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);}
  const s = shaking(mass, w, damping), phase = w * 12 - s.lag;
  t.near(a[0], s.amplitude * Math.cos(phase), 2e-7, 'settled X from independent RK4');
  t.near(a[2], -s.amplitude * Math.sin(phase), 2e-7, 'settled Z from independent RK4');
  oscillatorRuns++;
}
for (const damping of [.05, .1, .2, .3, .4]) for (const mass of [0, .05, .15, .3]) {
  const peak = shaking(mass, 0, damping);
  t.near(shaking(mass, peak.peakW, damping).amplitude, peak.peakAmplitude, 1e-14, 'analytical peak of rotating-force response');
  t.ok(peak.peakAmplitude < .018, 'complete allowed response fits fixed chart range');
  t.near(shaking(mass, 1e7, damping).amplitude, mass * .13 / 25, 1e-12, 'finite high-speed displacement limit');
  for (const rpm of [0, 50, 400, 1400, 3000]) for (const time of [0, .123, 4, 12]) {
    const s = sampleSpin({experiment: 1, rpm, imbalance: mass, damping}, time);
    t.near(Math.hypot(...s.displacement), s.shake.amplitude, 1e-15, 'constant circular orbit radius');
    t.near(s.removed, 0, 0, 'steady experiment does not pretend to extract water');
    t.near(s.angle, omegaOf(rpm) * time / 200, 1e-13, 'shared slowed force/rotor phase');
  }
}
let flights = 0;
for (const rpm of [50, 400, 800, 1400, 2800, 3000]) for (let i = 0; i < 24; i++) {
  const w = rpm * TAU / 60, angle = i * TAU / 24, start = dropFlight(w, angle, 0, .2), end = dropFlight(w, angle, Infinity, .2), age = end.hitTime / 2, a = dropFlight(w, angle, age, .2);
  t.near(Math.hypot(end.x, end.z), .185, 1e-14, 'ballistic drop hits actual tub radius');
  t.near((a.x - start.x) * start.x + (a.z - start.z) * start.z, 0, 1e-14, 'top-view departure exactly tangent');
  t.near(a.y, .2 - 9.81 * age ** 2 / 2, 1e-14, 'vertical gravitational fall');
  t.near(Math.hypot(a.x - start.x, a.z - start.z) / age, .15 * w, 1e-12, 'horizontal speed remains release rim speed');
  assert.equal(end.caught, true); flights++;
}
checkRefusals(sampleSpin, SPIN_DOMAINS, t);
console.log(`PASS spin dryer physics: ${t.count} checks; ${integrations} independent drainage integrations; ${balances} water-balance states; ${oscillatorRuns} independent oscillator integrations; ${flights} ballistic trajectories`);

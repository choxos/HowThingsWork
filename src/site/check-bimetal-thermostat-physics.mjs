import assert from 'node:assert/strict';
import {BIMETAL_DEFAULTS, BIMETAL_DOMAINS, BIMETAL_MATERIAL, BIMETAL_BEAM, DECLARED, bimetalPlan, bimetalAt, bimetalBeamAt, curvatureAt, stripTipAt, temperatureForTip} from './thermostat-physics.js';

let checks = 0;
function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}`);
  checks++;
}
const yes = (value, label) => { assert.ok(value, label); checks++; };
const source = {brassAlpha: 19e-6, ironAlpha: 12e-6, brassYoung: 110e9, ironYoung: 207e9};
assert.deepEqual(BIMETAL_MATERIAL, source);
assert.equal(DECLARED.roomCapacity, 300000);
assert.equal(DECLARED.roomLoss, 55);
assert.equal(DECLARED.snap, 20e-6);
assert.equal(DECLARED.roomRun, 5400);
assert.equal(DECLARED.stripLength, 0.05);
assert.equal(DECLARED.stripWidth, 0.006);
assert.equal(DECLARED.stripThickness, 0.0006);
checks += 8;

const layers = [[-0.0003, 0, 110e9, 19e-6], [0, 0.0003, 207e9, 12e-6]];
let A = 0, B = 0, D = 0, N = 0, M = 0;
for (const [bottom, top, modulus, alpha] of layers) {
  A += modulus * (top - bottom);
  B += modulus * (top ** 2 - bottom ** 2) / 2;
  D += modulus * (top ** 3 - bottom ** 3) / 3;
  N += modulus * alpha * (top - bottom);
  M += modulus * alpha * (top ** 2 - bottom ** 2) / 2;
}
const curvaturePerK = (B * N - A * M) / (A * D - B ** 2);
const tipPerK = curvaturePerK * 0.05 ** 2 / 2;
const rigidity = 0.006 * (D - B ** 2 / A);
near(BIMETAL_BEAM.bendingRigidity, rigidity, 1e-14, 'laminate neutral-axis rigidity');
near(BIMETAL_BEAM.neutralAxis, B / A, 1e-16, 'laminate neutral axis');
near(BIMETAL_BEAM.tipStiffness, 3 * rigidity / 0.05 ** 3, 1e-10, 'cantilever stiffness');
for (const temperature of [-20, 0, 5, 14, 19, 20, 21, 26, 40, 120]) {
  const k = curvatureAt(temperature), delta = temperature - 20;
  const extension = (N * delta + B * k) / A;
  near(k, curvaturePerK * delta, 1e-13, 'curvature from zero resultant force and moment');
  near(A * extension - B * k - N * delta, 0, 1e-7, 'zero free-strip axial force per width');
  near(B * extension - D * k - M * delta, 0, 1e-10, 'zero free-strip bending moment per width');
  near(stripTipAt(temperature), tipPerK * delta, 1e-16, 'free tip');
  near(temperatureForTip(tipPerK * delta), temperature, 1e-10, 'inverse tip temperature');
}

function rk4(temperature, dt, power, outdoor) {
  const rate = value => (power - 55 * (value - outdoor)) / 300000;
  const a = rate(temperature), b = rate(temperature + a * dt / 2), c = rate(temperature + b * dt / 2), d = rate(temperature + c * dt);
  const environment = 55 * dt / 6 * ((temperature - outdoor) + 2 * (temperature + a * dt / 2 - outdoor) + 2 * (temperature + b * dt / 2 - outdoor) + (temperature + c * dt - outdoor));
  return {temperature: temperature + dt * (a + 2 * b + 2 * c + d) / 6, environment};
}
function oracle(values) {
  let temperature = values.start, closed = temperature < values.setting, time = 0, onTime = 0, environment = 0;
  const closeAt = values.setting - 20e-6 / tipPerK, events = [];
  while (time < 5400 - 1e-9) {
    let dt = Math.min(0.5, 5400 - time);
    const power = closed ? values.power : 0, target = closed ? values.setting : closeAt;
    let next = rk4(temperature, dt, power, values.outdoor);
    const crossing = closed ? next.temperature >= target : next.temperature <= target;
    if (crossing) {
      let low = 0, high = dt;
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2, value = rk4(temperature, mid, power, values.outdoor).temperature;
        if (closed ? value >= target : value <= target) high = mid; else low = mid;
      }
      dt = (low + high) / 2; next = rk4(temperature, dt, power, values.outdoor);
    }
    time += dt; onTime += closed ? dt : 0; environment += next.environment; temperature = next.temperature;
    if (crossing) { closed = !closed; temperature = target; events.push({t: time, closed}); }
  }
  return {temperature, closed, onTime, environment, events};
}

const cases = [], keys = Object.keys(BIMETAL_DOMAINS);
for (const [key, [min, max, step]] of Object.entries(BIMETAL_DOMAINS)) {
  for (let value = min; value <= max; value += step) cases.push({...BIMETAL_DEFAULTS, [key]: value});
}
assert.equal(cases.length, 90); checks++;
for (let mask = 0; mask < 16; mask++) cases.push(Object.fromEntries(keys.map((key, index) => [key, BIMETAL_DOMAINS[key][(mask >> index) & 1]])));
let minTemperature = Infinity, maxTemperature = -Infinity, eventCount = 0;
for (const values of cases) {
  const plan = bimetalPlan(values), expected = oracle(values), end = bimetalAt(plan, 5400), ready = bimetalAt(plan, 0);
  assert.equal(ready.on, false); assert.equal(ready.power, 0); assert.equal(ready.switches, 0); assert.equal(ready.inputEnergy, 0); checks += 4;
  near(end.celsius, expected.temperature, 2e-8, 'RK4 room temperature');
  near(end.onTime, expected.onTime, 2e-6, 'RK4 heater time');
  near(end.environmentEnergy, expected.environment, 0.01, 'independent environment quadrature');
  assert.equal(end.closed, expected.closed); assert.equal(plan.events.length, expected.events.length); checks += 2;
  for (let i = 0; i < plan.events.length; i++) {
    const event = plan.events[i];
    near(event.t, expected.events[i].t, 2e-6, 'event time from RK4 and bisection');
    assert.equal(bimetalAt(plan, event.t - 1e-7).closed, !event.closed);
    assert.equal(bimetalAt(plan, event.t).closed, event.closed);
    assert.equal(bimetalAt(plan, event.t + 1e-7).closed, event.closed); checks += 3;
    near(bimetalAt(plan, event.t).celsius, event.closed ? plan.closesAt : plan.opensAt, 1e-12, 'exact event temperature');
    eventCount++;
  }
  for (const time of [...Array.from({length: 91}, (_, i) => i * 60), ...plan.events.flatMap(event => [event.t - 1e-7, event.t])]) {
    const now = bimetalAt(plan, time), root = bimetalBeamAt(plan, now, 0), tip = bimetalBeamAt(plan, now);
    minTemperature = Math.min(minTemperature, now.celsius); maxTemperature = Math.max(maxTemperature, now.celsius);
    yes(now.duty >= 0 && now.duty <= 1, 'elapsed duty bounded');
    yes(now.switches <= plan.events.length, 'elapsed switches bounded');
    near(now.inputEnergy, now.storedEnergy + now.environmentEnergy, 2e-9, 'energy balance');
    near(root.y, 0, 1e-18, 'clamp fixed position'); near(root.slope, 0, 1e-18, 'clamp fixed slope');
    if (now.closed) {
      near(tip.y, plan.tipAtClose, 1e-18, 'loaded strip touches fixed contact');
      near(tip.force, (plan.tipAtClose - now.tip) * 3 * rigidity / 0.05 ** 3, 1e-13, 'contact load from tip compliance');
      yes(tip.force >= -20e-6 * BIMETAL_BEAM.tipStiffness - 1e-10, 'magnet force below release threshold');
    } else {
      near(tip.y, now.tip, 1e-18, 'open strip is free');
      yes(tip.y >= plan.tipAtClose - 1e-12, 'open contact never penetrates pad');
      near(tip.force, 0, 1e-18, 'no contact force while open');
    }
    const x = 0.023, beam = bimetalBeamAt(plan, now, x);
    near(beam.y, now.curvature * x ** 2 / 2 + tip.force * x ** 2 * (3 * 0.05 - x) / (6 * rigidity), 1e-16, 'loaded beam by force expression');
    near(beam.slope, now.curvature * x + tip.force * x * (2 * 0.05 - x) / (2 * rigidity), 1e-15, 'loaded slope by force expression');
  }
}
yes(minTemperature > 0 && maxTemperature <= 26, 'all sweep samples fit the 0 to 30 C chart');
const normal = bimetalPlan(), strong = bimetalPlan({power: 3000}), weak = bimetalPlan({setting: 26, outdoor: -10, power: 500, start: 5}), warm = bimetalPlan({setting: 10, outdoor: 15, start: 14});
yes(strong.events[0].t < normal.events[0].t, 'more power reaches setting sooner');
yes(weak.limit === 'insufficientHeat' && weak.events.length === 0 && bimetalAt(weak, 5400).celsius < 5, 'weak heater cannot offset cold-room loss');
yes(warm.limit === 'noCooling' && warm.events.length === 0 && bimetalAt(warm, 5400).duty === 0, 'heater cannot cool warm outdoors');
near(bimetalAt(normal, 99999).t, 5400, 0, 'time stops at duration');
for (const invalid of [NaN, Infinity, -1, '2']) { assert.throws(() => bimetalAt(normal, invalid)); checks++; }
for (const [key, [min, max, step]] of Object.entries(BIMETAL_DOMAINS)) {
  for (const value of [NaN, Infinity, '1', min - step, max + step, min + step / 2]) { assert.throws(() => bimetalPlan({[key]: value})); checks++; }
}
for (const invalid of [null, [], 3, {unknown: 0}]) { assert.throws(() => bimetalPlan(invalid)); checks++; }
console.log(JSON.stringify({status: 'passed', checks, cases: cases.length, singleControlValues: 90, corners: 16, eventCount, temperatureRange: [minTemperature, maxTemperature], band: normal.band, firstOpeningSeconds: normal.events[0].t}));

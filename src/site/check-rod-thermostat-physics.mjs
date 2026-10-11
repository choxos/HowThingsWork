import assert from 'node:assert/strict';
import {ROD_DEFAULTS, ROD_DOMAINS, ROD_MATERIAL, ROD_GAS, DECLARED, differentialAt, rodPlan, rodAt, sampleRod} from './thermostat-physics.js';

let checks = 0, combinations = 0, integrated = 0, crossings = 0;
const near = (actual, expected, tolerance, label) => { assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}`); checks++; };
const ok = (condition, label) => { assert.ok(condition, label); checks++; };
assert.deepEqual(ROD_DEFAULTS, {setting: 200, start: 20, supply: 20, bypass: 1});
assert.deepEqual(ROD_DOMAINS, {setting: [120, 260, 10], start: [15, 300, 5], supply: [10, 25, 1], bypass: [0, 1, 1]});
assert.deepEqual(ROD_MATERIAL, {brassAlpha: 19e-6, steelAlpha: 12e-6});
assert.deepEqual(ROD_GAS, {molarMass: 0.0160425, molarHeat: 890350, constant: 8.31, inletKelvin: 298.15, atmosphere: 101325, discharge: 0.6});
for (const [key, expected] of Object.entries({rodLength: 0.2, rodAt: 20, valveBore: 0.012, bypassBore: 0.00045, ovenCapacity: 12000, ovenLoss: 5, ovenAmbient: 20, burnerEfficiency: 0.45, ovenRun: 2400})) near(DECLARED[key], expected, 0, key);

// Independent force-free expansion, curtain flow and energy balance, with literal source and declared values.
function oracle(values) {
  const {setting = 200, start = 20, supply = 20, bypass = 1} = values;
  function gas(gauge) {
    const molarDensity = (101325 + 100 * gauge) / (8.31 * 298.15);
    const rho = 0.0160425 * molarDensity;
    const velocity = 0.6 * Math.sqrt(2 * 100 * gauge / rho);
    return {molarDensity, rho, velocity, heat: molarDensity * 890350};
  }
  const nominal = gas(20), actual = gas(supply);
  const nominalBypass = Math.PI * 0.00045 ** 2 / 4 * nominal.velocity;
  const nominalGain = Math.PI * 0.012 * 0.2 * (19e-6 - 12e-6) * nominal.velocity;
  const closure = setting + (5 * (setting - 20) / (0.45 * nominal.heat) - nominalBypass) / nominalGain;
  const offset = 0.2 * (19e-6 - 12e-6) * (closure - 20);
  function at(temp) {
    const tube = 0.2 * (1 + 19e-6 * (temp - 20));
    const rod = 0.2 * (1 + 12e-6 * (temp - 20));
    const lift = Math.max(0, offset - (tube - rod));
    const area = Math.PI * 0.012 * lift;
    const main = area * actual.velocity;
    const bleed = bypass * Math.PI * 0.00045 ** 2 / 4 * actual.velocity;
    return {lift, main, bleed, flow: main + bleed};
  }
  const flame = at(start).flow > 1e-16;
  function derivative([temp]) {
    const q = at(temp).flow;
    const heat = flame ? q * actual.heat * 0.45 : 0;
    const loss = 5 * (temp - 20);
    return [(heat - loss) / 12000, q, heat, loss];
  }
  return {start, closure, at, derivative, flame, ...actual};
}

for (const temp of [15, 20, 120, 200, 300]) {
  const brass = 0.2 * (1 + 19e-6 * (temp - 20)), steel = 0.2 * (1 + 12e-6 * (temp - 20));
  near(differentialAt(temp), brass - steel, 1e-16, 'tube minus rod length');
}
near(differentialAt(1, 0.2, 0), 1.4e-6, 1e-20, 'differential travel per kelvin');

const singles = Object.entries(ROD_DOMAINS).flatMap(([key, [lo, hi, step]]) => Array.from({length: Math.round((hi - lo) / step) + 1}, (_, i) => ({...ROD_DEFAULTS, [key]: lo + i * step})));
const corners = [120, 260].flatMap(setting => [15, 300].flatMap(start => [10, 25].flatMap(supply => [0, 1].map(bypass => ({setting, start, supply, bypass})))));
const trials = [...singles, ...corners, {setting: 120, start: 220, supply: 20, bypass: 1}, {setting: 120, start: 220, supply: 20, bypass: 0}];
const maxError = {temperature: 0, volume: 0, inputEnergy: 0, environmentEnergy: 0};
for (const values of trials) {
  const expected = oracle(values), plan = rodPlan(values);
  near(plan.shutsAt, expected.closure, 1e-12, 'fixed nominal dial calibration');
  near(plan.density, expected.rho, 1e-15, 'upstream absolute pressure for density');
  near(plan.molarDensity, expected.molarDensity, 1e-13, 'upstream volume basis');
  ok(plan.ignites === expected.flame, 'ignition depends on initial gas availability');
  let state = [values.start, 0, 0, 0];
  const h = 0.25;
  for (let step = 1; step <= 2400 / h; step++) {
    const k1 = expected.derivative(state);
    const k2 = expected.derivative(state.map((value, j) => value + h * k1[j] / 2));
    const k3 = expected.derivative(state.map((value, j) => value + h * k2[j] / 2));
    const k4 = expected.derivative(state.map((value, j) => value + h * k3[j]));
    state = state.map((value, j) => value + h * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);
    if (step % 1200 !== 0) continue;
    const now = rodAt(plan, step * h);
    for (const [name, actual, reference, tolerance] of [['temperature', now.celsius, state[0], 5e-6], ['volume', now.volume, state[1], 2e-8], ['inputEnergy', now.inputEnergy, state[2], 0.1], ['environmentEnergy', now.environmentEnergy, state[3], 0.1]]) {
      maxError[name] = Math.max(maxError[name], Math.abs(actual - reference));
      near(actual, reference, tolerance, `independent RK4 ${name} ${JSON.stringify(values)} at ${step * h}`);
    }
  }
  integrated++;
  for (const event of plan.events) {
    const at = rodAt(plan, event.t), before = rodAt(plan, event.t - 1e-6), after = rodAt(plan, event.t + 1e-6);
    near(at.celsius, expected.closure, 1e-10, 'exact opening event temperature');
    near(at.lift, 0, 1e-15, 'zero lift at contact');
    ok(before.lift === 0 && after.lift > 0 && before.celsius > after.celsius, 'cooling crosses from gap to rod contact');
    ok(at.lit === before.lit && at.lit === after.lit, 'valve movement never causes ignition');
    near(before.celsius, after.celsius, 1e-6, 'temperature continuous at contact');
    crossings++;
  }
}

for (let setting = 120; setting <= 260; setting += 10) for (let start = 15; start <= 300; start += 5) for (let supply = 10; supply <= 25; supply++) for (const bypass of [0, 1]) {
  const values = {setting, start, supply, bypass}, plan = rodPlan(values), expected = oracle(values);
  for (const time of [0, 1e-6, 300, 1200, 2400]) {
    const now = rodAt(plan, time), flow = expected.at(now.celsius);
    ok(Object.values(now).every(value => typeof value !== 'number' || Number.isFinite(value)), 'finite state throughout full control grid');
    near(now.lift, flow.lift, 1e-16, 'rod contact sets lift');
    ok(now.lift >= 0 && now.gap >= 0 && now.lift * now.gap === 0, 'contact and separation are exclusive');
    ok(Math.PI * 0.012 * now.lift < Math.PI * 0.012 ** 2 / 4, 'curtain remains smaller than bore');
    near(now.inputEnergy - now.storedEnergy - now.environmentEnergy, 0, 2e-7, 'integrated first law');
    ok(now.volume >= 0 && now.mainVolume >= 0 && now.inputEnergy >= 0, 'nonnegative cumulative gas and heat');
    ok(now.celsius >= Math.min(start, 20) - 1e-8 && now.celsius <= Math.max(start, plan.equilibrium) + 1e-8, 'temperature stays in physical bounds');
    near(now.brassExpansion - now.steelExpansion, now.differential, 1e-18, 'both metals expand at their own rate');
    if (time === 0) {
      ok(!now.mainOn && !now.lit && now.flow === 0 && now.power === 0 && now.volume === 0 && now.rate === 0, 'ready means no gas, flame, energy or elapsed movement');
      near(now.celsius, start, 0, 'requested starting temperature');
    } else {
      near(now.flow, flow.flow, 2e-16, 'curtain and bypass flow');
      ok(now.lit === expected.flame, 'no automatic relighting');
      near(now.power, expected.flame ? flow.flow * expected.heat * 0.45 : 0, 5e-9, 'heat follows flame and gas');
    }
  }
  ok(plan.chart[0].t === 0 && plan.chart.at(-1).t === 2400 && plan.chart.every((point, i) => i === 0 || point.t > plan.chart[i - 1].t), 'internal chart samples ordered');
  combinations++;
}

const normal = sampleRod({}, 2400), weak = sampleRod({supply: 10}, 2400), strong = sampleRod({supply: 25}, 2400);
near(normal.celsius, 199.98149407206617, 1e-10, 'nominal 40 minute result');
ok(weak.celsius < normal.celsius && normal.celsius < strong.celsius, 'fixed calibration exposes pressure effect');
const hot = sampleRod({setting: 120, start: 220}, 2400), dark = sampleRod({setting: 120, start: 220, bypass: 0}, 2400);
ok(hot.lit && hot.power > 0 && hot.celsius > 120 && hot.celsius < 125, 'hot bypass start cools toward regulation');
ok(!dark.lit && dark.mainFlow > 0 && dark.power === 0 && dark.inputEnergy === 0, 'returning gas without ignition does not heat');
near(dark.celsius, 20 + 200 / Math.E, 1e-12, 'unlit oven cools passively');
near(sampleRod({start: 15}, 1e-6).celsius, 15, 1e-5, 'no artificial jump at playback start');
assert.deepEqual(rodAt(rodPlan(), 2400), {...rodAt(rodPlan(), 1e9), time: 2400});
for (const bad of [null, [], 2, '200', {unknown: 1}]) assert.throws(() => rodPlan(bad));
for (const [key, [lo, hi, step]] of Object.entries(ROD_DOMAINS)) for (const value of [NaN, Infinity, -Infinity, null, undefined, '20', lo - step, hi + step, lo + step / 2]) assert.throws(() => rodPlan({[key]: value}));
for (const time of [-1, NaN, Infinity, null, '0']) assert.throws(() => sampleRod({}, time));
console.log(JSON.stringify({status: 'PASS', checks, combinations, integrated, crossings, maxError, defaultCelsius: normal.celsius, lowPressureCelsius: weak.celsius, highPressureCelsius: strong.celsius, hotBypassCelsius: hot.celsius, hotUnlitCelsius: dark.celsius}));

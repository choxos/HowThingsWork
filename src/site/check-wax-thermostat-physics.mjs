import assert from 'node:assert/strict';
import {waxPlan, waxAt, waxEnergyAt, waxPhaseAt, WAX_SPEC as S, WAX_DEFAULTS, WAX_DOMAINS, COOLANT} from './thermostat-physics.js';

let checks = 0, plans = 0, states = 0, inversions = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const near = (actual, expected, tolerance, message) => ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const fail = fn => { assert.throws(fn); checks++; };

// Independent energy inversion uses bracketed roots, including partial reversals.
function phaseOracle(energy, previous, stroke) {
  const stored = (temperature, fraction) => 7.32 * temperature + 162 * fraction + 30 * stroke * fraction + 4500 * (stroke * fraction) ** 2;
  const free = (energy - stored(0, previous)) / 7.32;
  const heat = free > 82 + 13 * previous, cool = free < 78 + 13 * previous;
  let fraction = previous;
  if (heat || cool) {
    let lo = heat ? previous : 0, hi = heat ? 1 : previous;
    for (let i = 0; i < 45; i++) {
      const mid = (lo + hi) / 2;
      if (stored((heat ? 82 : 78) + 13 * mid, mid) < energy) lo = mid; else hi = mid;
    }
    fraction = (lo + hi) / 2;
    if (fraction < 1e-12) fraction = 0;
    if (fraction > 1 - 1e-12) fraction = 1;
  }
  return {fraction, temperature: (energy - stored(0, fraction)) / 7.32};
}
for (const growth of [5, 12, 20]) {
  const stroke = 900 * growth / 100 / (Math.PI * 4) / 1000;
  for (const previous of [0, .05, .4, .73, 1]) for (let energy = -100; energy <= 1100; energy += 7.5) {
    const expected = phaseOracle(energy, previous, stroke), actual = waxPhaseAt(energy, previous, stroke);
    near(actual.melted, expected.fraction, 1e-12, 'phase fraction from independent bisection');
    near(actual.waxCelsius, expected.temperature, 1e-9, 'temperature from independent energy balance');
    near(waxEnergyAt(actual.waxCelsius, actual.melted, stroke), energy, 1e-10, 'phase inversion conserves energy');
    inversions++;
  }
  const atHalf = waxEnergyAt(88.5, .5, stroke), coolHalf = waxEnergyAt(84.5, .5, stroke);
  near(waxPhaseAt((atHalf + coolHalf) / 2, .5, stroke).melted, .5, 1e-12, 'partial melt remains fixed inside hysteresis band');
  ok(waxPhaseAt(atHalf + 2, .5, stroke).melted > .5, 'heating beyond upper boundary melts more');
  ok(waxPhaseAt(coolHalf - 2, .5, stroke).melted < .5, 'cooling below lower boundary freezes more');
}
assert.deepEqual([COOLANT.density, COOLANT.heat, COOLANT.glycolVolumeFraction, COOLANT.referenceCelsius], [1032.15, 3554, .5, 90]); checks++;
ok(COOLANT.minimumPressure > 155300 && COOLANT.maxCelsius === 120 && COOLANT.minCelsius === -10, 'liquid range has a stated saturation-pressure margin');

const cases = [{}, {growth: 5}, {growth: 20}, {load: 4}, {load: 24}, {load: 0, start: 110}, {ambient: 40}];
for (const [key, [lo, hi, step]] of Object.entries(WAX_DOMAINS)) for (let value = lo; value <= hi; value += step) cases.push({[key]: value});
for (const growth of [5, 20]) for (const load of [0, 24]) for (const ambient of [-10, 40]) for (const start of [-10, 120]) cases.push({growth, load, ambient, start});
for (const values of new Map(cases.map(value => [JSON.stringify({...WAX_DEFAULTS, ...value}), value])).values()) {
  const plan = waxPlan(values); plans++;
  near(plan.fullStroke, 900 * plan.values.growth / 100 / (Math.PI * 4) / 1000, 1e-16, 'volume over piston area');
  for (const state of plan.track) {
    ok(Number.isFinite(state.celsius) && Number.isFinite(state.waxCelsius) && state.celsius >= -10 - 1e-9 && state.celsius <= 120 + 1e-9, 'finite engine state within coolant range');
    ok(state.melted >= 0 && state.melted <= 1, 'phase fraction is physical');
    ok(18 - plan.fullStroke * state.melted * 1000 > 0, 'fixed rod remains inside capsule');
  }
  for (const time of [0, .037, 30, 247.013, 600, 1199.963, 1200, 1e9]) {
    const now = waxAt(plan, time); states++;
    near(now.toRadiator + now.toBypass, now.pumpFlow, 1e-18, 'pump divides into two branches');
    near(now.radiatorVolume + now.bypassVolume, now.pumpVolume, 1e-15, 'cumulative branch volume closes');
    near(now.energyResidual, 0, 2e-6, 'input heat closes against engine, actuator, radiator and block');
    near(now.spring, 30 + 9000 * now.stroke, 1e-12, 'spring retains cold preload');
    near(now.waxVolume, 0.9e-6 + Math.PI * .004 ** 2 / 4 * now.stroke, 1e-20, 'expansion fills piston-displacement volume');
    if (now.mainOn) {
      near(now.radiatorHeat, now.toRadiator * 1032.15 * 3554 * (now.celsius - now.radiatorOutlet), 2e-9, 'radiator outlet enthalpy');
      near(now.radiatorHeat, .0008 * 1032.15 * 3554 * (now.celsius - now.returnCelsius), 2e-9, 'return-junction enthalpy');
      ok(now.radiatorOutlet >= Math.min(now.celsius, plan.values.ambient) - 1e-10 && now.radiatorOutlet <= Math.max(now.celsius, plan.values.ambient) + 1e-10, 'outlet lies between inlet and ambient');
    } else {
      ok(now.power === 0 && now.pumpFlow === 0 && now.radiatorHeat === 0, 'ready state has no running pump or engine heat');
      near(now.returnCelsius, plan.values.start, 1e-12, 'ready return retains the prepared temperature');
      near(now.radiatorOutlet, plan.values.start, 1e-12, 'ready radiator has not cooled the prepared fluid');
    }
  }
}

// Forward Euler with bisection, a different stepper and inverse from production midpoint.
function referenceRun(input, dt = .01) {
  const v = {...WAX_DEFAULTS, ...input}, xmax = .9e-6 * v.growth / 100 / (Math.PI * .004 ** 2 / 4);
  let engine = v.start, wax = v.start, fraction = Math.max(0, Math.min(1, (wax - 82) / 13));
  let energy = 7.32 * wax + 162 * fraction + 30 * xmax * fraction + 4500 * (xmax * fraction) ** 2;
  for (let i = 0; i < 1200 / dt; i++) {
    const area = Math.min(Math.PI * .04 * xmax * fraction, Math.PI * (.04 ** 2 - .013 ** 2) / 4);
    const capacity = .0008 * area / (area + .0014) * 1032.15 * 3554;
    const radiator = capacity ? capacity * (1 - Math.exp(-400 / capacity)) * (engine - v.ambient) : 0;
    const heat = .6 * (engine - wax);
    engine += dt * (v.load * 1000 - radiator - 12 * (engine - v.ambient) - heat) / 90000;
    energy += heat * dt;
    const state = phaseOracle(energy, fraction, xmax); wax = state.temperature; fraction = state.fraction;
  }
  return {engine, wax, fraction};
}
const references = [];
for (const values of [{}, {growth: 5, load: 24, ambient: 40, start: 120}, {load: 0, start: 110}, {ambient: 40}, {growth: 20, start: 85}, {load: 4}]) {
  const expected = referenceRun(values), now = waxAt(waxPlan(values), 1200);
  near(now.celsius, expected.engine, .008, 'independent Euler engine temperature');
  near(now.waxCelsius, expected.wax, .008, 'independent Euler wax temperature');
  near(now.melted, expected.fraction, .0003, 'independent Euler melted fraction');
  references.push({values, engineError: now.celsius - expected.engine, waxError: now.waxCelsius - expected.wax, fractionError: now.melted - expected.fraction});
}
const warm = waxPlan({}), light = waxPlan({load: 4}), cooling = waxPlan({load: 0, start: 110});
ok(warm.track.find(state => state.melted > 0).t > 420 && warm.track.find(state => state.melted > 0).t < 423, 'warm-up precedes valve opening');
ok(light.track.every(state => state.melted === 0) && waxAt(light, 1200).rate > 0, 'light-load run is still warming without radiator flow');
ok(cooling.track[0].melted === 1 && waxAt(cooling, 1200).melted === 0 && waxAt(cooling, 1200).toBypass === .0008, 'cooling closes the valve while pump and bypass continue');
ok(waxAt(waxPlan({load: 24}), 1200).stroke > waxAt(warm, 1200).stroke, 'heavy load requires more valve lift');
for (const value of [null, [], 0, 'bad']) fail(() => waxPlan(value));
fail(() => waxPlan({unknown: 1}));
for (const [key, [lo, hi, step]] of Object.entries(WAX_DOMAINS)) for (const value of [NaN, Infinity, '12', lo - step, hi + step, lo + step / 2]) fail(() => waxPlan({[key]: value}));
for (const value of [-1, NaN, Infinity, null, '1']) fail(() => waxAt(warm, value));
console.log(JSON.stringify({status: 'PASS', checks, plans, states, inversions, references}));

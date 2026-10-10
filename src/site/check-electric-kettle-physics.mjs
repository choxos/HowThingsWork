import assert from 'node:assert/strict';
import * as P from './element-physics.js';

const near = (actual, expected, tolerance, label) => assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}`);
// Independent source values: Kanthal Nikrothal 80 and OpenStax University Physics 2, 1.4–1.5 and 9.5.
const knots = [20, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
const factors = [1, 1.01, 1.02, 1.03, 1.04, 1.05, 1.04, 1.04, 1.04, 1.04, 1.05, 1.06, 1.07];
const capacities = [460, 460, 480, 500, 520, 540, 560, 600, 630, 650, 670, 700];
const interpolate = (x, values) => {
  if (x <= knots[0]) return values[0];
  let i = 1;
  while (i < values.length && knots[i] < x) i++;
  return i === values.length ? values.at(-1) : values[i - 1] + (values[i] - values[i - 1]) * (x - knots[i - 1]) / (knots[i] - knots[i - 1]);
};
const area = Math.PI * 0.00055 ** 2 / 4, wireMass = area * 5.2 * 8300;
const resistance = temperature => 1.09e-6 * 5.2 / area * interpolate(temperature, factors);
assert.deepEqual(P.KETTLE_WATER, {heat: 4186, vaporization: 2256000, boiling: 100, density: 1000});
assert.deepEqual(P.KETTLE_THERMAL, {room: 20, sheathCapacity: 30, wireToSheath: 12, toWater: 400, toAir: 3, vesselLoss: 0.7, sensorCapacity: 1, sensorLoss: 0.05, steamConductance: 2, steamFraction: 0.025, steamDelay: 2, steamTrip: 85, dryTrip: 220});
near(P.kettlePlan().resistance, resistance(15), 1e-12, 'cold resistance');
near(P.kettlePlan().rating, 230 ** 2 / resistance(15), 1e-9, 'cold power');

// A finer Heun solver uses liquid temperature and evaporated mass, rather than the production enthalpy state.
function reference(input, checkpoints) {
  const {volts = 230, mass = 1, start = 15, filled = 1} = input;
  const wet = filled === 1, initial = wet ? start : 20, dt = 0.0005;
  let state = [initial, initial, initial, 0, 20], energized = volts > 0, trip = null, boil = null;
  const vapor = new Float64Array(Math.ceil(checkpoints.at(-1) / dt) + 1), results = [];
  const derivative = (s, supply) => {
    const [core, sheath, water, lostMass, sensor] = s;
    const power = energized ? volts ** 2 / resistance(core) : 0, conducted = 12 * (core - sheath);
    const carried = (wet ? 400 : 3) * (sheath - (wet ? Math.min(100, water) : 20));
    const net = wet ? carried - 0.7 * (Math.min(100, water) - 20) : 0;
    const boiling = wet && water >= 100 && net > 0;
    return [(power - conducted) / (wireMass * interpolate(core, capacities)), (conducted - carried) / 30,
      wet && !boiling ? net / ((mass - lostMass) * 4186) : 0, boiling ? net / 2256000 : 0,
      Math.min(supply, Math.max(0, 2 * (100 - sensor))) - 0.05 * (sensor - 20)];
  };
  let next = 0;
  for (let i = 1; i < vapor.length; i++) {
    const lag = i - 4000, supply = lag > 0 ? 0.025 * 2256000 * (vapor[lag] - vapor[lag - 1]) / dt : 0;
    const previous = state, k1 = derivative(state, supply), k2 = derivative(state.map((x, j) => x + dt * k1[j]), supply);
    state = state.map((x, j) => x + dt * (k1[j] + k2[j]) / 2);
    if (wet && state[2] > 100) {
      state[3] += (state[2] - 100) * (mass - state[3]) * 4186 / 2256000;
      state[2] = 100;
    }
    if (wet && boil === null && state[3] > 0) boil = i * dt;
    if (energized && state[wet ? 4 : 1] >= (wet ? 85 : 220)) {
      const j = wet ? 4 : 1, threshold = wet ? 85 : 220;
      trip = (i - 1 + (threshold - previous[j]) / (state[j] - previous[j])) * dt;
      energized = false;
    }
    vapor[i] = state[3];
    if (next < checkpoints.length && i * dt >= checkpoints[next] - 1e-9) { results.push([...state]); next++; }
  }
  return {results, trip, boil};
}

const referenceCases = [{}, {filled: 0}, {mass: 0.2}, {mass: 1.7}, {start: 40}, {volts: 120}, {volts: 0, start: 5}, {volts: 240, mass: 0.2, start: 40}, {volts: 10, filled: 0}];
const maxima = {coreC: 0, sheathC: 0, waterC: 0, sensorC: 0, vaporKg: 0, tripSeconds: 0, boilSeconds: 0, energyJ: 0, sensorEnergyJ: 0};
let referencePoints = 0;
for (const values of referenceCases) {
  const plan = P.kettlePlan(values), checkpoints = [...new Set([0.05, 0.5, 1, 5, Math.min(30, plan.duration), plan.duration])].sort((a, b) => a - b);
  const oracle = reference(values, checkpoints);
  checkpoints.forEach((time, i) => {
    const actual = P.kettleAt(plan, time), expected = oracle.results[i];
    for (const [key, j, metric, tolerance] of [['celsius', 0, 'coreC', 0.1], ['sheath', 1, 'sheathC', 0.05], ['water', 2, 'waterC', 0.003], ['boiled', 3, 'vaporKg', 0.000005], ['sensor', 4, 'sensorC', 0.2]]) {
      maxima[metric] = Math.max(maxima[metric], Math.abs(actual[key] - expected[j]));
      near(actual[key], expected[j], tolerance, `${key} at ${time} s for ${JSON.stringify(values)}`);
    }
    referencePoints++;
  });
  const trip = plan.switched ?? plan.tripped;
  assert.equal(trip === null, oracle.trip === null);
  if (trip !== null) { maxima.tripSeconds = Math.max(maxima.tripSeconds, Math.abs(trip - oracle.trip)); near(trip, oracle.trip, 0.015, 'trip time'); }
  assert.equal(plan.firstBoil === null, oracle.boil === null);
  if (plan.firstBoil !== null) { maxima.boilSeconds = Math.max(maxima.boilSeconds, Math.abs(plan.firstBoil - oracle.boil)); near(plan.firstBoil, oracle.boil, 0.002, 'first boil'); }
}

const settings = [{}, ...Object.entries(P.KETTLE_DOMAINS).flatMap(([key, [lo, hi, step]]) => Array.from({length: Math.round((hi - lo) / step) + 1}, (_, i) => ({[key]: lo + i * step})))];
for (const volts of [0, 10, 120, 240]) for (const mass of [0.2, 1.7]) for (const start of [5, 40]) for (const filled of [0, 1]) settings.push({volts, mass, start, filled});
let statesChecked = 0;
for (const input of settings) {
  const plan = P.kettlePlan(input), stop = plan.switched ?? plan.tripped;
  const times = [0, 0.025, 0.05, 0.31, 1, 5, 30, plan.duration, ...(stop === null ? [] : [stop - 1e-7, stop, stop + 1e-7])];
  assert.equal(plan.track.at(-1).t, plan.duration);
  let priorVapor = 0;
  for (const row of plan.track) { assert(row.boiled >= priorVapor); priorVapor = row.boiled; }
  for (const time of times) {
    const now = P.kettleAt(plan, time);
    assert(Object.values(now).every(value => typeof value !== 'number' || Number.isFinite(value)));
    assert(now.water <= 100 + 1e-10 && now.water >= Math.min(plan.initial, 20) - 1e-8);
    assert(now.liquidMass >= 0 && now.boiled >= 0);
    if (plan.wet) near(now.liquidMass + now.boiled, plan.values.mass, 1e-12, 'mass balance');
    else assert.equal(now.boiled + now.vaporRate + now.sensorReceivedEnergy, 0);
    const balance = Math.abs(now.inputEnergy - now.storedEnergy - now.sheathEnergy - now.waterEnergy - now.roomEnergy);
    const sensorBalance = Math.abs(now.sensorReceivedEnergy - now.sensorLostEnergy - now.sensorEnergy);
    maxima.energyJ = Math.max(maxima.energyJ, balance); maxima.sensorEnergyJ = Math.max(maxima.sensorEnergyJ, sensorBalance);
    assert(balance < 0.2, `energy balance ${balance} J at ${time} s`);
    assert(sensorBalance < 1e-8);
    if (plan.wet) near(now.waterEnergy + now.roomEnergy, now.toWaterEnergy, 2e-8, 'water heat balance');
    const delivered = P.kettleAt(plan, Math.max(0, now.t - 2)).boiled * 2256000 * 0.025;
    assert(now.sensorReceivedEnergy <= delivered + 0.1, 'sensor cannot receive more latent energy than transported');
    if (time === 0 || plan.values.volts === 0 || now.switched || now.tripped) assert.equal(now.power + now.current, 0);
    else {
      near(now.power, plan.values.volts ** 2 / resistance(now.celsius), 1e-9, 'electrical power');
      near(now.current, plan.values.volts / resistance(now.celsius), 1e-12, 'electrical current');
    }
    if (now.switched) assert(now.boiled > 0 && now.t > plan.firstBoil + 2);
    if (now.tripped) assert.equal(plan.wet, false);
    statesChecked++;
  }
  if (stop !== null) {
    const before = P.kettleAt(plan, stop - 1e-7), at = P.kettleAt(plan, stop), after = P.kettleAt(plan, stop + 1e-7);
    assert(before.on && !at.on && !after.on);
    near(at[plan.wet ? 'sensor' : 'sheath'], plan.wet ? 85 : 220, 1e-6, 'sensor trip threshold');
    near(before.celsius, after.celsius, 0.001, 'stored wire heat survives switch opening');
    assert(at.storedEnergy + at.sheathEnergy > 0);
  }
}
const regular = P.kettlePlan(), cup = P.kettlePlan({mass: 0.2}), full = P.kettlePlan({mass: 1.7}), warm = P.kettlePlan({start: 40});
assert(cup.firstBoil < regular.firstBoil && regular.firstBoil < full.firstBoil && warm.firstBoil < regular.firstBoil);
assert.equal(P.kettlePlan({volts: 120}).firstBoil, null);
assert.equal(P.kettlePlan({volts: 0}).switched, null);
const dry = P.kettlePlan({filled: 0});
assert(dry.tripped > 1 && dry.tripped < 10);
assert.equal(P.kettlePlan({filled: 0, mass: 1.7, start: 40}).tripped, dry.tripped);
assert(P.kettleAt(regular, regular.duration).boiled > P.kettleAt(regular, regular.switched).boiled, 'stored heat continues making vapor briefly');
assert(P.kettleAt(regular, regular.duration).water < 100, 'water cools after residual boiling ends');
for (const input of [null, [], '230', {unknown: 1}, {volts: NaN}, {volts: Infinity}, {volts: -10}, {volts: 231}, {mass: 0}, {mass: 1.71}, {start: 41}, {filled: 0.5}]) assert.throws(() => P.kettlePlan(input));
for (const time of [-1, NaN, Infinity, '1']) assert.throws(() => P.kettleAt(regular, time));
assert.equal(P.kettleAt(regular, 1e6).t, regular.duration);
console.log(JSON.stringify({pass: true, referenceCases: referenceCases.length, referencePoints, sweptSettings: settings.length, statesChecked, maxima}));

import assert from 'node:assert/strict';
import {specificAt, conductivityAt} from './element-physics.js';
import * as P from './element-physics.js';

// Kanthal Nikrothal 80 datasheet, updated September 5, 2024.
const temperatures = [20, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100];
const heat = [460, 460, 480, 500, 520, 540, 560, 600, 630, 650, 670, 700];
const conductivity = [15, 15, 15, 15, 17, 19, 21, 22, 24, 26, 28, 30];
for (let i = 0; i < temperatures.length; i++) {
  assert.equal(specificAt(temperatures[i]), heat[i], `specific heat at ${temperatures[i]} °C`);
  assert.equal(conductivityAt(temperatures[i]), conductivity[i], `conductivity at ${temperatures[i]} °C`);
}
assert.equal(specificAt(150), 470);
assert.equal(conductivityAt(350), 16);
const near = (actual, expected, tolerance, label) => assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}`);
const interpolate = (knots, values, x) => {
  if (x <= knots[0]) return values[0];
  const i = knots.findIndex(t => t >= x);
  return i < 0 ? values.at(-1) : values[i - 1] + (values[i] - values[i - 1]) * (x - knots[i - 1]) / (knots[i] - knots[i - 1]);
};
const resistanceTemperatures = [20, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
const resistanceFactors = [1, 1.01, 1.02, 1.03, 1.04, 1.05, 1.04, 1.04, 1.04, 1.04, 1.05, 1.06, 1.07];
// Derive sigma independently from the exact SI constants, rather than importing the model's number.
const sigma = 2 * Math.PI ** 5 * (1.380649e-23) ** 4 / (15 * (6.62607015e-34) ** 3 * 299792458 ** 2);
near(P.SIGMA, sigma, 5e-18, 'rounded Stefan-Boltzmann constant');
for (let i = 0; i < resistanceTemperatures.length; i++) assert.equal(P.ctAt(resistanceTemperatures[i]), resistanceFactors[i]);
assert.deepEqual({...P.HEATER_TILE}, {capture: 0.1, capacity: 500, conductance: 1.5});
for (const temperature of [10, 20, 75, 100, 150, 200, 350, 525, 1100, 1275]) {
  const n = Math.abs(temperature - 20) * 10, step = n ? (temperature - 20) / n : 0;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += step * interpolate(temperatures, heat, 20 + (i + 0.5) * step);
  near(P.specificEnergyAt(temperature), energy, 1e-6, 'integrated specific heat');
}

// Independent heat balances and a finer Heun integration, using the source tables above.
function reference(values, checkpoints) {
  const {volts = 230, length = 6, reflector = 1, room = 20} = values;
  const area = Math.PI * 0.0004 ** 2 / 4, surface = Math.PI * 0.0004 * length, mass = area * length * 8300;
  const derivative = ([wire, tile]) => {
    const resistance = 1.09e-6 * length / area * interpolate(resistanceTemperatures, resistanceFactors, wire);
    const power = volts ** 2 / resistance;
    const radiation = 0.88 * sigma * surface * ((wire + 273.15) ** 4 - (room + 273.15) ** 4);
    const convection = 15 * surface * (wire - room);
    const received = 0.1 * (reflector ? 0.75 : 0.35) * radiation, released = 1.5 * (tile - room);
    return [(power - radiation - convection) / (mass * interpolate(temperatures, heat, wire)), (received - released) / 500];
  };
  let state = [room, room], elapsed = 0;
  return checkpoints.map(time => {
    const steps = Math.round((time - elapsed) / 0.001), dt = (time - elapsed) / steps;
    for (let i = 0; i < steps; i++) {
      const first = derivative(state), second = derivative(state.map((value, j) => value + dt * first[j]));
      state = state.map((value, j) => value + dt * (first[j] + second[j]) / 2);
    }
    elapsed = time;
    return [...state];
  });
}
const checkpoints = [0.05, 0.25, 1, 5, 30, 120];
const referenceCases = [{}, {volts: 120}, {length: 12}, {length: 4, volts: 240, room: 30}, {reflector: 0}, {volts: 10, length: 12}, {volts: 0}];
let maxWireError = 0, maxTileError = 0, maxWireBalance = 0, maxTileBalance = 0;
for (const values of referenceCases) {
  const plan = P.heaterPlan(values), oracle = reference(values, checkpoints);
  checkpoints.forEach((time, i) => {
    const state = P.heaterAt(plan, time);
    maxWireError = Math.max(maxWireError, Math.abs(state.celsius - oracle[i][0]));
    maxTileError = Math.max(maxTileError, Math.abs(state.tile - oracle[i][1]));
    near(state.celsius, oracle[i][0], 0.015, 'independent wire temperature');
    near(state.tile, oracle[i][1], 0.00005, 'independent tile temperature');
  });
}

const settings = [{}, ...Object.entries(P.HEATER_DOMAINS).flatMap(([key, [lo, hi, step]]) => Array.from({length: Math.round((hi - lo) / step) + 1}, (_, i) => ({[key]: lo + i * step})))];
for (const volts of [0, 10, 240]) for (const length of [4, 12]) for (const room of [10, 30]) for (const reflector of [0, 1]) settings.push({volts, length, room, reflector});
for (const values of settings) {
  const plan = P.heaterPlan(values);
  for (const time of [0, 0.025, 0.175, 0.827, 1.025, 5, 30, 60, 119.975, 120]) {
    const state = P.heaterAt(plan, time), {volts, length, room, reflector} = plan.values;
    assert(Object.values(state).every(value => typeof value !== 'number' || Number.isFinite(value)));
    assert(state.celsius >= room - 1e-9 && state.celsius < 1400);
    assert(state.tile >= room - 1e-9 && state.tile <= state.celsius + 1e-9);
    if (time === 0 || volts === 0) assert.equal(state.power + state.current, 0);
    else {
      const expectedR = 1.09e-6 * length / (Math.PI * 0.0004 ** 2 / 4) * interpolate(resistanceTemperatures, resistanceFactors, state.celsius);
      near(state.power, volts ** 2 / expectedR, 1e-9, 'electrical input');
      near(state.current, volts / expectedR, 1e-12, 'current');
    }
    near(state.forward + state.backward, state.radiated, 1e-9, 'radiation partition');
    near(state.absorbed, state.radiated * (reflector ? 0.75 : 0.35) / 10, 1e-9, 'tile capture');
    near(state.storedPower + state.radiated + state.convected, state.power, 1e-9, 'instantaneous wire balance');
    const wireResidual = Math.abs(state.inputEnergy - state.radiatedEnergy - state.convectedEnergy - state.storedEnergy);
    const tileResidual = Math.abs(state.tileReceivedEnergy - state.tileReleasedEnergy - state.tileStoredEnergy);
    maxWireBalance = Math.max(maxWireBalance, wireResidual); maxTileBalance = Math.max(maxTileBalance, tileResidual);
    assert(wireResidual < 0.4, `wire energy balance ${wireResidual} J at ${time} s`);
    assert(tileResidual < 1e-7, `tile energy balance ${tileResidual} J`);
  }
}
const fitted = P.heaterAt(P.heaterPlan({}), 120), bare = P.heaterAt(P.heaterPlan({reflector: 0}), 120);
assert.equal(fitted.celsius, bare.celsius); assert.equal(fitted.power, bare.power); assert(fitted.tile > bare.tile);
assert(P.heaterAt(P.heaterPlan({length: 12}), 120).tile < fitted.tile);
assert(P.heaterAt(P.heaterPlan({length: 4}), 120).tile > fitted.tile);
for (const invalid of [{volts: NaN}, {volts: Infinity}, {volts: -1}, {length: 0}, {room: 31}, {reflector: 2}]) assert.throws(() => P.heaterPlan(invalid));
for (const time of [-1, NaN, Infinity]) assert.throws(() => P.heaterAt(P.heaterPlan(), time));
console.log(JSON.stringify({pass: true, sourceKnots: 37, referenceCases: referenceCases.length, referencePoints: 42, sweptSettings: settings.length, maxWireErrorC: maxWireError, maxTileErrorC: maxTileError, maxWireBalanceJ: maxWireBalance, maxTileBalanceJ: maxTileBalance}));

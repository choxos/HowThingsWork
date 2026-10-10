import assert from 'node:assert/strict';
import * as P from './element-physics.js';

const near = (actual, expected, tolerance, label) => assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}`);
// Independent transcription of Kanthal material data, NASA air constants and OpenStax Table 13.5.
const knots = [20, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
const factors = [1, 1.01, 1.02, 1.03, 1.04, 1.05, 1.04, 1.04, 1.04, 1.04, 1.05, 1.06, 1.07];
const capacities = [460, 460, 480, 500, 520, 540, 560, 600, 630, 650, 670, 700];
const vapor = [[0, 610], [5, 868], [10, 1190], [15, 1690], [20, 2330], [25, 3170], [30, 4240], [37, 6310], [40, 7340], [50, 12300], [60, 19900], [70, 31200], [80, 47300], [90, 70100], [95, 85900], [100, 101000], [120, 199000]];
function interpolate(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  const high = xs.findIndex(k => k >= x);
  if (high < 0) return ys.at(-1);
  return ys[high - 1] + (ys[high] - ys[high - 1]) * (x - xs[high - 1]) / (xs[high] - xs[high - 1]);
}
const cp = x => interpolate(x, knots.slice(0, capacities.length), capacities);
const pv = x => interpolate(x, vapor.map(p => p[0]), vapor.map(p => p[1]));
const area = Math.PI * 0.0004 ** 2 / 4, mass = 8300 * area * 3.05, surface = Math.PI * 0.0004 * 3.05;
const resistance = x => 1.09e-6 * 3.05 / area * interpolate(x, knots, factors);
function wireEnergy(room, temperature) {
  const points = [room, ...knots.filter(k => k > room && k < temperature), temperature];
  return mass * points.slice(1).reduce((sum, upper, i) => sum + (cp(points[i]) + cp(upper)) / 2 * (upper - points[i]), 0);
}
assert.deepEqual(P.DRYER_AIR, {pressure: 101325, gasConstant: 287, heat: 1004.5});
assert.deepEqual(P.VAPOR_PRESSURE, vapor);
assert.deepEqual(P.DRYER_WIRE, {length: 3.05, diameter: 0.0004});
assert.deepEqual(P.DRYER_THERMAL, {
  step: 0.005, run: 30, spinUp: 1, coefficient: 4300, referenceFlow: 35,
  sensorCapacity: 0.8, sensorWire: 0.5, sensorStill: 0.05, sensorAir: 1.5, open: 120, close: 90,
  hairCapacity: 4, hairWater: 0.00035, waterHeat: 4186, latent: 2430e3,
  hairConductance: 1.8, vaporExchange: 0.00085, humidity: 0.5, vaporGasConstant: 461.5,
});
for (let i = 1; i < vapor.length; i++) near(P.saturationPressure((vapor[i - 1][0] + vapor[i][0]) / 2), (vapor[i - 1][1] + vapor[i][1]) / 2, 1e-9, 'vapor-pressure interpolation');
near(P.saturationPressure(-10), 610, 0, 'vapor table low clamp');
near(P.saturationPressure(130), 199000, 0, 'vapor table high clamp');
near(P.dryerPlan().resistance, resistance(20), 1e-12, 'wire resistance');

// A finer Heun solver, with linear event localization, checks the production RK4/bisection trajectory.
function reference(input, checkpoints) {
  const v = {volts: 230, airflow: 35, room: 20, blocked: 0, ...input};
  const dt = 0.00025, results = [], events = [];
  let state = [v.room, v.room, v.room, 0.00035], closed = true, wet = true, driedAt = null;
  function derivative(s, time) {
    const [wire, sensor, hair] = s;
    const flow = v.blocked ? 0 : v.airflow * Math.min(1, time);
    const airCapacity = 101325 / (287 * (v.room + 273.15)) * flow / 1000 * 1004.5;
    const transfer = 4300 * surface * Math.sqrt(flow / 35);
    const outlet = v.room + (airCapacity > 0 ? (wire - v.room) * (1 - Math.exp(-transfer / airCapacity)) : 0);
    const loss = 0.88 * 5.670374419e-8 * surface * ((wire + 273.15) ** 4 - (v.room + 273.15) ** 4) + 15 * surface * (wire - v.room);
    const sensorGain = 0.5 * (wire - sensor), sensorLoss = (0.05 + 1.5 * Math.sqrt(flow / 35)) * (sensor - v.room);
    const heating = 1.8 * Math.sqrt(flow / 35) * (outlet - hair);
    const evaporation = wet ? 0.00085 * Math.sqrt(flow / 35) * Math.max(0, pv(hair) - 0.5 * pv(v.room)) / (461.5 * (hair + 273.15)) : 0;
    return [((closed ? v.volts ** 2 / resistance(wire) : 0) - airCapacity * (outlet - v.room) - loss - sensorGain) / (mass * cp(wire)), (sensorGain - sensorLoss) / 0.8, (heating - 2430000 * evaporation) / (4 + Math.max(0, s[3]) * 4186), -evaporation];
  }
  function step(s, time, h) {
    const a = derivative(s, time), b = derivative(s.map((x, i) => x + h * a[i]), time + h);
    return s.map((x, i) => x + h * (a[i] + b[i]) / 2);
  }
  let time = 0;
  for (const stop of checkpoints) {
    while (time < stop - 1e-10) {
      const h = Math.min(dt, stop - time), next = step(state, time, h), threshold = closed ? 120 : 90;
      const crossed = closed ? next[1] >= threshold : next[1] <= threshold;
      const drying = wet && next[3] <= 0;
      if (crossed || drying) {
        const switchShare = crossed ? (threshold - state[1]) / (next[1] - state[1]) : Infinity;
        const dryShare = drying ? state[3] / (state[3] - next[3]) : Infinity;
        const switchFirst = switchShare <= dryShare, fraction = Math.min(switchShare, dryShare);
        state = step(state, time, h * fraction);
        if (switchFirst) { closed = !closed; events.push({t: time + h * fraction, closed}); }
        else { wet = false; state[3] = 0; driedAt = time + h * fraction; }
        state = step(state, time + h * fraction, h * (1 - fraction));
      } else state = next;
      time += h;
    }
    results.push({time: stop, state: [...state], closed});
  }
  return {results, events, driedAt};
}
const referenceInputs = [{}, {airflow: 20}, {airflow: 45}, {volts: 120}, {volts: 0}, {room: 30}, {blocked: 1}, {volts: 240, room: 30, airflow: 20, blocked: 1}];
let maxReference = [0, 0, 0, 0], maxEventError = 0;
for (const input of referenceInputs) {
  const expected = reference(input, [0, 0.05, 0.5, 1, 5, 15, 30]), plan = P.dryerPlan(input);
  for (const sample of expected.results) {
    const now = P.dryerAt(plan, sample.time), actual = [now.celsius, now.sensor, now.hair, now.water];
    for (let i = 0; i < actual.length; i++) {
      maxReference[i] = Math.max(maxReference[i], Math.abs(actual[i] - sample.state[i]));
      near(actual[i], sample.state[i], i === 3 ? 1e-7 : 0.02, `independent trajectory ${JSON.stringify(input)} at ${sample.time}, state ${i}`);
    }
    assert.equal(now.closed, sample.closed);
  }
  assert.equal(plan.events.length, expected.events.length);
  for (const [i, event] of plan.events.entries()) {
    near(event.t, expected.events[i].t, 0.001, 'independent switch time');
    maxEventError = Math.max(maxEventError, Math.abs(event.t - expected.events[i].t));
    assert.equal(event.closed, expected.events[i].closed);
  }
  if (expected.driedAt === null) assert.equal(plan.driedAt, null);
  else near(plan.driedAt, expected.driedAt, 0.001, 'independent drying time');
}

const inputs = new Map(), add = x => { const full = {...P.DRYER_DEFAULTS, ...x}; inputs.set(JSON.stringify(full), full); };
let controlValues = 0;
for (const [key, [min, max, step]] of Object.entries(P.DRYER_DOMAINS)) for (let v = min; v <= max; v += step) { add({[key]: v}); controlValues++; }
for (const volts of [0, 10, 120, 230, 240]) for (const airflow of [20, 35, 45]) for (const room of [10, 20, 30]) for (const blocked of [0, 1]) add({volts, airflow, room, blocked});
let points = 0, maxEnergyError = 0, maxHairError = 0, peakWire = 0, peakSensor = 0, peakOutlet = 0;
for (const input of inputs.values()) {
  const plan = P.dryerPlan(input), initial = P.dryerAt(plan, 0);
  assert.deepEqual([initial.power, initial.current, initial.flow, initial.evaporated, initial.on, initial.motorOn], [0, 0, 0, 0, false, false]);
  let lastWater = 0.00035;
  for (const [i, sample] of plan.track.entries()) {
    assert(sample.state.every(Number.isFinite));
    assert(sample.state[3] >= 0 && sample.state[3] <= lastWater + 1e-12);
    lastWater = sample.state[3];
    peakWire = Math.max(peakWire, sample.state[0]); peakSensor = Math.max(peakSensor, sample.state[1]);
    const now = P.dryerAt(plan, sample.t);
    peakOutlet = Math.max(peakOutlet, now.outlet);
    if (i % 19 && i !== plan.track.length - 1) continue;
    assert(now.outlet <= now.celsius + 1e-10 && now.outlet >= input.room - 1e-10);
    near(now.power, now.on ? input.volts ** 2 / resistance(now.celsius) : 0, 1e-9, 'instantaneous heater power');
    near(now.massFlow * 1004.5 * (now.outlet - input.room), now.toAir, 1e-9, 'air heat balance');
    const energyError = Math.abs(now.inputEnergy - now.airEnergy - now.ambientEnergy - wireEnergy(input.room, now.celsius) - 0.8 * (now.sensor - input.room));
    const hairError = Math.abs(now.hairReceivedEnergy - now.evaporationEnergy - now.vaporSensibleEnergy - (4 + now.water * 4186) * (now.hair - input.room));
    maxEnergyError = Math.max(maxEnergyError, energyError); maxHairError = Math.max(maxHairError, hairError);
    assert(energyError < 0.01, `wire/sensor energy balance: ${energyError} J`);
    assert(hairError < 1e-5, `wet-lock energy balance: ${hairError} J`);
    near(now.evaporationEnergy, (0.00035 - now.water) * 2430000, 1e-6, 'latent heat and water balance');
    if (input.blocked) assert.deepEqual([now.flow, now.toAir, now.toHair, now.evaporation, now.water], [0, 0, 0, 0, 0.00035]);
    if (input.volts === 0) assert.deepEqual([now.power, now.celsius, now.sensor], [0, input.room, input.room]);
    points++;
  }
  for (const event of plan.events) {
    near(event.sensor, event.closed ? 90 : 120, 1e-5, 'sensor threshold');
    const before = P.dryerAt(plan, event.t - 1e-8), after = P.dryerAt(plan, event.t);
    assert.equal(after.closed, event.closed); assert.equal(before.closed, !event.closed);
    near(before.celsius, after.celsius, 0.001, 'wire continuity at switch');
    near(before.inputEnergy, after.inputEnergy, 0.001, 'energy continuity at switch');
  }
  if (plan.driedAt !== null) {
    assert(P.dryerAt(plan, plan.driedAt - 1e-8).water > 0);
    assert.equal(P.dryerAt(plan, plan.driedAt).water, 0);
  }
  assert.equal(P.dryerAt(plan, 1e6).t, 30);
  assert(plan.settled.done);
}
const defaults = P.dryerPlan(), slow = P.dryerPlan({airflow: 20}), fast = P.dryerPlan({airflow: 45}), cool = P.dryerPlan({volts: 0});
assert(slow.outlet > defaults.outlet && defaults.outlet > fast.outlet);
assert(slow.driedAt < defaults.driedAt && defaults.driedAt < fast.driedAt);
assert(cool.settled.water > 0 && cool.settled.evaporated > 0 && cool.settled.hair < 20);
assert.equal(P.dryerAt(defaults, 0.5).on, true);
for (const [key, [min, max]] of Object.entries(P.DRYER_DOMAINS)) for (const value of [min - 1, max + 1, NaN, Infinity, null, '20']) assert.throws(() => P.dryerPlan({[key]: value}));
assert.throws(() => P.dryerPlan({unknown: 1}));
for (const time of [-1, NaN, Infinity, null, '1']) assert.throws(() => P.dryerAt(defaults, time));
const cached = P.dryerPlan({volts: 210}); assert.equal(P.dryerPlan({volts: 210}), cached);
for (let i = 0; i < 9; i++) P.dryerPlan({volts: i * 10});
assert.notEqual(P.dryerPlan({volts: 210}), cached);
console.log(JSON.stringify({passed: true, referenceCases: referenceInputs.length, maxReferenceError: maxReference, maxEventError, controlValues, configurations: inputs.size, sampledBalances: points, maxEnergyError, maxHairError, peakWire, peakSensor, peakOutlet, defaultDryingTime: defaults.driedAt}));

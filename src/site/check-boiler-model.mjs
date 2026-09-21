// Checks the gas boiler model and its lesson against the Ideal Vogue C26's
// sheet typed in again and the physics worked out by other routes: the
// combustion balanced atom by atom and its excess air found by bisection, the
// air's molar mass rebuilt from the atomic weights of what is in it, the dew
// point bisected out of the Buck equation and compared with two other fits,
// the sheet's own numbers weighed against each other, the boiler's stirred
// volume integrated with Runge-Kutta, the pipe to the tap advected cell by
// cell, and every drawn flame, pass, bar, piece and curve read back at swept
// settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './boiler-physics.js';
import * as M from './boiler-model.js';
import * as L from './boiler-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';

const t = tally();
const counts = {steps: 0, cells: 0, poses: 0, points: 0, numbers: 0, plans: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;

/** One fourth order Runge-Kutta step. */
function rk4(state, time, dt, derivative) {
  const k1 = derivative(time, state);
  const k2 = derivative(time + dt / 2, state + dt / 2 * k1);
  const k3 = derivative(time + dt / 2, state + dt / 2 * k2);
  const k4 = derivative(time + dt, state + dt * k3);
  counts.steps++;
  return state + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
}

/** The x where `fn` crosses zero, by bisection. */
function bisect(fn, lo, hi, steps = 200) {
  let a = lo, b = hi;
  for (let i = 0; i < steps; i++) { const mid = (a + b) / 2; if (fn(a) * fn(mid) <= 0) b = mid; else a = mid; }
  return (a + b) / 2;
}

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  // Ideal Vogue C26, Installation and Servicing: tables 1 to 3, operation, commissioning.
  vogue: {
    inputNet: 26.1, inputGross: 29.0, output: 26.0, flow: 10.6, rise: 35, specificRate: 12.4,
    gasRate: 2.695, cvGross: 38.7, cvNet: 34.9, supply: 20, injector: 4.3,
    heatInputNet: [3.7, 18.1], heatInputGross: [4.1, 20.1], heatOutput: [3.7, 18.0], condensing: [4.0, 19.3],
    meanWater: [40, 70], heatRange: [30, 80], sedbuk: [91.0, 89.1],
    minDraw: 2, maxTemp: 65, checkFlow: 3, checkTemp: 64,
    content: 0.5, heatContent: 1.5, exchanger: 7.3, casing: [740, 445, 330], connection: 15,
    flueTemp: 73, flueMass: 11, flueDiameter: 100, watts: 108, attempts: 5, pumpOverrun: 60, fanOverrun: 120,
  },
  // Wikipedia: Atmosphere of Earth, Density of air, Methane, Heat of combustion,
  // Adiabatic flame temperature, Properties of water, Carbon dioxide,
  // Table of specific heat capacities, Arden Buck equation, Dew point,
  // Condensing boiler, Tankless water heating, Nitrogen, Oxygen, Argon.
  air: {oxygen: 20.946, nitrogen: 78.084, argon: 0.934, carbonDioxide: 0.0412, molar: 28.9652, standard: 101.325, density: 1.225, densityAt: 15},
  methane: {molar: 16.043, hhv: 55.52, lhv: 50.00, hhvMol: 890.7, lhvMol: 802.34, at: 25, flame: 1963, gasFlame: 1960, density: 0.657, densityAt: 25},
  water: {cp: 4184, cpAt: 20, density: 1, molar: 18.015, vaporization: 2257, carbonDioxide: 44.009},
  cp: {carbonDioxide: 0.839, water: 2.030, oxygen: 0.918, nitrogen: 1.040, argon: 0.5203},
  buck: {a: 6.1121, b: 18.678, c: 257.14, d: 234.5, from: -80, to: 50},
  magnus: {a: 6.1121, b: 17.625, c: 243.04, from: -40, to: 50},
  sonntag: {a: 6.112, b: 17.62, c: 243.12, from: -45, to: 60},
  condensing: {returnWater: 55, gain: [10, 12], ph: [3, 5]},
  tankless: {power: [24, 54], flow: [9, 23]},
  weights: {nitrogen: 14.007, oxygen: 15.999, argon: 39.95},
};
const V = SRC.vogue;

assert.deepEqual(JSON.parse(JSON.stringify(P.VOGUE)), {name: 'Vogue C26', ...V});
assert.deepEqual(JSON.parse(JSON.stringify(P.AIR)), SRC.air);
assert.deepEqual(JSON.parse(JSON.stringify(P.METHANE)), SRC.methane);
assert.deepEqual(JSON.parse(JSON.stringify(P.WATER)), SRC.water);
assert.deepEqual(JSON.parse(JSON.stringify(P.FLUE_CP)), SRC.cp);
assert.deepEqual(JSON.parse(JSON.stringify(P.BUCK)), SRC.buck);
assert.deepEqual(JSON.parse(JSON.stringify(P.CONDENSING)), SRC.condensing);
assert.deepEqual(JSON.parse(JSON.stringify(P.TANKLESS)), SRC.tankless);
assert.deepEqual(JSON.parse(JSON.stringify(P.DECLARED)), {minFiring: 3.7, bore: 13.6, purge: 3, spark: 2, faster: 5, samples: 241, close: 1, shortest: 30, longest: 120, spare: 5});
assert.deepEqual({...P.BOILER_DEFAULTS}, {flow: 10.6, set: 45, inlet: 10, pipe: 5});
assert.deepEqual(JSON.parse(JSON.stringify(P.BOILER_DOMAINS)), {flow: [0, 14, 0.1], set: [35, 65, 1], inlet: [5, 20, 1], pipe: [0, 15, 0.5]});
t.ok(P.DECLARED.minFiring === V.heatOutput[0] && P.BOILER_DOMAINS.set[1] === V.maxTemp && P.BOILER_DEFAULTS.flow === V.flow, 'the lowest firing, the temperature limit and the rated flow come from the sheet');
t.ok(P.BOILER_DOMAINS.flow[1] > V.flow && P.BOILER_DOMAINS.flow[0] === 0 && V.minDraw > P.BOILER_DOMAINS.flow[2], 'the flow spans from a closed tap past the rated one, in steps below the lowest draw');

// The air: its molar mass rebuilt from what is in it, and the air one mole of methane needs.
{
  const shares = {nitrogen: SRC.air.nitrogen, oxygen: SRC.air.oxygen, argon: SRC.air.argon};
  const molar = {nitrogen: 2 * SRC.weights.nitrogen, oxygen: 2 * SRC.weights.oxygen, argon: SRC.weights.argon};
  const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
  const mixture = Object.entries(shares).reduce((sum, [name, share]) => sum + share * molar[name], 0) / total;
  t.ok(Math.abs(mixture - SRC.air.molar) / SRC.air.molar < 0.001, `nitrogen, oxygen and argon at their atomic weights make air of ${f3(mixture)} g/mol, the page's ${SRC.air.molar}`);
  const perOxygen = 2 / (SRC.air.oxygen / 100);
  t.ok(Math.abs(P.AIR_MOLES - perOxygen) / perOxygen < 0.0005 && P.AIR_MOLES < perOxygen, 'the moles of air for one mole of methane, a little under two over the oxygen share because the trace gases are left out');
  const byMass = (2 * molar.oxygen + 2 * shares.nitrogen / shares.oxygen * molar.nitrogen + 2 * shares.argon / shares.oxygen * molar.argon) / SRC.methane.molar;
  t.ok(Math.abs(P.AIR_MASS - byMass) / byMass < 0.001, `${f1(P.AIR_MASS)} kg of air for each kilogram of methane, weighed out molecule by molecule as ${f1(byMass)}`);
}

/** The flue gas for one mole of methane at `lambda`, balanced atom by atom: carbon, hydrogen, oxygen, nitrogen and argon all accounted for. */
function balance(lambda) {
  const perOxygen = {nitrogen: SRC.air.nitrogen / SRC.air.oxygen, argon: SRC.air.argon / SRC.air.oxygen};
  const oxygenIn = 2 * lambda, moles = {
    carbonDioxide: 1, water: 2, oxygen: oxygenIn - 2,
    nitrogen: oxygenIn * perOxygen.nitrogen, argon: oxygenIn * perOxygen.argon,
  };
  const carbon = moles.carbonDioxide, hydrogen = 2 * moles.water;
  const oxygenAtoms = 2 * moles.carbonDioxide + moles.water + 2 * moles.oxygen;
  const molar = {carbonDioxide: SRC.water.carbonDioxide, water: SRC.water.molar, oxygen: 2 * SRC.weights.oxygen, nitrogen: 2 * SRC.weights.nitrogen, argon: SRC.weights.argon};
  const mass = Object.entries(moles).reduce((sum, [name, value]) => sum + value * molar[name], 0);
  return {moles, mass, carbon, hydrogen, oxygenAtoms, total: Object.values(moles).reduce((sum, value) => sum + value, 0)};
}
{
  const sheet = balance(P.LAMBDA);
  t.ok(sheet.carbon === 1 && sheet.hydrogen === 4, 'one carbon and four hydrogens from one methane, all in the products');
  t.near(sheet.oxygenAtoms, 4 * P.LAMBDA, 1e-9, 'every oxygen atom that went in comes out');
  const fuelMass = V.inputGross / SRC.methane.hhv, mine = P.combustionOf(V.inputGross);
  const flueMass = sheet.mass / SRC.methane.molar * fuelMass;
  t.ok(Math.abs(flueMass - V.flueMass) / V.flueMass < 0.005, `the balance sends ${f2(flueMass)} g/s up the flue against the sheet's ${V.flueMass}`);
  // The excess air found the other way round: what lambda makes the balance give the sheet's flue mass flow.
  const found = bisect(lambda => balance(lambda).mass / SRC.methane.molar * fuelMass - V.flueMass, 0.5, 3);
  t.ok(Math.abs(found - P.LAMBDA) / P.LAMBDA < 0.005, `bisecting the balance for the sheet's ${V.flueMass} g/s gives an air ratio of ${f3(found)}, the model's ${f3(P.LAMBDA)}`);
  t.ok(P.LAMBDA > 1 && f0(100 * (P.LAMBDA - 1)) === '16', 'about 16% more air than the flame needs');
  for (const [name, value] of Object.entries(mine.moles)) t.near(value, sheet.moles[name], 1e-9, `${name} in the products`);
  t.near(mine.total, sheet.total, 1e-9, 'the moles of flue gas');
  t.near(mine.fuel + mine.air, mine.mass, 1e-12, 'what goes in comes out');
  t.ok(Math.abs(mine.mass - flueMass) / flueMass < 0.005, 'the two routes to the flue mass flow agree');
  t.near(mine.shares.water, 2 / sheet.total, 1e-12, 'the steam share is two moles over them all');
  t.near(mine.steam, mine.fuel * 2 * SRC.water.molar / SRC.methane.molar, 1e-15, 'the steam mass is two waters for each methane');
  counts.plans++;
}

// The dew point: the Buck equation bisected, and two other fits for company.
{
  const flue = P.combustionOf(V.inputGross);
  const bisected = bisect(celsius => P.buckPressure(celsius) - flue.partial, 0, 100);
  t.near(flue.dew, bisected, 1e-6, 'the closed form dew point is the one bisection finds');
  for (const fit of [SRC.magnus, SRC.sonntag]) {
    const other = bisect(celsius => fit.a * Math.exp(fit.b * celsius / (fit.c + celsius)) - flue.partial, 0, 100);
    t.ok(Math.abs(other - flue.dew) < 0.5, `another fit puts the dew point at ${f2(other)} °C, within half a degree of the Buck equation's ${f2(flue.dew)} °C`);
  }
  t.ok(flue.dew > SRC.buck.to && flue.dew < SRC.sonntag.to, 'the dew point sits just past the Buck fit, inside the range of the fit that reaches 60 °C');
  t.ok(V.flueTemp > flue.dew && f0(flue.dew) === '56', 'the sheet’s flue runs above the dew point, so nothing condenses in this model');
  t.ok(flue.dew < SRC.condensing.returnWater + 5 && flue.dew > SRC.condensing.returnWater, 'and that dew point is just above the return temperature the Condensing boiler page asks for');
  for (const celsius of [0, 10, 25, 40, 50]) t.near(P.dewPointOf(P.buckPressure(celsius)), celsius, 1e-9, `the Buck equation turned around returns ${celsius} °C`);
}

// The sheet's own numbers, weighed against each other.
{
  const carried = V.flow / 60 * SRC.water.density * SRC.water.cp * V.rise / 1000;
  t.ok(Math.abs(carried - V.output) / V.output < 0.01, `${V.flow} L/min raised ${V.rise} °C carries ${f2(carried)} kW, within a percent of the sheet's ${V.output} kW`);
  const gas = V.inputGross * 3600 / (V.cvGross * 1000);
  t.ok(Math.abs(gas - V.gasRate) / V.gasRate < 0.002, `${V.inputGross} kW gross at ${V.cvGross} MJ/m³ is ${f3(gas)} m³/h against the sheet's ${V.gasRate}`);
  t.ok(Math.abs(V.cvGross / V.cvNet - SRC.methane.hhv / SRC.methane.lhv) < 0.003, 'the sheet’s gross over net matches methane’s gross over net');
  t.ok(Math.abs(V.inputGross / V.inputNet - SRC.methane.hhv / SRC.methane.lhv) < 0.003, 'and so does its gross input over its net input');
  t.near(SRC.methane.hhvMol / SRC.methane.molar, SRC.methane.hhv, 0.3, 'the heat of combustion by the mole and by the kilogram agree');
  t.near(SRC.methane.lhvMol / SRC.methane.molar, SRC.methane.lhv, 0.3, 'and so do the two lower ones');
  const flue = P.combustionOf(V.inputGross), out = V.output + flue.latent + flue.sensible;
  t.ok(Math.abs(out - V.inputGross) / V.inputGross < 0.02, `the water's ${V.output} kW, the steam's ${f2(flue.latent)} kW and the flue's ${f2(flue.sensible)} kW add to ${f2(out)} kW against ${V.inputGross} kW in, within two percent`);
  t.ok(f1(100 * P.LATENT_SHARE) === '9.9' && 100 * P.LATENT_SHARE < SRC.condensing.gain[0], 'the steam carries 9.9% of the gross input, just under the 10 to 12% the Condensing boiler page says condensing recovers');
  const byBoiling = flue.steam * SRC.water.vaporization / 1000;
  t.ok(Math.abs(byBoiling - flue.latent) / flue.latent < 0.1, `the steam's ${f2(flue.steam)} g/s at the heat of vaporization is ${f2(byBoiling)} kW, within a tenth of the ${f2(flue.latent)} kW the two heating values differ by`);
  const mass = {carbonDioxide: SRC.water.carbonDioxide, water: SRC.water.molar, oxygen: 2 * SRC.weights.oxygen, nitrogen: 2 * SRC.weights.nitrogen, argon: SRC.weights.argon};
  const weighed = Object.entries(flue.shares).reduce((sum, [name, share]) => sum + share * mass[name] * SRC.cp[name], 0) / Object.entries(flue.shares).reduce((sum, [name, share]) => sum + share * mass[name], 0);
  t.ok(Math.abs(weighed - flue.cp) / flue.cp < 0.01, `the flue gas holds ${f2(flue.cp)} J/(g·K), weighed out gas by gas as ${f2(weighed)}`);
  t.ok(V.condensing[1] > V.heatOutput[1] && V.meanWater[0] < SRC.condensing.returnWater, 'the sheet gets more heat into cooler water, which is what condensing means');
  t.ok(SRC.tankless.power[0] <= V.output && V.output <= SRC.tankless.power[1] && SRC.tankless.flow[0] <= V.flow && V.flow <= SRC.tankless.flow[1], 'this boiler sits inside the range of combination boilers the Tankless water heating page gives');
}

// What the control does with the burner, at every setting.
{
  const domains = P.BOILER_DOMAINS;
  for (let flow = domains.flow[0]; flow <= domains.flow[1] + 1e-9; flow += 0.1) {
    for (const set of [35, 45, 55, 65]) {
      for (const inlet of [5, 12, 20]) {
        const plan = P.boilerPlan({flow: Number(flow.toFixed(1)), set, inlet});
        counts.plans++;
        const massFlow = plan.values.flow / 60;
        t.ok(Number.isFinite(plan.power) && plan.power >= 0 && plan.power <= V.output + 1e-12, 'the burner never fires past the sheet’s output');
        if (!plan.firing) {
          t.ok(plan.power === 0 && plan.values.flow < V.minDraw && plan.hotAt === null, 'below the lowest draw nothing fires and the tap never comes up');
          continue;
        }
        t.ok(plan.power >= P.DECLARED.minFiring - 1e-12, 'and never below its lowest firing');
        const need = massFlow * SRC.water.cp * (set - inlet) / 1000;
        t.near(plan.need, need, relative(need, 1e-9), 'the heat the tap asks for');
        t.near(plan.outlet, inlet + plan.power * 1000 / (massFlow * SRC.water.cp), relative(60, 1e-9), 'the water leaves at the inlet plus what the burner adds');
        t.ok(plan.outlet <= V.maxTemp + 1e-9, 'and never above the sheet’s limit');
        if (plan.held === 'held') t.near(plan.outlet, set, 1e-9, 'inside its range the control holds the setting exactly');
        if (plan.held === 'short') t.ok(plan.power === V.output && plan.outlet < set, 'asked for more than it has, the boiler falls short of the setting');
        if (plan.held === 'lowest') t.ok(plan.power === P.DECLARED.minFiring && plan.outlet > set, 'asked for less than its lowest firing, it overshoots');
        t.near(plan.gross, plan.power / (V.output / V.inputGross), relative(30, 1e-9), 'the gross input');
        t.near(plan.gas, plan.gross * 3.6 / V.cvGross, relative(3, 1e-9), 'the gas it burns');
        t.near(plan.flue.mass, plan.flue.fuel * (1 + P.AIR_MASS * P.LAMBDA), relative(11, 1e-9), 'the flue mass flow follows the firing');
        t.near(plan.tau, V.content / (plan.values.flow / 60), relative(20, 1e-9), 'the time the boiler’s water is replaced in');
      }
    }
  }
  // More flow takes the rise down once the burner is at its most, and the tap is always cooler for it.
  let last = Infinity;
  for (let flow = 11; flow <= 14 + 1e-9; flow += 0.1) {
    const plan = P.boilerPlan({flow: Number(flow.toFixed(1))});
    counts.plans++;
    t.ok(plan.rise < last + 1e-12 && plan.power === V.output, 'past the rated flow the rise only falls');
    last = plan.rise;
  }
  const rated = P.boilerPlan({flow: V.flow, set: P.BOILER_DEFAULTS.inlet + V.rise, inlet: P.BOILER_DEFAULTS.inlet});
  t.ok(f1(rated.power) === f1(V.flow / 60 * SRC.water.cp * V.rise / 1000) && f1(rated.rise) === f1(V.rise), 'at the sheet’s flow and rise the model asks for the sheet’s heat');
}

// The boiler's stirred volume, integrated, and the pipe to the tap, advected.
{
  const plan = P.boilerPlan({});
  const volume = V.content / 1000, flow = plan.values.flow / 60000;
  const derivative = (time, temperature) => (flow * (plan.values.inlet - temperature) + plan.power * 1000 / (SRC.water.density * 1000 * SRC.water.cp)) / volume;
  let temperature = plan.values.inlet, worst = 0;
  const dt = 0.002;
  for (let step = 0; step < 15000; step++) {
    const time = plan.litAt + step * dt;
    worst = Math.max(worst, Math.abs(temperature - P.tankAt(plan, time)));
    temperature = rk4(temperature, time, dt, derivative);
  }
  t.ok(worst < 1e-6, `integrating the stirred volume from the inlet temperature tracks the model within ${worst.toExponential(1)} °C`);
  t.near(P.tankAt(plan, plan.litAt + plan.tau), plan.values.inlet + plan.rise * (1 - Math.exp(-1)), 1e-9, 'one filling of the boiler covers 1 − 1/e of the rise');

  // The pipe as cells of water, each carrying its temperature along.
  const cells = 400, step = plan.delay / cells;
  let pipe = Array.from({length: cells}, () => plan.values.inlet);
  for (let i = 0; i * step <= plan.duration; i++) {
    const time = i * step;
    pipe = [P.tankAt(plan, time), ...pipe.slice(0, cells - 1)];
    counts.cells++;
    const mine = P.tapAt(plan, time);
    t.ok(Math.abs(pipe[cells - 1] - mine) < 0.5, `the advected pipe reads within half a degree of the model at ${f1(time)} s`);
  }
  const arrival = bisect(time => P.tapAt(plan, time) - (plan.values.inlet + 0.5), 0, plan.duration);
  t.ok(Math.abs(arrival - (plan.litAt + plan.delay)) < 0.2, 'the first warm water reaches the tap a pipeful after the flame lights');
  const reaches = bisect(time => P.tapAt(plan, time) - (plan.outlet - P.DECLARED.close), 0, plan.duration);
  t.near(reaches, plan.hotAt, 1e-6, 'the tap comes within a degree of its steady temperature when the model says it does');
  t.near(plan.pipeVolume, Math.PI / 4 * (P.DECLARED.bore / 1000) ** 2 * plan.values.pipe * 1000, 1e-12, 'the pipe holds what its bore and length say');
  t.ok(f2(plan.pipeVolume / plan.values.pipe) === '0.15', 'about 0.15 L for each meter of 15 mm pipe');
  for (const pipeLength of [0, 2.5, 7.5, 15]) {
    const other = P.boilerPlan({pipe: pipeLength});
    counts.plans++;
    t.near(other.delay, other.pipeVolume / (other.values.flow / 60), relative(60, 1e-9), `${pipeLength} m of pipe takes its own time`);
    t.ok(other.hotAt >= other.litAt + other.delay, 'and the tap is never hot before the water gets there');
  }
  t.ok(P.boilerPlan({flow: 0}).delay === null && P.boilerPlan({flow: 0}).hotAt === null && P.boilerPlan({flow: 0}).need === null, 'with the tap closed there is no flow, no wait and nothing asked for');
  for (const values of [{}, {flow: 0}, {flow: 1.5}, {flow: 14}, {flow: 2, set: 65, inlet: 5, pipe: 15}]) {
    const other = P.boilerPlan(values);
    counts.plans++;
    const numbers = JSON.stringify(other, (key, value) => (typeof value === 'number' && !Number.isFinite(value) ? 'BAD' : value));
    t.ok(!numbers.includes('BAD'), `${JSON.stringify(values)}: nothing infinite anywhere in the plan`);
    t.ok(other.duration >= P.DECLARED.shortest && other.duration <= P.DECLARED.longest && other.duration % 10 === 0, 'the run is a round number of seconds inside its bounds');
    t.ok(other.chart.length === P.DECLARED.samples && other.chart[0].t === 0 && Math.abs(other.chart.at(-1).t - other.duration) < 1e-9, 'the chart spans the whole run');
  }
}

// Every step of the run, in order.
{
  const plan = P.boilerPlan({});
  t.ok(!P.boilerAt(plan, 0).open && !P.boilerAt(plan, 0).lit, 'nothing runs before the tap opens');
  t.ok(P.boilerAt(plan, 1).purging && !P.boilerAt(plan, 1).sparking && !P.boilerAt(plan, 1).lit, 'the fan purges first');
  t.ok(P.boilerAt(plan, 4).sparking && !P.boilerAt(plan, 4).lit, 'then the spark runs');
  t.ok(P.boilerAt(plan, 6).lit && !P.boilerAt(plan, 6).sparking, 'then the flame is lit');
  for (const time of [0, 0.5, 1, 2.9, 3, 4, 4.9, 5, 6, 12, 20, 30]) {
    const now = P.boilerAt(plan, time);
    t.ok(!(now.purging && now.sparking) && !(now.sparking && now.lit) && !(now.purging && now.lit), `at ${time} s the boiler is doing one of those things, not two`);
    t.ok(now.power === (now.lit ? plan.power : 0), `at ${time} s no gas burns until the flame is proven`);
    t.ok(now.arrived === (time >= plan.litAt + plan.delay), `at ${time} s the water that left the boiler has had a pipeful of time to arrive`);
    t.ok(now.hot === (time >= plan.hotAt), `at ${time} s the tap is hot only when the model says it is`);
  }
  t.ok(!P.boilerAt(plan, plan.litAt).hot && !P.boilerAt(plan, plan.litAt + plan.delay).hot && P.boilerAt(plan, plan.hotAt).hot, 'lighting the flame is not the same as hot water at the tap');
  t.near(plan.share, plan.power / V.output, 1e-12, 'the firing share is of the boiler’s hot water output');
  t.ok(P.boilerPlan({flow: 14}).share === 1 && P.boilerPlan({flow: 1.5}).share === 0, 'wide open the burner gives everything it has, and a trickle nothing at all');
  {
    const slow = P.boilerPlan({flow: 2, set: 65, inlet: 5, pipe: 15});
    t.ok(slow.hotAt > slow.duration && !slow.reaches, 'a trickle down a long pipe is still not hot when the run ends');
    t.ok(plan.reaches && plan.hotAt < plan.duration, 'while the default run gets there with time to spare');
  }
  t.ok(P.boilerAt(plan, plan.duration + 100).t === plan.duration, 'the run stops at its end');
  const trickle = P.boilerPlan({flow: 1.5});
  t.ok(!P.boilerAt(trickle, 10).lit && !P.boilerAt(trickle, 10).purging && P.boilerAt(trickle, 10).tap === trickle.values.inlet, 'a trickle never lights, and the tap stays at the mains temperature');
  checkRefusals(P.sampleBoiler, P.BOILER_DOMAINS, t);
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back from its geometry.
// ---------------------------------------------------------------------------

const model = M.createGasBoilerModel(), T = model.topology;
// Anything read back from a drawn line comes through a 32 bit buffer, so it is compared to that.
const drawn = 2e-6;
const pointsOf = line => {
  const array = line.geometry.attributes.position.array, count = line.geometry.drawRange.count, room = array.length / 3;
  const n = Number.isFinite(count) ? Math.min(count, room) : room;
  return Array.from({length: n}, (_, i) => [array[i * 3], array[i * 3 + 1], array[i * 3 + 2]]);
};
const extent = points => ({
  x: [Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0]))],
  y: [Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1]))],
});
const rectOf = mesh => ({x: [mesh.position.x - mesh.scale.x / 2, mesh.position.x + mesh.scale.x / 2], y: [mesh.position.y - mesh.scale.y / 2, mesh.position.y + mesh.scale.y / 2]});
const sameColor = (color, other) => Math.abs(color.r - other.r) < 1e-6 && Math.abs(color.g - other.g) < 1e-6 && Math.abs(color.b - other.b) < 1e-6;
const settle = (values, time) => { model.reset(); if (values) model.update(values); if (time) model.advance(time / P.DECLARED.faster); model.root.updateMatrixWorld(true); counts.poses++; return model.getState(); };

// The casing at true size, and everything inside it where the constants put it.
{
  const state = settle(null, 0), casing = extent(pointsOf(T.caseLine));
  t.near(casing.x[1] - casing.x[0], V.casing[1] * M.MM, drawn, 'the casing is drawn the sheet’s 445 mm wide');
  t.near(casing.y[1] - casing.y[0], V.casing[0] * M.MM, drawn, 'and the sheet’s 740 mm tall');
  t.ok(M.timesSmaller() === 20 && M.MM * 1000 === 2 && M.METER === 0.1, 'the boiler at true size, the pipe twenty times smaller');
  const chamber = extent(pointsOf(T.chamberLine)), burner = rectOf(T.burnerBar), passes = T.passes.map(rectOf);
  t.ok(chamber.x[0] > casing.x[0] && chamber.x[1] < casing.x[1] && chamber.y[0] > casing.y[0] && chamber.y[1] < casing.y[1], 'the combustion chamber sits inside the casing');
  t.ok(burner.x[0] > chamber.x[0] && burner.x[1] < chamber.x[1] && burner.y[0] > chamber.y[0], 'the burner inside the chamber');
  for (const pass of passes) t.ok(pass.y[0] > burner.y[1] && pass.y[1] < chamber.y[1], 'every exchanger pass above the burner and inside the chamber');
  t.ok(passes.length === 2 * M.BOILER.passes - 1, 'five passes and the four returns between them');
  const flue = extent(pointsOf(T.flueWalls));
  t.ok(flue.y[0] > casing.y[1] - 40 * M.MM && flue.y[1] > casing.y[1], 'the flue leaves through the top of the casing');
  t.near(flue.x[1] - flue.x[0], V.flueDiameter * M.MM, drawn, 'and is drawn the sheet’s 100 mm across');
  t.ok(state.values.flow === P.BOILER_DEFAULTS.flow, 'reset puts the controls back');
}

// The flames stand in proportion to the firing, and never reach the exchanger.
{
  const apexOf = () => Array.from({length: M.BOILER.flames}, (_, i) => T.flames.geometry.attributes.position.array[i * 9 + 7]);
  settle(null, 0);
  t.ok(!T.flames.visible, 'no flames before the tap opens');
  const lowest = rectOf(T.passes[0]).y[0];
  let previous = 0;
  for (const flow of [2, 4, 6, 8, 10.6, 14]) {
    const state = settle({flow}, 60);
    const apexes = apexOf(), base = M.BOILER.burner[3] * M.MM;
    t.ok(T.flames.visible && apexes.every(apex => apex > base), `at ${flow} L/min the flames stand above the burner`);
    const mean = apexes.reduce((sum, value) => sum + value, 0) / apexes.length - base;
    t.ok(mean > previous, 'more firing, taller flames');
    previous = mean;
    t.ok(Math.abs(mean / (M.BOILER.flame[1] * M.MM) - state.share) < 0.05, `the flames stand in proportion to the ${f1(state.power)} kW the burner gives`);
    t.ok(Math.max(...apexes) < lowest, 'and never reach the exchanger');
  }
  const cold = settle({flow: 1.5}, 60);
  t.ok(!T.flames.visible && cold.power === 0 && !T.gasLine.visible, 'a trickle never lights the burner, and no gas moves');
  settle(null, 4);
  t.ok(T.spark.visible && T.gasLine.visible && !T.flames.visible, 'the spark runs with the valve open before the flame takes');
  settle(null, 1);
  t.ok(!T.spark.visible && !T.gasLine.visible, 'and nothing but the fan before that');
  const openGate = (() => { settle(null, 60); return T.gate.position.y; })(), shutGate = (() => { settle(null, 1); return T.gate.position.y; })();
  t.ok(openGate > shutGate, 'the valve’s gate stands open while the burner fires');
}

// The water's colors, the turbine and the fan.
{
  for (const time of [0, 8, 20, 30]) {
    const state = settle(null, time);
    const wanted = M.heatColor(state.now.tank);
    t.ok(T.passes.every(pass => sameColor(pass.material.color, wanted)), `at ${time} s every pass carries the color of the water leaving it`);
    t.ok(sameColor(T.coldPipe.material.color, M.heatColor(state.values.inlet)), 'the cold pipe keeps the mains color');
    t.ok(sameColor(T.hotPipe.material.color, wanted), 'the hot pipe carries the water’s color');
  }
  const warm = settle(null, 30), cool = settle({inlet: 20}, 0);
  t.ok(!sameColor(M.heatColor(warm.now.tank), M.heatColor(cool.now.tank)), 'hot water and cold water are drawn differently');
  settle(null, 0);
  const still = T.turbine.rotation.z, stillFan = T.rotor.rotation.z;
  settle(null, 20);
  t.ok(T.turbine.rotation.z !== still && T.rotor.rotation.z !== stillFan, 'the turbine and the fan turn once the tap is open');
  const slow = (settle({flow: 4}, 20), T.turbine.rotation.z), fast = (settle({flow: 14}, 20), T.turbine.rotation.z);
  t.ok(Math.abs(fast) > Math.abs(slow), 'and the turbine turns further the more water runs');
}

// The knob's pointer follows the setting.
{
  let previous = null, swept = 0;
  for (const set of [35, 45, 55, 65]) {
    settle({set}, 0);
    const [from, to] = pointsOf(T.pointer);
    const direction = [to[0] - from[0], to[1] - from[1]];
    t.near(Math.hypot(direction[0], direction[1]), M.BOILER.knob[2] * 0.86 * M.MM, drawn, 'the pointer reaches most of the way across the knob');
    if (previous) {
      const cross = previous[0] * direction[1] - previous[1] * direction[0], dot = previous[0] * direction[0] + previous[1] * direction[1];
      t.ok(cross < 0, 'and turns clockwise as the setting rises');
      swept += Math.abs(Math.atan2(cross, dot));
    }
    previous = direction;
  }
  t.near(swept, 1.5 * Math.PI, 1e-4, 'the knob sweeps three quarters of a turn from end to end');
}

// What goes up the flue, drawn as shares of a bar.
{
  const state = settle(null, 30), shares = state.flue.shares;
  let left = 0;
  M.GASES.forEach((name, i) => {
    const bar = rectOf(T.bars[i]);
    t.near(bar.x[0], left, 1e-9, `${name} starts where the gas before it ends`);
    t.near(bar.x[1] - bar.x[0] + M.FLUEVIEW.gap, shares[name] * M.FLUEVIEW.bar[0], 1e-9, `${name} takes its share of the bar`);
    left += shares[name] * M.FLUEVIEW.bar[0];
  });
  t.near(left, M.FLUEVIEW.bar[0], 1e-9, 'the five gases fill the bar');
  t.near(Object.values(shares).reduce((sum, value) => sum + value, 0), 1, drawn, 'and they are all of the flue gas');
  t.ok(shares.nitrogen > shares.water && shares.water > shares.carbonDioxide && shares.carbonDioxide > shares.oxygen && shares.oxygen > shares.argon, 'mostly nitrogen, then steam, then carbon dioxide');
  const dew = pointsOf(T.dewMark)[0][0], flue = pointsOf(T.flueMark)[0][0];
  t.near(dew, M.scaleX(state.flue.dew), drawn, 'the dew point is marked where the scale puts it');
  t.near(flue, M.scaleX(V.flueTemp), drawn, 'and so is the flue temperature');
  t.ok(flue > dew, 'with the flue warmer than the dew point');
}

// The pipe to the tap: its length, its colors, and the stream.
{
  for (const pipe of [0, 5, 15]) {
    const state = settle({pipe}, 20);
    const pieces = T.pieces.map(rectOf), shown = T.pieces.filter(piece => piece.visible).length;
    t.ok(shown === (pipe > 0 ? M.PIPEVIEW.pieces : 0), `${pipe} m of pipe is drawn in ${pipe > 0 ? M.PIPEVIEW.pieces : 0} pieces`);
    t.near(pieces.at(-1).x[1] - pieces[0].x[0], pipe * M.METER, 1e-9, 'drawn to its length');
    t.near(rectOf(T.tapBody).x[0], pipe * M.METER, 1e-9, 'with the tap at the end of it');
    if (pipe === 0) continue;
    const temperatures = T.pieces.map((piece, i) => P.tankAt(state, state.now.t - state.delay * (i + 0.5) / M.PIPEVIEW.pieces));
    T.pieces.forEach((piece, i) => t.ok(sameColor(piece.material.color, M.heatColor(temperatures[i])), `the water ${i + 1} pieces along carries its own temperature`));
    for (let i = 1; i < temperatures.length; i++) t.ok(temperatures[i] <= temperatures[i - 1] + 1e-9, 'the water nearer the tap is never hotter than the water behind it');
    counts.points += T.pieces.length;
  }
  const state = settle(null, 30);
  t.ok(T.stream.visible && sameColor(T.stream.material.color, M.heatColor(state.now.tap)), 'the tap pours what reaches its end');
  settle({flow: 0}, 30);
  t.ok(!T.stream.visible, 'and pours nothing with the tap closed');
}

// The chart.
{
  for (const values of [{}, {flow: 14}, {flow: 2, set: 65, inlet: 5, pipe: 15}]) {
    const state = settle(values, 0);
    const guideTank = pointsOf(T.guideTank), guideTap = pointsOf(T.guideTap);
    t.ok(guideTank.length === P.DECLARED.samples, 'the whole run is drawn faintly');
    state.chart.forEach((sample, i) => {
      t.near(guideTank[i][0], M.chartX(state, sample.t), drawn, 'each sample at its time');
      t.near(guideTank[i][1], M.chartY(sample.tank), drawn, 'and at its temperature');
    });
    counts.points += guideTank.length;
    t.ok(guideTank.every(point => point[0] >= M.CHART.x - drawn && point[0] <= M.CHART.x + M.CHART.w + drawn && point[1] >= M.CHART.y - drawn && point[1] <= M.CHART.y + M.CHART.h + drawn), 'the curve stays inside the frame');
    t.near(guideTank[0][0], M.CHART.x, drawn, 'starting at the left edge');
    t.near(guideTank.at(-1)[0], M.CHART.x + M.CHART.w, drawn, 'and reaching the right edge');
    t.near(guideTank[(P.DECLARED.samples - 1) / 2][0], M.CHART.x + M.CHART.w / 2, drawn, 'with the middle of the run half way across the frame, however long the run lasts');
    if (state.drawing) t.ok(guideTap.length === P.DECLARED.samples && guideTap.every((point, i) => point[1] <= guideTank[i][1] + 1e-9), 'the tap is never ahead of the boiler');
    t.near(pointsOf(T.setLine)[0][1], M.chartY(state.values.set), drawn, 'the setting is drawn where it falls');
    t.near(pointsOf(T.inletLine)[0][1], M.chartY(state.values.inlet), drawn, 'and so is the mains temperature');
    if (state.firing) t.near(pointsOf(T.litMark)[0][0], M.chartX(state, state.litAt), drawn, 'the first mark is the flame lighting');
    t.ok(T.hotMark.visible === state.reaches, 'the second mark is there only if the tap comes up within the run');
    if (state.reaches) t.near(pointsOf(T.hotMark)[0][0], M.chartX(state, state.hotAt), drawn, 'and it stands where the tap comes up');
  }
  settle(null, 0);
  t.ok(pointsOf(T.curveTank).length <= 1 && pointsOf(T.cursor).length <= 1, 'nothing is drawn dark before the run starts');
  const half = settle(null, 15), grown = pointsOf(T.curveTank).length;
  t.ok(grown > 1 && grown < P.DECLARED.samples, 'the dark curve grows with the clock');
  t.near(pointsOf(T.curveTank).at(-1)[0], M.chartX(half, half.now.t), drawn, 'its last point sits at the clock');
  t.near(pointsOf(T.curveTank).at(-1)[1], M.chartY(half.now.tank), drawn, 'at what the water reads now');
  const whole = settle(null, 30);
  t.ok(pointsOf(T.curveTank).length === P.DECLARED.samples, 'and reaches the end of the run');
  t.ok(Math.abs(whole.now.tank - whole.outlet) < P.DECLARED.close, 'which is after the water has come up to temperature');
  const ticks = pointsOf(T.ticks);
  t.ok(ticks.length === 2 * (Math.round(whole.duration / M.CHART.tickEvery) - 1), 'a tick every ten seconds');
}

// Time runs to the right, heat runs up, and the flue's scale runs warmer to the right.
t.ok(M.chartY(60) > M.chartY(20) && M.chartX(P.boilerPlan({}), 10) > M.chartX(P.boilerPlan({}), 0) && M.scaleX(70) > M.scaleX(30), 'later is drawn to the right, hotter is drawn higher');

// The four views stay out of each other's way, and the leaders reach them.
{
  settle({pipe: 15}, 30);
  model.root.updateMatrixWorld(true);
  const boxOf = object => new THREE.Box3().setFromObject(object);
  const views = [['boiler', T.shell], ['flue gas', T.fluePart], ['pipe', T.pipePart], ['chart', T.chartPart]];
  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      const a = boxOf(views[i][1]), b = boxOf(views[j][1]);
      t.ok(a.max.x < b.min.x - 0.02 || b.max.x < a.min.x - 0.02 || a.max.y < b.min.y - 0.02 || b.max.y < a.min.y - 0.02, `${views[i][0]} and ${views[j][0]} are kept apart`);
    }
  }
  const leaders = pointsOf(T.leaders);
  const boiler = boxOf(T.shell), flue = boxOf(T.fluePart), pipe = boxOf(T.pipePart), chart = boxOf(T.chartPart);
  t.ok(leaders[0][0] > boiler.min.x && leaders[0][0] < boiler.max.x && leaders[1][0] <= flue.min.x + 1e-9, 'the first leader runs from the flue outlet to the flue gas bar');
  t.ok(leaders[2][1] < boiler.min.y + 1e-9 && leaders[3][0] <= pipe.min.x + 1e-9, 'the second from the hot outlet to the pipe');
  t.near(leaders[1][1], M.FLUEVIEW.origin[1] + M.FLUEVIEW.bar[1] / 2, drawn, 'the first leader ends beside the flue gas bar, not at some other view');
  t.near(leaders[3][1], M.PIPEVIEW.origin[1] + M.PIPEVIEW.thickness, drawn, 'and the second beside the pipe to the tap');
  for (const [a, b] of [[leaders[0], leaders[1]], [leaders[2], leaders[3]]]) {
    for (const box of [chart, pipe]) {
      const crosses = [0, 0.25, 0.5, 0.75, 1].some(s => {
        const x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
        return x > box.min.x && x < box.max.x && y > box.min.y && y < box.max.y;
      });
      t.ok(!crosses || box === pipe && b === leaders[3], 'no leader runs across another view');
    }
  }
}

// Nothing anywhere is left infinite, at any setting or time.
const settings = [{}, {flow: 0}, {flow: 1.5}, {flow: 2}, {flow: 14}, {flow: 2, set: 35, inlet: 20}, {flow: 3, set: 65}, {inlet: 20}, {pipe: 0}, {pipe: 15}, {flow: 2, set: 65, inlet: 5, pipe: 15}];
for (const values of settings) {
  for (const time of [0, 3, 12, 400]) {
    settle(values, time);
    checkFinite(model.root, t);
  }
}

// ---------------------------------------------------------------------------
// 3. The lesson.
// ---------------------------------------------------------------------------

const run = values => P.boilerPlan(values), def = P.boilerPlan({});
checkTrialNumbers(L.gasBoilerLesson, {
  'Run the hot tap': s => { t.ok(s.held === 'held' && s.reaches, 'the default run holds the setting and comes up within the run'); return {'25.9': s.power, '45.0': s.outlet, 19: s.hotAt}; },
  'Open it wider': s => { t.ok(s.held === 'short' && s.power === V.output, 'wide open, the burner is at its most'); return {'34.2': s.need, '26.0': V.output, '26.6': s.rise, '36.6': s.outlet}; },
  'A trickle': s => { t.ok(!s.firing && s.values.flow < V.minDraw, 'a trickle is below the lowest draw'); return {2: V.minDraw, 10: s.values.inlet}; },
  'Turned down as far as it goes': s => { t.ok(s.held === 'lowest' && s.power === P.DECLARED.minFiring, 'the burner is at its lowest firing'); return {'2.1': s.need, '3.7': s.power, '46.5': s.outlet, '11.5': s.outlet - s.values.set}; },
  'The sheet’s own check': s => { t.ok(Math.abs(s.values.flow - V.checkFlow) < 1e-9 && s.values.set === V.maxTemp && Math.abs(s.outlet - V.checkTemp) <= 1, 'the sheet’s own check, within a degree of what it expects'); return {'11.5': s.power, '65.0': s.outlet, 64: V.checkTemp, 3: V.checkFlow}; },
  'Summer water': s => { t.ok(s.power < def.power && s.gas < def.gas && s.outlet === def.outlet, 'warmer water in, less gas burned for the same water out'); return {45: s.outlet, '18.5': s.power, '25.9': def.power, '2.68': def.gas, '1.92': s.gas}; },
  'A tap farther away': s => { t.ok(s.delay > def.delay && s.hotAt > def.hotAt, 'a longer pipe is a longer wait'); return {'2.18': s.pipeVolume, '12.3': s.delay, 27: s.hotAt, 19: def.hotAt}; },
}, run, t);

// Free text: each snippet computed, and every number in the text inside a snippet.
const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
}
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
for (const [where, text] of texts(L.gasBoilerLesson)) covered(text, {}, `Gas boiler ${where}`);

const flueAtFull = P.combustionOf(V.inputGross);
const limitSnippets = {
  [`flue temperature of ${f0(V.flueTemp)} °C at every firing rate`]: 'flue temperature of 73 °C at every firing rate',
  [`heating table’s ${f1(P.DECLARED.minFiring)} kW`]: 'heating table’s 3.7 kW',
  [`taken as ${f1(V.output)} over ${f1(V.inputGross)} at every rate`]: 'taken as 26.0 over 29.0 at every rate',
  [`water at ${f0(SRC.water.density)} kg/L and ${f0(SRC.water.cp)} J/(kg·K)`]: 'water at 1 kg/L and 4,184 J/(kg·K)',
  [`boiler’s ${f1(V.content)} L treated as one well stirred volume`]: 'boiler’s 0.5 L treated as one well stirred volume',
  [`entering at the ${f0(SRC.methane.at)} °C the heats of combustion are given at`]: 'entering at the 25 °C the heats of combustion are given at',
  [`a fan purge of ${f0(P.DECLARED.purge)} s and a spark of ${f0(P.DECLARED.spark)} s`]: 'a fan purge of 3 s and a spark of 2 s',
  [`a ${f0(V.connection)} mm copper pipe with a bore of ${f1(P.DECLARED.bore)} mm`]: 'a 15 mm copper pipe with a bore of 13.6 mm',
};
covered(L.boilerLimits, limitSnippets, 'boiler limits');
covered(L.gasBoilerLesson.limits, {
  [`the pipe to the tap drawn ${f0(M.timesSmaller())} times smaller`]: 'the pipe to the tap drawn 20 times smaller',
  [`plays ${P.DECLARED.faster} times faster`]: 'plays 5 times faster',
  ...limitSnippets,
}, 'Gas boiler limits');
covered(L.gasBoilerLesson.deeper[0].body, {
  [`capacity as ${f0(SRC.water.cp)} J/(kg·K)`]: 'capacity as 4,184 J/(kg·K)',
  [`at ${f1(V.flow)} L/min with a rise of ${f0(V.rise)} °C, which at ${f0(SRC.water.density)} kg/L works out as ${f1(V.flow / 60 * SRC.water.cp * V.rise / 1000)} kW against the ${f1(V.output)} kW`]: 'at 10.6 L/min with a rise of 35 °C, which at 1 kg/L works out as 25.9 kW against the 26.0 kW',
  [`combination boilers of ${SRC.tankless.power[0]} to ${SRC.tankless.power[1]} kW flows of ${SRC.tankless.flow[0]} to ${SRC.tankless.flow[1]} L/min`]: 'combination boilers of 24 to 54 kW flows of 9 to 23 L/min',
}, 'Gas boiler deeper 1');
{
  const lowest = P.boilerPlan({flow: 2, set: 35, inlet: 20});
  covered(L.gasBoilerLesson.deeper[1].body, {
    [`lowest ${f1(P.DECLARED.minFiring)} kW to ${f1(V.output)} kW, a turndown of ${f1(V.output / P.DECLARED.minFiring)} to 1`]: 'lowest 3.7 kW to 26.0 kW, a turndown of 7.0 to 1',
    [`down to ${f0(V.minDraw)} L/min drawn off and limits the hot water to ${f0(V.maxTemp)} °C`]: 'down to 2 L/min drawn off and limits the hot water to 65 °C',
    [`at ${f0(lowest.values.flow)} L/min raised to ${f0(lowest.values.set)} °C it needs ${f1(lowest.need)} kW and gives ${f1(lowest.power)} kW, so the water leaves ${f1(lowest.outlet - lowest.values.set)} °C too hot`]: 'at 2 L/min raised to 35 °C it needs 2.1 kW and gives 3.7 kW, so the water leaves 11.5 °C too hot',
  }, 'Gas boiler deeper 2');
}
covered(L.gasBoilerLesson.deeper[2].body, {
  'CH4 + 2 O2 → CO2 + 2 H2O': 'CH4 + 2 O2 → CO2 + 2 H2O',
  [`Two moles of oxygen come with the nitrogen and argon around them, ${f1(P.AIR_MOLES)} moles of dry air`]: 'Two moles of oxygen come with the nitrogen and argon around them, 9.5 moles of dry air',
  [`is ${f1(P.AIR_MASS)} kg of air for each kilogram of gas`]: 'is 17.2 kg of air for each kilogram of gas',
  [`carries ${f0(V.flueMass)} g/s at full output, and since the fuel is ${f2(flueAtFull.fuel)} g/s of that, the air is ${f0(100 * (P.LAMBDA - 1))}% more than the flame needs, an air to fuel equivalence ratio of ${f2(P.LAMBDA)}`]: 'carries 11 g/s at full output, and since the fuel is 0.52 g/s of that, the air is 16% more than the flame needs, an air to fuel equivalence ratio of 1.16',
  [`methane burning in air ${SRC.methane.flame.toLocaleString('en-US')} °C`]: 'methane burning in air 1,963 °C',
}, 'Gas boiler deeper 3');
covered(L.gasBoilerLesson.deeper[3].body, {
  [`methane ${f2(SRC.methane.hhv)} MJ/kg with the water in the exhaust condensed and ${f2(SRC.methane.lhv)} MJ/kg with it left as steam, so ${f1(100 * P.LATENT_SHARE)}% of the heat`]: 'methane 55.52 MJ/kg with the water in the exhaust condensed and 50.00 MJ/kg with it left as steam, so 9.9% of the heat',
  [`out at ${f1(V.cvGross)} MJ/m³ gross and ${f1(V.cvNet)} MJ/m³ net, a ratio of ${f3(V.cvGross / V.cvNet)} against methane’s ${f3(SRC.methane.hhv / SRC.methane.lhv)}`]: 'out at 38.7 MJ/m³ gross and 34.9 MJ/m³ net, a ratio of 1.109 against methane’s 1.110',
  [`Its ${f1(V.inputGross)} kW gross at ${f1(V.cvGross)} MJ/m³ is ${f2(V.inputGross * 3.6 / V.cvGross)} m³/h, and the sheet prints ${f3(V.gasRate)}`]: 'Its 29.0 kW gross at 38.7 MJ/m³ is 2.70 m³/h, and the sheet prints 2.695',
  [`gross input ${f1(V.output)} kW reaches the water, ${f1(100 * P.EFFICIENCY)}% of it`]: 'gross input 26.0 kW reaches the water, 89.7% of it',
}, 'Gas boiler deeper 4');
covered(L.gasBoilerLesson.deeper[4].body, {
  [`steam is ${f1(100 * flueAtFull.shares.water)}% of this flue gas by volume, a partial pressure of ${f1(flueAtFull.partial / 10)} kPa, and the Arden Buck equation puts its dew point at ${f0(flueAtFull.dew)} °C`]: 'steam is 16.5% of this flue gas by volume, a partial pressure of 16.7 kPa, and the Arden Buck equation puts its dew point at 56 °C',
  [`flue runs at ${f0(V.flueTemp)} °C`]: 'flue runs at 73 °C',
  [`about ${f0(SRC.condensing.returnWater)} °C or below and reports ${SRC.condensing.gain[0]} to ${SRC.condensing.gain[1]}% more heat for it, with condensate at a pH of ${SRC.condensing.ph[0]} to ${SRC.condensing.ph[1]}`]: 'about 55 °C or below and reports 10 to 12% more heat for it, with condensate at a pH of 3 to 5',
  [`gives ${f1(V.heatOutput[1])} kW into water at ${f0(V.meanWater[1])} °C and ${f1(V.condensing[1])} kW into water at ${f0(V.meanWater[0])} °C`]: 'gives 18.0 kW into water at 70 °C and 19.3 kW into water at 40 °C',
}, 'Gas boiler deeper 5');
covered(L.gasBoilerLesson.deeper[5].body, {
  [`take ${f0(def.litAt)} s before the flame lights`]: 'take 5 s before the flame lights',
  [`The ${f1(V.content)} L of water inside the boiler is replaced every ${f1(def.tau)} s at ${f1(V.flow)} L/min`]: 'The 0.5 L of water inside the boiler is replaced every 2.8 s at 10.6 L/min',
  [`the ${f0(V.connection)} mm pipe, ${f2(def.pipeVolume / def.values.pipe)} L for each meter, has to be pushed out: ${f2(def.pipeVolume)} L over ${f0(def.values.pipe)} m, another ${f1(def.delay)} s`]: 'the 15 mm pipe, 0.15 L for each meter, has to be pushed out: 0.73 L over 5 m, another 4.1 s',
}, 'Gas boiler deeper 6');
{
  const wide = P.boilerPlan({flow: 14});
  covered(L.gasBoilerLesson.quiz.explanation, {
    [`At ${f0(wide.values.flow)} L/min the tap asks for ${f1(wide.need)} kW; the burner can give ${f1(V.output)} kW, which raises that much water only ${f1(wide.rise)} °C, so it arrives at ${f1(wide.outlet)} °C`]: 'At 14 L/min the tap asks for 34.2 kW; the burner can give 26.0 kW, which raises that much water only 26.6 °C, so it arrives at 36.6 °C',
  }, 'Gas boiler quiz');
}

// The model's own words.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`${f0(V.casing[0])} mm tall and ${f0(V.casing[1])} mm wide`]: '740 mm tall and 445 mm wide',
  [`drawn ${f0(M.timesSmaller())} times smaller`]: 'drawn 20 times smaller',
  [`plays ${P.DECLARED.faster} times faster`]: 'plays 5 times faster',
}, 'system text');
covered(partText('boiler'), {[`The casing, ${f0(V.casing[0])} mm by ${f0(V.casing[1])} mm by ${f0(V.casing[2])} mm`]: 'The casing, 740 mm by 445 mm by 330 mm'}, 'boiler text');
covered(partText('burner'), {
  [`bar, ${f0(M.BOILER.burner[1] - M.BOILER.burner[0])} mm across`]: 'bar, 170 mm across',
  [`Its ${M.BOILER.flames} flames`]: 'Its 9 flames',
  [`the sheet’s ${f1(V.output)} kW`]: 'the sheet’s 26.0 kW',
}, 'burner text');
covered(partText('exchanger'), {[`${M.BOILER.passes} passes with returns at their ends, holding the sheet’s ${f1(V.content)} L`]: '5 passes with returns at their ends, holding the sheet’s 0.5 L'}, 'exchanger text');
covered(partText('fan'), {[`out of the ${f0(V.flueDiameter)} mm flue`]: 'out of the 100 mm flue'}, 'fan text');
covered(partText('valve'), {[`at the sheet’s ${f0(V.supply)} mbar`]: 'at the sheet’s 20 mbar'}, 'valve text');
covered(partText('water'), {[`fires only from ${f0(V.minDraw)} L/min up`]: 'fires only from 2 L/min up'}, 'water text');
covered(partText('control'), {[`limits that to ${f0(V.maxTemp)} °C`]: 'limits that to 65 °C'}, 'control text');
covered(partText('flue-gas'), {[`Every ${f0(1)} m³`]: 'Every 1 m³', [`the sheet’s ${f0(V.flueTemp)} °C`]: 'the sheet’s 73 °C'}, 'flue gas text');
covered(partText('pipe'), {[`The ${f0(V.connection)} mm copper pipe`]: 'The 15 mm copper pipe', [`drawn ${f0(M.timesSmaller())} times smaller`]: 'drawn 20 times smaller'}, 'pipe text');
covered(partText('chart'), {[`from ${f0(M.CHART.range[0])} to ${f0(M.CHART.range[1])} °C, with a tick every ${f0(M.CHART.tickEvery)} s`]: 'from 0 to 70 °C, with a tick every 10 s'}, 'chart text');

// The readings.
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Tap,Water in the boiler,Burner,Gas,Flue gas,Steam,Where the heat goes,Waiting,Pipe,Sped up', 'eleven readings');
  t.ok(find('Your result').value === `Ready · at ${f1(def.values.flow)} L/min the burner will settle at ${f1(def.power)} kW and the tap will run at ${f1(def.outlet)} °C; press Play to open the tap`, 'the result before the run');
  t.ok(find('Tap').value === `${f1(def.outlet)} °C at ${f1(def.values.flow)} L/min` && find('Burner').value === `${f1(def.power)} kW` && find('Gas').value === `${f2(def.gas)} m³/h`, 'the tap, the burner and the gas');
  t.ok(find('Flue gas').value === `${f1(def.flue.mass)} g/s at ${f0(V.flueTemp)} °C` && find('Steam').value === `${f1(100 * def.flue.shares.water)}% of the flue gas`, 'the flue gas and its steam');
  t.ok(find('Waiting').value === `hot after ${f0(def.hotAt)} s` && find('Pipe').value === `${f1(def.values.pipe)} m holds ${f2(def.pipeVolume)} L` && find('Sped up').value === `${P.DECLARED.faster} times faster`, 'the waiting, the pipe and the clock');
  t.ok(find('Where the heat goes').value === `${f1(100 * P.EFFICIENCY)}% to the water` && find('Water in the boiler').value === `${f1(def.values.inlet)} °C`, 'the efficiency, and the water still cold before the run');
  covered(find('Tap').hint, {
    [`rise: ${f1(def.values.flow)} L/min of water at ${f0(SRC.water.density)} kg/L and ${f0(SRC.water.cp)} J/(kg·K), raised ${f1(def.rise)} °C, carries ${f1(def.power)} kW`]: 'rise: 10.6 L/min of water at 1 kg/L and 4,184 J/(kg·K), raised 35.0 °C, carries 25.9 kW',
    [`The tap asks for ${f1(def.need)} kW, inside`]: 'The tap asks for 25.9 kW, inside',
  }, 'Tap hint');
  covered(find('Water in the boiler').hint, {
    [`the sheet’s ${f1(V.content)} L of hot water. At ${f1(def.values.flow)} L/min that water is replaced every ${f1(def.tau)} s, so after the flame lights the temperature closes on ${f1(def.outlet)} °C`]: 'the sheet’s 0.5 L of hot water. At 10.6 L/min that water is replaced every 2.8 s, so after the flame lights the temperature closes on 45.0 °C',
  }, 'Water hint');
  covered(find('Burner').hint, {
    [`from ${f1(P.DECLARED.minFiring)} kW to the sheet’s ${f1(V.output)} kW of hot water output, a turndown of ${f1(V.output / P.DECLARED.minFiring)} to 1`]: 'from 3.7 kW to the sheet’s 26.0 kW of hot water output, a turndown of 7.0 to 1',
    [`The tap asks for ${f1(def.need)} kW, inside`]: 'The tap asks for 25.9 kW, inside',
  }, 'Burner hint');
  covered(find('Gas').hint, {
    [`over ${f1(100 * P.EFFICIENCY)}%, the sheet’s ${f1(V.output)} kW out of ${f1(V.inputGross)} kW in`]: 'over 89.7%, the sheet’s 26.0 kW out of 29.0 kW in',
    [`Here that is ${f1(def.gross)} kW, and at the sheet’s gross calorific value of ${f1(V.cvGross)} MJ/m³ it burns ${f2(def.gas)} m³/h; the sheet gives ${f3(V.gasRate)} m³/h`]: 'Here that is 28.9 kW, and at the sheet’s gross calorific value of 38.7 MJ/m³ it burns 2.68 m³/h; the sheet gives 2.695 m³/h',
  }, 'Gas hint');
  covered(find('Flue gas').hint, {
    [`Burning ${f1(P.AIR_MASS)} kg of air for each kilogram of methane`]: 'Burning 17.2 kg of air for each kilogram of methane',
    [`the sheet’s ${f0(V.flueMass)} g/s of flue gas at full output means ${f0(100 * (P.LAMBDA - 1))}% more air`]: 'the sheet’s 11 g/s of flue gas at full output means 16% more air',
    [`At ${f1(def.power)} kW the burner takes ${f2(def.flue.fuel)} g/s of gas and ${f1(def.flue.air)} g/s of air`]: 'At 25.9 kW the burner takes 0.52 g/s of gas and 10.4 g/s of air',
  }, 'Flue gas hint');
  covered(find('Steam').hint, {
    [`steam is ${f1(100 * def.flue.shares.water)}% of the flue gas by volume, a partial pressure of ${f1(def.flue.partial / 10)} kPa of the ${f1(SRC.air.standard)} kPa`]: 'steam is 16.5% of the flue gas by volume, a partial pressure of 16.7 kPa of the 101.3 kPa',
    [`dew point of that at ${f0(def.flue.dew)} °C, and the sheet’s flue runs at ${f0(V.flueTemp)} °C, ${f0(V.flueTemp - def.flue.dew)} °C above it`]: 'dew point of that at 56 °C, and the sheet’s flue runs at 73 °C, 17 °C above it',
  }, 'Steam hint');
  covered(find('Where the heat goes').hint, {
    [`Of the sheet’s ${f1(V.inputGross)} kW gross at full output, ${f1(V.output)} kW reaches the water, ${f2(M.FULL.latent)} kW leaves as steam that never gives up its heat, and ${f2(M.FULL.sensible)} kW leaves as warm gas; together ${f1(V.output + M.FULL.latent + M.FULL.sensible)} kW against the ${f1(V.inputGross)} kW going in`]: 'Of the sheet’s 29.0 kW gross at full output, 26.0 kW reaches the water, 2.88 kW leaves as steam that never gives up its heat, and 0.59 kW leaves as warm gas; together 29.5 kW against the 29.0 kW going in',
  }, 'Heat hint');
  covered(find('Waiting').hint, {
    [`purges for ${f0(P.DECLARED.purge)} s and the spark runs for ${f0(P.DECLARED.spark)} s, so the flame lights ${f0(def.litAt)} s in. The boiler’s ${f1(V.content)} L then warms with ${f1(def.tau)} s to spare each time, and the ${f2(def.pipeVolume)} L in the pipe takes another ${f1(def.delay)} s`]: 'purges for 3 s and the spark runs for 2 s, so the flame lights 5 s in. The boiler’s 0.5 L then warms with 2.8 s to spare each time, and the 0.73 L in the pipe takes another 4.1 s',
  }, 'Waiting hint');
  covered(find('Pipe').hint, {
    [`A ${f0(V.connection)} mm copper pipe with a bore of ${f1(P.DECLARED.bore)} mm holds ${f2(def.pipeVolume / def.values.pipe)} L for each meter`]: 'A 15 mm copper pipe with a bore of 13.6 mm holds 0.15 L for each meter',
    [`At ${f1(def.values.flow)} L/min the water in it takes ${f1(def.delay)} s to reach the tap`]: 'At 10.6 L/min the water in it takes 4.1 s to reach the tap',
  }, 'Pipe hint');
  covered(find('Sped up').hint, {
    [`plays ${P.DECLARED.faster} times faster than the real thing: this one takes ${f0(def.duration)} s and plays in ${f0(def.duration / P.DECLARED.faster)} s`]: 'plays 5 times faster than the real thing: this one takes 30 s and plays in 6 s',
    [`the pipe to the tap ${f0(M.timesSmaller())} times smaller`]: 'the pipe to the tap 20 times smaller',
  }, 'Sped up hint');
  model.update({flow: 0});
  const shut = model.getState().readings, shutFind = label => shut.find(item => item.label === label);
  t.ok(shutFind('Tap').value === 'closed' && shutFind('Burner').value === 'off' && shutFind('Gas').value === 'none' && shutFind('Flue gas').value === 'none' && shutFind('Waiting').value === 'the tap stays cold', 'with the tap closed the readings say so, and none of them says nothing at all');
  model.update({flow: 14});
  t.ok(model.getState().readings.find(item => item.label === 'Burner').hint.includes('more than the'), 'wide open, the hint says the boiler is short of what the tap asks');
  model.reset();
}

{
  const lesson = L.gasBoilerLesson;
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, 'a quiz with its answer first');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe])];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  // A source's title is the page's own name, so a dash inside one is part of a proper name; nothing else may carry one.
  for (const source of lesson.sources) t.ok(!/ [—–] | - |--/.test(source.title), `no dash as punctuation in the source title: ${source.title}`);
  all.push(...lesson.sources.map(source => source.title));
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium|vapour|sulphur)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part named is a part the model has');
  t.ok(lesson.steps.length === 5 && lesson.deeper.length === 6 && lesson.tryIt.length === 7 && lesson.parts.length === 10, 'five steps, six deeper sections, seven trials and ten parts');
  t.ok(heatingLessons['Gas boiler'] === lesson, 'the heating lessons carry this lesson');
  const routed = createHeatingModel('Gas boiler');
  t.ok(routed.parts.some(part => part.id === 'flue-gas') && routed.controls.map(control => control.key).join() === 'flow,set,inlet,pipe', 'the heating models route the gas boiler here');
  routed.dispose();
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) {
  const [lo, hi, step] = P.BOILER_DOMAINS[control.key];
  t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.BOILER_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`);
  t.ok(control.help && !/[—–]| - |--/.test(control.help), `${control.key}: helped, without dashes`);
}
t.ok(model.controls.map(control => control.key).join() === 'flow,set,inlet,pipe', 'four controls');
const drawing = () => [
  T.flames.geometry.attributes.position.array.slice(0, 27), T.gate.position.y, T.turbine.rotation.z,
  T.passes.map(pass => pass.material.color.getHex()), T.coldPipe.material.color.getHex(),
  pointsOf(T.pointer), T.bars.map(bar => bar.scale.x), pointsOf(T.dewMark),
  T.pieces.map(piece => [piece.position.x, piece.material.color.getHex()]), T.stream.material.color.getHex(),
  pointsOf(T.setLine), pointsOf(T.inletLine), pointsOf(T.guideTap).slice(0, 40), pointsOf(T.curveTank).slice(-3),
];
checkControlsMove(model, drawing, m => m.advance(P.DECLARED.longest), t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the run');
t.ok(!model.playback.blocked(), 'and the run is ready to press');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, P.DECLARED.faster, 1e-12, 'a step is five seconds of the run');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through');
  model.animate(0);
  model.animate(1);
  t.near(model.getState().clock, P.DECLARED.faster * 2, 1e-12, 'animation runs on by the time that passed, five times faster');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'chart', 'the run done, with the chart to inspect');
  const held = JSON.stringify([pointsOf(T.curveTank).length, T.turbine.rotation.z, T.pieces.map(piece => piece.material.color.getHex())]);
  model.advance(50);
  t.ok(JSON.stringify([pointsOf(T.curveTank).length, T.turbine.rotation.z, T.pieces.map(piece => piece.material.color.getHex())]) === held, 'once done, the run stays where it ended');
  model.update({flow: 0});
  t.ok(model.playback.blocked(), 'with the tap closed there is nothing to run');
  model.reset();
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part), `${action.label} returns readings`);
    checkFinite(model.root, t);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  for (const values of settings) {
    for (const time of [0, 2, 40, 600]) {
      model.reset();
      model.update(values);
      model.advance(time);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')) && !/\b(centre|colour|grey|metre|vapour)\b/i.test(item.hint || ''), `reading text without dashes: ${item.label}`);
    }
  }
}
const released = checkDisposal((() => { const fresh = M.createGasBoilerModel(); fresh.advance(4); return fresh; })(), t);
model.dispose();

console.log(`PASS gas boiler: ${t.count} checks, ${counts.steps} steps integrated, ${counts.cells} cells advected, ${counts.plans} settings planned, ${counts.poses} poses, ${counts.points} drawn points traced, ${counts.numbers} quoted numbers traced, 1 lesson, ${released} resources released exactly once.`);

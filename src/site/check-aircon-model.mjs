// Checks manufacturer phase properties, independent energy balances, finer
// time integration, hydraulic geometry and every learner experiment.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPartExplosion} from './part-explosion.js';
import {fixed} from './format.js';
import {tally, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './aircon-physics.js';
import * as M from './aircon-model.js';
import * as L from './aircon-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {publishedEntryIds} from './published-catalog.js';

const t = tally();
const counts = {solves: 0, steps: 0, poses: 0, points: 0, plans: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const K = 273.15;

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
  r410a: {molar: 0.07258, boiling: -51.58, criticalTemperature: 72.13, criticalPressure: 4926100, gasHeat: 840},
  // Wikipedia: Density of air, Table of specific heat capacities.
  air: {density: 1.2041, densityAt: 20, standardDensity: 1.2250, standardDensityAt: 15, molar: 0.0289652, heat: 1012, heatAt: 'typical room conditions'},
  // Wikipedia: Properties of water, Latent heat.
  water: {molar: 0.018015, heat: 4184, heatAt: 20, vaporization: 2257, vaporizationAt: 100, latent: [2500.8, -2.36, 0.0016, -0.00006], latentFrom: -25, latentTo: 40},
  // Wikipedia: Arden Buck equation, and the Magnus fit for company.
  buck: {a: 6.1121, b: 18.678, c: 257.14, d: 234.5, from: -80, to: 50},
  magnus: {a: 6.1121, b: 17.625, c: 243.04, from: -40, to: 50},
  // Wikipedia: Air conditioning, Ton of refrigeration, Coefficient of performance.
  rated: {ton: 3516.853, btu: 12000, smallest: 3.5e3, largest: 18e3, tons: [1, 5], cop: [3.5, 5], comfort: [30, 60]},
  // Wikipedia: Density of air, and the standard atmosphere.
  gas: 8.31446261815324, atmosphere: 101325,
};

for (const [key, value] of Object.entries(SRC.r410a)) assert.equal(P.R410A[key], value);
assert.deepEqual(JSON.parse(JSON.stringify(P.AIR)), SRC.air);
assert.deepEqual(JSON.parse(JSON.stringify(P.WATER)), SRC.water);
assert.deepEqual(JSON.parse(JSON.stringify(P.BUCK)), SRC.buck);
assert.deepEqual(JSON.parse(JSON.stringify(P.RATED)), SRC.rated);
assert.equal(P.GAS, SRC.gas);
assert.equal(P.ATMOSPHERE, SRC.atmosphere);
assert.deepEqual(JSON.parse(JSON.stringify(P.DECLARED)), {
  displacement: 11e-6, rpm: 2900, clearance: 0.04, efficiency: 0.55, superheat: 5,
  contact: 0.85, condenser: 450, roomLoss: 60, furnishings: 6,
  longest: 1800, step: 15, samples: 181, slower: 60, lap: 120, iceAt: 0,
});
assert.deepEqual({...P.AIRCON_DEFAULTS}, {room: 28, humidity: 60, flow: 0.15, outdoor: 35, volume: 40, set: 24});
assert.deepEqual(JSON.parse(JSON.stringify(P.AIRCON_DOMAINS)), {room: [20, 35, 1], humidity: [20, 90, 5], flow: [0.05, 0.3, 0.025], outdoor: [25, 45, 1], volume: [20, 80, 5], set: [18, 28, 1]});
t.ok(P.AIRCON_DOMAINS.set[0] >= 18 && P.AIRCON_DOMAINS.set[1] <= P.AIRCON_DOMAINS.room[1] && P.AIRCON_DOMAINS.outdoor[0] >= P.AIRCON_DOMAINS.room[0], 'the settings, the room and the weather span sensible ranges against each other');

// The humidity ratio's 0.622 is the two molar masses, not a typed number.
t.near(P.MOLAR_RATIO, SRC.water.molar / SRC.air.molar, 1e-15, 'the humidity ratio constant is water over dry air');
t.ok(f3(P.MOLAR_RATIO) === '0.622', `and comes to ${f3(P.MOLAR_RATIO)}, the 0.622 of the textbooks`);
// The humidity ratio rebuilt from the ideal gas law: two gases sharing one volume at one temperature.
for (const pascals of [500, 1200, 2269, 4000]) {
  const vapor = pascals * SRC.water.molar, dry = (SRC.atmosphere - pascals) * SRC.air.molar;
  t.near(P.humidityRatio(pascals), vapor / dry, 1e-15, `the humidity ratio at ${pascals} Pa is the two partial pressures weighed by their molar masses`);
  t.near(P.vaporPressureOf(P.humidityRatio(pascals)), pascals, 1e-9, 'and turns back into its partial pressure');
}

// Independent manufacturer table rows, including temperatures between vapor
// enthalpy interpolation nodes. Units: °C, kPa absolute, kJ/kg.
const phaseAnchors = [
  [-20,400.7,399.5,169.8,415.7],[-18,431.6,430.3,172.8,416.5],
  [-13,516.9,515.3,180.2,418.3],[-7,635.5,633.6,189.3,420.4],
  [0,799,796.5,200,422.5],[3,878,875.3,204.7,423.4],
  [10,1085.5,1082,215.7,425.1],[13,1184.9,1181.1,220.6,425.7],
  [20,1443.6,1438.8,232,426.8],[23,1566.6,1561.4,237.1,427.2],
  [25,1652.9,1647.4,240.4,427.3],[28,1788.9,1783,245.6,427.5],
  [33,2034.3,2027.4,254.3,427.5],[35,2139.2,2132,257.9,427.5],
];
for (const [celsius,bubble,dew,liquid,vapor] of phaseAnchors) {
  t.near(P.boilingPressure(celsius,'bubble') / 1000,bubble,0.11,'manufacturer bubble pressure');
  t.near(P.boilingPressure(celsius,'dew') / 1000,dew,0.11,'manufacturer dew pressure');
  t.near(P.liquidEnthalpy(celsius) / 1000,liquid,0.11,'manufacturer saturated liquid enthalpy');
  t.near(P.vaporEnthalpy(celsius) / 1000,vapor,0.15,'vapor interpolation checked between nodes');
  for (const phase of ['bubble','dew']) t.near(P.boilingPoint(P.boilingPressure(celsius,phase),phase),celsius,1e-9,'pressure inversion retains phase');
}
for (const [celsius,pressure,enthalpy] of [[45,2726.1,276.7],[55,3426.5,297.9],[65,4253.2,325.3]]) {
  t.near(P.boilingPressure(celsius)/1000,pressure,pressure*0.0002,'manufacturer correlation agrees with table within 0.02 percent');
  t.near(P.liquidEnthalpy(celsius)/1000,enthalpy,0.11,'condenser liquid enthalpy anchor');
}
t.near(P.boilingPoint(101325),-51.58,0.02,'normal boiling point at one atmosphere');
t.near(P.refrigeratingEffect(10,45)/1000,425.1-276.7+0.84*5,0.12,'evaporator enthalpy rise through an isenthalpic valve');
t.ok(P.vaporEnthalpy(30)-P.liquidEnthalpy(30)<P.vaporEnthalpy(0)-P.liquidEnthalpy(0),'latent heat falls with temperature');
for (const bad of [NaN,Infinity,-101,73]) assert.throws(()=>P.boilingPressure(bad),RangeError);
for (const bad of [NaN,Infinity,-21,36]) assert.throws(()=>P.vaporEnthalpy(bad),RangeError);
assert.throws(()=>P.boilingPressure(25,'gauge'),RangeError);
t.near(P.GAMMA,SRC.r410a.gasHeat/(SRC.r410a.gasHeat-SRC.gas/SRC.r410a.molar),1e-15,'declared ideal-gas compressor heat ratio');

// Water: the Buck equation bisected, a second fit for company, and the latent heat fit against its own source.
{
  for (const celsius of [0, 10, 20, 28, 40]) {
    const pressure = P.buckPressure(celsius);
    t.near(P.dewPointOf(pressure), celsius, 1e-9, `the Buck equation turned around returns ${celsius} °C`);
    const bisected = bisect(guess => P.buckPressure(guess) - pressure, -20, 60);
    t.near(bisected, celsius, 1e-6, 'and bisection finds the same dew point');
    const other = bisect(guess => 100 * SRC.magnus.a * Math.exp(SRC.magnus.b * guess / (SRC.magnus.c + guess)) - pressure, -20, 60);
    t.ok(Math.abs(other - celsius) < 0.3, `another fit puts the dew point of ${f0(pressure)} Pa within a third of a degree of ${celsius} °C`);
  }
  t.near(P.waterLatent(0), 1000 * SRC.water.latent[0], 1e-9, 'the latent heat fit at 0 °C is its leading term');
  for (let celsius = SRC.water.latentFrom; celsius <= SRC.water.latentTo; celsius += 5) {
    t.ok(P.waterLatent(celsius) > P.waterLatent(celsius + 1), 'and falls as the water gets warmer, all the way up its range');
  }
  const extended = P.waterLatent(100);
  t.ok(Math.abs(extended / 1000 - SRC.water.vaporization) / SRC.water.vaporization < 0.05, `stretched past its range to 100 °C the fit still lands within 5% of the sourced ${SRC.water.vaporization} kJ/kg`);
}

// The compressor: its work integrated as the integral of v dP, and its filling argued again.
{
  for (const [evaporating, condensing] of [[2, 40], [7, 45], [14, 46], [18, 55]]) {
    const c = P.compressorAt(evaporating, condensing);
    const suction = evaporating + P.DECLARED.superheat + K;
    t.near(c.density, c.low * SRC.r410a.molar / (SRC.gas * suction), 1e-15, 'the suction vapor is an ideal gas');
    // Ideal compression work as the area behind the isentrope: m integral of v dP with p v^gamma constant.
    const v1 = 1 / c.density, steps = 20000;
    let integral = 0;
    for (let i = 0; i < steps; i++) {
      const p0 = c.low + (c.high - c.low) * i / steps, p1 = c.low + (c.high - c.low) * (i + 1) / steps, mid = (p0 + p1) / 2;
      integral += v1 * (c.low / mid) ** (1 / P.GAMMA) * (p1 - p0);
      counts.steps++;
    }
    const byArea = c.mass * integral;
    t.ok(Math.abs(byArea - c.ideal) / c.ideal < 1e-6, `at ${evaporating} to ${condensing} °C the area behind the isentrope is ${f0(byArea)} W against the formula's ${f0(c.ideal)} W`);
    t.near(c.work, c.ideal / P.DECLARED.efficiency, 1e-12, 'and the real work is that over the efficiency');
    // Filling: the clearance gas has to expand back to the suction pressure before any new vapor comes in.
    const clearanceBack = P.DECLARED.clearance * (c.ratio ** (1 / P.GAMMA) - 1);
    t.near(c.volumetric, 1 - clearanceBack, 1e-12, 'the share of the stroke that fills is one less what the clearance takes back');
    t.ok(c.volumetric > 0.8 && c.volumetric < 1, `${f1(100 * c.volumetric)}% of the stroke fills at a ratio of ${f2(c.ratio)}`);
    t.near(c.mass, c.volumetric * P.DECLARED.displacement * P.DECLARED.rpm / 60 * c.density, 1e-15, 'and the refrigerant moved is that share of the swept volume');
    t.ok(c.ratio > 1 && c.high > c.low, 'the compressor always lifts the pressure');
    t.ok(c.discharge>condensing,'discharge vapor must cool before condensation');
    t.near(c.mass*SRC.r410a.gasHeat*(c.discharge-c.suction),c.work,1e-8,'discharge temperature accounts for compressor work');
  }
  // A larger lift is always harder work for less refrigerant moved.
  let lastWork = 0, lastMass = Infinity;
  for (const condensing of [35, 40, 45, 50, 55, 60]) {
    const c = P.compressorAt(10, condensing);
    t.ok(c.work > lastWork && c.mass < lastMass, 'squeezing further takes more work and moves less');
    lastWork = c.work; lastMass = c.mass;
  }
}

// The coil's air, worked out from the leaving state rather than the entering one.
{
  for (const room of [20, 24, 28, 32, 35]) {
    for (const humidity of [20, 40, 60, 90]) {
      for (const flow of [0.05, 0.15, 0.3]) {
        for (const coil of [2, 8, 13, 18]) {
          const enteringRatio = P.humidityRatio(P.buckPressure(room) * humidity / 100);
          const a = P.coilAir(room, enteringRatio, flow, coil);
          counts.solves++;
          t.near(a.dryFlow, SRC.air.density * flow, 1e-15, 'the dry air crossing the coil each second');
          t.near(a.sensible, a.dryFlow * SRC.air.heat * (room - a.leavingC), 1e-9, 'the sensible load from the drop in temperature');
          t.near(a.condensate, a.dryFlow * (enteringRatio - a.leavingRatio), 1e-15, 'the water taken out is the fall in the humidity ratio');
          t.near(a.latent, a.condensate * P.waterLatent(coil), 1e-12, 'and the latent load is that water times what it gives up');
          t.near(a.total, a.sensible + a.latent, 1e-12, 'the two together are the whole load');
          t.ok(a.condensate >= -1e-18 && a.leavingC <= room + 1e-12 && a.leavingC >= coil - 1e-12, 'nothing is added to the air and it never leaves colder than the coil');
          // The leaving state lies on the straight line from the entering state to the coil's state.
          const share = (room - a.leavingC) / (room - coil);
          if (!a.mist) t.near(share, P.DECLARED.contact, 1e-12, 'without fog, air leaves the contact share of the way toward the coil');
          if (a.saturated < enteringRatio) {
            if (!a.mist) t.near(a.leavingRatio, enteringRatio + share * (a.saturated - enteringRatio), 1e-15, 'and the same share of the way toward saturation at it');
            else {
              const mixedC=P.DECLARED.contact*coil+(1-P.DECLARED.contact)*room;
              const mixedRatio=P.DECLARED.contact*a.saturated+(1-P.DECLARED.contact)*enteringRatio;
              t.near(P.AIR.heat*a.leavingC+P.waterLatent(coil)*a.leavingRatio,P.AIR.heat*mixedC+P.waterLatent(coil)*mixedRatio,1e-5,'condensing supersaturated mist conserves mixed-air enthalpy');
              t.near(P.relativeHumidity(a.leavingC,a.leavingRatio),100,1e-10,'mixed outlet is physically saturated, not only its displayed percentage');
              t.ok(a.leavingC>mixedC && a.leavingRatio<mixedRatio,'mist condensation warms air and removes vapor');
            }
            t.ok(a.condensate > 0, 'a coil below the dew point always takes water out');
          } else {
            t.ok(a.condensate === 0 && a.leavingRatio === enteringRatio && a.latent === 0, 'a coil above the dew point takes none');
          }
          t.ok(a.leavingHumidity <= 100 + 1e-12, 'the air never leaves reading more than saturated');
        }
      }
    }
  }
  // A dew point is the temperature at which the entering air is exactly saturated.
  for (const [room, humidity] of [[28, 60], [24, 40], [32, 90], [20, 20]]) {
    const pressure = P.buckPressure(room) * humidity / 100, dew = P.dewPointOf(pressure);
    t.near(P.saturatedRatio(dew), P.humidityRatio(pressure), 1e-12, `air at ${room} °C and ${humidity}% is exactly full at ${f1(dew)} °C`);
    t.ok(dew <= room + 1e-9, 'and a dew point never stands above the air it belongs to');
    t.near(P.relativeHumidity(room, P.humidityRatio(pressure)), humidity, 1e-9, 'the relative humidity read back');
  }
}

// Where the loop settles: both coil balances, the first law, and what the sources say about a unit this size.
{
  for (const room of [20, 24, 28, 32, 35]) {
    for (const humidity of [20, 60, 90]) {
      for (const flow of [0.05, 0.15, 0.3]) {
        for (const outdoor of [25, 35, 45]) {
          const enteringRatio = P.humidityRatio(P.buckPressure(room) * humidity / 100);
          const c = P.solveCycle(room, enteringRatio, flow, outdoor);
          counts.solves++;
          const carried = c.compressor.mass * c.effect;
          t.ok(Math.abs(carried - c.air.total) / Math.max(1, c.air.total) < 1e-6, 'the refrigerant carries away exactly what the air gives up');
          t.ok(Math.abs(P.DECLARED.condenser * (c.condensing - outdoor) - (carried + c.compressor.work)) / Math.max(1, carried) < 1e-6, 'and the outdoor coil sheds exactly what comes to it');
          t.near(c.outdoorHeat, c.cooling + c.compressor.work, 1e-9, 'the first law: what leaves outdoors is the room plus the work');
          t.near(c.cop, c.cooling / c.compressor.work, 1e-12, 'the coefficient of performance is cooling over work');
          t.near(c.carnot, (c.evaporating + K) / (c.condensing - c.evaporating), 1e-12, 'and the Carnot limit is the cold side over the lift');
          t.ok(c.cop < c.carnot, 'no cycle beats Carnot');
          t.near(c.effect, P.vaporEnthalpy(c.evaporating) - P.liquidEnthalpy(c.condensing) + SRC.r410a.gasHeat * P.DECLARED.superheat, 1e-9, 'each kilogram carries its latent heat less the flash and plus the superheat');
          t.ok(c.condensing > outdoor && c.evaporating < room, 'the hot coil always stands above the outdoor air and the cold coil below the room');
          t.near(c.lift, c.condensing - c.evaporating, 1e-12, 'the lift is the gap between them');
          t.near(c.tons, c.cooling / SRC.rated.ton, 1e-12, 'the capacity in tons');
          t.ok(c.icing === (c.evaporating < 0), 'icing is flagged exactly when the coil falls below freezing');
          t.ok(Number.isFinite(c.share) && c.share > 0 && c.share <= 1 + 1e-12, 'the sensible share is a share');
        }
      }
    }
  }
  const standard = P.solveCycle(28, P.humidityRatio(P.buckPressure(28) * 0.6), 0.15, 35);
  t.ok(standard.cooling > 0 && standard.cop > 1 && standard.cop < standard.carnot, 'illustrative unit transports heat below its Carnot bound');
  t.near(SRC.rated.ton, SRC.rated.btu * 1055.05585262 / 3600, 0.01, 'a ton of refrigeration is twelve thousand BTU an hour');

  // What each control does to the loop, in the direction it has to.
  const at = (room, humidity, flow, outdoor) => P.solveCycle(room, P.humidityRatio(P.buckPressure(room) * humidity / 100), flow, outdoor);
  let previous = null;
  for (const flow of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
    const c = at(28, 60, flow, 35);
    counts.solves++;
    if (previous) t.ok(c.evaporating > previous.evaporating && c.share > previous.share && c.cooling > previous.cooling, 'more air over the coil lifts it, moves more heat, and spends more of it cooling rather than drying');
    previous = c;
  }
  previous = null;
  for (const humidity of [20, 40, 60, 80, 90]) {
    const c = at(28, humidity, 0.15, 35);
    counts.solves++;
    if (previous) t.ok(c.air.condensate >= previous.air.condensate && c.share < previous.share + 1e-12, 'damper air gives up more water and less of the work is cooling');
    previous = c;
  }
  previous = null;
  for (const outdoor of [25, 30, 35, 40, 45]) {
    const c = at(28, 60, 0.15, outdoor);
    counts.solves++;
    if (previous) t.ok(c.condensing > previous.condensing && c.compressor.work > previous.compressor.work && c.cop < previous.cop && c.cooling < previous.cooling, 'a hotter day means a hotter coil, more work, less cooling and a worse coefficient of performance');
    previous = c;
  }
  t.ok(at(28, 20, 0.15, 35).air.condensate === 0, 'dry enough air gives up no water at all');
  t.ok(at(28, 90, 0.15, 35).air.condensate > 0, 'damp air always does');
}

// The room, integrated again at a fifth of the step, and closed with its own energy balance.
{
  for (const values of [{}, {volume: 80}, {flow: 0.05}, {outdoor: 45}, {humidity: 90}, {set: 18}]) {
    const plan = P.airconPlan(values);
    counts.plans++;
    const v = plan.values, fine = P.DECLARED.step / 5;
    let celsius = v.room, ratio = plan.startRatio, removed = 0, leaked = 0;
    for (let t0 = 0; t0 < plan.duration - 1e-9; t0 += fine) {
      const cycle = P.solveCycle(celsius, ratio, v.flow, v.outdoor);
      const leak = P.DECLARED.roomLoss * (v.outdoor - celsius);
      removed += cycle.air.sensible * fine;
      leaked += leak * fine;
      celsius += (leak - cycle.air.sensible) * fine / plan.heatCapacity;
      ratio = Math.max(0, ratio - cycle.air.condensate * fine / plan.waterCapacity);
      counts.steps++;
    }
    const mine = P.roomAt(plan, plan.duration);
    t.ok(Math.abs(celsius - mine.celsius) < 0.2, `${JSON.stringify(values)}: a fifth of the step lands within ${f2(Math.abs(celsius - mine.celsius))} °C of the model after ${f0(plan.duration / 60)} minutes`);
    t.ok(Math.abs(ratio - mine.ratio) < 5e-4, 'and within half a gram a kilogram of its water');
    // The energy that left the room is the heat it lost plus the heat that leaked back in.
    t.ok(Math.abs(plan.heatCapacity * (v.room - celsius) - (removed - leaked)) / Math.max(1, removed) < 0.02, "the room’s energy balance closes over the run");
    t.near(plan.heatCapacity, SRC.air.density * v.volume * SRC.air.heat * P.DECLARED.furnishings, 1e-9, 'the room holds its air times its furnishing factor');
    t.near(plan.dryMass, SRC.air.density * v.volume, 1e-12, 'and its air weighs its volume times the density of air');
    t.ok(plan.track.every(point => Number.isFinite(point.celsius) && Number.isFinite(point.ratio) && point.ratio >= 0), 'every step of the track is a real state');
    for (let i = 1; i < plan.track.length; i++) {
      t.ok(plan.track[i].celsius < plan.track[i - 1].celsius && plan.track[i].ratio <= plan.track[i - 1].ratio + 1e-18, 'the room only ever gets cooler and drier while the unit runs');
      if (i < plan.track.length - 1 || !plan.reaches) t.near(plan.track[i].t, i * P.DECLARED.step, 1e-12, 'full integration steps before the final thermostat crossing');
    }
    t.ok(plan.chart.length === P.DECLARED.samples && plan.chart[0].t === 0 && Math.abs(plan.chart.at(-1).t - plan.duration) < 1e-9, 'the chart spans the whole run');
    t.ok(plan.reaches === (plan.reached !== null && plan.reached > 0), 'the run reaches the setting exactly when the track got there');
    if (plan.reaches) {
      t.ok(plan.settled.celsius <= v.set + 1e-9 && plan.track.at(-2).celsius > v.set, 'and stops at the first thermostat crossing');
      t.near(plan.settled.celsius, v.set, 1e-12, 'no final-step thermostat overshoot');
      t.ok(plan.duration === plan.reached, 'the run is exactly as long as it took');
    } else {
      t.ok(plan.duration === P.DECLARED.longest, 'a run that never arrives lasts the full half hour');
    }
    const numbers = JSON.stringify(plan, (key, value) => (typeof value === 'number' && !Number.isFinite(value) ? 'BAD' : value));
    t.ok(!numbers.includes('BAD'), 'nothing infinite anywhere in the plan');
  }
  const already = P.airconPlan({room: 20, set: 24});
  counts.plans++;
  t.ok(already.already && already.reached === 0 && !already.reaches && already.track.length === 1, 'a room already at the setting has nothing to run');
  const never = P.airconPlan({flow: 0.05, volume: 80, outdoor: 45});
  counts.plans++;
  t.ok(!never.reaches && never.duration === P.DECLARED.longest && never.settled.celsius > never.values.set, 'too little air in too big a room on too hot a day never arrives');
  {
    const first = P.airconPlan({room: 21});
    t.ok(P.airconPlan({room: 21}) === first, 'a run already worked out is handed back rather than worked out again');
    for (let room = 20; room <= 35; room++) for (const humidity of [20, 40, 60, 90]) { P.airconPlan({room, humidity}); counts.plans++; }
    t.ok(P.airconPlan({room: 21}) !== first, 'and past sixty four settings the cache is dropped rather than kept for ever');
  }
  checkRefusals(P.sampleAircon, P.AIRCON_DOMAINS, t);
  t.ok(P.airconAt(P.airconPlan({}), 1e6).t === P.airconPlan({}).duration, 'the run stops at its end');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back from its geometry.
// ---------------------------------------------------------------------------

const model = M.createAirConditionerModel(), T = model.topology;
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
const worldRectOf = mesh => { const box = new THREE.Box3().setFromObject(mesh); return {x: [box.min.x, box.max.x], y: [box.min.y, box.max.y]}; };
const sameColor = (color, other) => Math.abs(color.r - other.r) < 1e-6 && Math.abs(color.g - other.g) < 1e-6 && Math.abs(color.b - other.b) < 1e-6;
const settle = (values, time) => { model.reset(); if (values) model.update(values); if (time) model.advance(time / P.DECLARED.slower); model.root.updateMatrixWorld(true); counts.poses++; return model.getState(); };

// Solid cutaway equipment and hydraulic continuity, read from actual meshes.
{
  settle(null,0);
  for(const [shell,dimensions] of [[T.indoorShell,M.INDOOR.casing],[T.outdoorShell,M.OUTDOOR.casing]]){
    t.ok(shell.walls.length===3,'cutaway shell has side walls and base');
    t.near(shell.back.scale.x,dimensions[0]*M.MM,drawn,'representative casing width');
    t.near(shell.back.scale.y,dimensions[1]*M.MM,drawn,'representative casing height');
    t.ok(shell.back.scale.z>0 && shell.walls.every(wall=>wall.scale.z>0.3),'shell has physical depth');
  }
  for(const mesh of [...T.coilTubes,...T.condTubes,T.drainPipe,T.compressorBody]){
    const size=new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    t.ok(Math.min(size.x,size.y,size.z)>0.001,'equipment is solid geometry from every view');
    t.ok(mesh.geometry.type!=='PlaneGeometry','equipment is not a flat board');
  }
  t.ok(T.coilFins.length>20 && T.condenserFins.length>5,'both coils have heat-transfer fins');
  t.ok(T.blades.children.length===M.INDOOR.blades && T.outBlades.children.length===M.OUTDOOR.blades,'both blowers have physical blades');
  for(let i=0;i<T.circuits.length;i++){
    const section=T.circuits[i],next=T.circuits[(i+1)%T.circuits.length];
    t.near(new THREE.Vector3(...section.points.at(-1)).distanceTo(new THREE.Vector3(...next.points[0])),0,1e-12,'each flow section connects to the next');
    if(section.mesh)t.ok(section.mesh.geometry.type==='TubeGeometry','refrigerant traverses drawn tubing');
  }
  t.ok(T.circuits[0].mesh===T.coilTubes[0] && T.circuits[4].mesh===T.condTubes[0],'actual coils belong to the same closed hydraulic route');
  const before=T.rotor.rotation.x;settle(null,2);t.ok(T.rotor.rotation.x!==before,'crossflow blower spins about its long axis');
}

// The four regions are kept out of each other's way.
{
  settle({volume: 80}, 400);
  const regions = [
    ['indoor unit', extent([...pointsOf(T.indoorLine)].map(p => [p[0] + M.INDOOR.origin[0], p[1] + M.INDOOR.origin[1]]))],
    ['outdoor unit', extent([...pointsOf(T.outdoorLine)].map(p => [p[0] + M.OUTDOOR.origin[0], p[1] + M.OUTDOOR.origin[1]]))],
    ['the air chart', extent(pointsOf(T.psychroFrame))],
    ['the room chart', extent(pointsOf(T.chartFrame))],
  ];
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i][1], b = regions[j][1];
      t.ok(a.x[1] < b.x[0] - 0.02 || b.x[1] < a.x[0] - 0.02 || a.y[1] < b.y[0] - 0.02 || b.y[1] < a.y[0] - 0.02, `${regions[i][0]} and ${regions[j][0]} are kept apart`);
    }
  }
  const leaders = pointsOf(T.leaders);
  t.ok(leaders.length === 4 && leaders[1][1] > regions[2][1].y[1] - 1e-9 && leaders[3][1] > regions[3][1].y[1] - 1e-9, 'both leaders run from a unit down to the top of a chart');
}

// The coils carry the colors of the refrigerant in them, and the frost only shows when the coil freezes.
{
  for (const values of [{}, {outdoor: 45}, {flow: 0.3}, {humidity: 90}, {humidity: 20}]) {
    const state = settle(values, 0), cycle = state.now.cycle;
    t.ok(T.coilTubes.every(tube => sameColor(tube.material.color, M.heatColor(cycle.evaporating))), `the cold coil is drawn at the ${f1(cycle.evaporating)} °C it boils at`);
    t.ok(T.condTubes.every(tube => sameColor(tube.material.color, M.heatColor(cycle.condensing))), `and the hot coil at the ${f1(cycle.condensing)} °C it condenses at`);
    t.ok(T.frost.visible === cycle.icing, 'frost is drawn exactly when the coil is below freezing');
    t.ok(T.drops[0].visible === (cycle.air.condensate > 0), 'and drops exactly when water is coming off it');
  }
  const cool = settle(null, 0).now.cycle, hot = settle({outdoor: 45}, 0).now.cycle;
  t.ok(!sameColor(M.heatColor(cool.condensing), M.heatColor(hot.condensing)), 'a hotter day is drawn a different color');
  t.ok(M.heatColor(5).b > M.heatColor(50).b && M.heatColor(50).r > M.heatColor(5).r, 'cold is drawn blue and hot is drawn red');
}

// Flow markers follow every actual circuit segment in three dimensions.
{
  for(const time of [0,1,17,83,200]){
    const state=settle(null,time),cycle=state.now.cycle;
    for(let i=0;i<T.markers.length;i++){
      const marker=T.markers[i],fraction=(i/M.LOOP.markers+state.now.turn)%1;
      t.near(marker.position.distanceTo(T.route.getPoint(fraction)),0,1e-12,'marker on connected route');
      const section=T.circuits.find(section=>fraction*T.route.getLength()<=section.end)||T.circuits.at(-1);
      const temperature=['evaporator','feed','valve'].includes(section.phase)?cycle.evaporating:section.phase==='suction'?cycle.evaporating+P.DECLARED.superheat:['compressor','discharge'].includes(section.phase)?cycle.compressor.discharge:cycle.condensing;
      t.ok(sameColor(marker.material.color,M.heatColor(temperature)),'marker has the temperature of its own circuit section');counts.points++;
    }
  }
  settle({room:20,set:24},0);
  t.ok(T.airIn.userData.length===0 && T.outdoorArrow.userData.length===0 && T.markers.every(marker=>!marker.visible),'no flow when thermostat is already satisfied');
}

// What the air does crossing the coil, drawn as a psychrometric chart.
{
  for (const values of [{}, {humidity: 20}, {humidity: 90}, {flow: 0.05}]) {
    const state = settle(values, 0), cycle = state.now.cycle, air = cycle.air, room = state.now.room;
    const curve = pointsOf(T.saturation);
    t.ok(curve.length === M.PSYCHRO.curve, 'the saturation curve is drawn at its full resolution');
    curve.forEach((point, i) => {
      const end=Math.min(M.PSYCHRO.temperature[1],P.dewPointOf(P.vaporPressureOf(M.PSYCHRO.ratio[1])));
      const celsius = M.PSYCHRO.temperature[0] + (end - M.PSYCHRO.temperature[0]) * i / (M.PSYCHRO.curve - 1);
      t.near(point[0], M.psychroX(celsius), drawn, 'each sample of the curve at its temperature');
      t.near(point[1], M.psychroY(P.saturatedRatio(celsius)), drawn, 'and at the water that temperature can hold');
    });
    counts.points += curve.length;
    for (let i = 1; i < curve.length; i++) t.ok(curve[i][1] >= curve[i - 1][1] - 1e-9, 'warmer air can always hold at least as much');
    t.ok(curve.every(point => point[1] <= M.PSYCHRO.y + M.PSYCHRO.h + drawn && point[0] >= M.PSYCHRO.x - drawn), 'and the curve stays inside its frame');
    const dots = [[T.enterDot, room.celsius, room.ratio], [T.coilDot, cycle.evaporating, air.saturated], [T.leaveDot, air.leavingC, air.leavingRatio]];
    for (const [dot, celsius, ratio] of dots) {
      t.near(dot.position.x, M.psychroX(celsius), 1e-9, 'each mark stands at its own temperature');
      t.near(dot.position.y, M.psychroY(ratio), 1e-9, 'and at its own water');
    }
    const process = pointsOf(T.process);
    t.ok(process.length === 3, 'the way the air takes is drawn from where it enters, through where it leaves, to the coil');
    t.near(process[0][0], M.psychroX(room.celsius), drawn, 'starting where the air enters');
    t.near(process[2][0], M.psychroX(cycle.evaporating), drawn, 'and ending on the coil');
    const between = (a, b, c) => Math.min(a, c) - 1e-9 <= b && b <= Math.max(a, c) + 1e-9;
    t.ok(between(process[0][0], process[1][0], process[2][0]) && between(process[0][1], process[1][1], process[2][1]), 'and the air leaves somewhere between the two');
    const dew = pointsOf(T.dewLine);
    t.near(dew[1][0], M.psychroX(room.dew), drawn, 'the dew point is marked where the air meets the curve');
    t.near(dew[0][1], M.psychroY(room.ratio), drawn, 'along the line of the water it carries');
    t.near(dew[1][1], dew[0][1], drawn, 'which is a flat line, since drying is what moves air down it');
    if (air.condensate > 0) t.ok(cycle.evaporating < room.dew + 1e-9 && process[1][1] < process[0][1] - 1e-12 && process[2][1] < process[0][1], 'when water comes off, the coil sits below the dew point and both the air leaving and the coil itself are drawn below the air entering');
    else t.ok(cycle.evaporating > room.dew - 1e-9 && Math.abs(process[1][1] - process[0][1]) < 1e-9 && air.saturated >= room.ratio - 1e-12, 'and when none does, the air moves flat across, the coil still able to hold everything the air carries');
  }
}

// The room through the run.
{
  for (const values of [{}, {volume: 80}, {flow: 0.05, volume: 80, outdoor: 45}]) {
    const state = settle(values, 0);
    const guide = pointsOf(T.guideRoom), guideHumidity = pointsOf(T.guideHumidity);
    t.ok(guide.length === P.DECLARED.samples && guideHumidity.length === P.DECLARED.samples, 'the whole run is drawn faintly, on both scales');
    state.chart.forEach((sample, i) => {
      t.near(guide[i][0], M.chartX(state, sample.t), drawn, 'each sample at its time');
      t.near(guide[i][1], M.chartY(sample.celsius), drawn, 'the temperature where its scale puts it');
      t.near(guideHumidity[i][1], M.humidityY(sample.humidity), drawn, 'and the humidity where its own scale does');
    });
    counts.points += guide.length;
    t.ok(guide.every(point => point[1] >= M.CHART.y - drawn && point[1] <= M.CHART.y + M.CHART.h + drawn), 'the temperature curve stays inside the frame');
    t.ok(guideHumidity.every(point => point[1] >= M.CHART.y - drawn && point[1] <= M.CHART.y + M.CHART.h + drawn), 'and so does the humidity curve');
    t.near(guide[0][0], M.CHART.x, drawn, 'the run starts at the left edge');
    t.near(guide.at(-1)[0], M.CHART.x + M.CHART.w, drawn, 'and reaches the right edge');
    for (let i = 1; i < guide.length; i++) t.ok(guide[i][1] <= guide[i - 1][1] + 1e-6, 'the room only falls');
    t.near(pointsOf(T.setLine)[0][1], M.chartY(state.values.set), drawn, 'the setting is drawn where it falls');
    const band = rectOf(T.comfortBand);
    t.near(band.y[0], M.humidityY(P.RATED.comfort[0]), 1e-9, 'the comfort band starts at the page’s lower figure');
    t.near(band.y[1], M.humidityY(P.RATED.comfort[1]), 1e-9, 'and ends at its upper one');
    t.ok(T.reachedMark.visible === state.reaches, 'the mark is there only when the room arrives');
    if (state.reaches) t.near(pointsOf(T.reachedMark)[0][0], M.chartX(state, state.reached), drawn, 'and stands where it arrived');
  }
  settle(null, 0);
  t.ok(pointsOf(T.curveRoom).length === 0 && pointsOf(T.curveHumidity).length === 0 && pointsOf(T.cursor).length === 0, 'nothing at all is drawn dark before the run starts');
  const half = settle(null, 300), grown = pointsOf(T.curveRoom).length;
  t.ok(grown > 1 && grown < P.DECLARED.samples, 'the dark curve grows with the clock');
  t.near(pointsOf(T.curveRoom).at(-1)[0], M.chartX(half, half.now.t), drawn, 'its last point sits at the clock');
  t.near(pointsOf(T.curveRoom).at(-1)[1], M.chartY(half.now.room.celsius), drawn, 'at what the room reads now');
  const whole = settle(null, 1e5);
  t.ok(pointsOf(T.curveRoom).length === P.DECLARED.samples, 'and reaches the end of the run');
  t.ok(Math.abs(whole.now.room.celsius - whole.values.set) < 0.5, 'which is where the room reaches the setting');
  const ticks = pointsOf(T.chartTicks);
  t.ok(ticks.length === 2 * Math.max(0, Math.ceil(whole.duration / M.CHART.tickEvery) - 1), 'a tick every five minutes, none past the end of the run');
}

// Nothing anywhere is left infinite, at any setting or time.
const settings = [{}, {humidity: 20}, {humidity: 90}, {flow: 0.05}, {flow: 0.3}, {outdoor: 25}, {outdoor: 45}, {room: 20, set: 24}, {room: 35, set: 18}, {volume: 20}, {volume: 80}, {flow: 0.05, volume: 80, outdoor: 45}];
for (const values of settings) {
  for (const time of [0, 60, 400, 1e5]) {
    settle(values, time);
    checkFinite(model.root, t);
  }
}

// ---------------------------------------------------------------------------
// 3. The lesson.
// ---------------------------------------------------------------------------

const lesson = L.airConditionerLesson, def = P.airconPlan({});
const outcomes = new Map(lesson.tryIt.map(trial => [trial.title,P.airconPlan(trial.values)]));
assert.equal(outcomes.size,7);
t.ok(def.reaches && def.steady.air.condensate > 0,'default run cools and drains to the target');
const dry=outcomes.get('Dry air'),damp=outcomes.get('Damp air'),low=outcomes.get('Starve it of air'),high=outcomes.get('Open it up'),hot=outcomes.get('A hot day'),large=outcomes.get('A bigger room');
t.ok(dry.steady.air.condensate===0 && dry.reached<def.reached,'dry preset drains nothing and reaches target sooner');
t.ok(damp.steady.air.latent>damp.steady.air.sensible && !damp.reaches,'damp preset spends more on latent heat and misses target');
t.ok(low.steady.air.leavingC<def.steady.air.leavingC && low.steady.cooling<def.steady.cooling && !low.reaches,'low airflow is colder at outlet but slower at room cooling');
t.ok(high.steady.air.leavingC>def.steady.air.leavingC && high.steady.share>def.steady.share && high.reached<def.reached,'high airflow raises outlet temperature yet cools room sooner');
t.ok(hot.steady.compressor.high>def.steady.compressor.high && hot.steady.compressor.work>def.steady.compressor.work && hot.steady.cop<def.steady.cop && !hot.reaches,'hot day raises head pressure and work, with less cooling');
t.ok(large.steady.cooling===def.steady.cooling && large.heatCapacity===2*def.heatCapacity && !large.reaches,'double room stores twice the heat and misses target');
for(const [title,plan] of outcomes){
  model.reset();model.update(plan.values);model.advance(1e5);
  const state=model.getState();
  t.ok(state.now.done && (state.now.arrived===plan.reaches),`${title}: visible completion matches actual outcome`);
  t.ok(state.readings[0].value.startsWith(plan.reaches?'Done':'Preview ended'),`${title}: named end state`);
}
for(const trial of lesson.tryIt) t.ok(model.parts.some(part=>part.id===trial.part) && trial.reset && !trial.isolate,'preset has an inspectable target');
for(const part of lesson.parts) t.ok(model.parts.some(item=>item.name===part.name),'lesson part exists');
t.ok(lesson.sources.some(source=>source.url.includes('chemours.com')),'manufacturer source linked');
t.ok(lesson.deeper[2].body.includes('−51.58') && lesson.deeper[2].body.includes('1.6529') && lesson.deeper[2].body.includes('1.6474'),'lesson quotes verified source anchors');
t.ok(!JSON.stringify(lesson).includes('48.5') && !JSON.stringify(lesson).includes('4,161'),'obsolete source and output claims removed');
for(const text of [lesson.limits,...lesson.deeper.map(item=>item.body),...lesson.tryIt.flatMap(item=>[item.instruction,item.observe])]) {
  t.ok(!/[—–]| - |--/.test(text),'no dash sentence connectors');
  t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|vapour)\b/i.test(text),'American spelling');
}
t.ok(publishedEntryIds.includes('air-conditioner'),'reviewed air conditioner is published');
t.ok(heatingLessons['Air conditioner']===lesson,'lesson dispatch');
const routed=createHeatingModel('Air conditioner');
t.ok(routed.parts.some(part=>part.id==='psychro'),'model dispatch');routed.dispose();

model.reset();
for(const seconds of [0,0.1,7.4,7.6,14.9,15,15.1,93.7,250]){
  settle(null,seconds);
  const state=model.getState(),cycle=state.now.cycle,room=state.now.room;
  const inlet=state.readings.find(reading=>reading.label==='Air across the coil');
  t.ok(inlet.value.startsWith(`${f1(room.celsius)} °C in`),'inlet reading uses current room, not initial control');
  t.near(cycle.air.sensible,AIR_SENSIBLE(room.celsius,cycle.air.leavingC,state.values.flow),1e-8,'room and cycle share the same continuous state');
}
function AIR_SENSIBLE(enter,leave,flow){return P.AIR.density*flow*P.AIR.heat*(enter-leave);}
model.advance(1e5);
for(const label of ['Cooling','Compressor','Heat put outdoors']) t.ok(model.getState().readings.find(reading=>reading.label===label).value==='0 W','thermostat stops power');
t.ok(T.drops.every(drop=>!drop.visible) && T.markers.every(marker=>!marker.visible) && T.airIn.userData.length===0,'thermostat stops drawn flow');
t.near(model.getState().now.room.celsius,24,1e-12,'target reached without overshoot');
model.update({room:20,set:24});const blocked=model.getState().clock;model.advance(30);
t.ok(model.getState().clock===blocked && T.drops.every(drop=>!drop.visible),'already-cool room has no clock or condensate motion');
model.reset();model.advance(2);
for(const action of model.actions){const before=model.getState().clock;action.run();t.near(model.getState().clock,before,0,'inspection preserves experiment time');}
model.update({outdoor:45});t.near(model.getState().clock,0,0,'new experiment settings restart from declared initial room');
model.reset();

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) {
  const [lo, hi, step] = P.AIRCON_DOMAINS[control.key];
  t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.AIRCON_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`);
  t.ok(control.help && !/[—–]| - |--/.test(control.help), `${control.key}: helped, without dashes`);
}
t.ok(model.controls.map(control => control.key).join() === 'room,humidity,flow,outdoor,volume,set', 'six controls');
const drawing = () => [
  T.coilTubes.map(tube => tube.material.color.getHex()), T.condTubes.map(tube => tube.material.color.getHex()),
  T.rotor.rotation.x, T.crank.rotation.y, T.airIn.userData.length, T.outdoorArrow.userData.length,
  T.markers.map(marker => [Number(marker.position.x.toFixed(5)), marker.material.color.getHex()]),
  pointsOf(T.process), pointsOf(T.dewLine), T.enterDot.position.toArray(), T.leaveDot.position.toArray(),
  pointsOf(T.setLine), pointsOf(T.guideRoom).slice(0, 40), pointsOf(T.guideHumidity).slice(0, 40), pointsOf(T.curveRoom).slice(-3),
];
checkControlsMove(model, drawing, item => item.advance(P.DECLARED.longest), t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the run');
t.ok(!model.playback.blocked(), 'and the run is ready to press');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, M.CHART.tickEvery, 1e-9, 'a step is five minutes of the run');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through');
  model.animate(0);
  model.animate(1);
  t.near(model.getState().clock, M.CHART.tickEvery + P.DECLARED.slower, 1e-9, 'animation runs on by the time that passed, sixty times faster');
  model.advance(1e5);
  t.ok(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'chart', 'the run done, with the room to inspect');
  const held = JSON.stringify([pointsOf(T.curveRoom).length, T.markers.map(marker => Number(marker.position.x.toFixed(5)))]);
  model.advance(50);
  t.ok(JSON.stringify([pointsOf(T.curveRoom).length, T.markers.map(marker => Number(marker.position.x.toFixed(5)))]) === held, 'once done, the run stays where it ended');
  model.update({room: 20, set: 24});
  t.ok(model.playback.blocked(), 'with the room already at the setting there is nothing to run');
  model.reset();
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part), `${action.label} returns readings`);
    checkFinite(model.root, t);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || model.parts.some(parent=>parent.id===item.parentId)), 'every part described, with no dashes, in a valid hierarchy');
  for (const values of settings) {
    for (const time of [0, 100, 600, 1e5]) {
      model.reset();
      model.update(values);
      model.advance(time);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')) && !/\b(centre|colour|grey|metre|vapour)\b/i.test(item.hint || ''), `reading text without dashes: ${item.label}`);
    }
  }
}
model.reset();
for(const aspect of [0.65,1.25,2]){
  const camera=new THREE.OrthographicCamera(-10,10,10,-10,.01,100);camera.position.set(8,5,12);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const state=JSON.stringify(model.getState()),view=createPartExplosion(model,camera,aspect);
  try{
    assert.deepEqual(new Set(view.categories.map(category=>category.id)),new Set(['indoor','outdoor','connections','observations']));
    assert.ok(view.items.every(item=>item.id!=='system'),'no empty assembly guide in inventory');
    for(const category of view.categories){
      for(let i=0;i<category.items.length;i++)for(let j=i+1;j<category.items.length;j++){
        const a=category.inner.get(category.items[i]),b=category.inner.get(category.items[j]);
        t.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2-1e-8||Math.abs(a.y-b.y)>=(a.h+b.h)/2-1e-8,'projected parts do not overlap');
      }
    }
    for(const amount of [0,.5,1,0]){view.update(amount);assert.equal(JSON.stringify(model.getState()),state,'separation preserves physical state');}
    t.ok(view.items.every(item=>item.group.position.length()<1e-10),'exact reassembly');
  }finally{view.dispose();}
}
const released = checkDisposal((() => { const fresh = M.createAirConditionerModel(); fresh.advance(4); return fresh; })(), t);
model.dispose();

console.log(`PASS air conditioner: ${t.count} checks, ${counts.solves} cycles solved, ${counts.steps} steps integrated, ${counts.plans} runs planned, ${counts.poses} poses, ${counts.points} drawn points traced, 1 lesson, ${released} resources released exactly once.`);

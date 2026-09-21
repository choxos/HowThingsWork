// Checks the air conditioner model and its lesson against the sources typed in
// again and the physics worked out by other routes: the refrigerant's boiling
// curve bisected and differentiated numerically and extrapolated to the
// critical point the table gives, the compressor's work integrated as the
// integral of v dP along its isentrope, the humidity ratio rebuilt from the
// ideal gas law, the dew point bisected out of the Buck equation and compared
// with another fit, the coil's air worked out from the leaving state instead of
// the entering one, both coil balances and the loop's first law checked where
// the solve lands, the room integrated again at a fifth of the step and closed
// with its own energy balance, and every drawn tube, marker, dot and curve read
// back at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './aircon-physics.js';
import * as M from './aircon-model.js';
import * as L from './aircon-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {previewEntryIds} from './published-catalog.js';

const t = tally();
const counts = {solves: 0, steps: 0, poses: 0, points: 0, numbers: 0, plans: 0};
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
  // Wikipedia: R-410A, physical properties table.
  r410a: {
    name: 'R-410A', molar: 0.0726, melting: -155, boiling: -48.5,
    liquidDensity: 1040, liquidDensityAt: 30, vaporDensity: 3.0, vaporDensityAt: 30,
    vaporPressure: 1.383e6, vaporPressureAt: 21.1,
    criticalTemperature: 72.8, criticalPressure: 4.90e6,
    gasHeat: 840, liquidHeat: 1800, liquidHeatAt: 30,
  },
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

assert.deepEqual(JSON.parse(JSON.stringify(P.R410A)), SRC.r410a);
assert.deepEqual(JSON.parse(JSON.stringify(P.AIR)), SRC.air);
assert.deepEqual(JSON.parse(JSON.stringify(P.WATER)), SRC.water);
assert.deepEqual(JSON.parse(JSON.stringify(P.BUCK)), SRC.buck);
assert.deepEqual(JSON.parse(JSON.stringify(P.RATED)), SRC.rated);
assert.equal(P.GAS, SRC.gas);
assert.equal(P.ATMOSPHERE, SRC.atmosphere);
assert.deepEqual(JSON.parse(JSON.stringify(P.DECLARED)), {
  displacement: 11e-6, rpm: 2900, clearance: 0.04, efficiency: 0.55, superheat: 5,
  contact: 0.85, condenser: 450, roomLoss: 60, furnishings: 6,
  longest: 1800, step: 15, samples: 181, slower: 60, lap: 7, iceAt: 0,
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

// The refrigerant's boiling curve: its two sourced points, its slope, and where it reaches the critical point.
{
  t.near(P.boilingPressure(SRC.r410a.boiling), SRC.atmosphere, 1e-6, 'the curve passes through one atmosphere at the sourced boiling point');
  t.near(P.boilingPressure(SRC.r410a.vaporPressureAt), SRC.r410a.vaporPressure, 1, 'and through the sourced vapor pressure at 21.1 °C');
  const found = bisect(celsius => P.boilingPressure(celsius) - SRC.r410a.vaporPressure, -60, 60);
  t.near(found, SRC.r410a.vaporPressureAt, 1e-6, 'bisecting the curve for that pressure finds that temperature again');
  for (const celsius of [-40, -10, 0, 20, 45, 60]) t.near(P.boilingPoint(P.boilingPressure(celsius)), celsius, 1e-9, `the curve turned around returns ${celsius} °C`);
  // The slope of ln P against 1/T, differentiated numerically, is the constant the fit carries.
  for (const celsius of [-20, 0, 25, 50]) {
    const h = 1e-5, T = celsius + K;
    const slope = (Math.log(P.boilingPressure(1 / (1 / T + h) - K)) - Math.log(P.boilingPressure(1 / (1 / T - h) - K))) / (2 * h);
    t.ok(Math.abs(slope + P.CLAPEYRON) / P.CLAPEYRON < 1e-6, `at ${celsius} °C the curve's slope against 1/T is ${f0(-slope)} K, the fit's ${f0(P.CLAPEYRON)} K`);
  }
  // Extrapolated to the critical temperature, the fit should land near the critical pressure the table gives.
  const critical = P.boilingPressure(SRC.r410a.criticalTemperature);
  t.ok(Math.abs(critical - SRC.r410a.criticalPressure) / SRC.r410a.criticalPressure < 0.01, `extrapolated to ${SRC.r410a.criticalTemperature} °C the fit gives ${f2(critical / 1e6)} MPa against the table's ${f2(SRC.r410a.criticalPressure / 1e6)} MPa, within a percent`);
  t.near(P.LATENT, P.CLAPEYRON * SRC.gas / SRC.r410a.molar, 1e-9, 'the latent heat the fit implies is B R over M');
  t.ok(P.LATENT > 200e3 && P.LATENT < 350e3, `and ${f0(P.LATENT / 1000)} kJ/kg is the size a refrigerant's latent heat should be`);
  t.near(P.GAMMA, SRC.r410a.gasHeat / (SRC.r410a.gasHeat - SRC.gas / SRC.r410a.molar), 1e-15, 'the ratio of heat capacities is cp over cp minus R/M');
  t.ok(P.GAMMA > 1 && P.GAMMA < 1.4, `and ${f3(P.GAMMA)} lies where a heavy molecule's should`);
}

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
          t.near(share, P.DECLARED.contact, 1e-12, 'the air leaves the contact share of the way toward the coil');
          if (a.saturated < enteringRatio) {
            t.near(a.leavingRatio, enteringRatio + share * (a.saturated - enteringRatio), 1e-15, 'and the same share of the way toward saturation at it');
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
          t.near(c.effect, P.LATENT - SRC.r410a.liquidHeat * (c.condensing - c.evaporating) + SRC.r410a.gasHeat * P.DECLARED.superheat, 1e-9, 'each kilogram carries its latent heat less the flash and plus the superheat');
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
  t.ok(standard.cooling >= SRC.rated.smallest && standard.cooling <= SRC.rated.largest, `${f0(standard.cooling)} W is inside the ${f1(SRC.rated.smallest / 1000)} to ${f0(SRC.rated.largest / 1000)} kW the Air conditioning page gives residential systems`);
  t.ok(standard.tons >= SRC.rated.tons[0] && standard.tons <= SRC.rated.tons[1], `and ${f2(standard.tons)} tons is inside its ${SRC.rated.tons[0]} to ${SRC.rated.tons[1]} tons`);
  t.ok(standard.cop >= SRC.rated.cop[0] && standard.cop <= SRC.rated.cop[1], `its coefficient of performance, ${f2(standard.cop)}, is inside the ${SRC.rated.cop[0]} to ${SRC.rated.cop[1]} most air conditioners get`);
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
      t.near(plan.track[i].t, i * P.DECLARED.step, 1e-12, 'a step every fifteen seconds');
    }
    t.ok(plan.chart.length === P.DECLARED.samples && plan.chart[0].t === 0 && Math.abs(plan.chart.at(-1).t - plan.duration) < 1e-9, 'the chart spans the whole run');
    t.ok(plan.reaches === (plan.reached !== null && plan.reached > 0), 'the run reaches the setting exactly when the track got there');
    if (plan.reaches) {
      t.ok(plan.settled.celsius <= v.set + 1e-9 && plan.track.at(-2).celsius > v.set, 'and stops on the first step at or below the setting');
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

// Both units at true size, and everything inside them where the constants put it.
{
  settle(null, 0);
  const indoor = extent(pointsOf(T.indoorLine)), outdoor = extent(pointsOf(T.outdoorLine));
  t.near(indoor.x[1] - indoor.x[0], M.INDOOR.casing[0] * M.MM, drawn, 'the indoor unit is drawn its 840 mm wide');
  t.near(indoor.y[1] - indoor.y[0], M.INDOOR.casing[1] * M.MM, drawn, 'and its 295 mm tall');
  t.near(outdoor.x[1] - outdoor.x[0], M.OUTDOOR.casing[0] * M.MM, drawn, 'the outdoor unit its 800 mm wide');
  t.near(outdoor.y[1] - outdoor.y[0], M.OUTDOOR.casing[1] * M.MM, drawn, 'and its 550 mm tall');
  t.ok(M.MM * 1000 === 2, 'both at true size, a millimeter to two thousandths of a scene unit');
  const coil = T.coilTubes.map(worldRectOf), cond = T.condTubes.map(worldRectOf);
  const casingIndoor = worldRectOf(T.indoorLine), casingOutdoor = worldRectOf(T.outdoorLine);
  const inside = (a, b) => a.x[0] > b.x[0] && a.x[1] < b.x[1] && a.y[0] > b.y[0] && a.y[1] < b.y[1];
  const apart = (a, b) => a.x[1] < b.x[0] || b.x[1] < a.x[0] || a.y[1] < b.y[0] || b.y[1] < a.y[0];
  t.ok(T.coilTubes.length === M.INDOOR.tubes && T.condTubes.length === M.OUTDOOR.tubes, 'the coils carry the tubes the constants ask for');
  for (const tube of coil) t.ok(inside(tube, casingIndoor), 'every cold tube inside the indoor casing');
  for (const tube of cond) t.ok(inside(tube, casingOutdoor), 'every hot tube inside the outdoor casing');
  const fanBox = worldRectOf(T.fanRing);
  t.ok(inside(fanBox, casingIndoor), 'and the fan too');
  for (const tube of coil) t.ok(apart(tube, fanBox), 'the indoor fan never sits on top of the coil it blows through');
  const pipeBox = worldRectOf(T.drainPipe);
  for (const drop of T.drops.map(worldRectOf)) t.ok(drop.x[0] > pipeBox.x[0] - 0.04 && drop.x[1] < pipeBox.x[1] + 0.04 && drop.y[1] < worldRectOf(T.panBody).y[0] + 1e-9, 'every drop falls from the pan down the drain, not somewhere else');
  t.ok(worldRectOf(T.expansionMark).y[1] < casingIndoor.y[1] && worldRectOf(T.expansionMark).y[0] > casingOutdoor.y[0], 'the expansion valve is drawn between the units, not above them');
  t.ok(worldRectOf(T.compressorBody).y[0] > casingOutdoor.y[0] && inside(worldRectOf(T.compressorRing), casingOutdoor), 'the compressor sits inside the outdoor casing');
  for (let i = 1; i < coil.length; i++) t.ok(coil[i].x[0] > coil[i - 1].x[1], 'the cold tubes stand apart from each other');
  for (let i = 1; i < cond.length; i++) t.ok(cond[i].y[0] > cond[i - 1].y[1], 'and so do the hot ones');
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

// The refrigerant's way round: the markers ride the drawn path, evenly spaced, in the colors of their leg.
{
  const state = settle(null, 200);
  const path = pointsOf(T.loopLine);
  t.ok(path.length === 9, 'the loop is drawn as eight legs from the cold coil back to itself');
  t.ok(Math.hypot(path[0][0] - path[8][0], path[0][1] - path[8][1]) < 1e-9, 'and closes on itself');
  const onPath = point => Math.min(...path.slice(1).map((corner, i) => {
    const from = path[i], along = [corner[0] - from[0], corner[1] - from[1]], length = Math.hypot(...along);
    const share = Math.max(0, Math.min(1, ((point[0] - from[0]) * along[0] + (point[1] - from[1]) * along[1]) / (length * length)));
    return Math.hypot(point[0] - (from[0] + share * along[0]), point[1] - (from[1] + share * along[1]));
  }));
  for (const marker of T.markers) {
    t.ok(onPath([marker.position.x, marker.position.y]) < 1e-6, 'every marker sits on the drawn loop');
    counts.points++;
  }
  t.ok(T.markers.length === M.LOOP.markers, 'all the markers the constant asks for');
  const hues = new Set(T.markers.map(marker => marker.material.color.getHex()));
  t.ok(hues.size >= 2, 'the legs are not all drawn the same color');
  const suction = M.heatColor(state.now.cycle.evaporating + P.DECLARED.superheat).getHex(), discharge = M.heatColor(state.now.cycle.condensing).getHex(), feed = M.heatColor(state.now.cycle.evaporating).getHex();
  t.ok([...hues].every(hue => hue === suction || hue === discharge || hue === feed), 'and every marker carries the color of the refrigerant on its own leg');
  const before = T.markers.map(marker => marker.position.x + marker.position.y);
  settle(null, 203);
  const after = T.markers.map(marker => marker.position.x + marker.position.y);
  t.ok(before.some((value, i) => Math.abs(value - after[i]) > 1e-6), 'the refrigerant moves round as the run plays');
  settle({room: 20, set: 24}, 0);
  t.ok(T.airIn.userData.length === 0 && T.outdoorArrow.userData.length === 0, 'with nothing to cool, nothing is drawn moving');
}

// What the air does crossing the coil, drawn as a psychrometric chart.
{
  for (const values of [{}, {humidity: 20}, {humidity: 90}, {flow: 0.05}]) {
    const state = settle(values, 0), cycle = state.now.cycle, air = cycle.air, room = state.now.room;
    const curve = pointsOf(T.saturation);
    t.ok(curve.length === M.PSYCHRO.curve, 'the saturation curve is drawn at its full resolution');
    curve.forEach((point, i) => {
      const celsius = M.PSYCHRO.temperature[0] + (M.PSYCHRO.temperature[1] - M.PSYCHRO.temperature[0]) * i / (M.PSYCHRO.curve - 1);
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

const run = values => P.airconPlan(values), def = P.airconPlan({});
const minutes = plan => plan.reached / 60;
checkTrialNumbers(L.airConditionerLesson, {
  'Cool the room down': s => { t.ok(s.reaches && s.steady.air.condensate > 0, 'the default run arrives, taking water out on the way'); return {'3,904': s.steady.cooling, '2,217': s.steady.air.sensible, '1,687': s.steady.air.latent, '12.8': minutes(s)}; },
  'Dry air': s => { t.ok(s.steady.air.condensate === 0 && s.steady.share === 1, 'dry air gives up nothing but heat'); return {'7.7': s.steady.evaporating, '3.0': s.startDew, '3,159': s.steady.cooling, '8.0': minutes(s)}; },
  'Damp air': s => { t.ok(s.steady.air.latent > s.steady.air.sensible, 'damp air spends more of the coil on drying than on cooling'); return {'4.55': s.steady.air.condensate * 3600, '3,107': s.steady.air.latent, '4,578': s.steady.cooling, '21.0': minutes(s)}; },
  'Starve it of air': s => { t.ok(s.steady.evaporating < def.steady.evaporating && s.steady.cooling < def.steady.cooling, 'less air drags the coil down and the capacity with it'); return {'2.3': s.steady.evaporating, '6.1': s.steady.air.leavingC, '2,584': s.steady.cooling, '26.0': minutes(s)}; },
  'Open it up': s => { t.ok(s.steady.share > def.steady.share, 'more air spends more of the coil on cooling'); return {'17.6': s.steady.evaporating, 73: 100 * s.steady.share, 57: 100 * def.steady.share, '1.79': s.steady.air.condensate * 3600, '8.5': minutes(s)}; },
  'A hot day': s => { t.ok(s.steady.compressor.work > def.steady.compressor.work && s.steady.cop < def.steady.cop, 'a hotter day costs more work for less cooling'); return {'55.7': s.steady.condensing, '1,204': s.steady.compressor.work, 949: def.steady.compressor.work, '4.11': def.steady.cop, '3.01': s.steady.cop}; },
  'A bigger room': s => { t.ok(s.steady.cooling === def.steady.cooling && s.reached > def.reached, 'the same unit takes longer over a bigger room'); return {'3,904': s.steady.cooling, '25.3': minutes(s), '12.8': minutes(def)}; },
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
const lesson = L.airConditionerLesson;
const texts = item => [['simple', item.simple], ['overview', item.overview], ...item.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...item.parts.map((part, i) => [`part ${i + 1}`, part.role]), ['misconception', item.misconception], ['quiz', [item.quiz.question, ...item.quiz.options].join(' ')]];
for (const [where, text] of texts(lesson)) covered(text, {}, `Air conditioner ${where}`);

const limitSnippets = {
  [`compressor of ${f0(1e6 * P.DECLARED.displacement)} cm³ turning at ${P.DECLARED.rpm.toLocaleString('en-US')} rpm with ${f0(100 * P.DECLARED.clearance)} percent clearance, ${f0(100 * P.DECLARED.efficiency)} percent efficient`]: 'compressor of 11 cm³ turning at 2,900 rpm with 4 percent clearance, 55 percent efficient',
  [`inside the ${f1(P.RATED.cop[0])} to ${f0(P.RATED.cop[1])} its page gives`]: 'inside the 3.5 to 5 its page gives',
  [`fixed at the table’s ${f0(P.R410A.liquidHeatAt)} °C value`]: 'fixed at the table’s 30 °C value',
  [`cold coil ${f0(P.DECLARED.superheat)} °C superheated`]: 'cold coil 5 °C superheated',
  [`${f0(100 * P.DECLARED.contact)} percent of the air brought to it`]: '85 percent of the air brought to it',
  [`sheds ${f0(P.DECLARED.condenser)} W for each degree`]: 'sheds 450 W for each degree',
  [`hold ${f0(P.DECLARED.furnishings)} times what its air alone holds`]: 'hold 6 times what its air alone holds',
  [`lets ${f0(P.DECLARED.roomLoss)} W back in`]: 'lets 60 W back in',
  [`going round once every ${f0(P.DECLARED.lap)} s of the run`]: 'going round once every 7 s of the run',
};
covered(L.airconLimits, limitSnippets, 'air conditioner limits');
covered(lesson.limits, {[`plays ${f0(P.DECLARED.slower)} times faster`]: 'plays 60 times faster', ...limitSnippets}, 'Air conditioner limits');

const standard = def.steady, waterAt = P.waterLatent(standard.evaporating);
covered(lesson.deeper[0].body, {
  [`puts at ${f0(waterAt / 1000)} J/g at this coil`]: 'puts at 2,469 J/g at this coil',
  [`${f0(standard.air.sensible)} W of the ${f0(standard.cooling)} W is sensible and ${f0(standard.air.latent)} W is latent, so ${f0(100 * standard.share)}% of the work is cooling and ${f0(100 - 100 * standard.share)}% is drying`]: '2,217 W of the 3,904 W is sensible and 1,687 W is latent, so 57% of the work is cooling and 43% is drying',
}, 'Air conditioner deeper 1');
covered(lesson.deeper[1].body, {
  [`At ${f0(def.values.room)} °C and ${f0(def.values.humidity)}% the room’s air carries ${f2(1000 * def.startRatio)} g/kg and would be full at ${f1(def.startDew)} °C`]: 'At 28 °C and 60% the room’s air carries 14.25 g/kg and would be full at 19.5 °C',
  [`coil at ${f1(standard.evaporating)} °C takes water out until the air leaving carries ${f2(1000 * standard.air.leavingRatio)} g/kg`]: 'coil at 13.7 °C takes water out until the air leaving carries 10.46 g/kg',
  [`leaves this coil at ${f0(standard.air.leavingHumidity)}% while the room it came from was at ${f0(def.values.humidity)}%`]: 'leaves this coil at 93% while the room it came from was at 60%',
  [`ends the run at ${f0(P.relativeHumidity(def.settled.celsius, def.settled.ratio))}%`]: 'ends the run at 67%',
}, 'Air conditioner deeper 2');
covered(lesson.deeper[2].body, {
  [P.R410A.name]: 'R-410A',
  [`boils at ${f1(-P.R410A.boiling)} °C below zero under one atmosphere and needs ${f3(P.R410A.vaporPressure / 1e6)} MPa to stay liquid at ${f1(P.R410A.vaporPressureAt)} °C`]: 'boils at 48.5 °C below zero under one atmosphere and needs 1.383 MPa to stay liquid at 21.1 °C',
  [`give ${f0(P.CLAPEYRON)} K`]: 'give 2,482 K',
  [`extrapolates to ${f2(P.boilingPressure(P.R410A.criticalTemperature) / 1e6)} MPa at the critical point the table gives as ${f2(P.R410A.criticalPressure / 1e6)} MPa`]: 'extrapolates to 4.88 MPa at the critical point the table gives as 4.90 MPa',
  [`latent heat of ${f0(P.LATENT / 1000)} kJ/kg`]: 'latent heat of 284 kJ/kg',
  [`boil at ${f2(standard.compressor.low / 1e5)} bar and the coil sits at ${f1(standard.evaporating)} °C`]: 'boil at 11.14 bar and the coil sits at 13.7 °C',
}, 'Air conditioner deeper 3');
covered(lesson.deeper[3].body, {
  [`swallows vapor at ${f2(standard.compressor.low / 1e5)} bar and pushes it out at ${f2(standard.compressor.high / 1e5)} bar, a pressure ratio of ${f2(standard.compressor.ratio)}`]: 'swallows vapor at 11.14 bar and pushes it out at 26.57 bar, a pressure ratio of 2.39',
  [`an ${f0(1e6 * P.DECLARED.displacement)} cm³ swept volume turning ${P.DECLARED.rpm.toLocaleString('en-US')} times a minute fills ${f1(100 * standard.compressor.volumetric)}% of the way and moves ${f2(1000 * standard.compressor.mass)} g`]: 'an 11 cm³ swept volume turning 2,900 times a minute fills 95.5% of the way and moves 16.92 g',
}, 'Air conditioner deeper 4');
{
  const hot = P.airconPlan({outdoor: 45}).steady;
  covered(lesson.deeper[4].body, {
    [`${f0(standard.cooling)} W and ${f0(standard.compressor.work)} W make ${f0(standard.outdoorHeat)} W`]: '3,904 W and 949 W make 4,854 W',
    [`from ${f0(def.values.outdoor)} °C outdoors to ${f0(45)} °C the compressor goes from ${f0(standard.compressor.work)} W to ${f0(hot.compressor.work)} W while the cooling it delivers falls from ${f0(standard.cooling)} W to ${f0(hot.cooling)} W`]: 'from 35 °C outdoors to 45 °C the compressor goes from 949 W to 1,204 W while the cooling it delivers falls from 3,904 W to 3,623 W',
  }, 'Air conditioner deeper 5');
}
covered(lesson.deeper[5].body, {
  [`this unit gives ${f2(standard.cop)}`]: 'this unit gives 4.11',
  [`gives most air conditioners ${f1(P.RATED.cop[0])} to ${f0(P.RATED.cop[1])}`]: 'gives most air conditioners 3.5 to 5',
  [`across the same ${f1(standard.lift)} °C would reach ${f1(standard.carnot)}, so this one is ${f0(100 * standard.cop / standard.carnot)}% of the best`]: 'across the same 32.1 °C would reach 8.9, so this one is 46% of the best',
  [`Its capacity, ${f0(standard.cooling)} W, is ${f2(standard.tons)} tons of refrigeration, a ton being exactly ${P.RATED.btu.toLocaleString('en-US')} BTU an hour, and the Air conditioning page puts residential systems at ${f0(P.RATED.tons[0])} to ${f0(P.RATED.tons[1])} tons`]: 'Its capacity, 3,904 W, is 1.11 tons of refrigeration, a ton being exactly 12,000 BTU an hour, and the Air conditioning page puts residential systems at 1 to 5 tons',
}, 'Air conditioner deeper 6');
covered(lesson.quiz.explanation, {
  [`loses ${f0(standard.cooling)} W and the compressor adds ${f0(standard.compressor.work)} W, so ${f0(standard.outdoorHeat)} W`]: 'loses 3,904 W and the compressor adds 949 W, so 4,854 W',
}, 'Air conditioner quiz');

// The model's own words.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`indoor one ${f0(M.INDOOR.casing[0])} mm wide and the outdoor one ${f0(M.OUTDOOR.casing[1])} mm tall`]: 'indoor one 840 mm wide and the outdoor one 550 mm tall',
  [`plays ${f0(P.DECLARED.slower)} times faster`]: 'plays 60 times faster',
}, 'system text');
covered(partText('indoor'), {[`${f0(M.INDOOR.casing[0])} mm by ${f0(M.INDOOR.casing[1])} mm`]: '840 mm by 295 mm'}, 'indoor text');
covered(partText('evaporator'), {[`${M.INDOOR.tubes} tubes across the airflow`]: '7 tubes across the airflow'}, 'evaporator text');
covered(partText('outdoor'), {[`${f0(M.OUTDOOR.casing[0])} mm by ${f0(M.OUTDOOR.casing[1])} mm`]: '800 mm by 550 mm'}, 'outdoor text');
covered(partText('condenser'), {[`${M.OUTDOOR.tubes} tubes deep`]: '9 tubes deep'}, 'condenser text');
covered(partText('loop'), {[`once every ${f0(P.DECLARED.lap)} s of the run`]: 'once every 7 s of the run'}, 'loop text');
covered(partText('psychro'), {
  [`from ${f0(-M.PSYCHRO.temperature[0])} \u00b0C below zero to ${f0(M.PSYCHRO.temperature[1])} \u00b0C above`]: 'from 15 °C below zero to 40 °C above',
  [`from nothing to ${f0(1000 * M.PSYCHRO.ratio[1])} grams`]: 'from nothing to 36 grams',
}, 'psychro text');
covered(partText('chart'), {
  [`from ${f0(M.CHART.temperature[0])} to ${f0(M.CHART.temperature[1])} °C`]: 'from 15 to 35 °C',
  [`from ${f0(M.CHART.humidity[0])} to ${f0(M.CHART.humidity[1])} percent, with a tick every ${f0(M.CHART.tickEvery / 60)} minutes`]: 'from 0 to 100 percent, with a tick every 5 minutes',
}, 'chart text');
for (const id of ['fan', 'drain', 'outdoor-fan', 'compressor', 'expansion']) covered(partText(id), {}, `${id} text`);

// The readings.
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Cooling,Air across the coil,Water taken out,Sensible and latent,Compressor,Refrigerant,Heat put outdoors,Coefficient of performance,The room,Sped up', 'eleven readings, the result first');
  t.ok(readings.slice(1).every(item => item.hint), 'and every one of them but the result carries a hint');
  t.ok(find('Cooling').value === `${f0(standard.cooling)} W, ${f2(standard.tons)} tons`, 'the cooling reading');
  t.ok(find('Air across the coil').value === `${f0(def.values.room)} °C in, ${f1(standard.air.leavingC)} °C out`, 'the air across the coil');
  t.ok(find('Water taken out').value === `${f2(standard.air.condensate * 3600)} kg/h`, 'the water taken out');
  t.ok(find('Compressor').value === `${f0(standard.compressor.work)} W` && find('Coefficient of performance').value === f2(standard.cop), 'the compressor and its coefficient of performance');
  t.ok(find('Heat put outdoors').value === `${f0(standard.outdoorHeat)} W` && find('The room').value === `${f0(def.values.set)} °C after ${f1(def.reached / 60)} min`, 'the heat put outdoors and the room');
  t.ok(find('Sped up').value === `${f0(P.DECLARED.slower)} times faster`, 'and the clock');
  covered(find('Cooling').hint, {
    [`exactly ${P.RATED.btu.toLocaleString('en-US')} BTU an hour, ${f0(P.RATED.ton)} W, and the Air conditioning page puts residential systems at ${f0(P.RATED.tons[0])} to ${f0(P.RATED.tons[1])} tons`]: 'exactly 12,000 BTU an hour, 3,517 W, and the Air conditioning page puts residential systems at 1 to 5 tons',
    [`Of the ${f0(standard.cooling)} W, ${f0(standard.air.sensible)} W is sensible, the part that lowers the air’s temperature, and ${f0(standard.air.latent)} W is latent, the part that condenses its water; ${f0(100 * standard.share)}% of the work is cooling and ${f0(100 - 100 * standard.share)}% is drying.`]: 'Of the 3,904 W, 2,217 W is sensible, the part that lowers the air’s temperature, and 1,687 W is latent, the part that condenses its water; 57% of the work is cooling and 43% is drying.',
  }, 'Cooling hint');
  covered(find('Air across the coil').hint, {
    [`sits at the ${f1(standard.evaporating)} °C the refrigerant boils at, and ${f0(100 * P.DECLARED.contact)}% of the air is brought to it`]: 'sits at the 13.7 °C the refrigerant boils at, and 85% of the air is brought to it',
    [`leaves at ${f1(standard.air.leavingC)} °C and ${f0(standard.air.leavingHumidity)}% relative humidity`]: 'leaves at 15.9 °C and 93% relative humidity',
  }, 'Air hint');
  covered(find('Water taken out').hint, {
    [`carrying ${f2(1000 * def.startRatio)} g of water for each kilogram of dry air, a dew point of ${f1(def.startDew)} °C`]: 'carrying 14.25 g of water for each kilogram of dry air, a dew point of 19.5 °C',
    [`it leaves with ${f2(1000 * standard.air.leavingRatio)} g/kg and the rest, ${f2(standard.air.condensate * 3600)} kg an hour`]: 'it leaves with 10.46 g/kg and the rest, 2.46 kg an hour',
  }, 'Water hint');
  covered(find('Compressor').hint, {
    [`vapor at ${f2(standard.compressor.low / 1e5)} bar and pushes it out at ${f2(standard.compressor.high / 1e5)} bar, a pressure ratio of ${f2(standard.compressor.ratio)}`]: 'vapor at 11.14 bar and pushes it out at 26.57 bar, a pressure ratio of 2.39',
    [`Its ${f0(1e6 * P.DECLARED.displacement)} cm³ swept ${P.DECLARED.rpm.toLocaleString('en-US')} times a minute fills only ${f1(100 * standard.compressor.volumetric)}% of the way`]: 'Its 11 cm³ swept 2,900 times a minute fills only 95.5% of the way',
    [`moves ${f2(1000 * standard.compressor.mass)} g of refrigerant a second`]: 'moves 16.92 g of refrigerant a second',
  }, 'Compressor hint');
  covered(find('Coefficient of performance').hint, {
    [`${f0(standard.cooling)} W for ${f0(standard.compressor.work)} W`]: '3,904 W for 949 W',
    [`gives most air conditioners ${f1(P.RATED.cop[0])} to ${f0(P.RATED.cop[1])}`]: 'gives most air conditioners 3.5 to 5',
    [`across the same ${f1(standard.lift)} °C would reach ${f1(standard.carnot)}, so this one is ${f0(100 * standard.cop / standard.carnot)}%`]: 'across the same 32.1 °C would reach 8.9, so this one is 46%',
  }, 'Coefficient hint');
  covered(find('Sped up').hint, {
    [`plays ${f0(P.DECLARED.slower)} times faster than the real thing: this one takes ${f1(def.duration / 60)} min and plays in ${f0(def.duration / P.DECLARED.slower)} s`]: 'plays 60 times faster than the real thing: this one takes 12.8 min and plays in 13 s',
  }, 'Sped up hint');
  model.update({humidity: 20});
  t.ok(model.getState().readings.find(item => item.label === 'Water taken out').value === 'none', 'dry air takes no water out, and the reading says so');
  model.reset();
}

{
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, 'a quiz with its answer first');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe])];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const source of lesson.sources) t.ok(!/ [—–] | - |--/.test(source.title), `no dash as punctuation in the source title: ${source.title}`);
  all.push(...lesson.sources.map(source => source.title));
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium|vapour|sulphur)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part named is a part the model has');
  t.ok(lesson.steps.length === 5 && lesson.deeper.length === 6 && lesson.tryIt.length === 7 && lesson.parts.length === 11, 'five steps, six deeper sections, seven trials and eleven parts');
  t.ok(new Set(lesson.tryIt.map(item => item.part)).size >= 4, 'and the trials are spread across the machine');
  t.ok(lesson.tryIt.every(item => item.part !== 'system'), 'each trial points at the part it is about, not at the whole machine');
  t.ok(previewEntryIds.includes('air-conditioner'), 'and the air conditioner is routed into the preview');
  t.ok(heatingLessons['Air conditioner'] === lesson, 'the heating lessons carry this lesson');
  const routed = createHeatingModel('Air conditioner');
  t.ok(routed.parts.some(part => part.id === 'psychro') && routed.controls.map(control => control.key).join() === 'room,humidity,flow,outdoor,volume,set', 'the heating models route the air conditioner here');
  routed.dispose();
}

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
  T.rotor.rotation.z, T.crank.rotation.z, T.airIn.userData.length, T.outdoorArrow.userData.length,
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
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
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
const released = checkDisposal((() => { const fresh = M.createAirConditionerModel(); fresh.advance(4); return fresh; })(), t);
model.dispose();

console.log(`PASS air conditioner: ${t.count} checks, ${counts.solves} cycles solved, ${counts.steps} steps integrated, ${counts.plans} runs planned, ${counts.poses} poses, ${counts.points} drawn points traced, ${counts.numbers} quoted numbers traced, 1 lesson, ${released} resources released exactly once.`);

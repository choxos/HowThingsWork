import {validateControls, validTime, clamp} from './physics-kit.js';

import {R410A, saturationPressure, saturationTemperature, liquidEnthalpy, vaporEnthalpy} from './r410a-properties.js';
export {R410A, liquidEnthalpy, vaporEnthalpy};

// Manufacturer saturation properties; ideal-gas compressor and well-mixed room.
// Equipment parameters are illustrative, not product ratings.
export const GAS = 8.31446261815324;
export const ATMOSPHERE = 101325;

/** Dry air, from the Density of air and Table of specific heat capacities pages. */
export const AIR = Object.freeze({density: 1.2041, densityAt: 20, standardDensity: 1.2250, standardDensityAt: 15, molar: 0.0289652, heat: 1012, heatAt: 'typical room conditions'});

/** Water, from the Properties of water and Latent heat pages. */
export const WATER = Object.freeze({molar: 0.018015, heat: 4184, heatAt: 20, vaporization: 2257, vaporizationAt: 100, latent: Object.freeze([2500.8, -2.36, 0.0016, -0.00006]), latentFrom: -25, latentTo: 40});

/** The Arden Buck equation over liquid water, hPa with T in °C, fitted from −80 to 50 °C. */
export const BUCK = Object.freeze({a: 6.1121, b: 18.678, c: 257.14, d: 234.5, from: -80, to: 50});

/** What the Air conditioning and Coefficient of performance pages give about units of this size. */
export const RATED = Object.freeze({ton: 3516.853, btu: 12000, smallest: 3.5e3, largest: 18e3, tons: Object.freeze([1, 5]), cop: Object.freeze([3.5, 5]), comfort: Object.freeze([30, 60])});

/** Not from a source, each said in the lesson's limits. */
export const DECLARED = Object.freeze({
  displacement: 11e-6, rpm: 2900, clearance: 0.04, efficiency: 0.55, superheat: 5,
  contact: 0.85, condenser: 450, roomLoss: 60, furnishings: 6,
  longest: 1800, step: 15, samples: 181, slower: 60, lap: 120, iceAt: 0,
});

export const AIRCON_DEFAULTS = Object.freeze({room: 28, humidity: 60, flow: 0.15, outdoor: 35, volume: 40, set: 24});
export const AIRCON_DOMAINS = Object.freeze({
  room: Object.freeze([20, 35, 1]), humidity: Object.freeze([20, 90, 5]), flow: Object.freeze([0.05, 0.3, 0.025]),
  outdoor: Object.freeze([25, 45, 1]), volume: Object.freeze([20, 80, 5]), set: Object.freeze([18, 28, 1]),
});

const K = 273.15;

/** The molar mass of water over the molar mass of dry air: the 0.622 of the humidity ratio, worked out rather than typed. */
export const MOLAR_RATIO = WATER.molar / AIR.molar;

/** Ideal-gas approximation used only for compressor work and mass flow. */
export const REFRIGERANT_GAS = GAS / R410A.molar;
export const GAMMA = R410A.gasHeat / (R410A.gasHeat - REFRIGERANT_GAS);
export const boilingPressure = saturationPressure;
export const boilingPoint = saturationTemperature;

/** The saturation vapor pressure of water, Pa, at `celsius`. */
export const buckPressure = celsius => 100 * BUCK.a * Math.exp((BUCK.b - celsius / BUCK.d) * (celsius / (BUCK.c + celsius)));
/** The temperature, °C, whose saturation pressure is `pascals`: the Buck equation turned around, taking the root below its turning point. */
export function dewPointOf(pascals) {
  const l = Math.log(pascals / (100 * BUCK.a)), p = BUCK.d * (BUCK.b - l), q = BUCK.d * BUCK.c * l;
  return (p - Math.sqrt(p * p - 4 * q)) / 2;
}
/** Kilograms of water vapor for each kilogram of dry air, at a vapor pressure of `pascals`. */
export const humidityRatio = pascals => MOLAR_RATIO * pascals / (ATMOSPHERE - pascals);
/** The vapor pressure, Pa, that goes with a humidity ratio. */
export const vaporPressureOf = ratio => ATMOSPHERE * ratio / (MOLAR_RATIO + ratio);
/** The heat given up by each kilogram of water that condenses at `celsius`, J/kg, from the Latent heat page's cubic fit. */
export const waterLatent = celsius => 1000 * (WATER.latent[0] + WATER.latent[1] * celsius + WATER.latent[2] * celsius ** 2 + WATER.latent[3] * celsius ** 3);
/** The relative humidity, percent, of air at `celsius` holding `ratio` kilograms of water for each kilogram of dry air. */
export const relativeHumidity = (celsius, ratio) => 100 * vaporPressureOf(ratio) / buckPressure(celsius);
/** The humidity ratio of saturated air at `celsius`. */
export const saturatedRatio = celsius => humidityRatio(buckPressure(celsius));

/** The x where an increasing `fn` crosses zero, by bisection; the nearer end if it never does. */
function bisect(fn, lo, hi, steps = 32) {
  if (fn(lo) >= 0) return lo;
  if (fn(hi) <= 0) return hi;
  let a = lo, b = hi;
  for (let i = 0; i < steps; i++) { const mid = (a + b) / 2; if (fn(mid) > 0) b = mid; else a = mid; }
  return (a + b) / 2;
}

/**
 * The compressor at an evaporating and a condensing temperature: the two
 * pressures, the density of the vapor it swallows, the share of its stroke that
 * fills, the refrigerant it moves, and the work it takes.
 */
export function compressorAt(evaporating, condensing) {
  const low = boilingPressure(evaporating, 'dew'), high = boilingPressure(condensing, 'bubble');
  const suction = evaporating + DECLARED.superheat;
  const density = low * R410A.molar / (GAS * (suction + K));
  const ratio = high / low;
  const volumetric = clamp(1 - DECLARED.clearance * (ratio ** (1 / GAMMA) - 1), 0, 1);
  const swept = DECLARED.displacement * DECLARED.rpm / 60;
  const mass = volumetric * swept * density;
  const ideal = mass * R410A.gasHeat * (suction + K) * (ratio ** ((GAMMA - 1) / GAMMA) - 1);
  const work = ideal / DECLARED.efficiency;
  return {low, high, suction, density, ratio, volumetric, swept, mass, ideal, work, discharge: suction + (mass > 0 ? work / (mass * R410A.gasHeat) : 0)};
}

/** Evaporator enthalpy rise after isenthalpic throttling, plus superheat. */
export const refrigeratingEffect = (evaporating, condensing) =>
  vaporEnthalpy(evaporating) - liquidEnthalpy(condensing) + R410A.gasHeat * DECLARED.superheat;

/**
 * What the air gives up crossing a coil whose surface is at `coil`: the share
 * of it brought to the coil leaves at the coil's temperature and, if the coil
 * is below its dew point, at the coil's saturation; the rest slips past
 * unchanged. Returns the leaving state, the water condensed, and the sensible,
 * latent and total loads, W.
 */
export function coilAir(enteringC, enteringRatio, flow, coil) {
  const dryFlow = AIR.density * flow;
  const bypass = 1 - DECLARED.contact;
  let leavingC = DECLARED.contact * coil + bypass * enteringC;
  const saturated = saturatedRatio(coil);
  let leavingRatio = saturated < enteringRatio ? DECLARED.contact * saturated + bypass * enteringRatio : enteringRatio;
  let mist = 0;
  if (leavingRatio > saturatedRatio(leavingC)) {
    const mixedRatio = leavingRatio;
    const mixedEnthalpy = AIR.heat * leavingC + waterLatent(coil) * leavingRatio;
    leavingC = bisect(temperature => AIR.heat * temperature + waterLatent(coil) * saturatedRatio(temperature) - mixedEnthalpy, leavingC, enteringC);
    leavingRatio = saturatedRatio(leavingC);
    mist = dryFlow * (mixedRatio - leavingRatio);
  }
  const condensate = dryFlow * (enteringRatio - leavingRatio);
  const sensible = dryFlow * AIR.heat * (enteringC - leavingC);
  const latent = condensate * waterLatent(coil);
  const leavingHumidity = relativeHumidity(leavingC, leavingRatio);
  return {dryFlow, leavingC, leavingRatio, leavingHumidity, saturated, condensate, mist, sensible, latent, total: sensible + latent};
}

/**
 * Where the loop settles for air entering the cold coil at `enteringC` with
 * `enteringRatio` at `flow`, against outdoor air at `outdoor`: the evaporating
 * temperature where what the refrigerant carries away equals what the air gives
 * up, and the condensing temperature where the outdoor coil rejects the cooling
 * load plus the compressor's work.
 */
export function solveCycle(enteringC, enteringRatio, flow, outdoor) {
  // For one evaporating temperature, the condensing temperature the outdoor coil settles at.
  const condensingFor = evaporating => bisect(condensing => {
    const compressor = compressorAt(evaporating, condensing);
    const load = compressor.mass * refrigeratingEffect(evaporating, condensing);
    return DECLARED.condenser * (condensing - outdoor) - (load + compressor.work);
  }, outdoor + 0.01, R410A.criticalTemperature - 0.01);
  const balance = evaporating => {
    const condensing = condensingFor(evaporating);
    const compressor = compressorAt(evaporating, condensing);
    return compressor.mass * refrigeratingEffect(evaporating, condensing) - coilAir(enteringC, enteringRatio, flow, evaporating).total;
  };
  const evaporating = bisect(balance, -20, enteringC - 0.5);
  const condensing = condensingFor(evaporating);
  const compressor = compressorAt(evaporating, condensing);
  const effect = refrigeratingEffect(evaporating, condensing);
  const air = coilAir(enteringC, enteringRatio, flow, evaporating);
  const cooling = compressor.mass * effect;
  const outdoorHeat = cooling + compressor.work;
  return {
    evaporating, condensing, compressor, effect, air, cooling, outdoorHeat,
    cop: cooling / compressor.work,
    carnot: (evaporating + K) / (condensing - evaporating),
    tons: cooling / RATED.ton,
    share: air.total > 0 ? air.sensible / air.total : 1,
    icing: evaporating < DECLARED.iceAt,
    lift: condensing - evaporating,
  };
}


const plans = new Map();

/**
 * The unit at one set of controls: where the loop settles on the room's
 * starting air, and the room cooled step by step from there until it reaches
 * the setting or the run ends.
 */
export function airconPlan(input = {}) {
  const values = validateControls(input, AIRCON_DEFAULTS, AIRCON_DOMAINS, 'air conditioner');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const entering = buckPressure(values.room) * values.humidity / 100;
  const startRatio = humidityRatio(entering);
  const steady = solveCycle(values.room, startRatio, values.flow, values.outdoor);
  const dryMass = AIR.density * values.volume;
  const heatCapacity = dryMass * AIR.heat * DECLARED.furnishings;
  const waterCapacity = dryMass * DECLARED.furnishings;

  // The room, one stirred volume: the unit takes heat and water out of it while
  // the outdoor air leaks heat back in. The run ends when the room reaches the
  // setting, or at half an hour if it never does.
  const already = values.room <= values.set;
  const track = [{t: 0, celsius: values.room, ratio: startRatio, cycle: steady}];
  let reached = already ? 0 : null;
  for (let step = 1; reached === null && step * DECLARED.step <= DECLARED.longest; step++) {
    const previous = track[step - 1];
    const leak = DECLARED.roomLoss * (values.outdoor - previous.celsius);
    const change = (leak - previous.cycle.air.sensible) / heatCapacity;
    const dt = change < 0 ? Math.min(DECLARED.step, (values.set - previous.celsius) / change) : DECLARED.step;
    const celsius = dt < DECLARED.step ? values.set : previous.celsius + change * dt;
    const ratio = Math.max(0, previous.ratio - previous.cycle.air.condensate * dt / waterCapacity);
    const t = previous.t + dt;
    track.push({t, celsius, ratio, cycle: solveCycle(celsius, ratio, values.flow, values.outdoor)});
    if (celsius <= values.set) reached = t;
  }
  const settled = track.at(-1);
  const duration = reached === null || reached === 0 ? DECLARED.longest : reached;
  const plan = {
    values, entering, startRatio, steady, dryMass, heatCapacity, waterCapacity, track, already,
    startDew: dewPointOf(entering), reached, duration, settled,
    reaches: reached !== null && reached > 0,
    cools: settled.celsius < values.room - 1e-9,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1), room = roomAt(plan, t);
    return {t, celsius: room.celsius, humidity: room.humidity};
  });
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The room's air at time t in the run, read off the track between its steps. */
export function roomAt(plan, t) {
  const place = clamp(t / DECLARED.step, 0, plan.track.length - 1);
  const low = Math.floor(place), high = Math.min(low + 1, plan.track.length - 1);
  const span = plan.track[high].t - plan.track[low].t;
  const part = span > 0 ? clamp((t - plan.track[low].t) / span, 0, 1) : 0;
  const celsius = plan.track[low].celsius + part * (plan.track[high].celsius - plan.track[low].celsius);
  const ratio = plan.track[low].ratio + part * (plan.track[high].ratio - plan.track[low].ratio);
  return {celsius, ratio, humidity: relativeHumidity(celsius, ratio), dew: dewPointOf(vaporPressureOf(ratio))};
}

/**
 * The unit at a time in the run: the room's air then, where the loop sits on
 * that air, and how far around the loop the refrigerant has traveled.
 */
export function airconAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration), started = t > 0;
  const room = roomAt(plan, t);
  const cycle = solveCycle(room.celsius, room.ratio, plan.values.flow, plan.values.outdoor);
  return {time, t, started, done: t >= plan.duration, arrived: plan.reaches && t >= plan.reached, room, cycle, turn: t / DECLARED.lap};
}

export const sampleAircon = (input = {}, time = 0) => airconAt(airconPlan(input), time);

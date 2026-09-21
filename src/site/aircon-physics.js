import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Air conditioner: a vapor compression loop of R-410A whose cold coil sits in
// the room's air, taking heat out of it and water out with the heat, and whose
// hot coil stands outdoors giving both back to the outdoor air.
//
// Exact within the model: the refrigerant's boiling pressure from Clausius and
// Clapeyron through the two points its property table gives, 1 atm at
// −48.5 °C and 1.383 MPa at 21.1 °C, with the latent heat B R / M that fit
// implies; the compressor's volumetric efficiency from its clearance and the
// pressure ratio, its mass flow from the suction vapor taken as an ideal gas,
// and its ideal work cp T ((Pc/Pe)^((γ−1)/γ) − 1), with γ from the table's gas
// heat capacity and R/M; the saturation pressure of water from the Arden Buck
// equation, the humidity ratio 0.621959 p/(101,325 − p), which is the molar
// mass of water over the molar mass of dry air, the dew point from the Buck
// equation turned around, and the latent heat of condensing water from the
// Latent heat page's cubic fit; the sensible and latent loads of the air
// crossing the coil; the loop closed by its own first law, the condenser
// rejecting the cooling load plus the compressor's work; and the room
// integrated step by step as one stirred volume.
//
// Sourced: R-410A's composition, molar mass, boiling point, vapor pressure at
// 21.1 °C, critical point, and gas and liquid heat capacities; dry air's
// density, molar mass and heat capacity; water's molar mass; the Buck
// coefficients; a ton of refrigeration; the range of residential capacities;
// the coefficient of performance of most air conditioners; the comfort band of
// 30 to 60 percent; and that too little airflow can ice the coil.
//
// Not from a source, each said in the lesson's limits: a rotary compressor of
// 11 cm³ turning at 2,900 rpm with 4 percent clearance, 55 percent efficient
// against the ideal compression, chosen so that the unit's coefficient of
// performance falls inside the 3.5 to 5 its page gives for most air
// conditioners; its vapor taken as an ideal gas with a
// constant latent heat and a liquid heat capacity fixed at the table's 30 °C
// value; vapor leaving the evaporator 5 °C superheated and liquid leaving the
// condenser at the condensing temperature; the coil's surface at the
// evaporating temperature, with 85 percent of the air brought to it and the
// rest slipping past unchanged, which can leave the mixture a shade above
// saturation, where the model reads it as saturated; an outdoor coil of 450 W/K;
// a room whose air, furnishings and surfaces hold 6 times what its air alone
// holds, for moisture as well as heat, losing 60 W for each degree it is cooler
// than outdoors, with no moisture coming back in; the run stopped at 30 minutes;
// the refrigerant drawn going round once every 7 s of the run; and standard
// atmospheric pressure everywhere.
// ---------------------------------------------------------------------------

/** The gas constant and standard atmosphere, from the Density of air page and the standard atmosphere. */
export const GAS = 8.31446261815324;
export const ATMOSPHERE = 101325;

/** R-410A, from the property table on its Wikipedia page. Pressures in Pa, temperatures in °C, heat capacities in J/(kg·K). */
export const R410A = Object.freeze({
  name: 'R-410A', molar: 0.0726, melting: -155, boiling: -48.5,
  liquidDensity: 1040, liquidDensityAt: 30, vaporDensity: 3.0, vaporDensityAt: 30,
  vaporPressure: 1.383e6, vaporPressureAt: 21.1,
  criticalTemperature: 72.8, criticalPressure: 4.90e6,
  gasHeat: 840, liquidHeat: 1800, liquidHeatAt: 30,
});

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
  longest: 1800, step: 15, samples: 181, slower: 60, lap: 7, iceAt: 0,
});

export const AIRCON_DEFAULTS = Object.freeze({room: 28, humidity: 60, flow: 0.15, outdoor: 35, volume: 40, set: 24});
export const AIRCON_DOMAINS = Object.freeze({
  room: Object.freeze([20, 35, 1]), humidity: Object.freeze([20, 90, 5]), flow: Object.freeze([0.05, 0.3, 0.025]),
  outdoor: Object.freeze([25, 45, 1]), volume: Object.freeze([20, 80, 5]), set: Object.freeze([18, 28, 1]),
});

const K = 273.15;

/** The molar mass of water over the molar mass of dry air: the 0.622 of the humidity ratio, worked out rather than typed. */
export const MOLAR_RATIO = WATER.molar / AIR.molar;

/** Clausius and Clapeyron through the refrigerant's two sourced points: ln(P2/P1) = B (1/T1 − 1/T2). */
export const CLAPEYRON = Math.log(R410A.vaporPressure / ATMOSPHERE) / (1 / (R410A.boiling + K) - 1 / (R410A.vaporPressureAt + K));
/** The latent heat that fit implies, J/kg: B R / M. */
export const LATENT = CLAPEYRON * GAS / R410A.molar;
/** The refrigerant's own gas constant and its ratio of heat capacities, from the table's gas heat capacity. */
export const REFRIGERANT_GAS = GAS / R410A.molar;
export const GAMMA = R410A.gasHeat / (R410A.gasHeat - REFRIGERANT_GAS);

/** The refrigerant's boiling pressure at `celsius`, Pa. */
export const boilingPressure = celsius => ATMOSPHERE * Math.exp(-CLAPEYRON * (1 / (celsius + K) - 1 / (R410A.boiling + K)));
/** The temperature, °C, at which the refrigerant boils at `pascals`. */
export const boilingPoint = pascals => 1 / (1 / (R410A.boiling + K) - Math.log(pascals / ATMOSPHERE) / CLAPEYRON) - K;

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
function bisect(fn, lo, hi, steps = 40) {
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
  const low = boilingPressure(evaporating), high = boilingPressure(condensing);
  const suction = evaporating + DECLARED.superheat;
  const density = low * R410A.molar / (GAS * (suction + K));
  const ratio = high / low;
  const volumetric = clamp(1 - DECLARED.clearance * (ratio ** (1 / GAMMA) - 1), 0, 1);
  const swept = DECLARED.displacement * DECLARED.rpm / 60;
  const mass = volumetric * swept * density;
  const ideal = mass * R410A.gasHeat * (suction + K) * (ratio ** ((GAMMA - 1) / GAMMA) - 1);
  return {low, high, suction, density, ratio, volumetric, swept, mass, ideal, work: ideal / DECLARED.efficiency};
}

/**
 * What each kilogram of refrigerant carries out of the cold coil, J/kg: its
 * latent heat, less the part spent cooling the liquid from the condensing
 * temperature as it flashes through the expansion valve, plus the superheat it
 * picks up before it leaves.
 */
export const refrigeratingEffect = (evaporating, condensing) =>
  LATENT - R410A.liquidHeat * (condensing - evaporating) + R410A.gasHeat * DECLARED.superheat;

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
  const leavingC = DECLARED.contact * coil + bypass * enteringC;
  const saturated = saturatedRatio(coil);
  const leavingRatio = saturated < enteringRatio ? DECLARED.contact * saturated + bypass * enteringRatio : enteringRatio;
  const condensate = dryFlow * (enteringRatio - leavingRatio);
  const sensible = dryFlow * AIR.heat * (enteringC - leavingC);
  const latent = condensate * waterLatent(coil);
  // Mixing coil air with the air that slips past can land a shade above saturation; the model reads that as saturated.
  const leavingHumidity = Math.min(100, relativeHumidity(leavingC, leavingRatio));
  return {dryFlow, leavingC, leavingRatio, leavingHumidity, saturated, condensate, sensible, latent, total: sensible + latent};
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
    const celsius = previous.celsius + (leak - previous.cycle.air.sensible) * DECLARED.step / heatCapacity;
    const ratio = Math.max(0, previous.ratio - previous.cycle.air.condensate * DECLARED.step / waterCapacity);
    const t = step * DECLARED.step;
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
  const low = Math.floor(place), high = Math.min(low + 1, plan.track.length - 1), part = place - low;
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
  const cycle = plan.track[Math.min(plan.track.length - 1, Math.round(t / DECLARED.step))].cycle;
  return {time, t, started, done: t >= plan.duration, arrived: plan.reaches && t >= plan.reached, room, cycle, turn: t / DECLARED.lap};
}

export const sampleAircon = (input = {}, time = 0) => airconAt(airconPlan(input), time);

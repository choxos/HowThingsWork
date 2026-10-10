import {validateControls, validTime, clamp} from './physics-kit.js';

// Shared wire material data feed separate heater, kettle and dryer models.
// Material tables, electrical power and energy balances follow the cited sources.
// Dimensions, heat-transfer couplings and thermal responses are teaching assumptions
// documented with each lesson. Each model integrates its own finite heat capacities.

/** The Stefan-Boltzmann constant, W/(m²·K⁴), rounded from CODATA 2022 through NIST. */
export const SIGMA = 5.670374419e-8;
export const ZERO = 273.15;

/** Kanthal Nikrothal 80 wire, from its material datasheet. Resistivity in Ω·m, density in kg/m³, temperatures in °C. */
export const NIKROTHAL = Object.freeze({
  name: 'Nikrothal 80', chromium: Object.freeze([19.0, 21.0]), resistivity: 1.09e-6, resistivityAt: 20,
  density: 8300, melting: 1400, continuous: 1200, emissivity: 0.88,
  ctFrom: 100, ctStep: 100, ct: Object.freeze([1.01, 1.02, 1.03, 1.04, 1.05, 1.04, 1.04, 1.04, 1.04, 1.05, 1.06, 1.07]),
  thermalTemperatures: Object.freeze([20, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100]),
  heat: Object.freeze([460, 460, 480, 500, 520, 540, 560, 600, 630, 650, 670, 700]),
  conductivity: Object.freeze([15, 15, 15, 15, 17, 19, 21, 22, 24, 26, 28, 30]),
  expansion: Object.freeze([14.1, 14.9, 16.0, 17.2]), expansionTo: Object.freeze([250, 500, 750, 1000]),
});

/** The Draper point: the temperature above which almost every solid glows, from the Draper point and Incandescence pages. */
export const DRAPER = Object.freeze({celsius: 525, kelvin: 798, fahrenheit: 977, found: 1847});

/** What the Nichrome page gives, for comparison with the datasheet. */
export const NICHROME = Object.freeze({resistivity: 1.12e-6, spread: Object.freeze([1.0e-6, 1.5e-6]), copper: 16.78e-9, melting: 1400, density: 8300});

/** Mains electricity, from the Mains electricity page and IEC 60038. */
export const MAINS = Object.freeze({volts: 230, hertz: 50, americanVolts: 120, americanHertz: 60});

/** What the Kettle and Hair dryer pages give about these two appliances. */
export const RATED = Object.freeze({kettle: Object.freeze([2000, 3000]), kettleCurrent: 13, dryer: 2000, earlyDryer: 100});

/** Water, from the Properties of water page. */
export const WATER = Object.freeze({heat: 4184, heatAt: 20, vaporization: 2257e3, boiling: 100, density: 1000, steamHeat: 2080});

/** Dry air, from the Density of air and Table of specific heat capacities pages. */
export const AIR = Object.freeze({density: 1.2041, densityAt: 20, heat: 1012});

/** Not from a source, each said in the lessons' limits. */
export const DECLARED = Object.freeze({
  still: 15, reflected: 0.75, bare: 0.35,
  toWater: 400, toAir: 3, vesselLoss: 0.7, steamAt: 100, dryCutout: 220,
  step: 0.05, samples: 161, heaterRun: 120, heaterFaster: 8, kettleRun: 300,
});

/** Where a table that starts at `from` and steps by `step` stands at `celsius`, held flat past either end. */
export function tableAt(table, from, step, celsius) {
  const place = clamp((celsius - from) / step, 0, table.length - 1);
  const low = Math.floor(place), high = Math.min(low + 1, table.length - 1);
  return table[low] + (place - low) * (table[high] - table[low]);
}

/** The datasheet's temperature factor of resistivity at `celsius`, one below its first tabulated point. */
export const ctAt = celsius => celsius <= NIKROTHAL.ctFrom
  ? 1 + (NIKROTHAL.ct[0] - 1) * clamp((celsius - NIKROTHAL.resistivityAt) / (NIKROTHAL.ctFrom - NIKROTHAL.resistivityAt))
  : tableAt(NIKROTHAL.ct, NIKROTHAL.ctFrom, NIKROTHAL.ctStep, celsius);
function thermalAt(table, celsius) {
  const knots = NIKROTHAL.thermalTemperatures;
  if (celsius <= knots[0]) return table[0];
  for (let i = 1; i < knots.length; i++) {
    if (celsius <= knots[i]) return table[i - 1] + (table[i] - table[i - 1]) * (celsius - knots[i - 1]) / (knots[i] - knots[i - 1]);
  }
  return table.at(-1);
}
/** The datasheet's specific heat at `celsius`, J/(kg·K), held flat outside its table. */
export const specificAt = celsius => thermalAt(NIKROTHAL.heat, celsius);
/** The datasheet's thermal conductivity at `celsius`, W/(m·K). */
export const conductivityAt = celsius => thermalAt(NIKROTHAL.conductivity, celsius);

/** Internal energy per kilogram relative to 20 °C, integrating the same linear heat-capacity table. */
export function specificEnergyAt(celsius) {
  const knots = NIKROTHAL.thermalTemperatures, heat = NIKROTHAL.heat;
  if (celsius <= knots[0]) return (celsius - knots[0]) * heat[0];
  let energy = 0;
  for (let i = 1; i < knots.length; i++) {
    const end = Math.min(celsius, knots[i]);
    energy += (end - knots[i - 1]) * (heat[i - 1] + specificAt(end)) / 2;
    if (celsius <= knots[i]) return energy;
  }
  return energy + (celsius - knots.at(-1)) * heat.at(-1);
}

/** A piece of wire: its length and diameter in meters, and what follows from them. */
export function wireOf(length, diameter) {
  const area = Math.PI * (diameter / 2) ** 2;
  return {length, diameter, area, volume: area * length, mass: NIKROTHAL.density * area * length, surface: Math.PI * diameter * length};
}
/** Its resistance, Ω, at `celsius`. */
export const resistanceAt = (wire, celsius) => NIKROTHAL.resistivity * wire.length / wire.area * ctAt(celsius);
/** The power it turns into heat, W, across `volts` at `celsius`: Joule's law. */
export const powerAt = (wire, volts, celsius) => volts ** 2 / resistanceAt(wire, celsius);
/** The current through it, A. */
export const currentAt = (wire, volts, celsius) => volts / resistanceAt(wire, celsius);
/** Its heat capacity, J/K, at `celsius`. */
export const capacityAt = (wire, celsius) => wire.mass * specificAt(celsius);
/** What it radiates, W, at `celsius` into a room at `room`: Stefan and Boltzmann at the datasheet's emissivity. */
export const radiatedAt = (wire, celsius, room) => NIKROTHAL.emissivity * SIGMA * wire.surface * ((celsius + ZERO) ** 4 - (room + ZERO) ** 4);
/** What still air carries off it, W. */
export const convectedAt = (wire, celsius, room) => DECLARED.still * wire.surface * (celsius - room);

// ---------------------------------------------------------------------------
// Electric heating: a bar heater, its wire glowing behind a reflector.
// ---------------------------------------------------------------------------

export const HEATER_DEFAULTS = Object.freeze({volts: 230, length: 6, reflector: 1, room: 20});
export const HEATER_DOMAINS = Object.freeze({volts: Object.freeze([0, 240, 10]), length: Object.freeze([4, 12, 0.5]), reflector: Object.freeze([0, 1, 1]), room: Object.freeze([10, 30, 1])});
export const REFLECTORS = Object.freeze([Object.freeze({value: 0, label: 'No reflector'}), Object.freeze({value: 1, label: 'Polished reflector'})]);
/** The bar heater's wire: a declared 0.4 mm wire, its length the reader's. */
export const HEATER_DIAMETER = 0.0004;
/** Illustrative absorbing tile, not a measured material or a ray-traced view factor. */
export const HEATER_TILE = Object.freeze({capture: 0.1, capacity: 500, conductance: 1.5});

const heaterPlans = new Map();

export function heaterPlan(input = {}) {
  const values = validateControls(input, HEATER_DEFAULTS, HEATER_DOMAINS, 'electric heating');
  const key = JSON.stringify(values);
  if (heaterPlans.has(key)) return heaterPlans.get(key);
  const wire = wireOf(values.length, HEATER_DIAMETER);
  const cold = resistanceAt(wire, values.room), coldPower = powerAt(wire, values.volts, values.room);
  const share = values.reflector ? DECLARED.reflected : DECLARED.bare;
  // Integrate temperatures and energy transfers together so the two energy balances can be checked.
  const derivative = state => {
    const [celsius, tile] = state, power = powerAt(wire, values.volts, celsius);
    const radiated = radiatedAt(wire, celsius, values.room), convected = convectedAt(wire, celsius, values.room);
    const absorbed = radiated * share * HEATER_TILE.capture, released = HEATER_TILE.conductance * (tile - values.room);
    return [(power - radiated - convected) / capacityAt(wire, celsius), (absorbed - released) / HEATER_TILE.capacity, power, radiated, convected, absorbed, released];
  };
  const point = (t, state) => ({
    t, celsius: state[0], tile: state[1], inputEnergy: state[2], radiatedEnergy: state[3], convectedEnergy: state[4], tileReceivedEnergy: state[5], tileReleasedEnergy: state[6],
    power: powerAt(wire, values.volts, state[0]), radiated: radiatedAt(wire, state[0], values.room), convected: convectedAt(wire, state[0], values.room),
  });
  let state = [values.room, values.room, 0, 0, 0, 0, 0];
  const track = [point(0, state)], dt = DECLARED.step;
  for (let step = 1; step * DECLARED.step <= DECLARED.heaterRun + 1e-9; step++) {
    const k1 = derivative(state), k2 = derivative(state.map((v, i) => v + dt * k1[i] / 2));
    const k3 = derivative(state.map((v, i) => v + dt * k2[i] / 2)), k4 = derivative(state.map((v, i) => v + dt * k3[i]));
    state = state.map((v, i) => v + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
    track.push(point(step * dt, state));
  }
  const settled = track.at(-1);
  let lo = values.room, hi = NIKROTHAL.melting;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (powerAt(wire, values.volts, mid) > radiatedAt(wire, mid, values.room) + convectedAt(wire, mid, values.room)) lo = mid;
    else hi = mid;
  }
  const plan = {
    values, wire, cold, coldPower, track, settled, duration: DECLARED.heaterRun,
    equilibrium: (lo + hi) / 2,
    hot: resistanceAt(wire, settled.celsius),
    steady: settled.celsius, power: settled.power, radiated: settled.radiated, convected: settled.convected,
    forward: settled.radiated * share, share,
    radiantShare: settled.power > 0 ? settled.radiated / settled.power : 0,
    current: currentAt(wire, values.volts, settled.celsius),
    drift: coldPower > 0 ? settled.power / coldPower : 1,
    tooHot: settled.celsius > NIKROTHAL.continuous,
    glows: settled.celsius >= DRAPER.celsius,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1);
    return {t, celsius: heaterAt(plan, t).celsius};
  });
  if (heaterPlans.size >= 64) heaterPlans.clear();
  heaterPlans.set(key, plan);
  return plan;
}

/** The heater at a time in the run, read off its track between steps. */
export function heaterAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  const place = clamp(t / DECLARED.step, 0, plan.track.length - 1);
  const low = Math.floor(place), high = Math.min(low + 1, plan.track.length - 1), part = place - low;
  const between = key => plan.track[low][key] + part * (plan.track[high][key] - plan.track[low][key]);
  const celsius = between('celsius'), tile = between('tile'), on = t > 0 && plan.values.volts > 0;
  const power = on ? powerAt(plan.wire, plan.values.volts, celsius) : 0;
  const radiated = radiatedAt(plan.wire, celsius, plan.values.room), convected = convectedAt(plan.wire, celsius, plan.values.room);
  return {
    time, t, celsius, tile, on, power, radiated, convected, storedPower: power - radiated - convected,
    forward: radiated * plan.share, backward: radiated * (1 - plan.share),
    absorbed: radiated * plan.share * HEATER_TILE.capture,
    tileReleased: HEATER_TILE.conductance * (tile - plan.values.room),
    storedEnergy: plan.wire.mass * (specificEnergyAt(celsius) - specificEnergyAt(plan.values.room)),
    tileStoredEnergy: HEATER_TILE.capacity * (tile - plan.values.room),
    inputEnergy: between('inputEnergy'), radiatedEnergy: between('radiatedEnergy'), convectedEnergy: between('convectedEnergy'),
    tileReceivedEnergy: between('tileReceivedEnergy'), tileReleasedEnergy: between('tileReleasedEnergy'),
    resistance: resistanceAt(plan.wire, celsius),
    current: on ? currentAt(plan.wire, plan.values.volts, celsius) : 0,
    glows: celsius >= DRAPER.celsius, done: t >= plan.duration,
  };
}

export const sampleHeater = (input = {}, time = 0) => heaterAt(heaterPlan(input), time);

// ---------------------------------------------------------------------------
// Electric kettle: an insulated resistance wire inside an immersed metal sheath.
// ---------------------------------------------------------------------------

export const KETTLE_DEFAULTS = Object.freeze({volts: 230, mass: 1, start: 15, filled: 1});
export const KETTLE_DOMAINS = Object.freeze({volts: Object.freeze([0, 240, 10]), mass: Object.freeze([0.2, 1.7, 0.1]), start: Object.freeze([5, 40, 1]), filled: Object.freeze([0, 1, 1])});
export const FILLED = Object.freeze([Object.freeze({value: 0, label: 'Empty model'}), Object.freeze({value: 1, label: 'Water in the kettle'})]);
/** Declared 0.55 mm wire, 5.2 m long: about 2.22 kW at 230 V and 20 °C. */
export const KETTLE_WIRE = Object.freeze({length: 5.2, diameter: 0.00055});
/** OpenStax University Physics 2, sections 1.4–1.5; constant-property water at one atmosphere. */
export const KETTLE_WATER = Object.freeze({heat: 4186, vaporization: 2256e3, boiling: 100, density: 1000});
/** Illustrative thermal network, not measured timings or protection ratings for a real appliance. */
export const KETTLE_THERMAL = Object.freeze({
  room: 20, sheathCapacity: 30, wireToSheath: 12,
  toWater: 400, toAir: 3, vesselLoss: 0.7,
  sensorCapacity: 1, sensorLoss: 0.05, steamConductance: 2, steamFraction: 0.025,
  steamDelay: 2, steamTrip: 85, dryTrip: 220,
});

const kettlePlans = new Map();

export function kettlePlan(input = {}) {
  const values = validateControls(input, KETTLE_DEFAULTS, KETTLE_DOMAINS, 'electric kettle');
  const key = JSON.stringify(values);
  if (kettlePlans.has(key)) return kettlePlans.get(key);
  const wire = wireOf(KETTLE_WIRE.length, KETTLE_WIRE.diameter);
  const wet = values.filled === 1, K = KETTLE_THERMAL, W = KETTLE_WATER, room = K.room;
  const initial = wet ? values.start : room, rating = powerAt(wire, values.volts, initial);
  const needed = wet ? values.mass * W.heat * (W.boiling - initial) : 0;
  // Liquid energy is relative to its boiling point; latent energy stays spent after the liquid cools.
  let boiled = 0, on = values.volts > 0, switched = null, tripped = null, firstBoil = null, tripPoint = null;
  let duration = DECLARED.kettleRun;
  const waterAt = energy => {
    const vapor = Math.max(boiled, energy / W.vaporization, 0);
    return wet ? W.boiling + Math.min(0, energy - vapor * W.vaporization) / ((values.mass - vapor) * W.heat) : room;
  };
  const derivative = (state, steamSupply, energized) => {
    const [celsius, sheath, energy, sensor] = state, water = waterAt(energy);
    const power = energized ? powerAt(wire, values.volts, celsius) : 0;
    const throughSheath = K.wireToSheath * (celsius - sheath);
    const carried = (wet ? K.toWater : K.toAir) * (sheath - (wet ? water : room));
    const lost = wet ? K.vesselLoss * (water - room) : carried;
    const sensorHeat = Math.min(steamSupply, Math.max(0, K.steamConductance * (W.boiling - sensor)));
    const sensorLoss = K.sensorLoss * (sensor - room);
    return [(power - throughSheath) / capacityAt(wire, celsius), (throughSheath - carried) / K.sheathCapacity,
      wet ? carried - lost : 0, (sensorHeat - sensorLoss) / K.sensorCapacity, power, wet ? carried : 0, lost, sensorHeat, sensorLoss];
  };
  const integrate = (state, dt, supply, energized) => {
    const k1 = derivative(state, supply, energized), k2 = derivative(state.map((v, i) => v + dt * k1[i] / 2), supply, energized);
    const k3 = derivative(state.map((v, i) => v + dt * k2[i] / 2), supply, energized), k4 = derivative(state.map((v, i) => v + dt * k3[i]), supply, energized);
    return state.map((v, i) => v + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
  };
  const point = (t, state) => ({
    t, celsius: state[0], sheath: state[1], waterEnergy: state[2], water: waterAt(state[2]), sensor: state[3], boiled,
    inputEnergy: state[4], toWaterEnergy: state[5], roomEnergy: state[6], sensorReceivedEnergy: state[7], sensorLostEnergy: state[8],
  });
  let state = [initial, initial, -needed, room, 0, 0, 0, 0, 0];
  const track = [point(0, state)], dt = DECLARED.step;
  const vaporAt = time => {
    const place = clamp(time / dt, 0, track.length - 1), lo = Math.floor(place), hi = Math.min(lo + 1, track.length - 1);
    return track[lo].boiled + (place - lo) * (track[hi].boiled - track[lo].boiled);
  };
  for (let step = 1; step * dt <= duration + 1e-9; step++) {
    const t = step * dt, previous = state;
    const supply = K.steamFraction * W.vaporization * (vaporAt(t - K.steamDelay) - vaporAt(t - dt - K.steamDelay)) / dt;
    state = integrate(previous, dt, supply, on);
    const sensorIndex = wet ? 3 : 1, threshold = wet ? K.steamTrip : K.dryTrip;
    if (on && state[sensorIndex] >= threshold) {
      let lo = 0, hi = dt;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (integrate(previous, mid, supply, true)[sensorIndex] < threshold) lo = mid; else hi = mid;
      }
      const elapsed = (lo + hi) / 2, end = t - dt + elapsed;
      const atTrip = integrate(previous, elapsed, supply, true);
      if (wet) switched = end; else tripped = end;
      boiled = wet ? Math.max(boiled, atTrip[2] / W.vaporization, 0) : 0;
      tripPoint = point(end, atTrip);
      on = false;
      state = integrate(atTrip, dt - elapsed, supply, false);
      duration = Math.min(DECLARED.kettleRun, Math.max(15, Math.ceil((end + 8) / 5) * 5));
    }
    if (wet && firstBoil === null && state[2] >= 0) firstBoil = t - dt + dt * -previous[2] / (state[2] - previous[2]);
    boiled = wet ? Math.max(boiled, state[2] / W.vaporization, 0) : 0;
    track.push(point(t, state));
  }
  const settled = track.at(-1);
  const plan = {
    values, wire, wet, room, initial, water: wet ? values.mass : 0, rating, track, settled, switched, tripped, firstBoil, tripPoint, duration,
    resistance: resistanceAt(wire, initial), current: currentAt(wire, values.volts, initial), needed,
    boils: firstBoil !== null,
    trips: tripped !== null,
    boiled: settled.boiled,
    withinRating: rating >= RATED.kettle[0] && rating <= RATED.kettle[1],
    withinCurrent: currentAt(wire, values.volts, initial) <= RATED.kettleCurrent,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1), now = kettleAt(plan, t);
    return {t, water: now.water, celsius: now.celsius, sheath: now.sheath, sensor: now.sensor};
  });
  if (kettlePlans.size >= 8) kettlePlans.delete(kettlePlans.keys().next().value);
  kettlePlans.set(key, plan);
  return plan;
}

/** The kettle at a time in the run. */
export function kettleAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  const place = clamp(t / DECLARED.step, 0, plan.track.length - 1);
  let low = plan.track[Math.floor(place)], high = plan.track[Math.min(Math.floor(place) + 1, plan.track.length - 1)];
  if (plan.tripPoint && low.t <= plan.tripPoint.t && high.t >= plan.tripPoint.t) {
    if (t < plan.tripPoint.t) high = plan.tripPoint; else low = plan.tripPoint;
  }
  const fraction = high.t > low.t ? (t - low.t) / (high.t - low.t) : 0;
  const between = key => low[key] + fraction * (high[key] - low[key]);
  const celsius = between('celsius'), sheath = between('sheath'), sensor = between('sensor'), boiled = between('boiled');
  const waterEnergy = between('waterEnergy'), W = KETTLE_WATER, K = KETTLE_THERMAL;
  const water = plan.wet ? W.boiling + Math.min(0, waterEnergy - boiled * W.vaporization) / ((plan.values.mass - boiled) * W.heat) : plan.room;
  const switched = plan.switched !== null && t >= plan.switched, tripped = plan.tripped !== null && t >= plan.tripped;
  const on = t > 0 && plan.values.volts > 0 && !switched && !tripped;
  const carried = (plan.wet ? K.toWater : K.toAir) * (sheath - (plan.wet ? water : plan.room));
  const vesselLoss = plan.wet ? K.vesselLoss * (water - plan.room) : 0;
  const boiling = plan.wet && water >= W.boiling - 1e-9 && carried > vesselLoss;
  return {
    time, t, celsius, sheath, water, sensor, boiled, on, boiling, switched, tripped,
    liquidMass: plan.wet ? plan.values.mass - boiled : 0, vaporRate: boiling ? (carried - vesselLoss) / W.vaporization : 0,
    storedEnergy: plan.wire.mass * (specificEnergyAt(celsius) - specificEnergyAt(plan.initial)),
    sheathEnergy: K.sheathCapacity * (sheath - plan.initial), waterEnergy: plan.wet ? waterEnergy + plan.needed : 0,
    sensorEnergy: K.sensorCapacity * (sensor - plan.room),
    inputEnergy: between('inputEnergy'), toWaterEnergy: between('toWaterEnergy'), roomEnergy: between('roomEnergy'),
    sensorReceivedEnergy: between('sensorReceivedEnergy'), sensorLostEnergy: between('sensorLostEnergy'),
    power: on ? powerAt(plan.wire, plan.values.volts, celsius) : 0,
    current: on ? currentAt(plan.wire, plan.values.volts, celsius) : 0,
    done: t >= plan.duration,
  };
}

export const sampleKettle = (input = {}, time = 0) => kettleAt(kettlePlan(input), time);

// ---------------------------------------------------------------------------
// Hair dryer: independently controlled fan and heater, a heated bimetal sensor,
// and a small wet test lock in the outlet stream.
// ---------------------------------------------------------------------------

export const DRYER_DEFAULTS = Object.freeze({volts: 230, airflow: 35, room: 20, blocked: 0});
export const DRYER_DOMAINS = Object.freeze({volts: Object.freeze([0, 240, 10]), airflow: Object.freeze([20, 45, 1]), room: Object.freeze([10, 30, 1]), blocked: Object.freeze([0, 1, 1])});
export const BLOCKED = Object.freeze([Object.freeze({value: 0, label: 'Inlet clear'}), Object.freeze({value: 1, label: 'Inlet blocked'})]);
/** The dryer's element: a declared 0.4 mm wire 3.05 m long, which makes it about a 2 kW element on 230 V. */
export const DRYER_WIRE = Object.freeze({length: 3.05, diameter: 0.0004});

/** Constant-property, one-atmosphere air approximation; NASA's calorically perfect air values. */
export const DRYER_AIR = Object.freeze({pressure: 101325, gasConstant: 287, heat: 1004.5});
/** Illustrative couplings and test-lock properties, not an appliance calibration. */
export const DRYER_THERMAL = Object.freeze({
  step: 0.005, run: 30, spinUp: 1, coefficient: 4300, referenceFlow: 35,
  sensorCapacity: 0.8, sensorWire: 0.5, sensorStill: 0.05, sensorAir: 1.5, open: 120, close: 90,
  hairCapacity: 4, hairWater: 0.00035, waterHeat: 4186, latent: 2430e3,
  hairConductance: 1.8, vaporExchange: 0.00085, humidity: 0.5, vaporGasConstant: 461.5,
});
/** OpenStax Table 13.5, Pa; linear interpolation is a teaching approximation. */
export const VAPOR_PRESSURE = Object.freeze([
  [0, 610], [5, 868], [10, 1190], [15, 1690], [20, 2330], [25, 3170], [30, 4240],
  [37, 6310], [40, 7340], [50, 12300], [60, 19900], [70, 31200], [80, 47300],
  [90, 70100], [95, 85900], [100, 101000], [120, 199000],
].map(Object.freeze));

export function saturationPressure(celsius) {
  if (celsius <= VAPOR_PRESSURE[0][0]) return VAPOR_PRESSURE[0][1];
  for (let i = 1; i < VAPOR_PRESSURE.length; i++) {
    const [a, pa] = VAPOR_PRESSURE[i - 1], [b, pb] = VAPOR_PRESSURE[i];
    if (celsius <= b) return pa + (pb - pa) * (celsius - a) / (b - a);
  }
  return VAPOR_PRESSURE.at(-1)[1];
}

/** How readily the wire gives its heat to the air stream, W/K: in proportion to the square root of the airflow. */
export const dryerConductance = (wire, airflow) => DRYER_THERMAL.coefficient * wire.surface * Math.sqrt(Math.max(0, airflow) / DRYER_THERMAL.referenceFlow);

function dryerRates(plan, time, state, closed, wet) {
  const D = DRYER_THERMAL, A = DRYER_AIR, {values: v, wire} = plan;
  const [celsius, sensor, hair] = state;
  const fan = clamp(time / D.spinUp), flow = v.blocked ? 0 : v.airflow * fan;
  const massFlow = A.pressure / (A.gasConstant * (v.room + ZERO)) * flow / 1000;
  const capacityFlow = massFlow * A.heat, conductance = dryerConductance(wire, flow);
  // Integrating dT_air/dx along an isothermal wire keeps the outlet below the wire, even as flow tends to zero.
  const effectiveness = capacityFlow > 0 ? -Math.expm1(-conductance / capacityFlow) : 0;
  const outlet = v.room + effectiveness * (celsius - v.room);
  const toAir = capacityFlow * (outlet - v.room);
  const toSensor = D.sensorWire * (celsius - sensor);
  const sensorLoss = (D.sensorStill + D.sensorAir * Math.sqrt(flow / D.referenceFlow)) * (sensor - v.room);
  const ambient = radiatedAt(wire, celsius, v.room) + convectedAt(wire, celsius, v.room);
  const exposure = Math.sqrt(flow / D.referenceFlow);
  const toHair = D.hairConductance * exposure * (outlet - hair);
  const vaporDifference = Math.max(0, saturationPressure(hair) - D.humidity * saturationPressure(v.room));
  const evaporation = wet ? D.vaporExchange * exposure * vaporDifference / (D.vaporGasConstant * (hair + ZERO)) : 0;
  const power = closed ? powerAt(wire, v.volts, celsius) : 0;
  return {fan, flow, massFlow, conductance, effectiveness, outlet, toAir, toSensor, sensorLoss, ambient, toHair, evaporation, power};
}

const dryerPlans = new Map();

export function dryerPlan(input = {}) {
  const values = validateControls(input, DRYER_DEFAULTS, DRYER_DOMAINS, 'hair dryer');
  const key = JSON.stringify(values);
  if (dryerPlans.has(key)) return dryerPlans.get(key);
  const wire = wireOf(DRYER_WIRE.length, DRYER_WIRE.diameter);
  const D = DRYER_THERMAL;
  const plan = {values, wire, duration: D.run, rating: powerAt(wire, values.volts, values.room), blocked: values.blocked === 1, events: [], driedAt: null};
  let state = [values.room, values.room, values.room, D.hairWater, 0, 0, 0, 0, 0, 0, 0, 0], closed = true, wet = true;
  const derivative = (time, state) => {
    const q = dryerRates(plan, time, state, closed, wet);
    return [
      (q.power - q.toAir - q.ambient - q.toSensor) / capacityAt(wire, state[0]),
      (q.toSensor - q.sensorLoss) / D.sensorCapacity,
      (q.toHair - D.latent * q.evaporation) / (D.hairCapacity + Math.max(0, state[3]) * D.waterHeat),
      -q.evaporation, q.power, q.toAir, q.ambient + q.sensorLoss, q.toSensor, q.sensorLoss,
      q.toHair, D.latent * q.evaporation, D.waterHeat * (state[2] - values.room) * q.evaporation,
    ];
  };
  const integrate = (time, state, dt) => {
    const k1 = derivative(time, state), k2 = derivative(time + dt / 2, state.map((v, i) => v + dt * k1[i] / 2));
    const k3 = derivative(time + dt / 2, state.map((v, i) => v + dt * k2[i] / 2));
    const k4 = derivative(time + dt, state.map((v, i) => v + dt * k3[i]));
    return state.map((v, i) => v + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
  };
  const track = [{t: 0, state: [...state], closed}];
  for (let step = 1; step <= Math.round(D.run / D.step); step++) {
    const end = step * D.step;
    let time = (step - 1) * D.step;
    while (time < end - 1e-12) {
      const dt = end - time, next = integrate(time, state, dt);
      const crossing = [
        {kind: 'switch', reached: s => closed ? s[1] >= D.open : s[1] <= D.close},
        {kind: 'dry', reached: s => wet && s[3] <= 0},
      ].filter(event => event.reached(next));
      if (!crossing.length) { state = next; time = end; break; }
      for (const event of crossing) {
        let lo = 0, hi = dt;
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (event.reached(integrate(time, state, mid))) hi = mid; else lo = mid;
        }
        event.dt = hi;
      }
      const event = crossing.sort((a, b) => a.dt - b.dt)[0];
      state = integrate(time, state, event.dt); time += event.dt;
      if (event.kind === 'switch') {
        closed = !closed;
        plan.events.push({t: time, closed, sensor: state[1], celsius: state[0]});
      } else { state[3] = 0; wet = false; plan.driedAt = time; }
      track.push({t: time, state: [...state], closed});
    }
    if (track.at(-1).t < end - 1e-12) track.push({t: end, state: [...state], closed});
  }
  plan.track = track;
  plan.settled = dryerAt(plan, D.run);
  plan.opened = plan.events.find(event => !event.closed)?.t ?? null;
  plan.closed = plan.events.find(event => event.closed)?.t ?? null;
  plan.cycles = plan.closed !== null;
  plan.steady = plan.settled.celsius; plan.outlet = plan.settled.outlet; plan.power = plan.settled.power;
  plan.massFlow = plan.settled.massFlow; plan.resistance = resistanceAt(wire, values.room);
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1), now = dryerAt(plan, t);
    return {t, celsius: now.celsius, outlet: now.outlet, hair: now.hair, water: now.water};
  });
  if (dryerPlans.size >= 8) dryerPlans.clear();
  dryerPlans.set(key, plan);
  return plan;
}

/** The dryer at a time in the run. */
export function dryerAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  let low = 0, high = plan.track.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (plan.track[mid].t <= t) low = mid; else high = mid; }
  if (plan.track[high].t <= t) low = high;
  const a = plan.track[low], b = plan.track[Math.min(low + 1, plan.track.length - 1)];
  const share = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  const state = a.state.map((value, i) => value + share * (b.state[i] - value));
  const D = DRYER_THERMAL, [celsius, sensor, hair, water] = state;
  const closed = a.closed, on = t > 0 && closed && plan.values.volts > 0;
  const q = dryerRates(plan, t, state, on, water > 0);
  return {
    time, t, celsius, sensor, hair, water, closed, on, motorOn: t > 0, ...q,
    current: on ? currentAt(plan.wire, plan.values.volts, celsius) : 0,
    evaporated: D.hairWater - water, dry: water === 0,
    storedEnergy: plan.wire.mass * (specificEnergyAt(celsius) - specificEnergyAt(plan.values.room)),
    sensorEnergy: D.sensorCapacity * (sensor - plan.values.room),
    hairEnergy: (D.hairCapacity + water * D.waterHeat) * (hair - plan.values.room),
    inputEnergy: state[4], airEnergy: state[5], ambientEnergy: state[6], sensorReceivedEnergy: state[7], sensorLostEnergy: state[8],
    hairReceivedEnergy: state[9], evaporationEnergy: state[10], vaporSensibleEnergy: state[11],
    rise: q.outlet - plan.values.room,
    done: t >= plan.duration,
  };
}

export const sampleDryer = (input = {}, time = 0) => dryerAt(dryerPlan(input), time);

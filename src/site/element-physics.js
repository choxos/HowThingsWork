import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// The resistance element: one piece of nickel chromium wire, and the three
// machines that ask different things of it. An electric heater lets it glow and
// radiate; an electric kettle drowns it in water and switches off when the
// water boils; a hair dryer blows air past it and cuts the power if the air
// stops. All three are the same wire obeying the same two laws: the power it
// turns into heat, and where that heat goes.
//
// Exact within the model: the wire's resistance from its resistivity, length
// and section, raised by the temperature factor its datasheet tabulates; the
// power V squared over that resistance; the wire's own heat capacity from its
// density, volume and the specific heat its datasheet tabulates; radiation by
// Stefan and Boltzmann at the datasheet's emissivity for fully oxidized wire;
// the air's temperature rise, the power over its mass flow times its heat
// capacity; the water's rise, the energy over its mass times its heat capacity,
// and the water boiled away, the energy over the heat of vaporization; and
// every one of those integrated step by step through the run.
//
// Sourced: Kanthal's Nikrothal 80 datasheet for the wire, its resistivity of
// 1.09 ohm mm squared per meter at 20 °C, its density of 8.30 g/cm3, its
// temperature factor of resistivity from 100 to 1200 °C, its specific heat from
// 20 to 1100 °C, its melting point of 1400 °C, the 1200 °C it may run at
// continuously in air, and its emissivity of 0.88 fully oxidized; the Nichrome
// page for the chromium oxide skin that keeps it from burning up; the Joule
// heating page for P = V squared over R; mains electricity at 230 V and 50 Hz
// or 120 V and 60 Hz; the Kettle page for an element of 2 to 3 kW drawing up to
// 13 A; the Hair dryer page for a dryer of up to 2,000 W and its bare coiled
// nichrome wire on mica; the Thermal cutoff page for a thermal switch that
// opens hot and closes again as it cools, against a thermal fuse that never
// does; water's heat capacity and heat of vaporization; dry air's density and
// heat capacity; the Draper point of 525 °C, above which almost every solid
// glows; and the Stefan-Boltzmann constant from NIST.
//
// Not from a source, each said in the lessons' limits: every dimension of every
// element, and the reflector, vessel and duct around it; a room that never
// warms; still air carrying 15 W from each square meter of wire for each degree
// it stands above the room, and the reflector sending a declared share of the
// radiation forward instead of behind; a kettle whose element passes 400 W per
// degree to water and only 3 W per degree to air, whose vessel loses 0.7 W per
// degree to the room, and whose steam switch opens the moment the water
// reaches boiling; a dryer whose wire passes heat to its air stream in
// proportion to the square root of the airflow, and whose thermal switch opens
// at 200 °C and closes again at 160 °C; and a fan that reaches its speed in one
// second, with the element interlocked so that it is not let on until it has;
// and a heater run of 120 s, long enough that even the coolest element in its
// range has settled by the end of it, played 8 times faster than the real thing.
// The dryer is marched in steps of 2 ms rather than the 50 ms the other two use,
// because its wire gains tens of degrees in 50 ms and its switch could not
// otherwise be said to open at any particular temperature.
// ---------------------------------------------------------------------------

/** The Stefan-Boltzmann constant, W/(m²·K⁴), CODATA 2022 through NIST: exact. */
export const SIGMA = 5.670374419e-8;
export const ZERO = 273.15;

/** Kanthal Nikrothal 80 wire, from its material datasheet. Resistivity in Ω·m, density in kg/m³, temperatures in °C. */
export const NIKROTHAL = Object.freeze({
  name: 'Nikrothal 80', chromium: Object.freeze([19.0, 21.0]), resistivity: 1.09e-6, resistivityAt: 20,
  density: 8300, melting: 1400, continuous: 1200, emissivity: 0.88,
  ctFrom: 100, ctStep: 100, ct: Object.freeze([1.01, 1.02, 1.03, 1.04, 1.05, 1.04, 1.04, 1.04, 1.04, 1.05, 1.06, 1.07]),
  heatFrom: 20, heatStep: 100, heat: Object.freeze([460, 460, 480, 500, 520, 540, 560, 600, 630, 650, 670, 700]),
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
  dryerCoefficient: 4300, dryerFlow: 0.035, spinUp: 1,
  dryerOpen: 200, dryerClose: 160,
  step: 0.05, dryerStep: 0.002, samples: 161, heaterRun: 120, heaterFaster: 8, kettleRun: 300, dryerRun: 30,
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
/** The datasheet's specific heat at `celsius`, J/(kg·K). */
export const specificAt = celsius => tableAt(NIKROTHAL.heat, NIKROTHAL.heatFrom, NIKROTHAL.heatStep, celsius);
/** The datasheet's thermal conductivity at `celsius`, W/(m·K). */
export const conductivityAt = celsius => tableAt(NIKROTHAL.conductivity, NIKROTHAL.heatFrom, NIKROTHAL.heatStep, celsius);

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

const heaterPlans = new Map();

export function heaterPlan(input = {}) {
  const values = validateControls(input, HEATER_DEFAULTS, HEATER_DOMAINS, 'electric heating');
  const key = JSON.stringify(values);
  if (heaterPlans.has(key)) return heaterPlans.get(key);
  const wire = wireOf(values.length, HEATER_DIAMETER);
  const cold = resistanceAt(wire, values.room), coldPower = powerAt(wire, values.volts, values.room);
  // Warm the wire step by step until what it loses matches what it takes.
  const track = [{t: 0, celsius: values.room, power: coldPower, radiated: 0, convected: 0}];
  let celsius = values.room;
  for (let step = 1; step * DECLARED.step <= DECLARED.heaterRun + 1e-9; step++) {
    const previous = track[step - 1];
    celsius += (previous.power - previous.radiated - previous.convected) * DECLARED.step / capacityAt(wire, previous.celsius);
    celsius = Math.min(celsius, NIKROTHAL.melting);
    track.push({
      t: step * DECLARED.step, celsius,
      power: powerAt(wire, values.volts, celsius),
      radiated: radiatedAt(wire, celsius, values.room),
      convected: convectedAt(wire, celsius, values.room),
    });
  }
  const settled = track.at(-1);
  const share = values.reflector ? DECLARED.reflected : DECLARED.bare;
  const plan = {
    values, wire, cold, coldPower, track, settled, duration: DECLARED.heaterRun,
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
  const celsius = between('celsius');
  return {
    time, t, celsius, power: between('power'), radiated: between('radiated'), convected: between('convected'),
    forward: between('radiated') * plan.share,
    resistance: resistanceAt(plan.wire, celsius),
    current: currentAt(plan.wire, plan.values.volts, celsius),
    glows: celsius >= DRAPER.celsius, done: t >= plan.duration,
  };
}

export const sampleHeater = (input = {}, time = 0) => heaterAt(heaterPlan(input), time);

// ---------------------------------------------------------------------------
// Electric kettle: the same wire, sheathed and drowned in water.
// ---------------------------------------------------------------------------

export const KETTLE_DEFAULTS = Object.freeze({volts: 230, mass: 1, start: 15, filled: 1});
export const KETTLE_DOMAINS = Object.freeze({volts: Object.freeze([0, 240, 10]), mass: Object.freeze([0.2, 1.7, 0.1]), start: Object.freeze([5, 40, 1]), filled: Object.freeze([0, 1, 1])});
export const FILLED = Object.freeze([Object.freeze({value: 0, label: 'Switched on empty'}), Object.freeze({value: 1, label: 'Water in the kettle'})]);
/** The kettle's element: a declared 0.55 mm wire 5.2 m long, which makes it a 2.4 kW element on 230 V. */
export const KETTLE_WIRE = Object.freeze({length: 5.2, diameter: 0.00055});

const kettlePlans = new Map();

export function kettlePlan(input = {}) {
  const values = validateControls(input, KETTLE_DEFAULTS, KETTLE_DOMAINS, 'electric kettle');
  const key = JSON.stringify(values);
  if (kettlePlans.has(key)) return kettlePlans.get(key);
  const wire = wireOf(KETTLE_WIRE.length, KETTLE_WIRE.diameter);
  const wet = values.filled === 1, room = values.start;
  const rating = powerAt(wire, values.volts, values.start);
  // Wet, the element passes its heat to the water far faster than it can store
  // any, so it settles a few degrees above the water and the water is the only
  // thing with inertia worth integrating. Dry, it has nothing to pass its heat
  // to, so its own small heat capacity is what runs away.
  const elementOver = waterC => {
    let celsius = waterC + rating / DECLARED.toWater;
    for (let i = 0; i < 3; i++) celsius = waterC + powerAt(wire, values.volts, celsius) / DECLARED.toWater;
    return celsius;
  };
  const track = [];
  let waterC = values.start, celsius = wet ? elementOver(values.start) : values.start;
  let boiled = 0, on = true, switched = null, tripped = null;
  track.push({t: 0, celsius, water: waterC, power: powerAt(wire, values.volts, celsius), on: true, boiled: 0});
  for (let step = 1; step * DECLARED.step <= DECLARED.kettleRun + 1e-9; step++) {
    const previous = track[step - 1], t = step * DECLARED.step;
    const power = on ? powerAt(wire, values.volts, previous.celsius) : 0;
    if (wet) {
      const lost = DECLARED.vesselLoss * (previous.water - room);
      if (previous.water < WATER.boiling - 1e-9) {
        waterC = Math.min(WATER.boiling, previous.water + (power - lost) * DECLARED.step / (values.mass * WATER.heat));
      } else {
        waterC = WATER.boiling;
        boiled = previous.boiled + Math.max(0, power - lost) * DECLARED.step / WATER.vaporization;
      }
      if (waterC >= WATER.boiling - 1e-9 && switched === null) switched = t;
      if (switched !== null) on = false;
      celsius = on ? elementOver(waterC) : waterC;
    } else {
      const carried = DECLARED.toAir * (previous.celsius - room);
      celsius = previous.celsius + (power - carried) * DECLARED.step / capacityAt(wire, previous.celsius);
      if (on && celsius >= DECLARED.dryCutout) { on = false; tripped = t; }
    }
    track.push({t, celsius, water: wet ? waterC : room, power: on ? powerAt(wire, values.volts, celsius) : 0, on, boiled});
    if ((switched ?? tripped) !== null && t > (switched ?? tripped) + 5 - 1e-9) break;
  }
  const settled = track.at(-1);
  const ends = switched ?? tripped;
  const duration = ends === null ? DECLARED.kettleRun : Math.min(DECLARED.kettleRun, Math.max(10, Math.ceil((ends + 4) / 5) * 5));
  const plan = {
    values, wire, wet, room, water: wet ? values.mass : 0, rating, track, settled, switched, tripped, duration,
    resistance: resistanceAt(wire, values.start),
    current: currentAt(wire, values.volts, values.start),
    needed: wet ? values.mass * WATER.heat * (WATER.boiling - values.start) : 0,
    boils: switched !== null,
    trips: tripped !== null,
    boiled: settled.boiled,
    withinRating: rating >= RATED.kettle[0] && rating <= RATED.kettle[1],
    withinCurrent: currentAt(wire, values.volts, values.start) <= RATED.kettleCurrent,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1), now = kettleAt(plan, t);
    return {t, water: now.water, celsius: now.celsius};
  });
  if (kettlePlans.size >= 64) kettlePlans.clear();
  kettlePlans.set(key, plan);
  return plan;
}

/** The kettle at a time in the run. */
export function kettleAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  const place = clamp(t / DECLARED.step, 0, plan.track.length - 1);
  const low = Math.floor(place), high = Math.min(low + 1, plan.track.length - 1), part = place - low;
  const between = key => plan.track[low][key] + part * (plan.track[high][key] - plan.track[low][key]);
  const celsius = between('celsius'), water = between('water');
  const on = plan.track[low].on && plan.track[high].on;
  return {
    time, t, celsius, water, boiled: between('boiled'), on,
    power: on ? powerAt(plan.wire, plan.values.volts, celsius) : 0,
    current: on ? currentAt(plan.wire, plan.values.volts, celsius) : 0,
    boiling: plan.wet && water >= WATER.boiling - 1e-9,
    switched: plan.switched !== null && t >= plan.switched,
    tripped: plan.tripped !== null && t >= plan.tripped,
    done: t >= plan.duration,
  };
}

export const sampleKettle = (input = {}, time = 0) => kettleAt(kettlePlan(input), time);

// ---------------------------------------------------------------------------
// Hair dryer: the same wire again, with a fan behind it and a switch that opens
// when the air stops.
// ---------------------------------------------------------------------------

export const DRYER_DEFAULTS = Object.freeze({volts: 230, airflow: 35, room: 20, blocked: 0});
export const DRYER_DOMAINS = Object.freeze({volts: Object.freeze([0, 240, 10]), airflow: Object.freeze([20, 45, 1]), room: Object.freeze([10, 30, 1]), blocked: Object.freeze([0, 1, 1])});
export const BLOCKED = Object.freeze([Object.freeze({value: 0, label: 'Inlet clear'}), Object.freeze({value: 1, label: 'Inlet blocked'})]);
/** The dryer's element: a declared 0.4 mm wire 3.05 m long, which makes it about a 2 kW element on 230 V. */
export const DRYER_WIRE = Object.freeze({length: 3.05, diameter: 0.0004});

/** How readily the wire gives its heat to the air stream, W/K: in proportion to the square root of the airflow. */
export const dryerConductance = (wire, airflow) => DECLARED.dryerCoefficient * wire.surface * Math.sqrt(Math.max(0, airflow) / (DECLARED.dryerFlow * 1000));

const dryerPlans = new Map();

export function dryerPlan(input = {}) {
  const values = validateControls(input, DRYER_DEFAULTS, DRYER_DOMAINS, 'hair dryer');
  const key = JSON.stringify(values);
  if (dryerPlans.has(key)) return dryerPlans.get(key);
  const wire = wireOf(DRYER_WIRE.length, DRYER_WIRE.diameter);
  const rating = powerAt(wire, values.volts, values.room);
  const blocked = values.blocked === 1;
  const track = [{t: 0, celsius: values.room, outlet: values.room, power: rating, on: true, flow: 0}];
  let celsius = values.room, on = true, opened = null, closed = null;
  for (let step = 1; step * DECLARED.dryerStep <= DECLARED.dryerRun + 1e-9; step++) {
    const previous = track[step - 1];
    const t = step * DECLARED.dryerStep;
    // The fan leads the heater: the element is not let on until the fan is up to
    // speed, which is why a dryer that cannot draw air trips its switch instead.
    const flow = blocked ? 0 : values.airflow * clamp(t / DECLARED.spinUp);
    const running = t >= DECLARED.spinUp;
    const conductance = dryerConductance(wire, flow);
    const still = DECLARED.still * wire.surface;
    const total = conductance + still;
    const power = on && running ? powerAt(wire, values.volts, previous.celsius) : 0;
    const carried = total * (previous.celsius - values.room);
    celsius = previous.celsius + (power - carried) * DECLARED.dryerStep / capacityAt(wire, previous.celsius);
    if (running && on && celsius >= DECLARED.dryerOpen) { on = false; if (opened === null) opened = t; }
    else if (running && !on && celsius <= DECLARED.dryerClose) { on = true; if (closed === null) closed = t; }
    const massFlow = AIR.density * flow / 1000;
    const delivered = conductance * (celsius - values.room);
    track.push({
      t, celsius, on, flow,
      power: on && running ? powerAt(wire, values.volts, celsius) : 0,
      outlet: massFlow > 0 ? values.room + delivered / (massFlow * AIR.heat) : celsius,
    });
  }
  const settled = track.at(-1);
  const plan = {
    values, wire, rating, blocked, track, settled, duration: DECLARED.dryerRun,
    resistance: resistanceAt(wire, values.room),
    current: currentAt(wire, values.volts, values.room),
    massFlow: AIR.density * values.airflow / 1000,
    idealRise: values.airflow > 0 ? rating / (AIR.density * values.airflow / 1000 * AIR.heat) : null,
    conductance: dryerConductance(wire, values.airflow),
    opened, closed, cycles: opened !== null,
    steady: settled.celsius, outlet: settled.outlet, power: settled.power,
    withinRating: rating <= RATED.dryer * 1.1,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1), now = dryerAt(plan, t);
    return {t, celsius: now.celsius, outlet: now.outlet};
  });
  if (dryerPlans.size >= 64) dryerPlans.clear();
  dryerPlans.set(key, plan);
  return plan;
}

/** The dryer at a time in the run. */
export function dryerAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  const place = clamp(t / DECLARED.dryerStep, 0, plan.track.length - 1);
  const low = Math.floor(place), high = Math.min(low + 1, plan.track.length - 1), part = place - low;
  const between = key => plan.track[low][key] + part * (plan.track[high][key] - plan.track[low][key]);
  const celsius = between('celsius'), on = plan.track[low].on && plan.track[high].on;
  return {
    time, t, celsius, outlet: between('outlet'), flow: between('flow'), on,
    power: on ? powerAt(plan.wire, plan.values.volts, celsius) : 0,
    current: on ? currentAt(plan.wire, plan.values.volts, celsius) : 0,
    rise: between('outlet') - plan.values.room,
    done: t >= plan.duration,
  };
}

export const sampleDryer = (input = {}, time = 0) => dryerAt(dryerPlan(input), time);

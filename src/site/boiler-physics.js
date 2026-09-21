import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Gas boiler: a tankless gas water heater that fires only while the hot tap
// runs, holds the water it sends out at the temperature the knob asks for, and
// carries the steam its flame makes out through the flue.
//
// The numbers are the Ideal Vogue C26 combination boiler's, from its
// Installation and Servicing book: 26.0 kW of hot water output for 29.0 kW
// gross in, 10.6 L/min at a 35 °C rise, 2.695 m³/h of gas at a gross calorific
// value of 38.7 MJ/m³, firing down to 3.7 kW, running down to 2 L/min drawn
// off, a hot water temperature limited to 65 °C, 0.5 L of water inside, and a
// flue at 73 °C carrying 11 g/s. The chemistry is methane's from the Heat of
// combustion and Methane pages, dry air's from the Atmosphere of Earth and
// Density of air pages, water's from the Properties of water page, the flue
// gases' heat capacities from the Table of specific heat capacities, and the
// dew point from the Arden Buck equation.
//
// Not from a source: the gas taken as methane, though the sheet's gas volumes
// use a calorific value higher than pure methane's; dry air taken as nitrogen,
// oxygen and argon in the Atmosphere page's proportions, with the Density of
// air page's molar mass covering its trace gases; the same excess air, the one
// the sheet's 11 g/s implies, and the same 73 °C flue at every firing rate;
// the lowest firing for hot water taken as the heating table's 3.7 kW and the
// gross efficiency taken as 26.0/29.0 at every rate; water at 1 kg/L and
// 4,184 J/(kg·K); the boiler's 0.5 L treated as one well stirred volume, with
// the metal's own heat left out; air and gas entering at the 25 °C the heats
// of combustion are given at; a fan purge of 3 s and a spark of 2 s before the
// flame is proven; a 15 mm copper pipe to the tap with a bore of 13.6 mm, the
// water in it moving as a plug and losing no heat; and the boiler standing at
// the inlet temperature when the tap opens. The book's boiler heats the tap
// water directly in the flame's own exchanger, as this model does; the sheet's
// boiler sends its heat to the tap water through a plate heat exchanger.
// ---------------------------------------------------------------------------

/** Ideal Vogue C26, Installation and Servicing, tables 1 to 3 and the operation, commissioning and servicing pages. */
export const VOGUE = Object.freeze({
  name: 'Vogue C26',
  inputNet: 26.1, inputGross: 29.0, output: 26.0, flow: 10.6, rise: 35, specificRate: 12.4,
  gasRate: 2.695, cvGross: 38.7, cvNet: 34.9, supply: 20, injector: 4.3,
  heatInputNet: Object.freeze([3.7, 18.1]), heatInputGross: Object.freeze([4.1, 20.1]),
  heatOutput: Object.freeze([3.7, 18.0]), condensing: Object.freeze([4.0, 19.3]),
  meanWater: Object.freeze([40, 70]), heatRange: Object.freeze([30, 80]), sedbuk: Object.freeze([91.0, 89.1]),
  minDraw: 2, maxTemp: 65, checkFlow: 3, checkTemp: 64,
  content: 0.5, heatContent: 1.5, exchanger: 7.3, casing: Object.freeze([740, 445, 330]), connection: 15,
  flueTemp: 73, flueMass: 11, flueDiameter: 100, watts: 108, attempts: 5, pumpOverrun: 60, fanOverrun: 120,
});

/** Dry air: the Atmosphere of Earth page's proportions by volume and the Density of air page's molar mass, standard pressure and sea level density. */
export const AIR = Object.freeze({oxygen: 20.946, nitrogen: 78.084, argon: 0.934, carbonDioxide: 0.0412, molar: 28.9652, standard: 101.325, density: 1.225, densityAt: 15});

/** Methane, from the Methane, Heat of combustion and Adiabatic flame temperature pages. */
export const METHANE = Object.freeze({molar: 16.043, hhv: 55.52, lhv: 50.00, hhvMol: 890.7, lhvMol: 802.34, at: 25, flame: 1963, gasFlame: 1960, density: 0.657, densityAt: 25});

/** Water, from the Properties of water and Carbon dioxide pages. */
export const WATER = Object.freeze({cp: 4184, cpAt: 20, density: 1, molar: 18.015, vaporization: 2257, carbonDioxide: 44.009});

/** Heat capacities of the flue's gases, J/(g·K), from the Table of specific heat capacities: steam at 100 °C, the rest at room conditions. */
export const FLUE_CP = Object.freeze({carbonDioxide: 0.839, water: 2.030, oxygen: 0.918, nitrogen: 1.040, argon: 0.5203});

/** The Arden Buck equation over liquid water, hPa with T in °C, fitted from −80 to 50 °C. */
export const BUCK = Object.freeze({a: 6.1121, b: 18.678, c: 257.14, d: 234.5, from: -80, to: 50});

/** The Condensing boiler page: the return water it takes to condense, the efficiency it adds, and how acidic the condensate is. */
export const CONDENSING = Object.freeze({returnWater: 55, gain: Object.freeze([10, 12]), ph: Object.freeze([3, 5])});

/** The Tankless water heating page's combination boilers: their outputs and the flows they give. */
export const TANKLESS = Object.freeze({power: Object.freeze([24, 54]), flow: Object.freeze([9, 23])});

/** Not from a source, each said in the lesson's limits. */
export const DECLARED = Object.freeze({minFiring: 3.7, bore: 13.6, purge: 3, spark: 2, faster: 5, samples: 241, close: 1, shortest: 30, longest: 120, spare: 5});

export const BOILER_DEFAULTS = Object.freeze({flow: 10.6, set: 45, inlet: 10, pipe: 5});
export const BOILER_DOMAINS = Object.freeze({flow: Object.freeze([0, 14, 0.1]), set: Object.freeze([35, 65, 1]), inlet: Object.freeze([5, 20, 1]), pipe: Object.freeze([0, 15, 0.5])});

/** Moles of dry air that carry the two moles of oxygen one mole of methane burns with. */
export const AIR_MOLES = 2 * (1 + AIR.nitrogen / AIR.oxygen + AIR.argon / AIR.oxygen);
/** Kilograms of air for each kilogram of methane, burning it exactly. */
export const AIR_MASS = AIR_MOLES * AIR.molar / METHANE.molar;
/** The methane the sheet's full hot water input burns, g/s, and the excess air its flue mass flow implies. */
export const FUEL_AT_FULL = VOGUE.inputGross / METHANE.hhv;
export const LAMBDA = (VOGUE.flueMass - FUEL_AT_FULL) / (AIR_MASS * FUEL_AT_FULL);
/** The output the sheet gets for its gross input, and the share of that input the steam carries away. */
export const EFFICIENCY = VOGUE.output / VOGUE.inputGross;
export const LATENT_SHARE = (METHANE.hhv - METHANE.lhv) / METHANE.hhv;

/** The saturation vapor pressure of water, hPa, at `celsius`. */
export const buckPressure = celsius => BUCK.a * Math.exp((BUCK.b - celsius / BUCK.d) * (celsius / (BUCK.c + celsius)));

/** The temperature, °C, whose saturation pressure is `hPa`: the Buck equation turned around, taking the root below its turning point. */
export function dewPointOf(hPa) {
  const l = Math.log(hPa / BUCK.a), p = BUCK.d * (BUCK.b - l), q = BUCK.d * BUCK.c * l;
  return (p - Math.sqrt(p * p - 4 * q)) / 2;
}

/**
 * What burning methane at `gross` kW gross sends up the flue: the fuel and air
 * burned, g/s; the products, in moles for each mole of methane and as shares
 * of them all; the steam's partial pressure and dew point; the heat the steam
 * carries as steam; and the heat the flue's warmth carries, kW.
 */
export function combustionOf(gross) {
  const fuel = gross / METHANE.hhv, air = AIR_MASS * LAMBDA * fuel, mass = fuel + air;
  const moles = {
    carbonDioxide: 1,
    water: 2,
    oxygen: 2 * (LAMBDA - 1),
    nitrogen: 2 * LAMBDA * AIR.nitrogen / AIR.oxygen,
    argon: 2 * LAMBDA * AIR.argon / AIR.oxygen,
  };
  const total = Object.values(moles).reduce((sum, value) => sum + value, 0);
  const shares = Object.fromEntries(Object.entries(moles).map(([name, value]) => [name, value / total]));
  const cp = Object.entries(shares).reduce((sum, [name, share]) => sum + share * FLUE_CP[name] * molarOf(name), 0) / Object.entries(shares).reduce((sum, [name, share]) => sum + share * molarOf(name), 0);
  const partial = AIR.standard * shares.water * 10;
  return {
    fuel, air, mass, moles, total, shares, cp,
    steam: fuel * 2 * WATER.molar / METHANE.molar,
    partial, dew: dewPointOf(partial),
    latent: gross * LATENT_SHARE,
    sensible: mass * cp * (VOGUE.flueTemp - METHANE.at) / 1000,
  };
}

/** The molar masses the mixture's heat capacity is weighed with, g/mol; the two the sources give, and the rest from the air they came in with. */
function molarOf(name) {
  if (name === 'carbonDioxide') return WATER.carbonDioxide;
  if (name === 'water') return WATER.molar;
  return AIR.molar;
}

const plans = new Map();

/**
 * The boiler at one set of controls: what the tap asks for, what the burner
 * gives, what goes up the flue, and how long the water takes to reach the tap.
 */
export function boilerPlan(input = {}) {
  const values = validateControls(input, BOILER_DEFAULTS, BOILER_DOMAINS, 'gas boiler');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const massFlow = values.flow / 60 * WATER.density, drawing = values.flow > 0;
  const firing = values.flow >= VOGUE.minDraw - 1e-9;
  const need = drawing ? massFlow * WATER.cp * (values.set - values.inlet) / 1000 : null;
  const power = firing ? Math.min(VOGUE.output, Math.max(DECLARED.minFiring, need)) : 0;
  const rise = firing ? power * 1000 / (massFlow * WATER.cp) : 0;
  const outlet = firing ? values.inlet + rise : drawing ? values.inlet : null;
  const gross = power / EFFICIENCY, flue = combustionOf(gross);
  const held = firing ? (power < need - 1e-9 ? 'short' : power > need + 1e-9 ? 'lowest' : 'held') : 'off';
  const tau = firing ? VOGUE.content / (values.flow / 60) : null;
  const pipeVolume = Math.PI / 4 * (DECLARED.bore / 1000) ** 2 * values.pipe * 1000;
  const delay = drawing ? pipeVolume / (values.flow / 60) : null;
  const litAt = firing ? DECLARED.purge + DECLARED.spark : null;
  const hotAt = firing ? litAt + delay + (rise > DECLARED.close ? tau * Math.log(rise / DECLARED.close) : 0) : null;
  const duration = hotAt === null ? DECLARED.shortest
    : Math.min(DECLARED.longest, Math.max(DECLARED.shortest, Math.ceil((hotAt + DECLARED.spare) / 10) * 10));
  const plan = {
    values, massFlow, drawing, firing, need, power, rise, outlet, gross, flue, held,
    gas: gross * 3600 / (VOGUE.cvGross * 1000), share: power / VOGUE.output,
    tau, pipeVolume, delay, litAt, hotAt, duration,
    reaches: hotAt !== null && hotAt <= duration,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1);
    return {t, tank: tankAt(plan, t), tap: tapAt(plan, t)};
  });
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The temperature of the water leaving the boiler's 0.5 L at time t, °C: a stirred volume warming toward its steady temperature. */
export function tankAt(plan, t) {
  if (!plan.firing || t <= plan.litAt) return plan.values.inlet;
  return plan.outlet - plan.rise * Math.exp(-(t - plan.litAt) / plan.tau);
}

/** The temperature at the tap at time t, °C: what left the boiler a pipeful earlier. */
export function tapAt(plan, t) {
  if (!plan.drawing) return null;
  return tankAt(plan, t - plan.delay);
}

/**
 * The boiler at a time in the run: whether the tap is open, the fan purging,
 * the spark running and the flame lit; the firing power; what the water inside
 * and at the tap read; and whether the tap has come up to temperature.
 */
export function boilerAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration), open = t > 0;
  const purging = open && plan.firing && t < DECLARED.purge;
  const sparking = open && plan.firing && t >= DECLARED.purge && t < plan.litAt;
  const lit = open && plan.firing && t >= plan.litAt;
  const tank = open ? tankAt(plan, t) : plan.values.inlet;
  const tap = open && plan.drawing ? tapAt(plan, t) : null;
  return {
    time, t, open, purging, sparking, lit,
    power: lit ? plan.power : 0,
    tank, tap,
    arrived: open && plan.delay !== null && t >= plan.litAt + plan.delay,
    hot: plan.hotAt !== null && t >= plan.hotAt,
    done: t >= plan.duration,
  };
}

export const sampleBoiler = (input = {}, time = 0) => boilerAt(boilerPlan(input), time);

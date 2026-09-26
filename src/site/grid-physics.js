import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// From the turbine hall to the house: a coil turning in a field, a transformer
// at three places on the way, and the line that carries the power between them.
//
// Exact within the model: the flux through a turning loop, B A cos θ, and
// Faraday's law e = −N dΦ/dt, so the peak of a coil of N turns is N B A ω; the
// root mean square of a sine, its peak over √2, and the mean of a commutated
// sine, 2/π of its peak, both worked out again over the part of the turn that
// conducts; the winding's resistance from copper's resistivity, the wire's
// cross section and the length of wire N turns make; the transformer's turns
// ratio setting the voltage ratio and the inverse current ratio, the reflected
// resistance a²R, the universal EMF equation E = 2π f N A B/√2, the flux a
// quarter cycle behind the voltage, and an energy balance in which the primary
// pays for the secondary, the copper and the core; the three-phase line current
// P/(√3 V), the loss 3I²R, and the voltage drop √3 I R; and the catenary a
// conductor of weight w per meter at horizontal tension H hangs in, with
// a = H/w, sag a(cosh(L/2a) − 1), length 2a sinh(L/2a) and end tension
// H cosh(L/2a).
//
// Sourced: copper's and aluminum's resistivity and the International Annealed
// Copper Standard; the synchronous speed N = 120 f / P and the 3,000 and 3,600
// rpm a 2 pole machine turns at for 50 and 60 Hz; a power station's 480 V to
// 22 kV and the 100 kV to 1,000 kV it is stepped up to; Great Britain's 400 kV,
// 275 kV and 132 kV grid at 50 Hz and its 11 kV distribution and 400 V supply;
// the EU regulation's maximum load and no load losses for a 400 kVA
// transformer and its minimum Peak Efficiency Index for larger ones; amorphous
// steel cutting core loss by up to 70 %; three ACSR conductors from a
// manufacturer's sheet, with their aluminum, their weight, their breaking
// strength, their resistance and their ampacity; the 75 °C ACSR is held to; the
// creepage of 20 to 25 mm for every kV and a suspension disc's 320.8 mm of it;
// six silicone suspension units with their creepage and their dry and wet
// flashover; the number of discs real lines carry at each voltage; tower
// heights of 15 to 55 m; and air breaking down at 3 MV/m.
//
// Declared, not from a source: the generator's loop of 200 by 100 mm wound with
// 2.5 mm² copper, its field of 0 to 1.2 T and its loads of 1 to 50 Ω; the
// commutator's 6° gaps and 10° brush faces; the transformer's core areas, its
// 20 real turns for every turn drawn, the magnetizing current of 0.5 % of rated
// current at rated flux and in proportion to the flux, the load and no load
// losses of the two larger stages, which are set so each just reaches the
// regulation's Peak Efficiency Index with the 400 kVA unit's ratio of losses,
// and an aluminum winding of the same cross section as a copper one; the line's
// power factor of 1 and its resistance taken at 75 °C whatever the current; the
// ground clearance of 8 m and the 3 m of steel above the top crossarm; the
// straight line fitted to the six units' flashover against their creepage; and
// the insulator's surface resistance, 500 MΩ for every mm of creepage dry and
// 500 kΩ wet.
// ---------------------------------------------------------------------------

/** Resistivity, Ω·m at 20 °C, and the standard 100 % IACS copper. */
export const RESISTIVITY = Object.freeze({copper: 1.68e-8, aluminum: 2.82e-8, annealed: 1.72e-8, iacs: 0.612});
/** Air breaks down at 3 MV/m. */
export const AIR_STRENGTH = 3e6;
export const GRAVITY = 9.80665;
/** Exact conversions: the inch, the pound, the pound force and the circular mil. */
export const UNITS = Object.freeze({inch: 0.0254, foot: 0.3048, pound: 0.45359237, poundForce: 4.4482216152605, kcmil: 1000 * Math.PI / 4 * 0.0000254 ** 2 * 1e6});
/** Great Britain's grid: 50 Hz, 400 kV and 275 kV everywhere and 132 kV in Scotland, 11 kV distribution, 400 V between lines at the house. */
export const SUPPLY = Object.freeze({frequency: 50, grid: Object.freeze([400e3, 275e3, 132e3]), distribution: 11e3, house: 400, phase: 230, station: Object.freeze([480, 22e3]), stepUp: Object.freeze([100e3, 1000e3])});
/** A 2 pole machine's synchronous speed, rpm, at 50 Hz and at 60 Hz, and N = 120 f / P. */
export const SYNCHRONOUS = Object.freeze({poles: 2, fifty: 3000, sixty: 3600, constant: 120});

// ---------------------------------------------------------------------------
// The generator.
// ---------------------------------------------------------------------------

/** The bench generator, declared: a loop 200 by 100 mm wound with 2.5 mm² copper, its commutator's gaps and brush faces in degrees, and one turn drawn in 8 seconds. */
export const COIL = Object.freeze({length: 0.2, width: 0.1, wire: 2.5e-6, gap: 6, brush: 10, show: 8});
export const COIL_AREA = COIL.length * COIL.width;
/** Half the angle, radians, over which a brush wider than the gap bridges both segments. */
export const BRIDGE = (COIL.brush - COIL.gap) / 2 * Math.PI / 180;

export const OUTPUT_OPTIONS = Object.freeze([{value: 0, label: 'Slip rings, alternating'}, {value: 1, label: 'Commutator, direct'}].map(Object.freeze));
export const GENERATOR_DEFAULTS = Object.freeze({output: 0, speed: 3000, field: 1, turns: 20, load: 10, closed: 1});
export const GENERATOR_DOMAINS = Object.freeze({output: Object.freeze([0, 1, 1]), speed: Object.freeze([0, 3600, 60]), field: Object.freeze([0, 1.2, 0.05]), turns: Object.freeze([2, 40, 2]), load: Object.freeze([1, 50, 1]), closed: Object.freeze([0, 1, 1])});

/** The resistance, Ω, of `turns` turns of wire around the loop. */
export const windingResistanceOf = turns => turns * 2 * (COIL.length + COIL.width) * RESISTIVITY.copper / COIL.wire;
/** The electrical frequency, Hz, of a 2 pole machine at `rpm`: N = 120 f / P. */
export const frequencyOf = (rpm, poles = SYNCHRONOUS.poles) => Math.abs(rpm) * poles / SYNCHRONOUS.constant;
/** The mean of |sin| over the part of the turn that conducts, and its mean square. */
export const commutatedMean = (bridge = BRIDGE) => 2 * Math.cos(bridge) / Math.PI;
export const commutatedMeanSquare = (bridge = BRIDGE) => (Math.PI - 2 * bridge + Math.sin(2 * bridge)) / (2 * Math.PI);
/** The mean square of sin over the part of the turn where the brush bridges both segments, which is what a half turn's 1/2 has left over. */
export const bridgedMeanSquare = (bridge = BRIDGE) => (2 * bridge - Math.sin(2 * bridge)) / (2 * Math.PI);

const generatorPlans = new Map();

/** Everything about the generator that does not change as the shaft turns. */
export function generatorPlan(input) {
  const values = validateControls(input, GENERATOR_DEFAULTS, GENERATOR_DOMAINS, 'generator');
  const key = JSON.stringify(values);
  if (generatorPlans.has(key)) return generatorPlans.get(key);
  const {output, speed, field, turns, load, closed} = values;
  const omega = 2 * Math.PI * speed / 60, period = speed > 0 ? 60 / speed : null;
  const winding = windingResistanceOf(turns), circuit = closed ? winding + load : null;
  const peak = turns * field * COIL_AREA * omega;
  const alternating = output === 0;
  // The slip rings hand the coil's voltage out as it stands; the commutator
  // hands out its size, and bridges both segments for BRIDGE either side of
  // every zero crossing, where the coil is shorted and the load gets nothing.
  const meanShare = alternating ? 0 : commutatedMean();
  const meanSquareShare = alternating ? 0.5 : commutatedMeanSquare();
  const bridgeShare = alternating ? 0 : bridgedMeanSquare();
  const rms = peak / Math.SQRT2, mean = peak * meanShare;
  const currentPeak = circuit === null ? 0 : peak / circuit;
  const loadPower = circuit === null ? 0 : peak ** 2 * meanSquareShare / circuit ** 2 * load;
  // While the brush bridges both segments the coil is shorted through itself,
  // whether or not the load switch is closed, so the winding heats either way.
  const windingPower = (circuit === null ? 0 : peak ** 2 * meanSquareShare / circuit ** 2 * winding) + peak ** 2 * bridgeShare / winding;
  const plan = {
    values, output, alternating, speed, field, turns, load, closed, omega, period, frequency: frequencyOf(speed),
    area: COIL_AREA, winding, circuit, peak, rms, mean, meanShare, meanSquareShare, bridgeShare, currentPeak,
    fluxPeak: turns * field * COIL_AREA, loadPower, windingPower, drivePower: loadPower + windingPower,
    torquePeak: circuit === null ? 0 : turns * field * COIL_AREA * currentPeak,
    slow: period === null ? null : COIL.show / period,
    turnEnergy: period === null ? null : (loadPower + windingPower) * period,
    synchronous: Object.freeze({fifty: SYNCHRONOUS.constant * SUPPLY.frequency / SYNCHRONOUS.poles, sixty: SYNCHRONOUS.constant * 60 / SYNCHRONOUS.poles}),
  };
  plan.chart = Object.freeze(Array.from({length: GENERATOR_SAMPLES}, (_, i) => {
    const theta = 2 * Math.PI * i / (GENERATOR_SAMPLES - 1);
    return Object.freeze({theta, rings: peak * Math.sin(theta), commutator: commutatedEmf(peak, theta)});
  }));
  if (generatorPlans.size >= 64) generatorPlans.clear();
  generatorPlans.set(key, plan);
  return plan;
}

export const GENERATOR_SAMPLES = 181;

/** The voltage a two segment commutator hands out at `theta`: the size of the coil's voltage, and nothing while the brush bridges both segments. */
export function commutatedEmf(peak, theta) {
  const within = Math.abs(Math.asin(Math.sin(theta)));
  return within <= BRIDGE ? 0 : Math.abs(peak * Math.sin(theta));
}

/** The generator `time` seconds into a turn that starts with the loop facing the field. */
export function generatorAt(plan, time) {
  validTime(time);
  const t = plan.period === null ? 0 : Math.min(time, plan.period);
  const theta = plan.omega * t, coilEmf = plan.peak * Math.sin(theta);
  const bridged = !plan.alternating && Math.abs(Math.asin(Math.sin(theta))) <= BRIDGE;
  const terminal = plan.alternating ? coilEmf : bridged ? 0 : Math.abs(coilEmf);
  const current = plan.circuit === null ? 0 : bridged ? 0 : terminal / plan.circuit;
  // Slip rings hand the load the coil's own current, so it reverses with the
  // voltage; the commutator reverses the coil's connection instead. Either way
  // the coil current follows its voltage and the shaft always works against it.
  // A bridged commutator shorts the coil whether or not the load switch is closed.
  const coilCurrent = bridged ? coilEmf / plan.winding : plan.circuit === null ? 0 : plan.alternating ? current : Math.sign(Math.sin(theta)) * Math.abs(current);
  return {
    time, t, theta, coilEmf, terminal, current, coilCurrent, bridged,
    flux: plan.fluxPeak * Math.cos(theta),
    loadPower: current ** 2 * plan.load,
    torque: plan.turns * plan.field * COIL_AREA * coilCurrent * Math.sin(theta),
    done: plan.period === null ? false : time >= plan.period,
  };
}

export const sampleGenerator = (input, time = 0) => generatorAt(generatorPlan(input), time);

// ---------------------------------------------------------------------------
// The transformer, at three places on the way from the station to the house.
// ---------------------------------------------------------------------------

/** The sourced 400 kVA unit: the EU regulation's Tier 2 maximum load loss and no load loss, in watts. */
export const TIER_TWO = Object.freeze({rating: 400e3, loadLoss: 3250, noLoad: 387});
/** The regulation's minimum Peak Efficiency Index for a liquid immersed large power transformer, Tier 2. */
export const PEI_MINIMUM = Object.freeze({'31.5': 0.99712, '400': 0.99770});
/** Declared: real turns for every turn drawn, the magnetizing current at rated flux as a share of rated current, and two cycles drawn in 8 seconds. */
export const WINDING = Object.freeze({per: 20, magnetizing: 0.005, cycles: 2, show: 8});
/** Amorphous steel cuts core loss by up to 70 %; electrical steel's hysteresis loss is quoted at 1.5 T. */
export const CORE_STEEL = Object.freeze({amorphous: 0.3, quoted: 1.5, lossPerKg: Object.freeze([2, 10])});

/** The Peak Efficiency Index the regulation defines: 1 − 2√(Po·Pk)/Sr, the efficiency of a transformer loaded at √(Po/Pk). */
export const peakEfficiencyIndex = (noLoad, loadLoss, rating) => 1 - 2 * Math.sqrt(noLoad * loadLoss) / rating;
/** The load and no load losses that just reach `index` at `rating`, keeping the 400 kVA unit's ratio of one to the other. */
export function lossesForIndex(index, rating) {
  const ratio = TIER_TWO.loadLoss / TIER_TWO.noLoad, geometric = (1 - index) * rating / 2;
  const noLoad = geometric / Math.sqrt(ratio);
  return {noLoad, loadLoss: noLoad * ratio, ratio};
}

const stage = (name, primary, secondary, rating, area, primaryTurns, secondaryTurns, losses) => Object.freeze({
  name, primary, secondary, rating, area, primaryTurns, secondaryTurns,
  noLoad: losses.noLoad, loadLoss: losses.loadLoss, index: peakEfficiencyIndex(losses.noLoad, losses.loadLoss, rating),
});

/** The same machine at three places: stepping up at the station, down at the grid supply point, and down again before the house. */
export const STAGES = Object.freeze([
  stage('Transmission', 20e3, SUPPLY.grid[0], 400e6, 0.9, 3, 60, lossesForIndex(PEI_MINIMUM['400'], 400e6)),
  stage('Distribution', SUPPLY.grid[2], SUPPLY.distribution, 31.5e6, 0.3, 60, 5, lossesForIndex(PEI_MINIMUM['31.5'], 31.5e6)),
  stage('Home supply', SUPPLY.distribution, SUPPLY.house, TIER_TWO.rating, 0.03, 55, 2, {noLoad: TIER_TWO.noLoad, loadLoss: TIER_TWO.loadLoss}),
]);

export const STAGE_OPTIONS = Object.freeze(STAGES.map((item, value) => Object.freeze({value, label: `${item.name}, ${kvLabel(item.primary)} to ${kvLabel(item.secondary)}`})));
export const CORE_OPTIONS = Object.freeze([{value: 0, label: 'Grain oriented silicon steel'}, {value: 1, label: 'Amorphous metal'}].map(Object.freeze));
export const WINDING_OPTIONS = Object.freeze([{value: 0, label: 'Copper'}, {value: 1, label: 'Aluminum'}].map(Object.freeze));

/** A voltage as kV or V, for a label. */
export function kvLabel(volts) {
  return volts >= 1000 ? `${Number((volts / 1000).toFixed(3))} kV` : `${Number(volts.toPrecision(4))} V`;
}

export const TRANSFORMER_DEFAULTS = Object.freeze({stage: 1, primaryTurns: 60, secondaryTurns: 5, load: 100, core: 0, winding: 0});
export const TRANSFORMER_DOMAINS = Object.freeze({stage: Object.freeze([0, 2, 1]), primaryTurns: Object.freeze([1, 72, 1]), secondaryTurns: Object.freeze([1, 72, 1]), load: Object.freeze([0, 120, 5]), core: Object.freeze([0, 1, 1]), winding: Object.freeze([0, 1, 1])});

/** The universal EMF equation: the peak flux density a winding of `turns` real turns around `area` needs to stand `volts` RMS at `frequency`. */
export const fluxDensityOf = (volts, turns, area, frequency = SUPPLY.frequency) => Math.SQRT2 * volts / (2 * Math.PI * frequency * turns * area);

const transformerPlans = new Map();

/** Everything about the transformer that does not change through the cycle. */
export function transformerPlan(input) {
  const values = validateControls(input, TRANSFORMER_DEFAULTS, TRANSFORMER_DOMAINS, 'transformer');
  const key = JSON.stringify(values);
  if (transformerPlans.has(key)) return transformerPlans.get(key);
  const place = STAGES[values.stage], drawnPrimary = values.primaryTurns, drawnSecondary = values.secondaryTurns;
  const primaryTurns = drawnPrimary * WINDING.per, secondaryTurns = drawnSecondary * WINDING.per;
  const ratio = secondaryTurns / primaryTurns, share = values.load / 100;
  const primaryVolts = place.primary, secondaryVolts = primaryVolts * ratio;
  const nominalRatio = place.secondaryTurns / place.primaryTurns;
  const flux = fluxDensityOf(primaryVolts, primaryTurns, place.area);
  const nominalFlux = fluxDensityOf(primaryVolts, place.primaryTurns * WINDING.per, place.area);
  const ratedSecondary = place.rating / place.secondary, secondaryCurrent = share * ratedSecondary;
  const output = secondaryVolts * secondaryCurrent;
  const coreFactor = values.core === 1 ? CORE_STEEL.amorphous : 1;
  const windingFactor = values.winding === 1 ? RESISTIVITY.aluminum / RESISTIVITY.copper : 1;
  // Eddy current losses go as the square of the applied voltage, so the core's
  // loss follows the square of the flux the turns leave in it.
  const coreLoss = place.noLoad * coreFactor * (flux / nominalFlux) ** 2;
  const copperLoss = place.loadLoss * windingFactor * share ** 2;
  const input_ = output + coreLoss + copperLoss;
  const magnetizing = WINDING.magnetizing * (place.rating / primaryVolts) * (flux / nominalFlux);
  const activeCurrent = input_ / primaryVolts;
  const primaryCurrent = Math.hypot(activeCurrent, magnetizing);
  const load = secondaryCurrent > 0 ? secondaryVolts / secondaryCurrent : null;
  const plan = {
    values, place, stage: values.stage, drawnPrimary, drawnSecondary, primaryTurns, secondaryTurns, ratio, nominalRatio,
    primaryVolts, secondaryVolts, nominalSecondary: place.secondary, share, rating: place.rating,
    flux, nominalFlux, quoted: CORE_STEEL.quoted, area: place.area, frequency: SUPPLY.frequency,
    omega: 2 * Math.PI * SUPPLY.frequency, ratedSecondary, secondaryCurrent, output,
    coreLoss, copperLoss, input: input_, loss: coreLoss + copperLoss,
    efficiency: output > 0 ? output / input_ : null,
    index: place.index, magnetizing, activeCurrent, primaryCurrent,
    noLoadCurrent: Math.hypot(coreLoss / primaryVolts, magnetizing),
    load, reflected: load === null ? null : load / ratio ** 2,
    bestShare: Math.sqrt(place.noLoad / place.loadLoss),
    duration: WINDING.cycles / SUPPLY.frequency, slow: WINDING.show * SUPPLY.frequency / WINDING.cycles,
    coreFactor, windingFactor,
  };
  plan.chart = Object.freeze(Array.from({length: TRANSFORMER_SAMPLES}, (_, i) => {
    const t = plan.duration * i / (TRANSFORMER_SAMPLES - 1);
    return Object.freeze(transformerAt(plan, t));
  }));
  if (transformerPlans.size >= 64) transformerPlans.clear();
  transformerPlans.set(key, plan);
  return plan;
}

export const TRANSFORMER_SAMPLES = 161;

/** The transformer `time` seconds into the run: the voltage, the flux a quarter cycle behind it, and the magnetizing current in step with the flux. */
export function transformerAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), angle = plan.omega * t;
  const primaryVoltage = Math.SQRT2 * plan.primaryVolts * Math.cos(angle);
  return {
    time, t, angle,
    primaryVoltage, secondaryVoltage: primaryVoltage * plan.ratio,
    core: Math.SQRT2 * plan.primaryVolts * Math.sin(angle) / (plan.omega * plan.primaryTurns),
    density: plan.flux * Math.sin(angle),
    magnetizing: Math.SQRT2 * plan.magnetizing * Math.sin(angle),
    secondaryCurrent: Math.SQRT2 * plan.secondaryCurrent * Math.cos(angle),
    done: time >= plan.duration,
  };
}

export const sampleTransformer = (input, time = 0) => transformerAt(transformerPlan(input), time);

// ---------------------------------------------------------------------------
// The line: the conductor, the insulator that holds it off the steel, and the
// pylon that holds it up.
// ---------------------------------------------------------------------------

/** Three ACSR conductors as the manufacturer's sheet gives them: aluminum in kcmil, stranding, overall diameter and weight in the sheet's units, rated breaking strength in pounds, resistance in Ω per 1,000 ft at 20 °C direct and 75 °C alternating, and ampacity in amps. */
export const SHEET = Object.freeze([
  Object.freeze({name: 'Drake', kcmil: 795, stranding: '26/7', inch: 1.108, poundsPerKft: 1094, breaking: 31500, dc: 0.0214, ac: 0.026, ampacity: 907}),
  Object.freeze({name: 'Rook', kcmil: 636, stranding: '24/7', inch: 0.977, poundsPerKft: 819, breaking: 22600, dc: 0.0268, ac: 0.033, ampacity: 784}),
  Object.freeze({name: 'Partridge', kcmil: 266.8, stranding: '26/7', inch: 0.642, poundsPerKft: 367, breaking: 11130, dc: 0.0637, ac: 0.078, ampacity: 475}),
]);

/** One sheet row in SI: aluminum in m², diameter in m, mass in kg/m, breaking strength in N, resistance in Ω/m at 20 °C and at 75 °C. */
export const conductorOf = row => Object.freeze({
  name: row.name, stranding: row.stranding, kcmil: row.kcmil,
  area: row.kcmil * UNITS.kcmil * 1e-6, diameter: row.inch * UNITS.inch,
  mass: row.poundsPerKft * UNITS.pound / (1000 * UNITS.foot),
  weight: row.poundsPerKft * UNITS.pound / (1000 * UNITS.foot) * GRAVITY,
  breaking: row.breaking * UNITS.poundForce,
  dc: row.dc / (1000 * UNITS.foot), ac: row.ac / (1000 * UNITS.foot), ampacity: row.ampacity,
});
export const CONDUCTORS = Object.freeze(SHEET.map(conductorOf));

/** The line voltages the model offers, volts between lines: Great Britain's 400, 275 and 132 kV and its 33 and 11 kV distribution. */
export const LEVELS = Object.freeze([11e3, 33e3, 132e3, 275e3, 400e3]);
/** One suspension disc: the leakage distance of a toughened glass 52-3H unit, its mechanical strength, and the standard disc's size and dry flashover. */
export const DISC = Object.freeze({leakage: 12.63 * UNITS.inch, strength: 22000 * UNITS.poundForce, diameter: 0.25, length: 0.15, dryFlashover: 72e3, rated: Object.freeze([10e3, 12e3])});
/** Six silicone suspension units from the sheet: creepage in mm, then dry and wet 60 Hz flashover in kV. */
export const LONG_ROD = Object.freeze([[2164, 327, 295], [2401, 385, 340], [2629, 420, 370], [3380, 441, 395], [3700, 480, 455], [4350, 585, 545]].map(Object.freeze));
/** Real lines' disc counts: line voltage in kV against the number of discs. */
export const DISC_TABLE = Object.freeze([[34.5, 3], [69, 4], [115, 6], [138, 8], [161, 11], [230, 14], [287, 15], [345, 18], [400, 24], [500, 34], [765, 60]].map(Object.freeze));
/** Creepage asked of an insulator, mm for every kV between lines. */
export const CREEPAGE = Object.freeze({low: 20, high: 25});
/** Tower heights real lines use, m. */
export const TOWER = Object.freeze({low: 15, high: 55});
/** Declared: the clearance kept under the lowest point, the steel above the top crossarm, and the insulator's surface resistance per mm of creepage, dry and wet, in Ω. */
export const SITE = Object.freeze({clearance: 8, headroom: 3, dry: 500e6, wet: 500e3, show: 8});

export const LEVEL_OPTIONS = Object.freeze(LEVELS.map((volts, value) => Object.freeze({value, label: `${volts / 1000} kV`})));
export const CONDUCTOR_OPTIONS = Object.freeze(CONDUCTORS.map((item, value) => Object.freeze({value, label: `${item.name}, ${item.stranding} ACSR`})));
export const WEATHER_OPTIONS = Object.freeze([{value: 0, label: 'Dry'}, {value: 1, label: 'Wet'}].map(Object.freeze));

/** A straight line fitted by least squares to `points`, each [x, y]; returns the slope and the intercept. */
export function fitLine(points) {
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of points) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return {slope, intercept: (sy - slope * sx) / n, n};
}
/** The sheet's dry and wet flashover against creepage, each as a straight line through its six units. */
export const FLASHOVER = Object.freeze({
  dry: Object.freeze(fitLine(LONG_ROD.map(row => [row[0], row[1]]))),
  wet: Object.freeze(fitLine(LONG_ROD.map(row => [row[0], row[2]]))),
});

/** The catenary a conductor of weight `weight` per meter takes between supports `span` apart at horizontal tension `tension`. */
export function catenaryOf(weight, tension, span) {
  const a = tension / weight, half = span / (2 * a);
  return {a, sag: a * (Math.cosh(half) - 1), arc: 2 * a * Math.sinh(half), endTension: tension * Math.cosh(half), vertical: weight * a * Math.sinh(half), horizontal: tension};
}
/** How high above the lowest point of the span the conductor hangs, m from the ground: `x` is measured from the middle. */
export const catenaryHeight = (a, x) => a * (Math.cosh(x / a) - 1);

export const LINE_DEFAULTS = Object.freeze({voltage: 4, conductor: 0, length: 100, power: 200, span: 400, tension: 20, weather: 0});
export const LINE_DOMAINS = Object.freeze({voltage: Object.freeze([0, 4, 1]), conductor: Object.freeze([0, 2, 1]), length: Object.freeze([10, 300, 10]), power: Object.freeze([5, 600, 5]), span: Object.freeze([200, 500, 25]), tension: Object.freeze([12, 30, 2]), weather: Object.freeze([0, 1, 1])});

const linePlans = new Map();

/** Everything about the line that does not change through the cycle. */
export function linePlan(input) {
  const values = validateControls(input, LINE_DEFAULTS, LINE_DOMAINS, 'transmission line');
  const key = JSON.stringify(values);
  if (linePlans.has(key)) return linePlans.get(key);
  const volts = LEVELS[values.voltage], wire = CONDUCTORS[values.conductor];
  const length = values.length * 1000, delivered = values.power * 1e6;
  const resistance = wire.ac * length, current = delivered / (Math.sqrt(3) * volts);
  const loss = 3 * current ** 2 * resistance, sent = delivered + loss;
  const drop = Math.sqrt(3) * current * resistance;
  const tension = values.tension / 100 * wire.breaking;
  const hang = catenaryOf(wire.weight, tension, values.span);
  const creepageWanted = CREEPAGE.low * volts / 1000 / 1000;
  const discs = Math.max(1, Math.ceil(creepageWanted / DISC.leakage));
  const creepage = discs * DISC.leakage, stringLength = discs * DISC.length;
  const earthVolts = volts / Math.sqrt(3);
  const surface = (values.weather === 1 ? SITE.wet : SITE.dry) * creepage * 1000;
  const flashover = (values.weather === 1 ? FLASHOVER.wet : FLASHOVER.dry);
  const withstand = (flashover.intercept + flashover.slope * creepage * 1000) * 1000;
  const airGap = Math.SQRT2 * earthVolts / AIR_STRENGTH;
  const towerHeight = SITE.clearance + hang.sag + stringLength + SITE.headroom;
  const plan = {
    values, volts, wire, length, delivered, resistance, current, loss, sent, drop,
    sending: volts + drop, lossFraction: sent > 0 ? loss / sent : null,
    ampacityShare: current / wire.ampacity, overRated: current > wire.ampacity,
    tension, span: values.span, ...hang, weight: wire.weight,
    discs, creepage, creepagePerKv: creepage * 1000 / (volts / 1000), stringLength, earthVolts,
    leakage: earthVolts / surface, surface, withstand, margin: withstand / earthVolts,
    airGap, wet: values.weather === 1, towerHeight,
    clearance: SITE.clearance, inRange: towerHeight >= TOWER.low && towerHeight <= TOWER.high,
    duration: 1 / SUPPLY.frequency, slow: SITE.show * SUPPLY.frequency,
    ladder: Object.freeze(LEVELS.map(level => {
      const i = delivered / (Math.sqrt(3) * level), l = 3 * i ** 2 * resistance;
      return Object.freeze({volts: level, current: i, loss: l, fraction: l / (delivered + l)});
    })),
  };
  if (linePlans.size >= 64) linePlans.clear();
  linePlans.set(key, plan);
  return plan;
}

/** The line `time` seconds into one cycle: the current in each phase and the heat it is making. */
export function lineAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), angle = 2 * Math.PI * SUPPLY.frequency * t;
  const phases = Object.freeze([0, 1, 2].map(k => Math.SQRT2 * plan.current * Math.cos(angle - 2 * Math.PI * k / 3)));
  const heat = phases.reduce((sum, i) => sum + i * i * plan.resistance, 0);
  return {
    time, t, angle, phases, heat,
    delivered: plan.delivered, mean: plan.loss,
    energy: plan.loss * t,
    done: time >= plan.duration,
  };
}

export const sampleLine = (input, time = 0) => lineAt(linePlan(input), time);

import {validateControls, validTime, clamp} from './physics-kit.js';

// Thermometers: a liquid in a glass bulb that expands up a narrow bore, and a
// maximum-minimum thermometer whose steel indices stay where the thread last
// pushed them.
//
// Units: SI inside. Readings convert to millimeters, degrees Celsius, seconds.
//
// Expansion. The liquid grows by its volume expansion coefficient a degree and
// the glass bulb by its own, so the column rises V (beta_liquid - beta_glass)
// / A for each degree, A being the bore's cross-section. Mercury grows 181
// millionths a degree, colored alcohol 1,090, and the glass 10.
//
// Response. The bulb, its liquid and its 0.4 mm glass wall form one lump that
// the surroundings warm through a heat transfer coefficient: 10 W per square
// meter per degree in still air, 40 in a breeze, 500 in stirred water. It
// follows a step in temperature as T = T_new + (T_old - T_new) exp(-t / tau),
// tau being its heat capacity over h A.
//
// Freezing. Mercury freezes at -38.83 degrees and alcohol at -114; a frozen
// thread stops, reading its freezing point.
//
// The liquid-in-glass thermometer. A cylindrical bulb 5 mm across and 6 mm
// long, 0.118 mL, on a bore whose diameter is set, a 292 mm stem, and a scale
// engraved for that bore with 20 degrees at its middle. It starts at 20 degrees
// and is moved at once into the chosen surroundings.
//
// The maximum-minimum thermometer, Six's design. A 3 mL alcohol bulb on the
// minimum side pushes a mercury thread round a 1 mm U-tube. Warming drives the
// mercury up the maximum arm and cooling up the minimum arm, and each end
// pushes a steel index that friction then holds. The indices are reset against
// the mercury at 9 am, when the day's reading is taken. The air follows a daily
// cosine, warmest six hours later at 3 pm and coolest at 3 am; the bulb, hanging
// there for days, follows it with its lag.
//
// Not modeled: the glass stem's heat, the thread's own weight and surface
// tension, radiation from the sun, and the slow creep of glass after heating.

export const LIQUIDS = Object.freeze([
  Object.freeze({value: 0, label: 'Mercury', expansion: 1.81e-4, density: 13534, heat: 140, freezes: -38.83, boils: 356.7}),
  Object.freeze({value: 1, label: 'Colored alcohol', expansion: 1.09e-3, density: 789, heat: 2440, freezes: -114, boils: 78.4}),
]);
export const MEDIA = Object.freeze([
  Object.freeze({value: 0, label: 'Still air', transfer: 10}),
  Object.freeze({value: 1, label: 'A breeze', transfer: 40}),
  Object.freeze({value: 2, label: 'Stirred water', transfer: 500}),
]);
export const GLASS = Object.freeze({expansion: 1e-5, density: 2230, heat: 750, wall: 0.4e-3});
export const BULB = Object.freeze({radius: 2.5e-3, length: 6e-3, start: 20, duration: 1200, readable: 0.2e-3});
export const SIX = Object.freeze({volume: 3e-6, bore: 1e-3, radius: 7e-3, length: 20e-3, reference: 20, peak: 6, day: 86400, transfer: 10});

export const THERMOMETER_DEFAULTS = Object.freeze({liquid: 1, bore: 0.3, surroundings: 0, medium: 0});
export const THERMOMETER_DOMAINS = Object.freeze({liquid: [0, 1, 1], bore: [0.15, 0.5, 0.05], surroundings: [-50, 50, 5], medium: [0, 2, 1]});
export const SIX_DEFAULTS = Object.freeze({mean: 12, swing: 8});
export const SIX_DOMAINS = Object.freeze({mean: [-10, 30, 1], swing: [0, 15, 1]});

/** Column rise for each degree, in meters: bulb volume times the expansion the glass does not match, over the bore's area. */
export const risePerDegree = (volume, liquid, bore) => volume * (LIQUIDS[liquid].expansion - GLASS.expansion) / (Math.PI * (bore / 2) ** 2);

/** A cylindrical bulb's volume, surface, heat capacity and time constant. */
export function lump(radius, length, liquid, transfer) {
  const volume = Math.PI * radius ** 2 * length, area = 2 * Math.PI * radius * length + Math.PI * radius ** 2, L = LIQUIDS[liquid];
  const capacity = L.density * L.heat * volume + GLASS.density * GLASS.heat * area * GLASS.wall;
  return {volume, area, capacity, tau: capacity / (transfer * area)};
}

export function thermometerPlan(input = {}) {
  const values = validateControls(input, THERMOMETER_DEFAULTS, THERMOMETER_DOMAINS, 'liquid-in-glass thermometer');
  const bore = values.bore / 1000, body = lump(BULB.radius, BULB.length, values.liquid, MEDIA[values.medium].transfer);
  const rise = risePerDegree(body.volume, values.liquid, bore), step = values.surroundings - BULB.start;
  return {
    values, ...body, bore, rise, resolution: BULB.readable / rise, freezes: LIQUIDS[values.liquid].freezes,
    settle: Math.abs(step) > 0.5 ? body.tau * Math.log(Math.abs(step) / 0.5) : 0,
  };
}

export function sampleThermometer(input = {}, time = 0) {
  validTime(time);
  const plan = thermometerPlan(input), clock = Math.min(BULB.duration, time), target = plan.values.surroundings;
  const bulb = target + (BULB.start - target) * Math.exp(-clock / plan.tau), frozen = bulb <= plan.freezes;
  const reads = frozen ? plan.freezes : bulb;
  return {...plan, clock, bulb, frozen, reads, column: plan.rise * (reads - BULB.start), complete: clock >= BULB.duration};
}

/** The air's temperature this many hours after the 9 am reset, peaking at 3 pm. */
export const airAt = (values, hours) => values.mean + values.swing * Math.cos(2 * Math.PI * (hours - SIX.peak) / 24);

export function sixPlan(input = {}) {
  const values = validateControls(input, SIX_DEFAULTS, SIX_DOMAINS, 'maximum-minimum thermometer');
  const body = lump(SIX.radius, SIX.length, 1, SIX.transfer), omega = 2 * Math.PI / SIX.day;
  const lagFactor = 1 / Math.sqrt(1 + (omega * body.tau) ** 2), lag = Math.atan(omega * body.tau) / omega;
  const rise = SIX.volume * (LIQUIDS[1].expansion - GLASS.expansion) / (Math.PI * (SIX.bore / 2) ** 2);
  return {values, ...body, lagFactor, lag, rise, omega};
}

/** The bulb follows the air's daily cosine, its swing shrunk and delayed by its lag; after days in place no start-up difference remains. */
export function sixBulbAt(plan, hours) {
  const {values, omega, lagFactor, lag} = plan;
  return values.mean + values.swing * lagFactor * Math.cos(omega * (hours * 3600 - SIX.peak * 3600 - lag));
}

export function sampleSix(input = {}, hours = 0) {
  validTime(hours);
  const plan = sixPlan(input), clock = Math.min(24, hours), step = 1 / 60;
  let highest = -Infinity, lowest = Infinity;
  for (let h = 0; h <= clock + 1e-9; h += step) { const T = sixBulbAt(plan, Math.min(h, clock)); highest = Math.max(highest, T); lowest = Math.min(lowest, T); }
  const T = sixBulbAt(plan, clock), shift = plan.rise * (T - SIX.reference);
  return {...plan, clock, air: airAt(plan.values, clock), bulb: T, highest, lowest, maxArm: shift, minArm: -shift, maxIndex: plan.rise * (highest - SIX.reference), minIndex: -plan.rise * (lowest - SIX.reference), complete: clock >= 24};
}

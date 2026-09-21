import {validateControls, validTime} from './physics-kit.js';

// Water clocks: two ways to let water measure time, and the trouble each has.
//
// Units: SI inside. Readings convert to millimeters, hours, milliliters.
//
// Outflow. A pot 400 mm tall full of water drains through a sharp-edged hole
// in its floor. By Torricelli the water leaves at sqrt(2 g h), and a sharp hole
// passes 0.62 of its full area's worth, so the level falls at
//   dh/dt = -0.62 a sqrt(2 g h) / A(h).
// A straight-sided pot, 150 mm in radius, falls fast when full and slowly when
// nearly empty, so its hour marks bunch toward the bottom. The Egyptians shaped
// their pots to flare upward. If the radius grows as the fourth root of the
// height, A(h) grows as sqrt(h), the square roots cancel, and the level falls
// at the same speed all the way down: 150 mm across the rim.
//
// Inflow, as Ctesibius built it. A tank kept brim-full by an overflow holds its
// water 50 mm above a narrow tube 50 mm long, half as wide as the hole would
// be. Flow through such a tube is smooth, so Poiseuille's law gives
//   Q = pi d^4 rho g h / (128 mu L),
// steady because the head never changes. It fills a receiving jar 30 mm in
// radius, raising a float and its pointer at a steady pace. But the viscosity
// mu of water falls as it warms: mu = 2.414e-5 Pa s times 10^(247.8 / (T +
// 133.15)), with T in degrees Celsius, so the same clock runs faster in summer.
//
// A sharp hole's flow barely depends on viscosity, so temperature is left out
// of the outflow pots.
//
// Not modeled: evaporation, the tube's entry and exit losses, surface tension
// at a narrow hole, and the float's own displacement.

export const DESIGNS = Object.freeze([
  Object.freeze({value: 0, label: 'Straight-sided outflow pot'}),
  Object.freeze({value: 1, label: 'Egyptian pot, flaring upward'}),
  Object.freeze({value: 2, label: 'Ctesibius’s inflow clock'}),
]);
export const WATER = Object.freeze({
  g: 9.81, density: 1000, discharge: 0.62, height: 0.4, radius: 0.15, head: 0.05, tube: 0.05, jar: 0.03, jarHeight: 0.4, duration: 12, step: 1,
});
export const WATER_DEFAULTS = Object.freeze({design: 0, bore: 1, temperature: 20});
export const WATER_DOMAINS = Object.freeze({design: [0, 2, 1], bore: [0.6, 2, 0.1], temperature: [5, 35, 1]});

export const viscosity = T => 2.414e-5 * 10 ** (247.8 / (T + 133.15));
/** Cross-section of the pot at a height above its floor. */
export const potArea = (design, h) => design === 1 ? Math.PI * WATER.radius ** 2 * Math.sqrt(Math.max(0, h) / WATER.height) : Math.PI * WATER.radius ** 2;
export const potRadius = (design, h) => design === 1 ? WATER.radius * (Math.max(0, h) / WATER.height) ** 0.25 : WATER.radius;
export const potVolume = design => design === 1 ? Math.PI * WATER.radius ** 2 * 2 * WATER.height / 3 : Math.PI * WATER.radius ** 2 * WATER.height;

/** Water level against time for an outflow pot, in closed form. */
export function outflowLevel(design, bore, hours) {
  const w = WATER, a = Math.PI * (bore / 2) ** 2, t = hours * 3600;
  if (design === 1) {
    const speed = w.discharge * a * Math.sqrt(2 * w.g * w.height) / (Math.PI * w.radius ** 2);
    return Math.max(0, w.height - speed * t);
  }
  const k = w.discharge * a * Math.sqrt(2 * w.g) / (Math.PI * w.radius ** 2), root = Math.sqrt(w.height) - k * t / 2;
  return root > 0 ? root ** 2 : 0;
}
export function emptyTime(design, bore) {
  const w = WATER, a = Math.PI * (bore / 2) ** 2;
  if (design === 1) return w.height / (w.discharge * a * Math.sqrt(2 * w.g * w.height) / (Math.PI * w.radius ** 2)) / 3600;
  return 2 * Math.sqrt(w.height) / (w.discharge * a * Math.sqrt(2 * w.g) / (Math.PI * w.radius ** 2)) / 3600;
}
export function inflowRate(bore, temperature) {
  const w = WATER, d = bore / 2;
  return Math.PI * d ** 4 * w.density * w.g * w.head / (128 * viscosity(temperature) * w.tube);
}

export function waterClockPlan(input = {}) {
  const values = validateControls(input, WATER_DEFAULTS, WATER_DOMAINS, 'water clock'), bore = values.bore / 1000, w = WATER;
  if (values.design === 2) {
    const flow = inflowRate(bore, values.temperature), rise = flow / (Math.PI * w.jar ** 2) * 3600, d = bore / 2;
    const speed = flow / (Math.PI * (d / 2) ** 2), reynolds = w.density * speed * d / viscosity(values.temperature);
    return {values, flow, rise, full: w.jarHeight / rise, reynolds, viscosity: viscosity(values.temperature), marks: Array.from({length: 13}, (_, h) => Math.min(w.jarHeight, rise * h))};
  }
  const empties = emptyTime(values.design, bore);
  return {values, empties, volume: potVolume(values.design), firstHour: w.height - outflowLevel(values.design, bore, 1), marks: Array.from({length: 13}, (_, h) => outflowLevel(values.design, bore, h))};
}

export function sampleWaterClock(input = {}, hours = 0) {
  validTime(hours);
  const plan = waterClockPlan(input), clock = Math.min(WATER.duration, hours);
  if (plan.values.design === 2) {
    const level = Math.min(WATER.jarHeight, plan.rise * clock);
    return {...plan, clock, level, shows: level / plan.rise, collected: level * Math.PI * WATER.jar ** 2, complete: clock >= WATER.duration};
  }
  const level = outflowLevel(plan.values.design, plan.values.bore / 1000, clock);
  const marks = plan.marks, below = marks.findIndex(mark => mark <= level + 1e-12);
  const shows = below <= 0 ? 0 : below - 1 + (marks[below - 1] - level) / (marks[below - 1] - marks[below]);
  const speed = plan.values.design === 1 ? WATER.discharge * Math.PI * (plan.values.bore / 2000) ** 2 * Math.sqrt(2 * WATER.g * WATER.height) / (Math.PI * WATER.radius ** 2) : WATER.discharge * Math.PI * (plan.values.bore / 2000) ** 2 * Math.sqrt(2 * WATER.g * level) / (Math.PI * WATER.radius ** 2);
  return {...plan, clock, level, shows, fallRate: speed * 3600, complete: clock >= WATER.duration};
}

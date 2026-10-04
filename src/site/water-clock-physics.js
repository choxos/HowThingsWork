import {validateControls, validTime} from './physics-kit.js';

// Original equal-hour teaching apparatus, not a measured ancient artifact.
// SI units internally; the playback clock is in hours. Inflow is a prescribed
// constant volumetric rate. Outflow is quasi-steady Q = Cd a sqrt(2gh).
export const DESIGNS = Object.freeze([
  Object.freeze({value: 0, label: 'Cylindrical outflow pot'}),
  Object.freeze({value: 1, label: 'Conical outflow pot'}),
  Object.freeze({value: 2, label: 'Inflow clock with gears'}),
]);
export const WATER = Object.freeze({
  g: 9.81, density: 1000, discharge: .62, height: .4, radius: .15, bottomRadius: .08,
  referenceBore: .001, jar: .04, jarHeight: .3, initialLevel: .03, overflowLevel: .27,
  floatRadius: .024, floatHeight: .04, movingMass: .04,
  teeth: 36, module: .002, pitchRadius: .036, dialHours: 12,
  duration: 12, step: 1,
});
export const WATER_DEFAULTS = Object.freeze({design: 2, rate: 100, bore: 1});
export const WATER_DOMAINS = Object.freeze({design: [0, 2, 1], rate: [0, 200, 10], bore: [.6, 2, .1]});

export const jarArea = Math.PI * WATER.jar ** 2;
export const referenceRise = 2 * Math.PI * WATER.pitchRadius / WATER.dialHours;
export const referenceFlow = jarArea * referenceRise / 3600;
export const displacedVolume = WATER.movingMass / WATER.density;
export const floatDraft = displacedVolume / (Math.PI * WATER.floatRadius ** 2);
export const potRadius = (design, h) => design === 1 ? WATER.bottomRadius + (WATER.radius - WATER.bottomRadius) * h / WATER.height : WATER.radius;
export const potArea = (design, h) => Math.PI * potRadius(design, h) ** 2;

/** Volume below h for the cylinder or straight-sided conical frustum. */
export function potVolume(design, h = WATER.height) {
  const a = design === 1 ? WATER.bottomRadius : WATER.radius;
  const b = design === 1 ? (WATER.radius - WATER.bottomRadius) / WATER.height : 0;
  return Math.PI * (a * a * h + a * b * h * h + b * b * h ** 3 / 3);
}

/** Integral of A(h)/sqrt(h), with its finite value at zero. */
export function drainageIntegral(design, h) {
  const a = design === 1 ? WATER.bottomRadius : WATER.radius;
  const b = design === 1 ? (WATER.radius - WATER.bottomRadius) / WATER.height : 0;
  return Math.PI * (2 * a * a * Math.sqrt(h) + 4 * a * b * h ** 1.5 / 3 + 2 * b * b * h ** 2.5 / 5);
}
const drainageFactor = bore => WATER.discharge * Math.PI * (bore / 2) ** 2 * Math.sqrt(2 * WATER.g);
export const emptyTime = (design, bore) => drainageIntegral(design, WATER.height) / drainageFactor(bore) / 3600;

/** Invert the integrated drainage equation; no step-size-dependent emptying. */
export function outflowLevel(design, bore, hours) {
  const target = drainageIntegral(design, WATER.height) - drainageFactor(bore) * hours * 3600;
  if (target <= 0) return 0;
  if (hours === 0) return WATER.height;
  if (design === 0) return (target / (2 * Math.PI * WATER.radius ** 2)) ** 2;
  let lo = 0, hi = WATER.height;
  for (let i = 0; i < 54; i++) {const mid = (lo + hi) / 2; if (drainageIntegral(design, mid) < target) lo = mid; else hi = mid;}
  return (lo + hi) / 2;
}
export const inflowRate = rate => referenceFlow * rate / 100;

export function waterClockPlan(input = {}) {
  const values = validateControls(input, WATER_DEFAULTS, WATER_DOMAINS, 'water clock');
  if (values.design === 2) {
    const flow = inflowRate(values.rate), rise = flow * 3600 / jarArea;
    return {values, flow, rise, full: rise ? (WATER.overflowLevel - WATER.initialLevel) / rise : Infinity,
      initialVolume: jarArea * WATER.initialLevel - displacedVolume,
      capacity: jarArea * WATER.overflowLevel - displacedVolume,
      marks: Array.from({length: 13}, (_, h) => WATER.initialLevel + referenceRise * h)};
  }
  const referenceEmpty = emptyTime(values.design, WATER.referenceBore);
  const marks = Array.from({length: Math.floor(referenceEmpty) + 1}, (_, h) => outflowLevel(values.design, WATER.referenceBore, h));
  return {values, empties: emptyTime(values.design, values.bore / 1000), referenceEmpty, initialVolume: potVolume(values.design), marks};
}

export function sampleWaterPlan(plan, hours = 0) {
  validTime(hours);
  const clock = Math.min(WATER.duration, hours), {values} = plan;
  if (values.design === 2) {
    const incoming = plan.flow * clock * 3600, room = plan.capacity - plan.initialVolume;
    const retained = Math.min(room, incoming), overflow = Math.max(0, incoming - room);
    const travel = retained / jarArea, level = WATER.initialLevel + travel, shows = travel / referenceRise;
    const full = clock >= plan.full;
    return {...plan, clock, level, travel, shows, error: shows - clock, incoming, retained, overflow,
      volume: plan.initialVolume + retained, collected: overflow, displacedVolume, floatDraft,
      floatBottom: level - floatDraft, floatTop: level - floatDraft + WATER.floatHeight,
      buoyancy: WATER.movingMass * WATER.g, handAngle: -travel / WATER.pitchRadius,
      riseRate: full ? 0 : plan.rise, outflow: full ? plan.flow : 0,
      stopped: full || plan.flow === 0, phase: full ? 'Receiver overflowing; hand stopped' : plan.flow === 0 ? 'Inlet closed; hand stopped' : 'Water raises the float and turns the hand', complete: clock >= WATER.duration};
  }
  const level = outflowLevel(values.design, values.bore / 1000, clock);
  const volume = potVolume(values.design, level), collected = plan.initialVolume - volume;
  const flow = drainageFactor(values.bore / 1000) * Math.sqrt(level);
  const shows = Math.min(plan.referenceEmpty, clock * (values.bore / (WATER.referenceBore * 1000)) ** 2);
  return {...plan, clock, level, volume, collected, flow, shows, error: shows - clock,
    fallRate: flow / potArea(values.design, level) * 3600, incoming: 0, overflow: 0,
    stopped: level === 0, phase: level === 0 ? 'Pot empty; indication stopped' : 'Water drains past the fixed hour marks', complete: clock >= WATER.duration};
}
export const sampleWaterClock = (input = {}, hours = 0) => sampleWaterPlan(waterClockPlan(input), hours);

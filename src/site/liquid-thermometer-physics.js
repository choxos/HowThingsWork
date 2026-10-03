import {validateControls, validTime} from './physics-kit.js';

export const LIQUID_GLASS_DEFAULTS = Object.freeze({liquid: 1, bore: 0.3, initial: 20, surroundings: 0, response: 60});
export const LIQUID_GLASS_DOMAINS = Object.freeze({liquid: [0, 1, 1], bore: [0.15, 0.5, 0.05], initial: [-20, 40, 5], surroundings: [-50, 60, 5], response: [5, 120, 5]});
export const THERMOMETRIC_LIQUIDS = Object.freeze([
  Object.freeze({value: 0, label: 'Mercury comparison', expansion: 180e-6, freezing: -38.84, color: 0x66747b}),
  Object.freeze({value: 1, label: 'Colored ethanol', expansion: 1100e-6, freezing: -114, color: 0x993d2b}),
]);
export const LIQUID_GLASS = Object.freeze({reference: 20, expansion: 9e-6, bulbRadius: 3, chamberRadius: 2.3, stemTop: 200, referenceColumn: 100, duration: 900, speed: 45});

const cavities = new Map();
const segmentVolume = (a, b, y = b[1]) => {
  const h = y - a[1], slope = (b[0] - a[0]) / (b[1] - a[1]);
  return Math.PI * (a[0] ** 2 * h + a[0] * slope * h ** 2 + slope ** 2 * h ** 3 / 3);
};

/** Circular frusta define the same continuous cavity used by the drawing; lengths are millimeters and volumes cubic millimeters. */
export function liquidCavity(bore) {
  if (cavities.has(bore)) return cavities.get(bore);
  if (!Number.isFinite(bore) || bore < .15 || bore > .5) throw new RangeError('Bore must lie between 0.15 and 0.5 mm');
  const a = bore / 2, {bulbRadius: R, chamberRadius: C, stemTop} = LIQUID_GLASS, points = [], segments = 256;
  const lowerEnd = Math.acos(a / R), upperStart = -Math.acos(a / C), upperCenter = stemTop + Math.sqrt(C * C - a * a);
  for (let i = 0; i <= segments; i++) {
    const angle = -Math.PI / 2 + (lowerEnd + Math.PI / 2) * i / segments;
    points.push([i ? R * Math.cos(angle) : 0, R * Math.sin(angle)]);
  }
  points.at(-1)[0] = a;
  const neck = points.at(-1)[1]; points.push([a, stemTop]);
  for (let i = 1; i <= segments; i++) {
    const angle = upperStart + (Math.PI / 2 - upperStart) * i / segments;
    points.push([i === segments ? 0 : C * Math.cos(angle), upperCenter + C * Math.sin(angle)]);
  }
  const volumes = [0];
  for (let i = 1; i < points.length; i++) volumes.push(volumes.at(-1) + segmentVolume(points[i - 1], points[i]));
  const result = Object.freeze({points: Object.freeze(points.map(Object.freeze)), volumes: Object.freeze(volumes), neck, upperCenter, stemTop, capacity: volumes.at(-1), bulbVolume: volumes[segments], area: Math.PI * a * a});
  cavities.set(bore, result); return result;
}

export function cavityVolume(cavity, y) {
  if (y <= cavity.points[0][1]) return 0;
  if (y >= cavity.points.at(-1)[1]) return cavity.capacity;
  let lo = 0, hi = cavity.points.length - 1;
  while (hi - lo > 1) {const mid = (lo + hi) >> 1; if (cavity.points[mid][1] <= y) lo = mid; else hi = mid;}
  return cavity.volumes[lo] + segmentVolume(cavity.points[lo], cavity.points[hi], y);
}

export function cavityHeight(cavity, volume) {
  if (!Number.isFinite(volume) || volume < 0 || volume > cavity.capacity) throw new RangeError('Liquid volume must fit inside the cavity');
  let lo = 0, hi = cavity.volumes.length - 1;
  while (hi - lo > 1) {const mid = (lo + hi) >> 1; if (cavity.volumes[mid] <= volume) lo = mid; else hi = mid;}
  let bottom = cavity.points[lo][1], top = cavity.points[hi][1];
  for (let i = 0; i < 44; i++) {
    const y = (bottom + top) / 2;
    if (cavity.volumes[lo] + segmentVolume(cavity.points[lo], cavity.points[hi], y) < volume) bottom = y; else top = y;
  }
  return (bottom + top) / 2;
}

/** Height of an engraved mark in the reference glass geometry. Both marks and vessel subsequently expand together. */
export function thermometerMark(plan, temperature) {
  const delta = temperature - LIQUID_GLASS.reference;
  const volume = plan.referenceVolume * (1 + plan.liquid.expansion * delta) / (1 + LIQUID_GLASS.expansion * delta);
  return plan.cavity.neck + (volume - plan.cavity.bulbVolume) / plan.cavity.area;
}

export function liquidThermometerPlan(input = {}) {
  const values = validateControls(input, LIQUID_GLASS_DEFAULTS, LIQUID_GLASS_DOMAINS, 'liquid-in-glass thermometer');
  const liquid = THERMOMETRIC_LIQUIDS[values.liquid], cavity = liquidCavity(values.bore);
  const referenceVolume = cavity.bulbVolume + cavity.area * LIQUID_GLASS.referenceColumn;
  const atHeight = y => {const ratio = (cavity.bulbVolume + cavity.area * (y - cavity.neck)) / referenceVolume; return LIQUID_GLASS.reference + (ratio - 1) / (liquid.expansion - ratio * LIQUID_GLASS.expansion);};
  const low = atHeight(cavity.neck), high = atHeight(cavity.stemTop), step = values.surroundings - values.initial;
  const phaseTime = values.surroundings < liquid.freezing ? values.response * Math.log((values.initial - values.surroundings) / (liquid.freezing - values.surroundings)) : Infinity;
  const settle = Math.abs(step) > .5 ? values.response * Math.log(Math.abs(step) / .5) : 0;
  return {values, liquid, cavity, referenceVolume, low, high, sensitivity: referenceVolume * (liquid.expansion - LIQUID_GLASS.expansion) / cavity.area,
    phaseTime, settle: settle < phaseTime ? settle : null, markedLow: Math.max(-50, liquid.freezing, low), markedHigh: Math.min(60, high)};
}

/** A prescribed first-order response is an ideal comparison, not a prediction for a particular bath or thermometer. */
export function sampleLiquidThermometer(input = {}, time = 0) {
  validTime(time);
  const p = liquidThermometerPlan(input), requestedTime = Math.min(time, LIQUID_GLASS.duration), clock = Math.min(requestedTime, p.phaseTime);
  const phaseLimit = clock >= p.phaseTime, temperature = phaseLimit ? p.liquid.freezing : p.values.surroundings + (p.values.initial - p.values.surroundings) * Math.exp(-clock / p.values.response);
  const delta = temperature - LIQUID_GLASS.reference, glassVolumeFactor = 1 + LIQUID_GLASS.expansion * delta, growth = Math.cbrt(glassVolumeFactor);
  const liquidVolume = p.referenceVolume * (1 + p.liquid.expansion * delta), equivalentVolume = liquidVolume / glassVolumeFactor;
  const meniscus = cavityHeight(p.cavity, equivalentVolume), inCapillary = meniscus >= p.cavity.neck && meniscus <= p.cavity.stemTop;
  const status = phaseLimit ? 'phase-limit' : meniscus < p.cavity.neck ? 'below-capillary' : meniscus > p.cavity.stemTop ? 'expansion-chamber' : 'readable';
  return {...p, requestedTime, clock, temperature, growth, glassVolumeFactor, liquidVolume, equivalentVolume, meniscus, inCapillary, phaseLimit, status,
    reading: status === 'readable' ? temperature : null, gap: p.values.surroundings - temperature,
    relativeVolumeChange: liquidVolume - p.referenceVolume * glassVolumeFactor,
    complete: phaseLimit || clock >= LIQUID_GLASS.duration};
}

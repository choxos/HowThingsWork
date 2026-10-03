import {validateControls, validTime} from './physics-kit.js';

export const MAX_MIN_DEFAULTS = Object.freeze({mean: 12, swing: 8, response: 600});
export const MAX_MIN_DOMAINS = Object.freeze({mean: [-10, 30, 1], swing: [0, 15, 1], response: [0, 1800, 60]});
export const MAX_MIN = Object.freeze({reference: 20, alcoholExpansion: .0011, mercuryExpansion: .00018, glassExpansion: .000009,
  bore: 1, arm: 12, bottom: -90, top: 90, bulbRadius: 6, markerLength: 4, duration: 24, speed: .25, resetDuration: 6});

const frustumVolume = (a, b, y = b[1]) => {
  const h = y - a[1], slope = (b[0] - a[0]) / (b[1] - a[1]);
  return Math.PI * (a[0] ** 2 * h + a[0] * slope * h ** 2 + slope ** 2 * h ** 3 / 3);
};
const R = MAX_MIN.bulbRadius, a = MAX_MIN.bore / 2, start = -Math.acos(a / R), center = MAX_MIN.top + Math.sqrt(R * R - a * a);
const points = Array.from({length: 257}, (_, i) => {
  const angle = start + (Math.PI / 2 - start) * i / 256;
  return Object.freeze([i === 256 ? 0 : i === 0 ? a : R * Math.cos(angle), i === 0 ? MAX_MIN.top : center + R * Math.sin(angle)]);
});
const volumes = [0];
for (let i = 1; i < points.length; i++) volumes.push(volumes.at(-1) + frustumVolume(points[i - 1], points[i]));
export const SIX_RESERVOIR = Object.freeze({points: Object.freeze(points), volumes: Object.freeze(volumes), capacity: volumes.at(-1), center, area: Math.PI * a * a});

export function reservoirVolume(y) {
  if (!Number.isFinite(y)) throw new RangeError('Reservoir height must be finite');
  if (y <= MAX_MIN.top) return 0;
  if (y >= points.at(-1)[1]) return SIX_RESERVOIR.capacity;
  const i = points.findIndex(p => p[1] >= y);
  return volumes[i - 1] + frustumVolume(points[i - 1], points[i], y);
}

export function reservoirHeight(volume) {
  if (!Number.isFinite(volume) || volume < 0 || volume > SIX_RESERVOIR.capacity) throw new RangeError('Reservoir volume must fit inside the bulb');
  let low = MAX_MIN.top, high = points.at(-1)[1];
  for (let i = 0; i < 45; i++) {const mid = (low + high) / 2; if (reservoirVolume(mid) < volume) low = mid; else high = mid;}
  return (low + high) / 2;
}

const area = SIX_RESERVOIR.area, leftReference = SIX_RESERVOIR.capacity + area * MAX_MIN.top;
const mercuryReference = area * (Math.PI * MAX_MIN.arm - 2 * MAX_MIN.bottom);
const rightReference = area * MAX_MIN.top + SIX_RESERVOIR.capacity / 2;
export const SIX_FILL = Object.freeze({left: leftReference, mercury: mercuryReference, right: rightReference});

/** All levels are reference-glass coordinates in millimeters. The drawing and engraved scales expand together. */
export function sixLevels(temperature) {
  if (!Number.isFinite(temperature) || temperature < -30 || temperature > 50) throw new RangeError('Temperature must lie between -30 and 50 °C');
  const delta = temperature - MAX_MIN.reference, glassFactor = 1 + MAX_MIN.glassExpansion * delta;
  const alcoholFactor = (1 + MAX_MIN.alcoholExpansion * delta) / glassFactor, mercuryFactor = (1 + MAX_MIN.mercuryExpansion * delta) / glassFactor;
  const leftVolume = leftReference * alcoholFactor, mercuryVolume = mercuryReference * mercuryFactor, rightVolume = rightReference * alcoholFactor;
  const left = MAX_MIN.top - (leftVolume - SIX_RESERVOIR.capacity) / area;
  const right = mercuryVolume / area - Math.PI * MAX_MIN.arm + 2 * MAX_MIN.bottom - left;
  const receivingVolume = rightVolume - area * (MAX_MIN.top - right), receivingLevel = reservoirHeight(receivingVolume);
  return {temperature, left, right, receivingLevel, receivingVolume, gasVolume: (SIX_RESERVOIR.capacity - receivingVolume) * glassFactor,
    leftVolume, mercuryVolume, rightVolume, glassFactor, growth: Math.cbrt(glassFactor)};
}

export function maximumMinimumPlan(input = {}) {
  const values = validateControls(input, MAX_MIN_DEFAULTS, MAX_MIN_DOMAINS, 'maximum-minimum thermometer');
  const omega = 2 * Math.PI / 24, responseHours = values.response / 3600, lag = Math.atan(omega * responseHours) / omega;
  const amplitude = values.swing / Math.hypot(1, omega * responseHours);
  return {values, omega, lag, amplitude, peak: 6 + lag, trough: 18 + lag};
}

export const sixTemperature = (plan, hours) => plan.values.mean + plan.amplitude * Math.cos(plan.omega * (hours - plan.peak));

/** Endpoint-inclusive exact extrema of the prescribed steady periodic response, independent of animation step size. */
export function sampleMaximumMinimum(input = {}, hours = 0, resetAt = 0) {
  validTime(hours); validTime(resetAt);
  const p = maximumMinimumPlan(input), clock = Math.min(hours, MAX_MIN.duration);
  if (resetAt > clock) throw new RangeError('Recording cannot start after the current time');
  const candidates = [resetAt, clock];
  for (const base of [p.peak, p.trough]) for (let k = -1; k <= 1; k++) {const time = base + 24 * k; if (time >= resetAt && time <= clock) candidates.push(time);}
  candidates.sort((x, y) => x - y);
  let highest = -Infinity, lowest = Infinity, highAt = resetAt, lowAt = resetAt;
  for (const time of candidates) {const T = sixTemperature(p, time); if (T > highest) {highest = T; highAt = time;} if (T < lowest) {lowest = T; lowAt = time;}}
  const temperature = sixTemperature(p, clock), levels = sixLevels(temperature);
  return {...p, ...levels, clock, resetAt, highest, lowest, highAt, lowAt, maxIndex: sixLevels(highest).right, minIndex: sixLevels(lowest).left,
    air: p.values.mean + p.values.swing * Math.cos(p.omega * (clock - 6)), complete: clock >= MAX_MIN.duration};
}

export function sixClock(hours) {
  const minutes = Math.round((9 + hours) * 60), day = minutes >= 1440 ? 'Next day ' : '', clock = minutes % 1440, h = Math.floor(clock / 60);
  return `${day}${h % 12 || 12}:${String(clock % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

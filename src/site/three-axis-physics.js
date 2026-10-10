import {printerConstants as printer} from './printer-model.js';
import {followWithLash, trapezoid, trapezoidAt} from './printing-physics.js';

export const positioningConstants = Object.freeze({
  stepsPerTurn: 200, beltLead: 2 * Math.PI * printer.beltRadius / printer.scale,
  screwLead: printer.zLead, zSpeed: printer.zSpeed, clockScale: .5,
});
export const positioningHome = Object.freeze({x: 0, y: 0, z: .2});
export const positioningDefaults = Object.freeze({targetX: 6, targetY: 4, targetZ: 4, speed: 2, acceleration: 4, microsteps: 16, play: 0, roundTrip: 0});
export const positioningDomains = Object.freeze({targetX: [-10, 10, .1], targetY: [-10, 10, .1], targetZ: [.2, 10, .2], speed: [.5, 5, .5], acceleration: [1, 10, 1], microsteps: [1, 16, 15], play: [0, .5, .1], roundTrip: [0, 1, 1]});
const axes = ['x', 'y', 'z'];
const vector = fn => Object.fromEntries(axes.map(axis => [axis, fn(axis)]));

function validPose(pose) {
  if (!pose || axes.some(axis => !Number.isFinite(pose[axis])) || Math.abs(pose.x) > 11 || Math.abs(pose.y) > 11 || pose.z < .19 || pose.z > 10.1) throw new RangeError('Position must be finite and inside the teaching machine');
}

export function planPositioning(input = {}, from = positioningHome, actualFrom = from) {
  const values = {...positioningDefaults, ...input};
  for (const [key, [min, max, step]] of Object.entries(positioningDomains)) {
    const value = values[key];
    if (!Number.isFinite(value) || value < min || value > max || Math.abs((value - min) / step - Math.round((value - min) / step)) > 1e-7) throw new RangeError(`Invalid positioning control: ${key}`);
  }
  validPose(from); validPose(actualFrom);
  if (actualFrom.x < from.x - 1e-9 || actualFrom.x > from.x + values.play + 1e-9 || Math.abs(actualFrom.y - from.y) > 1e-9 || Math.abs(actualFrom.z - from.z) > 1e-9) throw new RangeError('Position must match the X coupling and rigid Y/Z drives');
  const c = positioningConstants, pitch = vector(axis => (axis === 'z' ? c.screwLead : c.beltLead) / (c.stepsPerTurn * values.microsteps));
  const stepsAt = pose => vector(axis => Math.round((pose[axis] - positioningHome[axis]) / pitch[axis]));
  const positionAt = steps => vector(axis => positioningHome[axis] + steps[axis] * pitch[axis]);
  const fromSteps = stepsAt(from);
  if (axes.some(axis => Math.abs(positionAt(fromSteps)[axis] - from[axis]) > 1e-8)) throw new RangeError('Starting motor position must be on the selected step grid');
  const requested = {x: values.targetX, y: values.targetY, z: values.targetZ}, legs = [];
  let drive = {...from}, actual = {...actualFrom}, time = 0;
  for (const target of values.roundTrip ? [requested, positioningHome] : [requested]) {
    const startSteps = stepsAt(drive), targetSteps = stepsAt(target), end = positionAt(targetSteps), deltaSteps = vector(axis => targetSteps[axis] - startSteps[axis]);
    const length = Math.hypot(...axes.map(axis => end[axis] - drive[axis])), dz = Math.abs(end.z - drive.z);
    const feed = Math.min(values.speed, dz > 1e-12 ? c.zSpeed * length / dz : Infinity), profile = trapezoid(length, feed, values.acceleration);
    const endActual = {...end, x: followWithLash(actual.x, end.x, values.play)};
    legs.push({from: drive, actualFrom: actual, requested: {...target}, end, endActual, startSteps, targetSteps, deltaSteps, length, feed, profile, startTime: time});
    time += profile.time; drive = end; actual = endActual;
  }
  return {values, pitch, legs, duration: time, requested, end: drive, endActual: actual};
}

export function positioningAt(plan, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Positioning time must be finite and nonnegative');
  const time = Math.min(seconds, plan.duration), legIndex = plan.legs.length === 2 && time >= plan.legs[1].startTime ? 1 : 0, leg = plan.legs[legIndex];
  const localTime = Math.min(leg.profile.time, Math.max(0, time - leg.startTime)), reference = trapezoidAt(leg.profile, localTime, plan.values.acceleration);
  const fraction = leg.length > 0 ? reference.distance / leg.length : 1;
  const pulses = vector(axis => Math.min(Math.abs(leg.deltaSteps[axis]), Math.floor(Math.abs(leg.deltaSteps[axis]) * fraction + 1e-9)));
  const steps = vector(axis => leg.startSteps[axis] + Math.sign(leg.deltaSteps[axis]) * pulses[axis]);
  const drive = vector(axis => positioningHome[axis] + steps[axis] * plan.pitch[axis]);
  const position = {...drive, x: followWithLash(leg.actualFrom.x, drive.x, plan.values.play)};
  const error = vector(axis => position[axis] - leg.requested[axis]);
  return {time, leg: legIndex, fraction, drive, position, steps, pulses, requested: {...leg.requested}, error, distanceError: Math.hypot(...Object.values(error)), gap: position.x - drive.x, pathSpeed: reference.speed, complete: time >= plan.duration, progress: plan.duration > 0 ? time / plan.duration : 1};
}

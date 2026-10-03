import {WATCH_GEARS as N} from './watch-physics.js';
import {WATCH_ESCAPEMENT as E} from './watch-escapement.js';

const TAU = 2 * Math.PI;
const distance = (a, b, module) => (a + b) * module / 2;
const center = [0, 0];
const barrelDistance = distance(N.barrel, N.centerPinion, 0.12);
const barrel = [-barrelDistance / Math.sqrt(2), barrelDistance / Math.sqrt(2)];
const third = [0, -distance(N.center, N.thirdPinion, 0.11)];
const fourth = [distance(N.third, N.fourthPinion, 0.055), third[1]];
const escape = [fourth[0] + distance(N.fourth, N.escapePinion, 0.035), third[1]];
const lever = [escape[0] + E.pivot[0], escape[1] + E.pivot[1]];
const balance = [lever[0], lever[1] + E.balanceDistance];
const motion = [0, distance(N.cannon, N.motion, 0.09)];
export const WATCH_ARBOR_POSITIONS = Object.freeze({barrel, center, third, fourth, escape, lever, balance, motion, hour: center});

const definitions = [
  ['barrel', 'barrel', 0.12, 1.0], ['centerPinion', 'center', 0.12, 1.0],
  ['center', 'center', 0.11, 3.2], ['thirdPinion', 'third', 0.11, 3.2],
  ['third', 'third', 0.055, 3.8], ['fourthPinion', 'fourth', 0.055, 3.8],
  ['fourth', 'fourth', 0.035, 4.4], ['escapePinion', 'escape', 0.035, 4.4],
  ['cannon', 'center', 0.09, -0.6], ['motion', 'motion', 0.09, -0.6],
  ['motionPinion', 'motion', 0.0864, -1.0], ['hour', 'hour', 0.0864, -1.0],
];
export const WATCH_MESH_PAIRS = Object.freeze([
  ['barrel', 'centerPinion'], ['center', 'thirdPinion'], ['third', 'fourthPinion'],
  ['fourth', 'escapePinion'], ['cannon', 'motion'], ['motionPinion', 'hour'],
]);
const gears = Object.fromEntries(definitions.map(([name, arbor, module, z]) => [name, {name, arbor, module, z, teeth: N[name], phase: 0, position: WATCH_ARBOR_POSITIONS[arbor], pressureAngle: Math.PI / 6}]));
for (const [first, second] of WATCH_MESH_PAIRS) {
  const a = gears[first], b = gears[second], line = Math.atan2(b.position[1] - a.position[1], b.position[0] - a.position[0]);
  b.phase = ((a.teeth + b.teeth) * line + b.teeth * Math.PI - Math.PI - a.teeth * a.phase) / b.teeth;
}
export const WATCH_TRAIN_GEARS = Object.freeze(Object.fromEntries(Object.entries(gears).map(([name, gear]) => [name, Object.freeze(gear)])));

export function watchTrainAngles(state) {
  const history = TAU * state.values.hours;
  return {
    barrel: -history / 8 + state.barrel, center: history + state.center,
    third: -history * 6 + state.third, fourth: history * 60 + state.fourth,
    escape: -history * 960 - state.escape, motion: -history / 3 + state.motion,
    hour: history / 12 + state.hour,
  };
}

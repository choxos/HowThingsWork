const TAU = 2 * Math.PI;
export const KINETIC_ARBOR_POSITIONS = Object.freeze({
  weight: [0, 0], generatingIntermediate: [6.72, 0], generator: [6.72, 6.72],
  motor: [6, -6], first: [6, 0], seconds: [0, 0], third: [-6, 0], minute: [0, 0], motion: [0, 5], hour: [0, 0],
});
const definitions = [
  ['weight', 'weight', 160, .08, 3.4], ['generatingPinion', 'generatingIntermediate', 8, .08, 3.4],
  ['generatingWheel', 'generatingIntermediate', 160, .08, 2.4], ['magnetPinion', 'generator', 8, .08, 2.4],
  ['motorPinion', 'motor', 10, 12 / 70, -1], ['firstWheel', 'first', 60, 12 / 70, -1],
  ['firstPinion', 'first', 10, .2, -1.8], ['secondsWheel', 'seconds', 50, .2, -1.8],
  ['secondsPinion', 'seconds', 10, 12 / 70, -2.6], ['thirdWheel', 'third', 60, 12 / 70, -2.6],
  ['thirdPinion', 'third', 10, 12 / 110, -3.4], ['minuteWheel', 'minute', 100, 12 / 110, -3.4],
  ['cannon', 'minute', 12, 10 / 48, -4.2], ['motionWheel', 'motion', 36, 10 / 48, -4.2],
  ['motionPinion', 'motion', 10, .2, -5], ['hourWheel', 'hour', 40, .2, -5],
];
export const KINETIC_MESH_PAIRS = Object.freeze([
  ['weight', 'generatingPinion'], ['generatingWheel', 'magnetPinion'],
  ['motorPinion', 'firstWheel'], ['firstPinion', 'secondsWheel'],
  ['secondsPinion', 'thirdWheel'], ['thirdPinion', 'minuteWheel'],
  ['cannon', 'motionWheel'], ['motionPinion', 'hourWheel'],
]);
const gears = Object.fromEntries(definitions.map(([name, arbor, teeth, module, z]) => [name, {name, arbor, teeth, module, z, phase: 0, pressureAngle: Math.PI / 6, position: KINETIC_ARBOR_POSITIONS[arbor]}]));
for (const [first, second] of KINETIC_MESH_PAIRS) {
  const a = gears[first], b = gears[second], line = Math.atan2(b.position[1] - a.position[1], b.position[0] - a.position[0]);
  b.phase = ((a.teeth + b.teeth) * line + b.teeth * Math.PI - Math.PI - a.teeth * a.phase) / b.teeth;
}
export const KINETIC_GEARS = Object.freeze(Object.fromEntries(Object.entries(gears).map(([name, gear]) => [name, Object.freeze(gear)])));
export function kineticTrainAngles(state) {
  const motor = state.stroke * Math.PI;
  return {weight: state.motion.weight, generatingIntermediate: -20 * state.motion.weight, generator: 400 * state.motion.weight,
    motor, first: -motor / 6, seconds: motor / 30, third: -motor / 180, minute: motor / 1800, motion: -motor / 5400, hour: motor / 21600};
}
export const kineticHandAngles = state => ({seconds: TAU * state.stroke / 60, minute: TAU * state.stroke / 3600, hour: TAU * state.stroke / 43200});

const TAU = 2 * Math.PI;
export const CLOCK_ARBOR_POSITIONS = Object.freeze({motor: [12, -12], first: [12, 0], seconds: [0, 0], third: [-12, 0], minute: [0, 0], motion: [0, 10], hour: [0, 0]});
const definitions = [
  ['motorPinion', 'motor', 10, 24 / 70, 13], ['firstWheel', 'first', 60, 24 / 70, 13],
  ['firstPinion', 'first', 10, .4, 11], ['secondsWheel', 'seconds', 50, .4, 11],
  ['secondsPinion', 'seconds', 10, 24 / 70, 9], ['thirdWheel', 'third', 60, 24 / 70, 9],
  ['thirdPinion', 'third', 10, 24 / 110, 7], ['minuteWheel', 'minute', 100, 24 / 110, 7],
  ['cannon', 'minute', 12, 20 / 48, 5], ['motionWheel', 'motion', 36, 20 / 48, 5],
  ['motionPinion', 'motion', 10, .4, 3], ['hourWheel', 'hour', 40, .4, 3],
];
export const CLOCK_MESH_PAIRS = Object.freeze([
  ['motorPinion', 'firstWheel'], ['firstPinion', 'secondsWheel'], ['secondsPinion', 'thirdWheel'],
  ['thirdPinion', 'minuteWheel'], ['cannon', 'motionWheel'], ['motionPinion', 'hourWheel'],
]);
const gears = Object.fromEntries(definitions.map(([name, arbor, teeth, module, z]) => [name, {name, arbor, teeth, module, z, phase: 0, pressureAngle: Math.PI / 6, position: CLOCK_ARBOR_POSITIONS[arbor]}]));
for (const [first, second] of CLOCK_MESH_PAIRS) {
  const a = gears[first], b = gears[second], line = Math.atan2(b.position[1] - a.position[1], b.position[0] - a.position[0]);
  b.phase = ((a.teeth + b.teeth) * line + b.teeth * Math.PI - Math.PI - a.teeth * a.phase) / b.teeth;
}
export const CLOCK_GEARS = Object.freeze(Object.fromEntries(Object.entries(gears).map(([name, gear]) => [name, Object.freeze(gear)])));
export function clockTrainAngles(ticks) {
  const motor = ticks * Math.PI;
  return {motor, first: -motor / 6, seconds: motor / 30, third: -motor / 180, minute: motor / 1800, motion: -motor / 5400, hour: motor / 21600};
}
export const clockHandAngles = seconds => ({seconds: TAU * seconds / 60, minute: TAU * seconds / 3600, hour: TAU * seconds / 43200});

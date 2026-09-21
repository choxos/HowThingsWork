import {validateControls, validTime} from './physics-kit.js';
import {ESCAPEMENT, PALLETS, impulseContact, sampleEscapement, toWheel} from './clock-escapement.js';

// Settled simple-pendulum model, SI units. Mechanical work per beat comes from
// drum travel through the fixed tooth counts. Q sets the equilibrium swing;
// a finite-amplitude period sets its pace. No transient startup, impact,
// suspension-spring, or escapement-induced timing correction is simulated.

export const RODS = Object.freeze([
  Object.freeze({value: 0, label: 'Steel rod', expansion: 11.5e-6}),
  Object.freeze({value: 1, label: 'Brass rod', expansion: 19e-6}),
  Object.freeze({value: 2, label: 'Invar rod', expansion: 1.2e-6}),
]);
export const CARE = Object.freeze([
  Object.freeze({value: 0, label: 'Clean and oiled', Q: 3000}),
  Object.freeze({value: 1, label: 'Dry and dirty', Q: 1000}),
]);
export const GEAR_TEETH = Object.freeze({barrel: 160, centerPinion: 20, center: 120, thirdPinion: 20, third: 200, escapePinion: 20, cannon: 30, motion: 90, motionPinion: 18, hour: 72});
export const GEAR_RATIOS = Object.freeze({barrelCenter: GEAR_TEETH.barrel / GEAR_TEETH.centerPinion, centerThird: GEAR_TEETH.center / GEAR_TEETH.thirdPinion, thirdEscape: GEAR_TEETH.third / GEAR_TEETH.escapePinion, minuteMotion: GEAR_TEETH.cannon / GEAR_TEETH.motion, motionHour: GEAR_TEETH.motionPinion / GEAR_TEETH.hour});
const TAU = 2 * Math.PI;
const ESCAPE_PER_BARREL = GEAR_RATIOS.barrelCenter * GEAR_RATIOS.centerThird * GEAR_RATIOS.thirdEscape;
export const CLOCK = Object.freeze({g: 9.81, bob: 1.5, fall: 0.15, drumRadius: 0.15 / (TAU * 24 / GEAR_RATIOS.barrelCenter), efficiency: 0.25, release: ESCAPEMENT.lift + ESCAPEMENT.dropTravel, reference: 20, teeth: ESCAPEMENT.teeth, day: 86400});
export const CLOCK_DEFAULTS = Object.freeze({length: 993.8, rod: 0, temperature: 20, weight: 3, care: 0});
export const CLOCK_DOMAINS = Object.freeze({length: [990, 1000, 0.01], rod: [0, 2, 1], temperature: [10, 30, 1], weight: [1, 5, 0.5], care: [0, 1, 1]});
export const DESIGN_PERIOD = 2;
export const circularError = theta => 1 + theta ** 2 / 16 + 11 * theta ** 4 / 3072;
export const hotLength = values => values.length / 1000 * (1 + RODS[values.rod].expansion * (values.temperature - CLOCK.reference));
export const weightPower = values => { const s = swing(values); return s.running ? s.beatWork * 2 / s.period : 0; };

export function swing(values) {
  const L = hotLength(values), Q = CARE[values.care].Q;
  const beatDrop = CLOCK.drumRadius * Math.PI / CLOCK.teeth / ESCAPE_PER_BARREL;
  const beatWork = values.weight * CLOCK.g * beatDrop;
  const availableBeatEnergy = beatWork * CLOCK.efficiency;
  const supportedEnergy = Q * 2 * availableBeatEnergy / TAU;
  const theta = Math.acos(1 - supportedEnergy / (CLOCK.bob * CLOCK.g * L));
  const small = TAU * Math.sqrt(L / CLOCK.g), period = small * circularError(theta);
  const running = theta > CLOCK.release && theta <= ESCAPEMENT.maxAmplitude;
  return {L, Q, theta, period, small, running, beatDrop, beatWork, supportedEnergy, availableBeatEnergy, energy: running ? supportedEnergy : 0, power: running ? 2 * availableBeatEnergy / period : 0};
}

export function clockPlan(input = {}) {
  const values = validateControls(input, CLOCK_DEFAULTS, CLOCK_DOMAINS, 'pendulum clock'), s = swing(values);
  const rate = s.running ? CLOCK.day * (DESIGN_PERIOD / s.period - 1) : null;
  return {...s, values, design: DESIGN_PERIOD, rate, week: rate === null ? null : 7 * rate, beatEnergy: s.running ? s.availableBeatEnergy : 0, lossPerSwing: s.running ? Math.PI * s.energy / s.Q : 0, growth: s.L - values.length / 1000};
}

function stoppedContact(plan) {
  const wheelTorque = plan.values.weight * CLOCK.g * CLOCK.drumRadius / ESCAPE_PER_BARREL * CLOCK.efficiency;
  let angle = 0, hit;
  for (let i = 0; i < 8; i++) {
    hit = impulseContact(0, angle);
    const a = toWheel(PALLETS[0].a, angle), b = toWheel(PALLETS[0].b, angle), force = [a[1] - b[1], b[0] - a[0]];
    const escapeMoment = -(hit.point[0] * force[1] - hit.point[1] * force[0]);
    const anchorMoment = hit.point[0] * force[1] - (hit.point[1] - ESCAPEMENT.pivotHeight) * force[0];
    angle = Math.asin(wheelTorque * anchorMoment / escapeMoment / (CLOCK.bob * CLOCK.g * plan.L));
  }
  hit = impulseContact(0, angle);
  return {anchor: angle, escape: hit.turn, contact: hit.point, contactSide: 0, stage: 'Stopped', beats: 0};
}

export function sampleClock(input = {}, time = 0) {
  validTime(time);
  const plan = clockPlan(input), mechanism = plan.running ? sampleEscapement(time / plan.period, plan.theta) : stoppedContact(plan);
  const escape = mechanism.escape;
  const center = -escape / (GEAR_RATIOS.centerThird * GEAR_RATIOS.thirdEscape), third = escape / GEAR_RATIOS.thirdEscape, barrel = escape / ESCAPE_PER_BARREL;
  const motion = -center * GEAR_RATIOS.minuteMotion, hour = -motion * GEAR_RATIOS.motionHour;
  return {...plan, ...mechanism, time, angle: mechanism.anchor, clockSeconds: escape * 60 / TAU, gears: {barrel, center, third, escape: -escape, cannon: center, motion, hour}, descent: barrel * CLOCK.drumRadius};
}

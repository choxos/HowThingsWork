import {validateControls, validTime} from './physics-kit.js';
import {WATCH_ESCAPEMENT, WATCH_CONTACT_ANGLES, sampleWatchEscapement, watchForkContact, watchPalletContact} from './watch-escapement.js';
import {WATCH_MAINSPRING} from './watch-springs.js';

const TAU = 2 * Math.PI;
export const ALLOYS = Object.freeze([
  Object.freeze({value: 0, label: 'Uncompensated spring', elastic: -240e-6, expansion: 11.5e-6}),
  Object.freeze({value: 1, label: 'Ideally compensated spring', elastic: null, expansion: 8e-6}),
]);
export const WATCH_GEARS = Object.freeze({barrel: 96, centerPinion: 12, center: 60, thirdPinion: 10, third: 100, fourthPinion: 10, fourth: 128, escapePinion: 8, cannon: 12, motion: 36, motionPinion: 10, hour: 40});
const N = WATCH_GEARS;
export const WATCH_RATIOS = Object.freeze({barrelCenter: N.barrel / N.centerPinion, centerThird: N.center / N.thirdPinion, thirdFourth: N.third / N.fourthPinion, fourthEscape: N.fourth / N.escapePinion, hand: N.motion / N.cannon * N.hour / N.motionPinion});
const R = WATCH_RATIOS;
export const ESCAPE_PER_WATCH_BARREL = R.barrelCenter * R.centerThird * R.thirdFourth * R.fourthEscape;
export const WATCH = Object.freeze({
  mass: 49e-6, radius: 4.5e-3, balanceExpansion: 12e-6, frequency: 4,
  modulus: 195e9, width: 0.12e-3, thickness: 0.03e-3, index: 2e-4,
  reference: 20, Q: 250, efficiency: 0.3, turns: WATCH_MAINSPRING.windingTurns,
  reserve: 44, hoursPerTurn: 8, minimum: WATCH_CONTACT_ANGLES.leave,
  teeth: WATCH_ESCAPEMENT.teeth, fourth: R.fourthEscape, day: 86400, slow: 10, duration: 2,
});
export const WATCH_DEFAULTS = Object.freeze({index: 0, alloy: 1, temperature: 20, hours: 0});
export const WATCH_DOMAINS = Object.freeze({index: [-5, 5, 1], alloy: [0, 1, 1], temperature: [0, 40, 1], hours: [0, 44, 1]});
export const balanceInertia = (dT = 0) => WATCH.mass * (WATCH.radius * (1 + WATCH.balanceExpansion * dT)) ** 2;
export const SPRING_LENGTH = WATCH.modulus * WATCH.width * WATCH.thickness ** 3 / (12 * balanceInertia() * (TAU * WATCH.frequency) ** 2);
export const MAINSPRING_STIFFNESS = WATCH_MAINSPRING.modulus * (WATCH_MAINSPRING.height / 1000) * (WATCH_MAINSPRING.thickness / 1000) ** 3 / (12 * WATCH_MAINSPRING.length / 1000);
export const barrelTorque = hours => MAINSPRING_STIFFNESS * TAU * Math.max(0, WATCH.turns - hours / WATCH.hoursPerTurn);

export function balance(input = {}, unwound = 0) {
  const values = validateControls(input, WATCH_DEFAULTS, WATCH_DOMAINS, 'mechanical watch');
  if (!Number.isFinite(unwound) || unwound < -1e-5) throw new RangeError('Invalid watch barrel travel');
  const w = WATCH, alloy = ALLOYS[values.alloy], dT = values.temperature - w.reference;
  const growth = 1 + alloy.expansion * dT, inertia = balanceInertia(dT);
  const modulus = w.modulus * (alloy.elastic === null ? inertia / balanceInertia() / growth ** 3 : 1 + alloy.elastic * dT);
  const length = SPRING_LENGTH * (1 - w.index * values.index) * growth;
  const kappa = modulus * (w.width * growth) * (w.thickness * growth) ** 3 / (12 * length);
  const frequency = Math.sqrt(kappa / inertia) / TAU, period = 1 / frequency;
  const remainingTurns = Math.max(0, w.turns - values.hours / w.hoursPerTurn - unwound / TAU);
  const torque = MAINSPRING_STIFFNESS * TAU * remainingTurns;
  const barrelPerCycle = TAU / (w.teeth * ESCAPE_PER_WATCH_BARREL);
  const meanBeatWork = w.efficiency * torque * barrelPerCycle / 2;
  const settledEnergy = w.Q * meanBeatWork / Math.PI, predictedAmplitude = Math.sqrt(2 * settledEnergy / kappa);
  const running = predictedAmplitude > w.minimum;
  const minimumTorque = kappa * w.minimum ** 2 * Math.PI / (w.Q * w.efficiency * barrelPerCycle);
  const minimumWind = minimumTorque / (MAINSPRING_STIFFNESS * TAU);
  return {
    values, growth, modulus, length, kappa, inertia, frequency, period, torque,
    remainingTurns, remainingHours: remainingTurns * TAU / (barrelPerCycle * frequency * 3600),
    usableHours: Math.max(0, remainingTurns - minimumWind) * TAU / (barrelPerCycle * frequency * 3600),
    mainspringEnergy: MAINSPRING_STIFFNESS * (TAU * remainingTurns) ** 2 / 2,
    predictedAmplitude, amplitude: running ? predictedAmplitude : 0, running,
    energy: running ? settledEnergy : 0, power: running ? 2 * frequency * meanBeatWork : 0,
    beatEnergy: running ? meanBeatWork : 0, rate: running ? w.day * (frequency / w.frequency - 1) : null,
    beatsPerHour: 2 * frequency * 3600,
  };
}

const stoppedPositions = new Map();
function stoppedWatch(plan) {
  const key = plan.torque / plan.kappa;
  if (stoppedPositions.has(key)) return stoppedPositions.get(key);
  const position = angle => {
    const lever = watchForkContact(0, angle), contact = watchPalletContact(0, lever, 'impulse');
    return {lever, contact};
  };
  const load = angle => {
    const epsilon = 1e-6;
    const derivative = -(position(angle + epsilon).contact.angle - position(angle - epsilon).contact.angle) / (2 * epsilon);
    return WATCH.efficiency * plan.torque / ESCAPE_PER_WATCH_BARREL * derivative - plan.kappa * angle;
  };
  let low = 0, high = WATCH_CONTACT_ANGLES.release - 0.001;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (load(middle) > 0) low = middle;
    else high = middle;
  }
  const angle = (low + high) / 2, {lever, contact} = position(angle);
  const result = {balance: angle, lever, contact, contactSide: 0, side: 0, forkContact: 'static contact', dropFraction: null,
    escape: watchPalletContact(0, WATCH_ESCAPEMENT.bank, 'lock').angle - contact.angle,
    beats: 0, stage: 'Stopped; no continuing drive'};
  if (stoppedPositions.size >= 16) stoppedPositions.delete(stoppedPositions.keys().next().value);
  stoppedPositions.set(key, result);
  return result;
}

export function sampleWatch(input = {}, time = 0) {
  validTime(time);
  if (time > WATCH.duration) throw new RangeError('The watch demonstration spans two seconds');
  let plan = balance(input), mechanism;
  if (plan.running) {
    for (let i = 0; i < 3; i++) {
      mechanism = sampleWatchEscapement(plan.frequency * time, plan.amplitude);
      plan = balance(input, mechanism.escape / ESCAPE_PER_WATCH_BARREL);
      if (!plan.running) break;
    }
  }
  if (!plan.running) mechanism = stoppedWatch(plan);
  const escape = mechanism.escape;
  const center = escape / (R.centerThird * R.thirdFourth * R.fourthEscape);
  return {
    ...plan, time, ...mechanism, angle: mechanism.balance, fork: mechanism.lever,
    barrel: -escape / ESCAPE_PER_WATCH_BARREL,
    center, third: -escape / (R.thirdFourth * R.fourthEscape), fourth: escape / R.fourthEscape,
    seconds: escape / R.fourthEscape, minute: center, hour: center / R.hand, motion: -center * N.cannon / N.motion,
  };
}

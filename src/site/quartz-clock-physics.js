import {validateControls, validTime} from './physics-kit.js';

export const QUARTZ_CLOCK = Object.freeze({
  nominal: 32768, referenceLoad: 12.5e-12, motionalCapacitance: 2.25e-15, shuntCapacitance: .9e-12,
  inputCapacitance: 17e-12, outputCapacitance: 25e-12, turnover: 25, temperatureCoefficient: -.035e-6,
  supply: 1.5, pulseCycles: 1536, stages: 15, day: 86400, initialHands: 10 * 3600 + 10 * 60,
  displacement: 20e-9, closeupMagnification: 5000,
});
export const CLOCK_DEFAULTS = Object.freeze({mode: 0, temperature: 25, trimmer: 8, battery: 1});
export const CLOCK_DOMAINS = Object.freeze({mode: [0, 2, 1], temperature: [-10, 50, 1], trimmer: [1.5, 30, .5], battery: [0, 1, 1]});
export const CLOCK_MODES = Object.freeze([
  Object.freeze({value: 0, label: 'Clock working'}),
  Object.freeze({value: 1, label: 'Four crystal cycles'}),
  Object.freeze({value: 2, label: 'Thirty-day timing comparison'}),
]);
const C = QUARTZ_CLOCK, TAU = 2 * Math.PI;

export function crystalLoad(trimmer) {
  if (!Number.isFinite(trimmer) || trimmer < 0) throw new RangeError('Trimmer capacitance must be finite and nonnegative');
  const input = C.inputCapacitance + trimmer * 1e-12;
  return input * C.outputCapacitance / (input + C.outputCapacitance);
}

export function clockFrequency(temperature, trimmer) {
  if (!Number.isFinite(temperature)) throw new RangeError('Crystal temperature must be finite');
  const atReference = 1 + C.motionalCapacitance / (C.shuntCapacitance + C.referenceLoad);
  const atLoad = 1 + C.motionalCapacitance / (C.shuntCapacitance + crystalLoad(trimmer));
  return C.nominal * (1 + C.temperatureCoefficient * (temperature - C.turnover) ** 2) * Math.sqrt(atLoad / atReference);
}

export function quartzClockExperiment(input = {}) {
  const values = validateControls(input, CLOCK_DEFAULTS, CLOCK_DOMAINS, 'quartz clock');
  const frequency = clockFrequency(values.temperature, values.trimmer), ratio = frequency / C.nominal;
  const mode = values.mode === 0 ? {duration: 60 / ratio, speed: 1, step: 1 / ratio}
    : values.mode === 1 ? {duration: 4 / frequency, speed: 1 / 65536, step: 1 / (8 * frequency)}
      : {duration: 30 * C.day, speed: C.day, step: C.day};
  return {...values, values, frequency, ratio, load: crystalLoad(values.trimmer), rate: (ratio - 1) * C.day,
    period: 1 / frequency, motorPeriod: 1 / ratio, pulseWidth: C.pulseCycles / frequency,
    magnification: values.mode === 1 ? C.closeupMagnification : 1, mode};
}

export function sampleQuartzExperiment(input = {}, time = 0) {
  validTime(time);
  const plan = quartzClockExperiment(input), elapsed = Math.min(time, plan.mode.duration);
  const powered = plan.values.battery === 1, cycles = powered ? plan.frequency * elapsed : 0;
  const clockSeconds = cycles / C.nominal, ticks = Math.floor(clockSeconds + 1e-9), phase = Math.max(0, clockSeconds - ticks);
  const pulse = powered && ticks > 0 && phase < C.pulseCycles / C.nominal;
  const motor1 = powered && !(pulse && ticks % 2 === 1) ? C.supply : 0;
  const motor2 = powered && !(pulse && ticks % 2 === 0) ? C.supply : 0;
  const completedCycles = Math.floor(cycles + 1e-7), crystalPhase = (cycles % 1) * TAU;
  return {...plan, time: elapsed, powered, cycles, completedCycles, clockSeconds, ticks, phase, pulse, motor1, motor2,
    motorVoltage: motor1 - motor2, motorAngle: ticks * Math.PI, crystalPhase,
    displacement: powered ? C.displacement * Math.sin(crystalPhase) : 0,
    displayedDisplacement: powered ? C.displacement * plan.magnification * Math.sin(crystalPhase) : 0,
    dividers: Array.from({length: C.stages}, (_, k) => powered ? Math.floor(completedCycles / 2 ** k) % 2 : 0),
    elapsedError: clockSeconds - elapsed, completedHandsError: ticks - Math.floor(elapsed + 1e-9),
    handsTime: C.initialHands + ticks, complete: elapsed >= plan.mode.duration};
}

export function clockFaceTime(seconds) {
  validTime(seconds); const whole = Math.floor(seconds);
  return `${Math.floor(whole / 3600) % 12 || 12}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export function cantileverMode(fraction) {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new RangeError('Tine position must lie between zero and one');
  const beta = 1.875104068711961, sigma = (Math.cosh(beta) + Math.cos(beta)) / (Math.sinh(beta) + Math.sin(beta));
  const shape = x => Math.cosh(beta * x) - Math.cos(beta * x) - sigma * (Math.sinh(beta * x) - Math.sin(beta * x));
  return shape(fraction) / shape(1);
}

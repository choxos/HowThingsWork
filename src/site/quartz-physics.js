import {validateControls, validTime} from './physics-kit.js';

export const QUARTZ = Object.freeze({
  nominal: 32768, turnover: 25, parabola: -0.034e-6, modulus: 78.7e9, density: 2650, thickness: 0.25e-3, mode: 1.87510407, Q: 60000, stages: 15, day: 86400,
  piezo: 2.31e-12, permittivity: 4.5 * 8.854e-12, plateArea: 1e-4, plateThickness: 1e-3, stepsPerSecond: 1, secondsRatio: 30,
  clock: Object.freeze({motor: 3e-3, pulse: 0.032, logic: 10e-6, capacity: 2400}),
});
export const QUARTZ_CLOCK_DEFAULTS = Object.freeze({temperature: 20, trim: 0, squeeze: 10});
export const QUARTZ_CLOCK_DOMAINS = Object.freeze({temperature: [-10, 50, 1], trim: [-10, 10, 0.5], squeeze: [0, 50, 5]});

/** The tine length that rings at 32,768 Hz. */
export const tineLength = () => Math.sqrt(QUARTZ.mode ** 2 * QUARTZ.thickness * Math.sqrt(QUARTZ.modulus / (12 * QUARTZ.density)) / (2 * Math.PI * QUARTZ.nominal));
export const tineFrequency = length => QUARTZ.mode ** 2 / (2 * Math.PI) * QUARTZ.thickness / length ** 2 * Math.sqrt(QUARTZ.modulus / (12 * QUARTZ.density));
export const crystalFrequency = (temperature, trim = 0) => QUARTZ.nominal * (1 + trim * 1e-6) * (1 + QUARTZ.parabola * (temperature - QUARTZ.turnover) ** 2);
export const dailyRate = frequency => QUARTZ.day * (frequency / QUARTZ.nominal - 1);
export const averageCurrent = circuit => circuit.motor * circuit.pulse * QUARTZ.stepsPerSecond + circuit.logic;

export function quartzClockPlan(input = {}) {
  const values = validateControls(input, QUARTZ_CLOCK_DEFAULTS, QUARTZ_CLOCK_DOMAINS, 'quartz clock');
  const frequency = crystalFrequency(values.temperature, values.trim), rate = dailyRate(frequency), current = averageCurrent(QUARTZ.clock);
  const charge = QUARTZ.piezo * values.squeeze, capacitance = QUARTZ.permittivity * QUARTZ.plateArea / QUARTZ.plateThickness;
  return {
    values, frequency, ppm: (frequency / QUARTZ.nominal - 1) * 1e6, rate, month: 30 * rate, year: 365 * rate, tine: tineLength(), ringDown: QUARTZ.Q / (Math.PI * frequency),
    current, life: QUARTZ.clock.capacity * 1e-3 / current / 24 / 365, charge, capacitance, voltage: charge / capacitance,
    stages: Array.from({length: QUARTZ.stages + 1}, (_, k) => frequency / 2 ** k),
  };
}

/** The clock at a moment of real time: crystal cycles, divider stages, steps and hands. */
export function sampleQuartzClock(input = {}, time = 0) {
  validTime(time);
  const plan = quartzClockPlan(input), cycles = plan.frequency * time, steps = Math.floor(cycles / QUARTZ.nominal + 1e-9);
  return {
    ...plan, time, cycles, steps, rotor: steps * Math.PI, secondsHand: steps * 2 * Math.PI / 60,
    dividers: Array.from({length: QUARTZ.stages}, (_, k) => Math.floor(cycles / 2 ** k) % 2),
  };
}

import {validateControls, validTime, clamp} from './physics-kit.js';

// Quartz timekeeping: a tuning fork of quartz ringing 32,768 times a second, a
// chain of 15 halvings down to one pulse a second, and a stepping motor. Plus
// the piezoelectric effect that lets electricity and the crystal talk, and the
// kinetic watch's generator that keeps its store of energy topped up.
//
// Units: SI inside. Readings convert to hertz, parts per million, seconds a
// day, microamps, days.
//
// The fork. Each tine is a quartz cantilever 0.25 mm thick. Its first bending
// mode rings at (1.8751^2 / 2 pi) (t / L^2) sqrt(E / (12 rho)), with E = 78.7 GPa
// and rho = 2,650 kg per cubic meter; the tines are cut to the length that
// rings at 32,768 Hz at 25 degrees. Away from 25 degrees the frequency falls
// by 0.034 parts per million for each degree squared. A trimming capacitor
// pulls it by a few parts per million either way. Its quality factor of 60,000
// means a ring dies away with a time constant of Q / (pi f).
//
// Counting. Fifteen flip-flops each halve the frequency: 32,768 is 2 to the
// 15th, so the last gives one pulse a second. Each pulse turns the stepping
// motor's rotor half a turn, and gears of 30 to 1 move the seconds hand 6
// degrees.
//
// Energy. A wall clock's motor draws 3 mA for 32 ms each second and its
// circuit 10 µA, from a 2,400 mAh AA cell. A watch's draws 0.3 mA for 5 ms and
// 0.1 µA. The kinetic watch stores 5 mAh at 1.5 V and harvests 2 µW sitting at
// a desk, 10 µW walking and 30 µW running while worn.
//
// Piezoelectricity. Squeezing quartz along its electrical axis frees 2.31 pC
// of charge for each newton. On a plate 1 cm square and 1 mm thick, a
// capacitor of relative permittivity 4.5, that charge makes a voltage.
//
// Not modeled: the crystal's aging, its drive-level effects, the motor's
// magnetics, the battery's falling voltage, and the generator's gearing.

export const QUARTZ = Object.freeze({
  nominal: 32768, turnover: 25, parabola: -0.034e-6, modulus: 78.7e9, density: 2650, thickness: 0.25e-3, mode: 1.87510407, Q: 60000, stages: 15, day: 86400,
  piezo: 2.31e-12, permittivity: 4.5 * 8.854e-12, plateArea: 1e-4, plateThickness: 1e-3, stepsPerSecond: 1, secondsRatio: 30,
  clock: Object.freeze({motor: 3e-3, pulse: 0.032, logic: 10e-6, capacity: 2400}),
  watch: Object.freeze({motor: 0.3e-3, pulse: 0.005, logic: 0.1e-6, storage: 5, volts: 1.5}),
});
export const ACTIVITIES = Object.freeze([
  Object.freeze({value: 0, label: 'Sitting at a desk', harvest: 2e-6}),
  Object.freeze({value: 1, label: 'Walking', harvest: 10e-6}),
  Object.freeze({value: 2, label: 'Running', harvest: 30e-6}),
]);
export const QUARTZ_CLOCK_DEFAULTS = Object.freeze({temperature: 20, trim: 0, squeeze: 10});
export const QUARTZ_CLOCK_DOMAINS = Object.freeze({temperature: [-10, 50, 1], trim: [-10, 10, 0.5], squeeze: [0, 50, 5]});
export const KINETIC_DEFAULTS = Object.freeze({activity: 1, worn: 8, start: 20, temperature: 30});
export const KINETIC_DOMAINS = Object.freeze({activity: [0, 2, 1], worn: [0, 16, 1], start: [0, 100, 10], temperature: [-10, 50, 1]});

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

export function kineticPlan(input = {}) {
  const values = validateControls(input, KINETIC_DEFAULTS, KINETIC_DOMAINS, 'kinetic quartz watch'), w = QUARTZ.watch;
  const consumption = averageCurrent(w) * w.volts, store = w.storage * 3.6 * w.volts, harvest = ACTIVITIES[values.activity].harvest;
  const daily = harvest * values.worn * 3600 - consumption * QUARTZ.day, frequency = crystalFrequency(values.temperature);
  return {
    values, consumption, store, harvest, daily, reserve: store / consumption / QUARTZ.day,
    wearToBreakEven: consumption * QUARTZ.day / harvest / 3600, frequency, rate: dailyRate(frequency),
    batteryLife: w.storage * 1e-3 / averageCurrent(w) / 24 / 365,
  };
}

/** The kinetic watch's store after this many days, and whether it still runs. */
export function sampleKinetic(input = {}, days = 0) {
  validTime(days);
  const plan = kineticPlan(input), clockDays = Math.min(30, days), start = plan.values.start / 100 * plan.store;
  const energy = clamp(start + plan.daily * clockDays, 0, plan.store);
  const full = plan.daily > 0 ? (plan.store - start) / plan.daily : null, empty = plan.daily < 0 ? start / -plan.daily : null;
  return {...plan, days: clockDays, energy, level: energy / plan.store, running: energy > 0, full, empty, complete: clockDays >= 30};
}

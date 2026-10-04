import {validateControls, validTime} from './physics-kit.js';

// Typical MS1V-T1K resonator parameters. The gain compression and energy scale
// below are explicit teaching choices, not a fitted transistor or product model.
export const OSCILLATOR = Object.freeze({frequency: 32768, referenceLoad: 12.5e-12,
  motionalCapacitance: 2.25e-15, shuntCapacitance: .9e-12, referenceResistance: 45000,
  referencePower: 100e-9, maximumDrive: 1e-6, duration: 8, slowFactor: 65536});
export const OSCILLATOR_DEFAULTS = Object.freeze({mode: 0, initial: 0, gain: 6, capacitor: 25, resistance: 45});
export const OSCILLATOR_DOMAINS = Object.freeze({mode: [0, 1, 1], initial: [0, 1, 1], gain: [0, 10, .1], capacitor: [12, 40, .5], resistance: [45, 60, 1]});
export const OSCILLATOR_MODES = Object.freeze([{value: 0, label: 'Eight-second amplitude experiment'}, {value: 1, label: 'Four cycles in slow motion'}]);
const C = OSCILLATOR, TAU = 2 * Math.PI;
const INDUCTANCE = (1 + C.motionalCapacitance / (C.shuntCapacitance + C.referenceLoad)) / ((TAU * C.frequency) ** 2 * C.motionalCapacitance);
const ENERGY_SCALE = C.referencePower * INDUCTANCE / C.referenceResistance;

export function oscillatorPlan(input = {}) {
  const values = validateControls(input, OSCILLATOR_DEFAULTS, OSCILLATOR_DOMAINS, 'quartz oscillator');
  const load = values.capacitor * .5e-12, resistance = values.resistance * 1000;
  const capacitance = C.motionalCapacitance * (C.shuntCapacitance + load) / (C.motionalCapacitance + C.shuntCapacitance + load);
  const frequency = 1 / (TAU * Math.sqrt(INDUCTANCE * capacitance));
  // Equal load branches; ideal high-impedance amplifier; no board parasitics.
  // Referred to the motional branch, |Rnegative| = gm/[4*w²*(C0+CL)²].
  const criticalGain = 4 * resistance * (TAU * frequency) ** 2 * (C.shuntCapacitance + load) ** 2;
  const margin = values.gain * 1e-6 / criticalGain, decay = resistance / INDUCTANCE;
  return {values, load, resistance, capacitance, inductance: INDUCTANCE, energyScale: ENERGY_SCALE,
    frequency, period: 1 / frequency, criticalGain, margin, decay, amplitudeTau: 2 / decay,
    quality: TAU * frequency / decay, initialEnergyFraction: values.initial ? .25 : 1e-6,
    equilibriumEnergyFraction: margin > 1 ? 1 - 1 / margin : 0,
    duration: values.mode ? 4 / frequency : C.duration, speed: values.mode ? 1 / C.slowFactor : 1,
    step: values.mode ? 1 / (8 * frequency) : .25};
}

// Cycle-averaged energy equation, x=E/Escale:
// dx/dt = k*x*[G*(1-x)-1]. All allowed initial states and equilibria lie in
// [0,1], so delivered power k*G*E*(1-x) is nonnegative. Solve the logistic
// equation analytically, including zero feedback and the G=1 limit.
export function oscillatorEnvelope(plan, time) {
  validTime(time);
  const {margin: G, decay: k, initialEnergyFraction: x0, energyScale} = plan;
  const a = k * (G - 1), b = k * G, z = a * time;
  let fraction, loss;
  if (G === 0) {
    fraction = x0 * Math.exp(-k * time);
    loss = energyScale * x0 * -Math.expm1(-k * time);
  } else {
    let logDenominator;
    if (z > 50) {
      const denominator = Math.exp(-z) + b * x0 * (-Math.expm1(-z)) / a;
      fraction = x0 / denominator;
      logDenominator = z + Math.log(denominator);
    } else {
      const increment = b * x0 * (a === 0 ? time : Math.expm1(z) / a);
      fraction = x0 * Math.exp(z) / (1 + increment);
      logDenominator = Math.log1p(increment);
    }
    loss = energyScale * logDenominator / G;
  }
  const energy = energyScale * fraction, initialEnergy = energyScale * x0;
  const lossPower = k * energy, inputPower = lossPower * G * (1 - fraction);
  return {fraction, amplitude: Math.sqrt(fraction), energy, initialEnergy,
    suppliedEnergy: G === 0 ? 0 : energy - initialEnergy + loss, lostEnergy: loss, lossPower, inputPower,
    effectiveMargin: G * (1 - fraction), rmsMotionalCurrent: Math.sqrt(energy / plan.inductance)};
}

export function sampleOscillatorPlan(plan, time = 0) {
  validTime(time);
  const elapsed = Math.min(time, plan.duration), envelope = oscillatorEnvelope(plan, elapsed);
  const cycles = elapsed * plan.frequency, phase = TAU * (cycles % 1);
  const displacement = envelope.amplitude * Math.sin(phase);
  // At normal speed the fork shows its amplitude envelope symmetrically about
  // rest, never an aliased low-frequency replacement for the real oscillation.
  const initialAmplitude = Math.sqrt(plan.initialEnergyFraction);
  const displayedDisplacement = plan.values.mode ? displacement / initialAmplitude : envelope.amplitude;
  const trend = Math.abs(envelope.effectiveMargin - 1) < .001 ? 'Sustained vibration'
    : envelope.effectiveMargin > 1 ? 'Vibration grows' : 'Vibration decays';
  return {...plan, ...envelope, time: elapsed, cycles, phase, displacement, initialAmplitude, displayedDisplacement,
    trend, complete: elapsed >= plan.duration};
}

export function sampleOscillator(input = {}, time = 0) {
  return sampleOscillatorPlan(oscillatorPlan(input), time);
}

import {validateControls, validTime, clamp} from './physics-kit.js';

export const KINETIC_WATCH = Object.freeze({
  day: 86400, capacitance: .33, maximum: 2.2, stop: .5, start: .6,
  resistance: 330, bridgeDrop: .3, fluxLinkage: .001,
  logicCurrent: .25e-6, motorCharge: .35e-6, leakage: .02e-6,
  nominal: 32768, turnover: 25, parabola: -.035e-6,
  weightAmplitude: Math.PI / 2, gearRatio: 400,
});
export const KINETIC_DEFAULTS = Object.freeze({mode: 0, motion: 2, minutes: 2, voltage: 1.2, temperature: 25});
export const KINETIC_DOMAINS = Object.freeze({mode: [0, 2, 1], motion: [0, 3, 1], minutes: [0, 20, .5], voltage: [0, 2.2, .01], temperature: [-10, 50, 1]});
export const KINETIC_MOTIONS = Object.freeze([
  {value: 0, label: 'Still', frequency: 0},
  {value: 1, label: '½ swing cycle / second', frequency: .5},
  {value: 2, label: '1 swing cycle / second', frequency: 1},
  {value: 3, label: '2 swing cycles / second', frequency: 2},
].map(Object.freeze));
export const KINETIC_MODES = Object.freeze([
  {value: 0, label: 'Watch working', duration: 12, speed: .25, step: 1},
  {value: 1, label: 'Generator close-up', duration: .04, speed: .0025, step: .002},
  {value: 2, label: 'Charge and reserve', duration: 21 * 86400, speed: 21600, step: 21600},
].map(Object.freeze));
const K = KINETIC_WATCH, TAU = 2 * Math.PI;
const distributions = new Map();

export function kineticWatchPlan(input = {}) {
  const values = validateControls(input, KINETIC_DEFAULTS, KINETIC_DOMAINS, 'kinetic quartz watch');
  const ratio = 1 + K.parabola * (values.temperature - K.turnover) ** 2;
  const current = K.logicCurrent + K.motorCharge * ratio;
  return {values, ratio, frequency: K.nominal * ratio, rate: K.day * (ratio - 1), current,
    motionFrequency: KINETIC_MOTIONS[values.motion].frequency, mode: KINETIC_MODES[values.mode],
    fullReserve: K.capacitance * (K.maximum - K.stop) / (current + K.leakage),
    maximumEnergy: .5 * K.capacitance * K.maximum ** 2};
}

export function kineticMotion(frequency, time, active = true) {
  if (!active || frequency === 0) return {weight: 0, weightSpeed: 0, magnet: 0, magnetSpeed: 0, emf: 0};
  const phase = TAU * frequency * time, weight = K.weightAmplitude * Math.sin(phase);
  const weightSpeed = K.weightAmplitude * TAU * frequency * Math.cos(phase);
  const magnet = weight * K.gearRatio, magnetSpeed = weightSpeed * K.gearRatio;
  return {weight, weightSpeed, magnet, magnetSpeed, emf: K.fluxLinkage * magnetSpeed * Math.sin(magnet)};
}

export function kineticInstantElectrical(voltage, emf) {
  const current = Math.max(0, (Math.abs(emf) - Math.max(0, voltage) - K.bridgeDrop) / K.resistance);
  return {current, copper: current ** 2 * K.resistance, bridge: K.bridgeDrop * current, mechanical: Math.abs(emf) * current};
}

function emfDistribution(frequency) {
  if (distributions.has(frequency)) return distributions.get(frequency);
  const count = 16384;
  const amplitudes = Array.from({length: count}, (_, i) => Math.abs(kineticMotion(frequency, (i + .5) / (count * frequency)).emf)).sort((a, b) => a - b);
  const sums = new Float64Array(count + 1), squares = new Float64Array(count + 1);
  for (let i = 0; i < count; i++) {sums[i + 1] = sums[i] + amplitudes[i]; squares[i + 1] = squares[i] + amplitudes[i] ** 2;}
  const result = {count, amplitudes, sums, squares}; distributions.set(frequency, result); return result;
}

export function kineticMeanElectrical(voltage, frequency) {
  if (frequency === 0) return {current: 0, copper: 0, bridge: 0, mechanical: 0};
  const {count, amplitudes, sums, squares} = emfDistribution(frequency), threshold = Math.max(0, voltage) + K.bridgeDrop;
  let lo = 0, hi = count;
  while (lo < hi) {const middle = (lo + hi) >>> 1; if (amplitudes[middle] <= threshold) lo = middle + 1; else hi = middle;}
  const n = count - lo, sum = sums[count] - sums[lo], square = squares[count] - squares[lo];
  const current = Math.max(0, (sum - n * threshold) / (count * K.resistance));
  const copper = Math.max(0, (square - 2 * threshold * sum + n * threshold ** 2) / (count * K.resistance));
  return {current, copper, bridge: K.bridgeDrop * current, mechanical: Math.max(0, (square - threshold * sum) / (count * K.resistance))};
}

const copy = state => ({...state});
const fields = ['voltage', 'mechanical', 'copper', 'bridge', 'load', 'leak', 'clock', 'powered'];
function rates(plan, state, voltage, time, active, protectedCharge) {
  const v = Math.max(0, voltage), motion = kineticMotion(plan.motionFrequency, time % K.day, active);
  const source = active ? (plan.values.mode === 2 ? kineticMeanElectrical(v, plan.motionFrequency) : kineticInstantElectrical(v, motion.emf)) : {current: 0, mechanical: 0, copper: 0, bridge: 0};
  const load = state.running ? plan.current : 0;
  const leak = voltage > 0 ? K.leakage : Math.min(K.leakage, source.current);
  const duty = protectedCharge && source.current > load + leak ? (load + leak) / source.current : 1;
  return {voltage: (source.current * duty - load - leak) / K.capacitance,
    mechanical: source.mechanical * duty, copper: source.copper * duty, bridge: source.bridge * duty,
    load: v * load, leak: v * leak, clock: state.running ? plan.ratio : 0, powered: state.running ? 1 : 0};
}

function rk4(plan, state, duration, active) {
  const protectedCharge = state.voltage >= K.maximum - 1e-12;
  const a = rates(plan, state, state.voltage, state.time, active, protectedCharge);
  const b = rates(plan, state, state.voltage + a.voltage * duration / 2, state.time + duration / 2, active, protectedCharge);
  const c = rates(plan, state, state.voltage + b.voltage * duration / 2, state.time + duration / 2, active, protectedCharge);
  const d = rates(plan, state, state.voltage + c.voltage * duration, state.time + duration, active, protectedCharge);
  const next = {...state, time: state.time + duration};
  for (const field of fields) next[field] += duration * (a[field] + 2 * b[field] + 2 * c[field] + d[field]) / 6;
  return next;
}

function movingStep(plan, state, duration, events, depth = 0) {
  const next = rk4(plan, state, duration, true);
  const bounds = [];
  if (state.running && next.voltage < K.stop) bounds.push([K.stop, 'stopped']);
  if (!state.running && next.voltage > K.start) bounds.push([K.start, 'started']);
  if (state.voltage < K.maximum - 1e-12 && next.voltage > K.maximum) bounds.push([K.maximum, 'full']);
  if (next.voltage < 0) bounds.push([0, 'empty']);
  if (bounds.length && depth < 5) {
    let chosen;
    for (const [voltage, type] of bounds) {
      let lo = 0, hi = duration;
      for (let i = 0; i < 32; i++) {const middle = (lo + hi) / 2, value = rk4(plan, state, middle, true).voltage; if ((next.voltage > state.voltage) === (value < voltage)) lo = middle; else hi = middle;}
      const dt = (lo + hi) / 2;
      if (!chosen || dt < chosen.dt) chosen = {voltage, type, dt};
    }
    const at = rk4(plan, state, chosen.dt, true); at.voltage = chosen.voltage;
    if (chosen.type === 'stopped') {at.running = false; at.clock = Math.floor(at.clock + 1e-9);}
    if (chosen.type === 'started') {at.running = true; at.epochClock = at.clock;}
    const day = Math.floor(at.time / K.day);
    if (events && (chosen.type !== 'full' || at.fullDay !== day)) events.push({time: at.time, type: chosen.type, voltage: at.voltage});
    if (chosen.type === 'full') at.fullDay = day;
    return duration - chosen.dt > 1e-10 ? movingStep(plan, at, duration - chosen.dt, events, depth + 1) : at;
  }
  next.voltage = clamp(next.voltage, 0, K.maximum);
  return next;
}

function restingStep(plan, state, duration, events) {
  const current = (state.running ? plan.current : 0) + K.leakage;
  const endVoltage = state.running ? K.stop : 0;
  const untilBoundary = Math.max(0, (state.voltage - endVoltage) * K.capacitance / current);
  const dt = Math.min(duration, untilBoundary), next = {...state, time: state.time + dt};
  next.voltage = Math.max(endVoltage, state.voltage - current * dt / K.capacitance);
  const mean = (state.voltage + next.voltage) / 2;
  next.load += state.running ? mean * plan.current * dt : 0; next.leak += mean * K.leakage * dt;
  next.clock += state.running ? plan.ratio * dt : 0; next.powered += state.running ? dt : 0;
  if (untilBoundary <= duration) {
    if (state.running) {next.running = false; next.clock = Math.floor(next.clock + 1e-9); if (events) events.push({time: next.time, type: 'stopped', voltage: next.voltage});}
    else {if (state.voltage > 0 && events) events.push({time: next.time, type: 'empty', voltage: 0}); next.time = state.time + duration; return next;}
  }
  return duration - dt > 1e-9 ? restingStep(plan, next, duration - dt, events) : next;
}

// Capacitor integration uses SI units. Short views resolve the generator
// waveform; the multi-day view averages whole cycles only inside motion windows.
export function createKineticTimeline(input = {}) {
  const plan = kineticWatchPlan(input), events = [];
  const initial = {time: 0, voltage: plan.values.voltage, running: plan.values.voltage >= K.start,
    mechanical: 0, copper: 0, bridge: 0, load: 0, leak: 0, clock: 0, powered: 0, epochClock: 0, fullDay: plan.values.voltage === K.maximum ? 0 : -1};
  const checkpoints = [initial], motionDuration = plan.values.minutes * 60;
  const activeAt = time => plan.motionFrequency > 0 && time % K.day < motionDuration - 1e-9;
  const increment = plan.values.mode === 2 ? 2 : .02;
  const fineStep = .00005 / Math.max(1, plan.motionFrequency);
  function integrate(state, end, collect) {
    let next = copy(state);
    while (end - next.time > 1e-9) {
      const dayStart = Math.floor((next.time + 1e-9) / K.day) * K.day;
      const active = activeAt(next.time), boundary = active ? dayStart + motionDuration : dayStart + K.day;
      const remaining = Math.min(end, boundary) - next.time;
      if (!active) next = restingStep(plan, next, remaining, collect);
      else {
        const dt = Math.min(remaining, plan.values.mode === 2 ? 2 : fineStep);
        next = movingStep(plan, next, dt, collect);
      }
    }
    next.time = end; return next;
  }
  function extend(time) {
    while (checkpoints.at(-1).time < time - 1e-9) {
      const state = checkpoints.at(-1), dayStart = Math.floor((state.time + 1e-9) / K.day) * K.day;
      const nextBoundary = activeAt(state.time) ? Math.min(state.time + increment, dayStart + motionDuration) : dayStart + K.day;
      const end = Math.min(plan.mode.duration, nextBoundary);
      if (end <= state.time + 1e-9) break;
      checkpoints.push(integrate(state, end, events));
    }
  }
  function sample(time = 0) {
    validTime(time); const t = Math.min(time, plan.mode.duration); extend(t);
    let lo = 0, hi = checkpoints.length - 1;
    while (lo < hi) {const middle = Math.ceil((lo + hi) / 2); if (checkpoints[middle].time <= t + 1e-10) lo = middle; else hi = middle - 1;}
    const state = integrate(checkpoints[lo], t), active = activeAt(t);
    const motion = kineticMotion(plan.motionFrequency, t % K.day, active), instant = kineticInstantElectrical(state.voltage, motion.emf);
    const mean = kineticMeanElectrical(state.voltage, active ? plan.motionFrequency : 0);
    const energy = .5 * K.capacitance * state.voltage ** 2, initialEnergy = .5 * K.capacitance * initial.voltage ** 2;
    const ticks = Math.floor(state.clock + 1e-9), phase = Math.max(0, state.clock - ticks);
    const stroke = ticks;
    const supply = state.running ? plan.current : 0, protectedCharge = state.voltage >= K.maximum - 1e-9;
    return {...plan, ...state, motion, active, instant, mean, ticks, phase, stroke,
      energy, level: energy / plan.maximumEnergy, reserve: state.running ? Math.max(0, state.voltage - K.stop) * K.capacitance / (plan.current + K.leakage) : 0,
      protectedCharge, netCurrent: (protectedCharge ? Math.min(mean.current, supply + K.leakage) : mean.current) - supply - (state.voltage > 0 ? K.leakage : 0),
      energyResidual: initialEnergy + state.mechanical - state.copper - state.bridge - state.load - state.leak - energy,
      events: events.filter(e => e.time <= t + 1e-8), complete: t >= plan.mode.duration};
  }
  return {plan, sample};
}

export function kineticClock(seconds) {
  validTime(seconds); const whole = Math.floor(seconds + 1e-8);
  return `${String(Math.floor(whole / 3600) % 12 || 12)}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

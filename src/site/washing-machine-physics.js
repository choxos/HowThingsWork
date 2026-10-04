import {validateControls, validTime} from './physics-kit.js';
import {normalShare} from './spin-dryer-physics.js';
import {stageMotion} from './washing-machine-motion.js';

// An assigned teaching program, not a manufacturer's specification. Liters
// are numerically kilograms of water; other calculations use SI units.
// Water and detergent are conserved. The well-mixed bath shares temperature
// with the fabric and an assigned steel heat capacity. Bath state is resolved
// each second; fractional states interpolate between those endpoints. Drum
// speed and angle remain continuous and follow exact acceleration segments.
export const DRUM = Object.freeze({radius: 0.25, depth: 0.3, layer: 0.05, wash: 50, g: 9.81});
export const WATER = Object.freeze({washPerKg: 2.5, rinsePerKg: 2, free: 5, fill: 12 / 60, supply: 15, room: 20, heat: 4186, cotton: 1300, steel: 5000, heater: 2000, loss: 5});
// Assigned pore distribution and a nonextractable bound-water floor. This
// illustrates capillary drainage, not a prediction for a particular fabric.
export const FABRIC = Object.freeze({tension: 0.072, wetting: 0.9, pore: 5e-6, spread: 1.2, drained: 1.5, bound: 0.45, drain: 15, reference: 1e5});
export const DETERGENT = 60;
export const PROGRAM = Object.freeze({wash: 900, rinse: 300, drain: 60, intermediate: 120, final: 360, ramp: 60, brake: 30, tumbleRamp: 5, settle: 5, intermediateRpm: 800, heldRpm: 600, heldAbove: 0.4});
// The assigned moving mass includes the tub, counterweights and wet load.
// A fixed total isolates the selected imbalance from other design changes.
export const SUSPENSION = Object.freeze({mass: 40, stiffness: 18000, damping: 340});
export const POWER = Object.freeze({tumble: 100, spin: 350, pump: 30});
export const WASHER_DEFAULTS = Object.freeze({temperature: 40, spin: 1200, rinses: 2, load: 5, imbalance: 0.2});
export const WASHER_DOMAINS = Object.freeze({temperature: [15, 60, 5], spin: [400, 1400, 200], rinses: [1, 3, 1], load: [2, 7, 1], imbalance: [0, 0.6, 0.1]});
const TAU = Math.PI * 2;
export const omegaOf = rpm => rpm * TAU / 60;
export const criticalRpm = (radius = DRUM.radius) => Math.sqrt(DRUM.g / radius) * 60 / TAU;

/** Where tumbling laundry leaves the wall and where it lands, for a drum speed below the critical one. */
export function tumble(rpm, radius = DRUM.radius) {
  if (!Number.isFinite(rpm) || rpm < 0 || !Number.isFinite(radius) || radius <= 0) throw new RangeError('Tumbling requires a nonnegative speed and positive radius.');
  const R = radius, w = omegaOf(rpm), g = DRUM.g;
  if (rpm === 0) return {pinned: false, release: null, landing: null, flight: 0, drop: 0, impact: 0, carry: 0};
  if (w * w * R >= g) return {pinned: true, release: null, landing: null, flight: 0, drop: 0, impact: 0};
  const release = Math.acos(-w * w * R / g), speed = w * R;
  const at = time => [R * Math.sin(release) + speed * Math.cos(release) * time, -R * Math.cos(release) + speed * Math.sin(release) * time - g * time * time / 2];
  let lo = 1e-6, hi = 2 * speed / g + 2 * Math.sqrt(2 * R / g);
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, [x, y] = at(mid); if (Math.hypot(x, y) < R) lo = mid; else hi = mid; }
  const flight = (lo + hi) / 2, [x, y] = at(flight), landing = Math.atan2(x, -y);
  const vx = speed * Math.cos(release), vy = speed * Math.sin(release) - g * flight;
  return {pinned: false, release, landing, flight, drop: -R * Math.cos(release) - y, impact: Math.hypot(vx, vy), carry: ((release - landing) % TAU + TAU) % TAU / w};
}

export const layerPressure = w => 1000 * w * w * (DRUM.radius ** 2 - (DRUM.radius - DRUM.layer) ** 2) / 2;
export function spunMoisture(w) {
  const pressure = layerPressure(w);
  if (pressure <= 0) return FABRIC.drained;
  const radius = 2 * FABRIC.tension * FABRIC.wetting / pressure;
  return FABRIC.bound + (FABRIC.drained - FABRIC.bound) * normalShare((Math.log(radius) - Math.log(FABRIC.pore)) / FABRIC.spread);
}
export function shake(imbalance, w) {
  const {mass: M, stiffness: k, damping: c} = SUSPENSION, force = imbalance * DRUM.radius * w * w;
  const amplitude = force / Math.hypot(k - M * w * w, c * w);
  return {force, amplitude, floor: amplitude * Math.hypot(k, c * w), natural: Math.sqrt(k / M), phase: Math.atan2(c * w, k - M * w * w)};
}
/** The largest steady shaking, and the speed it comes at. */
export function resonancePeak(imbalance) {
  const {mass: M, stiffness: k, damping: c} = SUSPENSION, zeta = c / (2 * Math.sqrt(k * M)), w = Math.sqrt(k / M) / Math.sqrt(1 - 2 * zeta * zeta);
  return {...shake(imbalance, w), rpm: w * 60 / TAU};
}

// Linear spring/damper response per kilogram of eccentric load. Store each
// second's peak displacement/force, plus endpoint displacement and velocity.
// A 0.5 ms RK4 step resolves even the 1,400 rpm forcing; independent checks
// use a finer step. Both the acceleration and braking transients are included.
const RESPONSE_STEP = 0.0005, responses = new Map();
export function spinResponse(rpm, duration) {
  const key = `${rpm}:${duration}`;
  if (responses.has(key)) return responses.get(key);
  const {mass: M, stiffness: k, damping: c} = SUSPENSION;
  const top = omegaOf(rpm), rise = PROGRAM.ramp, brake = PROGRAM.brake;
  const forcing = t => {
    let w, alpha, angle;
    if (t < rise) { alpha = top / rise; w = alpha * t; angle = alpha * t * t / 2; }
    else if (t < duration) { alpha = 0; w = top; angle = top * (t - rise / 2); }
    else {
      const u = Math.min(brake, t - duration);
      alpha = t < duration + brake ? -top / brake : 0;
      w = top * (1 - u / brake);
      angle = top * (duration - rise / 2 + u - u * u / (2 * brake));
    }
    return DRUM.radius * (w * w * Math.cos(angle) + alpha * Math.sin(angle));
  };
  const accel = (t, x, v) => (forcing(t) - c * v - k * x) / M;
  const rpmAt = t => t < duration ? rpm * Math.min(1, t / rise) : rpm * Math.max(0, 1 - (t - duration) / brake);
  const seconds = [{amplitude: 0, floor: 0, rpm: 0, x: 0, v: 0}];
  let x = 0, v = 0;
  const steps = Math.round(1 / RESPONSE_STEP), total = duration + brake + PROGRAM.settle;
  for (let second = 0; second < total; second++) {
    let amplitude = 0, floor = 0, peakRpm = 0;
    for (let i = 0; i < steps; i++) {
      const t = second + i * RESPONSE_STEP, h = RESPONSE_STEP;
      const a1 = accel(t, x, v), v2 = v + a1 * h / 2, x2 = x + v * h / 2;
      const a2 = accel(t + h / 2, x2, v2), v3 = v + a2 * h / 2, x3 = x + v2 * h / 2;
      const a3 = accel(t + h / 2, x3, v3), v4 = v + a3 * h, x4 = x + v3 * h;
      const a4 = accel(t + h, x4, v4);
      x += h * (v + 2 * v2 + 2 * v3 + v4) / 6;
      v += h * (a1 + 2 * a2 + 2 * a3 + a4) / 6;
      if (Math.abs(x) > amplitude) { amplitude = Math.abs(x); peakRpm = rpmAt(t + h); }
      floor = Math.max(floor, Math.abs(k * x + c * v));
    }
    seconds.push({amplitude, floor, rpm: peakRpm, x, v});
  }
  responses.set(key, seconds);
  return seconds;
}
export function runUp(imbalance, rpm) {
  return spinResponse(rpm, PROGRAM.intermediate).slice(1, PROGRAM.ramp + 4).map(s => ({...s, amplitude: s.amplitude * imbalance, floor: s.floor * imbalance, x: s.x * imbalance, v: s.v * imbalance}));
}

const cache = new Map();
export function washerPlan(input = {}) {
  const values = validateControls(input, WASHER_DEFAULTS, WASHER_DOMAINS, 'washing machine');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const {temperature, spin, rinses, load, imbalance} = values, held = imbalance > PROGRAM.heldAbove;
  const topSpin = held ? Math.min(spin, PROGRAM.heldRpm) : spin, middleSpin = Math.min(PROGRAM.intermediateRpm, topSpin);
  const stages = [], samples = [];
  let t = 0, liquid = 0, T = WATER.room, detergent = 0, moisture = 0;
  let energy = 0, heaterEnergy = 0, used = 0, drained = 0, dose = 0, detergentOut = 0;
  let heatInWater = 0, heatOutWater = 0, heatToRoom = 0, heatingTime = 0, heatingEnergy = 0;
  let physicalAngle = 0, displayAngle = 0, previousRpm = 0, peak = {amplitude: 0, floor: 0, rpm: 0};
  const capacity = () => liquid * WATER.heat + load * WATER.cotton + WATER.steel;
  const sample = (stage, motion, extra = {}) => {
    const water = Math.max(0, liquid - moisture * load), concentration = liquid > 0 ? detergent / liquid : 0;
    const now = {t, stage, rpm: motion.rpm, angle: motion.angle, drawnAngle: motion.drawnAngle, water, liquid, T, concentration, moisture,
      energy, heaterEnergy, used, drained, dose, detergentOut, heatInWater, heatOutWater, heatToRoom,
      thermalEnergy: capacity() * T, detergentInLaundry: concentration * moisture * load, detergentInWater: concentration * water,
      amplitude: 0, floor: 0, heaterW: 0, motorW: 0, pumpW: 0, inletLps: 0, drainLps: 0, ...extra};
    samples.push(now);
  };
  sample('Ready', {rpm: 0, angle: 0, drawnAngle: 0});
  const removeWater = amount => {
    amount = Math.max(0, Math.min(amount, liquid));
    const removedDetergent = liquid > 0 ? detergent * amount / liquid : 0;
    heatOutWater += amount * WATER.heat * T;
    liquid -= amount; drained += amount; detergent -= removedDetergent; detergentOut += removedDetergent;
    return amount;
  };
  const begin = (stage, kind, seconds, rpmTo = previousRpm, ramp = 0) => {
    const entry = {stage, kind, start: t, end: t + seconds, rpmFrom: previousRpm, rpmTo, ramp, angle: physicalAngle, drawnAngle: displayAngle};
    stages.push(entry); return entry;
  };
  const second = (stage, {add = 0, addDose = 0, remove = 0, heater = 0, motor = 0, pump = 0, vibe} = {}) => {
    if (add > 0) {
      const oldCapacity = capacity();
      liquid += add; used += add; heatInWater += add * WATER.heat * WATER.supply;
      T = (oldCapacity * T + add * WATER.heat * WATER.supply) / capacity();
      moisture = Math.min(FABRIC.drained, Math.max(moisture, liquid / load));
    }
    detergent += addDose; dose += addDose;
    const out = removeWater(remove), C = capacity(), before = T;
    // Exact constant-power cooling/heating for this one-second interval.
    const decay = Math.exp(-WATER.loss / C), equilibrium = WATER.room + heater / WATER.loss;
    T = equilibrium + (T - equilibrium) * decay;
    heatToRoom += heater - C * (T - before);
    energy += heater + motor + pump; heaterEnergy += heater; t++;
    const motion = stageMotion(stage, t);
    physicalAngle = motion.angle; displayAngle = motion.drawnAngle; previousRpm = motion.rpm;
    if (vibe && vibe.amplitude > peak.amplitude) peak = {amplitude: vibe.amplitude, floor: vibe.floor, rpm: vibe.rpm};
    sample(stage.stage, motion, {heaterW: heater, motorW: motor, pumpW: pump, inletLps: add, drainLps: out, ...(vibe ? {amplitude: vibe.amplitude, floor: vibe.floor, displacement: vibe.x, velocity: vibe.v} : {})});
  };
  const fill = (name, liters, withDetergent = false) => {
    const stage = begin(name, 'fill', Math.ceil(liters / WATER.fill - 1e-9), DRUM.wash, PROGRAM.tumbleRamp);
    let remaining = liters;
    while (t < stage.end) {
      const add = Math.min(WATER.fill, remaining);
      second(stage, {add, addDose: withDetergent ? DETERGENT * add / liters : 0, motor: POWER.tumble}); remaining -= add;
    }
  };
  const tumbleFor = (name, seconds, hold = false) => {
    const stage = begin(name, 'tumble', seconds, DRUM.wash);
    while (t < stage.end) second(stage, {motor: POWER.tumble, heater: hold && temperature > WATER.room ? Math.max(0, WATER.loss * (T - WATER.room)) : 0});
  };
  const drain = name => {
    const stage = begin(name, 'drain', PROGRAM.drain, 0, PROGRAM.tumbleRamp);
    while (t < stage.end) second(stage, {remove: Math.max(0, liquid - moisture * load) / (stage.end - t), pump: POWER.pump, motor: t - stage.start < PROGRAM.tumbleRamp ? POWER.tumble : 0});
  };
  const spinOut = (name, rpm, seconds, last = false) => {
    const response = spinResponse(rpm, seconds), spinStart = t;
    const spinStage = begin(name, 'spin', seconds, rpm, PROGRAM.ramp);
    const run = stage => {
      while (t < stage.end) {
        const midRpm = stageMotion(stage, t + 0.5).rpm, w = omegaOf(midRpm), level = spunMoisture(w), before = moisture;
        if (moisture > level) moisture = level + (moisture - level) * Math.exp(-layerPressure(w) / (FABRIC.drain * FABRIC.reference));
        const v = response[t - spinStart + 1];
        const vibe = {...v, amplitude: v.amplitude * imbalance, floor: v.floor * imbalance, x: v.x * imbalance, v: v.v * imbalance};
        second(stage, {remove: Math.max(0, (before - moisture) * load), motor: stage.kind === 'settle' ? 0 : POWER.spin, pump: stage.kind === 'settle' ? 0 : POWER.pump, vibe});
      }
    };
    run(spinStage);
    run(begin(last ? 'Braking after the final spin' : name === 'Spinning after the wash' ? 'Braking before the first rinse' : 'Braking before the next rinse', 'brake', PROGRAM.brake, 0, PROGRAM.brake));
    run(begin(last ? 'Settling before unlock' : 'Settling before refill', 'settle', PROGRAM.settle, 0));
  };
  const washWater = WATER.washPerKg * load + WATER.free;
  fill('Filling for the wash', washWater, true);
  if (temperature > T) {
    const C = capacity(), target = WATER.room + WATER.heater / WATER.loss;
    const seconds = Math.ceil(-C / WATER.loss * Math.log((target - temperature) / (target - T)) - 1e-9);
    const heating = begin('Heating', 'heat', seconds, DRUM.wash), initialEnergy = heaterEnergy;
    while (t < heating.end) {
      const decay = Math.exp(-WATER.loss / capacity());
      const needed = WATER.loss * (temperature - WATER.room - (T - WATER.room) * decay) / (1 - decay);
      second(heating, {heater: Math.max(0, Math.min(WATER.heater, needed)), motor: POWER.tumble});
    }
    heatingTime = seconds; heatingEnergy = heaterEnergy - initialEnergy;
  }
  tumbleFor('Washing', PROGRAM.wash, true);
  drain('Draining the wash');
  spinOut('Spinning after the wash', middleSpin, PROGRAM.intermediate);
  for (let rinse = 1; rinse <= rinses; rinse++) {
    fill(`Filling for rinse ${rinse}`, WATER.rinsePerKg * load + WATER.free);
    tumbleFor(`Rinse ${rinse}`, PROGRAM.rinse);
    drain(`Draining rinse ${rinse}`);
    const last = rinse === rinses;
    spinOut(last ? 'Final spin' : `Spinning after rinse ${rinse}`, last ? topSpin : middleSpin, last ? PROGRAM.final : PROGRAM.intermediate, last);
  }
  const final = {...samples.at(-1), stage: 'Complete', rpm: 0, amplitude: 0, floor: 0, heaterW: 0, motorW: 0, pumpW: 0, inletLps: 0, drainLps: 0};
  const plan = {values, held, topSpin, middleSpin, samples, stages, duration: t, heatingTime, heatingEnergy, washWater, peak,
    steadyPeak: resonancePeak(imbalance), tumbling: tumble(DRUM.wash), critical: criticalRpm(), final, top: shake(imbalance, omegaOf(topSpin))};
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan); return plan;
}

export function sampleWasher(input = {}, time = 0) {
  validTime(time);
  const plan = washerPlan(input), clock = Math.min(plan.duration, time), complete = clock >= plan.duration;
  if (complete) return {...plan, clock, complete, now: {...plan.final}, doorLocked: false, stageIndex: plan.stages.length - 1};
  if (clock === 0) return {...plan, clock, complete, now: {...plan.samples[0]}, doorLocked: false, stageIndex: 0};
  const index = Math.floor(clock), u = clock - index, a = plan.samples[index], b = plan.samples[index + 1];
  const stageIndex = plan.stages.findIndex(stage => clock < stage.end), stage = plan.stages[stageIndex];
  const now = {...a};
  for (const key of Object.keys(a)) if (typeof a[key] === 'number' && typeof b[key] === 'number') now[key] = a[key] + u * (b[key] - a[key]);
  Object.assign(now, stageMotion(stage, clock), {t: clock, stage: stage.stage});
  // Instantaneous actions belong to the upcoming interval, not the preceding
  // stage at its boundary. Rates are average flows for that one-second step.
  for (const key of ['heaterW', 'motorW', 'pumpW', 'inletLps', 'drainLps']) now[key] = b[key];
  now.T = now.thermalEnergy / (now.liquid * WATER.heat + plan.values.load * WATER.cotton + WATER.steel);
  now.concentration = now.liquid > 0 ? (now.dose - now.detergentOut) / now.liquid : 0;
  now.detergentInLaundry = now.concentration * now.moisture * plan.values.load;
  now.detergentInWater = now.concentration * now.water;
  return {...plan, clock, complete, now, doorLocked: true, stageIndex};
}

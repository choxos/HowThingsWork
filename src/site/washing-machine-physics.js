import {validateControls, validTime} from './physics-kit.js';
import {normalShare} from './spin-dryer-physics.js';

// Washing machine: a front loader through one full program: filling, heating,
// tumbling the load in its drum, draining, spinning, and rinsing the detergent
// out, with the tub shaking on its springs as the drum spins up.
//
// Units: SI inside. Readings convert to rpm, liters, degrees Celsius, grams,
// percent, millimeters, newtons, kilowatt hours and minutes.
//
// Tumbling. The drum is 250 mm in radius and turns at 50 rpm to fill, wash and
// rinse. Laundry carried up the wall stays against it while the wall still
// pushes inward; at the angle theta from the bottom where
// omega^2 R = -g cos(theta) it leaves the wall and falls freely until it meets
// the wall again. At or above sqrt(g / R), 59.8 rpm, nothing falls: the laundry
// is pinned to the wall.
//
// Water. The wash takes 2.5 L for each kilogram of dry laundry plus 5 L, and
// each rinse 2 L a kilogram plus 5 L, filled at 12 L a minute from the supply
// at 15 °C. As it fills, the laundry soaks up to 1.5 kg of water a kilogram;
// the rest lies free in the tub. Draining pumps the free water away over a
// minute, and spinning pumps away what it presses out of the laundry.
//
// Heat. The machine and the laundry start at the room's 20 °C. A 2 kW heater
// warms all the water, free and soaked up, the laundry (cotton,
// 1.3 kJ/(kg K)) and 10 kg of steel (0.5 kJ/(kg K)), which together lose 5 W for
// each kelvin above the room. Through the wash the heater makes up that loss;
// otherwise the machine drifts toward the room. Filling mixes the cold water in.
//
// Detergent. 60 g dissolves in the wash water. Draining and spinning take water
// away at its concentration; each fill dilutes what the laundry kept by its
// share of the new total.
//
// Spinning out water, as in the spin dryer: water in the fabric's pores, spread
// log-normally around 5 um with a spread of 1.2 in their logarithm, is held by
// capillary suction 2 gamma cos(theta) / r, gamma = 0.072 N/m and
// cos(theta) = 0.9, and pressed out across a layer 50 mm thick at the wall by
// rho omega^2 (R^2 - (R - t)^2) / 2. Drained laundry holds 1.5 kg of water a
// kilogram, 0.45 kg of it inside the fibers where spinning cannot reach. The
// water approaches the level the speed allows with a time constant of 15 s at
// 100 kPa, shorter in proportion as the pressure rises. Intermediate spins run
// 2 minutes at 800 rpm, or the chosen speed if slower; the final spin 6 minutes
// at the chosen speed. Every spin takes 60 s to reach speed.
//
// Shaking. The tub assembly, 40 kg on springs of 18 kN/m with dampers of
// 340 N s/m, is shaken during spins by the load's unbalanced part at the drum
// wall. Each spin starts the tub from rest and follows it through the run-up and
// 3 s more by RK4 in steps of 0.2 ms:
// M x'' + c x' + k x = m R (omega^2 cos(theta) + (d omega / dt) sin(theta)), theta
// the drum's angle. By then the start has died away and the tub swings steadily,
// X = m R omega^2 / sqrt((k - M omega^2)^2 + (c omega)^2), lagging the load by
// atan2(c omega, k - M omega^2). The steady swing is largest at
// sqrt(k / M) / sqrt(1 - 2 zeta^2), zeta = c / (2 sqrt(k M)), a little above the
// tub's natural speed sqrt(k / M), 203 rpm; running up through it in a minute,
// the tub cannot settle and swings a little more, a little later. Each second
// keeps the largest swing in it and the largest force on the floor, k x + c x'.
// A load more than 0.4 kg off balance holds every spin to 600 rpm.
//
// Energy: the heater, the motor at 100 W while tumbling and 350 W while
// spinning, and the drain pump at 30 W while draining and spinning.
//
// Not modeled: the drum reversing, soil and stain chemistry, foam, laundry
// sliding on the lifters, the heater cycling, and water left in the sump.

export const DRUM = Object.freeze({radius: 0.25, depth: 0.3, layer: 0.05, wash: 50, g: 9.81});
export const WATER = Object.freeze({washPerKg: 2.5, rinsePerKg: 2, free: 5, fill: 12 / 60, supply: 15, room: 20, heat: 4186, cotton: 1300, steel: 5000, heater: 2000, loss: 5});
export const FABRIC = Object.freeze({tension: 0.072, wetting: 0.9, pore: 5e-6, spread: 1.2, drained: 1.5, bound: 0.45, drain: 15, reference: 1e5});
export const DETERGENT = 60;
export const PROGRAM = Object.freeze({wash: 900, rinse: 300, drain: 60, intermediate: 120, final: 360, ramp: 60, intermediateRpm: 800, heldRpm: 600, heldAbove: 0.4});
export const SUSPENSION = Object.freeze({mass: 40, stiffness: 18000, damping: 340});
export const POWER = Object.freeze({tumble: 100, spin: 350, pump: 30});
export const WASHER_DEFAULTS = Object.freeze({temperature: 40, spin: 1200, rinses: 2, load: 5, imbalance: 0.2});
export const WASHER_DOMAINS = Object.freeze({temperature: [15, 60, 5], spin: [400, 1400, 200], rinses: [1, 3, 1], load: [2, 7, 1], imbalance: [0, 0.6, 0.1]});

const TAU = Math.PI * 2;
export const omegaOf = rpm => rpm * TAU / 60;
export const criticalRpm = () => Math.sqrt(DRUM.g / DRUM.radius) * 60 / TAU;

/** Where tumbling laundry leaves the wall and where it lands, for a drum speed below the critical one. */
export function tumble(rpm) {
  const R = DRUM.radius, w = omegaOf(rpm), g = DRUM.g;
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

const STEP = 2e-4, SETTLE = 3, runUps = new Map();
/**
 * The tub from rest through a spin's run-up to rpm and SETTLE seconds beyond:
 * for each second, the largest swing and floor force in it, and the speed at
 * that largest swing.
 */
export function runUp(imbalance, rpm) {
  const key = `${imbalance} ${rpm}`;
  if (runUps.has(key)) return runUps.get(key);
  const {mass: M, stiffness: k, damping: c} = SUSPENSION, top = omegaOf(rpm), rate = top / PROGRAM.ramp, lump = imbalance * DRUM.radius, seconds = [];
  const accel = (time, x, v) => {
    const rising = time < PROGRAM.ramp, w = rising ? rate * time : top, theta = rising ? rate * time * time / 2 : top * (time - PROGRAM.ramp / 2);
    return (lump * (w * w * Math.cos(theta) + (rising ? rate : 0) * Math.sin(theta)) - c * v - k * x) / M;
  };
  let x = 0, v = 0;
  const steps = Math.round(1 / STEP);
  for (let s = 0; s < PROGRAM.ramp + SETTLE; s++) {
    let amplitude = 0, floor = 0, at = 0;
    for (let n = 0; n < steps; n++) {
      const time = s + n * STEP, h = STEP;
      const a1 = accel(time, x, v), x2 = x + v * h / 2, v2 = v + a1 * h / 2, a2 = accel(time + h / 2, x2, v2);
      const x3 = x + v2 * h / 2, v3 = v + a2 * h / 2, a3 = accel(time + h / 2, x3, v3), x4 = x + v3 * h, v4 = v + a3 * h, a4 = accel(time + h, x4, v4);
      x += h * (v + 2 * v2 + 2 * v3 + v4) / 6; v += h * (a1 + 2 * a2 + 2 * a3 + a4) / 6;
      if (Math.abs(x) > amplitude) { amplitude = Math.abs(x); at = rpm * Math.min(1, (time + h) / PROGRAM.ramp); }
      floor = Math.max(floor, Math.abs(k * x + c * v));
    }
    seconds.push({amplitude, floor, rpm: at});
  }
  runUps.set(key, seconds);
  if (runUps.size > 32) runUps.delete(runUps.keys().next().value);
  return seconds;
}

const cache = new Map();

export function washerPlan(input = {}) {
  const values = validateControls(input, WASHER_DEFAULTS, WASHER_DOMAINS, 'washing machine');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const {temperature, spin, rinses, load, imbalance} = values, held = imbalance > PROGRAM.heldAbove;
  const topSpin = held ? Math.min(spin, PROGRAM.heldRpm) : spin, middleSpin = Math.min(PROGRAM.intermediateRpm, topSpin);
  const samples = [], stages = [];
  let t = 0, liquid = 0, T = WATER.room, concentration = 0, moisture = 0, energy = 0, heaterEnergy = 0, used = 0, heatingTime = 0, heatingEnergy = 0, peak = {amplitude: 0, floor: 0, rpm: 0};
  const capacity = () => liquid * WATER.heat + load * WATER.cotton + WATER.steel;
  const loss = () => WATER.loss * (T - WATER.room);
  // One second: heat from the heater less heat lost, the motor and pump, and a sample.
  const still = {amplitude: 0, floor: 0};
  const second = (stage, rpm, power, {heater = 0, vibe = still} = {}) => {
    T += (heater - loss()) / capacity();
    energy += power + heater; heaterEnergy += heater; t += 1;
    const water = liquid - moisture * load;
    samples.push({t, stage, rpm, water, liquid, T, concentration, moisture, energy, heaterEnergy, used, amplitude: vibe.amplitude, floor: vibe.floor, detergentInLaundry: concentration * moisture * load, detergentInWater: concentration * water});
  };
  const begin = (stage, seconds) => { stages.push({stage, start: t, end: t + seconds}); return stages.at(-1); };
  const tumbleFor = (stage, seconds, change, hold = false) => {
    begin(stage, seconds);
    for (let s = 0; s < seconds; s++) { change?.(); second(stage, DRUM.wash, POWER.tumble, {heater: hold ? Math.max(0, loss()) : 0}); }
  };
  const fill = (stage, liters) => tumbleFor(stage, Math.ceil(liters / WATER.fill - 1e-9), () => {
    const add = Math.min(WATER.fill, liters);
    T = (capacity() * T + add * WATER.heat * WATER.supply) / (capacity() + add * WATER.heat);
    concentration *= liquid / (liquid + add);
    liters -= add; liquid += add; used += add;
    moisture = Math.min(FABRIC.drained, Math.max(moisture, liquid / load));
  });
  const drain = stage => {
    begin(stage, PROGRAM.drain);
    for (let s = 0; s < PROGRAM.drain; s++) {
      const kept = moisture * load;
      liquid = kept + (liquid - kept) * (1 - 1 / (PROGRAM.drain - s));
      second(stage, 0, POWER.pump);
    }
  };
  const spinOut = (stage, rpm, seconds) => {
    begin(stage, seconds);
    const rising = runUp(imbalance, rpm);
    for (let s = 0; s < seconds; s++) {
      const now = rpm * Math.min(1, (s + 1) / PROGRAM.ramp), w = omegaOf(now), level = spunMoisture(w);
      if (moisture > level) moisture = level + (moisture - level) * Math.exp(-layerPressure(w) / (FABRIC.drain * FABRIC.reference));
      liquid = moisture * load;
      const vibe = s < rising.length ? rising[s] : shake(imbalance, w);
      if (vibe.amplitude > peak.amplitude) peak = {amplitude: vibe.amplitude, floor: vibe.floor, rpm: s < rising.length ? vibe.rpm : now};
      second(stage, now, POWER.spin + POWER.pump, {vibe});
    }
  };
  // Wash: fill, heat while tumbling, wash, drain, spin.
  const washWater = WATER.washPerKg * load + WATER.free;
  fill('Filling for the wash', washWater);
  concentration = DETERGENT / liquid;
  if (temperature > T) {
    const heating = begin('Heating', 0), started = t;
    while (T < temperature - 1e-9) second('Heating', DRUM.wash, POWER.tumble, {heater: Math.min(WATER.heater, (temperature - T) * capacity() + loss())});
    heatingTime = t - started; heatingEnergy = heaterEnergy; heating.end = t;
  }
  tumbleFor('Washing', PROGRAM.wash, null, true);
  drain('Draining the wash');
  spinOut('Spinning after the wash', middleSpin, PROGRAM.intermediate);
  for (let r = 1; r <= rinses; r++) {
    fill(`Filling for rinse ${r}`, WATER.rinsePerKg * load + WATER.free);
    tumbleFor(`Rinse ${r}`, PROGRAM.rinse);
    drain(`Draining rinse ${r}`);
    if (r < rinses) spinOut(`Spinning after rinse ${r}`, middleSpin, PROGRAM.intermediate);
    else spinOut('Final spin', topSpin, PROGRAM.final);
  }
  const plan = {
    values, held, topSpin, middleSpin, samples, stages, duration: t, heatingTime, heatingEnergy, washWater, peak, steadyPeak: resonancePeak(imbalance),
    tumbling: tumble(DRUM.wash), critical: criticalRpm(), final: samples.at(-1), top: shake(imbalance, omegaOf(topSpin)),
  };
  if (cache.size > 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** The machine some seconds into its program. */
export function sampleWasher(input = {}, time = 0) {
  validTime(time);
  const plan = washerPlan(input), clock = Math.min(plan.duration, time), index = Math.min(plan.samples.length - 1, Math.max(0, Math.round(clock) - 1));
  const now = clock < 0.5 ? {t: 0, stage: 'Ready', rpm: 0, water: 0, liquid: 0, T: WATER.room, concentration: 0, moisture: 0, energy: 0, heaterEnergy: 0, used: 0, amplitude: 0, floor: 0, detergentInLaundry: 0, detergentInWater: 0} : plan.samples[index];
  return {...plan, clock, now};
}

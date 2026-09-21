import {validateControls, validTime} from './physics-kit.js';

export const DRINKS = Object.freeze([
  Object.freeze({value: 0, label: 'Water-like liquid', density: 1000, viscosity: 0.001}),
  Object.freeze({value: 1, label: 'Thin juice-like liquid', density: 1045, viscosity: 0.004}),
  Object.freeze({value: 2, label: 'Thick liquid', density: 1100, viscosity: 2}),
  Object.freeze({value: 3, label: 'Very thick liquid', density: 1150, viscosity: 8}),
]);
export const STRAW = Object.freeze({gravity: 9.81, entry: 0.5, glassDepth: 0.12, glassRadius: 0.04, bottom: 0.06, wall: 0.0004, stepTime: 0.002, sip: 20e-6, duration: 12, atmosphere: 101325});
export const STRAW_DEFAULTS = Object.freeze({suction: 5, diameter: 6, lift: 15, drink: 0, hole: 0});
export const STRAW_DOMAINS = Object.freeze({suction: [0, 20, 0.5], diameter: [3, 12, 1], lift: [5, 30, 1], drink: [0, 3, 1], hole: [0, 1, 1]});

// Smooth-pipe Churchill Darcy factor, COMSOL Pipe Flow equations 2-7 to 2-10.
// Below Re=1000 its laminar limit avoids huge powers and agrees to roundoff.
export function frictionFactor(re) {
  if (re <= 0) return 0;
  if (re <= 1000) return 64 / re;
  const a = (-2.457 * Math.log((7 / re) ** 0.9)) ** 16, b = (37530 / re) ** 16;
  return 8 * ((8 / re) ** 12 + (a + b) ** -1.5) ** (1 / 12);
}
export function strawDrop({flow, density, viscosity, radius, length, height}) {
  const velocity = flow / (Math.PI * radius ** 2), re = density * velocity * 2 * radius / viscosity;
  return density * STRAW.gravity * height + (frictionFactor(re) * length / (2 * radius) + 1 + STRAW.entry) * density * velocity ** 2 / 2;
}
export function strawFlow({dp, density, viscosity, radius, length, height}) {
  const drive = dp - density * STRAW.gravity * height;
  if (drive <= 0) return 0;
  const area = Math.PI * radius ** 2, linear = 8 * viscosity * length / radius ** 2, quadratic = (1 + STRAW.entry) * density / 2;
  const laminarSpeed = 2 * drive / (linear + Math.sqrt(linear ** 2 + 4 * quadratic * drive));
  if (density * laminarSpeed * 2 * radius / viscosity <= 1000) return area * laminarSpeed;
  let lo = 0, hi = area * Math.sqrt(drive / quadratic);
  for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (strawDrop({flow: mid, density, viscosity, radius, length, height}) > dp) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
const cache = new Map();
export function strawPlan(input = {}) {
  const values = validateControls(input, STRAW_DEFAULTS, STRAW_DOMAINS, 'drinking straw'), key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const drink = DRINKS[values.drink], mouth = values.suction * 1000, dp = values.hole ? 0 : mouth;
  const radius = values.diameter / 2000, area = Math.PI * radius ** 2, reservoirArea = Math.PI * (STRAW.glassRadius ** 2 - (radius + STRAW.wall) ** 2);
  const lift = values.lift / 100, fillVolume = area * lift, targetVolume = fillVolume + STRAW.sip, holdHeight = dp / (drink.density * STRAW.gravity);
  const fillEquilibrium = holdHeight / (1 / area + 1 / reservoirArea);
  const equilibriumVolume = fillEquilibrium <= fillVolume ? fillEquilibrium : reservoirArea * (holdHeight - lift);
  const reaches = equilibriumVolume > fillVolume;
  const levelAt = volume => STRAW.glassDepth - volume / reservoirArea;
  const topAt = volume => STRAW.glassDepth + Math.min(volume / area, lift);
  // ponytail: quasi-steady pipe flow omits startup inertia, capillarity and
  // non-Newtonian food rheology. Measured transient/rheology data is needed
  // before using this teaching model to predict a real drinking task.
  const flowAt = volume => strawFlow({dp, ...drink, radius, length: topAt(volume) - STRAW.bottom, height: topAt(volume) - levelAt(volume)});
  const step = (volume, dt) => {
    const k1 = flowAt(volume), k2 = flowAt(volume + dt * k1 / 2), k3 = flowAt(volume + dt * k2 / 2), k4 = flowAt(volume + dt * k3);
    return Math.min(equilibriumVolume, volume + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6);
  };
  const crossing = (volume, dt, target) => {
    let lo = 0, hi = dt;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (step(volume, mid) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  const samples = [{t: 0, volume: 0}];
  let elapsed = 0, volume = 0, arrivedAt = null, sipTime = null;
  while (elapsed < STRAW.duration - 1e-12) {
    const dt = Math.min(STRAW.stepTime, STRAW.duration - elapsed), next = step(volume, dt);
    if (arrivedAt === null && next >= fillVolume) arrivedAt = elapsed + crossing(volume, dt, fillVolume);
    if (next >= targetVolume) {
      sipTime = elapsed + crossing(volume, dt, targetVolume);volume = targetVolume;elapsed = sipTime;samples.push({t: elapsed, volume});break;
    }
    volume = next;elapsed += dt;samples.push({t: elapsed, volume});
  }
  const initialFlow = strawFlow({dp, ...drink, radius, length: STRAW.glassDepth + lift - STRAW.bottom, height: lift});
  const plan = {values, drink, mouth, dp, radius, area, reservoirArea, lift, fillVolume, targetVolume, holdHeight, equilibriumVolume, reaches, arrivedAt, sipTime, initialFlow, endTime: sipTime ?? STRAW.duration, samples};
  if (cache.size >= 24) cache.delete(cache.keys().next().value);
  cache.set(key, plan);return plan;
}
export function sampleStraw(input = {}, time = 0) {
  validTime(time);
  const {samples, ...plan} = strawPlan(input), elapsed = Math.min(plan.endTime, time);
  let low = 0, high = samples.length - 1;
  while (low + 1 < high) { const mid = (low + high) >> 1; if (samples[mid].t <= elapsed) low = mid; else high = mid; }
  const a = samples[low], b = samples[high], fraction = Math.max(0, Math.min(1, (elapsed - a.t) / (b.t - a.t)));
  const volume = a.volume + fraction * (b.volume - a.volume), level = STRAW.glassDepth - volume / plan.reservoirArea;
  const columnTop = STRAW.glassDepth + Math.min(volume / plan.area, plan.lift), height = columnTop - level;
  const drunk = Math.max(0, volume - plan.fillVolume), complete = time >= plan.endTime, sipped = plan.sipTime !== null && complete;
  const operatingFlow = strawFlow({dp: plan.dp, ...plan.drink, radius: plan.radius, length: columnTop - STRAW.bottom, height});
  const running = elapsed > 0 && !complete, flow = running ? operatingFlow : 0;
  const atMouth = plan.arrivedAt !== null && elapsed >= plan.arrivedAt, flowing = running && atMouth && flow > 0;
  const velocity = operatingFlow / plan.area, reynolds = plan.drink.density * velocity * 2 * plan.radius / plan.drink.viscosity;
  const liftPressure = plan.drink.density * STRAW.gravity * height;
  const frictionPressure = frictionFactor(reynolds) * (columnTop - STRAW.bottom) / (2 * plan.radius) * plan.drink.density * velocity ** 2 / 2;
  const kineticPressure = (1 + STRAW.entry) * plan.drink.density * velocity ** 2 / 2;
  const held = plan.equilibriumVolume - volume <= 1e-7 / (1 / plan.area + 1 / plan.reservoirArea);
  const mode = elapsed === 0 ? 'ready' : sipped ? 'sipped' : complete ? 'complete' : plan.dp === 0 ? (plan.values.hole ? 'vented' : 'no-suction') : atMouth ? 'drinking' : held ? 'held' : 'rising';
  return {...plan, elapsed, volume, level, columnTop, height, drunk, complete, sipped, flowing, mode, operatingFlow, flow, mouthFlow: atMouth ? flow : 0, velocity, reynolds,
    liftPressure, frictionPressure, kineticPressure, liftShare: plan.dp ? liftPressure / plan.dp : 0, frictionShare: plan.dp ? frictionPressure / plan.dp : 0, kineticShare: plan.dp ? kineticPressure / plan.dp : 0};
}

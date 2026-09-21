import {validateControls, validTime, clamp} from './physics-kit.js';

const TAU = Math.PI * 2;
export const OVEN = Object.freeze({
  magnetron: 800, cycle: 20, frequency: 2.45e9, light: 299792458,
  coupling: 0.2, depth: 0.012, specificHeat: 4186, conductivity: 0.6,
  density: 1000, height: 0.05, start: 20, limit: 100, duration: 300,
  contrast: 0.6, shift: 0.4, step: 0.1, speedUp: 10, rings: 10, sectors: 32, layers: 4,
});
export const STIRRING = Object.freeze([
  {value: 0, label: 'Stationary food and field'}, {value: 1, label: 'Turntable'},
  {value: 2, label: 'Mode stirrer'}, {value: 3, label: 'Turntable and mode stirrer'},
]);
export const FIELDS = Object.freeze([
  {value: 0, label: 'Weak field at the center'}, {value: 1, label: 'Strong field at the center'},
  {value: 2, label: 'Field shifted sideways'},
]);
export const OVEN_DEFAULTS = Object.freeze({level: 100, seconds: 60, mass: 0.3, stirring: 1, field: 0});
export const OVEN_DOMAINS = Object.freeze({level: [0, 100, 10], seconds: [10, 300, 10], mass: [0.1, 1, 0.1], stirring: [0, 3, 1], field: [0, 2, 1]});
export const wavelength = () => OVEN.light / OVEN.frequency;
export const spotSpacing = () => wavelength() / 2;
export const couplingShare = mass => 1 - Math.exp(-mass / OVEN.coupling);
export const diffusivity = () => OVEN.conductivity / (OVEN.density * OVEN.specificHeat);
export const turns = stirring => stirring === 1 || stirring === 3;
export const stirs = stirring => stirring >= 2;
export const fieldPhase = field => [0, Math.PI, Math.PI / 2][field];
export const stirShift = clock => {
  const angle = TAU * clock / 8, radius = OVEN.shift * spotSpacing();
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
};

/** Prescribed interference pattern, not a Maxwell solution of this cavity. */
export function pattern(values, x, z, clock) {
  const angle = turns(values.stirring) ? TAU * clock / 10 : 0;
  const [dx, dz] = stirs(values.stirring) ? stirShift(clock) : [0, 0];
  const X = x * Math.cos(angle) + z * Math.sin(angle) - dx;
  const Z = -x * Math.sin(angle) + z * Math.cos(angle) - dz;
  const k = TAU / spotSpacing(), phase = fieldPhase(values.field);
  return 1 - OVEN.contrast * (Math.cos(k * X + phase) + Math.cos(k * Z + phase)) / 2;
}

const grids = new Map();
/** SI finite volumes in a nonflowing cylindrical food sample. Insulated boundary. */
export function thermalGrid(mass) {
  validateControls({mass}, OVEN_DEFAULTS, OVEN_DOMAINS, 'microwave oven');
  if (grids.has(mass)) return grids.get(mass);
  const radius = Math.sqrt(mass / OVEN.density / (Math.PI * OVEN.height));
  const dr = radius / OVEN.rings, da = TAU / OVEN.sectors, dz = OVEN.height / OVEN.layers;
  const plane = [{x: 0, z: 0, r: 0, area: Math.PI * dr ** 2, inner: 0, outer: dr, angle: 0}];
  for (let ring = 1; ring < OVEN.rings; ring++) for (let j = 0; j < OVEN.sectors; j++) {
    const inner = ring * dr, outer = (ring + 1) * dr;
    const r = 2 / 3 * (outer ** 3 - inner ** 3) / (outer ** 2 - inner ** 2), angle = (j + 0.5) * da;
    plane.push({x: r * Math.cos(angle), z: r * Math.sin(angle), r, area: (outer ** 2 - inner ** 2) * da / 2, inner, outer, angle});
  }
  const cells = [], pairs = [], index = (ring, j) => ring === 0 ? 0 : 1 + (ring - 1) * OVEN.sectors + (j + OVEN.sectors) % OVEN.sectors;
  for (let layer = 0; layer < OVEN.layers; layer++) for (const p of plane) {
    const y = (layer + 0.5) * dz;
    // Chosen side/top/bottom exposure. Real absorption depends on food and field.
    const penetration = Math.exp(-(radius - p.r) / OVEN.depth) + Math.exp(-y / OVEN.depth) + Math.exp(-(OVEN.height - y) / OVEN.depth);
    cells.push({...p, y, mass: p.area * dz * OVEN.density, deposition: p.area * dz * penetration});
  }
  for (let layer = 0; layer < OVEN.layers; layer++) {
    const offset = layer * plane.length;
    for (let ring = 1; ring < OVEN.rings; ring++) for (let j = 0; j < OVEN.sectors; j++) {
      const a = index(ring, j), b = index(ring - 1, j), next = index(ring, j + 1);
      pairs.push([offset + a, offset + b, OVEN.conductivity * dz * da * ring * dr / (plane[a].r - plane[b].r)]);
      pairs.push([offset + a, offset + next, OVEN.conductivity * dz * Math.log(plane[a].outer / plane[a].inner) / da]);
    }
    if (layer + 1 < OVEN.layers) for (let i = 0; i < plane.length; i++) pairs.push([offset + i, offset + i + plane.length, OVEN.conductivity * plane[i].area / dz]);
  }
  const capacity = Float64Array.from(cells, c => c.mass * OVEN.specificHeat), conductance = new Float64Array(cells.length);
  for (const [a, b, G] of pairs) { conductance[a] += G; conductance[b] += G; }
  const stableStep = Math.min(...capacity.map((c, i) => c / conductance[i]));
  const grid = {radius, dr, da, dz, plane, cells, pairs, capacity, stableStep};
  grids.set(mass, grid);
  return grid;
}

function summary(grid, temperatures) {
  let heat = 0, minT = Infinity, maxT = -Infinity;
  for (let i = 0; i < temperatures.length; i++) {
    heat += grid.capacity[i] * (temperatures[i] - OVEN.start);
    minT = Math.min(minT, temperatures[i]); maxT = Math.max(maxT, temperatures[i]);
  }
  const capacity = grid.capacity.reduce((a, b) => a + b, 0);
  return {heat, meanT: OVEN.start + heat / capacity, minT, maxT};
}

const cache = new Map();
/** One thermal field supplies the colors, chart, extrema and energy ledger.
 * ponytail: normalized prescribed RF deposition; coupled Maxwell/material data
 * would be required before claiming quantitative predictions for real food.
 */
export function ovenPlan(input = {}, step = OVEN.step) {
  const values = validateControls(input, OVEN_DEFAULTS, OVEN_DOMAINS, 'microwave oven');
  if (!(step > 0 && step <= OVEN.step && Math.abs(1 / step - Math.round(1 / step)) < 1e-8)) throw new RangeError('Microwave step must divide one second and be no larger than 0.1 s');
  const key = JSON.stringify([values, step]);
  if (cache.has(key)) return cache.get(key);
  const grid = thermalGrid(values.mass), share = couplingShare(values.mass), onFor = OVEN.cycle * values.level / 100;
  const temperatures = new Float64Array(grid.cells.length).fill(OVEN.start);
  const rates = new Float64Array(temperatures.length), weights = new Float64Array(temperatures.length);
  const planePattern = new Float64Array(grid.plane.length), samples = [];
  let absorbed = 0, made = 0, limitTime = null;
  const snapshot = t => ({t, temperatures: temperatures.slice(), absorbed, made, ...summary(grid, temperatures)});
  const conduction = () => {
    rates.fill(0);
    for (const [a, b, G] of grid.pairs) {
      const flow = G * (temperatures[b] - temperatures[a]);
      rates[a] += flow; rates[b] -= flow;
    }
  };
  const advance = dt => { for (let i = 0; i < temperatures.length; i++) temperatures[i] += rates[i] * dt / grid.capacity[i]; };
  const perSecond = Math.round(1 / step), cycleSteps = Math.round(OVEN.cycle / step), onSteps = Math.round(onFor / step);
  for (let n = 0; n <= OVEN.duration * perSecond; n++) {
    const t = n * step;
    if (n % perSecond === 0) samples.push(snapshot(t));
    if (n === OVEN.duration * perSecond) break;
    conduction();
    const on = limitTime === null && n < values.seconds * perSecond && n % cycleSteps < onSteps;
    if (on) {
      for (let i = 0; i < planePattern.length; i++) planePattern[i] = pattern(values, grid.plane[i].x, grid.plane[i].z, t + step / 2);
      let sum = 0;
      for (let i = 0; i < weights.length; i++) { weights[i] = grid.cells[i].deposition * planePattern[i % planePattern.length]; sum += weights[i]; }
      for (let i = 0; i < rates.length; i++) rates[i] += OVEN.magnetron * share * weights[i] / sum;
    }
    let dt = step;
    if (on) for (let i = 0; i < temperatures.length; i++) if (rates[i] > 0) dt = Math.min(dt, Math.max(0, (OVEN.limit - temperatures[i]) * grid.capacity[i] / rates[i]));
    advance(dt);
    made += on ? OVEN.magnetron * dt : 0;
    absorbed += on ? OVEN.magnetron * share * dt : 0;
    if (dt < step) {
      limitTime = t + dt;
      samples.push(snapshot(limitTime));
      conduction(); advance(step - dt);
    }
  }
  const plan = {values, grid, share, onFor, samples, limitTime, heatEnd: limitTime ?? values.seconds, wavelength: wavelength(), spacing: spotSpacing()};
  plan.atEnd = atTime(plan, plan.heatEnd);
  plan.afterStanding = samples.at(-1);
  if (cache.size >= 8) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

function atTime(plan, clock) {
  const samples = plan.samples;
  let low = 0, high = samples.length - 1;
  while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (samples[mid].t <= clock) low = mid; else high = mid; }
  const a = samples[low], b = samples[high], f = clamp((clock - a.t) / (b.t - a.t));
  const temperatures = Float64Array.from(a.temperatures, (v, i) => v + (b.temperatures[i] - v) * f);
  return {t: clock, temperatures, absorbed: a.absorbed + (b.absorbed - a.absorbed) * f, made: a.made + (b.made - a.made) * f, ...summary(plan.grid, temperatures)};
}

/** Nearest finite volume, without invented subcell temperature interpolation. */
export function temperatureAt(state, x, y, z) {
  const g = state.grid, ring = Math.min(OVEN.rings - 1, Math.floor(Math.hypot(x, z) / g.dr));
  const angle = (Math.atan2(z, x) + TAU) % TAU, sector = Math.min(OVEN.sectors - 1, Math.floor(angle / g.da));
  const layer = Math.max(0, Math.min(OVEN.layers - 1, Math.floor(y / g.dz)));
  const i = ring === 0 ? 0 : 1 + (ring - 1) * OVEN.sectors + sector;
  return state.temperatures[layer * g.plane.length + i];
}
export const topTemperature = (state, x, z) => temperatureAt(state, x, OVEN.height, z);

export function sampleOven(input = {}, time = 0) {
  validTime(time);
  const plan = ovenPlan(input), clock = Math.min(OVEN.duration, time);
  const heating = clock < plan.heatEnd, on = heating && clock > 0 && clock % OVEN.cycle < plan.onFor;
  const limited = plan.limitTime !== null && clock >= plan.limitTime;
  const now = {...plan, ...atTime(plan, clock), clock, heating, on, limited, motionClock: Math.min(clock, plan.heatEnd), complete: clock >= OVEN.duration};
  now.mode = clock === 0 ? 'ready' : now.complete ? 'done' : limited ? 'limited' : heating ? (on ? 'heating' : 'resting') : 'standing';
  return now;
}

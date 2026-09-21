import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Electronic paper: charged particles carried across a thin layer of oil by an
// electric field, the light a pixel sends back as they go, the pixels of an
// e-reader's screen, and an electrowetting pixel whose colored oil pulls back.
//
// Exact within the model: the Hückel mobility 2εrε0ζ/(3η), which the
// Electrophoresis page gives for a thick double layer and "non-polar fluids";
// each particle's steady speed in the field V/gap and its crossing time,
// stopped at the far wall; the charge 4πεrε0Rζ that the same balance of
// Coulomb force and Stokes drag implies; the Reynolds number, the time to reach
// full speed and the speed a bare particle would sink at; a screen's pixel
// pitch from its pixels per inch; the electrowetting contact angle from the
// Electrowetting page's cos θ = (γs − γws⁰ + CV²/2)/γw, and the round drop a
// fixed volume of oil makes at that angle.
//
// Sourced: n-hexane's permittivity, viscosity, density and surface tension;
// rutile's density and refractive index; plates 10 to 100 μm apart; E Ink's
// 40 μm capsules, their charges and updates as short as 120 ms; the zeta
// potentials of a colloid in good stability, 40 to 60 mV; three screens'
// pixels; PTFE's dielectric constant and dielectric strength.
//
// Declared, not from a source: n-hexane standing in for the page's
// "hydrocarbon oil"; a drive of 0 to 30 V; the particles' zeta potentials
// spread evenly across 40 to 60 mV; particles packing three deep at a wall; a
// dye that dims light by a factor e every 25 μm; a uniform field, the capsule's
// wall and the binder around it taking none of the voltage; and every number
// of the electrowetting pixel except PTFE's.
// ---------------------------------------------------------------------------

export const EPSILON_0 = 8.8541878188e-12;
export const ELEMENTARY = 1.602176634e-19;
export const GRAVITY = 9.80665;

/** n-hexane: relative permittivity at 20 °C, viscosity in Pa·s, density in kg/m³, surface tension in N/m at 20 °C, refractive index. */
export const OIL = Object.freeze({name: 'n-hexane', permittivity: 1.89, viscosity: 0.3e-3, density: 660.6, tension: 18.40e-3, index: 1.375});
/** Rutile titania: density in kg/m³ and refractive index; the simplest ink's particles are about 1 μm across. */
export const TITANIA = Object.freeze({density: 4230, index: 2.609, diameter: 1});
export const RADIUS = TITANIA.diameter / 2;
export const WATER = Object.freeze({tension: 71.97e-3});
/** PTFE: dielectric constant and dielectric strength in V/m. */
export const PTFE = Object.freeze({permittivity: 2.1, strength: 60e6});
/** Zeta potentials, V, of a colloid in good stability. */
export const ZETA = Object.freeze([0.04, 0.06]);

/** Figures from the pages, μm, ms and percent: plate gaps, capsule and Microcup sizes, particle sizes, the laminate, gray shades, E Ink's update, the electrofluidic reservoir, white state and layer. */
export const PAGES = Object.freeze({plates: Object.freeze([10, 100]), capsule: 40, microcup: 150, particles: Object.freeze([0.1, 5]), laminate: 80, shades: 16, update: 120, reservoir: Object.freeze([5, 10]), white: 85, layer: 15, kindleUntil: 2022});

/** Three 6 inch screens: pixels across and down and the pixels per inch each page gives. */
export const SCREENS = Object.freeze([
  Object.freeze({name: 'Kindle', width: 600, height: 800, ppi: 167, diagonal: 6}),
  Object.freeze({name: 'E Ink Carta', width: 768, height: 1024, ppi: 212, diagonal: 6}),
  Object.freeze({name: 'E Ink Carta HD', width: 1080, height: 1440, ppi: 300, diagonal: 6}),
]);

/** Declared: layers of particles at a wall, the dye's dimming per μm, seconds the drive stays off after its pulse, how much slower the clock drawn runs, the width of the slice between plates in μm, light columns per μm, chart samples and the random seed. */
export const INK = Object.freeze({layers: 3, dye: 1 / 25, hold: 0.05, slow: 100, width: 40, perMicron: 10, samples: 121, seed: 2026});

/** Declared electrowetting pixel: fluoropolymer thickness in μm, oil and water tension in N/m, contact angle through the water at no voltage in degrees, oil film in μm and pixel width in μm. */
export const WETTING = Object.freeze({thickness: 1, tension: 50e-3, angle: 170, film: 5, pixel: 150});

export const INK_OPTIONS = Object.freeze([{value: 0, label: 'Titania in dyed oil'}, {value: 1, label: 'Black and white in capsules'}].map(Object.freeze));
export const TARGET_OPTIONS = Object.freeze([{value: 0, label: 'Write white'}, {value: 1, label: 'Write black'}].map(Object.freeze));
export const SCREEN_OPTIONS = Object.freeze(SCREENS.map((screen, value) => Object.freeze({value, label: `${screen.name}, ${screen.ppi} ppi`})));
export const PAPER_DEFAULTS = Object.freeze({ink: 0, gap: 40, voltage: 15, pulse: 80, target: 0, screen: 1, wetting: 40});
export const PAPER_DOMAINS = Object.freeze({ink: Object.freeze([0, 1, 1]), gap: Object.freeze([10, 100, 5]), voltage: Object.freeze([0, 30, 1]), pulse: Object.freeze([0, 200, 5]), target: Object.freeze([0, 1, 1]), screen: Object.freeze([0, 2, 1]), wetting: Object.freeze([0, 50, 1])});

/** Hückel's electrophoretic mobility, m²/(V·s), for a zeta potential in volts. */
export const mobility = (zeta, oil = OIL) => 2 * oil.permittivity * EPSILON_0 * zeta / (3 * oil.viscosity);
/** The charge, C, on a sphere `radius` μm across whose surface sits at `zeta` volts, unscreened. */
export const chargeOf = (zeta, radius = RADIUS, oil = OIL) => 4 * Math.PI * oil.permittivity * EPSILON_0 * radius * 1e-6 * zeta;
/** The speed, μm/s, a bare particle sinks at through the oil. */
export const settlingSpeed = (radius = RADIUS, particle = TITANIA, oil = OIL) => 2 * (particle.density - oil.density) * GRAVITY * (radius * 1e-6) ** 2 / (9 * oil.viscosity) * 1e6;
/** Seconds a particle takes to come within a factor e of its full speed: its mass over 6πηR. */
export const relaxationTime = (radius = RADIUS, particle = TITANIA, oil = OIL) => 2 * particle.density * (radius * 1e-6) ** 2 / (9 * oil.viscosity);
/** Reynolds number of a sphere of radius `radius` μm moving at `speed` μm/s, taken on its diameter. */
export const reynoldsOf = (speed, radius = RADIUS, oil = OIL) => oil.density * speed * 1e-6 * 2 * radius * 1e-6 / oil.viscosity;
/** A screen's pixel pitch, μm. */
export const pitchOf = screen => 25400 / screen.ppi;
/** Pixels per inch worked out from a screen's pixels and its diagonal. */
export const diagonalPpi = screen => Math.hypot(screen.width, screen.height) / screen.diagonal;

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where a particle's center rests against the front wall and the back wall, μm from the front, `layer` particles in from the wall; null where it does not fit. */
export function restDepths(ink, gap, x, layer) {
  const inset = RADIUS * (1 + 2 * layer);
  if (ink === 0) return gap - 2 * inset >= 0 ? [inset, gap - inset] : null;
  const rho = gap / 2 - inset;
  if (Math.abs(x) >= rho) return null;
  const half = Math.sqrt(rho * rho - x * x);
  return [gap / 2 - half, gap / 2 + half];
}

const layouts = new Map();

/**
 * The particles in a slice one particle thick through the ink: white (species
 * 0), and black (species 1) in a capsule, each at its x in μm, its layer from
 * the wall, its resting depths and its zeta potential. Between plates the
 * slice is 40 μm wide; a capsule is as wide as the gap.
 */
export function layoutOf(ink, gap) {
  const key = `${ink}:${gap}`;
  if (layouts.has(key)) return layouts.get(key);
  const width = ink === 0 ? INK.width : gap, particles = [];
  for (let species = 0; species <= ink; species++) {
    const set = [];
    for (let layer = 0; layer < INK.layers; layer++) {
      const shift = ((layer + species) % 2) * RADIUS;
      for (let j = 0; ; j++) {
        const x = -width / 2 + RADIUS + shift + 2 * RADIUS * j;
        if (x > width / 2 - RADIUS + 1e-9) break;
        const rest = restDepths(ink, gap, x, layer);
        if (rest) set.push({species, x, layer, front: rest[0], back: rest[1]});
      }
    }
    const rank = set.map((_, i) => i), next = random(INK.seed + 97 * ink + 131 * gap + 7 * species);
    for (let i = rank.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [rank[i], rank[j]] = [rank[j], rank[i]]; }
    set.forEach((particle, i) => { particle.zeta = ZETA[0] + (ZETA[1] - ZETA[0]) * (rank[i] + 0.5) / set.length; });
    particles.push(...set);
  }
  const layout = Object.freeze({ink, gap, width, columns: Math.round(width * INK.perMicron), particles: Object.freeze(particles.map(Object.freeze)), counts: Object.freeze([0, 1].map(species => particles.filter(particle => particle.species === species).length))});
  layouts.set(key, layout);
  return layout;
}

/**
 * The light the slice sends back, as a share of what comes in: in each column
 * the particle nearest the viewer decides. A white particle sends the light
 * back dimmed on the way in and out by any dye in front of it; a black one and
 * an empty column send none.
 */
export function lightOf(layout, depths) {
  const {columns, width, ink} = layout, per = INK.perMicron, nearest = new Float64Array(columns).fill(Infinity), kind = new Int8Array(columns).fill(-1);
  layout.particles.forEach((particle, i) => {
    const first = Math.max(0, Math.ceil((particle.x - RADIUS + width / 2) * per - 0.5)), last = Math.min(columns - 1, Math.floor((particle.x + RADIUS + width / 2) * per - 0.5));
    for (let c = first; c <= last; c++) {
      const dx = -width / 2 + (c + 0.5) / per - particle.x, reach = RADIUS * RADIUS - dx * dx;
      if (reach <= 0) continue;
      const top = depths[i] - Math.sqrt(reach);
      if (top < nearest[c]) { nearest[c] = top; kind[c] = particle.species; }
    }
  });
  let sum = 0;
  for (let c = 0; c < columns; c++) if (kind[c] === 0) sum += ink === 0 ? Math.exp(-2 * INK.dye * Math.max(0, nearest[c])) : 1;
  return sum / columns;
}

/** Each particle's depth, μm from the front, once the drive has been on `driven` seconds. */
export function depthsAt(plan, driven) {
  const depths = new Float64Array(plan.layout.particles.length);
  plan.layout.particles.forEach((particle, i) => {
    const run = plan.speeds[i] * driven;
    depths[i] = plan.toFront[i] ? Math.max(particle.front, particle.back - run) : Math.min(particle.back, particle.front + run);
  });
  return depths;
}

/** How far the white particles have gone, on average, as a share of their way across. */
export function progressOf(plan, depths) {
  let sum = 0, count = 0;
  plan.layout.particles.forEach((particle, i) => {
    if (particle.species !== 0) return;
    sum += Math.abs(depths[i] - (plan.toFront[i] ? particle.back : particle.front)) / (particle.back - particle.front);
    count++;
  });
  return sum / count;
}

/** The electrowetting pixel at `voltage`: the contact angle through the water and through the oil, and the oil as a film or a round drop. */
export function wettingOf(voltage, w = WETTING) {
  const capacitance = PTFE.permittivity * EPSILON_0 / (w.thickness * 1e-6);
  const cosTheta = Math.cos(w.angle * Math.PI / 180) + capacitance * voltage ** 2 / (2 * w.tension);
  const theta = Math.acos(clamp(cosTheta, -1, 1)), alpha = Math.PI - theta, k = Math.tan(alpha / 2);
  const volume = w.film * w.pixel ** 2, base = Math.cbrt(6 * volume / (Math.PI * k * (3 + k * k))), film = base > w.pixel / 2;
  return {voltage, capacitance, cosTheta, theta, alpha, volume, base, height: base * k, film, coverage: film ? 1 : Math.PI * base ** 2 / w.pixel ** 2, field: voltage / (w.thickness * 1e-6)};
}

/** The voltage at which a round drop of the oil first fits inside the pixel: tan(α/2) from its cubic by Cardano's formula, then the angle's voltage. */
export function wettingThreshold(w = WETTING) {
  const c = 48 * w.film / (Math.PI * w.pixel), root = Math.sqrt(c * c / 4 + 1), k = Math.cbrt(c / 2 + root) + Math.cbrt(c / 2 - root);
  const capacitance = PTFE.permittivity * EPSILON_0 / (w.thickness * 1e-6);
  return Math.sqrt((Math.cos(Math.PI - 2 * Math.atan(k)) - Math.cos(w.angle * Math.PI / 180)) * 2 * w.tension / capacitance);
}

const plans = new Map();

/** Everything about the ink, the screen and the electrowetting pixel that does not change as the clock runs. */
export function paperPlan(input) {
  const values = validateControls(input, PAPER_DEFAULTS, PAPER_DOMAINS, 'electronic paper');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const {ink, gap, voltage, target} = values, pulse = values.pulse / 1000, duration = pulse + INK.hold;
  const layout = layoutOf(ink, gap), field = voltage / (gap * 1e-6), travel = gap - 2 * RADIUS;
  const speeds = Float64Array.from(layout.particles, particle => mobility(particle.zeta) * field * 1e6);
  const toFront = Object.freeze(layout.particles.map(particle => (particle.species === 0) === (target === 0)));
  const arrivals = layout.particles.map((particle, i) => (speeds[i] > 0 ? (particle.back - particle.front) / speeds[i] : null));
  const middle = (ZETA[0] + ZETA[1]) / 2, crossingAt = zeta => (voltage > 0 ? gap * 1e-6 * travel * 1e-6 / (mobility(zeta) * voltage) : null);
  const speed = mobility(middle) * field * 1e6, settling = settlingSpeed(), relaxation = relaxationTime();
  const screen = SCREENS[values.screen], pitch = pitchOf(screen);
  const plan = {
    values, ink, gap, voltage, target, pulse, hold: INK.hold, duration, slow: INK.slow, layout, field, travel, speeds, toFront, arrivals,
    lastArrival: voltage > 0 ? Math.max(...arrivals) : null, middle, mobility: mobility(middle), speed, crossing: crossingAt(middle), slowest: crossingAt(ZETA[0]), fastest: crossingAt(ZETA[1]),
    charge: chargeOf(middle), electrons: chargeOf(middle) / ELEMENTARY, reynolds: reynoldsOf(speed), relaxation, lag: speed * relaxation * 1000,
    settling, settleCross: travel / settling, forceRatio: speed / settling, weight: 4 / 3 * Math.PI * (RADIUS * 1e-6) ** 3 * (TITANIA.density - OIL.density) * GRAVITY,
    capsuleCount: ink === 1 ? Array.from({length: INK.layers}, (_, layer) => 2 * Math.PI * (gap / 2 - RADIUS * (1 + 2 * layer)) ** 2 / (2 * RADIUS) ** 2).reduce((a, b) => a + b, 0) : 0,
    screen, pitch, diagonal: diagonalPpi(screen), capsulesAcross: ink === 1 ? pitch / gap : 0, pageBytes: screen.width * screen.height * Math.log2(PAGES.shades) / 8,
    wet: wettingOf(values.wetting), threshold: wettingThreshold(),
  };
  plan.whiteRef = lightOf(layout, Float64Array.from(layout.particles, particle => (particle.species === 0 ? particle.front : particle.back)));
  plan.blackLevel = lightOf(layout, Float64Array.from(layout.particles, particle => (particle.species === 0 ? particle.back : particle.front))) / plan.whiteRef;
  plan.chart = Object.freeze(Array.from({length: INK.samples}, (_, j) => {
    const t = duration * j / (INK.samples - 1), depths = depthsAt(plan, Math.min(t, pulse));
    return Object.freeze({t, light: lightOf(layout, depths) / plan.whiteRef, progress: progressOf(plan, depths)});
  }));
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The ink `time` seconds into a write: the drive on for the pulse, then off, with every particle where the drive left it. */
export function paperAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), driven = Math.min(t, plan.pulse), depths = depthsAt(plan, driven);
  let arrived = 0;
  for (const arrival of plan.arrivals) if (arrival !== null && arrival <= driven) arrived++;
  return {time, t, driving: t < plan.pulse, driven, depths, light: lightOf(plan.layout, depths) / plan.whiteRef, progress: progressOf(plan, depths), arrived, done: time >= plan.duration};
}

export const samplePaper = (input, time = 0) => paperAt(paperPlan(input), time);

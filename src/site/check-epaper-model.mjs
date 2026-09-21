// Checks the electronic paper model and its electronic ink, electrowetting
// display and e-reader lessons against their sources typed in again and their
// physics worked out by other routes: Hückel's mobility rebuilt from a charged
// sphere's pull balanced by Stokes's drag, a particle's crossing integrated
// again with its inertia, the light sent back found again column by column and
// from the drawn particles, the electrowetting angle found again as the least
// energy of a drop of fixed volume and the drop's volume by slices, and every
// drawn particle, square, capsule, curve and drop read back at swept settings
// and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './epaper-physics.js';
import * as M from './epaper-model.js';
import * as L from './epaper-lessons.js';
import {houseComponents} from './house-components.js';
import {studyLessons} from './study-lessons.js';

const t = tally();
const counts = {particles: 0, columns: 0, steps: 0, energies: 0, poses: 0, points: 0, numbers: 0};
const deg = radians => radians * 180 / Math.PI;
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and what follows from them.
// ---------------------------------------------------------------------------

const SRC = {
  e0: 8.8541878188e-12, e: 1.602176634e-19, g: 9.80665,
  hexane: {permittivity: 1.89, viscosity: 0.3, density: 0.6606, tension: 18.40, index: 1.375},
  rutile: {density: 4.23, index: 2.609},
  water: {tension: 71.97},
  ptfe: {permittivity: 2.1, strength: 60},
  zeta: [40, 60],
  paper: {plates: [10, 100], particle: 1, capsuleMm: 0.04, early: 40, laminate: 80, microcupMm: 0.15, particles: [0.1, 5], reservoir: [5, 10], white: 85, layer: 15},
  eInk: {update: 120},
  screens: [['Kindle', 600, 800, 167], ['E Ink Carta', 768, 1024, 212], ['E Ink Carta HD', 1080, 1440, 300]], inches: 6,
  kindle: {until: 2022, first: [2007, 4], later: [2009, 16], paperwhite: 2012},
};
const R = 0.5, DYE = 25, CELL_WIDTH = 40;
t.ok(P.EPSILON_0 === SRC.e0 && P.ELEMENTARY === SRC.e && P.GRAVITY === SRC.g, 'CODATA’s vacuum permittivity, the exact elementary charge and standard gravity');
t.ok(P.OIL.name === 'n-hexane' && P.OIL.permittivity === SRC.hexane.permittivity && P.OIL.index === SRC.hexane.index, 'n-hexane: a relative permittivity of 1.89 at 20 °C and a refractive index of 1.375');
t.near(P.OIL.viscosity, SRC.hexane.viscosity / 1000, 1e-18, 'n-hexane: 0.3 mPa·s');
t.near(P.OIL.density, SRC.hexane.density * 1000, 1e-9, 'n-hexane: 0.6606 g/mL');
t.near(P.OIL.tension, SRC.hexane.tension / 1000, 1e-15, 'n-hexane: 18.40 mN/m at 20 °C');
t.near(P.TITANIA.density, SRC.rutile.density * 1000, 1e-9, 'rutile: 4.23 g/cm³');
t.ok(P.TITANIA.index === SRC.rutile.index && P.TITANIA.diameter === SRC.paper.particle && P.RADIUS === R, 'rutile’s index of 2.609, and particles about 1 μm across');
t.ok(P.TITANIA.diameter >= SRC.paper.particles[0] && P.TITANIA.diameter <= SRC.paper.particles[1], 'inside the page’s 0.1 to 5 μm');
t.near(P.WATER.tension, SRC.water.tension / 1000, 1e-15, 'water: 71.97 mN/m at 25 °C');
t.ok(P.PTFE.permittivity === SRC.ptfe.permittivity && P.PTFE.strength === SRC.ptfe.strength * 1e6, 'PTFE: a dielectric constant of 2.1 and a dielectric strength of 60 MV/m');
t.near(P.ZETA[0] * 1000, SRC.zeta[0], 1e-9, 'good stability from 40 mV');
t.near(P.ZETA[1] * 1000, SRC.zeta[1], 1e-9, 'to 60 mV');
assert.deepEqual([...P.PAGES.plates], SRC.paper.plates);
t.ok(Math.abs(P.PAGES.capsule - SRC.paper.capsuleMm * 1000) < 1e-9 && P.PAGES.capsule === SRC.paper.early && Math.abs(P.PAGES.microcup - SRC.paper.microcupMm * 1000) < 1e-9 && P.PAGES.laminate === SRC.paper.laminate, 'E Ink’s 0.04 mm capsules, about 40 μm, SiPix’s 0.15 mm cups and an 80 μm sheet');
t.ok(P.PAGES.particles[0] === SRC.paper.particles[0] && P.PAGES.particles[1] === SRC.paper.particles[1] && P.PAGES.shades === SRC.kindle.later[1] && P.PAGES.update === SRC.eInk.update && P.PAGES.kindleUntil === SRC.kindle.until, 'particles of 0.1 to 5 μm, 16 shades, updates of 120 ms, and the basic Kindle until 2022');
t.ok(P.PAGES.reservoir[0] === SRC.paper.reservoir[0] && P.PAGES.reservoir[1] === SRC.paper.reservoir[1] && P.PAGES.white === SRC.paper.white && P.PAGES.layer === SRC.paper.layer, 'the electrofluidic reservoir under 5 to 10%, 85% white and under 15 μm');
assert.deepEqual({...P.INK}, {layers: 3, dye: 1 / DYE, hold: 0.05, slow: 100, width: CELL_WIDTH, perMicron: 10, samples: 121, seed: 2026});
assert.deepEqual({...P.WETTING}, {thickness: 1, tension: 0.05, angle: 170, film: 5, pixel: 150});
assert.deepEqual(JSON.parse(JSON.stringify(P.PAPER_DOMAINS)), {ink: [0, 1, 1], gap: [10, 100, 5], voltage: [0, 30, 1], pulse: [0, 200, 5], target: [0, 1, 1], screen: [0, 2, 1], wetting: [0, 50, 1]});
assert.deepEqual({...P.PAPER_DEFAULTS}, {ink: 0, gap: 40, voltage: 15, pulse: 80, target: 0, screen: 1, wetting: 40});
t.ok(P.PAPER_DOMAINS.gap[0] === SRC.paper.plates[0] && P.PAPER_DOMAINS.gap[1] === SRC.paper.plates[1] && P.PAPER_DEFAULTS.gap === SRC.paper.early, 'gaps across the page’s 10 to 100 μm, starting at E Ink’s 40 μm capsules');
t.ok(P.PAPER_DOMAINS.wetting[1] < SRC.ptfe.strength * P.WETTING.thickness, 'the electrowetting drive stops short of the fluoropolymer’s breakdown');
assert.deepEqual(P.INK_OPTIONS.map(option => [option.value, option.label]), [[0, 'Titania in dyed oil'], [1, 'Black and white in capsules']]);
assert.deepEqual(P.TARGET_OPTIONS.map(option => [option.value, option.label]), [[0, 'Write white'], [1, 'Write black']]);

const diagonals = [1000, 1280, 1800];
for (const [i, [name, width, height, ppi]] of SRC.screens.entries()) {
  const screen = P.SCREENS[i];
  t.ok(screen.name === name && screen.width === width && screen.height === height && screen.ppi === ppi && screen.diagonal === SRC.inches && P.SCREEN_OPTIONS[i].label === `${name}, ${ppi} ppi` && P.SCREEN_OPTIONS[i].value === i, `${name} as its page gives it`);
  t.ok(Math.hypot(width, height) === diagonals[i], `${name}: a diagonal of ${diagonals[i]} pixels`);
  t.near(P.diagonalPpi(screen), diagonals[i] / SRC.inches, 1e-12, `${name}: pixels per inch from its diagonal`);
  t.near(P.pitchOf(screen), 25.4 / ppi * 1000, 1e-9, `${name}: 25.4 mm over ${ppi}`);
  t.ok(P.paperPlan({screen: i}).pageBytes === width * height * 4 / 8, `${name}: 4 bits a pixel for 16 shades`);
}
t.ok(Math.round(1000 / 6) === 167 && f1(1280 / 6) === '213.3' && 1800 / 6 === 300 && Math.log2(16) === 4, 'the Kindle’s 167 ppi and Carta HD’s 300 from their diagonals, and 213.3 against Carta’s 212');

// Hückel’s mobility, rebuilt: a sphere whose surface sits at ζ, unscreened,
// carries q = 4πεrε0Rζ, and in a field E moves where qE = 6πηRv.
for (const zeta of [0.04, 0.05, 0.06]) {
  for (const radius of [0.05, 0.5, 2.5]) {
    const meters = radius * 1e-6, q = 4 * Math.PI * SRC.hexane.permittivity * SRC.e0 * meters * zeta, v = q / (6 * Math.PI * SRC.hexane.viscosity / 1000 * meters);
    t.near(P.mobility(zeta), v, relative(v, 1e-9), `Hückel at ${zeta * 1000} mV for a particle ${2 * radius} μm across: a charged sphere against Stokes’s drag`);
    t.near(P.chargeOf(zeta, radius), q, relative(q, 1e-12), `the charge at ${zeta * 1000} mV and ${radius} μm`);
  }
}
t.ok(f0(P.chargeOf(0.05) / SRC.e) === '33' && f2(P.chargeOf(0.05) * 1e18) === '5.26' && f2(P.mobility(0.05) * 1e9) === '1.86', 'about 33 electron charges, 5.26 × 10⁻¹⁸ C, and 1.86 × 10⁻⁹ m²/(V·s)');
{
  const meters = R * 1e-6, drag = 6 * Math.PI * SRC.hexane.viscosity / 1000 * meters, weight = 4 / 3 * Math.PI * meters ** 3 * (SRC.rutile.density - SRC.hexane.density) * 1000 * SRC.g, mass = 4 / 3 * Math.PI * meters ** 3 * SRC.rutile.density * 1000;
  const plan = P.paperPlan({});
  t.near(P.settlingSpeed() * 1e-6, weight / drag, relative(weight / drag, 1e-9), 'sinking: buoyant weight against Stokes’s drag');
  t.near(P.relaxationTime(), mass / drag, relative(mass / drag, 1e-9), 'the time to full speed: mass over drag');
  t.near(plan.weight, weight, relative(weight, 1e-9), 'the buoyant weight');
  t.near(plan.forceRatio, P.chargeOf(0.05) * plan.field / weight, relative(plan.forceRatio, 1e-9), 'the field pulls as many times harder than gravity by force as by speed');
  t.near(plan.reynolds, SRC.hexane.density * 1000 * plan.speed * 1e-6 * 2 * meters / (SRC.hexane.viscosity / 1000), relative(plan.reynolds, 1e-9), 'the Reynolds number on the diameter');
  t.ok(f2(plan.settling) === '6.48' && f1(plan.settleCross) === '6.0' && f0(plan.forceRatio) === '108' && fixed(plan.reynolds, 4) === '0.0015' && f2(plan.relaxation * 1e6) === '0.78' && f2(plan.lag) === '0.55', '6.48 μm/s, 6.0 s, 108 times, 0.0015, 0.78 μs and 0.55 nm');
}

// A crossing integrated again with the particle’s inertia: from rest, the
// arrival trails the steady speed’s crossing by one relaxation time.
for (const values of [{}, {gap: 10}, {voltage: 5}]) {
  const plan = P.paperPlan(values), meters = R * 1e-6, mass = 4 / 3 * Math.PI * meters ** 3 * SRC.rutile.density * 1000, drag = 6 * Math.PI * SRC.hexane.viscosity / 1000 * meters;
  const force = P.chargeOf(0.05) * plan.field, travel = plan.travel * 1e-6, tau = mass / drag, dt = tau / 8, accel = u => (force - drag * u) / mass;
  let x = 0, v = 0, time = 0;
  while (x < travel) {
    const k1v = accel(v), k2v = accel(v + dt / 2 * k1v), k3v = accel(v + dt / 2 * k2v), k4v = accel(v + dt * k3v);
    const k1x = v, k2x = v + dt / 2 * k1v, k3x = v + dt / 2 * k2v, k4x = v + dt * k3v;
    x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
    time += dt;
    counts.steps++;
  }
  t.near(time - plan.crossing, tau, 1.5 * dt, `${JSON.stringify(values)}: the inertial crossing trails the steady one by ${f2(tau * 1e6)} μs`);
  t.near(plan.speed * 1e-6, force / drag, relative(force / drag, 1e-9), 'the steady speed');
  t.near(plan.crossing, plan.gap * 1e-6 * plan.travel * 1e-6 / (P.mobility(0.05) * plan.voltage), relative(plan.crossing, 1e-12), 'gap × (gap − 1 μm) / (μV)');
}
{
  const [def, thin, wide, weak] = [{}, {gap: 20}, {gap: 100}, {voltage: 5}].map(P.paperPlan);
  t.ok(f2(def.crossing * 1000) === '55.93' && f1(def.slowest * 1000) === '69.9' && f1(def.fastest * 1000) === '46.6' && f0(def.lastArrival * 1000) === '70', 'at 15 V across 40 μm: 55.9 ms at 50 mV, 69.9 ms at 40 mV and 46.6 ms at 60 mV');
  t.near(def.crossing / thin.crossing, 40 * 39 / (20 * 19), 1e-12, 'crossing time as the gap squared, less a particle');
  t.ok(Math.round(def.crossing / thin.crossing) === 4 && f0(wide.crossing * 1000) === '355' && f0(weak.crossing * 1000) === '168' && f1(P.paperPlan({gap: 10}).crossing * 1000) === '3.2', 'about four times faster at half the gap; 355 ms at 100 μm, 168 ms at 5 V and 3.2 ms at 10 μm');
  const none = P.paperPlan({voltage: 0});
  t.ok(none.crossing === null && none.slowest === null && none.lastArrival === null && none.arrivals.every(arrival => arrival === null) && P.paperAt(none, 1).arrived === 0, 'with no voltage nothing ever arrives');
}

// The particles’ layout: evenly spread zeta potentials, resting places against
// flat plates or on circles inside a capsule, and no overlaps at rest.
for (const ink of [0, 1]) {
  for (let gap = 10; gap <= 100; gap += 5) {
    const layout = P.layoutOf(ink, gap), width = ink === 0 ? CELL_WIDTH : gap;
    t.ok(layout.width === width && layout.columns === width * 10 && layout.ink === ink && layout.gap === gap, `${ink}:${gap}: a slice ${width} μm wide in ${width * 10} columns`);
    for (const species of ink ? [0, 1] : [0]) {
      const set = layout.particles.filter(particle => particle.species === species);
      t.ok(set.length === layout.counts[species] && set.length > 0 && set.every(particle => particle.layer >= 0 && particle.layer < 3), `${ink}:${gap}: ${set.length} particles of species ${species} in 3 layers`);
      set.map(particle => particle.zeta).sort((a, b) => a - b).forEach((zeta, k) => t.near(zeta, 0.04 + 0.02 * (k + 0.5) / set.length, 1e-15, 'zeta potentials spread evenly across 40 to 60 mV'));
      for (const particle of set) {
        const inset = R * (1 + 2 * particle.layer);
        if (ink === 0) t.ok(particle.front === inset && particle.back === gap - inset && Math.abs(particle.x) <= CELL_WIDTH / 2 - R + 1e-9, 'between plates, resting its layer in from the wall');
        else {
          t.near(Math.hypot(particle.x, particle.front - gap / 2), gap / 2 - inset, 1e-9, 'inside a capsule, resting on a circle its layer in');
          t.near(Math.hypot(particle.x, particle.back - gap / 2), gap / 2 - inset, 1e-9, 'at the front and at the back');
          t.ok(particle.back > particle.front, 'with room to move');
        }
        counts.particles++;
      }
      for (const wall of ['front', 'back']) {
        let closest = Infinity;
        for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) closest = Math.min(closest, Math.hypot(set[i].x - set[j].x, set[i][wall] - set[j][wall]));
        t.ok(closest >= 2 * R - 1e-9, `${ink}:${gap}: particles rest against the ${wall} without overlapping`);
      }
    }
    if (ink === 0) t.ok(layout.counts[0] === 119 && layout.counts[1] === 0, 'between plates: 40, 39 and 40 white particles in three layers');
  }
}

// Each particle’s place at a time, worked out again, and the drive’s memory.
const depthsOf = (plan, time) => {
  const driven = Math.min(time, plan.duration, plan.pulse);
  return plan.layout.particles.map(particle => {
    const speed = P.mobility(particle.zeta) * plan.voltage / (plan.gap * 1e-6) * 1e6, up = (particle.species === 0) === (plan.target === 0);
    return up ? Math.max(particle.front, particle.back - speed * driven) : Math.min(particle.back, particle.front + speed * driven);
  });
};
const settings = [];
for (const ink of [0, 1]) for (const gap of [10, 40, 100]) for (const target of [0, 1]) settings.push({ink, gap, target, voltage: gap === 100 ? 30 : (ink + target) % 2 ? 5 : 15, pulse: gap === 40 ? 30 : 80, screen: (ink + gap / 10) % 3, wetting: [0, 14, 15, 40, 50][(gap / 10 + target + ink) % 5]});
settings.push({voltage: 0}, {pulse: 0}, {ink: 1, pulse: 200});
for (const values of settings) {
  const plan = P.paperPlan(values);
  for (const time of [0, plan.pulse / 3, plan.pulse, plan.pulse + plan.hold / 2, plan.duration, plan.duration + 1]) {
    const now = P.paperAt(plan, time), expected = depthsOf(plan, time), driven = Math.min(time, plan.duration, plan.pulse);
    expected.forEach((depth, i) => t.near(now.depths[i], depth, 1e-9, 'a particle where its speed has carried it'));
    const arrivals = plan.layout.particles.filter((particle, i) => plan.voltage > 0 && (particle.back - particle.front) / (P.mobility(particle.zeta) * plan.voltage / (plan.gap * 1e-6) * 1e6) <= driven).length;
    t.ok(now.arrived === arrivals && now.driving === (Math.min(time, plan.duration) < plan.pulse) && now.done === (time >= plan.duration), 'arrivals, the drive and the end counted again');
  }
  const atPulse = P.paperAt(plan, plan.pulse), atEnd = P.paperAt(plan, plan.duration);
  t.ok(atPulse.depths.every((depth, i) => depth === atEnd.depths[i]) && atPulse.light === atEnd.light, `${JSON.stringify(values)}: with the drive off nothing moves`);
}

// The light sent back, found again column by column at any grain.
function lightByColumns(layout, depths, perMicron) {
  const columns = Math.round(layout.width * perMicron);
  let sum = 0;
  for (let c = 0; c < columns; c++) {
    const x = -layout.width / 2 + (c + 0.5) / perMicron;
    let top = Infinity, kind = -1;
    for (let i = 0; i < layout.particles.length; i++) {
      const dx = x - layout.particles[i].x;
      if (Math.abs(dx) >= R) continue;
      const surface = depths[i] - Math.sqrt(R * R - dx * dx);
      if (surface < top) { top = surface; kind = layout.particles[i].species; }
    }
    if (kind === 0) sum += layout.ink === 0 ? Math.exp(-2 * Math.max(0, top) / DYE) : 1;
    counts.columns++;
  }
  return sum / columns;
}
const simpson = (fn, a, b, n = 2000) => { const h = (b - a) / n; let sum = 0; for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * fn(a + i * h); return sum * h / 3; };
for (const values of settings) {
  const plan = P.paperPlan(values), layout = plan.layout;
  const white = layout.particles.map(particle => (particle.species === 0 ? particle.front : particle.back)), black = layout.particles.map(particle => (particle.species === 0 ? particle.back : particle.front));
  t.near(plan.whiteRef, lightByColumns(layout, white, 10), 1e-12, `${JSON.stringify(values)}: the whitest light, column by column`);
  t.near(plan.blackLevel, lightByColumns(layout, black, 10) / plan.whiteRef, 1e-12, 'the darkest light, column by column');
  for (const time of [plan.pulse / 3, plan.pulse]) {
    const now = P.paperAt(plan, time), depths = depthsOf(plan, time);
    t.near(now.light, lightByColumns(layout, depths, 10) / plan.whiteRef, 1e-12, 'the light at a time, at the model’s grain');
    t.near(now.light, lightByColumns(layout, depths, 40) / lightByColumns(layout, white, 40), 0.012, 'and at four times the grain');
  }
  if (layout.ink === 0) {
    const whiteFlat = simpson(x => Math.exp(-2 * (R - Math.sqrt(Math.max(0, R * R - x * x))) / DYE), -R, R);
    const blackFlat = simpson(x => Math.exp(-2 * (layout.gap - 5 * R - Math.sqrt(Math.max(0, R * R - x * x))) / DYE), -R, R);
    t.near(plan.whiteRef, whiteFlat, 2e-3, 'between plates the whitest light is the front layer’s curved tops, dimmed, averaged');
    t.near(plan.blackLevel, blackFlat / whiteFlat, 2e-3 * blackFlat / whiteFlat + 1e-6, 'and the darkest, the back’s third layer behind the dye');
  } else t.ok(plan.whiteRef > 0.75 && plan.whiteRef <= 1 && Math.abs(plan.whiteRef - Math.min(...layout.particles.filter(particle => particle.species === 0 && particle.layer === 0).map(particle => particle.x)) / -(layout.width / 2) * (1 + 0.5 / Math.abs(Math.min(...layout.particles.filter(particle => particle.species === 0 && particle.layer === 0).map(particle => particle.x))))) < 0.02, 'a capsule written white shows white wherever its front layer reaches, all but its curved edges');
}
{
  const levels = [10, 20, 40, 100].map(gap => P.paperPlan({gap}).blackLevel);
  t.ok(f0(100 * levels[0]) === '57' && f0(100 * levels[1]) === '26' && f0(100 * levels[2]) === '5' && f2(100 * levels[3]) === '0.04', 'the dye hides 57%, 26%, 5% and 0.04% at 10, 20, 40 and 100 μm');
  t.ok(P.paperPlan({ink: 1}).blackLevel < 1e-12, 'a capsule written black shows black in every column');
}

// The electrowetting pixel: the page’s angle found again as the least energy
// of a drop of fixed volume, its volume by slices, and its threshold by bisection.
const COS0 = Math.cos(170 * Math.PI / 180), CAP = SRC.ptfe.permittivity * SRC.e0 / 1e-6, GAMMA = 0.05, PIXEL = 150, VOLUME = 5 * PIXEL ** 2;
const capHeight = base => { let lo = 0, hi = 1e4; for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (Math.PI * mid * (3 * base * base + mid * mid) / 6 < VOLUME) lo = mid; else hi = mid; } return (lo + hi) / 2; };
const energyOf = (base, volts) => { const h = capHeight(base); return GAMMA * Math.PI * (base * base + h * h) + (GAMMA * COS0 + CAP * volts ** 2 / 2) * Math.PI * base * base; };
function leastEnergy(volts) {
  let a = 1, b = 400;
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 90; k++) {
    const c = b - ratio * (b - a), d = a + ratio * (b - a);
    if (energyOf(c, volts) < energyOf(d, volts)) b = d; else a = c;
    counts.energies++;
  }
  const base = (a + b) / 2, h = capHeight(base);
  return {base, h, alpha: 2 * Math.atan(h / base)};
}
t.near(P.wettingOf(0).capacitance, CAP, relative(CAP, 1e-12), 'C = εrε0/t over 1 μm of PTFE');
for (let volts = 0; volts <= 50; volts++) {
  const wet = P.wettingOf(volts), least = leastEnergy(volts);
  t.near(wet.cosTheta, (GAMMA * COS0 + CAP * volts ** 2 / 2) / GAMMA, 1e-12, `${volts} V: the page’s cos θ = (γs − γws⁰ + CV²/2)/γw`);
  t.near(wet.alpha, least.alpha, 2e-6, `${volts} V: the oil’s angle is where the drop’s energy is least`);
  t.near(wet.base, least.base, 2e-5, `${volts} V: and so is its base`);
  t.near(wet.alpha + wet.theta, Math.PI, 1e-12, 'the two angles at the edge add to 180°');
  t.ok(wet.film === (least.base > PIXEL / 2) && wet.coverage === (wet.film ? 1 : Math.PI * wet.base ** 2 / PIXEL ** 2), `${volts} V: a film until a drop fits in the pixel`);
  t.near(wet.field, volts * 1e6, 1e-6, 'the field over 1 μm');
  if (!wet.film || volts === 0) {
    const rho = (wet.base ** 2 + wet.height ** 2) / (2 * wet.height), sliced = simpson(y => Math.PI * (rho * rho - (y + rho - wet.height) ** 2), 0, wet.height, 400);
    t.near(sliced, VOLUME, relative(VOLUME, 1e-9), `${volts} V: the drop’s volume by slices is the film’s`);
    t.near(wet.height, wet.base * Math.tan(wet.alpha / 2), 1e-9, 'h = a·tan(α/2)');
  }
}
{
  let lo = 0, hi = 50;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (P.wettingOf(mid).base > PIXEL / 2) lo = mid; else hi = mid; }
  t.near(P.wettingThreshold(), (lo + hi) / 2, 1e-9, 'the threshold by Cardano’s formula and by bisection');
  const at = volts => P.wettingOf(volts);
  t.ok(f1(P.wettingThreshold()) === '14.6' && at(14).film && !at(15).film && f0(2 * at(14).base) === '152' && f0(2 * at(15).base) === '149' && f0(100 * at(15).coverage) === '78', 'a film at 14 V, a drop of 149 μm covering 78% at 15 V, and a threshold of 14.6 V');
  t.ok(f1(deg(at(40).theta)) === '133.4' && f1(deg(at(40).alpha)) === '46.6' && f0(2 * at(40).base) === '108' && f1(at(40).height) === '23.2' && f0(100 * at(40).coverage) === '41' && f0(100 - 100 * at(40).coverage) === '59', 'at 40 V: 133.4°, 46.6°, a drop 108 μm across and 23.2 μm high over 41% of the pixel');
  t.ok(f0(2 * at(50).base) === '97' && f0(100 * at(50).coverage) === '33' && f1(CAP * 1e6) === '18.6' && f1(CAP * 40 ** 2 / 2 * 1000) === '14.9' && f3(CAP * 40 ** 2 / 2 / GAMMA) === '0.298' && f3(-COS0) === '0.985' && f3(-at(40).cosTheta) === '0.687', 'at 50 V 97 μm over 33%; C of 18.6 μF/m², 14.9 mJ/m², and cos θ up 0.298 from −0.985 to −0.687');
  t.ok(f2(SRC.ptfe.permittivity * SRC.e0 * (SRC.ptfe.strength * 1e6) ** 2 * 1e-6 / (2 * GAMMA)) === '0.67', 'at PTFE’s strength 1 μm can raise cos θ by at most 0.67');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createElectronicPaperModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const instancesOf = mesh => Array.from({length: mesh.count}, (_, i) => { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); const e = matrix.elements; return {x: e[12], y: e[13], sx: e[0], sy: e[5]}; });
const shadeOf = share => new THREE.Color(M.COLORS.black).lerp(new THREE.Color(M.COLORS.white), Math.max(0, Math.min(1, share)));
const sameColor = (a, b) => Math.abs(a.r - b.r) < 1e-6 && Math.abs(a.g - b.g) < 1e-6 && Math.abs(a.b - b.b) < 1e-6;
assert.deepEqual([...M.PIXELS.pattern], [1, 0, 1, 0, -1, 0, 1, 0, 1]);
t.ok(M.timesLarger(M.PIXEL) === 200 && Math.abs(M.timesLarger(M.CELL) - 2000) < 1e-9 && Math.abs(M.timesLarger(M.WET) - 500) < 1e-9 && M.MM === 0.01, 'the scales the text states: true size, 200, 2,000 and 500 times larger');

for (const values of settings) {
  const plan = P.paperPlan(values), layout = plan.layout, gap = plan.gap, H = layout.width / 2 + M.CELLVIEW.margin;
  for (const time of [0, plan.pulse / 3, plan.pulse, plan.duration]) {
    model.reset();
    model.update(values);
    model.advance(time * P.INK.slow);
    model.root.updateMatrixWorld(true);
    const state = model.getState(), now = state.now, expected = depthsOf(plan, time);
    counts.poses++;
    t.near(state.clock, time, 1e-12, 'the clock drawn 100 times slower');

    // Particles: every one where its speed has carried it, inside the ink.
    const drawn = [...instancesOf(T.whites), ...instancesOf(T.blacks)], order = [...layout.particles.map((particle, i) => [particle, i]).filter(([particle]) => particle.species === 0), ...layout.particles.map((particle, i) => [particle, i]).filter(([particle]) => particle.species === 1)];
    t.ok(T.whites.count === layout.counts[0] && T.blacks.count === layout.counts[1] && drawn.length === layout.particles.length && state.drawnParticles === drawn.length, `${layout.particles.length} particles drawn`);
    const drawnDepths = new Array(layout.particles.length);
    order.forEach(([particle, i], k) => {
      const item = drawn[k], depth = -item.y / M.CELL;
      drawnDepths[i] = depth;
      t.ok(Math.abs(item.x / M.CELL - particle.x) < 1e-4 && Math.abs(depth - expected[i]) < 1e-4 && Math.abs(item.sx - R * M.CELL) < 1e-7 && Math.abs(item.sy - R * M.CELL) < 1e-7, 'a particle drawn at its place and true size, 2,000 times larger');
      if (plan.ink === 0) t.ok(depth - R >= -1e-4 && depth + R <= gap + 1e-4 && Math.abs(item.x / M.CELL) + R <= CELL_WIDTH / 2 + 1e-4, 'between the plates');
      else t.ok(Math.hypot(item.x / M.CELL, depth - gap / 2) + R <= gap / 2 + 1e-4, 'inside its capsule');
      counts.particles++;
    });
    t.near(now.light, lightByColumns(layout, drawnDepths, 10) / plan.whiteRef, 2e-4, 'the light worked out from the particles drawn');
    t.ok(state.readings.find(item => item.label === 'Light back').value === `${f0(100 * now.light)}% of white`, 'the light as a reading');

    // The cell’s walls, fill and electrodes.
    t.near(T.frontElectrode.position.y, M.CELLVIEW.electrode / 2 * M.CELL, 1e-12, 'the front electrode above the ink');
    t.near(T.backElectrode.position.y, -(gap + M.CELLVIEW.electrode / 2) * M.CELL, 1e-12, `the back electrode ${gap} μm below it`);
    t.near(T.frontElectrode.scale.x, 2 * H * M.CELL, 1e-12, 'the electrodes past the slice');
    t.ok(T.dye.visible === (plan.ink === 0) && T.binder.visible === (plan.ink === 1) && T.capsuleFill.visible === (plan.ink === 1) && T.capsuleWall.visible === (plan.ink === 1), 'dyed oil between plates, or a clear capsule in binder');
    if (plan.ink === 1) t.ok(pointsOf(T.capsuleWall).every(([x, y]) => Math.abs(Math.hypot(x, y + gap / 2 * M.CELL) - gap / 2 * M.CELL) < 1e-6), `a capsule ${gap} μm across`);
    t.near(T.dye.scale.y, gap * M.CELL, 1e-12, 'the ink as tall as the gap');

    // The field and the electrodes’ signs, only while driving.
    const driving = time > 0 && time < plan.pulse && plan.voltage > 0, pointing = new THREE.Vector3(0, 1, 0).applyQuaternion(T.arrow.quaternion);
    t.ok(T.arrow.visible === driving && [...T.plus, T.minus].every(glyph => glyph.visible === driving), driving ? 'the field drawn while the drive is on' : 'no field drawn with the drive off or before Play');
    if (driving) {
      t.near(T.arrow.userData.length, 0.8 * gap * M.CELL, 1e-12, 'the arrow across most of the gap');
      t.near(pointing.y, plan.target === 0 ? -1 : 1, 1e-9, plan.target === 0 ? 'writing white, the field points from the positive front to the back' : 'writing black, it points to the front');
      t.near(T.plus[0].position.y, (plan.target === 0 ? M.CELLVIEW.electrode / 2 : -gap - M.CELLVIEW.electrode / 2) * M.CELL, 1e-12, 'the plus sign on the positive electrode');
      t.ok(T.plus[0].scale.x > T.plus[0].scale.y && T.plus[1].scale.y > T.plus[1].scale.x && T.minus.scale.x > T.minus.scale.y, 'a plus of two bars and a minus of one');
    }

    // The pixels, their shades and the capsules over them.
    const pitch = plan.pitch, s = pitch * M.PIXEL;
    T.squares.forEach((square, k) => {
      const row = Math.floor(k / 3), col = k % 3, share = M.PIXELS.pattern[k] < 0 ? now.light : M.PIXELS.pattern[k];
      t.ok(Math.abs(square.scale.x - s) < 1e-12 && Math.abs(square.scale.y - s) < 1e-12 && Math.abs(square.position.x - (col - 1) * s) < 1e-12 && Math.abs(square.position.y - (1 - row) * s) < 1e-12, `pixel ${k} ${f1(pitch)} μm across, 200 times larger`);
      t.ok(sameColor(square.material.color, shadeOf(share)), k === 4 ? 'the middle pixel as bright as its light' : 'a neighbor holding its shade');
    });
    const segments = pointsOf(T.capsuleLines);
    if (plan.ink === 1) {
      const circles = M.capsuleCircles(pitch, gap);
      t.ok(segments.length === circles.length * 2 * M.PIXELS.segments && circles.length > 0, `${circles.length} capsules over nine pixels`);
      circles.forEach(([cx, cy], c) => {
        t.ok(Math.abs(cx) + gap / 2 <= 1.5 * pitch + 1e-9 && Math.abs(cy) + gap / 2 <= 1.5 * pitch + 1e-9, 'each capsule inside the nine pixels');
        for (let k = 0; k < 2 * M.PIXELS.segments; k++) { const [x, y] = segments[c * 2 * M.PIXELS.segments + k]; t.ok(Math.abs(Math.hypot(x / M.PIXEL - cx, y / M.PIXEL - cy) - gap / 2) < 1e-4, 'on its circle'); counts.points++; }
      });
      if (circles.length < 400) for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) t.ok(Math.hypot(circles[i][0] - circles[j][0], circles[i][1] - circles[j][1]) >= gap - 1e-9, 'capsules touching, not overlapping');
      t.near(state.capsulesAcross, pitch / gap, 1e-12, 'capsules across a pixel');
    } else t.ok(segments.length === 0 && !T.capsuleLines.visible, 'no capsules between plates');

    // The light chart.
    const guide = pointsOf(T.lightGuide);
    t.ok(guide.length === P.INK.samples, 'the whole write drawn faintly');
    for (let j = 0; j < guide.length; j += 15) {
      const sample = plan.chart[j], sampleTime = plan.duration * j / (P.INK.samples - 1), sampleDepths = depthsOf(plan, sampleTime);
      t.near(sample.t, sampleTime, 1e-15, 'chart samples evenly through the write');
      t.near(sample.light, lightByColumns(layout, sampleDepths, 10) / plan.whiteRef, 1e-12, 'a chart sample’s light, column by column');
      const whites = layout.particles.map((particle, i) => [particle, i]).filter(([particle]) => particle.species === 0);
      t.near(sample.progress, whites.reduce((sum, [particle, i]) => sum + Math.abs(sampleDepths[i] - ((particle.species === 0) === (plan.target === 0) ? particle.back : particle.front)) / (particle.back - particle.front), 0) / whites.length, 1e-12, 'and how far the white particles have gone');
      t.near(guide[j][0], M.CHART.x + sampleTime / plan.duration * M.CHART.w, 1e-6, 'across in time');
      t.near(guide[j][1], M.CHART.y + sample.light * M.CHART.top * M.CHART.h, 1e-6, 'up in light');
      counts.points++;
    }
    const curve = pointsOf(T.lightCurve), progress = pointsOf(T.progressCurve);
    if (time > 0) {
      const shown = plan.chart.filter(sample => sample.t < now.t);
      t.ok(curve.length === shown.length + 1 && progress.length === shown.length + 1, 'the dark curve as far as the clock');
      t.near(curve.at(-1)[0], M.CHART.x + now.t / plan.duration * M.CHART.w, 1e-6, 'ending at now');
      t.near(curve.at(-1)[1], M.CHART.y + now.light * M.CHART.top * M.CHART.h, 1e-6, 'at the light now');
      t.near(progress.at(-1)[1], M.CHART.y + now.progress * M.CHART.top * M.CHART.h, 1e-6, 'and the particles’ progress now');
    } else t.ok(!T.lightCurve.visible && !T.progressCurve.visible, 'nothing written before Play');
    t.ok(T.pulseBar.visible === plan.pulse > 0, 'a pulse bar when there is a pulse');
    if (plan.pulse > 0) t.near(T.pulseBar.scale.x, plan.pulse / plan.duration * M.CHART.w, 1e-6, 'the gold bar as long as the pulse');
    let ticks = 0;
    for (let k = 1; k * M.CHART.tickEvery < plan.duration - 1e-9; k++) ticks++;
    t.ok(pointsOf(T.lightTicks).length === 2 * ticks, `a tick every 50 ms: ${ticks}`);
    const cursor = pointsOf(T.lightCursor);
    t.near((cursor[0][0] + cursor[1][0]) / 2, M.CHART.x + now.t / plan.duration * M.CHART.w, 1e-6, 'the cursor at now');
    t.near(cursor[0][1], M.CHART.y + now.light * M.CHART.top * M.CHART.h, 1e-6, 'at the light now');

    // The electrowetting pixel.
    const wet = P.wettingOf(plan.values.wetting), least = leastEnergy(plan.values.wetting), fan = T.oil.geometry.attributes.position.array, outline = pointsOf(T.oilOutline).map(([x, y]) => [x / M.WET, y / M.WET]);
    t.ok(fan[0] === 0 && fan[1] === 0 && outline.length === M.WETVIEW.fan, 'the oil fanned from the middle of its base');
    outline.forEach(([x, y], j) => t.ok(Math.abs(fan[3 * (j + 1)] / M.WET - x) < 1e-3 && Math.abs(fan[3 * (j + 1) + 1] / M.WET - y) < 1e-3, 'the fill follows the outline'));
    const triangles = T.oil.geometry.index.array;
    let facing = 0;
    for (let k = 0; k < triangles.length; k += 3) {
      const [a, b, c] = [triangles[k], triangles[k + 1], triangles[k + 2]].map(v => [fan[3 * v], fan[3 * v + 1]]), cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cross) > 1e-12) { t.ok(cross > 0, 'every oil triangle winds to face the viewer'); facing++; }
    }
    t.ok(facing > 0, 'the oil drawn filled');
    let area = 0;
    for (let j = 0; j < outline.length; j++) { const [x0, y0] = outline[j], [x1, y1] = outline[(j + 1) % outline.length]; area += x0 * y1 - x1 * y0; }
    area = Math.abs(area) / 2;
    if (wet.film) {
      t.ok(Math.abs(outline[0][0] + PIXEL / 2) < 1e-3 && Math.abs(outline.at(-1)[0] - PIXEL / 2) < 1e-3 && outline.slice(1, -1).every(([, y]) => Math.abs(y - 5) < 1e-3), 'a film 5 μm thick over the pixel');
      t.near(area, 5 * PIXEL, 1e-2, 'its cross section 750 μm²');
      t.ok(!T.tangent.visible, 'no contact angle to show on a film');
    } else {
      const rho = least.base / Math.sin(least.alpha);
      t.ok(outline.every(([x, y]) => Math.abs(Math.hypot(x, y + rho * Math.cos(least.alpha)) - rho) < 2e-3), 'a round drop, on the circle the least energy gives');
      t.ok(outline.every(([x, y], j) => { const psi = -least.alpha + 2 * least.alpha * j / (outline.length - 1); return Math.abs(x - rho * Math.sin(psi)) < 2e-3 && Math.abs(y - rho * (Math.cos(psi) - Math.cos(least.alpha))) < 2e-3; }) && Math.abs(outline[0][0] + least.base) < 2e-3 && Math.abs(outline.at(-1)[0] - least.base) < 2e-3 && Math.abs(rho * (1 - Math.cos(least.alpha)) - least.h) < 1e-6, 'its base, its height and every point at its angle');
      t.near(area, rho * rho * (least.alpha - Math.sin(least.alpha) * Math.cos(least.alpha)), 5e-3 * area, 'its cross section, a circular segment');
      const [[x0, y0], [x1, y1]] = pointsOf(T.tangent).map(([x, y]) => [x / M.WET, y / M.WET]);
      t.near(Math.atan2(y1 - y0, x0 - x1), least.alpha, 1e-5, 'the line at its edge at the oil’s contact angle');
    }
    const wetCursor = pointsOf(T.wetCursor);
    t.near((wetCursor[0][0] + wetCursor[1][0]) / 2, M.WETCHART.x + plan.values.wetting / 70 * M.WETCHART.w, 1e-6, 'the electrowetting cursor at its voltage');
    t.near(wetCursor[0][1], M.WETCHART.y + wet.coverage * M.WETCHART.top * M.WETCHART.h, 1e-6, 'at the share under oil');
  }
}
{
  // The reader at true size, and the chart of oil against voltage.
  model.reset();
  T.body.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  T.body.geometry.boundingBox.getSize(size);
  t.ok(Math.abs(size.x - 1.16) < 1e-6 && Math.abs(size.y - 1.58) < 1e-6 && Math.abs(size.z - 0.085) < 1e-6, 'a body 116 by 158 by 8.5 mm, at true size');
  t.ok(Math.abs(T.screen.scale.x - 0.9144) < 1e-12 && Math.abs(T.screen.scale.y - 1.2192) < 1e-12 && Math.abs(Math.hypot(91.44, 121.92) - 6 * 25.4) < 1e-9, 'a screen 91.44 by 121.92 mm, 6 inches across its diagonal');
  const bars = T.text.geometry.attributes.position.array;
  for (let i = 0; i < bars.length; i += 3) t.ok(Math.abs(bars[i]) <= 0.4572 && bars[i + 1] >= -0.6096 + 0.05 && bars[i + 1] <= 0.6096 + 0.05, 'text on the screen');
  t.ok(pointsOf(T.marker).every(([x, y]) => Math.abs(Math.hypot(x - 0.18, y - 0.17) - 0.04) < 1e-6), 'a ring 4 mm across the pixels’ place');
  const film = pointsOf(T.filmCurve), drop = pointsOf(T.dropCurve), threshold = P.wettingThreshold(), toX = volts => M.WETCHART.x + volts / 70 * M.WETCHART.w, toY = share => M.WETCHART.y + share * M.WETCHART.top * M.WETCHART.h;
  t.ok(film.length === 2 && Math.abs(film[0][0] - toX(0)) < 1e-6 && Math.abs(film[1][0] - toX(threshold)) < 1e-6 && film.every(([, y]) => Math.abs(y - toY(1)) < 1e-6), 'a film over the whole pixel up to the threshold');
  t.ok(Math.abs(drop[0][0] - toX(threshold)) < 1e-6 && Math.abs(drop[0][1] - toY(Math.PI / 4)) < 1e-6 && Math.abs(drop.at(-1)[0] - toX(60)) < 1e-6, 'a drop from a quarter of π at the threshold to 60 V');
  drop.forEach(([x, y], i) => { const volts = threshold + (60 - threshold) * i / (drop.length - 1); t.ok(Math.abs(x - toX(volts)) < 1e-6 && Math.abs(y - toY(P.wettingOf(volts).coverage)) < 1e-6 && (i === 0 || y <= drop[i - 1][1] + 1e-9), 'the drop shrinking as the voltage rises'); counts.points++; });
  t.ok(pointsOf(T.breakdown).every(([x]) => Math.abs(x - toX(SRC.ptfe.strength * 1)) < 1e-6), 'the breakdown line at 60 V');
}
{
  // Changing only the gap redraws the capsules over the pixels, with no reset between.
  model.reset();
  model.update({ink: 1, screen: 2, gap: 40});
  model.update({gap: 100});
  const circles = M.capsuleCircles(P.pitchOf(P.SCREENS[2]), 100), segments = pointsOf(T.capsuleLines);
  t.ok(segments.length === circles.length * 2 * M.PIXELS.segments && segments.every(([x, y], k) => { const [cx, cy] = circles[Math.floor(k / (2 * M.PIXELS.segments))]; return Math.abs(Math.hypot(x / M.PIXEL - cx, y / M.PIXEL - cy) - 50) < 1e-4; }), 'capsules of 100 μm drawn after only the gap changed');
}
{
  // No part of the bench runs into another, whatever the ink, the gap and the screen.
  const toSystem = new THREE.Matrix4(), local = new THREE.Box3(), matrix = new THREE.Matrix4();
  const boxOf = object => {
    const box = new THREE.Box3();
    object.traverse(child => {
      for (let node = child; node; node = node.parent) if (!node.visible) return;
      if (!child.geometry) return;
      child.geometry.computeBoundingBox();
      const count = child.isInstancedMesh ? child.count : 1;
      for (let i = 0; i < count; i++) {
        local.copy(child.geometry.boundingBox);
        if (child.isInstancedMesh) { child.getMatrixAt(i, matrix); local.applyMatrix4(matrix); }
        box.union(local.applyMatrix4(child.matrixWorld).applyMatrix4(toSystem));
      }
    });
    return box;
  };
  for (const ink of [0, 1]) for (const gap of [10, 40, 100]) for (const screen of [0, 1, 2]) {
    model.reset();
    model.update({ink, gap, screen, pulse: 200});
    model.advance(5);
    model.root.updateMatrixWorld(true);
    toSystem.copy(T.system.matrixWorld).invert();
    const boxes = ['reader', 'pixel', 'cell', 'light', 'wetting'].map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
    t.ok(T.arrow.visible && boxes.every(([, box]) => !box.isEmpty()), 'every part drawn, with the field showing');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, A] = boxes[i], [b, B] = boxes[j];
      t.ok(A.max.x + 0.05 <= B.min.x || B.max.x + 0.05 <= A.min.x || A.max.y + 0.05 <= B.min.y || B.max.y + 0.05 <= A.min.y, `the ${a} and the ${b} clear of each other with ink ${ink}, a ${gap} μm gap and screen ${screen}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const lightAt = (s, time) => P.paperAt(P.paperPlan(s.values), time).light;
const frontmostBack = s => s.gap - R * (1 + 2 * (P.INK.layers - 1)) - R;
checkTrialNumbers(L.electronicPaperLesson, {
  'Write a white pixel': s => ({375: s.field / 1000, 39: s.travel, 697: s.speed, 50: 1000 * s.middle, 56: 1000 * s.crossing, 70: 1000 * s.lastArrival, 5: 100 * s.blackLevel, 100: 100 * s.now.light}),
  'The drive turns off': s => { t.ok(lightAt(s, s.pulse) === s.now.light, 'the light held from the pulse’s end'); return {80: 1000 * s.pulse, 50: 1000 * s.hold, 100: 100 * s.now.light}; },
  'Halve the gap': s => { t.ok(Math.round(P.paperPlan({}).crossing / s.crossing) === 4, 'about four times faster'); return {15: s.voltage, 14: 1000 * s.crossing, 17: frontmostBack(s), 26: 100 * s.blackLevel}; },
  'A weaker drive': s => ({168: 1000 * s.crossing, 80: 1000 * s.pulse, 50: 100 * s.now.progress, 25: 100 * s.now.light}),
  'A shorter pulse': s => { t.ok(s.now.arrived === 0, 'no particle arrives in 30 ms'); return {57: 100 * s.now.progress, 31: 100 * s.now.light, 16: P.PAGES.shades}; },
  'Write black': s => ({37: frontmostBack(s), 100: 100 * lightAt(s, 0), 5: 100 * s.now.light}),
  'Black and white in a capsule': s => ({36: 100 * lightAt(s, 0.02), 20: 20, 99: 100 * lightAt(s, 0.03), 30: 30, 50: 1000 * s.middle, 56: 1000 * s.crossing}),
}, run, t);
checkTrialNumbers(L.electronicInkLesson, {
  'Write white': s => ({28: 1000 * s.crossing / 2, 99: 100 * lightAt(s, 0.03), 30: 30}),
  'Write black': s => { t.ok(lightAt(s, 0.03) < 0.005, 'none by 30 ms'); return {65: 100 * lightAt(s, 0.02), 20: 20, 30: 30}; },
  'A shorter pulse': s => ({20: 1000 * s.pulse, 51: 100 * s.now.progress, 36: 100 * s.now.light}),
  'A smaller capsule': s => ({20: s.gap, 15: s.voltage, 750: s.field / 1000, 14: 1000 * s.crossing}),
  'Capsules over pixels': s => ({'84.7': s.pitch, '2.1': s.capsulesAcross, 40: s.gap}),
  'A capsule 100 μm across': s => { t.ok(lightAt(s, s.pulse) > 0.995, 'white within the pulse'); return {50: 1000 * s.middle, 355: 1000 * s.crossing, 200: 1000 * s.pulse, 73: 100 * s.now.progress}; },
}, run, t);
checkTrialNumbers(L.electrowettingLesson, {
  'Pull the oil aside': s => ({40: s.values.wetting, '133.4': deg(s.wet.theta), '46.6': deg(s.wet.alpha), 108: 2 * s.wet.base, 41: 100 * s.wet.coverage, 59: 100 - 100 * s.wet.coverage}),
  'No voltage': s => { t.ok(s.wet.film, 'a film with no voltage'); return {170: deg(s.wet.theta), 5: P.WETTING.film}; },
  'Just below the threshold': s => { t.ok(s.wet.film, 'still a film at 14 V'); return {14: s.values.wetting, 152: 2 * s.wet.base, 150: P.WETTING.pixel}; },
  'Just past it': s => ({15: s.values.wetting, 149: 2 * s.wet.base, 78: 100 * s.wet.coverage, '14.6': s.threshold}),
  'Full drive': s => { t.ok(s.wet.field / 1e6 === s.values.wetting, '50 V over 1 μm is 50 MV/m'); return {50: s.values.wetting, 97: 2 * s.wet.base, 33: 100 * s.wet.coverage, 60: P.PTFE.strength / 1e6}; },
}, run, t);
checkTrialNumbers(L.eReaderLesson, {
  'A Carta screen': s => ({768: s.screen.width, '1,024': s.screen.height, 212: s.screen.ppi, '119.8': s.pitch, '3.0': s.capsulesAcross, 40: s.gap, '1,280': Math.hypot(s.screen.width, s.screen.height), 6: s.screen.diagonal, 213: s.diagonal}),
  'A basic Kindle': s => ({15: P.PAGES.kindleUntil - SRC.kindle.first[0], 600: s.screen.width, 800: s.screen.height, 167: s.screen.ppi, '152.1': s.pitch, '3.8': s.capsulesAcross, '1,000': Math.hypot(s.screen.width, s.screen.height), 6: s.screen.diagonal, '166.7': s.diagonal}),
  'A Carta HD screen': s => { t.ok(s.diagonal === 300, 'exactly 300 ppi'); return {300: s.screen.ppi, '84.7': s.pitch, '2.1': s.capsulesAcross, '1,800': Math.hypot(s.screen.width, s.screen.height), 6: s.screen.diagonal}; },
  'A page in memory': s => ({'91.44': M.READER.screen[0], '121.92': M.READER.screen[1], 16: P.PAGES.shades, 4: Math.log2(P.PAGES.shades), '393,216': s.pageBytes, '777,600': P.paperPlan({screen: 2}).pageBytes}),
  'Write a pixel': s => { t.ok(lightAt(s, 0.03) > 0.98, 'white within 30 ms'); return {15: s.voltage, 40: s.gap, 30: 30, 50: 1000 * s.middle, 56: 1000 * s.crossing, 120: P.PAGES.update}; },
  'Leave the page': s => { t.ok(s.now.done && !s.now.driving && s.now.light === lightAt(s, s.pulse), 'the page held with no drive'); return {}; },
}, run, t);

// Free text: each snippet computed, and every number in the text inside a checked snippet.
const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
}
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
const expectNone = (lesson, name, except = []) => { for (const [where, text] of texts(lesson)) if (!except.includes(where)) covered(text, {}, `${name} ${where}`); };
const def = P.paperPlan({}), capsule = P.paperPlan({ink: 1}), wet40 = P.wettingOf(40), wet50 = P.wettingOf(50);
const paperSnippets = {
  [`a drive of ${P.PAPER_DOMAINS.voltage[0]} to ${P.PAPER_DOMAINS.voltage[1]} V`]: 'a drive of 0 to 30 V',
  [`the ${SRC.zeta[0]} to ${SRC.zeta[1]} mV of a stable colloid`]: 'the 40 to 60 mV of a stable colloid',
  [`a factor e every ${f0(1 / P.INK.dye)} μm`]: 'a factor e every 25 μm',
  [`pack ${P.INK.layers} deep at a wall`]: 'pack 3 deep at a wall',
};
const wettingSnippets = {
  [`a pixel ${P.WETTING.pixel} μm wide holding an oil film ${P.WETTING.film} μm thick on ${P.WETTING.thickness} μm of fluoropolymer`]: 'a pixel 150 μm wide holding an oil film 5 μm thick on 1 μm of fluoropolymer',
  [`an oil and water tension of ${f0(P.WETTING.tension * 1000)} mN/m, and a contact angle of ${P.WETTING.angle}°`]: 'an oil and water tension of 50 mN/m, and a contact angle of 170°',
};
covered(L.paperLimits, paperSnippets, 'ink limits');
covered(L.wettingLimits, wettingSnippets, 'electrowetting limits');

// Electronic paper.
expectNone(L.electronicPaperLesson, 'Electronic paper', ['overview']);
covered(L.electronicPaperLesson.overview, {[`about ${f0(P.TITANIA.diameter)} μm across`]: 'about 1 μm across'}, 'Electronic paper overview');
covered(L.electronicPaperLesson.deeper[0].body, {
  'Hückel’s mobility is 2εrε0ζ/(3η)': 'Hückel’s mobility is 2εrε0ζ/(3η)',
  [`a relative permittivity of ${P.OIL.permittivity} and a viscosity of ${f1(P.OIL.viscosity * 1000)} mPa·s`]: 'a relative permittivity of 1.89 and a viscosity of 0.3 mPa·s',
  [`a particle at ${f0(def.middle * 1000)} mV has a mobility of ${f2(def.mobility * 1e9)} × 10⁻⁹ m²/(V·s), so ${def.voltage} V across ${def.gap} μm moves it at ${f0(def.speed)} μm/s`]: 'a particle at 50 mV has a mobility of 1.86 × 10⁻⁹ m²/(V·s), so 15 V across 40 μm moves it at 697 μm/s',
}, 'Electronic paper deeper 1');
covered(L.electronicPaperLesson.deeper[1].body, {
  'a charge of 4πεrε0Rζ': 'a charge of 4πεrε0Rζ', 'Stokes’s drag, 6πηRv': 'Stokes’s drag, 6πηRv',
  [`a titania particle ${f0(P.TITANIA.diameter)} μm across at ${f0(def.middle * 1000)} mV that charge is ${f2(def.charge * 1e18)} × 10⁻¹⁸ C, about ${f0(def.electrons)} electron charges`]: 'a titania particle 1 μm across at 50 mV that charge is 5.26 × 10⁻¹⁸ C, about 33 electron charges',
}, 'Electronic paper deeper 2');
covered(L.electronicPaperLesson.deeper[2].body, {
  [`At ${f0(def.speed)} μm/s a particle ${f0(P.TITANIA.diameter)} μm across in n-hexane has a Reynolds number of ${fixed(def.reynolds, 4)}`]: 'At 697 μm/s a particle 1 μm across in n-hexane has a Reynolds number of 0.0015',
  [`density of ${f2(P.TITANIA.density / 1000)} g/cm³`]: 'density of 4.23 g/cm³',
  [`full speed in ${f2(def.relaxation * 1e6)} μs, having gone ${f2(def.lag)} nm`]: 'full speed in 0.78 μs, having gone 0.55 nm',
}, 'Electronic paper deeper 3');
covered(L.electronicPaperLesson.deeper[3].body, {
  [`Titania of ${f2(P.TITANIA.density / 1000)} g/cm³ in n-hexane of ${fixed(P.OIL.density / 1000, 4)} g/mL would sink at ${f2(def.settling)} μm/s, across ${f0(def.travel)} μm in ${f1(def.settleCross)} s`]: 'Titania of 4.23 g/cm³ in n-hexane of 0.6606 g/mL would sink at 6.48 μm/s, across 39 μm in 6.0 s',
  [`pulls ${f0(def.forceRatio)} times harder`]: 'pulls 108 times harder',
}, 'Electronic paper deeper 4');
{
  const [ten, hundred] = [10, 100].map(gap => P.paperPlan({gap}));
  covered(L.electronicPaperLesson.deeper[4].body, {
    [`${f1(ten.crossing * 1000)} ms at ${ten.gap} μm and ${f0(hundred.crossing * 1000)} ms at ${hundred.gap} μm`]: '3.2 ms at 10 μm and 355 ms at 100 μm',
    [`a ${ten.gap} μm gap still send back ${f0(100 * ten.blackLevel)}%`]: 'a 10 μm gap still send back 57%',
    [`at ${hundred.gap} μm only ${f2(100 * hundred.blackLevel)}%`]: 'at 100 μm only 0.04%',
  }, 'Electronic paper deeper 5');
}
covered(L.electronicPaperLesson.deeper[5].body, {
  [`${P.INK.slow} times slower`]: '100 times slower',
  [`the write of ${f0(def.duration * 1000)} ms, an ${f0(def.pulse * 1000)} ms pulse and ${f0(def.hold * 1000)} ms with the drive off, takes ${f0(def.duration * P.INK.slow)} s`]: 'the write of 130 ms, an 80 ms pulse and 50 ms with the drive off, takes 13 s',
  [`as short as ${P.PAGES.update} ms`]: 'as short as 120 ms',
}, 'Electronic paper deeper 6');
covered(L.electronicPaperLimits, {
  [`its pixels ${f0(M.timesLarger(M.PIXEL))} times larger, the ink ${f0(M.timesLarger(M.CELL))} times larger and the electrowetting pixel ${f0(M.timesLarger(M.WET))} times larger`]: 'its pixels 200 times larger, the ink 2,000 times larger and the electrowetting pixel 500 times larger',
  [`${P.INK.slow} times slower`]: '100 times slower', ...paperSnippets, ...wettingSnippets,
}, 'Electronic paper limits');
covered(L.electronicPaperLesson.quiz.explanation, {[`At ${def.voltage} V a ${f0(P.paperPlan({pulse: 30}).pulse * 1000)} ms pulse leaves the white particles ${f0(100 * P.paperAt(P.paperPlan({pulse: 30}), 1).progress)}% of the way across, and the pixel holds ${f0(100 * P.paperAt(P.paperPlan({pulse: 30}), 1).light)}%`]: 'At 15 V a 30 ms pulse leaves the white particles 57% of the way across, and the pixel holds 31%'}, 'Electronic paper quiz');

// Electronic ink.
expectNone(L.electronicInkLesson, 'Electronic ink');
covered(L.electronicInkLesson.quiz.explanation, {}, 'Electronic ink quiz');
covered(L.electronicInkLesson.deeper[0].body, {}, 'Electronic ink deeper 1');
covered(L.electronicInkLesson.deeper[1].body, {
  [`as ${f2(P.PAGES.capsule / 1000)} mm across`]: 'as 0.04 mm across', [`about ${P.PAGES.capsule} μm, laminated to ${P.PAGES.laminate} μm thick`]: 'about 40 μm, laminated to 80 μm thick', [`cups ${f2(P.PAGES.microcup / 1000)} mm across`]: 'cups 0.15 mm across',
}, 'Electronic ink deeper 2');
covered(L.electronicInkLesson.deeper[2].body, {[`at ${capsule.voltage} V across ${capsule.gap} μm the middle ones meet at ${f0(capsule.crossing * 1000 / 2)} ms`]: 'at 15 V across 40 μm the middle ones meet at 28 ms'}, 'Electronic ink deeper 3');
covered(L.electronicInkLesson.deeper[3].body, {[`Packed ${P.INK.layers} deep at the wall in the same way, a whole capsule ${capsule.gap} μm across would hold about ${f0(Math.round(capsule.capsuleCount / 100) * 100)} particles`]: 'Packed 3 deep at the wall in the same way, a whole capsule 40 μm across would hold about 6,500 particles'}, 'Electronic ink deeper 4');
covered(L.electronicInkLesson.deeper[4].body, {
  [`in ${SRC.kindle.first[0]}, showed ${SRC.kindle.first[1]} levels of gray, and Kindles from ${SRC.kindle.later[0]} showed ${SRC.kindle.later[1]}`]: 'in 2007, showed 4 levels of gray, and Kindles from 2009 showed 16',
  [`take ${Math.log2(P.PAGES.shades)} bits a pixel`]: 'take 4 bits a pixel',
}, 'Electronic ink deeper 5');
covered(L.electronicInkLesson.deeper[5].body, {[`as short as ${P.PAGES.update} ms`]: 'as short as 120 ms'}, 'Electronic ink deeper 6');
covered(L.electronicInkLesson.limits, {[`cut open ${f0(M.timesLarger(M.CELL))} times larger`]: 'cut open 2,000 times larger', [`${P.INK.slow} times slower`]: '100 times slower', ...paperSnippets}, 'Electronic ink limits');

// Electrowetting display.
expectNone(L.electrowettingLesson, 'Electrowetting display');
covered(L.electrowettingLesson.deeper[0].body, {
  'cos θ = (γs − γws⁰ + CV²/2)/γw': 'cos θ = (γs − γws⁰ + CV²/2)/γw', 'energy CV²/2': 'energy CV²/2',
  [`Over ${P.WETTING.thickness} μm with PTFE’s dielectric constant of ${f1(P.PTFE.permittivity)}, C is ${f1(wet40.capacitance * 1e6)} μF/m², so at 40 V the stored energy is ${f1(wet40.capacitance * 40 ** 2 / 2 * 1000)} mJ/m²`]: 'Over 1 μm with PTFE’s dielectric constant of 2.1, C is 18.6 μF/m², so at 40 V the stored energy is 14.9 mJ/m²',
  [`tension of ${f0(P.WETTING.tension * 1000)} mN/m it raises cos θ by ${f3(wet40.capacitance * 40 ** 2 / 2 / P.WETTING.tension)}, from −${f3(-Math.cos(P.WETTING.angle * Math.PI / 180))} to −${f3(-wet40.cosTheta)}`]: 'tension of 50 mN/m it raises cos θ by 0.298, from −0.985 to −0.687',
}, 'Electrowetting deeper 1');
covered(L.electrowettingLesson.deeper[1].body, {
  [`add to ${f0(deg(wet40.alpha + wet40.theta))}°`]: 'add to 180°',
  [`at ${P.WETTING.angle}°, so the oil spreads at ${f0(deg(P.wettingOf(0).alpha))}°; at 40 V the oil stands at ${f1(deg(wet40.alpha))}°`]: 'at 170°, so the oil spreads at 10°; at 40 V the oil stands at 46.6°',
}, 'Electrowetting deeper 2');
covered(L.electrowettingLesson.deeper[2].body, {
  [`a film ${P.WETTING.film} μm thick over a ${P.WETTING.pixel} μm pixel is ${f0(P.WETTING.film * P.WETTING.pixel ** 2)} μm³`]: 'a film 5 μm thick over a 150 μm pixel is 112,500 μm³',
  'h = a·tan(α/2)': 'h = a·tan(α/2)', 'πh(3a² + h²)/6': 'πh(3a² + h²)/6',
  [`At 40 V it is ${f0(2 * wet40.base)} μm across and ${f1(wet40.height)} μm high`]: 'At 40 V it is 108 μm across and 23.2 μm high',
}, 'Electrowetting deeper 3');
covered(L.electrowettingLesson.deeper[3].body, {
  [`${f0(wet40.field / 1e6)} MV/m at 40 V over ${P.WETTING.thickness} μm`]: '40 MV/m at 40 V over 1 μm',
  [`breaks down at ${f0(P.PTFE.strength / 1e6)} MV/m, which ${P.WETTING.thickness} μm reaches at ${f0(P.PTFE.strength * P.WETTING.thickness * 1e-6)} V`]: 'breaks down at 60 MV/m, which 1 μm reaches at 60 V',
  [`a coating ${P.WETTING.thickness} μm thick can raise cos θ by at most ${f2(P.PTFE.permittivity * P.EPSILON_0 * P.PTFE.strength ** 2 * P.WETTING.thickness * 1e-6 / (2 * P.WETTING.tension))}`]: 'a coating 1 μm thick can raise cos θ by at most 0.67',
}, 'Electrowetting deeper 4');
covered(L.electrowettingLesson.deeper[4].body, {[`under ${P.PAGES.reservoir[0]} to ${P.PAGES.reservoir[1]}% of the pixel, could reflect over ${P.PAGES.white}%`]: 'under 5 to 10% of the pixel, could reflect over 85%', [`less than ${P.PAGES.layer} μm thick`]: 'less than 15 μm thick'}, 'Electrowetting deeper 5');
covered(L.electrowettingLesson.limits, {[`drawn ${f0(M.timesLarger(M.WET))} times larger`]: 'drawn 500 times larger', ...wettingSnippets}, 'Electrowetting limits');
covered(L.electrowettingLesson.quiz.explanation, {[`At 40 V the stored energy raises cos θ by ${f3(wet40.capacitance * 40 ** 2 / 2 / P.WETTING.tension)}, the water meets the coating at ${f1(deg(wet40.theta))}° instead of ${P.WETTING.angle}°, and the oil gathers to cover ${f0(100 * wet40.coverage)}%`]: 'At 40 V the stored energy raises cos θ by 0.298, the water meets the coating at 133.4° instead of 170°, and the oil gathers to cover 41%'}, 'Electrowetting quiz');
t.ok(f0(2 * wet50.base) === '97', 'the full drive’s drop, quoted in its trial');

// E-reader.
expectNone(L.eReaderLesson, 'E-reader', ['part 1']);
covered(L.eReaderLesson.parts[0].role, {[`${SRC.inches} inches across its diagonal`]: '6 inches across its diagonal'}, 'E-reader part 1');
covered(L.eReaderLesson.quiz.explanation, {[`white at ${def.voltage} V`]: 'white at 15 V'}, 'E-reader quiz');
covered(L.eReaderLesson.deeper[0].body, {[`September ${SRC.kindle.paperwhite}`]: 'September 2012'}, 'E-reader deeper 1');
{
  const carta = P.paperPlan({ink: 1}), hd = P.paperPlan({ink: 1, screen: 2}), kindle = P.paperPlan({ink: 1, screen: 0});
  covered(L.eReaderLesson.deeper[1].body, {
    [`25.4 mm over ${carta.screen.ppi} is ${f1(carta.pitch)} μm`]: '25.4 mm over 212 is 119.8 μm',
    [`its ${SRC.inches} inches`]: 'its 6 inches',
    [`the ${f0(Math.hypot(768, 1024))} pixels of Carta’s ${f0(carta.screen.width)} by ${f0(carta.screen.height)} give ${f1(carta.diagonal)} ppi, against the ${carta.screen.ppi} its page gives, and the ${f0(Math.hypot(1080, 1440))} of Carta HD give ${f1(hd.diagonal)}`]: 'the 1,280 pixels of Carta’s 768 by 1,024 give 213.3 ppi, against the 212 its page gives, and the 1,800 of Carta HD give 300.0',
  }, 'E-reader deeper 2');
  covered(L.eReaderLesson.deeper[2].body, {[`At ${carta.screen.ppi} ppi about ${f1(carta.capsulesAcross)} capsules of ${carta.gap} μm fit across a pixel and at ${hd.screen.ppi} ppi only ${f1(hd.capsulesAcross)}`]: 'At 212 ppi about 3.0 capsules of 40 μm fit across a pixel and at 300 ppi only 2.1'}, 'E-reader deeper 3');
  covered(L.eReaderLesson.deeper[3].body, {[`take ${Math.log2(P.PAGES.shades)} bits a pixel`]: 'take 4 bits a pixel', [`A Kindle page of ${kindle.screen.width} by ${kindle.screen.height} pixels is ${f0(kindle.pageBytes)} bytes, a Carta page ${f0(carta.pageBytes)} and a Carta HD page ${f0(hd.pageBytes)}`]: 'A Kindle page of 600 by 800 pixels is 240,000 bytes, a Carta page 393,216 and a Carta HD page 777,600'}, 'E-reader deeper 4');
}
covered(L.eReaderLesson.deeper[4].body, {}, 'E-reader deeper 5');
covered(L.eReaderLesson.limits, {[`its pixels ${f0(M.timesLarger(M.PIXEL))} times larger`]: 'its pixels 200 times larger', ...paperSnippets}, 'E-reader limits');

// The model’s own words: its scales and slowed clock, said where the reader sees them.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {[`nine of its pixels ${f0(M.timesLarger(M.PIXEL))} times larger, the ink under a pixel cut open ${f0(M.timesLarger(M.CELL))} times larger`]: 'nine of its pixels 200 times larger, the ink under a pixel cut open 2,000 times larger', [`cut open ${f0(M.timesLarger(M.WET))} times larger`]: 'cut open 500 times larger', [`${P.INK.slow} times slower`]: '100 times slower'}, 'system text');
covered(partText('reader'), {[`A ${SRC.inches} inch e-reader`]: 'A 6 inch e-reader', [`${f2(M.READER.screen[0])} mm by ${f2(M.READER.screen[1])} mm`]: '91.44 mm by 121.92 mm'}, 'reader text');
covered(partText('pixel'), {[`${f0(M.timesLarger(M.PIXEL))} times larger`]: '200 times larger'}, 'pixel text');
covered(partText('cell'), {[`drawn ${f0(M.timesLarger(M.CELL))} times larger`]: 'drawn 2,000 times larger', [`about ${f0(P.TITANIA.diameter)} μm across`]: 'about 1 μm across', [`packed ${P.INK.layers} deep`]: 'packed 3 deep', [`${P.INK.slow} times slower`]: '100 times slower'}, 'cell text');
covered(partText('light'), {[`every ${f0(M.CHART.tickEvery * 1000)} ms`]: 'every 50 ms'}, 'light text');
covered(partText('wetting'), {[`drawn ${f0(M.timesLarger(M.WET))} times larger`]: 'drawn 500 times larger', [`on ${P.WETTING.thickness} μm of fluoropolymer`]: 'on 1 μm of fluoropolymer', [`up to ${f0(P.PTFE.strength * P.WETTING.thickness * 1e-6)} V`]: 'up to 60 V'}, 'wetting text');
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Field,Crossing,Light back,Sinking,Screen,Electrowetting,Slowed', 'eight readings');
  t.ok(find('Field').value === '375 kV/m' && find('Crossing').value === '56 ms' && find('Light back').value === '5% of white' && find('Sinking').value === '6.48 μm/s' && find('Screen').value === '212 ppi' && find('Electrowetting').value === '41% under oil' && find('Slowed').value === '100 times', 'the readings carry the lessons’ figures');
  checkQuotedText(find('Screen').hint, {'drawn 200 times larger': 'drawn 200 times larger', '119.8 μm apart': `${f1(def.pitch)} μm apart`, '393,216 bytes': `${f0(def.pageBytes)} bytes`}, t);
  checkQuotedText(find('Slowed').hint, {'100 times slower': `${P.INK.slow} times slower`, 'takes 13 s': `takes ${f0(def.duration * P.INK.slow)} s`, 'cut open 2,000 times larger': `cut open ${f0(M.timesLarger(M.CELL))} times larger`}, t);
  checkQuotedText(find('Crossing').hint, {'55.9 ms: 69.9 ms at 40 mV and 46.6 ms at 60 mV': `${f1(def.crossing * 1000)} ms: ${f1(def.slowest * 1000)} ms at 40 mV and ${f1(def.fastest * 1000)} ms at 60 mV`, 'as short as 120 ms': `as short as ${P.PAGES.update} ms`}, t);
  checkQuotedText(find('Electrowetting').hint, {'Drawn 500 times larger': `Drawn ${f0(M.timesLarger(M.WET))} times larger`, 'a drop 108 μm across and 23.2 μm high': `a drop ${f0(2 * wet40.base)} μm across and ${f1(wet40.height)} μm high`, 'dielectric strength of 60 MV/m': `dielectric strength of ${f0(P.PTFE.strength / 1e6)} MV/m`}, t);
  checkQuotedText(find('Sinking').hint, {'6.48 μm/s, across the 39 μm in 6.0 s': `${f2(def.settling)} μm/s, across the ${f0(def.travel)} μm in ${f1(def.settleCross)} s`, '108 times harder': `${f0(def.forceRatio)} times harder`}, t);
  model.update({voltage: 0, ink: 1, wetting: 10});
  const off = model.getState().readings, offFind = label => off.find(item => item.label === label);
  t.ok(offFind('Crossing').value === 'never' && !offFind('Sinking').hint.includes('times harder') && offFind('Field').hint.startsWith('No voltage') && offFind('Electrowetting').value === 'a film over the pixel' && offFind('Light back').hint.includes('about 6,500 of each'), 'with no drive: never, no pull, a film, and a whole capsule’s particles');
}

for (const lesson of [L.electronicPaperLesson, L.electronicInkLesson, L.electrowettingLesson, L.eReaderLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(trial => model.parts.some(item => item.id === trial.part) && trial.view === 'front' && trial.reset === true), 'every trial on a part the model has');
}
t.ok(studyLessons['Electronic paper'] === L.electronicPaperLesson, 'the electronic paper’s lesson');
for (const [name, lesson, part, values] of [['Electronic ink', L.electronicInkLesson, 'cell', {ink: 1}], ['Electrowetting display', L.electrowettingLesson, 'wetting', undefined], ['E-reader', L.eReaderLesson, 'reader', {ink: 1}]]) {
  const component = houseComponents[name];
  t.ok(component.machine === 'Electronic paper' && component.part === part && component.lesson === lesson && component.intro === lesson.simple && component.view === 'front', `${name} routes to the electronic paper’s ${part} with its own lesson`);
  assert.deepEqual(component.values, values);
  if (values) t.ok(lesson.tryIt.every(trial => trial.values.ink === values.ink), `${name}: every trial with capsule ink`);
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [lo, hi, step] = P.PAPER_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.PAPER_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'ink,gap,voltage,pulse,target,screen,wetting', 'seven controls');
const drawing = () => [T.whites.count, T.blacks.count, Array.from(T.whites.instanceMatrix.array.slice(0, 64)), T.dye.visible, T.arrow.userData.length, T.squares[0].scale.x, pointsOf(T.capsuleLines).length, Array.from(T.oil.geometry.attributes.position.array.slice(0, 30)), pointsOf(T.lightGuide).slice(0, 12), T.pulseBar.scale.x, T.squares[4].material.color.getHex()];
checkControlsMove(model, drawing, m => m.advance(3), t);
checkRefusals(P.samplePaper, P.PAPER_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before writing');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.005, 1e-12, 'a step of half a second writes 5 ms');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through the write');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, 0.01, 1e-12, 'animation writes on by the time that passed, 100 times slower');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available(), 'the pixel written, with a result to inspect');
  const held = JSON.stringify([Array.from(T.whites.instanceMatrix.array), T.squares[4].material.color.getHex()]);
  model.animate(10);
  model.advance(50);
  t.ok(JSON.stringify([Array.from(T.whites.instanceMatrix.array), T.squares[4].material.color.getHex()]) === held, 'once written, the pixel holds with the drive off');
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0, `${action.label} returns readings`); checkFinite(model.root, t); }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  for (const values of settings) for (const time of [0, 1, 100]) { model.reset(); model.update(values); model.advance(time); t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers'); checkFinite(model.root, t); }
}
const released = checkDisposal((() => { const fresh = M.createElectronicPaperModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS electronic paper: ${t.count} checks, ${counts.particles} particles placed and read back, ${counts.columns} columns of light found again, ${counts.steps} steps of a crossing integrated with inertia, ${counts.energies} drop energies compared, ${counts.poses} poses, ${counts.points} chart and outline points, ${counts.numbers} quoted numbers traced, 4 lessons, ${released} resources released exactly once.`);

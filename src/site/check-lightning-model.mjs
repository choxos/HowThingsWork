// Checks the lightning conductor model and its lesson against the sources
// typed in again and the physics worked out by other routes: the standard's
// current function retyped and differentiated and integrated numerically, the
// grounded spheroid's potential rebuilt from a line charge along its axis
// instead of Legendre functions, the earth rod's resistance rebuilt from point
// sources in a half space, a down conductor's inductance rebuilt from the field
// of a long straight current, and every drawn equipotential, zone boundary,
// arc, curve and bar read back at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './lightning-physics.js';
import * as M from './lightning-model.js';
import * as L from './lightning-lesson.js';
import {houseComponents} from './house-components.js';
import {safetyLessons} from './safety-lessons.js';
import {createSafetyModel} from './safety-models.js';
import {previewEntryIds} from './published-catalog.js';

const t = tally();
const counts = {poses: 0, points: 0, potentials: 0, steps: 0, quadrature: 0, numbers: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const relative = (value, share = 1e-9) => Math.abs(value) * share + 1e-15;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  mu0: 1.25663706127e-6, atmosphere: 101325, copper: 1.68e-8, air: 3e6, wire: 200e-9,
  first: {k: 0.93, tau1: 19.0e-6, tau2: 485e-6, peak: [200e3, 150e3, 100e3], charge: [100, 75, 50], energy: [10e6, 5.6e6, 2.5e6], label: '10/350 μs'},
  subsequent: {k: 0.993, tau1: 0.454e-6, tau2: 143e-6, peak: [50e3, 37.5e3, 25e3], steepness: [200e9, 150e9, 100e9], label: '0.25/100 μs'},
  exponent: 10, steepest: 280e9, band: [0.3, 0.9], long: [200, 150, 100], flash: [300, 225, 150],
  ki: [0.08, 0.06, 0.04, 0.04], radius: [20, 30, 45, 60], minimum: [3e3, 5e3, 10e3, 16e3], above: [0.99, 0.97, 0.91, 0.84], below: [0.99, 0.98, 0.95, 0.95],
  rod: 9, shortest: 5, earth: 10, diameter: 8e-3, area: 50e-6, copperRise: 22, step: 1, coefficient: 10, power: 0.65, kc: 1, km: [1, 0.5],
  firstNegative: {peak: [100e3, 75e3, 50e3], label: '1/200 μs'}, example: {current: 100e3, resistance: 10, volts: 1000e3},
  inductance: 1e-6, rises: [20e9, 100e9], height: 10, ietVolts: [200e3, 1e6],
  detach: 67, onset: 6.79e6, starts: [3e3, 5e3], ions: 300, surface: [8e3, 12e3], inside: 10, falloff: {share: 0.01, radii: 50},
  tree: {current: 30e-9, height: 1.4, field: 6.4e3}, pulses: 50e3, figure: [[1250, 6e3, 2.30e6], [2000, 20e3, 11.44e6]],
  flashCurrent: 30e3, flashCharge: 15, positive: 0.05, rise: [1e-6, 10e-6], decay: [50e-6, 200e-6], fairWeather: 100, ratio: 680,
};

t.ok(P.MU_0 === SRC.mu0 && P.ATMOSPHERE === SRC.atmosphere && P.PAGES.copper === SRC.copper && P.PAGES.air === SRC.air && P.PAGES.corona === SRC.air && P.PAGES.wire === SRC.wire, 'μ0, the standard atmosphere, copper’s resistivity, air’s 3 MV/m and the straight wire’s 200 nH/m');
for (const [stroke, source] of [[P.FIRST, SRC.first], [P.SUBSEQUENT, SRC.subsequent]]) {
  t.ok(stroke.k === source.k && stroke.tau1 === source.tau1 && stroke.tau2 === source.tau2 && stroke.label === source.label, `${stroke.name}: Table 5’s k, τ1 and τ2 and its wave form`);
  assert.deepEqual([...stroke.peak], source.peak, `${stroke.name}: Table 4’s peaks`);
}
assert.deepEqual([...P.FIRST.charge], SRC.first.charge);
assert.deepEqual([...P.FIRST.energy], SRC.first.energy);
assert.deepEqual([...P.SUBSEQUENT.steepness], SRC.subsequent.steepness);
t.ok(P.HEIDLER.exponent === SRC.exponent && P.HEIDLER.steepest === SRC.steepest && P.HEIDLER.band[0] === SRC.band[0] && P.HEIDLER.band[1] === SRC.band[1], 'the exponent of 10, the 280 kA/μs steepest rise and the 30% to 90% band');
assert.deepEqual([...P.HEIDLER.long], SRC.long);
assert.deepEqual([...P.HEIDLER.flash], SRC.flash);
assert.deepEqual(P.LEVELS.map(level => level.ki), SRC.ki);
assert.deepEqual(P.LEVELS.map(level => level.radius), SRC.radius);
assert.deepEqual(P.LEVELS.map(level => level.minimum), SRC.minimum);
assert.deepEqual(P.LEVELS.map(level => level.above), SRC.above);
assert.deepEqual(P.LEVELS.map(level => level.below), SRC.below);
assert.deepEqual(P.LEVELS.map(level => level.column), [0, 1, 2, 2]);
assert.deepEqual(P.LEVELS.map(level => level.name), ['I', 'II', 'III', 'IV']);
t.ok(P.DEHN.rod === SRC.rod && P.DEHN.shortest === SRC.shortest && P.DEHN.earth === SRC.earth && P.DEHN.diameter === SRC.diameter && P.DEHN.area === SRC.area && P.DEHN.copperRise === SRC.copperRise && P.DEHN.step === SRC.step, 'DEHN’s 9 m rod, 5 m least, 10 Ω, 8 mm conductor of 50 mm², its 22 K rise and the 1 m step');
t.ok(P.DEHN.strike.coefficient === SRC.coefficient && P.DEHN.strike.exponent === SRC.power && P.DEHN.kc === SRC.kc && P.DEHN.air === SRC.km[0] && P.DEHN.solid === SRC.km[1], 'r = 10·I^0.65, kc = 1 for one down conductor, and km for air and for solid materials');
assert.deepEqual([...P.DEHN.firstNegative.peak], SRC.firstNegative.peak);
t.ok(P.DEHN.firstNegative.label === SRC.firstNegative.label && P.DEHN.example.current === SRC.example.current && P.DEHN.example.resistance === SRC.example.resistance && P.DEHN.example.volts === SRC.example.volts, 'the first negative stroke’s 1/200 μs and Figure 2.2.4’s 100 kA through 10 Ω');
t.near(SRC.example.current * SRC.example.resistance, SRC.example.volts, 1e-9, 'DEHN’s own example multiplies out');
t.ok(P.IET.inductance === SRC.inductance && P.IET.height === SRC.height, 'the IET’s 1 µH/m at a height of 10 m');
assert.deepEqual([...P.IET.rises], SRC.rises);
assert.deepEqual([...P.IET.volts], SRC.ietVolts);
SRC.rises.forEach((rise, i) => t.near(rise * SRC.inductance * SRC.height, SRC.ietVolts[i], 1e-6, `${rise / 1e9} kA/μs over 10 m of 1 µH/m is ${SRC.ietVolts[i] / 1e3} kV`));
t.ok(P.CORONA.detach === SRC.detach && P.CORONA.onset === SRC.onset && P.CORONA.ions === SRC.ions && P.CORONA.inside === SRC.inside && P.CORONA.pulses === SRC.pulses, 'Loeb’s 67 V/m/Pa, 6.79 MV/m, ions to 300 m, ten times more inside cloud, and 50 kHz pulses');
assert.deepEqual([...P.CORONA.starts], SRC.starts);
assert.deepEqual([...P.CORONA.surface], SRC.surface);
t.ok(P.CORONA.falloff.share === SRC.falloff.share && P.CORONA.falloff.radii === SRC.falloff.radii && P.CORONA.tree.current === SRC.tree.current && P.CORONA.tree.height === SRC.tree.height && P.CORONA.tree.field === SRC.tree.field, 'Moore’s 1% at 50 tip radii and the tree’s 30 nA at 6.4 kV/m');
t.near(SRC.detach * SRC.atmosphere, SRC.onset, 2e3, '67 V/m for every pascal at one atmosphere is the 6.79 MV/m the paper rounds to');
t.ok(P.PAGES.flashCurrent === SRC.flashCurrent && P.PAGES.flashCharge === SRC.flashCharge && P.PAGES.positive === SRC.positive && P.PAGES.fairWeather === SRC.fairWeather && P.PAGES.ratio === SRC.ratio, 'an average flash of 30 kA and 15 C, positive lightning under 5%, 100 V/m in fair weather and the 680:1 ratio');
assert.deepEqual([...P.PAGES.rise], SRC.rise);
assert.deepEqual([...P.PAGES.decay], SRC.decay);
t.near(P.CONDUCTOR.area, Math.PI * (SRC.diameter / 2) ** 2, 1e-12, 'an 8 mm conductor’s cross section');
t.near(P.CONDUCTOR.area, SRC.area, 0.3e-6, 'which is the 50 mm² DEHN names');
t.near(P.CONDUCTOR.resistance, SRC.copper * P.DECLARED.length / P.CONDUCTOR.area, relative(P.CONDUCTOR.resistance), '10 m of it at copper’s resistivity');
t.near(P.CONDUCTOR.inductance, SRC.inductance * P.DECLARED.length, 1e-15, 'and 10 m at 1 µH/m');

// The current function, retyped from the paper, integrated by Simpson's rule
// on a fine uniform grid and differentiated by central differences.
const retyped = (source, peak) => time => { if (!(time > 0)) return 0; const x = (time / source.tau1) ** SRC.exponent; return peak / source.k * x / (1 + x) * Math.exp(-time / source.tau2); };
const simpson = (fn, a, b, n) => { const h = (b - a) / n; let sum = 0; for (let i = 0; i <= n; i++) { sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * fn(a + i * h); counts.quadrature++; } return sum * h / 3; };
const scanPeak = (fn, a, b, n) => { let best = {t: a, value: -Infinity}; for (let i = 0; i <= n; i++) { const time = a + (b - a) * i / n, value = fn(time); if (value > best.value) best = {t: time, value}; counts.steps++; } return best; };
const crossing = (fn, a, b, target) => { let lo = a, hi = b; for (let k = 0; k < 90; k++) { const mid = (lo + hi) / 2; if ((fn(mid) < target) === (fn(a) < target)) lo = mid; else hi = mid; } return (lo + hi) / 2; };

for (const [index, source] of [[0, SRC.first], [1, SRC.subsequent]]) {
  const stroke = P.STROKES[index], peak = source.peak[0], current = retyped(source, peak), shape = P.SHAPES[index];
  const coarse = scanPeak(current, source.tau1 / 2, 6 * source.tau1, 20000), top = scanPeak(current, coarse.t - source.tau1 / 2000, coarse.t + source.tau1 / 2000, 2000);
  t.near(shape.top * peak, top.value, relative(top.value, 1e-8), `${stroke.name}: the function’s own peak`);
  t.near(shape.peakTime, top.t, source.tau1 / 1000, 'and when it peaks');
  for (const [share, time] of [[0.1, shape.t10], [SRC.band[0], shape.t30], [SRC.band[1], shape.t90]]) t.near(time, crossing(current, 0, top.t, share * top.value), relative(time, 1e-6), `${stroke.name}: its ${share * 100}% point on the front`);
  t.near(shape.half, crossing(current, top.t, 60 * source.tau2, top.value / 2), relative(shape.half, 1e-6), `${stroke.name}: its half value on the tail`);
  const slope = time => { const h = source.tau1 / 5000; return (current(time + h) - current(time - h)) / (2 * h); };
  const steepCoarse = scanPeak(slope, source.tau1 / 20, top.t, 20000), steep = scanPeak(slope, steepCoarse.t - source.tau1 / 2000, steepCoarse.t + source.tau1 / 2000, 2000);
  t.near(shape.steepest * peak, steep.value, relative(steep.value, 1e-6), `${stroke.name}: its steepest rise, differentiated numerically`);
  t.near(shape.steepestTime, steep.t, source.tau1 / 500, 'and when that comes');
  for (const share of [0.2, 0.5, 1, 2, 5, 20]) {
    const time = share * source.tau1;
    t.near(P.slopeOf(stroke, peak, time), slope(time), relative(Math.max(Math.abs(slope(time)), peak / source.tau1 * 1e-6), 1e-4), `${stroke.name}: the module’s slope at ${share} τ1`);
    t.near(P.currentOf(stroke, peak, time), current(time), relative(current(time), 1e-12), `${stroke.name}: the module’s current at ${share} τ1`);
  }
  const split = 20 * source.tau1, tail = 80 * source.tau2;
  const charge = simpson(current, 0, split, 200000) + simpson(current, split, tail, 200000);
  const energy = simpson(time => current(time) ** 2, 0, split, 200000) + simpson(time => current(time) ** 2, split, tail, 200000);
  t.near(shape.charge * peak, charge, relative(charge, 1e-6), `${stroke.name}: its charge by Simpson’s rule`);
  t.near(shape.energy * peak * peak, energy, relative(energy, 1e-6), 'and its specific energy');
  t.near(shape.average * peak, (SRC.band[1] - SRC.band[0]) * top.value / (shape.t90 - shape.t30), relative(shape.average * peak, 1e-9), 'and its average steepness between the two levels');
}
{
  const first = P.lightningPlan({}), subsequent = P.lightningPlan({stroke: 1});
  t.ok(Math.abs(first.charge - SRC.first.charge[0]) / SRC.first.charge[0] < 0.005, 'the first stroke carries the 100 C the table gives, within half a percent');
  t.ok(Math.abs(first.energy - SRC.first.energy[0]) / SRC.first.energy[0] < 0.03, 'and the 10 MJ/Ω within three percent');
  t.ok(Math.abs(subsequent.average - SRC.subsequent.steepness[0]) / SRC.subsequent.steepness[0] < 0.03, 'the subsequent stroke averages the table’s 200 kA/μs within three percent');
  t.ok(Math.abs(subsequent.steepest - SRC.steepest) / SRC.steepest < 0.005, 'and touches the paper’s 280 kA/μs within half a percent');
  t.ok(f2(first.charge) === '100.23' && f2(first.energy / 1e6) === '10.28' && f2(subsequent.average / 1e9) === '204.23' && f2(subsequent.steepest / 1e9) === '279.03', '100.23 C, 10.28 MJ/Ω, 204.23 kA/μs and 279.03 kA/μs');
  for (const level of [1, 2, 3]) {
    const scale = [1, 0.75, 0.5, 0.5][level];
    for (const stroke of [0, 1]) {
      const plan = P.lightningPlan({level, stroke}), base = P.lightningPlan({stroke});
      t.near(plan.peak, base.peak * scale, relative(plan.peak), `level ${P.LEVELS[level].name}: ${scale * 100}% of level I’s peak`);
      t.near(plan.steepest, base.steepest * scale, relative(plan.steepest), 'and of its steepest rise');
      t.near(plan.charge, base.charge * scale, relative(plan.charge), 'and of its charge');
      t.near(plan.energy, base.energy * scale * scale, relative(plan.energy), 'with the specific energy by the square');
    }
  }
}

// The grounded spheroid, rebuilt: a line charge growing along the axis between
// the foci, with its gradient fixed by the tip sitting at earth potential.
const GAUSS = (() => {
  const n = 12, nodes = [], weights = [];
  const legendre = x => { let p0 = 1, p1 = x; for (let j = 2; j <= n; j++) [p0, p1] = [p1, ((2 * j - 1) * x * p1 - (j - 1) * p0) / j]; return [p1, n * (x * p1 - p0) / (x * x - 1)]; };
  for (let i = 1; i <= n; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5));
    for (let k = 0; k < 60; k++) { const [value, slope] = legendre(x), step = value / slope; x -= step; if (Math.abs(step) < 1e-16) break; }
    nodes.push(x);
    weights.push(2 / ((1 - x * x) * legendre(x)[1] ** 2));
  }
  return {nodes, weights};
})();
const quad = (fn, a, b, panels = 40) => {
  let sum = 0;
  for (let p = 0; p < panels; p++) {
    const lo = a + (b - a) * p / panels, hi = a + (b - a) * (p + 1) / panels, half = (hi - lo) / 2, middle = (lo + hi) / 2;
    for (let i = 0; i < GAUSS.nodes.length; i++) { sum += GAUSS.weights[i] * fn(middle + half * GAUSS.nodes[i]) * half; counts.quadrature++; }
  }
  return sum;
};
/** The potential of a line charge λ(s) = s along the axis from −f to f, at (r, z), in units of 1/(4πε0). */
function linePotential(f, r, z) {
  const radius = Math.max(r, 1e-9), lo = Math.asinh((z - f) / radius), hi = Math.asinh((z + f) / radius);
  // s = z − radius·sinh(u): the segment's sharp peak spreads out and the integrand becomes (z − radius·sinh u).
  return quad(u => z - radius * Math.sinh(u), lo, hi);
}
/** The potential about a grounded spheroid in a field E0, built from that line charge with the tip held at zero. */
function builtPotential(spheroid, ambient) {
  const strength = ambient * spheroid.c / linePotential(spheroid.f, 0, spheroid.c);
  const at = (r, z) => { counts.potentials++; return -ambient * z + strength * linePotential(spheroid.f, r, z); };
  return at;
}
for (const tip of [0.5e-3, 2e-3, 25e-3]) {
  const spheroid = P.spheroidOf(tip), ambient = 12e3, built = builtPotential(spheroid, ambient);
  for (let k = 1; k <= 12; k++) {
    const angle = Math.PI / 2 * k / 13, z = spheroid.c * Math.cos(angle), r = spheroid.b * Math.sin(angle);
    t.ok(Math.abs(built(r, z)) < 1e-6 * ambient * spheroid.c, `a tip of ${tip * 1000} mm: the built potential is zero all over the spheroid, not only at its tip`);
  }
  const step = tip / 50, gradient = (r, z) => { const dr = (built(r + step, z) - built(Math.max(0, r - step), z)) / (r >= step ? 2 * step : step), dz = (built(r, z + step) - built(r, z - step)) / (2 * step); return Math.hypot(dr, dz); };
  const close = tip / 1e4, enhancement = P.enhancementOf(P.DECLARED.height / tip);
  t.near(enhancement * ambient, -built(0, spheroid.c + close) / close, relative(enhancement * ambient, 2e-3), `a tip of ${tip * 1000} mm: Moore’s enhancement is the built potential’s own gradient at the tip`);
  for (const [r, z] of [[0, spheroid.c + 20 * tip], [tip, spheroid.c], [3 * tip, spheroid.c - tip], [6 * tip, spheroid.c + 2 * tip], [10 * tip, spheroid.c - 3 * tip]]) {
    t.near(P.potentialAt(spheroid, ambient, r, z), built(r, z), relative(Math.abs(built(r, z)) + ambient * tip, 1e-6), `a tip of ${tip * 1000} mm: the module’s potential at ${f1(r * 1000)}, ${f1((z - spheroid.c) * 1000)} mm`);
    t.near(P.fieldAt(spheroid, ambient, r, z), gradient(r, z), relative(gradient(r, z), 5e-3), 'and its field, against the built potential’s gradient');
  }
}
for (const [ratio, ambient, tipField] of SRC.figure) t.near(P.enhancementOf(ratio) * ambient, tipField, 0.01e6, `their figure: c/a = ${ratio} in ${ambient / 1e3} kV/m gives ${tipField / 1e6} MV/m`);
for (const tip of [0.5e-3, 1e-3]) {
  const spheroid = P.spheroidOf(tip), ambient = 10e3;
  t.near(P.axisFieldAt(spheroid, ambient, spheroid.c + SRC.falloff.radii * tip) / (P.enhancementOf(P.DECLARED.height / tip) * ambient), SRC.falloff.share, 0.001, `a tip of ${tip * 1000} mm: Moore’s 1% of the tip’s field 50 tip radii above it`);
}
t.ok(f0(P.enhancementOf(P.DECLARED.height / 0.5e-3)) === '1,041' && f0(P.enhancementOf(P.DECLARED.height / 25e-3)) === '42' && f2(1000 * P.DECLARED.height / SRC.ratio) === '2.94', 'a 0.5 mm tip gathers 1,041 times, a 25 mm tip 42 times, and 680 to 1 on this terminal is a 2.94 mm tip');

// The earth rod, rebuilt: point sources spread along it in a half space.
for (const soil of [50, 100, 1000]) {
  const length = SRC.rod, current = 1;
  // Panels graded from the surface down, so the sharp part right beside the rod is resolved.
  const potential = distance => { let sum = 0, lo = 0, hi = Math.min(length, 1e-4); while (lo < length) { sum += quad(depth => soil * current / length / (2 * Math.PI * Math.hypot(distance, depth)), lo, hi, 1); lo = hi; hi = Math.min(length, lo * 1.3); } return sum; };
  t.near(P.rodResistanceOf(soil), potential(P.DECLARED.rodRadius), relative(P.rodResistanceOf(soil), 1e-5), `${soil} Ω·m: DEHN’s rod resistance is the line of current’s own potential at its surface`);
  for (const distance of [0.5, 2, 5, 20]) t.near(P.groundPotentialOf(soil, 1e5, distance), 1e5 * potential(distance), relative(1e5 * potential(distance), 1e-6), `${soil} Ω·m: the ground’s potential ${distance} m out, integrated point by point`);
  t.ok(P.rodResistanceOf(soil) > soil / length * 0.9 && P.rodResistanceOf(soil) < soil / length * 1.3, `${soil} Ω·m: close to DEHN’s rough ρ/l`);
}
t.ok(f1(P.rodResistanceOf(100)) === '13.3' && f1(P.rodResistanceOf(1000)) === '132.6' && f0(SRC.earth * 2 * Math.PI * SRC.rod / Math.log(2 * SRC.rod / P.DECLARED.rodRadius)) === '75', '13.3 Ω in 100 Ω·m, 132.6 Ω in 1,000 Ω·m, and 10 Ω up to 75 Ω·m');

// A down conductor's inductance, rebuilt: the flux of a long straight current
// between the conductor's surface and a pipe.
{
  const radius = SRC.diameter / 2;
  for (const distance of [0.4, 0.5, 1, 1.2]) {
    const flux = simpson(rho => SRC.mu0 / (2 * Math.PI * rho), radius, distance, 20000);
    t.near(flux, SRC.mu0 / (2 * Math.PI) * Math.log(distance / radius), relative(flux, 1e-6), `the field of a long straight current between 4 mm and ${distance} m`);
    t.ok(flux > 0.9e-6 && flux < 1.15e-6, `which brackets the IET’s 1 µH/m at ${distance} m`);
  }
  t.ok(f2(SRC.mu0 / (2 * Math.PI) * Math.log(0.5 / radius) * 1e6) === '0.97' && f2(SRC.mu0 / (2 * Math.PI) * Math.log(1 / radius) * 1e6) === '1.10' && f2(SRC.wire * (Math.log(2 * SRC.height / radius) - 1) * 1e6) === '1.50', '0.97 µH/m at 0.5 m, 1.10 µH/m at 1 m, and the wire alone 1.50 µH/m');
}

// The gap: the voltage along the conductor differentiated numerically, the
// withstand it implies, and the distance the standard asks for.
{
  const source = SRC.subsequent, peak = source.peak[0], current = retyped(source, peak);
  const volts = time => { const h = source.tau1 / 5000; return P.CONDUCTOR.inductance * (current(time + h) - current(time - h)) / (2 * h) + P.CONDUCTOR.resistance * current(time); };
  const coarse = scanPeak(volts, source.tau1 / 20, 3 * source.tau1, 20000), top = scanPeak(volts, coarse.t - source.tau1 / 2000, coarse.t + source.tau1 / 2000, 2000);
  t.near(P.WITHSTAND, top.value / (SRC.ki[0] * SRC.kc * P.DECLARED.length / SRC.km[0]), relative(P.WITHSTAND, 1e-5), 'the withstand is level I’s gap voltage over its separation distance');
  t.ok(f2(P.WITHSTAND / 1e6) === '3.49' && f2(SRC.subsequent.steepness[0] * P.CONDUCTOR.inductance / (SRC.ki[0] * P.DECLARED.length) / 1e6) === '2.50', '3.49 MV/m from the function’s peak and 2.50 MV/m from the standard’s average steepness');
  t.ok(P.WITHSTAND > SRC.air && SRC.subsequent.steepness[0] * P.CONDUCTOR.inductance / (SRC.ki[0] * P.DECLARED.length) < SRC.air, 'with air’s own 3 MV/m between the two');
  for (const level of [0, 1, 2, 3]) {
    const plan = P.lightningPlan({stroke: 1, level}), separation = SRC.ki[level] * SRC.kc * P.DECLARED.length / SRC.km[0];
    t.near(plan.separation, separation, 1e-12, `level ${P.LEVELS[level].name}: s = ki·kc·l/km`);
    t.near(plan.threshold, separation, relative(separation, 1e-6), 'and the subsequent stroke flashes exactly the gaps under it');
    const first = P.lightningPlan({stroke: 0, level});
    t.ok(first.threshold < 0.09 && first.threshold > 0.03, 'while the first stroke flashes only a hand’s width');
  }
  for (const gap of [0.1, 0.35, 0.75, 0.8, 1.2]) {
    const plan = P.lightningPlan({stroke: 1, gap});
    if (plan.flash === null) t.ok(top.value <= P.WITHSTAND * gap * (1 + 1e-9), `a gap of ${gap} m holds`);
    else {
      t.near(volts(plan.flash), P.WITHSTAND * gap, relative(P.WITHSTAND * gap, 1e-5), `a gap of ${gap} m breaks down where the voltage reaches its withstand`);
      t.ok(plan.flash < top.t, 'before the voltage has peaked');
    }
  }
  t.ok(f2(P.lightningPlan({stroke: 1, gap: 0.75}).flash * 1e6) === '0.42' && P.lightningPlan({stroke: 1, gap: 0.8}).flash === null, 'a gap of 0.75 m flashes 0.42 μs in and one of 0.80 m does not');
}

// The strike as it runs, rebuilt: every voltage from the retyped function.
for (const [index, source] of [[0, SRC.first], [1, SRC.subsequent]]) {
  for (const level of [0, 2]) {
    const values = {stroke: index, level, soil: level ? 1000 : 100, gap: 1.2};
    const plan = P.lightningPlan(values), column = [0, 1, 2, 2][level], peak = source.peak[column];
    const current = retyped(source, peak), h = source.tau1 / 5000;
    const slope = time => (current(time + h) - current(time - h)) / (2 * h);
    const resistance = SRC.copper * P.DECLARED.length / (Math.PI * (SRC.diameter / 2) ** 2);
    const inductance = SRC.inductance * P.DECLARED.length;
    const rod = SRC.rod === 9 ? values.soil / (2 * Math.PI * SRC.rod) * Math.log(2 * SRC.rod / P.DECLARED.rodRadius) : NaN;
    const top = peak * P.SHAPES[index].top;
    for (const time of [0.3 * source.tau1, source.tau1, 2 * source.tau1, 8 * source.tau1, 60 * source.tau1]) {
      const now = P.lightningAt(plan, time), i = current(time);
      t.near(now.current, i, relative(i, 1e-12), `${P.STROKES[index].name} at level ${P.LEVELS[level].name}: the current at this time`);
      t.near(now.inductive, inductance * slope(time), relative(Math.abs(now.inductive) + peak * 1e-6, 1e-4), 'the inductive volts, differentiated numerically');
      t.near(now.resistive, resistance * i, relative(Math.abs(now.resistive) + 1e-9, 1e-9), 'the resistive volts');
      t.near(now.gap, now.inductive + now.resistive, relative(Math.abs(now.gap) + 1, 1e-9), 'the two of them together across the gap');
      t.near(now.earth, rod * i, relative(Math.abs(now.earth) + 1e-9, 1e-6), 'the earth termination’s rise');
      t.near(now.field, now.gap / values.gap, relative(Math.abs(now.field) + 1, 1e-12), 'the field across the gap');
      t.near(now.share, i / top, relative(Math.abs(now.share) + 1e-9, 1e-9), 'the share of the peak it stands at');
      t.near(now.step, plan.step.volts * i / top, relative(Math.abs(now.step) + 1, 1e-9), 'and the step voltage falling with it');
      const partial = simpson(current, 0, time, 40000);
      t.near(now.charge, partial, relative(partial, 1e-5) + 1e-9, 'the charge gone to earth so far, by Simpson’s rule');
      t.ok(now.charge < plan.charge * (1 + 1e-9), 'never more than the whole stroke carries');
      t.ok(now.flashed === (plan.flash !== null && time >= plan.flash), 'flashed only once the gap has broken down');
    }
    t.ok(P.lightningAt(plan, 0).current === 0 && P.lightningAt(plan, 0).charge === 0 && P.lightningAt(plan, 0).gap === 0, 'and nothing at all before the strike attaches');
  }
}
{
  const plan = P.lightningPlan({stroke: 1, gap: 0.75});
  t.ok(!P.lightningAt(plan, plan.flash * 0.99).flashed && P.lightningAt(plan, plan.flash * 1.01).flashed, 'a gap that breaks down is whole a moment before and broken a moment after');
  for (const gap of [0.1, 0.5, 1.2]) t.near(P.lightningPlan({stroke: 1, gap}).threshold, P.lightningPlan({stroke: 1}).threshold, 1e-12, `the widest gap this stroke flashes is the same whether the pipe stands at ${gap} m or anywhere else`);
  const late = P.lightningAt(P.lightningPlan({}), 60e-6);
  t.ok(late.inductive < 0 && late.gap < 0 && late.current > 0, 'past the peak the conductor’s voltage turns around while its current still runs');
}

// The rolling sphere, and the clock.
P.LEVELS.forEach((level, index) => {
  t.near(P.strikeRadiusOf(level.minimum), SRC.coefficient * (SRC.minimum[index] / 1000) ** SRC.power, 1e-12, `level ${level.name}: r = 10·I^0.65`);
  t.ok(Math.abs(P.strikeRadiusOf(level.minimum) - level.radius) <= 1.6, `which lands within a meter and two thirds of the standard’s ${level.radius} m`);
  const touch = P.roofTouchOf(level.radius), center = [-touch, P.DECLARED.height - level.radius];
  t.near(Math.hypot(center[0], center[1]), level.radius, relative(level.radius, 1e-12), 'and a sphere resting on the roof at that distance touches the tip');
});
t.ok(f1(P.strikeRadiusOf(3e3)) === '20.4' && f1(P.strikeRadiusOf(5e3)) === '28.5' && f1(P.strikeRadiusOf(10e3)) === '44.7' && f1(P.strikeRadiusOf(16e3)) === '60.6', '20.4, 28.5, 44.7 and 60.6 m');
t.ok(f1(P.roofTouchOf(20)) === '8.7' && f1(P.roofTouchOf(60)) === '15.4', 'touching the roof 8.7 m out at level I and 15.4 m at level IV');
t.near(P.RUN, P.DECLARED.clock.decade * Math.log10(P.DECLARED.clock.end / P.DECLARED.clock.start), 1e-12, 'the run is two seconds for every tenfold');
t.near(P.timeOfClock(P.RUN), P.DECLARED.clock.end, relative(P.DECLARED.clock.end, 1e-12), 'and ends at 5 ms');
t.ok(P.timeOfClock(0) === 0 && P.timeOfClock(-1) === 0 && P.timeOfClock(P.RUN + 5) === P.timeOfClock(P.RUN), 'nothing before Play, and nothing past the end');
for (const seconds of [0.5, 2, 5, 9]) t.near(P.clockOfTime(P.timeOfClock(seconds)), seconds, 1e-9, `the clock and the time it shows agree at ${seconds} s`);
t.near(P.timeOfClock(2.5), 1e-7 * 10 ** 1.25, relative(1e-7, 1e-12), 'two and a half seconds in, the clock stands at 1.78 μs');

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

// Geometry read back out of Float32 buffers carries about a part in ten million.
const DRAWN = 1e-6;
const model = M.createLightningConductorModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const rowsOf = item => { const array = item.geometry.attributes.position.array, pairs = array.length / 6; return Array.from({length: pairs}, (_, i) => [[array[6 * i], array[6 * i + 1]], [array[6 * i + 3], array[6 * i + 4]]]); };
const windings = item => {
  const array = item.geometry.attributes.position.array, index = item.geometry.index.array;
  let facing = 0, away = 0;
  for (let k = 0; k < index.length; k += 3) {
    const [a, b, c] = [index[k], index[k + 1], index[k + 2]].map(v => [array[3 * v], array[3 * v + 1]]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross > 1e-12) facing++;
    else if (cross < -1e-12) away++;
  }
  return {facing, away};
};
t.ok(M.timesLarger(M.SCALE.tip) === 8 && M.MM === 0.01 && f0(1 / M.timesLarger(M.SCALE.storm / 1000)) === '100' && f0(1 / M.timesLarger(M.SCALE.gap / 1000)) === '20', 'the scales the text states: 100 times smaller, 8 times larger and 20 times smaller');

// Where the charts put a time, a current and a voltage, worked out again here.
{
  const {start, end} = P.DECLARED.clock, decades = Math.log10(end / start);
  t.near(M.timeX(start), M.CHART.x, 1e-12, 'the charts start at the clock’s first time');
  t.near(M.timeX(end), M.CHART.x + M.CHART.w, 1e-12, 'and end at its last');
  for (const time of [3e-7, 1e-6, 1e-5, 1e-4, 1e-3]) t.near(M.timeX(time), M.CHART.x + M.CHART.w * Math.log10(time / start) / decades, 1e-12, `${time * 1e6} μs lands across the panel by its logarithm`);
  t.ok(M.timeX(start / 10) === M.CHART.x && M.timeX(end * 10) === M.CHART.x + M.CHART.w, 'and nothing runs off either end');
  t.near(M.currentY(0), M.CHART.current.y, 1e-12, 'no current sits at the floor of its panel');
  t.near(M.currentY(M.CHART.current.top), M.CHART.current.y + M.CHART.current.h, 1e-12, 'the panel’s own top at its ceiling');
  t.near(M.currentY(M.CHART.current.top / 2), M.CHART.current.y + M.CHART.current.h / 2, 1e-12, 'and half of it halfway up');
  const span = Math.log10(M.CHART.volts.high / M.CHART.volts.low);
  for (const volts of [1e3, 1e4, 1e6, 1e8]) t.near(M.voltsY(volts), M.CHART.volts.y + M.CHART.volts.h * Math.log10(volts / M.CHART.volts.low) / span, 1e-12, `${volts / 1e3} kV up the voltage panel by its logarithm`);
  t.near(M.voltsY(-2.5e6), M.voltsY(2.5e6), 1e-12, 'a voltage that has turned negative drawn by its size');
  t.ok(M.voltsY(1) === M.CHART.volts.y && M.voltsY(1e12) === M.CHART.volts.y + M.CHART.volts.h, 'with the panel’s floor and ceiling holding everything else');
  t.near(M.groundX(0), M.EARTH.x, 1e-12, 'the ground panel starts at the rod');
  t.near(M.groundX(P.DECLARED.reach), M.EARTH.x + M.EARTH.w, 1e-12, 'and ends where the model stops looking');
  t.near(M.groundX(P.DECLARED.reach / 4), M.EARTH.x + M.EARTH.w / 4, 1e-12, 'a quarter of the way out for a quarter of the distance');
  t.near(M.groundY(1e5), M.EARTH.y + M.EARTH.h * Math.log10(1e5 / M.EARTH.low) / Math.log10(M.EARTH.high / M.EARTH.low), 1e-12, 'and up it by its logarithm too');
  t.ok(M.signed(-1.5, 1) === '−1.5' && M.signed(1.5, 1) === '1.5' && M.signed(-0.0004, 2) === '0.00' && M.signed(0, 2) === '0.00', 'a true minus sign, and none on a number that rounds to nothing');
  t.ok(M.timeText(4.2e-7) === '0.42 μs' && M.timeText(9.99e-4) === '999.00 μs' && M.timeText(5e-3) === '5.00 ms', 'microseconds until a millisecond, then milliseconds');
}

const settings = [];
for (const level of [0, 1, 2, 3]) for (const stroke of [0, 1]) settings.push({level, stroke, field: [0, 5, 10, 20][(level + stroke) % 4], tip: [0.5, 1, 5, 25][(level + stroke) % 4], soil: [50, 100, 500, 1000][(2 * level + stroke) % 4], gap: [0.1, 0.35, 0.75, 1.2][(level + 2 * stroke) % 4]});
settings.push({}, {field: 1, tip: 25}, {field: 6}, {field: 20, tip: 0.5}, {stroke: 1, gap: 0.75}, {stroke: 1, gap: 0.8, soil: 1000});

for (const values of settings) {
  const plan = P.lightningPlan(values), spheroid = plan.spheroid, built = plan.ambient > 0 ? builtPotential(spheroid, plan.ambient) : null;
  if (built) {
    for (const [r, z] of [[0, spheroid.c + 2e-3], [2e-3, spheroid.c], [6e-3, spheroid.c - 3e-3]]) t.near(P.potentialAt(spheroid, plan.ambient, r, z), built(r, z), relative(Math.abs(built(r, z)) + plan.ambient * spheroid.a, 1e-6), 'the module’s potential against the line charge’s, at this setting');
  }
  for (const time of [0, plan.steepestTime, plan.peakTime, 60e-6, P.DECLARED.clock.end]) {
    model.reset();
    model.update(values);
    if (time > 0) model.advance(P.clockOfTime(time));
    model.root.updateMatrixWorld(true);
    const state = model.getState(), now = state.now, started = time > 0;
    counts.poses++;
    t.near(state.t, started ? time : 0, relative(time, 1e-6) + 1e-12, 'the clock stands where it was wound');

    // The house: the pipe, the bonding bar, the rod, the charges, the field arrows and the rolling sphere.
    t.near(T.pipeBar.position.x, -plan.values.gap * M.SCALE.storm, DRAWN, 'the pipe stands its gap from the conductor');
    t.near(T.pipeBar.scale.y, M.STORM.house[2] * M.SCALE.storm, DRAWN, 'and runs to the roof');
    t.near(T.bondBar.position.x, (-plan.values.gap - M.STORM.pipe + M.STORM.conductor) / 2 * M.SCALE.storm, DRAWN, 'the bonding bar reaches from the pipe to the conductor');
    t.near(T.rodBar.scale.y, P.DEHN.rod * M.SCALE.storm, DRAWN, 'the rod is 9 m deep');
    const terminalRows = rowsOf(T.terminal);
    t.near(terminalRows[1][0][1], (M.STORM.house[2] + P.DECLARED.height) * M.SCALE.storm, DRAWN, 'the terminal reaches 2 m above the roof');
    t.near(terminalRows[0][0][1], M.STORM.house[2] * M.SCALE.storm, DRAWN, 'standing on the roof');
    t.ok(windings(T.terminal).away === 0 && windings(T.terminal).facing > 0, 'and its triangles face the viewer');
    const marks = Math.round(plan.values.field);
    t.ok(pointsOf(T.minuses).length === 2 * marks && pointsOf(T.pluses).length === 4 * marks, `${marks} charges under the cloud and as many in the ground`);
    for (const arrow of T.fieldArrows) {
      t.near(arrow.userData.length, plan.ambient * M.STORM.arrowPerVolt * M.SCALE.storm, DRAWN, 'every field arrow as long as the field');
      t.near(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion).y, 1, DRAWN, 'and pointing up, from the ground to the cloud');
    }
    const arc = pointsOf(T.sphereArc), center = [-plan.roofTouch * M.SCALE.storm, (M.STORM.house[2] + plan.level.radius) * M.SCALE.storm];
    t.ok(arc.length === M.STORM.arcPoints, 'the rolling sphere drawn as an arc');
    for (const [x, y] of arc) { t.ok(Math.abs(Math.hypot(x - center[0], y - center[1]) - plan.level.radius * M.SCALE.storm) < 1e-6, 'every point on the sphere’s circle'); counts.points++; }
    t.ok(Math.abs(arc[0][0] - center[0]) < DRAWN && Math.abs(arc[0][1] - M.STORM.house[2] * M.SCALE.storm) < DRAWN, 'from where it rests on the roof');
    t.ok(Math.abs(arc.at(-1)[0]) < DRAWN && Math.abs(arc.at(-1)[1] - (M.STORM.house[2] + P.DECLARED.height) * M.SCALE.storm) < DRAWN, 'to the tip of the terminal');
    t.near(pointsOf(T.touchTick)[0][0], -plan.roofTouch * M.SCALE.storm, DRAWN, 'with a mark where it touches the roof');
    t.ok(T.ionDots.every(item => item.visible === (plan.corona && !started)), 'ions above the tip only while the point is in corona and the strike has not come');
    t.ok((pointsOf(T.channel).length > 0) === started && (pointsOf(T.stormSpark).length > 0) === now.flashed, 'the channel once the strike attaches, the spark once the gap breaks down');
    if (started) {
      const channel = pointsOf(T.channel);
      t.near(channel[0][1], M.STORM.cloud[0] * M.SCALE.storm, DRAWN, 'the channel coming down from the cloud');
      t.near(channel.at(-1)[1], (M.STORM.house[2] + P.DECLARED.height) * M.SCALE.storm, DRAWN, 'and ending on the terminal’s tip');
      t.ok(Math.abs(channel[0][0]) < DRAWN && Math.abs(channel.at(-1)[0]) < DRAWN, 'straight down the terminal’s own line');
    }
    const wedgeRows = rowsOf(T.wedge);
    if (started) {
      t.near(wedgeRows[1][0][0] - wedgeRows[1][1][0], Math.abs(now.gap) * M.STORM.wedgePerVolt * M.SCALE.storm, DRAWN, 'the wedge as wide at the top as the voltage there');
      t.near(wedgeRows[0][0][0], wedgeRows[0][1][0], DRAWN, 'and closed at the bonding bar');
      t.near(T.currentArrow.userData.length, now.current * M.STORM.current.perAmpere * M.SCALE.storm, DRAWN, 'the current arrow as long as the current');
      t.near(new THREE.Vector3(0, 1, 0).applyQuaternion(T.currentArrow.quaternion).y, -1, DRAWN, 'and pointing down the conductor');
    } else t.ok(!T.wedge.mesh.visible && T.currentArrow.userData.length === 0, 'no voltage and no current drawn before Play');

    // The tip: the metal, the equipotentials and the zone.
    const metalRows = rowsOf(T.metal), scale = 1000 * M.SCALE.tip;
    for (const [right, left] of metalRows) {
      const across = right[0] / scale, depth = -right[1] / scale, height = spheroid.c - depth;
      t.ok(Math.abs(right[0] + left[0]) < DRAWN && depth >= -DRAWN && depth <= P.DECLARED.window.below + DRAWN, 'the metal drawn evenly about its axis, inside the window');
      const ideal = spheroid.b * Math.sqrt(Math.max(0, 1 - (height / spheroid.c) ** 2));
      t.ok(Math.abs(across - Math.min(P.DECLARED.window.half, ideal)) < 1e-8, 'its edge on the spheroid, or clipped at the window');
      counts.points++;
    }
    metalRows.forEach((row, i) => {
      const share = (metalRows.length - 1 - i) / (metalRows.length - 1);
      t.ok(Math.abs(-row[0][1] / scale - P.DECLARED.window.below * share * share) < 1e-8, 'the rows crowding toward the tip by the square of how far down they are');
    });
    t.ok(windings(T.metal).away === 0 && windings(T.metal).facing > 0, 'the metal’s triangles face the viewer');
    const lines = pointsOf(T.equipotentials);
    t.ok(lines.length === plan.contours.reduce((sum, contour) => sum + 2 * (contour.points.length - 1), 0), 'every equipotential drawn segment by segment');
    if (built) {
      const reach = -P.potentialAt(spheroid, plan.ambient, 0, spheroid.c + P.DECLARED.window.above);
      t.ok(plan.contours.length === Math.min(P.DECLARED.contours, Math.floor(reach / P.DECLARED.spacing + DRAWN)), 'one equipotential for every kilovolt the window reaches');
      for (const contour of plan.contours) {
        for (const [x, y] of contour.points) {
          t.ok(Math.abs(P.potentialAt(spheroid, plan.ambient, Math.abs(x), spheroid.c + y) + contour.volts) < 1e-6 * contour.volts, `a point on the ${contour.volts / 1000} kV line`);
          t.ok(Math.abs(x) <= P.DECLARED.window.half + DRAWN && y >= -P.DECLARED.window.below - 1e-9 && y <= P.DECLARED.window.above + DRAWN, 'inside the window');
          counts.points++;
        }
        t.ok(Math.abs(contour.points[0][1] - contour.points.at(-1)[1]) < DRAWN && Math.abs(contour.points[0][0] + contour.points.at(-1)[0]) < DRAWN, 'each line even about the axis');
      }
      lines.forEach(([x, y], index) => { if (index % 37 === 0) t.ok(Math.abs(x) <= (P.DECLARED.window.half * 1000 * M.SCALE.tip) + DRAWN && y >= -(P.DECLARED.window.below * 1000 * M.SCALE.tip) - DRAWN, 'and drawn inside the window'); });
    } else t.ok(lines.length === 0 && plan.contours.length === 0, 'no equipotentials without a field');
    if (plan.zone) {
      for (const row of plan.zone.rows) {
        const [x, y] = row.boundary;
        t.near(P.fieldAt(spheroid, plan.ambient, Math.abs(x), spheroid.c + y), P.PAGES.air, relative(P.PAGES.air, 1e-6), 'the zone’s edge where the field is air’s breakdown strength');
        t.ok(Math.abs(P.potentialAt(spheroid, plan.ambient, Math.abs(row.surface[0]), spheroid.c + row.surface[1])) < DRAWN * plan.ambient * spheroid.c, 'and its other side on the metal, at earth potential');
        t.ok(Math.abs(x) <= P.DECLARED.window.half && y <= P.DECLARED.window.above, 'inside the window');
        counts.points++;
      }
      t.ok(plan.zone.height > 0 && plan.zone.rows.at(-1).boundary[1] <= 0, 'the zone reaching above the tip and closing on the metal down its side');
      t.ok(T.zoneFill.mesh.visible === plan.corona, 'filled in only once the tip is in corona');
      if (plan.corona) t.ok(windings(T.zoneFill).away === 0 && windings(T.zoneFill).facing > 0, 'and its triangles face the viewer');
      t.ok(pointsOf(T.zoneLine).length === 2 * plan.zone.rows.length - 1, 'its edge drawn all the way round');
      const edge = pointsOf(T.zoneLine);
      for (let i = 1; i < edge.length; i++) t.ok(edge[i][0] > edge[i - 1][0] + 1e-9, 'running once from side to side, with no point drawn twice');
      t.ok(Math.abs(edge[(edge.length - 1) / 2][0]) < DRAWN && Math.abs(edge[0][0] + edge.at(-1)[0]) < DRAWN, 'even about the axis, with one point on it');
    } else t.ok(pointsOf(T.zoneLine).length === 0 && !T.zoneFill.mesh.visible, 'nothing shaded where the field never reaches air’s strength');
    t.ok(T.tipIons.every(item => item.visible === (plan.corona && !started)), 'the ions in the close up follow the corona too');
    T.tipIons.forEach((item, i) => {
      if (!item.visible) return;
      const rung = plan.zone.height + 1.6e-3 + i * 1.1e-3;
      t.near(item.position.y, rung * 1000 * M.SCALE.tip, DRAWN, 'each ion on its own rung above the air the tip breaks down');
      t.ok(item.position.y > 0 && item.position.y <= (10e-3 - 0.25e-3) * 1000 * M.SCALE.tip + DRAWN, 'every rung above the tip and inside the window');
    });

    // The gap: the pipe, the two measures and the spark.
    t.near(T.gapPipe.position.x, -plan.values.gap * M.SCALE.gap, DRAWN, 'the pipe at its gap in the close up');
    const mark = pointsOf(T.gapMark), bracket = pointsOf(T.gapBracket);
    t.near(mark[1][0] - mark[0][0], plan.values.gap * M.SCALE.gap, DRAWN, 'the lower line measures the gap');
    t.near(bracket[1][0] - bracket[0][0], plan.separation * M.SCALE.gap, DRAWN, 'the upper bracket the separation distance');
    t.near(mark[0][1], -0.075, DRAWN, 'the gap measured below the roof line');
    t.near(bracket[0][1], 0.125, DRAWN, 'and the standard’s bracket above it');
    t.ok(bracket[0][1] - mark[0][1] > 0.15, 'the two measures well clear of one another');
    t.ok((pointsOf(T.gapSpark).length > 0) === now.flashed, 'and a spark only when it breaks down');

    // The charts: the guides, the live curves, the withstand line and the cursor.
    const guide = pointsOf(T.currentGuide), live = pointsOf(T.currentCurve), voltsGuide = pointsOf(T.gapGuide), earthGuide = pointsOf(T.earthGuide);
    t.ok(guide.length === P.DECLARED.samples && voltsGuide.length === P.DECLARED.samples && earthGuide.length === P.DECLARED.samples, 'the whole strike drawn faintly');
    for (let i = 0; i < P.DECLARED.samples; i += 17) {
      const sample = plan.samples[i];
      t.near(guide[i][0], M.timeX(sample.t), DRAWN, 'across in time');
      t.near(guide[i][1], M.currentY(sample.current), DRAWN, 'up in current');
      t.near(voltsGuide[i][1], M.voltsY(sample.gap), DRAWN, 'and the gap’s voltage up its own logarithm');
      t.near(earthGuide[i][1], M.voltsY(sample.earth), DRAWN, 'and the earth’s rise with it');
      t.near(sample.current, P.currentOf(plan.stroke, plan.peak, sample.t), relative(sample.current, 1e-12), 'each sample the current at its time');
      t.near(sample.earth, plan.earthResistance * sample.current, relative(Math.abs(sample.earth), 1e-12), 'and the earth’s rise that current through the rod');
      counts.points++;
    }
    if (started) {
      t.ok(live.length === plan.samples.filter(sample => sample.t < state.t).length + 1, 'the dark curve as far as the clock');
      t.near(live.at(-1)[0], M.timeX(state.t), DRAWN, 'ending at now');
      t.near(live.at(-1)[1], M.currentY(now.current), DRAWN, 'at the current now');
      t.near(pointsOf(T.gapCurve).at(-1)[1], M.voltsY(now.gap), DRAWN, 'and the voltage now');
      t.near(pointsOf(T.cursor)[0][0], M.timeX(state.t), DRAWN, 'with the cursor at now');
    } else t.ok(live.length === 0 && pointsOf(T.cursor).length === 0, 'nothing drawn dark before Play');
    t.near(pointsOf(T.withstandLine)[0][1], M.voltsY(P.WITHSTAND * plan.values.gap), DRAWN, 'the withstand line at what the gap can take');

    // The ground: the potential at the peak, and where the clock stands.
    const ground = pointsOf(T.earthCurveGuide);
    t.ok(ground.length === P.DECLARED.ground, 'the ground’s potential drawn from the rod outward');
    for (let i = 0; i < P.DECLARED.ground; i += 13) {
      const sample = plan.ground[i];
      t.near(ground[i][0], M.groundX(sample.x), DRAWN, 'across in distance');
      t.near(ground[i][1], M.groundY(sample.volts), DRAWN, 'up in potential');
      t.near(sample.volts, P.groundPotentialOf(plan.values.soil, plan.top, sample.x), relative(sample.volts, 1e-12), 'each one the potential the rod leaves there');
      counts.points++;
    }
    const feet = pointsOf(T.feet);
    t.near(feet[0][0], M.groundX(P.DECLARED.person), DRAWN, 'a foot 5 m out');
    t.near(feet[2][0], M.groundX(P.DECLARED.person + P.DEHN.step), DRAWN, 'and the other a step away');
    const share = started ? now.current / plan.top : 1;
    const stepBar = pointsOf(T.stepBracket);
    t.near(stepBar[0][1], M.groundY(plan.step.near * share), DRAWN, 'the step bracket from the nearer foot’s potential');
    t.near(stepBar[1][1], M.groundY(plan.step.far * share), DRAWN, 'down to the farther foot’s');
    t.ok(plan.step.near > plan.step.far, 'the ground falling away from the rod');
    if (started) {
      const overlay = pointsOf(T.earthNow);
      t.ok(overlay.length === P.DECLARED.ground, 'the potential now drawn over it');
      t.near(overlay[0][1], M.groundY(plan.ground[0].volts * share), DRAWN, 'the whole curve scaled by the current of the moment');
      t.near(overlay.at(-1)[1], M.groundY(plan.ground.at(-1).volts * share), DRAWN, 'out to the far end of the panel');
    }
    else t.ok(pointsOf(T.earthNow).length === 0, 'and nothing before Play');
  }
}
{
  // No part of the bench runs into another, whatever the settings.
  const toSystem = new THREE.Matrix4(), local = new THREE.Box3();
  const boxOf = object => {
    const box = new THREE.Box3();
    object.traverse(child => {
      for (let node = child; node; node = node.parent) if (!node.visible) return;
      if (!child.geometry) return;
      child.geometry.computeBoundingBox();
      box.union(local.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld).applyMatrix4(toSystem));
    });
    return box;
  };
  for (const values of [{}, {field: 20, tip: 25, gap: 1.2, level: 3}, {stroke: 1, gap: 0.1, soil: 1000, level: 1}]) {
    model.reset();
    model.update(values);
    model.advance(P.RUN);
    model.root.updateMatrixWorld(true);
    toSystem.copy(T.system.matrixWorld).invert();
    const boxes = ['storm', 'tip', 'gap', 'chart', 'earth'].map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
    t.ok(boxes.every(([, box]) => !box.isEmpty()), 'every part drawn');
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, A] = boxes[i], [b, B] = boxes[j];
        t.ok(A.max.x + 0.02 <= B.min.x || B.max.x + 0.02 <= A.min.x || A.max.y + 0.02 <= B.min.y || B.max.y + 0.02 <= A.min.y, `the ${a} and the ${b} stay clear of each other`);
      }
    }
  }
}

{
  // The lengths the house view draws, against the numbers typed here: a field
  // arrow 1.6e-5 units for every volt a meter, a wedge 1.2e-7 units for every
  // volt, and a current arrow 3.5e-6 units for every ampere.
  model.reset();
  model.update({field: 10});
  model.root.updateMatrixWorld(true);
  t.near(T.fieldArrows[0].userData.length, 10e3 * 1.6e-5, DRAWN, 'a storm of 10 kV/m draws its field arrows 0.16 units long');
  t.ok(T.fieldArrows.every(arrow => arrow.userData.length <= (M.STORM.cloud[0] - M.STORM.arrowFoot) * M.SCALE.storm + DRAWN), 'and no arrow reaches into the cloud');
  model.update({field: 20});
  model.root.updateMatrixWorld(true);
  t.near(T.fieldArrows[0].userData.length, 20e3 * 1.6e-5, DRAWN, 'twice the storm, twice the arrow');
  model.reset();
  model.update({stroke: 1});
  model.advance(P.clockOfTime(P.GAP_PEAKS[1].time));
  model.root.updateMatrixWorld(true);
  const peakGap = P.lightningAt(P.lightningPlan({stroke: 1}), P.GAP_PEAKS[1].time).gap, wedgeTop = rowsOf(T.wedge)[1];
  t.near(wedgeTop[0][0] - wedgeTop[1][0], Math.abs(peakGap) * 1.2e-7, DRAWN, 'the subsequent stroke’s 2.79 MV draws the wedge 0.33 units wide');
  t.ok(wedgeTop[0][0] - wedgeTop[1][0] < (M.STORM.soil[1] - M.STORM.conductor) * M.SCALE.storm, 'which stays on the drawing');
  model.reset();
  model.advance(P.clockOfTime(P.lightningPlan({}).peakTime));
  model.root.updateMatrixWorld(true);
  const atPeak = P.lightningAt(P.lightningPlan({}), P.lightningPlan({}).peakTime).current;
  t.near(T.currentArrow.userData.length, atPeak * 3.5e-6, DRAWN, '200 kA draws the current arrow 0.70 units long');
  t.ok(T.currentArrow.userData.length < M.STORM.current.top * M.SCALE.storm, 'no longer than the conductor it runs beside');
  model.reset();
}

// ---------------------------------------------------------------------------
// 3. The lesson: every number it quotes is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(P.RUN); return model.getState(); };
checkTrialNumbers(L.lightningLesson, {
  'A point in the storm': s => ({'4,000': s.ratio, '1,041': s.enhancement, '10.41': s.tipField / 1e6, '6.79': P.CORONA.onset / 1e6, '0.62': s.zone.height * 1000, 50: P.CORONA.falloff.radii, '1.03': 100 * s.falloff}),
  'Round off the tip': s => { t.ok(!s.corona && s.zone === null, 'a blunt tip ionizes nothing'); return {25: s.values.tip, 42: s.enhancement, '0.42': s.tipField / 1e6, '163.23': s.onsetField / 1e3}; },
  'A weaker storm': s => { t.ok(!s.corona && s.zone !== null, 'air over its strength, but no corona'); return {'6.25': s.tipField / 1e6, 3: P.PAGES.air / 1e6, '0.27': s.zone.height * 1000, '6.79': P.CORONA.onset / 1e6, '6.52': s.onsetField / 1e3}; },
  'The first stroke': s => ({200: s.peak / 1e3, '7.98': (s.shape.t90 - s.shape.t10) * 1e6, 371: s.shape.half * 1e6, '100.2': s.charge, '27.3': s.steepest / 1e9, '0.27': s.inductiveMax / 1e6, '2.65': s.earthMax / 1e6}),
  'The steepest stroke': s => { t.ok(s.steepest / P.lightningPlan({}).steepest > 10, 'ten times steeper than the first stroke'); return {50: s.peak / 1e3, '0.20': (s.shape.t90 - s.shape.t10) * 1e6, '279.0': s.steepest / 1e9, 10: P.CONDUCTOR.inductance * 1e6, '2.79': s.gapMax / 1e6, '0.66': s.earthMax / 1e6}; },
  'Closer than the standard asks': s => { t.ok(P.lightningAt(s, s.flash).current < s.top / 2, 'and flashes before the current is halfway up'); return {'0.80': s.separation, '0.75': s.values.gap, '2.79': s.gapMax / 1e6, '3.72': s.gapField / 1e6, '3.49': P.WITHSTAND / 1e6, '0.42': s.flash * 1e6}; },
  'Dry ground at level III': s => ({100: s.peak / 1e3, '132.6': s.earthResistance, '13.27': s.earthMax / 1e6, 20: P.DECLARED.reach, 772: s.ground.at(-1).volts / 1e3, 5: P.DECLARED.person, 276: s.step.volts / 1e3}),
}, run, t);
t.ok(L.lightningLesson.tryIt[5].observe.includes('before the current is halfway to its peak') && P.lightningAt(P.lightningPlan({stroke: 1, gap: 0.75}), P.lightningPlan({stroke: 1, gap: 0.75}).flash).current < P.lightningPlan({stroke: 1, gap: 0.75}).top / 2, 'the sixth trial says in words what its numbers show: the flash comes before the current is halfway up');

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
for (const [where, text] of texts(L.lightningLesson)) covered(text, {}, `lightning ${where}`);

const def = P.lightningPlan({}), sub = P.lightningPlan({stroke: 1}), blunt = P.lightningPlan({tip: 25});
covered(L.lightningLesson.deeper[0].body, {
  '[η0(η0² − 1)(arccoth η0 − 1/η0)]⁻¹ with η0 = (1 − a/c)^−1/2': '[η0(η0² − 1)(arccoth η0 − 1/η0)]⁻¹ with η0 = (1 − a/c)^−1/2',
  [`the ${f0(P.DECLARED.height)} m terminal here a tip radius of ${f1(P.LIGHTNING_DEFAULTS.tip)} mm makes c/a = ${f0(def.ratio)} and a multiplier of ${f0(def.enhancement)}, while rounding the tip to ${f0(blunt.values.tip)} mm leaves ${f0(blunt.enhancement)}`]: 'the 2 m terminal here a tip radius of 0.5 mm makes c/a = 4,000 and a multiplier of 1,041, while rounding the tip to 25 mm leaves 42',
  [`c/a = ${f0(SRC.figure[0][0])} in ${f0(SRC.figure[0][1] / 1e3)} kV/m gives ${f2(SRC.figure[0][2] / 1e6)} MV/m, and c/a = ${f0(SRC.figure[1][0])} in ${f0(SRC.figure[1][1] / 1e3)} kV/m gives ${f2(SRC.figure[1][2] / 1e6)} MV/m`]: 'c/a = 1,250 in 6 kV/m gives 2.30 MV/m, and c/a = 2,000 in 20 kV/m gives 11.44 MV/m',
  [`${f0(P.CORONA.falloff.radii)} tip radii above the tip the field is down to ${f2(100 * def.falloff)}% of it`]: '50 tip radii above the tip the field is down to 1.03% of it',
  [`about ${f0(SRC.ratio)} to 1, the better receptors, which on this terminal would be a tip radius of ${f2(1000 * P.DECLARED.height / SRC.ratio)} mm`]: 'about 680 to 1, the better receptors, which on this terminal would be a tip radius of 2.94 mm',
}, 'deeper 1');
covered(L.lightningLesson.deeper[1].body, {
  [`about ${f0(P.CORONA.tree.current * 1e9)} nA of corona current from a tree ${f1(P.CORONA.tree.height)} m tall standing in a surface field of ${f1(P.CORONA.tree.field / 1e3)} kV/m, in pulses at about ${f0(P.CORONA.pulses / 1e3)} kHz, and found corona ions at least ${f0(P.CORONA.ions)} m above the ground`]: 'about 30 nA of corona current from a tree 1.4 m tall standing in a surface field of 6.4 kV/m, in pulses at about 50 kHz, and found corona ions at least 300 m above the ground',
  [`an hour of that current is ${f3(P.CORONA.tree.current * 3600 * 1000)} mC, and an average flash carries ${f0(P.PAGES.flashCharge)} C, so it would take ${f0(P.PAGES.flashCharge / (P.CORONA.tree.current * 3600))} such points an hour to move one flash`]: 'an hour of that current is 0.108 mC, and an average flash carries 15 C, so it would take 138,889 such points an hour to move one flash',
}, 'deeper 2');
covered(L.lightningLesson.deeper[2].body, {
  'IEC 62305': 'IEC 62305',
  'i = (I/k)·(t/τ1)^10/(1 + (t/τ1)^10)·exp(−t/τ2)': 'i = (I/k)·(t/τ1)^10/(1 + (t/τ1)^10)·exp(−t/τ2)',
  [`k = ${P.FIRST.k}, τ1 = ${f1(P.FIRST.tau1 * 1e6)} μs and τ2 = ${f0(P.FIRST.tau2 * 1e6)} μs for the first short stroke, named ${P.FIRST.label}, and k = ${P.SUBSEQUENT.k}, τ1 = ${fixed(P.SUBSEQUENT.tau1 * 1e6, 3)} μs and τ2 = ${f0(P.SUBSEQUENT.tau2 * 1e6)} μs for the subsequent one, named ${P.SUBSEQUENT.label}`]: 'k = 0.93, τ1 = 19.0 μs and τ2 = 485 μs for the first short stroke, named 10/350 μs, and k = 0.993, τ1 = 0.454 μs and τ2 = 143 μs for the subsequent one, named 0.25/100 μs',
  [`in ${f2((def.shape.t90 - def.shape.t10) * 1e6)} μs and halves in ${f0(def.shape.half * 1e6)} μs, carrying ${f1(def.charge)} C and ${f2(def.energy / 1e6)} MJ for every ohm it runs through, against the ${f0(P.FIRST.charge[0])} C and ${f0(P.FIRST.energy[0] / 1e6)} MJ/Ω the table gives`]: 'in 7.98 μs and halves in 371 μs, carrying 100.2 C and 10.28 MJ for every ohm it runs through, against the 100 C and 10 MJ/Ω the table gives',
  [`averages ${f0(sub.average / 1e9)} kA/μs between three tenths and nine tenths of its peak where the table says ${f0(P.SUBSEQUENT.steepness[0] / 1e9)} kA/μs, and touches ${f0(sub.steepest / 1e9)} kA/μs where the paper says ${f0(P.HEIDLER.steepest / 1e9)} kA/μs`]: 'averages 204 kA/μs between three tenths and nine tenths of its peak where the table says 200 kA/μs, and touches 279 kA/μs where the paper says 280 kA/μs',
  [`the ${P.IET.type2} wave: that is the surge a type 2 protective device is tested with, downstream of a type 1 device made for the ${P.IET.type1} share`]: 'the 8/20 μs wave: that is the surge a type 2 protective device is tested with, downstream of a type 1 device made for the 10/350 μs share',
  [`first negative stroke, ${P.DEHN.firstNegative.label}`]: 'first negative stroke, 1/200 μs',
}, 'deeper 3');
covered(L.lightningLesson.deeper[3].body, {
  [`a first stroke of ${f0(P.FIRST.peak[0] / 1e3)} kA and a subsequent one of ${f0(P.SUBSEQUENT.peak[0] / 1e3)} kA`]: 'a first stroke of 200 kA and a subsequent one of 50 kA',
  [`${f0(P.LEVELS[0].minimum / 1e3)} kA at level I, ${f0(P.LEVELS[1].minimum / 1e3)} kA at II, ${f0(P.LEVELS[2].minimum / 1e3)} kA at III and ${f0(P.LEVELS[3].minimum / 1e3)} kA at IV, which DEHN’s table pairs with the share of strikes above them, ${f0(100 * P.LEVELS[0].above)}%, ${f0(100 * P.LEVELS[1].above)}%, ${f0(100 * P.LEVELS[2].above)}% and ${f0(100 * P.LEVELS[3].above)}%`]: '3 kA at level I, 5 kA at II, 10 kA at III and 16 kA at IV, which DEHN’s table pairs with the share of strikes above them, 99%, 97%, 91% and 84%',
  'r = 10·I^0.65': 'r = 10·I^0.65',
  [`gives ${f1(P.strikeRadiusOf(P.LEVELS[0].minimum))} m, ${f1(P.strikeRadiusOf(P.LEVELS[1].minimum))} m, ${f1(P.strikeRadiusOf(P.LEVELS[2].minimum))} m and ${f1(P.strikeRadiusOf(P.LEVELS[3].minimum))} m, rounded in the standard to rolling spheres of ${f0(P.LEVELS[0].radius)} m, ${f0(P.LEVELS[1].radius)} m, ${f0(P.LEVELS[2].radius)} m and ${f0(P.LEVELS[3].radius)} m`]: 'gives 20.4 m, 28.5 m, 44.7 m and 60.6 m, rounded in the standard to rolling spheres of 20 m, 30 m, 45 m and 60 m',
  [`touches the roof ${f1(P.roofTouchOf(P.LEVELS[0].radius))} m away and a level IV sphere ${f1(P.roofTouchOf(P.LEVELS[3].radius))} m away`]: 'touches the roof 8.7 m away and a level IV sphere 15.4 m away',
}, 'deeper 4');
covered(L.lightningLesson.deeper[4].body, {
  [`about ${f0(P.IET.inductance * 1e6)} µH for every meter and warns that with a rise of perhaps ${f0(P.IET.rises[0] / 1e9)} kA/μs, or up to ${f0(P.IET.rises[1] / 1e9)} kA/μs, ${f0(P.IET.height)} m of conductor can sit ${f0(P.IET.volts[0] / 1e3)} kV, or even ${f0(P.IET.volts[1] / 1e6)} MV, above the wiring beside it`]: 'about 1 µH for every meter and warns that with a rise of perhaps 20 kA/μs, or up to 100 kA/μs, 10 m of conductor can sit 200 kV, or even 1 MV, above the wiring beside it',
  [`takes exactly that, ${f0(P.CONDUCTOR.inductance * 1e6)} μH, which the subsequent stroke’s ${f1(sub.steepest / 1e9)} kA/μs turns into ${f2(sub.gapMax / 1e6)} MV`]: 'takes exactly that, 10 μH, which the subsequent stroke’s 279.0 kA/μs turns into 2.79 MV',
  'μ0/2π·ln(d/r)': 'μ0/2π·ln(d/r)',
  [`the conductor’s ${f0(P.DEHN.diameter / 2 * 1000)} mm radius out to a pipe is ${f2(P.MU_0 / (2 * Math.PI) * Math.log(0.5 / (P.DEHN.diameter / 2)) * 1e6)} µH/m at ${f1(0.5)} m and ${f2(P.MU_0 / (2 * Math.PI) * Math.log(1 / (P.DEHN.diameter / 2)) * 1e6)} µH/m at ${f0(1)} m`]: 'the conductor’s 4 mm radius out to a pipe is 0.97 µH/m at 0.5 m and 1.10 µH/m at 1 m',
  '200 nH/m·ℓ·[ln(2ℓ/r) − 1]': '200 nH/m·ℓ·[ln(2ℓ/r) − 1]',
  [`makes this conductor ${f2(P.PAGES.wire * (Math.log(2 * P.DECLARED.length / (P.DEHN.diameter / 2)) - 1) * 1e6)} µH/m`]: 'makes this conductor 1.50 µH/m',
  [`${f0(P.DECLARED.length)} m of ${f0(P.DEHN.diameter * 1000)} mm copper is ${f2(P.CONDUCTOR.resistance * 1e3)} mΩ, which even ${f0(def.peak / 1e3)} kA turns into ${f2(P.CONDUCTOR.resistance * def.top / 1e3)} kV`]: '10 m of 8 mm copper is 3.34 mΩ, which even 200 kA turns into 0.67 kV',
}, 'deeper 5');
covered(L.lightningLesson.deeper[5].body, {
  's = ki·kc·l/km': 's = ki·kc·l/km',
  [`ki ${P.LEVELS[0].ki} at level I, ${P.LEVELS[1].ki} at level II and ${P.LEVELS[2].ki} at levels III and IV, kc ${f0(P.DEHN.kc)} for a single down conductor, and km ${f0(P.DEHN.air)} for air and ${P.DEHN.solid} for brick or concrete`]: 'ki 0.08 at level I, 0.06 at level II and 0.04 at levels III and IV, kc 1 for a single down conductor, and km 1 for air and 0.5 for brick or concrete',
  [`asks for ${f2(P.lightningPlan({level: 0}).separation)} m, ${f2(P.lightningPlan({level: 1}).separation)} m or ${f2(P.lightningPlan({level: 2}).separation)} m of air`]: 'asks for 0.80 m, 0.60 m or 0.40 m of air',
  [`the standard’s average of ${f0(P.SUBSEQUENT.steepness[0] / 1e9)} kA/μs through ${f0(P.CONDUCTOR.inductance * 1e6)} μH across ${f2(P.lightningPlan({level: 0}).separation)} m is ${f2(P.SUBSEQUENT.steepness[0] * P.CONDUCTOR.inductance / (P.LEVELS[0].ki * P.DECLARED.length) / 1e6)} MV/m, while the function’s own peak of ${f1(sub.steepest / 1e9)} kA/μs across the same gap is ${f2(P.WITHSTAND / 1e6)} MV/m, with air’s ${f0(P.PAGES.air / 1e6)} MV/m in between`]: 'the standard’s average of 200 kA/μs through 10 μH across 0.80 m is 2.50 MV/m, while the function’s own peak of 279.0 kA/μs across the same gap is 3.49 MV/m, with air’s 3 MV/m in between',
  [`takes the ${f2(P.WITHSTAND / 1e6)} MV/m`]: 'takes the 3.49 MV/m',
  [`steep enough for only ${f2(def.gapMax / 1e6)} MV, flashes nothing wider than ${f2(def.threshold)} m`]: 'steep enough for only 0.27 MV, flashes nothing wider than 0.08 m',
}, 'deeper 6');
covered(L.lightningLesson.quiz.explanation, {
  [`rises at ${f1(sub.steepest / 1e9)} kA/μs, and ${f0(P.DECLARED.length)} m of down conductor at ${f0(P.IET.inductance * 1e6)} µH for every meter turns that into ${f2(sub.gapMax / 1e6)} MV`]: 'rises at 279.0 kA/μs, and 10 m of down conductor at 1 µH for every meter turns that into 2.79 MV',
  [`asks for ${f2(P.lightningPlan({level: 0}).separation)} m of air at level I`]: 'asks for 0.80 m of air at level I',
}, 'quiz');
covered(L.lightningLimits, {
  [`one down conductor ${f0(P.DECLARED.length)} m long`]: 'one down conductor 10 m long',
  [`so kc is ${f0(P.DEHN.kc)}`]: 'so kc is 1',
  [`Moore’s semi-ellipsoid ${f0(P.DECLARED.height)} m tall`]: 'Moore’s semi-ellipsoid 2 m tall',
  [`${f0(P.DEHN.diameter * 1000)} mm copper at its resistance at 20 °C`]: '8 mm copper at its resistance at 20 °C',
  [`one rod ${f0(P.DEHN.rod)} m long and ${f0(2 * P.DECLARED.rodRadius * 1000)} mm across`]: 'one rod 9 m long and 20 mm across',
  [`a person ${f0(P.DECLARED.person)} m from the rod`]: 'a person 5 m from the rod',
  [`break down at ${f2(P.WITHSTAND / 1e6)} MV/m`]: 'break down at 3.49 MV/m',
  [`takes ${f0(P.DECLARED.clock.decade)} s for every tenfold in time, from ${f1(P.DECLARED.clock.start * 1e6)} μs to ${f0(P.DECLARED.clock.end * 1e3)} ms`]: 'takes 2 s for every tenfold in time, from 0.1 μs to 5 ms',
}, 'limits');

// The model's own words: the scales, the clock and the readings.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`drawn ${f0(1 / M.timesLarger(M.SCALE.storm / 1000))} times smaller than true size`]: 'drawn 100 times smaller than true size',
  [`the terminal’s tip ${f0(M.timesLarger(M.SCALE.tip))} times larger`]: 'the terminal’s tip 8 times larger',
  [`pipe ${f0(1 / M.timesLarger(M.SCALE.gap / 1000))} times smaller`]: 'pipe 20 times smaller',
  [`takes ${f0(P.DECLARED.clock.decade)} s for every tenfold in time, from ${f1(P.DECLARED.clock.start * 1e6)} μs to ${f0(P.DECLARED.clock.end * 1e3)} ms`]: 'takes 2 s for every tenfold in time, from 0.1 μs to 5 ms',
}, 'system text');
covered(partText('storm'), {
  [`drawn ${f0(1 / M.timesLarger(M.SCALE.storm / 1000))} times smaller than true size`]: 'drawn 100 times smaller than true size',
  [`an air terminal ${f0(P.DECLARED.height)} m tall on a roof ${f0(M.STORM.house[2])} m up, a copper down conductor ${f0(P.DECLARED.length)} m long`]: 'an air terminal 2 m tall on a roof 10 m up, a copper down conductor 10 m long',
  [`an earth rod ${f0(P.DEHN.rod)} m deep`]: 'an earth rod 9 m deep',
  [`full length at ${f0(M.CHART.current.top / 1e3)} kA`]: 'full length at 220 kA',
}, 'storm text');
covered(partText('tip'), {
  [`drawn ${f0(M.timesLarger(M.SCALE.tip))} times larger, in a window ${f0(2 * P.DECLARED.window.half * 1000)} mm wide reaching ${f0(P.DECLARED.window.above * 1000)} mm above the tip`]: 'drawn 8 times larger, in a window 15 mm wide reaching 10 mm above the tip',
  [`one every ${f0(P.DECLARED.spacing)} V`]: 'one every 1,000 V',
  [`within reach of ${f0(P.PAGES.air / 1e6)} MV/m`]: 'within reach of 3 MV/m',
  [`the ${f2(P.CORONA.onset / 1e6)} MV/m that starts a corona`]: 'the 6.79 MV/m that starts a corona',
}, 'tip text');
covered(partText('gap'), {[`drawn ${f0(1 / M.timesLarger(M.SCALE.gap / 1000))} times smaller than true size`]: 'drawn 20 times smaller than true size'}, 'gap text');
covered(partText('chart'), {
  [`takes ${f0(P.DECLARED.clock.decade)} s for every tenfold in time`]: 'takes 2 s for every tenfold in time',
  [`from ${f1(P.DECLARED.clock.start * 1e6)} μs to ${f0(P.DECLARED.clock.end * 1e3)} ms`]: 'from 0.1 μs to 5 ms',
  [`the current, ${f0(M.CHART.current.top / 1e3)} kA at the top with a line every ${f0(M.CHART.current.every / 1e3)} kA`]: 'the current, 220 kA at the top with a line every 50 kA',
  [`from ${f0(M.CHART.volts.low / 1e3)} kV to ${f0(M.CHART.volts.high / 1e6)} MV`]: 'from 1 kV to 100 MV',
}, 'chart text');
covered(partText('earth'), {
  [`to ${f0(P.DECLARED.reach)} m away across the panel`]: 'to 20 m away across the panel',
  [`from ${f0(M.EARTH.low / 1e3)} kV to ${f0(M.EARTH.high / 1e6)} MV`]: 'from 1 kV to 100 MV',
  [`a person ${f0(P.DECLARED.person)} m from the rod`]: 'a person 5 m from the rod',
}, 'earth text');

{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Tip field,Corona,Stroke,Steepness,Down conductor,Earth rise,Step voltage,Side flash,Rolling sphere,Clock,Scales', 'twelve readings, the result first');
  t.ok(find('Tip field').value === '10.41 MV/m' && find('Corona').value === 'on, ionizing 0.62 mm above the tip' && find('Stroke').value === '200 kA peak' && find('Steepness').value === '27.3 kA/μs at most', 'the readings before the strike');
  t.ok(find('Down conductor').value === '0.27 MV at most' && find('Earth rise').value === '2.65 MV at the peak' && find('Step voltage').value === '55 kV at the peak' && find('Side flash').value === 'holds: 0.27 MV/m across 1.00 m' && find('Rolling sphere').value === '20 m' && find('Clock').value === 'before the strike' && find('Scales').value === '100 times smaller', 'and the rest of them');
  checkQuotedText(find('Tip field').hint, {'c/a is 4,000': `c/a is ${f0(def.ratio)}`, 'by 1,041': `by ${f0(def.enhancement)}`, 'passes 6.52 kV/m': `passes ${f2(def.onsetField / 1e3)} kV/m`, '67 V/m for every pascal of air, which at 101,325 Pa is 6.79 MV/m': `${f0(P.CORONA.detach)} V/m for every pascal of air, which at ${f0(P.ATMOSPHERE)} Pa is ${f2(P.CORONA.onset / 1e6)} MV/m`}, t);
  checkQuotedText(find('Corona').hint, {'0.62 mm straight up from the tip and 2.76 mm down its sides': `${f2(def.zone.height * 1000)} mm straight up from the tip and ${f2(Math.abs(def.zone.rows.at(-1).surface[1]) * 1000)} mm down its sides`, 'down to 1.03% of the tip’s': `down to ${f2(100 * def.falloff)}% of the tip’s`}, t);
  checkQuotedText(find('Stroke').hint, {'is 200 kA of 10/350 μs': `is ${f0(def.peak / 1e3)} kA of ${P.FIRST.label}`, 'in 7.98 μs and falls to half in 371 μs, carrying 100.2 C and 10.28 MJ': `in ${f2((def.shape.t90 - def.shape.t10) * 1e6)} μs and falls to half in ${f0(def.shape.half * 1e6)} μs, carrying ${f1(def.charge)} C and ${f2(def.energy / 1e6)} MJ`}, t);
  checkQuotedText(find('Steepness').hint, {'18.59 μs in, at 27.3 kA/μs, where the current itself is only 92 kA': `${f2(def.steepestTime * 1e6)} μs in, at ${f1(def.steepest / 1e9)} kA/μs, where the current itself is only ${f0(def.steepestCurrent / 1e3)} kA`, 'averages 21 kA/μs': `averages ${f0(def.average / 1e9)} kA/μs`}, t);
  checkQuotedText(find('Down conductor').hint, {'about 1 µH for every meter': `about ${f0(P.IET.inductance * 1e6)} µH for every meter`, 'into 0.27 MV': `into ${f2(def.inductiveMax / 1e6)} MV`, 'only 3.34 mΩ, which even 200 kA turns into 0.67 kV': `only ${f2(P.CONDUCTOR.resistance * 1e3)} mΩ, which even ${f0(def.peak / 1e3)} kA turns into ${f2(P.CONDUCTOR.resistance * def.top / 1e3)} kV`}, t);
  checkQuotedText(find('Earth rise').hint, {'13.3 Ω': `${f1(def.earthResistance)} Ω`, 'lifts the whole earth termination 2.65 MV': `lifts the whole earth termination ${f2(def.earthMax / 1e6)} MV`, 'up to 75 Ω·m': `up to ${f0(P.DEHN.earth * 2 * Math.PI * P.DEHN.rod / Math.log(2 * P.DEHN.rod / P.DECLARED.rodRadius))} Ω·m`}, t);
  checkQuotedText(find('Step voltage').hint, {'154 kV 20 m away': `${f0(def.ground.at(-1).volts / 1e3)} kV ${f0(P.DECLARED.reach)} m away`, 'has 55 kV between them': `has ${f0(def.step.volts / 1e3)} kV between them`}, t);
  checkQuotedText(find('Side flash').hint, {'0.08 × 1 × 10 m / 1 = 0.80 m': `${f2(P.LEVELS[0].ki)} × ${f0(P.DEHN.kc)} × ${f0(P.DECLARED.length)} m / ${f0(P.DEHN.air)} = ${f2(def.separation)} m`, 'flashes anything under 0.08 m': `flashes anything under ${f2(def.threshold)} m`}, t);
  checkQuotedText(find('Rolling sphere').hint, {'strikes of 3 kA and up, which is 99% of them': `strikes of ${f0(P.LEVELS[0].minimum / 1e3)} kA and up, which is ${f0(100 * P.LEVELS[0].above)}% of them`, 'makes that 20.4 m': `makes that ${f1(def.strikeRadius)} m`, 'touches the roof 8.7 m away': `touches the roof ${f1(def.roofTouch)} m away`}, t);
  checkQuotedText(find('Clock').hint, {'takes 9.4 s to watch': `takes ${f1(P.RUN)} s to watch`, 'peak comes 31.43 μs in': `peak comes ${f2(def.peakTime * 1e6)} μs in`}, t);
  model.update({field: 0, tip: 25, stroke: 1, gap: 0.1, soil: 1000, level: 3});
  const off = model.getState().readings, offFind = label => off.find(item => item.label === label);
  t.ok(offFind('Corona').value === 'off' && offFind('Tip field').value === '0.00 MV/m' && offFind('Side flash').value.startsWith('flashes'), 'with no storm field there is no corona, and a gap of a tenth of a meter is named as one that flashes');
  t.ok(offFind('Rolling sphere').value === '60 m' && offFind('Earth rise').value === '3.31 MV at the peak', 'level IV’s sphere and dry ground’s rise');
  model.reset();
  model.update({stroke: 1, gap: 0.75});
  model.advance(P.RUN);
  const flashed = model.getState().readings;
  t.ok(flashed.find(item => item.label === 'Side flash').value === 'flashes 0.42 μs in' && flashed.find(item => item.label === 'Your result').value.startsWith('Side flash · the gap broke down 0.42 μs in'), 'a flashed gap says so in the result');
}

{
  model.reset();
  const ready = model.getState().readings[0].value;
  t.ok(ready.startsWith('Ready · the tip stands at 10.41 MV/m') && ready.includes(`past the ${f2(P.CORONA.onset / 1e6)} MV/m`), 'before Play the result says the tip stands past what a corona takes');
  model.update({tip: 25});
  t.ok(model.getState().readings[0].value.includes(`short of the ${f2(P.CORONA.onset / 1e6)} MV/m`), 'and short of it once the tip is rounded off');
  model.reset();
  model.advance(P.clockOfTime(def.steepestTime));
  const mid = model.getState(), midFind = label => mid.readings.find(item => item.label === label);
  t.near(mid.t, def.steepestTime, relative(def.steepestTime, 1e-9), 'the clock wound to the steepest rise');
  t.ok(midFind('Steepness').value === `${f1(def.steepest / 1e9)} kA/μs now`, 'the steepness reading follows the rise while the strike runs');
  t.ok(midFind('Stroke').value === `${f1(mid.now.current / 1e3)} kA now` && midFind('Down conductor').value === `${M.signed(mid.now.gap / 1e6, 2)} MV now`, 'and the stroke and the conductor’s voltage with it');
  t.ok(midFind('Clock').value === M.timeText(mid.t), 'the clock reading says where it stands');
  checkQuotedText(midFind('Clock').hint, {[`running ${f0(2 / (Math.LN10 * mid.t))} times slower than the strike`]: `running ${f0(2 / (Math.LN10 * mid.t))} times slower than the strike`}, t);
  model.reset();
  model.advance(P.RUN * 3);
  t.near(model.getState().clock, P.RUN, 1e-12, 'and the clock stops at the end of the run, however long Play is left on');
  model.reset();
}
for (const lesson of [L.lightningLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, 'a quiz with three options and its answer first');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part named is a part the model has');
  t.ok(lesson.steps.length === 5 && lesson.deeper.length === 6 && lesson.tryIt.length === 7 && lesson.parts.length === 6, 'five steps, six deeper sections, seven trials and six parts');
}
t.ok(safetyLessons['Lightning conductor'] === L.lightningLesson, 'the safety corner routes to this lesson');
t.ok(Object.values(houseComponents).every(component => component.machine !== 'Lightning conductor'), 'and no component page hangs off it');
{
  const routed = createSafetyModel('Lightning conductor');
  t.ok(routed !== null && routed.controls.map(control => control.key).join() === 'field,tip,level,stroke,soil,gap', 'the safety corner builds this model and no other');
  routed?.dispose();
  t.ok(previewEntryIds.includes('lightning-conductor'), 'and the preview shows it');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) {
  const [lo, hi, step] = P.LIGHTNING_DOMAINS[control.key];
  t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.LIGHTNING_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`);
}
t.ok(model.controls.map(control => control.key).join() === 'field,tip,level,stroke,soil,gap', 'six controls');
assert.deepEqual(model.controls.find(control => control.key === 'level').options.map(option => [option.value, option.label]), P.LEVEL_OPTIONS.map(option => [option.value, option.label]));
assert.deepEqual(model.controls.find(control => control.key === 'stroke').options.map(option => [option.value, option.label]), P.STROKE_OPTIONS.map(option => [option.value, option.label]));
const drawing = () => [pointsOf(T.currentGuide).slice(0, 10), pointsOf(T.equipotentials).slice(0, 10), pointsOf(T.gapMark), pointsOf(T.gapBracket), pointsOf(T.earthCurveGuide).slice(0, 8), pointsOf(T.sphereArc).slice(0, 6), T.pipeBar.position.toArray(), T.fieldArrows[0].userData.length, Array.from(T.zoneFill.geometry.attributes.position.array.slice(0, 12)), pointsOf(T.withstandLine)];
checkControlsMove(model, drawing, item => item.advance(3), t);
checkRefusals(P.sampleLightning, P.LIGHTNING_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the strike');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().t, P.timeOfClock(0.5), relative(P.timeOfClock(0.5), 1e-12), 'a step of half a second winds the clock a quarter of a decade');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().t, P.timeOfClock(1), relative(P.timeOfClock(1), 1e-12), 'animation winds it on by the time that passed');
  model.advance(P.RUN);
  t.ok(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'chart', 'the strike over, with the charts to inspect');
  t.ok(model.playback.blocked() === false && typeof model.playback.stepLabel === 'string', 'a transport the viewer can drive');

  {
    const named = /([\d.]+) s/.exec(model.playback.stepLabel);
    t.ok(named !== null, 'the step button names the seconds it advances');
    model.reset();
    model.playback.step();
    t.near(model.getState().clock, Number(named[1]), 1e-12, 'and advances exactly that many');
    model.advance(P.RUN);
  }
  assert.deepEqual(model.actions.map(action => action.part), ['tip', 'chart', 'gap', 'earth', 'storm']);
  assert.deepEqual(model.actions.map(action => action.label), ['Inspect: the point before the strike', 'Inspect: the steepest rise', 'Inspect: the gap', 'Inspect: the ground at the peak', 'Inspect: the whole installation']);
  t.ok(model.frameVisibleOnly === true && model.framePadding === 0.62 && model.initialPart === 'system' && model.initialView === 'front' && model.selectionOutline === false && model.transparentBackground === true, 'the viewer frames what is shown, opening on the whole system from the front');
  const held = JSON.stringify([pointsOf(T.currentCurve).length, T.currentArrow.userData.length]);
  model.animate(30);
  model.advance(50);
  t.ok(JSON.stringify([pointsOf(T.currentCurve).length, T.currentArrow.userData.length]) === held, 'and nothing moves past the end');
  checkFinite(model.root, t);
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part) && action.view === 'front', `${action.label} returns readings and names a part`);
    checkFinite(model.root, t);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  for (const values of settings) {
    for (const seconds of [0, 3, P.RUN]) {
      model.reset();
      model.update(values);
      model.advance(seconds);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')) && !/\b(centre|colour|grey|metre|aluminium)\b/i.test(item.hint || ''), `reading text without dashes: ${item.label}`);
      t.ok(!/-\d/.test(readings.map(item => item.value).join(' ')), 'negative readings with a true minus sign');
      checkFinite(model.root, t);
    }
  }
}
const released = checkDisposal((() => { const fresh = M.createLightningConductorModel(); fresh.advance(3); return fresh; })(), t);
model.dispose();

console.log(`PASS lightning conductor: ${t.count} checks, ${counts.poses} poses, ${counts.points} drawn points read back, ${counts.potentials} potentials rebuilt from a line charge, ${counts.quadrature} quadrature points, ${counts.steps} steps scanned, ${counts.numbers} quoted numbers traced, 1 lesson, ${released} resources released exactly once.`);

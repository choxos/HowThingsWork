// Checks the smoke detector model and its ionization and optical lessons
// against their sources typed in again and their physics worked out by other
// routes: ASTAR’s ranges rebuilt by integrating the reciprocal stopping power,
// an alpha’s energy loss integrated again with Runge-Kutta, the ion pairs a
// chamber takes found again by Monte Carlo over the directions an alpha can
// leave in, the chamber’s ion balance checked as a balance and against its
// saturation and Hosemann limits, the node voltage found again by a charge
// balance in time, Mie scattering checked against Rayleigh’s limit, against
// its own angular integral and against the extinction paradox, the smoke
// entering a chamber integrated again, and both comparators' schedules
// stepped; then every drawn plate, track, dot, curve and gauge read back.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './smoke-physics.js';
import * as M from './smoke-model.js';
import * as L from './smoke-lessons.js';
import {houseComponents} from './house-components.js';
import {safetyLessons} from './safety-lessons.js';

const t = tally();
const counts = {rows: 0, alphas: 0, steps: 0, angles: 0, dots: 0, poses: 0, points: 0, numbers: 0};
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  e: 1.602176634e-19, k: 1.380649e-23, pairEnergy: 33.97, airDensity: 1.2041, mobility: 1.5e-4, goldDensity: 19.3, foot: 0.3048,
  americium: {halfLife: 432.6, specific: 126.91, mass: 0.29, activity: 37, gamma: 59.5409, gammaShare: 0.36, diameter: 5.1, thickness: 0.2, cover: 1, aged: [[19, 3], [32, 5]]},
  lines: [[5.486, 85], [5.443, 13], [5.388, 2]],
  astarAir: [[5.486, 713.5, 5.028e-3], [1, 1924, 6.698e-4], [0.1, 1031, 1.665e-4], [8, 545.6, 9.1e-3]],
  astarGold: [[5.486, 223.6, 1.965e-2], [1, 389.5, 3.974e-3], [0.1, 168.3, 1.193e-3], [8, 185.6, 3.207e-2]],
  ion: {set: 50, hysteresis: 100, low: [7.2, 7.8], supply: [6, 12], period: 1.67, smoke: 40, setWindow: [47, 53], hornOn: 160, hornOff: 80, battery: 40, chirp: 10, leak: 1, guard: 100, draw: 5, load: 10},
  photo: {period: 10.7, one: 2, two: 1, needed: 3, pulse: 100, ired: [50, 200], full: 58, steps: 31, chamber: 43, iredAt: 100, chirp: 10, pulseWindow: [100, 400]},
  led: {wavelength: 940, intensity: 72, power: 40, half: 17, forward: 1.35},
  diode: {area: 7.5, current: 50, irradiance: 1, wavelength: 950, half: 65, dark: 2},
  alarm: {disk: 125, thick: 25, tone: [2900, 3500], loud: 95, at: 3, battery: [48.5, 26.5, 17.5]},
  smoke: {flaming: [0.01, 0.3], smoldering: [0.3, 10], ionRating: [0.8, 1.5], photoRating: [0.2, 4]},
  nist: {ionization: [2.6, 4.3, 5.9], photoelectric: [3.3, 6.6, 9.8], listedIon: [4.13, 4.23], listedPhoto: 6.76, average: 5.1, band: 1, flaming: [57, 62], smoldering: [47, 53]},
  mic: {volts: 18, flow: 30, clean: 95, band: 5, rows: [[1, 85.2], [1.3, 77.1], [2.4, 68.3], [2.9, 63.5]]},
  impactor: [['Flaming chair', 0.32, 4, 78.3], ['Cooking oil', 1, 2.5, 41.3], ['Smoldering chair', 2.3, 1.7, 11.5]],
  parts: {ion: 'MC14467-1', photo: 'RE46C190', led: 'TSAL6200', diode: 'BPW34'},
  notes: {smoke: 973, alarms: 1455, study: 2004},
};

t.ok(P.ELEMENTARY === SRC.e && P.BOLTZMANN === SRC.k && P.PAIR_ENERGY === SRC.pairEnergy && P.FOOT === SRC.foot, 'the exact elementary charge and Boltzmann constant, 33.97 eV for an ion pair in dry air, and a foot');
t.ok(P.AIR.density === SRC.airDensity && P.AIR.mobility === SRC.mobility && P.GOLD_DENSITY === SRC.goldDensity, 'dry air at 1.2041 kg/m³, its ions at 1.5 × 10⁻⁴ m²/(V·s), and gold at 19.3 g/cm³');
t.ok(P.AMERICIUM.halfLife === SRC.americium.halfLife && P.AMERICIUM.specific === SRC.americium.specific * 1e9 && P.AMERICIUM.activity === SRC.americium.activity * 1e3, 'americium-241: 432.6 years, 126.91 GBq/g, and 37 kBq in a detector');
t.near(P.AMERICIUM.mass * 1e6, SRC.americium.mass, 1e-12, '0.29 μg of it');
t.near(P.AMERICIUM.mass * P.AMERICIUM.specific, SRC.americium.activity * 1e3, 0.01 * SRC.americium.activity * 1e3, 'the mass and the specific activity agree with the 37 kBq to within a percent');
t.ok(P.AMERICIUM.diameter === SRC.americium.diameter && P.AMERICIUM.thickness === SRC.americium.thickness && P.AMERICIUM.coverShare * 100 === SRC.americium.cover && P.AMERICIUM.gamma === SRC.americium.gamma && P.AMERICIUM.gammaShare === SRC.americium.gammaShare, 'a disc 5.1 mm across and 0.2 mm thick, its gold cover one percent of that, and a 59.5409 keV gamma in 36% of the decays');
assert.deepEqual(P.LINES.map(([energy, share]) => [energy, Math.round(share * 100)]), SRC.lines, 'the three alpha energies and their shares');
t.near(P.LINES.reduce((sum, [, share]) => sum + share, 0), 1, 1e-12, 'the shares add to one');
t.near(P.CHAMBER.cover, P.AMERICIUM.thickness * P.AMERICIUM.coverShare * 1000, 1e-12, 'the gold cover drawn is that one percent, in micrometers');
assert.deepEqual(P.AMERICIUM.aged.map(row => [...row]), SRC.americium.aged, 'the americium is 3% neptunium after 19 years and 5% after 32');
t.ok(P.IONIZATION_IC.name === SRC.parts.ion && P.PHOTO_IC.name === SRC.parts.photo && P.EMITTER.name === SRC.parts.led && P.DIODE.name === SRC.parts.diode, 'the four parts named: the MC14467-1, the RE46C190, the TSAL6200 and the BPW34');
t.ok(P.SMOKE.samples === 121 && P.SMOKE.duration / (P.SMOKE.samples - 1) === 5, 'the run charted at 121 points, one every 5 s');
assert.deepEqual([...P.SMOKE_DOMAINS.size], [0.1, 3, 0.1], 'the sizes offered, 0.1 to 3 μm');
assert.deepEqual([...P.SMOKE_DOMAINS.growth], [1, 50, 1], 'the growth offered, 1 to 50 mg/m³ a minute');
assert.deepEqual([...P.SMOKE_DOMAINS.battery], [6.5, 9.5, 0.1], 'the battery offered, 6.5 to 9.5 V');
assert.deepEqual([...P.SMOKE_DOMAINS.angle], [15, 165, 1], 'the angles offered, 15° to 165°');
t.ok(P.OUTWARD === P.AMERICIUM.activity / 2 && P.CHAMBER.share === 1 / 4, 'half the alphas leave the gold face, and a quarter of all of them go into each half chamber');
t.near(P.astarAt(P.ASTAR_AIR, P.ASTAR_AIR[0][0] / 2, 2), P.ASTAR_AIR[0][2] / 2, 1e-18, 'below the table a range falls off with the energy');
t.ok(P.astarAt(P.ASTAR_AIR, P.ASTAR_AIR[0][0] / 2, 1) === P.ASTAR_AIR[0][1], 'while the stopping power holds at the first row');
t.near(P.energyAt(P.ASTAR_AIR, P.ASTAR_AIR[0][2] / 2), P.ASTAR_AIR[0][0] / 2, 1e-18, 'and half that range is half that energy');
// Mie against the same series carried far past where the model stops it: 8 x^(1/3) + 40 terms,
// from 80 past the largest, worked out separately, so a shorter expansion shows up here.
for (const [diameter, efficiency, at21, at45, at90] of [
  [0.1, 0.0028968033448050546, 0.0002384466145596849, 0.00018921637418649367, 0.00012127995097235193],
  [0.3, 0.21711650118588083, 0.22823363146660197, 0.16827914331486743, 0.0786851424526849],
  [1, 3.7545237270788685, 170.14574930388406, 29.448056090787745, 3.4670684584869464],
  [3, 2.8541598809900885, 193.0138298831916, 52.95670256661953, 19.725155969220893],
]) {
  const size = Math.PI * diameter * 1e-6 / P.EMITTER.wavelength, degrees = [21, 45, 90];
  const answer = P.mie(size, P.OPTICS.index, degrees.map(angle => angle * Math.PI / 180));
  t.near(answer.qext, efficiency, relative(efficiency, 1e-9), `${diameter} μm: the extinction efficiency the converged series gives`);
  t.near(answer.qsca, efficiency, relative(efficiency, 1e-9), `${diameter} μm: and the scattering efficiency, the same for a sphere that absorbs nothing`);
  [at21, at45, at90].forEach((expected, i) => t.near(answer.intensity[i], expected, relative(expected, 1e-9), `${diameter} μm at ${degrees[i]}°: the intensity it scatters`));
}

for (const [table, rows, name] of [[P.ASTAR_AIR, SRC.astarAir, 'air'], [P.ASTAR_GOLD, SRC.astarGold, 'gold']]) {
  for (const [energy, stopping, range] of rows) {
    const row = table.find(item => item[0] === energy);
    t.ok(row && row[1] === stopping && row[2] === range, `ASTAR for ${name} at ${energy} MeV: ${stopping} MeV cm²/g and ${range} g/cm²`);
  }
  t.ok(table.length === 75 && table[0][0] === 0.001 && table[table.length - 1][0] === 8, `${name}: the table from 1 keV to 8 MeV`);
  t.ok(table.every((row, i) => i === 0 || (row[0] > table[i - 1][0] && row[2] > table[i - 1][2])), `${name}: energies and ranges both climbing`);
  // The Stopping power page: the range is the integral of the reciprocal
  // stopping power. The ranges are tabulated to four figures, so each row’s
  // step carries the rounding of both of its ends.
  const ulp = value => 10 ** (Math.floor(Math.log10(value)) - 3);
  const integrate1 = (low, high, steps = 40) => {
    const h = (high - low) / steps;
    let sum = 0;
    for (let j = 0; j <= steps; j++) sum += (j === 0 || j === steps ? 1 : j % 2 ? 4 : 2) / P.astarAt(table, low + j * h, 1);
    return sum * h / 3;
  };
  let running = 0;
  const from = table.findIndex(row => row[0] === 0.1);
  for (let i = 1; i < table.length; i++) {
    const [low] = table[i - 1], [high] = table[i], integral = integrate1(low, high);
    t.near(table[i][2] - table[i - 1][2], integral, 0.01 * integral + ulp(table[i][2]) + ulp(table[i - 1][2]), `${name}: the range from ${low} to ${high} MeV by integrating 1/S`);
    if (i > from) {
      running += integral;
      const climbed = table[i][2] - table[from][2];
      t.near(climbed, running, 0.01 * climbed, `${name}: and the whole way from 0.1 to ${high} MeV`);
    }
    counts.rows++;
  }
}
for (const energy of [0.05, 0.5, 2.087, 4.587, 5.486]) {
  t.near(P.energyAt(P.ASTAR_AIR, P.astarAt(P.ASTAR_AIR, energy, 2)), energy, relative(energy, 1e-9), `air: the range at ${energy} MeV leads back to it`);
  t.near(P.airEnergy(P.airRange(energy)), energy, relative(energy, 1e-9), 'and in centimeters');
}

// An alpha through gold and through air, integrated again with Runge-Kutta.
function integrate(table, density, energy, distance, steps = 4000) {
  const h = distance / steps, slope = value => (value > 0 ? -density * P.astarAt(table, value, 1) : 0);
  let left = energy;
  for (let i = 0; i < steps && left > 0; i++) {
    const k1 = slope(left), k2 = slope(left + h / 2 * k1), k3 = slope(left + h / 2 * k2), k4 = slope(left + h * k3);
    left = Math.max(0, left + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4));
    counts.steps++;
  }
  return left;
}
for (const microns of [1, 2, 6.6]) {
  const stepped = integrate(P.ASTAR_GOLD, SRC.goldDensity, 5.486, microns * 1e-4);
  t.near(P.afterGold(5.486, microns), stepped, 0.01 * stepped, `${microns} μm of gold: the energy left, integrated again`);
}
for (const centimeters of [0.5, 1.5, 3]) {
  const start = P.afterGold(5.486, 2), stepped = integrate(P.ASTAR_AIR, SRC.airDensity * 1e-3, start, centimeters);
  t.near(P.airEnergyAfter(start, centimeters * 10), stepped, 0.02 * stepped + 2e-3, `${centimeters} cm of air: the energy left, integrated again`);
}
t.ok(f1(P.airRange(5.486) * 10) === '41.8' && f3(P.afterGold(5.486, 2)) === '4.587' && f1(P.airRange(P.afterGold(5.486, 2)) * 10) === '31.9' && f1(P.goldRange(5.486) * 1e4) === '10.2', '41.8 mm in air, 4.587 MeV and 31.9 mm after 2 μm of gold, and 10.2 μm of gold to stop one');
t.ok(f3(P.afterGold(5.486, 6.6)) === '2.087' && f1(P.airRange(P.afterGold(5.486, 6.6)) * 10) === '11.2', 'and 2.087 MeV, 11.2 mm, after the 6.6 μm Technical Note 973 describes');
t.ok(P.airRange(5.486) * 10 < 45 && P.airRange(5.486) * 10 > 35, 'the Alpha particle page: a few centimeters of air');
t.ok(f0(P.afterGold(5.486, 2) * 1e6 / SRC.pairEnergy) === '135,028', 'an alpha stopping in air leaves 135,028 pairs');

// The pairs a chamber takes, found again by Monte Carlo over directions, with
// the energy along each track integrated rather than read from the ranges.
function montePairs(gap, radius, samples = 4000, seed = 7) {
  let state = seed >>> 0;
  const next = () => { state = (state * 1103515245 + 12345) >>> 0; return (state >>> 8) / 16777216; };
  let total = 0;
  for (const [energy, share] of P.LINES) {
    let deposit = 0;
    for (let i = 0; i < samples; i++) {
      const mu = next(), sine = Math.sqrt(1 - mu * mu);
      const start = integrate(P.ASTAR_GOLD, SRC.goldDensity, energy, P.CHAMBER.cover * 1e-4 / mu, 200);
      if (start <= 0) continue;
      const reach = Math.min(gap / 10 / mu, radius / 10 / Math.max(sine, 1e-9), P.airRange(start));
      deposit += start - integrate(P.ASTAR_AIR, SRC.airDensity * 1e-3, start, reach, 400);
      counts.alphas++;
    }
    total += share * deposit / samples;
  }
  return total / (SRC.pairEnergy * 1e-6);
}
for (const [gap, radius] of [[P.CHAMBER.sensing, P.CHAMBER.radius], [P.CHAMBER.reference, P.CHAMBER.radius], [8, 6]]) {
  const monte = montePairs(gap, radius);
  t.near(P.pairsPerAlpha(gap, radius), monte, 0.02 * monte, `a chamber ${gap} mm by ${radius} mm: the pairs one decay leaves, by Monte Carlo`);
}
t.ok(f0(P.SENSING.pairs) === '39,687' && f0(P.REFERENCE.pairs) === '45,449' && P.REFERENCE.pairs > P.SENSING.pairs, 'the open half takes 39,687 pairs a decay and the taller sealed half 45,449');
t.ok(P.CHAMBER.sensing < P.airRange(P.afterGold(5.486, P.CHAMBER.cover)) * 10 && P.CHAMBER.reference < P.airRange(P.afterGold(5.486, P.CHAMBER.cover)) * 10, 'both gaps are shorter than the alpha can travel, so both chambers are bipolar');
for (const chamber of [P.SENSING, P.REFERENCE]) {
  t.near(chamber.rate, P.AMERICIUM.activity * P.CHAMBER.share * chamber.pairs, relative(chamber.rate, 1e-12), 'a quarter of the decays into each half');
  t.near(chamber.volume, Math.PI * chamber.radius ** 2 * chamber.gap / 2, relative(chamber.volume, 1e-12), 'half a cylinder');
  t.near(chamber.saturation, SRC.e * chamber.rate, relative(chamber.saturation, 1e-12), 'the saturation current is one charge for every pair a second');
  t.near(chamber.q, chamber.rate / chamber.volume, relative(chamber.q, 1e-12), 'pairs in every cubic meter a second');
}
t.ok(f1(P.SENSING.saturation * 1e12) === '58.8' && f1(P.REFERENCE.saturation * 1e12) === '67.4', 'saturation currents of 58.8 pA and 67.4 pA');

// The ion balance: a balance, and its two limits.
for (const chamber of [P.SENSING, P.REFERENCE]) {
  for (const volts of [0.5, 3.06, 6, 9]) {
    for (const capture of [0, 5, 40]) {
      const n = P.ionDensity(chamber, volts, capture), sweep = P.sweepRate(chamber, volts);
      t.near(P.CHAMBER.recombination * n * n + (sweep + capture) * n, chamber.q, relative(chamber.q, 1e-9), 'what the alphas make is what recombination, the sweep and the smoke take away');
      t.near(P.chamberCurrent(chamber, volts, capture), SRC.e * chamber.volume * n * sweep, relative(chamber.saturation, 1e-9), 'and the current is the share swept out');
      t.ok(P.chamberCurrent(chamber, volts, capture) < chamber.saturation, 'always under the saturation current');
    }
    t.near(P.sweepRate(chamber, volts), 2 * SRC.mobility * volts / chamber.gap ** 2, relative(1, 1e-12), 'both ions cross half the gap on average');
  }
  t.near(P.chamberCurrent(chamber, 1e9) / chamber.saturation, 1, 1e-6, 'a huge voltage collects every pair');
  const small = 1e-6, ohmic = SRC.e * chamber.volume * Math.sqrt(chamber.q / P.CHAMBER.recombination) * P.sweepRate(chamber, small);
  t.near(P.chamberCurrent(chamber, small), ohmic, relative(ohmic, 1e-5), 'a tiny voltage leaves recombination in charge, and the chamber is a resistor');
}
// Hosemann’s signal, at a voltage low enough for recombination to rule.
for (const diameter of [0.1, 0.3, 1, 3]) {
  const particle = P.particleOf(diameter, 21), number = P.extinctionOf(2) / particle.extinction, capture = number * particle.capture;
  const volts = 1e-6, clean = P.chamberCurrent(P.SENSING, volts), dirty = P.chamberCurrent(P.SENSING, volts, capture);
  const hosemann = capture / Math.sqrt(P.CHAMBER.recombination * P.SENSING.q);
  t.near(clean / dirty - dirty / clean, hosemann, relative(hosemann, 1e-5), `${diameter} μm: the signal is Nd times the capture coefficient over the square root of αq`);
  t.near(particle.capture, 4 * Math.PI * P.DIFFUSION * (diameter * 1e-6 / 2), relative(particle.capture, 1e-12), 'the diffusion limit 4πDR');
}
t.near(P.DIFFUSION, SRC.mobility * SRC.k * P.AIR.temperature / SRC.e, relative(P.DIFFUSION, 1e-12), 'the Einstein relation D = μkT/e');
t.ok(P.AIR.temperature === 293.15, 'at 20 °C, where the air density is given');

// The node between the two halves, found again by letting charge settle on it.
function settle(supply, capture) {
  let volts = supply / 2;
  for (let i = 0; i < 400000; i++) {
    const flow = P.chamberCurrent(P.REFERENCE, supply - volts) - P.chamberCurrent(P.SENSING, volts, capture);
    volts += flow / 2e-12 * 1e-3;
    if (volts < 0) volts = 0;
    if (volts > supply) volts = supply;
  }
  return volts;
}
for (const [supply, capture] of [[9, 0], [9, 2], [6.5, 0], [9.5, 8]]) {
  t.near(P.nodeVolts(supply, capture), settle(supply, capture), 1e-6, `${supply} V with capture ${capture}: the node found again by settling charge onto it`);
  t.near(P.chamberCurrent(P.REFERENCE, supply - P.nodeVolts(supply, capture)), P.chamberCurrent(P.SENSING, P.nodeVolts(supply, capture), capture), 1e-18, 'the two halves carry the same current');
}

// Mie scattering: Rayleigh’s limit, its own angular integral, and the paradox.
const wave = 2 * Math.PI / P.EMITTER.wavelength;
for (const x of [0.005, 0.01, 0.02]) {
  const {qsca, qext, intensity} = P.mie(x, P.OPTICS.index, [Math.PI / 2, 0]);
  const factor = ((P.OPTICS.index ** 2 - 1) / (P.OPTICS.index ** 2 + 2)) ** 2;
  t.near(qsca, 8 / 3 * x ** 4 * factor, 0.02 * qsca, `x = ${x}: the Rayleigh page’s scattering cross section`);
  t.near(qext, qsca, relative(qsca, 1e-6), 'a real refractive index absorbs nothing');
  // Rayleigh for unpolarized light: k⁴r⁶ times the index factor times (1 + cos²θ)/2.
  const radius = x / wave, rayleigh = wave ** 4 * radius ** 6 * factor;
  t.near(intensity[0] / (2 * wave * wave), rayleigh / 2, 0.03 * rayleigh / 2, 'and Rayleigh sideways, half of k⁴r⁶ times the index factor');
  t.near(intensity[1] / (2 * wave * wave), rayleigh, 0.03 * rayleigh, 'twice as much straight on');
}
for (const diameter of [0.1, 0.3, 1, 3]) {
  const x = Math.PI * diameter * 1e-6 / P.EMITTER.wavelength, steps = 2000;
  const angles = Array.from({length: steps + 1}, (_, i) => Math.PI * i / steps);
  const {qsca, qext, intensity} = P.mie(x, P.OPTICS.index, angles);
  let sum = 0;
  for (let i = 0; i <= steps; i++) sum += (i === 0 || i === steps ? 1 : i % 2 ? 4 : 2) * intensity[i] / (2 * wave * wave) * Math.sin(angles[i]);
  const integral = 2 * Math.PI * sum * (Math.PI / steps) / 3, area = Math.PI * (diameter * 1e-6 / 2) ** 2;
  t.near(integral, qsca * area, 0.01 * qsca * area, `${diameter} μm: what it scatters in every direction adds up to its scattering cross section`);
  t.near(qext, qsca, relative(qsca, 1e-6), 'and it absorbs nothing');
  counts.angles += steps;
}
t.near(P.mie(400, P.OPTICS.index, [0]).qext, 2, 0.06, 'a sphere far larger than the wavelength takes twice its own area out of the beam');
for (const [diameter, expected] of [[0.1, '0.003'], [0.3, '0.217'], [1, '3.755'], [3, '2.854']]) t.ok(f3(P.particleOf(diameter, 21).qext) === expected, `${diameter} μm: an extinction efficiency of ${expected}`);
for (const diameter of [0.1, 0.3, 1, 3]) {
  const particle = P.particleOf(diameter, 21);
  t.near(particle.mass, P.SMOKE.density * Math.PI * (diameter * 1e-6) ** 3 / 6, relative(particle.mass, 1e-12), 'a sphere of unit density');
  t.near(particle.extinction, particle.qext * Math.PI * (diameter * 1e-6 / 2) ** 2, relative(particle.extinction, 1e-12), 'the cross section its efficiency stands for');
}

// Beer and Lambert, and NIST’s obscuration.
for (const percent of [1, 4.3, 6.6, 20]) {
  const extinction = P.extinctionOf(percent);
  t.near(P.obscurationMeter(extinction), percent, 1e-9, `${percent}% a meter and back`);
  t.near(P.obscurationFoot(extinction), (1 - Math.exp(-extinction * SRC.foot)) * 100, 1e-12, 'and per foot, as Technical Note 1455 writes it');
  t.near(P.transmission(extinction, 1), 1 - percent / 100, 1e-12, 'what the beam keeps over a meter');
  for (const meters of [0.03, 10]) t.near(P.transmission(extinction, meters), Math.exp(-extinction * meters), relative(1, 1e-12), 'and over any path');
}
t.ok(f2(P.obscurationFoot(P.extinctionOf(4.3))) === '1.33' && f2(P.obscurationFoot(P.extinctionOf(6.6))) === '2.06', 'NIST’s 4.3%/m and 6.6%/m are 1.33 and 2.06 %/ft, beside the 1.3 and 2.0 its table gives');

// The photodiode’s current, rebuilt from the geometry.
for (const diameter of [0.3, 3]) {
  for (const angle of [21, 90]) {
    const particle = P.particleOf(diameter, angle), number = P.extinctionOf(5) / particle.extinction;
    const source = P.OPTICS.source / 1000, sensor = P.OPTICS.sensor / 1000, volume = Math.PI * (P.OPTICS.beam / 2000) ** 2 * (P.OPTICS.length / 1000);
    const irradiance = P.EMITTER.intensity / source ** 2, scattered = number * volume * particle.differential * irradiance;
    const caught = scattered * P.DIODE.area / sensor ** 2 * Math.exp(-number * particle.extinction * (source + sensor));
    t.near(P.scatteredCurrent(particle, number), caught * P.RESPONSIVITY, relative(caught * P.RESPONSIVITY, 1e-12), `${diameter} μm at ${angle}°: the photodiode’s current from the geometry`);
  }
}
t.near(P.RESPONSIVITY, SRC.diode.current * 1e-6 / (SRC.diode.irradiance * 10 * SRC.diode.area * 1e-6), relative(P.RESPONSIVITY, 1e-12), 'the BPW34: 50 μA in 1 mW/cm² over 7.5 mm²');
t.ok(f3(P.RESPONSIVITY) === '0.667', 'a responsivity of 0.667 A/W');
t.ok(P.EMITTER.wavelength * 1e9 === SRC.led.wavelength && P.EMITTER.intensity * 1000 === SRC.led.intensity && P.EMITTER.half === SRC.led.half && P.EMITTER.power * 1000 === SRC.led.power && P.EMITTER.forward === SRC.led.forward, 'the TSAL6200: 940 nm, 72 mW/sr at 100 mA, a half angle of 17° and 1.35 V');
t.ok(P.DIODE.area * 1e6 === SRC.diode.area && P.DIODE.current * 1e6 === SRC.diode.current && P.DIODE.half === SRC.diode.half && P.DIODE.dark * 1e9 === SRC.diode.dark, 'the BPW34: 7.5 mm², 50 μA, ± 65° and 2 nA of dark current');
t.near(P.beamCurrent(P.particleOf(0.3, 21), 0), P.RESPONSIVITY * P.EMITTER.intensity / (P.OPTICS.direct / 1000) ** 2 * P.DIODE.area, relative(1e-6, 1e-9), 'and straight down the beam, an inverse square from the emitter');
t.ok(f0(P.beamCurrent(P.particleOf(0.3, 21), 0) * 1e6) === '400', 'which is 400 μA in clean air');

// The ICs, typed in again, and the schedules stepped.
t.ok(P.IONIZATION_IC.set * 100 === SRC.ion.set && P.IONIZATION_IC.hysteresis * 1000 === SRC.ion.hysteresis && P.IONIZATION_IC.period === SRC.ion.period && P.IONIZATION_IC.smokePeriod * 1000 === SRC.ion.smoke, 'the MC14467-1: a set point at 50% of the supply, 100 mV of hysteresis, 1.67 s between looks and 40 ms in smoke');
t.ok(P.IONIZATION_IC.hornOn * 1000 === SRC.ion.hornOn && P.IONIZATION_IC.hornOff * 1000 === SRC.ion.hornOff && P.IONIZATION_IC.batteryEvery === SRC.ion.battery && P.IONIZATION_IC.chirp * 1000 === SRC.ion.chirp && P.IONIZATION_IC.leak * 1e12 === SRC.ion.leak && P.IONIZATION_IC.guard * 1000 === SRC.ion.guard, 'its horn, its battery check every 40 s, its 10 ms chirp, its 1 pA of input leakage and its guard within 100 mV');
t.ok(P.CHAMBER.lowBattery >= SRC.ion.low[0] && P.CHAMBER.lowBattery <= SRC.ion.low[1] && P.SMOKE_DOMAINS.battery[0] >= SRC.ion.supply[0] && P.SMOKE_DOMAINS.battery[1] <= SRC.ion.supply[1], 'the trip declared inside the datasheet’s 7.2 to 7.8 V, and the battery inside its 6 to 12 V');
t.ok(P.SMOKE_DOMAINS.battery[0] < SRC.ion.low[0] && P.SMOKE_DOMAINS.battery[1] > SRC.ion.low[1], 'and the battery reaches both sides of that window');
t.ok(P.PHOTO_IC.period === SRC.photo.period && P.PHOTO_IC.afterOne === SRC.photo.one && P.PHOTO_IC.afterTwo === SRC.photo.two && P.PHOTO_IC.needed === SRC.photo.needed && P.PHOTO_IC.pulse * 1e6 === SRC.photo.pulse && P.PHOTO_IC.limitFull * 1e9 === SRC.photo.full && P.PHOTO_IC.steps === SRC.photo.steps, 'the RE46C190: 10.7 s, then 2.0 s, then 1.0 s, three readings, a 100 μs pulse, and a limit of up to 58 nA in 31 steps');
t.ok(P.PHOTO_IC.emitter * 1000 >= SRC.photo.ired[0] && P.PHOTO_IC.emitter * 1000 <= SRC.photo.ired[1], 'an emitter current inside its 50 to 200 mA');
t.ok(Number.isInteger(P.OPTICS.limitSteps) && P.OPTICS.limitSteps < P.PHOTO_IC.steps && Math.abs(P.PHOTO_LIMIT - P.PHOTO_IC.limitFull * P.OPTICS.limitSteps / P.PHOTO_IC.steps) < 1e-18, 'the limit stored is a whole number of its steps, inside its range');
t.ok(f1(P.PHOTO_LIMIT * 1e9) === '56.1' && f2(P.PHOTO_IC.limitFull / P.PHOTO_IC.steps * 1e9) === '1.87', '56.1 nA, thirty steps of 1.87 nA');
assert.deepEqual([...P.RATED.ionization], SRC.nist.ionization);
assert.deepEqual([...P.RATED.photoelectric], SRC.nist.photoelectric);
assert.deepEqual([...P.RATED.flaming], SRC.smoke.flaming);
assert.deepEqual([...P.RATED.smoldering], SRC.smoke.smoldering);
assert.deepEqual([...P.RATED.flamingFaster], SRC.nist.flaming);
assert.deepEqual([...P.RATED.smolderingFaster], SRC.nist.smoldering);
assert.deepEqual([...P.RATED.battery], SRC.alarm.battery);
t.ok(P.RATED.disk === SRC.alarm.disk && P.RATED.thick === SRC.alarm.thick && P.RATED.loud === SRC.alarm.loud && P.RATED.loudAt === SRC.alarm.at && P.RATED.tone[0] === SRC.alarm.tone[0] && P.RATED.tone[1] === SRC.alarm.tone[1], 'a disk 125 mm across and 25 mm thick, sounding between 2,900 and 3,500 Hz at 95 dB from 3 ft');
t.ok(P.MEASURING_CHAMBER.volts === SRC.mic.volts && P.MEASURING_CHAMBER.clean * 1e12 === SRC.mic.clean && P.MEASURING_CHAMBER.rows.every(([obscuration, current], i) => obscuration === SRC.mic.rows[i][0] && Math.abs(current * 1e12 - SRC.mic.rows[i][1]) < 1e-9), 'NIST’s measuring chamber at 18 V, 95 pA in clean air, down to 63.5 pA at 2.9%/m');
t.ok(P.MEASURING_CHAMBER.flow === SRC.mic.flow && P.MEASURING_CHAMBER.band * 1e12 === SRC.mic.band, 'drawing 30 L/min, its currents given within 5 pA');
assert.deepEqual([...P.IONIZATION_IC.lowWindow], SRC.ion.low, 'the MC14467-1’s low battery window itself');
assert.deepEqual([...P.IONIZATION_IC.supply], SRC.ion.supply, 'and its supply window');
assert.deepEqual(P.IONIZATION_IC.setWindow.map(share => Math.round(share * 100)), SRC.ion.setWindow, 'its set point between 47% and 53% of the supply');
t.ok(P.IONIZATION_IC.draw * 1e6 === SRC.ion.draw && P.IONIZATION_IC.load * 1000 === SRC.ion.load, 'its 5 μA of supply current, and the 10 mA load it checks the battery under');
t.ok(P.PHOTO_IC.emitter * 1000 === SRC.photo.iredAt && P.PHOTO_IC.chamberEvery === SRC.photo.chamber && P.PHOTO_IC.chirp * 1000 === SRC.photo.chirp, 'the RE46C190 pulsing its emitter at the 100 mA the TSAL6200 is rated at, checking its chamber every 43 s, and chirping for 10 ms');
assert.deepEqual(P.PHOTO_IC.pulseWindow.map(seconds => Math.round(seconds * 1e6)), SRC.photo.pulseWindow, 'its pulse between 100 and 400 μs');
assert.deepEqual(P.PHOTO_IC.emitterWindow.map(amps => Math.round(amps * 1000)), SRC.photo.ired, 'and its emitter current between 50 and 200 mA');
assert.deepEqual([...P.RATED.listedIon], SRC.nist.listedIon);
assert.deepEqual([...P.RATED.ionRating], SRC.smoke.ionRating);
assert.deepEqual([...P.RATED.photoRating], SRC.smoke.photoRating);
t.ok(P.RATED.listedPhoto === SRC.nist.listedPhoto && P.RATED.average === SRC.nist.average && P.RATED.averageBand === SRC.nist.band, 'the sensitivities NIST listed for the alarms it tested, and the 5.1%/m average of all of them');
t.ok(P.IMPACTOR.every((smoke, i) => smoke.name === SRC.impactor[i][0] && smoke.diameter === SRC.impactor[i][1] && smoke.spread === SRC.impactor[i][2] && Math.abs(smoke.mass * 1e6 - SRC.impactor[i][3]) < 1e-9), 'the smoke NIST caught in its impactor');
t.ok(P.SMOKE.density === 1000 && P.OPTICS.index === 1.5, 'smoke declared at unit density and a refractive index of 1.5');

// Smoke reaching a chamber: the lag integrated again.
for (const rate of [1, 10, 50]) {
  const growth = rate * 1e-6 / 60, steps = 6000, h = P.SMOKE.duration / steps;
  const slope = (mass, time) => (growth * time - mass) / P.SMOKE.lag;
  let mass = 0;
  for (let i = 0; i < steps; i++) {
    const time = i * h;
    const k1 = slope(mass, time), k2 = slope(mass + h / 2 * k1, time + h / 2), k3 = slope(mass + h / 2 * k2, time + h / 2), k4 = slope(mass + h * k3, time + h);
    mass += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
    counts.steps++;
  }
  t.near(P.massInside(growth, P.SMOKE.duration), mass, relative(mass, 1e-6), `${rate} mg/m³ a minute: the smoke inside, integrated again`);
  t.near(P.massInside(growth, 0), 0, 1e-18, 'and nothing at the start');
}

// Both comparators' schedules, stepped instead of solved.
function stepped(plan) {
  const ion = {alarm: null, last: 0}, photo = {alarm: null, run: 0, next: 0};
  for (let time = 0; time <= plan.duration + 1e-9; time += 0.01) {
    const now = P.smokeAt(plan, Math.min(time, plan.duration));
    if (ion.alarm === null && time >= ion.last + P.IONIZATION_IC.period - 1e-9) {
      ion.last += P.IONIZATION_IC.period;
      if (now.node >= plan.setPoint) ion.alarm = ion.last;
    }
    if (photo.alarm === null && time >= photo.next - 1e-9) {
      const over = now.scattered >= plan.photoLimit;
      photo.run = over ? photo.run + 1 : 0;
      if (photo.run >= P.PHOTO_IC.needed) photo.alarm = photo.next;
      else photo.next += photo.run === 0 ? P.PHOTO_IC.period : photo.run === 1 ? P.PHOTO_IC.afterOne : P.PHOTO_IC.afterTwo;
    }
  }
  return [ion.alarm, photo.alarm];
}
for (const values of [{}, {size: 0.1}, {size: 3}, {growth: 50}, {size: 1}]) {
  const plan = P.smokePlan(values), [ion, photo] = stepped(plan);
  t.ok((plan.ionAlarm === null) === (ion === null) && (plan.ionAlarm === null || Math.abs(plan.ionAlarm - ion) < 0.02), `${JSON.stringify(values)}: the ionization alarm, stepped 1.67 s at a time`);
  t.ok((plan.photoAlarm === null) === (photo === null) && (plan.photoAlarm === null || Math.abs(plan.photoAlarm - photo) < 0.02), 'and the photoelectric alarm, three readings in a row');
}

// What calibration set, and Litton’s limit on the chamber current.
{
  const test = P.particleOf(0.3, 21);
  const alarmAt = percent => P.nodeVolts(9, P.extinctionOf(percent) / test.extinction * test.capture) - 9 * P.IONIZATION_IC.set;
  let low = 0.5, high = 20;
  for (let i = 0; i < 60; i++) { const middle = (low + high) / 2; if (alarmAt(middle) < 0) low = middle; else high = middle; }
  t.near((low + high) / 2, SRC.nist.ionization[1], 0.1, 'the sealed half is set so that a 0.3 μm smoke alarms within 0.1%/m of NIST’s middle ionization threshold');
  const photoAt = percent => P.scatteredCurrent(test, P.extinctionOf(percent) / test.extinction) - P.PHOTO_LIMIT;
  low = 0.5; high = 20;
  for (let i = 0; i < 60; i++) { const middle = (low + high) / 2; if (photoAt(middle) < 0) low = middle; else high = middle; }
  t.near((low + high) / 2, SRC.nist.photoelectric[1], 0.1, 'and the stored limit so that the same smoke alarms within 0.1%/m of the photoelectric one');
  for (const battery of [6.5, 7.5, 9, 9.5]) {
    const plan = P.smokePlan({battery});
    t.ok(plan.cleanRatio < 0.4, `${battery} V: the chamber current stays below Litton’s 0.4 of the saturation current`);
    t.ok(plan.cleanNode < plan.setPoint && plan.cleanNode > 0, 'and the node sits below the set point in clean air');
    t.ok(plan.ionObscuration > SRC.nist.ionization[0] && plan.ionObscuration < SRC.nist.ionization[2], 'the alarm falls inside NIST’s low and high thresholds at every battery');
  }
  t.ok(f2(P.smokePlan({}).cleanCurrent * 1e12) === '13.37' && f2(P.smokePlan({}).cleanNode) === '3.06' && f0(100 * P.smokePlan({}).cleanRatio) === '23', 'in clean air: 13.37 pA at 3.06 V, 23% of saturation');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createSmokeDetectorModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const instancesOf = mesh => Array.from({length: mesh.count}, (_, i) => { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); const e = matrix.elements; return {x: e[12], y: e[13], r: e[0]}; });
t.ok(M.timesLarger(M.ION) === 4 && M.timesLarger(M.OPTIC) === 2.5 && M.timesLarger(M.BUTTON) === 15 && M.THROUGH / M.MM === 150 && M.MM === 0.01, 'the scales the text states: true size, 4, 2.5, 15 and 150 times larger');
const settings = [{}, {size: 0.1}, {size: 1}, {size: 3}, {growth: 1}, {growth: 50}, {battery: 6.5}, {battery: 7}, {battery: 9.5}, {angle: 45}, {angle: 90}, {angle: 165}, {size: 3, growth: 50}, {size: 0.1, growth: 50}];
for (const values of settings) {
  const plan = P.smokePlan(values);
  for (const time of [0, 120, plan.ionAlarm ?? 300, P.SMOKE.duration]) {
    model.reset();
    model.update(values);
    model.advance(time / P.SMOKE.speed);
    model.root.updateMatrixWorld(true);
    const state = model.getState(), now = state.now;
    counts.poses++;
    t.near(state.clock, time, 1e-9, 'the clock, 20 times faster than the run');

    // The ionization chambers: plates, walls and the dots inside them.
    t.near(T.openFill.scale.y, P.CHAMBER.sensing * M.ION, 1e-12, 'the open half as tall as its gap, 4 times larger');
    t.near(T.sealedFill.scale.y, P.CHAMBER.reference * M.ION, 1e-12, 'the sealed half taller still');
    t.near(T.openPlate.position.y, (P.CHAMBER.sensing + M.IONS.plate / 2) * M.ION, 1e-12, 'its plate above it');
    t.near(T.sealedPlate.position.y, (P.CHAMBER.reference + M.IONS.plate / 2) * M.ION, 1e-12, 'and the sealed half’s plate above that');
    t.ok(T.openFill.position.x > 0 && T.sealedFill.position.x < 0 && Math.abs(T.divider.position.x) < 1e-12, 'the open half to the right of the wall and the sealed half to its left');
    t.near(T.button.scale.x, P.AMERICIUM.diameter * M.ION, 1e-12, 'the source between them, 5.1 mm across');
    const positives = instancesOf(T.positives), negatives = instancesOf(T.negatives), smoke = instancesOf(T.smokes);
    t.ok(positives.length === negatives.length && positives.length === state.openDots + state.sealedDots, 'a positive and a negative ion drawn for every pair of dots');
    const inHalf = (dot, side, gap) => { const x = dot.x / M.ION, y = dot.y / M.ION; return side * x > 0 && Math.abs(x) < P.CHAMBER.radius && y > 0 && y < gap; };
    for (const dot of [...positives, ...negatives]) {
      t.ok(inHalf(dot, 1, P.CHAMBER.sensing) || inHalf(dot, -1, P.CHAMBER.reference), 'every ion dot inside its own half');
      counts.dots++;
    }
    t.ok(positives.filter(dot => dot.x > 0).length === state.openDots && positives.filter(dot => dot.x < 0).length === state.sealedDots, 'the dots split between the halves as the state says');
    t.near(state.openDots, Math.min(M.IONS.room, Math.round(M.IONS.dots * now.density / P.ionDensity(P.SENSING, P.smokePlan(P.SMOKE_DEFAULTS).cleanNode))), 0.5, 'the open half’s dots follow its ion density');
    t.ok(state.openDots < M.IONS.room && state.sealedDots < M.IONS.room, 'and never run out of room');
    t.ok(smoke.length === Math.min(M.IONS.smokeCap, Math.round(now.mass / M.IONS.smokeDot)) && smoke.length === state.smokeDots, 'one smoke dot for every 4 mg/m³ inside, up to the cap');
    for (const dot of smoke) t.ok(inHalf(dot, 1, P.CHAMBER.sensing), 'and smoke only in the open half');
    for (const dot of instancesOf(T.chamberSmoke)) t.ok(Math.hypot(dot.x, dot.y) / M.OPTIC < M.OPTIC_VIEW.wall, 'and inside the optical chamber');

    // The alpha tracks, each drawn to where it stops.
    const tracks = pointsOf(T.tracks);
    t.ok(tracks.length === 2 * M.IONS.tracks * 2, `${M.IONS.tracks} tracks on each side`);
    for (let i = 0; i < M.IONS.tracks; i++) {
      const angle = (i + 0.5) / M.IONS.tracks * Math.PI / 2 * 0.94;
      for (const [k, side] of [[0, -1], [1, 1]]) {
        const [start, end] = [tracks[4 * i + 2 * k], tracks[4 * i + 2 * k + 1]];
        const gap = side > 0 ? P.CHAMBER.sensing : P.CHAMBER.reference, track = P.trackOf(P.LINES[0][0], Math.cos(angle), gap, P.CHAMBER.radius);
        t.ok(Math.abs(start[0]) < 1e-6 && Math.abs(start[1] - P.AMERICIUM.thickness * M.ION) < 1e-6, 'a track leaving the face of the source');
        t.near(Math.hypot(end[0] - start[0], end[1] - start[1]) / M.ION, track.length, 1e-4, 'and stopping at the plate, the wall or the end of its range');
        t.ok(Math.abs(end[0] / M.ION) <= P.CHAMBER.radius + 1e-4 && end[1] / M.ION <= gap + P.AMERICIUM.thickness + 1e-4, 'inside its own half');
        counts.points++;
      }
    }

    // The gauges.
    const shares = [now.ratio, now.node / plan.supply, now.scattered / (2 * plan.photoLimit), plan.supply / P.SMOKE_DOMAINS.battery[1]];
    T.gaugeBars.forEach((bar, i) => {
      t.near(bar.position.y + bar.scale.y / 2, Math.max(0.004, Math.min(1, shares[i]) * M.GAUGE.height), 1e-9, `gauge ${i} as tall as its share`);
      t.near(bar.position.x, M.gaugeX(i), 1e-12, 'in its own column');
    });
    const marks = [plan.cleanRatio, plan.setPoint / plan.supply, 0.5, P.CHAMBER.lowBattery / P.SMOKE_DOMAINS.battery[1]];
    T.gaugeLines.forEach((line, i) => {
      const points = pointsOf(line);
      t.near(points[0][1], M.gaugeY(marks[i]), 1e-6, `gauge ${i}: the line it is compared with`);
      t.ok(points.length === (i === 1 && now.ionSounding ? 4 : 2), i === 1 && now.ionSounding ? 'and the hysteresis line once it alarms' : 'one line before that');
    });
    t.ok((pointsOf(T.sound).length > 0) === now.sounding && (pointsOf(T.hornArcs).length > 0) === now.sounding, now.sounding ? 'the horn drawn sounding' : 'the horn quiet');
    t.ok(T.hornBody.position.y - M.GAUGE.hornRadius > M.GAUGE.height && pointsOf(T.sound).every(point => point[1] > M.GAUGE.height), 'the horn, and every arc it draws, clear above the gauges');
    t.ok(T.gaugeBars[1].material.color.getHex() === (now.ionSounding ? M.COLORS.alarm : M.COLORS.ion) && T.gaugeBars[2].material.color.getHex() === (now.photoSounding ? M.COLORS.alarm : M.COLORS.photo), 'a gauge turning red when its comparator has crossed');

    // The optical chamber.
    const radians = plan.values.angle * Math.PI / 180;
    t.near(Math.hypot(T.scatterDiode.position.x, T.scatterDiode.position.y) / M.OPTIC, P.OPTICS.sensor, 1e-9, 'the photodiode at its distance from the smoke');
    t.near(Math.atan2(T.scatterDiode.position.y, T.scatterDiode.position.x), radians, 1e-9, 'and at the angle asked for');
    t.near(T.emitter.position.x + T.emitter.scale.x / 2, -P.OPTICS.source * M.OPTIC, 1e-12, 'the emitter facing the smoke from its distance');
    t.near(T.straightDiode.position.x - T.straightDiode.scale.x / 2, (P.OPTICS.direct - P.OPTICS.source) * M.OPTIC, 1e-12, 'the second photodiode down the beam');
    t.ok(M.COLORS.face !== M.COLORS.diode && T.straightFace.material.color.getHex() === M.COLORS.face && T.scatterFace.material.color.getHex() !== M.COLORS.diode, 'both photodiode faces read against the dark chamber');
    const rayPoints = pointsOf(T.ray);
    t.ok((rayPoints.length > 0) === (now.scattered > 0), 'a ray drawn to the photodiode once smoke scatters light');
    if (rayPoints.length) t.near(Math.atan2(rayPoints[1][1], rayPoints[1][0]), radians, 1e-5, 'pointing at the photodiode');
    const cone = T.cone.geometry.attributes.position.array;
    const cross = (cone[3] - cone[0]) * (cone[7] - cone[1]) - (cone[4] - cone[1]) * (cone[6] - cone[0]);
    t.ok(cross > 0, 'the beam’s triangle winds to face the viewer');
    t.near(Math.atan2(cone[4] - cone[1], cone[3] - cone[0]), -P.EMITTER.half * Math.PI / 180, 1e-5, 'and spreads at the emitter’s half angle');

    // The chart of the run.
    const guide = pointsOf(T.ionGuide), photoGuide = pointsOf(T.photoGuide);
    t.ok(guide.length === P.SMOKE.samples && photoGuide.length === P.SMOKE.samples, 'the whole run drawn faintly');
    for (let j = 0; j < guide.length; j += 20) {
      const sample = plan.chart[j];
      t.near(guide[j][0], M.chartX(sample.time), 1e-6, 'across in time');
      t.near(guide[j][1], M.chartY(sample.ionShare), 1e-6, 'up in how far the ionization chamber has come');
      t.near(photoGuide[j][1], M.chartY(sample.photoShare), 1e-6, 'and the photodiode');
      t.near(sample.ionShare, (P.nodeVolts(plan.supply, plan.captureOf(sample.mass)) - plan.cleanNode) / (plan.setPoint - plan.cleanNode), relative(1, 1e-9), 'the share worked out again from the node');
      t.near(sample.photoShare, P.scatteredCurrent(plan.particle, sample.mass / plan.particle.mass) / plan.photoLimit, relative(1, 1e-9), 'and from the photocurrent');
      counts.points++;
    }
    const ionCurve = pointsOf(T.ionCurve);
    if (time > 0) {
      const shown = plan.chart.filter(sample => sample.time < now.t);
      t.ok(ionCurve.length === shown.length + 1, 'the dark curve as far as the clock');
      t.near(ionCurve.at(-1)[0], M.chartX(now.t), 1e-6, 'ending at now');
    } else t.ok(!T.ionCurve.visible && !T.photoCurve.visible, 'nothing drawn dark before Play');
    const alarmMarks = pointsOf(T.alarmMarks);
    t.ok(alarmMarks.length === 2 * ((now.ionSounding ? 1 : 0) + (now.photoSounding ? 1 : 0)), 'a mark for each alarm that has sounded');
    for (const [k, alarm] of [plan.ionAlarm, plan.photoAlarm].filter((alarm, i) => (i === 0 ? now.ionSounding : now.photoSounding)).entries()) {
      t.near(alarmMarks[2 * k][0], M.chartX(alarm), 1e-6, 'at the time it sounded');
    }
    t.ok(pointsOf(T.chirpMarks).length === 2 * now.chirps, 'a tick for every chirp so far');
    t.near(pointsOf(T.chartCursor)[0][0], M.chartX(now.t), 1e-6, 'the cursor at now');
  }
}
{
  // The source, its layers and the ion pairs one alpha leaves along its way.
  model.reset();
  model.root.updateMatrixWorld(true);
  const layers = [[T.silver, M.SOURCE.silver], [T.core, M.SOURCE.core], [T.cover, M.SOURCE.cover]];
  let stacked = 0;
  for (const [layer, thickness] of layers) {
    t.near(layer.scale.y, thickness * M.THROUGH, 1e-12, 'a layer as thick as it is, 150 times larger through');
    t.near(layer.position.y - layer.scale.y / 2, stacked * M.THROUGH, 1e-12, 'stacked on the one below');
    t.near(layer.scale.x, P.AMERICIUM.diameter * M.BUTTON, 1e-12, 'and 5.1 mm across, 15 times larger');
    stacked += thickness;
  }
  t.near(stacked, P.AMERICIUM.thickness, 1e-12, 'the three layers make the button’s 0.2 mm');
  t.near(M.SOURCE.cover / P.AMERICIUM.thickness, P.AMERICIUM.coverShare, 1e-12, 'the gold cover one percent of it');
  const start = P.afterGold(P.LINES[0][0], P.CHAMBER.cover), range = P.airRange(start) * 10, curve = pointsOf(T.braggCurve);
  t.ok(curve.length === M.SOURCE.chart.far * 4 + 1, 'the Bragg curve drawn every quarter millimeter');
  curve.forEach(([x, y], i) => {
    const distance = i / 4, pairs = distance <= range ? P.pairsPerMillimeter(P.airEnergyAfter(start, distance)) : 0;
    t.near(x, M.SOURCE.chart.x + distance / M.SOURCE.chart.far * M.SOURCE.chart.w, 1e-6, 'across in millimeters of air');
    t.near(y, M.SOURCE.chart.y + Math.min(1, pairs / M.SOURCE.chart.top) * M.SOURCE.chart.h, 1e-6, 'up in ion pairs a millimeter');
    counts.points++;
  });
  const peak = curve.reduce((best, point, i) => (point[1] > curve[best][1] ? i : best), 0) / 4;
  t.ok(peak > 0.7 * range && peak < range, 'the peak of the curve sits near the end of the range, where the alpha slows');
  const marks = pointsOf(T.braggMarks);
  [P.CHAMBER.sensing, P.CHAMBER.reference, range].forEach((distance, i) => t.near(marks[2 * i][0], M.SOURCE.chart.x + distance / M.SOURCE.chart.far * M.SOURCE.chart.w, 1e-6, 'a mark at each plate and at the end of the range'));
  const sum = curve.slice(0, 4 * P.CHAMBER.sensing + 1).reduce((total, point, i, all) => total + (i === 0 ? 0 : (point[1] + all[i - 1][1] - 2 * M.SOURCE.chart.y) / 2 / M.SOURCE.chart.h * M.SOURCE.chart.top / 4), 0);
  t.near(sum, start * 1e6 / P.PAIR_ENERGY * (1 - P.airEnergyAfter(start, P.CHAMBER.sensing) / start), 0.02 * sum, 'the area under the curve to the open half’s plate is the pairs an alpha leaves going straight up');
}
{
  // The alarm at true size, and the parts clear of one another.
  model.reset();
  model.advance(P.SMOKE.duration / P.SMOKE.speed);
  model.root.updateMatrixWorld(true);
  t.near(T.shell.scale.x, P.RATED.disk / 2 * M.MM, 1e-12, 'a disk 125 mm across at true size');
  t.near(T.battery.scale.x, P.RATED.battery[0] * M.MM, 1e-12, 'a nine volt battery 48.5 mm long');
  t.near(T.battery.scale.y, P.RATED.battery[1] * M.MM, 1e-12, 'and 26.5 mm wide');
  t.near(T.ionCase.scale.x, P.CHAMBER.radius * M.MM, 1e-12, 'the ionization chamber at its true radius inside');
  t.ok(pointsOf(T.rim).every(([x, y]) => Math.abs(Math.hypot(x, y) - P.RATED.disk / 2 * M.MM) < 1e-6), 'the rim a circle at that radius');
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
  for (const values of [{}, {size: 3, growth: 50}, {size: 0.1, growth: 50}, {battery: 6.5, angle: 165}]) {
    model.reset();
    model.update(values);
    model.advance(P.SMOKE.duration / P.SMOKE.speed);
    model.root.updateMatrixWorld(true);
    toSystem.copy(T.system.matrixWorld).invert();
    const boxes = ['detector', 'ions', 'source', 'chamber', 'circuit', 'chart'].map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
    t.ok(boxes.every(([, box]) => !box.isEmpty()), 'every part drawn');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, A] = boxes[i], [b, B] = boxes[j];
      t.ok(A.max.x + 0.02 <= B.min.x || B.max.x + 0.02 <= A.min.x || A.max.y + 0.02 <= B.min.y || B.max.y + 0.02 <= A.min.y, `the ${a} and the ${b} clear of each other at ${JSON.stringify(values)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const ratio = (diameter, angle) => P.particleOf(diameter, angle).differential / P.particleOf(diameter, P.SMOKE_DEFAULTS.angle).differential;
const fullPairs = P.afterGold(P.LINES[0][0], P.CHAMBER.cover) * 1e6 / P.PAIR_ENERGY;
checkTrialNumbers(L.smokeDetectorLesson, {
  'Watch both alarms': s => ({264: s.ionCross, 266: s.ionAlarm, '4.32': s.ionObscuration, 400: s.photoCross, 410: s.photoAlarm, '6.65': s.photoObscuration}),
  'Smoke you cannot see': s => { t.ok(s.photoAlarm === null, 'the photodiode never reaches its limit at 0.1 μm'); return {45: s.ionAlarm, '0.02': s.ionObscuration, '1.46': s.now.current * 1e12, '13.37': s.cleanCurrent * 1e12}; },
  'Smoke from smoldering': s => { t.ok(s.ionAlarm === null, 'the chamber never alarms at 3 μm'); return {470: s.photoCross, 474: s.photoAlarm, '10.15': s.photoObscuration, '99.5': 100 * s.now.share}; },
  'A faster fire': s => ({68: s.ionAlarm, 99: s.photoAlarm, '4.32': s.ionObscuration, '6.65': s.photoObscuration}),
  'The beam straight through': s => ({'96.7': s.now.mass * 1e6, '9.96': s.now.obscuration, 30: P.OPTICS.direct, '99.69': 100 * s.now.beamShare, 400: s.cleanBeam * 1e6, 10: P.OPTICS.room, '35.0': 100 * s.now.roomShare}),
  'A low battery': s => ({'7.5': P.CHAMBER.lowBattery, 10: P.IONIZATION_IC.chirp * 1000, 40: P.IONIZATION_IC.batteryEvery, 6: Math.floor(s.ionAlarm / P.IONIZATION_IC.batteryEvery), 272: s.ionAlarm, '4.44': s.ionObscuration}),
  'Move the photodiode': s => ({'0.345': ratio(s.values.size, s.values.angle), 21: P.SMOKE_DEFAULTS.angle, '29.5': s.now.scattered * 1e9, '56.1': s.photoLimit * 1e9, 266: s.ionAlarm}),
}, run, t);
checkTrialNumbers(L.ionizationDetectorLesson, {
  'Watch the ions thin out': s => ({'13.37': s.cleanCurrent * 1e12, '3.06': s.cleanNode, '1.46': s.now.current * 1e12, '10.9': 100 * s.now.share}),
  'Where the alarm point is': s => ({'3.06': s.cleanNode, '4.50': s.setPoint, 45: s.ionAlarm, '4.5': s.ionMass * 1e6, '0.02': s.ionObscuration}),
  'Bigger particles slip past': s => ({'96.7': s.now.mass * 1e6, '27,000': (s.values.size / L.IONIZATION_DEFAULTS.size) ** 3, 30: s.values.size / L.IONIZATION_DEFAULTS.size, '99.5': 100 * s.now.share}),
  'A weaker battery': s => ({'13.37': P.smokePlan(L.IONIZATION_DEFAULTS).cleanCurrent * 1e12, '9.97': s.cleanCurrent * 1e12, 47: s.ionAlarm}),
  'What one alpha leaves': s => ({'4.587': P.afterGold(P.LINES[0][0], P.CHAMBER.cover), '31.9': P.airRange(P.afterGold(P.LINES[0][0], P.CHAMBER.cover)) * 10, 15: P.CHAMBER.sensing, '39,687': s.sensing.pairs, '135,028': fullPairs}),
  'The ceiling on the current': s => ({'13.37': P.smokePlan(L.IONIZATION_DEFAULTS).cleanCurrent * 1e12, '14.02': s.cleanCurrent * 1e12, '23.8': 100 * s.cleanRatio, '58.8': s.sensing.saturation * 1e12}),
  'A slow fire': s => ({'4.5': s.ionMass * 1e6, 292: s.ionAlarm}),
}, run, t);
checkTrialNumbers(L.opticalDetectorLesson, {
  'Watch the light arrive': s => ({'56.1': s.photoLimit * 1e9, 470: s.photoCross, 474: s.photoAlarm, '10.15': s.photoObscuration}),
  'The beam itself hardly dims': s => ({'12.89': s.now.obscuration, '99.59': 100 * s.now.beamShare, 400: s.cleanBeam * 1e6, 30: P.OPTICS.direct, 10: P.OPTICS.room, '25.2': 100 * s.now.roomShare}),
  'Around to the side': s => ({90: s.values.angle, '0.102': ratio(s.values.size, s.values.angle), 21: P.SMOKE_DEFAULTS.angle, '7.4': s.now.scattered * 1e9}),
  'Forward, but not far forward': s => ({45: s.values.angle, '0.274': ratio(s.values.size, s.values.angle), 21: P.SMOKE_DEFAULTS.angle, '19.8': s.now.scattered * 1e9}),
  'Smaller particles': s => ({410: s.photoAlarm, '6.65': s.photoObscuration}),
  'Smoke you cannot see': s => ({'2.4': s.now.scattered * 1e9, '56.1': s.photoLimit * 1e9, 45: P.smokePlan({...L.OPTICAL_DEFAULTS, size: 0.1}).ionAlarm}),
  'A faster fire': s => ({121: s.photoAlarm, 474: P.smokePlan(L.OPTICAL_DEFAULTS).photoAlarm, '10.15': s.photoObscuration}),
}, run, t);

// Free text: each snippet computed, and every number in the text inside a checked snippet.
// Names like Americium-241 and the MC14467-1 carry digits after a hyphen, and
// the names themselves are checked below, so the regex skips a number a hyphen
// leads. Negative numbers are written with a minus sign, never a hyphen.
const NAMES = ['Americium-241', 'americium-241', 'MC14467-1'];
const note973 = `Technical Note ${SRC.notes.smoke}`;
const NUMBER = /(?<![A-Za-z\d.,\-])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
  for (const match of text.matchAll(/[A-Za-z][A-Za-z\d]*-\d+/g)) t.ok(NAMES.includes(match[0]), `${where}: ${match[0]} is one of the names these lessons quote`);
}
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
const expectNone = (lesson, name, except = []) => { for (const [where, text] of texts(lesson)) if (!except.includes(where)) covered(text, {}, `${name} ${where}`); };
const base = P.smokePlan({}), small = P.smokePlan({size: 0.1}), large = P.smokePlan({size: 3});
const limitSnippets = {
  [`${P.CHAMBER.radius} mm in radius, the open half ${P.CHAMBER.sensing} mm from the source to its plate and the sealed half ${P.CHAMBER.reference} mm`]: '10 mm in radius, the open half 15 mm from the source to its plate and the sealed half 24.7 mm',
  [`a smoke of ${P.SMOKE_DEFAULTS.size} μm`]: 'a smoke of 0.3 μm',
  [`coefficient of ${f1(P.CHAMBER.recombination * 1e12)} × 10⁻¹² m³/s`]: 'coefficient of 1.6 × 10⁻¹² m³/s',
  [`trip of ${f1(P.CHAMBER.lowBattery)} V`]: 'trip of 7.5 V',
  [`${P.OPTICS.source} mm from the emitter to the smoke and ${P.OPTICS.sensor} mm on to the photodiode, a lit volume ${P.OPTICS.beam} mm across and ${P.OPTICS.length} mm long, a beam ${P.OPTICS.direct} mm long inside the chamber and ${P.OPTICS.room} m across a room`]: '12 mm from the emitter to the smoke and 12 mm on to the photodiode, a lit volume 6 mm across and 10 mm long, a beam 30 mm long inside the chamber and 10 m across a room',
  [`refractive index ${P.OPTICS.index} and density ${f0(P.SMOKE.density)} kg/m³`]: 'refractive index 1.5 and density 1,000 kg/m³',
  [`a lag of ${f0(P.SMOKE.lag)} s`]: 'a lag of 20 s',
  [`a run of ${f0(P.SMOKE.duration / 60)} minutes`]: 'a run of 10 minutes',
};
const scaleSnippets = {
  [`ionization chambers ${f0(M.timesLarger(M.ION))} times larger`]: 'ionization chambers 4 times larger',
  [`${f0(M.timesLarger(M.BUTTON))} times larger across and ${f0(M.THROUGH / M.MM)} times larger through`]: '15 times larger across and 150 times larger through',
  [`optical chamber ${f1(M.timesLarger(M.OPTIC))} times larger`]: 'optical chamber 2.5 times larger',
  [`run of ${f0(P.SMOKE.duration / 60)} minutes is drawn ${f0(P.SMOKE.speed)} times faster`]: 'run of 10 minutes is drawn 20 times faster',
};
covered(L.smokeLimits, limitSnippets, 'shared limits');
covered(L.smokeLeftOut, {}, 'what is left out');

// Smoke detector.
expectNone(L.smokeDetectorLesson, 'Smoke detector');
covered(L.smokeDetectorLesson.deeper[0].body, {
  [`alpha particle of ${P.LINES[0][0]} MeV in ${f0(P.LINES[0][1] * 100)}% of its decays`]: 'alpha particle of 5.486 MeV in 85% of its decays',
  [`about ${f0(P.AMERICIUM.activity / 1000)} kBq of it, some ${f2(P.AMERICIUM.mass * 1e6)} μg`]: 'about 37 kBq of it, some 0.29 μg',
  [`${f0(P.CHAMBER.cover)} μm of it`]: '2 μm of it',
  [`costs them ${f3(P.LINES[0][0] - P.afterGold(P.LINES[0][0], P.CHAMBER.cover))} MeV`]: 'costs them 0.899 MeV',
  [`is left, ${f3(P.afterGold(P.LINES[0][0], P.CHAMBER.cover))} MeV, would carry an alpha ${f1(P.airRange(P.afterGold(P.LINES[0][0], P.CHAMBER.cover)) * 10)} mm`]: 'is left, 4.587 MeV, would carry an alpha 31.9 mm',
  [`takes ${P.PAIR_ENERGY} eV`]: 'takes 33.97 eV',
  [`would leave ${f0(fullPairs)} pairs`]: 'would leave 135,028 pairs',
  [`${f0(P.CHAMBER.sensing)} mm from the source to its plate, takes ${f0(P.SENSING.pairs)} of them`]: '15 mm from the source to its plate, takes 39,687 of them',
}, 'Smoke detector deeper 1');
covered(L.smokeDetectorLesson.deeper[1].body, {
  [`would carry ${f1(P.SENSING.saturation * 1e12)} pA`]: 'would carry 58.8 pA',
  [`carries ${f2(base.cleanCurrent * 1e12)} pA, ${f0(100 * base.cleanRatio)}% of that, because at ${f2(base.cleanNode)} V an ion takes ${f0(1000 / P.sweepRate(P.SENSING, base.cleanNode))} ms`]: 'carries 13.37 pA, 23% of that, because at 3.06 V an ion takes 245 ms',
  'below 0.4 of the saturation current': 'below 0.4 of the saturation current',
}, 'Smoke detector deeper 2');
covered(L.smokeDetectorLesson.deeper[2].body, {
  'diffusion limit 4πDR': 'diffusion limit 4πDR',
  [`that is ${f2(P.DIFFUSION * 1e6)} × 10⁻⁶ m²/s, so a particle ${P.SMOKE_DEFAULTS.size} μm across catches at ${f2(P.particleOf(0.3, 21).capture * 1e12)} × 10⁻¹² m³/s`]: 'that is 3.79 × 10⁻⁶ m²/s, so a particle 0.3 μm across catches at 7.14 × 10⁻¹² m³/s',
  [`meets a particle in ${f0(1000 / (P.extinctionOf(base.ionObscuration) / P.particleOf(0.3, 21).extinction * P.particleOf(0.3, 21).capture))} ms, against the ${f0(1000 / P.sweepRate(P.SENSING, base.cleanNode))} ms`]: 'meets a particle in 49 ms, against the 245 ms',
  'factor of 4': 'factor of 4',
  [note973]: 'Technical Note 973',
}, 'Smoke detector deeper 3');
covered(L.smokeDetectorLesson.deeper[3].body, {
  [`${P.SMOKE_DOMAINS.size[0]} μm across, far smaller than the ${f0(P.EMITTER.wavelength * 1e9)} nm`]: '0.1 μm across, far smaller than the 940 nm',
  'sixth power of diameter': 'sixth power of diameter',
  [`one of ${f0(P.SMOKE_DOMAINS.size[1])} μm`]: 'one of 3 μm',
  [`around ${f0(90)}° the worst, and the detector it measured used ${f0(P.SMOKE_DEFAULTS.angle)}° with a ${f0(P.EMITTER.wavelength * 1e9)} nm emitter`]: 'around 90° the worst, and the detector it measured used 21° with a 940 nm emitter',
  [note973]: 'Technical Note 973',
}, 'Smoke detector deeper 4');
covered(L.smokeDetectorLesson.deeper[4].body, {[`over the ${f0(P.OPTICS.direct)} mm inside the chamber`]: 'over the 30 mm inside the chamber'}, 'Smoke detector deeper 5');
covered(L.smokeDetectorLesson.deeper[5].body, {
  [`${P.RATED.flamingFaster[0]} to ${P.RATED.flamingFaster[1]} seconds faster`]: '57 to 62 seconds faster',
  [`${P.RATED.smolderingFaster[0]} to ${P.RATED.smolderingFaster[1]} minutes faster`]: '47 to 53 minutes faster',
  [`mostly ${P.RATED.flaming[0]} to ${P.RATED.flaming[1]} μm`]: 'mostly 0.01 to 0.3 μm',
  [`is ${P.RATED.smoldering[0]} to ${f1(P.RATED.smoldering[1])} μm`]: 'is 0.3 to 10.0 μm',
  [`NIST\u2019s ${SRC.notes.study} study`]: 'NIST’s 2004 study',
}, 'Smoke detector deeper 6');
covered(L.smokeDetectorLesson.limits, {...limitSnippets, ...scaleSnippets}, 'Smoke detector limits');
covered(L.smokeDetectorLesson.quiz.explanation, {
  [`At ${small.values.size} μm the ionization alarm sounds at ${f0(small.ionAlarm)} s`]: 'At 0.1 μm the ionization alarm sounds at 45 s',
  [`at ${f0(large.values.size)} μm the photoelectric alarm sounds at ${f0(large.photoAlarm)} s and the chamber ends the run at ${f1(100 * P.smokeAt(large, P.SMOKE.duration).share)}%`]: 'at 3 μm the photoelectric alarm sounds at 474 s and the chamber ends the run at 99.5%',
}, 'Smoke detector quiz');

// Ionization smoke detector.
expectNone(L.ionizationDetectorLesson, 'Ionization smoke detector');
covered(L.ionizationDetectorLesson.deeper[0].body, {}, 'Ionization deeper 1');
covered(L.ionizationDetectorLesson.deeper[1].body, {
  [`about ${f2(P.ionDensity(P.SENSING, base.cleanNode) / 1e12)} million ion pairs in every cubic centimeter`]: 'about 8.67 million ion pairs in every cubic centimeter',
  [`takes ${f0(1000 / P.sweepRate(P.SENSING, base.cleanNode))} ms on average at ${f2(base.cleanNode)} V`]: 'takes 245 ms on average at 3.06 V',
}, 'Ionization deeper 2');
covered(L.ionizationDetectorLesson.deeper[2].body, {[note973]: 'Technical Note 973'}, 'Ionization deeper 3');
covered(L.ionizationDetectorLesson.deeper[3].body, {
  [`the open half carries ${f2(base.cleanCurrent * 1e12)} pA`]: 'the open half carries 13.37 pA',
  [`leaks at most ${f0(P.IONIZATION_IC.leak * 1e12)} pA`]: 'leaks at most 1 pA',
  [`within ${f0(P.IONIZATION_IC.guard * 1000)} mV`]: 'within 100 mV',
  [`at ${f0(P.MEASURING_CHAMBER.volts)} V, read ${f0(P.MEASURING_CHAMBER.clean * 1e12)} pA in clean air and ${f1(P.MEASURING_CHAMBER.rows[3][1] * 1e12)} pA at ${f1(P.MEASURING_CHAMBER.rows[3][0])}%`]: 'at 18 V, read 95 pA in clean air and 63.5 pA at 2.9%',
}, 'Ionization deeper 4');
covered(L.ionizationDetectorLesson.deeper[4].body, {
  [`every ${f2(P.IONIZATION_IC.period)} s`]: 'every 1.67 s',
  [`a ${f0(P.IONIZATION_IC.smokePeriod * 1000)} ms period and drives the horn ${f0(P.IONIZATION_IC.hornOn * 1000)} ms on and ${f0(P.IONIZATION_IC.hornOff * 1000)} ms off`]: 'a 40 ms period and drives the horn 160 ms on and 80 ms off',
  [`Every ${f0(P.IONIZATION_IC.batteryEvery / P.IONIZATION_IC.period)} of its slow cycles, about ${f0(P.IONIZATION_IC.batteryEvery)} s, it checks the battery under a ${f0(P.IONIZATION_IC.load * 1000)} mA load, and chirps for ${f0(P.IONIZATION_IC.chirp * 1000)} ms`]: 'Every 24 of its slow cycles, about 40 s, it checks the battery under a 10 mA load, and chirps for 10 ms',
  [`about ${f0(P.IONIZATION_IC.draw * 1e6)} μA`]: 'about 5 μA',
}, 'Ionization deeper 5');
covered(L.ionizationDetectorLesson.deeper[5].body, {
  [`discs ${f1(P.AMERICIUM.diameter)} mm across and ${f1(P.AMERICIUM.thickness)} mm thick`]: 'discs 5.1 mm across and 0.2 mm thick',
  [`${f1(P.goldRange(P.LINES[0][0]) * 1e4)} μm of gold would stop the alphas`]: '10.2 μm of gold would stop the alphas',
  [`through ${f1(6.6)} μm of gold at ${f3(P.afterGold(P.LINES[0][0], 6.6))} MeV and ${f1(P.airRange(P.afterGold(P.LINES[0][0], 6.6)) * 10)} mm of air, where that note gives ${f1(4.5)} mm`]: 'through 6.6 μm of gold at 2.087 MeV and 11.2 mm of air, where that note gives 4.5 mm',
  [note973]: 'Technical Note 973',
}, 'Ionization deeper 6');
covered(L.ionizationDetectorLesson.limits, {...limitSnippets, [`chambers are drawn ${f0(M.timesLarger(M.ION))} times larger and the button ${f0(M.timesLarger(M.BUTTON))} times larger across and ${f0(M.THROUGH / M.MM)} times larger through`]: 'chambers are drawn 4 times larger and the button 15 times larger across and 150 times larger through', [`run of ${f0(P.SMOKE.duration / 60)} minutes is drawn ${f0(P.SMOKE.speed)} times faster`]: 'run of 10 minutes is drawn 20 times faster'}, 'Ionization limits');
covered(L.ionizationDetectorLesson.quiz.explanation, {
  [`meets a particle in ${f0(1000 / (P.extinctionOf(base.ionObscuration) / P.particleOf(0.3, 21).extinction * P.particleOf(0.3, 21).capture))} ms, against the ${f0(1000 / P.sweepRate(P.SENSING, base.cleanNode))} ms`]: 'meets a particle in 49 ms, against the 245 ms',
  [`falls from ${f2(base.cleanCurrent * 1e12)} pA toward ${f2(P.smokeAt(small, P.SMOKE.duration).current * 1e12)} pA`]: 'falls from 13.37 pA toward 1.46 pA',
}, 'Ionization quiz');

// Optical smoke detector.
expectNone(L.opticalDetectorLesson, 'Optical smoke detector');
covered(L.opticalDetectorLesson.deeper[0].body, {
  [`the emitter uses, ${f0(P.EMITTER.wavelength * 1e9)} nm`]: 'the emitter uses, 940 nm',
  [`At ${P.SMOKE_DOMAINS.size[0]} μm`]: 'At 0.1 μm',
  'sixth power of diameter': 'sixth power of diameter',
  [`At ${f0(1)} μm and ${f0(P.SMOKE_DOMAINS.size[1])} μm`]: 'At 1 μm and 3 μm',
}, 'Optical deeper 1');
covered(L.opticalDetectorLesson.deeper[1].body, {
  [`weakest around ${f0(90)}° to ${f0(100)}°`]: 'weakest around 90° to 100°',
  [`nominal ${f0(P.SMOKE_DEFAULTS.angle)}° with an emitter at ${f0(P.EMITTER.wavelength * 1e9)} nm`]: 'nominal 21° with an emitter at 940 nm',
  [`to ${f0(90)}° costs a factor of ten for ${f0(P.SMOKE_DOMAINS.size[1])} μm smoke and about a third for ${P.SMOKE_DEFAULTS.size} μm`]: 'to 90° costs a factor of ten for 3 μm smoke and about a third for 0.3 μm',
  [note973]: 'Technical Note 973',
}, 'Optical deeper 2');
covered(L.opticalDetectorLesson.deeper[2].body, {[`the ${f0(P.OPTICS.direct)} mm inside this chamber`]: 'the 30 mm inside this chamber'}, 'Optical deeper 3');
covered(L.opticalDetectorLesson.deeper[3].body, {
  [`once every ${f1(P.PHOTO_IC.period)} s, pulses the emitter for ${f0(P.PHOTO_IC.pulse * 1e6)} μs`]: 'once every 10.7 s, pulses the emitter for 100 μs',
  [`in ${P.PHOTO_IC.steps} steps up to ${f0(P.PHOTO_IC.limitFull * 1e9)} nA; the ${f1(P.PHOTO_LIMIT * 1e9)} nA here is ${P.OPTICS.limitSteps}`]: 'in 31 steps up to 58 nA; the 56.1 nA here is 30',
  [`next wait to ${f1(P.PHOTO_IC.afterOne)} s, a second shortens it to ${f1(P.PHOTO_IC.afterTwo)} s`]: 'next wait to 2.0 s, a second shortens it to 1.0 s',
  [`by ${f0(P.PHOTO_IC.afterOne + P.PHOTO_IC.afterTwo)} s`]: 'by 3 s',
}, 'Optical deeper 4');
covered(L.opticalDetectorLesson.deeper[4].body, {
  [`gives ${f0(P.EMITTER.intensity * 1000)} mW/sr at ${f0(100)} mA into a beam of half angle ${f0(P.EMITTER.half)}°`]: 'gives 72 mW/sr at 100 mA into a beam of half angle 17°',
  [`${f1(P.DIODE.area * 1e6)} mm² of silicon giving ${f0(P.DIODE.current * 1e6)} μA in an irradiance of ${f0(1)} mW/cm² at ${f0(950)} nm, which is a responsivity of ${f3(P.RESPONSIVITY)} A/W`]: '7.5 mm² of silicon giving 50 μA in an irradiance of 1 mW/cm² at 950 nm, which is a responsivity of 0.667 A/W',
}, 'Optical deeper 5');
covered(L.opticalDetectorLesson.deeper[5].body, {
  [`mostly ${P.RATED.flaming[0]} to ${P.RATED.flaming[1]} μm`]: 'mostly 0.01 to 0.3 μm',
  [`${P.RATED.flamingFaster[0]} to ${P.RATED.flamingFaster[1]} seconds slower`]: '57 to 62 seconds slower',
  [`${P.RATED.smolderingFaster[0]} to ${P.RATED.smolderingFaster[1]} minutes faster`]: '47 to 53 minutes faster',
  [`at ${P.SMOKE_DOMAINS.size[0]} μm`]: 'at 0.1 μm',
}, 'Optical deeper 6');
covered(L.opticalDetectorLesson.limits, {...limitSnippets, [`chamber is drawn ${f1(M.timesLarger(M.OPTIC))} times larger`]: 'chamber is drawn 2.5 times larger', [`run of ${f0(P.SMOKE.duration / 60)} minutes is drawn ${f0(P.SMOKE.speed)} times faster`]: 'run of 10 minutes is drawn 20 times faster'}, 'Optical limits');
{
  const atAlarm = P.smokeAt(large, large.photoAlarm);
  covered(L.opticalDetectorLesson.quiz.explanation, {
    [`from nothing to ${f1(large.photoLimit * 1e9)} nA removes only ${f2(100 - 100 * atAlarm.beamShare)}% of the beam over the ${f0(P.OPTICS.direct)} mm`]: 'from nothing to 56.1 nA removes only 0.32% of the beam over the 30 mm',
  }, 'Optical quiz');
}

// The model’s own words.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`chambers cut open ${f0(M.timesLarger(M.ION))} times larger`]: 'chambers cut open 4 times larger',
  [`${f0(M.timesLarger(M.BUTTON))} times larger across`]: '15 times larger across',
  [`cut open ${f1(M.timesLarger(M.OPTIC))} times larger`]: 'cut open 2.5 times larger',
  [`run of ${f0(P.SMOKE.duration / 60)} minutes is drawn ${f0(P.SMOKE.speed)} times faster`]: 'run of 10 minutes is drawn 20 times faster',
}, 'system text');
covered(partText('detector'), {
  [`${f0(P.RATED.disk)} mm across and ${f0(P.RATED.thick)} mm thick`]: '125 mm across and 25 mm thick',
  [`a ${f1(P.RATED.battery[0])} mm by ${f1(P.RATED.battery[1])} mm nine volt battery`]: 'a 48.5 mm by 26.5 mm nine volt battery',
}, 'detector text');
covered(partText('ions'), {
  [`drawn ${f0(M.timesLarger(M.ION))} times larger`]: 'drawn 4 times larger',
  [`${f0(P.CHAMBER.sensing)} mm from the source`]: '15 mm from the source',
  [`the left, ${f1(P.CHAMBER.reference)} mm, both ${f0(P.CHAMBER.radius)} mm in radius`]: 'the left, 24.7 mm, both 10 mm in radius',
}, 'ions text');
covered(partText('source'), {
  [`drawn ${f0(M.timesLarger(M.BUTTON))} times larger across and ${f0(M.THROUGH / M.MM)} times larger through`]: 'drawn 15 times larger across and 150 times larger through',
  [`a disc ${f1(P.AMERICIUM.diameter)} mm across and ${f1(P.AMERICIUM.thickness)} mm thick`]: 'a disc 5.1 mm across and 0.2 mm thick',
  [`one ${f3(P.LINES[0][0])} MeV alpha`]: 'one 5.486 MeV alpha',
}, 'source text');
covered(partText('chamber'), {
  [`drawn ${f1(M.timesLarger(M.OPTIC))} times larger`]: 'drawn 2.5 times larger',
  [`emitter at ${f0(P.EMITTER.wavelength * 1e9)} nm`]: 'emitter at 940 nm',
  [`the smoke it lights ${f0(P.OPTICS.source)} mm away, the photodiode ${f0(P.OPTICS.sensor)} mm off the beam, and a second photodiode ${f0(P.OPTICS.direct)} mm down`]: 'the smoke it lights 12 mm away, the photodiode 12 mm off the beam, and a second photodiode 30 mm down',
}, 'chamber text');
covered(partText('circuit'), {}, 'circuit text');
covered(partText('chart'), {[`every ${f0(M.CHART.tickEvery)} seconds`]: 'every 60 seconds'}, 'chart text');
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Chamber current,Detect input,Smoke inside,Scattered light,Straight through,Alarms,Battery,Sped up', 'nine readings, the first being the result');
  t.ok(find('Chamber current').value === '13.37 pA' && find('Detect input').value === '3.06 V' && find('Smoke inside').value === '0.0 mg/m³' && find('Scattered light').value === '0.0 nA' && find('Straight through').value === '100.00% of the beam' && find('Battery').value === '9.0 V' && find('Sped up').value === '20 times', 'the readings carry the lesson’s figures');
  t.ok(find('Alarms').value === 'ionization 266 s, photoelectric 410 s', 'and both alarm times');
  checkQuotedText(find('Chamber current').hint, {'58.8 pA it would carry': `${f1(P.SENSING.saturation * 1e12)} pA it would carry`, '23% of it': `${f0(100 * base.cleanRatio)}% of it`}, t);
  checkQuotedText(find('Detect input').hint, {'from 3.06 V toward the set point at 4.50 V': `from ${f2(base.cleanNode)} V toward the set point at ${f2(base.setPoint)} V`, 'every 1.67 s': `every ${f2(P.IONIZATION_IC.period)} s`, 'down 100 mV': `down ${f0(P.IONIZATION_IC.hysteresis * 1000)} mV`}, t);
  checkQuotedText(find('Scattered light').hint, {'56.1 nA limit': `${f1(P.PHOTO_LIMIT * 1e9)} nA limit`, '30 of the RE46C190’s 31 steps': `${P.OPTICS.limitSteps} of the ${P.PHOTO_IC.name}’s ${P.PHOTO_IC.steps} steps`, 'every 10.7 s': `every ${f1(P.PHOTO_IC.period)} s`}, t);
  checkQuotedText(find('Straight through').hint, {'30 mm down the beam': `${f0(P.OPTICS.direct)} mm down the beam`, '400 μA': `${f0(base.cleanBeam * 1e6)} μA`, '10 m of it': `${f0(P.OPTICS.room)} m of it`}, t);
  checkQuotedText(find('Battery').hint, {'7.5 V trip': `${f1(P.CHAMBER.lowBattery)} V trip`, 'between 2,900 and 3,500 Hz at 95 dB from 3 ft': `between ${f0(P.RATED.tone[0])} and ${f0(P.RATED.tone[1])} Hz at ${f0(P.RATED.loud)} dB from ${f0(P.RATED.loudAt)} ft`}, t);
  checkQuotedText(find('Sped up').hint, {'600 s is drawn in 30 s': `${f0(P.SMOKE.duration)} s is drawn in ${f0(P.SMOKE.duration / P.SMOKE.speed)} s`}, t);
  model.update({battery: 7});
  const low = model.getState().readings.find(item => item.label === 'Battery');
  t.ok(low.hint.includes('Below the 7.5 V trip') && low.hint.includes('chirps'), 'and a low battery says so');
}

for (const lesson of [L.smokeDetectorLesson, L.ionizationDetectorLesson, L.opticalDetectorLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  t.ok(lesson.steps.length === 5 && lesson.parts.length >= 5 && lesson.tryIt.length >= 6 && lesson.deeper.length >= 5, 'five steps, parts, trials and deeper sections enough');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part it names is drawn');
}
t.ok(safetyLessons['Smoke detector'] === L.smokeDetectorLesson, 'the smoke detector’s lesson');
for (const [name, lesson, part, values] of [['Ionization smoke detector', L.ionizationDetectorLesson, 'ions', {size: 0.1}], ['Optical smoke detector', L.opticalDetectorLesson, 'chamber', {size: 3}]]) {
  const component = houseComponents[name];
  t.ok(component.machine === 'Smoke detector' && component.part === part && component.lesson === lesson && component.intro === lesson.simple && component.view === 'front' && component.isolate === false, `${name} routes to the smoke detector’s ${part} with its own lesson`);
  assert.deepEqual(component.values, values);
  t.ok(lesson.tryIt.some(item => item.values.size === values.size), `${name}: its trials start from that smoke`);
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [low, high, step] = P.SMOKE_DOMAINS[control.key]; t.ok(control.min === low && control.max === high && control.step === step && control.initial === P.SMOKE_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'size,growth,battery,angle', 'four controls');
assert.deepEqual(P.SIZE_OPTIONS.map(option => option.value), [0.1, 0.3, 1, 3]);
t.ok(P.SIZE_OPTIONS.every(option => option.value >= P.SMOKE_DOMAINS.size[0] && option.value <= P.SMOKE_DOMAINS.size[1]), 'every size offered is inside the domain');
const drawing = () => [T.positives.count, T.negatives.count, T.smokes.count, Array.from(T.positives.instanceMatrix.array.slice(0, 48)), T.gaugeBars.map(bar => bar.scale.y), T.scatterDiode.position.x, T.scatterDiode.position.y, pointsOf(T.ionGuide).slice(0, 12), pointsOf(T.photoGuide).slice(0, 12), pointsOf(T.tracks).length, T.chamberSmoke.count];
checkControlsMove(model, drawing, item => item.advance(3), t);
checkRefusals(P.sampleSmoke, P.SMOKE_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the run');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, P.SMOKE.speed, 1e-9, 'a step of one second is 20 seconds of the run');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'and it changes the readings');
  t.ok(!model.playback.complete() && !model.resultPart.available() && !model.playback.blocked(), 'no result to inspect partway through');
  model.animate(0);
  model.animate(1.5);
  t.near(model.getState().clock, 1.5 * P.SMOKE.speed + P.SMOKE.speed, 1e-9, 'animation carries the run on by the time that passed');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available(), 'the run over, with a result to inspect');
  t.near(model.getState().clock, P.SMOKE.duration, 1e-12, 'and the clock stops at the end of the run');
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length === 9 && model.parts.some(part => part.id === action.part), `${action.label} returns readings and names a part`);
    checkFinite(model.root, t);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  for (const values of settings) for (const time of [0, 60, 600]) {
    model.reset();
    model.update(values);
    model.advance(time / P.SMOKE.speed);
    t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
    checkFinite(model.root, t);
  }
}
const released = checkDisposal((() => { const fresh = M.createSmokeDetectorModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS smoke detector: ${t.count} checks, ${counts.rows} ASTAR rows integrated again, ${counts.alphas} alpha tracks by Monte Carlo, ${counts.steps} Runge-Kutta steps, ${counts.angles} scattering angles integrated, ${counts.dots} ion and smoke dots read back, ${counts.poses} poses, ${counts.points} track and chart points, ${counts.numbers} quoted numbers traced, 3 lessons, ${released} resources released exactly once.`);

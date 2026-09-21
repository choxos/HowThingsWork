// Checks the Blu-ray player and its CD, DVD, CD-ROM and optical-disc readout
// lessons against their sources typed in again and their physics worked out by
// other routes: the CD's frame and sector and the DVD's sector counted up, spin
// speeds and spiral lengths against the pages, the lens's transfer function
// measured as the overlap of two circles, the spot's blur rebuilt from the Airy
// pattern itself and the swings from a Fourier series, the ladder and the rows
// held to each code's limits, and every drawn pit, curve, wave and cone read
// back off the scene at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './optical-physics.js';
import * as BR from './blu-ray-model.js';
import * as L from './optical-lessons.js';
import {houseComponents} from './house-components.js';
import {studyLessons} from './study-lessons.js';

const t = tally();
const counts = {edges: 0, swings: 0, runs: 0, pits: 0, points: 0, waves: 0, poses: 0, numbers: 0};
const deg = radians => radians * 180 / Math.PI;
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-15;
const um = nm => nm / 1000;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the pages' own numbers.
// ---------------------------------------------------------------------------

const SRC = {
  CD: {wavelength: 780, aperture: 0.45, pitch: 1.6 * 1000, scanning: [1.2, 1.4], rate: 4.3218e6, zeros: [2, 10], plastic: 1.2, index: 1.55, diameters: [50, 116]},
  DVD: {wavelength: 650, aperture: 0.6, pitch: 0.74 * 1000, velocity: 3.49, rate: 26.15625e6, zeros: [2, 10], bit: [133.3, 1.4], halves: 0.6, index: 1.55, diameters: [48, 116]},
  BD: {wavelength: 405, aperture: 0.85, pitch: 320, velocity: 4.917, clock: 66e6, runs: [2, 8], cover: 0.1, substrate: 1.1, dataRate: 36e6},
  audio: {rate: 44100, bits: 16, channels: 2},
  pages: {cdRpm: [500, 200], cdPits: [830, 3000], cdPitsOther: 3.5, cdDepths: [100, 150], cdArea: 86.05, cdKm: 5.38, cdMinutes: 74, dvdRpm: [1400, 580], dvdGB: 4.7, dvdPit: 400, bdRpm: 810, bdSpot: 580, bdPit: 150, spots: [2.1, 1.3, 0.6], bdGB: 25, circ: [4000, 2.5, 12000, 7.5], cdRomSectors: 333000, cdRomMiB: 650, cdRomMinutes: 74, drive: [1 / 4, 1 / 6], clv: [495, 212], lasers: [405, 650, 660, 785]},
  ecma: {cdHF: [720, 196], cdI3: [0.3, 0.7], cdI11: 0.6, dvdI3: 0.15, syncCode: '0001001001000100 0000000000010001', channelFrame: [24, 3, 14, 3, 32, 17]},
};
const [CD, DVD, BD] = P.FORMATS, FORMATS3 = [CD, DVD, BD];
const DEPTHS = [['A quarter wavelength', 1 / 4], ['A sixth of a wavelength', 1 / 6], ['An eighth of a wavelength', 1 / 8], ['Half a wavelength', 1 / 2]];
t.ok(P.DEPTHS.length === DEPTHS.length && P.DEPTHS.every((depth, i) => depth.label === DEPTHS[i][0]), 'four depths, in the order the controls offer them');
t.ok(CD.name === 'CD' && DVD.name === 'DVD' && BD.name === 'Blu-ray', 'formats in the order CD, DVD, Blu-ray, as the component values name them');
for (const [format, source] of [[CD, SRC.CD], [DVD, SRC.DVD]]) {
  t.ok(format.wavelength === source.wavelength && format.aperture === source.aperture && format.pitch === source.pitch, `${format.name}: wavelength, aperture and pitch as its standard gives`);
  t.ok(format.shortest === source.zeros[0] + 1 && format.longest === source.zeros[1] + 1, `${format.name}: two to ten zeros between ones make runs of 3 to 11`);
  t.ok(format.inner === source.diameters[0] / 2 && format.outer === source.diameters[1] / 2, `${format.name}: data radii from the standard's diameters`);
}
t.ok(CD.velocity === SRC.CD.scanning[0] && CD.velocity <= SRC.CD.scanning[1], 'a CD read at 1.2 m/s, inside the standard’s 1.20 to 1.40 m/s');
t.near(CD.rate, SRC.CD.rate, relative(SRC.CD.rate), 'a CD’s 4.3218 Mbit/s');
t.ok(CD.cover === SRC.CD.plastic && P.INDEX === SRC.CD.index && P.INDEX === SRC.DVD.index, '1.2 mm of plastic of refractive index 1.55');
t.ok(DVD.velocity === SRC.DVD.velocity && DVD.rate === SRC.DVD.rate && DVD.cover === SRC.DVD.halves && DVD.backing === SRC.DVD.halves, 'a DVD’s 3.49 m/s, 26.15625 Mbit/s and 0.6 mm halves');
t.ok(Math.abs(P.bitLength(DVD) - SRC.DVD.bit[0]) <= SRC.DVD.bit[1], 'a DVD’s channel bit inside the standard’s 133.3 ± 1.4 nm');
t.ok(BD.wavelength === SRC.BD.wavelength && BD.aperture === SRC.BD.aperture && BD.pitch === SRC.BD.pitch && BD.velocity === SRC.BD.velocity && BD.rate === SRC.BD.clock && BD.userRate === SRC.BD.dataRate, 'Blu-ray as its pages give it');
t.ok(BD.shortest === SRC.BD.runs[0] && BD.longest === SRC.BD.runs[1] && BD.cover === SRC.BD.cover && BD.backing === SRC.BD.substrate, 'Blu-ray runs, cover and substrate');
t.ok(FORMATS3.every(format => Math.abs(format.cover + format.backing - 1.2) < 1e-12), 'every disc 1.2 mm thick');

const audioBits = SRC.audio.rate * SRC.audio.bits * SRC.audio.channels, F = P.CD_FRAME, S = P.CD_SECTOR;
t.ok(audioBits === 1411200 && CD.userRate === audioBits, '44,100 × 16 × 2 = 1,411,200 bits a second');
t.ok(P.AUDIO.rate === SRC.audio.rate && P.AUDIO.bits === SRC.audio.bits && P.AUDIO.channels === SRC.audio.channels, 'CD audio as the Compact Disc Digital Audio page gives it');
t.ok(F.audio === F.samples * SRC.audio.channels * SRC.audio.bits / 8 && F.audio + F.parity + F.subcode === 33, 'six stereo samples are 24 bytes, and a frame 33');
t.ok(P.frameBits() === 588 && SRC.ecma.channelFrame.slice(0, 4).reduce((a, b) => a + b, 0) + SRC.ecma.channelFrame[4] * SRC.ecma.channelFrame[5] === 588, 'ECMA-130 19.4: 588 channel bits in a frame, counted two ways');
t.ok(SRC.audio.rate / F.samples === 7350 && 7350 * 588 === CD.rate, '7,350 frames of 588 channel bits a second: a CD’s channel rate');
t.ok(CD.rate / (S.frames * 588) === S.perSecond && S.frames * F.audio === S.bytes, '75 sectors of 98 frames a second, 2,352 bytes each');
t.ok(S.sync + S.header + S.data + S.detection + S.zeros + S.pParity + S.qParity === S.bytes, 'the first mode’s sector adds up to 2,352 bytes');
t.ok(S.detection + S.zeros + S.pParity + S.qParity === 288 && S.pParity + S.qParity === 276, '288 bytes to detect and correct errors, 276 of them parity (CD-ROM page)');
t.ok(S.data * S.perSecond === 153600 && S.data * S.perSecond / 1024 === 150, '150 KiB a second');
t.ok(SRC.pages.cdRomSectors / S.perSecond === 4440 && 4440 / 60 === SRC.pages.cdRomMinutes, '333,000 sectors are 4,440 s, 74 minutes');
t.ok(fixed(SRC.pages.cdRomSectors * S.data / 2 ** 20, 1) === '650.4' && Math.round(SRC.pages.cdRomSectors * S.data / 2 ** 20) === SRC.pages.cdRomMiB, '650.4 MiB, the page’s 650 MiB');
t.ok(fixed(CD.rate / 6 / 1000, 0) === String(SRC.ecma.cdHF[0]) && fixed(CD.rate / 22 / 1000, 0) === String(SRC.ecma.cdHF[1]), 'ECMA-130 12.1’s 720 kHz and 196 kHz: the shortest and longest runs repeating');
t.ok(P.dvdSectorBits() === 38688 && SRC.ecma.syncCode.replace(' ', '').length === P.DVD_SECTOR.sync, 'a DVD sector: 26 × (32 + 1,456) channel bits, its sync codes 32 channel bits long');
t.ok(fixed(DVD.userRate / 1e6, 2) === '11.08', 'ECMA-267 annex M’s 11.08 Mbit/s');
t.ok(P.burstFrames() === 16 && P.burstFrames() * 32 * 8 === 4096 && Number((4096).toPrecision(1)) === SRC.pages.circ[0], 'CIRC: 4 parity symbols 4 frames apart rebuild 16 frames, 4,096 bits');

// J₁ by its power series and its asymptotic expansion, to find the dark rings again.
function besselJ1(x) {
  if (Math.abs(x) < 12) { let term = x / 2, sum = term; for (let k = 1; k < 60; k++) { term *= -(x * x / 4) / (k * (k + 1)); sum += term; } return sum; }
  const mu = 4, z = 8 * x, w = x - 3 * Math.PI / 4;
  const p = 1 - (mu - 1) * (mu - 9) / (2 * z * z) + (mu - 1) * (mu - 9) * (mu - 25) * (mu - 49) / (24 * z ** 4);
  const q = (mu - 1) / z - (mu - 1) * (mu - 9) * (mu - 25) / (6 * z ** 3) + (mu - 1) * (mu - 9) * (mu - 25) * (mu - 49) * (mu - 81) / (120 * z ** 5);
  return Math.sqrt(2 / (Math.PI * x)) * (p * Math.cos(w) - q * Math.sin(w));
}
for (const [i, zero] of P.J1_ZEROS.entries()) t.ok(Math.abs(besselJ1(zero)) < 1e-9 && besselJ1(zero - 1e-3) * besselJ1(zero + 1e-3) < 0, `J₁’s zero ${i + 1}, where a dark ring falls`);
t.ok(Math.abs(besselJ1(11.9999) - besselJ1(12.0001)) < 1e-4, 'J₁’s series and expansion meet');
t.near(2 * (4 / (3 * Math.PI)), (() => { let s = 0; const N = 2000; for (let i = 0; i <= N; i++) s += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * P.transfer(i / N); return 2 * s / N / 3; })(), 1e-6, 'the line spread at the middle, 8/(3π), from the transfer function');
t.ok(fixed(P.J1_ZEROS[0] / Math.PI, 2) === '1.22', 'the first dark ring 1.22 λ/NA across');
const spots = FORMATS3.map(P.spotAcross), bits = FORMATS3.map(P.bitLength), cutoffs = FORMATS3.map(P.cutoffPeriod);
t.ok(fixed(um(spots[0]), 2) === '2.11' && fixed(um(spots[1]), 2) === '1.32' && fixed(spots[2], 0) === '581', 'spots 2.11 μm, 1.32 μm and 581 nm');
t.ok([0, 1].every(i => fixed(um(spots[i]), 2) === fixed(um(1.22 * FORMATS3[i].wavelength / FORMATS3[i].aperture), 2)) && fixed(spots[2], 0) === fixed(1.22 * BD.wavelength / BD.aperture, 0), 'the rounded 1.22 moves no spot’s quoted rounding');
t.ok(Number(spots[2].toPrecision(2)) === SRC.pages.bdSpot, 'the Blu-ray page’s 580 nm spot');
t.ok(Number(um(spots[0]).toPrecision(2)) === SRC.pages.spots[0] && Number(um(spots[1]).toPrecision(2)) === SRC.pages.spots[1] && Number(um(spots[2]).toPrecision(1)) === SRC.pages.spots[2], 'the German page’s spot diameters, 2.1, 1.3 and 0.6 μm');
t.ok(fixed(bits[0], 1) === '277.7' && fixed(bits[1], 1) === '133.4' && fixed(bits[2], 1) === '74.5', 'channel bits of 277.7, 133.4 and 74.5 nm');
t.ok(fixed(cutoffs[0], 0) === '867' && fixed(cutoffs[1], 0) === '542' && fixed(cutoffs[2], 0) === '238', 'the finest periods sent back: 867, 542 and 238 nm');
t.ok(Number((3 * bits[0]).toPrecision(2)) === SRC.pages.cdPits[0] && Number((11 * bits[0]).toPrecision(1)) === SRC.pages.cdPits[1], 'a CD’s 833 nm to 3.05 μm, the page’s 830 nm to 3,000 nm');
t.ok(fixed(um(11 * 1.4 / CD.rate * 1e9), 2) === '3.56' && Math.abs(um(11 * 1.4 / CD.rate * 1e9) - SRC.pages.cdPitsOther) < 0.1, 'at 1.4 m/s the longest CD runs reach 3.56 μm, near the page’s 3.5 μm');
t.ok(Math.round(3 * bits[1]) === SRC.pages.dvdPit && Number((2 * bits[2]).toPrecision(2)) === SRC.pages.bdPit, 'the Blu-ray page’s 400 nm DVD pit and 150 nm Blu-ray pit');
for (const [i, format] of FORMATS3.entries()) t.ok(2 * format.shortest * bits[i] > cutoffs[i], `${format.name}: its shortest runs repeat coarser than the finest period sent back`);
t.ok(2 * 2 * bits[1] < cutoffs[1] && 2 * 1 * bits[2] < cutoffs[2] && 2 * 2 * bits[0] > cutoffs[0], 'one run shorter would vanish for a DVD and a Blu-ray Disc, not for a CD');

const rpm = (format, radius) => format.velocity / (2 * Math.PI * radius / 1000) * 60;
for (const format of FORMATS3) for (let radius = 25; radius <= 58; radius++) t.near(P.spinRate(format, radius), rpm(format, radius), relative(rpm(format, radius)), `${format.name} at ${radius} mm`);
t.ok(fixed(rpm(CD, 25), 0) === '458' && fixed(rpm(CD, 58), 0) === '198' && Number(rpm(CD, 25).toPrecision(1)) === SRC.pages.cdRpm[0] && Number(rpm(CD, 58).toPrecision(1)) === SRC.pages.cdRpm[1], 'a CD’s 458 and 198 rpm, the page’s about 500 and 200');
t.ok(fixed(rpm(DVD, 24), 0) === '1,389' && Number(rpm(DVD, 24).toPrecision(2)) === SRC.pages.dvdRpm[0] && fixed(rpm(DVD, 57.5), 0) === String(SRC.pages.dvdRpm[1]), 'the DVD page’s 1,400 and 580 rpm at 24 and 57.5 mm');
t.ok(fixed(rpm(BD, 58), 0) === String(SRC.pages.bdRpm) && fixed(rpm(BD, 24), 0) === '1,956' && fixed(rpm(BD, 25), 0) === '1,878', 'Blu-ray at 810 rpm at the rim');
for (const format of FORMATS3) {
  const N = 2000, h = (format.outer - format.inner) / N;
  let sum = 0;
  for (let i = 0; i <= N; i++) sum += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * 2 * Math.PI * (format.inner + i * h) / (format.pitch / 1e6);
  const turned = sum * h / 3 / 1000;
  t.near(P.trackLength(format), turned, relative(turned, 1e-9), `${format.name}: the spiral’s length by area over pitch and turn by turn`);
}
t.ok(fixed(Math.PI * (58 ** 2 - 25 ** 2) / 100, 2) === String(SRC.pages.cdArea) && fixed(P.trackLength(CD) / 1000, 2) === String(SRC.pages.cdKm), 'the compact disc page’s 86.05 cm² and 5.38 km');
t.ok(fixed(P.playTime(CD) / 60, 1) === '74.7' && fixed(P.turnsOf(CD), 0) === '20,625' && fixed(P.turnsOf(DVD), 0) === '45,946' && fixed(P.turnsOf(BD), 0) === '106,250', '74.7 minutes, and 20,625, 45,946 and 106,250 turns');
t.ok(fixed(P.trackLength(DVD) / 1000, 2) === '11.84' && fixed(P.capacityOf(DVD) / 1e9, 2) === '4.70' && Number((P.capacityOf(DVD) / 1e9).toPrecision(2)) === SRC.pages.dvdGB && fixed(P.trackLength(DVD) / (bits[1] / 1e9) / 1e9, 1) === '88.7', 'a DVD: 11.84 km, 88.7 billion channel bits, 4.70 GB');
t.ok(fixed(P.trackLength(BD) / 1000, 2) === '27.37' && fixed(P.trackLength(BD) / (bits[2] / 1e9) / 1e9, 0) === '367' && fixed(P.capacityOf(BD) / 1e9, 2) === '25.05' && Math.round(P.capacityOf(BD) / 1e9) === SRC.pages.bdGB, 'a Blu-ray Disc: 27.37 km, 367 billion channel bits, 25.05 GB');
t.near(DVD.userRate * P.dvdSectorBits(), DVD.rate * 16384, relative(DVD.rate * 16384), '16,384 of every 38,688 channel bits are data');
t.ok(16384 === P.DVD_SECTOR.data * 8, 'a sector’s 2,048 bytes are 16,384 bits');
const programSectors = P.playTime(CD) * S.perSecond;
t.ok(fixed(programSectors, 0) === '336,126' && fixed(programSectors * S.data / 2 ** 20, 1) === '656.5', 'the program area: 336,126 sectors, 656.5 MiB');
t.ok(fixed(CD.pitch * bits[0] / (DVD.pitch * bits[1]), 1) === '4.5' && fixed(4.7e9 / (SRC.pages.cdRomSectors * S.data), 2) === '6.89' && 4.7e9 / (SRC.pages.cdRomSectors * S.data) < 7, 'a DVD: 4.5 times the channel bits a square millimeter and 6.89 times the data, nearly seven');
t.ok(fixed(P.burstFrames() * 588 * bits[0] / 1e6, 2) === '2.61' && fixed(um(588 * bits[0]), 0) === '163', '16 frames are 2.61 mm of CD track; one is 163 μm');
t.ok(fixed(deg(P.coneAngle(BD)), 1) === '58.2' && fixed(deg(P.coneAngle(BD, 1.55)), 1) === '33.3' && fixed(deg(P.coneAngle(CD)), 1) === '26.7' && fixed(deg(P.coneAngle(DVD)), 1) === '36.9', 'cones of 58.2°, 33.3° inside, 26.7° and 36.9°');
t.ok(fixed(CD.wavelength / 1.55, 0) === '503' && fixed(P.depthOf(CD, 1 / 4), 0) === '126' && fixed(P.depthOf(BD, 1 / 4), 1) === '65.3' && fixed(BD.wavelength / 1.55, 1) === '261.3' && fixed(P.depthOf(BD, 1 / 6), 1) === '43.5', 'depths of 126, 65.3 and 43.5 nm');
t.ok(fixed(P.secondDarkRing(BD), 0) === '532' && fixed(spots[2] / 2, 0) === '291', 'Blu-ray’s dark rings 291 nm and 532 nm from the middle');
for (const share of P.DEPTHS.map(depth => depth.share)) {
  const phase = 2 * Math.PI * 2 * share, field = Math.hypot(0.5 + 0.5 * Math.cos(phase), 0.5 * Math.sin(phase));
  t.near(P.longPitLevel(share), field ** 2, 1e-15, `two equal halves of light ${share} of a wavelength deep`);
}
t.ok(P.DEPTHS[0].share === SRC.pages.drive[0] && P.DEPTHS[1].share === SRC.pages.drive[1] && P.longPitLevel(1 / 4) < 1e-30 && P.longPitLevel(1 / 2) === 1, 'the drive page’s quarter and sixth: a quarter cancels, a half is in step');

// ---------------------------------------------------------------------------
// 2. The spot's blur, by other routes.
// ---------------------------------------------------------------------------

for (let i = 0; i <= 20; i++) {
  const v = i / 20, top = Math.sqrt(Math.max(0, 1 - v * v)), N = 4000;
  let area = 0;
  for (let k = 0; k <= N; k++) { const y = -top + 2 * top * k / N; area += (k === 0 || k === N ? 1 : k % 2 ? 4 : 2) * Math.max(0, 2 * (Math.sqrt(Math.max(0, 1 - y * y)) - v)); }
  area *= 2 * top / N / 3;
  t.near(P.transfer(v), area / Math.PI, 2e-5, `the transfer function at ${v}: two circles’ overlap`);
}

// The line spread from the Airy pattern itself, lengths in cutoff periods, and
// the edge spread as its running integral.
const airy = rho => { const v = Math.PI * rho; return v < 1e-9 ? 1 : (2 * besselJ1(v) / v) ** 2; };
const REACH = 60, STEP = 0.01, TAIL = Math.PI / 4 * 4 / (Math.PI ** 4 * REACH ** 2);
function airyLine(xi) {
  const n = Math.round(REACH / STEP);
  let sum = 0;
  for (let k = 0; k <= n; k++) sum += (k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * airy(Math.hypot(xi, k * STEP));
  return Math.PI / 4 * 2 * sum * STEP / 3 + TAIL;
}
const EDGE_STEP = 0.05, EDGE_TO = 6, airyEdge = [0.5];
{
  const lines = Array.from({length: Math.round(EDGE_TO / EDGE_STEP) * 2 + 1}, (_, k) => airyLine(k * EDGE_STEP / 2));
  for (let k = 1; k <= Math.round(EDGE_TO / EDGE_STEP); k++) airyEdge.push(airyEdge[k - 1] + (lines[2 * k - 2] + 4 * lines[2 * k - 1] + lines[2 * k]) * EDGE_STEP / 6);
}
const edgeFromAiry = xi => {
  const a = Math.abs(xi);
  let value;
  if (a >= EDGE_TO) value = 1 - 2 / (Math.PI ** 3 * a);
  else { const u = a / EDGE_STEP, j = Math.min(Math.floor(u), airyEdge.length - 2), f = u - j; value = airyEdge[j] * (1 - f) + airyEdge[j + 1] * f; }
  return xi < 0 ? 1 - value : value;
};
for (let k = 0; k < airyEdge.length; k++) { t.near(P.edgeSpread(k * EDGE_STEP), airyEdge[k], 6e-4, `the edge spread at ${k * EDGE_STEP}: rebuilt from the Airy pattern`); counts.edges++; }
t.near(P.edgeSpread(EDGE_TO), 1 - 2 / (Math.PI ** 3 * EDGE_TO), 2e-4, 'the edge spread’s tail, 1 − 2/(π³ξ)');
t.near(P.edgeSpread(P.EDGE.reach - 1e-9), P.edgeSpread(P.EDGE.reach), 1e-5, 'the table meets its tail');

const fourierSwing = (format, n) => {
  const period = 2 * n * P.bitLength(format);
  let sum = 0;
  for (let k = 1; k < 4000; k += 2) sum += 2 / (Math.PI * k) * ((k - 1) / 2 % 2 ? -1 : 1) * P.transfer(k * P.cutoffPeriod(format) / period);
  return 2 * sum;
};
for (const format of FORMATS3) {
  for (let n = 1; n <= 14; n++) {
    const levels = P.patternLevels(format, n), swing = fourierSwing(format, n);
    t.near(levels.pit - levels.land, swing, 3e-4, `${format.name}: runs of ${n} swing the light as the Fourier series says`);
    t.near((levels.pit + levels.land) / 2, 0.5, 3e-4, `${format.name}: runs of ${n} sit about half the long pit’s dimming`);
    counts.swings++;
  }
}
t.ok(fourierSwing(DVD, 2) === 0 && fourierSwing(BD, 1) === 0 && fourierSwing(CD, 2) > 0.1, 'runs one shorter than a DVD’s or a Blu-ray Disc’s send nothing back; a CD’s would');
const standard = plan => { const top = 1 - plan.dimming * plan.longestLevels.land; return {i3: plan.dimming * (plan.shortestLevels.pit - plan.shortestLevels.land) / top, i11: plan.dimming * (plan.longestLevels.pit - plan.longestLevels.land) / top}; };
{
  const [quarter, sixth, eighth] = [0, 1, 2].map(depth => standard(P.readPlan({format: 0, depth})));
  t.ok(quarter.i3 >= SRC.ecma.cdI3[0] && quarter.i3 <= SRC.ecma.cdI3[1] && quarter.i11 >= SRC.ecma.cdI11, 'a quarter-wave CD meets ECMA-130 12.2');
  t.ok(sixth.i3 >= SRC.ecma.cdI3[0] && sixth.i3 <= SRC.ecma.cdI3[1] && sixth.i11 >= SRC.ecma.cdI11, 'so does a sixth-wave CD');
  t.ok(eighth.i3 < SRC.ecma.cdI3[0] && eighth.i11 < SRC.ecma.cdI11, 'an eighth-wave CD fails both');
  const three = P.patternLevels(DVD, 3), fourteen = P.patternLevels(DVD, 14);
  t.ok((three.pit - three.land) / (fourteen.pit - fourteen.land) >= SRC.ecma.dvdI3, 'a DVD meets ECMA-267’s I3/I14 of 0.15');
}
for (const [index, format] of FORMATS3.entries()) {
  const layout = P.layoutOf(index), scale = P.bitLength(format) / P.cutoffPeriod(format);
  for (let j = 0; j < layout.blur.length; j += 3) {
    const s = j / P.READ.samples;
    let expected = 0;
    for (const [start, end] of layout.read.pits) expected += edgeFromAiry((s - start) * scale) - edgeFromAiry((s - end) * scale);
    t.near(layout.blur[j], expected, 3e-3, `${format.name}: the blur ${s} channel bits along, from the Airy pattern`);
    counts.points++;
  }
}

// ---------------------------------------------------------------------------
// 3. The ladder and the rows, held to each code's limits.
// ---------------------------------------------------------------------------

for (const [index, format] of FORMATS3.entries()) {
  const layout = P.layoutOf(index), bit = P.bitLength(format), ladder = [];
  for (let n = format.shortest; n <= format.longest; n++) ladder.push(n);
  assert.deepEqual([...layout.ladder], ladder);
  t.ok(layout.length === 2 * ladder.reduce((a, b) => a + b, 0), `${format.name}: the ladder is a pit and a land of every run`);
  const rows = Math.floor((3000 - format.pitch * 5 / 32) / format.pitch);
  t.ok(layout.rows.length === 2 * rows + 1 && layout.rows.every((row, i) => row.row === i - rows && row.offset === (i - rows) * format.pitch), `${format.name}: rows one pitch apart across the close up`);
  for (const row of layout.rows) {
    for (let j = 0; j < row.pits.length; j++) {
      const [start, end] = row.pits[j];
      t.ok(Number.isInteger(start) && Number.isInteger(end) && end - start >= format.shortest && end - start <= format.longest, `${format.name}: every pit within its code`);
      if (j > 0) { const land = start - row.pits[j - 1][1]; t.ok(land >= format.shortest && land <= format.longest, `${format.name}: every land within its code`); }
      counts.runs++;
    }
    t.ok(row.pits[0][0] * bit < -4000 - format.longest * bit && row.pits.at(-1)[1] * bit > layout.length * bit + 4000, `${format.name}: row ${row.row} fills the close up all the way through`);
  }
  const inLadder = layout.read.pits.filter(([start, end]) => end > 0 && start < layout.length), edges = [];
  let p = 0;
  for (const n of ladder) { edges.push(p, p + n); p += 2 * n; }
  assert.deepEqual(inLadder.map(pair => [...pair]), ladder.map((n, i) => { const at = 2 * ladder.slice(0, i).reduce((a, b) => a + b, 0); return [at, at + n]; }));
  t.ok(layout.read.pits.some(([start]) => start === layout.length) && !layout.read.pits.some(([start, end]) => start < 0 && end > 0), `${format.name}: land before the ladder and a pit after it`);
  assert.deepEqual([...layout.edges], edges);
  const plan = P.readPlan({format: index});
  for (let s = 0; s <= layout.length; s += 0.25) {
    const now = P.readAt(plan, s / P.READ.bitsPerSecond);
    let expected = null, at = 0;
    for (const n of ladder) { if (s < at + n) { expected = {kind: 'pit', n, start: at}; break; } if (s < at + 2 * n) { expected = {kind: 'land', n, start: at + n}; break; } at += 2 * n; }
    assert.deepEqual(now.run, expected);
    t.ok(now.ones === edges.filter(edge => edge < s).length && now.bits === Math.floor(s + 1e-9), `${format.name}: ones and channel bits read by ${s}`);
    t.near(now.light, 1 - plan.dimming * now.blur, 1e-15, `${format.name}: the light is the blur dimmed`);
  }
  t.near(plan.duration, layout.length / 10, 1e-12, `${format.name}: the ladder read at 10 channel bits a second`);
}

// ---------------------------------------------------------------------------
// 4. The drawing, read back.
// ---------------------------------------------------------------------------

const model = BR.createBluRayModel(), T = model.topology;
const CHART = {x: 1.1, y: -0.42, w: 0.8, h: 0.35}, SPIN = {x: -1.85, y: -0.25, w: 0.8, h: 0.6};
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const waveAt = (format, path) => 30 * Math.sin(2 * Math.PI * path * 1.55 / format.wavelength);
const lensToDisc = [];
for (const [index, format] of FORMATS3.entries()) {
  for (let depth = 0; depth < 4; depth++) {
    const radius = [25, 41, 58][(index + depth) % 3], values = {format: index, radius, depth}, plan = P.readPlan(values);
    for (const time of [0, 0.3, 2.35, plan.duration / 2, plan.duration]) {
      model.reset();
      model.update(values);
      model.advance(time);
      model.root.updateMatrixWorld(true);
      const state = model.getState(), now = P.readAt(plan, time), bit = plan.bit;
      counts.poses++;

      // Pits: every box as the rows say, clipped to 8 μm by 6 μm, raised to the pits' depth.
      const expected = [];
      for (const row of plan.layout.rows) for (const [start, end] of row.pits) {
        const x0 = Math.max(-4000, (start - now.travel) * bit), x1 = Math.min(4000, (end - now.travel) * bit);
        if (x1 > x0) expected.push([x0, x1, row.offset - format.pitch * 5 / 32, row.offset + format.pitch * 5 / 32, x0 > -4000 && x1 < 4000, end - start]);
      }
      const geometry = T.pits.geometry, array = geometry.attributes.position.array, drawn = geometry.drawRange.count / 30;
      t.ok(drawn === expected.length && drawn <= BR.PIT_ROOM, `${format.name}: ${expected.length} pits drawn`);
      for (let b = 0; b < drawn; b++) {
        const xs = [], ys = [], zs = [];
        for (let v = 0; v < 20; v++) { xs.push(array[b * 60 + 3 * v] / 1e-4); ys.push(array[b * 60 + 3 * v + 1] / 1e-4); zs.push(array[b * 60 + 3 * v + 2] / 1e-4); }
        const [x0, x1, y0, y1, whole, run] = expected[b];
        t.ok(Math.abs(Math.min(...xs) - x0) < 0.05 && Math.abs(Math.max(...xs) - x1) < 0.05 && Math.abs(Math.min(...ys) - y0) < 0.05 && Math.abs(Math.max(...ys) - y1) < 0.05, `${format.name}: pit ${b} where its row puts it`);
        t.ok(Math.abs(Math.min(...zs)) < 1e-3 && Math.abs(Math.max(...zs) - DEPTHS[depth][1] * format.wavelength / 1.55) < 0.01, `${format.name}: pit ${b} raised as deep as its depth`);
        t.ok(Math.min(...xs) >= -4000.05 && Math.max(...xs) <= 4000.05 && Math.min(...ys) >= -3000.05 && Math.max(...ys) <= 3000.05, `${format.name}: pit ${b} inside the close up`);
        if (whole) t.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) / bit - run) < 1e-3 && run >= format.shortest && run <= format.longest, `${format.name}: a whole pit is a whole run of channel bits`);
        counts.pits++;
      }

      // The spot and its second dark ring, 10,000 times larger.
      t.ok(T.spot.scale.x === P.spotAcross(format) / 2 * 1e-4 && T.spot.scale.y === T.spot.scale.x, `${format.name}: the spot drawn to its first dark ring`);
      const ringRadii = pointsOf(T.ring).map(([x, y]) => Math.hypot(x, y) / 1e-4);
      t.ok(ringRadii.length === 65 && ringRadii.every(r => Math.abs(r - P.J1_ZEROS[1] / (2 * Math.PI) * format.wavelength / format.aperture) < 0.01), `${format.name}: the second dark ring`);

      // The light sent back, and the pit edges read.
      const curve = pointsOf(T.signalCurve), length = plan.layout.length;
      if (time > 0) {
        const read = Math.floor(now.travel * 4 + 1e-9);
        t.ok(curve.length === Math.min(read, plan.layout.blur.length - 1) + 2, `${format.name}: the curve drawn as far as read`);
        for (let j = 0; j < curve.length - 1; j++) {
          t.near(curve[j][0], CHART.x + j / 4 / length * CHART.w, 1e-6, 'curve across');
          t.near(curve[j][1], CHART.y + (1 - plan.dimming * plan.layout.blur[j]) * CHART.h, 1e-6, 'curve up');
          counts.points++;
        }
        t.near(curve.at(-1)[0], CHART.x + now.travel / length * CHART.w, 1e-6, 'the curve ends under the spot');
        t.near(curve.at(-1)[1], CHART.y + now.light * CHART.h, 1e-6, 'at the light it sends back');
      } else t.ok(!T.signalCurve.visible, 'nothing read before Play');
      t.ok(pointsOf(T.edgeTicks).length === 2 * now.ones, `${format.name}: a tick for every edge read`);
      const cursor = pointsOf(T.signalCursor);
      t.near((cursor[0][0] + cursor[1][0]) / 2, CHART.x + now.travel / length * CHART.w, 1e-6, 'the cursor across');
      t.near(cursor[0][1], CHART.y + now.light * CHART.h, 1e-6, 'the cursor up');
      t.near(pointsOf(T.levelLine)[0][1], CHART.y + Math.cos(2 * Math.PI * DEPTHS[depth][1]) ** 2 * CHART.h, 1e-6, 'the long pit’s level line');
      const guide = pointsOf(T.signalGuide);
      t.ok(guide.length === plan.layout.blur.length, `${format.name}: the whole ladder drawn faintly`);
      for (let j = 0; j < guide.length; j += 7) { t.near(guide[j][0], CHART.x + j / 4 / length * CHART.w, 1e-6, 'the faint curve across'); t.near(guide[j][1], CHART.y + (1 - plan.dimming * plan.layout.blur[j]) * CHART.h, 1e-6, 'the faint curve up'); counts.points++; }

      // The pit cut open: the bump's depth and the waves, worked out again.
      const d = DEPTHS[depth][1] * format.wavelength / 1.55;
      t.near(T.bump.scale.y, d * 1e-3, 1e-12, `${format.name}: the bump ${d} nm high, 100,000 times larger`);
      t.near(T.bump.position.y, -d / 2 * 1e-3, 1e-12, 'hanging from the land toward the laser');
      const lines = {
        landIn: [-600, 0, -290, y => y + 600], landOut: [0, -600, -220, y => 600 - y], bumpIn: [-600, -d, -35, y => y + 600], bumpOut: [-d, -600, 35, y => 600 - 2 * d - y],
        landBack: [-690, -990, -220, y => 600 - y], bumpBack: [-690, -990, 0, y => 600 - 2 * d - y],
      };
      for (const [name, [y0, y1, x, path]] of Object.entries(lines)) {
        const drawnWave = pointsOf(T.waves[name]);
        t.ok(drawnWave.length === 64, `${name}: 64 points`);
        drawnWave.forEach(([px, py], i) => { const y = y0 + (y1 - y0) * i / 63; t.ok(Math.abs(py / 1e-3 - y) < 1e-3 && Math.abs(px / 1e-3 - (x + waveAt(format, path(y)))) < 1e-3, `${name}: point ${i}`); counts.waves++; });
      }
      const sum = pointsOf(T.waves.sum), swingOfSum = Math.max(...sum.map(([px]) => Math.abs(px / 1e-3 - 220))), bound = 30 * Math.abs(Math.cos(2 * Math.PI * DEPTHS[depth][1]));
      sum.forEach(([px, py], i) => { const y = -690 - 300 * i / 63; t.ok(Math.abs(px / 1e-3 - (220 + (waveAt(format, 600 - y) + waveAt(format, 600 - 2 * d - y)) / 2)) < 1e-3, `the average wave, point ${i}`); counts.waves++; });
      t.ok(swingOfSum <= bound + 1e-3 && (bound < 3 || swingOfSum > 0.95 * bound), `${format.name}: the average swings ${fixed(bound, 1)} nm, cos of the half phase`);

      // Spin: the cursor, the curves, and the disc turning the way it reads.
      const spinCursor = pointsOf(T.spinCursor), spinAt = rpm(format, radius);
      t.near((spinCursor[0][0] + spinCursor[1][0]) / 2, SPIN.x + (radius - 20) / 40 * SPIN.w, 1e-6, 'the spin cursor across');
      t.near(spinCursor[0][1], SPIN.y + spinAt / 2000 * SPIN.h, 1e-6, 'the spin cursor up');
      T.spinCurves.forEach((line, i) => t.ok(line.material.color.getHex() === (i === index ? 0x374736 : 0x9aa39a), 'the chosen disc’s curve is dark'));
      t.near(T.spinner.rotation.y, -(format.velocity / (radius / 1000)) * Math.min(time, plan.duration) / 100, 1e-12, `${format.name}: the disc turned 100 times slower`);
      t.near(T.sled.position.x, radius * 0.01, 1e-15, `${format.name}: the sled at ${radius} mm`);

      // The pickup's cone: angles and thicknesses read back, and Snell's law between them.
      const beam = pointsOf(T.pickupBeam), cover = format.cover * 0.4;
      for (const offset of [0, 12]) {
        const [a, b, c, e] = [beam[offset + 4], beam[offset + 5], beam[offset + 6], beam[offset + 7]];
        const inAir = Math.atan2(Math.abs(b[0] - a[0]), b[1] - a[1]), inPlastic = Math.atan2(Math.abs(e[0] - c[0]), e[1] - c[1]);
        t.near(inAir, Math.asin(format.aperture), 2e-6, `${format.name}: the cone in air at asin NA`);
        t.near(inPlastic, Math.asin(format.aperture / 1.55), 2e-6, `${format.name}: the cone in plastic`);
        t.near(Math.sin(inAir), 1.55 * Math.sin(inPlastic), 3e-6, `${format.name}: Snell’s law at the plastic`);
        t.near(e[1] - c[1], cover, 1e-6, `${format.name}: ${format.cover} mm of plastic, 40 times larger`);
        t.ok(Math.abs(e[0]) < 1e-7, 'focused on the axis');
      }
      t.near(T.cover.scale.y, cover, 1e-7, 'the cover drawn as thick');
      t.ok(T.backing.visible === format.backing > 0, 'plastic behind the data only where there is some');
      lensToDisc.push(T.objective.scale.x);
    }
  }
}
t.ok(new Set(lensToDisc.map(a => a.toFixed(6))).size === 3, 'each disc’s lens drawn its own width');

// The disc at true size, its spiral, and which way it turns.
model.reset();
model.update({format: 0, radius: 40});
{
  const body = T.body.geometry.attributes.position.array, radii = [], heights = [];
  for (let i = 0; i < body.length; i += 3) { radii.push(Math.hypot(body[i], body[i + 2])); heights.push(body[i + 1]); }
  t.near(Math.max(...radii), 0.6, 1e-6, 'a 120 mm disc');
  t.near(Math.min(...radii), 0.075, 1e-6, 'a 15 mm hole');
  t.near(Math.max(...heights) - Math.min(...heights), 0.012, 1e-6, '1.2 mm thick');
  t.ok(T.dataZone.geometry.parameters.innerRadius === 0.25 && T.dataZone.geometry.parameters.outerRadius === 0.58, 'a CD’s music from 25 mm to 58 mm');
  const spiral = pointsOf(T.spiral).map(([x, y, z]) => [Math.hypot(x, z) / 0.01, Math.atan2(-z, x)]);
  t.near(spiral[0][0], 25, 1e-4, 'the spiral starts at the inner radius');
  t.near(spiral.at(-1)[0], 58, 1e-4, 'and ends at the outer');
  let unwrapped = spiral[0][1], growing = true;
  for (let i = 1; i < spiral.length; i++) { let step = spiral[i][1] - spiral[i - 1][1]; if (step < -Math.PI) step += 2 * Math.PI; if (step > Math.PI) step -= 2 * Math.PI; unwrapped += step; growing &&= step > 0 && spiral[i][0] > spiral[i - 1][0]; }
  t.ok(growing && Math.abs(unwrapped - spiral[0][1] - 2 * Math.PI * BR.SPIRAL_TURNS) < 1e-3, 'the spiral winds outward with its angle, 24 turns');
  const local = new THREE.Vector3(...pointsOf(T.spiral)[500]);
  const angleAt = time => { model.reset(); model.update({format: 0, radius: 40}); model.advance(time); T.spinner.updateMatrix(); const world = local.clone().applyMatrix4(T.spinner.matrix); return Math.atan2(-world.z, world.x); };
  t.ok(angleAt(0.2) < angleAt(0.1), 'the disc turns clockwise seen from the label side, counterclockwise seen from the laser, carrying the spiral outward past the spot (ECMA-130 11.2)');
}

// ---------------------------------------------------------------------------
// 5. The lessons: every number they quote is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1000); return model.getState(); };
const minLight = (state, a, b) => { let least = Infinity; for (let j = Math.round(a * 4); j <= Math.round(b * 4); j++) least = Math.min(least, 1 - state.dimming * state.layout.blur[j]); return least; };
const lastPit = state => { const n = state.layout.ladder.at(-1), start = state.layout.length - 2 * n; return minLight(state, start, start + n); };
checkTrialNumbers(L.bluRayLesson, {
  'Read the track': s => ({581: s.spot, 320: s.format.pitch, 149: s.shortestRun, 596: s.longestRun, 580: Number(s.spot.toPrecision(2)), 150: Number(s.shortestRun.toPrecision(2))}),
  'Short pits dim the light least': s => ({46: 100 * minLight(s, 0, s.layout.ladder[0]), 298: 2 * s.shortestRun, 238: s.cutoff, 8: 100 * lastPit(s)}),
  'A CD': s => ({'2.11': um(s.spot), '1.6': um(s.format.pitch), 833: s.shortestRun, '3.05': um(s.longestRun)}),
  'A DVD': s => ({'1.32': um(s.spot), '0.74': um(s.format.pitch), 400: s.shortestRun, '1.47': um(s.longestRun)}),
  'Out at the rim': s => ({58: s.radius, 810: s.rpm, '1,878': P.spinRate(s.format, 25), 25: 25, '4.917': s.format.velocity}),
  'A pit half a wavelength deep': s => { t.ok(s.level === 1 && s.dimming === 0, 'a pit half a wavelength deep dims nothing'); return {}; },
  'A pit a sixth of a wavelength deep': s => ({'43.5': s.depthNm, 31: 100 * lastPit(s)}),
}, run, t);
checkTrialNumbers(L.cdLesson, {
  'The spot and the track': s => ({780: s.format.wavelength, '2.11': um(s.spot), '1.6': um(s.format.pitch), 833: s.shortestRun, '3.05': um(s.longestRun), 830: Number(s.shortestRun.toPrecision(2)), '3,000': Number(s.longestRun.toPrecision(1))}),
  'Spin at the start': s => ({458: s.rpm, '1.2': s.format.velocity, 58: 58, 198: P.spinRate(s.format, 58), 500: Number(s.rpm.toPrecision(1)), 200: Number(P.spinRate(s.format, 58).toPrecision(1))}),
  'Read the pits': s => ({50: 100 * standard(s).i3, 30: 100 * SRC.ecma.cdI3[0], 70: 100 * SRC.ecma.cdI3[1], 94: 100 * standard(s).i11, 60: 100 * SRC.ecma.cdI11}),
  'A quarter wavelength deep': s => ({503: s.wavelengthInside, 126: s.depthNm, 100: SRC.pages.cdDepths[0], 150: SRC.pages.cdDepths[1]}),
  'An eighth of a wavelength': s => ({46: 100 * standard(s).i11, 60: 100 * SRC.ecma.cdI11, 24: 100 * standard(s).i3, 30: 100 * SRC.ecma.cdI3[0]}),
  'The spiral': s => ({25: s.format.inner, 58: s.format.outer, '1.6': um(s.format.pitch), '20,625': s.turns, '5.38': s.track / 1000, '74.7': s.time / 60, '1.2': s.format.velocity, 74: SRC.pages.cdMinutes}),
}, run, t);
checkTrialNumbers(L.dvdLesson, {
  'The spot and the track': s => ({650: s.format.wavelength, '1.32': um(s.spot), '0.74': um(s.format.pitch), 400: s.shortestRun, '1.47': um(s.longestRun)}),
  'Read the pits': s => { const fourteen = P.patternLevels(s.format, 14); return {30: 100 * (s.shortestLevels.pit - s.shortestLevels.land) / (fourteen.pit - fourteen.land), 15: 100 * SRC.ecma.dvdI3}; },
  'Just too fine': s => ({534: 2 * (s.format.shortest - 1) * s.bit, 542: s.cutoff}),
  'Thinner plastic, a wider cone': s => ({'0.6': s.format.cover, '36.9': deg(s.cone), '1.2': CD.cover, '26.7': deg(P.coneAngle(CD))}),
  'Spin at the rim': s => ({575: s.rpm, '1,333': P.spinRate(s.format, 25), 25: 25, '3.49': s.format.velocity, 580: P.spinRate(s.format, 57.5), '57.5': 57.5}),
  'How much it holds': s => ({24: s.format.inner, 58: s.format.outer, '0.74': um(s.format.pitch), '11.84': s.track / 1000, '4.70': s.capacity / 1e9, '4.7': SRC.pages.dvdGB}),
}, run, t);
checkTrialNumbers(L.cdRomLesson, {
  'Sectors at a steady rate': s => ({458: s.rpm, 198: P.spinRate(s.format, 58), '1.2': s.format.velocity, 75: s.format.rate / (S.frames * P.frameBits()), 150: S.data * S.perSecond / 1024}),
  'One frame of track': s => ({588: P.frameBits(), 163: um(P.frameBits() * s.bit), 20: P.frameBits() * s.bit / 8000, 126: s.layout.length}),
  'A scratch it survives': s => ({16: P.burstFrames(), '2.61': P.burstFrames() * P.frameBits() * s.bit / 1e6, '1.2': s.format.velocity, '4,096': P.burstFrames() * 32 * 8, '2.5': SRC.pages.circ[1], '4,000': SRC.pages.circ[0]}),
  'The sector': () => ({'2,352': S.bytes, '2,048': S.data, 12: S.sync, 4: S.header, 288: S.detection + S.zeros + S.pParity + S.qParity}),
  'A whole disc': s => ({74: SRC.pages.cdRomMinutes, '333,000': SRC.pages.cdRomSectors, '650.4': SRC.pages.cdRomSectors * S.data / 2 ** 20, 25: s.format.inner, 58: s.format.outer, '1.2': s.format.velocity, '74.7': s.time / 60, '336,126': s.time * S.perSecond, '656.5': s.time * S.perSecond * S.data / 2 ** 20}),
}, run, t);
checkTrialNumbers(L.opticalReadoutLesson, {
  'Follow the light': s => ({'58.2': deg(s.cone), '33.3': deg(s.coneInside), '0.1': s.format.cover}),
  'A CD’s gentler cone': s => ({'0.45': s.format.aperture, '26.7': deg(s.cone), '1.2': s.format.cover}),
  'The spot and its rings': s => ({581: s.spot, 532: s.ring, 320: s.format.pitch}),
  'Cancel the light': s => ({'65.3': s.depthNm, '261.3': s.wavelengthInside}),
  'A pit half a wavelength deep': s => { t.ok(s.level === 1, 'in step, nothing dims'); return {}; },
  'Too fine to see': s => ({149: s.shortestRun, 298: 2 * s.shortestRun, 238: s.cutoff, 13: 100 * (s.shortestLevels.pit - s.shortestLevels.land)}),
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
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2);
const plans = FORMATS3.map((_, format) => P.readPlan({format}));
const limitsSnippets = {
  [`by ${f0(100 * SRC.ecma.cdI11)}% of its top level`]: 'by 60% of its top level',
  [`${f0(P.READ.pitShare * 16)}/16 of a pitch wide, the CD’s ${f0(P.READ.pitShare * CD.pitch)} nm`]: '5/16 of a pitch wide, the CD’s 500 nm',
  [`DVD’s ${f0(DVD.inner)} to ${f0(DVD.outer)} mm and a refractive index of ${f2(P.INDEX)}`]: 'DVD’s 24 to 58 mm and a refractive index of 1.55',
  [`its 1-7PP code read as runs of ${BD.shortest} to ${BD.longest} channel bits`]: 'its 1-7PP code read as runs of 2 to 8 channel bits',
};
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
const expectNone = (lesson, name, except = []) => { for (const [where, text] of texts(lesson)) if (!except.includes(where)) covered(text, {}, `${name} ${where}`); };

// Blu-ray player.
expectNone(L.bluRayLesson, 'Blu-ray player');
covered(L.bluRayLesson.deeper[0].body, {
  [`${f2(P.J1_ZEROS[0] / Math.PI)} λ/NA`]: '1.22 λ/NA',
  [`violet light of ${BD.wavelength} nm instead of a DVD’s ${DVD.wavelength} nm`]: 'violet light of 405 nm instead of a DVD’s 650 nm',
  [`a lens of ${f2(BD.aperture)} instead of ${f2(DVD.aperture)}`]: 'a lens of 0.85 instead of 0.60',
  [`Its spot is ${f0(spots[2])} nm across, which the Blu-ray page gives as ${Number(spots[2].toPrecision(2))} nm`]: 'Its spot is 581 nm across, which the Blu-ray page gives as 580 nm',
  [`${Number(um(spots[0]).toPrecision(2))} μm for a CD, ${Number(um(spots[1]).toPrecision(2))} μm for a DVD and ${Number(um(spots[2]).toPrecision(1))} μm for a Blu-ray Disc`]: '2.1 μm for a CD, 1.3 μm for a DVD and 0.6 μm for a Blu-ray Disc',
}, 'Blu-ray deeper 1');
covered(L.bluRayLesson.deeper[1].body, {
  'λ/(2NA)': 'λ/(2NA)',
  [`${f0(cutoffs[2])} nm for a Blu-ray Disc`]: '238 nm for a Blu-ray Disc',
  [`${f0(2 * bits[2])} nm each, repeat every ${f0(4 * bits[2])} nm`]: '149 nm each, repeat every 298 nm',
  [`by only ${f0(100 * (plans[2].shortestLevels.pit - plans[2].shortestLevels.land))}% of what`]: 'by only 13% of what',
  [`every ${f0(6 * bits[1])} nm against its ${f0(cutoffs[1])} nm`]: 'every 801 nm against its 542 nm',
  [`every ${f2(um(6 * bits[0]))} μm against ${f0(cutoffs[0])} nm`]: 'every 1.67 μm against 867 nm',
}, 'Blu-ray deeper 2');
covered(L.bluRayLesson.deeper[2].body, {'60 v / (2π r)': '60 v / (2π r)', [`${f0(rpm(BD, 24))} rpm at ${DVD.inner} mm`]: '1,956 rpm at 24 mm', [`${f0(rpm(BD, 58))} rpm at 58 mm`]: '810 rpm at 58 mm'}, 'Blu-ray deeper 3');
covered(L.bluRayLesson.deeper[3].body, {[`the refractive index, ${f2(P.INDEX)}`]: 'the refractive index, 1.55'}, 'Blu-ray deeper 4');
covered(L.bluRayLesson.deeper[4].body, {
  [`from ${BD.inner} mm to ${BD.outer} mm`]: 'from 24 mm to 58 mm',
  [`its ${BD.pitch} nm pitch makes ${f2(P.trackLength(BD) / 1000)} km of track: ${f0(P.trackLength(BD) / (bits[2] / 1e9) / 1e9)} billion channel bits of ${f1(bits[2])} nm`]: 'its 320 nm pitch makes 27.37 km of track: 367 billion channel bits of 74.5 nm',
  [`read at ${f0(BD.rate / 1e6)} million channel bits a second to give ${f0(BD.userRate / 1e6)} million bits of data`]: 'read at 66 million channel bits a second to give 36 million bits of data',
  [`holds ${f2(P.capacityOf(BD) / 1e9)} GB, the Blu-ray page’s ${SRC.pages.bdGB} GB`]: 'holds 25.05 GB, the Blu-ray page’s 25 GB',
}, 'Blu-ray deeper 5');
covered(L.bluRayLesson.deeper[5].body, {
  [`at ${P.READ.bitsPerSecond} channel bits a second`]: 'at 10 channel bits a second',
  [`read at ${f0(BD.rate / 1e6)} million a second, ${f0(BD.rate / P.READ.bitsPerSecond)} times as fast`]: 'read at 66 million a second, 6,600,000 times as fast',
  [`passes in ${f2(70 / BD.rate * 1e6)} μs`]: 'passes in 1.06 μs',
  [`turns ${P.READ.spin} times slower`]: 'turns 100 times slower',
}, 'Blu-ray deeper 6');
covered(L.bluRayLimits, {[`${f1(CD.velocity)} m/s, the slowest`]: '1.2 m/s, the slowest', [`at ${P.READ.bitsPerSecond} channel bits a second`]: 'at 10 channel bits a second', [`turns ${P.READ.spin} times slower`]: 'turns 100 times slower', ...limitsSnippets}, 'Blu-ray limits');
covered(L.bluRayLesson.quiz.explanation, {[`${f2(P.J1_ZEROS[0] / Math.PI)} λ/NA`]: '1.22 λ/NA', [`${f0(spots[2])} nm for a Blu-ray Disc against ${f2(um(spots[1]))} μm for a DVD`]: '581 nm for a Blu-ray Disc against 1.32 μm for a DVD', [`${BD.pitch} nm apart instead of ${DVD.pitch} nm`]: '320 nm apart instead of 740 nm'}, 'Blu-ray quiz');

// CD.
expectNone(L.cdLesson, 'CD', ['overview', 'step 1', 'step 2', 'step 3', 'step 4', 'step 5', 'misconception']);
covered(L.cdLesson.overview, {[`${f0(SRC.audio.rate)} times a second`]: '44,100 times a second', [`between ${CD.shortest} and ${CD.longest} channel bits`]: 'between 3 and 11 channel bits'}, 'CD overview');
covered(L.cdLesson.steps[0].body, {[`${f0(SRC.audio.rate)} times a second in each of ${SRC.audio.channels} channels, as ${SRC.audio.bits} bit numbers`]: '44,100 times a second in each of 2 channels, as 16 bit numbers'}, 'CD step 1');
covered(L.cdLesson.steps[1].body, {[`Every ${F.samples} stereo samples make a frame of ${F.audio} bytes. Error correction adds ${F.parity} bytes and a subcode byte makes ${F.audio + F.parity + F.subcode}`]: 'Every 6 stereo samples make a frame of 24 bytes. Error correction adds 8 bytes and a subcode byte makes 33'}, 'CD step 2');
covered(L.cdLesson.steps[2].body, {[`${F.symbol} channel bits, with ${F.merging} merging bits between, so that ones always lie ${CD.shortest - 1} to ${CD.longest - 1} zeros apart`]: '14 channel bits, with 3 merging bits between, so that ones always lie 2 to 10 zeros apart'}, 'CD step 3');
covered(L.cdLesson.steps[3].body, {[`run ${CD.shortest} to ${CD.longest} channel bits long`]: 'run 3 to 11 channel bits long'}, 'CD step 4');
covered(L.cdLesson.steps[4].body, {[`at ${f1(CD.velocity)} m/s, ${f0(CD.rate)} channel bits a second`]: 'at 1.2 m/s, 4,321,800 channel bits a second'}, 'CD step 5');
covered(L.cdLesson.misconception, {[`the ${f1(CD.cover)} mm of clear plastic`]: 'the 1.2 mm of clear plastic'}, 'CD misconception');
covered(L.cdLesson.deeper[0].body, {
  [`${f0(SRC.audio.rate)} samples a second of ${SRC.audio.bits} bits in each of ${SRC.audio.channels} channels: ${f0(audioBits)} bits a second`]: '44,100 samples a second of 16 bits in each of 2 channels: 1,411,200 bits a second',
  [`Six stereo samples, ${F.audio} bytes`]: 'Six stereo samples, 24 bytes',
  [`error correction adds ${F.parity} bytes and the subcode ${F.subcode}, making ${F.audio + F.parity + F.subcode}`]: 'error correction adds 8 bytes and the subcode 1, making 33',
  [`${F.symbol} channel bits and ${F.merging} merging bits, ${33 * (F.symbol + F.merging)} channel bits`]: '14 channel bits and 3 merging bits, 561 channel bits',
  [`a sync pattern of ${F.sync} channel bits with its own ${F.merging} merging bits`]: 'a sync pattern of 24 channel bits with its own 3 merging bits',
  [`: ${P.frameBits()} channel bits`]: ': 588 channel bits',
  [`${f0(SRC.audio.rate / F.samples)} frames a second, so ${f0(CD.rate)} channel bits a second, the ${fixed(CD.rate / 1e6, 4)} Mbit/s`]: '7,350 frames a second, so 4,321,800 channel bits a second, the 4.3218 Mbit/s',
}, 'CD deeper 1');
covered(L.cdLesson.deeper[1].body, {
  [`At ${f1(CD.velocity)} m/s a channel bit is ${f1(bits[0])} nm`]: 'At 1.2 m/s a channel bit is 277.7 nm',
  [`Ones lie ${CD.shortest - 1} to ${CD.longest - 1} zeros apart`]: 'Ones lie 2 to 10 zeros apart',
  [`${CD.shortest} to ${CD.longest} channel bits long: ${f0(3 * bits[0])} nm to ${f2(um(11 * bits[0]))} μm`]: '3 to 11 channel bits long: 833 nm to 3.05 μm',
  [`as ${SRC.pages.cdPits[0]} nm to ${f0(SRC.pages.cdPits[1])} nm`]: 'as 830 nm to 3,000 nm',
  [`up to ${SRC.pages.cdPitsOther} μm`]: 'up to 3.5 μm',
  [`at ${f1(SRC.CD.scanning[1])} m/s`]: 'at 1.4 m/s',
  [`: ${f2(um(11 * 1.4 / CD.rate * 1e9))} μm`]: ': 3.56 μm',
  [`${f0(CD.rate / 6 / 1000)} kHz and ${f0(CD.rate / 22 / 1000)} kHz`]: '720 kHz and 196 kHz',
  [`${f0(CD.rate)} channel bits a second over ${2 * CD.shortest} and over ${2 * CD.longest}`]: '4,321,800 channel bits a second over 6 and over 22',
}, 'CD deeper 2');
covered(L.cdLesson.deeper[2].body, {}, 'CD deeper 3');
covered(L.cdLesson.deeper[3].body, {
  [`${f0(rpm(CD, 25))} rpm at 25 mm and ${f0(rpm(CD, 58))} rpm at 58 mm`]: '458 rpm at 25 mm and 198 rpm at 58 mm',
  [`at ${f1(CD.velocity)} m/s`]: 'at 1.2 m/s',
  [`about ${SRC.pages.cdRpm[0]} and ${SRC.pages.cdRpm[1]} rpm`]: 'about 500 and 200 rpm',
  [`${SRC.pages.clv[0]} to ${SRC.pages.clv[1]} rpm`]: '495 to 212 rpm',
  [`covers ${f2(Math.PI * (58 ** 2 - 25 ** 2) / 100)} cm², and ${f2(Math.PI * (58 ** 2 - 25 ** 2) / 100)} cm² over a pitch of ${f1(um(CD.pitch))} μm is ${f2(P.trackLength(CD) / 1000)} km`]: 'covers 86.05 cm², and 86.05 cm² over a pitch of 1.6 μm is 5.38 km',
  [`${f1(P.playTime(CD) / 60)} minutes at ${f1(CD.velocity)} m/s`]: '74.7 minutes at 1.2 m/s',
  [`as ${SRC.pages.cdMinutes} minutes`]: 'as 74 minutes',
}, 'CD deeper 4');
covered(L.cdLesson.deeper[4].body, {
  [`light of ${CD.wavelength} nm has a wavelength of ${f0(CD.wavelength / 1.55)} nm`]: 'light of 780 nm has a wavelength of 503 nm',
  [`refractive index is ${f2(P.INDEX)}`]: 'refractive index is 1.55',
  [`A bump ${f0(P.depthOf(CD, 1 / 4))} nm high`]: 'A bump 126 nm high',
  [`about ${SRC.pages.cdDepths[0]} nm deep in one paragraph and ${SRC.pages.cdDepths[1]} nm in another`]: 'about 100 nm deep in one paragraph and 150 nm in another',
}, 'CD deeper 5');
covered(L.cdLimits, {[`at ${f1(CD.velocity)} m/s, the slowest`]: 'at 1.2 m/s, the slowest', [`from ${CD.inner} mm to ${CD.outer} mm`]: 'from 25 mm to 58 mm', [`${P.READ.bitsPerSecond} channel bits a second, ${f0(CD.rate / P.READ.bitsPerSecond)} times slower`]: '10 channel bits a second, 432,180 times slower', ...limitsSnippets}, 'CD limits');
covered(L.cdLesson.quiz.explanation, {[`${f0(3 * bits[0])} nm at ${f1(CD.velocity)} m/s, repeating every ${f2(um(6 * bits[0]))} μm`]: '833 nm at 1.2 m/s, repeating every 1.67 μm', [`lens sends back, ${f0(cutoffs[0])} nm`]: 'lens sends back, 867 nm'}, 'CD quiz');

// DVD.
expectNone(L.dvdLesson, 'DVD', ['overview', 'step 1', 'step 2', 'step 3', 'step 4', 'quiz']);
covered(L.dvdLesson.overview, {[`red light of ${DVD.wavelength} nm through a lens of numerical aperture ${f2(DVD.aperture)}`]: 'red light of 650 nm through a lens of numerical aperture 0.60', [`only ${f1(DVD.cover)} mm of plastic`]: 'only 0.6 mm of plastic'}, 'DVD overview');
covered(L.dvdLesson.steps[0].body, {[`Light of ${DVD.wavelength} nm through a lens of ${f2(DVD.aperture)} focuses a spot ${f2(um(spots[1]))} μm across, against a CD’s ${f2(um(spots[0]))} μm`]: 'Light of 650 nm through a lens of 0.60 focuses a spot 1.32 μm across, against a CD’s 2.11 μm'}, 'DVD step 1');
covered(L.dvdLesson.steps[1].body, {[`Tracks lie ${f2(um(DVD.pitch))} μm apart and pits run from ${f0(3 * bits[1])} nm to ${f2(um(11 * bits[1]))} μm long`]: 'Tracks lie 0.74 μm apart and pits run from 400 nm to 1.47 μm long'}, 'DVD step 2');
covered(L.dvdLesson.steps[2].body, {[`through ${f1(DVD.cover)} mm of plastic, half a CD’s ${f1(CD.cover)} mm, so a DVD is two ${f1(DVD.backing)} mm halves`]: 'through 0.6 mm of plastic, half a CD’s 1.2 mm, so a DVD is two 0.6 mm halves'}, 'DVD step 3');
covered(L.dvdLesson.steps[3].body, {[`at ${f2(DVD.velocity)} m/s, ${f0(DVD.rate)} channel bits a second`]: 'at 3.49 m/s, 26,156,250 channel bits a second'}, 'DVD step 4');
covered([L.dvdLesson.quiz.question, ...L.dvdLesson.quiz.options].join(' '), {[`${f2(um(DVD.pitch))} μm apart, against a CD’s ${f1(um(CD.pitch))} μm`]: '0.74 μm apart, against a CD’s 1.6 μm'}, 'DVD quiz');
covered(L.dvdLesson.quiz.explanation, {[`Light of ${DVD.wavelength} nm through a lens of ${f2(DVD.aperture)} makes a spot ${f2(um(spots[1]))} μm across, against a CD’s ${f2(um(spots[0]))} μm from ${CD.wavelength} nm light through ${f2(CD.aperture)}`]: 'Light of 650 nm through a lens of 0.60 makes a spot 1.32 μm across, against a CD’s 2.11 μm from 780 nm light through 0.45'}, 'DVD quiz explanation');
covered(L.dvdLesson.deeper[0].body, {
  [`${2 * 8} channel bits, with ${DVD.shortest - 1} to ${DVD.longest - 1} zeros`]: '16 channel bits, with 2 to 10 zeros',
  [`${DVD.shortest} to ${DVD.longest} channel bits long, and 14 in its sync patterns`]: '3 to 11 channel bits long, and 14 in its sync patterns',
  [`At ${f2(DVD.velocity)} m/s and ${f0(DVD.rate)} channel bits a second a channel bit is ${f1(bits[1])} nm`]: 'At 3.49 m/s and 26,156,250 channel bits a second a channel bit is 133.4 nm',
  [`the ${SRC.DVD.bit[0]} nm`]: 'the 133.3 nm',
  [`tolerance of ${SRC.DVD.bit[1]} nm`]: 'tolerance of 1.4 nm',
}, 'DVD deeper 1');
covered(L.dvdLesson.deeper[1].body, {
  [`${P.DVD_SECTOR.frames} sync frames, each a sync code of ${P.DVD_SECTOR.sync} channel bits and ${f0(P.DVD_SECTOR.bits)} channel bits more: ${f0(P.dvdSectorBits())} channel bits for ${f0(P.DVD_SECTOR.data)} bytes`]: '26 sync frames, each a sync code of 32 channel bits and 1,456 channel bits more: 38,688 channel bits for 2,048 bytes',
  [`At ${f0(DVD.rate)} channel bits a second that is ${f2(DVD.userRate / 1e6)} Mbit/s`]: 'At 26,156,250 channel bits a second that is 11.08 Mbit/s',
}, 'DVD deeper 2');
covered(L.dvdLesson.deeper[2].body, {
  [`From ${DVD.inner} mm to ${DVD.outer} mm, ${f2(um(DVD.pitch))} μm apart, a DVD’s track runs ${f2(P.trackLength(DVD) / 1000)} km: ${f1(P.trackLength(DVD) / (bits[1] / 1e9) / 1e9)} billion`]: 'From 24 mm to 58 mm, 0.74 μm apart, a DVD’s track runs 11.84 km: 88.7 billion',
  [`Of every ${f0(P.dvdSectorBits())} channel bits, ${f0(P.DVD_SECTOR.data * 8)} are data`]: 'Of every 38,688 channel bits, 16,384 are data',
  [`holds ${f2(P.capacityOf(DVD) / 1e9)} GB, the DVD page’s ${SRC.pages.dvdGB} GB`]: 'holds 4.70 GB, the DVD page’s 4.7 GB',
  [`${f0(SRC.pages.dvdRpm[0])} rpm inside and ${SRC.pages.dvdRpm[1]} rpm outside, are ${f0(rpm(DVD, 24))} rpm at 24 mm and ${f0(rpm(DVD, 57.5))} rpm at 57.5 mm`]: '1,400 rpm inside and 580 rpm outside, are 1,389 rpm at 24 mm and 580 rpm at 57.5 mm',
}, 'DVD deeper 3');
covered(L.dvdLesson.deeper[3].body, {
  [`about ${f1(CD.pitch * bits[0] / (DVD.pitch * bits[1]))} times`]: 'about 4.5 times',
  [`${f2(um(DVD.pitch))} μm apart against ${f1(um(CD.pitch))} μm`]: '0.74 μm apart against 1.6 μm',
  [`${f1(bits[1])} nm long against ${f1(bits[0])} nm`]: '133.4 nm long against 277.7 nm',
  [`${SRC.pages.dvdGB} GB against a CD-ROM’s ${SRC.pages.cdRomMiB} MiB, ${f2(4.7e9 / (SRC.pages.cdRomSectors * S.data))} times`]: '4.7 GB against a CD-ROM’s 650 MiB, 6.89 times',
}, 'DVD deeper 4');
covered(L.dvdLimits, {[`at ${f2(DVD.velocity)} m/s`]: 'at 3.49 m/s', [`from ${DVD.inner} mm to ${DVD.outer} mm`]: 'from 24 mm to 58 mm', [`${P.READ.bitsPerSecond} channel bits a second, ${f0(DVD.rate / P.READ.bitsPerSecond)} times slower`]: '10 channel bits a second, 2,615,625 times slower', ...limitsSnippets}, 'DVD limits');

// CD-ROM.
expectNone(L.cdRomLesson, 'CD-ROM', ['overview', 'step 1', 'step 2', 'step 3', 'part 1', 'misconception', 'quiz']);
covered(L.cdRomLesson.overview, {[`${f0(S.bytes)} bytes it keeps ${f0(S.data)}`]: '2,352 bytes it keeps 2,048'}, 'CD-ROM overview');
covered(L.cdRomLesson.steps[0].body, {[`carries ${F.audio} bytes, with ${F.parity} bytes`]: 'carries 24 bytes, with 8 bytes'}, 'CD-ROM step 1');
covered(L.cdRomLesson.steps[1].body, {[`${f0(S.bytes)} bytes, and ${S.perSecond} sectors`]: '2,352 bytes, and 75 sectors'}, 'CD-ROM step 2');
covered(L.cdRomLesson.steps[2].body, {[`${f0(S.data)} bytes of data`]: '2,048 bytes of data', [`${S.detection + S.zeros + S.pParity + S.qParity} bytes`]: '288 bytes'}, 'CD-ROM step 3');
covered(L.cdRomLesson.parts[0].role, {[`${S.perSecond} sectors a second`]: '75 sectors a second'}, 'CD-ROM part 1');
covered(L.cdRomLesson.misconception, {[`${F.symbol} channel bits`]: '14 channel bits'}, 'CD-ROM misconception');
covered([L.cdRomLesson.quiz.question, ...L.cdRomLesson.quiz.options].join(' '), {[`${f0(S.data * S.perSecond)}: ${S.perSecond} sectors of ${f0(S.data)} bytes.`]: '153,600: 75 sectors of 2,048 bytes.', [`${f0(S.bytes * S.perSecond)}: ${S.perSecond} sectors of ${f0(S.bytes)} bytes.`]: '176,400: 75 sectors of 2,352 bytes.', [`${f0(audioBits)}: the rate`]: '1,411,200: the rate'}, 'CD-ROM quiz');
covered(L.cdRomLesson.quiz.explanation, {[`${f0(S.bytes)} bytes, ${f0(S.data)} are data, and ${S.perSecond} sectors`]: '2,352 bytes, 2,048 are data, and 75 sectors'}, 'CD-ROM quiz explanation');
covered(L.cdRomLesson.deeper[0].body, {[`${S.perSecond} sectors a second and ${f0(S.data)} bytes`]: '75 sectors a second and 2,048 bytes', [`${f0(S.data * S.perSecond)} bytes a second, ${S.data * S.perSecond / 1024} KiB`]: '153,600 bytes a second, 150 KiB', 'call 1×': 'call 1×'}, 'CD-ROM deeper 1');
covered(L.cdRomLesson.deeper[1].body, {[`${f0(S.bytes)} bytes is ${S.sync} bytes of sync, ${S.header} of header, ${f0(S.data)} of data, ${S.detection} to detect errors, ${S.zeros} of zeros, and ${S.pParity} and ${S.qParity} of parity`]: '2,352 bytes is 12 bytes of sync, 4 of header, 2,048 of data, 4 to detect errors, 8 of zeros, and 172 and 104 of parity'}, 'CD-ROM deeper 2');
covered(L.cdRomLesson.deeper[2].body, {
  [`code of ${P.CIRC.symbols} bytes carrying ${P.CIRC.data}, whose bytes are spread ${P.CIRC.step} frames apart`]: 'code of 28 bytes carrying 24, whose bytes are spread 4 frames apart',
  [`rebuild ${P.CIRC.symbols - P.CIRC.data} missing bytes`]: 'rebuild 4 missing bytes',
  [`wipes out ${P.burstFrames()} whole frames`]: 'wipes out 16 whole frames',
  [`no more than ${P.CIRC.symbols - P.CIRC.data} missing`]: 'no more than 4 missing',
  [`${P.burstFrames()} frames of ${F.audio + F.parity} bytes are ${f0(P.burstFrames() * 32 * 8)} bits`]: '16 frames of 32 bytes are 4,096 bits',
  [`${f1(CD.velocity)} m/s, ${f2(P.burstFrames() * 588 * bits[0] / 1e6)} mm`]: '1.2 m/s, 2.61 mm',
  [`${f0(SRC.pages.circ[0])} bits and ${SRC.pages.circ[1]} mm`]: '4,000 bits and 2.5 mm',
  [`${f0(SRC.pages.circ[2])} bits or ${SRC.pages.circ[3]} mm`]: '12,000 bits or 7.5 mm',
  [`${S.pParity + S.qParity} bytes of parity`]: '276 bytes of parity',
}, 'CD-ROM deeper 3');
covered(L.cdRomLesson.deeper[3].body, {
  [`${SRC.pages.cdRomMinutes} minutes`]: '74 minutes',
  [`${f0(SRC.pages.cdRomSectors / S.perSecond)} s, ${f0(SRC.pages.cdRomSectors)} sectors and ${SRC.pages.cdRomMiB} MiB`]: '4,440 s, 333,000 sectors and 650 MiB',
  [`from ${CD.inner} mm to ${CD.outer} mm at ${f1(CD.velocity)} m/s passes in ${f1(P.playTime(CD) / 60)} minutes, ${f0(programSectors)} sectors and ${f1(programSectors * S.data / 2 ** 20)} MiB`]: 'from 25 mm to 58 mm at 1.2 m/s passes in 74.7 minutes, 336,126 sectors and 656.5 MiB',
}, 'CD-ROM deeper 4');
covered(L.cdRomLimits, {[`at ${f1(CD.velocity)} m/s`]: 'at 1.2 m/s', [`from ${CD.inner} mm to ${CD.outer} mm`]: 'from 25 mm to 58 mm', [`at ${P.READ.bitsPerSecond} channel bits a second`]: 'at 10 channel bits a second', ...limitsSnippets}, 'CD-ROM limits');

// Optical-disc readout.
expectNone(L.opticalReadoutLesson, 'Optical-disc readout');
covered(L.opticalReadoutLesson.deeper[0].body, {
  [`${f2(BD.aperture)} makes a cone ${f1(deg(P.coneAngle(BD)))}°`]: '0.85 makes a cone 58.2°',
  [`index ${f2(P.INDEX)} the cone narrows to ${f1(deg(P.coneAngle(BD, P.INDEX)))}°`]: 'index 1.55 the cone narrows to 33.3°',
  [`A CD’s ${f2(CD.aperture)} makes ${f1(deg(P.coneAngle(CD)))}° and a DVD’s ${f2(DVD.aperture)} makes ${f1(deg(P.coneAngle(DVD)))}°`]: 'A CD’s 0.45 makes 26.7° and a DVD’s 0.60 makes 36.9°',
}, 'readout deeper 1');
covered(L.opticalReadoutLesson.deeper[1].body, {[`${f1(BD.cover)} mm thick, on a ${f1(BD.backing)} mm substrate`]: '0.1 mm thick, on a 1.1 mm substrate', [`DVD uses ${f1(DVD.cover)} mm and a CD ${f1(CD.cover)} mm`]: 'DVD uses 0.6 mm and a CD 1.2 mm'}, 'readout deeper 2');
covered(L.opticalReadoutLesson.deeper[2].body, {[`${f2(P.J1_ZEROS[0] / Math.PI)} λ/NA`]: '1.22 λ/NA', [`${f0(spots[2] / 2)} nm from the middle and the second ${f0(P.secondDarkRing(BD))} nm`]: '291 nm from the middle and the second 532 nm', [`tracks ${BD.pitch} nm`]: 'tracks 320 nm'}, 'readout deeper 3');
covered(L.opticalReadoutLesson.deeper[3].body, {[`pits, ${f0(2 * bits[2])} nm`]: 'pits, 149 nm', [`${f1(BD.wavelength / P.INDEX)} nm`]: '261.3 nm', [`λ/(2NA), ${f0(cutoffs[2])} nm`]: 'λ/(2NA), 238 nm'}, 'readout deeper 4');
covered(L.opticalReadoutLesson.deeper[4].body, {}, 'readout deeper 5');
covered(L.opticalReadoutLesson.deeper[5].body, {[`violet ${SRC.pages.lasers[0]} nm`]: 'violet 405 nm', [`${SRC.pages.lasers[1]} nm to ${SRC.pages.lasers[2]} nm`]: '650 nm to 660 nm', [`${SRC.pages.lasers[3]} nm near-infrared`]: '785 nm near-infrared', [`with ${CD.wavelength} nm and ${DVD.wavelength} nm`]: 'with 780 nm and 650 nm'}, 'readout deeper 6');
covered(L.opticalReadoutLimits, {[`drawn ${f0(BR.DIAGRAM / BR.MM)} times larger`]: 'drawn 40 times larger', ...limitsSnippets}, 'readout limits');
covered(L.opticalReadoutLesson.quiz.explanation, {[`${f1(P.depthOf(BD, 1 / 4))} nm`]: '65.3 nm'}, 'readout quiz');

// The model's own words: its scales and slowed clocks, said where the reader sees them.
const partText = id => model.parts.find(part => part.id === id).description;
covered(partText('system'), {[`at ${P.READ.bitsPerSecond} channel bits a second`]: 'at 10 channel bits a second', [`turns ${P.READ.spin} times slower`]: 'turns 100 times slower'}, 'system text');
covered(partText('disc'), {[`A ${f0(2 * 60)} mm disc`]: 'A 120 mm disc', [`drawn with ${BR.SPIRAL_TURNS} turns`]: 'drawn with 24 turns', [`turns ${P.READ.spin} times slower`]: 'turns 100 times slower'}, 'disc text');
covered(partText('track'), {[`drawn ${f0(BR.CLOSE / (BR.MM / 1e6))} times larger`]: 'drawn 10,000 times larger', [`${f0(P.READ.pitShare * 16)}/16 of a pitch wide`]: '5/16 of a pitch wide', [`at ${P.READ.bitsPerSecond} channel bits a second`]: 'at 10 channel bits a second'}, 'track text');
covered(partText('signal'), {}, 'signal text');
covered(partText('pit'), {[`drawn ${f0(BR.CUT / (BR.MM / 1e6))} times larger`]: 'drawn 100,000 times larger'}, 'pit text');
covered(partText('spin'), {[`from ${BR.SPIN.radii[0]} mm to ${BR.SPIN.radii[1]} mm across and from 0 to ${f0(BR.SPIN.rpm[1])} rpm`]: 'from 20 mm to 60 mm across and from 0 to 2,000 rpm'}, 'spin text');
covered(partText('pickup'), {[`drawn ${f0(BR.DIAGRAM / BR.MM)} times larger`]: 'drawn 40 times larger'}, 'pickup text');
t.ok(BR.CLOSE === 1e-4 && BR.CUT === 1e-3 && BR.DIAGRAM === 0.4 && BR.MM === 0.01, 'the scales the text states');
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  checkQuotedText(find('Spot').hint, {'drawn 10,000 times larger': 'drawn 10,000 times larger'}, t);
  checkQuotedText(find('Spin').hint, {[`turns ${P.READ.spin} times slower`]: 'turns 100 times slower'}, t);
  checkQuotedText(find('Slowed').hint, {[`shows ${P.READ.bitsPerSecond} channel bits a second`]: 'shows 10 channel bits a second'}, t);
  t.ok(find('Slowed').value === `${f0(BD.rate / 10)} times` && find('Spot').value === '581 nm across' && find('Spin').value === '1,878 rpm', 'the readings carry the real figures');
  model.update({format: 0});
  const cd = model.getState().readings, cdReading = label => cd.find(item => item.label === label);
  t.ok(cdReading('Track').value === '1.6 μm apart; pits 833 nm to 3.05 μm long' && cdReading('Disc').hint.endsWith('runs 5.38 km: 74.7 minutes of music.'), 'a CD’s readings in the lessons’ own figures');
}

for (const lesson of [L.bluRayLesson, L.cdLesson, L.dvdLesson, L.cdRomLesson, L.opticalReadoutLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)), 'every source a link');
}
t.ok(studyLessons['Blu-ray player'] === L.bluRayLesson, 'the Blu-ray player’s lesson');
for (const [name, lesson, part, values] of [['CD', L.cdLesson, 'track', {format: 0}], ['DVD', L.dvdLesson, 'track', {format: 1}], ['CD-ROM', L.cdRomLesson, 'signal', {format: 0}], ['Optical-disc readout', L.opticalReadoutLesson, 'pickup', undefined]]) {
  const component = houseComponents[name];
  t.ok(component.machine === 'Blu-ray player' && component.part === part && component.lesson === lesson && component.intro === lesson.simple, `${name} routes to the Blu-ray player’s ${part} with its own lesson`);
  assert.deepEqual(component.values, values);
  const ids = new Set(model.parts.map(item => item.id));
  for (const trial of lesson.tryIt) t.ok(ids.has(trial.part) && (values === undefined || trial.values.format === values.format || trial.values.format !== undefined), `${name}: ${trial.title} on a part the model has`);
}

// ---------------------------------------------------------------------------
// 6. What every model owes the viewer.
// ---------------------------------------------------------------------------

assert.deepEqual(JSON.parse(JSON.stringify(P.READ_DOMAINS)), {format: [0, 2, 1], radius: [25, 58, 1], depth: [0, 3, 1]});
assert.deepEqual({...P.READ_DEFAULTS}, {format: 2, radius: 25, depth: 0});
for (const control of model.controls) { const [lo, hi, step] = P.READ_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.READ_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'format,radius,depth', 'three controls: the disc, the read position and the pit depth');
const drawing = () => [T.sled.position.x, T.pits.geometry.drawRange.count, Array.from(T.pits.geometry.attributes.position.array.slice(0, 60)), T.spot.scale.x, T.bump.scale.y, T.objective.scale.x, T.spinner.rotation.y, pointsOf(T.spinCursor), pointsOf(T.signalCurve).slice(0, 10), T.dataZone.geometry.parameters.innerRadius];
checkControlsMove(model, drawing, m => m.advance(100), t);
checkRefusals(P.sampleRead, P.READ_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before reading');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.5, 1e-12, 'a step reads half a second');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, 1, 1e-12, 'animation reads on by the time that passed');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available(), 'the ladder read, with a result to inspect');
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0, `${action.label} returns readings`); checkFinite(model.root, t); }
  t.ok(model.parts.every(part => part.description && !/[—–]| - |--/.test(part.description)), 'every part described, with no dashes');
  for (let format = 0; format < 3; format++) for (const time of [0, 1, 100]) { model.reset(); model.update({format}); model.advance(time); t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|n\/a/.test(item.value + (item.hint || ''))), 'readings are all numbers'); }
}
const released = checkDisposal((() => { const fresh = BR.createBluRayModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS optical: ${t.count} checks, ${counts.edges} edge spreads rebuilt from the Airy pattern and ${counts.swings} swings from a Fourier series, ${counts.runs} runs held to their codes, ${counts.pits} pits, ${counts.points} chart points and ${counts.waves} wave points read back, ${counts.poses} poses, ${counts.numbers} quoted numbers traced, 5 lessons, ${released} resources released exactly once.`);

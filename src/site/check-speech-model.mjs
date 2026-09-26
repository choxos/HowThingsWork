// Checks the speech recognition model and its phonemes lesson against their
// sources typed in again and their signal processing worked out by other
// routes: the voice integrated again through its three resonances as
// differential equations driven by the sawtooth's series, every frame's
// spectrum found again by the transform's defining sum, by closed forms of the
// window's transform at each harmonic and by Parseval's theorem, the windows'
// sidelobes found by searching their exact transforms, the mel filters held to
// their triangles adding up to one, the cosine transform inverted, and the
// drawing read back at swept settings and times, down to the spectrum
// transformed again from the drawn frame.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './speech-physics.js';
import * as M from './speech-model.js';
import * as L from './speech-lessons.js';
import {houseComponents} from './house-components.js';
import {studyLessons} from './study-lessons.js';

const t = tally();
const counts = {frames: 0, lines: 0, steps: 0, measurements: 0, poses: 0, points: 0, numbers: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2);
const sum = values => values.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the signal processing by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  // Peterson and Barney (1952), Table II, p. 183; Table I, p. 182.
  f0: [[136, 135, 130, 127, 124, 129, 137, 141, 130, 133], [235, 232, 223, 210, 212, 216, 232, 231, 221, 218], [272, 269, 260, 251, 256, 263, 276, 274, 261, 261]],
  f1: [[270, 390, 530, 660, 730, 570, 440, 300, 640, 490], [310, 430, 610, 860, 850, 590, 470, 370, 760, 500], [370, 530, 690, 1010, 1030, 680, 560, 430, 850, 560]],
  f2: [[2290, 1990, 1840, 1720, 1090, 840, 1020, 870, 1190, 1350], [2790, 2480, 2330, 2050, 1220, 920, 1160, 950, 1400, 1640], [3200, 2730, 2610, 2320, 1370, 1060, 1410, 1170, 1590, 1820]],
  f3: [[3010, 2550, 2480, 2410, 2440, 2410, 2240, 2240, 2390, 1690], [3310, 3070, 2990, 2850, 2810, 2710, 2680, 2670, 2780, 1960], [3730, 3600, 3570, 3320, 3170, 3180, 3310, 3260, 3360, 2160]],
  levels: [[-4, -3, -2, -1, -1, 0, -1, -3, -1, -5], [-24, -23, -17, -12, -5, -7, -12, -19, -10, -15], [-28, -27, -24, -22, -28, -34, -34, -43, -27, -20]],
  tableI: [[10267, 4, 6, 0, 0, 3, 0, 0, 0, 0], [6, 9549, 694, 2, 1, 1, 0, 0, 0, 26], [0, 257, 9014, 949, 1, 3, 0, 0, 2, 51], [0, 1, 300, 9919, 2, 2, 0, 0, 15, 39], [0, 1, 0, 19, 8936, 1013, 69, 0, 228, 7], [0, 0, 1, 2, 590, 9534, 71, 5, 62, 14], [0, 0, 1, 1, 16, 51, 9924, 96, 171, 19], [0, 0, 1, 0, 2, 0, 78, 10196, 0, 2], [0, 1, 1, 8, 540, 127, 103, 0, 9476, 21], [0, 0, 23, 6, 2, 3, 0, 0, 2, 10243]],
  ipa: ['i', 'ɪ', 'ɛ', 'æ', 'ɑ', 'ɔ', 'ʊ', 'u', 'ʌ', 'ɝ'],
  words: ['heed', 'hid', 'head', 'had', 'hod', 'hawed', 'hood', 'who’d', 'hud', 'heard'],
  codes: ['IY', 'IH', 'EH', 'AE', 'AA', 'AO', 'UH', 'UW', 'AH', 'ER'],
  study: {men: 33, women: 28, children: 15, lists: 2, words: 10, recorded: 1520, listeners: 70},
  // The CMU copy of the verified file: rows typed from it, the starred rows and each group's column sums worked out from it.
  file: {starred: [150, 96, 75], sums: [[86638, 329929, 940291, 1572322], [124858, 323730, 949403, 1557975], [79273, 202556, 579360, 985580]], order: [1, 2, 3, 4, 6, 7, 8, 9, 5, 10],
    rows: {0: '1 1 1 IY 160 240 2280 2850', 1: '1 1 1 IY 186 280 2400 2790', 5: '1 1 3 *EH 155 570 1700 2600', 660: '2 34 1 *IY 230 370 2670 3100', 661: '2 34 1 IY 234 390 2760 3060', 1220: '3 62 1 IY 228 460 3300 3950', 1221: '3 62 1 IY 200 400 3400 3850', 1519: '3 76 10 ER 328 660 1830 2200'}},
  // Kaldi's feature-window, mel-computations and feature-mfcc code; python_speech_features' base.py.
  kaldi: {rate: 16000, frame: 25, shift: 10, hamming: [0.54, 0.46], hann: [0.5, 0.5], filters: 23, low: 20, factor: 1127, corner: 700, ceps: 13},
  psf: {filters: 26, nfft: 512, factor10: 2595},
  // The Sampling, Voice frequency, English phonology, Mel scale, Speech recognition and Window function pages.
  pages: {telephone: 8000, wideband: 16000, menF0: [90, 155], womenF0: [165, 255], band: [300, 3400], consonants: 24, vowelsRP: 20, vowelsGA: [14, 16], mel440: '549.64', stationary: 10, melBend: 500, hammingExact: 25 / 46},
  declared: {bandwidths: [80, 100, 150], silence: 0.05, vowel: 0.25, slow: 20, floor: 1e-10, bottom: -80, quiet: 30, run: 3},
};

for (const key of ['f0', 'f1', 'f2', 'f3', 'levels']) { assert.deepEqual(P.TABLE_II[key].map(row => [...row]), SRC[key], `Table II’s ${key} as page 183 prints it`); t.add(); }
assert.deepEqual(P.TABLE_I.map(row => [...row]), SRC.tableI, 'Table I as page 182 prints it');
t.ok(P.VOWELS.every((vowel, i) => vowel.ipa === SRC.ipa[i] && vowel.word === SRC.words[i] && vowel.code === SRC.codes[i]) && P.VOWELS.length === 10, 'the ten vowels, the words they were read in, and the file’s codes');
t.ok(P.GROUPS.map(group => group.speakers).join() === '33,28,15' && P.GROUPS.map(group => group.name).join() === 'men,women,children' && P.STUDY.speakers === SRC.study.men + SRC.study.women + SRC.study.children && P.STUDY.recorded === P.STUDY.speakers * SRC.study.lists * SRC.study.words && P.STUDY.recorded === SRC.study.recorded && P.STUDY.listeners === SRC.study.listeners && P.STUDY.lists === 2 && P.STUDY.words === 10, '33 men, 28 women and 15 children reading 10 words twice: 1,520, heard by 70 listeners');
assert.deepEqual({...P.KALDI, hamming: [...P.KALDI.hamming], hann: [...P.KALDI.hann]}, {rate: SRC.kaldi.rate, frame: SRC.kaldi.frame, shift: SRC.kaldi.shift, hamming: SRC.kaldi.hamming, hann: SRC.kaldi.hann, filters: SRC.kaldi.filters, low: SRC.kaldi.low, melFactor: SRC.kaldi.factor, melCorner: SRC.kaldi.corner, ceps: SRC.kaldi.ceps}, 'Kaldi’s defaults');
assert.deepEqual({...P.PSF}, {filters: SRC.psf.filters, nfft: SRC.psf.nfft, melFactor10: SRC.psf.factor10}, 'python_speech_features’ defaults');
t.ok(P.PAGES.telephone === SRC.pages.telephone && P.PAGES.wideband === SRC.pages.wideband && P.PAGES.menF0.join() === '90,155' && P.PAGES.womenF0.join() === '165,255' && P.PAGES.band.join() === '300,3400' && P.PAGES.consonants === 24 && P.PAGES.vowelsRP === 20 && P.PAGES.vowelsGA.join() === '14,16' && f2(P.PAGES.mel440) === SRC.pages.mel440, 'the pages’ figures typed in again');
assert.deepEqual(JSON.parse(JSON.stringify(P.DECLARED)), SRC.declared, 'the declared values');
assert.deepEqual(JSON.parse(JSON.stringify(P.SPEECH_DOMAINS)), {first: [0, 9, 1], second: [0, 9, 1], speaker: [0, 2, 1], templates: [0, 2, 1], rate: [8, 16, 8], window: [0, 2, 1]});
assert.deepEqual({...P.SPEECH_DEFAULTS}, {first: 4, second: 0, speaker: 0, templates: 0, rate: 16, window: 0});
t.add(6);
t.ok(P.SPEECH_DOMAINS.rate[0] * 1000 === SRC.pages.telephone && P.SPEECH_DOMAINS.rate[1] * 1000 === SRC.pages.wideband && P.SPEECH_DEFAULTS.rate * 1000 === SRC.kaldi.rate, 'the rates: a telephone’s 8 kHz and Kaldi’s 16 kHz');
assert.deepEqual(P.VOWEL_OPTIONS.map(option => [option.value, option.label]), SRC.ipa.map((symbol, i) => [i, `[${symbol}] as in ${SRC.words[i]}`]));
assert.deepEqual(P.SPEAKER_OPTIONS.map(option => [option.value, option.label]), [[0, 'A man'], [1, 'A woman'], [2, 'A child']]);
assert.deepEqual(P.TEMPLATE_OPTIONS.map(option => [option.value, option.label]), [[0, 'Patterns from men'], [1, 'Patterns from women'], [2, 'Patterns from children']]);
assert.deepEqual(P.RATE_OPTIONS.map(option => [option.value, option.label]), [[8, '8 kHz, a telephone'], [16, '16 kHz, wideband']]);
assert.deepEqual(P.WINDOW_OPTIONS.map(option => [option.value, option.label]), [[0, 'Hamming'], [1, 'Hann'], [2, 'Rectangular, no window']]);
t.add(5);
t.ok(SRC.f0[0].every(hz => hz >= SRC.pages.menF0[0] && hz <= SRC.pages.menF0[1]) && SRC.f0[1].every(hz => hz >= SRC.pages.womenF0[0] && hz <= SRC.pages.womenF0[1]), 'Table II’s men and women inside the Voice frequency page’s typical adult pitches');
t.near(SRC.kaldi.hamming[0], SRC.pages.hammingExact, 0.004, 'Hamming’s 0.54, about 25/46 as the Window function page puts it');
t.ok(SRC.kaldi.hamming[0] + SRC.kaldi.hamming[1] === 1 && SRC.kaldi.hann[0] + SRC.kaldi.hann[1] === 1, 'both windows are 1 in the middle');

// The mel scale, both forms.
const melK = hz => SRC.kaldi.factor * Math.log(1 + hz / SRC.kaldi.corner), mel10 = hz => SRC.psf.factor10 * Math.log10(1 + hz / SRC.kaldi.corner), hzK = mel => SRC.kaldi.corner * (Math.exp(mel / SRC.kaldi.factor) - 1);
t.ok(f2(melK(440)) === SRC.pages.mel440 && f2(mel10(440)) === SRC.pages.mel440, 'the Mel scale page’s 440 Hz = 549.64 mels, by Kaldi’s form and by the page’s');
for (let hz = 0; hz <= 8000; hz += 25) {
  t.near(P.melOf(hz), melK(hz), 1e-9 * (1 + melK(hz)), `Kaldi’s mel scale at ${hz} Hz`);
  t.near(melK(hz), mel10(hz), 6e-6 * mel10(hz) + 1e-12, 'the two forms agree');
  t.near(P.hzOfMel(P.melOf(hz)), hz, 1e-9 * (1 + hz), 'and invert');
}
t.near(melK(1000), 1000, 0.05, '1,000 Hz near 1,000 mels');

// The measurements.
const rowText = m => `${m.group + 1} ${m.speaker} ${SRC.file.order[m.vowel]} ${m.unanimous ? '' : '*'}${SRC.codes[m.vowel]} ${m.f0} ${m.f1} ${m.f2} ${m.f3}`;
t.ok(P.MEASUREMENTS.length === SRC.study.recorded, '1,520 measurements');
for (const [i, text] of Object.entries(SRC.file.rows)) t.ok(rowText(P.MEASUREMENTS[i]) === text, `row ${i} as the file gives it`);
P.MEASUREMENTS.forEach((m, i) => { t.ok(m.group === (m.speaker <= 33 ? 0 : m.speaker <= 61 ? 1 : 2) && m.speaker === Math.floor(i / 20) + 1 && m.vowel === SRC.file.order.indexOf(Math.floor(i / 2) % 10 + 1), 'speakers 1 to 33 men, 34 to 61 women and 62 to 76 children, each saying the ten vowels twice'); counts.measurements++; });
const worst = {f0: 0, f1: 0, f2: 0, f3: 0};
for (let g = 0; g < 3; g++) {
  const set = P.MEASUREMENTS.filter(m => m.group === g);
  t.ok(set.length === [SRC.study.men, SRC.study.women, SRC.study.children][g] * 20 && set.filter(m => !m.unanimous).length === SRC.file.starred[g], `${P.GROUPS[g].name}: every speaker’s 20 vowels and the starred ones`);
  assert.deepEqual(['f0', 'f1', 'f2', 'f3'].map(key => sum(set.map(m => m[key]))), SRC.file.sums[g], `${P.GROUPS[g].name}: the file’s column sums`);
  t.add();
  for (let v = 0; v < 10; v++) {
    const said = set.filter(m => m.vowel === v);
    ['f0', 'f1', 'f2', 'f3'].forEach((key, k) => {
      const difference = sum(said.map(m => m[key])) / said.length - SRC[key][g][v];
      t.ok(Math.abs(difference) <= [5, 15, 25, 85][k], `${P.GROUPS[g].name}’ [${SRC.ipa[v]}] ${key}: the file’s mean within ${[5, 15, 25, 85][k]} Hz of Table II`);
      worst[key] = Math.max(worst[key], Math.abs(difference));
    });
  }
}
t.ok(f1(worst.f0) === '4.3' && f1(worst.f1) === '14.1' && f1(worst.f2) === '23.3' && f1(worst.f3) === '83.3', 'the verified file’s means differ from Table II by up to 4.3, 14.1, 23.3 and 83.3 Hz');
const nearestAverage = (m, table) => { let best = 0, bestDistance = Infinity; for (let v = 0; v < 10; v++) { const distance = Math.hypot(m.f1 - SRC.f1[table][v], m.f2 - SRC.f2[table][v]); if (distance < bestDistance) { bestDistance = distance; best = v; } } return best; };
const ownNearest = P.MEASUREMENTS.filter(m => nearestAverage(m, m.group) === m.vowel).length;
const children = P.MEASUREMENTS.filter(m => m.group === 2), childrenByMen = children.filter(m => nearestAverage(m, 0) === m.vowel).length;
t.ok(ownNearest === 1210 && childrenByMen === 69 && children.length === 300, 'nearest their own speakers’ average for 1,210 of 1,520; nearest men’s for only 69 of the children’s 300');
const judged = sum(SRC.tableI.map(sum)), right = sum(SRC.tableI.map((row, i) => row[i])), mixups = SRC.tableI.flatMap((row, i) => row.map((count, j) => [count, i, j]).filter(([, a, b]) => a !== b)).sort((a, b) => b[0] - a[0]);
t.ok(judged === 102780 && right === 97058 && f1(100 * right / judged) === '94.4' && mixups[0].join() === '1013,4,5' && mixups[1].join() === '949,2,3', 'Table I: 94.4% of 102,780, and the commonest mix-ups [ɑ] as [ɔ] and [ɛ] as [æ]');

// The voice, integrated again: the sawtooth's series cut at half the sample
// rate, driving three resonances as differential equations y'' + 2πB y' +
// (2πF)² y = (2πF)² u, each driving the next, from rest until the start has died away.
function integratedVoice(group, vowel, rate) {
  const pitch = SRC.f0[group][vowel], formants = [SRC.f1[group][vowel], SRC.f2[group][vowel], SRC.f3[group][vowel]], orders = [];
  for (let k = 1; k * pitch < rate / 2; k++) orders.push(k);
  const source = time => { let value = 0; for (const k of orders) value += -(2 / Math.PI) * (-1) ** k * Math.sin(2 * Math.PI * k * pitch * time) / k; return value; };
  const stiffness = formants.map(hz => (2 * Math.PI * hz) ** 2), damping = SRC.declared.bandwidths.map(hz => 2 * Math.PI * hz);
  const slope = (s, u) => [s[1], stiffness[0] * (u - s[0]) - damping[0] * s[1], s[3], stiffness[1] * (s[0] - s[2]) - damping[1] * s[3], s[5], stiffness[2] * (s[2] - s[4]) - damping[2] * s[5]];
  const perSample = 24, h = 1 / (rate * perSample), out = [];
  let state = [0, 0, 0, 0, 0, 0];
  for (let step = 0; step < 0.3 * rate * perSample; step++) {
    const time = step * h;
    if (step % perSample === 0 && time >= 0.25 - 1e-12) out.push([time, state[4]]);
    const u0 = source(time), half = source(time + h / 2), u1 = source(time + h);
    const k1 = slope(state, u0), k2 = slope(state.map((x, i) => x + h / 2 * k1[i]), half), k3 = slope(state.map((x, i) => x + h / 2 * k2[i]), half), k4 = slope(state.map((x, i) => x + h * k3[i]), u1);
    state = state.map((x, i) => x + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    counts.steps++;
  }
  return out;
}
for (const [group, vowel, rate] of [[0, 4, 16000], [2, 0, 8000], [1, 9, 16000]]) {
  const voice = P.voiceOf(group, vowel, rate), integrated = integratedVoice(group, vowel, rate), peak = Math.max(...integrated.map(([, y]) => Math.abs(y)));
  t.ok(voice.harmonics.length === Math.ceil(rate / 2 / SRC.f0[group][vowel]) - 1 && voice.harmonics.every((h, i) => h.k === i + 1 && h.frequency === (i + 1) * SRC.f0[group][vowel] && h.frequency < rate / 2), `${P.GROUPS[group].name}’ [${SRC.ipa[vowel]}] at ${rate} Hz: every harmonic below half the sample rate`);
  for (const [time, y] of integrated) t.near(P.voiceAt(voice, time), y, 2e-4 * peak, `${P.GROUPS[group].name}’ [${SRC.ipa[vowel]}] at ${f1(time * 1000)} ms: the harmonic sum is the resonances’ steady answer`);
}

// Frames, windows, the transform, the filters and the features, worked out again.
const typedWindow = (type, length) => Float64Array.from({length}, (_, n) => (type === 2 ? 1 : type === 0 ? SRC.kaldi.hamming[0] - SRC.kaldi.hamming[1] * Math.cos(2 * Math.PI * n / (length - 1)) : SRC.kaldi.hann[0] - SRC.kaldi.hann[1] * Math.cos(2 * Math.PI * n / (length - 1))));
const trig = new Map();
function directPower(values, nfft) {
  const key = `${values.length}:${nfft}`;
  if (!trig.has(key)) trig.set(key, Array.from({length: nfft / 2 + 1}, (_, k) => [Float64Array.from({length: values.length}, (_, n) => Math.cos(2 * Math.PI * k * n / nfft)), Float64Array.from({length: values.length}, (_, n) => Math.sin(2 * Math.PI * k * n / nfft))]));
  return Float64Array.from(trig.get(key), ([cos, sin]) => { let re = 0, im = 0; for (let n = 0; n < values.length; n++) { re += values[n] * cos[n]; im -= values[n] * sin[n]; } return re * re + im * im; });
}
const banks = new Map();
function typedBank(rate, nfft) {
  const key = `${rate}:${nfft}`;
  if (banks.has(key)) return banks.get(key);
  const low = melK(SRC.kaldi.low), high = melK(rate / 2), step = (high - low) / (SRC.kaldi.filters + 1);
  const bank = Array.from({length: SRC.kaldi.filters}, (_, j) => {
    const left = low + j * step, center = low + (j + 1) * step, right = low + (j + 2) * step;
    const weights = Float64Array.from({length: nfft / 2}, (_, i) => { const mel = melK(i * rate / nfft); return mel > left && mel < right ? (mel <= center ? (mel - left) / (center - left) : (right - mel) / (right - center)) : 0; });
    return {left: hzK(left), center: hzK(center), right: hzK(right), weights};
  });
  banks.set(key, bank);
  return bank;
}
const dct2 = (values, count) => Array.from({length: count}, (_, i) => Math.sqrt((i ? 2 : 1) / values.length) * sum(values.map((value, j) => value * Math.cos(Math.PI * i * (j + 0.5) / values.length))));
const dct3 = coefficients => Array.from({length: coefficients.length}, (_, j) => sum(coefficients.map((c, i) => Math.sqrt((i ? 2 : 1) / coefficients.length) * c * Math.cos(Math.PI * i * (j + 0.5) / coefficients.length))));
const framingOf = rate => { const length = rate * SRC.kaldi.frame / 1000, shift = rate * SRC.kaldi.shift / 1000; let nfft = 1; while (nfft < length) nfft *= 2; const total = Math.round(rate * (2 * SRC.declared.silence + 2 * SRC.declared.vowel)); return {length, shift, nfft, total, count: 1 + Math.floor((total - length) / shift)}; };
function ownFeatures(samples, start, rate, type) {
  const {length, nfft} = framingOf(rate), w = typedWindow(type, length), windowed = Float64Array.from({length}, (_, n) => samples[start + n] * w[n]);
  const power = directPower(windowed, nfft), bank = typedBank(rate, nfft);
  const mel = bank.map(filter => { let total = 0; filter.weights.forEach((weight, i) => { total += weight * power[i]; }); return total; });
  const logMel = mel.map(energy => Math.log(Math.max(energy, SRC.declared.floor)));
  let energy = 0;
  for (let n = 0; n < length; n++) energy += samples[start + n] ** 2;
  counts.frames++;
  counts.lines += nfft / 2 + 1;
  return {windowed, power, mel, logMel, ceps: dct2(logMel, SRC.kaldi.ceps), energy};
}
const distanceOf = (a, b) => Math.sqrt(sum(Array.from({length: SRC.kaldi.ceps - 1}, (_, i) => (a[i + 1] - b[i + 1]) ** 2)));
const closeTo = (a, b, share, floor = 0) => Math.abs(a - b) <= share * Math.max(Math.abs(a), Math.abs(b)) + floor;

// The window's transform in closed form: Σ w[n] e^(iαn) as geometric series.
function windowTransform(type, length) {
  const [a, b] = type === 2 ? [1, 0] : type === 0 ? SRC.kaldi.hamming : SRC.kaldi.hann, beta = 2 * Math.PI / (length - 1);
  const geometric = alpha => { const dr = 1 - Math.cos(alpha), di = -Math.sin(alpha), size = dr * dr + di * di; if (size < 1e-24) return [length, 0]; const nr = 1 - Math.cos(alpha * length), ni = -Math.sin(alpha * length); return [(nr * dr + ni * di) / size, (ni * dr - nr * di) / size]; };
  return alpha => { const g0 = geometric(alpha), gp = geometric(alpha + beta), gm = geometric(alpha - beta); return [a * g0[0] - b / 2 * (gp[0] + gm[0]), a * g0[1] - b / 2 * (gp[1] + gm[1])]; };
}
// A frame wholly inside a vowel as Σ over harmonics of A/(2i)[e^(iψ)W(θ − ω) − e^(−iψ)W(−θ − ω)].
function closedFormPower(plan, item) {
  const slot = item.inside === 'first' ? 0 : 1, voice = plan.voices[slot], W = windowTransform(plan.values.window, plan.length);
  return Float64Array.from({length: plan.nfft / 2 + 1}, (_, k) => {
    const omega = 2 * Math.PI * k / plan.nfft;
    let re = 0, im = 0;
    for (const h of voice.harmonics) {
      const theta = 2 * Math.PI * h.frequency / plan.rate, psi = theta * (item.start - plan.bounds[slot]) + h.phase, c = Math.cos(psi), s = Math.sin(psi);
      const [pr, pi] = W(theta - omega), [mr, mi] = W(-theta - omega);
      const dr = (c * pr - s * pi) - (c * mr + s * mi), di = (c * pi + s * pr) - (c * mi - s * mr);
      re += h.amplitude * di / 2;
      im -= h.amplitude * dr / 2;
    }
    return (re * re + im * im) / plan.peak ** 2;
  });
}

// Kaldi's frame count and sizes at both rates, and the windows as Kaldi writes them.
for (const rate of [8000, 16000]) {
  const expected = framingOf(rate), frame = P.framing(rate, expected.total);
  t.ok(frame.length === expected.length && frame.shift === expected.shift && frame.nfft === expected.nfft && frame.count === expected.count && expected.count === 58 && expected.nfft === (rate === 16000 ? 512 : 256), `${rate} Hz: frames of ${expected.length} samples every ${expected.shift}, padded to ${expected.nfft}, 58 of them`);
  t.ok(P.framing(rate, expected.length - 1).count === 0 && P.framing(rate, expected.length).count === 1, 'no frame until a whole frame has arrived');
  for (const type of [0, 1, 2]) {
    const w = P.windowOf(type, expected.length), typed = typedWindow(type, expected.length);
    t.ok(w.every((value, n) => Math.abs(value - typed[n]) < 1e-15), `window ${type} at ${expected.length} samples as Kaldi writes it`);
  }
  t.ok(P.PSF.nfft === framingOf(16000).nfft, 'python_speech_features’ 512 is the power of two above 400 samples');
}

// Sidelobes, found by searching the exact transform.
function searchLeakage(type, length, rate) {
  const W = windowTransform(type, length), size = alpha => Math.hypot(...W(alpha)), main = size(0), stepAlpha = 2 * Math.PI / (length * 128);
  const golden = (a, b, sign) => { const r = (Math.sqrt(5) - 1) / 2; let c = b - r * (b - a), d = a + r * (b - a); for (let i = 0; i < 80; i++) { if (sign * size(c) > sign * size(d)) b = d; else a = c; c = b - r * (b - a); d = a + r * (b - a); } return (a + b) / 2; };
  let previous = main, alpha = stepAlpha, current = size(alpha);
  while (!(current <= previous && current <= size(alpha + stepAlpha))) { previous = current; alpha += stepAlpha; current = size(alpha); }
  const firstNull = golden(alpha - stepAlpha, alpha + stepAlpha, -1);
  let highest = 0;
  for (let a = firstNull + stepAlpha; a < Math.PI - stepAlpha; a += stepAlpha) {
    const here = size(a);
    if (here >= size(a - stepAlpha) && here >= size(a + stepAlpha)) highest = Math.max(highest, size(golden(a - stepAlpha, a + stepAlpha, 1)));
  }
  return {sidelobe: 20 * Math.log10(highest / main), firstNull: firstNull / (2 * Math.PI) * rate};
}
const leakageTyped = {};
for (const [length, rate] of [[400, 16000], [200, 8000]]) for (const type of [0, 1, 2]) {
  const found = searchLeakage(type, length, rate), module = P.leakageOf(type, length, rate);
  leakageTyped[`${type}:${length}`] = found;
  t.near(module.sidelobe, found.sidelobe, 0.02, `window ${type} over ${length} samples: its strongest sidelobe, searched on its exact transform`);
  t.near(module.firstNull, found.firstNull, 0.01, 'and where its main lobe first falls to nothing, by halving against the search');
}
t.ok(f1(-leakageTyped['0:400'].sidelobe) === '42.7' && f1(-leakageTyped['1:400'].sidelobe) === '31.5' && f1(-leakageTyped['2:400'].sidelobe) === '13.3', 'sidelobes of 42.7, 31.5 and 13.3 dB');
t.ok(leakageTyped['0:400'].sidelobe < leakageTyped['1:400'].sidelobe - 10, 'Hamming’s highest sidelobe more than 10 dB under Hann’s, which it was built to cancel');

// The filter bank.
for (const [rate, nfft] of [[16000, 512], [8000, 256]]) {
  const bank = P.melBankOf(rate, nfft), typed = typedBank(rate, nfft), spacing = typed.map(filter => mel10(filter.center));
  t.ok(bank.filters.length === 23 && bank.lines === nfft / 2 && bank.width === rate / nfft, `${rate} Hz: 23 filters over ${nfft / 2} lines ${rate / nfft} Hz apart`);
  bank.filters.forEach((filter, j) => {
    t.ok(closeTo(filter.leftHz, typed[j].left, 1e-12, 1e-9) && closeTo(filter.centerHz, typed[j].center, 1e-12, 1e-9) && closeTo(filter.rightHz, typed[j].right, 1e-12, 1e-9) && filter.weights.every((weight, i) => Math.abs(weight - typed[j].weights[i]) < 1e-12), `filter ${j}: Kaldi’s triangle`);
    if (j > 0) t.near(spacing[j] - spacing[j - 1], spacing[1] - spacing[0], 1e-9 * spacing[1], 'centers equally spaced on the page’s 2595 log10 form too');
    if (j > 0) t.ok(filter.rightHz - filter.leftHz > bank.filters[j - 1].rightHz - bank.filters[j - 1].leftHz, 'each filter wider than the one below');
  });
  t.near(bank.filters[0].leftHz, SRC.kaldi.low, 1e-9, 'from 20 Hz');
  t.near(bank.filters[22].rightHz, rate / 2, 1e-9, 'to half the sample rate');
  for (let i = 0; i < nfft / 2; i++) {
    const hz = i * rate / nfft;
    if (hz >= bank.filters[0].centerHz && hz <= bank.filters[22].centerHz) t.near(sum(bank.filters.map(filter => filter.weights[i])), 1, 1e-12, `${hz} Hz: neighboring triangles add up to one`);
  }
  // A pure tone at each filter's center lands in that filter.
  for (let j = 0; j < 23; j++) {
    const tone = Float64Array.from({length: framingOf(rate).length}, (_, n) => Math.sin(2 * Math.PI * bank.filters[j].centerHz * n / rate)), features = P.frameFeatures(tone, 0, rate, 1);
    const loudest = features.mel.indexOf(Math.max(...features.mel));
    t.ok(loudest === j, `${rate} Hz: a tone at ${f0(bank.filters[j].centerHz)} Hz is loudest in filter ${j}`);
  }
}
const bank16 = typedBank(16000, 512);
t.ok(f0(bank16[0].left) === '20' && f0(bank16[0].right) === '186' && f0(bank16[22].left) === '6,369' && f0(bank16[22].right) === '8,000', 'the first filter 20 to 186 Hz and the last 6,369 to 8,000 Hz');

// Every frame of several utterances, worked out again.
const settings = [{}, {window: 1}, {window: 2}, {rate: 8}, {rate: 8, window: 1, speaker: 2, first: 9, second: 3}, {speaker: 1, first: 7, second: 2, templates: 2}, {speaker: 2, first: 2, second: 7}, {first: 5, second: 5, window: 2, templates: 1}];
for (const values of settings) {
  const plan = P.speechPlan(values), rate = plan.values.rate * 1000, frame = framingOf(rate), silence = Math.round(SRC.declared.silence * rate), vowel = Math.round(SRC.declared.vowel * rate);
  const label = JSON.stringify(values);
  t.ok(plan.rate === rate && plan.total === frame.total && plan.count === frame.count && plan.length === frame.length && plan.shift === frame.shift && plan.nfft === frame.nfft && plan.binWidth === rate / frame.nfft && plan.nyquist === rate / 2 && plan.duration === 0.6, `${label}: the framing`);
  assert.deepEqual(plan.bounds, [silence, silence + vowel, silence + 2 * vowel]);
  t.ok(Math.max(...plan.samples.map(Math.abs)) === 1, `${label}: the largest sample scaled to 1`);
  for (let n = 0; n < plan.total; n++) {
    if (n < plan.bounds[0] || n >= plan.bounds[2]) { if (plan.samples[n] !== 0) t.ok(false, 'silence is zero'); continue; }
    const slot = n < plan.bounds[1] ? 0 : 1, expected = P.voiceAt(plan.voices[slot], (n - plan.bounds[slot]) / rate) / plan.peak;
    if (Math.abs(plan.samples[n] - expected) > 1e-12) t.ok(false, `${label}: sample ${n} is the voice at its time`);
  }
  t.add(plan.total);
  t.ok(plan.voices[0].vowel === plan.values.first && plan.voices[1].vowel === plan.values.second && plan.voices.every(voice => voice.group === plan.values.speaker), 'the voices said');
  const stored = P.patternsOf(plan.values.templates, rate, plan.values.window);
  t.ok(plan.patterns === stored, 'the patterns for the chosen speakers, rate and window');
  let reference = 0, melReference = 0, loudest = 0;
  const own = plan.frames.map((item, f) => {
    const mine = ownFeatures(plan.samples, f * frame.shift, rate, plan.values.window);
    t.ok(item.start === f * frame.shift && item.end === item.start + frame.length && item.index === f, 'frames start a shift apart');
    t.ok(item.windowed.every((value, n) => Math.abs(value - mine.windowed[n]) < 1e-15), 'the frame through its window');
    t.ok(item.power.every((p, k) => closeTo(p, mine.power[k], 1e-9, 1e-12)), `${label} frame ${f}: the FFT’s power is the defining sum’s`);
    const full = mine.power[0] + mine.power[frame.nfft / 2] + 2 * sum(Array.from(mine.power.slice(1, frame.nfft / 2)));
    t.near(sum(Array.from(mine.windowed, x => x * x)), full / frame.nfft, 1e-9 * full / frame.nfft + 1e-15, 'Parseval: the energy in the frame is the power summed over every line');
    if (item.inside === 'first' || item.inside === 'second') {
      const closed = closedFormPower(plan, item), top = Math.max(...closed);
      t.ok(item.power.every((p, k) => Math.abs(p - closed[k]) <= 1e-6 * p + 1e-9 * top), `${label} frame ${f}: and the harmonics’ windowed transforms in closed form`);
    }
    // The transform's rounding, about 1e-12 on a line, bounds how closely tiny energies can agree.
    const logBound = mine.mel.map(energy => 1e-9 + 1e-10 / Math.max(energy, SRC.declared.floor)), cepsBound = Math.sqrt(2 / 23) * sum(logBound);
    t.ok(item.mel.every((energy, j) => closeTo(energy, mine.mel[j], 1e-9, 1e-10)) && item.logMel.every((value, j) => Math.abs(value - mine.logMel[j]) <= logBound[j]) && item.ceps.every((c, i) => Math.abs(c - mine.ceps[i]) <= cepsBound), `${label} frame ${f}: the filters, their logarithms and the cosine transform, to the transform’s rounding`);
    t.near(item.energy, mine.energy, 1e-12 * mine.energy + 1e-15, 'the frame’s energy before the window');
    const distances = stored.map(pattern => distanceOf(mine.ceps, pattern.ceps));
    const ranked = [...distances].sort((a, b) => a - b), distanceBound = Math.sqrt(12) * cepsBound + 1e-9;
    t.ok(item.distances.every((d, v) => Math.abs(d - distances[v]) <= distanceBound) && (ranked[1] - ranked[0] <= 2 * distanceBound || item.nearest === distances.indexOf(ranked[0])), `${label} frame ${f}: the distance to each pattern and the nearest`);
    t.ok(item.peakLine === mine.power.indexOf(Math.max(...mine.power)) && item.peakHz === item.peakLine * rate / frame.nfft, 'the strongest line');
    const center = [item.start, item.end];
    t.ok(JSON.stringify(item.under) === JSON.stringify([0, 1].filter(slot => center[0] < plan.bounds[slot + 1] && center[1] > plan.bounds[slot]).map(slot => [plan.values.first, plan.values.second][slot])), 'the vowels under the frame');
    const kind = item.end <= plan.bounds[0] || item.start >= plan.bounds[2] ? 'silence' : item.start >= plan.bounds[0] && item.end <= plan.bounds[1] ? 'first' : item.start >= plan.bounds[1] && item.end <= plan.bounds[2] ? 'second' : item.start < plan.bounds[1] && item.end > plan.bounds[1] ? 'join' : 'edge';
    t.ok(item.inside === kind, `frame ${f} ${kind}`);
    reference = Math.max(reference, ...mine.power);
    melReference = Math.max(melReference, ...mine.mel);
    loudest = Math.max(loudest, mine.energy);
    // The cosine transform inverted.
    const everything = P.cosineTransform(item.logMel, 23);
    t.ok(Array.from(everything.slice(0, 13)).every((c, i) => Math.abs(c - item.ceps[i]) < 1e-12) && dct3(Array.from(everything)).every((value, j) => Math.abs(value - item.logMel[j]) < 1e-9), 'the cosine transform of all 23 turns back into the filters’ logarithms');
    return mine;
  });
  t.near(plan.reference, reference, 1e-9 * reference, `${label}: the loudest line`);
  t.near(plan.melReference, melReference, 1e-9 * melReference, 'the loudest filter');
  t.near(plan.loudest, loudest, 1e-12 * loudest, 'the loudest frame');
  plan.frames.forEach((item, f) => {
    const level = 10 * Math.log10(Math.max(own[f].energy, SRC.declared.floor) / loudest);
    t.near(item.level, level, 1e-9, 'each frame’s level');
    t.ok(item.silent === level < -SRC.declared.quiet && item.label === (item.silent ? -1 : item.nearest), 'silence more than 30 dB down, and otherwise the nearest vowel');
    t.ok(item.db.every((db, k) => Math.abs(db - Math.max(SRC.declared.bottom, 10 * Math.log10(Math.max(own[f].power[k], SRC.declared.floor) / reference))) <= 1e-6 + 10 / Math.LN10 * (1e-9 + 1e-12 / Math.max(own[f].power[k], SRC.declared.floor))), 'each line in dB against the loudest');
  });
  const firsts = plan.frames.filter(item => item.inside === 'first');
  t.ok(plan.preview === firsts[Math.floor(firsts.length / 2)].index, 'the frame shown before Play: the middle one of the first vowel');
  // Joining frames into phonemes.
  const runs = [];
  plan.labels.forEach((labelOf, f) => { if (runs.length && runs.at(-1)[0] === labelOf) runs.at(-1)[2]++; else runs.push([labelOf, f, 1]); });
  assert.deepEqual(plan.runs.map(run => [run.label, run.start, run.count]), runs);
  const phonemes = runs.filter(([labelOf, , count]) => labelOf >= 0 && count >= SRC.declared.run).map(([labelOf]) => labelOf), heard = phonemes.filter((v, i) => i === 0 || v !== phonemes[i - 1]);
  const said = plan.values.first === plan.values.second ? [plan.values.first] : [plan.values.first, plan.values.second];
  t.ok(JSON.stringify(plan.heard) === JSON.stringify(heard) && JSON.stringify(plan.said) === JSON.stringify(said) && plan.recognized === (JSON.stringify(heard) === JSON.stringify(said)), `${label}: heard ${heard.map(v => SRC.ipa[v]).join(' ')}`);
  const steady = plan.frames.filter(item => item.inside === 'first' || item.inside === 'second');
  t.ok(plan.steadyCount === steady.length && steady.length === 46 && plan.steadyRight === steady.filter(item => item.label === (item.inside === 'first' ? plan.values.first : plan.values.second)).length, 'frames wholly inside a vowel, and how many matched it');
  const lastVoiced = plan.frames.filter(item => !item.silent).at(-1).index;
  t.ok(plan.lastVoiced === lastVoiced, `${label}: the last frame with voice in it`);
  // The clock.
  for (const time of [0, 0.0249, 0.025, 0.03, 0.3, 0.31, 0.595, 0.6, 1]) {
    const now = P.speechAt(plan, time), arrived = Math.min(plan.total, Math.floor(time * rate + 1e-6)), heardFrames = arrived < frame.length ? 0 : Math.min(frame.count, 1 + Math.floor((arrived - frame.length) / frame.shift));
    t.ok(now.arrived === arrived && now.heardFrames === heardFrames && now.shown === (heardFrames === 0 ? plan.preview : time >= 0.6 ? lastVoiced : heardFrames - 1) && now.frame === plan.frames[now.shown] && now.done === (time >= 0.6) && now.t === Math.min(time, 0.6), `${label} at ${time} s: ${heardFrames} frames heard`);
  }
}
// The stored patterns, built again from the voice for two sets.
for (const [group, rate, type] of [[0, 16000, 0], [2, 8000, 1]]) {
  const stored = P.patternsOf(group, rate, type), frames = 1 + Math.floor((rate * SRC.declared.vowel - rate * SRC.kaldi.frame / 1000) / (rate * SRC.kaldi.shift / 1000));
  stored.forEach((pattern, vowel) => {
    const voice = P.voiceOf(group, vowel, rate), samples = Float64Array.from({length: rate * SRC.declared.vowel}, (_, n) => P.voiceAt(voice, n / rate)), mean = new Array(13).fill(0);
    let bound = 0;
    for (let f = 0; f < frames; f++) { const features = ownFeatures(samples, f * rate * SRC.kaldi.shift / 1000, rate, type); features.ceps.forEach((c, i) => { mean[i] += c / frames; }); bound = Math.max(bound, Math.sqrt(2 / 23) * sum(features.mel.map(energy => 1e-9 + 1e-10 / Math.max(energy, SRC.declared.floor)))); }
    t.ok(pattern.frames === frames && frames === 23 && pattern.vowel === vowel && Array.from(pattern.ceps).every((c, i) => Math.abs(c - mean[i]) <= bound), `${P.GROUPS[group].name}’ [${SRC.ipa[vowel]}] pattern at ${rate} Hz: the mean of its 23 frames`);
  });
}
// The top filters wander under a Hamming window and settle under Hann's.
const spreadOf = (plan, slot) => { const steady = plan.frames.filter(item => item.inside === slot); return Array.from({length: 23}, (_, j) => { const column = steady.map(item => 10 * Math.log10(Math.max(item.mel[j], SRC.declared.floor))), mean = sum(column) / column.length; return Math.sqrt(sum(column.map(value => (value - mean) ** 2)) / column.length); }); };
{
  const hamming = spreadOf(P.speechPlan({}), 'first'), hann = spreadOf(P.speechPlan({window: 1}), 'first');
  t.ok(Math.min(...hamming.slice(16)) > 5 && Math.max(...hamming.slice(0, 12)) < 1 && Math.max(...hann) < 1, 'under Hamming the top 7 filters wander by more than 5 dB from frame to frame while its lower 12 and all of Hann’s stay within 1 dB');
  const plan = P.speechPlan({});
  t.ok(plan.steadyRight === 45 && plan.frames.filter(item => (item.inside === 'first' || item.inside === 'second') && item.label !== (item.inside === 'first' ? 4 : 0)).map(item => `${item.index}:${item.label}`).join() === '52:1', 'the one steady frame missed is frame 52, near the end of [i], nearest [ɪ]');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createSpeechModel(), T = model.topology;
const [SX, SY, SW, SH] = M.LAYOUT.samples, [FX, FY, FW, FH] = M.LAYOUT.frame, [PX, PY, PW, PH] = M.LAYOUT.spectrum, [LX, LY, LW, LH] = M.LAYOUT.filters, [CX, CY, CW, CH] = M.LAYOUT.ceps, [DX, DY, DW, DH] = M.LAYOUT.distances, [VX, VY, VW, VH] = M.LAYOUT.voice, [GX, GY, GW, GH] = M.LAYOUT.spectrogram, [TX, TY, TW, TH] = M.LAYOUT.trace, [WX, WY, WW, WH] = M.LAYOUT.vowels;
assert.deepEqual({...M.CHART, f2: [...M.CHART.f2], f1: [...M.CHART.f1]}, {amp: 0.45, closeup: 0.005, tick: 0.05, dot: 0.006, point: 0.006, average: 0.016, ring: 0.03, said: 0.042, nearest: 0.054, cepsScale: 20, distanceScale: 20, f2: [4000, 400], f1: [100, 1400], head: 0.03, mark: 0.007, gramRange: 60, leader: 0.16, units: 14});
t.ok(M.MAX_HZ === 8000 && M.UNHEARD === 0.4, 'the frequency axes to 8,000 Hz, and unheard columns at 0.4 strength');
t.ok(M.dbY(-200) === M.dbY(P.DECLARED.bottom) && Math.abs(M.dbY(P.DECLARED.bottom) - M.LAYOUT.spectrum[1]) < 1e-12 && Math.abs(M.dbY(0) - (M.LAYOUT.spectrum[1] + M.LAYOUT.spectrum[3])) < 1e-12, 'the spectrum axis fills its chart and holds anything below its floor at the bottom');
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const quadsOf = mesh => { const position = mesh.geometry.attributes.position.array, color = mesh.geometry.attributes.color?.array, n = Math.floor(Math.min(mesh.geometry.drawRange.count, mesh.geometry.index.count) / 6); return Array.from({length: n}, (_, i) => ({x0: position[12 * i], y0: position[12 * i + 1], x1: position[12 * i + 3], y1: position[12 * i + 7], color: color ? [color[12 * i], color[12 * i + 1], color[12 * i + 2]] : null})); };
const tint = hex => new THREE.Color(hex), paper = tint(M.COLORS.paper), ink = tint(M.COLORS.ink), guide = tint(M.COLORS.guide), silenceTint = tint(M.COLORS.silence), vowelTints = M.COLORS.vowels.map(tint);
const sameColor = (rgb, color) => Math.abs(rgb[0] - color.r) < 1e-6 && Math.abs(rgb[1] - color.g) < 1e-6 && Math.abs(rgb[2] - color.b) < 1e-6;
const mix = (a, b, share) => a.clone().lerp(b, share);
const valueY = (box, value) => box[1] + box[3] / 2 + value * 0.45 * box[3];
const acrossTime = (box, seconds) => box[0] + seconds / 0.6 * box[2];
const acrossHz = (box, hz) => box[0] + hz / 8000 * box[2];
const near32 = (a, b, tolerance = 2e-6) => Math.abs(a - b) <= tolerance;
const share = db => (Math.max(-80, db) + 80) / 80;
// The spectrogram grades its gray evenly as seen: sRGB values mixed, then turned linear by the sRGB transfer function.
const srgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255], paperS = srgb(M.COLORS.paper), inkS = srgb(M.COLORS.ink);
const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), toSRGB = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const grayTyped = s => { const [r, g, b] = paperS.map((p, i) => toLinear(p + (inkS[i] - p) * s)); return {r, g, b}; }, gramShareTyped = db => Math.max(0, Math.min(1, (db + 60) / 60));
const poses = [{}, {rate: 8}, {window: 1}, {window: 2}, {speaker: 2, first: 2, second: 7}, {speaker: 1, templates: 2, first: 9, second: 9, rate: 8, window: 1}, {first: 7, second: 3, speaker: 2, templates: 2}];
for (const values of poses) {
  for (const time of [0, 0.02, 0.025, 0.3, 0.31, 0.6]) {
    model.reset();
    model.update(values);
    model.advance(time * SRC.declared.slow);
    model.root.updateMatrixWorld(true);
    const state = model.getState(), plan = P.speechPlan(values), now = state.now, item = plan.frames[now.shown], rate = plan.rate, heardFrames = time > 0 ? now.heardFrames : 0;
    const label = `${JSON.stringify(values)} at ${time} s`;
    counts.poses++;
    t.near(state.clock, time, 1e-12, `${label}: the clock runs 20 times slower`);
    t.ok(state.frames === plan.frames && now.shown === (now.heardFrames === 0 ? plan.preview : time >= 0.6 ? plan.lastVoiced : now.heardFrames - 1), 'the model shows the plan’s frame, and once ended the last with voice');

    // The voice.
    const faintPoints = pointsOf(T.waveFaint);
    t.ok(faintPoints.length === plan.total, `the whole utterance drawn faintly: ${plan.total} samples`);
    for (let n = 0; n < plan.total; n += 13) { t.ok(near32(faintPoints[n][0], acrossTime(M.LAYOUT.voice, n / rate)) && near32(faintPoints[n][1], valueY(M.LAYOUT.voice, plan.samples[n])), 'each sample where its time and value put it'); counts.points++; }
    t.ok(T.waveDark.visible === (time > 0 && now.arrived > 0) && (!T.waveDark.visible || T.waveDark.geometry.drawRange.count === now.arrived), 'dark as far as the samples that have arrived');
    const box = pointsOf(T.bracket);
    t.ok(box.length === 5 && near32(box[0][0], acrossTime(M.LAYOUT.voice, item.start / rate)) && near32(box[1][0], acrossTime(M.LAYOUT.voice, (item.start + plan.length) / rate)) && near32(box[2][1], VY + VH) && near32(box[0][1], VY), 'the box around the frame, 25 ms wide');
    t.near((box[1][0] - box[0][0]) / VW * 0.6, 0.025, 1e-6, 'the box spans 25 ms');
    const bounds = pointsOf(T.bounds);
    t.ok(bounds.length === 6 && plan.bounds.every((sample, i) => near32(bounds[2 * i][0], acrossTime(M.LAYOUT.voice, sample / rate))), 'lines where the silence, the vowels and the silence meet');

    // The close up: each dot one sample, 5 ms from the middle of the frame.
    const half = Math.round(rate * 0.005 / 2), center = item.start + plan.length / 2, stems = pointsOf(T.stems), dots = quadsOf(T.dots);
    t.ok(stems.length === 4 * half && dots.length === 2 * half && 2 * half === rate * 0.005, `${2 * half} samples in 5 ms`);
    for (let m = 0; m < 2 * half; m++) {
      const x = SX + (m + 0.5) / (2 * half) * SW, y = valueY(M.LAYOUT.samples, plan.samples[center - half + m]);
      t.ok(near32(stems[2 * m][0], x) && near32(stems[2 * m][1], valueY(M.LAYOUT.samples, 0)) && near32(stems[2 * m + 1][1], y) && near32((dots[m].x0 + dots[m].x1) / 2, x) && near32((dots[m].y0 + dots[m].y1) / 2, y) && near32(dots[m].x1 - dots[m].x0, 2 * 0.006), 'a stem and a dot at each sample');
      counts.points++;
    }
    // The frame, its window and the product, read back.
    const typed = typedWindow(plan.values.window, plan.length), raw = pointsOf(T.rawLine), windowPoints = pointsOf(T.windowLine), windowed = pointsOf(T.windowedLine);
    t.ok(raw.length === plan.length && windowPoints.length === plan.length && windowed.length === plan.length, `${plan.length} samples in the frame`);
    const drawnFrame = new Float64Array(plan.length);
    for (let n = 0; n < plan.length; n++) {
      const x = FX + n / (plan.length - 1) * FW;
      t.ok(near32(raw[n][0], x) && near32(raw[n][1], valueY(M.LAYOUT.frame, plan.samples[item.start + n])) && near32(windowPoints[n][1], valueY(M.LAYOUT.frame, typed[n])) && near32(windowed[n][1], valueY(M.LAYOUT.frame, plan.samples[item.start + n] * typed[n])), 'the frame, the window and their product');
      drawnFrame[n] = (windowed[n][1] - (FY + FH / 2)) / (0.45 * FH);
      counts.points++;
    }
    const closeBox = pointsOf(T.closeBox);
    t.ok(near32(closeBox[0][0], FX + (plan.length / 2 - half) / (plan.length - 1) * FW) && near32(closeBox[1][0], FX + (plan.length / 2 + half - 1) / (plan.length - 1) * FW), 'the small box over the close up’s samples');

    // The spectrum, as the transform of the drawn frame.
    const drawnPower = directPower(drawnFrame, plan.nfft), spectrum = pointsOf(T.spectrumLine);
    t.ok(spectrum.length === plan.nfft / 2 + 1, `${plan.nfft / 2 + 1} lines`);
    spectrum.forEach(([x, y], k) => {
      const db = Math.max(-80, 10 * Math.log10(Math.max(drawnPower[k], SRC.declared.floor) / plan.reference)), drawnDb = (y - PY) / PH * 80 - 80;
      t.ok(near32(x, acrossHz(M.LAYOUT.spectrum, k * plan.binWidth)) && Math.abs(drawnDb - db) < 0.05, `${label}: line ${k} drawn at the drawn frame’s transform`);
      counts.points++;
    });
    t.ok(T.unsampled.visible === (rate === 8000) && T.gramUnsampled.visible === (rate === 8000), 'gray above half the sample rate only at 8 kHz');
    if (rate === 8000) t.ok(near32(T.unsampled.position.x - T.unsampled.scale.x / 2, acrossHz(M.LAYOUT.spectrum, 4000)) && near32(T.gramUnsampled.position.y - T.gramUnsampled.scale.y / 2, GY + 4000 / 8000 * GH), 'from 4,000 Hz');
    {
      const marks = quadsOf(T.formantMarks);
      t.ok(marks.length === 3 * item.under.length && T.formantMarks.visible === item.under.length > 0, 'three formant marks for each vowel under the frame');
      item.under.forEach((vowel, slot) => [SRC.f1, SRC.f2, SRC.f3].forEach((table, i) => { const mark = marks[3 * slot + i]; t.ok(near32((mark.x0 + mark.x1) / 2, acrossHz(M.LAYOUT.spectrum, table[plan.values.speaker][vowel])) && mark.x1 - mark.x0 > 0.01 && sameColor(mark.color, vowelTints[vowel]) && mark.y0 > PY + PH && mark.y1 < PY + PH + 0.11 && (slot === 0 || mark.y0 > marks[i].y1), 'a filled mark at each of Table II’s formants above the chart, in the vowel’s color, a second vowel’s above the first’s'); }));
    }

    // The spectrogram: every column; the shown frame's column is the spectrum curve.
    const lines = plan.nfft / 2 + 1, cells = quadsOf(T.cells);
    t.ok(cells.length === plan.count * lines, `${plan.count} columns of ${lines} lines`);
    for (const f of new Set([...Array.from({length: Math.ceil(plan.count / 5)}, (_, i) => 5 * i), now.shown])) {
      const keep = f < heardFrames ? 1 : 0.4, x0 = acrossTime(M.LAYOUT.spectrogram, (f * plan.shift + plan.length / 2 - plan.shift / 2) / rate), x1 = acrossTime(M.LAYOUT.spectrogram, (f * plan.shift + plan.length / 2 + plan.shift / 2) / rate);
      for (let k = 0; k < lines; k++) {
        const cell = cells[f * lines + k], expected = grayTyped(gramShareTyped(plan.frames[f].db[k]) * keep);
        t.ok(near32(cell.x0, x0) && near32(cell.x1, x1) && near32(cell.y0, GY + Math.max(0, (k - 0.5) * plan.binWidth) / 8000 * GH) && near32(cell.y1, GY + Math.min(rate / 2, (k + 0.5) * plan.binWidth) / 8000 * GH) && sameColor(cell.color, expected), 'a cell at its time and frequency, as dark as its level');
        if (f === now.shown && heardFrames > now.shown) { const drawnShare = (toSRGB(cell.color[0]) - paperS[0]) / (inkS[0] - paperS[0]), drawnDb = (spectrum[k][1] - PY) / PH * 80 - 80; t.near(drawnShare, gramShareTyped(drawnDb), 2e-5, 'the shown column is the spectrum drawn'); counts.shownColumns = (counts.shownColumns || 0) + 1; }
        counts.points++;
      }
    }
    const gramCursor = pointsOf(T.gramCursor), traceCursor = pointsOf(T.traceCursor);
    t.ok(T.gramCursor.visible === time > 0 && T.traceCursor.visible === time > 0, 'cursors once the clock runs');
    if (time > 0) t.ok(near32(gramCursor[0][0], acrossTime(M.LAYOUT.spectrogram, (now.shown * plan.shift + plan.length / 2) / rate)) && near32(traceCursor[0][0], acrossTime(M.LAYOUT.trace, (now.shown * plan.shift + plan.length / 2) / rate)), 'at the shown frame in both');

    // The filters and their energies, from the drawn frame.
    const bank = typedBank(rate, plan.nfft), triangles = pointsOf(T.triangles);
    t.ok(triangles.length === 4 * 23 && bank.every((filter, j) => near32(triangles[4 * j][0], acrossHz(M.LAYOUT.filters, filter.left)) && near32(triangles[4 * j + 1][0], acrossHz(M.LAYOUT.filters, filter.center)) && near32(triangles[4 * j + 3][0], acrossHz(M.LAYOUT.filters, filter.right)) && near32(triangles[4 * j][1], LY + 0.52 * LH) && near32(triangles[4 * j + 1][1], LY + 0.95 * LH)), 'the 23 triangles, left, apex and right');
    const drawnMel = bank.map(filter => sum(Array.from(filter.weights, (weight, i) => weight * drawnPower[i]))), bars = quadsOf(T.melBars);
    bars.forEach((bar, j) => {
      const db = 10 * Math.log10(Math.max(drawnMel[j], SRC.declared.floor) / plan.melReference);
      t.ok(near32(bar.x0, acrossHz(M.LAYOUT.filters, (bank[j].left + bank[j].center) / 2)) && near32(bar.x1, acrossHz(M.LAYOUT.filters, (bank[j].center + bank[j].right) / 2)) && Math.abs(bar.y1 - Math.max(LY + 1e-6, LY + 0.45 * LH * share(db))) < 1e-4 && near32(bar.y0, LY), 'each filter’s bar as tall as the drawn frame’s power in it');
      if (j > 0) t.ok(near32(bar.x0, bars[j - 1].x1), 'bars side by side without overlapping');
    });
    // The coefficients and distances are drawn from the frame the model holds, found again in section 1;
    // where every filter is well above the drawn samples' rounding they also follow from the drawn frame.
    const drawnCeps = dct2(drawnMel.map(energy => Math.log(Math.max(energy, SRC.declared.floor))), 13), cepsBars = quadsOf(T.cepsBars), clampCeps = value => valueY(M.LAYOUT.ceps, Math.max(-1, Math.min(1, value / 20)));
    if (Math.min(...item.mel) > 1e-6 * Math.max(...item.mel)) t.ok(drawnCeps.every((c, i) => Math.abs(c - item.ceps[i]) < 1e-3), 'the coefficients follow from the drawn frame');
    cepsBars.forEach((bar, i) => { const zero = valueY(M.LAYOUT.ceps, 0), top = clampCeps(item.ceps[i + 1]); t.ok(Math.abs(Math.min(bar.y0, bar.y1) - Math.min(zero, top)) < 1e-4 && Math.abs(Math.max(bar.y0, bar.y1) - Math.max(zero, top)) < 1e-4 + 1e-6 && near32(bar.x0, CX + (i + 0.2) * CW / 12), `coefficient ${i + 1} from the drawn frame`); });
    t.ok(T.cepsTicks.visible === !item.silent, 'ticks at the nearest pattern unless silent');
    if (!item.silent) pointsOf(T.cepsTicks).filter((_, i) => i % 2 === 0).forEach(([x, y], i) => t.ok(near32(y, clampCeps(plan.patterns[item.nearest].ceps[i + 1])) && near32(x, CX + i * CW / 12), 'a tick at the nearest pattern’s coefficient'));

    // Distances and the winner.
    const drawnDistances = item.distances, distanceBars = quadsOf(T.distanceBars);
    t.ok(T.distanceBars.visible === !item.silent && T.winnerBox.visible === !item.silent, 'distances drawn unless the frame is silent');
    if (!item.silent) {
      distanceBars.forEach((bar, v) => t.ok(Math.abs(bar.y1 - Math.max(DY + 0.1 * DH + 1e-6, DY + 0.1 * DH + 0.85 * DH * Math.min(1, drawnDistances[v] / 20))) < 1e-4 && near32(bar.x0, DX + (v + 0.15) * DW / 10) && sameColor(bar.color, vowelTints[v]), `the bar for [${SRC.ipa[v]}] as tall as the drawn frame’s distance`));
      const winner = pointsOf(T.winnerBox), nearest = drawnDistances.indexOf(Math.min(...drawnDistances));
      t.ok(nearest === item.nearest && near32(winner[0][0], DX + (nearest + 0.05) * DW / 10) && near32(winner[1][0], DX + (nearest + 0.95) * DW / 10), 'the box around the nearest');
    }
    const said = quadsOf(T.saidMarks);
    t.ok(said.length === item.under.length && item.under.every((vowel, slot) => near32(said[slot].x0, DX + (vowel + 0.3) * DW / 10)), 'a mark under each vowel being said');

    // The trace.
    const trace = quadsOf(T.trace), rows = 13, unit = TH / 14, heardRuns = plan.runs.filter(run => run.label >= 0 && run.count >= 3);
    t.ok(trace.length === plan.count * rows, 'a column of rows for each frame');
    for (let f = 0; f < plan.count; f++) {
      const frameItem = plan.frames[f], keep = f < heardFrames ? 1 : 0.4, x0 = acrossTime(M.LAYOUT.trace, (f * plan.shift + plan.length / 2 - plan.shift / 2) / rate);
      for (let v = 0; v < 10; v++) {
        const cell = trace[f * rows + v], expected = frameItem.silent ? paper : v === frameItem.nearest ? mix(paper, vowelTints[v], keep) : mix(paper, guide, Math.max(0, Math.min(1, 1 - frameItem.distances[v] / 20)) * keep);
        t.ok(near32(cell.x0, x0) && near32(cell.y1, TY + TH - 1.5 * unit - v * unit) && sameColor(cell.color, expected), 'a vowel’s row: its color if nearest, darker the nearer');
      }
      t.ok(sameColor(trace[f * rows + 10].color, mix(paper, silenceTint, frameItem.silent ? keep : 0)) && near32(trace[f * rows + 10].y0, TY + TH - 12.5 * unit), 'the silence row');
      const middle = frameItem.start + plan.length / 2, saidVowel = middle >= plan.bounds[0] && middle < plan.bounds[1] ? plan.values.first : middle >= plan.bounds[1] && middle < plan.bounds[2] ? plan.values.second : -1;
      t.ok(sameColor(trace[f * rows + 11].color, saidVowel < 0 ? paper : mix(paper, vowelTints[saidVowel], keep)) && near32(trace[f * rows + 11].y1, TY + TH), 'the strip of vowels said');
      const run = heardRuns.find(candidate => f >= candidate.start && f < candidate.start + candidate.count), shown = run && f < heardFrames && Math.min(heardFrames, run.start + run.count) - run.start >= 3;
      t.ok(sameColor(trace[f * rows + 12].color, shown ? vowelTints[run.label] : paper) && near32(trace[f * rows + 12].y0, TY), 'the strip of phonemes heard, once a run of 3 frames has arrived');
      counts.points += rows;
    }

    // The vowel chart.
    const f2Across = hz => WX + (4000 - hz) / 3600 * WW, f1Down = hz => WY + WH - (hz - 100) / 1300 * WH, dotsChart = quadsOf(T.points);
    t.ok(dotsChart.length === 1520, 'all 1,520 measurements');
    P.MEASUREMENTS.forEach((m, i) => { if (i % 7 === 0 || i === 1519) { const dot = dotsChart[i]; t.ok(near32((dot.x0 + dot.x1) / 2, f2Across(m.f2)) && near32((dot.y0 + dot.y1) / 2, f1Down(m.f1)) && sameColor(dot.color, mix(paper, vowelTints[m.vowel], m.group === plan.values.speaker ? 0.75 : 0.25)) && dot.x0 > WX && dot.x1 < WX + WW && dot.y0 > WY && dot.y1 < WY + WH, 'a measurement at its F2 and F1, stronger for the speakers chosen, inside the chart'); counts.points++; } });
    const squares = quadsOf(T.averages);
    squares.forEach((square, v) => t.ok(near32((square.x0 + square.x1) / 2, f2Across(SRC.f2[plan.values.speaker][v])) && near32((square.y0 + square.y1) / 2, f1Down(SRC.f1[plan.values.speaker][v])) && sameColor(square.color, vowelTints[v]), 'Table II’s averages for the speakers chosen'));
    const ringCenters = (line, perRing) => { const points = pointsOf(line); return Array.from({length: points.length / (2 * perRing)}, (_, r) => { const ring = points.slice(2 * perRing * r, 2 * perRing * (r + 1)); return [sum(ring.map(p => p[0])) / ring.length, sum(ring.map(p => p[1])) / ring.length, Math.hypot(ring[0][0] - sum(ring.map(p => p[0])) / ring.length, ring[0][1] - sum(ring.map(p => p[1])) / ring.length)]; }); };
    ringCenters(T.patternRings, 16).forEach(([x, y, radius], v) => t.ok(Math.abs(x - f2Across(SRC.f2[plan.values.templates][v])) < 1e-5 && Math.abs(y - f1Down(SRC.f1[plan.values.templates][v])) < 1e-5 && Math.abs(radius - 0.03) < 1e-5, 'a ring at each average the patterns come from'));
    ringCenters(T.saidRings, 16).forEach(([x, y, radius], i) => { const vowel = [plan.values.first, plan.values.second][i]; t.ok(Math.abs(x - f2Across(SRC.f2[plan.values.speaker][vowel])) < 1e-5 && Math.abs(y - f1Down(SRC.f1[plan.values.speaker][vowel])) < 1e-5 && Math.abs(radius - 0.042) < 1e-5, 'large rings at the two vowels said'); });
    t.ok(T.nearestRing.visible === !item.silent, 'a red ring at the nearest pattern unless silent');
    if (!item.silent) { const [[x, y, radius]] = ringCenters(T.nearestRing, 16); t.ok(Math.abs(x - f2Across(SRC.f2[plan.values.templates][item.nearest])) < 1e-5 && Math.abs(y - f1Down(SRC.f1[plan.values.templates][item.nearest])) < 1e-5 && Math.abs(radius - 0.054) < 1e-5, 'at the nearest pattern’s average'); }

    // Every filled triangle faces the viewer.
    for (const mesh of [T.cells, T.trace, T.points, T.averages, T.melBars, T.cepsBars, T.distanceBars, T.saidMarks, T.dots, T.arrowHeads]) {
      if (!mesh.visible) continue;
      const position = mesh.geometry.attributes.position.array, index = mesh.geometry.index?.array, count = index ? Math.min(mesh.geometry.drawRange.count, index.length) : position.length / 3;
      let facing = 0;
      for (let k = 0; k < count; k += 3) {
        const [a, b, c] = (index ? [index[k], index[k + 1], index[k + 2]] : [k, k + 1, k + 2]).map(v => [position[3 * v], position[3 * v + 1]]), cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(cross) > 1e-14) { if (cross <= 0) t.ok(false, `${label}: a triangle turned away`); facing++; }
      }
      t.ok(facing > 0, 'filled triangles facing the viewer');
    }
  }
}
{
  // Each part inside its own charts, the charts apart, and the arrows in the gaps.
  model.reset();
  model.update({rate: 8, speaker: 2});
  model.advance(3);
  model.root.updateMatrixWorld(true);
  // Boxes in the system's own frame: the matrices are multiplied first, so the root's small tilt cancels exactly instead of inflating the box twice.
  const toSystem = new THREE.Matrix4().copy(T.system.matrixWorld).invert(), local = new THREE.Box3(), relative = new THREE.Matrix4();
  const boxOf = object => { const box = new THREE.Box3(); object.traverse(child => { for (let node = child; node; node = node.parent) if (!node.visible) return; if (!child.geometry || child === T.arrowShafts || child === T.arrowHeads || child.userData.setText) return; child.geometry.computeBoundingBox(); local.copy(child.geometry.boundingBox); box.union(local.applyMatrix4(relative.multiplyMatrices(toSystem, child.matrixWorld))); }); return box; };
  const panels = {voice: ['voice'], frame: ['samples', 'frame'], spectrum: ['spectrum'], features: ['filters', 'ceps'], spectrogram: ['spectrogram'], recognizer: ['distances', 'trace'], vowels: ['vowels']};
  const rects = Object.entries(M.LAYOUT);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const [a, [ax, ay, aw, ah]] = rects[i], [b, [bx, by, bw, bh]] = rects[j]; t.ok(ax + aw + 0.15 <= bx || bx + bw + 0.15 <= ax || ay + ah + 0.15 <= by || by + bh + 0.15 <= ay, `the ${a} and ${b} charts at least 0.15 apart`); }
  for (const [id, names] of Object.entries(panels)) {
    const box = boxOf(model.parts.find(item => item.id === id).object), union = names.map(name => M.LAYOUT[name]).reduce((acc, [x, y, w, h]) => [Math.min(acc[0], x), Math.min(acc[1], y), Math.max(acc[2], x + w), Math.max(acc[3], y + h)], [Infinity, Infinity, -Infinity, -Infinity]);
    t.ok(!box.isEmpty() && box.min.x >= union[0] - 1e-6 && box.max.x <= union[2] + 1e-6 && box.min.y >= union[1] - 0.026 && box.max.y <= union[3] + (id === 'spectrum' ? 0.11 : 0.051), `${id}: every visible piece inside its charts, marks and ticks at their edges`);
    // Words, the panels' names and axis ends, sit just around their panels.
    model.parts.find(item => item.id === id).object.traverse(child => {
      if (!child.userData.setText) return;
      const {x, y} = child.getWorldPosition(new THREE.Vector3()).applyMatrix4(toSystem);
      t.ok(x >= union[0] - 0.45 && x <= union[2] + 0.45 && y >= union[1] - 0.1 && y <= union[3] + 0.1, `${id}: its words beside its charts`);
    });
  }
  const shafts = pointsOf(T.arrowShafts);
  t.ok(shafts.length === 20, 'ten arrow shafts');
  {
    const plan = P.speechPlan({rate: 8, speaker: 2}), shownFrame = plan.frames[P.speechAt(plan, 0.15).shown], middle = VX + (shownFrame.start + plan.length / 2) / plan.rate / 0.6 * VW, rise = VY + VH + 0.16;
    const expected = [[[SX + SW / 2, SY - 0.02], [FX + FW / 2, FY + FH + 0.02]], [[FX + FW + 0.02, FY + FH / 2], [PX - 0.02, PY + PH / 2]], [[PX + PW / 2, PY - 0.02], [LX + LW / 2, LY + LH + 0.02]], [[CX + CW / 2, LY - 0.02], [CX + CW / 2, CY + CH + 0.02]], [[CX + CW + 0.02, CY + CH / 2], [DX - 0.02, DY + DH / 2]], [[DX + DW + 0.02, DY + DH / 2], [TX - 0.02, TY + TH / 2]], [[PX + PW + 0.02, PY + PH / 2], [GX - 0.02, GY + GH / 2]], [[middle, VY + VH + 0.01], [middle, rise]], [[middle, rise], [SX + SW / 2, rise]], [[SX + SW / 2, rise], [SX + SW / 2, SY + SH + 0.02]]];
    expected.forEach(([a, b], s) => t.ok(near32(shafts[2 * s][0], a[0]) && near32(shafts[2 * s][1], a[1]) && near32(shafts[2 * s + 1][0], b[0]) && near32(shafts[2 * s + 1][1], b[1]) && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.1, `arrow ${s + 1} from one step to the next${s >= 7 ? ': the leader from the frame’s box up, across and down to the close up' : ''}`));
    const heads = T.arrowHeads.geometry.attributes.position.array;
    expected.filter((_, s) => s < 7 || s === 9).forEach(([, b], h) => t.ok(near32(heads[9 * h], b[0]) && near32(heads[9 * h + 1], b[1]), 'an arrowhead at the end of each arrow'));
    t.ok(rise > PY + PH + 0.11, 'the leader passes above the formant marks');
  }
  for (let s = 0; s < shafts.length; s += 2) {
    const [a, b] = [shafts[s], shafts[s + 1]];
    for (let k = 1; k < 20; k++) {
      const x = a[0] + (b[0] - a[0]) * k / 20, y = a[1] + (b[1] - a[1]) * k / 20;
      if (Math.hypot(x - a[0], y - a[1]) < 0.02 || Math.hypot(x - b[0], y - b[1]) < 0.02) continue;
      t.ok(rects.every(([, [rx, ry, rw, rh]]) => !(x > rx && x < rx + rw && y > ry && y < ry + rh)), 'an arrow runs only through the gaps between charts');
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const silentCount = s => s.frames.filter(item => item.silent).length;
const heardText = s => s.heard.map(v => SRC.ipa[v]).join(' ');
checkTrialNumbers(L.speechRecognitionLesson, {
  'Listen': s => { t.ok(heardText(s) === 'ɑ i' && s.steadyCount === 46 && s.frames[52].label === 1 && s.frames[52].inside === 'second' && s.runs.find(runOf => runOf.start === 52).count < 3, 'heard [ɑ] then [i], the stray frame too short a run'); return {58: s.count, 6: silentCount(s), 45: s.steadyRight, 46: s.steadyCount}; },
  'The spectrogram': s => ({730: SRC.f1[0][4], '1,090': SRC.f2[0][4], 270: SRC.f1[0][0], '2,290': SRC.f2[0][0]}),
  'A telephone’s samples': s => { t.ok(s.steadyCount === 46 && SRC.f3[0][0] < s.nyquist, 'the third formant of [i] below 4,000 Hz'); return {200: s.length, 256: s.nfft, '31.25': s.binWidth, '4,000': s.nyquist, '3,010': SRC.f3[0][0], 46: s.steadyRight}; },
  'No window': s => ({'13.3': -leakageTyped['2:400'].sidelobe, '42.7': -leakageTyped['0:400'].sidelobe}),
  'A Hann window': s => { t.ok(s.steadyCount === 46 && s.leakage.sidelobe > -32, 'Hann’s window'); return {46: s.steadyRight}; },
  'A child’s voice': s => { t.ok(s.steadyRight === 0 && heardText(s) === 'æ ʊ', 'not one steady frame right, and [æ] then [ʊ] heard'); return {690: SRC.f1[2][2], 530: SRC.f1[0][2], 46: s.steadyCount}; },
  'Patterns that fit': s => { t.ok(s.steadyCount === 46 && heardText(s) === 'ɛ u', '[ɛ] then [u] heard'); return {46: s.steadyRight}; },
}, run, t);
const loudestNear = (s, low, high) => { const frame = s.frames.find(item => item.inside === 'first'); let best = -1; for (let k = 0; k * s.binWidth < high; k++) if (k * s.binWidth >= low && (best < 0 || frame.power[k] > frame.power[best])) best = k; return best * s.binWidth; };
checkTrialNumbers(L.phonemesLesson, {
  'Open against close': s => ({730: SRC.f1[0][4], 270: SRC.f1[0][0]}),
  'Front against back': s => ({'2,290': SRC.f2[0][0], 870: SRC.f2[0][7]}),
  'Formants in the spectrum': s => {
    const iPlan = s, uPlan = P.speechPlan({first: 7, second: 7});
    t.ok(Math.abs(loudestNear(iPlan, 0, 1000) - 270) <= 136 && Math.abs(loudestNear(iPlan, 1500, 3500) - 2290) <= 136 && Math.abs(loudestNear(uPlan, 0, 600) - 300) <= 141 && Math.abs(loudestNear(uPlan, 600, 1500) - 870) <= 141, 'the strongest harmonics near those formants, within one harmonic');
    return {270: SRC.f1[0][0], '2,290': SRC.f2[0][0], 300: SRC.f1[0][7], 870: SRC.f2[0][7]};
  },
  'A child’s vowels': s => { t.near(Math.log2(SRC.f1[2][4] / SRC.f1[0][4]), 0.5, 0.01, 'half an octave'); return {'1,030': SRC.f1[2][4], 730: SRC.f1[0][4], 256: SRC.f0[2][4], 124: SRC.f0[0][4]}; },
  '[ɝ] as in heard': s => { t.ok(Math.min(...SRC.f3[0].slice(0, 9)) === 2240 && SRC.f3[0][9] - SRC.f2[0][9] < 400, 'far below every other vowel’s third formant'); return {'1,690': SRC.f3[0][9], '1,350': SRC.f2[0][9], '2,240': Math.min(...SRC.f3[0].slice(0, 9))}; },
  'Many speakers, one vowel': s => ({'1,520': P.MEASUREMENTS.length, '1,210': ownNearest, 69: childrenByMen, 300: children.length}),
  'Close vowels': s => ({730: SRC.f1[0][4], '1,090': SRC.f2[0][4], 570: SRC.f1[0][5], 840: SRC.f2[0][5], '1,013': SRC.tableI[4][5], '10,273': sum(SRC.tableI[4])}),
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
const expectNone = (lesson, name) => { for (const [where, text] of texts(lesson)) covered(text, {}, `${name} ${where}`); };
const D = SRC.declared, K = SRC.kaldi, S = SRC.pages;
const voiceSnippets = {[`bandwidths of ${D.bandwidths[0]}, ${D.bandwidths[1]} and ${D.bandwidths[2]} Hz, nothing above the third formant, ${f0(D.silence * 1000)} ms of silence either side of two vowels of ${f0(D.vowel * 1000)} ms each joined abruptly, and the loudness scaled so the largest sample is ${Math.max(...P.speechPlan({}).samples.map(Math.abs))}`]: 'bandwidths of 80, 100 and 150 Hz, nothing above the third formant, 50 ms of silence either side of two vowels of 250 ms each joined abruptly, and the loudness scaled so the largest sample is 1'};
const recognizerSnippets = {[`more than ${D.quiet} dB quieter than the loudest, a phoneme is a run of at least ${D.run} frames`]: 'more than 30 dB quieter than the loudest, a phoneme is a run of at least 3 frames'};
covered(L.voiceLimits, voiceSnippets, 'voice limits');
covered(L.recognizerLimits, recognizerSnippets, 'recognizer limits');

// Speech recognition.
const R = L.speechRecognitionLesson, plan16 = P.speechPlan({});
expectNone(R, 'Speech recognition');
covered(R.deeper[0].body, {
  [`expects ${f0(K.rate)} samples a second`]: 'expects 16,000 samples a second', [`telephones take ${f0(S.telephone)}`]: 'telephones take 8,000',
  [`so ${f0(K.rate)} samples a second keep the voice up to ${f0(plan16.nyquist)} Hz`]: 'so 16,000 samples a second keep the voice up to 8,000 Hz',
}, 'Speech recognition deeper 1');
covered(R.deeper[1].body, {
  [`about ${S.stationary} ms`]: 'about 10 ms', [`Kaldi takes ${K.frame} ms frames every ${K.shift} ms`]: 'Kaldi takes 25 ms frames every 10 ms',
  [`Hamming’s ${K.hamming[0]} − ${K.hamming[1]} cos(2πn/(N − 1)) keeps its strongest sidelobe ${f1(-leakageTyped['0:400'].sidelobe)} dB down but stops at ${f2(K.hamming[0] - K.hamming[1])} at its ends`]: 'Hamming’s 0.54 − 0.46 cos(2πn/(N − 1)) keeps its strongest sidelobe 42.7 dB down but stops at 0.08 at its ends',
  [`Hann’s ${K.hann[0]} − ${K.hann[1]} cos(2πn/(N − 1))`]: 'Hann’s 0.5 − 0.5 cos(2πn/(N − 1))',
}, 'Speech recognition deeper 2');
covered(R.deeper[2].body, {[`Padded with zeros to ${plan16.nfft}, the ${plan16.length} samples of a frame give lines ${f2(plan16.binWidth)} Hz apart`]: 'Padded with zeros to 512, the 400 samples of a frame give lines 31.25 Hz apart'}, 'Speech recognition deeper 3');
covered(R.deeper[3].body, {
  [`above about ${S.melBend} Hz`]: 'above about 500 Hz',
  [`m = ${K.factor} ln(1 + f/${K.corner}), the same as the Mel scale page’s ${SRC.psf.factor10} log10(1 + f/${K.corner}): 440 Hz is ${f2(melK(440))} mels either way`]: 'm = 1127 ln(1 + f/700), the same as the Mel scale page’s 2595 log10(1 + f/700): 440 Hz is 549.64 mels either way',
  [`Its ${K.filters} filters are spaced evenly in mels, so the first spans ${f0(bank16[0].left)} to ${f0(bank16[0].right)} Hz and the last ${f0(bank16[22].left)} to ${f0(bank16[22].right)} Hz`]: 'Its 23 filters are spaced evenly in mels, so the first spans 20 to 186 Hz and the last 6,369 to 8,000 Hz',
}, 'Speech recognition deeper 4');
covered(R.deeper[4].body, {[`Kaldi keeps ${K.ceps}; the zeroth follows only loudness, so the model matches on the other ${K.ceps - 1}`]: 'Kaldi keeps 13; the zeroth follows only loudness, so the model matches on the other 12'}, 'Speech recognition deeper 5');
covered(R.deeper[5].body, {[`puts English’s consonant phonemes at ${S.consonants} and Received Pronunciation’s vowels at ${S.vowelsRP}, ${S.consonants + S.vowelsRP} in all, though General American has ${S.vowelsGA[0]} to ${S.vowelsGA[1]} vowels`]: 'puts English’s consonant phonemes at 24 and Received Pronunciation’s vowels at 20, 44 in all, though General American has 14 to 16 vowels'}, 'Speech recognition deeper 6');
covered(R.limits, {[`in ${D.slow} times slower than speech`]: 'in 20 times slower than speech', ...voiceSnippets, ...recognizerSnippets}, 'Speech recognition limits');
covered(R.quiz.explanation, {[`Kaldi takes ${K.frame} ms frames every ${K.shift} ms: over about ${S.stationary} ms`]: 'Kaldi takes 25 ms frames every 10 ms: over about 10 ms'}, 'Speech recognition quiz');

// Phonemes.
const Q = L.phonemesLesson;
expectNone(Q, 'Phonemes');
covered(Q.deeper[0].body, {}, 'Phonemes deeper 1');
covered(Q.deeper[1].body, {[`recorded ${SRC.study.men} men, ${SRC.study.women} women and ${SRC.study.children} children`]: 'recorded 33 men, 28 women and 15 children', [`twice: ${f0(SRC.study.recorded)} words`]: 'twice: 1,520 words', [`by up to ${f0(worst.f3)} Hz`]: 'by up to 83 Hz'}, 'Phonemes deeper 2');
covered(Q.deeper[2].body, {}, 'Phonemes deeper 3');
covered(Q.deeper[3].body, {[`[ɑ]’s ${f0(SRC.f1[2][4])} Hz against ${f0(SRC.f1[0][4])} Hz is ${f2(Math.log2(SRC.f1[2][4] / SRC.f1[0][4]))} octave`]: '[ɑ]’s 1,030 Hz against 730 Hz is 0.50 octave'}, 'Phonemes deeper 4');
covered(Q.deeper[4].body, {[`to ${SRC.study.listeners} listeners`]: 'to 70 listeners', [`Of their ${f0(judged)} judgments ${f1(100 * right / judged)}% named`]: 'Of their 102,780 judgments 94.4% named', [`[ɑ] heard as [ɔ], ${f0(SRC.tableI[4][5])} times, and [ɛ] heard as [æ], ${f0(SRC.tableI[2][3])} times`]: '[ɑ] heard as [ɔ], 1,013 times, and [ɛ] heard as [æ], 949 times'}, 'Phonemes deeper 5');
covered(Q.deeper[5].body, {[`counts ${S.consonants} consonant phonemes and ${S.vowelsRP} vowels in Received Pronunciation, ${S.consonants + S.vowelsRP} in all, though General American has ${S.vowelsGA[0]} to ${S.vowelsGA[1]} vowels`]: 'counts 24 consonant phonemes and 20 vowels in Received Pronunciation, 44 in all, though General American has 14 to 16 vowels'}, 'Phonemes deeper 6');
covered(Q.limits, voiceSnippets, 'Phonemes limits');
covered(Q.quiz.explanation, {[`at ${f0(SRC.f1[0][0])} and ${f0(SRC.f2[0][0])} Hz for men and at ${f0(SRC.f1[2][0])} and ${f0(SRC.f2[2][0])} Hz for children`]: 'at 270 and 2,290 Hz for men and at 370 and 3,200 Hz for children'}, 'Phonemes quiz');
t.ok(Q.misconception.includes('about an octave above a man') && Math.abs(Math.log2(SRC.f0[2][4] / SRC.f0[0][4]) - 1) < 0.1, 'a child’s [ɑ] about an octave above a man’s');
t.ok(SRC.f1[2][0] > SRC.f1[0][0] && SRC.f2[2][0] > SRC.f2[0][0] && SRC.f1[2][0] < 500 && SRC.f2[2][0] > 2500 && SRC.f1[0][0] < 500 && SRC.f2[0][0] > 2000, 'for [i] both a low first formant and a high second, a child’s higher');

// The model's own words.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {[`${D.slow} times slower than speech`]: '20 times slower than speech'}, 'system text');
covered(partText('voice'), {[`${f1(0.6)} s across`]: '0.6 s across', [`${K.frame} ms long; a new frame starts every ${K.shift} ms`]: '25 ms long; a new frame starts every 10 ms'}, 'voice text');
covered(partText('frame'), {[`Above: ${f0(M.CHART.closeup * 1000)} ms`]: 'Above: 5 ms', [`the whole ${K.frame} ms frame`]: 'the whole 25 ms frame'}, 'frame text');
covered(partText('spectrum'), {[`from 0 Hz at the left to ${f0(M.MAX_HZ)} Hz at the right, and ${-D.bottom} dB from bottom to top`]: 'from 0 Hz at the left to 8,000 Hz at the right, and 80 dB from bottom to top'}, 'spectrum text');
covered(partText('features'), {[`The ${K.filters} mel filters against the same 0 to ${f0(M.MAX_HZ)} Hz`]: 'The 23 mel filters against the same 0 to 8,000 Hz', [`on a scale of ${-D.bottom} dB`]: 'on a scale of 80 dB'}, 'features text');
covered(partText('spectrogram'), {[`frequency from 0 Hz at the bottom to ${f0(M.MAX_HZ)} Hz at the top`]: 'frequency from 0 Hz at the bottom to 8,000 Hz at the top', [`from white at ${M.CHART.gramRange} dB below the loudest line`]: 'from white at 60 dB below the loudest line'}, 'spectrogram text');
covered(partText('recognizer'), {[`at least ${D.run} frames in a row`]: 'at least 3 frames in a row'}, 'recognizer text');
covered(partText('vowels'), {[`from ${f0(M.CHART.f2[0])} Hz at the left to ${f0(M.CHART.f2[1])} Hz at the right, and F1 down, from ${f0(M.CHART.f1[0])} Hz at the top to ${f0(M.CHART.f1[1])} Hz at the bottom`]: 'from 4,000 Hz at the left to 400 Hz at the right, and F1 down, from 100 Hz at the top to 1,400 Hz at the bottom', [`all ${f0(P.MEASUREMENTS.length)} vowels`]: 'all 1,520 vowels'}, 'vowels text');
{
  model.reset();
  const readings = model.getState().readings, find = labelOf => readings.find(item => item.label === labelOf);
  t.ok(readings.map(item => item.label).join() === 'Your result,Samples,Voice,Frame,Window,Spectrum,Mel filters,Features,Nearest pattern,Slowed' && readings.filter(item => item.hint).length === 9, 'ten readings, nine explained');
  const preview = plan16.frames[plan16.preview];
  t.ok(find('Your result').value === 'Ready · [ɑ] as in hod, then [i] as in heed, as a man says them; press Play to listen' && find('Samples').value === '16,000 a second' && find('Voice').value === '[ɑ] at 124 Hz' && find('Frame').value === `${plan16.preview + 1} of 58` && find('Window').value === 'Hamming' && find('Spectrum').value === `strongest at ${f0(preview.peakHz)} Hz` && find('Slowed').value === '20 times', 'the readings before Play');
  checkQuotedText(find('Samples').hint, {'Each 25 ms frame holds 400 samples, padded with zeros to 512': `Each ${K.frame} ms frame holds ${plan16.length} samples, padded with zeros to ${plan16.nfft}`, 'a line every 31.25 Hz up to 8,000 Hz': `a line every ${f2(plan16.binWidth)} Hz up to ${f0(plan16.nyquist)} Hz`, '58 frames in 0.6 s': `${plan16.count} frames in ${f1(plan16.duration)} s`}, t);
  checkQuotedText(find('Voice').hint, {'a pitch of 124 Hz and formants of 730, 1,090 and 2,440 Hz': `a pitch of ${SRC.f0[0][4]} Hz and formants of ${f0(SRC.f1[0][4])}, ${f0(SRC.f2[0][4])} and ${f0(SRC.f3[0][4])} Hz`, 'Its 64 harmonics below 8,000 Hz': `Its ${Math.ceil(8000 / 124) - 1} harmonics below ${f0(8000)} Hz`, '80, 100 and 150 Hz wide': `${D.bandwidths[0]}, ${D.bandwidths[1]} and ${D.bandwidths[2]} Hz wide`}, t);
  checkQuotedText(find('Window').hint, {'0.54 − 0.46 cos(2πn/399) tapers the frame to 0.08 at its ends': `${K.hamming[0]} − ${K.hamming[1]} cos(2πn/${plan16.length - 1}) tapers the frame to ${f2(K.hamming[0] - K.hamming[1])} at its ends`, 'Its strongest sidelobe is −42.7 dB': `Its strongest sidelobe is −${f1(-leakageTyped['0:400'].sidelobe)} dB`, [`reaches ${f0(leakageTyped['0:400'].firstNull)} Hz either side`]: `reaches ${f0(P.leakageOf(0, 400, 16000).firstNull)} Hz either side`}, t);
  checkQuotedText(find('Mel filters').hint, {'m = 1127 ln(1 + f/700), from 20 Hz to 8,000 Hz: the first spans 20 to 186 Hz and the last 6,369 to 8,000 Hz': `m = ${K.factor} ln(1 + f/${K.corner}), from ${K.low} Hz to ${f0(8000)} Hz: the first spans ${f0(bank16[0].left)} to ${f0(bank16[0].right)} Hz and the last ${f0(bank16[22].left)} to ${f0(bank16[22].right)} Hz`}, t);
  checkQuotedText(find('Slowed').hint, {'the 0.6 s utterance takes 12 s, a new frame every 0.2 s': `the ${f1(0.6)} s utterance takes ${f0(0.6 * D.slow)} s, a new frame every ${f1(K.shift / 1000 * D.slow)} s`}, t);
  const order = Array.from(preview.distances.keys()).sort((a, b) => preview.distances[a] - preview.distances[b]);
  checkQuotedText(find('Nearest pattern').hint, {[`Nearest [${SRC.ipa[order[0]]}] at ${f2(preview.distances[order[0]])}, then [${SRC.ipa[order[1]]}] at ${f2(preview.distances[order[1]])}`]: `Nearest [${SRC.ipa[order[0]]}] at ${f2(preview.distances[order[0]])}, then [${SRC.ipa[order[1]]}] at ${f2(preview.distances[order[1]])}`}, t);
  model.advance(1e4);
  const done = model.getState().readings;
  t.ok(done[0].value === 'Heard [ɑ] then [i], as said: 45 of the 46 frames inside a vowel matched it' && done.find(item => item.label === 'Frame').value === `${plan16.lastVoiced + 1} of 58` && done.find(item => item.label === 'Frame').hint.endsWith('Once the utterance has ended the charts hold the last frame with voice in it.') && done.find(item => item.label === 'Nearest pattern').value.startsWith('[i] at '), 'the readings when done hold the last frame with voice in it');
  model.reset();
  model.update({speaker: 2, first: 2, second: 7});
  model.advance(1e4);
  t.ok(model.getState().readings[0].value === 'Heard [æ] then [ʊ] for [ɛ] then [u]: 0 of the 46 frames inside a vowel matched it', 'a wrong hearing said as such');
  model.reset();
  model.update({rate: 8, window: 2});
  const eight = model.getState().readings;
  t.ok(eight.find(item => item.label === 'Samples').hint.startsWith('Each 25 ms frame holds 200 samples, padded with zeros to 256') && eight.find(item => item.label === 'Window').hint.startsWith('The frame is cut off square, with no taper. Its strongest sidelobe is −13.3 dB'), 'the readings at 8 kHz with no window');
}
for (const lesson of [L.speechRecognitionLesson, L.phonemesLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3 && lesson.steps.length === 5 && [6, 7].includes(lesson.tryIt.length) && [5, 6].includes(lesson.deeper.length), `${lesson.simple}: five steps, six or seven trials, five or six deeper sections, a quiz with its answer first`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(trialOf => model.parts.some(item => item.id === trialOf.part) && trialOf.view === 'front' && trialOf.reset === true && trialOf.isolate === false && Object.keys(trialOf.values).every(key => key in P.SPEECH_DEFAULTS)), 'every trial on a part the model has, from the defaults');
}
assert.deepEqual(L.speechRecognitionLesson.tryIt.map(trialOf => trialOf.part), ['recognizer', 'spectrogram', 'spectrum', 'spectrum', 'features', 'recognizer', 'recognizer'], 'each machine trial on the part it talks about');
assert.deepEqual(L.phonemesLesson.tryIt.map(trialOf => trialOf.part), ['vowels', 'vowels', 'spectrum', 'vowels', 'spectrogram', 'vowels', 'spectrogram'], 'each phonemes trial on the part it talks about');
t.add(2);
t.ok(L.speechRecognitionLesson.parts.length >= 6 && L.speechRecognitionLesson.parts.every(item => model.parts.some(partOf => partOf.name === item.name)) && L.phonemesLesson.parts.every(item => model.parts.some(partOf => partOf.name === item.name)), 'the lessons’ parts are the model’s');

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [lo, hi, step] = P.SPEECH_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.SPEECH_DEFAULTS[control.key] && control.options.every(option => option.value >= lo && option.value <= hi), `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'first,second,speaker,templates,rate,window', 'six controls');
const checksum = array => { let total = 0; for (let i = 0; i < array.length; i++) total += array[i] * ((i % 97) + 1); return Number(total.toFixed(5)); };
const drawing = () => [checksum(T.cells.geometry.attributes.color.array), checksum(T.cells.geometry.attributes.position.array), checksum(T.spectrumLine.geometry.attributes.position.array), checksum(T.windowLine.geometry.attributes.position.array), checksum(T.waveFaint.geometry.attributes.position.array), checksum(T.trace.geometry.attributes.color.array), checksum(T.points.geometry.attributes.color.array), checksum(T.patternRings.geometry.attributes.position.array), checksum(T.distanceBars.geometry.attributes.position.array), checksum(T.saidRings.geometry.attributes.position.array)];
checkControlsMove(model, drawing, () => {}, t);
checkControlsMove(model, drawing, m => m.advance(1e4), t);
checkRefusals(P.sampleSpeech, P.SPEECH_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before listening');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.01, 1e-12, 'a step brings in 10 ms, one frame shift');
  t.ok(JSON.stringify(model.getState().readings) !== before && !model.playback.complete() && !model.resultPart.available(), 'a step changes the readings, with no result yet');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, 0.035, 1e-12, 'animation brings the voice in by the time passed, 20 times slower');
  model.advance(0.4 * SRC.declared.slow);
  t.near(model.getState().clock, 0.435, 1e-12, 'advancing brings in more of the voice');
  t.ok(!model.playback.complete() && !model.resultPart.available() && model.getState().now.heardFrames > model.getState().count / 2, 'no result while frames are still arriving, even past halfway');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available() && !model.playback.blocked(), 'listened through, with a result to inspect');
  checkFinite(model.root, t);
  const expectations = [plan16.frames[plan16.preview].end / 16000, plan16.frames.find(item => item.inside === 'join').end / 16000, 0.6, 0.6];
  model.actions.forEach((action, i) => { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length === 10 && model.parts.some(item => item.id === action.part) && action.view === 'front' && action.replay === false, `${action.label} returns readings on a part`); t.near(model.getState().clock, expectations[i], 1e-12, `${action.label} sets the clock`); checkFinite(model.root, t); });
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system') && model.parts.length === 8, 'eight parts under the system, each described');
  t.ok(model.initialPart === 'system' && model.frameVisibleOnly === true && model.framePadding > 0 && model.playback.label === 'Listen' && typeof model.playback.stepLabel === 'string' && model.resultPart.id === 'recognizer', 'the viewer’s settings');
  const allText = [];
  for (const values of [...settings, ...poses]) for (const time of [0, 0.3, 100]) {
    model.reset(); model.update(values); model.advance(time);
    const readings = model.getState().readings;
    t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
    allText.push(...readings.flatMap(item => [item.label, item.value, item.hint || '']));
    checkFinite(model.root, t);
  }
  for (const lesson of [L.speechRecognitionLesson, L.phonemesLesson]) allText.push(lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title));
  allText.push(...model.parts.flatMap(item => [item.name, item.description]), ...model.controls.flatMap(control => [control.label, control.help, control.unit, ...control.options.map(option => option.label)]), model.playback.label, model.playback.description, model.playback.stepLabel, model.resultPart.label, ...model.actions.map(action => action.label));
  for (const text of allText) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of allText) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|analysed|recognise|recognised|favour|fibre|programme)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
}
t.ok(studyLessons['Speech recognition'] === L.speechRecognitionLesson, 'the speech recognition lesson is routed');
{
  const component = houseComponents.Phonemes;
  t.ok(component.machine === 'Speech recognition' && component.part === 'vowels' && component.lesson === L.phonemesLesson && component.intro === L.phonemesLesson.simple && component.view === 'front' && component.isolate === false && component.values === undefined, 'Phonemes routes to the vowel chart with its own lesson');
}
const released = checkDisposal((() => { const fresh = M.createSpeechModel(); fresh.advance(3); return fresh; })(), t);
model.dispose();

console.log(`PASS speech recognition: ${t.count} checks, ${counts.frames} frames transformed again, ${counts.lines} spectrum lines found again, ${counts.steps} steps of the voice integrated, ${counts.measurements} measurements read, ${counts.poses} poses, ${counts.points} points read back, ${counts.shownColumns} lines of shown columns matched to the drawn spectrum, ${counts.numbers} quoted numbers traced, 2 lessons, ${released} resources released exactly once.`);

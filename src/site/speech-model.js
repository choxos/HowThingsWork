import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines} from './scene-kit.js';
import {speechPlan, speechAt, VOWELS, GROUPS, TABLE_II, KALDI, DECLARED, PAGES, MEASUREMENTS, VOWEL_OPTIONS, SPEAKER_OPTIONS, TEMPLATE_OPTIONS, RATE_OPTIONS, WINDOW_OPTIONS, SPEECH_DEFAULTS, SPEECH_DOMAINS, formantsOf} from './speech-physics.js';

// ---------------------------------------------------------------------------
// Speech recognition, as a row of charts: the voice as its samples, a frame
// of them close up and windowed, the frame's spectrum, the mel filters and the
// cepstral coefficients made from it, the spectrogram of every frame, the
// distances to the stored patterns frame by frame, and Peterson and Barney's
// vowel chart.
//
// Scale: signals have no size, so every chart is not to scale, and each part's
// text says what its axes cover: the voice and the spectrogram run 0.6 s
// across; the close up 5 ms and the frame 25 ms; the spectrum, the filters
// and the spectrogram 0 to 8,000 Hz at both sample rates, the spectrum 80 dB
// top to bottom and the spectrogram's gray from 60 dB below the loudest line;
// the vowel chart F2 from 4,000 Hz to 400 Hz across and F1 from
// 100 Hz to 1,400 Hz down.
//
// Time: the recognizer takes in the voice 20 times slower than speech, said in
// the part text and a reading.
// ---------------------------------------------------------------------------

/** The frequency axes run to half the wideband rate at both sample rates. */
export const MAX_HZ = PAGES.wideband / 2;

/** Each chart's lower left corner, width and height, scene units. */
export const LAYOUT = Object.freeze({
  samples: Object.freeze([-3.0, 0.62, 1.9, 0.72]),
  frame: Object.freeze([-3.0, -0.38, 1.9, 0.82]),
  vowels: Object.freeze([-3.0, -1.42, 1.9, 0.86]),
  spectrum: Object.freeze([-0.9, 0.62, 1.9, 0.72]),
  filters: Object.freeze([-0.9, -0.38, 1.9, 0.82]),
  ceps: Object.freeze([-0.9, -1.42, 0.86, 0.86]),
  distances: Object.freeze([0.14, -1.42, 0.86, 0.86]),
  voice: Object.freeze([1.2, 0.62, 1.9, 0.72]),
  spectrogram: Object.freeze([1.2, -0.38, 1.9, 0.82]),
  trace: Object.freeze([1.2, -1.42, 1.9, 0.86]),
});

/** Drawing sizes: the share of half a chart a full scale sample fills, the close up's span in s, tick, dot, marker and ring sizes, the coefficient and distance full scales, the vowel chart's axes in Hz, the arrowheads, the formant marks' half width, the spectrogram's range in dB, and how far above the charts the leader runs. */
export const CHART = Object.freeze({amp: 0.45, closeup: 0.005, tick: 0.05, dot: 0.006, point: 0.006, average: 0.016, ring: 0.03, said: 0.042, nearest: 0.054, cepsScale: 20, distanceScale: 20, f2: Object.freeze([4000, 400]), f1: Object.freeze([100, 1400]), head: 0.03, mark: 0.007, gramRange: 60, leader: 0.16, units: 14});

export const COLORS = Object.freeze({paper: 0xfbfaf5, edge: 0x374736, faint: 0xc9cdbf, guide: 0x9aa39a, ink: 0x1f2a44, wave: 0x2b5d9c, window: 0xd99a2b, cursor: 0xc14f39, band: 0xe4e0d4, bar: 0xd99a2b, silence: 0xa8aba2, arrow: 0x9aa39a,
  vowels: Object.freeze([0x2b5d9c, 0x5fa8d3, 0x2e8b57, 0x9bbf3a, 0xc14f39, 0xe0892b, 0x7b4fa0, 0xc27bc0, 0xc9a227, 0x7a5230])});

const [SX, SY, SW, SH] = LAYOUT.samples, [FX, FY, FW, FH] = LAYOUT.frame, [PX, PY, PW, PH] = LAYOUT.spectrum, [LX, LY, LW, LH] = LAYOUT.filters;
const [CX, CY, CW, CH] = LAYOUT.ceps, [DX, DY, DW, DH] = LAYOUT.distances, [VX, VY, VW, VH] = LAYOUT.voice, [GX, GY, GW, GH] = LAYOUT.spectrogram, [TX, TY, TW, TH] = LAYOUT.trace, [WX, WY, WW, WH] = LAYOUT.vowels;

/** Where a sample value falls in a chart whose zero line is its middle. */
export const waveY = (box, value) => box[1] + box[3] / 2 + value * CHART.amp * box[3];
/** Where a time, s, falls across the voice and the spectrogram and the trace, which share it. */
export const timeX = (plan, seconds, box = LAYOUT.voice) => box[0] + seconds / plan.duration * box[2];
/** Where a frequency, Hz, falls across the spectrum and the filters, and up the spectrogram. */
export const hzX = (hz, box = LAYOUT.spectrum) => box[0] + hz / MAX_HZ * box[2];
export const hzY = hz => GY + hz / MAX_HZ * GH;
/** Where a level, dB, falls up the spectrum. */
export const dbY = db => PY + (Math.max(DECLARED.bottom, db) - DECLARED.bottom) / -DECLARED.bottom * PH;
/** Where F2 and F1 fall on the vowel chart. */
export const f2X = f2 => WX + (CHART.f2[0] - f2) / (CHART.f2[0] - CHART.f2[1]) * WW;
export const f1Y = f1 => WY + WH - (f1 - CHART.f1[0]) / (CHART.f1[1] - CHART.f1[0]) * WH;
/** A trace row's bottom and top: the said strip, the rows from [i] (0) to silence (10), and the heard strip. */
export const traceRow = row => {
  const unit = TH / CHART.units, top = TY + TH;
  if (row === 'said') return [top - unit, top];
  if (row === 'heard') return [TY, TY + unit];
  return [top - 1.5 * unit - (row + 1) * unit, top - 1.5 * unit - row * unit];
};
/** A frame's column across the spectrogram and the trace: its center, half a shift either side. */
export const columnX = (plan, frame) => { const center = (frame * plan.shift + plan.length / 2) / plan.rate, half = plan.shift / 2 / plan.rate; return [timeX(plan, center - half, LAYOUT.spectrogram), timeX(plan, center + half, LAYOUT.spectrogram)]; };
/** A number with a true minus sign. */
export const signed = (value, digits) => { const text = fixed(Math.abs(value), digits); return value < 0 && text !== fixed(0, digits) ? `−${text}` : text; };
/** The spectrogram's gray for a level, 0 at the floor and 1 at the loudest line. */
export const shareOf = db => (Math.max(DECLARED.bottom, db) - DECLARED.bottom) / -DECLARED.bottom;
/** The spectrogram's gray for a level: white at its range below the loudest line, darkest at it, graded evenly as seen. */
export const gramShare = db => Math.max(0, Math.min(1, (db + CHART.gramRange) / CHART.gramRange));
/** How dark a trace cell is for a distance: 1 for a perfect match, 0 at the full scale or beyond. */
export const closeness = distance => Math.max(0, Math.min(1, 1 - distance / CHART.distanceScale));
/** How much of the color an unheard column keeps. */
export const UNHEARD = 0.4;

const ipa = vowel => `[${VOWELS[vowel].ipa}]`;
const listOf = items => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

export function createSpeechModel() {
  const kit = houseModel('Speech recognition'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, drawnPlan = null, coloredHeard = -1;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const paperS = [COLORS.paper >> 16 & 255, COLORS.paper >> 8 & 255, COLORS.paper & 255].map(value => value / 255), inkS = [COLORS.ink >> 16 & 255, COLORS.ink >> 8 & 255, COLORS.ink & 255].map(value => value / 255);
  const grayOf = (color, share) => color.setRGB(...paperS.map((p, i) => p + (inkS[i] - p) * share), THREE.SRGBColorSpace);
  const paper = new THREE.Color(COLORS.paper), faint = new THREE.Color(COLORS.guide), silenceColor = new THREE.Color(COLORS.silence), vowelColors = COLORS.vowels.map(hex => new THREE.Color(hex));
  const panel = (box, parent) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(COLORS.paper));
    mesh.position.set(box[0] + box[2] / 2, box[1] + box[3] / 2, -0.004);
    mesh.scale.set(box[2], box[3], 1);
    parent.add(mesh);
    const edge = lineObject(5, COLORS.edge, parent);
    fillLine(edge, [[box[0], box[1], 0.004], [box[0] + box[2], box[1], 0.004], [box[0] + box[2], box[1] + box[3], 0.004], [box[0], box[1] + box[3], 0.004], [box[0], box[1], 0.004]]);
    return {mesh, edge};
  };
  function quads(count, parent, {color = 0xffffff, vertexColors = false, z = 0} = {}) {
    const geometry = new THREE.BufferGeometry(), index = [];
    for (let i = 0; i < count; i++) { const a = 4 * i; index.push(a, a + 1, a + 2, a, a + 2, a + 3); }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
    if (vertexColors) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, unlit(color, vertexColors ? {vertexColors: true} : {}));
    mesh.frustumCulled = false;
    mesh.userData.z = z;
    parent.add(mesh);
    return mesh;
  }
  const setQuad = (mesh, i, x0, y0, x1, y1) => { const z = mesh.userData.z; mesh.geometry.attributes.position.array.set([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z], 12 * i); };
  const colorQuad = (mesh, i, color) => { const array = mesh.geometry.attributes.color.array; for (let v = 0; v < 4; v++) array.set([color.r, color.g, color.b], 12 * i + 3 * v); };
  const touched = (mesh, count) => { mesh.geometry.attributes.position.needsUpdate = true; if (mesh.geometry.attributes.color) mesh.geometry.attributes.color.needsUpdate = true; mesh.geometry.setDrawRange(0, 6 * count); mesh.visible = count > 0; mesh.geometry.boundingBox = null; mesh.geometry.boundingSphere = null; };
  const ring = (cx, cy, radius, count = 16) => Array.from({length: count}, (_, i) => { const a0 = 2 * Math.PI * i / count, a1 = 2 * Math.PI * (i + 1) / count; return [[cx + radius * Math.cos(a0), cy + radius * Math.sin(a0), 0.003], [cx + radius * Math.cos(a1), cy + radius * Math.sin(a1), 0.003]]; }).flat();

  const system = part('system', 'Speech recognition, step by step', `Two vowels built from Peterson and Barney’s measurements of real speakers, taken apart the way a recognizer takes a voice apart: sampled, cut into overlapping frames, windowed, turned into a spectrum, summed through mel filters into cepstral coefficients, and matched against stored patterns. Press Play to listen: the recognizer takes the voice in ${DECLARED.slow} times slower than speech. The charts are not to scale.`);

  // The voice, as its samples over the whole utterance.
  const voice = part('voice', 'The voice, sampled', `The voice as its samples, ${fixed(2 * DECLARED.silence + 2 * DECLARED.vowel, 1)} s across: silence, the first vowel, the second vowel, silence. The box marks the frame being analyzed, ${KALDI.frame} ms long; a new frame starts every ${KALDI.shift} ms, so frames overlap. Dark as far as the clock has run.`, [0, 0, 0], system);
  const voicePanel = panel(LAYOUT.voice, voice);
  const zero = segmentLines(1, COLORS.faint, voice);
  fillLine(zero, [[VX, waveY(LAYOUT.voice, 0), 0], [VX + VW, waveY(LAYOUT.voice, 0), 0]]);
  const bounds = segmentLines(3, COLORS.guide, voice), timeTicks = segmentLines(5, COLORS.edge, voice);
  const waveFaint = lineObject(Math.round(PAGES.wideband * (2 * DECLARED.silence + 2 * DECLARED.vowel)), COLORS.faint, voice);
  const waveDark = lineObject(Math.round(PAGES.wideband * (2 * DECLARED.silence + 2 * DECLARED.vowel)), COLORS.wave, voice);
  const bracket = lineObject(5, COLORS.cursor, voice);

  // One frame: samples close up, then the whole frame windowed.
  const frame = part('frame', 'One frame, windowed', `Above: ${fixed(CHART.closeup * 1000, 0)} ms from the middle of the frame, each dot one sample. Below: the whole ${KALDI.frame} ms frame (faint), the window it is multiplied by (gold) and the product (dark), which is what the transform takes. The small box marks the close up.`, [0, 0, 0], system);
  const samplesPanel = panel(LAYOUT.samples, frame), framePanel = panel(LAYOUT.frame, frame);
  const closeZero = segmentLines(1, COLORS.faint, frame), frameZero = segmentLines(1, COLORS.faint, frame);
  fillLine(closeZero, [[SX, waveY(LAYOUT.samples, 0), 0], [SX + SW, waveY(LAYOUT.samples, 0), 0]]);
  fillLine(frameZero, [[FX, waveY(LAYOUT.frame, 0), 0], [FX + FW, waveY(LAYOUT.frame, 0), 0]]);
  const stemRoom = Math.round(PAGES.wideband * CHART.closeup), stems = segmentLines(stemRoom, COLORS.wave, frame);
  const dots = quads(stemRoom, frame, {color: COLORS.ink, z: 0.001});
  const frameRoom = Math.round(PAGES.wideband * KALDI.frame / 1000);
  const rawLine = lineObject(frameRoom, COLORS.faint, frame), windowLine = lineObject(frameRoom, COLORS.window, frame), windowedLine = lineObject(frameRoom, COLORS.ink, frame), closeBox = lineObject(5, COLORS.cursor, frame);

  // The frame's spectrum.
  const spectrum = part('spectrum', 'Its spectrum', `The frame’s spectrum: its power at each frequency, from 0 Hz at the left to ${fixed(MAX_HZ, 0)} Hz at the right, and ${-DECLARED.bottom} dB from bottom to top below the loudest line in the whole utterance. The peaks are the voice’s harmonics, loudest near its formants, which the marks above show in the vowel’s color. Gray past half the sample rate, where nothing was sampled.`, [0, 0, 0], system);
  const spectrumPanel = panel(LAYOUT.spectrum, spectrum);
  const spectrumGrid = segmentLines(3 + 7, COLORS.faint, spectrum);
  fillLine(spectrumGrid, [...[20, 40, 60].map(down => [[PX, dbY(-down), -0.002], [PX + PW, dbY(-down), -0.002]]), ...Array.from({length: 7}, (_, i) => [[hzX(1000 * (i + 1)), PY, -0.002], [hzX(1000 * (i + 1)), PY - CHART.tick / 2, -0.002]])].flat());
  const unsampled = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(COLORS.band));
  spectrum.add(unsampled);
  const spectrumLine = lineObject(PAGES.wideband / 50 + 1, COLORS.ink, spectrum);
  const formantMarks = quads(6, spectrum, {vertexColors: true, z: 0.002});

  // The mel filters and the cepstral coefficients.
  const features = part('features', 'Mel filters and features', `The ${KALDI.filters} mel filters against the same 0 to ${fixed(MAX_HZ, 0)} Hz as the spectrum: narrow at low frequencies and wide at high ones, as the mel scale spaces them. The bars below them show how much of the frame’s power each filter catches, on a scale of ${-DECLARED.bottom} dB. Under them: the cepstral coefficients the cosine transform makes of the filters’ logarithms, from the first at the left to the twelfth, with a tick at the nearest pattern’s value of each.`, [0, 0, 0], system);
  const filtersPanel = panel(LAYOUT.filters, features), cepsPanel = panel(LAYOUT.ceps, features);
  const triangles = segmentLines(2 * KALDI.filters, COLORS.guide, features);
  const melBars = quads(KALDI.filters, features, {color: COLORS.bar});
  const cepsZero = segmentLines(1, COLORS.faint, features);
  fillLine(cepsZero, [[CX, waveY(LAYOUT.ceps, 0), 0], [CX + CW, waveY(LAYOUT.ceps, 0), 0]]);
  const cepsBars = quads(KALDI.ceps - 1, features, {color: COLORS.wave}), cepsTicks = segmentLines(KALDI.ceps - 1, COLORS.cursor, features);

  // The spectrogram.
  const spectrogram = part('spectrogram', 'Spectrogram', `Every frame’s spectrum side by side: time from left to right over the whole utterance, frequency from 0 Hz at the bottom to ${fixed(MAX_HZ, 0)} Hz at the top, darker where louder, from white at ${CHART.gramRange} dB below the loudest line, so the formants show as dark bands. Each column is faint until the clock has brought in all of its frame. Gray above half the sample rate.`, [0, 0, 0], system);
  const gramPanel = panel(LAYOUT.spectrogram, spectrogram);
  const gramRoom = Math.max(...[8, 16].map(rate => { const total = rate * 1000 * (2 * DECLARED.silence + 2 * DECLARED.vowel), length = rate * KALDI.frame, shift = rate * KALDI.shift; let nfft = 1; while (nfft < length) nfft *= 2; return (1 + Math.floor((total - length) / shift)) * (nfft / 2 + 1); }));
  const cells = quads(gramRoom, spectrogram, {vertexColors: true});
  const gramUnsampled = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(COLORS.band));
  spectrogram.add(gramUnsampled);
  const gramCursor = segmentLines(1, COLORS.cursor, spectrogram);

  // The recognizer.
  const recognizer = part('recognizer', 'Matching the patterns', `Left: the frame’s distance to each vowel’s stored pattern, one bar a vowel in the chart’s colors from [${VOWELS[0].ipa}] to [${VOWELS[9].ipa}], the nearest outlined and the vowels being said marked beneath. Right: every frame at once, time as in the spectrogram, one row a vowel from [${VOWELS[0].ipa}] at the top to [${VOWELS[9].ipa}] and silence at the bottom, darker the nearer, the nearest in its vowel’s color. The strip above shows the vowel being said and the strip below the phonemes heard: a vowel matched by at least ${DECLARED.run} frames in a row.`, [0, 0, 0], system);
  const distancesPanel = panel(LAYOUT.distances, recognizer), tracePanel = panel(LAYOUT.trace, recognizer);
  const distanceBars = quads(VOWELS.length, recognizer, {vertexColors: true}), winnerBox = lineObject(5, COLORS.ink, recognizer), saidMarks = quads(2, recognizer, {color: COLORS.ink});
  const trace = quads(Math.max(...[8, 16].map(rate => 1 + Math.floor((rate * 1000 * (2 * DECLARED.silence + 2 * DECLARED.vowel) - rate * KALDI.frame) / (rate * KALDI.shift)))) * (VOWELS.length + 3), recognizer, {vertexColors: true});
  const traceCursor = segmentLines(1, COLORS.cursor, recognizer);

  // The vowel chart.
  const vowels = part('vowels', 'Vowel chart', `Peterson and Barney’s vowels by their first two formants: F2 across, from ${fixed(CHART.f2[0], 0)} Hz at the left to ${fixed(CHART.f2[1], 0)} Hz at the right, and F1 down, from ${fixed(CHART.f1[0], 0)} Hz at the top to ${fixed(CHART.f1[1], 0)} Hz at the bottom, so close front vowels sit at the top left. Small dots: all ${fixed(MEASUREMENTS.length, 0)} vowels they measured, stronger for the speakers chosen. Squares: Table II’s averages for those speakers. Small rings: the averages the stored patterns come from. Large rings: the two vowels said, and in red the pattern the frame is nearest.`, [0, 0, 0], system);
  const vowelsPanel = panel(LAYOUT.vowels, vowels);
  const points = quads(MEASUREMENTS.length, vowels, {vertexColors: true, z: 0.001});
  MEASUREMENTS.forEach((m, i) => setQuad(points, i, f2X(m.f2) - CHART.point, f1Y(m.f1) - CHART.point, f2X(m.f2) + CHART.point, f1Y(m.f1) + CHART.point));
  const averages = quads(VOWELS.length, vowels, {vertexColors: true, z: 0.002});
  const patternRings = segmentLines(VOWELS.length * 16, COLORS.edge, vowels), saidRings = segmentLines(2 * 16, COLORS.ink, vowels), nearestRing = segmentLines(16, COLORS.cursor, vowels);

  // Arrows from each step to the next, kept in the gaps between the charts.
  const arrowShafts = segmentLines(10, COLORS.arrow, system), arrowHeads = new THREE.Mesh(new THREE.BufferGeometry(), unlit(COLORS.arrow));
  arrowHeads.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 9), 3));
  arrowHeads.frustumCulled = false;
  system.add(arrowHeads);
  const arrowPaths = [
    [[SX + SW / 2, SY - 0.02], [FX + FW / 2, FY + FH + 0.02]],
    [[FX + FW + 0.02, FY + FH / 2], [PX - 0.02, PY + PH / 2]],
    [[PX + PW / 2, PY - 0.02], [LX + LW / 2, LY + LH + 0.02]],
    [[CX + CW / 2, LY - 0.02], [CX + CW / 2, CY + CH + 0.02]],
    [[CX + CW + 0.02, CY + CH / 2], [DX - 0.02, DY + DH / 2]],
    [[DX + DW + 0.02, DY + DH / 2], [TX - 0.02, TY + TH / 2]],
    [[PX + PW + 0.02, PY + PH / 2], [GX - 0.02, GY + GH / 2]],
  ];

  const d = SPEECH_DEFAULTS, domain = key => SPEECH_DOMAINS[key];
  control('first', 'First vowel', ...domain('first'), d.first, '', 'The vowel said first, named by the word Peterson and Barney’s speakers read it in.', VOWEL_OPTIONS);
  control('second', 'Second vowel', ...domain('second'), d.second, '', 'The vowel said straight after it.', VOWEL_OPTIONS);
  control('speaker', 'Speaker', ...domain('speaker'), d.speaker, '', 'Whose average pitch and formants from Table II build the voice.', SPEAKER_OPTIONS);
  control('templates', 'Stored patterns', ...domain('templates'), d.templates, '', 'Whose averages the recognizer’s stored vowel patterns are built from.', TEMPLATE_OPTIONS);
  control('rate', 'Sample rate', ...domain('rate'), d.rate, 'kHz', 'Thousands of samples a second: wideband, as Kaldi expects, or a telephone’s.', RATE_OPTIONS);
  control('window', 'Window', ...domain('window'), d.window, '', 'The taper each frame is multiplied by before its transform.', WINDOW_OPTIONS);

  /** What changes only with the settings: the waveform, the spectrogram's and trace's cells, the filters, the window, the chart's colors. */
  function drawPlan(plan) {
    const {rate, total, duration} = plan;
    fillLine(waveFaint, Array.from({length: total}, (_, n) => [timeX(plan, n / rate), waveY(LAYOUT.voice, plan.samples[n]), -0.001]));
    fillLine(waveDark, Array.from({length: total}, (_, n) => [timeX(plan, n / rate), waveY(LAYOUT.voice, plan.samples[n]), 0]));
    fillLine(bounds, plan.bounds.map(sample => [[timeX(plan, sample / rate), VY, -0.002], [timeX(plan, sample / rate), VY + VH, -0.002]]).flat());
    fillLine(timeTicks, Array.from({length: 5}, (_, i) => [[timeX(plan, 0.1 * (i + 1)), VY, 0], [timeX(plan, 0.1 * (i + 1)), VY - CHART.tick / 2, 0]]).flat());
    // Unsampled bands above half the sample rate.
    const bandLeft = hzX(plan.nyquist), bandBottom = hzY(plan.nyquist);
    unsampled.visible = plan.nyquist < MAX_HZ;
    unsampled.position.set((bandLeft + PX + PW) / 2, PY + PH / 2, -0.003);
    unsampled.scale.set(Math.max(1e-9, PX + PW - bandLeft), PH, 1);
    gramUnsampled.visible = plan.nyquist < MAX_HZ;
    gramUnsampled.position.set(GX + GW / 2, (bandBottom + GY + GH) / 2, -0.003);
    gramUnsampled.scale.set(GW, Math.max(1e-9, GY + GH - bandBottom), 1);
    // Spectrogram and trace cells.
    const lines = plan.nfft / 2 + 1;
    plan.frames.forEach((item, f) => {
      const [x0, x1] = columnX(plan, f);
      for (let k = 0; k < lines; k++) setQuad(cells, f * lines + k, x0, hzY(Math.max(0, (k - 0.5) * plan.binWidth)), x1, hzY(Math.min(plan.nyquist, (k + 0.5) * plan.binWidth)));
      for (let row = 0; row < VOWELS.length + 3; row++) {
        const [y0, y1] = row < VOWELS.length + 1 ? traceRow(row) : traceRow(row === VOWELS.length + 1 ? 'said' : 'heard');
        setQuad(trace, f * (VOWELS.length + 3) + row, timeX(plan, 0, LAYOUT.trace) + (x0 - GX), y0, timeX(plan, 0, LAYOUT.trace) + (x1 - GX), y1);
      }
    });
    for (let i = plan.count * lines; i < gramRoom; i++) setQuad(cells, i, GX, GY, GX, GY);
    touched(cells, plan.count * lines);
    touched(trace, plan.count * (VOWELS.length + 3));
    // Filters.
    fillLine(triangles, plan.bank.filters.map(filter => [[hzX(filter.leftHz, LAYOUT.filters), LY + 0.52 * LH, 0], [hzX(filter.centerHz, LAYOUT.filters), LY + 0.95 * LH, 0], [hzX(filter.centerHz, LAYOUT.filters), LY + 0.95 * LH, 0], [hzX(filter.rightHz, LAYOUT.filters), LY + 0.52 * LH, 0]]).flat());
    // Vowel chart colors for the speakers chosen, their averages and the patterns' averages.
    const speaker = plan.values.speaker, templates = plan.values.templates;
    MEASUREMENTS.forEach((m, i) => colorQuad(points, i, paper.clone().lerp(vowelColors[m.vowel], m.group === speaker ? 0.75 : 0.25)));
    touched(points, MEASUREMENTS.length);
    VOWELS.forEach((_, v) => { const [f1, f2] = formantsOf(speaker, v); setQuad(averages, v, f2X(f2) - CHART.average, f1Y(f1) - CHART.average, f2X(f2) + CHART.average, f1Y(f1) + CHART.average); colorQuad(averages, v, vowelColors[v]); });
    touched(averages, VOWELS.length);
    fillLine(patternRings, VOWELS.map((_, v) => { const [f1, f2] = formantsOf(templates, v); return ring(f2X(f2), f1Y(f1), CHART.ring); }).flat());
    fillLine(saidRings, [plan.values.first, plan.values.second].map(v => { const [f1, f2] = formantsOf(speaker, v); return ring(f2X(f2), f1Y(f1), CHART.said); }).flat());
    VOWELS.forEach((_, v) => colorQuad(distanceBars, v, vowelColors[v]));
    coloredHeard = -1;
  }

  /** Colors of every column the clock has or has not reached. */
  function colorColumns(plan, heardFrames) {
    const lines = plan.nfft / 2 + 1, color = new THREE.Color();
    const heardRuns = plan.runs.filter(run => run.label >= 0 && run.count >= DECLARED.run);
    plan.frames.forEach((item, f) => {
      const keep = f < heardFrames ? 1 : UNHEARD;
      for (let k = 0; k < lines; k++) colorQuad(cells, f * lines + k, grayOf(color, gramShare(item.db[k]) * keep));
      for (let v = 0; v < VOWELS.length; v++) {
        if (item.silent) color.copy(paper);
        else if (v === item.nearest) color.copy(paper).lerp(vowelColors[v], keep);
        else color.copy(paper).lerp(faint, closeness(item.distances[v]) * keep);
        colorQuad(trace, f * (VOWELS.length + 3) + v, color);
      }
      colorQuad(trace, f * (VOWELS.length + 3) + VOWELS.length, color.copy(paper).lerp(silenceColor, item.silent ? keep : 0));
      const center = item.start + plan.length / 2, said = center >= plan.bounds[0] && center < plan.bounds[1] ? plan.values.first : center >= plan.bounds[1] && center < plan.bounds[2] ? plan.values.second : -1;
      colorQuad(trace, f * (VOWELS.length + 3) + VOWELS.length + 1, said < 0 ? color.copy(paper) : color.copy(paper).lerp(vowelColors[said], keep));
      const run = heardRuns.find(candidate => f >= candidate.start && f < candidate.start + candidate.count);
      const shown = run && f < heardFrames && Math.min(heardFrames, run.start + run.count) - run.start >= DECLARED.run;
      colorQuad(trace, f * (VOWELS.length + 3) + VOWELS.length + 2, shown ? color.copy(vowelColors[run.label]) : color.copy(paper));
    });
    touched(cells, plan.count * lines);
    touched(trace, plan.count * (VOWELS.length + 3));
  }

  const result = finish(v => {
    const plan = speechPlan(v), now = speechAt(plan, clock), item = now.frame, f = now.shown;
    if (drawnPlan !== plan) { drawPlan(plan); drawnPlan = plan; }
    const heardFrames = clock > 0 ? now.heardFrames : 0;
    if (coloredHeard !== heardFrames) { colorColumns(plan, heardFrames); coloredHeard = heardFrames; }

    // The voice: dark as far as the clock, and the frame's box.
    waveDark.geometry.setDrawRange(0, clock > 0 ? now.arrived : 0);
    waveDark.visible = clock > 0 && now.arrived > 0;
    const t0 = item.start / plan.rate, t1 = item.end / plan.rate;
    fillLine(bracket, [[timeX(plan, t0), VY, 0.002], [timeX(plan, t1), VY, 0.002], [timeX(plan, t1), VY + VH, 0.002], [timeX(plan, t0), VY + VH, 0.002], [timeX(plan, t0), VY, 0.002]]);

    // The close up and the frame.
    const half = Math.round(plan.rate * CHART.closeup / 2), center = item.start + plan.length / 2, span = 2 * half;
    const stemX = m => SX + (m + 0.5) / span * SW;
    fillLine(stems, Array.from({length: span}, (_, m) => [[stemX(m), waveY(LAYOUT.samples, 0), 0], [stemX(m), waveY(LAYOUT.samples, plan.samples[center - half + m]), 0]]).flat());
    for (let m = 0; m < stemRoom; m++) { const k = Math.min(m, span - 1), x = stemX(k), y = waveY(LAYOUT.samples, plan.samples[center - half + k]); setQuad(dots, m, x - CHART.dot, y - CHART.dot, x + CHART.dot, y + CHART.dot); }
    touched(dots, span);
    const frameX = n => FX + n / (plan.length - 1) * FW;
    fillLine(rawLine, Array.from({length: plan.length}, (_, n) => [frameX(n), waveY(LAYOUT.frame, plan.samples[item.start + n]), -0.001]));
    fillLine(windowLine, Array.from({length: plan.length}, (_, n) => [frameX(n), waveY(LAYOUT.frame, plan.window[n]), 0]));
    fillLine(windowedLine, Array.from({length: plan.length}, (_, n) => [frameX(n), waveY(LAYOUT.frame, item.windowed[n]), 0.001]));
    const boxLeft = frameX(plan.length / 2 - half), boxRight = frameX(plan.length / 2 + half - 1);
    fillLine(closeBox, [[boxLeft, FY + 0.03, 0.002], [boxRight, FY + 0.03, 0.002], [boxRight, FY + FH - 0.03, 0.002], [boxLeft, FY + FH - 0.03, 0.002], [boxLeft, FY + 0.03, 0.002]]);

    // The spectrum and the formants of the vowels under the frame.
    fillLine(spectrumLine, Array.from(item.db, (db, k) => [hzX(k * plan.binWidth), dbY(db), 0]));
    for (let i = 0; i < 6; i++) {
      const slot = Math.floor(i / 3), vowel = item.under[slot];
      if (vowel === undefined) { setQuad(formantMarks, i, PX, PY + PH, PX, PY + PH); continue; }
      const x = hzX(formantsOf(plan.values.speaker, vowel)[i % 3]), bottom = PY + PH + 0.012 + slot * CHART.tick;
      setQuad(formantMarks, i, x - CHART.mark, bottom, x + CHART.mark, bottom + 0.8 * CHART.tick);
      colorQuad(formantMarks, i, vowelColors[vowel]);
    }
    touched(formantMarks, 3 * item.under.length);

    // Filters' energies and the coefficients.
    plan.bank.filters.forEach((filter, j) => {
      const db = 10 * Math.log10(Math.max(item.mel[j], DECLARED.floor) / plan.melReference), top = LY + 0.45 * LH * shareOf(db);
      setQuad(melBars, j, hzX((filter.leftHz + filter.centerHz) / 2, LAYOUT.filters), LY, hzX((filter.centerHz + filter.rightHz) / 2, LAYOUT.filters), Math.max(LY + 1e-6, top));
    });
    touched(melBars, KALDI.filters);
    const nearest = plan.patterns[item.nearest].ceps, cepsWidth = CW / (KALDI.ceps - 1), scaled = value => waveY(LAYOUT.ceps, Math.max(-1, Math.min(1, value / CHART.cepsScale)));
    for (let i = 1; i < KALDI.ceps; i++) {
      const x0 = CX + (i - 1 + 0.2) * cepsWidth, x1 = CX + (i - 1 + 0.8) * cepsWidth, y0 = waveY(LAYOUT.ceps, 0), y1 = scaled(item.ceps[i]);
      setQuad(cepsBars, i - 1, x0, Math.min(y0, y1), x1, Math.max(y0, y1) === Math.min(y0, y1) ? y0 + 1e-6 : Math.max(y0, y1));
    }
    touched(cepsBars, KALDI.ceps - 1);
    fillLine(cepsTicks, item.silent ? [] : Array.from({length: KALDI.ceps - 1}, (_, i) => [[CX + i * cepsWidth, scaled(nearest[i + 1]), 0.002], [CX + (i + 1) * cepsWidth, scaled(nearest[i + 1]), 0.002]]).flat());

    // Distances to each pattern.
    const barWidth = DW / VOWELS.length, barBase = DY + 0.1 * DH, barTop = distance => barBase + 0.85 * DH * Math.min(1, distance / CHART.distanceScale);
    VOWELS.forEach((_, vowel) => setQuad(distanceBars, vowel, DX + (vowel + 0.15) * barWidth, barBase, DX + (vowel + 0.85) * barWidth, Math.max(barBase + 1e-6, barTop(item.distances[vowel]))));
    touched(distanceBars, item.silent ? 0 : VOWELS.length);
    const w0 = DX + (item.nearest + 0.05) * barWidth, w1 = DX + (item.nearest + 0.95) * barWidth, wTop = barTop(item.distances[item.nearest]) + 0.02;
    fillLine(winnerBox, item.silent ? [] : [[w0, barBase - 0.01, 0.002], [w1, barBase - 0.01, 0.002], [w1, wTop, 0.002], [w0, wTop, 0.002], [w0, barBase - 0.01, 0.002]]);
    for (let slot = 0; slot < 2; slot++) { const vowel = item.under[Math.min(slot, item.under.length - 1)]; if (vowel === undefined) setQuad(saidMarks, slot, DX, DY, DX, DY); else setQuad(saidMarks, slot, DX + (vowel + 0.3) * barWidth, DY + 0.02 * DH, DX + (vowel + 0.7) * barWidth, DY + 0.07 * DH); }
    touched(saidMarks, item.under.length);

    // Cursors on the spectrogram and the trace, and the nearest pattern on the chart.
    const [c0, c1] = columnX(plan, f), cursorX = (c0 + c1) / 2;
    fillLine(gramCursor, clock > 0 ? [[cursorX, GY, 0.002], [cursorX, GY + GH, 0.002]] : []);
    fillLine(traceCursor, clock > 0 ? [[cursorX - GX + TX, TY, 0.002], [cursorX - GX + TX, TY + TH, 0.002]] : []);
    const [n1, n2] = formantsOf(plan.values.templates, item.nearest);
    fillLine(nearestRing, item.silent ? [] : ring(f2X(n2), f1Y(n1), CHART.nearest));

    // Arrows.
    const leaderX = timeX(plan, (t0 + t1) / 2), leaderY = VY + VH + CHART.leader, leader = [[[leaderX, VY + VH + 0.01], [leaderX, leaderY]], [[leaderX, leaderY], [SX + SW / 2, leaderY]], [[SX + SW / 2, leaderY], [SX + SW / 2, SY + SH + 0.02]]];
    fillLine(arrowShafts, [...arrowPaths, ...leader].flatMap(([a, b]) => [[...a, -0.001], [...b, -0.001]]));
    const heads = [...arrowPaths, leader[2]].flatMap(([[ax, ay], [bx, by]]) => {
      const length = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / length, uy = (by - ay) / length, s = CHART.head;
      return [bx, by, 0, bx - s * ux + s / 2 * -uy, by - s * uy + s / 2 * ux, 0, bx - s * ux - s / 2 * -uy, by - s * uy - s / 2 * ux, 0];
    });
    arrowHeads.geometry.attributes.position.array.set(heads);
    arrowHeads.geometry.attributes.position.needsUpdate = true;
    arrowHeads.geometry.boundingBox = null;
    arrowHeads.geometry.boundingSphere = null;

    // Readings.
    const values = plan.values, group = GROUPS[values.speaker], said = [values.first, values.second], underText = item.under.length ? listOf(item.under.map(ipa)) : 'no vowel';
    const status = clock <= 0 ? `Ready · ${ipa(values.first)} as in ${VOWELS[values.first].word}, then ${ipa(values.second)} as in ${VOWELS[values.second].word}, as ${group.one} says them; press Play to listen`
      : !now.done ? (item.silent ? `Listening · frame ${f + 1} of ${plan.count}: silence` : `Listening · frame ${f + 1} of ${plan.count} is nearest ${ipa(item.nearest)}`)
      : plan.recognized ? `Heard ${plan.heard.map(ipa).join(' then ')}, as said: ${plan.steadyRight} of the ${plan.steadyCount} frames inside a vowel matched it`
      : `Heard ${plan.heard.length ? plan.heard.map(ipa).join(' then ') : 'nothing'} for ${said.map(ipa).join(' then ')}: ${plan.steadyRight} of the ${plan.steadyCount} frames inside a vowel matched it`;
    const slot = item.start >= plan.bounds[1] ? 1 : 0, shownVowel = said[slot], voiceNow = plan.voices[slot];
    const [f1, f2, f3] = formantsOf(values.speaker, shownVowel), leak = plan.leakage, windowName = WINDOW_OPTIONS[values.window].label;
    const windowText = values.window === 0 ? `${KALDI.hamming[0]} − ${KALDI.hamming[1]} cos(2πn/${plan.length - 1}) tapers the frame to ${fixed(KALDI.hamming[0] - KALDI.hamming[1], 2)} at its ends`
      : values.window === 1 ? `${KALDI.hann[0]} − ${KALDI.hann[1]} cos(2πn/${plan.length - 1}) tapers the frame to nothing at its ends`
      : 'The frame is cut off square, with no taper';
    const loudestFilter = item.mel.indexOf(Math.max(...item.mel)), first = plan.bank.filters[0], last = plan.bank.filters.at(-1);
    const order = Array.from(item.distances.keys()).sort((a, b) => item.distances[a] - item.distances[b]);
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Samples', `${fixed(plan.rate, 0)} a second`, `Each ${KALDI.frame} ms frame holds ${plan.length} samples, padded with zeros to ${plan.nfft} for the transform, so its spectrum has a line every ${fixed(plan.binWidth, 2)} Hz up to ${fixed(plan.nyquist, 0)} Hz, half the sample rate. A frame starts every ${KALDI.shift} ms: ${plan.count} frames in ${fixed(plan.duration, 1)} s. The voice’s harmonics above ${fixed(plan.nyquist, 0)} Hz are left out, as the filter before sampling would remove them.`),
        r('Voice', `${ipa(shownVowel)} at ${fixed(TABLE_II.f0[values.speaker][shownVowel], 0)} Hz`, `Table II gives ${group.name}’s ${ipa(shownVowel)} as in ${VOWELS[shownVowel].word} a pitch of ${fixed(TABLE_II.f0[values.speaker][shownVowel], 0)} Hz and formants of ${fixed(f1, 0)}, ${fixed(f2, 0)} and ${fixed(f3, 0)} Hz. Its ${voiceNow.harmonics.length} harmonics below ${fixed(plan.nyquist, 0)} Hz are a sawtooth’s, each passed through three resonances at those formants, ${listOf(DECLARED.bandwidths.map(b => fixed(b, 0)))} Hz wide. Not from a source: the sawtooth and the widths.`),
        r('Frame', `${f + 1} of ${plan.count}`, `From ${fixed(item.start / plan.rate * 1000, 0)} to ${fixed(item.end / plan.rate * 1000, 0)} ms, over ${underText}. ${item.silent ? `More than ${DECLARED.quiet} dB quieter than the loudest frame, so it counts as silence.` : `Its energy is ${signed(item.level, 1)} dB against the loudest frame.`}${clock <= 0 ? ' Before Play the charts show the middle frame of the first vowel.' : now.done ? ' Once the utterance has ended the charts hold the last frame with voice in it.' : ''}`),
        r('Window', windowName, `${windowText}. Its strongest sidelobe is ${signed(leak.sidelobe, 1)} dB, so a harmonic spills about that much into lines away from it, and its main lobe reaches ${fixed(leak.firstNull, 0)} Hz either side of each harmonic.`),
        r('Spectrum', item.silent ? 'silence' : `strongest at ${fixed(item.peakHz, 0)} Hz`, `The discrete Fourier transform of the frame’s ${plan.length} windowed samples: ${plan.nfft / 2 + 1} lines ${fixed(plan.binWidth, 2)} Hz apart, each drawn ${-DECLARED.bottom} dB down from the loudest line in the utterance. ${item.silent ? 'This frame has no voice in it.' : `Its strongest line is at ${fixed(item.peakHz, 0)} Hz, ${signed(item.db[item.peakLine], 1)} dB.`}`),
        r('Mel filters', `${KALDI.filters} filters`, `Kaldi spaces the filters’ centers evenly on the mel scale, m = 1127 ln(1 + f/700), from ${KALDI.low} Hz to ${fixed(plan.nyquist, 0)} Hz: the first spans ${fixed(first.leftHz, 0)} to ${fixed(first.rightHz, 0)} Hz and the last ${fixed(last.leftHz, 0)} to ${fixed(last.rightHz, 0)} Hz. ${item.silent ? '' : `In this frame the filter centered at ${fixed(plan.bank.filters[loudestFilter].centerHz, 0)} Hz catches the most.`}`.trim()),
        r('Features', `${KALDI.ceps} coefficients`, `The cosine transform of the ${KALDI.filters} filters’ logarithms, keeping ${KALDI.ceps}, as Kaldi does. The zeroth follows only loudness, so matching uses the other ${KALDI.ceps - 1}: here the first is ${signed(item.ceps[1], 2)} and the second ${signed(item.ceps[2], 2)}.`),
        r('Nearest pattern', item.silent ? 'silence' : `${ipa(item.nearest)} at ${fixed(item.distances[item.nearest], 2)}`, `${item.silent ? 'A silent frame is not matched. ' : `Nearest ${ipa(order[0])} at ${fixed(item.distances[order[0]], 2)}, then ${ipa(order[1])} at ${fixed(item.distances[order[1]], 2)} and ${ipa(order[2])} at ${fixed(item.distances[order[2]], 2)}. `}Each pattern is the mean of the ${KALDI.ceps - 1} coefficients over every frame of the vowel synthesized alone from ${GROUPS[values.templates].name}’s averages.`),
        r('Slowed', `${DECLARED.slow} times`, `The recognizer takes the voice in ${DECLARED.slow} times slower than speech: the ${fixed(plan.duration, 1)} s utterance takes ${fixed(plan.duration * DECLARED.slow, 0)} s, a new frame every ${fixed(KALDI.shift / 1000 * DECLARED.slow, 1)} s. The charts are not to scale.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt / DECLARED.slow); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = seconds => { clock = Math.min(duration(), seconds); return render(); };
  const frameEnd = index => { const plan = result.getState(); return (index * plan.shift + plan.length) / plan.rate; };
  result.actions = [
    {label: 'Inspect: one frame of the first vowel', part: 'frame', view: 'front', replay: false, run() { return inspect(frameEnd(result.getState().preview)); }},
    {label: 'Inspect: the join between the vowels', part: 'spectrum', view: 'front', replay: false, run() { const plan = result.getState(); return inspect(frameEnd(plan.frames.find(item => item.inside === 'join').index)); }},
    {label: 'Inspect: the spectrogram', part: 'spectrogram', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the vowel chart', part: 'vowels', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Listen',
    description: `The recognizer takes in the utterance a frame every ${KALDI.shift} ms, ${DECLARED.slow} times slower than speech.`,
    stepLabel: `Advance one frame, ${KALDI.shift} ms`,
    advance: result.advance,
    step: () => result.advance(KALDI.shift / 1000 * DECLARED.slow),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'recognizer', label: 'Inspect what was heard', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.52;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, voice, voicePanel, zero, bounds, timeTicks, waveFaint, waveDark, bracket, frame, samplesPanel, framePanel, closeZero, frameZero, stems, dots, rawLine, windowLine, windowedLine, closeBox, spectrum, spectrumPanel, spectrumGrid, unsampled, spectrumLine, formantMarks, features, filtersPanel, cepsPanel, triangles, melBars, cepsZero, cepsBars, cepsTicks, spectrogram, gramPanel, cells, gramUnsampled, gramCursor, recognizer, distancesPanel, tracePanel, distanceBars, winnerBox, saidMarks, trace, traceCursor, vowels, vowelsPanel, points, averages, patternRings, saidRings, nearestRing, arrowShafts, arrowHeads};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

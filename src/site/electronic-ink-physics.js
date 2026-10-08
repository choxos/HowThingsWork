import {clamp, smooth, validTime, validateControls} from './physics-kit.js';

// The motion coordinate illustrates pigment rearrangement and retention.
// It is not a transport, reflectance or commercial drive-waveform model.
export const INK_PATCH = Object.freeze({columns: 17, rows: 7, cells: 119, rowSeconds: .8, voltage: 15, blackCharge: 1, whiteCharge: -1});
export const INK_DEFAULTS = Object.freeze({word: 0, contrast: 0, power: 1, light: 1});
export const INK_DOMAINS = Object.freeze({word: Object.freeze([0, 3, 1]), contrast: Object.freeze([0, 1, 1]), power: Object.freeze([0, 1, 1]), light: Object.freeze([0, 1, 1])});
const FONT = {
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
};
const word = text => {
  const rows = Array.from({length: INK_PATCH.rows}, (_, row) => text ? [...text].map(letter => FONT[letter][row]).join('0') : '0'.repeat(INK_PATCH.columns));
  return Object.freeze({text, name: text || 'Blank', rows: Object.freeze(rows), pixels: Object.freeze(rows.join('').split('').map(Number))});
};
export const INK_WORDS = Object.freeze(['INK', 'CAT', 'CAR', ''].map(word));
const EPS = 1e-10;
const rounded = value => Number(value.toFixed(12));
export const inkSettings = (input = {}) => validateControls(input, INK_DEFAULTS, INK_DOMAINS, 'electronic ink');

/** Zero puts white at the viewing side; one puts black there. Values in
 * between locate illustrative motion, not measured gray reflectance. */
export function inkPixels(input) {
  if (!Array.isArray(input) || input.length !== INK_PATCH.cells || Array.from(input).some(value => !Number.isFinite(value) || value < 0 || value > 1)) throw new RangeError('Expected 119 pigment states between zero and one');
  return [...input];
}

export function inkRequested(input = {}) {
  const values = inkSettings(input);
  return INK_WORDS[values.word].pixels.map(value => values.contrast ? 1 - value : value);
}

/** Recognize the stored patch alone. A request is never an input. */
export function inkReadback(input) {
  const pixels = inkPixels(input);
  for (const candidate of INK_WORDS) for (const contrast of [0, 1]) {
    if (pixels.every((value, index) => Math.abs(value - (contrast ? 1 - candidate.pixels[index] : candidate.pixels[index])) < EPS)) return {text: candidate.text, contrast, complete: true};
  }
  return {text: null, contrast: null, complete: false};
}

export function inkPlan(input = {}, pixels, selected) {
  const values = inkSettings(input), start = inkPixels(pixels ?? Array(INK_PATCH.cells).fill(0));
  if (selected !== undefined && (!Number.isInteger(selected) || selected < 0 || selected >= INK_PATCH.cells)) throw new RangeError('Expected a selected ink pixel from 0 to 118');
  const requested = inkRequested(values), target = values.power ? requested : [...start];
  const changed = target.flatMap((value, index) => Math.abs(value - start[index]) > EPS ? [index] : []);
  const rows = [...new Set(changed.map(index => Math.floor(index / INK_PATCH.columns)))];
  const unfinished = start.findIndex(value => value > EPS && value < 1 - EPS);
  const inspection = selected ?? (unfinished >= 0 ? unfinished : Math.max(0, start.findIndex(value => value > .5)));
  return Object.freeze({values: Object.freeze(values), start: Object.freeze(start), target: Object.freeze(target), changed: Object.freeze(changed), rows: Object.freeze(rows), inspection, duration: rounded(rows.length * INK_PATCH.rowSeconds)});
}

export function inkAt(plan, time) {
  const clock = Math.min(validTime(time), plan.duration), complete = clock >= plan.duration;
  const pixels = [...plan.start], voltages = Array(INK_PATCH.cells).fill(0);
  const activeRow = complete ? -1 : plan.rows[Math.min(plan.rows.length - 1, Math.floor(rounded(clock / INK_PATCH.rowSeconds)))];
  const slots = new Map(plan.rows.map((row, slot) => [row, slot]));
  for (const index of plan.changed) {
    const row = Math.floor(index / INK_PATCH.columns), progress = clamp(rounded((clock - slots.get(row) * INK_PATCH.rowSeconds) / INK_PATCH.rowSeconds));
    pixels[index] = plan.start[index] + (plan.target[index] - plan.start[index]) * smooth(progress);
    if (plan.values.power && row === activeRow) voltages[index] = Math.sign(plan.target[index] - plan.start[index]) * INK_PATCH.voltage;
  }
  const requested = inkRequested(plan.values);
  const selected = plan.changed.find(index => Math.floor(index / INK_PATCH.columns) === activeRow) ?? plan.changed.at(-1) ?? plan.inspection;
  const selectedPixel = Math.max(0, selected), voltage = voltages[selectedPixel], field = Math.sign(voltage);
  return {clock, complete, pixels, voltages, activeRow, selected: selectedPixel, voltage, field,
    blackForce: field * INK_PATCH.blackCharge, whiteForce: field * INK_PATCH.whiteCharge,
    changedCells: plan.changed.length, writtenCells: plan.changed.filter(index => Math.abs(pixels[index] - plan.target[index]) < EPS).length,
    requested, matchedCells: pixels.filter((value, index) => Math.abs(value - requested[index]) < EPS).length,
    readback: inkReadback(pixels), visible: Boolean(plan.values.light), holding: complete || !plan.values.power};
}

/** Removing power preserves the current material state, including a partial
 * update. Electrical discharge transients and retention decay are omitted. */
export function createInkController(initial = {}) {
  let plan, clock;
  const state = () => ({values: {...plan.values}, plan, clock, duration: plan.duration, now: inkAt(plan, clock)});
  const reset = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected ink initial state');
    const next = inkPlan(input.settings ?? {}, input.pixels, input.selected), time = validTime(input.time ?? 0);
    plan = next; clock = Math.min(time, next.duration); return state();
  };
  const update = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected ink settings');
    const next = inkSettings({...plan.values, ...input}), before = plan.values;
    if (next.power !== before.power || next.power && (next.word !== before.word || next.contrast !== before.contrast)) {
      const retained = inkAt(plan, clock);
      plan = inkPlan(next, retained.pixels, retained.selected); clock = 0;
    } else plan = Object.freeze({...plan, values: Object.freeze(next)});
    return state();
  };
  const advance = dt => {validTime(dt); clock = Math.min(plan.duration, rounded(clock + dt)); return state();};
  const replayState = () => ({settings: {...plan.values}, pixels: [...plan.start], selected: plan.inspection, time: 0});
  reset(initial);
  return {getState: state, reset, update, advance, replayState};
}

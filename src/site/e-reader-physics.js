import {clamp, smooth, validTime, validateControls} from './physics-kit.js';

// The bitmap and schedule explain a reader. They do not specify a commercial
// resolution, drive waveform, optical response, power budget or refresh time.
export const READER_PAGE = Object.freeze({columns: 72, rows: 96, cells: 6912, retrieveSeconds: .35, composeSeconds: .30, rowSeconds: .06});
export const READER_DEFAULTS = Object.freeze({book: 0, page: 0, power: 1, ambient: 1, frontlight: 0});
export const READER_DOMAINS = Object.freeze({book: Object.freeze([0, 2, 1]), page: Object.freeze([0, 1, 1]), power: Object.freeze([0, 1, 1]), ambient: Object.freeze([0, 1, 1]), frontlight: Object.freeze([0, 2, 1])});
const FONT = {
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01110','10001','10000','10111','10001','10001','01110'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00010','00010','00010','00010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','11001','10101','10011','10011','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'], '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '.': ['00000','00000','00000','00000','00000','00100','00100'], ',': ['00000','00000','00000','00000','00100','00100','01000'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};
const MINI_BOOKS = [
  {title: 'Light', pages: [['SUNLIGHT','REACHES','A PAGE.','WHITE AREAS','SEND LIGHT','TO THE EYE.'], ['IN DARKNESS','EDGE LEDS','LIGHT THE','PAGE FROM','THE FRONT.','READ ON.']]},
  {title: 'Rain', pages: [['DROPS FALL.','THE GROUND','TURNS WET.','A PUDDLE','FORMS IN','A LOW SPOT.'], ['THE SUN','WARMS IT.','WATER RISES','AS VAPOR.','THE PUDDLE','GETS SMALL.']]},
  {title: 'Seeds', pages: [['A SEED LIES','IN SOIL.','IT TAKES UP','WATER.','ROOTS GROW','DOWNWARD.'], ['A SHOOT','GROWS UP.','LEAVES OPEN','LIGHT HELPS','THE PLANT','MAKE SUGAR.']]},
];

function composePage(title, page, lines) {
  const pixels = Array(READER_PAGE.cells).fill(0);
  const draw = (text, top) => {
    const left = Math.floor((READER_PAGE.columns - (text.length * 6 - 1)) / 2);
    if (left < 3 || top + 7 > READER_PAGE.rows - 3) throw new RangeError(`Miniature page text exceeds the teaching display margins: ${text}`);
    [...text].forEach((letter, column) => {
      const glyph = FONT[letter];if (!glyph) throw new RangeError('Unsupported miniature page letter');
      glyph.forEach((row, y) => [...row].forEach((bit, x) => {pixels[(top + y) * READER_PAGE.columns + left + column * 6 + x] = Number(bit);}));
    });
  };
  draw(title.toUpperCase(), 5);draw(`PAGE ${page + 1}`, 18);
  lines.forEach((line, index) => draw(line, 34 + index * 9));
  return Object.freeze({title, page, name: `${title} · page ${page + 1}`, lines: Object.freeze([...lines]), pixels: Object.freeze(pixels)});
}
export const READER_BOOKS = Object.freeze(MINI_BOOKS.map(book => Object.freeze({title: book.title, pages: Object.freeze(book.pages.map((lines, page) => composePage(book.title, page, lines)))})));
const EPS = 1e-10, rounded = value => Number(value.toFixed(12));
export const readerSettings = (input = {}) => validateControls(input, READER_DEFAULTS, READER_DOMAINS, 'e-reader');

/** Zero represents white pigment at the front, one black. Intermediate values
 * are motion coordinates, not calibrated shades or reflected intensities. */
export function readerPixels(input) {
  if (!Array.isArray(input) || input.length !== READER_PAGE.cells || Array.from(input).some(value => !Number.isFinite(value) || value < 0 || value > 1)) throw new RangeError('Expected 6912 pigment states between zero and one');
  return [...input];
}
export function readerRequested(input = {}) {const values = readerSettings(input);return [...READER_BOOKS[values.book].pages[values.page].pixels];}

/** Recognize only the material image, with no requested title as an input. */
export function readerReadback(input) {
  const pixels = readerPixels(input);
  for (let book = 0; book < READER_BOOKS.length; book++) for (let page = 0; page < 2; page++) {
    const candidate = READER_BOOKS[book].pages[page];
    if (pixels.every((value, index) => Math.abs(value - candidate.pixels[index]) < EPS)) return {book, page, name: candidate.name, complete: true};
  }
  return {book: null, page: null, name: pixels.every(value => value < EPS) ? 'Blank page' : 'Partial page', complete: false};
}

export function readerPlan(input = {}, pixels, selected) {
  const values = readerSettings(input), start = readerPixels(pixels ?? Array(READER_PAGE.cells).fill(0));
  if (selected !== undefined && (!Number.isInteger(selected) || selected < 0 || selected >= READER_PAGE.cells)) throw new RangeError('Expected a selected e-reader pixel from 0 to 6911');
  const requested = readerRequested(values), target = values.power ? requested : [...start];
  const changed = target.flatMap((value, index) => Math.abs(value - start[index]) > EPS ? [index] : []);
  const rows = [...new Set(changed.map(index => Math.floor(index / READER_PAGE.columns)))];
  const partial = start.findIndex(value => value > EPS && value < 1 - EPS);
  const inspection = selected ?? (partial >= 0 ? partial : Math.max(0, start.findIndex(value => value > .5)));
  const duration = rows.length ? rounded(READER_PAGE.retrieveSeconds + READER_PAGE.composeSeconds + rows.length * READER_PAGE.rowSeconds) : 0;
  return Object.freeze({values: Object.freeze(values), start: Object.freeze(start), target: Object.freeze(target), changed: Object.freeze(changed), rows: Object.freeze(rows), inspection, duration});
}

export function readerAt(plan, time) {
  const clock = Math.min(validTime(time), plan.duration), complete = clock >= plan.duration, startWriting = READER_PAGE.retrieveSeconds + READER_PAGE.composeSeconds;
  const writingTime = rounded(clock - startWriting), pixels = [...plan.start], directions = Array(READER_PAGE.cells).fill(0);
  const activeSlot = !complete && writingTime >= 0 ? Math.floor(rounded(writingTime / READER_PAGE.rowSeconds)) : -1;
  const activeRow = activeSlot < 0 ? -1 : plan.rows[activeSlot] ?? -1;
  const slots = new Map(plan.rows.map((row, index) => [row, index]));
  for (const index of plan.changed) {
    const row = Math.floor(index / READER_PAGE.columns), fraction = clamp(rounded((writingTime - slots.get(row) * READER_PAGE.rowSeconds) / READER_PAGE.rowSeconds));
    pixels[index] = fraction >= 1 ? plan.target[index] : plan.start[index] + (plan.target[index] - plan.start[index]) * smooth(fraction);
    if (plan.values.power && row === activeRow) directions[index] = Math.sign(plan.target[index] - plan.start[index]);
  }
  const selected = plan.changed.find(index => Math.floor(index / READER_PAGE.columns) === activeRow) ?? plan.changed.at(-1) ?? plan.inspection;
  const requested = readerRequested(plan.values), frontLight = plan.values.power ? plan.values.frontlight / 2 : 0;
  const illumination = Math.min(1, plan.values.ambient + frontLight);
  const stage = !plan.values.power ? 'Off' : complete ? 'Holding page' : clock < READER_PAGE.retrieveSeconds ? 'Reading stored text' : clock < startWriting ? 'Composing pixels' : 'Writing display';
  const matchedPixels = pixels.filter((value, index) => Math.abs(value - requested[index]) < EPS).length;
  return {clock, complete, stage, pixels, directions, activeRow, selected, direction: directions[selected], requested, frontLight, illumination,
    visible: illumination > 0, changedPixels: plan.changed.length, writtenPixels: plan.changed.filter(index => Math.abs(pixels[index] - plan.target[index]) < EPS).length,
    matchedPixels, pending: matchedPixels !== READER_PAGE.cells, readback: readerReadback(pixels), holding: complete || !plan.values.power,
    textLoaded: Boolean(plan.values.power && (complete || clock >= READER_PAGE.retrieveSeconds)), framebufferReady: Boolean(plan.values.power && (complete || clock >= startWriting))};
}

/** Device disconnection stops writing at the current material image. The front
 * light also turns off; material retention does not supply power to LEDs. */
export function createReaderController(initial = {}) {
  let plan, clock;
  const state = () => ({values: {...plan.values}, plan, clock, duration: plan.duration, now: readerAt(plan, clock)});
  const reset = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected e-reader initial state');
    const next = readerPlan(input.settings ?? {}, input.pixels, input.selected), time = validTime(input.time ?? 0);
    plan = next;clock = Math.min(time, next.duration);return state();
  };
  const update = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected e-reader settings');
    const next = readerSettings({...plan.values, ...input}), before = plan.values;
    if (next.power !== before.power || next.power && (next.book !== before.book || next.page !== before.page)) {
      const retained = readerAt(plan, clock);plan = readerPlan(next, retained.pixels, retained.selected);clock = 0;
    } else plan = Object.freeze({...plan, values: Object.freeze(next)});
    return state();
  };
  const advance = seconds => {validTime(seconds);clock = Math.min(plan.duration, rounded(clock + seconds));return state();};
  const replayState = () => ({settings: {...plan.values}, pixels: [...plan.start], selected: plan.inspection, time: 0});
  reset(initial);return {getState: state, reset, update, advance, replayState};
}

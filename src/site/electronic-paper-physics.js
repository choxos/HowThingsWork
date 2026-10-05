import {clamp, smooth, validTime, validateControls} from './physics-kit.js';

// This is a discrete display/drive illustration, not a particle-transport,
// contact-line, optical-reflectance or commercial refresh-time prediction.
export const DISPLAY = Object.freeze({columns: 5, rows: 7, cells: 35, rowSeconds: .8, inkVoltage: 15, wettingVoltage: 20, blackCharge: 1, whiteCharge: -1});
export const DISPLAY_DEFAULTS = Object.freeze({technology: 0, pattern: 0, power: 1, reverse: 0, ambient: 1, frontlight: 0});
export const DISPLAY_DOMAINS = Object.freeze(Object.fromEntries(Object.keys(DISPLAY_DEFAULTS).map(key => [key, Object.freeze([0, key === 'pattern' ? 3 : 1, 1])])));
const pattern = (name, rows) => Object.freeze({name, rows: Object.freeze(rows), pixels: Object.freeze(rows.join('').split('').map(Number))});
export const DISPLAY_PATTERNS = Object.freeze([
  pattern('A', ['01110', '10001', '10001', '11111', '10001', '10001', '10001']),
  pattern('B', ['11110', '10001', '10001', '11110', '10001', '10001', '11110']),
  pattern('Blank white', Array(7).fill('00000')),
  pattern('Solid black', Array(7).fill('11111')),
]);
const EPS = 1e-10;
export const displaySettings = (input = {}) => validateControls(input, DISPLAY_DEFAULTS, DISPLAY_DOMAINS, 'electronic paper');

/** Zero is the white-facing state, one the dark state. Intermediate values
 * locate the illustrative motion; they are not measured gray reflectances. */
export function displayPixels(input) {
  if (!Array.isArray(input) || input.length !== DISPLAY.cells || Array.from(input).some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new RangeError('Expected 35 display states between zero and one');
  return [...input];
}

export function displayRequested(input) {
  const settings = displaySettings(input), inverse = settings.technology === 0 && settings.reverse;
  return DISPLAY_PATTERNS[settings.pattern].pixels.map(value => inverse ? 1 - value : value);
}

export function displayPlan(input = {}, pixels) {
  const settings = displaySettings(input), start = displayPixels(pixels ?? Array(DISPLAY.cells).fill(settings.technology));
  const requested = displayRequested(settings);
  const target = settings.power ? requested : settings.technology === 0 ? [...start] : Array(DISPLAY.cells).fill(1);
  const changed = target.flatMap((value, index) => Math.abs(value - start[index]) > EPS ? [index] : []);
  const rows = [...new Set(changed.map(index => Math.floor(index / DISPLAY.columns)))];
  const passive = settings.technology === 1 && !settings.power;
  const duration=Number(((passive ? Math.min(1, rows.length) : rows.length) * DISPLAY.rowSeconds).toFixed(12));
  return Object.freeze({settings: Object.freeze(settings), start: Object.freeze(start), target: Object.freeze(target), changed: Object.freeze(changed), rows: Object.freeze(rows), passive, duration});
}

export function displayAt(plan, time) {
  const clock = Math.min(validTime(time), plan.duration), complete = clock >= plan.duration;
  const pixels = [...plan.start], voltages = Array(DISPLAY.cells).fill(0), progress = Array(DISPLAY.cells).fill(0);
  const activeRow = complete || plan.passive ? -1 : plan.rows[Math.floor(Number((clock / DISPLAY.rowSeconds).toFixed(12)))];
  const rowSlots = new Map(plan.rows.map((row, slot) => [row, slot]));
  for (const index of plan.changed) {
    const slot = plan.passive ? 0 : rowSlots.get(Math.floor(index / DISPLAY.columns));
    progress[index] = clamp(Number(((clock - slot * DISPLAY.rowSeconds) / DISPLAY.rowSeconds).toFixed(12)));
    pixels[index] = plan.start[index] + (plan.target[index] - plan.start[index]) * smooth(progress[index]);
  }
  if (plan.settings.power && plan.settings.technology === 0) {
    for (const index of plan.changed) if (Math.floor(index / DISPLAY.columns) === activeRow) voltages[index] = Math.sign(plan.target[index] - plan.start[index]) * DISPLAY.inkVoltage;
  } else if (plan.settings.power) {
    const sign = plan.settings.reverse ? -1 : 1;
    for (let index = 0; index < DISPLAY.cells; index++) {
      const row = Math.floor(index / DISPLAY.columns), slot = rowSlots.get(row);
      const commanded = slot === undefined || clock + EPS >= slot * DISPLAY.rowSeconds ? plan.target[index] : plan.start[index];
      // Only the two endpoint commands are illustrated. Partially moved oil
      // does not supply a calibrated voltage-to-coverage conversion.
      voltages[index] = commanded < .5 ? sign * DISPLAY.wettingVoltage : 0;
    }
  }
  const requested = displayRequested(plan.settings), selected = plan.changed.find(index => Math.floor(index / DISPLAY.columns) === activeRow) ?? plan.changed.at(-1) ?? 0;
  const voltage = voltages[selected], field = Math.sign(voltage);
  return {clock, complete, pixels, voltages, progress, activeRow, selected, voltage, field, blackForce: field * DISPLAY.blackCharge, whiteForce: field * DISPLAY.whiteCharge,
    changedCells: plan.changed.length, writtenCells: plan.changed.filter(index => Math.abs(pixels[index] - plan.target[index]) < EPS).length,
    requested, matchedCells: pixels.filter((value, index) => Math.abs(value - requested[index]) < EPS).length,
    frontLightOn: Boolean(plan.settings.power && plan.settings.frontlight), visible: Boolean(plan.settings.ambient || plan.settings.power && plan.settings.frontlight),
    holdingInk: plan.settings.technology === 0 && (complete || !plan.settings.power), passiveReturn: plan.passive && !complete,
  };
}

/** State history matters: disconnecting power must not reset an ink image. */
export function createDisplayController(initial = {}) {
  let plan, clock;
  const state = () => ({values: {...plan.settings}, plan, now: displayAt(plan, clock), clock, duration: plan.duration});
  const reset = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected display initial state');
    const next = displayPlan(input.settings ?? {}, input.pixels), time = validTime(input.time ?? 0);
    plan = next; clock = Math.min(time, next.duration); return state();
  };
  const update = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected display settings');
    const next = displaySettings({...plan.settings, ...input}), before = plan.settings;
    if (next.technology !== before.technology) {
      plan = displayPlan(next); clock = 0;
    } else if (next.power !== before.power || next.power && (next.pattern !== before.pattern || next.technology === 0 && next.reverse !== before.reverse)) {
      plan = displayPlan(next, displayAt(plan, clock).pixels); clock = 0;
    } else {
      plan = Object.freeze({...plan, settings: Object.freeze(next)});
    }
    return state();
  };
  const advance = dt => {validTime(dt); clock = Math.min(plan.duration, Number((clock + dt).toFixed(12))); return state();};
  const replayState = () => ({settings: {...plan.settings}, pixels: [...plan.start], time: 0});
  reset(initial);
  return {getState: state, reset, update, advance, replayState};
}

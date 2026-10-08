import {validateControls, validTime} from './physics-kit.js';

export const ADD_DEFAULTS = Object.freeze({first: 25, second: 9, power: 1, ambient: 1});
export const ADD_DOMAINS = Object.freeze({first: Object.freeze([0,99,1]), second: Object.freeze([0,99,1]), power: Object.freeze([0,1,1]), ambient: Object.freeze([0,1,1])});
export const ADD_KEYS = Object.freeze(['7','8','9','4','5','6','1','2','3','+','0','=']);
export const ADD_SEGMENTS = Object.freeze(['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg']);
// These are explanatory scene seconds, not calculator clock or debounce specifications.
export const ADD_TIMING = Object.freeze({lead: .25, row: .12, confirm: .20, release: .12, column: .55, transfer: .25});
const rounded = value => Math.round(value * 1e9) / 1e9;
const freeze = value => {
  if (value && typeof value === 'object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
};
export const additionSettings = (input = {}) => validateControls(input, ADD_DEFAULTS, ADD_DOMAINS, 'calculator');

export function additionSegments(value) {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 198)) throw new RangeError('Invalid display register');
  const text = value === null ? '   ' : String(value).padStart(3, ' ');
  return [...text].map(char => ({digit: char === ' ' ? null : Number(char), bcd: char === ' ' ? null : Number(char).toString(2).padStart(4, '0'), mask: char === ' ' ? '' : ADD_SEGMENTS[Number(char)]}));
}

export function additionReadback(masks) {
  if (!Array.isArray(masks) || masks.length !== 3 || masks.some(mask => typeof mask !== 'string')) throw new RangeError('Invalid segment masks');
  const digits = masks.map(mask => mask === '' ? ' ' : ADD_SEGMENTS.indexOf(mask));
  if (digits.some(digit => digit === -1)) return 'Invalid segments';
  const text = digits.join('');
  if (text === '   ') return 'Blank';
  if (!/^ *\d+$/.test(text)) return 'Invalid segments';
  return text.trim();
}

export function additionPlan(input = {}) {
  const values = additionSettings(input), sequence = [...String(values.first), '+', ...String(values.second), '='];
  const keySeconds = rounded(4 * ADD_TIMING.row + ADD_TIMING.confirm + ADD_TIMING.release);
  const keys = sequence.map((key, index) => {
    const position = ADD_KEYS.indexOf(key), start = rounded(ADD_TIMING.lead + index * keySeconds);
    return {key, row: Math.floor(position / 3), column: position % 3, start, accept: rounded(start + 4 * ADD_TIMING.row + ADD_TIMING.confirm), end: rounded(start + keySeconds)};
  });
  const calculate = rounded(ADD_TIMING.lead + sequence.length * keySeconds);
  return freeze({values, keys, calculate, duration: rounded(calculate + 3 * ADD_TIMING.column + ADD_TIMING.transfer)});
}

export function additionAt(plan, time) {
  const clock = Math.min(validTime(time), plan.duration), {values} = plan, powered = Boolean(values.power);
  const accepted = powered ? plan.keys.filter(key => clock >= key.accept) : [];
  let entry = '', first = null, second = null, enteringSecond = false, displayRegister = powered ? 0 : null;
  for (const {key} of accepted) {
    if (key === '+') {first = Number(entry);entry = '';enteringSecond = true;}
    else if (key === '=') second = Number(entry);
    else {entry += key;displayRegister = Number(entry);}
  }
  const pressed = powered ? plan.keys.find(key => clock >= key.start && clock < key.accept) ?? null : null;
  const activeKey = powered ? plan.keys.find(key => clock >= key.start && clock < key.end) ?? null : null;
  const confirming = Boolean(pressed && rounded(clock - pressed.start) >= 4 * ADD_TIMING.row);
  const scanRow = pressed ? confirming ? pressed.row : Math.min(3, Math.floor((rounded(clock - pressed.start) + 1e-10) / ADD_TIMING.row)) : -1;
  const columnLow = pressed && scanRow === pressed.row ? pressed.column : -1;
  const columns = [];let carry = 0, assembled = 0;
  for (let index = 0; index < 3; index++) {
    const place = 10 ** index, start = rounded(plan.calculate + index * ADD_TIMING.column), end = rounded(start + ADD_TIMING.column);
    const active = powered && clock >= start && clock < end, complete = powered && clock >= end;
    const available = powered && clock >= start && first !== null && second !== null;
    const a = available ? Math.floor(first / place) % 10 : null, b = available ? Math.floor(second / place) % 10 : null;
    const total = complete ? a + b + carry : null, digit = complete ? total % 10 : null, carryOut = complete ? Math.floor(total / 10) : null;
    columns.push({place, a, b, carryIn: available ? carry : null, total, digit, carryOut, active, complete});
    if (complete) {assembled += digit * place;carry = carryOut;}
  }
  const calculated = powered && columns.every(column => column.complete), complete = powered && clock >= plan.duration;
  const written = powered && clock >= plan.duration;
  if (written) displayRegister = assembled;
  const digits = additionSegments(displayRegister), readback = additionReadback(digits.map(digit => digit.mask));
  // Both repeating phases are retained together; scene completion never denotes DC hold.
  const drive = digits.map(digit => Object.fromEntries([...'abcdefg'].map(segment => {
    const on = powered && digit.mask.includes(segment);
    return [segment, {on, common: powered ? [0,1] : [0,0], electrode: powered ? on ? [1,0] : [0,1] : [0,0], difference: on ? [1,-1] : [0,0], mean: 0, rms: on ? 1 : 0}];
  })));
  const stage = !powered ? 'Power off' : written ? 'Result displayed' : calculated ? 'Transfer result to display' : clock >= plan.calculate ? `Add ${columns.find(column => column.active)?.place === 1 ? 'ones' : columns.find(column => column.active)?.place === 10 ? 'tens' : 'hundreds'}` : activeKey ? pressed ? confirming ? 'Confirm stable key' : 'Scan key matrix' : 'Release key' : 'Ready to enter';
  return {clock, stage, complete, written, result: written ? Number(readback) : null, progress: !powered ? 0 : clock / plan.duration,
    entry, enteringSecond, first, second, acceptedKeys: accepted.map(key => key.key), sequence: plan.keys.map(key => key.key), pressed: pressed?.key ?? null, scanRow, columnLow, confirming,
    columns, displayRegister, digits, readback, drive, visible: Boolean(values.ambient), illuminated: Boolean(values.ambient), powered};
}

export function createAdditionController(initial = {}) {
  let plan, clock;
  const state = () => ({values: {...plan.values}, clock, duration: plan.duration, now: additionAt(plan, clock)});
  function reset(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected calculator initial state');
    for (const key of Object.keys(input)) if (!['settings','time'].includes(key)) throw new RangeError(`Unknown initial field ${key}`);
    const next = additionPlan(input.settings === undefined ? {} : input.settings), nextClock = Math.min(validTime(input.time === undefined ? 0 : input.time), next.duration);
    plan = next;clock = next.values.power ? nextClock : 0;return state();
  }
  function update(input = {}) {
    additionSettings(input);
    const values = additionSettings({...plan.values, ...input});
    const restart = ['first','second','power'].some(key => values[key] !== plan.values[key]);
    plan = restart ? additionPlan(values) : freeze({...plan, values});
    if (restart) clock = 0;return state();
  }
  function advance(seconds) {validTime(seconds);if(plan.values.power)clock = Math.min(plan.duration, rounded(clock + seconds));return state();}
  reset(initial);
  return {getState: state, reset, update, advance, replayState: () => ({settings: {...plan.values}, time: 0})};
}

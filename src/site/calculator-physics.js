import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Calculator: a pocket calculator reading its = key through its keypad matrix,
// adding two numbers held as binary coded decimal one bit at a time, decoding
// the answer into seven segments, driving its liquid crystal display, and
// running on a solar cell or a button cell.
//
// Exact within the model: the keypad matrix of ELAN's EMPCD081A calculator
// chip, its polling lines, strobe lines and pull-down resistors, and the
// voltage a held key lifts a strobe line to; a bit serial adder, one full adder
// of the Adder page's gates adding a bit of each digit and the carry in each
// tick, and the Binary-coded decimal page's rule of adding 6 to a digit whose
// sum passes 9, done by a second full adder a bit at a time; the most common
// seven segment patterns of the Seven-segment display page, and E; the chip's
// error display, the high eight digits of a nine digit answer with the point
// where the answer times 10⁻⁸ puts it; the chip's drive of its display from its
// waveform page, three commons at 0, 1.5 and 3 V, and the rms voltages it puts
// across a lit and a dark segment; the chip's frame rates waiting and
// computing; the solar cell's current at 1.5 V, and the button cell's charge
// down to the chip's lowest supply.
//
// Sourced: the EMPCD081A's supply of 1.2 to 1.8 V, its currents of 3.0 μA
// waiting, 13 μA operating and at most 1.0 μA off, its oscillator of 18 kHz
// waiting and 200 kHz operating, frames of 93.8 Hz and 104 Hz, pull-downs of
// 180 kΩ, pull-ups and key contacts of at most 10 kΩ, input thresholds, the
// 3.0 V its voltage doubler makes, and its keypad of 49 keys on lines K0 to
// K10 with = where K8 crosses K5; Panasonic's Amorton AM-1417, 1.5 V at 13.3 μA
// under 200 lx of fluorescent light; Energizer's A76 (LR44), 150 mAh to 0.9 V
// and 80% of its charge used by the time it falls to 1.20 V; the Lux page's
// light levels; AN3407's 2 ms between reads of a key; Infineon's one to four
// checks of a key; the Switch page's bounce over 2.6 ms.
//
// Declared, not from a source: the chip's supply held at 1.5 V; the cell's
// current in proportion to the light, as Panasonic's chart of output against
// illuminance draws it, and the chip running only when the cell covers its
// current, with the sheet's optional 0.47 μF capacitor and the display's own
// current left out; the chip polling one line every 0.25 ms, so every key is
// read each 2 ms, AN3407's interval borrowed for a chip whose sheet gives no
// scan timing; the press landing at the start of a scan and the key held down
// to the end; the key's contact springing open four times, at fixed shares of
// the bounce time; the adder's teaching clock of 1 kHz, inside the few hundred
// hertz to kilohertz the Calculator page gives for basic calculators, where
// the sheet's oscillator runs at 200 kHz; the adder starting the moment the
// key is accepted and running once however many presses were read; four bits
// and a correction of four bits for every digit; which segment sits on which
// common; the display holding the entry until the answer is ready; and the
// LR44's capacity at a drain far below its 7.5 kΩ test.
// ---------------------------------------------------------------------------

/** ELAN Microelectronics EMPCD081A, Product Specification V0.3 (09.15.2004): values at VDD = 1.5 V and 25 °C as [min, typ, max] or [typ, max]. SI units. */
export const CHIP = Object.freeze({
  name: 'EMPCD081A', digits: 8, supply: Object.freeze([1.2, 1.5, 1.8]),
  wait: Object.freeze({oscillator: Object.freeze([10.8e3, 18e3, 25.2e3]), frame: Object.freeze([56.3, 93.8, 131.3]), current: Object.freeze([3.0e-6, 4.5e-6])}),
  operate: Object.freeze({oscillator: Object.freeze([120e3, 200e3, 280e3]), frame: Object.freeze([62.5, 104, 145.6]), current: Object.freeze([13e-6, 20e-6])}),
  off: 1.0e-6, pullDown: Object.freeze([100e3, 180e3, 650e3]), pullUp: 10e3, contact: 10e3, margin: 0.4, low: 0.4, doubler: 3.0, commons: 3,
  polling: Object.freeze([0, 7]), strobe: Object.freeze([3, 10]), equals: Object.freeze({poll: 5, strobe: 8}),
});

/** Panasonic Amorton AM-1417 under fluorescent light of 200 lx at 25 °C: open circuit V, short circuit A, operating V and A, size mm, mass g; and the glass cells' 0.63 V each. */
export const CELL = Object.freeze({model: 'AM-1417', lux: 200, open: 2.5, short: 14.1e-6, volts: 1.5, current: 13.3e-6, size: Object.freeze([35.0, 13.9, 1.1]), mass: 1.3, perCell: 0.63, indoor: Object.freeze([50, 1000])});

/** Energizer A76 (IEC LR44): nominal V, capacity Ah to 0.9 V on a 7.5 kΩ test load, depth of discharge against closed circuit V, diameter and height mm, mass g. */
export const BATTERY = Object.freeze({model: 'A76', iec: 'LR44', nominal: 1.5, capacity: 150e-3, cutoff: 0.9, test: 7500, depth: Object.freeze([Object.freeze([0, 1.55]), Object.freeze([0.4, 1.33]), Object.freeze([0.8, 1.20])]), size: Object.freeze([11.6, 5.4]), mass: 2.4});

/** The Lux page: a family living room, an office hallway, a very dark overcast day, office lighting and an overcast day. */
export const LUX = Object.freeze({living: 50, hallway: 80, dark: 100, office: Object.freeze([320, 500]), overcast: 1000});

/** The Seven-segment display page's most common patterns for 0 to 9, and E from its hexadecimal patterns. */
export const PATTERNS = Object.freeze(['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']);
export const ERROR_PATTERN = 'adefg';
export const LETTERS = 'abcdefg';

/** The byte that lights a pattern in the page's gfedcba order: segment a is bit 0. */
export const byteOf = pattern => [...pattern].reduce((sum, letter) => sum | (1 << LETTERS.indexOf(letter)), 0);

/** Declared scan: seconds each polling line is driven, lines, where in its slot a line is read, the shares of the bounce time the contact springs open in percent (all even, so a read at an odd microsecond never lands on an edge), the scan chart's span, and the sourced 2 ms, one to four checks and 2.6 ms of bounce. */
export const SCAN = Object.freeze({poll: 0.25e-3, lines: 8, readAt: 0.5, open: Object.freeze([Object.freeze([10, 30]), Object.freeze([44, 60]), Object.freeze([72, 84]), Object.freeze([92, 100])]), window: 20e-3, interval: 2e-3, checks: Object.freeze([1, 4]), bounce: 2.6e-3});

/** Declared: the adder's teaching clock in seconds a tick, ticks a digit, and how many times slower the model runs than the chip; and which segments sit on each of the three segment lines, against commons 1 to 3 (p is the point and k the thousands comma, never lit here). */
export const ADDER = Object.freeze({tick: 1e-3, perDigit: 8, slow: 100});
export const LAYOUT = Object.freeze([Object.freeze(['f', 'g', 'e']), Object.freeze(['a', 'b', 'c']), Object.freeze(['p', 'd', 'k'])]);

export const SOURCE_OPTIONS = Object.freeze([{value: 0, label: 'Solar cell'}, {value: 1, label: 'Button cell'}].map(Object.freeze));
export const CALC_DEFAULTS = Object.freeze({first: 25, second: 9, bounce: 2.6, debounce: 4, light: 320, source: 0});
export const CALC_DOMAINS = Object.freeze({first: Object.freeze([0, 99999999, 1]), second: Object.freeze([0, 99999999, 1]), bounce: Object.freeze([0, 10, 0.1]), debounce: Object.freeze([1, 4, 1]), light: Object.freeze([0, 1000, 5]), source: Object.freeze([0, 1, 1])});

/** Microseconds from the press to the k-th read of the = key: the middle of its polling line's slot in the k-th scan. */
export const readMicro = k => Math.round((k * SCAN.lines + CHIP.equals.poll + SCAN.readAt) * SCAN.poll * 1e6);

/** Whether the = key's contact is closed `micro` microseconds after the press, for a bounce time in microseconds. */
export function contactClosed(micro, bounceMicro) {
  if (!(micro > 0)) return false;
  return !SCAN.open.some(([from, to]) => micro >= from * bounceMicro / 100 && micro < to * bounceMicro / 100);
}

/** Whether a key sits where strobe line K`strobe` crosses polling line K`poll`: a strobe line crosses only the polling lines that start above it. */
export const keyAt = (strobe, poll) => strobe >= CHIP.strobe[0] && strobe <= CHIP.strobe[1] && poll >= CHIP.polling[0] && poll <= CHIP.polling[1] && strobe > poll;
export const KEYS = Object.freeze(Array.from({length: CHIP.strobe[1] - CHIP.strobe[0] + 1}, (_, i) => CHIP.strobe[0] + i).flatMap(strobe => Array.from({length: CHIP.polling[1] + 1}, (_, poll) => poll).filter(poll => keyAt(strobe, poll)).map(poll => Object.freeze({strobe, poll}))));

/** The voltage a held key lifts its strobe line to while its polling line is driven: the supply across the driver, the contact and the pull-down in series. */
export const strobeVolts = (vdd, pullDown, pullUp = CHIP.pullUp, contact = CHIP.contact) => vdd * pullDown / (pullDown + pullUp + contact);

/** The cell's current at 1.5 V in proportion to the light, and the light a current needs. */
export const cellCurrent = lux => CELL.current * lux / CELL.lux;
export const luxFor = current => CELL.lux * current / CELL.current;

/** An integer's eight digits, least significant first; a digit's four bits, the 1 bit first; and a number's digits as groups of four bits, most significant first. */
export const digitsOf = value => Array.from({length: CHIP.digits}, (_, k) => Math.floor(value / 10 ** k) % 10);
export const bitsOf = digit => [0, 1, 2, 3].map(j => (digit >> j) & 1);
export const bcdText = value => [...String(value)].map(digit => bitsOf(Number(digit)).reverse().join('')).join(' ');

/** One tick of a full adder: the Adder page's two XOR gates, two AND gates and an OR gate. */
export function fullAdder(a, b, carry) {
  const x = a ^ b, and1 = a & b, and2 = carry & x;
  return {a, b, carry, x, and1, and2, sum: x ^ carry, out: and1 | and2};
}

/**
 * The bit serial addition, tick by tick: for each digit from the right, four
 * ticks add a bit of X, a bit of Y and the carry into a four-bit buffer, and
 * four more add 0110 to the buffer if the digit's five-bit sum passed 9, or
 * 0000 if not, with the second adder's own carry. The digit then goes into X
 * and its decimal carry into the next digit.
 */
export function addSerially(x, y) {
  const xDigits = digitsOf(x), yDigits = digitsOf(y), ticks = [], digits = [];
  let carry = 0;
  for (let k = 0; k < CHIP.digits; k++) {
    const carryIn = carry, buffer = [0, 0, 0, 0], xBits = bitsOf(xDigits[k]), yBits = bitsOf(yDigits[k]);
    for (let j = 0; j < 4; j++) {
      const gate = fullAdder(xBits[j], yBits[j], carry);
      buffer[j] = gate.sum;
      carry = gate.out;
      ticks.push({index: ticks.length, digit: k, bit: j, stage: 0, ...gate, buffer: [...buffer], carryAfter: carry});
    }
    const binary = buffer.reduce((sum, bit, j) => sum + (bit << j), 0), c4 = carry, decimal = c4 === 1 || binary > 9 ? 1 : 0, correction = bitsOf(decimal ? 6 : 0);
    let second = 0;
    for (let j = 0; j < 4; j++) {
      const gate = fullAdder(buffer[j], correction[j], second);
      buffer[j] = gate.sum;
      second = gate.out;
      ticks.push({index: ticks.length, digit: k, bit: j, stage: 1, ...gate, buffer: [...buffer], carryAfter: second});
    }
    carry = decimal;
    digits.push({digit: k, x: xDigits[k], y: yDigits[k], carryIn, binary, c4, five: 16 * c4 + binary, decimal, correction: decimal ? 6 : 0, result: buffer.reduce((sum, bit, j) => sum + (bit << j), 0)});
  }
  return {ticks, digits, xDigits, yDigits, ninth: carry, low: digits.reduce((sum, item, k) => sum + item.result * 10 ** k, 0)};
}

const blankDigit = Object.freeze({digit: null, bits: Object.freeze([0, 0, 0, 0]), segments: '', point: false});
/** The display with nothing driven. */
export const BLANK = Object.freeze({value: null, overflow: false, shown: null, digits: Object.freeze(Array(CHIP.digits).fill(blankDigit)), sign: '', text: ''});

/**
 * What the display shows for a value: a sign digit and eight digits from the
 * left, each with its digit or null for a blank, its four bits and its lit
 * segments. Leading zeros are blank. A nine digit answer is an error: E in the
 * sign digit and the high eight digits, the point after the first.
 */
export function screenOf(value) {
  const overflow = value >= 10 ** CHIP.digits, shown = overflow ? Math.floor(value / 10) : value, text = String(shown);
  const digits = Array.from({length: CHIP.digits}, (_, i) => {
    const place = CHIP.digits - 1 - i, digit = Math.floor(shown / 10 ** place) % 10, blank = !overflow && place >= text.length;
    return {digit: blank ? null : digit, bits: bitsOf(digit), segments: blank ? '' : PATTERNS[digit], point: overflow && i === 0};
  });
  return {value, overflow, shown, digits, sign: overflow ? ERROR_PATTERN : '', text: overflow ? `E ${text[0]}.${text.slice(1)}` : text};
}

/** The display's three commons and three segment lines in one slot of two frames, for a digit's lit segments: V. */
export function driveLevels(segments, slot) {
  const high = Math.floor(slot / CHIP.commons) % 2 === 0, common = slot % CHIP.commons, mid = CHIP.supply[1], top = CHIP.doubler;
  return {
    commons: Array.from({length: CHIP.commons}, (_, c) => (c === common ? (high ? top : 0) : mid)),
    lines: LAYOUT.map(elements => (high === segments.includes(elements[common]) ? 0 : top)),
  };
}

const plans = new Map();

/** Everything about the press, the addition, the display and the power that does not change as the clock runs. */
export function calculatorPlan(input = {}) {
  const values = validateControls(input, CALC_DEFAULTS, CALC_DOMAINS, 'calculator');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const {first, second, debounce, light, source} = values, bounceMicro = Math.round(values.bounce * 1000);

  // The power: the button cell always covers the chip; the solar cell only as far as the light allows.
  const wait = CHIP.wait.current[0], operate = CHIP.operate.current[0], current = cellCurrent(light);
  const state = source === 1 || current >= operate ? 'operate' : current >= wait ? 'wait' : 'off';
  const usable = BATTERY.capacity * BATTERY.depth.find(([, volts]) => volts === CHIP.supply[0])[0];
  const power = {
    state, current, short: CELL.short * light / CELL.lux, waitLux: luxFor(wait), operateLux: luxFor(operate), waitCeiling: CELL.lux * wait / CELL.short, operateCeiling: CELL.lux * operate / CELL.short,
    cells: Math.round(CELL.open / CELL.perCell), usable, waitHours: usable / wait, operateHours: usable / operate, offHours: usable / CHIP.off, years: usable / wait / (24 * 365.25),
  };

  // The scan: reads of the = key, the debounced state flipping after `debounce` agreeing reads, until the contact has settled and the key reads down.
  const reads = [], registrations = [];
  let down = false, count = 0, end = null;
  for (let k = 0; end === null; k++) {
    const micro = readMicro(k), closed = contactClosed(micro, bounceMicro);
    count = closed !== down ? count + 1 : 0;
    let flipped = false;
    if (count >= debounce) { down = closed; count = 0; flipped = true; if (down) registrations.push(micro); }
    reads.push({k, micro, closed, count, down, flipped});
    if (micro >= bounceMicro && down) end = micro;
  }
  const runs = state !== 'off', adds = state === 'operate';

  // The addition: Y holds the first number, X the second, and the answer goes back into X.
  const serial = addSerially(second, first), sum = first + second, addEnd = end + ADDER.tick * 1e6 * serial.ticks.length;
  const plan = {
    values, first, second, sum, power, runs, adds,
    bounceMicro, reads, registrations, accepted: registrations[0], scanEnd: end,
    serial, before: runs ? screenOf(second) : BLANK, after: runs ? screenOf(adds ? sum : second) : BLANK, answer: screenOf(sum),
    addStart: end, addEnd, duration: addEnd / 1e6,
    strobe: {typical: strobeVolts(CHIP.supply[1], CHIP.pullDown[1]), worst: strobeVolts(CHIP.supply[0], CHIP.pullDown[0]), need: CHIP.supply[1] - CHIP.margin, needWorst: CHIP.supply[0] - CHIP.margin},
    rms: {on: Math.sqrt((CHIP.doubler ** 2 + 2 * (CHIP.doubler - CHIP.supply[1]) ** 2) / 3), off: Math.sqrt(2 * (CHIP.doubler - CHIP.supply[1]) ** 2 / 3)},
  };
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** Frames the display has been refreshed by `t` seconds: at the wait clock's rate, and the fast clock's while the adder runs. */
export function framesAt(plan, t) {
  if (!plan.runs) return 0;
  const slow = CHIP.wait.frame[1], fast = CHIP.operate.frame[1];
  if (!plan.adds) return slow * t;
  const a = plan.addStart / 1e6, b = plan.addEnd / 1e6;
  return slow * Math.min(t, a) + fast * Math.max(0, Math.min(t, b) - a) + slow * Math.max(0, t - b);
}

/** The calculator `time` seconds after the = key is pressed. */
export function calculatorAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), micro = t * 1e6, {runs, adds, serial} = plan, total = serial.ticks.length;
  const pressed = micro > 0, polled = runs && pressed ? Math.floor(micro / (SCAN.poll * 1e6) + 1e-9) % SCAN.lines : null;
  const reads = runs ? plan.reads.filter(read => read.micro <= micro + 1e-6) : [], last = reads.at(-1) ?? null;
  const registered = runs ? plan.registrations.filter(at => at <= micro + 1e-6).length : 0;
  const ticksDone = adds ? Math.max(0, Math.min(total, Math.floor((micro - plan.addStart) / (ADDER.tick * 1e6) + 1e-9))) : 0;
  const adding = adds && micro >= plan.addStart && ticksDone < total;
  const tick = adding ? serial.ticks[ticksDone] : null, digitsDone = Math.floor(ticksDone / ADDER.perDigit), inDigit = ticksDone % ADDER.perDigit;
  const digit = digitsDone < CHIP.digits ? serial.digits[digitsDone] : null;
  const x = serial.xDigits.map((value, k) => (k < digitsDone ? serial.digits[k].result : value));
  // The buffer, the adders' carries and the correction as the last finished tick left them.
  const buffer = inDigit > 0 ? [...serial.ticks[ticksDone - 1].buffer] : [0, 0, 0, 0];
  const carry = ticksDone === 0 ? 0 : inDigit === 0 ? serial.digits[digitsDone - 1].decimal : inDigit <= 4 ? serial.ticks[ticksDone - 1].carryAfter : digit.c4;
  const second = inDigit > 4 ? serial.ticks[ticksDone - 1].carryAfter : 0;
  const frames = framesAt(plan, t);
  return {
    time, t, micro, pressed, polled, closed: contactClosed(micro, plan.bounceMicro), reads, last, down: last ? last.down : false, registered,
    ticksDone, adding, tick, digitsDone, inDigit, x, buffer, carry, second, decided: inDigit >= 4 ? digit.decimal : null,
    screen: adds && ticksDone === total ? plan.after : plan.before, frames, slot: runs ? Math.floor(frames * CHIP.commons + 1e-9) % (2 * CHIP.commons) : null, done: time >= plan.duration,
  };
}

export const sampleCalculator = (input = {}, time = 0) => calculatorAt(calculatorPlan(input), time);

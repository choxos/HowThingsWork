// Checks the calculator model and its lesson against their sources typed in
// again and the arithmetic done another way: every full adder tick against a
// truth table typed from the Adder page, every sum against schoolbook decimal
// addition on strings and plain integer arithmetic, the = key's reads found
// again by stepping through the scan a microsecond at a time, the key's
// voltage by balancing the currents at its strobe line, the light the chip
// needs by bisection, the button cell's life by counting its charge, the
// display's rms voltages by summing its drive waveforms, and every drawn
// segment, cell, gate, wire, trace and marker read back at swept settings and
// times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './calculator-physics.js';
import * as M from './calculator-model.js';
import * as L from './calculator-lessons.js';
import {studyLessons} from './study-lessons.js';
import {createStudyModel} from './study-models.js';

const t = tally();
const counts = {pairs: 0, ticks: 0, micro: 0, poses: 0, cells: 0, gates: 0, points: 0, numbers: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const close = (a, b, tolerance = 1e-12) => Math.abs(a - b) <= tolerance;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the arithmetic done another way.
// ---------------------------------------------------------------------------

const SRC = {
  // ELAN EMPCD081A product specification: V, kHz, Hz, μA, kΩ.
  chip: {supply: [1.2, 1.5, 1.8], wait: {osc: [10.8, 18, 25.2], frame: [56.3, 93.8, 131.3], current: [3.0, 4.5]}, operate: {osc: [120, 200, 280], frame: [62.5, 104, 145.6], current: [13, 20]}, off: 1.0, pullDown: [100, 180, 650], pullUp: 10, contact: 10, margin: 0.4, low: 0.4, doubler: 3.0, digits: 8, keys: 49},
  // Panasonic Amorton AM-1417 at 200 lx: V, μA, mm, g.
  cell: {lux: 200, open: 2.5, short: 14.1, volts: 1.5, current: 13.3, size: [35.0, 13.9, 1.1], mass: 1.3, perCell: 0.63},
  // Energizer A76: mAh, V, kΩ, % used against V, mm, g.
  battery: {capacity: 150, cutoff: 0.9, test: 7.5, depth: [[0, 1.55], [40, 1.33], [80, 1.20]], size: [11.6, 5.4], mass: 2.4},
  lux: {living: 50, hallway: 80, dark: 100, office: [320, 500], overcast: 1000},
  switchBounce: 2.6, readInterval: 2, checks: [1, 4],
  // The Seven-segment display page's most common patterns and its E, and the same in gfedcba bytes.
  segments: {0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', E: 'adefg'},
  bytes: {0: 0x3F, 1: 0x06, 2: 0x5B, 3: 0x4F, 4: 0x66, 5: 0x6D, 6: 0x7D, 7: 0x07, 8: 0x7F, 9: 0x6F, E: 0x79},
  // The Binary-coded decimal page's 9 + 8, the HP-35's 56 bit numbers, and the Calculator page's 25 + 9.
  bcd: {nine: '1001', eight: '1000', sum: '10001', six: '0110', result: '0001 0111'},
  hp35: {model: 35, bits: 56},
  example: [25, 9, 34],
};

const same = (actual, expected, scale, message) => { assert.equal(actual.length, expected.length, message); actual.forEach((value, i) => t.near(value, expected[i] * scale, Math.abs(expected[i] * scale) * 1e-12, message)); };
const C = P.CHIP;
same(C.supply, SRC.chip.supply, 1, 'supply');
same(C.wait.oscillator, SRC.chip.wait.osc, 1e3, 'oscillator waiting');
same(C.wait.frame, SRC.chip.wait.frame, 1, 'frames waiting');
same(C.wait.current, SRC.chip.wait.current, 1e-6, 'current waiting');
same(C.operate.oscillator, SRC.chip.operate.osc, 1e3, 'oscillator working');
same(C.operate.frame, SRC.chip.operate.frame, 1, 'frames working');
same(C.operate.current, SRC.chip.operate.current, 1e-6, 'current working');
same(C.pullDown, SRC.chip.pullDown, 1e3, 'pull-downs');
same([C.off, C.pullUp, C.contact, C.margin, C.low, C.doubler], [SRC.chip.off * 1e-6, SRC.chip.pullUp * 1e3, SRC.chip.contact * 1e3, SRC.chip.margin, SRC.chip.low, SRC.chip.doubler], 1, 'off current, pull-up, contact, input thresholds and doubler');
t.ok(C.name === 'EMPCD081A' && C.digits === SRC.chip.digits && C.polling.join() === '0,7' && C.strobe.join() === '3,10' && C.equals.poll === 5 && C.equals.strobe === 8 && C.commons === 3, 'an 8-digit chip polling K0 to K7 and strobing K3 to K10, = at K8 and K5, three commons');
const staircase = Array.from({length: 8}, (_, i) => Math.min(3 + i, 8)).reduce((a, b) => a + b, 0);
t.ok(staircase === SRC.chip.keys && P.KEYS.length === SRC.chip.keys && new Set(P.KEYS.map(key => `${key.strobe}:${key.poll}`)).size === SRC.chip.keys, '49 keys: 3 + 4 + 5 + 6 + 7 + 8 + 8 + 8');
t.ok(P.KEYS.some(key => key.strobe === 8 && key.poll === 5) && P.KEYS.every(key => key.strobe > key.poll && key.poll <= 7 && key.strobe >= 3 && key.strobe <= 10), '= among them, each key on a polling line that starts above its strobe line');

const E = P.CELL, B = P.BATTERY;
t.ok(E.model === 'AM-1417' && E.lux === SRC.cell.lux && E.open === SRC.cell.open && close(E.short, SRC.cell.short * 1e-6, 1e-18) && E.volts === SRC.cell.volts && close(E.current, SRC.cell.current * 1e-6, 1e-18) && E.size.join() === SRC.cell.size.join() && E.mass === SRC.cell.mass && E.perCell === SRC.cell.perCell, 'the AM-1417 as Panasonic lists it');
t.ok(B.iec === 'LR44' && B.model === 'A76' && close(B.capacity, SRC.battery.capacity * 1e-3, 1e-15) && B.cutoff === SRC.battery.cutoff && B.test === SRC.battery.test * 1000 && B.size.join() === SRC.battery.size.join() && B.mass === SRC.battery.mass && B.depth.map(([used, volts]) => `${Math.round(used * 100)}:${volts}`).join() === SRC.battery.depth.map(([used, volts]) => `${used}:${volts}`).join(), 'the A76 as Energizer lists it');
assert.deepEqual(JSON.parse(JSON.stringify(P.LUX)), SRC.lux);
t.ok(SRC.lux.office[0] === P.CALC_DEFAULTS.light, 'the room starts at the low end of office lighting');

for (const [label, pattern] of Object.entries(SRC.segments)) {
  t.ok((label === 'E' ? P.ERROR_PATTERN : P.PATTERNS[Number(label)]) === pattern, `${label} lights ${pattern}`);
  const byte = [...'gfedcba'].reduce((value, letter) => 2 * value + (pattern.includes(letter) ? 1 : 0), 0);
  t.ok(byte === SRC.bytes[label] && P.byteOf(pattern) === byte, `${label} is byte ${byte} in gfedcba order`);
}
t.ok(SRC.bytes[1] === 0x06 && SRC.segments[1] === 'bc', 'the page’s own example: 0x06 lights b and c, a 1');

t.ok(close(P.SCAN.interval * 1000, SRC.readInterval) && close(P.SCAN.poll * P.SCAN.lines, P.SCAN.interval) && close(P.SCAN.bounce * 1000, SRC.switchBounce) && P.CALC_DEFAULTS.bounce === SRC.switchBounce && P.SCAN.checks.join() === SRC.checks.join() && P.CALC_DOMAINS.debounce.slice(0, 2).join() === SRC.checks.join(), 'a read every 2 ms from 8 lines of 0.25 ms, the Switch page’s 2.6 ms of bounce, and one to four checks');
t.ok(P.SCAN.open.every(([from, to]) => from % 2 === 0 && to % 2 === 0 && from < to) && P.SCAN.open.every(([from], i) => i === 0 || from > P.SCAN.open[i - 1][1]) && P.SCAN.open.at(-1)[1] === 100, 'the contact springs open four times in order, the last opening ending with the bounce');
t.ok(1 / P.ADDER.tick === 1000 && P.ADDER.tick > 1 / C.operate.oscillator[1] && P.ADDER.slow === 100 && P.ADDER.perDigit === 8, 'a teaching clock of 1 kHz, slower than the chip’s own, 8 ticks a digit, drawn 100 times slower');
t.ok([...P.LAYOUT.flat()].sort().join('') === 'abcdefgkp', 'every segment of a digit on one segment line against one common');
assert.deepEqual(P.LAYOUT.map(line => line.join('')), ['fge', 'abc', 'pdk']);
assert.deepEqual(JSON.parse(JSON.stringify(P.CALC_DOMAINS)), {first: [0, 99999999, 1], second: [0, 99999999, 1], bounce: [0, 10, 0.1], debounce: [1, 4, 1], light: [0, 1000, 5], source: [0, 1, 1]});
assert.deepEqual(JSON.parse(JSON.stringify(P.CALC_DEFAULTS)), {first: 25, second: 9, bounce: 2.6, debounce: 4, light: 320, source: 0});
t.ok(!P.contactClosed(0, 2600) && !P.contactClosed(0, 0) && P.contactClosed(1, 2600) && !P.contactClosed(300, 2600), 'the contact is open until the key is pressed, closed the moment it is, and open while it bounces');
t.add(3);

// The full adder against a truth table typed from the Adder page.
const TRUTH = [[0, 0, 0, 0, 0], [0, 0, 1, 1, 0], [0, 1, 0, 1, 0], [0, 1, 1, 0, 1], [1, 0, 0, 1, 0], [1, 0, 1, 0, 1], [1, 1, 0, 0, 1], [1, 1, 1, 1, 1]];
const truth = (a, b, c) => TRUTH.find(row => row[0] === a && row[1] === b && row[2] === c);
for (const [a, b, c, s, out] of TRUTH) {
  const gate = P.fullAdder(a, b, c);
  t.ok(gate.sum === s && gate.out === out && 2 * out + s === a + b + c && gate.x === (a + b) % 2 && gate.and1 === a * b && gate.and2 === c * ((a + b) % 2), `full adder ${a}${b}${c}: the sum equals 2 Cout + S`);
}

// Every sum by schoolbook decimal addition on strings, by integers, and tick by tick against the truth table.
const schoolbook = (x, y) => {
  const a = String(x).padStart(9, '0'), b = String(y).padStart(9, '0');
  let carry = 0, out = '';
  for (let i = 8; i >= 0; i--) { const s = Number(a[i]) + Number(b[i]) + carry; out = String(s % 10) + out; carry = s > 9 ? 1 : 0; }
  return out;
};
function checkSum(first, second) {
  const serial = P.addSerially(second, first), digits = schoolbook(first, second), sum = first + second;
  counts.pairs++;
  t.ok(serial.low + serial.ninth * 1e8 === sum && Number(digits) === sum && BigInt(first) + BigInt(second) === BigInt(sum) && serial.ticks.length === 64, `${first} + ${second}`);
  let carry = 0;
  for (let k = 0; k < 8; k++) {
    const xk = Math.floor(second / 10 ** k) % 10, yk = Math.floor(first / 10 ** k) % 10, whole = xk + yk + carry, digit = serial.digits[k];
    let c = carry, bits = 0;
    serial.ticks.slice(8 * k, 8 * k + 4).forEach((tick, j) => {
      const [a, b] = [(xk >> j) & 1, (yk >> j) & 1], [, , , s, out] = truth(a, b, c);
      assert.ok(tick.a === a && tick.b === b && tick.carry === c && tick.sum === s && tick.out === out && tick.stage === 0 && tick.digit === k && tick.bit === j && tick.carryAfter === out, `${first} + ${second}: digit ${k} bit ${j}`);
      bits += s << j;
      c = out;
      assert.equal(tick.buffer.reduce((value, bit, i) => value + (bit << i), 0), bits);
      counts.ticks++;
    });
    assert.ok(bits === whole % 16 && c === whole >> 4, 'four ticks leave the low four bits of the digits’ sum and its fifth bit');
    const correction = whole > 9 ? 6 : 0;
    let c2 = 0, value = bits;
    serial.ticks.slice(8 * k + 4, 8 * k + 8).forEach((tick, j) => {
      const [a, b] = [(value >> j) & 1, (correction >> j) & 1], [, , , s, out] = truth(a, b, c2);
      assert.ok(tick.a === a && tick.b === b && tick.carry === c2 && tick.sum === s && tick.out === out && tick.stage === 1 && tick.digit === k && tick.bit === j, `${first} + ${second}: correcting digit ${k} bit ${j}`);
      value = (value & ~(1 << j)) | (s << j);
      c2 = out;
      counts.ticks++;
    });
    assert.ok(value === (bits + correction) % 16 && digit.result === Number(digits[8 - k]) && digit.five === whole && digit.binary === bits && digit.c4 === whole >> 4 && digit.decimal === (whole > 9 ? 1 : 0) && digit.correction === correction && digit.carryIn === carry, `${first} + ${second}: digit ${k}`);
    const low = 10 ** (k + 1), next = Math.floor((first % low + second % low) / low);
    assert.equal(digit.decimal, next, 'the carry out of a digit is the carry of adding the low digits as integers');
    carry = next;
  }
  assert.equal(serial.ninth, Number(digits[0]));
  t.add(9);
}
for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) checkSum(x, y);
let seed = 20260915;
const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
for (let i = 0; i < 2000; i++) checkSum(Math.floor(random() * 1e8), Math.floor(random() * 1e8));
for (const [a, b] of [[99999999, 1], [50000000, 50000000], [99999999, 99999999], [0, 0], [12345678, 87654321], [25, 9], [9, 8], [99999999, 0]]) checkSum(a, b);
{
  const nine = P.addSerially(8, 9).digits[0], bin4 = n => n.toString(2).padStart(4, '0');
  t.ok(bin4(9) === SRC.bcd.nine && bin4(8) === SRC.bcd.eight && `${nine.c4}${bin4(nine.binary)}` === SRC.bcd.sum && bin4(nine.correction) === SRC.bcd.six && P.bcdText(17) === SRC.bcd.result && nine.result === 7, 'the Binary-coded decimal page’s 9 + 8: 10001, plus 0110, is 0001 0111');
  t.ok(P.calculatorPlan({first: SRC.example[0], second: SRC.example[1]}).after.text === String(SRC.example[2]), 'the Calculator page’s 25 + 9 = 34');
}

// The display, by slicing strings.
for (const value of [0, 7, 34, 17, 100, 12345678, 99999999, 100000000, 199999998, 123456789, 187654320]) {
  const screen = P.screenOf(value), text = String(value);
  if (value < 1e8) {
    const padded = text.padStart(8, ' ');
    t.ok(screen.text === text && !screen.overflow && screen.sign === '' && screen.digits.every((item, i) => (padded[i] === ' ' ? item.digit === null && item.segments === '' : item.digit === Number(padded[i]) && item.segments === SRC.segments[padded[i]]) && !item.point), `${value} shown as it is, leading zeros blank`);
  } else {
    const high = text.slice(0, 8), point = (value * 1e-8).toFixed(8).slice(0, 9);
    t.ok(screen.overflow && screen.sign === SRC.segments.E && screen.text === `E ${point}` && point === `${high[0]}.${high.slice(1)}` && screen.digits.every((item, i) => item.digit === Number(high[i]) && item.point === (i === 0)), `${value}: E and the high 8 digits, the point where 10⁻⁸ times the answer puts it`);
  }
}
t.ok(P.BLANK.digits.length === 8 && P.BLANK.digits.every(item => item.digit === null && item.segments === '') && P.BLANK.sign === '', 'a blank display');

// The = key's reads, stepping through the scan a microsecond at a time.
const OPEN = [[0.10, 0.30], [0.44, 0.60], [0.72, 0.84], [0.92, 1.00]];
const contactAt = (micro, bounceMicro) => micro > 0 && !OPEN.some(([a, b]) => micro >= a * bounceMicro && micro < b * bounceMicro);
function simulateScan(bounce, need) {
  const bounceMicro = Math.round(bounce * 1000), history = [], registrations = [], reads = [], flips = [];
  let down = false;
  for (let micro = 1; micro <= 40000; micro++) {
    counts.micro++;
    // Line K(n) is driven through the n-th quarter millisecond of every 2 ms; = is read in the middle of K5's.
    if (Math.floor(micro / 250) % 8 !== 5 || micro % 250 !== 125) continue;
    const closed = contactAt(micro, bounceMicro);
    reads.push({micro, closed});
    history.push(closed);
    if (history.length >= need && history.slice(-need).every(value => value !== down)) { down = !down; history.length = 0; flips.push({micro, down}); if (down) registrations.push(micro); }
    if (micro >= bounceMicro && down) return {registrations, end: micro, reads, flips};
  }
  return null;
}
for (let b10 = 0; b10 <= 100; b10++) {
  for (let need = 1; need <= 4; need++) {
    const plan = P.calculatorPlan({bounce: b10 / 10, debounce: need}), sim = simulateScan(b10 / 10, need);
    t.ok(sim && sim.end === plan.scanEnd && sim.registrations.join() === plan.registrations.join() && sim.reads.length === plan.reads.length && sim.reads.every((read, i) => read.micro === plan.reads[i].micro && read.closed === plan.reads[i].closed), `bounce ${b10 / 10} ms with ${need} reads: every read and press found again`);
    t.ok(plan.scanEnd <= P.SCAN.window * 1e6 && plan.registrations.length >= 1 && plan.registrations.length <= 2 && plan.accepted === plan.registrations[0], 'the chart holds the whole press');
  }
}

// A held key's voltage, by balancing the currents at the strobe line.
const node = (vdd, down, up = SRC.chip.pullUp * 1e3, contact = SRC.chip.contact * 1e3) => { let lo = 0, hi = vdd; for (let i = 0; i < 200; i++) { const v = (lo + hi) / 2; if ((vdd - v) / (up + contact) > v / down) lo = v; else hi = v; } return (lo + hi) / 2; };
const plan0 = P.calculatorPlan({});
t.near(plan0.strobe.typical, node(1.5, 180e3), 1e-12, 'a held key lifts K8 to where the currents balance');
t.near(plan0.strobe.worst, node(1.2, 100e3), 1e-12, 'and at the lowest supply and pull-down');
t.ok(close(plan0.strobe.need, 1.5 - SRC.chip.margin) && close(plan0.strobe.needWorst, 1.2 - SRC.chip.margin), 'a 1 needs the supply less 0.4 V');
for (const vdd of SRC.chip.supply) for (const down of SRC.chip.pullDown) t.ok(node(vdd, down * 1e3) > vdd - SRC.chip.margin, `read as a 1 at ${vdd} V and ${down} kΩ`);

// The light the chip needs, by bisection along the cell's line through Panasonic's point.
const bisect = (f, lo, hi) => { for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };
const cellAt = lux => SRC.cell.current * 1e-6 * lux / SRC.cell.lux, shortAt = lux => SRC.cell.short * 1e-6 * lux / SRC.cell.lux;
const waitLux = bisect(lux => cellAt(lux) - SRC.chip.wait.current[0] * 1e-6, 0, 1000), operateLux = bisect(lux => cellAt(lux) - SRC.chip.operate.current[0] * 1e-6, 0, 1000);
t.near(plan0.power.waitLux, waitLux, 1e-9, 'the light to wait');
t.near(plan0.power.operateLux, operateLux, 1e-9, 'the light to add');
t.near(plan0.power.waitCeiling, bisect(lux => shortAt(lux) - 3e-6, 0, 1000), 1e-9, 'the least light to wait, even shorted');
t.near(plan0.power.operateCeiling, bisect(lux => shortAt(lux) - 13e-6, 0, 1000), 1e-9, 'the least light to add, even shorted');
for (let lux = 0; lux <= 1000; lux += 5) {
  const plan = P.calculatorPlan({light: lux});
  t.ok(plan.power.state === (lux >= operateLux ? 'operate' : lux >= waitLux ? 'wait' : 'off') && close(plan.power.current, cellAt(lux), 1e-15) && P.calculatorPlan({light: lux, source: 1}).power.state === 'operate', `${lux} lx`);
}
t.ok(Math.round(SRC.cell.open / SRC.cell.perCell) === plan0.power.cells && Math.abs(plan0.power.cells * SRC.cell.perCell - SRC.cell.open) < 0.05, '2.5 V at 0.63 V a cell is 4 cells');

// The button cell's life, by counting the charge hour by hour.
{
  const used = SRC.battery.depth.find(([, volts]) => volts === SRC.chip.supply[0])[0] / 100, coulombs = SRC.battery.capacity * used * 3.6;
  const hoursAt = microamps => { let charge = 0, hours = 0; while (charge < coulombs - 1e-9) { charge += microamps * 1e-6 * 3600; hours++; } return hours; };
  t.near(plan0.power.usable, SRC.battery.capacity * used / 1000, 1e-15, '80% of 150 mAh');
  t.near(plan0.power.waitHours, hoursAt(SRC.chip.wait.current[0]), 1, 'hours waiting');
  t.near(plan0.power.operateHours, hoursAt(SRC.chip.operate.current[0]), 1, 'hours working');
  t.near(plan0.power.offHours, hoursAt(SRC.chip.off), 1, 'hours off');
  t.near(plan0.power.years, hoursAt(SRC.chip.wait.current[0]) / 24 / 365.25, 1e-3, 'years waiting');
}

// The display's rms voltages, by summing its drive waveforms over two frames.
const lineOf = letter => { for (let l = 0; l < 3; l++) { const c = P.LAYOUT[l].indexOf(letter); if (c >= 0) return [l, c]; } return null; };
for (const pattern of [...P.PATTERNS, P.ERROR_PATTERN, '']) {
  const slots = Array.from({length: 6}, (_, s) => P.driveLevels(pattern, s));
  slots.forEach((level, s) => {
    level.commons.forEach((volts, c) => assert.equal(volts, s === c ? 3 : s === c + 3 ? 0 : 1.5, 'a common at 3 V in its slot, 0 V three slots later, 1.5 V otherwise'));
    level.lines.forEach(volts => assert.ok(volts === 0 || volts === 3, 'a segment line at 0 or 3 V'));
  });
  for (const letter of 'abcdefg') {
    const [l, c] = lineOf(letter), across = slots.map(level => level.lines[l] - level.commons[c]), lit = pattern.includes(letter);
    const rms = Math.sqrt(across.reduce((sum, v) => sum + v * v, 0) / across.length), dc = across.reduce((sum, v) => sum + v, 0) / across.length;
    t.near(rms, lit ? plan0.rms.on : plan0.rms.off, 1e-12, `${letter} of ${pattern || 'a blank digit'}: rms by summing its waveform`);
    t.ok(dc === 0 && across.every((v, s) => Math.abs(v) === (s % 3 === c ? (lit ? 3 : 0) : 1.5)), `${letter} of ${pattern || 'a blank digit'}: 3 V in its slot when lit, none when dark, 1.5 V in the others, and no DC`);
  }
}
t.near(plan0.rms.on / plan0.rms.off, Math.sqrt(3), 1e-12, 'lit against dark: the square root of 3');

// Frames, by integrating the frame rate.
for (const values of [{}, {light: 100}, {light: 20}, {bounce: 10}]) {
  const plan = P.calculatorPlan(values), steps = 200000, dt = plan.duration / steps;
  let frames = 0;
  for (let i = 0; i < steps; i++) { const mid = (i + 0.5) * dt * 1e6; frames += plan.runs ? (plan.adds && mid >= plan.addStart && mid < plan.addEnd ? SRC.chip.operate.frame[1] : SRC.chip.wait.frame[1]) * dt : 0; }
  t.near(P.framesAt(plan, plan.duration), frames, 1e-4, 'frames by integrating the frame rate');
}
t.ok(Math.round(C.wait.oscillator[1] / 192 * 10) / 10 === C.wait.frame[1] && Math.round(C.operate.oscillator[1] / 1920) === C.operate.frame[1], 'the sheet’s frames are its oscillators over 192 and 1,920');

// The clock through the addition: X takes the answer's digits one by one, and the carry is the integers' carry.
for (const values of [{}, {first: 9, second: 8}, {first: 99999999, second: 1}, {first: 12345678, second: 87654321}]) {
  const plan = P.calculatorPlan(values), digits = schoolbook(plan.first, plan.second);
  for (let tick = 0; tick <= 64; tick++) {
    const now = P.calculatorAt(plan, (plan.addStart + tick * 1000 + 500) / 1e6), k = Math.floor(tick / 8);
    t.ok(now.ticksDone === tick && now.x.every((digit, j) => digit === (j < k ? Number(digits[8 - j]) : Math.floor(plan.second / 10 ** j) % 10)) && (tick % 8 !== 0 || now.carry === (tick === 0 ? 0 : Math.floor((plan.first % 10 ** k + plan.second % 10 ** k) / 10 ** k))), `tick ${tick} of ${plan.first} + ${plan.second}`);
  }
  const end = P.calculatorAt(plan, plan.duration + 1), text = plan.sum >= 1e8 ? `E ${(plan.sum * 1e-8).toFixed(8).slice(0, 9)}` : String(plan.sum);
  t.ok(end.done && end.screen.text === text && P.calculatorAt(plan, plan.addEnd / 1e6 - 1e-7).screen.text === String(plan.second), 'the entry held until the answer is ready');
}
{
  const dim = P.calculatorPlan({light: 100}), dark = P.calculatorPlan({light: 40});
  t.ok(dim.runs && !dim.adds && P.calculatorAt(dim, 1).ticksDone === 0 && P.calculatorAt(dim, 1).screen.text === '9' && P.calculatorAt(dim, 1).registered === 1 && dim.after.text === '9' && dim.before.text === '9', 'too dim to add: the key taken, the entry kept');
  t.ok(!dark.runs && P.calculatorAt(dark, 1).screen === P.BLANK && P.calculatorAt(dark, 1).reads.length === 0 && P.calculatorAt(dark, 1).polled === null && P.calculatorAt(dark, 1).slot === null && dark.after === P.BLANK && dark.before === P.BLANK, 'dark: nothing read, nothing shown');
  const twice = P.calculatorPlan({bounce: 10, debounce: 1});
  t.ok(P.calculatorAt(twice, 0.0005).registered === 0 && P.calculatorAt(twice, 0.004).registered === 1 && P.calculatorAt(twice, 0.012).registered === 2 && P.calculatorAt(twice, 1).registered === 2, 'presses counted as the chip takes them');
  const cached = P.calculatorPlan({light: 5});
  t.ok(P.calculatorPlan({light: 5}) === cached, 'a plan kept');
  for (let i = 1; i <= 64; i++) P.calculatorPlan({first: 1000 + i});
  t.ok(P.calculatorPlan({light: 5}) !== cached, 'and dropped once 64 more are made');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createCalculatorModel(), T = model.topology, K = M.COLORS, A = M.ADDERVIEW, SC = M.SCANCHART, D = M.DRIVE, PW = M.POWER;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const pairsOf = line => { const points = pointsOf(line); return Array.from({length: points.length / 2}, (_, i) => [points[2 * i], points[2 * i + 1]]); };
const rectOf = mesh => [mesh.position.x - mesh.scale.x / 2, mesh.position.x + mesh.scale.x / 2, mesh.position.y - mesh.scale.y / 2, mesh.position.y + mesh.scale.y / 2];
const colorOf = object => object.material.color.getHex();
const bitOf = object => { const hex = colorOf(object); assert.ok(hex === K.one || hex === K.zero, 'a cell holds a 1 or a 0'); counts.cells++; return hex === K.one ? 1 : 0; };
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
const at = (p, q, tolerance = 1e-6) => Math.abs(p[0] - q[0]) <= tolerance && Math.abs(p[1] - q[1]) <= tolerance;
const overlap = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
const onSegment = (p, a, b) => Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) < 1e-7 && p[0] >= Math.min(a[0], b[0]) - 1e-7 && p[0] <= Math.max(a[0], b[0]) + 1e-7 && p[1] >= Math.min(a[1], b[1]) - 1e-7 && p[1] <= Math.max(a[1], b[1]) + 1e-7;
const msOf = x => (x - SC.x) / SC.w * P.SCAN.window * 1000;
const luxAt = x => PW.lux[0] * 10 ** ((x - PW.x) / PW.w * 3), ampsAt = y => PW.amps[0] * 10 ** ((y - PW.y) / PW.h * 3);
const [gateW, gateH] = A.gate;

t.ok(M.MM === 0.01 && M.LCD_MM === 0.02 && M.timesTrue(M.LCD_MM) === 2, 'the calculator at true size and its display twice true size');

// The calculator at true size, and its display twice over.
{
  const box = T.body.geometry.parameters, strip = rectOf(T.strip), windowRect = rectOf(T.lcdWindow);
  t.ok(near(box.width, 72 * M.MM) && near(box.height, 118 * M.MM) && near(box.depth, 8 * M.MM), 'a body 72 by 118 mm');
  t.near(strip[1] - strip[0], SRC.cell.size[0] * M.MM, 1e-12, 'the AM-1417 35.0 mm long');
  t.near(strip[3] - strip[2], SRC.cell.size[1] * M.MM, 1e-12, 'and 13.9 mm wide');
  t.near(2 * T.battery.geometry.parameters.radius, SRC.battery.size[0] * M.MM, 1e-12, 'an LR44 11.6 mm across');
  t.ok(near(T.battery.position.x, (strip[0] + strip[1]) / 2) && near(T.battery.position.y, (strip[2] + strip[3]) / 2), 'drawn where the solar cell was');
  const seams = pairsOf(T.seams);
  t.ok(seams.length === 3 && seams.every(([a, b], q) => near(a[0], strip[0] + (strip[1] - strip[0]) * (q + 1) / 4) && near(b[0], a[0]) && near(a[1], strip[2]) && near(b[1], strip[3])), 'the strip in 4 cells');
  const faces = [strip, windowRect, ...T.keys.map(rectOf)];
  t.ok(T.keys.length === 20 && faces.every(([x0, x1, y0, y1]) => x0 >= -box.width / 2 && x1 <= box.width / 2 && y0 >= -box.height / 2 && y1 <= box.height / 2) && faces.every((a, i) => faces.every((b, j) => i === j || !overlap(a, b))), 'the solar cell, the window and 20 keys on the face, apart');
  t.ok(T.legends.filter(mesh => mesh.visible).every(legend => { const l = rectOf(legend); return T.keys.some(key => { const k = rectOf(key); return l[0] >= k[0] && l[1] <= k[1] && l[2] >= k[2] && l[3] <= k[3]; }); }), 'every legend on its key');
  T.lcdSmall.forEach((digit, i) => {
    const [sx, sy] = [(i - 4) * M.CALC.pitch * M.MM, M.CALC.lcdY * M.MM], [bx, by] = [M.digitX(i), 0];
    for (const letter of 'abcdefgp') {
      const s = rectOf(digit[letter]), b = rectOf(T.lcdBig[i][letter]);
      t.ok(near(b[0] - bx, 2 * (s[0] - sx)) && near(b[1] - bx, 2 * (s[1] - sx)) && near(b[2] - by, 2 * (s[2] - sy)) && near(b[3] - by, 2 * (s[3] - sy)) && s[0] >= windowRect[0] && s[1] <= windowRect[1] && s[2] >= windowRect[2] && s[3] <= windowRect[3], `segment ${letter} of digit ${i}: twice true size, inside the window`);
    }
  });
  const segments = T.lcdBig.flatMap(digit => Object.values(digit).map(rectOf)), a = rectOf(T.lcdBig[4].a), d = rectOf(T.lcdBig[4].d);
  t.ok(segments.every((p, i) => segments.every((q, j) => i === j || !overlap(p, q))) && near(a[3] - d[2], M.CALC.digit[1] * M.LCD_MM) && near(a[3] - a[2], M.CALC.digit[2] * M.LCD_MM), 'digits 9 mm high with strokes of 1 mm, no two segments overlapping');
  const stroke = M.CALC.digit[2] * M.LCD_MM, leftBar = rectOf(T.lcdBig[4].f), rightBar = rectOf(T.lcdBig[4].b);
  t.ok([...'adg'].every(letter => { const r = rectOf(T.lcdBig[4][letter]); return near(r[3] - r[2], stroke); }) && [...'bcef'].every(letter => { const r = rectOf(T.lcdBig[4][letter]); return near(r[1] - r[0], stroke); }) && near(rightBar[1] - leftBar[0], M.CALC.digit[0] * M.LCD_MM), 'every segment one stroke thick, the digit 5 mm wide');
}

// The key matrix: 49 crossings, each with its key, and every line from the chip.
{
  const segments = T.wires.flatMap((wire, n) => { const points = pointsOf(wire); return points.slice(1).map((b, i) => [n, points[i], b]); }), crossings = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const [n1, a, b] = segments[i], [n2, c, d] = segments[j];
      if (n1 === n2) continue;
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (Math.abs(den) < 1e-15) continue;
      const u = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den, v = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (u > 1e-9 && u < 1 - 1e-6 && v > 1e-9 && v < 1 - 1e-6) crossings.push({x: a[0] + u * (b[0] - a[0]), y: a[1] + u * (b[1] - a[1]), poll: Math.min(n1, n2), strobe: Math.max(n1, n2)});
    }
  }
  t.ok(crossings.length === SRC.chip.keys, '49 places where two lines cross');
  for (const crossing of crossings) {
    const index = P.KEYS.findIndex(key => key.poll === crossing.poll && key.strobe === crossing.strobe), square = T.keySquares[index];
    t.ok(index >= 0 && at([square.position.x, square.position.y], [crossing.x, crossing.y]) && near(square.scale.x, M.KEYPAD.key), `a key where K${crossing.strobe} crosses K${crossing.poll}`);
  }
  t.ok(T.keySquares.length === SRC.chip.keys && T.equalsSquare === T.keySquares[P.KEYS.findIndex(key => key.strobe === 8 && key.poll === 5)], '= where K8 crosses K5');
  const chip = rectOf(T.chipBody);
  t.ok(T.wires.length === 11 && T.wires.every(wire => { const [x, y] = pointsOf(wire)[0]; return near(x, chip[1]) && y > chip[2] && y < chip[3]; }), 'all 11 lines leave the chip');
  t.ok(T.slotBars.length === 10 && T.slotBars.every((bar, k) => { const [x0, x1] = rectOf(bar); return near(msOf(x0), 2 * k + 1.25, 1e-6) && near(msOf(x1), 2 * k + 1.5, 1e-6); }), 'the K5 slots, a quarter millisecond every 2 ms');
  t.ok(pairsOf(T.timeTicks).length === 11 && pairsOf(T.timeTicks).every(([a], i) => near(msOf(a[0]), 2 * i, 1e-6)), 'a tick every 2 ms');
}

// The adder: gates in their boxes, one wire into every pin, and no wire through a gate or a cell.
const gateBoxes = [];
{
  A.fa.forEach((left, fa) => M.GATES.forEach(([kind, gx, gy], g) => gateBoxes.push({fa, g, kind, left: left + gx, middle: gy, box: [left + gx - (kind === 'xor' ? A.extra : 0), left + gx + gateW, gy - gateH / 2, gy + gateH / 2]})));
  for (const gate of gateBoxes) {
    const outline = pairsOf(T.gates[gate.fa][gate.g]), [x0, x1, y0, y1] = gate.box;
    t.ok(outline.length > 0 && outline.flat().every(([x, y]) => x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6) && (gate.kind !== 'xor' || outline.flat().some(([x]) => near(x, x0))), `a ${gate.kind} gate inside its box`);
    gate.pins = [gate.middle + gateH / 4, gate.middle - gateH / 4].map(y => [Math.min(...outline.filter(([a, b]) => a[1] !== b[1] && (a[1] - y) * (b[1] - y) <= 0).map(([a, b]) => a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])).filter(x => x >= gate.left - 1e-6)), y]);
    const wires = T.faWires[gate.fa].map(pointsOf);
    t.ok(gate.pins.every(pin => wires.filter(points => at(points.at(-1), pin)).length === 1) && wires.some(points => at(points[0], [gate.left + gateW, gate.middle])), `one wire into each pin of a ${gate.kind} gate, and one out of its tip`);
    counts.gates++;
  }
  t.ok(T.registerCells.every(row => row.every(group => group.every((cell, q) => (q === 0 || near(cell.position.x - group[q - 1].position.x, A.bit)) && near(cell.scale.x, A.cell)))) && T.registerCells.every(row => row.every((group, i) => i === 0 || near(group[0].position.x - row[i - 1][3].position.x, A.bit + A.digitGap))), 'the register cells one bit apart, the digits a gap further');
  t.ok([T.bufferCells, T.correctionCells].every(cells => cells.every((cell, q) => q === 0 || near(cell.position.x - cells[q - 1].position.x, A.bit))), 'the buffer and the correction spaced like a digit of a register');
  t.ok(gateBoxes.every((gate, g) => gateBoxes.every((other, n) => n === g || gate.fa !== other.fa || !overlap(gate.box, other.box))), 'no two gates of a full adder overlap');
  const blockers = [...gateBoxes.map(({kind, left, box: [, x1, y0, y1]}) => [left + (kind === 'and' ? 0.001 : 0.75 * A.bulge + 0.001), x1 - 0.001, y0 + 0.001, y1 - 0.001]), ...[...T.registerCells.flat(2), ...T.bufferCells, ...T.correctionCells, T.detector, ...T.flipflops].map(mesh => { const [x0, x1, y0, y1] = rectOf(mesh); return [x0 + 0.0005, x1 - 0.0005, y0 + 0.0005, y1 - 0.0005]; })];
  const clear = points => points.slice(1).every((b, i) => { const a = points[i]; for (let s = 0; s <= 40; s++) { const x = a[0] + (b[0] - a[0]) * s / 40, y = a[1] + (b[1] - a[1]) * s / 40; counts.points++; if (blockers.some(([x0, x1, y0, y1]) => x > x0 && x < x1 && y > y0 && y < y1)) return false; } return true; });
  t.ok([...T.faWires.flat(), ...Object.values(T.links)].every(wire => clear(pointsOf(wire))), 'no wire through a gate or a cell');
  for (let i = 0; i < 8; i++) for (let q = 0; q < 4; q++) t.ok(clear(M.tapOf(0, i, q)) && clear(M.tapOf(1, i, q)), `the taps from digit ${i + 1}, bit ${q + 1} clear`);
  const L2 = T.links, first = name => pointsOf(L2[name])[0], last = name => pointsOf(L2[name]).at(-1), edges = mesh => rectOf(mesh);
  const [b0, , , b3] = [edges(T.bufferCells[0]), 0, 0, edges(T.bufferCells[3])], c3 = edges(T.correctionCells[3]), [ff1, ff2] = T.flipflops.map(edges), det = edges(T.detector);
  t.ok(at(first('s1'), [A.fa[0] + 0.45, 0.03]) && at(last('s1'), [b0[0], A.buffer]) && at(first('out1'), [A.fa[0] + 0.45, -0.055]) && at(last('out1'), [ff1[1], A.flipflopY]) && at(first('ff1'), [ff1[0], A.flipflopY]) && at(last('ff1'), [A.fa[0], -0.105]), 'the left full adder’s sum into the buffer and its carry through its flip-flop back to it');
  t.ok(at(first('a2'), [b3[1], A.buffer]) && at(last('a2'), [A.fa[1], 0.075]) && at(first('b2'), [c3[1], A.correction]) && at(last('b2'), [A.fa[1], 0.045]) && at(first('out2'), [A.fa[1] + 0.45, -0.055]) && at(last('out2'), [ff2[1], A.flipflopY]) && at(first('ff2'), [ff2[0], A.flipflopY]) && at(last('ff2'), [A.fa[1], -0.105]) && at(first('s2'), [A.fa[1] + 0.45, 0.03]) && at(last('s2'), [0, edges(T.bufferCells[2])[3]]), 'the right full adder fed from the buffer and the correction, its sum back into the buffer');
  t.ok(at(first('detIn'), [0, b0[2]]) && at(last('detIn'), [0, det[3]]) && at(first('detOut'), [0, det[2]]) && at(last('detOut'), [0, c3[3]]), 'the buffer into the box that decides the correction, and the box into the correction');
}

// The display's decoder cells, and the drive and power charts.
{
  const pitch = M.CALC.pitch * M.LCD_MM, windowBig = rectOf(T.lcdWindowBig), cells = [...T.bitCells.flat(), ...T.segmentCells.flat()].map(rectOf);
  const under = (rows, i) => rows[i].every(cell => { const [x0, x1] = rectOf(cell); return x0 > M.digitX(i + 1) - pitch / 2 && x1 < M.digitX(i + 1) + pitch / 2; });
  t.ok(T.bitCells.length === 8 && T.bitCells.every((_, i) => under(T.bitCells, i) && under(T.segmentCells, i)) && T.segmentCells.every(row => row.length === 7), 'each digit’s 4 bits and 7 segment bits under it');
  t.ok(cells.every((p, i) => cells.every((q, j) => i === j || !overlap(p, q))) && cells.every(([, , , y1]) => y1 < windowBig[2]), 'the decoder’s cells apart, below the window');
  t.ok(T.lcdBig.every((digit, i) => Object.values(digit).every(mesh => { const [x0, x1, y0, y1] = rectOf(mesh); return x0 >= M.digitX(i) - pitch / 2 && x1 <= M.digitX(i) + pitch / 2 && x0 >= windowBig[0] && x1 <= windowBig[1] && y0 >= windowBig[2] && y1 <= windowBig[3]; })), 'every segment, the point included, inside its digit’s pitch and inside the window');
  t.ok(pairsOf(T.slotLines).length === 7 && pairsOf(T.slotLines).every(([a, b], s) => near(a[0], D.x + s / 6 * D.w) && near(b[0], a[0])), 'a line at every slot of two frames');
  t.ok(D.bases.every((base, n) => n === 0 || near(D.bases[n - 1] - base, 0.11)) && near(D.perVolt, 0.025) && near(D.bars.h, 0.14) && near(D.bars.w, 0.06) && near(D.bars.pitch, 0.1), 'the six traces evenly spaced, a volt and the rms bars drawn at the sizes declared');
  const [start, end] = pointsOf(T.cellLine);
  t.ok([start, end].every(([x, y]) => near(ampsAt(y) / luxAt(x) / (SRC.cell.current * 1e-6 / SRC.cell.lux), 1, 1e-6)) && near(luxAt(end[0]) / 1000, 1, 1e-6) && near(ampsAt(start[1]) / 0.1e-6, 1, 1e-6), 'the cell’s line: 13.3 μA at 200 lx, in proportion to the light, on logarithmic scales');
  t.ok(T.chipLines.every((line, i) => pointsOf(line).every(([, y]) => near(ampsAt(y) / [3e-6, 13e-6][i], 1, 1e-6))), 'the chip’s 3.0 μA and 13 μA');
  t.ok(pairsOf(T.thresholdTicks).every(([a, b], i) => near(luxAt(a[0]) / [waitLux, operateLux][i], 1, 1e-6) && near(ampsAt(b[1]) / [3e-6, 13e-6][i], 1, 1e-6)), 'ticks where the line reaches them');
  t.ok(pairsOf(T.powerTicks).length === 8 && pairsOf(T.powerTicks).every(([a], i) => (i % 2 === 0 ? near(luxAt(a[0]) / 10 ** (i / 2), 1, 1e-6) : near(ampsAt(a[1]) / (0.1e-6 * 10 ** ((i - 1) / 2)), 1, 1e-6))), 'a tick at every factor of ten');
}

// Swept settings and times, each read back from the drawing against the check's own routes.
const scans = new Map(), scanOf = (bounce, need) => { const key = `${bounce}:${need}`; if (!scans.has(key)) scans.set(key, simulateScan(bounce, need)); return scans.get(key); };
const takenAt = (scan, micro) => { let down = false; for (const flip of scan.flips) if (flip.micro <= micro + 1e-6) down = flip.down; return down; };
function expect(values, time) {
  const v = {...P.CALC_DEFAULTS, ...values}, scan = scanOf(v.bounce, v.debounce), addStart = scan.end, addEnd = addStart + 64000, micro = Math.min(time, addEnd / 1e6) * 1e6;
  const current = cellAt(v.light), runs = v.source === 1 || current >= SRC.chip.wait.current[0] * 1e-6, adds = v.source === 1 || current >= SRC.chip.operate.current[0] * 1e-6;
  const index = adds && micro >= addStart ? Math.min(64, Math.floor((micro - addStart) / 1000 + 1e-9)) : 0, sum = v.first + v.second;
  const sumText = sum >= 1e8 ? `E ${(sum * 1e-8).toFixed(8).slice(0, 9)}` : String(sum);
  return {v, scan, addStart, addEnd, micro, runs, adds, index, k: Math.floor(index / 8), m: index % 8, tick: adds && micro >= addStart && index < 64, text: !runs ? '' : adds && index === 64 ? sumText : String(v.second), digits: schoolbook(v.first, v.second)};
}
const decode = digits => {
  const labels = digits.map(meshes => { const lit = [...'abcdefg'].filter(letter => meshes[letter].visible).join(''); if (!lit) return ''; const label = Object.keys(SRC.segments).find(key => SRC.segments[key] === lit); assert.ok(label !== undefined, `lit segments ${lit} make no digit`); return label; });
  const points = digits.map(meshes => meshes.p.visible), body = labels.slice(1);
  if (labels[0] === 'E') { assert.ok(points[1] && points.filter(Boolean).length === 1 && body.every(label => /^\d$/.test(label)), 'E with 8 digits and the point after the first'); return `E ${body[0]}.${body.slice(1).join('')}`; }
  assert.ok(labels[0] === '' && points.every(point => !point), 'no sign and no point');
  const lead = body.findIndex(label => label !== '');
  assert.ok(lead === -1 || body.slice(lead).every(label => /^\d$/.test(label)), 'blanks only before the digits');
  return body.join('');
};
const poseSettings = [{}, {first: 9, second: 8}, {first: 99999999, second: 1}, {bounce: 10, debounce: 1}, {bounce: 10}, {light: 100}, {light: 40}, {source: 1, light: 0}, {first: 12345678, second: 87654321, bounce: 5.5, debounce: 2, light: 700}, {first: 0, second: 0, bounce: 0, debounce: 1, light: 195}, {first: 90909090, second: 9090909, bounce: 7.3, debounce: 3, light: 1000, source: 1}];
const poseTimes = values => { const scan = scanOf(values.bounce ?? P.CALC_DEFAULTS.bounce, values.debounce ?? P.CALC_DEFAULTS.debounce), start = scan.end / 1e6; return [0, 0.0009, 0.0041, scan.registrations[0] / 1e6 + 0.0001, start + 0.0003, start + 0.0027, start + 0.0045, start + 0.0069, start + 0.0213, start + 0.0371, start + 0.0633, start + 1]; };
const low = (value, bits) => value & ((1 << bits) - 1);
for (const values of poseSettings) {
  for (const time of poseTimes(values)) {
    model.reset();
    model.update(values);
    model.advance(time * P.ADDER.slow);
    model.root.updateMatrixWorld(true);
    const e = expect(values, time), state = model.getState(), where = `${JSON.stringify(values)} at ${time} s`;
    counts.poses++;
    t.near(state.clock, Math.min(time, e.addEnd / 1e6), 1e-12, 'the clock drawn 100 times slower');

    // The calculator and its display.
    t.ok(T.strip.visible === (e.v.source === 0) && T.seams.visible === (e.v.source === 0) && T.battery.visible === (e.v.source === 1) && T.batteryRim.visible === (e.v.source === 1), `${where}: the solar cell or the button cell`);
    t.ok(decode(T.lcdSmall) === e.text && decode(T.lcdBig) === e.text, `${where}: the display reads ${e.text || 'blank'}`);

    // The key matrix and the chart of the press.
    const bounceMicro = Math.round(e.v.bounce * 1000), pressed = e.micro > 0, closed = contactAt(e.micro, bounceMicro), polled = e.runs && pressed ? Math.floor(e.micro / 250 + 1e-9) % 8 : null;
    const keyColor = !pressed ? K.key : closed ? K.pressed : K.bouncing;
    t.ok(colorOf(T.equalsKey) === keyColor && colorOf(T.equalsSquare) === keyColor, `${where}: the = key gold while closed, pale while it bounces open`);
    t.ok(T.wires.every((wire, n) => colorOf(wire) === (n === polled ? K.polled : n === 8 && polled === 5 && closed ? K.high : K.wire)), `${where}: the line driven in gold, K8 red while = is closed in the K5 slot`);
    const reads = e.runs ? e.scan.reads.filter(read => read.micro <= e.micro + 1e-6) : [], taken = e.runs ? e.scan.registrations.filter(when => when <= e.micro + 1e-6) : [], dots = T.readDots.filter(dot => dot.visible);
    t.ok(dots.length === reads.length && dots.every((dot, i) => near(msOf(dot.position.x) * 1000, reads[i].micro, 1e-6) && near(dot.position.y, SC.y + SC.contact[reads[i].closed ? 1 : 0])), `${where}: a dot for every read, high where the contact was closed`);
    const ticks = pairsOf(T.countTicks);
    t.ok(ticks.length === taken.length && ticks.every(([a, b], i) => near(msOf(a[0]) * 1000, taken[i], 1e-2) && near(b[0], a[0])), `${where}: a gold tick for every press taken`);
    const guide = pointsOf(T.contactGuide);
    t.ok(near(msOf(guide.at(-1)[0]), P.SCAN.window * 1000) && near(guide.at(-1)[1], SC.y + SC.contact[1]), `${where}: the contact drawn closed to the end of the chart`);
    const levelAt = (points, ms, [lowLevel, highLevel]) => { let level = null; for (const [x, y] of points) if (msOf(x) <= ms + 1e-6) level = near(y, SC.y + highLevel) ? 1 : near(y, SC.y + lowLevel) ? 0 : NaN; return level; };
    if (pressed) {
      const contact = pointsOf(T.contactTrace), takenTrace = pointsOf(T.takenTrace), until = Math.min(e.micro / 1000, 20);
      for (let s = 0; s < 200 && (s + 0.37) * 0.1 <= until; s++) {
        const ms = (s + 0.37) * 0.1;
        assert.equal(levelAt(contact, ms, SC.contact), contactAt(ms * 1000, bounceMicro) ? 1 : 0, `${where}: the contact drawn at ${ms} ms`);
        if (e.runs) assert.equal(levelAt(takenTrace, ms, SC.taken), takenAt(e.scan, ms * 1000) ? 1 : 0, `${where}: the key taken at ${ms} ms`);
        counts.points++;
      }
      const cursor = pairsOf(T.scanCursor);
      t.ok((e.runs ? takenTrace.length > 0 : takenTrace.length === 0) && (e.micro <= 20000 ? cursor.length === 1 && near(msOf(cursor[0][0][0]), e.micro / 1000, 1e-6) : cursor.length === 0), `${where}: the taken key only while the chip runs, and the cursor at the time`);
    } else {
      t.ok(pointsOf(T.contactTrace).length === 0 && pointsOf(T.takenTrace).length === 0 && dots.length === 0 && pairsOf(T.scanCursor).length === 0, `${where}: nothing on the chart before the press`);
    }

    // The adder: registers, buffer, correction and carries from the integers.
    const readDigit = cells => cells.reduce((sum, cell, q) => sum + (bitOf(cell) << (3 - q)), 0);
    const xDigits = Array.from({length: 8}, (_, k) => readDigit(T.registerCells[0][7 - k])), yDigits = Array.from({length: 8}, (_, k) => readDigit(T.registerCells[1][7 - k]));
    t.ok(xDigits.every((digit, k) => digit === (k < e.k ? Number(e.digits[8 - k]) : Math.floor(e.v.second / 10 ** k) % 10)) && yDigits.every((digit, k) => digit === Math.floor(e.v.first / 10 ** k) % 10), `${where}: X holds the answer’s finished digits and the second number’s others, Y the first`);
    const kk = Math.min(e.k, 7), m = e.m, xk = Math.floor(e.v.second / 10 ** kk) % 10, yk = Math.floor(e.v.first / 10 ** kk) % 10, cin = kk === 0 ? 0 : Math.floor((e.v.first % 10 ** kk + e.v.second % 10 ** kk) / 10 ** kk);
    const whole = xk + yk + cin, bits = whole % 16, correction = whole > 9 ? 6 : 0;
    const expectBuffer = m === 0 ? 0 : m <= 4 ? low(whole, m) : low(bits + correction, m - 4) | (bits & ~((1 << (m - 4)) - 1) & 15);
    const carry1 = e.index === 0 ? 0 : m === 0 ? Math.floor((e.v.first % 10 ** e.k + e.v.second % 10 ** e.k) / 10 ** e.k) : m <= 4 ? (low(xk, m) + low(yk, m) + cin) >> m : whole >> 4;
    const carry2 = m > 4 ? (low(bits, m - 4) + low(correction, m - 4)) >> (m - 4) : 0;
    t.ok(readDigit(T.bufferCells) === expectBuffer && readDigit(T.correctionCells) === (m >= 4 ? correction : 0) && bitOf(T.flipflops[0]) === carry1 && bitOf(T.flipflops[1]) === carry2 && colorOf(T.detector) === (m >= 4 && whole > 9 ? K.signal : K.zero), `${where}: the buffer, the correction and both carries after ${e.index} ticks`);

    // The full adders, simulated from the drawing: each gate's inputs from the wires at its pins.
    const stage = e.tick ? (m >= 4 ? 1 : 0) : null, j = m % 4, q = 3 - j;
    for (let fa = 0; fa < 2; fa++) {
      const active = stage === fa, left = A.fa[fa], wires = T.faWires[fa], points = wires.map(pointsOf);
      const wireBit = wire => { const hex = colorOf(wire); if (!active) { assert.equal(hex, K.idle, `${where}: an idle full adder’s wires are gray`); return null; } assert.ok(hex === K.signal || hex === K.low, `${where}: a working wire carries a 1 or a 0`); return hex === K.signal ? 1 : 0; };
      const railBit = y => wireBit(wires[points.findIndex(p => at(p[0], [left, y]))]), outBit = y => wireBit(wires[points.findIndex(p => at(p.at(-1), [left + 0.45, y]))]);
      const [a, b, c, s, out] = [railBit(0.075), railBit(0.045), railBit(-0.105), outBit(0.03), outBit(-0.055)];
      for (const gate of gateBoxes.filter(item => item.fa === fa)) {
        if (!active) { t.ok(colorOf(T.gates[fa][gate.g]) === K.gate, `${where}: a gate that is not working is drawn dark`); continue; }
        const [p1, p2] = gate.pins.map(pin => wireBit(wires[points.findIndex(p => at(p.at(-1), pin))])), result = gate.kind === 'and' ? p1 & p2 : gate.kind === 'or' ? p1 | p2 : p1 ^ p2;
        t.ok(colorOf(T.gates[fa][gate.g]) === (result ? K.signal : K.gate) && wires.every((wire, i) => !at(points[i][0], [gate.left + gateW, gate.middle]) || wireBit(wire) === result), `${where}: ${gate.kind} gate ${gate.g + 1}, ${p1} and ${p2} make ${result}`);
        counts.gates++;
      }
      points.forEach((p, i) => { const trunk = points.findIndex((other, n) => n !== i && other.slice(1).some((end, k) => onSegment(p[0], other[k], end))); if (trunk >= 0) assert.equal(colorOf(wires[i]), colorOf(wires[trunk]), `${where}: a branch carries its wire’s bit`); });
      if (active) {
        const [, , , sum, carryOut] = truth(a, b, c), frames = T.bitFrames.map(frame => { const pts = pointsOf(frame); return [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2]; });
        const want = fa === 0 ? {a: (xk >> j) & 1, b: (yk >> j) & 1, c: carry1, frames: [[M.cellX(7 - kk, q), A.rows[0]], [M.cellX(7 - kk, q), A.rows[1]]]} : {a: (bits >> j) & 1, b: (correction >> j) & 1, c: carry2, frames: [[M.smallX(q), A.buffer], [M.smallX(q), A.correction]]};
        t.ok(s === sum && out === carryOut && a === want.a && b === want.b && c === want.c && frames.every((center, row) => at(center, want.frames[row])), `${where}: full adder ${fa + 1} adds bit ${j + 1} of digit ${kk + 1} from the framed cells as the truth table says`);
      }
    }
    const faEnd = (fa, y) => T.faWires[fa][T.faWires[fa].map(pointsOf).findIndex(p => at(p.at(-1), [A.fa[fa] + 0.45, y]))], faRail = (fa, y) => T.faWires[fa][T.faWires[fa].map(pointsOf).findIndex(p => at(p[0], [A.fa[fa], y]))];
    const L2 = T.links, flipColor = bit => (e.tick ? (bit ? K.signal : K.low) : K.idle);
    t.ok(colorOf(L2.s1) === colorOf(faEnd(0, 0.03)) && colorOf(L2.out1) === colorOf(faEnd(0, -0.055)) && colorOf(L2.a2) === colorOf(faRail(1, 0.075)) && colorOf(L2.b2) === colorOf(faRail(1, 0.045)) && colorOf(L2.out2) === colorOf(faEnd(1, -0.055)) && colorOf(L2.s2) === colorOf(faEnd(1, 0.03)) && colorOf(L2.ff1) === flipColor(carry1) && colorOf(L2.ff2) === flipColor(carry2) && colorOf(L2.detOut) === (m >= 4 ? (whole > 9 ? K.signal : K.low) : K.idle) && colorOf(L2.detIn) === (m >= 4 ? K.low : K.idle), `${where}: each link carries the bit of what it joins`);
    const taps = T.taps.map(pointsOf), groups = T.groupFrames.map(pointsOf);
    if (stage === 0) t.ok(taps.every((pts, row) => at(pts[0], [M.cellX(7 - kk, q), A.rows[row] + (row === 0 ? -1 : 1) * A.cell / 2]) && at(pts.at(-1), [A.fa[0], row === 0 ? 0.075 : 0.045])) && colorOf(T.taps[0]) === (((xk >> j) & 1) ? K.signal : K.low) && colorOf(T.taps[1]) === (((yk >> j) & 1) ? K.signal : K.low), `${where}: the taps from the framed cells into the left full adder`);
    else t.ok(taps.every(pts => pts.length === 0), `${where}: no taps while the registers are not read`);
    t.ok(e.tick ? groups.every((pts, row) => at([(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2], [(M.cellX(7 - kk, 0) + M.cellX(7 - kk, 3)) / 2, A.rows[row]])) : groups.every(pts => pts.length === 0) && T.bitFrames.every(frame => pointsOf(frame).length === 0), `${where}: the digit being added framed, and nothing framed between ticks`);

    // The decoder: 4 bits in and a byte out under every digit.
    const labels = e.text === '' ? Array(8).fill('') : e.text.startsWith('E') ? [...e.text.slice(2).replace('.', '')] : [...e.text.padStart(8, ' ')].map(ch => (ch === ' ' ? '' : ch));
    t.ok(T.bitCells.every((cells, i) => { const value = readDigit(cells), byte = T.segmentCells[i].reduce((sum, cell) => 2 * sum + bitOf(cell), 0); return labels[i] === '' ? value === 0 && byte === 0 : value === Number(labels[i]) && byte === SRC.bytes[labels[i]]; }), `${where}: the decoder’s bits under every digit`);

    // The drive: the waveforms drawn, and bars at the rms those waveforms give.
    const volts = T.traces.map((trace, n) => { const pts = pointsOf(trace); assert.equal(pts.length, 12, 'two frames of three slots'); return Array.from({length: 6}, (_, s) => { assert.ok(near(pts[2 * s][0], D.x + s / 6 * D.w) && near(pts[2 * s + 1][0], D.x + (s + 1) / 6 * D.w) && near(pts[2 * s][1], pts[2 * s + 1][1]), 'a flat step in each slot'); return Math.round((pts[2 * s][1] - D.bases[n]) / D.perVolt * 1e3) / 1e3; }); });
    if (!e.runs) t.ok(volts.flat().every(v => v === 0) && T.bars.every(bar => !bar.visible) && pointsOf(T.driveCursor).length === 0, `${where}: no drive in the dark`);
    else {
      t.ok(volts.slice(0, 3).every((trace, c) => trace.every((v, s) => v === (s === c ? 3 : s === c + 3 ? 0 : 1.5))) && volts.slice(3).every(trace => trace.every(v => v === 0 || v === 3)), `${where}: commons and segment lines as the sheet draws them`);
      [...'abcdefg'].forEach((letter, n) => {
        const [l, c] = lineOf(letter), rms = Math.sqrt(volts[3 + l].reduce((sum, v, s) => sum + (v - volts[c][s]) ** 2, 0) / 6), bar = T.bars[n], drawn = bar.visible ? bar.scale.y / D.bars.h * 3 : 0, lit = T.lcdBig[8][letter].visible;
        t.ok(near(drawn, rms, 1e-6) && near(rms, Math.sqrt(lit ? 4.5 : 1.5), 1e-6) && colorOf(bar) === (lit ? K.lit : K.dark), `${where}: segment ${letter}’s bar at the rms of its drawn waveform`);
      });
      const frames = e.adds ? 93.8 * Math.min(e.micro, e.addStart) / 1e6 + 104 * Math.max(0, Math.min(e.micro, e.addEnd) - e.addStart) / 1e6 + 93.8 * Math.max(0, e.micro - e.addEnd) / 1e6 : 93.8 * e.micro / 1e6;
      const cursor = pointsOf(T.driveCursor);
      t.ok(Math.round((cursor[0][0] - D.x) / D.w * 6) === Math.floor(frames * 3 + 1e-9) % 6 && near(cursor[1][0] - cursor[0][0], D.w / 6), `${where}: the slot being driven`);
    }

    // The power chart's cross.
    const cross = pairsOf(T.marker);
    if (e.v.light === 0) t.ok(cross.length === 0, `${where}: no cross at 0 lx`);
    else t.ok(cross.length === 2 && near(luxAt((cross[0][0][0] + cross[0][1][0]) / 2) / e.v.light, 1, 1e-6) && near(ampsAt(cross[0][0][1]) / cellAt(e.v.light), 1, 1e-6) && near(cross[1][0][0], (cross[0][0][0] + cross[0][1][0]) / 2), `${where}: the cross on the cell’s line at the room’s light`);
    t.ok(colorOf(T.marker) === (e.v.source === 1 ? K.spare : K.marker), `${where}: the cross gray with the button cell`);
  }
}

// The parts kept apart, and every flat triangle unlit and facing the viewer.
{
  const partBox = part => {
    const box = new THREE.Box3(), point = new THREE.Vector3();
    part.traverse(child => {
      if (!child.geometry) return;
      for (let up = child; up; up = up.parent) if (!up.visible) return;
      const position = child.geometry.attributes.position, count = child.isLine ? Math.min(position.count, child.geometry.drawRange.count) : position.count;
      for (let i = 0; i < count; i++) box.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld));
    });
    return box;
  };
  for (const values of [{}, {source: 1}, {first: 99999999, second: 99999999}, {bounce: 10, debounce: 1, light: 100}]) {
    for (const time of [0.003, 0.03, 1]) {
      model.reset();
      model.update(values);
      model.advance(time * P.ADDER.slow);
      model.root.updateMatrixWorld(true);
      const boxes = [T.calculator, T.keypad, T.adder, T.display, T.drive, T.power].map(partBox);
      t.ok(boxes.every((p, i) => boxes.every((r, n) => i === n || !p.clone().expandByScalar(0.05).intersectsBox(r))), `${JSON.stringify(values)} at ${time} s: the six parts at least 0.05 apart`);
    }
  }
  let faces = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), meshes = [];
  model.root.traverse(object => { if (object.isMesh) meshes.push(object); });
  for (const object of meshes) {
    if (object === T.body || !object.visible) continue;
    const position = object.geometry.attributes.position, index = object.geometry.index;
    for (let f = 0; f < index.count; f += 3) {
      a.fromBufferAttribute(position, index.getX(f)).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, index.getX(f + 1)).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, index.getX(f + 2)).applyMatrix4(object.matrixWorld);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).z > 0, 'a flat triangle facing the viewer');
      faces++;
    }
  }
  t.ok(faces > 500 && meshes.every(mesh => mesh === T.body || mesh.material.isMeshBasicMaterial), `${faces} flat triangles, every one unlit and facing the viewer`);
}

// ---------------------------------------------------------------------------
// 3. The lesson: every number it quotes is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const lesson = L.calculatorLesson, def = P.calculatorPlan({}), hex = byte => `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`, bin4 = n => n.toString(2).padStart(4, '0');
const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
checkTrialNumbers(lesson, {
  'Press =': s => {
    const [units, tens] = s.serial.digits;
    t.ok(units.five > 9 && units.decimal === 1 && tens.carryIn === 1 && s.now.done && P.CHIP.digits === 8, 'the units pass 9, correct and carry');
    return {25: s.first, 9: s.second, 5: units.y, 14: units.five, 6: units.correction, 4: units.result, 1: units.decimal, 2: tens.y, 3: tens.result, 34: Number(s.now.screen.text), '73.4': s.duration * 1000};
  },
  'Nine and eight': s => {
    const [units, tens] = s.serial.digits;
    t.ok(units.c4 === 1 && tens.result === 1 && s.now.screen.text === '17', 'the bits carry out of the buffer and the tens take the carry');
    return {9: s.first, 8: s.second, 1: units.binary, 17: units.five, 6: units.correction, 7: units.result};
  },
  'More digits than the display': s => {
    t.ok(s.serial.digits.every(digit => digit.five === 10 && digit.result === 0) && s.serial.ninth === 1 && s.now.screen.overflow && s.now.screen.sign === SRC.segments.E, 'every digit makes 10 and a ninth carry is left');
    return {10: s.serial.digits[0].five, 8: P.CHIP.digits, 0: s.serial.digits[0].result, '100,000,000': s.sum, '1.0000000': s.now.screen.shown / 1e7};
  },
  'A bouncing key read twice': s => {
    const flips = s.reads.filter(read => read.flipped);
    t.ok(flips.length === 3 && flips[0].down && !flips[1].down && flips[2].down && P.SCAN.interval * 1000 === 2, 'down, up and down, reading every 2 ms');
    return {2: s.registrations.length, '3.375': flips[0].micro / 1000, '5.375': flips[1].micro / 1000, '11.375': flips[2].micro / 1000};
  },
  'Four reads in a row': s => {
    const closedRead = s.reads.find(read => read.closed), reopened = s.reads.find(read => read.micro > closedRead.micro && !read.closed);
    t.ok(s.registrations.length === 1 && !closedRead.flipped, 'the key taken once');
    return {'3.375': closedRead.micro / 1000, '5.375': reopened.micro / 1000, 4: s.values.debounce, '17.375': s.accepted / 1000, 8: (s.accepted - def.accepted) / 1000, '2.6': P.CALC_DEFAULTS.bounce};
  },
  'Too dim to add': s => {
    t.ok(s.power.state === 'wait' && s.now.screen.text === '9' && s.now.registered === 1 && s.now.ticksDone === 0 && P.LUX.dark === s.values.light, 'enough to wait and take the key, not to add, on a very dark overcast day');
    return {100: s.values.light, '6.65': s.power.current * 1e6, '3.0': P.CHIP.wait.current[0] * 1e6, 9: Number(s.now.screen.text), 13: P.CHIP.operate.current[0] * 1e6, 34: s.sum, 45: s.power.waitLux, 195: s.power.operateLux};
  },
  'A button cell in the dark': s => {
    t.ok(s.power.state === 'operate' && s.now.screen.text === '34' && s.values.light === 0, 'the button cell runs the chip in the dark');
    return {150: P.BATTERY.capacity * 1000, '0.9': P.BATTERY.cutoff, '1.20': P.CHIP.supply[0], 80: 100 * P.BATTERY.depth.at(-1)[0], 120: s.power.usable * 1000, '40,000': s.power.waitHours, '3.0': P.CHIP.wait.current[0] * 1e6, '4.6': s.power.years};
  },
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
const texts = item => [['simple', item.simple], ['overview', item.overview], ...item.steps.flatMap((step, i) => [[`step ${i + 1} title`, step.title], [`step ${i + 1}`, step.body]]), ...item.parts.flatMap((part, i) => [[`part ${i + 1} name`, part.name], [`part ${i + 1}`, part.role]]), ['misconception', item.misconception], ['quiz', [item.quiz.question, ...item.quiz.options].join(' ')], ...item.tryIt.map(trial => [`trial ${trial.title}`, trial.title])];
for (const [where, text] of texts(lesson)) covered(text, {}, `Calculator ${where}`);
const units = def.serial.digits[0], plan98 = P.calculatorPlan({first: 9, second: 8}), [u98, t98] = plan98.serial.digits;
const [w0, w1] = [P.CHIP.wait.current[0] * 1e6, P.CHIP.operate.current[0] * 1e6];
covered(L.calculatorLimits, {
  [`${P.ADDER.slow} times slower`]: '100 times slower',
  [`held at ${f1(P.CHIP.supply[1])} V`]: 'held at 1.5 V',
  [`every ${f2(P.SCAN.poll * 1000)} ms, so = is read every ${f0(P.SCAN.interval * 1000)} ms`]: 'every 0.25 ms, so = is read every 2 ms',
  [`clock of ${f0(1 / P.ADDER.tick / 1000)} kHz`]: 'clock of 1 kHz',
  [`runs at ${f0(P.CHIP.operate.oscillator[1] / 1000)} kHz`]: 'runs at 200 kHz',
  [`${P.ADDER.perDigit} ticks for every digit`]: '8 ticks for every digit',
}, 'limits');
t.ok(L.calculatorLimits.includes('twice true size') && M.LCD_MM === 2 * M.MM && L.calculatorLimits.includes('logarithmic scales'), 'the limits say the scales');
covered(lesson.deeper[0].body, {
  [`reads ${P.KEYS.length} keys on ${P.CHIP.strobe[1] - P.CHIP.polling[0] + 1} lines`]: 'reads 49 keys on 11 lines',
  [`held low through ${f0(P.CHIP.pullDown[1] / 1000)} kΩ`]: 'held low through 180 kΩ',
  [`lifts K8 to ${f2(def.strobe.typical)} V through up to ${f0((P.CHIP.pullUp + P.CHIP.contact) / 1000)} kΩ`]: 'lifts K8 to 1.35 V through up to 20 kΩ',
  [`above the ${f1(def.strobe.need)} V the chip needs to read a ${1}`]: 'above the 1.1 V the chip needs to read a 1',
  [`lowest supply of ${f1(P.CHIP.supply[0])} V, with the lowest pull-down of ${f0(P.CHIP.pullDown[0] / 1000)} kΩ, K8 still reaches ${f1(def.strobe.worst)} V against ${f1(def.strobe.needWorst)} V`]: 'lowest supply of 1.2 V, with the lowest pull-down of 100 kΩ, K8 still reaches 1.0 V against 0.8 V',
}, 'deeper 1');
covered(lesson.deeper[1].body, {
  [`bouncing for ${f1(P.SCAN.bounce * 1000)} ms`]: 'bouncing for 2.6 ms',
  [`ten times, ${f0(P.SCAN.interval * 1000)} ms apart`]: 'ten times, 2 ms apart',
  [`reads = every ${f0(P.SCAN.interval * 1000)} ms and takes it after ${P.CALC_DEFAULTS.debounce} reads in a row agree, so a bounce of ${f1(P.CALC_DEFAULTS.bounce)} ms is taken at ${f3(def.accepted / 1000)} ms`]: 'reads = every 2 ms and takes it after 4 reads in a row agree, so a bounce of 2.6 ms is taken at 9.375 ms',
}, 'deeper 2');
covered(lesson.deeper[2].body, {
  [`each digit takes ${P.ADDER.perDigit} ticks, ${P.ADDER.perDigit / 2} to add its bits into the buffer and ${P.ADDER.perDigit / 2} to add the correction, so ${P.CHIP.digits} digits take ${def.serial.ticks.length}: ${f0(def.serial.ticks.length * P.ADDER.tick * 1000)} ms at the model’s ${f0(1 / P.ADDER.tick / 1000)} kHz`]: 'each digit takes 8 ticks, 4 to add its bits into the buffer and 4 to add the correction, so 8 digits take 64: 64 ms at the model’s 1 kHz',
  [`HP-${SRC.hp35.model} kept its numbers as ${SRC.hp35.bits}-bit`]: 'HP-35 kept its numbers as 56-bit',
}, 'deeper 3');
covered(lesson.deeper[3].title, {[`Why add ${2 ** 4 - 10}`]: 'Why add 6'}, 'deeper 4 title');
covered(lesson.deeper[3].body, {
  [`count to ${2 ** 4 - 1}, but a decimal digit stops at ${10 - 1}, so ${2 ** 4 - 10} of their patterns`]: 'count to 15, but a decimal digit stops at 9, so 6 of their patterns',
  [`sum passes ${10 - 1}, adding ${u98.correction} skips those patterns and carries ${u98.decimal}`]: 'sum passes 9, adding 6 skips those patterns and carries 1',
  [`example is ${plan98.first} + ${plan98.second}: ${bin4(plan98.first)} + ${bin4(plan98.second)} = ${u98.five.toString(2)}, and ${u98.five.toString(2)} + ${bin4(u98.correction)} gives ${P.bcdText(plan98.sum)}, a ${t98.result} and a ${u98.result}`]: 'example is 9 + 8: 1001 + 1000 = 10001, and 10001 + 0110 gives 0001 0111, a 1 and a 7',
}, 'deeper 4');
covered(lesson.deeper[4].body, {
  [`turns a digit’s ${4} bits into ${P.LETTERS.length}`]: 'turns a digit’s 4 bits into 7',
  [`${0} lights ${P.PATTERNS[0]}, ${hex(P.byteOf(P.PATTERNS[0]))}, and ${1} lights b and c, ${hex(P.byteOf(P.PATTERNS[1]))}`]: '0 lights abcdef, 0x3F, and 1 lights b and c, 0x06',
  [`${3} is ${hex(P.byteOf(P.PATTERNS[3]))}, ${4} is ${hex(P.byteOf(P.PATTERNS[4]))}`]: '3 is 0x4F, 4 is 0x66',
  [`lights ${P.ERROR_PATTERN}, ${hex(P.byteOf(P.ERROR_PATTERN))}`]: 'lights adefg, 0x79',
  [`from ${P.CHIP.commons} commons: each common takes a turn at ${f1(P.CHIP.doubler)} V or ${0} V while the others rest at ${f1(P.CHIP.supply[1])} V, and each segment line sits at ${0} or ${f1(P.CHIP.doubler)} V`]: 'from 3 commons: each common takes a turn at 3.0 V or 0 V while the others rest at 1.5 V, and each segment line sits at 0 or 3.0 V',
  [`feels ${f1(P.CHIP.doubler)} V in its own slot and a dark one nothing, and both feel ${f1(P.CHIP.supply[1])} V in the others: ${f2(def.rms.on)} V rms lit against ${f2(def.rms.off)} V dark`]: 'feels 3.0 V in its own slot and a dark one nothing, and both feel 1.5 V in the others: 2.12 V rms lit against 1.22 V dark',
  [`${f1(P.CHIP.wait.frame[1])} times a second`]: '93.8 times a second',
}, 'deeper 5');
t.ok(P.PATTERNS[1] === 'bc', 'a 1 lights b and c');
covered(lesson.deeper[5].body, {
  [`${P.CELL.model}, ${f1(P.CELL.size[0])} by ${f1(P.CELL.size[1])} mm, gives ${f1(P.CELL.current * 1e6)} μA at ${f1(P.CELL.volts)} V under ${P.CELL.lux} lx`]: 'AM-1417, 35.0 by 13.9 mm, gives 13.3 μA at 1.5 V under 200 lx',
  [`its ${f1(P.CELL.open)} V open circuit at ${f2(P.CELL.perCell)} V a cell suggests ${def.power.cells} cells`]: 'its 2.5 V open circuit at 0.63 V a cell suggests 4 cells',
  [`${f1(w0)} μA of waiting takes ${f0(def.power.waitLux)} lx and its ${f0(w1)} μA of adding ${f0(def.power.operateLux)} lx`]: '3.0 μA of waiting takes 45 lx and its 13 μA of adding 195 lx',
  [`the cell’s ${f1(P.CELL.short * 1e6)} μA at ${P.CELL.lux} lx needs ${f1(def.power.operateCeiling)} lx to cover ${f0(w1)} μA`]: 'the cell’s 14.1 μA at 200 lx needs 184.4 lx to cover 13 μA',
  [`holds ${f0(P.BATTERY.capacity * 1000)} mAh to ${f1(P.BATTERY.cutoff)} V, and the chip stops at ${f2(P.CHIP.supply[0])} V, when ${f0(100 * P.BATTERY.depth.at(-1)[0])}%`]: 'holds 150 mAh to 0.9 V, and the chip stops at 1.20 V, when 80%',
}, 'deeper 6');
t.ok(def.power.operateLux < P.CELL.lux && def.power.operateCeiling < def.power.operateLux, 'just under the cell’s rating, and less when shorted');
for (const [i, item] of lesson.deeper.entries()) if (i !== 3) covered(item.title, {}, `deeper ${i + 1} title`);
covered(lesson.quiz.explanation, {
  [`count to ${2 ** 4 - 1} but a digit stops at ${10 - 1}, so ${2 ** 4 - 10} patterns`]: 'count to 15 but a digit stops at 9, so 6 patterns',
  [`In ${units.y} + ${units.x} = ${units.five} the adder adds ${units.correction} to make ${units.five + units.correction}, whose four low bits hold ${units.result}, and ${units.decimal} carries`]: 'In 5 + 9 = 14 the adder adds 6 to make 20, whose four low bits hold 4, and 1 carries',
}, 'quiz explanation');
t.ok((units.five + units.correction) % 16 === units.result, 'twenty’s four low bits hold 4');

// The model's own words: its scales and slowed clock where the reader sees them.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {[`${P.ADDER.slow} times slower`]: '100 times slower'}, 'system text');
covered(partText('calculator'), {[`1 mm to ${M.MM} units`]: '1 mm to 0.01 units', [`a sign digit and ${P.CHIP.digits} digits`]: 'a sign digit and 8 digits', [`${P.CELL.model} solar cell, ${f1(P.CELL.size[0])} mm by ${f1(P.CELL.size[1])} mm`]: 'AM-1417 solar cell, 35.0 mm by 13.9 mm', [`${P.BATTERY.iec} ${f1(P.BATTERY.size[0])} mm across`]: 'LR44 11.6 mm across'}, 'calculator text');
covered(partText('keypad'), {[`held low through ${f0(P.CHIP.pullDown[1] / 1000)} kΩ`]: 'held low through 180 kΩ', [`${P.KEYS.length} keys in all`]: '49 keys in all', [`the first ${f0(P.SCAN.window * 1000)} ms`]: 'the first 20 ms', [`every ${f0(P.SCAN.interval * 1000)} ms`]: 'every 2 ms'}, 'keypad text');
covered(partText('adder'), {[`each is ${P.CHIP.digits} digits of ${4} bits`]: 'each is 8 digits of 4 bits', [`a dark cell for a ${1}`]: 'a dark cell for a 1', [`the ${4}-bit buffer`]: 'the 4-bit buffer', [`Once a digit’s ${4} bits are in`]: 'Once a digit’s 4 bits are in', [`if the sum passed ${10 - 1} or carried, and the right full adder adds ${bin4(units.correction)} to the buffer a bit at a time, or ${bin4(def.serial.digits[1].correction)} if not. A lit wire carries a ${1}`]: 'if the sum passed 9 or carried, and the right full adder adds 0110 to the buffer a bit at a time, or 0000 if not. A lit wire carries a 1', [`${P.ADDER.slow} times slower here`]: '100 times slower here'}, 'adder text');
covered(partText('display'), {[`1 mm to ${M.LCD_MM} units`]: '1 mm to 0.02 units', [`and ${P.CHIP.digits} digits`]: 'and 8 digits', [`the digit’s ${4} bits`]: 'the digit’s 4 bits', [`A dark cell is a ${1}`]: 'A dark cell is a 1'}, 'display text');
covered(partText('drive'), {[`every line at ${0}, ${f1(P.CHIP.supply[1])} or ${f1(P.CHIP.doubler)} V, the ${f1(P.CHIP.doubler)} V from`]: 'every line at 0, 1.5 or 3.0 V, the 3.0 V from', [`${f1(P.CHIP.wait.frame[1])} frames a second while the chip waits and ${f0(P.CHIP.operate.frame[1])} while it adds`]: '93.8 frames a second while the chip waits and 104 while it adds', [`${f2(def.rms.on)} V lit, darker, and ${f2(def.rms.off)} V dark`]: '2.12 V lit, darker, and 1.22 V dark'}, 'drive text');
covered(partText('power'), {[`light from ${f0(PW.lux[0])} to ${f0(PW.lux[1])} lx across, current from ${f1(PW.amps[0] * 1e6)} to ${f0(PW.amps[1] * 1e6)} μA up`]: 'light from 1 to 1,000 lx across, current from 0.1 to 100 μA up', [`Panasonic’s ${P.CELL.model} solar cell gives at ${f1(P.CELL.volts)} V`]: 'Panasonic’s AM-1417 solar cell gives at 1.5 V', [`the ${f1(w0)} μA the chip draws waiting and the ${f0(w1)} μA it draws adding`]: 'the 3.0 μA the chip draws waiting and the 13 μA it draws adding'}, 'power text');
t.ok(partText('display').includes('twice true size') && partText('system').includes('twice true size') && ['calculator', 'display', 'system'].every(id => partText(id).includes('true size')) && ['keypad', 'adder', 'drive'].every(id => partText(id).includes('not to scale')) && partText('power').includes('logarithmic scales'), 'every part says its scale');
for (const control of model.controls) covered(control.help, control.key === 'light' ? {[`office lighting as ${P.LUX.office[0]} to ${P.LUX.office[1]} lx`]: 'office lighting as 320 to 500 lx'} : {}, `${control.key} help`);
covered(model.playback.description, {[`${P.ADDER.slow} times slower`]: '100 times slower'}, 'playback');
covered(model.playback.stepLabel, {[`Advance ${f0(P.ADDER.tick * 1000)} ms`]: 'Advance 1 ms'}, 'step label');

// The readings carry the lesson's figures.
{
  const find = (readings, label) => readings.find(item => item.label === label);
  model.reset();
  const ready = model.getState().readings;
  t.ok(ready.map(item => item.label).join() === 'Your result,Answer,Key scan,Adder,Digit,Display,Drive,Power,Slowed' && ready.filter(item => item.hint).length === 8, 'nine readings, eight explained, the result first');
  t.ok(find(ready, 'Your result').value === `Ready · 25 in Y and 9 in X, and the display shows ${String(SRC.example[1])}; press Play to press =`, 'ready with the Calculator page’s 25 and 9');
  const done = run({}).readings;
  t.ok(find(done, 'Answer').value === String(SRC.example[2]) && find(done, 'Adder').value === '64 of 64 ticks' && find(done, 'Key scan').value === 'one press taken' && find(done, 'Digit').value === '5 + 9 = 14' && find(done, 'Display').value === `${hex(SRC.bytes[3])} ${hex(SRC.bytes[4])}` && find(done, 'Drive').value === `${f2(Math.sqrt(4.5))} V lit, ${f2(Math.sqrt(1.5))} V dark` && find(done, 'Power').value === `${f2(cellAt(320) * 1e6)} μA from the cell` && find(done, 'Slowed').value === '100 times', 'the readings at the answer');
  t.ok(find(done, 'Your result').value === `34 on the display, ${f1(def.duration * 1000)} ms after the press`, 'the answer 73.4 ms after the press');
  checkQuotedText(find(done, 'Key scan').hint, {'for 0.25 ms, so it reads = every 2 ms': `for ${f2(P.SCAN.poll * 1000)} ms, so it reads = every ${f0(P.SCAN.interval * 1000)} ms`, 'lifts K8 to 1.35 V, above the 1.1 V': `lifts K8 to ${f2(node(1.5, 180e3))} V, above the ${f1(1.5 - SRC.chip.margin)} V`, 'first at 9.375 ms': `first at ${f3(simulateScan(2.6, 4).end / 1000)} ms`}, t);
  checkQuotedText(find(done, 'Adder').hint, {'the same ticks would take 0.32 ms': `the same ticks would take ${f2(64 / (SRC.chip.operate.osc[1] * 1000) * 1000)} ms`, 'ticks at 1 kHz, 64 ms for the sum': 'ticks at 1 kHz, 64 ms for the sum'}, t);
  checkQuotedText(find(done, 'Digit').hint, {'14 + 6 = 20, whose four low bits hold 4': `${5 + 9} + ${16 - 10} = ${5 + 9 + 6}, whose four low bits hold ${(5 + 9 + 6) % 16}`, 'In bits: 0101 + 1001 = 01110': `In bits: ${bin4(5)} + ${bin4(9)} = ${(14).toString(2).padStart(5, '0')}`}, t);
  checkQuotedText(find(done, 'Display').hint, {'3 is 0011 and lights abcdg, 0x4F; 4 is 0100 and lights bcfg, 0x66': `3 is ${bin4(3)} and lights ${SRC.segments[3]}, ${hex(SRC.bytes[3])}; 4 is ${bin4(4)} and lights ${SRC.segments[4]}, ${hex(SRC.bytes[4])}`}, t);
  checkQuotedText(find(done, 'Drive').hint, {'2.12 V rms': `${f2(Math.sqrt((9 + 2.25 + 2.25) / 3))} V rms`, '1.22 V rms, 1.73 times less': `${f2(Math.sqrt(4.5 / 3))} V rms, ${f2(Math.sqrt(3))} times less`, '93.8 frames a second waiting and 104 while adding': '93.8 frames a second waiting and 104 while adding'}, t);
  checkQuotedText(find(done, 'Power').hint, {'21.28 μA at 320 lx': `${f2(cellAt(320) * 1e6)} μA at 320 lx`, 'which takes 45 lx': `which takes ${f0(waitLux)} lx`, 'which takes 195 lx': `which takes ${f0(operateLux)} lx`, 'logarithmic scales': 'logarithmic scales'}, t);
  checkQuotedText(find(done, 'Slowed').hint, {'the 73.4 ms from the press to the answer take 7.3 s': `the ${f1((simulateScan(2.6, 4).end + 64000) / 1000)} ms from the press to the answer take ${f1((simulateScan(2.6, 4).end + 64000) / 1e6 * 100)} s`, 'twice true size': 'twice true size'}, t);
  const cell = run({source: 1, light: 0}).readings;
  t.ok(find(cell, 'Power').value === 'LR44 button cell' && find(cell, 'Power').hint.includes(`${f0(40000)} hours`) && find(cell, 'Power').hint.includes(`about ${f1(40000 / 24 / 365.25)} years`), 'the button cell’s life');
  const dark = run({light: 40}).readings;
  t.ok(find(dark, 'Your result').value.startsWith('Dark') && find(dark, 'Drive').value === 'off' && find(dark, 'Display').value === 'blank' && find(dark, 'Key scan').value === 'not read' && find(dark, 'Your result').value.includes(`${f2(cellAt(40) * 1e6)} μA`), 'in the dark: nothing read, driven or shown');
  const big = run({first: 99999999, second: 1}).readings;
  t.ok(find(big, 'Answer').value === 'E 1.0000000' && find(big, 'Display').value.startsWith(`${hex(SRC.bytes.E)} ${hex(SRC.bytes[1])}`) && find(big, 'Your result').value.includes('9 digits'), 'the overflow read out');
}

t.ok(lesson.steps.length === 5 && lesson.parts.length === 6 && lesson.tryIt.length === 7 && lesson.deeper.length === 6 && lesson.quiz.answer === 0 && lesson.quiz.options.length === 3 && lesson.quiz.explanation, 'five steps, six parts, seven trials, six deeper sections and a quiz with its answer first');
t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every lesson part a part of the model');
t.ok(lesson.sources.length >= 2 && lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, 'every source a link, none twice');
t.ok(lesson.tryIt.every(trial => model.parts.some(item => item.id === trial.part) && trial.view === 'front' && trial.reset === true && trial.isolate === false && Object.keys(trial.values).join() === Object.keys(P.CALC_DEFAULTS).join()), 'every trial on a part the model has, from the defaults');

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [lo, hi, step] = P.CALC_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.CALC_DEFAULTS[control.key] && control.label && control.help, `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'first,second,bounce,debounce,light,source' && model.controls.at(-1).options.map(option => `${option.value}:${option.label}`).join() === '0:Solar cell,1:Button cell', 'six controls');
const drawing = () => [T.registerCells.flat(2).map(colorOf), pointsOf(T.contactGuide), pointsOf(T.takenTrace), pairsOf(T.countTicks), T.readDots.map(dot => [dot.visible, dot.position.x, dot.position.y]), pairsOf(T.marker), colorOf(T.marker), T.strip.visible, T.battery.visible, T.lcdBig.map(digit => Object.values(digit).map(mesh => mesh.visible)), T.bars.map(bar => bar.scale.y)];
checkControlsMove(model, drawing, m => m.advance(10), t);
checkRefusals(P.sampleCalculator, P.CALC_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available() && model.playback.blocked() === false && model.playback.label === 'Press =', 'nothing to inspect before the press');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, P.ADDER.tick, 1e-12, 'a step advances 1 ms of the chip');
  t.ok(JSON.stringify(model.getState().readings) !== before && !model.playback.complete() && !model.resultPart.available(), 'a step changes the readings, with no result to inspect partway');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, P.ADDER.tick + 0.5 / P.ADDER.slow, 1e-12, 'animation runs on by the time that passed, 100 times slower');
  model.reset();
  model.animate(1);
  model.animate(1.5);
  t.near(model.getState().clock, 1.5 / P.ADDER.slow, 1e-12, 'animation counts from the last time it was given, not from zero');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available() && model.getState().now.screen.text === '34', 'the answer shown, with the display to inspect');
  const held = JSON.stringify(drawing());
  model.animate(10);
  model.advance(50);
  t.ok(JSON.stringify(drawing()) === held, 'once shown, the answer holds');
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length === 9 && model.parts.some(item => item.id === action.part) && action.view === 'front' && action.replay === false, `${action.label} returns readings`); checkFinite(model.root, t); }
  model.reset();
  model.actions.find(action => action.part === 'keypad').run();
  const keyed = model.getState();
  t.ok(near(keyed.clock * 1e6, keyed.accepted, 1e-6) && keyed.now.polled === 5 && keyed.now.closed && colorOf(T.wires[8]) === K.high && colorOf(T.wires[5]) === K.polled, 'inspecting the key matrix stops the clock as = is taken, K5 driven and K8 reading high');
  model.reset();
  model.actions.find(action => action.part === 'adder').run();
  const adding = model.getState().now;
  t.ok(adding.tick && adding.tick.stage === 1 && adding.tick.digit === 0 && adding.decided === 1, 'inspecting the adder stops it correcting the units digit');
}
t.ok(model.parts.map(item => item.id).join() === 'system,calculator,keypad,adder,display,drive,power' && model.parts.every(item => item.description && (item.id === 'system' || item.parentId === 'system')), 'seven parts under the system, each described');
t.ok(model.initialPart === 'system' && model.initialView === 'front' && model.frameVisibleOnly === true && model.framePadding === 0.62 && model.resultPart.id === 'display' && model.resultPart.view === 'front' && typeof model.animate === 'function', 'the viewer’s settings');
const allText = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title), ...model.parts.flatMap(item => [item.name, item.description]), ...model.controls.flatMap(control => [control.label, control.help, control.unit, ...(control.options || []).map(option => option.label)]), ...model.actions.map(action => action.label), model.playback.label, model.playback.description, model.playback.stepLabel, model.resultPart.label];
for (const values of [...poseSettings, ...lesson.tryIt.map(trial => trial.values)]) {
  for (const time of [0, 0.3, 1, 100]) {
    model.reset();
    model.update(values);
    model.advance(time);
    const readings = model.getState().readings;
    t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
    allText.push(...readings.flatMap(item => [item.value, item.hint || '']));
    checkFinite(model.root, t);
  }
}
for (const text of allText) t.ok(!/[—–]| - |--/.test(text) && !/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium)\b/i.test(text), `no dashes and American spelling: ${String(text).slice(0, 60)}`);
t.ok(studyLessons.Calculator === L.calculatorLesson, 'the Calculator’s lesson is this one');
{
  const routed = createStudyModel('Calculator');
  t.ok(routed && routed.topology && routed.parts.some(item => item.id === 'adder') && routed.playback, 'the study family builds this model for the Calculator');
  routed.dispose();
}
const released = checkDisposal((() => { const fresh = M.createCalculatorModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS calculator: ${t.count} checks, ${counts.pairs} sums done again by schoolbook and integers, ${counts.ticks} adder ticks against the truth table, ${counts.micro} microseconds of scanning stepped, ${counts.poses} poses read back, ${counts.cells} cells, ${counts.gates} gates simulated from the drawing, ${counts.points} chart and wire points, ${counts.numbers} quoted numbers traced, 1 lesson, ${released} resources released exactly once.`);

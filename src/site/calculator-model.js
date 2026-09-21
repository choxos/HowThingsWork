import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines} from './scene-kit.js';
import {calculatorPlan, calculatorAt, driveLevels, bcdText, bitsOf, byteOf, KEYS, CHIP, CELL, BATTERY, PATTERNS, ERROR_PATTERN, LETTERS, SCAN, ADDER, LAYOUT, SOURCE_OPTIONS, CALC_DEFAULTS, CALC_DOMAINS} from './calculator-physics.js';

// ---------------------------------------------------------------------------
// Calculator: a pocket calculator, the key matrix its chip scans with a chart
// of one press of =, the bit serial adder that adds the two numbers, the
// display with its decoder, the voltages that drive the display, and the power.
//
// Scale: the calculator is drawn at true size, 1 mm to 0.01 scene units; its
// body is illustrative. The display is drawn twice true size, 1 mm to 0.02
// units. The key matrix, the adder, the drive and the power are diagrams, not
// to scale; the power chart is drawn on logarithmic scales of light and
// current, as its part text and its reading say.
//
// Time: the chip runs 100 times slower here than it does, said in the part
// text, the playback and a reading. The adder's clock of 1 kHz is a teaching
// clock, where the chip's own oscillator runs at 200 kHz while it works.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const LCD_MM = 0.02;

/** The calculator, mm about its middle: body, display window and its height, a digit's width, height and stroke, the digit pitch, the solar cell's middle, the keys and their columns and rows, a key legend's digit and bar. */
export const CALC = Object.freeze({origin: Object.freeze([-1.41, 0.76, 0]), body: Object.freeze([72, 118, 8]), lcd: Object.freeze([62, 18]), lcdY: 28, digit: Object.freeze([5, 9, 1]), pitch: 6.4, strip: Object.freeze([14, 47]), key: Object.freeze([13, 9]), keyX: Object.freeze([-24, -8, 8, 24]), keyY: Object.freeze([9, -5, -19, -33, -47]), legend: Object.freeze([2.8, 4.6, 0.55]), bar: Object.freeze([3.2, 0.55])});
/** The keys from the top row down: digits, point, minus, plus and equals; a space is a key drawn with no legend. */
export const KEYMAP = Object.freeze(['    ', '789 ', '456-', '123+', '0.= '].map(row => Object.freeze([...row])));
/** The key matrix diagram: spacing of its lines, where the lines leave the chip, the chip's left edge, a key's size, how far lines run past the last key, and how K0 to K2 rise and turn toward the chip. */
export const KEYPAD = Object.freeze({origin: Object.freeze([-0.44, 0.91, 0]), pitch: 0.075, left: -0.40, chipLeft: -0.46, key: 0.026, stub: 0.03, rise: 0.05, turn: 0.03});
/** The chart of one press under the key matrix: its box, the contact's and the taken key's low and high levels, the K5 slot bars, and the size of a read's dot. */
export const SCANCHART = Object.freeze({x: -0.46, y: -0.86, w: 0.92, h: 0.42, contact: Object.freeze([0.30, 0.38]), taken: Object.freeze([0.15, 0.23]), slot: Object.freeze([0.03, 0.06]), dot: 0.014, tick: 0.02});
/** The adder diagram: a register cell, the bit and digit spacing, the X and Y rows, the two full adders' left edges, the buffer, the box that decides the correction, the correction, the two carry flip-flops, a gate's width and height, the curve of an OR gate's back, and the wires' routes. */
export const ADDERVIEW = Object.freeze({origin: Object.freeze([1.07, 0.93, 0]), cell: 0.028, bit: 0.032, digitGap: 0.024, rows: Object.freeze([0.40, -0.40]), fa: Object.freeze([-0.56, 0.14]), buffer: 0.03, detector: -0.1, correction: -0.2, box: 0.034, flipflops: Object.freeze([-0.32, 0.38]), flipflopY: -0.24, gate: Object.freeze([0.08, 0.06]), bulge: 0.012, extra: 0.014, taps: Object.freeze([-0.62, -0.64]), tapY: Object.freeze([0.30, -0.31]), loopY: 0.20, frame: 0.006});
/** The display twice true size, with its decoder's input bits and output bits under each digit: [height, cell, pitch]. */
export const DISPLAY = Object.freeze({origin: Object.freeze([-1.15, -0.28, 0]), bits: Object.freeze([-0.235, 0.022, 0.026]), segmentBits: Object.freeze([-0.285, 0.012, 0.0155])});
/** The drive chart: its left edge and width for six slots, the base of each trace (commons 1 to 3, then segment lines 1 to 3), units a volt, and the rms bars. */
export const DRIVE = Object.freeze({origin: Object.freeze([0.19, -0.545, 0]), x: -0.42, w: 0.78, bases: Object.freeze([0.36, 0.25, 0.14, 0.03, -0.08, -0.19]), perVolt: 0.025, bars: Object.freeze({y: -0.42, h: 0.14, w: 0.06, pitch: 0.1})});
/** The power chart on logarithmic scales: its box, the light and current it spans, and the marker's arm. */
export const POWER = Object.freeze({origin: Object.freeze([1.28, -0.32, 0]), x: -0.40, y: -0.22, w: 0.8, h: 0.44, lux: Object.freeze([1, 1000]), amps: Object.freeze([0.1e-6, 100e-6]), marker: 0.02, tick: 0.015});
export const COLORS = Object.freeze({body: 0x3b4146, key: 0xe6e2d6, fn: 0x8d9893, legend: 0x2a2f2a, lcd: 0xc6d1ba, segment: 0x23291f, solar: 0x3a2d44, seam: 0x7d6d8b, battery: 0xb9bec2, rim: 0x6d7479, pressed: 0xd99a2b, bouncing: 0xf1d29b, chip: 0x374736, wire: 0x5d6a61, polled: 0xd99a2b, high: 0xc14f39, keyDot: 0x9aa39a, chart: 0x374736, faint: 0xb7bdb7, trace: 0x2b5d9c, taken: 0x374736, count: 0xd99a2b, slot: 0xe9c58a, one: 0x2b3a42, zero: 0xdce3df, frame: 0xd99a2b, signal: 0xd9682b, low: 0x8a918a, idle: 0xb3bcb3, gate: 0x374736, lit: 0x2b5d9c, dark: 0x9fb4c8, marker: 0xc14f39, spare: 0x8a918a});

export const timesTrue = perMM => perMM / MM;

/** A seven segment digit `w` wide and `h` high with strokes `s` thick: [x0, x1, y0, y1] about its middle for segments a to g and the point p. */
export function segmentRects(w, h, s) {
  const e = 0.12 * s, hx = w / 2, hy = h / 2;
  return {
    a: [-hx + s + e, hx - s - e, hy - s, hy],
    b: [hx - s, hx, s / 2 + e, hy - s - e],
    c: [hx - s, hx, -hy + s + e, -s / 2 - e],
    d: [-hx + s + e, hx - s - e, -hy, -hy + s],
    e: [-hx, -hx + s, -hy + s + e, -s / 2 - e],
    f: [-hx, -hx + s, s / 2 + e, hy - s - e],
    g: [-hx + s + e, hx - s - e, -s / 2, s / 2],
    p: [hx + 0.05 * s, hx + 0.65 * s, -hy, -hy + 0.7 * s],
  };
}

/** Key matrix: where polling line K`p` runs down and strobe line K`r` runs across. */
export const colX = p => (p - 3.5) * KEYPAD.pitch;
export const rowY = r => (6.5 - r) * KEYPAD.pitch;
/** The wire of line K`n`, as the key definition figure draws it: K0 to K2 come from the chip across the top and run down, K3 to K7 come in along their own row and turn down, and K8 to K10 run across. */
export function wireOf(n) {
  const bottom = rowY(CHIP.strobe[1]) - KEYPAD.stub, right = colX(CHIP.polling[1]) + KEYPAD.stub;
  if (n < CHIP.strobe[0]) { const top = rowY(CHIP.strobe[0]) + KEYPAD.rise + n * KEYPAD.turn; return [[KEYPAD.left, top], [colX(n), top], [colX(n), bottom]]; }
  if (n <= CHIP.polling[1]) return [[KEYPAD.left, rowY(n)], [colX(n), rowY(n)], [colX(n), bottom]];
  return [[KEYPAD.left, rowY(n)], [right, rowY(n)]];
}
export const chipBox = () => [KEYPAD.chipLeft, KEYPAD.left, rowY(CHIP.strobe[1]) - KEYPAD.stub - 0.01, rowY(CHIP.strobe[0]) + KEYPAD.rise + (CHIP.strobe[0] - 1) * KEYPAD.turn + 0.03];

/** The chart of one press: x for a time in ms. */
export const scanX = ms => SCANCHART.x + Math.max(0, Math.min(1, ms / (SCAN.window * 1000))) * SCANCHART.w;
/** The = key's contact through the chart's span as [ms, 0 open or 1 closed] corners, springing open in the declared windows of the bounce. */
export function contactSteps(bounceMicro) {
  const points = [[0, 0], [0, 1]];
  if (bounceMicro > 0) for (const [from, to] of SCAN.open) points.push([from * bounceMicro / 1e5, 1], [from * bounceMicro / 1e5, 0], [to * bounceMicro / 1e5, 0], [to * bounceMicro / 1e5, 1]);
  points.push([SCAN.window * 1000, 1]);
  return points;
}
/** Corners of a step trace cut off at `ms`. */
export const stepsUntil = (points, ms) => { const kept = points.filter(([at]) => at <= ms); return kept.length ? [...kept, [ms, kept.at(-1)[1]]] : []; };

/** Adder: the middle of register cell `q` (0 is the highest bit) of digit group `i` (0 is the leftmost digit), and of buffer or correction cell `q`. */
export const cellX = (i, q) => -(8 * 4 * ADDERVIEW.bit - (ADDERVIEW.bit - ADDERVIEW.cell) + 7 * ADDERVIEW.digitGap) / 2 + ADDERVIEW.cell / 2 + i * (4 * ADDERVIEW.bit + ADDERVIEW.digitGap) + q * ADDERVIEW.bit;
export const smallX = q => (q - 1.5) * ADDERVIEW.bit;

/** A full adder's gates, about its left edge at the adder's middle: [kind, left, middle, the signal it puts out], named as fullAdder() names them. */
export const GATES = Object.freeze([['xor', 0.06, 0.06, 'x'], ['and', 0.06, -0.04, 'and1'], ['xor', 0.20, 0.03, 'sum'], ['and', 0.20, -0.09, 'and2'], ['or', 0.34, -0.055, 'out']].map(Object.freeze));
export const pinOf = ([kind, left, middle], which) => [left + (kind === 'and' ? 0 : 0.75 * ADDERVIEW.bulge), middle + (which === 0 ? 1 : -1) * ADDERVIEW.gate[1] / 4];
export const outOf = ([, left, middle]) => [left + ADDERVIEW.gate[0], middle];
/** Its wires, each carrying one signal: A and B from the registers or the buffer and the correction, the carry, and what each gate puts out. */
export const FA_WIRES = Object.freeze((() => {
  const [xor1, and1, xor2, and2, or] = GATES;
  return [
    ['a', [[0, 0.075], pinOf(xor1, 0)]], ['a', [[0.02, 0.075], [0.02, -0.025], pinOf(and1, 0)]],
    ['b', [[0, 0.045], pinOf(xor1, 1)]], ['b', [[0.035, 0.045], [0.035, -0.055], pinOf(and1, 1)]],
    ['x', [outOf(xor1), [0.16, 0.06], [0.16, 0.045], pinOf(xor2, 0)]], ['x', [[0.16, 0.045], [0.16, -0.075], pinOf(and2, 0)]],
    ['carry', [[0, -0.105], pinOf(and2, 1)]], ['carry', [[0.175, -0.105], [0.175, 0.015], pinOf(xor2, 1)]],
    ['and1', [outOf(and1), pinOf(or, 0)]], ['and2', [outOf(and2), [0.31, -0.09], [0.31, -0.07], pinOf(or, 1)]],
    ['sum', [outOf(xor2), [0.45, 0.03]]], ['out', [outOf(or), [0.45, -0.055]]],
  ].map(([signal, points]) => Object.freeze([signal, Object.freeze(points.map(Object.freeze))]));
})());

/** A gate's outline as pairs of points: an AND gate's flat back and round front, an OR gate's curved back and pointed front, and an XOR gate's second back. */
export function gateOutline(kind, left, middle, steps = 12) {
  const [w, h] = ADDERVIEW.gate, top = middle + h / 2, bottom = middle - h / 2, b = ADDERVIEW.bulge, pairs = [];
  const poly = points => { for (let i = 1; i < points.length; i++) pairs.push(points[i - 1], points[i]); };
  const quad = (p0, p1, p2) => Array.from({length: steps + 1}, (_, i) => { const t = i / steps, u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; });
  if (kind === 'and') {
    const cx = left + w - h / 2;
    poly([[left, top], [left, bottom], ...Array.from({length: steps + 1}, (_, i) => { const a = -Math.PI / 2 + Math.PI * i / steps; return [cx + h / 2 * Math.cos(a), middle + h / 2 * Math.sin(a)]; }), [left, top]]);
  } else {
    const tip = [left + w, middle];
    poly(quad([left, top], [left + 2 * b, middle], [left, bottom]));
    poly(quad([left, top], [left + 0.62 * w, top], tip));
    poly(quad([left, bottom], [left + 0.62 * w, bottom], tip));
    if (kind === 'xor') poly(quad([left - ADDERVIEW.extra, top], [left - ADDERVIEW.extra + 2 * b, middle], [left - ADDERVIEW.extra, bottom]));
  }
  return pairs;
}

/** The adder's wires outside its two full adders, and its taps from the register cells being read. */
export function adderLinks() {
  const [fa1, fa2] = ADDERVIEW.fa, c = ADDERVIEW.cell / 2, box = ADDERVIEW.box / 2, [ff1, ff2] = ADDERVIEW.flipflops, fy = ADDERVIEW.flipflopY, edge = smallX(3) + c;
  return {
    s1: [[fa1 + 0.45, 0.03], [-edge, ADDERVIEW.buffer]],
    out1: [[fa1 + 0.45, -0.055], [-0.085, -0.055], [-0.085, fy], [ff1 + c, fy]],
    ff1: [[ff1 - c, fy], [fa1 - 0.04, fy], [fa1 - 0.04, -0.105], [fa1, -0.105]],
    a2: [[edge, ADDERVIEW.buffer], [0.09, ADDERVIEW.buffer], [0.09, 0.075], [fa2, 0.075]],
    b2: [[edge, ADDERVIEW.correction], [0.105, ADDERVIEW.correction], [0.105, 0.045], [fa2, 0.045]],
    ff2: [[ff2 - c, fy], [0.12, fy], [0.12, -0.105], [fa2, -0.105]],
    out2: [[fa2 + 0.45, -0.055], [0.615, -0.055], [0.615, fy], [ff2 + c, fy]],
    s2: [[fa2 + 0.45, 0.03], [0.635, 0.03], [0.635, ADDERVIEW.loopY], [0, ADDERVIEW.loopY], [0, ADDERVIEW.buffer + c]],
    detIn: [[0, ADDERVIEW.buffer - c], [0, ADDERVIEW.detector + box]],
    detOut: [[0, ADDERVIEW.detector - box], [0, ADDERVIEW.correction + c]],
  };
}
export const tapOf = (row, i, q) => {
  const x = cellX(i, q), [top, bottom] = ADDERVIEW.rows, c = ADDERVIEW.cell / 2, [fa1] = ADDERVIEW.fa;
  return row === 0 ? [[x, top - c], [x, ADDERVIEW.tapY[0]], [ADDERVIEW.taps[0], ADDERVIEW.tapY[0]], [ADDERVIEW.taps[0], 0.075], [fa1, 0.075]]
    : [[x, bottom + c], [x, ADDERVIEW.tapY[1]], [ADDERVIEW.taps[1], ADDERVIEW.tapY[1]], [ADDERVIEW.taps[1], 0.045], [fa1, 0.045]];
};

/** Display: the middle of digit `i`, 0 the sign digit, twice true size. */
export const digitX = i => (i - 4) * CALC.pitch * LCD_MM;
/** Drive chart: x of the start of slot `s`, y of a level on trace `n`. */
export const slotX = s => DRIVE.x + s / (2 * CHIP.commons) * DRIVE.w;
export const levelY = (n, volts) => DRIVE.bases[n] + volts * DRIVE.perVolt;
/** Power chart: x for a light in lx and y for a current in A, both on logarithmic scales. */
export const luxX = lux => POWER.x + Math.log10(lux / POWER.lux[0]) / Math.log10(POWER.lux[1] / POWER.lux[0]) * POWER.w;
export const ampY = amps => POWER.y + Math.log10(amps / POWER.amps[0]) / Math.log10(POWER.amps[1] / POWER.amps[0]) * POWER.h;

const hex = byte => `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`;
const bin4 = digit => bitsOf(digit).reverse().join('');
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const uA = amps => amps * 1e6;
const z3 = (points, z) => points.map(([x, y]) => [x, y, z]);

export function createCalculatorModel() {
  const kit = houseModel('Calculator'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const plane = new THREE.PlaneGeometry(1, 1), shared = new Map();
  const flat = (color, parent, own = false) => {
    if (!own && !shared.has(color)) shared.set(color, new THREE.MeshBasicMaterial({color}));
    const mesh = new THREE.Mesh(plane, own ? new THREE.MeshBasicMaterial({color}) : shared.get(color));
    parent.add(mesh);
    return mesh;
  };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const outline = (line, x0, x1, y0, y1, z = 0) => fillLine(line, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]]);
  const digitMeshes = (parent, cx, cy, [w, h, s], color, z) => {
    const rects = segmentRects(w, h, s), meshes = {};
    for (const letter of [...LETTERS, 'p']) { const mesh = flat(color, parent); const [x0, x1, y0, y1] = rects[letter]; rect(mesh, cx + x0, cx + x1, cy + y0, cy + y1, z); meshes[letter] = mesh; }
    return meshes;
  };
  const showDigit = (meshes, segments, point) => { for (const letter of LETTERS) meshes[letter].visible = segments.includes(letter); meshes.p.visible = point; };
  const showScreen = (digits, screen) => { showDigit(digits[0], screen.sign, false); screen.digits.forEach((item, i) => showDigit(digits[i + 1], item.segments, item.point)); };

  const system = part('system', 'Calculator, close up', `A pocket calculator at true size and its display twice true size, with what happens inside its chip drawn as diagrams: the key matrix with a chart of one press, the adder, the voltages that drive the display, and the power. Press Play to press =: the chip runs ${ADDER.slow} times slower here than it does.`);

  // The calculator at true size.
  const calculator = part('calculator', 'Calculator, true size', `A pocket calculator drawn at true size, 1 mm to ${MM} units, with an illustrative body: its display of a sign digit and ${CHIP.digits} digits, its keys, and Panasonic’s ${CELL.model} solar cell, ${f1(CELL.size[0])} mm by ${f1(CELL.size[1])} mm. With the button cell chosen, an ${BATTERY.iec} ${f1(BATTERY.size[0])} mm across is drawn where the solar cell was, as if seen through the case. The = key turns gold while its contact is closed and pale while it bounces open.`, CALC.origin, system);
  const [bw, bh, bd] = CALC.body;
  const body = kit.box([bw * MM, bh * MM, bd * MM], [0, 0, -bd * MM / 2], COLORS.body, calculator);
  const strip = flat(COLORS.solar, calculator), [sx, sy] = CALC.strip, [cw, ch] = CELL.size;
  rect(strip, (sx - cw / 2) * MM, (sx + cw / 2) * MM, (sy - ch / 2) * MM, (sy + ch / 2) * MM, 0.001);
  const cells = Math.round(CELL.open / CELL.perCell), seams = segmentLines(cells - 1, COLORS.seam, calculator);
  fillLine(seams, Array.from({length: cells - 1}, (_, q) => { const x = (sx - cw / 2 + cw * (q + 1) / cells) * MM; return [[x, (sy - ch / 2) * MM, 0.0015], [x, (sy + ch / 2) * MM, 0.0015]]; }).flat());
  const battery = new THREE.Mesh(new THREE.CircleGeometry(BATTERY.size[0] / 2 * MM, 48), new THREE.MeshBasicMaterial({color: COLORS.battery}));
  battery.position.set(sx * MM, sy * MM, 0.001);
  calculator.add(battery);
  const batteryRim = lineObject(49, COLORS.rim, calculator);
  fillLine(batteryRim, Array.from({length: 49}, (_, i) => { const a = 2 * Math.PI * i / 48; return [(sx + BATTERY.size[0] / 2 * Math.cos(a)) * MM, (sy + BATTERY.size[0] / 2 * Math.sin(a)) * MM, 0.0015]; }));
  const lcdWindow = flat(COLORS.lcd, calculator);
  rect(lcdWindow, -CALC.lcd[0] / 2 * MM, CALC.lcd[0] / 2 * MM, (CALC.lcdY - CALC.lcd[1] / 2) * MM, (CALC.lcdY + CALC.lcd[1] / 2) * MM, 0.001);
  const lcdSmall = Array.from({length: CHIP.digits + 1}, (_, i) => digitMeshes(calculator, (i - 4) * CALC.pitch * MM, CALC.lcdY * MM, CALC.digit.map(size => size * MM), COLORS.segment, 0.002));
  const keys = [], legends = [];
  let equalsKey = null;
  KEYMAP.forEach((row, rowIndex) => row.forEach((label, col) => {
    const x = CALC.keyX[col] * MM, y = CALC.keyY[rowIndex] * MM, [kw, kh] = CALC.key;
    const key = flat(label === ' ' ? COLORS.fn : COLORS.key, calculator, label === '=');
    rect(key, x - kw / 2 * MM, x + kw / 2 * MM, y - kh / 2 * MM, y + kh / 2 * MM, 0.001);
    keys.push(key);
    if (label === '=') equalsKey = key;
    const [lw, lh, ls] = CALC.legend, [bl, bt] = CALC.bar, bar = (x0, x1, y0, y1) => { const mesh = flat(COLORS.legend, calculator); rect(mesh, x + x0 * MM, x + x1 * MM, y + y0 * MM, y + y1 * MM, 0.002); legends.push(mesh); };
    if (/\d/.test(label)) { const meshes = digitMeshes(calculator, x, y, [lw * MM, lh * MM, ls * MM], COLORS.legend, 0.002); showDigit(meshes, PATTERNS[Number(label)], false); legends.push(...Object.values(meshes)); }
    if (label === '+' || label === '-') bar(-bl / 2, bl / 2, -bt / 2, bt / 2);
    if (label === '+') bar(-bt / 2, bt / 2, -bl / 2, bl / 2);
    if (label === '=') { bar(-bl / 2, bl / 2, 0.75 - bt / 2, 0.75 + bt / 2); bar(-bl / 2, bl / 2, -0.75 - bt / 2, -0.75 + bt / 2); }
    if (label === '.') bar(-0.4, 0.4, -0.4, 0.4);
  }));

  // The key matrix and the chart of one press.
  const keypad = part('keypad', 'Key matrix', `The key matrix of the ${CHIP.name} calculator chip, a diagram not to scale. The chip drives its polling lines K0 to K7 one at a time, the one driven in gold, and reads its strobe lines K3 to K10, each held low through ${f0(CHIP.pullDown[1] / 1000)} kΩ; K3 to K7 do both, coming in along a row and turning down. A key sits where a strobe line crosses a polling line that starts above it, ${KEYS.length} keys in all, and = sits where K8 crosses K5: while K5 is driven and = is closed, K8 reads high and turns red. Below, the first ${f0(SCAN.window * 1000)} ms of a press of =. Top trace: the contact, high when closed, springing open as it bounces, with a dot for each read of = in its K5 slot, every ${f0(SCAN.interval * 1000)} ms. Lower trace: the key as the chip takes it, with a gold tick for each press it counts. Gold bars along the bottom mark the K5 slots.`, KEYPAD.origin, system);
  const [chipX0, chipX1, chipY0, chipY1] = chipBox();
  const chipBody = flat(COLORS.chip, keypad);
  rect(chipBody, chipX0, chipX1, chipY0, chipY1);
  const wires = Array.from({length: CHIP.strobe[1] + 1}, (_, n) => { const wire = lineObject(3, COLORS.wire, keypad); fillLine(wire, z3(wireOf(n), 0)); return wire; });
  let equalsSquare = null;
  const keySquares = KEYS.map(({strobe, poll}) => {
    const equals = strobe === CHIP.equals.strobe && poll === CHIP.equals.poll, square = flat(equals ? COLORS.key : COLORS.keyDot, keypad, equals), half = KEYPAD.key / 2;
    rect(square, colX(poll) - half, colX(poll) + half, rowY(strobe) - half, rowY(strobe) + half, 0.001);
    if (equals) equalsSquare = square;
    return square;
  });
  const SC = SCANCHART, chartFrame = lineObject(5, COLORS.chart, keypad);
  outline(chartFrame, SC.x, SC.x + SC.w, SC.y, SC.y + SC.h);
  const slotCount = Math.floor(SCAN.window / (SCAN.poll * SCAN.lines) + 1e-9);
  const slotBars = Array.from({length: slotCount}, (_, k) => { const bar = flat(COLORS.slot, keypad), from = (k * SCAN.lines + CHIP.equals.poll) * SCAN.poll * 1000; rect(bar, scanX(from), scanX(from + SCAN.poll * 1000), SC.y + SC.slot[0], SC.y + SC.slot[1], 0.001); return bar; });
  const timeTicks = segmentLines(Math.round(SCAN.window / SCAN.interval) + 1, COLORS.chart, keypad);
  fillLine(timeTicks, Array.from({length: Math.round(SCAN.window / SCAN.interval) + 1}, (_, i) => { const x = scanX(i * SCAN.interval * 1000); return [[x, SC.y, 0], [x, SC.y - SC.tick, 0]]; }).flat());
  const contactGuide = lineObject(24, COLORS.faint, keypad), contactTrace = lineObject(26, COLORS.trace, keypad), takenTrace = lineObject(16, COLORS.taken, keypad);
  const readDots = Array.from({length: slotCount}, () => flat(COLORS.trace, keypad));
  const countTicks = segmentLines(4, COLORS.count, keypad), scanCursor = segmentLines(1, COLORS.chart, keypad);
  const contactY = level => SC.y + SC.contact[level], takenY = level => SC.y + SC.taken[level];

  // The adder.
  const A = ADDERVIEW, adder = part('adder', 'Bit serial adder', `The adder, a diagram not to scale. Top row: the X register, holding the second number; bottom row: the Y register, holding the first; each is ${CHIP.digits} digits of 4 bits, the most significant digit on the left and each digit’s highest bit on its left, with a dark cell for a 1. The gold frames mark the digit being added and the bit being read; in a real chip the registers shift a bit at a time instead. The left full adder, two XOR gates, two AND gates and an OR gate, adds the X bit, the Y bit and the carry kept in the flip-flop below it, and puts the sum into the 4-bit buffer in the middle. Once a digit’s 4 bits are in, the box under the buffer lights if the sum passed 9 or carried, and the right full adder adds 0110 to the buffer a bit at a time, or 0000 if not. A lit wire carries a 1. The digit then goes into X and its carry into the next digit. The chip runs ${ADDER.slow} times slower here.`, A.origin, system);
  const registerCells = A.rows.map(y => Array.from({length: CHIP.digits}, (_, i) => Array.from({length: 4}, (_, q) => { const cell = flat(COLORS.zero, adder, true); rect(cell, cellX(i, q) - A.cell / 2, cellX(i, q) + A.cell / 2, y - A.cell / 2, y + A.cell / 2); return cell; })));
  const smallCells = y => Array.from({length: 4}, (_, q) => { const cell = flat(COLORS.zero, adder, true); rect(cell, smallX(q) - A.cell / 2, smallX(q) + A.cell / 2, y - A.cell / 2, y + A.cell / 2); return cell; });
  const bufferCells = smallCells(A.buffer), correctionCells = smallCells(A.correction);
  const detector = flat(COLORS.zero, adder, true);
  rect(detector, -A.box / 2, A.box / 2, A.detector - A.box / 2, A.detector + A.box / 2);
  const flipflops = A.flipflops.map(x => { const cell = flat(COLORS.zero, adder, true); rect(cell, x - A.cell / 2, x + A.cell / 2, A.flipflopY - A.cell / 2, A.flipflopY + A.cell / 2); return cell; });
  const gates = A.fa.map(left => GATES.map(([kind, gx, gy]) => { const gate = segmentLines(48, COLORS.gate, adder); fillLine(gate, z3(gateOutline(kind, left + gx, gy), 0.001)); return gate; }));
  const faWires = A.fa.map(left => FA_WIRES.map(([, points]) => { const wire = lineObject(points.length, COLORS.idle, adder); fillLine(wire, z3(points.map(([x, y]) => [left + x, y]), 0)); return wire; }));
  const linkPoints = adderLinks(), links = Object.fromEntries(Object.entries(linkPoints).map(([name, points]) => { const wire = lineObject(points.length, COLORS.idle, adder); fillLine(wire, z3(points, 0)); return [name, wire]; }));
  const taps = [lineObject(5, COLORS.low, adder), lineObject(5, COLORS.low, adder)];
  const groupFrames = [lineObject(5, COLORS.frame, adder), lineObject(5, COLORS.frame, adder)], bitFrames = [lineObject(5, COLORS.frame, adder), lineObject(5, COLORS.frame, adder)];

  // The display twice true size, with its decoder.
  const display = part('display', 'Display and decoder', `The display drawn twice true size, 1 mm to ${LCD_MM} units: a sign digit, which shows E when an answer overflows, and ${CHIP.digits} digits, with leading zeros left blank. Under each digit, the decoder’s input, the digit’s 4 bits, and below them its output, a bit for each segment in the Seven-segment display page’s gfedcba order: g on the left and a on the right. A dark cell is a 1.`, DISPLAY.origin, system);
  const lcdWindowBig = flat(COLORS.lcd, display);
  rect(lcdWindowBig, -CALC.lcd[0] / 2 * LCD_MM, CALC.lcd[0] / 2 * LCD_MM, -CALC.lcd[1] / 2 * LCD_MM, CALC.lcd[1] / 2 * LCD_MM);
  const lcdBig = Array.from({length: CHIP.digits + 1}, (_, i) => digitMeshes(display, digitX(i), 0, CALC.digit.map(size => size * LCD_MM), COLORS.segment, 0.001));
  const [bitsY, bitCell, bitPitch] = DISPLAY.bits, [segY, segCell, segPitch] = DISPLAY.segmentBits;
  const bitCells = Array.from({length: CHIP.digits}, (_, i) => Array.from({length: 4}, (_, q) => { const cell = flat(COLORS.zero, display, true), x = digitX(i + 1) + (q - 1.5) * bitPitch; rect(cell, x - bitCell / 2, x + bitCell / 2, bitsY - bitCell / 2, bitsY + bitCell / 2); return cell; }));
  const segmentCells = Array.from({length: CHIP.digits}, (_, i) => Array.from({length: 7}, (_, q) => { const cell = flat(COLORS.zero, display, true), x = digitX(i + 1) + (q - 3) * segPitch; rect(cell, x - segCell / 2, x + segCell / 2, segY - segCell / 2, segY + segCell / 2); return cell; }));

  // The drive of the rightmost digit.
  const drive = part('drive', 'Display drive', `How the chip drives the rightmost digit, a diagram not to scale. The top three traces are the display’s three commons and the next three its three segment lines, over two frames of three slots each, every line at 0, ${f1(CHIP.supply[1])} or ${f1(CHIP.doubler)} V, the ${f1(CHIP.doubler)} V from the chip’s voltage doubler. The gold frame marks the slot being driven, ${f1(CHIP.wait.frame[1])} frames a second while the chip waits and ${f0(CHIP.operate.frame[1])} while it adds. The bars below give the rms voltage across each of the digit’s segments, a to g from the left: ${f2(Math.sqrt((CHIP.doubler ** 2 + 2 * (CHIP.doubler - CHIP.supply[1]) ** 2) / 3))} V lit, darker, and ${f2(Math.sqrt(2 * (CHIP.doubler - CHIP.supply[1]) ** 2 / 3))} V dark, paler.`, DRIVE.origin, system);
  const traces = Array.from({length: 2 * CHIP.commons}, (_, n) => lineObject(4 * CHIP.commons, n < CHIP.commons ? COLORS.chart : COLORS.trace, drive));
  const top = levelY(0, CHIP.doubler) + 0.01, bottom = DRIVE.bases.at(-1) - 0.01;
  const slotLines = segmentLines(2 * CHIP.commons + 1, COLORS.faint, drive);
  fillLine(slotLines, Array.from({length: 2 * CHIP.commons + 1}, (_, s) => [[slotX(s), bottom, 0], [slotX(s), top, 0]]).flat());
  const baselines = segmentLines(2 * CHIP.commons, COLORS.faint, drive);
  fillLine(baselines, DRIVE.bases.flatMap(base => [[slotX(0), base, 0], [slotX(2 * CHIP.commons), base, 0]]));
  const driveCursor = lineObject(5, COLORS.frame, drive);
  const bars = Array.from({length: 7}, () => flat(COLORS.dark, drive, true)), barBase = segmentLines(1, COLORS.chart, drive);
  const barX = q => (q - 3) * DRIVE.bars.pitch;
  fillLine(barBase, [[barX(0) - DRIVE.bars.w, DRIVE.bars.y, 0], [barX(6) + DRIVE.bars.w, DRIVE.bars.y, 0]]);

  // The power chart.
  const PW = POWER, power = part('power', 'Power', `The power, on logarithmic scales: light from ${f0(PW.lux[0])} to ${f0(PW.lux[1])} lx across, current from ${fixed(uA(PW.amps[0]), 1)} to ${f0(uA(PW.amps[1]))} μA up, with a tick at every factor of ten. The rising line is the current Panasonic’s ${CELL.model} solar cell gives at ${f1(CELL.volts)} V, in proportion to the light. The flat lines are the ${f1(uA(CHIP.wait.current[0]))} μA the chip draws waiting and the ${f0(uA(CHIP.operate.current[0]))} μA it draws adding, with a tick where the cell’s line reaches each. The cross marks the room’s light; with the button cell chosen it turns gray.`, PW.origin, system);
  const powerFrame = lineObject(5, COLORS.chart, power);
  outline(powerFrame, PW.x, PW.x + PW.w, PW.y, PW.y + PW.h);
  const decades = Math.round(Math.log10(PW.lux[1] / PW.lux[0])), powerTicks = segmentLines(2 * (decades + 1), COLORS.chart, power);
  fillLine(powerTicks, Array.from({length: decades + 1}, (_, i) => [[luxX(PW.lux[0] * 10 ** i), PW.y, 0], [luxX(PW.lux[0] * 10 ** i), PW.y - PW.tick, 0], [PW.x, ampY(PW.amps[0] * 10 ** i), 0], [PW.x - PW.tick, ampY(PW.amps[0] * 10 ** i), 0]]).flat());
  const cellLine = lineObject(2, COLORS.trace, power), startLux = CELL.lux * PW.amps[0] / CELL.current;
  fillLine(cellLine, [[luxX(startLux), ampY(PW.amps[0]), 0], [luxX(PW.lux[1]), ampY(CELL.current * PW.lux[1] / CELL.lux), 0]]);
  const chipLines = [CHIP.wait.current[0], CHIP.operate.current[0]].map(amps => { const line = lineObject(2, COLORS.chart, power); fillLine(line, [[PW.x, ampY(amps), 0], [PW.x + PW.w, ampY(amps), 0]]); return line; });
  const thresholdTicks = segmentLines(2, COLORS.faint, power);
  fillLine(thresholdTicks, [CHIP.wait.current[0], CHIP.operate.current[0]].flatMap(amps => { const x = luxX(CELL.lux * amps / CELL.current); return [[x, PW.y, 0], [x, ampY(amps), 0]]; }));
  const marker = segmentLines(2, COLORS.marker, power);

  const d = CALC_DEFAULTS;
  control('first', 'First number', ...CALC_DOMAINS.first, d.first, '', 'The number entered first. Entering the second pushes it into the Y register.');
  control('second', 'Second number', ...CALC_DOMAINS.second, d.second, '', 'The number entered second: it sits in the X register and on the display until = is pressed.');
  control('bounce', 'Key bounce', ...CALC_DOMAINS.bounce, d.bounce, 'ms', 'How long the = key’s contact bounces before it settles. Its contact springs open four times, at declared shares of this time.');
  control('debounce', 'Debounce', ...CALC_DOMAINS.debounce, d.debounce, 'reads', 'How many reads in a row must agree before the chip takes the key as down or up.');
  control('light', 'Room light', ...CALC_DOMAINS.light, d.light, 'lx', 'The light falling on the solar cell. The Lux page gives office lighting as 320 to 500 lx.');
  control('source', 'Power', ...CALC_DOMAINS.source, d.source, '', 'A solar cell, whose current follows the light, or a button cell.', SOURCE_OPTIONS);

  const result = finish(v => {
    const plan = calculatorPlan(v), now = calculatorAt(plan, clock), screen = now.screen, {serial, power: pw} = plan, total = serial.ticks.length, tick = now.tick;

    // The calculator.
    strip.visible = seams.visible = plan.values.source === 0;
    battery.visible = batteryRim.visible = plan.values.source === 1;
    showScreen(lcdSmall, screen);
    const keyColor = !now.pressed ? COLORS.key : now.closed ? COLORS.pressed : COLORS.bouncing;
    equalsKey.material.color.setHex(keyColor);
    equalsSquare.material.color.setHex(keyColor);

    // The key matrix: the polling line driven, and K8 reading high while = is closed in the K5 slot.
    const readsHigh = now.polled === CHIP.equals.poll && now.closed;
    wires.forEach((wire, n) => wire.material.color.setHex(now.polled === n ? COLORS.polled : n === CHIP.equals.strobe && readsHigh ? COLORS.high : COLORS.wire));
    const ms = now.t * 1000, steps = contactSteps(plan.bounceMicro);
    fillLine(contactGuide, steps.map(([at, level]) => [scanX(at), contactY(level), 0]));
    fillLine(contactTrace, now.pressed ? stepsUntil(steps, Math.min(ms, SCAN.window * 1000)).map(([at, level]) => [scanX(at), contactY(level), 0.001]) : []);
    readDots.forEach((dot, k) => {
      const read = now.reads[k], shown = Boolean(read) && read.micro <= SCAN.window * 1e6;
      dot.visible = shown;
      if (shown) rect(dot, scanX(read.micro / 1000) - SC.dot / 2, scanX(read.micro / 1000) + SC.dot / 2, contactY(read.closed ? 1 : 0) - SC.dot / 2, contactY(read.closed ? 1 : 0) + SC.dot / 2, 0.002);
    });
    const taken = [[0, 0]];
    for (const read of now.reads) if (read.flipped) taken.push([read.micro / 1000, read.down ? 0 : 1], [read.micro / 1000, read.down ? 1 : 0]);
    fillLine(takenTrace, plan.runs && now.pressed ? [...taken, [Math.min(ms, SCAN.window * 1000), now.down ? 1 : 0]].map(([at, level]) => [scanX(at), takenY(level), 0.001]) : []);
    fillLine(countTicks, now.reads.filter(read => read.flipped && read.down).flatMap(read => [[scanX(read.micro / 1000), SC.y + SC.taken[0] - 0.03, 0.002], [scanX(read.micro / 1000), SC.y + SC.taken[1] + 0.03, 0.002]]));
    fillLine(scanCursor, now.pressed && ms <= SCAN.window * 1000 ? [[scanX(ms), SC.y, 0.002], [scanX(ms), SC.y + SC.h, 0.002]] : []);

    // The adder: the registers, the buffer, the correction and the carries, and every wire and gate of the full adder at work.
    const bitColor = bit => (bit ? COLORS.one : COLORS.zero);
    for (let k = 0; k < CHIP.digits; k++) {
      const xBits = bitsOf(now.x[k]), yBits = bitsOf(serial.yDigits[k]);
      for (let j = 0; j < 4; j++) { registerCells[0][7 - k][3 - j].material.color.setHex(bitColor(xBits[j])); registerCells[1][7 - k][3 - j].material.color.setHex(bitColor(yBits[j])); }
    }
    now.buffer.forEach((bit, j) => bufferCells[3 - j].material.color.setHex(bitColor(bit)));
    const correction = now.decided === null ? [0, 0, 0, 0] : bitsOf(now.decided ? 6 : 0);
    correction.forEach((bit, j) => correctionCells[3 - j].material.color.setHex(bitColor(bit)));
    detector.material.color.setHex(now.decided === 1 ? COLORS.signal : COLORS.zero);
    flipflops[0].material.color.setHex(bitColor(now.carry));
    flipflops[1].material.color.setHex(bitColor(now.second));
    const stage = tick ? tick.stage : null, wireColor = (active, bit) => (!active ? COLORS.idle : bit ? COLORS.signal : COLORS.low);
    A.fa.forEach((_, fa) => {
      GATES.forEach(([, , , signal], g) => gates[fa][g].material.color.setHex(stage === fa && tick[signal] ? COLORS.signal : COLORS.gate));
      FA_WIRES.forEach(([signal], w) => faWires[fa][w].material.color.setHex(wireColor(stage === fa, tick?.[signal])));
    });
    links.s1.material.color.setHex(wireColor(stage === 0, tick?.sum));
    links.out1.material.color.setHex(wireColor(stage === 0, tick?.out));
    links.a2.material.color.setHex(wireColor(stage === 1, tick?.a));
    links.b2.material.color.setHex(wireColor(stage === 1, tick?.b));
    links.out2.material.color.setHex(wireColor(stage === 1, tick?.out));
    links.s2.material.color.setHex(wireColor(stage === 1, tick?.sum));
    links.ff1.material.color.setHex(wireColor(now.adding, now.carry));
    links.ff2.material.color.setHex(wireColor(now.adding, now.second));
    links.detIn.material.color.setHex(wireColor(now.decided !== null, 0));
    links.detOut.material.color.setHex(wireColor(now.decided !== null, now.decided));
    if (tick) {
      const i = 7 - tick.digit, q = 3 - tick.bit, box = (line, x, y, half) => outline(line, x - half, x + half, y - half, y + half, 0.002);
      A.rows.forEach((y, row) => outline(groupFrames[row], cellX(i, 0) - A.cell / 2 - A.frame, cellX(i, 3) + A.cell / 2 + A.frame, y - A.cell / 2 - A.frame, y + A.cell / 2 + A.frame, 0.002));
      if (stage === 0) A.rows.forEach((y, row) => box(bitFrames[row], cellX(i, q), y, A.cell / 2 + A.frame / 2));
      else [A.buffer, A.correction].forEach((y, row) => box(bitFrames[row], smallX(q), y, A.cell / 2 + A.frame / 2));
      taps.forEach((tap, row) => { fillLine(tap, stage === 0 ? z3(tapOf(row, i, q), 0) : []); tap.material.color.setHex(row === 0 ? wireColor(true, tick.a) : wireColor(true, tick.b)); });
    } else {
      for (const line of [...groupFrames, ...bitFrames, ...taps]) fillLine(line, []);
    }

    // The display and its decoder.
    showScreen(lcdBig, screen);
    screen.digits.forEach((item, i) => {
      item.bits.forEach((bit, j) => bitCells[i][3 - j].material.color.setHex(bitColor(item.digit === null ? 0 : bit)));
      [...'gfedcba'].forEach((letter, q) => segmentCells[i][q].material.color.setHex(bitColor(item.segments.includes(letter))));
    });

    // The drive of the rightmost digit, and the rms across each of its segments.
    const segments = screen.digits[CHIP.digits - 1].segments, levels = Array.from({length: 2 * CHIP.commons}, (_, s) => driveLevels(segments, s));
    traces.forEach((trace, n) => fillLine(trace, levels.flatMap((level, s) => { const volts = !plan.runs ? 0 : n < CHIP.commons ? level.commons[n] : level.lines[n - CHIP.commons]; return [[slotX(s), levelY(n, volts), 0.001], [slotX(s + 1), levelY(n, volts), 0.001]]; })));
    if (now.slot === null) fillLine(driveCursor, []);
    else outline(driveCursor, slotX(now.slot), slotX(now.slot + 1), bottom, top, 0.002);
    [...LETTERS].forEach((letter, q) => {
      const lit = segments.includes(letter), volts = !plan.runs ? 0 : lit ? plan.rms.on : plan.rms.off;
      rect(bars[q], barX(q) - DRIVE.bars.w / 2, barX(q) + DRIVE.bars.w / 2, DRIVE.bars.y, DRIVE.bars.y + volts / CHIP.doubler * DRIVE.bars.h, 0.001);
      bars[q].visible = volts > 0;
      bars[q].material.color.setHex(lit ? COLORS.lit : COLORS.dark);
    });

    // The power chart's marker.
    const light = plan.values.light, mx = luxX(Math.max(light, PW.lux[0])), my = ampY(Math.max(pw.current, PW.amps[0]));
    fillLine(marker, light > 0 ? [[mx - PW.marker, my, 0.002], [mx + PW.marker, my, 0.002], [mx, my - PW.marker, 0.002], [mx, my + PW.marker, 0.002]] : []);
    marker.material.color.setHex(plan.values.source === 1 ? COLORS.spare : COLORS.marker);

    // Readings.
    const {first, second, sum} = plan, answer = plan.answer, n = plan.registrations.length, N = plan.values.debounce, wait = CHIP.wait.current[0], operate = CHIP.operate.current[0];
    let status;
    if (!plan.runs) status = `Dark · the cell gives ${f2(uA(pw.current))} μA, less than the ${f1(uA(wait))} μA the chip needs to wait, so the display stays blank`;
    else if (clock <= 0) status = `Ready · ${f0(first)} in Y and ${f0(second)} in X, and the display shows ${plan.before.text}; press Play to press =`;
    else if (now.micro < plan.scanEnd) status = `Reading the = key · its contact ${now.closed ? 'closed' : 'open'}, ${now.registered === 1 ? 'one press' : `${now.registered} presses`} taken so far`;
    else if (!plan.adds) status = `Too dim to add · the = key is taken, but the cell’s ${f2(uA(pw.current))} μA is less than the ${f0(uA(operate))} μA the adder needs, so the display keeps ${plan.before.text}`;
    else if (now.adding) status = `Adding digit ${tick.digit + 1} of ${CHIP.digits} · ${tick.stage === 0 ? `bit ${tick.bit + 1} of 4 into the buffer` : `correcting bit ${tick.bit + 1} of 4 with ${bin4(serial.digits[tick.digit].correction)}`}`;
    else status = answer.overflow ? `${answer.text} · the answer needs ${CHIP.digits + 1} digits, one more than the display has` : `${answer.text} on the display, ${f1(plan.duration * 1000)} ms after the press`;

    const shownDigit = serial.digits[tick ? tick.digit : 0], {x: dx, y: dy, carryIn, five, result: digitResult} = shownDigit;
    const digitHint = `${five > 9 ? `Past 9, so the adder adds 6: ${five} + 6 = ${five + 6}, whose four low bits hold ${digitResult}, and 1 carries into the next digit.` : `Not past 9, so the adder adds 0000 and the digit stays ${digitResult}.`} In bits: ${bin4(dy)} + ${bin4(dx)}${carryIn ? ' + 1' : ''} = ${five.toString(2).padStart(5, '0')}.`;
    const shownDigits = [...(screen.overflow ? [['E', ERROR_PATTERN]] : []), ...screen.digits.filter(item => item.digit !== null).map(item => [String(item.digit), item.segments])];
    const displayHint = shownDigits.length ? `The decoder turns each digit’s 4 bits into 7, one for each segment, in the Seven-segment display page’s gfedcba order: ${shownDigits.map(([label, pattern]) => `${label}${label === 'E' ? '' : ` is ${bin4(Number(label))} and`} lights ${pattern}, ${hex(byteOf(pattern))}`).join('; ')}. Leading zeros stay blank.` : 'Nothing is driven, so every segment stays clear.';
    const scanHint = `The chip drives each of its ${SCAN.lines} polling lines for ${f2(SCAN.poll * 1000)} ms, so it reads = every ${f0(SCAN.interval * 1000)} ms, in the K5 slot. A held key lifts K8 to ${f2(plan.strobe.typical)} V, above the ${f1(plan.strobe.need)} V the chip needs to read a 1. The contact bounces for ${f1(plan.values.bounce)} ms, and the chip takes the key when ${N === 1 ? 'a single read says so' : `${N} reads in a row agree`}${plan.runs ? `: first at ${f3(plan.accepted / 1000)} ms` : ''}.`;
    const adderHint = plan.adds ? `Each digit takes ${ADDER.perDigit} ticks, 4 adding its bits and 4 adding the correction, so ${CHIP.digits} digits take ${total}. The model’s clock ticks at ${f0(1 / ADDER.tick / 1000)} kHz, ${f0(total * ADDER.tick * 1000)} ms for the sum; at the ${CHIP.name}’s ${f0(CHIP.operate.oscillator[1] / 1000)} kHz the same ticks would take ${f2(total / CHIP.operate.oscillator[1] * 1000)} ms.` : `The adder needs the ${f0(uA(operate))} μA the chip draws while it works, and ${plan.runs ? `the cell gives only ${f2(uA(pw.current))} μA` : 'the chip is dark'}, so it does not run.`;
    const rmsOn = plan.rms.on, rmsOff = plan.rms.off;
    const driveHint = `Each common spends one slot of each frame at ${f1(CHIP.doubler)} or 0 V and the other two at ${f1(CHIP.supply[1])} V, and each segment line sits at 0 or ${f1(CHIP.doubler)} V. A lit segment feels ${f1(CHIP.doubler)} V in its own slot and ${f1(CHIP.supply[1])} V in the other two, ${f2(rmsOn)} V rms; a dark one feels nothing in its own slot, ${f2(rmsOff)} V rms, ${f2(rmsOn / rmsOff)} times less. The polarity flips every frame, ${f1(CHIP.wait.frame[1])} frames a second waiting and ${f0(CHIP.operate.frame[1])} while adding, so no DC is left across the liquid crystal.`;
    const years = pw.years, life = `${f0(uA(BATTERY.capacity) / 1000)} mAh to ${f1(BATTERY.cutoff)} V, ${f0(100 * BATTERY.depth.at(-1)[0])}% of it used by ${f2(CHIP.supply[0])} V, the chip’s lowest supply: ${f0(pw.usable * 1000)} mAh, ${f0(pw.waitHours)} hours at the ${f1(uA(wait))} μA of waiting, about ${f1(years)} years`;
    const powerHint = plan.values.source === 1
      ? `Energizer’s ${BATTERY.model}, an ${BATTERY.iec}: ${life}. At ${f0(light)} lx the solar cell would give ${f2(uA(pw.current))} μA. The chart is drawn on logarithmic scales.`
      : `The ${CELL.model} gives ${f1(uA(CELL.current))} μA at ${f1(CELL.volts)} V under ${f0(CELL.lux)} lx, and its current follows the light: ${f2(uA(pw.current))} μA at ${f0(light)} lx. The chip needs ${f1(uA(wait))} μA to wait, which takes ${f0(pw.waitLux)} lx, and ${f0(uA(operate))} μA to add, which takes ${f0(pw.operateLux)} lx. The chart is drawn on logarithmic scales.`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Answer', answer.text, `${f0(first)} + ${f0(second)} = ${f0(sum)}. In binary coded decimal, 4 bits a digit, ${bcdText(first)} and ${bcdText(second)} make ${bcdText(sum)}.${answer.overflow ? ` That needs ${CHIP.digits + 1} digits, so the chip shows E and the high ${CHIP.digits}, with the point where ${f0(sum)} times 10⁻⁸ puts it.` : ''}`),
        r('Key scan', plan.runs ? (n === 1 ? 'one press taken' : `${n} presses taken`) : 'not read', scanHint),
        r('Adder', `${now.ticksDone} of ${total} ticks`, adderHint),
        r('Digit', `${dy} + ${dx}${carryIn ? ' + 1' : ''} = ${five}`, digitHint),
        r('Display', shownDigits.length ? shownDigits.map(([, pattern]) => hex(byteOf(pattern))).join(' ') : 'blank', displayHint),
        r('Drive', plan.runs ? `${f2(rmsOn)} V lit, ${f2(rmsOff)} V dark` : 'off', driveHint),
        r('Power', plan.values.source === 1 ? `${BATTERY.iec} button cell` : `${f2(uA(pw.current))} μA from the cell`, powerHint),
        r('Slowed', `${f0(ADDER.slow)} times`, `The chip runs ${f0(ADDER.slow)} times slower here than it does: the ${f1(plan.duration * 1000)} ms from the press to the answer take ${f1(plan.duration * ADDER.slow)} s. The calculator is drawn at true size and its display twice true size; the key matrix, the adder, the drive and the power are diagrams, not to scale.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt / ADDER.slow); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the key matrix', part: 'keypad', view: 'front', replay: false, run() { return inspect(result.getState().accepted / 1e6); }},
    {label: 'Inspect: the adder', part: 'adder', view: 'front', replay: false, run() { return inspect((result.getState().addStart + (ADDER.perDigit / 2 + 0.5) * ADDER.tick * 1e6) / 1e6); }},
    {label: 'Inspect: the display and decoder', part: 'display', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the display drive', part: 'drive', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the power', part: 'power', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the calculator', part: 'calculator', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Press =',
    description: `The = key goes down: the chip reads it through the key matrix, adds the two numbers a bit at a time and shows the answer, ${ADDER.slow} times slower than it does.`,
    stepLabel: 'Advance 1 ms of the chip',
    advance: result.advance,
    step: () => result.advance(ADDER.tick * ADDER.slow),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'display', label: 'Inspect the display', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, calculator, body, strip, seams, battery, batteryRim, lcdWindow, lcdSmall, keys, legends, equalsKey, keypad, chipBody, wires, keySquares, equalsSquare, chartFrame, slotBars, timeTicks, contactGuide, contactTrace, takenTrace, readDots, countTicks, scanCursor, adder, registerCells, bufferCells, correctionCells, detector, flipflops, gates, faWires, links, taps, groupFrames, bitFrames, display, lcdWindowBig, lcdBig, bitCells, segmentCells, drive, traces, slotLines, baselines, driveCursor, bars, barBase, power, powerFrame, powerTicks, cellLine, chipLines, thresholdTicks, marker};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

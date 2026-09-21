import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {remotePlan, remoteAt, currentShare, photonEv, photocurrentOf, byteOf, REMOTE_DEFAULTS, REMOTE_DOMAINS, EMITTER_OPTIONS, PATH_OPTIONS, DECLARED, TSAL6200, TLHR5400, TSOP38438, BPW34, SPICE_1N4148, SHEET_1N4148, NEC, E92, LEDS, LED_CURVES, DIODE_CURVE, DIODE_TEST, PAGES, RESPONSIVITY, BAND, DARK_IRRADIANCE, INTENSITY_SLOPE, VT} from './remote-physics.js';

// ---------------------------------------------------------------------------
// Remote control: the handset cut open, the room seen from above with the
// beam, the frame a key sends on a time chart, an LED's junction beside the
// curves of three LEDs, the receiver's photodiode cut open beside the light
// against distance, and a 1N4148 diode's junction beside its curve.
//
// Scale: the handset is drawn at true size, 1 mm to 0.01 scene units, its
// body and board illustrative, its cells at the E92's largest size and its
// LEDs at their sheets' sizes. The room is drawn 250 times smaller, 1 m to
// 0.04 units, with the handset, the hand and the TV as marks, not to scale.
// The 1N4148's glass package is drawn 10 times larger, 1 mm to 0.1 units. The
// three junctions cut open and the receiver's blocks are not to scale, and
// neither are the charts.
//
// Time: the frame runs 150 times slower than it does, said in the part text
// and a reading. Carriers in the junctions move only while the clock runs.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const METER = 0.04;
export const BIG = 0.1;

/** How many times larger than true size a scale per mm draws, and how many times smaller a scale per m draws. */
export const timesLarger = perMm => perMm / MM;
export const timesSmaller = perMeter => MM * 1000 / perMeter;

/** A number for readings with a true minus sign. */
export const signed = (value, digits = 1) => fixed(value, digits).replace(/^-/, '−');

/** A current for a reading in the unit that suits its size. */
export function ampsText(amps, digits = 2) {
  const size = Math.abs(amps), [scale, unit] = size >= 1e-3 ? [1e3, 'mA'] : size >= 1e-6 ? [1e6, 'μA'] : size >= 1e-9 ? [1e9, 'nA'] : [1e12, 'pA'];
  return `${signed(amps * scale, digits)} ${unit}`;
}

/** The handset, mm about its body's middle: body, board, keys, chip, transistor, resistors, capacitor, indicator, the infrared LED's base and flange, cells, their terminals, and the beam lines' length. */
export const HANDSET = Object.freeze({origin: Object.freeze([-2.78, -0.04, 0]), body: Object.freeze([45, 160]), board: Object.freeze([-19, 19, -8, 74]), keyX: Object.freeze([-11, 0, 11]), keyY: Object.freeze([50, 40, 30, 20]), key: Object.freeze([9, 6]), pressed: 1, chip: Object.freeze([0, 5, 10, 6]), transistor: Object.freeze([12, 64, 4.5, 3.5]), resistors: Object.freeze([Object.freeze([6, 71]), Object.freeze([-6, 71])]), resistor: Object.freeze([6.3, 2.3]), capacitor: Object.freeze([-13, 5, 5, 11]), indicator: Object.freeze([-12, 62]), ledBase: 78, flange: 1, cells: Object.freeze([-6, 6]), cellMiddle: -49.75, terminal: Object.freeze([3.8, 0.8]), beam: 20});
export const ROOM = Object.freeze({origin: Object.freeze([-2.2, 1.12, 0]), tickEvery: 5, tick: 0.015, handset: Object.freeze([0.06, 0.03]), tv: Object.freeze([0.03, 0.16]), hand: Object.freeze([0.035, 0.06]), receiver: 0.012, opacity: 0.35});
export const SIGNAL = Object.freeze({x: -2.25, y: -0.36, w: 1.75, row: 0.2, gap: 0.05, bits: 0.07, short: 0.45, z: 0, amps: 0.15, light: Object.freeze([1e-10, 1e-6]), high: 0.8, low: 0.2, tickEvery: 0.01, tick: 0.015, magnifier: Object.freeze([-1.05, 0.52, 0.55, 0.08])});
export const LEDVIEW = Object.freeze({origin: Object.freeze([-1.78, -1.08, 0]), half: 0.3, tall: 0.22, active: 0.03, contact: 0.02, carriers: 12, rows: 3, radius: 0.008, photons: 8, spread: 0.03, reach: 0.16, step: 0.01, wiggle: 0.006, speed: 100});
export const LEDCHART = Object.freeze({x: -1.3, y: -1.52, w: 0.8, h: 0.8, volts: 3.4, amps: Object.freeze([1e-6, 1]), tick: 0.03, cursor: 0.02, z: 0});
export const PINVIEW = Object.freeze({origin: Object.freeze([0.62, 0.98, 0]), p: 0.04, i: 0.46, n: 0.1, tall: 0.26, contact: 0.02, radius: 0.008, pairs: 40, perPair: 1e-9, photons: 10, reach: 0.14, step: 0.01, wiggle: 0.006, sweep: 0.003, seed: 38, sign: 0.04, glyph: 0.012, bar: 0.008, arrow: 0.004});
export const BLOCKS = Object.freeze({x: 0.3, y: 0.46, w: 0.12, h: 0.08, gap: 0.06, count: 4, stub: 0.1});
export const RXCHART = Object.freeze({x: 1.3, y: 0.3, w: 0.9, h: 0.9, meters: Object.freeze([1, 30]), irradiance: Object.freeze([0.01, 100]), ticks: Object.freeze([2, 5, 10, 20]), tick: 0.02, cursor: 0.02, z: 0});
export const PACKAGE = Object.freeze({origin: Object.freeze([0.62, -0.24, 0]), band: 0.6, lead: 2, die: 0.6});
export const JUNCTION = Object.freeze({origin: Object.freeze([0.62, -0.82, 0]), half: 0.36, tall: 0.26, width: 0.05, contact: 0.02, radius: 0.008, columns: 5, rows: 4, crossing: 10, reach: 0.06, sweep: 0.004, sign: 0.04, glyph: 0.012, bar: 0.008});
export const DIODECHART = Object.freeze({x: 1.3, y: -1.46, reverse: 0.34, gap: 0.04, forward: 0.56, h: 0.86, volts: Object.freeze([-20, 1]), amps: Object.freeze([1e-12, 1]), cursor: 0.02, z: 0});
export const COLORS = Object.freeze({shell: 0x3b4046, board: 0x4f7a5a, pad: 0xc9b37a, pressed: 0xf0dfaf, chip: 0x2a2a2a, resistor: 0xc9a66b, capacitor: 0x3f5f8f, cell: 0x8d6b3f, terminal: 0xb4c5b0, trace: 0xd9c27a, irBody: 0x6f7f96, infrared: 0x8a5cc2, red: 0xd9412e, redOff: 0x7a3a33, yellow: 0xe6c229, yellowOff: 0x7a6a33, chart: 0x374736, faint: 0x9aa39a, light: 0xd99a2b, dark: 0x8f989b, threshold: 0xc14f39, tv: 0x2f3336, tvOn: 0x83b4c1, tvOff: 0x55595e, hand: 0xd9a88a, p: 0xeccdc6, n: 0xc6d8ea, active: 0xf4f1e8, depletion: 0xf4f1e8, intrinsic: 0xeef0e6, electron: 0x2b5d9c, hole: 0xc14f39, metal: 0xb4c5b0, glass: 0xcfe3ea, band: 0x2a2a2a, block: 0xd9d2c3, blockLit: 0xd99a2b, field: 0xd99a2b});
export const LED_COLORS = Object.freeze([COLORS.infrared, COLORS.red, COLORS.yellow]);

/** A step between two levels as chart points [time, level]: `inside` during each interval and `outside` between, from 0 until a time. */
export function stepPoints(intervals, inside, outside, until) {
  const points = [[0, outside]];
  for (const [start, end] of intervals) {
    if (start > until) break;
    points.push([start, outside], [start, inside]);
    if (end > until) { points.push([until, inside]); return points; }
    points.push([end, inside], [end, outside]);
  }
  points.push([until, outside]);
  return points;
}

/** One bit's burst as chart points [cycle, lit]: each carrier cycle lit for its first third, as far as a number of cycles. */
export function carrierWave(until) {
  const end = Math.min(until, NEC.pulses), points = [[0, 0]];
  for (let c = 0; c < end; c++) {
    const off = c + DECLARED.duty;
    points.push([c, 0], [c, 1]);
    if (off > end) { points.push([end, 1]); return points; }
    points.push([off, 1], [off, 0]);
  }
  points.push([end, 0]);
  return points;
}

/** Where along its path a moving carrier is, 0 to 1: evenly spaced by its index and carried on by the phase. */
export const drift = (k, count, phase) => { const x = k / count + phase; return x - Math.floor(x); };

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where each electron and hole pair drawn in the photodiode is made, as shares across and up its intrinsic layer, and how far along its sweep it starts. */
export const PAIR_SLOTS = (() => { const next = random(PINVIEW.seed); return Object.freeze(Array.from({length: PINVIEW.pairs}, () => Object.freeze({x: next(), y: next(), offset: next()}))); })();

/** The handset's wiring, mm: key columns to the chip, chip to transistor, transistor and resistor to the infrared LED, resistor to the indicator, and the cells to the board. */
export const TRACES = Object.freeze([[-11, 17], [-4.4, 8], [0, 17], [0, 8], [11, 17], [4.4, 8], [5, 6], [12, 62.25], [12, 65.75], [1.5, 78], [2.85, 71], [-1.5, 78], [-9.15, 71], [-12, 64.5], [-6, -27.5], [-6, -8], [6, -27.5], [6, -8]].map(Object.freeze));

export function createRemoteControlModel() {
  const kit = houseModel('Remote control'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownPlan = null;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const disc = (color, parent, start = 0, length = 2 * Math.PI) => { const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 32, start, length), unlit(color)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const frameLine = (line, x, y, w, h, z = 0) => fillLine(line, [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]]);
  const cross = (x, y, size, z = 0) => [[x - size, y, z], [x + size, y, z], [x, y - size, z], [x, y + size, z]];
  const dots = (color, room, parent) => { const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12), unlit(color), room); mesh.frustumCulled = false; mesh.count = 0; parent.add(mesh); return mesh; };
  const matrix = new THREE.Matrix4();
  const place = (mesh, points, radius, z) => { points.forEach(([x, y], i) => mesh.setMatrixAt(i, matrix.makeScale(radius, radius, 1).setPosition(x, y, z))); mesh.count = points.length; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); };
  const glyph = parent => [flat(COLORS.chart, parent), flat(COLORS.chart, parent)];
  const setGlyph = ([bar, upright], x, y, value, size, thick, z = 0.004) => { rect(bar, x - size, x + size, y - thick / 2, y + thick / 2, z); rect(upright, x - thick / 2, x + thick / 2, y - size, y + size, z); bar.visible = value !== 0; upright.visible = value > 0; };
  const upward = (x, y, s, w, z) => [[x, y, z], [x + w, y + s, z], [x + w, y + s, z], [x - w, y + 2 * s, z], [x - w, y + 2 * s, z], [x, y + 3 * s, z]];
  const rightward = (x, y, s, w, z) => [[x, y, z], [x + s, y + w, z], [x + s, y + w, z], [x + 2 * s, y - w, z], [x + 2 * s, y - w, z], [x + 3 * s, y, z]];
  const slowText = `${DECLARED.slow} times slower`;

  const system = part('system', 'Remote control, close up', `A remote control's handset cut open at true size, the room seen from above ${fixed(timesSmaller(METER), 0)} times smaller, the frame a key sends on a time chart, and three junctions cut open, not to scale: an LED's, the receiver photodiode's and a 1N4148 diode's. Press Play to press a key: the frame runs ${slowText} here than it does.`);

  // The handset at true size.
  const H = HANDSET, [bw, bh] = H.body, cellsTop = H.cellMiddle + E92.length[1] / 2;
  const handset = part('handset', 'Handset, true size', `The handset cut open at true size, ${bw} mm by ${bh} mm, its body and board illustrative. At the bottom, two AAA cells ${fixed(E92.diameter[1], 1)} mm across and ${fixed(E92.length[1], 1)} mm long; on the board, the key contacts, the encoder chip, the transistor that switches the infrared LED, a resistor for each LED and a capacitor. The ${TSAL6200.body} mm infrared LED points out of the top, and the indicator LED beside the keys lights while a key is pressed. Infrared is invisible, so its glow and its beam are drawn in violet, a color chosen here.`, H.origin, system);
  const shell = flat(COLORS.shell, handset);
  rect(shell, -bw / 2 * MM, bw / 2 * MM, -bh / 2 * MM, bh / 2 * MM);
  const board = flat(COLORS.board, handset);
  rect(board, H.board[0] * MM, H.board[1] * MM, H.board[2] * MM, H.board[3] * MM, 0.001);
  const piece = (color, [x, y, w, h], z = 0.002) => { const mesh = flat(color, handset); rect(mesh, (x - w / 2) * MM, (x + w / 2) * MM, (y - h / 2) * MM, (y + h / 2) * MM, z); return mesh; };
  const keys = H.keyY.flatMap(y => H.keyX.map(x => piece(COLORS.pad, [x, y, ...H.key])));
  const chip = piece(COLORS.chip, H.chip), transistor = piece(COLORS.chip, H.transistor), capacitor = piece(COLORS.capacitor, H.capacitor);
  const resistors = H.resistors.map(([x, y]) => piece(COLORS.resistor, [x, y, ...H.resistor]));
  const cells = H.cells.map(x => piece(COLORS.cell, [x, H.cellMiddle, E92.diameter[1], E92.length[1]]));
  const terminals = H.cells.map((x, i) => piece(COLORS.terminal, [x, H.cellMiddle + (i === 0 ? 1 : -1) * (E92.length[1] + H.terminal[1]) / 2, ...H.terminal]));
  const traces = segmentLines(TRACES.length / 2, COLORS.trace, handset);
  fillLine(traces, TRACES.map(([x, y]) => [x * MM, y * MM, 0.0015]));
  const stem = TSAL6200.height - TSAL6200.dome;
  const irFlange = flat(COLORS.irBody, handset), irBody = flat(COLORS.irBody, handset), irDome = disc(COLORS.irBody, handset, 0, Math.PI);
  rect(irFlange, -TSAL6200.flange / 2 * MM, TSAL6200.flange / 2 * MM, H.ledBase * MM, (H.ledBase + H.flange) * MM, 0.003);
  rect(irBody, -TSAL6200.body / 2 * MM, TSAL6200.body / 2 * MM, H.ledBase * MM, (H.ledBase + stem) * MM, 0.0025);
  irDome.position.set(0, (H.ledBase + stem) * MM, 0.0025);
  irDome.scale.setScalar(TSAL6200.dome * MM);
  const indicatorLed = disc(COLORS.redOff, handset);
  indicatorLed.position.set(H.indicator[0] * MM, H.indicator[1] * MM, 0.003);
  indicatorLed.scale.setScalar(TLHR5400.body / 2 * MM);
  const handBeam = segmentLines(2, COLORS.infrared, handset), spread = TSAL6200.halfAngle * Math.PI / 180, ledTop = H.ledBase + TSAL6200.height;
  fillLine(handBeam, [[0, ledTop], [-Math.sin(spread) * H.beam, ledTop + Math.cos(spread) * H.beam], [0, ledTop], [Math.sin(spread) * H.beam, ledTop + Math.cos(spread) * H.beam]].map(([x, y]) => [x * MM, y * MM, 0.003]));

  // The room from above, 250 times smaller.
  const room = part('room', 'Room, seen from above', `The room seen from above, ${fixed(timesSmaller(METER), 0)} times smaller than true size, with a tick every ${ROOM.tickEvery} m out to ${REMOTE_DOMAINS.distance[1]} m. The handset on the left, the hand and the TV are marks, not to scale. The two lines leave the LED ${TSAL6200.halfAngle}° either side of its axis, where its light falls to half; the beam is drawn while a burst is sent, and a hand in the beam stops it. The red tick on the axis marks how far the light stays above the receiver's threshold. The dot on the TV lights while the receiver's output is low, and the screen lights once the TV has decoded the command.`, ROOM.origin, system);
  const distanceTicks = REMOTE_DOMAINS.distance[1] / ROOM.tickEvery + 1;
  const axis = segmentLines(1 + distanceTicks, COLORS.faint, room);
  fillLine(axis, [[0, 0, 0], [REMOTE_DOMAINS.distance[1] * METER, 0, 0], ...Array.from({length: distanceTicks}, (_, k) => [[k * ROOM.tickEvery * METER, 0, 0], [k * ROOM.tickEvery * METER, -ROOM.tick, 0]]).flat()]);
  const handsetMark = flat(COLORS.shell, room);
  rect(handsetMark, -ROOM.handset[0], 0, -ROOM.handset[1] / 2, ROOM.handset[1] / 2, 0.002);
  const beamEdges = segmentLines(2, COLORS.infrared, room);
  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const beamFill = new THREE.Mesh(beamGeometry, unlit(COLORS.infrared, {transparent: true, opacity: ROOM.opacity, side: THREE.DoubleSide}));
  room.add(beamFill);
  const tv = flat(COLORS.tv, room), tvDot = disc(COLORS.tvOff, room), hand = disc(COLORS.hand, room), rangeTick = segmentLines(1, COLORS.threshold, room);

  // The frame on a time chart.
  const S = SIGNAL, rowY = k => S.y + S.bits + S.gap + k * (S.row + S.gap);
  const signal = part('signal', 'Signal, bit by bit', `The frame a key sends, on a time chart ${slowText} than it happens. Top: the LED's current, the row's height standing for ${fixed(S.amps * 1000, 0)} mA. Middle: the photodiode's current on a log scale from ${fixed(S.light[0] * 1e9, 1)} nA to ${fixed(S.light[1] * 1e6, 0)} μA, the gray line its dark current. Bottom: the receiver's output, high until a burst pulls it low. Under it, a mark for each bit the TV decodes, tall for a 1 and short for a 0. Faint: the whole frame; dark: as far as the clock. Above: one bit's burst, ${NEC.pulses} flashes of the ${fixed(NEC.carrier / 1000, 0)} kHz carrier, each lit a third of its cycle. A tick below the chart marks every ${fixed(S.tickEvery * 1000, 0)} ms.`, [0, 0, 0], system);
  const rowFrames = [0, 1, 2].map(k => { const line = lineObject(5, COLORS.chart, signal); frameLine(line, S.x, rowY(k), S.w, S.row, S.z); return line; });
  const waveRoom = 2 + 4 * 34 + 1;
  const ledGuide = lineObject(waveRoom, COLORS.faint, signal), lightGuide = lineObject(waveRoom, COLORS.faint, signal), outputGuide = lineObject(waveRoom, COLORS.faint, signal);
  const ledTrace = lineObject(waveRoom, COLORS.infrared, signal), lightTrace = lineObject(waveRoom, COLORS.light, signal), outputTrace = lineObject(waveRoom, COLORS.chart, signal);
  const darkLevel = segmentLines(1, COLORS.dark, signal), bitGuide = segmentLines(32, COLORS.faint, signal), bitTrace = segmentLines(32, COLORS.chart, signal);
  const signalCursor = segmentLines(1, COLORS.chart, signal), timeTicks = segmentLines(7, COLORS.chart, signal);
  const [mx, my, mw, mh] = S.magnifier, magnifierFrame = lineObject(5, COLORS.chart, signal);
  frameLine(magnifierFrame, mx, my, mw, mh, S.z);
  const magnifierX = cycles => mx + cycles / NEC.pulses * mw, magnifierY = lit => my + (lit ? S.high : S.low) * mh;
  const carrierGuide = lineObject(4 * NEC.pulses + 2, COLORS.faint, signal), carrierTrace = lineObject(4 * NEC.pulses + 2, COLORS.infrared, signal);
  fillLine(carrierGuide, carrierWave(NEC.pulses).map(([cycles, lit]) => [magnifierX(cycles), magnifierY(lit), S.z]));

  // An LED's junction and the three LEDs' curves.
  const L = LEDVIEW, C = LEDCHART;
  const led = part('led', 'LED junction, close up', `An LED's junction cut open, not to scale: holes come from the p side on the left and electrons from the n side on the right, and where they meet in the middle each pair that recombines can give out a photon, drawn in the LED's color. Carriers move only while the LED carries current. Right: the current through the three LEDs against the voltage across them, from 0 to ${fixed(C.volts, 1)} V, on a log scale from ${fixed(C.amps[0] * 1e6, 0)} μA to ${fixed(C.amps[1], 0)} A: violet the infrared transmitter, red the indicator and yellow the one that can take its place, each with a tick below at its photons' energy in volts. The faint line is what the cells and resistor leave for the LED shown, and the cross is its current now.`, L.origin, system);
  const pSide = flat(COLORS.p, led), activeLayer = flat(COLORS.active, led), nSide = flat(COLORS.n, led);
  rect(pSide, -L.half, -L.active / 2, -L.tall / 2, L.tall / 2);
  rect(activeLayer, -L.active / 2, L.active / 2, -L.tall / 2, L.tall / 2);
  rect(nSide, L.active / 2, L.half, -L.tall / 2, L.tall / 2);
  const ledContacts = [flat(COLORS.metal, led), flat(COLORS.metal, led)];
  rect(ledContacts[0], -L.half - L.contact, -L.half, -L.tall / 2, L.tall / 2);
  rect(ledContacts[1], L.half, L.half + L.contact, -L.tall / 2, L.tall / 2);
  const ledHoles = dots(COLORS.hole, L.carriers, led), ledElectrons = dots(COLORS.electron, L.carriers, led), ledPhotons = segmentLines(3 * L.photons, COLORS.infrared, led);
  const ledChart = new THREE.Group();
  ledChart.position.set(-L.origin[0], -L.origin[1], -L.origin[2]);
  led.add(ledChart);
  const toVx = volts => C.x + clamp(volts / C.volts) * C.w, toAy = amps => C.y + clamp(Math.log10(Math.max(amps, C.amps[0]) / C.amps[0]) / Math.log10(C.amps[1] / C.amps[0])) * C.h;
  const ledFrame = lineObject(5, COLORS.chart, ledChart);
  frameLine(ledFrame, C.x, C.y, C.w, C.h, C.z);
  const ledCurves = LED_CURVES.map((curve, i) => { const line = lineObject(curve.length, LED_COLORS[i], ledChart); fillLine(line, curve.map(([volts, amps]) => [toVx(volts), toAy(amps), C.z])); return line; });
  const photonTicks = LEDS.map((item, i) => { const line = segmentLines(1, LED_COLORS[i], ledChart), x = toVx(photonEv(item.sheet.peak)); fillLine(line, [[x, C.y, C.z], [x, C.y - C.tick, C.z]]); return line; });
  const loadLine = lineObject(DECLARED.samples, COLORS.faint, ledChart), ledCursor = segmentLines(2, COLORS.chart, ledChart);

  // The receiver's photodiode, its chain, and the light against distance.
  const PV = PINVIEW, R = RXCHART, layers = PV.p + PV.i + PV.n, left = -layers / 2, iLeft = left + PV.p, iRight = iLeft + PV.i, right = layers / 2;
  const receiver = part('receiver', 'Receiver photodiode, cut open', `The receiver's PIN photodiode cut open, not to scale: a thin p layer on the left, a wide undoped intrinsic layer and an n layer, reverse biased by ${DECLARED.bias} V so a field sweeps across the intrinsic layer. Light from the left frees pairs of electrons and holes there, and the field sweeps electrons to the n side and holes to the p side. One pair is drawn for each ${fixed(PV.perPair * 1e9, 0)} nA of current, up to ${PV.pairs}, so the dark current alone keeps ${fixed(BPW34.dark / PV.perPair, 0)} pairs moving. Below, left to right: the photodiode, automatic gain control, band pass filter and demodulator, lit as a burst passes. Right: irradiance against distance, both on log scales, from ${fixed(R.irradiance[0], 2)} to ${fixed(R.irradiance[1], 0)} mW/m² and ${fixed(R.meters[0], 0)} to ${fixed(R.meters[1], 0)} m; the red line is the receiver's NEC threshold, the gray line the irradiance whose photocurrent equals the dark current, and the cross the receiver now.`, PV.origin, system);
  const pLayer = flat(COLORS.p, receiver), iLayer = flat(COLORS.intrinsic, receiver), nLayer = flat(COLORS.n, receiver);
  rect(pLayer, left, iLeft, -PV.tall / 2, PV.tall / 2);
  rect(iLayer, iLeft, iRight, -PV.tall / 2, PV.tall / 2);
  rect(nLayer, iRight, right, -PV.tall / 2, PV.tall / 2);
  const pinContacts = [flat(COLORS.metal, receiver), flat(COLORS.metal, receiver)];
  rect(pinContacts[0], left - PV.contact, left, -PV.tall / 2, PV.tall / 2);
  rect(pinContacts[1], right, right + PV.contact, -PV.tall / 2, PV.tall / 2);
  const pinMinus = glyph(receiver), pinPlus = glyph(receiver);
  setGlyph(pinMinus, left - PV.contact / 2, -PV.tall / 2 - PV.sign, -1, PV.glyph, PV.bar);
  setGlyph(pinPlus, right + PV.contact / 2, -PV.tall / 2 - PV.sign, 1, PV.glyph, PV.bar);
  const field = solidArrow(kit, COLORS.field, receiver, PV.arrow);
  field.position.set(iRight - 0.02, PV.tall / 2 + 0.03, 0.003);
  field.userData.setDirection(new THREE.Vector3(-1, 0, 0));
  field.userData.setLength(PV.i - 0.04);
  const pinPhotons = segmentLines(3 * PV.photons, COLORS.infrared, receiver), pairElectrons = dots(COLORS.electron, PV.pairs, receiver), pairHoles = dots(COLORS.hole, PV.pairs, receiver);
  const receiverChart = new THREE.Group();
  receiverChart.position.set(-PV.origin[0], -PV.origin[1], -PV.origin[2]);
  receiver.add(receiverChart);
  const blocks = Array.from({length: BLOCKS.count}, (_, k) => { const mesh = flat(COLORS.block, receiverChart), x0 = BLOCKS.x + k * (BLOCKS.w + BLOCKS.gap); rect(mesh, x0, x0 + BLOCKS.w, BLOCKS.y, BLOCKS.y + BLOCKS.h); return mesh; });
  const blockLinks = segmentLines(BLOCKS.count + 1, COLORS.chart, receiverChart), midBlock = BLOCKS.y + BLOCKS.h / 2, lastRight = BLOCKS.x + BLOCKS.count * BLOCKS.w + (BLOCKS.count - 1) * BLOCKS.gap;
  fillLine(blockLinks, [[BLOCKS.x + BLOCKS.w / 2, PV.origin[1] - PV.tall / 2, 0], [BLOCKS.x + BLOCKS.w / 2, BLOCKS.y + BLOCKS.h, 0], ...Array.from({length: BLOCKS.count - 1}, (_, k) => [[BLOCKS.x + (k + 1) * BLOCKS.w + k * BLOCKS.gap, midBlock, 0], [BLOCKS.x + (k + 1) * (BLOCKS.w + BLOCKS.gap), midBlock, 0]]).flat(), [lastRight, midBlock, 0], [lastRight + BLOCKS.stub, midBlock, 0]]);
  const toDx = meters => R.x + clamp(Math.log10(meters / R.meters[0]) / Math.log10(R.meters[1] / R.meters[0])) * R.w, toEy = irradiance => R.y + clamp(Math.log10(Math.max(irradiance, R.irradiance[0]) / R.irradiance[0]) / Math.log10(R.irradiance[1] / R.irradiance[0])) * R.h;
  const receiverFrame = lineObject(5, COLORS.chart, receiverChart);
  frameLine(receiverFrame, R.x, R.y, R.w, R.h, R.z);
  const receiverTicks = segmentLines(R.ticks.length + 3, COLORS.chart, receiverChart);
  fillLine(receiverTicks, [...R.ticks.map(meters => [[toDx(meters), R.y, R.z], [toDx(meters), R.y - R.tick, R.z]]), ...[0.1, 1, 10].map(irradiance => [[R.x, toEy(irradiance), R.z], [R.x - R.tick, toEy(irradiance), R.z]])].flat());
  const thresholdLine = segmentLines(1, COLORS.threshold, receiverChart), darkLine = segmentLines(1, COLORS.dark, receiverChart);
  fillLine(thresholdLine, [[R.x, toEy(TSOP38438.nec), R.z], [R.x + R.w, toEy(TSOP38438.nec), R.z]]);
  fillLine(darkLine, [[R.x, toEy(DARK_IRRADIANCE), R.z], [R.x + R.w, toEy(DARK_IRRADIANCE), R.z]]);
  const receiverCurve = lineObject(DECLARED.samples, COLORS.infrared, receiverChart), rangeLine = segmentLines(1, COLORS.threshold, receiverChart), receiverCursor = segmentLines(2, COLORS.chart, receiverChart);

  // The 1N4148: its package 10 times larger, its junction and its curve.
  const J = JUNCTION, D = DIODECHART, P1 = SHEET_1N4148;
  const junction = part('junction', '1N4148 junction, close up', `A 1N4148 signal diode, its glass package drawn ${fixed(timesLarger(BIG), 0)} times larger with the band marking the cathode and its leads cut short, and its junction cut open, not to scale: holes in the p side, electrons in the n side, and the depletion region between with no free carriers, drawn as an abrupt junction's, wider under reverse bias and narrower forward. Forward, carriers stream across the junction; reversed, a few pairs made by heat cross the other way. The plus and minus show the voltage's sign. Right: the current against the voltage on a log scale from ${fixed(D.amps[0] * 1e12, 0)} pA to ${fixed(D.amps[1], 0)} A, reverse from ${signed(D.volts[0], 0)} V to 0 on the left and forward from 0 to ${fixed(D.volts[1], 0)} V on the right. The gray line is the fixed ${fixed(PAGES.threshold[1], 1)} V drop of the simple model, the red crosses the sheet's limits, and the black cross the probe.`, J.origin, system);
  const pack = new THREE.Group();
  pack.position.set(PACKAGE.origin[0] - J.origin[0], PACKAGE.origin[1] - J.origin[1], 0);
  junction.add(pack);
  const bodyLength = P1.length * BIG, bodyWidth = P1.body * BIG;
  const glass = flat(COLORS.glass, pack), band = flat(COLORS.band, pack), leads = [flat(COLORS.metal, pack), flat(COLORS.metal, pack)], die = flat(COLORS.chip, pack);
  rect(glass, -bodyLength / 2, bodyLength / 2, -bodyWidth / 2, bodyWidth / 2);
  rect(band, bodyLength / 2 - PACKAGE.band * BIG, bodyLength / 2, -bodyWidth / 2, bodyWidth / 2, 0.001);
  rect(leads[0], -bodyLength / 2 - PACKAGE.lead * BIG, -bodyLength / 2, -P1.lead * BIG / 2, P1.lead * BIG / 2);
  rect(leads[1], bodyLength / 2, bodyLength / 2 + PACKAGE.lead * BIG, -P1.lead * BIG / 2, P1.lead * BIG / 2);
  rect(die, -PACKAGE.die * BIG / 2, PACKAGE.die * BIG / 2, -PACKAGE.die * BIG / 2, PACKAGE.die * BIG / 2, 0.001);
  const jP = flat(COLORS.p, junction), jN = flat(COLORS.n, junction), depletion = flat(COLORS.depletion, junction);
  rect(jP, -J.half, 0, -J.tall / 2, J.tall / 2);
  rect(jN, 0, J.half, -J.tall / 2, J.tall / 2);
  const jContacts = [flat(COLORS.metal, junction), flat(COLORS.metal, junction)];
  rect(jContacts[0], -J.half - J.contact, -J.half, -J.tall / 2, J.tall / 2);
  rect(jContacts[1], J.half, J.half + J.contact, -J.tall / 2, J.tall / 2);
  const majorityHoles = dots(COLORS.hole, J.columns * J.rows, junction), majorityElectrons = dots(COLORS.electron, J.columns * J.rows, junction);
  const crossingHoles = dots(COLORS.hole, J.crossing, junction), crossingElectrons = dots(COLORS.electron, J.crossing, junction);
  const jLeft = glyph(junction), jRight = glyph(junction);
  const diodeChart = new THREE.Group();
  diodeChart.position.set(-J.origin[0], -J.origin[1], -J.origin[2]);
  junction.add(diodeChart);
  const toJx = volts => (volts < 0 ? D.x + (volts - D.volts[0]) / -D.volts[0] * D.reverse : D.x + D.reverse + D.gap + Math.min(volts, D.volts[1]) / D.volts[1] * D.forward);
  const toIy = amps => D.y + clamp(Math.log10(Math.max(Math.abs(amps), D.amps[0]) / D.amps[0]) / Math.log10(D.amps[1] / D.amps[0])) * D.h;
  const reverseFrame = lineObject(5, COLORS.chart, diodeChart), forwardFrame = lineObject(5, COLORS.chart, diodeChart);
  frameLine(reverseFrame, D.x, D.y, D.reverse, D.h, D.z);
  frameLine(forwardFrame, D.x + D.reverse + D.gap, D.y, D.forward, D.h, D.z);
  const reverseCurve = lineObject(DIODE_CURVE.reverse.length, COLORS.chart, diodeChart), forwardCurve = lineObject(DIODE_CURVE.forward.length, COLORS.chart, diodeChart);
  fillLine(reverseCurve, DIODE_CURVE.reverse.map(([volts, amps]) => [D.x + (volts - D.volts[0]) / -D.volts[0] * D.reverse, toIy(amps), D.z]));
  fillLine(forwardCurve, DIODE_CURVE.forward.map(([volts, amps]) => [toJx(volts), toIy(amps), D.z]));
  const fixedDrop = segmentLines(1, COLORS.dark, diodeChart), sheetLimits = segmentLines(4, COLORS.threshold, diodeChart), diodeCursor = segmentLines(2, COLORS.chart, diodeChart);
  fillLine(fixedDrop, [[toJx(PAGES.threshold[1]), D.y, D.z], [toJx(PAGES.threshold[1]), D.y + D.h, D.z]]);
  fillLine(sheetLimits, [...cross(toJx(-P1.leakAt), toIy(P1.leak), D.cursor, D.z), ...cross(toJx(P1.vf), toIy(P1.at), D.cursor, D.z)]);

  // Controls.
  const d = REMOTE_DEFAULTS, dom = REMOTE_DOMAINS;
  control('command', 'Command', ...dom.command, d.command, '', `The code of the key pressed, sent after the handset's address. Vishay's example sends ${NEC.command}, which is ${parseInt(NEC.command, 2)}.`);
  control('distance', 'Distance', ...dom.distance, d.distance, 'm', 'How far the receiver is from the handset, facing it.');
  control('battery', 'Cells', ...dom.battery, d.battery, 'V', `The two AAA cells together: ${fixed(2 * E92.fresh, 1)} V when new with no load, down to ${fixed(2 * E92.cutoff, 1)} V when each has run down to the ${fixed(E92.cutoff, 1)} V where Energizer's capacity test ends.`);
  control('blocked', 'Path', ...dom.blocked, d.blocked, '', 'A clear path, or a hand in the beam.', PATH_OPTIONS);
  control('emitter', 'LED close up', ...dom.emitter, d.emitter, '', 'Which LED the junction and the cross on its chart show. The infrared transmitter sends the frame whichever is shown; a yellow LED can take the red indicator\'s place.', EMITTER_OPTIONS);
  control('probe', 'Diode voltage', ...dom.probe, d.probe, 'V', 'The voltage across the 1N4148: below zero is reverse bias, above zero forward.');

  const result = finish(v => {
    const plan = remotePlan(v), now = remoteAt(plan, clock), running = clock > 0, tx = plan.transmitter, shown = plan.shown;

    // What changes only with the settings.
    if (shownPlan !== plan) {
      shownPlan = plan;
      const dm = plan.distance * METER, reach = (plan.blocked ? plan.distance / 2 : plan.distance) * METER, slope = Math.tan(spread);
      fillLine(beamEdges, [[0, 0, 0.001], [dm, -dm * slope, 0.001], [0, 0, 0.001], [dm, dm * slope, 0.001]]);
      beamGeometry.attributes.position.array.set([0, 0, 0.0005, reach, -reach * slope, 0.0005, reach, reach * slope, 0.0005]);
      beamGeometry.attributes.position.needsUpdate = true;
      beamGeometry.computeBoundingSphere();
      rect(tv, dm, dm + ROOM.tv[0], -ROOM.tv[1] / 2, ROOM.tv[1] / 2, 0.002);
      tvDot.position.set(dm, 0, 0.003);
      tvDot.scale.setScalar(ROOM.receiver);
      hand.position.set(dm / 2, 0, 0.004);
      hand.scale.set(ROOM.hand[0], ROOM.hand[1], 1);
      hand.visible = plan.blocked;
      fillLine(rangeTick, plan.range <= dom.distance[1] ? [[plan.range * METER, -2 * ROOM.tick, 0.001], [plan.range * METER, 2 * ROOM.tick, 0.001]] : []);

      const toX = t => S.x + clamp(t / plan.duration) * S.w;
      fillLine(ledGuide, stepPoints(plan.bursts, tx.current, 0, plan.duration).map(([t, amps]) => [toX(t), rowY(2) + clamp(amps / S.amps) * S.row, S.z]));
      fillLine(lightGuide, stepPoints(plan.bursts, plan.dark + plan.light, plan.dark, plan.duration).map(([t, amps]) => [toX(t), rowY(1) + clamp(Math.log10(amps / S.light[0]) / Math.log10(S.light[1] / S.light[0])) * S.row, S.z]));
      fillLine(outputGuide, stepPoints(plan.output, 0, 1, plan.duration).map(([t, high]) => [toX(t), rowY(0) + (high ? S.high : S.low) * S.row, S.z]));
      const darkY = rowY(1) + clamp(Math.log10(plan.dark / S.light[0]) / Math.log10(S.light[1] / S.light[0])) * S.row;
      fillLine(darkLevel, [[S.x, darkY, S.z], [S.x + S.w, darkY, S.z]]);
      fillLine(bitGuide, plan.decisions.flatMap((at, k) => [[toX(at), S.y, S.z], [toX(at), S.y + (plan.decoded.bits[k] === '1' ? 1 : S.short) * S.bits, S.z]]));
      const ticks = [];
      for (let k = 1; k * S.tickEvery < plan.duration; k++) ticks.push([toX(k * S.tickEvery), S.y, S.z], [toX(k * S.tickEvery), S.y - S.tick, S.z]);
      fillLine(timeTicks, ticks);

      fillLine(loadLine, plan.loadLine.map(([volts, amps]) => [toVx(volts), toAy(amps), C.z]));
      ledPhotons.material.color.setHex(LED_COLORS[plan.emitter]);

      fillLine(receiverCurve, plan.irradianceCurve.map(([meters, irradiance]) => [toDx(meters), toEy(irradiance), R.z]));
      fillLine(rangeLine, plan.range <= R.meters[1] ? [[toDx(plan.range), R.y, R.z], [toDx(plan.range), R.y + R.h, R.z]] : []);
      fillLine(receiverCursor, cross(toDx(plan.distance), toEy(plan.irradiance), R.cursor, R.z));

      const width = J.width * plan.depletion, gapEdge = width / 2, spacing = (J.half - gapEdge) / J.columns;
      rect(depletion, -gapEdge, gapEdge, -J.tall / 2, J.tall / 2, 0.001);
      const lanes = Array.from({length: J.rows}, (_, row) => -J.tall / 2 + (row + 0.5) * J.tall / J.rows);
      place(majorityHoles, lanes.flatMap(y => Array.from({length: J.columns}, (_, c) => [-gapEdge - (c + 0.5) * spacing, y])), J.radius, 0.002);
      place(majorityElectrons, lanes.flatMap(y => Array.from({length: J.columns}, (_, c) => [gapEdge + (c + 0.5) * spacing, y])), J.radius, 0.002);
      const sign = Math.sign(plan.probe);
      setGlyph(jLeft, -J.half - J.contact / 2, -J.tall / 2 - J.sign, sign, J.glyph, J.bar);
      setGlyph(jRight, J.half + J.contact / 2, -J.tall / 2 - J.sign, -sign, J.glyph, J.bar);
      fillLine(diodeCursor, cross(toJx(plan.probe), toIy(plan.diode.current), D.cursor, D.z));
    }

    // The handset.
    const indicatorOn = running && now.sending, indicatorColor = plan.emitter === 2 ? [COLORS.yellow, COLORS.yellowOff] : [COLORS.red, COLORS.redOff];
    indicatorLed.material.color.setHex(indicatorOn && plan.indicator.current >= 1e-3 ? indicatorColor[0] : indicatorColor[1]);
    const bursting = running && now.bursting;
    irDome.material.color.setHex(bursting ? COLORS.infrared : COLORS.irBody);
    handBeam.visible = bursting;
    keys.forEach((key, k) => key.material.color.setHex(indicatorOn && k === H.pressed ? COLORS.pressed : COLORS.pad));

    // The room.
    beamFill.visible = bursting;
    tvDot.material.color.setHex(running && now.low ? COLORS.light : COLORS.tvOff);
    tv.material.color.setHex(now.decodedCount === 32 && plan.decoded.valid ? COLORS.tvOn : COLORS.tv);

    // The chart as far as the clock.
    const toX = t => S.x + clamp(t / plan.duration) * S.w, until = running ? now.t : 0;
    fillLine(ledTrace, running ? stepPoints(plan.bursts, tx.current, 0, until).map(([t, amps]) => [toX(t), rowY(2) + clamp(amps / S.amps) * S.row, S.z]) : []);
    fillLine(lightTrace, running ? stepPoints(plan.bursts, plan.dark + plan.light, plan.dark, until).map(([t, amps]) => [toX(t), rowY(1) + clamp(Math.log10(amps / S.light[0]) / Math.log10(S.light[1] / S.light[0])) * S.row, S.z]) : []);
    fillLine(outputTrace, running ? stepPoints(plan.output, 0, 1, until).map(([t, high]) => [toX(t), rowY(0) + (high ? S.high : S.low) * S.row, S.z]) : []);
    fillLine(bitTrace, plan.decisions.slice(0, running ? now.decodedCount : 0).flatMap((at, k) => [[toX(at), S.y, S.z], [toX(at), S.y + (plan.decoded.bits[k] === '1' ? 1 : S.short) * S.bits, S.z]]));
    fillLine(signalCursor, [[toX(until), S.y, S.z], [toX(until), rowY(2) + S.row, S.z]]);
    fillLine(carrierTrace, bursting ? carrierWave(now.cycles).map(([cycles, lit]) => [magnifierX(cycles), magnifierY(lit), S.z]) : []);

    // The LED's junction and its cross on the chart.
    const ledLit = running && (plan.emitter === 0 ? now.bursting : now.sending), share = currentShare(shown.current);
    const ledPhase = L.speed * share * (plan.emitter === 0 ? now.litTime : Math.min(now.t, plan.frameEnd)), span = L.half - L.active / 2 - 2 * L.radius;
    place(ledHoles, Array.from({length: L.carriers}, (_, k) => [-L.half + L.radius + drift(k, L.carriers, ledPhase / span) * span, -L.tall / 2 + ((k % L.rows) + 0.5) * L.tall / L.rows]), L.radius, 0.002);
    place(ledElectrons, Array.from({length: L.carriers}, (_, k) => [L.half - L.radius - drift(k, L.carriers, ledPhase / span) * span, -L.tall / 2 + (((k + 1) % L.rows) + 0.5) * L.tall / L.rows]), L.radius, 0.002);
    const photonCount = ledLit ? Math.round(L.photons * share) : 0;
    fillLine(ledPhotons, Array.from({length: photonCount}, (_, j) => upward((j - (photonCount - 1) / 2) * L.spread, L.tall / 2 + drift(j, photonCount, ledPhase / L.reach) * L.reach, L.step, L.wiggle, 0.002)).flat());
    fillLine(ledCursor, cross(toVx(ledLit ? shown.voltage : 0), toAy(ledLit ? shown.current : C.amps[0]), C.cursor, C.z));

    // The photodiode and the receiver's chain.
    const lightNow = running && now.irradiance > 0, current = running ? now.photocurrent : plan.dark;
    const pairCount = Math.min(PV.pairs, Math.round(current / PV.perPair)), sweep = clock / PV.sweep, pairWidth = PV.i - 4 * PV.radius;
    const slots = PAIR_SLOTS.slice(0, pairCount).map(slot => ({x: iLeft + 2 * PV.radius + slot.x * pairWidth, y: -PV.tall / 2 + 2 * PV.radius + slot.y * (PV.tall - 4 * PV.radius), age: drift(0, 1, slot.offset + sweep)}));
    place(pairElectrons, slots.map(slot => [slot.x + slot.age * (iRight - PV.radius - slot.x), slot.y]), PV.radius, 0.003);
    place(pairHoles, slots.map(slot => [slot.x - slot.age * (slot.x - iLeft - PV.radius), slot.y]), PV.radius, 0.003);
    const photonsIn = lightNow ? Math.min(PV.photons, Math.round((now.photocurrent - plan.dark) / PV.perPair)) : 0;
    fillLine(pinPhotons, Array.from({length: photonsIn}, (_, j) => rightward(left - PV.reach + drift(j, photonsIn, sweep) * (PV.reach - 3 * PV.step), -PV.tall / 2 + (j + 0.5) * PV.tall / photonsIn, PV.step, PV.wiggle, 0.003)).flat());
    const passing = lightNow && plan.received;
    blocks.forEach((block, k) => block.material.color.setHex((k === 0 ? lightNow : k === BLOCKS.count - 1 ? running && now.low : passing) ? COLORS.blockLit : COLORS.block));

    // The 1N4148's carriers crossing.
    const crossing = Math.round(J.crossing * plan.carriers), phase = clock / J.sweep, gapEdge = J.width * plan.depletion / 2;
    if (plan.probe > 0) {
      const path = 1.6 * J.half, lane = k => -J.tall / 2 + (k % J.rows + 1) * J.tall / (J.rows + 1);
      place(crossingHoles, Array.from({length: crossing}, (_, k) => [-0.8 * J.half + drift(k, crossing, phase) * path, lane(k)]), J.radius, 0.003);
      place(crossingElectrons, Array.from({length: crossing}, (_, k) => [0.8 * J.half - drift(k, crossing, phase) * path, lane(k + 2)]), J.radius, 0.003);
    } else {
      const out = gapEdge + J.reach, lane = k => -J.tall / 2 + (k % J.rows + 0.5) * J.tall / J.rows;
      place(crossingHoles, Array.from({length: plan.probe < 0 ? crossing : 0}, (_, k) => [-drift(k, crossing, phase) * out, lane(k)]), J.radius, 0.003);
      place(crossingElectrons, Array.from({length: plan.probe < 0 ? crossing : 0}, (_, k) => [drift(k, crossing, phase) * out, lane(k)]), J.radius, 0.003);
    }

    // Readings.
    const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3), cellsOhms = DECLARED.cells * DECLARED.cellResistance;
    const status = !running ? `Ready · press Play to send command ${plan.command} to a TV ${plan.distance} m away`
      : !now.done && now.bit < 0 ? `Leader · a ${NEC.leader} ms burst, then ${NEC.pause} ms of quiet`
      : !now.done && now.bit < 32 ? `Bit ${now.bit + 1} of 32 · a ${plan.bits[now.bit]}${plan.received ? `, ${now.decodedCount} decoded so far` : ', nothing received'}`
      : !now.done ? `Closing burst · ${plan.received ? `${now.decodedCount} bits decoded` : 'nothing received'}`
      : plan.received ? `Received · the TV decoded command ${plan.decoded.command} from address ${plan.decoded.address}, each checked against its inverse`
      : plan.blocked ? 'Not received · the hand stops the light and the TV decodes nothing'
      : `Not received · at ${plan.distance} m the light is under the receiver's threshold`;
    const decodedValue = !running ? 'nothing yet' : !plan.received ? 'nothing' : now.decodedCount === 32 ? `command ${plan.decoded.command}` : `${now.decodedCount} of 32 bits`;
    const decodedHint = plan.received
      ? `The receiver's output falls ${f0(plan.delay * 1e6)} μs after each burst begins and stays low as long as the burst. The TV times each fall to the next: longer than ${DECLARED.split} ms is a 1, shorter a 0. Bits so far: ${running && now.decodedBits ? now.decodedBits : 'none'}.`
      : plan.blocked ? 'No light reaches the receiver, so its output stays high and the TV decodes nothing.'
      : `At ${f2(plan.irradiance)} mW/m² the light is under the receiver's threshold, so its output stays high and the TV decodes nothing.`;
    const ledHint = plan.emitter === 0
      ? `The ${TSAL6200.name}, ${TSAL6200.material} at ${TSAL6200.peak} nm: each photon carries hc/λ = ${f2(tx.photon)} eV, and at ${f1(tx.current * 1000)} mA the LED takes ${f2(tx.voltage)} V, so each electron brings a little more energy than a photon carries away. Of the ${f0(tx.ledPower * 1000)} mW it takes, ${f1(plan.power)} mW leaves as light: ${f0(100 * plan.efficiency)}%, or ${f2(plan.photonsPerElectron)} photons for each electron.`
      : `The ${shown.led.sheet.name}, ${shown.led.sheet.material} at ${shown.led.sheet.peak} nm: photons of ${f2(shown.photon)} eV. Through ${DECLARED.indicatorResistor} Ω from ${f1(plan.battery)} V it passes ${ampsText(shown.current)} at ${f2(shown.voltage)} V. Its sheet gives brightness in candelas, ${shown.led.sheet.luminous} mcd at ${f0(shown.led.sheet.luminousAt * 1000)} mA, not in watts, so no efficiency is worked out.`;
    const decade = SPICE_1N4148.N * VT * Math.log(10);
    const probeText = plan.probe > 0 ? `Forward, the current grows tenfold every ${f0(decade * 1000)} mV until the series resistance slows it; a fixed drop of ${f1(PAGES.threshold[1])} V would pass nothing below that.` : plan.probe < 0 ? `Reversed, only ${ampsText(-plan.diode.current)} flows back, from pairs heat makes in the depletion region and through R1.` : 'With no voltage across it, no current flows.';
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('LED current', `${f0(tx.current * 1000)} mA`, `Two cells at ${f1(plan.battery)} V push current through the ${TSAL6200.name}, a ${DECLARED.resistor} Ω resistor and the cells' own ${f2(cellsOhms)} Ω. At ${f1(tx.current * 1000)} mA the LED takes ${f2(tx.voltage)} V, the resistor ${f2(tx.resistorDrop)} V and the cells ${f2(tx.cellDrop)} V. The sheet allows ${f0(TSAL6200.ifMax * 1000)} mA steady and ${f0(TSAL6200.ifmMax * 1000)} mA in short pulses; lit a third of each carrier cycle and only during bursts, the LED averages ${f1(plan.average * 1000)} mA over a frame.`),
        r('Radiant intensity', `${f0(plan.intensity)} mW/sr`, `The sheet gives ${TSAL6200.intensity} mW/sr at ${f0(TSAL6200.at * 1000)} mA and ${TSAL6200.intensityPulse} mW/sr at ${TSAL6200.pulse} A; between them the intensity is taken to grow as the current to the power ${f2(INTENSITY_SLOPE)}. Its light falls to half ${TSAL6200.halfAngle}° off its axis. It stays above the receiver's NEC threshold of ${TSOP38438.nec} mW/m² out to ${f1(plan.range)} m.`),
        r('At the receiver', `${f2(plan.irradiance)} mW/m²`, plan.blocked ? `A hand in the beam stops the light. Without it, ${f1(plan.intensity)} mW/sr over (${plan.distance} m)² would give ${f2(plan.reach)} mW/m².` : `Radiant intensity over the distance squared: ${f1(plan.intensity)} mW/sr over (${plan.distance} m)² is ${f2(plan.reach)} mW/m², ${plan.received ? `${f1(plan.margin)} times` : `${f0(100 * plan.margin)}% of`} the ${TSOP38438.nec} mW/m² the receiver needs.`),
        r('Photocurrent', `${f1(plan.light * 1e9)} nA`, `The photodiode's ${BPW34.area} mm² at ${f3(RESPONSIVITY)} A/W turns ${f2(plan.irradiance)} mW/m² into ${f1(plan.light * 1e9)} nA during each burst, on top of a dark current of ${f0(BPW34.dark * 1e9)} nA that flows with no light at all. The receiver passes only a band ${f1(BAND / 1000)} kHz wide at the carrier, where the dark current's shot noise is ${f2(plan.noise * 1e12)} pA.`),
        r('Frame', `${f2(plan.frameEnd * 1000)} ms`, `A ${NEC.leader} ms burst and ${NEC.pause} ms of quiet, then 32 bits, each a burst of ${NEC.pulses} carrier cycles and a quiet that makes its pulse distance ${NEC.zero} ms for a 0 or ${NEC.one} ms for a 1, then a closing burst. The address ${NEC.address} and the command ${byteOf(plan.command)} each go out twice, the second time inverted, so every frame holds 16 ones and 16 zeros and takes ${NEC.word} ms to its closing burst.`),
        r('Decoded', decodedValue, decodedHint),
        r('Carrier', `${f0(NEC.carrier / 1000)} kHz`, `Each bit's burst is ${NEC.pulses} flashes, one every ${f1(1e6 / NEC.carrier)} μs and each lit a third of that, ${f0(plan.burst * 1e6)} μs in all. The receiver's band pass keeps the carrier and its demodulator ignores steady light, so a signal weaker than the dark current still gets through: at the threshold the photocurrent is only ${f1(photocurrentOf(TSOP38438.nec) * 1e9)} nA.`),
        r('LED close up', `${f2(shown.photon)} eV photons`, ledHint),
        r('Diode', `${ampsText(plan.diode.current)} at ${signed(plan.probe, 2)} V`, `Nexperia's SPICE model of the 1N4148 at 25 °C: a saturation current of ${f3(SPICE_1N4148.IS * 1e9)} nA, an emission coefficient of ${SPICE_1N4148.N} and ${SPICE_1N4148.RS} Ω in series, with ${f3(SPICE_1N4148.R1 / 1e9)} GΩ beside it. ${probeText} The depletion region is drawn ${f2(plan.depletion)} times its width at no bias. The sheet allows at most ${P1.vf} V at ${f0(P1.at * 1000)} mA, where the model gives ${f3(DIODE_TEST.at)} V, and ${f0(P1.leak * 1e9)} nA at ${P1.leakAt} V reversed, where it gives ${f1(DIODE_TEST.leak * 1e9)} nA.`),
        r('Slowed', `${DECLARED.slow} times`, `The frame and the receiver's delay, ${f2(plan.duration * 1000)} ms, take ${f1(plan.duration * DECLARED.slow)} s here. The handset is drawn at true size, the room ${f0(timesSmaller(METER))} times smaller and the diode's package ${f0(timesLarger(BIG))} times larger.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt / DECLARED.slow); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the handset, true size', part: 'handset', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the beam across the room', part: 'room', view: 'front', replay: false, run() { return inspect(NEC.leader / 2000); }},
    {label: 'Inspect: the first command bit', part: 'signal', view: 'front', replay: false, run() { return inspect(result.getState().bitStarts[16] + result.getState().burst / 2); }},
    {label: 'Inspect: the LED junction', part: 'led', view: 'front', replay: false, run() { return inspect(NEC.leader / 2000); }},
    {label: 'Inspect: the photodiode', part: 'receiver', view: 'front', replay: false, run() { return inspect(NEC.leader / 2000); }},
    {label: 'Inspect: the 1N4148 junction', part: 'junction', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Press the key',
    description: `The handset sends one NEC frame for the command: a leader, 32 bits and a closing burst, ${slowText} than it happens.`,
    stepLabel: 'Advance 1 s',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'signal', label: 'Inspect the decoded frame', view: 'front', focusOnComplete: false, available: () => clock >= duration()};
  for (const [id, route] of [['led', '#machine/light-emitting-diode'], ['receiver', '#machine/photodiode'], ['junction', '#machine/diode']]) result.parts.find(item => item.id === id).route = route;

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, handset, shell, board, keys, chip, transistor, capacitor, resistors, cells, terminals, traces, irFlange, irBody, irDome, indicatorLed, handBeam, room, axis, handsetMark, beamEdges, beamFill, tv, tvDot, hand, rangeTick, signal, rowFrames, ledGuide, lightGuide, outputGuide, ledTrace, lightTrace, outputTrace, darkLevel, bitGuide, bitTrace, signalCursor, timeTicks, magnifierFrame, carrierGuide, carrierTrace, led, pSide, activeLayer, nSide, ledContacts, ledHoles, ledElectrons, ledPhotons, ledChart, ledFrame, ledCurves, photonTicks, loadLine, ledCursor, receiver, pLayer, iLayer, nLayer, pinContacts, pinMinus, pinPlus, field, pinPhotons, pairElectrons, pairHoles, receiverChart, blocks, blockLinks, receiverFrame, receiverTicks, thresholdLine, darkLine, receiverCurve, rangeLine, receiverCursor, junction, pack, glass, band, leads, die, jP, jN, depletion, jContacts, majorityHoles, majorityElectrons, crossingHoles, crossingElectrons, jLeft, jRight, diodeChart, reverseFrame, forwardFrame, reverseCurve, forwardCurve, fixedDrop, sheetLimits, diodeCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

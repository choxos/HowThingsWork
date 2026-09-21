import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow, stripGeometry} from './scene-kit.js';
import {phonePlan, phoneAt, chartAt, columnAt, rowAt, ADXL335, AN2934, COIN, DECLARED, GRID, PITCH, WEIGHT, PHONE_DEFAULTS, PHONE_DOMAINS, FILTER_OPTIONS} from './phone-physics.js';

// ---------------------------------------------------------------------------
// Smartphone: a phone at true size with the touch grid over its screen, the
// grid under the fingertip close up, the two sensing cells of its accelerometer
// cut open, what the accelerometer reads through a buzz, and its coin
// vibration motor cut open.
//
// Scale: the phone is drawn at true size, 1 mm to 0.01 scene units, its body
// illustrative; its shaking is drawn 2,000 times larger. The touch close up is
// drawn 3 times larger, 1 mm to 0.03 units, in the phone's own axes. The accelerometer's
// cells are a schematic, not to scale, and their proof masses' movement is
// drawn 60 times its true share of the gap. The motor is drawn 10 times
// larger, 1 mm to 0.1 units. The chart is not to scale.
//
// Time: the motor turns 100 times slower than it does, said in the part text
// and a reading.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const SHAKE = 2000;
export const MOTOR_MM = 0.1;
export const SHARE = 60;
export const TOUCH_MM = 0.03;

/** How many times larger than true size a scale in units per mm draws. */
export const timesLarger = unitsPerMillimeter => unitsPerMillimeter / MM;

/** The phone, mm: its body, its screen and how far the screen sits above the body's middle, where the accelerometer and the motor sit, its text lines, its axis arrows, and the lift arrow in units per g. */
export const PHONE = Object.freeze({origin: Object.freeze([-2.1, 0, 0]), body: Object.freeze([72, 150, 8]), screen: DECLARED.screen, raise: 3, chip: Object.freeze([-14, 38]), motor: Object.freeze([17, -50]), margin: 6, lineGap: 6.5, lineHeight: 2.2, axis: 18, axisThickness: 0.004, lift: 0.3, liftThickness: 0.008});

/** The accelerometer's two cells, in each cell's own units with its sense axis along v: the spine's and fingers' reach, the fixed fingers' reach, the fingers' thickness and gap, the rows, the anchor bars and spring anchors, the springs' width, the substrate, and the sag arrow in units per g. */
export const CELLS = Object.freeze({origin: Object.freeze([0.2, 0.72, 0]), offset: 0.53, spine: Object.freeze([0.05, 0.42]), finger: Object.freeze([0.05, 0.31]), fixed: Object.freeze([0.09, 0.38]), thickness: 0.04, gap: 0.08, rows: Object.freeze([-0.16, 0.16]), bar: Object.freeze([0.38, 0.44, 0.32]), anchor: Object.freeze([0.3, 0.36]), beam: 0.012, substrate: Object.freeze([0.47, 0.49]), segments: 16, arrowAt: Object.freeze([0, -0.57]), arrow: 0.12, arrowThickness: 0.009});

export const CHART = Object.freeze({x: -0.85, y: -1.22, w: 3.45, h: 0.6, z: 0, range: 3, tickEvery: 0.01, tick: 0.02, cursor: 0.02});

/** The motor, mm: its housing, magnet ring, commutator, shaft, centroid dot, brushes, the coils' angles and radii, and the force arrow in units per N. */
export const MOTORVIEW = Object.freeze({origin: Object.freeze([2.15, 0.72, 0]), housing: 5, magnet: Object.freeze([2.2, 4.2]), commutator: 1, shaft: 0.35, dot: 0.25, brush: Object.freeze([2.8, 0.5]), coils: Object.freeze([Object.freeze([115, 165]), Object.freeze([195, 245])]), coilRadii: Object.freeze([1.4, 3.9]), force: 0.6, arrow: 0.006});

/** The touch close up, mm unless named: where it sits, above the phone; each crossing's square; the found cross's arm in the close up and on the phone; the fingertip's center dot. */
export const TOUCHVIEW = Object.freeze({origin: Object.freeze([-2.1, 1.5, 0]), square: 3.5, cross: 2, phoneCross: 1.5, dot: 0.25});

/** Half the width and height of the patch the controller weighs, mm: two columns and one row each side of the strongest crossing, each half a pitch wide. */
export const PATCH = Object.freeze([(2 * DECLARED.window[0] + 1) * PITCH[0] / 2, (2 * DECLARED.window[1] + 1) * PITCH[1] / 2]);

/** Where the leader to the motor turns, clear of the cells. */
export const LEAD = Object.freeze([1.32, -0.4, 0]);

export const COLORS = Object.freeze({body: 0x2f3336, screen: 0xe8ecef, text: 0x6b7378, xray: 0x3f6f9f, x: 0x2b5d9c, y: 0xc98a1b, xGuide: 0xa9bfd6, yGuide: 0xe3cc9c, chart: 0x374736, faint: 0x9aa39a, push: 0xc14f39, substrate: 0xe9e4d8, anchor: 0x6f7a73, fixed: 0x8f989b, mass: 0xb9c7b5, spring: 0x4f5b55, housing: 0xd9d6cc, magnet: 0x8a94a6, weight: 0x4b4f54, coil: 0xb87333, brush: 0x374736, sense: 0x2e8b57, drive: 0x7d5ba6, senseFaint: 0xb7dcc5, driveFaint: 0xd6cae6, finger: 0xc9785a, change: 0x86a5bf, found: 0x2f3336});

/** Where a point on the screen, mm from its left and bottom edges, lies on the phone, mm about the body's middle. */
export const onPhone = (across, along) => [across - PHONE.screen[0] / 2, along - PHONE.screen[1] / 2 + PHONE.raise];

/** Where a time, s, and a reading, g, fall on the chart. */
export const chartX = (plan, t) => CHART.x + Math.max(0, Math.min(1, t / plan.duration)) * CHART.w;
export const chartY = g => CHART.y + (Math.max(-CHART.range, Math.min(CHART.range, g)) + CHART.range) / (2 * CHART.range) * CHART.h;

/** A guided beam's shape from its anchor (0) to the mass (1): 3s² − 2s³ of the mass's movement. */
export const beamShape = s => 3 * s * s - 2 * s * s * s;

/** Text lines on the screen, mm about its center: [x0, x1, y0, y1], upright in portrait, or laid along the phone for landscape. */
export function screenBars(landscape) {
  const [sw, sh] = PHONE.screen, width = landscape ? sh : sw, height = landscape ? sw : sh, bars = [];
  let seed = 11;
  const next = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let line = 0; ; line++) {
    const top = height / 2 - PHONE.margin - line * PHONE.lineGap;
    if (top - PHONE.lineHeight < -height / 2 + PHONE.margin) break;
    if (line === 2 || line === 9) continue;
    const share = line === 0 ? 0.5 : line === 1 || line === 8 || line % 7 === 6 ? 0.4 + 0.3 * next() : 0.85 + 0.15 * next();
    const x0 = -width / 2 + PHONE.margin, x1 = x0 + (width - 2 * PHONE.margin) * share;
    bars.push([x0, x1, top - (line === 0 ? 3.2 : PHONE.lineHeight), top]);
  }
  return landscape ? bars.map(([x0, x1, y0, y1]) => [y0, y1, -x1, -x0]) : bars;
}

/** The fixed fingers' centers along v: one each side of every moving finger, a gap and a finger's thickness away. */
export const fixedRows = () => CELLS.rows.flatMap(v => [v - CELLS.thickness - CELLS.gap, v + CELLS.thickness + CELLS.gap]);

const circlePoints = (cx, cy, radius, count, z) => Array.from({length: count}, (_, i) => { const a = 2 * Math.PI * i / (count - 1); return [cx + radius * Math.cos(a), cy + radius * Math.sin(a), z]; });
/** A number with a true minus sign. */
export const signed = (value, digits) => { const text = fixed(Math.abs(value), digits); return value < 0 && text !== fixed(0, digits) ? `−${text}` : text; };

export function createSmartphoneModel() {
  const kit = houseModel('Smartphone'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const barsMesh = (bars, parent) => {
    const geometry = new THREE.BufferGeometry(), positions = new Float32Array(bars.length * 12), index = [];
    bars.forEach(([x0, x1, y0, y1], b) => {
      positions.set([x0, y0, x1, y0, x1, y1, x0, y1].flatMap((value, i) => (i % 2 ? [(value + PHONE.raise) * MM, 0.002] : [value * MM])), b * 12);
      index.push(4 * b, 4 * b + 1, 4 * b + 2, 4 * b, 4 * b + 2, 4 * b + 3);
    });
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, unlit(COLORS.text));
    parent.add(mesh);
    return mesh;
  };

  const system = part('system', 'Smartphone, close up', `A smartphone at true size with the touch grid over its screen, the grid under your fingertip ${fixed(timesLarger(TOUCH_MM), 0)} times larger, the two sensing cells of its accelerometer cut open as a schematic, what the accelerometer reads through a buzz, and its coin vibration motor cut open ${fixed(timesLarger(MOTOR_MM), 0)} times larger. Press Play to buzz the motor: it turns ${DECLARED.slow} times slower here than it does.`);

  // The phone at true size.
  const phone = part('phone', 'Smartphone, true size', `A phone of ${fixed(DECLARED.phone, 0)} g drawn at true size, ${fixed(PHONE.body[1], 0)} mm tall, its body illustrative. Over its screen run the touch grid’s ${GRID.columns} sensing columns (faint green) and ${GRID.rows} driving rows (faint violet); the disc is your fingertip, the dark outline the patch drawn larger above, and the dark cross where the controller finds the touch. The blue outlines show where the ${fixed(ADXL335.size[0], 0)} mm accelerometer and the ${fixed(COIN.diameter, 0)} mm motor sit inside, the blue and gold arrows are its x and y axes, and the red arrow shows a hand speeding it up or letting it fall. Its shaking is drawn ${fixed(SHAKE, 0)} times larger.`, PHONE.origin, system);
  const handset = new THREE.Group();
  phone.add(handset);
  const [bw, bh, bd] = PHONE.body, [sw, sh] = PHONE.screen, [chipX, chipY] = PHONE.chip, chipHalf = ADXL335.size[0] / 2;
  const body = kit.box([bw * MM, bh * MM, bd * MM], [0, 0, -bd * MM / 2], COLORS.body, handset);
  const screen = flat(COLORS.screen, handset);
  rect(screen, -sw / 2 * MM, sw / 2 * MM, (PHONE.raise - sh / 2) * MM, (PHONE.raise + sh / 2) * MM, 0.001);
  const portrait = barsMesh(screenBars(false), handset), landscape = barsMesh(screenBars(true), handset);
  const gridColumns = segmentLines(GRID.columns, COLORS.senseFaint, handset), gridRows = segmentLines(GRID.rows, COLORS.driveFaint, handset);
  fillLine(gridColumns, Array.from({length: GRID.columns}, (_, j) => [onPhone(columnAt(j), 0), onPhone(columnAt(j), sh)]).flat().map(([x, y]) => [x * MM, y * MM, 0.0015]));
  fillLine(gridRows, Array.from({length: GRID.rows}, (_, i) => [onPhone(0, rowAt(i)), onPhone(sw, rowAt(i))]).flat().map(([x, y]) => [x * MM, y * MM, 0.0015]));
  const fingertip = new THREE.Mesh(new THREE.CircleGeometry(AN2934.typical / 2 * MM, 32), unlit(COLORS.finger, {transparent: true, opacity: 0.55}));
  handset.add(fingertip);
  const patchOutline = lineObject(5, COLORS.found, handset), foundMark = segmentLines(2, COLORS.found, handset);
  const chipOutline = lineObject(5, COLORS.xray, handset), motorOutline = lineObject(49, COLORS.xray, handset);
  fillLine(chipOutline, [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, y]) => [(chipX + x * chipHalf) * MM, (chipY + y * chipHalf) * MM, 0.003]));
  fillLine(motorOutline, circlePoints(PHONE.motor[0] * MM, PHONE.motor[1] * MM, COIN.diameter / 2 * MM, 49, 0.003));
  const xAxis = solidArrow(kit, COLORS.x, handset, PHONE.axisThickness), yAxis = solidArrow(kit, COLORS.y, handset, PHONE.axisThickness);
  for (const [arrow, direction] of [[xAxis, [1, 0, 0]], [yAxis, [0, 1, 0]]]) {
    arrow.position.set(chipX * MM, chipY * MM, 0.004);
    arrow.userData.setDirection(new THREE.Vector3(...direction));
    arrow.userData.setLength(PHONE.axis * MM);
  }
  const liftArrow = solidArrow(kit, COLORS.push, phone, PHONE.liftThickness);
  liftArrow.position.set(0, 0, 0.02);
  const leaders = segmentLines(3, COLORS.faint, system);

  // The grid under the fingertip, 3 times larger, in the phone's own axes.
  const [wide, tall] = DECLARED.window, changeColor = new THREE.Color(COLORS.change);
  const touch = part('touch', 'Touchscreen, close up', `The patch of the touch grid inside the dark outline on the phone, drawn ${fixed(timesLarger(TOUCH_MM), 0)} times larger in the phone’s own axes: the ${2 * wide + 1} sensing columns (green) and ${2 * tall + 1} driving rows (violet) around the crossing that changes most. Each square shades with how far its crossing’s capacitance falls, the circle is the ${fixed(AN2934.typical, 0)} mm fingertip with a dot at its center, and the dark cross is where the controller finds the touch.`, TOUCHVIEW.origin, system);
  const pad = flat(COLORS.screen, touch);
  rect(pad, -PATCH[0] * TOUCH_MM, PATCH[0] * TOUCH_MM, -PATCH[1] * TOUCH_MM, PATCH[1] * TOUCH_MM, -0.002);
  const squares = [];
  for (let di = -tall; di <= tall; di++) {
    for (let dj = -wide; dj <= wide; dj++) {
      const mesh = flat(COLORS.screen, touch), x = dj * PITCH[0] * TOUCH_MM, y = di * PITCH[1] * TOUCH_MM, half = TOUCHVIEW.square / 2 * TOUCH_MM;
      rect(mesh, x - half, x + half, y - half, y + half, -0.001);
      squares.push({dj, di, mesh});
    }
  }
  const touchColumns = segmentLines(2 * wide + 1, COLORS.sense, touch), touchRows = segmentLines(2 * tall + 1, COLORS.drive, touch);
  fillLine(touchColumns, Array.from({length: 2 * wide + 1}, (_, k) => { const x = (k - wide) * PITCH[0] * TOUCH_MM; return [[x, -PATCH[1] * TOUCH_MM, 0], [x, PATCH[1] * TOUCH_MM, 0]]; }).flat());
  fillLine(touchRows, Array.from({length: 2 * tall + 1}, (_, k) => { const y = (k - tall) * PITCH[1] * TOUCH_MM; return [[-PATCH[0] * TOUCH_MM, y, 0], [PATCH[0] * TOUCH_MM, y, 0]]; }).flat());
  const touchFrame = lineObject(5, COLORS.found, touch);
  fillLine(touchFrame, [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => [a * PATCH[0] * TOUCH_MM, b * PATCH[1] * TOUCH_MM, 0.0015]));
  const touchFinger = lineObject(49, COLORS.finger, touch), fingerDot = new THREE.Mesh(new THREE.CircleGeometry(TOUCHVIEW.dot * TOUCH_MM, 16), unlit(COLORS.finger));
  touch.add(fingerDot);
  const touchFound = segmentLines(2, COLORS.found, touch);

  // The accelerometer's two cells, a schematic.
  const accelerometer = part('accelerometer', 'Accelerometer, cut open', `The accelerometer’s two sensing cells as a schematic, not to scale: the left one senses along the phone’s x axis (blue) and the right one along its y axis (gold). Each proof mass hangs on four springs, and each of its fingers sits between two fixed fingers, so moving the mass narrows one gap and widens the other. The masses’ movement is drawn ${SHARE} times its true share of the gap, and the red arrow points the way they sag.`, CELLS.origin, system);
  const [substrateU, substrateV] = CELLS.substrate, [spineU, spineV] = CELLS.spine, [anchorIn, anchorOut] = CELLS.anchor;
  const cells = ['x', 'y'].map(axis => {
    const group = new THREE.Group();
    group.position.set(axis === 'x' ? -CELLS.offset : CELLS.offset, 0, 0);
    group.rotation.z = axis === 'x' ? -Math.PI / 2 : 0;
    accelerometer.add(group);
    const substrate = flat(COLORS.substrate, group);
    rect(substrate, -substrateU, substrateU, -substrateV, substrateV, -0.002);
    const border = lineObject(5, COLORS[axis], group);
    fillLine(border, [[-substrateU, -substrateV, 0], [substrateU, -substrateV, 0], [substrateU, substrateV, 0], [-substrateU, substrateV, 0], [-substrateU, -substrateV, 0]]);
    const anchors = [], fixedFingers = [];
    for (const side of [-1, 1]) {
      const [b0, b1, reach] = CELLS.bar, bar = flat(COLORS.anchor, group);
      rect(bar, side > 0 ? b0 : -b1, side > 0 ? b1 : -b0, -reach, reach);
      anchors.push(bar);
      for (const v of fixedRows()) {
        const [f0, f1] = CELLS.fixed, finger = flat(COLORS.fixed, group);
        rect(finger, side > 0 ? f0 : -f1, side > 0 ? f1 : -f0, v - CELLS.thickness / 2, v + CELLS.thickness / 2);
        fixedFingers.push(finger);
      }
      for (const end of [-1, 1]) {
        const anchor = flat(COLORS.anchor, group), size = anchorOut - anchorIn;
        rect(anchor, side > 0 ? anchorIn : -anchorOut, side > 0 ? anchorOut : -anchorIn, end * spineV - size / 2, end * spineV + size / 2);
        anchors.push(anchor);
      }
    }
    const mass = new THREE.Group();
    group.add(mass);
    const spine = flat(COLORS.mass, mass);
    rect(spine, -spineU, spineU, -spineV, spineV, 0.001);
    const fingers = [];
    for (const side of [-1, 1]) {
      for (const v of CELLS.rows) {
        const [m0, m1] = CELLS.finger, finger = flat(COLORS.mass, mass);
        rect(finger, side > 0 ? m0 : -m1, side > 0 ? m1 : -m0, v - CELLS.thickness / 2, v + CELLS.thickness / 2, 0.001);
        fingers.push(finger);
      }
    }
    const springs = [];
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const geometry = stripGeometry(CELLS.segments), strip = new THREE.Mesh(geometry, unlit(COLORS.spring, {side: THREE.DoubleSide}));
        strip.frustumCulled = false;
        group.add(strip);
        springs.push({side, end, strip, geometry});
      }
    }
    return {axis, group, substrate, border, anchors, fixedFingers, mass, spine, fingers, springs};
  });
  const sagArrow = solidArrow(kit, COLORS.push, accelerometer, CELLS.arrowThickness);
  sagArrow.position.set(CELLS.arrowAt[0], CELLS.arrowAt[1], 0.01);

  // What the accelerometer reads.
  const output = part('output', 'What the accelerometer reads', `What the accelerometer’s x output (blue) and y output (gold) read through a buzz of ${fixed(DECLARED.buzz * 1000, 0)} ms, from −${ADXL335.range} g at the bottom to +${ADXL335.range} g at the top, its measurement range: faint for the whole buzz, dark as far as the clock has run. A tick below the chart marks every ${fixed(CHART.tickEvery * 1000, 0)} ms.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, output);
  fillLine(chartFrame, [[CHART.x, CHART.y, CHART.z], [CHART.x + CHART.w, CHART.y, CHART.z], [CHART.x + CHART.w, CHART.y + CHART.h, CHART.z], [CHART.x, CHART.y + CHART.h, CHART.z], [CHART.x, CHART.y, CHART.z]]);
  const grid = segmentLines(2 * CHART.range - 2, COLORS.faint, output), zeroLine = segmentLines(1, COLORS.chart, output);
  fillLine(grid, Array.from({length: 2 * CHART.range - 1}, (_, i) => i - CHART.range + 1).filter(g => g !== 0).flatMap(g => [[CHART.x, chartY(g), CHART.z], [CHART.x + CHART.w, chartY(g), CHART.z]]));
  fillLine(zeroLine, [[CHART.x, chartY(0), CHART.z], [CHART.x + CHART.w, chartY(0), CHART.z]]);
  const tickCount = Math.round(DECLARED.buzz / CHART.tickEvery) - 1, ticks = segmentLines(tickCount, COLORS.chart, output);
  fillLine(ticks, Array.from({length: tickCount}, (_, i) => { const x = CHART.x + (i + 1) * CHART.tickEvery / DECLARED.buzz * CHART.w; return [[x, CHART.y, CHART.z], [x, CHART.y - CHART.tick, CHART.z]]; }).flat());
  const guideX = lineObject(DECLARED.samples, COLORS.xGuide, output), guideY = lineObject(DECLARED.samples, COLORS.yGuide, output);
  const curveX = lineObject(DECLARED.samples + 1, COLORS.x, output), curveY = lineObject(DECLARED.samples + 1, COLORS.y, output), cursors = segmentLines(4, COLORS.chart, output);

  // The coin motor, 10 times larger.
  const motor = part('motor', 'Vibration motor, cut open', `The coin vibration motor cut open face on, drawn ${fixed(timesLarger(MOTOR_MM), 0)} times larger: ${fixed(COIN.diameter, 0)} mm across, with a half disk of tungsten carbide ${fixed(WEIGHT.radius * 1000, 2)} mm in radius turning on its shaft, the flat coils that turn with it, the magnet ring beneath and the brushes. The red dot marks the weight’s center of mass, and the red arrow the force the turning weight pulls the housing with, toward the weight. It turns ${DECLARED.slow} times slower than it does.`, MOTORVIEW.origin, system);
  const housing = new THREE.Mesh(new THREE.CircleGeometry(MOTORVIEW.housing * MOTOR_MM, 64), unlit(COLORS.housing));
  housing.position.z = -0.003;
  motor.add(housing);
  const rim = lineObject(65, COLORS.chart, motor);
  fillLine(rim, circlePoints(0, 0, MOTORVIEW.housing * MOTOR_MM, 65, 0.004));
  const magnet = new THREE.Mesh(new THREE.RingGeometry(MOTORVIEW.magnet[0] * MOTOR_MM, MOTORVIEW.magnet[1] * MOTOR_MM, 64), unlit(COLORS.magnet));
  magnet.position.z = -0.002;
  motor.add(magnet);
  const [brushOut, brushOffset] = MOTORVIEW.brush, brushIn = Math.sqrt(MOTORVIEW.commutator ** 2 - brushOffset ** 2);
  const brushes = segmentLines(2, COLORS.brush, motor);
  fillLine(brushes, [[-brushOut, brushOffset], [-brushIn, brushOffset], [-brushOut, -brushOffset], [-brushIn, -brushOffset]].map(([x, y]) => [x * MOTOR_MM, y * MOTOR_MM, 0.0005]));
  const rotor = new THREE.Group();
  motor.add(rotor);
  const weight = new THREE.Mesh(new THREE.CircleGeometry(WEIGHT.radius * 1000 * MOTOR_MM, 48, -Math.PI / 2, Math.PI), unlit(COLORS.weight));
  weight.position.z = 0.001;
  rotor.add(weight);
  const coils = MOTORVIEW.coils.map(([a0, a1]) => {
    const line = lineObject(25, COLORS.coil, rotor), [r0, r1] = MOTORVIEW.coilRadii, at = (radius, degrees) => [radius * MOTOR_MM * Math.cos(degrees * Math.PI / 180), radius * MOTOR_MM * Math.sin(degrees * Math.PI / 180), 0.002];
    const arc = Array.from({length: 12}, (_, i) => a0 + (a1 - a0) * i / 11);
    fillLine(line, [...arc.map(a => at(r1, a)), ...arc.reverse().map(a => at(r0, a)), at(r1, a0)]);
    return line;
  });
  const commutator = lineObject(33, COLORS.chart, rotor);
  fillLine(commutator, circlePoints(0, 0, MOTORVIEW.commutator * MOTOR_MM, 33, 0.002));
  const centroidDot = new THREE.Mesh(new THREE.CircleGeometry(MOTORVIEW.dot * MOTOR_MM, 16), unlit(COLORS.push));
  centroidDot.position.set(WEIGHT.centroid * 1000 * MOTOR_MM, 0, 0.003);
  rotor.add(centroidDot);
  const path = lineObject(65, COLORS.faint, motor);
  fillLine(path, circlePoints(0, 0, WEIGHT.centroid * 1000 * MOTOR_MM, 65, 0.0025));
  const shaft = new THREE.Mesh(new THREE.CircleGeometry(MOTORVIEW.shaft * MOTOR_MM, 16), unlit(COLORS.chart));
  shaft.position.z = 0.005;
  motor.add(shaft);
  const forceArrow = solidArrow(kit, COLORS.push, motor, MOTORVIEW.arrow);
  forceArrow.position.z = 0.006;

  const d = PHONE_DEFAULTS, [acrossDomain, alongDomain, turnDomain, liftDomain, driveDomain, filterDomain] = ['across', 'along', 'turn', 'lift', 'drive', 'filter'].map(key => PHONE_DOMAINS[key]);
  control('across', 'Fingertip across', ...acrossDomain, d.across, 'mm', 'How far your fingertip’s center is from the screen’s left edge.');
  control('along', 'Fingertip up', ...alongDomain, d.along, 'mm', 'How far your fingertip’s center is from the screen’s bottom edge.');
  control('turn', 'Turn', ...turnDomain, d.turn, '°', 'How far the upright phone is turned in its own plane, counterclockwise, from portrait toward landscape.');
  control('lift', 'Lift', ...liftDomain, d.lift, 'g', 'How hard a hand speeds the phone upward, or lowers it; at the bottom of the range the hand lets go and the phone falls freely.');
  control('drive', 'Motor voltage', ...driveDomain, d.drive, 'V', 'The DC voltage across the vibration motor. Its sheet rates it at 3.0 V and asks for up to 2.3 V to be sure it starts.');
  control('filter', 'Filter capacitor', ...filterDomain, d.filter, '', 'The capacitor on each output, which with the chip’s 32 kΩ resistor sets the bandwidth.', FILTER_OPTIONS);

  const toUnits = 1000 * MM * SHAKE;
  const result = finish(v => {
    const plan = phonePlan(v), now = phoneAt(plan, clock), turn = plan.values.turn * Math.PI / 180, c = Math.cos(turn), s = Math.sin(turn);

    // The phone, turned and shaken.
    handset.rotation.z = turn;
    handset.position.set((c * now.shake[0] - s * now.shake[1]) * toUnits, (s * now.shake[0] + c * now.shake[1]) * toUnits, 0);
    portrait.visible = !plan.landscape;
    landscape.visible = plan.landscape;
    liftArrow.userData.setLength(Math.abs(plan.values.lift) * PHONE.lift);
    liftArrow.userData.setDirection(new THREE.Vector3(0, plan.values.lift < 0 ? -1 : 1, 0));

    // The touch: the fingertip, the patch the controller weighs, and where it finds the touch, on the phone and close up.
    const found = plan.touch, {j: column, i: row} = found.strongest, [fingerX, fingerY] = onPhone(plan.values.across, plan.values.along), [patchX, patchY] = onPhone(columnAt(column), rowAt(row));
    fingertip.position.set(fingerX * MM, fingerY * MM, 0.0045);
    fillLine(patchOutline, [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => [(patchX + a * PATCH[0]) * MM, (patchY + b * PATCH[1]) * MM, 0.005]));
    const [markX, markY] = onPhone(...found.found), arm = TOUCHVIEW.phoneCross;
    fillLine(foundMark, [[markX - arm, markY], [markX + arm, markY], [markX, markY - arm], [markX, markY + arm]].map(([x, y]) => [x * MM, y * MM, 0.0055]));
    for (const square of squares) square.mesh.material.color.setHex(COLORS.screen).lerp(changeColor, found.changes[(row + square.di) * GRID.columns + column + square.dj]);
    const fingerU = (plan.values.across - columnAt(column)) * TOUCH_MM, fingerV = (plan.values.along - rowAt(row)) * TOUCH_MM;
    fillLine(touchFinger, circlePoints(fingerU, fingerV, AN2934.typical / 2 * TOUCH_MM, 49, 0.003));
    fingerDot.position.set(fingerU, fingerV, 0.0035);
    const foundU = (found.found[0] - columnAt(column)) * TOUCH_MM, foundV = (found.found[1] - rowAt(row)) * TOUCH_MM, reach = TOUCHVIEW.cross * TOUCH_MM;
    fillLine(touchFound, [[foundU - reach, foundV, 0.005], [foundU + reach, foundV, 0.005], [foundU, foundV - reach, 0.005], [foundU, foundV + reach, 0.005]]);

    // The cells: each mass sags by its share of the gap, drawn 60 times larger, its springs bending with it.
    for (const cell of cells) {
      const drop = now.share[cell.axis] * CELLS.gap * SHARE;
      cell.mass.position.y = drop;
      for (const spring of cell.springs) {
        const positions = spring.geometry.attributes.position.array;
        for (let i = 0; i < CELLS.segments; i++) {
          const k = i / (CELLS.segments - 1), u = spring.side * (anchorIn + (spineU - anchorIn) * k), v = spring.end * spineV + drop * beamShape(k);
          positions.set([u, v - CELLS.beam / 2, 0.0005], 2 * i * 3);
          positions.set([u, v + CELLS.beam / 2, 0.0005], (2 * i + 1) * 3);
        }
        spring.geometry.attributes.position.needsUpdate = true;
        spring.geometry.boundingBox = null;
        spring.geometry.boundingSphere = null;
      }
    }
    const steady = Math.hypot(plan.still.x, plan.still.y);
    sagArrow.userData.setLength(steady * CELLS.arrow);
    if (steady > 1e-12) sagArrow.userData.setDirection(new THREE.Vector3(-plan.still.x / steady, -plan.still.y / steady, 0));

    // The chart.
    fillLine(guideX, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.x), CHART.z]));
    fillLine(guideY, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.y), CHART.z]));
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [], live = chartAt(plan, now.t);
    fillLine(curveX, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.x), CHART.z]), [chartX(plan, now.t), chartY(live.x), CHART.z]] : []);
    fillLine(curveY, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.y), CHART.z]), [chartX(plan, now.t), chartY(live.y), CHART.z]] : []);
    const cx = chartX(plan, now.t), cross = g => [[cx - CHART.cursor, chartY(g), CHART.z], [cx + CHART.cursor, chartY(g), CHART.z], [cx, chartY(g) - CHART.cursor, CHART.z], [cx, chartY(g) + CHART.cursor, CHART.z]];
    fillLine(cursors, now.running ? [...cross(live.x), ...cross(live.y)] : []);

    // The motor.
    rotor.rotation.z = now.angle;
    forceArrow.userData.setLength(now.running ? plan.motor.force * MOTORVIEW.force : 0);
    forceArrow.userData.setDirection(new THREE.Vector3(Math.cos(now.angle), Math.sin(now.angle), 0));

    // Leaders from the phone's outlines to the close ups.
    const world = ([x, y]) => [PHONE.origin[0] + handset.position.x + (c * x - s * y) * MM, PHONE.origin[1] + handset.position.y + (s * x + c * y) * MM, 0];
    fillLine(leaders, [world(PHONE.chip), [CELLS.origin[0] - CELLS.offset - substrateV, CELLS.origin[1], 0], world(PHONE.motor), LEAD, LEAD, [MOTORVIEW.origin[0] - MOTORVIEW.housing * MOTOR_MM, MOTORVIEW.origin[1], 0]]);

    // Readings.
    const spinning = plan.motor.spinning, still = plan.still, orientation = plan.landscape ? 'landscape' : 'portrait', label = `${plan.values.filter} μF`;
    const status = clock <= 0 ? `Ready · the touch found ${fixed(found.error, 2)} mm from your fingertip; x reads ${fixed(still.x, 2)} g and y ${fixed(still.y, 2)} g, the screen in ${orientation}; press Play to buzz`
      : !spinning ? `No buzz · at ${fixed(plan.values.drive, 1)} V the motor does not start`
      : now.running ? `Buzzing · the motor shakes the phone, and y reads ${signed(now.output.y, 2)} g`
      : `Done · the motor has stopped, and y reads ${signed(now.output.y, 2)} g again`;
    const falling = Math.abs(plan.values.lift + 1) < 1e-9;
    const gapAxis = Math.abs(now.sag.x) > Math.abs(now.sag.y) ? 'x' : 'y', tiny = Math.abs(now.sag[gapAxis]);
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Touch', `found at ${fixed(found.found[0], 1)}, ${fixed(found.found[1], 1)} mm`, `Your fingertip’s center is ${fixed(plan.values.across, 0)} mm from the screen’s left edge and ${fixed(plan.values.along, 0)} mm from its bottom. The crossing that changes most, sensing column ${column + 1} and driving row ${row + 1}, changes by ${fixed(100 * found.strongest.share, 0)}% of its change with the fingertip centered on it. Weighing it with its neighbors, two columns and one row each side, the controller finds the touch ${fixed(found.error, 2)} mm from the fingertip’s center.`),
        r('Crossings', `${GRID.columns} by ${GRID.rows}, ${fixed(GRID.columns * GRID.rows, 0)}`, `The screen’s ${GRID.rows} driving rows, ${fixed(PITCH[1], 1)} mm apart, cross its ${GRID.columns} sensing columns, ${fixed(PITCH[0], 1)} mm apart, at ${fixed(GRID.columns * GRID.rows, 0)} capacitors, as in the Capacitive sensing page’s example. The controller pulses the rows one at a time and reads every column, so it measures each crossing on its own.`),
        r('Reads', `x ${signed(now.output.x, 2)} g, y ${signed(now.output.y, 2)} g`, `An accelerometer reads its proper acceleration: about 1 g upward at rest, because what holds it up pushes it up, and zero in free fall. Held steady, turned ${fixed(plan.values.turn, 0)}° with a lift of ${signed(plan.values.lift, 1)} g, the phone’s x axis reads ${signed(still.x, 2)} g and its y axis ${signed(still.y, 2)} g, and at 3 V its outputs sit at ${fixed(plan.stillVolts.x, 3)} V and ${fixed(plan.stillVolts.y, 3)} V: 1.5 V and 300 mV for each g.`),
        r('Screen', plan.landscape ? 'Landscape' : 'Portrait', `The model turns the screen to landscape when the x axis reads more than the y axis, which an upright phone does once turned past 45°.${falling ? ' Falling, both axes read zero, and the model keeps portrait.' : ''} Not from a source: real phones hold the last orientation and wait before turning.`),
        r('Proof masses', `x ${fixed(Math.abs(now.sag.x) * 1e9, 1)} nm, y ${fixed(Math.abs(now.sag.y) * 1e9, 1)} nm`, `A mass on a spring sags until the spring pulls as hard as the acceleration needs: a distance of a/ωn², whatever the mass. The sheet’s resonant frequency of ${fixed(ADXL335.resonance / 1000, 1)} kHz makes that ${fixed(plan.sagPerG * 1e9, 2)} nm for each g, ${fixed(100 * plan.sagPerG / plan.gap, 2)}% of a ${fixed(DECLARED.gap, 1)} μm gap. The masses’ movement is drawn ${SHARE} times its share of the gap.`),
        r('Gaps', `${gapAxis}: ${fixed(1e6 * (plan.gap - tiny), 4)} and ${fixed(1e6 * (plan.gap + tiny), 4)} μm`, `Fixed fingers each side of a mass’s finger are driven by square waves 180° out of phase. The ${gapAxis} mass, sagging ${fixed(tiny * 1e9, 1)} nm, narrows one ${fixed(DECLARED.gap, 1)} μm gap and widens the other, and since each gap’s capacitance is εA/d, the finger between them sits at the drive times (C1 − C2)/(C1 + C2): exactly the sag over the gap, ${fixed(100 * tiny / plan.gap, 2)}%.`),
        r('Noise', `${fixed(plan.noise * 1000, 2)} mg`, `The sheet gives a noise density of ${fixed(ADXL335.noise * 1e6, 0)} μg/√Hz on x and y, and an rms noise of that density times √(1.6 × bandwidth). With ${label} and the chip’s ${fixed(ADXL335.resistor / 1000, 0)} kΩ the bandwidth is ${fixed(plan.cutoff, 0)} Hz, so the noise is ${fixed(plan.noise * 1000, 2)} mg rms, what a sag of ${fixed(plan.noiseSag * 1e12, 1)} pm would read.`),
        r('Motor', spinning ? `${fixed(plan.motor.rpm, 0)} rpm` : 'stopped', spinning ? `At ${fixed(plan.values.drive, 1)} V the motor turns ${fixed(plan.motor.rpm, 0)} rpm, ${fixed(plan.motor.hz, 1)} turns a second: its sheet gives ${fixed(COIN.speed, 0)} rpm at ${fixed(COIN.rated, 1)} V, and the speed follows the voltage. Its weight, a half disk of tungsten carbide ${fixed(WEIGHT.radius * 1000, 2)} mm in radius weighing ${fixed(WEIGHT.mass * 1000, 2)} g, pulls on the shaft with mrω² = ${fixed(plan.motor.force, 2)} N.` : `At ${fixed(plan.values.drive, 1)} V the motor does not start: its sheet asks for up to ${fixed(COIN.start, 1)} V to be sure it starts.`),
        r('Buzz', spinning ? `${fixed(plan.buzz, 2)} g` : 'none', spinning ? `That force shakes a phone of ${fixed(DECLARED.phone, 0)} g at ${fixed(plan.buzz, 2)} g, around a circle ${fixed(plan.shake * 1e6, 2)} μm in radius, drawn ${fixed(SHAKE, 0)} times larger. At ${fixed(plan.motor.hz, 0)} Hz the ${fixed(plan.cutoff, 0)} Hz filter passes ${fixed(100 * plan.gain, plan.gain < 0.1 ? 1 : 0)}% of it to the outputs.` : 'With the motor stopped nothing shakes the phone.'),
        r('Slowed', `${fixed(DECLARED.slow, 0)} times`, `The motor turns ${fixed(DECLARED.slow, 0)} times slower here than it does: the buzz of ${fixed(plan.duration * 1000, 0)} ms takes ${fixed(plan.duration * DECLARED.slow, 0)} s. The motor is drawn ${fixed(timesLarger(MOTOR_MM), 0)} times larger.`),
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
    {label: 'Inspect: the touchscreen', part: 'touch', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the accelerometer, cut open', part: 'accelerometer', view: 'front', replay: false, run() { return inspect(duration() / 2); }},
    {label: 'Inspect: the vibration motor', part: 'motor', view: 'front', replay: false, run() { return inspect(duration() / 2); }},
    {label: 'Inspect: the phone', part: 'phone', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: what the accelerometer reads', part: 'output', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Buzz',
    description: `The motor buzzes the phone for ${fixed(DECLARED.buzz * 1000, 0)} ms, turning ${DECLARED.slow} times slower than it does.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'output', label: 'Inspect what the accelerometer read', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, phone, handset, body, screen, portrait, landscape, gridColumns, gridRows, fingertip, patchOutline, foundMark, touch, pad, squares, touchColumns, touchRows, touchFrame, touchFinger, fingerDot, touchFound, chipOutline, motorOutline, xAxis, yAxis, liftArrow, leaders, accelerometer, cells, sagArrow, output, chartFrame, grid, zeroLine, ticks, guideX, guideY, curveX, curveY, cursors, motor, housing, rim, magnet, brushes, rotor, weight, coils, commutator, centroidDot, path, shaft, forceArrow};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

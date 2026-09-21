import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow, stripGeometry} from './scene-kit.js';
import {extinguisherPlan, extinguisherAt, cartridgeShape, levelOf, saturationAt, vacuumReach, dragLength, BODY, NOZZLE, DROP, DISCHARGE, RESIDUAL, FULL_AT, KANEX, IS940, IS4947, IS15683, DECLARED, BAR, KILOGRAM_FORCE, CO2, CARTRIDGE_OPTIONS, EXTINGUISHER_DEFAULTS, EXTINGUISHER_DOMAINS} from './extinguisher-physics.js';

// ---------------------------------------------------------------------------
// Fire extinguisher: a water extinguisher driven by a carbon dioxide cartridge,
// cut open, with its cartridge, squeeze grip and control valve close up, a test
// gauge, its jet, and a chart of the run.
//
// Scale: the body, its siphon tube and its hose are drawn at a quarter of true
// size, 1 mm to 0.0025 scene units. The cartridge, the squeeze grip and the
// control valve are drawn at true size, 1 mm to 0.01 units, their arrangement a
// schematic. The jet is drawn at a hundredth of true size, 1 m to 0.1 units,
// with the nozzle marked by a short bar. The gauge and the chart are not to
// scale.
//
// Time: the clock runs 5 times faster than the discharge, said in the part text
// and a reading.
// ---------------------------------------------------------------------------

export const TRUE_MM = 0.01;
export const BODY_MM = 0.0025;
export const CAP_MM = 0.01;
export const JET_M = 0.1;

/** How a drawing's units per mm compare with true size, in words. */
export const sizeWords = unitsPerMm => ({0.25: 'a quarter of true size', 1: 'true size', 0.01: 'a hundredth of true size'})[String(Number((unitsPerMm / TRUE_MM).toPrecision(6)))];

/** Where each view sits, scene units: the inside of the body's bottom, the top of the cartridge's neck in the close up, the gauge's center, and the floor below the nozzle. */
export const LAYOUT = Object.freeze({body: Object.freeze([-1.9, -1.18, 0]), cap: Object.freeze([-0.45, 0.33, 0]), gauge: Object.freeze([-1.9, 0.85, 0]), jet: Object.freeze([0.95, 0.02, 0])});

/** The body's drawing, mm about the inside of its bottom: the floor below it, the skirt's thickness, the neck ring's inner and outer radius and height, where the top of the cartridge's neck sits, the strainer's half width and height, the cap's box, the hose's bends and width, the nozzle's length and half widths, the fill mark's length, where the gas arrows stand with their mm for each bar, thickness and room to the wall, and the flow arrow's foot, mm for each L/s and thickness. */
export const SHELL = Object.freeze({floor: 8, skirt: 2.4, ring: Object.freeze([31.5, 38, 22]), neck: Object.freeze([-8, 35]), strainer: Object.freeze([9, 30]), cap: Object.freeze([-60, 62, 22, 91]), hose: Object.freeze({bend: 60, turn: 40, run: 40, width: 14}), nozzle: Object.freeze([50, 7, 4]), mark: 12, arrows: Object.freeze([-60, 55]), perBar: 4, arrow: 1.6, clear: 2, flow: Object.freeze([60, 200, 1.6])});

/**
 * The close up, mm about the top of the cartridge's neck: the neck's half width
 * (IS 4947's 26.8 mm thread) and depth, the open neck's and the bore's half
 * widths, the seal's thickness and how far the pin passes it, the shell's
 * outer radius and where its top sits, the rod's half width, point and length,
 * the collar, the holder, the plunger's guide, the lever's bracket, pivot,
 * tail, length, thickness and pin, the valve's body, the siphon tube's center,
 * half width and foot, the seat, the disc's lift and size, the outlet, the
 * stem, the spring's half width and coils, the squeeze arrow's length, gap
 * and thickness, the outlet arrow's foot, mm for each L/s and thickness, and
 * the cap's body behind them all.
 */
export const CAP = Object.freeze({
  neck: Object.freeze([13.4, 21]), cavity: 5, bore: 3, seal: 0.5, pierce: 0.5, hole: 1.2, shell: Object.freeze([20, 16]),
  rod: Object.freeze([2.5, 4, 70]), collar: Object.freeze([7, 30, 4]), holder: Object.freeze([13.4, 19, -8, 6]), guide: Object.freeze([-30, 18, 40, 50]),
  bracket: Object.freeze([-50, -40, 56, 70]), pivot: Object.freeze([-45, 66]), tail: 8, lever: 140, thickness: 6, pin: 2.5,
  valve: Object.freeze([22, 70, 14, 40]), tube: Object.freeze([28, 6, -60]), seat: Object.freeze([18, 20]), lift: 4, disc: Object.freeze([4, 3]), outlet: Object.freeze([26, 34]), stem: 0.6,
  spring: Object.freeze([6, 6]), squeeze: Object.freeze([25, 4, 0.5]), flow: Object.freeze([72, 60, 0.5]), body: Object.freeze([-52, 72, -21, 58]),
});

/** The test gauge, scene units: radius, the angle of 0 and the sweep to full scale in degrees, bar between minor and major ticks, the needle's share of the radius and width, the hub, and the ticks' inner, outer and major inner shares. */
export const DIAL = Object.freeze({radius: 0.24, start: 225, sweep: 270, minor: 1, major: 5, needle: 0.82, width: 0.012, hub: 0.02, ticks: Object.freeze([0.86, 0.95, 0.76])});

/** The jet's view, m: the floor, the meter ticks, the nozzle bar's length and width, and the heights of the range and landing ticks. */
export const JETVIEW = Object.freeze({floor: Object.freeze([-0.3, 12]), tick: 0.25, nozzle: Object.freeze([0.6, 0.18]), range: 0.6, landing: 0.4});

export const CHART = Object.freeze({x: 0.9, y: -1.2, w: 1.4, h: 0.78, top: 0.9, z: 0, tickEvery: 5, ticks: 60, tick: 0.02, bar: 0.012, gap: 0.01, cursor: 0.02});

export const COLORS = Object.freeze({shell: 0xb03a2e, air: 0xf1eee4, gas: 0xaec6d8, water: 0x6fa3cf, liquid: 0x8fb9d6, vapor: 0xe2ecf1, steel: 0x8f989b, dark: 0x374736, brass: 0xc9a55a, strainer: 0xdcc58e, aluminum: 0xc3c8cc, hose: 0x3b3f42, lever: 0x5f6b66, spring: 0x4f5b55, effort: 0xd9822b, push: 0x51606b, flow: 0x2b5d9c, flowFaint: 0xa9bfd6, chart: 0x374736, faint: 0x9aa39a, shareDark: 0x5c6660, gold: 0xd99a2b, limit: 0xc14f39, floor: 0x6f7a73, dial: 0xf7f5ef, capBody: 0xe3e6e8});

const A = BODY.radius * 1000, C = BODY.head * 1000, L = BODY.straight * 1000, H = BODY.height * 1000;

/** Where a time, s, and a share of full height fall on the chart. */
export const chartX = (plan, t) => CHART.x + Math.max(0, Math.min(1, t / plan.duration)) * CHART.w;
export const chartY = share => CHART.y + Math.max(0, Math.min(1, share)) * CHART.top * CHART.h;
/** The needle's angle, radians, for a gauge pressure in bar. */
export const needleAngle = bar => (DIAL.start - DIAL.sweep * Math.max(0, Math.min(1, bar / DECLARED.dial))) * Math.PI / 180;
/** The pin's point, mm, at rest or pushed through the seal: IS 940's 7 mm stroke apart. */
export const tipAt = pressed => -(IS4947.seal + CAP.seal + CAP.pierce) + (pressed ? 0 : IS940.stroke);

/** The lever's angle, radians up from level, that rests its underside on the rod's top where the rod stands. */
export function leverAngle(rodTop) {
  const arm = -CAP.pivot[0];
  let lo = -0.6, hi = 0.6;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (CAP.pivot[1] + arm * Math.tan(mid) - CAP.thickness / 2 / Math.cos(mid) < rodTop) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** The body's inside radius, mm, at `y` mm above the inside of its bottom. */
export function bodyRadius(y) {
  if (y <= 0 || y >= H) return 0;
  if (y < C) return A * Math.sqrt(1 - ((C - y) / C) ** 2);
  if (y <= C + L) return A;
  return A * Math.sqrt(1 - ((y - C - L) / C) ** 2);
}

/** A round ended tube's inside radius, mm, at `h` mm above its bottom. */
export const capsuleRadius = (radius, straight, h) => (h <= 0 || h >= 2 * radius + straight ? 0 : h < radius ? Math.sqrt(radius ** 2 - (radius - h) ** 2) : h <= radius + straight ? radius : Math.sqrt(radius ** 2 - (h - radius - straight) ** 2));

/** The heights where a drawn outline bends: through each end in even steps of angle. */
export const BODY_HEIGHTS = Object.freeze([...Array.from({length: 17}, (_, i) => C * (1 - Math.cos(Math.PI / 2 * i / 16))), ...Array.from({length: 17}, (_, i) => C + L + C * Math.sin(Math.PI / 2 * i / 16))]);
export const capsuleHeights = (radius, straight) => [...Array.from({length: 13}, (_, i) => radius * (1 - Math.cos(Math.PI / 2 * i / 12))), ...Array.from({length: 13}, (_, i) => radius + straight + radius * Math.sin(Math.PI / 2 * i / 12))];
const rowsBetween = (heights, y0, y1) => (y1 - y0 < 1e-9 ? [] : [y0, ...heights.filter(y => y > y0 + 1e-9 && y < y1 - 1e-9), y1]);

/** A round ended tube's outline, mm: `radius` about x = `cx`, its top at `top`, `straight` mm between its ends. */
export function capsulePoints(cx, top, radius, straight, n = 12) {
  const points = [], quarter = i => Math.PI / 2 * i / n;
  for (let i = 0; i <= n; i++) points.push([cx + radius * Math.sin(quarter(i)), top - radius + radius * Math.cos(quarter(i))]);
  for (let i = 0; i <= n; i++) points.push([cx + radius * Math.cos(quarter(i)), top - radius - straight - radius * Math.sin(quarter(i))]);
  for (let i = 1; i <= n; i++) points.push([cx - radius * Math.sin(quarter(i)), top - radius - straight - radius * Math.cos(quarter(i))]);
  for (let i = 1; i < n; i++) points.push([cx - radius * Math.cos(quarter(i)), top - radius + radius * Math.sin(quarter(i))]);
  return points;
}

/** The hose's centerline, mm about the inside of the body's bottom, from the valve's outlet: `count` points evenly along IS 940's 600 mm, each with its heading. */
export function hosePath(count = 64) {
  const {bend, turn, run} = SHELL.hose, length = IS940.hose[1], drop = length - Math.PI / 2 * (bend + turn) - run, first = Math.PI / 2 * bend, second = Math.PI / 2 * turn;
  const x0 = SHELL.neck[0] + CAP.valve[1], y0 = H + SHELL.neck[1] + (CAP.outlet[0] + CAP.outlet[1]) / 2;
  return Array.from({length: count}, (_, i) => {
    const s = length * i / (count - 1);
    if (s <= first) { const a = s / bend; return [x0 + bend * Math.sin(a), y0 - bend + bend * Math.cos(a), Math.cos(a), -Math.sin(a)]; }
    if (s <= first + drop) return [x0 + bend, y0 - bend - (s - first), 0, -1];
    if (s <= first + drop + second) { const a = (s - first - drop) / turn; return [x0 + bend + turn - turn * Math.cos(a), y0 - bend - drop - turn * Math.sin(a), Math.sin(a), -Math.cos(a)]; }
    return [x0 + bend + turn + (s - first - drop - second), y0 - bend - drop - turn, 1, 0];
  });
}

/** The return spring's zigzag, mm, from `y0` up to `y1`. */
export function springPoints(y0, y1) {
  const count = 2 * CAP.spring[1] + 2;
  return Array.from({length: count}, (_, i) => [i === 0 || i === count - 1 ? 0 : i % 2 ? CAP.spring[0] : -CAP.spring[0], y0 + (y1 - y0) * i / (count - 1)]);
}

const circlePoints = (radius, count, z) => Array.from({length: count}, (_, i) => { const a = 2 * Math.PI * i / (count - 1); return [radius * Math.cos(a), radius * Math.sin(a), z]; });

export function createFireExtinguisherModel() {
  const kit = houseModel('Fire extinguisher'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const unlit = color => new THREE.MeshBasicMaterial({color});
  const flat = (color, parent, z = 0) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color)); mesh.position.z = z; parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1) => { mesh.position.x = (x0 + x1) / 2; mesh.position.y = (y0 + y1) / 2; mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); return mesh; };
  const box = (color, parent, x0, x1, y0, y1, z = 0) => rect(flat(color, parent, z), x0, x1, y0, y1);
  const shaped = (points, color, parent, z = 0) => { const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))), unlit(color)); mesh.position.z = z; parent.add(mesh); return mesh; };
  const strip = (rows, color, parent, z = 0) => { const mesh = new THREE.Mesh(stripGeometry(rows), unlit(color)); mesh.frustumCulled = false; mesh.position.z = z; parent.add(mesh); return mesh; };
  const fillStrip = (mesh, pairs) => {
    const positions = mesh.geometry.attributes.position.array, room = positions.length / 6;
    for (let i = 0; i < room; i++) { const [[rx, ry], [lx, ly]] = pairs.length ? pairs[Math.min(i, pairs.length - 1)] : [[0, 0], [0, 0]]; positions.set([rx, ry, 0, lx, ly, 0], i * 6); }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.boundingBox = null;
    mesh.geometry.boundingSphere = null;
    mesh.visible = pairs.length > 1;
  };
  const scaled = (parent, scale) => { const group = new THREE.Group(); group.scale.set(scale, scale, 1); parent.add(group); return group; };
  const across = (heights, y0, y1, radius, shift = 0) => rowsBetween(heights, y0, y1).map(y => [[radius(y), y + shift], [-radius(y), y + shift]]);

  const system = part('system', 'Fire extinguisher, cut open', `A water fire extinguisher driven by a carbon dioxide cartridge, cut open: the body at ${sizeWords(BODY_MM)}, its cartridge, squeeze grip and control valve close up at ${sizeWords(CAP_MM)}, a test gauge, the jet at ${sizeWords(JET_M / 1000)} and a chart of the run. Press Play to squeeze the grip: the clock runs ${DECLARED.fast} times faster than the discharge.`);

  // The body, a quarter of true size.
  const body = part('body', 'Body, cut open', `The body cut open at ${sizeWords(BODY_MM)}: a steel shell ${IS940.diameter} mm across and ${fixed(IS940.shell, 1)} mm thick, with dished ends and a skirt to stand on, holding ${fixed(BODY.volume * 1000, 2)} L inside. The water, the space above it, and the cartridge hanging from the cap. The tick outside marks the ${KANEX.liters} L fill line. The space darkens as its pressure rises, and the gray arrows press on the water with the gas’s pressure, ${SHELL.perBar} mm for each bar.`, LAYOUT.body, system);
  const bodyDraw = scaled(body, BODY_MM), T = IS940.shell;
  const rightSide = [];
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / 16; rightSide.push([(A + T) * Math.cos(a), C + (C + T) * Math.sin(a)]); }
  for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 * i / 16; rightSide.push([(A + T) * Math.cos(a), C + L + (C + T) * Math.sin(a)]); }
  const shell = shaped([...rightSide, ...rightSide.slice(1, -1).reverse().map(([x, y]) => [-x, y])], COLORS.shell, bodyDraw, 0);
  const skirt = [box(COLORS.shell, bodyDraw, A + T - SHELL.skirt, A + T, -SHELL.floor, C / 2, -0.001), box(COLORS.shell, bodyDraw, -A - T, -A - T + SHELL.skirt, -SHELL.floor, C / 2, -0.001)];
  const gas = strip(40, COLORS.air, bodyDraw, 0.001), water = strip(40, COLORS.water, bodyDraw, 0.002);
  const innerPoints = [...BODY_HEIGHTS.map(y => [bodyRadius(y), y]), ...BODY_HEIGHTS.slice().reverse().map(y => [-bodyRadius(y), y])];
  const innerWall = lineObject(innerPoints.length + 1, COLORS.dark, bodyDraw);
  fillLine(innerWall, [...innerPoints, innerPoints[0]].map(([x, y]) => [x, y, 0.0035]));
  const ring = [box(COLORS.steel, bodyDraw, SHELL.ring[0], SHELL.ring[1], H - 4, H + SHELL.ring[2], 0.0005), box(COLORS.steel, bodyDraw, -SHELL.ring[1], -SHELL.ring[0], H - 4, H + SHELL.ring[2], 0.0005)];
  const capBox = box(COLORS.aluminum, bodyDraw, SHELL.cap[0], SHELL.cap[1], H + SHELL.cap[2], H + SHELL.cap[3], 0.0006);
  const bodyCartridges = CARTRIDGE_OPTIONS.map(({value}) => {
    const shape = cartridgeShape(value), group = new THREE.Group(), [cx, cy] = [SHELL.neck[0], H + SHELL.neck[1]];
    group.userData.grams = value;
    bodyDraw.add(group);
    shaped(capsulePoints(cx, cy - CAP.shell[1], CAP.shell[0], shape.straight * 1000), COLORS.steel, group, 0.003);
    box(COLORS.steel, group, cx - CAP.neck[0], cx + CAP.neck[0], cy - CAP.neck[1], cy, 0.0031);
    return group;
  });
  const bodyBracket = box(COLORS.aluminum, bodyDraw, SHELL.neck[0] + CAP.bracket[0], SHELL.neck[0] + CAP.bracket[1], H + SHELL.neck[1] + CAP.bracket[2], H + SHELL.neck[1] + CAP.bracket[3], 0.0006);
  const bodyLever = flat(COLORS.lever, bodyDraw, 0.0034);
  const fillMark = segmentLines(1, COLORS.dark, bodyDraw), markLevel = levelOf(KANEX.liters / 1000) * 1000;
  fillLine(fillMark, [[A + T, markLevel, 0.0035], [A + T + SHELL.mark, markLevel, 0.0035]]);
  // The arrows are solid, so they hang on the part itself, in scene units, rather than inside a drawing scaled flat.
  const gasArrows = SHELL.arrows.map(() => { const arrow = solidArrow(kit, COLORS.push, body, SHELL.arrow * BODY_MM); arrow.userData.setDirection(new THREE.Vector3(0, -1, 0)); return arrow; });

  // The siphon tube and strainer.
  const siphon = part('siphon', 'Siphon tube and strainer', `The siphon tube, fitted in the cap, reaches down to a strainer ${DECLARED.strainer} mm above the bottom, drawn at ${sizeWords(BODY_MM)}. The gas presses on the water’s surface, and the water rises through the strainer and up the tube to the valve; the blue arrow grows with the flow, ${SHELL.flow[1]} mm for each liter a second. The water below the strainer stays behind.`, LAYOUT.body, system);
  const siphonDraw = scaled(siphon, BODY_MM), tubeX = SHELL.neck[0] + CAP.tube[0], tubeTop = H + SHELL.neck[1] + CAP.valve[2], strainerTop = DECLARED.strainer + SHELL.strainer[1];
  const tube = box(COLORS.brass, siphonDraw, tubeX - CAP.tube[1], tubeX + CAP.tube[1], strainerTop, tubeTop, 0.003);
  const boreGas = box(COLORS.air, siphonDraw, tubeX - CAP.bore, tubeX + CAP.bore, strainerTop, tubeTop, 0.0031), boreWater = box(COLORS.water, siphonDraw, tubeX - CAP.bore, tubeX + CAP.bore, strainerTop, tubeTop, 0.0032);
  const strainer = box(COLORS.strainer, siphonDraw, tubeX - SHELL.strainer[0], tubeX + SHELL.strainer[0], DECLARED.strainer, strainerTop, 0.003);
  const strainerMesh = segmentLines(7, COLORS.dark, siphonDraw);
  fillLine(strainerMesh, [...[-6, -2, 2, 6].flatMap(dx => [[tubeX + dx, DECLARED.strainer, 0.0035], [tubeX + dx, strainerTop, 0.0035]]), ...[1, 2, 3].flatMap(k => { const y = DECLARED.strainer + SHELL.strainer[1] * k / 4; return [[tubeX - SHELL.strainer[0], y, 0.0035], [tubeX + SHELL.strainer[0], y, 0.0035]]; })]);
  const flowArrow = solidArrow(kit, COLORS.flow, siphon, SHELL.flow[2] * BODY_MM);
  flowArrow.position.set(tubeX * BODY_MM, SHELL.flow[0] * BODY_MM, 0.012);
  flowArrow.userData.setDirection(new THREE.Vector3(0, 1, 0));

  // The hose and nozzle.
  const hose = part('hose', 'Hose and nozzle', `A hose ${IS940.hose[1]} mm long, the shortest IS 940 allows, drawn at ${sizeWords(BODY_MM)}, leading from the control valve to the nozzle. The model counts one opening of ${fixed(NOZZLE.bore * 1000, 2)} mm for the valve, the siphon tube, the hose and the nozzle together, its bore set so ${IS15683.share}% of ${KANEX.liters} L leaves in Kanex’s ${KANEX.discharge} s.`, LAYOUT.body, system);
  const hoseDraw = scaled(hose, BODY_MM), centerline = hosePath(64), halfWidth = SHELL.hose.width / 2;
  const hoseStrip = strip(64, COLORS.hose, hoseDraw, 0.002);
  fillStrip(hoseStrip, centerline.map(([x, y, dx, dy]) => [[x + halfWidth * dy, y - halfWidth * dx], [x - halfWidth * dy, y + halfWidth * dx]]));
  const [endX, endY] = centerline.at(-1), [nozzleLength, nozzleBack, nozzleFront] = SHELL.nozzle;
  const nozzle = shaped([[endX, endY - nozzleBack], [endX + nozzleLength, endY - nozzleFront], [endX + nozzleLength, endY + nozzleFront], [endX, endY + nozzleBack]], COLORS.brass, hoseDraw, 0.0025);

  // The cartridge close up, true size.
  const cartridge = part('cartridge', 'Gas cartridge, close up', `A carbon dioxide cartridge close up at ${sizeWords(CAP_MM)}, cut open: steel ${2 * CAP.shell[0]} mm across, filled to IS 4947’s filling ratio of ${IS4947.ratio} and as long as its size needs. Before it is pierced, liquid (blue) lies under its vapor (pale); from ${fixed(FULL_AT, 1)} °C liquid fills it. The seal sits ${IS4947.seal} mm down the neck, which screws into the holder. Pierced, the gas leaves through the holder into the space above the water.`, LAYOUT.cap, system);
  const cartDraw = scaled(cartridge, CAP_MM), wall = DECLARED.cartridge.wall, radius = DECLARED.cartridge.radius;
  const closeCartridges = CARTRIDGE_OPTIONS.map(({value}) => {
    const shape = cartridgeShape(value), straight = shape.straight * 1000, group = new THREE.Group();
    cartDraw.add(group);
    const outer = shaped(capsulePoints(0, -CAP.shell[1], CAP.shell[0], straight), COLORS.steel, group, 0);
    const inner = shaped(capsulePoints(0, -CAP.shell[1] - wall, radius, straight), COLORS.vapor, group, 0.002);
    return {grams: value, group, outer, inner, straight, bottom: -CAP.shell[1] - wall - shape.length * 1000, heights: capsuleHeights(radius, straight)};
  });
  const neck = box(COLORS.steel, cartDraw, -CAP.neck[0], CAP.neck[0], -CAP.neck[1], 0, 0.001);
  const liquid = strip(30, COLORS.liquid, cartDraw, 0.0025);
  const cavity = box(COLORS.air, cartDraw, -CAP.cavity, CAP.cavity, -IS4947.seal, 0, 0.003);
  const bore = box(COLORS.vapor, cartDraw, -CAP.bore, CAP.bore, -CAP.shell[1] - wall - 0.5, -IS4947.seal - CAP.seal, 0.003);
  const seal = box(COLORS.dark, cartDraw, -CAP.cavity, CAP.cavity, -IS4947.seal - CAP.seal, -IS4947.seal, 0.004);
  const sealHalves = [box(COLORS.dark, cartDraw, -CAP.cavity, -CAP.hole, -IS4947.seal - CAP.seal, -IS4947.seal, 0.004), box(COLORS.dark, cartDraw, CAP.hole, CAP.cavity, -IS4947.seal - CAP.seal, -IS4947.seal, 0.004)];
  const holder = [box(COLORS.brass, cartDraw, CAP.holder[0], CAP.holder[1], CAP.holder[2], CAP.holder[3], 0.004), box(COLORS.brass, cartDraw, -CAP.holder[1], -CAP.holder[0], CAP.holder[2], CAP.holder[3], 0.004)];

  // The squeeze grip and piercing pin, true size.
  const grip = part('grip', 'Squeeze grip and piercing pin, close up', `The squeeze grip and the cap close up at ${sizeWords(CAP_MM)}, their arrangement a schematic. Squeezing the lever (orange arrow) pushes the plunger down its guide against a return spring, and the pin at its end travels IS 940’s ${IS940.stroke} mm stroke through the cartridge’s seal. The grip is held until the gauge reads zero.`, LAYOUT.cap, system);
  const gripDraw = scaled(grip, CAP_MM);
  const capBody = box(COLORS.capBody, gripDraw, CAP.body[0], CAP.body[1], CAP.body[2], CAP.body[3], -0.001);
  const rod = flat(COLORS.steel, gripDraw, 0.006);
  const cone = shaped([[-CAP.rod[0], CAP.rod[1]], [0, 0], [CAP.rod[0], CAP.rod[1]]], COLORS.dark, gripDraw, 0.006);
  const collar = flat(COLORS.dark, gripDraw, 0.0065);
  const spring = lineObject(2 * CAP.spring[1] + 2, COLORS.spring, gripDraw);
  const guide = [box(COLORS.aluminum, gripDraw, CAP.guide[0], -CAP.rod[0] - 1, CAP.guide[2], CAP.guide[3], 0.005), box(COLORS.aluminum, gripDraw, CAP.rod[0] + 1, CAP.guide[1], CAP.guide[2], CAP.guide[3], 0.005)];
  const bracket = box(COLORS.aluminum, gripDraw, CAP.bracket[0], CAP.bracket[1], CAP.bracket[2], CAP.bracket[3], 0.005);
  const lever = flat(COLORS.lever, gripDraw, 0.007);
  const pivotPin = new THREE.Mesh(new THREE.CircleGeometry(CAP.pin, 16), unlit(COLORS.dark));
  pivotPin.position.set(CAP.pivot[0], CAP.pivot[1], 0.008);
  gripDraw.add(pivotPin);
  const squeezeArrow = solidArrow(kit, COLORS.effort, grip, CAP.squeeze[2] * CAP_MM);
  squeezeArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));

  // The control valve, true size.
  const valve = part('valve', 'Control valve, close up', `The control valve close up at ${sizeWords(CAP_MM)}, a schematic: the siphon tube rises into it, and its disc lifts off the seat when the valve opens, ${IS15683.wait} s after the cartridge is pierced, as IS 15683’s test waits. The blue arrow grows with the flow out to the hose, ${CAP.flow[1]} mm for each liter a second.`, LAYOUT.cap, system);
  const valveDraw = scaled(valve, CAP_MM), [tx, th, tb] = CAP.tube;
  const valveTube = box(COLORS.brass, valveDraw, tx - th, tx + th, tb, CAP.valve[2], 0.004);
  const valveBody = box(COLORS.aluminum, valveDraw, CAP.valve[0], CAP.valve[1], CAP.valve[2], CAP.valve[3], 0.004);
  const valveBore = box(COLORS.air, valveDraw, tx - CAP.bore, tx + CAP.bore, tb, CAP.seat[0], 0.0045);
  const chamber = box(COLORS.air, valveDraw, tx - CAP.bore, tx + CAP.bore, CAP.seat[1], CAP.outlet[1], 0.0045);
  const outlet = box(COLORS.air, valveDraw, tx + CAP.bore, CAP.valve[1], CAP.outlet[0], CAP.outlet[1], 0.0045);
  const seats = [box(COLORS.dark, valveDraw, tx - th, tx - CAP.bore, CAP.seat[0], CAP.seat[1], 0.005), box(COLORS.dark, valveDraw, tx + CAP.bore, tx + th, CAP.seat[0], CAP.seat[1], 0.005)];
  const disc = flat(COLORS.dark, valveDraw, 0.0055), stem = flat(COLORS.dark, valveDraw, 0.0055);
  const outletArrow = solidArrow(kit, COLORS.flow, valve, CAP.flow[2] * CAP_MM);
  outletArrow.position.set(CAP.flow[0] * CAP_MM, (CAP.outlet[0] + CAP.outlet[1]) / 2 * CAP_MM, 0.012);
  outletArrow.userData.setDirection(new THREE.Vector3(1, 0, 0));

  // The test gauge, not to scale.
  const gauge = part('gauge', 'Test gauge', `A gauge fitted to the cap for the test, reading the pressure above 1 atm from 0 to ${DECLARED.dial} bar; cartridge extinguishers carry none. IS 15683 asks a gauge to read to ${IS15683.gauge[0]} to ${IS15683.gauge[1]}% of the service pressure and at least ${IS15683.gauge[2]}% of the maximum service pressure: for Kanex’s ${KANEX.service} and ${KANEX.maxService} bar, ${fixed(KANEX.service * IS15683.gauge[0] / 100, 0)} to ${fixed(KANEX.service * IS15683.gauge[1] / 100, 0)} bar and at least ${fixed(KANEX.maxService * IS15683.gauge[2] / 100, 1)} bar. The red tick marks IS 940’s ${IS940.closed} MN/m², ${fixed(IS940.closed * 10, 0)} bar, with the nozzle closed. Not to scale.`, LAYOUT.gauge, system);
  const face = new THREE.Mesh(new THREE.CircleGeometry(DIAL.radius, 64), unlit(COLORS.dial));
  gauge.add(face);
  const rim = lineObject(65, COLORS.dark, gauge);
  fillLine(rim, circlePoints(DIAL.radius, 65, 0.001));
  const tickCount = DECLARED.dial / DIAL.minor + 1, dialTicks = segmentLines(tickCount, COLORS.dark, gauge);
  fillLine(dialTicks, Array.from({length: tickCount}, (_, i) => { const value = i * DIAL.minor, a = needleAngle(value), inner = (value % DIAL.major === 0 ? DIAL.ticks[2] : DIAL.ticks[0]) * DIAL.radius, outer = DIAL.ticks[1] * DIAL.radius; return [[inner * Math.cos(a), inner * Math.sin(a), 0.002], [outer * Math.cos(a), outer * Math.sin(a), 0.002]]; }).flat());
  const limitTick = segmentLines(1, COLORS.limit, gauge), limitAngle = needleAngle(IS940.closed * 10);
  fillLine(limitTick, [[0.6 * DIAL.radius * Math.cos(limitAngle), 0.6 * DIAL.radius * Math.sin(limitAngle), 0.0025], [DIAL.radius * Math.cos(limitAngle), DIAL.radius * Math.sin(limitAngle), 0.0025]]);
  const needle = flat(COLORS.dark, gauge, 0.003);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(DIAL.hub, 16), unlit(COLORS.dark));
  hub.position.z = 0.004;
  gauge.add(hub);

  // The jet, a fiftieth of true size.
  const jet = part('jet', 'Jet, to scale', `The jet at ${sizeWords(JET_M / 1000)}, from a nozzle held ${IS15683.height} m above the floor, the ticks a meter apart: faint where it landed as the valve opened, blue where it lands now. The gold tick marks IS 15683’s range, measured with the nozzle level at half the effective discharge time. The short bar marks the nozzle and is not to scale.`, LAYOUT.jet, system);
  const jetDraw = scaled(jet, JET_M);
  const floorLine = segmentLines(1, COLORS.floor, jetDraw);
  fillLine(floorLine, [[JETVIEW.floor[0], 0, 0], [JETVIEW.floor[1], 0, 0]]);
  const meterTicks = segmentLines(JETVIEW.floor[1], COLORS.floor, jetDraw);
  fillLine(meterTicks, Array.from({length: JETVIEW.floor[1]}, (_, i) => [[i + 1, 0, 0], [i + 1, -JETVIEW.tick, 0]]).flat());
  const post = segmentLines(1, COLORS.faint, jetDraw);
  fillLine(post, [[0, 0, 0], [0, IS15683.height, 0]]);
  const nozzleBar = flat(COLORS.dark, jetDraw, 0.002);
  const startLine = lineObject(DECLARED.path, COLORS.flowFaint, jetDraw), nowLine = lineObject(DECLARED.path, COLORS.flow, jetDraw);
  const rangeTick = segmentLines(1, COLORS.gold, jetDraw), landingTick = segmentLines(1, COLORS.flow, jetDraw);

  // The run.
  const chart = part('chart', 'Through the run', `The gauge (blue) from 0 at the bottom to ${DECLARED.dial} bar at the top, and the water left (gray) from none to all of it, from the squeeze until the gauge reads zero: faint for the whole run, dark as far as the clock has run. The gold bar marks the effective discharge time, from the valve’s opening until ${IS15683.share}% of the water is out, and the red line ${fixed(IS940.closed * 10, 0)} bar. A tick below the chart marks every ${CHART.tickEvery} s.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chart);
  fillLine(chartFrame, [[CHART.x, CHART.y, CHART.z], [CHART.x + CHART.w, CHART.y, CHART.z], [CHART.x + CHART.w, CHART.y + CHART.h, CHART.z], [CHART.x, CHART.y + CHART.h, CHART.z], [CHART.x, CHART.y, CHART.z]]);
  const limitLine = segmentLines(1, COLORS.limit, chart);
  fillLine(limitLine, [[CHART.x, chartY(IS940.closed * 10 / DECLARED.dial), CHART.z], [CHART.x + CHART.w, chartY(IS940.closed * 10 / DECLARED.dial), CHART.z]]);
  const effectiveBar = flat(COLORS.gold, chart, CHART.z);
  const gaugeGuide = lineObject(DECLARED.samples, COLORS.flowFaint, chart), shareGuide = lineObject(DECLARED.samples, COLORS.faint, chart);
  const gaugeCurve = lineObject(DECLARED.samples + 1, COLORS.flow, chart), shareCurve = lineObject(DECLARED.samples + 1, COLORS.shareDark, chart);
  const chartTicks = segmentLines(CHART.ticks, COLORS.chart, chart), cursor = segmentLines(2, COLORS.chart, chart);

  // Leaders from the body to the close up, from the nozzle to the jet, and from the gauge to the cap.
  const leaders = segmentLines(4, COLORS.faint, system);
  const inBody = ([x, y]) => [LAYOUT.body[0] + x * BODY_MM, LAYOUT.body[1] + y * BODY_MM, 0], inCap = ([x, y]) => [LAYOUT.cap[0] + x * CAP_MM, LAYOUT.cap[1] + y * CAP_MM, 0];
  const corner = [LAYOUT.jet[0] - 0.15, inBody([endX, endY])[1], 0];
  fillLine(leaders, [inBody([SHELL.cap[1], H + SHELL.cap[3]]), inCap([CAP.bracket[0] - 5, (CAP.guide[2] + CAP.guide[3]) / 2]), inBody([endX + nozzleLength, endY]), corner, corner, [corner[0], LAYOUT.jet[1] + IS15683.height * JET_M, 0], [LAYOUT.gauge[0], LAYOUT.gauge[1] - DIAL.radius, 0], inBody([0, H + SHELL.cap[3]])]);

  const d = EXTINGUISHER_DEFAULTS, D = EXTINGUISHER_DOMAINS;
  control('cartridge', 'Cartridge', ...D.cartridge, d.cartridge, 'g', `The carbon dioxide in the cartridge: IS 4947’s sizes up to the ${IS940.cartridge} g IS 940 allows.`, CARTRIDGE_OPTIONS);
  control('temperature', 'Temperature', ...D.temperature, d.temperature, '°C', 'The water, the gas and the cartridge, all at one temperature, across IS 15683’s operating range.');
  control('water', 'Water', ...D.water, d.water, 'L', `How much water the body holds; IS 940 fills it to ${fixed(IS940.liters, 1)} L, give or take ${fixed(IS940.tolerance, 1)} L.`);
  control('aim', 'Aim', ...D.aim, d.aim, '°', 'How far above level the nozzle points; IS 15683’s range test holds it level.');

  const airColor = new THREE.Color(COLORS.air), gasColor = new THREE.Color(COLORS.gas), vaporColor = new THREE.Color(COLORS.vapor), waterColor = new THREE.Color(COLORS.water), tint = new THREE.Color();
  const result = finish(v => {
    const plan = extinguisherPlan(v), now = extinguisherAt(plan, clock), stage = now.stage, bar = now.gauge / BAR;
    const squeezing = stage === 'pierced' || stage === 'water' || stage === 'gas', flowing = stage === 'water', valveOpen = clock >= plan.open;
    tint.copy(airColor).lerp(gasColor, Math.max(0, Math.min(1, bar / DECLARED.dial)));

    // The body: the water to its level, the space above it and the gas pressing on the water.
    const level = now.level * 1000;
    fillStrip(water, across(BODY_HEIGHTS, 0, level, bodyRadius));
    fillStrip(gas, across(BODY_HEIGHTS, level, H, bodyRadius));
    gas.material.color.copy(tint);
    for (const group of bodyCartridges) group.visible = group.userData.grams === plan.grams;
    const push = stage === 'pierced' || flowing ? bar * SHELL.perBar : 0;
    const room = Math.max(0, Math.min(bodyRadius(level), bodyRadius(level + push)) - 2.5 * SHELL.arrow - SHELL.clear);
    gasArrows.forEach((arrow, i) => { arrow.userData.setLength(push * BODY_MM); arrow.position.set(Math.sign(SHELL.arrows[i]) * Math.min(Math.abs(SHELL.arrows[i]), room) * BODY_MM, (level + push) * BODY_MM, 0.012); });

    // The siphon tube: water up to the level before the squeeze, up to the valve once the gas presses, gas once the water is out.
    boreWater.visible = !(stage === 'gas' || stage === 'done');
    rect(boreWater, tubeX - CAP.bore, tubeX + CAP.bore, strainerTop, stage === 'ready' ? Math.max(strainerTop, level) : tubeTop);
    boreGas.material.color.copy(stage === 'ready' ? airColor : tint);
    flowArrow.userData.setLength(flowing ? now.flow * 1000 * SHELL.flow[1] * BODY_MM : 0);

    // The grip: the pin through the seal while it is squeezed, the lever resting on the rod.
    const tip = tipAt(squeezing), rodTop = tip + CAP.rod[2], angle = leverAngle(rodTop), [px, py] = CAP.pivot, middle = (CAP.lever - CAP.tail) / 2;
    rect(rod, -CAP.rod[0], CAP.rod[0], tip + CAP.rod[1], rodTop);
    cone.position.y = tip;
    rect(collar, -CAP.collar[0], CAP.collar[0], tip + CAP.collar[1], tip + CAP.collar[1] + CAP.collar[2]);
    fillLine(spring, springPoints(CAP.holder[3], tip + CAP.collar[1]).map(([x, y]) => [x, y, 0.0062]));
    for (const [mesh, dx, dy] of [[lever, 0, 0], [bodyLever, SHELL.neck[0], H + SHELL.neck[1]]]) {
      mesh.position.set(dx + px + middle * Math.cos(angle), dy + py + middle * Math.sin(angle), mesh.position.z);
      mesh.scale.set(CAP.lever + CAP.tail, CAP.thickness, 1);
      mesh.rotation.z = angle;
    }
    const press = CAP.lever - 2 * CAP.squeeze[1];
    squeezeArrow.userData.setLength(squeezing ? CAP.squeeze[0] * CAP_MM : 0);
    squeezeArrow.position.set((px + press * Math.cos(angle)) * CAP_MM, (py + press * Math.sin(angle) + CAP.thickness / 2 / Math.cos(angle) + CAP.squeeze[1] + CAP.squeeze[0]) * CAP_MM, 0.012);

    // The cartridge: liquid under vapor before it is pierced, gas at the space's pressure after.
    const cart = plan.cartridge, shown = closeCartridges.find(item => item.grams === plan.grams);
    for (const item of closeCartridges) item.group.visible = item === shown;
    shown.inner.material.color.copy(stage === 'ready' ? vaporColor : tint);
    bore.material.color.copy(stage === 'ready' ? vaporColor : tint);
    fillStrip(liquid, stage === 'ready' ? across(shown.heights, 0, cart.level * 1000, h => capsuleRadius(radius, shown.straight, h), shown.bottom) : []);
    seal.visible = stage === 'ready';
    for (const half of sealHalves) half.visible = stage !== 'ready';

    // The valve: its disc off the seat once open, water or gas through it.
    const lift = valveOpen ? CAP.lift : 0, inTube = stage === 'pierced' || flowing ? waterColor : stage === 'gas' ? tint : airColor, through = flowing ? waterColor : stage === 'gas' ? tint : airColor;
    rect(disc, tx - CAP.disc[0], tx + CAP.disc[0], CAP.seat[1] + lift, CAP.seat[1] + lift + CAP.disc[1]);
    rect(stem, tx - CAP.stem, tx + CAP.stem, CAP.seat[1] + lift + CAP.disc[1], CAP.valve[3]);
    valveBore.material.color.copy(inTube);
    chamber.material.color.copy(through);
    outlet.material.color.copy(through);
    outletArrow.userData.setLength(flowing ? now.flow * 1000 * CAP.flow[1] * CAP_MM : 0);

    // The gauge.
    const turn = needleAngle(bar), reach = DIAL.needle * DIAL.radius;
    needle.position.set(Math.cos(turn) * reach / 2, Math.sin(turn) * reach / 2, 0.003);
    needle.scale.set(reach, DIAL.width, 1);
    needle.rotation.z = turn;

    // The jet.
    const aim = plan.aim * Math.PI / 180, [barLength, barWidth] = JETVIEW.nozzle;
    nozzleBar.position.set(-Math.cos(aim) * barLength / 2, IS15683.height - Math.sin(aim) * barLength / 2, 0.002);
    nozzleBar.scale.set(barLength, barWidth, 1);
    nozzleBar.rotation.z = aim;
    fillLine(startLine, plan.start.path.map(([x, y]) => [x, y, 0.001]));
    fillLine(nowLine, now.path ? now.path.path.map(([x, y]) => [x, y, 0.003]) : []);
    fillLine(rangeTick, plan.range === null ? [] : [[plan.range, 0, 0.002], [plan.range, JETVIEW.range, 0.002]]);
    fillLine(landingTick, now.path ? [[now.reach, 0, 0.004], [now.reach, JETVIEW.landing, 0.004]] : []);

    // The chart.
    const ofDial = pascals => pascals / BAR / DECLARED.dial, passed = plan.chart.filter(sample => sample.t < now.t);
    fillLine(gaugeGuide, plan.chart.map(sample => [chartX(plan, sample.t), chartY(ofDial(sample.gauge)), CHART.z]));
    fillLine(shareGuide, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.share), CHART.z]));
    fillLine(gaugeCurve, clock > 0 ? [...passed.map(sample => [chartX(plan, sample.t), chartY(ofDial(sample.gauge)), CHART.z]), [chartX(plan, now.t), chartY(ofDial(now.gauge)), CHART.z]] : []);
    fillLine(shareCurve, clock > 0 ? [...passed.map(sample => [chartX(plan, sample.t), chartY(sample.share), CHART.z]), [chartX(plan, now.t), chartY(now.share), CHART.z]] : []);
    effectiveBar.visible = plan.effectiveAt !== null;
    rect(effectiveBar, chartX(plan, plan.open), chartX(plan, plan.effectiveAt ?? plan.open), CHART.y - CHART.gap - CHART.bar, CHART.y - CHART.gap);
    const ticks = [];
    for (let k = 1; k * CHART.tickEvery < plan.duration - 1e-9; k++) ticks.push([chartX(plan, k * CHART.tickEvery), CHART.y, CHART.z], [chartX(plan, k * CHART.tickEvery), CHART.y - CHART.tick, CHART.z]);
    fillLine(chartTicks, ticks);
    const cx = chartX(plan, now.t), cy = chartY(ofDial(now.gauge));
    fillLine(cursor, [[cx - CHART.cursor, cy, CHART.z], [cx + CHART.cursor, cy, CHART.z], [cx, cy - CHART.cursor, CHART.z], [cx, cy + CHART.cursor, CHART.z]]);

    // Readings.
    const bars = pascals => `${fixed(pascals / BAR, 1)} bar`, percent = share => `${fixed(100 * share, 0)}%`, p = now.partials, full = saturationAt(FULL_AT);
    const contents = cart.full ? 'full of liquid' : `${percent(cart.share)} liquid at ${bars(cart.pressure)} absolute`;
    const status = stage === 'ready' ? `Ready · a ${plan.grams} g cartridge ${contents}, over ${fixed(plan.liters, 1)} L of water; press Play to squeeze the grip`
      : stage === 'pierced' ? `Pierced · the gas fills the space at ${bars(now.gauge)}; the valve opens at ${fixed(plan.open, 0)} s`
      : flowing ? `Discharging · ${fixed(now.left * 1000, 2)} L left at ${bars(now.gauge)}, the jet landing ${fixed(now.reach, 1)} m away`
      : stage === 'gas' ? `Gas escaping · the water is out and the gauge reads ${bars(now.gauge)}`
      : `Empty · the gauge read zero ${fixed(plan.duration, 1)} s after the squeeze, ${IS15683.share}% of the water out at ${fixed(plan.effectiveAt, 1)} s`;
    const gaugeText = stage === 'ready'
      ? `Nothing above 1 atm yet: the snifter valve keeps the space at the room’s pressure, ${fixed(p.air / BAR, 3)} bar of air and ${fixed(p.vapor / BAR, 3)} bar of water vapor. The gauge is one fitted for the test: cartridge extinguishers carry none.`
      : `By Dalton’s law the gases’ pressures add: air ${fixed(p.air / BAR, 2)} bar, water vapor ${fixed(p.vapor / BAR, 3)} bar and carbon dioxide ${fixed(p.co2 / BAR, 2)} bar, which the van der Waals equation gives for ${fixed(now.co2Moles * CO2.molar, 1)} g in ${fixed(now.volume * 1000, 2)} L, where an ideal gas would give ${fixed(p.ideal / BAR, 2)} bar. Less 1 atm outside, the gauge reads ${bars(now.gauge)}. The gauge is one fitted for the test: cartridge extinguishers carry none.`;
    const jetText = flowing
      ? `Bernoulli: at ${bars(now.gauge)} water of ${fixed(plan.run.density, 1)} kg/m³ leaves at √(2Δp/ρ) = ${fixed(now.speed, 1)} m/s. Task Force Tips’ smooth bore rule gives ${fixed(DISCHARGE, 3)} of the flow that speed would carry through the opening, so the ${fixed(NOZZLE.bore * 1000, 2)} mm opening passes ${fixed(now.flow * 1000, 2)} L/s. Not from a source: one opening for the valve, the siphon tube, the hose and the nozzle, its bore set so ${IS15683.share}% of ${KANEX.liters} L leaves in Kanex’s ${KANEX.discharge} s.`
      : stage === 'gas' ? `The water is out, and the gas leaves through the same opening at ${fixed(now.gasFlow * 1000, 1)} g/s, ${now.choked ? 'choked: it moves at the speed of sound where the way is narrowest, so the pressure outside no longer matters' : 'no longer choked'}.`
      : stage === 'done' ? 'The gauge reads zero, and nothing more comes out.'
      : `No flow until the valve opens, ${fixed(plan.open, 0)} s after the cartridge is pierced.`;
    const reachText = `Drops ${fixed(DROP * 1000, 2)} mm across, a size set so the level jet at half the effective discharge time lands Kanex’s ${KANEX.throw} m away, lose a factor e of their speed to drag every ${fixed(dragLength(DROP, plan.celsius), 2)} m.${flowing ? ` Aimed ${fixed(plan.aim, 0)}° up from ${IS15683.height} m, they land ${fixed(now.reach, 1)} m away, where with no air they would reach ${fixed(vacuumReach(now.speed, plan.aim), 1)} m.` : ''} IS 15683 holds the nozzle level ${IS15683.height} m up and takes the range at half the effective discharge time: ${plan.range === null ? 'never reached here' : `${fixed(plan.range, 1)} m here`}.`;
    const cartridgeText = `${plan.grams} g at IS 4947’s filling ratio of ${IS4947.ratio} needs ${fixed(cart.volume * 1e6, 1)} mL inside, a fill of ${fixed(cart.fill, 0)} kg/m³. ${cart.full
      ? `The saturation table’s liquid is that dense at ${fixed(FULL_AT, 1)} °C and ${fixed(full.pressure / BAR, 1)} bar absolute; warmer, liquid fills the cartridge and its pressure climbs past the table. IS 4947 tests each cartridge to ${IS4947.test} kgf/cm², ${fixed(IS4947.test * KILOGRAM_FORCE * 1e4 / BAR, 0)} bar.`
      : `At ${fixed(plan.celsius, 0)} °C the saturation table gives liquid of ${fixed(cart.liquid, 0)} kg/m³ under vapor of ${fixed(cart.vapor, 1)} kg/m³ at ${fixed(cart.pressure / BAR, 1)} bar absolute, so liquid fills ${percent(cart.share)} of it; from ${fixed(FULL_AT, 1)} °C it would fill it all.`} Pierced, the gas spreads through ${fixed(plan.run.gasVolume(plan.run.water) * 1000, 2)} L at ${fixed(plan.co2Density, 1)} kg/m³, ${plan.saturated === null ? 'above its critical point, where no liquid forms' : `short of the ${fixed(plan.saturated, 1)} kg/m³ at which liquid would form`}: all of it gas.`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Gauge', bars(now.gauge), gaugeText),
        r('Water left', `${fixed(now.left * 1000, 2)} L`, `${fixed(100 * now.share, 1)}% of the ${fixed(plan.liters, 1)} L, standing ${fixed(level, 0)} mm deep in a body that holds ${fixed(BODY.volume * 1000, 2)} L.${flowing ? ` It leaves at ${fixed(now.flow * 1000, 2)} L/s.` : ''} The last ${fixed(RESIDUAL * 1000, 2)} L lies below the strainer, ${DECLARED.strainer} mm above the bottom, and stays: ${fixed(100 * plan.retained, 1)}% of the water, where IS 15683 lets a trial keep ${IS15683.retained}%.`),
        r('Jet', flowing ? `${fixed(now.speed, 1)} m/s` : stage === 'gas' ? 'gas only' : 'none', jetText),
        r('Reach', flowing ? `${fixed(now.reach, 1)} m` : 'none', reachText),
        r('Discharge time', plan.effective === null ? 'never' : `${fixed(plan.effective, 1)} s`, `IS 15683’s effective discharge time, from the valve’s opening until ${IS15683.share}% of the water is out. Kanex gives ${KANEX.discharge} s, and IS 940 asks for ${IS940.share}% within ${IS940.within} s. The water reaches the strainer ${fixed(plan.outAt - plan.open, 1)} s after the valve opens; then the gas escapes for ${fixed(plan.gasTime, 1)} s, ${plan.chokedFor > 0 ? `choked for the first ${fixed(plan.chokedFor, 1)} s` : 'never choked'}, until the gauge reads zero ${fixed(plan.duration, 1)} s after the squeeze.`),
        r('Cartridge', stage === 'ready' ? (cart.full ? 'full of liquid' : `${percent(cart.share)} liquid`) : 'pierced, empty', cartridgeText),
        r('Service pressure', bars(plan.service), `With the nozzle closed the gas over ${fixed(plan.liters, 1)} L settles at ${bars(plan.serviceAt.normal)} at ${IS15683.service[0]} °C and ${bars(plan.serviceAt.hot)} at ${IS15683.maxService[0]} °C, IS 15683’s service and maximum service temperatures; Kanex gives ${KANEX.service} and ${KANEX.maxService} bar. IS 940 allows no more than ${IS940.closed} MN/m², ${fixed(IS940.closed * 10, 0)} bar, at ${IS940.normal[0]} °C${plan.serviceAt.normal > IS940.closed * 1e6 ? `, which ${fixed(plan.liters, 1)} L exceeds` : ''}, and tests the body at ${fixed(IS940.test, 1)} MN/m²; Kanex tests at ${KANEX.test} bar.`),
        r('Clock', `${DECLARED.fast} times faster`, `The clock runs ${DECLARED.fast} times faster than the discharge: the ${fixed(plan.duration, 1)} s from squeeze to empty take ${fixed(plan.duration / DECLARED.fast, 1)} s. The body is drawn at ${sizeWords(BODY_MM)}, the cartridge, grip and valve at ${sizeWords(CAP_MM)} and the jet at ${sizeWords(JET_M / 1000)}; the gauge and the chart are not to scale.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * DECLARED.fast); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the cartridge before piercing', part: 'cartridge', view: 'front', replay: false, run() { return inspect(0); }},
    {label: 'Inspect: the pin through the seal', part: 'grip', view: 'front', replay: false, run() { return inspect(IS15683.wait / 2); }},
    {label: 'Inspect: the jet at half time', part: 'jet', view: 'front', replay: false, run() { const state = result.getState(); return inspect(state.halfAt ?? state.open); }},
    {label: 'Inspect: the last of the gas', part: 'gauge', view: 'front', replay: false, run() { const state = result.getState(); return inspect(state.outAt + state.gasTime / 2); }},
  ];
  result.playback = {
    label: 'Squeeze',
    description: `Squeeze the grip, wait ${IS15683.wait} s as IS 15683’s test does, and open the valve until the gauge reads zero. The clock runs ${DECLARED.fast} times faster than the discharge.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the run', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, body, bodyDraw, shell, skirt, gas, water, innerWall, ring, capBox, bodyCartridges, bodyBracket, bodyLever, fillMark, gasArrows, siphon, siphonDraw, tube, boreGas, boreWater, strainer, strainerMesh, flowArrow, hose, hoseDraw, hoseStrip, nozzle, cartridge, cartDraw, closeCartridges, neck, liquid, cavity, bore, seal, sealHalves, holder, grip, gripDraw, capBody, rod, cone, collar, spring, guide, bracket, lever, pivotPin, squeezeArrow, valve, valveDraw, valveTube, valveBody, valveBore, chamber, outlet, seats, disc, stem, outletArrow, gauge, face, rim, dialTicks, limitTick, needle, hub, jet, jetDraw, floorLine, meterTicks, post, nozzleBar, startLine, nowLine, rangeTick, landingTick, chart, chartFrame, limitLine, effectiveBar, gaugeGuide, shareGuide, gaugeCurve, shareCurve, chartTicks, cursor, leaders};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, lineObject, surface, textLabel} from './scene-kit.js';
import {padPlan, padAt, gatePoint, tiltOf, wiper, adcCode, toReport, contactClosed, STICK, SPRING, FRICTION, CLOCKS, BOUNCE, GAME, HISTOGRAM, RELEASE_OPTIONS, GATE_OPTIONS, BITS_OPTIONS, POLL_OPTIONS, PAD_DEFAULTS, PAD_DOMAINS} from './games-controller-physics.js';

// ---------------------------------------------------------------------------
// Games controller: a gamepad lying on a desk with its top shell cut away, its
// thumbstick module and one button open to view, a cable to a console, the
// console's monitor, and five charts behind them.
//
// Scale: one millimeter is 0.02 scene units for the controller (164 mm across),
// its thumbstick module (a lever 17 mm to the cap, tilting 23° each way in a
// gimbal, its gate 9 mm above the pivot) and its button. The console and the
// monitor, a 24-inch screen, are drawn at a fifth of their size so the
// thumbstick can still be framed; their part text says so. The charts are not
// to any scale.
//
// Time: the run plays fifty times slower than real time, from 20 ms before the
// stick is let go to 300 ms after. Everything drawn follows the physics: the
// lever, both yokes and both potentiometer wipers at their true angles, the
// return spring pressed by the lever's foot, the button's cap, dome and carbon
// pill, and pads that light while the contacts touch, a light on the board
// while the firmware calls the button pressed, a light on the console at the
// start of each frame, and the game on the monitor as the frame it is showing.
//
// Charts: the stick over time (true tilt in blue, the reports the console
// receives in red, the game's sample at each frame in ink, the dead zone as two
// clay lines); the stick map of the reports (the gate's outline in gold, the
// clamp circle, the dead zone circle, the run's trail); the ADC close up near
// where the stick comes to rest; the press close up (contacts, scans, the
// firmware's verdict, polls and the console's events); and where the time goes
// (this press, the average over every timing, and the spread).
// ---------------------------------------------------------------------------

const MM = 0.02;
const SLOW = 50;
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
export const SMALL = 0.2;
export const CONTROLLER = Object.freeze({x: -25, z: 40, base: 12, top: 32, pcb: 14});
export const STICK_AT = Object.freeze({x: -63, y: 22, z: 32});
export const MODULE = Object.freeze({shaft: 2, gate: 9, cap: 17, capRadius: 10, capThickness: 4, ball: 2.5, foot: 2.5, springBottom: -6.5, springTop: -3.6, yokeA: 6, yokeB: 7.5, slot: 2.3, potOffset: 9.5, track: 3});
export const GATE_RADIUS = MODULE.gate * Math.tan(STICK.travel) + MODULE.shaft / Math.cos(STICK.travel);
export const TRACK_ARC = 2 * STICK.travel / STICK.span;
export const BUTTON_AT = Object.freeze({x: 15, z: 32, capTop: 35, travel: 2, radius: 5, height: 6, open: 1.5, bounceGap: 0.25, reach: 0.003});
export const CONSOLE_AT = Object.freeze({x: 110, z: 20, size: [275, 60, 215]});
export const MONITOR_AT = Object.freeze({x: 110, z: -30, bottom: 26, display: [531, 299], meter: 500, start: [-40, -10]});
export const CHARTS = Object.freeze({
  z: -70,
  timeline: Object.freeze({x: -146, y: 179, w: 186, h: 60, v0: -1, v1: 1.5}),
  map: Object.freeze({x: 60, y: 179, w: 60, h: 60, range: 1.5}),
  adc: Object.freeze({x: -154, y: 88, w: 64, h: 70, half: DEG}),
  bounce: Object.freeze({x: -75, y: 88, w: 120, h: 70, t0: -0.001, t1: 0.014}),
  latency: Object.freeze({x: 60, y: 88, w: 80, h: 70, t1: 0.16, scale: 250}),
});
export const COLORS = Object.freeze({stick: 0x2f6690, report: 0xc14f39, gate: 0xe3b45e, zone: 0xce825f, axis: 0x374736, faint: 0x9aa39a, lit: 0x5ed17a, led: 0xff3b2f, dark: 0x3a2a28, frameLit: 0xffd35a, display: 0x1d2a33, grid: 0x3c5664});
export const SHARE_COLORS = Object.freeze([0xe3b45e, 0xc14f39, 0x2f6690, 0x91aa7e, 0xce825f]);

/** The lever's direction for yoke angles: x to the right, up on the stick away from the player. */
export const leverDirection = ([x, y]) => new THREE.Vector3(Math.tan(x), 1, -Math.tan(y)).normalize();

/** The controller's outline seen from above, in millimeters, x right and y away from the player. */
export function controllerOutline() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 40);
  shape.lineTo(52, 40);
  shape.quadraticCurveTo(80, 40, 80, 15);
  shape.lineTo(82, -30);
  shape.quadraticCurveTo(82, -56, 58, -52);
  shape.quadraticCurveTo(40, -48, 34, -22);
  shape.lineTo(-34, -22);
  shape.quadraticCurveTo(-40, -48, -58, -52);
  shape.quadraticCurveTo(-82, -56, -82, -30);
  shape.lineTo(-80, 15);
  shape.quadraticCurveTo(-80, 40, -52, 40);
  shape.closePath();
  return shape;
}

const flat = (shape, depth) => {
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 24});
  geometry.rotateX(-Math.PI / 2);
  geometry.scale(MM, MM, MM);
  return geometry;
};
const own = (mesh, color) => {
  mesh.material = mesh.material.clone();
  if (color !== undefined) mesh.material.color.set(color);
  return mesh;
};

export function createGamesControllerModel() {
  const kit = houseModel('Games controller'), {root, part, control, finish, covers} = kit;
  const mm = value => value * MM, at = (x, y, z) => [mm(x), mm(y), mm(z)];
  const system = part('system', 'Games controller, console and screen', 'A gamepad on a desk, its top shell cut away, wired to a console and its monitor. Let go of the thumbstick and press the button to follow both from the thumb to the screen.', [0, 0, 0]);

  // The controller's shell: the bottom half, and the top half as a cover with holes for the stick and the button.
  const body = part('body', 'Controller shell', 'The gamepad’s plastic shell, 164 mm across. The top half is cut away to show the thumbstick module, the button and the circuit board.', [0, 0, 0], system);
  const bottomShell = surface(kit, flat(controllerOutline(), CONTROLLER.base), 'ink', body);
  bottomShell.position.set(mm(CONTROLLER.x), 0, mm(CONTROLLER.z));
  const topOutline = controllerOutline();
  for (const [x, radius] of [[STICK_AT.x - CONTROLLER.x, 11], [BUTTON_AT.x - CONTROLLER.x, 6.5]]) {
    const hole = new THREE.Path();
    hole.absarc(x, CONTROLLER.z - STICK_AT.z, radius, 0, Math.PI * 2, true);
    topOutline.holes.push(hole);
  }
  const topShell = surface(kit, flat(topOutline, CONTROLLER.top - CONTROLLER.base), 0x55605a, body);
  topShell.position.set(mm(CONTROLLER.x), mm(CONTROLLER.base), mm(CONTROLLER.z));
  covers.push(topShell);

  // The thumbstick module, built about its pivot.
  const joystick = part('joystick', 'Thumbstick', 'The stick’s lever pivots on a ball in a gimbal: two slotted yokes at right angles, each turned only by tilt across its slot. A spring under the lever’s foot centers it, friction in the gimbal fights the spring, and the gate stops the lever at 23°. Drawn at true size.', at(STICK_AT.x, STICK_AT.y, STICK_AT.z), system);
  kit.box([mm(18), mm(1.5), mm(18)], at(0, MODULE.springBottom - 0.75, 0), 'metal', joystick);
  for (const [x, z] of [[-8.25, -8.25], [8.25, -8.25], [-8.25, 8.25], [8.25, 8.25]]) kit.box([mm(1.5), mm(15.5), mm(1.5)], at(x, (MODULE.springBottom + MODULE.gate) / 2, z), 'metal', joystick);
  const gatePlate = holeShape => {
    const plate = new THREE.Shape();
    plate.moveTo(-9, -9);
    plate.lineTo(9, -9);
    plate.lineTo(9, 9);
    plate.lineTo(-9, 9);
    plate.closePath();
    plate.holes.push(holeShape);
    const geometry = flat(plate, 1);
    geometry.translate(0, -mm(0.5), 0);
    const mesh = surface(kit, geometry, 'metal', joystick);
    mesh.position.y = mm(MODULE.gate);
    return mesh;
  };
  const roundHole = new THREE.Path();
  roundHole.absarc(0, 0, GATE_RADIUS, 0, Math.PI * 2, true);
  const squareHole = new THREE.Path();
  squareHole.moveTo(-GATE_RADIUS, -GATE_RADIUS);
  squareHole.lineTo(-GATE_RADIUS, GATE_RADIUS);
  squareHole.lineTo(GATE_RADIUS, GATE_RADIUS);
  squareHole.lineTo(GATE_RADIUS, -GATE_RADIUS);
  squareHole.closePath();
  const gates = [gatePlate(roundHole), gatePlate(squareHole)];

  const lever = new THREE.Group();
  joystick.add(lever);
  kit.sphere(mm(MODULE.ball), [0, 0, 0], 'metal', lever);
  kit.cylinder(mm(MODULE.shaft), mm(MODULE.cap), at(0, MODULE.cap / 2, 0), 'ink', lever);
  kit.cylinder(mm(MODULE.capRadius), mm(MODULE.capThickness), at(0, MODULE.cap, 0), 'clay', lever);
  const capRim = kit.ring(mm(7), mm(0.8), at(0, MODULE.cap + MODULE.capThickness / 2, 0), 'wood', lever);
  capRim.rotation.x = Math.PI / 2;
  kit.cylinder(mm(MODULE.foot), mm(0.6), at(0, -MODULE.ball - 0.3, 0), 'metal', lever);

  const yokeA = new THREE.Group(), yokeB = new THREE.Group();
  joystick.add(yokeA, yokeB);
  for (const side of [-1, 1]) {
    const arcA = surface(kit, new THREE.TorusGeometry(mm(MODULE.yokeA), mm(0.5), 6, 32, Math.PI), 'gold', yokeA);
    arcA.rotation.y = Math.PI / 2;
    arcA.position.x = mm(side * MODULE.slot);
    kit.rod(at(0, 0, side * (MODULE.yokeA - 0.5)), at(0, 0, side * (MODULE.yokeA + 1.5)), mm(1), 'gold', yokeA);
    const arcB = surface(kit, new THREE.TorusGeometry(mm(MODULE.yokeB), mm(0.5), 6, 32, Math.PI), 'wood', yokeB);
    arcB.position.z = mm(side * MODULE.slot);
    kit.rod(at(side * (MODULE.yokeB - 0.5), 0, 0), at(side * (MODULE.yokeB + 1.5), 0, 0), mm(1), 'wood', yokeB);
  }

  const springGroup = new THREE.Group();
  springGroup.position.y = mm(MODULE.springBottom);
  joystick.add(springGroup);
  kit.spring([0, 0, 0], mm(2.2), mm(MODULE.springTop - MODULE.springBottom), 3, springGroup, mm(0.3));
  const springPlate = kit.cylinder(mm(3.2), mm(0.5), at(0, MODULE.springTop + 0.25, 0), 'metal', joystick);

  // The two potentiometers on the module's sides, their tracks spanning the lever's travel and 20% more.
  const pots = part('pots', 'Potentiometers', 'Each yoke turns the wiper of a 10 kΩ potentiometer along its resistive track, so the wiper’s voltage says how far that yoke has turned. The lever’s 23° each way covers the middle 80% of the track. Drawn at true size.', at(STICK_AT.x, STICK_AT.y, STICK_AT.z), system);
  const potFace = (group, housing, color) => {
    kit.box(housing, [0, 0, -mm(1.7)], 'leaf', group);
    const track = surface(kit, new THREE.TorusGeometry(mm(MODULE.track), mm(0.35), 6, 24, TRACK_ARC), 'ink', group);
    track.rotation.z = Math.PI / 2 - TRACK_ARC / 2;
    const wiperArm = new THREE.Group();
    wiperArm.position.z = mm(0.4);
    group.add(wiperArm);
    kit.box([mm(0.6), mm(3.2), mm(0.4)], at(0, 1.6, 0), color, wiperArm);
    kit.disk(mm(0.9), mm(0.5), [0, 0, 0], color, wiperArm);
    for (const x of [-2.5, 0, 2.5]) kit.rod(at(x, -4.5, -1.7), at(x, -8, -1.7), mm(0.35), 'metal', group);
    return wiperArm;
  };
  const potA = new THREE.Group(), potB = new THREE.Group();
  potA.position.z = mm(MODULE.potOffset + 1.7);
  potB.position.x = mm(MODULE.potOffset + 1.7);
  potB.rotation.y = Math.PI / 2;
  pots.add(potA, potB);
  const wiperA = potFace(potA, [mm(9), mm(9), mm(3)], 'gold'), wiperB = potFace(potB, [mm(9), mm(9), mm(3)], 'wood');

  // The button: cap, rubber dome, carbon pill and the two pads on the board.
  const button = part('button', 'Button and contacts', 'Pressing the cap collapses a rubber dome until the carbon pill under it bridges two pads on the board. The pads light while the pill touches them: its first touches bounce for 2.6 ms. Drawn at true size.', at(BUTTON_AT.x, 0, BUTTON_AT.z), system);
  const cap = kit.cylinder(mm(BUTTON_AT.radius), mm(BUTTON_AT.height), at(0, BUTTON_AT.capTop - BUTTON_AT.height / 2, 0), 'red', button);
  const dome = surface(kit, new THREE.CylinderGeometry(mm(4), mm(6), mm(15), 24, 1, true), 'cream', button, true);
  dome.material.transparent = true;
  dome.material.opacity = 0.45;
  dome.material.depthWrite = false;
  const pill = kit.cylinder(mm(2.2), mm(0.6), at(0, CONTROLLER.pcb + 0.5 + BUTTON_AT.open, 0), 'ink', button);
  const pads = [-1.5, 1.5].map(x => kit.box([mm(2.6), mm(0.2), mm(5.5)], at(x, CONTROLLER.pcb + 0.1, 0), 'gold', button));
  const padMaterial = pads[0].material.clone();
  pads.forEach(pad => { pad.material = padMaterial; });

  // The circuit board, its microcontroller and the light that shows the firmware's verdict.
  const electronics = part('electronics', 'Circuit board', 'The microcontroller samples both potentiometers and the button every millisecond, debounces the button, and answers the console’s polls with a report. Its light shows when the firmware calls the button pressed.', [0, 0, 0], system);
  kit.box([mm(110), mm(1.6), mm(44)], at(CONTROLLER.x, CONTROLLER.pcb - 0.8, 38), 'leaf', electronics);
  kit.box([mm(8), mm(1.5), mm(8)], at(-24, CONTROLLER.pcb + 0.75, 44), 'ink', electronics);
  const led = own(kit.box([mm(2.4), mm(1.2), mm(1.6)], at(-14, CONTROLLER.pcb + 0.6, 48), 'red', electronics), COLORS.dark);

  const cable = part('cable', 'Cable', 'A USB cable. The console asks the controller for a report 125, 250 or 1,000 times a second, and the controller answers with its latest sample.', [0, 0, 0], system);
  kit.tube([at(CONTROLLER.x, 20, CONTROLLER.z - 41), at(-10, 8, -12), at(40, 4, -8), at(CONSOLE_AT.x - 27.5, 6, CONSOLE_AT.z)], mm(1.5), 'ink', cable);

  // The console and its monitor, at a fifth of their size.
  const consolePart = part('console', 'Console', 'The console polls the controller, turns every change in its reports into events, and runs the game 60 frames a second: at the start of each frame the game takes the latest report. The light flashes at each frame’s start. Drawn at a fifth of its size.', at(CONSOLE_AT.x, 0, CONSOLE_AT.z), system);
  const [cw, ch, cd] = CONSOLE_AT.size.map(value => value * SMALL);
  kit.box([mm(cw), mm(ch), mm(cd)], at(0, ch / 2, 0), 'ink', consolePart);
  const frameLight = own(kit.box([mm(6), mm(1.6), mm(0.8)], at(-15, ch / 2, cd / 2 + 0.4), 'gold', consolePart), COLORS.dark);
  kit.box([mm(2), mm(1.6), mm(0.8)], at(18, ch / 2, cd / 2 + 0.4), 'leaf', consolePart);

  const screen = part('screen', 'Monitor', 'A 24-inch monitor, drawn at a fifth of its size, showing the game: the character walks as the game reads the stick, and a ring appears around it for each press the game has heard, one frame after the game handles it plus the display’s own lag.', at(MONITOR_AT.x, 0, MONITOR_AT.z), system);
  const [dw, dh] = MONITOR_AT.display.map(value => value * SMALL), displayY = MONITOR_AT.bottom + dh / 2 + 2;
  kit.box([mm(44), mm(2.4), mm(32)], at(0, 1.2, 0), 'ink', screen);
  kit.box([mm(6), mm(MONITOR_AT.bottom), mm(4)], at(0, MONITOR_AT.bottom / 2, -4), 'ink', screen);
  kit.box([mm(dw + 4), mm(dh + 4), mm(4)], at(0, displayY, 0), 'ink', screen);
  const display = own(surface(kit, new THREE.PlaneGeometry(mm(dw), mm(dh)), 'ink', screen), COLORS.display);
  display.position.set(0, mm(displayY), mm(2.05));
  const gridPoints = [];
  for (let x = -50; x <= 50; x += 10) gridPoints.push(x, -dh / 2, 0, x, dh / 2, 0);
  for (let y = -20; y <= 20; y += 10) gridPoints.push(-dw / 2, y, 0, dw / 2, y, 0);
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gridPoints.map(mm), 3)), new THREE.LineBasicMaterial({color: COLORS.grid}));
  grid.position.set(0, mm(displayY), mm(2.15));
  screen.add(grid);
  const character = new THREE.Group();
  screen.add(character);
  kit.disk(mm(3), mm(0.4), [0, 0, 0], 'red', character);
  const rings = [5, 7].map(radius => kit.ring(mm(radius), mm(0.45), [0, 0, 0], 'gold', character));

  // The charts, in a plane behind the desk, not to scale.
  const Z = CHARTS.z, P = (x, y) => [mm(x), mm(y), mm(Z)];
  const chart = (id, label, description) => part(id, label, description, [0, 0, 0], system);
  const setLine = (line, points) => {
    const array = line.geometry.attributes.position.array, room = array.length / 3, n = Math.min(points.length, room);
    for (let i = 0; i < room; i++) array.set(P(...points[Math.min(i, n - 1)]), i * 3);
    line.geometry.setDrawRange(0, n);
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.boundingBox = null;
    line.geometry.boundingSphere = null;
    return n;
  };
  const segments = (count, color, parent) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color}));
    object.frustumCulled = false;
    parent.add(object);
    return object;
  };
  const frameBox = (box, parent) => setLine(lineObject(5, COLORS.axis, parent), [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h], [box.x, box.y]]);

  const T = CHARTS.timeline;
  const tx = t => T.x + (t - CLOCKS.start) / (CLOCKS.duration - CLOCKS.start) * T.w, ty = v => T.y + (Math.max(T.v0, Math.min(T.v1, v)) - T.v0) / (T.v1 - T.v0) * T.h;
  const timeline = chart('timeline', 'Stick over time', 'The stick along the line it was let go on, as a share of full travel, from 20 ms before letting go to 300 ms after. Blue: its true tilt. Red: the reports the console receives at each poll. Ink dashes: what the game reads at the start of each frame, whose ticks run along the bottom. Clay lines: the dead zone either side of center.');
  frameBox(T, timeline);
  setLine(lineObject(2, COLORS.faint, timeline), [[T.x, ty(0)], [T.x + T.w, ty(0)]]);
  setLine(lineObject(2, COLORS.faint, timeline), [[tx(0), T.y], [tx(0), T.y + T.h]]);
  const zoneLines = segments(2, COLORS.zone, timeline), trueLine = lineObject(641, COLORS.stick, timeline), reportLine = lineObject(700, COLORS.report, timeline);
  const frameDashes = segments(24, COLORS.axis, timeline), frameTicks = segments(24, COLORS.axis, timeline), timelineCursor = lineObject(2, COLORS.axis, timeline);

  const M = CHARTS.map, mx = s => M.x + M.w / 2 + s / M.range * M.w / 2, my = s => M.y + M.h / 2 + s / M.range * M.h / 2;
  const circle = radius => Array.from({length: 97}, (_, i) => [mx(radius * Math.cos(i / 96 * 2 * Math.PI)), my(radius * Math.sin(i / 96 * 2 * Math.PI))]);
  const map = chart('map', 'Stick map', 'The reports drawn as a map of the stick, as a share of full travel each way. Gold: the reports with the lever pushed all around its gate. Gray circle: full magnitude, where the game clamps. Clay circle: the dead zone. Blue: the reports over the run. Red dot: the report the console has now; blue ring: where the stick truly is.');
  frameBox(M, map);
  setLine(segments(2, COLORS.faint, map), [[M.x, my(0)], [M.x + M.w, my(0)], [mx(0), M.y], [mx(0), M.y + M.h]]);
  setLine(lineObject(97, COLORS.faint, map), circle(1));
  const zoneCircle = lineObject(97, COLORS.zone, map), gateLine = lineObject(145, COLORS.gate, map), trail = lineObject(400, COLORS.stick, map);
  const reportDot = kit.ring(mm(1.6), mm(0.5), P(M.x, M.y), 'red', map), stickDot = kit.ring(mm(2.4), mm(0.35), P(M.x, M.y), 'blue', map);

  const A = CHARTS.adc;
  const adc = chart('adc', 'ADC close up', 'Within a degree either side of where the stick comes to rest, the X report against the X yoke’s true angle. Blue: a perfect measurement. Red: the steps of the ADC, fewer and coarser with fewer bits. The red dot is the latest sample, while the stick is in this window.');
  frameBox(A, adc);
  const idealLine = lineObject(2, COLORS.stick, adc), stepLine = lineObject(700, COLORS.report, adc), sampleDot = kit.ring(mm(1.4), mm(0.45), P(A.x, A.y), 'red', adc);

  const B = CHARTS.bounce, bx = tau => B.x + (Math.max(B.t0, Math.min(B.t1, tau)) - B.t0) / (B.t1 - B.t0) * B.w;
  const ROWS = Object.freeze({contact: [B.y + 52, B.y + 62], scans: [B.y + 36, B.y + 46], firmware: [B.y + 20, B.y + 30], console: [B.y + 4, B.y + 14]});
  const bounce = chart('bounce', 'Press close up', 'The first 14 ms after the pill first touches the pads, and the millisecond before. Top: the contacts, closed high. Next: the controller’s scans every millisecond, tall where a scan finds the contacts closed. Next: the firmware’s verdict, pressed high. Bottom: the console’s polls as ticks, and what the reports tell it, pressed high.');
  frameBox(B, bounce);
  const [low, high] = ROWS.contact, contactPoints = [[bx(B.t0), low]];
  for (const [from, to] of BOUNCE) {
    contactPoints.push([bx(from), low], [bx(from), high]);
    if (Number.isFinite(to)) contactPoints.push([bx(to), high], [bx(to), low]);
    else contactPoints.push([bx(B.t1), high]);
  }
  setLine(lineObject(20, COLORS.gate, bounce), contactPoints);
  const scanTicks = segments(16, COLORS.axis, bounce), firmwareLine = lineObject(16, COLORS.report, bounce), pollTicks = segments(16, COLORS.faint, bounce), consoleLine = lineObject(16, COLORS.stick, bounce), bounceCursor = lineObject(2, COLORS.axis, bounce);

  const L = CHARTS.latency, lx = seconds => L.x + Math.max(0, Math.min(seconds, L.t1)) / L.t1 * L.w;
  const latency = chart('latency', 'Where the time goes', 'From the pill’s first touch to the result on screen, 0 to 160 ms across. Top bar: this press. Second bar: the average over every timing of the scans, polls and frames. Each is shared out as debouncing (gold), waiting for a poll (red), waiting for a frame (blue), drawing the frame (green) and the display’s lag (clay). Below: how likely each latency is, with the average marked in red.');
  frameBox(L, latency);
  const bars = [58, 48].map(y => SHARE_COLORS.map(color => own(kit.box([1, mm(6), mm(1)], P(L.x, L.y + y), 'cream', latency), color)));
  const histogramLine = lineObject(2 * HISTOGRAM.bins + 2, COLORS.stick, latency), meanLine = lineObject(2, COLORS.report, latency), latencyCursor = lineObject(2, COLORS.axis, latency);

  // The charts' words: titles, axes, and a key beside or inside each chart.
  const TEXT = mm(3.5), css = color => `#${color.toString(16).padStart(6, '0')}`;
  const words = (parent, text, x, y, options = {}) => textLabel(parent, text, {height: TEXT, position: [mm(x), mm(y), mm(Z + 0.4)], ...options});
  const key = (parent, x, top, entries) => entries.forEach(([text, color], i) => words(parent, text, x, top - 4 * i, {align: 'left', color: css(color)}));
  const percent = [[-1, '−100%'], [0, '0'], [1, '100%']];
  chartText(timeline, (t, v) => P(tx(t), ty(v)), {
    title: 'Stick over time', size: TEXT,
    x: {min: CLOCKS.start, max: CLOCKS.duration, title: 'ms after letting go', ticks: [[0, '0'], [0.1, '100'], [0.2, '200'], [0.3, '300']]},
    y: {min: T.v0, max: T.v1, title: 'Tilt, share of full travel', ticks: percent},
    legend: [['True tilt', COLORS.stick], ['Reports', COLORS.report], ['What the game reads', COLORS.axis], ['Dead zone', COLORS.zone]],
  });
  chartText(map, (a, b) => P(mx(a), my(b)), {
    title: 'Stick map', size: TEXT,
    x: {min: -M.range, max: M.range, title: 'X report', ticks: percent},
    y: {min: -M.range, max: M.range, title: 'Y report', ticks: percent},
  });
  key(map, M.x + M.w + 3, M.y + M.h - 2, [['Gate sweep', COLORS.gate], ['Full magnitude', COLORS.faint], ['Dead zone', COLORS.zone], ['Reports this run', COLORS.stick], ['Report now', COLORS.report], ['Ring: true stick', COLORS.stick]]);
  chartText(adc, (u, v) => P(A.x + u * A.w, A.y + v * A.h), {
    title: 'ADC close up', size: TEXT,
    x: {min: 0, max: 1, title: 'X yoke angle', ticks: [[0, '−1°'], [0.5, 'rest'], [1, '+1°']]},
    y: {min: 0, max: 1, title: 'X report'},
    legend: [['Perfect', COLORS.stick], ['ADC steps', COLORS.report]], legendAt: [0.5, 1],
  });
  chartText(bounce, (tau, v) => P(bx(tau), B.y + v * B.h), {
    title: 'Press close up', size: TEXT,
    x: {min: B.t0, max: B.t1, title: 'ms after first touch', ticks: [[0, '0'], [0.005, '5'], [0.01, '10']]},
    y: {min: 0, max: 1},
  });
  for (const [row, text, color] of [['contact', 'Contacts', COLORS.gate], ['scans', 'Scans', COLORS.axis], ['firmware', 'Firmware', COLORS.report], ['console', 'Console', COLORS.stick]]) words(bounce, text, B.x + 2, ROWS[row][1] + 3, {align: 'left', height: mm(3), color: css(color)});
  chartText(latency, (seconds, v) => P(lx(seconds), L.y + v * L.h), {
    title: 'Where the time goes', size: TEXT,
    x: {min: 0, max: L.t1, title: 'ms from first touch to screen', ticks: [0, 40, 80, 120, 160].map(n => [n / 1000, String(n)])},
    y: {min: 0, max: 1},
  });
  words(latency, 'This press, then the average', L.x + 2, L.y + 65.5, {align: 'left', height: mm(3)});
  key(latency, L.x + L.w + 3, L.y + L.h - 2, [['Debouncing', SHARE_COLORS[0]], ['Poll wait', SHARE_COLORS[1]], ['Frame wait', SHARE_COLORS[2]], ['Drawing', SHARE_COLORS[3]], ['Display lag', SHARE_COLORS[4]]]);

  control('release', 'Letting go', ...PAD_DOMAINS.release, PAD_DEFAULTS.release, '', 'Flick the stick to its gate and let go, or ease it back with the thumb.', RELEASE_OPTIONS.map(({value, label}) => ({value, label})));
  control('gate', 'Gate', ...PAD_DOMAINS.gate, PAD_DEFAULTS.gate, '', 'The shape of the opening that stops the lever.', GATE_OPTIONS.map(({value, label}) => ({value, label})));
  control('bits', 'ADC resolution', ...PAD_DOMAINS.bits, PAD_DEFAULTS.bits, '', 'How many bits the controller’s ADC gives each reading.', BITS_OPTIONS.map(({value, label}) => ({value, label})));
  control('deadzone', 'Dead zone', ...PAD_DOMAINS.deadzone, PAD_DEFAULTS.deadzone, '%', 'The share of full travel around the center that the game ignores.');
  control('debounce', 'Debounce', ...PAD_DOMAINS.debounce, PAD_DEFAULTS.debounce, 'scans', 'How many scans in a row must agree before the firmware believes the button.');
  control('polling', 'Polling rate', ...PAD_DOMAINS.polling, PAD_DEFAULTS.polling, '', 'How often the console asks the controller for a report.', POLL_OPTIONS.map(({value, label}) => ({value, label})));
  control('display', 'Display lag', ...PAD_DOMAINS.display, PAD_DEFAULTS.display, 'ms', 'How long the monitor takes to show a frame it has been sent.');

  // What changes only with the settings: the charts' curves, bars and outlines, and the gate plate.
  const signedShare = (report, unit) => Math.sign(report[0] * unit[0] + report[1] * unit[1]) * Math.hypot(report[0], report[1]) / GAME.full;
  let chartKey = '', trailPolls = [], adcWindow = null;
  const redraw = plan => {
    const key = JSON.stringify(plan.values);
    if (key === chartKey) return;
    chartKey = key;
    const {values, motion, press, latency: spread, bits} = plan, zone = values.deadzone / 100, unit = motion.unit;
    gates.forEach((gate, index) => { gate.visible = index === values.gate; });

    // Stick over time.
    setLine(zoneLines, [[T.x, ty(zone)], [T.x + T.w, ty(zone)], [T.x, ty(-zone)], [T.x + T.w, ty(-zone)]]);
    setLine(trueLine, Array.from({length: 641}, (_, i) => {
      const t = CLOCKS.start + (CLOCKS.duration - CLOCKS.start) * i / 640;
      return [tx(t), ty(plan.read(t).stick.s / STICK.travel)];
    }));
    trailPolls = [];
    for (let k = Math.floor((CLOCKS.start - CLOCKS.pollPhase) / plan.poll); ; k++) {
      const p = CLOCKS.pollPhase + k * plan.poll;
      if (p > CLOCKS.duration + 1e-12) break;
      trailPolls.push(p);
    }
    const stairs = [];
    trailPolls.forEach((p, i) => {
      const x = tx(Math.max(CLOCKS.start, p)), y = ty(signedShare(plan.read(plan.scanAt(p)).report, unit));
      if (i) stairs.push([x, stairs.at(-1)[1]]);
      stairs.push([x, y]);
    });
    stairs.push([tx(CLOCKS.duration), stairs.at(-1)[1]]);
    setLine(reportLine, stairs);
    const dashes = [], ticks = [];
    for (const frame of plan.frames) {
      const x = tx(frame.t), y = ty(signedShare(frame.reading.report, unit));
      dashes.push([x - 1.5, y], [x + 1.5, y]);
      ticks.push([x, T.y], [x, T.y + 3]);
    }
    setLine(frameDashes, dashes);
    setLine(frameTicks, ticks);

    // The stick map.
    setLine(zoneCircle, circle(zone));
    setLine(gateLine, Array.from({length: 145}, (_, i) => {
      const report = gatePoint(values.gate, i / 144 * 2 * Math.PI).map(angle => toReport(adcCode(wiper(angle), bits), bits));
      return [mx(report[0] / GAME.full), my(report[1] / GAME.full)];
    }));
    setLine(trail, trailPolls.map(p => {
      const report = plan.read(plan.scanAt(p)).report;
      return [mx(report[0] / GAME.full), my(report[1] / GAME.full)];
    }));

    // The ADC close up, a degree either side of the X yoke's resting angle.
    const center = motion.rest.s * unit[0], lo = center - A.half, hi = center + A.half, r0 = lo / STICK.travel * GAME.full, r1 = hi / STICK.travel * GAME.full;
    const ax = angle => A.x + (angle - lo) / (hi - lo) * A.w, ay = report => A.y + Math.max(0, Math.min(1, (report - r0) / (r1 - r0))) * A.h;
    const code = angle => adcCode(wiper(angle), bits), boundary = k => (k / 2 ** bits - 0.5) * STICK.travel / (STICK.span / 2);
    adcWindow = {lo, hi, ax, ay};
    setLine(idealLine, [[ax(lo), ay(r0)], [ax(hi), ay(r1)]]);
    const steps = [[ax(lo), ay(toReport(code(lo), bits))]];
    for (let next = code(lo) + 1; boundary(next) < hi; next++) steps.push([ax(boundary(next)), ay(toReport(next - 1, bits))], [ax(boundary(next)), ay(toReport(next, bits))]);
    steps.push([ax(hi), ay(toReport(code(hi), bits))]);
    setLine(stepLine, steps);

    // The press close up.
    const f = press.firstScan, scans = [];
    for (let j = -1; j <= 14; j++) {
      const tau = f + j * CLOCKS.scan;
      if (tau < B.t0 || tau > B.t1) continue;
      scans.push([bx(tau), ROWS.scans[0]], [bx(tau), contactClosed(tau) ? ROWS.scans[1] : ROWS.scans[0] + 3]);
    }
    setLine(scanTicks, scans);
    const firmware = [[bx(B.t0), ROWS.firmware[0]]];
    for (const change of press.bounce.changes) {
      const x = bx(f + change.scan * CLOCKS.scan);
      firmware.push([x, change.pressed ? ROWS.firmware[0] : ROWS.firmware[1]], [x, change.pressed ? ROWS.firmware[1] : ROWS.firmware[0]]);
    }
    firmware.push([bx(B.t1), firmware.at(-1)[1]]);
    setLine(firmwareLine, firmware);
    const polls = [];
    for (let k = Math.ceil((press.t + B.t0 - CLOCKS.pollPhase) / plan.poll - 1e-9); ; k++) {
      const tau = CLOCKS.pollPhase + k * plan.poll - press.t;
      if (tau > B.t1) break;
      polls.push([bx(tau), ROWS.console[0] - 2], [bx(tau), ROWS.console[0] + 1]);
    }
    setLine(pollTicks, polls);
    const heard = [[bx(B.t0), ROWS.console[0]]];
    for (const event of press.events) {
      if (event.t - press.t > B.t1) continue;
      const x = bx(event.t - press.t);
      heard.push([x, event.pressed ? ROWS.console[0] : ROWS.console[1]], [x, event.pressed ? ROWS.console[1] : ROWS.console[0]]);
    }
    heard.push([bx(B.t1), heard.at(-1)[1]]);
    setLine(consoleLine, heard);

    // Where the time goes.
    const shares = [[press.registered - press.t, press.reported - press.registered, press.frame - press.reported, plan.frame, plan.lag], [spread.parts.debounce, spread.parts.poll, spread.parts.frame, spread.parts.render, spread.parts.display]];
    bars.forEach((row, i) => {
      let left = 0;
      row.forEach((segment, k) => {
        const width = lx(left + shares[i][k]) - lx(left);
        segment.visible = width > 1e-9;
        segment.scale.x = mm(Math.max(width, 1e-6));
        segment.position.x = mm(lx(left) + width / 2);
        left += shares[i][k];
      });
    });
    const histogram = [[lx(0), L.y + 4]];
    spread.histogram.forEach((p, b) => histogram.push([lx(b * HISTOGRAM.bin), L.y + 4 + p * L.scale], [lx((b + 1) * HISTOGRAM.bin), L.y + 4 + p * L.scale]));
    histogram.push([lx(HISTOGRAM.bins * HISTOGRAM.bin), L.y + 4]);
    setLine(histogramLine, histogram);
    setLine(meanLine, [[lx(spread.mean), L.y + 2], [lx(spread.mean), L.y + 40]]);
  };

  let clock = CLOCKS.start, lastClock = 0, disposed = false;
  const sideOf = (s, release) => (s < 0 ? (release === 1 ? 'down and to the left of' : 'left of') : (release === 1 ? 'up and to the right of' : 'right of'));
  const ms = (seconds, digits = 1) => fixed(seconds * 1000, digits), minus = (value, digits) => `${value < 0 ? '−' : ''}${fixed(Math.abs(value), digits)}`;
  const result = finish(values => {
    const plan = padPlan(values), now = padAt(plan, clock), {press, motion, latency: spread} = plan, release = plan.values.release;
    redraw(plan);

    // The stick: lever, yokes, wipers, and the spring pressed by the lever's foot.
    const [xAngle, yAngle] = now.stick.angles, direction = leverDirection(now.stick.angles);
    lever.quaternion.setFromUnitVectors(UP, direction);
    yokeA.rotation.z = -xAngle;
    yokeB.rotation.x = -yAngle;
    wiperA.rotation.z = -xAngle;
    wiperB.rotation.z = -yAngle;
    const dip = MODULE.foot * Math.sin(Math.acos(Math.min(1, direction.y))), springHeight = MODULE.springTop - MODULE.springBottom;
    springGroup.scale.y = (springHeight - dip) / springHeight;
    springPlate.position.y = mm(MODULE.springTop + 0.25 - dip);

    // The button: the cap takes 3 ms to reach the contacts, then the pill bounces on the pads.
    const since = now.since, travel = since >= 0 ? 1 : since > -BUTTON_AT.reach ? 1 + since / BUTTON_AT.reach : 0;
    cap.position.y = mm(BUTTON_AT.capTop - BUTTON_AT.height / 2 - BUTTON_AT.travel * travel);
    const domeHeight = BUTTON_AT.capTop - BUTTON_AT.height - BUTTON_AT.travel * travel - CONTROLLER.pcb;
    dome.scale.y = domeHeight / 15;
    dome.position.y = mm(CONTROLLER.pcb + domeHeight / 2);
    const gap = since < 0 ? BUTTON_AT.open * (1 - travel) : now.contact ? 0 : BUTTON_AT.bounceGap;
    pill.position.y = mm(CONTROLLER.pcb + 0.5 + gap);
    padMaterial.color.set(now.contact ? COLORS.lit : COLORS.gate);
    led.material.color.set(now.firmware ? COLORS.led : COLORS.dark);

    // The console's frame light and the game on the monitor.
    const intoFrame = ((now.t - CLOCKS.framePhase) % CLOCKS.frame + CLOCKS.frame) % CLOCKS.frame;
    frameLight.material.color.set(intoFrame < 0.3 * CLOCKS.frame ? COLORS.frameLit : COLORS.dark);
    const position = now.shown ? now.shown.position : [0, 0], spanX = dw / 2 - 4, spanY = dh / 2 - 4;
    const characterX = Math.max(-spanX, Math.min(spanX, MONITOR_AT.start[0] + position[0] * MONITOR_AT.meter * SMALL));
    const characterY = Math.max(-spanY, Math.min(spanY, MONITOR_AT.start[1] + position[1] * MONITOR_AT.meter * SMALL));
    character.position.set(mm(characterX), mm(displayY + characterY), mm(2.4));
    rings.forEach((ring, index) => { ring.visible = now.onScreen > index; });

    // The charts' moving marks.
    setLine(timelineCursor, [[tx(now.t), T.y], [tx(now.t), T.y + T.h]]);
    trail.geometry.setDrawRange(0, Math.max(1, trailPolls.filter(p => p <= now.t + 1e-12).length));
    const report = now.report.report;
    reportDot.position.set(...P(mx(report[0] / GAME.full), my(report[1] / GAME.full)));
    stickDot.position.set(...P(mx(xAngle / STICK.travel), my(yAngle / STICK.travel)));
    const sampleAngle = now.sample.stick.angles[0];
    sampleDot.visible = sampleAngle >= adcWindow.lo && sampleAngle <= adcWindow.hi;
    sampleDot.position.set(...P(adcWindow.ax(Math.max(adcWindow.lo, Math.min(adcWindow.hi, sampleAngle))), adcWindow.ay(now.sample.report[0])));
    bounceCursor.visible = since >= B.t0 && since <= B.t1;
    setLine(bounceCursor, [[bx(since), B.y], [bx(since), B.y + B.h]]);
    latencyCursor.visible = since >= 0 && since <= L.t1;
    setLine(latencyCursor, [[lx(since), L.y], [lx(since), L.y + L.h]]);

    const restTilt = tiltOf([motion.unit[0] * motion.rest.s, motion.unit[1] * motion.rest.s]).alpha / DEG, restPlace = `${fixed(restTilt, 2)}° ${sideOf(motion.rest.s, release)} center, ${plan.rest.mapped.normalized > 0 ? 'outside' : 'inside'} the dead zone`;
    const stickStage = now.t < 0 ? 'stick held at the gate' : now.stick.moving ? (now.stick.held ? 'thumb easing the stick back' : 'stick swinging back') : 'stick at rest';
    const buttonStage = now.t < press.t - BUTTON_AT.reach ? 'button up' : now.t < press.t ? 'button going down' : now.t < press.registered ? 'contacts bouncing' : now.t < press.reported ? 'firmware says pressed' : now.t < press.frame ? 'console has the press' : now.t < press.photon ? 'frame on its way to the screen' : 'press on screen';
    const gateReach = phi => Math.hypot(...gatePoint(plan.values.gate, phi).map(angle => toReport(adcCode(wiper(angle), plan.bits), plan.bits))) / GAME.full;
    const speed = now.frame ? now.frame.mapped.normalized * GAME.speed : 0, zone = plan.values.deadzone / 100, N = plan.values.debounce;
    return {
      state: {...plan, now, clock, direction, dip, travel, gap, character: [characterX, characterY], restTilt},
      readings: [
        r('Your result', clock <= CLOCKS.start ? `Ready · ${RELEASE_OPTIONS[release].label}, and press the button 40 ms later; press Play` : clock >= CLOCKS.duration ? `Stick at rest ${restPlace} · the press reached the screen after ${ms(press.latency)} ms` : `${ms(now.t)} ms · ${stickStage} · ${buttonStage}`),
        r('Stick', `${fixed(tiltOf(now.stick.angles).alpha / DEG, 2)}° from center · ${now.t < 0 ? 'held at the gate' : now.stick.moving ? (now.stick.held ? 'eased back' : 'swinging') : 'at rest'}`, `Its spring gives ${fixed(SPRING * STICK.travel * 1000, 1)} mN m at full tilt against ${fixed(FRICTION * 1000, 1)} mN m of friction, so friction can hold it anywhere within ${fixed(STICK.returnBand / DEG, 0)}° of center. This time it comes to rest ${restPlace}, ${ms(motion.rest.t)} ms after letting go.`),
        r('Report', `X ${minus(report[0], 0)} · Y ${minus(report[1], 0)} · ${fixed(Math.hypot(...report) / GAME.full * 100, 1)}% of full`, `${plan.bits} bits: one step of the ADC is ${fixed(plan.step.angle / DEG, 3)}° of tilt, ${fixed(plan.step.report, 0)} in the report. Pushed to the gate, the stick reads ${fixed(gateReach(0) * 100, 1)}% straight out and ${fixed(gateReach(Math.PI / 4) * 100, 1)}% on the diagonals.`),
        r('Game', !now.frame ? 'Waiting for its first frame' : speed > 0 ? `Character moving at ${fixed(speed, 2)} m/s` : 'Inside the dead zone: the character stands still', `Dead zone ${fixed(plan.values.deadzone, 0)}%, ${fixed(zone * GAME.full, 0)} of 32,767; the XInput documentation suggests 7,849 for a left stick. At rest this stick reads ${fixed(plan.rest.share * 100, 1)}%${plan.rest.creep > 0 ? `, outside the dead zone, so the character creeps at ${fixed(plan.rest.creep, 2)} m/s` : ', inside the dead zone'}.`),
        r('Button', `${since < -BUTTON_AT.reach ? 'Up' : since < 0 ? 'Going down' : now.contact ? 'Contacts closed' : 'Contacts apart'} · firmware ${now.firmware ? 'pressed' : 'released'} · console heard ${now.heard} ${now.heard === 1 ? 'press' : 'presses'}`, `Needing ${N} closed ${N === 1 ? 'scan' : 'scans'} in a row, the firmware calls it pressed ${ms(press.registered - press.t)} ms after the contacts first touch${press.bounce.presses > 1 ? `, and counts ${press.bounce.presses} presses` : ''}. Over every timing it ${spread.firmwareDoubles > 0 ? `counts a second press ${fixed(spread.firmwareDoubles * 100, 0)}% of the time` : 'never counts a second press'}, and polling at ${fixed(plan.rate, 0)} Hz the console ${spread.consoleDoubles > 0 ? `hears one ${fixed(spread.consoleDoubles * 100, 0)}% of the time` : 'never hears one'}.`),
        r('Latency', `This press: ${ms(press.latency)} ms from touch to screen`, `Over every timing: ${ms(spread.min)} to ${ms(spread.max)} ms, ${ms(spread.mean)} ms on average. Debouncing ${ms(spread.parts.debounce)}, waiting for a poll ${ms(spread.parts.poll)}, waiting for a frame ${ms(spread.parts.frame)}, drawing it ${ms(spread.parts.render)}, and the display ${ms(spread.parts.display, 0)}.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(CLOCKS.duration, clock + dt / SLOW); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = CLOCKS.start; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the gimbal', part: 'joystick', view: 'front', replay: false, run() { clock = 0.005; return render(); }},
    {label: 'Inspect: the potentiometers', part: 'pots', view: 'front', replay: false, run() { clock = 0.005; return render(); }},
    {label: 'Inspect: the bounce', part: 'bounce', view: 'front', replay: false, run() { clock = CLOCKS.press + 0.001; return render(); }},
    {label: 'Inspect: the stick map', part: 'map', view: 'front', replay: false, run() { clock = CLOCKS.duration; return render(); }},
    {label: 'Inspect: where the time goes', part: 'latency', view: 'front', replay: false, run() { clock = CLOCKS.duration; return render(); }},
  ];
  result.playback = {
    label: 'Let go and press',
    description: 'The stick let go at the gate and the button pressed 40 ms later, fifty times slower than real time.',
    stepLabel: 'Advance 5 ms',
    advance: result.advance,
    step: () => result.advance(0.005 * SLOW),
    complete: () => clock >= CLOCKS.duration,
    blocked: () => false,
  };

  root.rotation.set(0.4, -0.35, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  // The console alone is a plain box; framed with its monitor, it shows what it drives.
  result.frameBoundsForPart = id => (id === 'console' ? new THREE.Box3().setFromObject(screen) : null);
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, body, bottomShell, topShell, joystick, gates, lever, yokeA, yokeB, springGroup, springPlate, pots, potA, potB, wiperA, wiperB, button, cap, dome, pill, pads, padMaterial, electronics, led, cable, consolePart, frameLight, screen, display, grid, character, rings, displayY, dw, dh, timeline, zoneLines, trueLine, reportLine, frameDashes, frameTicks, timelineCursor, map, zoneCircle, gateLine, trail, reportDot, stickDot, adc, idealLine, stepLine, sampleDot, bounce, scanTicks, firmwareLine, pollTicks, consoleLine, bounceCursor, latency, bars, histogramLine, meanLine, latencyCursor, ROWS, tx, ty, mx, my, bx, lx, adcWindow: () => adcWindow, trailPolls: () => trailPolls, MM, SLOW};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, lineObject, surface, textLabel} from './scene-kit.js';
import {controllerFeedback} from './games-controller-feedback.js';
import {padPlan, padAt, gatePoint, tiltOf, wiper, adcCode, toReport, contactClosed, STICK, SPRING, FRICTION, CLOCKS, BOUNCE, GAME, HISTOGRAM, RELEASE_OPTIONS, GATE_OPTIONS, BITS_OPTIONS, POLL_OPTIONS, RUMBLE_OPTIONS, PAD_DEFAULTS, PAD_DOMAINS} from './games-controller-physics.js';

// ---------------------------------------------------------------------------
// Games controller: a gamepad lying on a desk with its top shell cut away, its
// thumbstick module and one button open to view, a cable to a console, the
// console's monitor, and five charts behind them.
//
// Scale: one millimeter is 0.02 scene units for the controller (164 mm across),
// its thumbstick module (a lever 20 mm to the cap, tilting 23° each way in a
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
export const MODULE = Object.freeze({shaft: 2, gate: 9, gateThickness: 1, cap: 20, capRadius: 10, capThickness: 4, ball: 2.5, foot: 2.5, springBottom: -6.5, springTop: -3.6, yokeA: 6, yokeB: 7.5, slot: 2.8, potOffset: 9.5, track: 3});
export const GATE_RADIUS = (MODULE.gate + MODULE.gateThickness / 2) * Math.tan(STICK.travel) + MODULE.shaft / Math.cos(STICK.travel);
export const TRACK_ARC = 2 * STICK.travel / STICK.span;
export const BUTTON_AT = Object.freeze({x: 15, z: 32, capTop: 35, travel: 2, radius: 5, height: 6, open: 1.5, bounceGap: 0.25, reach: 0.003});
export const CONSOLE_AT = Object.freeze({x: 110, z: 20, size: [275, 60, 215]});
export const MONITOR_AT = Object.freeze({x: 110, z: -30, bottom: 26, display: [531, 299], meter: 500, start: [-40, -10]});
export const CHARTS = Object.freeze({
  z: -70,
  timeline: Object.freeze({x: -146, y: 179, w: 126, h: 60, v0: -1, v1: 1.5}),
  map: Object.freeze({x: 60, y: 179, w: 60, h: 60, range: 1.5}),
  adc: Object.freeze({x: -154, y: 88, w: 64, h: 70, half: DEG}),
  bounce: Object.freeze({x: -75, y: 88, w: 120, h: 70, t0: -0.001, t1: 0.014}),
  latency: Object.freeze({x: 60, y: 88, w: 80, h: 70, t1: 0.16, scale: 250}),
});
export const COLORS = Object.freeze({stick: 0x2f6690, report: 0xc14f39, gate: 0x89601c, zone: 0x914626, axis: 0x374736, faint: 0x667466, lit: 0x5ed17a, led: 0xff3b2f, dark: 0x3a2a28, frameLit: 0xffd35a, display: 0x1d2a33, grid: 0x3c5664});
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

const flat = (shape, depth, curveSegments = 24) => {
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments});
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
  const experiment = part('experiment', 'Complete experiment', 'Follow the controller’s input to the game, then the game’s feedback command back to the motors.', [0, 0, 0], system);
  const machine = part('machine', 'Games controller', 'A simplified wired gamepad with one active thumbstick, one button and two rumble motors. Other buttons and a second stick are omitted.', [0, 0, 0], experiment);
  const category = (id, name, description) => { const group = part(id, name, description, [0, 0, 0], machine); group.userData.explosionCategory = true; return group; };

  // The controller's shell: the bottom half, and the top half as a cover with holes for the stick and the button.
  const body = category('body', 'Controller shell', 'A hollow shell, 164 mm across, carries the board and motor mounts. Cutaway removes the side walls and top panel so every mechanism can be inspected.');
  const bottomShell = surface(kit, flat(controllerOutline(), 2), 'ink', body);
  bottomShell.position.set(mm(CONTROLLER.x), 0, mm(CONTROLLER.z));
  const wallOutline = controllerOutline(), inner = new THREE.Path();
  const innerPoints = controllerOutline().getPoints(48).map(p => new THREE.Vector2(p.x * 0.965, p.y * 0.95));
  inner.setFromPoints(innerPoints.reverse()); wallOutline.holes.push(inner);
  const walls = surface(kit, flat(wallOutline, 28), 0x55605a, body);
  walls.position.set(mm(CONTROLLER.x), mm(2), mm(CONTROLLER.z)); covers.push(walls);
  const topOutline = controllerOutline();
  for (const [x, radius] of [[STICK_AT.x - CONTROLLER.x, 13.2], [BUTTON_AT.x - CONTROLLER.x, 6.5]]) {
    const hole = new THREE.Path();
    hole.absarc(x, CONTROLLER.z - STICK_AT.z, radius, 0, Math.PI * 2, true);
    topOutline.holes.push(hole);
  }
  const portHole = new THREE.Path(); portHole.moveTo(-5, 32); portHole.lineTo(-5, 38); portHole.lineTo(5, 38); portHole.lineTo(5, 32); portHole.closePath(); topOutline.holes.push(portHole);
  const topShell = surface(kit, flat(topOutline, 2), 0x55605a, body);
  topShell.position.set(mm(CONTROLLER.x), mm(30), mm(CONTROLLER.z));
  covers.push(topShell);
  const boardSupports = [];
  for (const x of [-76, 26]) for (const z of [19, 57]) boardSupports.push(kit.cylinder(mm(2), mm(10.4), at(x, 7.2, z), 'cream', body));

  // The thumbstick module, built about its pivot.
  const stickMechanism = category('stick-mechanism', 'Thumbstick and sensors', 'Supported perpendicular yokes turn two potentiometers. The lever’s foot compresses a return spring.');
  const joystick = part('joystick', 'Thumbstick', 'The stick’s lever pivots in two supported slotted yokes. The round gate limits tilt to 23°; the square gate limits each yoke to 23°, allowing greater diagonal tilt. The dimensions are illustrative, not a copy of a commercial module.', at(STICK_AT.x, STICK_AT.y, STICK_AT.z), stickMechanism);
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
    const geometry = flat(plate, MODULE.gateThickness, 256);
    geometry.translate(0, -mm(0.5), 0);
    const mesh = surface(kit, geometry, 'metal', joystick);
    mesh.position.y = mm(MODULE.gate);
    return mesh;
  };
  const roundHole = new THREE.Path();
  // Circumscribed polygon: triangulation must not intrude into the nominal
  // circular clearance. Maximum excess radius is below 0.00012 mm.
  const roundSegments = 512, meshRadius = GATE_RADIUS / Math.cos(Math.PI / roundSegments);
  roundHole.setFromPoints(Array.from({length:roundSegments+1},(_,i)=>{const angle=(.5-i)*2*Math.PI/roundSegments;return new THREE.Vector2(meshRadius*Math.cos(angle),meshRadius*Math.sin(angle));}));
  const squareHole = new THREE.Path();
  squareHole.moveTo(-GATE_RADIUS, -GATE_RADIUS);
  squareHole.lineTo(-GATE_RADIUS, GATE_RADIUS);
  squareHole.lineTo(GATE_RADIUS, GATE_RADIUS);
  squareHole.lineTo(GATE_RADIUS, -GATE_RADIUS);
  squareHole.closePath();
  const gates = [gatePlate(roundHole), gatePlate(squareHole)];

  const lever = part('stick-lever','Thumb cap and lever','The cap and shaft tilt together about the ball center. The foot presses the spring plate.',[0,0,0],joystick);
  kit.sphere(mm(MODULE.ball), [0, 0, 0], 'metal', lever);
  kit.cylinder(mm(MODULE.shaft), mm(MODULE.cap), at(0, MODULE.cap / 2, 0), 'ink', lever);
  kit.cylinder(mm(MODULE.capRadius), mm(MODULE.capThickness), at(0, MODULE.cap, 0), 'clay', lever);
  const capRim = kit.ring(mm(7), mm(0.8), at(0, MODULE.cap + MODULE.capThickness / 2, 0), 'wood', lever);
  capRim.rotation.x = Math.PI / 2;
  const foot = surface(kit, new THREE.CylinderGeometry(mm(MODULE.foot),mm(MODULE.foot),mm(0.6),128), 'metal', lever);
  foot.position.set(...at(0,-MODULE.ball-0.3,0));

  const yokeA = part('x-yoke','X-axis yoke and shaft','Its slot permits motion along the other axis while its supported shaft turns the X potentiometer.',[0,0,0],joystick);
  const yokeB = part('y-yoke','Y-axis yoke and shaft','This perpendicular slotted yoke turns the Y potentiometer.',[0,0,0],joystick);
  for (const side of [-1, 1]) {
    const arcA = surface(kit, new THREE.TorusGeometry(mm(MODULE.yokeA), mm(0.5), 6, 32, Math.PI), 'gold', yokeA);
    arcA.rotation.y = Math.PI / 2;
    arcA.position.x = mm(side * MODULE.slot);
    kit.rod(at(-MODULE.slot, 0, side * MODULE.yokeA), at(MODULE.slot, 0, side * MODULE.yokeA), mm(0.5), 'gold', yokeA);
    kit.rod(at(0, 0, side * (MODULE.yokeA - 0.5)), at(0, 0, side > 0 ? 11.6 : -9), mm(0.7), 'gold', yokeA);
    const arcB = surface(kit, new THREE.TorusGeometry(mm(MODULE.yokeB), mm(0.5), 6, 32, Math.PI), 'wood', yokeB);
    arcB.position.z = mm(side * MODULE.slot);
    kit.rod(at(side * MODULE.yokeB, 0, -MODULE.slot), at(side * MODULE.yokeB, 0, MODULE.slot), mm(0.5), 'wood', yokeB);
    kit.rod(at(side * (MODULE.yokeB - 0.5), 0, 0), at(side > 0 ? 11.6 : -9, 0, 0), mm(0.7), 'wood', yokeB);
  }
  const bearings = [];
  for (const axis of ['x', 'z']) for (const side of [-1, 1]) {
    const pos = axis === 'x' ? [side * 8.25, 0, 0] : [0, 0, side * 8.25];
    const bearing = kit.ring(mm(1.15), mm(0.35), at(...pos), 'metal', joystick);
    if (axis === 'x') bearing.rotation.y = Math.PI / 2; bearings.push(bearing);
    kit.box(at(1.5, 5.75, 1.5), at(pos[0], -4.375, pos[2]), 'metal', joystick);
  }
  const ballSeat = kit.ring(mm(2.75), mm(0.25), [0, 0, 0], 'metal', joystick); ballSeat.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) kit.rod(at(side * 2.75, 0, 0), at(side * 6.5, -6.5, 0), mm(0.4), 'metal', joystick);

  const springAssembly = part('return-spring','Return spring and plate','A seated coil presses a plate against the lever foot. The displayed spring stays in contact; its compression illustrates the assigned restoring torque.',[0,0,0],joystick);
  const springGroup = new THREE.Group();
  springGroup.position.y = mm(MODULE.springBottom);
  springAssembly.add(springGroup);
  kit.spring(at(0, 0.3, 0), mm(2.2), mm(MODULE.springTop - MODULE.springBottom - 0.6), 3, springGroup, mm(0.3));
  for (const y of [0.3,MODULE.springTop-MODULE.springBottom-0.3]) {const end=kit.ring(mm(2.2),mm(0.3),at(0,y,0),'metal',springGroup);end.rotation.x=Math.PI/2;}
  const springPlate = kit.cylinder(mm(3.2), mm(0.5), at(0, MODULE.springTop + 0.25, 0), 'metal', springAssembly);
  const frame = part('stick-frame','Gate, frame and bearings','The frame mounts to the board, supports four shaft bearings and seats the pivot. Only the selected round or square gate is shown.',[0,0,0],joystick);
  for (const child of [...joystick.children]) if (![lever,yokeA,yokeB,springAssembly,frame].includes(child)) frame.add(child);

  // The two potentiometers on the module's sides, their tracks spanning the lever's travel and 20% more.
  const pots = part('pots', 'Potentiometers', 'Each yoke turns a wiper along a 10 kΩ track. Its voltage changes with angle while total track current stays 0.33 mA at 3.3 V. The high-impedance ADC draws negligible wiper current.', at(STICK_AT.x, STICK_AT.y, STICK_AT.z), stickMechanism);
  const potFace = (group, id, color) => {
    const casingShape = new THREE.Shape(), bore = new THREE.Path();
    casingShape.setFromPoints([[-4.5,-4.5],[4.5,-4.5],[4.5,4.5],[-4.5,4.5],[-4.5,-4.5]].map(p => new THREE.Vector2(...p)));
    bore.absarc(0, 0, 0.85, 0, 2 * Math.PI, true); casingShape.holes.push(bore);
    const casingGeometry = new THREE.ExtrudeGeometry(casingShape, {depth: 3, bevelEnabled: false}); casingGeometry.translate(0,0,-3.2); casingGeometry.scale(MM,MM,MM);
    surface(kit, casingGeometry, 'leaf', group);
    const trackPart = part(`${id}-track`,`${id==='x-pot'?'X':'Y'} resistive track`,'The two fixed ends connect to ground and 3.3 V. The wiper follows the voltage along this 10 kΩ track.',[0,0,0],group);
    const track = surface(kit, new THREE.TorusGeometry(mm(MODULE.track), mm(0.35), 6, 24, TRACK_ARC), 'ink', trackPart);
    track.rotation.z = Math.PI / 2 - TRACK_ARC / 2;
    const wiperArm = part(`${id}-wiper`,`${id==='x-pot'?'X':'Y'} sensor wiper`,'The shaft rotates this conducting arm across the resistive track. Its center terminal sends the divided voltage to the ADC.',[0,0,0],group);
    wiperArm.position.z = mm(0.4);
    group.add(wiperArm);
    kit.box([mm(0.6), mm(3.2), mm(0.4)], at(0, 1.6, 0), color, wiperArm);
    kit.disk(mm(0.9), mm(0.5), [0, 0, 0], color, wiperArm);
    for (const x of [-2.5, 0, 2.5]) kit.rod(at(x, -4.5, -1.7), at(x, -8, -1.7), mm(0.35), 'metal', group);
    for (const side of [-1, 1]) {
      const angle = Math.PI / 2 - side * TRACK_ARC / 2, x = MODULE.track * Math.cos(angle), y = MODULE.track * Math.sin(angle);
      kit.tube([at(x,y,0),at(side * 3.7,2,0),at(side * 3.7,-3.5,0),at(side * 2.5,-4.5,-1.7)],mm(0.15),'gold',group);
    }
    kit.rod(at(0,-0.8,0),at(0,-4.5,-1.7),mm(0.15),'gold',group);
    return wiperArm;
  };
  const potA = part('x-pot','X potentiometer','Three pins connect the two track ends and the moving wiper to the circuit board.',[0,0,0],pots);
  const potB = part('y-pot','Y potentiometer','The perpendicular sensor measures the other yoke angle.',[0,0,0],pots);
  potA.position.z = mm(MODULE.potOffset + 1.7);
  potB.position.x = mm(MODULE.potOffset + 1.7);
  potB.rotation.y = Math.PI / 2;
  pots.add(potA, potB);
  const wiperA = potFace(potA, 'x-pot', 'gold'), wiperB = potFace(potB, 'y-pot', 'wood');

  // The button: cap, rubber dome, carbon pill and the two pads on the board.
  const buttons = category('buttons', 'Button input', 'A guided cap and rubber contact close a pull-up input circuit.');
  const button = part('button', 'Button and contacts', 'Pressing the cap flexes the rubber dome and bridges two board pads with a carbon pill. The assigned contact trace bounces for 2.6 ms; actual switches have different bounce patterns.', at(BUTTON_AT.x, 0, BUTTON_AT.z), buttons);
  const capPart = part('button-cap','Button cap','The guided cap travels down 2 mm when pressed.',[0,0,0],button);
  const rubber = part('button-rubber','Rubber dome and stem','The flexible dome returns the button. A central rubber stem transfers the cap’s press to the conductive pill.',[0,0,0],button);
  const carbon = part('button-carbon','Carbon contact pill','This conductive pill bridges the two pads when pressed. The assigned trace includes short separations during bounce.',[0,0,0],button);
  const contacts = part('button-pads','Input and ground pads','One pad connects to a pulled-up input; the other to ground. The pill closes the circuit between them.',[0,0,0],button);
  const cap = kit.cylinder(mm(BUTTON_AT.radius), mm(BUTTON_AT.height), at(0, BUTTON_AT.capTop - BUTTON_AT.height / 2, 0), 'red', capPart);
  const dome = surface(kit, new THREE.CylinderGeometry(mm(4), mm(6), mm(15), 24, 1, true), 'cream', rubber, true);
  dome.material.transparent = true;
  dome.material.opacity = 0.45;
  dome.material.depthWrite = false;
  const pill = kit.cylinder(mm(2.2), mm(0.6), at(0, CONTROLLER.pcb + 0.5 + BUTTON_AT.open, 0), 'ink', carbon);
  const buttonStem = kit.cylinder(mm(1.5), mm(1), [0,0,0], 'cream', rubber);
  const buttonGuide = kit.ring(mm(5.6),mm(0.4),at(0,30,0),'cream',button); buttonGuide.rotation.x=Math.PI/2;
  for (const x of [-6,6]) for (const z of [-6,6]) kit.rod(at(x,14,z),at(x,30,z),mm(0.45),'cream',button);
  const pads = [-1.5, 1.5].map(x => kit.box([mm(2.6), mm(0.2), mm(5.5)], at(x, CONTROLLER.pcb + 0.1, 0), 'gold', contacts));
  const padMaterial = pads[0].material.clone();
  pads.forEach(pad => { pad.material = padMaterial; });

  // The circuit board, its microcontroller and the light that shows the firmware's verdict.
  const electronics = category('electronics', 'Circuit board', 'The microcontroller samples the wipers and active-low button every millisecond, debounces the button, and reports. Gold paths indicate connections, not a production PCB layout.');
  const boardPart = part('board','Printed circuit board','An insulating board supports the electronics and connects their terminals.',[0,0,0],electronics);
  const chipPart = part('microcontroller','Microcontroller and ADC','Samples two voltages, checks the button, debounces it and constructs input reports.',[0,0,0],electronics);
  const board = kit.box([mm(110), mm(1.6), mm(44)], at(CONTROLLER.x, CONTROLLER.pcb - 0.8, 38), 'leaf', boardPart);
  const chip = kit.box([mm(8), mm(1.5), mm(8)], at(-24, CONTROLLER.pcb + 0.75, 44), 'ink', chipPart);
  const led = own(kit.box([mm(2.4), mm(1.2), mm(1.6)], at(-14, CONTROLLER.pcb + 0.6, 48), 'red', electronics), COLORS.dark);

  const port = kit.box(at(9, 4, 5), at(CONTROLLER.x, 31, 5), 'metal', electronics);
  const traces = [], trace = points => { const object = kit.tube(points.map(p => at(...p)), mm(0.18), 'gold', electronics); traces.push(object); return object; };
  // Signal paths reach the actual potentiometer pins and the button pads.
  trace([[-63,14.2,41.5],[-55,14.2,47],[-28,14.2,47]]);
  trace([[-53.5,14.2,32],[-45,14.2,35],[-28,14.2,41]]);
  trace([[16.5,14.2,32],[8,14.2,39],[-20,14.2,41]]);
  trace([[13.5,14.2,32],[13.5,14.2,21],[-67,14.2,21],[-67,14.2,41.5],[-65.5,14.2,41.5]]);
  trace([[-53.5,14.2,34.5],[-53.5,14.2,21]]);
  trace([[-60.5,14.2,41.5],[-60.5,14.2,53],[-14,14.2,53],[-14,14.2,44]]);
  trace([[-53.5,14.2,29.5],[-42,14.2,29.5],[-42,14.2,53]]);
  const regulator = kit.box(at(4,1.2,4),at(-36,14.6,22),'ink',electronics);
  trace([[-25,29,5],[-25,18,10],[-36,14.2,20]]);
  trace([[-36,14.2,24],[-36,14.2,53],[-14,14.2,53]]);
  trace([[-38,14.2,22],[-38,14.2,21]]);
  trace([[-23,29,5],[-23,18,14],[-23,14.2,40]]);
  trace([[-27,29,5],[-27,18,14],[-27,14.2,40]]);
  trace([[-29,29,5],[-29,18,14],[-29,14.2,21]]);
  const pullup = kit.box(at(2,0.8,4),at(5,14.6,38),'cream',electronics);
  trace([[5,14.2,36],[5,14.2,32],[16.5,14.2,32]]); trace([[5,14.2,40],[5,14.2,53],[-14,14.2,53]]);
  const feedback = controllerFeedback(kit, machine, MM);
  trace([[-5,14.2,48],[-5,14.2,46],[-14,14.2,46],[-14,14.2,53]]);
  trace([[-2,14.2,48],[-2,14.2,21]]);
  const cable = part('cable', 'USB cable', 'The host supplies power and polls for input. Reports go to the console; a separate output command returns to the rumble driver. Connector and traces are simplified.', [0, 0, 0], experiment); cable.userData.explosionExcluded = true;
  kit.tube([at(CONTROLLER.x,34,5),at(CONTROLLER.x,38,-5),at(-10,8,-12),at(40,4,-8),at(CONSOLE_AT.x-27.5,6,CONSOLE_AT.z)],mm(1.5),'ink',cable);

  // The console and its monitor, at a fifth of their size.
  const consolePart = part('console', 'Console', 'This illustrative game queues observed report edges between frames and runs at 60 frames a second. Real input APIs may instead expose only the latest state. The light marks frame starts. Drawn at one fifth scale.', at(CONSOLE_AT.x, 0, CONSOLE_AT.z), experiment); consolePart.userData.explosionExcluded = true;
  const [cw, ch, cd] = CONSOLE_AT.size.map(value => value * SMALL);
  kit.box([mm(cw), mm(ch), mm(cd)], at(0, ch / 2, 0), 'ink', consolePart);
  const frameLight = own(kit.box([mm(6), mm(1.6), mm(0.8)], at(-15, ch / 2, cd / 2 + 0.4), 'gold', consolePart), COLORS.dark);
  kit.box([mm(2), mm(1.6), mm(0.8)], at(18, ch / 2, cd / 2 + 0.4), 'leaf', consolePart);

  const screen = part('screen', 'Monitor', 'A 24-inch monitor at one fifth scale. The character moves from the sampled stick direction; one ring appears for each observed press. The assigned pipeline draws for one frame, then adds the selected display delay.', at(MONITOR_AT.x, 0, MONITOR_AT.z), experiment); screen.userData.explosionExcluded = true;
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
  kit.tube([at(110,6,-1.5),at(135,5,-5),at(138,12,-35),at(110,35,-32)],mm(1),'ink',cable);

  // The charts, in a plane behind the desk, not to scale.
  const Z = CHARTS.z, P = (x, y) => [mm(x), mm(y), mm(Z)];
  const charts = new THREE.Group(); charts.name='Measurements'; system.add(charts); charts.userData.explosionExcluded = true;
  // Diagrams occupy the experiment's envelope but appear only in their own
  // inspection. They cannot change the home camera or clutter reassembly.
  charts.scale.setScalar(.3); charts.position.z=mm(30);
  const chart = (id, label, description) => {const group=part(id,label,description,[0,0,0],charts);group.userData.inspectionOnly=id;return group;};
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
  const TEXT = mm(12), labelColors = new Map([[0xe3b45e,0x89601c],[0x91aa7e,0x4b643c],[0xce825f,0x914626]]);
  const css = color => `#${(labelColors.get(color) ?? color).toString(16).padStart(6, '0')}`;
  const words = (parent, text, x, y, options = {}) => textLabel(parent, text, {height: TEXT, position: [mm(x), mm(y), mm(Z + 0.4)], ...options});
  const key = (parent, x, top, entries) => entries.forEach(([text, color], i) => words(parent, text, x, top - 13.8 * i, {align: 'left', color: css(color)}));
  const percent = [[-1, '−100%'], [0, '0'], [1, '100%']];
  chartText(timeline, (t, v) => P(tx(t), ty(v)), {
    title: 'Stick over time', size: TEXT,
    x: {min: CLOCKS.start, max: CLOCKS.duration, title: 'Time after release (ms)', ticks: [[0, '0'], [0.1, '100'], [0.2, '200'], [0.3, '300']]},
    y: {min: T.v0, max: T.v1, title: 'Share of full travel', ticks: percent},
  });
  for (const [i,[label,color]] of [['Tilt',COLORS.stick],['Report',COLORS.report],['Game',COLORS.axis],['Dead zone',COLORS.zone]].entries()) words(timeline,label,T.x+4+(i%2)*65,T.y-46-Math.floor(i/2)*14,{align:'left',color:css(color)});
  chartText(map, (a, b) => P(mx(a), my(b)), {
    title: 'Stick map', size: TEXT,
    x: {min: -M.range, max: M.range, title: 'X report', ticks: percent},
    y: {min: -M.range, max: M.range, title: 'Y report', ticks: percent},
  });
  key(map, M.x + M.w + 5, M.y + M.h - 2, [['Gate', COLORS.gate], ['Limit', COLORS.faint], ['Dead zone', COLORS.zone], ['Trail', COLORS.stick], ['Report', COLORS.report], ['Stick', COLORS.stick]]);
  chartText(adc, (u, v) => P(A.x + u * A.w, A.y + v * A.h), {
    title: 'ADC close up', size: TEXT,
    x: {min: 0, max: 1, title: 'X yoke angle', ticks: [[0, '−1°'], [0.5, 'rest'], [1, '+1°']]},
    y: {min: 0, max: 1, title: 'X report'},
    legend: [['Ideal', COLORS.stick], ['Steps', COLORS.report]], legendAt: [0.6, 1],
  });
  chartText(bounce, (tau, v) => P(bx(tau), B.y + v * B.h), {
    title: 'Press close up', size: TEXT,
    x: {min: B.t0, max: B.t1, title: 'Since touch (ms)', ticks: [[0, '0'], [0.005, '5'], [0.01, '10']]},
    y: {min: 0, max: 1},
  });
  for (const [row, text, color] of [['contact', 'Contact', COLORS.gate], ['scans', 'Scan', COLORS.axis], ['firmware', 'Filter', COLORS.report], ['console', 'Report', COLORS.stick]]) words(bounce, text, B.x - 5, (ROWS[row][0]+ROWS[row][1])/2, {align: 'right', color: css(color)});
  chartText(latency, (seconds, v) => P(lx(seconds), L.y + v * L.h), {
    title: 'Where the time goes', size: TEXT,
    x: {min: 0, max: L.t1, title: 'Touch to screen (ms)', ticks: [0, 40, 80, 120, 160].map(n => [n / 1000, String(n)])},
    y: {min: 0, max: 1},
  });
  words(latency, 'This', L.x - 5, L.y + 58, {align:'right'});
  words(latency, 'Mean', L.x - 5, L.y + 48, {align:'right'});
  key(latency, L.x + L.w + 5, L.y + L.h - 2, [['Filter', SHARE_COLORS[0]], ['Poll', SHARE_COLORS[1]], ['Frame', SHARE_COLORS[2]], ['Render', SHARE_COLORS[3]], ['Display', SHARE_COLORS[4]]]);

  control('release', 'Letting go', ...PAD_DOMAINS.release, PAD_DEFAULTS.release, '', 'Choose the release motion. Changing any setting restarts the experiment.', RELEASE_OPTIONS.map(({value, label}) => ({value, label})), {primary:true});
  control('gate', 'Gate', ...PAD_DOMAINS.gate, PAD_DEFAULTS.gate, '', 'The shape of the opening that stops the lever.', GATE_OPTIONS.map(({value, label}) => ({value, label})), {primary:true});
  control('bits', 'ADC resolution', ...PAD_DOMAINS.bits, PAD_DEFAULTS.bits, '', 'How many bits the controller’s ADC gives each reading.', BITS_OPTIONS.map(({value, label}) => ({value, label})));
  control('deadzone', 'Dead zone', ...PAD_DOMAINS.deadzone, PAD_DEFAULTS.deadzone, '%', 'The share of full travel around the center that the game ignores.');
  control('debounce', 'Debounce', ...PAD_DOMAINS.debounce, PAD_DEFAULTS.debounce, 'scans', 'How many scans in a row must agree before the firmware believes the button.');
  control('polling', 'Polling rate', ...PAD_DOMAINS.polling, PAD_DEFAULTS.polling, '', 'How often the console asks the controller for a report.', POLL_OPTIONS.map(({value, label}) => ({value, label})));
  control('display', 'Display lag', ...PAD_DOMAINS.display, PAD_DEFAULTS.display, 'ms', 'How long the monitor takes to show a frame it has been sent.');
  control('rumble', 'Rumble feedback', ...PAD_DOMAINS.rumble, PAD_DEFAULTS.rumble, '', 'The first press accepted by the game triggers one motor pulse. Display delay does not delay this return command.', RUMBLE_OPTIONS.map(({value,label})=>({value,label})));

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

  let clock = CLOCKS.start, lastClock = 0, disposed = false, settingsKey = '', restoring = false;
  const sideOf = (s, release) => (s < 0 ? (release === 1 ? 'down and to the left of' : 'left of') : (release === 1 ? 'up and to the right of' : 'right of'));
  const ms = (seconds, digits = 1) => fixed(seconds * 1000, digits), minus = (value, digits) => `${value < 0 ? '−' : ''}${fixed(Math.abs(value), digits)}`;
  const result = finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== settingsKey) { if (!restoring) clock = CLOCKS.start; settingsKey = nextKey; }
    const plan = padPlan(values), now = padAt(plan, clock), {press, motion, latency: spread} = plan, release = plan.values.release;
    clock = now.t;
    redraw(plan);

    // The stick: lever, yokes, wipers, and the spring pressed by the lever's foot.
    const [xAngle, yAngle] = now.stick.angles, direction = leverDirection(now.stick.angles);
    lever.quaternion.setFromUnitVectors(UP, direction);
    yokeA.rotation.z = -xAngle;
    yokeB.rotation.x = -yAngle;
    wiperA.rotation.z = -xAngle;
    wiperB.rotation.z = -yAngle;
    const tilt = Math.acos(Math.min(1, direction.y));
    const dip = (MODULE.ball + 0.6) * (Math.cos(tilt) - 1) + MODULE.foot * Math.sin(tilt), springHeight = MODULE.springTop - MODULE.springBottom;
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
    const stemBottom = CONTROLLER.pcb + 0.8 + gap, stemTop = BUTTON_AT.capTop - BUTTON_AT.height - BUTTON_AT.travel * travel;
    buttonStem.scale.y = stemTop - stemBottom; buttonStem.position.y = mm((stemTop + stemBottom) / 2);
    padMaterial.color.set(now.contact ? COLORS.lit : COLORS.gate);
    led.material.color.set(now.firmware ? COLORS.led : COLORS.dark);
    feedback.update(now.motors);

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
    const buttonStage = now.t < press.t - BUTTON_AT.reach ? 'button up' : now.t < press.t ? 'button going down' : now.t < press.t + BOUNCE.at(-1)[0] ? 'contacts bouncing' : now.t < press.registered ? 'contacts settled; firmware counting scans' : now.t < press.reported ? 'firmware says pressed' : now.t < press.frame ? 'console has the press' : now.t < press.photon ? 'frame on its way to the screen' : 'press on screen';
    const gateReach = phi => Math.hypot(...gatePoint(plan.values.gate, phi).map(angle => toReport(adcCode(wiper(angle), plan.bits), plan.bits))) / GAME.full;
    const speed = now.frame ? now.frame.mapped.normalized * GAME.speed : 0, zone = plan.values.deadzone / 100, N = plan.values.debounce;
    return {
      state: {...plan, now, clock, direction, dip, travel, gap, character: [characterX, characterY], restTilt},
      readings: [
        r('Your result', clock <= CLOCKS.start ? `Ready · ${RELEASE_OPTIONS[release].label}, and press the button 40 ms later; press Play` : clock >= CLOCKS.duration ? `Observation complete · stick rests ${restPlace} · press reached the screen after ${ms(press.latency)} ms` : `${ms(now.t)} ms · ${stickStage} · ${buttonStage}`, clock >= CLOCKS.duration ? `Playback stops at 300 ms. The button remains held${plan.rest.creep > 0 ? ' and the character would keep creeping' : ''}. Play repeats the selected settings.` : 'Playback is 50 times slower than physical time. Inspection preserves the current moment.'),
        r('Stick', `${fixed(tiltOf(now.stick.angles).alpha / DEG, 2)}° from center · ${now.t < 0 ? 'held at the gate' : now.stick.moving ? (now.stick.held ? 'eased back' : 'swinging') : 'at rest'}`, `The assigned reduced model gives ${fixed(SPRING * STICK.travel * 1000, 1)} mN m of spring torque at full travel against ${fixed(FRICTION * 1000, 1)} mN m of friction. It stops ${restPlace}, ${ms(motion.rest.t)} ms after release. These are illustrative dynamics, not manufacturer measurements.`),
        r('Wiper voltages', `X ${fixed(now.sample.volts[0],3)} V · Y ${fixed(now.sample.volts[1],3)} V`, 'Latest sampled voltages. Each 10 kΩ track carries 0.33 mA across 3.3 V; its high-impedance wiper input measures voltage rather than track current.'),
        r('ADC codes', `X ${now.sample.codes[0]} · Y ${now.sample.codes[1]} · ${plan.bits} bits`, `${2 ** plan.bits} possible codes. Each voltage bin is ${fixed(1000 * STICK.supply / 2 ** plan.bits,3)} mV wide. The report uses bin midpoints without neutral calibration.`),
        r('Report', `X ${minus(report[0], 0)} · Y ${minus(report[1], 0)} · ${fixed(Math.hypot(...report) / GAME.full * 100, 1)}% of full`, `${plan.bits} bits: one step of the ADC is ${fixed(plan.step.angle / DEG, 3)}° of tilt, ${fixed(plan.step.report, 0)} in the report. Pushed to the gate, the stick reads ${fixed(gateReach(0) * 100, 1)}% straight out and ${fixed(gateReach(Math.PI / 4) * 100, 1)}% on the diagonals.`),
        r('Report bytes', now.packet.map(byte=>byte.toString(2).padStart(8,'0')).join(' '), 'Illustrative five-byte layout: signed X low/high, signed Y low/high, then button bit 0. This is not a claim about a specific commercial controller’s packet.'),
        r('Game', !now.frame ? 'Waiting for its first frame' : speed > 0 ? `Character moving at ${fixed(speed, 2)} m/s` : 'Inside the dead zone: the character stands still', `Dead zone ${fixed(plan.values.deadzone, 0)}%, ${fixed(zone * GAME.full, 0)} of 32,767; the XInput documentation suggests 7,849 for a left stick. At rest this stick reads ${fixed(plan.rest.share * 100, 1)}%${plan.rest.creep > 0 ? `, outside the dead zone, so the character creeps at ${fixed(plan.rest.creep, 2)} m/s` : ', inside the dead zone'}.`),
        r('Button', `${since < -BUTTON_AT.reach ? 'Up' : since < 0 ? 'Going down' : now.contact ? 'Contacts closed' : 'Contacts apart'} · firmware ${now.firmware ? 'pressed' : 'released'} · console heard ${now.heard} ${now.heard === 1 ? 'press' : 'presses'}`, `Needing ${N} closed ${N === 1 ? 'scan' : 'scans'} in a row, the firmware calls it pressed ${ms(press.registered - press.t)} ms after the contacts first touch${press.bounce.presses > 1 ? `, and counts ${press.bounce.presses} presses` : ''}. Over every timing it ${spread.firmwareDoubles > 0 ? `counts a second press ${fixed(spread.firmwareDoubles * 100, 0)}% of the time` : 'never counts a second press'}, and polling at ${fixed(plan.rate, 0)} Hz the console ${spread.consoleDoubles > 0 ? `hears one ${fixed(spread.consoleDoubles * 100, 0)}% of the time` : 'never hears one'}.`),
        r('Latency', `This press: ${ms(press.latency)} ms from touch to screen`, `Over every timing: ${ms(spread.min)} to ${ms(spread.max)} ms, ${ms(spread.mean)} ms on average. Debouncing ${ms(spread.parts.debounce)}, waiting for a poll ${ms(spread.parts.poll)}, waiting for a frame ${ms(spread.parts.frame)}, drawing it ${ms(spread.parts.render)}, and the display ${ms(spread.parts.display, 0)}.`),
        r('Rumble feedback', !plan.values.rumble ? 'Off · both motors stationary' : `Left ${fixed(now.motors[0].frequency,0)} Hz · right ${fixed(now.motors[1].frequency,0)} Hz · ${now.motors[0].phase}`, `Mount forces: ${fixed(now.motors[0].magnitude,2)} N and ${fixed(now.motors[1].magnitude,2)} N. Arrows show rotating force, not shell motion. The first game press starts the assigned pulse after a 1 ms return transfer.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(CLOCKS.duration, clock + dt / SLOW); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = (initial = {}) => { clock = CLOCKS.start + (Number.isFinite(initial.time) ? Math.max(0, initial.time) : 0); lastClock = 0; restoring = true; try { return render({...result.defaults,...(initial.settings || {})}); } finally { restoring = false; } };
  result.replayState = () => ({settings:result.getState().values,time:0});
  const inspect = (label, part, isolate = true) => ({label,part,isolate,view:'front',replay:false,run:()=>render()});
  result.actions = [inspect('Inspect: complete experiment','experiment'),inspect('Inspect: controller','machine'),inspect('Inspect: the gimbal','joystick'),inspect('Inspect: return spring','return-spring'),inspect('Inspect: the potentiometers','pots'),inspect('Inspect: button contacts','button'),inspect('Inspect: rumble motors','feedback'),inspect('Inspect: low-frequency motor','low-motor'),inspect('Inspect: high-frequency motor','high-motor'),inspect('Read: stick over time','timeline'),inspect('Read: stick map','map'),inspect('Read: ADC steps','adc'),inspect('Read: button bounce','bounce'),inspect('Read: timing breakdown','latency')];
  result.playback = {
    label: 'Let go and press',
    description: 'The stick let go at the gate and the button pressed 40 ms later, fifty times slower than real time.',
    stepLabel: 'Advance 5 ms',
    advance: result.advance,
    step: () => result.advance(0.005 * SLOW),
    complete: () => clock >= CLOCKS.duration,
    blocked: () => false,
  };

  result.initialPart = result.autoFramePart = 'experiment';
  result.initialView = 'front';
  result.initialCutaway = true;
  result.initialIsolated = true;
  result.frameVisibleOnly = true;
  result.framePadding = 0.78;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.partViewDirections = {};
  for (const p of result.parts) {p.maxZoom=180;result.partViewDirections[p.id] = {front:[.65,1.6,3],back:[-.65,1.4,-3],side:[3,1,0],top:[0,3,0],bottom:[0,-3,0]};}
  result.partViewDirections.pots.front=[2.5,1.2,2.5];
  result.parts.find(p=>p.id==='experiment').framePadding=.62;
  for (const id of ['timeline','map','adc','bounce','latency','screen']) { result.partViewDirections[id] = {front:[0,0,3]}; Object.assign(result.parts.find(p=>p.id===id), {framePadding:.62,maxZoom:180}); }
  result.thumbnailOmit = [charts,cable,consolePart,screen];
  result.topology = {system, experiment, machine, charts, body, bottomShell, walls, topShell, boardSupports, stickMechanism, joystick, frame, bearings, ballSeat, gates, lever, foot, yokeA, yokeB, springAssembly, springGroup, springPlate, pots, potA, potB, wiperA, wiperB, button, cap, dome, pill, buttonStem, buttonGuide, pads, padMaterial, electronics, board, chip, led, port, regulator, traces, pullup, feedback, cable, consolePart, frameLight, screen, display, grid, character, rings, displayY, dw, dh, timeline, zoneLines, trueLine, reportLine, frameDashes, frameTicks, timelineCursor, map, zoneCircle, gateLine, trail, reportDot, stickDot, adc, idealLine, stepLine, sampleDot, bounce, scanTicks, firmwareLine, pollTicks, consoleLine, bounceCursor, latency, bars, histogramLine, meanLine, latencyCursor, ROWS, tx, ty, mx, my, bx, lx, adcWindow: () => adcWindow, trailPolls: () => trailPolls, MM, SLOW};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

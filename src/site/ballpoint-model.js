import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {solidArrow, surface} from './scene-kit.js';
import {ballpointPlan, ballpointAt, BALLPOINT, BALL_OPTIONS, PLACE_OPTIONS, REFILL_OPTIONS, BALLPOINT_DEFAULTS, BALLPOINT_DOMAINS} from './pens-physics.js';

// ---------------------------------------------------------------------------
// Ballpoint pen: a pen writing a line, its ball and socket drawn larger
// beside it, and the weight of its ink along the refill.
//
// Scale: the pen, its refill and the paper are drawn at true size, 1 mm to
// 0.01 scene units. In the pen's own frame the tip touches the paper at the
// origin, the refill runs up +y and the line runs along +x; that frame turns
// about z to put the pen on a desk, a wall or the ceiling. The ball close up
// is drawn 40 times larger, as the pen sees it. The weight arrows are 30 mm
// long for the ink's full weight, and the part along the refill on the same
// scale.
//
// Time: the pen writes at 10 mm a second.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const DETAIL = 40;
export const DETAIL_ORIGIN = Object.freeze([1.3, 0.55, 0]);

/** The refill, mm: the socket's top, the tube's wall, the tube's length above the socket, the float, where the socket's rim holds the ball (a share of the ball's radius above the paper), and how far pulled-back ink is drawn from the ball. */
export const REFILL = Object.freeze({socket: 4, wall: 0.5, length: 100, float: 3, rim: 0.6, pulled: 5});
export const PAPER = Object.freeze({x0: -15, x1: 65, z: 20, thick: 0.1});

/** How far the drawn line stands above the paper, mm; the line's width as a share of the ball's diameter, illustrative. */
export const FILM = 0.02;
export const LINE_SHARE = 0.5;
export const SPECKS = 24;
export const SPECK_RING = Object.freeze({radius: 0.94, z: 0.342, size: 0.07});
export const ARROW = Object.freeze({length: 30, thick: 0.9, offset: 25});
export const COLORS = Object.freeze({ink: 0x2b5d9c, weight: 0x5f7380, clean: 0x8d989c, ball: 0xc9d1d3, gas: 0xdfe8ea});

/** The close-up socket's profile about the ball, in units of the ball's radius from its center: up the inside from the rim, over the top to the ink channel, and down the outside. */
export const SOCKET_PROFILE = Object.freeze([[0.94, -0.4], [1.04, 0], [0.98, 0.45], [0.62, 0.85], [0.45, 0.85], [0.45, 1.7], [0.95, 1.7], [1.35, 0.2], [1.1, -0.4]]);

/** The pen's tip direction in the scene for a place, a unit vector. */
export const pointing = place => { const a = (place.angle ?? 0) * Math.PI / 180; return [Math.sin(a), -Math.cos(a), 0]; };

/** Where in the scene a point of the pen's own frame lies, for a place: turned about z. */
export const toScene = (place, [x, y, z]) => { const a = (place.angle ?? 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c * x - s * y, s * x + c * y, z]; };

/** How far round the ball, the way it turns, speck `i` sits from the top after the ball has turned `turn` radians. */
export const speckAlong = (i, turn) => { const along = (turn - 2 * Math.PI * i / SPECKS) % (2 * Math.PI); return along < 0 ? along + 2 * Math.PI : along; };

/** A speck carries ink once it has passed the top since the ink began coming round, until it has laid it on the paper at the bottom. */
export const speckInked = (along, reach) => along <= Math.min(reach, Math.PI) + 1e-12;

export function createBallpointModel() {
  const kit = houseModel('Ballpoint pen'), {part, control, finish} = kit;
  const mm = value => value * MM, big = value => value * MM * DETAIL;
  const block = (color, parent) => surface(kit, new THREE.BoxGeometry(1, 1, 1), color, parent);
  const setBox = (mesh, [x0, x1], [y0, y1], [z0, z1], scale = MM) => {
    mesh.position.set((x0 + x1) / 2 * scale, (y0 + y1) / 2 * scale, (z0 + z1) / 2 * scale);
    mesh.scale.set(Math.max(1e-9, (x1 - x0) * scale), Math.max(1e-9, (y1 - y0) * scale), Math.max(1e-9, (z1 - z0) * scale));
  };
  const rod = (color, parent) => surface(kit, new THREE.CylinderGeometry(1, 1, 1, 32), color, parent);
  const setRod = (mesh, radius, y0, y1, scale = MM) => {
    mesh.position.set(0, (y0 + y1) / 2 * scale, 0);
    mesh.scale.set(Math.max(1e-9, radius * scale), Math.max(1e-9, (y1 - y0) * scale), Math.max(1e-9, radius * scale));
    mesh.visible = y1 > y0;
  };
  const paint = (mesh, color) => { mesh.material = mesh.material.clone(); mesh.material.color.set(color); return mesh; };
  const halfShell = (color, parent) => surface(kit, new THREE.CylinderGeometry(1, 1, 1, 40, 1, true, Math.PI / 2, Math.PI), color, parent, true);

  const system = part('system', 'Ballpoint pen, ball and weight', `A ballpoint pen writing a ${fixed(BALLPOINT.line, 0)} mm line, drawn at true size, with its ball drawn ${DETAIL} times larger beside it and the weight of its ink drawn along the refill. Choose the ball, where you write and the refill, then press Play.`, [0, 0, 0]);
  const setup = new THREE.Group();
  system.add(setup);

  // The paper and the line, in the pen's own frame.
  const paper = part('paper', 'Paper and line', `A corner of the page, drawn at true size. The line is drawn half as wide as the ball; a real line’s width also depends on the ink and how hard you press.`, [0, 0, 0], setup);
  const sheet = block('cream', paper);
  setBox(sheet, [PAPER.x0, PAPER.x1], [-PAPER.thick, 0], [-PAPER.z, PAPER.z]);
  const line = paint(block('blue', paper), COLORS.ink);
  const inkMaterial = line.material;

  // The refill, cut open.
  const refill = part('refill', 'Refill', `The refill cut open, drawn at true size: a ${fixed(BALLPOINT.column, 0)} mm column of ink in a bore ${fixed(2 * BALLPOINT.boreRadius, 1)} mm across, a brass socket and the ball, all illustrative but the ball. An ordinary refill is open at the back. A pressurized one is sealed, with nitrogen pressing a float onto the ink. Pointed up, an ordinary refill’s ink is drawn pulled back from the ball.`, [0, 0, 0], setup);
  const pen = new THREE.Group();
  refill.add(pen);
  const ball = paint(kit.sphere(1, [0, 0, 0], 'metal', pen), COLORS.ball);
  const socket = surface(kit, new THREE.BufferGeometry(), 'gold', pen, true);
  const tube = halfShell('leaf', pen);
  const ink = rod('blue', pen);
  ink.material = inkMaterial;
  const float = rod('clay', pen);
  const gas = paint(rod('cream', pen), COLORS.gas);
  const seal = rod('ink', pen);

  // The ball close up, in the pen's frame.
  const detail = part('ball', 'Ball, close up', `The ball and its socket cut open and drawn ${DETAIL} times larger, as the pen sees them. The ball rolls without slipping; the dots on it turn with it, and those carrying ink take its color. They pick ink up at the top, inside the socket, and lay it on the paper half a turn later.`, DETAIL_ORIGIN, system);
  const bigBall = new THREE.Group();
  detail.add(bigBall);
  const bigSphere = paint(kit.sphere(1, [0, 0, 0], 'metal', bigBall), COLORS.ball);
  const cleanMaterial = paint(kit.sphere(SPECK_RING.size, [0, 0, 0], 'metal', bigBall), COLORS.clean).material;
  const specks = [bigBall.children.at(-1)];
  for (let i = 1; i < SPECKS; i++) specks.push(kit.sphere(SPECK_RING.size, [0, 0, 0], 'metal', bigBall));
  specks.forEach((speck, i) => {
    const a = Math.PI / 2 + 2 * Math.PI * i / SPECKS;
    speck.position.set(SPECK_RING.radius * Math.cos(a), SPECK_RING.radius * Math.sin(a), SPECK_RING.z);
    speck.material = cleanMaterial;
  });
  const bigSocket = surface(kit, new THREE.LatheGeometry(SOCKET_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 40, Math.PI / 2, Math.PI), 'gold', detail, true);
  const bigInk = rod('blue', detail);
  bigInk.material = inkMaterial;
  const bigPaper = block('cream', detail);
  const bigLine = block('blue', detail);
  bigLine.material = inkMaterial;

  // The ink's weight, and the part of it along the refill.
  const pulls = part('pulls', 'Weight along the refill', `Steel: the full weight of the ink, pointing straight down, ${fixed(ARROW.length, 0)} mm long. Blue: the part of that weight acting along the refill, toward the ball or away from it, on the same scale. In orbit nothing weighs, so neither is drawn.`, [0, 0, 0], system);
  const weightArrow = solidArrow(kit, COLORS.weight, pulls, mm(ARROW.thick));
  const shareArrow = solidArrow(kit, COLORS.ink, pulls, mm(ARROW.thick));

  control('ball', 'Ball', ...BALLPOINT_DOMAINS.ball, BALLPOINT_DEFAULTS.ball, 'mm', 'The ball’s diameter, from the standard sizes.', BALL_OPTIONS.map(option => ({...option})));
  control('place', 'Where you write', ...BALLPOINT_DOMAINS.place, BALLPOINT_DEFAULTS.place, '', 'Which way the pen points while it writes.', PLACE_OPTIONS.map(option => ({...option})));
  control('refill', 'Refill', ...BALLPOINT_DOMAINS.refill, BALLPOINT_DEFAULTS.refill, '', 'An ordinary refill open at the back, or a sealed one pressurized with nitrogen.', REFILL_OPTIONS.map(option => ({...option})));

  // What changes only with the settings: the socket fitted to the ball.
  let drawnBall = null;
  const fitSocket = radius => {
    if (radius === drawnBall) return;
    drawnBall = radius;
    const rimY = REFILL.rim * radius, rimRadius = Math.sqrt(radius * radius - (radius - rimY) ** 2) * 1.02, top = BALLPOINT.boreRadius + REFILL.wall;
    socket.geometry.dispose();
    socket.geometry = new THREE.CylinderGeometry(mm(top), mm(rimRadius), mm(REFILL.socket - rimY), 40, 1, true, Math.PI / 2, Math.PI);
    socket.position.set(0, mm(REFILL.socket + rimY) / 2, 0);
  };

  let clock = 0, lastClock = 0, disposed = false;
  const result = finish(values => {
    const plan = ballpointPlan(values), now = ballpointAt(plan, clock), v = plan.values, place = plan.place;
    const radius = plan.ball / 2, angle = (place.angle ?? 0) * Math.PI / 180;

    // The pen's frame turned to where it writes, and the pen at the end of its travel.
    setup.rotation.z = angle;
    pen.position.set(mm(now.travel), 0, 0);
    ball.position.set(0, mm(radius), 0);
    ball.scale.setScalar(mm(radius));
    ball.rotation.z = -now.turn;
    fitSocket(radius);

    // The refill: its tube, its ink, and the float and nitrogen of a pressurized one.
    const top = REFILL.socket + REFILL.length, pulledBack = !plan.feeds ? REFILL.pulled : 0;
    tube.position.set(0, mm(REFILL.socket + top) / 2, 0);
    tube.scale.set(mm(BALLPOINT.boreRadius + REFILL.wall), mm(REFILL.length), mm(BALLPOINT.boreRadius + REFILL.wall));
    const inkFrom = REFILL.socket + pulledBack, inkTo = inkFrom + BALLPOINT.column;
    setRod(ink, BALLPOINT.boreRadius, inkFrom, inkTo);
    setRod(float, BALLPOINT.boreRadius * 0.95, inkTo, inkTo + REFILL.float);
    setRod(gas, BALLPOINT.boreRadius * 0.9, inkTo + REFILL.float, top);
    setRod(seal, BALLPOINT.boreRadius + REFILL.wall, top, top + REFILL.wall);
    float.visible = gas.visible = seal.visible = plan.pressurized;

    // The line, from where the ink first reached the paper to the ball.
    const half = LINE_SHARE * plan.ball / 2;
    setBox(line, [plan.delay, plan.delay + now.line], [0, FILM], [-half, half]);
    line.visible = now.line > 0;

    // The ball close up: turning with the pen's ball, ink on the dots that carry it.
    const R = DETAIL * radius, reach = now.ink / radius;
    bigBall.scale.setScalar(big(radius));
    bigBall.rotation.z = -now.turn;
    specks.forEach((speck, i) => { speck.material = speckInked(speckAlong(i, now.turn), reach) ? inkMaterial : cleanMaterial; });
    bigSocket.scale.setScalar(big(radius));
    setRod(bigInk, 0.45 * R - 0.05 * R, 0.85 * R, 1.7 * R);
    bigInk.visible = plan.feeds;
    setBox(bigPaper, [-3 * R, 3 * R], [-R - 0.06 * R, -R], [-1.5 * R, 1.5 * R]);
    const drawnLine = Math.min(DETAIL * now.line, 3 * R);
    setBox(bigLine, [-drawnLine, 0], [-R, -R + 0.02 * R], [-LINE_SHARE * R, LINE_SHARE * R]);
    bigLine.visible = drawnLine > 0;

    // The ink's weight and its share along the refill, on one scale.
    const weighs = place.angle !== null, middle = toScene(place, [now.travel - ARROW.offset, inkFrom + BALLPOINT.column / 2, 0]);
    weightArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));
    weightArrow.userData.setLength(weighs ? mm(ARROW.length) : 0);
    weightArrow.position.set(mm(middle[0]), mm(middle[1] + ARROW.length / 2), 0);
    const along = pointing(place).map(component => component * Math.sign(place.share)), shareLength = Math.abs(place.share) * ARROW.length;
    const beside = toScene(place, [now.travel - 2 * ARROW.offset, inkFrom + BALLPOINT.column / 2, 0]);
    shareArrow.userData.setDirection(new THREE.Vector3(...(place.share === 0 ? [0, -1, 0] : along)));
    shareArrow.userData.setLength(weighs ? mm(shareLength) : 0);
    shareArrow.position.set(mm(beside[0] - along[0] * shareLength / 2), mm(beside[1] - along[1] * shareLength / 2), 0);

    const placeName = ['on a desk', 'on a wall', 'on the ceiling', 'in orbit'][v.place];
    const status = clock <= 0 ? `Ready · ${fixed(plan.ball, 2)} mm ball ${placeName}; press Play`
      : now.done ? (plan.feeds ? `A ${fixed(now.line, 1)} mm line · the ball turned ${fixed(now.turns, 2)} times` : 'No line: gravity pulls the ink away from the ball')
      : plan.feeds ? `Writing · ${fixed(now.line, 1)} mm of line` : `Rolling dry · ${fixed(now.travel, 1)} mm and no ink on the ball`;
    const weightText = [`All of it pulls the ink toward the ball`, `None of it acts along the refill`, `All of it pulls the ink away from the ball`, `Nothing weighs in orbit`][v.place];
    return {
      state: {...plan, now, clock, angle, pulledBack, middle, beside, along, shareLength, weighs},
      readings: [
        r('Your result', status),
        r('Ball', `Turned ${fixed(now.turns, 2)} times`, `A ball rolls without slipping, so it turns once for every π times its diameter of line: once every ${fixed(plan.circumference, 3)} mm for this ${fixed(plan.ball, 2)} mm ball, ${fixed(plan.turns, 2)} times in ${fixed(BALLPOINT.line, 0)} mm.`),
        r('Ink', !plan.feeds ? 'Not reaching the ball' : now.ink < plan.delay ? `Coming round the ball · ${fixed(now.ink, 3)} of ${fixed(plan.delay, 3)} mm` : 'Reaching the paper', `The ball picks ink up at its top and lays it on the paper at its bottom, half a turn later, so the line starts ${fixed(plan.delay, 3)} mm after the ball begins to roll.`),
        r('Weight', weightText, place.angle === null ? 'In orbit nothing weighs, yet a regular ballpoint still writes pointed any way, because the capillary forces in its ink hold it at the ball.' : `The ${fixed(BALLPOINT.column, 0)} mm column of ink, taken as water, presses with ${fixed(plan.weight, 1)} Pa when the pen points straight down. Only the cosine of the pen’s angle to straight down acts along the refill: ${place.share > 0 ? `here all ${fixed(plan.head, 1)} Pa, toward the ball` : place.share < 0 ? `here all ${fixed(-plan.head, 1)} Pa, away from the ball` : 'here none of it'}.`),
        r('Refill', plan.pressurized ? `Nitrogen at nearly ${fixed(BALLPOINT.nitrogen, 0)} kPa` : 'Open at the back', plan.pressurized ? `A sliding float separates the ink from the gas, which presses at nearly ${fixed(BALLPOINT.nitrogen, 0)} kPa, ${fixed(BALLPOINT.nitrogen * 1000 / plan.weight, 0)} times what the column of ink weighs, so it writes at any angle.` : 'Gravity brings the ink down to the ball. Pointed up, gravity pulls the ink away from the tip, and most ordinary ballpoints stop writing.'),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the ball close up', part: 'ball', view: 'front', replay: false, run() { return inspect(duration() / 2); }},
    {label: 'Inspect: the weight along the refill', part: 'pulls', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the line', part: 'paper', view: 'top', replay: false, run() { return inspect(duration()); }},
  ];
  result.playback = {
    label: 'Write',
    description: `The pen writes ${fixed(BALLPOINT.line, 0)} mm at ${fixed(BALLPOINT.speed, 0)} mm a second.`,
    stepLabel: 'Advance 1 mm',
    advance: result.advance,
    step: () => result.advance(1 / BALLPOINT.speed),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'ball', label: 'Inspect the ball', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.3, -0.4, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, setup, paper, sheet, line, inkMaterial, refill, pen, ball, socket, tube, ink, float, gas, seal, detail, bigBall, bigSphere, specks, cleanMaterial, bigSocket, bigInk, bigPaper, bigLine, pulls, weightArrow, shareArrow};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

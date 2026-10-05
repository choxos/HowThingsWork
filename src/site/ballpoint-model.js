import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {solidArrow, surface} from './scene-kit.js';
import {ballpointPlan, ballpointAt, BALLPOINT, BALL_OPTIONS, PLACE_OPTIONS, REFILL_OPTIONS, CONDITION_OPTIONS, BALLPOINT_DEFAULTS, BALLPOINT_DOMAINS} from './pens-physics.js';

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

/** Assigned refill dimensions in mm. The ball is retained by the normalized socket profile. */
export const REFILL = Object.freeze({socket: 4, wall: 0.5, length: 100, float: 3, rim: 0.6, pulled: 0});
export const PAPER = Object.freeze({x0: -15, x1: 65, z: 20, thick: 0.1});

/** How far the drawn line stands above the paper, mm; the line's width as a share of the ball's diameter, illustrative. */
export const FILM = 0.02;
export const LINE_SHARE = 0.5;
export const SPECKS = 24;
export const SPECK_RING = Object.freeze({radius: 0.94, z: 0.342, size: 0.035});
export const ARROW = Object.freeze({length: 30, thick: 0.9, offset: 25});
export const COLORS = Object.freeze({ink: 0x2b5d9c, weight: 0x5f7380, clean: 0x8d989c, ball: 0xc9d1d3, gas: 0xdfe8ea});

/** The close-up socket's profile about the ball, in units of the ball's radius from its center: up the inside from the rim, over the top to the ink channel, and down the outside. */
export const SOCKET_PROFILE = Object.freeze([[0.94, -0.4], [1.04, 0], [0.92, 0.5], [0.69, 0.8], [0.46, 0.94], [0.4, 1.03], [0.4, 1.7], [0.95, 1.7], [1.35, 0.2], [1.1, -0.4], [0.94, -0.4]]);

/** The pen's tip direction in the scene for a place, a unit vector. */
export const pointing = place => { const a = (place.angle ?? 0) * Math.PI / 180; return [Math.sin(a), -Math.cos(a), 0]; };

/** Where in the scene a point of the pen's own frame lies, for a place: turned about z. */
export const toScene = (place, [x, y, z]) => { const a = (place.angle ?? 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c * x - s * y, s * x + c * y, z]; };

/** How far round the ball, the way it turns, speck `i` sits from the top after the ball has turned `turn` radians. */
export const speckAlong = (i, turn) => { const along = (turn - 2 * Math.PI * i / SPECKS) % (2 * Math.PI); return along < 0 ? along + 2 * Math.PI : along; };

/** Initial film occupies the transport half of the ball; later film requires an open feed at the last top crossing. */
export const speckInked = (along, travel, radius, feeds, primed) => {
  const pickup = travel - along * radius;
  return along <= Math.PI + 1e-12 && (pickup >= -1e-12 ? feeds : primed);
};

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

  const system = part('system', 'Ballpoint pen, ball and weight', `An original cutaway pen writes a ${fixed(BALLPOINT.line, 0)} mm stroke. A separate ${DETAIL}× close-up exposes the ball and ink channel. Choose the starting condition and press Play. Dimensions and pressure are assigned teaching values.`, [0, 0, 0]);
  const setup = new THREE.Group();
  system.add(setup);

  // The paper and the line, in the pen's own frame.
  const paper = part('paper', 'Paper and line', `A corner of the page, drawn at true size. The line is drawn half as wide as the ball; a real line’s width also depends on the ink and how hard you press.`, [0, 0, 0], setup);
  const sheet = block('cream', paper);
  setBox(sheet, [PAPER.x0, PAPER.x1], [-PAPER.thick, 0], [-PAPER.z, PAPER.z]);
  const line = paint(block('blue', paper), COLORS.ink);
  const inkMaterial = line.material;

  // The refill, cut open.
  const carriage = new THREE.Group(); setup.add(carriage);
  const barrel = part('barrel', 'Barrel and rear plug', 'The shell holds the refill and protects it. Look inside removes the front half. This is a fixed-tip pen; a retracting mechanism is not included.', [0, 0, 0], carriage);
  const bodyBack = halfShell('leaf', barrel), bodyFront = halfShell('leaf', barrel);
  bodyFront.rotation.y = Math.PI;
  for (const mesh of [bodyBack, bodyFront]) {mesh.position.y = mm(56.5); mesh.scale.set(mm(4.2), mm(97), mm(4.2));}
  const noseProfile = [[1.5, 4], [1.55, 8], [4.2, 8], [1.8, 4], [1.5, 4]].map(([x,y]) => new THREE.Vector2(mm(x),mm(y)));
  const noseBack = surface(kit, new THREE.LatheGeometry(noseProfile, 40, Math.PI / 2, Math.PI), 'leaf', barrel, true);
  const noseFront = surface(kit, new THREE.LatheGeometry(noseProfile, 40, -Math.PI / 2, Math.PI), 'leaf', barrel, true);
  const rearProfile = [[.5, 104.5], [.5, 107], [4.2, 107], [4.2, 104.5], [.5, 104.5]].map(([x,y]) => new THREE.Vector2(mm(x),mm(y)));
  const rearPlug = surface(kit, new THREE.LatheGeometry(rearProfile, 40), 'leaf', barrel); // Vent through the barrel remains open.
  const refill = part('refill', 'Ink reservoir', `A teaching refill with a 60 mm ink column and 2 mm bore. A visible narrow channel connects it to the ball. The ordinary refill is vented; the sealed refill adds a gas chamber, separator and rear seal. Ink consumption during the short stroke is neglected.`, [0, 0, 0], carriage);
  const pen = new THREE.Group();
  refill.add(pen);
  const tip = part('tip', 'Ball, socket and ink channel', 'The socket retains the rolling ball. Its central ink channel joins the reservoir to the ball. A dark plug appears only in the blocked-channel experiment; the block is imposed, not predicted from the pen’s angle.', [0, 0, 0], carriage);
  const ball = paint(kit.sphere(1, [0, 0, 0], 'metal', tip), COLORS.ball);
  const socket = surface(kit, new THREE.BufferGeometry(), 'gold', tip, true);
  const collar = surface(kit, new THREE.BufferGeometry(), 'gold', tip, true);
  const channelInk = surface(kit, new THREE.BufferGeometry(), 'blue', tip);
  const channelBlock = rod('ink', tip);
  const tube = halfShell('metal', pen);
  const ink = rod('blue', pen);
  ink.material = inkMaterial;
  const float = rod('clay', pen);
  const gas = paint(rod('cream', pen), COLORS.gas);
  const seal = rod('ink', pen);

  // The ball close up, in the pen's frame.
  const detail = part('ball', 'Ball, close up', `The ball and its socket cut open and drawn ${DETAIL} times larger, as the pen sees them. The ball rolls without slipping; the dots on it turn with it, and those carrying ink take its color. The blue markers show a schematic film traveling from the top to the paper. A primed ball already carries ink at the start; a deliberately clean ball needs half a turn. Surface wetting and film thickness are not solved.`, DETAIL_ORIGIN, system);
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
  const bigBlock = rod('ink', detail);
  const bigPaper = block('cream', detail);
  const bigLine = block('blue', detail);
  bigLine.material = inkMaterial;

  // The ink's weight, and the part of it along the refill.
  const pulls = part('pulls', 'Weight along the refill', `Steel: the full weight of the ink, pointing straight down, ${fixed(ARROW.length, 0)} mm long. Blue: the part of that weight acting along the refill, toward the ball or away from it, on the same scale. In the freely falling orbital frame the hydrostatic contribution is neglected; an oval zero marker replaces the force arrows. Earth’s gravity still acts on the orbiting spacecraft.`, [0, 0, 0], system);
  const weightArrow = solidArrow(kit, COLORS.weight, pulls, mm(ARROW.thick));
  const shareArrow = solidArrow(kit, COLORS.ink, pulls, mm(ARROW.thick));
  const zeroHead = surface(kit, new THREE.TorusGeometry(mm(4), mm(.5), 12, 48), 'blue', pulls);
  zeroHead.scale.y = 1.4; // A zero glyph for the free-fall approximation, not a force arrow.

  control('ball', 'Ball', ...BALLPOINT_DOMAINS.ball, BALLPOINT_DEFAULTS.ball, 'mm', 'Selected ball diameters. Fine and broad labels vary between manufacturers.', BALL_OPTIONS.map(option => ({...option})));
  control('place', 'Where you write', ...BALLPOINT_DOMAINS.place, BALLPOINT_DEFAULTS.place, '', 'Which way the pen points while it writes.', PLACE_OPTIONS.map(option => ({...option})));
  control('refill', 'Refill', ...BALLPOINT_DOMAINS.refill, BALLPOINT_DEFAULTS.refill, '', 'An ordinary refill open at the back, or a sealed one pressurized with nitrogen.', REFILL_OPTIONS.map(option => ({...option})));

  control('condition', 'Starting condition', ...BALLPOINT_DOMAINS.condition, BALLPOINT_DEFAULTS.condition, '', 'Choose an already inked ball, a deliberately clean ball, or a blocked feed with ink still on the ball. The model does not predict clogging or the time to failure upside down.', CONDITION_OPTIONS.map(option => ({...option})));

  // What changes only with the settings: the socket fitted to the ball.
  let drawnBall = null;
  const fitSocket = radius => {
    if (radius === drawnBall) return;
    drawnBall = radius;
    for (const mesh of [socket, collar, channelInk]) mesh.geometry.dispose();
    socket.geometry = new THREE.LatheGeometry(SOCKET_PROFILE.map(([x, y]) => new THREE.Vector2(mm(x * radius), mm((y + 1) * radius))), 48, Math.PI / 2, Math.PI);
    const low = 2.7 * radius, outer = BALLPOINT.boreRadius + REFILL.wall;
    collar.geometry = new THREE.LatheGeometry([[.4 * radius, low], [BALLPOINT.boreRadius, REFILL.socket], [outer, REFILL.socket], [.95 * radius, low], [.4 * radius, low]].map(([x,y]) => new THREE.Vector2(mm(x),mm(y))), 40, Math.PI / 2, Math.PI);
    channelInk.geometry = new THREE.LatheGeometry([[0, 2 * radius], [.4 * radius, 2 * radius], [.4 * radius, low], [BALLPOINT.boreRadius, REFILL.socket], [0, REFILL.socket]].map(([x,y]) => new THREE.Vector2(mm(x),mm(y))), 40);
    setRod(channelBlock, .4 * radius, 2.1 * radius, 2.5 * radius);

  };

  let clock = 0, lastClock = 0, disposed = false;
  const result = finish(values => {
    const plan = ballpointPlan(values), now = ballpointAt(plan, clock), v = plan.values, place = plan.place;
    const radius = plan.ball / 2, angle = (place.angle ?? 0) * Math.PI / 180;

    // The pen's frame turned to where it writes, and the pen at the end of its travel.
    setup.rotation.z = angle;
    carriage.position.set(mm(now.travel), 0, 0);
    ball.position.set(0, mm(radius), 0);
    ball.scale.setScalar(mm(radius));
    ball.rotation.z = -now.turn;
    fitSocket(radius);

    // The refill: its tube, its ink, and the float and nitrogen of a pressurized one.
    const top = REFILL.socket + REFILL.length, pulledBack = 0;
    channelInk.visible = plan.feeds; channelBlock.visible = !plan.feeds;
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
    setBox(line, [now.lineStart, now.lineEnd], [0, FILM], [-half, half]);
    line.visible = now.line > 0;

    // The ball close up: turning with the pen's ball, ink on the dots that carry it.
    const R = DETAIL * radius;
    bigBall.scale.setScalar(big(radius));
    bigBall.rotation.z = -now.turn;
    specks.forEach((speck, i) => { speck.material = speckInked(speckAlong(i, now.turn), now.travel, radius, plan.feeds, plan.primed) ? inkMaterial : cleanMaterial; });
    bigSocket.scale.setScalar(big(radius));
    setRod(bigInk, 0.4 * R, 1.0 * R, 1.7 * R);
    setRod(bigBlock, .4 * R, 1.1 * R, 1.5 * R); bigBlock.visible = !plan.feeds;
    bigInk.visible = plan.feeds;
    setBox(bigPaper, [-3 * R, 3 * R], [-R - 0.06 * R, -R], [-1.5 * R, 1.5 * R]);
    const end = Math.min(0, DETAIL * (now.lineEnd - now.travel)), start = Math.max(-3 * R, DETAIL * (now.lineStart - now.travel)), drawnLine = Math.max(0, end - start);
    setBox(bigLine, [start, Math.max(start, end)], [-R, -R + 0.02 * R], [-LINE_SHARE * R, LINE_SHARE * R]);
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

    zeroHead.visible = !weighs; zeroHead.position.set(mm(middle[0]), mm(middle[1]), 0);

    const placeName = ['on a desk', 'on a wall', 'on the ceiling', 'in orbit'][v.place];
    const status = clock <= 0 ? `Ready · ${fixed(plan.ball, 2)} mm ball ${placeName}; press Play`
      : now.done ? `Stroke complete · ${fixed(now.line, 3)} mm of ink, ${fixed(now.turns, 2)} turns`
      : now.wetContact ? `Writing · ${fixed(now.line, 3)} mm of ink` : `Rolling dry · ${fixed(now.line, 3)} mm of ink left on paper`;
    const weightText = ['Toward the ball', 'No component along the refill', 'Away from the ball', 'Neglected in free fall'][v.place];
    return {
      state: {...plan, now, clock, angle, pulledBack, middle, beside, along, shareLength, weighs},
      readings: [
        r('Your result', status),
        r('Ball rotation', `${fixed(now.turns, 2)} turns · ${fixed(now.travel, 1)} mm traveled`, `Ideal rolling: one turn per π × diameter, or ${fixed(plan.circumference, 3)} mm. The selected ball makes ${fixed(plan.turns, 2)} turns in a 50 mm stroke.`),
        r('Ink on paper', `${fixed(now.line, 3)} mm`, plan.primed ? plan.feeds ? 'The primed ball starts writing immediately. No mandatory blank half-turn is imposed.' : `The blocked feed cannot replace the starting film. In this schematic, that film writes only the first ${fixed(plan.delay, 3)} mm.` : `The deliberately clean ball writes after ${fixed(plan.delay, 3)} mm, half a turn. This is a chosen starting condition, not a prediction for a ready-to-use pen.`),
        r('Ink channel', plan.feeds ? 'Open · ink reaches the ball' : 'Blocked · no replacement ink', 'Blue dots trace an ideal top-to-bottom film path. Real ink wets a finite area in the socket; neither wetting nor flow resistance is calculated.'),
        r('Gravity along refill', `${weightText} · ${fixed(plan.head, 1)} Pa`, place.angle === null ? 'The spacecraft, pen and ink fall together. Earth’s gravity has not disappeared. This model neglects the hydrostatic head in that frame.' : 'A 60 mm column at an assigned density of 1,000 kg/m³ gives ρgh cos θ. This hydrostatic contribution alone does not decide whether a pen writes or when air enters.'),
        r('Refill pressure', plan.pressurized ? `${fixed(plan.gasPressure / 1000, 0)} kPa added gauge pressure` : 'Vented · no added gas pressure', `Combined gas and hydrostatic contribution: ${fixed(now.feedPressure / 1000, 3)} kPa. Gas pressure is an assigned comparison, not a commercial cartridge rating. Capillary pressure, viscosity, air entry and a blocked channel’s stress are not solved.`),
      ],
    };

  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), Number((clock + dt).toFixed(12))); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = (initial = {}) => { clock = Number.isFinite(initial.time) ? Math.min(BALLPOINT.line / BALLPOINT.speed, Math.max(0, initial.time)) : 0; lastClock = 0; return render({...result.defaults, ...(initial.settings || {})}); };
  result.replayState = () => ({settings: result.getState().values, time: 0});
  result.actions = [['Inspect: complete pen', 'system'], ['Inspect: barrel', 'barrel'], ['Inspect: reservoir and gas chamber', 'refill'], ['Inspect: working tip', 'tip'], ['Inspect: enlarged ball', 'ball'], ['Inspect: paper and line', 'paper'], ['Inspect: gravity arrows', 'pulls']].map(([label, part]) => ({label, part, view: part === 'paper' ? 'top' : 'front', isolate: true, replay: false, run: () => render()}));

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

  kit.root.rotation.set(0, 0, 0);
  result.covers.push(bodyFront, noseFront); result.initialCutaway = true;
  result.catalogParts = result.parts.filter(p => p.id !== 'system');
  result.controls.find(c => c.key === 'condition').primary = true;
  result.controls.find(c => c.key === 'refill').primary = true;
  result.partViewDirections = Object.fromEntries(result.parts.map(p => [p.id, {front: [0, .35, 3]}]));
  result.partViewDirections.ball.front = [0, 0, 3];
  result.parts.find(p => p.id === 'tip').maxZoom = 300;
  for (const object of [paper, detail, pulls]) object.userData.explosionExcluded = true;
  for (const object of [barrel, refill, tip]) object.userData.explosionCategory = true;
  result.thumbnailOmit = [paper, detail, pulls];
  result.followParts = ['barrel', 'refill', 'tip', 'pulls'];
  result.frameBoundsForPart = id => {
    const current = result.getState(), a = (current.place.angle ?? 0) * Math.PI / 180;
    const bounds = new THREE.Box3(new THREE.Vector3(-.535, -.025, -.21), new THREE.Vector3(.66, 1.075, .21)).applyMatrix4(new THREE.Matrix4().makeRotationZ(a));
    if (id === 'system') { const R = current.ball / 2 * MM * DETAIL; bounds.union(new THREE.Box3(new THREE.Vector3(-3 * R, -1.1 * R, -1.5 * R), new THREE.Vector3(3 * R, 1.7 * R, 1.5 * R)).translate(new THREE.Vector3(...DETAIL_ORIGIN))); return bounds.applyMatrix4(kit.root.matrixWorld); }
    return null;
  };
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, setup, carriage, barrel, bodyBack, bodyFront, noseBack, noseFront, rearPlug, tip, collar, channelInk, channelBlock, bigBlock, paper, sheet, line, inkMaterial, refill, pen, ball, socket, tube, ink, float, gas, seal, detail, bigBall, bigSphere, specks, cleanMaterial, bigSocket, bigInk, bigPaper, bigLine, pulls, weightArrow, shareArrow, zeroHead};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

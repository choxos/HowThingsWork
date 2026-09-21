import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, surface} from './scene-kit.js';
import {readPlan, readAt, layoutOf, spinRate, FORMATS, READ, FORMAT_OPTIONS, DEPTH_OPTIONS, READ_DEFAULTS, READ_DOMAINS} from './optical-physics.js';

// ---------------------------------------------------------------------------
// Blu-ray player: a disc turning over its laser pickup, with the pickup's
// optics opened out, the spot on the track close up, the light it sends back,
// a pit cut open, and how fast the disc turns across its radius. The same
// model reads a CD and a DVD.
//
// Scale: the disc, its spindle and the sled's rails are drawn at true size,
// 1 mm to 0.01 scene units, tipped toward the viewer so the side the laser
// reads faces out; the sled and its lens are illustrative in size. The spiral
// is drawn with 24 turns for the 20,625 a CD's track makes, 45,946 on a DVD
// and 106,250 on a Blu-ray Disc. The track close up is drawn 10,000 times
// larger, pits, spot and track pitch alike, 1 nm to 0.0001 units. The pit cut
// open is drawn 100,000 times larger, 1 nm to 0.001 units. The pickup is a
// diagram, except its cone of light and the plastic above the lens, drawn 40
// times larger at their true angles and thicknesses. The charts are not to
// scale.
//
// Time: two clocks, both slowed, and each said so in the part text and a
// reading. The track passes the spot at 10 channel bits a second: 432,180
// times slower than a CD plays, 2,615,625 times slower than a DVD and
// 6,600,000 times slower than a Blu-ray Disc. The disc drawn turns 100 times
// slower than the disc does.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const CLOSE = 1e-4;
export const CUT = 1e-3;
export const DIAGRAM = 0.4;
export const SPIRAL_TURNS = 24;
export const SPIRAL_STEPS = 72;
export const PIT_ROOM = 480;

/** The deck, mm: the disc's hole, radius and thickness, the hub and motor, the gap from lens to disc, the sled, its lens and the laser's glow, the rails, and the stripe on the disc. */
export const DECK = Object.freeze({origin: Object.freeze([0, 0.35, 0]), tilt: -0.9, hole: 7.5, radius: 60, thick: 1.2, hub: 8, hubTall: 3, motor: 10, motorTall: 12, gap: 2, sled: Object.freeze([24, 8, 16]), lens: 2.5, lensTall: 1.5, glow: 0.8, rail: 0.8, railFrom: 15, railTo: 66, railSide: 10, stripe: Object.freeze([14, 23])});
export const TRACK = Object.freeze({origin: Object.freeze([1.5, 0.42, 0]), lift: 0.03});
export const SIGNAL = Object.freeze({x: 1.1, y: -0.42, w: 0.8, h: 0.35, z: 0, tick: 0.025, gap: 0.01, cursor: 0.02});

/** The pit cut open, nm: the plastic's height, the half width, the metal, the bump's half width, where the waves climb, their spacing and size, and the strip of returning waves below. */
export const CUTAWAY = Object.freeze({origin: Object.freeze([2.5, 0.2, 0]), plastic: 600, half: 350, metal: 40, bump: 150, land: -290, bumpRay: -35, gap: 70, amp: 30, below: 90, strip: 300, stripX: Object.freeze([-220, 0, 220]), points: 64, thick: 20});
export const SPIN = Object.freeze({x: -1.85, y: -0.25, w: 0.8, h: 0.6, z: 0, radii: Object.freeze([20, 60]), rpm: Object.freeze([0, 2000]), radiusTick: 10, rpmTick: 500, tick: 0.02, cursor: 0.025, points: 41});

/** The pickup diagram, scene units: heights of its parts along the beam, the lens's air gap, the return branch, glass thickness and the plastic's width. */
export const PICKUP = Object.freeze({origin: Object.freeze([0, -1.35, 0]), air: 0.06, laser: -0.95, collimator: -0.8, splitter: -0.5, plate: -0.18, lens: 0, astigmatic: 0.4, detector: 0.62, glass: 0.02, margin: 0.015, width: 0.9, layer: 0.006, depth: 0.12, cell: 0.03});
export const COLORS = Object.freeze({lasers: Object.freeze([0x9b2d2d, 0xd8453a, 0x6b4fc8]), disc: 0xc9d1d3, data: 0xa7b6c8, land: 0xc5cdd2, pit: 0x7d8a92, plastic: 0xd7e7ef, backing: 0xc3d5de, chart: 0x374736, faint: 0x9aa39a, wave: 0x2b5d9c});

/** A length for a reading. */
export const lengthText = nm => (nm < 1000 ? `${fixed(nm, 0)} nm` : `${fixed(nm / 1000, Number.isInteger(nm / 100) ? 1 : 2)} μm`);

/** Where a point `s` channel bits along the ladder, and a share of the land's light, fall on the chart. */
export const signalX = (plan, s) => SIGNAL.x + Math.max(0, Math.min(1, s / plan.layout.length)) * SIGNAL.w;
export const signalY = light => SIGNAL.y + Math.max(0, Math.min(1, light)) * SIGNAL.h;

/** Where a radius, mm, and a spin rate, rpm, fall on the spin chart. */
export const spinX = radius => SPIN.x + (radius - SPIN.radii[0]) / (SPIN.radii[1] - SPIN.radii[0]) * SPIN.w;
export const spinY = rpm => SPIN.y + Math.max(0, Math.min(1, (rpm - SPIN.rpm[0]) / (SPIN.rpm[1] - SPIN.rpm[0]))) * SPIN.h;

/**
 * A point on the drawn spiral, mm in the disc's frame, `turn` turns from its
 * inner end. Seen from the laser below, the disc turns counterclockwise and the
 * track spirals outward (ECMA-130 11.2), so a turn adds to the angle
 * atan2(−z, x) that the disc's turning carries past the spot.
 */
export function spiralPoint(format, turn) {
  const radius = format.inner + (format.outer - format.inner) * turn / SPIRAL_TURNS, psi = 2 * Math.PI * turn;
  return [radius * Math.cos(psi), -DECK.thick / 2 - 0.02, -radius * Math.sin(psi)];
}

/** The pits in the close up with the spot `travel` channel bits along: [x0, x1, y0, y1], nm about the spot, clipped to the close up. */
export function pitBoxes(plan, travel) {
  const boxes = [], half = plan.pitWidth / 2;
  for (const row of plan.layout.rows) {
    for (const [start, end] of row.pits) {
      const x0 = Math.max(-READ.halfWindow, (start - travel) * plan.bit), x1 = Math.min(READ.halfWindow, (end - travel) * plan.bit);
      if (x1 > x0) boxes.push([x0, x1, row.offset - half, row.offset + half]);
    }
  }
  return boxes;
}

/** The pickup's cone for a disc, diagram units: the plastic under the data and behind it, where the cone enters the plastic, the lens's radius, and heights of the plastic's surface, the focus and the top. */
export function coneLayout(plan) {
  const cover = plan.format.cover * DIAGRAM, backing = plan.format.backing * DIAGRAM;
  const entry = cover * Math.tan(plan.coneInside), lens = entry + PICKUP.air * Math.tan(plan.cone), surfaceY = PICKUP.lens + PICKUP.air;
  return {cover, backing, entry, lens, surface: surfaceY, focus: surfaceY + cover, top: surfaceY + cover + backing};
}

/** A wave's sideways offset in the cutaway, nm, after `path` nm through the plastic. */
export const waveOffset = (plan, path) => CUTAWAY.amp * Math.sin(2 * Math.PI * path / plan.wavelengthInside);

/**
 * The cutaway's waves, [x, y] nm with the land at y = 0 and the plastic below:
 * climbing to the land and back, climbing to the bump and back, and below the
 * plastic the land's returning wave, the bump's, and their average.
 */
export function cutawayWaves(plan) {
  const P = CUTAWAY.plastic, d = plan.depthNm, n = CUTAWAY.points;
  const along = (y0, y1, x, path) => Array.from({length: n}, (_, i) => { const y = y0 + (y1 - y0) * i / (n - 1); return [x + waveOffset(plan, path(y)), y]; });
  const top = -P - CUTAWAY.below, bottom = top - CUTAWAY.strip, landPath = y => P - y, bumpPath = y => (P - d) + (-d - y);
  return {
    landIn: along(-P, 0, CUTAWAY.land, y => y + P),
    landOut: along(0, -P, CUTAWAY.land + CUTAWAY.gap, landPath),
    bumpIn: along(-P, -d, CUTAWAY.bumpRay, y => y + P),
    bumpOut: along(-d, -P, CUTAWAY.bumpRay + CUTAWAY.gap, bumpPath),
    landBack: along(top, bottom, CUTAWAY.stripX[0], landPath),
    bumpBack: along(top, bottom, CUTAWAY.stripX[1], bumpPath),
    sum: Array.from({length: n}, (_, i) => { const y = top + (bottom - top) * i / (n - 1); return [CUTAWAY.stripX[2] + (waveOffset(plan, landPath(y)) + waveOffset(plan, bumpPath(y))) / 2, y]; }),
  };
}

const FACE_NORMALS = [[0, 0, 1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];

/** Room for `count` boxes, each its front, top, bottom and two ends; drawn with setDrawRange. */
function pitBuffer(count) {
  const geometry = new THREE.BufferGeometry(), positions = new Float32Array(count * 60), normals = new Float32Array(count * 60), index = new Uint16Array(count * 30);
  for (let b = 0; b < count; b++) {
    for (let f = 0; f < 5; f++) {
      const o = b * 20 + f * 4;
      for (let v = 0; v < 4; v++) normals.set(FACE_NORMALS[f], (o + v) * 3);
      index.set([o, o + 1, o + 2, o, o + 2, o + 3], b * 30 + f * 6);
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setDrawRange(0, 0);
  return geometry;
}

/** Box `b`: x0 to x1, y0 to y1, and from z = 0 up to z1. */
function writeBox(array, b, x0, x1, y0, y1, z1) {
  array.set([
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
    x0, y1, z1, x1, y1, z1, x1, y1, 0, x0, y1, 0,
    x0, y0, 0, x1, y0, 0, x1, y0, z1, x0, y0, z1,
    x1, y0, z1, x1, y0, 0, x1, y1, 0, x1, y1, z1,
    x0, y0, 0, x0, y0, z1, x0, y1, z1, x0, y1, 0,
  ], b * 60);
}

export function createBluRayModel() {
  const kit = houseModel('Blu-ray player'), {part, control, finish} = kit;
  const mm = value => value * MM;
  let clock = 0, lastClock = 0, disposed = false, shownFormat = -1;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const block = (color, parent) => surface(kit, new THREE.BoxGeometry(1, 1, 1), color, parent);
  const drum = (color, parent) => surface(kit, new THREE.CylinderGeometry(1, 1, 1, 48), color, parent);
  const place = (mesh, [x, y, z], [sx, sy, sz]) => { mesh.position.set(x, y, z); mesh.scale.set(Math.max(1e-9, sx), Math.max(1e-9, sy), Math.max(1e-9, sz)); };

  const system = part('system', 'Blu-ray player, its pickup and close ups', `A disc turning over its laser pickup at true size, with the pickup's optics opened out, the spot on the track close up, the light the spot sends back, a pit cut open and how fast the disc turns across its radius. Choose a CD, a DVD or a Blu-ray Disc. The track passes the spot at ${READ.bitsPerSecond} channel bits a second, and the disc drawn turns ${READ.spin} times slower than a disc does.`);

  // The deck: the disc, tipped so the side the laser reads faces out, and the sled under it.
  const deck = new THREE.Group();
  deck.position.set(...DECK.origin);
  deck.rotation.x = DECK.tilt;
  system.add(deck);
  const disc = part('disc', 'Disc, spindle and sled', `A 120 mm disc and the sled under it, drawn at true size and tipped toward you so the side the laser reads faces out. The sled carries the lens along the disc's radius. The spiral is drawn with ${SPIRAL_TURNS} turns for the tens of thousands the track really makes, and the disc drawn turns ${READ.spin} times slower than a disc does.`, [0, 0, 0], deck);
  const spinner = new THREE.Group();
  disc.add(spinner);
  const profile = [[DECK.hole, -DECK.thick / 2], [DECK.radius, -DECK.thick / 2], [DECK.radius, DECK.thick / 2], [DECK.hole, DECK.thick / 2], [DECK.hole, -DECK.thick / 2]];
  const body = surface(kit, new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(mm(x), mm(y))), 96), COLORS.disc, spinner, true);
  const dataZone = surface(kit, new THREE.RingGeometry(mm(24), mm(58), 96), COLORS.data, spinner, true);
  dataZone.rotation.x = Math.PI / 2;
  dataZone.position.y = mm(-DECK.thick / 2 - 0.01);
  const spiral = lineObject(SPIRAL_TURNS * SPIRAL_STEPS + 1, COLORS.faint, spinner);
  const stripe = kit.box([mm(DECK.stripe[1] - DECK.stripe[0]), mm(0.2), mm(1.5)], [mm(-(DECK.stripe[0] + DECK.stripe[1]) / 2), mm(-DECK.thick / 2 - 0.1), 0], 'ink', spinner);
  kit.cylinder(mm(DECK.hub), mm(DECK.hubTall), [0, mm(-DECK.thick / 2 - DECK.hubTall / 2), 0], 'metal', spinner);
  kit.cylinder(mm(DECK.motor), mm(DECK.motorTall), [0, mm(-DECK.thick / 2 - DECK.hubTall - DECK.motorTall / 2), 0], 'ink', disc);
  const lensY = -DECK.thick / 2 - DECK.gap - DECK.lensTall / 2, sledY = lensY - DECK.lensTall / 2 - DECK.sled[1] / 2;
  const sled = new THREE.Group();
  disc.add(sled);
  kit.box(DECK.sled.map(mm), [0, mm(sledY), 0], 'clay', sled);
  kit.cylinder(mm(DECK.lens), mm(DECK.lensTall), [0, mm(lensY), 0], 'blue', sled);
  const beam = segmentLines(1, COLORS.lasers[2], sled);
  fillLine(beam, [[0, mm(lensY + DECK.lensTall / 2), 0], [0, mm(-DECK.thick / 2), 0]]);
  const glow = kit.sphere(mm(DECK.glow), [0, mm(-DECK.thick / 2), 0], 'red', sled);
  glow.material = unlit(COLORS.lasers[2]);
  for (const side of [-1, 1]) kit.rod([mm(DECK.railFrom), mm(sledY), mm(side * DECK.railSide)], [mm(DECK.railTo), mm(sledY), mm(side * DECK.railSide)], mm(DECK.rail), 'metal', disc);

  // The spot on the track, 10,000 times larger.
  const track = part('track', 'Spot on the track, close up', `The track as the laser sees it, drawn 10,000 times larger: pits rise toward you as bumps, tracks lie one pitch apart, and the spot is drawn out to its first dark ring, with a line at its second. The track under the spot runs through a ladder of every run length the disc's code allows, shortest first; the runs around it are drawn at random within the code's limits, and pits are drawn 5/16 of a pitch wide. The track passes at ${READ.bitsPerSecond} channel bits a second, far slower than any disc plays.`, TRACK.origin, system);
  const land = surface(kit, new THREE.PlaneGeometry(2 * READ.halfWindow * CLOSE, 2 * READ.halfAcross * CLOSE), COLORS.land, track);
  const pitGeometry = pitBuffer(PIT_ROOM), pits = surface(kit, pitGeometry, COLORS.pit, track);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 64), unlit(COLORS.lasers[2], {transparent: true, opacity: 0.45, depthWrite: false}));
  spot.position.z = TRACK.lift;
  track.add(spot);
  const ring = lineObject(65, COLORS.lasers[2], track);
  const trackFrame = lineObject(5, COLORS.chart, track);
  const [hw, hh] = [READ.halfWindow * CLOSE, READ.halfAcross * CLOSE];
  fillLine(trackFrame, [[-hw, -hh, TRACK.lift], [hw, -hh, TRACK.lift], [hw, hh, TRACK.lift], [-hw, hh, TRACK.lift], [-hw, -hh, TRACK.lift]]);

  // The light sent back, over the whole ladder.
  const signal = part('signal', 'Light sent back', 'How much light the spot sends back along the ladder, from none at the bottom to all the land sends at the top: faint for the whole ladder, dark as far as the spot has read. Across: the whole ladder, the shortest runs on the left. A tick below marks every pit edge, where a channel bit reads one. The faint line is how far a long pit dims the light at this depth. Illustrative: the pits blurred by the lens along the track, with their width and the neighboring tracks left out.', [0, 0, 0], system);
  const signalFrame = lineObject(5, COLORS.chart, signal);
  fillLine(signalFrame, [[SIGNAL.x, SIGNAL.y, SIGNAL.z], [SIGNAL.x + SIGNAL.w, SIGNAL.y, SIGNAL.z], [SIGNAL.x + SIGNAL.w, SIGNAL.y + SIGNAL.h, SIGNAL.z], [SIGNAL.x, SIGNAL.y + SIGNAL.h, SIGNAL.z], [SIGNAL.x, SIGNAL.y, SIGNAL.z]]);
  const levelLine = segmentLines(1, COLORS.faint, signal);
  const signalRoom = Math.max(...FORMATS.map((_, i) => layoutOf(i).blur.length)) + 1, edgeRoom = Math.max(...FORMATS.map((_, i) => layoutOf(i).edges.length));
  const signalGuide = lineObject(signalRoom, COLORS.faint, signal);
  const signalCurve = lineObject(signalRoom, COLORS.wave, signal);
  const edgeTicks = segmentLines(edgeRoom, COLORS.chart, signal);
  const signalCursor = segmentLines(2, COLORS.chart, signal);

  // A pit cut open, 100,000 times larger.
  const cutaway = part('pit', 'A pit, cut open', 'A pit and the land beside it cut open and drawn 100,000 times larger, the disc\'s plastic below and its metal above. Seen from the laser the pit is a bump. Two waves of the laser\'s light climb through the plastic, one to the land and one to the bump, and come back down. Below, the two returning waves side by side and their average, whose swing is how much light comes back.', CUTAWAY.origin, system);
  const plastic = surface(kit, new THREE.PlaneGeometry(2 * CUTAWAY.half * CUT, CUTAWAY.plastic * CUT), COLORS.plastic, cutaway);
  plastic.position.set(0, -CUTAWAY.plastic / 2 * CUT, -CUTAWAY.thick * CUT);
  const metal = block('metal', cutaway);
  place(metal, [0, CUTAWAY.metal / 2 * CUT, 0], [2 * CUTAWAY.half * CUT, CUTAWAY.metal * CUT, CUTAWAY.thick * CUT]);
  const bump = block('metal', cutaway);
  const waveNames = ['landIn', 'landOut', 'bumpIn', 'bumpOut', 'landBack', 'bumpBack', 'sum'];
  const waves = Object.fromEntries(waveNames.map(name => [name, lineObject(CUTAWAY.points, name === 'sum' ? COLORS.chart : COLORS.lasers[2], cutaway)]));

  // How fast the disc turns across its radius.
  const spin = part('spin', 'Spin speed across the disc', `How fast each disc turns to keep its track passing the spot at the same speed: from ${SPIN.radii[0]} mm to ${SPIN.radii[1]} mm across and from 0 to 2,000 rpm up, over each disc's data. Dark: the disc chosen. The cross marks the read position.`, [0, 0, 0], system);
  const spinFrame = lineObject(5, COLORS.chart, spin);
  fillLine(spinFrame, [[SPIN.x, SPIN.y, SPIN.z], [SPIN.x + SPIN.w, SPIN.y, SPIN.z], [SPIN.x + SPIN.w, SPIN.y + SPIN.h, SPIN.z], [SPIN.x, SPIN.y + SPIN.h, SPIN.z], [SPIN.x, SPIN.y, SPIN.z]]);
  const spinTicks = segmentLines(8, COLORS.faint, spin), tickPoints = [];
  for (let radius = SPIN.radii[0] + SPIN.radiusTick; radius < SPIN.radii[1]; radius += SPIN.radiusTick) tickPoints.push([spinX(radius), SPIN.y, SPIN.z], [spinX(radius), SPIN.y - SPIN.tick, SPIN.z]);
  for (let rpm = SPIN.rpm[0] + SPIN.rpmTick; rpm < SPIN.rpm[1]; rpm += SPIN.rpmTick) tickPoints.push([SPIN.x, spinY(rpm), SPIN.z], [SPIN.x - SPIN.tick, spinY(rpm), SPIN.z]);
  fillLine(spinTicks, tickPoints);
  const spinCurves = FORMATS.map(format => {
    const curve = lineObject(SPIN.points, COLORS.faint, spin);
    fillLine(curve, Array.from({length: SPIN.points}, (_, i) => { const radius = format.inner + (format.outer - format.inner) * i / (SPIN.points - 1); return [spinX(radius), spinY(spinRate(format, radius)), SPIN.z]; }));
    return curve;
  });
  const spinCursor = segmentLines(2, COLORS.chart, spin);

  // The pickup, opened out as a diagram.
  const pickup = part('pickup', 'Laser pickup, opened out', 'The pickup as a diagram: a laser diode, a collimating lens, a polarizing beam splitter, a quarter-wave plate and the objective lens focusing the light into the disc. The light coming back turns aside at the beam splitter to a lens and a photodetector in four parts. The cone of light and the disc\'s plastic above the lens are drawn 40 times larger, at their true angles and thicknesses.', PICKUP.origin, system);
  const laser = block('ink', pickup);
  place(laser, [0, PICKUP.laser, 0], [0.08, 0.06, 0.06]);
  const collimator = drum('blue', pickup), splitter = block('blue', pickup), diagonal = block('metal', pickup), plate = block('cream', pickup), objective = drum('blue', pickup);
  const cover = surface(kit, new THREE.BoxGeometry(1, 1, 1), COLORS.plastic, pickup), backing = surface(kit, new THREE.BoxGeometry(1, 1, 1), COLORS.backing, pickup), layer = block('metal', pickup);
  const astigmatic = drum('blue', pickup);
  astigmatic.rotation.z = Math.PI / 2;
  const cells = [-1, 1].flatMap(dy => [-1, 1].map(dz => { const cell = block('ink', pickup); place(cell, [PICKUP.detector, PICKUP.splitter + dy * PICKUP.cell / 2, dz * PICKUP.cell / 2], [0.01, PICKUP.cell * 0.9, PICKUP.cell * 0.9]); return cell; }));
  const pickupBeam = segmentLines(12, COLORS.lasers[2], pickup);

  control('format', 'Disc', READ_DOMAINS.format[0], READ_DOMAINS.format[1], READ_DOMAINS.format[2], READ_DEFAULTS.format, '', 'A CD, a DVD or a Blu-ray Disc: each has its own laser, lens, track pitch, speed and code.', FORMAT_OPTIONS);
  control('radius', 'Read position', READ_DOMAINS.radius[0], READ_DOMAINS.radius[1], READ_DOMAINS.radius[2], READ_DEFAULTS.radius, 'mm', 'How far from the center the pickup reads. Farther out the disc turns more slowly, so the track still passes at the same speed.');
  control('depth', 'Pit depth', READ_DOMAINS.depth[0], READ_DOMAINS.depth[1], READ_DOMAINS.depth[2], READ_DEFAULTS.depth, '', 'How deep the pits are, as a share of the laser light\'s wavelength inside the plastic.', DEPTH_OPTIONS);

  const result = finish(v => {
    const plan = readPlan(v), now = readAt(plan, clock), format = plan.format, color = COLORS.lasers[plan.index];

    // What changes only with the disc: its data zone, spiral and laser.
    if (shownFormat !== plan.index) {
      shownFormat = plan.index;
      dataZone.geometry.dispose();
      dataZone.geometry = new THREE.RingGeometry(mm(format.inner), mm(format.outer), 96);
      fillLine(spiral, Array.from({length: SPIRAL_TURNS * SPIRAL_STEPS + 1}, (_, i) => spiralPoint(format, i / SPIRAL_STEPS).map(mm)));
      for (const material of [beam.material, glow.material, spot.material, ring.material, pickupBeam.material, ...['landIn', 'landOut', 'bumpIn', 'bumpOut', 'landBack', 'bumpBack'].map(name => waves[name].material)]) material.color.setHex(color);
      spinCurves.forEach((curve, i) => curve.material.color.setHex(i === plan.index ? COLORS.chart : COLORS.faint));
    }

    // The disc turns, slowed; the sled sits at the read position.
    spinner.rotation.y = -now.angle;
    sled.position.x = mm(plan.radius);

    // The track close up.
    const boxes = pitBoxes(plan, now.travel), shown = Math.min(boxes.length, PIT_ROOM), array = pitGeometry.attributes.position.array, height = plan.depthNm * CLOSE;
    for (let b = 0; b < shown; b++) { const [x0, x1, y0, y1] = boxes[b]; writeBox(array, b, x0 * CLOSE, x1 * CLOSE, y0 * CLOSE, y1 * CLOSE, height); }
    pitGeometry.setDrawRange(0, shown * 30);
    pitGeometry.attributes.position.needsUpdate = true;
    pitGeometry.boundingBox = null;
    pitGeometry.boundingSphere = null;
    spot.scale.setScalar(plan.spot / 2 * CLOSE);
    fillLine(ring, Array.from({length: 65}, (_, i) => { const a = 2 * Math.PI * i / 64; return [plan.ring * CLOSE * Math.cos(a), plan.ring * CLOSE * Math.sin(a), TRACK.lift]; }));

    // The light sent back.
    const read = Math.floor(now.travel * READ.samples + 1e-9), points = [];
    for (let j = 0; j <= read && j < plan.layout.blur.length; j++) points.push([signalX(plan, j / READ.samples), signalY(1 - plan.dimming * plan.layout.blur[j]), SIGNAL.z]);
    if (clock > 0) points.push([signalX(plan, now.travel), signalY(now.light), SIGNAL.z]);
    fillLine(signalCurve, clock > 0 ? points : []);
    fillLine(levelLine, [[SIGNAL.x, signalY(plan.level), SIGNAL.z], [SIGNAL.x + SIGNAL.w, signalY(plan.level), SIGNAL.z]]);
    fillLine(signalGuide, Array.from(plan.layout.blur, (blur, j) => [signalX(plan, j / READ.samples), signalY(1 - plan.dimming * blur), SIGNAL.z]));
    fillLine(edgeTicks, plan.layout.edges.filter(edge => edge < now.travel).flatMap(edge => [[signalX(plan, edge), SIGNAL.y - SIGNAL.gap, SIGNAL.z], [signalX(plan, edge), SIGNAL.y - SIGNAL.gap - SIGNAL.tick, SIGNAL.z]]));
    const cx = signalX(plan, now.travel), cy = signalY(now.light);
    fillLine(signalCursor, [[cx - SIGNAL.cursor, cy, SIGNAL.z], [cx + SIGNAL.cursor, cy, SIGNAL.z], [cx, cy - SIGNAL.cursor, SIGNAL.z], [cx, cy + SIGNAL.cursor, SIGNAL.z]]);

    // The pit cut open.
    place(bump, [0, -plan.depthNm / 2 * CUT, 0], [2 * CUTAWAY.bump * CUT, plan.depthNm * CUT, CUTAWAY.thick * CUT]);
    const wave = cutawayWaves(plan);
    for (const name of waveNames) fillLine(waves[name], wave[name].map(([x, y]) => [x * CUT, y * CUT, CUTAWAY.thick * CUT]));

    // The spin chart's cursor.
    const sx = spinX(plan.radius), sy = spinY(plan.rpm);
    fillLine(spinCursor, [[sx - SPIN.cursor, sy, SPIN.z], [sx + SPIN.cursor, sy, SPIN.z], [sx, sy - SPIN.cursor, SPIN.z], [sx, sy + SPIN.cursor, SPIN.z]]);

    // The pickup diagram.
    const cone = coneLayout(plan), a = cone.lens, cube = 2 * a + 2 * PICKUP.margin;
    place(collimator, [0, PICKUP.collimator, 0], [a, PICKUP.glass, a]);
    place(splitter, [0, PICKUP.splitter, 0], [cube, cube, PICKUP.depth]);
    place(diagonal, [0, PICKUP.splitter, 0], [cube * Math.SQRT2, 0.006, PICKUP.depth * 1.02]);
    diagonal.rotation.z = Math.PI / 4;
    place(plate, [0, PICKUP.plate, 0], [cube, PICKUP.glass / 2, PICKUP.depth]);
    place(objective, [0, PICKUP.lens, 0], [a, 1.5 * PICKUP.glass, a]);
    place(cover, [0, cone.surface + cone.cover / 2, 0], [PICKUP.width, cone.cover, PICKUP.depth]);
    place(backing, [0, cone.focus + cone.backing / 2, 0], [PICKUP.width, cone.backing, PICKUP.depth]);
    backing.visible = cone.backing > 0;
    place(layer, [0, cone.focus, 0], [PICKUP.width, PICKUP.layer, PICKUP.depth * 1.02]);
    place(astigmatic, [PICKUP.astigmatic, PICKUP.splitter, 0], [a, PICKUP.glass, a]);
    const segments = [];
    for (const side of [-1, 1]) {
      segments.push([0, PICKUP.laser, 0], [side * a, PICKUP.collimator, 0]);
      segments.push([side * a, PICKUP.collimator, 0], [side * a, PICKUP.lens, 0]);
      segments.push([side * a, PICKUP.lens, 0], [side * cone.entry, cone.surface, 0]);
      segments.push([side * cone.entry, cone.surface, 0], [0, cone.focus, 0]);
      segments.push([0, PICKUP.splitter + side * a, 0], [PICKUP.astigmatic, PICKUP.splitter + side * a, 0]);
      segments.push([PICKUP.astigmatic, PICKUP.splitter + side * a, 0], [PICKUP.detector, PICKUP.splitter, 0]);
    }
    fillLine(pickupBeam, segments);

    // Readings.
    const L = plan.layout.length, depthName = plan.depth.label.toLowerCase(), wavesOut = ['half a wavelength', 'a third of a wavelength', 'a quarter of a wavelength', 'a whole wavelength'][v.depth];
    const status = clock <= 0 ? `Ready · a ${format.name} read ${fixed(plan.radius, 0)} mm out; press Play`
      : now.done ? `Read ${fixed(L, 0)} channel bits: a pit and a land of every length from ${fixed(format.shortest, 0)} to ${fixed(format.longest, 0)}`
      : `Reading · ${fixed(now.bits, 0)} of ${fixed(L, 0)} channel bits, a ${fixed(now.run.n, 0)} channel bit ${now.run.kind} under the spot`;
    const capacityText = plan.index === 0 ? `${fixed(plan.time / 60, 1)} minutes of music` : `${fixed(plan.time / 60, 1)} minutes to read, holding ${fixed(plan.capacity / 1e9, 2)} GB`;
    return {
      state: {...plan, now, clock, drawnCone: cone, boxes: shown, wave},
      readings: [
        r('Your result', status),
        r('Spot', `${lengthText(plan.spot)} across`, `A lens of numerical aperture ${fixed(format.aperture, 2)} focuses ${fixed(format.wavelength, 0)} nm light to a spot 1.22 λ/NA across to its first dark ring: ${lengthText(plan.spot)}. A pattern repeating finer than λ/(2NA), ${lengthText(plan.cutoff)}, sends nothing back. The close up is drawn 10,000 times larger.`),
        r('Track', `${lengthText(format.pitch)} apart; pits ${lengthText(plan.shortestRun)} to ${lengthText(plan.longestRun)} long`, `A channel bit is the ${fixed(format.velocity, [1, 2, 3][plan.index])} m/s the track passes at over the ${fixed(format.rate, 0)} channel bits read each second: ${fixed(plan.bit, 1)} nm. The code keeps every pit and land from ${fixed(format.shortest, 0)} to ${fixed(format.longest, 0)} channel bits long.`),
        r('Light back', clock <= 0 ? `${fixed(100 * plan.level, 0)}% in the middle of a long pit` : `${fixed(100 * now.light, 0)}% of what the land sends`, `Pits ${depthName} deep, ${fixed(plan.depthNm, 1)} nm, send light back ${wavesOut} out of step with the land around them, where the light's wavelength in the plastic is ${fixed(plan.wavelengthInside, 1)} nm. Two equal halves of the light that far out of step leave ${fixed(100 * plan.level, 0)}% of it.`),
        r('Spin', `${fixed(plan.rpm, 0)} rpm`, `To keep the track passing at the same speed, the disc turns 60 v / (2π r) times a minute: ${fixed(plan.rpm, 0)} rpm at ${fixed(plan.radius, 0)} mm and ${fixed(spinRate(format, 58), 0)} rpm at 58 mm. The disc drawn turns ${READ.spin} times slower.`),
        r('Slowed', `${fixed(plan.slow, 0)} times`, `The close up shows ${READ.bitsPerSecond} channel bits a second, and a ${format.name} is read at ${fixed(format.rate, 0)} a second, so its whole ladder of ${fixed(L, 0)} channel bits really passes in ${fixed(L / format.rate * 1e6, 2)} μs.`),
        r('Disc', `${fixed(plan.track / 1000, 2)} km of track`, `From ${fixed(format.inner, 0)} mm to ${fixed(format.outer, 0)} mm, ${lengthText(format.pitch)} apart, the spiral turns ${fixed(plan.turns, 0)} times and runs ${fixed(plan.track / 1000, 2)} km: ${capacityText}.`),
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
    {label: 'Inspect: the spot on the track', part: 'track', view: 'front', replay: false, run() { return inspect(duration() / 2); }},
    {label: 'Inspect: a pit cut open', part: 'pit', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: spin speed across the disc', part: 'spin', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the laser pickup', part: 'pickup', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Read',
    description: `The spot reads a ladder of every run length at ${READ.bitsPerSecond} channel bits a second.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'signal', label: 'Inspect the light sent back', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.06, -0.16, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, deck, disc, spinner, body, dataZone, spiral, stripe, sled, beam, glow, track, land, pits, spot, ring, signal, signalGuide, signalCurve, levelLine, edgeTicks, signalCursor, cutaway, plastic, metal, bump, waves, spin, spinCurves, spinCursor, pickup, laser, collimator, splitter, diagonal, plate, objective, cover, backing, layer, astigmatic, cells, pickupBeam};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

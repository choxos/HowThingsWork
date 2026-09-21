import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, solidArrow, surface} from './scene-kit.js';
import {staplerPlan, staplerAt, STAPLER, SHEET, LBF, PHASES, STAPLE_OPTIONS, ANVIL_OPTIONS, STAPLER_DEFAULTS, STAPLER_DOMAINS} from './stapler-physics.js';

// ---------------------------------------------------------------------------
// Stapler: a desktop stapler seen from the side, a cut across its nose drawn
// larger above it, and a chart of the push over one press.
//
// Scale: the stapler is drawn at true size, 1 mm to 0.01 scene units,
// measured from the hinge along the base (x), up from the anvil's face (y)
// and across the stapler (z). The cut across the nose is drawn 6 times
// larger, looking along the stapler from its front, with the staple's crown
// running left to right. The chart is not to any scale. Arrows: 0.3 mm for
// every newton, the hand's and the blade's on one scale.
//
// Time: the blade goes down at 4 mm a second, far slower than a real press.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const DETAIL = 6;
export const PER_NEWTON = 0.3;

/** The stapler's body, mm. The arm's top face and the magazine's bottom each pass through their own hinge pin. */
export const BODY = Object.freeze({
  base: Object.freeze({x0: -24, x1: 186, y0: -9, y1: -0.5, z: 19}),
  anvil: Object.freeze({x0: 148, x1: 172, y0: -2.5, y1: 0, z: 12}),
  post: Object.freeze({x0: -24, x1: 8, y1: 34, z: 16}),
  pin: 2.5,
  armPin: 27,
  magazinePin: STAPLER.gap,
  arm: Object.freeze({x0: -6, x1: 174, thick: 7, z: 14}),
  blade: Object.freeze({tall: 17.5, thick: 0.6}),
  magazine: Object.freeze({x0: -2, x1: 166, tall: 10, z: 9, wall: 1}),
  strip: Object.freeze({x0: 40, x1: 159.4}),
  pusher: Object.freeze({x0: 34, x1: 40, y0: 2, y1: 8, z: 5}),
  feed: Object.freeze({x0: 8, radius: 2.5, turns: 10}),
  paper: Object.freeze({x0: 150, x1: 232, z: 40}),
  returnSpring: Object.freeze({x: 60, radius: 3, turns: 6}),
  magazineSpring: Object.freeze({x: 110, radius: 3, turns: 6}),
  springWire: 0.35,
  arrow: 0.9,
  arrowZ: 22,
});

/** The cut across the nose, mm before the sixfold enlargement. The staple's wire lies in the cut's plane; the solids stand behind it, so the wire shows. */
export const CUT = Object.freeze({half: 17, anvil: 2.5, back: 4, front: 0.3, wall: 1, wallGap: 0.3, wallTall: 8, bladeTall: 6, groove: 0.35, grooveRun: 8, grooveMargin: 0.3, lineEvery: 10});
export const DETAIL_ORIGIN = Object.freeze([1.8, 0.62, 0]);

export const CHART = Object.freeze({x: -0.3, y: 0.62, w: 1.05, h: 0.8, z: -0.3, travel: 20, force: 300, travelTick: 5, forceTick: 50, tick: 0.02, cursor: 0.025});
export const COLORS = Object.freeze({blade: 0x5f7380, hand: 0xd9822b, ink: 0x374736, faint: 0x9aa39a, wire: 0x8d989c, crossed: 0xc14f39});

const clampTo = (value, top) => Math.max(0, Math.min(top, value));

/** The blade's top, mm above the anvil, a drop below rest. */
export const bladeTop = drop => STAPLER.gap + STAPLER.recess + STAPLER.longest + BODY.blade.tall - drop;

/** The slope of the arm's top face, front down, with the blade a drop below rest. */
export const armSlope = drop => (BODY.armPin - bladeTop(drop)) / STAPLER.blade;

/** The arm's top face, mm above the anvil, at a horizontal distance from the hinge. */
export const armY = (drop, x) => BODY.armPin - x * armSlope(drop);

/** The magazine's turn about its pin, radians front down, with its nose's front corner lowered by `lower` mm. */
export const magazineTurn = lower => Math.asin(lower / BODY.magazine.x1);

/** A point on the chart for a travel, mm, and a force, N, held inside the chart. */
export const chartPoint = (travel, force) => [CHART.x + clampTo(travel, CHART.travel) / CHART.travel * CHART.w, CHART.y + clampTo(force, CHART.force) / CHART.force * CHART.h, CHART.z];

/** A force profile cut where it crosses the top of the chart, so the drawn line keeps its slope. */
export function clipProfile(points) {
  const out = [];
  points.forEach((p, i) => {
    const q = points[i - 1];
    if (q && p.drop !== q.drop && (q.force - CHART.force) * (p.force - CHART.force) < 0) {
      const f = (CHART.force - q.force) / (p.force - q.force);
      out.push({drop: q.drop + f * (p.drop - q.drop), force: CHART.force});
    }
    out.push(p);
  });
  return out;
}

/**
 * The staple's wire as centerline segments, mm, in the staple's own plane:
 * across the crown (u) and up from the anvil's face (v). The crown first, then
 * each leg straight down, then the part folded along the back of the stack.
 */
export function stapleSegments(plan, now) {
  const crownV = now.crownTop - plan.wire / 2, legBottom = Math.max(now.crownTop - plan.leg, 0);
  const segments = [{from: [-plan.half, crownV], to: [plan.half, crownV]}];
  for (const side of [-1, 1]) {
    segments.push({from: [side * plan.half, crownV], to: [side * plan.half, legBottom]});
    segments.push({from: [side * plan.half, 0], to: [side * (plan.inward ? plan.half - now.reach : plan.half + now.reach), 0]});
  }
  return segments;
}

export function createStaplerModel() {
  const kit = houseModel('Stapler'), {root, part, control, finish} = kit;
  const mm = value => value * MM, cut = value => value * MM * DETAIL, Y = new THREE.Vector3(0, 1, 0);
  const block = (color, parent) => surface(kit, new THREE.BoxGeometry(1, 1, 1), color, parent);
  const setBox = (mesh, scale, [x0, x1], [y0, y1], [z0, z1]) => {
    mesh.position.set((x0 + x1) / 2 * scale, (y0 + y1) / 2 * scale, (z0 + z1) / 2 * scale);
    mesh.scale.set(Math.max(1e-9, (x1 - x0) * scale), Math.max(1e-9, (y1 - y0) * scale), Math.max(1e-9, (z1 - z0) * scale));
  };
  const paint = (mesh, color) => { mesh.material = mesh.material.clone(); mesh.material.color.set(color); return mesh; };
  const wireRod = (color, parent) => paint(kit.cylinder(1, 1, [0, 0, 0], 'metal', parent), color);
  const stretch = (mesh, a, b, radius) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), length = d.length();
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.scale.set(radius, Math.max(1e-9, length), radius);
    if (length > 1e-12) mesh.quaternion.setFromUnitVectors(Y, d.normalize());
    mesh.visible = length > 1e-9;
  };
  const segments = (count, color, parent) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color}));
    object.frustumCulled = false;
    parent.add(object);
    return object;
  };
  const fill = (line, points) => {
    const array = line.geometry.attributes.position.array, room = array.length / 3, n = Math.min(points.length, room);
    line.visible = n > 0;
    for (let i = 0; i < room; i++) array.set(n ? points[Math.min(i, n - 1)] : [0, 0, 0], i * 3);
    line.geometry.setDrawRange(0, n);
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.boundingBox = null;
    line.geometry.boundingSphere = null;
    return n;
  };

  const system = part('system', 'Stapler, cut and chart', 'A desktop stapler drawn at true size, a cut across its nose drawn larger above it, and a chart of the push over one press. Set the paper, the staple, the anvil and where you press, then press Play.', [0, 0, 0]);

  // The base, the anvil and the hinge post.
  const base = part('base', 'Base and anvil', `The base, the post that carries both hinge pins, and the steel anvil under the nose, ${fixed(STAPLER.blade, 0)} mm in front of the arm’s hinge. Drawn at true size.`, [0, 0, 0], system);
  const B = BODY.base, A = BODY.anvil, P = BODY.post;
  kit.box([mm(B.x1 - B.x0), mm(B.y1 - B.y0), mm(2 * B.z)], [mm((B.x0 + B.x1) / 2), mm((B.y0 + B.y1) / 2), 0], 'ink', base);
  const anvilPlate = kit.box([mm(A.x1 - A.x0), mm(A.y1 - A.y0), mm(2 * A.z)], [mm((A.x0 + A.x1) / 2), mm((A.y0 + A.y1) / 2), 0], 'metal', base);
  kit.box([mm(P.x1 - P.x0), mm(P.y1 - B.y1), mm(2 * P.z)], [mm((P.x0 + P.x1) / 2), mm((P.y1 + B.y1) / 2), 0], 'ink', base);
  const pins = [BODY.armPin, BODY.magazinePin].map(y => { const pin = kit.disk(mm(BODY.pin), mm(2 * P.z + 2), [0, mm(y), 0], 'metal', base); return pin; });

  // The paper, true thickness.
  const paper = part('paper', 'Paper', `A corner of the stack, ${fixed(SHEET, 1)} mm for every sheet. Drawn at true size.`, [0, 0, 0], system);
  const paperBlock = block('cream', paper);

  // The magazine turns about the lower pin; the staples ride in it.
  const magazine = part('magazine', 'Magazine and staples', `The channel that holds the strip of staples, turning about the lower pin. A spring pushes the strip forward to the nose, and the front staple rides with its crown ${fixed(STAPLER.gap + STAPLER.recess + STAPLER.longest, 1)} mm above the anvil until the blade drives it. Drawn at true size.`, [0, 0, 0], system);
  const magazinePivot = new THREE.Group();
  magazinePivot.position.set(0, mm(BODY.magazinePin), 0);
  magazine.add(magazinePivot);
  const M = BODY.magazine;
  const walls = [-1, 1].map(side => kit.box([mm(M.x1 - M.x0), mm(M.tall), mm(M.wall)], [mm((M.x0 + M.x1) / 2), mm(M.tall / 2), mm(side * (M.z - M.wall / 2))], 'metal', magazinePivot));
  const lid = kit.box([mm(M.x1 - M.x0), mm(M.wall), mm(2 * M.z)], [mm((M.x0 + M.x1) / 2), mm(M.tall - M.wall / 2), 0], 'metal', magazinePivot);
  const noseFront = kit.box([mm(M.wall), mm(M.tall), mm(2 * M.z)], [mm(M.x1 - M.wall / 2), mm(M.tall / 2), 0], 'metal', magazinePivot);
  const strip = paint(block('metal', magazinePivot), COLORS.wire);
  const U = BODY.pusher;
  kit.box([mm(U.x1 - U.x0), mm(U.y1 - U.y0), mm(2 * U.z)], [mm((U.x0 + U.x1) / 2), mm((U.y0 + U.y1) / 2), 0], 'ink', magazinePivot);
  const feed = kit.spring([0, 0, 0], mm(BODY.feed.radius), mm(U.x0 - BODY.feed.x0), BODY.feed.turns, magazinePivot, mm(BODY.springWire));
  feed.rotation.z = -Math.PI / 2;
  feed.position.set(mm(BODY.feed.x0), mm((U.y0 + U.y1) / 2), 0);
  const staple = new THREE.Group();
  magazine.add(staple);
  const stapleRods = Array.from({length: 5}, () => wireRod(COLORS.wire, staple));

  // The arm turns about the upper pin and pushes the blade straight down.
  const arm = part('arm', 'Arm and blade', `The arm turns about the upper pin, and its top face pushes the blade straight down ${fixed(STAPLER.blade, 0)} mm from the hinge. Pushing straight down anywhere on the arm, the hand’s force times its distance from the hinge equals the blade’s force times ${fixed(STAPLER.blade, 0)} mm. Drawn at true size.`, [0, 0, 0], system);
  const armPivot = new THREE.Group();
  armPivot.position.set(0, mm(BODY.armPin), 0);
  arm.add(armPivot);
  const R = BODY.arm;
  const cap = kit.box([mm(R.x1 - R.x0), mm(R.thick), mm(2 * R.z)], [mm((R.x0 + R.x1) / 2), mm(-R.thick / 2), 0], 'blue', armPivot);
  const blade = paint(block('metal', arm), COLORS.blade);

  // The springs.
  const springs = part('springs', 'Springs', 'The magazine spring holds the magazine up off the paper, and the return spring between the magazine and the arm lifts the arm again after a press. Drawn at true size.', [0, 0, 0], system);
  const returnCoil = kit.spring([0, 0, 0], mm(BODY.returnSpring.radius), mm(4), BODY.returnSpring.turns, springs, mm(BODY.springWire));
  const magazineCoil = kit.spring([0, 0, 0], mm(BODY.magazineSpring.radius), mm(9), BODY.magazineSpring.turns, springs, mm(BODY.springWire));

  // The pushes, on one scale.
  const push = part('push', 'Pushes', `Orange: the hand’s push on the arm. Steel: the blade’s push on the staple. Both are drawn ${fixed(PER_NEWTON, 1)} mm long for every newton.`, [0, 0, 0], system);
  const handArrow = solidArrow(kit, COLORS.hand, push, mm(BODY.arrow)), bladeArrow = solidArrow(kit, COLORS.blade, push, mm(BODY.arrow));

  // The cut across the nose.
  const detail = part('detail', 'Cut across the nose', `The nose cut across and drawn ${fixed(DETAIL, 0)} times larger, looking along the stapler from its front: the magazine’s sides, the blade, the staple, the paper and the anvil, whose grooves turn the legs where they come out through the back of the stack. A faint line marks every ${fixed(CUT.lineEvery, 0)} sheets.`, DETAIL_ORIGIN, system);
  const cutAnvil = kit.box([cut(2 * CUT.half - 2), cut(CUT.anvil), cut(CUT.back - CUT.front)], [0, cut(-CUT.anvil / 2), cut(-(CUT.back + CUT.front) / 2)], 'metal', detail);
  const grooves = [0, 1].map(() => block('ink', detail));
  const cutPaper = block('cream', detail);
  const sheetLines = segments(8, COLORS.faint, detail);
  const cutWalls = [0, 1].map(() => block('metal', detail));
  const cutBlade = paint(block('metal', detail), COLORS.blade);
  const cutRods = Array.from({length: 5}, () => wireRod(COLORS.wire, detail));
  const crossedMaterial = cutRods[0].material.clone();
  crossedMaterial.color.set(COLORS.crossed);
  const crossedHolder = new THREE.Mesh(new THREE.BufferGeometry(), crossedMaterial);
  crossedHolder.visible = false;
  detail.add(crossedHolder);
  const cutCorners = Array.from({length: 4}, () => paint(kit.sphere(1, [0, 0, 0], 'metal', detail), COLORS.wire));

  // The chart: force against travel, the blade's and the hand's.
  const chart = part('chart', 'Push over the press', `Force against how far each has moved, from nothing to ${fixed(CHART.force, 0)} N up and from 0 to ${fixed(CHART.travel, 0)} mm across. Steel: the blade’s force against its drop. Orange: the hand’s force against its own travel. The area under each line is the work done, the same for both. Faint lines: the magazine meeting the paper, the tips meeting the paper, and the tips meeting the anvil. A line above the top is drawn along it; the readings carry the figure.`, [0, 0, 0], system);
  const frame = lineObject(5, COLORS.ink, chart);
  fill(frame, [chartPoint(0, 0), chartPoint(CHART.travel, 0), chartPoint(CHART.travel, CHART.force), chartPoint(0, CHART.force), chartPoint(0, 0)]);
  const ticks = segments(12, COLORS.faint, chart);
  const tickPoints = [];
  for (let travel = CHART.travelTick; travel < CHART.travel; travel += CHART.travelTick) { const [x, y, z] = chartPoint(travel, 0); tickPoints.push([x, y, z], [x, y - CHART.tick, z]); }
  for (let force = CHART.forceTick; force < CHART.force; force += CHART.forceTick) { const [x, y, z] = chartPoint(0, force); tickPoints.push([x, y, z], [x - CHART.tick, y, z]); }
  fill(ticks, tickPoints);
  const stageMarks = segments(3, COLORS.faint, chart);
  const bladeLine = lineObject(20, COLORS.blade, chart), handLine = lineObject(20, COLORS.hand, chart);
  const bladeCursor = segments(2, COLORS.blade, chart), handCursor = segments(2, COLORS.hand, chart);

  control('sheets', 'Sheets of paper', ...STAPLER_DOMAINS.sheets, STAPLER_DEFAULTS.sheets, '', `How many sheets are stapled, at ${fixed(SHEET, 1)} mm each.`);
  control('staple', 'Staple', ...STAPLER_DOMAINS.staple, STAPLER_DEFAULTS.staple, '', 'The staple’s size: the wire’s gauge, then the legs’ length in millimeters.', STAPLE_OPTIONS.map(option => ({...option})));
  control('anvil', 'Anvil', ...STAPLER_DOMAINS.anvil, STAPLER_DEFAULTS.anvil, '', 'Turned one way the anvil folds the legs toward each other; turned the other way it folds them apart.', ANVIL_OPTIONS.map(option => ({...option})));
  control('hand', 'Where you press', ...STAPLER_DOMAINS.hand, STAPLER_DEFAULTS.hand, 'mm', `How far from the hinge the hand pushes down on the arm; the blade is ${fixed(STAPLER.blade, 0)} mm from it.`);

  // What changes only with the settings.
  let drawnKey = '';
  const redraw = plan => {
    const key = JSON.stringify(plan.values);
    if (key === drawnKey) return;
    drawnKey = key;
    setBox(paperBlock, MM, [BODY.paper.x0, BODY.paper.x1], [0, plan.stack], [-BODY.paper.z, BODY.paper.z]);
    const top = STAPLER.gap + STAPLER.recess + STAPLER.longest - BODY.magazinePin;
    setBox(strip, MM, [BODY.strip.x0, BODY.strip.x1], [top - plan.leg, top], [-plan.crown / 2, plan.crown / 2]);
    setBox(cutPaper, MM * DETAIL, [-CUT.half, CUT.half], [0, plan.stack], [-CUT.back, -CUT.front]);
    const lines = [];
    for (let sheet = CUT.lineEvery; sheet < plan.values.sheets; sheet += CUT.lineEvery) lines.push([cut(-CUT.half), cut(sheet * SHEET), cut(0.02 - CUT.front)], [cut(CUT.half), cut(sheet * SHEET), cut(0.02 - CUT.front)]);
    fill(sheetLines, lines);
    grooves.forEach((groove, i) => {
      const side = i ? 1 : -1, inner = plan.inward ? [0, plan.half + CUT.grooveMargin] : [plan.half - CUT.grooveMargin, plan.half + CUT.grooveRun];
      setBox(groove, MM * DETAIL, side > 0 ? inner : [-inner[1], -inner[0]], [-CUT.groove, 0], [-CUT.back - 0.02, 0.02 - CUT.front]);
    });
    fill(bladeLine, clipProfile(plan.profile).map(p => chartPoint(p.drop, p.force)));
    fill(handLine, clipProfile(plan.profile.map(p => ({drop: p.drop / plan.ratio, force: p.force * plan.ratio}))).map(p => chartPoint(p.drop, p.force)));
    fill(stageMarks, [plan.closed, plan.touch, plan.anvil].filter(drop => drop !== null).flatMap(drop => [chartPoint(drop, 0), chartPoint(drop, CHART.force)]));
  };

  let clock = 0, lastClock = 0, disposed = false;
  const result = finish(values => {
    const plan = staplerPlan(values), now = staplerAt(plan, clock), v = plan.values;
    redraw(plan);

    // The arm, the blade and the magazine.
    const slope = armSlope(now.drop), turn = magazineTurn(STAPLER.gap - now.nose);
    armPivot.rotation.z = -Math.atan(slope);
    magazinePivot.rotation.z = -turn;
    setBox(blade, MM, [STAPLER.blade - BODY.blade.thick / 2, STAPLER.blade + BODY.blade.thick / 2], [now.crownTop, bladeTop(now.drop)], [-plan.crown / 2, plan.crown / 2]);

    // The front staple, true size, in the plane across the nose.
    const wire = stapleSegments(plan, now);
    wire.forEach(({from, to}, i) => stretch(stapleRods[i], [mm(STAPLER.blade), mm(from[1]), mm(from[0])], [mm(STAPLER.blade), mm(to[1]), mm(to[0])], mm(plan.wire / 2)));

    // The springs, from what they sit on to what they hold up.
    const magazineTop = BODY.magazinePin - BODY.returnSpring.x * Math.sin(turn) + M.tall * Math.cos(turn);
    const armUnder = armY(now.drop, BODY.returnSpring.x) - R.thick * Math.sqrt(1 + slope * slope);
    returnCoil.position.set(mm(BODY.returnSpring.x), mm(magazineTop), 0);
    returnCoil.userData.setLength(mm(armUnder - magazineTop));
    const magazineBottom = BODY.magazinePin - BODY.magazineSpring.x * Math.tan(turn);
    magazineCoil.position.set(mm(BODY.magazineSpring.x), mm(B.y1), 0);
    magazineCoil.userData.setLength(mm(magazineBottom - B.y1));

    // The hand's push on the arm and the blade's on the staple, on one scale.
    const handTip = [v.hand, armY(now.drop, v.hand), 0], handLength = now.hand * PER_NEWTON;
    handArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));
    handArrow.userData.setLength(mm(handLength));
    handArrow.position.set(mm(handTip[0]), mm(handTip[1] + handLength), mm(handTip[2]));
    const bladeLength = now.blade * PER_NEWTON;
    bladeArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));
    bladeArrow.userData.setLength(mm(bladeLength));
    bladeArrow.position.set(mm(STAPLER.blade), mm(now.crownTop + bladeLength), mm(BODY.arrowZ));

    // The cut across the nose.
    cutWalls.forEach((wall, i) => {
      const side = i ? 1 : -1, x0 = plan.crown / 2 + CUT.wallGap, x1 = x0 + CUT.wall;
      setBox(wall, MM * DETAIL, side > 0 ? [x0, x1] : [-x1, -x0], [now.nose, now.nose + CUT.wallTall], [-CUT.back, -CUT.front]);
    });
    setBox(cutBlade, MM * DETAIL, [-plan.crown / 2, plan.crown / 2], [now.crownTop, now.crownTop + CUT.bladeTall], [-CUT.back, -CUT.front]);
    const crossed = plan.inward && now.reach > plan.half;
    wire.forEach(({from, to}, i) => {
      const depth = i === 2 ? -plan.wire / 2 : i === 4 ? plan.wire / 2 : 0;
      stretch(cutRods[i], [cut(from[0]), cut(from[1]), cut(depth)], [cut(to[0]), cut(to[1]), cut(depth)], cut(plan.wire / 2));
      if (i === 2 || i === 4) cutRods[i].material = crossed ? crossedMaterial : cutRods[0].material;
    });
    const corners = [wire[0].from, wire[0].to, wire[2].from, wire[4].from];
    cutCorners.forEach((corner, i) => {
      corner.position.set(cut(corners[i][0]), cut(corners[i][1]), cut(i === 2 ? -plan.wire / 2 : i === 3 ? plan.wire / 2 : 0));
      corner.scale.setScalar(cut(plan.wire / 2));
      corner.visible = i < 2 || now.reach > 0;
    });

    // Where the press is on the chart.
    const bladePoint = chartPoint(now.drop, now.blade), handPoint = chartPoint(now.handTravel, now.hand);
    fill(bladeCursor, [[bladePoint[0] - CHART.cursor, bladePoint[1], CHART.z], [bladePoint[0] + CHART.cursor, bladePoint[1], CHART.z], [bladePoint[0], bladePoint[1] - CHART.cursor, CHART.z], [bladePoint[0], bladePoint[1] + CHART.cursor, CHART.z]]);
    fill(handCursor, [[handPoint[0] - CHART.cursor, handPoint[1], CHART.z], [handPoint[0] + CHART.cursor, handPoint[1], CHART.z], [handPoint[0], handPoint[1] - CHART.cursor, CHART.z], [handPoint[0], handPoint[1] + CHART.cursor, CHART.z]]);

    const phase = PHASES[now.phase], inOut = plan.inward ? 'inward' : 'outward';
    const outcome = plan.through <= 0 ? `Legs end ${fixed(-plan.through, 3)} mm inside the stack: nothing folds, and nothing holds` : plan.meet ? `Legs run ${fixed(plan.overlap, 3)} mm past each other under the paper` : `Stapled · legs folded ${fixed(plan.folded, 3)} mm ${inOut}`;
    const legs = now.reach > 0 ? `${fixed(now.reach, 3)} of ${fixed(plan.folded, 3)} mm folded ${inOut}` : now.inPaper > 0 ? `${fixed(now.inPaper, 3)} mm into the paper` : 'Above the paper';
    const sheetsText = `${v.sheets} ${v.sheets === 1 ? 'sheet' : 'sheets'}`;
    const legsHint = plan.through > 0
      ? `${fixed(plan.through, 3)} mm of each leg comes out through the ${fixed(plan.stack, 1)} mm stack: the ${fixed(plan.below, 3)} mm of leg under the crown, less the paper. From each leg to the middle of the crown is ${fixed(plan.half, 3)} mm, so ${plan.inward ? (plan.meet ? 'folded inward the legs run into each other' : 'folded inward the legs do not meet') : 'folded outward the legs never meet'}.`
      : `The ${fixed(plan.stack, 1)} mm stack is thicker than the ${fixed(plan.below, 3)} mm of leg under the crown, so the tips never come out through the back of the paper.`;
    return {
      state: {...plan, now, clock, slope, turn, handTip, handLength, bladeLength, crossed, wire},
      readings: [
        r('Your result', clock <= 0 ? `Ready · ${sheetsText}, ${plan.staple.name} staple; press Play` : now.done ? outcome : `${phase} · hand ${fixed(now.hand, 1)} N`),
        r('Hand', `${fixed(now.hand, 1)} N · moved ${fixed(now.handTravel, 2)} mm`, `${plan.ratio === 1 ? `Pressed over the blade, ${fixed(v.hand, 0)} mm from the hinge, the hand pushes exactly as hard as the blade and moves exactly as far` : `Pressed ${fixed(v.hand, 0)} mm from the hinge, with the blade ${fixed(STAPLER.blade, 0)} mm from it, the hand pushes ${fixed(plan.ratio, 2)} times as hard as the blade, and the blade moves ${fixed(plan.ratio, 2)} times as far as the hand`}, so both do the same work: ${fixed(plan.work, 3)} J over the press. The hardest push: ${fixed(plan.handPeak, 1)} N, or ${fixed(plan.handPeak / LBF, 1)} pounds-force.`),
        r('Blade', `${fixed(now.blade, 1)} N · ${phase.toLowerCase()}`, `Three forces must be overcome: breaking the staple off the strip, piercing the paper and folding the legs. The hardest moment of this press is ${fixed(plan.peak.force, 1)} N, while ${PHASES[plan.peak.phase].toLowerCase()}. Every force here is illustrative.`),
        r('Legs', legs, legsHint),
        r('Staple', `${plan.staple.name} · ${fixed(plan.wire, 3)} mm wire · ${fixed(plan.crown, 1)} mm crown`, `Folding each leg takes ${fixed(plan.foldRatio, 2)} times the force a 26/6 staple’s leg takes: the force to bend a round wire grows with the cube of its diameter.`),
        r('Paper', `${sheetsText} · ${fixed(plan.stack, 1)} mm`, `${fixed(SHEET, 1)} mm a sheet, inside the 97 to 114 μm of 20-pound bond paper.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = drop => { clock = Math.min(duration(), drop / STAPLER.speed); return render(); };
  result.actions = [
    {label: 'Inspect: the legs piercing the paper', part: 'detail', view: 'front', replay: false, run() { const s = result.getState(); return inspect(s.touch + Math.min(s.stack, s.below) / 2); }},
    {label: 'Inspect: the legs folding', part: 'detail', view: 'front', replay: false, run() { const s = result.getState(); return inspect(s.through > 0 ? s.anvil + s.through / 2 : s.seat); }},
    {label: 'Inspect: the lever', part: 'arm', view: 'front', replay: false, run() { return inspect(result.getState().seat); }},
    {label: 'Inspect: the push over the press', part: 'chart', view: 'front', replay: false, run() { return inspect(result.getState().seat); }},
  ];
  result.playback = {
    label: 'Press',
    description: `The blade goes down at ${fixed(STAPLER.speed, 0)} mm a second, far slower than a real press, until the crown sits on the paper.`,
    stepLabel: 'Advance 0.1 mm',
    advance: result.advance,
    step: () => result.advance(0.1 / STAPLER.speed),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'detail', label: 'Inspect the folded staple', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  root.rotation.set(0.12, -0.32, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, base, anvilPlate, pins, paper, paperBlock, magazine, magazinePivot, walls, lid, noseFront, strip, feed, staple, stapleRods, arm, armPivot, cap, blade, springs, returnCoil, magazineCoil, push, handArrow, bladeArrow, detail, cutAnvil, grooves, cutPaper, sheetLines, cutWalls, cutBlade, cutRods, crossedMaterial, crossedHolder, cutCorners, chart, frame, ticks, stageMarks, bladeLine, handLine, bladeCursor, handCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

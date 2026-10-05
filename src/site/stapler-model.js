import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface} from './scene-kit.js';
import {createStaplerChart} from './stapler-charts.js';
import {createStaplerLeaf} from './stapler-springs.js';
import {createStaplerFeed} from './stapler-feed.js';
import {staplerCycleAt, staplerCyclePlan, CYCLE_PHASES} from './stapler-cycle.js';
import {staplerPlan, magazineAngle, STAPLER, SHEET, PHASES, STAPLE_OPTIONS, ANVIL_OPTIONS, STAPLER_DEFAULTS, STAPLER_DOMAINS} from './stapler-physics.js';

// ---------------------------------------------------------------------------
// Stapler: a desktop stapler seen from the side, a cut across its nose drawn
// larger above it, and a chart of the push over one press.
//
// Scale: the stapler is drawn at true size, 1 mm to 0.01 scene units,
// measured from the hinge along the base (x), up from the anvil's face (y)
// and across the stapler (z). The cut across the nose is drawn 6 times
// larger, looking along the stapler from its front, with the staple's crown
// running left to right. The separate chart compares hand and blade work.
//
// Time: the blade goes down at 4 mm a second, far slower than a real press.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const DETAIL = 6;

/** The stapler's body, mm. The arm's top face and the magazine's bottom each pass through their own hinge pin. */
export const BODY = Object.freeze({
  base: Object.freeze({x0: -24, x1: 186, y0: -9, y1: -0.5, z: 19}),
  anvil: Object.freeze({x0: 148, x1: 172, y0: -2.5, y1: 0, z: 17}),
  post: Object.freeze({x0: -24, x1: 8, y1: 34, z: 16}),
  pin: 2.5,
  armPin: 27,
  magazinePin: STAPLER.gap,
  arm: Object.freeze({x0: -6, x1: 174, thick: 7, z: 14}),
  blade: Object.freeze({tall: 17.5, thick: 0.4}),
  magazine: Object.freeze({x0: -2, x1: 166, tall: 10, z: 9, wall: 1}),
  paper: Object.freeze({x0: 150, x1: 232, z: 40}),
});

/** The cut across the nose, mm before the sixfold enlargement. The staple's wire lies in the cut's plane; the solids stand behind it, so the wire shows. */
export const CUT = Object.freeze({half: 17, anvil: 2.5, back: 4, front: 0.3, wall: 1, wallGap: 0.3, wallTall: 8, bladeTall: 6, groove: 0.35, grooveRun: 8, grooveMargin: 0.3, lineEvery: 10});
export const DETAIL_ORIGIN = Object.freeze([1.8, 0.62, 0]);

export {STAPLER_CHART as CHART} from './stapler-charts.js';
export const COLORS = Object.freeze({blade: 0x5f7380, faint: 0x9aa39a, wire: 0x8d989c});

/** The blade's top, mm above the anvil, a drop below rest. */
export const bladeTop = drop => STAPLER.gap + STAPLER.recess + STAPLER.longest + BODY.blade.tall - drop;

/** The slope of the arm's top face, front down, with the blade a drop below rest. */
export const armSlope = drop => (BODY.armPin - bladeTop(drop)) / STAPLER.blade;

/** The arm's top face, mm above the anvil, at a horizontal distance from the hinge. */
export const armY = (drop, x) => BODY.armPin - x * armSlope(drop);

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
  const wireRod = (color, parent) => paint(block('metal', parent), color);
  const stretch = (mesh, a, b, crossA, crossB) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), length = d.length();
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.scale.set(crossA, Math.max(1e-9, length), crossB);
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

  const system = part('system', 'Stapler', 'A direct-acting desktop stapler. Watch the press, return and next-staple feed. Separate inspection views enlarge the staple and show the illustrative force profile.', [0, 0, 0]);

  // The base, the anvil and the hinge post.
  const base = part('base', 'Base and anvil', `The base, the post that carries both hinge pins, and the steel anvil under the nose, ${fixed(STAPLER.blade, 0)} mm in front of the arm’s hinge. Drawn at true size.`, [0, 0, 0], system);
  const B = BODY.base, A = BODY.anvil, P = BODY.post;
  kit.box([mm(B.x1 - B.x0), mm(B.y1 - B.y0), mm(2 * B.z)], [mm((B.x0 + B.x1) / 2), mm((B.y0 + B.y1) / 2), 0], 'ink', base);
  const anvilPlate = new THREE.Group(); base.add(anvilPlate);
  const anvilFloor = block('metal', anvilPlate), anvilSides = [block('metal', anvilPlate), block('metal', anvilPlate)], anvilLands = Array.from({length: 3}, () => block('metal', anvilPlate));
  const grooveHalfWidth = .4;
  setBox(anvilFloor, MM, [A.x0, A.x1], [A.y0, -CUT.groove], [-A.z, A.z]);
  setBox(anvilSides[0], MM, [A.x0, STAPLER.blade - grooveHalfWidth], [-CUT.groove, 0], [-A.z, A.z]);
  setBox(anvilSides[1], MM, [STAPLER.blade + grooveHalfWidth, A.x1], [-CUT.groove, 0], [-A.z, A.z]);
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
  const channelEnd = STAPLER.blade - .4;
  const lid = kit.box([mm(channelEnd - M.x0), mm(M.wall), mm(2 * M.z)], [mm((M.x0 + channelEnd) / 2), mm(M.tall - M.wall / 2), 0], 'metal', magazinePivot);
  const magazineFloor = kit.box([mm(channelEnd - M.x0), mm(.4), mm(2 * M.z)], [mm((M.x0 + channelEnd) / 2), mm(.2), 0], 'metal', magazinePivot);
  const noseFront = kit.box([mm(M.wall), mm(M.tall), mm(2 * M.z)], [mm(M.x1 - M.wall / 2), mm(M.tall / 2), 0], 'metal', magazinePivot);
  const feedView = createStaplerFeed(kit, magazine, magazinePivot, MM), strip = feedView.strip, feed = feedView.spring.object;
  const staple = new THREE.Group();
  magazine.add(staple);
  const stapleRods = Array.from({length: 5}, () => wireRod(COLORS.wire, staple));
  const stapleCorners = Array.from({length: 4}, () => wireRod(COLORS.wire, staple));

  // The arm turns about the upper pin and pushes the blade straight down.
  const arm = part('arm', 'Arm and blade', `The arm turns about the upper pin, and its top face pushes the blade straight down ${fixed(STAPLER.blade, 0)} mm from the hinge. Pushing straight down anywhere on the arm, the hand’s force times its distance from the hinge equals the blade’s force times ${fixed(STAPLER.blade, 0)} mm. Drawn at true size.`, [0, 0, 0], system);
  const armPivot = new THREE.Group();
  armPivot.position.set(0, mm(BODY.armPin), 0);
  arm.add(armPivot);
  const R = BODY.arm;
  const cap = kit.box([mm(R.x1 - R.x0), mm(R.thick), mm(R.z)], [mm((R.x0 + R.x1) / 2), mm(-R.thick / 2), mm(R.z / 2)], 'blue', armPivot);
  const capBack = kit.box([mm(R.x1 - R.x0), mm(R.thick), mm(R.z)], [mm((R.x0 + R.x1) / 2), mm(-R.thick / 2), mm(-R.z / 2)], 'blue', armPivot);
  const blade = paint(block('metal', arm), COLORS.blade);
  const handMarker = kit.sphere(mm(2.5), [0, 0, 0], 'clay', arm);
  handMarker.scale.y = .12;
  handMarker.userData.explosionExcluded = true;

  // Two supported leaves show the return action without predicting beam stress.
  const springs = part('springs', 'Leaf return springs', 'One leaf lifts the arm from the magazine; another lifts the magazine from the base. Their supported deflection is schematic. Return timing and force coefficients are assigned, not a measured spring response.', [0, 0, 0], system);
  const upperLeaf = createStaplerLeaf(kit, springs, {from: 35, to: 110, scale: MM});
  const lowerLeaf = createStaplerLeaf(kit, springs, {from: 30, to: 110, scale: MM});

  // The cut across the nose.
  const detail = part('detail', 'Cut across the nose', `The nose cut across and drawn ${fixed(DETAIL, 0)} times larger, looking along the stapler from its front: the magazine’s sides, the blade, the staple, the paper and the anvil, whose grooves turn the legs where they come out through the back of the stack. A faint line marks every ${fixed(CUT.lineEvery, 0)} sheets.`, DETAIL_ORIGIN, system);
  const cutAnvil = kit.box([cut(2 * CUT.half - 2), cut(CUT.anvil), cut(CUT.back - CUT.front)], [0, cut(-CUT.anvil / 2), cut(-(CUT.back + CUT.front) / 2)], 'metal', detail);
  const grooves = [0, 1].map(() => block('ink', detail));
  const cutPaper = block('cream', detail);
  const sheetLines = segments(8, COLORS.faint, detail);
  const cutWalls = [0, 1].map(() => block('metal', detail));
  const cutBlade = paint(block('metal', detail), COLORS.blade);
  const cutRods = Array.from({length: 5}, () => wireRod(COLORS.wire, detail));
  const cutCorners = Array.from({length: 4}, () => wireRod(COLORS.wire, detail));

  const chartView = createStaplerChart(kit, system), chart = chartView.object;
  detail.userData.inspectionOnly = 'detail'; detail.userData.explosionExcluded = true;

  control('sheets', 'Sheets of paper', ...STAPLER_DOMAINS.sheets, STAPLER_DEFAULTS.sheets, '', `How many sheets are stapled, at ${fixed(SHEET, 1)} mm each.`);
  control('staple', 'Staple', ...STAPLER_DOMAINS.staple, STAPLER_DEFAULTS.staple, '', 'Assigned leg height and rectangular wire section. These teaching specimens do not specify product compatibility.', STAPLE_OPTIONS.map(option => ({...option})));
  control('anvil', 'Anvil', ...STAPLER_DOMAINS.anvil, STAPLER_DEFAULTS.anvil, '', 'Turned one way the anvil folds the legs toward each other; turned the other way it folds them apart.', ANVIL_OPTIONS.map(option => ({...option})));
  control('hand', 'Where you press', ...STAPLER_DOMAINS.hand, STAPLER_DEFAULTS.hand, 'mm', `The orange marker shows where the hand pushes down on the arm, measured from the hinge. The blade is ${fixed(STAPLER.blade, 0)} mm from it.`);

  // What changes only with the settings.
  let drawnKey = '';
  const redraw = plan => {
    const key = JSON.stringify(plan.values);
    if (key === drawnKey) return;
    drawnKey = key;
    setBox(paperBlock, MM, [BODY.paper.x0, BODY.paper.x1], [0, plan.stack], [-BODY.paper.z, BODY.paper.z]);
    setBox(cutPaper, MM * DETAIL, [-CUT.half, CUT.half], [0, plan.stack], [-CUT.back, -CUT.front]);
    const lines = [];
    for (let sheet = CUT.lineEvery; sheet < plan.values.sheets; sheet += CUT.lineEvery) lines.push([cut(-CUT.half), cut(sheet * SHEET), cut(0.02 - CUT.front)], [cut(CUT.half), cut(sheet * SHEET), cut(0.02 - CUT.front)]);
    fill(sheetLines, lines);
    grooves.forEach((groove, i) => {
      const side = i ? 1 : -1, inner = plan.inward ? [0, plan.half + CUT.grooveMargin] : [plan.half - CUT.grooveMargin, plan.half + CUT.grooveRun];
      setBox(groove, MM * DETAIL, side > 0 ? inner : [-inner[1], -inner[0]], [-CUT.groove, 0], [-CUT.back - 0.02, 0.02 - CUT.front]);
    });
    const edge = plan.half + CUT.grooveMargin, start = plan.half - CUT.grooveMargin, end = plan.half + CUT.grooveRun;
    const lands = plan.inward ? [[-A.z, -edge], [edge, A.z]] : [[-A.z, -end], [-start, start], [end, A.z]];
    anvilLands.forEach((land, i) => {
      land.visible = i < lands.length;
      if (land.visible) setBox(land, MM, [STAPLER.blade - grooveHalfWidth, STAPLER.blade + grooveHalfWidth], [-CUT.groove, 0], lands[i]);
    });

  };

  let clock = 0, lastClock = 0, disposed = false;
  const result = finish(values => {
    const plan = staplerPlan(values), motion = staplerCycleAt(plan, clock), now = motion.press, v = plan.values;
    clock = motion.t;
    redraw(plan);

    // The arm, the blade and the magazine.
    const slope = armSlope(motion.bladeDrop), turn = magazineAngle(motion.magazineDrop);
    armPivot.rotation.z = -Math.atan(slope);
    handMarker.position.set(mm(v.hand), mm(armY(motion.bladeDrop, v.hand) + .4), 0);
    handMarker.rotation.z = -Math.atan(slope);
    magazinePivot.rotation.z = -turn;
    const feeding = feedView.update(plan, motion);
    setBox(blade, MM, [STAPLER.blade - BODY.blade.thick / 2, STAPLER.blade + BODY.blade.thick / 2], [motion.driverBottom, bladeTop(motion.bladeDrop)], [-plan.crown / 2, plan.crown / 2]);

    // The front staple, true size, in the plane across the nose.
    const wire = stapleSegments(plan, now);
    wire.forEach(({from, to}, i) => stretch(stapleRods[i], [mm(STAPLER.blade), mm(from[1]), mm(from[0])], [mm(STAPLER.blade), mm(to[1]), mm(to[0])], mm(plan.staple.width), mm(plan.wire)));

    const magazineTopAt = x => BODY.magazinePin - x * Math.tan(turn) + M.tall / Math.cos(turn);
    const magazineBottomAt = x => BODY.magazinePin - x * Math.tan(turn);
    const armUnderAt = x => armY(motion.bladeDrop, x) - R.thick * Math.sqrt(1 + slope * slope);
    upperLeaf.update(armUnderAt, magazineTopAt);
    lowerLeaf.update(magazineBottomAt, () => B.y1);

    // The cut across the nose.
    cutWalls.forEach((wall, i) => {
      const side = i ? 1 : -1, x0 = plan.crown / 2 + CUT.wallGap, x1 = x0 + CUT.wall;
      setBox(wall, MM * DETAIL, side > 0 ? [x0, x1] : [-x1, -x0], [motion.nose, motion.nose + CUT.wallTall], [-CUT.back, -CUT.front]);
    });
    setBox(cutBlade, MM * DETAIL, [-plan.crown / 2, plan.crown / 2], [motion.driverBottom, motion.driverBottom + CUT.bladeTall], [-CUT.back, -CUT.front]);
    wire.forEach(({from, to}, i) => {
      const depth = 0;
      stretch(cutRods[i], [cut(from[0]), cut(from[1]), cut(depth)], [cut(to[0]), cut(to[1]), cut(depth)], cut(plan.wire), cut(plan.staple.width));
    });
    const corners = [wire[0].from, wire[0].to, wire[2].from, wire[4].from];
    cutCorners.forEach((corner, i) => {
      corner.position.set(cut(corners[i][0]), cut(corners[i][1]), 0);
      corner.scale.set(cut(plan.wire), cut(plan.wire), cut(plan.staple.width));
      stapleCorners[i].position.set(mm(STAPLER.blade), mm(corners[i][1]), mm(corners[i][0]));
      stapleCorners[i].scale.set(mm(plan.staple.width), mm(plan.wire), mm(plan.wire));
      stapleCorners[i].visible = i < 2 || now.reach > 0;
      corner.visible = i < 2 || now.reach > 0;
    });

    const chartRanges = chartView.update(plan, motion);

    const phase = CYCLE_PHASES[motion.phase] || PHASES[motion.phase], inOut = plan.inward ? 'inward' : 'outward';
    const outcome = motion.cycle.interference ? 'Stopped: inward tips meet before the crown seats'
      : plan.through <= 0 ? 'Not clinched: tips remain inside the stack'
      : `Clinched ${inOut} · ${fixed(plan.folded, 2)} mm of each leg emerged`;
    const sheetsText = `${v.sheets} ${v.sheets === 1 ? 'sheet' : 'sheets'}`;
    return {
      state: {...plan, now, motion, feeding, clock, slope, turn, wire, chartRanges},
      readings: [
        r('Your result', clock <= 0 ? `Ready · ${sheetsText}, ${plan.staple.name}; press Play` : motion.done ? outcome : phase,
          motion.done && !motion.cycle.interference ? 'The driver has risen, and the feed spring has advanced the next staple. Replay repeats one complete cycle.' : 'A slow prescribed cycle. The planar fold stops at first inward-tip interference; actual buckling or jam forces are not predicted.'),
        r('Hand', motion.forceEvaluated ? `${fixed(now.hand, 1)} N · moved ${fixed(now.handTravel, 2)} mm` : 'No active drive force evaluated',
          `Vertical push ${fixed(v.hand, 0)} mm from the hinge: ${fixed(plan.ratio, 2)} times the blade force and ${fixed(1 / plan.ratio, 2)} times its travel. Assigned peak ${fixed(motion.cycle.handPeak, 1)} N; input work ${fixed(motion.cycle.work, 3)} J up to the press end or interference stop.`),
        r('Blade', motion.forceEvaluated ? `${fixed(now.blade, 1)} N · ${phase.toLowerCase()}` : phase,
          `Separation, penetration, rubbing and folding resist the press. The assigned peak is ${fixed(motion.cycle.peak, 1)} N. Return and feeding are not force simulations.`),
        r('Legs', now.reach > 0 ? `${fixed(now.reach, 2)} mm folded ${inOut}` : now.inPaper > 0 ? `${fixed(now.inPaper, 2)} mm into the paper` : 'Above the paper',
          plan.through <= 0 ? `The ${fixed(plan.stack, 1)} mm stack leaves no leg beyond its back face for a clinch. Frictional holding is not predicted.`
            : `${fixed(plan.through, 2)} mm would emerge when seated; the distance from each leg centerline to the middle is ${fixed(plan.half, 3)} mm. ${plan.meet ? 'The ideal inward fold stops before overlapping tips.' : 'The selected fold does not encounter the opposite tip.'}`),
        r('Staple', `${plan.staple.name} · ${fixed(plan.staple.width, 2)} × ${fixed(plan.wire, 2)} mm wire`,
          `Rectangular teaching specimen with ${fixed(plan.crown, 2)} mm outside crown width. With equal material strength and bending moment arm, its assigned folding force is ${fixed(plan.foldRatio, 3)} times the light wire’s. Product dimensions and compatibility vary.`),
        r('Paper', `${sheetsText} · ${fixed(plan.stack, 1)} mm`, `${fixed(SHEET, 1)} mm per sheet is assigned. Paper compression, tearing and holding strength are not calculated.`),
        r('Feed', `${motion.remaining} staples in magazine · advanced ${fixed(motion.feedTravel, 2)} mm`,
          'The driver first returns clear of the next crown. The coil spring then moves the strip and follower by one wire width. Only one staple is used per cycle.'),
      ],
    };
  });

  const render = result.update;
  const duration = () => staplerCyclePlan(result.getState()).duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), Number((clock + dt).toFixed(12))); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = (initial = {}) => { clock = Number.isFinite(initial.time) ? Math.max(0, initial.time) : 0; lastClock = 0; return render({...result.defaults, ...(initial.settings || {})}); };
  result.replayState = () => ({settings: result.getState().values, time: 0});
  result.actions = [['Inspect: complete stapler', 'system'], ['Inspect: base and anvil', 'base'], ['Inspect: arm and blade', 'arm'], ['Inspect: magazine and feed', 'magazine'], ['Inspect: staple strip and follower', 'strip'], ['Inspect: leaf return springs', 'springs'], ['Inspect: enlarged staple', 'detail'], ['Read: force and work', 'chart']].map(([label, part]) => ({label, part, view: 'front', isolate: true, replay: false, run: () => result.update()}));
  result.playback = {
    label: 'Staple and reset',
    description: 'A slow press, spring return and one-staple feed. Stops if inward tips meet before seating. Return and feed timing are prescribed.',
    stepLabel: 'Advance 25 ms', advance: result.advance, step: () => result.advance(.025),
    complete: () => result.getState().motion.done, blocked: () => false,
  };
  result.resultPart = {id: 'detail', label: 'Inspect the staple', view: 'front', focusOnComplete: false, available: () => result.getState().motion.resultReady};

  root.rotation.set(0, 0, 0);
  result.initialPart = result.autoFramePart = 'system';
  result.initialIsolated = true;
  result.catalogParts = result.parts.filter(p => p.id !== 'system');
  result.covers.push(cap, lid, walls[1]);
  result.initialCutaway = true;
  result.partViewDirections = {};
  for (const p of result.parts) {
    result.partViewDirections[p.id] = {front: ['detail', 'chart'].includes(p.id) ? [0, 0, 3] : [2.5, 1.6, 3]};
    p.framePadding = p.id === 'chart' ? .54 : .7; p.maxZoom = 300;
  }
  for (const object of [paper, detail, chart]) object.userData.explosionExcluded = true;
  for (const object of [base, arm, magazine, springs]) object.userData.explosionCategory = true;
  result.thumbnailOmit = [paper, detail, chart, handMarker];
  result.controls.find(c => c.key === 'staple').primary = true;
  result.controls.find(c => c.key === 'anvil').primary = true;
  // Keep framing stable while the driver returns and the feed moves half a millimeter.
  const motionExtents = {
    system: [[-24, -9, -40], [232, 37, 40]],
    arm: [[-7, .3, -14], [176, 37, 14]],
    magazine: [[-3, 0, -9], [168, 20, 9]],
    strip: [[148, .2, -7.5], [162, 18.5, 7.5]],
    springs: [[30, -.5, -1.5], [110, 34, 1.5]],
  };
  result.frameBoundsForPart = id => {
    if (id === 'detail') return new THREE.Box3(new THREE.Vector3(-17, -2.5, -4).multiplyScalar(MM * DETAIL), new THREE.Vector3(17, 23.8, .25).multiplyScalar(MM * DETAIL)).applyMatrix4(detail.matrixWorld);
    const extent = motionExtents[id];
    return extent ? new THREE.Box3(new THREE.Vector3(...extent[0]).multiplyScalar(MM), new THREE.Vector3(...extent[1]).multiplyScalar(MM)).applyMatrix4(root.matrixWorld) : null;
  };
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, base, anvilPlate, anvilFloor, anvilSides, anvilLands, pins, paper, paperBlock, magazine, magazinePivot, magazineFloor, walls, lid, noseFront, strip, feed, feedView, staple, stapleRods, stapleCorners, arm, armPivot, cap, capBack, blade, handMarker, springs, upperLeaf, lowerLeaf, detail, cutAnvil, grooves, cutPaper, sheetLines, cutWalls, cutBlade, cutRods, cutCorners, chart, chartView, bladeLine: chartView.bladeLine, handLine: chartView.handLine, bladeCursor: chartView.bladeCursor, handCursor: chartView.handCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

// ---------------------------------------------------------------------------
// Stapler model check. What it holds the stapler to, each by a route of its
// own rather than the model's:
//
// 1. The sources typed in again: the staple table, the wire gauge formula,
//    the pound-force, a sheet's thickness.
// 2. The cube law: |y| integrated over a round wire's section.
// 3. The press worked out again from where its parts are: the magazine's
//    nose, the crown and the tips against the paper and the anvil. Every
//    change of stage is found by bisection, the force in each stage is built
//    from the illustrative constants, and the work is summed piece by piece.
// 4. The patent's 15 to 30 pounds-force, from 1 to 25 sheets.
// 5. The lever read off the drawn arm: the hand's arrow and the blade's top on
//    the arm's top face, and the hand's drawn travel against the blade's.
// 6. The staple read off the drawn wire, in the cut and at true size: every
//    wire's ends and thickness, each leg keeping its length as it folds, the
//    tips over the anvil's grooves, crossing legs in red, and the sheet counts
//    where legs meet or stay inside, by brute force.
// 7. The drawing: the nose on the paper, the arm clear of the magazine, the
//    springs between what they sit on, and both arrows on one scale.
// 8. The chart's lines read back into forces and travels, and their areas.
// 9. Every number the lesson quotes, controls that move the readings and the
//    drawing, finite scenes, refusals, playback, actions and disposal.
// ---------------------------------------------------------------------------
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {staplerPlan, staplerAt, bladeForce, phaseAt, sampleStapler, plasticModulus, foldForce, LBF, STAPLES, SHEET, STAPLER, FORCES, STAPLER_DOMAINS} from './stapler-physics.js';
import {createStaplerModel, MM, DETAIL, PER_NEWTON, BODY, CUT, CHART} from './stapler-model.js';
import {staplerLesson as lesson, limits} from './stapler-lessons.js';

const t = tally();
const PATENT = [15, 30];
const BOND = [0.097, 0.114];
const TOP = STAPLER.gap + STAPLER.recess + STAPLER.longest;

// 1. The sources.
const TABLE = {'26/6': {crown: 12.7, wire: 0.405, leg: 6}, '24/6': {crown: 12.9, wire: 0.511, leg: 6}, '24/8': {crown: null, wire: 0.511, leg: 8}};
for (const staple of STAPLES) {
  const row = TABLE[staple.name], [gauge, leg] = staple.name.split('/').map(Number);
  t.ok(staple.wire === row.wire && staple.leg === row.leg && leg === row.leg, `${staple.name}: wire and legs from the table`);
  t.ok(row.crown === null ? staple.crown === TABLE['24/6'].crown : staple.crown === row.crown, `${staple.name}: crown from the table, or 24/6's where it gives none`);
  t.near(0.127 * 92 ** ((36 - gauge) / 39), staple.wire, 0.0005, `${staple.name}: the wire is its AWG gauge`);
}
t.near(LBF, 4.4482216152605, 1e-12, 'a pound-force in newtons');
t.ok(SHEET >= BOND[0] && SHEET <= BOND[1], 'a sheet inside the thickness of 20-pound bond');

// 2. The cube law.
const modulusByIntegral = d => {
  const R = d / 2, n = 400000;
  let sum = 0;
  for (let i = 0; i < n; i++) { const y = (i + 0.5) / n * R; sum += 4 * y * Math.sqrt(R * R - y * y); }
  return sum * R / n;
};
const integral = new Map(STAPLES.map(({wire}) => [wire, modulusByIntegral(wire)]));
for (const [wire, Z] of integral) t.near(Z / plasticModulus(wire), 1, 1e-6, `plastic section modulus of ${wire} mm wire`);
const foldBy = wire => FORCES.fold * integral.get(wire) / integral.get(STAPLES[0].wire);
for (const {wire} of STAPLES) t.near(foldForce(wire), foldBy(wire), 1e-5, `each leg's folding force for ${wire} mm wire`);
const cube = integral.get(0.511) / integral.get(0.405);

// 3. The press from where its parts are.
const where = (staple, stack, s) => { const crownTop = TOP - s; return {nose: Math.max(STAPLER.gap - s, stack), drive: s - (STAPLER.gap - stack), crownTop, tip: crownTop - staple.leg}; };
const stageOf = (staple, stack, s) => {
  const g = where(staple, stack, s);
  if (g.drive < 0) return 'closing';
  if (g.drive < FORCES.breakTravel) return 'breaking';
  if (g.tip > stack) return 'free';
  if (g.tip > 0 || staple.leg - staple.wire <= stack) return 'piercing';
  return 'folding';
};
const forceOf = (staple, stack, s) => {
  const g = where(staple, stack, s), stage = stageOf(staple, stack, s);
  if (stage === 'closing') return FORCES.magazine + FORCES.magazineRate * (STAPLER.gap - g.nose);
  let force = FORCES.spring + FORCES.springRate * g.drive;
  if (stage === 'breaking') force += FORCES.breakOff * g.drive / FORCES.breakTravel;
  if (stage === 'piercing') force += 2 * (FORCES.cut + FORCES.friction * (stack - g.tip));
  if (stage === 'folding') force += 2 * (foldBy(staple.wire) + FORCES.friction * stack);
  return force;
};

let plansWorked = 0, stageChanges = 0, forceSamples = 0;
const pieceProfiles = new Map();
for (let staple = 0; staple < STAPLES.length; staple++) {
  for (let sheets = 1; sheets <= STAPLER_DOMAINS.sheets[1]; sheets++) {
    const S = STAPLES[staple], stack = sheets * SHEET, seat = TOP - S.wire - stack, plan = staplerPlan({staple, sheets});
    t.near(plan.seat, seat, 1e-12, 'the stroke ends with the crown on the paper');
    t.near(plan.duration * STAPLER.speed, seat, 1e-12, 'the press lasts as long as the blade takes');

    const edges = [], h = 0.01;
    let previous = stageOf(S, stack, 0), s = 0;
    t.ok(previous === 'closing', 'a press starts by closing the magazine');
    while (s < seat) {
      const next = Math.min(seat, s + h), stage = stageOf(S, stack, next);
      if (stage !== previous) {
        let lo = s, hi = next;
        for (let i = 0; i < 200 && hi - lo > 1e-14; i++) { const mid = (lo + hi) / 2; if (stageOf(S, stack, mid) === previous) lo = mid; else hi = mid; }
        edges.push({at: hi, from: previous, to: stage});
        previous = stage;
      }
      s = next;
    }
    const expected = [['closing', 'breaking', plan.closed], ['breaking', 'free', plan.broken], ['free', 'piercing', plan.touch]];
    t.ok((plan.anvil !== null) === (S.leg - S.wire > stack), 'the tips reach the anvil only when the legs are longer than the stack');
    if (plan.anvil !== null) expected.push(['piercing', 'folding', plan.anvil]);
    assert.equal(edges.length, expected.length, `${S.name} on ${sheets} sheets: ${edges.map(edge => edge.to).join(', ')}`);
    edges.forEach((edge, i) => {
      t.ok(edge.from === expected[i][0] && edge.to === expected[i][1], `${S.name} on ${sheets} sheets: stage ${i}`);
      t.near(edge.at, expected[i][2], 1e-9, `${S.name} on ${sheets} sheets: ${edge.to} begins where the plan says`);
      stageChanges++;
    });

    const bounds = [0, ...edges.map(edge => edge.at), seat], profile = [];
    let work = 0, peak = {force: -Infinity};
    for (let i = 0; i + 1 < bounds.length; i++) {
      const a = bounds[i], b = bounds[i + 1], eps = Math.min(1e-9, (b - a) / 4);
      const fa = forceOf(S, stack, a + eps), fb = forceOf(S, stack, b - eps), slope = (fb - fa) / (b - a - 2 * eps);
      const start = fa - slope * eps, end = fb + slope * eps, stage = stageOf(S, stack, (a + b) / 2);
      t.near(forceOf(S, stack, (a + b) / 2), (start + end) / 2, 1e-9, 'each stage is a straight line');
      work += (start + end) / 2 * (b - a);
      profile.push([a, start], [b, end]);
      if (end > peak.force) peak = {force: end, stage, at: b};
    }
    pieceProfiles.set(`${staple}/${sheets}`, profile);
    t.near(plan.work * 1000, work, 1e-6, `${S.name} on ${sheets} sheets: work summed piece by piece`);
    t.near(plan.peak.force, peak.force, 1e-6, `${S.name} on ${sheets} sheets: the hardest moment`);
    t.ok(plan.peak.phase === peak.stage, `${S.name} on ${sheets} sheets: the hardest stage`);
    t.near(plan.peak.drop, peak.at, 1e-9, `${S.name} on ${sheets} sheets: where the hardest moment is`);
    assert.equal(plan.profile.length, profile.length, 'the profile has a start and an end for every stage');
    plan.profile.forEach((point, i) => { t.near(point.drop, profile[i][0], 1e-9, 'profile drop'); t.near(point.force, profile[i][1], 1e-9, 'profile force'); });

    for (let k = 0; k < 64; k++) {
      const x = seat * (k + 0.4142) / 64;
      if (bounds.some(bound => Math.abs(bound - x) < 1e-7)) continue;
      const g = where(S, stack, x), now = staplerAt(plan, x / STAPLER.speed);
      t.near(bladeForce(plan, x), forceOf(S, stack, x), 1e-9, 'the force at a drop');
      t.ok(phaseAt(plan, x) === stageOf(S, stack, x) && now.phase === stageOf(S, stack, x), 'the stage at a drop');
      t.near(now.drop, x, 1e-12, 'drop');
      t.near(now.nose, g.nose, 1e-12, 'the nose');
      t.near(now.crownTop, g.crownTop, 1e-12, 'the crown');
      t.near(now.reach, S.leg - S.wire > stack ? Math.max(0, -g.tip) : 0, 1e-9, 'how far the legs are folded');
      t.near(now.inPaper, Math.max(0, Math.min(stack, stack - g.tip)), 1e-9, 'how much leg is in the paper');
      t.near(now.hand, now.blade * STAPLER.blade / 160, 1e-9, 'pressed over the blade, the hand pushes as hard');
      forceSamples++;
    }
    const end = staplerAt(plan, 1e6);
    t.ok(end.done && end.phase === 'seated', 'a long press ends seated');
    t.near(end.work, plan.work, 1e-12, 'the work at the end is the whole press');

    const below = S.leg - S.wire, half = (S.crown - S.wire) / 2, reach = Math.max(0, below - stack);
    for (const anvil of [0, 1]) {
      const p = staplerPlan({staple, sheets, anvil});
      t.near(p.through, below - stack, 1e-12, 'leg through the stack');
      t.near(p.half, half, 1e-12, 'from a leg to the middle');
      t.ok(p.meet === (anvil === 0 && reach > half), 'the legs meet only inward, reaching past the middle');
      t.near(p.tipGap, anvil === 0 ? 2 * (half - reach) : 2 * (half + reach), 1e-12, 'between the tips');
      t.near(p.overlap, anvil === 0 ? Math.max(0, 2 * (reach - half)) : 0, 1e-12, 'how far the tips pass each other');
    }
    plansWorked++;
  }
}

// The lever, by the plan: force times distance on both sides of the hinge.
for (let hand = STAPLER_DOMAINS.hand[0]; hand <= STAPLER_DOMAINS.hand[1]; hand += STAPLER_DOMAINS.hand[2]) {
  for (const staple of [0, 2]) for (const sheets of [1, 25, 70]) {
    const plan = staplerPlan({staple, sheets, hand});
    t.near(plan.handPeak * hand, plan.peak.force * STAPLER.blade, 1e-9, 'moments balance at the hardest push');
    for (const f of [0.1, 0.5, 0.9]) {
      const now = staplerAt(plan, plan.duration * f);
      t.near(now.hand * hand, now.blade * STAPLER.blade, 1e-9, 'moments balance');
      t.near(now.handTravel * STAPLER.blade, now.drop * hand, 1e-9, 'the hand moves in proportion to its distance');
      t.near(now.hand * now.handTravel, now.blade * now.drop, 1e-9, 'force times travel is the same on both sides');
    }
  }
}

// 4. The patent's range.
let previousPeak = 0;
for (let sheets = 1; sheets <= 25; sheets++) {
  const plan = staplerPlan({sheets}), pounds = plan.peak.force / LBF;
  t.ok(pounds >= PATENT[0] && pounds <= PATENT[1], `26/6 on ${sheets} sheets: ${pounds} pounds-force`);
  t.ok(plan.peak.phase === 'folding' && plan.peak.force > previousPeak, 'the hardest push comes while folding and grows with the sheets');
  previousPeak = plan.peak.force;
}

// The model, posed.
const m = createStaplerModel(), top = m.topology;
const pose = (values, drop) => {
  m.reset();
  m.update(values);
  m.advance(Math.min(drop, m.getState().seat) / STAPLER.speed);
  m.root.updateMatrixWorld(true);
  return m.getState();
};
const inRoot = (object, point = new THREE.Vector3()) => m.root.worldToLocal(object.localToWorld(point.clone())).divideScalar(MM);
const inCut = (object, point = new THREE.Vector3()) => top.detail.worldToLocal(object.localToWorld(point.clone())).divideScalar(MM * DETAIL);
const ends = (mesh, into) => [into(mesh, new THREE.Vector3(0, -0.5, 0)), into(mesh, new THREE.Vector3(0, 0.5, 0))];
const near3 = (a, b, tolerance, message) => { t.near(a.x, b[0], tolerance, `${message} x`); t.near(a.y, b[1], tolerance, `${message} y`); t.near(a.z, b[2], tolerance, `${message} z`); };

// 5. The lever from the drawn arm.
let leverPoses = 0;
for (let hand = STAPLER_DOMAINS.hand[0]; hand <= STAPLER_DOMAINS.hand[1]; hand += STAPLER_DOMAINS.hand[2]) {
  for (const [staple, sheets] of [[0, 10], [2, 2], [1, 60]]) {
    const values = {staple, sheets, hand};
    let rest = null;
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const state = pose(values, 0), drop = state.seat * f;
      const now = pose(values, drop).now;
      const handLength = top.handArrow.userData.length, tip = new THREE.Vector3(0, handLength, 0);
      const handTip = inRoot(top.handArrow, tip), onArm = top.armPivot.worldToLocal(top.handArrow.localToWorld(tip.clone())).divideScalar(MM);
      t.near(handTip.x, hand, 1e-9, 'the hand pushes at its distance from the hinge');
      t.near(handTip.z, 0, 1e-9, 'on the arm’s middle');
      t.near(onArm.y, 0, 1e-9, 'the hand’s arrow ends on the arm’s top face');
      const bladeUp = ends(top.blade, inRoot), bladeOnArm = top.armPivot.worldToLocal(top.blade.localToWorld(new THREE.Vector3(0, 0.5, 0))).divideScalar(MM);
      t.near(bladeUp[1].x, STAPLER.blade, 1e-9, 'the blade stands at its distance from the hinge');
      t.near(bladeOnArm.y, 0, 1e-9, 'the blade’s top is on the arm’s top face');
      t.near(bladeUp[0].y, TOP - drop, 1e-9, 'the blade’s bottom is on the crown');
      if (f === 0) rest = handTip.y;
      t.near(rest - handTip.y, drop * hand / STAPLER.blade, 1e-9, 'the hand’s drawn travel is the blade’s, in proportion to distance');
      t.near(handLength / MM, now.hand * PER_NEWTON, 1e-9, 'the hand’s arrow on the force scale');
      t.near(top.bladeArrow.userData.length / MM, now.blade * PER_NEWTON, 1e-9, 'the blade’s arrow on the same scale');
      near3(inRoot(top.bladeArrow, new THREE.Vector3(0, top.bladeArrow.userData.length, 0)), [STAPLER.blade, TOP - drop, BODY.arrowZ], 1e-9, 'the blade’s arrow ends at the crown');
      leverPoses++;
    }
  }
}

// 6. The staple, from the drawn wire.
const expectRods = (S, stack, anvil, s) => {
  const crownTop = TOP - s, v = crownTop - S.wire / 2, half = (S.crown - S.wire) / 2, tip = crownTop - S.leg, bottom = Math.max(tip, 0);
  const reach = S.leg - S.wire > stack ? Math.max(0, -tip) : 0, end = side => side * (anvil === 0 ? half - reach : half + reach);
  return {reach, half, rods: [
    [[-half, v, 0], [half, v, 0]],
    [[-half, v, 0], [-half, bottom, 0]],
    [[-half, 0, -S.wire / 2], [end(-1), 0, -S.wire / 2]],
    [[half, v, 0], [half, bottom, 0]],
    [[half, 0, S.wire / 2], [end(1), 0, S.wire / 2]],
  ]};
};
let stapleDrawings = 0;
for (let staple = 0; staple < STAPLES.length; staple++) {
  for (const sheets of [1, 2, 5, 10, 12, 13, 25, 40, 55, 56, 60, 70]) for (const anvil of [0, 1]) {
    const S = STAPLES[staple], stack = sheets * SHEET, values = {staple, sheets, anvil};
    for (const f of [0, 0.5, 0.66, 0.75, 0.85, 0.95, 1]) {
      const drop = pose(values, 0).seat * f, state = pose(values, drop), now = state.now, {reach, half, rods} = expectRods(S, stack, anvil, drop);
      rods.forEach(([from, to], i) => {
        const [a, b] = ends(top.cutRods[i], inCut);
        near3(a, from, 1e-7, `cut wire ${i} starts`);
        near3(b, to, 1e-7, `cut wire ${i} ends`);
        t.near(top.cutRods[i].scale.x / (MM * DETAIL), S.wire / 2, 1e-12, 'the cut wire is as thick as the staple’s');
        const [c, d] = ends(top.stapleRods[i], inRoot);
        near3(c, [STAPLER.blade, from[1], from[0]], 1e-7, `true-size wire ${i} starts`);
        near3(d, [STAPLER.blade, to[1], to[0]], 1e-7, `true-size wire ${i} ends`);
      });
      const legLength = side => ends(top.cutRods[side], inCut).reduce((p, q) => p.distanceTo(q)) + ends(top.cutRods[side + 1], inCut).reduce((p, q) => p.distanceTo(q));
      t.near(legLength(1), S.leg - S.wire / 2, 1e-7, 'the left leg keeps its length as it folds');
      t.near(legLength(3), S.leg - S.wire / 2, 1e-7, 'the right leg keeps its length as it folds');
      t.ok((top.cutRods[2].material === top.crossedMaterial) === (anvil === 0 && reach > half) && top.cutRods[4].material === top.cutRods[2].material, 'crossing legs, and only they, are red');
      t.near(top.cutPaper.scale.y / (MM * DETAIL), stack, 1e-12, 'the cut’s paper is the stack');
      t.near(top.paperBlock.scale.y / MM, stack, 1e-12, 'the true-size paper is the stack');
      t.near((top.cutPaper.position.y - top.cutPaper.scale.y / 2) / (MM * DETAIL), 0, 1e-12, 'the paper lies on the anvil');
      t.near((top.cutBlade.position.y - top.cutBlade.scale.y / 2) / (MM * DETAIL), TOP - drop, 1e-9, 'the cut’s blade is on the crown');
      for (const wall of top.cutWalls) t.near((wall.position.y - wall.scale.y / 2) / (MM * DETAIL), Math.max(STAPLER.gap - drop, stack), 1e-9, 'the nose’s sides come down onto the paper');
      for (const solid of [top.cutPaper, top.cutBlade, ...top.cutWalls, ...top.grooves]) t.ok((solid.position.z + solid.scale.z / 2) / (MM * DETAIL) <= -S.wire / 2 - 1e-9, 'the cut’s solids stand behind the staple’s wire, so the wire shows');
      if (reach > 0) {
        const groove = g => [(g.position.x - g.scale.x / 2) / (MM * DETAIL), (g.position.x + g.scale.x / 2) / (MM * DETAIL)];
        for (const i of [2, 4]) {
          const tipU = ends(top.cutRods[i], inCut)[1].x;
          t.ok(top.grooves.some(g => { const [lo, hi] = groove(g); return tipU >= lo - 1e-9 && tipU <= hi + 1e-9; }), 'each folded tip lies over a groove');
        }
      }
      if (f === 1) t.near(now.reach, reach, 1e-9, 'the fold at the end');
      stapleDrawings++;
    }
  }
}
const meetUpTo = staple => { let last = null; for (let sheets = 1; sheets <= 70; sheets++) if (STAPLES[staple].leg - STAPLES[staple].wire - sheets * SHEET > (STAPLES[staple].crown - STAPLES[staple].wire) / 2) last = sheets; return last; };
const insideFrom = staple => { for (let sheets = 1; sheets <= 70; sheets++) if (STAPLES[staple].leg - STAPLES[staple].wire - sheets * SHEET <= 0) return sheets; return null; };
t.ok(meetUpTo(0) === null && meetUpTo(1) === null, 'short legs never meet');
t.ok(meetUpTo(2) === 12, '24/8 legs meet on 12 sheets or fewer');
for (let sheets = 1; sheets <= 70; sheets++) t.ok(staplerPlan({staple: 2, sheets}).meet === (sheets <= meetUpTo(2)), 'the plan agrees where 24/8 legs meet');
t.ok(insideFrom(0) === 56 && insideFrom(1) === 55 && insideFrom(2) === null, 'where the tips stay inside the stack');

top.cutAnvil.geometry.computeBoundingBox();
t.ok((top.cutAnvil.position.z + top.cutAnvil.geometry.boundingBox.max.z) / (MM * DETAIL) <= -Math.max(...STAPLES.map(S => S.wire)) / 2, 'the cut’s anvil stands behind the staple’s wire');

// 7. The drawing holds together.
let clearancePoses = 0;
const lidTop = xl => inRoot(top.magazinePivot, new THREE.Vector3(xl * MM, BODY.magazine.tall * MM, 0));
const armBottom = xl => inRoot(top.armPivot, new THREE.Vector3(xl * MM, -BODY.arm.thick * MM, 0));
const magazineBottom = xl => inRoot(top.magazinePivot, new THREE.Vector3(xl * MM, 0, 0));
for (const staple of [0, 2]) for (const sheets of [1, 10, 30, 56, 70]) for (const hand of [80, 160]) {
  const values = {staple, sheets, hand}, seat = pose(values, 0).seat, stack = sheets * SHEET;
  for (let k = 0; k <= 20; k++) {
    const drop = seat * k / 20, now = pose(values, drop).now;
    const lid = Array.from({length: 85}, (_, i) => lidTop(BODY.magazine.x0 + i * (BODY.magazine.x1 - BODY.magazine.x0) / 84));
    for (let i = 0; i <= 90; i++) {
      const p = armBottom(BODY.arm.x0 + i * (BODY.arm.x1 - BODY.arm.x0) / 90), j = lid.findIndex((q, n) => n + 1 < lid.length && q.x <= p.x && lid[n + 1].x >= p.x);
      if (j < 0) continue;
      const y = lid[j].y + (lid[j + 1].y - lid[j].y) * (p.x - lid[j].x) / (lid[j + 1].x - lid[j].x);
      t.ok(p.y - y > 0.2, `the arm stays clear of the magazine: ${p.y - y} mm at ${p.x} mm`);
    }
    const corner = magazineBottom(BODY.magazine.x1);
    t.near(corner.y, now.nose, 1e-9, 'the nose’s front corner is where the press puts it');
    for (let xl = BODY.paper.x0; xl <= BODY.magazine.x1; xl += 2) t.ok(magazineBottom(xl).y >= stack - 1e-9, 'the magazine never presses into the paper');
    t.ok(magazineBottom(BODY.magazine.x0).y > BODY.base.y1, 'the magazine stays above the base');
    const coilBottom = top.returnCoil.position.y / MM, coilTop = armBottom(BODY.returnSpring.x).y;
    t.ok(Math.abs(coilBottom - lidTop(BODY.returnSpring.x).y) < 0.05 && Math.abs(top.returnCoil.position.x / MM - BODY.returnSpring.x) < 1e-9, 'the return spring sits on the magazine');
    top.returnCoil.geometry.computeBoundingBox();
    const coilHeight = (top.returnCoil.geometry.boundingBox.max.y - top.returnCoil.geometry.boundingBox.min.y) / MM - 2 * BODY.springWire;
    t.ok(coilHeight > 0.3 && Math.abs(coilBottom + coilHeight - coilTop) < 0.05, 'the return spring reaches the arm without passing through it');
    top.magazineCoil.geometry.computeBoundingBox();
    const magazineCoilTop = top.magazineCoil.position.y / MM + (top.magazineCoil.geometry.boundingBox.max.y - top.magazineCoil.geometry.boundingBox.min.y) / MM - 2 * BODY.springWire;
    t.ok(Math.abs(top.magazineCoil.position.y / MM - BODY.base.y1) < 1e-9 && Math.abs(magazineCoilTop - magazineBottom(BODY.magazineSpring.x).y) < 0.05, 'the magazine spring stands on the base under the magazine');
    clearancePoses++;
  }
}
const stripTop = (top.strip.position.y + top.strip.scale.y / 2) / MM + BODY.magazinePin, lidUnder = BODY.magazinePin + BODY.magazine.tall - BODY.magazine.wall;
for (const staple of [0, 2]) { pose({staple}, 0); t.ok((top.strip.position.y - top.strip.scale.y / 2) / MM > 0 && stripTop < lidUnder, 'the strip fits in the magazine'); t.near(stripTop, TOP, 1e-9, 'the strip’s crowns ride where the front staple’s does'); }

// 8. The chart.
const linePoints = line => { const a = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: n}, (_, i) => [(a[3 * i] - CHART.x) / CHART.w * CHART.travel, (a[3 * i + 1] - CHART.y) / CHART.h * CHART.force]); };
const clipAt = points => points.flatMap(([x, y], i) => {
  const out = [], q = points[i - 1];
  if (q && x !== q[0] && (q[1] - CHART.force) * (y - CHART.force) < 0) out.push([q[0] + (CHART.force - q[1]) / (y - q[1]) * (x - q[0]), CHART.force]);
  out.push([x, Math.min(y, CHART.force)]);
  return out;
});
const area = points => points.reduce((sum, [x, y], i) => (i ? sum + (x - points[i - 1][0]) * (y + points[i - 1][1]) / 2 : 0), 0);
let chartReads = 0;
for (const staple of [0, 1, 2]) for (const sheets of [1, 10, 40, 60, 70]) for (const hand of [80, 120, 160]) {
  const plan = pose({staple, sheets, hand}, 0), profile = pieceProfiles.get(`${staple}/${sheets}`), ratio = STAPLER.blade / hand;
  const handProfile = profile.map(([x, y]) => [x / ratio, y * ratio]);
  t.near(area(profile), plan.work * 1000, 1e-9, 'the area under the blade’s line is the work');
  t.near(area(handProfile), plan.work * 1000, 1e-9, 'the area under the hand’s line is the same work');
  for (const [line, points] of [[top.bladeLine, clipAt(profile)], [top.handLine, clipAt(handProfile)]]) {
    const drawn = linePoints(line);
    assert.equal(drawn.length, points.length, 'every corner of the line is drawn');
    drawn.forEach(([x, y], i) => { t.near(x, Math.min(points[i][0], CHART.travel), 2e-4, 'chart travel'); t.near(y, points[i][1], 2e-3, 'chart force'); });
  }
  const marks = linePoints(top.stageMarks), stages = [plan.closed, plan.touch, plan.anvil].filter(drop => drop !== null);
  assert.equal(marks.length, 2 * stages.length);
  stages.forEach((drop, i) => { t.near(marks[2 * i][0], drop, 2e-4, 'a stage mark'); t.near(marks[2 * i + 1][0], drop, 2e-4, 'a stage mark stands upright'); });
  for (const f of [0.3, 0.8, 1]) {
    const now = pose({staple, sheets, hand}, plan.seat * f).now;
    const cursor = line => { const p = linePoints(line); return [(p[0][0] + p[1][0]) / 2, (p[2][1] + p[3][1]) / 2]; };
    const [bx, by] = cursor(top.bladeCursor), [hx, hy] = cursor(top.handCursor);
    t.near(bx, Math.min(now.drop, CHART.travel), 2e-4, 'the blade’s cursor travel');
    t.near(by, Math.min(now.blade, CHART.force), 2e-3, 'the blade’s cursor force');
    t.near(hx, Math.min(now.handTravel, CHART.travel), 2e-4, 'the hand’s cursor travel');
    t.near(hy, Math.min(now.hand, CHART.force), 2e-3, 'the hand’s cursor force');
  }
  chartReads++;
}

// 9. The lesson.
const run = values => staplerPlan(values);
const claims = {
  'Press over the blade': plan => ({'1.0': plan.stack, '4.6': plan.through}),
  'Press near the hinge': plan => ({'2.0': plan.ratio, '8.0': plan.seat / plan.ratio, '16.1': plan.seat}),
  'A thick stack': plan => ({'4.0': plan.stack, '1.6': plan.through, '161.0': plan.peak.force}),
  'Too thick to staple': plan => ({'6.0': plan.stack, '5.6': plan.below}),
  'Long legs on thin paper': plan => ({'7.3': plan.through, '0.2': plan.stack, '6.19': plan.half, '2.19': plan.overlap}),
  'Pin instead': plan => ({'26.97': plan.tipGap}),
  'Thicker wire': plan => ({'0.511': plan.wire, '2.01': plan.foldRatio, '0.405': STAPLES[0].wire, '89.0': staplerPlan({...plan.values, staple: 0}).peak.force, '145.5': plan.peak.force}),
  'More sheets, a harder press': plan => ({'2.5': plan.stack, '125.0': plan.peak.force, '28.1': plan.peak.force / LBF, '2': 2, '15.7': staplerPlan({...plan.values, sheets: 2}).peak.force / LBF, '15': PATENT[0], '30': PATENT[1]}),
};
checkTrialNumbers(lesson, claims, run, t);
const trial = title => run(lesson.tryIt.find(item => item.title === title).values);
t.ok(trial('Press over the blade').ratio === 1 && trial('Press over the blade').inward, 'over the blade the hand pushes exactly as hard, and the legs fold toward the middle');
t.ok(trial('Press near the hinge').ratio === 2 && trial('Press near the hinge').values.hand * 2 === STAPLER.blade, 'twice as high, half as wide, half as far out');
t.ok(trial('A thick stack').stack === 4 * trial('Press over the blade').stack, 'four times as much paper');
t.ok(trial('Too thick to staple').through < 0 && trial('Too thick to staple').peak.phase === 'piercing', 'the tips stop inside the paper');
t.ok(trial('Long legs on thin paper').meet, 'long legs run past each other');
t.ok(Array.from({length: 70}, (_, i) => staplerPlan({staple: 2, sheets: i + 1, anvil: 1}).meet).every(meet => !meet), 'folded outward, legs can never meet');
t.ok(trial('More sheets, a harder press').peak.phase === 'folding', 'the hardest push comes as the legs fold');
t.near(trial('Thicker wire').foldRatio, cube, 1e-6, 'the thicker wire’s fold by the integrated cube law');

const S0 = STAPLES[0], deeper = lesson.deeper.map(item => item.body);
checkQuotedText(deeper[0], {'80 mm': `${fixed(STAPLER.blade / 2, 0)} mm`, '160 mm': `${fixed(STAPLER.blade, 0)} mm`}, t);
checkQuotedText(deeper[1], {'0.15 mm': `${fixed(FORCES.breakTravel, 2)} mm`}, t);
for (let staple = 0; staple < STAPLES.length; staple++) for (let sheets = 1; sheets <= 70; sheets++) { const plan = staplerPlan({staple, sheets}); if (plan.through > 0) t.ok(plan.peak.phase === 'folding', 'the fold is the hardest part whenever there is leg to fold'); }
checkQuotedText(deeper[2], {'5.595 mm': `${fixed(S0.leg - S0.wire, 3)} mm`, '10 sheets leave 4.595 mm': `10 sheets leave ${fixed(staplerPlan({sheets: 10}).through, 3)} mm`, 'from 56 sheets': `from ${insideFrom(0)} sheets`}, t);
checkQuotedText(deeper[3], {'6.15 mm': `${fixed((S0.crown - S0.wire) / 2, 2)} mm`, '5.495 mm': `${fixed(staplerPlan({sheets: 1}).through, 3)} mm`, '12 sheets or fewer': `${meetUpTo(2)} sheets or fewer`}, t);
checkQuotedText(deeper[4], {'1.26 times': `${fixed(STAPLES[1].wire / S0.wire, 2)} times`, '2.01 times': `${fixed(cube, 2)} times`, 'diameter cubed over 6': `diameter cubed over ${fixed(STAPLES[1].wire ** 3 / integral.get(STAPLES[1].wire), 0)}`}, t);
checkQuotedText(deeper[6], {'0.1 mm': `${fixed(SHEET, 1)} mm`, '97 to 114': `${fixed(BOND[0] * 1000, 0)} to ${fixed(BOND[1] * 1000, 0)}`}, t);
checkQuotedText(limits, {
  'blade 160 mm': `blade ${fixed(STAPLER.blade, 0)} mm`, 'nose 9 mm': `nose ${fixed(STAPLER.gap, 0)} mm`,
  '26/6 of 0.405 mm wire with a 12.7 mm crown': `${S0.name} of ${fixed(S0.wire, 3)} mm wire with a ${fixed(S0.crown, 1)} mm crown`,
  '24/6 and 24/8 of 0.511 mm wire with a 12.9 mm crown': `${STAPLES[1].name} and ${STAPLES[2].name} of ${fixed(STAPLES[2].wire, 3)} mm wire with a ${fixed(STAPLES[2].crown, 1)} mm crown`,
  'Each sheet 0.1 mm': `Each sheet ${fixed(SHEET, 1)} mm`,
  'magazine spring of 3 N, rising 0.2 N': `magazine spring of ${fixed(FORCES.magazine, 0)} N, rising ${fixed(FORCES.magazineRate, 1)} N`,
  'return spring of 5 N, rising 0.5 N': `return spring of ${fixed(FORCES.spring, 0)} N, rising ${fixed(FORCES.springRate, 1)} N`,
  'gives way at 40 N after 0.15 mm': `gives way at ${fixed(FORCES.breakOff, 0)} N after ${fixed(FORCES.breakTravel, 2)} mm`,
  '6 N at each tip': `${fixed(FORCES.cut, 0)} N at each tip`, '12 N for every millimeter': `${fixed(FORCES.friction, 0)} N for every millimeter`,
  '28 N to fold each leg of 0.405 mm wire': `${fixed(FORCES.fold, 0)} N to fold each leg of ${fixed(S0.wire, 3)} mm wire`,
  '15 to 30 pounds-force': `${PATENT[0]} to ${PATENT[1]} pounds-force`, 'from 1 to 25 sheets': 'from 1 to 25 sheets',
  '4 mm a second': `${fixed(STAPLER.speed, 0)} mm a second`,
}, t);
checkQuotedText(lesson.quiz.explanation, {'7.3 mm': `${fixed(trial('Long legs on thin paper').through, 1)} mm`, '6.19 mm': `${fixed(trial('Long legs on thin paper').half, 2)} mm`, '5.495 mm': `${fixed(staplerPlan({sheets: 1}).through, 3)} mm`, '6.15 mm': `${fixed(staplerPlan({}).half, 2)} mm`}, t);
t.ok(meetUpTo(0) === null && staplerPlan({sheets: 1}).through < staplerPlan({}).half, 'a 26/6 leg never comes out as far as the middle');
const partText = id => m.parts.find(item => item.id === id).description;
checkQuotedText(partText('detail'), {'6 times larger': `${fixed(DETAIL, 0)} times larger`, 'every 10 sheets': `every ${fixed(CUT.lineEvery, 0)} sheets`}, t);
checkQuotedText(partText('push'), {'0.3 mm long for every newton': `${fixed(PER_NEWTON, 1)} mm long for every newton`}, t);
checkQuotedText(partText('magazine'), {'17.5 mm above the anvil': `${fixed(TOP, 1)} mm above the anvil`}, t);
checkQuotedText(partText('arm'), {'160 mm': `${fixed(STAPLER.blade, 0)} mm`}, t);
checkQuotedText(partText('chart'), {'300 N': `${fixed(CHART.force, 0)} N`, '20 mm': `${fixed(CHART.travel, 0)} mm`}, t);
checkQuotedText(partText('paper'), {'0.1 mm for every sheet': `${fixed(SHEET, 1)} mm for every sheet`}, t);
checkQuotedText(lesson.parts.find(item => item.name === 'Cut across the nose').role, {'6 times larger': `${fixed(DETAIL, 0)} times larger`}, t);
checkQuotedText(m.playback.description, {'4 mm a second': `${fixed(STAPLER.speed, 0)} mm a second`}, t);
t.ok(lesson.parts.every(item => m.parts.some(p => p.name === item.name)), 'every part the lesson names is drawn');

checkControlsMove(m, () => [top.paperBlock.scale.y, top.strip.scale.y, top.handArrow.position.toArray(), top.cutRods.map(rod => rod.position.toArray()), top.grooves.map(groove => groove.position.toArray())], model => model.advance(100), t);
for (const values of [{}, {staple: 2, sheets: 2}, {sheets: 70, hand: 80}]) for (const f of [0, 0.5, 1]) { pose(values, pose(values, 0).seat * f); checkFinite(m.root, t); }
checkRefusals(sampleStapler, STAPLER_DOMAINS, t);

// Playback, actions and the result.
m.reset();
m.playback.step();
t.near(m.getState().now.drop, 0.1, 1e-12, 'a step moves the blade 0.1 mm');
t.ok(!m.playback.complete() && !m.resultPart.available(), 'not done after a step');
m.advance(100);
t.ok(m.playback.complete() && m.resultPart.available() && m.getState().now.done, 'done at the end of the press');
m.reset();
t.ok(!m.playback.complete() && m.getState().now.drop === 0, 'reset starts the press again');
m.animate(0.5);
m.animate(1.5);
t.near(m.getState().now.drop, 1.5 * STAPLER.speed, 1e-12, 'animate follows the clock');
for (const values of [{}, {sheets: 60}, {staple: 2, sheets: 2, anvil: 1}]) {
  m.reset();
  m.update(values);
  const s = m.getState();
  m.actions[0].run();
  t.ok(m.getState().now.phase === 'piercing', 'the first inspection shows the legs piercing');
  t.near(m.getState().now.drop, s.touch + Math.min(s.stack, s.below) / 2, 1e-9, 'halfway through the paper');
  m.actions[1].run();
  t.ok(m.getState().now.phase === (s.through > 0 ? 'folding' : 'seated'), 'the second shows the legs folding, if they can');
  for (const action of m.actions.slice(2)) { action.run(); t.ok(m.getState().now.done, 'the lever and the chart are shown at the end'); }
}
const resources = checkDisposal(m, t);

console.log(`PASS stapler: ${t.count} checks, ${plansWorked} presses worked out again from where their parts are, ${stageChanges} stage changes found by bisection, ${forceSamples} forces rebuilt, ${leverPoses} arm poses read for the lever, ${stapleDrawings} staples read off the drawn wire, ${clearancePoses} poses held clear, ${chartReads} charts read back, ${lesson.tryIt.length} trials, ${resources} resources released exactly once.`);

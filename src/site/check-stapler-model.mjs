// Independent source, section-integration, contact, force/work and cycle checks.
import assert from 'node:assert/strict';
import {tally, checkTrialNumbers, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {staplerPlan, staplerAt, bladeForce, phaseAt, sampleStapler, plasticModulus, foldForce, LBF, STAPLES, SHEET, STAPLER, FORCES, STAPLER_DOMAINS, workTo} from './stapler-physics.js';
import {staplerCyclePlan, staplerCycleAt, STAPLER_CYCLE} from './stapler-cycle.js';
import {createStaplerModel} from './stapler-model.js';
import {staplerLesson as lesson} from './stapler-lessons.js';
const t = tally(), TOP = 17.5;
// Manufacturer dimensions for the two 6 mm examples; the 8 mm comparison is assigned.
assert.deepEqual(STAPLES.map(s => [s.crown, s.wire, s.width, s.leg]), [[12.85,.40,.50,6],[12.85,.45,.50,6],[12.85,.45,.50,8]]);
t.near(LBF, 4.4482216152605, 1e-12, 'pound-force definition');
t.near(SHEET, .1, 1e-12, 'assigned sheet thickness');
const integral = new Map();
for (const S of STAPLES) {
  let sum = 0; const n = 20000, dy = S.wire / n;
  for (let i = 0; i < n; i++) sum += Math.abs(-S.wire / 2 + (i + .5) * dy) * S.width * dy;
  integral.set(S.wire, sum);
  t.near(plasticModulus(S.wire, S.width), sum, 1e-12, 'integrate absolute distance across rectangular section');
}
const foldBy = wire => 28 * integral.get(wire) / integral.get(.4);
for (const S of STAPLES) t.near(foldForce(S.wire, S.width), foldBy(S.wire), 1e-9, 'fold force from independent section integration');
t.near(foldBy(.45) / foldBy(.4), 1.265625, 1e-12, 'rectangular thickness-squared ratio');

// 3. The press from where its parts are.
const closeCache = new Map();
// Intersect x=160 with the rail line through two independently rotated points.
const crownAtAngle = angle => {
  const point = x => [x * Math.cos(angle) + 8.5 * Math.sin(angle), 9 - x * Math.sin(angle) + 8.5 * Math.cos(angle)];
  const a = point(0), b = point(166);
  return a[1] + (b[1] - a[1]) * (160 - a[0]) / (b[0] - a[0]);
};
const bisect = (fn, target, lo = 0, hi = .1) => {for (let i = 0; i < 55; i++) {const mid = (lo + hi) / 2; if (fn(mid) < target) lo = mid; else hi = mid;} return (lo + hi) / 2;};
const closedOf = stack => {
  if (!closeCache.has(stack)) closeCache.set(stack, 17.5 - crownAtAngle(bisect(a => 166 * Math.sin(a), 9 - stack)));
  return closeCache.get(stack);
};
const where = (staple, stack, s) => {
  const closed = closedOf(stack), crownTop = TOP - s;
  return {get nose() {return 9 - 166 * Math.sin(bisect(a => TOP - crownAtAngle(a), Math.min(s, closed)));}, drive: s - closed, crownTop, tip: crownTop - staple.leg};
};
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
  if (stage === 'closing') return FORCES.magazine + FORCES.magazineRate * s;
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

// Complete cycles: contact order, return clearance, one-pitch feed and stop.
let cycleSamples = 0, interferenceStops = 0;
for (let staple = 0; staple < 3; staple++) for (let sheets = 1; sheets <= 70; sheets++) for (const anvil of [0, 1]) {
  const plan = staplerPlan({staple, sheets, anvil}), cycle = staplerCyclePlan(plan);
  const end = plan.meet ? 17.5 - plan.leg + plan.half : 17.5 - plan.wire - plan.stack;
  t.near(cycle.pressEnd, end, 1e-11, 'stop from crown seating or tip contact geometry');
  t.near(cycle.work, workTo(plan, end), 1e-12, 'no work beyond interference');
  let area = 0;
  cycle.profile.forEach((point, i) => {if (i) {const prev = cycle.profile[i - 1]; area += (point.drop - prev.drop) * (point.force + prev.force) / 2;}});
  t.near(area / 1000, cycle.work, 1e-10, 'truncated profile integrates to stop work');
  for (let i = 0; i <= 200; i++) {
    const now = staplerCycleAt(plan, cycle.duration * i / 200);
    t.ok(now.nose >= plan.stack - 1e-10, 'magazine stays above stack');
    t.ok(!plan.inward || now.press.reach <= plan.half, 'inward tips never overlap');
    t.ok(now.feedTravel >= 0 && now.feedTravel <= plan.staple.width, 'feed within one pitch');
    if (now.feedTravel > 0) {t.ok(now.driverBottom >= TOP + .3 - 1e-10, 'driver clear before feed'); t.near(now.magazineDrop, 0, 1e-12, 'magazine fully raised before feed');}
    if (now.t >= cycle.pressFinish) t.near(now.press.drop, end, 1e-10, 'deposited staple remains still during return');
    t.ok(now.forceEvaluated === (now.t >= cycle.pressStart && now.t < cycle.pressFinish), 'no calculated press force during return/feed');
    cycleSamples++;
  }
  const done = staplerCycleAt(plan, 100);
  t.ok(done.done && done.remaining === 7, 'one of eight staples consumed');
  if (plan.meet) {interferenceStops++; t.ok(done.phase === 'interference' && done.feed === 0, 'interference stops without feeding');}
  else {t.ok(done.phase === 'ready' && done.feed === 1, 'successful return reaches next staple ready'); t.near(done.driverBottom, 17.8, 1e-12, 'rest clearance');}
}
t.ok(interferenceStops === 13, 'long inward specimens stop on 13 sheet settings');

// Every numerical claim in each trial is tied to its selected observation.
const run = values => {const p = staplerPlan(values); return {...p, cycle: staplerCyclePlan(p)};};
const claims = {
  'One complete cycle': p => ({'10': p.values.sheets, '4.60': p.through, '0.50': p.staple.width}),
  'Magazine on the paper': p => ({'1.00': p.stack, '7.710': p.closed}),
  'The strip lets go': p => ({'0.15': p.broken - p.closed}),
  'Halfway through the paper': p => ({'0.50': p.stack / 2, '1.00': p.stack}),
  'Watch the fold grow': p => ({'2.00': 2, '2.60': p.through - 2}),
  'Return after the press': () => ({}),
  'Before the next feed': p => ({'0.30': STAPLER_CYCLE.clearance, '0.50': p.staple.width}),
  'Next staple ready': p => ({'0.50': p.staple.width}),
  'Press near the hinge': p => ({'80': p.values.hand, '16.10': p.seat, '8.05': p.seat / p.ratio, '0.484': p.cycle.work}),
  'A thick stack': p => ({'4.00': p.stack, '1.60': p.through, '161.1': p.cycle.peak}),
  'Too short for a clinch': p => ({'6.00': p.stack, '0.40': -p.through}),
  'Long legs meet': p => ({'7.35': p.through, '6.20': p.half, '1.15': p.seat - p.cycle.pressEnd}),
  'Turn the ends outward': p => ({'7.35': p.through, '27.10': p.tipGap}),
  'Thicker rectangular wire': p => ({'0.40': STAPLES[0].wire, '0.45': p.wire, '0.50': p.staple.width, '1.266': p.foldRatio}),
  'Keep the whole force curve': p => ({'70': p.values.sheets, '80': p.values.hand, '495.9': p.cycle.handPeak}),
};
checkTrialNumbers(lesson, claims, run, t);
const m = createStaplerModel();
let steppedControls = 0;
for (const [key, [lo, hi, step]] of Object.entries(STAPLER_DOMAINS)) for (let value = lo; value <= hi; value += step) {
  const settings = {[key]: value};
  m.reset({settings, time: 2.5}); const expected = m.getState().readings;
  m.reset({settings}); for (let i = 0; i < 100; i++) m.playback.step();
  assert.deepEqual(m.getState().readings, expected, 'many small steps match direct observation at a force-stage boundary'); steppedControls++;
}
for (const experiment of lesson.tryIt) {
  m.reset(experiment.initialState);
  t.ok(m.getState().clock > 0, 'trial opens at its observation, not Ready');
  t.ok(m.parts.some(part => part.id === experiment.part), 'trial target exists');
  t.ok(experiment.isolate === true, 'separate inspection views do not overlap');
  t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(m.getState().readings)), 'finite learner readings');
}
t.ok(lesson.parts.every(item => m.parts.some(p => p.name === item.name)), 'named lesson parts are drawn');
for (const action of m.actions) {const before = JSON.stringify(m.getState()); action.run(); assert.equal(JSON.stringify(m.getState()), before); t.ok(action.replay === false, 'inspection preserves time/settings');}
m.reset({settings: {hand: 80, sheets: 40}, time: 2}); assert.deepEqual(m.replayState(), {settings: {...m.defaults, hand: 80, sheets: 40}, time: 0});
m.reset(m.replayState()); t.near(m.getState().clock, 0, 1e-12, 'replay starts chosen experiment');
m.playback.step(); t.near(m.getState().clock, .025, 1e-12, 'single step');
m.advance(100); t.ok(m.playback.complete() && m.resultPart.available(), 'completion and result inspection');
const endState = JSON.stringify(m.getState()); m.advance(100); assert.equal(JSON.stringify(m.getState()), endState);
m.reset(); m.animate(.5); m.animate(1.5); t.near(m.getState().clock, 1.5, 1e-12, 'absolute animation clock');
checkRefusals(sampleStapler, STAPLER_DOMAINS, t);
for (const settings of [{}, {staple: 2, sheets: 2}, {sheets: 70, hand: 80}]) {m.reset({settings, time: 100}); checkFinite(m.root, t);}
const resources = checkDisposal(m, t);
console.log(JSON.stringify({passed: true, checks: t.count, plansWorked, stageChanges, forceSamples, cycleSamples, interferenceStops, steppedControls, trials: lesson.tryIt.length, resources}));

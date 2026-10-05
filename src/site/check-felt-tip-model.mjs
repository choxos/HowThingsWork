import assert from 'node:assert/strict';
import * as THREE from 'three';
import {feltTipPlan, feltTipAt, feltTipPaperAt, sampleFeltTip, FELT_DOMAINS} from './pens-physics.js';
import {createFeltTipModel, MM, STRIPS, CHART, KPA, PORES, CLOSE} from './felt-tip-model.js';
import {feltTipLesson as lesson} from './pens-lessons.js';
import {tally, checkRefusals, checkDisposal, checkFinite} from './model-check-kit.mjs';

const t = tally(), m = createFeltTipModel(), B = m.topology;
const fluids = [{gamma: .0728, eta: .0010016}, {gamma: .02227, eta: .0012}];
let poses = 0, rows = 0, integrals = 0;
const reset = (settings, time) => {m.reset({settings, time}); m.root.updateMatrixWorld(true); return m.getState();};
// Independent overlap of the row's contact interval and the elapsed experiment.
function exposure(x, time, speed, hold) {
  if (x < -.5 || x > 40.5) return 0;
  const movingEnd = Math.min(time, 40 / speed);
  const start = Math.max(0, (x - .5) / speed), end = Math.min(movingEnd, (x + .5) / speed);
  const moving = Math.max(0, end - start);
  const stationary = Math.abs(x - 40) <= .5 ? Math.min(hold, Math.max(0, time - 40 / speed)) : 0;
  return moving + stationary;
}
for (const ink of [0, 1]) for (let speed = 5; speed <= 40; speed += 5) for (let hold = 0; hold <= 4; hold++) for (let pore = 5; pore <= 25; pore += 5) {
  const values = {ink, speed, hold, pore}, fluid = fluids[ink], pace = .5 * Math.sqrt(fluid.gamma / fluid.eta / (fluids[0].gamma / fluids[0].eta));
  const stroke = 40 / speed, duration = stroke + hold;
  for (const time of [0, .001, stroke / 2, stroke - .5 / speed, stroke, stroke + hold / 2, duration, duration + 5]) {
    const s = reset(values, time), elapsed = Math.min(time, duration), travel = Math.min(40, speed * elapsed);
    t.near(s.clock, elapsed, 1e-12, 'bounded experiment time');
    t.near(s.now.travel, travel, 1e-12, 'constant speed then fixed endpoint');
    t.near(B.carriage.position.x / MM, travel, 1e-10, 'connected pen follows the tip');
    t.near(s.nibPull, 2 * fluid.gamma / (pore * 1e-6), 1e-9, 'local meniscus pressure');
    t.near(s.reservoirPull, 2 * fluid.gamma / 50e-6, 1e-9, 'core reference pressure');
    t.near(s.endWidth, 1 + 2 * pace * Math.sqrt(.5 / speed + hold), 1e-12, 'end center receives half a transit before the hold');
    t.ok(B.line.visible === (elapsed > 0), 'no ink before first contact');
    const a = B.line.geometry.attributes.position;
    for (let i = 0; i <= STRIPS; i++) {
      const x = -.5 + (travel + 1) * i / STRIPS;
      const width = elapsed > 0 ? 1 + 2 * pace * Math.sqrt(exposure(x, elapsed, speed, hold)) : 0;
      t.near(a.getX(2 * i) / MM, x, 3e-6, 'row lies in reached footprint');
      t.near((a.getZ(2 * i + 1) - a.getZ(2 * i)) / MM, width, 3e-6, 'mesh follows actual local feeding time');
      t.near(a.getY(2 * i) / MM, .03, 1e-8, 'visible film above paper'); rows++;
    }
    for (const [name, x] of [['middle', 20], ['end', 40]]) {
      t.near(s.now[name].exposure, exposure(x, elapsed, speed, hold), 2e-12, 'named row history');
      t.ok(s.now[name].wet === (elapsed > 0 && travel + .5 >= x - 1e-10), 'no future ink at a named row');
    }
    const p = B.cursor.geometry.attributes.position;
    t.near(((p.getX(0) + p.getX(1)) / 2 - CHART.x) / CHART.w * CHART.time, s.now.end.exposure, 1e-6, 'chart cross reports end-row feeding time');
    t.near((p.getY(0) - CHART.y) / CHART.h * CHART.soak, pace * Math.sqrt(s.now.end.exposure), 1e-6, 'chart cross reports local spread');
    for (const [i, pressure] of [s.reservoirPull, s.nibPull].entries()) t.near(B.bars[i].scale.y / MM / KPA * 1000, pressure, 1e-8, 'pressure bars match calculated values');
    const bounds = m.frameBoundsForPart('system');
    for (const mesh of [B.sheet, B.rearPlug, B.core, B.nibCone]) t.ok(bounds.clone().expandByScalar(.002).containsBox(new THREE.Box3().setFromObject(mesh)), 'writing experiment fits reserved motion bounds');
    t.ok(B.pores.userData.inspectionOnly === 'pores' && B.chart.userData.inspectionOnly === 'chart', 'separate diagrams appear in their named inspection views');
    t.ok(s.readings.every(r => !/NaN|undefined|Infinity/.test(r.value + (r.hint || ''))), 'finite readings'); poses++;
  }
  // Integrate viscous resistance along the growing liquid column.
  const radius = pore * 1e-6, pressure = 2 * fluid.gamma / radius, n = 100, dL = .01 / n;
  let fillTime = 0;
  for (let i = 0; i < n; i++) fillTime += 8 * fluid.eta * (i + .5) * dL / (radius * radius * pressure) * dL;
  t.near(m.getState().wick, fillTime, 1e-12, 'dry-pore time independently integrated from Poiseuille resistance');
  const before = JSON.stringify({values: m.getState().values, now: m.getState().now});
  for (const action of m.actions) {action.run(); t.ok(before === JSON.stringify({values: m.getState().values, now: m.getState().now}), 'inspection preserves experiment');}
  m.reset(m.replayState()); assert.deepEqual(m.getState().values, values); t.near(m.getState().clock, 0, 0, 'replay clears time only');
}
// Numerical time integration uses only a moving square footprint, not interval formulas.
for (const speed of [5, 20, 40]) for (const hold of [0, 2, 4]) for (const x of [0, .25, 10, 20, 39.25, 39.75, 40, 40.25, 41]) {
  const plan = feltTipPlan({speed, hold}), n = 60000, dt = plan.duration / n;
  let integral = 0;
  for (let i = 0; i < n; i++) {const center = Math.min(40, speed * (i + .5) * dt); if (Math.abs(x - center) < .5) integral += dt;}
  t.near(feltTipPaperAt(plan, plan.duration, x).exposure, integral, dt * 2 + 1e-10, 'integrated contact indicator reproduces row exposure'); integrals++;
}
for (let ink = 0; ink < 2; ink++) {
  const a = B.curves[ink].geometry.attributes.position, fluid = fluids[ink], pace = .5 * Math.sqrt(fluid.gamma / fluid.eta / (fluids[0].gamma / fluids[0].eta));
  for (let i = 0; i < a.count; i++) {
    const time = (a.getX(i) - CHART.x) / CHART.w * CHART.time, depth = (a.getY(i) - CHART.y) / CHART.h * CHART.soak;
    t.near((depth / pace) ** 2, time, 2e-6, 'drawn curves satisfy squared-distance law');
    t.ok(time <= CHART.time + 1e-6 && depth < CHART.soak, 'curves never clip at chart limits');
  }
}
for (const pore of [5, 10, 15, 20, 25]) {
  reset({pore}, 0);
  for (const [i, radius] of [50, pore].entries()) {
    const b = new THREE.Box3().setFromBufferAttribute(B.poreInks[i].geometry.attributes.position);
    t.near((b.max.x - b.min.x) / 2 / MM, radius / 1000 * PORES, 2e-6, 'meniscus radius matches selected pore');
    t.near(b.max.y / MM, CLOSE.tall, 2e-6, 'local sample height stays fixed');
  }
}
const expected = [
  ['now.end.width', 2.4230249470757705], ['now.travel', 10], ['now.middle.width', 1.447213595499958], ['now.middle.width', 1.158113883008419],
  ['now.end.width', 1.158113883008419], ['now.end.width', 3.006240264773888], ['now.middle.width', 1.113], ['nibPull', 29120], ['wick', .110065934065934],
  ['soaked', .5], ['soaked', 1], ['now.travel', 20],
];
for (const [i, trial] of lesson.tryIt.entries()) {
  m.reset(trial.initialState); const s = m.getState(), [path, value] = expected[i], actual = path.split('.').reduce((o, k) => o[k], s);
  t.near(actual, value, i === 6 ? .001 : 1e-10, `${trial.title}: named observation`);
  assert.deepEqual(s.values, trial.values); t.ok(m.parts.some(p => p.id === trial.part), 'preset targets an existing part');
}
reset({speed: 20, hold: 2}, 0); for (let i = 0; i < 40; i++) m.playback.step(); t.ok(m.playback.complete(), 'forty steps reach completion exactly');
const snap = JSON.stringify(m.getState()); for (const dt of [NaN, Infinity, -1, 0]) m.advance(dt); t.ok(snap === JSON.stringify(m.getState()), 'invalid advancement preserves state');
t.ok(feltTipAt(feltTipPlan(), 100).t === 4, 'physics and viewer share time bound');
assert.throws(() => feltTipPaperAt(feltTipPlan(), 0, NaN), RangeError);
checkRefusals(sampleFeltTip, FELT_DOMAINS, t); checkFinite(m.root, t); m.dispose();
const resources = checkDisposal(createFeltTipModel(), t);
console.log(JSON.stringify({passed: true, checks: t.count, poses, rows, integrals, trials: lesson.tryIt.length, resources}));

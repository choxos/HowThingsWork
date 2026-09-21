// Water clock: both pots drained again step by step, the inflow clock's flow
// from Poiseuille's law with the viscosity held to reference values, the
// drawing held to the state, and every number the lesson quotes held to the
// model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleWaterClock, waterClockPlan, outflowLevel, emptyTime, inflowRate, viscosity, potArea, potRadius, potVolume, WATER, WATER_DOMAINS} from './water-clock-physics.js';
import {createWaterClockModel, chartPoint, potProfile, waterTint} from './water-clock-model.js';
import {waterClockLesson} from './water-clock-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), g = 9.81;

// 1. The pots, drained step by step.
for (const design of [0, 1]) for (const bore of [0.6, 1, 1.5, 2]) {
  const a = Math.PI * (bore / 2000) ** 2, area = h => design === 1 ? Math.PI * 0.15 ** 2 * Math.sqrt(h / 0.4) : Math.PI * 0.15 ** 2;
  const rate = h => h <= 0 ? 0 : -0.62 * a * Math.sqrt(2 * g * h) / area(h);
  let h = 0.4, time = 0, emptied = null;
  const dt = 2;
  for (let n = 0; n * dt < 12 * 3600; n++) {
    const k1 = rate(h), k2 = rate(Math.max(0, h + dt / 2 * k1)), k3 = rate(Math.max(0, h + dt / 2 * k2)), k4 = rate(Math.max(0, h + dt * k3));
    const next = Math.max(0, h + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4));
    // A straight pot's level nears empty as a square, so the threshold must be tiny: a micrometer would land a minute early.
    if (emptied === null && next <= 1e-12) emptied = (time + dt) / 3600;
    h = next; time += dt;
    if (Math.round(time) % 3600 === 0) t.near(outflowLevel(design, bore / 1000, time / 3600), h, 2e-4, `design ${design}, ${bore} mm: level each hour`);
  }
  if (emptied !== null) t.near(emptyTime(design, bore / 1000), emptied, 0.01, 'time to empty');
  const plan = waterClockPlan({design, bore});
  plan.marks.forEach((mark, hour) => t.near(mark, outflowLevel(design, bore / 1000, hour), 1e-12, 'hour marks where the level stands'));
}
for (const h of [0.05, 0.1, 0.2, 0.4]) {
  t.near(potArea(1, h), Math.PI * potRadius(1, h) ** 2, 1e-12, 'flared pot area from its radius');
  t.near(potRadius(1, h), 0.15 * (h / 0.4) ** 0.25, 1e-12, 'radius grows as the fourth root of height');
}
{
  let volume = 0;
  for (let i = 0; i < 40000; i++) volume += potArea(1, (i + 0.5) * 0.4 / 40000) * 0.4 / 40000;
  t.near(potVolume(1), volume, 1e-6, 'flared pot volume');
  t.near(potVolume(0), Math.PI * 0.15 ** 2 * 0.4, 1e-12, 'straight pot volume');
}
for (const [T, reference] of [[5, 1.518e-3], [20, 1.002e-3], [35, 0.7191e-3]]) t.near(viscosity(T), reference, 0.02 * reference, `water’s viscosity at ${T} °C`);
for (const bore of [0.6, 1, 2]) for (const T of [5, 20, 35]) {
  const d = bore / 2000, plan = waterClockPlan({design: 2, bore, temperature: T}), Q = Math.PI * d ** 4 * 1000 * g * 0.05 / (128 * viscosity(T) * 0.05);
  t.near(plan.flow, Q, 1e-15, 'Poiseuille flow through the tube');
  t.near(inflowRate(bore / 1000, T), Q, 1e-15, 'inflow rate');
  t.near(plan.rise, Q / (Math.PI * 0.03 ** 2) * 3600, 1e-12, 'float rises by the flow over the jar’s area');
  t.ok(plan.reynolds < 2000, 'the tube’s flow stays smooth');
  t.near(plan.reynolds, 1000 * (Q / (Math.PI * (d / 2) ** 2)) * d / viscosity(T), 1e-9, 'Reynolds number');
}

// 2. The drawing.
const m = createWaterClockModel(), p = m.topology, MM = p.MM;
m.root.position.set(0.1, -0.3, 0.2);
for (const values of [{}, {design: 1, bore: 0.7}, {bore: 1.5}, {design: 2}, {design: 2, temperature: 35, bore: 2}]) for (const hours of [0, 2.5, 6, 12]) {
  m.reset(); m.update(values); m.advance(hours);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), outflow = s.values.design !== 2;
  assert.equal(p.pot.visible, outflow);
  assert.equal(p.inflow.visible, !outflow);
  const tint = new THREE.Color(0x2f6690).lerp(new THREE.Color(0x83b4c1), (s.values.temperature - 5) / 30);
  t.ok(Math.abs(p.jarWater.material.color.r - tint.r) < 1e-9 && Math.abs(p.potWater.material.color.b - tint.b) < 1e-9, 'water tinted by its temperature');
  if (outflow) {
    const wall = p.wall.geometry.attributes.position;
    for (let i = 0; i < wall.count; i += 37) {
      const x = wall.getX(i), y = wall.getY(i) / MM, z = wall.getZ(i), angle = (Math.atan2(x, z) + 2 * Math.PI) % (2 * Math.PI);
      t.near(Math.hypot(x, z) / MM, Math.max(0.5, potRadius(s.values.design, y / 1000) * 1000), 1e-3, 'pot wall follows its shape');
      t.ok(angle >= p.CUT - 1e-5 && angle <= 2 * Math.PI - p.CUT + 1e-5, 'a third cut away toward the viewer');
    }
    if (p.potWater.visible) {
      p.potWater.geometry.computeBoundingBox();
      t.near(p.potWater.geometry.boundingBox.max.y / MM, s.level * 1000, 1e-3, 'water drawn to its level');
    }
    assert.equal(p.stream.visible, s.level * 1000 > 0.5);
    const marks = p.marks.geometry.attributes.position;
    s.marks.forEach((mark, i) => t.near(marks.getY(2 * i) / MM, mark * 1000, 1e-3, 'hour marks at the levels'));
  } else {
    t.near(p.float.position.y / MM, s.level * 1000 + 4, 1e-9, 'float on the water');
    t.near(p.pointerTip.position.y / MM, p.POINTER.base + s.level * 1000, 1e-9, 'pointer rides the float');
    t.near(p.jarWater.scale.y / MM, Math.max(1e-3, s.level * 1000), 1e-9, 'jar water to its level');
    const ticks = p.ticks.geometry.attributes.position;
    s.marks.forEach((mark, i) => t.near(ticks.getY(2 * i) / MM, p.POINTER.base + mark * 1000, 1e-3, 'column’s hour marks'));
  }
  const trace = p.trace.geometry.attributes.position;
  for (const i of [0, 12, 30, 48]) t.near(trace.getY(i), chartPoint(i / 4, sampleWaterClock(s.values, i / 4).level * 1000)[1], 1e-6, 'level chart');
  t.near(p.cursor.geometry.attributes.position.getX(0), chartPoint(hours, 0)[0], 1e-6, 'chart clock');
  checkFinite(m.root, t);
}
checkControlsMove(m, () => [p.pot.visible, [...p.marks.geometry.attributes.position.array.slice(0, 12)], p.jarWater.material.color.getHex(), p.trace.geometry.attributes.position.getY(10)], model => model.advance(3), t);

// 3. The lesson, the text, refusals and disposal.
const run = values => { m.reset(); m.update(values); m.advance(12); return m.getState(); };
checkTrialNumbers(waterClockLesson, {
  'A straight pot': st => ({'66.5': (st.marks[0] - st.marks[1]) * 1000, '6.1': (st.marks[10] - st.marks[11]) * 1000, '11.51': st.empties}),
  'The Egyptian shape': st => (t.near(st.marks[3] - st.marks[4], st.marks[0] - st.marks[1], 1e-12, 'even marks'), {'34.0': (st.marks[0] - st.marks[1]) * 1000, '11.75': st.empties}),
  'A wider hole': st => ({'2.25': (st.values.bore / 1) ** 2, '5.12': st.empties}),
  'Ctesibius’s clock': st => ({'54.1': st.flow * 3.6e9, '19.13': st.rise * 1000}),
  'A winter night': st => ({'1.501': st.viscosity * 1000, '1.002': viscosity(20) * 1000, '20': 20, '12.76': st.rise * 1000}),
  'A summer night': st => ({'26.67': st.rise * 1000, '2.09': st.rise / waterClockPlan({...st.values, temperature: 5}).rise}),
  'A plain hole ignores the cold': st => (t.near(st.empties, waterClockPlan({...st.values, temperature: 20}).empties, 0, 'same as at 20 °C'), {'11.51': st.empties}),
  'A wider tube': st => ({'1': st.values.bore / 2, '16.00': st.flow / waterClockPlan({...st.values, bore: 1}).flow, '1.31': st.full, '305': st.reynolds}),
}, run, t);
checkQuotedText(waterClockLesson.deeper.map(section => section.body).join(' '), {'2.80 m/s': `${fixed(Math.sqrt(2 * g * WATER.height), 2)} m/s`}, t);
checkQuotedText(waterClockLesson.limits, {'400 mm': `${fixed(WATER.height * 1000, 0)} mm`, '150 mm': `${fixed(WATER.radius * 1000, 0)} mm`, '0.62': fixed(WATER.discharge, 2), '50 mm steady head': `${fixed(WATER.head * 1000, 0)} mm steady head`, '30 mm jar': `${fixed(WATER.jar * 1000, 0)} mm jar`}, t);
checkQuotedText(m.parts.map(part => part.description).join(' '), {'400 mm': `${fixed(WATER.height * 1000, 0)} mm`}, t);
checkRefusals(sampleWaterClock, WATER_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS water clock model: ${t.count} checks, ${waterClockLesson.tryIt.length} trials, ${resources} resources`);

// Liquid-in-glass and maximum-minimum thermometers: expansion and response
// from their own formulas, the bulb's response integrated step by step, the
// daily lag integrated over days, the drawings held to the state, and every
// number both lessons quote held to the models.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleThermometer, thermometerPlan, sampleSix, sixPlan, sixBulbAt, airAt, risePerDegree, lump, LIQUIDS, MEDIA, GLASS, BULB, SIX, THERMOMETER_DOMAINS, SIX_DOMAINS} from './thermometer-physics.js';
import {createLiquidThermometerModel, createSixThermometerModel, columnAt, glassChartPoint, sixChartPoint, tempColor} from './thermometer-models.js';
import {liquidThermometerLesson, sixThermometerLesson} from './thermometer-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally();

// 1. Expansion and response.
for (const liquid of [0, 1]) for (const bore of [0.15, 0.3, 0.5]) {
  const V = Math.PI * 0.0025 ** 2 * 0.006, beta = [1.81e-4, 1.09e-3][liquid];
  t.near(risePerDegree(V, liquid, bore / 1000), V * (beta - 1e-5) / (Math.PI * (bore / 2000) ** 2), 1e-15, 'rise per degree');
  for (const medium of [0, 1, 2]) {
    const plan = thermometerPlan({liquid, bore, medium}), area = 2 * Math.PI * 0.0025 * 0.006 + Math.PI * 0.0025 ** 2;
    const capacity = [13534 * 140, 789 * 2440][liquid] * V + 2230 * 750 * area * 0.4e-3;
    t.near(plan.capacity, capacity, 1e-12, 'bulb heat capacity');
    t.near(plan.tau, capacity / ([10, 40, 500][medium] * area), 1e-9, 'time constant');
    // Step response, integrated.
    let T = 20;
    const dt = plan.tau / 2000;
    for (let n = 0; n < 4000; n++) T += dt * (0 - T) / plan.tau;
    t.near(sampleThermometer({liquid, bore, medium, surroundings: 0}, Math.min(BULB.duration, 2 * plan.tau)).bulb, 2 * plan.tau <= BULB.duration ? T : 20 * Math.exp(-BULB.duration / plan.tau), 2e-3, 'bulb follows its surroundings');
    if (plan.settle > 0 && plan.settle <= BULB.duration) t.near(Math.abs(sampleThermometer({liquid, bore, medium, surroundings: 0}, plan.settle).bulb), 0.5, 1e-9, 'within half a degree after the settling time');
  }
}
assert.equal(sampleThermometer({liquid: 0, surroundings: -40, medium: 2}, 600).frozen, true, 'mercury freezes');
t.near(sampleThermometer({liquid: 0, surroundings: -40, medium: 2}, 600).reads, -38.83, 0, 'a frozen thread reads its freezing point');
assert.equal(sampleThermometer({surroundings: -50, medium: 2}, 600).frozen, false, 'alcohol does not');

// 2. The daily lag, integrated over five days until it repeats.
for (const values of [{}, {mean: 25, swing: 12}, {mean: -5, swing: 3}]) {
  const plan = sixPlan(values), full = {...{mean: 12, swing: 8}, ...values}, dt = 5;
  let T = full.mean;
  const start = 4 * 86400, marks = [3, 6, 11.5, 18, 24];
  for (let n = 0; n * dt < start + 24 * 3600; n++) {
    const time = n * dt, air = full.mean + full.swing * Math.cos(2 * Math.PI * (time / 3600 - 6) / 24);
    if (time >= start) for (const hours of marks) if (Math.abs(time - start - hours * 3600) < dt / 2) t.near(sixBulbAt(plan, hours), T, 0.01, 'bulb after days of following the air');
    T += dt * (air - T) / plan.tau;
  }
  const day = sampleSix(values, 24);
  let highest = -Infinity, lowest = Infinity;
  for (let h = 0; h <= 24; h += 0.001) { const bulb = sixBulbAt(plan, h); highest = Math.max(highest, bulb); lowest = Math.min(lowest, bulb); }
  t.near(day.highest, highest, 1e-4, 'maximum index at the day’s highest');
  t.near(day.lowest, lowest, 1e-4, 'minimum index at the day’s lowest');
  t.near(day.maxIndex, plan.rise * (day.highest - 20), 1e-15, 'maximum index position');
  t.near(day.minIndex, -plan.rise * (day.lowest - 20), 1e-15, 'minimum index position');
  t.near(plan.rise, 3e-6 * (1.09e-3 - 1e-5) / (Math.PI * 0.0005 ** 2), 1e-15, 'thread moves per degree');
}

// 3. The liquid-in-glass drawing.
const glass = createLiquidThermometerModel(), g = glass.topology, MM = g.MM;
glass.root.position.set(0.2, 0.1, 0);
for (const values of [{}, {liquid: 0, bore: 0.15}, {bore: 0.15}, {medium: 2, surroundings: 50}, {liquid: 0, surroundings: -40, medium: 2}, {medium: 1, surroundings: -50}]) for (const clock of [0, 45, 300, 1200]) {
  glass.reset(); glass.update(values); glass.advance(clock / g.SPEED);
  glass.root.updateMatrixWorld(true);
  const s = glass.getState(), top = Math.max(g.STEM.bottom, Math.min(g.STEM.top, g.STEM.twenty + s.rise * 1000 * (s.reads - 20)));
  t.near(s.clock, clock, 1e-9, 'clock forty times playback');
  t.near((g.column.position.y + g.column.scale.y / 2) / MM, top, 1e-6, 'column top at the reading');
  t.near((g.column.position.y - g.column.scale.y / 2) / MM, g.STEM.bottom, 1e-6, 'column rises from the bulb');
  assert.equal(g.column.material.color.getHex(), g.LIQUID_COLORS[s.values.liquid]);
  t.ok(Math.abs(g.bulbGlass.material.color.r - tempColor(s.bulb).r) < 1e-9, 'bulb tinted by its temperature');
  const ticks = g.ticks.geometry.attributes.position;
  const zero = g.STEM.twenty + s.rise * 1000 * (0 - 20);
  if (zero >= g.STEM.bottom && zero <= g.STEM.top) t.near(ticks.getY(10) / MM, zero, 1e-4, 'the 0 °C mark where the scale puts it');
  assert.equal(g.beaker.visible, s.values.medium === 2);
  assert.equal(g.streaks[0].visible, s.values.medium === 1);
  const trace = g.trace.geometry.attributes.position;
  for (const i of [0, 6, 60, 120]) t.near(trace.getY(i), glassChartPoint(i * 10, sampleThermometer(s.values, i * 10).reads)[1], 1e-6, 'reading chart');
  t.near(g.cursor.geometry.attributes.position.getX(0), glassChartPoint(clock, 0)[0], 1e-6, 'chart clock');
  checkFinite(glass.root, t);
}
checkControlsMove(glass, () => [g.column.scale.y, g.column.material.color.getHex(), g.beaker.visible, g.streaks[0].visible, [...g.ticks.geometry.attributes.position.array.slice(0, 12)], g.bulbGlass.material.color.getHex()], model => model.advance(120 / g.SPEED), t);

// 4. The maximum-minimum drawing.
const six = createSixThermometerModel(), p = six.topology;
six.root.position.set(-0.3, 0, 0.2);
for (const values of [{}, {mean: 30, swing: 15}, {mean: -10, swing: 15}, {swing: 0}]) for (const hours of [0, 3, 6, 14.5, 24]) {
  six.reset(); six.update(values); six.advance(hours);
  six.root.updateMatrixWorld(true);
  const s = six.getState(), span = rod => [(rod.position.y - rod.scale.y / 2) / MM, (rod.position.y + rod.scale.y / 2) / MM];
  t.near(span(p.arms.right.mercury)[1], s.maxArm * 1000, 1e-6, 'mercury in the maximum arm');
  t.near(span(p.arms.left.mercury)[1], s.minArm * 1000, 1e-6, 'mercury in the minimum arm');
  t.near(span(p.arms.right.alcohol)[0], s.maxArm * 1000, 1e-6, 'alcohol above the mercury');
  t.near(span(p.arms.left.alcohol)[1], p.ARM.top, 1e-6, 'alcohol up to the bulb');
  t.near(p.maxIndex.position.y / MM - 4, s.rise * 1000 * (s.highest - 20), 1e-6, 'maximum index sits where the mercury reached');
  t.near(p.minIndex.position.y / MM - 4, -s.rise * 1000 * (s.lowest - 20), 1e-6, 'minimum index sits where the mercury reached');
  t.ok(p.maxIndex.position.y / MM - 4 >= s.maxArm * 1000 - 1e-6 && p.minIndex.position.y / MM - 4 >= s.minArm * 1000 - 1e-6, 'indices never below the mercury');
  const scale = p.scaleLines.geometry.attributes.position;
  // Each tick writes four vertices (the maximum arm's mark, then the minimum arm's); 20 °C is the eleventh tick.
  t.near(scale.getY(4 * 10) / MM, s.rise * 1000 * (20 - 20), 1e-6, 'the 20 °C mark at the thread’s rest');
  t.near(scale.getY(16 * 4 + 2) / MM, -s.rise * 1000 * (50 - 20), 1e-4, 'minimum scale runs downward');
  for (const [line, field] of [[p.airLine, 'air'], [p.bulbLine, 'bulb']]) t.near(line.geometry.attributes.position.getY(40), sixChartPoint(10, sampleSix(s.values, 10)[field])[1], 1e-6, `${field} chart`);
  t.near(p.highLine.geometry.attributes.position.getY(0), sixChartPoint(0, s.highest)[1], 1e-6, 'maximum line on the chart');
  t.near(s.air, airAt(s.values, Math.min(24, hours)), 1e-12, 'air follows its cosine');
  checkFinite(six.root, t);
}
checkControlsMove(six, () => [p.maxIndex.position.y, p.minIndex.position.y, p.airLine.geometry.attributes.position.getY(10)], model => model.advance(8), t);

// 5. The lessons, the text, refusals and disposal.
const runGlass = values => { glass.reset(); glass.update(values); glass.advance(1e3); return glass.getState(); };
const at = (st, time) => sampleThermometer(st.values, time);
checkTrialNumbers(liquidThermometerLesson, {
  'Into the cold': st => ({'1.800': st.rise * 1000, '15.96': at(st, 60).reads, '981.4': st.settle, '0.5': 0.5}),
  'Stir it in water': st => ({'50': MEDIA[2].transfer / MEDIA[0].transfer, '266.1': thermometerPlan({...st.values, medium: 0}).tau, '5.3': st.tau, '19.6': st.settle}),
  'A breeze': st => (t.near(thermometerPlan({...st.values, medium: 0}).settle / st.settle, 4, 0.1, 'four times sooner'), {'245.4': st.settle}),
  'Mercury instead': st => (t.near(LIQUIDS[1].expansion / LIQUIDS[0].expansion, 6, 0.1, 'six times less'), {'0.285': st.rise * 1000, '0.702': st.resolution}),
  'A finer bore for mercury': st => ({'1.140': st.rise * 1000, '0.175': st.resolution}),
  'Too fine a bore': st => ({'7.200': st.rise * 1000, '0.028': st.resolution, '40.3': st.high, '0.3': -st.low}),
  'Mercury freezes': st => (t.ok(st.frozen, 'frozen'), {'38.83': -LIQUIDS[0].freezes}),
  'Alcohol keeps going': st => (t.ok(!st.frozen && Math.abs(st.reads + 50) < 1e-6, 'reads the bath'), {'114': -LIQUIDS[1].freezes, '50': -st.values.surroundings}),
}, runGlass, t);
const runSix = values => { six.reset(); six.update(values); six.advance(1e3); return six.getState(); };
checkTrialNumbers(sixThermometerLesson, {
  'Record a day': st => ({'9': 9, '19.99': st.highest, '4.01': st.lowest, '20': st.values.mean + st.values.swing, '4': st.values.mean - st.values.swing}),
  'The lag': st => ({'3': SIX.volume * 1e6, '10.7': st.lag / 60, '20.00': airAt(st.values, SIX.peak), '19.98': sixBulbAt(st, SIX.peak)}),
  'How far the thread moves': st => ({'4.125': st.rise * 1000}),
  'Read at noon': st => ({'17.38': sampleSix(st.values, 3).highest, '11.63': sampleSix(st.values, 3).lowest}),
  'A winter day': st => ({'8.00': -st.lowest, '2.00': -st.highest}),
  'A hot summer day': st => ({'36.99': st.highest, '13.01': st.lowest}),
  'A steady day': st => (t.near(st.highest, st.lowest, 1e-12, 'no swing'), {'12.00': st.highest}),
  'When the extremes came': st => ({'19.99': st.highest, '3': 3, '4.01': st.lowest}),
}, runSix, t);
const V = Math.PI * 0.0025 ** 2 * 0.006;
checkQuotedText(liquidThermometerLesson.deeper.map(section => section.body).join(' '), {'0.13 µL': `${fixed(V * (LIQUIDS[1].expansion - GLASS.expansion) * 1e9, 2)} µL`, '1.8 mm': `${fixed(risePerDegree(V, 1, 0.0003) * 1000, 1)} mm`, '10 millionths': `${fixed(GLASS.expansion * 1e6, 0)} millionths`, '1,090': fixed(LIQUIDS[1].expansion * 1e6, 0)}, t);
checkQuotedText(sixThermometerLesson.deeper.map(section => section.body).join(' '), {'about 11 minutes': `about ${fixed(sixPlan({}).lag / 60, 0)} minutes`, '0.01 °C': `${fixed(8 * (1 - sixPlan({}).lagFactor), 2)} °C`}, t);
checkQuotedText(liquidThermometerLesson.limits, {'0.118 mL': `${fixed(V * 1e6, 3)} mL`, '292 mm': `${g.STEM.top - g.STEM.bottom} mm`, '3 mL': `${fixed(SIX.volume * 1e6, 0)} mL`}, t);
checkQuotedText(glass.parts.map(part => part.description).join(' '), {'0.118 mL': `${fixed(V * 1e6, 3)} mL`, '292 mm': `${g.STEM.top - g.STEM.bottom} mm`}, t);
checkRefusals(sampleThermometer, THERMOMETER_DOMAINS, t);
checkRefusals(sampleSix, SIX_DOMAINS, t);
const resources = checkDisposal(glass, t) + checkDisposal(six, t);
console.log(`PASS thermometer models: ${t.count} checks, ${liquidThermometerLesson.tryIt.length + sixThermometerLesson.tryIt.length} trials, ${resources} resources`);

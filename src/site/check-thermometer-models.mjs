import {sampleSix, sixPlan, sixBulbAt, airAt, SIX, SIX_DOMAINS} from './thermometer-physics.js';
import {createSixThermometerModel, sixChartPoint} from './thermometer-models.js';
import {sixThermometerLesson} from './thermometer-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally();

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

// 4. The maximum-minimum drawing.
const six = createSixThermometerModel(), p = six.topology, MM = p.MM;
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
checkQuotedText(sixThermometerLesson.deeper.map(section => section.body).join(' '), {'about 11 minutes': `about ${fixed(sixPlan({}).lag / 60, 0)} minutes`, '0.01 °C': `${fixed(8 * (1 - sixPlan({}).lagFactor), 2)} °C`}, t);
checkRefusals(sampleSix, SIX_DOMAINS, t);
const resources = checkDisposal(six, t);
console.log(`PASS thermometer models: ${t.count} checks, ${sixThermometerLesson.tryIt.length} trials, ${resources} resources`);

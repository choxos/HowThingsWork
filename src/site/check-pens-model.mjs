// Shared pen physics regressions and viewer contracts. Dedicated ballpoint,
// felt-tip, dip-pen and capillary suites check their own current geometry and
// source-bounded lesson claims. The older analytic rise helpers below remain
// covered as mathematical functions, not as current filling-time predictions.
import assert from 'node:assert/strict';
import {fixed} from './format.js';
import {tally, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './pens-physics.js';
import * as BP from './ballpoint-model.js';
import * as FT from './felt-tip-model.js';
import * as DP from './capillary-model.js';
import {sampleCapillary, CAPILLARY_DOMAINS} from './capillary-physics.js';
import {ballpointLesson, feltTipLesson, dipPenLesson, capillaryActionLesson, ballpointLimits} from './pens-lessons.js';
import {houseComponents} from './house-components.js';

const t = tally();
const counts = {rises: 0};
const g = 9.81;
const rad = degrees => degrees * Math.PI / 180;
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-15;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the pages' worked examples.
// ---------------------------------------------------------------------------

const SRC = {
  Water: {tension: 72.8 / 1000, density: 1000, viscosity: 1.0016 / 1000, angle: 0},
  Ethanol: {tension: 22.27 / 1000, density: 0.78945 * 1000, viscosity: 1.2 / 1000, angle: 0},
  Mercury: {tension: 486.5 / 1000, density: 13.546 * 1000, viscosity: 1.526 / 1000, angle: 140},
};
for (const liquid of P.LIQUIDS) for (const key of ['tension', 'density', 'viscosity', 'angle']) t.near(liquid[key], SRC[liquid.name][key], relative(SRC[liquid.name][key]), `${liquid.name} ${key} as sourced`);
t.ok(P.G === g, 'gravity as the worked example has it');
const jurin = (L, r) => 2 * L.tension * Math.cos(rad(L.angle)) / (L.density * g * r);
t.ok(Number((2 * 0.0728 / (1000 * 9.81)).toPrecision(3)) === 1.48e-5, 'the pages’ 1.48 × 10^-5 m²');
t.ok(fixed(1000 * jurin(SRC.Water, 2), 3) === '0.007', 'a 2 m tube: the page’s 0.007 mm');
t.ok(fixed(1000 * jurin(SRC.Water, 0.02), 1) === '0.7', 'a 2 cm tube: the page’s 0.7 mm, rounded from 0.742');
t.ok(Number((1000 * jurin(SRC.Water, 2e-4)).toPrecision(1)) === 70, 'a 0.2 mm tube: the page’s 70 mm, rounded from 74.2');
for (const liquid of P.LIQUIDS) for (const r of [2e-4, 1e-4, 5e-4]) t.near(P.jurinHeight(liquid, r), jurin(SRC[liquid.name], r), relative(jurin(SRC[liquid.name], r), 1e-11), `${liquid.name}: Jurin’s law`);
t.near(1000 * Math.sqrt(SRC.Water.tension / (SRC.Water.density * g)), 2.71, 0.02, 'the capillary length page’s 2.71 mm for water, from a slightly lower surface tension');
for (const liquid of P.LIQUIDS) {
  t.near(P.capillaryLength(liquid), Math.sqrt(SRC[liquid.name].tension / (SRC[liquid.name].density * g)), 1e-15, `${liquid.name}: capillary length`);
  t.ok(1000 * P.capillaryLength(liquid) > P.DIP_DOMAINS.radius[1], `${liquid.name}: every tube is narrower than the capillary length, as Jurin’s law needs`);
}
const puddle = (tension, density, angle) => Math.sqrt(2 * tension * (1 - Math.cos(rad(angle))) / (9.81 * density));
t.ok(fixed(100 * puddle(0.487, 13500, 140), 2) === '0.36', 'the surface tension page’s mercury puddle, 0.36 cm, at 140°');
t.ok(fixed(100 * puddle(0.072, 1000, 107), 2) === '0.44', 'the surface tension page’s water on paraffin, 0.44 cm');
assert.deepEqual([...P.BALL_SIZES], [0.3, 0.38, 0.4, 0.5, 0.7, 0.8, 1.0, 1.2, 1.4]);
t.ok(P.BALL_SIZES.every(size => size >= 0.28 && size <= 1.6), 'every ball inside the 0.28 to 1.6 mm the page gives');
t.ok(P.BALLPOINT.nitrogen === 200, 'assigned pressure comparison, not a commercial rating');

// ---------------------------------------------------------------------------
// 2. The pull of a curved surface balances the column.
// ---------------------------------------------------------------------------

for (const liquid of P.LIQUIDS) {
  for (let i = 0; i <= 8; i++) {
    const r = (0.1 + 0.05 * i) / 1000, h = jurin(SRC[liquid.name], r), sphere = r / Math.abs(Math.cos(rad(liquid.angle)));
    t.near(P.pullOf(liquid, r), liquid.density * g * h, relative(liquid.density * g * h, 1e-11), `${liquid.name}: the pull balances the column’s weight`);
    t.near(Math.abs(P.pullOf(liquid, r)), 2 * liquid.tension / sphere, relative(2 * liquid.tension / sphere, 1e-11), `${liquid.name}: Young and Laplace for the meniscus sphere`);
  }
}

// ---------------------------------------------------------------------------
// 3. The rise law, by integrating Poiseuille's balance: dt/dL = shape η L / (ρ g gap² (L∞ − L)).
// ---------------------------------------------------------------------------

function riseTimeByQuadrature(liquid, gap, shape, depth, length, n = 20000) {
  const s = SRC[liquid.name], eq = depth + jurin(s, gap), k = s.density * g * gap * gap / (shape * s.viscosity);
  const f = L => L / (k * (eq - L)), h = length / n;
  let sum = f(0) + f(length);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(i * h);
  return sum * h / 3;
}
for (const liquid of P.LIQUIDS) {
  for (let i = 0; i <= 8; i++) {
    const r = (0.1 + 0.05 * i) / 1000;
    for (const shape of [P.TUBE, P.PLATES]) {
      const ch = P.channel(liquid, r, shape, P.BENCH.depth / 1000);
      t.near(ch.eq, P.BENCH.depth / 1000 + jurin(SRC[liquid.name], r), 1e-15, 'final length: the dip and Jurin’s height');
      if (ch.eq <= 0) { t.ok(P.riseAt(ch, 100) === 0, `${liquid.name} in ${r * 1000} mm stays out`); continue; }
      for (const share of [0.1, 0.5, 0.9]) {
        const quad = riseTimeByQuadrature(liquid, r, shape, P.BENCH.depth / 1000, share * ch.eq);
        t.near(P.riseTime(ch, share * ch.eq), quad, relative(quad, 1e-7), `${liquid.name} ${r * 1000} mm: time to ${share} of the way`);
        t.near(P.riseAt(ch, quad), share * ch.eq, relative(ch.eq, 1e-7), `${liquid.name} ${r * 1000} mm: the length after that time`);
        counts.rises++;
      }
    }
    const tube = P.channel(liquid, r, P.TUBE, 0.015), plates = P.channel(liquid, r, P.PLATES, 0.015);
    if (tube.eq > 0) for (const share of [0.2, 0.6, 0.95]) t.near(P.riseTime(plates, share * plates.eq), 1.5 * P.riseTime(tube, share * tube.eq), relative(P.riseTime(plates, share * plates.eq), 1e-12), 'plates reach each length 1.5 times as late as a tube of the same gap');
  }
}
{
  const slit = P.channel(P.WATER, P.NIB.gap / 1000, P.PLATES, P.NIB.dip / 1000), quad = riseTimeByQuadrature(P.WATER, P.NIB.gap / 1000, P.PLATES, P.NIB.dip / 1000, P.NIB.slit / 1000);
  t.near(P.dipPenPlan({}).fill, quad, relative(quad, 1e-7), 'the nib’s slit fills to the vent hole in the time Poiseuille’s balance gives');
}
for (const s of [0, 0.3, 1, 2.5, 4, 6]) t.near(P.clockSeconds(P.clockTime(s)), s, 1e-12, 'the log clock turns back');
t.near(P.clockTime(6), 1000 - 0.001, 1e-9, 'the clock reaches 1,000 s');

// Washburn's law by integrating dt/dL = 4 η L / (r γ cos θ).
for (const liquid of [P.WATER, P.ETHANOL]) {
  for (const r of [5e-6, 1e-5, 5e-5]) for (const L of [1e-3, 1e-2]) {
    const s = SRC[liquid.name], n = 2000, h = L / n;
    let sum = 0;
    for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * 4 * s.viscosity * (i * h) / (r * s.tension);
    const time = sum * h / 3;
    t.near(P.washburnTime(liquid, r, L), time, relative(time, 1e-12), `${liquid.name}: Washburn’s time`);
    t.near(P.washburnLength(liquid, r, time), L, relative(L, 1e-12), `${liquid.name}: Washburn’s length`);
  }
}
t.near(P.paceRatio(P.ETHANOL), Math.sqrt((22.27e-3 / 1.2e-3) / (72.8e-3 / 1.0016e-3)), 1e-15, 'ethanol soaks in at the square root of its surface tension over viscosity, against water’s');

// ---------------------------------------------------------------------------
// Scene helpers.
// ---------------------------------------------------------------------------

function drawing(model) {
  const out = [];
  model.root.updateMatrixWorld(true);
  model.root.traverse(object => {
    if (!object.isMesh && !object.isLine) return;
    const array = object.geometry.attributes.position?.array || [];
    let sum = 0;
    for (let i = 0; i < array.length; i++) sum += array[i] * ((i % 7) + 1);
    out.push([object.visible, object.matrixWorld.elements.map(value => Math.round(value * 1e7)).join(','), Math.round(sum * 1e5), object.material.color?.getHex() ?? 0, object.geometry.drawRange.count]);
  });
  return out;
}

// ---------------------------------------------------------------------------
// 4. The ballpoint pen, read off its drawing.
// ---------------------------------------------------------------------------

// Detailed ballpoint laws, film states and geometry are checked separately.
const ballpoint = BP.createBallpointModel();

// ---------------------------------------------------------------------------
// 5. The felt-tip pen, read off its drawing.
// ---------------------------------------------------------------------------

// Detailed felt-tip laws, contact histories and mesh checks live in check-felt-tip-model.mjs.
const felt = FT.createFeltTipModel();

// ---------------------------------------------------------------------------
// 6. Current lessons and the independent capillary apparatus.
// Detailed equilibrium, immersion, contact, curve and trial claims live in
// check-capillary-physics.mjs and check-capillary-model.mjs. The removed checks
// assumed the discarded widened bore, detached bath and logarithmic clock.
// ---------------------------------------------------------------------------

const dip = DP.createCapillaryModel();
for (const lesson of [ballpointLesson, feltTipLesson, dipPenLesson, capillaryActionLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  for (const text of [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, ...lesson.deeper.map(item => item.body), ...lesson.tryIt.flatMap(item => [item.instruction, item.observe])]) t.ok(!/—|(?<!\d)–|–(?!\d)| - |--/.test(text), 'no dashes as punctuation');
}
t.ok(ballpointLimits.includes('does not predict air entry'), 'the limits exclude an unsupported failure prediction');

// Capillary action uses its own apparatus, not the pen model.
{
  const component = houseComponents['Capillary action'];
  t.ok(component.machine === 'Capillary action' && component.part === 'capillary' && component.lesson === capillaryActionLesson, 'Capillary action routes to its own apparatus and lesson');
  const ids = new Set(dip.parts.map(part => part.id));
  for (const trial of capillaryActionLesson.tryIt) t.ok(ids.has(trial.part), `${trial.title}: its inspection exists on the apparatus`);
}

// ---------------------------------------------------------------------------
// 8. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const [name, model, sample, domains, stepSize] of [['ballpoint', ballpoint, P.sampleBallpoint, P.BALLPOINT_DOMAINS, 0.1], ['felt tip', felt, P.sampleFeltTip, P.FELT_DOMAINS, 0.1], ['capillary action', dip, sampleCapillary, CAPILLARY_DOMAINS, 0.1]]) {
  checkControlsMove(model, () => drawing(model), m => m.advance(100), t);
  checkRefusals(sample, domains, t);
  model.reset();
  checkFinite(model.root, t);
  t.ok(!model.playback.complete(), `${name}: guide or motion starts incomplete`);
  t.ok(model.resultPart.available() === (name === 'capillary action'), `${name}: equilibrium is inspectable immediately; moving experiments expose their result on completion`);
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, stepSize, 1e-12, `${name}: a step advances the clock`);
  t.ok(JSON.stringify(model.getState().readings) !== before, `${name}: a step changes the readings`);
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, stepSize + 0.5, 1e-12, `${name}: animation advances by the time that passed`);
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available(), `${name}: complete, with a result to inspect`);
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0, `${name}: ${action.label} returns readings`); checkFinite(model.root, t); }
  t.ok(model.parts.every(part => part.description && !/—|(?<!\d)–|–(?!\d)| - |--/.test(part.description)), `${name}: every part described, with no dashes`);
  t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity/.test(item.value + (item.hint || ''))), `${name}: readings are all numbers`);
}
const disposed = [BP.createBallpointModel(), FT.createFeltTipModel(), DP.createCapillaryModel()].map(model => { model.advance(2); return checkDisposal(model, t); });
for (const model of [ballpoint, felt, dip]) model.dispose();

console.log(`PASS pens: ${t.count} shared checks, ${counts.rises} analytic rises checked by independent quadrature, four lesson contracts, ${disposed.join(', ')} resources released exactly once. Current scene and trial claims have dedicated item suites.`);

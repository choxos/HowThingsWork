import assert from 'node:assert/strict';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './thermostat-physics.js';
import * as WM from './wax-thermostat-model.js';
import * as L from './thermostat-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {previewEntryIds} from './published-catalog.js';

const t = tally();
const counts = {steps: 0, plans: 0, poses: 0, points: 0, numbers: 0, solves: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2);
const drawn = 2e-6;

/** The x where an increasing `fn` crosses zero, by bisection. */
function bisect(fn, lo, hi, steps = 200) {
  let a = lo, b = hi;
  for (let i = 0; i < steps; i++) { const mid = (a + b) / 2; if (fn(mid) > 0) b = mid; else a = mid; }
  counts.solves++;
  return (a + b) / 2;
}
const pointsOf = object => {
  // A flat rectangle keeps its unit square whatever size it is drawn at, so reading
  // its vertices measures the placeholder; those are measured by scale instead.
  assert.ok(!object.isMesh, 'pointsOf reads a line, not a drawn rectangle');
  const array = object.geometry.attributes.position.array, out = [];
  for (let i = 0; i < array.length; i += 3) out.push([array[i], array[i + 1], array[i + 2]]);
  counts.points += out.length;
  return out;
};

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  // Wikipedia: Thermal expansion, and the Engineering ToolBox table for company.
  expansion: {brass: 19e-6, iron: 11.8e-6, carbonSteel: 10.8e-6, steel: [11.0e-6, 13.0e-6], copper: 17e-6, invar: 1.2e-6, aluminum: 23.1e-6},
  expansionOther: {brass: [18e-6, 19e-6], ironForged: 11.3e-6, ironPure: 12.0e-6, steel: [10.8e-6, 12.5e-6], copper: [16e-6, 16.7e-6], invar: 1.5e-6},
  // Wikipedia: Young's modulus, and Brass.
  modulus: {brass: 106e9, wroughtIron: 193e9, steel: 200e9, copper: 110e9},
  brass: {density: [8400, 8730], melting: [900, 940]},
  // Wikipedia: Wax motor, Wax thermostatic element, Paraffin wax.
  wax: {
    growth: [0.05, 0.20], bias: [0.20, 0.30],
    paraffinMelting: [46, 68], paraffinDensity: 900,
    automotive: [70, 90], modernEngine: 80, halfStroke: 0.5,
    strokes: [1.5, 16], range: [-15, 120],
    patent: 2115501, patentFiled: 1934, patentIssued: 1938,
  },
  // Wikipedia: Orifice plate, and the Ideal Vogue sheet's gas supply.
  orifice: {discharge: [0.6, 0.85], supply: 2000, supplyMbar: 20},
  gas: {density: 0.657, densityAt: 25, calorific: 38.7e6},
  coolant: {density: 1000, heat: 4184},
  // Drawn sizes typed in again, so a mutated model constant cannot move both sides of a test.
  drawn: {
    capsuleAcross: 18, pistonBore: 4, mmWax: 0.02,
    slower: 120,
  },
};

assert.deepEqual(JSON.parse(JSON.stringify(P.EXPANSION)), SRC.expansion);
assert.deepEqual(JSON.parse(JSON.stringify(P.EXPANSION_OTHER)), SRC.expansionOther);
assert.deepEqual(JSON.parse(JSON.stringify(P.MODULUS)), SRC.modulus);
assert.deepEqual(JSON.parse(JSON.stringify(P.BRASS)), SRC.brass);
assert.deepEqual(JSON.parse(JSON.stringify(P.WAX)), SRC.wax);
assert.deepEqual(JSON.parse(JSON.stringify(P.ORIFICE)), SRC.orifice);
assert.deepEqual(JSON.parse(JSON.stringify(P.GAS)), SRC.gas);
assert.deepEqual(JSON.parse(JSON.stringify(P.COOLANT)), SRC.coolant);
t.add(8);

// Every expansion coefficient sits inside the company the other table keeps.
t.ok(SRC.expansion.brass >= SRC.expansionOther.brass[0] && SRC.expansion.brass <= SRC.expansionOther.brass[1], 'brass expands as both tables say');
t.ok(SRC.expansion.iron > SRC.expansionOther.ironForged && SRC.expansion.iron < SRC.expansionOther.ironPure, 'the iron taken lies between forged and pure');
t.ok(SRC.expansion.carbonSteel >= SRC.expansionOther.steel[0] && SRC.expansion.carbonSteel <= SRC.expansionOther.steel[1], 'and carbon steel inside the steel spread');
t.ok(SRC.expansion.brass > SRC.expansion.iron && SRC.expansion.iron > SRC.expansion.carbonSteel && SRC.expansion.invar < SRC.expansion.carbonSteel / 5,
  'brass outgrows iron, iron outgrows carbon steel, and invar hardly grows at all');

// --- The wax, its piston and the engine --------------------------------------
{
  t.ok(P.meltedAt(P.DECLARED.meltFrom) === 0 && P.meltedAt(P.DECLARED.meltTo) === 1, 'the wax is unmelted at the bottom of its range and melted at the top');
  t.ok(P.meltedAt(P.DECLARED.meltFrom - 40) === 0 && P.meltedAt(P.DECLARED.meltTo + 40) === 1, 'and stays that way outside it');
  t.near(P.meltedAt((P.DECLARED.meltFrom + P.DECLARED.meltTo) / 2), 0.5, 1e-12, 'with half of it gone halfway across');
  for (const growth of [0.05, 0.12, 0.20]) {
    const area = Math.PI * (P.DECLARED.pistonBore / 2) ** 2;
    t.near(P.pistonAt(P.DECLARED.meltTo, growth), P.DECLARED.pelletVolume * growth / area, 1e-18, `a wax growing ${f0(100 * growth)} percent pushes its volume over the piston's area`);
    t.ok(P.pistonAt(P.DECLARED.meltFrom, growth) === 0, 'and pushes nothing at all before it melts');
    const stroke = 1000 * P.pistonAt(P.DECLARED.meltTo, growth);
    t.ok(stroke >= SRC.wax.strokes[0] && stroke <= SRC.wax.strokes[1], `its ${f2(stroke)} mm stroke is a size the page gives, between ${f1(SRC.wax.strokes[0])} and ${f0(SRC.wax.strokes[1])} mm`);
  }
  t.ok(P.DECLARED.meltFrom >= SRC.wax.automotive[0] && P.DECLARED.meltTo <= SRC.wax.automotive[1] + 5, 'the melting range is where automotive elements are made to work');
  t.ok(P.DECLARED.meltFrom > SRC.wax.modernEngine, 'and above the temperature a modern engine is meant to run over');
  t.ok(P.DECLARED.meltFrom > SRC.wax.paraffinMelting[1], 'a thermostat wax melts higher than ordinary paraffin, and far more narrowly');
  t.ok(P.DECLARED.meltTo - P.DECLARED.meltFrom < (SRC.wax.paraffinMelting[1] - SRC.wax.paraffinMelting[0]) / 1.5, 'which is the whole point of blending it');
  for (const values of [{}, {growth: 5}, {growth: 20}, {load: 4}, {load: 30}, {ambient: -10}, {ambient: 40}]) {
    const plan = P.waxPlan(values);
    counts.plans++;
    t.near(plan.power, plan.values.load * 1000, 1e-12, 'the load is what the engine puts into its coolant');
    t.near(plan.fullStroke, P.pistonAt(P.DECLARED.meltTo, plan.values.growth / 100), 1e-18, 'the full stroke is the piston at full melt');
    t.ok(plan.strokeAtOpen === 0, 'and nothing has moved at the temperature it starts melting');
    t.ok(plan.withinStrokes && plan.withinRange, 'the element is a real size working over a real range');
    t.ok(plan.boils === (plan.settled.celsius >= 100), 'the boiling flag is exactly the engine having passed 100 °C');
    // Where it comes to rest, by bisecting the engine's balance instead of marching.
    const surplus = celsius => P.DECLARED.radiatorLoss * P.coolantOpenAt(celsius, plan.values.growth) * (celsius - plan.values.ambient)
      + 12 * (celsius - plan.values.ambient) - plan.power;
    const rest = bisect(surplus, plan.values.ambient, 400);
    const rate = (plan.track.at(-1).celsius - plan.track.at(-2).celsius) / P.DECLARED.step;
    t.ok(plan.climbing === (rate > 0.001), 'the climbing flag is exactly the engine still rising as the run ends');
    if (plan.climbing) {
      t.ok(plan.settled.celsius < rest - 0.5, `this setting has no resting place inside the run: ${f1(plan.settled.celsius)} °C at the end against a balance of ${f1(rest)} °C`);
      t.ok(rate > 0, 'and the engine is still on its way up');
    } else {
      t.near(plan.settled.celsius, rest, 0.6, `the engine rests where its balance says, ${f1(rest)} °C`);
    }
    counts.solves++;
  }
  // The valve sits about halfway along its travel in normal running, as its page says.
  const plan = P.waxPlan({});
  t.ok(plan.halfOpen, 'in normal running the valve sits near half its stroke, with room either way');
  t.ok(!plan.boils, 'and a properly cooled engine never reaches boiling at all');
  t.ok(plan.settled.celsius > P.DECLARED.meltFrom && plan.settled.celsius < P.DECLARED.meltTo, 'and the engine settles inside the melting range');
  t.ok(plan.opened !== null && plan.opened > 0, 'the valve is shut for a while at the start, which is how an engine warms quickly');
  const cold = P.waxPlan({load: 4});
  t.ok(cold.opened === null && cold.settled.open === 0, 'and at a light enough load it never opens at all');
  t.ok(cold.settled.celsius < P.DECLARED.meltFrom, 'because the engine never reaches the melting range inside this run');
  t.ok(cold.climbing, 'though it is still warming when the run ends, and given long enough it would reach it');
  const hard = P.waxPlan({load: 30});
  t.ok(hard.settled.open > plan.settled.open && hard.settled.celsius > plan.settled.celsius, 'worked harder it opens further and still runs hotter');
  const freer = P.waxPlan({growth: 20}), meaner = P.waxPlan({growth: 5});
  counts.plans += 4;
  t.ok(freer.settled.celsius < plan.settled.celsius && plan.settled.celsius < meaner.settled.celsius, 'a wax that grows more holds the engine cooler');
  t.ok(freer.fullStroke > plan.fullStroke && plan.fullStroke > meaner.fullStroke, 'because it pushes the piston further for the same melting');
  t.ok(meaner.boils && hard.boils && !freer.boils, 'a wax that hardly grows and a heavy load both drive the engine past boiling, a freer wax does not');
  // The spring is a share of what the wax can push, as its page says.
  const at = P.sampleWax({}, P.DECLARED.engineRun);
  t.near(at.spring, P.DECLARED.springRate * at.stroke, 1e-9, 'the spring pushes back in proportion to how far it is compressed');
  t.ok(at.toRadiator <= P.DECLARED.pumpFlow && at.toRadiator > 0, 'and the coolant to the radiator is the share of the pump the valve lets by');
  t.ok(P.sampleWax({}, 0).toRadiator === 0, 'with none of it going there while the valve is shut');
}
checkRefusals(P.sampleWax, P.WAX_DOMAINS, t);

// ---------------------------------------------------------------------------
// 2. The drawing, read back from the scene.
// ---------------------------------------------------------------------------

const wax = WM.createWaxThermostatModel(), WT = wax.topology;

const poseOf = model => (values, runSeconds) => {
  model.reset();
  if (values) model.update(values);
  model.advance(runSeconds / P.DECLARED.slower);
  model.root.updateMatrixWorld(true);
  counts.poses++;
  return model.getState();
};
const poseWax = poseOf(wax);

// --- The wax element, drawn at true size throughout ---------------------------
{
  // The capsule is a flat rectangle, so how far across it is drawn is its scale.
  t.near(WT.shell.scale.x, SRC.drawn.capsuleAcross * SRC.drawn.mmWax, drawn, `the capsule is drawn its true ${f0(SRC.drawn.capsuleAcross)} mm across`);
  // The piston stands in the capsule's mouth and is pushed out by growing, so
  // how far it has travelled is how much taller its rod is drawn.
  const shut = poseWax({}, 0), shutOut = WT.rod.scale.y, shutArrow = WT.travel.userData.length;
  const open = poseWax({}, P.DECLARED.engineRun), openOut = WT.rod.scale.y, openArrow = WT.travel.userData.length;
  t.ok(open.now.stroke > shut.now.stroke, 'the piston is further out once the wax has melted');
  t.ok(openOut > shutOut, 'and drawn further out with it');
  t.near((openOut - shutOut) / (open.now.stroke - shut.now.stroke), 1000 * SRC.drawn.mmWax, 1e-4,
    'and the piston is drawn at true size, with nothing magnified at all');
  for (const [state, arrow] of [[shut, shutArrow], [open, openArrow]]) {
    t.near(arrow, 1000 * state.now.stroke * SRC.drawn.mmWax, 1e-9, 'the travel arrow is exactly the stroke long, on the same true scale');
  }
  t.ok(WT.spring !== undefined && WT.springCoil !== undefined, 'the return spring is its own part, drawn');
  t.ok(wax.parts.some(item => item.id === 'spring' && item.name === 'Return spring'), 'and named as one');
  t.ok(open.now.toRadiator > 0 && WT.toRadiator.userData.length > 0, 'coolant reaching the radiator is drawn as an arrow');
  t.ok(poseWax({load: 4}, P.DECLARED.engineRun).now.toRadiator === 0 && WT.toRadiator.userData.length === 0, 'and no arrow at all when the valve never opens');
}
// Nothing anywhere is left infinite, at any setting or time.
const waxSettings = [{}, {growth: 5}, {growth: 20}, {load: 4}, {load: 30}, {ambient: -10}, {ambient: 40}, {start: -10}, {start: 40}];
for (const [pose, settings] of [[poseWax, waxSettings]]) {
  for (const values of settings) for (const time of [0, 60, 600, 1e5]) pose(values, time);
}
checkFinite(wax.root, t);

// ---------------------------------------------------------------------------
// 3. The lessons.
// ---------------------------------------------------------------------------

const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
}
const texts = item => [['simple', item.simple], ['overview', item.overview], ...item.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...item.parts.map((part, i) => [`part ${i + 1}`, part.role]), ['misconception', item.misconception], ['quiz', [item.quiz.question, ...item.quiz.options].join(' ')]];

const waxDefault = P.waxPlan({}), waxMean = P.waxPlan({growth: 5}), waxFree = P.waxPlan({growth: 20});
const waxIdle = P.waxPlan({load: 4}), waxHard = P.waxPlan({load: 30});
checkTrialNumbers(L.waxThermostatLesson, {
  'Start the engine cold': s => ({'6.8': s.opened / 60, '90.0': s.settled.celsius, 59: 100 * s.settled.open}),
  'Watch the wax, not a switch': () => ({}),
  'How far melting pushes it': s => ({900: 1e9 * P.DECLARED.pelletVolume, 12: s.values.growth, 4: 1000 * P.DECLARED.pistonBore, '8.59': 1000 * s.fullStroke}),
  'A wax that hardly grows': s => ({'3.58': 1000 * s.fullStroke, '105.2': s.settled.celsius}),
  'A wax that grows freely': s => ({'14.32': 1000 * s.fullStroke, '87.0': s.settled.celsius}),
  'Idling in the cold': s => ({'57.7': s.settled.celsius}),
  'Working hard': s => ({96: 100 * s.settled.open, '112.0': s.settled.celsius}),
}, values => P.waxPlan(values), t);

for (const lesson of [L.waxThermostatLesson]) {
  for (const [where, text] of texts(lesson)) covered(text, {}, `${lesson.simple.slice(0, 20)} ${where}`);
}

// The deeper sections.
covered(L.waxThermostatLesson.deeper[0].body, {
  [`by ${f0(100 * P.WAX.growth[0])} to ${f0(100 * P.WAX.growth[1])} percent`]: 'by 5 to 20 percent',
}, 'wax deeper 1');
covered(L.waxThermostatLesson.deeper[1].body, {
  [`between ${f0(P.WAX.paraffinMelting[0])} and ${f0(P.WAX.paraffinMelting[1])} °C`]: 'between 46 and 68 °C',
  [`between ${f0(P.WAX.automotive[0])} and ${f0(P.WAX.automotive[1])} °C`]: 'between 70 and 90 °C',
  [`run over ${f0(P.WAX.modernEngine)} °C`]: 'run over 80 °C',
}, 'wax deeper 2');
covered(L.waxThermostatLesson.deeper[2].body, {
  [`growing ${f0(waxDefault.values.growth)} percent makes about ${f0(1e9 * P.DECLARED.pelletVolume * waxDefault.values.growth / 100)} cubic millimeters`]:
    'growing 12 percent makes about 108 cubic millimeters',
  [`through a ${f0(1000 * P.DECLARED.pistonBore)} mm rod that is ${f2(1000 * waxDefault.fullStroke)} mm of travel`]: 'through a 4 mm rod that is 8.59 mm of travel',
  [`strokes of ${f1(P.WAX.strokes[0])} to ${f0(P.WAX.strokes[1])} mm`]: 'strokes of 1.5 to 16 mm',
}, 'wax deeper 3');
covered(L.waxThermostatLesson.deeper[3].body, {
  [`at ${f0(100 * P.WAX.bias[0])} to ${f0(100 * P.WAX.bias[1])} percent of the operating force`]: 'at 20 to 30 percent of the operating force',
}, 'wax deeper 4');
covered(L.waxThermostatLesson.deeper[4].body, {
  [`shut for the first ${f1(waxDefault.opened / 60)} minutes`]: 'shut for the first 6.8 minutes',
}, 'wax deeper 5');
covered(L.waxThermostatLesson.deeper[5].body, {
  [`${f1(waxDefault.settled.celsius)} °C at ${f0(waxDefault.values.load)} kW, ${f1(waxFree.settled.celsius)} °C with a freer wax, ${f1(waxHard.settled.celsius)} °C worked hard`]:
    '90.0 °C at 14 kW, 87.0 °C with a freer wax, 112.0 °C worked hard',
}, 'wax deeper 6');

// The limits, which are where everything declared has to be admitted.
const sharedLimits = {};
covered(L.thermostatLimits, sharedLimits, 'thermostat limits');
covered(L.waxLimits, {
  ...sharedLimits,
  [`taken as ${f0(1e9 * P.DECLARED.pelletVolume)} cubic millimeters of wax melting evenly between ${f0(P.DECLARED.meltFrom)} and ${f0(P.DECLARED.meltTo)} °C, driving a ${f0(1000 * P.DECLARED.pistonBore)} mm piston`]:
    'taken as 900 cubic millimeters of wax melting evenly between 82 and 95 °C, driving a 4 mm piston',
}, 'wax limits');
covered(L.waxThermostatLesson.limits, {
  [`covers ${f0(P.DECLARED.engineRun / 60)} minutes and plays ${f0(P.DECLARED.slower)} times faster`]: 'covers 15 minutes and plays 120 times faster',
  [`taken as ${f0(1e9 * P.DECLARED.pelletVolume)} cubic millimeters of wax melting evenly between ${f0(P.DECLARED.meltFrom)} and ${f0(P.DECLARED.meltTo)} °C, driving a ${f0(1000 * P.DECLARED.pistonBore)} mm piston`]:
    'taken as 900 cubic millimeters of wax melting evenly between 82 and 95 °C, driving a 4 mm piston',
}, 'wax lesson limits');

// The three lessons are three lessons, not one copied twice. This is the review's
// finding about the rod and wax pages carrying the bimetal page's text verbatim.
{
  const lessons = [L.bimetalThermostatLesson, L.rodThermostatLesson, L.waxThermostatLesson];
  const names = ['bimetal', 'rod', 'wax'];
  for (let i = 0; i < lessons.length; i++) for (let j = i + 1; j < lessons.length; j++) {
    for (const field of ['simple', 'overview', 'misconception', 'limits']) {
      t.ok(lessons[i][field] !== lessons[j][field], `${names[i]} and ${names[j]} do not share their ${field}`);
    }
    t.ok(lessons[i].quiz.question !== lessons[j].quiz.question, `${names[i]} and ${names[j]} ask different questions`);
    t.ok(lessons[i].steps.every((step, k) => step.title !== lessons[j].steps[k]?.title), `and walk through different steps`);
    t.ok(lessons[i].deeper.every((item, k) => item.title !== lessons[j].deeper[k]?.title), 'and go deeper in different directions');
  }
  // The rod and wax pages describe their own actuator, not the bimetal one.
  t.ok(!/bimetal/i.test(L.rodThermostatLesson.overview), 'the rod overview never mentions a bimetal strip');
  t.ok(/tube/i.test(L.rodThermostatLesson.overview) && /rod/i.test(L.rodThermostatLesson.overview), 'it names the tube and rod that actually move its valve');
  t.ok(/melt/i.test(L.waxThermostatLesson.overview), 'the wax overview is about melting');
  t.ok(/odd one out/.test(L.waxThermostatLesson.overview), 'and mentions the others only to say wax is the odd one out');
  // The bimetal page keeps its own subject: its deeper sections are about bending,
  // not about the rod, the wax or a gas bypass, which belong to the sibling pages.
  const deeper = L.bimetalThermostatLesson.deeper.map(item => item.title).join(' | ');
  t.ok(/expansion|motion/.test(deeper), 'the bimetal page explains the movement it depends on');
  t.ok(!/wax/i.test(deeper) && !/bypass/i.test(deeper) && !/rod thermostat/i.test(deeper), 'and does not pad itself with its siblings');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

const machines = [
  ['Wax thermostat', wax, WT, L.waxThermostatLesson, P.WAX_DOMAINS, P.WAX_DEFAULTS, 'wax-thermostat', waxSettings, 6,
    () => [WT.piston.position.x, WT.disc.position.x, WT.toRadiator.userData.length, WT.waxBody.material.color.getHex(), pointsOf(WT.curve).slice(-2), pointsOf(WT.openGuide).slice(0, 20)],
    // Halfway, for the same reason as the oven.
    model => model.advance(P.DECLARED.engineRun / 2 / P.DECLARED.slower)],
];

for (const [name, model, topology, lesson, domains, defaults, id, settings, leastParts, snapshot, settle] of machines) {
  for (const control of model.controls) {
    const [lo, hi, step] = domains[control.key];
    t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === defaults[control.key], `${name} ${control.key}: the control spans its domain from its default`);
    t.ok(control.help && !/[—–]| - |--/.test(control.help), `${name} ${control.key}: helped, without dashes`);
  }
  t.ok(model.controls.map(control => control.key).join() === Object.keys(domains).join(), `${name}: the controls are the domains`);
  checkControlsMove(model, snapshot, settle, t);
  model.reset();
  checkFinite(model.root, t);
  t.ok(!model.playback.complete() && !model.resultPart.available(), `${name}: nothing to inspect before the run`);
  model.reset();
  model.advance(1);
  t.near(model.getState().clock, SRC.drawn.slower, 1e-9, `${name}: a second of playback is ${f0(SRC.drawn.slower)} seconds of run`);
  model.reset();
  // Every one of these three runs whatever it is set to: there is no setting at
  // which a thermostat has nothing to show, so nothing ever blocks the run.
  t.ok(!model.playback.blocked(), `${name}: the run is ready to press`);
  for (const values of settings) { model.update(values); t.ok(!model.playback.blocked(), `${name}: and still ready at every setting`); }
  model.reset();
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.ok(JSON.stringify(model.getState().readings) !== before, `${name}: a step changes the readings`);
  model.animate(0);
  model.animate(1);
  model.advance(1e5);
  t.ok(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'chart', `${name}: the run done, with the chart to inspect`);
  model.reset();
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part), `${name}: ${action.label} returns readings`);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), `${name}: every part described, with no dashes, under the system`);
  t.ok(model.getState().readings.length >= 8, `${name}: at least eight readings`);
  t.ok(model.getState().readings[0].label === 'Your result', `${name}: the result comes first`);
  t.ok(model.getState().readings.slice(1).every(item => item.hint), 'and everything after it carries a hint');
  // The lesson's contract with the model.
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${name}: a quiz with its answer first`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `${name}: no dashes as punctuation: ${text.slice(0, 50)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium|vapour|sulphur)\b/i.test(text), `${name}: American spelling: ${text.slice(0, 50)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, `${name}: every source a link, none twice`);
  t.ok(lesson.sources.length >= 2, 'and there is more than one of them');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), `${name}: every trial on a part the model has`);
  t.ok(lesson.tryIt.every(item => item.part !== 'system'), 'each trial points at the part it is about, not at the whole machine');
  t.ok(new Set(lesson.tryIt.map(item => item.part)).size >= 4, 'and the trials are spread across the machine');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), `${name}: every part named is a part the model has`);
  t.ok(lesson.parts.length === model.parts.length - 1, `${name}: and every part the model has, except the whole thing, is named`);
  t.ok(lesson.steps.length === 5 && lesson.deeper.length >= 5 && lesson.tryIt.length === 7 && lesson.parts.length >= leastParts,
    `${name}: five steps, at least five deeper sections, seven trials and at least ${f0(leastParts)} parts`);
  t.ok(heatingLessons[name] === lesson, `${name}: the heating lessons carry this lesson`);
  const routed = createHeatingModel(name);
  t.ok(routed && routed.controls.map(control => control.key).join() === Object.keys(domains).join(), `${name}: the heating models route it here`);
  routed.dispose();
  t.ok(previewEntryIds.includes(id), `${name}: routed into the preview as ${id}`);
  for (const values of settings) {
    for (const time of [0, 2, 1e4]) {
      model.reset(); model.update(values); model.advance(time);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), `${name}: readings are all numbers`);
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')), `${name}: reading text without dashes: ${item.label}`);
    }
  }
}

const released = [
  checkDisposal((() => { const fresh = WM.createWaxThermostatModel(); fresh.advance(3); return fresh; })(), t),
].reduce((sum, value) => sum + value, 0);
wax.dispose();

console.log(`PASS wax thermostat: ${t.count} checks, ${counts.steps} steps integrated, ${counts.plans} runs planned, ${counts.solves} balances solved, ${counts.poses} poses, ${counts.points} drawn points traced, ${counts.numbers} quoted numbers traced, 1 draft lesson, ${released} resources released exactly once.`);

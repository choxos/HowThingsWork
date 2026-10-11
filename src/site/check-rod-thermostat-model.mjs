import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRodThermostatModel, MM, MOVE_TIMES, ROD, CHART, chartX, chartY} from './rod-thermostat-model.js';
import {rodThermostatLesson as lesson, rodLimits} from './thermostat-lessons.js';
import {ROD_DEFAULTS, ROD_DOMAINS, rodPlan, rodAt} from './thermostat-physics.js';
import {createHeatingModel} from './heating-models.js';
import {heatingLessons} from './heating-lessons.js';
import {fixed} from './format.js';

let checks = 0, poses = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (actual, expected, tolerance, message) => { ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} versus ${expected}`); };
const m = createRodThermostatModel(), T = m.topology;
const endpoint = (object, sign) => object.localToWorld(new THREE.Vector3(0, sign * object.geometry.parameters.height / 2, 0));
const worldX = x => ROD.origin[0] + x * MM;
const worldY = y => ROD.origin[1] + y * MM;
const points = object => Array.from({length: object.geometry.drawRange.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.position, i));
function inspectPose() {
  m.root.updateMatrixWorld(true);
  const state = m.getState(), n = state.now;
  const brass = 0.2 * 19e-6 * (n.celsius - 20), steel = 0.2 * 12e-6 * (n.celsius - 20);
  const cap = 270 + brass * 100000, tip = 70 + (brass - steel) * 100000;
  for (const wall of [T.tubeOuter, T.tubeInner]) {
    near(endpoint(wall, -1).x, worldX(70), 1e-10, 'brass root stays fixed');
    near(endpoint(wall, 1).x, worldX(cap), 1e-10, 'tube length follows brass expansion');
    near(endpoint(wall, 1).y, worldY(20), 1e-10, 'tube remains coaxial');
  }
  near(endpoint(T.rodBar, -1).x, worldX(tip), 1e-10, 'steel free end retreats with differential expansion');
  near(endpoint(T.rodBar, 1).x, worldX(cap), 1e-10, 'steel far end remains joined to brass');
  near(endpoint(T.tubeCap, -1).x, worldX(cap), 1e-10, 'solid cap begins at shared joint');
  near(T.joint.getWorldPosition(new THREE.Vector3()).x, worldX(cap), 1e-10, 'visible fastener stays at joint');
  const face = endpoint(T.poppet, 1).x;
  near(face, worldX(-n.lift * 100000), 1e-10, 'poppet translates by valve lift');
  near(endpoint(T.poppet, 1).distanceTo(endpoint(T.poppet, -1)), 3 * MM, 1e-12, 'poppet never shrinks');
  near(endpoint(T.extension, 1).x, worldX(tip - n.gap * 100000), 1e-10, 'stem touches rod or leaves actual gap');
  near(endpoint(T.extension, -1).x, endpoint(T.stem, 1).x, 1e-10, 'adjustable extension joins poppet stem');
  const springPoints = T.spring.geometry.parameters.path.points;
  near(T.springGroup.localToWorld(springPoints[0].clone()).x, worldX(-58), 1e-10, 'spring fixed end remains anchored');
  near(T.springGroup.localToWorld(springPoints.at(-1).clone()).x, endpoint(T.poppet, -1).x, 1e-10, 'spring follows rear poppet face');
  ok(springPoints.at(-1).y > 0, 'spring never inverts or collapses');
  ok(T.bypassPipe.visible === Boolean(state.values.bypass), 'bypass geometry matches control');
  ok(T.bypassMarks.every(mark => mark.visible === (n.bypassFlow > 0)), 'bypass flow is actual supplied gas');
  ok(T.gasMarks.every(mark => mark.visible === (n.flow > 0)), 'outlet flow remains separate from combustion');
  ok(T.mainFlowLine.visible === (n.mainFlow > 0) && T.mainFlowMarks.every(mark => mark.visible === (n.mainFlow > 0)), 'gas path crosses main seat only while it flows');
  ok(T.flames.visible === n.lit, 'flame requires ignition');
  ok(T.heatArrows.every(arrow => (arrow.userData.length > 0) === n.lit), 'heat arrows require flame');
  near(T.thermometerFluid.scale.y, 139 * MM * n.celsius / 320, 1e-12, 'thermometer follows oven temperature');
  const chartPoints = points(T.curve);
  if (state.clock === 0) ok(chartPoints.length === 0 && !T.curve.visible, 'ready state has no future curve');
  else {
    ok(chartPoints.every(p => p.x <= chartX(state, n.t) + 1e-7), 'chart ends at elapsed time');
    near(chartPoints.at(-1).x, chartX(state, n.t), 1e-7, 'last plotted time');
    near(chartPoints.at(-1).y, chartY(n.celsius), 1e-7, 'last plotted temperature');
    ok(chartPoints.every(p => p.y >= CHART.y - 1e-7 && p.y <= CHART.y + CHART.h + 1e-7), 'chart range contains entire run');
  }
  const rows = Object.fromEntries(state.readings.map(row => [row.label, row.value]));
  assert.equal(rows['Gas to burner'], `${fixed(n.flow * 1e6, 2)} mL/s`);
  assert.equal(rows['Elapsed gas and heat'], `${fixed(n.volume * 1000, 2)} L supplied`);
  assert.equal(rows['Main valve lift'], `${fixed(n.lift * 1e6, 2)} µm`);
  assert.equal(rows['Rod to stem gap'], `${fixed(n.gap * 1e6, 2)} µm`);
  assert.equal(rows['Oven temperature'], `${fixed(n.celsius, 2)} °C`);
  ok(state.readings.every(row => !/NaN|undefined|Infinity|null/.test(row.value + (row.hint || ''))), 'finite learner readings');
  m.root.traverse(object => {
    ok(object.matrixWorld.elements.every(Number.isFinite), 'finite scene transforms');
    if (object.geometry?.attributes.position) ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite), 'finite scene vertices');
  });
  poses++;
}

near(MM, 0.0058, 0, 'drawing scale'); near(MOVE_TIMES, 100, 0, 'motion enlargement');
assert.equal(T.burner.parent, T.oven);
ok(m.catalogParts.some(part => part.id === 'burner' && part.parentId === 'oven'), 'oven result retains burner in catalog hierarchy');
assert.deepEqual(m.controls.map(c => c.key), Object.keys(ROD_DOMAINS));
for (const c of m.controls) { assert.deepEqual([c.min, c.max, c.step], ROD_DOMAINS[c.key]); assert.equal(c.initial, ROD_DEFAULTS[c.key]); ok(Boolean(c.help), 'control has teaching help'); }
const singles = Object.entries(ROD_DOMAINS).flatMap(([key, [lo, hi, step]]) => Array.from({length: Math.round((hi - lo) / step) + 1}, (_, i) => ({...ROD_DEFAULTS, [key]: lo + i * step})));
const corners = [120, 260].flatMap(setting => [15, 300].flatMap(start => [10, 25].flatMap(supply => [0, 1].map(bypass => ({setting, start, supply, bypass})))));
for (const values of [...singles, ...corners]) {
  m.reset(); m.update(values); inspectPose();
  m.advance(10); inspectPose(); m.advance(10); inspectPose();
  ok(m.playback.complete() && m.resultPart.available(), 'complete at full duration');
}
for (const values of [{setting: 120, start: 220}, {setting: 120, start: 220, bypass: 0}]) {
  const plan = rodPlan(values);
  for (const time of [0, ...plan.events.flatMap(event => [event.t - 1e-4, event.t, event.t + 1e-4]), 2400]) { m.reset(); m.update(values); m.advance(time / 120); inspectPose(); }
}
for (const frames of [20, 120, 600]) {
  m.reset(); for (let i = 0; i < frames; i++) m.advance(20 / frames);
  near(m.getState().now.celsius, 199.98149407206617, 1e-10, 'frame-independent final temperature');
  ok(m.playback.complete(), 'frame-independent completion');
}
m.reset(); for (let i = 0; i < 8; i++) m.playback.step();
ok(m.playback.complete(), 'eight five-minute steps complete run');
const snapshot = JSON.stringify(m.getState());
for (const action of m.actions) { action.run(); assert.equal(JSON.stringify(m.getState()), snapshot); ok(action.replay === false && m.parts.some(p => p.id === action.part), 'inspection selects an existing part without time travel'); }
for (const [key, value] of [['setting', 120], ['start', 220], ['supply', 10], ['bypass', 0]]) {
  m.reset(); m.advance(10); m.update({[key]: value});
  ok(m.getState().clock === 0 && !m.getState().now.lit && !m.resultPart.available(), 'changed control resets history'); inspectPose();
}
m.reset(); m.advance(3); const elapsed = m.getState().clock; m.update({setting: 200}); near(m.getState().clock, elapsed, 0, 'unchanged control preserves elapsed time');
for (const invalid of [-1, NaN, Infinity]) { m.advance(invalid); near(m.getState().clock, elapsed, 0, 'invalid advance cannot move time'); }
m.reset(); m.animate(0); m.animate(2); near(m.getState().clock, 240, 0, 'animation clock conversion');
assert.equal(m.resultPart.id, 'oven'); ok(!m.resultPart.focusOnComplete, 'completion keeps full mechanism visible');

const endText = ['200.0', '120.0', '260.0', '191.9', '202.1', '120.8', '93.6'];
assert.equal(lesson.tryIt.length, 7);
for (const [i, trial] of lesson.tryIt.entries()) {
  assert.deepEqual(Object.keys(trial.values).sort(), Object.keys(ROD_DEFAULTS).sort());
  ok(trial.reset === true && trial.isolate === false && trial.part === 'system' && trial.view === 'front', 'trial prepares whole connected mechanism');
  m.reset(); m.update(trial.values); near(m.getState().clock, 0, 0, 'trial starts at zero');
  m.advance(20); const state = m.getState();
  assert.equal(fixed(state.now.celsius, 1), endText[i]); ok(trial.observe.includes(endText[i] + ' °C'), 'quoted trial result matches temperature');
  if (i === 5) ok(state.now.lit && state.events.length === 1, 'hot bypass trial passes closed-to-open event with flame');
  if (i === 6) ok(!state.now.lit && state.now.flow > 0 && state.now.power === 0, 'hot no-bypass trial shows unlit gas after opening');
}
assert.deepEqual(lesson.parts.map(p => p.name).sort(), m.parts.filter(p => p.id !== 'system').map(p => p.name).sort());
assert.equal(lesson.quiz.answer, 0); assert.equal(lesson.quiz.options.length, 3); assert.equal(lesson.steps.length, 5);
for (const text of [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(p => [p.title, p.body]), ...lesson.parts.flatMap(p => [p.name, p.role]), ...lesson.deeper.flatMap(p => [p.title, p.body]), ...lesson.tryIt.flatMap(p => [p.title, p.instruction, p.observe])]) {
  ok(!/[—–]| - |--/.test(text), 'no dash punctuation');
  ok(!/\b(centre|colour|litre|behaviour|modelling|grey|analyse|favour|fibre|vapour|unburnt)\b/i.test(text), 'American English');
}
assert.deepEqual(lesson.deeper[0].body.match(/\d+(?:\.\d+)?/g), ['20', '200', '200', '0.684', '0.432', '0.252', '1.4', '100']);
assert.deepEqual(rodLimits.match(/\d+(?:\.\d+)?/g), ['200', '20', '19', '12', '100', '12', '0.45', '0.6', '25', '101325', '16.0425', '890.35', '8.31', '45', '12', '5', '20', '20']);
near((19e-6 - 12e-6) * 0.2 * (200 - 20) * 1000, 0.252, 1e-15, 'quoted differential at 200 C');
ok(lesson.sources.length === 8 && new Set(lesson.sources.map(s => s.url)).size === 8 && lesson.sources.every(s => s.url.startsWith('https://')), 'distinct primary source links');
assert.equal(heatingLessons['Rod thermostat'], lesson);
const routed = createHeatingModel('Rod thermostat'); assert.deepEqual(routed.defaults, ROD_DEFAULTS); routed.dispose();

const resources = new Set(); m.root.traverse(object => { if (object.geometry) resources.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) { resources.add(material); if (material.map) resources.add(material.map); if (material.gradientMap) resources.add(material.gradientMap); } });
const disposed = new Map(); for (const object of resources) object.addEventListener('dispose', () => disposed.set(object, (disposed.get(object) || 0) + 1));
m.dispose(); m.dispose(); for (const object of resources) assert.equal(disposed.get(object), 1, 'current geometry, material and texture disposed exactly once');
console.log(JSON.stringify({status: 'PASS', checks, poses, singleControlValues: singles.length, corners: corners.length, trials: lesson.tryIt.length, resources: resources.size}));

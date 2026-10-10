import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {createBimetalThermostatModel, MM, BEND_TIMES, THICKNESS_TIMES, STRIP, CHART, chartX, chartY} from './bimetal-thermostat-model.js';
import {BIMETAL_DEFAULTS, BIMETAL_DOMAINS, DECLARED, bimetalPlan, bimetalAt, bimetalBeamAt} from './thermostat-physics.js';
import {bimetalThermostatLesson as lesson} from './thermostat-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {checkFinite, checkDisposal, checkQuotedText} from './model-check-kit.mjs';

let checks = 0, poses = 0;
const near = (a, b, why, tolerance = 2e-7) => { assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${why}: ${a} versus ${b}`); checks++; };
const yes = (value, why) => { assert.ok(value, why); checks++; };
const model = createBimetalThermostatModel(), T = model.topology;
assert.equal(MM, 0.013); assert.equal(BEND_TIMES, 100); assert.equal(THICKNESS_TIMES, 3); checks += 3;
assert.deepEqual(model.parts.map(part => part.id), ['system', 'body', 'strip', 'contact', 'magnet', 'dial', 'room', 'heater', 'circuit', 'chart']); checks++;
assert.deepEqual(lesson.parts.map(part => part.name), model.parts.slice(1).map(part => part.name)); checks++;
assert.equal(model.parts.find(part => part.id === 'heater').parentId, 'room');
assert.equal(T.heater.parent, T.room); checks += 2;
assert.deepEqual(model.catalogParts.map(part => part.id), model.parts.slice(1).map(part => part.id)); checks++;
for (const [lead, leadEnd, coilEnd] of [[T.leads[2], 1, 0], [T.leads[3], 0, 1]]) {
  const a = lead.localToWorld(lead.geometry.parameters.path.getPoint(leadEnd));
  const b = T.heaterCoil.localToWorld(T.heaterCoil.geometry.parameters.path.getPoint(coilEnd));
  near(a.distanceTo(b), 0, 'heater terminal remains connected after room parenting', 1e-12);
}
assert.equal(heatingLessons['Bimetal thermostat'], lesson); checks++;
const routed = createHeatingModel('Bimetal thermostat'); assert.equal(routed.parts.length, 10); routed.dispose(); checks++;
assert.deepEqual(model.defaults, BIMETAL_DEFAULTS); checks++;
for (const control of model.controls) { assert.deepEqual([control.min, control.max, control.step], BIMETAL_DOMAINS[control.key]); yes(control.help.length > 25, 'control explains its effect'); }

function inspectPose() {
  const state = model.getState(), {now} = state;
  model.root.updateMatrixWorld(true);
  const sphereBottom = T.moving.getWorldPosition(new THREE.Vector3()).y - 2 * MM;
  const padTop = T.fixedPad.getWorldPosition(new THREE.Vector3()).y + MM;
  near(sphereBottom - padTop, now.closed ? 0 : (now.tip - state.tipAtClose) * 1000 * 100 * MM, 'drawn physical contact gap', 1e-12);
  yes(sphereBottom >= padTop - 1e-12, 'sphere never passes through contact pad');
  near(T.carriage.position.y, state.tipAtClose * 1000 * 100 * MM, 'setting moves contact');
  near(T.magnetCarriage.position.y, T.carriage.position.y, 'magnet follows contact carriage');
  near(T.moving.position.x, 25 * MM, 'tip remains attached at beam endpoint');
  const brass = T.brass.geometry.attributes.position, iron = T.iron.geometry.attributes.position;
  for (let i = 0; i <= STRIP.segments; i++) {
    const beam = bimetalBeamAt(state, now, i / STRIP.segments * 0.05), angle = Math.atan(beam.slope * 100);
    for (const j of [0, 1]) {
      const bi = i * 4 + 2 + j, ii = i * 4 + j;
      near(brass.getX(bi), iron.getX(ii), 'bonded interface x', 0);
      near(brass.getY(bi), iron.getY(ii), 'bonded interface y', 0);
      near(brass.getZ(bi), iron.getZ(ii), 'bonded interface z', 0);
      near(brass.getX(bi), (-25 + i / STRIP.segments * 50) * MM, 'interface follows beam x');
      near(brass.getY(bi), beam.y * 1000 * 100 * MM, 'interface follows loaded beam');
    }
    const lo = i * 4, interfaceY = iron.getY(lo), offsetX = brass.getX(lo) - iron.getX(lo), offsetY = brass.getY(lo) - interfaceY;
    near(offsetX, Math.sin(angle) * 0.9 * MM, 'brass lower normal x');
    near(offsetY, -Math.cos(angle) * 0.9 * MM, 'brass lower normal y');
    near(brass.getZ(lo) - brass.getZ(lo + 1), 6 * MM, 'real strip width');
  }
  yes(T.brass.isMesh && T.iron.isMesh && T.brass.geometry.index.count > 100, 'two closed 3D layer meshes');
  const count = T.curve.geometry.drawRange.count, array = T.curve.geometry.attributes.position;
  assert.equal(count, now.t > 0 ? state.chart.filter(point => point.t < now.t).length + 1 : 0); checks++;
  yes(count < 512, 'chart capacity includes all switch events');
  for (let i = 0; i < count; i++) {
    yes(array.getX(i) <= chartX(state, now.t) + 2e-7, 'no future chart point');
    yes(array.getY(i) >= CHART.y - 2e-7 && array.getY(i) <= CHART.y + CHART.h + 2e-7, 'chart does not clip the temperature');
  }
  if (count) { near(array.getX(count - 1), chartX(state, now.t), 'last chart time'); near(array.getY(count - 1), chartY(now.celsius), 'last chart temperature'); }
  for (const mark of T.currentMarks) assert.equal(mark.visible, now.on);
  for (const arrow of T.heatArrows) assert.equal(arrow.visible, now.on);
  checks += T.currentMarks.length + T.heatArrows.length;
  for (const arrow of T.lossArrows) {
    if (!arrow.visible) continue;
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);
    near(direction.x, now.heatLoss >= 0 ? 1 : -1, 'heat flows toward colder side');
  }
  near(T.thermometerFluid.scale.y, Math.max(1e-6, 0.44 * now.celsius / 30), 'thermometer follows room');
  yes(state.readings.every(reading => !/NaN|undefined|Infinity|null/.test(reading.value + (reading.hint || ''))), 'finite learner readings');
  yes(!model.resultPart.available() || now.done, 'completion result only after elapsed run');
  poses++;
}

const cases = [];
for (const [key, [min, max, step]] of Object.entries(BIMETAL_DOMAINS)) for (let value = min; value <= max; value += step) cases.push({[key]: value});
for (let mask = 0; mask < 16; mask++) cases.push(Object.fromEntries(Object.entries(BIMETAL_DOMAINS).map(([key, domain], i) => [key, domain[(mask >> i) & 1]])));
for (const values of cases) {
  model.reset(); model.update(values); inspectPose(); checkFinite(model.root);
  const plan = model.getState(), times = [...new Set([1, 300, 2700, 5400, ...plan.events.flatMap(event => [event.t - 1e-7, event.t])])].sort((a, b) => a - b);
  let previous = 0;
  for (const time of times) { model.advance((time - previous) / 120); previous = time; inspectPose(); }
  checkFinite(model.root);
}
for (const [key, [min]] of Object.entries(BIMETAL_DOMAINS)) {
  model.reset(); model.advance(45); model.update({[key]: min});
  assert.equal(model.getState().clock, 0); assert.equal(T.curve.geometry.drawRange.count, 0); assert.equal(model.getState().now.power, 0); checks += 3;
}
model.reset(); model.advance(7);
const paused = JSON.stringify(model.getState().now);
for (const action of model.actions) {
  yes(action.replay === false && model.parts.some(part => part.id === action.part), 'inspection targets a real part');
  action.run(); assert.equal(JSON.stringify(model.getState().now), paused); checks++;
}
model.update({power: NaN}); assert.equal(JSON.stringify(model.getState().now), paused); checks++;
for (const dt of [NaN, Infinity, -1, 0]) { model.advance(dt); assert.equal(JSON.stringify(model.getState().now), paused); checks++; }
model.reset(); model.animate(0); model.animate(1); near(model.getState().clock, 120, 'animation seconds to simulated seconds');
model.reset(); model.playback.step(); near(model.getState().clock, 300, 'five-minute step');
model.advance(999); yes(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'room', 'completed room is useful result');
model.reset(); near(model.getState().clock, 0, 'reset clears clock'); assert.deepEqual(model.getState().values, BIMETAL_DEFAULTS); checks++;

const expectedTrials = [
  {end: 19.7799097604, first: 1350.1350033, switches: 14},
  {end: 23.6421457391, first: 2480.92820019, switches: 11},
  {end: 19.9189654944, first: 3622.68896556, switches: 4},
  {end: 14.0571293917, first: null, switches: 0},
  {end: 19.1734803407, first: 770.509472706, switches: 19},
  {end: 19.1671346779, first: 1921.35770764, switches: 12},
  {end: 14.628423309, first: null, switches: 0},
];
assert.equal(lesson.tryIt.length, expectedTrials.length); checks++;
const trialOutputs = [];
for (const [i, trial] of lesson.tryIt.entries()) {
  assert.deepEqual(Object.keys(trial.values).sort(), Object.keys(BIMETAL_DEFAULTS).sort()); checks++;
  yes(trial.reset && !trial.isolate && trial.part === 'system', 'each trial starts fresh with complete connected mechanism visible');
  model.reset(); model.update(trial.values); model.advance(45);
  const state = model.getState(), expected = expectedTrials[i];
  near(state.now.celsius, expected.end, trial.title, 2e-7); assert.equal(state.now.switches, expected.switches); checks++;
  if (expected.first !== null) near(state.events[0].t, expected.first, 'independent expected trial event', 2e-6);
  yes(/^90 min complete/.test(state.readings[0].value), 'completed trial never says ready');
  trialOutputs.push({title: trial.title, celsius: state.now.celsius, heaterDuty: state.now.duty, switches: state.now.switches});
}
const plans = lesson.tryIt.map(trial => bimetalPlan(trial.values));
const claims = [
  {'22.5': plans[0].events[0].t / 60, '19.06': plans[0].closesAt, '20.00': plans[0].opensAt},
  {'41.3': plans[1].events[0].t / 60, '23.64': bimetalAt(plans[1], 5400).celsius},
  {'60.4': plans[2].events[0].t / 60, '93.6': bimetalAt(plans[2], 5400).duty * 100},
  {'14.06': bimetalAt(plans[3], 5400).celsius, '20': plans[3].opensAt, '14.09': plans[3].equilibrium},
  {'12.8': plans[4].events[0].t / 60},
  {'19.06': plans[5].closesAt, '32.0': plans[5].events[0].t / 60},
  {'14.63': bimetalAt(plans[6], 5400).celsius},
];
for (let i = 0; i < lesson.tryIt.length; i++) checkQuotedText(lesson.tryIt[i].observe, Object.fromEntries(Object.entries(claims[i]).map(([text, value]) => [text, fixed(value, text.includes('.') ? text.split('.')[1].length : 0)])));
yes(lesson.sources.length === 6 && lesson.sources.every(source => source.url.startsWith('https://')), 'six reviewed primary sources');
const publicText = JSON.stringify(lesson) + JSON.stringify(model.getState().readings);
yes(!/[—–]|\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|fibre)\b/.test(publicText), 'American English and no dash punctuation');
const resources = checkDisposal(model);
console.log(JSON.stringify({status: 'passed', checks, poses, cases: cases.length, resources, trialOutputs}));

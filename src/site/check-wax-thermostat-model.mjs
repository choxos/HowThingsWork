import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWaxThermostatModel, MM, CHART, chartX, chartY, coolantColor} from './wax-thermostat-model.js';
import {waxThermostatLesson as lesson, waxLimits} from './thermostat-lessons.js';
import {WAX_DEFAULTS, WAX_DOMAINS, waxPlan, waxAt} from './thermostat-physics.js';
import {createHeatingModel} from './heating-models.js';
import {heatingLessons} from './heating-lessons.js';
import {fixed} from './format.js';

let checks = 0, poses = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (actual, expected, tolerance, message) => ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} versus ${expected}`);
const m = createWaxThermostatModel(), T = m.topology;
const bounds = object => new THREE.Box3().setFromObject(object, true);
const worldY = y => .5 + y * .04;
const points = object => Array.from({length: object.geometry.drawRange.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.position, i));
function volume(object) {
  const position = object.geometry.attributes.position, index = object.geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let sum = 0;
  for (let i = 0; i < (index?.count || position.count); i += 3) {
    a.fromBufferAttribute(position, index ? index.getX(i) : i);
    b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
    sum += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(sum * object.matrixWorld.determinant());
}
function inspectPose() {
  m.root.updateMatrixWorld(true);
  const state = m.getState(), n = state.now, travel = n.stroke * 1000;
  // Mesh vertices are Float32; 1e-7 scene units is below 0.000003 mm.
  const rod = bounds(T.rod), disc = bounds(T.disc), seat = bounds(T.seat), floor = bounds(T.floor), seal = bounds(T.seal);
  near(rod.min.y, worldY(-18), 1e-7, 'rod tip stays fixed');
  near(rod.max.y, worldY(23), 1e-7, 'rod top stays fixed');
  near(rod.max.y, bounds(T.bridge).min.y, 1e-7, 'rod bears on upper bridge');
  near(rod.max.x - rod.min.x, 4 * .04, 1e-7, 'rod retains four millimeter diameter');
  near(disc.max.y, worldY(-travel), 1e-7, 'disc moves downward by physical travel');
  near(disc.max.y - disc.min.y, 2 * .04, 1e-7, 'disc never stretches');
  near(seat.min.y - disc.max.y, travel * .04, 1e-7, 'actual seat gap equals travel');
  near(floor.max.y, worldY(-20 - travel), 1e-7, 'rigid cup floor follows disc');
  near(seal.min.y, disc.max.y, 1e-7, 'seal and valve stay at cup mouth');
  near(bounds(T.shell).max.y, seal.min.y, 1e-7, 'seal sits on shell without overlapping it');
  near(bounds(T.shell).max.y - bounds(T.shell).min.y, 22 * .04, 1e-7, 'capsule shell stays rigid');
  near(bounds(T.waxUpper).max.y, seal.min.y, 1e-7, 'wax meets seal');
  near(bounds(T.waxUpper).min.y, rod.min.y, 1e-7, 'annular wax reaches fixed rod tip');
  near(bounds(T.waxLower).max.y, rod.min.y, 1e-7, 'wax fills below fixed rod');
  near(bounds(T.waxLower).min.y, floor.max.y, 1e-7, 'wax meets cup floor');
  near(2 * (volume(T.waxUpper) + volume(T.waxLower)) / .04 ** 3, n.waxVolume * 1e9, .2, 'triangle volume matches expanded wax within curved-mesh tessellation');
  const ends = T.springEnds.map(bounds), path = T.spring.geometry.parameters.path.points;
  near(ends[0].min.y, bounds(T.lowerSeat).max.y, 1e-7, 'lower spring end touches fixed support');
  near(ends[1].max.y, disc.min.y, 1e-7, 'upper spring end touches moving disc');
  near(T.spring.localToWorld(path[0].clone()).y, (ends[0].min.y + ends[0].max.y) / 2, 1e-7, 'coil joins lower end ring');
  near(T.spring.localToWorld(path.at(-1).clone()).y, (ends[1].min.y + ends[1].max.y) / 2, 1e-7, 'coil joins upper end ring');
  ok(ends[1].min.y > ends[0].max.y && seal.min.y > rod.min.y, 'spring and rod immersion remain positive');
  near(T.liftArrow.userData.length, travel * .04, 1e-12, 'motion arrow shares internal scale');
  for (const [route, flow, temperature] of [[T.jacket, n.pumpFlow, n.celsius], [T.pumpOutlet, n.pumpFlow, n.returnCelsius], [T.engineOutlet, n.pumpFlow, n.celsius], [T.bypassRoute, n.toBypass, n.celsius], [T.radiatorInlet, n.toRadiator, n.celsius], [T.radiatorReturn, n.toRadiator, n.toRadiator ? n.radiatorOutlet : state.values.ambient], [T.mixedReturn, n.pumpFlow, n.returnCelsius]]) {
    ok(route.marks.every(mark => mark.visible === (flow > 0)), 'markers require actual branch flow');
    assert.deepEqual(route.pipe.material.color.toArray(), coolantColor(temperature).toArray(), 'pipe color matches branch temperature');
  }
  ok(T.mainFlowLine.visible === (n.toRadiator > 0) && [...T.mainFlowMarks, ...T.radiatorMarks].every(mark => mark.visible === (n.toRadiator > 0)), 'closed valve has no radiator markers');
  if (n.toRadiator > 0) {
    const route = points(T.mainFlowLine);
    near(T.frame.localToWorld(route[0].clone()).distanceTo(new THREE.Vector3(...T.engineOutlet.points.at(-1))), 0, 1e-7, 'inlet joins actual housing port');
    near(T.frame.localToWorld(route.at(-1).clone()).distanceTo(new THREE.Vector3(...T.radiatorInlet.points[0])), 0, 1e-7, 'outlet joins radiator pipe');
    for (let i = 1; i < route.length; i++) for (let step = 0; step <= 20; step++) {
      const point = route[i - 1].clone().lerp(route[i], step / 20).multiplyScalar(25), radius = Math.hypot(point.x, point.z);
      ok(!(radius >= 20 && radius <= 29.25 && point.y > 1e-5 && point.y < 2 - 1e-5), 'flow never crosses solid seat');
      ok(!(radius >= 6.5 && radius <= 22 && point.y > -travel - 2 + 1e-5 && point.y < -travel - 1e-5), 'flow never crosses solid disc');
      ok(radius > 6.5, 'flow clears wax capsule and fixed rod');
    }
  }
  ok(T.inputArrows.every(arrow => (arrow.userData.length > 0) === (n.power > 0)), 'engine heat arrows follow input');
  ok((T.rejectionArrow.userData.length > 0) === (Math.abs(n.radiatorHeat) > 1), 'radiator arrow follows heat transfer');
  near(T.rotor.rotation.z, -n.t * Math.PI / 30, 1e-12, 'rotor responds to elapsed circulation');
  for (const [curve, temperature] of [[T.engineCurve, n.celsius], [T.waxCurve, n.waxCelsius]]) {
    const drawn = points(curve);
    if (!n.t) ok(drawn.length === 0 && !curve.visible, 'ready state has no future trace');
    else {
      ok(drawn.every(p => p.x <= chartX(state, n.t) + 2e-7 && p.y >= CHART.y - 2e-7 && p.y <= CHART.y + CHART.h + 2e-7), 'chart contains only elapsed temperatures in its range');
      near(drawn.at(-1).x, chartX(state, n.t), 2e-7, 'last plotted time');
      near(drawn.at(-1).y, chartY(temperature), 2e-7, 'last plotted temperature');
    }
  }
  const rows = Object.fromEntries(state.readings.map(row => [row.label, row.value]));
  assert.equal(rows['Valve travel'], `${fixed(travel, 2)} mm down`);
  assert.equal(rows['Engine / wax temperature'], `${fixed(n.celsius, 2)} / ${fixed(n.waxCelsius, 2)} °C`);
  assert.equal(rows['Radiator / bypass flow'], `${fixed(n.toRadiator * 1e6, 1)} / ${fixed(n.toBypass * 1e6, 1)} mL/s`);
  ok(state.readings.every(row => !/NaN|undefined|Infinity|null/.test(row.value + (row.hint || ''))), 'finite learner readings');
  m.root.traverse(object => {
    ok(object.matrixWorld.elements.every(Number.isFinite), 'finite scene transform');
    if (object.geometry?.attributes.position) ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite), 'finite scene vertices');
  });
  poses++;
}

near(MM, .04, 0, 'uniform thermostat drawing scale');
assert.deepEqual([T.capsule.parent, T.piston.parent, T.springPart.parent], [T.frame, T.frame, T.frame]);
assert.equal(T.valve.parent, T.capsule); assert.equal(T.waxPart.parent, T.capsule);
assert.deepEqual(m.controls.map(c => c.key), Object.keys(WAX_DOMAINS));
for (const control of m.controls) { assert.deepEqual([control.min, control.max, control.step], WAX_DOMAINS[control.key]); assert.equal(control.initial, WAX_DEFAULTS[control.key]); ok(Boolean(control.help), 'control has teaching help'); }
for (const [a, b] of [[T.pumpOutlet.points.at(-1), T.jacket.points[0]], [T.jacket.points.at(-1), T.engineOutlet.points[0]], [T.bypassRoute.points.at(-1), T.mixedReturn.points[0]], [T.radiatorReturn.points.at(-1), T.mixedReturn.points[0]]]) assert.deepEqual(a, b, 'coolant paths connect');
const singles = Object.entries(WAX_DOMAINS).flatMap(([key, [lo, hi, step]]) => Array.from({length: Math.round((hi - lo) / step) + 1}, (_, i) => ({...WAX_DEFAULTS, [key]: lo + i * step})));
const corners = [5, 20].flatMap(growth => [0, 24].flatMap(load => [-10, 40].flatMap(ambient => [-10, 120].map(start => ({growth, load, ambient, start})))));
for (const values of [...singles, ...corners]) { m.reset(); m.update(values); inspectPose(); m.advance(10); inspectPose(); m.advance(10); inspectPose(); ok(m.playback.complete() && m.resultPart.available(), 'twenty seconds completes run'); }
for (const values of [{}, {start: 110, load: 0}]) {
  const plan = waxPlan(values), events = plan.track.filter((node, i) => i && ((node.melted > 0) !== (plan.track[i - 1].melted > 0)));
  ok(events.length > 0, 'warming or cooling crosses seated boundary');
  for (const event of events) for (const time of [event.t - .037, event.t, event.t + .037]) { m.reset(); m.update(values); m.advance(time / 60); inspectPose(); }
}
const expected = waxAt(waxPlan({}), 1200);
for (const frames of [20, 120, 600]) { m.reset(); for (let i = 0; i < frames; i++) m.advance(20 / frames); near(m.getState().now.celsius, expected.celsius, 1e-10, 'frame-independent temperature'); ok(m.playback.complete(), 'frame-independent completion'); }
m.reset(); for (let i = 0; i < 10; i++) m.playback.step(); ok(m.playback.complete(), 'ten two-minute steps complete run');
const snapshot = JSON.stringify(m.getState());
for (const action of m.actions) { action.run(); assert.equal(JSON.stringify(m.getState()), snapshot); ok(action.replay === false && m.parts.some(p => p.id === action.part), 'inspection cannot advance time'); }
for (const [key, value] of [['growth', 5], ['load', 0], ['ambient', -10], ['start', 110]]) { m.reset(); m.advance(10); m.update({[key]: value}); ok(m.getState().clock === 0 && m.getState().now.pumpFlow === 0 && !m.resultPart.available(), 'changed control resets entire trial'); inspectPose(); }
m.reset(); m.advance(3); const elapsed = m.getState().clock; m.update({growth: 12}); near(m.getState().clock, elapsed, 0, 'unchanged control preserves history');
for (const invalid of [-1, NaN, Infinity]) { m.advance(invalid); near(m.getState().clock, elapsed, 0, 'invalid advance cannot move time'); }
m.reset(); m.animate(0); m.animate(2); near(m.getState().clock, 120, 0, 'animation clock conversion');
assert.equal(m.resultPart.id, 'system'); ok(!m.resultPart.focusOnComplete, 'completion preserves whole cooling loop');

const endText = ['80.8', '83.4', '79.2', '69.3', '90.5', '65.9', '85.7'];
assert.equal(lesson.tryIt.length, 7);
for (const [i, trial] of lesson.tryIt.entries()) {
  assert.deepEqual(Object.keys(trial.values).sort(), Object.keys(WAX_DEFAULTS).sort());
  ok(trial.reset === true && trial.isolate === false && trial.part === 'system' && trial.view === 'front', 'trial prepares entire mechanism');
  m.reset(); m.update(trial.values); inspectPose();
  if (i === 1 || i === 2) assert.equal(fixed(m.getState().now.stroke * 1000, 2), i === 1 ? '3.58' : '14.32', 'growth trials begin at their quoted opening');
  m.advance(20); inspectPose(); const n = m.getState().now;
  assert.equal(fixed(n.celsius, 1), endText[i]); ok(trial.observe.includes(endText[i] + ' °C'), 'quoted trial temperature matches computed result');
  if (i === 3) ok(n.melted === 0 && n.toRadiator === 0 && n.rate > 0, 'light load still warms with solid wax');
  if (i === 4) { assert.equal(fixed(n.stroke * 1000, 2), '5.60'); ok(Math.abs(n.rate) < .001, 'heavy-load balance wording'); }
  if (i === 5) ok(n.stroke === 0 && n.pumpFlow === .0008 && n.power === 0, 'cooling reseats valve while pump keeps running');
  if (i === 6) assert.equal(fixed(n.toRadiator * 1e6, 0), '170');
}
assert.deepEqual(lesson.parts.map(p => p.name).sort(), m.catalogParts.map(p => p.name).sort());
assert.equal(lesson.quiz.answer, 0); assert.equal(lesson.quiz.options.length, 3); assert.equal(lesson.steps.length, 6);
for (const text of [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(p => [p.title, p.body]), ...lesson.parts.flatMap(p => [p.name, p.role]), ...lesson.deeper.flatMap(p => [p.title, p.body]), ...lesson.tryIt.flatMap(p => [p.title, p.instruction, p.observe])]) {
  ok(!/—|\s–\s| - |--/.test(text), 'no dash punctuation');
  ok(!/\b(centre|colour|litre|behaviour|modelling|grey|analyse|favour|fibre|vapour)\b/i.test(text), 'American English');
}
assert.deepEqual(lesson.deeper[0].body.match(/\d+(?:\.\d+)?/g), ['900', '12', '108', '4', '8.59']);
ok(waxLimits.includes('200 kPa') && waxLimits.includes('−10 to 120 °C') && waxLimits.includes('not a calibrated'), 'pressure, temperature and calibration limits are explicit');
ok(lesson.sources.length === 10 && new Set(lesson.sources.map(s => s.url)).size === 10 && lesson.sources.every(s => s.url.startsWith('https://')), 'distinct primary source links');
assert.equal(heatingLessons['Wax thermostat'], lesson);
const routed = createHeatingModel('Wax thermostat'); assert.deepEqual(routed.defaults, WAX_DEFAULTS); routed.dispose();

const resources = new Set(); m.root.traverse(object => { if (object.geometry) resources.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) { resources.add(material); if (material.map) resources.add(material.map); if (material.gradientMap) resources.add(material.gradientMap); } });
const disposed = new Map(); for (const object of resources) object.addEventListener('dispose', () => disposed.set(object, (disposed.get(object) || 0) + 1));
m.dispose(); m.dispose(); for (const object of resources) assert.equal(disposed.get(object), 1, 'current geometry, material and texture disposed exactly once');
console.log(JSON.stringify({status: 'PASS', checks, poses, singleControlValues: singles.length, corners: corners.length, trials: lesson.tryIt.length, resources: resources.size}));

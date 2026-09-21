import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleOven, ovenPlan, thermalGrid, topTemperature, pattern, couplingShare, spotSpacing, wavelength, diffusivity, stirShift, turns, stirs, OVEN, OVEN_DEFAULTS as D, OVEN_DOMAINS} from './microwave-physics.js';
import {createMicrowaveModel, foodColor, chartPoint} from './microwave-model.js';
import {microwaveLesson as lesson} from './microwave-lesson.js';
import {tally, checkTrialNumbers, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';

const t = tally(), TAU = Math.PI * 2;
const onTime = (time, level) => Math.floor(time / 20) * (level / 5) + Math.min(time % 20, level / 5);
t.near(wavelength(), 299792458 / 2.45e9, 1e-14, 'free-space wavelength');
t.near(2 * spotSpacing() * OVEN.frequency, OVEN.light, 1e-6, 'frequency times wavelength');
t.near(diffusivity(), 0.6 / (1000 * 4186), 1e-15, 'thermal diffusivity');
t.ok(299792458 / (2 * 0.09) < OVEN.frequency, '90 mm broad guide admits TE10');
for (const mass of Array.from({length: 10}, (_, i) => (i + 1) / 10)) {
  const g = thermalGrid(mass);
  t.near(g.cells.reduce((s, c) => s + c.mass, 0), mass, 1e-12, 'finite volumes recover mass');
  t.near(g.radius, Math.sqrt(mass / (1000 * Math.PI * .05)), 1e-14, 'cylindrical volume');
  assert.equal(g.cells.length, 1156);
  t.ok(g.stableStep > 17 * OVEN.step, 'positive explicit conduction weights');
  const pairs = new Set();
  for (const [a, b, G] of g.pairs) {
    t.ok(a !== b && G > 0 && a >= 0 && b >= 0 && a < g.cells.length && b < g.cells.length, 'valid conductive neighbor pair');
    const key = [a, b].sort((x, y) => x - y).join(':'); assert.ok(!pairs.has(key)); pairs.add(key);
  }
}
let scenarios = 0;
for (const mass of [.1, .3, 1]) for (const level of [0, 10, 50, 100]) for (const stirring of [0, 1, 2, 3]) {
  const values = {...D, mass, level, stirring, field: stirring % 3, seconds: level === 10 ? 300 : 120}, plan = ovenPlan(values);
  scenarios++;
  for (const time of [0, 1, 5, 9.5, 10, 19.5, 20, 60, 120, 300, plan.heatEnd]) {
    const s = sampleOven(values, time), effective = Math.min(time, plan.heatEnd);
    const made = 800 * onTime(effective, level), absorbed = made * (1 - Math.exp(-mass / .2));
    t.near(s.made, made, 2e-7, 'burst duration determines RF energy');
    t.near(s.absorbed, absorbed, 2e-7, 'chosen absorbed power integrates analytically');
    let stored = 0, min = Infinity, max = -Infinity;
    for (let i = 0; i < s.temperatures.length; i++) {
      const c = s.grid.cells[i], volume = c.area * .05 / 4;
      stored += volume * 1000 * 4186 * (s.temperatures[i] - 20);
      min = Math.min(min, s.temperatures[i]); max = Math.max(max, s.temperatures[i]);
    }
    t.near(stored, absorbed, 2e-7, 'all spatial temperatures conserve absorbed energy');
    t.near(s.meanT, 20 + absorbed / (mass * 4186), 2e-9, 'mean follows total heat and total mass');
    t.near(s.minT, min, 1e-12, 'minimum includes every volume'); t.near(s.maxT, max, 1e-12, 'maximum includes every volume');
    t.ok(min >= 20 - 1e-10 && max <= 100 + 1e-10, 'no unmodeled boiling or negative heating');
    assert.equal(s.on, time > 0 && time < plan.heatEnd && time % 20 < level / 5);
  }
  const end = plan.atEnd, stand = plan.afterStanding;
  t.near(end.absorbed, stand.absorbed, 1e-9, 'standing adds no RF energy');
  t.near(end.meanT, stand.meanT, 1e-9, 'standing preserves mean');
  t.ok(stand.maxT <= end.maxT + 1e-9 && stand.minT >= end.minT - 1e-9, 'standing obeys maximum principle');
  if (plan.limitTime !== null) { t.near(end.maxT, 100, 1e-10, 'first hot volume reaches model boundary'); t.ok(plan.heatEnd < values.seconds, 'limit precedes requested timer'); }
  if (level === 0) { t.near(stand.minT, 20, 0, 'zero power leaves all cells cold'); t.near(stand.maxT, 20, 0, 'zero power makes no hot cells'); }
}
for (const values of [{}, {mass: .1, seconds: 300}, {stirring: 3, level: 50, seconds: 240}, {mass: 1, field: 2}]) {
  const a = ovenPlan(values), b = ovenPlan(values, .05);
  let difference = 0;
  for (let i = 0; i < a.afterStanding.temperatures.length; i++) difference = Math.max(difference, Math.abs(a.afterStanding.temperatures[i] - b.afterStanding.temperatures[i]));
  t.ok(difference < .02, 'half-step thermal convergence below 0.02°C');
}
for (const time of [0, .1, 1, 3, 7.9, 8, 60]) {
  const [dx, dz] = stirShift(time);
  t.near(Math.hypot(dx, dz), .4 * spotSpacing(), 1e-14, 'mode-stirrer shift follows one circle');
  t.near(dx, .4 * spotSpacing() * Math.cos(TAU * time / 8), 1e-14, 'shift shares blade phase');
  t.near(pattern({...D, stirring: 0}, 0, 0, time), .4, 1e-12, 'chosen weak-center field');
  t.near(pattern({...D, stirring: 0, field: 1}, 0, 0, time), 1.6, 1e-12, 'chosen strong-center field');
}
const angularSpread = time => {
  const s = sampleOven({}, time), first = 3 * s.grid.plane.length + 1 + 5 * 32;
  const ring = s.temperatures.slice(first, first + 32);
  return (Math.max(...ring) - Math.min(...ring)) / (s.meanT - 20);
};
t.ok(angularSpread(1) > .05, 'first second is not an instantaneous full-rotation average');
t.ok(angularSpread(60) < angularSpread(1) * .15, 'rotation samples many angles over time');

const model = createMicrowaveModel(), p = model.topology, MM = p.MM;
const c0 = foodColor(20), c1 = foodColor(100);
for (const values of [{}, {stirring: 0}, {stirring: 2}, {stirring: 3, field: 2}, {field: 1}, {mass: .1}, {mass: 1}, {level: 0}, {level: 50, seconds: 120}, {seconds: 300}]) {
  for (const clock of [0, 1, 5, 13, 60, 120, 300]) {
    model.reset(); model.update(values); model.advance(clock / 10);
    const s = model.getState(); t.near(s.clock, clock, 1e-12, 'playback clock');
    model.root.updateMatrixWorld(true);
    t.near(p.thermalMesh.scale.x / MM / 1000, s.grid.radius, 1e-12, 'food radius matches finite volumes');
    t.near(p.turntable.rotation.y, turns(s.values.stirring) ? TAU * s.motionClock / 10 : 0, 1e-12, 'turntable follows finite-time path and stops with timer');
    t.near(p.coupling.rotation.y, p.turntable.rotation.y, 0, 'coupling drives the plate');
    t.near(p.blades.rotation.y, stirs(s.values.stirring) ? TAU * s.motionClock / 8 : 0, 1e-12, 'stirrer matches pattern cycle');
    for (const a of p.energyArrows) assert.equal(a.visible, s.on);
    assert.equal(p.antenna.material.color.getHex(), s.on ? 0xffb347 : 0x8a7d55);
    const color = p.thermalMesh.geometry.attributes.color;
    for (let i = 0; i < color.count; i++) {
      const expected = s.temperatures[p.thermalIndices[i]];
      const rendered = 20 + (color.getX(i) - c0.r) / (c1.r - c0.r) * 80;
      t.near(rendered, expected, 1e-5, 'every heat-map vertex uses its thermal volume');
    }
    for (const [line, field] of [[p.minLine, 'minT'], [p.maxLine, 'maxT'], [p.meanLine, 'meanT']]) {
      assert.equal(line.geometry.drawRange.count, s.samples.length);
      for (let i = 0; i < s.samples.length; i += 25) {
        const v = chartPoint(s.samples[i].t, s.samples[i][field]);
        t.near(line.geometry.attributes.position.getY(i), v[1], 1e-6, 'chart plots same temperatures');
      }
    }
    for (const spot of p.spots.filter(x => x.visible)) {
      const x = spot.position.x / MM / 1000, z = spot.position.z / MM / 1000;
      t.near(pattern({...s.values, stirring: stirs(s.values.stirring) ? 2 : 0}, x, z, s.motionClock), 1.6, 1e-10, 'field guide sits at prescribed deposition maximum');
    }
    checkFinite(model.root, t);
  }
}
model.reset(); model.advance(12); model.update({mass: 1}); t.near(model.getState().clock, 0, 0, 'changing physical setting resets trial');
model.advance(3); model.update({mass: 1}); t.near(model.getState().clock, 30, 0, 'reapplying same setting preserves clock');
for (const action of model.actions) { action.run(); t.ok(Number.isFinite(model.getState().clock), 'inspection action selects a finite time'); }
model.reset(); assert.equal(model.resultPart.available(), false); model.playback.step(); t.near(model.getState().clock, 10, 0, 'step advances ten oven seconds'); assert.equal(model.resultPart.available(), true);
model.advance(1e4); assert.equal(model.playback.complete(), true); model.reset(); assert.equal(model.playback.complete(), false);

model.reset(); model.root.rotation.set(0, 0, 0); model.root.updateMatrixWorld(true);
function unobstructed(objects, a, b, message) {
  const from = new THREE.Vector3(...a.map(v => v * MM)), to = new THREE.Vector3(...b.map(v => v * MM));
  const ray = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, from.distanceTo(to));
  assert.equal(ray.intersectObjects(objects, true).length, 0, message); t.add();
}
unobstructed(p.roof, [25, 230, -63], [25, 210, -63], 'cavity ceiling has an inlet');
unobstructed(p.floor, [0, 10, 0], [0, -10, 0], 'turntable shaft has a floor opening');
const metalGuide = p.waveguide.children.filter(o => !p.inletCover.includes(o));
unobstructed(metalGuide, [205, 256, -40], [25, 256, -63], 'guide has a connected hollow horizontal passage');
unobstructed(metalGuide, [25, 256, -63], [25, 205, -63], 'guide opens down into cavity');
unobstructed(p.inletCover, [40, 225, -40], [40, 205, -40], 'protective cover has stirrer-shaft clearance');
const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
for (const [a, b, axis] of [[0, 1, 'x'], [129, 130, 'y']]) {
  p.screen.getMatrixAt(a, matrix); matrix.decompose(position, rotation, scale); const first = position[axis];
  p.screen.getMatrixAt(b, matrix); matrix.decompose(position, rotation, scale);
  t.near((position[axis] - first) / MM, 2, 1e-5, 'screen pitch');
}
p.screen.getMatrixAt(0, matrix); matrix.decompose(position, rotation, scale); t.near(scale.x / MM, .45, 1e-6, 'screen wire width');
t.near(2 - scale.x / MM, 1.55, 1e-6, 'screen opening');
t.near(p.plate.position.y / MM - 3, 8, 1e-12, 'plate underside height');
for (const roller of p.rollers) { t.near(roller.position.y / MM - 2, 4, 1e-12, 'roller rests on cavity floor'); t.near(roller.position.y / MM + 2, 8, 1e-12, 'roller touches plate'); }
t.near(p.bowlBase.position.y / MM - 1.5, 14, 1e-12, 'bowl base rests on plate');
t.near(p.bowlBase.position.y / MM + 1.5, p.FOOD_BOTTOM, 1e-12, 'food rests in bowl');
for (const guide of [p.field, p.chart, p.molecules]) assert.equal(guide.userData.explosionExcluded, true);
assert.ok(model.controls.find(c => c.key === 'stirring').primary, 'arrangement selector visible above scene');
checkControlsMove(model, () => [p.turntable.rotation.y, p.blades.rotation.y, p.thermalMesh.scale.x, p.timeBar.scale.y, p.powerBar.scale.y, [...p.thermalMesh.geometry.attributes.color.array.slice(0, 36)], p.spots.map(s => s.position.toArray())], m => m.advance(3), t);

const ref = ovenPlan({}), at = s => ({...s, ...s.atEnd});
checkTrialNumbers(lesson, {
  'Heat the reference sample': s => ({'37.29': s.atEnd.absorbed / 1000, '49.7': s.atEnd.meanT, '24.3': s.atEnd.minT, '73.5': s.atEnd.maxT}),
  'Watch the standing period': s => ({'24.3': s.atEnd.minT, '73.5': s.atEnd.maxT, '27.9': s.afterStanding.minT, '64.5': s.afterStanding.maxT, '300': OVEN.duration, '49.7': s.afterStanding.meanT}),
  'Half power for twice as long': s => ({'10': s.onFor, '37.29': s.atEnd.absorbed / 1000, '49.7': s.atEnd.meanT, '71.7': s.atEnd.maxT}),
  'Keep food and field stationary': s => ({'87.7': s.atEnd.maxT, '73.5': ref.atEnd.maxT}),
  'Turn the mode stirrer': s => ({'60': s.values.seconds, '31.7': s.atEnd.minT, '70.1': s.atEnd.maxT}),
  'Use both moving mechanisms': s => ({'60': s.values.seconds, '31.7': s.atEnd.minT, '69.0': s.atEnd.maxT}),
  'Put a strong field at the center': s => ({'60.1': topTemperature(at(s), 0, 0), '28.5': topTemperature(at(ref), 0, 0)}),
  'Heat a smaller portion': s => ({'18.89': s.atEnd.absorbed / 1000, '65.1': s.atEnd.meanT, '97.3': s.atEnd.maxT}),
  'Heat a larger portion': s => ({'47.68': s.atEnd.absorbed / 1000, '31.4': s.atEnd.meanT, '39.8': s.atEnd.maxT}),
  'Run with microwave output off': s => ({'20.0': s.afterStanding.meanT, '0.00': s.afterStanding.absorbed}),
  'Reach the experiment limit': s => ({'100': s.atEnd.maxT, '91.0': s.limitTime}),
  'Compare wavelength and spot spacing': s => ({'6.1': s.spacing * 100, '12.2': s.wavelength * 100}),
}, values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); }, t, model);
for (const trial of lesson.tryIt) {
  assert.deepEqual(Object.keys(trial.values).sort(), Object.keys(D).sort());
  assert.ok(model.parts.some(p => p.id === trial.part), trial.title + ': selected part exists');
}
assert.equal(lesson.quiz.answer, 0); assert.ok(lesson.limits.includes('not a real oven safety control'));
checkRefusals(sampleOven, OVEN_DOMAINS, t);
for (const step of [0, -.1, .2, .03, NaN, Infinity]) assert.throws(() => ovenPlan({}, step), RangeError);
const resources = checkDisposal(model, t);
console.log(JSON.stringify({result: 'PASS',scenarios,geometryStates:70,trials:lesson.tryIt.length,checks:t.count,resources}));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MAX_MIN_DEFAULTS as D, MAX_MIN_DOMAINS, MAX_MIN, SIX_RESERVOIR, SIX_FILL, reservoirHeight, reservoirVolume, sixLevels, sampleMaximumMinimum as sample, sixClock} from './maximum-minimum-physics.js';
import {createSixThermometerModel} from './maximum-minimum-model.js';
import {sixThermometerLesson as lesson} from './maximum-minimum-lesson.js';
import {tally, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), equal = (a, b, message) => {assert.deepEqual(a, b, message); t.add();};
const area = Math.PI / 4, bulb = SIX_RESERVOIR.capacity;
function integrateBulb(height) {
  let volume = 0;
  for (let i = 1; i < SIX_RESERVOIR.points.length; i++) {
    const a = SIX_RESERVOIR.points[i - 1], b = SIX_RESERVOIR.points[i], top = Math.min(height, b[1]); if (top <= a[1]) break;
    const radius = y => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), h = top - a[1];
    volume += Math.PI * h / 6 * (radius(a[1]) ** 2 + 4 * radius(a[1] + h / 2) ** 2 + radius(top) ** 2);
  }
  return volume;
}
t.near(bulb, integrateBulb(SIX_RESERVOIR.points.at(-1)[1]), 1e-10);
for (let i = 0; i <= 100; i++) {const v = bulb * i / 100; t.near(integrateBulb(reservoirHeight(v)), v, 1e-9); t.near(reservoirVolume(reservoirHeight(v)), v, 1e-9);}
for (let T = -30; T <= 50; T += .25) {
  const s = sixLevels(T), g = 1 + .000009 * (T - 20), alcohol = 1 + .0011 * (T - 20), mercury = 1 + .00018 * (T - 20);
  t.near((bulb + area * (90 - s.left)) * g, SIX_FILL.left * alcohol, 1e-10);
  t.near(area * (s.left + s.right + 180 + Math.PI * 12) * g, SIX_FILL.mercury * mercury, 1e-10);
  t.near((integrateBulb(s.receivingLevel) + area * (90 - s.right)) * g, SIX_FILL.right * alcohol, 1e-9);
  t.near(s.growth ** 3, g, 1e-14); t.ok(s.gasVolume > 0 && s.gasVolume < bulb * g);
  t.ok(s.left > -90 && s.left + 4 < 90 && s.right > -90 && s.right + 4 < 90);
}
let cases = 0;
for (const mean of [-10, 12, 30]) for (const swing of [0, 8, 15]) for (const response of [0, 60, 600, 1800]) {
  const values = {mean, swing, response}, omega = Math.PI / 12, tau = response / 3600;
  const temperature = h => mean + swing / Math.sqrt(1 + (omega * tau) ** 2) * Math.cos(omega * (h - 6) - Math.atan(omega * tau));
  for (const clock of [0, .001, .008, .016, .101, 3, 6, 6.166561017387798, 12, 18, 23.999, 24]) for (const since of [0, clock / 2, clock]) {
    const s = sample(values, clock, since); t.near(s.temperature, temperature(clock), 2e-14);
    let hi = -Infinity, lo = Infinity;
    for (let i = 0; i <= 1000; i++) {const T = temperature(since + (clock - since) * i / 1000); hi = Math.max(hi, T); lo = Math.min(lo, T);}
    t.ok(s.highest >= hi - 2e-14 && s.highest - hi < .00009, 'Exact maximum bounds independent dense scan');
    t.ok(s.lowest <= lo + 2e-14 && lo - s.lowest < .00009, 'Exact minimum bounds independent dense scan');
    t.ok(s.highest >= s.temperature && s.lowest <= s.temperature, 'Current endpoint always included');
    t.ok(s.maxIndex >= s.right - 1e-12 && s.minIndex >= s.left - 1e-12, 'No marker penetrates advancing mercury');
    if (since === clock) {t.near(s.highest, s.temperature, 1e-14); t.near(s.lowest, s.temperature, 1e-14);}
    t.ok(s.highAt >= since && s.highAt <= clock && s.lowAt >= since && s.lowAt <= clock); cases++;
  }
}
let integrationSteps = 0;
for (const response of [60, 600, 1800]) {
  const dt = 10, air = seconds => 12 + 8 * Math.cos(2 * Math.PI * (seconds / 3600 - 6) / 24), f = (time, T) => (air(time) - T) / response;
  let T = -20;
  for (let i = 0; i < 3 * 86400 / dt; i++) {
    const time = i * dt, a = f(time, T), b = f(time + dt / 2, T + a * dt / 2), c = f(time + dt / 2, T + b * dt / 2), d = f(time + dt, T + c * dt);
    T += dt * (a + 2 * b + 2 * c + d) / 6;
    if ((i + 1) * dt >= 2 * 86400 && (i + 1) % 360 === 0) t.near(T, sample({response}, ((i + 1) * dt - 2 * 86400) / 3600).temperature, 5e-8, 'Independent multi-day RK4 temperature response');
    integrationSteps++;
  }
}
checkRefusals(sample, MAX_MIN_DOMAINS, t);
for (const args of [[{}, 1, 2], [{}, -1], [{}, NaN], [{}, Infinity], [{}, 1, NaN]]) assert.throws(() => sample(...args));
for (const v of [-1, NaN, Infinity, bulb + 1]) assert.throws(() => reservoirHeight(v));
equal(sixClock(0), '9:00 am'); equal(sixClock(3), '12:00 pm'); equal(sixClock(15), 'Next day 12:00 am'); equal(sixClock(24), 'Next day 9:00 am');
const m = createSixThermometerModel(), g = m.topology;
const temperatures = [11.65, 17.40, 12.35, 11.65, 19.98, 20, 19.87, -5.13, 24.48, 12, 12.35, 12.35, 11.65, 11.65, 17.40];
const highs = [11.65, 17.40, 19.99, 19.99, 19.98, 20, 19.87, -2, 36.99, 12, 19.99, 12.35, 12.35, 19.99, 17.40];
const lows = [11.65, 11.65, 11.65, 4.01, 11.65, 12, 10.97, -8, 13.01, 12, 11.65, 12.35, 4.01, 4.01, 11.65];
const histories = [D, {...D, mean: -10, swing: 15, response: 0}, {...D, mean: 30, response: 1800}];
for (const [i, preset] of lesson.tryIt.entries()) for (const history of histories) {
  m.reset({time: 24, since: 12}); m.update(history); m.actions.at(-2).run(); m.advance(2);
  m.reset(preset.initialState); m.update(preset.values); const s = m.getState();
  equal(s.values, preset.values); equal(Object.keys(preset.values).sort(), Object.keys(D).sort());
  t.near(s.temperature, temperatures[i], .0051, preset.title); t.near(s.highest, highs[i], .0051); t.near(s.lowest, lows[i], .0051);
  equal(s.clock, preset.initialState.time); equal(s.resetAt, preset.initialState.since); equal(s.resetting, i === 10);
  t.ok(m.parts.some(p => p.id === preset.part));
}
for (const part of lesson.parts) t.ok(m.parts.some(p => p.name === part.name));
function meshVolume(mesh) {
  const positions = mesh.geometry.attributes.position, index = mesh.geometry.index, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let volume = 0;
  for (let i = 0; i < index.count; i += 3) {a.fromBufferAttribute(positions, index.getX(i)); b.fromBufferAttribute(positions, index.getX(i + 1)); c.fromBufferAttribute(positions, index.getX(i + 2)); volume += a.dot(b.cross(c)) / 6;}
  return Math.abs(volume * mesh.scale.x * mesh.scale.y * mesh.scale.z) / g.MM ** 3;
}
const radial = Math.sin(2 * Math.PI / 48) / (2 * Math.PI / 48), curved = Math.sin(Math.PI / 96) / (Math.PI / 96);
let poses = 0;
for (const values of [...histories, ...lesson.tryIt.map(p => p.values)]) for (const time of [0, .016, 3, 12, 24]) {
  m.reset({time}); m.update(values); m.root.updateMatrixWorld(true); const s = m.getState();
  for (const side of ['left', 'right']) {
    const {mercury, alcohol} = g.arms[side];
    t.near((mercury.position.y + mercury.scale.y / 2) / g.MM, s[side], 1e-12);
    t.near((alcohol.position.y - alcohol.scale.y / 2) / g.MM, s[side], 1e-12);
    t.near((alcohol.position.y + alcohol.scale.y / 2) / g.MM, SIX_RESERVOIR.points[0][1], 1e-12, 'Liquid stem meets reservoir neck without gap');
    t.near((mercury.position.y - mercury.scale.y / 2) / g.MM, -90, 1e-12, 'Mercury stem meets curved bend');
  }
  t.near(meshVolume(g.leftBulb.mesh) + meshVolume(g.arms.left.alcohol), s.leftVolume * radial, .001, 'Rendered left alcohol volume');
  t.near(meshVolume(g.rightBulb.mesh) + meshVolume(g.arms.right.alcohol), s.rightVolume * radial, .001, 'Rendered receiving alcohol volume');
  const bendVolume = area * Math.PI * 12;
  t.near(meshVolume(g.bend) + meshVolume(g.arms.left.mercury) + meshVolume(g.arms.right.mercury), (s.mercuryVolume - bendVolume + bendVolume * curved) * radial, .001, 'Rendered connected mercury volume');
  t.near(g.minIndex.position.y / g.MM, s.minIndex, 1e-12); t.near(g.maxIndex.position.y / g.MM, s.maxIndex, 1e-12);
  t.near(g.thermal.scale.x, s.growth, 1e-15);
  const positions = g.lines.geometry.attributes.position;
  for (let T = -30; T <= 50; T += 10) {const mark = sixLevels(T), i = (T + 30) * 4; t.near(positions.getY(i) / g.MM, mark.left, 1e-5); t.near(positions.getY(i + 2) / g.MM, mark.right, 1e-5);}
  equal(g.chart.userData.inspectionOnly, 'chart'); equal(g.chart.userData.explosionExcluded, true);
  t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(s.readings))); if (time === 12) checkFinite(m.root, t); poses++;
}
for (const history of histories) {
  m.reset({time: 12}); m.update(history); const before = m.getState(); m.actions.at(-2).run();
  for (let i = 1; i <= 6; i++) {m.playback.step(); const s = m.getState(); equal(s.clock, 12); t.near(s.temperature, before.temperature, 0); t.ok(s.leftMarker >= s.left - 1e-12 && s.rightMarker >= s.right - 1e-12); if (i < 6) {equal(s.resetting, true); equal(s.resetAt, 0);} else {equal(s.resetting, false); equal(s.resetAt, 12); t.near(s.minIndex, s.left, 1e-12); t.near(s.maxIndex, s.right, 1e-12);}}
  m.playback.step(); t.near(m.getState().clock, 12.25, 1e-12); m.advance(1000); t.ok(m.playback.complete());
  const held = JSON.stringify(m.getState()); m.advance(1); equal(JSON.stringify(m.getState()), held);
  m.reset(m.replayState()); m.update(history); equal(m.getState().clock, 0); equal(m.getState().resetAt, 0); t.ok(!m.playback.complete());
}
for (const action of m.actions) {m.reset(); const result = action.run(); equal(result, m.getState().readings); t.ok(m.parts.some(p => p.id === action.part));}
const resources = checkDisposal(m, t);
let layouts = 0;
for (const values of histories.slice(0, 2)) for (const aspect of [1, 1.24]) {
  const model = createSixThermometerModel(); model.reset({time: 24}); model.update(values); const held = JSON.stringify(model.getState());
  const {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect); explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const box = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return box;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Separated groups do not overlap');
  t.ok(boxes.length >= 7); explosion.update(0); explosion.dispose(); equal(JSON.stringify(model.getState()), held); model.dispose(); layouts++;
}
console.log(JSON.stringify({passed: true, checks: t.count, cases, integrationSteps, poses, presets: lesson.tryIt.length, histories: histories.length, actions: m.actions.length, layouts, resources}));

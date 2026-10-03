import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LIQUID_GLASS_DEFAULTS as D, LIQUID_GLASS_DOMAINS, liquidCavity, cavityVolume, cavityHeight, liquidThermometerPlan, sampleLiquidThermometer as sample, thermometerMark} from './liquid-thermometer-physics.js';
import {createLiquidThermometerModel} from './liquid-thermometer-model.js';
import {liquidThermometerLesson as lesson} from './liquid-thermometer-lesson.js';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
import {tally, checkFinite, checkDisposal, checkControlsMove, checkRefusals} from './model-check-kit.mjs';

const t = tally(), equal = (a, b, message) => {assert.deepEqual(a, b, message); t.add();};
const bores = Array.from({length: 8}, (_, i) => .15 + i * .05);
function integrateCavity(cavity, height) {
  let volume = 0;
  for (let i = 1; i < cavity.points.length; i++) {
    const a = cavity.points[i - 1], b = cavity.points[i];
    if (height <= a[1]) break;
    const top = Math.min(height, b[1]), h = top - a[1], radius = y => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    volume += h / 6 * Math.PI * (radius(a[1]) ** 2 + 4 * radius(a[1] + h / 2) ** 2 + radius(top) ** 2);
  }
  return volume;
}
for (const bore of bores) {
  const c = liquidCavity(bore), radius = bore / 2, neck = Math.sqrt(9 - radius ** 2);
  const idealBulb = Math.PI * (9 * neck - neck ** 3 / 3 + 18);
  t.near(c.neck, neck, 1e-12);
  t.near(c.bulbVolume / idealBulb, 1, .00008, 'Faceted longitudinal profile approximates spherical bulb within 0.008%');
  t.near(c.capacity, integrateCavity(c, c.points.at(-1)[1]), 1e-10, 'Independent Simpson integration of circular sections');
  for (let i = 0; i <= 100; i++) {
    const volume = c.capacity * i / 100, height = cavityHeight(c, volume);
    t.near(integrateCavity(c, height), volume, 1e-9, 'Inverse level encloses specified volume');
    t.near(cavityVolume(c, height), volume, 1e-9);
  }
}

let cases = 0, integrationSteps = 0;
for (const liquid of [0, 1]) for (const bore of bores) for (const initial of [-20, 20, 40]) for (const surroundings of [-50, -40, 0, 20, 60]) for (const response of [5, 60, 120]) {
  const values = {liquid, bore, initial, surroundings, response}, beta = [180e-6, 1100e-6][liquid], p = liquidThermometerPlan(values);
  const volume = integrateCavity(p.cavity, p.cavity.neck) + Math.PI * (bore / 2) ** 2 * 100;
  const boundary = liquid === 0 ? -38.84 : -114;
  const crossing = surroundings < boundary ? response * Math.log((initial - surroundings) / (boundary - surroundings)) : Infinity;
  for (const time of [0, 1, 30, 60, 120, 300, 900, 1800]) {
    const s = sample(values, time), elapsed = Math.min(time, 900, crossing), temperature = surroundings + (initial - surroundings) * Math.exp(-elapsed / response), dt = temperature - 20;
    t.near(s.clock, elapsed, 1e-10); t.near(s.temperature, temperature, 1e-11);
    t.near(s.referenceVolume, volume, 1e-10); t.near(s.liquidVolume, volume * (1 + beta * dt), 1e-10);
    t.near(integrateCavity(s.cavity, s.meniscus) * (1 + 9e-6 * dt), s.liquidVolume, 1e-9, 'Volume conserved even outside the capillary');
    t.near(s.growth ** 3, 1 + 9e-6 * dt, 1e-14);
    t.near(s.sensitivity, volume * (beta - 9e-6) / (Math.PI * (bore / 2) ** 2), 1e-11);
    equal(s.phaseLimit, time >= crossing); t.ok(s.temperature >= boundary - 1e-10);
    if (s.reading !== null) {
      t.near(s.reading, temperature, 1e-11);
      t.near(thermometerMark(s, temperature), s.meniscus, 1e-9, 'Engraved mark and level agree in expanding glass coordinates');
      const increment = 1e-3;
      t.near((thermometerMark(s, 20 + increment) - thermometerMark(s, 20 - increment)) / (2 * increment), s.sensitivity, 2e-8, 'Sensitivity is derivative of calibrated height');
    } else t.ok(s.phaseLimit || !s.inCapillary, 'Unavailable reading has a physical reason');
    if (s.phaseLimit) equal(s.reading, null, 'Frozen-liquid reading is never invented');
    cases++;
  }
}
for (const values of [{}, {initial: -20, surroundings: 60, response: 5}, {liquid: 0, surroundings: -50, response: 120}]) {
  const full = {...D, ...values}, end = Math.min(3 * full.response, liquidThermometerPlan(full).phaseTime), step = end / 4096;
  let temperature = full.initial;
  for (let i = 1; i <= 4096; i++) {
    const f = x => (full.surroundings - x) / full.response;
    const a = f(temperature), b = f(temperature + step * a / 2), c = f(temperature + step * b / 2), d = f(temperature + step * c);
    temperature += step * (a + 2 * b + 2 * c + d) / 6;
    if (i % 128 === 0) t.near(sample(full, i * step).temperature, temperature, 2e-10, 'Independent RK4 response');
    integrationSteps++;
  }
}
equal(sample({surroundings: 20}, 900).temperature, 20);
equal(sample({liquid: 0, surroundings: -50}, 900).status, 'phase-limit');
equal(sample({bore: .15, surroundings: 60}, 900).status, 'expansion-chamber');
equal(sample({bore: .15, surroundings: -50}, 900).status, 'below-capillary');
equal(sample({bore: .5, surroundings: -50}, 900).status, 'readable');
checkRefusals(sample, LIQUID_GLASS_DOMAINS, t);
for (const bad of [-1, NaN, Infinity, 1e9]) assert.throws(() => cavityHeight(liquidCavity(.3), bad), RangeError);

const m = createLiquidThermometerModel(), g = m.topology, histories = [D, {...D, bore: .15, surroundings: -50}, {...D, liquid: 0, surroundings: -50}];
const quotedTemperature = [7.36, 45.28, .37, 12.13, 20, -7.36, 7.36, 7.36, 59.73, -49.53, -38.84, -49.53, 59.73, .13, 20, 59.73];
const quotedSensitivity = {6: .291, 7: 7.091, 12: .737, 15: 1.111};
for (const [i, preset] of lesson.tryIt.entries()) for (const history of histories) {
  m.reset(); m.update(history); m.advance(100); m.reset(preset.initialState); m.update(preset.values);
  const s = m.getState(); equal(s.values, preset.values); equal(Object.keys(preset.values).sort(), Object.keys(D).sort(), 'Every preset owns all controls');
  t.near(s.temperature, quotedTemperature[i], .0051, preset.title);
  t.near(s.clock, i === 10 ? 110.16955710577 : preset.initialState.time, 1e-10);
  t.ok(m.parts.some(part => part.id === preset.part), 'Preset opens actual part');
  if (quotedSensitivity[i]) t.near(s.sensitivity, quotedSensitivity[i], .00051);
  if (i === 7) {t.near(s.markedLow, 5.90, .005); t.near(s.markedHigh, 33.68, .005);}
  if (i === 13) t.near(Math.abs(s.gap) / 20 * 100, .674, .0005);
  equal(s.reading === null, [8, 9, 10].includes(i));
}
for (const part of lesson.parts) t.ok(m.parts.some(p => p.name === part.name), 'Every glossary part exists');

function meshVolume(mesh) {
  const p = mesh.geometry.attributes.position, indices = mesh.geometry.index;
  let volume = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < indices.count; i += 3) {
    a.fromBufferAttribute(p, indices.getX(i)); b.fromBufferAttribute(p, indices.getX(i + 1)); c.fromBufferAttribute(p, indices.getX(i + 2));
    volume += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(volume) / g.MM ** 3;
}
let poses = 0;
for (const values of [...lesson.tryIt.map(p => p.values), {...D, liquid: 0, bore: .5, surroundings: -50}]) for (const time of [0, 60, 300, 900]) {
  m.reset({time}); m.update(values); m.root.updateMatrixWorld(true); const s = m.getState();
  t.near(g.meniscus.position.y / g.MM, s.meniscus, 1e-10); t.near(g.thermal.scale.y, s.growth, 1e-15);
  const volume = g.surfaces.reduce((sum, liquid) => sum + (liquid.mesh.visible ? meshVolume(liquid.mesh) : 0), 0);
  const radialApproximation = Math.sin(2 * Math.PI / 48) / (2 * Math.PI / 48);
  t.near(volume * s.glassVolumeFactor, s.liquidVolume * radialApproximation, .0008, 'Closed triangle meshes conserve volume within float32 and declared radial tessellation');
  t.ok(volume / s.equivalentVolume > .997 && volume / s.equivalentVolume < 1, 'Rendered 48-sided liquid volume within 0.3% of circular cavity');
  equal(g.surfaces[1].mesh.visible, s.meniscus > s.cavity.neck);
  equal(g.surfaces[2].mesh.visible, s.meniscus > s.cavity.stemTop);
  equal(g.surfaces[0].profile.at(-1), g.surfaces[1].profile[0], 'Bulb meets capillary at identical boundary');
  equal(g.surfaces[1].profile.at(-1), g.surfaces[2].profile[0], 'Capillary meets upper chamber at identical boundary');
  for (const surface of g.surfaces) t.near(surface.mesh.userData.level, Math.min(surface.profile.at(-1)[1], Math.max(surface.profile[0][1], s.meniscus)), 1e-10);
  equal(g.surface.material.color.getHex(), s.liquid.color);
  const tick = g.ticks.geometry.attributes.position;
  for (let temperature = -50; temperature <= 60; temperature++) {
    const index = 2 * (temperature + 50), valid = temperature >= s.markedLow && temperature <= s.markedHigh;
    if (valid) t.near(tick.getY(index) / g.MM, thermometerMark(s, temperature), 1.2e-5, 'Scale is recalibrated with liquid and bore');
    else t.near(tick.getX(index), 0, 0, 'No out-of-range tick');
  }
  const end = Math.min(900, s.phaseTime), final = new THREE.Vector3().fromBufferAttribute(g.trace.geometry.attributes.position, 180);
  t.near(final.x, g.chartPoint(end, 0)[0], 1e-7, 'Chart ends at liquid model boundary');
  t.near(final.y, g.chartPoint(end, sample(values, end).temperature)[1], 1e-7);
  t.near(g.cursor.position.x, g.chartPoint(s.clock, s.temperature)[0], 1e-12);
  equal(g.chartStatus.userData.labelText, s.phaseTime <= 900 ? 'Liquid model ends at freezing' : 'Temperature response'); t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(s.readings)));
  if (time === 300) checkFinite(m.root, t);
  poses++;
}
checkControlsMove(m, () => [g.meniscus.position.y, g.surface.material.color.getHex(), g.trace.geometry.attributes.position.getY(3), g.surfaces[1].profile[0][0]], model => model.advance(60 / 45), t);
for (const bore of bores) {
  if (Math.abs(m.getState().values.bore - bore) < 1e-12) continue;
  const replaced = [...g.shells.flatMap(mesh => [mesh.geometry, mesh.material]), ...g.surfaces.map(surface => surface.mesh.geometry)];
  const counts = new Map(replaced.map(resource => [resource, 0]));
  for (const resource of replaced) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  const liquidMaterial = g.surface.material; let liquidDisposals = 0;
  const onDispose = () => liquidDisposals++; liquidMaterial.addEventListener('dispose', onDispose);
  m.update({bore});
  t.ok([...counts.values()].every(count => count === 1), 'Changing bore releases every replaced shell and liquid geometry exactly once');
  equal(liquidDisposals, 0, 'Changing bore retains shared liquid material');
  equal(g.surface.material, liquidMaterial); liquidMaterial.removeEventListener('dispose', onDispose);
}
for (const action of m.actions) for (const values of histories) {
  m.reset(); m.update(values); const returned = action.run(); equal(returned, m.getState().readings); equal(m.getState().values, values);
  t.ok(m.parts.some(part => part.id === action.part)); t.ok(['front', 'iso'].includes(action.view));
}
for (const values of histories) {
  m.reset(); m.update(values); m.playback.step(); t.near(m.getState().clock, 30, 1e-10);
  m.advance(100); t.ok(m.playback.complete()); t.ok(!m.playback.blocked(), 'Completed state permits replay');
  const held = JSON.stringify(m.getState()); m.advance(1); equal(JSON.stringify(m.getState()), held, 'Completed state remains stable');
  m.reset(m.replayState()); m.update(values); equal(m.getState().clock, 0, 'Replay restarts completed checkpoint at the chosen initial temperature');
  m.reset(); m.update(values); t.ok(!m.playback.complete());
}
const resources = checkDisposal(m, t);
let layouts = 0;
for (const values of [D, {...D, bore: .15, surroundings: 60}]) for (const aspect of [1, 1.24]) {
  const model = createLiquidThermometerModel(); model.update(values); model.advance(300 / 45);
  const held = JSON.stringify(model.getState()), {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect); explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {
    const box = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return box;
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Separated groups do not overlap');
  t.ok(boxes.length >= 4); equal(model.topology.guide.userData.explosionExcluded, true); equal(model.topology.chart.userData.explosionExcluded, true);
  explosion.update(0); explosion.dispose(); equal(JSON.stringify(model.getState()), held); model.dispose(); layouts++;
}
console.log(JSON.stringify({passed: true, checks: t.count, cases, presets: lesson.tryIt.length, histories: histories.length, poses, integrationSteps, actions: m.actions.length, layouts, resources}));

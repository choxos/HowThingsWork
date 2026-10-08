import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCartridgeExtinguisherModel} from './cartridge-extinguisher-model.js';
import {cartridgeExtinguisherLesson as lesson} from './cartridge-extinguisher-lesson.js';
import {FIRE_DEFAULTS, FIRE_OPTIONS, FIRE_SHAPE as S, FIRE_PHYSICS as P, FIRE_VOLUME_SCALE,
  cartridgeExtinguisherPlan} from './cartridge-extinguisher-physics.js';
import {createSafetyModel} from './safety-models.js';
import {safetyLessons} from './safety-lessons.js';

let checks = 0, poses = 0, triangles = 0, combinations = 0;
const ok = (condition, message) => {checks++;assert(condition, message);};
const eq = (actual, expected) => {checks++;assert.deepEqual(actual, expected);};
const near = (actual, expected, tolerance = 1e-7) => {checks++;assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}, tolerance ${tolerance}`);};
const model = createCartridgeExtinguisherModel(), g = model.topology;
const bounds = object => {object.updateMatrix();return new THREE.Box3().setFromBufferAttribute(object.geometry.attributes.position).applyMatrix4(object.matrix);};
const signedVolume = object => {
  object.updateMatrix();const p = object.geometry.attributes.position, index = object.geometry.index;
  let volume = 0;const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    a.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(object.matrix);
    b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1).applyMatrix4(object.matrix);
    c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2).applyMatrix4(object.matrix);
    volume += a.dot(b.cross(c)) / 6;triangles++;
  }
  return volume;
};
const drawnFluid = variants => variants.filter(variant => variant.group.visible)
  .flatMap(variant => variant.group.children).filter(object => object.visible)
  .reduce((sum, object) => sum + signedVolume(object), 0) * FIRE_VOLUME_SCALE;
const circleShare = Math.sin(2 * Math.PI / 64) * 64 / (2 * Math.PI);

eq(model.controls.map(control => control.key), ['water','charge','pickup']);eq(model.parts.length, 12);eq(model.catalogParts.length, 10);eq(model.covers.length, 12);
for (const control of model.controls) eq(control.options, FIRE_OPTIONS[control.key]);
eq(model.initialPart, 'system');ok(model.initialCutaway && model.initialIsolated && model.frameVisibleOnly);
for (const part of model.parts) {ok(part.name && part.description);ok(!part.parentId || model.parts.some(parent => parent.id === part.parentId));}
for (const part of lesson.parts) ok(model.parts.some(item => item.name === part.name));
near(bounds(g.rearShell).min.y, 0);near(bounds(g.rearShell).max.y, S.height);near(bounds(g.bottom).max.y, 0);
near(bounds(g.cartBase).min.y, S.cartridge.bottom);near(bounds(g.cartBase).max.y, S.cartridge.bottom + S.cartridge.base);
near(bounds(g.cartShoulder).max.y, S.cartridge.shoulder);near(bounds(g.cartNeckBack).min.y, S.cartridge.shoulder);near(bounds(g.cartNeckBack).max.y, S.cartridge.top);
near(g.hoseCurve.getPoint(0).distanceTo(new THREE.Vector3(S.tube.x, 3.42, 0)), 0);
near(g.hoseCurve.getPoint(1).distanceTo(new THREE.Vector3(3.25, 3.32, 0)), 0);
near(bounds(g.nozzleBack).min.y, S.nozzleHeight);near(bounds(g.nozzleBack).max.y, 3.32);
near(g.extinguisher.position.x + g.nozzle.position.x, g.collection.position.x);
ok(S.tube.bore > S.nozzleBore && S.tube.radius > S.tube.bore);
ok(g.gasLabel.position.y - .10 > S.height, 'The pressure label stays above the gas region and its arrows');
for (const [i, variant] of g.pickupVariants.entries()) {
  near(bounds(variant.back).min.y, S.pickup[i]);near(bounds(variant.back).max.y, 3.42);
  near(variant.group.position.x, S.tube.x);
}
for (const [i, dot] of g.waterDots.entries()) eq(dot.parent, i < 10 ? g.pickup : g.hose);
for (const tick of g.tickMarks) ok(bounds(g.nameplate).max.x < bounds(tick).min.x);
const labelRight = -.15 + 1.52 / 2;
ok(labelRight < S.collector.width / 2 - .33 - .27 / 2, 'The scale labels must remain beside the collector nameplate');

const geometryIds = new Map();model.root.traverse(object => {if (object.geometry) geometryIds.set(object, object.geometry.uuid);});
const inspectPose = () => {
  const {now, values, capacity, readings} = model.getState();poses++;
  eq(g.water.filter(variant => variant.group.visible).map(variant => variant.index), [values.pickup]);
  eq(g.gas.filter(variant => variant.group.visible).map(variant => variant.index), [values.pickup]);
  eq(g.pickupVariants.filter(variant => variant.group.visible).map(variant => variant.index), [values.pickup]);
  near(drawnFluid(g.water), now.water * circleShare, 2e-9);
  near(drawnFluid(g.gas), (capacity - now.water) * circleShare, 2e-9);
  near(drawnFluid(g.water) / circleShare + now.delivered, values.water / 1000, 2e-9);
  const water = g.water[values.pickup], gas = g.gas[values.pickup];
  eq(water.layers.filter(layer => layer.surface.visible).length, 1);eq(water.layers.filter(layer => layer.floorSurface.visible).length, 1);
  eq(gas.layers.filter(layer => layer.surface.visible).length, 1);eq(gas.layers.filter(layer => layer.floorSurface.visible).length, 1);
  for (const layer of water.layers) if (layer.surface.visible) near(layer.surface.position.y, now.level);
  for (const layer of gas.layers) if (layer.floorSurface.visible) near(layer.floorSurface.position.y, now.level);
  near(g.collected.scale.y * S.collector.width * S.collector.depth * FIRE_VOLUME_SCALE, now.delivered, 1e-10);
  eq(g.collected.visible, now.delivered > 0);eq(g.collectedLabel.userData.labelText, `${(now.delivered * 1000).toFixed(2)} L`);
  near(g.moving.position.y, -.20 * now.handle);
  near(g.spring.position.y + .3225 * g.spring.scale.y, g.moving.position.y + bounds(g.collar).min.y);
  const angle = g.lever.rotation.z, leverUnder = 3.90 + (-.25 - .50) * Math.tan(angle) - .045 / Math.cos(angle);
  near(leverUnder, 4.01 + g.moving.position.y);
  const tip = g.moving.position.y + bounds(g.cone).min.y;
  if (!now.released) ok(tip > 3.10 - 1e-7);else ok(tip <= 3.10 + 1e-7);
  eq(g.seal.visible, !now.released);eq(g.piercedSeal.visible, now.released);
  eq(g.chargeDots.filter(dot => dot.visible).length, now.released ? 0 : Math.round(values.charge * 20));
  eq(g.jet.visible, now.flow > 0);eq(g.splash.visible, now.flow > 0);
  eq(g.waterDots.every(dot => dot.visible), now.flow > 0);eq(g.drops.every(dot => dot.visible), now.flow > 0);
  if (now.flow > 0) {
    near(bounds(g.jet).max.y, S.nozzleHeight);near(bounds(g.jet).min.y, S.collector.bottom + g.collected.scale.y);
    for (const dot of g.drops) {ok(dot.position.y >= bounds(g.jet).min.y);ok(dot.position.y <= bounds(g.jet).max.y);}
  }
  ok(readings.every(reading => !/NaN|Infinity|undefined|null/.test(reading.value + ' ' + (reading.hint || ''))));
  model.root.traverse(object => {
    ok([...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()].every(Number.isFinite));
    if (object.geometry) eq(object.geometry.uuid, geometryIds.get(object));
  });
};
for (const water of [3,6,9]) for (const charge of [0,.25,1]) for (const pickup of [0,1,2]) {
  const settings = {water,charge,pickup}, plan = cartridgeExtinguisherPlan(settings);
  for (const time of [...new Set([0,1,2.999,3,Math.min(4,plan.duration),3+plan.dischargeTime/2,plan.duration])]) {
    model.reset({settings});model.advance(time / P.playbackRate);inspectPose();
    const before = JSON.stringify(model.getState());
    for (const action of model.actions) {action.run();eq(JSON.stringify(model.getState()), before);eq(action.replay, false);ok(model.parts.some(part => part.id === action.part));}
  }
  combinations++;
}
const results = [];
for (const trial of lesson.tryIt) {
  eq(trial.values, trial.initialState.settings);ok(trial.reset && trial.isolate && trial.view === 'front');
  model.reset(trial.initialState);const before = model.getState();
  eq(before.clock > 0, trial.initialState.checkpoint === 'midway');
  model.advance(1000);const done = model.getState();results.push([+(done.now.delivered * 1000).toFixed(2), done.reason]);
  model.reset(model.replayState());eq(model.getState(), before);model.advance(1000);eq(model.getState(), done);
}
eq(results, [[8.79,'pickup-exposed'],[4.29,'pressure-balance'],[0,'no-charge'],[2.88,'pickup-exposed'],[0,'dry-pickup'],[2.79,'pickup-exposed'],[8.79,'pickup-exposed']]);
model.reset();model.playback.step();near(model.getState().clock, 1);model.animate(.5);near(model.getState().clock, 2);
const saved = model.getState();
for (const invalid of [null, -1, NaN, Infinity, .1]) {model.animate(invalid);eq(model.getState(), saved);}
model.animate(1);near(model.getState().clock, 3);
for (const invalid of [null, [], {water:4}, {charge:.5}, {pickup:NaN}, {unknown:1}]) {const saved = model.getState();model.update(invalid);eq(model.getState(), saved);}
model.advance(1000);const completed = model.getState();for (const action of model.actions) {action.run();eq(model.getState(), completed);}
const exposed = model.getState();exposed.values.water = 99;exposed.now.water = 99;exposed.readings[0].value = 'bad';eq(model.getState(), completed);
model.update({water:3});eq(model.getState().clock, 0);eq(model.getState().now.delivered, 0);eq(model.replayState().settings, {...FIRE_DEFAULTS,water:3});
eq(safetyLessons['Fire extinguisher'], lesson);const routed = createSafetyModel('Fire extinguisher');eq(routed.controls, model.controls);routed.advance(1000);near(routed.getState().now.delivered, completed.now.delivered);routed.dispose();
const prose = JSON.stringify(lesson) + model.parts.map(part => part.name + part.description).join('') + model.controls.map(control => control.label + control.help).join('');
ok(!/[—–]| - |--/.test(prose));ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|fibre)\b/i.test(prose));
ok(lesson.sources.every(source => source.url.startsWith('https://')));eq(new Set(lesson.sources.map(source => source.url)).size, lesson.sources.length);
const resources = new Set();model.root.traverse(object => {
  if (object.geometry) {resources.add(object.geometry);ok([...object.geometry.attributes.position.array].every(Number.isFinite));}
  for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
    resources.add(material);for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
  }
});
const disposed = new Map([...resources].map(resource => [resource,0]));
for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
model.dispose();model.dispose();ok([...disposed.values()].every(count => count === 1));
console.log(JSON.stringify({status:'PASS', checks, combinations, poses, triangles, parts:model.parts.length, trials:results.length, disposed:resources.size, tessellationVolumeShare:circleShare}));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWaterClockModel, chartPoint} from './water-clock-model.js';
import {sampleWaterClock, WATER as W, WATER_DEFAULTS as D, referenceRise} from './water-clock-physics.js';
import {waterClockLesson as lesson} from './water-clock-lesson.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), m = createWaterClockModel(), p = m.topology, MM = p.MM, G = p.G;
const expected = (values, hours) => sampleWaterClock(values, hours);
const stateCore = s => [s.clock, s.level, s.shows, s.volume, s.collected, s.error, s.phase];
const within = (point, polygon) => {let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {const a = polygon[i], b = polygon[j]; if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;} return inside;};
const polygon = mesh => mesh.geometry.parameters.shapes.getPoints(32).map(v => m.root.worldToLocal(mesh.localToWorld(new THREE.Vector3(v.x * MM, v.y * MM, 0))).divideScalar(MM));
let poses = 0, toothSamples = 0;
for (const values of [{}, {rate: 0}, {rate: 50}, {rate: 200}, {design: 0}, {design: 0, bore: 2}, {design: 1}, {design: 1, bore: .6}]) for (const hours of [0, .37, 1, 3, 6, 8, 12]) {
  m.reset({settings: {...D, ...values}, time: hours}); m.update({...D, ...values}); m.root.updateMatrixWorld(true); const s = m.getState(); poses++;
  assert.deepEqual(stateCore(s), stateCore(expected(values, hours)));
  assert.equal(p.inflow.visible, s.values.design === 2); assert.equal(p.outflow.visible, s.values.design !== 2);
  if (s.values.design === 2) {
    const top = G.floor + s.floatTop * 1000;
    t.near(p.float.position.y / MM - 20, G.floor + s.floatBottom * 1000, 1e-10, 'float immersion drawn exactly');
    t.near(p.attachment.position.y / MM - 1.5, top, 1e-10, 'rack attachment meets float top');
    const lowerRack = p.rack.position.y / MM - (G.rackTeeth - .5) * Math.PI * 2;
    t.near(lowerRack, top + 3, 1e-10, 'rack meets attachment upper face');
    t.ok(lowerRack < 428 && p.rack.position.y / MM > 452, 'both guides engage the rack throughout travel');
    t.near(p.hand.rotation.z, -s.travel / .036, 1e-12, 'hand angle follows pitch travel');
    t.near(p.jarWater.scale.y, s.level * 1000, 1e-10, 'receiver level drawn at calculated height');
    t.near(p.bowlWater.scale.y, Math.max(.0001, s.collected * 1e9 / (Math.PI * 70 ** 2)), 1e-10, 'overflow bowl holds calculated depth');
    assert.equal(p.overflowDrop.visible, s.outflow > 0); assert.equal(p.feedStream.visible, s.flow > 0);
    const rackPolygon = polygon(p.rack), gearPolygon = polygon(p.pinion);
    for (let i = 0; i < gearPolygon.length; i++) {const a = gearPolygon[i], b = gearPolygon[(i + 1) % gearPolygon.length]; for (let j = 0; j < 3; j++) {const q = a.clone().lerp(b, j / 3); t.ok(!within(q, rackPolygon), 'pinion tooth edge does not penetrate rack'); toothSamples++;}}
    for (let h = 0; h < p.levelMarks.length; h++) t.near(p.levelMarks[h].position.y / MM, G.floor + (W.initialLevel + h * referenceRise) * 1000, 1e-10, 'level graduations stay fixed');
  } else {
    p.potWater.geometry.computeBoundingBox();
    t.near(p.potWater.geometry.boundingBox.max.y / MM, s.level * 1000, 2e-5, 'pot water envelope matches calculated height');
    t.near(p.catchWater.scale.y, Math.max(.0001, s.collected * 1e9 / (Math.PI * 220 ** 2)), 1e-10, 'catch basin level conserves water');
    assert.equal(p.potStream.visible, s.flow > 0);
    for (let h = 0; h < s.marks.length; h++) t.near(p.potTicks[h].tick.position.y / MM, s.marks[h] * 1000, 1e-10, 'outflow graduation at unchanged reference level');
    t.ok(p.potWater.material.polygonOffset && !p.potWater.material.depthWrite, 'water interface avoids coplanar depth artifacts');
  }
  const times = p.plotTimes(); for (let i = 0; i < times.length; i += 13) {const v = chartPoint(times[i], expected(s.values, times[i]).shows); t.near(p.trace.geometry.attributes.position.getY(i), v[1], 1e-6, 'chart follows fixed clock indication');}
  t.near(p.cursor.position.x, chartPoint(hours, s.shows)[0], 1e-12, 'plot marker tracks elapsed time');
  checkFinite(m.root, t);
}
// A complete tooth cycle at small increments catches phase errors that whole
// hour steps (exactly three teeth) could conceal.
m.reset();
for (let i = 0; i <= 72; i++) {
  m.reset({time: i / 216, settings: {...D}}); m.update(D); m.root.updateMatrixWorld(true);
  const rackPolygon = polygon(p.rack), gearPolygon = polygon(p.pinion);
  for (const q of gearPolygon) {t.ok(!within(q, rackPolygon), 'continuous rack/pinion tooth clearance'); toothSamples++;}
}
t.ok(m.followParts.includes('float') && m.followParts.includes('rack'), 'close inspection follows translating parts');
// One initial camera envelope must contain the full later stroke, including
// the float and the last rack tooth. The inspected orifice is actual hardware.
m.reset(); m.update(D); const initialBounds = m.frameBoundsForPart('system');
for (const rate of [0, 100, 200]) for (const time of [0, 6, 12]) {
  m.reset({settings: {...D, rate}, time}); m.update({...D, rate}); m.root.updateMatrixWorld(true);
  for (const object of [p.float, p.rack, p.attachment]) {const b = new THREE.Box3().setFromObject(object); t.ok(initialBounds.clone().expandByScalar(1e-6).containsBox(b), 'whole-clock frame covers complete motion');}
}
for (const bore of [.6, 1, 2]) {
  m.reset({settings: {...D, design: 0, bore}, time: 12}); m.update({...D, design: 0, bore});
  const profile = p.orifice.geometry.parameters.points;
  t.near(profile[0].x / MM, bore / 2, 1e-12, 'inspection opening has actual selected radius');
  t.ok(p.orifice.visible && p.orifice.parent === p.outlet, 'orifice hardware remains inspectable after empty');
  t.ok(p.potStream.parent === p.catchPart, 'long stream cannot dominate orifice inspection frame');
}
// Reset from different histories must land on each named checkpoint exactly.
for (const trial of lesson.tryIt) for (const history of [{design: 0, bore: 2}, {design: 2, rate: 0}]) {
  m.reset({settings: {...D, ...history}, time: 11}); m.update({...D, ...history});
  m.reset(trial.initialState); m.update(trial.values);
  assert.deepEqual(stateCore(m.getState()), stateCore(expected(trial.values, trial.initialState.time)));
  t.ok(m.parts.some(part => part.id === trial.part), 'trial names an existing inspection target');
}
// Named numerical claims are independently held to their requested checkpoint.
const claims = [
  [0, s => s.shows, 6], [0, s => s.travel * 1000, 113.09733552923255],
  [1, s => -s.handAngle * 180 / Math.PI, 30], [2, s => s.shows, 3],
  [3, s => s.shows, 6], [4, s => s.shows, 0], [5, s => s.full, 6.366197723675815],
  [5, s => s.overflow * 1e6, 309.59965702884455], [6, s => s.shows, 12],
  [7, s => s.level * 1000, 91.75124597118443], [8, s => s.shows, 6.75],
  [9, s => s.collected * 1000, 28.274333882308138], [10, s => s.level * 1000, 166.93668401788182],
  [11, s => s.shows, 2.16], [12, s => s.shows, 3],
];
for (const [index, value, target] of claims) {const trial = lesson.tryIt[index]; t.near(value(expected(trial.values, trial.initialState.time)), target, 1e-9, 'named experiment numerical claim');}
for (const start of [0, 1, 2]) for (const action of m.actions) {m.reset({settings: {...D, design: start}, time: 3}); m.update({...D, design: start}); action.run(); const part = m.parts.find(x => x.id === action.part); let object = part.object, visible = true; while (object) {visible &&= object.visible; object = object.parent;} t.ok(visible, 'inspection action targets a visible part');}
m.reset(); m.update(D); m.advance(7); m.update({rate: 50}); t.near(m.getState().clock, 0, 0, 'setting change begins fresh trial');
m.advance(12); t.ok(m.playback.complete(), 'completion reached');
const replay = m.replayState(); m.reset(replay); m.update(replay.settings); t.near(m.getState().clock, 0, 0, 'replay starts from zero'); t.near(m.getState().values.rate, 50, 0, 'replay retains configured rate');
m.playback.step(); t.near(m.getState().clock, 1, 0, 'one-hour step');
m.reset(); m.update(D); const waterGeometry = p.potWater.geometry, plotGeometry = p.trace.geometry; for (let i = 0; i < 500; i++) m.advance(.01); assert.equal(p.potWater.geometry, waterGeometry); assert.equal(p.trace.geometry, plotGeometry);
t.ok(p.chart.userData.explosionExcluded && p.chart.userData.inspectionOnly, 'chart excluded from physical separation');
t.ok(m.thumbnailOmit.includes(p.chart), 'room preview contains apparatus only');
for (const c of m.controls) {if (c.key === 'rate') {t.ok(c.visibleWhen({design: 2}) && !c.visibleWhen({design: 0}), 'inflow control meaningful only for inflow');} if (c.key === 'bore') t.ok(c.visibleWhen({design: 0}) && !c.visibleWhen({design: 2}), 'outflow control meaningful only for outflow');}
t.ok(m.controls.find(c => c.key === 'design').primary, 'design selector visible immediately');
let layouts = 0;
for (const aspect of [1, 1.24]) for (const design of [0, 1, 2]) {
  const model = createWaterClockModel(); model.reset({time: 6, settings: {...D, design}}); model.update({...D, design});
  const before = JSON.stringify(model.getState()), {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect); explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const b = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) b.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return b;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'fully separated physical groups do not overlap');
  assert.equal(boxes.length, design === 2 ? 8 : 4); explosion.update(0); explosion.dispose(); assert.equal(JSON.stringify(model.getState()), before); model.dispose(); layouts++;
}
const resources = checkDisposal(m, t); m.dispose();
console.log(`PASS water clock model: ${t.count} checks, ${poses} poses, ${toothSamples} tooth-clearance samples, ${lesson.tryIt.length * 2} checkpoint trials, ${layouts} separated layouts, ${resources} resources`);

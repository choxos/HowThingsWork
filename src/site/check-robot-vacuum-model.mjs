import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRobotVacuumModel, roomPoint, SHADES} from './robot-vacuum-model.js';
import {ROBOT, START} from './robot-vacuum-room.js';
import {robotMission, sampleRobot, missionPlayTime} from './robot-vacuum-mission.js';
import {robotVacuumLesson as lesson} from './robot-vacuum-lesson.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';

const t = tally(), model = createRobotVacuumModel(), p = model.topology;
let poses = 0;
const near = (a, b, name, tolerance = 1e-8) => t.near(a, b, tolerance, name);
const publicState = () => JSON.stringify(model.getState());
assert.equal(new Set(model.parts.map(p => p.id)).size, model.parts.length);
assert.equal(model.controls.length, 5);
assert.equal(model.initialPart, 'robot');
const radius = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).toArray().reduce((a, b) => Math.max(a, b), 0) * .7;
for (const directions of Object.values(model.partViewDirections)) for (const direction of Object.values(directions)) t.ok(Math.hypot(...direction) * radius + ROBOT.radius * p.SCALE < 100, 'custom camera stays within far clipping plane');
for (const group of ['structure', 'drive', 'cleaner', 'power']) t.ok(model.parts.find(p => p.id === group).object.userData.explosionCategory, `${group} has its own separation category`);
near(Math.abs(p.wheels[0].group.position.z - p.wheels[1].group.position.z) / p.SCALE, .23, 'wheel spacing');
near(p.bumper.geometry.parameters.radius + p.bumper.geometry.parameters.tube, .17 * p.SCALE, 'bumper outer radius agrees with collision disk');
for (let room = 0; room < 3; room++) for (let strategy = 0; strategy < 3; strategy++) for (let charge = 0; charge < 3; charge++) for (let session = 0; session < 4; session++) for (let dockPower = 0; dockPower < 2; dockPower++) {
  const settings = {room, strategy, charge, session, dockPower}, mission = robotMission(settings);
  for (const time of [0, 15, mission.cleanEnd, mission.dockedAt - 1, mission.dockedAt + 30, mission.end]) {
    poses++; model.reset({settings, time}); model.root.updateMatrixWorld(true);
    const s = model.getState(), expected = sampleRobot(settings, time);
    near(s.clock, expected.clock, 'preset time restored'); near(s.battery, expected.battery, 'battery follows mission');
    near(s.coverage, expected.coverage, 'coverage follows mission'); assert.deepEqual(s.values, settings);
    const where = roomPoint(s.now.x, s.now.y);
    for (let axis = 0; axis < 3; axis++) near(p.robot.position.toArray()[axis], where[axis], 'robot world location');
    near(p.robot.rotation.y, s.now.h, 'robot heading');
    near(p.wheels[0].wheel.rotation.z, -s.now.leftTravel / .035, 'left wheel signed travel');
    near(p.wheels[1].wheel.rotation.z, -s.now.rightTravel / .035, 'right wheel signed travel');
    assert.equal(p.furniture.visible, room === 1); assert.equal(p.stairs.visible, room === 2);
    assert.equal(p.beacon.visible, s.beacon && Boolean(dockPower));
    assert.equal(p.airDots.some(dot => dot.visible), s.cleaning);
    assert.equal(p.chargeDots.some(dot => dot.visible), s.charging);
    const before = publicState(); for (const action of room === 1 && strategy === 0 && session === 1 ? model.actions : []) {action.run(); assert.equal(publicState(), before, 'inspection must preserve every physical state');}
    let painted = 0, wrong = 0;
    const first = mission.plan.first, floor = mission.plan.reach.floor;
    for (let i = 0; i < first.length; i++) {
      const visited = first[i] <= s.cleanTime + 1e-9, shade = visited ? SHADES.passed : floor[i] ? SHADES.unvisited : SHADES.excluded;
      if (visited) painted++;
      if (shade.some((value, channel) => p.data[i * 4 + channel] !== value)) wrong++;
    }
    assert.equal(wrong, 0, 'every painted floor cell uses same state as coverage'); near(painted / s.floorCount, s.coverage, 'painted coverage', 0);
    t.add(15);
  }
}
const assertions = [
  s => s.clock === 0 && s.contacts && s.battery === 1,
  s => s.now.leftWheel < 0 && s.now.rightWheel > 0,
  s => s.cleaning,
  s => s.event?.type === 'obstacle' && s.now.leftWheel < 0 && s.now.doing === 'backing off',
  s => s.event?.type === 'cliff' && s.now.cliffs === 1 && s.now.leftWheel < 0 && s.now.doing === 'backing off',
  s => Math.round(s.coverage * 100) === 85,
  s => Math.round(s.coverage * 100) === 57,
  s => Math.round(s.coverage * 100) === 42,
  s => s.now.rightWheel > s.now.leftWheel && s.now.leftWheel > 0,
  s => !s.cleaning && s.phase === 'returning',
  s => s.reason === 'battery reserve reached' && s.battery < .15,
  s => s.phase === 'docking' && !s.contacts && s.now.leftWheel < 0,
  s => s.charging && s.contacts && s.storedEnergy > 0,
  s => s.phase === 'dock unpowered' && !s.charging && s.contacts && s.battery < 1,
  s => s.phase === 'ready' && s.battery === 1 && s.contacts,
];
assert.equal(assertions.length, lesson.tryIt.length);
for (let i = 0; i < lesson.tryIt.length; i++) {
  const preset = lesson.tryIt[i]; assert.deepEqual(preset.values, preset.initialState.settings);
  model.reset(preset.initialState); t.ok(assertions[i](model.getState()), `${preset.title}: exact named starting state`);
  const before = publicState(); model.animate(0); assert.equal(publicState(), before, 'first animation frame preserves preset');
  model.advance(1); t.ok(model.getState().clock >= preset.initialState.time || model.playback.complete(), 'preset can advance or is complete');
  checkFinite(model.root, t);
}
// Frame-rate invariance across cleaning, return and charging boundaries.
for (const settings of [{}, {charge: 0}, {dockPower: 0}]) {
  model.reset({settings}); model.advance(23.75); const one = publicState();
  model.reset({settings}); for (let i = 0; i < 95; i++) model.advance(.25);
  assert.equal(publicState(), one, 'partitioning playback intervals preserves exact state');
  model.advance(1e5); t.ok(model.playback.complete(), 'completion detected');
  const replay = model.replayState(); model.reset(replay); near(model.getState().clock, 0, 'completion replay starts at zero'); assert.deepEqual(model.getState().values, replay.settings);
  model.advance(3); t.ok(model.getState().clock > 0, 'replay advances');
}
// Contacts are geometrically aligned at the dock, with surfaces touching.
model.reset({time: 900}); model.root.updateMatrixWorld(true);
const contactMeshes = p.contacts.children, robotPads = contactMeshes.map(mesh => new THREE.Box3().setFromObject(mesh)).sort((a, b) => a.min.x - b.min.x);
const dockPads = p.dockContacts.map(mesh => new THREE.Box3().setFromObject(mesh)).sort((a, b) => a.min.x - b.min.x);
for (let i = 0; i < 2; i++) {
  const a = robotPads[i], b = dockPads[i]; near(a.min.y, b.max.y, 'contact faces touch', 2e-8);
  near(a.getCenter(new THREE.Vector3()).x, b.getCenter(new THREE.Vector3()).x, 'contact x alignment'); near(a.getCenter(new THREE.Vector3()).z, b.getCenter(new THREE.Vector3()).z, 'contact z alignment');
}
const plateBox = new THREE.Box3().setFromObject(p.dockPlate), towerBox = new THREE.Box3().setFromObject(p.dockTower);
for (const mechanism of [p.wheels[0].wheel, p.wheels[1].wheel, p.caster, p.rollerPart]) {
  t.ok(!plateBox.intersectsBox(new THREE.Box3().setFromObject(mechanism)), 'dock plate stays clear of wheels and roller');
}
t.ok(!towerBox.intersectsBox(new THREE.Box3().setFromObject(p.bumper)), 'dock tower leaves bumper clearance');
const beaconPosition = p.dockLight.getWorldPosition(new THREE.Vector3());
t.ok(beaconPosition.y - .009 * p.SCALE > new THREE.Box3().setFromObject(p.lid.children[0]).max.y, 'dock beam clears the cover shell; the front button lies beyond the receiver');
// Separate layouts must preserve parts and their named mechanism groups.
for (const [width, height] of [[760, 620], [360, 620]]) {
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .01, 100); camera.position.set(3, 4, -4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const state = publicState(), explosion = createPartExplosion(model, camera, width / height, {width, height}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c => c.id)), new Set(['structure', 'drive', 'cleaner', 'power', 'dock']));
  t.ok(!explosion.items.some(item => ['floor', 'furniture', 'stairs', 'charts', 'trail', 'return-route'].includes(item.id)), 'room and chart stay out of robot inventory');
  for (let i = 0; i < explosion.items.length; i++) for (let j = i + 1; j < explosion.items.length; j++) {
    const a = explosion.items[i], b = explosion.items[j], inverse = camera.quaternion.clone().invert();
    const projected = unit => {const bounds = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) bounds.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return bounds;};
    const aa = projected(a), bb = projected(b); t.ok(aa.max.x <= bb.min.x || bb.max.x <= aa.min.x || aa.max.y <= bb.min.y || bb.max.y <= aa.min.y, 'separated projected parts do not overlap');
  }
  explosion.dispose(); assert.equal(publicState(), state, 'separation leaves physical state untouched');
}
const resources = checkDisposal(model, t);
console.log(`PASS robot vacuum model: ${t.count} checks; ${poses} poses; ${lesson.tryIt.length} exact presets; 7 state-preserving inspections; 2 separated layouts; ${resources} resources.`);

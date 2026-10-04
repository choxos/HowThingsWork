import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVideoGamesConsoleModel, CONSOLE_DEFAULTS as D, CONSOLE_DOMAINS, CONSOLE_GEOMETRY} from './video-games-console-model.js';
import {createGamesControllerModel} from './games-controller-model.js';
import {videoGamesConsoleLesson as lesson} from './video-games-console-lesson.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';

const t = tally(), model = createVideoGamesConsoleModel(), parent = createGamesControllerModel(), q = model.consoleTopology, p = model.topology, mm = q.mm;
const near = (a, b, message, tolerance = 1e-9) => t.near(a, b, tolerance, message), state = () => JSON.stringify(model.getState());
const bounds = object => new THREE.Box3().setFromObject(object);
assert.deepEqual(model.controls.map(control => control.key), ['debounce', 'polling', 'display']);
assert.equal(model.parts.length, 28); assert.equal(new Set(model.parts.map(part => part.id)).size, 28);
assert(model.parts.every(part => !part.parentId || model.parts.some(candidate => candidate.id === part.parentId)));
assert(Object.keys(model.partViewDirections).every(id => model.parts.some(part => part.id === id)));
assert.equal(model.covers.length, 1); assert.equal(model.covers[0], q.lid);
assert.equal(model.initialPart, 'console-experiment'); assert(model.initialCutaway && model.initialIsolated);

// Separate discrete event simulation. Explicit contact intervals, agreeing scan
// counts and poll/frame grids do not call the production timing helpers.
function reference(values) {
  const pollPeriod = 1 / [125, 250, 1000][values.polling], updates = [];
  let stable = false, candidate = false, count = 0;
  for (let k = -30; k <= 400; k++) {
    const time = .0003 + k * .001, tau = time - .04;
    const contact = (tau >= 0 && tau < .0004) || (tau >= .0007 && tau < .0012) || (tau >= .0016 && tau < .0019) || tau >= .0026;
    if (contact === candidate) count++; else {candidate = contact; count = 1;}
    if (count >= values.debounce && stable !== candidate) {stable = candidate; updates.push({time, pressed: stable});}
  }
  const observed = []; let reported = false;
  for (let k = -30; k * pollPeriod <= .4; k++) {
    const time = .0005 + k * pollPeriod, current = updates.filter(update => update.time <= time + 1e-12).at(-1)?.pressed || false;
    if (current !== reported) {reported = current; observed.push({time, pressed: current, frame: .005 + Math.ceil((time - .005) * 60 - 1e-9) / 60});}
  }
  const first = observed.find(event => event.pressed);
  return {updates, observed, stages: [.04, updates.find(update => update.pressed).time, first.time, first.frame, first.frame + 1 / 60, first.frame + 1 / 60 + values.display / 1000]};
}

const expected = [
  s => s.clock === -.02 && s.now.onScreen === 0,
  s => s.clock === 0,
  s => s.clock === 0,
  s => s.clock === 0,
  s => s.now.firmware && !s.now.console && s.pipeline.reached === 2,
  s => s.now.console && s.now.frame.presses === 0 && s.pipeline.reached === 3,
  s => s.now.frame.presses === 1 && s.now.onScreen === 0 && s.pipeline.reached === 4,
  s => s.now.frame.presses === 1 && s.now.onScreen === 0 && Math.abs(s.pipeline.renderProgress - .5) < 1e-10,
  s => s.pipeline.reached === 5 && s.now.onScreen === 0,
  s => s.now.onScreen === 1 && s.pipeline.reached === 6,
  s => Math.abs(s.press.latency - .0616666666666667) < 1e-10,
  s => s.rate === 1000 && Math.abs(s.press.latency - .0616666666666667) < 1e-10,
  s => s.values.debounce === 8 && Math.abs(s.press.latency - .0783333333333333) < 1e-10,
  s => s.now.onScreen === 2 && s.values.debounce === 1,
  s => s.now.frame.presses === 1 && s.now.onScreen === 0 && s.values.display === 80,
  s => s.now.onScreen === 1 && Math.abs(s.press.latency - .0316666666666667) < 1e-10,
  s => s.clock > .1,
  s => model.playback.complete() && s.now.onScreen === 1,
];
assert.equal(expected.length, lesson.tryIt.length);
for (const [i, experiment] of lesson.tryIt.entries()) {
  model.reset({time: .32, settings: {debounce: 1, polling: 2, display: 80}});
  model.reset(experiment.initialState); model.update(experiment.values);
  const s = model.getState(); assert.deepEqual(s.values, experiment.values);
  assert.deepEqual(experiment.initialState.settings, experiment.values);
  t.ok(expected[i](s), experiment.title + ' starts with its promised result');
  near(s.clock, experiment.initialState.time - .02, 'exact experiment time');
  assert(model.parts.some(part => part.id === experiment.part)); checkFinite(model.root, t);
}
for (const action of model.actions) {model.reset({settings: {debounce: 1, polling: 2, display: 80}, time: .14}); const before = state(); action.run(); assert.equal(state(), before, action.label + ' preserves state'); assert(model.parts.some(part => part.id === action.part));}
let controlCases = 0;
for (const [key, [min, max, step]] of Object.entries(CONSOLE_DOMAINS)) for (let value = min; value <= max; value += step) {
  const settings = {...D, [key]: value}; model.reset({settings, time: .32}); assert(model.playback.complete());
  model.reset(model.replayState()); assert.deepEqual(model.getState().values, settings); near(model.getState().clock, -.02, 'replay starts ready');
  model.playback.step(); near(model.getState().clock, -.015, 'step advances 5 ms');
  const before = state(); model.update({[key]: value}); assert.equal(state(), before, 'same value preserves state');
  model.update({[key]: value === min ? min + step : min}); near(model.getState().clock, -.02, 'changed setting restarts');
  for (const saved of Object.keys(D).filter(other => other !== key)) assert.equal(model.getState().values[saved], settings[saved], 'other settings persist');
  controlCases++;
}
model.reset({time: .12}); const saved = state(); model.update({release: 2, gate: 1, bits: 2, deadzone: 0, rumble: 1}); assert.equal(state(), saved, 'unoffered controls are ignored');
model.advance(.6); const whole = model.getState().clock; model.reset({time: .12}); for (let i = 0; i < 6; i++) model.advance(.1); near(model.getState().clock, whole, 'frame partition preserves clock');

let combinations = 0, eventSamples = 0;
for (let debounce = 1; debounce <= 8; debounce++) for (let polling = 0; polling <= 2; polling++) for (let display = 0; display <= 80; display += 10) {
  const values = {debounce, polling, display}, ref = reference(values);
  for (const clock of [-.02, 0, .3, ...ref.stages.flatMap(time => [time - 1e-7, time, time + 1e-7])]) {
    model.reset({settings: values, time: clock + .02}); parent.reset({settings: {...values, rumble: 0}, time: clock + .02});
    const s = model.getState(), baseline = parent.getState();
    assert.deepEqual(s.values, values); near(s.clock, clock, 'exact sampled clock');
    assert.deepEqual(s.now, baseline.now, 'focused console preserves accepted input and frame model');
    for (const [i, stage] of s.pipeline.stages.entries()) near(stage.time, ref.stages[i], 'independent ' + stage.name + ' timing');
    near(s.press.latency, ref.stages[5] - .04, 'independent first response');
    const shown = ref.observed.filter(event => event.pressed && event.frame + 1 / 60 + display / 1000 <= clock + 1e-12).length;
    assert.equal(s.now.onScreen, shown, 'independent count of visible input edges');
    assert.equal(s.pipeline.reached, ref.stages.filter(time => time <= clock + 1e-12).length, 'milestones at exact boundaries');
    for (const [i, mark] of q.milestones.entries()) {assert.equal(mark.indicator.material.color.getHex(), i < s.pipeline.reached ? 0x537b43 : 0xb9bdad); assert.equal(mark.time.userData.labelText, ((ref.stages[i] - .04) * 1000).toFixed(1) + ' ms');}
    for (const [i, frame] of [s.now.frame, s.now.shown].entries()) {const snap = q.snapshots[i]; assert.equal(snap.rings.filter(ring => ring.visible).length, frame?.presses || 0); near(snap.dot.position.x, snap.x - .4 + (frame?.position[0] || 0) * 2.5, 'snapshot X follows its own frame');}
    near(q.rotor.rotation.y, (clock + .02) * 30 * 2 * Math.PI, 'assigned fan motion');
    assert(s.readings.every(reading => !/(?:NaN|Infinity|undefined)/.test(reading.value))); assert.equal(s.readings.length, 8);
    for (const key of ['lever', 'cap', 'pill', 'character']) {model.root.updateMatrixWorld(true); parent.root.updateMatrixWorld(true); for (let i = 0; i < 16; i++) near(p[key].matrix.elements[i], parent.topology[key].matrix.elements[i], 'accepted local geometry ' + key);}
    eventSamples++;
  }
  combinations++;
}

model.reset(); model.root.updateMatrixWorld(true);
const board = bounds(q.board), base = bounds(q.base), contact = (a, b, message) => near(a, b, message, 1e-7);
contact(base.max.y, .04, 'base top');
for (const foot of q.feet) contact(bounds(foot).max.y, base.min.y, 'feet meet base');
for (const support of q.supports) {contact(bounds(support).min.y, base.max.y, 'standoffs meet base'); contact(bounds(support).max.y, board.min.y, 'standoffs meet board');}
for (const component of [q.chip, ...q.memory, q.ioChip, q.videoChip, q.regulator, ...q.storageSupports]) contact(bounds(component).min.y, board.max.y, 'package rests on board');
for (const support of q.storageSupports) contact(bounds(support).max.y, bounds(q.storageBoard).min.y, 'storage standoff meets storage board');
for (const chip of q.storageChips) contact(bounds(chip).min.y, bounds(q.storageBoard).max.y, 'storage chip rests on its board');
for (const face of [q.cpuFace, q.gpuFace]) {contact(bounds(face).min.y, bounds(q.chip).max.y, 'logical regions meet processor package'); contact(bounds(face).max.y, bounds(q.sinkBase).min.y, 'heat sink meets processor regions');}
for (const fin of q.fins) contact(bounds(fin).min.y, bounds(q.sinkBase).max.y, 'fins meet heat sink base');
for (const support of q.fanSupports) {contact(bounds(support).min.y, bounds(q.sinkBase).max.y, 'fan supports meet heat sink'); contact(bounds(support).max.y, bounds(q.fanFrame[0]).min.y, 'fan supports meet frame');}
for (const port of [q.usb, q.videoPort, q.powerPort]) for (const leg of port.legs) {
  const b = bounds(leg); contact(b.min.y, board.max.y, 'connector leg meets board'); contact(b.max.y, (port.center[1] - port.height / 2) * mm, 'connector leg meets housing');
  assert(b.min.x >= board.min.x - 1e-7 && b.max.x <= board.max.x + 1e-7 && b.min.z >= board.min.z - 1e-7 && b.max.z <= board.max.z + 1e-7);
}
const ray = new THREE.Raycaster();
for (const [origin, direction] of [[[-90,24,120],[0,0,-1]],[[70,24,-120],[0,0,1]],[[110,24,-120],[0,0,1]],[[-111,44,-120],[0,0,1]]]) {ray.set(new THREE.Vector3(...origin).multiplyScalar(mm), new THREE.Vector3(...direction)); ray.far = .3; assert.equal(ray.intersectObjects(q.walls, false).length, 0, 'port and intake opening is not blocked');}
ray.set(new THREE.Vector3(-46,100,-10).multiplyScalar(mm),new THREE.Vector3(0,-1,0));ray.far=.5;assert.equal(ray.intersectObjects(q.lid.children,false).length,0,'lid grille has real openings');
for (const connection of q.connections) for (const [i, mesh] of connection.meshes.entries()) {
  const h = mesh.geometry.parameters.height / 2, a = new THREE.Vector3(0,-h,0).applyMatrix4(mesh.matrixWorld), b = new THREE.Vector3(0,h,0).applyMatrix4(mesh.matrixWorld);
  near(a.distanceTo(new THREE.Vector3(...connection.points[i]).multiplyScalar(mm)),0,'drawn connection starts at its node',1e-8);near(b.distanceTo(new THREE.Vector3(...connection.points[i+1]).multiplyScalar(mm)),0,'drawn connection ends at its node',1e-8);
}
near(p.display.geometry.parameters.width * p.screen.scale.x / mm, 531, 'same-scale 24 inch monitor width');
const blades = q.rotor.children.filter(child => child.isGroup).flatMap(group => group.children), inverse = q.rotor.matrixWorld.clone().invert();
let bladeRadius = 0, bladeBottom = Infinity;
for (const blade of blades) for (let i=0;i<blade.geometry.attributes.position.count;i++) {const point=new THREE.Vector3().fromBufferAttribute(blade.geometry.attributes.position,i).applyMatrix4(blade.matrixWorld).applyMatrix4(inverse).divideScalar(mm);bladeRadius=Math.max(bladeRadius,Math.hypot(point.x,point.z));bladeBottom=Math.min(bladeBottom,point.y+37.1);}
t.ok(bladeRadius < 23 * Math.cos(Math.PI/64), 'all fan angles clear the polygonal shroud and square frame');
t.ok(bladeBottom > 34.7+.45, 'all fan angles clear lower spokes');
t.ok(bladeRadius+.45 < 23.5, 'outer spoke rise stays beyond rotating blade sweep');
near(q.fanBearing.geometry.parameters.radiusTop/mm,2,'fixed bearing radius');
t.ok(2.1*Math.cos(Math.PI/96)>2,'hollow hub clears bearing');
t.ok(bounds(q.fanFrame[0]).max.y < .58,'cooler clears lid');
for (const id of ['bounce','latency','console-pipeline','console-frame-data']) assert.equal(model.parts.find(part=>part.id===id).object.userData.inspectionOnly,id);
for (const [width,height] of [[760,620],[360,620]]) {
  const camera=new THREE.OrthographicCamera(-4,4,4,-4,.01,100);camera.position.set(.7,1.8,3);camera.lookAt(0,.4,0);camera.updateMatrixWorld();
  const before=state(),explosion=createPartExplosion(model,camera,width/height,{width,height});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(category=>category.id)),new Set(['console-enclosure','console-logic','console-services']));
  assert(!explosion.items.some(item=>['machine','screen','bounce','latency','console-links','console-pipeline','console-frame-data'].includes(item.id)));
  const inverse=camera.quaternion.clone().invert(),rectangle=item=>{const box=new THREE.Box3();for(const x of [item.bounds.min.x,item.bounds.max.x])for(const y of [item.bounds.min.y,item.bounds.max.y])for(const z of [item.bounds.min.z,item.bounds.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).add(item.group.position).applyQuaternion(inverse));return box;};
  for(let i=0;i<explosion.items.length;i++)for(let j=i+1;j<explosion.items.length;j++){const a=rectangle(explosion.items[i]),b=rectangle(explosion.items[j]);t.ok(a.max.x<=b.min.x||b.max.x<=a.min.x||a.max.y<=b.min.y||b.max.y<=a.min.y,'separated console parts do not overlap');}
  explosion.dispose();assert.equal(state(),before,'separation preserves state');
}
checkFinite(model.root,t);const resources=checkDisposal(model,t);parent.dispose();
console.log(`PASS video games console: ${t.count} checks, ${combinations} settings, ${eventSamples} boundary samples, ${lesson.tryIt.length} exact presets, ${controlCases} control values, ${model.actions.length} preserving actions, ${model.parts.length} parts, fan radial clearance ${(23*Math.cos(Math.PI/64)-bladeRadius).toFixed(3)} mm, ${resources} resources released once.`);

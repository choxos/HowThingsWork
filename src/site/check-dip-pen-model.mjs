import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DIP_WRITE_DOMAINS, dipWritingPlan, dipWritingAt, sampleDipWriting, dipSlotVolume, dipInkLength} from './dip-pen-physics.js';
import {createDipPenModel, MM} from './dip-pen-model.js';
import {dipPenLesson as lesson} from './pens-lessons.js';
import {tally, checkRefusals, checkDisposal, checkFinite} from './model-check-kit.mjs';

const t = tally(), model = createDipPenModel(), B = model.topology;
let poses = 0, integrals = 0;
const reset = (settings, time) => {model.reset({settings, time}); model.root.updateMatrixWorld(true); return model.getState();};
// Signed tetrahedra measure the rendered solid, independently of slot formulas.
function meshVolume(mesh) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const a = geometry.attributes.position, p = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < a.count; i += 3) {
    p.fromBufferAttribute(a, i); q.fromBufferAttribute(a, i + 1); r.fromBufferAttribute(a, i + 2);
    volume += p.dot(q.cross(r)) / 6;
  }
  if (geometry !== mesh.geometry) geometry.dispose();
  return Math.abs(volume * mesh.scale.x * mesh.scale.y * mesh.scale.z) / MM ** 3;
}
const times = [0, .001, .25, .5, .75, 1, 1.25, 1.5, 1.75, 2, 2.05, 2.1, 2.2, 2.3, 3, 4, 5.2, 6.2, 100];
for (let p = 0; p <= 10; p++) for (const load of [0, 1, 2]) {
  const press = p / 10, values = {press, load}, volume = [0, .020, .045][load], width = .1 + .1 * press;
  for (const time of times) {
    const s = reset(values, time), n = s.now, elapsed = Math.min(time, 6.2);
    const travel = Math.max(0, Math.min(40, (elapsed - 2.2) * 10));
    const written = Math.min(travel, volume / (width * .01));
    t.near(n.travel, travel, 2e-12, '10 mm/s motion after preparation');
    t.near(n.loaded, volume * Math.min(1, elapsed / .5), 1e-12, 'assigned loading schedule');
    t.near(n.inked, written, 1e-12, 'finite load limits line length');
    t.near(n.deposited, written * width * .01, 1e-12, 'wet film volume');
    t.near(n.remaining + n.deposited, n.loaded, 1e-12, 'conserved load throughout experiment');
    t.ok(n.force >= 0 && n.force <= press && n.remaining >= 0, 'bounded force and volume');
    t.ok(B.line.visible === (written > 0), 'no premature or dry ink');
    t.ok(B.slotInk.visible === (n.remaining > 1e-12), 'empty slit is visibly empty');
    if (B.slotInk.visible) t.near(meshVolume(B.slotInk), n.remaining, 2e-8, 'rendered tapered volume equals retained ink');
    if (B.line.visible) t.near(meshVolume(B.line), n.deposited, 2e-12, 'rendered deposited volume balances the slit');
    // Midpoint integration uses the measured endpoints of the actual slit.
    let integral = 0;
    for (let i = 0; i < 100; i++) {
      const y = (i + .5) * n.inkLength / 100;
      integral += (.02 + .1 * n.force * (1 - y / 9)) * .25 * n.inkLength / 100;
    }
    t.near(integral, n.remaining, 1e-12, 'integrated varying cross section holds the conserved volume'); integrals++;
    const tip = new THREE.Vector3(0, 0, .125 * MM).applyMatrix4(B.carriage.matrixWorld);
    t.near(tip.x / MM, n.x, 1e-10, 'physical tip follows transfer');
    t.near(tip.y / MM, n.height, 1e-10, 'physical lowest edge follows immersion and contact');
    t.near(tip.z / MM, travel, 1e-10, 'physical tip meets current stroke endpoint');
    if (n.touching) t.near(tip.y, 0, 1e-12, 'steel contacts paper without sinking');
    if (load === 0 && time < 1.5) t.near(n.height, 25, 1e-12, 'dry experiment never enters ink');
    const bounds = model.frameBoundsForPart('system').expandByScalar(5e-8);
    for (const mesh of [B.plate, B.handle, B.socket, B.sheet, B.wellBack, B.wellFront]) t.ok(bounds.containsBox(new THREE.Box3().setFromObject(mesh)), 'reserved bounds contain physical apparatus throughout motion');
    t.ok(s.readings.every(r => !/NaN|undefined|Infinity/.test(r.value + (r.hint || ''))), 'finite readable measurements');
    poses++;
  }
  const snapshot = JSON.stringify(model.getState());
  for (const action of model.actions) {action.run(); t.ok(JSON.stringify(model.getState()) === snapshot, 'inspection does not change experiment');}
  model.reset(model.replayState()); assert.deepEqual(model.getState().values, values); t.near(model.getState().clock, 0, 0, 'replay preserves settings and resets time');
}
// Independently integrate the moving film while consuming a reservoir.
for (const press of [0, .5, 1]) for (const load of [0, 1, 2]) {
  const plan = dipWritingPlan({press, load}), dx = .001, section = (.1 + .1 * press) * .01;
  let ink = [0, .020, .045][load], written = 0;
  for (let i = 0; i < 40000; i++) {const step = Math.min(dx, Math.max(0, ink) / section); written += step; ink -= step * section;}
  const n = dipWritingAt(plan, 6.2);
  t.near(n.inked, written, 1e-8, 'integrated finite reservoir gives stroke length');
  t.near(n.remaining, ink, 1e-12, 'integrated deposited film leaves matching supply'); integrals++;
}
const expected = [
  {inked: 40, deposited: .040, remaining: .005}, {loaded: .0225, deposited: 0}, {height: 25, remaining: .045},
  {force: .5, remaining: .045}, {inked: 30}, {inked: 22.5}, {inked: 20}, {inked: 10},
  {inked: 0, travel: 40}, {travel: 8, deposited: .016, remaining: .029}, {travel: 30, remaining: 0}, {travel: 10, remaining: .035},
];
assert.equal(lesson.tryIt.length, expected.length);
for (const [i, trial] of lesson.tryIt.entries()) {
  model.reset(trial.initialState); const s = model.getState();
  for (const [key, value] of Object.entries(expected[i])) t.near(s.now[key], value, 1e-10, `${trial.title}: ${key}`);
  assert.deepEqual(s.values, trial.values); t.ok(model.parts.some(p => p.id === trial.part), 'trial targets existing part');
}
for (const force of [0, .001, .5, 1]) for (const length of [0, .00001, 1, 5, 9]) t.near(dipInkLength(force, dipSlotVolume(force, length)), length, 1e-11, 'stable inverse over tiny and full loads');
reset({}, 0); for (let i = 0; i < 62; i++) model.playback.step(); t.ok(model.playback.complete(), '62 steps complete exactly');
const before = JSON.stringify(model.getState()); for (const dt of [0, -1, NaN, Infinity]) model.advance(dt); t.ok(before === JSON.stringify(model.getState()), 'invalid time increments preserve state');
checkRefusals(sampleDipWriting, DIP_WRITE_DOMAINS, t); checkFinite(model.root, t); model.dispose();
const resources = checkDisposal(createDipPenModel(), t);
console.log(JSON.stringify({passed: true, checks: t.count, poses, integrals, trials: lesson.tryIt.length, resources}));

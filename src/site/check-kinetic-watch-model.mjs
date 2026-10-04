import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createKineticWatchModel} from './kinetic-watch-model.js';
import {kineticWatchLesson as lesson} from './kinetic-watch-lesson.js';
import {KINETIC_DEFAULTS as D, KINETIC_WATCH as K, KINETIC_MODES} from './kinetic-watch-physics.js';
import {KINETIC_GEARS as GEARS, KINETIC_MESH_PAIRS as PAIRS, kineticTrainAngles} from './kinetic-watch-train.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), model = createKineticWatchModel(), g = model.topology;
const equal = (a, b, label) => {assert.deepEqual(a, b, label); t.add();};
const poleAxis = rotor => {
  const centers = rotor.children.slice(0, 2).map(mesh => {mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox.getCenter(new THREE.Vector3());});
  return centers[0].sub(centers[1]).normalize();
};
const generatingAxis = poleAxis(g.magnet);
for (const rotor of [g.magnet, g.motorRotor]) t.near(poleAxis(rotor).distanceTo(new THREE.Vector3(0, 1, 0)), 0, 1e-12, 'Initial magnetic poles align with stationary iron poles');
const expected = [
  [1.2, 0, true], [.02638365, 0, false], [.61424782, 1, true], [1.19998121, 10, true],
  [null, 10, true], [1.2, 0, true], [null, 0, true], [1.01001751, 59, true],
  [1.51511682, 86400, true], [2.03789818, 1814400, true], [.49200235, 904838, false],
  [.49855476, 144445, false], [2.2, 600, true], [null, 0, true], [2.03790018, 1814360, true], [null, 1, true],
];
let presets = 0, poses = 0;
for (const history of [{...D, mode: 2, voltage: 0, motion: 1, minutes: .5}, {...D, mode: 2, voltage: 2.2, motion: 3, temperature: -10}]) for (const [i, preset] of lesson.tryIt.entries()) {
  model.reset({time: 3 * K.day, mode: 2, settings: history}); model.update(history);
  model.reset(preset.initialState); model.animate(0); model.update(model.defaults); model.update(preset.values); const s = model.getState();
  equal(s.values, preset.values); equal(Object.keys(preset.values).sort(), Object.keys(D).sort());
  equal(s.time, preset.initialState.time); equal(s.ticks, expected[i][1], preset.title); equal(s.running, expected[i][2], preset.title);
  if (expected[i][0] !== null) t.near(s.voltage, expected[i][0], .00000002, preset.title);
  t.ok(model.parts.some(p => p.id === preset.part)); t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(s.readings)));
  const angles = kineticTrainAngles(s);
  const angle = g.magnet.rotation.z, projectionDerivative = generatingAxis.x * Math.cos(angle) - generatingAxis.y * Math.sin(angle);
  t.near(-K.fluxLinkage * s.motion.magnetSpeed * projectionDerivative, s.motion.emf, 1e-10, 'Displayed pole direction gives the same Faraday emf as the physical model');
  for (const [name, arbor] of Object.entries(g.arbors)) t.near(arbor.rotation.z, angles[name], 1e-12);
  for (const [name, hand] of Object.entries(g.hands)) t.near(hand.rotation.z, angles[name] + (name === 'hour' ? 1.5 * Math.PI : 0), 1e-12);
  model.root.updateMatrixWorld(true);
  for (const [name, mesh] of Object.entries(g.gears)) {
    const position = mesh.getWorldPosition(new THREE.Vector3()).divideScalar(g.MM), spec = GEARS[name];
    t.near(position.x, spec.position[0], 1e-10); t.near(position.y, spec.position[1], 1e-10); t.near(position.z, spec.z - .08, 1e-10);
    t.near(mesh.rotation.z, spec.phase, 0); equal(mesh.parent, g.arbors[spec.arbor]);
    const bore = mesh.geometry.parameters.shapes.holes[0].getPoints(48);
    const radius = name === 'weight' ? .3 : spec.arbor === 'generator' ? .08 : spec.arbor === 'seconds' ? .07 : spec.arbor === 'minute' ? .15 : spec.arbor === 'hour' ? .24 : .1;
    t.near(Math.hypot(bore[0].x, bore[0].y), radius, 1e-12, `${name} bore meets its shaft or sleeve`);
  }
  checkFinite(model.root, t); poses++; presets++;
}
for (const part of lesson.parts) t.ok(model.parts.some(p => p.name === part.name), part.name);
for (const time of [0, .99, 1, 1.01, 1.02, 2, 9.999, 10]) {
  model.reset({time, settings: {...D, motion: 0}});
  const pulses = Math.floor(time);
  t.near(g.motorRotor.rotation.z, pulses * Math.PI, 1e-12, 'Motor completes its ideal half-turn at the pulse checkpoint');
  t.near(g.hands.seconds.rotation.z, pulses * Math.PI / 30, 1e-12, 'Physical seconds hand matches the completed-pulse readout');
  equal(model.getState().stroke, model.getState().ticks);
}
for (const values of [{...D, mode: 2, motion: 0, voltage: 2.2}, {...D, mode: 2, motion: 1, minutes: .5, voltage: .6}, {...D, mode: 2, motion: 3, minutes: 20, voltage: 2.2}]) {
  model.reset({time: 21 * K.day, mode: 2, settings: values});
  const s = model.getState(), geometry = g.reserveLine.geometry, positions = geometry.attributes.position;
  for (const event of s.events) {
    const x = (24 + event.time / (21 * K.day) * 45) * g.MM;
    const y = (-14 + event.voltage / 2.2 * 28) * g.MM;
    let distance = Infinity;
    for (let i = 0; i < geometry.drawRange.count; i++) distance = Math.min(distance, Math.hypot(positions.getX(i) - x, positions.getY(i) - y));
    t.near(distance, 0, 2e-7, 'Reserve curve includes the exact stop, restart and charge-limit event');
  }
}
model.root.updateMatrixWorld(true);
equal(g.wires.length, 8); equal(g.terminals.generator, g.generatingWinding.ends); equal(g.terminals.motor, g.motorWinding.ends);
for (const wire of g.wires) {
  equal(wire.meshes.length, wire.points.length - 1);
  wire.meshes.forEach((mesh, i) => {
    const geometry = mesh.geometry, half = geometry.parameters.height / 2;
    const ends = [new THREE.Vector3(0, -half, 0).applyMatrix4(mesh.matrixWorld), new THREE.Vector3(0, half, 0).applyMatrix4(mesh.matrixWorld)];
    for (const [j, end] of ends.entries()) t.near(end.distanceTo(new THREE.Vector3(...wire.points[i + j].map(v => v * g.MM))), 0, 1e-12, 'Electrical wire endpoints are connected');
  });
}
for (const guide of g.guides) {equal(guide.userData.inspectionOnly, model.parts.find(p => p.object === guide).id); equal(guide.userData.explosionExcluded, true); t.ok(model.thumbnailOmit.includes(guide));}
const whole = model.frameBoundsForPart('system'); t.ok(whole.max.x < 20 * g.MM && whole.min.x > -20 * g.MM, 'Hidden explanatory panels do not enlarge the physical watch frame');

for (const mode of [0, 1, 2]) {
  model.reset(); model.update({...D, mode, motion: 0}); model.playback.step(); t.near(model.getState().time, KINETIC_MODES[mode].step, 1e-12);
  model.advance(1000000); t.ok(model.playback.complete());
  const held = JSON.stringify(model.getState()); model.advance(1); equal(JSON.stringify(model.getState()), held);
  const values = model.getState().values; model.reset(model.replayState()); model.update(values); equal(model.getState().time, 0); t.ok(!model.playback.complete());
}
for (const action of model.actions) {model.reset(); equal(action.run(), model.getState().readings); t.ok(model.parts.some(p => p.id === action.part));}
const materials = new Set(); model.root.traverse(o => {if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);});
for (let i = 0; i < 30; i++) model.advance(.013);
model.root.traverse(o => {if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) t.ok(materials.has(m), 'Animation reuses owned materials');});
const resources = checkDisposal(model, t);
let layouts = 0;
for (const aspect of [1, 1.24]) for (const checkpoint of [0, .125]) {
  const m = createKineticWatchModel(); m.reset({time: checkpoint}); const before = JSON.stringify(m.getState());
  const {camera} = frameModel(m, aspect), explosion = createPartExplosion(m, camera, aspect); explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const box = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return box;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Exploded groups do not overlap');
  t.ok(boxes.length >= 8); explosion.update(0); explosion.dispose(); equal(JSON.stringify(m.getState()), before); m.dispose(); layouts++;
}
console.log(JSON.stringify({passed: true, checks: t.count, presets, poses, actions: model.actions.length, layouts, resources, pairs: PAIRS.length}));

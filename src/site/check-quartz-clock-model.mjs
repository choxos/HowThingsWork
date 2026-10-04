import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createQuartzClockModel} from './quartz-clock-model.js';
import {quartzClockLesson as lesson} from './quartz-clock-lesson.js';
import {CLOCK_DEFAULTS as D, quartzClockExperiment} from './quartz-clock-physics.js';
import {CLOCK_GEARS as GEARS, CLOCK_MESH_PAIRS as PAIRS} from './quartz-clock-train.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), model = createQuartzClockModel(), g = model.topology;
const equal = (a, b, label) => {assert.deepEqual(a, b, label); t.add();};
const expected = [[0, 0], [10, 0], [0, -10], [0, 0], [0, 0], [1, 0], [2, 0], [1, 0], [2592000, 0], [2591943, -56.7], [2591943, -56.7], [2592035, 35.239473056], [2591951, -48.260843671], [2591978, -21.461297807]];
let presets = 0, poses = 0;
for (const history of [{...D, mode: 2, battery: 0, temperature: -10, trimmer: 30}, {...D, mode: 1, temperature: 50, trimmer: 1.5}]) for (const [i, preset] of lesson.tryIt.entries()) {
  model.reset({time: 3, mode: history.mode, settings: history}); model.update(history);
  model.reset(preset.initialState); model.animate(0); model.update(model.defaults); model.update(preset.values);
  const s = model.getState(); equal(s.values, preset.values); equal(Object.keys(preset.values).sort(), Object.keys(D).sort()); equal(s.time, preset.initialState.time);
  equal(s.ticks, expected[i][0], preset.title); t.near(s.elapsedError, expected[i][1], 1e-8, preset.title);
  const independent = {motor: s.ticks * Math.PI, first: -s.ticks * Math.PI / 6, seconds: s.ticks * Math.PI / 30, third: -s.ticks * Math.PI / 180, minute: s.ticks * Math.PI / 1800, motion: -s.ticks * Math.PI / 5400, hour: s.ticks * Math.PI / 21600};
  for (const [name, arbor] of Object.entries(g.arbors)) t.near(arbor.rotation.z, independent[name], 1e-10);
  for (const [name, period] of [['seconds', 60], ['minute', 3600], ['hour', 43200]]) t.near(g.hands[name].rotation.z, (36600 + s.ticks) * 2 * Math.PI / period, 1e-10, 'Physical hand matches pulse count and initial time');
  t.ok(model.parts.some(p => p.id === preset.part)); t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(s.readings))); model.root.updateMatrixWorld(true);
  for (const [name, mesh] of Object.entries(g.gears)) {
    const position = mesh.getWorldPosition(new THREE.Vector3()).divideScalar(g.MM), spec = GEARS[name];
    t.near(position.x, spec.position[0], 1e-10); t.near(position.y, spec.position[1], 1e-10); t.near(position.z, spec.z - .2, 1e-10);
    t.near(mesh.rotation.z, spec.phase, 0); equal(mesh.parent, g.arbors[spec.arbor]);
    const bore = mesh.geometry.parameters.shapes.holes[0].getPoints(48), radius = spec.arbor === 'seconds' ? .15 : spec.arbor === 'minute' ? .32 : spec.arbor === 'hour' ? .5 : .2;
    t.near(Math.hypot(bore[0].x, bore[0].y), radius, 1e-12, `${name} bore meets its shaft or sleeve`);
  }
  checkFinite(model.root, t); presets++; poses++;
}
for (const part of lesson.parts) t.ok(model.parts.some(p => p.name === part.name), part.name);
for (const time of [0, .99, 1, 1.01, 1.046, 1.05, 2, 9.999, 10]) {
  model.reset({time, settings: D}); t.near(g.motorRotor.rotation.z, Math.floor(time) * Math.PI, 1e-12);
  t.near(g.hands.seconds.rotation.z, (36600 + Math.floor(time)) * Math.PI / 30, 1e-12, 'No late geometry step');
}
model.reset(lesson.tryIt[3].initialState);
for (const {mesh, sign, initial} of g.tines) {
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(initial[i * 3 + 1] / g.MM + 1.9) < 1e-6) t.near(p.getX(i), initial[i * 3], 1e-10, 'Physical tine root fixed');
    if (Math.abs(initial[i * 3 + 1] / g.MM - 1.9) < 1e-6) t.near(p.getX(i) - initial[i * 3], sign * .1 * g.MM, 1e-9, 'Physical tip follows signed magnified displacement');
  }
}
for (const trimmer of [1.5, 8, 30]) {
  model.reset({settings: {...D, trimmer}});
  const p = g.temperatureLine.geometry.attributes.position;
  // Independent reference points use the known typical temperature offsets;
  // the model's current 25 C frequency sets the loaded reference.
  const loaded = model.getState().frequency / 32768;
  for (const [temperature, multiplier] of [[-10, 1 - 42.875e-6], [0, 1 - 21.875e-6], [25, 1], [50, 1 - 21.875e-6]]) {
    const index = (temperature + 10) * 2, rate = (loaded * multiplier - 1) * 86400;
    t.near(p.getY(index), (-28 + (rate + 6) / 8 * 56) * g.MM, 1e-7, 'Temperature plot preserves signed rate');
  }
}
model.root.updateMatrixWorld(true); equal(g.wires.length, 8);
for (const wire of g.wires) {
  equal(wire.meshes.length, wire.points.length - 1);
  wire.meshes.forEach((mesh, i) => {
    const half = mesh.geometry.parameters.height / 2, ends = [new THREE.Vector3(0, -half, 0).applyMatrix4(mesh.matrixWorld), new THREE.Vector3(0, half, 0).applyMatrix4(mesh.matrixWorld)];
    for (const [j, end] of ends.entries()) t.near(end.distanceTo(new THREE.Vector3(...wire.points[i + j].map(v => v * g.MM))), 0, 1e-12, 'Electrical path endpoints meet');
  });
}
for (const [index, point] of [[0, g.winding.geometry.parameters.path.getPoint(0)], [1, g.winding.geometry.parameters.path.getPoint(1)]]) t.near(point.distanceTo(new THREE.Vector3(...g.terminals.motor[index].map(v => v * g.MM))), 0, 1e-12, 'Actual winding reaches circuit wires');
const connections = [['battery-positive', g.terminals.battery.plus, g.terminals.circuit.plus], ['battery-negative', g.terminals.battery.minus, g.terminals.circuit.minus], ['quartz-input', g.terminals.quartz[0], g.terminals.circuit.quartz1], ['quartz-output', g.terminals.quartz[1], g.terminals.circuit.quartz2], ['trimmer-supply', g.terminals.trimmer[0], g.terminals.circuit.plus], ['trimmer-input', g.terminals.trimmer[1], g.terminals.circuit.quartz1], ['motor-output-1', g.terminals.motor[0], g.terminals.circuit.motor1], ['motor-output-2', g.terminals.motor[1], g.terminals.circuit.motor2]];
for (const [name, start, end] of connections) {const wire = g.wires.find(w => w.name === name); equal(wire.points[0], start); equal(wire.points.at(-1), end);}
for (const guide of g.guides) {equal(guide.userData.inspectionOnly, model.parts.find(p => p.object === guide).id); equal(guide.userData.explosionExcluded, true); t.ok(model.thumbnailOmit.includes(guide));}
const whole = model.frameBoundsForPart('system'); t.ok(whole.max.x < 49 * g.MM && whole.min.x > -49 * g.MM, 'Guides do not enlarge the clock frame');
for (const mode of [0, 1, 2]) {
  model.reset(); model.update({...D, mode}); model.playback.step(); t.near(model.getState().time, quartzClockExperiment({mode}).mode.step, 1e-12);
  model.advance(1000000); t.ok(model.playback.complete()); const held = JSON.stringify(model.getState()); model.advance(1); equal(JSON.stringify(model.getState()), held);
  const values = model.getState().values; model.reset(model.replayState()); model.update(values); equal(model.getState().time, 0); t.ok(!model.playback.complete());
}
for (const action of model.actions) {model.reset({time: 2.02}); const held = JSON.stringify(model.getState()); equal(action.run(), model.getState().readings); equal(JSON.stringify(model.getState()), held, 'Inspection does not advance or reset experiment'); t.ok(model.parts.some(p => p.id === action.part));}
const materials = new Set(); model.root.traverse(o => {if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);});
for (let i = 0; i < 30; i++) model.advance(.013);
model.root.traverse(o => {if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) t.ok(materials.has(m), 'Animation reuses owned materials');});
const resources = checkDisposal(model, t);
let layouts = 0;
for (const aspect of [1, 1.24]) for (const time of [0, 1.02]) {
  const m = createQuartzClockModel(); m.reset({time}); const before = JSON.stringify(m.getState());
  const {camera} = frameModel(m, aspect), explosion = createPartExplosion(m, camera, aspect); explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const b = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) b.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return b;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Exploded groups do not overlap');
  t.ok(boxes.length >= 8); explosion.update(0); explosion.dispose(); equal(JSON.stringify(m.getState()), before); m.dispose(); layouts++;
}
console.log(JSON.stringify({passed: true, checks: t.count, presets, poses, actions: model.actions.length, layouts, resources, meshPairs: PAIRS.length}));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHairspringModel, hairspringMotion} from './hairspring-model.js';
import {createWatchModel} from './watch-model.js';
import {hairspringLesson as lesson} from './watch-lessons.js';
import {WATCH_DEFAULTS as D} from './watch-physics.js';
import {houseComponents} from './house-components.js';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
import {checkDisposal, checkFinite, tally} from './model-check-kit.mjs';

const t = tally(), m = createHairspringModel(), original = createWatchModel();
const equal = (a, b, message) => {assert.deepEqual(a, b, message); t.add();};
const histories = [D, {...D, hours: 44}, {...D, index: -5, alloy: 0, temperature: 40, hours: 43}];
const states = ['Turning point', 'Spring energy → balance motion', 'Equilibrium crossing', 'Turning point', 'Equilibrium crossing', 'Balance motion → spring energy', 'Turning point', 'Turning point', 'Turning point', 'Turning point', 'Turning point', 'Turning point', 'At rest', 'Turning point', 'Turning point', 'Turning point', 'Turning point', 'Turning point'];
equal(lesson.tryIt.length, 18);
for (const [i, p] of lesson.tryIt.entries()) for (const history of histories) {
  m.reset(); m.update(history); m.advance(100);
  m.reset(p.initialState); const returned = m.update(p.values), s = m.getState();
  equal(s.values, p.values, p.title); equal(returned, s.readings, 'Mutation returns dedicated readings');
  t.ok(s.readings[0].value.startsWith(states[i]), p.title);
  t.near(s.time, p.initialState.phase / s.frequency, 1e-12);
  t.ok(m.parts.some(part => part.id === p.part), 'Preset targets actual selection');
  if (i === 0 || i === 3) {
    t.near(s.angle * 180 / Math.PI, i === 0 ? -242.47 : 242.47, .005);
    t.near(s.restoringTorque * 1e6, i === 0 ? 2.6524 : -2.6524, .00005);
    t.near(s.kineticEnergy, 0, 1e-18);
  }
  if (i === 1 || i === 5) {
    t.near(s.elasticEnergy * 1e6, 2.8062, .00005); t.near(s.kineticEnergy * 1e6, 2.8062, .00005);
  }
  if (i === 2 || i === 4) {
    t.near(s.restoringTorque, 0, 1e-18); t.near(s.elasticEnergy, 0, 1e-18);
    t.near(s.angularVelocity, i === 2 ? 106.359 : -106.359, .0005);
  }
  const quoted = {
    8: [83.9195, .627387, .249875, 43.23],
    9: [84.0875, .626133, .250125, -43.17],
    13: [84.0229, .624181, .250576, -198.56],
    14: [83.9842, .629333, .249428, 198.02],
  }[i];
  if (quoted) {
    t.near(s.hair.workingLength, quoted[0], .00005);
    t.near(s.kappa * 1e6, quoted[1], .0000005);
    t.near(1 / s.frequency, quoted[2], .0000005);
    t.near(s.rate, quoted[3], .005);
  }
  if (i === 10) {t.near(s.amplitude * 180 / Math.PI, 163.47, .005); t.near(s.elasticEnergy * 1e6, 2.5511, .00005);}
  if (i === 11) {t.near(s.amplitude * 180 / Math.PI, 36.55, .005); t.near(s.elasticEnergy * 1e6, .1276, .00005);}
  if (i === 12) {equal(s.running, false); t.near(s.oscillatorEnergy, 0, 1e-18); equal(s.angularVelocity, 0);}
  if (i === 15) {t.near(s.frequency, 4, 1e-12); t.near(s.rate, 0, 1e-8);}
  if (i === 16) {t.near(s.beatEnergy * 1e6, .0705, .00005); t.near(s.oscillatorEnergy * 1e6, 5.6123, .00005);}
  if (i === 17) {equal(s.beats, 2); t.near(s.time, .25, 1e-12); t.near(s.elasticEnergy * 1e6, 5.6123, .00005);}
  const held = JSON.stringify(s); m.advance(0); equal(JSON.stringify(m.getState()), held);
}
for (const entry of lesson.parts) t.ok(m.parts.some(part => part.name === entry.name), 'Glossary matches selection names');
equal(houseComponents.Hairspring.createModel, createHairspringModel);
equal(houseComponents.Hairspring.part, 'oscillator');

const profiles = [D, {...D, hours: 24}, {...D, hours: 43}, {...D, hours: 44}, {...D, index: 5, alloy: 0, temperature: 0}, {...D, index: -5, alloy: 0, temperature: 40}, {...D, temperature: 40}];
let poses = 0, integrationSteps = 0;
for (const values of profiles) {
  m.reset(); m.update(values);
  const s = m.getState(), dt = values.temperature - 20;
  const growth = 1 + (values.alloy ? 8e-6 : 11.5e-6) * dt;
  const inertia = 49e-6 * (.0045 * (1 + 12e-6 * dt)) ** 2;
  const referenceInertia = 49e-6 * .0045 ** 2;
  const modulus = 195e9 * (values.alloy ? inertia / referenceInertia / growth ** 3 : 1 - 240e-6 * dt);
  const neutralLength = 195e9 * .00012 * .00003 ** 3 / (12 * referenceInertia * (2 * Math.PI * 4) ** 2);
  const length = neutralLength * (1 - .0002 * values.index) * growth;
  const stiffness = modulus * .00012 * growth * (.00003 * growth) ** 3 / (12 * length);
  const period = 2 * Math.PI * Math.sqrt(inertia / stiffness);
  t.near(s.inertia, inertia, 1e-22); t.near(s.kappa, stiffness, 1e-18);
  t.near(s.hair.workingLength, length * 1000, 1e-10); t.near(1 / s.frequency, period, 1e-12);
  const work = .3 * (200e9 * .0012 * .00014 ** 3 / (12 * .22) * 2 * Math.PI * (5.5 - values.hours / 8)) * (2 * Math.PI / (15 * 7680)) / 2;
  t.near(s.beatEnergy, work, 1e-18);
  if (s.running) {
    const E = 250 * work / Math.PI, amplitude = Math.sqrt(2 * E / stiffness);
    t.near(s.oscillatorEnergy, E, 1e-18); t.near(s.amplitude, amplitude, 1e-12);
    let x = -amplitude, v = 0;
    const step = period / 4096, acceleration = x => -stiffness / inertia * x;
    for (let j = 1; j <= 4096; j++) {
      const ax = v, av = acceleration(x), bx = v + step * av / 2, bv = acceleration(x + step * ax / 2);
      const cx = v + step * bv / 2, cv = acceleration(x + step * bx / 2), dx = v + step * cv, dv = acceleration(x + step * cx);
      x += step * (ax + 2 * bx + 2 * cx + dx) / 6; v += step * (av + 2 * bv + 2 * cv + dv) / 6;
      if (j % 128 === 0) {
        const motion = hairspringMotion({...s, time: j * step, angle: x});
        t.near(motion.angularVelocity, v, 2e-10, 'Independent RK4 torsional dynamics match reported velocity');
        t.near(motion.restoringTorque, -stiffness * x, 1e-18);
        t.near(motion.kineticEnergy, inertia * v * v / 2, 1e-17);
        t.near(motion.oscillatorEnergy, E, 1e-17, 'Undamped harmonic exchange preserves energy');
      }
      integrationSteps++;
    }
    t.near(x, -amplitude, 2e-11); t.near(v, 0, 2e-10);
  }
  const initialBounds = m.frameBoundsForPart('oscillator').clone();
  for (let i = 0; i <= 64; i++) {
    for (const model of [m, original]) {model.reset({phase: i / 64}); model.update(values); model.root.updateMatrixWorld(true);}
    const s = m.getState(), base = original.getState(), p = m.topology;
    for (const key of ['escape', 'lever', 'angle', 'time', 'stage', 'beats', 'power', 'rate']) equal(s[key], base[key], 'Focused wrapper preserves connected watch physics');
    for (const key of ['length', 'workingLength', 'totalLength', 'innerAngle', 'outerAngle'])
      t.near(s.hair[key], base.hair[key], 1e-8, 'Spring solver agrees within numerical contour tolerance');
    for (const key of ['points', 'terminal']) for (let j = 0; j < s.hair[key].length; j++) for (let k = 0; k < 2; k++)
      t.near(s.hair[key][j][k], base.hair[key][j][k], 1e-8, 'Constant-material contour and terminal preserved');
    const objects = model => {const p = model.topology; return [p.coil, p.terminal, p.collar, p.collarMark, p.stud, ...p.curbPins, p.balanceRim, p.balanceSpoke, p.jewel, p.safetyRoller];};
    const actual = objects(m), expected = objects(original);
    for (let j = 0; j < actual.length; j++) {
      const vertices = actual[j].geometry.attributes.position.array, reference = expected[j].geometry.attributes.position.array;
      equal(vertices.length, reference.length);
      t.ok(vertices.every((v, k) => Math.abs(v - reference[k]) < 2e-7), 'Rendered geometry agrees within float32 precision');
      for (let k = 0; k < 16; k++) t.near(actual[j].matrixWorld.elements[k], expected[j].matrixWorld.elements[k], 1e-12, 'Regrouping preserves world geometry');
    }
    equal(m.frameBoundsForPart('oscillator'), initialBounds, 'Frame remains steady while guide reverses');
    t.near(s.restoringTorque, -s.kappa * s.angle, 1e-18);
    if (s.running) t.near(s.oscillatorEnergy, s.energy, 1e-18);
    const torque = s.restoringTorque * 1e6, visible = Math.abs(torque) > 1e-8;
    equal(p.torqueArc.visible, visible); equal(p.torqueHead.visible, visible);
    if (visible) {
      const radial = p.torqueHead.position.clone().setZ(0).normalize();
      const tangent = new THREE.Vector3(0, 1, 0).applyQuaternion(p.torqueHead.quaternion);
      t.near(radial.dot(tangent), 0, 1e-12, 'Arrow is tangent to torque arc');
      t.near(radial.cross(tangent).z, Math.sign(torque), 1e-12, 'Arrow points opposite displacement');
      const pos = p.torqueArc.geometry.attributes.position;
      let arcLength = 0;
      for (let j = 2; j < pos.count; j += 2) arcLength += new THREE.Vector3().fromBufferAttribute(pos, j).distanceTo(new THREE.Vector3().fromBufferAttribute(pos, j - 2));
      t.near(arcLength / p.MM, 5.555 * Math.abs(torque) / 3 * 1.8, .0003, 'Arc length encodes relative torque magnitude');
    }
    for (const [j, energy] of [s.elasticEnergy, s.kineticEnergy].entries()) {
      const b = p.energyBars[j], bounds = new THREE.Box3().setFromObject(b);
      t.near(bounds.min.x, -15 * p.MM, 5e-8, 'Energy bars share fixed zero baseline within float32 vertex precision');
      t.near(bounds.getSize(new THREE.Vector3()).x, 30 * p.MM * energy * 1e6 / 6, 1e-7, 'Both bars use same physical scale');
      equal(b.visible, energy * 1e6 / 6 > 1e-12);
    }
    t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(s.readings)), 'Finite readouts');
    if (i % 16 === 0) checkFinite(m.root, t);
    poses++;
  }
}
for (const values of profiles) for (const action of m.actions) {
  m.reset(); m.update(values); const returned = action.run(), s = m.getState();
  equal(s.values, values, 'Inspection preserves winding and thermal settings'); equal(returned, s.readings);
  t.ok(m.parts.some(part => part.id === action.part), 'Action targets selectable geometry');
}
m.reset(); m.playback.step(); equal(m.getState().beats, 1); m.playback.step(); equal(m.getState().beats, 2);
m.advance(100); t.ok(m.playback.complete()); t.near(m.getState().time, 2, 1e-12);
const completed = JSON.stringify(m.getState()); m.advance(10); equal(JSON.stringify(m.getState()), completed);
m.reset(); t.ok(!m.playback.complete()); m.update({hours: 44});
const stopped = JSON.stringify(m.getState()); m.playback.step(); m.animate(20); equal(JSON.stringify(m.getState()), stopped);
m.update({hours: 0}); t.ok(!m.playback.blocked());
for (const bad of [NaN, Infinity, -1, 1.01]) {assert.throws(() => m.reset({phase: bad}), RangeError); t.add();}
m.reset();
for (const cover of m.covers) cover.visible = false;
m.root.updateMatrixWorld(true);
for (const id of ['spring-collar', 'spring-stud', 'spring-regulator']) {
  const target = m.parts.find(part => part.id === id), box = new THREE.Box3().setFromObject(target.object);
  let reachable = false;
  for (let y = 1; y < 20 && !reachable; y++) for (let x = 1; x < 20 && !reachable; x++) {
    const origin = new THREE.Vector3(box.min.x + (box.max.x - box.min.x) * x / 20, box.min.y + (box.max.y - box.min.y) * y / 20, 2);
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1)).intersectObject(m.root, true);
    for (const hit of hits) {
      let shown = true, owner;
      for (let object = hit.object; object; object = object.parent) {
        if (!object.visible || object.userData.inspectionOnly) shown = false;
        owner ||= m.parts.find(part => part.object === object);
      }
      if (!shown || !owner) continue;
      reachable = owner.id === id; break;
    }
  }
  t.ok(reachable, id + ' has a direct visible pointer target');
}
const resources = checkDisposal(m, t); original.dispose();
let layouts = 0;
for (const values of [D, {...D, hours: 44}]) for (const aspect of [1, 1.16]) {
  const model = createHairspringModel(); model.update(values); for (const cover of model.covers) cover.visible = false;
  const held = JSON.stringify(model.getState()), {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect);
  explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {
    const box = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return box;
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
    t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Inventory groups do not overlap');
  t.ok(boxes.length > 10);
  for (const guide of [model.topology.torqueGuide, model.topology.energyPanel]) {
    equal(guide.userData.explosionExcluded, true);
    t.ok(!explosion.items.some(unit => unit.object === guide || unit.group === guide), 'Explanatory guides are not parts inventory');
  }
  explosion.update(0); explosion.dispose(); equal(JSON.stringify(model.getState()), held); model.dispose(); layouts++;
}
console.log(JSON.stringify({passed: true, checks: t.count, presets: lesson.tryIt.length, histories: histories.length, poses, integrationSteps, actions: m.actions.length, layouts, resources}));

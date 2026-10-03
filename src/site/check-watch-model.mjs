import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleWatch, balance, balanceInertia, SPRING_LENGTH, WATCH, WATCH_DEFAULTS as D, WATCH_DOMAINS} from './watch-physics.js';
import {createWatchModel, ampPoint, ratePoint} from './watch-model.js';
import {watchLesson as lesson} from './watch-lessons.js';
import {WATCH_TRAIN_GEARS as G, WATCH_MESH_PAIRS} from './watch-train.js';
import {WATCH_HAIRSPRING as H, WATCH_MAINSPRING as M, watchHairspring} from './watch-springs.js';
import {checkDisposal, checkFinite, checkRefusals, tally} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), TAU = 2 * Math.PI, degrees = r => r * 180 / Math.PI;
const near = (a, b, tolerance = 1e-10, message = 'Numerical agreement') => t.near(a, b, tolerance, message);
const equal = (a, b, message) => { assert.deepEqual(a, b, message); t.add(); };
const distanceToSegment = (p, a, b) => {
  const d = b.clone().sub(a), u = Math.max(0, Math.min(1, p.clone().sub(a).dot(d) / d.lengthSq()));
  return p.distanceTo(a.clone().addScaledVector(d, u));
};
const model = createWatchModel(), p = model.topology, MM = p.MM;
const point = (object, xyz) => object.localToWorld(new THREE.Vector3(...xyz).multiplyScalar(MM));
const read = name => model.getState().readings.find(r => r.label === name);
near(balanceInertia(), 49e-6 * .0045 ** 2, 1e-20, 'Thin-ring inertia');
near(SPRING_LENGTH, 195e9 * .00012 * .00003 ** 3 / (12 * 49e-6 * .0045 ** 2 * (TAU * 4) ** 2), 1e-15);
let physicsCases = 0;
for (const index of [-5, 0, 5]) for (const alloy of [0, 1]) for (const temperature of [0, 10, 20, 30, 40]) for (const hours of [0, 24, 43, 44]) {
  const values = {index, alloy, temperature, hours}, b = balance(values), dt = temperature - 20;
  const growth = 1 + (alloy ? 8e-6 : 11.5e-6) * dt, inertia = 49e-6 * (.0045 * (1 + 12e-6 * dt)) ** 2;
  const modulus = 195e9 * (alloy ? inertia / (49e-6 * .0045 ** 2) / growth ** 3 : 1 - 240e-6 * dt);
  const length = SPRING_LENGTH * (1 - .0002 * index) * growth;
  const stiffness = modulus * .00012 * growth * (.00003 * growth) ** 3 / (12 * length);
  const mainStiffness = 200e9 * .0012 * .00014 ** 3 / (12 * .220);
  const torque = mainStiffness * TAU * (5.5 - hours / 8), barrelPerCycle = TAU / (15 * 7680);
  near(b.kappa, stiffness, 1e-18); near(b.inertia, inertia, 1e-20);
  near(b.period, TAU * Math.sqrt(inertia / stiffness)); near(b.torque, torque);
  near(b.mainspringEnergy, mainStiffness * (TAU * (5.5 - hours / 8)) ** 2 / 2);
  equal(b.running, hours < 44, 'Every offered nonempty setting has enough swing');
  if (b.running) {
    near(b.beatEnergy, .3 * torque * barrelPerCycle / 2, 1e-18);
    near(TAU * b.energy / 250, b.power * b.period, 1e-18, 'Mean work replenishes one cycle of loss');
    near(.5 * stiffness * b.amplitude ** 2, b.energy, 1e-18);
    near(b.rate, 86400 * (1 / b.period / 4 - 1), 1e-8);
    if (alloy) near(b.frequency, 4 / Math.sqrt(1 - .0002 * index));
  } else { equal([b.power, b.energy, b.beatEnergy, b.rate], [0, 0, 0, null], 'Stopped has no continuing work or rate'); }
  physicsCases++;
}
for (const amplitude of [40, 240]) {
  const b = balance(), step = b.period / 20000;
  let angle = amplitude * Math.PI / 180, velocity = 0, elapsed = 0;
  const derivative = ([a, v]) => [v, -b.kappa / b.inertia * a];
  for (let i = 0; i < 6000; i++) {
    const state = [angle, velocity], k1 = derivative(state), k2 = derivative(state.map((x, j) => x + step * k1[j] / 2)), k3 = derivative(state.map((x, j) => x + step * k2[j] / 2)), k4 = derivative(state.map((x, j) => x + step * k3[j]));
    const next = state.map((x, j) => x + step / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    if (next[0] <= 0) { elapsed += step * angle / (angle - next[0]); break; }
    [angle, velocity] = next; elapsed += step;
  }
  near(4 * elapsed, b.period, 1e-9, 'Direct oscillator integration gives amplitude-independent period');
}
const expectedStages = ['Locked; balance free', 'Unlocking', 'Impulse', 'Impulse', 'Free drop', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Stopped; no continuing drive', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free'];
const histories = [D, {...D, index: -5, alloy: 0, temperature: 40, hours: 43}, {...D, hours: 44}];
const presetChecks = [
  s => { near(degrees(s.amplitude), 242.470327, 1e-6); near(s.frequency, 4); near(s.rate, 0); equal(s.beatsPerHour, 28800); },
  s => { equal(s.contact.face, 'lock'); equal(s.forkContact, 'balance drives fork'); },
  s => { equal(s.contactSide, 0); equal(s.contact.face, 'impulse'); },
  s => { equal(s.contactSide, 1); equal(s.contact.face, 'impulse'); },
  s => { equal(s.contactSide, null); equal(s.contact, null); },
  s => { equal(s.beats, 2); near(s.escape, TAU / 15); },
  s => near(s.fourth, 60 * s.center),
  s => { near(s.hour, s.minute / 12); equal(read('Dial').value, '10:00:00'); },
  () => equal(G.motion.teeth / G.cannon.teeth * G.hour.teeth / G.motionPinion.teeth, 12),
  s => { near(s.hair.workingLength, 83.9867, .00005); near(s.rate, 8.64, .005); },
  s => { near(s.remainingTurns, 2.5); near(s.torque * 1000, 3.9184, .00005); near(degrees(s.amplitude), 163.47, .005); },
  s => { near(s.remainingTurns, .125); near(s.torque * 1000, .1959, .00005); near(degrees(s.amplitude), 36.55, .005); },
  s => { equal(s.running, false); equal(s.power, 0); equal(p.rateDot.visible, false); },
  s => near(s.rate, -99.21, .005),
  s => { near(s.frequency, 4); near(s.rate, 0); },
  s => { near(s.beatEnergy * 1e6, .0705, .00005); near(s.power * 1e6, .5642, .00005); near(s.energy * 1e6, 5.6123, .00005); },
];
equal(lesson.tryIt.length, presetChecks.length);
for (const [i, trial] of lesson.tryIt.entries()) for (const history of histories) {
  model.reset(); model.update(history); model.advance(30);
  model.reset(trial.initialState); model.update(trial.values);
  const s = model.getState(); equal(s.values, trial.values, trial.title); equal(s.stage, expectedStages[i], trial.title);
  near(s.time, trial.initialState.phase / s.frequency); presetChecks[i](s);
  t.ok(model.parts.some(part => part.id === trial.part), 'Preset target exists');
  const held = JSON.stringify(s); model.advance(0); equal(JSON.stringify(model.getState()), held, 'Zero advance leaves prepared preset unchanged');
}
for (const entry of lesson.parts) t.ok(model.parts.some(part => part.name === entry.name), 'Glossary names match actual parts');
const profiles = [D, {...D, index: -5, alloy: 0, temperature: 40}, {...D, index: 5, alloy: 0, temperature: 0}, {...D, hours: 24}, {...D, hours: 43}, {...D, hours: 44}];
let poses = 0;
model.root.position.set(.1, -.2, .3); model.root.rotation.set(.17, -.3, .24);
const neutralHair = watchHairspring({length: SPRING_LENGTH * 1000});
for (const values of profiles) for (let i = 0; i <= 80; i++) {
  model.reset({phase: i / 80}); model.update(values); model.root.updateMatrixWorld(true);
  const s = model.getState(); near(p.wheel.rotation.z, s.angle); near(p.lever.rotation.z, s.lever);
  near(p.hourHand.rotation.z, s.trainAngles.hour); near(p.minuteHand.rotation.z, s.trainAngles.center); near(p.secondsHand.rotation.z, s.trainAngles.fourth);
  for (const [name, spec] of Object.entries(G)) {
    const mesh = p.gears[name]; near(mesh.rotation.z, spec.phase);
    near(mesh.parent.rotation.z, s.trainAngles[spec.arbor]);
    near(mesh.position.z / MM + .08, spec.z); equal(mesh.userData.teeth, spec.teeth);
    equal(mesh.geometry.parameters.shapes.curves.length > spec.teeth, true, 'Actual toothed gear is drawn');
  }
  for (const [a, b] of WATCH_MESH_PAIRS) {
    const ga = G[a], gb = G[b];
    near(point(p.gears[a], [0, 0, 0]).distanceTo(point(p.gears[b], [0, 0, 0])) / MM, (ga.teeth + gb.teeth) * ga.module / 2, 1e-8, 'World pitch circles touch in one axial plane');
  }
  if (s.contact) {
    const at = point(p.movement, [p.POSITION.escape[0] + s.contact.point[0], p.POSITION.escape[1] + s.contact.point[1], p.LEVEL.escape]);
    const pallet = p.palletMeshes[s.contactSide], contour = pallet.geometry.parameters.shapes.getPoints(1).map(v => point(pallet, [v.x, v.y, .13]));
    t.ok(Math.min(...contour.map((a, j) => distanceToSegment(at, a, contour[(j + 1) % contour.length]))) < 1e-8, 'World tooth contact lies on actual pallet face');
    const tooth = p.escapeWheel.geometry.parameters.shapes.getPoints(1).map(v => point(p.escapeWheel, [v.x, v.y, .1]));
    t.ok(Math.min(...tooth.map(v => v.distanceTo(at))) < 1e-7, 'Actual rotated tooth tip touches pallet');
  }
  const mainFirst = point(p.mainspring, [...s.spring.points[0], 2.05]), mainLast = point(p.mainspring, [...s.spring.points.at(-1), 2.05]);
  near(mainFirst.distanceTo(point(p.heldArbor, [M.inner, 0, 2.05])), 0, 1e-10, 'Inner mainspring end attached in every state');
  near(mainLast.distanceTo(point(p.barrelBody, [M.outer, 0, 2.05])), 0, 1e-9, 'Outer mainspring end attached to moving barrel');
  const hairFirst = point(p.coil, [...s.hair.points[0], p.LEVEL.spring]);
  near(hairFirst.distanceTo(point(p.wheel, [H.inner * s.growth * Math.cos(neutralHair.innerAngle), H.inner * s.growth * Math.sin(neutralHair.innerAngle), p.LEVEL.spring])), 0, 1e-10, 'Inner hairspring attached to rotating collar');
  near(point(p.coil, [...s.hair.points.at(-1), p.LEVEL.spring]).distanceTo(point(p.terminal, [...s.hair.terminal[0], p.LEVEL.spring])), 0, 1e-10);
  const stud = p.stud.getWorldPosition(new THREE.Vector3()), terminalEnd = point(p.terminal, [...s.hair.terminal.at(-1), 7.4]);
  near(stud.distanceTo(terminalEnd), 0, 1e-10, 'Fixed terminal enters actual stud');
  for (const [mesh, points, thickness, height, z] of [[p.coil, s.hair.points, H.thickness * s.growth, H.height * s.growth, 7], [p.terminal, s.hair.terminal, H.thickness * s.growth, H.height * s.growth, 7], [p.mainspring, s.spring.points, M.thickness, M.height, 2.05]]) {
    const vertices = mesh.geometry.attributes.position;
    for (const j of [0, Math.floor(points.length / 2), points.length - 1]) {
      const corners = [0, 1, 2, 3].map(k => new THREE.Vector3().fromBufferAttribute(vertices, 4 * j + k).divideScalar(MM));
      const center = corners.reduce((sum, v) => sum.add(v), new THREE.Vector3()).multiplyScalar(.25);
      near(center.distanceTo(new THREE.Vector3(...points[j], z)), 0, 2e-6, 'Float32 rendered ribbon follows solved centerline');
      near(corners[0].distanceTo(corners[1]), thickness, 2e-6); near(corners[0].distanceTo(corners[3]), height, 2e-6);
    }
  }
  near(p.regulator.rotation.z, s.hair.outerAngle); equal(p.rateDot.visible, s.running);
  near(p.ampDot.position.y, ampPoint(values.hours, degrees(s.predictedAmplitude))[1]);
  if (s.running) near(p.rateDot.position.y, ratePoint(values.temperature, s.rate)[1]);
  equal(read('Working contact').value, s.stage); equal(model.playback.blocked(), !s.running);
  if (i % 20 === 0) checkFinite(model.root, t);
  poses++;
}
model.root.position.set(0, 0, 0); model.root.rotation.set(0, 0, 0); model.reset(); model.root.updateMatrixWorld(true);
for (const [name, bearing] of Object.entries(p.upperBearings)) {
  const shaft = p.shafts.find(mesh => mesh.parent === (name === 'lever' ? p.lever : p.arbors[name]));
  const sb = new THREE.Box3().setFromObject(shaft), bb = new THREE.Box3().setFromObject(bearing);
  t.ok(sb.min.z < bb.min.z && sb.max.z > bb.max.z, 'Shaft passes through upper bearing');
}
const mainBox = new THREE.Box3().setFromObject(p.barrelArbor);
t.ok(mainBox.min.z / MM <= -.25 + 2e-6 && mainBox.max.z / MM >= .43, 'Held barrel arbor passes through plate and bearing');
for (const values of profiles) for (const action of model.actions) {
  model.reset(); model.update(values); action.run(); const s = model.getState();
  equal(s.values, values); t.ok(model.parts.some(part => part.id === action.part), 'Inspection target exists');
  if (s.running && /unlocking|impulse|free drop/.test(action.label)) {
    equal(s.stage, action.label.endsWith('unlocking') ? 'Unlocking' : action.label.endsWith('impulse') ? 'Impulse' : 'Free drop');
    if (s.stage !== 'Free drop') equal(s.contactSide, action.label.includes('entry') ? 0 : 1);
  }
}
model.reset(); model.playback.step(); equal(model.getState().beats, 1); model.playback.step(); equal(model.getState().beats, 2); near(model.getState().escape, TAU / 15);
model.advance(100); t.ok(model.playback.complete(), 'Two-second checkpoint reached'); near(model.getState().time, 2);
const completed = JSON.stringify(model.getState()); model.advance(1); equal(JSON.stringify(model.getState()), completed, 'Completion freezes');
model.reset(); t.ok(!model.playback.complete(), 'Reset permits replay'); model.update({hours: 44}); const stopped = JSON.stringify(model.getState());
model.playback.step(); model.advance(100); equal(JSON.stringify(model.getState()), stopped, 'No wind blocks step and play');
model.update({hours: 0}); t.ok(!model.playback.blocked(), 'Rewinding recovers');
for (const bad of [NaN, Infinity, -1, 1.01]) { assert.throws(() => model.reset({phase: bad}), RangeError); t.add(); }
checkRefusals(sampleWatch, WATCH_DOMAINS, t); assert.throws(() => sampleWatch({}, 2.01), RangeError); t.add();
const resources = checkDisposal(model, t);
let layouts = 0;
for (const values of [D, {...D, hours: 44}]) for (const aspect of [1, 1.16]) {
  const m = createWatchModel(); m.update(values); for (const cover of m.covers) cover.visible = false;
  const state = JSON.stringify(m.getState()), {camera} = frameModel(m, aspect), explosion = createPartExplosion(m, camera, aspect);
  const chartGeometry = new Set(); m.topology.charts.traverse(o => { if (o.geometry) chartGeometry.add(o.geometry); });
  explosion.root.traverse(o => { if (o.geometry) t.ok(!chartGeometry.has(o.geometry), 'Explanatory charts excluded from physical inventory'); });
  explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {
    const b = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) b.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return b;
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Separated groups do not overlap');
  t.ok(boxes.length > 10, 'Actual parts available to separate'); explosion.update(0); explosion.dispose(); equal(JSON.stringify(m.getState()), state, 'Separation preserves mechanism'); m.dispose(); layouts++;
}
console.log(JSON.stringify({passed: true, checks: t.count, physicsCases, poses, presets: lesson.tryIt.length, histories: histories.length, actions: model.actions.length, resources, layouts}));

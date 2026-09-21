// Sardine-can key: the model held to geometry and an energy balance worked out
// here in their own terms, and every number the lesson quotes held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  sampleSardineKey, sardineKeyPlan, canPoint, canSegments, BAND_LENGTH,
  SARDINE_KEY_DEFAULTS as D, SARDINE_KEY_DOMAINS, SARDINE_KEY_OPTIONS, SARDINE_KEY_CONSTANTS as C,
} from './sardine-can-key-physics.js';
import {createSardineCanKeyModel} from './sardine-can-key-model.js';
import {sardineCanKeyLesson as lesson} from './sardine-can-key-lesson.js';
import {fixed} from './format.js';

let checks = 0;
const near = (actual, expected, tolerance, message) => {
  checks++;
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not ${expected} within ${tolerance}`);
};
const TAU = Math.PI * 2, h = C.thickness, a = C.length / 2, b = C.breadth / 2, rc = C.cornerRadius;

// 1. The band follows the rounded rectangle, judged by its distance function.
const wallDistance = (x, z) => {
  const qx = Math.abs(x) - (a - rc), qz = Math.abs(z) - (b - rc);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rc;
};
near(BAND_LENGTH, 2 * (C.length + C.breadth) - 8 * rc + TAU * rc, 1e-9, 'band length is the perimeter');
{
  let walked = 0, previous = canPoint(0);
  for (let i = 1; i <= 40000; i++) {
    const p = canPoint(BAND_LENGTH * i / 40000), dx = p.x - previous.x, dz = p.z - previous.z, step = Math.hypot(dx, dz);
    near(wallDistance(p.x, p.z), 0, 1e-9, 'peel line on the wall');
    near((dx * Math.cos(p.psi) - dz * Math.sin(p.psi)) / step, 1, 1e-6, 'heading along the wall');
    near(wallDistance(p.x + 0.01 * Math.sin(p.psi), p.z + 0.01 * Math.cos(p.psi)), 0.01, 1e-9, 'normal points out of the can');
    walked += step;
    previous = p;
  }
  near(walked, BAND_LENGTH, 1e-3, 'walked perimeter');
  near(Math.hypot(canPoint(0).x - canPoint(BAND_LENGTH).x, canPoint(0).z - canPoint(BAND_LENGTH).z), 0, 1e-9, 'band ends back at the tab');
}

// 2. The coil, integrated in small steps instead of from the closed form.
for (const shank of [1.5, 2, 2.5, 3]) {
  const rho0 = shank + h / 2, d = 1e-4;
  let theta = 0, length = 0;
  while (length < BAND_LENGTH) { length += (rho0 + h * (theta + d / 2) / TAU) * d; theta += d; }
  const plan = sardineKeyPlan({shank});
  near(plan.thetaTotal, theta, 2e-4, `angle to wind the band on a ${shank} mm shank`);
  near(plan.rhoFinal, rho0 + h * theta / TAU, 1e-5, 'final coil radius');
}

// 3. A march along the band: torque from the energy balance, the first point it
// passes the fingers' torque, and the work done to get there. Corners are found
// from position alone.
const onCorner = s => { const p = canPoint(Math.min(BAND_LENGTH, s)); return Math.abs(p.x) > a - rc + 1e-9 && Math.abs(p.z) > b - rc + 1e-9; };
function march(values, ds = 0.02) {
  const v = {...D, ...values}, tear = 2 * SARDINE_KEY_OPTIONS.score[v.score].tearPerLine;
  const mp = SARDINE_KEY_OPTIONS.temper[v.temper].yieldStrength * C.bandWidth * h * h / 4;
  let s = 0, theta = 0, work = 0, stall = null, first = null, last = null;
  while (s < BAND_LENGTH - 1e-9) {
    const step = Math.min(ds, BAND_LENGTH - s), corner = onCorner(s + step / 2), rho = v.shank + h / 2 + h * theta / TAU;
    const rotationPerLength = 1 / rho + (corner ? 1 / rc : 0);
    const torque = (tear + mp * rotationPerLength) / rotationPerLength;
    if (first === null) first = torque / v.grip;
    if (torque > v.effort * v.grip + 1e-9) { stall = s; break; }
    const dTheta = step / (rho + h * (step / rho) / (2 * TAU));
    work += tear * step + mp * (dTheta + (corner ? step / rc : 0));
    theta += dTheta;
    s += step;
    last = torque / v.grip;
  }
  return {stall, theta, work: work / 1000, first, last};
}
let marches = 0;
for (const effort of [2, 6.5, 10, 12.5, 15, 24]) for (const grip of [6, 10, 16]) for (const shank of [1.5, 2, 3]) for (const score of [0, 1, 2]) for (const temper of [0, 3]) {
  const values = {effort, grip, shank, score, temper}, plan = sardineKeyPlan(values), reference = march(values), end = sampleSardineKey(values, C.duration);
  assert.equal(plan.stallLength === null, reference.stall === null, `stall or not for ${JSON.stringify(values)}`);
  if (reference.stall !== null) near(plan.stallLength, reference.stall, 0.05, 'where the key stalls');
  else near(plan.forceAtEnd, reference.last, 2e-3, 'force needed on the last turn');
  near(plan.forceAtStart, reference.first, 1e-9, 'force needed on the first turn');
  // A march that stalls stops at the first step past the exact stall, so it can lead by one step over the radius.
  near(end.theta, reference.theta, 2e-3 + (reference.stall === null ? 0 : 0.02 / (shank + h / 2)), 'angle turned by the end of the trial');
  near(end.work, reference.work, 3e-3, 'work done by the end of the trial');
  marches++;
}

// 4. Through a trial the band off never falls back, the coil never shrinks, and
// the force needed only drops where the band enters a corner.
for (const values of [{}, {grip: 16}, {shank: 1.5}, {score: 2, effort: 24}]) {
  let previous = null, drops = 0;
  for (let i = 0; i <= 1600; i++) {
    const s = sampleSardineKey(values, i * 0.01);
    if (previous) {
      assert.ok(s.woundLength >= previous.woundLength - 1e-12 && s.remainingLength <= previous.remainingLength + 1e-12, 'band off never falls back');
      assert.ok(s.coilRadius >= previous.coilRadius - 1e-12, 'coil never shrinks');
      if (s.fingerForce < previous.fingerForce - 1e-12) { drops++; assert.ok(!previous.onCorner && s.onCorner, 'force only drops entering a corner'); }
      checks += 2;
    }
    previous = s;
  }
  assert.equal(drops, 4, 'four corner entries before the band ends');
  const done = sampleSardineKey(values, C.duration);
  assert.equal(done.mode, 'freed');
  near(done.lidLift, 1, 0, 'lid lifted by the end');
}
{
  const plan = sardineKeyPlan({});
  assert.ok(plan.forceAtEnd / plan.forceAtStart > 1.8 && plan.forceAtEnd / plan.forceAtStart < 2.2, 'the default need about doubles');
}

// 5. The drawing: key on the peel line, newest layer touching the wall, the band
// left drawn to the tab, arrows on one scale, chart on the model's numbers.
const m = createSardineCanKeyModel(), p = m.topology, MM = p.MM;
const vertex = (object, index) => new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.position, index);
let poses = 0;
m.root.position.set(3, -2, 1);
for (const trial of lesson.tryIt) for (const t of [0, 0.08, 2, 5, 9, 11.95, 12.5, 16]) {
  m.reset();
  m.update(trial.values);
  m.advance(t);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), peel = canPoint(s.woundLength), nx = Math.sin(peel.psi), nz = Math.cos(peel.psi);
  assert.deepEqual(s.values, trial.values);

  const axisX = p.key.position.x / MM, axisZ = p.key.position.z / MM, out = s.coilRadius + p.WITHDRAW * s.keyWithdraw;
  near(wallDistance(axisX, axisZ), out, 1e-9, 'key axis the coil radius out from the wall');
  near(Math.hypot(axisX - peel.x, axisZ - peel.z), out, 1e-9, 'nearest wall point to the key is the peel line');
  near(p.key.position.y / MM, C.bandCenter, 1e-9, 'key at band height');
  assert.ok(s.coilRadius - p.STEM_RADIUS > p.SEAM_OFFSET + p.SEAM_RADIUS, 'stem clears the top seam');
  assert.ok(C.bandCenter + p.LOOP_BASE - p.WIRE_RADIUS > C.height + p.SEAM_RADIUS, 'loop passes above the seam');
  assert.ok(p.CHART.z + 1 < -(C.breadth / 2 + sardineKeyPlan({shank: 3}).rhoFinal + 16 + p.WIRE_RADIUS), 'chart stands clear of the can and the widest key sweep');

  const n = p.coilSegments();
  assert.equal(n > 0, s.theta > 0);
  if (n > 0) {
    if (s.keyWithdraw === 0) {
      const tip = vertex(p.coilMesh, 2 * n).applyMatrix4(p.coilMesh.matrixWorld);
      const wall = new THREE.Vector3(peel.x * MM, (C.bandCenter - C.bandWidth / 2) * MM, peel.z * MM).applyMatrix4(p.system.matrixWorld);
      near(tip.distanceTo(wall), 0, 2e-6, 'newest layer lies on the peel line');
    }
    for (let i = 0; i <= n; i += Math.max(1, Math.floor(n / 40))) {
      const local = vertex(p.coilMesh, 2 * i);
      near(Math.hypot(local.x, local.z) / MM, s.rho0 + h * (s.theta * i / n) / TAU, 1e-4, 'layer at its spiral radius');
    }
    near(Math.abs(vertex(p.coilMesh, 1).y - vertex(p.coilMesh, 0).y) / MM, C.bandWidth, 1e-4, 'coil as tall as the band');
    assert.equal(p.coilMesh.geometry.drawRange.count, n * 6);
  }

  const count = p.bandCount();
  if (s.remainingLength > 1e-9) {
    let drawn = 0;
    for (let i = 1; i < count; i++) drawn += vertex(p.bandMesh, 2 * i).distanceTo(vertex(p.bandMesh, 2 * i - 2));
    near(drawn / MM, s.remainingLength, 0.03, 'drawn band is the band left');
    const first = vertex(p.bandMesh, 0), last = vertex(p.bandMesh, 2 * (count - 1));
    near(Math.hypot(first.x / MM - peel.x, first.z / MM - peel.z), 0, 1e-4, 'band starts at the peel line');
    near(Math.hypot(last.x / MM - canPoint(0).x, last.z / MM - canPoint(0).z), 0, 1e-4, 'band ends at the tab');
    assert.equal(p.bandMesh.geometry.drawRange.count, (count - 1) * 6);
  } else assert.equal(p.bandMesh.visible, false);

  if (!s.freed) {
    const finger = s.stalled ? Math.min(s.values.effort, s.fingerForce) : s.fingerForce;
    near(p.effortArrow.userData.length, finger * p.NEWTON, 1e-9, 'orange arrow is the finger force');
    near(p.pullArrow.userData.length / p.effortArrow.userData.length, s.advantage, 1e-9, 'arrow ratio is the work-conjugate motion advantage');
    const tip = p.pullArrow.position.clone().add(new THREE.Vector3(0, 1, 0).applyQuaternion(p.pullArrow.quaternion).multiplyScalar(p.pullArrow.userData.length));
    near(Math.hypot(tip.x / MM - (peel.x + 0.6 * nx), tip.z / MM - (peel.z + 0.6 * nz)), 0, 1e-6, 'pull arrow ends at the peel line');
    near(p.effortArrow.position.x / MM, s.values.grip, 1e-9, 'finger force at the grip radius');
    near(new THREE.Vector3(0, 1, 0).applyQuaternion(p.effortArrow.quaternion).z, -1, 1e-9, 'finger force square to the loop');
  } else {
    assert.equal(p.effortArrow.visible, false);
    assert.equal(p.pullArrow.visible, false);
  }
  near(p.loop.geometry.parameters.path.points[16].x / MM, s.values.grip, 1e-9, 'loop reaches the grip radius');
  near(p.lid.position.y, s.freed ? s.lidLift * p.LID_LIFT * MM : 0, 1e-12, 'lid lifts only after the band is off');
  if (s.lidLift > 0) {
    assert.equal(s.keyWithdraw, 1);
    assert.ok(wallDistance(axisX, axisZ) - (s.values.grip + p.WIRE_RADIUS) > p.SEAM_OFFSET + p.SEAM_RADIUS, 'withdrawn loop clears the lid');
  }

  near(p.marker.position.x / (p.CHART.width * MM), s.fraction, 1e-9, 'marker at the band fraction');
  near(p.marker.position.y / (p.CHART.height * MM) * p.CHART.maxForce, Math.min(s.fingerForce, p.CHART.maxForce), 1e-9, 'marker at the force needed');
  near(p.availableLine.geometry.attributes.position.getY(0) / (p.CHART.height * MM) * p.CHART.maxForce, Math.min(s.values.effort, p.CHART.maxForce), 1e-5, 'green line at the force available');
  assert.equal(p.stallMarker.visible, s.stallLength !== null);

  m.root.traverse(object => {
    assert.ok(object.matrixWorld.elements.every(Number.isFinite));
    if (object.geometry) for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
  });
  poses++;
}

// Work must match the actual rendered shaft angle, including wall heading.
// This failed before correction: first-corner torque was 80.97 N mm while
// energy per rendered radian was 68.44 N mm.
for(const segment of canSegments()){
  const length=(segment.from+segment.to)/2, values={effort:24};
  const t=(sardineKeyPlan(values).keyAngleAt(length))/(TAU*C.turnRate), dt=1e-5;
  m.reset();m.update(values);m.advance(t-dt);
  const before=m.getState(),angleBefore=p.key.rotation.y;
  m.advance(2*dt);const after=m.getState(),angleAfter=p.key.rotation.y;
  const torque=1000*(after.work-before.work)/(angleAfter-angleBefore);
  near(torque,sampleSardineKey(values,t).torque,1e-6,'virtual work per actual rendered shaft radian');
  near(angleAfter-angleBefore,2*dt*TAU*C.turnRate,1e-9,'constant shaft pace through straight and corner segments');
}
near(standardEndAngle(),sardineKeyPlan({}).thetaTotal+TAU,1e-9,'one additional shaft turn around the can');
function standardEndAngle(){m.reset();m.advance(C.duration);return p.key.rotation.y;}
near(sardineKeyPlan({shank:3}).forceAtEnd,13.338437680625677,1e-9,'thick-shank final effort independently checked');

// 6. Every control moves both the readings and the drawing.
const drawing = () => JSON.stringify([p.key.position.toArray(), p.key.rotation.y, p.effortArrow.userData.length, p.pullArrow.userData.length, p.bandCount(), p.coilSegments(), p.barrel.scale.x,
  p.availableLine.geometry.attributes.position.getY(0), p.curve.geometry.attributes.position.getY(40), p.loop.geometry.parameters.path.points[16].x]);
for (const control of m.controls) {
  const other = control.options ? control.options.find(option => option.value !== control.initial).value : control.initial === control.max ? control.min : control.max;
  m.reset(); m.advance(5);
  const before = [JSON.stringify(m.getState().readings), drawing()];
  m.reset(); m.update({[control.key]: other}); m.advance(5);
  const after = [JSON.stringify(m.getState().readings), drawing()];
  assert.notEqual(after[0], before[0], `${control.key} changes the readings`);
  assert.notEqual(after[1], before[1], `${control.key} changes the drawing`);
  checks += 2;
}

// 7. Every number a trial quotes is the model's number, and nothing else is quoted.
const run = values => { m.reset(); m.update(values); m.advance(C.duration); return m.getState(); };
const standard = run(D);
const corners = canSegments().filter(segment => segment.kind === 'corner');
const stallAt = (s, corner) => near(s.stallLength, corner.to, 1e-9, 'stall where a corner ends');
const claims = {
  'Read the force chart': s => (assert.equal(s.mode,'freed'), {}),
  'Open the default can': s => (assert.equal(s.mode, 'freed'), near(s.peakAt, BAND_LENGTH, 1e-9, 'hardest point at the end'), {'15.9': s.turnsTotal, '6.4': s.forceAtStart, '12.4': s.peakForce, '8.92': s.work}),
  'Start easily, stall on the last side': s => (assert.ok(s.stallLength>corners[3].to&&s.stallLength<BAND_LENGTH), {'6.4': s.forceAtStart, '92': s.fraction * 100, '15.0': s.turns}),
  'Too weak to start': s => (assert.equal(s.mode, 'stalled'), near(s.woundLength, 0, 0, 'nothing wound'), {'6.4': s.forceAtStart}),
  'Stop leaving the second corner': s => (stallAt(s, corners[1]), {'39': s.fraction * 100, '8.0': s.forceAt(s.stallLength - 1e-6), '9.3': s.forceAt(s.stallLength + 1e-6)}),
  'Use a wider loop': s => (near(s.work, standard.work, 1e-12, 'same work'), {'4.0': s.forceAtStart, '7.7': s.forceAtEnd, '1.60': s.fingerTravel / 1000, '1.00': standard.fingerTravel / 1000, '8.92': s.work}),
  'Pinch a small loop': s => (stallAt(s, corners[1]), {'10.7': s.forceAtStart, '20.6': s.forceAtEnd, '15': s.values.effort, '39': s.fraction * 100}),
  'Wind onto a thin shank': s => (assert.equal(s.mode, 'freed'), {'5.4': s.forceAtStart, '17.5': s.turnsTotal, '12.0': s.forceAtEnd, '3.1': s.rhoFinal / s.rho0}),
  'Wind onto a thick shank': s => (assert.equal(s.mode, 'freed'), {'13.3': s.turnsTotal, '8.4': s.forceAtStart}),
  'Score the band deeply': s => (assert.equal(s.mode, 'freed'), {'12': s.tear, '4.7': s.forceAtStart, '8.3': s.forceAtEnd, '6.23': s.work, '2.20': s.bendWork}),
  'Score the band lightly': s => (assert.ok(s.stallLength > corners[2].to && s.stallLength < corners[3].from, 'stall on side after third corner'), near(s.forceAt(s.stallLength), 15, 1e-6, 'need meets 15 N'), {'77': s.fraction * 100, '15': s.values.effort}),
  'Make the band from hard steel': s => (assert.equal(s.mode,'freed'), {'44': s.plasticMoment, '8.6': s.forceAtStart, '14.6': s.forceAtEnd}),
  'Make the band from soft steel': s => (assert.equal(s.mode, 'freed'), {'18': s.plasticMoment, '6.0': s.forceAtStart, '12.0': s.forceAtEnd, '2.20': standard.bendWork, '1.84': s.bendWork}),
  'Beat the toughest band': s => (assert.equal(s.mode, 'freed'), {'6.4': s.forceAtStart, '11.6': s.forceAtEnd, '13.81': s.work}),
};
const numbers = text => text.match(/(?<![A-Za-z\d.])\d+(?:\.\d+)?/g) || [];
assert.deepEqual(Object.keys(claims).sort(), lesson.tryIt.map(trial => trial.title).sort(), 'a claim for every trial');
for (const trial of lesson.tryIt) {
  const values = claims[trial.title](run(trial.values));
  assert.deepEqual([...new Set(numbers(trial.observe))].sort(), Object.keys(values).sort(), `${trial.title}: every quoted number is checked`);
  for (const [text, value] of Object.entries(values)) { assert.equal(fixed(value, (text.split('.')[1] || '').length), text, `${trial.title}: ${text}`); checks++; }
  const settings = new Set(Object.values(trial.values).map(String));
  for (const number of numbers(trial.instruction)) { assert.ok(settings.has(String(Number(number))), `${trial.title}: instruction number ${number} is a setting`); checks++; }
}
{
  const plan = sardineKeyPlan({}), deeper = lesson.deeper.map(section => section.body).join(' ');
  const quoted = {'4.8 to 1': fixed(plan.values.grip / plan.rho0, 1) + ' to 1', '2.0 to 1': fixed(plan.values.grip / plan.rhoFinal, 1) + ' to 1', '2.10 mm': fixed(plan.rho0, 2) + ' mm', '5.08 mm': fixed(plan.rhoFinal, 2) + ' mm',
    '14.9 turns': fixed(plan.windingTurnsTotal, 1) + ' turns', '15.9 turns': fixed(plan.turnsTotal, 1) + ' turns', '22 N·mm': fixed(plan.plasticMoment, 0) + ' N·mm', '73 mm': fixed(200000 * h / (2 * 275), 0) + ' mm',
    '14 to 35 times': `${fixed(Math.floor(200000 * h / (2 * 275) / plan.rhoFinal), 0)} to ${fixed(Math.ceil(200000 * h / (2 * 275) / plan.rho0), 0)} times`,
    '165 N·mm': fixed(275 * 60 * h * h / 4, 0) + ' N·mm'};
  for (const [text, computed] of Object.entries(quoted)) { assert.equal(computed, text, `deeper number ${text}`); assert.ok(deeper.includes(text), `deeper text quotes ${text}`); checks++; }
}

// 8. Playback, stalls, inspection points and the freed lid.
m.reset(); m.playback.step();
near(m.getState().turns, 0.1, 1e-12, 'a step is a tenth of a turn');
m.reset();
assert.equal(m.playback.complete(), false);
assert.equal(m.resultPart.available(), false);
m.advance(sardineKeyPlan({}).freedTime - 1e-6);
assert.equal(m.getState().freed, false); assert.equal(p.bandMesh.visible, true);
m.advance(2e-6);
assert.equal(m.getState().freed, true); assert.equal(p.bandMesh.visible, false); assert.equal(m.resultPart.available(), false);
m.advance(C.withdrawDuration);
near(m.getState().keyWithdraw, 1, 1e-12, 'key clear before the lid moves'); near(m.getState().lidLift, 0, 1e-9, 'lid still down');
m.advance(C.liftDuration);
assert.equal(m.playback.complete(), true); assert.equal(m.resultPart.available(), true);
m.reset(); m.update({effort: 6});
assert.equal(m.playback.complete(), false, 'a key that cannot start still lets Play run');
m.advance(0.05);
assert.equal(m.playback.complete(), true, 'a stall ends the trial'); near(m.getState().woundLength, 0, 0, 'nothing wound');
m.reset(); m.update({effort: 12}); m.advance(C.duration);
assert.equal(m.playback.complete(), true); assert.equal(m.resultPart.available(), false);
for (const [i, fraction] of [0, 0.25, 0.5, 0.75, 1].entries()) {
  m.reset(); m.actions[i].run();
  near(m.getState().fraction, fraction, 1e-9, m.actions[i].label);
  if (fraction === 1) near(m.getState().lidLift, 1, 1e-12, 'inspected lid is lifted');
}
m.reset(); m.advance(2);
const bounds = m.frameBoundsForPart('system');
m.root.updateMatrixWorld(true);
p.key.traverse(object => {
  if (!object.isMesh || !object.visible) return;
  const positions = object.geometry.attributes.position, count = object.geometry.drawRange.count === Infinity ? positions.count : positions.count;
  for (let i = 0; i < count; i += 7) assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld)), 'framing contains the key');
});

// 9. Bad input is refused.
for (const [key, [lo, hi, step]] of Object.entries(SARDINE_KEY_DOMAINS)) for (const bad of [NaN, Infinity, lo - step, hi + step, lo + step / 3]) assert.throws(() => sampleSardineKey({[key]: bad}), RangeError);
for (const bad of [null, [], 'x']) assert.throws(() => sampleSardineKey(bad), TypeError);
assert.throws(() => sampleSardineKey({wrong: 1}), RangeError);
for (const bad of [-1, NaN, Infinity]) assert.throws(() => sampleSardineKey({}, bad), RangeError);

// 10. Every geometry and material is disposed exactly once.
const resources = new Set();
m.root.traverse(object => {
  if (object.geometry) resources.add(object.geometry);
  for (const material of object.material ? [].concat(object.material) : []) { resources.add(material); if (material.map) resources.add(material.map); if (material.gradientMap) resources.add(material.gradientMap); }
});
const disposals = new Map([...resources].map(resource => [resource, 0]));
for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
m.dispose(); m.dispose();
assert.ok([...disposals.values()].every(count => count === 1), 'every geometry and material disposed once');

console.log(`PASS sardine-can key model: ${checks} checks, ${marches} marches, ${poses} poses, ${lesson.tryIt.length} trials, ${resources.size} resources`);

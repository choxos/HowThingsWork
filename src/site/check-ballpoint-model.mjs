import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ballpointPlan, ballpointAt, BALL_SIZES, BALLPOINT_DEFAULTS, BALLPOINT_DOMAINS, sampleBallpoint} from './pens-physics.js';
import {createBallpointModel, MM, DETAIL, SOCKET_PROFILE, SPECKS} from './ballpoint-model.js';
import {ballpointLesson as lesson} from './pens-lessons.js';
import {tally, checkRefusals, checkDisposal, checkFinite} from './model-check-kit.mjs';
const t = tally(), m = createBallpointModel(), B = m.topology;
let poses = 0, rolls = 0, filmChecks = 0, pressureChecks = 0, socketChecks = 0;
const span = mesh => [mesh.position.x - mesh.scale.x / 2, mesh.position.x + mesh.scale.x / 2];
const reset = (values, time) => {m.reset({settings: values, time}); m.root.updateMatrixWorld(true); return m.getState();};
for (const ball of BALL_SIZES) for (let place = 0; place < 4; place++) for (let refill = 0; refill < 2; refill++) for (let condition = 0; condition < 3; condition++) {
  const values = {ball, place, refill, condition}, radius = ball / 2, halfTurn = Math.PI * radius;
  // Independently derive length by integrating whether the paper contact is inked.
  const times = [0, .001, .05, halfTurn / 10 - 1e-7, halfTurn / 10, halfTurn / 10 + 1e-7, .5, 2.5, 5, 9];
  for (const seconds of times) {
    const s = reset(values, seconds), x = Math.min(seconds, 5) * 10, primed = condition !== 1, fed = condition !== 2;
    const start = primed ? 0 : halfTurn, end = fed ? x : Math.min(x, halfTurn), length = Math.max(0, end - start);
    t.near(s.now.travel, x, 1e-12, 'constant stroke speed with finite endpoint');
    t.near(s.now.turns, x / (2 * Math.PI * radius), 1e-12, 'distance divided by circumference');
    t.near(s.now.line, length, 1e-12, 'inked interval from selected initial film and supply');
    t.near(B.carriage.position.x / MM, x, 1e-10, 'whole pen follows the contact point');
    t.near(B.ball.position.y / MM, radius, 1e-12, 'ball tangent to the paper');
    t.near(B.bigBall.rotation.z, -x / radius, 1e-10, 'enlarged ball has matching rotation');
    t.near(B.bigBall.scale.x, radius * MM * DETAIL, 1e-12, 'declared enlargement');
    t.ok(B.line.visible === (length > 0), 'only positive inked intervals are drawn');
    if (length > 0) {
      const [lo, hi] = span(B.line); t.near(lo / MM, start, 1e-10, 'line start'); t.near(hi / MM, end, 1e-10, 'line end, including residual film ending before the pen');
    }
    t.ok(B.channelInk.visible === fed && B.bigInk.visible === fed, 'one connected or blocked supply in both views');
    t.ok(B.channelBlock.visible === !fed && B.bigBlock.visible === !fed, 'same imposed block in both views');
    t.ok(B.float.visible === Boolean(refill) && B.gas.visible === Boolean(refill) && B.seal.visible === Boolean(refill), 'sealed refill components only with gas comparison');
    const head = [588.6, 0, -588.6, 0][place];
    t.near(s.head, head, 1e-10, 'signed hydrostatic head');
    t.near(s.now.feedPressure, head + refill * 200000, 1e-9, 'gauge gas pressure plus gravity contribution'); pressureChecks++;
    B.specks.forEach((speck, i) => {
      // Locate the last top crossing of this material point without using the model's phase helper.
      const original = Math.PI * 2 * i / SPECKS, rotated = x / radius;
      const revolutions = Math.floor((rotated - original) / (2 * Math.PI));
      const lastTop = (original + revolutions * 2 * Math.PI) * radius;
      const sinceTop = x - lastTop;
      const inked = sinceTop <= halfTurn + 1e-12 && (lastTop >= -1e-12 ? fed : primed);
      t.ok((speck.material === B.inkMaterial) === inked, 'surface marker remembers supply at its most recent pickup'); filmChecks++;
    });
    const bounds = m.frameBoundsForPart('system');
    for (const mesh of [B.ball, B.rearPlug, B.sheet, B.bigSphere, B.bigPaper, B.bigSocket, B.weightArrow, B.shareArrow, B.zeroHead]) {
      if (!mesh.visible) continue;
      const box = new THREE.Box3().setFromObject(mesh);
      t.ok(bounds.clone().expandByScalar(.002).containsBox(box), `motion frame encloses geometry: ${JSON.stringify({values, seconds, mesh: Object.keys(B).find(k => B[k] === mesh), bounds: [bounds.min.toArray(),bounds.max.toArray()],box:[box.min.toArray(),box.max.toArray()]})}`);
    }
    t.ok(s.readings.every(r => !/NaN|undefined|Infinity/.test(r.value + (r.hint || ''))), 'finite explanatory readings');
    poses++;
  }
  for (const seconds of [.05, 1.7, 4.1]) {
    reset(values, seconds);
    const turn = -B.ball.rotation.z, contact = new THREE.Vector3(Math.sin(turn), -Math.cos(turn), 0);
    const before = B.ball.localToWorld(contact.clone()), center = B.ball.localToWorld(new THREE.Vector3());
    m.advance(1e-6); m.root.updateMatrixWorld(true);
    const after = B.ball.localToWorld(contact.clone()), moved = B.ball.localToWorld(new THREE.Vector3()).distanceTo(center);
    t.near(moved, 1e-7, 1e-12, 'center moves at 10 mm/s');
    t.ok(after.distanceTo(before) < 1e-4 * moved, 'contact point has zero instantaneous velocity on paper'); rolls++;
  }
  reset(values, 0); for (let i = 0; i < 50; i++) m.playback.step();
  t.ok(m.playback.complete(), 'fifty steps reach the endpoint without floating-point replay failure');
  assert.deepEqual(m.getState().now, ballpointAt(ballpointPlan(values), 5));
  const before = JSON.stringify({values: m.getState().values, now: m.getState().now});
  for (const action of m.actions) {action.run(); t.ok(before === JSON.stringify({values: m.getState().values, now: m.getState().now}), 'inspection preserves time and settings');}
  m.reset(m.replayState()); assert.deepEqual(m.getState().values, values); t.near(m.getState().clock, 0, 0, 'replay retains settings and clears the stroke');
}
// The socket's inner wall must remain outside the unit ball along every segment.
for (let i = 0; i < 6; i++) for (let j = 0; j <= 100; j++) {
  const [ax, ay] = SOCKET_PROFILE[i], [bx, by] = SOCKET_PROFILE[i + 1], u = j / 100;
  const x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
  t.ok(x * x + y * y >= 1 - 1e-12, 'socket wall does not cut through the rolling ball'); socketChecks++;
}
t.ok(SOCKET_PROFILE[0][0] < 1 && SOCKET_PROFILE[0][1] < 0, 'lower lip retains the ball below its equator');
const expected = [50, 50, 50, 0, 50 - Math.PI * .35, .5, Math.PI * .35, 50, 50, 50, Math.PI * .35, 50];
for (const [i, trial] of lesson.tryIt.entries()) {
  const s = reset(trial.values, trial.initialState.time);
  t.near(s.now.line, expected[i], 1e-10, `${trial.title}: named observed ink length`);
  t.ok(m.parts.some(p => p.id === trial.part), 'preset targets a real part');
  assert.deepEqual(s.values, trial.values);
}
for (const ball of BALL_SIZES) {
  const p = ballpointPlan({ball});
  for (const condition of [0, 1, 2]) {
    const plan = ballpointPlan({ball, condition});
    const n = 20000, dx = 50 / n; let integral = 0;
    for (let i = 0; i < n; i++) {const x = (i + .5) * dx; if (condition === 0 || (condition === 1 ? x > Math.PI * ball / 2 : x < Math.PI * ball / 2)) integral += dx;}
    t.near(ballpointAt(plan, 5).line, integral, dx, 'independent midpoint integration of inked contact');
  }
  t.near(p.turns * Math.PI * ball, 50, 1e-12, 'reconstructed stroke');
}
checkRefusals(sampleBallpoint, BALLPOINT_DOMAINS, t);
assert.throws(() => ballpointPlan({ball: .31}), RangeError);
reset(BALLPOINT_DEFAULTS, 0); checkFinite(m.root, t); m.dispose();
const resources = checkDisposal(createBallpointModel(), t);
console.log(`PASS ballpoint: ${t.count} checks; ${poses} poses, ${rolls} rolling contacts, ${filmChecks} film markers, ${pressureChecks} pressure states, ${socketChecks} socket-clearance samples, ${lesson.tryIt.length} named observations, ${resources} resources.`);

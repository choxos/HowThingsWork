// Checks the door closer model and its lesson against the sources typed in
// again and the physics worked out by other routes: the leaf's moment of
// inertia integrated slice by slice, the spring's energy integrated from its
// moment, the orifice's pressure rebuilt from Cd A sqrt(2 dP / rho), the whole
// swing integrated again by a different scheme at a fifth of the step, the
// sweep speed found from the balance between spring and orifice, and every
// energy the swing spends audited against the work the hand put in. Then the
// drawing is read back from geometry at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './door-closer-physics.js';
import * as M from './door-closer-model.js';
import {doorCloserLesson as L} from './door-closer-lesson.js';
import {utilityLessons} from './utility-lessons.js';

const t = tally();
const counts = {steps: 0, poses: 0, points: 0, numbers: 0, slices: 0, settings: 0};
const f0 = v => fixed(v, 0), f1 = v => fixed(v, 1), f2 = v => fixed(v, 2), f3 = v => fixed(v, 3);
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-15;
const RADIAN = Math.PI / 180;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and what follows from them.
// ---------------------------------------------------------------------------

const SRC = {
  // BS EN 1154 table 1, from the dhf Best Practice Guide: power size, recommended
  // maximum door leaf width in mm, test door mass in kg.
  table: [[1, 750, 20], [2, 850, 40], [3, 950, 60], [4, 1100, 80], [5, 1250, 100], [6, 1400, 120], [7, 1600, 160]],
  // The same guide's other grades.
  grades: {three: 105, four: 180, delayed: 120, delaySeconds: 25, cycles: 500000, fireSize: 3},
  // DIN 18040, by reference to DIN EN 1154: a size 3 closer's opening moment,
  // measured at the closer over 0 to 60 degrees.
  size3: {moment: 47, angle: 60},
  // The Door closer page: the latch speed runs over the last 10 to 15 degrees.
  latchWindow: [10, 15],
  // dormakaba TS 83: the back check answers beyond about 70 degrees; the body is
  // 245 mm long and 60 mm high.
  backcheck: 70, body: [245, 60],
  // LCN 4040XP: a 1 and 1/2 inch piston, and the accessibility pair.
  inch: 25.4, bore: 1.5, ada: {seconds: 5, pounds: 5, newton: 4.4482216152605},
  // Wikipedia: an orifice's discharge coefficient is typically 0.6 to 0.85, and
  // mineral oil is 0.8 to 0.87 g/cm3. Standard gravity is exact.
  discharge: [0.6, 0.85], oil: [800, 870], gravity: 9.80665,
};

assert.deepEqual(P.EN1154.map(row => [row.size, row.width, row.mass]), SRC.table);
t.add(1);
t.ok(P.GRAVITY === SRC.gravity, 'standard gravity, 9.80665 m/s²');
t.ok(P.SIZE3.size === 3 && P.SIZE3.moment === SRC.size3.moment && P.SIZE3.angle === SRC.size3.angle, 'a size 3 closer opens at no more than 47 N.m over 0 to 60 degrees');
t.ok(P.ANGLES.latch >= SRC.latchWindow[0] && P.ANGLES.latch <= SRC.latchWindow[1], 'the latch valve takes over inside the last 10 to 15 degrees');
t.ok(P.ANGLES.backcheck === SRC.backcheck, 'the back check answers past 70 degrees');
t.ok(P.ANGLES.stop === SRC.grades.delayed && P.GRADES.delayed === SRC.grades.delayed && P.GRADES.delaySeconds === SRC.grades.delaySeconds, 'the stop and the delayed action angle are the standard’s 120 degrees, cleared in under 25 s');
t.ok(P.GRADES.three === SRC.grades.three && P.GRADES.four === SRC.grades.four && P.GRADES.cycles === SRC.grades.cycles && P.GRADES.fireSize === SRC.grades.fireSize, 'grade 3 from 105 degrees, grade 4 from 180, grade 8 at 500,000 cycles, and at least size 3 on a fire door');
t.near(P.CLOSER.bore * 1000, SRC.bore * SRC.inch, 1e-9, 'a 1 and 1/2 inch piston is 38.1 mm');
t.ok(P.CLOSER.discharge >= SRC.discharge[0] && P.CLOSER.discharge <= SRC.discharge[1], 'the discharge coefficient sits inside the page’s 0.6 to 0.85');
t.ok(P.CLOSER.density >= SRC.oil[0] && P.CLOSER.density <= SRC.oil[1], 'the oil sits inside mineral oil’s 0.8 to 0.87 g/cm³');
t.near(P.ADA.seconds, SRC.ada.seconds, 1e-12, 'at least 5 s from 90 degrees to 12 degrees from the latch');
t.near(P.ADA.newtons, SRC.ada.pounds * SRC.ada.newton, 1e-12, '5 lbf is 22.24 N');
assert.deepEqual([M.CLOSERVIEW.length, M.CLOSERVIEW.height], SRC.body);
t.add(1);
assert.deepEqual(JSON.parse(JSON.stringify(P.DOOR_DOMAINS)), {door: [1, 7, 1], size: [1, 7, 1], sweep: [0.15, 0.6, 0.05], latch: [0.15, 0.9, 0.05], backcheck: [0, 1, 1], open: [30, 110, 10], push: [25, 150, 5]});
assert.deepEqual({...P.DOOR_DEFAULTS}, {door: 3, size: 3, sweep: 0.3, latch: 0.45, backcheck: 1, open: 80, push: 60});
t.add(2);
assert.deepEqual(P.DOOR_OPTIONS.map(o => [o.value, o.label]), SRC.table.map(([size, width, mass]) => [size, `${width} mm, ${mass} kg`]));
assert.deepEqual(P.SIZE_OPTIONS.map(o => [o.value, o.label]), SRC.table.map(([size]) => [size, `EN ${size}`]));
t.add(2);

// The leaf's moment of inertia, integrated slice by slice rather than taken
// from a table: a uniform leaf of width b has m b² / 3 about its hinge.
for (const [, width, mass] of SRC.table) {
  const b = width / 1000, slices = 20000;
  let sum = 0;
  for (let i = 0; i < slices; i++) { const r = b * (i + 0.5) / slices; sum += (mass / slices) * r * r; counts.slices++; }
  t.near(P.inertiaOf(mass, b), sum, relative(sum, 1e-6), `${width} mm and ${mass} kg: m b²/3 slice by slice`);
}

// The spring: affine in the angle, anchored on the one sourced moment, and its
// energy is the integral of its moment, found here by Simpson's rule.
const simpson = (fn, a, b, n = 4000) => { const h = (b - a) / n; let sum = 0; for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * fn(a + i * h); return sum * h / 3; };
t.near(P.peakMomentOf(3), SRC.size3.moment, 1e-12, 'size 3 is the sourced 47 N.m at 60 degrees');
for (const [size, , mass] of SRC.table) {
  t.near(P.peakMomentOf(size), SRC.size3.moment * mass / 60, relative(SRC.size3.moment, 1e-12), `size ${size} is scaled from size 3 by its tabulated test door mass`);
  t.near(P.springMoment(size, 0), P.peakMomentOf(size) / 2, 1e-12, `size ${size}: half the 60 degree moment stands as preload`);
  t.near(P.springMoment(size, SRC.size3.angle * RADIAN), P.peakMomentOf(size), 1e-12, `size ${size}: the whole of it at 60 degrees`);
  for (const degrees of [0, 20, 45, 60, 90, 120]) {
    const theta = degrees * RADIAN;
    t.near(P.springEnergy(size, theta), simpson(a => P.springMoment(size, a), 0, theta), relative(Math.max(1e-6, P.springEnergy(size, theta)), 1e-9), `size ${size} at ${degrees}°: the energy is the integral of the moment`);
    // A straight line through two points is the only affine function through them.
    t.near(P.springMoment(size, theta), P.springMoment(size, 0) + (P.peakMomentOf(size) - P.springMoment(size, 0)) * degrees / SRC.size3.angle, 1e-12, 'affine in the angle');
  }
}

// The orifice, rebuilt from the page's own equation: a flow Q through an area A
// with a discharge coefficient Cd needs a pressure dP where Q = Cd A sqrt(2 dP / rho).
const piston = Math.PI * P.CLOSER.bore ** 2 / 4;
t.near(P.pistonArea(), piston, relative(piston, 1e-12), 'the piston face is pi d²/4');
for (const millimeters of [0.15, 0.3, 0.45, 0.6, 0.7, 0.9, 3]) {
  const area = Math.PI * (millimeters / 1000) ** 2 / 4;
  t.near(P.orificeArea(millimeters), area, relative(area, 1e-12), `${millimeters} mm across is pi d²/4`);
  for (const omega of [0.05, 0.2, 0.5, 1.5]) {
    const flow = piston * P.CLOSER.pinion * omega;
    const speed = flow / (P.CLOSER.discharge * area);
    const drop = P.CLOSER.density * speed * speed / 2;
    t.near(P.pressureOf(omega, millimeters), drop, relative(drop, 1e-9), `${millimeters} mm at ${omega} rad/s: the pressure a jet of that speed carries`);
    // And the moment that pressure makes on the piston, through the pinion.
    t.near(P.dampingOf(millimeters) * omega * omega, drop * piston * P.CLOSER.pinion, relative(drop * piston * P.CLOSER.pinion, 1e-9), 'the damping moment is that pressure on the piston at the pinion radius');
  }
  t.near(P.dampingOf(millimeters / Math.SQRT2), 4 * P.dampingOf(millimeters), relative(4 * P.dampingOf(millimeters), 1e-9), 'dividing the diameter by root two halves the area and quadruples the damping, which is the inverse square of the area');
}
t.near(P.dampingOf(0.15) / P.dampingOf(0.3), 16, 1e-9, 'halving the diameter multiplies the damping by sixteen');
t.ok(f1(P.dampingOf(0.3)) === '580.0' && f1(P.dampingOf(0.15)) === '9,279.5', 'the two figures the lesson quotes');
t.near(P.latchMomentOf(950), P.LATCH_FORCE * 0.95, 1e-12, '20 N at the leading edge of a 950 mm leaf');

// The whole swing, integrated again by Heun's method at a fifth of the step.
function march(values) {
  const v = {...P.DOOR_DEFAULTS, ...values};
  const leaf = P.EN1154[v.door - 1], inertia = P.inertiaOf(leaf.mass, leaf.width / 1000);
  const latchMoment = P.latchMomentOf(leaf.width), release = v.open * RADIAN;
  const stop = P.ANGLES.stop * RADIAN, engage = P.ANGLES.engage * RADIAN;
  const step = P.CLOCK.step / 5;
  const rate = (angle, speed, pushing, closing) => {
    const spring = P.springMoment(v.size, angle);
    const hole = pushing || speed > 0
      ? (v.backcheck === 1 && angle >= P.ANGLES.backcheck * RADIAN ? P.ORIFICES.backcheck : P.ORIFICES.bypass)
      : (angle <= P.ANGLES.latch * RADIAN ? v.latch : v.sweep);
    const damp = P.dampingOf(hole) * speed * Math.abs(speed);
    const friction = P.FRICTION.hinge * Math.tanh(speed / P.FRICTION.ease);
    const latch = closing && angle <= engage && speed < 0 ? latchMoment : 0;
    return ((pushing ? v.push : 0) - spring - damp - friction + latch) / inertia;
  };
  let theta = 0, omega = 0, time = 0, opening = true, taken = 0;
  const every = Math.round(P.CLOCK.sample / step);
  let peak = 0, peakAt = null, latchedAt = null, stalledAt = null, stalledAngle = null, hitStop = null, stopSpeed = 0, arrival = 0;
  const samples = [];
  if (v.push <= P.springMoment(v.size, 0) + P.FRICTION.hinge) return {theta, opens: false, samples, peak, peakAt, latchedAt, stalledAt, stalledAngle, hitStop, stopSpeed, arrival};
  while (time < P.CLOCK.limit) {
    const pushing = opening && theta < release, closing = !opening;
    const a1 = rate(theta, omega, pushing, closing);
    const pTheta = theta + step * omega, pOmega = omega + step * a1;
    const a2 = rate(pTheta, pOmega, pushing, closing);
    theta += step / 2 * (omega + pOmega);
    omega += step / 2 * (a1 + a2);
    taken += 1;
    time = taken * step;
    counts.steps++;
    if (opening) {
      if (theta >= stop) { theta = stop; hitStop = time; stopSpeed = Math.max(0, omega); omega = 0; opening = false; peak = stop; peakAt = time; }
      else if (omega <= 0) { omega = 0; opening = false; peak = theta; peakAt = time; }
      else peak = Math.max(peak, theta);
    } else if (theta <= 0) { arrival = -omega; theta = 0; omega = 0; latchedAt = time; }
    else if (omega >= -P.CLOCK.still && P.springMoment(v.size, theta) - P.FRICTION.hinge - (theta <= engage ? latchMoment : 0) <= 0) { omega = 0; stalledAt = time; stalledAngle = theta; }
    if (taken % every === 0) samples.push([taken / every * P.CLOCK.sample, theta, omega]);
    if (latchedAt !== null || stalledAt !== null) break;
  }
  return {theta, opens: true, samples, peak, peakAt, latchedAt, stalledAt, stalledAngle, hitStop, stopSpeed, arrival};
}

const settings = [
  {}, {sweep: 0.15}, {sweep: 0.6}, {latch: 0.15}, {latch: 0.9}, {backcheck: 0}, {push: 150}, {push: 150, backcheck: 0},
  {push: 25}, {open: 30}, {open: 110}, {size: 1}, {size: 2}, {size: 7}, {door: 1}, {door: 7}, {door: 7, latch: 0.15}, {door: 5, size: 2},
];
for (const values of settings) {
  const plan = P.doorPlan(values), again = march(values);
  counts.settings++;
  t.ok(plan.opens === again.opens, `${JSON.stringify(values)}: the door opens, or does not, either way round`);
  if (!plan.opens) { t.ok(plan.peakAt === null && plan.latchedAt === null && plan.stalledAt === null && plan.duration === P.CLOCK.hold, 'a door that never moves has no peak, no latch and no stall'); continue; }
  t.near(plan.peak, again.peak, 3e-3, `${JSON.stringify(values)}: the farthest the door opens, marched again`);
  t.near(plan.peakAt, again.peakAt, 0.02, 'and when it gets there');
  t.ok((plan.latchedAt === null) === (again.latchedAt === null) && (plan.stalledAt === null) === (again.stalledAt === null), 'the same ending');
  if (plan.latchedAt !== null) {
    t.near(plan.latchedAt, again.latchedAt, Math.max(0.05, 0.01 * again.latchedAt), 'the time it latches');
    t.near(plan.arrival, again.arrival, Math.max(2e-3, 0.03 * again.arrival), 'and the speed it arrives at');
  } else {
    t.near(plan.stalledAngle, again.stalledAngle, 2e-3, 'the angle it stops short at');
  }
  t.ok((plan.hitStop === null) === (again.hitStop === null), 'the stop is reached, or it is not');
  if (plan.hitStop !== null) t.near(plan.stopSpeed, again.stopSpeed, Math.max(2e-3, 0.02 * again.stopSpeed), 'at the same speed');
  // The trace, against the independent march at the times it samples.
  for (const [time, theta] of again.samples) {
    const at = P.doorAt(plan, time);
    t.near(at.theta, theta, 6e-3, `${JSON.stringify(values)} at ${f2(time)} s: the trace follows the march`);
    counts.points++;
  }
  // Nothing in the state is a non-number, and nothing is ever past the stop.
  for (const value of [plan.peak, plan.duration, plan.oilHeat, plan.frictionHeat, plan.latchWork, plan.handWork, plan.stored, plan.inertia, plan.peakPressure]) t.ok(Number.isFinite(value) && value >= 0, 'every figure in the plan is a finite, non-negative number');
  t.ok(plan.peak <= P.ANGLES.stop * RADIAN + 1e-12, 'the door never passes its stop');
  t.ok(plan.angles.every(angle => angle >= -1e-12 && angle <= P.ANGLES.stop * RADIAN + 1e-12), 'and nothing on the trace does either');
  t.ok(plan.sweepTime === null || plan.sweepTime > 0, 'a sweep time is a time or nothing at all');
  t.ok((plan.sweepTime === null) === !(plan.peak > P.ANGLES.from * RADIAN), 'the sweep is timed exactly when the door passed 90 degrees');

  // The energy audit: what the hand put in is what the swing spent, with what
  // the spring still holds if the door stopped short.
  const spent = plan.oilHeat + plan.frictionHeat + plan.latchWork + plan.stopLoss + plan.arrivalEnergy + plan.residual;
  t.near(plan.handWork, spent, Math.max(0.02, 3e-4 * plan.handWork), `${JSON.stringify(values)}: the hand's work is the oil, the friction, the bolt, the stop, the bang and what is still held`);
  t.near(plan.handWork, plan.values.push * plan.release, 5e-3 * plan.handWork + 1e-6, 'and the hand’s work is its moment through the angle it pushed');
  t.near(plan.stored, P.springEnergy(plan.size, plan.peak), relative(plan.stored, 1e-9), 'the spring holds the integral of its moment at the top of the arc');
  t.ok(plan.oilHeat > plan.frictionHeat, 'the oil takes more than the friction does');

  // Quasi-steady sweep: in the middle of the sweep the spring and the orifice
  // are in balance, so the speed is sqrt(spring / damping).
  if (plan.sweepTime !== null) {
    const middle = P.doorAt(plan, (plan.peakAt + (plan.latchedAt ?? plan.stalledAt ?? plan.ended)) / 2);
    if (middle.degrees > P.ANGLES.latch + 5 && middle.degrees < P.ANGLES.from) {
      const balance = Math.sqrt(P.springMoment(plan.size, middle.theta) / P.dampingOf(plan.values.sweep));
      t.near(Math.abs(middle.omega), balance, 0.12 * balance, `${JSON.stringify(values)}: mid sweep the door runs at the speed the spring and the orifice agree on`);
    }
  }
}
{
  // Four times the damping is half the sweep speed, so the sweep time doubles.
  const [wide, narrow] = [0.6, 0.3].map(sweep => P.doorPlan({sweep}));
  t.near(narrow.sweepTime / wide.sweepTime, Math.sqrt(P.dampingOf(0.3) / P.dampingOf(0.6)), 0.06 * narrow.sweepTime / wide.sweepTime, 'the sweep time grows as the square root of the damping');
  const slower = P.doorPlan({sweep: 0.15});
  t.near(slower.sweepTime / narrow.sweepTime, 4, 0.12, 'and halving the orifice takes four times as long');
  t.ok(P.doorPlan({sweep: 0.6}).sweepTime < P.ADA.seconds && P.doorPlan({}).sweepTime >= P.ADA.seconds, 'wide open the door is quicker than an accessible door may be; at its default setting it is not');
}
{
  // Sizes 1 and 2 cannot hold the bolt on their own tabulated leaf, which is
  // what the standard says when it keeps them off fire doors.
  for (const [size, width] of SRC.table) {
    const holds = P.springMoment(size, 0) >= P.latchMomentOf(width) + P.FRICTION.hinge;
    t.ok(holds === (size >= SRC.grades.fireSize), `size ${size} ${holds ? 'holds' : 'does not hold'} the bolt on its own tabulated leaf standing still`);
  }
  const weak = P.doorPlan({size: 1});
  t.ok(!weak.latched && weak.stalledAngle > 0 && weak.residual > 0, 'the weakest closer leaves the door ajar with the spring still pushing');
  t.near(weak.residual, P.springEnergy(1, weak.stalledAngle), relative(weak.residual, 1e-9), 'and what it still holds is the integral of its moment at that angle');
  t.ok(P.doorPlan({door: 7}).latched && !P.doorPlan({door: 7, latch: 0.15}).latched, 'a wide door latches on the speed it arrives with, and not when the latch valve takes that away');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createDoorCloserModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
t.ok(M.timesLarger(M.PLAN) === 1 && Math.abs(M.timesLarger(M.BODY) - 6) < 1e-9 && Math.abs(M.timesLarger(M.HOLE) - 500) < 1e-9, 'the three scales the text states: the plan at 1, the closer 6 times larger, the orifices 500');
t.near(1 / M.PLAN, 1000, 1e-9, 'one scene unit to 1,000 mm in plan');

for (const values of settings) {
  const plan = P.doorPlan(values), W = plan.leaf.width * M.PLAN;
  for (const time of [0, 0.4, plan.duration / 3, plan.duration / 2, plan.duration]) {
    model.reset();
    model.update(values);
    model.advance(time);
    model.root.updateMatrixWorld(true);
    const now = P.doorAt(plan, time), state = model.getState();
    counts.poses++;

    // The leaf: turned to the angle the trace gives, and as long as the table says.
    t.near(T.leafGroup.rotation.z, now.theta, 1e-12, 'the leaf turned to the angle the physics gives');
    t.near(T.leaf.scale.x, W, 1e-12, `a leaf ${plan.leaf.width} mm long at 1 unit to 1,000 mm`);
    t.near(T.leaf.scale.y, M.FRAME.leaf * M.PLAN, 1e-12, 'and as thick as the leaf is');
    t.near(T.leaf.position.x, W / 2, 1e-12, 'reaching from the hinge to its leading edge');
    const corners = M.leafCorners(plan.leaf.width, now.theta);
    for (const [x, y] of corners) {
      t.ok(Math.hypot(x, y) <= W + M.FRAME.leaf * M.PLAN, 'every corner of the leaf within its own length of the hinge');
      t.ok(y >= -M.FRAME.leaf * M.PLAN, 'and none of it behind the wall it hangs on');
      counts.points++;
    }

    // The bolt travels with the leading edge, and sticks out further once home.
    const home = plan.latched && Math.min(time, plan.duration) >= plan.latchedAt;
    t.near(Math.hypot(T.bolt.position.x, T.bolt.position.y), W + (home ? 0.05 : 0.026) / 2, 1e-9, 'the bolt at the leading edge');
    t.near(T.bolt.rotation.z, now.theta, 1e-12, 'turned with the leaf');
    t.ok(T.bolt.material.color.getHex() === (home ? M.COLORS.home : plan.stalledAt !== null && time >= plan.stalledAt ? M.COLORS.ajar : M.COLORS.bolt), 'the bolt colored for home, ajar or waiting');

    // The arrows: the hand's only while it pushes, the closer's on one scale.
    t.near(T.effort.userData.length, now.pushing ? plan.values.push * M.ARROW.per : 0, 1e-12, now.pushing ? 'the hand’s arrow as long as its moment' : 'no hand arrow once it has let go');
    t.near(T.delivered.userData.length, time > 0 ? now.moment * M.ARROW.per : 0, 1e-12, 'the closer’s arrow as long as its moment, on the same scale');
    const pointing = new THREE.Vector3(0, 1, 0).applyQuaternion(T.delivered.quaternion);
    const tangent = [-Math.sin(now.theta), Math.cos(now.theta)];
    t.near(pointing.x, -tangent[0], 1e-9, 'the closer’s arrow pointing the way the door closes');
    t.near(pointing.y, -tangent[1], 1e-9, 'across the leaf, not along it');
    if (now.pushing) {
      const pushing = new THREE.Vector3(0, 1, 0).applyQuaternion(T.effort.quaternion);
      t.near(pushing.x, tangent[0], 1e-9, 'and the hand’s arrow the other way');
      t.ok(Math.abs(pushing.x * Math.cos(now.theta) + pushing.y * Math.sin(now.theta)) < 1e-9, 'square to the leaf, which is what a moment about the hinge means');
    }

    // The closer: the piston where the pinion has carried it.
    const L = M.CLOSERVIEW.length * M.BODY, wall = M.CLOSERVIEW.wall * M.BODY, bore = P.CLOSER.bore * 1000 * M.BODY;
    const travel = P.CLOSER.pinion * 1000 * M.BODY * now.theta;
    const face = -L / 2 + wall + M.CLOSERVIEW.spare * M.BODY + travel;
    t.near(T.piston.position.x, face + wall / 2, 1e-12, 'the piston carried along by the pinion radius times the door angle');
    t.near(T.piston.scale.y, bore, 1e-12, 'a piston the width of the bore');
    t.ok(T.piston.position.x - wall / 2 >= -L / 2 + wall - 1e-9 && T.piston.position.x + wall / 2 <= L / 2 - wall + 1e-9, 'and never outside the body');
    t.near(T.chamberBack.scale.x, face - (-L / 2 + wall), 1e-9, 'the oil behind the piston as wide as the room left behind it');
    t.near(T.chamberFront.scale.x, (L / 2 - wall) - (face + wall), 1e-9, 'and the oil in front as wide as the room in front');
    t.near(T.chamberBack.scale.x + T.chamberFront.scale.x + wall, L - 2 * wall, 1e-9, 'the two chambers and the piston filling the body');
    // Geometry buffers are 32 bit floats, so anything read back out of one is
    // held to a ten thousandth of a millimeter on the plan rather than exactly.
    const coil = pointsOf(T.spring);
    t.near(coil[0][0], -L / 2 + wall, 1e-5, 'the spring from the far wall');
    t.near(coil.at(-1)[0], face, 1e-5, 'to the back of the piston');
    t.ok(coil.length === M.CLOSERVIEW.coils * 2 + 2 && coil.every(([, y]) => Math.abs(y) <= bore * 0.36 + 1e-5), 'drawn as a zigzag inside the bore');

    // The three orifices, to one scale, with the live one filled.
    [plan.values.sweep, plan.values.latch, P.ORIFICES.backcheck].forEach((diameter, i) => {
      t.near(T.holeFaces[i].scale.x, diameter * M.HOLE / 2, 1e-12, `orifice ${i} drawn at ${diameter} mm on the orifice scale`);
      const ring = pointsOf(T.holeRings[i]);
      t.ok(ring.every(([x, y]) => Math.abs(Math.hypot(x - (i - 1) * M.VALVES.gap, y - 0.12) - diameter * M.HOLE / 2) < 1e-5), 'and ringed on its own circle');
      counts.points++;
    });
    const live = now.opening ? (now.checking ? 2 : -1) : (now.latching ? 1 : 0);
    t.ok(state.liveIndex === live, 'the orifice the oil is going through now');
    T.holeFaces.forEach((mesh, i) => t.ok(mesh.material.color.getHex() === (i === live && time > 0 ? M.COLORS.live : M.COLORS.holeFace), 'only the live orifice is filled, and none of them before Play'));

    // The trace.
    const guide = pointsOf(T.traceGuide);
    t.ok(guide.length === M.CHART.samples, 'the whole swing drawn faintly');
    for (let i = 0; i < guide.length; i += 20) {
      const at = P.doorAt(plan, plan.duration * i / (M.CHART.samples - 1));
      t.near(guide[i][0], M.CHART.x + (i / (M.CHART.samples - 1)) * M.CHART.w, 1e-5, 'across in time');
      t.near(guide[i][1], M.traceY(at.degrees), 1e-5, 'up in angle');
      t.ok(guide[i][1] >= M.CHART.y - 1e-5 && guide[i][1] <= M.CHART.y + M.CHART.h + 1e-5, 'inside the frame');
      counts.points++;
    }
    const curve = pointsOf(T.traceCurve), bars = pointsOf(T.tracePressure);
    if (time > 0) {
      t.near(curve.at(-1)[0], M.traceX(plan, Math.min(time, plan.duration)), 1e-5, 'the dark curve ending at now');
      t.near(curve.at(-1)[1], M.traceY(now.degrees), 1e-5, 'at the angle now');
      t.ok(bars.every(([, y]) => y >= M.CHART.y - 1e-5 && y <= M.CHART.y + M.CHART.h + 1e-5), 'the pressure curve never leaves the frame');
      t.near(bars.at(-1)[1], M.pressureY(now.pressure / 1e5, M.pressureTop(plan)), 1e-5, 'and ends at the pressure now');
    } else t.ok(!T.traceCurve.visible && !T.tracePressure.visible, 'nothing drawn dark before Play');
    const cursor = pointsOf(T.traceCursor);
    t.near((cursor[0][0] + cursor[1][0]) / 2, M.traceX(plan, Math.min(time, plan.duration)), 1e-5, 'the cursor at now');
    t.near(cursor[0][1], M.traceY(now.degrees), 1e-5, 'the cursor at the angle now');
    t.ok(T.traceCheck.visible === (plan.values.backcheck === 1), 'the back check band shown only when the back check is on');
    t.ok(T.checkBand.visible === (plan.values.backcheck === 1), 'and the same band on the arc');
  }
}
{
  // The arc and its zones, at the radius the leaf reaches.
  for (const door of [1, 4, 7]) {
    model.reset();
    model.update({door});
    model.root.updateMatrixWorld(true);
    const radius = P.EN1154[door - 1].width * M.PLAN + M.FRAME.arc;
    for (const [line, from, to] of [[T.sweepBand, P.ANGLES.latch, P.ANGLES.backcheck], [T.checkBand, P.ANGLES.backcheck, P.ANGLES.stop], [T.latchBand, P.ANGLES.engage, P.ANGLES.latch], [T.engageBand, 0, P.ANGLES.engage]]) {
      const points = pointsOf(line);
      t.ok(points.every(([x, y]) => Math.abs(Math.hypot(x, y) - radius) < 1e-5), 'each band on the swing arc');
      t.near(Math.atan2(points[0][1], points[0][0]) / RADIAN, from, 1e-3, `from ${from}°`);
      t.near(Math.atan2(points.at(-1)[1], points.at(-1)[0]) / RADIAN, to, 1e-3, `to ${to}°`);
      counts.points += 2;
    }
    const stop = pointsOf(T.stopMark);
    t.near(Math.atan2(stop[0][1], stop[0][0]) / RADIAN, P.ANGLES.stop, 1e-3, 'the stop marked at 120 degrees');
  }
}
{
  // No part of the bench runs into another, whatever the door and the moment.
  const toSystem = new THREE.Matrix4(), local = new THREE.Box3();
  const boxOf = object => {
    const box = new THREE.Box3();
    object.traverse(child => {
      for (let node = child; node; node = node.parent) if (!node.visible) return;
      if (!child.geometry) return;
      child.geometry.computeBoundingBox();
      local.copy(child.geometry.boundingBox);
      box.union(local.applyMatrix4(child.matrixWorld).applyMatrix4(toSystem));
    });
    return box;
  };
  const near = new Set(['frame:door', 'frame:latch', 'door:latch']);
  for (const door of [1, 3, 5, 7]) for (const share of [0, 0.25, 0.5, 1]) {
    model.reset();
    model.update({door, push: 150});
    model.advance(P.doorPlan({door, push: 150}).duration * share);
    model.root.updateMatrixWorld(true);
    toSystem.copy(T.system.matrixWorld).invert();
    const boxes = ['frame', 'door', 'latch', 'closer', 'valves', 'trace'].map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
    t.ok(boxes.every(([, box]) => !box.isEmpty()), 'every part drawn');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, A] = boxes[i], [b, B] = boxes[j];
      if (near.has(`${a}:${b}`)) continue;
      t.ok(A.max.x + 0.04 <= B.min.x || B.max.x + 0.04 <= A.min.x || A.max.y + 0.04 <= B.min.y || B.max.y + 0.04 <= A.min.y, `the ${a} and the ${b} clear of one another on a ${P.EN1154[door - 1].width} mm door`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lesson: every number it quotes is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const arrival = state => state.arrival / RADIAN;
const base = P.doorPlan({});
checkTrialNumbers(L, {
  'Let it close': s => ({'93.7': s.peakDegrees, '5.13': s.sweepTime, 90: P.ANGLES.from, 12: P.ANGLES.to, '7.69': s.latchedAt, '16.4': arrival(s)}),
  'Turn the sweep valve down': s => { t.ok(s.sweepTime > base.sweepTime, 'a smaller orifice is a slower sweep'); return {'20.59': s.sweepTime, 90: P.ANGLES.from, 12: P.ANGLES.to}; },
  'Open the sweep valve up': s => { t.ok(s.sweepTime < P.ADA.seconds, 'wide open it is quicker than an accessible door may be'); return {'1.34': s.sweepTime, 5: P.ADA.seconds, '21.5': arrival(s), '16.4': base.arrival / RADIAN}; },
  'Shut the latch valve down': s => { t.ok(s.latched && arrival(s) < 2, 'it still latches, but it creeps on'); return {'5.13': s.sweepTime, '1.0': arrival(s), '13.56': s.latchedAt}; },
  'Throw it open with the back check off': s => { t.ok(s.hitStop !== null, 'it reaches the stop'); return {197: s.stopSpeed / RADIAN, '106.8': s.stopLoss}; },
  'Throw it open with the back check on': s => { t.ok(s.hitStop === null, 'and with the back check on it does not'); return {'198.8': s.peakPressure / 1e5, '119.8': s.peakDegrees}; },
  'Fit a closer too weak for the door': s => { t.ok(!s.latched, 'the door is left ajar'); return {'7.8': s.latchSpring, '19.0': s.latchMoment, '3.2': s.ajar, '0.44': s.residual}; },
}, run, t);

const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
}
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
for (const [where, text] of texts(L)) covered(text, {}, `Door closer ${where}`);

const wide = P.doorPlan({door: 7}), off = P.doorPlan({push: 150, backcheck: 0}), on = P.doorPlan({push: 150});
covered(L.deeper[0].body, {
  'Cd·A·sqrt(2·dP/rho)': 'Cd·A·sqrt(2·dP/rho)',
  'rho·Q²/(2·Cd²·A²)': 'rho·Q²/(2·Cd²·A²)',
  [`At 0.3 mm that is ${f1(P.dampingOf(0.3))} N·m`]: 'At 0.3 mm that is 580.0 N·m',
  [`at 0.15 mm it is ${f1(P.dampingOf(0.15))}`]: 'at 0.15 mm it is 9,279.5',
}, 'deeper 1');
covered(L.deeper[1].body, {
  [`Size 1 is for a leaf up to ${f0(P.EN1154[0].width)} mm and ${f0(P.EN1154[0].mass)} kg and size 7 for ${f0(P.EN1154[6].width)} mm and ${f0(P.EN1154[6].mass)} kg, with ${f0(P.EN1154[2].width)} mm and ${f0(P.EN1154[2].mass)} kg at size 3 in between`]: 'Size 1 is for a leaf up to 750 mm and 20 kg and size 7 for 1,600 mm and 160 kg, with 950 mm and 60 kg at size 3 in between',
  [`may not exceed ${f0(P.SIZE3.moment)} N·m between 0 and ${f0(P.SIZE3.angle)} degrees`]: 'may not exceed 47 N·m between 0 and 60 degrees',
  [`at least a size ${P.GRADES.fireSize}`]: 'at least a size 3',
  'sizes 1 and 2 too weak': 'sizes 1 and 2 too weak',
  'BS EN 1154 grades closers': 'BS EN 1154 grades closers',
  'DIN 18040 fixes the other end of the same size 3': 'DIN 18040 fixes the other end of the same size 3',
}, 'deeper 2');
covered(L.deeper[2].body, {
  [`The ${f0(wide.leaf.width)} mm, ${f0(wide.leaf.mass)} kg leaf takes ${f2(wide.sweepTime)} s from ${P.ANGLES.from} to ${P.ANGLES.to} degrees on this closer against ${f2(base.sweepTime)} s for the ${f0(base.leaf.width)} mm, ${f0(base.leaf.mass)} kg leaf`]: 'The 1,600 mm, 160 kg leaf takes 5.02 s from 90 to 12 degrees on this closer against 5.13 s for the 950 mm, 60 kg leaf',
  [`moment of inertia is ${f1(wide.inertia)} kg·m² against ${f1(base.inertia)}`]: 'moment of inertia is 136.5 kg·m² against 18.1',
  [`carrying ${f2(wide.arrivalEnergy)} J instead of ${f2(base.arrivalEnergy)}`]: 'carrying 4.11 J instead of 0.74',
}, 'deeper 3');
covered(L.deeper[3].body, {
  [`the change happens at ${P.ANGLES.latch} degrees`]: 'the change happens at 12 degrees',
  [`over the last ${P.ANGLES.engage} degrees`]: 'over the last 5 degrees',
  [`asks ${f1(base.latchMoment)} N·m against the ${f1(base.latchSpring)} N·m`]: 'asks 19.0 N·m against the 23.5 N·m',
}, 'deeper 4');
covered(L.deeper[4].body, {
  'TS 83': 'TS 83',
  [`beyond about ${P.ANGLES.backcheck} degrees`]: 'beyond about 70 degrees',
  [`into its stop at ${f0(off.stopSpeed / RADIAN)}°/s, leaving ${f1(off.stopLoss)} J`]: 'into its stop at 197°/s, leaving 106.8 J',
  [`dies at ${f1(on.peakDegrees)}°`]: 'dies at 119.8°',
}, 'deeper 5');
covered(L.deeper[5].body, {
  [`the hand puts in ${f1(base.handWork)} J`]: 'the hand puts in 83.8 J',
  [`the spring holds ${f1(base.stored)} J`]: 'the spring holds 68.4 J',
  [`${f1(base.oilHeat)} J has gone into warming the oil, ${f1(base.frictionHeat)} J into friction and ${f2(base.latchWork)} J into the bolt, with ${f2(base.arrivalEnergy)} J arriving`]: '76.5 J has gone into warming the oil, 4.9 J into friction and 1.66 J into the bolt, with 0.74 J arriving',
}, 'deeper 6');
covered(L.limits, {
  [`at ${P.SIZE3.angle} degrees scaled from the one sourced figure, the ${P.SIZE3.moment} N·m of a size ${P.SIZE3.size} closer`]: 'at 60 degrees scaled from the one sourced figure, the 47 N·m of a size 3 closer',
  [`pinion pitch radius of ${f0(P.CLOSER.pinion * 1000)} mm`]: 'pinion pitch radius of 12 mm',
  [`latch force of ${P.LATCH_FORCE} N at the leading edge over the last ${P.ANGLES.engage} degrees`]: 'latch force of 20 N at the leading edge over the last 5 degrees',
  [`the stop at ${P.ANGLES.stop} degrees`]: 'the stop at 120 degrees',
  [`the oil at ${f0(P.CLOSER.density)} kg/m³ with a discharge coefficient of ${P.CLOSER.discharge}`]: 'the oil at 870 kg/m³ with a discharge coefficient of 0.62',
}, 'limits');
covered(L.quiz.explanation, {
  [`from 0.6 mm to 0.3 mm takes this door from ${f2(P.doorPlan({sweep: 0.6}).sweepTime)} s to ${f2(base.sweepTime)} s between ${P.ANGLES.from}° and ${P.ANGLES.to}°`]: 'from 0.6 mm to 0.3 mm takes this door from 1.34 s to 5.13 s between 90° and 12°',
}, 'quiz');

// The model's own words: its scales, said where the reader sees them.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`1 scene unit to ${f0(1 / M.PLAN)} mm`]: '1 scene unit to 1,000 mm',
  [`cut open ${f0(M.timesLarger(M.BODY))} times larger`]: 'cut open 6 times larger',
  [`three orifices ${f0(M.timesLarger(M.HOLE))} times larger`]: 'three orifices 500 times larger',
}, 'system text');
covered(partText('frame'), {
  [`past ${P.ANGLES.backcheck}°`]: 'past 70°', [`under ${P.ANGLES.latch}°`]: 'under 12°', [`under ${P.ANGLES.engage}°`]: 'under 5°', [`stop is at ${P.ANGLES.stop}°`]: 'stop is at 120°',
}, 'frame text');
covered(partText('door'), {[`${f0(0.5 / M.ARROW.per)} N·m to half a scene unit`]: '200 N·m to half a scene unit', 'BS EN 1154 tabulates': 'BS EN 1154 tabulates'}, 'door text');
covered(partText('latch'), {[`last ${P.ANGLES.engage}°`]: 'last 5°', [`takes ${P.LATCH_FORCE} N`]: 'takes 20 N'}, 'latch text');
covered(partText('closer'), {
  'TS 83': 'TS 83',
  [`drawn ${f0(M.timesLarger(M.BODY))} times larger`]: 'drawn 6 times larger',
  [`a body ${M.CLOSERVIEW.length} mm long and ${M.CLOSERVIEW.height} mm high`]: 'a body 245 mm long and 60 mm high',
  [`LCN’s ${f1(P.CLOSER.bore * 1000)} mm bore`]: 'LCN’s 38.1 mm bore',
  [`${f0(P.CLOSER.pinion * 2000)} mm pitch diameter`]: '24 mm pitch diameter',
}, 'closer text');
covered(partText('valves'), {
  [`drawn ${f0(M.timesLarger(M.HOLE))} times larger`]: 'drawn 500 times larger',
  [`down to ${P.ANGLES.latch}°`]: 'down to 12°', [`the last ${P.ANGLES.latch}°`]: 'the last 12°', [`past ${P.ANGLES.backcheck}°`]: 'past 70°',
}, 'valves text');
covered(partText('trace'), {[`the ${P.ANGLES.stop}° stop`]: 'the 120° stop'}, 'trace text');
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Closing moment,The bolt asks,Oil pressure,Sweep,Latch,Back check,Energy,The door,Drawn,Model limit', 'eleven readings, the result first');
  t.ok(readings.filter(item => item.hint).length >= 9, 'and nearly all of them explained');
  t.ok(find('Closing moment').value === '23.5 N·m at the latch' && find('The bolt asks').value === '19.0 N·m' && find('Sweep').value === '5.13 s' && find('The door').value === '950 mm, 60 kg' && find('Drawn').value === '6 times larger', 'the readings carry the lesson’s figures');
  checkQuotedText(find('Closing moment').hint, {'23.5 N·m shut to 47.0 N·m at 60° and 70.5 N·m': `${f1(base.latchSpring)} N·m shut to ${f1(base.openingMoment)} N·m at ${P.SIZE3.angle}° and ${f1(base.stopMoment)} N·m`, 'up to 950 mm and 60 kg': `up to ${f0(base.rated.width)} mm and ${f0(base.rated.mass)} kg`}, t);
  checkQuotedText(find('The door').hint, {'18.1 kg·m²': `${f1(base.inertia)} kg·m²`}, t);
  model.advance(1e4);
  const done = model.getState().readings, doneFind = label => done.find(item => item.label === label);
  t.ok(doneFind('Latch').value === 'closes and latches' && doneFind('Your result').value === `Latched · shut in ${f1(base.latchedAt)} s, arriving at ${f1(base.arrival / RADIAN)}°/s`, 'once it has run, the result says when it latched and how fast it arrived');
  model.reset();
  model.update({size: 1});
  model.advance(1e4);
  const ajar = model.getState().readings;
  t.ok(/Left ajar/.test(ajar.find(item => item.label === 'Your result').value) && ajar.find(item => item.label === 'Latch').value === 'left 3.2° open', 'and when it did not');
  model.reset();
  model.update({size: 7});
  const stuck = model.getState().readings;
  t.ok(/does not move/.test(stuck.find(item => item.label === 'Your result').value) && stuck.find(item => item.label === 'Back check').hint.includes('never moved'), 'a closer stronger than the hand says so');
}
{
  const all = [L.simple, L.overview, L.misconception, L.limits, L.quiz.question, L.quiz.explanation, ...L.quiz.options, ...L.steps.flatMap(step => [step.title, step.body]), ...L.parts.flatMap(item => [item.name, item.role]), ...L.deeper.flatMap(item => [item.title, item.body]), ...L.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...L.sources.map(source => source.title), ...model.parts.map(item => item.description)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(L.sources.every(source => /^https:\/\//.test(source.url)) && new Set(L.sources.map(s => s.url)).size === L.sources.length, 'every source a link, none twice');
  t.ok(L.quiz.answer === 0 && L.quiz.options.length === 3, 'a quiz with its answer first');
  t.ok(L.steps.length === 5 && L.parts.length === 6 && L.tryIt.length === 7 && L.deeper.length === 6, 'five steps, six parts, seven trials and six deeper sections');
  t.ok(L.tryIt.every(trial => model.parts.some(item => item.id === trial.part) && trial.view === 'front' && trial.reset === true && trial.isolate === false), 'every trial on a part the model has');
  t.ok(L.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part the lesson names is a part of the model');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [lo, hi, step] = P.DOOR_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.DOOR_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'door,size,sweep,latch,backcheck,open,push', 'seven controls');
const drawing = () => [
  T.leafGroup.rotation.z, T.leaf.scale.x, T.bolt.position.x, T.bolt.material.color.getHex(),
  T.piston.position.x, T.holeFaces.map(h => h.scale.x), T.pressureBar.scale.x,
  pointsOf(T.traceGuide).slice(0, 12), pointsOf(T.traceCurve).length, T.checkBand.visible, T.delivered.userData.length,
];
checkControlsMove(model, drawing, m => m.advance(1e4), t);
checkRefusals(P.sampleDoorCloser, P.DOOR_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the swing');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.5, 1e-12, 'a step is half a second of the swing');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'and it changes the readings');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through');
  model.reset();
  model.animate(0);
  model.animate(0.75);
  t.near(model.getState().clock, 0.75, 1e-12, 'animation runs the swing at life');
  model.advance(1e4);
  t.ok(model.playback.complete() && model.resultPart.available() && !model.playback.blocked(), 'the swing over, with a result to inspect');
  t.ok(model.resultPart.id === 'latch' && model.parts.some(item => item.id === model.resultPart.context), 'the result is the latch, in the whole bench');
  const held = JSON.stringify([T.leafGroup.rotation.z, T.bolt.position.x]);
  model.advance(50);
  t.ok(JSON.stringify([T.leafGroup.rotation.z, T.bolt.position.x]) === held, 'once it is shut, nothing moves again');
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0, `${action.label} returns readings`); t.ok(model.parts.some(item => item.id === action.part) && action.view === 'front', `${action.label} names a part the model has`); checkFinite(model.root, t); }
  t.ok(model.parts.every(item => item.description) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, and under the system');
  for (const values of settings) for (const time of [0, 1, 4, 1000]) { model.reset(); model.update(values); model.advance(time); t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), `${JSON.stringify(values)}: readings are all numbers`); checkFinite(model.root, t); }
}
t.ok(utilityLessons['Door closer'] === L, 'the door closer’s lesson is the one the house serves');
const released = checkDisposal((() => { const fresh = M.createDoorCloserModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS door closer: ${t.count} checks, ${counts.settings} settings marched again at a fifth of the step in ${counts.steps} steps, ${counts.slices} leaf slices integrated, ${counts.poses} poses read back, ${counts.points} arc, leaf, orifice and chart points, ${counts.numbers} quoted numbers traced, 1 lesson, ${released} resources released exactly once.`);

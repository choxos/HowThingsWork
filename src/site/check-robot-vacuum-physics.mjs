import assert from 'node:assert/strict';
import {cleaningPlan, cleaningPose, ROBOT_DEFAULTS, RUN_WATTS, BATTERY_JOULES} from './robot-vacuum-physics.js';
import {ROBOT, ROOM, START, FURNITURE, DROP, GRID} from './robot-vacuum-room.js';
import {robotMission, sampleRobot, missionTime, missionPlayTime, MISSION} from './robot-vacuum-mission.js';
import {clearSegment} from './robot-vacuum-route.js';
let checks = 0, missions = 0;
const check = (ok, message) => {checks++; assert.ok(ok, message);};
const near = (a, b, tolerance = 1e-8, message = 'numbers differ') => check(Math.abs(a - b) <= tolerance, `${message}: ${a} versus ${b}`);
const floor = (x, y, room) => x >= -1e-10 && x <= 4 + 1e-10 && y >= -1e-10 && y <= 3 + 1e-10 && !(room === 2 && x >= DROP.x0 && x <= DROP.x1 && y >= DROP.y0 && y <= DROP.y1);
function geometry(pose, room) {
  const {x, y, h} = pose, margin = .18;
  check(x >= margin - 1e-9 && x <= 4 - margin + 1e-9 && y >= margin - 1e-9 && y <= 3 - margin + 1e-9, 'wall clearance');
  if (room === 1) for (const item of FURNITURE) {
    const gap = item.kind === 'leg' ? Math.hypot(x - item.x, y - item.y) - item.r : Math.hypot(Math.max(item.x0 - x, 0, x - item.x1), Math.max(item.y0 - y, 0, y - item.y1));
    check(gap >= margin - 1e-9, 'furniture clearance');
  }
  // Independent underside support coordinates: both 22 mm wide tires, caster.
  for (const [forward, across] of [[0, -.126], [0, .126], [.123, 0]]) {
    check(floor(x + forward * Math.cos(h) - across * Math.sin(h), y + forward * Math.sin(h) + across * Math.cos(h), room), 'wheel contact must stay over floor');
  }
}
for (let room = 0; room < 3; room++) for (let strategy = 0; strategy < 3; strategy++) {
  const plan = cleaningPlan({room, strategy}), ticks = plan.ticks;
  check(ticks.length === 60001 * 8, 'one record per integration step');
  for (let n = 1; n < ticks.length / 8; n++) {
    const a = (n - 1) * 8, b = n * 8, left = ticks[b + 6], right = ticks[b + 7], omega = (right - left) / .23, v = (left + right) / 2, theta = ticks[a + 2], end = theta + omega * .02;
    // Independent closed-form circle integration (not the production sinc form).
    const dx = Math.abs(omega) < 1e-9 ? v * .02 * Math.cos(theta) : v / omega * (Math.sin(end) - Math.sin(theta));
    const dy = Math.abs(omega) < 1e-9 ? v * .02 * Math.sin(theta) : v / omega * (Math.cos(theta) - Math.cos(end));
    near(ticks[b], ticks[a] + dx, 2e-10, 'x integration'); near(ticks[b + 1], ticks[a + 1] + dy, 2e-10, 'y integration'); near(ticks[b + 2], end, 2e-10, 'heading integration');
    near(ticks[b + 3] - ticks[a + 3], left * .02, 2e-10, 'left wheel travel'); near(ticks[b + 4] - ticks[a + 4], right * .02, 2e-10, 'right wheel travel');
    near(ticks[b + 5] - ticks[a + 5], Math.abs(v) * .02, 2e-10, 'center arc length');
    geometry({x: ticks[b], y: ticks[b + 1], h: ticks[b + 2]}, room);
  }
  let counted = 0;
  for (let cell = 0; cell < plan.first.length; cell++) {
    const t = plan.first[cell]; if (!Number.isFinite(t)) continue;
    counted++;
    check(Boolean(plan.reach.floor[cell]), 'painted cell must be in coverage denominator');
    const pose = cleaningPose(plan, t), x = (cell % GRID.columns + .5) * .02, y = (Math.floor(cell / GRID.columns) + .5) * .02;
    const dx = x - pose.x, dy = y - pose.y, forward = dx * Math.cos(pose.h) + dy * Math.sin(pose.h), across = -dx * Math.sin(pose.h) + dy * Math.cos(pose.h);
    check(Math.abs(forward - .055) <= .0225 + 1e-9 && Math.abs(across) <= .105 + 1e-9, 'first paint requires actual head overlap');
  }
  near(plan.coverage.at(-1), counted / plan.reach.floorCount, 1e-12, 'coverage denominator');
  for (let i = 1; i < plan.coverage.length; i++) check(plan.coverage[i] >= plan.coverage[i - 1] && plan.coverage[i] <= 1, 'coverage monotonic and bounded');
  check(room === 2 ? plan.cliffs.length > 0 : plan.cliffs.length === 0, 'only missing floor triggers edge stops');
}
for (let room = 0; room < 3; room++) for (let strategy = 0; strategy < 3; strategy++) for (let charge = 0; charge < 3; charge++) for (let session = 0; session < 4; session++) for (let dockPower = 0; dockPower < 2; dockPower++) {
  const values = {room, strategy, charge, session, dockPower}, m = robotMission(values);
  missions++;
  check(m.cleanEnd > 0 && m.dockedAt > m.cleanEnd && m.end >= m.dockedAt, 'ordered mission phases');
  check(m.dockEnergy > 0, 'reserve must get robot home');
  for (let i = 1; i < m.route.length; i++) check(clearSegment(m.route[i - 1], m.route[i], room), 'entire return segment has clearance');
  for (const segment of m.segments) {
    for (let t = segment.start; t < segment.end; t += .03) geometry(sampleRobot(values, t).now, room);
    const before = sampleRobot(values, Math.max(m.cleanEnd, segment.end - 1e-7)), after = sampleRobot(values, segment.end);
    check(Math.hypot(after.now.x - before.now.x, after.now.y - before.now.y) < 1e-6, 'no teleport between return segments');
    near(after.now.h, before.now.h, 1e-6, 'no heading jump between segments');
  }
  for (const time of [0, m.cleanEnd / 2, m.cleanEnd, (m.cleanEnd + m.dockedAt) / 2, m.dockedAt - 1e-5, m.dockedAt, (m.dockedAt + m.end) / 2, m.end, m.end + 100]) {
    const s = sampleRobot(values, time);
    near(s.initialEnergy - s.cleanEnergy - s.returnEnergy + s.storedEnergy, s.energy, 1e-6, 'energy conservation');
    near(missionTime(m, missionPlayTime(m, time)), Math.min(m.end, time), 1e-8, 'time mapping round trip');
    check(s.energy >= 0 && s.energy <= BATTERY_JOULES + 1e-6, 'bounded battery energy');
    if (time >= m.cleanEnd) near(s.coverage, sampleRobot(values, m.cleanEnd).coverage, 0, 'return and charge do not clean');
    if (time > 0 && time < m.dockedAt) check(!s.contacts && !s.charging && s.storedEnergy === 0, 'no charging before contacts engage');
    if (!dockPower) check(!s.charging && s.storedEnergy === 0, 'unplugged dock never charges');
  }
  const final = sampleRobot(values, m.end);
  near(final.now.x, START.x); near(final.now.y, START.y); near(Math.sin(final.now.h), 1); near(Math.cos(final.now.h), 0);
  near(final.battery, dockPower ? 1 : m.dockEnergy / BATTERY_JOULES, 1e-10, 'final battery');
  check(final.contacts && !final.cleaning && !final.charging, 'mission completion state');
  if (charge === 0 && session > 0) check(m.reason === 'battery reserve reached', 'low battery overrides longer cleaning timer');
  else check(m.reason === 'selected cleaning time finished', 'timer ends adequately powered run');
}
for (const bad of [{room: 3}, {strategy: -1}, {charge: .5}, {session: NaN}, {dockPower: 2}]) assert.throws(() => robotMission(bad));
assert.throws(() => sampleRobot(ROBOT_DEFAULTS, -1)); assert.throws(() => missionTime(robotMission(), Infinity));
console.log(`PASS robot vacuum physics: ${checks} checks; 9 complete cleaning paths; ${missions} setting combinations; independent kinematics, support, coverage and energy checks.`);

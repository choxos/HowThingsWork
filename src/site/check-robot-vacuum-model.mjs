// Robot vacuum cleaner: every recorded step held to what two wheels can do and
// to never touching a wall or the furniture, the swept floor measured again by
// Monte Carlo against the path itself, the floor a round robot can reach found
// again from exact geometry, each strategy's own rules, the drawing held to the
// state, and every number the lesson quotes held to the model.
import assert from 'node:assert/strict';
import {robotPlan, sampleRobot, ROBOT, SPIN_RATE, RUN_WATTS, RUNTIME, GRID, ROBOT_DOMAINS} from './robot-vacuum-physics.js';
import {createRobotVacuumModel, chartPoint, SHADES} from './robot-vacuum-model.js';
import {robotVacuumLesson} from './robot-vacuum-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), R = 0.17, v = 0.28, b = 0.23, REACH = 0.14, TAU = Math.PI * 2;
const SETTINGS = [0, 1].flatMap(room => [0, 1, 2].map(strategy => ({strategy, room})));

// Geometry written again: how far a point is from the walls and the furniture.
const pieces = room => (room === 1 ? [{box: [0.2, 2.2, 2.1, 3.0]}, ...[[2.6, 1], [3.4, 1], [2.6, 1.7], [3.4, 1.7]].map(([x, y]) => ({leg: [x, y, 0.025]}))] : []);
const clearance = (x, y, room) => {
  let gap = Math.min(x, 4 - x, y, 3 - y);
  for (const piece of pieces(room)) {
    if (piece.box) { const [x0, x1, y0, y1] = piece.box, dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); gap = Math.min(gap, Math.hypot(dx, dy)); }
    else { const [lx, ly, lr] = piece.leg; gap = Math.min(gap, Math.hypot(x - lx, y - ly) - lr); }
  }
  return gap;
};
const underSofa = (x, y, room) => room === 1 && x > 0.2 && x < 2.2 && y > 2.1 && y < 3.0;
const underLeg = (x, y, room) => room === 1 && [[2.6, 1], [3.4, 1], [2.6, 1.7], [3.4, 1.7]].some(([lx, ly]) => Math.hypot(x - lx, y - ly) < 0.025);

// 1. Every recorded step: no contact, no faster than the wheels allow, wheels matching the motion.
for (const values of SETTINGS) {
  const plan = robotPlan(values), where = JSON.stringify(values), path = [plan.start, ...plan.path];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], c = path[i], left = c.leftWheel, right = c.rightWheel;
    t.ok(clearance(c.x, c.y, values.room) >= R - 1e-9, `${where} at ${c.t} s: the robot never overlaps anything`);
    t.ok(Math.hypot(c.x - a.x, c.y - a.y) <= v * 0.2 + 1e-9, `${where} at ${c.t} s: no faster than 0.28 m/s`);
    if (c.doing === 'turning') t.ok(Math.abs(left + right) < 1e-12 && Math.abs(Math.abs(left) - v / 2) < 1e-12, `${where} at ${c.t} s: turning on the spot, wheels opposite at half speed`);
    if (['driving', 'driving a row', 'shifting a lane'].includes(c.doing)) t.ok((left === v && right === v) || (left === 0 && right === 0), `${where} at ${c.t} s: driving on equal wheels`);
    if (c.doing === 'backing off') t.ok((left === -v && right === -v) || (left === 0 && right === 0), `${where} at ${c.t} s: backing off on reversed wheels`);
    if (c.doing === 'following an edge') t.ok((left === v && right === v) || Math.abs(left + right) < 1e-12, `${where} at ${c.t} s: following by steps and spins`);
    if (c.doing === 'spiraling') {
      const radius = b * (left + right) / (2 * (right - left));
      t.near((left + right) / 2, v, 1e-12, `${where} at ${c.t} s: spiral at full speed`);
      t.ok(radius >= ROBOT.spiralStart - 1e-9, `${where} at ${c.t} s: spiral no tighter than 150 mm`);
    }
  }
  t.near(plan.distance, path.at(-1).distance, 1e-9, `${where}: distance recorded`);
  for (let s = 1; s < plan.coverage.length; s++) t.ok(plan.coverage[s] >= plan.coverage[s - 1] && plan.coverage[s] <= 1, `${where}: coverage only grows`);
}

// 2. Each strategy's rules.
for (const room of [0, 1]) {
  const path = robotPlan({strategy: 0, room}).path;
  let turns = 0;
  for (let i = 1; i < path.length - 1; i++) {
    if (path[i - 1].doing !== 'driving' || path[i - 1].leftWheel !== v || path[i].doing === 'driving') continue;
    let j = i;
    while (j < path.length - 1 && path[j].doing !== 'driving') j++;
    if (path[j].doing !== 'driving' || path[j + 1]?.doing !== 'driving' || path[j].bumps !== path[i - 1].bumps + 1) continue;
    const turned = ((path[j].h - path[i - 1].h) % TAU + TAU) % TAU * 180 / Math.PI;
    t.ok(turned >= 100 - 1e-6 && turned <= 260 + 1e-6, `room ${room}: a random turn of ${turned.toFixed(1)} degrees, between 100 and 260`);
    turns++;
  }
  t.ok(turns > 40, `room ${room}: many random turns measured`);
  const rows = robotPlan({strategy: 2, room}), rowSamples = rows.path.filter(p => p.doing === 'driving a row');
  for (const p of rowSamples) t.ok(Math.abs(Math.sin(p.h)) < 1e-9, `room ${room}: rows run straight across the room`);
  const lanes = [...new Set(rowSamples.map(p => p.y.toFixed(6)))].map(Number).sort((a, c) => a - c);
  for (let k = 1; k < lanes.length; k++) t.ok(lanes[k] - lanes[k - 1] <= ROBOT.lane + 1e-6, `room ${room}: lanes no more than 0.25 m apart`);
  t.ok(lanes.at(-1) <= 3 - R - 0.01 + 1e-9 && lanes.at(-1) >= 3 - R - 0.01 - 0.02, `room ${room}: the last lane as close to the far wall as allowed`);
  if (room === 0) for (let k = 1; k < lanes.length - 1; k++) t.near(lanes[k] - lanes[k - 1], ROBOT.lane, 1e-6, 'empty room: full lanes');
  const follows = rows.path.filter(p => p.mode === 'follow');
  t.near(follows.at(-1).distance - follows[0].distance, ROBOT.lap, 0.15, `room ${room}: one 16 m lap along the edges`);
  const hugging = follows.filter(p => p.doing === 'following an edge' && clearance(p.x, p.y, room) <= R + 0.02).length / follows.filter(p => p.doing === 'following an edge').length;
  t.ok(hugging > 0.9, `room ${room}: the edge lap hugs the walls (${(hugging * 100).toFixed(1)}% of samples within 20 mm)`);
  const spiral = robotPlan({strategy: 1, room});
  t.ok(spiral.bumps[0] < 10, `room ${room}: the spiral meets something within seconds`);
  t.near(spiral.path[0].rightWheel / spiral.path[0].leftWheel, (1 + b / (2 * ROBOT.spiralStart)) / (1 - b / (2 * ROBOT.spiralStart)), 1e-9, `room ${room}: spiral starts on its tightest turn`);
}

// 3. The swept floor again, by Monte Carlo against the path itself.
let seed = 99991;
const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
for (const values of [{strategy: 0, room: 1}, {strategy: 2, room: 0}, {strategy: 1, room: 1}, {strategy: 2, room: 1}]) {
  const plan = robotPlan(values), path = [plan.start, ...plan.path], bucket = 0.2, buckets = new Map();
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], c = path[k];
    for (let i = Math.floor((Math.min(a.x, c.x) - REACH) / bucket); i <= Math.floor((Math.max(a.x, c.x) + REACH) / bucket); i++) {
      for (let j = Math.floor((Math.min(a.y, c.y) - REACH) / bucket); j <= Math.floor((Math.max(a.y, c.y) + REACH) / bucket); j++) {
        const key = i * 1000 + j;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(k);
      }
    }
  }
  const tallies = new Map([[60, [0, 0]], [300, [0, 0]], [1200, [0, 0]]]);
  for (let n = 0; n < 30000; n++) {
    const x = random() * 4, y = random() * 3, index = Math.floor(y / 0.02) * GRID.columns + Math.floor(x / 0.02);
    if (!plan.reach.sweep[index]) continue;
    let firstTime = Infinity;
    for (const k of buckets.get(Math.floor(x / bucket) * 1000 + Math.floor(y / bucket)) ?? []) {
      const a = path[k - 1], c = path[k], dx = c.x - a.x, dy = c.y - a.y, length2 = dx * dx + dy * dy;
      const u = length2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0;
      if (Math.hypot(a.x + u * dx - x, a.y + u * dy - y) <= REACH) firstTime = Math.min(firstTime, a.t + u * (c.t - a.t));
    }
    for (const [time, counts] of tallies) { counts[1]++; if (firstTime <= time) counts[0]++; }
  }
  for (const [time, [swept, total]] of tallies) t.near(plan.coverage[time], swept / total, 0.02, `${JSON.stringify(values)}: swept share at ${time / 60} min, by Monte Carlo against the path`);
}

// 4. The floor a round robot can reach, from exact geometry at every cell center.
for (const room of [0, 1]) {
  const plan = robotPlan({strategy: 0, room}), {columns, rows} = GRID;
  let floor = 0, reachable = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = (i + 0.5) * 0.02, y = (j + 0.5) * 0.02;
    if (underSofa(x, y, room) || underLeg(x, y, room)) continue;
    floor++;
    let ok = clearance(x, y, room) >= R + 0.01;
    for (let k = 0; k < 72 && !ok; k++) ok = clearance(x + REACH * Math.cos(k * TAU / 72), y + REACH * Math.sin(k * TAU / 72), room) >= R + 0.01;
    if (ok) reachable++;
  }
  t.near(plan.reach.floorCount, floor, 0, `room ${room}: open floor cells`);
  t.near(plan.reach.sweepCount / floor, reachable / floor, 0.005, `room ${room}: floor within reach, from exact geometry`);
}

// 5. Battery and spin.
t.near(SPIN_RATE, 0.28 / 0.23, 1e-12, 'spin rate from the wheels');
t.near(RUN_WATTS, 33, 0, 'power drawn');
t.near(RUNTIME, 14.4 * 2.6 * 3600 / 33, 1e-9, 'runtime');
for (const time of [0, 600, 1200, 1500]) t.near(sampleRobot({}, time).battery, 1 - 33 * Math.min(time, 1200) / (14.4 * 2.6 * 3600), 1e-12, 'battery drains at 33 W');

// 6. The drawing.
const m = createRobotVacuumModel(), p = m.topology, MM = p.MM;
t.near(p.floor.geometry.parameters.width / MM / 1000, 4, 1e-9, 'floor 4 m wide');
t.near(p.floor.geometry.parameters.height / MM / 1000, 3, 1e-9, 'floor 3 m deep');
t.near(p.robot.children[0].geometry.parameters.radiusTop / MM / 1000, R, 1e-9, 'robot 340 mm across');
t.near(Math.abs(p.wheels[0].position.z - p.wheels[1].position.z) / MM / 1000, b, 1e-9, 'wheels 230 mm apart');
for (const values of [{}, {strategy: 2, room: 0}, {strategy: 1}, {strategy: 2}]) for (const clock of [0, 7.3, 60, 199.9, 600, 1200, 1500]) {
  m.reset(); m.update(values); m.advance(clock / p.SPEED_UP);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), now = Math.min(clock, 1200), where = `${JSON.stringify(values)} at ${clock} s`;
  t.near(s.clock, now, 1e-9, `${where}: sixty times real time, twenty minutes`);
  const index = Math.floor(now / 0.2 + 1e-9), sample = index === 0 ? s.start : s.path[index - 1];
  t.near(p.robot.position.x, (sample.x - 2) * 1000 * MM, 1e-9, `${where}: robot across`);
  t.near(p.robot.position.z, (1.5 - sample.y) * 1000 * MM, 1e-9, `${where}: robot along`);
  t.near(p.robot.rotation.y, sample.h, 1e-12, `${where}: robot heading`);
  for (const axle of p.wheels) t.near(axle.rotation.z, -sample.distance / 0.035, 1e-9, `${where}: wheels turned with the distance driven`);
  t.near(p.brush.rotation.y, -TAU * 2 * now / 60, 1e-9, `${where}: side brush twice a second`);
  let wrong = 0, sweptInside = 0;
  const first = robotPlan(s.values).first;
  assert.equal(s.first, undefined, `${where}: state carries no never-swept infinities`);
  for (let i = 0; i < first.length; i++) {
    const shade = first[i] <= now ? SHADES.swept : s.reach.sweep[i] ? SHADES.dust : SHADES.unreachable;
    if (p.data[i * 4] !== shade[0] || p.data[i * 4 + 1] !== shade[1] || p.data[i * 4 + 2] !== shade[2] || p.data[i * 4 + 3] !== 255) wrong++;
    if (first[i] <= now && s.reach.sweep[i]) sweptInside++;
  }
  assert.equal(wrong, 0, `${where}: every floor cell shaded by its state`);
  t.near(sweptInside / s.reach.sweepCount, s.coverage, 1 / s.reach.sweepCount + 1e-12, `${where}: shaded floor matches the coverage`);
  const drawn = p.path.geometry.drawRange.count;
  assert.equal(drawn, Math.min(300, index), `${where}: trail of the last minute`);
  if (drawn) t.near(p.path.geometry.attributes.position.getX(drawn - 1), (s.path[index - 1].x - 2) * 1000 * MM, 1e-6, `${where}: trail ends at the robot`);
  for (const strategy of [0, 1, 2]) {
    const plan = robotPlan({strategy, room: s.values.room}), line = p.curves[strategy].geometry.attributes.position;
    for (const i of [0, 30, 120]) {
      t.near(line.getX(i), (4.4 + i * 10 / 1200 * 1.8 - 2) * 1000 * MM, 1e-6, `${where}: race chart across`);
      t.near(line.getZ(i), (1.5 - (0.5 + plan.coverage[i * 10] * 2)) * 1000 * MM, 1e-6, `${where}: race chart up`);
    }
  }
  t.near(p.dot.position.z, chartPoint(now, s.coverage)[2], 1e-9, `${where}: dot for now`);
  assert.equal(p.furniture.visible, s.values.room === 1);
  t.add(3);
  if (clock === 60) checkFinite(m.root, t);
}

// 7. The lesson, the texts, controls, refusals and disposal.
const run = values => { m.reset(); m.update(values); return robotPlan(values); };
const minutesTo = (plan, share) => plan.coverage.findIndex(covered => covered >= share) / 60;
const bumpsBy = (plan, seconds) => plan.bumps.filter(time => time <= seconds).length;
checkTrialNumbers(robotVacuumLesson, {
  'Let it bounce': st => ({'73.0': st.coverage[300] * 100, '5': 5, '90': 90, '12.0': minutesTo(st, 0.9), '20': 20, '181': bumpsBy(st, 1200)}),
  'Rows beat bouncing': st => {
    const bouncing = robotPlan({strategy: 0, room: 0});
    t.ok(bouncing.coverage[1200] < 0.99, 'bouncing falls short of 99% in 20 min');
    return {'90': 90, '2.9': minutesTo(st, 0.9), '99': 99, '3.4': minutesTo(st, 0.99), '8.6': minutesTo(bouncing, 0.9), '20': 20};
  },
  'The edges': st => {
    const rowSamples = st.path.filter(sample => sample.doing === 'driving a row'), follows = st.path.filter(sample => sample.mode === 'follow');
    return {'11': new Set(rowSamples.map(sample => sample.y.toFixed(6))).size - 1, '67': follows.at(-1).t - follows[0].t, '100': st.coverage[300] * 100, '5': 5};
  },
  'Furniture in the way': st => ({'90': 90, '5.2': minutesTo(st, 0.9), '2.9': minutesTo(robotPlan({strategy: 2, room: 0}), 0.9), '99': 99, '19.4': minutesTo(st, 0.99)}),
  'A spiral first': st => (t.ok(Math.abs(robotPlan({strategy: 0, room: 1}).coverage[300] - st.coverage[300]) < 0.03 && st.bumps[0] < 10, 'about the same as bouncing, and meets the wall within seconds'), {'74.4': st.coverage[300] * 100, '5': 5, '73.0': robotPlan({strategy: 0, room: 1}).coverage[300] * 100}),
  'Corners': st => ({'340': 2 * ROBOT.radius * 1000, '4.9': (1 - st.reach.sweepCount / st.reach.floorCount) * 100, '10': ROBOT.clearance * 1000}),
  'How it turns': () => ({'0.14': v / 2, '69.8': SPIN_RATE * 180 / Math.PI, '1.29': Math.PI / 2 / SPIN_RATE}),
  'Battery': () => ({'33': RUN_WATTS, '29.4': RUN_WATTS * 1200 / (ROBOT.voltage * ROBOT.capacity * 3600) * 100, '37.44': ROBOT.voltage * ROBOT.capacity, '48': sampleRobot({}, 1200).minutesLeft}),
}, run, t);
checkQuotedText(robotVacuumLesson.limits, {
  '340 mm across with wheels 230 mm apart': `${fixed(ROBOT.radius * 2000, 0)} mm across with wheels ${fixed(ROBOT.wheelBase * 1000, 0)} mm apart`, '0.28 m/s': `${ROBOT.speed} m/s`,
  '280 mm wide': `${fixed(ROBOT.reach * 2000, 0)} mm wide`, 'backs off 30 mm': `backs off ${fixed(ROBOT.backUp * 1000, 0)} mm`, 'keeps 10 mm clear': `keeps ${fixed(ROBOT.clearance * 1000, 0)} mm clear`,
  'lanes 0.25 m apart': `lanes ${ROBOT.lane} m apart`, '16 m lap': `${ROBOT.lap} m lap`, '4 m by 3 m': '4 m by 3 m', '20 mm cells': `${fixed(0.02 * 1000, 0)} mm cells`,
  '14.4 V and 2.6 Ah feeding 33 W': `${ROBOT.voltage} V and ${ROBOT.capacity} Ah feeding ${RUN_WATTS} W`,
}, t);
checkQuotedText(robotVacuumLesson.deeper.map(section => section.body).join(' '), {'150 mm': `${fixed(ROBOT.spiralStart * 1000, 0)} mm`, '7.57': fixed((1 + b / (2 * ROBOT.spiralStart)) / (1 - b / (2 * ROBOT.spiralStart)), 2)}, t);
checkQuotedText(robotVacuumLesson.steps.map(step => step.body).join(' '), {'280 mm wide': `${fixed(ROBOT.reach * 2000, 0)} mm wide`}, t);
const partText = id => m.parts.find(part => part.id === id).description;
checkQuotedText(partText('robot'), {'340 mm across': `${fixed(ROBOT.radius * 2000, 0)} mm across`, '230 mm apart': `${fixed(ROBOT.wheelBase * 1000, 0)} mm apart`, '280 mm wide': `${fixed(ROBOT.reach * 2000, 0)} mm wide`}, t);
checkQuotedText(partText('furniture'), {'2 m by 0.9 m': '2 m by 0.9 m', '50 mm across': `${fixed(0.025 * 2000, 0)} mm across`}, t);
checkQuotedText(partText('floor'), {'20 mm cells': `${fixed(0.02 * 1000, 0)} mm cells`}, t);
checkControlsMove(m, () => [p.robot.position.toArray(), p.furniture.visible, p.curves[0].geometry.attributes.position.getZ(30), Array.from(p.data.slice(0, 8000))], model => model.advance(90 / p.SPEED_UP), t);
checkRefusals(sampleRobot, ROBOT_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS robot vacuum cleaner: ${t.count} checks, ${robotVacuumLesson.tryIt.length} trials, ${resources} resources`);

import {validateControls, validTime} from './physics-kit.js';
import {differentialStep} from './robot-vacuum-motion.js';
import {ROBOT, ROOM, START, GRID, blocked, floorCells, headOver, routeBlocked, sensorReadings} from './robot-vacuum-room.js';
export {ROBOT, ROOM, FURNITURE, START, GRID, blocked, underFurniture, headOver, sensorReadings} from './robot-vacuum-room.js';

// Deterministic illustrative controllers, not commercial navigation firmware.
// Exact no-slip SE(2) steps; ideal obstacle proximity leaves 10 mm clearance.
// Downward sensors reject a step into missing floor (20 ms sampling bound).
// Coverage is main-head passes / ALL exposed floor cells, not pickup efficiency
// or an allegedly exact set of reachable cells. Returning does not clean.
export const STRATEGY_OPTIONS = Object.freeze([{value: 0, label: 'Random bounce'}, {value: 1, label: 'Spiral, then bounce'}, {value: 2, label: 'Rows, then edges'}]);
export const ROOM_OPTIONS = Object.freeze([{value: 0, label: 'Empty room'}, {value: 1, label: 'Sofa and table'}, {value: 2, label: 'Open stairwell'}]);
export const CLEAN_DEFAULTS = Object.freeze({strategy: 0, room: 1});
export const CLEAN_DOMAINS = Object.freeze({strategy: [0, 2, 1], room: [0, 2, 1]});
export const ROBOT_DEFAULTS = Object.freeze({...CLEAN_DEFAULTS, session: 1, charge: 2, dockPower: 1});
export const ROBOT_DOMAINS = Object.freeze({...CLEAN_DOMAINS, session: [0, 3, 1], charge: [0, 2, 1], dockPower: [0, 1, 1]});
export const SESSION_MINUTES = Object.freeze([2, 5, 10, 20]);
export const INITIAL_CHARGE = Object.freeze([.2, .6, 1]);
export const SPIN_RATE = ROBOT.speed / ROBOT.wheelBase;
export const RUN_WATTS = Object.values(ROBOT.power).reduce((sum, watts) => sum + watts, 0);
export const BATTERY_JOULES = ROBOT.voltage * ROBOT.capacity * 3600;
export const RUNTIME = BATTERY_JOULES / RUN_WATTS;

const cache = new Map();
const DOING = ['ready', 'turning', 'backing off', 'spiraling', 'following an edge', 'shifting a lane', 'driving a row', 'driving'];
const MODES = ['bounce', 'spiral', 'rows', 'follow'];

export function cleaningPlan(input = {}) {
  const values = validateControls(input, CLEAN_DEFAULTS, CLEAN_DOMAINS, 'robot vacuum');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const {room, strategy} = values, {columns: nx, rows: ny} = GRID, c = ROOM.cell, dt = ROOM.dt, v = ROBOT.speed, b = ROBOT.wheelBase;
  const first = new Float64Array(nx * ny).fill(Infinity), span = Math.ceil(ROBOT.radius / c);
  let seed = 7;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  let x = START.x, y = START.y, h = START.heading, distance = 0, leftTravel = 0, rightTravel = 0, rowDirection = 1, spiralAngle = 0, followed = 0, target = null;
  const moved = (left, right) => differentialStep({x, y, h, distance, leftTravel, rightTravel}, left, right, dt, b);
  const drive = (left, right) => {({x, y, h, distance, leftTravel, rightTravel} = moved(left, right));};
  let mode = ['bounce', 'spiral', 'rows'][strategy], queue = [{type: 'lane', left: .22}, {type: 'turn', left: -Math.PI / 2}];
  const bumps = [], cliffs = [], events = [], path = [], reach = floorCells(room);
  let lastEvent = null;
  const mark = time => {
    const i0 = Math.floor(x / c), j0 = Math.floor(y / c);
    for (let j = Math.max(0, j0 - span); j <= Math.min(ny - 1, j0 + span); j++) for (let i = Math.max(0, i0 - span); i <= Math.min(nx - 1, i0 + span); i++) {
      const index = j * nx + i;
      if (reach.floor[index] && first[index] > time && headOver({x, y, h}, (i + .5) * c, (j + .5) * c)) first[index] = time;
    }
  };
  const bounce = () => [{type: 'back', left: ROBOT.backUp}, {type: 'turn', left: (100 + 160 * random()) * Math.PI / 180}];
  const spin = turn => {
    const step = Math.sign(turn) * Math.min(Math.abs(turn), SPIN_RATE * dt), wheelSpeed = step * b / (2 * dt);
    drive(-wheelSpeed, wheelSpeed);
    return {step, left: -wheelSpeed, right: wheelSpeed};
  };
  const obstruction = (pose, time) => {
    const missing = sensorReadings(pose, room).filter(sensor => !sensor.floor);
    if (missing.length) {
      cliffs.push(time); lastEvent = {t: time, type: 'cliff', points: missing}; events.push(lastEvent);
      return true;
    }
    if (blocked(pose.x, pose.y, room)) {
      bumps.push(time); lastEvent = {t: time, type: 'obstacle'}; events.push(lastEvent);
      return true;
    }
    return false;
  };
  const steps = Math.round(ROOM.duration / dt), every = Math.round(ROOM.every / dt);
  const ticks = new Float64Array((steps + 1) * 8), doingAt = new Uint8Array(steps + 1), modeAt = new Uint8Array(steps + 1);
  ticks.set([x, y, h, leftTravel, rightTravel, distance, 0, 0]);
  for (let n = 1; n <= steps; n++) {
    const t = n * dt, act = queue[0];
    let leftWheel = 0, rightWheel = 0, doing;
    if (act?.type === 'turn') {
      const {step, left, right} = spin(act.left);
      act.left -= step;
      doing = 'turning';
      leftWheel = left; rightWheel = right;
      if (Math.abs(act.left) < 1e-12) queue.shift();
    } else if (act?.type === 'back') {
      const step = Math.min(v * dt, act.left), nx1 = x - step * Math.cos(h), ny1 = y - step * Math.sin(h);
      doing = 'backing off';
      if (!blocked(nx1, ny1, room) && sensorReadings({x: nx1, y: ny1, h}, room).every(sensor => sensor.floor)) { leftWheel = rightWheel = -step / dt; drive(leftWheel, rightWheel); }
      act.left -= step;
      if (act.left <= 1e-12) queue.shift();
    } else if (mode === 'spiral' && act?.type !== 'lane') {
      const radius = Math.max(ROBOT.spiralStart, ROBOT.lane * spiralAngle / (2 * Math.PI)), turn = v * dt / radius;
      const left = v * (1 - b / (2 * radius)), right = v * (1 + b / (2 * radius)), next = moved(left, right);
      doing = 'spiraling';
      if (obstruction(next, t)) { mode = 'bounce'; queue = bounce(); }
      else { leftWheel = left; rightWheel = right; drive(leftWheel, rightWheel); spiralAngle += turn; }
    } else if (mode === 'follow') {
      doing = 'following an edge';
      if (target === null) {
        for (let k = 0; k <= 47 && target === null; k++) {
          const candidate = h - Math.PI / 18 + k * Math.PI / 36;
          if (!routeBlocked(x + v * dt * Math.cos(candidate), y + v * dt * Math.sin(candidate), room)) target = candidate;
        }
        if (target === null) { mode = 'bounce'; queue = bounce(); }
      }
      if (target !== null) {
        const turn = Math.atan2(Math.sin(target - h), Math.cos(target - h));
        if (Math.abs(turn) > 1e-12) { const step = spin(turn); leftWheel = step.left; rightWheel = step.right; }
        else {
          target = null;
          const nx1 = x + v * dt * Math.cos(h), ny1 = y + v * dt * Math.sin(h);
          if (!obstruction({x: nx1, y: ny1, h}, t)) { leftWheel = rightWheel = v; drive(leftWheel, rightWheel); followed += v * dt; if (followed >= ROBOT.lap) mode = 'bounce'; }
        }
      }
    } else {
      const shifting = act?.type === 'lane', stride = shifting ? Math.min(v * dt, act.left) : v * dt, nx1 = x + stride * Math.cos(h), ny1 = y + stride * Math.sin(h);
      doing = shifting ? 'shifting a lane' : mode === 'rows' ? 'driving a row' : 'driving';
      if (obstruction({x: nx1, y: ny1, h}, t)) {
        if (lastEvent.type === 'cliff') { mode = 'bounce'; queue = bounce(); }
        else
        if (mode === 'bounce') queue = bounce();
        else if (shifting) queue.shift();
        else {
          const shift = Math.min(ROBOT.lane, ROOM.depth - ROBOT.radius - ROBOT.clearance - y), side = rowDirection * Math.PI / 2;
          if (shift < 0.02) { mode = 'follow'; queue = [{type: 'back', left: ROBOT.backUp}, {type: 'turn', left: Math.PI / 2}]; }
          else { queue = [{type: 'back', left: ROBOT.backUp}, {type: 'turn', left: side}, {type: 'lane', left: shift}, {type: 'turn', left: side}]; rowDirection = -rowDirection; }
        }
      } else {
        leftWheel = rightWheel = stride / dt; drive(leftWheel, rightWheel);
        if (shifting) { act.left -= stride; if (act.left <= 1e-12) queue.shift(); }
      }
    }
    ticks.set([x, y, h, leftTravel, rightTravel, distance, leftWheel, rightWheel], n * 8);
    doingAt[n] = DOING.indexOf(doing); modeAt[n] = MODES.indexOf(mode);
    mark(t);
    if (n % every === 0) path.push({t, x, y, h, doing, mode, leftWheel, rightWheel, leftTravel, rightTravel, distance, bumps: bumps.length, cliffs: cliffs.length, event: lastEvent});
  }
  const counts = new Float64Array(ROOM.duration + 1);
  for (let index = 0; index < first.length; index++) if (reach.floor[index] && first[index] <= ROOM.duration) counts[Math.ceil(first[index])] += 1;
  for (let s = 1; s <= ROOM.duration; s++) counts[s] += counts[s - 1];
  const coverage = Array.from(counts, count => count / reach.floorCount);
  const plan = {values, path, ticks, doingAt, modeAt, first, bumps, cliffs, events, reach, coverage, distance, start: {t: 0, x: START.x, y: START.y, h: START.heading, doing: 'ready', mode: ['bounce', 'spiral', 'rows'][strategy], leftWheel: 0, rightWheel: 0, leftTravel: 0, rightTravel: 0, distance: 0, bumps: 0, cliffs: 0, event: null}};
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** Exact interpolation inside one constant-wheel-speed integration interval. */
export function cleaningPose(plan, time) {
  const clock = Math.max(0, Math.min(ROOM.duration, time)), tick = Math.min(Math.floor(clock / ROOM.dt + 1e-9), plan.ticks.length / 8 - 1), offset = tick * 8;
  const [x, y, h, leftTravel, rightTravel, distance] = plan.ticks.subarray(offset, offset + 6);
  const next = Math.min(offset + 8, plan.ticks.length - 8), leftWheel = plan.ticks[next + 6], rightWheel = plan.ticks[next + 7];
  const pose = differentialStep({x, y, h, leftTravel, rightTravel, distance}, leftWheel, rightWheel, Math.max(0, clock - tick * ROOM.dt), ROBOT.wheelBase);
  const index = Math.floor(clock / ROOM.every + 1e-9), state = index ? plan.path[index - 1] : plan.start;
  return {...state, ...pose, doing: clock === 0 ? 'ready' : DOING[plan.doingAt[next / 8]], mode: MODES[plan.modeAt[next / 8]], t: clock, leftWheel: clock === 0 ? 0 : leftWheel, rightWheel: clock === 0 ? 0 : rightWheel};
}
export function sampleCleaning(input = {}, time = 0) {
  validTime(time);
  const plan = cleaningPlan(input), clock = Math.min(ROOM.duration, time), now = cleaningPose(plan, clock);
  let swept = 0;
  for (let cell = 0; cell < plan.first.length; cell++) if (plan.first[cell] <= clock + 1e-9) swept++;
  return {...plan, now, clock, swept, coverage: swept / plan.reach.floorCount};
}

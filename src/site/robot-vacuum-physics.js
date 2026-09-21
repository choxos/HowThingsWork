import {validateControls, validTime} from './physics-kit.js';

// Robot vacuum cleaner: a round robot on two driven wheels cleaning a room by
// one of three strategies, with the floor it has swept tracked for twenty
// minutes.
//
// Units: SI inside. Readings convert to percent, minutes, meters and degrees.
//
// The robot. A disk 340 mm across on two wheels 230 mm apart. It drives at
// 0.28 m/s, both wheels together; it turns on the spot with its wheels at plus
// and minus half that, which spins it at (v_right - v_left) / b = 0.28 / 0.23
// rad/s; on a spiral each wheel runs at v (1 -+ b / (2 r)). Its main brush and
// side brush sweep a band 280 mm wide centered on it. A bump sensor stops it on
// contact with a wall or furniture, and it backs off 30 mm.
//
// Strategies. Random bounce: drive straight, and at every bump turn left by an
// angle drawn evenly between 100 and 260 degrees from a fixed seed. Spiral: wind
// outward from where it starts, the path's radius growing by one lane, 0.25 m,
// each turn, then bounce once it meets anything. Rows, then edges: drive to a
// wall, shift sideways one lane, drive back, and so on up the room, the last
// shift reaching as close to the far wall as it can; then one lap of 16 m along
// the edges, keeping the wall on its right: after each step forward it picks
// the rightmost direction, from 10 degrees right to 225 degrees left in 5 degree
// steps, that it can move in, and turns on the spot at its spin rate to face it
// before stepping again.
// Then it bounces at random to fill what it missed.
//
// The room: 4 m by 3 m, empty, or with a sofa 2 m by 0.9 m against the far
// wall and a table whose four legs, 50 mm across, stand in the open.
//
// Coverage. The floor is divided into 20 mm cells; a cell is swept once the
// robot's center passes within 140 mm of it. A round robot cannot reach every
// cell: the floor it can sweep is every cell within 140 mm of a spot its center
// can reach from the start while keeping 10 mm clear of everything, as real
// robots do. Coverage is the share of that floor swept so far.
//
// Battery: 14.4 V and 2.6 Ah, 37.44 Wh, feeding 33 W: 20 W for the suction fan,
// 5 W each for the brushes and wheels, and 3 W for the electronics.
//
// Not modeled: wheel slip and the errors a real robot's position estimate
// builds up, sensors seeing before contact, the dirt itself, and the robot
// going home to charge.

export const ROBOT = Object.freeze({radius: 0.17, wheelBase: 0.23, reach: 0.14, speed: 0.28, backUp: 0.03, lane: 0.25, spiralStart: 0.15, clearance: 0.01, lap: 16, voltage: 14.4, capacity: 2.6, power: Object.freeze({fan: 20, brushes: 5, wheels: 5, electronics: 3})});
export const ROOM = Object.freeze({width: 4, depth: 3, cell: 0.02, duration: 1200, dt: 0.02, every: 0.2});
export const FURNITURE = Object.freeze([
  Object.freeze({kind: 'box', x0: 0.2, x1: 2.2, y0: 2.1, y1: 3.0}),
  ...[[2.6, 1.0], [3.4, 1.0], [2.6, 1.7], [3.4, 1.7]].map(([x, y]) => Object.freeze({kind: 'leg', x, y, r: 0.025})),
]);
export const START = Object.freeze({x: 0.4, y: 0.17, heading: 0});
export const STRATEGY_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'Random bounce'}), Object.freeze({value: 1, label: 'Spiral, then bounce'}), Object.freeze({value: 2, label: 'Rows, then edges'})]);
export const ROOM_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'Empty room'}), Object.freeze({value: 1, label: 'Sofa and table'})]);
export const ROBOT_DEFAULTS = Object.freeze({strategy: 0, room: 1});
export const ROBOT_DOMAINS = Object.freeze({strategy: [0, 2, 1], room: [0, 1, 1]});

export const SPIN_RATE = ROBOT.speed / ROBOT.wheelBase;
export const RUN_WATTS = Object.values(ROBOT.power).reduce((sum, watts) => sum + watts, 0);
export const RUNTIME = ROBOT.voltage * ROBOT.capacity * 3600 / RUN_WATTS;
export const GRID = Object.freeze({columns: Math.round(ROOM.width / ROOM.cell), rows: Math.round(ROOM.depth / ROOM.cell)});

/** Whether a disk of radius R centered at (x, y) would overlap a wall or furniture. */
export function blocked(x, y, room, R = ROBOT.radius) {
  if (x < R || x > ROOM.width - R || y < R || y > ROOM.depth - R) return true;
  if (room === 0) return false;
  for (const f of FURNITURE) {
    if (f.kind === 'box') { const dx = Math.max(f.x0 - x, 0, x - f.x1), dy = Math.max(f.y0 - y, 0, y - f.y1); if (dx * dx + dy * dy < R * R) return true; }
    else if ((x - f.x) ** 2 + (y - f.y) ** 2 < (R + f.r) ** 2) return true;
  }
  return false;
}
/** Whether a floor cell's center lies under furniture. */
export const underFurniture = (x, y, room) => room === 1 && FURNITURE.some(f => (f.kind === 'box' ? x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1 : (x - f.x) ** 2 + (y - f.y) ** 2 < f.r * f.r));

/** Cells the robot could ever sweep: within reach of centers it can get to from the start with room to spare. */
export function sweepable(room) {
  const {columns: nx, rows: ny} = GRID, c = ROOM.cell, reachable = new Uint8Array(nx * ny), floor = new Uint8Array(nx * ny), stack = [];
  const free = (i, j) => !blocked((i + 0.5) * c, (j + 0.5) * c, room, ROBOT.radius + ROBOT.clearance);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) floor[j * nx + i] = underFurniture((i + 0.5) * c, (j + 0.5) * c, room) ? 0 : 1;
  const seedCell = Math.ceil((ROBOT.radius + ROBOT.clearance) / c) * nx + Math.floor(START.x / c);
  reachable[seedCell] = 1;
  stack.push(seedCell);
  while (stack.length) {
    const cell = stack.pop(), i = cell % nx, j = Math.floor(cell / nx);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj, index = b * nx + a;
      if (a >= 0 && b >= 0 && a < nx && b < ny && !reachable[index] && free(a, b)) { reachable[index] = 1; stack.push(index); }
    }
  }
  const sweep = new Uint8Array(nx * ny), span = Math.ceil(ROBOT.reach / c);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!reachable[j * nx + i]) continue;
    for (let b = Math.max(0, j - span); b <= Math.min(ny - 1, j + span); b++) for (let a = Math.max(0, i - span); a <= Math.min(nx - 1, i + span); a++) {
      if (((a - i) * c) ** 2 + ((b - j) * c) ** 2 <= ROBOT.reach ** 2 && floor[b * nx + a]) sweep[b * nx + a] = 1;
    }
  }
  return {reachable, floor, sweep, floorCount: floor.reduce((s, v) => s + v, 0), sweepCount: sweep.reduce((s, v) => s + v, 0)};
}

const cache = new Map();

export function robotPlan(input = {}) {
  const values = validateControls(input, ROBOT_DEFAULTS, ROBOT_DOMAINS, 'robot vacuum');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const {room, strategy} = values, {columns: nx, rows: ny} = GRID, c = ROOM.cell, dt = ROOM.dt, v = ROBOT.speed, b = ROBOT.wheelBase;
  const first = new Float32Array(nx * ny).fill(Infinity), span = Math.ceil(ROBOT.reach / c);
  let seed = 7;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  let x = START.x, y = START.y, h = START.heading, distance = 0, rowDirection = 1, spiralAngle = 0, followed = 0, target = null;
  let mode = ['bounce', 'spiral', 'rows'][strategy], queue = [];
  const bumps = [], path = [];
  const mark = time => {
    const i0 = Math.floor(x / c), j0 = Math.floor(y / c);
    for (let j = Math.max(0, j0 - span); j <= Math.min(ny - 1, j0 + span); j++) for (let i = Math.max(0, i0 - span); i <= Math.min(nx - 1, i0 + span); i++) {
      const index = j * nx + i;
      if (first[index] > time && ((i + 0.5) * c - x) ** 2 + ((j + 0.5) * c - y) ** 2 <= ROBOT.reach ** 2) first[index] = time;
    }
  };
  const bounce = () => [{type: 'back', left: ROBOT.backUp}, {type: 'turn', left: (100 + 160 * random()) * Math.PI / 180}];
  const spin = turn => { const step = Math.sign(turn) * Math.min(Math.abs(turn), SPIN_RATE * dt); h += step; return step; };
  mark(0);
  const steps = Math.round(ROOM.duration / dt), every = Math.round(ROOM.every / dt);
  for (let n = 1; n <= steps; n++) {
    const t = n * dt, act = queue[0];
    let leftWheel = 0, rightWheel = 0, doing;
    if (act?.type === 'turn') {
      const step = spin(act.left);
      act.left -= step;
      doing = 'turning';
      leftWheel = -Math.sign(step) * v / 2; rightWheel = Math.sign(step) * v / 2;
      if (Math.abs(act.left) < 1e-12) queue.shift();
    } else if (act?.type === 'back') {
      const step = Math.min(v * dt, act.left), nx1 = x - step * Math.cos(h), ny1 = y - step * Math.sin(h);
      doing = 'backing off';
      if (!blocked(nx1, ny1, room)) { x = nx1; y = ny1; distance += step; leftWheel = rightWheel = -v; }
      act.left -= step;
      if (act.left <= 1e-12) queue.shift();
    } else if (mode === 'spiral') {
      const radius = Math.max(ROBOT.spiralStart, ROBOT.lane * spiralAngle / (2 * Math.PI)), turn = v * dt / radius;
      const nx1 = x + v * dt * Math.cos(h + turn / 2), ny1 = y + v * dt * Math.sin(h + turn / 2);
      doing = 'spiraling';
      if (blocked(nx1, ny1, room)) { bumps.push(t); mode = 'bounce'; queue = bounce(); }
      else { x = nx1; y = ny1; h += turn; spiralAngle += turn; distance += v * dt; leftWheel = v * (1 - b / (2 * radius)); rightWheel = v * (1 + b / (2 * radius)); }
    } else if (mode === 'follow') {
      doing = 'following an edge';
      if (target === null) {
        for (let k = 0; k <= 47 && target === null; k++) {
          const candidate = h - Math.PI / 18 + k * Math.PI / 36;
          if (!blocked(x + v * dt * Math.cos(candidate), y + v * dt * Math.sin(candidate), room)) target = candidate;
        }
        if (target === null) { mode = 'bounce'; queue = bounce(); }
      }
      if (target !== null) {
        const turn = Math.atan2(Math.sin(target - h), Math.cos(target - h));
        if (Math.abs(turn) > SPIN_RATE * dt) { const step = spin(turn); leftWheel = -Math.sign(step) * v / 2; rightWheel = Math.sign(step) * v / 2; }
        else {
          h = target;
          target = null;
          const nx1 = x + v * dt * Math.cos(h), ny1 = y + v * dt * Math.sin(h);
          if (!blocked(nx1, ny1, room)) { x = nx1; y = ny1; distance += v * dt; followed += v * dt; leftWheel = rightWheel = v; if (followed >= ROBOT.lap) mode = 'bounce'; }
        }
      }
    } else {
      const shifting = act?.type === 'lane', stride = shifting ? Math.min(v * dt, act.left) : v * dt, nx1 = x + stride * Math.cos(h), ny1 = y + stride * Math.sin(h);
      doing = shifting ? 'shifting a lane' : mode === 'rows' ? 'driving a row' : 'driving';
      if (blocked(nx1, ny1, room)) {
        bumps.push(t);
        if (mode === 'bounce') queue = bounce();
        else if (shifting) queue.shift();
        else {
          const shift = Math.min(ROBOT.lane, ROOM.depth - ROBOT.radius - ROBOT.clearance - y), side = rowDirection * Math.PI / 2;
          if (shift < 0.02) { mode = 'follow'; queue = [{type: 'back', left: ROBOT.backUp}, {type: 'turn', left: Math.PI / 2}]; }
          else { queue = [{type: 'back', left: ROBOT.backUp}, {type: 'turn', left: side}, {type: 'lane', left: shift}, {type: 'turn', left: side}]; rowDirection = -rowDirection; }
        }
      } else {
        x = nx1; y = ny1; distance += stride; leftWheel = rightWheel = v;
        if (shifting) { act.left -= stride; if (act.left <= 1e-12) queue.shift(); }
      }
    }
    mark(t);
    if (n % every === 0) path.push({t, x, y, h, doing, mode, leftWheel, rightWheel, distance, bumps: bumps.length});
  }
  const reach = sweepable(room), counts = new Float64Array(ROOM.duration + 1);
  for (let index = 0; index < first.length; index++) if (reach.sweep[index] && first[index] <= ROOM.duration) counts[Math.ceil(first[index])] += 1;
  for (let s = 1; s <= ROOM.duration; s++) counts[s] += counts[s - 1];
  const coverage = Array.from(counts, count => count / reach.sweepCount);
  const plan = {values, path, first, bumps, reach, coverage, distance, start: {t: 0, x: START.x, y: START.y, h: START.heading, doing: 'ready', mode: ['bounce', 'spiral', 'rows'][strategy], leftWheel: 0, rightWheel: 0, distance: 0, bumps: 0}};
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** The robot and the floor some seconds into the run. */
export function sampleRobot(input = {}, time = 0) {
  validTime(time);
  const plan = robotPlan(input), clock = Math.min(ROOM.duration, time), index = Math.floor(clock / ROOM.every + 1e-9);
  const now = index === 0 ? plan.start : plan.path[index - 1];
  let swept = 0;
  for (let cell = 0; cell < plan.first.length; cell++) if (plan.first[cell] <= clock && plan.reach.sweep[cell]) swept++;
  const coverage = swept / plan.reach.sweepCount;
  return {...plan, clock, now, coverage, battery: 1 - RUN_WATTS * clock / (ROBOT.voltage * ROBOT.capacity * 3600), minutesLeft: (RUNTIME - clock) / 60};
}

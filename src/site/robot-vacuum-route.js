import {ROBOT, ROOM, START, FURNITURE, DROP, routeBlocked} from './robot-vacuum-room.js';

function pointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function segmentsDistance(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const opposite = (u, v) => u * v <= 0;
  const boxesOverlap = Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
  if (boxesOverlap && opposite(cross(a, b, c), cross(a, b, d)) && opposite(cross(c, d, a), cross(c, d, b))) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}
/** Exact clearance of the entire straight segment, including rounded box corners. */
export function clearSegment(a, b, room) {
  if (routeBlocked(a.x, a.y, room) || routeBlocked(b.x, b.y, room)) return false;
  const radius = ROBOT.radius + ROBOT.clearance;
  const obstacles = room === 1 ? FURNITURE : room === 2 ? [DROP] : [];
  return obstacles.every(o => {
    if (o.kind === 'leg') return pointSegment(o, a, b) >= radius + o.r - 1e-12;
    const corners = [{x: o.x0, y: o.y0}, {x: o.x1, y: o.y0}, {x: o.x1, y: o.y1}, {x: o.x0, y: o.y1}];
    return corners.every((c, i) => segmentsDistance(a, b, c, corners[(i + 1) % 4]) >= radius - 1e-12);
  });
}
export const STAGING = Object.freeze({x: START.x, y: .6});
const maps = new Map();
const CELL = .05, NX = Math.round(ROOM.width / CELL), NY = Math.round(ROOM.depth / CELL);
const point = i => ({x: (i % NX + .5) * CELL, y: (Math.floor(i / NX) + .5) * CELL});
function dockMap(room) {
  if (maps.has(room)) return maps.get(room);
  const parent = new Int32Array(NX * NY).fill(-2), queue = [], free = new Uint8Array(parent.length);
  for (let i = 0; i < free.length; i++) {const p = point(i); free[i] = routeBlocked(p.x, p.y, room) ? 0 : 1;}
  for (let i = 0; i < free.length; i++) {
    if (free[i] && Math.hypot(point(i).x - STAGING.x, point(i).y - STAGING.y) < .12 && clearSegment(point(i), STAGING, room)) {parent[i] = -1; queue.push(i);}
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], x = i % NX, y = Math.floor(i / NX);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * NX + xx;
      if (xx >= 0 && xx < NX && yy >= 0 && yy < NY && free[j] && parent[j] === -2 && clearSegment(point(i), point(j), room)) {parent[j] = i; queue.push(j);}
    }
  }
  const map = {parent, free}; maps.set(room, map); return map;
}
/** Ideal known-map planner. A grid finds a connected route; visibility shortens it. */
export function returnRoute(start, room) {
  if (clearSegment(start, STAGING, room)) return [{x: start.x, y: start.y}, {x: STAGING.x, y: STAGING.y}];
  const {parent} = dockMap(room);
  const candidates = Array.from(parent, (_, i) => i).filter(i => parent[i] !== -2).sort((a, b) => Math.hypot(point(a).x - start.x, point(a).y - start.y) - Math.hypot(point(b).x - start.x, point(b).y - start.y));
  const first = candidates.find(i => clearSegment(start, point(i), room));
  if (first === undefined) throw new Error('No clear return route from the robot to its dock.');
  const raw = [{x: start.x, y: start.y}];
  for (let i = first; i !== -1; i = parent[i]) raw.push(point(i));
  raw.push({x: STAGING.x, y: STAGING.y});
  const route = [raw[0]];
  for (let at = 0; at < raw.length - 1;) {
    let next = raw.length - 1;
    while (next > at + 1 && !clearSegment(raw[at], raw[next], room)) next--;
    route.push(raw[next]); at = next;
  }
  return route;
}

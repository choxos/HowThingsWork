// Assigned teaching dimensions, in meters. These are not product specifications.
export const ROBOT = Object.freeze({radius: .17, wheelBase: .23, wheelRadius: .035, speed: .28, backUp: .05, lane: .22, spiralStart: .15, clearance: .01, lap: 16, voltage: 14.4, capacity: 2.6, sensorRadius: .16, rollerX: .055, rollerHalfLength: .0225, rollerHalfWidth: .105, power: Object.freeze({fan: 20, brushes: 5, wheels: 5, electronics: 3})});
export const ROOM = Object.freeze({width: 4, depth: 3, cell: .02, duration: 1200, dt: .02, every: .2});
export const FURNITURE = Object.freeze([
  Object.freeze({kind: 'box', x0: .2, x1: 2.2, y0: 2.1, y1: 3}),
  ...[[2.6, 1], [3.4, 1], [2.6, 1.7], [3.4, 1.7]].map(([x, y]) => Object.freeze({kind: 'leg', x, y, r: .025})),
]);
export const DROP = Object.freeze({x0: 1.45, x1: 2.55, y0: 2.2, y1: 3});
export const START = Object.freeze({x: .4, y: ROBOT.radius + ROBOT.clearance, heading: Math.PI / 2});
export const GRID = Object.freeze({columns: Math.round(ROOM.width / ROOM.cell), rows: Math.round(ROOM.depth / ROOM.cell)});
export const CLIFF_SENSORS = Object.freeze(Array.from({length: 8}, (_, i) => Object.freeze({x: ROBOT.sensorRadius * Math.cos(i * Math.PI / 4), y: ROBOT.sensorRadius * Math.sin(i * Math.PI / 4)})));
export const onDrop = (x, y, room) => room === 2 && x >= DROP.x0 && x <= DROP.x1 && y >= DROP.y0 && y <= DROP.y1;
export const underFurniture = (x, y, room) => room === 1 && FURNITURE.some(f => f.kind === 'box' ? x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1 : (x - f.x) ** 2 + (y - f.y) ** 2 <= f.r ** 2);
export const floorAt = (x, y, room) => x >= 0 && x <= ROOM.width && y >= 0 && y <= ROOM.depth && !onDrop(x, y, room);
const nearBox = (x, y, box, radius) => Math.max(box.x0 - x, 0, x - box.x1) ** 2 + Math.max(box.y0 - y, 0, y - box.y1) ** 2 < radius ** 2;
/** Solid obstacles, distinct from missing floor. The proximity cutoff leaves 10 mm. */
export function blocked(x, y, room, radius = ROBOT.radius + ROBOT.clearance) {
  if (x < radius || x > ROOM.width - radius || y < radius || y > ROOM.depth - radius) return true;
  return room === 1 && FURNITURE.some(f => f.kind === 'box' ? nearBox(x, y, f, radius) : (x - f.x) ** 2 + (y - f.y) ** 2 < (radius + f.r) ** 2);
}
/** A conservative disk footprint used only for planning the return route. */
export const routeBlocked = (x, y, room, radius = ROBOT.radius + ROBOT.clearance) => blocked(x, y, room, radius) || room === 2 && nearBox(x, y, DROP, radius);
export function sensorReadings(pose, room) {
  const c = Math.cos(pose.h), s = Math.sin(pose.h);
  return CLIFF_SENSORS.map((p, index) => {
    const x = pose.x + p.x * c - p.y * s, y = pose.y + p.x * s + p.y * c;
    return {index, x, y, floor: floorAt(x, y, room)};
  });
}
export function floorCells(room) {
  const {columns, rows} = GRID, floor = new Uint8Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = (i + .5) * ROOM.cell, y = (j + .5) * ROOM.cell;
    floor[j * columns + i] = floorAt(x, y, room) && !underFurniture(x, y, room) ? 1 : 0;
  }
  return {floor, floorCount: floor.reduce((sum, value) => sum + value, 0)};
}
/** Main cleaning-head footprint. Side-brush contact alone is not counted as pickup. */
export function headOver(pose, x, y) {
  const dx = x - pose.x, dy = y - pose.y, c = Math.cos(pose.h), s = Math.sin(pose.h);
  return Math.abs(dx * c + dy * s - ROBOT.rollerX) <= ROBOT.rollerHalfLength && Math.abs(-dx * s + dy * c) <= ROBOT.rollerHalfWidth;
}

import * as THREE from 'three';
import {UPRIGHT, uprightDuctArea} from './upright-vacuum-physics.js';
import {routeTable, tracePoint, annulusGeometry, plateGeometry, MM, point} from './vacuum-cleaner-geometry.js';

export {routeTable, tracePoint, annulusGeometry, plateGeometry, MM, point};
const TAU = 2 * Math.PI;
const LEAN = Math.PI / 10, ELBOW = 70;
const elbowEnd = [125 + ELBOW * Math.cos(LEAN), 100 + ELBOW - ELBOW * Math.sin(LEAN), 0];
const straightToBag = (240 - elbowEnd[1]) / Math.cos(LEAN);
export const UG = Object.freeze({
  brush: Object.freeze([-110, 35, 0]), fan: Object.freeze([45, 100, 0]), beltZ: -170,
  brushRadius: 30, brushCore: 14, brushHalfLength: 146, fanRadius: 66,
  fanExit: Object.freeze([125, 100, 0]), bagBottom: Object.freeze([elbowEnd[0] + straightToBag * Math.sin(LEAN), 240, 0]),
  lean: LEAN, bagHeight: 680, bagHalfWidth: 100, bagHalfDepth: 55,
  coverHalfWidth: 125, coverHalfDepth: 70, floorTop: 5,
});
export const bagPoint = (x, h, z = 0) => [UG.bagBottom[0] + x * Math.cos(UG.lean) + h * Math.sin(UG.lean), UG.bagBottom[1] - x * Math.sin(UG.lean) + h * Math.cos(UG.lean), z];
const length = (a, b) => Math.hypot(...a.map((n, k) => b[k] - n));
const elbowLength = ELBOW * (Math.PI / 2 - LEAN);
/** Circular elbow followed by its exact tangent. Arc-length parameterization
 * avoids tight spline bends that would make a 44 mm tube fold into itself. */
class UprightDuctCurve extends THREE.Curve {
  getPoint(t, target = new THREE.Vector3()) {
    const distance = t * UPRIGHT.ductLength * 1000;
    if (distance <= elbowLength) {const angle = -Math.PI / 2 + distance / ELBOW;return target.set(125 + ELBOW * Math.cos(angle), 100 + ELBOW + ELBOW * Math.sin(angle), 0);}
    return target.set(elbowEnd[0] + (distance - elbowLength) * Math.sin(LEAN), elbowEnd[1] + (distance - elbowLength) * Math.cos(LEAN), 0);
  }
  getPointAt(t, target) {return this.getPoint(t, target);}
  getTangent(t, target = new THREE.Vector3()) {const angle = -Math.PI / 2 + Math.min(t * UPRIGHT.ductLength * 1000, elbowLength) / ELBOW;return target.set(-Math.sin(angle), Math.cos(angle), 0);}
  getTangentAt(t, target) {return this.getTangent(t, target);}
  getLength() {return UPRIGHT.ductLength * 1000;}
}
let paths;

export function uprightPaths() {
  if (paths) return paths;
  const fill = UPRIGHT.ductLength * 1000 - elbowLength - straightToBag, curve = new UprightDuctCurve();
  const samples = curve.getSpacedPoints(240).map(v => v.toArray());
  const end = samples.at(-1), piece = (points, area, label) => ({points, area, label});
  const eye = [[-35, 35, -75], [10, 70, -60], [45, 118, -44], [45, 118, 0]];
  const impeller = [[45, 118, 0], [98, 132, 0], [117, 122, 0], UG.fanExit];
  const downstream = [piece(eye, .004, 'brush chamber and fan eye'), piece(impeller, .0024, 'impeller and collector'), piece(samples, uprightDuctArea, 'discharge duct')];
  const air = [], dust = [];
  for (const raised of [0, 1]) {
    const lift = raised * UPRIGHT.raisedBy * 1000, area = UPRIGHT.width * UPRIGHT.workingGap + raised * UPRIGHT.raisedBy * 2 * (UPRIGHT.width + UPRIGHT.headLength);
    const mouth = [-175, 8, -80];
    air.push(routeTable([
      piece([mouth, [-160, 8, -80]], area, 'floor entry'),
      piece([[-160, 8, -80], [-70, 8, -80], eye[0]], .004, 'brush chamber'), ...downstream,
      piece([end, bagPoint(0, fill + 35)], uprightDuctArea, 'bag entry jet'),
      piece([bagPoint(0, fill + 35), bagPoint(0, fill + 42, -53)], UPRIGHT.bagArea, 'paper bag'),
      piece([bagPoint(0, fill + 42, -53), bagPoint(0, fill + 42, -68)], UPRIGHT.coverArea, 'outer cover'),
      piece([bagPoint(0, fill + 42, -68), bagPoint(0, fill + 42, -95)], UPRIGHT.outletArea, 'room'),
    ]));
    dust.push(Array.from({length: UPRIGHT.markerCount}, (_, i) => {
      const lane = i % UPRIGHT.looseCount, z = -100 + 40 * lane;
      // Floor is stationary when the head rises. All subsequent points are in
      // the machine frame, shifted upward together by the head-height control.
      const home = [i < UPRIGHT.looseCount ? -203 : UG.brush[0], 8 - lift, z];
      const intake = i < UPRIGHT.looseCount
        ? [piece([home, [-175, 8, z]], area, 'floor entry'), piece([[-175, 8, z], [-70, 8, z], eye[0]], .004, 'brush chamber')]
        : [piece([home, [-70, 8, z], eye[0]], .004, 'brush chamber')];
      const deposit = bagPoint(-30 + 12 * lane, fill + (i < 6 ? 30 : 54), -52);
      const route = routeTable([...intake, ...downstream, piece([end, bagPoint(0, fill + 35)], uprightDuctArea, 'bag entry jet'), piece([bagPoint(0, fill + 35), deposit], UPRIGHT.bagArea, 'capture on paper')]);
      return {home, deposit, route, entryVolume: i < UPRIGHT.looseCount ? length(home, [-175, 8, z]) / 1000 * area : 0};
    }));
  }
  paths = {fill, curve, samples, end, air, dust};return paths;
}

/** Exact outer tangents and wrap arcs for an open belt. The path runs
 * clockwise; markers move backward along it for the positive shaft rotation. */
export function uprightBelt() {
  const a = UG.brush.slice(0, 2), b = UG.fan.slice(0, 2), r0 = UPRIGHT.drivenRadius * 1000, r1 = UPRIGHT.driverRadius * 1000;
  const dx = b[0] - a[0], dy = b[1] - a[1], span = Math.hypot(dx, dy), axis = Math.atan2(dy, dx), alpha = Math.acos((r0 - r1) / span);
  const plus = axis + alpha, minus = axis - alpha;
  const on = (center, radius, angle) => [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle), UG.beltZ];
  const ap = on(a, r0, plus), bp = on(b, r1, plus), bm = on(b, r1, minus), am = on(a, r0, minus);
  const line = (from, to) => ({type: 'line', from, to, length: length(from, to)});
  const arc = (center, radius, start, delta) => ({type: 'arc', center, radius, start, delta, length: Math.abs(radius * delta)});
  const sections = [line(ap, bp), arc(b, r1, plus, -2 * alpha), line(bm, am), arc(a, r0, minus, -TAU + 2 * alpha)];
  let total = 0;for (const s of sections) {s.offset = total;total += s.length;}
  const at = distance => {
    const d = ((distance % total) + total) % total, s = sections.find(p => d < p.offset + p.length) || sections.at(-1), u = (d - s.offset) / s.length;
    let p, tangent;
    if (s.type === 'line') {p = s.from.map((n, k) => n + (s.to[k] - n) * u);tangent = s.from.map((n, k) => (s.to[k] - n) / s.length);}
    else {const angle = s.start + s.delta * u;p = on(s.center, s.radius, angle);tangent = [Math.sin(angle), -Math.cos(angle), 0];}
    return {point: p, tangent, normal: [-tangent[1], tangent[0], 0]};
  };
  return {a, b, r0, r1, span, sections, length: total, at};
}

/** A flat rectangular belt with actual inner, outer and edge faces. */
export function uprightBeltGeometry(belt) {
  const vertices = [], quad = (a, b, c, d) => vertices.push(...point(a), ...point(b), ...point(c), ...point(a), ...point(c), ...point(d));
  const ring = distance => {const s = belt.at(distance);return [[-1, -4], [1, -4], [1, 4], [-1, 4]].map(([n, z]) => s.point.map((v, k) => v + s.normal[k] * n + (k === 2 ? z : 0)));};
  const count = 600;
  for (let i = 0; i < count; i++) {const a = ring(i * belt.length / count), b = ring((i + 1) * belt.length / count);for (let edge = 0; edge < 4; edge++) quad(a[edge], b[edge], b[(edge + 1) % 4], a[(edge + 1) % 4]);}
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));geometry.computeVertexNormals();return geometry;
}

/** Hollow tube using a sampled parallel-transport frame, with annular end
 * faces and explicit inner faces. Caps never seal the airflow bore. */
export function uprightDuctGeometry(curve) {
  const frames = curve.computeFrenetFrames(480, false), vertices = [], quad = (a, b, c, d) => vertices.push(...point(a), ...point(b), ...point(c), ...point(a), ...point(c), ...point(d));
  const at = (i, j, radius) => {const p = curve.getPointAt(i / 480), angle = TAU * j / 32;return p.addScaledVector(frames.normals[i], radius * Math.cos(angle)).addScaledVector(frames.binormals[i], radius * Math.sin(angle)).toArray();};
  for (let i = 0; i < 480; i++) for (let j = 0; j < 32; j++) for (const radius of [20, 22]) quad(at(i, j, radius), at(i + 1, j, radius), at(i + 1, j + 1, radius), at(i, j + 1, radius));
  for (const i of [0, 480]) for (let j = 0; j < 32; j++) quad(at(i, j, 20), at(i, j + 1, 20), at(i, j + 1, 22), at(i, j, 22));
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));geometry.computeVertexNormals();return geometry;
}

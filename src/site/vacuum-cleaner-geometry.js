import * as THREE from 'three';
import {CLEANER, cleanerHoseArea} from './vacuum-cleaner-physics.js';

export const MM = .004;
export const point = a => a.map(n => n * MM);
export const G = Object.freeze({
  wandStart: Object.freeze([-350, 130, 180]), handle: Object.freeze([-150, 710, 180]),
  mouth: Object.freeze([-426, 3, 180]), neck: Object.freeze([-350 - 200 * 82 / 580, 48, 180]),
  inlet: Object.freeze([0, 220, 0]), bagEntry: Object.freeze([50, 220, 0]),
  bagArea: .04, pipeInner: 16, pipeOuter: 18, creviceLength: 120,
  caseLength: 470, caseBottom: 80, caseTop: 360, caseHalfWidth: 145,
  fanX: 308, axisY: 230, fanRadius: 68, shaftRadius: 5,
});
const TAU = 2 * Math.PI;
const length = (a, b) => Math.hypot(...a.map((v, k) => b[k] - v));
const direction = G.wandStart.map((v, k) => v - G.handle[k]);
const wandLength = Math.hypot(...direction);
export const creviceDirection = direction.map(v => v / wandLength);
export const creviceTip = G.wandStart.map((v, k) => v + creviceDirection[k] * G.creviceLength);
const hosePoints = depth => [G.handle, G.handle.map((v, k) => v - creviceDirection[k] * 90), [-70, 780, -100], [-120, 400, -depth], [-180, 63, -depth * .7], [-160, 50, 70], [-90, 90, 100], [-70, 190, 0], [-50, 220, 0], G.inlet];
const curveOf = points => {const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));curve.arcLengthDivisions = 4096;return curve;};
let pathCache;

/** Millimeter geometry; hose and straight wand together match the modeled
 * pipe length. The compact hose loops in depth instead of spreading the two
 * ends across a long, nearly empty scene. */
export function cleanerPaths() {
  if (pathCache) return pathCache;
  const target = CLEANER.hoseLength * 1000 - wandLength;
  let lo = 100, hi = 1200;
  if (curveOf(hosePoints(lo)).getLength() > target || curveOf(hosePoints(hi)).getLength() < target) throw new RangeError('Hose length cannot fit inside its design bounds');
  for (let i = 0; i < 48; i++) {const mid = (lo + hi) / 2;if (curveOf(hosePoints(mid)).getLength() < target) lo = mid;else hi = mid;}
  const depth = (lo + hi) / 2, hoseCurve = curveOf(hosePoints(depth));
  const hoseSamples = hoseCurve.getSpacedPoints(320).map(v => v.toArray());
  const piece = (points, area, label) => ({points, area, label});
  const shared = [piece([G.wandStart, G.handle], cleanerHoseArea, 'wand'), piece(hoseSamples, cleanerHoseArea, 'hose'), piece([G.inlet, G.bagEntry], cleanerHoseArea, 'bag inlet')];
  const entry = [
    [piece([G.mouth, [-416, 3, 180]], .25 * .006, 'head slot'), piece([[-416, 3, 180], [-390, 24, 180], G.neck], .25 * .042, 'head chamber'), piece([G.neck, G.wandStart], cleanerHoseArea, 'head neck')],
    [piece([creviceTip, G.wandStart], .025 * .012, 'crevice tool')],
  ];
  const downstream = [piece([G.bagEntry, [230, 220, 0]], G.bagArea, 'bag'), piece([[230, 220, 0], [268, 220, 0]], G.bagArea, 'pre-motor filter'), piece([[268, 220, 0], [280, 230, 18], [308, 230, 18]], Math.PI * (.026 ** 2 - .005 ** 2), 'fan eye'), piece([[308, 230, 18], [308, 275, 0], [315, 312, 0], [350, 325, 0]], .003, 'impeller and collector'), piece([[350, 325, 0], [480, 325, 0]], CLEANER.outletArea, 'exhaust')];
  const air = entry.map(start => routeTable([...start, ...shared, ...downstream]));
  const dust = entry.map((start, fitted) => Array.from({length: CLEANER.markerCount}, (_, i) => {
    const lane = (i % 3 - 1) * (fitted ? 6 : 45), column = Math.floor(i / 3);
    const mouth = (fitted ? creviceTip : G.mouth).map((v, k) => k === 2 ? v + lane : v);
    const home = [mouth[0] - 24 - column * 17, 2.6, mouth[2]];
    const deposit = [75 + column * 36, 124, (i % 3 - 1) * 48];
    const approach = piece([home, mouth], fitted ? .025 * .012 : .25 * .006, 'floor');
    const intoHead = {...start[0], points: [mouth, ...start[0].points.slice(1)]};
    const capture = piece([G.bagEntry, [110, 208, deposit[2]], deposit], G.bagArea, 'capture in bag');
    const route = routeTable([approach, intoHead, ...start.slice(1), ...shared, capture]);
    return {route, home, mouth, deposit, entryVolume: length(home, mouth) / 1000 * approach.area};
  }));
  pathCache = {depth, wandLength, hoseCurve, hoseSamples, air, dust};return pathCache;
}

/** Arc lengths and corresponding displaced air volumes, using each explicitly
 * assigned representative section area. These are tracer paths, not a CFD
 * reconstruction of the three-dimensional velocity field. */
export function routeTable(pieces) {
  const segments = [];let volume = 0;
  for (const piece of pieces) for (let i = 1; i < piece.points.length; i++) {
    const a = piece.points[i - 1], b = piece.points[i], distance = length(a, b), capacity = distance / 1000 * piece.area;
    if (capacity <= 0) continue;
    segments.push({a, b, area: piece.area, distance, start: volume, capacity, label: piece.label});volume += capacity;
  }
  return {segments, volume};
}

export function tracePoint(route, volume) {
  const first = route.segments[0], last = route.segments.at(-1);
  if (volume <= 0) return [...first.a];
  if (volume >= route.volume) return [...last.b];
  const segment = route.segments.find(s => volume < s.start + s.capacity) || last, u = (volume - segment.start) / segment.capacity;
  return segment.a.map((v, k) => v + (segment.b[k] - v) * u);
}

export function annulusGeometry(inner, outer, height, start = 0, span = TAU) {
  return new THREE.LatheGeometry([[inner, -height / 2], [outer, -height / 2], [outer, height / 2], [inner, height / 2], [inner, -height / 2]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), 96, start, span);
}

/** Rectangular plate with a true through-opening, initially in the xy plane. */
export function plateGeometry(width, height, depth, hole) {
  const shape = new THREE.Shape();shape.moveTo(-width / 2, -height / 2);shape.lineTo(width / 2, -height / 2);shape.lineTo(width / 2, height / 2);shape.lineTo(-width / 2, height / 2);shape.closePath();
  if (hole) {
    const p = new THREE.Path(), x = hole.x || 0, y = hole.y || 0;
    if (hole.radius) p.absarc(x, y, hole.radius, 0, TAU, true);
    else {p.moveTo(x - hole.width / 2, y - hole.height / 2);p.lineTo(x - hole.width / 2, y + hole.height / 2);p.lineTo(x + hole.width / 2, y + hole.height / 2);p.lineTo(x + hole.width / 2, y - hole.height / 2);p.closePath();}
    shape.holes.push(p);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 64});geometry.translate(0, 0, -depth / 2);geometry.scale(MM, MM, MM);return geometry;
}

/** Hollow rectangular crevice mouth transitions to the circular wand socket.
 * Both ends stay open; wall thickness is represented by explicit inner faces. */
export function creviceGeometry() {
  const vertices = [], angles = [...Array.from({length: 64}, (_, i) => TAU * i / 64), ...[-1, 1].flatMap(x => [-1, 1].flatMap(z => [Math.atan2(z * 12.5, x * 6), Math.atan2(z * 14.5, x * 8)].map(a => (a + TAU) % TAU)))].sort((a, b) => a - b);
  const quad = (a, b, c, d) => vertices.push(...point(a), ...point(b), ...point(c), ...point(a), ...point(c), ...point(d));
  const ring = (a, y, outer) => {
    const c = Math.cos(a), s = Math.sin(a), radius = y === 120 ? (outer ? 18 : 16) : Math.min((outer ? 8 : 6) / Math.max(1e-12, Math.abs(c)), (outer ? 14.5 : 12.5) / Math.max(1e-12, Math.abs(s)));
    return [radius * c, y, radius * s];
  };
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i], b = angles[(i + 1) % angles.length];
    for (const [bottom, top] of [[0, 85], [85, 120]]) for (const outer of [false, true]) quad(ring(a, bottom, outer), ring(b, bottom, outer), ring(b, top, outer), ring(a, top, outer));
    for (const y of [0, 120]) quad(ring(a, y, false), ring(b, y, false), ring(b, y, true), ring(a, y, true));
  }
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));geometry.computeVertexNormals();return geometry;
}

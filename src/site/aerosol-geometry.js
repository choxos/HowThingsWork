import * as THREE from 'three';

export const MM = 0.006;
export const point = p => p.map(v => v * MM);
// Choose the straight-wall height so cylinder + shoulder - base dome holds
// exactly 500 mL before the declared neglect of internal-component volume.
const shoulderArea = (32.5 ** 2 + 32.5 * 13.5 + 13.5 ** 2) / 3;
const wallTop = (500000 / Math.PI + 30 ** 2 * 12 / 2 - 165 * shoulderArea) / (32.5 ** 2 - shoulderArea);
export const CAN = Object.freeze({radius: 32.5, dome: 12, chine: 30, wallTop, shoulderTop: 165, neck: 13.5, actuatorTop: 190});
export const bottomAt = radius => (radius <= CAN.chine ? CAN.dome * (1 - (radius / CAN.chine) ** 2) : 0);
export const radiusAt = y => (y <= CAN.wallTop ? CAN.radius : y <= CAN.shoulderTop ? CAN.radius + (CAN.neck - CAN.radius) * (y - CAN.wallTop) / (CAN.shoulderTop - CAN.wallTop) : CAN.neck);
/** The can's inside volume below a height, in cubic millimeters. */
export function volumeBelow(height) {
  const {radius: R, dome: D, chine: C, wallTop: W, shoulderTop: S} = CAN, y = Math.max(0, Math.min(S, height));
  const low = Math.min(y, D), dome = Math.PI * (R * R * low - C * C * (low - low * low / (2 * D)));
  const wall = y > D ? Math.PI * R * R * (Math.min(y, W) - D) : 0;
  const shoulder = y > W ? Math.PI * (y - W) / 3 * (R * R + R * radiusAt(y) + radiusAt(y) ** 2) : 0;
  return dome + wall + shoulder;
}
export const BRIMFUL = volumeBelow(CAN.shoulderTop);
/** Height of the liquid's surface for a volume in cubic meters: standing, it fills from the bottom; upside down, from the valve end. */
export function levelFor(volume, upright) {
  const target = volume * 1e9;
  let lo = 0, hi = CAN.shoulderTop;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, filled = upright ? volumeBelow(mid) : BRIMFUL - volumeBelow(mid);
    if (upright ? filled < target : filled > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** The liquid's cross-section as a closed outline of [radius, height] in millimeters. */
export function liquidOutline(level, upright) {
  const {radius: R, dome: D, chine: C, wallTop: W, shoulderTop: S, neck} = CAN, points = [];
  if (upright) {
    const inner = level < D ? C * Math.sqrt(1 - level / D) : 0;
    if (level >= D) points.push([0, level]);
    for (let k = 0; k <= 12; k++) { const radius = inner + (C - inner) * k / 12; points.push([radius, bottomAt(radius)]); }
    points.push([R, 0]);
    if (level > W) points.push([R, W]);
    points.push([radiusAt(level), level]);
  } else {
    points.push([0, level], [radiusAt(level), level]);
    if (level < W) points.push([R, W]);
    points.push([neck, S], [0, S]);
  }
  points.push(points[0]);
  return points;
}

export const lathe = (profile, start = 0, span = 2 * Math.PI) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * MM, y * MM)), 96, start, span);
export const hollowCylinder = (inner, outer, length, start = 0, span = 2 * Math.PI) => lathe([[inner, -length / 2], [outer, -length / 2], [outer, length / 2], [inner, length / 2], [inner, -length / 2]], start, span);

// Actual radial openings through both stem walls, not painted dots. A fixed
// annular gasket spans y=164..166 mm. Pressing 2.4 mm exposes both ports.
export const VALVE = Object.freeze({travel: 2.4, portLow: 164.6, portHigh: 165.4, inner: 1, outer: 1.8, stemBottom: 158, stemTop: 180, gasketLow: 164, gasketHigh: 166});
export function stemGeometry() {
  const positions = [], N = 96, levels = [VALVE.stemBottom, VALVE.portLow, VALVE.portHigh, VALVE.stemTop];
  const pointAt = (r, k, y) => [r * Math.sin(2 * Math.PI * k / N) * MM, y * MM, r * Math.cos(2 * Math.PI * k / N) * MM];
  const quad = (a, b, c, d) => positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  const port = k => k < 4 || k >= N - 4 || (k >= N / 2 - 4 && k < N / 2 + 4);
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < 3; j++) {
      if (j === 1 && port(k)) continue;
      for (const r of [VALVE.outer, VALVE.inner]) {
        const p = [pointAt(r, k, levels[j]), pointAt(r, k + 1, levels[j]), pointAt(r, k + 1, levels[j + 1]), pointAt(r, k, levels[j + 1])];
        quad(...(r === VALVE.inner ? p.reverse() : p));
      }
    }
    for (const y of [VALVE.stemBottom, VALVE.stemTop, ...(port(k) ? [VALVE.portLow, VALVE.portHigh] : [])]) {
      quad(pointAt(VALVE.inner, k, y), pointAt(VALVE.outer, k, y), pointAt(VALVE.outer, k + 1, y), pointAt(VALVE.inner, k + 1, y));
    }
  }
  for (const k of [4, N - 4, N / 2 - 4, N / 2 + 4]) quad(pointAt(VALVE.inner, k, VALVE.portLow), pointAt(VALVE.outer, k, VALVE.portLow), pointAt(VALVE.outer, k, VALVE.portHigh), pointAt(VALVE.inner, k, VALVE.portHigh));
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));geometry.computeVertexNormals();return geometry;
}

export function hollowCurve(curve, inner, outer, segments = 180) {
  const frames = curve.computeFrenetFrames(segments, false), centers = Array.from({length: segments + 1}, (_, i) => curve.getPointAt(i / segments));
  const positions = [], N = 24;
  const at = (i, k, radius) => centers[i].clone().addScaledVector(frames.normals[i], radius * MM * Math.cos(2 * Math.PI * k / N)).addScaledVector(frames.binormals[i], radius * MM * Math.sin(2 * Math.PI * k / N)).toArray();
  const quad = (a, b, c, d) => positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < segments; i++) for (let k = 0; k < N; k++) for (const r of [outer, inner]) {
    const p = [at(i, k, r), at(i, k + 1, r), at(i + 1, k + 1, r), at(i + 1, k, r)];quad(...(r === inner ? p.reverse() : p));
  }
  for (const i of [0, segments]) for (let k = 0; k < N; k++) quad(at(i, k, inner), at(i, k, outer), at(i, k + 1, outer), at(i, k + 1, inner));
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));geometry.computeVertexNormals();return geometry;
}

export function dipTubeCurve() {
  const end = levelFor(6e-6, true);
  // Generous bend into the bottom corner, ending above the domed base.
  return new THREE.CatmullRomCurve3([[0, 146, 0], [0, 90, 0], [0, 45, 0], [5, 22, 0], [17, 10, 0], [28, end, 0]].map(p => new THREE.Vector3(...point(p))), false, 'centripetal');
}

export class ActuatorCurve extends THREE.Curve {
  constructor() { super();this.lengthMM = 3 * Math.PI / 2 + 7; }
  getPoint(t, target = new THREE.Vector3()) {
    const s = t * this.lengthMM, arc = 3 * Math.PI / 2;
    return s <= arc ? target.set((3 - 3 * Math.cos(s / 3)) * MM, (180 + 3 * Math.sin(s / 3)) * MM, 0) : target.set((3 + s - arc) * MM, 183 * MM, 0);
  }
  getPointAt(t, target) { return this.getPoint(t, target); }
  getTangent(t, target = new THREE.Vector3()) {
    const s = t * this.lengthMM;return s <= 3 * Math.PI / 2 ? target.set(Math.sin(s / 3), Math.cos(s / 3), 0) : target.set(1, 0, 0);
  }
  getTangentAt(t, target) { return this.getTangent(t, target); }
  getLength() { return this.lengthMM * MM; }
}

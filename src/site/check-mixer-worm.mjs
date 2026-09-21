import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {mixerWheelGeometry, mixerWormGeometry} from './mixer-worm-geometry.js';

const TAU = 2 * Math.PI, wrap = (x, p) => ((x + p / 2) % p + p) % p - p / 2;
const records = [];
for (const teeth of [20, 30, 40]) {
  const module = 32.5 / teeth, pitch = Math.PI * module, h = module / 2;
  const tangent = Math.tan(20 * Math.PI / 180) / Math.cos(Math.atan(module / 12));
  const root = 6 - 1.25 * module, tip = 6 + module;
  const wormSolid = (x, y, z, phase) => {
    const radius = Math.hypot(x, y);
    return Math.max(radius - tip, Math.min(radius - root, Math.abs(wrap(z - h * (Math.atan2(y, x) - phase), pitch)) - (pitch / 4 - (radius - 6) * tangent)));
  };
  const worm = mixerWormGeometry(teeth), wp = worm.getAttribute('position'), wi = worm.index;
  let wormOutside = -Infinity, bore = Infinity;
  for (let i = 0; i < wp.count; i++) wormOutside = Math.max(wormOutside, wormSolid(wp.getX(i), wp.getY(i), wp.getZ(i), 0));
  for (let i = 0; i < wi.count; i += 3) {
    const ids = [wi.getX(i), wi.getX(i + 1), wi.getX(i + 2)];
    const x = ids.reduce((a, j) => a + wp.getX(j) / 3, 0), y = ids.reduce((a, j) => a + wp.getY(j) / 3, 0), z = ids.reduce((a, j) => a + wp.getZ(j) / 3, 0);
    wormOutside = Math.max(wormOutside, wormSolid(x, y, z, 0));
    bore = Math.min(bore, Math.hypot(x, y));
  }
  assert.ok(bore > 2.005, `worm bore clears the 2 mm shaft: ${bore}`);
  assert.ok(wormOutside < .003, `worm tessellation stays within analytic surface bound: ${wormOutside}`);
  for (const side of [-1, 1]) {
    const wheel = mixerWheelGeometry(teeth, side), p = wheel.getAttribute('position'), idx = wheel.index;
    const samples = [];
    for (let i = 0; i < p.count; i++) samples.push([p.getX(i), p.getY(i), p.getZ(i)]);
    for (let i = 0; i < idx.count; i += 3) {
      const ids = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
      for (const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]) {
        samples.push([0, 1, 2].map(axis => ids.reduce((n, j, k) => n + p.array[j * 3 + axis] * weights[k], 0)));
      }
    }
    let minimum = Infinity, largestNearest = 0, tested = 0;
    for (let phaseIndex = 0; phaseIndex <= 120; phaseIndex++) {
      const phase = TAU * phaseIndex / 120, turn = -side * phase / teeth, c = Math.cos(turn), s = Math.sin(turn);
      let nearest = Infinity;
      for (const [X, y, Z] of samples) {
        const x = side * 22.25 + c * X + s * Z, z = -s * X + c * Z;
        if (Math.abs(z) > 15 || Math.hypot(x, y) > tip + .05) continue;
        const margin = wormSolid(x, y, z, phase);
        minimum = Math.min(minimum, margin); nearest = Math.min(nearest, margin); tested++;
      }
      largestNearest = Math.max(largestNearest, nearest);
    }
    assert.ok(minimum > Math.max(0, wormOutside) + .0001, `actual wheel tessellation clears worm bound: ${minimum} > ${wormOutside}`);
    assert.ok(largestNearest < .02, `working flanks remain within .02 mm throughout turn: ${largestNearest}`);
    const record = {teeth, side, phaseCases: 121, sampleTests: tested, minimumMarginMm: minimum, largestContactGapMm: largestNearest, wormOutsideMm: wormOutside, wormBoreMm: bore};
    records.push(record); console.log(record); wheel.dispose();
  }
  worm.dispose();
}
if (process.env.EVIDENCE_FILE) await writeFile(process.env.EVIDENCE_FILE, JSON.stringify({passed:true,records}, null, 2) + '\n');
console.log('PASS worm meshes: 726 phase/face cases, vertices, triangle centroids and edge midpoints');

// Checks the three axis positioning, computer aided design and laser scanning
// models against their sources typed in again and their physics worked out by
// other routes: steps a millimeter counted rather than divided, a trapezoidal
// move integrated from its own speed, lost motion simulated one small step at a
// time, the chord error measured off a sampled arc, a polygon's area by the
// shoelace formula, a bead's cross section by slices, and the depth a sensor
// cell is worth differentiated numerically. Then every drawn line, block, dot
// and curve is read back from the geometry at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './printing-physics.js';
import * as S from './three-axis-model.js';
import * as D from './cad-design-model.js';
import * as R from './laser-scanning-model.js';
import * as L from './printing-lessons.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {createDailyLifeMachine} from './daily-life-models.js';

const t = tally();
const counts = {steps: 0, poses: 0, points: 0, numbers: 0, samples: 0, facets: 0};
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;
const f0 = v => fixed(v, 0), f1 = v => fixed(v, 1), f2 = v => fixed(v, 2), f3 = v => fixed(v, 3), f4 = v => fixed(v, 4);
const deg = radians => radians * 180 / Math.PI;
// Geometry lives in Float32Array buffers, so anything read back out of one is
// compared in scene units at the precision a 32 bit float really carries.
const DRAWN = 5e-6;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  motors: [[48, 7.5], [200, 1.8], [400, 0.9]],
  micro: [1, 2, 4, 8, 16, 32],
  nema: {faceplate: 43.18, angle: 1.8, phases: 2, holding: 36, current: 1.68, voltage: 2.8, resistance: 1.65, inductance: 3.2, mass: 0.28},
  even: [3, 5], smoothTo: 10,
  belt: {pitch: 2, teeth: 20},
  leads: {m5: 0.8, m6: 1, m8: 1.25, tall: 8},
  marlin: {steps: [80, 80, 4000, 500], feed: [500, 500, 2.25, 45], accel: [3000, 3000, 100, 10000], acceleration: 3000, junction: 0.013, minimum: 0.05, lashLimit: 0.5, lashRes: 0.005, per30: 100},
  stl: {header: 80, count: 4, floats: 12, floatBytes: 4, attribute: 2},
  slicing: {share: 0.8, nozzle: 0.4, width: 0.45, two: 0.86, at: 0.2, first: 0.2, minimum: 2, from: 0.1, fine: [0.07, 0.05], nozzleRange: [0.3, 1]},
  scanner: {start: 53.5, middle: 66, end: 78.5, height: 25, linearity: 2, points: 1280, standard: 300, fast: 2000, nm: 658, mW: 8},
  pixels: [1.1, 3.7, 6], subpixels: [1, 50],
};

assert.deepEqual(P.MOTORS.map(m => [m.steps, m.angle]), SRC.motors);
assert.deepEqual([...P.MICROSTEPS], SRC.micro);
for (const [steps, angle] of SRC.motors) t.ok(Math.abs(steps * angle - 360) < 1e-9, `${steps} whole steps of ${angle}° make one turn`);
t.ok(P.MOTOR.faceplate === SRC.nema.faceplate && P.MOTOR.angle === SRC.nema.angle && P.MOTOR.phases === SRC.nema.phases && P.MOTOR.holding === SRC.nema.holding && P.MOTOR.current === SRC.nema.current && P.MOTOR.voltage === SRC.nema.voltage && P.MOTOR.resistance === SRC.nema.resistance && P.MOTOR.inductance === SRC.nema.inductance && P.MOTOR.mass === SRC.nema.mass, 'one NEMA 17 as its datasheet and the RepRap page give it');
t.ok(P.MOTOR.repeatableLow === SRC.even[0] && P.MOTOR.repeatable === SRC.even[1] && P.MOTOR.smoothTo === SRC.smoothTo, 'step travel even to 3 or 5 percent, down to about a tenth of a step');
t.ok(P.BELT.pitch === SRC.belt.pitch && P.BELT.teeth === SRC.belt.teeth, 'a 2 mm belt pitch, and the declared 20 tooth pulley');
assert.deepEqual({...P.LEADS}, SRC.leads);
assert.deepEqual([...P.MARLIN.stepsPerMm], SRC.marlin.steps);
assert.deepEqual([...P.MARLIN.maxFeed], SRC.marlin.feed);
assert.deepEqual([...P.MARLIN.maxAccel], SRC.marlin.accel);
t.ok(P.MARLIN.accel === SRC.marlin.acceleration && P.MARLIN.junction === SRC.marlin.junction && P.MARLIN.minimumSpeed === SRC.marlin.minimum && P.MARLIN.lashLimit === SRC.marlin.lashLimit && P.MARLIN.lashResolution === SRC.marlin.lashRes, "Marlin's acceleration, junction deviation, minimum speed and backlash measurement");
assert.deepEqual({...P.STL}, SRC.stl);
t.ok(P.SLICING.share === SRC.slicing.share && P.SLICING.nozzle === SRC.slicing.nozzle && P.SLICING.width === SRC.slicing.width && P.SLICING.twoPerimeters === SRC.slicing.two && P.SLICING.minimumPerimeters === SRC.slicing.minimum && P.SLICING.suggestFrom === SRC.slicing.from, "Prusa's layer height band, extrusion width and perimeter minimum");
t.ok(P.SCANNER.start === SRC.scanner.start && P.SCANNER.middle === SRC.scanner.middle && P.SCANNER.end === SRC.scanner.end && P.SCANNER.height === SRC.scanner.height && P.SCANNER.linearity === SRC.scanner.linearity && P.SCANNER.points === SRC.scanner.points && P.SCANNER.fast === SRC.scanner.fast && P.SCANNER.wavelength === SRC.scanner.nm, "the profile scanner's range, linearity, points and laser");
t.ok(P.SCANNER.end - P.SCANNER.start === SRC.scanner.height && P.SCANNER.middle - P.SCANNER.start === P.SCANNER.end - P.SCANNER.middle, 'the range is 25 mm deep with its middle in the middle');
assert.deepEqual([...P.PIXELS], SRC.pixels);
assert.deepEqual([...P.SUBPIXELS], SRC.subpixels);

// Marlin's two shipped numbers fall out of the arithmetic exactly.
t.near(P.beltStepsPerMm(200, 16), SRC.marlin.steps[0], 1e-12, "80 steps a millimeter on a belt, as Marlin ships");
t.near(P.screwStepsPerMm(200, 16, SRC.leads.m5), SRC.marlin.steps[2], 1e-12, '4000 steps a millimeter on an M5 screw, as Marlin ships');

// Steps a millimeter, counted rather than divided: walk whole microsteps along
// one turn of the drive and count how many land inside it, then divide by the
// millimeters that turn carries.
for (const [steps, micro, lead] of [[200, 16, 40], [200, 1, 40], [400, 32, 40], [48, 8, 40], [200, 16, 0.8], [400, 4, 0.8]]) {
  const perMm = steps * micro / lead, size = lead / (steps * micro);
  let count = 0;
  while ((count + 1) * size <= lead + 1e-9) count++;
  t.near(count, steps * micro, 1e-9, `${steps} steps at a ${micro} divisor: one turn holds ${steps * micro} microsteps`);
  t.near(count / lead, perMm, relative(perMm, 1e-9), `and over ${lead} mm a turn that is ${perMm} steps a millimeter`);
  const belt = lead === P.BELT.pitch * P.BELT.teeth;
  t.near(belt ? P.beltStepsPerMm(steps, micro) : P.screwStepsPerMm(steps, micro, lead), count / lead, relative(perMm, 1e-9), 'which is what the module gives');
  counts.steps += count;
}

// Rounding to the grid, checked against a search of the neighbors.
for (const pitch of [0.2, 0.0125, 0.00025, 0.052083333]) {
  for (const value of [0, 0.37, 1, 6.37, 19.99]) {
    const got = P.onGrid(value, pitch);
    let best = null;
    for (let k = Math.floor(value / pitch) - 2; k <= Math.ceil(value / pitch) + 2; k++) {
      const distance = Math.abs(k * pitch - value);
      if (best === null || distance < best.distance - 1e-15) best = {distance, reached: k * pitch};
    }
    t.near(got.reached, best.reached, relative(1, 1e-9) + 1e-15, `the nearest grid point to ${value} at a pitch of ${pitch}`);
    t.ok(Math.abs(got.residual) <= pitch / 2 + 1e-15, 'never more than half a step out');
  }
}

// A trapezoidal move, worked out again by integrating its own speed.
for (const [length, feed, accel] of [[6.375, 60, 1000], [1, 200, 3000], [6.37, 2.25, 100], [0.1, 5, 100], [20, 500, 3000]]) {
  const profile = P.trapezoid(length, feed, accel);
  t.near(2 * profile.ramp + profile.cruise, length, relative(length, 1e-12), 'the ramps and the cruise make the whole length');
  t.near(P.trapezoidAt(profile, profile.time, accel).distance, length, relative(length, 1e-9), 'it arrives exactly at the end');
  const n = 20000;
  let sum = 0, top = 0;
  for (let i = 0; i < n; i++) { const speed = P.trapezoidAt(profile, profile.time * (i + 0.5) / n, accel).speed; sum += speed * profile.time / n; top = Math.max(top, speed); }
  t.near(sum, length, length * 3e-4, 'the speed integrates to the distance');
  t.near(top, profile.top, profile.top * 2e-3, 'and never passes the top speed the plan gives');
  t.ok(profile.top <= feed + 1e-12, 'nor the feed rate');
  if (profile.triangular) t.near(profile.top, Math.sqrt(accel * length), relative(profile.top, 1e-9), 'a move too short to cruise tops out at the root of acceleration times length');
  counts.steps += n;
}

// Lost motion, simulated one small step at a time against the dead band.
for (const lash of [0, 0.005, 0.1, 0.5]) {
  for (const travel of [0.05, 1, 6.375]) {
    let table = 0;
    const n = 4000;
    for (let i = 1; i <= n; i++) table = P.followWithLash(table, travel * i / n, lash);
    const outward = table;
    for (let i = 1; i <= n; i++) table = P.followWithLash(table, travel * (1 - i / n), lash);
    t.near(outward, travel, 1e-12, `going out with ${lash} mm of play the table follows exactly`);
    t.near(table, Math.min(lash, travel), 1e-12, 'and coming back it stops short by the play, or never moves at all');
    counts.steps += 2 * n;
  }
}

// The chord error, measured off a sampled arc rather than taken from the
// formula: walk the arc a facet spans and find how far it ever stands from the
// straight chord joining its ends.
for (const radius of [6, 12, 20]) {
  for (const facets of [8, 16, 32, 64, 128]) {
    const span = 2 * Math.PI / facets, chordY = radius * Math.cos(span / 2);
    let worst = 0, atMiddle = 0;
    for (let i = 0; i <= 2000; i++) {
      const a = -span / 2 + span * i / 2000, gap = radius * Math.cos(a) - chordY;
      if (gap > worst) worst = gap;
      if (i === 1000) atMiddle = gap;
      counts.steps++;
    }
    t.near(P.chordError(radius, facets), worst, relative(worst, 1e-6) + 1e-12, `${facets} facets on a ${radius} mm radius: the widest gap between arc and chord`);
    t.near(worst, atMiddle, relative(worst, 1e-6) + 1e-12, 'and the widest gap is the one at the middle of the facet');
    t.ok(P.chordError(radius, facets) <= radius * (1 - Math.cos(Math.PI / P.DESIGN_DOMAINS.facets[0])) + 1e-12, 'never worse than the coarsest setting allows');
    counts.facets++;
  }
}
for (const radius of [6, 12, 20]) for (let facets = 16; facets <= 128; facets *= 2) t.ok(P.chordError(radius, facets) < P.chordError(radius, facets / 2), `${facets} facets fall closer to the curve than ${facets / 2}`);

// A polygon's area and perimeter, by the shoelace formula on its own corners.
for (const radius of [6, 12, 20]) {
  for (const facets of [8, 32, 128]) {
    const corners = D.polygonPoints(radius, facets).slice(0, facets);
    let area = 0, edge = 0;
    for (let i = 0; i < facets; i++) {
      const [x0, y0] = corners[i], [x1, y1] = corners[(i + 1) % facets];
      area += x0 * y1 - x1 * y0;
      edge += Math.hypot(x1 - x0, y1 - y0);
    }
    t.near(P.polygonArea(radius, facets), Math.abs(area) / 2, relative(area, 1e-9), 'the area by the shoelace formula');
    t.near(P.polygonPerimeter(radius, facets), edge, relative(edge, 1e-9), 'and the way round by adding its edges');
    t.ok(P.polygonArea(radius, facets) < Math.PI * radius * radius, 'a polygon always holds less than its circle');
  }
}

// A binary file's size, counted field by field.
for (const triangles of [0, 1, 60, 252, 1020]) {
  const bytes = SRC.stl.header + SRC.stl.count + triangles * (3 * SRC.stl.floatBytes + 9 * SRC.stl.floatBytes + SRC.stl.attribute);
  t.near(P.stlBytes(triangles), bytes, 1e-12, `${triangles} triangles: a header, a count, then a normal, three corners and the attribute each`);
}
t.ok(P.stlBytes(0) === 84 && P.stlBytes(1) - P.stlBytes(0) === 50, 'an empty file is 84 bytes and each triangle adds 50');

// A bead's cross section, by slicing a rectangle with two round ends.
for (const width of [0.35, 0.45, 0.7]) {
  for (const layer of [0.05, 0.2, 0.3]) {
    const n = 20000;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const y = -layer / 2 + layer * (i + 0.5) / n, half = Math.sqrt(Math.max(0, (layer / 2) ** 2 - y * y));
      area += ((width - layer) + 2 * half) * layer / n;
    }
    t.near(P.beadArea(width, layer), area, Math.abs(area) * 2e-5, `a bead ${width} mm wide at a ${layer} mm layer, sliced`);
    counts.steps += n;
  }
}
t.ok(f2(P.beadsWide(2, SRC.slicing.width, SRC.slicing.at)) === f2(SRC.slicing.two), "two 0.45 mm perimeters at a 0.2 mm layer measure the 0.86 mm Prusa gives");
for (const count of [1, 2, 3, 4]) t.near(P.beadsWide(count, 0.45, 0.2), count * 0.45 - (count - 1) * 0.2 * (1 - Math.PI / 4), 1e-12, `${count} beads side by side`);

// Triangulation: the image and the depth are each other's inverse, and one
// cell is worth what differentiating the depth by the image says it is.
for (const focal of [20]) {
  for (const baseline of [4, 8, 16]) {
    for (const z of [53.5, 60, 66, 72.5, 78.5]) {
      const u = P.imageOf(z, focal, baseline);
      t.near(P.depthOf(u, focal, baseline), z, relative(z, 1e-12), 'the depth and its image invert each other');
      const h = 1e-7, slope = (P.depthOf(u + h, focal, baseline) - P.depthOf(u - h, focal, baseline)) / (2 * h);
      t.near(P.depthResolution(z, focal, baseline, 1), Math.abs(slope), Math.abs(slope) * 1e-6, 'one unit on the sensor is worth what the derivative says');
      t.near(P.depthResolution(z, focal, baseline, 1), z * z / (focal * baseline), relative(z * z / (focal * baseline), 1e-12), 'which grows as the square of the distance');
      counts.samples++;
    }
    const near = P.depthResolution(53.5, focal, baseline, 1), far = P.depthResolution(78.5, focal, baseline, 1);
    t.near(far / near, (78.5 / 53.5) ** 2, 1e-9, 'so the far end is coarser than the near end by the square of their ratio');
  }
  const wide = P.depthResolution(66, focal, 16, 1), narrow = P.depthResolution(66, focal, 4, 1);
  t.near(narrow / wide, 4, 1e-9, 'and a baseline four times wider resolves four times finer');
}
// The declared focal length, baseline and pixel reproduce the catalog's own figure.
t.ok(f0(P.depthResolution(SRC.scanner.middle, P.SCAN.focal, P.SCAN_DEFAULTS.baseline, SRC.pixels[1] / 1000 / SRC.subpixels[1]) * 1000) === f0(SRC.scanner.linearity), "the declared optics give the catalog's 2 micron line linearity at its own middle of range");

// Every sample the scanner takes, traced again by walking the two paths.
for (const ridge of [0, 2, 6, 12]) {
  for (const baseline of [4, 8, 16]) {
    for (const side of [0, 1]) {
      const plan = P.scanPlan({ridge, baseline, side}), sign = side === 0 ? 1 : -1, half = P.SCAN.ridgeWidth / 2;
      for (const sample of plan.samples) {
        const surface = P.heightAt(sample.x, ridge);
        t.near(sample.surface, surface, 1e-12, 'the surface height where the sample was taken');
        // Walk each path in small steps and see whether it ever enters the ridge.
        const enters = (fromX, fromY) => {
          for (let i = 1; i < 400; i++) {
            const share = i / 400, x = fromX + (sample.x - fromX) * share, y = fromY + (surface - fromY) * share;
            if (Math.abs(x) < half - 1e-9 && y < ridge - 1e-9) return true;
          }
          return false;
        };
        const litBlocked = ridge > 0 && enters(0, plan.standoff);
        const seenBlocked = ridge > 0 && enters(sign * baseline, plan.standoff);
        t.ok(sample.lit === !litBlocked, `x=${sample.x}: the laser reaches it only when nothing stands in the way`);
        if (sample.lit) t.ok(sample.seen === !seenBlocked, `x=${sample.x}: the receiver sees it only when nothing stands in the way`);
        if (sample.measured !== null) {
          t.near(sample.measured, plan.standoff - P.depthOf(sample.reached, P.SCAN.focal, baseline), 1e-12, 'the height comes back from the rounded image, not from the surface');
          t.ok(Math.abs(sample.error) <= P.depthResolution(sample.depth, P.SCAN.focal, baseline, plan.grid) / 2 + 1e-9, 'and it is out by no more than half of what a cell is worth');
        }
        counts.samples++;
      }
      // The shadow is the mirror image when the receiver changes sides.
      if (side === 0) {
        const other = P.scanPlan({ridge, baseline, side: 1});
        const lost = p => p.samples.filter(s => s.measured === null).map(s => s.x).sort((a, b) => a - b);
        assert.deepEqual(lost(other), lost(plan).map(x => -x).sort((a, b) => a - b), `ridge ${ridge}, baseline ${baseline}: the shadow mirrors`);
        t.add();
      }
    }
  }
}
t.ok(P.scanPlan({ridge: 0}).missing === 0, 'with nothing in the way every attempt comes back');
t.ok(P.scanPlan({ridge: 12}).missing > P.scanPlan({ridge: 6}).missing, 'and a taller ridge hides more');

// The stage's plan, the design's plan: every derived number by another route.
for (const values of [{}, {axis: 1}, {micro: 0}, {micro: 5}, {motor: 0}, {motor: 2}, {lash: 0}, {lash: 0.5}, {travel: 1, feed: 200, accel: 3000}]) {
  const plan = P.stagePlan(values), slot = plan.belt ? 0 : 2;
  t.near(plan.stepsPerMm, plan.motor.steps * plan.micro / plan.lead, relative(plan.stepsPerMm, 1e-12), 'steps a millimeter is microsteps a turn over millimeters a turn');
  t.near(plan.microstep * plan.stepsPerMm, 1, 1e-12, 'and a microstep is its reciprocal');
  t.near(plan.reached, Math.round(plan.commanded * plan.stepsPerMm) / plan.stepsPerMm, 1e-12, 'the point reached is a whole number of microsteps');
  t.ok(plan.feed === Math.min(values.feed ?? P.STAGE_DEFAULTS.feed, SRC.marlin.feed[slot]) && plan.accel === Math.min(values.accel ?? P.STAGE_DEFAULTS.accel, SRC.marlin.accel[slot]), "held to Marlin's ceiling for this axis");
  t.near(plan.duration, plan.out.time + plan.back.time, 1e-12, 'the move is its two legs');
  t.near(plan.endTable, Math.min(plan.lash, plan.reached), 1e-12, 'and it comes home short by the play');
  const end = P.stageAt(plan, plan.duration);
  t.near(end.motor, 0, 1e-9, 'the drive returns to where it started');
  t.near(end.table, plan.endTable, 3e-3, 'and the table does not');
  t.ok(P.stageAt(plan, 0).motor === 0 && P.stageAt(plan, plan.duration * 2).done, 'it starts at zero and finishes');
  counts.poses++;
}
for (const values of [{}, {facets: 8}, {facets: 128}, {layer: 0.05}, {layer: 0.3}, {perimeters: 1}, {perimeters: 4}, {infill: 0}, {infill: 100}, {radius: 20}, {wall: 0.8}]) {
  const plan = P.designPlan(values);
  t.near(plan.triangles, 3 * 2 * plan.facets + 2 * (plan.facets - 2), 1e-12, 'three bands of two triangles a facet and two fans');
  t.near(plan.bytes, P.stlBytes(plan.triangles), 1e-12, 'and the bytes that many triangles cost');
  t.near(plan.facetedVolume, P.polygonArea(plan.radius, plan.facets) * plan.height - P.polygonArea(plan.inner, plan.facets) * plan.pocket, relative(plan.facetedVolume, 1e-12), 'the solid is the outer prism less the pocket');
  t.ok(plan.facetedVolume < plan.roundVolume, 'and it always falls short of what the true curves would hold');
  t.near(plan.layers, Math.ceil(plan.height / plan.layer - 1e-9), 1e-12, 'the layers it takes');
  t.near(plan.lastLayer, plan.height - (plan.layers - 1) * plan.layer, 1e-9, 'and how tall the last one is');
  t.near(plan.shell, P.beadsWide(plan.perimeters, plan.width, plan.layer), 1e-12, 'the loops measure less than their widths added');
  t.ok(plan.shell <= plan.perimeters * plan.width + 1e-12, 'never more');
  t.near(plan.printVolume, plan.totalPath * plan.bead, relative(plan.printVolume, 1e-12), 'the volume laid is the path times the cross section');
  t.ok(plan.infill > 0 && plan.gap > 0 ? plan.fillPath > 0 : plan.fillPath === 0, 'there is filling only where the loops leave room');
  counts.poses++;
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back from the geometry.
// ---------------------------------------------------------------------------

const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const instancesOf = mesh => Array.from({length: mesh.count}, (_, i) => { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); const e = matrix.elements; return {x: e[12], y: e[13]}; });
const boxOf = (object, toSystem) => {
  const box = new THREE.Box3(), local = new THREE.Box3(), matrix = new THREE.Matrix4();
  object.traverse(child => {
    for (let node = child; node; node = node.parent) if (!node.visible) return;
    if (!child.geometry) return;
    child.geometry.computeBoundingBox();
    const count = child.isInstancedMesh ? child.count : 1;
    for (let i = 0; i < count; i++) {
      local.copy(child.geometry.boundingBox);
      if (child.isInstancedMesh) { child.getMatrixAt(i, matrix); local.applyMatrix4(matrix); }
      box.union(local.applyMatrix4(child.matrixWorld).applyMatrix4(toSystem));
    }
  });
  return box;
};
const clearOf = (model, ids, gap) => {
  model.root.updateMatrixWorld(true);
  const toSystem = new THREE.Matrix4().copy(model.parts.find(p => p.id === 'system').object.matrixWorld).invert();
  const boxes = ids.map(id => [id, boxOf(model.parts.find(p => p.id === id).object, toSystem)]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, A] = boxes[i], [b, B] = boxes[j];
    if (A.isEmpty() || B.isEmpty()) continue;
    t.ok(A.max.x + gap <= B.min.x || B.max.x + gap <= A.min.x || A.max.y + gap <= B.min.y || B.max.y + gap <= A.min.y, `the ${a} and the ${b} stay clear of one another`);
  }
};

// The stage.
const stage = S.createThreeAxisModel(), ST = stage.topology;
for (const values of [{}, {axis: 1}, {micro: 0}, {micro: 5}, {motor: 0}, {motor: 2}, {lash: 0}, {lash: 0.5}, {travel: 20}, {travel: 1, feed: 200, accel: 3000}]) {
  const plan = P.stagePlan({...P.STAGE_DEFAULTS, ...values});
  for (const share of [0, 0.25, 0.5, 0.75, 1]) {
    stage.reset();
    stage.update(values);
    stage.advance(plan.duration * plan.slow * share);
    stage.root.updateMatrixWorld(true);
    const state = stage.getState(), now = state.now;
    counts.poses++;

    // The carriage sits where the table is, on the scale the header declares.
    const span = S.RIG.span, home = -span / 2 + S.RIG.carriage[0], mmToUnits = span / P.STAGE.travel;
    t.near(ST.carriage.position.x, (home + now.table * mmToUnits) * S.BENCH, 1e-9, 'the carriage drawn where the table stands');
    t.near(ST.tool.position.x, ST.carriage.position.x, 1e-12, 'with the tool under it');
    t.ok(Math.abs(ST.carriage.position.x) <= (span / 2) * S.BENCH + 1e-9, 'and never off the rail');

    // The step grid: every drawn line on a whole step, and the two marks apart
    // by exactly the residual.
    const win = S.gridWindow(plan), perMm = S.GRIDVIEW.width / win;
    const onStep = (x, pitch, what) => {
      const k = Math.round((x / perMm + plan.commanded) / pitch);
      t.ok(Math.abs(x - (k * pitch - plan.commanded) * perMm) < DRAWN, what);
      counts.points++;
    };
    const fine = pointsOf(ST.fineLines), heavy = pointsOf(ST.heavyLines);
    for (const [x] of fine) onStep(x, plan.microstep, 'a light line stands on a microstep');
    for (const [x] of heavy) onStep(x, plan.micro * plan.microstep, 'a heavy line stands on a whole step');
    t.ok(fine.length <= 2 * S.GRIDVIEW.fine && heavy.length <= 2 * S.GRIDVIEW.heavy, 'and neither runs out of room');
    const commandedX = pointsOf(ST.gridCommanded)[0][0], reachedX = pointsOf(ST.gridReached)[0][0];
    t.near(commandedX, 0, DRAWN, 'the point asked for sits in the middle of the window');
    t.near(reachedX - commandedX, plan.residual * perMm, DRAWN, 'and the point reached sits exactly the residual away');
    t.ok(ST.residualBar.visible === Math.abs(reachedX - commandedX) > 1e-6, 'the bar between them shows only when there is a gap');

    // The lost motion: the slot is as wide as the play and the table lags by the gap.
    const lashWin = Math.max(plan.lash, plan.microstep * 4), lashPer = (S.LASHVIEW.width - S.LASHVIEW.slot) / (2 * lashWin);
    t.near(ST.lashTable.position.x, (now.table - now.motor) * lashPer, 1e-9, 'the table drawn where it lags the drive');
    t.near(ST.lashSlot.scale.x, S.LASHVIEW.slot + plan.lash * lashPer, 1e-9, 'the slot drawn as wide as the play');
    t.ok(now.table - now.motor >= -1e-9 && now.table - now.motor <= plan.lash + 1e-9, 'and the table never leaves the slot');

    // The speed chart never draws above the feed rate.
    for (const [, y] of pointsOf(ST.speedGuide)) { t.ok(y <= S.CHART.y + S.CHART.top * S.CHART.h + DRAWN && y >= S.CHART.y - DRAWN, 'the speed curve stays inside its frame'); counts.points++; }
    t.near(pointsOf(ST.feedLine)[0][1], S.chartY(plan, plan.feed), DRAWN, 'the feed rate line at the feed rate');
    t.near(pointsOf(ST.legLine)[0][0], S.chartX(plan, plan.out.time), DRAWN, 'and the turn where the move reverses');

    // The belt or the screw, never both.
    t.ok(ST.beltBody.visible === plan.belt && ST.screwBody.visible === !plan.belt, 'the drive drawn is the one being used');
  }
  clearOf(stage, ['stage', 'motor', 'drive', 'grid', 'lash', 'chart'], 0.02);
}
t.ok(Math.abs(S.timesLarger(S.BENCH) - 1) < 1e-12 && Math.abs(S.timesLarger(S.CLOSE) - 10) < 1e-12, 'the scales the header states: true size and ten times larger');
{
  // The motor really is drawn at the size its datasheet gives.
  stage.reset();
  ST.motorBody.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  ST.motorBody.geometry.boundingBox.getSize(size);
  t.near(size.x * ST.motorBody.scale.x / S.BENCH, SRC.nema.faceplate, 1e-9, 'a 43.18 mm faceplate at true size');
  t.near(size.y * ST.motorBody.scale.y / S.BENCH, SRC.nema.faceplate, 1e-9, 'square, as the standard says');
}

// The design.
const design = D.createCADDesignModel(), DT = design.topology;
for (const values of [{}, {facets: 8}, {facets: 128}, {radius: 20}, {layer: 0.05}, {layer: 0.3}, {perimeters: 1}, {perimeters: 4}, {infill: 0}, {infill: 100}]) {
  const plan = P.designPlan({...P.DESIGN_DEFAULTS, ...values});
  for (const share of [0, 0.4, 0.7, 1]) {
    design.reset();
    design.update(values);
    design.advance(plan.duration * share);
    design.root.updateMatrixWorld(true);
    const now = P.designAt(plan, plan.duration * share);
    counts.poses++;

    // Every corner of the drawn plan sits on the circle it stands for.
    const turn = Math.PI / plan.facets;
    for (const [line, radius] of [[DT.outerPlan, plan.radius], [DT.innerPlan, plan.inner]]) {
      const drawn = pointsOf(line);
      if (!drawn.length) continue;
      for (const [x, y] of drawn) {
        t.near(Math.hypot(x, y - D.SOLID.lift), radius * D.CUP, DRAWN, 'a corner of the plan on its circle');
        counts.points++;
      }
      t.ok(drawn.length === plan.facets + 1, 'and the ring closes on itself');
    }
    // The facet close up: its chord is the right length and the error bar the right height.
    const chord = pointsOf(DT.chordLine), errorBar = pointsOf(DT.errorBar);
    const drawnRadius = Math.abs(errorBar[0][1] - errorBar[1][1]) / P.chordError(plan.radius, plan.facets);
    t.near(Math.abs(chord[1][0] - chord[0][0]), 2 * plan.radius * drawnRadius * Math.sin(Math.PI / plan.facets), DRAWN, 'the chord as long as a facet');
    for (const [x, y] of pointsOf(DT.trueArc)) { t.near(Math.hypot(x, y + drawnRadius * plan.radius), drawnRadius * plan.radius, DRAWN, 'every point of the arc on its circle'); counts.points++; }
    void turn;

    // The layers: one line a layer, none above the shape.
    const lines = pointsOf(DT.sliceLines);
    t.ok(lines.length / 2 === Math.min(plan.layers, D.SLICEVIEW.lines), 'a line for every layer it can draw');
    for (const [, y] of lines) t.ok(y <= D.SLICEVIEW.high / 2 + DRAWN, 'and none above the shape');

    // The toolpath: every loop at the radius the slicer would walk.
    let loops = 0;
    DT.pathLoops.forEach((loop, k) => {
      const drawn = pointsOf(loop);
      if (!drawn.length) return;
      loops++;
      const outward = k < plan.perimeters, index = outward ? k : k - plan.perimeters;
      const offset = outward ? plan.wall / 2 - (index + 0.5) * plan.width : -plan.wall / 2 + (index + 0.5) * plan.width;
      for (const [, y] of drawn) { t.near(y, offset * D.PATHVIEW, DRAWN, 'a loop drawn the width of a bead in from the face'); counts.points++; }
    });
    t.ok(loops === plan.perimeters * 2, 'a loop drawn for each one walked, in from each face');
    // Infill only ever between the loops.
    for (const [, y] of pointsOf(DT.infillLines)) {
      t.ok(Math.abs(y) <= plan.gap / 2 * D.PATHVIEW + DRAWN, 'filling stays between the loops');
      counts.points++;
    }
    if (plan.infill === 0 || plan.gap <= 0) t.ok(pointsOf(DT.infillLines).length === 0, 'and there is none at all when there is no room or no demand');

    // The construction only ever grows.
    t.ok(now.outerHeight <= plan.height + 1e-9 && now.pocketDepth <= plan.pocket + 1e-9, 'the wall and the pocket never pass their finished size');
    t.near(DT.wallLeft.scale.y, now.outerHeight * D.CUP, 1e-9, 'the wall drawn as far as it has risen');
  }
  clearOf(design, ['solid', 'facet', 'file', 'slice', 'path', 'chart'], 0.02);
}
t.ok(Math.abs(D.timesLarger(D.CUP) - 1) < 1e-12 && Math.abs(D.timesLarger(D.FACET) - 100) < 1e-12 && Math.abs(D.timesLarger(D.PATHVIEW) - 3) < 1e-12, 'the scales the header states: true size, 100 times and 3 times larger');
{
  // One triangle's record: the blocks are as wide as the bytes they stand for.
  design.reset();
  design.root.updateMatrixWorld(true);
  const total = SRC.stl.floats * SRC.stl.floatBytes + SRC.stl.attribute;
  DT.fileBlocks.forEach((block, k) => {
    const bytes = k < SRC.stl.floats ? SRC.stl.floatBytes : SRC.stl.attribute;
    t.near(block.scale.x + D.FILEVIEW.gap, D.FILEVIEW.width * bytes / total, 1e-9, `block ${k} as wide as its ${bytes} bytes`);
  });
  t.ok(DT.fileBlocks.length === SRC.stl.floats + 1, 'twelve numbers and the attribute after them');
}

// The scanner.
const scanner = R.createLaserScanningModel(), RT = scanner.topology;
for (const values of [{}, {ridge: 0}, {ridge: 12}, {baseline: 4}, {baseline: 16}, {side: 1}, {standoff: 53.5}, {standoff: 78.5}, {pixel: 0}, {pixel: 2}, {subpixel: 0}, {spacing: 2}]) {
  const plan = P.scanPlan({...P.SCAN_DEFAULTS, ...values});
  for (const share of [0, 0.5, 1]) {
    scanner.reset();
    scanner.update(values);
    scanner.advance(plan.duration * share);
    scanner.root.updateMatrixWorld(true);
    const now = P.scanAt(plan, plan.duration * share);
    counts.poses++;

    // Every drawn laser ray starts at the laser and ends on the surface.
    const rays = pointsOf(RT.laserRays), top = (2 + plan.standoff) * R.BENCH;
    t.ok(rays.length === 2 * plan.samples.filter(s => s.surface !== undefined).length, 'a ray drawn for every attempt');
    for (let i = 0; i < rays.length; i += 2) {
      t.near(rays[i][0], 0, DRAWN, 'a laser ray leaves the laser');
      t.near(rays[i][1], top, DRAWN, 'from the height the standoff gives');
      t.near(rays[i + 1][1], (2 + plan.samples[i / 2].surface) * R.BENCH, DRAWN, 'and lands on the surface');
      counts.points++;
    }
    // The receiver's rays all leave the receiver, on the side chosen.
    const receiverX = plan.sideSign * plan.baseline * R.BENCH;
    for (const rayset of [pointsOf(RT.seenRays), pointsOf(RT.blockedRays)]) {
      for (let i = 0; i < rayset.length; i += 2) { t.near(rayset[i][0], receiverX, DRAWN, 'a return path leaves the receiver'); counts.points++; }
    }
    t.near(RT.receiverHead.position.x, receiverX, 1e-9, 'and the receiver is drawn on that side');
    t.ok(pointsOf(RT.seenRays).length / 2 === plan.returned, 'one return drawn for every point measured');

    // The ridge is drawn as tall as it is, or not at all.
    t.ok(RT.ridgeBlock.visible === plan.ridge > 0, 'the ridge shows only when there is one');
    if (plan.ridge > 0) t.near(RT.ridgeBlock.scale.y, plan.ridge * R.BENCH, 1e-9, 'drawn as tall as it stands');

    // The cross section: a filled mark for every measurement, hollow for every gap.
    t.ok(RT.measuredDots.count === plan.returned && RT.missedDots.count === plan.missing, 'a mark for every attempt, filled or not');
    // The cloud holds exactly the points gathered so far.
    t.ok(RT.cloudDots.count === Math.min(now.cloud.length, R.CLOUD.room), 'the cloud holds what the sweep has gathered');
    t.ok(now.cloud.length === now.profiles * plan.returned, 'which is the profiles taken times the points each one holds');
    for (const dot of instancesOf(RT.cloudDots)) t.ok(Number.isFinite(dot.x) && Number.isFinite(dot.y), 'every cloud point drawn somewhere');

    // The sensor: the spot and the cell it is read as.
    const spot = pointsOf(RT.spotLine)[0][0], read = pointsOf(RT.readLine)[0][0];
    t.ok(Math.abs(spot - read) <= (R.SENSOR.width - 0.06) / R.SENSOR.cells / 2 + DRAWN, 'the cell read is the one the spot falls in');
    t.ok(RT.sensorCells.filter(cell => cell.material.color.getHex() === R.COLORS.lit).length <= 1, 'and only one cell is lit');
  }
  clearOf(scanner, ['bench', 'profile', 'sensor', 'cloud', 'chart'], 0.02);
}
t.ok(Math.abs(R.timesLarger(R.BENCH) - 1) < 1e-12 && Math.abs(R.timesLarger(R.PROFILE) - 3) < 1e-12, 'the scales the header states: true size and three times larger');

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes.
// ---------------------------------------------------------------------------

const runner = make => values => { const m = make(); m.reset(); m.update(values); m.advance(1e4); const s = m.getState(); m.dispose(); return s; };
const runStage = runner(S.createThreeAxisModel), runDesign = runner(D.createCADDesignModel), runScan = runner(R.createLaserScanningModel);

checkTrialNumbers(L.threeAxisLesson, {
  'Ask for a point between two steps': s => ({'1.8': s.motor.angle, 200: s.motor.steps, 16: s.micro, '3,200': s.motor.steps * s.micro, 20: P.BELT.teeth, 2: P.BELT.pitch, '40.0': s.lead, '12.50': s.microstepMicrons, '6.37': s.commanded, '6.3750': s.reached, '5.00': Math.abs(s.residual) * 1000, '6.25': s.worst * 1000}),
  'Turn the driver off': s => ({200: s.motor.steps, '200.00': s.microstepMicrons, '6.4000': s.reached, '30.00': Math.abs(s.residual) * 1000, '100.00': s.worst * 1000}),
  'Divide the step finely': s => ({32: s.micro, '6,400': s.motor.steps * s.micro, '6.25': s.microstepMicrons, '6.3688': s.reached, '1.25': Math.abs(s.residual) * 1000}),
  'Drive it with a screw instead': s => ({'0.8': s.lead, '40.0': P.BELT.pitch * P.BELT.teeth, '3,200': s.motor.steps * s.micro, '4,000.0': s.stepsPerMm, '0.25': s.microstepMicrons, '2.25': s.feed, '5.71': s.duration}),
  'Take the play out': s => ({'0.0': s.endTable * 1000}),
  'Put the play back': s => ({'500.0': s.endTable * 1000}),
  'Ask for a move too short to get up to speed': s => ({'0.50': s.out.ramp, '54.77': s.out.top, '0.07': s.duration}),
}, runStage, t);

checkTrialNumbers(L.cadDesignLesson, {
  'Describe the shape': s => ({252: s.triangles, '57.8': s.outerError * 1000, '5.63': 180 / s.facets, '2,632': s.facetedVolume, '2,649': s.roundVolume, '17.0': s.missing}),
  'Use only eight facets': s => ({8: s.facets, '22.50': 180 / s.facets, '913.4': s.outerError * 1000, 60: s.triangles, '264.1': s.missing}),
  'Use a hundred and twenty eight': s => ({'3.6': s.outerError * 1000, '1.1': s.missing, '1,020': s.triangles, '51,084': s.bytes, 80: P.STL.header, 4: P.STL.count, 50: P.STL.floats * P.STL.floatBytes + P.STL.attribute}),
  'Cut it into thinner layers': s => ({240: s.layers, 60: s.height / P.DESIGN_DEFAULTS.layer, '103.04': s.totalPath / 1000, '0.0220': s.bead, '0.0814': P.beadArea(s.width, P.DESIGN_DEFAULTS.layer)}),
  'Cut it into thicker ones': s => ({40: s.layers, '17.32': s.totalPath / 1000}),
  'Walk more loops': s => ({'0.45': s.width, '1.80': s.perimeters * s.width, '1.671': s.shell, '38.51': s.totalPath / 1000}),
  'Fill the wall solid': s => ({'30.08': s.totalPath / 1000}),
}, runDesign, t);

const blockedOf = s => s.samples.filter(sample => sample.measured === null).map(sample => sample.x);
checkTrialNumbers(L.laserScanningLesson, {
  'Measure one point': s => ({'6.00': s.middle.surface, '60.00': s.middle.depth, '2.6667': s.middle.image, '5.9999': s.middle.measured, '2.01': s.resolutionMicrons}),
  'Read only whole pixels': s => ({'3.700': s.gridMicrons, '0.074': s.pixelMicrons / P.SUBPIXELS[1], '2.6677': s.middle.reached, '6.0232': s.middle.measured, '23.2': Math.abs(s.middle.error) * 1000, '100.73': s.resolutionMicrons}),
  'Widen the baseline': s => ({'13.63': deg(Math.atan2(s.baseline, s.standoff)), '5.3333': s.middle.image, '2.6667': P.imageOf(s.middle.depth, P.SCAN.focal, P.SCAN_DEFAULTS.baseline), '1.01': s.resolutionMicrons, 2: s.missing, 1: P.scanPlan({}).missing}),
  'Narrow it': s => ({'3.47': deg(Math.atan2(s.baseline, s.standoff)), 25: s.returned, '1.3333': s.middle.image, '4.03': s.resolutionMicrons}),
  'Stand further off': s => ({'72.50': s.middle.depth, '2.2069': s.middle.image, '2.6667': P.imageOf(P.SCAN_DEFAULTS.standoff - s.middle.surface, P.SCAN.focal, s.baseline), '2.85': s.resolutionMicrons, '2.01': P.scanPlan({}).resolutionMicrons}),
  'Raise the ridge': s => ({'11.9999': s.middle.measured, 25: s.samples.length, 21: s.returned, 2: s.samples.filter(sample => !sample.lit).length}),
  'Move the receiver over': s => ({24: s.returned, 25: s.samples.length, 1: s.missing, 7: blockedOf(s)[0]}),
}, runScan, t);

// Free text: every snippet computed, and every number inside a checked snippet.
const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
}
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
const expectNone = (lesson, name) => { for (const [where, text] of texts(lesson)) covered(text, {}, `${name} ${where}`); };

const stagePlan = P.stagePlan({}), screwPlan = P.stagePlan({axis: 1}), playPlan = P.stagePlan({lash: 0.5});
expectNone(L.threeAxisLesson, 'Three axis');
covered(L.threeAxisLesson.deeper[0].body, {
  [`it ships ${P.MARLIN.stepsPerMm[0]} for the two flat axes and ${P.MARLIN.stepsPerMm[2]} for the up and down one`]: 'it ships 80 for the two flat axes and 4000 for the up and down one',
  [`${stagePlan.motor.steps} steps a turn at a sixteenth is ${f0(stagePlan.motor.steps * stagePlan.micro)} microsteps, over a ${P.BELT.teeth} tooth pulley of ${P.BELT.pitch} mm pitch carrying ${f1(P.BELT.pitch * P.BELT.teeth)} mm a turn, is ${f1(stagePlan.stepsPerMm)}`]: '200 steps a turn at a sixteenth is 3,200 microsteps, over a 20 tooth pulley of 2 mm pitch carrying 40.0 mm a turn, is 80.0',
  [`the same ${f0(screwPlan.motor.steps * screwPlan.micro)} over an M5 screw carrying ${P.LEADS.m5} mm a turn is ${f1(screwPlan.stepsPerMm)}`]: 'the same 3,200 over an M5 screw carrying 0.8 mm a turn is 4,000.0',
}, 'Three axis deeper 1');
covered(L.threeAxisLesson.deeper[1].body, {[`its ${P.MOTOR.repeatableLow} or ${P.MOTOR.repeatable} percent`]: 'its 3 or 5 percent'}, 'Three axis deeper 2');
covered(L.threeAxisLesson.deeper[2].body, {[`does so to ${f2(P.MARLIN.lashResolution * 1000)} μm and expects an answer under ${P.MARLIN.lashLimit} mm`]: 'does so to 5.00 μm and expects an answer under 0.5 mm'}, 'Three axis deeper 3');
covered(L.threeAxisLesson.deeper[3].body, {[`ceiling of ${P.MARLIN.maxFeed[2]} mm/s is a two hundredth of the belts’ ${P.MARLIN.maxFeed[0]} mm/s`]: 'ceiling of 2.25 mm/s is a two hundredth of the belts’ 500 mm/s'}, 'Three axis deeper 4');
covered(L.threeAxisLesson.deeper[4].body, {[`an acceleration of ${P.MARLIN.accel} mm/s²`]: 'an acceleration of 3000 mm/s²', [`gaining ${SRC.marlin.per30} mm/s within a thirtieth`]: 'gaining 100 mm/s within a thirtieth'}, 'Three axis deeper 5');
covered(L.threeAxisLesson.deeper[5].body, {}, 'Three axis deeper 6');
covered(L.stageLimits, {[`the ${P.BELT.teeth} tooth pulley, which with the sourced ${P.BELT.pitch} mm belt pitch gives exactly the ${P.MARLIN.stepsPerMm[0]} steps a millimeter Marlin ships`]: 'the 20 tooth pulley, which with the sourced 2 mm belt pitch gives exactly the 80 steps a millimeter Marlin ships'}, 'stage limits');
covered(L.sharedLimits, {}, 'shared limits');
covered(L.threeAxisLesson.quiz.explanation, {[`stops ${f1(playPlan.endTable * 1000)} μm short`]: 'stops 500.0 μm short'}, 'Three axis quiz');

const designDefault = P.designPlan({}), coarse = P.designPlan({facets: 8}), fineDesign = P.designPlan({facets: 128});
expectNone(L.cadDesignLesson, 'Design');
covered(L.cadDesignLesson.deeper[0].body, {[`${f0(designDefault.triangles)} in all`]: '252 in all'}, 'Design deeper 1');
covered(L.cadDesignLesson.deeper[1].body, {
  [`At ${designDefault.facets} facets on a ${designDefault.radius} mm radius it is ${f1(designDefault.outerError * 1000)} μm; at ${coarse.facets} facets it is ${f1(coarse.outerError * 1000)} μm and at ${fineDesign.facets} it is ${f1(fineDesign.outerError * 1000)} μm, a fall of about ${f0(Math.round(coarse.outerError / fineDesign.outerError / 10) * 10)} times`]: 'At 32 facets on a 12 mm radius it is 57.8 μm; at 8 facets it is 913.4 μm and at 128 it is 3.6 μm, a fall of about 250 times',
}, 'Design deeper 2');
covered(L.cadDesignLesson.deeper[2].body, {
  [`an ${P.STL.header} byte header and a ${P.STL.count} byte count`]: 'an 80 byte header and a 4 byte count',
  [`${P.STL.floats} numbers of ${P.STL.floatBytes} bytes`]: '12 numbers of 4 bytes',
  [`and ${P.STL.attribute} more bytes after them: ${f0(P.STL.floats * P.STL.floatBytes + P.STL.attribute)} bytes each`]: 'and 2 more bytes after them: 50 bytes each',
  [`${P.stlBytes(0)} bytes plus ${f0(P.STL.floats * P.STL.floatBytes + P.STL.attribute)} a triangle, and the ${f0(designDefault.triangles)} triangles of this shape come to ${f0(designDefault.bytes)} bytes while the ${f0(fineDesign.triangles)} of its smoothest version come to ${f0(fineDesign.bytes)}`]: '84 bytes plus 50 a triangle, and the 252 triangles of this shape come to 12,684 bytes while the 1,020 of its smoothest version come to 51,084',
}, 'Design deeper 3');
covered(L.cadDesignLesson.deeper[3].body, {}, 'Design deeper 4');
covered(L.cadDesignLesson.deeper[4].body, {
  [`two ${P.SLICING.width} mm perimeters at a ${f1(P.SLICING.atLayer)} mm layer height at ${P.SLICING.twoPerimeters} mm rather than ${f2(2 * P.SLICING.width)} mm`]: 'two 0.45 mm perimeters at a 0.2 mm layer height at 0.86 mm rather than 0.90 mm',
  [`gives ${f3(designDefault.shell)} mm, and the cross section of one bead, ${fixed(designDefault.bead, 4)} mm²`]: 'gives 0.857 mm, and the cross section of one bead, 0.0814 mm²',
}, 'Design deeper 5');
covered(L.cadDesignLesson.deeper[5].body, {
  [`below ${f0(P.SLICING.share * 100)} percent of the nozzle diameter, which puts about ${f2(P.SLICING.nozzle * P.SLICING.share)} mm at the top for a ${P.SLICING.nozzle} mm nozzle`]: 'below 80 percent of the nozzle diameter, which puts about 0.32 mm at the top for a 0.4 mm nozzle',
  [`below ${f2(P.SLICING.suggestFrom)} mm because the gain over ${P.SLICING.fine[0]} or ${P.SLICING.fine[1]} mm layers`]: 'below 0.10 mm because the gain over 0.07 or 0.05 mm layers',
}, 'Design deeper 6');
covered(L.designLimits, {}, 'design limits');
covered(L.cadDesignLesson.quiz.explanation, {[`At ${designDefault.facets} facets on this shape the surface falls ${f1(designDefault.outerError * 1000)} μm short`]: 'At 32 facets on this shape the surface falls 57.8 μm short'}, 'Design quiz');

const scanDefault = P.scanPlan({}), whole = P.scanPlan({subpixel: 0}), tallRidge = P.scanPlan({ridge: 12});
expectNone(L.laserScanningLesson, 'Laser');
covered(L.laserScanningLesson.deeper[0].body, {}, 'Laser deeper 1');
covered(L.laserScanningLesson.deeper[1].body, {
  [`that is ${f2(scanDefault.resolutionMicrons)} μm; at the near end ${f2(scanDefault.atStart)} μm and at the far end ${f2(scanDefault.atEnd)} μm`]: 'that is 2.01 μm; at the near end 1.32 μm and at the far end 2.85 μm',
  [`holds its line to ${P.SCANNER.linearity} μm`]: 'holds its line to 2 μm',
}, 'Laser deeper 2');
covered(L.laserScanningLesson.deeper[2].body, {
  [`a cell of ${f3(whole.gridMicrons)} μm read whole, or a grid of ${f3(scanDefault.gridMicrons)} μm read between, and a height out by ${f1(Math.abs(whole.samples.find(s => Math.abs(s.x) < 1e-9).error) * 1000)} μm`]: 'a cell of 3.700 μm read whole, or a grid of 0.074 μm read between, and a height out by 23.2 μm',
}, 'Laser deeper 3');
covered(L.laserScanningLesson.deeper[3].body, {}, 'Laser deeper 4');
covered(L.laserScanningLesson.deeper[4].body, {}, 'Laser deeper 5');
covered(L.laserScanningLesson.deeper[5].body, {
  [`runs from ${P.SCANNER.start} mm to ${P.SCANNER.end} mm, ${P.SCANNER.height} mm deep, holding its line to ${P.SCANNER.linearity} μm and reading ${f0(P.SCANNER.points)} points along every profile at up to ${f0(P.SCANNER.fast)} profiles a second with a ${P.SCANNER.wavelength} nm laser`]: 'runs from 53.5 mm to 78.5 mm, 25 mm deep, holding its line to 2 μm and reading 1,280 points along every profile at up to 2,000 profiles a second with a 658 nm laser',
}, 'Laser deeper 6');
covered(L.scanLimits, {[`focal length of ${P.SCAN.focal} mm`]: 'focal length of 20 mm', [`the ${P.SCANNER.linearity} μm the catalog quotes`]: 'the 2 μm the catalog quotes'}, 'scan limits');
covered(L.laserScanningLesson.quiz.explanation, {[`${f0(tallRidge.missing)} of the ${f0(tallRidge.samples.length)} attempts fail`]: '4 of the 25 attempts fail'}, 'Laser quiz');

// The models' own words, and their readings.
const partText = (model, id) => model.parts.find(item => item.id === id).description;
stage.reset();
covered(partText(stage, 'motor'), {[`a ${f2(P.MOTOR.faceplate)} mm faceplate`]: 'a 43.18 mm faceplate', [`a toothed pulley of ${P.BELT.teeth} teeth at a ${P.BELT.pitch} mm pitch`]: 'a toothed pulley of 20 teeth at a 2 mm pitch'}, 'stage motor text');
covered(partText(stage, 'drive'), {[`drawn ${f0(S.timesLarger(S.CLOSE))} times larger`]: 'drawn 10 times larger', [`A belt of ${P.BELT.pitch} mm pitch on a ${P.BELT.teeth} tooth pulley carries ${f0(P.BELT.pitch * P.BELT.teeth)} mm a turn; an M5 screw of ${P.LEADS.m5} mm lead carries ${P.LEADS.m5} mm a turn`]: 'A belt of 2 mm pitch on a 20 tooth pulley carries 40 mm a turn; an M5 screw of 0.8 mm lead carries 0.8 mm a turn'}, 'stage drive text');
covered(partText(stage, 'grid'), {[`at most ${S.GRIDVIEW.cells} microsteps`]: 'at most 64 microsteps'}, 'stage grid text');
covered(partText(stage, 'stage'), {[`bar below is ${S.RIG.scaleBar} mm long`]: 'bar below is 20 mm long'}, 'stage rig text');
design.reset();
covered(partText(design, 'solid'), {[`1 mm to ${D.CUP} scene units`]: '1 mm to 0.04 scene units'}, 'design solid text');
covered(partText(design, 'facet'), {[`drawn ${f0(D.timesLarger(D.FACET))} times larger`]: 'drawn 100 times larger'}, 'design facet text');
covered(partText(design, 'file'), {[`${P.STL.floats} numbers of ${P.STL.floatBytes} bytes each, ${f0(P.STL.floats * P.STL.floatBytes)} bytes, plus ${P.STL.attribute} more`]: '12 numbers of 4 bytes each, 48 bytes, plus 2 more', [`an ${P.STL.header} byte header and a ${P.STL.count} byte count`]: 'an 80 byte header and a 4 byte count'}, 'design file text');
covered(partText(design, 'path'), {[`drawn ${f0(D.timesLarger(D.PATHVIEW))} times larger`]: 'drawn 3 times larger'}, 'design path text');
covered(partText(design, 'chart'), {[`from ${P.DESIGN_DOMAINS.facets[0]} to ${P.DESIGN_DOMAINS.facets[1]}`]: 'from 8 to 128', [`a factor of about ${250} across`]: 'a factor of about 250 across'}, 'design chart text');
scanner.reset();
covered(partText(scanner, 'bench'), {[`1 mm to ${R.BENCH} scene units`]: '1 mm to 0.018 scene units', [`the ${P.SCANNER.start} to ${P.SCANNER.end} mm`]: 'the 53.5 to 78.5 mm'}, 'scan bench text');
covered(partText(scanner, 'profile'), {[`drawn ${f0(R.timesLarger(R.PROFILE))} times larger`]: 'drawn 3 times larger'}, 'scan profile text');
covered(partText(scanner, 'sensor'), {[`a window of ${R.SENSOR.cells} cells`]: 'a window of 9 cells'}, 'scan sensor text');
covered(partText(scanner, 'chart'), {[`across the ${P.SCANNER.height} mm`]: 'across the 25 mm'}, 'scan chart text');

{
  stage.reset();
  const readings = stage.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Steps a millimeter,One microstep,Reached,Lost motion,The move,Drawn', 'seven readings on the stage');
  t.ok(find('Steps a millimeter').value === '80.0' && find('One microstep').value === '12.5 μm' && find('Reached').value === '6.3750 mm' && find('Lost motion').value === '100.0 μm', 'carrying the lesson’s figures');
  design.reset();
  const dReadings = design.getState().readings, dFind = label => dReadings.find(item => item.label === label);
  t.ok(dFind('Triangles').value === '252' && dFind('Chord error').value === '57.8 μm' && dFind('File size').value === '12,684 bytes' && dFind('Layers').value === '60', 'the design’s figures');
  scanner.reset();
  const rReadings = scanner.getState().readings, rFind = label => rReadings.find(item => item.label === label);
  t.ok(rFind('Measured height').value === 'not yet measured', 'nothing measured before the sweep starts');
  scanner.advance(P.SCAN.duration);
  t.ok(scanner.getState().readings.find(item => item.label === 'Measured height').value === '5.9999 mm', 'and a height once it has run');
  t.ok(rFind('One pixel is worth').value === '2.01 μm', 'the scanner’s figure');
}

// Routing: three machines, each with its own lesson and its own model.
for (const [name, lesson] of [['Three-axis positioning', L.threeAxisLesson], ['Computer-aided design', L.cadDesignLesson], ['Laser scanning of 3D objects', L.laserScanningLesson]]) {
  t.ok(dailyLifeLessons[name] === lesson, `${name} is registered as a lesson`);
  const model = createDailyLifeMachine(name);
  t.ok(model, `${name} has a model`);
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part)), `${name}: every trial names a part it has`);
  model.dispose();
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

const benches = [
  ['the stage', stage, S.createThreeAxisModel, P.STAGE_DOMAINS, P.STAGE_DEFAULTS, P.sampleStage, L.threeAxisLesson, m => m.advance(20)],
  ['the design', design, D.createCADDesignModel, P.DESIGN_DOMAINS, P.DESIGN_DEFAULTS, P.sampleDesign, L.cadDesignLesson, m => m.advance(20)],
  ['the scanner', scanner, R.createLaserScanningModel, P.SCAN_DOMAINS, P.SCAN_DEFAULTS, P.sampleScan, L.laserScanningLesson, m => m.advance(20)],
];
// Array.map hands its callback an index, so the walker is named and called
// with one argument: passing it straight to map would make every topology
// entry past the fourth look like depth 4 and collapse to nothing.
function drawnState(value, depth = 0) {
  if (depth > 3) return 0;
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value.slice(0, 40).map(item => drawnState(item, depth + 1));
  if (value && typeof value === 'object') {
    if (value.isMesh || value.isLine || value.isLineSegments || value.isInstancedMesh) {
      const array = value.geometry?.attributes?.position?.array;
      return [value.visible ? 1 : 0, value.position.x, value.position.y, value.scale.x, value.scale.y, value.count ?? -1,
        array ? Array.from(array.slice(0, 60)) : 0, value.geometry?.drawRange?.count ?? -1, value.material?.color ? value.material.color.getHex() : 0];
    }
    if (value.isObject3D) return [value.visible ? 1 : 0, value.position.x, value.position.y];
  }
  return 0;
}
const snapshotOf = model => () => JSON.stringify(Object.values(model.topology).map(item => drawnState(item)));

for (const [name, model, make, domains, defaults, sample, lesson, settle] of benches) {
  for (const control of model.controls) {
    const [lo, hi, step] = domains[control.key];
    t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === defaults[control.key], `${name}: ${control.key} spans its domain from its default`);
    t.ok(typeof control.label === 'string' && control.label.length > 0 && typeof control.help === 'string' && control.help.length > 0, `${name}: ${control.key} is labeled and explained`);
    t.ok(!/[—–]| - |--/.test(control.help) && !/[—–]| - |--/.test(control.label), `${name}: ${control.key} has no dash as punctuation`);
  }
  assert.deepEqual(model.controls.map(control => control.key), Object.keys(domains), `${name}: a control for every domain, in order`);
  checkControlsMove(model, snapshotOf(model), settle, t);
  checkRefusals(sample, domains, t);
  model.reset();
  checkFinite(model.root, t);
  t.ok(!model.playback.complete() && !model.resultPart.available(), `${name}: nothing to inspect before it runs`);
  model.playback.step();
  t.ok(model.getState().clock > 0, `${name}: a step moves the clock`);
  model.advance(1e4);
  t.ok(model.playback.complete() && model.resultPart.available(), `${name}: it finishes with a result to inspect`);
  t.ok(model.parts.some(part => part.id === model.resultPart.id), `${name}: the result names a part it has`);
  for (const key of ['label', 'description', 'stepLabel']) t.ok(typeof model.playback[key] === 'string' && model.playback[key].length > 0, `${name}: playback has a ${key}`);
  for (const key of ['advance', 'step', 'complete', 'blocked']) t.ok(typeof model.playback[key] === 'function', `${name}: playback has ${key}()`);
  t.ok(model.playback.blocked() === false, `${name}: nothing blocks it`);
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0, `${name}: ${action.label} returns readings`);
    t.ok(model.parts.some(part => part.id === action.part), `${name}: ${action.label} names a part it has`);
    checkFinite(model.root, t);
  }
  t.ok(model.initialPart === 'system' && model.frameVisibleOnly === true && Number.isFinite(model.framePadding), `${name}: framing set`);
  t.ok(model.parts.every(part => part.id === 'system' || part.parentId === 'system'), `${name}: every part is a child of the system`);
  t.ok(model.parts.every(part => part.description && !/[—–]| - |--/.test(part.description)), `${name}: every part described, with no dash as punctuation`);
  t.ok(model.parts[0].id === 'system', `${name}: the system comes first`);
  // Every reading is a number the reader can read, at every setting.
  for (const control of model.controls) {
    const values = control.options ? control.options.map(option => option.value) : [control.min, control.initial, control.max];
    for (const value of values) {
      model.reset();
      model.update({[control.key]: value});
      settle(model);
      for (const item of model.getState().readings) {
        t.ok(!/NaN|undefined|Infinity|null/.test(String(item.value) + (item.hint || '')), `${name}: ${control.key} at ${value} leaves every reading readable`);
        t.ok(!/[—–]| - |--/.test(String(item.value) + (item.hint || '')), `${name}: ${control.key} at ${value} leaves no dash as punctuation`);
      }
      checkFinite(model.root, t);
      counts.poses++;
    }
  }
  // The house style, across everything the reader can see.
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options,
    ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]),
    ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]),
    ...lesson.sources.map(source => source.title)];
  for (const text of all) {
    t.ok(!/[—–]| - |--/.test(text), `${name}: no dash as punctuation in "${text.slice(0, 60)}"`);
    t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|neighbour|aluminium)\b/i.test(text), `${name}: American spelling in "${text.slice(0, 60)}"`);
  }
  t.ok(lesson.steps.length === 5, `${name}: five steps`);
  t.ok(lesson.parts.length >= 6, `${name}: at least six part rows`);
  t.ok(lesson.tryIt.length >= 6 && lesson.tryIt.length <= 7, `${name}: six or seven trials`);
  t.ok(lesson.deeper.length >= 5 && lesson.deeper.length <= 6, `${name}: five or six deeper sections`);
  t.ok(lesson.quiz.options.length === 3 && lesson.quiz.answer === 0, `${name}: a quiz of three with the answer first`);
  t.ok(lesson.sources.length >= 2 && lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, `${name}: at least two https sources, none twice`);
  t.ok(lesson.tryIt.every(item => item.reset === true && item.isolate === false && item.view === 'front'), `${name}: every trial resets, does not isolate, and faces front`);
  void make;
}

const released = benches.reduce((total, [, , make]) => total + checkDisposal((() => { const fresh = make(); fresh.advance(2); return fresh; })(), t), 0);
for (const [, model] of benches) model.dispose();

console.log(`PASS three axis positioning, computer aided design and laser scanning: ${t.count} checks, ${counts.poses} poses, ${counts.steps} integration and simulation steps, ${counts.points} drawn points read back, ${counts.samples} traced samples, ${counts.facets} faceted curves, ${counts.numbers} quoted numbers traced, 3 lessons and 21 trials, ${released} resources released exactly once.`);

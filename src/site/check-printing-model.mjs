// Checks shared printer math and the CAD viewer contract.
// Scanner geometry and acquisition have dedicated independent checks.
// Three-axis positioning has its own numerical, model and browser checks.
// The draft models are checked against their recorded fixtures and physics by
// other routes: steps a millimeter counted rather than divided, a trapezoidal
// move integrated from its own speed, lost motion simulated one small step at a
// time, the chord error measured off a sampled arc, a polygon's area by the
// shoelace formula, a bead's cross section by slices, and the depth a sensor
// cell is worth differentiated numerically. Then every drawn line, block, dot
// and curve is read back from the geometry at swept settings and times.
import assert from 'node:assert/strict';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './printing-physics.js';
import * as D from './cad-design-model.js';
import * as L from './printing-lessons.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {createDailyLifeMachine} from './daily-life-models.js';

const t = tally();
const counts = {steps: 0, poses: 0, points: 0, numbers: 0, samples: 0, facets: 0};
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;
const f2 = v => fixed(v, 2);

// ---------------------------------------------------------------------------
// 1. Source constants, declared fixture values, and independent math checks.
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
    const corners = Array.from({length: facets}, (_, i) => [radius * Math.cos(2 * Math.PI * i / facets), radius * Math.sin(2 * Math.PI * i / facets)]);
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
// CAD topology, exact clipped paths, and boundary layers have dedicated independent checks.
await import('./check-cad-design-physics.mjs');
await import('./check-cad-design-model.mjs');

// ---------------------------------------------------------------------------
// 2. Dedicated geometry and acquisition checks.
// ---------------------------------------------------------------------------

await import('./check-laser-scanning-physics.mjs');
await import('./check-laser-scanning-model.mjs');
const design = D.createCADDesignModel();

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes.
// ---------------------------------------------------------------------------

const runner = make => values => { const m = make(); m.reset(); m.update(values); m.advance(1e4); const s = m.getState(); m.dispose(); return s; };
const runDesign = runner(D.createCADDesignModel);

checkTrialNumbers(L.cadDesignLesson, {
  'Describe the shape': s => ({252:s.triangles,60:s.layers}),
  'Use only eight facets': s => ({60:s.triangles,'913.4':s.outerError*1000,12:s.radius}),
  'Use a hundred and twenty eight': s => ({'1,020':s.triangles,'51,084':s.bytes,'3.6':s.outerError*1000}),
  'Cut it into thinner layers': s => ({240:s.layers,60:P.designPlan({}).layers,'57.8':s.outerError*1000}),
  'Cut it into thicker ones': s => ({40:s.layers,252:s.triangles}),
  'Ask for too many loops': () => ({}),
  'Fill the space between loops': () => ({}),
  'Make a wider, taller cup': s => ({32:s.facets,'96.3':s.outerError*1000,120:s.layers,252:s.triangles}),
  'Try a thin wall and wide bead': () => ({}),
}, runDesign, t);

const designDefault = P.designPlan({});
checkQuotedText(L.cadDesignLesson.deeper[2].body, {
  [`At R = ${designDefault.radius} mm and N = ${designDefault.facets}, the error is ${designDefault.outerError.toFixed(4)} mm`]: 'At R = 12 mm and N = 32, the error is 0.0578 mm',
}, t);
checkQuotedText(L.cadDesignLesson.deeper[5].body, {
  [`Two ${designDefault.width.toFixed(2)} mm beads at ${designDefault.layer.toFixed(2)} mm height occupy about ${P.beadsWide(2,designDefault.width,designDefault.layer).toFixed(3)} mm`]: 'Two 0.45 mm beads at 0.20 mm height occupy about 0.857 mm',
}, t);

{
  design.reset();
  const dReadings = design.getState().readings, dFind = label => dReadings.find(item => item.label === label);
  t.ok(dFind('Triangles').value === '252' && dFind('Chord error').value === '57.8 μm' && dFind('STL size').value === '12,684 bytes' && dFind('Layers').value === '60', 'the design’s figures');

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
  ['the design', design, D.createCADDesignModel, P.DESIGN_DOMAINS, P.DESIGN_DEFAULTS, P.sampleDesign, L.cadDesignLesson, m => m.advance(20)],
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
        array ? Array.from(array.slice(0, 60)) : 0, value.geometry?.drawRange?.count ?? -1, value.material?.color ? value.material.color.getHex() : 0, value.userData?.labelText ?? ''];
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
  t.ok(lesson.tryIt.length === (name === 'the design' ? 9 : 7), `${name}: all named trials present`);
  t.ok(lesson.deeper.length === (name === 'the design' ? 7 : 6), `${name}: all deeper sections present`);
  t.ok(lesson.quiz.options.length === 3 && lesson.quiz.answer === 0, `${name}: a quiz of three with the answer first`);
  t.ok(lesson.sources.length >= 2 && lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, `${name}: at least two https sources, none twice`);
  t.ok(lesson.tryIt.every(item => item.reset === true && item.isolate === (name === 'the design' && !['system','solid'].includes(item.part)) && item.view === 'front'), `${name}: every trial resets and uses its declared inspection view`);
  void make;
}

const released = benches.reduce((total, [, , make]) => total + checkDisposal((() => { const fresh = make(); fresh.advance(2); return fresh; })(), t), 0);
for (const [, model] of benches) model.dispose();

console.log(`PASS CAD viewer contract and shared printer math: ${t.count} checks, ${counts.poses} poses, ${counts.steps} integration steps, ${counts.samples} triangulation derivative checks, ${counts.facets} facet comparisons, 3 lesson routes, ${released} resources released exactly once.`);

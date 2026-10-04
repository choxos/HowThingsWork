import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVacuumCleanerModel, cleanerChartPoint} from './vacuum-cleaner-model.js';
import {CLEANER as C, CLEANER_DEFAULTS as D, cleanerPlan, sampleCleaner} from './vacuum-cleaner-physics.js';
import {vacuumCleanerLesson as lesson} from './vacuum-cleaner-lesson.js';
import {tally, checkFinite, checkDisposal, checkControlsMove} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';

const t = tally(), m = createVacuumCleanerModel(), p = m.topology, {MM, G, paths} = p;
const world = (object, a) => object.localToWorld(new THREE.Vector3(...a));
const mm = a => a.map(v => v * MM);
const nearVector = (a, b, label, tolerance = 1e-9) => t.near(a.distanceTo(b), 0, tolerance, label);
const core = s => [s.clock, s.values, s.flow, s.pressure, s.volume, s.airEnergy, s.onFloor, s.inTransit, s.collected];
const reset = (values = {}, time = 0) => {const settings = {...D, ...values};m.reset({settings, time});m.update(settings);m.root.updateMatrixWorld(true);return m.getState();};
m.root.position.set(.2, -.3, .4);m.root.rotation.set(.1, -.25, .2);
reset();

// Measure the rendered hose independently at much finer resolution than its
// tracer polyline. Check clearance along its whole route, not just control points.
const hose = paths.hoseCurve.getSpacedPoints(10000);let length = 0, floorClearance = Infinity;
for (let i = 0; i < hose.length; i++) {floorClearance = Math.min(floorClearance, hose[i].y - 18);if (i) length += hose[i].distanceTo(hose[i - 1]);}
t.near((length + Math.hypot(200, 580)) / 1000, 2.6, .0001, 'drawn hose plus wand matches the resistance length');
t.ok(floorClearance > 8, 'entire flexible wall clears the floor');
const wandAxis = new THREE.Vector3(200, 580, 0).normalize();
t.near(paths.hoseCurve.getTangent(0).dot(wandAxis), 1, 1e-5, 'hose joins the wand without an angular gap');
t.near(paths.hoseCurve.getTangent(1).dot(new THREE.Vector3(1, 0, 0)), 1, 1e-5, 'hose meets horizontal bag collar');
nearVector(new THREE.Vector3(...G.wandStart).sub(new THREE.Vector3(...G.neck)).normalize(), wandAxis, 'head neck and wand share their end-face orientation');
nearVector(hose[0], new THREE.Vector3(...G.handle), 'hose starts at wand end');nearVector(hose.at(-1), new THREE.Vector3(...G.inlet), 'hose ends at bag inlet');
const wandSegment = new THREE.Line3(new THREE.Vector3(...G.wandStart), new THREE.Vector3(...G.handle));
for (const [i, v] of hose.entries()) if (i > 350) t.ok(v.distanceTo(wandSegment.closestPointToPoint(v, true, new THREE.Vector3())) > 36, 'hose loop does not intersect the wand');
const coarse = hose.filter((_, i) => i % 25 === 0);
for (let i = 0; i < coarse.length; i++) for (let j = i + 12; j < coarse.length; j++) t.ok(coarse[i].distanceTo(coarse[j]) > 36, 'nonadjacent hose segments do not intersect');

// Rays pass through openings and hit neighboring material. A transparent solid
// cylinder or a missing wall cannot satisfy both halves of these probes.
let rays = 0;
function rayLocal(mesh, origin, target, hit) {
  const a = world(mesh, mm(origin)), b = world(mesh, mm(target)), delta = b.clone().sub(a);
  const found = new THREE.Raycaster(a, delta.clone().normalize(), 0, delta.length()).intersectObject(mesh, false).length > 0;
  t.ok(found === hit, `${mesh.name || 'surface'} ${hit ? 'wall exists' : 'opening is clear'} at ${origin}`);rays++;
}
for (const tube of [p.wandTube, p.headNeck, p.bagCollar]) {
  tube.geometry.computeBoundingBox();const half = tube.geometry.boundingBox.max.y / MM;
  for (const x of [0, 8, 14]) rayLocal(tube, [x, -half - 5, 0], [x, half + 5, 0], false);
  for (const x of [16.5, 17.5]) rayLocal(tube, [x, -half - 5, 0], [x, half + 5, 0], true);
}
for (const [plate, opening, wall] of [
  [p.inletWall, [0, 0], [24, 0]], [p.outletWall, [0, 105], [60, 105]],
  [p.bagFront, [0, 0], [20, 0]], [p.filterPartition, [0, 2], [115, 2]],
  [p.headRoof, [G.neck[0] + 380, 0], [35, 0]], [p.collectorFloor, [-72, 0], [-20, 0]],
]) {rayLocal(plate, [...opening, -30], [...opening, 30], false);rayLocal(plate, [...wall, -30], [...wall, 30], true);}
for (const mesh of [p.frontShroud, p.backShroud, p.hub, p.inletRing, p.rearPlate, p.blowerBearing, ...p.motorEnds, ...p.motorBearings]) rayLocal(mesh, [0, -60, 0], [0, 60, 0], false);
rayLocal(p.tool, [0, -5, 0], [0, 125, 0], false);rayLocal(p.tool, [7, -5, 0], [7, 40, 0], true);
// The actual inner rectangle, including its corners, has the claimed area.
const positions = p.tool.geometry.attributes.position, mouth = [];
for (let i = 0; i < positions.count; i++) if (Math.abs(positions.getY(i)) < 1e-8) mouth.push([positions.getX(i) / MM, positions.getZ(i) / MM]);
for (const x of [-6, 6]) for (const z of [-12.5, 12.5]) t.ok(mouth.some(v => Math.hypot(v[0] - x, v[1] - z) < 1e-5), 'crevice inner mouth corner is modeled');
t.near(.012 * .025, cleanerPlan({nozzle: 1}).slotArea, 1e-15, 'crevice mouth area agrees with the flow calculation');
function apparatusRay(a, b, targets) {const origin = world(p.apparatus, mm(a)), end = world(p.apparatus, mm(b)), delta = end.clone().sub(origin);rays++;return new THREE.Raycaster(origin, delta.clone().normalize(), 0, delta.length()).intersectObjects(targets, true);}
for (const z of [55.2, 80, 180, 280, 304.8]) {
  t.ok(apparatusRay([-430, 3, z], [-420, 3, z], [p.head]).length === 0, 'full 250 mm floor slot is open');
  t.ok(apparatusRay([-430, 12, z], [-420, 12, z], [p.head]).length > 0, 'front lip above slot is solid');
}
for (const z of [53, 307]) t.ok(apparatusRay([-430, 3, z], [-420, 3, z], [p.head]).length > 0, 'side walls bound the stated slot width');
reset({nozzle: 2});
for (const z of [55.2, 180, 304.8]) t.ok(apparatusRay([-432, 3, z], [-420, 3, z], [p.sealPlate]).length > 0, 'sealing plate covers the opening');
// Grille free area: explicit bar widths, not the bounding area of a solid plate.
let barArea = 0;
for (const bar of p.grille) {bar.geometry.computeBoundingBox();const size = bar.geometry.boundingBox.getSize(new THREE.Vector3()).divideScalar(MM);t.near(size.y, 50, 1e-4, 'grille bar spans opening height');barArea += size.y * size.z;}
t.near((100 * 50 - barArea) * 1e-6, C.outletArea, 1e-10, 'drawn open grille area agrees with outlet loss');
for (const z of [-30, -10, 10, 30]) t.ok(apparatusRay([467, 325, z], [480, 325, z], [p.outletWall, ...p.grille]).length === 0, 'exhaust can leave through grille');
for (const z of [-40, -20, 0, 20, 40]) t.ok(apparatusRay([467, 325, z], [480, 325, z], p.grille).length > 0, 'grille bars remain solid');
// Air approaches through the annular eye, never through shaft or hub.
for (const segment of paths.air[0].segments.filter(s => s.label === 'fan eye')) t.ok(apparatusRay(segment.a, segment.b, [p.inletRing, p.shaftMesh, p.hub, p.frontShroud]).length === 0, 'fan inlet route clears eye, hub and shaft');
const radial = paths.air[0].segments.find(s => s.label === 'impeller and collector');
t.ok(apparatusRay(radial.a, radial.b, [p.hub, p.shaftMesh]).length === 0, 'radial representative route clears hub');

// Integrate distance along each independently walked section at Q/A. This
// checks marker placement and finish times without calling tracePoint().
function transported(route, Q, elapsed) {
  let remaining = elapsed;
  for (const segment of route.segments) {
    const distance = Math.hypot(...segment.b.map((v, k) => v - segment.a[k])) / 1000;
    if (Q === 0) return segment.a;
    const duration = distance * segment.area / Q;
    if (remaining < duration) return segment.a.map((v, k) => v + (segment.b[k] - v) * remaining / duration);
    remaining -= duration;
  }
  return route.segments.at(-1).b;
}
let poses = 0, markers = 0;
for (const nozzle of [0, 1, 2]) for (let bag = 1; bag <= 4; bag += .5) for (const filter of [0, 1]) for (const motor of [0, 1]) {
  const settings = {nozzle, bag, filter, motor};let priorCollected = 0;
  for (const clock of [0, .5, 3, 8, 12.5, 20, 30]) {
    const s = reset(settings, clock), fitted = nozzle === 1 ? 1 : 0, expected = sampleCleaner(settings, clock);poses++;
    for (const key of ['flow', 'pressure', 'volume', 'airEnergy']) t.near(s[key], expected[key], 1e-12, 'render state preserves physical quantity ' + key);
    t.ok(s.onFloor + s.inTransit + s.collected === 12, 'all dust markers remain accounted for');t.ok(s.collected >= priorCollected, 'collected markers never respawn');priorCollected = s.collected;
    assert.equal(p.head.visible, nozzle !== 1);assert.equal(p.tool.visible, nozzle === 1);assert.equal(p.seal.visible, nozzle === 2);
    for (const object of [p.impeller, p.shaft, p.rotor]) t.near(object.rotation.x, motor ? Math.PI * 2 * clock : 0, 1e-12, 'common drive shares one angle');
    nearVector(world(p.impeller, [0, 0, 0]), world(p.apparatus, mm([308, 230, 0])), 'impeller stays centered on fixed shaft axis');
    nearVector(world(p.rotor, [0, 0, 0]), world(p.apparatus, mm([390, 230, 0])), 'motor rotor stays on common shaft axis');
    p.grains.forEach((grain, i) => {const trace = paths.dust[fitted][i], expected = transported(trace.route, s.flow, clock / 30);nearVector(grain.position, new THREE.Vector3(...mm(expected)), 'dust follows conserved transported volume');markers++;
      if (s.collected === 12) {t.ok(grain.position.x / MM > 32.3 && grain.position.x / MM < 227.7, 'retained grain stays inside bag length');t.ok(grain.position.y / MM > 122.3 && grain.position.y / MM < 317.7, 'retained grain clears bag floor and roof');t.ok(Math.abs(grain.position.z / MM) < 97.7, 'retained grain stays inside bag width');}
    });
    if (s.flow === 0) {t.ok(p.dots.every(dot => !dot.visible), 'no moving air stream when blocked');t.ok(s.onFloor === 12, 'no dust enters without flow');}
    if (clock === 30 && s.flow > 0) t.ok(s.collected === 12, 'every permitted open trial completes its sample');
    const chart = p.operatingDot.position;t.near(chart.x, cleanerChartPoint(s.flow, s.pressure)[0], 1e-12, 'operating dot flow');t.near(chart.y, cleanerChartPoint(s.flow, s.pressure)[1], 1e-12, 'operating dot pressure');
    const losses = Object.values(s.drops);p.bars.forEach((bar, i) => {t.near(bar.position.y / MM, -100 + losses[i] / 7000 * 105, 1e-9, 'bar rises from zero with its loss');assert.equal(bar.visible, losses[i] > 0);});
    if (clock === 3) checkFinite(m.root, t);
  }
}
const rounded = (number, digits) => Number(number.toFixed(digits));
const expectedTrials = [
  {collected: 12, flow: 26.34, pressure: 3.03}, {inTransit: 12}, {collected: 12},
  {inTransit: 12, flow: 20.49, pressure: 4.60}, {collected: 12}, {flow: 20.49, pressure: 4.60},
  {bagLoss: 3.28, pressure: 4.60}, {flow: 17.03, speed: 56.78}, {onFloor: 12, flow: 0, pressure: 7, force: 10.50},
  {onFloor: 12, flow: 0, pressure: 0}, {collected: 10, inTransit: 2, flow: 24.39, filterLoss: 1.32}, {}, {}, {collected: 12, flow: 13.91},
];
assert.equal(expectedTrials.length, lesson.tryIt.length);
for (const [i, trial] of lesson.tryIt.entries()) for (const prior of [{motor: 0, nozzle: 2}, {nozzle: 1, bag: 4, filter: 1}]) {
  reset(prior, 20);m.reset(trial.initialState);m.update(trial.values);const s = m.getState();
  assert.deepEqual(s.values, trial.values);assert.equal(s.clock, trial.initialState.time);
  const values = {onFloor: s.onFloor, inTransit: s.inTransit, collected: s.collected, flow: rounded(s.flow * 1000, 2), pressure: rounded(s.pressure / 1000, 2), bagLoss: rounded(s.drops.bag / 1000, 2), filterLoss: rounded(s.drops.filter / 1000, 2), speed: rounded(s.slotSpeed, 2), force: rounded(s.holdingForce, 2)};
  for (const [key, expected] of Object.entries(expectedTrials[i])) t.near(values[key], expected, 0, `${trial.title}: stated result ${key}`);
  t.ok(m.parts.some(part => part.id === trial.part), 'every experiment has an existing inspection target');
}
for (const action of m.actions) {reset({nozzle: 1, bag: 4}, 12.5);const before = core(m.getState());action.run();assert.deepEqual(core(m.getState()), before, 'inspection does not change experiment');t.ok(m.parts.some(part => part.id === action.part), 'action part exists');}
reset();m.playback.step();t.near(m.getState().clock, 1, 0, 'one trace second per step');m.advance(1);t.near(m.getState().clock, 3, 0, 'playback advances two trace seconds per second');
m.advance(100);assert.equal(m.playback.complete(), true);const finish = p.grains.map(grain => grain.position.toArray());m.advance(1);assert.deepEqual(p.grains.map(grain => grain.position.toArray()), finish, 'completed positions are retained');
const replay = m.replayState();m.reset(replay);m.update(replay.settings);assert.equal(m.getState().clock, 0);assert.equal(m.getState().onFloor, 12);
reset({}, 20);m.update({bag: 4});assert.equal(m.getState().clock, 0);assert.equal(m.getState().volume, 0);assert.equal(m.getState().airEnergy, 0);assert.equal(m.getState().onFloor, 12);
for (const bad of [-1, 31, Infinity, NaN]) assert.throws(() => m.reset({time: bad}), RangeError);
checkControlsMove(m, () => [p.tool.visible, p.seal.visible, p.impeller.rotation.x, p.bagPaper[0].material.color.getHex(), p.pleats[0].material.color.getHex(), ...p.grains[0].position.toArray()], model => model.advance(1.1), t);
for (const chart of [p.fanChart, p.budgetChart]) t.ok(chart.userData.inspectionOnly && chart.userData.explosionExcluded && m.thumbnailOmit.includes(chart), 'plots stay outside physical parts inventory');
t.ok(m.controls.find(c => c.key === 'nozzle').primary, 'inlet selector is immediately visible');

let layouts = 0;const groupCounts = [];
for (const nozzle of [0, 1, 2]) for (const aspect of [1, 1.24]) {
  const model = createVacuumCleanerModel();model.reset({settings: {...D, nozzle}, time: 12.5});model.update({...D, nozzle});const before = JSON.stringify(core(model.getState()));
  const {camera} = frameModel(model, aspect), explosion = createPartExplosion(model, camera, aspect);explosion.update(1);
  const inverse = camera.quaternion.clone().invert(), boxes = explosion.items.map(unit => {const box = new THREE.Box3();for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse));return box;});
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) t.ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'separated physical parts do not overlap');
  groupCounts.push(boxes.length);explosion.update(0);explosion.dispose();assert.equal(JSON.stringify(core(model.getState())), before, 'separation preserves physical state');model.dispose();layouts++;
}
const resources = checkDisposal(m, t);m.dispose();
console.log(`PASS vacuum cleaner model: ${t.count} checks; ${poses} poses; ${markers} independently walked dust positions; ${rays} opening/wall rays; ${lesson.tryIt.length * 2} preset checkpoints; ${layouts} separated layouts (${groupCounts.join(',')} parts); ${resources} resources`);

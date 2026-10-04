import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWashingMachineModel, waterDepth, clumpPlace, clumpRadius, TUB} from './washing-machine-model.js';
import {MM, DRUM_GEOMETRY} from './washing-machine-geometry.js';
import {washerPlan, sampleWasher, tumble, WASHER_DEFAULTS, WASHER_DOMAINS} from './washing-machine-physics.js';
import {washingMachineLesson as lesson} from './washing-machine-lesson.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';

const t = tally(), model = createWashingMachineModel(), p = model.topology, near = (a, b, name, epsilon = 1e-8) => t.near(a, b, epsilon, name);
const state = () => JSON.stringify(model.getState());
let poses = 0, holes = 0;
assert.equal(model.parts.length, 45); assert.equal(new Set(model.parts.map(p => p.id)).size, 45);
assert.equal(model.initialPart, 'machine'); assert.equal(model.initialCutaway, true);
assert.equal(model.controls.length, 5);
const categories = ['structure', 'washing', 'drive', 'suspension', 'water-circuit', 'electronics'];
for (const id of categories) t.ok(model.parts.find(p => p.id === id).object.userData.explosionCategory, `${id} has a mechanism category`);
for (const object of p.moving) t.ok(object.parent, 'moving component remains mounted');
const endpoints = mesh => {
  const h = mesh.geometry.parameters.height;
  return [new THREE.Vector3(0, -h / 2, 0).applyMatrix4(mesh.matrixWorld), new THREE.Vector3(0, h / 2, 0).applyMatrix4(mesh.matrixWorld)];
};
function checkPose(values, time) {
  model.reset({settings: values, time}); model.root.updateMatrixWorld(true); poses++;
  const s = model.getState(), expected = sampleWasher(values, time), now = s.now;
  near(s.clock, expected.clock, 'requested physical time'); assert.equal(now.stage, expected.now.stage);
  near(p.drum.rotation.z, now.drawnAngle, 'drum continuous display angle'); near(p.rotor.rotation.z, p.drum.rotation.z, 'rotor and drum share shaft angle');
  near(p.impeller.rotation.z, -4 * Math.PI * s.pumpSeconds / 60, 'pump motion follows accumulated active time');
  for (const moving of p.moving) near(moving.position.x, s.swayMm * MM, 'tub-mounted components share displacement');
  for (const panel of p.tubShells) {
    const box = new THREE.Box3().setFromObject(panel);
    t.ok(box.min.x / MM > -290 && box.max.x / MM < 290, 'moving tub clears both cabinet walls');
  }
  for (const support of p.supports) {
    const a = new THREE.Vector3(...support.a.map(v => v * MM)), b = new THREE.Vector3((support.b[0] + s.swayMm) * MM, support.b[1] * MM, support.b[2] * MM);
    if (support.kind === 'spring') {
      near(support.coil.localToWorld(new THREE.Vector3(0, 0, 0)).distanceTo(a), 0, 'spring fixed anchor');
      near(support.coil.localToWorld(new THREE.Vector3(0, 1, 0)).distanceTo(b), 0, 'spring moves with tub lug');
    } else {
      const [bodyStart, bodyEnd] = endpoints(support.body), [pistonStart, pistonEnd] = endpoints(support.piston);
      near(bodyStart.distanceTo(a), 0, 'damper body anchored to base'); near(pistonEnd.distanceTo(b), 0, 'damper rod anchored to moving tub');
      t.ok(bodyEnd.distanceTo(a) > pistonStart.distanceTo(a), 'piston stays inside damper body');
    }
  }
  for (const hose of p.hoses) {
    const array = hose.mesh.geometry.attributes.position;
    for (const segment of [0, 48]) {
      const center = new THREE.Vector3();
      for (let j = 0; j < 8; j++) center.add(new THREE.Vector3().fromBufferAttribute(array, segment * 9 + j));
      center.multiplyScalar(1 / 8);
      const end = segment ? hose.points.length - 1 : 0, expected = new THREE.Vector3(...hose.points[end].map(v => v * MM));
      expected.x += hose.weights[end] * s.swayMm * MM;
      near(center.distanceTo(expected), 0, 'flexible hose endpoint follows its fixed or moving port', 2e-7);
    }
    const filling = ['valve-hose', 'fill-hose'].includes(hose.id), draining = ['sump', 'outlet'].includes(hose.id);
    const active = filling ? now.inletLps > 0 : draining && now.drainLps > 1e-9;
    assert.equal(hose.dots.some(dot => dot.visible), active, 'flow markers agree with actual flow'); t.add(1);
  }
  for (const [i, group] of p.clumps.entries()) {
    const center = new THREE.Vector2(group.position.x / MM, group.position.y / MM - TUB.y);
    t.ok(center.length() + clumpRadius(s.values.load) <= 250 + 1e-6, 'fabric marker remains inside inner drum');
    if (now.rpm === 0) t.ok(center.y < 0, 'stopped cloth rests below axle');
    if (now.rpm >= 100) near(center.length(), 250 - clumpRadius(s.values.load), 'spinning fabric pinned to wall');
  }
  const lumpCenter = Math.hypot(p.lump.position.x / MM, p.lump.position.y / MM - TUB.y);
  t.ok(lumpCenter + 30 * p.lump.scale.x <= 250 + 1e-6, 'bunched fabric also clears drum wall');
  assert.equal(p.lump.visible, s.values.imbalance > 0);
  assert.equal(p.heater.material.color.getHex(), now.heaterW > 0 ? 0xc14f39 : 0xb4c5b0);
  assert.equal(p.lockLamp.material.color.getHex(), s.doorLocked ? 0xc14f39 : 0x91aa7e);
  near(s.depth, waterDepth(now.water), 'water depth follows conserved free volume');
  if (now.heaterW > 0) t.ok(TUB.y - TUB.radius + s.depth > 236, 'heater and temperature probe are submerged while heating');
  t.add(4);
}

// All control positions, plus each stage boundary and midpoint for edge cases.
const cases = new Map([[JSON.stringify(WASHER_DEFAULTS), WASHER_DEFAULTS]]);
for (const [key, [min, max, step]] of Object.entries(WASHER_DOMAINS)) for (let n = min; n <= max + 1e-9; n += step) {
  const values = {...WASHER_DEFAULTS, [key]: Number(n.toFixed(3))}; cases.set(JSON.stringify(values), values);
}
for (const values of cases.values()) {
  const plan = washerPlan(values), spin = plan.stages.find(s => s.stage === 'Final spin');
  for (const time of [0, 30, 500, spin.start + 12, spin.start + 80, plan.duration - 15, plan.duration]) checkPose(values, time);
}
for (const values of [{}, {temperature: 15, spin: 400, load: 2, rinses: 1, imbalance: 0.6}, {temperature: 60, spin: 1400, load: 7, rinses: 3, imbalance: 0.4}]) {
  const plan = washerPlan(values);
  for (const stage of plan.stages) for (const time of [stage.start, (stage.start + stage.end) / 2]) checkPose(values, time);
}

// Genuine through-holes, probed independently with rays at each cell center.
for (const time of [0, 3500]) {
  model.reset({time}); model.root.updateMatrixWorld(true);
  for (const panel of p.drumPanels) for (let row = 0; row < DRUM_GEOMETRY.rows; row++) {
    const z = (-120 + row * 40) * MM, origin = panel.localToWorld(new THREE.Vector3(0, 0, z));
    const direction = new THREE.Vector3(0, -1, 0).transformDirection(panel.matrixWorld);
    const ray = new THREE.Raycaster(origin, direction, 0, 300 * MM);
    t.ok(ray.intersectObject(panel, false).length === 0, 'hole center has no steel triangle');
    const a = Math.PI / DRUM_GEOMETRY.panels * 0.75;
    ray.set(origin, new THREE.Vector3(Math.sin(a), -Math.cos(a), 0).transformDirection(panel.matrixWorld));
    t.ok(ray.intersectObject(panel, false).length > 0, 'steel remains beside the hole'); holes++;
  }
}
// Loading, drawer and control-panel openings are actual holes in the front.
model.reset(); model.root.updateMatrixWorld(true);
for (const [x, y] of [[0, 450], [-192, 780], [120, 790]]) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x * MM, y * MM, 1000 * MM), new THREE.Vector3(0, 0, -1));
  t.ok(ray.intersectObject(p.front, false).length === 0, 'front opening contains no opaque panel');
}
const solidFront = new THREE.Raycaster(new THREE.Vector3(275 * MM, 600 * MM, 1000 * MM), new THREE.Vector3(0, 0, -1));
t.ok(solidFront.intersectObject(p.front, false).length > 0, 'front still has steel outside its openings');
for (const wire of [...p.wireMeshes, ...p.hoses.filter(hose => hose.id.includes('cable')).map(hose => hose.mesh)]) {
  wire.geometry.computeBoundingBox(); const bounds = wire.geometry.boundingBox;
  t.ok(bounds.min.x / MM > -290 && bounds.max.x / MM < 290, 'wiring stays inside cabinet side panels');
}
// The element fits within the annular gap, not through the tub wall or drum.
const heaterPositions = p.heater.geometry.attributes.position;
for (let i = 0; i < heaterPositions.count; i++) {
  const radius = Math.hypot(heaterPositions.getX(i) / MM, heaterPositions.getY(i) / MM - TUB.y);
  t.ok(radius > 252 && radius < 270, 'heater fits between drum and tub');
}
// Free-water cross section checked by independent area integration.
for (const liters of [0.5, 5, 10, 12]) {
  const h = waterDepth(liters) / 1000, r = 0.27, n = 100000;
  let area = 0;
  for (let i = 0; i < n; i++) {const y = -r + (i + 0.5) * h / n; area += 2 * Math.sqrt(Math.max(0, r * r - y * y)) * h / n;}
  near(area * 0.4 * 1000, liters, 'water section integrates to given volume', 1e-5);
}
// Ballistic acceleration in steady wash is g, not a scaled-down gravity.
const radius = (250 - clumpRadius(5)) / 1000, path = tumble(50, radius), cycle = path.carry + path.flight, dt = 0.0001, w = 50 * Math.PI / 30;
for (let time = dt; time < cycle - dt; time += dt) {
  const at = x => clumpPlace(0, 50, x * w, 5).map(v => v / 1000), a = at(time - dt), b = at(time), c = at(time + dt);
  if ([a, b, c].every(p => Math.hypot(...p) < radius - 1e-8)) {
    near((c[0] - 2 * b[0] + a[0]) / dt ** 2, 0, 'free fall has zero horizontal acceleration', 1e-5);
    near((c[1] - 2 * b[1] + a[1]) / dt ** 2, -9.81, 'free fall uses full gravitational acceleration', 1e-5);
  }
}
const expected = [
  s => s.clock === 0 && !s.doorLocked,
  s => s.now.inletLps > 0 && s.now.dose > 0,
  s => s.now.stage === 'Heating' && s.now.heaterW > 0,
  s => s.now.stage === 'Washing' && s.now.rpm === 50,
  s => s.now.stage === 'Draining the wash' && s.now.rpm === 0 && s.now.drainLps > 0,
  s => s.now.stage === 'Spinning after the wash' && s.now.rpm === 800 && s.now.moisture < 1.5,
  s => s.now.stage === 'Rinse 1' && s.now.concentration < 60 / s.washWater,
  s => s.complete && s.now.heaterEnergy === 0,
  s => s.complete && s.values.rinses === 1,
  s => s.complete && s.values.rinses === 3,
  s => s.complete && s.values.spin === 400,
  s => s.complete && s.values.spin === 1400,
  s => s.now.stage === 'Final spin' && s.now.amplitude === 0 && s.now.rpm === 1200,
  s => s.now.stage === 'Final spin' && s.now.rpm > 200 && s.now.rpm < 240 && s.now.amplitude > 0.003,
  s => s.held && s.topSpin === 600 && s.now.amplitude > 0.006,
  s => s.now.stage === 'Braking after the final spin' && s.now.rpm > 180 && s.now.rpm < 240 && s.doorLocked,
  s => s.complete && s.now.rpm === 0 && s.now.pumpW === 0 && !s.doorLocked,
];
assert.equal(expected.length, lesson.tryIt.length);
for (const [i, trial] of lesson.tryIt.entries()) {
  assert.deepEqual(trial.values, trial.initialState.settings); model.reset(trial.initialState);
  t.ok(expected[i](model.getState()), `${trial.title}: exact named state`);
  const before = state(); model.animate(0); assert.equal(state(), before, 'initial animation preserves preset');
  for (const action of model.actions) {action.run(); assert.equal(state(), before, 'inspection preserves full experiment state');}
  checkFinite(model.root, t);
}
model.reset(); model.advance(23.75); const once = state(); model.reset(); for (let i = 0; i < 95; i++) model.advance(0.25); assert.equal(state(), once, 'frame subdivision preserves state');
model.advance(1e5); t.ok(model.playback.complete(), 'playback completes'); model.reset(model.replayState()); t.ok(!model.playback.complete() && model.getState().clock === 0, 'replay begins same program');
model.advance(10); model.update({spin: 800}); t.ok(model.getState().clock === 0, 'changed settings start fresh program');
checkRefusals(sampleWasher, WASHER_DOMAINS, t);

for (const [width, height] of [[760, 620], [360, 620]]) {
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.01, 100); camera.position.set(1, 0.5, 4); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
  const before = state(), explosion = createPartExplosion(model, camera, width / height, {width, height}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c => c.id)), new Set(categories));
  t.ok(!explosion.items.some(item => ['charts', 'program-chart', 'shake-chart'].includes(item.id)), 'charts stay outside parts inventory');
  const inverse = camera.quaternion.clone().invert(), projected = item => {
    const bounds = new THREE.Box3();
    for (const x of [item.bounds.min.x, item.bounds.max.x]) for (const y of [item.bounds.min.y, item.bounds.max.y]) for (const z of [item.bounds.min.z, item.bounds.max.z]) bounds.expandByPoint(new THREE.Vector3(x, y, z).add(item.group.position).applyQuaternion(inverse));
    return bounds;
  };
  for (let i = 0; i < explosion.items.length; i++) for (let j = i + 1; j < explosion.items.length; j++) {
    const a = projected(explosion.items[i]), b = projected(explosion.items[j]);
    t.ok(a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.y <= b.min.y || b.max.y <= a.min.y, 'projected separated parts do not overlap');
  }
  explosion.dispose(); assert.equal(state(), before, 'separation preserves physical state');
}
const resources = checkDisposal(model, t);
console.log(`PASS washing-machine model: ${t.count} checks; ${poses} poses; ${holes} through-hole rays; ${lesson.tryIt.length} exact presets; ${model.actions.length} state-preserving inspections; 2 separated layouts; ${resources} resources`);

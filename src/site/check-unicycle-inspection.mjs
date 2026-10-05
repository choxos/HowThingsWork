import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createUnicycleModel, DRAW, M} from './unicycle-model.js';
import {UNICYCLE_DEFAULTS as D, UNICYCLE_DOMAINS, unicyclePlan, RIDER, WHEEL_MASS, GRAVITY} from './unicycle-physics.js';
import {CHART_COLORS} from './unicycle-charts.js';
import {createPartExplosion} from './part-explosion.js';
import {checkDisposal, tally} from './model-check-kit.mjs';

const t = tally(), model = createUnicycleModel(), top = model.topology;
const cases = Object.entries(UNICYCLE_DOMAINS).flatMap(([key, [lo, hi, step]]) => Array.from({length: Math.round((hi - lo) / step) + 1}, (_, i) => ({...D, [key]: Number((lo + i * step).toFixed(5))})));
for (const rider of [0, 1]) for (const lean of [0, 25]) for (const speed of [0, 3]) for (const delay of [0, 400]) for (const seat of [0, 3]) for (const wheel of [0, 3]) for (const crank of [75, 170]) cases.push({rider, lean, speed, delay, seat, wheel, crank});
let contactSamples = 0, minimumNormal = Infinity;
for (const values of cases) {
  const plan = unicyclePlan(values), end = plan.fell === null ? plan.N : Math.floor(plan.fell / plan.dt);
  // Differentiate the stored angular velocity, rather than reuse the model's
  // acceleration function. Vertical Newton balance determines normal force.
  for (let k = 1; k < end; k++) {
    const acceleration = (plan.rate[k + 1] - plan.rate[k - 1]) / (2 * plan.dt);
    const vertical = -plan.body.l * (Math.sin(plan.lean[k]) * acceleration + Math.cos(plan.lean[k]) * plan.rate[k] ** 2);
    const normal = (RIDER.mass + WHEEL_MASS) * GRAVITY + RIDER.mass * vertical;
    t.ok(Number.isFinite(normal) && normal > 0, 'tested run does not require the ground to pull downward');
    minimumNormal = Math.min(minimumNormal, normal); contactSamples++;
  }
}

let drivePoses = 0;
const world = object => model.root.worldToLocal(object.getWorldPosition(new THREE.Vector3())).divideScalar(M);
for (const seat of [0, 1, 2, 3]) for (const wheel of [0, 1, 2, 3]) for (const crank of [75, 125, 170]) for (const time of [0, .19, .625, 2]) {
  model.reset({settings: {...D, seat, wheel, crank, speed: 1.5}, time}); model.root.updateMatrixWorld(true);
  const state = model.getState(), b = state.body, h = b.crankAxle - b.r, theta = state.now.lean * Math.PI / 180;
  const groundPoint = ([x, y, z]) => [x * Math.cos(theta) + y * Math.sin(theta), b.r - x * Math.sin(theta) + y * Math.cos(theta), z];
  const check = (object, expected, label) => world(object).toArray().forEach((v, i) => t.near(v, expected[i], 2e-6, label));
  assert.equal(top.chainMarker.visible, seat > 0);
  for (const ring of top.sprockets) t.near(ring.rotation.z, -state.now.crank, 1e-12, 'both equal sprockets follow the crank relative to the frame');
  if (seat > 0) {
    const R = DRAW.sprocket, arc = Math.PI * R, loop = 2 * h + 2 * arc;
    const s = ((state.now.crank * R) % loop + loop) % loop;
    let point;
    if (s < h) point = [R, h - s];
    else if (s < h + arc) {const a = (s - h) / R; point = [R * Math.cos(a), -R * Math.sin(a)];}
    else if (s < 2 * h + arc) point = [-R, s - h - arc];
    else {const a = (s - 2 * h - arc) / R; point = [-R * Math.cos(a), h + R * Math.sin(a)];}
    check(top.chainMarker, groundPoint([...point, DRAW.chainZ]), 'marked chain link follows the closed path');
    check(top.sprockets[0], groundPoint([0, 0, DRAW.chainZ]), 'lower sprocket is on wheel axle');
    check(top.sprockets[1], groundPoint([0, h, DRAW.chainZ]), 'upper sprocket is on crank axle');
    const data = top.chain.geometry.attributes.position;
    t.near(new THREE.Vector3().fromBufferAttribute(data, 0).distanceTo(new THREE.Vector3().fromBufferAttribute(data, 130)), 0, 1e-6, 'chain loop closes');
  }
  const diameter = top.wheels[wheel].children[0].geometry.parameters;
  t.near(diameter.radius + diameter.tube, b.r * M, 1e-12, 'wheel contact radius stays at true size');
  drivePoses++;
}

let inventories = 0;
for (const seat of [0, 3]) for (const aspect of [.7, 1.3, 2]) {
  model.reset({settings: {...D, seat}, time: .625});
  const camera = new THREE.PerspectiveCamera(40, aspect, .01, 200); camera.position.set(.3, .25, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const owned = new Set(); model.root.traverse(o => {if (o.geometry) owned.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) owned.add(m);});
  let released = 0; const observed = () => released++; for (const r of owned) r.addEventListener('dispose', observed);
  const explosion = createPartExplosion(model, camera, aspect, {width: 600 * aspect, height: 600}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c => c.id)), new Set(['wheel', 'frame', 'cranks']));
  assert.equal(explosion.items.length, 3);
  const inverse = camera.quaternion.clone().invert();
  const projected = explosion.items.map(u => {
    const b = u.bounds.clone().translate(u.group.position), p = new THREE.Box3();
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) p.expandByPoint(new THREE.Vector3(x, y, z).applyQuaternion(inverse));
    return p;
  });
  for (let i = 0; i < projected.length; i++) for (let j = i + 1; j < projected.length; j++) {
    const a = projected[i], b = projected[j];
    t.ok(a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y, 'separated assemblies do not overlap in the viewing plane');
  }
  explosion.dispose(); assert.equal(released, 0, 'inventory borrows resources without disposing the machine');
  for (const r of owned) r.removeEventListener('dispose', observed);
  inventories++;
}

const luminance = hex => {
  const c = [hex >> 16 & 255, hex >> 8 & 255, hex & 255].map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
const background = luminance(0xfbf6e9);
for (const [name, color] of Object.entries(CHART_COLORS)) {
  const ratio = (background + .05) / (luminance(color) + .05);
  t.ok(ratio >= (name === 'guide' ? 3 : 4.5), 'chart lines and labels meet their contrast threshold');
}
const resources = checkDisposal(model, t);
console.log(`PASS unicycle inspection: ${t.count} checks, ${cases.length} contact cases, ${contactSamples} differentiated contact samples, minimum normal ${minimumNormal.toFixed(2)} N, ${drivePoses} drive poses, ${inventories} nonoverlapping inventories, ${resources} resources released exactly once.`);

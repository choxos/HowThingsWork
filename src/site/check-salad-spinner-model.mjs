// Salad spinner: the spin-up held to its own integration, the water to its own
// sum over the salad layer, the drawn gears to their tooth outlines, and every
// number the lesson quotes to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleSpinner, spinnerPlan, waterLeftShare, criticalDrop, SPINNER_DEFAULTS as D, SPINNER_DOMAINS, SPINNER_CONSTANTS as C} from './salad-spinner-physics.js';
import {createSaladSpinnerModel, spinnerDrops} from './salad-spinner-model.js';
import {saladSpinnerLesson as lesson} from './salad-spinner-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals, outlinesCross} from './model-check-kit.mjs';

const t = tally(), TAU = Math.PI * 2, g = 9.81, rpm = W => W * 60 / TAU;

// 1. The spin-up and coast, integrated again with a different method and a finer step.
function reference(values) {
  const v = {...D, ...values}, G = C.ringTeeth / v.sun, mass = v.load / 1000;
  const I = C.basketInertia + mass * (1 + C.waterPerSalad) * (C.saladInner ** 2 + C.basketRadius ** 2) / 2;
  const drag = W => W > 0 ? C.dragStatic + C.dragLinear * W + C.dragQuadratic * W * W : 0;
  const F = v.force * C.crankRadius, target = v.rate * TAU, brake = v.brake ? C.brakeTorque : 0, dt = 5e-5;
  const marks = [0.5, 1, 2, v.crank - 0.02, v.crank + 1, 12, 19.9], at = new Map();
  let time = 0, W = 0, held = null, stopped = null;
  while (time < 20 - 1e-9) {
    if (time < v.crank - 1e-12) {
      if (W / G >= target - 1e-9 && G * drag(G * target) <= F) { W = G * target; held ??= time; }
      else W = Math.min(G * target, W + dt * (F - G * drag(W)) / (G * I));
    } else if (W > 0) {
      W = Math.max(0, W - dt * (drag(W) + brake) / I);
      if (W === 0) stopped ??= time + dt;
    }
    time += dt;
    for (const mark of marks) if (!at.has(mark) && time >= mark - 1e-12) at.set(mark, W);
  }
  return {G, I, held, stopped, at};
}
let references = 0;
for (const sun of [12, 18, 24]) for (const rate of [0.5, 1.25, 3]) for (const force of [2, 20]) for (const crank of [1, 4]) for (const load of [50, 300]) for (const brake of [0, 1]) {
  const values = {sun, rate, force, crank, load, brake}, plan = spinnerPlan(values), ref = reference(values);
  t.near(plan.inertia, ref.I, 1e-15, 'basket inertia');
  assert.equal(plan.heldFrom === null, ref.held === null, `reaches the crank rate or not: ${JSON.stringify(values)}`);
  if (ref.held !== null) t.near(plan.heldFrom, ref.held, 2e-3, 'time to reach the crank rate');
  assert.equal(plan.stoppedAt !== null && plan.stoppedAt <= 20, ref.stopped !== null, `stops within the reference window or not: ${JSON.stringify(values)}`);
  t.ok(plan.stoppedAt !== null, 'every supported configuration eventually stops');
  if (ref.stopped !== null) t.near(plan.stoppedAt, ref.stopped, 5e-3, 'time to stop');
  for (const [mark, W] of ref.at) t.near(sampleSpinner(values, mark).W, W, 0.004 * W + 0.05, `basket speed at ${mark} s`);
  for (const time of [0.3, 1.1, crank - 0.01, crank + 0.7, 9, 19]) {
    const s = sampleSpinner(values, time);
    t.near(s.handWork, s.kinetic + s.dragWork + s.brakeWork, 0.004 * s.handWork + 0.01, 'hand work goes into spin, drag and brake');
    if (time < crank) t.near(s.W, s.G * s.w, 1e-9, 'the basket is geared to the crank while cranking');
  }
  references++;
}

// 2. The water: a finer sum over the salad layer, the film floor, and the drawn drops.
{
  const share = W => {
    const n = 4000, r0 = C.saladInner, r1 = C.basketRadius;
    let sum = 0, weight = 0;
    for (let i = 0; i < n; i++) {
      const r = r0 + (r1 - r0) * (i + 0.5) / n, a = Math.sqrt(3 * C.surfaceTension * C.hysteresis / (Math.PI * C.waterDensity * W * W * r));
      sum += r * Math.min(1, Math.max(0, Math.log(a / C.dropMin) / Math.log(C.dropMax / C.dropMin)));
      weight += r;
    }
    return C.filmShare + (1 - C.filmShare) * sum / weight;
  };
  const drops = spinnerDrops();
  let previous = 1;
  for (let speed = 5; speed <= 150; speed += 2.5) {
    const expected = share(speed), actual = waterLeftShare(speed);
    t.near(actual, expected, 3e-4, `water left at ${speed} rad/s`);
    t.ok(actual <= previous + 1e-12, 'water left never rises with speed');
    previous = actual;
    const staying = drops.filter(drop => drop.release > speed).length / drops.length;
    t.near(staying, (expected - C.filmShare) / (1 - C.filmShare), 0.04, 'drawn drops left match the water left');
  }
  t.near(waterLeftShare(1e4), C.filmShare, 1e-12, 'only the film stays at any speed');
  for (const drop of drops) t.near(criticalDrop(drop.release, drop.r), drop.radius, 1e-12, 'each drop leaves at its critical speed');
}

// 3. The drawing: meshing gears at the drawn angles, the geared basket, drops on tangents, the pool volume.
const m = createSaladSpinnerModel(), p = m.topology, MM = p.MM;
const outline = (points, rotation, cx, cy) => points.map(q => ({x: q.x * Math.cos(rotation) - q.y * Math.sin(rotation) + cx, y: q.x * Math.sin(rotation) + q.y * Math.cos(rotation) + cy}));
// The input post must land on the ring rim, and each fixed pin on the carrier plate.
const supportRadius = Math.hypot(p.crankSupport.position.x, p.crankSupport.position.z) / MM;
t.ok(supportRadius > C.module * 1000 * (C.ringTeeth / 2 + 1.25), 'crank post lands beyond the internal tooth spaces');
t.ok(supportRadius < C.module * 1000 * (C.ringTeeth / 2 + 1.25) + p.GEAR.rim, 'crank post lands inside the ring rim');
p.carrierPlate.geometry.computeBoundingBox();
const plateBounds = p.carrierPlate.geometry.boundingBox;
for (const pin of p.pins) {
  const radius = Math.hypot(pin.position.x, pin.position.z);
  t.ok(radius < plateBounds.max.x && radius > 3.5 * MM, 'planet pin lies on fixed carrier material');
  t.near(pin.position.y - pin.geometry.parameters.height / 2, plateBounds.max.y, 1e-8, 'pin meets carrier plate');
}
let poses = 0, gearTests = 0;
for (const sun of [12, 18, 24]) for (const time of [0, 0.37, 1.3, 2.9, 3.99, 5, 9]) {
  m.reset();
  m.update({sun});
  m.advance(time);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), G = C.ringTeeth / sun, planet = (C.ringTeeth - sun) / 2, phases = p.phases();
  t.near(p.ring.rotation.y, s.crankAngle * p.SLOW, 1e-12, 'ring drawn at the crank angle');
  t.near(p.sun.rotation.y, phases.sun - G * p.ring.rotation.y, 1e-9, 'sun turns the ratio times the ring, the other way');
  p.planetGroups.forEach((group, i) => t.near(group.rotation.y, phases.planets[i] + C.ringTeeth / planet * p.ring.rotation.y, 1e-9, 'planet turns ring over planet teeth, the same way'));
  if (time < D.crank) t.near(p.basket.rotation.y, -G * p.ring.rotation.y, 1e-6, 'basket turns with the sun while cranking');
  const ringPoints = outline(p.ringMesh.geometry.parameters.shapes.holes[0].getPoints(), p.ring.rotation.y, 0, 0);
  const sunPoints = outline(p.sunMesh.geometry.parameters.shapes.getPoints(), p.sun.rotation.y, 0, 0);
  p.planetGroups.forEach((group, i) => {
    const center = {x: group.position.x / MM, y: -group.position.z / MM};
    t.near(Math.hypot(center.x, center.y), C.module * 1000 * (sun + planet) / 2, 1e-9, 'planet pin at the meshing distance');
    const points = outline(p.planetMeshes[i].geometry.parameters.shapes.getPoints(), group.rotation.y, center.x, center.y);
    t.ok(!outlinesCross(points, sunPoints), `planet ${i} clears the sun`);
    t.ok(!outlinesCross(points, ringPoints), `planet ${i} clears the ring`);
    gearTests += 2;
  });
  poses++;
}
{
  // The same outline test catches a planet turned by half a tooth.
  m.reset(); m.root.updateMatrixWorld(true);
  const group = p.planetGroups[0], planet = (C.ringTeeth - D.sun) / 2, center = {x: group.position.x / MM, y: -group.position.z / MM};
  const shifted = outline(p.planetMeshes[0].geometry.parameters.shapes.getPoints(), group.rotation.y + Math.PI / planet, center.x, center.y);
  t.ok(outlinesCross(shifted, outline(p.sunMesh.geometry.parameters.shapes.getPoints(), p.sun.rotation.y, 0, 0)), 'a mis-phased planet would cross the sun');
}
for (const trial of lesson.tryIt) for (const time of [0, 0.6, 1.8, 3.9, 4.3, 7, 15]) {
  m.reset();
  m.update(trial.values);
  m.advance(time);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), drops = p.drops, matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), unit = new THREE.Quaternion();
  let onLeaves = 0;
  drops.forEach((drop, k) => {
    p.dropMesh.getMatrixAt(k, matrix);
    matrix.decompose(position, unit, scale);
    const x = position.x / MM, z = position.z / MM, radius = drop.r * 1000, release = s.releases[k];
    if (!release || release.time > s.elapsed) {
      onLeaves++;
      t.ok(drop.release > s.fastest - 1e-9, 'a drop on the leaves has not yet been spun fast enough');
      const angle = drop.angle + p.basket.rotation.y;
      t.near(Math.hypot(x - radius * Math.cos(angle), z + radius * Math.sin(angle)), 0, 1e-3, 'drop rides with the basket');
    } else {
      t.ok(drop.release <= s.fastest + 1e-9, 'a released drop was spun fast enough');
      const a = drop.angle - release.basketAngle * p.SLOW, px = radius * Math.cos(a), pz = -radius * Math.sin(a);
      if (scale.x > 0) {
        t.near((x - px) * px + (z - pz) * pz, 0, 1e-2 * radius, 'a released drop moves along the tangent, square to its radius');
        t.ok(Math.hypot(x, z) <= p.BOWL.radius + 1e-6, 'a flying drop stays inside the bowl');
      }
    }
  });
  t.near(onLeaves, s.dropsOnLeaves, 0, 'drops counted on the leaves');
  t.near(p.handArrow.userData.length, s.handForce * p.NEWTON, 1e-12, 'hand arrow is the hand force');
  const volume = s.waterOff / C.waterDensity * 1e9;
  if (p.poolMesh.visible) {
    const profile = p.poolMesh.geometry.parameters.points.map(q => ({r: q.x / MM, y: q.y / MM}));
    let area = 0, moment = 0;
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i], b = profile[i + 1], cross = a.r * b.y - b.r * a.y;
      area += cross / 2;
      moment += (a.r + b.r) * cross / 6;
    }
    t.near(TAU * Math.abs(moment), volume, 0.03 * volume + 1, 'pool holds the water thrown off');
  } else t.ok(volume < 50, 'no pool drawn only when almost no water is off');
  t.near(p.leaves.count, Math.round(8 + (trial.values.load - 50) / 250 * 40), 0, 'leaves drawn for the salad load');
  checkFinite(m.root, t);
  poses++;
}

// 4. Every control moves the readings and the drawing.
checkControlsMove(m, () => [p.ring.rotation.y, p.sun.rotation.y, p.basket.rotation.y, p.handArrow.userData.length, p.leaves.count, m.getState().dropsOnLeaves, m.getState().poolRadius, p.marker.position.toArray(), p.sunMesh.geometry.parameters.shapes.getPoints().length], model => model.advance(6), t);

// 5. Every number the lesson quotes.
const run = values => { m.reset(); m.update(values); m.advance(C.duration); return m.getState(); };
const standard = run(D), top = s => rpm(s.topSpeed), topPull = s => s.topSpeed ** 2 * C.basketRadius / g, grams = mass => mass * 1000;
const claims = {
  'Spin the default salad': s => ({'1.72': s.heldFrom, '600': top(s), '0.22': criticalDrop(s.topSpeed, C.basketRadius) * 1000, '3.4': grams(s.waterLeft), '30': grams(s.water), '8.1': s.stoppedAt}),
  'Use the smallest sun': s => (assert.equal(s.heldFrom, null), {'900': rpm(s.G * s.target), '10': s.values.force, '4': s.values.crank, '886': top(s), '1.5': grams(s.waterLeft), '14.23': s.handWork, '7.33': standard.handWork}),
  'Use the largest sun': s => ({'450': top(s), '0.95': s.heldFrom, '25': topPull(s), '6.4': grams(s.waterLeft)}),
  'Crank slowly': s => ({'240': top(s), '7': topPull(s), '0.54': criticalDrop(s.topSpeed, C.basketRadius) * 1000, '13.1': grams(s.waterLeft)}),
  'Halve the speed': s => (t.near(topPull(standard) / topPull(s), 4, 1e-9, 'twice the speed, four times the pull'), {'300': top(s), '11': topPull(s), '600': top(standard), '44': topPull(standard), '10.7': grams(s.waterLeft), '3.4': grams(standard.waterLeft)}),
  'Crank weakly': s => (assert.equal(s.heldFrom, null), {'243': top(s), '12.9': grams(s.waterLeft)}),
  'Let go too soon': s => (assert.equal(s.heldFrom, null), {'353': top(s), '9.0': grams(s.waterLeft)}),
  'Double the salad': s => (t.near(s.waterShare, standard.waterShare, 1e-12, 'same share left'), {'60': grams(s.water), '600': top(s), '2.62': s.heldFrom, '1.72': standard.heldFrom, '11': s.waterShare * 100, '6.8': grams(s.waterLeft)}),
  'Let it coast': s => (assert.ok(s.stoppedAt > 20), {'265': sampleSpinner(s.values, 20).rpm}),
  'Spin as fast as you can': s => (t.near(s.waterShare, C.filmShare, 1e-12, 'only the film'), {'1,080': top(s), '143': topPull(s), '1.5': grams(s.waterLeft), '22.91': s.handWork}),
  'Feel the hand force': s => ({'10': sampleSpinner(s.values, 0.5).handForce, '600': top(s), '0.74': sampleSpinner(s.values, 3).handForce}),
};
checkTrialNumbers(lesson, claims, run, t);
{
  const plan = spinnerPlan({}), half = spinnerPlan({rate: 1.25}), text = lesson.deeper.map(section => section.body).join(' ');
  const fixedText = (value, digits) => value.toFixed(digits);
  checkQuotedText(text, {
    '72 over 18 is four': `${C.ringTeeth} over ${D.sun} is ${['', '', '', 'three', 'four', '', 'six'][C.ringTeeth / D.sun]}`,
    '72 plus 18 is 90': `${C.ringTeeth} plus ${D.sun} is ${C.ringTeeth + D.sun}`,
    '2.93 g·m²': `${fixedText(plan.inertia * 1000, 2)} g·m²`,
    '46.9 g·m²': `${fixedText(plan.reflectedInertia * 1000, 1)} g·m²`,
    '5.78 J': `${fixedText(0.5 * plan.inertia * plan.topSpeed ** 2, 2)} J`,
    '0.22 mm': `${fixedText(criticalDrop(plan.topSpeed, C.basketRadius) * 1000, 2)} mm`,
    '11 g': `${fixedText(half.topSpeed ** 2 * C.basketRadius / g, 0)} g`,
    '44 g': `${fixedText(plan.topSpeed ** 2 * C.basketRadius / g, 0)} g`,
    '5.00 J': `${fixedText(sampleSpinner({}, C.duration).brakeWork, 2)} J`,
  }, t);
}

// 6. Playback, inspection points and the result.
m.reset();
assert.equal(m.playback.complete(), false);
assert.equal(m.resultPart.available(), false);
m.advance(spinnerPlan({}).stoppedAt - 0.01);
assert.equal(m.playback.complete(), false);
m.advance(0.02);
assert.equal(m.playback.complete(), true);
assert.equal(m.resultPart.available(), true);
m.reset(); m.playback.step(); t.near(m.getState().elapsed, 0.05, 1e-12, 'a step is a twentieth of a second');
const times = [0.8, D.crank - 0.05, D.crank + 0.5, spinnerPlan({}).stoppedAt, 20, 0, 0, 0, 0, 0];
m.actions.forEach((action, i) => { m.reset(); action.run(); t.near(m.getState().elapsed, times[i], 1e-9, action.label); });
m.reset(); m.update({brake: 0}); m.actions[3].run(); t.near(m.getState().W, 0, 1e-12, 'at rest really stops the coasting basket');
assert.equal(m.getState().mode, 'stopped');
assert.ok(m.getState().elapsed > 20);
assert.equal(m.playback.complete(), true);

// Roller contact comes from the rendered ramp outlines, not a copied clutch flag.
for(const sun of [12,18,24])for(const brake of [0,1])for(const time of [0.5,3.99,4.1,20]){
  m.reset();m.update({sun,brake});m.advance(time);m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);
  const state=m.getState(),ramps=p.cam.children.filter(o=>o.geometry?.parameters.shapes);
  for(const [i,{object}] of p.clutchRollers.entries()){
    const pts=ramps[i].geometry.parameters.shapes.getPoints(),a=pts[1],b=pts[2],x=object.position.x/MM,y=-object.position.z/MM;
    const gap=Math.abs((b.x-a.x)*(a.y-y)-(b.y-a.y)*(a.x-x))/Math.hypot(b.x-a.x,b.y-a.y);
    t.near(Math.hypot(x,y)+p.CLUTCH.roller,p.CLUTCH.inner,1e-12,'roller touches the basket race');
    if(time<4)t.near(gap,p.CLUTCH.roller,1e-12,'driving roller also touches its ramp');
    else t.ok(gap>p.CLUTCH.roller+.6,'freewheeling roller clears the shaft ramp');
    for(const guide of p.cam.children.filter(o=>o.geometry?.parameters.radiusTop===.5*MM))
      t.ok(Math.hypot(object.position.x-guide.position.x,object.position.z-guide.position.z)>(p.CLUTCH.roller+.5)*MM,'roller clears retaining pins');
  }
  t.near(p.clutchRace.rotation.y,p.basket.rotation.y,1e-12,'clutch race stays attached to the basket');
  t.near(p.clutchDrive.rotation.y,-state.G*p.ring.rotation.y,1e-12,'clutch ramps follow the driven shaft');
  const hoop=p.basket.children.find(o=>o.geometry?.type==='TorusGeometry'&&Math.abs(o.position.y-p.BASKET.top*MM)<1e-10);
  const padBottom=new THREE.Box3().setFromObject(p.brakePad).min.y,hoopTop=new THREE.Box3().setFromObject(hoop).max.y;
  t.near(padBottom-hoopTop,(brake&&time>=4?0:p.BRAKE.travel*MM),1e-7,'brake pad contacts the basket only when pressed');
  const springEnd=p.brakeSpring.geometry.parameters.path.getPoint(1).y;
  t.near(springEnd,p.BRAKE.buttonBottom*MM+p.brakePlunger.position.y,1e-12,'return spring meets the moving button');
}
m.reset();m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);
const pivotTop=new THREE.Box3().setFromObject(p.pivot).max.y;
const basketFloor=p.basket.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===p.BASKET.radius*MM);
t.near(pivotTop,new THREE.Box3().setFromObject(basketFloor).min.y,1e-7,'bottom pivot supports the basket floor');
const carrierUnderside=new THREE.Box3().setFromObject(p.carrierPlate).min.y;
for(const post of p.bearingPosts){const bounds=new THREE.Box3().setFromObject(post);t.near(bounds.max.y,carrierUnderside,1e-7,'bearing post joins the fixed lid');t.near(bounds.min.y,115*MM,1e-7,'bearing post joins its collar');}
const chartLabels=p.captions.map(o=>o.userData.labelText);
for(const label of ['Water remaining (%)','Basket speed (rpm)','0','600','1200','50','100','Dot: fastest speed reached','Line: speed now'])assert.ok(chartLabels.includes(label),label);
assert.equal(p.chart.userData.explosionExcluded,true,'teaching chart is not a physical inventory part');
m.reset();m.advance(5);const beforeInspect=m.getState();
for(const action of m.actions.slice(5)){
  action.run();const after=m.getState();
  for(const key of ['elapsed','W','handWork','waterLeft','brakeWork'])t.near(after[key],beforeInspect[key],0,'inspection preserves '+key);
}
let texturesDisposed=0;for(const texture of p.captionTextures)texture.addEventListener('dispose',()=>texturesDisposed++);

checkRefusals(sampleSpinner, SPINNER_DOMAINS, t);
const resources = checkDisposal(m, t);
assert.equal(texturesDisposed,p.captionTextures.length,'all chart textures disposed once');
console.log(`PASS salad spinner model: ${t.count} checks, ${references} reference integrations, ${gearTests} gear outline tests, ${poses} poses, ${lesson.tryIt.length} trials, ${resources} resources`);

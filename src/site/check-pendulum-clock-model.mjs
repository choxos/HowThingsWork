// Independent clock laws, actual gear profiles, connected geometry, and lesson setups.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleClock, clockPlan, swing, circularError, weightPower, DESIGN_PERIOD, RODS, CARE, CLOCK, CLOCK_DOMAINS} from './pendulum-clock-physics.js';
import {createPendulumClockModel, chartPoint, weightHeight, rateChange, escapeWheelShape} from './pendulum-clock-model.js';
import {pendulumClockLesson} from './pendulum-clock-lessons.js';
import {tally, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {ESCAPEMENT} from './clock-escapement.js';

const t = tally(), g = 9.81, TAU = Math.PI * 2;

// 1. The period, three ways.
const agm = (a, b) => { for (let i = 0; i < 40; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)]; return a; };
const integrated = (L, theta0) => {
  // Release from theta0 and time the quarter swing to the bottom, in small RK4 steps with a final interpolation.
  const f = ([th, w]) => [w, -g / L * Math.sin(th)];
  let state = [theta0, 0], time = 0;
  const dt = 1e-4;
  while (true) {
    const k1 = f(state), k2 = f(state.map((v, i) => v + dt / 2 * k1[i])), k3 = f(state.map((v, i) => v + dt / 2 * k2[i])), k4 = f(state.map((v, i) => v + dt * k3[i]));
    const next = state.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    if (next[0] <= 0) return 4 * (time + dt * state[0] / (state[0] - next[0]));
    state = next; time += dt;
  }
};
for (const L of [0.25, 0.9938, 1.0]) for (const degrees of [0.5, 2.34, 3.02, 10]) {
  const theta = degrees * Math.PI / 180, small = TAU * Math.sqrt(L / g), exact = small / agm(1, Math.cos(theta / 2));
  t.near(small * circularError(theta), exact, (degrees <= 3.1 ? 1e-9 : 1e-6) * exact, 'series circular error against the elliptic integral');
  if (degrees === 2.34 || degrees === 10) t.near(integrated(L, theta), exact, 2e-7 * exact, 'the swing integrated step by step takes the elliptic period');
}

// The tooth counts fix time and work. Neither may be calibrated to the result.
assert.equal(DESIGN_PERIOD, 2);
let physicsCases = 0;
for (const rod of [0, 1, 2]) for (const temperature of [10, 20, 30]) for (const weight of [1, 2, 2.5, 3, 5]) for (const care of [0, 1]) for (const length of [990, 993.8, 1000]) {
  const values = {length, rod, temperature, weight, care}, s = swing(values), plan = clockPlan(values);
  const L = length / 1000 * (1 + RODS[rod].expansion * (temperature - 20));
  const drumRadius = .15 / (TAU * 3), drop = drumRadius * (Math.PI / 30) / (8 * 6 * 10);
  const energy = 1.5 * g * L * (1 - Math.cos(s.theta)), work = weight * g * drop, delivered = .25 * work;
  t.near(s.L, L, 1e-15, 'thermal suspension-to-bob length');
  t.near(TAU * energy / CARE[care].Q, 2 * delivered, 1e-12, 'potential energy and loss equal two impulses');
  t.near(s.period, TAU * Math.sqrt(L / g) * circularError(s.theta), 1e-15, 'settled finite-amplitude period');
  assert.equal(plan.running, s.theta > 1.12 * Math.PI / 180 && s.theta <= 3.2 * Math.PI / 180);
  t.near(plan.beatEnergy, plan.running ? delivered : 0, 1e-15, 'work per beat comes from gear-driven descent');
  t.near(weightPower(values), plan.running ? 2 * work / s.period : 0, 1e-15, 'weight power depends on actual beat frequency');
  t.near(plan.power, plan.running ? 2 * delivered / s.period : 0, 1e-15, 'delivered power');
  if (plan.running) {
    t.near(plan.rate, 86400 * (2 / s.period - 1), 1e-9, 'fixed gears count two displayed seconds per period');
    const after = sampleClock(values, s.period);
    t.near(after.clockSeconds, 2, 1e-12, 'one cycle advances two displayed seconds');
    t.near(after.descent, 2 * drop, 1e-15, 'two beats unwind the actual drum');
  } else {
    assert.equal(plan.rate, null); assert.equal(plan.week, null);
    const start = sampleClock(values, 0), later = sampleClock(values, 600);
    for (const key of ['angle', 'escape', 'descent', 'clockSeconds']) assert.equal(start[key], later[key], 'static blocked state');
  }
  physicsCases++;
}
t.near(clockPlan({}).rate, -2.0201043766, 1e-8, 'default error remains measurable');
t.near(clockPlan({length: 993.75}).rate, .1529489545, 1e-8, 'fine rating adjustment');
for (const rod of [0, 1, 2]) {
  const slope = (clockPlan({rod, temperature: 21}).rate - clockPlan({rod, temperature: 19}).rate) / 2;
  t.near(slope, -86400 * RODS[rod].expansion / 2, .01 * 86400 * RODS[rod].expansion / 2, 'thermal slope against linearized pendulum law');
}
const outline = escapeWheelShape().getPoints(1);
t.near(outline.length, 91, 1, '30 three-corner teeth');
t.near(Math.max(...outline.map(p => Math.hypot(p.x, p.y))), 28, 1e-9, 'escape tips at 28 mm');

const m = createPendulumClockModel(), p = m.topology, MM = p.MM;
const world = object => object.getWorldPosition(new THREE.Vector3());
const bounds = object => new THREE.Box3().setFromObject(object);
const cordLength = () => { const a = p.cord.geometry.attributes.position; let sum = 0; for (let i = 1; i < a.count; i++) sum += new THREE.Vector3().fromBufferAttribute(a, i).distanceTo(new THREE.Vector3().fromBufferAttribute(a, i - 1)); return sum / MM / 1000; };
let drawnCases = 0;
for (const values of [{}, {length: 990, rod: 1, temperature: 30}, {length: 1000, rod: 2, temperature: 10}, {weight: 5}, {care: 1, weight: 2}, {care: 1, weight: 2.5}]) {
  m.reset(); m.update(values); const cordAtStart = cordLength();
  for (const time of [0, .1, .5, 1.2, 33.3, 60]) {
    m.reset(); m.update(values); m.advance(time); m.root.updateMatrixWorld(true);
    const s = m.getState(), length = s.L * 1000;
    t.near(p.pendulum.rotation.z, s.angle, 1e-15, 'pendulum follows phase');
    t.near(p.anchor.rotation.z, s.angle, 1e-15, 'crutch shares anchor and pendulum angle');
    t.near(p.regulator.position.y / MM, -length, 1e-9, 'bob and nut use expanded effective length');
    t.near(p.rod.scale.y / MM, 1075 * length / s.values.length, 1e-9, 'fixed physical rod expands independently of nut adjustment');
    t.near(p.nut.position.y / MM + 5, -60, 1e-9, 'nut touches bottom of 60 mm radius bob');
    t.near(p.thread.scale.y, length / s.values.length, 1e-12, 'thread expands with rod');
    for (const [key, object] of [['barrel', p.barrel], ['center', p.center], ['third', p.third], ['escape', p.escapePinion], ['cannon', p.cannon], ['motion', p.motion], ['hour', p.hourWheel]]) t.near(object.rotation.z, s.gears[key], 1e-15, key + ' follows train');
    t.near(p.escapeWheel.rotation.z, -s.escape, 1e-15, 'escape wheel and pinion share angle');
    for (const [a, b] of [['barrel','centerPinion'], ['center','thirdPinion'], ['third','escapePinion'], ['cannon','motion'], ['motionPinion','hour']]) t.near(p.gears[a].userData.teeth * p.gears[a].parent.rotation.z + p.gears[b].userData.teeth * p.gears[b].parent.rotation.z, 0, 1e-10, 'opposing tooth travel: ' + a);
    t.near(p.secondsHand.rotation.z, -Math.PI - s.escape, 1e-12, 'seconds hand starts at 30 seconds');
    t.near(p.minuteHand.rotation.z, -TAU * (p.START + s.clockSeconds) / 3600, 1e-12, 'minute hand follows displayed time');
    t.near(p.hourHand.rotation.z, -TAU * (p.START + s.clockSeconds) / 43200, 1e-12, 'hour hand follows displayed time');
    const h = s.values.weight / (11340 * Math.PI * .025 ** 2) * 1000;
    t.near(p.lead.scale.y / MM, h, 1e-9, 'lead volume matches mass');
    t.near(weightHeight(s.values.weight), h, 1e-9, 'weight helper');
    t.near(p.lead.position.y / MM + h / 2, -460 - s.descent * 1000, 1e-9, 'weight falls by drum travel');
    t.near(cordLength(), cordAtStart, 2e-7, 'cord unwrap plus free tail conserves drawn length within 0.2 micrometer');
    const cord = p.cord.geometry.attributes.position;
    const first = new THREE.Vector3().fromBufferAttribute(cord, 0);
    t.near(first.x / MM, -45 + CLOCK.drumRadius * 1000 * Math.cos(s.gears.barrel), 2e-6, 'anchored cord end rotates with drum');
    assert.ok(cord.getY(1) > cord.getY(0), 'cord wraps over drum');
    t.near(cord.getX(49), cord.getX(50), 1e-8, 'vertical tangent at free tail');
    for (const [rod, line] of p.lines.entries()) {
      assert.equal(line.visible, s.running);
      if (s.running) for (const i of [0, 7, 20]) {
        const delta = clockPlan({...s.values, rod, temperature: 10 + i}).rate - clockPlan({...s.values, rod, temperature: 20}).rate;
        t.near(line.geometry.attributes.position.getY(i), chartPoint(10 + i, delta)[1], 1e-6, 'graph subtracts same rod at 20 degrees');
      }
    }
    assert.equal(p.marker.visible, s.running);
    if (s.running) t.near(p.marker.position.y, chartPoint(s.values.temperature, rateChange(s.values, s.values.rod, s.values.temperature))[1], 1e-12, 'marker on selected curve');
    assert.equal(m.playback.blocked(), !s.running);
    checkFinite(m.root, t); drawnCases++;
  }
}

m.reset(); m.root.updateMatrixWorld(true);
for (let i = 0; i < 4; i++) {
  const shaft = bounds(p.shafts[i]), bearing = bounds(p.bearings[i]);
  t.ok(shaft.min.z < bearing.min.z && shaft.max.z > bearing.max.z, 'shaft crosses rear bearing');
  assert.equal(p.bearings[i].geometry.parameters.shapes.holes.length, 1, 'bearing has a bore');
}
assert.equal(p.sleeve.geometry.parameters.shapes.holes.length, 1, 'hour sleeve clears central arbor');
t.near(p.sleeve.geometry.parameters.shapes.holes[0].getPoints(32)[0].length(), 1.6, 1e-12, 'sleeve bore exceeds 1.4 mm minute shaft');
t.near(world(p.anchor).x, world(p.pendulum).x, 1e-12, 'shared swing axis x');
t.near(world(p.anchor).y, world(p.pendulum).y, 1e-12, 'shared swing axis y');
const shaftBox = bounds(p.anchorShaft);t.ok(shaftBox.min.z <= world(p.pendulum).z && shaftBox.max.z >= world(p.pendulum).z, 'anchor shaft reaches rear crutch plane');
for (const fork of p.fork) t.near(Math.abs(fork.position.x / MM) - .5, 2, 1e-12, 'fork has zero-play tangency to 2 mm rod');
const version = p.lines[0].geometry.attributes.position.version;
m.advance(.1);assert.equal(p.lines[0].geometry.attributes.position.version, version, 'static chart is not regenerated each frame');
const held = m.getState(); const rotations = [p.barrel, p.center, p.third, p.escapeWheel, p.minuteHand, p.hourHand].map(v => v.rotation.z);
m.advance(.02);assert.equal(m.getState().stage, 'Locked');assert.notEqual(m.getState().angle, held.angle);
assert.deepEqual([p.barrel, p.center, p.third, p.escapeWheel, p.minuteHand, p.hourHand].map(v => v.rotation.z), rotations, 'all gear and hand motion stops during lock');

// Check the five meshes over a whole tooth engagement using their actual outlines.
function inside(point, polygon) { let yes = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) yes = !yes; } return yes; }
function nearEdges(poly, center, radius) {
  return poly.map((a, i) => [a, poly[(i + 1) % poly.length]]).filter(([a, b]) => {
    const v = b.clone().sub(a), u = Math.max(0, Math.min(1, center.clone().sub(a).dot(v) / (v.lengthSq() || 1)));
    return a.clone().addScaledVector(v, u).distanceTo(center) <= radius;
  });
}
function crosses(a, b, c, d) {
  if (Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y)) return false;
  const ab=b.clone().sub(a),cd=d.clone().sub(c),x=ab.cross(c.clone().sub(a)),y=ab.cross(d.clone().sub(a)),u=cd.cross(a.clone().sub(c)),v=cd.cross(b.clone().sub(c));
  return x*y<0&&u*v<0&&Math.min(Math.abs(x),Math.abs(y))>1e-8*ab.length()&&Math.min(Math.abs(u),Math.abs(v))>1e-8*cd.length();
}
const pairs = [['barrel', 'centerPinion'], ['center', 'thirdPinion'], ['third', 'escapePinion'], ['cannon', 'motion'], ['motionPinion', 'hour']];
let meshPoses = 0;
for (const [aName, bName] of pairs) {
  const a = p.gears[aName], b = p.gears[bName], na = a.userData.teeth, nb = b.userData.teeth, module = a.userData.module;
  const ca = a.parent.position, cb = b.parent.position, ra = na * module / 2, rb = nb * module / 2;
  t.near(Math.hypot(ca.x - cb.x, ca.y - cb.y) / MM, ra + rb, 1e-9, 'pitch circles meet: ' + aName);
  t.near(a.position.z, b.position.z, 1e-15, 'mesh shares depth');
  const shapeA = a.geometry.parameters.shapes.getPoints(1), shapeB = b.geometry.parameters.shapes.getPoints(1);
  const points = (mesh, shape, rotation) => shape.map(v => new THREE.Vector2(v.x * Math.cos(rotation) - v.y * Math.sin(rotation) + mesh.parent.position.x / MM, v.x * Math.sin(rotation) + v.y * Math.cos(rotation) + mesh.parent.position.y / MM));
  for (let i = 0; i <= 100; i++) {
    const turn = i / 100 * TAU / na, aa = points(a, shapeA, a.rotation.z + turn), bb = points(b, shapeB, b.rotation.z - turn * na / nb);
    const centerA = new THREE.Vector2(ca.x / MM, ca.y / MM), centerB = new THREE.Vector2(cb.x / MM, cb.y / MM);
    const nearA = aa.filter(v => v.distanceTo(centerB) < rb + module), nearB = bb.filter(v => v.distanceTo(centerA) < ra + module);
    assert.ok(nearA.every(v => !inside(v, bb)) && nearB.every(v => !inside(v, aa)), 'Tooth bodies overlap: ' + aName + ' at ' + i);
    const edgesA=nearEdges(aa,centerB,rb+module),edgesB=nearEdges(bb,centerA,ra+module);
    assert.ok(edgesA.every(([a,b])=>edgesB.every(([c,d])=>!crosses(a,b,c,d))), 'Tooth edges cross: '+aName+' at '+i);
    meshPoses++;
  }
}

checkControlsMove(m, () => [p.rod.material.color.getHex(), p.pendulum.rotation.z, p.regulator.position.y, p.lead.scale.y, p.marker.visible, p.marker.position.y, p.minuteHand.rotation.z], model => model.advance(.37), t);
const expected = [
  {rate:-2.02}, {stage:'Locked',contactSide:0}, {stage:'Impulse',contactSide:0}, {stage:'Impulse',contactSide:1},
  {part:'train'}, {part:'motion-work'}, {rate:41.47}, {rate:.15}, {rate:-6.99}, {rate:-10.23}, {rate:-2.54},
  {rate:3.99,amplitude:1.35}, {rate:-8.03,amplitude:3.02}, {rate:4.49,amplitude:1.23}, {running:false,amplitude:1.10}, {running:false,amplitude:.78},
];
assert.equal(pendulumClockLesson.tryIt.length, expected.length);
for (const [i, trial] of pendulumClockLesson.tryIt.entries()) {
  m.reset(trial.initialState); m.update(trial.values); const state = m.getState(), e = expected[i];
  assert.ok(m.parts.some(p => p.id === trial.part), trial.title + ': real focus part');
  assert.deepEqual(state.values, trial.values, trial.title + ': complete independent setup');
  for (const key of ['stage', 'contactSide', 'running']) if (key in e) assert.equal(state[key], e[key], trial.title);
  if ('rate' in e) t.near(state.rate, e.rate, .005, trial.title + ': displayed rate');
  if ('amplitude' in e) t.near(state.theta * 180 / Math.PI, e.amplitude, .005, trial.title + ': amplitude');
  if ('part' in e) assert.equal(trial.part, e.part);
}
for (const item of [...m.actions, ...pendulumClockLesson.tryIt]) assert.ok(['iso','front','side','back','top','bottom'].includes(item.view), 'Supported camera view: ' + (item.label || item.title));
for (const action of m.actions) { m.reset(); action.run(); checkFinite(m.root, t); assert.ok(m.parts.some(p => p.id === action.part)); }
m.reset(); m.advance(60);assert.ok(m.playback.complete());m.reset();assert.equal(m.getState().time,0);assert.ok(!m.playback.complete());
m.reset();m.update({care:1,weight:2});const stopped=m.getState();m.advance(60);assert.equal(m.getState().escape,stopped.escape);assert.equal(m.getState().time,0);
for(const phase of [-1,2,NaN,Infinity])assert.throws(()=>m.reset({phase}),RangeError);
checkRefusals(sampleClock, CLOCK_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(JSON.stringify({passed:true, assertions:t.count, physicsCases, drawnCases, meshPoses, trials:expected.length, disposedResources:resources, escapementBodySweep:'run check-clock-escapement.mjs separately'}));

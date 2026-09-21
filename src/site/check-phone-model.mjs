// Checks the smartphone model and its accelerometer and vibration motor
// lessons against their sources typed in again and their physics worked out by
// other routes: the touch controller built again from its own crossings and
// swept for its worst error, what each axis reads from a rotation built another way, a
// proof mass's sag integrated from rest and its steady swing at the buzz, the
// differential capacitor's output from a charge balance, the air's thermal
// jostling held to equipartition, each filter's response integrated in time
// and its noise band found by quadrature, the weight's pull from its path
// differentiated and its half disk integrated, the phone's shaking from its
// center of mass, and every drawn fingertip, crossing, mass, spring, curve, weight and leader read
// back at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './phone-physics.js';
import * as M from './phone-model.js';
import * as L from './phone-lessons.js';
import {houseComponents} from './house-components.js';
import {studyLessons} from './study-lessons.js';

const t = tally();
const counts = {steps: 0, quadrature: 0, poses: 0, points: 0, numbers: 0, touch: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3), f4 = value => fixed(value, 4);
const deg = radians => radians * 180 / Math.PI;
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;

/** One fourth order Runge-Kutta step for a state vector. */
function rk4(state, time, dt, derivative) {
  const k1 = derivative(time, state);
  const k2 = derivative(time + dt / 2, state.map((value, i) => value + dt / 2 * k1[i]));
  const k3 = derivative(time + dt / 2, state.map((value, i) => value + dt / 2 * k2[i]));
  const k4 = derivative(time + dt, state.map((value, i) => value + dt * k3[i]));
  counts.steps++;
  return state.map((value, i) => value + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** Simpson's rule over log frequency from lo to hi, n even. */
function logSimpson(fn, lo, hi, n) {
  const ds = Math.log(hi / lo) / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const f = lo * Math.exp(i * ds), weight = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    sum += weight * fn(f) * f;
    counts.quadrature++;
  }
  return sum * ds / 3;
}

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and what follows from them.
// ---------------------------------------------------------------------------

const SRC = {
  g: 9.80665, kB: 1.380649e-23, e0: 8.8541878188e-12,
  accelerometerPage: {rest: 1},
  adxl: {range: 3, sensitivity: [270, 300, 330], zero: [1.35, 1.5, 1.65], supply: 3, noise: 150, noiseZ: 300, bandwidth: 1600, bandwidthZ: 550, resonance: 5.5, resistor: 32, factor: 1.6, smallest: 0.0047, tested: 0.1, table: [[1, 4.7], [10, 0.47], [50, 0.1], [100, 0.05], [200, 0.027], [500, 0.01]], size: [4, 4, 1.45], shock: 10000, current: 350, selfTest: 325, temperature: 25},
  coin: {model: '10B27.3018', diameter: 10, length: 2.7, rated: 3, use: [2.5, 3.8], start: 2.3, speed: 11000, tolerance: 3000, current: 75, mass: 1.2, amplitude: 1, block: 75, noise: 50},
  other: {model: 'B1034.FL45-00-015', diameter: 10, length: 3.4, rated: 3, speed: 13000, tolerance: 3000, current: 60, start: 2, mass: 0.9},
  pmd: {mass: 100, erm: {amplitude: [0.25, 150], hz: [30, 500], rpm: [1800, 30000]}, lra: {amplitude: [0.75, 2], hz: [150, 205]}, tolerance: 5, yAxis: [175, 235], start: 5, stop: 275, tungstenCarbide: 15.63},
  touch: {columns: 12, rows: 16, capacitors: 192, finger: [5, 10], typical: 8, pitch: [4, 6, 10], ideal: 5, apart: 2, body: [100, 200]},
};
const A = P.ADXL335, S = SRC.adxl, K = SRC.coin;

t.ok(P.GRAVITY === SRC.g && P.BOLTZMANN === SRC.kB, 'standard gravity and the exact Boltzmann constant');
t.ok(A.range === S.range && A.supply === S.supply && A.bandwidth === S.bandwidth && A.bandwidthZ === S.bandwidthZ && A.shock === S.shock && A.selfTest === S.selfTest && A.temperature === S.temperature && A.noiseFactor === S.factor, 'the ADXL335’s range, supply, bandwidths, shock survival, self test, temperature and noise factor');
assert.deepEqual(A.sensitivity.map(value => Math.round(value * 1000)), S.sensitivity);
assert.deepEqual([...A.zero], S.zero);
t.near(A.noise, S.noise * 1e-6, 1e-18, '150 μg/√Hz on x and y');
t.near(A.noiseZ, S.noiseZ * 1e-6, 1e-18, '300 μg/√Hz on z');
t.ok(A.resonance === S.resonance * 1000 && A.resistor === S.resistor * 1000, 'a sensor resonant frequency of 5.5 kHz and a 32 kΩ filter resistor');
assert.deepEqual([...A.size], S.size);
t.near(A.current, S.current * 1e-6, 1e-15, '350 μA at 3 V');
t.near(A.smallest, S.smallest * 1e-6, 1e-18, 'the smallest capacitor the sheet recommends');
t.near(A.tested, S.tested * 1e-6, 1e-18, 'the capacitor its specifications are measured with');
for (const [bandwidth, microfarads] of S.table) {
  const cutoff = P.cutoffOf(microfarads * 1e-6);
  t.near(cutoff, 5 / microfarads, relative(cutoff, 0.006), `${microfarads} μF: 1/(2π × 32 kΩ × C) is the sheet’s simpler 5 μF/C`);
  t.ok(Math.abs(cutoff - bandwidth) / bandwidth < 0.08, `${microfarads} μF gives about ${bandwidth} Hz, as the sheet’s table rounds it`);
}
assert.deepEqual([...P.CAPACITORS], [S.smallest, S.table.find(row => row[0] === 500)[1], S.table.find(row => row[0] === 50)[1], S.table[0][1]]);
t.ok(P.CAPACITORS[2] === S.tested && P.CAPACITORS[3] === Math.max(...S.table.map(row => row[1])), 'the test capacitor, and the largest in the table');
assert.deepEqual(P.FILTER_OPTIONS.map(option => [option.value, option.label]), [[0.0047, '0.0047 μF, 1,058 Hz'], [0.01, '0.01 μF, 497 Hz'], [0.1, '0.1 μF, 50 Hz'], [4.7, '4.7 μF, 1 Hz']]);

const C = P.COIN;
t.ok(C.model === K.model && C.diameter === K.diameter && C.length === K.length && C.rated === K.rated && C.start === K.start && C.speed === K.speed && C.tolerance === K.tolerance && C.mass === K.mass && C.amplitude === K.amplitude && C.block === K.block && C.noise === K.noise, 'the coin motor as its sheet gives it');
assert.deepEqual([...C.use], K.use);
t.near(C.current, K.current / 1000, 1e-15, '75 mA or less');
const O = P.OTHER_COIN, Q = SRC.other;
t.ok(O.model === Q.model && O.diameter === Q.diameter && O.length === Q.length && O.rated === Q.rated && O.speed === Q.speed && O.tolerance === Q.tolerance && O.start === Q.start && O.mass === Q.mass, 'SparkFun’s coin motor as its sheet gives it');
t.near(O.current, Q.current / 1000, 1e-15, '60 mA');
assert.deepEqual(JSON.parse(JSON.stringify(P.PMD)), {mass: 100, erm: {amplitude: [0.25, 150], hz: [30, 500], rpm: [1800, 30000]}, lra: {amplitude: [0.75, 2], hz: [150, 205]}, yAxis: [175, 235], start: 5, stop: 275, tungstenCarbide: 15.63});
t.ok(SRC.pmd.erm.rpm[0] === SRC.pmd.erm.hz[0] * 60 && SRC.pmd.erm.rpm[1] === SRC.pmd.erm.hz[1] * 60, 'the table’s 30 to 500 Hz is its 1,800 to 30,000 rpm');
assert.deepEqual(JSON.parse(JSON.stringify(P.DECLARED)), {phone: 150, thickness: 1.5, proofMass: 1e-9, q: 0.5, gap: 1.5, kelvin: 298.15, buzz: 0.1, slow: 100, samples: 481, screen: [66, 136], spread: 4, window: [2, 1]});
t.near(P.DECLARED.kelvin - 273.15, S.temperature, 1e-12, 'the sheet’s 25 °C in kelvin');
t.ok(P.DECLARED.q === 1 / (2 * 1), 'critical damping: the Q factor page’s Q = 1/(2ζ) with ζ = 1');
assert.deepEqual({...P.PHONE_DEFAULTS}, {across: 26, along: 50, turn: 0, lift: 0, drive: 3, filter: 0.0047});
assert.deepEqual(JSON.parse(JSON.stringify(P.PHONE_DOMAINS)), {across: [12, 54, 1], along: [9, 127, 1], turn: [0, 90, 5], lift: [-1, 1, 0.1], drive: [0, 3.8, 0.1], filter: [0.0047, 4.7, 0.0001]});
t.ok(P.PHONE_DOMAINS.drive[1] === K.use[1] && P.PHONE_DEFAULTS.drive === K.rated && P.PHONE_DOMAINS.filter[0] === S.smallest && P.PHONE_DOMAINS.filter[1] === P.CAPACITORS[3] && P.PHONE_DEFAULTS.filter === S.smallest, 'the drive up to the sheet’s 3.8 V from its rated 3.0 V, and the filter across the capacitors');
for (const microfarads of P.CAPACITORS) {
  const steps = (microfarads - P.PHONE_DOMAINS.filter[0]) / P.PHONE_DOMAINS.filter[2];
  t.ok(Math.abs(steps - Math.round(steps)) < 1e-8, `${microfarads} μF sits on the filter’s grid`);
}

// The touch grid: the Capacitive sensing page's array and AN2934 typed in
// again, the pitches held to the note, and the controller built again from its
// own crossings with three.js vectors, then swept for its worst error.
const W = SRC.touch, N = P.AN2934, pitchX = P.DECLARED.screen[0] / W.columns, pitchY = P.DECLARED.screen[1] / W.rows, spread = W.typical / 2;
t.ok(P.GRID.columns === W.columns && P.GRID.rows === W.rows && W.columns * W.rows === W.capacitors, 'the Capacitive sensing page’s 12-by-16 array has 192 capacitors');
assert.deepEqual(JSON.parse(JSON.stringify(N)), {finger: W.finger, typical: W.typical, pitch: W.pitch, ideal: W.ideal, apart: W.apart, body: W.body});
t.ok(P.PITCH[0] === pitchX && P.PITCH[1] === pitchY && f1(pitchX) === '5.5' && f1(pitchY) === '8.5', '5.5 mm between the columns and 8.5 mm between the rows');
t.ok([pitchX, pitchY].every(pitch => pitch >= W.pitch[0] && pitch <= W.pitch[2]), 'both inside AN2934’s 4 to 10 mm');
t.ok(P.DECLARED.spread === spread && W.typical >= W.finger[0] && W.typical <= W.finger[1], 'a spread of the typical fingertip’s radius, inside the note’s 5 to 10 mm');
t.ok(P.DECLARED.screen[0] === M.PHONE.screen[0] && P.DECLARED.screen[1] === M.PHONE.screen[1], 'the grid laid over the screen the model draws');

/** The fewest electrodes, strips a pitch wide, an 8 mm fingertip overlaps wherever it lies. */
function fewestStrips(pitch) {
  let least = Infinity;
  for (let k = 0; k <= 20000; k++) {
    const center = 20 * pitch + pitch * k / 20000;
    let overlapped = 0;
    for (let strip = 0; strip < 60; strip++) if (Math.abs(center - (strip + 0.5) * pitch) < (pitch + W.typical) / 2) overlapped++;
    least = Math.min(least, overlapped);
  }
  return least;
}
t.ok(fewestStrips(W.ideal) === 2 && fewestStrips(pitchX) === 2, 'at AN2934’s ideal 5 mm, and at the columns’ 5.5 mm, an 8 mm fingertip always overlaps two electrodes');
t.ok(fewestStrips(pitchY) === 1 && pitchY > W.typical, 'the 8.5 mm rows, wider than the fingertip, can leave it over one row alone');
t.ok(f0(W.apart * pitchX) === '11' && f0(W.apart * pitchY) === '17', 'two touches twice the pitch apart: 11 mm and 17 mm');

const crossings = Array.from({length: W.rows * W.columns}, (_, k) => ({j: k % W.columns, i: Math.floor(k / W.columns), point: new THREE.Vector2((k % W.columns + 0.5) * pitchX, (Math.floor(k / W.columns) + 0.5) * pitchY)}));
/** The controller built again: each crossing's change from its distance to the fingertip, the first strongest, the crossings two columns and one row about it, and their weighted center. */
function controller(across, along) {
  const finger = new THREE.Vector2(across, along), shares = crossings.map(crossing => Math.exp(-crossing.point.distanceToSquared(finger) / (2 * spread * spread)));
  const top = shares.reduce((best, share, k) => (share > shares[best] ? k : best), 0), strongest = crossings[top];
  const near = crossings.filter(crossing => Math.abs(crossing.j - strongest.j) <= 2 && Math.abs(crossing.i - strongest.i) <= 1);
  const weight = near.reduce((sum, crossing) => sum + shares[crossing.i * W.columns + crossing.j], 0);
  const found = near.reduce((sum, crossing) => sum.addScaledVector(crossing.point, shares[crossing.i * W.columns + crossing.j]), new THREE.Vector2()).divideScalar(weight);
  counts.touch++;
  return {j: strongest.j, i: strongest.i, share: shares[top], near: near.length, found, error: found.distanceTo(finger), shares};
}
{
  let settingsSeen = 0;
  for (let across = P.PHONE_DOMAINS.across[0]; across <= P.PHONE_DOMAINS.across[1]; across++) {
    for (let along = P.PHONE_DOMAINS.along[0]; along <= P.PHONE_DOMAINS.along[1]; along++) {
      const mine = P.touchOf(across, along), other = controller(across, along);
      t.ok(mine.strongest.j === other.j && mine.strongest.i === other.i && mine.weighed.length === 15 && other.near === 15, `${across}, ${along} mm: the same strongest crossing, with all fifteen neighbors on the screen`);
      t.near(mine.strongest.share, other.share, 1e-12, `${across}, ${along} mm: its change`);
      t.near(mine.found[0], other.found.x, 1e-9, `${across}, ${along} mm: the touch found across`);
      t.near(mine.found[1], other.found.y, 1e-9, `${across}, ${along} mm: the touch found up`);
      t.near(mine.error, other.error, 1e-9, `${across}, ${along} mm: how far off`);
      t.ok(Math.abs(mine.offset[0] - (other.found.x - across)) < 1e-9 && Math.abs(mine.offset[1] - (other.found.y - along)) < 1e-9, `${across}, ${along} mm: the offset from the fingertip to the touch found`);
      t.ok(mine.changes.length === W.capacitors && mine.changes.every((change, k) => Math.abs(change - other.shares[k]) < 1e-12), `${across}, ${along} mm: every crossing’s change`);
      settingsSeen++;
    }
  }
  t.ok(settingsSeen === 43 * 119, 'every fingertip setting, 5,117 of them');
  t.ok(controller(P.PHONE_DOMAINS.across[0] - 1, 50).near < 15 && controller(26, P.PHONE_DOMAINS.along[0] - 1).near < 15, 'one step lower and a neighbor would fall off the grid');
  t.ok(P.PHONE_DOMAINS.across[0] + P.PHONE_DOMAINS.across[1] === P.DECLARED.screen[0] && P.PHONE_DOMAINS.along[0] + P.PHONE_DOMAINS.along[1] === P.DECLARED.screen[1], 'the settings sit evenly about the screen’s middle');
}
// Where the touch is found across depends only on how far across, and up only on how far up, so each is swept alone.
let worstAcross = 0, worstAlong = 0;
{
  let last = -Infinity;
  for (let k = 0; k <= 4200; k++) {
    const across = P.PHONE_DOMAINS.across[0] + k / 100, here = P.touchOf(across, 50), there = P.touchOf(across, 80.3);
    t.near(here.found[0], there.found[0], 1e-9, `${across} mm across: found at the same place across whatever the height`);
    t.ok(here.found[0] >= last - 1e-12, `${across} mm across: the touch found moves the way the fingertip does`);
    last = here.found[0];
    worstAcross = Math.max(worstAcross, Math.abs(here.offset[0]));
    counts.touch++;
  }
  last = -Infinity;
  for (let k = 0; k <= 11800; k++) {
    const along = P.PHONE_DOMAINS.along[0] + k / 100, here = P.touchOf(26, along), there = P.touchOf(47.7, along);
    t.near(here.found[1], there.found[1], 1e-9, `${along} mm up: found at the same height whatever the place across`);
    t.ok(here.found[1] >= last - 1e-12, `${along} mm up: the touch found moves the way the fingertip does`);
    last = here.found[1];
    worstAlong = Math.max(worstAlong, Math.abs(here.offset[1]));
    counts.touch++;
  }
}
const worstTouch = Math.hypot(worstAcross, worstAlong);
t.ok(worstAcross < 0.05 && worstAlong < 0.5 && f2(worstTouch) === '0.31', `the touch found within 0.31 mm anywhere (${worstTouch})`);
for (let j = 2; j <= W.columns - 3; j++) {
  for (let i = 1; i <= W.rows - 2; i++) {
    const on = P.touchOf((j + 0.5) * pitchX, (i + 0.5) * pitchY);
    t.ok(on.error < 1e-9 && on.strongest.j === j && on.strongest.i === i && on.strongest.share === 1, `on crossing ${j + 1}, ${i + 1}: the touch found exactly there`);
    for (const [du, dv] of [[1.3, 2.1], [-2.6, 0.4], [0.7, -3.9]]) {
      const plus = P.touchOf((j + 0.5) * pitchX + du, (i + 0.5) * pitchY + dv), minus = P.touchOf((j + 0.5) * pitchX - du, (i + 0.5) * pitchY - dv);
      t.near(plus.offset[0], -minus.offset[0], 1e-9, `mirrored about crossing ${j + 1}, ${i + 1}: the touch found mirrored across`);
      t.near(plus.offset[1], -minus.offset[1], 1e-9, `mirrored about crossing ${j + 1}, ${i + 1}: the touch found mirrored up`);
    }
  }
}

// What each axis reads, from a rotation built another way: the phone’s
// quaternion undoes the turn on the world’s specific force, a − g.
{
  let combos = 0;
  for (let turn = 0; turn <= 90; turn += 5) {
    for (let step = -10; step <= 10; step++) {
      const lift = step / 10, plan = P.phonePlan({turn, lift});
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), turn * Math.PI / 180);
      const felt = new THREE.Vector3(0, lift * SRC.g, 0).sub(new THREE.Vector3(0, -SRC.g, 0)).applyQuaternion(q.clone().invert()).divideScalar(SRC.g);
      t.near(plan.still.x, felt.x, 1e-12, `turned ${turn}° with a lift of ${lift} g: x`);
      t.near(plan.still.y, felt.y, 1e-12, `turned ${turn}° with a lift of ${lift} g: y`);
      t.near(plan.still.z, felt.z, 1e-12, `turned ${turn}° with a lift of ${lift} g: z`);
      t.ok(plan.landscape === (lift > -1 + 1e-9 && turn > 45), `turned ${turn}° with a lift of ${lift} g: ${plan.landscape ? 'landscape' : 'portrait'}`);
      combos++;
    }
  }
  t.ok(combos === 19 * 21, 'every turn with every lift');
  const up = P.phonePlan({}), fall = P.phonePlan({lift: -1}), side = P.phonePlan({turn: 90});
  t.ok(up.still.x === 0 && up.still.y === SRC.accelerometerPage.rest && up.still.z === 0, 'upright at rest: y reads exactly 1 g upward, as the Accelerometer page says');
  t.ok(fall.still.x === 0 && fall.still.y === 0 && fall.still.z === 0, 'in free fall: zero on every axis');
  t.near(side.still.x, 1, 1e-15, 'turned a quarter turn: x reads 1 g');
  t.near(side.still.y, 0, 1e-15, 'and y reads nothing');
  const flat = P.properAcceleration([0, 0, 0], {x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0]});
  t.ok(flat.x === 0 && flat.y === 0 && flat.z === 1, 'lying face up on a table: z reads 1 g');
  const lifting = P.properAcceleration([0, 0.5, 0], P.axesOf(0)), pushed = P.properAcceleration([0.3, 0, 0], P.axesOf(0));
  t.ok(lifting.y === 1.5 && pushed.x === 0.3 && pushed.y === 1, 'a lift speeding up reads more; a sideways push reads on x');
}

// A proof mass released from rest under 1 g, integrated until it settles: a/ωn² for any damping.
for (const q of [0.5, 2, 20]) {
  const w = P.OMEGA_N, dt = 1 / (w * 40), until = 30 * q / w + 40 / w;
  let state = [0, 0], time = 0;
  while (time < until) { state = rk4(state, time, dt, (_, [x, v]) => [v, -SRC.g - w / q * v - w * w * x]); time += dt; }
  t.near(state[0], -P.sagOf(1), relative(P.sagOf(1), 1e-4), `released under 1 g with Q = ${q}, the mass settles a/ωn² down`);
}
{
  const plan = P.phonePlan({});
  t.near(plan.sagPerG, SRC.g / (2 * Math.PI * S.resonance * 1000) ** 2, relative(plan.sagPerG, 1e-12), 'sag per g from the sheet’s resonance');
  for (const mass of [1e-10, 1e-9, 1e-8]) t.near(mass * SRC.g / (mass * P.OMEGA_N ** 2), plan.sagPerG, relative(plan.sagPerG, 1e-12), `a mass of ${mass * 1e9} μg on the spring that keeps 5.5 kHz sags the same`);
  t.ok(f1(plan.sagPerG * 1e9) === '8.2' && f2(plan.sagPerG * 1e9) === '8.21' && f2(100 * plan.sagPerG / plan.gap) === '0.55', '8.2 nm, 8.21 nm and 0.55%');
  t.ok(plan.stillSag.y === -plan.sagPerG && plan.stillSag.x === -0, 'upright, the y mass sags one g’s worth and the x mass none');
}

// The steady swing at the buzz, integrated, against the response the model quotes.
{
  const hz = P.phonePlan({}).motor.hz, w = P.OMEGA_N, drive = 2 * Math.PI * hz;
  for (const q of [0.5, 5]) {
    const dt = 1 / (hz * 2000), settle = 40 * q / w + 20 / hz;
    let state = [0, 0], time = 0, peak = 0;
    while (time < settle + 1 / hz) {
      state = rk4(state, time, dt, (tt, [x, v]) => [v, -SRC.g * Math.cos(drive * tt) - w / q * v - w * w * x]);
      time += dt;
      if (time > settle) peak = Math.max(peak, Math.abs(state[0]));
    }
    t.near(peak / P.sagOf(1), P.responseOf(hz, q), 2e-5, `Q = ${q}: the swing at ${f0(hz)} Hz, integrated`);
  }
  const [critical, none] = P.phonePlan({}).response;
  const complex = q => w * w / Math.hypot(w * w - drive * drive, q === Infinity ? 0 : drive * w / q);
  t.near(critical, complex(0.5), 1e-12, 'critically damped, by the complex response');
  t.near(none, complex(Infinity), 1e-12, 'undamped, by the complex response');
  t.ok(f2(100 * Math.max(1 - critical, none - 1)) === '0.11' && f0(A.resonance / hz) === '30', 'within 0.11% for any damping, 30 times below resonance');
}

// The differential capacitor: the floating finger’s charge balance solved by bisection.
{
  const area = 3.7e-8, gap = P.DECLARED.gap * 1e-6, volts = 2.5;
  for (let g = -3; g <= 3 + 1e-9; g += 0.25) {
    const x = P.sagOf(g), c1 = SRC.e0 * area / (gap - x), c2 = SRC.e0 * area / (gap + x);
    const charge = middle => c1 * (middle - volts) + c2 * (middle + volts);
    let lo = -volts, hi = volts;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (charge(mid) > 0) hi = mid; else lo = mid; }
    t.near((lo + hi) / 2 / volts, x / gap, 1e-13, `${g} g: the finger sits at the drive times the sag over the gap`);
  }
}

// The air’s thermal jostling: its force spectrum through the spring and mass
// holds ½kBT in the spring, as the Equipartition theorem page says.
{
  const m = P.DECLARED.proofMass, w = P.OMEGA_N, T0 = 273.15 + S.temperature, k = m * w * w, fn = w / (2 * Math.PI);
  for (const q of [0.5, 5]) {
    const c = m * w / q, force = 4 * SRC.kB * T0 * c;
    const psd = f => { const om = 2 * Math.PI * f; return force / ((k - m * om * om) ** 2 + (c * om) ** 2); };
    const lo = fn * 1e-4, hi = fn * 1e4;
    const total = logSimpson(psd, lo, hi, 40000) + psd(0) * lo + force / (m * m * (2 * Math.PI) ** 4) / (3 * hi ** 3);
    t.near(total, SRC.kB * T0 / k, relative(SRC.kB * T0 / k, 1e-6), `Q = ${q}: the jostling over every frequency is kBT/k`);
  }
  t.near(P.thermalNoise() * SRC.g, Math.sqrt(4 * SRC.kB * T0 * (m * w / P.DECLARED.q)) / m, relative(P.thermalNoise() * SRC.g, 1e-12), 'the acceleration noise √(4kBTc)/m');
  t.near(P.STIFFNESS, k, relative(k, 1e-12), 'the spring a 1 μg mass needs for 5.5 kHz');
  t.ok(f0(P.thermalNoise() * 1e6) === '109' && f1(Math.sqrt(SRC.kB * T0 / k) * 1e12) === '58.7' && f2(P.STIFFNESS) === '1.19' && f1(m * SRC.g * 1e9) === '9.8', '109 μg/√Hz, 58.7 pm, 1.19 N/m and 9.8 nN');
}

// A single pole’s noise band by quadrature, and each filter’s rms noise.
{
  const band = logSimpson(u => 1 / (1 + u * u), 1e-6, 1e6, 20000) + 1e-6 + 1e-6;
  t.near(band, Math.PI / 2, 1e-8, 'a single pole passes noise as a band π/2 times its bandwidth');
  t.ok(f1(band) === String(A.noiseFactor) && f2(band) === '1.57', 'the sheet’s 1.6, rounded up from 1.57');
  t.near(P.gainOf(100, 100), 1 / Math.SQRT2, 1e-15, 'at the cutoff a single pole passes 1/√2, as the RC circuit page gives');
  for (const microfarads of P.CAPACITORS) {
    const plan = P.phonePlan({filter: microfarads});
    t.near(plan.cutoff, 1 / (2 * Math.PI * S.resistor * 1000 * microfarads * 1e-6), relative(plan.cutoff, 1e-12), `${microfarads} μF: the bandwidth`);
    t.near(plan.noise, S.noise * 1e-6 * Math.sqrt(S.factor * plan.cutoff), relative(plan.noise, 1e-12), `${microfarads} μF: the rms noise`);
    t.near(plan.noiseSag, plan.noise * plan.sagPerG, relative(plan.noiseSag, 1e-12), `${microfarads} μF: the sag the noise matches`);
  }
}

// Each filter’s output integrated in time from the steady state: the chart follows it.
for (const microfarads of P.CAPACITORS) {
  const plan = P.phonePlan({filter: microfarads}), tau = 1 / (2 * Math.PI * plan.cutoff), w = plan.motor.omega, swing = plan.buzz;
  for (const [axis, input] of [['x', tt => swing * Math.cos(w * tt)], ['y', tt => swing * Math.sin(w * tt)]]) {
    let state = [P.chartAt(plan, 0)[axis] - plan.still[axis]], time = 0, worst = 0;
    const dt = 2e-6;
    for (let i = 0; i < 50000; i++) {
      state = rk4(state, time, dt, (tt, [y]) => [(input(tt) - y) / tau]);
      time += dt;
      if (i % 500 === 499) worst = Math.max(worst, Math.abs(state[0] - (P.chartAt(plan, time)[axis] - plan.still[axis])));
    }
    t.ok(worst < 1e-9, `${microfarads} μF on ${axis}: the chart is the filter integrated in time (worst ${worst})`);
  }
}

// The motor: the sheet’s shake, the weight’s path, the half disk, speed and voltage.
{
  const plan = P.phonePlan({}), w = 2 * Math.PI * K.speed / 60;
  t.near(P.RATED_OMEGA, w, 1e-12, '11,000 rpm in radians a second');
  t.near(P.MOMENT * w * w, K.amplitude * SRC.g * K.block / 1000, 1e-15, 'the pull that shakes a 75 g block at 1.0 G');
  t.near(plan.motor.force, K.amplitude * SRC.g * K.block / 1000, 1e-15, 'at 3.0 V the model pulls with it');
  const h = 3e-6, r = P.WEIGHT.centroid, at = tt => [r * Math.cos(w * tt), r * Math.sin(w * tt)];
  for (const tt of [0.001, 0.0123, 0.05]) {
    const [a, b, c] = [at(tt - h), at(tt), at(tt + h)];
    const accel = Math.hypot((a[0] - 2 * b[0] + c[0]) / h ** 2, (a[1] - 2 * b[1] + c[1]) / h ** 2);
    t.near(P.WEIGHT.mass * accel, plan.motor.force, relative(plan.motor.force, 2e-5), `at ${tt} s: mass times the acceleration of its center, differentiated from its path`);
  }
  const R = P.WEIGHT.radius, n = 400;
  let area = 0, moment = 0;
  for (let i = 0; i <= n; i++) {
    const rr = R * i / n, wr = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    for (let j = 0; j <= n; j++) {
      const th = -Math.PI / 2 + Math.PI * j / n, wt = j === 0 || j === n ? 1 : j % 2 ? 4 : 2;
      area += wr * wt * rr;
      moment += wr * wt * rr * rr * Math.cos(th);
      counts.quadrature++;
    }
  }
  const scale = (R / n / 3) * (Math.PI / n / 3);
  area *= scale;
  moment *= scale;
  t.near(area, Math.PI * R * R / 2, relative(area, 1e-9), 'the half disk’s area by integration');
  t.near(moment / area, P.WEIGHT.centroid, relative(P.WEIGHT.centroid, 1e-9), 'its center of mass by integration');
  t.near(P.WEIGHT.centroid, 4 * R / (3 * Math.PI), 1e-15, 'PMD’s 2r sin θ/(3θ) at θ = π/2 is 4r/(3π)');
  t.near(P.WEIGHT.mass, SRC.pmd.tungstenCarbide * 1000 * P.DECLARED.thickness / 1000 * area, relative(P.WEIGHT.mass, 1e-9), 'tungsten carbide 1.5 mm thick');
  t.near(P.WEIGHT.mass * P.WEIGHT.centroid, P.MOMENT, relative(P.MOMENT, 1e-12), 'its mass times its offset is the moment');
  t.ok(P.WEIGHT.radius * 1000 < K.diameter / 2 && P.DECLARED.thickness < K.length && P.WEIGHT.mass * 1000 < K.mass, 'the weight fits inside the 10 mm by 2.7 mm motor and weighs less than the whole 1.2 g');
  t.ok(f2(P.MOMENT * 1e6) === '0.55' && f2(R * 1000) === '3.29' && f2(P.WEIGHT.mass * 1000) === '0.40' && f2(P.WEIGHT.centroid * 1000) === '1.39', '0.55 g·mm, 3.29 mm, 0.40 g and 1.39 mm');
  for (let tenth = 0; tenth <= 38; tenth++) {
    const volts = tenth / 10, other = P.phonePlan({drive: volts}), spinning = volts >= K.start - 1e-9;
    t.ok(other.motor.spinning === spinning, `${volts} V: ${spinning ? 'turning' : 'stopped'}`);
    if (spinning) {
      t.near(other.motor.rpm / volts, K.speed / K.rated, 1e-9, `${volts} V: speed in proportion to voltage`);
      t.ok(other.motor.rpm >= K.speed - K.tolerance && other.motor.rpm <= K.speed + K.tolerance, `${volts} V: inside the sheet’s 11,000 ± 3,000 rpm`);
      t.ok(other.motor.hz >= SRC.pmd.erm.hz[0] && other.motor.hz <= SRC.pmd.erm.hz[1], `${volts} V: inside PMD’s 30 to 500 Hz for brushed motors`);
      t.near(other.motor.force / plan.motor.force, (volts / K.rated) ** 2, 1e-12, `${volts} V: the pull as the square of the voltage`);
      t.near(other.buzz * SRC.g * P.DECLARED.phone / 1000, other.motor.force, relative(other.motor.force, 1e-12), `${volts} V: the phone’s acceleration is the pull over its mass`);
      t.near(other.gain, 1 / Math.hypot(1, other.motor.hz / other.cutoff), 1e-15, `${volts} V: the filter’s gain at the buzz`);
    } else {
      t.ok(other.motor.rpm === 0 && other.motor.force === 0 && other.gain === 1 && other.lag === 0 && other.buzz === 0, `${volts} V: no pull at all`);
    }
  }
}

// The phone shakes as a free body: its center of mass with the weight stays put,
// and its shaking differentiated twice is the push the motor gives it.
for (const values of [{}, {drive: 3.8}, {turn: 90, lift: -1, drive: 2.5}]) {
  const plan = P.phonePlan(values), phoneMass = P.DECLARED.phone / 1000, h = 1e-6;
  for (const tt of [0.0005, 0.0123, 0.05, 0.0987]) {
    const now = P.phoneAt(plan, tt), before = P.phoneAt(plan, tt - h), after = P.phoneAt(plan, tt + h);
    for (const k of [0, 1]) t.near((before.shake[k] - 2 * now.shake[k] + after.shake[k]) / h ** 2, now.push[k] * SRC.g, relative(now.push[k] * SRC.g, 1e-4) + 1e-6, `${JSON.stringify(values)} at ${tt} s: the shaking differentiated twice is the motor’s push`);
    t.near(phoneMass * now.shake[0] + P.MOMENT * (Math.cos(now.angle) - 1), 0, 1e-15, 'the center of mass stays put along x');
    t.near(phoneMass * now.shake[1] + P.MOMENT * Math.sin(now.angle), 0, 1e-15, 'and along y');
    t.near(now.felt.y, plan.still.y + now.push[1], 1e-15, 'the masses feel the steady reading plus the push');
    t.near(now.sag.y, -P.sagOf(now.felt.y), 1e-24, 'and sag by it');
    t.near(now.felt.x, plan.still.x + now.push[0], 1e-15, 'the x mass feels its steady reading plus the push');
    t.near(now.sag.x, -P.sagOf(now.felt.x), 1e-24, 'and sags by it');
    t.near(now.volts.x, A.zero[1] + A.sensitivity[1] * now.output.x, 1e-15, 'the x output in volts');
    t.near(now.volts.y, A.zero[1] + A.sensitivity[1] * now.output.y, 1e-15, 'the y output in volts');
  }
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createSmartphoneModel(), T = model.topology;
const pointsOf = line => {
  const array = line.geometry.attributes.position.array, count = line.geometry.drawRange.count, n = Number.isFinite(count) ? count : array.length / 3;
  return Array.from({length: n}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]);
};
function boxOf(object, inverse) {
  const box = new THREE.Box3(), point = new THREE.Vector3();
  object.traverseVisible(child => {
    const positions = child.geometry?.attributes?.position;
    if (!positions) return;
    const range = child.geometry.drawRange, count = Number.isFinite(range.count) ? Math.min(range.count, positions.count) : positions.count;
    const matrix = inverse.clone().multiply(child.matrixWorld);
    for (let i = 0; i < count; i++) box.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(matrix));
  });
  return box;
}
const apart = (a, b, pad) => a.max.x + pad <= b.min.x || b.max.x + pad <= a.min.x || a.max.y + pad <= b.min.y || b.max.y + pad <= a.min.y;
function crosses([ax, ay], [bx, by], box, pad) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - (box.min.x - pad)], [dx, box.max.x + pad - ax], [-dy, ay - (box.min.y - pad)], [dy, box.max.y + pad - ay]]) {
    if (Math.abs(p) < 1e-15) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}

// The phone, the motor and the cells as built.
{
  const body = T.body.geometry.parameters;
  t.near(body.width, M.PHONE.body[0] * M.MM, 1e-15, 'the phone 72 mm wide at true size');
  t.near(body.height, M.PHONE.body[1] * M.MM, 1e-15, '150 mm tall');
  t.near(body.depth, M.PHONE.body[2] * M.MM, 1e-15, '8 mm thick');
  t.near(T.screen.scale.x, M.PHONE.screen[0] * M.MM, 1e-15, 'the screen’s width');
  t.near(T.screen.scale.y, M.PHONE.screen[1] * M.MM, 1e-15, 'the screen’s height');
  t.ok(M.PHONE.screen[0] < M.PHONE.body[0] && M.PHONE.screen[1] / 2 + Math.abs(M.PHONE.raise) < M.PHONE.body[1] / 2, 'the screen inside the body');
  const chip = pointsOf(T.chipOutline);
  t.near(Math.abs(chip[1][0] - chip[0][0]) / M.MM, A.size[0], 1e-5, 'the accelerometer outlined 4 mm across');
  const coin = pointsOf(T.motorOutline);
  for (const [x, y] of coin) t.near(Math.hypot(x / M.MM - M.PHONE.motor[0], y / M.MM - M.PHONE.motor[1]), K.diameter / 2, 1e-4, 'the motor outlined 10 mm across');
  const [sw, sh] = M.PHONE.screen;
  for (const landscape of [false, true]) {
    const bars = M.screenBars(landscape), mesh = landscape ? T.landscape : T.portrait, positions = mesh.geometry.attributes.position.array, index = mesh.geometry.index.array;
    t.ok(bars.length >= 6, `text on the ${landscape ? 'landscape' : 'portrait'} screen`);
    bars.forEach(([x0, x1, y0, y1], b) => {
      t.ok(x0 >= -sw / 2 && x1 <= sw / 2 && y0 >= -sh / 2 && y1 <= sh / 2 && x1 > x0 && y1 > y0, 'every text line inside the screen');
      t.ok(landscape ? y1 - y0 > x1 - x0 : x1 - x0 > y1 - y0, `lines run ${landscape ? 'along' : 'across'} the phone`);
      t.near(positions[b * 12], x0 * M.MM, 1e-6, 'drawn where it is laid out');
      t.near(positions[b * 12 + 1], (y0 + M.PHONE.raise) * M.MM, 1e-6, 'drawn where it is laid out, above the body’s middle');
    });
    for (let i = 0; i < index.length; i += 3) {
      const [a, b, c] = [index[i], index[i + 1], index[i + 2]].map(k => [positions[3 * k], positions[3 * k + 1]]);
      t.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0, 'text triangles face the viewer');
    }
  }
  // The touch grid on the phone, and the close up of the patch the controller weighs.
  const columnLines = pointsOf(T.gridColumns), rowLines = pointsOf(T.gridRows), [gridW, gridH] = M.PHONE.screen, textZ = T.portrait.geometry.attributes.position.array[2];
  t.ok(columnLines.length === 2 * W.columns && rowLines.length === 2 * W.rows, 'twelve sensing columns and sixteen driving rows on the phone');
  for (let j = 0; j < W.columns; j++) {
    const [a, b] = [columnLines[2 * j], columnLines[2 * j + 1]];
    t.near(a[0] / M.MM + gridW / 2, (j + 0.5) * pitchX, 1e-4, `sensing column ${j + 1} where its pitch puts it`);
    t.ok(a[0] === b[0] && Math.abs(a[1] / M.MM - (M.PHONE.raise - gridH / 2)) < 1e-4 && Math.abs(b[1] / M.MM - (M.PHONE.raise + gridH / 2)) < 1e-4, `sensing column ${j + 1} running up the whole screen`);
  }
  for (let i = 0; i < W.rows; i++) {
    const [a, b] = [rowLines[2 * i], rowLines[2 * i + 1]];
    t.near(a[1] / M.MM - M.PHONE.raise + gridH / 2, (i + 0.5) * pitchY, 1e-4, `driving row ${i + 1} where its pitch puts it`);
    t.ok(a[1] === b[1] && Math.abs(a[0] / M.MM + gridW / 2) < 1e-4 && Math.abs(b[0] / M.MM - gridW / 2) < 1e-4, `driving row ${i + 1} running across the whole screen`);
  }
  t.ok([...columnLines, ...rowLines].every(point => point[2] > T.screen.position.z && point[2] < textZ), 'the grid over the screen and under the text');
  t.near(T.fingertip.geometry.parameters.radius, W.typical / 2 * M.MM, 1e-15, 'an 8 mm fingertip at true size');
  const scale = M.TOUCH_MM, touchFrame = pointsOf(T.touchFrame);
  t.ok(M.timesLarger(scale) === 3, 'the close up 3 times larger');
  t.near(M.PATCH[0] * 2, 5 * pitchX, 1e-12, 'the patch five columns wide');
  t.near(M.PATCH[1] * 2, 3 * pitchY, 1e-12, 'and three rows tall');
  t.near(touchFrame[1][0] - touchFrame[0][0], 5 * pitchX * scale, 1e-6, 'the close up’s frame as wide as the patch, 3 times larger');
  t.near(touchFrame[2][1] - touchFrame[1][1], 3 * pitchY * scale, 1e-6, 'and as tall');
  t.near(T.pad.scale.x, 5 * pitchX * scale, 1e-12, 'the close up’s screen fills the frame across');
  t.near(T.pad.scale.y, 3 * pitchY * scale, 1e-12, 'and up');
  t.ok(T.squares.length === 15 && M.TOUCHVIEW.square < Math.min(pitchX, pitchY), 'a square for each of the fifteen crossings weighed, clear of one another');
  for (const square of T.squares) {
    t.near(square.mesh.position.x, square.dj * pitchX * scale, 1e-12, 'each square on its crossing across');
    t.near(square.mesh.position.y, square.di * pitchY * scale, 1e-12, 'each square on its crossing up');
    t.ok(Math.abs(square.mesh.scale.x - M.TOUCHVIEW.square * scale) < 1e-12 && Math.abs(square.mesh.scale.y - M.TOUCHVIEW.square * scale) < 1e-12, 'each square 3.5 mm, 3 times larger');
  }
  const closeColumns = pointsOf(T.touchColumns), closeRows = pointsOf(T.touchRows);
  t.ok(closeColumns.length === 10 && closeRows.length === 6, 'five sensing columns and three driving rows close up');
  for (let k = 0; k < 5; k++) t.near(closeColumns[2 * k][0], (k - 2) * pitchX * scale, 1e-6, 'each column close up a pitch from the next');
  for (let k = 0; k < 3; k++) t.near(closeRows[2 * k][1], (k - 1) * pitchY * scale, 1e-6, 'each row close up a pitch from the next');
  t.ok(pitchX / 2 + W.typical / 2 < M.PATCH[0] && pitchY / 2 + W.typical / 2 < M.PATCH[1], 'a fingertip within half a pitch of its crossing always fits inside the frame');
  const weight = T.weight.geometry.parameters;
  t.near(weight.radius, P.WEIGHT.radius * 1000 * M.MOTOR_MM, 1e-15, 'the weight drawn at its radius, 10 times larger');
  t.ok(weight.thetaStart === -Math.PI / 2 && weight.thetaLength === Math.PI, 'a half disk on the rotor’s x axis');
  t.near(T.centroidDot.position.x, P.WEIGHT.centroid * 1000 * M.MOTOR_MM, 1e-15, 'its center of mass marked where it is');
  t.near(T.housing.geometry.parameters.radius * 2 / M.MOTOR_MM, K.diameter, 1e-12, 'the housing 10 mm across');
  for (const [x, y] of pointsOf(T.rim)) t.near(Math.hypot(x, y), M.MOTORVIEW.housing * M.MOTOR_MM, 1e-6, 'the rim on the housing');
  for (const [x, y] of pointsOf(T.path)) t.near(Math.hypot(x, y), P.WEIGHT.centroid * 1000 * M.MOTOR_MM, 1e-6, 'the path of the center of mass');
  const brushes = pointsOf(T.brushes);
  for (const [x, y] of [brushes[1], brushes[3]]) t.near(Math.hypot(x, y), M.MOTORVIEW.commutator * M.MOTOR_MM, 1e-6, 'each brush touching the commutator');
  t.ok(P.WEIGHT.radius * 1000 < M.MOTORVIEW.housing, 'the weight inside the housing');
  const frame = pointsOf(T.chartFrame), zero = pointsOf(T.zeroLine);
  t.ok(M.CHART.range === A.range, 'the chart spans the sheet’s ±3 g range');
  t.near(M.chartY(-A.range), frame[0][1], 1e-6, 'the bottom of the range on the frame’s bottom');
  t.near(M.chartY(A.range), frame[2][1], 1e-6, 'the top of the range on the frame’s top');
  t.near(zero[0][1], (frame[0][1] + frame[2][1]) / 2, 1e-6, 'zero g halfway up');
  t.near(M.chartY(0), zero[0][1], 1e-6, 'zero g on the zero line');
  {
    const plan = P.phonePlan({});
    t.near(M.chartX(plan, 0), frame[0][0], 1e-6, 'the buzz starts at the frame’s left');
    t.near(M.chartX(plan, plan.duration), frame[1][0], 1e-6, 'and ends at its right');
  }
  const [screenW, screenH] = M.PHONE.screen, inside = ([x, y], margin) => Math.abs(x) <= screenW / 2 - margin && Math.abs(y - M.PHONE.raise) <= screenH / 2 - margin;
  t.ok([[-1, -1], [1, 1]].every(([dx, dy]) => inside([M.PHONE.chip[0] + dx * A.size[0] / 2, M.PHONE.chip[1] + dy * A.size[1] / 2], 0)), 'the accelerometer’s outline inside the screen');
  t.ok(inside(M.PHONE.motor, K.diameter / 2), 'the motor’s outline inside the screen');
  for (const line of [T.rim, T.path, T.motorOutline, T.commutator]) { const points = pointsOf(line); t.near(Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]), 0, 1e-6, 'every circle closed'); }
  t.ok(T.cells[0].group.position.x < T.cells[1].group.position.x, 'the x cell on the left, the y cell on the right');
  const title = M.screenBars(true)[0], titleCenter = (title[0] + title[1]) / 2;
  t.ok(titleCenter > 0 && Math.abs((title[2] + title[3]) / 2) < screenW / 2, 'the landscape page’s first line toward the phone’s x axis, which points up once turned');
  t.ok(T.cells.map(cell => cell.axis).join() === 'x,y' && T.cells[0].group.rotation.z === -Math.PI / 2 && T.cells[1].group.rotation.z === 0, 'the x cell turned to sense along the phone’s width');
  const rows = M.fixedRows();
  t.ok(rows.length === 2 * M.CELLS.rows.length && rows.every((v, i) => i === 0 || v > rows[i - 1] + M.CELLS.thickness), 'fixed fingers in order, clear of one another');
  t.ok(M.CELLS.finger[1] < M.CELLS.bar[0] && M.CELLS.fixed[0] > M.CELLS.spine[0] && M.CELLS.anchor[1] < M.CELLS.bar[0] && M.CELLS.spine[1] - M.CELLS.anchor[1] / 12 > Math.max(...rows) + M.CELLS.thickness, 'fingers clear of the bars, the spine and the springs');
}

const settings = [{}, {turn: 90}, {turn: 45}, {turn: 50}, {lift: -1}, {lift: 1}, {lift: 1, drive: 3.8}, {drive: 2.2}, {drive: 2.3}, {filter: 0.1}, {filter: 4.7}, {turn: 90, lift: 1, drive: 3.8}, {turn: 30, lift: -0.5, drive: 3.3, filter: 0.01}, {turn: 90, lift: -1, drive: 3.8}, {turn: 45, lift: 1, drive: 3.8}, {across: 12, along: 9}, {across: 54, along: 127, turn: 90, drive: 3.8}, {along: 51}, {across: 44, along: 104, turn: 45, lift: 1}, {across: 33, along: 68, lift: -1, drive: 3.8}];
const worstFill = {x: 0, y: 0};
for (const values of settings) {
  const planned = P.phonePlan(values), halfTurn = planned.motor.spinning ? Math.PI / planned.motor.omega : 0.003;
  for (const time of [0, 0.0005, halfTurn, 0.0123, 0.05, 0.0999, 0.1]) {
    model.reset();
    model.update(values);
    model.advance(time * P.DECLARED.slow);
    model.root.updateMatrixWorld(true);
    const s = model.getState(), plan = P.phonePlan(s.values), now = P.phoneAt(plan, time), inverse = T.system.matrixWorld.clone().invert();
    const sys = (object, local = [0, 0, 0]) => new THREE.Vector3(...local).applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
    const where = `${JSON.stringify(values)} at ${time} s`;
    counts.poses++;
    t.near(s.clock, time, 1e-15, `${where}: the clock`);

    // The phone, turned and shaken.
    const turn = plan.values.turn * Math.PI / 180, c = Math.cos(turn), sn = Math.sin(turn), units = 1000 * M.MM * M.SHAKE;
    t.near(T.handset.rotation.z, turn, 1e-15, `${where}: the phone turned`);
    t.near(T.handset.position.x, (c * now.shake[0] - sn * now.shake[1]) * units, 1e-12, `${where}: shaken along x, 2,000 times larger`);
    t.near(T.handset.position.y, (sn * now.shake[0] + c * now.shake[1]) * units, 1e-12, `${where}: shaken along y`);
    t.ok(T.portrait.visible === !plan.landscape && T.landscape.visible === plan.landscape, `${where}: the text in its orientation`);
    const bars = M.screenBars(plan.landscape), bar = bars[3], along = [c * (bar[1] - bar[0]), sn * (bar[1] - bar[0])], across = [-sn * (bar[3] - bar[2]), c * (bar[3] - bar[2])];
    t.ok(Math.abs(along[0]) + Math.abs(across[0]) >= Math.abs(along[1]) + Math.abs(across[1]) - 1e-9 || plan.values.turn === 45 || Math.hypot(plan.still.x, plan.still.y) < 1e-9, `${where}: the screen’s text lies closer to level than upright`);
    t.near(T.liftArrow.userData.length, Math.abs(plan.values.lift) * M.PHONE.lift, 1e-12, `${where}: the lift arrow as long as the lift`);
    t.ok(T.liftArrow.visible === (Math.abs(plan.values.lift) > 1e-9), `${where}: the lift arrow only with a lift`);
    if (T.liftArrow.visible) t.near(new THREE.Vector3(0, 1, 0).applyQuaternion(T.liftArrow.quaternion).y, Math.sign(plan.values.lift), 1e-12, `${where}: pointing the way the hand speeds it`);
    const leader = pointsOf(T.leaders), chipCenter = sys(T.handset, [M.PHONE.chip[0] * M.MM, M.PHONE.chip[1] * M.MM, 0]), coinCenter = sys(T.handset, [M.PHONE.motor[0] * M.MM, M.PHONE.motor[1] * M.MM, 0]);
    t.ok(leader.length === 6, `${where}: three leader segments`);
    t.near(leader[0][0], chipCenter.x, 2e-6, `${where}: the leader leaves the accelerometer’s outline`);
    t.near(leader[0][1], chipCenter.y, 2e-6, `${where}: the leader leaves the accelerometer’s outline`);
    t.near(leader[2][0], coinCenter.x, 2e-6, `${where}: the leader leaves the motor’s outline`);
    t.near(leader[2][1], coinCenter.y, 2e-6, `${where}: the leader leaves the motor’s outline`);

    // The touch, on the phone and close up.
    {
      const other = controller(plan.values.across, plan.values.along), cx = (other.j + 0.5) * pitchX, cy = (other.i + 0.5) * pitchY;
      const onPhone = (a, b) => [a - M.PHONE.screen[0] / 2, b - M.PHONE.screen[1] / 2 + M.PHONE.raise];
      const [fingerX, fingerY] = onPhone(plan.values.across, plan.values.along), [patchX, patchY] = onPhone(cx, cy);
      t.near(T.fingertip.position.x, fingerX * M.MM, 1e-12, `${where}: the fingertip where it was set, across`);
      t.near(T.fingertip.position.y, fingerY * M.MM, 1e-12, `${where}: the fingertip where it was set, up`);
      t.ok(T.fingertip.position.z > T.portrait.geometry.attributes.position.array[2], `${where}: the fingertip over the text`);
      const outline = pointsOf(T.patchOutline);
      t.near((outline[0][0] + outline[2][0]) / 2 / M.MM, patchX, 1e-4, `${where}: the outline centered on the strongest crossing, across`);
      t.near((outline[0][1] + outline[2][1]) / 2 / M.MM, patchY, 1e-4, `${where}: the outline centered on the strongest crossing, up`);
      t.near((outline[2][0] - outline[0][0]) / M.MM, 5 * pitchX, 1e-4, `${where}: the outline five columns wide`);
      t.near((outline[2][1] - outline[0][1]) / M.MM, 3 * pitchY, 1e-4, `${where}: the outline three rows tall`);
      t.ok(outline.every(([x, y]) => Math.abs(x / M.MM) <= M.PHONE.screen[0] / 2 + 1e-4 && Math.abs(y / M.MM - M.PHONE.raise) <= M.PHONE.screen[1] / 2 + 1e-4), `${where}: the outline on the screen`);
      t.ok(Math.abs(plan.values.across - cx) <= pitchX / 2 + 1e-9 && Math.abs(plan.values.along - cy) <= pitchY / 2 + 1e-9 && other.shares.every(share => share <= other.share), `${where}: the strongest crossing the nearest`);
      const mark = pointsOf(T.foundMark), [foundX, foundY] = onPhone(other.found.x, other.found.y);
      t.near((mark[0][0] + mark[1][0]) / 2 / M.MM, foundX, 1e-4, `${where}: the cross where the touch is found, across`);
      t.near((mark[2][1] + mark[3][1]) / 2 / M.MM, foundY, 1e-4, `${where}: the cross where the touch is found, up`);
      t.near((mark[1][0] - mark[0][0]) / M.MM, 2 * M.TOUCHVIEW.phoneCross, 1e-4, `${where}: the cross 3 mm across on the phone`);
      for (const square of T.squares) {
        const expected = new THREE.Color(M.COLORS.screen).lerp(new THREE.Color(M.COLORS.change), other.shares[(other.i + square.di) * W.columns + other.j + square.dj]);
        t.ok(['r', 'g', 'b'].every(channel => Math.abs(square.mesh.material.color[channel] - expected[channel]) < 1e-12), `${where}: each square shaded by how much its crossing changes`);
      }
      const u = (plan.values.across - cx) * M.TOUCH_MM, v = (plan.values.along - cy) * M.TOUCH_MM, circle = pointsOf(T.touchFinger);
      t.ok(circle.length === 49, `${where}: the fingertip’s circle`);
      for (const [x, y] of circle) t.near(Math.hypot(x - u, y - v), W.typical / 2 * M.TOUCH_MM, 1e-6, `${where}: an 8 mm fingertip close up, 3 times larger`);
      t.ok(circle.every(([x, y]) => Math.abs(x) < M.PATCH[0] * M.TOUCH_MM && Math.abs(y) < M.PATCH[1] * M.TOUCH_MM), `${where}: the fingertip inside the close up’s frame`);
      t.near(T.fingerDot.position.x, u, 1e-12, `${where}: the fingertip’s center close up, across`);
      t.near(T.fingerDot.position.y, v, 1e-12, `${where}: the fingertip’s center close up, up`);
      const foundClose = pointsOf(T.touchFound);
      t.near((foundClose[0][0] + foundClose[1][0]) / 2, (other.found.x - cx) * M.TOUCH_MM, 1e-6, `${where}: the cross close up where the touch is found, across`);
      t.near((foundClose[2][1] + foundClose[3][1]) / 2, (other.found.y - cy) * M.TOUCH_MM, 1e-6, `${where}: the cross close up where the touch is found, up`);
    }

    // The cells: masses, fingers and springs.
    for (const cell of T.cells) {
      const drop = now.share[cell.axis] * M.CELLS.gap * M.SHARE;
      t.near(cell.mass.position.y, drop, 1e-12, `${where}: the ${cell.axis} mass drawn at 60 times its share of the gap`);
      const shift = sys(cell.mass).sub(sys(cell.group));
      t.near(cell.axis === 'x' ? shift.x : shift.y, drop, 1e-9, `${where}: the ${cell.axis} mass moves along the phone’s ${cell.axis} axis`);
      t.near(cell.axis === 'x' ? shift.y : shift.x, 0, 1e-9, `${where}: and not across it`);
      for (const finger of cell.fingers) {
        const side = Math.sign(finger.position.x), center = finger.position.y + cell.mass.position.y, half = finger.scale.y / 2;
        const own = cell.fixedFingers.filter(fixedFinger => Math.sign(fixedFinger.position.x) === side).map(fixedFinger => fixedFinger.position.y);
        const below = Math.max(...own.filter(y => y < finger.position.y)), above = Math.min(...own.filter(y => y > finger.position.y));
        const gapBelow = center - half - (below + M.CELLS.thickness / 2), gapAbove = above - M.CELLS.thickness / 2 - (center + half);
        t.ok(gapBelow > 0.05 * M.CELLS.gap && gapAbove > 0.05 * M.CELLS.gap, `${where}: each moving finger clear of both fixed fingers`);
        t.near((gapBelow - gapAbove) / (gapBelow + gapAbove), M.SHARE * now.share[cell.axis], 1e-9, `${where}: the drawn divider is 60 times the sag over the gap`);
        t.near(gapBelow + gapAbove, 2 * M.CELLS.gap, 1e-12, `${where}: the two gaps together unchanged`);
        t.near(finger.scale.y, M.CELLS.thickness, 1e-15, 'the finger’s thickness');
      }
      for (const spring of cell.springs) {
        const p = spring.geometry.attributes.position.array, n = M.CELLS.segments;
        const mid = i => [(p[6 * i] + p[6 * i + 3]) / 2, (p[6 * i + 1] + p[6 * i + 4]) / 2];
        t.near(mid(0)[0], spring.side * M.CELLS.anchor[0], 2e-6, `${where}: the spring anchored`);
        t.near(mid(0)[1], spring.end * M.CELLS.spine[1], 2e-6, `${where}: still at its anchor`);
        t.near(mid(n - 1)[0], spring.side * M.CELLS.spine[0], 2e-6, `${where}: the spring meets the spine`);
        t.near(mid(n - 1)[1], spring.end * M.CELLS.spine[1] + drop, 2e-6, `${where}: and moves with the mass`);
        for (let i = 0; i < n; i++) {
          const k = i / (n - 1);
          t.near(mid(i)[1], spring.end * M.CELLS.spine[1] + drop * (3 * k * k - 2 * k ** 3), 2e-6, `${where}: the spring bends as a guided beam`);
          t.near(p[6 * i + 4] - p[6 * i + 1], M.CELLS.beam, 2e-6, `${where}: the spring’s width`);
          counts.points++;
        }
      }
    }
    const steady = Math.hypot(plan.still.x, plan.still.y);
    t.near(T.sagArrow.userData.length, steady * M.CELLS.arrow, 1e-12, `${where}: the sag arrow as long as the steady reading`);
    t.ok(T.sagArrow.visible === steady > 1e-9, `${where}: no sag arrow in free fall`);
    if (steady > 1e-9) {
      const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(T.sagArrow.quaternion);
      t.near(direction.x, -plan.still.x / steady, 1e-9, `${where}: the sag arrow pointing down, in the phone’s axes`);
      t.near(direction.y, -plan.still.y / steady, 1e-9, `${where}: the sag arrow pointing down, in the phone’s axes`);
    }

    // The chart.
    const guideX = pointsOf(T.guideX), guideY = pointsOf(T.guideY);
    t.ok(guideX.length === P.DECLARED.samples && guideY.length === P.DECLARED.samples, `${where}: a guide for the whole buzz`);
    t.ok(plan.chart[0].t === 0 && Math.abs(plan.chart.at(-1).t - plan.duration) < 1e-15, `${where}: the chart’s samples run from the buzz’s start to its end`);
    t.near(guideX.at(-1)[0], pointsOf(T.chartFrame)[1][0], 2e-6, `${where}: the guide reaches the frame’s right edge`);
    plan.chart.forEach((sample, i) => {
      t.near(guideX[i][0], M.chartX(plan, sample.t), 2e-6, 'the guide’s time');
      t.near(guideX[i][1], M.chartY(sample.x), 2e-6, 'the x guide’s reading');
      t.near(guideY[i][1], M.chartY(sample.y), 2e-6, 'the y guide’s reading');
      t.ok(Math.abs(sample.x) < A.range && Math.abs(sample.y) < A.range, 'inside the ±3 g range, so the chart never clips');
      worstFill.x = Math.max(worstFill.x, Math.abs(sample.x));
      worstFill.y = Math.max(worstFill.y, Math.abs(sample.y));
      counts.points += 2;
    });
    const curveX = pointsOf(T.curveX), curveY = pointsOf(T.curveY), shown = plan.chart.filter(sample => sample.t < time);
    if (time > 0) {
      t.ok(curveX.length === shown.length + 1 && curveY.length === shown.length + 1, `${where}: dark as far as the clock has run`);
      const live = P.chartAt(plan, time);
      t.near(curveX.at(-1)[0], M.chartX(plan, time), 2e-6, `${where}: the dark curve ends at the clock`);
      t.near(curveX.at(-1)[1], M.chartY(live.x), 2e-6, `${where}: the x curve ends at the reading`);
      t.near(curveY.at(-1)[1], M.chartY(live.y), 2e-6, `${where}: the y curve ends at the reading`);
      shown.forEach((sample, i) => t.near(curveY[i][1], M.chartY(sample.y), 2e-6, 'the dark curve on the guide'));
    } else {
      t.ok(curveX.length === 0 && curveY.length === 0 && !T.curveX.visible && !T.curveY.visible, `${where}: nothing dark before Play`);
    }
    const cursor = pointsOf(T.cursors);
    t.ok(cursor.length === (now.running ? 8 : 0), `${where}: cursors only while the buzz runs`);
    if (now.running) {
      const live = P.chartAt(plan, time);
      t.near(cursor[0][1], M.chartY(live.x), 2e-6, `${where}: the x cursor on its reading`);
      t.near(cursor[4][1], M.chartY(live.y), 2e-6, `${where}: the y cursor on its reading`);
    }

    // The motor.
    t.near(T.rotor.rotation.z, now.angle, 1e-12, `${where}: the weight turned`);
    t.near(T.forceArrow.userData.length, now.running ? plan.motor.force * M.MOTORVIEW.force : 0, 1e-12, `${where}: the pull drawn only while the motor turns`);
    if (now.running) {
      const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(T.forceArrow.quaternion), dot = sys(T.centroidDot).sub(sys(T.motor)).setZ(0).normalize();
      t.near(direction.x, Math.cos(now.angle), 1e-9, `${where}: the pull toward the weight`);
      t.near(direction.y, Math.sin(now.angle), 1e-9, `${where}: the pull toward the weight`);
      t.near(dot.x, direction.x, 1e-9, `${where}: through the weight’s center of mass`);
      t.near(dot.y, direction.y, 1e-9, `${where}: through the weight’s center of mass`);
    }

    // Parts kept apart, and leaders clear of what they pass.
    const boxes = {phone: boxOf(T.phone, inverse), cellX: boxOf(T.cells[0].group, inverse), cellY: boxOf(T.cells[1].group, inverse), arrow: boxOf(T.sagArrow, inverse), output: boxOf(T.output, inverse), motor: boxOf(T.motor, inverse), touch: boxOf(T.touch, inverse)};
    const names = Object.keys(boxes);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      if (boxes[names[i]].isEmpty() || boxes[names[j]].isEmpty()) continue;
      t.ok(apart(boxes[names[i]], boxes[names[j]], 0.05), `${where}: ${names[i]} and ${names[j]} kept apart`);
    }
    const clear = (a, b, keys) => keys.every(key => boxes[key].isEmpty() || !crosses(a, b, boxes[key], 0.02));
    t.ok(clear(leader[0], leader[1], ['output', 'motor', 'cellY', 'arrow', 'touch']), `${where}: the accelerometer’s leader crosses nothing`);
    t.ok(clear(leader[2], leader[3], ['cellX', 'cellY', 'arrow', 'output', 'touch']) && clear(leader[4], leader[5], ['cellX', 'cellY', 'arrow', 'output', 'touch']), `${where}: the motor’s leader crosses nothing`);
  }
}
t.ok(worstFill.y > 2.5 && worstFill.y < A.range, 'the readings reach well into the range without leaving it');

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const def = P.phonePlan({}), lifted = P.phonePlan({lift: 1}), dropped = P.phonePlan({lift: -1}), tested = P.phonePlan({filter: 0.1}), largest = P.phonePlan({filter: 4.7}), full = P.phonePlan({drive: 3.8}), starting = P.phonePlan({drive: 2.3});
const nm = meters => meters * 1e9, swingOf = plan => plan.gain * plan.buzz;
const quarter = plan => {
  // The y output’s lag behind the x output, found from whole periods of the chart function.
  const period = 1 / plan.motor.hz, n = 4000;
  let sx = 0, cx = 0, sy = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const time = 4 * period * i / n, out = P.chartAt(plan, time), phase = plan.motor.omega * time;
    sx += (out.x - plan.still.x) * Math.sin(phase); cx += (out.x - plan.still.x) * Math.cos(phase);
    sy += (out.y - plan.still.y) * Math.sin(phase); cy += (out.y - plan.still.y) * Math.cos(phase);
  }
  return deg(Math.atan2(sx, cx) - Math.atan2(sy, cy)) * -1;
};
const threshold = Math.max(...Array.from({length: 19}, (_, i) => 5 * i).filter(turn => !P.phonePlan({turn}).landscape));
t.ok(threshold === 45 && P.phonePlan({turn: 50}).landscape, 'portrait up to 45°, landscape from 50°');
const periodMs = 60000 / K.speed;

checkTrialNumbers(L.smartphoneLesson, {
  'Touch the screen': s => {
    const other = controller(s.values.across, s.values.along);
    t.ok(s.touch.strongest.j === other.j && s.touch.strongest.i === other.i, 'the trial’s strongest crossing found again');
    return {5: other.j + 1, 6: other.i + 1, 68: 100 * other.share, '26.0': other.found.x, '49.8': other.found.y, '0.24': other.error};
  },
  'Halfway between two rows': s => {
    const other = controller(s.values.across, s.values.along), above = other.shares[(other.i + 1) * W.columns + other.j];
    t.near(s.values.along, (other.i + 1) * pitchY, 1e-12, 'the fingertip exactly halfway between two rows');
    t.near(above, other.share, 1e-12, 'both crossings change alike');
    t.ok(s.touch.strongest.i === other.i, 'the lower taken as the strongest');
    return {'8.5': pitchY, 54: 100 * other.share, '0.07': other.error};
  },
  'Just past a row': s => {
    const other = controller(s.values.across, s.values.along);
    t.ok(other.found.y < s.values.along && other.found.y > (other.i + 0.5) * pitchY && Math.abs(other.error - worstTouch) < 0.005 && pitchY > W.typical, 'found short of the fingertip, toward the row, about as far off as anywhere');
    return {'2.25': s.values.along - (other.i + 0.5) * pitchY, 6: other.i + 1, '0.31': other.error};
  },
  'Hold it upright': s => ({'1.00': s.still.y, '0.00': s.still.x, '8.2': nm(-s.stillSag.y), '0.55': 100 * -s.stillSag.y / s.gap, '1.5': s.gap * 1e6, '1.800': s.stillVolts.y}),
  'Turn it sideways': s => { t.ok(s.landscape && s.stillSag.x < 0 && Math.abs(s.stillSag.y) < 1e-24, 'sideways: the x mass sags and the screen turns'); return {'1.00': s.still.x, '0.00': Math.abs(s.still.y)}; },
  'Let it fall': s => { t.ok(s.stillSag.x === 0 && s.stillSag.y === 0 && s.still.x === 0, 'falling: both masses in the middle'); return {'0.00': s.still.y}; },
  'Buzz it': s => { t.near(Math.max(...s.chart.map(sample => sample.y)) - s.still.y, swingOf(s), 2e-3, 'the drawn swing is the quoted one'); return {'11,000': s.motor.rpm, 183: s.motor.hz, '0.50': s.buzz, '1,058': s.cutoff, 99: 100 * s.gain, '0.49': swingOf(s)}; },
}, run, t);
checkTrialNumbers(L.accelerometerLesson, {
  'Hold it upright': s => ({'8.2': nm(-s.stillSag.y), '1.4918': 1e6 * (s.gap + s.stillSag.y), '1.5082': 1e6 * (s.gap - s.stillSag.y), '1.00': s.still.y, '1.800': s.stillVolts.y}),
  'Just past halfway': s => { t.ok(s.landscape, 'landscape at 50°'); return {'0.77': s.still.x, '0.64': s.still.y, 45: threshold}; },
  'Push it up': s => ({'2.00': s.still.y, '16.4': nm(-s.stillSag.y), '1.09': 100 * -s.stillSag.y / s.gap, '2.100': s.stillVolts.y, 3: A.range}),
  'Let it fall': s => { t.ok(s.stillVolts.x === s.stillVolts.y, 'both outputs alike'); return {'0.00': s.still.y, '1.500': s.stillVolts.y}; },
  'The sheet’s test capacitor': s => { t.near(s.values.filter * 1e-6, A.tested, 1e-18, 'the sheet’s test capacitor'); return {'0.1': s.values.filter, 50: s.cutoff, 183: s.motor.hz, 26: 100 * s.gain, 75: deg(s.lag), '1.34': 1000 * s.noise}; },
  'The largest capacitor': s => { t.ok(s.values.filter === P.CAPACITORS[3], 'the largest'); return {1: s.cutoff, '0.6': 100 * s.gain, '0.20': 1000 * s.noise}; },
}, run, t);
checkTrialNumbers(L.vibrationMotorLesson, {
  'Buzz': s => ({'3.0': s.values.drive, '11,000': s.motor.rpm, 183: s.motor.hz, '0.74': s.motor.force}),
  'Watch the phone shake': s => ({150: P.DECLARED.phone, '0.50': s.buzz, '3.70': 1e6 * s.shake, '2,000': M.SHAKE, '7.4': 1e3 * s.shake * M.SHAKE}),
  'Full voltage': s => { t.near(s.shake, def.shake, 1e-18, 'the circle the same at any speed'); return {'13,933': s.motor.rpm, '1.18': s.motor.force, '0.80': s.buzz, '3.70': 1e6 * s.shake}; },
  'Just enough to start': s => ({'8,433': s.motor.rpm, 141: s.motor.hz, '0.43': s.motor.force}),
  'Too little': s => { t.ok(!s.motor.spinning && s.buzz === 0, 'the motor does not start'); return {}; },
  'What the phone feels': s => ({'0.49': swingOf(s), 90: quarter(s)}),
}, run, t);

// Free text: each snippet computed, and every number in the text inside a checked snippet.
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
t.ok(P.DECLARED.q === 0.5, 'damped critically, as the limits say');
const accelerometerSnippets = {
  [`sense gaps of ${f1(P.DECLARED.gap)} μm, a proof mass of ${f0(P.DECLARED.proofMass * 1e9)} μg damped critically`]: 'sense gaps of 1.5 μm, a proof mass of 1 μg damped critically',
  [`a temperature of ${f0(P.DECLARED.kelvin - 273.15)} °C`]: 'a temperature of 25 °C',
};
const motorSnippets = {
  [`a phone of ${f0(P.DECLARED.phone)} g that shakes`]: 'a phone of 150 g that shakes',
  [`sheet’s ${f1(K.amplitude)} G taken as the peak`]: 'sheet’s 1.0 G taken as the peak',
  [`starting at ${f1(K.start)} V`]: 'starting at 2.3 V',
  [`tungsten carbide ${f1(P.DECLARED.thickness)} mm thick, sized to give that ${f1(K.amplitude)} G`]: 'tungsten carbide 1.5 mm thick, sized to give that 1.0 G',
  [`The buzz lasts ${f0(P.DECLARED.buzz * 1000)} ms`]: 'The buzz lasts 100 ms',
};
const clockSnippet = {[`The motor turns ${P.DECLARED.slow} times slower here than it does: the buzz of ${f0(def.duration * 1000)} ms takes ${f0(def.duration * P.DECLARED.slow)} s, and each turn at ${f0(K.speed)} rpm, ${f1(periodMs)} ms, takes ${f2(periodMs / 1000 * P.DECLARED.slow)} s`]: 'The motor turns 100 times slower here than it does: the buzz of 100 ms takes 10 s, and each turn at 11,000 rpm, 5.5 ms, takes 0.55 s'};
covered(L.accelerometerLimits, accelerometerSnippets, 'accelerometer limits');
covered(L.motorLimits, motorSnippets, 'motor limits');

// Smartphone.
expectNone(L.smartphoneLesson, 'Smartphone');
const touchSnippets = {
  [`${W.columns}-by-${W.rows} array laid over a screen of ${f0(P.DECLARED.screen[0])} by ${f0(P.DECLARED.screen[1])} mm`]: '12-by-16 array laid over a screen of 66 by 136 mm',
  [`a spread of ${f0(P.DECLARED.spread)} mm, the fingertip’s radius`]: 'a spread of 4 mm, the fingertip’s radius',
  'AN2934': 'AN2934',
  [`at least ${P.PHONE_DOMAINS.across[0]} mm from the screen’s sides and ${P.PHONE_DOMAINS.along[0]} mm from its top and bottom`]: 'at least 12 mm from the screen’s sides and 9 mm from its top and bottom',
};
covered(L.touchLimits, touchSnippets, 'touch limits');
covered(L.smartphoneLesson.deeper[0].body, {
  [`a ${W.columns}-by-${W.rows} array has ${W.capacitors}`]: 'a 12-by-16 array has 192',
  [`this ${f0(P.DECLARED.screen[0])} by ${f0(P.DECLARED.screen[1])} mm screen, its ${W.rows} driving rows are ${f1(pitchY)} mm apart and its ${W.columns} sensing columns ${f1(pitchX)} mm apart`]: 'this 66 by 136 mm screen, its 16 driving rows are 8.5 mm apart and its 12 sensing columns 5.5 mm apart',
}, 'Smartphone deeper 1');
covered(L.smartphoneLesson.deeper[1].body, {
  'AN2934': 'AN2934',
  [`a disc ${N.finger[0]} to ${N.finger[1]} mm across, ${N.typical} mm typically, and calls an electrode pitch of about ${N.ideal} mm ideal`]: 'a disc 5 to 10 mm across, 8 mm typically, and calls an electrode pitch of about 5 mm ideal',
  [`The columns’ ${f1(pitchX)} mm keeps that; the rows’ ${f1(pitchY)} mm, inside the note’s range of ${N.pitch[0]} to ${N.pitch[2]} mm`]: 'The columns’ 5.5 mm keeps that; the rows’ 8.5 mm, inside the note’s range of 4 to 10 mm',
  [`within ${f2(worstTouch)} mm of the fingertip’s center`]: 'within 0.31 mm of the fingertip’s center',
}, 'Smartphone deeper 2');
covered(L.smartphoneLesson.deeper[2].body, {
  'AN2934': 'AN2934',
  [`through the body, ${N.body[0]} to ${N.body[1]} pF`]: 'through the body, 100 to 200 pF',
  [`twice the pitch apart: ${f0(N.apart * pitchX)} mm across this grid and ${f0(N.apart * pitchY)} mm along it`]: 'twice the pitch apart: 11 mm across this grid and 17 mm along it',
}, 'Smartphone deeper 3');
covered(L.smartphoneLesson.deeper[3].body, {
  [`reads about ${SRC.accelerometerPage.rest} g upward`]: 'reads about 1 g upward',
  [`y axis reads ${f2(def.still.y)} g`]: 'y axis reads 1.00 g',
  [`pushed upward at ${f0(lifted.values.lift)} g reads ${f2(lifted.still.y)} g`]: 'pushed upward at 1 g reads 2.00 g',
  [`a dropped phone reads ${f2(dropped.still.y)} g`]: 'a dropped phone reads 0.00 g',
}, 'Smartphone deeper 4');
covered(L.smartphoneLesson.deeper[4].body, {
  [`a sensor resonant frequency of ${f1(A.resonance / 1000)} kHz, so ${f0(SRC.accelerometerPage.rest)} g sags its masses ${f2(nm(def.sagPerG))} nm`]: 'a sensor resonant frequency of 5.5 kHz, so 1 g sags its masses 8.21 nm',
  [`a sense gap of ${f1(P.DECLARED.gap)} μm that is ${f2(100 * def.sagPerG / def.gap)}%`]: 'a sense gap of 1.5 μm that is 0.55%',
  [`drawn ${M.SHARE} times its share of the gap`]: 'drawn 60 times its share of the gap',
}, 'Smartphone deeper 5');
covered(L.smartphoneLesson.deeper[5].body, {
  'AB-004': 'AB-004', 'AB-027': 'AB-027',
  [`${f1(K.amplitude)} G on a ${K.block} g block at ${f1(K.rated)} V and ${f0(K.speed)} rpm, a force of ${f2(def.motor.force)} N, so its weight’s mass times its offset is ${f2(P.MOMENT * 1e6)} g·mm`]: '1.0 G on a 75 g block at 3.0 V and 11,000 rpm, a force of 0.74 N, so its weight’s mass times its offset is 0.55 g·mm',
  [`tungsten carbide, ${f2(SRC.pmd.tungstenCarbide)} g/cm³`]: 'tungsten carbide, 15.63 g/cm³',
  [`${f1(P.DECLARED.thickness)} mm thick, that is a weight ${f2(P.WEIGHT.radius * 1000)} mm in radius and ${f2(P.WEIGHT.mass * 1000)} g, its center of mass ${f2(P.WEIGHT.centroid * 1000)} mm from the shaft`]: '1.5 mm thick, that is a weight 3.29 mm in radius and 0.40 g, its center of mass 1.39 mm from the shaft',
}, 'Smartphone deeper 6');
covered(L.smartphoneLesson.limits, {
  [`its shaking ${f0(M.SHAKE)} times larger`]: 'its shaking 2,000 times larger',
  [`the touch grid under the fingertip ${f0(M.timesLarger(M.TOUCH_MM))} times larger`]: 'the touch grid under the fingertip 3 times larger',
  [`movement ${M.SHARE} times its share of the gap`]: 'movement 60 times its share of the gap',
  [`the motor ${f0(M.timesLarger(M.MOTOR_MM))} times larger`]: 'the motor 10 times larger',
  [`The motor turns ${P.DECLARED.slow} times slower`]: 'The motor turns 100 times slower',
  ...touchSnippets, ...accelerometerSnippets, ...motorSnippets,
}, 'Smartphone limits');
{
  const pastRow = L.smartphoneLesson.tryIt.find(trial => trial.title === 'Just past a row').values, past = controller(pastRow.across, pastRow.along);
  const nearest = Math.hypot((past.j + 0.5) * pitchX - pastRow.across, (past.i + 0.5) * pitchY - pastRow.along);
  covered(L.smartphoneLesson.quiz.explanation, {
    [`at ${f0(pastRow.along)} mm up, the nearest crossing alone would put the touch ${f2(nearest)} mm off`]: 'at 49 mm up, the nearest crossing alone would put the touch 2.57 mm off',
    [`finds the touch ${f2(past.error)} mm from the fingertip’s center`]: 'finds the touch 0.31 mm from the fingertip’s center',
  }, 'Smartphone quiz');
}

// Accelerometer.
expectNone(L.accelerometerLesson, 'Accelerometer');
covered(L.accelerometerLesson.deeper[0].body, {[`reads about ${SRC.accelerometerPage.rest} g upward`]: 'reads about 1 g upward'}, 'Accelerometer deeper 1');
{
  const hz = def.motor.hz, [critical, none] = def.response;
  covered(L.accelerometerLesson.deeper[1].body, {
    [`the sheet’s ${f1(A.resonance / 1000)} kHz alone sets ${f2(nm(def.sagPerG))} nm for each g`]: 'the sheet’s 5.5 kHz alone sets 8.21 nm for each g',
    [`A proof mass of ${f0(P.DECLARED.proofMass * 1e9)} μg would need a spring of ${f2(P.STIFFNESS)} N/m and feel ${f1(P.DECLARED.proofMass * SRC.g * 1e9)} nN at ${f0(SRC.accelerometerPage.rest)} g`]: 'A proof mass of 1 μg would need a spring of 1.19 N/m and feel 9.8 nN at 1 g',
    [`At the buzz’s ${f0(hz)} Hz, ${f0(A.resonance / hz)} times below resonance, the mass follows within ${f2(100 * Math.max(1 - critical, none - 1))}%`]: 'At the buzz’s 183 Hz, 30 times below resonance, the mass follows within 0.11%',
  }, 'Accelerometer deeper 2');
}
covered(L.accelerometerLesson.deeper[2].body, {
  'square waves 180° out of phase': 'square waves 180° out of phase',
  [`giving ${f0(A.sensitivity[1] * 1000)} mV for each g about ${f1(A.zero[1])} V at ${f0(A.supply)} V`]: 'giving 300 mV for each g about 1.5 V at 3 V',
}, 'Accelerometer deeper 3');
covered(L.accelerometerLesson.deeper[3].body, {
  '√(4kBTωn/(Qm))': '√(4kBTωn/(Qm))',
  [`${f0(P.thermalNoise() * 1e6)} μg/√Hz for a proof mass of ${f0(P.DECLARED.proofMass * 1e9)} μg, critically damped at ${f0(P.DECLARED.kelvin - 273.15)} °C, against the sheet’s ${f0(A.noise * 1e6)} μg/√Hz`]: '109 μg/√Hz for a proof mass of 1 μg, critically damped at 25 °C, against the sheet’s 150 μg/√Hz',
  [`shakes ${f1(Math.sqrt(P.BOLTZMANN * P.DECLARED.kelvin / P.STIFFNESS) * 1e12)} pm rms`]: 'shakes 58.7 pm rms',
}, 'Accelerometer deeper 4');
covered(L.accelerometerLesson.deeper[4].body, {
  [`its ${f0(A.resistor / 1000)} kΩ resistor`]: 'its 32 kΩ resistor',
  [`1/(2π × ${f0(A.resistor / 1000)} kΩ × C)`]: '1/(2π × 32 kΩ × C)',
  'gain as 1/√2': 'gain as 1/√2',
  [`noise factor of ${A.noiseFactor} is π/2, ${f2(Math.PI / 2)}`]: 'noise factor of 1.6 is π/2, 1.57',
}, 'Accelerometer deeper 5');
covered(L.accelerometerLesson.deeper[5].body, {
  [`a typical change of ${A.selfTest} mV on y, which at ${f0(A.sensitivity[1] * 1000)} mV for each g reads as ${f2(A.selfTest / (A.sensitivity[1] * 1000))} g`]: 'a typical change of 325 mV on y, which at 300 mV for each g reads as 1.08 g',
  [`shocks of ${f0(A.shock)} g and measures at least ${A.range} g each way`]: 'shocks of 10,000 g and measures at least 3 g each way',
}, 'Accelerometer deeper 6');
covered(L.accelerometerLesson.limits, {[`movement ${M.SHARE} times its share of the gap`]: 'movement 60 times its share of the gap', ...accelerometerSnippets}, 'Accelerometer limits');
covered(L.accelerometerLesson.quiz.explanation, {[`the sheet’s ${f1(A.resonance / 1000)} kHz gives ${f2(nm(def.sagPerG))} nm for each g`]: 'the sheet’s 5.5 kHz gives 8.21 nm for each g'}, 'Accelerometer quiz');

// Vibration motor.
expectNone(L.vibrationMotorLesson, 'Vibration motor');
covered(L.vibrationMotorLesson.deeper[0].body, {
  'AB-004': 'AB-004',
  [`From ${f1(K.rated)} V to ${f1(full.values.drive)} V the speed rises ${f0(100 * (full.motor.rpm / def.motor.rpm - 1))}% and the force ${f0(100 * (full.motor.force / def.motor.force - 1))}%`]: 'From 3.0 V to 3.8 V the speed rises 27% and the force 60%',
}, 'Vibration motor deeper 1');
t.near(2 * Math.sin(Math.PI / 2) / (3 * Math.PI / 2), 4 / (3 * Math.PI), 1e-15, '2 sin θ/(3θ) at θ = π/2 is 4/(3π)');
covered(L.vibrationMotorLesson.deeper[1].body, {
  'AB-027': 'AB-027',
  [`density of ${f2(SRC.pmd.tungstenCarbide)} g/cm³`]: 'density of 15.63 g/cm³',
  '2r sin θ/(3θ)': '2r sin θ/(3θ)',
  'θ = π/2, that is 4r/(3π)': 'θ = π/2, that is 4r/(3π)',
  [`a half disk ${f1(P.DECLARED.thickness)} mm thick`]: 'a half disk 1.5 mm thick',
  [`${f2(P.WEIGHT.radius * 1000)} mm in radius and ${f2(P.WEIGHT.mass * 1000)} g, its center of mass ${f2(P.WEIGHT.centroid * 1000)} mm out, together ${f2(P.MOMENT * 1e6)} g·mm`]: '3.29 mm in radius and 0.40 g, its center of mass 1.39 mm out, together 0.55 g·mm',
}, 'Vibration motor deeper 2');
covered(L.vibrationMotorLesson.deeper[2].body, {
  [`${f1(K.amplitude)} G on a ${K.block} g block at ${f1(K.rated)} V`]: '1.0 G on a 75 g block at 3.0 V',
  'AB-004': 'AB-004',
  [`on a ${SRC.pmd.mass} g mass`]: 'on a 100 g mass',
  [`would give ${f2(K.amplitude * K.block / SRC.pmd.mass)} G, and on a ${f0(P.DECLARED.phone)} g phone ${f2(def.buzz)} g`]: 'would give 0.75 G, and on a 150 g phone 0.50 g',
}, 'Vibration motor deeper 3');
covered(L.vibrationMotorLesson.deeper[3].body, {
  [`this ${K.diameter} mm motor at ${f0(K.speed)} ± ${f0(K.tolerance)} rpm and ${K.current} mA at ${f1(K.rated)} V`]: 'this 10 mm motor at 11,000 ± 3,000 rpm and 75 mA at 3.0 V',
  [`SparkFun’s ${Q.diameter} mm coin motor at ${f0(Q.speed)} ± ${f0(Q.tolerance)} rpm and ${Q.current} mA at ${f1(Q.rated)} V`]: 'SparkFun’s 10 mm coin motor at 13,000 ± 3,000 rpm and 60 mA at 3.0 V',
  [`between ${SRC.pmd.erm.hz[0]} and ${SRC.pmd.erm.hz[1]} Hz`]: 'between 30 and 500 Hz',
}, 'Vibration motor deeper 4');
covered(L.vibrationMotorLesson.deeper[4].body, {
  [`gives them ${SRC.pmd.lra.hz[0]} to ${SRC.pmd.lra.hz[1]} Hz, driven within ${SRC.pmd.tolerance} Hz`]: 'gives them 150 to 205 Hz, driven within 5 Hz',
  'AB-020': 'AB-020', 'C10-100': 'C10-100',
  [`start time of ${SRC.pmd.start} ms and stop time of ${SRC.pmd.stop} ms`]: 'start time of 5 ms and stop time of 275 ms',
}, 'Vibration motor deeper 5');
covered(L.vibrationMotorLesson.deeper[5].body, clockSnippet, 'Vibration motor deeper 6');
covered(L.vibrationMotorLesson.limits, {
  [`drawn ${f0(M.timesLarger(M.MOTOR_MM))} times larger and turns ${P.DECLARED.slow} times slower`]: 'drawn 10 times larger and turns 100 times slower',
  [`shaking is drawn ${f0(M.SHAKE)} times larger`]: 'shaking is drawn 2,000 times larger',
  ...motorSnippets,
}, 'Vibration motor limits');
covered(L.vibrationMotorLesson.quiz.explanation, {[`At ${f1(full.values.drive)} V the motor turns ${f0(100 * (full.motor.rpm / def.motor.rpm - 1))}% faster than at ${f1(K.rated)} V and pulls ${f0(100 * (full.motor.force / def.motor.force - 1))}% harder, ${f2(full.motor.force)} N instead of ${f2(def.motor.force)} N`]: 'At 3.8 V the motor turns 27% faster than at 3.0 V and pulls 60% harder, 1.18 N instead of 0.74 N'}, 'Vibration motor quiz');
t.ok(f2(starting.motor.force) === '0.43' && f0(starting.motor.hz) === '141' && f2(largest.gain * 100) === '0.58', 'the start and the largest filter as quoted in trials');

// The model’s own words.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {[`under your fingertip ${f0(M.timesLarger(M.TOUCH_MM))} times larger`]: 'under your fingertip 3 times larger', [`cut open ${f0(M.timesLarger(M.MOTOR_MM))} times larger`]: 'cut open 10 times larger', [`it turns ${P.DECLARED.slow} times slower`]: 'it turns 100 times slower'}, 'system text');
covered(partText('touch'), {[`drawn ${f0(M.timesLarger(M.TOUCH_MM))} times larger in the phone’s own axes: the ${2 * P.DECLARED.window[0] + 1} sensing columns (green) and ${2 * P.DECLARED.window[1] + 1} driving rows`]: 'drawn 3 times larger in the phone’s own axes: the 5 sensing columns (green) and 3 driving rows', [`the ${f0(N.typical)} mm fingertip`]: 'the 8 mm fingertip'}, 'touch text');
covered(partText('phone'), {[`A phone of ${f0(P.DECLARED.phone)} g drawn at true size, ${f0(M.PHONE.body[1])} mm tall`]: 'A phone of 150 g drawn at true size, 150 mm tall', [`the ${f0(A.size[0])} mm accelerometer and the ${f0(K.diameter)} mm motor`]: 'the 4 mm accelerometer and the 10 mm motor', [`drawn ${f0(M.SHAKE)} times larger`]: 'drawn 2,000 times larger', [`touch grid’s ${W.columns} sensing columns (faint green) and ${W.rows} driving rows`]: 'touch grid’s 12 sensing columns (faint green) and 16 driving rows'}, 'phone text');
covered(partText('accelerometer'), {[`drawn ${M.SHARE} times its true share`]: 'drawn 60 times its true share'}, 'accelerometer text');
covered(partText('output'), {[`a buzz of ${f0(def.duration * 1000)} ms, from −${A.range} g at the bottom to +${A.range} g at the top`]: 'a buzz of 100 ms, from −3 g at the bottom to +3 g at the top', [`every ${f0(M.CHART.tickEvery * 1000)} ms`]: 'every 10 ms'}, 'output text');
covered(partText('motor'), {[`drawn ${f0(M.timesLarger(M.MOTOR_MM))} times larger: ${f0(K.diameter)} mm across, with a half disk of tungsten carbide ${f2(P.WEIGHT.radius * 1000)} mm in radius`]: 'drawn 10 times larger: 10 mm across, with a half disk of tungsten carbide 3.29 mm in radius', [`It turns ${P.DECLARED.slow} times slower`]: 'It turns 100 times slower'}, 'motor text');
t.ok(Math.abs(M.CHART.tickEvery * 1000 - 10) < 1e-9 && pointsOf(T.ticks).length === 2 * (Math.round(def.duration / M.CHART.tickEvery) - 1), 'a tick every 10 ms');

{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Touch,Crossings,Reads,Screen,Proof masses,Gaps,Noise,Motor,Buzz,Slowed', 'eleven readings');
  const touchNow = controller(P.PHONE_DEFAULTS.across, P.PHONE_DEFAULTS.along);
  t.ok(find('Your result').value.startsWith(`Ready · the touch found ${f2(touchNow.error)} mm from your fingertip;`) && find('Touch').value === `found at ${f1(touchNow.found.x)}, ${f1(touchNow.found.y)} mm` && find('Crossings').value === `${W.columns} by ${W.rows}, ${f0(W.capacitors)}`, 'the touch readings');
  checkQuotedText(find('Touch').hint, {
    'is 26 mm from the screen’s left edge and 50 mm from its bottom': `is ${f0(P.PHONE_DEFAULTS.across)} mm from the screen’s left edge and ${f0(P.PHONE_DEFAULTS.along)} mm from its bottom`,
    'sensing column 5 and driving row 6, changes by 68%': `sensing column ${touchNow.j + 1} and driving row ${touchNow.i + 1}, changes by ${f0(100 * touchNow.share)}%`,
    'finds the touch 0.24 mm from the fingertip’s center': `finds the touch ${f2(touchNow.error)} mm from the fingertip’s center`,
  }, t);
  checkQuotedText(find('Crossings').hint, {'16 driving rows, 8.5 mm apart, cross its 12 sensing columns, 5.5 mm apart, at 192 capacitors': `${W.rows} driving rows, ${f1(pitchY)} mm apart, cross its ${W.columns} sensing columns, ${f1(pitchX)} mm apart, at ${f0(W.capacitors)} capacitors`}, t);
  t.ok(find('Reads').value === 'x 0.00 g, y 1.00 g' && find('Screen').value === 'Portrait' && find('Proof masses').value === 'x 0.0 nm, y 8.2 nm' && find('Gaps').value === 'y: 1.4918 and 1.5082 μm' && find('Noise').value === '6.17 mg' && find('Motor').value === '11,000 rpm' && find('Buzz').value === '0.50 g' && find('Slowed').value === '100 times', 'the readings carry the lessons’ figures');
  checkQuotedText(find('Reads').hint, {'at 3 V its outputs sit at 1.500 V and 1.800 V: 1.5 V and 300 mV for each g': `at ${f0(A.supply)} V its outputs sit at ${f3(def.stillVolts.x)} V and ${f3(def.stillVolts.y)} V: ${f1(A.zero[1])} V and ${f0(A.sensitivity[1] * 1000)} mV for each g`}, t);
  checkQuotedText(find('Proof masses').hint, {'resonant frequency of 5.5 kHz makes that 8.21 nm for each g, 0.55% of a 1.5 μm gap': `resonant frequency of ${f1(A.resonance / 1000)} kHz makes that ${f2(nm(def.sagPerG))} nm for each g, ${f2(100 * def.sagPerG / def.gap)}% of a ${f1(P.DECLARED.gap)} μm gap`, 'drawn 60 times its share': `drawn ${M.SHARE} times its share`}, t);
  checkQuotedText(find('Gaps').hint, {'The y mass, sagging 8.2 nm, narrows one 1.5 μm gap': `The y mass, sagging ${f1(nm(def.sagPerG))} nm, narrows one ${f1(P.DECLARED.gap)} μm gap`, 'exactly the sag over the gap, 0.55%': `exactly the sag over the gap, ${f2(100 * def.sagPerG / def.gap)}%`}, t);
  checkQuotedText(find('Noise').hint, {'With 0.0047 μF and the chip’s 32 kΩ the bandwidth is 1,058 Hz, so the noise is 6.17 mg rms, what a sag of 50.7 pm would read': `With ${P.CAPACITORS[0]} μF and the chip’s ${f0(A.resistor / 1000)} kΩ the bandwidth is ${f0(def.cutoff)} Hz, so the noise is ${f2(def.noise * 1000)} mg rms, what a sag of ${f1(def.noiseSag * 1e12)} pm would read`}, t);
  checkQuotedText(find('Motor').hint, {'its sheet gives 11,000 rpm at 3.0 V': `its sheet gives ${f0(K.speed)} rpm at ${f1(K.rated)} V`, 'tungsten carbide 3.29 mm in radius weighing 0.40 g, pulls on the shaft with mrω² = 0.74 N': `tungsten carbide ${f2(P.WEIGHT.radius * 1000)} mm in radius weighing ${f2(P.WEIGHT.mass * 1000)} g, pulls on the shaft with mrω² = ${f2(def.motor.force)} N`}, t);
  checkQuotedText(find('Buzz').hint, {'shakes a phone of 150 g at 0.50 g, around a circle 3.70 μm in radius, drawn 2,000 times larger': `shakes a phone of ${f0(P.DECLARED.phone)} g at ${f2(def.buzz)} g, around a circle ${f2(def.shake * 1e6)} μm in radius, drawn ${f0(M.SHAKE)} times larger`, 'At 183 Hz the 1,058 Hz filter passes 99% of it': `At ${f0(def.motor.hz)} Hz the ${f0(def.cutoff)} Hz filter passes ${f0(100 * def.gain)}% of it`}, t);
  checkQuotedText(find('Slowed').hint, {'the buzz of 100 ms takes 10 s': `the buzz of ${f0(def.duration * 1000)} ms takes ${f0(def.duration * P.DECLARED.slow)} s`, 'drawn 10 times larger': `drawn ${f0(M.timesLarger(M.MOTOR_MM))} times larger`}, t);
  model.update({lift: -1, drive: 2.2, filter: 4.7, turn: 90});
  const off = model.getState().readings, offFind = label => off.find(item => item.label === label);
  t.ok(offFind('Motor').value === 'stopped' && offFind('Buzz').value === 'none' && offFind('Buzz').hint === 'With the motor stopped nothing shakes the phone.' && offFind('Screen').hint.includes('Falling, both axes read zero') && offFind('Reads').value === 'x 0.00 g, y 0.00 g' && offFind('Noise').value === '0.20 mg' && offFind('Gaps').value === 'y: 1.5000 and 1.5000 μm', 'falling, stopped and heavily filtered: what the readings say');
  model.reset();
  model.update({filter: 4.7});
  t.ok(model.getState().readings.find(item => item.label === 'Buzz').hint.includes('passes 0.6% of it'), 'a gain under 10% quoted to a tenth');
  model.reset();
  model.update({lift: -1});
  model.advance(Math.PI / def.motor.omega * P.DECLARED.slow);
  const falling = model.getState().readings;
  t.ok(/^x −\d/.test(falling.find(item => item.label === 'Reads').value) && !/-\d/.test(falling.map(item => item.value + (item.hint || '')).join(' ')), 'negative readings with a true minus sign');
}

for (const lesson of [L.smartphoneLesson, L.accelerometerLesson, L.vibrationMotorLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(trial => model.parts.some(item => item.id === trial.part) && trial.view === 'front' && trial.reset === true && trial.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part named is a part the model has');
  t.ok(lesson.steps.length === 5 && lesson.deeper.length === 6, 'five steps and six deeper sections');
}
t.ok(studyLessons['Smartphone'] === L.smartphoneLesson, 'the smartphone’s lesson');
for (const [name, lesson, part] of [['Accelerometer', L.accelerometerLesson, 'accelerometer'], ['Vibration motor', L.vibrationMotorLesson, 'motor']]) {
  const component = houseComponents[name];
  t.ok(component.machine === 'Smartphone' && component.part === part && component.lesson === lesson && component.intro === lesson.simple && component.view === 'front' && component.isolate === false && component.values === undefined, `${name} routes to the smartphone’s ${part} with its own lesson`);
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) {
  const [lo, hi, step] = P.PHONE_DOMAINS[control.key];
  t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.PHONE_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`);
}
t.ok(model.controls.map(control => control.key).join() === 'across,along,turn,lift,drive,filter', 'six controls');
assert.deepEqual(model.controls.find(control => control.key === 'filter').options.map(option => [option.value, option.label]), P.FILTER_OPTIONS.map(option => [option.value, option.label]));
const drawing = () => [T.fingertip.position.toArray(), pointsOf(T.patchOutline), pointsOf(T.touchFound), T.handset.rotation.z, T.handset.position.x, T.landscape.visible, T.liftArrow.userData.length, T.cells.map(cell => cell.mass.position.y), T.sagArrow.userData.length, T.rotor.rotation.z, T.forceArrow.userData.length, pointsOf(T.guideY).slice(0, 60), pointsOf(T.curveY).slice(-3)];
checkControlsMove(model, drawing, m => m.advance(3), t);
checkRefusals(P.samplePhone, P.PHONE_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the buzz');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.005, 1e-15, 'a step of half a second buzzes 5 ms');
  t.ok(Math.abs(T.cells[0].mass.position.y) > 1e-6 && Math.abs(T.cells[1].mass.position.y - P.phonePlan({}).stillSag.y / P.phonePlan({}).gap * M.CELLS.gap * M.SHARE) > 1e-6, 'partway through the buzz the x mass moves as well, and the y mass off its steady sag');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through the buzz');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, 0.01, 1e-15, 'animation buzzes on by the time that passed, 100 times slower');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'output', 'the buzz done, with the chart to inspect');
  const held = JSON.stringify([T.rotor.rotation.z, T.handset.position.toArray(), T.cells.map(cell => cell.mass.position.y), pointsOf(T.curveY).length]);
  t.ok(T.forceArrow.userData.length === 0 && T.cells[1].mass.position.y === P.phonePlan({}).stillSag.y / P.phonePlan({}).gap * M.CELLS.gap * M.SHARE, 'stopped: no pull, and the mass back to its steady sag');
  model.animate(10);
  model.advance(50);
  t.ok(JSON.stringify([T.rotor.rotation.z, T.handset.position.toArray(), T.cells.map(cell => cell.mass.position.y), pointsOf(T.curveY).length]) === held, 'once done, the motor stays stopped');
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part), `${action.label} returns readings`); checkFinite(model.root, t); }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  for (const values of settings) {
    for (const time of [0, 1, 100]) {
      model.reset();
      model.update(values);
      model.advance(time);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')) && !/\b(centre|colour|grey|metre)\b/i.test(item.hint || ''), `reading text without dashes: ${item.label}`);
      checkFinite(model.root, t);
    }
  }
}
const released = checkDisposal((() => { const fresh = M.createSmartphoneModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS smartphone: ${t.count} checks, ${counts.steps} steps integrated, ${counts.quadrature} quadrature points, ${counts.poses} poses, ${counts.points} spring and chart points, ${counts.numbers} quoted numbers traced, ${counts.touch} touch positions, 3 lessons, ${released} resources released exactly once.`);

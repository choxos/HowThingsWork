// Virtual reality headset: the head's motions solved again from their
// boundary conditions, the gyroscope, the camera and the complementary filter
// run again in LaValle's rearranged form and held to closed forms, every
// frame rebuilt and held to what prediction can and cannot do, the lens
// traced again ray by ray, the eyes' aim found again from vectors, the
// drawing held to the state, and every number the two lessons quote held to
// the model.
import assert from 'node:assert/strict';
import {vrPlan, sampleVr, headYaw, minimumJerk, lensImage, viewSlope, rayThrough, eyesOn, CLOCKS, HEAD, SHAKE, LENS, GAINS, VR_DEFAULTS, VR_DOMAINS} from './vr-headset-physics.js';
import {createVrHeadsetModel, objectDirection, panelX, wrap, FACE, HEADSET, IMU_AT, CAMERA_AT, CHARTS, FRAME_ROWS, VIEW_ROWS, COLORS, LANDMARKS} from './vr-headset-model.js';
import {vrHeadsetLesson, headTrackingLesson} from './vr-headset-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

// The headset written again from its sources.
const t = tally(), DEG = Math.PI / 180, MM = 0.02;
const RATE = 1000, IMAGES = 60, FRAMES = 90, FLASH = 0.002, RUN = 3, START = 0.5, TURN = 60, TURN_TIME = 1, SWING = 25, SWING_TIME = 0.5;
const FOCAL = 45, RELIEF = 15, IPD = 63, COMFORT = 0.4, HALF_VIEW = 30, POINT = 20;
t.ok(CLOCKS.gyro === RATE && CLOCKS.camera === IMAGES && CLOCKS.frame === FRAMES && CLOCKS.flash === FLASH && CLOCKS.duration === RUN, 'clocks: LaValle’s 1,000 Hz gyroscope and 60 Hz camera, 90 frames a second lit for 2 ms, a 3 s run');
t.ok(HEAD.start === START && HEAD.turn === TURN && HEAD.turnTime === TURN_TIME && HEAD.swing === SWING && HEAD.swingTime === SWING_TIME, 'head motions');
t.ok(LENS.focal === FOCAL && LENS.relief === RELIEF && LENS.ipd === IPD && LENS.comfort === COMFORT && LENS.halfView === HALF_VIEW, 'lens, eyes and comfort');
assert.deepEqual([...GAINS], [0, 0.0001, 0.01], 'no correction, LaValle’s example gain and a firmer one');
assert.deepEqual([...SHAKE], [0, SWING, -SWING, SWING, -SWING, 0], 'the shake’s turning points');
t.add(2);

// 1. The head's motions. The blend is found again as the quintic with zero
// speed and zero acceleration at both ends, solved by elimination.
function solve(rows) {
  const a = rows.map(row => [...row]), n = a.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}
const quintic = solve([[1, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0], [0, 0, 2, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [0, 1, 2, 3, 4, 5, 0], [0, 0, 2, 6, 12, 20, 0]]);
[0, 0, 0, 10, -15, 6].forEach((c, i) => t.near(quintic[i], c, 1e-12, `minimum-jerk coefficient ${i}`));
const blend = s => [0, 1, 2].map(order => quintic.reduce((sum, c, i) => sum + (i >= order ? c * [1, i, i * (i - 1)][order] * s ** (i - order) : 0), 0));
for (let i = 0; i <= 400; i++) {
  const s = i / 400, mine = blend(s), theirs = minimumJerk(s);
  mine.forEach((value, order) => t.near(theirs[order], value, 1e-9, `minimum-jerk blend order ${order} at ${s}`));
}

function yawOf(motion, time) {
  if (motion === 2) return [0, 0, 0];
  let from = 0, to = TURN, begin = START, span = TURN_TIME;
  if (motion === 1) {
    const points = [0, SWING, -SWING, SWING, -SWING, 0];
    let swing = -1;
    for (let j = 0; j < points.length - 1; j++) if (time >= START + j * SWING_TIME) swing = j;
    if (swing < 0 || time >= START + (points.length - 1) * SWING_TIME) return [0, 0, 0];
    [from, to, begin, span] = [points[swing], points[swing + 1], START + swing * SWING_TIME, SWING_TIME];
  }
  const s = Math.min(1, Math.max(0, (time - begin) / span)), [x, dx, ddx] = blend(s);
  return [from + (to - from) * x, (to - from) * dx / span, (to - from) * ddx / span ** 2];
}
const peaks = [0, 1, 2].map(motion => {
  let rate = 0, acceleration = 0;
  for (let k = 0; k <= 12000; k++) {
    const time = k / 4000, mine = yawOf(motion, time), theirs = headYaw(motion, time);
    t.near(theirs.angle, mine[0], 1e-9, `motion ${motion}: yaw at ${time}`);
    t.near(theirs.rate, mine[1], 1e-7, `motion ${motion}: rate at ${time}`);
    t.near(theirs.acceleration, mine[2], 1e-5, `motion ${motion}: acceleration at ${time}`);
    if (k % 7 === 3) t.near((yawOf(motion, time + 1e-6)[0] - yawOf(motion, time - 1e-6)[0]) / 2e-6, mine[1], 1e-4, `motion ${motion}: rate is the yaw’s slope at ${time}`);
    rate = Math.max(rate, Math.abs(mine[1]));
    acceleration = Math.max(acceleration, Math.abs(mine[2]));
  }
  return {rate, acceleration};
});
t.near(yawOf(0, 1.5)[0], TURN, 1e-12, 'the turn ends 60° to the left');
t.near(peaks[0].rate, 15 / 8 * TURN / TURN_TIME, 1e-9, 'the turn peaks at 15/8 of its mean rate');
t.near(peaks[0].acceleration, 10 * Math.sqrt(3) / 3 * TURN / TURN_TIME ** 2, 0.05, 'the turn’s greatest acceleration');
t.near(peaks[1].rate, 15 / 8 * 2 * SWING / SWING_TIME, 1e-9, 'a swing of 50° in half a second peaks at 187.5°/s');
t.near(yawOf(1, RUN)[0], 0, 1e-12, 'the shake ends facing forward');
t.ok(peaks[2].rate === 0, 'holding still');

// 2. The gyroscope, the camera and the filter, run again. LaValle's filter
// θ̂c = αθ̂d + (1 − α)θ̂ is used as θ̂c = θ̂ − α(θ̂ − θ̂d), with θ̂ carried on
// from the previous corrected estimate by one reading.
const tracks = new Map();
function trackAgain(motion, offset, scale, correction) {
  const key = [motion, offset, scale, correction].join('|');
  if (tracks.has(key)) return tracks.get(key);
  const N = RUN * RATE, alpha = [0, 0.0001, 0.01][correction], b = 1 + scale / 100;
  const truth = Array.from({length: N + 1}, (_, k) => yawOf(motion, k / RATE)[0]), gyro = [offset], estimate = [truth[0]];
  for (let k = 1; k <= N; k++) {
    gyro.push(offset + b * (truth[k] - truth[k - 1]) * RATE);
    const reference = yawOf(motion, Math.floor(3 * k / 50) / IMAGES)[0], carried = estimate[k - 1] + gyro[k] / RATE;
    estimate.push(carried - alpha * (carried - reference));
  }
  const run = {N, alpha, b, truth, gyro, estimate};
  tracks.set(key, run);
  return run;
}
let trackRuns = 0;
for (const motion of [0, 1, 2]) for (const offset of [-2, -0.5, 0, 0.5, 2]) for (const scale of [-3, 0, 3]) for (const correction of [0, 1, 2]) {
  const values = {motion, offset, scale, correction}, plan = vrPlan(values), own = trackAgain(motion, offset, scale, correction), N = own.N;
  t.ok(plan.N === N, 'one reading a millisecond for 3 s');
  for (let k = 0; k <= N; k++) {
    t.near(plan.gyro[k], own.gyro[k], 1e-9, `${JSON.stringify(values)}: reading ${k}`);
    t.near(plan.estimate[k], own.estimate[k], 1e-9, `${JSON.stringify(values)}: estimate ${k}`);
    if (correction === 0) t.near(own.estimate[k], offset * k / RATE + own.b * own.truth[k], 1e-9, 'uncorrected, the estimate is a·t + b·θ');
    if (motion === 2 && correction > 0) t.near(own.estimate[k], offset / RATE * (1 - own.alpha) * (1 - (1 - own.alpha) ** k) / own.alpha, 1e-9, 'held still, the filter’s error follows its geometric series');
  }
  let worst = 0;
  for (let k = 0; k <= N; k++) if (Math.abs(own.estimate[k] - own.truth[k]) > Math.abs(worst)) worst = own.estimate[k] - own.truth[k];
  t.near(plan.worstDrift.value, worst, 1e-9, 'worst drift');
  t.near(plan.endDrift, own.estimate[N] - own.truth[N], 1e-9, 'drift at the end');
  trackRuns++;
}
const runs = [];
for (let k = 0, length = 0, image = 0; k <= RUN * RATE; k++) {
  const now = Math.floor(3 * k / 50);
  if (now !== image) { runs.push(length); image = now; length = 0; }
  length++;
}
t.ok(runs.every(length => length === 16 || length === 17), 'each camera image serves 16 or 17 readings');
assert.deepEqual([...new Set(runs)].sort(), [16, 17]);
t.add();
let maxAge = 0;
for (let k = 0; k <= RUN * RATE; k++) maxAge = Math.max(maxAge, (k - Math.floor(3 * k / 50) * 50 / 3) / RATE);
t.near(maxAge, 49 / 3 / 1000, 1e-12, 'the oldest image in use is 16⅓ ms old');
const settle = (offset, alpha) => {
  let error = 0;
  for (let k = 0; k < 60 / alpha; k++) error = (1 - alpha) * (error + offset / RATE);
  return error;
};
for (const offset of [0.5, 2]) for (const alpha of [0.0001, 0.01]) t.near(settle(offset, alpha), offset / RATE * (1 - alpha) / alpha, 1e-9, 'held still, a constant offset settles at a·Δt·(1 − α)/α');

// 3. Every frame, rebuilt, and held to what prediction can and cannot do.
let frameCount = 0;
for (const motion of [0, 1, 2]) for (const [offset, scale] of [[0, 0], [0.5, 3]]) for (const correction of [0, 1, 2]) for (let latency = 5; latency <= 100; latency += 5) for (const prediction of [0, 1]) {
  const values = {motion, offset, scale, correction, latency, prediction}, plan = vrPlan(values), own = trackAgain(motion, offset, scale, correction);
  const count = Math.floor((RUN * RATE - latency) * FRAMES / RATE) + 1;
  t.ok(plan.frames.length === count, `${JSON.stringify(values)}: ${count} frames light within the run`);
  let worst = null;
  for (let n = 0; n < count; n++) {
    const frame = plan.frames[n], stage = Math.floor(100 * n / 9), flash = n / FRAMES + latency / 1000, horizon = flash - stage / RATE;
    const shown = own.estimate[stage] + (prediction ? own.gyro[stage] * horizon : 0), [head] = yawOf(motion, flash), slip = shown - head;
    t.ok(frame.n === n && frame.stage === stage, 'frame index and the reading it starts from');
    t.near(frame.flash, flash, 1e-12, 'lights once the latency has passed');
    t.near(frame.horizon, horizon, 1e-12, 'from the reading to the light');
    t.near(frame.shown, shown, 1e-9, 'drawn for');
    t.near(frame.slip, slip, 1e-9, 'slip');
    if (!worst || Math.abs(slip) > Math.abs(worst.slip)) worst = {slip, flash};
    if (offset === 0 && scale === 0 && correction === 0) {
      const {rate, acceleration} = peaks[motion];
      if (prediction) t.ok(Math.abs(slip) <= acceleration * horizon / RATE + acceleration * horizon ** 2 / 2 + 1e-9, 'predicted at a reading’s mean rate, the miss is bounded by the head’s acceleration');
      else t.ok(Math.abs(slip) <= rate * horizon + 1e-9, 'unpredicted, the miss is bounded by the head’s speed times the horizon');
    }
    frameCount++;
  }
  t.near(Math.abs(plan.worstSlip.slip), Math.abs(worst.slip), 1e-9, 'worst frame');
  const chosen = Math.round((plan.worstSlip.flash - latency / 1000) * FRAMES);
  t.near(Math.abs(yawOf(motion, chosen / FRAMES + latency / 1000)[0] - (own.estimate[Math.floor(100 * chosen / 9)] + (prediction ? own.gyro[Math.floor(100 * chosen / 9)] * (chosen / FRAMES + latency / 1000 - Math.floor(100 * chosen / 9) / RATE) : 0))), Math.abs(worst.slip), 1e-9, 'the worst frame’s moment is a moment of the worst slip, whichever of equal swings it falls in');
}

// 4. The lens, traced ray by ray: a ray through the center and a ray parallel
// to the axis, bent by the thin lens, and their backward extensions crossed.
const cross = (p, d, q, e) => {
  const det = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(det) < 1e-15) return null;
  const s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / det;
  return [p[0] + s * d[0], p[1] + s * d[1]];
};
const bend = (height, slope) => slope - height / FOCAL;
const traced = screen => {
  const chief = [[0, 0], [1, bend(0, -POINT / screen)]], parallel = [[0, POINT], [1, bend(POINT, 0)]];
  const meet = cross(chief[0], chief[1], parallel[0], parallel[1]);
  return meet ? {distance: -meet[0], height: meet[1]} : {distance: Infinity, height: Infinity};
};
const pupilRay = (screen, pupil) => {
  const arrive = h => h + bend(h, (h - POINT) / screen) * RELIEF, h0 = arrive(0), h1 = arrive(1), lens = (pupil - h0) / (h1 - h0);
  return {lens, before: (lens - POINT) / screen, after: bend(lens, (lens - POINT) / screen)};
};
const ownSlope = screen => -pupilRay(screen, 0).after / POINT;
const screens = Array.from({length: 41}, (_, i) => 41 + i / 10);
for (const screen of screens) {
  const image = lensImage(screen), trace = traced(screen);
  if (screen === FOCAL) {
    t.ok(trace.distance === Infinity && image.distance === null && image.fromEye === null && image.magnification === null && image.focus === 0, 'at the focal length the rays leave parallel and the image is infinitely far');
  } else {
    t.near(image.distance, trace.distance, 1e-6 * trace.distance, `${screen} mm: virtual image distance`);
    t.near(image.magnification, trace.height / POINT, 1e-9 * trace.height, `${screen} mm: magnification`);
    t.near(image.focus, 1000 / (trace.distance + RELIEF), 1e-9, `${screen} mm: focus from the eye`);
  }
  for (const pupil of [-1.5, 0, 1.5]) {
    const theirs = rayThrough(screen, POINT, pupil), mine = pupilRay(screen, pupil);
    t.near(theirs.lens, mine.lens, 1e-9, 'where the ray meets the lens');
    t.near(theirs.before, mine.before, 1e-12, 'slope before the lens');
    t.near(theirs.after, mine.after, 1e-12, 'slope after the lens');
    t.near(theirs.lens + theirs.after * RELIEF, pupil, 1e-9, 'the ray reaches the pupil');
    if (screen < FOCAL) t.near(theirs.lens - theirs.after * trace.distance, trace.height, 1e-6 * trace.height, 'traced back, the ray comes from the virtual image');
  }
  t.near(viewSlope(screen), ownSlope(screen), 1e-12, `${screen} mm: the direction a screen point is seen in`);
  if (screen < FOCAL) t.near(ownSlope(screen), trace.height / POINT / (trace.distance + RELIEF), 1e-9, 'the eye sees the point where its virtual image is');
}
t.near(ownSlope(FOCAL), 1 / FOCAL, 1e-15, 'with the screen at the focal length, a point y off the axis is seen at y/f');

// 5. The eyes' aim, from vectors, and the conflict with the focus.
for (const screen of screens) {
  const focus = lensImage(screen).focus;
  for (let i = 3; i <= 100; i++) {
    const distance = i / 10, eyes = eyesOn(distance, focus), toObject = side => [-side * IPD / 2, 1000 * distance];
    const [l, r] = [toObject(1), toObject(-1)], angle = Math.acos((l[0] * r[0] + l[1] * r[1]) / (Math.hypot(...l) * Math.hypot(...r)));
    t.near(eyes.vergence, angle, 1e-9, 'the angle between the lines of sight');
    t.near(eyes.turn, Math.acos(l[1] / Math.hypot(...l)), 1e-9, 'each eye turns in half of it');
    t.near(eyes.aim, 1 / distance, 1e-12, 'aim in diopters');
    t.near(eyes.conflict, Math.abs(1 / distance - focus), 1e-12, 'conflict');
    t.ok(eyes.comfortable === (Math.abs(1 / distance - focus) <= COMFORT + 1e-12), 'comfortable within 0.4 D');
    t.near(eyes.conflict <= COMFORT ? 1 : 0, distance >= eyes.near - 1e-9 && distance <= (eyes.far ?? Infinity) + 1e-9 ? 1 : 0, 0, 'the comfortable range holds exactly the comfortable distances');
    t.ok(eyes.far === null ? focus <= COMFORT : Number.isFinite(eyes.far), 'no far limit once the focus is within 0.4 D of infinity');
  }
}
t.near(eyesOn(0.3, 0.5).conflict, 2.83, 0.004, 'Wikipedia’s example: an object at 30 cm and a screen at 2 m conflict by 3.33 − 0.5 = 2.83 D');

// 6. The drawing, held to the state.
const model = createVrHeadsetModel(), topo = model.topology, SLOW = topo.SLOW;
t.ok(topo.MM === MM && SLOW === 5, 'one millimeter is 0.02 scene units; five times slower than real time');
const points = object => {
  const array = object.geometry.attributes.position.array, count = object.visible ? Math.min(object.geometry.drawRange.count, array.length / 3) : 0, out = [];
  for (let i = 0; i < count; i++) out.push([array[3 * i] / MM, array[3 * i + 1] / MM, array[3 * i + 2] / MM]);
  return out;
};
const samePoints = (object, expected, message, tolerance = 2e-3) => {
  const drawn = points(object);
  assert.equal(drawn.length, expected.length, `${message}: ${expected.length} points`);
  const order = list => [...list].sort((a, b) => Math.round(a[0] * 100) - Math.round(b[0] * 100) || a[1] - b[1] || a[2] - b[2]);
  const a = order(drawn), b = order(expected);
  a.forEach((p, i) => p.forEach((value, j) => t.near(value, b[i][j], tolerance, `${message}: point ${i}`)));
  t.add();
};
const wrapOwn = angle => ((angle % 360) + 540) % 360 - 180;
const Z = CHARTS.z;
const T = CHARTS.timeline, E = CHARTS.errors, F = CHARTS.frames, V = CHARTS.view, O = CHARTS.optics, D = CHARTS.focus;
const tx = time => T.x + time / RUN * T.w, ty = v => T.y + (Math.max(-30, Math.min(70, v)) + 30) / 100 * T.h;
const ex = time => E.x + time / RUN * E.w, ey = v => E.y + E.h / 2 + Math.max(-12, Math.min(12, v)) / 12 * E.h / 2;
const vx = angle => V.x + V.w / 2 - angle / 40 * V.w / 2, dx = d => D.x + 10 + Math.max(0, Math.min(4, d)) / 4 * (D.w - 20);
const chartPoint = (x, y) => [x, y, Z];

const SETTINGS = [{}, {prediction: 0}, {latency: 100, prediction: 0}, {motion: 1}, {motion: 1, latency: 60, correction: 2, offset: -1.3}, {motion: 2, offset: 2, correction: 0}, {scale: -3, correction: 2, screen: 41, distance: 0.3}, {screen: 45, distance: 10, latency: 5}];
const TIMES = [0, 0.004, 0.0205, 0.35, 0.5, 0.75, 1, 1.009, 1.02, 1.25, 1.5, 2, 2.5, 2.999, 3];
let moments = 0;
for (const settings of SETTINGS) {
  const values = {...VR_DEFAULTS, ...settings}, plan = vrPlan(values), own = trackAgain(values.motion, values.offset, values.scale, values.correction), latency = values.latency / 1000;
  const slope = ownSlope(values.screen), half = Math.atan(HALF_VIEW * slope) / DEG, focus = lensImage(values.screen).focus;
  const ownFrames = [];
  for (let n = 0; n / FRAMES + latency <= RUN + 1e-12; n++) {
    const stage = Math.floor(100 * n / 9), flash = n / FRAMES + latency;
    const shown = own.estimate[stage] + (values.prediction ? own.gyro[stage] * (flash - stage / RATE) : 0);
    ownFrames.push({n, start: n / FRAMES, flash, shown, slip: shown - yawOf(values.motion, flash)[0]});
  }
  for (const time of TIMES) {
    model.reset();
    model.update(values);
    if (time > 0) model.playback.advance(time * SLOW);
    const state = model.getState(), now = state.now, at = now.t;
    t.near(at, Math.min(RUN, time), 1e-12, 'the run’s clock');
    const [yaw] = yawOf(values.motion, at);

    // The head and everything it wears turn by its true yaw; the panel sits at the screen distance.
    for (const group of [topo.wearer, topo.headset, topo.lenses, topo.display, topo.imu]) t.near(group.rotation.y, yaw * DEG, 1e-9, 'turns with the head');
    t.near(topo.panel.position.z / MM, HEADSET.lensZ + values.screen, 1e-9, 'the panel’s face is the screen distance from the lenses');

    // The frame showing now.
    let showing = null;
    for (const frame of ownFrames) if (frame.flash <= at + 1e-12) showing = frame;
    t.near(state.shownYaw, showing ? showing.shown : 0, 1e-9, 'the panel shows the frame lit most recently');
    t.ok(now.flashing === Boolean(showing && at < showing.flash + FLASH - 1e-12), 'lit for 2 ms after it lights');
    const shownYaw = showing ? showing.shown : 0;

    // The panel: landmarks at infinity are drawn alike for both eyes, the object from each eye's own position.
    const ticks = [], zero = [];
    for (const side of [1, -1]) {
      for (let azimuth = -180; azimuth < 180; azimuth += 10) {
        const angle = wrapOwn(azimuth - shownYaw);
        if (Math.abs(angle) > half) continue;
        const x = side * IPD / 2 + Math.tan(angle * DEG) / slope, reach = azimuth % 30 === 0 ? 14 : 8;
        (azimuth === 0 ? zero : ticks).push([x, FACE.eyeY - reach, -0.25], [x, FACE.eyeY + reach, -0.25]);
      }
    }
    samePoints(topo.panelTicks, ticks, 'panel landmarks');
    samePoints(topo.panelAhead, zero, 'panel straight ahead');
    [1, -1].forEach((side, e) => {
      const psi = shownYaw * DEG, eye = [side * IPD / 2 * Math.cos(psi) + FACE.eyeZ * Math.sin(psi), -side * IPD / 2 * Math.sin(psi) + FACE.eyeZ * Math.cos(psi)];
      const toObject = [0 - eye[0], FACE.eyeZ + 1000 * values.distance - eye[1]], left = [Math.cos(psi), -Math.sin(psi)], ahead = [Math.sin(psi), Math.cos(psi)];
      const angle = Math.atan2(toObject[0] * left[0] + toObject[1] * left[1], toObject[0] * ahead[0] + toObject[1] * ahead[1]) / DEG;
      t.near(objectDirection(side, shownYaw, values.distance), angle, 1e-9, 'the object’s direction for each eye');
      const object = topo.panelObjects[e];
      t.ok(object.visible === Math.abs(angle) <= half, 'the object shows while it is in view');
      if (object.visible) t.near(object.position.x / MM, side * IPD / 2 + Math.tan(angle * DEG) / slope, 1e-9, 'the object on the panel');
    });

    // What the left eye sees.
    const row = ([y0, y1], headYaw) => {
      const list = [], ahead = [], middle = (y0 + y1) / 2;
      for (let azimuth = -180; azimuth < 180; azimuth += 10) {
        const angle = wrapOwn(azimuth - headYaw);
        if (Math.abs(angle) > half) continue;
        const reach = (azimuth % 30 === 0 ? 0.5 : 0.25) * (y1 - y0);
        (azimuth === 0 ? ahead : list).push(chartPoint(vx(angle), middle - reach), chartPoint(vx(angle), middle + reach));
      }
      return {list, ahead};
    };
    const trueRow = row(VIEW_ROWS.truth, yaw), shownRow = row(VIEW_ROWS.shown, shownYaw);
    samePoints(topo.truthTicks, trueRow.list, 'landmarks where they truly are');
    samePoints(topo.shownTicks, showing ? shownRow.list : [], 'landmarks where the display draws them');
    samePoints(topo.aheadMarks, [...trueRow.ahead, ...(showing ? shownRow.ahead : [])], 'straight ahead, both rows');
    for (const [object, rowY, headYaw, shown] of [[topo.truthObject, VIEW_ROWS.truth, yaw, true], [topo.shownObject, VIEW_ROWS.shown, shownYaw, Boolean(showing)]]) {
      const angle = objectDirection(1, headYaw, values.distance);
      t.ok(object.visible === (shown && Math.abs(angle) <= half), 'the eye chart’s object shows while it is in view');
      if (object.visible) {
        t.near(object.position.x / MM, vx(angle), 1e-9, 'the eye chart’s object');
        t.near(object.position.y / MM, (rowY[0] + rowY[1]) / 2, 1e-9, 'on its row');
      }
    }

    // Frames close up: the last 120 ms.
    const w0 = at - 0.12, fx = tau => F.x + (tau - w0) / 0.12 * F.w, stage = Math.min(RUN * RATE, Math.floor(at * RATE + 1e-9)), image = Math.floor(3 * stage / 50);
    const gyroPairs = [];
    for (let k = Math.max(0, Math.ceil(w0 * RATE - 1e-9)); k <= stage; k++) gyroPairs.push(chartPoint(fx(k / RATE), FRAME_ROWS.gyro[0]), chartPoint(fx(k / RATE), FRAME_ROWS.gyro[0] + 2 + 8 * Math.min(1, Math.abs(own.gyro[k]) / 200)));
    samePoints(topo.gyroTicks, gyroPairs.slice(0, 244), 'the gyroscope’s readings');
    t.ok(gyroPairs.length <= 244, 'room for every reading in the window');
    const imagePairs = [];
    for (let j = Math.max(0, Math.ceil(w0 * IMAGES - 1e-9)); j <= image; j++) imagePairs.push(chartPoint(fx(j / IMAGES), FRAME_ROWS.camera[0]), chartPoint(fx(j / IMAGES), FRAME_ROWS.camera[1]));
    samePoints(topo.cameraTicks, imagePairs, 'the camera’s images');
    const starts = [], pipePairs = [], bars = [];
    for (const frame of ownFrames) {
      if (frame.start > at + 1e-12) break;
      if (frame.start >= w0 - 1e-12) starts.push(chartPoint(fx(frame.start), FRAME_ROWS.start[0]), chartPoint(fx(frame.start), FRAME_ROWS.start[1]));
      const from = Math.max(frame.start, w0), to = Math.min(frame.flash, at), level = tau => FRAME_ROWS.start[0] - (FRAME_ROWS.start[0] - FRAME_ROWS.flash[1]) * (tau - frame.start) / latency;
      if (to > from) pipePairs.push(chartPoint(fx(from), level(from)), chartPoint(fx(to), level(to)));
      const lit0 = Math.max(frame.flash, w0), lit1 = Math.min(frame.flash + FLASH, at);
      if (lit1 > lit0) bars.push([fx(lit0), fx(lit1)]);
    }
    samePoints(topo.startTicks, starts, 'frame starts');
    samePoints(topo.pipes, pipePairs, 'frames on their way to the light');
    const drawnBars = topo.flashBars.filter(bar => bar.visible).map(bar => [bar.position.x / MM - bar.scale.x / MM / 2, bar.position.x / MM + bar.scale.x / MM / 2]).sort((a, b) => a[0] - b[0]);
    assert.equal(drawnBars.length, bars.length, 'a bar for each flash in the window');
    bars.forEach((bar, i) => bar.forEach((x, j) => t.near(drawnBars[i][j], x, 1e-6, 'flash bar')));

    // The gyroscope's arc and the camera's light.
    const sweep = Math.max(-1, Math.min(1, own.gyro[stage] / 300)) * 2 * Math.PI * 0.999;
    if (Math.abs(sweep) > 1e-9) {
      const arc = points(topo.rateArc);
      t.ok(arc.length === 49, 'the arc over the chip');
      t.near(arc[48][0], IMU_AT.x + 8 * Math.sin(sweep), 1e-3, 'the arc ends at the reading’s angle');
      t.near(arc[48][2], IMU_AT.z + 8 * Math.cos(sweep), 1e-3, 'the arc ends at the reading’s angle');
      t.near(Math.atan2(arc[24][0] - IMU_AT.x, arc[24][2] - IMU_AT.z), Math.atan2(Math.sin(sweep / 2), Math.cos(sweep / 2)), 1e-4, 'the arc turns the way the head turns');
    } else t.ok(!topo.rateArc.visible, 'no arc for no reading');
    t.ok(topo.cameraLight.material.color.getHex() === (at - image / IMAGES < CAMERA_AT.lit ? COLORS.lit : COLORS.dark), 'the camera’s light shows each image');

    // Cursors.
    samePoints(topo.timelineCursor, [chartPoint(tx(at), T.y), chartPoint(tx(at), T.y + T.h)], 'timeline cursor');
    samePoints(topo.errorsCursor, [chartPoint(ex(at), E.y), chartPoint(ex(at), E.y + E.h)], 'errors cursor');

    // Every chart stays inside its frame.
    for (const [id, box] of Object.entries({timeline: T, errors: E, frames: F, view: V, optics: O, focus: D})) {
      topo[id].traverse(object => {
        if (!object.geometry || !object.visible) return;
        const list = object.isLine ? points(object) : [[object.position.x / MM, object.position.y / MM]];
        // Words sit around the frame, titles above and axis words below and beside it; they stay near it.
        const m = object.userData.setText ? 30 : 1e-3;
        for (const [x, y] of list) t.ok(x >= box.x - m && x <= box.x + box.w + m && y >= box.y - m && y <= box.y + box.h + m, `${id}: drawn inside its frame`);
      });
    }
    moments++;
  }

  // What changes only with the settings.
  samePoints(topo.truthLine, Array.from({length: 601}, (_, i) => chartPoint(tx(i / 200), ty(own.truth[5 * i]))), 'the head’s yaw over time');
  samePoints(topo.estimateLine, Array.from({length: 601}, (_, i) => chartPoint(tx(i / 200), ty(own.estimate[5 * i]))), 'the estimate over time');
  samePoints(topo.driftLine, Array.from({length: 601}, (_, i) => chartPoint(ex(i / 200), ey(own.estimate[5 * i] - own.truth[5 * i]))), 'the drift');
  const stairs = (x, y, key) => ownFrames.flatMap((frame, i) => [chartPoint(x(frame.flash), y(frame[key])), chartPoint(x(i + 1 < ownFrames.length ? ownFrames[i + 1].flash : RUN), y(frame[key]))]);
  samePoints(topo.shownLine, stairs(tx, ty, 'shown'), 'each frame’s yaw');
  samePoints(topo.slipLine, stairs(ex, ey, 'slip'), 'each frame’s slip');
  samePoints(topo.viewEdges, [chartPoint(vx(half), V.y + 2), chartPoint(vx(half), V.y + V.h - 2), chartPoint(vx(-half), V.y + 2), chartPoint(vx(-half), V.y + V.h - 2)], 'the edges of the view');
  const X1 = O.lens + values.screen;
  samePoints(topo.screenLine, [chartPoint(O.x + X1, O.y + 2), chartPoint(O.x + X1, O.y + O.h - 2)], 'the screen, at true size');
  [-1.5, 0, 1.5].forEach((pupil, i) => {
    const ray = pupilRay(values.screen, pupil), reach = Math.min(O.w - O.lens, (O.h - 2 - O.axis - ray.lens) / -ray.after);
    samePoints(topo.rays[i], [chartPoint(O.x + X1, O.y + O.axis + POINT), chartPoint(O.x + O.lens, O.y + O.axis + ray.lens), chartPoint(O.x + O.lens - RELIEF, O.y + O.axis + pupil)], 'a ray into the pupil');
    samePoints(topo.backRays[i], [chartPoint(O.x + O.lens, O.y + O.axis + ray.lens), chartPoint(O.x + O.lens + reach, O.y + O.axis + ray.lens - ray.after * reach)], 'the ray traced back');
  });
  const eyes = eyesOn(values.distance, focus);
  t.near(topo.comfortBar.scale.x / MM, dx(focus + COMFORT) - dx(Math.max(0, focus - COMFORT)), 1e-9, 'the comfort band');
  t.near(topo.comfortBar.position.x / MM, (dx(focus + COMFORT) + dx(Math.max(0, focus - COMFORT))) / 2, 1e-9, 'the comfort band’s place');
  samePoints(topo.focusMark, [chartPoint(dx(focus), D.y + 14), chartPoint(dx(focus), D.y + 48)], 'focus');
  samePoints(topo.aimMark, [chartPoint(dx(1 / values.distance), D.y + 14), chartPoint(dx(1 / values.distance), D.y + 58)], 'aim');
  t.ok(topo.conflictLine.material.color.getHex() === (Math.abs(1 / values.distance - focus) <= COMFORT ? COLORS.camera : COLORS.shown), 'the conflict turns red beyond 0.4 D');
  t.ok(eyes.comfortable === (Math.abs(1 / values.distance - focus) <= COMFORT), 'comfortable');
}

// Sizes and places, measured from the drawing.
const measure = mesh => { mesh.geometry.computeBoundingBox(); const size = mesh.geometry.boundingBox.getSize(new mesh.position.constructor()); return [size.x * mesh.scale.x / MM, size.y * mesh.scale.y / MM, size.z * mesh.scale.z / MM]; };
model.reset();
const [side] = topo.shell;
t.near(side.position.x / MM + measure(side)[0] / 2, HEADSET.half, 1e-4, 'the shell is 184 mm across');
t.near(2 * HEADSET.half, 184, 0, 'the shell is 184 mm across');
t.near(measure(topo.skull)[0], 2 * FACE.radii[0], 1e-4, 'the head’s width');
t.near(measure(topo.skull)[1], 2 * FACE.radii[1], 1e-4, 'the head’s height');
for (const lens of topo.glass) {
  t.near(Math.abs(lens.position.x / MM), IPD / 2, 1e-9, 'each lens centered on its eye');
  t.near(lens.position.z / MM - (FACE.eyeZ + FACE.eyeRadius), RELIEF, 1e-9, 'each lens 15 mm in front of the eye');
  t.near(measure(lens)[0], 2 * LENS.radius, 1e-4, 'lens diameter');
  t.ok(lens.position.z / MM - measure(lens)[2] / 2 > FACE.eyeZ + FACE.eyeRadius, 'the lens clears the eye');
}
for (const screen of [41, 45]) t.ok(HEADSET.lensZ + screen - 4 > HEADSET.lensZ + 4 && HEADSET.lensZ + screen + HEADSET.panel[2] < HEADSET.front - HEADSET.wall, 'the panel clears the lenses and the front wall at both ends of its travel');
const chip = topo.imu.children.find(child => child.geometry && Math.abs(measure(child)[0] - IMU_AT.chip[0]) < 1e-4);
assert.ok(chip, 'the chip is drawn 4 mm across');
t.near(measure(chip)[2], IMU_AT.chip[2], 1e-4, 'the chip is 4 × 4 mm');
t.near(chip.position.y / MM - measure(chip)[1] / 2, IMU_AT.y + IMU_AT.board[1] / 2, 1e-4, 'the chip sits on its board');
t.ok(IMU_AT.z + IMU_AT.board[2] / 2 < HEADSET.lensZ + 41 && IMU_AT.y - IMU_AT.board[1] / 2 > FACE.eyeY + LENS.radius + 1.2, 'the board clears the panel and the lenses');
const facing = [Math.sin(topo.camera.rotation.y), Math.cos(topo.camera.rotation.y)], toHead = [-CAMERA_AT.x, -CAMERA_AT.z].map(v => v / Math.hypot(CAMERA_AT.x, CAMERA_AT.z));
t.near(facing[0] * toHead[0] + facing[1] * toHead[1], 1, 1e-12, 'the camera faces the head');
for (const [x, y, z] of [[HEADSET.half - 2, 30, 118], [84, 32, 20], [48, 36, -82], [0, 38, -102]]) t.ok((x / FACE.radii[0]) ** 2 + (y / FACE.radii[1]) ** 2 + (z / FACE.radii[2]) ** 2 > 1.1, 'the strap runs outside the head');
t.ok(model.parts.every(p => !p.parentId || p.parentId === 'system'), 'no part hangs from another part but the whole');

// The motion the drawing exists to show: the room's landmarks move across the panel against the head.
model.reset();
const landmarkX = time => { model.reset(); model.playback.advance(time * SLOW); return points(topo.panelTicks).filter((_, i) => i % 2 === 0).map(p => p[0]).filter(x => x > 0).sort((a, b) => a - b); };
const early = landmarkX(0.6), late = landmarkX(0.7);
t.ok(early.length > 0 && late.length > 0 && late[0] < early[0], 'as the head turns left the landmarks slide right across the left eye’s view');
model.reset();
model.playback.advance(RUN * SLOW);
t.near(topo.wearer.rotation.y, TURN * DEG, 1e-12, 'the head ends turned 60°');

// 7. What the lessons say.
const defaults = vrPlan({}), noPrediction = vrPlan({prediction: 0});
const machineClaims = {
  'Turn your head': s => { t.ok(Math.abs(s.worstSlip.slip) * 10 < Math.abs(noPrediction.worstSlip.slip), 'prediction cuts the slip more than tenfold'); return {'60': HEAD.turn, '112.5': s.peakRate, '0.08': Math.abs(s.worstSlip.slip), '20': s.values.latency}; },
  'No prediction': s => { t.ok(s.worstSlip.slip < 0, 'the picture lags a head turning left'); return {'2.37': Math.abs(s.worstSlip.slip), '1.01': s.worstSlip.flash}; },
  'A 1990s headset': s => { const ratio = s.worstSlip.slip / noPrediction.worstSlip.slip; t.ok(ratio > 2.5 && ratio < 3, 'nearly three times'); return {'60': s.values.latency, '6.84': Math.abs(s.worstSlip.slip), '112.5': s.peakRate, '2.37': Math.abs(noPrediction.worstSlip.slip), '20': VR_DEFAULTS.latency}; },
  'Predict further ahead': s => { t.ok(Math.round(s.worstSlip.slip / defaults.worstSlip.slip) === 8, 'eight times'); return {'60': s.values.latency, '0.65': Math.abs(s.worstSlip.slip), '0.08': Math.abs(defaults.worstSlip.slip), '20': VR_DEFAULTS.latency}; },
  'A fast gyroscope': s => { t.near(s.endDrift, s.values.scale / 100 * HEAD.turn, 1e-9, 'the error is the scale error’s share of the turn'); return {'3': s.values.scale, '61.80': s.estimate[s.N], '60': HEAD.turn, '1.80': s.endDrift}; },
  'The camera corrects it': s => { t.near(1 / (s.alpha * RATE), 0.1, 1e-12, 'a tenth of a second'); t.ok(s.worstDrift.value < 0, 'the old images drag the estimate behind'); return {'0.01': s.alpha, '0.00': Math.abs(s.endDrift), '16.3': maxAge * 1000, '0.57': Math.abs(s.worstDrift.value)}; },
  'A near object': s => ({'0.3': s.values.distance, '11.99': s.eyes.vergence / DEG, '3.33': s.eyes.aim, '0.50': s.image.focus, '2.83': s.eyes.conflict, '0.4': LENS.comfort}),
  'Screen at the focal length': s => { t.ok(s.image.fromEye === null && s.image.focus === 0 && s.values.screen === LENS.focal, 'at the focal length'); return {'45': s.values.screen, '1.0': s.values.screen - VR_DEFAULTS.screen, '44': VR_DEFAULTS.screen, '2.00': lensImage(VR_DEFAULTS.screen).fromEye}; },
};
const trackingClaims = {
  'Add up the readings': s => { t.ok(s.gyro[s.N] === 0, 'the readings fall back to nothing'); return {'112.50': Math.max(...Array.from(s.gyro, Math.abs)), '3,000': s.N, '60.00': s.estimate[s.N]}; },
  'An offset': s => ({'0.5': s.values.offset, '1.50': s.endDrift, '3': s.duration}),
  'A scale error': s => { t.ok(s.estimate[500] === 0 && s.truth[500] === 0, 'no drift before the turn'); return {'60': HEAD.turn, '1.80': s.endDrift, '3': s.values.scale}; },
  'Shake it off': s => ({'25': HEAD.swing, '0.75': Math.abs(s.worstDrift.value), '0.00': Math.abs(s.endDrift)}),
  'A gentle pull': s => ({'0.0001': s.alpha, '10': 1 / (s.alpha * RATE), '3': s.duration, '1.30': s.endDrift, '1.50': vrPlan({...s.values, correction: 0}).endDrift, '5.00': settle(s.values.offset, s.alpha)}),
  'A firm pull': s => ({'0.01': s.alpha, '0.05': s.endDrift, '16.3': maxAge * 1000, '0.83': Math.abs(s.worstDrift.value)}),
};
checkTrialNumbers(vrHeadsetLesson, machineClaims, values => vrPlan(values), t);
checkTrialNumbers(headTrackingLesson, trackingClaims, values => vrPlan(values), t);
const trials = vrHeadsetLesson.tryIt.length + headTrackingLesson.tryIt.length;

checkQuotedText(vrHeadsetLesson.steps.map(step => step.body).join(' '), {[`${fixed(RATE, 0)} times a second`]: '1,000 times a second', [`${fixed(IMAGES, 0)} times a second`]: '60 times a second', [`${fixed(FRAMES, 0)} times a second`]: '90 times a second', [`for just ${fixed(FLASH * 1000, 0)} ms`]: 'for just 2 ms'}, t);
checkQuotedText(vrHeadsetLesson.deeper.map(item => item.body).join(' '), {[`this ${fixed(FOCAL, 0)} mm lens is ${fixed(1000 / FOCAL, 1)} D`]: 'this 45 mm lens is 22.2 D', [`${fixed(IPD, 0)} mm apart here`]: '63 mm apart here', [`An object ${fixed(2, 1)} m away is ${fixed(eyesOn(2, 0).turn / DEG, 2)}° to the right`]: 'An object 2.0 m away is 0.90° to the right', [`${fixed(eyesOn(2, 0).turn / DEG, 2)}° to the left for the right eye`]: '0.90° to the left for the right eye', [`at ${fixed(FRAMES, 0)} frames a second`]: 'at 90 frames a second', [`up to about ${fixed(COMFORT, 1)} D`]: 'up to about 0.4 D'}, t);
checkQuotedText(vrHeadsetLesson.quiz.explanation, {[`${fixed(VR_DEFAULTS.latency, 0)} ms of latency left the picture up to ${fixed(Math.abs(noPrediction.worstSlip.slip), 2)}° behind a head turning at ${fixed(noPrediction.peakRate, 1)}°/s`]: '20 ms of latency left the picture up to 2.37° behind a head turning at 112.5°/s', [`cut that to ${fixed(Math.abs(defaults.worstSlip.slip), 2)}°`]: 'cut that to 0.08°'}, t);
checkQuotedText(headTrackingLesson.steps.map(step => step.body).join(' '), {[`${fixed(RATE, 0)} times a second`]: '1,000 times a second'}, t);
checkQuotedText(headTrackingLesson.deeper.map(item => item.body).join(' '), {[`${fixed(GAINS[1], 4)} in his example`]: '0.0001 in his example', [`${fixed(IMAGES, 0)} images a second and the gyroscope ${fixed(RATE, 0)} readings`]: '60 images a second and the gyroscope 1,000 readings', [`${[...new Set(runs)].sort().join(' or ')} readings in a row`]: '16 or 17 readings in a row', [`up to ${fixed(VR_DOMAINS.scale[1], 0)}% off in scale`]: 'up to 3% off in scale'}, t);
checkQuotedText(headTrackingLesson.quiz.explanation, {[`${fixed(vrPlan({scale: 3, correction: 0}).endDrift, 2)}° after a ${fixed(TURN, 0)}° turn`]: '1.80° after a 60° turn', [`${fixed(Math.abs(vrPlan({motion: 1, scale: 3, correction: 0}).endDrift), 2)}° once a shaking head`]: '0.00° once a shaking head'}, t);
checkQuotedText(vrHeadsetLesson.limits, {[`${fixed(TURN, 0)}° to the left in ${fixed(TURN_TIME, 0)} s`]: '60° to the left in 1 s', [`swings of ${fixed(SWING, 0)}° each way`]: 'swings of 25° each way', [`${fixed(RATE, 0)} times a second`]: '1,000 times a second', [`the true yaw ${fixed(IMAGES, 0)} times a second`]: 'the true yaw 60 times a second', [`${fixed(FRAMES, 0)} times a second and lit for ${fixed(FLASH * 1000, 0)} ms`]: '90 times a second and lit for 2 ms', [`${fixed(FOCAL, 0)} mm focal length ${fixed(RELIEF, 0)} mm in front of the eyes`]: '45 mm focal length 15 mm in front of the eyes', [`the screen ${fixed(VR_DOMAINS.screen[0], 0)} to ${fixed(VR_DOMAINS.screen[1], 0)} mm behind them`]: 'the screen 41 to 45 mm behind them', [`eyes ${fixed(IPD, 0)} mm apart`]: 'eyes 63 mm apart', [`comfort limit of ${fixed(COMFORT, 1)} D`]: 'comfort limit of 0.4 D', [`${['', '', '', '', '', 'five'][SLOW]} times slower`]: 'five times slower'}, t);
t.ok(headTrackingLesson.limits === vrHeadsetLesson.limits, 'one set of limits');

const describe = id => model.parts.find(p => p.id === id).description;
checkQuotedText(describe('wearer'), {[`${fixed(IPD, 0)} mm apart`]: '63 mm apart'}, t);
checkQuotedText(describe('headset'), {[`${fixed(2 * HEADSET.half, 0)} mm across`]: '184 mm across'}, t);
checkQuotedText(describe('lenses'), {[`${fixed(FOCAL, 0)} mm focal length`]: '45 mm focal length', [`${fixed(RELIEF, 0)} mm in front of the eyes`]: '15 mm in front of the eyes'}, t);
checkQuotedText(describe('display'), {[`lights for ${fixed(FLASH * 1000, 0)} ms each frame`]: 'lights for 2 ms each frame', [`a line every ${fixed(LANDMARKS[1] - LANDMARKS[0], 0)}°`]: 'a line every 10°'}, t);
checkQuotedText(describe('imu'), {[`A ${fixed(IMU_AT.chip[0], 0)} × ${fixed(IMU_AT.chip[2], 0)} mm`]: 'A 4 × 4 mm', [`${fixed(RATE, 0)} times a second`]: '1,000 times a second', [`a full circle for ${fixed(IMU_AT.fullCircle, 0)}°/s`]: 'a full circle for 300°/s'}, t);
checkQuotedText(describe('camera'), {[`${fixed(IMAGES, 0)} images a second`]: '60 images a second'}, t);
checkQuotedText(describe('timeline'), {[`the ${fixed(RUN, 0)} s run`]: 'the 3 s run', [`from ${fixed(-T.v0, 0)}° to the right`]: 'from 30° to the right', [`to ${fixed(T.v1, 0)}° to the left`]: 'to 70° to the left', [`and ${fixed(TURN, 0)}° to the left`]: 'and 60° to the left'}, t);
checkQuotedText(describe('errors'), {[`The same ${fixed(RUN, 0)} s, ${fixed(E.range, 0)}° either way`]: 'The same 3 s, 12° either way', [`Faint lines: ${fixed(1, 0)}° either way`]: 'Faint lines: 1° either way'}, t);
checkQuotedText(describe('frames'), {[`The last ${fixed(F.window * 1000, 0)} ms`]: 'The last 120 ms', [`${fixed(IMAGES, 0)} a second`]: '60 a second', [`${fixed(FRAMES, 0)} a second`]: '90 a second', [`frame’s ${fixed(FLASH * 1000, 0)} ms of light`]: 'frame’s 2 ms of light'}, t);
checkQuotedText(describe('view'), {[`${fixed(V.span, 0)}° either way`]: '40° either way', [`a tick every ${fixed(10, 0)}° and a tall one every ${fixed(30, 0)}°`]: 'a tick every 10° and a tall one every 30°'}, t);
checkQuotedText(describe('optics'), {[`its focal point, ${fixed(FOCAL, 0)} mm out`]: 'its focal point, 45 mm out', [`a screen point ${fixed(POINT, 0)} mm off the axis`]: 'a screen point 20 mm off the axis'}, t);
checkQuotedText(describe('focus'), {[`to ${fixed(D.d1, 0)} for ${fixed(100 / D.d1, 0)} cm`]: 'to 4 for 25 cm', [`within ${fixed(COMFORT, 1)} D of the focus`]: 'within 0.4 D of the focus'}, t);
t.ok(POINT === O.point && RELIEF === O.lens - 25 && IMU_AT.fullCircle === 300, 'chart constants the text quotes');

// Readings, controls, scene, refusals and disposal.
model.reset();
model.playback.advance(RUN * SLOW);
const hints = Object.fromEntries(model.getState().readings.map(item => [item.label, `${item.value} ${item.hint || ''}`]));
checkQuotedText(hints['Display'], {[`Frames start ${fixed(FRAMES, 0)} times a second and light ${fixed(VR_DEFAULTS.latency, 0)} ms later for ${fixed(FLASH * 1000, 0)} ms`]: 'Frames start 90 times a second and light 20 ms later for 2 ms', [`worst frame was ${fixed(Math.abs(defaults.worstSlip.slip), 2)}° off`]: 'worst frame was 0.08° off'}, t);
checkQuotedText(hints['Estimate'], {[`α = ${fixed(GAINS[1], 4)}`]: 'α = 0.0001', [`about ${fixed(1 / (GAINS[1] * RATE), 1)} s`]: 'about 10.0 s'}, t);
checkQuotedText(hints['Your result'], {[`never more than ${fixed(Math.abs(defaults.worstSlip.slip), 2)}° off the room`]: 'never more than 0.08° off the room', [`ends ${fixed(Math.abs(defaults.endDrift), 2)}° off`]: 'ends 0.04° off'}, t);
checkQuotedText(hints['Lenses'], {[`image ${fixed(lensImage(44).fromEye, 2)} m away`]: 'image 2.00 m away', [`focus at ${fixed(lensImage(44).focus, 2)} D`]: 'focus at 0.50 D'}, t);
checkQuotedText(hints['Eyes'], {[`each eye turns in ${fixed(eyesOn(2, lensImage(44).focus).turn / DEG, 2)}°`]: 'each eye turns in 0.90°', [`from ${fixed(eyesOn(2, lensImage(44).focus).near, 2)} m to ${fixed(eyesOn(2, lensImage(44).focus).far, 2)} m`]: 'from 1.11 m to 9.88 m'}, t);
checkQuotedText(hints['Head'], {[`up to ${fixed(defaults.peakRate, 1)}°/s`]: 'up to 112.5°/s'}, t);

const snapshot = () => JSON.stringify({
  yaw: topo.wearer.rotation.y, panel: topo.panel.position.z, comfort: topo.comfortBar.scale.x,
  lines: [topo.truthLine, topo.estimateLine, topo.shownLine, topo.driftLine, topo.slipLine, topo.screenLine, ...topo.rays, topo.focusMark, topo.aimMark, topo.panelTicks, topo.pipes, topo.startTicks, topo.truthTicks, topo.shownTicks].map(points),
  objects: [...topo.panelObjects, topo.truthObject, topo.shownObject].map(object => [object.visible, ...object.position.toArray()]),
});
checkControlsMove(model, snapshot, m => m.playback.advance(RUN * SLOW), t);
for (const time of [-1, 0, 1.5, 3, 10]) {
  if (time < 0) { assert.throws(() => sampleVr({}, time), RangeError); t.add(); continue; }
  t.near(sampleVr({}, time).now.t, Math.min(RUN, time), 1e-12, 'sampling clamps to the run');
}
model.reset();
model.update({motion: 1, latency: 100, prediction: 0, screen: 41, distance: 0.3});
model.playback.advance(1.3 * SLOW);
checkFinite(model.root, t);
checkRefusals(sampleVr, VR_DOMAINS, t);
const resources = checkDisposal(model, t);

console.log(`PASS virtual reality headset: ${t.count} checks, ${trackRuns} tracking runs, ${frameCount} frames rebuilt, ${moments} drawn moments, ${trials} trials across two lessons, ${resources} resources released exactly once.`);

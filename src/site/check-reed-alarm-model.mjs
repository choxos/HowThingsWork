// Checks the magnetic burglar alarm and its lesson against the sources typed in
// again and the physics worked out by other routes: the magnet's field rebuilt
// by integrating the magnetic charge over its two pole faces instead of the
// closed form, the far field against a dipole of the same moment, the switch's
// two distances inverted back through the field, the door's chord rebuilt from
// the triangle it makes, and every drawn bar, curve, arrow and band read back at
// swept settings and times against numbers typed in here.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './reed-alarm-physics.js';
import * as M from './reed-alarm-model.js';
import * as L from './reed-alarm-lessons.js';
import {houseComponents} from './house-components.js';
import {safetyLessons} from './safety-lessons.js';
import {createSafetyModel} from './safety-models.js';
import {previewEntryIds} from './published-catalog.js';

const t = tally();
const counts = {poses: 0, points: 0, fields: 0, quadrature: 0, numbers: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const relative = (value, share = 1e-9) => Math.abs(value) * share + 1e-18;

// ---------------------------------------------------------------------------
// 1. The sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  mu0: 1.25663706127e-6,
  rows: [
    {part: 'MK03-1A66B-500W', mT: 1.70, pull: 15.0, drop: 17.5},
    {part: 'MK03-1A66C-500W', mT: 2.30, pull: 13.0, drop: 16.5},
    {part: 'MK03-1A66D-500W', mT: 2.70, pull: 11.0, drop: 14.5},
    {part: 'MK03-1A66E-500W', mT: 3.10, pull: 10.0, drop: 13.5},
  ],
  ampereTurns: [10, 60], metals: ['rhodium', 'ruthenium', 'iridium', 'tungsten'], fill: 'nitrogen',
  remanence: [1.0, 1.5], typical: 1.3, saturation: 1.6, barMoment: 0.1, barVolume: 1e-6, barMagnetization: 1e5,
  gaps: [['1/2 inch', 0.0127], ['3/4 inch', 0.01905], ['1 inch', 0.0254], ['1 1/2 inch', 0.0381], ['2 inch', 0.0508], ['3 inch', 0.0762]],
  formA: {resistance: 0.150, watts: 10, volts: 160, amps: 0.400},
  formBC: {resistance: 0.140, watts: 5, volts: 175, amps: 0.250},
};

t.ok(P.MU_0 === SRC.mu0, 'μ0 as the page gives it');
assert.deepEqual(P.STANDEX.map(row => row.part), SRC.rows.map(row => row.part));
assert.deepEqual(P.STANDEX.map(row => Math.round(row.sensitivity * 1e5)), SRC.rows.map(row => Math.round(row.mT * 100)));
assert.deepEqual(P.STANDEX.map(row => Math.round(row.pull * 1e4)), SRC.rows.map(row => Math.round(row.pull * 10)));
assert.deepEqual(P.STANDEX.map(row => Math.round(row.drop * 1e4)), SRC.rows.map(row => Math.round(row.drop * 10)));
{
  const ratios = SRC.rows.map(row => row.drop / row.pull);
  t.near(P.RATIO_BAND[0], Math.min(...ratios), 1e-12, 'the band the guide’s four rows span, at its narrowest');
  t.near(P.RATIO_BAND[1], Math.max(...ratios), 1e-12, 'and at its widest');
  t.ok(f3(P.RATIO_BAND[0]) === '1.167' && f3(P.RATIO_BAND[1]) === '1.350', 'which is 1.167 to 1.350');
  t.ok(SRC.rows.every(row => row.drop > row.pull), 'every row drops out further away than it pulls in');
}
assert.deepEqual([...P.REED.ampereTurns], SRC.ampereTurns);
assert.deepEqual([...P.REED.metals], SRC.metals);
t.ok(P.REED.fill === SRC.fill, 'the nitrogen fill');
assert.deepEqual([...P.MAGNET.remanence], SRC.remanence);
t.ok(P.MAGNET.typical === SRC.typical && P.MAGNET.saturation === SRC.saturation && P.MAGNET.barMoment === SRC.barMoment && P.MAGNET.barVolume === SRC.barVolume && P.MAGNET.barMagnetization === SRC.barMagnetization, 'neodymium’s 1.3 T and the page’s bar magnet');
t.near(SRC.barMoment / SRC.barVolume, SRC.barMagnetization, 1e-6, 'the page’s own bar magnet works out at 100,000 A/m');
assert.deepEqual(P.CONTACT.gaps.map(item => [item.name, item.metres]), SRC.gaps);
assert.deepEqual({...P.CONTACT.formA}, SRC.formA);
assert.deepEqual({...P.CONTACT.formBC}, SRC.formBC);
for (const [name, metres] of SRC.gaps) {
  const inches = name === '1 1/2 inch' ? 1.5 : Number(name.split(' ')[0].includes('/') ? name.split(' ')[0].split('/').reduce((a, b) => Number(a) / Number(b)) : name.split(' ')[0]);
  t.near(metres, inches * 0.0254, 1e-6, `${name} is ${inches} times 25.4 mm`);
}
t.ok(P.DECLARED.remanence >= SRC.remanence[0] && P.DECLARED.remanence <= SRC.remanence[1], 'the remanence this model declares is inside the range the page gives');
t.ok(P.DECLARED.release > 0 && P.DECLARED.release < 1, 'and the release share is a share');

// The field, rebuilt: the magnetic charge on the two pole faces, integrated.
const GAUSS = (() => {
  const n = 24, nodes = [], weights = [];
  const legendre = x => { let p0 = 1, p1 = x; for (let j = 2; j <= n; j++) [p0, p1] = [p1, ((2 * j - 1) * x * p1 - (j - 1) * p0) / j]; return [p1, n * (x * p1 - p0) / (x * x - 1)]; };
  for (let i = 1; i <= n; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5));
    for (let k = 0; k < 60; k++) { const [value, slope] = legendre(x); x -= value / slope; }
    nodes.push(x);
    weights.push(2 / ((1 - x * x) * legendre(x)[1] ** 2));
  }
  return {nodes, weights};
})();
const over = (fn, a, b, panels) => {
  let sum = 0;
  for (let p = 0; p < panels; p++) {
    const lo = a + (b - a) * p / panels, hi = a + (b - a) * (p + 1) / panels, half = (hi - lo) / 2, middle = (lo + hi) / 2;
    for (let i = 0; i < GAUSS.nodes.length; i++) { sum += GAUSS.weights[i] * fn(middle + half * GAUSS.nodes[i]) * half; counts.quadrature++; }
  }
  return sum;
};
const faceField = (magnet, depth) => {
  const a = magnet.width / 2, b = magnet.depth / 2;
  return P.DECLARED.remanence / (4 * Math.PI) * over(x => over(y => depth / Math.pow(x * x + y * y + depth * depth, 1.5), -b, b, 12), -a, a, 12);
};
const rebuiltField = (magnet, z) => faceField(magnet, z) - faceField(magnet, z + magnet.length);
for (const magnet of P.DECLARED.magnets) {
  for (const millimeters of [1, 2, 5, 10, 20, 31.9, 60]) {
    const z = millimeters / 1000, module = P.fieldOf(magnet, z), rebuilt = rebuiltField(magnet, z);
    t.near(module, rebuilt, relative(rebuilt, 1e-6), `the ${magnet.name} magnet at ${millimeters} mm: the closed form against the charge on its faces`);
    counts.fields++;
  }
  t.near(P.momentOf(magnet), P.DECLARED.remanence / P.MU_0 * magnet.width * magnet.depth * magnet.length, relative(P.momentOf(magnet)), `the ${magnet.name} magnet’s moment is its remanence over μ0 through its volume`);
  const far = 0.4;
  t.ok(Math.abs(P.fieldOf(magnet, far) / P.dipoleFieldOf(magnet, far + magnet.length / 2) - 1) < 0.01, 'and far out it is a dipole of that moment to within a percent');
  t.ok(P.fieldOf(magnet, 0.8) < P.fieldOf(magnet, 0.4) / 7, 'falling by more than seven when the distance doubles, as an inverse cube does');
  t.ok(P.fieldOf(magnet, -1) === 0 && P.fieldOf(magnet, 0) > 0, 'nothing behind the pole face, and something on it');
}
// The two distances, inverted back through the field.
for (const row of P.STANDEX) {
  for (const magnet of P.DECLARED.magnets) {
    const operate = P.distanceAt(magnet, row.sensitivity), release = P.distanceAt(magnet, row.sensitivity * P.DECLARED.release);
    t.near(P.fieldOf(magnet, operate), row.sensitivity, relative(row.sensitivity, 1e-9), `${row.part} on the ${magnet.name} magnet: the pull-in distance gives back its own field`);
    t.near(P.fieldOf(magnet, release), row.sensitivity * P.DECLARED.release, relative(row.sensitivity, 1e-9), 'and the drop-out distance its own');
    t.ok(release > operate, 'the contacts letting go further out than they took hold');
    const ratio = release / operate;
    t.ok(ratio >= P.RATIO_BAND[0] && ratio <= P.RATIO_BAND[1], `whose ratio ${f3(ratio)} sits inside the guide’s own band`);
  }
  t.ok(P.distanceAt(P.DECLARED.magnets[0], 10) === null, 'a field no magnet here reaches has no distance at all');
}
// The door: the chord, and the triangle the installed gap makes with it.
for (const width of [0.6, 0.85, 1.1]) {
  for (const angle of [0, 0.1, 1, 2.5, 5]) {
    const chord = 2 * width * Math.sin(angle * Math.PI / 360);
    for (const gap of [0.002, 0.005, 0.015]) {
      const separation = P.separationOf(width, gap, angle);
      t.near(separation * separation, gap * gap + chord * chord, relative(separation * separation, 1e-12), `a door ${width} m wide open ${angle}°: the separation closes the triangle`);
      const back = P.angleOf(width, gap, separation);
      if (angle > 0) t.near(back, angle, relative(angle, 1e-9) + 1e-9, 'and the angle comes back from it');
    }
    const straight = 2 * width * Math.sin(angle * Math.PI / 360);
    t.ok(Math.abs(straight - width * angle * Math.PI / 180) < width * (angle * Math.PI / 180) ** 3 / 24 + 1e-15, 'the chord within a whisker of the arc at these angles');
  }
}
t.ok(P.angleOf(0.85, 0.005, 0.004) === 0 && P.angleOf(0.85, 0, 2) === null, 'no angle inside the installed gap, and none past the door’s own reach');
t.ok(P.angleAt(P.DECLARED.magnets[2], 0.85, 0.02, 1.70e-3) === null, 'and none at all when the magnet is already too far when shut');
// The clock.
t.near(P.RUN, P.DECLARED.shown, 1e-12, 'the run is the seconds the file declares');
t.near(P.SLOWER, P.DECLARED.shown / P.DECLARED.live, 1e-12, 'and it is that many times slower than life');
t.ok(P.angleOfClock(0) === 0 && P.angleOfClock(-1) === 0, 'the door shut before Play');
for (const swing of [1, 2.2, 5]) {
  t.near(P.angleOfClock(P.RUN / 2, swing), swing, relative(swing, 1e-12), `a door opened ${swing}° stands widest halfway through`);
  t.near(P.angleOfClock(P.RUN, swing), 0, 1e-12, 'and is shut again at the end');
  t.near(P.angleOfClock(P.RUN * 2, swing), 0, 1e-12, 'and stays shut past the end');
  for (const angle of [swing / 4, swing / 2]) t.near(P.angleOfClock(P.clockOfAngle(angle, swing), swing), angle, relative(angle, 1e-9), 'the clock and the angle it shows agree');
  t.ok(P.clockOfAngle(swing * 1.01, swing) === null, 'and an angle wider than the swing never comes');
}
// The run, rebuilt: the state machine against the field at each moment.
for (const values of [{}, {switch: 3}, {magnet: 2}, {angle: 2.1}, {angle: 2.2}, {width: 1.1}, {magnet: 2, gap: 15, switch: 3}]) {
  const plan = P.reedAlarmPlan(values);
  let opened = false, closed = plan.closes;
  for (let step = 0; step <= 400; step++) {
    const time = P.RUN * step / 400, now = P.reedAlarmAt(plan, time);
    const field = P.fieldOf(plan.magnet, P.separationOf(plan.values.width, plan.gap, P.angleOfClock(time, plan.values.angle)));
    t.near(now.field, field, relative(field, 1e-12), 'the field at this moment is the one the separation gives');
    if (!plan.closes) closed = false;
    else if (closed && field < plan.release) { closed = false; opened = true; }
    else if (!closed && field >= plan.operate) closed = true;
    t.ok(now.closed === closed, `${JSON.stringify(values)} at ${f2(time)} s: the contacts follow the field and what they did before`);
    t.ok(now.sounding === (plan.values.armed === 1 && opened), 'and the panel sounds once the loop has broken, and keeps sounding');
    counts.points++;
  }
  t.ok(plan.closes === (P.fieldOf(plan.magnet, plan.gap) >= plan.operate), 'whether it ever closes is whether the shut door gives enough field');
  if (plan.closes && plan.openAngle !== null && plan.openAngle <= plan.values.angle) t.ok(opened, 'a swing wider than the trip angle always breaks the loop');
  if (plan.openAngle !== null && plan.openAngle > plan.values.angle) t.ok(!opened && plan.openTime === null && plan.closeTime === null, 'and one narrower than it never does, with no times to report');
}
// The invariant that keeps a trip angle inside the swing: five degrees carries
// the magnet further than any release distance in the whole domain.
{
  let longest = 0, shortest = Infinity;
  for (const magnet of P.DECLARED.magnets) for (const row of P.STANDEX) longest = Math.max(longest, P.distanceAt(magnet, row.sensitivity * P.DECLARED.release));
  for (const width of [0.6, 1.1]) shortest = Math.min(shortest, 2 * width * Math.sin(P.DECLARED.swing * Math.PI / 360));
  t.ok(f1(longest * 1000) === '31.9' && f0(shortest * 1000) === '52', 'the longest drop-out distance is 31.9 mm and the shortest full swing 52 mm');
  t.ok(shortest > longest, 'so a door opened all the way always reaches the drop-out, whatever is fitted');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const DRAWN = 1e-6;
const model = M.createReedAlarmModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const rowsOf = item => { const array = item.geometry.attributes.position.array, pairs = array.length / 6; return Array.from({length: pairs}, (_, i) => [[array[6 * i], array[6 * i + 1]], [array[6 * i + 3], array[6 * i + 4]]]); };
const windings = item => {
  const array = item.geometry.attributes.position.array, index = item.geometry.index.array;
  let facing = 0, away = 0;
  for (let k = 0; k < index.length; k += 3) {
    const [a, b, c] = [index[k], index[k + 1], index[k + 2]].map(v => [array[3 * v], array[3 * v + 1]]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross > 1e-12) facing++; else if (cross < -1e-12) away++;
  }
  return {facing, away};
};

// The scales and the chart mappings, worked out again from numbers typed here.
t.ok(M.MM === 0.01 && M.SCALE.door === 1 && M.SCALE.close === 0.02, 'a millimeter is a hundredth of a unit, the door a unit to the meter and the close up two hundredths to the millimeter');
t.ok(f0(1 / M.timesLarger(M.SCALE.door / 1000)) === '10' && f0(M.timesLarger(M.SCALE.close)) === '2', 'so the door is drawn 10 times smaller and the close up twice as large');
{
  const low = 0.01e-3, high = 300e-3, span = Math.log10(high / low);
  t.near(M.fieldX(0), 0.2, 1e-12, 'the field chart starts at the switch itself');
  t.near(M.fieldX(0.06), 0.2 + 1.7, 1e-12, 'and ends where the model stops looking');
  t.near(M.fieldX(0.015), 0.2 + 1.7 * 0.25, 1e-12, 'a quarter of the way out for a quarter of the distance');
  t.ok(M.fieldX(-1) === 0.2 && M.fieldX(1) === 1.9, 'and nothing runs off either end');
  for (const field of [1e-5, 1e-4, 1e-3, 0.3]) t.near(M.fieldY(field), 0.2 + 0.72 * Math.log10(field / low) / span, 1e-12, `${field * 1000} mT up the panel by its logarithm`);
  t.near(M.fieldY(-2e-3), M.fieldY(2e-3), 1e-12, 'a field drawn by its size whichever way it points');
  // The ceiling is a sum of floats, 0.2 plus 0.72, so it is compared as one.
  t.near(M.fieldY(1e-9), 0.2, 1e-12, 'with the panel’s own floor holding it');
  t.near(M.fieldY(9), 0.92, 1e-12, 'and its own ceiling');
  t.near(M.runX(0), 0.2, 1e-12, 'the run chart starts when Play does');
  t.near(M.runX(8), 1.9, 1e-12, 'and ends when the door is shut again');
  t.near(M.runX(2), 0.2 + 1.7 / 4, 1e-12, 'a quarter of the way across at two seconds');
  t.near(M.runY(1e-3), -1.3 + 0.72 * Math.log10(1e-3 / low) / span, 1e-12, 'and up it on the same logarithm as the other chart');
  t.ok(M.fieldText(2e-3) === '2.00 mT' && M.fieldText(2e-4) === '200 μT' && M.fieldText(1e-3) === '1.00 mT', 'millitesla down to a millitesla, then microtesla');
}

const settings = [{}, {switch: 3}, {magnet: 2}, {magnet: 1, gap: 2}, {angle: 2.1}, {angle: 2.2}, {width: 1.1, switch: 1}, {width: 0.6, magnet: 2}, {gap: 15, magnet: 2, switch: 3}, {armed: 0}, {angle: 0.1, gap: 2}];
for (const values of settings) {
  const plan = P.reedAlarmPlan(values);
  for (const time of [0, plan.openTime ?? 1, P.RUN / 2, plan.closeTime ?? 7, P.RUN]) {
    model.reset();
    model.update(values);
    if (time > 0) model.advance(time);
    model.root.updateMatrixWorld(true);
    const state = model.getState(), now = state.now, started = time > 0;
    counts.poses++;
    const angle = started ? now.angle : 0, separation = started ? now.separation : plan.gap;
    t.near(state.angle, angle, relative(angle, 1e-9) + 1e-12, 'the door stands where the clock puts it');

    // The door: the leaf swung about its hinge, the magnet on its edge, the switch beyond it.
    t.near(T.pivot.rotation.z, angle * Math.PI / 180, 1e-9, 'the leaf turned by the angle itself');
    t.near(T.leaf.scale.x, plan.values.width, DRAWN, 'the leaf drawn a unit to the meter');
    t.near(T.switchBody.position.x, (plan.values.width + plan.gap + 0.06 / 2) * 1, DRAWN, 'the switch beyond the latch edge by the installed gap');
    const arc = pointsOf(T.swingArc);
    t.ok(arc.length === 33, 'the swing drawn as an arc');
    for (const [x, y] of arc) { t.ok(Math.abs(Math.hypot(x, y) - plan.values.width) < 1e-6, 'every point of it the same distance from the hinge'); counts.points++; }
    const ticks = pointsOf(T.openTick).length > 0;
    t.ok(ticks === (plan.openAngle !== null && plan.openAngle <= 8), 'a mark where the contacts let go, when the swing reaches it');

    // The close up: the magnet at its distance, the blades together or apart.
    t.near(T.magnetClose.position.x - (-8 + 0) * 0.02, Math.min(separation * 1000, 62 - plan.magnet.width * 1000) * 0.02 + plan.magnet.width * 1000 * 0.02 / 4 - (-8) * 0.02 + 8 * 0.02, 0.2, 'the magnet drawn at the distance it stands, clamped to the window');
    t.ok(T.magnetClose.position.x <= 62 * 0.02 + DRAWN, 'and never outside it');
    const apart = T.bladeTop.position.y - T.bladeBottom.position.y;
    t.ok(state.closed ? Math.abs(apart - 0.9 * 0.02) < DRAWN : Math.abs(apart - (2.2 + 0.9) * 0.02) < DRAWN, 'the blades touching when the contacts are closed and standing apart when they are not');
    t.ok(T.touchMark.visible === state.closed, 'with the touch marked only when they meet');
    for (const arrow of T.fieldArrows) t.near(arrow.userData.length, Math.min(0.5, state.field * 26), DRAWN, 'every field arrow as long as the field, up to the length it is capped at');

    // The field chart: the curve, the dipole, the two levels and the two drops.
    const curve = pointsOf(T.fieldCurve);
    t.ok(curve.length === 161, 'the field drawn across the whole window');
    for (let i = 0; i < 161; i += 23) {
      const sample = plan.curve[i];
      t.near(curve[i][0], 0.2 + 1.7 * sample.distance / 0.06, DRAWN, 'across in distance');
      t.near(curve[i][1], M.fieldY(sample.field), DRAWN, 'up in field');
      t.near(sample.field, P.fieldOf(plan.magnet, sample.distance), relative(sample.field, 1e-12), 'each sample the field at its own distance');
      counts.points++;
    }
    t.near(pointsOf(T.operateLine)[0][1], M.fieldY(plan.operate), DRAWN, 'the level this switch closes at');
    t.near(pointsOf(T.releaseLine)[0][1], M.fieldY(plan.release), DRAWN, 'and the one it opens at');
    t.near(pointsOf(T.operateDrop)[0][0], 0.2 + 1.7 * plan.operateDistance / 0.06, DRAWN, 'dropped at the distance that closes it');
    t.near(pointsOf(T.releaseDrop)[0][0], 0.2 + 1.7 * plan.releaseDistance / 0.06, DRAWN, 'and at the one that opens it');
    t.ok(pointsOf(T.releaseDrop)[0][0] > pointsOf(T.operateDrop)[0][0], 'the further of the two always the release');

    // The loop: whole or broken, with the panel's own lamp.
    t.ok(T.currentMarks.every(mark => mark.visible === state.closed), 'current drawn round the loop only while it is whole');
    t.ok((pointsOf(T.contactGap).length > 0) === !state.closed, 'and the break drawn only when it is not');
    t.ok(T.armedLamp.visible === (plan.values.armed === 1), 'the panel’s lamp lit while it is armed');
    t.ok(T.sounderBox.material.color.getHex() === (state.sounding ? M.COLORS.open : M.COLORS.panel), 'and the sounder colored only while it sounds');

    // The run chart: the whole swing faintly, as far as the clock, and the band.
    t.ok(pointsOf(T.runGuide).length === 121, 'the whole swing drawn faintly');
    if (started) {
      const live = pointsOf(T.runCurve);
      t.ok(live.length === plan.samples.filter(sample => sample.t < state.clock).length + 1, 'the dark curve as far as the clock');
      t.near(live.at(-1)[0], 0.2 + 1.7 * state.clock / 8, DRAWN, 'ending at now');
      t.near(live.at(-1)[1], M.runY(now.field), DRAWN, 'at the field now');
      t.near(pointsOf(T.runCursor)[0][0], 0.2 + 1.7 * state.clock / 8, DRAWN, 'with the cursor at now');
    } else t.ok(pointsOf(T.runCurve).length === 0 && pointsOf(T.runCursor).length === 0, 'and nothing dark before Play');
    const band = rowsOf(T.loopBand);
    t.ok(band.length === 121, 'the loop drawn under it the whole way');
    for (let i = 0; i < 121; i += 17) {
      const whole = P.reedAlarmAt(plan, plan.samples[i].t).closed, depth = band[i][1][1] - band[i][0][1];
      t.near(depth, whole ? 0.03 : 0.05, DRAWN, 'the band deeper where the loop is broken than where it is whole');
      counts.points++;
    }
    t.ok(windings(T.loopBand).away === 0 && windings(T.loopBand).facing > 0, 'and its triangles face the viewer');
  }
}
{
  // No part of the bench runs into another, whatever is fitted.
  const toSystem = new THREE.Matrix4(), local = new THREE.Box3();
  const boxOf = object => {
    const box = new THREE.Box3();
    object.traverse(child => {
      for (let node = child; node; node = node.parent) if (!node.visible) return;
      if (!child.geometry) return;
      child.geometry.computeBoundingBox();
      box.union(local.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld).applyMatrix4(toSystem));
    });
    return box;
  };
  for (const values of [{}, {width: 1.1, gap: 15, magnet: 0}, {width: 0.6, magnet: 2, switch: 3, angle: 5}]) {
    model.reset();
    model.update(values);
    model.advance(P.RUN / 2);
    model.root.updateMatrixWorld(true);
    toSystem.copy(T.system.matrixWorld).invert();
    const boxes = ['door', 'switch', 'field', 'loop', 'run'].map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
    t.ok(boxes.every(([, box]) => !box.isEmpty()), 'every part drawn');
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, A] = boxes[i], [b, B] = boxes[j];
        t.ok(A.max.x + 0.02 <= B.min.x || B.max.x + 0.02 <= A.min.x || A.max.y + 0.02 <= B.min.y || B.max.y + 0.02 <= A.min.y, `the ${a} and the ${b} stay clear of each other`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lesson: every number it quotes is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(P.RUN); return model.getState(); };
const base = run({});
checkTrialNumbers(L.reedAlarmLesson, {
  'The two distances': s => ({'71.57': s.shut * 1000, '1.70': s.operate * 1000, 935: s.release * 1e6, '25.6': s.operateDistance * 1000, '31.9': s.releaseDistance * 1000, '1.247': s.ratio}),
  'A stiffer switch': s => ({'20.4': s.operateDistance * 1000, '25.6': base.operateDistance * 1000, '25.5': s.releaseDistance * 1000, '31.9': base.releaseDistance * 1000, '1.69': s.openAngle, '2.12': base.openAngle, '1.33': s.closeAngle}),
  'A smaller magnet': s => ({'17.72': s.shut * 1000, '71.57': base.shut * 1000, '12.8': s.operateDistance * 1000, '15.9': s.releaseDistance * 1000, '1.02': s.openAngle, '0.79': s.closeAngle, '0.08': Math.abs(s.nearestError) * 1000}),
  'Open it just too little': s => { t.ok(s.openTime === null && s.closeTime === null, 'a swing too narrow never parts the contacts'); return {'31.9': s.releaseDistance * 1000, '2.12': s.openAngle}; },
  'Open it a touch more': s => { t.ok(s.openTime !== null, 'and a tenth of a degree more does'); return {'3.32': s.openTime, '2.12': s.openAngle}; },
  'The gap the installer left': s => { t.ok(!s.closes, 'the loop never closes at all'); return {'3.10': s.operate * 1000, '1.10': s.shut * 1000}; },
  'A wider door': s => ({'1.64': s.openAngle, '2.12': base.openAngle, '1.31': s.closeAngle, '0.33': s.span, '0.43': base.span}),
}, run, t, model);
t.ok(L.reedAlarmLesson.tryIt[3].observe.includes('The loop stays whole the whole way out and back'), 'the fourth trial says in words what its numbers show');

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
for (const [where, text] of texts(L.reedAlarmLesson)) covered(text, {}, `reed alarm ${where}`);

const small = P.reedAlarmPlan({magnet: 2}), medium = P.reedAlarmPlan({magnet: 1});
covered(L.reedAlarmLesson.deeper[0].body, {
  [`pull in at ${f1(P.STANDEX[0].pull * 1000)}, ${f1(P.STANDEX[1].pull * 1000)}, ${f1(P.STANDEX[2].pull * 1000)} and ${f1(P.STANDEX[3].pull * 1000)} mm and drop out only at ${f1(P.STANDEX[0].drop * 1000)}, ${f1(P.STANDEX[1].drop * 1000)}, ${f1(P.STANDEX[2].drop * 1000)} and ${f1(P.STANDEX[3].drop * 1000)} mm`]: 'pull in at 15.0, 13.0, 11.0 and 10.0 mm and drop out only at 17.5, 16.5, 14.5 and 13.5 mm',
  [`${f3(P.RATIO_BAND[0])} to ${f3(P.RATIO_BAND[1])} times the pull-in distance`]: '1.167 to 1.350 times the pull-in distance',
  [`release field as ${f0(100 * P.DECLARED.release)}% of the operate field`]: 'release field as 55% of the operate field',
  [`lands the two distances ${f3(base.ratio)} apart`]: 'lands the two distances 1.247 apart',
}, 'deeper 1');
covered(L.reedAlarmLesson.deeper[1].body, {
  [`from ${f0(P.REED.ampereTurns[0])} to ${f0(P.REED.ampereTurns[1])} AT`]: 'from 10 to 60 AT',
}, 'deeper 2');
covered(L.reedAlarmLesson.deeper[2].body, {
  [`The ${f0(P.DECLARED.magnets[0].width * 1000)} by ${f0(P.DECLARED.magnets[0].depth * 1000)} by ${f0(P.DECLARED.magnets[0].length * 1000)} mm magnet has a moment of ${f3(base.moment)} A·m², and ${f0(P.DECLARED.reach * 1000)} mm out the pole model gives ${f0(base.curve.at(-1).field * 1e6)} μT against the ${f0(base.curve.at(-1).dipole * 1e6)} μT a dipole of that moment would leave, ${f1(100 * Math.abs(base.curve.at(-1).dipole / base.curve.at(-1).field - 1))}% apart`]: 'The 8 by 4 by 6 mm magnet has a moment of 0.199 A·m², and 60 mm out the pole model gives 159 μT against the 184 μT a dipole of that moment would leave, 15.8% apart',
  [`${f1(P.MAGNET.barMoment)} A·m² in a cubic centimeter, works out at ${f0(P.MAGNET.barMagnetization).replace(/,/g, ',')} A/m`]: '0.1 A·m² in a cubic centimeter, works out at 100,000 A/m',
  [`remanence of ${f1(P.DECLARED.remanence)} T`]: 'remanence of 1.3 T',
}, 'deeper 3');
covered(L.reedAlarmLesson.deeper[3].body, {
  // The catalog names a gap in the singular; the sentence lists them in English,
  // so anything over an inch is plural and the last one is joined with an "and".
  [(() => {
    const named = P.CONTACT.gaps.map(item => (item.metres / 0.0254 > 1 ? `${item.name}es` : item.name));
    return `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
  })()]: '1/2 inch, 3/4 inch, 1 inch, 1 1/2 inches, 2 inches and 3 inches',
  [`out to ${f1(base.operateDistance * 1000)} mm, which is their ${base.nearest.name} to within ${f2(Math.abs(base.nearestError) * 1000)} mm, the middle one to ${f1(medium.operateDistance * 1000)} mm against their ${medium.nearest.name}, and the smallest to ${f1(small.operateDistance * 1000)} mm against their ${small.nearest.name}`]: 'out to 25.6 mm, which is their 1 inch to within 0.16 mm, the middle one to 19.7 mm against their 3/4 inch, and the smallest to 12.8 mm against their 1/2 inch',
}, 'deeper 4');
covered(L.reedAlarmLesson.deeper[4].body, {
  [`rated ${f0(P.CONTACT.formA.watts)} W, ${f0(P.CONTACT.formA.volts)} VDC and ${f3(P.CONTACT.formA.amps)} A with no more than ${f3(P.CONTACT.formA.resistance)} Ω`]: 'rated 10 W, 160 VDC and 0.400 A with no more than 0.150 Ω',
  [`rated lower, ${f0(P.CONTACT.formBC.watts)} W, ${f0(P.CONTACT.formBC.volts)} VDC and ${f3(P.CONTACT.formBC.amps)} A`]: 'rated lower, 5 W, 175 VDC and 0.250 A',
}, 'deeper 5');
covered(L.reedAlarmLesson.deeper[5].body, {}, 'deeper 6');
covered(L.reedAlarmLesson.quiz.explanation, {
  [`fallen to ${f0(base.release * 1e6)} μT, ${f1(base.releaseDistance * 1000)} mm away`]: 'fallen to 935 μT, 31.9 mm away',
  [`risen back to ${f2(base.operate * 1000)} mT, ${f1(base.operateDistance * 1000)} mm away`]: 'risen back to 1.70 mT, 25.6 mm away',
  [`a door ${f2(P.REED_ALARM_DEFAULTS.width)} m from hinge to magnet that is ${f2(base.openAngle)}° going out and ${f2(base.closeAngle)}° coming back, a span of ${f2(base.span)}°`]: 'a door 0.85 m from hinge to magnet that is 2.12° going out and 1.69° coming back, a span of 0.43°',
}, 'quiz');
covered(L.reedAlarmLimits, {
  [`${f0(P.DECLARED.magnets[0].width * 1000)} by ${f0(P.DECLARED.magnets[0].depth * 1000)} by ${f0(P.DECLARED.magnets[0].length * 1000)} mm, ${f0(P.DECLARED.magnets[1].width * 1000)} by ${f0(P.DECLARED.magnets[1].depth * 1000)} by ${f0(P.DECLARED.magnets[1].length * 1000)} mm or ${f0(P.DECLARED.magnets[2].width * 1000)} by ${f0(P.DECLARED.magnets[2].depth * 1000)} by ${f0(P.DECLARED.magnets[2].length * 1000)} mm at ${f1(P.DECLARED.remanence)} T`]: '8 by 4 by 6 mm, 6 by 3 by 5 mm or 4 by 2 by 3 mm at 1.3 T',
  [`inside the ${f0(P.MAGNET.remanence[0])} to ${f1(P.MAGNET.remanence[1])} T`]: 'inside the 1 to 1.5 T',
  [`fall to before the blades part, ${f0(100 * P.DECLARED.release)}%`]: 'fall to before the blades part, 55%',
  [`${f1(P.REED_ALARM_DOMAINS.width[0])} to ${f1(P.REED_ALARM_DOMAINS.width[1])} m from hinge to magnet`]: '0.6 to 1.1 m from hinge to magnet',
  [`${f1(P.DECLARED.live)} s in life and ${f0(P.RUN)} s here`]: '0.8 s in life and 8 s here',
}, 'limits');
// The ratio itself is spelled out in the sentence, so it is checked as a word
// against the numbers it stands for.
t.ok(P.SLOWER === 10 && P.RUN / P.DECLARED.live === P.SLOWER && L.reedAlarmLimits.includes('ten times slower'), 'and the ten it is slowed by is the run over the life');

const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`drawn ${f0(1 / M.timesLarger(M.SCALE.door / 1000))} times smaller than true size`]: 'drawn 10 times smaller than true size',
  [`drawn ${f0(M.timesLarger(M.SCALE.close))} times larger`]: 'drawn 2 times larger',
  [`${f1(P.DECLARED.live)} s in life and ${f0(P.RUN)} s here, ${f0(P.SLOWER)} times slower`]: '0.8 s in life and 8 s here, 10 times slower',
}, 'system text');
covered(partText('door'), {
  [`drawn ${f0(1 / M.timesLarger(M.SCALE.door / 1000))} times smaller than true size`]: 'drawn 10 times smaller than true size',
  [`latch edge ${f2(P.REED_ALARM_DEFAULTS.width)} m away`]: 'latch edge 0.85 m away',
}, 'door text');
covered(partText('switch'), {
  [`drawn ${f0(M.timesLarger(M.SCALE.close))} times larger than true size, in a window ${f0(M.CLOSE.window[1] - M.CLOSE.window[0])} mm wide`]: 'drawn 2 times larger than true size, in a window 70 mm wide',
}, 'switch text');
covered(partText('field'), {
  [`across ${f0(P.DECLARED.reach * 1000)} mm`]: 'across 60 mm',
  [`from ${f0(M.CHART.field.low * 1e6)} μT to ${f0(M.CHART.field.high * 1e3)} mT`]: 'from 10 μT to 300 mT',
  [`the ${f0(100 * P.DECLARED.release)}% of it`]: 'the 55% of it',
}, 'field text');
covered(partText('loop'), {
  [`rated ${f0(P.CONTACT.formA.watts)} W, ${f0(P.CONTACT.formA.volts)} V and ${f1(P.CONTACT.formA.amps)} A, with ${f3(P.CONTACT.formA.resistance)} Ω`]: 'rated 10 W, 160 V and 0.4 A, with 0.150 Ω',
}, 'loop text');
covered(partText('run'), {
  [`${f0(P.SLOWER)} times slower than life`]: '10 times slower than life',
  [`the ${f0(P.RUN)} s of the swing`]: 'the 8 s of the swing',
}, 'run text');

{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Field at the reed,Contacts,Operate and release,Trip angle,Hysteresis,Separation,Loop,Alarm,Magnet,Clock,Scales', 'twelve readings, the result first');
  t.ok(find('Field at the reed').value === '71.57 mT' && find('Contacts').value === 'closed' && find('Operate and release').value === '1.70 mT and 935 μT', 'the readings before the swing');
  t.ok(find('Trip angle').value === '2.12° out, 1.69° back' && find('Hysteresis').value === '0.43° wide' && find('Separation').value === '5.0 mm' && find('Loop').value === 'whole' && find('Alarm').value === 'armed and quiet' && find('Magnet').value === '25.6 mm reach' && find('Clock').value === 'before the swing' && find('Scales').value === '10 times smaller', 'and the rest of them');
  t.ok(find('Your result').value.startsWith('Ready · the door is shut'), 'with the door shut before Play');
  checkQuotedText(find('Field at the reed').hint, {'8 by 4 by 6 mm of neodymium at 1.3 T': `${f0(base.magnet.width * 1000)} by ${f0(base.magnet.depth * 1000)} by ${f0(base.magnet.length * 1000)} mm of neodymium at ${f1(P.DECLARED.remanence)} T`, 'within 15.8% of': `within ${f1(100 * Math.abs(base.curve.at(-1).dipole / base.curve.at(-1).field - 1))}% of`}, t);
  checkQuotedText(find('Operate and release').hint, {'come out 1.247 apart': `come out ${f3(base.ratio)} apart`, 'inside the 1.167 to 1.350': `inside the ${f3(P.RATIO_BAND[0])} to ${f3(P.RATIO_BAND[1])}`}, t);
  checkQuotedText(find('Trip angle').hint, {'at 2.12°, where the magnet stands 31.9 mm away': `at ${f2(base.openAngle)}°, where the magnet stands ${f1(base.releaseDistance * 1000)} mm away`, 'at 1.69°, 25.6 mm away': `at ${f2(base.closeAngle)}°, ${f1(base.operateDistance * 1000)} mm away`}, t);
  checkQuotedText(find('Magnet').hint, {'closes MK03-1A66B-500W at 25.6 mm': `closes ${base.row.part} at ${f1(base.operateDistance * 1000)} mm`, 'their 1 inch, 0.16 mm from it': `their ${base.nearest.name}, ${f2(Math.abs(base.nearestError) * 1000)} mm from it`}, t);
  model.update({magnet: 2, gap: 15, switch: 3});
  t.ok(model.getState().readings[0].value.startsWith('The loop never closes'), 'a gap too wide for the magnet is named as one that never closes');
  t.ok(model.getState().readings.find(item => item.label === 'Trip angle').value === 'never closes', 'with no trip angle to give');
  model.reset();
  model.advance(P.RUN);
  t.ok(model.getState().readings[0].value.startsWith('Still sounding'), 'and a run that has broken the loop latches the sounder');
}
for (const lesson of [L.reedAlarmLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, 'a quiz with three options and its answer first');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part named is a part the model has');
  t.ok(lesson.steps.length === 5 && lesson.deeper.length === 6 && lesson.tryIt.length === 7 && lesson.parts.length === 6, 'five steps, six deeper sections, seven trials and six parts');
}
t.ok(safetyLessons['Magnetic burglar alarm'] === L.reedAlarmLesson, 'the safety corner routes to this lesson');
t.ok(Object.values(houseComponents).every(component => component.machine !== 'Magnetic burglar alarm'), 'and no component page hangs off it');
{
  const routed = createSafetyModel('Magnetic burglar alarm');
  t.ok(routed !== null && routed.controls.map(control => control.key).join() === 'angle,switch,gap,magnet,width,armed', 'the safety corner builds this model and no other');
  routed?.dispose();
  t.ok(previewEntryIds.includes('magnetic-burglar-alarm'), 'and the preview shows it');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) {
  const [lo, hi, step] = P.REED_ALARM_DOMAINS[control.key];
  t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.REED_ALARM_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`);
}
t.ok(model.controls.map(control => control.key).join() === 'angle,switch,gap,magnet,width,armed', 'six controls');
assert.deepEqual(model.controls.find(control => control.key === 'switch').options.map(option => [option.value, option.label]), P.SWITCH_OPTIONS.map(option => [option.value, option.label]));
assert.deepEqual(model.controls.find(control => control.key === 'magnet').options.map(option => [option.value, option.label]), P.MAGNET_OPTIONS.map(option => [option.value, option.label]));
assert.deepEqual(model.controls.find(control => control.key === 'armed').options.map(option => [option.value, option.label]), P.ARMED_OPTIONS.map(option => [option.value, option.label]));
const drawing = () => [
  pointsOf(T.fieldCurve).slice(0, 8), pointsOf(T.runGuide).slice(0, 8), pointsOf(T.swingArc).slice(0, 5),
  pointsOf(T.operateDrop), pointsOf(T.releaseDrop), pointsOf(T.separationLine),
  T.magnetClose.position.toArray(), T.bladeTop.position.toArray(), T.nowDot.position.toArray(), T.leaf.scale.toArray(), T.pivot.rotation.z,
  T.fieldArrows[0].userData.length, Array.from(T.loopBand.geometry.attributes.position.array.slice(0, 12)),
  T.armedLamp.visible, T.touchMark.visible, T.currentMarks[0].visible, T.sounderBox.material.color.getHex(),
];
checkControlsMove(model, drawing, item => item.advance(2), t);
checkRefusals(P.sampleReedAlarm, P.REED_ALARM_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the swing');
{
  const before = JSON.stringify(model.getState().readings);
  const named = /([\d.]+) s/.exec(model.playback.stepLabel);
  t.ok(named !== null, 'the step button names the seconds it advances');
  model.playback.step();
  t.near(model.getState().clock, Number(named[1]), 1e-12, 'and advances exactly that many');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result to inspect partway through');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, Number(named[1]) + 0.5, 1e-12, 'animation winds it on by the time that passed');
  model.advance(P.RUN);
  t.ok(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'run', 'the swing over, with the run to inspect');
  t.ok(model.playback.blocked() === false, 'a transport the viewer can drive');
  const held = JSON.stringify([pointsOf(T.runCurve).length, T.pivot.rotation.z]);
  model.animate(30);
  model.advance(50);
  t.near(model.getState().clock, P.RUN, 1e-12, 'the clock stops at the end of the run, however long Play is left on');
  t.ok(JSON.stringify([pointsOf(T.runCurve).length, T.pivot.rotation.z]) === held, 'and nothing moves past the end');
  checkFinite(model.root, t);
  assert.deepEqual(model.actions.map(action => action.part), ['switch', 'switch', 'field', 'loop', 'run']);
  assert.deepEqual(model.actions.map(action => action.label), ['Inspect: the switch before the door moves', 'Inspect: the moment the contacts part', 'Inspect: the two distances', 'Inspect: the loop', 'Inspect: the whole swing']);
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part) && action.view === 'front', `${action.label} returns readings and names a part`);
    checkFinite(model.root, t);
  }
  t.ok(model.frameVisibleOnly === true && model.framePadding === 0.62 && model.initialPart === 'system' && model.initialView === 'front' && model.selectionOutline === false && model.transparentBackground === true, 'the viewer frames what is shown, opening on the whole system from the front');
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  for (const values of settings) {
    for (const seconds of [0, 2, P.RUN]) {
      model.reset();
      model.update(values);
      model.advance(seconds);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')) && !/\b(centre|colour|grey|metre|aluminium)\b/i.test(item.hint || ''), `reading text without dashes: ${item.label}`);
      checkFinite(model.root, t);
    }
  }
}
const released = checkDisposal((() => { const fresh = M.createReedAlarmModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS magnetic burglar alarm: ${t.count} checks, ${counts.poses} poses, ${counts.points} drawn points read back, ${counts.fields} fields rebuilt from the charge on the pole faces, ${counts.quadrature} quadrature points, ${counts.numbers} quoted numbers traced, 1 lesson, ${released} resources released exactly once.`);

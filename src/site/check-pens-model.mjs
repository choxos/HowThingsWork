// Checks the ballpoint pen, the felt-tip pen, the dip pen and capillary action
// against their physics worked out again by other routes: constants typed in
// from the sources and the pages' own worked examples reproduced, the rise law
// found by integrating Poiseuille's balance, Washburn's law the same way,
// rolling read off the drawn ball, and every drawn length read back off the
// scene at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './pens-physics.js';
import * as BP from './ballpoint-model.js';
import * as FT from './felt-tip-model.js';
import * as DP from './dip-pen-model.js';
import {ballpointLesson, feltTipLesson, dipPenLesson, capillaryActionLesson, ballpointLimits, feltTipLimits, dipPenLimits, capillaryLimits} from './pens-lessons.js';
import {houseComponents} from './house-components.js';

const t = tally();
const counts = {rises: 0, strips: 0, rolls: 0, specks: 0, poses: 0, charts: 0};
const g = 9.81;
const rad = degrees => degrees * Math.PI / 180;
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-15;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the pages' worked examples.
// ---------------------------------------------------------------------------

const SRC = {
  Water: {tension: 72.8 / 1000, density: 1000, viscosity: 1.0016 / 1000, angle: 0},
  Ethanol: {tension: 22.27 / 1000, density: 0.78945 * 1000, viscosity: 1.2 / 1000, angle: 0},
  Mercury: {tension: 486.5 / 1000, density: 13.546 * 1000, viscosity: 1.526 / 1000, angle: 140},
};
for (const liquid of P.LIQUIDS) for (const key of ['tension', 'density', 'viscosity', 'angle']) t.near(liquid[key], SRC[liquid.name][key], relative(SRC[liquid.name][key]), `${liquid.name} ${key} as sourced`);
t.ok(P.G === g, 'gravity as the worked example has it');
const jurin = (L, r) => 2 * L.tension * Math.cos(rad(L.angle)) / (L.density * g * r);
t.ok(Number((2 * 0.0728 / (1000 * 9.81)).toPrecision(3)) === 1.48e-5, 'the pages’ 1.48 × 10^-5 m²');
t.ok(fixed(1000 * jurin(SRC.Water, 2), 3) === '0.007', 'a 2 m tube: the page’s 0.007 mm');
t.ok(fixed(1000 * jurin(SRC.Water, 0.02), 1) === '0.7', 'a 2 cm tube: the page’s 0.7 mm, rounded from 0.742');
t.ok(Number((1000 * jurin(SRC.Water, 2e-4)).toPrecision(1)) === 70, 'a 0.2 mm tube: the page’s 70 mm, rounded from 74.2');
for (const liquid of P.LIQUIDS) for (const r of [2e-4, 1e-4, 5e-4]) t.near(P.jurinHeight(liquid, r), jurin(SRC[liquid.name], r), relative(jurin(SRC[liquid.name], r), 1e-11), `${liquid.name}: Jurin’s law`);
t.near(1000 * Math.sqrt(SRC.Water.tension / (SRC.Water.density * g)), 2.71, 0.02, 'the capillary length page’s 2.71 mm for water, from a slightly lower surface tension');
for (const liquid of P.LIQUIDS) {
  t.near(P.capillaryLength(liquid), Math.sqrt(SRC[liquid.name].tension / (SRC[liquid.name].density * g)), 1e-15, `${liquid.name}: capillary length`);
  t.ok(1000 * P.capillaryLength(liquid) > P.DIP_DOMAINS.radius[1], `${liquid.name}: every tube is narrower than the capillary length, as Jurin’s law needs`);
}
const puddle = (tension, density, angle) => Math.sqrt(2 * tension * (1 - Math.cos(rad(angle))) / (9.81 * density));
t.ok(fixed(100 * puddle(0.487, 13500, 140), 2) === '0.36', 'the surface tension page’s mercury puddle, 0.36 cm, at 140°');
t.ok(fixed(100 * puddle(0.072, 1000, 107), 2) === '0.44', 'the surface tension page’s water on paraffin, 0.44 cm');
assert.deepEqual([...P.BALL_SIZES], [0.3, 0.38, 0.4, 0.5, 0.7, 0.8, 1.0, 1.2, 1.4]);
t.ok(P.BALL_SIZES.every(size => size >= 0.28 && size <= 1.6), 'every ball inside the 0.28 to 1.6 mm the page gives');
t.ok(P.BALLPOINT.nitrogen === 310, 'the Space Pen’s nearly 310 kPa');

// ---------------------------------------------------------------------------
// 2. The pull of a curved surface balances the column.
// ---------------------------------------------------------------------------

for (const liquid of P.LIQUIDS) {
  for (let i = 0; i <= 8; i++) {
    const r = (0.1 + 0.05 * i) / 1000, h = jurin(SRC[liquid.name], r), sphere = r / Math.abs(Math.cos(rad(liquid.angle)));
    t.near(P.pullOf(liquid, r), liquid.density * g * h, relative(liquid.density * g * h, 1e-11), `${liquid.name}: the pull balances the column’s weight`);
    t.near(Math.abs(P.pullOf(liquid, r)), 2 * liquid.tension / sphere, relative(2 * liquid.tension / sphere, 1e-11), `${liquid.name}: Young and Laplace for the meniscus sphere`);
  }
}

// ---------------------------------------------------------------------------
// 3. The rise law, by integrating Poiseuille's balance: dt/dL = shape η L / (ρ g gap² (L∞ − L)).
// ---------------------------------------------------------------------------

function riseTimeByQuadrature(liquid, gap, shape, depth, length, n = 20000) {
  const s = SRC[liquid.name], eq = depth + jurin(s, gap), k = s.density * g * gap * gap / (shape * s.viscosity);
  const f = L => L / (k * (eq - L)), h = length / n;
  let sum = f(0) + f(length);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(i * h);
  return sum * h / 3;
}
for (const liquid of P.LIQUIDS) {
  for (let i = 0; i <= 8; i++) {
    const r = (0.1 + 0.05 * i) / 1000;
    for (const shape of [P.TUBE, P.PLATES]) {
      const ch = P.channel(liquid, r, shape, P.BENCH.depth / 1000);
      t.near(ch.eq, P.BENCH.depth / 1000 + jurin(SRC[liquid.name], r), 1e-15, 'final length: the dip and Jurin’s height');
      if (ch.eq <= 0) { t.ok(P.riseAt(ch, 100) === 0, `${liquid.name} in ${r * 1000} mm stays out`); continue; }
      for (const share of [0.1, 0.5, 0.9]) {
        const quad = riseTimeByQuadrature(liquid, r, shape, P.BENCH.depth / 1000, share * ch.eq);
        t.near(P.riseTime(ch, share * ch.eq), quad, relative(quad, 1e-7), `${liquid.name} ${r * 1000} mm: time to ${share} of the way`);
        t.near(P.riseAt(ch, quad), share * ch.eq, relative(ch.eq, 1e-7), `${liquid.name} ${r * 1000} mm: the length after that time`);
        counts.rises++;
      }
    }
    const tube = P.channel(liquid, r, P.TUBE, 0.015), plates = P.channel(liquid, r, P.PLATES, 0.015);
    if (tube.eq > 0) for (const share of [0.2, 0.6, 0.95]) t.near(P.riseTime(plates, share * plates.eq), 1.5 * P.riseTime(tube, share * tube.eq), relative(P.riseTime(plates, share * plates.eq), 1e-12), 'plates reach each length 1.5 times as late as a tube of the same gap');
  }
}
{
  const slit = P.channel(P.WATER, P.NIB.gap / 1000, P.PLATES, P.NIB.dip / 1000), quad = riseTimeByQuadrature(P.WATER, P.NIB.gap / 1000, P.PLATES, P.NIB.dip / 1000, P.NIB.slit / 1000);
  t.near(P.dipPenPlan({}).fill, quad, relative(quad, 1e-7), 'the nib’s slit fills to the vent hole in the time Poiseuille’s balance gives');
}
for (const s of [0, 0.3, 1, 2.5, 4, 6]) t.near(P.clockSeconds(P.clockTime(s)), s, 1e-12, 'the log clock turns back');
t.near(P.clockTime(6), 1000 - 0.001, 1e-9, 'the clock reaches 1,000 s');

// Washburn's law by integrating dt/dL = 4 η L / (r γ cos θ).
for (const liquid of [P.WATER, P.ETHANOL]) {
  for (const r of [5e-6, 1e-5, 5e-5]) for (const L of [1e-3, 1e-2]) {
    const s = SRC[liquid.name], n = 2000, h = L / n;
    let sum = 0;
    for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * 4 * s.viscosity * (i * h) / (r * s.tension);
    const time = sum * h / 3;
    t.near(P.washburnTime(liquid, r, L), time, relative(time, 1e-12), `${liquid.name}: Washburn’s time`);
    t.near(P.washburnLength(liquid, r, time), L, relative(L, 1e-12), `${liquid.name}: Washburn’s length`);
  }
}
t.near(P.paceRatio(P.ETHANOL), Math.sqrt((22.27e-3 / 1.2e-3) / (72.8e-3 / 1.0016e-3)), 1e-15, 'ethanol soaks in at the square root of its surface tension over viscosity, against water’s');

// ---------------------------------------------------------------------------
// Scene helpers.
// ---------------------------------------------------------------------------

const pose = (model, values, seconds = 0) => { model.reset(); model.update(values); if (seconds > 0) model.advance(seconds); model.root.updateMatrixWorld(true); return model.getState(); };
const span = (mesh, scale) => [0, 1, 2].map(axis => [(mesh.position.getComponent(axis) - mesh.scale.getComponent(axis) / 2) / scale, (mesh.position.getComponent(axis) + mesh.scale.getComponent(axis) / 2) / scale]);
const points = line => { const array = line.geometry.attributes.position.array, out = []; for (let i = 0; i < line.geometry.drawRange.count; i++) out.push([array[3 * i], array[3 * i + 1], array[3 * i + 2]]); return out; };
function drawing(model) {
  const out = [];
  model.root.updateMatrixWorld(true);
  model.root.traverse(object => {
    if (!object.isMesh && !object.isLine) return;
    const array = object.geometry.attributes.position?.array || [];
    let sum = 0;
    for (let i = 0; i < array.length; i++) sum += array[i] * ((i % 7) + 1);
    out.push([object.visible, object.matrixWorld.elements.map(value => Math.round(value * 1e7)).join(','), Math.round(sum * 1e5), object.material.color?.getHex() ?? 0, object.geometry.drawRange.count]);
  });
  return out;
}
const arrowDirection = arrow => new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);

// ---------------------------------------------------------------------------
// 4. The ballpoint pen, read off its drawing.
// ---------------------------------------------------------------------------

const ballpoint = BP.createBallpointModel(), B = ballpoint.topology;
for (const ball of P.BALL_SIZES) {
  for (let place = 0; place < 4; place++) {
    for (const refill of [0, 1]) {
      for (const seconds of [0, 0.03, 0.08, 0.5, 1.7, 3.3, 5, 9]) {
        const s = pose(ballpoint, {ball, place, refill}, seconds), now = s.now, radius = ball / 2;
        const travel = Math.min(50, 10 * seconds), angle = [0, 90, 180, 0][place], share = [1, 0, -1, 0][place], feeds = refill === 1 || place !== 2, delay = Math.PI * ball / 2;
        t.near(now.travel, travel, 1e-12, 'travel at 10 mm a second');
        t.near(now.turns, travel / (Math.PI * ball), 1e-12, 'turns: travel over π times the diameter');
        t.near(B.setup.rotation.z, rad(angle), 1e-15, 'the pen’s frame turned to where it writes');
        if (place !== 3) t.near(Math.cos(rad(angle)), share, 1e-15, 'the share along the refill is the cosine of its angle to straight down');
        else t.ok(share === 0 && s.place.angle === null, 'in orbit no weight, so no share');
        t.near(B.pen.position.x / BP.MM, travel, 1e-9, 'the pen at the end of its travel');
        t.near(B.ball.scale.x / BP.MM, radius, 1e-12, 'the ball at true size');
        t.near(B.ball.position.y / BP.MM, radius, 1e-12, 'the ball resting on the paper');
        t.near(B.ball.rotation.z, -travel / radius, 1e-9, 'the ball turned by its travel over its radius');
        t.near(B.bigBall.rotation.z, B.ball.rotation.z, 1e-12, 'the close up turns with the pen’s ball');
        t.near(B.bigBall.scale.x / BP.MM, BP.DETAIL * radius, 1e-9, 'the close up 40 times larger');
        // The line, from where the ink first reached the paper.
        const line = feeds ? Math.max(0, travel - delay) : 0;
        t.near(now.line, line, 1e-12, 'the line starts half a turn after the ball begins to roll');
        t.ok(B.line.visible === line > 0, 'the line shows once it has length');
        if (line > 0) {
          const [[x0, x1], , [z0, z1]] = span(B.line, BP.MM);
          t.near(x0, delay, 1e-9, 'the line starts where the ink first reached the paper');
          t.near(x1, delay + line, 1e-9, 'the line ends under the ball');
          t.near(z1 - z0, 0.5 * ball, 1e-9, 'the line drawn half as wide as the ball');
        }
        // The specks carrying ink.
        const reach = (feeds ? Math.min(travel, delay) : 0) / radius;
        B.specks.forEach((speck, i) => {
          let along = (travel / radius - 2 * Math.PI * i / BP.SPECKS) % (2 * Math.PI);
          if (along < 0) along += 2 * Math.PI;
          t.ok((speck.material === B.inkMaterial) === (along <= Math.min(reach, Math.PI) + 1e-12), 'a speck carries ink from the top until it reaches the paper');
          counts.specks++;
        });
        // The refill.
        const inkSpan = span(B.ink, BP.MM)[1];
        t.near(inkSpan[0], BP.REFILL.socket + (feeds ? 0 : BP.REFILL.pulled), 1e-9, 'the ink rests on the ball unless gravity pulls it back');
        t.near(inkSpan[1] - inkSpan[0], P.BALLPOINT.column, 1e-9, 'a 60 mm column of ink');
        t.ok(B.float.visible === (refill === 1) && B.gas.visible === (refill === 1) && B.seal.visible === (refill === 1), 'a float, nitrogen and a seal only in the pressurized refill');
        // The weight and its share along the refill, on one scale.
        t.ok(B.weightArrow.visible === (place !== 3), 'in orbit nothing weighs');
        if (place !== 3) {
          t.near(B.weightArrow.userData.length, BP.ARROW.length * BP.MM, 1e-12, 'the full weight 30 mm long');
          t.near(arrowDirection(B.weightArrow).y, -1, 1e-12, 'the weight points straight down');
          t.near(B.shareArrow.userData.length, Math.abs(share) * BP.ARROW.length * BP.MM, 1e-12, 'the share on the same scale');
          if (share !== 0) {
            const d = arrowDirection(B.shareArrow), want = [share * Math.sin(rad(angle)), -share * Math.cos(rad(angle))];
            t.near(d.x, want[0], 1e-9, 'the share points along the refill');
            t.near(d.y, want[1], 1e-9, 'toward the ball or away from it');
          }
        }
        t.ok(ballpoint.getState().readings[0].value.length > 0, 'a result reading');
        counts.poses++;
      }
      // Rolling without slipping, read off the drawn ball: the point touching the paper does not move.
      for (const seconds of [0.7, 2.2, 4.1]) {
        pose(ballpoint, {ball, place, refill}, seconds);
        const turn = -B.ball.rotation.z, local = new THREE.Vector3(Math.sin(turn), -Math.cos(turn), 0);
        const before = B.ball.localToWorld(local.clone()), center = B.ball.localToWorld(new THREE.Vector3());
        ballpoint.advance(1e-5);
        ballpoint.root.updateMatrixWorld(true);
        const after = B.ball.localToWorld(local.clone()), moved = B.ball.localToWorld(new THREE.Vector3()).distanceTo(center);
        t.near(moved, 10 * 1e-5 * BP.MM, 1e-12, 'the ball’s center moves at the writing speed');
        t.ok(after.distanceTo(before) < 1e-3 * moved, 'the point touching the paper stays put');
        counts.rolls++;
      }
    }
  }
}
t.near(P.ballpointPlan({}).weight, 1000 * g * 0.06, 1e-9, 'a 60 mm column of water weighs 588.6 Pa');
assert.throws(() => P.ballpointPlan({ball: 0.31}), RangeError, 'only standard balls');

// ---------------------------------------------------------------------------
// 5. The felt-tip pen, read off its drawing.
// ---------------------------------------------------------------------------

const felt = FT.createFeltTipModel(), F = felt.topology;
const paceOf = ink => 0.5 * Math.sqrt((SRC[ink.name].tension / SRC[ink.name].viscosity) / (SRC.Water.tension / SRC.Water.viscosity));
for (const ink of [0, 1]) {
  for (let speed = 5; speed <= 40; speed += 5) {
    const liquid = P.INKS[ink], pace = paceOf(liquid), dwell = 1 / speed, width = 1 + 2 * pace * Math.sqrt(dwell), stroke = 40 / speed;
    for (const seconds of [0, 0.4, stroke / 2, stroke - 0.01, stroke + 0.3, stroke + 1.1, stroke + 2, stroke + 5]) {
      const s = pose(felt, {ink, speed}, seconds), travel = Math.min(40, speed * Math.min(seconds, stroke + 2)), rest = Math.min(2, Math.max(0, Math.min(seconds, stroke + 2) - stroke));
      t.near(s.width, width, 1e-12, 'line width: the tip and the soaking on each side');
      t.near(F.pen.position.x / FT.MM, travel, 1e-9, 'the pen at the end of its line');
      t.ok(F.line.visible === travel > 0, 'the line shows once the pen moves');
      if (travel > 0) {
        const [[x0, x1], [y0, y1], [z0, z1]] = span(F.line, FT.MM);
        t.near(x0, 0, 1e-9, 'the line starts where the pen landed');
        t.near(x1, travel, 1e-9, 'the line reaches the pen');
        t.near(z1 - z0, width, 1e-9, 'the drawn line is as wide as the ink soaked');
        t.near(y1 - y0, FT.FILM, 1e-12, 'the ink film');
        t.near(F.endCap.scale.x / FT.MM, width / 2, 1e-9, 'the line’s round end under the tip');
        t.near(F.endCap.position.x / FT.MM, travel, 1e-9, 'the round end at the tip');
      }
      const blot = rest > 0 ? 0.5 + pace * Math.sqrt(dwell + rest) : 0;
      t.ok(F.blot.visible === blot > 0, 'a blot only once the pen rests');
      if (blot > 0) {
        t.near(F.blot.scale.x / FT.MM, blot, 1e-9, 'the blot grows with the square root of time under the tip');
        t.near(F.blot.position.x / FT.MM, 40, 1e-9, 'the blot where the line ends');
      }
      const pulls = [2 * liquid.tension / 50e-6, 2 * liquid.tension / 10e-6];
      F.bars.forEach((bar, i) => t.near(bar.scale.y / FT.MM / FT.KPA, pulls[i] / 1000, 1e-9, 'each pore’s pull, 5 mm for every kPa'));
      const cursor = points(F.cursor), soakTime = rest > 0 ? dwell + rest : Math.min(dwell, seconds), point = FT.chartPoint(soakTime, pace * Math.sqrt(soakTime));
      t.near((cursor[0][0] + cursor[1][0]) / 2, point[0], 1e-6, 'the chart’s cross at the spot under the tip');
      t.near(cursor[0][1], point[1], 1e-6, 'at the depth it has soaked');
      counts.poses++;
    }
  }
}
F.curves.forEach((curve, i) => {
  const pace = paceOf(P.INKS[i]);
  for (const [x, y] of points(curve)) {
    const time = (x - FT.CHART.x) / FT.CHART.w * FT.CHART.time, soak = (y - FT.CHART.y) / FT.CHART.h * FT.CHART.soak;
    if (soak < FT.CHART.soak - 1e-6) t.near(time, (soak / pace) ** 2, 1e-5, 'the chart’s curve soaks with the square root of time, read back as the time each depth takes');
    counts.charts++;
  }
});
for (const [i, size] of [50, 10].entries()) {
  const box = new THREE.Box3().setFromBufferAttribute(F.poreInks[i].geometry.attributes.position);
  t.near((box.max.x - box.min.x) / 2 / FT.MM, size / 1000 * FT.PORES, 1e-6, 'each pore drawn 200 times larger');
  t.near((box.max.y - box.min.y) / FT.MM, FT.CLOSE.tall, 1e-6, 'the pores as tall as drawn');
}
t.near(P.feltTipPlan({speed: 5}).spread, 2 * P.feltTipPlan({speed: 20}).spread, 1e-15, 'four times as long under the tip soaks twice as far');

// ---------------------------------------------------------------------------
// 6. The dip pen and the bench, read off their drawing.
// ---------------------------------------------------------------------------

const dip = DP.createDipPenModel(), D = dip.topology;
for (let liquid = 0; liquid < 3; liquid++) {
  for (let i = 0; i <= 8; i++) {
    const radius = Number((0.1 + 0.05 * i).toFixed(2)), L = P.LIQUIDS[liquid], h = 1000 * jurin(SRC[L.name], radius / 1000), enters = 15 + h > 0;
    for (const seconds of [0, 0.5, 1.5, 2.3, 3, 3.8, 4.6, 6]) {
      const s = pose(dip, {liquid, radius}, seconds), time = P.clockTime(seconds), tube = P.channel(L, radius / 1000, P.TUBE, 0.015);
      t.ok(s.enters === enters, `${L.name} ${radius} mm: gets in only if the depression is shallower than the dip`);
      t.near(D.tubeGlass.scale.x / DP.MM, DP.WIDEN * radius + DP.LAYOUT.wall, 1e-9, 'the tube’s bore drawn 10 times wider');
      t.near(D.column.scale.x / DP.MM, DP.WIDEN * radius, 1e-9, 'the column fills the widened bore');
      const [, [y0, y1]] = span(D.column, DP.MM), top = enters ? -15 + 1000 * P.riseAt(tube, time) : -15;
      t.ok(D.column.visible === top > -15 + 1e-9, 'the column shows while there is liquid in the tube');
      if (D.column.visible) {
        t.near(y0, -15, 1e-9, 'the column starts at the tube’s bottom end');
        t.near(y1, top, 1e-7, 'the column’s top where the rise law puts it');
      }
      t.ok(D.menColumn.visible === enters && D.tangents.visible === enters, 'the meniscus close up shows the shape of any liquid that gets in');
      // The wedge's strips.
      const array = D.sheet.geometry.attributes.position.array, levels = [];
      for (let j = 0; j <= DP.LAYOUT.strips; j++) {
        const x = 40 * j / DP.LAYOUT.strips, gap = 0.1 + 0.9 * x / 40, strip = P.channel(L, gap / 1000, P.PLATES, 0.015), top = -15 + 1000 * P.riseAt(strip, time);
        t.near(array[6 * j] / DP.MM, 45 + x, 1e-4, 'the strip across the wedge');
        t.near(array[6 * j + 1] / DP.MM, -15, 1e-4, 'the strip from the plates’ bottom edge');
        t.near(array[6 * j + 4] / DP.MM, top, 2e-4, 'the strip’s top where the rise law puts it');
        if (seconds === 6 && strip.eq > 0) levels.push(top * gap);
        counts.strips++;
      }
      if (seconds === 6 && levels.length) for (const product of levels) t.near(product, 1e6 * 2 * L.tension * Math.cos(rad(L.angle)) / (L.density * g), 2e-4, 'settled, the gap times the height is the same across the wedge');
      const mark = points(D.matchMark);
      t.near(0.1 + 0.9 * (mark[0][0] / DP.MM - 45) / 40, radius, 1e-5, 'the mark where the wedge’s gap equals the tube’s radius');
      // The chart.
      const curve = points(D.tubeCurve);
      t.ok(curve.length === (enters ? DP.CHART.points : 0), 'a curve only for a liquid that gets in');
      for (const [x, y] of curve) {
        const at = 10 ** (DP.CHART.first + (x - DP.CHART.x) / DP.CHART.w * DP.CHART.decades), level = DP.CHART.low + (y - DP.CHART.y) / DP.CHART.h * (DP.CHART.high - DP.CHART.low);
        t.near(level, -15 + 1000 * P.riseAt(tube, at), 3e-3, 'the chart’s curve follows the rise law');
        counts.charts++;
      }
      if (enters && time > 0) {
        const cross = points(D.tubeCursor);
        t.near((cross[0][0] + cross[1][0]) / 2, DP.chartX(time), 1e-6, 'the chart’s cross at the time since dipping');
        t.near(cross[0][1], DP.chartY(s.now.level), 1e-6, 'at the tube’s level');
        const plateLevel = -15 + 1000 * P.riseAt(P.channel(L, radius / 1000, P.PLATES, 0.015), time), plateCross = points(D.platesCursor);
        t.near(s.now.plateLevel, plateLevel, 1e-9, 'the plates’ level where their rise law puts it');
        t.near(plateCross[0][1], DP.chartY(plateLevel), 1e-6, 'the faint cross at the plates’ level');
      }
      // The nib's slit.
      const slit = P.channel(P.WATER, 2e-5, P.PLATES, 0.003), inSlit = Math.min(1000 * P.riseAt(slit, time), 10), ink = points(D.slitInk);
      t.near(s.now.slit, inSlit, 1e-9, 'ink up the slit from the tip, stopping at the vent hole');
      if (inSlit > 0) t.near(ink[1][1] / DP.MM + 3, inSlit, 1e-4, 'the drawn ink up the slit');
      counts.poses++;
    }
  }
}
t.ok(DP.CHART.first === Math.log10(P.CLOCK.first) && DP.CHART.decades === P.CLOCK.decades, 'the chart spans the clock, from 1 ms to 1,000 s');
// The meniscus: a sphere meeting the glass at the contact angle.
for (const angle of [0, 140]) {
  const curve = DP.meniscusCurve(angle, 10, 20000), c = Math.cos(rad(angle)), R = 10 / Math.abs(c);
  t.near(curve[0][0], 10, 1e-12, 'the surface meets the wall');
  t.near(curve[0][1], 0, 1e-9, 'at the height it meets it');
  const [[r0, y0], [r1, y1]] = curve, inward = Math.hypot(r1 - r0, y1 - y0), met = Math.acos(-(y1 - y0) / inward) * 180 / Math.PI;
  t.near(met, angle, 1.2, 'the surface leaves the wall at the contact angle, through the liquid');
  const center = c > 0 ? Math.sqrt(R * R - 100) : -Math.sqrt(R * R - 100);
  for (const [rho, y] of curve.filter((_, i) => i % 500 === 0)) t.near(Math.hypot(rho, y - center), R, 1e-9, 'every point on one sphere');
  t.ok(c > 0 ? curve.at(-1)[1] < 0 : curve.at(-1)[1] > 0, angle ? 'mercury bulges up in the middle' : 'water dips in the middle');
}
for (let liquid = 0; liquid < 3; liquid++) {
  pose(dip, {liquid, radius: 0.5}, 6);
  const tangent = points(D.tangents), angle = P.LIQUIDS[liquid].angle, d = [(tangent[1][0] - tangent[0][0]) / DP.MM, (tangent[1][1] - tangent[0][1]) / DP.MM];
  t.near(d[0], -Math.sin(rad(angle)) * DP.MENISCUS.tangent, 1e-4, 'the drawn tangent turns in from the right wall');
  t.near(d[1], -Math.cos(rad(angle)) * DP.MENISCUS.tangent, 1e-4, 'at the contact angle from straight down the wall');
}
// The tines close up.
for (let press = 0; press <= 1.0001; press += 0.1) {
  const value = Number(press.toFixed(1)), s = pose(dip, {press: value}), tipGap = 0.02 + 0.1 * value, line = 0.1 + 0.1 * value;
  t.near(s.tipGap, tipGap, 1e-12, 'the tip opens by the splay');
  t.near(s.flow, (tipGap / 0.02) ** 3, 1e-9, 'flow between plates with the cube of the gap');
  t.near(s.hold, 1000 * jurin(SRC.Water, tipGap / 1000), 1e-9, 'the widened slit still holds ink this high');
  const box = new THREE.Box3().setFromBufferAttribute(D.gapInk.geometry.attributes.position), tine = new THREE.Box3().setFromBufferAttribute(D.tines[1].geometry.attributes.position);
  t.near((box.max.x - box.min.x) / DP.MM / DP.TIP, tipGap, 1e-5, 'the ink between the tines as wide as the tip opens');
  const tineVertices = D.tines[1].geometry.attributes.position.array;
  let tipOuter = -Infinity;
  for (let i = 0; i < tineVertices.length; i += 3) if (Math.abs(tineVertices[i + 1]) < 1e-9) tipOuter = Math.max(tipOuter, tineVertices[i]);
  t.near(tipOuter / DP.MM / DP.TIP, line / 2, 1e-5, 'the tines’ tips span the line');
  t.near(tine.min.x / DP.MM / DP.TIP, 0.02 / 2 + 0.1 * value / 2 * (1 - DP.TIP_WINDOW / 10), 1e-5, 'the tines hinge at the vent hole, 10 mm up, closing toward it');
  const [[x0, x1]] = span(D.tipLine, DP.MM);
  t.near((x1 - x0) / DP.TIP, line, 1e-9, 'the line as wide as the tines’ tips');
  counts.poses++;
}

// ---------------------------------------------------------------------------
// 7. Lessons: every number a trial quotes, and the free text.
// ---------------------------------------------------------------------------

const settled = (model, values) => pose(model, values, 1e3);
const ballAt = values => settled(ballpoint, values);
checkTrialNumbers(ballpointLesson, {
  'Write a line': s => ({'22.74': s.now.turns, '50': P.BALLPOINT.line, '1.100': s.delay, '48.9': s.now.line}),
  'A fine ball': s => ({'53.05': s.now.turns, '50': P.BALLPOINT.line, '0.942': s.circumference, '0.471': s.delay}),
  'A broad ball': s => ({'11.37': s.now.turns, '50': P.BALLPOINT.line, '4.398': s.circumference, '0.7': P.BALLPOINT_DEFAULTS.ball}),
  'On a wall': s => { t.ok(s.place.share === 0 && s.feeds, 'sideways, no share and still fed'); return {}; },
  'On the ceiling': s => { t.ok(s.place.share === -1 && !s.feeds && s.now.line === 0, 'pointed up, the ordinary refill lays no line'); return {'588.6': s.weight}; },
  'A pressurized refill': s => { t.ok(s.feeds && s.pressurized, 'the pressurized refill writes pointed up'); return {'310': P.BALLPOINT.nitrogen, '527': P.BALLPOINT.nitrogen * 1000 / s.weight, '48.9': s.now.line}; },
  'In orbit': s => { t.ok(s.place.angle === null && s.feeds && !s.weighs, 'in orbit nothing weighs and the pen writes'); return {}; },
}, ballAt, t);
t.near(ballAt({ball: 1.4}).now.turns * 2, ballAt({ball: 0.7}).now.turns, 1e-12, 'twice as wide, half as many turns');

const feltAt = values => settled(felt, values), water = feltAt({});
checkTrialNumbers(feltTipLesson, {
  'Write a line': s => { t.ok(s.stroke === 2 && P.FELT.rest === 2, 'a 2 s stroke and a 2 s rest'); return {'40': P.FELT.line, '2': s.stroke, '0.050': s.dwell, '1.0': P.FELT.contact, '0.112': s.spread, '1.22': s.width, '2.43': 2 * s.blot}; },
  'Write slowly': s => { t.near(s.dwell, 4 * water.dwell, 1e-15, 'four times as long'); t.near(s.spread, 2 * water.spread, 1e-15, 'twice as far'); return {'0.200': s.dwell, '0.224': s.spread, '1.45': s.width}; },
  'Write fast': s => ({'0.025': s.dwell, '1.16': s.width}),
  'Alcohol-based ink': s => ({'0.51': P.paceRatio(P.ETHANOL), '1.11': s.width, '1.72': 2 * s.blot, '2.43': 2 * water.blot}),
  'Narrow pores pull harder': s => ({'10': P.FELT.nibPore, '14.6': s.nibPull / 1000, '5': s.nibPull / s.reservoirPull, '50': P.FELT.reservoirPore, '2.91': s.reservoirPull / 1000, '0.28': s.wick}),
  'Whichever way it points': s => ({'10': P.FELT.nibPore, '1.48': s.hold, '0.58': P.feltTipPlan({ink: 1}).hold}),
  'The square root of time': s => ({'0.500': s.pace * Math.sqrt(1), '1': 1, '4': (1 / s.pace) ** 2, '1.000': s.pace * Math.sqrt(4)}),
}, feltAt, t);

const dipAt = values => settled(dip, values), rest = dipAt({});
checkTrialNumbers(dipPenLesson, {
  'Dip the nib': s => ({'0.02': P.NIB.gap, '10': P.NIB.slit, '207': 1000 * s.fill}),
  'Why it holds': s => ({'0.02': P.NIB.gap, '742': s.holdRest}),
  'Press for a downstroke': s => ({'0.02': P.NIB.gap, '0.07': s.tipGap, '3.5': s.tipGap / P.NIB.gap, '43': s.flow, '0.15': s.line}),
  'Press hard': s => { t.near(s.line, 2 * rest.line, 1e-12, 'twice as wide as with no press'); return {'0.12': s.tipGap, '0.20': s.line, '216': s.flow, '124': s.hold}; },
  'A hairline': s => ({'0.03': s.tipGap, '0.11': s.line}),
  'A slit is a pair of plates': s => { t.near(s.tops[0] / s.tops.at(-1), 10, 1e-6, 'ten times the gap, a tenth of the height'); return {'0.10': P.BENCH.narrow, '148.4': s.tops[0], '1.00': P.BENCH.wide, '14.8': s.tops.at(-1)}; },
}, dipAt, t);

const tubeAt = values => dipAt(values), narrow = tubeAt({});
checkTrialNumbers(capillaryActionLesson, {
  'Water in a narrow tube': s => ({'74.2': s.now.level, '90': 90, '2.56': s.tube90, '70': Number(s.height.toPrecision(1))}),
  'Half the radius': s => { t.near(s.height, 2 * narrow.height, 1e-9, 'half the radius, twice the height'); return {'148.4': s.now.level, '18.72': s.tube90, '90': 90, '7.3': s.tube90 / narrow.tube90}; },
  'Plates rise as high, more slowly': s => ({'0.20': s.radius, '74.2': s.now.plateLevel, '90': 90, '3.83': s.plates90, '1.5': s.plates90 / s.tube90}),
  'The pull of a curved surface': s => { t.near(s.pull, 1000 * g * s.height / 1000, 1e-9, 'the pull is the column’s weight'); return {'728': s.pull, '74.2': s.height}; },
  'Ethanol': s => { t.ok(s.liquid.tension / P.WATER.tension < 1 / 3, 'less than a third of water’s surface tension'); return {'28.8': s.now.level, '90': 90, '1.90': s.tube90}; },
  'Mercury stays out': s => { t.ok(!s.enters && s.now.level === null, 'none gets in'); t.ok(-s.pull > s.head, 'the bulge pushes harder than the depth'); return {'3.73': -s.pull / 1000, '15': P.BENCH.depth, '1.99': s.head / 1000}; },
  'Mercury pushed down': s => { t.ok(s.enters && s.now.level < 0, 'in, but below the level outside'); return {'11.2': -s.now.level}; },
}, tubeAt, t);

const firstIn = P.DIP_DOMAINS.radius, entering = [];
for (let i = 0; i <= 8; i++) { const radius = Number((firstIn[0] + i * firstIn[2]).toFixed(2)); if (P.dipPenPlan({liquid: 2, radius}).enters) entering.push(radius); }
const deeper = lesson => lesson.deeper.map(item => item.body).join(' ');
checkQuotedText(deeper(ballpointLesson), {[`turns ${fixed(1e6 / (Math.PI * 0.7), 0)} times in a kilometer`]: 'turns 454,728 times in a kilometer', [`nearly ${fixed(P.BALLPOINT.nitrogen, 0)} kPa`]: 'nearly 310 kPa'}, t);
checkQuotedText(deeper(feltTipLesson), {[`pulls ${fixed(P.FELT.reservoirPore / P.FELT.nibPore, 0)} times as hard`]: 'pulls 5 times as hard', [`climbs ${fixed(5.0 * Math.sqrt(1) / 0.25, 0)} mm in the first minute`]: 'climbs 20 mm in the first minute', [`only ${fixed(5.0 * Math.sqrt(4) / 0.25, 0)} mm by the fourth`]: 'only 40 mm by the fourth'}, t);
{
  const half = P.dipPenPlan({press: 0.5});
  checkQuotedText(deeper(dipPenLesson), {[`${fixed(half.tipGap / P.NIB.gap, 1)} times its width`]: '3.5 times its width', [`lets ${fixed(half.flow, 0)} times as much ink`]: 'lets 43 times as much ink'}, t);
}
checkQuotedText(deeper(capillaryActionLesson), {
  [`${fixed(narrow.capillary, 2)} mm for water`]: '2.72 mm for water',
  [`rise of ${Number((1000 * jurin(SRC.Water, 2e-4)).toPrecision(1))} mm`]: 'rise of 70 mm',
  [`gives ${fixed(1000 * jurin(SRC.Water, 2e-4), 1)} mm`]: 'gives 74.2 mm',
  [`Its ${fixed(1000 * jurin(SRC.Water, 0.02), 1)} mm`]: 'Its 0.7 mm',
  [`is ${fixed(1000 * jurin(SRC.Water, 0.02), 3)} mm`]: 'is 0.742 mm',
  [`dipped ${fixed(P.BENCH.depth, 0)} mm`]: 'dipped 15 mm',
  [`from a radius of ${fixed(entering[0], 1)} mm`]: 'from a radius of 0.4 mm',
}, t);
{
  const wide = P.dipPenPlan({radius: 0.4}), thin = P.dipPenPlan({radius: 0.2});
  t.near(wide.tube.k / thin.tube.k, 4, 1e-12, 'a tube twice as wide climbs four times as fast');
  t.near(wide.height / thin.height, 0.5, 1e-12, 'though only half as high');
}
checkQuotedText(ballpointLimits, {[`a ${fixed(P.BALLPOINT.line, 0)} mm line at ${fixed(P.BALLPOINT.speed, 0)} mm a second`]: 'a 50 mm line at 10 mm a second', [`bore ${fixed(2 * P.BALLPOINT.boreRadius, 1)} mm across`]: 'bore 2.0 mm across', [`a ${fixed(P.BALLPOINT.column, 0)} mm column`]: 'a 60 mm column', [`pulled ${fixed(BP.REFILL.pulled, 0)} mm back`]: 'pulled 5 mm back', [`gravity of ${fixed(P.G, 2)}`]: 'gravity of 9.81'}, t);
checkQuotedText(feltTipLimits, {[`a ${fixed(P.FELT.line, 0)} mm line`]: 'a 40 mm line', [`resting ${fixed(P.FELT.rest, 0)} s`]: 'resting 2 s', [`${fixed(P.WATER.tension * 1000, 1)} mN/m and a viscosity of ${Number((P.WATER.viscosity * 1000).toFixed(4))} mPa·s`]: '72.8 mN/m and a viscosity of 1.0016 mPa·s', [`${fixed(P.ETHANOL.tension * 1000, 2)} mN/m and ${fixed(P.ETHANOL.viscosity * 1000, 1)} mPa·s`]: '22.27 mN/m and 1.2 mPa·s', [`across ${fixed(P.FELT.contact, 1)} mm`]: 'across 1.0 mm', [`pores ${P.FELT.reservoirPore} μm`]: 'pores 50 μm', [`${P.FELT.nibPore} μm in the nib, which is ${fixed(P.FELT.nib, 0)} mm long`]: '10 μm in the nib, which is 10 mm long', [`ink ${fixed(P.FELT.pace, 1)} mm in its first second`]: 'ink 0.5 mm in its first second'}, t);
checkQuotedText(dipPenLimits, {[`${fixed(P.NIB.length, 0)} mm long and ${fixed(P.NIB.width, 0)} mm wide`]: '30 mm long and 7 mm wide', [`${fixed(P.NIB.gap, 2)} mm wide at rest running ${fixed(P.NIB.slit, 0)} mm`]: '0.02 mm wide at rest running 10 mm', [`vent hole ${fixed(2 * P.NIB.vent, 0)} mm across`]: 'vent hole 2 mm across', [`dipped ${fixed(P.NIB.dip, 0)} mm`]: 'dipped 3 mm', [`splay ${fixed(P.NIB.compliance, 1)} mm for every newton`]: 'splay 0.1 mm for every newton', [`line is ${fixed(P.NIB.tip, 1)} mm wide`]: 'line is 0.1 mm wide'}, t);
checkQuotedText(capillaryLimits, {[`dipped ${fixed(P.BENCH.depth, 0)} mm`]: 'dipped 15 mm', [`widths ${DP.WIDEN} times wider`]: 'widths 10 times wider', [`glass at ${fixed(P.MERCURY.angle, 0)}°`]: 'glass at 140°', [`a gap of ${fixed(P.BENCH.narrow, 1)} mm to one of ${fixed(P.BENCH.wide, 1)} mm across ${fixed(P.BENCH.width, 0)} mm`]: 'a gap of 0.1 mm to one of 1.0 mm across 40 mm'}, t);
checkQuotedText(ballpointLesson.quiz.explanation, {[fixed(ballAt({ball: 0.3}).now.turns, 2)]: '53.05', [fixed(ballAt({ball: 1.4}).now.turns, 2)]: '11.37', [`${fixed(Math.PI * 0.3, 3)} mm against once every ${fixed(Math.PI * 1.4, 3)} mm`]: '0.942 mm against once every 4.398 mm'}, t);
checkQuotedText(feltTipLesson.quiz.explanation, {[`${fixed(feltAt({speed: 5}).dwell, 3)} s under the tip and the ink soaks ${fixed(feltAt({speed: 5}).spread, 3)} mm`]: '0.200 s under the tip and the ink soaks 0.224 mm', [`${fixed(water.dwell, 3)} s and soaks ${fixed(water.spread, 3)} mm`]: '0.050 s and soaks 0.112 mm'}, t);
checkQuotedText(dipPenLesson.quiz.explanation, {[`from ${fixed(P.NIB.gap, 2)} mm to ${fixed(P.dipPenPlan({press: 0.5}).tipGap, 2)} mm`]: 'from 0.02 mm to 0.07 mm', [`${fixed(P.dipPenPlan({press: 0.5}).flow, 0)} times`]: '43 times'}, t);
checkQuotedText(capillaryActionLesson.quiz.explanation, {[`${fixed(narrow.height, 1)} mm in a 0.2 mm tube, ${fixed(dipAt({radius: 0.1}).height, 1)} mm in a 0.1 mm one`]: '74.2 mm in a 0.2 mm tube, 148.4 mm in a 0.1 mm one'}, t);
const partText = (model, id) => model.parts.find(part => part.id === id).description;
checkQuotedText(partText(felt, 'pores'), {[`drawn ${FT.PORES} times larger`]: 'drawn 200 times larger', [`${FT.KPA} mm tall for every kPa`]: '5 mm tall for every kPa'}, t);
checkQuotedText(partText(dip, 'capillary'), {[`dipped ${fixed(P.BENCH.depth, 0)} mm`]: 'dipped 15 mm', [`drawn ${DP.WIDEN} times wider`]: 'drawn 10 times wider'}, t);
checkQuotedText(partText(ballpoint, 'ball'), {[`drawn ${BP.DETAIL} times larger`]: 'drawn 40 times larger'}, t);
for (const lesson of [ballpointLesson, feltTipLesson, dipPenLesson, capillaryActionLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  for (const text of [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, ...lesson.deeper.map(item => item.body), ...lesson.tryIt.flatMap(item => [item.instruction, item.observe])]) t.ok(!/[—–]| - |--/.test(text), 'no dashes as punctuation');
}
t.ok(ballpointLimits.includes('Whether an ordinary refill writes follows the source'), 'the limits say what decides when the ballpoint writes');

// The component route: capillary action is the dip pen's bench, with its own lesson.
{
  const component = houseComponents['Capillary action'];
  t.ok(component.machine === 'Dip pen' && component.part === 'capillary' && component.lesson === capillaryActionLesson, 'Capillary action routes to the dip pen’s bench with its own lesson');
  const ids = new Set(dip.parts.map(part => part.id));
  for (const trial of capillaryActionLesson.tryIt) t.ok(ids.has(trial.part), `${trial.title}: its part is on the dip pen`);
}

// ---------------------------------------------------------------------------
// 8. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const [name, model, sample, domains, stepSize] of [['ballpoint', ballpoint, P.sampleBallpoint, P.BALLPOINT_DOMAINS, 0.1], ['felt tip', felt, P.sampleFeltTip, P.FELT_DOMAINS, 0.1], ['dip pen', dip, P.sampleDipPen, P.DIP_DOMAINS, 0.1]]) {
  checkControlsMove(model, () => drawing(model), m => m.advance(100), t);
  checkRefusals(sample, domains, t);
  model.reset();
  checkFinite(model.root, t);
  t.ok(!model.playback.complete() && !model.resultPart.available(), `${name}: nothing to inspect before playing`);
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, stepSize, 1e-12, `${name}: a step advances the clock`);
  t.ok(JSON.stringify(model.getState().readings) !== before, `${name}: a step changes the readings`);
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, stepSize + 0.5, 1e-12, `${name}: animation advances by the time that passed`);
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available(), `${name}: complete, with a result to inspect`);
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0, `${name}: ${action.label} returns readings`); checkFinite(model.root, t); }
  t.ok(model.parts.every(part => part.description && !/[—–]| - |--/.test(part.description)), `${name}: every part described, with no dashes`);
  t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity/.test(item.value + (item.hint || ''))), `${name}: readings are all numbers`);
}
const disposed = [BP.createBallpointModel(), FT.createFeltTipModel(), DP.createDipPenModel()].map(model => { model.advance(2); return checkDisposal(model, t); });
for (const model of [ballpoint, felt, dip]) model.dispose();

console.log(`PASS pens: ${t.count} checks, ${counts.rises} rises found again by integrating Poiseuille’s balance, ${counts.strips} wedge strips and ${counts.charts} chart points read back, ${counts.rolls} rolls with the touching point held still, ${counts.specks} ink specks, ${counts.poses} poses, 4 lessons, ${disposed.join(', ')} resources released exactly once.`);

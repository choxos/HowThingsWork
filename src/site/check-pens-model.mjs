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
t.ok(P.BALLPOINT.nitrogen === 200, 'assigned pressure comparison, not a commercial rating');

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

// Detailed ballpoint laws, film states and geometry are checked separately.
const ballpoint = BP.createBallpointModel();

// ---------------------------------------------------------------------------
// 5. The felt-tip pen, read off its drawing.
// ---------------------------------------------------------------------------

// Detailed felt-tip laws, contact histories and mesh checks live in check-felt-tip-model.mjs.
const felt = FT.createFeltTipModel();

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
checkQuotedText(dipPenLimits, {[`${fixed(P.NIB.length, 0)} mm long and ${fixed(P.NIB.width, 0)} mm wide`]: '30 mm long and 7 mm wide', [`${fixed(P.NIB.gap, 2)} mm wide at rest running ${fixed(P.NIB.slit, 0)} mm`]: '0.02 mm wide at rest running 10 mm', [`vent hole ${fixed(2 * P.NIB.vent, 0)} mm across`]: 'vent hole 2 mm across', [`dipped ${fixed(P.NIB.dip, 0)} mm`]: 'dipped 3 mm', [`splay ${fixed(P.NIB.compliance, 1)} mm for every newton`]: 'splay 0.1 mm for every newton', [`line is ${fixed(P.NIB.tip, 1)} mm wide`]: 'line is 0.1 mm wide'}, t);
checkQuotedText(capillaryLimits, {[`dipped ${fixed(P.BENCH.depth, 0)} mm`]: 'dipped 15 mm', [`widths ${DP.WIDEN} times wider`]: 'widths 10 times wider', [`glass at ${fixed(P.MERCURY.angle, 0)}°`]: 'glass at 140°', [`a gap of ${fixed(P.BENCH.narrow, 1)} mm to one of ${fixed(P.BENCH.wide, 1)} mm across ${fixed(P.BENCH.width, 0)} mm`]: 'a gap of 0.1 mm to one of 1.0 mm across 40 mm'}, t);
checkQuotedText(dipPenLesson.quiz.explanation, {[`from ${fixed(P.NIB.gap, 2)} mm to ${fixed(P.dipPenPlan({press: 0.5}).tipGap, 2)} mm`]: 'from 0.02 mm to 0.07 mm', [`${fixed(P.dipPenPlan({press: 0.5}).flow, 0)} times`]: '43 times'}, t);
checkQuotedText(capillaryActionLesson.quiz.explanation, {[`${fixed(narrow.height, 1)} mm in a 0.2 mm tube, ${fixed(dipAt({radius: 0.1}).height, 1)} mm in a 0.1 mm one`]: '74.2 mm in a 0.2 mm tube, 148.4 mm in a 0.1 mm one'}, t);
const partText = (model, id) => model.parts.find(part => part.id === id).description;
checkQuotedText(partText(dip, 'capillary'), {[`dipped ${fixed(P.BENCH.depth, 0)} mm`]: 'dipped 15 mm', [`drawn ${DP.WIDEN} times wider`]: 'drawn 10 times wider'}, t);
for (const lesson of [ballpointLesson, feltTipLesson, dipPenLesson, capillaryActionLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  for (const text of [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, ...lesson.deeper.map(item => item.body), ...lesson.tryIt.flatMap(item => [item.instruction, item.observe])]) t.ok(!/[—–]| - |--/.test(text), 'no dashes as punctuation');
}
t.ok(ballpointLimits.includes('does not predict air entry'), 'the limits exclude an unsupported failure prediction');

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

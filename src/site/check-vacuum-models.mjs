// Vacuum cleaners: the operating point found again by Newton's method on
// losses written out afresh, Blasius's friction held against Prandtl's law for
// smooth pipes, the fan's power by algebra, every grain's falling speed by
// integrating its fall from rest, the pressure along the path, the drawing held
// to the state and to the true lengths of hose, wand and duct, and every number
// the lessons quote held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleVacuum, vacuumPlan, fallSpeed, PATHS, DEBRIS, CREVICE, VACUUM_DOMAINS} from './vacuum-physics.js';
import {createVacuumCleanerModel, createUprightVacuumModel, swellOf, FILTER_COLORS, WAND_LENGTH, HOSE_RADIUS, DUCT_RADIUS, BAG_AREA, BAG_BOTTOM, LEAN} from './vacuum-models.js';
import {vacuumCleanerLesson, uprightVacuumLesson} from './vacuum-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), TAU = Math.PI * 2, rho = 1.2, mu = 1.8e-5, g = 9.81;
const KINDS = {
  canister: {sealed: 22000, qmax: 0.045, peak: 0.45, head: 0.25, D: 0.032, L: 2.6, bag: 1.2e5, filter: 5e4, extra: 60, brush: false, order: ['nozzle', 'hose', 'bag', 'filter', 'fan']},
  upright: {sealed: 12000, qmax: 0.05, peak: 0.35, head: 0.3, D: 0.04, L: 0.6, bag: 6e4, filter: 5e4, extra: 100, brush: true, order: ['nozzle', 'fan', 'hose', 'bag', 'filter']},
};
const canister = values => vacuumPlan(values, 'canister'), upright = values => vacuumPlan(values, 'upright');

// 1. Falling speeds: integrate each grain's fall from rest until it stops speeding up.
const drag = Re => (Re > 1000 ? 0.44 : 24 / Re * (1 + 0.15 * Re ** 0.687));
const falls = DEBRIS.map(grain => {
  const d = grain.diameter, rp = grain.density, dt = 0.2 * d;
  const accel = v => { const Re = rho * v * d / mu; return g * (1 - rho / rp) - (Re > 0 ? 3 * drag(Re) * rho * v * v / (4 * d * rp) : 0); };
  let v = 0;
  for (let n = 0; n < 100000; n++) { const k1 = accel(v), k2 = accel(v + dt / 2 * k1), k3 = accel(v + dt / 2 * k2), k4 = accel(v + dt * k3); v += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); }
  t.near(fallSpeed(grain), v, 1e-6 * v, `${grain.label}: falling speed`);
  return v;
});
const stokes = (DEBRIS[2].density - rho) * g * DEBRIS[2].diameter ** 2 / (18 * mu);
t.ok(falls[2] < stokes && falls[2] > 0.85 * stokes, 'dust falls just below its Stokes speed');
t.ok(falls[0] > 6 && falls[0] < 8, 'millimeter sand falls at about 7 m/s');

// 2. The operating point, piece by piece, for every setting of both cleaners.
const prandtl = Re => { let f = 0.02; for (let i = 0; i < 60; i++) f = (2 * Math.log10(Re * Math.sqrt(f)) - 0.8) ** -2; return f; };
let fastestHose = 0;
for (const [kind, k] of Object.entries(KINDS)) {
  for (const nozzle of [0, 1, 2]) for (const bag of [0, 25, 50, 75, 100]) for (const filter of [0, 1]) for (const debris of [0, 1, 2]) {
    const values = {nozzle, bag, filter, debris}, s = vacuumPlan(values, kind), where = `${kind} ${JSON.stringify(values)}`;
    const [width, gap, K] = nozzle === 1 ? [0.025, 0.008, 1] : [k.head, 0.006, 1.5], slot = width * gap, bore = Math.PI * k.D ** 2 / 4;
    const bagR = k.bag * (1 + 3 * bag / 100), filterR = k.filter * (filter ? 3 : 1), fan = Q => k.sealed * (1 - (Q / k.qmax) ** 2);
    const pieces = Q => {
      const v = Q / slot, u = Q / bore, Re = rho * u * k.D / mu;
      return {v, u, Re, nozzle: (1 + K) * rho * v * v / 2, hose: 0.316 / Re ** 0.25 * k.L / k.D * rho * u * u / 2, bag: bagR * Q, filter: filterR * Q};
    };
    const total = Q => { const at = pieces(Q); return at.nozzle + at.hose + at.bag + at.filter; };
    const levels = drops => { let level = 0; return [0, ...k.order.map(piece => (level += piece === 'fan' ? s.pressure : -drops[piece]))]; };
    if (nozzle === 2) {
      assert.equal(s.flow, 0, `${where}: no flow`);
      t.near(s.pressure, k.sealed, 1e-9, `${where}: sealed pressure`);
      t.near(s.sockForce, k.sealed * slot, 1e-9, `${where}: sock held by the sealed pressure on the slot`);
      t.near(s.electrical, k.sealed * k.qmax / (4 * k.peak) + k.extra, 1e-9, `${where}: fan power where nothing flows`);
      levels({nozzle: k.sealed, hose: 0, bag: 0, filter: 0}).forEach((level, i) => t.near(s.profile[i].pressure, level, 1e-9, `${where}: pressure along the way`));
      assert.equal(s.lifted, false, `${where}: nothing lifted`);
      continue;
    }
    let Q = 0.02;
    for (let i = 0; i < 60; i++) {
      const h = 1e-7, miss = fan(Q) - total(Q), slope = (fan(Q + h) - total(Q + h) - fan(Q - h) + total(Q - h)) / (2 * h);
      Q = Math.min(k.qmax, Math.max(1e-5, Q - miss / slope));
    }
    const at = pieces(Q);
    t.near(s.flow, Q, 1e-10, `${where}: flow where fan meets path`);
    for (const piece of ['nozzle', 'hose', 'bag', 'filter']) t.near(s[piece], at[piece], 1e-6 * at[piece] + 1e-9, `${where}: ${piece} loss`);
    t.near(s.nozzle + s.hose + s.bag + s.filter, s.pressure, 1e-7 * s.pressure, `${where}: the path uses up what the fan makes`);
    t.near(s.slotSpeed, at.v, 1e-6, `${where}: slot speed`);
    t.near(s.hoseSpeed, at.u, 1e-6, `${where}: hose speed`);
    t.ok(at.Re > 4000 && at.Re < 1e5, `${where}: turbulent, inside Blasius's range`);
    t.ok(Math.abs(0.316 / at.Re ** 0.25 / prandtl(at.Re) - 1) < 0.03, `${where}: Blasius within 3% of Prandtl's smooth-pipe law`);
    const x = Q / k.qmax, eta = 4 * k.peak * x * (1 - x);
    t.near(s.efficiency, eta, 1e-9, `${where}: fan efficiency`);
    t.near(s.shaft, fan(Q) * Q / eta, 1e-7 * s.shaft, `${where}: fan power is air power over efficiency`);
    t.near(s.electrical, s.shaft + k.extra, 1e-9, `${where}: motor power`);
    t.near(s.airPower, fan(Q) * Q, 1e-6, `${where}: air power`);
    t.near(s.nozzlePower, at.nozzle * Q, 1e-6, `${where}: air power at the nozzle`);
    t.ok(s.electrical > vacuumPlan({...values, nozzle: 2}, kind).electrical, `${where}: a blocked fan takes less power than a running one`);
    const expected = levels(at);
    expected.forEach((level, i) => t.near(s.profile[i].pressure, level, 1e-6 * k.sealed, `${where}: pressure along the way`));
    t.near(expected.at(-1), 0, 1e-6 * k.sealed, `${where}: back to the room's pressure`);
    t.near(s.insideBag, expected[k.order.indexOf('bag')], 1e-6 * k.sealed, `${where}: pressure inside the bag`);
    t.ok(kind === 'canister' ? s.insideBag < 0 : s.insideBag > 0, `${where}: the canister's bag is sucked, the upright's blown up`);
    const beaten = debris !== 2 || (k.brush && nozzle === 0);
    assert.equal(s.lifted, at.v >= 1.5 * falls[debris] && beaten, `${where}: lifting rule`);
    t.add();
    if (kind === 'canister') fastestHose = Math.max(fastestHose, at.u);
    for (const time of [0, 3.7]) {
      const now = sampleVacuum(values, time, kind);
      t.near(now.air, Q * time, 1e-9, `${where}: air moved`);
      t.near(now.energy, s.electrical * time, 1e-6, `${where}: energy used`);
    }
  }
}

// 3. The drawings.
const models = {canister: createVacuumCleanerModel(), upright: createUprightVacuumModel()};
const size = mesh => { mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox.getSize(new THREE.Vector3()); };
for (const [kind, m] of Object.entries(models)) {
  const p = m.topology, MM = p.MM, k = KINDS[kind];
  m.root.position.set(0.3, -0.2, 0.1);
  t.ok(p.fanChart.left + 360 < p.profileChart.left || p.fanChart.bottom + 280 < p.profileChart.bottom || p.profileChart.bottom + 280 < p.fanChart.bottom, `${kind}: charts apart`);

  // True lengths and bores.
  const tube = kind === 'canister' ? p.hoseTube : p.ductTube, curve = tube.geometry.parameters.path, points = curve.getPoints(20000);
  let length = 0, lowest = Infinity;
  points.forEach((point, i) => { lowest = Math.min(lowest, point.y); if (i) length += point.distanceTo(points[i - 1]); });
  const radius = kind === 'canister' ? HOSE_RADIUS : DUCT_RADIUS;
  t.near(tube.geometry.parameters.radius / MM, k.D * 500, 1e-9, `${kind}: tube drawn at its true bore`);
  t.ok(lowest / MM - radius >= 0, `${kind}: tube stays above the floor`);
  const tip = new THREE.Vector3(0, 90 * MM, 0).applyEuler(p.tool.rotation).add(p.tool.position);
  t.near(tip.x / MM, p.mouths[1][0], 1e-6, `${kind}: crevice tip where its air enters`);
  t.near(tip.y / MM, p.mouths[1][1], 1e-6, `${kind}: crevice tip where its air enters`);
  const crevice = size(p.tool);
  t.near(crevice.x / MM, CREVICE.width * 1000, 1e-4, `${kind}: crevice slot width`);
  t.near(crevice.z / MM, CREVICE.gap * 1000, 1e-4, `${kind}: crevice slot gap`);
  t.near(crevice.y / MM, 180, 1e-4, `${kind}: crevice tool length`);
  t.ok(tip.y / MM > 0, `${kind}: crevice tip above the floor`);
  if (kind === 'canister') {
    t.near(length / MM + WAND_LENGTH, k.L * 1000, 2, 'hose and wand drawn 2.6 m long');
    t.near(p.wand.geometry.parameters.height / MM, WAND_LENGTH, 1e-6, 'wand drawn its length');
    t.near(p.wand.geometry.parameters.radiusTop / MM, k.D * 500, 1e-9, 'wand at the hose’s bore');
    t.near(size(p.head).z / MM, k.head * 1000, 1e-4, 'floor head as wide as its slot');
    const bagSize = size(p.bag);
    t.near(bagSize.y * bagSize.z / MM ** 2 * 1e-6, BAG_AREA, 1e-8, 'bag cross-section the dots use');
    t.ok(BAG_AREA / (Math.PI * (k.D / 2) ** 2) < 50, 'bag cross-section under 50 hoses');
  } else {
    t.near(length / MM, k.L * 1000, 1, 'duct and fill tube drawn 0.6 m long');
    const [back, front] = p.walls.map(wall => wall.position.z / MM);
    t.near(front - back - size(p.walls[0]).z / MM, k.head * 1000, 1e-4, 'floor head 300 mm wide inside, the slot’s width');
    t.near(size(p.core).y / MM, 290, 1e-4, 'brush roll length');
    t.ok(size(p.core).y / MM <= k.head * 1000, 'brush roll fits the slot');
    const top = curve.getPoint(1);
    const axis = new THREE.Vector3(Math.sin(LEAN), Math.cos(LEAN), 0), fromBottom = new THREE.Vector3(top.x / MM - BAG_BOTTOM[0], top.y / MM - BAG_BOTTOM[1], 0);
    t.ok(fromBottom.dot(axis) > 21 && fromBottom.dot(axis) < 580, 'fill tube ends inside the paper bag');
  }

  for (const values of [{}, {nozzle: 1}, {nozzle: 2}, {bag: 100, filter: 1, debris: 1}, {debris: 2}, {nozzle: 1, bag: 50, debris: 2}]) for (const time of [0, 0.37, 2.5, 9.99, 12]) {
    m.reset(); m.update(values); m.advance(time);
    m.root.updateMatrixWorld(true);
    const s = m.getState(), fitted = s.values.nozzle === 1 ? 1 : 0, where = `${kind} ${JSON.stringify(values)} at ${time} s`;
    t.near(s.time, Math.min(10, time), 1e-12, `${where}: real time, ten seconds`);
    // Moving air: walk each piece at 15 mm a second for each m/s of Q / A.
    if (s.flow === 0) { assert.ok(p.dots.every(dot => !dot.visible), `${where}: no dots when blocked`); t.add(); }
    else {
      const [width, gap] = s.values.nozzle === 1 ? [0.025, 0.008] : [k.head, 0.006];
      const areaOf = piece => (piece.area === 'slot' ? width * gap : piece.area === 'hose' ? Math.PI * k.D ** 2 / 4 : piece.area);
      const walk = p.routes[fitted].map(piece => {
        const segments = piece.points.slice(1).map((b, i) => [piece.points[i], b, Math.hypot(b[0] - piece.points[i][0], b[1] - piece.points[i][1], b[2] - piece.points[i][2])]);
        const speed = 15 * s.flow / areaOf(piece);
        return {segments, speed, duration: segments.reduce((sum, [, , L]) => sum + L, 0) / speed};
      });
      const loop = walk.reduce((sum, piece) => sum + piece.duration, 0);
      t.near(s.loop, loop, 1e-9 * loop, `${where}: time round the route`);
      for (const i of [0, 7, 23, 41, 59]) {
        let tau = (s.time + i * loop / 60) % loop, place = null;
        for (const [n, piece] of walk.entries()) {
          if (tau <= piece.duration || n === walk.length - 1) {
            let distance = Math.min(tau, piece.duration) * piece.speed;
            for (const [m2, [a, b, L]] of piece.segments.entries()) {
              if (distance <= L || m2 === piece.segments.length - 1) { const u = L > 0 ? Math.min(1, distance / L) : 0; place = a.map((v, c) => v + (b[c] - v) * u); break; }
              distance -= L;
            }
            break;
          }
          tau -= piece.duration;
        }
        t.near(p.dots[i].position.x / MM, place[0], 1e-6, `${where}: dot ${i} where the air has carried it`);
        t.near(p.dots[i].position.y / MM, place[1], 1e-6, `${where}: dot ${i} where the air has carried it`);
      }
    }
    // Moving parts, fittings, bag and filter.
    if (kind === 'canister') {
      t.near(p.fan.rotation.x, TAU * 2 * s.time, 1e-9, `${where}: fan drawn turning twice a second`);
      assert.equal(p.head.visible, s.values.nozzle !== 1);
      assert.equal(p.neck.visible, s.values.nozzle !== 1);
      const height = Math.max(1e-3, s.values.bag / 100 * 190);
      t.near(p.dust.scale.y, height, 1e-12, `${where}: dust fills the bag as far as set`);
      t.near(p.dust.position.y / MM - height / 2, p.bag.position.y / MM - 100, 1e-6, `${where}: dust rests on the bag’s bottom`);
      assert.equal(p.filter.material.color.getHex(), FILTER_COLORS[s.values.filter]);
    } else {
      t.near(p.fan.rotation.y, TAU * 2 * s.time, 1e-9, `${where}: fan drawn turning twice a second`);
      t.near(p.roller.rotation.z, -TAU * 3 * s.time, 1e-9, `${where}: brush drawn turning three times a second`);
      const height = Math.max(1e-3, s.values.bag / 100 * 400), axis = new THREE.Vector3(Math.sin(LEAN), Math.cos(LEAN), 0);
      t.near(p.dust.scale.y, height, 1e-12, `${where}: dust fills the bag as far as set`);
      const along = new THREE.Vector3(p.dust.position.x / MM - BAG_BOTTOM[0], p.dust.position.y / MM - BAG_BOTTOM[1], 0);
      t.near(along.dot(axis) - height / 2, 21, 1e-6, `${where}: dust rests on the paper bag’s bottom`);
      t.ok(along.dot(axis) + height / 2 < 580, `${where}: dust inside the paper bag`);
      assert.equal(p.cover.material.color.getHex(), FILTER_COLORS[s.values.filter]);
      t.near(p.cover.scale.x, 1 + 0.25 * Math.max(0, Math.min(1, s.insideBag / 10000)), 1e-12, `${where}: cloth cover swells with the pressure inside`);
      if (s.flow === 0) t.near(swellOf(s.insideBag), 1, 1e-12, `${where}: limp when nothing flows`);
    }
    assert.equal(p.tool.visible, s.values.nozzle === 1);
    assert.equal(p.sock.visible, s.values.nozzle === 2);
    assert.equal(p.carpet.visible, s.values.debris === 2);
    p.grains.forEach((grain, i) => {
      const home = grain.userData.home, mouth = p.mouths[fitted], rise = s.lifted ? ((s.time * 0.8 + i / 12) % 1) ** 2 : 0;
      t.near(grain.position.x / MM, home[0] + (mouth[0] - home[0]) * rise, 1e-6, `${where}: grain ${i} rising only if lifted`);
      t.near(grain.position.y / MM, home[1] + (mouth[1] - home[1]) * rise, 1e-6, `${where}: grain ${i} rising only if lifted`);
      t.near(grain.scale.x * 2, [6, 10, 3][s.values.debris], 1e-12, `${where}: grain drawn at its stated size`);
    });
    // Charts.
    const fanChartY = pa => (p.fanChart.bottom + Math.max(0, Math.min(1, pa / 22000)) * 280) * MM;
    const fanChartX = Q => (p.fanChart.left + Q / 0.05 * 360) * MM;
    const fans = p.fanLine.geometry.attributes.position;
    for (const i of [0, 13, 37, 50]) {
      const Q = k.qmax * i / 50;
      t.near(fans.getX(i), fanChartX(Q), 1e-6, `${where}: fan curve`);
      t.near(fans.getY(i), fanChartY(k.sealed * (1 - (i / 50) ** 2)), 1e-6, `${where}: fan curve`);
    }
    const paths = p.pathLine.geometry.attributes.position, [width, gap, K] = s.values.nozzle === 1 ? [0.025, 0.008, 1] : [k.head, 0.006, 1.5];
    let drawn = 51;
    for (let i = 0; i <= 50; i++) {
      const Q = 0.05 * i / 50, u = Q / (Math.PI * k.D ** 2 / 4), Re = rho * u * k.D / mu, v = Q / (width * gap);
      const loss = s.values.nozzle === 2 ? 22000 * i / 50 : (1 + K) * rho * v * v / 2 + (Re > 0 ? 0.316 / Re ** 0.25 : 0) * k.L / k.D * rho * u * u / 2 + k.bag * (1 + 3 * s.values.bag / 100) * Q + k.filter * (s.values.filter ? 3 : 1) * Q;
      if (drawn === 51 && loss > 22000) drawn = i + 1;
      if (i < drawn) {
        t.near(paths.getX(i), fanChartX(s.values.nozzle === 2 ? 0 : Q), 1e-6, `${where}: path curve`);
        t.near(paths.getY(i), fanChartY(loss), 1e-6, `${where}: path curve`);
      }
    }
    assert.equal(p.pathLine.geometry.drawRange.count, drawn, `${where}: path curve stops at the chart’s top`);
    t.near(p.point.position.x, fanChartX(s.flow), 1e-9, `${where}: operating point`);
    t.near(p.point.position.y, fanChartY(s.pressure), 1e-9, `${where}: operating point`);
    const profile = p.profileLine.geometry.attributes.position, profileY = pa => (p.profileChart.bottom + Math.max(0, Math.min(1, (pa + 22000) / 34000)) * 280) * MM;
    s.profile.forEach((station, n) => {
      for (const [index, column] of [[2 * n, n], [2 * n + 1, n + 1]]) {
        t.near(profile.getX(index), (p.profileChart.left + column / 6 * 360) * MM, 1e-6, `${where}: pressure along the way, across`);
        t.near(profile.getY(index), profileY(station.pressure), 1e-6, `${where}: pressure along the way, up`);
      }
    });
    if (time === 2.5) checkFinite(m.root, t);
  }
}

// 4. The lessons, the texts, controls, refusals and disposal.
const run = kind => values => { const m = models[kind]; m.reset(); m.update(values); m.advance(2); return m.getState(); };
checkTrialNumbers(vacuumCleanerLesson, {
  'Clean up sand': s => (assert.equal(s.lifted, true), {'35.24': s.flow * 1000, '23.5': s.slotSpeed, '1': s.grain.diameter * 1000, '7.01': s.fall, '10.5': s.needed}),
  'Where the suction goes': s => ({'8.51': s.pressure / 1000, '0.83': s.nozzle / 1000, '1.69': s.hose / 1000, '4.23': s.bag / 1000, '1.76': s.filter / 1000}),
  'A full bag': s => (t.ok(s.pressure > canister({}).pressure && s.nozzlePower < canister({}).nozzlePower, 'more suction, less cleaning'), {'14.92': s.pressure / 1000, '8.51': canister({}).pressure / 1000, '25.52': s.flow * 1000, '0.43': s.nozzle / 1000, '11.1': s.nozzlePower, '29.2': canister({}).nozzlePower}),
  'Rice and a full bag': s => (assert.equal(s.lifted, false), assert.equal(canister({debris: 1}).lifted, true), {'5': s.grain.diameter * 1000, '20.4': s.needed, '17.0': s.slotSpeed, '23.5': canister({debris: 1}).slotSpeed}),
  'The crevice tool': s => (t.near(s.opening.width, canister({}).opening.width / 10, 1e-12, 'a tenth as wide'), {'20.86': s.flow * 1000, '104.3': s.slotSpeed, '13.05': s.nozzle / 1000, '272.2': s.nozzlePower, '29.2': canister({}).nozzlePower}),
  'Block the nozzle': s => ({'22.00': s.pressure / 1000, '33.0': s.sockForce, '610': s.electrical, '1,041': canister({}).electrical}),
  'A clogged filter': s => (assert.equal(s.lifted, true), {'4.82': s.filter / 1000, '1.76': canister({}).filter / 1000, '32.11': s.flow * 1000, '21.4': s.slotSpeed}),
  'Dust in carpet': s => (assert.equal(s.lifted, false), {'0.05': s.grain.diameter * 1000, '0.18': s.fall, '23.5': s.slotSpeed}),
}, run('canister'), t);
checkTrialNumbers(uprightVacuumLesson, {
  'Clean up sand': s => (t.ok(s.slotSpeed / s.needed > 1.95 && s.slotSpeed / s.needed < 2.1, 'twice what sand needs'), {'38.13': s.flow * 1000, '300': s.opening.width * 1000, '21.2': s.slotSpeed, '10.5': s.needed}),
  'Dust in carpet': s => (assert.equal(s.lifted, true), assert.equal(canister({debris: 2}).lifted, false), {'0.18': s.fall, '21.2': s.slotSpeed}),
  'A swollen bag': s => ({'4.35': s.profile[2].pressure / 1000, '4.19': s.insideBag / 1000}),
  'A short path': s => (t.ok(s.flow > canister({}).flow, 'the upright moves more air'), {'0.6': s.path.length, '0.16': s.hose / 1000, '1.69': canister({}).hose / 1000, '5.02': s.pressure / 1000, '8.51': canister({}).pressure / 1000, '38.13': s.flow * 1000, '35.24': canister({}).flow * 1000}),
  'Rice and a full bag': s => (assert.equal(s.lifted, false), {'27.43': s.flow * 1000, '15.2': s.slotSpeed, '20.4': s.needed}),
  'The crevice tool on carpet': s => (assert.equal(s.lifted, false), assert.equal(s.beaten, false), {'85.1': s.slotSpeed}),
  'Block the slot': s => (t.near(s.insideBag, 0, 1e-9, 'limp bag'), {'12.00': s.pressure / 1000, '21.6': s.sockForce, '529': s.electrical, '855': upright({}).electrical}),
  'Where the power goes': s => ({'855': s.electrical, '755': s.shaft, '40': s.path.brush, '60': s.path.motorLoss, '191.5': s.airPower, '25.3': s.efficiency * 100}),
}, run('upright'), t);

const C = PATHS.canister, U = PATHS.upright, kilo = pascals => fixed(pascals / 1000, 0);
t.ok(canister({}).flow / BAG_AREA < 1, 'under a meter a second in the bag');
t.ok(U.fan.sealed / C.fan.sealed > 0.45 && U.fan.sealed / C.fan.sealed < 0.6, 'about half a canister’s pressure');
checkQuotedText(vacuumCleanerLesson.deeper.map(section => section.body).join(' '), {
  '22 kPa': `${kilo(C.fan.sealed)} kPa`, 'nearly 50 times': `nearly ${fixed(Math.ceil(BAG_AREA / (Math.PI * (C.diameter / 2) ** 2) / 10) * 10, 0)} times`,
  '43.8 m/s': `${fixed(canister({}).hoseSpeed, 1)} m/s`, '32 mm': `${fixed(C.diameter * 1000, 0)} mm`, 'about 93,000': `about ${fixed(Math.round(canister({}).reynolds / 1000) * 1000, 0)}`,
  '1.69 kPa': `${fixed(canister({}).hose / 1000, 2)} kPa`, '2.6 m': `${C.length} m`,
}, t);
checkQuotedText(vacuumCleanerLesson.limits, {
  '22 kPa': `${kilo(C.fan.sealed)} kPa`, '45 L/s': `${fixed(C.fan.maxFlow * 1000, 0)} L/s`, '45%': `${fixed(C.fan.efficiency * 100, 0)}%`, '60 W': `${C.motorLoss} W`,
  '250 mm slot 6 mm high': `${fixed(C.head.width * 1000, 0)} mm slot ${fixed(C.head.gap * 1000, 0)} mm high`, '25 by 8 mm': `${fixed(CREVICE.width * 1000, 0)} by ${fixed(CREVICE.gap * 1000, 0)} mm`,
  '2.6 m of 32 mm': `${C.length} m of ${fixed(C.diameter * 1000, 0)} mm`, '120 and 50 Pa': `${kilo(C.bag)} and ${kilo(C.filter)} Pa`, '15 mm a second': `${models.canister.topology.PACE} mm a second`,
}, t);
const partText = (kind, id) => models[kind].parts.find(part => part.id === id).description;
checkQuotedText(partText('canister', 'nozzle'), {'6 mm': `${fixed(C.head.gap * 1000, 0)} mm`, '250 mm': `${fixed(C.head.width * 1000, 0)} mm`, '25 by 8 mm': `${fixed(CREVICE.width * 1000, 0)} by ${fixed(CREVICE.gap * 1000, 0)} mm`}, t);
checkQuotedText(partText('canister', 'hose'), {'650 mm': `${fixed(WAND_LENGTH, 0)} mm`, '2.6 m': `${C.length} m`, '32 mm': `${fixed(C.diameter * 1000, 0)} mm`, 'up to 44 m/s': `up to ${fixed(fastestHose, 0)} m/s`}, t);
checkQuotedText(partText('canister', 'air') + partText('upright', 'air'), {'15 mm a second': `${models.canister.topology.PACE} mm a second`}, t);
checkQuotedText(uprightVacuumLesson.deeper.map(section => section.body).join(' '), {'12 kPa': `${kilo(U.fan.sealed)} kPa`, '35%': `${fixed(U.fan.efficiency * 100, 0)}%`, '22 kPa': `${kilo(C.fan.sealed)} kPa`, '45%': `${fixed(C.fan.efficiency * 100, 0)}%`}, t);
checkQuotedText(uprightVacuumLesson.limits, {
  '12 kPa': `${kilo(U.fan.sealed)} kPa`, '50 L/s': `${fixed(U.fan.maxFlow * 1000, 0)} L/s`, '35%': `${fixed(U.fan.efficiency * 100, 0)}%`, '60 W of motor losses and 40 W': `${U.motorLoss} W of motor losses and ${U.brush} W`,
  '300 mm slot 6 mm high': `${fixed(U.head.width * 1000, 0)} mm slot ${fixed(U.head.gap * 1000, 0)} mm high`, '0.6 m of 40 mm': `${U.length} m of ${fixed(U.diameter * 1000, 0)} mm`,
  '60 and 50 Pa': `${kilo(U.bag)} and ${kilo(U.filter)} Pa`, '15 mm a second': `${models.upright.topology.PACE} mm a second`,
}, t);
checkQuotedText(partText('upright', 'nozzle'), {'300 mm': `${fixed(U.head.width * 1000, 0)} mm`}, t);
checkQuotedText(partText('upright', 'brush'), {'290 mm': `${fixed(size(models.upright.topology.core).y / models.upright.topology.MM, 0)} mm`}, t);
checkQuotedText(partText('upright', 'duct'), {'40 mm': `${fixed(U.diameter * 1000, 0)} mm`, '0.6 m': `${U.length} m`}, t);

let resources = 0;
for (const [kind, m] of Object.entries(models)) {
  const p = m.topology;
  checkControlsMove(m, () => [p.dots[5].position.toArray(), p.dots[5].visible, p.tool.visible, p.sock.visible, p.dust.scale.y, (p.filter ?? p.cover).material.color.getHex(), p.grains[3].scale.x, p.grains[3].position.toArray()], model => model.advance(1.3), t);
  checkRefusals((input, time) => sampleVacuum(input, time, kind), VACUUM_DOMAINS, t);
}
assert.throws(() => vacuumPlan({}, 'robot'), RangeError);
for (const m of Object.values(models)) resources += checkDisposal(m, t);
console.log(`PASS vacuum cleaners: ${t.count} checks, ${vacuumCleanerLesson.tryIt.length + uprightVacuumLesson.tryIt.length} trials, ${resources} resources`);

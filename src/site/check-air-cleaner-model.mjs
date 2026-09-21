// Air cleaner: particle properties held to Hinds's tables, the interception
// formula held to Kuwabara's stream function, the mat's penetration built up
// layer by layer, the most penetrating size found by golden-section search,
// the precipitator's charges typed in again and its Poisson-weighted catch
// against a Monte Carlo of charged particles, the room's clearing integrated
// step by step, the drawn pleats measured to 1.85 m^2, and every number the
// three lessons quote held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {airCleanerPlan, sampleAirCleaner, fiberCapture, filterDrop, charging, driftSpeed, plateCatch, slip, diffusivity, settling, SIZES, FLOWS, FILTER, PRECIPITATOR, ROOM, FAN, AIR_CLEANER_DOMAINS} from './air-cleaner-physics.js';
import {createAirCleanerModel, particlePlace, plateY, PANEL, PITCH, PLEAT_DEPTH, CELL, THROUGH_CHART, ROOM_CHART} from './air-cleaner-model.js';
import {airCleanerLesson, electrostaticPrecipitatorLesson, ionizerLesson} from './air-cleaner-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), mu = 1.81e-5, kT = 1.380649e-23 * 293.15, e = 1.602176634e-19, eps0 = 8.8541878128e-12, K = 1 / (4 * Math.PI * eps0);

// 1. Particles against Hinds, Aerosol Technology, tables of slip correction,
// diffusion coefficient and settling speed at 20 °C.
for (const [d, C, D] of [[1e-8, 22.2, 5.24e-8], [1e-7, 2.85, 6.75e-10], [1e-6, 1.16, 2.74e-11], [1e-5, 1.016, null]]) {
  t.near(slip(d), C, 0.04 * C, `slip correction at ${d * 1e6} µm`);
  if (D) t.near(diffusivity(d), D, 0.05 * D, `diffusion coefficient at ${d * 1e6} µm`);
}
for (const [d, v] of [[1e-6, 3.5e-5], [1e-5, 3.06e-3]]) t.near(settling(d), v, 0.02 * v, `settling speed at ${d * 1e6} µm`);

// 2. The filter: interception against Kuwabara's stream function, each fiber
// mechanism typed in again, penetration layer by layer, Davies's pressure drop.
const a = FILTER.solidity, df = FILTER.fiber, Ku = -Math.log(a) / 2 - 0.75 + a - a * a / 4;
for (const R of [0.02, 0.05, 0.1, 0.2, 0.3]) {
  const psi = (1 + R) / (2 * Ku) * (2 * Math.log(1 + R) - 1 + a + (1 - a / 2) / (1 + R) ** 2 - a / 2 * (1 + R) ** 2);
  t.near(fiberCapture(R * df, 0.03).interception, psi, 0.12 * psi, `interception at R = ${R} against the stream function`);
}
for (const d of [1e-8, 5e-8, 1e-7, 1.8e-7, 3e-7, 1e-6, 3e-6]) for (const U of [0.009, 0.018, 0.03]) {
  const C = 1 + 66e-9 / d * (2.34 + 1.05 * Math.exp(-0.39 * d / 66e-9)), D = kT * C / (3 * Math.PI * mu * d), R = d / df, Pe = U * df / D, stk = 1000 * d * d * C * U / (18 * mu * df);
  const J = R < 0.4 ? (29.6 - 28 * a ** 0.62) * R * R - 27.5 * R ** 2.8 : 2, cap = x => Math.min(1, Math.max(0, x));
  const expect = {diffusion: cap(2 * Pe ** (-2 / 3)), interception: cap((1 - a) * R * R / (Ku * (1 + R))), both: cap(1.24 * R ** (2 / 3) / Math.sqrt(Ku * Pe)), impaction: cap(stk * J / (2 * Ku * Ku)), settling: cap(1000 * d * d * 9.81 * C / (18 * mu) / U * (1 + R))};
  const c = fiberCapture(d, U);
  for (const [name, value] of Object.entries(expect)) t.near(c[name], value, 1e-9 * value + 1e-15, `${name} at ${d * 1e6} µm and ${U} m/s`);
}
for (const [d, U] of [[1e-7, 0.03], [3e-7, 0.009], [1.8e-7, 0.018], [5e-8, 0.03]]) {
  const c = fiberCapture(d, U), layers = 2000000, slice = FILTER.thickness / layers, keep = 1 - 4 * a * c.single * slice / (Math.PI * df * (1 - a));
  let left = 1;
  for (let i = 0; i < layers; i++) left *= keep;
  t.near(c.penetration, left, 1e-3 * left, `penetration of ${d * 1e6} µm built up layer by layer`);
}
for (const U of [0.009, 0.018, 0.03]) t.near(filterDrop(U), mu * U * 4e-4 * 64 * a ** 1.5 * (1 + 56 * a ** 3) / df ** 2, 1e-9 * filterDrop(U), 'Davies pressure drop');
const worst = plan => plan.curve.reduce((low, point) => (point.efficiency < low.efficiency ? point : low));
for (const fan of [0, 1, 2]) {
  const U = FLOWS[fan] / 3600 / FILTER.area, f = x => fiberCapture(Math.exp(x), U).efficiency, phi = (Math.sqrt(5) - 1) / 2;
  let lo = Math.log(3e-8), hi = Math.log(1e-6);
  for (let i = 0; i < 100; i++) { const x1 = hi - phi * (hi - lo), x2 = lo + phi * (hi - lo); if (f(x1) < f(x2)) hi = x2; else lo = x1; }
  const mpps = Math.exp((lo + hi) / 2), grid = worst(airCleanerPlan({mode: 0, fan}));
  t.ok(mpps > 1e-7 && mpps < 4e-7, `fan ${fan}: most penetrating size between 0.1 and 0.4 µm`);
  t.ok(Math.abs(Math.log10(grid.size / mpps)) <= 3 / 60 + 1e-9, `fan ${fan}: chart’s worst point within one step of it`);
  t.ok(f(Math.log(mpps)) <= grid.efficiency + 1e-12, `fan ${fan}: nothing worse than the true minimum`);
}

// 3. The precipitator: charging typed in again, and its catch against a Monte
// Carlo of particles carrying Poisson-distributed charges.
let seed = 20260915;
const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const gaussian = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
for (const d of [1e-8, 3e-8, 1e-7, 3e-7, 1e-6, 1e-5]) for (const fan of [0, 2]) {
  const U = FLOWS[fan] / 3600 / 0.06, time = 0.025 / U, c = charging(d, U), where = `${d * 1e6} µm at ${FLOWS[fan]} m³/h`;
  const tau = 4 * eps0 / (5e14 * e * 1.5e-4), saturation = 3 * 2.5 / 4.5 * Math.PI * eps0 * 5.6e5 * d * d / e;
  t.near(c.field, saturation * time / (time + tau), 1e-9 * c.field + 1e-15, `${where}: field charging`);
  const white = d * kT / (2 * K * e * e) * Math.log(1 + Math.PI * K * d * 240 * e * e * 5e14 * time / (2 * kT));
  t.near(c.diffusion, white, 1e-9 * white, `${where}: diffusion charging by White’s equation`);
  const E = 5000 / 0.006, Cc = 1 + 66e-9 / d * (2.34 + 1.05 * Math.exp(-0.39 * d / 66e-9));
  t.near(driftSpeed(1, d, E), e * E * Cc / (3 * Math.PI * mu * d), 1e-9 * driftSpeed(1, d, E), `${where}: drift of one charge`);
  const perCharge = e * E * Cc / (3 * Math.PI * mu * d) * 0.1 / (U * 0.006), mean = c.total;
  let caught = 0;
  const trials = 40000;
  for (let i = 0; i < trials; i++) {
    let n;
    if (mean < 30) { const limit = Math.exp(-mean); let k = 0, product = random(); while (product > limit) { k++; product *= random(); } n = k; }
    else n = Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian()));
    caught += 1 - Math.exp(-n * perCharge);
  }
  const catchShare = plateCatch(d, U);
  t.near(catchShare, caught / trials, 0.01, `${where}: Poisson-weighted catch against a Monte Carlo`);
  t.ok(catchShare <= 1 - Math.exp(-mean * perCharge) + 1e-12, `${where}: a spread of charges catches no more than the mean would`);
  t.near(airCleanerPlan({mode: 1, size: SIZES.indexOf(d) === -1 ? 0 : SIZES.indexOf(d), fan}).efficiency, SIZES.includes(d) ? catchShare : airCleanerPlan({mode: 1, size: 0, fan}).efficiency, 1e-12, `${where}: plan uses the catch`);
}

// 4. The room: clearing rate from its parts, integrated step by step.
for (const values of [{}, {mode: 1}, {mode: 2, size: 6}, {fan: 0, size: 0}, {mode: 1, size: 1, fan: 1}]) {
  const plan = airCleanerPlan(values), where = JSON.stringify(values), Q = FLOWS[plan.values.fan] / 3600;
  t.near(plan.cadr, Q * plan.efficiency, 1e-15, `${where}: clean air delivery rate`);
  const drift = plan.values.mode === 2 ? e * plan.charge.total * 20 * slip(plan.d) / (3 * Math.PI * mu * plan.d) * 64 / 30 : 0;
  const k = plan.cadr / 30 + 0.5 / 3600 + settling(plan.d) * 12 / 30 + drift;
  t.near(plan.total, k, 1e-12, `${where}: room clearing rate`);
  t.near(plan.halfTime, Math.LN2 / k, 1e-6, `${where}: half-time`);
  t.near(plan.electrical, ((plan.values.mode === 0 ? filterDrop(Q / 1.85) : 0) + 25) * Q / 0.3 + (plan.values.mode === 0 ? 0 : 7000 * 1.5e-4), 1e-9, `${where}: power`);
  let C = 1;
  for (let s = 1; s <= 3600; s++) {
    const f = c => -k * c, k1 = f(C), k2 = f(C + k1 / 2), k3 = f(C + k2 / 2), k4 = f(C + k3);
    C += (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    if (s % 600 === 0) t.near(sampleAirCleaner(values, s).remaining, C, 1e-9, `${where}: room at ${s / 60} min`);
  }
}

// 5. The drawing.
const m = createAirCleanerModel(), p = m.topology, MM = p.MM;
const folds = p.pleats.geometry, position = folds.attributes.position, index = folds.index;
let area = 0;
const A = new THREE.Vector3(), B = new THREE.Vector3(), Cv = new THREE.Vector3();
for (let i = 0; i < index.count; i += 3) { A.fromBufferAttribute(position, index.getX(i)); B.fromBufferAttribute(position, index.getX(i + 1)); Cv.fromBufferAttribute(position, index.getX(i + 2)); area += B.clone().sub(A).cross(Cv.clone().sub(A)).length() / 2; }
t.near(area / MM ** 2 * 1e-6, FILTER.area, 1e-4 * FILTER.area, 'drawn pleats add up to the filter’s area');
t.near(position.count / 2, 2 * 92 + 1, 0, '92 pleats');
t.near((position.getY(4) - position.getY(0)) / MM, 300 / 92, 1e-4, 'pleat pitch');
t.near(Math.abs(position.getX(2) - position.getX(0)) / MM, PLEAT_DEPTH, 1e-4, 'pleat depth');
t.near(p.plates.length, 50, 0, 'fifty plates');
for (let k = 1; k < p.plates.length; k++) t.near((p.plates[k].position.y - p.plates[k - 1].position.y) / MM, PRECIPITATOR.gap * 1000, 1e-9, 'plates 6 mm apart');
p.plates[0].geometry.computeBoundingBox();
t.near(p.plates[0].geometry.boundingBox.getSize(new THREE.Vector3()).x / MM, PRECIPITATOR.length * 1000, 1e-4, 'plates 100 mm long');
const wireRods = p.wires.children.filter(child => child.geometry?.type === 'CylinderGeometry');
t.near(wireRods.length, 12, 0, 'twelve ionizing wires');
for (let k = 1; k < wireRods.length; k++) t.near((wireRods[k].position.y - wireRods[k - 1].position.y) / MM, 25, 1e-9, 'wires 25 mm apart, the charging zone');

for (const values of [{}, {mode: 1}, {mode: 2}, {mode: 1, size: 0, fan: 0}, {size: 6, fan: 1}, {mode: 2, size: 5, fan: 0}]) for (const clock of [0, 90, 1200, 3599, 3600, 4000]) {
  m.reset(); m.update(values); m.advance(clock / p.SPEED_UP);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), mode = s.values.mode, where = `${JSON.stringify(values)} at ${clock} s`, now = Math.min(clock, 3600);
  t.near(s.clock, now, 1e-9, `${where}: sixty times real time, one hour`);
  assert.equal(p.pleats.visible, mode === 0);
  assert.equal(p.wires.visible, mode === 1);
  assert.equal(p.needle.visible, mode === 2);
  assert.equal(p.collector.visible, mode === 1);
  t.near(p.wheel.rotation.z, -2 * Math.PI * s.hourly / 60 * (now / 60), 1e-9, `${where}: fan turning with its flow`);
  const caughtCount = Math.round(24 * s.efficiency);
  p.dots.forEach((dot, i) => {
    const place = particlePlace(i, s, now);
    t.near(dot.position.x / MM, place[0], 1e-9, `${where}: particle ${i}`);
    if (i < caughtCount) {
      t.ok(place[0] <= (mode === 0 ? PANEL.front + PLEAT_DEPTH : CELL.collectorStart + 100) + 1e-9, `${where}: caught particle ${i} never passes the stage`);
      const arrived = particlePlace(i, s, (((0.99999999 - i / 24) % 1 + 1) % 1) / (0.25 * s.hourly / 200) * 60);
      if (mode === 1) t.ok(Array.from({length: 50}, (_, k) => plateY(k)).some(y => Math.abs(y - arrived[1]) < 1e-5) && arrived[0] > CELL.collectorStart && arrived[0] < CELL.collectorStart + 100, `${where}: caught particle ${i} ends on a plate`);
      if (mode === 0) t.ok(arrived[0] >= PANEL.front - 1e-5 && arrived[0] <= PANEL.front + PLEAT_DEPTH, `${where}: caught particle ${i} ends on the pleated mat`);
    }
  });
  const uncaught = caughtCount < 24 ? caughtCount : null;
  if (uncaught !== null) {
    const late = ((0.999 - uncaught / 24) % 1 + 1) % 1 / (0.25 * s.hourly / 200) * 60;
    t.ok(particlePlace(uncaught, s, late)[1] > 600, `${where}: uncaught particles leave by the top`);
  }
  const through = p.throughLine.geometry.attributes.position;
  for (const i of [0, 20, 30, 45, 60]) {
    const size = 10 ** (-8 + 3 * i / 60), catchShare = mode === 0 ? fiberCapture(size, s.hourly / 3600 / 1.85).efficiency : mode === 1 ? plateCatch(size, s.hourly / 3600 / 0.06) : 0;
    t.near(through.getX(i), (THROUGH_CHART.left + (Math.log10(size) + 8) / 3 * 300) * MM, 1e-5, `${where}: through chart across`);
    t.near(through.getY(i), (THROUGH_CHART.bottom + Math.min(1, Math.max(0, (Math.log10(Math.max(1 - catchShare, 1e-6)) + 6) / 6)) * 200) * MM, 1e-5, `${where}: through chart up`);
  }
  const room = p.roomLine.geometry.attributes.position, bare = p.bareLine.geometry.attributes.position;
  for (const i of [0, 10, 33, 60]) {
    t.near(room.getY(i), (ROOM_CHART.bottom + Math.exp(-s.total * i * 60) * 200) * MM, 1e-5, `${where}: room chart with the cleaner`);
    t.near(bare.getY(i), (ROOM_CHART.bottom + Math.exp(-(s.rates.ventilation + s.rates.settling) * i * 60) * 200) * MM, 1e-5, `${where}: room chart without it`);
  }
  t.near(p.nowDot.position.y, (ROOM_CHART.bottom + s.remaining * 200) * MM, 1e-9, `${where}: room now`);
  t.near(s.remaining, Math.exp(-s.total * now), 1e-12, `${where}: particles left`);
  if (clock === 1200) checkFinite(m.root, t);
}

// 6. The lessons, the texts, controls, refusals and disposal.
const run = values => { m.reset(); m.update(values); return m.getState(); };
const room = (values, seconds) => sampleAirCleaner(values, seconds);
checkTrialNumbers(airCleanerLesson, {
  'Catch smoke': st => ({'1.9': (1 - st.efficiency) * 1e5, '100,000': 1e5, '99.998': st.efficiency * 100, '200': st.hourly, '6.67': st.changes}),
  'The room clears': st => ({'5.8': st.halfTime / 60, '90.8': (1 - room(st.values, 1200).remaining) * 100, '20': 20, '84.5': room(st.values, 1200).withoutCleaner * 100}),
  'The hardest size': st => ({'0.18': worst(st).size * 1e6, '99.985': worst(st).efficiency * 100}),
  'Tiny particles': st => (t.ok(1 - st.efficiency < 1e-9, 'essentially none get through'), {'0.01': st.d * 1e6}),
  'How fibers catch': st => ({'0.3': st.d * 1e6, '17.8': st.capture.interception * 100, '7.2': st.capture.diffusion * 100, '2.7': st.capture.impaction * 100, '0.4': FILTER.thickness * 1000}),
  'Turn the fan down': st => (t.ok(st.capture.diffusion > airCleanerPlan({}).capture.diffusion, 'slower air, more diffusion'), {'99.9999': st.efficiency * 100, '60': st.hourly, '16.6': st.halfTime / 60, '62.1': airCleanerPlan({}).electrical, '6.6': st.electrical}),
  'Plates instead': st => ({'82.7': st.efficiency * 100, '0.3': st.d * 1e6, '165.4': st.cadr * 3600, '5.7': st.electrical, '62.1': airCleanerPlan({}).electrical}),
  'An ionizer alone': st => (assert.equal(st.efficiency, 0), {'2.43': st.roomDrift * 1e6, '59.2': room(st.values, 3600).remaining * 100, '60.3': room(st.values, 3600).withoutCleaner * 100}),
}, run, t);
checkTrialNumbers(electrostaticPrecipitatorLesson, {
  'Charge and collect': st => ({'0.3': st.d * 1e6, '24.9': st.charge.total, '10.11': st.plateDrift * 100, '82.7': st.efficiency * 100}),
  'More time between the plates': st => ({'100': PRECIPITATOR.length * 1000, '27.78': st.U * 100, '92.59': airCleanerPlan({mode: 1}).U * 100, '99.81': st.efficiency * 100}),
  'Too small to charge': st => ({'0.01': st.d * 1e6, '0.13': st.charge.total, '87.5': Math.exp(-st.charge.total) * 100, '12.5': st.efficiency * 100}),
  'Large particles': st => (t.ok(st.charge.field > st.charge.diffusion, 'mostly field charging'), {'1': st.d * 1e6, '195.9': st.charge.total, '95.8': st.efficiency * 100}),
  'Two ways to charge': st => ({'0.3': st.d * 1e6, '13.1': st.charge.field, '11.8': st.charge.diffusion}),
  'Light on the fan': st => ({'25': st.drop, '5.7': st.electrical, '1.05': st.corona}),
}, run, t);
checkTrialNumbers(ionizerLesson, {
  'Charge without catching': st => (assert.equal(st.efficiency, 0), {'24.9': st.charge.total}),
  'Drift to the walls': st => ({'20': ROOM.field, '2.43': st.roomDrift * 1e6, '59.2': room(st.values, 3600).remaining * 100, '60.3': room(st.values, 3600).withoutCleaner * 100}),
  'Compare a filter': st => ({'0.08': room(st.values, 3600).remaining * 100}),
  'Big particles settle anyway': st => ({'10': st.d * 1e6, '8.1': st.halfTime / 60, '8.5': Math.LN2 / (st.rates.ventilation + st.rates.settling) / 60}),
  'Tiny particles': st => ({'0.01': st.d * 1e6, '87.5': Math.exp(-st.charge.total) * 100}),
}, run, t);

const ions = `${fixed(PRECIPITATOR.ions / 1e14, 0)} × 10¹⁴ ions`, plates = `${fixed(PRECIPITATOR.gap * 1000, 0)} mm apart and ${fixed(PRECIPITATOR.length * 1000, 0)} mm long at ${fixed(PRECIPITATOR.plateVoltage / 1000, 0)} kV`;
checkQuotedText(airCleanerLesson.deeper.map(section => section.body).join(' '), {'0.18 µm': `${fixed(worst(airCleanerPlan({})).size * 1e6, 2)} µm`}, t);
checkQuotedText(airCleanerLesson.limits, {
  '0.6 µm': `${fixed(FILTER.fiber * 1e6, 1)} µm`, '4% solid': `${fixed(FILTER.solidity * 100, 0)}% solid`, '0.4 mm thick': `${fixed(FILTER.thickness * 1000, 1)} mm thick`, '1.85 m²': `${FILTER.area} m²`,
  '30 m³': `${ROOM.volume} m³`, '12 m²': `${ROOM.floor} m²`, '64 m²': `${ROOM.surfaces} m²`, '560,000 V/m': `${fixed(PRECIPITATOR.chargeField, 0)} V/m`, '5 × 10¹⁴ ions': ions,
  '6 mm apart and 100 mm long at 5 kV': plates, '20 V/m': `${ROOM.field} V/m`,
}, t);
checkQuotedText(electrostaticPrecipitatorLesson.limits, {
  '7 kV': `${fixed(PRECIPITATOR.wireVoltage / 1000, 0)} kV`, '25 mm zone': `${fixed(PRECIPITATOR.zone * 1000, 0)} mm zone`, '560,000 V/m': `${fixed(PRECIPITATOR.chargeField, 0)} V/m`, '5 × 10¹⁴ ions': ions,
  '6 mm apart and 100 mm long at 5 kV': plates, '0.06 m²': `${PRECIPITATOR.open} m²`, 'dielectric constant of 2.5': `dielectric constant of ${PRECIPITATOR.dielectric}`,
}, t);
checkQuotedText(ionizerLesson.limits, {'25 mm zone': `${fixed(PRECIPITATOR.zone * 1000, 0)} mm zone`, '64 m²': `${ROOM.surfaces} m²`, '20 V/m': `${ROOM.field} V/m`, '30 m³': `${ROOM.volume} m³`}, t);
t.ok(ROOM.field / (PRECIPITATOR.plateVoltage / PRECIPITATOR.gap) < 1e-3, 'room fields thousands of times weaker than between the plates');
const partText = id => m.parts.find(part => part.id === id).description;
checkQuotedText(partText('filter'), {'0.6 µm': `${fixed(FILTER.fiber * 1e6, 1)} µm`, '4% solid': `${fixed(FILTER.solidity * 100, 0)}% solid`, '0.4 mm thick': `${fixed(FILTER.thickness * 1000, 1)} mm thick`, '92 pleats': `${PANEL.pleats} pleats`, '1.85 m²': `${FILTER.area} m²`, '300 by 200 mm': `${fixed(PANEL.high - PANEL.low, 0)} by ${fixed(PANEL.width, 0)} mm`}, t);
checkQuotedText(partText('collector'), {'6 mm apart and 100 mm long': `${fixed(PRECIPITATOR.gap * 1000, 0)} mm apart and ${fixed(PRECIPITATOR.length * 1000, 0)} mm long`, '5 kV': `${fixed(PRECIPITATOR.plateVoltage / 1000, 0)} kV`}, t);
checkQuotedText(partText('charger'), {'7 kV': `${fixed(PRECIPITATOR.wireVoltage / 1000, 0)} kV`}, t);
checkControlsMove(m, () => [p.pleats.visible, p.collector.visible, p.needle.visible, p.throughLine.geometry.attributes.position.getY(20), p.sizeDot.position.toArray(), p.dots[3].position.toArray(), p.wheel.rotation.z], model => model.advance(300 / p.SPEED_UP), t);
checkRefusals(sampleAirCleaner, AIR_CLEANER_DOMAINS, t);
t.ok(FAN.efficiency === 0.3 && FAN.grille === 25, 'fan constants as the header states');
const resources = checkDisposal(m, t);
console.log(`PASS air cleaner: ${t.count} checks, ${airCleanerLesson.tryIt.length + electrostaticPrecipitatorLesson.tryIt.length + ionizerLesson.tryIt.length} trials, ${resources} resources`);

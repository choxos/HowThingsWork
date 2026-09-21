// Vacuum flask: each heat path from its own formula, the day integrated again
// in one-second steps, the drawing held to the paths and the plan, and every
// number the lesson quotes held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleFlask, flaskPlan, heatPaths, flaskCapacity, FLASK, FLASK_DEFAULTS as D, FLASK_DOMAINS} from './vacuum-flask-physics.js';
import {createVacuumFlaskModel, ARROW_PATHS} from './vacuum-flask-model.js';
import {vacuumFlaskLesson} from './vacuum-flask-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), sigma = 5.670374419e-8, K = 273.15, C = 0.5 * 4186 + 75;

// 1. The four paths.
const pathsRef = (v, T) => {
  const e = v.silvered ? 0.03 : 0.9;
  const radiation = sigma * 0.032 * ((T + K) ** 4 - (20 + K) ** 4) / (1 / e + 1 / e - 1);
  const gas = (v.vacuum ? 0.001 : 1) * 0.026 * 0.032 * (T - 20) / 0.005;
  const neck = (v.neck ? 16 : 1) * Math.PI * 0.05 * 0.0005 / 0.02 * (T - 20);
  const top = (v.stopper ? 0.02 : 0.3) * (T - 20);
  return {radiation, gas, neck, top, total: radiation + gas + neck + top};
};
const combos = [];
for (const silvered of [0, 1]) for (const vacuum of [0, 1]) for (const neck of [0, 1]) for (const stopper of [0, 1]) combos.push({silvered, vacuum, neck, stopper});
for (const v of combos) for (const T of [4, 20, 37, 60, 90, 95]) {
  const got = heatPaths(v, T), ref = pathsRef(v, T);
  for (const key of Object.keys(ref)) t.near(got[key], ref[key], 1e-12 + 1e-10 * Math.abs(ref[key]), `${key} at ${T} °C`);
}
t.near(flaskCapacity(), C, 1e-9, 'heat capacity of the drink and inner wall');
t.near(pathsRef({silvered: 0}, 90).radiation / pathsRef({silvered: 1}, 90).radiation, (2 / 0.03 - 1) / (2 / 0.9 - 1), 1e-9, 'silvering divides radiation by the ratio of the emissivity terms');

// 2. The day, again, in one-second steps.
for (const v of [...combos.map(combo => ({...combo, start: 90})), {start: 4}, {start: 4, stopper: 0}, {start: 4, vacuum: 0}, {start: 20}, {start: 50}, {start: 60}, {start: 70}, {start: 95}]) {
  const full = {...D, ...v}, plan = flaskPlan(full);
  let T = full.start, crossing = null, energy = 0;
  const pathEnergy = {radiation: 0, gas: 0, neck: 0, top: 0};
  for (let n = 0; n < 86400; n++) {
    const paths = pathsRef(full, T), q = paths.total, next = T - q / C;
    for (const key of Object.keys(pathEnergy)) pathEnergy[key] += paths[key];
    energy += q;
    if (crossing === null && full.start >= 60 && T >= 60 && next < 60) crossing = (n + (T - 60) / (T - next)) / 3600;
    T = next;
    if ((n + 1) % 10800 === 0) {
      const hours = (n + 1) / 3600;
      t.near(sampleFlask(full, hours).T, T, 0.005 + 0.001 * Math.abs(T - 20), `${JSON.stringify(v)}: temperature after ${hours} h`);
    }
  }
  const end = sampleFlask(full, 24);
  t.near(end.lost, energy, 0.002 * Math.abs(energy) + 1, 'heat lost is the heat that left along the paths');
  t.near(end.lost, C * (full.start - end.T), 1e-6, 'heat lost is the capacity times the fall');
  for (const key of Object.keys(pathEnergy)) t.near(end.energy[key], pathEnergy[key], 0.002 * Math.abs(pathEnergy[key]) + 1, key + ' cumulative energy');
  if (full.start > 60) {
    if (crossing === null) assert.equal(plan.aboveReferenceUntil, null);
    else t.near(plan.aboveReferenceUntil / 3600, crossing, 0.003, 'time the drink stays above 60 °C');
  } else assert.equal(plan.aboveReferenceUntil, 0, 'starting at or below the comparison line gives zero time above it');
  let previous = Infinity;
  for (const sample of plan.samples) {
    t.near(Object.values(sample.energy).reduce((a, b) => a + b, 0), C * (full.start - sample.T), 1e-6, 'path energies conserve total thermal energy');
    const away = sample.T - 20;
    t.ok(Math.sign(away) === Math.sign(full.start - 20) || Math.abs(away) < 1e-9, 'never passes the room’s temperature');
    t.ok(Math.abs(away) <= previous + 1e-12, 'always nears the room’s temperature');
    previous = Math.abs(away);
  }
  t.near(end.paths.total, pathsRef(full, end.T).total, 1e-9, 'paths reported at the day’s end');
}

// 3. The drawing.
const m = createVacuumFlaskModel(), p = m.topology, MM = p.MM;
const colorRef = T => new THREE.Color(0x4f86c6).lerp(new THREE.Color(0xd23b1f), Math.max(0, Math.min(1, T / 100)));
t.near(p.OUTER[7][0] - p.INNER[1][0], FLASK.gap * 1000, 1e-12, 'body gap drawn 5 mm wide');
t.near(p.INNER[0][1] - p.OUTER[8][1], 5, 1e-12, 'base gap drawn 5 mm high');
const neckVertices = p.neckBand.geometry.attributes.position;
let neckMinR = Infinity, neckMaxR = 0, neckMinY = Infinity, neckMaxY = 0;
for (let i = 0; i < neckVertices.count; i++) {
 const radius = Math.hypot(neckVertices.getX(i), neckVertices.getZ(i)) / MM, y = neckVertices.getY(i) / MM;
 neckMinR = Math.min(neckMinR, radius); neckMaxR = Math.max(neckMaxR, radius); neckMinY = Math.min(neckMinY, y); neckMaxY = Math.max(neckMaxY, y);
}
t.near(neckMinR * 2 * Math.PI / 1000, FLASK.neckPerimeter, 1e-7, 'neck inner perimeter matches thin-wall approximation');
t.near(neckMaxR - neckMinR, FLASK.neckWall * 1000, 1e-5, 'actual neck mesh has a half-millimeter wall');
t.near(p.NECK[2][1] - p.NECK[0][1], FLASK.neckLength * 1000, 1e-12, 'authored neck path is exactly 20 mm');
t.near(neckMaxY - neckMinY, FLASK.neckLength * 1000, 3e-5, 'Float32 neck path is 20 mm long');
t.near(neckMinY, p.INNER[3][1], 3e-5, 'neck meets the inner vessel');
t.near(neckMaxY, p.OUTER[4][1], 3e-5, 'neck reaches the outer-vessel rim');
for (const mesh of [p.inner, p.outer, p.neckBand, p.rim, p.liquid]) {
 assert.equal(mesh.userData.cutFaces.length, 2, 'two closed section faces');
 for (const face of mesh.userData.cutFaces) assert.ok(face.geometry.attributes.position.count >= 3, 'section face contains triangles');
}
const localY = mesh => { mesh.geometry.computeBoundingBox(); return [mesh.geometry.boundingBox.min.y + mesh.position.y, mesh.geometry.boundingBox.max.y + mesh.position.y].map(y => y / MM); };
t.near(localY(p.floor)[1], localY(p.cork)[0], 1e-5, 'case floor touches cork support');
t.near(localY(m.covers[0])[0], localY(p.floor)[1], 1e-5, 'case wall rests on floor without overlapping it');
t.near(localY(p.cork)[1], 13, 1e-5, 'support touches outer vessel base');
t.ok(localY(p.cork)[1] < p.OUTER[8][1], 'support never crosses the vacuum gap');
t.near(p.plug.geometry.parameters.radiusTop, neckMinR * MM, 1e-7, 'stopper seals the inner neck');
assert.equal(p.innerWall.parent, p.gap); assert.equal(p.outerWall.parent, p.gap); assert.equal(p.neck.parent, p.gap);
assert.ok(p.gap.children.length > 3, 'empty-gap inspection retains its enclosing walls');
for (const guide of [p.chart, p.flows]) { assert.equal(guide.userData.explosionExcluded, true); assert.ok(m.thumbnailOmit.includes(guide)); }
for (const text of ['0', '6', '12', '18', '24', '20', '60', '100', 'Elapsed hours', 'Drink temperature (°C)']) assert.ok(p.labels.some(label => label.userData.labelText === text));
assert.equal(m.controls.find(c => c.key === 'vacuum').primary, true);
m.root.updateMatrixWorld(true);
const chartOrigin = p.chart.localToWorld(new THREE.Vector3()), chartAcross = p.chart.localToWorld(new THREE.Vector3(1, 0, 0)).sub(chartOrigin), chartUp = p.chart.localToWorld(new THREE.Vector3(0, 1, 0)).sub(chartOrigin);
t.near(chartAcross.y, 0, 1e-12, 'chart time axis stays level in the initial front view');
t.near(chartUp.x, 0, 1e-12, 'chart temperature axis stays upright in the initial front view');
t.near(chartAcross.x, 1, 1e-12, 'time increases rightward without projection skew');
t.near(chartUp.y, 1, 1e-12, 'temperature increases upward without projection skew');
const drinkVolume = Math.PI * (p.DRINK.radius / 1000) ** 2 * (p.DRINK.top - p.DRINK.bottom) / 1000;
t.near(drinkVolume * 1000, FLASK.water, 1e-9, 'drink drawn as half a liter');
const wetArea = 2 * Math.PI * p.DRINK.radius / 1000 * (p.DRINK.top - p.DRINK.bottom) / 1000 + Math.PI * (p.DRINK.radius / 1000) ** 2;
t.near(wetArea, FLASK.area, 0.001, 'vessel drawn with the area the physics uses');
for (const mesh of [p.inner, p.outer, p.liquid]) {
  const position = mesh.geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    if (Math.hypot(x, z) < 1e-6) continue;
    const angle = (Math.atan2(x, z) + 2 * Math.PI) % (2 * Math.PI);
    t.ok(angle >= p.CUT - 1e-5 && angle <= 2 * Math.PI - p.CUT + 1e-5, 'the cutaway wedge faces the viewer');
  }
}
m.root.position.set(-0.4, 0.3, 0.6);
for (const values of [{}, {silvered: 0}, {vacuum: 0}, {neck: 1}, {stopper: 0}, {start: 4}, {start: 4, stopper: 0, vacuum: 0}, {start: 55, silvered: 0}, {start: 20}, {start: 95, silvered: 0, vacuum: 0, neck: 1, stopper: 0}]) for (const hours of [0, 0.5, 3, 12.25, 24]) {
  m.reset(); m.update(values); m.advance(hours);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), full = s.values;
  t.near(s.hours, hours, 1e-12, 'clock an hour per playback second');
  const drink = colorRef(s.T);
  t.ok(Math.abs(p.liquid.material.color.r - drink.r) < 1e-9 && Math.abs(p.liquid.material.color.b - drink.b) < 1e-9, 'drink colored by its temperature');
  t.ok(p.faces.every(face => face.material === p.liquid.material), 'cut faces of the drink share its color');
  assert.equal(p.outer.material, p.inner.material, 'both walls share one finish');
  assert.equal(p.inner.material.color.getHex(), full.silvered ? 0xe4ebee : 0xcfe3e8);
  assert.equal(p.inner.material.opacity, full.silvered ? 0.92 : 0.4);
  assert.equal(p.neckBand.material.color.getHex(), full.neck ? 0x8e9aa0 : 0xcfe3e8);
  t.near(p.stopper.position.x / MM, full.stopper ? 0 : -85, 1e-9, 'removed stopper remains visible beside flask');
  t.near(p.stopper.position.y / MM, full.stopper ? 0 : -166, 1e-9, 'removed stopper clears the opening');
  if (!full.stopper) {
    const radius = Math.max(...p.stopper.children.map(mesh => mesh.geometry.parameters.radiusTop));
    t.near((Math.abs(p.stopper.position.x) - radius - p.floor.geometry.parameters.radiusTop) / MM, 7, 1e-9, 'parked stopper clears the entire case by 7 mm');
  }
  for (const dot of p.molecules) {
    assert.equal(dot.visible, full.vacuum === 0);
    const radius = Math.hypot(dot.position.x, dot.position.z) / MM, angle = (Math.atan2(dot.position.x, dot.position.z) + 2 * Math.PI) % (2 * Math.PI);
    t.ok(radius - 1.1 > 36 && radius + 1.1 < 41 && dot.position.y / MM - 1.1 > 20 && dot.position.y / MM + 1.1 < 150, 'whole molecule spheres stay in the gap');
    t.ok(angle - Math.asin(1.1 / radius) > p.CUT && angle + Math.asin(1.1 / radius) < 2 * Math.PI - p.CUT, 'molecules stay in the uncut part');
  }
  for (const [key, {anchor, out}] of Object.entries(ARROW_PATHS)) {
    const arrow = p.arrows[key], watts = pathsRef(full, s.T)[key], length = Math.abs(watts) < 1e-9 ? 0 : 22 * MM;
    t.near(arrow.userData.length, length, 1e-9, `${key} visible direction arrow, no false magnitude scale`);
    t.near(p.bars[key].scale.x, Math.max(Math.abs(watts) / 25 * 105, 1e-9), 1e-9, key + ' bar shares the 0–25 W scale');
    assert.ok(Math.abs(watts) <= 25, 'individual bar remains in range');
    assert.equal(p.wattLabels[key].userData.labelText, fixed(Math.abs(watts), 3) + ' W');
    assert.equal(p.bars[key].visible, Math.abs(watts) >= 1e-9);
    if (Math.abs(watts) < 1e-9) { assert.equal(arrow.visible, false); continue; }
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion), sign = Math.sign(watts);
    t.near(direction.dot(new THREE.Vector3(...out)), sign, 1e-9, `${key} arrow points out while the drink is warmer than the room`);
    const tail = arrow.position.clone().divideScalar(MM), tip = tail.clone().add(direction.clone().multiplyScalar(length / MM)), fixedEnd = sign > 0 ? tail : tip;
    t.near(fixedEnd.distanceTo(new THREE.Vector3(...anchor)), 0, 1e-6, `${key} arrow ${sign > 0 ? 'starts' : 'ends'} at its path`);
  }
  const trace = p.trace.geometry.attributes.position;
  for (let i = 0; i < s.samples.length; i += 60) {
    t.near(trace.getX(i) / MM, 110 + s.samples[i].t / 3600 / 24 * 180, 1e-4, 'chart hour');
    t.near(trace.getY(i) / MM, 105 + s.samples[i].T / 100 * 120, 1e-4, 'chart temperature');
  }
  t.near(p.cursor.geometry.attributes.position.getX(0) / MM, 110 + hours / 24 * 180, 1e-4, 'chart clock');
  t.near(p.room.geometry.attributes.position.getY(0) / MM, 105 + 20 / 100 * 120, 1e-4, 'room line at 20 °C');
  t.near(p.hotLine.geometry.attributes.position.getY(1) / MM, 105 + 60 / 100 * 120, 1e-4, 'hot drink line at 60 °C');
  const until = s.readings.find(reading => reading.label === 'Time above 60°C').value;
  if (full.start > 20 && s.aboveReferenceUntil > 0) assert.equal(until, `${fixed(s.aboveReferenceUntil / 3600, 1)} h`);
  checkFinite(m.root, t);
}
checkControlsMove(m, () => [p.liquid.material.color.getHex(), p.inner.material.opacity, p.neckBand.material.color.getHex(), p.stopper.position.x, p.molecules[0].visible, p.arrows.radiation.userData.length, p.arrows.top.userData.length, [...p.trace.geometry.attributes.position.array.slice(3000, 3006)]], model => model.advance(3), t);

// 4. The lesson, refusals, disposal.
const run = values => { m.reset(); m.update(values); m.advance(1e4); return m.getState(); };
const hoursAbove = st => st.aboveReferenceUntil / 3600;
checkTrialNumbers(vacuumFlaskLesson, {
  'Keep coffee hot': st => ({'1.96': st.startPaths.total, '1.40': st.startPaths.top, '60': FLASK.reference, '12.1': hoursAbove(st), '43.4': st.T}),
  'Scrape off the silvering': st => ({'14.86': st.startPaths.radiation, '1.5': hoursAbove(st), '29.7': sampleFlask(st.values, 6).T}),
  'Let air into the gap': st => ({'11.65': st.startPaths.gas, '5': FLASK.gap * 1000, '60': FLASK.reference, '1.7': hoursAbove(st)}),
  'A steel neck': st => ({'4.40': st.startPaths.neck, '3.9': hoursAbove(st)}),
  'Leave the stopper out': st => ({'21.00': st.startPaths.top, '97': st.startPaths.top / st.startPaths.total * 100, '1.1': hoursAbove(st)}),
  'Remove three barriers': st => ({'47.78': st.startPaths.total, '43.6': sampleFlask(st.values, 1).T}),
  'Keep a drink cold': st => (t.ok(st.startPaths.total < 0, 'heat flows in'), {'0.43': -st.startPaths.total, '12': 12, '10.6': sampleFlask(st.values, 12).T, '14.5': st.T}),
  'A cold drink with no stopper': st => (t.ok(st.startPaths.top < 0, 'heat flows in through the top'), {'4.80': -st.startPaths.top, '19.2': sampleFlask(st.values, 6).T}),
  'Match the room': st => ({'0': st.paths.total, '20': st.T, '24': st.hours}),
  'Start below the comparison line': st => ({'0.82': st.startPaths.total, '20': FLASK.room, '0': st.aboveReferenceUntil, '60': FLASK.reference}),
}, run, t);
const good = heatPaths(D, 90);
checkQuotedText(vacuumFlaskLesson.deeper.map(section => section.body).join(' '), {
  '3%': `${fixed(0.03 * 100, 0)}%`,
  'about 54': `about ${fixed((2 / 0.03 - 1) / (2 / 0.9 - 1), 0)}`,
  '1.40 W of the 1.96 W': `${fixed(good.top, 2)} W of the ${fixed(good.total, 2)} W`,
  '0.27 W': `${fixed(good.neck, 2)} W`,
  '0.82 W at 50°C': `${fixed(heatPaths(D, 50).total, 2)} W at 50°C`,
}, t);
checkQuotedText(vacuumFlaskLesson.misconception, {'1.5 h': `${fixed(flaskPlan({silvered: 0}).aboveReferenceUntil / 3600, 1)} h`, '12.1 h': `${fixed(flaskPlan({}).aboveReferenceUntil / 3600, 1)} h`}, t);
checkQuotedText(vacuumFlaskLesson.quiz.explanation, {'1.40 W of the 1.96 W': `${fixed(good.top, 2)} W of the ${fixed(good.total, 2)} W`}, t);
checkQuotedText(vacuumFlaskLesson.limits, {'0.032 square meter': `${FLASK.area} square meter`, '5 mm gap': `${fixed(FLASK.gap * 1000, 0)} mm gap`, '20 mm long': `${fixed(FLASK.neckLength * 1000, 0)} mm long`, '0.02 W per degree': `${FLASK.stopper} W per degree`, '0.3 W per degree': `${FLASK.openTop} W per degree`}, t);
checkQuotedText(m.parts.map(part => part.description).join(' '), {'5 mm': `${fixed(FLASK.gap * 1000, 0)} mm`, '20 mm': `${fixed(FLASK.neckLength * 1000, 0)} mm`}, t);
for (const control of m.controls) {
 m.reset(); m.advance(6); m.update({[control.key]: D[control.key]}); assert.equal(m.getState().hours, 6, 'unchanged setting preserves time');
 m.update({[control.key]: D[control.key] === control.min ? control.max : control.min}); assert.equal(m.getState().hours, 0, control.key + ' change resets time');
 m.advance(2); assert.equal(m.getState().hours, 2); m.reset(); assert.equal(m.getState().hours, 0);
}
m.update({start: 20}); m.advance(24); assert.equal(m.getState().T, 20); assert.equal(m.getState().lost, 0); assert.equal(m.playback.complete(), true);
m.reset(); m.playback.step(); assert.equal(m.getState().hours, 1);
for (const [i, hour] of [[0, 6], [1, 24]]) { m.actions[i].run(); assert.equal(m.getState().hours, hour); }
assert.equal(m.actions[2].isolate, true);
const beforeChart = JSON.stringify(m.getState().readings); m.actions[3].run();
assert.equal(m.actions[3].part, 'chart'); assert.equal(m.actions[3].isolate, true); assert.equal(JSON.stringify(m.getState().readings), beforeChart);
checkRefusals(sampleFlask, FLASK_DOMAINS, t);
const disposedTextures = new Set(); p.textures.forEach(texture => texture.addEventListener('dispose', () => disposedTextures.add(texture)));
const resources = checkDisposal(m, t);
assert.equal(disposedTextures.size, p.textures.length, 'all chart textures disposed');
console.log(`PASS vacuum flask model: ${t.count} checks, ${vacuumFlaskLesson.tryIt.length} trials, ${resources} resources`);

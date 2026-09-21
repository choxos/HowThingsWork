// Refrigerator and refrigerant compressor: the property fits against Clausius
// and Clapeyron, the cycle against its own first law and indicator loop, the
// coils solved again by Newton, six hours simulated again with a finer step,
// the drawing held to the state, and every number both lessons quote held to
// the model.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleFridge, fridgePlan, cycle, running, indicator, piston, cylinderPressure, runningTime, saturation, latentHeat, vaporHeat, swept, FRIDGE, FRIDGE_DOMAINS} from './refrigerator-physics.js';
import {createRefrigeratorModel, cyclePoints, liquidEnthalpy, vaporEnthalpy, phPoint, ttPoint, tempRange, pvPoint, LOOP, loopAt} from './refrigerator-model.js';
import {refrigeratorLesson} from './refrigerator-lessons.js';
import {tally, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), R = 8.314, M = 0.05812, K = 273.15, gamma = 1.1;

// 1. The refrigerant.
t.near(saturation(-11.75), 101325, 5, 'boils at -11.75 °C at one atmosphere');
t.ok(Math.abs(saturation(40) / 5.311e5 - 1) < 0.15, 'illustrative saturation curve within stated 15% check of NIST at 40 °C');
for (const T of [-30, -10, 20, 50]) {
  const slope = (Math.log(saturation(T + 1e-3)) - Math.log(saturation(T - 1e-3))) / 2e-3;
  t.near(slope, latentHeat(T) * M / (R * (T + K) ** 2), 1e-6 * slope, 'the boiling curve’s slope gives the latent heat');
}
t.near(vaporHeat(), gamma / (gamma - 1) * R / M, 1e-9, 'vapor heat capacity of an ideal gas with gamma 1.1');
t.near(swept(), Math.PI * 0.01 ** 2 * 0.016, 1e-15, 'swept volume of the piston');

// 2. The cycle against its own first law and indicator loop.
for (const [Te, Tc] of [[-25, 35], [-19.6, 40.3], [-15, 60], [-5, 45]]) {
  const c = cycle(Te, Tc), ind = indicator(c), cp = vaporHeat(), suction = Te + K + 10;
  t.near(c.rejected, c.capacity + c.shaft, 1e-9, 'the condenser gives out the heat taken in plus the work');
  t.near(liquidEnthalpy(Tc), c.flash * vaporEnthalpy(Te) + (1 - c.flash) * liquidEnthalpy(Te), 1e-6, 'the capillary keeps enthalpy while part of the liquid flashes');
  t.near(c.cooling, vaporEnthalpy(Te) + cp * 10 - liquidEnthalpy(Tc), 1e-6, 'cooling per kilogram from the enthalpy chart');
  t.near(cp * (c.discharge - c.suction), c.work, 1e-6 * c.work, 'the work leaves as the vapor’s extra heat');
  const [h1, h2] = cyclePoints(c).map(point => point[0]);
  t.near(h2, vaporEnthalpy(c.Tc) + cp * (c.discharge - c.Tc), 1e-8, 'discharge temperature and enthalpy agree');
  t.near(h1, vaporEnthalpy(c.Te) + cp * (c.suction - c.Te), 1e-8, 'suction temperature and enthalpy agree');
  t.ok(c.discharge > c.Tc, 'condenser receives superheated vapor');
  let area = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) { const a = 2 * Math.PI * i / N, b = 2 * Math.PI * (i + 1) / N; area += (cylinderPressure(c, a) + cylinderPressure(c, b)) / 2 * (piston(b).volume - piston(a).volume); }
  const inducted = c.density * (ind.Vb - ind.reexpandedAt);
  t.near(-area / inducted, cp * suction * c.lift, 0.003 * cp * suction * c.lift, 'the indicator loop’s area per kilogram is the ideal compression work');
  t.near((ind.Vb - ind.reexpandedAt) / swept(), c.volumetric, 1e-12, 'the cylinder fills the stroke less the re-expansion');
  t.near(c.flow, swept() * 2900 / 60 * c.density * c.volumetric, 1e-15, 'mass flow');
  t.near(c.density, c.Pe * M / (R * suction), 1e-12, 'suction vapor density');
  t.near(c.carnot, (Te + K) / (Tc - Te), 1e-12, 'Carnot limit');
  let most = 0, least = Infinity;
  for (let i = 0; i < 720; i++) { const P = cylinderPressure(c, 2 * Math.PI * i / 720); most = Math.max(most, P); least = Math.min(least, P); }
  t.near(most, c.Pc, 1e-9 * c.Pc, 'discharge at the condenser’s pressure');
  t.near(least, c.Pe, 1e-9 * c.Pe, 'suction at the evaporator’s pressure');
}

// 3. The coils, solved again by Newton, and six hours simulated again.
function solve(Tcab, room, UAc, guess) {
  let [Te, Tc] = guess;
  const F = (a, b) => { const c = cycle(a, b); return [c.capacity - 4 * (Tcab - a), c.rejected - UAc * (b - room)]; };
  for (let i = 0; i < 60; i++) {
    const f0 = F(Te, Tc), h = 1e-6, fa = F(Te + h, Tc), fb = F(Te, Tc + h);
    const j00 = (fa[0] - f0[0]) / h, j01 = (fb[0] - f0[0]) / h, j10 = (fa[1] - f0[1]) / h, j11 = (fb[1] - f0[1]) / h, det = j00 * j11 - j01 * j10;
    const dTe = (f0[0] * j11 - f0[1] * j01) / det, dTc = (j00 * f0[1] - j10 * f0[0]) / det;
    Te -= dTe; Tc -= dTc;
    if (Math.abs(dTe) + Math.abs(dTc) < 1e-11) break;
  }
  return [Te, Tc];
}
for (const [Tcab, room, coils] of [[4, 22, 0], [3, 32, 1], [22, 22, 0], [8, 16, 0]]) {
  const got = running(Tcab, room, coils), [Te, Tc] = solve(Tcab, room, 8 * (coils ? 0.5 : 1), [Tcab - 20, room + 20]);
  t.near(got.Te, Te, 1e-6, 'evaporating temperature where both coils balance');
  t.near(got.Tc, Tc, 1e-6, 'condensing temperature where both coils balance');
  t.near(got.capacity, 4 * (Tcab - got.Te), 1e-6, 'evaporator coil passes the cooling');
  t.near(got.rejected, 8 * (coils ? 0.5 : 1) * (got.Tc - room), 1e-6, 'condenser coil passes the heat out');
}
function simulate(values) {
  const UAc = 8 * (values.coils ? 0.5 : 1), leak = 1.76 + (values.seal ? 0.8 : 0), low = values.setting - 3, high = Math.max(values.room, values.setting + 1) + 1, step = 0.02, table = [];
  let guess = [low - 20, values.room + 20];
  for (let i = 0; low + i * step <= high + 1e-9; i++) { guess = solve(low + i * step, values.room, UAc, guess); table.push(cycle(...guess)); }
  const at = T => { const x = Math.min(table.length - 1.000001, Math.max(0, (T - low) / step)), i = Math.floor(x), u = x - i; return [table[i].capacity + (table[i + 1].capacity - table[i].capacity) * u, table[i].electric + (table[i + 1].electric - table[i].electric) * u]; };
  let T = values.start ? values.room : values.setting + 1, on = true, energy = 0, firstStop = null, runSeconds = 0;
  const dt = 0.5, starts = [], stops = [];
  for (let n = 0; n * dt < 21600; n++) {
    const [capacity, electric] = on ? at(T) : [0, 0];
    if (on) runSeconds += dt;
    energy += electric * dt;
    T += (leak * (values.room - T) - capacity) * dt / 20000;
    if (on && T <= values.setting - 1) { on = false; stops.push((n + 1) * dt); firstStop ??= (n + 1) * dt; }
    else if (!on && T >= values.setting + 1) { on = true; starts.push({t: (n + 1) * dt, energy}); }
  }
  if (starts.length < 2) return {duty: runSeconds / 21600, period: null, firstStop, energy};
  const a = starts.at(-2), b = starts.at(-1), stop = stops.find(s => s > a.t && s < b.t);
  return {duty: runSeconds / 21600, cycleDuty: (stop - a.t) / (b.t - a.t), period: b.t - a.t, daily: (b.energy - a.energy) / (b.t - a.t) * 86400, firstStop};
}
for (const values of [{}, {room: 32}, {coils: 1}, {seal: 1}, {setting: 2}, {start: 1}, {room: 32, coils: 1, seal: 1}]) {
  const full = {setting: 4, room: 22, coils: 0, seal: 0, start: 0, ...values}, plan = fridgePlan(full), ref = simulate(full);
  t.near(plan.duty, ref.duty, 0.004, `${JSON.stringify(values)}: share of the time running`);
  if (ref.period === null) assert.equal(plan.period, null);
  else {
    t.near(plan.period, ref.period, 20, 'thermostat cycle');
    t.near(plan.daily, ref.daily, 0.01 * ref.daily, 'energy a day');
  }
  if (full.start) t.near(plan.pulledDown, ref.firstStop, 30, 'time to first reach the bottom of the band');
  const first = plan.samples[0], last = plan.samples.at(-1);
  t.near(20000 * (last.T - first.T), last.leaked - last.removed, 1e-6 * Math.abs(last.leaked) + 1e-3, 'the cabinet warms by what leaks in less what is taken out');
  t.near(last.released, last.removed + 0.8 * last.energy, 1e-6 * last.released + 1e-3, 'the room gets the heat taken out plus the motor’s work');
  let previous = null;
  for (const change of plan.switches) {
    const sample = sampleFridge(full, change.t);
    if (previous !== null) t.ok(change.on !== previous, 'the compressor alternates');
    previous = change.on;
    // The nearest sample is at most 5 s from the switch, and the cabinet moves under 0.005 degrees a second.
    if (sample) t.ok(change.on ? sample.T >= full.setting + 1 - 0.03 : sample.T <= full.setting - 1 + 0.03, 'switches at the edge of the band');
  }
  let ran = 0, from = 0;
  for (const change of plan.switches) { if (change.on) from = change.t; else ran += change.t - from; }
  if (plan.switches.length === 0 || plan.switches.at(-1).on) ran += 21600 - (plan.switches.length ? plan.switches.at(-1).t : 0);
  t.near(runningTime(plan, 21600), ran, 1e-9, 'running time adds up every stretch the compressor ran');
  t.near(runningTime(plan, 21600) / 21600, plan.samples.reduce((sum, sample, i) => sum + (i && plan.samples[i - 1].on ? sample.t - plan.samples[i - 1].t : 0), 0) / 21600, 0.01, 'running time matches the samples');
}

// 4. The drawing.
const loopLength = LOOP.points.slice(1).reduce((sum, point, i) => sum + Math.hypot(...point.map((v, k) => v - LOOP.points[i][k])), 0);
t.near(LOOP.total, loopLength, 1e-9, 'loop length');
for (let d = 0; d < loopLength; d += 97) {
  const {position} = loopAt(d);
  const onSegment = LOOP.points.slice(1).some((b, i) => { const a = LOOP.points[i], ab = b.map((v, k) => v - a[k]), ap = position.map((v, k) => v - a[k]), len = Math.hypot(...ab), u = ab.reduce((s, v, k) => s + v * ap[k], 0) / len ** 2; return u >= -1e-9 && u <= 1 + 1e-9 && Math.hypot(...ap.map((v, k) => v - ab[k] * u)) < 1e-6; });
  t.ok(onSegment, 'refrigerant dots ride the pipes');
}
const m = createRefrigeratorModel(), p = m.topology, MM = p.MM, TAU = Math.PI * 2;
m.root.position.set(0.2, -0.5, 0.1);
for (const values of [{}, {start: 1}, {coils: 1, seal: 1}, {room: 32, coils: 1, seal: 1}]) for (const clock of [0, 1234, 5000, 12000, 21600]) {
  m.reset(); m.update(values); m.advance(clock / FRIDGE.speedUp);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), c = s.cycle;
  t.near(s.clock, clock, 1e-6, 'clock 720 times playback');
  const distance = runningTime(s, clock) / FRIDGE.speedUp * p.DOT_PACE * s.typical.flow / 3.83e-4;
  p.dots.forEach((dot, i) => {
    const at = loopAt(distance + i * LOOP.total / p.DOTS);
    t.near(dot.position.distanceTo(new THREE.Vector3(...at.position.map(v => v * MM)).sub(dot.parent.position)), 0, 1e-9, 'dot where the refrigerant has got to');
    assert.equal(dot.material.color.getHex(), at.state);
  });
  const theta = TAU * runningTime(s, clock) / FRIDGE.speedUp, radius = 8, rod = 30;
  t.near(p.pin.position.x / MM, radius * Math.cos(theta), 1e-9, 'crank pin across');
  t.near(p.pin.position.z / MM, radius * Math.sin(theta), 1e-9, 'crank pin deep');
  const pinX = p.pistonHead.position.x / MM;
  t.near(Math.hypot(pinX - radius * Math.cos(theta), radius * Math.sin(theta)), rod, 1e-9, 'the rod keeps its length');
  t.near(piston(theta).drop * 1000, radius + rod - pinX, 1e-9, 'piston drop from the top');
  const ind = indicator(c), pv = p.pvLine.geometry.attributes.position;
  let vMin = Infinity, vMax = -Infinity, pMin = Infinity, pMax = -Infinity;
  for (let i = 0; i <= 120; i++) { vMin = Math.min(vMin, pv.getX(i)); vMax = Math.max(vMax, pv.getX(i)); pMin = Math.min(pMin, pv.getY(i)); pMax = Math.max(pMax, pv.getY(i)); }
  t.near(vMin, pvPoint(ind.Vc, 0)[0], 1e-6, 'indicator loop starts at the clearance');
  t.near(vMax, pvPoint(ind.Vb, 0)[0], 1e-6, 'indicator loop reaches the stroke’s end');
  t.near(pMin, pvPoint(0, c.Pe)[1], 1e-6, 'indicator loop bottoms at suction');
  t.near(pMax, pvPoint(0, c.Pc)[1], 1e-6, 'indicator loop tops at discharge');
  t.near(p.pvDot.position.x, pvPoint(piston(theta).volume, 0)[0], 1e-9, 'indicator dot at the cylinder’s volume');
  const corners = cyclePoints(c), loopLine = p.loopLine.geometry.attributes.position;
  t.near(corners[1][0] - corners[0][0], c.work, 1e-6, 'compression adds the work');
  t.near(corners[0][0] - corners[3][0], c.cooling, 1e-6, 'evaporation takes in the cooling');
  t.near(loopLine.getY(0), loopLine.getY(3), 1e-6, 'suction and capillary exit share the low pressure');
  t.near(loopLine.getY(1), loopLine.getY(2), 1e-6, 'discharge and condenser exit share the high pressure');
  t.near(loopLine.getX(0), phPoint(corners[0][0], c.Pe)[0], 1e-6, 'cycle corner on the chart');
  const dome = p.domeVapor.geometry.attributes.position;
  t.near(dome.getY(20), phPoint(0, saturation(-39 + 20 * 157 / 59))[1], 1e-6, 'boiling dome at its pressure');
  t.near(dome.getX(20) - p.domeLiquid.geometry.attributes.position.getX(20), phPoint(latentHeat(-39 + 20 * 157 / 59), 1e5)[0] - phPoint(0, 1e5)[0], 1e-6, 'dome as wide as the latent heat');
  const trace = p.trace.geometry.attributes.position;
  for (let i = 0; i < s.samples.length; i += 211) t.near(trace.getY(i), ttPoint(0, s.samples[i].T, tempRange(s.values))[1], 1e-6, 'cabinet trace');
  let intervals = 0, since = s.samples[0].on ? 0 : null;
  for (const change of s.switches) { if (change.on) since = change.t; else { intervals++; since = null; } }
  if (since !== null) intervals++;
  assert.equal(p.runs.geometry.drawRange.count, intervals * 2, 'a mark for each stretch of running');
  const watts = {leak: s.leak * (s.values.room - s.T), removed: s.on ? c.capacity : 0, released: s.on ? c.rejected : 0, power: s.on ? c.electric : 0, motorLoss: s.on ? c.motorLoss : 0};
  for (const [key, {tip, out}] of Object.entries(p.anchors)) {
    const arrow = p.arrows[key], length = Math.max(0, watts[key]) * p.WATT * MM, direction = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);
    t.near(arrow.userData.length, length, 1e-12, `${key} arrow at 2 mm per watt`);
    if (length > 0) t.near(arrow.position.clone().add(direction.multiplyScalar(key === 'released' || key === 'motorLoss' ? 0 : length)).distanceTo(new THREE.Vector3(...tip.map(v => v * MM))), 0, 1e-9, `${key} arrow ends at its place`);
  }
  assert.equal(p.dust.visible, s.values.coils === 1);
  checkFinite(m.root, t);
}
checkControlsMove(m, () => [p.dust.visible, [...p.trace.geometry.attributes.position.array.slice(300, 306)], p.arrows.leak.userData.length, [...p.loopLine.geometry.attributes.position.array.slice(0, 6)]], model => model.advance(3000 / FRIDGE.speedUp), t);

// 5. Both lessons, the text, refusals and disposal.
for (const trial of refrigeratorLesson.tryIt) {
  m.reset(); m.update(trial.values);
  const initial = m.getState();
  t.near(initial.clock, 0, 1e-12, `${trial.title}: fresh trial`);
  assert.deepEqual(initial.values, trial.values);
  assert.ok(m.parts.some(part => part.id === trial.part));
  assert.equal(trial.isolate, ['charts', 'cycle-chart', 'indicator'].includes(trial.part));
  m.advance(FRIDGE.duration / FRIDGE.speedUp);
  assert.equal(m.getState().complete, true);
  if (trial.title === 'When cooling cannot reach the target') { assert.equal(m.getState().reaches, false); assert.equal(m.getState().duty, 1); }
}
checkQuotedText(refrigeratorLesson.limits, {'375 kJ/kg': `${fixed(latentHeat() / 1000, 0)} kJ/kg`, '5.03 cm³': `${fixed(swept() * 1e6, 2)} cm³`, '2,900 rpm': `${fixed(FRIDGE.rpm, 0)} rpm`, '4% clearance': `${FRIDGE.clearance * 100}% clearance`, '1.76 W per degree': `${FRIDGE.leak} W per degree`}, t);
checkQuotedText(m.parts.map(part => part.description).join(' '), {'5 cm': '5 cm', '20 mm': `${FRIDGE.bore * 1000} mm`, '16 mm': `${FRIDGE.stroke * 1000} mm`, '2 mm per watt': `${p.WATT} mm per watt`}, t);
for (let room = 16; room <= 32; room += 2) for (const coils of [0, 1]) {
  for (const c of fridgePlan({room, coils}).table.entries) {
    assert.ok(c.Pc < 16e5 && c.Pe > 0.3e5 && c.Pc < 20e5, 'pressure charts contain all running states');
    assert.ok(c.suction < c.Te + 11 && c.discharge > c.Tc);
    for (const [h, pressure] of cyclePoints(c)) assert.ok(h > 0 && h < 700e3 && pressure > 0.3e5 && pressure < 20e5, 'cycle chart contains every operating point');
    t.near(cyclePoints(c)[1][0], vaporEnthalpy(c.Tc) + vaporHeat() * (c.discharge - c.Tc), 1e-8, 'every discharge state has one temperature and enthalpy');
  }
}
const airHits = []; p.air.raycast(null, airHits); assert.equal(airHits.length, 0, 'temperature tint never intercepts picking');
const eventEvidence = [];
const combinations = [];
for (let setting = 2; setting <= 8; setting++) for (let room = 16; room <= 32; room += 2) for (const coils of [0, 1]) for (const seal of [0, 1]) for (const start of [0, 1]) {
  const values = {setting, room, coils, seal, start}, plan = fridgePlan(values), last = plan.samples.at(-1);
  assert.ok(plan.samples.every((sample, i) => i === 0 || sample.t > plan.samples[i - 1].t));
  t.near(plan.duty, runningTime(plan, FRIDGE.duration) / FRIDGE.duration, 1e-12, 'reported duty is observed running time');
  if (plan.reaches) assert.ok(plan.duty < 1, 'a resting interval reduces observed duty');
  assert.ok(plan.samples.every(sample => Number.isFinite(sample.T) && sample.T > setting - 1.02 && sample.T <= Math.max(room, setting + 1) + 1e-9));
  t.near(last.released + last.motorHeat, last.removed + last.energy, 1e-6, 'total room heat includes motor loss');
  t.near(FRIDGE.cabinet * (last.T - plan.samples[0].T), last.leaked - last.removed, 1e-6, 'stored cabinet energy');
  for (const change of plan.switches) {
    const at = sampleFridge(values, change.t / FRIDGE.speedUp * FRIDGE.speedUp), before = sampleFridge(values, change.t - 1e-4);
    assert.equal(at.on, change.on); assert.equal(before.on, !change.on);
    if (!change.on) {
      const rest = sampleFridge(values, change.t + 0.1);
      t.near(rest.energy, at.energy, 1e-9, 'no electrical energy during rest');
      t.near(rest.removed, at.removed, 1e-9, 'no cooling during rest');
      t.near(runningTime(plan, change.t + 0.1), runningTime(plan, change.t), 1e-9, 'shaft stops without resetting');
    }
  }
  const c = plan.typical;
  assert.ok(c.Pe > 0 && c.Pc > c.Pe && c.Tc > room && c.Te < setting);
  assert.ok(c.flash > 0 && c.flash < 1 && c.volumetric > 0 && c.volumetric <= 1);
  assert.ok(c.electricCop > 0 && c.electricCop < c.cop && c.cop < c.carnot);
  t.near(c.roomHeat, c.capacity + c.electric, 1e-10, 'running energy balance');
  combinations.push({values, cycles: plan.switches.length, daily: plan.daily / 3.6e6, duty: plan.duty, reaches: plan.reaches});
}
for (const change of fridgePlan().switches.slice(0, 2)) eventEvidence.push({time: change.t, on: sampleFridge({}, change.t).on});
assert.equal(combinations.length, 504);

m.reset(); m.advance(1); const clockBefore = m.getState().clock; m.update({room: 22});
t.near(m.getState().clock, clockBefore, 0, 'same control preserves clock');
m.update({room: 32}); t.near(m.getState().clock, 0, 0, 'changed control resets clock');
for (const action of m.actions) { action.run(); checkFinite(m.root, t); }
assert.equal(LOOP.points[0].join(','), LOOP.points.at(-1).join(','), 'sealed circuit closes through compressor');
for (let i = 0; i < LOOP.sections.length; i++) {
  const section = LOOP.sections[i];
  if (i) assert.equal(section.from, LOOP.sections[i - 1].to, 'tube sections meet exactly');
  assert.equal(p.tubes[i].parent, p.pipeParents[section.part], 'coil tube belongs to its physical assembly');
}
for (let angle = 0; angle < TAU; angle += TAU / 96) {
  m.reset(); m.advance(angle / TAU);
  const state = m.getState(), wrist = p.pistonHead.position.x / MM;
  const gap = p.head - (wrist + 6);
  t.near(gap, FRIDGE.clearance * FRIDGE.stroke * 1000 + piston(state.theta).drop * 1000, 1e-9, 'real piston-face clearance');
  assert.ok(gap >= FRIDGE.clearance * FRIDGE.stroke * 1000 - 1e-9);
  t.near((gap / 1000) * Math.PI * (FRIDGE.bore / 2) ** 2, state.cylinderVolume, 1e-15, 'drawn gas volume matches indicator');
}
for (const [key, value] of Object.entries({coils: 1, seal: 1})) { m.update({[key]: value}); assert.equal(m.getState().clock, 0); }
assert.equal(p.dust.visible, true); assert.equal(p.sealPatch.visible, false);
for (const chart of [p.charts, p.cycleChart, p.indicatorChart]) { assert.equal(chart.userData.explosionExcluded, true); assert.ok(chart.userData.inspectionOnly); }
assert.ok(p.labels.length > 20); assert.ok(p.labels.every(label => label.userData.labelText !== undefined));
checkRefusals(sampleFridge, FRIDGE_DOMAINS, t);
const resources = checkDisposal(m, t);
const report = {passed: true, checks: t.count, controlCombinations: combinations.length, parentTrials: refrigeratorLesson.tryIt.length, resources, eventEvidence, combinations};
if (process.env.REFRIGERATOR_EVIDENCE) fs.writeFileSync(process.env.REFRIGERATOR_EVIDENCE, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS refrigerator model: ${t.count} checks, ${combinations.length} control combinations, ${refrigeratorLesson.tryIt.length} parent trials, ${resources} resources`);

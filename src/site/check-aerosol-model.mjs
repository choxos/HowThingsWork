// Aerosol spray can: NIST's Antoine fits typed in again and held to their
// ranges, the boiling point found by Newton's method, orifice flows from
// isentropic nozzle theory, the whole spray integrated again with a finer step,
// Newton's method for the vapor and the secant method for the temperature,
// mass kept to the microgram, the drawn can's volume sliced and its liquid's
// mesh volume measured, and every number the lesson quotes held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleAerosol, aerosolPlan, antoine, blendPressure, vaporMolar, liquidFlow, gasFlow, BOILING_POINT, ANTOINE, AEROSOL, LIQUEFIED, NITROGEN, AEROSOL_DOMAINS} from './aerosol-physics.js';
import {createAerosolCanModel, levelFor, liquidOutline, bottomAt, radiusAt, scatter, BRIMFUL, CAN, PRESSURE_CHART, TEMPERATURE_CHART} from './aerosol-model.js';
import {aerosolLesson} from './aerosol-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), K = 273.15, Pa = 101325, R = 8.314462618, hole = Math.PI * 4.5e-4 ** 2 / 4, Cd = 0.7;

// 1. Vapor pressures, typed in again from the NIST WebBook, inside their fitted ranges.
const propane = T => 1e5 * 10 ** (4.53678 - 1149.36 / (T + 24.906)), isobutane = T => 1e5 * 10 ** (4.3281 - 1132.108 / (T + 0.918));
const propaneCold = T => 1e5 * 10 ** (3.98292 - 819.296 / (T - 24.417)), isobutaneCold = T => 1e5 * 10 ** (3.94417 - 912.141 / (T - 29.808));
const blend = T => 0.4 * propane(T) + 0.6 * isobutane(T), Mb = 0.4 * 0.0441 + 0.6 * 0.05812;
const Mv = T => (0.4 * propane(T) * 0.0441 + 0.6 * isobutane(T) * 0.05812) / blend(T);
for (let celsius = -10; celsius <= 50; celsius += 5) {
  const T = celsius + K;
  t.near(antoine(ANTOINE.propane, T), propane(T), 1e-9 * propane(T), 'propane vapor pressure');
  t.near(antoine(ANTOINE.isobutane, T), isobutane(T), 1e-9 * isobutane(T), 'isobutane vapor pressure');
  t.near(blendPressure(T), blend(T), 1e-9 * blend(T), 'Raoult’s law for the blend');
  t.near(vaporMolar(T), Mv(T), 1e-12, 'vapor richer in propane');
  t.ok(vaporMolar(T) < Mb, 'vapor lighter than the liquid blend');
}
t.ok(0 + K >= 277.6 - 4.5 && 50 + K <= 360.8, 'propane warm fit used at most 4.5 K below its range');
t.ok(0 + K >= 261.31 && 50 + K <= 408.12, 'isobutane warm fit inside its range');
let boil = 250;
for (let i = 0; i < 40; i++) { const f = T => 0.4 * propaneCold(T) + 0.6 * isobutaneCold(T) - Pa, h = 1e-6; boil -= f(boil) / ((f(boil + h) - f(boil - h)) / (2 * h)); }
t.near(BOILING_POINT, boil, 1e-6, 'boiling point by Newton’s method');
t.ok(boil >= 230.6 && boil <= 261.54, 'boiling point inside both cold fits');

// 2. Flows through the hole: Bernoulli for liquid, isentropic nozzle theory for gas.
const nozzleGas = (P, T, M, g) => {
  if (P <= Pa) return 0;
  const Rs = R / M, ratio = Pa / P, critical = (2 / (g + 1)) ** (g / (g - 1));
  if (ratio <= critical) { const Tt = T * 2 / (g + 1), pt = P * critical; return Cd * hole * pt / (Rs * Tt) * Math.sqrt(g * Rs * Tt); }
  const Te = T * ratio ** ((g - 1) / g);
  return Cd * hole * Pa / (Rs * Te) * Math.sqrt(2 * g / (g - 1) * Rs * T * (1 - ratio ** ((g - 1) / g)));
};
for (const P of [1.05e5, 1.5e5, 1.8e5, 2.5e5, 4.4e5, 1.1e6]) for (const [M, g] of [[Mv(293.15), 1.12], [0.028, 1.4]]) {
  t.near(gasFlow(P, 290, M, g), nozzleGas(P, 290, M, g), 1e-9 * nozzleGas(P, 290, M, g) + 1e-15, `gas flow at ${P} Pa`);
}
for (const g of [1.12, 1.4]) {
  const Pc = Pa / (2 / (g + 1)) ** (g / (g - 1));
  t.near(gasFlow(Pc * (1 - 1e-9), 290, 0.03, g), gasFlow(Pc * (1 + 1e-9), 290, 0.03, g), 1e-6 * gasFlow(Pc, 290, 0.03, g), 'choked and unchoked flow meet');
}
t.near(liquidFlow(3e5, 700), Cd * hole * Math.sqrt(2 * 3e5 / 700), 1e-15, 'liquid through the hole');
assert.equal(liquidFlow(-1, 700), 0);

// 3. The whole spray again: total propellant tracked, the vapor found by Newton's
// method, the temperature by the secant method, a step of 0.01 s.
function reference(given) {
  const values = {propellant: 0, temperature: 20, orientation: 0, ...given};
  const room = values.temperature + K, upright = values.orientation === 0, hA = 10 * 0.0475, dt = 0.01, record = [];
  let T = room, emptied = null;
  if (values.propellant === 0) {
    let mo = 0.12, mp = 0.13, sprayedProduct = 0, sprayedPropellant = 0, gas = 0;
    const volume = lp => mo / 900 + lp / 536, share = lp => { const n = lp / Mb; return n > 0 ? n / (n + mo / 0.3) : 0; };
    const vaporAt = (Tt, guess) => {
      const f = w => w - share(mp - w) * blend(Tt) * (5e-4 - volume(mp - w)) * Mv(Tt) / (R * Tt);
      let w = guess;
      for (let i = 0; i < 40; i++) { const h = 1e-10, step = f(w) / ((f(w + h) - f(w - h)) / (2 * h)); w = Math.min(mp, Math.max(0, w - step)); if (Math.abs(step) < 1e-16) break; }
      return w;
    };
    let v = vaporAt(T, 1e-3);
    record.startShare = share(mp - v);
    for (let n = 0; n <= 18000; n++) {
      const lp = mp - v, P = share(lp) * blend(T), VL = volume(lp), density = (mo + lp) / VL, liquid = upright && VL > 6e-6 + 1e-12;
      if (n % 50 === 0) record.push({t: n * dt, P, T, V: VL, sprayedProduct, sprayedPropellant, gas, mass: mo + mp + sprayedProduct + sprayedPropellant + gas});
      if (n === 18000) break;
      if (upright && emptied === null && !liquid) emptied = n * dt;
      const capacity = 0.055 * 470 + mo * 1900 + lp * 2400;
      let before = v;
      if (liquid) {
        const q = Math.min(P > Pa ? Cd * hole * Math.sqrt(2 * (P - Pa) / density) : 0, (VL - 6e-6) / dt), dm = q * dt * density, fraction = mo / (mo + lp);
        mo -= dm * fraction; mp -= dm * (1 - fraction); sprayedProduct += dm * fraction; sprayedPropellant += dm * (1 - fraction);
      } else {
        const dm = Math.min(nozzleGas(P, T, Mv(T), 1.12) * dt, v);
        mp -= dm; before -= dm; gas += dm;
      }
      const heat = hA * (room - T) * dt, miss = Tn => capacity * (Tn - T) - heat + 335e3 * (vaporAt(Tn, before) - before);
      let t0 = T, t1 = T - 1e-3, f0 = miss(t0), f1 = miss(t1);
      for (let i = 0; i < 20 && Math.abs(f1) > 1e-10 && f1 !== f0; i++) { const t2 = t1 - f1 * (t1 - t0) / (f1 - f0); t0 = t1; f0 = f1; t1 = t2; f1 = miss(t1); }
      T = t1; v = vaporAt(T, before);
    }
  } else {
    let product = 0.27, moles = 1e6 * 2e-4 / (R * 293.15), sprayed = 0, gas = 0;
    const rates = (prod, nn, TT) => {
      const VL = prod / 900, P = nn * R * TT / (5e-4 - VL), liquid = upright && VL > 6e-6 + 1e-12, capacity = 0.055 * 470 + prod * 1900;
      if (liquid) { const q = P > Pa ? Cd * hole * Math.sqrt(2 * (P - Pa) / 900) : 0; return {dp: -q * 900, dn: 0, dT: (hA * (room - TT) - P * q) / capacity, P, liquid}; }
      const flow = nozzleGas(P, TT, 0.028, 1.4);
      return {dp: 0, dn: -flow / 0.028, dT: (hA * (room - TT) - flow * R / 0.028 * TT) / capacity, P, liquid};
    };
    for (let n = 0; n <= 18000; n++) {
      const now = rates(product, moles, T);
      if (n % 50 === 0) record.push({t: n * dt, P: now.P, T, V: product / 900, sprayedProduct: sprayed, gas, mass: product + moles * 0.028 + sprayed + gas});
      if (n === 18000) break;
      if (upright && emptied === null && !now.liquid) emptied = n * dt;
      const mid = rates(Math.max(5.4e-3, product + now.dp * dt / 2), moles + now.dn * dt / 2, T + now.dT * dt / 2);
      const dp = now.liquid ? Math.max(5.4e-3, product + mid.dp * dt) - product : 0;
      product += dp; sprayed -= dp; moles += mid.dn * dt; gas -= mid.dn * dt * 0.028; T += mid.dT * dt;
    }
  }
  record.emptied = emptied;
  return record;
}
const phases = {
  '{}': {liquid: [10, 30, 60, 90, 100], gas: [120, 150]},
  '{"temperature":50}': {liquid: [10, 30, 60], gas: [90, 120]},
  '{"orientation":1}': {liquid: [], gas: [30, 60, 120, 180]},
  '{"propellant":1}': {liquid: [10, 30, 60, 75], gas: [90, 100]},
  '{"propellant":1,"orientation":1}': {liquid: [], gas: [2, 5, 10]},
  '{"temperature":0}': {liquid: [30, 90, 150], gas: []},
};
for (const [key, times] of Object.entries(phases)) {
  const values = JSON.parse(key), ref = reference(values), plan = aerosolPlan(values), where = `aerosol ${key}`;
  if (ref.startShare !== undefined) t.near(plan.startShare, ref.startShare, 1e-9, `${where}: propellant’s share of the liquid as filled`);
  if (ref.emptied !== null) t.near(plan.emptied, ref.emptied, 0.3, `${where}: liquid runs out`);
  else assert.equal(plan.emptied, null, `${where}: never draws liquid`);
  for (const [phase, list] of Object.entries(times)) for (const time of list) {
    const s = sampleAerosol(values, time), r = ref.find(row => Math.abs(row.t - time) < 1e-9), loose = phase === 'gas';
    t.near(s.P, r.P, (loose ? 0.03 : 0.003) * r.P + (loose ? 2000 : 200), `${where} at ${time} s: pressure`);
    t.near(s.T, r.T, loose ? 0.4 : 0.06, `${where} at ${time} s: temperature`);
    t.near(s.sprayedProduct, r.sprayedProduct, 0.003 * r.sprayedProduct + 1e-4, `${where} at ${time} s: product sprayed`);
    t.near(s.sprayedGas, r.gas, (loose ? 0.03 : 0.003) * r.gas + 1e-4, `${where} at ${time} s: gas lost`);
  }
}

// 4. Every sample: mass kept, the vapor in equilibrium, nitrogen obeying the gas law.
for (const propellant of [0, 1]) for (const temperature of [0, 20, 50]) for (const orientation of [0, 1]) {
  const values = {propellant, temperature, orientation}, plan = aerosolPlan(values), where = `aerosol ${JSON.stringify(values)}`;
  for (const s of plan.samples) {
    const left = s.product + s.propellant + s.vapor + s.nitrogen * NITROGEN.molar, sprayed = s.sprayedProduct + s.sprayedPropellant + s.sprayedGas;
    t.near(left + sprayed, plan.startMass, 1e-9, `${where} at ${s.t} s: mass kept`);
    const gasSpace = AEROSOL.brimful - s.V;
    if (propellant === 0) {
      const n = s.propellant / Mb, x = n > 0 ? n / (n + s.product / 0.3) : 0;
      t.near(s.V, s.product / 900 + s.propellant / 536, 1e-15, `${where}: liquid volume`);
      t.near(s.P, x * blend(s.T), 1e-9 * s.P + 1e-9, `${where} at ${s.t} s: Raoult’s law`);
      t.near(s.vapor, s.P * gasSpace * Mv(s.T) / (R * s.T), 1e-9 + 1e-6 * s.vapor, `${where} at ${s.t} s: vapor in equilibrium`);
    } else {
      t.near(s.P * gasSpace, s.nitrogen * R * s.T, 1e-9 * s.P * gasSpace, `${where} at ${s.t} s: P V = n R T`);
    }
    t.ok(s.V >= AEROSOL.residual - 1e-9 || !plan.upright || propellant === 0, `${where}: liquid never below the dip tube’s reach while drawing liquid`);
  }
  t.near(plan.flash, propellant === 0 ? 2400 * (temperature + K - boil) / 335e3 : 0, 1e-6, `${where}: share flashing in the jet`);
  t.near(plan.hotPressure, propellant === 0 ? plan.startShare * blend(50 + K) : plan.samples[0].nitrogen * R * (50 + K) / (AEROSOL.brimful - plan.samples[0].V), 1e-6 * plan.hotPressure, `${where}: pressure if heated to 50 °C`);
}

// 5. The drawing.
const slice = (low, high, n = 200000) => {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const y = low + (i + 0.5) * (high - low) / n;
    const outer = y <= 145.2 ? 32.5 : y <= 165 ? 32.5 - 19 * (y - 145.2) / 19.8 : 0, inner = y < 12 ? 30 * Math.sqrt(1 - y / 12) : 0;
    sum += Math.PI * (outer * outer - inner * inner) * (high - low) / n;
  }
  return sum;
};
t.near(slice(0, 165) / 1000, 500, 0.5, 'drawn can holds 500 mL brimful');
t.near(BRIMFUL, slice(0, 165), 1e-3 * BRIMFUL, 'can volume by slicing');
for (const volume of [6e-6, 4e-6, 50e-6, 200e-6, 373.8e-6, 480e-6]) {
  const up = levelFor(volume, true), down = levelFor(volume, false);
  t.near(slice(0, up), volume * 1e9, 5e-4 * volume * 1e9 + 2, `upright level for ${volume * 1e6} mL`);
  t.near(slice(down, 165), volume * 1e9, 5e-4 * volume * 1e9 + 2, `upside-down level for ${volume * 1e6} mL`);
}
const meshVolume = geometry => {
  const position = geometry.attributes.position, index = geometry.index, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let sum = 0;
  for (let i = 0; i < index.count; i += 3) { a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2)); sum += a.dot(b.clone().cross(c)); }
  return Math.abs(sum) / 6;
};
const polygon = (2 * Math.PI / 48) ** -1 * Math.sin(2 * Math.PI / 48);
const m = createAerosolCanModel(), p = m.topology, MM = p.MM;
const tube = p.dipTube.geometry.parameters.path;
t.near(tube.getPoint(1).y / MM, slice.length ? levelFor(AEROSOL.residual, true) : 0, 1e-6, 'dip tube ends where the last 6 mL stands');
t.near(slice(0, tube.getPoint(1).y / MM), AEROSOL.residual * 1e9, 5, 'liquid below the dip tube’s end is 6 mL');
for (const point of tube.getPoints(4000)) t.ok(point.y / MM - 1.5 >= bottomAt(Math.hypot(point.x, point.z) / MM) - 1e-9, 'dip tube clears the domed bottom');
t.ok(tube.getPoint(0).y / MM > 145 && tube.getPoint(0).y / MM < 165, 'dip tube starts in the valve housing');
t.ok(Math.abs(2 * CAN.neck - 25.4) < 2, 'a 1 inch opening');

for (const values of [{}, {orientation: 1}, {propellant: 1}, {propellant: 1, orientation: 1}, {temperature: 50}, {temperature: 0, orientation: 1}]) for (const clock of [0, 3.3, 30, 60.2, 104.8, 121, 179.9, 180]) {
  m.reset(); m.update(values); m.advance(clock / p.SPEED_UP);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), where = `${JSON.stringify(values)} at ${clock} s`, pressed = clock > 0 && clock < 180, upright = s.values.orientation === 0;
  t.near(s.clock, clock, 1e-9, `${where}: six times real time`);
  assert.equal(s.pressed, pressed);
  // The can, turned end over end toward the viewer when upside down.
  t.near(p.holder.rotation.z, upright ? 0 : Math.PI, 1e-12, `${where}: can turned`);
  const insert = p.insert.getWorldPosition(new THREE.Vector3()).sub(m.root.getWorldPosition(new THREE.Vector3())).applyQuaternion(m.root.getWorldQuaternion(new THREE.Quaternion()).invert());
  t.near(insert.x / MM, upright ? 13.5 : -13.5, 1e-6, `${where}: nozzle on the right side`);
  t.near(insert.y / MM, upright ? 184 - (pressed ? 1.5 : 0) : 190 - 184 + (pressed ? 1.5 : 0), 1e-6, `${where}: nozzle height, button pressed ${pressed}`);
  t.near(p.stem.position.y / MM, 168 - (pressed ? 1.5 : 0), 1e-9, `${where}: stem pushed down`);
  // The liquid: its level fills its volume, and its mesh holds that volume.
  t.near(upright ? slice(0, s.level) : slice(s.level, 165), s.V * 1e9, 5e-4 * s.V * 1e9 + 2, `${where}: liquid level holds its volume`);
  t.near(meshVolume(p.liquid.geometry) / MM ** 3, s.V * 1e9 * polygon, 0.004 * s.V * 1e9 + 30, `${where}: liquid mesh volume`);
  const boiling = s.liquefied ? Math.max(0, Math.min(1, s.boilRate / 1.5e-4)) : 0, room = upright ? s.level > 14 : s.level < 162;
  assert.equal(p.bubbles.filter(bubble => bubble.visible).length, pressed && room ? Math.round(24 * boiling) : 0, `${where}: bubbles as fast as propellant boils`);
  p.bubbles.forEach((bubble, i) => {
    const {out, angle} = scatter(i), low = upright ? 14 : 162, y = low + (s.level - low) * (((clock / 6) * 0.8 + i / 24) % 1), radius = radiusAt(y) * out;
    t.near(bubble.position.y / MM, y, 1e-6, `${where}: bubble rising`);
    t.near(Math.hypot(bubble.position.x, bubble.position.z) / MM, radius, 1e-6, `${where}: bubble inside the can`);
  });
  const gasLow = upright ? s.level : 13, gasHigh = upright ? 164 : s.level;
  assert.equal(p.markers.filter(marker => marker.visible).length, gasHigh > gasLow + 2 ? Math.round(24 * Math.max(0, Math.min(1, s.P / 1.1e6))) : 0, `${where}: dots for the gas’s pressure`);
  assert.equal(p.markerMaterial.color.getHex(), s.liquefied ? 0xe3b45e : 0x2f6690);
  // The spray.
  const side = upright ? 1 : -1, nozzle = [side * 15, upright ? 184 - (pressed ? 1.5 : 0) : 6 + (pressed ? 1.5 : 0)], length = Math.min(260, 6 * s.jet), spread = s.liquefied ? 0.27 : 0.12;
  assert.equal(p.drops.filter(drop => drop.visible).length, pressed && s.volumeRate > 0 ? Math.round(40 * Math.max(0, Math.min(1, s.massRate / 4.5e-3))) : 0, `${where}: drops as fast as liquid leaves`);
  assert.equal(p.puffs.filter(puff => puff.visible).length, pressed && s.gasRate > 0 ? Math.round(40 * Math.max(0, Math.min(1, s.gasRate / 3e-4))) : 0, `${where}: puffs as fast as gas leaves`);
  for (const i of [0, 13, 39]) {
    const u = ((clock / 6) * 2 + i / 40) % 1;
    t.near(p.drops[i].position.x / MM, nozzle[0] + side * u * length, 1e-6, `${where}: drop along the plume`);
    t.near(p.drops[i].position.y / MM, nozzle[1] + Math.sin(i * 2.4) * spread * u * length, 1e-6, `${where}: drop in the cone`);
    t.near(p.drops[i].scale.x, s.liquefied ? 2 * (1 - 0.6 * u) : 2.5, 1e-12, `${where}: drop shrinking as its propellant boils`);
    t.near(p.puffs[i].position.x / MM, nozzle[0] + side * u * 90, 1e-6, `${where}: puff along the plume`);
  }
  const cold = Math.max(0, Math.min(1, (s.room - s.T) / 15)), shell = new THREE.Color(0xb4c5b0).lerp(new THREE.Color(0x9fd3e6), cold);
  t.ok(Math.abs(p.shell.material.color.r - shell.r) < 1e-9 && Math.abs(p.shell.material.color.b - shell.b) < 1e-9, `${where}: shell blue as it cools`);
  // Charts.
  const pressureY = gauge => (PRESSURE_CHART.bottom + Math.max(0, Math.min(1, gauge / 1.2e6)) * 140) * MM;
  const line = p.pressureLine.geometry.attributes.position;
  for (const i of [0, 523, 1047, 1800]) {
    t.near(line.getX(i), (PRESSURE_CHART.left + s.samples[i].t / 180 * 220) * MM, 1e-6, `${where}: pressure chart across`);
    t.near(line.getY(i), pressureY(s.samples[i].P - Pa), 1e-6, `${where}: pressure chart up`);
  }
  t.near(p.cursor.geometry.attributes.position.getX(0), (PRESSURE_CHART.left + clock / 180 * 220) * MM, 1e-6, `${where}: line for now`);
  t.near(p.dot.position.x, (TEMPERATURE_CHART.left + (s.T - K + 10) / 60 * 220) * MM, 1e-9, `${where}: can on the temperature chart`);
  t.near(p.dot.position.y, (TEMPERATURE_CHART.bottom + Math.max(0, Math.min(1, s.gauge / 1.2e6)) * 140) * MM, 1e-9, `${where}: can on the temperature chart`);
  if (clock === 30) checkFinite(m.root, t);
}
const filled = reference({propellant: 0, temperature: 20, orientation: 0}).startShare;
for (const i of [0, 17, 30, 60]) {
  const celsius = -10 + i, y = pa => (TEMPERATURE_CHART.bottom + Math.max(0, Math.min(1, pa / 1.2e6)) * 140) * MM;
  t.near(p.liquefiedLine.geometry.attributes.position.getY(i), y(filled * blend(celsius + K) - Pa), 1e-6, 'liquefied propellant’s pressure against temperature');
  t.near(p.nitrogenLine.geometry.attributes.position.getY(i), y(1e6 * (celsius + K) / 293.15 - Pa), 1e-6, 'nitrogen’s pressure against temperature');
}
t.near(meshVolume(new THREE.LatheGeometry(liquidOutline(levelFor(2e-4, true), true).map(([x, y]) => new THREE.Vector2(x, y)), 48)), 2e5 * polygon, 800, 'outline revolves to its volume');

// 6. The lesson, the texts, controls, refusals and disposal.
const run = values => { m.reset(); m.update(values); return m.getState(); };
const at = (values, time) => sampleAerosol(values, time);
const halfEmpty = st => st.samples.find(sample => sample.V <= st.startLiquid / 2).t;
const spent = st => st.samples.find(sample => sample.t > 1 && sample.P - Pa < 1000).t;
checkTrialNumbers(aerosolLesson, {
  'Spray the can': st => ({'3.42': st.gauge / 1e5, '0.45': AEROSOL.orifice * 1000, '32.0': st.jet, '2.38': st.massRate * 1000, '35': st.flash * 100}),
  'Pressure that holds': st => ({'52': halfEmpty(st), '3.26': at(st.values, halfEmpty(st)).gauge / 1e5, '16.2': at(st.values, st.emptied).T - K, '105': st.emptied}),
  'A nitrogen can': st => (t.ok(at(st.values, 60).massRate < 0.7 * st.massRate, 'the spray weakens'), {'8.99': st.gauge / 1e5, '4.69': at(st.values, halfEmpty(st)).gauge / 1e5, '3.02': at(st.values, st.emptied).gauge / 1e5, '81': st.emptied}),
  'A cold can': st => ({'1.45': st.gauge / 1e5, '20.9': st.jet, '21': st.flash * 100, '161': st.emptied}),
  'A hot can': st => ({'8.40': st.gauge / 1e5, '2.46': st.gauge / at({}, 0).gauge, '20': 20, '8.99': at({propellant: 1}, 0).gauge / 1e5, '10.01': at({propellant: 1, temperature: 50}, 0).gauge / 1e5}),
  'Upside down': st => (assert.equal(at(st.values, 60).sprayedProduct, 0), {'0.140': st.gasRate * 1000, '15.4': at(st.values, 60).T - K, '7.86': at(st.values, 60).sprayedGas * 1000}),
  'Nitrogen upside down': st => ({'22': spent(st), '2.06': at(st.values, 180).sprayedGas * 1000, '270.0': at(st.values, 180).product * 1000}),
  'The last of it': st => {
    const coldest = st.samples.reduce((low, sample) => (sample.T < low.T ? sample : low));
    t.ok(coldest.t > st.emptied, 'coldest after the liquid runs out');
    return {'6.1': coldest.T - K, '178': spent(st)};
  },
}, run, t);
checkQuotedText(aerosolLesson.deeper.map(section => section.body).join(' '), {
  '29 degrees below freezing': `${fixed(K - BOILING_POINT, 0)} degrees below freezing`,
  '49 degrees too hot': `${fixed(20 + K - BOILING_POINT, 0)} degrees too hot`,
  '8.42 bar': `${fixed((aerosolPlan({}).hotPressure - Pa) / 1e5, 2)} bar`,
}, t);
t.ok(Math.abs((aerosolPlan({}).hotPressure - Pa) / (aerosolPlan({}).startPressure - Pa) - 2.5) < 0.1, 'about two and a half times');
checkQuotedText(aerosolLesson.limits, {
  '500 mL': `${fixed(AEROSOL.brimful * 1e6, 0)} mL`, '120 g': `${fixed(LIQUEFIED.product * 1000, 0)} g`, '300 g/mol': `${fixed(LIQUEFIED.productMolar * 1000, 0)} g/mol`,
  '130 g': `${fixed(LIQUEFIED.propellant * 1000, 0)} g`, '40% propane': `${fixed(LIQUEFIED.propane * 100, 0)}% propane`, '335 kJ/kg': `${fixed(LIQUEFIED.latent / 1000, 0)} kJ/kg`,
  '300 mL of product under 200 mL': `${fixed(NITROGEN.product / NITROGEN.productDensity * 1e6, 0)} mL of product under ${fixed(NITROGEN.space * 1e6, 0)} mL`,
  '10 bar absolute': `${fixed(NITROGEN.fillPressure / 1e5, 0)} bar absolute`, '0.45 mm': `${fixed(AEROSOL.orifice * 1000, 2)} mm`, '0.7': `${AEROSOL.discharge}`,
  '6 mL': `${fixed(AEROSOL.residual * 1e6, 0)} mL`, '10 W/(m²K) over 0.0475 m²': `${AEROSOL.film} W/(m²K) over ${AEROSOL.area} m²`,
}, t);
const partText = id => m.parts.find(part => part.id === id).description;
checkQuotedText(partText('can'), {'65 mm': `${fixed(CAN.radius * 2, 0)} mm`, '500 mL': `${fixed(BRIMFUL / 1000, 0)} mL`}, t);
checkQuotedText(partText('dip-tube'), {'6 mL': `${fixed(AEROSOL.residual * 1e6, 0)} mL`}, t);
checkQuotedText(partText('actuator'), {'0.45 mm': `${fixed(AEROSOL.orifice * 1000, 2)} mm`}, t);
checkControlsMove(m, () => [p.pressureLine.geometry.attributes.position.getY(300), p.holder.rotation.z, p.markerMaterial.color.getHex(), p.drops.filter(drop => drop.visible).length, p.dot.position.toArray()], model => model.advance(12 / p.SPEED_UP), t);
checkRefusals(sampleAerosol, AEROSOL_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS aerosol spray can: ${t.count} checks, ${aerosolLesson.tryIt.length} trials, ${resources} resources`);

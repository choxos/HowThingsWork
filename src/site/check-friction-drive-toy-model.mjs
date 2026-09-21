// Friction-drive toy: every run simulated again in 10 µs steps from the rules
// of grip and skid, with its own energy bookkeeping; the launch, the skid's heat
// and the roll-out held to closed forms; the energy ledger closed at every
// moment; the gear train's tooth counts, spacing, meshing and clearances held to
// the ratio; the drawing held to the state; and every number the lesson quotes
// held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {toyPlan, toyAt, sampleToy, feltMass, flywheelInertia, rpmOf, TOY, FLOORS, RATIOS, GEARS, TOY_DOMAINS} from './friction-drive-toy-physics.js';
import {createFrictionDriveToyModel, shafts, trainAngles, drawnTurns, pitchRadius, AXLE, LAYOUT, CHART, FLOOR, FLOOR_COLORS, SHARE_COLORS} from './friction-drive-toy-model.js';
import {frictionDriveToyLesson} from './friction-drive-toy-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

// The toy written again.
const t = tally(), TAU = Math.PI * 2, g = 9.81, m = 0.12, r = 0.015, eta = 0.8, stroke = 0.15, back = 0.3;
const I = 0.5 * 7850 * Math.PI * 0.01 ** 4 * 0.004, bearingTorque = 4e-5;
const GRIP = [{grip: 0.5, skid: 0.4, rolling: 0.02}, {grip: 0.8, skid: 0.7, rolling: 0.03}, {grip: 1.0, skid: 0.9, rolling: 0.12}];
const DEFAULTS = {speed: 1.5, pushes: 3, press: 4, gearing: 1, floor: 1, release: 0};

// 1. The flywheel and what it feels like at the wheels.
t.near(flywheelInertia(), I, 1e-18, 'flywheel inertia, a steel disk 20 mm across and 4 mm thick');
for (const [index, ratio] of [6, 12, 24].entries()) {
  t.near(RATIOS[index], ratio, 0, 'ratios 6, 12 and 24');
  t.near(feltMass(ratio), I * ratio * ratio / (r * r), 1e-12, `${ratio} to 1: felt mass`);
  const [[T1, t1], [T2, t2]] = GEARS[ratio];
  t.near(T1 / t1 * T2 / t2, ratio, 1e-12, `${ratio} to 1: tooth counts multiply to the ratio`);
  t.ok(T1 / t1 >= T2 / t2, `${ratio} to 1: the bigger stage first, so the middle shaft's gear clears the axle`);
}
t.near(rpmOf(1.5, 12), 1.5 / r * 12 * 60 / TAU, 1e-9, 'rpm from rim speed');

// 2. Every run simulated again in 10 µs steps.
const simulate = values => {
  const full = {...DEFAULTS, ...values}, N = RATIOS[full.gearing], floor = GRIP[full.floor], V = full.speed, felt = I * N * N / (r * r), b = bearingTorque * N / r, rolling = floor.rolling * m * g;
  const A = V * V / (2 * stroke), T = 2 * stroke / V, dt = 1e-5, events = [], log = [];
  const e = {hand: 0, skid: 0, gears: 0, bearing: 0, rolling: 0};
  let time = 0, x = 0, u = 0, turned = 0, v = 0, onFloor = true;
  const note = () => log.push({time, x, v: onFloor ? v : 0, u, turned, onFloor, e: {...e}});
  for (let k = 0; k < full.pushes; k++) {
    const load = (m * g + full.press) / 2, need = (felt * A + b) / eta, grips = need <= floor.grip * load, steps = Math.round(T / dt);
    x = 0; onFloor = true;
    for (let n = 0; n < steps; n++) {
      const h = A * n * dt, h1 = A * (n + 1) * dt;
      let force, hand, drive, next;
      if (u > h + 1e-12) {
        force = floor.skid * load; drive = 'flywheel'; hand = m * A + rolling - force;
        next = u - (force / eta + b) / felt * dt;
        if (next < h1) next = grips ? h1 : Math.max(next, h1 - (A - (eta * floor.skid * load - b) / felt) * dt);
      } else if (grips) { force = need; drive = 'floor'; hand = m * A + rolling + need; next = h1; }
      else { force = floor.skid * load; drive = 'floor'; hand = m * A + rolling + force; next = u + (eta * force - b) / felt * dt; }
      const meanU = (u + next) / 2, meanH = (h + h1) / 2, travel = meanH * dt;
      if (!(grips && drive === 'floor')) e.skid += force * Math.abs(meanU - meanH) * dt;
      e.gears += force * (drive === 'floor' ? 1 - eta : 1 / eta - 1) * meanU * dt;
      e.bearing += b * meanU * dt;
      e.rolling += rolling * travel;
      e.hand += hand * travel;
      turned += meanU * dt; x += travel; u = next; v = h1; time += dt;
      if (n % 50 === 24) note();
    }
    events.push({kind: 'push end', time, u});
    const last = k === full.pushes - 1;
    if (last && full.release === 1) break;
    e.hand -= m * V * V / 2;
    if (last) { v = 0; break; }
    onFloor = false;
    const lifted = Math.round(back / dt);
    for (let n = 0; n < lifted; n++) {
      const next = Math.max(0, u - b / felt * dt), meanU = (u + next) / 2;
      e.bearing += b * meanU * dt; turned += meanU * dt; u = next; time += dt;
      if (n % 50 === 24) note();
    }
  }
  // Let go.
  const releaseTime = time, load = m * g / 2;
  x = stroke; onFloor = true;
  let rollingStart = null, stopTime = null, grippedAll = true;
  events.push({kind: 'release', time, u, v});
  while (true) {
    let a, du;
    if (Math.abs(u - v) > 1e-9) {
      const force = floor.skid * load;
      if (u > v) { a = (force - rolling) / m; du = -(force / eta + b) / felt; }
      else { a = -(force + rolling) / m; du = (eta * force - b) / felt; }
      let nv = v + a * dt, nu = u + du * dt;
      if (Math.sign(nu - nv) !== Math.sign(u - v)) {
        const s = (u - v) / ((u - v) - (nu - nv)), common = v + a * dt * s;
        e.skid += force * Math.abs(u - v) / 2 * s * dt;
        e.gears += force * (u > v ? 1 / eta - 1 : 1 - eta) * (u + common) / 2 * s * dt;
        e.bearing += b * (u + common) / 2 * s * dt; e.rolling += rolling * (v + common) / 2 * s * dt;
        x += (v + common) / 2 * s * dt; turned += (u + common) / 2 * s * dt; time += s * dt;
        u = v = common; rollingStart = {time, v};
        continue;
      }
      e.skid += force * Math.abs((u + nu) / 2 - (v + nv) / 2) * dt;
      e.gears += force * (u > v ? 1 / eta - 1 : 1 - eta) * (u + nu) / 2 * dt;
      e.bearing += b * (u + nu) / 2 * dt; e.rolling += rolling * (v + nv) / 2 * dt;
      x += (v + nv) / 2 * dt; turned += (u + nu) / 2 * dt; u = nu; v = nv; time += dt;
    } else {
      if (rollingStart === null) rollingStart = {time, v};
      // Rolling together: the floor's push F and the flywheel's pull f solved with the gears losing 20% whichever way power flows.
      let F, f;
      a = -(rolling + eta * b) / (m + eta * felt); f = -felt * a - b; F = eta * f;
      if (f < 0) { a = -(rolling + b / eta) / (m + felt / eta); f = -felt * a - b; F = f / eta; }
      if (rollingStart.time === time) t.ok(Math.abs(F - (m * a + rolling)) < 1e-12, `${JSON.stringify(values)}: rolling forces balance the toy`);
      if (Math.abs(F) > floor.grip * load) grippedAll = false;
      const nv = Math.max(0, v + a * dt), step = v > 0 ? Math.min(dt, v / -a) : 0;
      if (step <= 0) { stopTime = time; break; }
      const mean = (v + nv) / 2;
      e.gears += Math.abs(F) * (f >= 0 ? 1 / eta - 1 : 1 - eta) * mean * step;
      e.bearing += b * mean * step; e.rolling += rolling * mean * step;
      x += mean * step; turned += mean * step; u = v = nv; time += step;
      if (nv === 0) { stopTime = time; break; }
    }
    if (log.length === 0 || time - log.at(-1).time >= 5e-4) note();
  }
  note();
  return {log, events, releaseTime, rollingStart, stopTime, e, x, felt, b, rolling, grippedAll};
};
const SETTINGS = [{}, {press: 8}, {press: 0}, {pushes: 6}, {gearing: 0}, {gearing: 2, press: 20, pushes: 6}, {floor: 0}, {floor: 2}, {release: 1}, {release: 1, press: 8}, {speed: 2.5, press: 20}, {gearing: 0, floor: 0}, {speed: 0.5, pushes: 1}, {gearing: 2, release: 1, floor: 2}];
for (const values of SETTINGS) {
  const plan = toyPlan(values), mine = simulate(values), where = JSON.stringify(values);
  t.near(plan.releaseAt.t, mine.releaseTime, 1e-6, `${where}: let go at the end of the pushes`);
  t.near(plan.launch.t, mine.rollingStart.time, 2e-4, `${where}: the skid ends when wheels and toy match`);
  t.near(plan.launch.v, mine.rollingStart.v, 2e-3, `${where}: speed as the skid ends`);
  t.near(plan.duration, mine.stopTime, 2e-3, `${where}: stops when the simulation stops`);
  t.near(plan.stop.x, mine.x, 5e-3, `${where}: where it stops`);
  mine.events.filter(item => item.kind === 'push end').forEach((item, k) => t.near(plan.pushSpeeds[k], item.u, 2e-3, `${where}: flywheel speed after push ${k + 1}`));
  for (const entry of mine.log) {
    const now = toyAt(plan, entry.time), here = `${where} at ${entry.time.toFixed(4)} s`;
    t.near(now.u, entry.u, 3e-3, `${here}: flywheel speed`);
    t.near(now.phase.onFloor ? now.v : 0, entry.v, 3e-3, `${here}: toy speed`);
    t.near(now.turned, entry.turned, 5e-3, `${here}: how far the wheel rims have run`);
    if (entry.onFloor) t.near(now.x, entry.x, 5e-3, `${here}: position`);
    for (const key of ['hand', 'skid', 'gears', 'bearing', 'rolling']) t.near(now.energy[key], entry.e[key], 3e-3, `${here}: ${key} energy`);
  }
  for (const key of ['hand', 'skid', 'gears', 'bearing', 'rolling']) t.near(plan.energy[key], mine.e[key], 3e-3, `${where}: final ${key} energy`);
  t.ok(mine.grippedAll, `${where}: wheels grip while rolling`);
}

// 3. The rules and closed forms behind each run, for every combination of settings.
const range = key => { const [lo, hi, step] = TOY_DOMAINS[key]; return Array.from({length: Math.round((hi - lo) / step) + 1}, (_, i) => lo + i * step); };
let runs = 0;
for (const speed of [0.5, 1.5, 2.5]) for (const pushes of [1, 3, 6]) for (const press of range('press')) for (const gearing of range('gearing')) for (const floor of range('floor')) for (const release of range('release')) {
  const values = {speed, pushes, press, gearing, floor, release}, plan = toyPlan(values), where = JSON.stringify(values), N = RATIOS[gearing], ground = GRIP[floor];
  const felt = I * N * N / (r * r), b = bearingTorque * N / r, rolling = ground.rolling * m * g, A = speed * speed / (2 * stroke), load = (m * g + press) / 2;
  const need = (felt * A + b) / eta, supply = ground.grip * load;
  t.near(plan.need, need, 1e-12, `${where}: grip a push needs`);
  t.near(plan.supply, supply, 1e-12, `${where}: grip the floor gives`);
  assert.equal(plan.grips, need <= supply, `${where}: grips exactly when the floor can give what the push needs`);
  if (plan.grips) plan.pushSpeeds.forEach((u, k) => t.near(u, speed, 1e-12, `${where}: gripping, push ${k + 1} brings the flywheel to the push speed`));
  else plan.pushSpeeds.forEach((u, k) => t.ok(u < speed && (k === 0 || u > plan.pushSpeeds[k - 1] - 1e-12), `${where}: skidding, push ${k + 1} falls short but never loses ground`));
  // Launch: constant forces, so the matched speed and the skid's heat follow in closed form.
  const u0 = plan.releaseAt.u, v0 = release === 1 ? speed : 0, F = ground.skid * m * g / 2, skid = plan.phases.find(phase => phase.kind === 'skidding');
  if (v0 === 0) {
    const vL = u0 / (1 + m * (F / eta + b) / (felt * (F - rolling))), tau = m * vL / (F - rolling);
    t.near(plan.launch.v, vL, 1e-12, `${where}: launch speed in closed form`);
    t.near(skid.d, tau, 1e-12, `${where}: launch skid time in closed form`);
    t.near(toyAt(plan, plan.launch.t).energy.skid - toyAt(plan, plan.releaseAt.t).energy.skid, F * u0 * tau / 2, 1e-12, `${where}: launch skid heat in closed form`);
    t.ok(vL < eta * felt * u0 / (m + eta * felt), `${where}: launching loses more than a lossless sticking collision would`);
  } else if (Math.abs(u0 - v0) > 1e-12) {
    const toy = u0 > v0 ? (F - rolling) / m : -(F + rolling) / m, fly = u0 > v0 ? -(F / eta + b) / felt : (eta * F - b) / felt;
    t.near(skid.d, (v0 - u0) / (fly - toy), 1e-12, `${where}: mid-push skid time in closed form`);
  } else assert.equal(skid, undefined, `${where}: no skid when the flywheel already matches`);
  // Rolling on: a steady deceleration, so the distance is v^2 / 2a.
  const flywheelDrives = felt * (rolling + eta * b) / (m + eta * felt) >= b, a = flywheelDrives ? (rolling + eta * b) / (m + eta * felt) : (rolling + b / eta) / (m + felt / eta);
  assert.equal(plan.flywheelDrives, flywheelDrives, `${where}: which way power flows while rolling`);
  t.near(plan.deceleration, a, 1e-12, `${where}: deceleration`);
  t.near(plan.stop.x - plan.launch.x, plan.launch.v ** 2 / (2 * a), 1e-9, `${where}: rolls v^2 / 2a`);
  t.near(plan.duration - plan.launch.t, plan.launch.v / a, 1e-9, `${where}: rolls for v / a`);
  t.near(plan.alone, release === 1 ? speed * speed / (2 * ground.rolling * g) : 0, 1e-12, `${where}: a toy with no flywheel`);
  t.near(plan.whirr, u0 * felt / b, 1e-12, `${where}: lifted, the flywheel whirrs until its bearings stop it`);
  // The ledger closes at every moment.
  for (let i = 0; i <= 60; i++) {
    const now = toyAt(plan, plan.duration * i / 60), ledger = now.energy;
    t.near(ledger.hand, now.motion + now.flywheel + ledger.skid + ledger.gears + ledger.bearing + ledger.rolling, 1e-12, `${where}: energy ledger at ${i}/60`);
    t.ok(ledger.skid >= -1e-15 && ledger.gears >= -1e-15 && ledger.bearing >= -1e-15 && ledger.rolling >= -1e-15, `${where}: losses never negative`);
  }
  runs++;
}
t.ok(runs === 3 * 3 * 11 * 3 * 3 * 2, 'every press, gearing, floor and way of letting go');

// 4. The gear train: counts, spacing, meshing and clearances.
const model = createFrictionDriveToyModel(), p = model.topology, MM = p.MM;
for (const ratio of RATIOS) {
  const set = p.sets[ratio], [[T1, t1], [T2, t2]] = GEARS[ratio], centers = shafts(ratio), where = `${ratio} to 1`;
  const count = item => { const points = item.sharp.geometry.parameters.shapes.getPoints(); return Math.round((points.length - (points.at(-1).equals(points[0]) ? 1 : 0)) / 5); };
  assert.deepEqual([count(set.axleGear), count(set.pinion), count(set.second), count(set.flywheelPinion)], [T1, t1, T2, t2], `${where}: drawn tooth counts`);
  for (const item of [set.axleGear, set.pinion, set.second, set.flywheelPinion]) {
    const positions = item.sharp.geometry.attributes.position;
    let tip = 0;
    for (let i = 0; i < positions.count; i++) tip = Math.max(tip, Math.hypot(positions.getX(i), positions.getY(i)));
    t.near(tip / MM, pitchRadius(item.teeth) + 0.5, 1e-4, `${where}: ${item.teeth} teeth reach one module past the pitch circle`);
  }
  t.near(Math.hypot(centers.middle[0] - centers.axle[0], centers.middle[1] - centers.axle[1]), (T1 + t1) * 0.25, 1e-9, `${where}: first stage spaced by its pitch radii`);
  t.near(Math.hypot(centers.flywheel[0] - centers.middle[0], centers.flywheel[1] - centers.middle[1]), (T2 + t2) * 0.25, 1e-9, `${where}: second stage spaced by its pitch radii`);
  t.near(set.axleGear.group.position.x / MM, AXLE.rear, 1e-9, `${where}: first gear on the rear axle`);
  t.near(set.pinion.group.position.x / MM, centers.middle[0], 1e-9, `${where}: pinion on the middle shaft`);
  t.near(set.flywheelPinion.group.position.y / MM, centers.flywheel[1], 1e-9, `${where}: pinion on the flywheel's shaft`);
  // Clearances, in millimeters.
  const axleToFlywheel = Math.hypot(centers.flywheel[0] - AXLE.rear, centers.flywheel[1] - AXLE.height);
  t.ok(axleToFlywheel > 10 + 1.5, `${where}: flywheel clears the rear axle (${axleToFlywheel.toFixed(2)} mm)`);
  t.ok(Math.hypot(centers.middle[0] - AXLE.rear, centers.middle[1] - AXLE.height) > pitchRadius(T2) + 0.5 + 1.5, `${where}: middle shaft's gear clears the rear axle`);
  t.ok(AXLE.height - pitchRadius(T1) - 0.5 > 0, `${where}: first gear clears the floor`);
  t.ok(centers.flywheel[1] - 10 > 11 && centers.flywheel[1] + 10 < 40, `${where}: flywheel between the rails and the roof`);
  t.ok(centers.middle[1] + pitchRadius(T2) + 0.5 < 40, `${where}: middle gear under the roof`);
  t.ok(LAYOUT.flywheelZ - 2 > LAYOUT.frontZ + 1.5 && LAYOUT.backZ + 1.5 < LAYOUT.frontZ - 1.5, `${where}: gear layers clear of each other and of the flywheel`);
  // Meshing: along each line of centers a driver's tooth meets its driven gear's gap, at every angle.
  for (let k = 0; k <= 40; k++) {
    const wheel = -3 + k * 0.173, angles = trainAngles(ratio, wheel), frac = (value, pitch) => ((value % pitch) + pitch) % pitch / pitch;
    const first = frac(angles.axleGear - LAYOUT.first, TAU / T1) + frac(angles.pinion + Math.PI / t1 - LAYOUT.first - Math.PI, TAU / t1);
    const second = frac(angles.second - LAYOUT.second, TAU / T2) + frac(angles.flywheel + Math.PI / t2 - LAYOUT.second - Math.PI, TAU / t2);
    t.ok(Math.min(first % 1, 1 - first % 1) < 1e-9, `${where}: first stage meshes at wheel angle ${wheel.toFixed(3)}`);
    t.ok(Math.min(second % 1, 1 - second % 1) < 1e-9, `${where}: second stage meshes at wheel angle ${wheel.toFixed(3)}`);
    t.near(angles.axleGear - trainAngles(ratio, 0).axleGear, wheel, 1e-12, `${where}: first gear turns with the wheels`);
    t.near(angles.pinion - trainAngles(ratio, 0).pinion, -T1 / t1 * wheel, 1e-12, `${where}: pinion turns the other way, ${T1 / t1} times as fast`);
    t.near(angles.flywheel - trainAngles(ratio, 0).flywheel, ratio * wheel, 1e-9, `${where}: flywheel turns ${ratio} times as fast as the wheels, the same way`);
  }
}

// 5. The drawing.
const box = mesh => { mesh.geometry.computeBoundingBox(); const size = new THREE.Vector3(); mesh.geometry.boundingBox.getSize(size); return size.divideScalar(MM); };
{
  const shell = box(model.covers[0]);
  t.near(shell.x, 120, 1e-3, 'body 120 mm long');
  t.near(shell.z, 50, 1e-3, 'body 50 mm wide');
  t.near(p.wheels[0].children[0].geometry.parameters.radiusTop / MM, 15, 1e-9, 'wheels 30 mm across');
  t.near(p.flywheelDisk.geometry.parameters.radiusTop / MM, 10, 1e-9, 'flywheel 20 mm across');
  t.near(p.flywheelDisk.geometry.parameters.height / MM, 4, 1e-9, 'flywheel 4 mm thick');
  assert.equal(p.wheels.length, 4, 'four wheels');
}
const wrap = value => { const span = 2 * FLOOR.half; let place = (value + FLOOR.half) % span; if (place < 0) place += span; return place - FLOOR.half; };
const DRAW = [{}, {gearing: 0, floor: 0, release: 1, press: 12}, {gearing: 2, press: 20, pushes: 2, speed: 2.5, floor: 2}];
for (const values of DRAW) {
  const plan = toyPlan(values), N = plan.ratio, clocks = [0, 0.02, plan.params.T / 2, plan.params.T + 0.1, plan.releaseAt.t - 1e-3, plan.releaseAt.t + 0.01, plan.launch.t + 0.3, plan.duration / 2 + 0.37, plan.duration, plan.duration + 3];
  model.reset(); model.update(values);
  {
    const toyPoints = p.toyLine.geometry.attributes.position, flywheelPoints = p.flywheelLine.geometry.attributes.position;
    for (let i = 0; i < 600; i++) {
      const sample = toyAt(plan, plan.duration * i / 599), where = `${JSON.stringify(values)}: chart point ${i}`;
      t.near(toyPoints.getX(i), (CHART.left + i / 599 * CHART.width) * MM, 1e-6, `${where} across`);
      t.near(toyPoints.getY(i), (CHART.bottom + Math.min(1, (sample.phase.onFloor ? sample.v : 0) / 2.5) * CHART.height) * MM, 1e-6, `${where}: the toy's speed on the floor, nothing while it is carried back`);
      t.near(flywheelPoints.getY(i), (CHART.bottom + Math.min(1, sample.u / 2.5) * CHART.height) * MM, 1e-6, `${where}: flywheel speed in toy terms`);
    }
  }
  for (const [n, clock] of clocks.entries()) {
    model.reset(); model.update(values); model.advance(clock * p.SLOW);
    model.root.updateMatrixWorld(true);
    const s = model.getState(), now = toyAt(plan, clock), where = `${JSON.stringify(values)} at ${clock.toFixed(4)} s`;
    t.near(s.now.clock, Math.min(clock, plan.duration), 1e-9, `${where}: a quarter of real speed`);
    const wheel = -now.turned / r, angles = trainAngles(N, wheel);
    for (const item of p.wheels) t.near(item.rotation.z, wheel, 1e-9, `${where}: wheels turned by how far their rims have run`);
    for (const ratio of RATIOS) assert.equal(p.sets[ratio].set.visible, ratio === N, `${where}: only the ${N} to 1 train shown`);
    const set = p.sets[N], [[T1, t1]] = GEARS[N];
    for (const [name, angle, factor] of [['axleGear', angles.axleGear, 1], ['pinion', angles.pinion, T1 / t1], ['second', angles.second, T1 / t1], ['flywheelPinion', angles.flywheel, N]]) {
      t.near(set[name].group.rotation.z, angle, 1e-9, `${where}: ${name} angle`);
      const blurred = Math.abs(now.u) / r * factor / 4 / TAU > 10;
      assert.equal(set[name].blur.visible, blurred, `${where}: ${name} blurred only above ten turns a second as drawn`);
      assert.equal(set[name].sharp.visible, !blurred, `${where}: ${name} sharp below ten turns a second`);
    }
    t.near(p.flywheel.rotation.z, angles.flywheel, 1e-9, `${where}: flywheel turns with its pinion`);
    t.near(p.flywheel.position.x / MM, shafts(N).flywheel[0], 1e-9, `${where}: flywheel on its shaft`);
    t.near(p.flywheel.position.z / MM, LAYOUT.flywheelZ, 1e-9, `${where}: flywheel beside its pinion`);
    assert.equal(p.flywheelBlur.visible, drawnTurns(now.u, N) > 10, `${where}: flywheel blurred when it spins too fast to draw`);
    const lift = now.phase.onFloor ? 0 : 20;
    for (const group of [p.body, p.wheelsPart, p.gearsPart, p.flywheelPart, p.handPart]) t.near(group.position.y / MM, lift, 1e-9, `${where}: the toy lifted ${lift} mm`);
    const released = clock >= plan.releaseAt.t && clock > 0, pressing = !released && (clock === 0 || now.kind === 'pushing');
    assert.equal(p.handPart.visible, !released, `${where}: the hand holds the toy until it lets go`);
    t.near(p.press.userData.length / MM, pressing ? 2.5 * plan.values.press : 0, 1e-9, `${where}: press arrow 2.5 mm a newton while pressing`);
    const along = now.x * 1000;
    p.seams.forEach((seam, k) => t.near(seam.position.x / MM, wrap(k * FLOOR.spacing - along), 1e-6, `${where}: seam ${k} slides back as the toy moves`));
    const nearest = Math.round(along / FLOOR.mark) * FLOOR.mark - along, shown = nearest >= -FLOOR.half && nearest < FLOOR.half;
    assert.equal(p.mark.visible, shown, `${where}: the gold line shows when a half meter from the start is on the drawn floor`);
    if (shown) t.near(p.mark.position.x / MM, nearest, 1e-6, `${where}: the gold line sits on that half meter`);
    assert.equal(p.base.material.color.getHex(), FLOOR_COLORS[plan.values.floor], `${where}: floor colored by its kind`);
    const toyPoints = p.toyLine.geometry.attributes.position, flywheelPoints = p.flywheelLine.geometry.attributes.position;
    for (const i of [0, 150, 377, 599]) {
      const sample = toyAt(plan, plan.duration * i / 599);
      t.near(toyPoints.getX(i), (CHART.left + i / 599 * CHART.width) * MM, 1e-6, `${where}: chart across`);
      t.near(toyPoints.getY(i), (CHART.bottom + Math.min(1, (sample.phase.onFloor ? sample.v : 0) / 2.5) * CHART.height) * MM, 1e-6, `${where}: toy speed up`);
      t.near(flywheelPoints.getY(i), (CHART.bottom + Math.min(1, sample.u / 2.5) * CHART.height) * MM, 1e-6, `${where}: flywheel speed up`);
    }
    t.near(p.cursor.geometry.attributes.position.getX(0), (CHART.left + now.clock / plan.duration * CHART.width) * MM, 1e-6, `${where}: line for now`);
    const parts = [now.flywheel, now.motion, now.energy.skid, now.energy.gears + now.energy.bearing, now.energy.rolling], total = parts.reduce((sum, value) => sum + value, 0);
    let left = CHART.left;
    p.shares.forEach((segment, k) => {
      const width = total > 1e-12 ? parts[k] / total * CHART.width : 0;
      assert.equal(segment.material.color.getHex(), SHARE_COLORS[k], `${where}: share ${k} color`);
      if (width > 1e-9) { t.near(segment.scale.x / MM, width, 1e-6, `${where}: share ${k} width`); t.near(segment.position.x / MM, left + width / 2, 1e-6, `${where}: share ${k} follows the last`); }
      else assert.equal(segment.visible, false, `${where}: empty share ${k} hidden`);
      left += width;
    });
    if (total > 1e-12) t.near(left, CHART.left + CHART.width, 1e-9, `${where}: shares fill the bar`);
    const reading = label => s.readings.find(item => item.label === label).value;
    t.ok(reading('Flywheel').startsWith(`${fixed(now.rpm, 0)} rpm`), `${where}: flywheel reading`);
    t.ok(reading('Toy').startsWith(`${fixed(now.phase.onFloor ? now.v : 0, 2)} m/s`), `${where}: toy reading`);
    assert.equal(reading('Wheels'), now.kind === 'lifted' ? 'In the air' : now.skidding ? 'Skidding' : clock === 0 || clock >= plan.duration ? 'At rest' : 'Gripping', `${where}: wheels reading`);
    if (n === 3) checkFinite(model.root, t);
  }
}

// 6. The lesson, the texts, controls, refusals and disposal.
const run = values => { model.reset(); model.update(values); return toyPlan(values); };
const skidOf = plan => plan.phases.find(phase => phase.kind === 'skidding');
checkTrialNumbers(frictionDriveToyLesson, {
  'Pump it up': st => (t.ok(!st.grips, 'pressing with 4 N the wheels skid'), {'3.00': st.need, '2.07': st.supply, '0.90': st.pushSpeeds[0], '1.07': st.pushSpeeds[1], '1.11': st.pushSpeeds[2], '8,486': st.rpm}),
  'Press harder': st => (t.ok(st.grips && st.pushSpeeds.every(u => Math.abs(u - 1.5) < 1e-12), 'every gripping push reaches the push speed'), {'3.67': st.supply, '1.50': st.releaseAt.u, '11,459': st.rpm, '3.00': st.rolled}),
  'Set it down': st => ({'0.23': skidOf(st).d, '0.72': st.launch.v, '1.65': st.rolled}),
  'Let go mid-push': st => ({'0.08': skidOf(st).d, '4.44': st.rolled, '3.82': 1.5 ** 2 / (2 * 0.03 * g)}),
  'Gear it up': st => (t.ok(!st.grips, 'even pressed hard, 24 to 1 skids'), {'24': RATIOS[st.values.gearing], '1': 1, '1.26': st.felt, '20': st.values.press, '17,507': st.rpm, '6.69': st.rolled}),
  'Gear it down': st => (t.ok(st.grips, '6 to 1 grips'), {'6': RATIOS[st.values.gearing], '1': 1, '79': st.felt * 1000, '0.089': st.stored, '0.47': st.rolled}),
  'Slippery tiles': st => (t.ok(!st.grips, 'tiles skid'), {'1.29': st.supply, '0.79': st.releaseAt.u, '1.02': st.rolled}),
  'Where the work goes': st => ({'0.717': st.energy.hand, '0.195': st.stored, '0.322': toyAt(st, st.releaseAt.t).energy.skid}),
}, run, t);
const felt = RATIOS.map(ratio => feltMass(ratio));
checkQuotedText(frictionDriveToyLesson.deeper.map(section => section.body).join(' '), {
  '79 g at 6 to 1, 316 g at 12 to 1, and 1.26 kg at 24 to 1': `${fixed(felt[0] * 1000, 0)} g at ${RATIOS[0]} to 1, ${fixed(felt[1] * 1000, 0)} g at ${RATIOS[1]} to 1, and ${fixed(felt[2], 2)} kg at ${RATIOS[2]} to 1`,
  'a toy of 120 g': `a toy of ${fixed(TOY.mass * 1000, 0)} g`,
  '0.16 m/s each second on a wooden floor at 12 to 1': `${fixed(toyPlan({}).deceleration, 2)} m/s each second on a wooden floor at ${RATIOS[1]} to 1`,
}, t);
checkQuotedText(frictionDriveToyLesson.limits, {
  '120 g on wheels 30 mm across': `${fixed(TOY.mass * 1000, 0)} g on wheels ${fixed(TOY.wheel * 2000, 0)} mm across`,
  'a steel flywheel 20 mm across and 4 mm thick, geared 6, 12 or 24 to 1': `a steel flywheel ${fixed(TOY.flywheel.radius * 2000, 0)} mm across and ${fixed(TOY.flywheel.thickness * 1000, 0)} mm thick, geared ${RATIOS[0]}, ${RATIOS[1]} or ${RATIOS[2]} to 1`,
  'passing on 80% of the power': `passing on ${fixed(TOY.efficiency * 100, 0)}% of the power`, 'bearing friction of 40 µN m': `bearing friction of ${fixed(TOY.bearing * 1e6, 0)} µN m`,
  'pushes of 150 mm, with the hand carrying the toy back in 0.3 s': `pushes of ${fixed(TOY.stroke * 1000, 0)} mm, with the hand carrying the toy back in ${TOY.back} s`,
  'gripping with up to 0.5 to 1.0 times the load and skidding at 0.4 to 0.9, with rolling resistance 0.02 to 0.12 of the weight': `gripping with up to ${FLOORS[0].grip} to ${fixed(FLOORS[2].grip, 1)} times the load and skidding at ${FLOORS[0].skid} to ${FLOORS[2].skid}, with rolling resistance ${FLOORS[0].rolling} to ${FLOORS[2].rolling} of the weight`,
}, t);
const partText = id => model.parts.find(part => part.id === id).description;
checkQuotedText(partText('body'), {'120 mm long and 50 mm wide': `${fixed(box(model.covers[0]).x, 0)} mm long and ${fixed(box(model.covers[0]).z, 0)} mm wide`}, t);
checkQuotedText(partText('wheels'), {'30 mm across': `${fixed(TOY.wheel * 2000, 0)} mm across`}, t);
checkQuotedText(partText('gears'), {'module 0.5 mm': `module ${p.MODULE} mm`, '6, 12 or 24 times': `${RATIOS[0]}, ${RATIOS[1]} or ${RATIOS[2]} times`}, t);
checkQuotedText(partText('flywheel'), {'20 mm across and 4 mm thick': `${fixed(TOY.flywheel.radius * 2000, 0)} mm across and ${fixed(TOY.flywheel.thickness * 1000, 0)} mm thick`, 'At 12 to 1 it feels at the wheels like 316 g': `At ${RATIOS[1]} to 1 it feels at the wheels like ${fixed(feltMass(RATIOS[1]) * 1000, 0)} g`, 'more than twice the whole toy': feltMass(RATIOS[1]) > 2 * TOY.mass ? 'more than twice the whole toy' : 'not twice the toy'}, t);
checkQuotedText(partText('hand'), {'2.5 mm long for every newton': '2.5 mm long for every newton'}, t);
checkQuotedText(partText('floor'), {'seams every 50 mm': `seams every ${FLOOR.spacing} mm`, 'every half meter': FLOOR.mark === 500 ? 'every half meter' : 'every mark'}, t);
checkControlsMove(model, () => [Array.from(p.toyLine.geometry.attributes.position.array), Array.from(p.flywheelLine.geometry.attributes.position.array), p.press.userData.length, p.base.material.color.getHex(), p.flywheel.position.toArray(), RATIOS.map(ratio => p.sets[ratio].set.visible)], each => each.advance(1.5 * p.SLOW), t);
checkRefusals(sampleToy, TOY_DOMAINS, t);
const resources = checkDisposal(model, t);
console.log(`PASS friction-drive toy: ${t.count} checks, ${frictionDriveToyLesson.tryIt.length} trials, ${resources} resources`);

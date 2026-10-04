import assert from 'node:assert/strict';
import {toyPlan, toyAt, phaseAt, sampleToy, feltMass, flywheelInertia, rpmOf, RATIOS, GEARS, TOY_DOMAINS} from './friction-drive-toy-physics.js';
import {tally, checkRefusals} from './model-check-kit.mjs';

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
    onFloor = false;
    const lifted = Math.round(back / dt), goal = last ? stroke : 0, delta = goal - stroke;
    const vx = q => (6*q*q-6*q)*stroke/back+(3*q*q-4*q+1)*V+(-6*q*q+6*q)*goal/back;
    const ax = q => (12*q-6)*(stroke-goal)/(back*back)+(6*q-4)*V/back;
    for (let n = 0; n < lifted; n++) {
      const q = (n + .5) / lifted, ydot = .02 * Math.PI / back * Math.sin(2*Math.PI*q), yddot = .04*Math.PI*Math.PI/(back*back)*Math.cos(2*Math.PI*q);
      e.hand += m * (vx(q)*ax(q)+(yddot+g)*ydot)*dt;
      const next = Math.max(0, u - b / felt * dt), meanU = (u + next) / 2;
      e.bearing += b * meanU * dt; turned += meanU * dt; u = next; time += dt;
      v = vx((n+1)/lifted);
      if (n % 50 === 24) note();
    }
    if (last) { v = 0; break; }
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
for (const speed of range('speed')) for (const pushes of range('pushes')) for (const press of range('press')) for (const gearing of range('gearing')) for (const floor of range('floor')) for (const release of range('release')) {
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
    t.near(skid?.d || 0, tau, 1e-12, `${where}: launch skid time in closed form`);
    t.near(toyAt(plan, plan.launch.t).energy.skid - toyAt(plan, plan.releaseAt.t).energy.skid, F * u0 * tau / 2, 1e-12, `${where}: launch skid heat in closed form`);
    t.ok(u0 === 0 || vL < eta * felt * u0 / (m + eta * felt), `${where}: launching loses more than a lossless sticking collision would`);
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
    t.near(ledger.hand, now.motion + now.potential + now.flywheel + ledger.skid + ledger.gears + ledger.bearing + ledger.rolling, 1e-12, `${where}: energy ledger at ${i}/60`);
    t.ok(ledger.skid >= -1e-15 && ledger.gears >= -1e-15 && ledger.bearing >= -1e-15 && ledger.rolling >= -1e-15, `${where}: losses never negative`);
  }
  const complete = toyAt(plan, plan.duration);
  t.ok(complete.complete && complete.stage === 'Stopped' && complete.force === 0 && complete.drive === 'none', 'stopped means no remaining drive');
  let previous = null;
  for (const phase of plan.phases) {
    const first = phaseAt(plan, phase, 0), last = phaseAt(plan, phase, phase.d);
    if (previous) for (const key of ['x','v','vy','height','u','turned','frontTurned']) t.near(first[key],previous[key],1e-11,'continuous phase '+key);
    previous = last;
    for (const fraction of [.2,.5,.8]) {
      const time = phase.d*fraction, epsilon = Math.min(1e-6,phase.d/100);
      const at = phaseAt(plan,phase,time), before = phaseAt(plan,phase,time-epsilon), after = phaseAt(plan,phase,time+epsilon);
      t.near((after.x-before.x)/(2*epsilon),at.v,1e-7,'position derivative is body velocity');
      t.near((after.height-before.height)/(2*epsilon),at.vy,1e-7,'height derivative is vertical velocity');
      t.near((after.turned-before.turned)/(2*epsilon),at.u,1e-7,'rear travel derivative is driven rim speed');
      t.near((after.frontTurned-before.frontTurned)/(2*epsilon),at.frontRimSpeed,1e-7,'front travel follows independent rim speed');
      t.near(at.energy.hand,at.motion+at.potential+at.flywheel+at.energy.skid+at.energy.gears+at.energy.bearing+at.energy.rolling,1e-11,'energy during every phase');
      t.ok(at.height>=0&&at.height<=.02+1e-12,'carry clears floor and respects lift');
      if(phase.onFloor) t.near(at.frontRimSpeed,at.v,1e-12,'front wheels roll at body speed');
    }
  }
  runs++;
}
t.ok(runs === 9 * 6 * 11 * 3 * 3 * 2, 'every selectable combination of all six controls');


checkRefusals(sampleToy, TOY_DOMAINS, t);
console.log('PASS friction-drive toy physics: '+t.count+' checks; '+SETTINGS.length+' independent time-step simulations; '+runs+' complete control combinations');

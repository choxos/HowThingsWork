// Washing machine: tumbling laundry flown again in small steps, the spun-out
// water integrated through the layer and the pore spread, the tub's shaking
// integrated directly at steady speeds and through a whole spin-up, every
// second of the program balanced again for water, detergent, heat and energy,
// the heating held to its exact solution, the drawing held to the state, and
// every number the lesson quotes held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {washerPlan, sampleWasher, runUp, tumble, spunMoisture, layerPressure, shake, resonancePeak, criticalRpm, DRUM, WATER, FABRIC, DETERGENT, PROGRAM, SUSPENSION, WASHER_DOMAINS} from './washing-machine-physics.js';
import {createWashingMachineModel, waterDepth, drawnAngles, clumpPlace, clumpRadius, CABINET, TUB} from './washing-machine-model.js';
import {washingMachineLesson} from './washing-machine-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

// The machine written again, for the independent computations below.
const t = tally(), TAU = Math.PI * 2, g = 9.81, R = 0.25, M = 40, k = 18000, c = 340;
const omega = rpm => rpm * TAU / 60;
const swing = (lump, w) => lump * R * w * w / Math.hypot(k - M * w * w, c * w);
const zeta = c / (2 * Math.sqrt(k * M));

// 1. Tumbling.
t.near(criticalRpm(), Math.sqrt(g / R) * 60 / TAU, 1e-12, 'critical speed');
t.ok(tumble(criticalRpm() + 1e-6).pinned && !tumble(criticalRpm() - 1e-6).pinned, 'pinned from the critical speed up');
for (const speed of [20, 35, 50, 57, 59.5]) {
  const w = omega(speed), path = tumble(speed), where = `${speed} rpm`;
  // The wall's push on each kilogram at angle theta from the bottom is w^2 R + g cos(theta).
  t.near(w * w * R + g * Math.cos(path.release), 0, 1e-9, `${where}: released where the wall stops pushing`);
  t.ok(path.release > Math.PI / 2 && w * w * R + g * Math.cos(path.release - 1e-4) > 0, `${where}: the wall still pushed just before, in the upper half`);
  // Fly it again in 10 µs steps, exact for constant gravity, until it meets the wall.
  const dt = 1e-5;
  let x = R * Math.sin(path.release), y = -R * Math.cos(path.release), vx = w * R * Math.cos(path.release), vy = w * R * Math.sin(path.release), time = 0;
  for (;;) {
    const nx = x + vx * dt, ny = y + vy * dt - g * dt * dt / 2;
    if (time > 10 * dt && Math.hypot(nx, ny) >= R) {
      const u = (R - Math.hypot(x, y)) / (Math.hypot(nx, ny) - Math.hypot(x, y));
      x += (nx - x) * u; y += (ny - y) * u; vy -= g * u * dt; time += u * dt;
      break;
    }
    x = nx; y = ny; vy -= g * dt; time += dt;
  }
  t.near(path.flight, time, 2e-5, `${where}: flight time`);
  t.near(path.flight, 4 * w * R * Math.sin(path.release) / g, 1e-9, `${where}: flight time in closed form`);
  t.near(path.landing, Math.atan2(x, -y), 1e-4, `${where}: landing angle`);
  t.near(path.drop, -R * Math.cos(path.release) - y, 1e-5, `${where}: drop`);
  t.near(path.impact, Math.hypot(vx, vy), 1e-4, `${where}: impact speed`);
  t.near(path.carry, (path.release - path.landing) / w, 1e-9, `${where}: carried up from landing to release`);
}

// 2. Water spun out: the layer's pressure and the pore spread integrated directly.
for (const speed of [400, 800, 1200, 1400]) {
  const w = omega(speed), N = 20000;
  let pressure = 0;
  for (let i = 0; i < N; i++) { const r = R - 0.05 + (i + 0.5) * 0.05 / N; pressure += 1000 * w * w * r * 0.05 / N; }
  t.near(layerPressure(w), pressure, 1e-9 * pressure, `${speed} rpm: pressure across the 50 mm layer`);
  const cut = Math.log(2 * 0.072 * 0.9 / pressure / 5e-6) / 1.2;
  let share = 0;
  for (let i = 0; i < 200000; i++) { const z = -12 + (i + 0.5) * (cut + 12) / 200000; share += Math.exp(-z * z / 2) / Math.sqrt(TAU) * (cut + 12) / 200000; }
  t.near(spunMoisture(w), 0.45 + 1.05 * share, 1e-6, `${speed} rpm: water left, from the pores that still hold`);
}
t.near(spunMoisture(0), 1.5, 0, 'a still drum leaves the drained water');

// 3. Shaking, by RK4 at steady speeds and through a spin-up.
const rk4 = (x, v, time, dt, accel) => {
  const a1 = accel(time, x, v), x2 = x + v * dt / 2, v2 = v + a1 * dt / 2, a2 = accel(time + dt / 2, x2, v2);
  const x3 = x + v2 * dt / 2, v3 = v + a2 * dt / 2, a3 = accel(time + dt / 2, x3, v3), x4 = x + v3 * dt, v4 = v + a3 * dt, a4 = accel(time + dt, x4, v4);
  return [x + dt * (v + 2 * v2 + 2 * v3 + v4) / 6, v + dt * (a1 + 2 * a2 + 2 * a3 + a4) / 6];
};
for (const speed of [100, 203, 211, 600, 1200]) {
  const w = omega(speed), s = shake(0.2, w), F = 0.2 * R * w * w, dt = TAU / w / 400;
  let x = 0, v = 0, largest = 0, floor = 0;
  for (let n = 0; n * dt < 4; n++) {
    [x, v] = rk4(x, v, n * dt, dt, (time, x, v) => (F * Math.cos(w * time) - c * v - k * x) / M);
    if ((n + 1) * dt > 3) {
      largest = Math.max(largest, Math.abs(x)); floor = Math.max(floor, Math.abs(k * x + c * v));
      if ((n + 1) % 400 === 0) t.near(x, s.amplitude * Math.cos(s.phase), 2e-3 * s.amplitude, `${speed} rpm: lags the lump by the phase`);
    }
  }
  t.near(s.amplitude, largest, 1e-3 * s.amplitude, `${speed} rpm: steady shaking`);
  t.near(s.floor, floor, 1e-3 * s.floor, `${speed} rpm: force passed to the floor`);
  t.near(s.force, F, 1e-9, `${speed} rpm: the lump's pull`);
  t.near(s.natural, Math.sqrt(k / M), 1e-12, 'natural speed');
}
// The tub through spin run-ups, integrated again in 0.1 ms steps: the load pulls
// the tub with m R w^2 toward itself and, while the drum speeds up, m R dw/dt across.
const again = new Map();
const runUpAgain = (lump, rpm) => {
  const key = `${lump} ${rpm}`;
  if (again.has(key)) return again.get(key);
  const top = omega(rpm), rate = top / 60, dt = 1e-4, seconds = [];
  const accel = (time, x, v) => {
    const rising = time < 60, w = rising ? rate * time : top, angle = rising ? rate * time * time / 2 : top * (time - 30);
    return (lump * R * (w * w * Math.cos(angle) + (rising ? rate : 0) * Math.sin(angle)) - c * v - k * x) / M;
  };
  let x = 0, v = 0, n = 0;
  for (let s = 0; s < 63; s++) {
    let largest = 0, floor = 0, at = 0;
    for (const end = Math.round((s + 1) / dt); n < end; n++) {
      [x, v] = rk4(x, v, n * dt, dt, accel);
      if (Math.abs(x) > largest) { largest = Math.abs(x); at = rpm * Math.min(1, (n + 1) * dt / 60); }
      floor = Math.max(floor, Math.abs(k * x + c * v));
    }
    seconds.push({largest, floor, at});
  }
  again.set(key, seconds);
  return seconds;
};
for (const [lump, rpm] of [[0.2, 1200], [0.5, 600], [0.2, 400]]) {
  const model = runUp(lump, rpm), mine = runUpAgain(lump, rpm), where = `${lump} kg running up to ${rpm} rpm`, w = omega(rpm);
  assert.equal(model.length, 63, `${where}: the run-up and 3 s more`);
  mine.forEach((second, s) => {
    t.near(model[s].amplitude, second.largest, 1e-3 * second.largest + 1e-12, `${where}: largest swing in second ${s + 1}`);
    t.near(model[s].floor, second.floor, 1e-3 * second.floor + 1e-9, `${where}: largest floor force in second ${s + 1}`);
    t.near(model[s].rpm, second.at, rpm / 60 + 1e-9, `${where}: speed at the largest swing in second ${s + 1}`);
  });
  t.near(mine.at(-1).largest, swing(lump, w), 1e-3 * swing(lump, w), `${where}: settled to the steady swing`);
  t.near(mine.at(-1).floor, swing(lump, w) * Math.hypot(k, c * w), 1e-3 * swing(lump, w) * Math.hypot(k, c * w), `${where}: settled to the steady floor force`);
}
{
  const steady = resonancePeak(0.2), largest = runUpAgain(0.2, 1200).reduce((best, second) => (second.largest > best.largest ? second : best));
  t.near(steady.amplitude, 0.2 * R / M / (2 * zeta * Math.sqrt(1 - zeta * zeta)), 1e-12, 'steady peak in closed form');
  t.near(steady.rpm, Math.sqrt(k / M) / Math.sqrt(1 - 2 * zeta * zeta) * 60 / TAU, 1e-9, 'steady peak speed in closed form');
  t.ok(largest.largest > steady.amplitude && largest.largest < 1.05 * steady.amplitude && largest.at > steady.rpm, `running up in a minute the tub swings a little more, ${(largest.largest * 1000).toFixed(3)} mm, and a little later, at ${largest.at.toFixed(1)} rpm`);
}

// 4. Every second of the program, balanced again from its rules.
const SETTINGS = [{}, {temperature: 15}, {temperature: 60, rinses: 3, load: 7}, {spin: 400, rinses: 1, load: 2}, {imbalance: 0.5}, {temperature: 25, spin: 800, imbalance: 0.6, rinses: 3, load: 3}];
const fillSeconds = liters => Math.ceil(liters / 0.2 - 1e-9);
for (const values of SETTINGS) {
  const full = {temperature: 40, spin: 1200, rinses: 2, load: 5, imbalance: 0.2, ...values}, plan = washerPlan(values), where = JSON.stringify(values), L = full.load;
  const top = full.imbalance > 0.4 ? Math.min(full.spin, 600) : full.spin, middle = Math.min(800, top);
  const expected = [['Filling for the wash', fillSeconds(2.5 * L + 5)], ...(full.temperature > 15 ? [['Heating', null]] : []), ['Washing', 900], ['Draining the wash', 60], ['Spinning after the wash', 120]];
  for (let r = 1; r <= full.rinses; r++) expected.push([`Filling for rinse ${r}`, fillSeconds(2 * L + 5)], [`Rinse ${r}`, 300], [`Draining rinse ${r}`, 60], r < full.rinses ? [`Spinning after rinse ${r}`, 120] : ['Final spin', 360]);
  assert.deepEqual(plan.stages.map(stage => stage.stage), expected.map(([name]) => name), `${where}: stages in order`);
  plan.stages.forEach((stage, i) => {
    t.near(stage.start, i ? plan.stages[i - 1].end : 0, 0, `${where}: ${stage.stage} starts as the last ends`);
    if (expected[i][1] !== null) t.near(stage.end - stage.start, expected[i][1], 0, `${where}: ${stage.stage} lasts as long as the rules say`);
  });
  assert.equal(plan.samples.length, plan.duration, `${where}: a sample a second`);
  t.near(plan.stages.at(-1).end, plan.duration, 0, `${where}: the last stage ends the program`);
  t.near(plan.topSpin, top, 0, `${where}: top spin`);
  t.near(plan.middleSpin, middle, 0, `${where}: spins between rinses`);

  let prev = {T: 20, liquid: 0, concentration: 0, moisture: 0, energy: 0, heaterEnergy: 0, used: 0, water: 0};
  const keptBeforeRinse = [];
  let largestSwing = 0;
  for (const [index, stage] of plan.stages.entries()) {
    const kind = stage.stage.startsWith('Filling') ? 'fill' : stage.stage.startsWith('Draining') ? 'drain' : /spin/i.test(stage.stage) ? 'spin' : stage.stage === 'Heating' ? 'heat' : 'tumble';
    const target = stage.stage === 'Final spin' ? top : middle, length = stage.end - stage.start, total = (stage.stage === 'Filling for the wash' ? 2.5 : 2) * L + 5;
    if (kind === 'fill' && index > 0) keptBeforeRinse.push(prev.moisture * L);
    const freeAtStart = prev.water;
    for (let s = 0; s < length; s++) {
      const now = plan.samples[stage.start + s], here = `${where} ${stage.stage} +${s + 1} s`;
      assert.equal(now.stage, stage.stage, `${here}: sample in its stage`);
      assert.equal(now.t, stage.start + s + 1, `${here}: sample time`);
      const rpm = kind === 'drain' ? 0 : kind === 'spin' ? target * Math.min(1, (s + 1) / 60) : 50;
      t.near(now.rpm, rpm, 1e-9, `${here}: drum speed`);

      // Water: in at 12 L a minute, soaked up to 1.5 kg a kilogram, the free water drained over a minute, spun out.
      if (kind === 'fill') {
        t.near(now.liquid - prev.liquid, Math.min(0.2, total - 0.2 * s), 1e-9, `${here}: filling at 12 L a minute`);
        t.near(now.used - prev.used, now.liquid - prev.liquid, 1e-12, `${here}: water filled is water used`);
        t.near(now.moisture, Math.min(1.5, Math.max(prev.moisture, now.liquid / L)), 1e-12, `${here}: the laundry soaks up to 1.5 kg a kilogram`);
      } else t.near(now.used, prev.used, 0, `${here}: no water used`);
      if (kind === 'drain') {
        t.near(now.water, freeAtStart * (length - 1 - s) / length, 1e-9, `${here}: free water pumped out over a minute`);
        t.near(now.moisture, prev.moisture, 0, `${here}: the laundry keeps its water while draining`);
      }
      if (kind === 'spin') {
        const w = omega(rpm), level = spunMoisture(w);
        t.near(now.moisture, prev.moisture > level ? level + (prev.moisture - level) * Math.exp(-layerPressure(w) / 1.5e6) : prev.moisture, 1e-12, `${here}: water pressed out toward the level the speed allows`);
        t.near(now.water, 0, 1e-12, `${here}: spun-out water pumped away`);
      }
      if (kind === 'tumble' || kind === 'heat') { t.near(now.liquid, prev.liquid, 0, `${here}: water kept`); t.near(now.moisture, prev.moisture, 0, `${here}: laundry water kept`); }
      t.near(now.water, now.liquid - now.moisture * L, 1e-12, `${here}: free water is what the laundry does not hold`);
      t.ok(now.water >= -1e-12, `${here}: no negative free water`);

      // Detergent: 60 g once the wash water is in; fills dilute it and only water leaving takes it away.
      if (kind === 'fill') t.near(now.concentration * now.liquid, prev.concentration * prev.liquid, 1e-9, `${here}: filling dilutes the detergent without adding or removing any`);
      else if (index === 1 && s === 0) t.near(now.concentration * now.liquid, DETERGENT, 1e-9, `${here}: 60 g dissolved in the wash water`);
      else t.near(now.concentration, prev.concentration, 0, `${here}: water leaves at its concentration`);
      t.near(now.detergentInLaundry, now.concentration * now.moisture * L, 1e-12, `${here}: detergent in the laundry's water`);
      t.near(now.detergentInWater, now.concentration * now.water, 1e-12, `${here}: detergent in the free water`);

      // Heat: the machine's heat changes by the heater, by the loss to the room at the temperature it had, by
      // the cold water mixed in, and by the warm water pumped away.
      const Cprev = prev.liquid * 4186 + L * 1300 + 5000, Cnow = now.liquid * 4186 + L * 1300 + 5000, heater = now.heaterEnergy - prev.heaterEnergy;
      const mixed = now.liquid > prev.liquid ? (Cprev * prev.T + (now.liquid - prev.liquid) * 4186 * 15) / Cnow : prev.T;
      t.near(now.T, mixed + (heater - 5 * (mixed - 20)) / Cnow, 1e-9, `${here}: heat balance`);
      if (kind === 'heat') {
        t.ok(heater > 0 && heater <= 2000 + 1e-9, `${here}: heater within its 2 kW`);
        if (s < length - 1) { t.near(heater, 2000, 1e-9, `${here}: heater at full power`); t.ok(now.T < full.temperature, `${here}: still below the setting`); }
        else t.near(now.T, full.temperature, 1e-9, `${here}: heating stops at the setting`);
      } else if (stage.stage === 'Washing') t.near(heater, Math.max(0, 5 * (prev.T - 20)), 1e-9, `${here}: heater makes up the loss`);
      else t.near(heater, 0, 0, `${here}: heater off`);

      // Energy: the motor at 100 W tumbling and 350 W spinning, the pump at 30 W draining and spinning, and the heater.
      t.near(now.energy - prev.energy - heater, {fill: 100, heat: 100, tumble: 100, drain: 30, spin: 380}[kind], 1e-6, `${here}: motor and pump`);

      // Shaking only while spinning: integrated again through each run-up, steady after it.
      const w = omega(rpm), rising = kind === 'spin' && s < 63 ? runUpAgain(full.imbalance, target)[s] : null;
      if (rising) {
        t.near(now.amplitude, rising.largest, 1e-3 * rising.largest + 1e-12, `${here}: largest swing this second`);
        t.near(now.floor, rising.floor, 1e-3 * rising.floor + 1e-9, `${here}: largest floor force this second`);
      } else {
        const X = kind === 'spin' ? swing(full.imbalance, w) : 0;
        t.near(now.amplitude, X, 1e-15, `${here}: steady shaking`);
        t.near(now.floor, X * Math.hypot(k, c * w), 1e-9, `${here}: steady force on the floor`);
      }
      largestSwing = Math.max(largestSwing, now.amplitude);
      prev = now;
    }
  }

  t.near(plan.peak.amplitude, largestSwing, 0, `${where}: the peak is the program's largest swing`);

  // Heating against the exact solution of C dT/dt = 2000 - 5 (T - 20).
  const heating = plan.stages.find(stage => stage.stage === 'Heating');
  if (heating) {
    const C = (2.5 * L + 5) * 4186 + L * 1300 + 5000, T0 = plan.samples[heating.start - 1].T, far = 20 + 2000 / 5;
    for (let i = heating.start; i < heating.end - 1; i++) t.near(plan.samples[i].T, far + (T0 - far) * Math.exp(-5 * (i + 1 - heating.start) / C), 2e-3, `${where}: warming follows the exact curve`);
    const reach = -C / 5 * Math.log((far - full.temperature) / (far - T0));
    t.ok(plan.heatingTime >= reach - 0.05 && plan.heatingTime <= reach + 1, `${where}: heated in ${plan.heatingTime} s, exactly ${reach.toFixed(2)} s`);
    t.near(plan.heatingEnergy, plan.samples[heating.end - 1].heaterEnergy, 0, `${where}: heating energy`);
    t.ok(plan.heatingEnergy <= 2000 * plan.heatingTime && plan.heatingEnergy > 2000 * (plan.heatingTime - 1), `${where}: heating energy at full power`);
  } else t.near(plan.heatingTime + plan.heatingEnergy, 0, 0, `${where}: nothing heated`);

  // Detergent left: 60 g in the wash water, diluted by each rinse in turn.
  let concentration = DETERGENT / (2.5 * L + 5);
  for (const kept of keptBeforeRinse) concentration *= kept / (kept + 2 * L + 5);
  t.near(plan.final.detergentInLaundry, concentration * plan.final.moisture * L, 1e-12 * plan.final.detergentInLaundry, `${where}: detergent left, from the product of the dilutions`);
  t.near(plan.final.used, 2.5 * L + 5 + full.rinses * (2 * L + 5), 1e-9, `${where}: water used`);

  // Spins integrated again in 10 ms steps with the speed ramping smoothly.
  for (const name of ['Spinning after the wash', 'Final spin']) {
    const stage = plan.stages.find(item => item.stage === name), speed = name === 'Final spin' ? top : middle, dt = 0.01;
    let m = plan.samples[stage.start - 1].moisture;
    for (let n = 0; n * dt < stage.end - stage.start - 1e-9; n++) {
      const w = omega(speed * Math.min(1, (n + 0.5) * dt / 60)), level = spunMoisture(w);
      if (m > level) m = level + (m - level) * Math.exp(-dt * layerPressure(w) / 1.5e6);
    }
    t.near(plan.samples[stage.end - 1].moisture, m, name === 'Final spin' ? 2e-3 : 0.02, `${where}: ${name} leaves the water a fine integration does`);
  }
  t.near(plan.top.amplitude, swing(full.imbalance, omega(top)), 1e-15, `${where}: shaking at the top spin`);
  t.near(plan.top.force, full.imbalance * R * omega(top) ** 2, 1e-9, `${where}: the lump's pull at the top spin`);
  t.ok(middle >= plan.steadyPeak.rpm, `${where}: every spin runs up through the tub's natural speed`);
  t.add(2);
}

// 5. The drawing.
const model = createWashingMachineModel(), p = model.topology, MM = p.MM;
const boxOf = objects => {
  const saved = model.root.rotation.clone();
  model.root.rotation.set(0, 0, 0); model.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  model.root.rotation.copy(saved); model.root.updateMatrixWorld(true);
  return box;
};
{
  const cabinet = boxOf(p.cabinet.children.filter(child => child !== p.door));
  t.near((cabinet.max.x - cabinet.min.x) / MM, 600, 1e-3, 'cabinet 600 mm wide');
  t.near((cabinet.max.y - cabinet.min.y) / MM, 850, 1e-3, 'cabinet 850 mm tall');
  t.near(cabinet.min.y / MM, 0, 1e-3, 'cabinet on the floor');
  t.near((cabinet.max.z - cabinet.min.z) / MM, 600, 1e-3, 'cabinet 600 mm deep');
  t.near(p.tubShell.geometry.parameters.radiusTop / MM, 300, 1e-9, 'tub 300 mm in radius');
  t.near(p.tubShell.geometry.parameters.height / MM, 400, 1e-9, 'tub 400 mm deep');
  t.near(p.drumShell.geometry.parameters.radiusTop / MM, DRUM.radius * 1000, 1e-9, 'drum 250 mm in radius');
  t.near(p.drumShell.geometry.parameters.height / MM, DRUM.depth * 1000, 1e-9, 'drum 300 mm deep');
  t.near(p.drum.position.y / MM, TUB.y, 1e-9, 'drum on the tub axis');
  assert.equal(p.lifters.length, 3, 'three lifters');
  p.springs.forEach((spring, i) => {
    const box = boxOf([spring]), side = i ? 1 : -1;
    t.near((box.min.x + box.max.x) / 2 / MM, side * 250, 1, 'spring beside the counterweight');
    t.near(box.min.y / MM, 450 + Math.sqrt(300 ** 2 - 250 ** 2), 3.5, 'spring hooked to the side of the tub');
    t.near(box.max.y / MM, 840, 3.5, 'spring hooked under the lid');
  });
  p.dampers.forEach((rod, i) => {
    const side = i ? 1 : -1, a = [side * 180, 450 - Math.sqrt(300 ** 2 - 180 ** 2), -20], b = [side * 240, 10, -20];
    t.near(rod.geometry.parameters.height / MM, Math.hypot(a[0] - b[0], a[1] - b[1]), 1e-6, 'damper from the tub to the floor');
    t.near(rod.position.x / MM, (a[0] + b[0]) / 2, 1e-6, 'damper across');
    t.near(rod.position.y / MM, (a[1] + b[1]) / 2, 1e-6, 'damper up');
  });
}
for (const liters of [0.5, 5, 10, 16]) {
  const h = waterDepth(liters) / 1000, N = 200000;
  let area = 0;
  for (let i = 0; i < N; i++) { const y = -0.3 + (i + 0.5) * h / N; area += 2 * Math.sqrt(Math.max(0, 0.09 - y * y)) * h / N; }
  t.near(area * 0.4 * 1000, liters, 2e-4 * liters, `${liters} L fills the bottom of the tub as deep as drawn`);
}
t.near(waterDepth(0), 0, 0, 'no water, no pool');
{
  // A tumbling clump followed in 1 ms steps: never jumping, on the wall or in free fall.
  const path = tumble(50), inner = (250 - clumpRadius(5)) / 1000, dt = 1e-3, cycle = path.carry + path.flight;
  const at = n => clumpPlace(0, 50, n * dt, 0, 5).map(v => v / 1000), airborne = n => Math.hypot(...at(n)) < inner - 1e-9;
  let flying = 0;
  for (let n = 1; n * dt <= 2 * cycle; n++) {
    const here = at(n), before = at(n - 1), after = at(n + 1);
    t.ok(Math.hypot(here[0] - before[0], here[1] - before[1]) <= inner / R * path.impact * dt * 1.0001, `a tumbling clump never jumps at ${n} ms`);
    if (!airborne(n)) { t.near(Math.hypot(...here), inner, 1e-9, 'carried on the wall'); continue; }
    flying++;
    if (airborne(n - 1) && airborne(n + 1)) {
      t.near((after[0] - 2 * here[0] + before[0]) / dt / dt, 0, 1e-4, 'nothing pushes a falling clump sideways');
      t.near((after[1] - 2 * here[1] + before[1]) / dt / dt, -g * inner / R, 1e-4, 'a falling clump falls under gravity, drawn at its inner radius');
    }
  }
  t.near(flying * dt, 2 * path.flight, 3 * dt, 'in the air for the flight time each cycle');
}

const DRAW_SETTINGS = [{}, {temperature: 60, rinses: 3, load: 7}, {imbalance: 0.5}, {temperature: 15, spin: 400, load: 2, rinses: 1}];
for (const values of DRAW_SETTINGS) {
  const plan = washerPlan(values), angles = drawnAngles(plan.samples), count = Math.min(5000, plan.samples.length);
  for (let i = 0; i < plan.samples.length; i++) t.near(angles[i + 1] - angles[i], Math.min(120, plan.samples[i].rpm) * TAU / 60 / 60, 1e-12, `${JSON.stringify(values)}: drum drawn at its speed, capped at 120 rpm, sixty times slower`);
  const clocks = [0, 0.3, 17.6, ...plan.stages.flatMap(stage => [stage.start + 1, (stage.start + stage.end) / 2 + 0.4, stage.end]), plan.duration + 50];
  for (const [n, clock] of clocks.entries()) {
    model.reset(); model.update(values); model.advance(clock / 60);
    model.root.updateMatrixWorld(true);
    const s = model.getState(), now = s.now, ends = Math.min(clock, plan.duration), where = `${JSON.stringify(values)} at ${clock} s`, index = Math.round(ends);
    t.near(s.clock, ends, 1e-9, `${where}: sixty times real time`);
    if (ends < 0.5) assert.equal(now.stage, 'Ready', `${where}: ready`);
    else assert.equal(now, plan.samples[Math.min(plan.samples.length - 1, index - 1)], `${where}: the sample for now`);

    t.near(p.drum.rotation.z, angles[Math.min(angles.length - 1, index)], 1e-12, `${where}: drum turned`);
    const w = omega(now.rpm), sway = now.amplitude * Math.sin(p.drum.rotation.z - Math.atan2(c * w, k - M * w * w)) * 1000 * MM;
    for (const group of [p.tub, p.drumPart, p.laundryPart, p.waterPart, p.heaterPart]) t.near(group.position.x, sway, 1e-15, `${where}: everything hanging on the springs sways together`);

    const inner = 250 - clumpRadius(s.values.load);
    t.near(clumpRadius(s.values.load), 55 * Math.cbrt(s.values.load / 5), 1e-12, `${where}: clumps sized to the load`);
    p.clumps.forEach((clump, i) => {
      const x = clump.position.x / MM - TUB.x, y = clump.position.y / MM - TUB.y, [ex, ey] = clumpPlace(i, now.rpm, ends / 60, p.drum.rotation.z, s.values.load);
      t.near(clump.scale.x, clumpRadius(s.values.load), 1e-12, `${where}: clump ${i} size`);
      t.near(x, ex, 1e-6, `${where}: clump ${i} across`);
      t.near(y, ey, 1e-6, `${where}: clump ${i} up`);
      t.near(clump.position.z / MM, TUB.z + (i % 3 - 1) * 70, 1e-9, `${where}: clump ${i} along the drum`);
      t.ok(Math.hypot(x, y) <= inner + 1e-6, `${where}: clump ${i} inside the drum`);
      if (now.rpm === 0) t.ok(y < 0 && Math.abs(Math.hypot(x, y) - inner) < 1e-6, `${where}: clump ${i} resting at the bottom`);
      if (now.rpm > criticalRpm()) {
        const angle = p.drum.rotation.z + i * TAU / 8;
        t.near(x, inner * Math.sin(angle), 1e-6, `${where}: clump ${i} pinned, turning with the drum`);
        t.near(y, -inner * Math.cos(angle), 1e-6, `${where}: clump ${i} pinned, turning with the drum`);
      }
    });

    const depth = waterDepth(now.water);
    t.near(s.depth, depth, 1e-12, `${where}: water depth`);
    if (depth > 0.05) {
      p.pool.geometry.computeBoundingBox();
      const box = p.pool.geometry.boundingBox;
      t.near(box.min.y / MM, TUB.y - TUB.radius, 1e-3, `${where}: water on the bottom of the tub`);
      t.near((box.max.y - box.min.y) / MM, depth, 0.06, `${where}: water as deep as its volume needs`);
      t.near((box.max.x - box.min.x) / MM, 2 * Math.sqrt(300 ** 2 - (300 - (box.max.y - box.min.y) / MM) ** 2), 1e-2, `${where}: water surface as wide as the tub there`);
      t.near((box.max.z - box.min.z) / MM, TUB.depth, 1e-3, `${where}: water the depth of the tub`);
    } else assert.equal(p.pool.geometry.attributes.position, undefined, `${where}: no pool drawn`);

    assert.equal(p.heater.material.color.getHex(), now.stage === 'Heating' ? 0xc14f39 : 0xb4c5b0, `${where}: heater glows while heating`);
    t.near(p.impeller.rotation.z, /drain|spin/i.test(now.stage) ? -TAU * 3 * ends / 60 : 0, 1e-9, `${where}: pump runs while draining and spinning`);

    const rpmLine = p.rpmLine.geometry, temperatures = p.temperatureLine.geometry.attributes.position;
    assert.equal(rpmLine.drawRange.count, count, `${where}: the whole program charted`);
    for (const i of [0, Math.floor(count / 3), count - 1]) {
      const sample = plan.samples[Math.floor(i * plan.samples.length / count)];
      t.near(rpmLine.attributes.position.getX(i), (380 + sample.t / plan.duration * 320) * MM, 1e-6, `${where}: speed chart across`);
      t.near(rpmLine.attributes.position.getY(i), (520 + Math.min(1, sample.rpm / 1400) * 200) * MM, 1e-6, `${where}: speed chart up`);
      t.near(temperatures.getY(i), (520 + Math.max(0, Math.min(1, (sample.T - 10) / 60)) * 200) * MM, 1e-6, `${where}: temperature chart up`);
    }
    const cursor = p.cursor.geometry.attributes.position;
    t.near(cursor.getX(0), (380 + ends / plan.duration * 320) * MM, 1e-6, `${where}: line for now`);
    t.near(cursor.getY(1) - cursor.getY(0), 200 * MM, 1e-6, `${where}: line for now spans the chart`);
    const response = p.shakeLine.geometry.attributes.position;
    for (const i of [0, 20, 21, 140]) {
      t.near(response.getX(i), (380 + i * 10 / 1400 * 320) * MM, 1e-6, `${where}: shaking chart across`);
      t.near(response.getY(i), (170 + Math.min(1, swing(s.values.imbalance, omega(i * 10)) * 1000 / 10) * 200) * MM, 1e-6, `${where}: shaking chart up`);
    }
    t.near(p.shakeDot.position.x, (380 + now.rpm / 1400 * 320) * MM, 1e-9, `${where}: dot for now across`);
    t.near(p.shakeDot.position.y, (170 + Math.min(1, now.amplitude * 1000 / 10) * 200) * MM, 1e-9, `${where}: dot for now up`);

    const reading = label => s.readings.find(item => item.label === label).value;
    t.ok(reading('Your result').startsWith(ends < 0.5 ? 'Ready' : now.stage), `${where}: result names the stage`);
    t.ok(reading('Drum').startsWith(`${fixed(now.rpm, 0)} rpm`), `${where}: drum reading`);
    t.ok(reading('Laundry') === `${fixed(now.moisture * 100, 1)}% water`, `${where}: laundry reading`);
    t.ok(reading('Shaking').startsWith(`${fixed(now.amplitude * 1000, 2)} mm`), `${where}: shaking reading`);
    if (n === 4) checkFinite(model.root, t);
  }
}

// 6. The lesson, the texts, controls, refusals and disposal.
const run = values => { model.reset(); model.update(values); return washerPlan(values); };
const held = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].filter(lump => !washerPlan({imbalance: lump}).held).at(-1);
checkTrialNumbers(washingMachineLesson, {
  'Tumble the wash': () => { const path = tumble(50); return {'50': DRUM.wash, '0.70': omega(50) ** 2 * R / g, '45.7': 180 - path.release * 180 / Math.PI, '358': path.drop * 1000, '2.95': path.impact}; },
  'Pinned to the wall': st => ({'59.8': criticalRpm(), '1,200': st.topSpin, '402': omega(1200) ** 2 * R / g}),
  'Heating the water': st => {
    t.near(st.washWater, 17.5, 1e-12, 'heats 17.5 L of water');
    return {'17.5': st.heatingTime / 60, '5': st.values.load, '15.7': st.samples[st.stages[0].end - 1].T, '40': st.values.temperature, '0.584': st.heatingEnergy / 3.6e6, '0.609': st.final.heaterEnergy / 3.6e6, '0.751': st.final.energy / 3.6e6};
  },
  'Wash cold': st => (t.ok(!st.stages.some(stage => stage.stage === 'Heating'), 'nothing to heat'), {'42.0': st.duration / 60, '0.113': st.final.energy / 3.6e6, '15': st.final.energy / washerPlan({}).final.energy * 100, '40': 40}),
  'Rinsing': st => ({'15': 2 * st.values.load + 5, '60': DETERGENT, '0.28': st.final.detergentInLaundry, '1.55': washerPlan({rinses: 1}).final.detergentInLaundry, '0.05': washerPlan({rinses: 3}).final.detergentInLaundry}),
  'Spin speed': st => ({'800': st.values.spin, '63.5': st.final.moisture * 100, '50.7': washerPlan({}).final.moisture * 100, '1,200': 1200, '48.3': washerPlan({spin: 1400}).final.moisture * 100, '1,400': 1400}),
  'Through resonance': st => ({'203': Math.sqrt(k / M) * 60 / TAU, '0.2': st.values.imbalance, '3.27': st.peak.amplitude * 1000, '221': st.peak.rpm, '1,200': st.topSpin, '1.28': st.top.amplitude * 1000, '59.5': st.top.floor, '789.6': st.top.force}),
  'A lopsided load': st => (t.ok(st.held && st.topSpin === 600 && st.middleSpin === 600, 'every spin held to 600 rpm'), {'0.4': held, '600': st.topSpin, '8.07': st.peak.amplitude * 1000, '79.3': st.final.moisture * 100}),
}, run, t);
checkQuotedText(washingMachineLesson.limits, {
  'a drum 250 mm in radius washing at 50 rpm': `a drum ${fixed(DRUM.radius * 1000, 0)} mm in radius washing at ${DRUM.wash} rpm`,
  '2.5 L of wash water a kilogram and 2 L a rinse, plus 5 L': `${WATER.washPerKg} L of wash water a kilogram and ${WATER.rinsePerKg} L a rinse, plus ${WATER.free} L`,
  'a 15 °C supply': `a ${WATER.supply} °C supply`, 'a room at 20 °C': `a room at ${WATER.room} °C`, 'a 2 kW heater': `a ${WATER.heater / 1000} kW heater`, '60 g of detergent': `${DETERGENT} g of detergent`,
  'pores around 5 µm, 1.5 kg a kilogram when drained, 0.45 kg of it inside the fibers': `pores around ${fixed(FABRIC.pore * 1e6, 0)} µm, ${FABRIC.drained} kg a kilogram when drained, ${FABRIC.bound} kg of it inside the fibers`,
  'a 40 kg tub on 18 kN/m springs and 340 N·s/m dampers': `a ${SUSPENSION.mass} kg tub on ${SUSPENSION.stiffness / 1000} kN/m springs and ${SUSPENSION.damping} N·s/m dampers`,
  'spins held to 600 rpm above 0.4 kg off balance': `spins held to ${PROGRAM.heldRpm} rpm above ${PROGRAM.heldAbove} kg off balance`,
}, t);
checkQuotedText(washingMachineLesson.deeper.map(section => section.body).join(' '), {
  '500 mm drum': `${fixed(DRUM.radius * 2000, 0)} mm drum`, 'faster than 59.8 rpm': `faster than ${fixed(criticalRpm(), 1)} rpm`, '40 kg here': `${SUSPENSION.mass} kg here`,
  'its natural speed, 203 rpm': `its natural speed, ${fixed(shake(0, 0).natural * 60 / TAU, 0)} rpm`, '4,186 J': `${fixed(WATER.heat, 0)} J`,
  'it swings 3.27 mm': `it swings ${fixed(washerPlan({}).peak.amplitude * 1000, 2)} mm`,
  'the 3.18 mm it would settle to at a steady 211 rpm': `the ${fixed(resonancePeak(0.2).amplitude * 1000, 2)} mm it would settle to at a steady ${fixed(resonancePeak(0.2).rpm, 0)} rpm`,
}, t);
checkQuotedText(washingMachineLesson.quiz.options[0], {'about 60 rpm': `about ${fixed(criticalRpm(), 0)} rpm`}, t);
const partText = id => model.parts.find(part => part.id === id).description;
checkQuotedText(partText('cabinet'), {'600 mm wide and 850 mm tall': `${CABINET.width} mm wide and ${CABINET.height} mm tall`}, t);
checkQuotedText(partText('tub'), {'300 mm in radius': `${TUB.radius} mm in radius`, '40 kg': `${SUSPENSION.mass} kg`}, t);
checkQuotedText(partText('drum'), {'250 mm in radius': `${fixed(DRUM.radius * 1000, 0)} mm in radius`, 'three lifters': `${['one', 'two', 'three'][p.lifters.length - 1]} lifters`}, t);
checkQuotedText(partText('heater'), {'2 kW': `${WATER.heater / 1000} kW`}, t);
checkControlsMove(model, () => [Array.from(p.rpmLine.geometry.attributes.position.array), Array.from(p.temperatureLine.geometry.attributes.position.array), Array.from(p.shakeLine.geometry.attributes.position.array), p.clumps[0].scale.x, p.shakeDot.position.toArray(), p.tub.position.x], m => m.advance(1e4), t);
checkRefusals(sampleWasher, WASHER_DOMAINS, t);
const resources = checkDisposal(model, t);
console.log(`PASS washing machine: ${t.count} checks, ${washingMachineLesson.tryIt.length} trials, ${resources} resources`);

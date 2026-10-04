// Independent motion, thermal, water, detergent and suspension checks.
import assert from 'node:assert/strict';
import {washerPlan, sampleWasher, runUp, spinResponse, tumble, spunMoisture, layerPressure, shake, resonancePeak, criticalRpm, DRUM, WATER, FABRIC, DETERGENT, PROGRAM, SUSPENSION, WASHER_DOMAINS} from './washing-machine-physics.js';
import {tally} from './model-check-kit.mjs';
import {stageMotion} from './washing-machine-motion.js';

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

// 4. Conservation and boundary behavior throughout complete programs.
const settings = [{}, {temperature: 15}, {temperature: 60, rinses: 3, load: 7}, {spin: 400, rinses: 1, load: 2}, {imbalance: 0.5}, {temperature: 25, spin: 800, imbalance: 0.6, rinses: 3, load: 3}];
let samplesChecked = 0, boundaries = 0;
for (const values of settings) {
  const p = washerPlan(values), L = p.values.load, initialHeat = (L * 1300 + 5000) * 20;
  let electrical = 0;
  for (const s of p.samples) {
    t.near(s.used - s.drained, s.liquid, 2e-9, 'all supplied water is retained or drained');
    t.near(s.liquid, s.water + s.moisture * L, 1e-10, 'free and fabric water add to retained water');
    t.near(s.dose - s.detergentOut, s.detergentInWater + s.detergentInLaundry, 1e-9, 'detergent is conserved');
    t.near(initialHeat + s.heaterEnergy + s.heatInWater - s.heatOutWater - s.heatToRoom, s.thermalEnergy, 2e-7, 'thermal energy including incoming and outgoing water');
    t.near(s.thermalEnergy, (s.liquid * 4186 + L * 1300 + 5000) * s.T, 1e-8, 'bath temperature matches stored energy');
    electrical += s.motorW + s.pumpW + s.heaterW;
    t.near(s.energy, electrical, 2e-7, 'heater, motor and pump sum to electrical energy');
    t.ok(s.water >= -1e-12 && s.moisture >= 0 && s.moisture <= 1.5 + 1e-12, 'nonnegative water within assigned fabric capacity');
    t.ok(s.heaterW >= 0 && s.heaterW <= 2000 + 1e-9, 'heater bounded by rated power');
    t.ok(!(s.inletLps > 0 && s.drainLps > 1e-10), 'no simultaneous fill and drain');
    samplesChecked++;
  }
  for (let i = 0; i < p.stages.length; i++) {
    const s = p.stages[i], start = sampleWasher(values, s.start), end = stageMotion(s, s.end);
    t.near(s.start, i ? p.stages[i - 1].end : 0, 0, 'contiguous program stages');
    if (i) {
      const prior = stageMotion(p.stages[i - 1], s.start);
      t.near(start.now.rpm, prior.rpm, 1e-9, 'speed continuous at stage boundary');
      t.near(start.now.angle, prior.angle, 1e-8, 'angle continuous at stage boundary');
      t.near(start.now.drawnAngle, prior.drawnAngle, 1e-10, 'display angle continuous at stage boundary');
    }
    const span = s.end - s.start, ramp = Math.min(s.ramp, span);
    const turns = (s.rpmFrom + s.rpmTo) / 2 * ramp / 60 + s.rpmTo * (span - ramp) / 60;
    t.near(end.angle - s.angle, turns * TAU, 2e-10, 'segment angle equals speed area');
    for (const seconds of [s.start + 0.07, s.start + span / 2 + 0.19, s.end - 0.03]) {
      const now = sampleWasher(values, seconds).now;
      t.near(now.t, seconds, 0, 'fractional time is not rounded');
      t.near(now.used - now.drained, now.liquid, 2e-9, 'fractional water balance');
      t.near(now.dose - now.detergentOut, now.detergentInWater + now.detergentInLaundry, 1e-9, 'fractional detergent balance');
      t.near(initialHeat + now.heaterEnergy + now.heatInWater - now.heatOutWater - now.heatToRoom, now.thermalEnergy, 2e-7, 'fractional heat balance');
      t.near(now.T * (now.liquid * 4186 + L * 1300 + 5000), now.thermalEnergy, 1e-8, 'fractional temperature matches energy');
      assert.equal(now.stage, s.stage); t.add(1);
    }
    boundaries++;
  }
  const finished = sampleWasher(values, p.duration + 10);
  t.ok(finished.complete && !finished.doorLocked && finished.now.stage === 'Complete', 'completion unlocks a stopped machine');
  t.near(finished.now.rpm + finished.now.pumpW + finished.now.motorW + finished.now.heaterW, 0, 0, 'all motion and powered functions stopped');
  t.near(finished.now.water, 0, 1e-10, 'no free water remains');
  t.near(p.final.dose, 60, 1e-10, 'assigned detergent dose fully dispensed');
  t.near(p.final.used, 2.5 * L + 5 + p.values.rinses * (2 * L + 5), 2e-9, 'water budget agrees with fill rules');
  const heating = p.stages.find(s => s.kind === 'heat');
  if (heating) {
    const beginning = p.samples[heating.start], C = beginning.liquid * 4186 + L * 1300 + 5000, asymptote = 420;
    const exactTime = -C / 5 * Math.log((asymptote - p.values.temperature) / (asymptote - beginning.T));
    t.near(heating.end - heating.start, Math.ceil(exactTime - 1e-9), 0, 'heating duration from exact ODE solution');
    t.near(p.samples[heating.end].T, p.values.temperature, 1e-9, 'heater reaches selected temperature');
    for (let s = heating.start + 1; s < heating.end; s++) t.near(p.samples[s].T, asymptote + (beginning.T - asymptote) * Math.exp(-5 * (s - heating.start) / C), 1e-8, 'exact constant-power heating');
  } else t.near(p.final.heaterEnergy, 0, 0, 'cold program uses no heater');
  // Each rinse dilutes the retained concentration by its old-water fraction.
  let concentration = 60 / p.washWater;
  for (const s of p.stages.filter(s => s.kind === 'fill' && s.start > 0)) {
    const old = p.samples[s.start].liquid, added = p.samples[s.end].used - p.samples[s.start].used;
    concentration *= old / (old + added);
  }
  t.near(p.final.concentration, concentration, 1e-11, 'independent product of rinse dilution fractions');
}

// Braking must also pass through resonance and decay after motion stops.
for (const rpm of [400, 800, 1400]) {
  const response = spinResponse(rpm, PROGRAM.final), start = PROGRAM.final, stop = start + PROGRAM.brake;
  t.ok(response.slice(start, stop).some(s => s.amplitude > response[start].amplitude), 'braking crosses resonance');
  t.ok(response.at(-1).amplitude < 1e-6 * response[stop].amplitude, 'suspension settles after the stop');
}

// Every selectable combination yields a bounded, complete program.
let combinations = 0;
for (let temperature = 15; temperature <= 60; temperature += 5)
for (let spin = 400; spin <= 1400; spin += 200)
for (let rinses = 1; rinses <= 3; rinses++)
for (let load = 2; load <= 7; load++)
for (let imbalanceIndex = 0; imbalanceIndex <= 6; imbalanceIndex++) {
  const imbalance = imbalanceIndex / 10, p = washerPlan({temperature, spin, rinses, load, imbalance}), f = p.final;
  t.ok(f.rpm === 0 && f.stage === 'Complete' && f.water < 1e-9, 'complete control combination stops and drains');
  t.near(p.topSpin, imbalance > 0.4 ? Math.min(spin, 600) : spin, 0, 'assigned imbalance rule caps requested speed');
  t.ok(f.moisture >= 0.45 && f.moisture <= 1.5 && f.energy >= f.heaterEnergy && f.detergentInLaundry < 60, 'bounded outcomes for every control combination');
  t.near(f.used - f.drained, f.liquid, 2e-9, 'final water conservation for every control combination');
  t.ok(temperature > 15 || f.heaterEnergy === 0, 'all cold programs leave heater off');
  combinations++;
}
t.ok(washerPlan({spin: 1400}).final.moisture < washerPlan({spin: 400}).final.moisture, 'faster spin leaves less water');
t.ok(washerPlan({rinses: 3}).final.detergentInLaundry < washerPlan({rinses: 1}).final.detergentInLaundry, 'additional rinses remove more detergent');
t.ok(washerPlan({temperature: 60}).final.energy > washerPlan({temperature: 40}).final.energy, 'hotter wash consumes more energy');
t.ok(washerPlan({imbalance: 0.6}).final.moisture > washerPlan({imbalance: 0}).final.moisture, 'reduced spin from imbalance leaves wetter laundry');
console.log(`PASS washing-machine physics: ${t.count} checks; ${samplesChecked} conserved states; ${boundaries} stage boundaries; ${combinations} control combinations`);

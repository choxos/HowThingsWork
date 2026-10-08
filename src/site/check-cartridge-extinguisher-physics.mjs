import assert from 'node:assert/strict';
import {FIRE_DEFAULTS, FIRE_OPTIONS, FIRE_SHAPE, FIRE_PHYSICS as P, FIRE_VOLUME_SCALE, FIRE_LENGTH_SCALE,
  fireSettings, fireVolumeBelow, fireLevel, fireAreaAt, cartridgeExtinguisherPlan, cartridgeExtinguisherAt,
  createCartridgeExtinguisherController} from './cartridge-extinguisher-physics.js';

let checks = 0, combinations = 0, samples = 0, timedRuns = 0;
const ok = (condition, message) => {checks++;assert(condition, message);};
const eq = (actual, expected) => {checks++;assert.deepEqual(actual, expected);};
const near = (actual, expected, tolerance = 1e-10) => {checks++;assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}, tolerance ${tolerance}`);};

// Independent piecewise geometry: integrate constant cross sections, then
// invert each interval directly instead of using the production bisection.
const levels = [0, .055, 1.16, 1.6, 2.7, 2.84, 3.125, 3.2], pickups = [.055, 1.6, 2.7];
const area = (y, pickup) => Math.PI * (.84 ** 2
  - (y > 1.16 && y < 3.125 ? y < 2.84 ? .18 ** 2 : .075 ** 2 : 0)
  - (y > pickups[pickup] ? .068 ** 2 : 0));
const rawVolume = (y, pickup) => levels.slice(1).reduce((sum, top, i) => sum
  + Math.max(0, Math.min(y, top) - levels[i]) * area((top + levels[i]) / 2, pickup), 0);
const volumeScale = .012 / rawVolume(3.2, 0), lengthScale = Math.cbrt(volumeScale);
const volumeAt = (y, pickup) => rawVolume(y, pickup) * volumeScale;
const levelAt = (volume, pickup) => {
  let left = volume;
  for (let i = 1; i < levels.length; i++) {
    const section = area((levels[i - 1] + levels[i]) / 2, pickup) * volumeScale;
    const capacity = section * (levels[i] - levels[i - 1]);
    if (left <= capacity + 1e-14) return levels[i - 1] + left / section;
    left -= capacity;
  }
  return 3.2;
};
const cartridge = Math.PI * (.162 ** 2 * (2.8 - 1.195) + .044 ** 2 * (3.125 - 2.8)) * volumeScale;
const outlet = Math.PI * (.021 * lengthScale) ** 2;
near(FIRE_VOLUME_SCALE, volumeScale);near(FIRE_LENGTH_SCALE, lengthScale);near(P.cartridgeVolume, cartridge);near(P.outletArea, outlet);
eq([P.atmosphere, P.density, P.gravity, P.chargePV], [101325, 1000, 9.80665, 1800]);
const midpoint = (fn, a, b, count) => {
  const width = (b - a) / count;let result = 0;
  for (let i = 0; i < count; i++) result += fn(a + (i + .5) * width);
  return result * width;
};
for (let pickup = 0; pickup < 3; pickup++) for (let index = 0; index <= 320; index++) {
  const y = index / 100, volume = volumeAt(y, pickup);
  near(fireVolumeBelow(y, pickup), volume);near(fireLevel(volume, pickup), y);
  if (!levels.some(level => Math.abs(y - level) < 1e-10)) near(fireAreaAt(y, pickup), area(y, pickup) * lengthScale ** 2);
}
const outcomes = [];
for (const water of [3, 6, 9]) for (const charge of [0, .25, 1]) for (const pickup of [0, 1, 2]) {
  const settings = {water, charge, pickup}, plan = cartridgeExtinguisherPlan(settings), initial = water / 1000;
  const capacity = volumeAt(3.2, pickup), gasRoom = capacity + cartridge, pv = 101325 * (gasRoom - initial) + 1800 * charge;
  const pressure = volume => pv / (gasRoom - volume);
  const drive = volume => pressure(volume) - 101325 - 1000 * 9.80665 * lengthScale * (3 - levelAt(volume, pickup));
  const flow = volume => outlet * Math.sqrt(2 * Math.max(0, drive(volume)) / 1000);
  let balance = 0;
  if (drive(initial) <= 0) balance = initial;
  else if (drive(0) < 0) {
    let lo = 0, hi = initial;
    for (let i = 0; i < 80; i++) {const middle = (lo + hi) / 2;if (drive(middle) > 0) hi = middle;else lo = middle;}
    balance = (lo + hi) / 2;
  }
  const pickupWater = volumeAt(pickups[pickup], pickup), stop = Math.min(initial, Math.max(pickupWater, balance));
  const reason = charge === 0 ? 'no-charge' : pickupWater >= initial ? 'dry-pickup' : balance > pickupWater ? 'pressure-balance' : 'pickup-exposed';
  eq(plan.values, settings);near(plan.capacity, capacity);near(plan.pv, pv);near(plan.stopWater, stop);eq(plan.reason, reason);
  near(plan.delivered + plan.stopWater, initial);near(plan.finalPressure, pressure(stop), 1e-7);
  const times = [...new Set([0, 1, 2.999999, 3, plan.duration - 1e-7, plan.duration, plan.duration + 100,
    ...Array.from({length: 101}, (_, i) => 3 + plan.dischargeTime * i / 100)])].sort((a, b) => a - b);
  let lastWater = initial, lastPressure = Infinity;
  for (const time of times) {
    const now = cartridgeExtinguisherAt(plan, time);samples++;
    ok(Object.values(now).filter(value => typeof value === 'number').every(Number.isFinite));
    near(now.water + now.delivered, initial);near(now.level, levelAt(now.water, pickup));
    ok(now.water <= lastWater + 1e-12);ok(now.water >= stop - 1e-12);lastWater = now.water;
    eq(now.released, time >= 3);eq(now.complete, time >= plan.duration);
    near(now.handle, Math.min(1, Math.min(time, plan.duration) / 4));
    if (now.released) {
      near(now.pressure, pressure(now.water), 1e-7);near(now.pressure * now.gasVolume, pv, 1e-8);
      ok(now.pressure <= lastPressure + 1e-7);lastPressure = now.pressure;
    } else {eq(now.pressure, 101325);eq(now.flow, 0);eq(now.delivered, 0);}
    if (now.flow > 0) {
      near(now.flow, flow(now.water), 1e-12);near(now.flow, now.speed * outlet, 1e-12);
      near(now.pressure / 1000 + 9.80665 * now.level * lengthScale,
        101325 / 1000 + 9.80665 * 3 * lengthScale + now.speed ** 2 / 2, 1e-9);
      ok(now.pickupWet, 'Water cannot flow with a dry intake');
    }
    if (now.complete) {eq(now.flow, 0);near(now.water, stop);}
  }
  if (plan.dischargeTime > 0) {
    // Independent quadrature uses midpoint refinement, with the integrable
    // pressure-balance endpoint transformed to sqrt(W - W_balance).
    const low = Math.sqrt(stop - balance), high = Math.sqrt(initial - balance);
    const derivative = u => 2 * u / flow(balance + u * u);
    const coarse = midpoint(derivative, low, high, 16384), fine = midpoint(derivative, low, high, 65536);
    near(coarse, fine, 2e-6);near(plan.dischargeTime, fine, 3e-6);
    // A separate RK4 integration of dW/dt verifies sampled water over time.
    let volume = initial, elapsed = 0;
    for (let target = 1; target <= 19; target++) {
      const end = plan.dischargeTime * target / 20;
      while (elapsed < end - 1e-12) {
        const step = Math.min(.004, end - elapsed), f = w => -flow(w);
        const k1 = f(volume), k2 = f(volume + step * k1 / 2), k3 = f(volume + step * k2 / 2), k4 = f(volume + step * k3);
        volume += step * (k1 + 2 * k2 + 2 * k3 + k4) / 6;elapsed += step;
      }
      near(cartridgeExtinguisherAt(plan, 3 + end).water, volume, 3e-9);
    }
    timedRuns++;
  }
  if (reason === 'pressure-balance') {near(drive(stop), 0, 1e-7);ok(stop > pickupWater);ok(plan.finalPressure > 101325);}
  if (reason === 'pickup-exposed') {near(stop, pickupWater);ok(drive(stop) > 0);ok(plan.finalPressure > 101325);}
  outcomes.push({settings, reason, liters: +(plan.delivered * 1000).toFixed(2)});combinations++;
}
eq(combinations, 27);eq(timedRuns, 8);
for (const [settings, delivered, reason] of [[{},8.79,'pickup-exposed'],[{charge:.25},4.29,'pressure-balance'],[{charge:0},0,'no-charge'],[{pickup:1},2.88,'pickup-exposed'],[{pickup:2},0,'dry-pickup'],[{water:3},2.79,'pickup-exposed']]) {
  const plan = cartridgeExtinguisherPlan(settings);eq(+(plan.delivered * 1000).toFixed(2), delivered);eq(plan.reason, reason);
}
const controller = createCartridgeExtinguisherController();controller.advance(8);
const saved = controller.getState();
for (const invalid of [null, [], false, 'bad', {water: 5}, {water: NaN}, {charge: .5}, {charge: Infinity}, {pickup: -1}, {unknown: 4}]) {controller.update(invalid);eq(controller.getState(), saved);}
for (const invalid of [null, false, -1, '1', NaN, Infinity]) {controller.advance(invalid);eq(controller.getState(), saved);}
controller.update({...saved.values});eq(controller.getState(), saved);
const exposed = controller.getState();exposed.values.water = 100;exposed.now.water = 999;eq(controller.getState(), saved);
controller.update({water: 6});eq(controller.getState().clock, 0);eq(controller.getState().now.delivered, 0);
for (const checkpoint of ['ready', 'midway']) {
  controller.reset({settings:{water:9,charge:.25,pickup:0},checkpoint});const start = controller.getState();
  eq(start.clock > 0, checkpoint === 'midway');controller.advance(1e6);const done = controller.getState();ok(done.now.complete);
  controller.reset(controller.replayState());eq(controller.getState(), start);controller.advance(1e6);eq(controller.getState(), done);
}
for (const hz of [24, 30, 60, 120]) {
  controller.reset();for (let i = 0; i < hz * 5; i++) controller.advance(1 / hz);
  near(controller.getState().clock, 5);near(controller.getState().now.water, cartridgeExtinguisherAt(cartridgeExtinguisherPlan(), 5).water);
}
const plan = cartridgeExtinguisherPlan();eq(cartridgeExtinguisherPlan({}), plan);
for (const object of [FIRE_DEFAULTS, FIRE_OPTIONS, FIRE_OPTIONS.water, FIRE_SHAPE, P, plan, plan.values, plan.curve, plan.curve[0]]) ok(Object.isFrozen(object));
assert.throws(() => {plan.curve[0].water = 99;});
eq(fireSettings(null), FIRE_DEFAULTS);eq(cartridgeExtinguisherAt(plan, NaN).clock, 0);eq(cartridgeExtinguisherAt(plan, -1).clock, 0);
console.log(JSON.stringify({status:'PASS', checks, combinations, samples, timedRuns, outcomes}));

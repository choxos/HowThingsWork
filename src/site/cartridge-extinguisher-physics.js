// A finite, isothermal gas charge drives an ideal water path. This is a
// teaching experiment, not a fit to a commercial extinguisher's performance.
const frozen = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
};
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export const FIRE_DEFAULTS = frozen({water: 9, charge: 1, pickup: 0});
export const FIRE_DOMAINS = frozen({water: [3, 9, 3], charge: [0, 1, .25], pickup: [0, 2, 1]});
export const FIRE_OPTIONS = frozen({
  water: [{value: 3, label: '3 liters'}, {value: 6, label: '6 liters'}, {value: 9, label: '9 liters'}],
  charge: [{value: 0, label: 'No charge'}, {value: .25, label: 'Quarter charge'}, {value: 1, label: 'Full charge'}],
  pickup: [{value: 0, label: 'Near the floor'}, {value: 1, label: 'Halfway up'}, {value: 2, label: 'Above the water'}],
});
export const FIRE_SHAPE = frozen({
  radius: .84, height: 3.2, wall: .055,
  cartridge: {x: -.25, z: 0, radius: .18, bottom: 1.16, shoulder: 2.84, neck: .075, top: 3.125, wall: .018, base: .035, shoulderDepth: .04, bore: .044},
  tube: {x: .35, z: 0, radius: .068, bore: .038},
  pickup: [.055, 1.6, 2.7], nozzleHeight: 3.0, nozzleBore: .021,
  collector: {width: 2.45, depth: 2.1, bottom: .055, height: 1.55},
});
export function fireSettings(input = {}, base = FIRE_DEFAULTS) {
  const result = {...base};
  for (const key of Object.keys(FIRE_DEFAULTS)) {
    const value = input?.[key];
    if (Number.isFinite(value) && FIRE_OPTIONS[key].some(option => option.value === value)) result[key] = value;
  }
  return result;
}

function geometricVolume(height, pickup) {
  const y = clamp(height, 0, FIRE_SHAPE.height), c = FIRE_SHAPE.cartridge, t = FIRE_SHAPE.tube;
  return Math.PI * (FIRE_SHAPE.radius ** 2 * y
    - c.radius ** 2 * clamp(y - c.bottom, 0, c.shoulder - c.bottom)
    - c.neck ** 2 * clamp(y - c.shoulder, 0, c.top - c.shoulder)
    - t.radius ** 2 * Math.max(0, y - FIRE_SHAPE.pickup[pickup]));
}
// The near-floor arrangement has 12 L of free tank volume. Other tube lengths
// displace slightly less. The scale is schematic, with no product dimensions.
export const FIRE_VOLUME_SCALE = .012 / geometricVolume(FIRE_SHAPE.height, 0);
export const FIRE_LENGTH_SCALE = Math.cbrt(FIRE_VOLUME_SCALE);
const C = FIRE_SHAPE.cartridge;
const cartridgeVolume = Math.PI * ((C.radius - C.wall) ** 2 * (C.shoulder - C.shoulderDepth - C.bottom - C.base)
  + C.bore ** 2 * (C.top - C.shoulder + C.shoulderDepth)) * FIRE_VOLUME_SCALE;
export const FIRE_PHYSICS = frozen({
  atmosphere: 101325, density: 1000, gravity: 9.80665,
  chargePV: 1800, cartridgeVolume, outletArea: Math.PI * (FIRE_SHAPE.nozzleBore * FIRE_LENGTH_SCALE) ** 2,
  releaseTime: 3, pressTime: 4, playbackRate: 2, samples: 1024,
});
export function fireVolumeBelow(height, pickup = 0) {
  return geometricVolume(height, pickup) * FIRE_VOLUME_SCALE;
}
export function fireLevel(volume, pickup = 0) {
  let lo = 0, hi = FIRE_SHAPE.height;
  const bounded = clamp(volume, 0, fireVolumeBelow(hi, pickup));
  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2;
    if (fireVolumeBelow(mid, pickup) < bounded) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
export function fireAreaAt(height, pickup = 0) {
  const c = FIRE_SHAPE.cartridge;
  return Math.PI * (FIRE_SHAPE.radius ** 2
    - (height >= c.bottom && height < c.top ? (height < c.shoulder ? c.radius ** 2 : c.neck ** 2) : 0)
    - (height >= FIRE_SHAPE.pickup[pickup] ? FIRE_SHAPE.tube.radius ** 2 : 0)) * FIRE_LENGTH_SCALE ** 2;
}
export function firePressure(plan, water) {
  return plan.pv / (plan.capacity + FIRE_PHYSICS.cartridgeVolume - water);
}
export function fireDrivingPressure(plan, water) {
  const height = fireLevel(water, plan.values.pickup) * FIRE_LENGTH_SCALE;
  return firePressure(plan, water) - FIRE_PHYSICS.atmosphere
    - FIRE_PHYSICS.density * FIRE_PHYSICS.gravity * (FIRE_SHAPE.nozzleHeight * FIRE_LENGTH_SCALE - height);
}
export function fireWaterFlow(plan, water) {
  return FIRE_PHYSICS.outletArea * Math.sqrt(2 * Math.max(0, fireDrivingPressure(plan, water)) / FIRE_PHYSICS.density);
}

const plans = new Map();
export function cartridgeExtinguisherPlan(input = {}) {
  const values = fireSettings(input), key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const capacity = fireVolumeBelow(FIRE_SHAPE.height, values.pickup), initialWater = values.water / 1000;
  const gasVolume0 = capacity + FIRE_PHYSICS.cartridgeVolume - initialWater;
  const pv = FIRE_PHYSICS.atmosphere * gasVolume0 + values.charge * FIRE_PHYSICS.chargePV;
  const pickupHeight = FIRE_SHAPE.pickup[values.pickup], pickupWater = fireVolumeBelow(pickupHeight, values.pickup);
  const plan = {values, capacity, initialWater, gasVolume0, pv, pickupHeight, pickupWater};
  let balanceWater = 0;
  if (fireDrivingPressure(plan, initialWater) <= 0) balanceWater = initialWater;
  else if (fireDrivingPressure(plan, 0) < 0) {
    let lo = 0, hi = initialWater;
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2;
      if (fireDrivingPressure(plan, mid) < 0) lo = mid; else hi = mid;
    }
    balanceWater = (lo + hi) / 2;
  }
  const stopWater = Math.min(initialWater, Math.max(pickupWater, balanceWater));
  const dry = pickupWater >= initialWater - 1e-12;
  const reason = !values.charge ? 'no-charge' : dry ? 'dry-pickup'
    : balanceWater > pickupWater ? 'pressure-balance' : 'pickup-exposed';
  const curve = [{time: 0, water: initialWater, u: Math.sqrt(Math.max(0, initialWater - balanceWater))}];
  if (stopWater < initialWater - 1e-12) {
    // u = sqrt(W - W_balance) removes the integrable endpoint singularity
    // when flow stops at pressure balance. Integrate dt = 2u du / Q(W).
    const u0 = curve[0].u, u1 = Math.sqrt(Math.max(0, stopWater - balanceWater));
    const derivativeAtBalance = pv / (capacity + FIRE_PHYSICS.cartridgeVolume - balanceWater) ** 2
      + FIRE_PHYSICS.density * FIRE_PHYSICS.gravity / fireAreaAt(fireLevel(balanceWater, values.pickup), values.pickup);
    const integrand = u => {
      if (u < 1e-8 && balanceWater > 0) return 2 / (FIRE_PHYSICS.outletArea * Math.sqrt(2 * derivativeAtBalance / FIRE_PHYSICS.density));
      const flow = fireWaterFlow(plan, balanceWater + u * u);
      return flow > 0 ? 2 * u / flow : 0;
    };
    const nodes = Array.from({length: FIRE_PHYSICS.samples + 1}, (_, i) => u0 + (u1 - u0) * i / FIRE_PHYSICS.samples);
    for (const y of [FIRE_SHAPE.cartridge.bottom, FIRE_SHAPE.cartridge.shoulder, pickupHeight]) {
      const water = fireVolumeBelow(y, values.pickup);
      if (water > stopWater && water < initialWater) nodes.push(Math.sqrt(water - balanceWater));
    }
    nodes.sort((a, b) => b - a);
    let time = 0;
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i];
      if (a - b < 1e-14) continue;
      time += (a - b) * (integrand(a) + 4 * integrand((a + b) / 2) + integrand(b)) / 6;
      curve.push({time, water: balanceWater + b * b, u: b});
    }
  }
  const dischargeTime = curve.at(-1).time;
  Object.assign(plan, {balanceWater, stopWater, reason, curve, dischargeTime,
    duration: FIRE_PHYSICS.releaseTime + dischargeTime,
    initialPressure: firePressure(plan, initialWater), finalPressure: firePressure(plan, stopWater),
    delivered: initialWater - stopWater});
  frozen(plan);plans.set(key, plan);return plan;
}

export function cartridgeExtinguisherAt(plan, time) {
  const clock = Number.isFinite(time) ? clamp(time, 0, plan.duration) : 0;
  const released = clock >= FIRE_PHYSICS.releaseTime;
  const complete = clock >= plan.duration;
  let water = plan.initialWater;
  if (released && plan.dischargeTime > 0) {
    const elapsed = clock - FIRE_PHYSICS.releaseTime;
    if (elapsed === 0) water = plan.initialWater;
    else if (complete) water = plan.stopWater;
    else {
      let lo = 0, hi = plan.curve.length - 1;
      while (hi - lo > 1) {const mid = (lo + hi) >> 1;if (plan.curve[mid].time <= elapsed) lo = mid;else hi = mid;}
      const a = plan.curve[lo], b = plan.curve[hi], mix = (elapsed - a.time) / (b.time - a.time);
      const u = a.u + mix * (b.u - a.u);water = plan.balanceWater + u * u;
    }
  }
  const pressure = released ? firePressure(plan, water) : FIRE_PHYSICS.atmosphere;
  const flow = released && !complete ? fireWaterFlow(plan, water) : 0;
  const level = fireLevel(water, plan.values.pickup);
  const phase = clock === 0 ? 'ready' : !released ? 'squeezing' : complete ? plan.reason : 'water';
  return {clock, released, complete, phase, water, delivered: plan.initialWater - water,
    level, pressure, gauge: pressure - FIRE_PHYSICS.atmosphere,
    gasVolume: plan.capacity + (released ? FIRE_PHYSICS.cartridgeVolume : 0) - water,
    flow, speed: flow / FIRE_PHYSICS.outletArea,
    handle: clamp(clock / FIRE_PHYSICS.pressTime, 0, 1),
    pickupWet: water > plan.pickupWater};
}

export function createCartridgeExtinguisherController() {
  let values = {...FIRE_DEFAULTS}, plan = cartridgeExtinguisherPlan(values), clock = 0, checkpoint = 'ready';
  const getState = () => ({values: {...values}, clock, duration: plan.duration, capacity: plan.capacity,
    initialWater: plan.initialWater, initialPressure: plan.initialPressure, finalPressure: plan.finalPressure,
    pv: plan.pv, stopWater: plan.stopWater, reason: plan.reason, now: cartridgeExtinguisherAt(plan, clock)});
  const update = (input = {}) => {
    const next = fireSettings(input, values);
    if (Object.keys(values).some(key => next[key] !== values[key])) {values = next;plan = cartridgeExtinguisherPlan(values);clock = 0;checkpoint = 'ready';}
    return getState();
  };
  const reset = (initial = {}) => {
    values = fireSettings(initial?.settings);plan = cartridgeExtinguisherPlan(values);
    checkpoint = initial?.checkpoint === 'midway' ? 'midway' : 'ready';
    clock = checkpoint === 'midway' ? FIRE_PHYSICS.releaseTime + plan.dischargeTime / 2 : 0;
    return getState();
  };
  const advance = seconds => {if (Number.isFinite(seconds) && seconds > 0) clock = Math.min(plan.duration, clock + seconds);return getState();};
  const replayState = () => ({settings: {...values}, checkpoint});
  return {getState, update, reset, advance, replayState};
}

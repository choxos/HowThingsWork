import {validateControls, validTime} from './physics-kit.js';

// Friction-drive toy: a toy car whose rear wheels turn a small steel flywheel
// through a gear train. Pressed down and pushed along the floor, the toy spins
// its flywheel up; let go, the flywheel drives it on.
//
// Units: SI inside. Readings convert to millimeters, rpm, joules and seconds.
//
// The toy weighs 120 g and runs on wheels 30 mm across. Its rear wheels drive a
// steel flywheel 20 mm across and 4 mm thick (I = rho pi R^4 t / 2) through two
// gear stages, 6, 12 or 24 times as fast as the wheels. Turning with the wheels,
// the flywheel feels at the wheel rims like an extra mass I N^2 / r^2. The gears
// pass on 80% of the power, whichever way it flows, and the flywheel's bearings
// resist with a steady 40 µN m. Speeds of the flywheel are also given "in toy
// terms": the rim speed of wheels it would turn, omega r / N.
//
// Pushing. Each push starts the toy from rest on the floor and speeds it up
// evenly over 150 mm to the push speed while the hand presses down; the rear
// wheels carry half the toy's weight and half the press. At each touchdown the
// flywheel's wheels already turn: they skid ahead of the hand until it catches
// up. From then on the floor turns the flywheel, gripping when static friction,
// up to mu_s times the load, can supply the force the flywheel needs, and
// otherwise skidding with kinetic friction mu_k times the load. At the end of a
// push the hand lifts the toy and carries it back in 0.3 s while the flywheel
// spins on against its bearings.
//
// Letting go: after the last push, either set the toy down still, or let go of
// it at the end of the push while it moves at the push speed. While the wheels'
// rim speed and the toy's speed differ, the wheels skid; then they roll
// together and the toy slows evenly from rolling resistance, c_rr times its
// weight, and the bearings felt through the gears. Whether the flywheel drives
// the toy or the toy's own motion keeps the flywheel turning decides which way
// the gears lose their 20%.
//
// Floor stages have constant accelerations. Each airborne return is a prescribed
// cubic horizontal path and a smooth vertical lift. The hand changes the body's
// kinetic and potential energy while the flywheel coasts against its bearings.
// Their exact integrals keep one continuous energy ledger through every phase.
// Wheel/gear inertia other than the flywheel, air drag, bouncing, steering and
// pitch/load transfer are omitted. Both axles carry half the assigned normal load.

export const TOY = Object.freeze({mass: 0.12, wheel: 0.015, flywheel: Object.freeze({radius: 0.01, thickness: 0.004, density: 7850}), efficiency: 0.8, bearing: 4e-5, stroke: 0.15, back: 0.3, lift: 0.02, g: 9.81});
export const FLOORS = Object.freeze([
  Object.freeze({value: 0, label: 'Tiles', grip: 0.5, skid: 0.4, rolling: 0.02}),
  Object.freeze({value: 1, label: 'Wooden floor', grip: 0.8, skid: 0.7, rolling: 0.03}),
  Object.freeze({value: 2, label: 'Carpet', grip: 1.0, skid: 0.9, rolling: 0.12}),
]);
export const RATIOS = Object.freeze([6, 12, 24]);
/** Tooth counts of the two stages for each ratio, [driving gear, driven pinion], the bigger step first so the middle shaft's gear clears the rear axle. */
export const GEARS = Object.freeze({6: Object.freeze([[24, 8], [16, 8]]), 12: Object.freeze([[32, 8], [24, 8]]), 24: Object.freeze([[48, 8], [32, 8]])});
export const RATIO_OPTIONS = Object.freeze(RATIOS.map((ratio, value) => Object.freeze({value, label: `${ratio} to 1`})));
export const RELEASE_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'Set it down still'}), Object.freeze({value: 1, label: 'Release while moving'})]);
export const TOY_DEFAULTS = Object.freeze({speed: 1.5, pushes: 3, press: 4, gearing: 1, floor: 1, release: 0});
export const TOY_DOMAINS = Object.freeze({speed: [0.5, 2.5, 0.25], pushes: [1, 6, 1], press: [0, 20, 2], gearing: [0, 2, 1], floor: [0, 2, 1], release: [0, 1, 1]});

export const flywheelInertia = () => TOY.flywheel.density * Math.PI * TOY.flywheel.radius ** 4 * TOY.flywheel.thickness / 2;
/** The flywheel felt at the wheel rims as extra mass, kg. */
export const feltMass = ratio => flywheelInertia() * ratio * ratio / TOY.wheel ** 2;
export const rpmOf = (rimSpeed, ratio) => rimSpeed / TOY.wheel * ratio * 60 / (2 * Math.PI);

const cache = new Map();

export function toyPlan(input = {}) {
  const values = validateControls(input, TOY_DEFAULTS, TOY_DOMAINS, 'friction-drive toy');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const {speed: V, pushes, press, gearing, floor, release} = values;
  const N = RATIOS[gearing], ground = FLOORS[floor], m = TOY.mass, g = TOY.g, eta = TOY.efficiency;
  const felt = feltMass(N), bearing = TOY.bearing * N / TOY.wheel, rolling = ground.rolling * m * g;
  const phases = [], energy = {hand: 0, skid: 0, gears: 0, bearing: 0, rolling: 0}, lifts = [];
  let t = 0, x = 0, u = 0, turned = 0, frontTurned = 0;
  const add = phase => {
    const record = {...phase, t0: t, x0: x, turned0: turned, frontTurned0: frontTurned, energy0: {...energy}, onFloor: phase.kind !== 'lifted'};
    phases.push(record);
    const end = phaseAt({felt, bearing, rolling}, record, record.d);
    Object.assign(energy, end.energy);
    t += record.d; x = end.x; u = end.u; turned = end.turned; frontTurned = end.frontTurned;
    return record;
  };
  const params = {N, felt, bearing, rolling, eta, V, A: V * V / (2 * TOY.stroke), T: 2 * TOY.stroke / V};
  const pushLoad = (m * g + press) / 2, need = (felt * params.A + bearing) / eta, supply = ground.grip * pushLoad, grips = need <= supply;
  const pushSpeeds = [];

  for (let k = 0; k < pushes; k++) {
    const stage = `Push ${k + 1}`, {A, T} = params;
    // At touchdown the wheels skid ahead of the hand until it catches up.
    const slowing = (ground.skid * pushLoad / eta + bearing) / felt, catchUp = Math.min(T, u / (A + slowing));
    if (catchUp > 0) add({kind: 'pushing', stage, d: catchUp, v0: 0, av: A, u0: u, au: -slowing, force: ground.skid * pushLoad, drive: 'flywheel', hand: m * A + rolling - ground.skid * pushLoad, load: pushLoad, press});
    // Then the floor drives the flywheel, gripping if it can.
    const rest = T - catchUp, start = A * catchUp;
    if (rest > 0) {
      if (grips) add({kind: 'pushing', stage, d: rest, v0: start, av: A, u0: start, au: A, force: need, drive: 'floor', hand: m * A + rolling + need, load: pushLoad, press});
      else add({kind: 'pushing', stage, d: rest, v0: start, av: A, u0: u, au: (eta * ground.skid * pushLoad - bearing) / felt, force: ground.skid * pushLoad, drive: 'floor', hand: m * A + rolling + ground.skid * pushLoad, load: pushLoad, press});
    }
    pushSpeeds.push(u);
    const last = k === pushes - 1;
    if (last && release === 1) break;
    lifts.push(t);
    add({kind: 'lifted', stage: last ? 'Lift and set down' : `Carrying back ${k + 1}`, d: TOY.back, v0: V, u0: u, au: -bearing / felt, x1: last ? x : 0, force: 0, drive: 'none', hand: 0, load: 0, press: 0});
  }

  // Let go.
  const releaseAt = {t, x, v: release === 1 ? V : 0, u, energy: energy.hand};
  const load = m * g / 2, stored = felt * u * u / 2;
  let v = releaseAt.v;
  if (u > v + 1e-12) {
    const av = (ground.skid * load - rolling) / m, au = -(ground.skid * load / eta + bearing) / felt;
    add({kind: 'skidding', stage: 'Skidding as it starts', d: (u - v) / (av - au), v0: v, av, u0: u, au, force: ground.skid * load, drive: 'flywheel', hand: 0, load, press: 0});
    v = u;
  } else if (v > u + 1e-12) {
    const av = -(ground.skid * load + rolling) / m, au = (eta * ground.skid * load - bearing) / felt;
    add({kind: 'skidding', stage: 'Skidding as it starts', d: (v - u) / (au - av), v0: v, av, u0: u, au, force: ground.skid * load, drive: 'floor', hand: 0, load, press: 0});
    v = u;
  } else u = v;
  const launch = {t, x, v};
  // Roll together to a stop. The flywheel drives the toy when its own slowing
  // alone would take more than its bearing does.
  const byFlywheel = -(rolling + eta * bearing) / (m + eta * felt), byToy = -(rolling + bearing / eta) / (m + felt / eta);
  const flywheelDrives = -felt * byFlywheel >= bearing, a = flywheelDrives ? byFlywheel : byToy, push = m * a + rolling;
  if (v > 0) add({kind: 'rolling', stage: 'Rolling on', d: v / -a, v0: v, av: a, u0: v, au: a, force: Math.abs(push), drive: push >= 0 ? 'flywheel' : 'floor', hand: 0, load, press: 0});

  const plan = {
    values, ratio: N, gears: GEARS[N], floor: ground, phases, lifts, duration: t, energy: {...energy}, params,
    pushLoad, need, supply, grips, pushSpeeds, releaseAt, stored, launch, deceleration: -a, flywheelDrives,
    stop: {t, x}, rolled: x - releaseAt.x, alone: release === 1 ? V * V / (2 * ground.rolling * g) : 0,
    whirr: releaseAt.u * felt / bearing, rpm: rpmOf(releaseAt.u, N), felt, bearing, rolling,
  };
  if (cache.size > 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** Exact hand-guided path: match the final push speed, lift, and touch down at rest. */
export function carryPose(phase, elapsed) {
  const s = Math.max(0, Math.min(phase.d, elapsed)), q = s / phase.d, d = phase.d;
  const delta = phase.x1 - phase.x0, a = 3 * delta - 2 * phase.v0 * d, b = -2 * delta + phase.v0 * d;
  const x = phase.x0 + phase.v0 * s + a * q * q + b * q * q * q;
  const v = phase.v0 + (2 * a * q + 3 * b * q * q) / d;
  const height = TOY.lift * Math.sin(Math.PI * q) ** 2;
  const vy = TOY.lift * Math.PI / d * Math.sin(2 * Math.PI * q);
  return {x, v, height, vy};
}

/** Integrate a recorded phase, including hand work while the toy is carried. */
export function phaseAt(plan, phase, elapsed) {
  const s = Math.max(0, Math.min(phase.d, elapsed)), {v0, av = 0, u0, au} = phase;
  const spinning = au < 0 ? Math.min(s, u0 / -au) : s;
  const du = u0 * spinning + au * spinning * spinning / 2, u = Math.max(0, u0 + au * s);
  const dx = v0 * s + av * s * s / 2, pose = phase.onFloor ? {x: phase.x0 + dx, v: v0 + av * s, height: 0, vy: 0} : carryPose(phase, s);
  const energy = {...phase.energy0}, motion = TOY.mass * (pose.v ** 2 + pose.vy ** 2) / 2, potential = TOY.mass * TOY.g * pose.height;
  if (phase.onFloor) {
    energy.rolling += plan.rolling * dx;
    energy.skid += phase.force * Math.abs(du - dx);
    energy.gears += phase.force * (phase.drive === 'floor' ? 1 - TOY.efficiency : 1 / TOY.efficiency - 1) * du;
    energy.hand += phase.hand * dx;
  } else energy.hand += motion + potential - TOY.mass * phase.v0 ** 2 / 2;
  energy.bearing += plan.bearing * du;
  return {...pose, u, energy, motion, potential, flywheel: plan.felt * u * u / 2, turned: phase.turned0 + du, frontTurned: phase.frontTurned0 + (phase.onFloor ? dx : phase.v0 * s), frontRimSpeed: phase.onFloor ? pose.v : phase.v0};
}

/** Continuous state from the recorded floor and carry phases. */
export function toyAt(plan, time) {
  validTime(time);
  const clock = Math.max(0, Math.min(plan.duration, time));
  let phase = plan.phases[0];
  for (const candidate of plan.phases) if (candidate.t0 <= clock) phase = candidate;
  const state = phaseAt(plan, phase, clock - phase.t0), complete = clock >= plan.duration, ready = clock === 0;
  return {
    ...state, clock, phase, complete, stage: complete ? 'Stopped' : ready ? 'Ready' : phase.stage, kind: complete ? 'stopped' : ready ? 'ready' : phase.kind,
    skidding: !complete && !ready && phase.onFloor && Math.abs(state.u - state.v) > 1e-9,
    rpm: rpmOf(state.u, plan.ratio), press: complete ? 0 : phase.press, force: complete || ready ? 0 : phase.force, drive: complete || ready ? 'none' : phase.drive,
    frontRimSpeed: complete ? 0 : state.frontRimSpeed,
  };
}

export function sampleToy(input = {}, time = 0) {
  validTime(time);
  const plan = toyPlan(input);
  return {...plan, now: toyAt(plan, time)};
}

import {validateControls, validTime, clamp} from './physics-kit.js';

// Beaters: the egg whisk and the electric mixer turn the same kind of beater in
// the same mixtures, one by hand through bevel gears, one by motor through a
// worm gear.
//
// Units: SI inside. Readings convert to rpm, newtons, degrees Celsius.
//
// The mixture's drag. A beater D across turning n times a second takes power
//   P = Kp mu n^2 D^3 + Np rho n^3 D^5,
// the laminar term, which dominates in thick mixtures, plus the turbulent term,
// which dominates in thin ones. This is the standard shape of an impeller's
// power curve, with Kp = 50 and Np = 1.5 as teaching values for a wire beater.
// The torque on one beater is P / (2 pi n). In a thick mixture it is nearly
// proportional to speed, so a gear that turns the beaters G times faster makes
// the hand's torque about G squared times larger.
//
// Egg whisk. The crank turns a crown wheel; two bevel pinions on opposite faces
// of it turn the beaters Zc / Zp times as fast, in opposite directions. The
// hand works through gears 95 percent efficient. It tries a crank rate, but if
// that needs more than its force limit at the 60 mm crank, it slows to the rate
// its force can hold.
//
// Electric mixer: a permanent-magnet DC teaching motor drives two worm wheels.
// Voltage, back EMF, copper heating and torque share the same motor constants.
// The worm's actual lead and normal pressure angle determine sliding efficiency.
// Motor temperature follows one lumped heat capacity; its illustrative cutout
// latches open at an 80 K rise. Gear heat and fan work leave outside this node.
//
// Not modeled: foam changing as it is whipped, the beaters' own inertia on the
// whisk, backlash, motor start-up surges, and a universal motor's real curve.

const TAU = Math.PI * 2;

export const MIXTURES = Object.freeze([
  Object.freeze({value: 0, label: 'Water', viscosity: 0.001, density: 1000}),
  Object.freeze({value: 1, label: 'Raw egg whites', viscosity: 0.02, density: 1035}),
  Object.freeze({value: 2, label: 'Soft peaks', viscosity: 5, density: 400}),
  Object.freeze({value: 3, label: 'Stiff peaks', viscosity: 30, density: 200}),
  Object.freeze({value: 4, label: 'Cookie dough', viscosity: 1000, density: 1200}),
]);
export const BEATER = Object.freeze({diameter: 0.052, laminar: 50, turbulent: 1.5});

/** Power taken by one beater turning n revolutions a second. */
export function beaterPower(mixture, n) {
  const {viscosity, density} = MIXTURES[mixture], D = BEATER.diameter;
  return n > 0 ? BEATER.laminar * viscosity * n * n * D ** 3 + BEATER.turbulent * density * n ** 3 * D ** 5 : 0;
}
export const beaterTorque = (mixture, n) => n > 0 ? beaterPower(mixture, n) / (TAU * n) : 0;
export const reynolds = (mixture, n) => MIXTURES[mixture].density * n * BEATER.diameter ** 2 / MIXTURES[mixture].viscosity;

/** Bisection for the rate in [0, hi] where an increasing function reaches a value. */
function solveIncreasing(f, target, hi) {
  let lo = 0;
  if (f(hi) <= target) return hi;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) > target) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Egg whisk.

export const WHISK_GEARS = Object.freeze([
  Object.freeze({value: 0, label: '36-tooth crown, 12-tooth pinions', crown: 36, pinion: 12}),
  Object.freeze({value: 1, label: '48-tooth crown, 12-tooth pinions', crown: 48, pinion: 12}),
  Object.freeze({value: 2, label: '60-tooth crown, 12-tooth pinions', crown: 60, pinion: 12}),
]);
export const WHISK_DEFAULTS = Object.freeze({rate: 1.5, gear: 1, mixture: 2, force: 12});
export const WHISK_DOMAINS = Object.freeze({rate: [0.5, 3, 0.25], gear: [0, 2, 1], mixture: [0, 4, 1], force: [2, 30, 1]});
export const WHISK = Object.freeze({crank: 0.06, efficiency: 0.95, duration: 8});

export function eggWhiskPlan(input = {}) {
  const values = validateControls(input, WHISK_DEFAULTS, WHISK_DOMAINS, 'egg whisk');
  const gear = WHISK_GEARS[values.gear], G = gear.crown / gear.pinion;
  const handTorqueAt = n => 2 * G * beaterTorque(values.mixture, G * n) / WHISK.efficiency;
  const handForceAt = n => handTorqueAt(n) / WHISK.crank;
  const rate = solveIncreasing(handForceAt, values.force, values.rate);
  const limited = rate < values.rate - 1e-9;
  const beaterRate = G * rate, beater = beaterTorque(values.mixture, beaterRate), handTorque = handTorqueAt(rate);
  return {
    values, gear, G, rate, limited, beaterRate, beaterTorque: beater, handTorque, handForce: handTorque / WHISK.crank,
    handPower: handTorque * TAU * rate, beaterPower: beaterPower(values.mixture, beaterRate), reynolds: reynolds(values.mixture, beaterRate),
    wantedForce: handForceAt(values.rate), handForceAt,
  };
}

export function sampleEggWhisk(input = {}, time = 0) {
  validTime(time);
  const plan = eggWhiskPlan(input), elapsed = Math.min(WHISK.duration, time);
  const crankAngle = TAU * plan.rate * elapsed, beaterAngle = plan.G * crankAngle;
  return {...plan, elapsed, crankAngle, beaterAngle, crankTurns: crankAngle / TAU, beaterTurns: beaterAngle / TAU, work: plan.handPower * elapsed, mode: elapsed === 0 ? 'ready' : plan.limited ? 'limited' : 'beating', complete: elapsed >= WHISK.duration};
}

// ---------------------------------------------------------------------------
// Electric mixer.

export const WORM_WHEELS = Object.freeze([
  Object.freeze({value: 20, label: '20-tooth worm wheels'}),
  Object.freeze({value: 30, label: '30-tooth worm wheels'}),
  Object.freeze({value: 40, label: '40-tooth worm wheels'}),
]);
export const MIXER_DEFAULTS = Object.freeze({setting: 3, mixture: 3, wheel: 30, fan: 1, minutes: 4});
export const MIXER_DOMAINS = Object.freeze({setting: [1, 5, 1], mixture: [0, 4, 1], wheel: [20, 40, 10], fan: [0, 1, 1], minutes: [1, 10, 1]});
export const MOTOR = Object.freeze({
  voltage: 24, noLoad: 15000 * TAU / 60, stall: 0.6,
  torqueConstant: 24 / (15000 * TAU / 60),
  resistance: 24 * (24 / (15000 * TAU / 60)) / 0.6,
  friction: 0.004, ironDrag: 0.02 / (15000 * TAU / 60), fanDrag: 3e-9,
  frictionCoefficient: 0.1, baseConductance: 0.5, fanConductance: 2.5,
  heatCapacity: 240, limit: 80, heatRate: 20, rotationSlow: 1200,
});

export function wormDimensions(teeth) {
  if (![20, 30, 40].includes(teeth)) throw new RangeError('worm wheel must have 20, 30 or 40 teeth');
  const module = 32.5 / teeth, radius = 6, lead = Math.atan(module / (2 * radius));
  const normalPressure = 20 * Math.PI / 180;
  return {teeth, module, radius, lead, normalPressure, tangent: Math.tan(normalPressure) / Math.cos(lead),
    pitch: Math.PI * module, h: module / 2, center: 22.25, length: 30, width: 5,
    root: radius - 1.25 * module, tip: radius + module,
    wheelRoot: 16.25 - 1.25 * module, wheelTip: 16.25 + module};
}
export function wormEfficiency(teeth = 30) {
  const {lead, normalPressure} = wormDimensions(teeth);
  return Math.tan(lead) / Math.tan(lead + Math.atan(MOTOR.frictionCoefficient / Math.cos(normalPressure)));
}

export function mixerPlan(input = {}) {
  const values = validateControls(input, MIXER_DEFAULTS, MIXER_DOMAINS, 'electric mixer');
  const G = values.wheel, eta = wormEfficiency(G), share = values.setting / 5;
  const voltage = MOTOR.voltage * share, noLoad = MOTOR.noLoad * share, stall = MOTOR.stall * share;
  const motorTorque = w => MOTOR.torqueConstant * (voltage - MOTOR.torqueConstant * w) / MOTOR.resistance;
  const parasiticTorque = w => MOTOR.friction + MOTOR.ironDrag * w + (values.fan ? MOTOR.fanDrag * w * w : 0);
  const loadTorque = w => parasiticTorque(w) + 2 * beaterTorque(values.mixture, w / (TAU * G)) / (G * eta);
  let lo = 0, hi = noLoad;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (motorTorque(mid) > loadTorque(mid)) lo = mid; else hi = mid; }
  const speed = (lo + hi) / 2, torque = motorTorque(speed), current = torque / MOTOR.torqueConstant;
  const beaterRate = speed / (TAU * G), outputPower = 2 * beaterPower(values.mixture, beaterRate);
  const copper = current * current * MOTOR.resistance, iron = MOTOR.ironDrag * speed * speed;
  const bearingLoss = MOTOR.friction * speed, fanPower = values.fan ? MOTOR.fanDrag * speed ** 3 : 0;
  const loss = copper + iron + bearingLoss, inputPower = voltage * current, gearLoss = outputPower * (1 / eta - 1);
  const conductance = MOTOR.baseConductance + (values.fan ? MOTOR.fanConductance * speed / MOTOR.noLoad : 0);
  const steadyRise = loss / conductance, seconds = values.minutes * 60, timeConstant = MOTOR.heatCapacity / conductance;
  const unprotectedRise = steadyRise * -Math.expm1(-seconds / timeConstant);
  const cutout = steadyRise > MOTOR.limit ? -timeConstant * Math.log1p(-MOTOR.limit / steadyRise) : null;
  const overheated = cutout !== null && cutout <= seconds;
  const onTime = overheated ? cutout : seconds;
  const rise = overheated ? MOTOR.limit * Math.exp(-(seconds - onTime) * MOTOR.baseConductance / MOTOR.heatCapacity) : unprotectedRise;
  return {
    values, G, eta, share, voltage, noLoad, stall, speed, torque, current, rpm: speed * 60 / TAU,
    beaterRate, beaterTorque: beaterTorque(values.mixture, beaterRate), loadFraction: torque / stall,
    motorPower: torque * speed, inputPower, outputPower, gearLoss, fanPower, bearingLoss,
    copper, iron, loss, conductance, timeConstant, steadyRise, rise, unprotectedRise, overheated, cutout,
    seconds, onTime, reynolds: reynolds(values.mixture, beaterRate),
  };
}

export function sampleMixer(input = {}, time = 0) {
  validTime(time);
  const plan = mixerPlan(input), elapsed = Math.min(plan.seconds, time);
  const tripped = plan.cutout !== null && elapsed >= plan.cutout;
  const onTime = Math.min(elapsed, plan.cutout ?? Infinity), complete = elapsed >= plan.seconds;
  const running = elapsed > 0 && !tripped && !complete;
  const rise = tripped
    ? MOTOR.limit * Math.exp(-(elapsed - onTime) * MOTOR.baseConductance / MOTOR.heatCapacity)
    : plan.steadyRise * -Math.expm1(-elapsed / plan.timeConstant);
  const motorAngle = plan.speed * onTime;
  return {...plan, elapsed, onTime, rise, tripped, running, complete, motorAngle,
    beaterAngle: motorAngle / plan.G, motorTurns: motorAngle / TAU, beaterTurns: motorAngle / plan.G / TAU,
    speedNow: running ? plan.speed : 0, work: plan.outputPower * onTime,
    mode: elapsed === 0 ? 'ready' : tripped ? 'cutout' : complete ? 'finished' : 'running'};
}

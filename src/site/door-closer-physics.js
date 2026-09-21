import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// An overhead door closer: a spring that stores what the hand spends opening
// the door, a piston that pushes oil through two adjustable orifices on the way
// back, a back check that catches a door flung open, and a latch at the end
// that the spring either drives home or does not.
//
// Exact within the model: the door's moment of inertia about its hinge, m b²/3
// for a uniform leaf; the spring's moment, affine in the door angle, and the
// energy it stores, the integral of that moment; the pressure across an orifice
// passing the piston's flow, rho Q²/(2 Cd² A²), which makes the closer's
// resisting moment grow as the square of the door's speed; and the whole swing,
// opening and closing, integrated from Newton's second law for rotation.
//
// Sourced: BS EN 1154's table 1, power sizes 1 to 7 with their recommended
// maximum door leaf widths and test door masses, from the dhf Best Practice
// Guide; the maximum opening moment of a size 3 closer, 47 N.m over 0 to 60
// degrees, which DIN 18040 sets by reference to DIN EN 1154; the latch speed
// acting over the last 10 to 15 degrees of the arc and the sweep over the rest,
// from the Door closer page; a back check that answers beyond about 70 degrees,
// from dormakaba's TS 83 folder; a 1 and 1/2 inch piston with separate main and
// latch speed regulation valves, from LCN's 4040XP; an orifice discharge
// coefficient between 0.6 and 0.85 with Q = Cd A sqrt(2 dP / rho); mineral oil
// at 0.8 to 0.87 g/cm³; and standard gravity.
//
// Declared, not from a source: the spring's strength at every size other than
// 3, scaled from the sourced size 3 figure in proportion to that size's test
// door mass; the split of that moment between preload and rate, taken as half
// and half at 60 degrees, so the spring's force doubles over the first 60
// degrees of opening; a pinion pitch radius of 12 mm; the orifice the check
// valve leaves open while the door opens, and the back check orifice; a latch
// that needs 20 N at the leading edge over the last 5 degrees; the friction in
// the hinges and the closer's seals; the door stop at 120 degrees and what it
// absorbs; and the oil, taken as 870 kg/m³ with a discharge coefficient of
// 0.62, neither of which changes with temperature.
// ---------------------------------------------------------------------------

export const GRAVITY = 9.80665;

/**
 * BS EN 1154 table 1 as the dhf Best Practice Guide reproduces it: the door
 * closer power size, the recommended maximum door leaf width in mm, and the
 * test door mass in kg. Size 1's width is given there as under 750 mm.
 */
export const EN1154 = Object.freeze([
  Object.freeze({size: 1, width: 750, mass: 20}),
  Object.freeze({size: 2, width: 850, mass: 40}),
  Object.freeze({size: 3, width: 950, mass: 60}),
  Object.freeze({size: 4, width: 1100, mass: 80}),
  Object.freeze({size: 5, width: 1250, mass: 100}),
  Object.freeze({size: 6, width: 1400, mass: 120}),
  Object.freeze({size: 7, width: 1600, mass: 160}),
]);

/** The standard's own figures: a grade 3 closer closes from at least 105°, a grade 4 from 180°, a delayed action clears 120° in under 25 s, grade 8 is 500,000 cycles, and a fire door takes at least size 3. */
export const GRADES = Object.freeze({three: 105, four: 180, delayed: 120, delaySeconds: 25, cycles: 500000, fireSize: 3});

/** DIN 18040 sets the maximum opening moment of a size 3 closer, measured at the closer over an opening from 0 to 60 degrees, at 47 N.m by reference to DIN EN 1154. */
export const SIZE3 = Object.freeze({size: 3, moment: 47, angle: 60});

/** The closer, in SI: piston bore (LCN's 1 and 1/2 inch), pinion pitch radius, and the oil it pushes. */
export const CLOSER = Object.freeze({bore: 0.0381, pinion: 0.012, density: 870, discharge: 0.62});

/** Orifice diameters in mm that no control sets: the check valve's bypass while the door opens, and the back check. */
export const ORIFICES = Object.freeze({bypass: 3, backcheck: 0.7});

/** Angles in degrees: where the latch valve takes over from the sweep valve, where the back check answers, where the latch bolt meets its strike, the door stop, and the pair the accessibility rule times between. */
export const ANGLES = Object.freeze({latch: 12, backcheck: 70, engage: 5, stop: 120, from: 90, to: 12});

/** The latch bolt needs this force, N, at the leading edge of the leaf, over the last `ANGLES.engage` degrees. */
export const LATCH_FORCE = 20;

/** Hinge and seal friction, N.m, and the speed over which it is eased so a solver can cross zero. */
export const FRICTION = Object.freeze({hinge: 1.5, ease: 0.01});

/** The accessibility figures LCN's guide gives: at least 5 s from 90 degrees to 12 degrees from the latch, and no more than 5 lbf to open. */
export const ADA = Object.freeze({seconds: 5, pounds: 5, newtons: 5 * 4.4482216152605});

/** Integration step, trace sample interval, how long a finished run is held, and the safety cap, all in seconds. */
export const CLOCK = Object.freeze({step: 0.001, sample: 0.02, hold: 1.5, limit: 60, still: 0.01});

export const DOOR_OPTIONS = Object.freeze(EN1154.map(row => Object.freeze({value: row.size, label: `${row.width} mm, ${row.mass} kg`})));
export const SIZE_OPTIONS = Object.freeze(EN1154.map(row => Object.freeze({value: row.size, label: `EN ${row.size}`})));
export const CHECK_OPTIONS = Object.freeze([{value: 1, label: 'On, past 70 degrees'}, {value: 0, label: 'Switched off'}].map(Object.freeze));

export const DOOR_DEFAULTS = Object.freeze({door: 3, size: 3, sweep: 0.3, latch: 0.45, backcheck: 1, open: 80, push: 60});
export const DOOR_DOMAINS = Object.freeze({
  door: Object.freeze([1, 7, 1]), size: Object.freeze([1, 7, 1]), sweep: Object.freeze([0.15, 0.6, 0.05]),
  latch: Object.freeze([0.15, 0.9, 0.05]), backcheck: Object.freeze([0, 1, 1]), open: Object.freeze([30, 110, 10]), push: Object.freeze([25, 150, 5]),
});

export const RADIAN = Math.PI / 180;

/** The leaf of a door, treated as a uniform rod about the hinge: I = m b² / 3, with the width in meters. */
export const inertiaOf = (mass, width) => mass * width * width / 3;

/** The moment, N.m, that a closer of this power size makes at 60 degrees open. */
export const peakMomentOf = size => SIZE3.moment * EN1154[size - 1].mass / EN1154[SIZE3.size - 1].mass;

/** The moment the spring makes at the hinge, N.m, at a door angle in radians: half its 60 degree figure as preload and half as rate. */
export const springMoment = (size, theta) => { const peak = peakMomentOf(size); return peak / 2 + peak / 2 * theta / (SIZE3.angle * RADIAN); };

/** The energy the spring holds at a door angle, J: the integral of its moment from shut. */
export const springEnergy = (size, theta) => { const peak = peakMomentOf(size); return peak / 2 * theta + peak / 4 * theta * theta / (SIZE3.angle * RADIAN); };

/** Area of an orifice given in mm, m². */
export const orificeArea = millimeters => Math.PI * (millimeters * 1e-3) ** 2 / 4;
/** The piston's face area, m². */
export const pistonArea = () => Math.PI * CLOSER.bore * CLOSER.bore / 4;

/**
 * How much resisting moment the closer makes for each (rad/s)² of door speed,
 * N.m.s². The piston sweeps A_p r_p omega of oil a second, the orifice needs
 * rho Q² / (2 Cd² A²) to pass it, and that pressure acts back on the piston and
 * through the pinion.
 */
export const dampingOf = millimeters => {
  const area = orificeArea(millimeters), piston = pistonArea();
  return CLOSER.density * piston ** 3 * CLOSER.pinion ** 3 / (2 * CLOSER.discharge ** 2 * area * area);
};

/** The pressure across that orifice, Pa, at a door speed in rad/s. */
export const pressureOf = (omega, millimeters) => {
  const flow = pistonArea() * CLOSER.pinion * Math.abs(omega), area = orificeArea(millimeters);
  return CLOSER.density * flow * flow / (2 * CLOSER.discharge ** 2 * area * area);
};

/** Which orifice the oil goes through: the bypass or the back check while opening, the sweep or the latch valve while closing. */
export const orificeAt = (values, theta, opening) => {
  if (opening) return values.backcheck === 1 && theta >= ANGLES.backcheck * RADIAN ? ORIFICES.backcheck : ORIFICES.bypass;
  return theta <= ANGLES.latch * RADIAN ? values.latch : values.sweep;
};

/** What the latch bolt asks of the closer, N.m, on a leaf this wide in mm. */
export const latchMomentOf = width => LATCH_FORCE * width / 1000;

const plans = new Map();

function trajectory(values) {
  const leaf = EN1154[values.door - 1], inertia = inertiaOf(leaf.mass, leaf.width / 1000);
  const latchMoment = latchMomentOf(leaf.width), release = values.open * RADIAN, stop = ANGLES.stop * RADIAN, engage = ANGLES.engage * RADIAN;
  const {step, sample, hold, limit} = CLOCK, every = Math.round(sample / step);
  const damping = new Map();
  const coefficient = millimeters => { if (!damping.has(millimeters)) damping.set(millimeters, dampingOf(millimeters)); return damping.get(millimeters); };
  const opens = values.push > springMoment(values.size, 0) + FRICTION.hinge;

  const times = [], angles = [], rates = [], pressures = [];
  let theta = 0, omega = 0, steps = 0, time = 0, opening = true;
  let peak = 0, peakAt = null, handOff = null, hitStop = null, stopSpeed = 0, latchedAt = null, stalledAt = null, stalledAngle = null;
  let oilHeat = 0, frictionHeat = 0, latchWork = 0, handWork = 0, fromAt = null, toAt = null, fastest = 0, arrival = 0;

  const record = at => {
    times.push(at);
    angles.push(theta);
    rates.push(omega);
    pressures.push(pressureOf(omega, orificeAt(values, theta, opening)));
  };

  // The right hand side, with the hand's torque on only while it is pushing.
  const rate = (angle, speed, pushing, closing) => {
    const spring = springMoment(values.size, angle);
    const damp = coefficient(orificeAt(values, angle, pushing || speed > 0)) * speed * Math.abs(speed);
    const friction = FRICTION.hinge * Math.tanh(speed / FRICTION.ease);
    // The latch bolt resists the last few degrees at full strength or not at
    // all. Easing it toward zero speed would let a spring too weak to open the
    // bolt creep past it instead of stopping the door short.
    const latch = closing && angle <= engage && speed < 0 ? latchMoment : 0;
    return ((pushing ? values.push : 0) - spring - damp - friction + latch) / inertia;
  };

  record(0);
  if (opens) {
    while (time < limit) {
      const pushing = opening && theta < release;
      const closing = !opening;
      const a1 = rate(theta, omega, pushing, closing);
      const k2 = omega + step / 2 * a1, a2 = rate(theta + step / 2 * omega, k2, pushing, closing);
      const k3 = omega + step / 2 * a2, a3 = rate(theta + step / 2 * k2, k3, pushing, closing);
      const k4 = omega + step * a3, a4 = rate(theta + step * k3, k4, pushing, closing);
      const dTheta = step / 6 * (omega + 2 * k2 + 2 * k3 + k4);
      const dOmega = step / 6 * (a1 + 2 * a2 + 2 * a3 + a4);

      // Where the energy went over this step, by Simpson's rule across it, so
      // the audit closes even where the orifice changes partway through.
      const damp = (angle, speed) => Math.abs(coefficient(orificeAt(values, angle, pushing || speed > 0)) * speed * speed);
      const drag = (angle, speed) => Math.abs(FRICTION.hinge * Math.tanh(speed / FRICTION.ease));
      const simpson = fn => (fn(theta, omega) + 4 * fn(theta + dTheta / 2, omega + dOmega / 2) + fn(theta + dTheta, omega + dOmega)) / 6 * Math.abs(dTheta);
      oilHeat += simpson(damp);
      frictionHeat += simpson(drag);
      if (closing && theta <= engage && omega + dOmega / 2 < 0) latchWork += latchMoment * Math.abs(dTheta);
      if (pushing) handWork += values.push * dTheta;

      theta += dTheta;
      omega += dOmega;
      steps += 1;
      time = steps * step;
      if (pushing && theta >= release) handOff = time;

      if (opening) {
        if (theta >= stop) { theta = stop; hitStop = time; stopSpeed = Math.max(0, omega); omega = 0; opening = false; peak = stop; peakAt = time; }
        else if (omega <= 0) { omega = 0; opening = false; peak = theta; peakAt = time; }
        else peak = Math.max(peak, theta);
      } else {
        fastest = Math.max(fastest, -omega);
        if (fromAt === null && peak > ANGLES.from * RADIAN && theta <= ANGLES.from * RADIAN) fromAt = time;
        if (toAt === null && fromAt !== null && theta <= ANGLES.to * RADIAN) toAt = time;
        if (theta <= 0) { theta = 0; arrival = -omega; omega = 0; latchedAt = time; }
        else if (omega >= -CLOCK.still) {
          // All but stopped. It goes on only if the spring beats the latch and
          // the friction standing still, where neither of them is eased away.
          if (springMoment(values.size, theta) - FRICTION.hinge - (theta <= engage ? latchMoment : 0) <= 0) { omega = 0; stalledAt = time; stalledAngle = theta; }
        }
      }

      if (steps % every === 0) record(time);
      if (latchedAt !== null || stalledAt !== null) break;
    }
  }

  const ended = latchedAt ?? stalledAt ?? (opens ? time : 0);
  const duration = Math.min(limit, ended + hold);
  omega = 0;
  for (let at = (Math.floor(times.at(-1) / sample) + 1) * sample; at <= duration + 1e-9; at += sample) record(Number(at.toFixed(6)));

  return {
    leaf, inertia, latchMoment, release, opens, duration, ended, peak, peakAt, handOff, hitStop, stopSpeed,
    latchedAt, stalledAt, stalledAngle, oilHeat, frictionHeat, latchWork, handWork, fastest, arrival,
    sweepTime: fromAt !== null && toAt !== null ? toAt - fromAt : null,
    times: Object.freeze(times), angles: Object.freeze(angles), rates: Object.freeze(rates), pressures: Object.freeze(pressures),
  };
}

/** Everything about the door, the closer and the swing that does not change as the clock runs. */
export function doorPlan(input) {
  const values = validateControls(input, DOOR_DEFAULTS, DOOR_DOMAINS, 'door closer');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const run = trajectory(values);
  const plan = {
    values, ...run,
    size: values.size, rated: EN1154[values.size - 1],
    latchSpring: springMoment(values.size, 0),
    openingMoment: peakMomentOf(values.size),
    stopMoment: springMoment(values.size, ANGLES.stop * RADIAN),
    stored: springEnergy(values.size, run.peak),
    atRelease: springEnergy(values.size, run.release),
    sweepDamping: dampingOf(values.sweep), latchDamping: dampingOf(values.latch), checkDamping: dampingOf(ORIFICES.backcheck),
    edgeForce: peakMomentOf(values.size) / (run.leaf.width / 1000),
    stopLoss: run.hitStop === null ? 0 : run.inertia * run.stopSpeed * run.stopSpeed / 2,
    arrivalEnergy: run.inertia * run.arrival * run.arrival / 2,
    residual: springEnergy(values.size, run.stalledAngle ?? 0),
    peakPressure: run.pressures.reduce((most, one) => Math.max(most, one), 0),
    meetsRule: run.sweepTime === null ? null : run.sweepTime >= ADA.seconds,
    latched: run.latchedAt !== null,
    ajar: run.stalledAngle === null ? null : run.stalledAngle / RADIAN,
    peakDegrees: run.peak / RADIAN,
    fireRated: values.size >= GRADES.fireSize,
  };
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The door `time` seconds into the swing, read off the trace between its samples. */
export function doorAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), last = plan.times.length - 1;
  const i = Math.min(last, Math.max(0, Math.floor(t / CLOCK.sample + 1e-9))), j = Math.min(last, i + 1);
  const span = plan.times[j] - plan.times[i];
  const share = span > 0 ? clamp((t - plan.times[i]) / span) : 0;
  const theta = plan.angles[i] + (plan.angles[j] - plan.angles[i]) * share;
  const omega = plan.rates[i] + (plan.rates[j] - plan.rates[i]) * share;
  const pressure = plan.pressures[i] + (plan.pressures[j] - plan.pressures[i]) * share;
  const opening = plan.peakAt === null ? false : t < plan.peakAt;
  return {
    time, t, theta, omega, pressure, opening,
    degrees: theta / RADIAN, speed: -omega / RADIAN,
    pushing: opening && plan.opens && theta < plan.release,
    checking: opening && plan.values.backcheck === 1 && theta >= ANGLES.backcheck * RADIAN,
    latching: !opening && theta > 0 && theta <= ANGLES.latch * RADIAN,
    energy: springEnergy(plan.size, theta),
    moment: springMoment(plan.size, theta),
    orifice: orificeAt(plan.values, theta, opening),
    finished: plan.latchedAt !== null ? t >= plan.latchedAt : plan.stalledAt !== null ? t >= plan.stalledAt : !plan.opens,
    done: time >= plan.duration,
  };
}

export const sampleDoorCloser = (input, time = 0) => doorAt(doorPlan(input), time);

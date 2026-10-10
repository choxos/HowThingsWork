import {validateControls, validTime, clamp} from './physics-kit.js';

// Door dimensions and test masses follow the dhf guide; they are not equipment ratings.
// The direct shaft drive, linear spring, constant discharge coefficient and latch load
// are declared teaching assumptions. Spring levels do not certify EN power sizes.

export const EN1154 = Object.freeze([
  Object.freeze({size: 1, width: 750, mass: 20}),
  Object.freeze({size: 2, width: 850, mass: 40}),
  Object.freeze({size: 3, width: 950, mass: 60}),
  Object.freeze({size: 4, width: 1100, mass: 80}),
  Object.freeze({size: 5, width: 1250, mass: 100}),
  Object.freeze({size: 6, width: 1400, mass: 120}),
  Object.freeze({size: 7, width: 1600, mass: 160}),
]);

export const SPRING_REFERENCE = Object.freeze({size: 3, moment: 47, angle: 60});

/** The closer, in SI: piston bore (LCN's 1 and 1/2 inch), pinion pitch radius, and the oil it pushes. */
export const CLOSER = Object.freeze({bore: 0.0381, pinion: 0.012, density: 870, discharge: 0.62});

/** Orifice diameters in mm that no control sets: the check valve's bypass while the door opens, and the back check. */
export const ORIFICES = Object.freeze({bypass: 3, backcheck: 0.7});

/** Angles in degrees: where the latch valve takes over from the sweep valve, where the back check answers, where the latch bolt meets its strike, the door stop, and the pair used to compare the main closing sweep. */
export const ANGLES = Object.freeze({latch: 12, backcheck: 70, engage: 5, stop: 120, from: 90, to: 12});

/** The latch bolt needs this force, N, at the leading edge of the leaf, over the last `ANGLES.engage` degrees. */
export const LATCH_FORCE = 20;

/** Hinge and seal friction, N.m, and the speed over which it is eased so a solver can cross zero. */
export const FRICTION = Object.freeze({hinge: 1.5, ease: 0.01});

/** Integration step, trace sample interval, how long a finished run is held, and the safety cap, all in seconds. */
export const CLOCK = Object.freeze({step: 0.001, sample: 0.02, hold: 1.5, limit: 120, still: 0.001});

export const DOOR_OPTIONS = Object.freeze(EN1154.map(row => Object.freeze({value: row.size, label: `${row.width} mm, ${row.mass} kg`})));
export const SIZE_OPTIONS = Object.freeze(EN1154.map(row => Object.freeze({value: row.size, label: `Level ${row.size}`})));
export const CHECK_OPTIONS = Object.freeze([{value: 1, label: 'On, past 70 degrees'}, {value: 0, label: 'Switched off'}].map(Object.freeze));

export const DOOR_DEFAULTS = Object.freeze({door: 3, size: 3, sweep: 0.3, latch: 0.45, backcheck: 1, open: 80, push: 60});
export const DOOR_DOMAINS = Object.freeze({
  door: Object.freeze([1, 7, 1]), size: Object.freeze([1, 7, 1]), sweep: Object.freeze([0.15, 0.6, 0.05]),
  latch: Object.freeze([0.15, 0.9, 0.05]), backcheck: Object.freeze([0, 1, 1]), open: Object.freeze([30, 110, 10]), push: Object.freeze([25, 150, 5]),
});

export const RADIAN = Math.PI / 180;

/** The leaf of a door, treated as a uniform rod about the hinge: I = m b² / 3, with the width in meters. */
export const inertiaOf = (mass, width) => mass * width * width / 3;

/** The moment, N.m, that this declared spring level makes at 60 degrees open. */
export const peakMomentOf = size => SPRING_REFERENCE.moment * EN1154[size - 1].mass / EN1154[SPRING_REFERENCE.size - 1].mass;

/** The moment the spring makes at the hinge, N.m, at a door angle in radians: half its 60 degree figure as preload and half as rate. */
export const springMoment = (size, theta) => { const peak = peakMomentOf(size); return peak / 2 + peak / 2 * theta / (SPRING_REFERENCE.angle * RADIAN); };

/** The energy the spring holds at a door angle, J: the integral of its moment from shut. */
export const springEnergy = (size, theta) => { const peak = peakMomentOf(size); return peak / 2 * theta + peak / 4 * theta * theta / (SPRING_REFERENCE.angle * RADIAN); };

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
  const {step, sample, hold, limit} = CLOCK;
  const damping = new Map();
  const coefficient = millimeters => { if (!damping.has(millimeters)) damping.set(millimeters, dampingOf(millimeters)); return damping.get(millimeters); };
  const opens = values.push > springMoment(values.size, 0) + FRICTION.hinge;

  const times = [], angles = [], rates = [], pressures = [];
  let theta = 0, omega = 0, time = 0, opening = true;
  let peak = 0, peakAt = null, handOff = null, hitStop = null, stopSpeed = 0, latchedAt = null, stalledAt = null, stalledAngle = null;
  let oilHeat = 0, frictionHeat = 0, latchWork = 0, handWork = 0, fromAt = null, toAt = null, fastest = 0, arrival = 0;
  let releaseAngle = null, releaseReason = opens ? null : 'blocked', peakPressure = 0;

  const record = at => {
    times.push(at);
    angles.push(theta);
    rates.push(omega);
    const pressure = pressureOf(omega, orificeAt(values, theta, opening));
    pressures.push(pressure);
    peakPressure = Math.max(peakPressure, pressure);
  };
  const letGo = reason => {
    handOff = time;
    releaseAngle = theta;
    releaseReason = reason;
  };

  record(0);
  if (opens) {
    while (time < limit - 1e-10) {
      const pushing = opening && handOff === null;
      const latch = !opening && theta <= engage + 1e-10 ? latchMoment : 0;
      if (!opening && omega >= -CLOCK.still && springMoment(values.size, theta) - latch <= FRICTION.hinge) {
        frictionHeat += inertia * omega * omega / 2;
        omega = 0; stalledAt = time; stalledAngle = theta; record(time); break;
      }
      const diameter = orificeAt(values, theta + (opening ? 1e-10 : -1e-10), opening);
      const damp = coefficient(diameter);
      const rate = (angle, speed) => ((pushing ? values.push : 0) - springMoment(values.size, angle)
        - damp * speed * Math.abs(speed) - FRICTION.hinge * Math.tanh(speed / FRICTION.ease) + latch) / inertia;
      const integrate = h => {
        const a1 = rate(theta, omega);
        const w2 = omega + h * a1 / 2, a2 = rate(theta + h * omega / 2, w2);
        const w3 = omega + h * a2 / 2, a3 = rate(theta + h * w2 / 2, w3);
        const w4 = omega + h * a3, a4 = rate(theta + h * w3, w4);
        return {theta: theta + h * (omega + 2 * w2 + 2 * w3 + w4) / 6,
          omega: omega + h * (a1 + 2 * a2 + 2 * a3 + a4) / 6, speeds: [omega, w2, w3, w4]};
      };
      const nextSample = (Math.floor((time + 1e-10) / sample) + 1) * sample;
      // Keep each step inside one valve regime and below its viscous relaxation time.
      let h = Math.min(step, nextSample - time, limit - time, 0.1 * inertia / (damp * Math.max(0.01, Math.abs(omega))));
      const boundaries = opening ? [stop, ...(pushing ? [release] : []), ...(values.backcheck ? [ANGLES.backcheck * RADIAN] : [])]
        : [0, engage, ANGLES.latch * RADIAN, ANGLES.from * RADIAN];
      const ahead = boundaries.filter(angle => opening ? angle > theta + 1e-10 : angle < theta - 1e-10);
      const target = opening ? Math.min(...ahead) : Math.max(...ahead);
      let next = integrate(h), event = null;
      const root = crossed => {
        let lo = 0, hi = h;
        for (let i = 0; i < 36; i++) { const mid = (lo + hi) / 2; if (crossed(integrate(mid))) hi = mid; else lo = mid; }
        return hi;
      };
      if (Number.isFinite(target) && (opening ? next.theta >= target : next.theta <= target)) {
        h = root(state => opening ? state.theta >= target : state.theta <= target); next = integrate(h); event = 'angle';
      }
      if (opening ? omega > 0 && next.omega < 0 : omega < 0 && next.omega > 0) {
        h = root(state => opening ? state.omega <= 0 : state.omega >= 0); next = integrate(h); event = 'turn';
      }
      const weighted = fn => h * (fn(next.speeds[0]) + 2 * fn(next.speeds[1]) + 2 * fn(next.speeds[2]) + fn(next.speeds[3])) / 6;
      oilHeat += weighted(speed => damp * Math.abs(speed) ** 3);
      frictionHeat += weighted(speed => FRICTION.hinge * Math.tanh(speed / FRICTION.ease) * speed);
      const change = next.theta - theta;
      if (pushing) handWork += values.push * change;
      latchWork -= latch * change;
      theta = event === 'angle' ? target : next.theta;
      omega = event === 'turn' ? 0 : next.omega;
      time += h;
      peakPressure = Math.max(peakPressure, pressureOf(omega, diameter));
      peak = Math.max(peak, theta);
      fastest = Math.max(fastest, -omega);
      if (event) record(time);
      if (opening && pushing && event === 'angle' && target === release) letGo('target');
      if (opening && (event === 'turn' || theta >= stop)) {
        if (pushing && handOff === null) letGo('push-limit');
        if (theta >= stop) { hitStop = time; stopSpeed = Math.max(0, omega); }
        omega = 0; opening = false; peakAt = time; record(time);
      } else if (!opening) {
        if (fromAt === null && peak > ANGLES.from * RADIAN && theta <= ANGLES.from * RADIAN) fromAt = time;
        if (toAt === null && fromAt !== null && theta <= ANGLES.to * RADIAN) toAt = time;
        if (theta <= 0) { theta = 0; arrival = -omega; omega = 0; latchedAt = time; record(time); }
      }
      if (time >= nextSample - 1e-10) record(time);
      if (latchedAt !== null || stalledAt !== null) break;
    }
  }

  const ended = latchedAt ?? stalledAt ?? (opens ? time : 0);
  const limited = opens && latchedAt === null && stalledAt === null;
  const duration = ended + (limited ? 0 : hold);
  record(ended);
  if (!limited) { omega = 0; record(duration); }

  return {
    leaf, inertia, latchMoment, release, opens, duration, ended, peak, peakAt, handOff, hitStop, stopSpeed,
    latchedAt, stalledAt, stalledAngle, oilHeat, frictionHeat, latchWork, handWork, fastest, arrival,
    releaseAngle, releaseReason, peakPressure, limited, finalAngle: theta, finalSpeed: omega,
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
    size: values.size,
    latchSpring: springMoment(values.size, 0),
    openingMoment: peakMomentOf(values.size),
    stopMoment: springMoment(values.size, ANGLES.stop * RADIAN),
    stored: springEnergy(values.size, run.peak),
    atRelease: springEnergy(values.size, run.releaseAngle ?? 0),
    sweepDamping: dampingOf(values.sweep), latchDamping: dampingOf(values.latch), checkDamping: dampingOf(ORIFICES.backcheck),
    edgeForce: peakMomentOf(values.size) / (run.leaf.width / 1000),
    stopLoss: run.hitStop === null ? 0 : run.inertia * run.stopSpeed * run.stopSpeed / 2,
    arrivalEnergy: run.inertia * run.arrival * run.arrival / 2,
    residual: springEnergy(values.size, run.finalAngle),
    kinetic: run.inertia * run.finalSpeed * run.finalSpeed / 2,
    latched: run.latchedAt !== null,
    ajar: run.stalledAngle === null ? null : run.stalledAngle / RADIAN,
    peakDegrees: run.peak / RADIAN,
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
  let lo = 0, hi = last;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (plan.times[mid] <= t) lo = mid; else hi = mid - 1; }
  const i = lo, j = Math.min(last, i + 1);
  const span = plan.times[j] - plan.times[i];
  const share = span > 0 ? clamp((t - plan.times[i]) / span) : 0;
  const theta = plan.angles[i] + (plan.angles[j] - plan.angles[i]) * share;
  const omega = plan.rates[i] + (plan.rates[j] - plan.rates[i]) * share;
  const opening = plan.opens && (plan.peakAt === null || t < plan.peakAt);
  const orifice = orificeAt(plan.values, theta, opening);
  const pressure = pressureOf(omega, orifice);
  return {
    time, t, theta, omega, pressure, opening,
    degrees: theta / RADIAN, speed: -omega / RADIAN,
    pushing: opening && (plan.handOff === null || t < plan.handOff),
    checking: opening && plan.values.backcheck === 1 && theta >= ANGLES.backcheck * RADIAN,
    latching: !opening && theta > 0 && theta <= ANGLES.latch * RADIAN,
    energy: springEnergy(plan.size, theta),
    moment: springMoment(plan.size, theta),
    orifice,
    finished: plan.latchedAt !== null ? t >= plan.latchedAt : plan.stalledAt !== null ? t >= plan.stalledAt : !plan.opens,
    done: time >= plan.duration,
  };
}

export const sampleDoorCloser = (input, time = 0) => doorAt(doorPlan(input), time);

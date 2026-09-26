import {validateControls, validTime} from './physics-kit.js';

// Mechanical watch: a mainspring drives the wheels, a lever escapement lets
// them move half a tooth at each swing of the balance, and the balance and its
// hairspring set the pace.
//
// Units: SI inside. Readings convert to degrees, hertz, seconds a day.
//
// The balance. A ring of 49 mg at 4.5 mm radius, with a moment of inertia of
// mass times radius squared; its arms are left out. Its alloy grows 12
// millionths of its size a degree.
//
// The hairspring. A flat spiral 0.12 mm tall and 0.03 mm thick. Bending it
// takes a torque of kappa = E w t^3 / (12 l) per radian, E being 195 GPa at 20
// degrees. Its length is chosen so the balance swings at exactly 4 Hz, 28,800
// beats an hour, at 20 degrees with the regulator centered. The regulator's
// curb pins shorten the working length by 0.02% for each mark toward fast. The
// period is 2 pi sqrt(I / kappa).
//
// Temperature. The spring's stiffness changes with its elastic modulus and its
// size: E changes by its thermoelastic coefficient a degree, and w, t and l all
// grow by its expansion, so kappa gains three of them less one. The balance's
// inertia gains two of its own. Carbon steel's modulus falls 240 millionths a
// degree; Nivarox's rises 6 millionths, nearly canceling the rest.
//
// The mainspring. Fully wound, its barrel gives 0.012 N m, falling steadily to
// 40% of that after 42 hours and to nothing two hours later, while the barrel
// turns 6.5 times. 30% of that power reaches the balance, which loses 2 pi / Q
// of its energy each period with Q = 250. The swing settles where the two
// balance: E = Q P T / (2 pi), amplitude = sqrt(2 E / kappa). Under 110 degrees
// each way the lever cannot unlock the escape wheel, and the watch stops.
//
// The train. The 15-tooth escape wheel turns half a tooth at each beat, 16
// turns a minute, and the fourth wheel with the seconds hand once a minute.
//
// Not modeled: the escapement's disturbance of the balance, positional errors,
// magnetism, the balance's arms and screws, and the mainspring's real torque
// curve.

export const ALLOYS = Object.freeze([
  Object.freeze({value: 0, label: 'Carbon steel, as in old watches', elastic: -240e-6, expansion: 11.5e-6}),
  Object.freeze({value: 1, label: 'Nivarox, a compensating alloy', elastic: 6e-6, expansion: 8e-6}),
]);
export const WATCH = Object.freeze({
  mass: 49e-6, radius: 4.5e-3, balanceExpansion: 12e-6, frequency: 4, modulus: 195e9, width: 0.12e-3, thickness: 0.03e-3,
  index: 2e-4, reference: 20, Q: 250, efficiency: 0.3, torque: 0.012, turns: 6.5, reserve: 42, tail: 2, left: 0.4,
  minimum: 110 * Math.PI / 180, lift: 52 * Math.PI / 180, fork: 10 * Math.PI / 180, teeth: 15, fourth: 16, day: 86400, slow: 10,
});
export const WATCH_DEFAULTS = Object.freeze({index: 0, alloy: 1, temperature: 20, hours: 0});
export const WATCH_DOMAINS = Object.freeze({index: [-5, 5, 1], alloy: [0, 1, 1], temperature: [0, 40, 1], hours: [0, 46, 1]});

export const balanceInertia = (dT = 0) => WATCH.mass * (WATCH.radius * (1 + WATCH.balanceExpansion * dT)) ** 2;
/** The spring length that makes the balance swing at 4 Hz at 20 degrees. */
export const SPRING_LENGTH = WATCH.modulus * WATCH.width * WATCH.thickness ** 3 / (12 * balanceInertia() * (2 * Math.PI * WATCH.frequency) ** 2);

/** Mainspring torque after this many hours since it was fully wound. */
export function barrelTorque(hours) {
  const w = WATCH;
  if (hours <= w.reserve) return w.torque * (1 - (1 - w.left) * hours / w.reserve);
  return Math.max(0, w.torque * w.left * (1 - (hours - w.reserve) / w.tail));
}

export function balance(input = {}) {
  const values = validateControls(input, WATCH_DEFAULTS, WATCH_DOMAINS, 'mechanical watch'), w = WATCH, alloy = ALLOYS[values.alloy], dT = values.temperature - w.reference;
  const grow = 1 + alloy.expansion * dT;
  const length = SPRING_LENGTH * (1 - w.index * values.index) * grow, width = w.width * grow, thickness = w.thickness * grow, modulus = w.modulus * (1 + alloy.elastic * dT);
  const kappa = modulus * width * thickness ** 3 / (12 * length), inertia = balanceInertia(dT);
  const frequency = Math.sqrt(kappa / inertia) / (2 * Math.PI), period = 1 / frequency;
  const torque = barrelTorque(values.hours), power = w.efficiency * torque * w.turns * 2 * Math.PI / (w.reserve * 3600);
  const energy = w.Q * power * period / (2 * Math.PI), amplitude = Math.sqrt(2 * energy / kappa), running = amplitude >= w.minimum;
  return {
    values, length, kappa, inertia, frequency, period, torque, power, energy, amplitude, running,
    rate: running ? w.day * (frequency / w.frequency - 1) : null, beatsPerHour: 2 * frequency * 3600, beatEnergy: power * period / 2,
  };
}

/** The watch at a moment of its own real time. */
export function sampleWatch(input = {}, time = 0) {
  validTime(time);
  const b = balance(input);
  if (!b.running) return {...b, time, angle: 0, fork: 0, beats: 0, escape: 0, seconds: 0};
  const phase = b.frequency * time, angle = b.amplitude * Math.sin(2 * Math.PI * phase);
  const beats = Math.floor(2 * phase + 1e-9), escape = beats * Math.PI / WATCH.teeth;
  return {...b, time, angle, fork: WATCH.fork * Math.max(-1, Math.min(1, angle / (WATCH.lift / 2))), beats, escape, seconds: escape / WATCH.fourth};
}

import {validateControls, validTime} from './physics-kit.js';

// Pendulum clock: a weight drives a wheel train, an anchor escapement lets the
// escape wheel turn half a tooth at each beat and gives the pendulum a push,
// and the pendulum's swing sets the pace.
//
// Units: SI inside. Readings convert to millimeters, degrees, seconds a day.
//
// The pendulum. A 1.5 kg bob on a light rod whose length L is measured to the
// bob's center. Its period is 2 pi sqrt(L / g) times the circular error
// 1 + theta^2 / 16 + 11 theta^4 / 3072 for a swing of theta each way, with
// g = 9.81 m/s^2. The rod grows with temperature by its expansion coefficient
// from its length at 20 degrees: steel 11.5, brass 19, invar 1.2 millionths a
// degree.
//
// The train. It is cut so the clock keeps perfect time with the default
// pendulum: 993.8 mm of steel at 20 degrees driven by a 3 kg weight. Any other
// period makes the hands run fast or slow by the ratio of the periods. The
// 30-tooth escape wheel carries the seconds hand and turns half a tooth, 6
// degrees, at each beat.
//
// The swing. The weight falls 0.15 m a day; a quarter of that power reaches the
// pendulum through the train and escapement. The pendulum loses 2 pi / Q of its
// energy each period, with Q = 3,000 when clean and oiled and 1,000 when dry
// and dirty. The swing settles where the two balance: energy
// E = Q P T / (2 pi), and theta = sqrt(2 E / (m g L)). A swing under 1 degree
// each way cannot unlock the pallets, and the clock stops.
//
// Not modeled: the rod's own mass, air density, the escapement's disturbance
// of the period, the weight's changing pull as its cord unwinds, and the
// suspension spring.

export const RODS = Object.freeze([
  Object.freeze({value: 0, label: 'Steel rod', expansion: 11.5e-6}),
  Object.freeze({value: 1, label: 'Brass rod', expansion: 19e-6}),
  Object.freeze({value: 2, label: 'Invar rod', expansion: 1.2e-6}),
]);
export const CARE = Object.freeze([
  Object.freeze({value: 0, label: 'Clean and oiled', Q: 3000}),
  Object.freeze({value: 1, label: 'Dry and dirty', Q: 1000}),
]);
export const CLOCK = Object.freeze({g: 9.81, bob: 1.5, fall: 0.15, efficiency: 0.25, release: Math.PI / 180, reference: 20, teeth: 30, day: 86400});
export const CLOCK_DEFAULTS = Object.freeze({length: 993.8, rod: 0, temperature: 20, weight: 3, care: 0});
export const CLOCK_DOMAINS = Object.freeze({length: [990, 1000, 0.1], rod: [0, 2, 1], temperature: [10, 30, 1], weight: [1, 5, 0.5], care: [0, 1, 1]});

export const circularError = theta => 1 + theta ** 2 / 16 + 11 * theta ** 4 / 3072;
export const hotLength = values => values.length / 1000 * (1 + RODS[values.rod].expansion * (values.temperature - CLOCK.reference));
export const weightPower = values => values.weight * CLOCK.g * CLOCK.fall / CLOCK.day;

/** The swing the pendulum settles at, and its period, found together since each depends on the other. */
export function swing(values) {
  const L = hotLength(values), Q = CARE[values.care].Q, P = weightPower(values) * CLOCK.efficiency, small = 2 * Math.PI * Math.sqrt(L / CLOCK.g);
  let period = small, theta = 0;
  for (let i = 0; i < 20; i++) {
    const energy = Q * P * period / (2 * Math.PI);
    theta = Math.sqrt(2 * energy / (CLOCK.bob * CLOCK.g * L));
    period = small * circularError(theta);
  }
  return {L, Q, power: P, theta, period, small, energy: CLOCK.bob * CLOCK.g * L * theta ** 2 / 2, running: theta >= CLOCK.release};
}

/** The period the train is cut for: the default pendulum's. */
export const DESIGN_PERIOD = swing(CLOCK_DEFAULTS).period;

export function clockPlan(input = {}) {
  const values = validateControls(input, CLOCK_DEFAULTS, CLOCK_DOMAINS, 'pendulum clock'), s = swing(values);
  const rate = s.running ? CLOCK.day * (DESIGN_PERIOD / s.period - 1) : null;
  return {
    ...s, values, design: DESIGN_PERIOD, rate, week: rate === null ? null : 7 * rate,
    beatEnergy: s.power * s.period / 2, lossPerSwing: s.running ? 2 * Math.PI * s.energy / s.Q / 2 : 0,
    growth: (hotLength(values) - values.length / 1000),
  };
}

/** The clock at a moment of real time: pendulum angle, beats counted, escape wheel and hands. */
export function sampleClock(input = {}, time = 0) {
  validTime(time);
  const plan = clockPlan(input), T = plan.period;
  if (!plan.running) return {...plan, time, angle: 0, beats: 0, escape: 0, clockSeconds: 0};
  const phase = time / T, beats = Math.floor(2 * phase + 0.5);
  return {...plan, time, angle: plan.theta * Math.sin(2 * Math.PI * phase), beats, escape: beats * 2 * Math.PI / (2 * CLOCK.teeth), clockSeconds: time * DESIGN_PERIOD / T};
}

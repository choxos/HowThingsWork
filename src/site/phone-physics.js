import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Smartphone: the touchscreen that finds a fingertip, the accelerometer that
// tells a phone which way is up, and the coin vibration motor that buzzes it.
//
// The touchscreen follows the Capacitive sensing page's mutual capacitance
// sensor, a capacitor at each crossing of a row and a column, with its example
// array of 12 by 16, and Microchip's AN2934 for the fingertip, a disc 8 mm
// across, and the electrode pitch. The accelerometer follows Analog Devices'
// ADXL335 sheet: a polysilicon proof mass on polysilicon springs, its movement
// read by a differential capacitor, a sensor resonant frequency of 5.5 kHz,
// 300 mV/g about 1.5 V at 3 V, a noise density of 150 μg/√Hz on x and y, and a
// bandwidth set by one capacitor through a 32 kΩ resistor. The motor follows
// the sheet Adafruit gives for its coin motor, model 10B27.3018: 10 mm across,
// 11,000 rpm at 3.0 V, a starting voltage of 2.3 V or less, and 1.0 G on a
// 75 g block.
//
// Not from a source: a screen of 66 by 136 mm under that 12 by 16 array, its
// rows driving and its columns sensing; each crossing's change falling off
// from the fingertip's center as a bell curve with a spread of 4 mm, the
// fingertip's radius; a controller that reports the center of the changes at
// the strongest crossing and its neighbors, two columns and one row each side;
// a phone of 150 g that shakes as a free body; the sheet's 1.0 G taken as the
// peak of the block's shaking; the speed in proportion to the voltage once the
// motor starts at 2.3 V, and no time to spin up; a half disk weight 1.5 mm
// thick; a proof mass of 1 μg, critically damped; sense gaps of 1.5 μm; one
// pole for each filter; 25 °C; a buzz of 100 ms; and the screen turning to
// landscape when the phone's x axis reads more than its y.
// ---------------------------------------------------------------------------

export const GRAVITY = 9.80665;
export const BOLTZMANN = 1.380649e-23;

/** Analog Devices ADXL335, Rev. A: typical values at 25 °C and 3 V unless named min and max. */
export const ADXL335 = Object.freeze({
  range: 3, sensitivity: Object.freeze([0.27, 0.3, 0.33]), zero: Object.freeze([1.35, 1.5, 1.65]), supply: 3,
  noise: 150e-6, noiseZ: 300e-6, bandwidth: 1600, bandwidthZ: 550, resonance: 5500,
  resistor: 32e3, noiseFactor: 1.6, smallest: 4.7e-9, tested: 1e-7,
  size: Object.freeze([4, 4, 1.45]), shock: 10000, current: 350e-6, selfTest: 325, temperature: 25,
});

/** The coin motor on Adafruit's sheet, model 10B27.3018. */
export const COIN = Object.freeze({
  model: '10B27.3018', diameter: 10, length: 2.7, rated: 3, use: Object.freeze([2.5, 3.8]), start: 2.3,
  speed: 11000, tolerance: 3000, current: 75e-3, mass: 1.2, amplitude: 1, block: 75, noise: 50,
});

/** SparkFun's coin motor sheet, model B1034.FL45-00-015, for comparison. */
export const OTHER_COIN = Object.freeze({model: 'B1034.FL45-00-015', diameter: 10, length: 3.4, rated: 3, speed: 13000, tolerance: 3000, current: 60e-3, start: 2, mass: 0.9});

/** Precision Microdrives' bulletins: normalized to a 100 g mass; brushed ERMs and LRAs from their table; an LRA's start and stop. */
export const PMD = Object.freeze({
  mass: 100,
  erm: Object.freeze({amplitude: Object.freeze([0.25, 150]), hz: Object.freeze([30, 500]), rpm: Object.freeze([1800, 30000])}),
  lra: Object.freeze({amplitude: Object.freeze([0.75, 2]), hz: Object.freeze([150, 205])}),
  yAxis: Object.freeze([175, 235]), start: 5, stop: 275, tungstenCarbide: 15.63,
});

/** The Capacitive sensing page's example of a mutual capacitance array: 12 by 16, a capacitor at each crossing. */
export const GRID = Object.freeze({columns: 12, rows: 16});

/** Microchip AN2934: a fingertip as a disc 5 to 10 mm across, 8 mm typical; a surface sensor's electrode pitch, min, typical and max; about 5 mm ideal for an 8 mm touch; two touches told apart at twice the pitch; a body of 100 to 200 pF. */
export const AN2934 = Object.freeze({finger: Object.freeze([5, 10]), typical: 8, pitch: Object.freeze([4, 6, 10]), ideal: 5, apart: 2, body: Object.freeze([100, 200])});

/** Not from a source, each said in the lessons' limits. */
export const DECLARED = Object.freeze({phone: 150, thickness: 1.5, proofMass: 1e-9, q: 0.5, gap: 1.5, kelvin: 298.15, buzz: 0.1, slow: 100, samples: 481, screen: Object.freeze([66, 136]), spread: 4, window: Object.freeze([2, 1])});

/** Filter capacitors, μF: the smallest the sheet recommends, two from its table, and the largest in its table. */
export const CAPACITORS = Object.freeze([0.0047, 0.01, 0.1, 4.7]);
/** The bandwidth a capacitor in farads sets with the chip's 32 kΩ: 1/(2π × 32 kΩ × C). */
export const cutoffOf = capacitance => 1 / (2 * Math.PI * ADXL335.resistor * capacitance);
export const FILTER_OPTIONS = Object.freeze(CAPACITORS.map(microfarads => Object.freeze({value: microfarads, label: `${microfarads} μF, ${Math.round(cutoffOf(microfarads * 1e-6)).toLocaleString('en-US')} Hz`})));

/** The fingertip's center, mm from the screen's left and bottom edges, is kept far enough in that the controller's neighbors are always on the screen. */
export const PHONE_DEFAULTS = Object.freeze({across: 26, along: 50, turn: 0, lift: 0, drive: 3, filter: 0.0047});
export const PHONE_DOMAINS = Object.freeze({across: Object.freeze([12, 54, 1]), along: Object.freeze([9, 127, 1]), turn: Object.freeze([0, 90, 5]), lift: Object.freeze([-1, 1, 0.1]), drive: Object.freeze([0, 3.8, 0.1]), filter: Object.freeze([0.0047, 4.7, 0.0001])});

export const OMEGA_N = 2 * Math.PI * ADXL335.resonance;
export const RATED_OMEGA = 2 * Math.PI * COIN.speed / 60;

/** The weight's mass times the offset of its center of mass, kg·m: what gives 1.0 G on a 75 g block at 11,000 rpm. */
export const MOMENT = COIN.amplitude * GRAVITY * COIN.block / 1000 / RATED_OMEGA ** 2;

/** A half disk of tungsten carbide 1.5 mm thick with that moment: PMD's sector of half angle θ = π/2, area θr², centroid 2r sin θ/(3θ). SI units. */
export const WEIGHT = (() => {
  const density = PMD.tungstenCarbide * 1000, thickness = DECLARED.thickness / 1000, theta = Math.PI / 2;
  const radius = Math.cbrt(MOMENT * 3 * theta / (2 * Math.sin(theta) * theta * density * thickness));
  const centroid = 2 * radius * Math.sin(theta) / (3 * theta), mass = density * thickness * theta * radius ** 2;
  return Object.freeze({radius, thickness, centroid, mass});
})();

/** The distance between sensing columns and between driving rows, mm. */
export const PITCH = Object.freeze([DECLARED.screen[0] / GRID.columns, DECLARED.screen[1] / GRID.rows]);
/** A sensing column's center, mm from the screen's left edge, and a driving row's, mm from its bottom edge; both counted from 0. */
export const columnAt = j => (j + 0.5) * PITCH[0];
export const rowAt = i => (i + 0.5) * PITCH[1];
/** How much a crossing's capacitance falls under a fingertip centered at (across, along), as a share of its fall with the fingertip centered on it. */
export const changeAt = (across, along, j, i) => Math.exp(-((columnAt(j) - across) ** 2 + (rowAt(i) - along) ** 2) / (2 * DECLARED.spread ** 2));

/**
 * What the controller finds for a fingertip centered at (across, along), mm:
 * every crossing's change, row by row; the strongest crossing, the first
 * found scanning the rows from the bottom and each row from the left; the
 * crossings it weighs, two columns and one row each side of it; and the
 * center of their changes, with its distance from the fingertip's center.
 */
export function touchOf(across, along) {
  const changes = [];
  let strongest = {j: 0, i: 0, share: -1};
  for (let i = 0; i < GRID.rows; i++) {
    for (let j = 0; j < GRID.columns; j++) {
      const share = changeAt(across, along, j, i);
      changes.push(share);
      if (share > strongest.share) strongest = {j, i, share};
    }
  }
  const [wide, tall] = DECLARED.window, weighed = [];
  let total = 0, sumX = 0, sumY = 0;
  for (let i = Math.max(0, strongest.i - tall); i <= Math.min(GRID.rows - 1, strongest.i + tall); i++) {
    for (let j = Math.max(0, strongest.j - wide); j <= Math.min(GRID.columns - 1, strongest.j + wide); j++) {
      const share = changes[i * GRID.columns + j];
      weighed.push({j, i, share});
      total += share;
      sumX += share * columnAt(j);
      sumY += share * rowAt(i);
    }
  }
  const found = [sumX / total, sumY / total], offset = [found[0] - across, found[1] - along];
  return {changes, strongest, weighed, found, offset, error: Math.hypot(offset[0], offset[1])};
}

/** How far a proof mass sags against its spring, m, under a steady proper acceleration in g: a/ωn², whatever its mass. */
export const sagOf = force => force * GRAVITY / OMEGA_N ** 2;
/** The steady response of a spring and mass at `hz`, relative to its sag, for a quality factor q. */
export const responseOf = (hz, q) => { const ratio = hz / ADXL335.resonance; return 1 / Math.sqrt((1 - ratio ** 2) ** 2 + (ratio / q) ** 2); };
/** A single pole's gain and lag at `hz`. */
export const gainOf = (hz, cutoff) => 1 / Math.sqrt(1 + (hz / cutoff) ** 2);
export const lagOf = (hz, cutoff) => Math.atan(hz / cutoff);
/** The sheet's rms noise, g, for a filter's bandwidth: density × √(1.6 × bandwidth). */
export const noiseOf = cutoff => ADXL335.noise * Math.sqrt(ADXL335.noiseFactor * cutoff);
/** The output, V, at 3 V: 1.5 V and 300 mV for each g. */
export const outputOf = force => ADXL335.zero[1] + ADXL335.sensitivity[1] * force;
/** The spring's stiffness, N/m, and the air's thermal jostling of the mass, g/√Hz, for the declared mass and damping. */
export const STIFFNESS = DECLARED.proofMass * OMEGA_N ** 2;
export const thermalNoise = (mass = DECLARED.proofMass, q = DECLARED.q) => Math.sqrt(4 * BOLTZMANN * DECLARED.kelvin * OMEGA_N / (q * mass)) / GRAVITY;

/** What each axis of an accelerometer reads, g, when it accelerates at `accel` (g, world, +y up), its axes given as unit vectors in the world. */
export function properAcceleration(accel, axes) {
  const felt = [accel[0], accel[1] + 1, accel[2]], dot = axis => axis[0] * felt[0] + axis[1] * felt[1] + axis[2] * felt[2];
  return {x: dot(axes.x), y: dot(axes.y), z: dot(axes.z)};
}

/** An upright phone facing you, turned `turn` degrees counterclockwise in its own plane: its axes in the world. */
export function axesOf(turn) {
  const angle = turn * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return {x: [c, s, 0], y: [-s, c, 0], z: [0, 0, 1]};
}

/** The motor at a voltage: stopped below its starting voltage, and above it turning in proportion to the voltage. */
export function motorOf(volts) {
  const spinning = volts >= COIN.start - 1e-9, rpm = spinning ? COIN.speed * volts / COIN.rated : 0, omega = 2 * Math.PI * rpm / 60;
  return {spinning, rpm, hz: rpm / 60, omega, force: MOMENT * omega ** 2};
}

const plans = new Map();

export function phonePlan(input = {}) {
  const values = validateControls(input, PHONE_DEFAULTS, PHONE_DOMAINS, 'smartphone');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const axes = axesOf(values.turn), still = properAcceleration([0, values.lift, 0], axes);
  const motor = motorOf(values.drive), phone = DECLARED.phone / 1000, gap = DECLARED.gap * 1e-6;
  const capacitance = values.filter * 1e-6, cutoff = cutoffOf(capacitance);
  const plan = {
    values, axes, still, motor, gap, capacitance, cutoff,
    touch: touchOf(values.across, values.along),
    landscape: Math.abs(still.x) > Math.abs(still.y) + 1e-12,
    duration: DECLARED.buzz,
    buzz: motor.force / phone / GRAVITY,
    shake: MOMENT / phone,
    gain: motor.spinning ? gainOf(motor.hz, cutoff) : 1,
    lag: motor.spinning ? lagOf(motor.hz, cutoff) : 0,
    noise: noiseOf(cutoff),
    sagPerG: sagOf(1),
    stillSag: {x: -sagOf(still.x), y: -sagOf(still.y)},
    stillVolts: {x: outputOf(still.x), y: outputOf(still.y)},
    response: motor.spinning ? [responseOf(motor.hz, 0.5), responseOf(motor.hz, Infinity)] : [1, 1],
  };
  plan.noiseSag = sagOf(plan.noise);
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => { const t = plan.duration * i / (DECLARED.samples - 1), out = chartAt(plan, t); return {t, x: out.x, y: out.y}; });
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The accelerometer's filtered outputs, g, at a time in the buzz: the steady reading, and the phone's shaking through one pole. */
export function chartAt(plan, t) {
  if (!plan.motor.spinning) return {x: plan.still.x, y: plan.still.y};
  const phase = plan.motor.omega * t - plan.lag, swing = plan.gain * plan.buzz;
  return {x: plan.still.x + swing * Math.cos(phase), y: plan.still.y + swing * Math.sin(phase)};
}

/**
 * The phone at a time: the weight's angle from the phone's x axis, the phone's
 * shaking about where it stood (m, its own axes), the acceleration the motor
 * gives it (g), what the proof masses feel and how far they sag (m), and what
 * the outputs read. The motor turns only while the buzz runs; it stops at its end.
 */
export function phoneAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration), started = t > 0, running = plan.motor.spinning && started && t < plan.duration, done = t >= plan.duration;
  const angle = plan.motor.spinning && started ? plan.motor.omega * t : 0;
  const shake = plan.motor.spinning && started ? [plan.shake * (1 - Math.cos(angle)), -plan.shake * Math.sin(angle)] : [0, 0];
  const push = running ? [plan.buzz * Math.cos(angle), plan.buzz * Math.sin(angle)] : [0, 0];
  const felt = {x: plan.still.x + push[0], y: plan.still.y + push[1]};
  const output = running ? chartAt(plan, t) : {x: plan.still.x, y: plan.still.y};
  const sag = {x: -sagOf(felt.x), y: -sagOf(felt.y)};
  return {time, t, started, running, done, angle, shake, push, felt, output, sag, share: {x: sag.x / plan.gap, y: sag.y / plan.gap}, volts: {x: outputOf(output.x), y: outputOf(output.y)}};
}

export const samplePhone = (input = {}, time = 0) => phoneAt(phonePlan(input), time);

import {validateControls, validTime} from './physics-kit.js';

// Games controller: a thumbstick and a button, read by the controller's
// electronics, polled by a console, and shown on a screen.
//
// Units: SI inside, angles in radians. Readings convert to degrees, volts,
// codes, milliseconds and percent.
//
// The stick. A thumbstick module of the kind in ALPS Alpine's RKJXV series tilts
// 23° each way. Its lever pivots in a gimbal: two slotted yokes at right angles,
// each turned by the tilt and each turning a potentiometer. Tilted by alpha
// toward the direction phi, the yokes turn by atan(tan(alpha) cos(phi)) and
// atan(tan(alpha) sin(phi)). A round gate stops the lever at a tilt of 23°; a
// square gate stops each yoke at 23°. Over the lever's travel each potentiometer
// covers the middle 80% of its track, so a yoke turned by theta puts
// 3.3 V (1/2 + 0.4 theta / 23°) on the wiper.
//
// A spring centers the lever against friction in the gimbal. The datasheet asks
// 14 mN m to move the lever and promises it returns within 5° of center. Taken
// as the torque to push it at full tilt and the band where friction can hold it,
// they give a spring of 11.5 mN m at full tilt against 2.5 mN m of friction. The
// lever and cap, 5e-7 kg m^2 about the pivot, are damped to a tenth of critical.
// The motion is worked in the yokes' angles, along the line the stick is let go
// on.
//
// Let go at the gate, the stick swings back and forth. Each swing between two
// moments of rest is solved exactly, friction's constant torque shifting its
// center, until at a moment of rest the spring can no longer beat friction.
// Eased back by the thumb, it stops as soon as the spring cannot beat friction:
// 5° from center. That resting scatter is the dead zone's reason.
//
// The electronics sample both wipers and the button every millisecond with an
// ADC of 8, 10 or 12 bits, code = floor(V / 3.3 V × 2^M), and scale each code,
// taken at the middle of its step, to a signed 16-bit value with full travel at
// 32,767. The console polls the controller 125, 250 or 1,000 times a second;
// each report carries the latest sample.
//
// The button's contacts bounce for 2.6 ms before closing for good. The firmware
// calls the button pressed once it has read it closed on N scans in a row, and
// released once it has read it open on N scans in a row. The console turns
// every change between reports into an event, so the game hears each press.
//
// The game runs 60 frames a second. At the start of each frame it takes the
// latest report and its events, applies a round dead zone as the XInput
// documentation does (clamp the magnitude to 32,767, subtract the dead zone,
// divide by what is left), and moves its character at up to 5 m/s. The frame
// reaches the screen one frame later, and the display adds its own lag.
//
// Over every timing: the controller's scans, the console's polls and the game's
// frames run on separate clocks, so a press is equally likely to fall anywhere
// between scans, a poll anywhere between scans, and a report anywhere between
// frames. Polls come a whole number of scans apart, so for each of 1,000 press
// timings and each scan a poll can fall on, the console's view is found exactly;
// the poll's fraction of a scan and the wait for a frame are uniform, and their
// spread is added exactly.
//
// Not modeled: the potentiometers' wear, noise and nonlinearity, the ADC's own
// errors, calibration, wireless links, the operating system's scheduling,
// scan-out down the screen, pixel response, and the thumb itself.

const DEG = Math.PI / 180;
export const STICK = Object.freeze({travel: 23 * DEG, operating: 0.014, returnBand: 5 * DEG, inertia: 5e-7, zeta: 0.1, supply: 3.3, span: 0.8, ease: 0.1});
export const SPRING = STICK.operating / (STICK.travel + STICK.returnBand);
export const FRICTION = SPRING * STICK.returnBand;
export const DAMPING = 2 * STICK.zeta * Math.sqrt(SPRING * STICK.inertia);
export const CLOCKS = Object.freeze({scan: 1e-3, frame: 1 / 60, scanPhase: 3e-4, pollPhase: 5e-4, framePhase: 5e-3, press: 0.04, start: -0.02, duration: 0.3});
export const BOUNCE = Object.freeze([[0, 4e-4], [7e-4, 1.2e-3], [1.6e-3, 1.9e-3], [2.6e-3, Infinity]].map(pair => Object.freeze(pair)));
export const GAME = Object.freeze({speed: 5, full: 32767, xinput: 7849});
export const BITS = Object.freeze([8, 10, 12]);
export const POLL_RATES = Object.freeze([125, 250, 1000]);
export const RELEASE_OPTIONS = Object.freeze(['Flick right and let go', 'Flick up and right and let go', 'Ease it back from the right'].map((label, value) => Object.freeze({value, label})));
export const GATE_OPTIONS = Object.freeze(['Round gate', 'Square gate'].map((label, value) => Object.freeze({value, label})));
export const BITS_OPTIONS = Object.freeze(BITS.map((bits, value) => Object.freeze({value, label: `${bits} bits`})));
export const POLL_OPTIONS = Object.freeze(['125 Hz', '250 Hz', '1,000 Hz'].map((label, value) => Object.freeze({value, label})));
export const PAD_DEFAULTS = Object.freeze({release: 0, gate: 0, bits: 1, deadzone: 24, debounce: 5, polling: 0, display: 30});
export const PAD_DOMAINS = {release: [0, 2, 1], gate: [0, 1, 1], bits: [0, 2, 1], deadzone: [0, 40, 2], debounce: [1, 8, 1], polling: [0, 2, 1], display: [0, 80, 10]};
export const LATENCY_STEPS = 1000;
export const HISTOGRAM = Object.freeze({bin: 0.002, bins: 80});

// The stick.
export const yokeAngles = (alpha, phi) => [Math.atan(Math.tan(alpha) * Math.cos(phi)), Math.atan(Math.tan(alpha) * Math.sin(phi))];
export const tiltOf = ([x, y]) => ({alpha: Math.atan(Math.hypot(Math.tan(x), Math.tan(y))), phi: Math.atan2(Math.tan(y), Math.tan(x))});

/** The yoke angles where the lever meets the gate, tilted toward the direction phi. */
export function gatePoint(gate, phi) {
  const reach = Math.tan(STICK.travel) / (gate === 1 ? Math.max(Math.abs(Math.cos(phi)), Math.abs(Math.sin(phi))) : 1);
  return [Math.atan(reach * Math.cos(phi)), Math.atan(reach * Math.sin(phi))];
}
export const insideGate = ([x, y], gate) => (gate === 1 ? Math.max(Math.abs(x), Math.abs(y)) : tiltOf([x, y]).alpha) <= STICK.travel + 1e-12;

/** The stick let go from s0 along its line: every swing between two moments of rest, and where it stops. */
export function stickSwings(s0) {
  const w0 = Math.sqrt(SPRING / STICK.inertia), zeta = DAMPING / (2 * Math.sqrt(SPRING * STICK.inertia)), wd = w0 * Math.sqrt(1 - zeta * zeta);
  const band = FRICTION / SPRING, half = Math.PI / wd, decay = Math.exp(-zeta * w0 * half), swings = [];
  let s = s0, t = 0;
  while (Math.abs(s) > band) {
    const center = Math.sign(s) * band, to = center - (s - center) * decay;
    swings.push({t0: t, d: half, from: s, center, to});
    t += half;
    s = to;
  }
  return {swings, rest: {t, s}, w0, zeta, wd, band, half, decay};
}

/** How the stick comes back from the gate: let go to swing, or eased back by the thumb until friction holds it. */
export function stickMotion(release, gate) {
  const start = gatePoint(gate, release === 1 ? Math.PI / 4 : 0), s0 = Math.hypot(start[0], start[1]), unit = [start[0] / s0, start[1] / s0];
  if (release === 2) return {kind: 'ease', start, s0, unit, band: FRICTION / SPRING, ease: STICK.ease, rest: {t: STICK.ease, s: FRICTION / SPRING}};
  const run = stickSwings(s0);
  return {kind: 'swing', start, s0, unit, band: run.band, run, rest: run.rest};
}

/** The stick at a moment: its yoke angles, its place along its line, its angular speed, and whether it moves or a thumb holds it. */
export function stickAt(motion, t) {
  const place = (s, speed, moving, held) => ({angles: [motion.unit[0] * s, motion.unit[1] * s], s, speed, moving, held});
  if (t <= 0) return place(motion.s0, 0, false, true);
  if (motion.kind === 'ease') {
    if (t >= motion.ease) return place(motion.band, 0, false, false);
    const x = Math.PI * t / motion.ease, drop = motion.s0 - motion.band;
    return place(motion.band + drop * (1 + Math.cos(x)) / 2, -drop * Math.PI / (2 * motion.ease) * Math.sin(x), true, true);
  }
  const {run} = motion, swing = run.swings.find(item => t < item.t0 + item.d);
  if (!swing) return place(run.rest.s, 0, false, false);
  const tau = t - swing.t0, a = run.zeta * run.w0, fade = Math.exp(-a * tau), amplitude = swing.from - swing.center;
  return place(swing.center + amplitude * fade * (Math.cos(run.wd * tau) + a / run.wd * Math.sin(run.wd * tau)), -amplitude * run.w0 * run.w0 / run.wd * fade * Math.sin(run.wd * tau), true, false);
}

// The electronics.
export const wiper = angle => STICK.supply * (0.5 + STICK.span / 2 * angle / STICK.travel);
export const adcCode = (volts, bits) => Math.max(0, Math.min(2 ** bits - 1, Math.floor(volts / STICK.supply * 2 ** bits)));
export const toReport = (code, bits) => Math.max(-32768, Math.min(32767, Math.round((code + 0.5 - 2 ** (bits - 1)) / (STICK.span * 2 ** (bits - 1)) * GAME.full)));

/** A round dead zone as the XInput documentation applies it: clamp to 32,767, subtract the dead zone, divide by what is left. */
export function deadZone(x, y, zone) {
  const magnitude = Math.hypot(x, y), inner = zone * GAME.full;
  if (magnitude <= inner) return {magnitude, normalized: 0, direction: [0, 0]};
  return {magnitude, normalized: (Math.min(magnitude, GAME.full) - inner) / (GAME.full - inner), direction: [x / magnitude, y / magnitude]};
}

// The button.
export const contactClosed = since => since >= 0 && BOUNCE.some(([from, to]) => since >= from && since < to);

/** Scanning every millisecond from firstScan after the press: each change of the debounced state, by scan. */
export function debounce(firstScan, n) {
  const last = Math.ceil((BOUNCE.at(-1)[0] - firstScan) / CLOCKS.scan) + n + 1, changes = [];
  let closedRun = 0, openRun = 0, pressed = false;
  for (let j = 0; j <= last; j++) {
    const closed = contactClosed(firstScan + j * CLOCKS.scan);
    closedRun = closed ? closedRun + 1 : 0;
    openRun = closed ? 0 : openRun + 1;
    if (pressed ? openRun >= n : closedRun >= n) {
      pressed = !pressed;
      changes.push({scan: j, pressed});
    }
  }
  return {changes, registered: firstScan + changes[0].scan * CLOCKS.scan, presses: changes.filter(change => change.pressed).length};
}
export const stateAfter = (changes, scan) => changes.reduce((state, change) => (change.scan <= scan ? change.pressed : state), false);

/** Polls every P scans, the first at scan offset minus P: how many presses the console hears, and the scan whose state first says pressed. */
export function consoleView(changes, offset, P) {
  const end = changes.at(-1).scan + P;
  let previous = false, presses = 0, first = null;
  for (let m = offset - P; m <= end; m += P) {
    const now = stateAfter(changes, m);
    if (now && !previous) {
      presses++;
      if (first === null) first = m;
    }
    previous = now;
  }
  return {first, presses};
}

/** Probability that the sum of waits uniform on [0, a) and [0, b) is below x. */
export function twoWaits(x, a, b) {
  const [p, q] = a <= b ? [a, b] : [b, a];
  if (x <= 0) return 0;
  if (x >= p + q) return 1;
  if (x < p) return x * x / (2 * p * q);
  if (x < q) return (2 * x - p) / (2 * q);
  return 1 - (p + q - x) ** 2 / (2 * p * q);
}

const latencies = new Map();

/** The time from pressing the button to its result on screen, over every timing of the three clocks. */
export function latencyOver(n, polling, display) {
  const key = `${n}|${polling}|${display}`;
  if (latencies.has(key)) return latencies.get(key);
  const ms = CLOCKS.scan, frame = CLOCKS.frame, lag = display / 1000, P = Math.round(1 / POLL_RATES[polling] / ms), weight = 1 / (LATENCY_STEPS * P);
  const histogram = new Float64Array(HISTOGRAM.bins);
  let registered = 0, seen = 0, low = Infinity, high = -Infinity, firmwareDoubles = 0, consoleDoubles = 0;
  for (let i = 0; i < LATENCY_STEPS; i++) {
    const f = (i + 0.5) / LATENCY_STEPS * ms, bounce = debounce(f, n);
    registered += bounce.registered / LATENCY_STEPS;
    if (bounce.presses > 1) firmwareDoubles += 1 / LATENCY_STEPS;
    for (let offset = 0; offset < P; offset++) {
      const view = consoleView(bounce.changes, offset, P), scan = f + view.first * ms;
      seen += scan * weight;
      low = Math.min(low, scan);
      high = Math.max(high, scan);
      if (view.presses > 1) consoleDoubles += weight;
      for (let b = 0; b < HISTOGRAM.bins; b++) histogram[b] += weight * (twoWaits((b + 1) * HISTOGRAM.bin - scan - frame - lag, ms, frame) - twoWaits(b * HISTOGRAM.bin - scan - frame - lag, ms, frame));
    }
  }
  const result = Object.freeze({
    mean: seen + ms / 2 + frame / 2 + frame + lag, min: low + frame + lag, max: high + ms + 2 * frame + lag,
    parts: Object.freeze({debounce: registered, poll: seen + ms / 2 - registered, frame: frame / 2, render: frame, display: lag}),
    firmwareDoubles, consoleDoubles, histogram: Object.freeze(Array.from(histogram)),
  });
  if (latencies.size > 64) latencies.delete(latencies.keys().next().value);
  latencies.set(key, result);
  return result;
}

/** The press in the run, at the clocks' fixed timings: its bounce, the console's events and when it reaches the screen. */
function runPress(n, poll, lag) {
  const f = ((CLOCKS.scanPhase - CLOCKS.press) % CLOCKS.scan + CLOCKS.scan) % CLOCKS.scan, bounce = debounce(f, n), frame = CLOCKS.frame, lastChange = bounce.changes.at(-1).scan, events = [];
  let previous = false;
  for (let k = Math.floor((CLOCKS.press - CLOCKS.pollPhase) / poll); ; k++) {
    const at = CLOCKS.pollPhase + k * poll, scan = Math.floor((at - CLOCKS.press - f) / CLOCKS.scan + 1e-9), now = scan >= 0 && stateAfter(bounce.changes, scan);
    if (now !== previous) events.push({t: at, pressed: now, frame: Math.ceil((at - CLOCKS.framePhase) / frame - 1e-9) * frame + CLOCKS.framePhase});
    previous = now;
    if (scan > lastChange) break;
  }
  const first = events.find(event => event.pressed);
  return {t: CLOCKS.press, firstScan: f, bounce, registered: CLOCKS.press + bounce.registered, events, presses: events.filter(event => event.pressed).length, reported: first.t, frame: first.frame, photon: first.frame + frame + lag, latency: first.frame + frame + lag - CLOCKS.press};
}

const cache = new Map();

export function padPlan(input = {}) {
  const values = validateControls(input, PAD_DEFAULTS, PAD_DOMAINS, 'games controller');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const bits = BITS[values.bits], rate = POLL_RATES[values.polling], poll = 1 / rate, frame = CLOCKS.frame, lag = values.display / 1000;
  const motion = stickMotion(values.release, values.gate);
  const read = t => {
    const stick = stickAt(motion, t), volts = stick.angles.map(wiper), codes = volts.map(volt => adcCode(volt, bits)), report = codes.map(code => toReport(code, bits));
    return {t, stick, volts, codes, report};
  };
  const scanAt = t => Math.floor((t - CLOCKS.scanPhase) / CLOCKS.scan + 1e-9) * CLOCKS.scan + CLOCKS.scanPhase;
  const pollAt = t => Math.floor((t - CLOCKS.pollPhase) / poll + 1e-9) * poll + CLOCKS.pollPhase;
  const press = runPress(values.debounce, poll, lag);

  const frames = [];
  let position = [0, 0];
  for (let i = Math.ceil((CLOCKS.start - CLOCKS.framePhase) / frame - 1e-9); ; i++) {
    const t = CLOCKS.framePhase + i * frame;
    if (t > CLOCKS.duration + 1e-12) break;
    const polled = pollAt(t), scanned = scanAt(polled), reading = read(scanned), mapped = deadZone(reading.report[0], reading.report[1], values.deadzone / 100);
    const velocity = mapped.direction.map(d => d * mapped.normalized * GAME.speed);
    position = [position[0] + velocity[0] * frame, position[1] + velocity[1] * frame];
    frames.push({t, polled, scanned, reading, mapped, velocity, position, presses: press.events.filter(event => event.pressed && event.frame <= t + 1e-12).length, shown: t + frame + lag});
  }

  const settled = read(motion.rest.t + CLOCKS.scan), settledMap = deadZone(settled.report[0], settled.report[1], values.deadzone / 100), gate = read(0);
  const plan = {
    values, bits, rate, poll, frame, lag, motion, press, frames, read, scanAt, pollAt,
    latency: latencyOver(values.debounce, values.polling, values.display),
    step: {angle: STICK.travel / (STICK.span * 2 ** (bits - 1)), report: GAME.full / (STICK.span * 2 ** (bits - 1))},
    rest: {...settled, mapped: settledMap, share: Math.hypot(...settled.report) / GAME.full, time: motion.rest.t, creep: settledMap.normalized * GAME.speed},
    full: {...gate, mapped: deadZone(gate.report[0], gate.report[1], values.deadzone / 100), share: Math.hypot(...gate.report) / GAME.full},
    startTime: CLOCKS.start, duration: CLOCKS.duration,
  };
  if (cache.size > 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** Everything the controller, console and screen show at a moment of the run. */
export function padAt(plan, time) {
  const t = Math.max(plan.startTime, Math.min(plan.duration, time)), stick = stickAt(plan.motion, t);
  const scanned = plan.scanAt(t), polled = plan.pollAt(t), sample = plan.read(scanned), report = plan.read(plan.scanAt(polled));
  let frame = null, shown = null;
  for (const item of plan.frames) {
    if (item.t <= t + 1e-12) frame = item;
    if (item.shown <= t + 1e-12) shown = item;
  }
  const {press} = plan, since = t - press.t, scan = Math.floor((since - press.firstScan) / CLOCKS.scan + 1e-9), heard = press.events.filter(event => event.t <= t + 1e-12);
  return {
    t, stick, scanned, polled, sample, report, frame, shown, since,
    contact: contactClosed(since), firmware: scan >= 0 && stateAfter(press.bounce.changes, scan), console: Boolean(heard.at(-1)?.pressed),
    heard: heard.filter(event => event.pressed).length, onScreen: shown ? shown.presses : 0,
  };
}

/** The plan and the moment `time` seconds into the run, which starts 20 ms before the stick is let go. */
export function samplePad(input = {}, time = 0) {
  const plan = padPlan(input);
  return {...plan, now: padAt(plan, CLOCKS.start + validTime(time))};
}

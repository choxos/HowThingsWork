// Games controller: the thumbstick's torques from its datasheet, its gimbal
// and gate measured again from the lever's section, its swing integrated
// again in 2 µs steps with friction that sticks and slips and its energy
// accounted for, the ADC and the XInput dead zone written again from their
// definitions, the button's bounce, debounce, polls and frames simulated again
// on random clocks, the run's press and frames rebuilt, the drawing held to
// the state, and every number the three lessons quote held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {padPlan, padAt, samplePad, stickMotion, stickAt, stickSwings, yokeAngles, tiltOf, gatePoint, insideGate, wiper, adcCode, toReport, deadZone, contactClosed, latencyOver, BOUNCE, STICK, SPRING, FRICTION, DAMPING, CLOCKS, GAME, BITS, POLL_RATES, HISTOGRAM, PAD_DEFAULTS, PAD_DOMAINS} from './games-controller-physics.js';
import {createGamesControllerModel, leverDirection, CONTROLLER, MODULE, GATE_RADIUS, TRACK_ARC, BUTTON_AT, MONITOR_AT, CHARTS, COLORS, SHARE_COLORS, SMALL} from './games-controller-model.js';
import {gamesControllerLesson, joystickLesson, videoGamesConsoleLesson} from './games-controller-lessons.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

// The controller written again from its sources.
const t = tally(), DEG = Math.PI / 180;
const TRAVEL = 23 * DEG, OPERATING = 0.014, BAND = 5 * DEG, INERTIA = 5e-7, ZETA = 0.1, SUPPLY = 3.3, SPAN = 0.8, FULL = 32767;
const k = OPERATING / (TRAVEL + BAND), friction = k * BAND, damping = 2 * ZETA * Math.sqrt(k * INERTIA);

// 1. The datasheet's torques, the gimbal and the gate.
t.near(STICK.travel, TRAVEL, 1e-15, 'travel 23° each way');
t.near(SPRING, k, 1e-15, 'spring stiffness');
t.near(FRICTION, friction, 1e-15, 'friction torque');
t.near(DAMPING, damping, 1e-18, 'damping a tenth of critical');
t.near(k * TRAVEL + friction, OPERATING, 1e-15, 'spring at full tilt plus friction is the 14 mN m operating torque');
t.near(friction / k, BAND, 1e-15, 'friction can hold the lever within 5°');

for (let i = 0; i <= 40; i++) {
  for (let j = 0; j < 72; j++) {
    const alpha = 1.3 * TRAVEL * i / 40, phi = j / 72 * 2 * Math.PI, [x, y] = yokeAngles(alpha, phi);
    const d = new THREE.Vector3(Math.sin(alpha) * Math.cos(phi), Math.cos(alpha), -Math.sin(alpha) * Math.sin(phi));
    t.near(Math.atan2(d.x, d.y), x, 1e-12, 'yoke A turns with the tilt across its slot');
    t.near(Math.atan2(-d.z, d.y), y, 1e-12, 'yoke B turns with the tilt across its slot');
    if (i) {
      const back = tiltOf([x, y]);
      t.near(back.alpha, alpha, 1e-12, 'tilt recovered from the yokes');
      t.near(Math.cos(back.phi - phi), 1, 1e-12, 'direction recovered from the yokes');
    }
    t.near(leverDirection([x, y]).distanceTo(d), 0, 1e-12, 'the drawn lever points along the tilt');
    const armA = new THREE.Vector3(Math.sin(x), Math.cos(x), 0), armB = new THREE.Vector3(0, Math.cos(y), -Math.sin(y));
    t.near(d.dot(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), armA)), 0, 1e-12, 'the lever lies in yoke A’s slot');
    t.near(d.dot(new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), armB)), 0, 1e-12, 'the lever lies in yoke B’s slot');
  }
}

/** Where the lever's round section, radius rs about its axis, meets the gate plane h above the pivot: sampled points (x, z). */
const section = (angles, samples = 1440) => {
  const d = leverDirection(angles), e1 = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1)).normalize(), e2 = new THREE.Vector3().crossVectors(d, e1).normalize(), points = [];
  for (let i = 0; i < samples; i++) {
    const b = i / samples * 2 * Math.PI, p = e1.clone().multiplyScalar(MODULE.shaft * Math.cos(b)).add(e2.clone().multiplyScalar(MODULE.shaft * Math.sin(b)));
    const s = (MODULE.gate - p.y) / d.y;
    points.push([p.x + s * d.x, p.z + s * d.z]);
  }
  return points;
};
const reachRound = angles => Math.max(...section(angles).map(([x, z]) => Math.hypot(x, z)));
const reachSquare = angles => Math.max(...section(angles).map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))));
for (let j = 0; j < 72; j++) {
  const phi = j * 5 * DEG, round = gatePoint(0, phi), square = gatePoint(1, phi);
  t.near(tiltOf(round).alpha, TRAVEL, 1e-12, 'the round gate stops every tilt at 23°');
  t.near(Math.max(Math.abs(square[0]), Math.abs(square[1])), TRAVEL, 1e-12, 'the square gate stops the leading yoke at 23°');
  t.near(reachRound(round), GATE_RADIUS, 2e-5, 'the lever touches the round gate’s rim all the way round');
  t.near(reachSquare(square), GATE_RADIUS, 2e-5, 'the lever touches the square gate’s sides all the way round');
  t.ok(insideGate(round, 0) && insideGate(square, 1), 'gate points lie in their gates');
  t.ok(!insideGate(yokeAngles(1.001 * TRAVEL, phi), 0), 'beyond the round gate is outside it');
  t.ok(reachRound(yokeAngles(0.9 * TRAVEL, phi)) < GATE_RADIUS - 0.2, 'short of the gate the lever clears the rim');
}

// 2. The stick let go, integrated again in 2 µs steps, friction reversing with the motion and holding it once the spring cannot beat it.
const simulate = (s0, dt = 2e-6) => {
  let s = s0, v = 0, time = 0, dir = -Math.sign(s0), frictionWork = 0, dampingWork = 0;
  const rests = [], samples = [[0, s0]], accel = (sv, vv) => (-k * sv - damping * vv - friction * dir) / INERTIA;
  for (let step = 0; step < 5e6; step++) {
    const a1 = accel(s, v), s2 = s + dt / 2 * v, v2 = v + dt / 2 * a1, a2 = accel(s2, v2), s3 = s + dt / 2 * v2, v3 = v + dt / 2 * a2, a3 = accel(s3, v3), s4 = s + dt * v3, v4 = v + dt * a3, a4 = accel(s4, v4);
    let ns = s + dt / 6 * (v + 2 * v2 + 2 * v3 + v4), nv = v + dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4), h = dt;
    const turned = Math.sign(nv) === -dir;
    if (turned) {
      const fraction = v / (v - nv);
      h = dt * fraction;
      ns = s + (ns - s) * fraction;
      nv = 0;
    }
    frictionWork += friction * Math.abs(ns - s);
    dampingWork += damping * h / 6 * (v * v + 2 * v2 * v2 + 2 * v3 * v3 + v4 * v4);
    s = ns;
    v = nv;
    time += h;
    if (step % 50 === 49) samples.push([time, s]);
    if (turned) {
      rests.push({t: time, s});
      if (k * Math.abs(s) <= friction) return {rest: {t: time, s}, rests, frictionWork, dampingWork, samples};
      dir = -Math.sign(s);
    }
  }
  throw new Error('the stick never came to rest');
};
const starts = [...[0, 1].flatMap(gate => [0, 1].map(release => stickMotion(release, gate).s0)), 5.2 * DEG, 8 * DEG, 12 * DEG, 17 * DEG, 30 * DEG, 40 * DEG];
for (const s0 of starts) {
  const again = simulate(s0), swings = stickSwings(s0), motion = {kind: 'swing', unit: [1, 0], s0, run: swings, rest: swings.rest, band: swings.band};
  t.near(swings.swings.length, again.rests.length, 0, `${fixed(s0 / DEG, 1)}°: as many swings`);
  again.rests.forEach((rest, i) => {
    t.near(swings.swings[i].t0 + swings.swings[i].d, rest.t, 4e-6, `${fixed(s0 / DEG, 1)}°: swing ${i + 1} ends when the stick stops`);
    t.near(swings.swings[i].to, rest.s, 2e-7, `${fixed(s0 / DEG, 1)}°: swing ${i + 1} ends where the stick stops`);
  });
  t.near(swings.rest.s, again.rest.s, 2e-7, `${fixed(s0 / DEG, 1)}°: comes to rest in the same place`);
  t.ok(Math.abs(swings.rest.s) <= BAND && k * Math.abs(swings.rest.s) <= friction, `${fixed(s0 / DEG, 1)}°: at rest friction holds it`);
  for (const [time, s] of again.samples) t.near(stickAt(motion, time).s, s, 2e-6, `${fixed(s0 / DEG, 1)}°: along the swing at ${fixed(time * 1000, 2)} ms`);
  const lost = 0.5 * k * (s0 * s0 - again.rest.s * again.rest.s);
  t.near(again.frictionWork + again.dampingWork, lost, 2e-6 * lost, `${fixed(s0 / DEG, 1)}°: the spring’s lost energy went into friction and damping`);
}
for (const gate of [0, 1]) {
  const motion = stickMotion(2, gate), T = STICK.ease;
  t.near(stickAt(motion, 0).s, motion.s0, 1e-15, 'eased back from the gate');
  t.near(stickAt(motion, T).s, BAND, 1e-15, 'eased until friction holds it');
  t.near(k * stickAt(motion, T).s, friction, 1e-15, 'where it stops the spring exactly balances friction');
  let previous = Infinity;
  for (let i = 1; i < 1000; i++) {
    const time = T * i / 1000, here = stickAt(motion, time), dt = 1e-7;
    t.ok(here.s < previous && here.held && here.moving, 'the thumb brings it steadily back');
    t.near(here.speed, (stickAt(motion, time + dt).s - stickAt(motion, time - dt).s) / (2 * dt), 1e-6, 'eased speed is the slope of its place');
    previous = here.s;
  }
  t.ok(!stickAt(motion, T + 0.05).moving && !stickAt(motion, T + 0.05).held, 'then it rests untouched');
}

// 3. Potentiometers, the ADC and the dead zone, from their definitions.
for (const bits of BITS) {
  const levels = 2 ** bits, Q = SUPPLY / levels;
  for (let i = -2100; i <= 2100; i++) {
    const angle = TRAVEL * i / 2000, volts = SUPPLY * (0.5 + SPAN / 2 * angle / TRAVEL), exact = volts / Q;
    t.near(wiper(angle), volts, 1e-12, 'the wiper divides the supply in proportion to the angle');
    if (Math.abs(exact - Math.round(exact)) > 1e-9) t.near(adcCode(volts, bits), Math.min(levels - 1, Math.max(0, Math.floor(exact))), 0, `${bits} bits: the code is the whole number of steps of Q = 3.3 V / 2^M`);
  }
  for (let code = 0; code < levels; code++) {
    const report = Math.max(-32768, Math.min(FULL, Math.round((code + 0.5 - levels / 2) / (SPAN * levels / 2) * FULL)));
    t.near(toReport(code, bits), report, 0, `${bits} bits: code ${code} scaled to 16 bits at the middle of its step`);
    if (code) t.ok(toReport(code, bits) >= toReport(code - 1, bits), `${bits} bits: reports never go backward`);
  }
  t.near(padPlan({bits: BITS.indexOf(bits)}).step.angle, TRAVEL / (SPAN * levels / 2), 1e-15, `${bits} bits: one step in degrees of tilt`);
  t.near(padPlan({bits: BITS.indexOf(bits)}).step.report, FULL / (SPAN * levels / 2), 1e-9, `${bits} bits: one step in the report`);
}
const xinput = (LX, LY, INPUT_DEADZONE) => {
  let magnitude = Math.sqrt(LX * LX + LY * LY), normalizedMagnitude = 0;
  if (magnitude > INPUT_DEADZONE) {
    if (magnitude > 32767) magnitude = 32767;
    magnitude -= INPUT_DEADZONE;
    normalizedMagnitude = magnitude / (32767 - INPUT_DEADZONE);
  } else {
    magnitude = 0.0;
    normalizedMagnitude = 0.0;
  }
  return normalizedMagnitude;
};
for (const zone of [0, 0.02, 0.2, 0.24, 7849 / FULL, 0.4]) {
  for (let x = -32768; x <= FULL; x += 1531) {
    for (let y = -32768; y <= FULL; y += 1777) {
      const mapped = deadZone(x, y, zone);
      t.near(mapped.normalized, xinput(x, y, zone * FULL), 1e-12, 'the dead zone as the XInput documentation computes it');
      if (mapped.normalized > 0) t.near(mapped.direction[0] * Math.hypot(x, y), x, 1e-9, 'direction kept outside the dead zone');
    }
  }
}

console.log(`progress: gimbal, swing and electronics ${t.count}`);

// 4. The press on random clocks: contacts, scans, the firmware, polls and frames simulated again.
const random = (seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
})(20260915);
const CLOSED = [[0, 4e-4], [7e-4, 1.2e-3], [1.6e-3, 1.9e-3], [2.6e-3, Infinity]], SCAN = 1e-3, FRAME = 1 / 60;
const closedAt = since => since >= 0 && CLOSED.some(([a, b]) => since >= a && since < b);
/** One press at time 0; each clock's first tick after it given as a fraction of its period. */
const pressOnce = (n, pollPeriod, lag, scanFraction, pollFraction, frameFraction) => {
  const window = [], changes = [];
  let pressed = false;
  for (let j = -n; j < 24; j++) {
    const at = (scanFraction + j) * SCAN;
    window.push(closedAt(at));
    if (window.length > n) window.shift();
    if (window.length === n && window.every(closed => closed !== pressed)) {
      pressed = !pressed;
      changes.push({at, pressed});
    }
  }
  const verdict = time => changes.filter(change => change.at <= time).reduce((state, change) => change.pressed, false);
  let previous = false, presses = 0, first = null;
  const events = [], frameOf = at => (frameFraction + Math.max(0, Math.ceil(at / FRAME - frameFraction - 1e-12))) * FRAME;
  for (let k = 0; k < 40; k++) {
    const at = (pollFraction + k) * pollPeriod, now = verdict(at);
    if (now !== previous) events.push({at, pressed: now, frame: frameOf(at)});
    if (now && !previous) {
      presses++;
      if (first === null) first = at;
    }
    previous = now;
  }
  const frame = frameOf(first);
  return {latency: frame + FRAME + lag, presses, firmwarePresses: changes.filter(change => change.pressed).length, registered: changes[0].at, first, frame, changes, events};
};
for (const n of [1, 2, 3, 5, 8]) {
  for (const polling of [0, 1, 2]) {
    const P = 1 / POLL_RATES[polling], model = latencyOver(n, polling, 30), samples = n === 5 && polling === 0 ? 400000 : 60000, bins = new Float64Array(HISTOGRAM.bins);
    let sum = 0, squares = 0, low = Infinity, high = -Infinity, doubles = 0, firmwareDoubles = 0;
    for (let i = 0; i < samples; i++) {
      const run = pressOnce(n, P, 0.03, random(), random(), random());
      sum += run.latency;
      squares += run.latency * run.latency;
      low = Math.min(low, run.latency);
      high = Math.max(high, run.latency);
      if (run.presses > 1) doubles++;
      if (run.firmwarePresses > 1) firmwareDoubles++;
      bins[Math.floor(run.latency / HISTOGRAM.bin)]++;
    }
    const mean = sum / samples, spread = Math.sqrt(squares / samples - mean * mean), label = `${n} ${n === 1 ? 'scan' : 'scans'} at ${POLL_RATES[polling]} Hz`;
    t.near(model.mean, mean, 4 * spread / Math.sqrt(samples), `${label}: average latency over random clocks`);
    t.ok(low >= model.min - 1e-9 && high <= model.max + 1e-9, `${label}: every simulated press lies within the model’s range`);
    t.ok(low - model.min < 5e-4 && model.max - high < 5e-4, `${label}: and the range’s ends are reached`);
    const share = (count, p) => Math.abs(count / samples - p) <= 4 * Math.sqrt(p * (1 - p) / samples) + 2 / samples;
    t.ok(share(doubles, model.consoleDoubles), `${label}: the console hears a second press as often (${doubles / samples} against ${model.consoleDoubles})`);
    t.ok(share(firmwareDoubles, model.firmwareDoubles), `${label}: the firmware counts a second press as often`);
    model.histogram.forEach((p, b) => t.ok(share(bins[b], p), `${label}: latency between ${b * 2} and ${b * 2 + 2} ms as likely (${bins[b] / samples} against ${p})`));
    t.near(model.histogram.reduce((a, b) => a + b, 0), 1, 1e-9, `${label}: every press lands somewhere`);
    t.near(model.parts.debounce + model.parts.poll + model.parts.frame + model.parts.render + model.parts.display, model.mean, 1e-12, `${label}: the average shares add up`);
    const shifted = latencyOver(n, polling, 80);
    t.near(shifted.mean - model.mean, 0.05, 1e-12, `${label}: 50 ms more display lag, 50 ms later on average`);
    model.histogram.forEach((p, b) => { if (b + 25 < HISTOGRAM.bins) t.near(shifted.histogram[b + 25], p, 1e-12, `${label}: the spread moves 50 ms later`); });
  }
}
console.log(`progress: random clocks ${t.count}`);

// 5. The run's own press and frames, at the clocks' fixed timings: press at 40 ms, scans from 0.3 ms, polls from 0.5 ms, frames from 5 ms.
const fractionAfter = (first, period) => (Math.ceil((0.04 - first) / period - 1e-12) * period + first - 0.04) / period;
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  for (const polling of [0, 1, 2]) {
    for (const display of [0, 30, 80]) {
      const plan = padPlan({debounce: n, polling, display}), P = 1 / POLL_RATES[polling], lag = display / 1000;
      const again = pressOnce(n, P, lag, fractionAfter(3e-4, SCAN), fractionAfter(5e-4, P), fractionAfter(5e-3, FRAME)), label = `run with ${n} scans, ${POLL_RATES[polling]} Hz, ${display} ms`;
      t.near(plan.press.registered - 0.04, again.registered, 1e-12, `${label}: firmware verdict`);
      t.near(plan.press.reported - 0.04, again.first, 1e-12, `${label}: first report saying pressed`);
      t.near(plan.press.frame - 0.04, again.frame, 1e-12, `${label}: the frame that handles it`);
      t.near(plan.press.latency, again.latency, 1e-12, `${label}: from touch to screen`);
      t.near(plan.press.presses, again.presses, 0, `${label}: presses the console hears`);
      t.near(plan.press.bounce.presses, again.firmwarePresses, 0, `${label}: presses the firmware counts`);
    }
  }
}
const xinputShare = report => xinput(report[0], report[1], 0);
for (const values of [{}, {release: 1}, {release: 2}, {release: 1, gate: 1}, {bits: 0}, {bits: 2, polling: 2}, {release: 2, deadzone: 20}, {release: 2, deadzone: 0}, {release: 1, deadzone: 40, polling: 1}]) {
  const plan = padPlan(values), full = {...PAD_DEFAULTS, ...values}, bits = BITS[full.bits], P = 1 / POLL_RATES[full.polling], zone = full.deadzone / 100, label = JSON.stringify(values);
  const report = time => stickAt(plan.motion, time).angles.map(angle => {
    const levels = 2 ** bits, code = Math.min(levels - 1, Math.max(0, Math.floor(SUPPLY * (0.5 + SPAN / 2 * angle / TRAVEL) / (SUPPLY / levels))));
    return Math.max(-32768, Math.min(FULL, Math.round((code + 0.5 - levels / 2) / (SPAN * levels / 2) * FULL)));
  });
  let position = [0, 0], count = 0;
  for (let i = Math.ceil((CLOCKS.start - 5e-3) / FRAME - 1e-9); 5e-3 + i * FRAME <= CLOCKS.duration + 1e-12; i++, count++) {
    const time = 5e-3 + i * FRAME, frame = plan.frames[count], poll = Math.floor((time - 5e-4) / P + 1e-9) * P + 5e-4, scan = Math.floor((poll - 3e-4) / SCAN + 1e-9) * SCAN + 3e-4;
    const read = report(scan), normalized = xinput(read[0], read[1], zone * FULL), magnitude = Math.hypot(...read);
    position = position.map((p, axis) => p + (normalized ? read[axis] / magnitude : 0) * normalized * 5 * FRAME);
    t.near(frame.t, time, 1e-12, `${label}: frame ${count} starts on the 60 Hz clock`);
    t.near(frame.polled, poll, 1e-12, `${label}: frame ${count} takes the latest poll`);
    t.near(frame.scanned, scan, 1e-12, `${label}: whose sample is the latest scan`);
    t.ok(frame.reading.report[0] === read[0] && frame.reading.report[1] === read[1], `${label}: frame ${count} reads the report again`);
    t.near(frame.mapped.normalized, normalized, 1e-12, `${label}: frame ${count} through the dead zone`);
    t.near(frame.position[0], position[0], 1e-12, `${label}: frame ${count} moves the character`);
    t.near(frame.position[1], position[1], 1e-12, `${label}: frame ${count} moves the character up`);
    t.near(frame.shown, time + FRAME + full.display / 1000, 1e-12, `${label}: frame ${count} reaches the screen a frame and the display’s lag later`);
    t.near(frame.presses, plan.press.events.filter(event => event.pressed && event.frame <= time + 1e-12).length, 0, `${label}: presses handled by frame ${count}`);
  }
  t.near(plan.frames.length, count, 0, `${label}: every frame of the run`);
  const rest = report(plan.motion.rest.t + SCAN);
  t.ok(plan.rest.report[0] === rest[0] && plan.rest.report[1] === rest[1], `${label}: the resting report`);
  t.near(plan.rest.creep, xinput(rest[0], rest[1], zone * FULL) * 5, 1e-12, `${label}: how fast the resting stick creeps`);
  t.near(plan.rest.share, xinputShare(rest), 1e-12, `${label}: the resting share of full travel`);
}
console.log(`progress: the run ${t.count}`);

// 6. The drawing held to the state.
const model = createGamesControllerModel(), top = model.topology, SLOWED = top.SLOW, MMS = top.MM, UP = new THREE.Vector3(0, 1, 0), mmOf = value => value / MMS;
const reportOf = (angles, bits) => angles.map(angle => {
  const levels = 2 ** bits, code = Math.min(levels - 1, Math.max(0, Math.floor((0.5 + SPAN / 2 * angle / TRAVEL) * levels)));
  return Math.max(-32768, Math.min(FULL, Math.round((code + 0.5 - levels / 2) / (SPAN * levels / 2) * FULL)));
});
const scanBefore = time => Math.floor((time - 3e-4) / SCAN + 1e-9) * SCAN + 3e-4, pollBefore = (time, P) => Math.floor((time - 5e-4) / P + 1e-9) * P + 5e-4;
const pollTimes = P => { const out = []; for (let k = Math.floor((CLOCKS.start - 5e-4) / P); 5e-4 + k * P <= CLOCKS.duration + 1e-12; k++) out.push(5e-4 + k * P); return out; };
const pointsOf = (line, count = line.geometry.drawRange.count) => {
  const array = line.geometry.attributes.position.array, n = Math.min(count, array.length / 3);
  return Array.from({length: n}, (_, i) => [array[3 * i] / MMS, array[3 * i + 1] / MMS, array[3 * i + 2] / MMS]);
};
const samePoints = (drawn, expected, message) => {
  t.near(drawn.length, expected.length, 0, `${message}: as many points`);
  expected.forEach(([x, y], i) => {
    t.near(drawn[i][0], x, 2e-3, `${message}: point ${i} across`);
    t.near(drawn[i][1], y, 2e-3, `${message}: point ${i} up`);
    t.near(drawn[i][2], CHARTS.z, 2e-3, `${message}: point ${i} in the charts’ plane`);
  });
};
const TL = CHARTS.timeline, tlx = time => TL.x + (time - CLOCKS.start) / (CLOCKS.duration - CLOCKS.start) * TL.w, tly = v => TL.y + (Math.max(TL.v0, Math.min(TL.v1, v)) - TL.v0) / (TL.v1 - TL.v0) * TL.h;
const MP = CHARTS.map, mpx = s => MP.x + MP.w / 2 + s / MP.range * MP.w / 2, mpy = s => MP.y + MP.h / 2 + s / MP.range * MP.h / 2;
const AD = CHARTS.adc, BO = CHARTS.bounce, box = tau => BO.x + (Math.max(BO.t0, Math.min(BO.t1, tau)) - BO.t0) / (BO.t1 - BO.t0) * BO.w, LA = CHARTS.latency, lax = seconds => LA.x + Math.max(0, Math.min(LA.t1, seconds)) / LA.t1 * LA.w;
const runPress = full => { const P = 1 / POLL_RATES[full.polling]; return pressOnce(full.debounce, P, full.display / 1000, fractionAfter(3e-4, SCAN), fractionAfter(5e-4, P), fractionAfter(5e-3, FRAME)); };
const gateYokes = (gate, phi) => { const reach = Math.tan(TRAVEL) / (gate ? Math.max(Math.abs(Math.cos(phi)), Math.abs(Math.sin(phi))) : 1); return [Math.atan(reach * Math.cos(phi)), Math.atan(reach * Math.sin(phi))]; };

// Sizes: the controller, the thumbstick and the button at true size, the console and monitor at a fifth.
model.reset();
model.root.rotation.set(0, 0, 0);
model.root.updateMatrixWorld(true);
const sizeOf = object => { object.geometry.computeBoundingBox(); return object.geometry.boundingBox.getSize(new THREE.Vector3()).divideScalar(MMS); };
t.near(sizeOf(top.bottomShell).x, 164, 1e-4, 'the controller 164 mm across');
t.near(sizeOf(top.display).x, 531 * SMALL, 1e-4, 'a 24-inch display 531 mm wide, at a fifth');
t.near(sizeOf(top.display).y, 299 * SMALL, 1e-4, 'and 299 mm tall, at a fifth');
t.near(sizeOf(top.consolePart.children[0]).x, 275 * SMALL, 1e-4, 'a console 275 mm wide, at a fifth');
t.near(TRACK_ARC, TRAVEL / (SPAN / 2), 1e-15, 'each potentiometer track spans the lever’s travel and a fifth more');
const scene = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).divideScalar(MMS);
t.ok(scene.x <= 330 && scene.y <= 250 && scene.z <= 170, `the whole bench fits 330 mm so the thumbstick can be framed (${scene.x.toFixed(1)} mm)`);
for (const arc of top.yokeA.children.filter(child => child.geometry?.type === 'TorusGeometry')) t.near(Math.abs(new THREE.Vector3(0, 0, 1).applyQuaternion(arc.quaternion).x), 1, 1e-12, 'yoke A’s arcs stand across x');
for (const arc of top.yokeB.children.filter(child => child.geometry?.type === 'TorusGeometry')) t.near(Math.abs(new THREE.Vector3(0, 0, 1).applyQuaternion(arc.quaternion).z), 1, 1e-12, 'yoke B’s arcs stand across z');
model.root.rotation.set(0.4, -0.35, 0);

const SETTINGS = [{}, {release: 1}, {release: 2, deadzone: 20}, {release: 1, gate: 1, bits: 0}, {debounce: 1, polling: 2}, {debounce: 8, display: 80, bits: 2}, {release: 2, gate: 1, polling: 1, deadzone: 0}];
const TIMES = [-0.02, -0.001, 0, 0.002, 0.006, 0.013, 0.02, 0.0265, 0.037, 0.0385, 0.0399, 0.04, 0.0402, 0.0405, 0.0409, 0.0415, 0.0425, 0.045, 0.0473, 0.0485, 0.05, 0.055, 0.07, 0.1, 0.1017, 0.12, 0.2, 0.3];
for (const values of SETTINGS) {
  const full = {...PAD_DEFAULTS, ...values}, bits = BITS[full.bits], P = 1 / POLL_RATES[full.polling], lag = full.display / 1000, zone = full.deadzone / 100, press = runPress(full), name = JSON.stringify(values);
  model.reset();
  model.update(values);
  const plan = model.getState(), motion = plan.motion, unit = motion.unit, signed = r => Math.sign(r[0] * unit[0] + r[1] * unit[1]) * Math.hypot(...r) / FULL, polls = pollTimes(P);

  // The charts that change only with the settings.
  samePoints(pointsOf(top.zoneLines), [[TL.x, tly(zone)], [TL.x + TL.w, tly(zone)], [TL.x, tly(-zone)], [TL.x + TL.w, tly(-zone)]], `${name}: dead zone on the timeline`);
  samePoints(pointsOf(top.trueLine), Array.from({length: 641}, (_, i) => { const time = CLOCKS.start + (CLOCKS.duration - CLOCKS.start) * i / 640; return [tlx(time), tly(stickAt(motion, time).s / TRAVEL)]; }), `${name}: the stick’s true tilt`);
  const stairs = [];
  polls.forEach((p, i) => { const x = tlx(Math.max(CLOCKS.start, p)), y = tly(signed(reportOf(stickAt(motion, scanBefore(p)).angles, bits))); if (i) stairs.push([x, stairs.at(-1)[1]]); stairs.push([x, y]); });
  stairs.push([tlx(CLOCKS.duration), stairs.at(-1)[1]]);
  samePoints(pointsOf(top.reportLine), stairs, `${name}: the reports at each poll`);
  const frameTimes = [];
  for (let i = Math.ceil((CLOCKS.start - 5e-3) / FRAME - 1e-9); 5e-3 + i * FRAME <= CLOCKS.duration + 1e-12; i++) frameTimes.push(5e-3 + i * FRAME);
  samePoints(pointsOf(top.frameDashes), frameTimes.flatMap(time => { const y = tly(signed(reportOf(stickAt(motion, scanBefore(pollBefore(time, P))).angles, bits))); return [[tlx(time) - 1.5, y], [tlx(time) + 1.5, y]]; }), `${name}: what each frame reads`);
  samePoints(pointsOf(top.frameTicks), frameTimes.flatMap(time => [[tlx(time), TL.y], [tlx(time), TL.y + 3]]), `${name}: the frames’ ticks`);
  samePoints(pointsOf(top.zoneCircle), Array.from({length: 97}, (_, i) => [mpx(zone * Math.cos(i / 96 * 2 * Math.PI)), mpy(zone * Math.sin(i / 96 * 2 * Math.PI))]), `${name}: the dead zone circle`);
  samePoints(pointsOf(top.gateLine), Array.from({length: 145}, (_, i) => { const r = reportOf(gateYokes(full.gate, i / 144 * 2 * Math.PI), bits); return [mpx(r[0] / FULL), mpy(r[1] / FULL)]; }), `${name}: the gate’s outline in reports`);
  samePoints(pointsOf(top.trail, polls.length), polls.map(p => { const r = reportOf(stickAt(motion, scanBefore(p)).angles, bits); return [mpx(r[0] / FULL), mpy(r[1] / FULL)]; }), `${name}: the run’s trail of reports`);
  const center = motion.rest.s * unit[0], lo = center - DEG, hi = center + DEG, r0 = lo / TRAVEL * FULL, r1 = hi / TRAVEL * FULL, levels = 2 ** bits;
  const adx = angle => AD.x + (angle - lo) / (hi - lo) * AD.w, ady = report => AD.y + Math.max(0, Math.min(1, (report - r0) / (r1 - r0))) * AD.h, codeAt = angle => Math.floor((0.5 + SPAN / 2 * angle / TRAVEL) * levels);
  samePoints(pointsOf(top.idealLine), [[adx(lo), ady(r0)], [adx(hi), ady(r1)]], `${name}: a perfect measurement`);
  const steps = pointsOf(top.stepLine);
  let risers = 0;
  t.near(steps[0][0], AD.x, 2e-3, `${name}: the ADC’s steps start at the window’s edge`);
  t.near(steps.at(-1)[0], AD.x + AD.w, 2e-3, `${name}: and end at its other edge`);
  for (let i = 1; i < steps.length; i++) {
    const [ax0, ay0] = steps[i - 1], [ax1, ay1] = steps[i];
    if (Math.abs(ax1 - ax0) < 1e-6) {
      risers++;
      const angle = lo + (ax1 - AD.x) / AD.w * (hi - lo);
      // The drawn points are float32, good to about 1e-8 rad here; a 12-bit step is 2.5e-4 rad.
      t.near(codeAt(angle + 1e-7) - codeAt(angle - 1e-7), 1, 0, `${name}: each riser where the code goes up by one`);
    } else {
      t.near(ay1, ay0, 2e-3, `${name}: each tread level`);
      const middle = lo + ((ax0 + ax1) / 2 - AD.x) / AD.w * (hi - lo);
      t.near(ay0, ady(reportOf([middle], bits)[0]), 2e-3, `${name}: each tread at its code’s report`);
    }
  }
  t.near(risers, codeAt(hi) - codeAt(lo), 0, `${name}: a riser for every code boundary in the window`);
  const scanMarks = [];
  for (let j = -1; j <= 14; j++) { const tau = (fractionAfter(3e-4, SCAN) + j) * SCAN; if (tau >= BO.t0 && tau <= BO.t1) scanMarks.push([box(tau), BO.y + 36], [box(tau), closedAt(tau) ? BO.y + 46 : BO.y + 39]); }
  samePoints(pointsOf(top.scanTicks), scanMarks, `${name}: scans, tall where the contacts are closed`);
  const verdictLine = [[box(BO.t0), BO.y + 20]];
  for (const change of press.changes) verdictLine.push([box(change.at), change.pressed ? BO.y + 20 : BO.y + 30], [box(change.at), change.pressed ? BO.y + 30 : BO.y + 20]);
  verdictLine.push([box(BO.t1), verdictLine.at(-1)[1]]);
  samePoints(pointsOf(top.firmwareLine), verdictLine, `${name}: the firmware’s verdict`);
  const pollMarks = polls.map(p => p - 0.04).filter(tau => tau >= BO.t0 - 1e-12 && tau <= BO.t1).flatMap(tau => [[box(tau), BO.y + 2], [box(tau), BO.y + 5]]);
  samePoints(pointsOf(top.pollTicks), pollMarks, `${name}: the console’s polls`);
  const heardLine = [[box(BO.t0), BO.y + 4]];
  for (const event of press.events) if (event.at <= BO.t1) heardLine.push([box(event.at), event.pressed ? BO.y + 4 : BO.y + 14], [box(event.at), event.pressed ? BO.y + 14 : BO.y + 4]);
  heardLine.push([box(BO.t1), heardLine.at(-1)[1]]);
  samePoints(pointsOf(top.consoleLine), heardLine, `${name}: what the reports tell the console`);
  const spread = latencyOver(full.debounce, full.polling, full.display);
  [[press.registered, press.first - press.registered, press.frame - press.first, FRAME, lag], [spread.parts.debounce, spread.parts.poll, spread.parts.frame, spread.parts.render, spread.parts.display]].forEach((shares, row) => {
    let left = 0;
    shares.forEach((share, k) => {
      const segment = top.bars[row][k];
      t.ok(segment.visible === share > 1e-12, `${name}: bar ${row} segment ${k} shown when it lasts`);
      if (share > 1e-12) {
        t.near(mmOf(segment.scale.x), share / LA.t1 * LA.w, 1e-9, `${name}: bar ${row} segment ${k} as long as its wait`);
        t.near(mmOf(segment.position.x), lax(left) + share / LA.t1 * LA.w / 2, 1e-9, `${name}: bar ${row} segment ${k} after the waits before it`);
      }
      left += share;
    });
  });
  let debounceMean = 0, reportMean = 0;
  for (let i = 0; i < 400; i++) {
    for (let j = 0; j < 400; j++) {
      const again = pressOnce(full.debounce, P, lag, (i + 0.5) / 400, (j + 0.5) / 400, 0.5);
      debounceMean += again.registered / 160000;
      reportMean += again.first / 160000;
    }
  }
  t.near(spread.parts.debounce, debounceMean, 2e-6, `${name}: the average wait for the firmware`);
  t.near(spread.parts.poll, reportMean - debounceMean, 5e-5, `${name}: the average wait for a poll`);
  samePoints(pointsOf(top.histogramLine), [[lax(0), LA.y + 4], ...spread.histogram.flatMap((p, b) => [[lax(b * HISTOGRAM.bin), LA.y + 4 + p * LA.scale], [lax((b + 1) * HISTOGRAM.bin), LA.y + 4 + p * LA.scale]]), [lax(HISTOGRAM.bins * HISTOGRAM.bin), LA.y + 4]], `${name}: how likely each latency is`);
  samePoints(pointsOf(top.meanLine), [[lax(spread.mean), LA.y + 2], [lax(spread.mean), LA.y + 40]], `${name}: the average latency marked`);

  // Every moment: lever, gate, yokes, wipers, spring, button, lights, screen and the charts' moving marks.
  for (const time of TIMES) {
    model.reset();
    model.update(values);
    model.playback.advance((time - CLOCKS.start) * SLOWED);
    model.root.updateMatrixWorld(true);
    const state = model.getState(), clock = state.clock, since = clock - 0.04, label = `${name} at ${fixed(clock * 1000, 2)} ms`, angles = stickAt(motion, clock).angles, alpha = tiltOf(angles).alpha;
    t.near(clock, Math.min(CLOCKS.duration, time), 1e-12, `${label}: the run’s clock`);
    const direction = UP.clone().applyQuaternion(top.lever.quaternion);
    t.near(direction.distanceTo(new THREE.Vector3(Math.tan(angles[0]), 1, -Math.tan(angles[1])).normalize()), 0, 1e-9, `${label}: the lever at its tilt`);
    const reach = full.gate ? reachSquare(angles) : reachRound(angles);
    t.ok(reach <= GATE_RADIUS + 2e-5, `${label}: the lever inside its gate`);
    if (clock <= 0) t.near(reach, GATE_RADIUS, 2e-5, `${label}: held against the gate`);
    t.ok(top.gates[full.gate].visible && !top.gates[1 - full.gate].visible, `${label}: the chosen gate drawn`);
    t.near(new THREE.Vector3(1, 0, 0).applyQuaternion(top.yokeA.quaternion).dot(direction), 0, 1e-9, `${label}: the lever lies in yoke A’s slot`);
    t.near(new THREE.Vector3(0, 0, 1).applyQuaternion(top.yokeB.quaternion).dot(direction), 0, 1e-9, `${label}: the lever lies in yoke B’s slot`);
    t.near(0.5 - top.wiperA.rotation.z / TRACK_ARC, 0.5 + SPAN / 2 * angles[0] / TRAVEL, 1e-12, `${label}: the X wiper along its track as far as its voltage`);
    t.near(0.5 - top.wiperB.rotation.z / TRACK_ARC, 0.5 + SPAN / 2 * angles[1] / TRAVEL, 1e-12, `${label}: the Y wiper along its track as far as its voltage`);
    const springHeight = MODULE.springTop - MODULE.springBottom;
    t.near(top.springGroup.scale.y, (springHeight - MODULE.foot * Math.sin(alpha)) / springHeight, 1e-9, `${label}: the spring pressed by the lever’s foot`);
    t.near(mmOf(top.springPlate.position.y), MODULE.springTop + 0.25 - MODULE.foot * Math.sin(alpha), 1e-9, `${label}: the spring’s plate under the foot`);
    const down = Math.max(0, Math.min(1, (since + BUTTON_AT.reach) / BUTTON_AT.reach)), touching = closedAt(since);
    t.near(mmOf(top.cap.position.y), BUTTON_AT.capTop - BUTTON_AT.height / 2 - BUTTON_AT.travel * down, 1e-9, `${label}: the button’s cap`);
    t.near(mmOf(top.pill.position.y), CONTROLLER.pcb + 0.5 + (since < 0 ? BUTTON_AT.open * (1 - down) : touching ? 0 : BUTTON_AT.bounceGap), 1e-9, `${label}: the carbon pill`);
    t.ok(top.padMaterial.color.getHex() === (touching ? COLORS.lit : COLORS.gate), `${label}: the pads lit while the pill touches them`);
    const verdict = press.changes.filter(change => change.at <= since + 1e-12).reduce((stateNow, change) => change.pressed, false);
    t.ok(top.led.material.color.getHex() === (verdict ? COLORS.led : COLORS.dark), `${label}: the board’s light shows the firmware’s verdict`);
    const into = ((clock - 5e-3) % FRAME + FRAME) % FRAME;
    t.ok(top.frameLight.material.color.getHex() === (into < 0.3 * FRAME ? COLORS.frameLit : COLORS.dark), `${label}: the console’s light at each frame’s start`);
    const shown = plan.frames.filter(frame => frame.t + FRAME + lag <= clock + 1e-12).at(-1), position = shown ? shown.position : [0, 0], half = [MONITOR_AT.display[0] * SMALL / 2 - 4, MONITOR_AT.display[1] * SMALL / 2 - 4];
    t.near(mmOf(top.character.position.x), Math.max(-half[0], Math.min(half[0], MONITOR_AT.start[0] + position[0] * 100)), 1e-9, `${label}: the character where the shown frame put it`);
    t.near(mmOf(top.character.position.y) - top.displayY, Math.max(-half[1], Math.min(half[1], MONITOR_AT.start[1] + position[1] * 100)), 1e-9, `${label}: the character’s height on the display`);
    const handled = shown ? press.events.filter(event => event.pressed && 0.04 + event.frame <= shown.t + 1e-12).length : 0;
    top.rings.forEach((ring, index) => t.ok(ring.visible === handled > index, `${label}: ring ${index + 1} for each press the screen shows`));
    samePoints(pointsOf(top.timelineCursor), [[tlx(clock), TL.y], [tlx(clock), TL.y + TL.h]], `${label}: the timeline’s cursor`);
    t.near(top.trail.geometry.drawRange.count, Math.max(1, polls.filter(p => p <= clock + 1e-12).length), 0, `${label}: the trail so far`);
    const heard = reportOf(stickAt(motion, scanBefore(pollBefore(clock, P))).angles, bits);
    t.near(mmOf(top.reportDot.position.x), mpx(heard[0] / FULL), 1e-9, `${label}: the red dot at the console’s report`);
    t.near(mmOf(top.reportDot.position.y), mpy(heard[1] / FULL), 1e-9, `${label}: the red dot up`);
    t.near(mmOf(top.stickDot.position.x), mpx(angles[0] / TRAVEL), 1e-9, `${label}: the blue ring at the true stick`);
    t.near(mmOf(top.stickDot.position.y), mpy(angles[1] / TRAVEL), 1e-9, `${label}: the blue ring up`);
    const sampled = stickAt(motion, scanBefore(clock)).angles[0], inWindow = sampled >= lo && sampled <= hi;
    t.ok(top.sampleDot.visible === inWindow, `${label}: the ADC’s dot only inside its window`);
    if (inWindow) {
      t.near(mmOf(top.sampleDot.position.x), adx(sampled), 1e-9, `${label}: the ADC’s dot at the sampled angle`);
      t.near(mmOf(top.sampleDot.position.y), ady(reportOf([sampled], bits)[0]), 1e-9, `${label}: the ADC’s dot at its report`);
    }
    t.ok(top.bounceCursor.visible === (since >= BO.t0 && since <= BO.t1), `${label}: the press chart’s cursor inside its window`);
    t.ok(top.latencyCursor.visible === (since >= 0 && since <= LA.t1), `${label}: the latency chart’s cursor inside its window`);
    if (top.latencyCursor.visible) samePoints(pointsOf(top.latencyCursor), [[lax(since), LA.y], [lax(since), LA.y + LA.h]], `${label}: time since the touch`);
  }
}
console.log(`progress: the drawing ${t.count}`);

// 7. What the lessons quote, what the controls move, and what the model owes the viewer.
t.ok(JSON.stringify(BOUNCE) === JSON.stringify(CLOSED), 'the contacts bounce as written again here');
for (let i = 0; i <= 3000; i++) t.ok(contactClosed(i * 1e-6) === closedAt(i * 1e-6), 'contacts closed at the same moments');
const ms = seconds => seconds * 1000, tiltAt = (s, place) => tiltOf([s.motion.unit[0] * place, s.motion.unit[1] * place]).alpha / DEG;
const restTilt = s => tiltAt(s, s.motion.rest.s), firstSwing = s => tiltAt(s, s.motion.run.swings[0].to), startYoke = s => s.motion.start[0] / DEG, fullShare = s => s.full.share * 100;
const defaults = padPlan({});
const machineClaims = {
  'Let go of the stick': s => {
    t.ok(s.motion.rest.s < 0 && s.rest.mapped.normalized === 0 && s.frames.at(-1).velocity.every(v => v === 0), 'rests to the left, inside the dead zone, the character stopped');
    return {'8.13': firstSwing(s), '2.72': restTilt(s), '26.4': ms(s.motion.rest.t), '3,880': -s.rest.report[0], '11.8': s.rest.share * 100, '24': s.values.deadzone};
  },
  'Ease it back': s => {
    t.ok(s.rest.creep === 0 && Math.abs(restTilt(s) - BAND / DEG) < 1e-9, 'eased back to the edge of friction’s band, inside the dead zone');
    return {'5.00': restTilt(s), '21.9': s.rest.share * 100, '24': s.values.deadzone};
  },
  'A smaller dead zone': s => {
    t.ok(s.rest.creep > 0 && s.frames.at(-1).velocity[0] > 0, 'outside a 20% dead zone the untouched stick moves the character');
    return {'21.9': s.rest.share * 100, '20': s.values.deadzone, '0.12': s.rest.creep};
  },
  'The diagonal': s => {
    t.ok(s.full.mapped.normalized === 1, 'the diagonal is clamped to full speed');
    return {'16.7': startYoke(s), '102.7': fullShare(s), '32,767': GAME.full};
  },
  'A square gate': s => {
    t.ok(s.full.mapped.normalized === 1 && Math.abs(s.motion.start[1] - TRAVEL) < 1e-12, 'both yokes at 23°, clamped');
    return {'23': startYoke(s), '141.4': fullShare(s)};
  },
  'Fewer bits': s => {
    t.near(padPlan({bits: 1}).step.angle / s.step.angle, 0.25, 1e-12, 'four times coarser than 10 bits');
    return {'8': s.bits, '0.225': s.step.angle / DEG, '320': s.step.report, '10': BITS[1]};
  },
  'No debounce': s => {
    t.ok(s.press.bounce.presses === 2 && s.press.presses === 2 && s.latency.firmwareDoubles === s.latency.consoleDoubles, 'the console hears both presses the firmware counts');
    return {'2': s.press.presses, '1,000': s.rate, '50': s.latency.consoleDoubles * 100};
  },
  'Where the time goes': s => {
    const parts = [s.press.registered - s.press.t, s.press.reported - s.press.registered, s.press.frame - s.press.reported, s.frame, s.lag];
    t.near(parts.reduce((a, b) => a + b, 0), s.press.latency, 1e-12, 'the waits add up to the latency');
    return {'61.7': ms(s.press.latency), '7.3': ms(parts[0]), '1.2': ms(parts[1]), '6.5': ms(parts[2]), '16.7': ms(parts[3]), '30': ms(parts[4])};
  },
};
const joystickClaims = {
  'Two yokes': s => ({'23': tiltOf(s.motion.start).alpha / DEG, '16.7': startYoke(s)}),
  'Spring against friction': s => ({'11.5': SPRING * TRAVEL * 1000, '2.5': FRICTION * 1000, '5': FRICTION / SPRING / DEG}),
  'Snapping back': s => ({'8.13': firstSwing(s), '13.2': ms(s.motion.run.swings[0].d), '2.72': restTilt(s)}),
  'Eased back': s => ({'5.00': restTilt(s), '7,160': s.rest.report[0], '7,864': s.values.deadzone / 100 * GAME.full, '24': s.values.deadzone}),
  'The potentiometers': s => ({'2.72': restTilt(s), '1.494': s.rest.volts[0], '1.650': wiper(0), '10': s.bits, '463': s.rest.codes[0], '512': adcCode(wiper(0), s.bits)}),
  'A square gate': s => ({'31.0': tiltOf(s.motion.start).alpha / DEG, '141.4': fullShare(s)}),
};
const consoleClaims = {
  'Polls': s => ({'125': s.rate, '8': ms(s.poll), '1.2': ms(s.press.reported - s.press.registered), '4.0': ms(s.latency.parts.poll)}),
  'Poll faster': s => ({'1,000': s.rate, '0.5': ms(s.latency.parts.poll), '65.6': ms(defaults.latency.mean), '62.1': ms(s.latency.mean)}),
  'Waiting for a frame': s => ({'16.7': ms(s.frame), '8.3': ms(s.latency.parts.frame)}),
  'A frame missed': s => {
    t.ok(s.press.frame > defaults.press.frame && s.press.frame - s.frame < s.press.reported && s.press.reported <= s.press.frame, 'the report arrives just after one frame starts, so the next frame handles it');
    return {'8': s.values.debounce, '10.3': ms(s.press.registered - s.press.t), '16.5': ms(s.press.reported - s.press.t), '15.0': ms(s.press.frame - s.frame - s.press.t), '78.3': ms(s.press.latency), '61.7': ms(defaults.press.latency)};
  },
  'A slow display': s => ({'111.7': ms(s.press.latency), '115.6': ms(s.latency.mean), '50': s.values.display - PAD_DEFAULTS.display}),
  'Every timing': s => ({'51.4': ms(s.latency.min), '78.9': ms(s.latency.max), '65.6': ms(s.latency.mean)}),
};
checkTrialNumbers(gamesControllerLesson, machineClaims, values => padPlan(values), t);
checkTrialNumbers(joystickLesson, joystickClaims, values => padPlan(values), t);
checkTrialNumbers(videoGamesConsoleLesson, consoleClaims, values => padPlan(values), t);
const square = padPlan({release: 1, gate: 1});
checkQuotedText(gamesControllerLesson.steps.map(step => step.body).join(' '), {[`${fixed(POLL_RATES[0], 0)} times a second`]: '125 times a second'}, t);
checkQuotedText(gamesControllerLesson.deeper.map(item => item.body).join(' '), {[`${fixed(square.full.share, 2)} times full`]: '1.41 times full', [`bounces for ${fixed(BOUNCE.at(-1)[0] * 1000, 1)} ms`]: 'bounces for 2.6 ms', [`${fixed(1000 / 60, 1)} ms apart at 60 frames a second`]: '16.7 ms apart at 60 frames a second'}, t);
checkQuotedText(gamesControllerLesson.limits, {[`tilting ${fixed(TRAVEL / DEG, 0)}° each way`]: 'tilting 23° each way', [`its ${fixed(OPERATING * 1000, 0)} mN m operating torque`]: 'its 14 mN m operating torque', [`${fixed(SPRING * TRAVEL * 1000, 1)} mN m of spring at full tilt`]: '11.5 mN m of spring at full tilt', [`${fixed(FRICTION * 1000, 1)} mN m of friction`]: '2.5 mN m of friction', [`its ${fixed(BAND / DEG, 0)}° return precision`]: 'its 5° return precision', [`the middle ${fixed(SPAN * 100, 0)}% of their tracks`]: 'the middle 80% of their tracks', [`an ideal ADC on ${fixed(STICK.supply, 1)} V`]: 'an ideal ADC on 3.3 V', [`bounce in one fixed pattern for ${fixed(BOUNCE.at(-1)[0] * 1000, 1)} ms`]: 'bounce in one fixed pattern for 2.6 ms', [`up to ${fixed(GAME.speed, 0)} m/s`]: 'up to 5 m/s', [`damped to a tenth of critical`]: `damped to a tenth of critical`}, t);
checkQuotedText(joystickLesson.deeper.map(item => item.body).join(' '), {[`${fixed(BAND / TRAVEL * 100, 1)}% of the ${fixed(TRAVEL / DEG, 0)}° travel`]: '21.7% of the 23° travel'}, t);
checkQuotedText(joystickLesson.steps.map(step => step.body).join(' '), {[`stops it at ${fixed(TRAVEL / DEG, 0)}° in every direction`]: 'stops it at 23° in every direction'}, t);
checkQuotedText(videoGamesConsoleLesson.deeper.map(item => item.body).join(' '), {[`that is ${fixed(1000 / 60, 1)} ms`]: 'that is 16.7 ms'}, t);
checkQuotedText(videoGamesConsoleLesson.quiz.explanation, {[`a poll adds ${fixed(ms(defaults.latency.parts.poll), 1)} ms on average`]: 'a poll adds 4.0 ms on average', [`${fixed(ms(defaults.latency.parts.frame), 1)} ms of waiting and ${fixed(ms(defaults.frame), 1)} ms of drawing`]: '8.3 ms of waiting and 16.7 ms of drawing'}, t);

// The readings say what the state says.
model.reset();
model.playback.advance(1e3);
const readings = Object.fromEntries(model.getState().readings.map(item => [item.label, item]));
t.ok(readings.Latency.value === `This press: ${fixed(ms(defaults.press.latency), 1)} ms from touch to screen`, 'the latency reading');
t.ok(readings.Report.value === `X −${fixed(-defaults.rest.report[0], 0)} · Y ${fixed(defaults.rest.report[1], 0)} · ${fixed(defaults.rest.share * 100, 1)}% of full`, 'the resting report reading');
t.ok(readings['Your result'].value.startsWith(`Stick at rest ${fixed(restTilt(defaults), 2)}° left of center, inside the dead zone`), 'the result reading');
t.ok(model.playback.complete(), 'the run ends');
t.near(samplePad({}, 0.06).now.t, 0.04, 1e-15, 'trial time counts from the start of the run');

const snapshot = () => [top.lever.quaternion.toArray(), top.gates.map(gate => gate.visible), top.character.position.toArray(), top.rings.map(ring => ring.visible), top.bars.flat().map(bar => [bar.scale.x, bar.position.x, bar.visible]),
  ...[top.trueLine, top.reportLine, top.zoneLines, top.gateLine, top.stepLine, top.firmwareLine, top.pollTicks, top.consoleLine, top.histogramLine, top.meanLine, top.frameDashes].map(line => Array.from(line.geometry.attributes.position.array))];
checkControlsMove(model, snapshot, m => m.playback.advance(1e3), t);
model.reset();
model.update({release: 1, gate: 1, bits: 0, deadzone: 0, debounce: 1, polling: 2, display: 80});
model.playback.advance(3);
checkFinite(model.root, t);
checkRefusals(samplePad, PAD_DOMAINS, t);
const resources = checkDisposal(model, t);
const trials = gamesControllerLesson.tryIt.length + joystickLesson.tryIt.length + videoGamesConsoleLesson.tryIt.length;
console.log(`PASS games controller: ${t.count} checks, ${trials} trials across three lessons, ${resources} resources released exactly once.`);

import {validateControls, validTime} from './physics-kit.js';

// Voltage multiplier: a half-wave Cockcroft-Walton ladder, simulated cycle by
// cycle from uncharged capacitors.
//
// Units: SI inside. Readings convert to volts, microamps, microfarads, hertz,
// milliseconds and millijoules.
//
// The circuit. An alternating source, Vp sin(2 pi f t) behind 50 ohms of
// winding resistance, drives a column of N pump capacitors in series; a second
// column of N smoothing capacitors rises from ground. Diodes zigzag between
// the columns: from each smoothing node up to the pump node above it, and from
// each pump node across to the smoothing node level with it. The output is the
// top smoothing node, loaded by a resistor that draws the set current at the
// ideal output, 2 N Vp.
//
// Parts. Silicon rectifier diodes, idealized as a 0.7 V drop in series with
// 5 ohms when forward biased and 1 gigaohm when not; equal, ideal capacitors.
//
// Simulation. Modified nodal analysis stepped by backward Euler, 240 steps a
// cycle: each capacitor becomes a conductance C / dt with a current source
// holding its last voltage; each diode's state is guessed, the node equations
// are solved by Gaussian elimination, and the guess is corrected until every
// diode agrees with the voltage across it. The first 40 cycles are kept for
// playback; the run continues to 400 cycles for the steady state.
//
// Reference. For ideal diodes, a stiff source, equal capacitors and a small
// steady load current I, the textbook steady state is an output of 2 N Vp less
// a sag (I / (f C))(2N^3/3 + N^2/2 - N/6), with a peak-to-peak ripple of
// (I / (f C)) N (N + 1) / 2.
//
// Not modeled: diode capacitance and reverse recovery, capacitor leakage and
// resistance, the transformer's leakage inductance, stray capacitance, and
// corona at high voltage.

export const LADDER = Object.freeze({source: 50, drop: 0.7, on: 5, off: 1e9, steps: 240, cycles: 400, played: 40, kept: 60});
export const MULTIPLIER_DEFAULTS = Object.freeze({stages: 2, peak: 50, frequency: 50, capacitance: 1, load: 100});
export const MULTIPLIER_DOMAINS = Object.freeze({stages: [1, 4, 1], peak: [20, 100, 10], frequency: [50, 1000, 50], capacitance: [0.5, 5, 0.5], load: [0, 500, 25]});

/** Textbook steady state for ideal diodes and a small steady load. */
export function textbook({stages: N, peak, frequency, capacitance, load}) {
  const k = load * 1e-6 / (frequency * capacitance * 1e-6);
  return {ideal: 2 * N * peak, sag: k * (2 * N ** 3 / 3 + N * N / 2 - N / 6), ripple: k * N * (N + 1) / 2};
}

/** Node names: 0 the source terminal, 1..N the pump column, N+1..2N the smoothing column; -1 is ground. */
export const pumpNode = (N, k) => (k === 0 ? 0 : k);
export const smoothNode = (N, k) => (k === 0 ? -1 : N + k);
/** Diodes as [anode, cathode]: odd ones charge the pump column, even ones transfer to the smoothing column. */
export const diodesOf = N => Array.from({length: 2 * N}, (_, i) => {
  const k = Math.floor(i / 2) + 1;
  return i % 2 === 0 ? [smoothNode(N, k - 1), pumpNode(N, k)] : [pumpNode(N, k), smoothNode(N, k)];
});
export const capacitorsOf = N => [...Array.from({length: N}, (_, i) => [pumpNode(N, i), pumpNode(N, i + 1)]), ...Array.from({length: N}, (_, i) => [smoothNode(N, i), smoothNode(N, i + 1)])];

function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (f) for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j]; x[r] = s / M[r][r]; }
  return x;
}

const cache = new Map();

/** Simulate the ladder. `parts` may override the source, diode and step constants, for checks. */
export function simulateLadder(input = {}, parts = {}) {
  const values = validateControls(input, MULTIPLIER_DEFAULTS, MULTIPLIER_DOMAINS, 'voltage multiplier');
  const L = {...LADDER, ...parts}, key = JSON.stringify([values, L]);
  if (cache.has(key)) return cache.get(key);
  const N = values.stages, n = 2 * N + 1, C = values.capacitance * 1e-6, w = 2 * Math.PI * values.frequency;
  const dt = 1 / (values.frequency * L.steps), Gc = C / dt, Gs = 1 / L.source, Gl = values.load * 1e-6 / (2 * N * values.peak);
  const diodes = diodesOf(N), caps = capacitorsOf(N), out = smoothNode(N, N);
  const volt = (v, node) => (node < 0 ? 0 : v[node]);
  let v = new Array(n).fill(0), states = new Array(2 * N).fill(false);
  const energy = {source: 0, load: 0, winding: 0, diodes: 0};
  const samples = [], lastCycle = [], every = L.steps / L.kept;
  for (let step = 1; step <= L.cycles * L.steps; step++) {
    const t = step * dt, e = values.peak * Math.sin(w * t), previous = v;
    let x = v;
    for (let iteration = 0; iteration < 40; iteration++) {
      const A = Array.from({length: n}, () => new Array(n).fill(0)), b = new Array(n).fill(0);
      const conductance = (i, j, g) => { if (i >= 0) A[i][i] += g; if (j >= 0) A[j][j] += g; if (i >= 0 && j >= 0) { A[i][j] -= g; A[j][i] -= g; } };
      const inject = (i, j, current) => { if (i >= 0) b[i] += current; if (j >= 0) b[j] -= current; };
      conductance(0, -1, Gs); b[0] += Gs * e;
      for (const [i, j] of caps) { conductance(i, j, Gc); inject(i, j, Gc * (volt(previous, i) - volt(previous, j))); }
      diodes.forEach(([p, q], d) => { if (states[d]) { conductance(p, q, 1 / L.on); inject(p, q, L.drop / L.on); } else conductance(p, q, 1 / L.off); });
      conductance(out, -1, Gl);
      x = solve(A, b);
      const next = diodes.map(([p, q]) => volt(x, p) - volt(x, q) > L.drop);
      if (next.every((s, d) => s === states[d])) break;
      states = next;
    }
    v = x;
    const sourceCurrent = Gs * (e - v[0]), currents = diodes.map(([p, q], d) => (states[d] ? (volt(v, p) - volt(v, q) - L.drop) / L.on : (volt(v, p) - volt(v, q)) / L.off));
    energy.source += e * sourceCurrent * dt;
    energy.winding += sourceCurrent * sourceCurrent * L.source * dt;
    energy.load += volt(v, out) ** 2 * Gl * dt;
    energy.diodes += diodes.reduce((sum, [p, q], d) => sum + currents[d] * (volt(v, p) - volt(v, q)) * dt, 0);
    if (step <= L.played * L.steps && step % every === 0) samples.push({t, e, nodes: [...v], output: volt(v, out), on: [...states], currents});
    if (step > (L.cycles - 1) * L.steps) lastCycle.push({t, e, output: volt(v, out), nodes: [...v], on: [...states], currents, sourceCurrent});
  }
  const stored = caps.reduce((sum, [i, j]) => sum + 0.5 * C * (volt(v, i) - volt(v, j)) ** 2, 0);
  const outputs = lastCycle.map(sample => sample.output), mean = outputs.reduce((s, o) => s + o, 0) / outputs.length;
  const result = {
    values, parts: L, N, dt, loadConductance: Gl, samples, lastCycle, energy: {...energy, stored},
    steady: {mean, low: Math.min(...outputs), high: Math.max(...outputs), ripple: Math.max(...outputs) - Math.min(...outputs), current: mean * Gl},
    textbook: textbook(values),
  };
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

/** The ladder a while after switching on, as played back: the first 40 cycles. */
export function sampleLadder(input = {}, cycles = 0) {
  validTime(cycles);
  const run = simulateLadder(input), last = run.samples.length - 1, position = Math.min(last, cycles * LADDER.kept - 1);
  const index = Math.max(0, Math.round(position));
  return {...run, cycle: Math.min(LADDER.played, cycles), now: cycles <= 0 ? {t: 0, e: 0, nodes: new Array(2 * run.N + 1).fill(0), output: 0, on: new Array(2 * run.N).fill(false), currents: new Array(2 * run.N).fill(0)} : run.samples[index]};
}

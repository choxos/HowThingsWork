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
// 5 ohms when forward biased, with a 1 gigaohm leakage path in parallel;
// equal, ideal capacitors.
//
// Simulation. Modified nodal analysis stepped by backward Euler, 240 steps a
// cycle: each capacitor becomes a conductance C / dt with a current source
// holding its last voltage; each diode's state is guessed, the node equations
// are solved with a cached Cholesky factor, and the guess is corrected until every
// diode agrees with the voltage across it. The first 40 cycles are kept for
// playback; the run continues to 400 cycles for a separately timed late-cycle view.
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

// Every switched network is positive definite: the capacitor companions connect
// both columns to ground or to the finite source resistance. Cache its Cholesky
// factor for each diode-state mask; only the history/source right-hand side changes.
function factor(A, n) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let x = A[i * n + j];
    for (let k = 0; k < j; k++) x -= L[i * n + k] * L[j * n + k];
    if (i === j) {
      if (!(x > 0) || !Number.isFinite(x)) throw new Error('Invalid voltage multiplier network matrix.');
      L[i * n + j] = Math.sqrt(x);
    } else L[i * n + j] = x / L[j * n + j];
  }
  return L;
}
function solve(L, b, n) {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let y = b[i];
    for (let j = 0; j < i; j++) y -= L[i * n + j] * x[j];
    x[i] = y / L[i * n + i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let y = x[i];
    for (let j = i + 1; j < n; j++) y -= L[j * n + i] * x[j];
    x[i] = y / L[i * n + i];
  }
  return x;
}

/** Continuous piecewise-linear diode with a parallel leakage path. */
export const diodeCurrent = (voltage, parts = LADDER) => voltage / parts.off + Math.max(0, (voltage - parts.drop) / parts.on);

const cache = new Map();

/** Simulate a finite transient. The final cycle is not assumed to be steady. */
export function simulateLadder(input = {}, parts = {}) {
  const values = validateControls(input, MULTIPLIER_DEFAULTS, MULTIPLIER_DOMAINS, 'voltage multiplier');
  const L = {...LADDER, ...parts}, key = JSON.stringify([values, L]);
  for (const name of Object.keys(parts)) if (!Object.hasOwn(LADDER, name)) throw new RangeError(`Unknown ladder constant: ${name}`);
  for (const name of ['source', 'on', 'off']) if (!(L[name] > 0) || !Number.isFinite(L[name])) throw new RangeError(`Invalid ladder ${name}`);
  if (!(L.drop >= 0) || !Number.isFinite(L.drop)) throw new RangeError('Invalid diode drop');
  for (const name of ['steps', 'cycles', 'played', 'kept']) if (!Number.isInteger(L[name]) || L[name] < 1) throw new RangeError(`Invalid ladder ${name}`);
  if (L.steps % L.kept || L.cycles < Math.max(2, L.played)) throw new RangeError('Invalid ladder sampling window');
  if (cache.has(key)) return cache.get(key);
  const N = values.stages, n = 2 * N + 1, C = values.capacitance * 1e-6, w = 2 * Math.PI * values.frequency;
  const dt = 1 / (values.frequency * L.steps), Gc = C / dt, Gs = 1 / L.source, Gl = values.load * 1e-6 / (2 * N * values.peak);
  const diodes = diodesOf(N), caps = capacitorsOf(N), out = smoothNode(N, N);
  const volt = (v, node) => (node < 0 ? 0 : v[node]);
  const networks = new Map();
  const network = states => {
    const mask = states.reduce((bits, on, d) => bits | (Number(on) << d), 0);
    if (networks.has(mask)) return networks.get(mask);
    const A = new Float64Array(n * n), offset = new Float64Array(n);
    const link = (i, j, g) => {
      if (i >= 0) A[i * n + i] += g;
      if (j >= 0) A[j * n + j] += g;
      if (i >= 0 && j >= 0) {A[i * n + j] -= g; A[j * n + i] -= g;}
    };
    link(0, -1, Gs); link(out, -1, Gl);
    for (const [i, j] of caps) link(i, j, Gc);
    diodes.forEach(([i, j], d) => {
      link(i, j, 1 / L.off + (states[d] ? 1 / L.on : 0));
      if (states[d]) {if (i >= 0) offset[i] += L.drop / L.on; if (j >= 0) offset[j] -= L.drop / L.on;}
    });
    const result = {factor: factor(A, n), offset}; networks.set(mask, result); return result;
  };
  let v = new Float64Array(n), states = new Array(2 * N).fill(false), maxIterations = 0;
  const energy = {source: 0, load: 0, winding: 0, diodes: 0, numerical: 0};
  const samples = [], lastCycle = [], previousCycle = [], every = L.steps / L.kept;
  for (let step = 1; step <= L.cycles * L.steps; step++) {
    const t = step * dt, e = values.peak * Math.sin(w * t), previous = v, history = new Float64Array(n);
    history[0] = Gs * e;
    for (const [i, j] of caps) {
      const current = Gc * (volt(previous, i) - volt(previous, j));
      if (i >= 0) history[i] += current;
      if (j >= 0) history[j] -= current;
    }
    let x, converged = false;
    for (let iteration = 0; iteration < 40; iteration++) {
      const system = network(states), b = Float64Array.from(history, (value, i) => value + system.offset[i]);
      x = solve(system.factor, b, n);
      const next = diodes.map(([i, j]) => volt(x, i) - volt(x, j) > L.drop);
      if (next.every((on, d) => on === states[d])) {converged = true; maxIterations = Math.max(maxIterations, iteration + 1); break;}
      states = next;
    }
    if (!converged) throw new Error(`Diode states did not converge at multiplier step ${step}.`);
    v = x;
    const sourceCurrent = Gs * (e - v[0]);
    const currents = diodes.map(([i, j]) => diodeCurrent(volt(v, i) - volt(v, j), L));
    const numericalEnergy = caps.reduce((sum, [i, j]) => sum + 0.5 * C * ((volt(v, i) - volt(v, j)) - (volt(previous, i) - volt(previous, j))) ** 2, 0);
    const powers = {
      source: e * sourceCurrent,
      winding: sourceCurrent ** 2 * L.source,
      load: volt(v, out) ** 2 * Gl,
      diodes: diodes.reduce((sum, [i, j], d) => sum + currents[d] * (volt(v, i) - volt(v, j)), 0),
      numerical: numericalEnergy / dt,
    };
    for (const name of Object.keys(powers)) energy[name] += powers[name] * dt;
    const record = () => ({t, e, nodes: [...v], output: volt(v, out), on: [...states], currents, sourceCurrent, powers});
    if (step <= L.played * L.steps && step % every === 0) samples.push(record());
    if (step > (L.cycles - 2) * L.steps && step <= (L.cycles - 1) * L.steps) previousCycle.push(record());
    if (step > (L.cycles - 1) * L.steps) lastCycle.push(record());
  }
  const stored = caps.reduce((sum, [i, j]) => sum + 0.5 * C * (volt(v, i) - volt(v, j)) ** 2, 0);
  const outputs = lastCycle.map(sample => sample.output), mean = outputs.reduce((s, o) => s + o, 0) / outputs.length;
  const nodeCycleChange = Math.max(...lastCycle.flatMap((sample, index) => sample.nodes.map((value, node) => Math.abs(value - previousCycle[index].nodes[node]))));
  const meanPower = name => lastCycle.reduce((sum, sample) => sum + sample.powers[name], 0) / lastCycle.length;
  const result = {
    values, parts: L, N, dt, loadConductance: Gl, samples, lastCycle, previousCycle, energy: {...energy, stored},
    late: {cycle: L.cycles, mean, low: Math.min(...outputs), high: Math.max(...outputs), ripple: Math.max(...outputs) - Math.min(...outputs), current: mean * Gl,
      loadPower: meanPower('load'), sourcePower: meanPower('source'), nodeCycleChange,
      // A measured cycle-to-cycle change, not an assertion of an infinite-time limit.
      repeating: nodeCycleChange < 0.001},
    solver: {maxIterations, switchedNetworks: networks.size}, textbook: textbook(values),
  };
  if (cache.size >= 12) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

/** Sample the startup or the final simulated cycle; never interpolate diode states. */
export function sampleLadder(input = {}, cycles = 0, window = 'startup') {
  validTime(cycles);
  if (!['startup', 'late'].includes(window)) throw new RangeError('Unknown multiplier time window');
  const run = simulateLadder(input), start = window === 'late' ? run.parts.cycles - 1 : 0, end = window === 'late' ? run.parts.cycles : run.parts.played;
  const cycle = Math.max(start, Math.min(end, cycles)), samples = window === 'late' ? run.lastCycle : run.samples;
  const index = Math.max(0, Math.min(samples.length - 1, Math.round((cycle - start) * (window === 'late' ? run.parts.steps : run.parts.kept)) - 1));
  const zero = {t: 0, e: 0, nodes: new Array(2 * run.N + 1).fill(0), output: 0, on: new Array(2 * run.N).fill(false), currents: new Array(2 * run.N).fill(0), sourceCurrent: 0};
  return {...run, cycle, window, start, end, now: cycle <= start ? (window === 'late' ? run.previousCycle.at(-1) : zero) : samples[index]};
}

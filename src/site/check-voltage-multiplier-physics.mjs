// Voltage multiplier: the ladder simulated again with Gear's second-order
// method at four times the steps, energy accounted for, charge kept (the source
// passes no net charge over a cycle and every diode carries the load's charge),
// the no-load limit 2N(Vp - 0.7 V), the textbook formulas approached with
// near-ideal parts, the drawing held to the state, and every number the lesson
// quotes held to the model.
import assert from 'node:assert/strict';
import {simulateLadder, sampleLadder, textbook, diodesOf, diodeCurrent, LADDER, MULTIPLIER_DOMAINS} from './voltage-multiplier-physics.js';
import {tally, checkRefusals} from './model-check-kit.mjs';

const t = tally();

function gauss(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let best = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[best][c])) best = r;
    [M[c], M[best]] = [M[best], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// 1. The ladder again, by Gear's second-order backward difference, 960 steps a cycle.
function gear(given, cycles) {
  const values = {stages: 2, peak: 50, frequency: 50, capacitance: 1, load: 100, ...given}, N = values.stages, n = 2 * N + 1;
  const C = values.capacitance * 1e-6, f = values.frequency, steps = 960, dt = 1 / (f * steps), Gs = 1 / 50, Gl = values.load * 1e-6 / (2 * N * values.peak);
  const pump = k => k, smooth = k => (k === 0 ? -1 : N + k), at = (v, i) => (i < 0 ? 0 : v[i]);
  const caps = [], diodes = [];
  for (let k = 1; k <= N; k++) { caps.push([pump(k - 1), pump(k)], [smooth(k - 1), smooth(k)]); diodes.push([smooth(k - 1), pump(k)], [pump(k), smooth(k)]); }
  let v = new Array(n).fill(0), older = new Array(n).fill(0), on = new Array(diodes.length).fill(false);
  const record = [], last = [];
  for (let step = 1; step <= cycles * steps; step++) {
    const e = values.peak * Math.sin(2 * Math.PI * f * step * dt), first = step === 1, G = first ? C / dt : 1.5 * C / dt;
    let x = v;
    for (let iteration = 0; iteration < 60; iteration++) {
      const A = Array.from({length: n}, () => new Array(n).fill(0)), b = new Array(n).fill(0);
      const link = (i, j, g) => { if (i >= 0) A[i][i] += g; if (j >= 0) A[j][j] += g; if (i >= 0 && j >= 0) { A[i][j] -= g; A[j][i] -= g; } };
      const push = (i, j, current) => { if (i >= 0) b[i] += current; if (j >= 0) b[j] -= current; };
      link(0, -1, Gs); b[0] += Gs * e;
      for (const [i, j] of caps) push(i, j, first ? C / dt * (at(v, i) - at(v, j)) : C / dt * (2 * (at(v, i) - at(v, j)) - 0.5 * (at(older, i) - at(older, j))));
      for (const [i, j] of caps) link(i, j, G);
      diodes.forEach(([p, q], d) => { if (on[d]) { link(p, q, 0.2 + 1e-9); push(p, q, 0.7 * 0.2); } else link(p, q, 1e-9); });
      const top = smooth(N);
      A[top][top] += Gl;
      x = gauss(A, b);
      const next = diodes.map(([p, q]) => at(x, p) - at(x, q) > 0.7);
      if (next.every((state, d) => state === on[d])) break;
      on = next;
    }
    older = v;
    v = x;
    if (step % (steps / 60) === 0 && step <= 40 * steps) record.push(at(v, smooth(N)));
    if (step > (cycles - 1) * steps) last.push(at(v, smooth(N)));
  }
  return {record, mean: last.reduce((s, o) => s + o, 0) / last.length, ripple: Math.max(...last) - Math.min(...last)};
}
for (const values of [{}, {stages: 1}, {stages: 4, peak: 100, capacitance: 0.5, load: 500}]) {
  const run = simulateLadder(values), again = gear(values, LADDER.cycles), where = JSON.stringify(values);
  for (const cycle of [1, 5, 10, 20, 40]) t.near(run.samples[cycle * 60 - 1].output, again.record[cycle * 60 - 1], 0.004 * again.record[cycle * 60 - 1] + 0.3, `${where}: output after ${cycle} cycles`);
  t.near(run.late.mean, again.mean, 0.003 * again.mean, `${where}: steady output`);
  t.near(run.late.ripple, again.ripple, 0.03 * again.ripple + 0.05, `${where}: steady ripple`);
}

// 2. Energy, charge, and the limits.
for (const values of [{}, {stages: 3}, {stages: 4}, {frequency: 500}, {capacitance: 5}, {stages: 4, peak: 100, capacitance: 0.5, load: 500}, {load: 0}]) {
  const run = simulateLadder(values), where = JSON.stringify(values), {source, load, winding, diodes, stored} = run.energy;
  t.near(source, load + winding + diodes + stored, 0.03 * source, `${where}: energy from the source accounted for`);
  t.ok(load <= source && stored > 0, `${where}: no energy made`);
  const period = run.lastCycle.length, loadCurrent = run.late.current;
  const sourceMean = run.lastCycle.reduce((sum, sample) => sum + sample.sourceCurrent, 0) / period;
  t.ok(Math.abs(sourceMean) <= 0.02 * loadCurrent + 2e-8, `${where}: the source passes no net charge through the pump column`);
  for (let d = 0; d < 2 * run.N; d++) {
    const mean = run.lastCycle.reduce((sum, sample) => sum + sample.currents[d], 0) / period;
    t.near(mean, loadCurrent, 0.03 * loadCurrent + 2e-8, `${where}: diode ${d + 1} carries the load’s charge each cycle`);
  }
  for (const sample of run.lastCycle.filter((_, i) => i % 24 === 0)) {
    diodesOf(run.N).forEach(([p, q], d) => {
      const across = (p < 0 ? 0 : sample.nodes[p]) - (q < 0 ? 0 : sample.nodes[q]);
      t.ok(sample.on[d] === across > LADDER.drop, `${where}: diode ${d + 1} conducts exactly when forward biased past 0.7 V`);
    });
  }
}
for (const [values, tolerance] of [[{stages: 1, load: 0}, 0.2], [{stages: 2, load: 0}, 0.2], [{stages: 4, peak: 20, capacitance: 0.5, load: 0}, 0.2], [{stages: 4, load: 0}, 0.5]]) {
  const run = simulateLadder(values);
  t.near(run.late.mean, 2 * run.N * (run.values.peak - 0.7), tolerance, `${JSON.stringify(values)}: no-load output 2N(Vp - 0.7 V)`);
}
for (const values of [{}, {stages: 4}, {frequency: 500}, {stages: 3, capacitance: 2}]) {
  const ideal = simulateLadder(values, {source: 1e-3, drop: 0, on: 1e-3}), current = ideal.late.current * 1e6, formula = textbook({...ideal.values, load: current});
  t.near(formula.ideal - ideal.late.mean, formula.sag, 0.15 * formula.sag, `${JSON.stringify(values)}: near-ideal ladder sags as the textbook says`);
  t.near(ideal.late.ripple, formula.ripple, 0.1 * formula.ripple, `${JSON.stringify(values)}: near-ideal ladder ripples as the textbook says`);
}
for (const values of [{stages: 1}, {stages: 4}, {load: 350}]) {
  const tb = textbook({...simulateLadder(values).values});
  const N = tb.ideal / (2 * simulateLadder(values).values.peak), k = simulateLadder(values).values.load * 1e-6 / (simulateLadder(values).values.frequency * simulateLadder(values).values.capacitance * 1e-6);
  t.near(tb.sag, k * (2 * N ** 3 / 3 + N * N / 2 - N / 6), 1e-9, 'textbook sag');
  t.near(tb.ripple, k * N * (N + 1) / 2, 1e-9, 'textbook ripple');
}

// The leakage path stays present during forward conduction, avoiding a
// downward current jump at the threshold of the piecewise-linear diode.
for(const v of[-100,0,.7-1e-10,.7,.7+1e-10,1,100]) {
  t.near(diodeCurrent(v),v/1e9+Math.max(0,(v-.7)/5),1e-15,'parallel leakage and forward branch');
  t.ok(diodeCurrent(v+1e-9)>=diodeCurrent(v),'diode current is monotone');
}
t.near(diodeCurrent(.7-1e-10),diodeCurrent(.7+1e-10),3e-11,'current is continuous at threshold');
// Finite-time labels, average resistive power and exact discrete energy account.
let corners = 0;
for (const stages of [1, 2, 3, 4]) for (const frequency of [50, 1000]) for (const capacitance of [.5, 5]) for (const load of [0, 500]) {
  const values = {stages, peak: 100, frequency, capacitance, load}, run = simulateLadder(values); corners++;
  const e = run.energy;
  t.near(e.source, e.load + e.winding + e.diodes + e.stored + e.numerical, Math.abs(e.source) * 1e-7, 'discrete energy includes backward-Euler damping');
  t.ok(run.solver.maxIterations < 40, 'every diode-state solve converged');
  const power = run.lastCycle.reduce((sum, sample) => sum + sample.output ** 2 * run.loadConductance, 0) / run.lastCycle.length;
  t.near(run.late.loadPower, power, 1e-13, 'power averages voltage squared');
  const drift = Math.max(...run.lastCycle.flatMap((sample, i) => sample.nodes.map((v, n) => Math.abs(v - run.previousCycle[i].nodes[n]))));
  t.near(run.late.nodeCycleChange, drift, 1e-13, 'matched-phase drift across all nodes');
  assert.equal(run.late.repeating, drift < .001);
  for (const cycle of [399,399.25,399.5,399.75,400,401]) {
    const state = sampleLadder(values,cycle,'late');
    t.near(state.cycle,Math.min(400,cycle),1e-12,'late window retains absolute source cycle');
    t.near(state.now.t * frequency,state.cycle,1e-9,'late samples have the stated physical time');
    const smoothing = Array.from({length:stages},(_,i)=>state.now.nodes[stages+i+1]-(i?state.now.nodes[stages+i]:0));
    t.near(smoothing.reduce((sum,v)=>sum+v,0),state.now.output,1e-10,'capacitor voltage differences add to output');
  }
}
const slow=simulateLadder({stages:4,peak:100,frequency:1000,capacitance:5,load:0});
t.ok(!slow.late.repeating && slow.late.nodeCycleChange > .01,'slow no-load case is explicitly still settling');
for(const bad of [{steps:241},{cycles:1},{source:0},{on:-1},{drop:NaN},{extra:1}])assert.throws(()=>simulateLadder({},bad),RangeError);
assert.throws(()=>sampleLadder({},0,'unknown'),RangeError);
checkRefusals(sampleLadder,MULTIPLIER_DOMAINS,t);
console.log(`PASS voltage-multiplier physics: ${t.count} checks; ${corners} boundary settings; 3 independent Gear integrations`);

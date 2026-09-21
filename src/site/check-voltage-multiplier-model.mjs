// Voltage multiplier: the ladder simulated again with Gear's second-order
// method at four times the steps, energy accounted for, charge kept (the source
// passes no net charge over a cycle and every diode carries the load's charge),
// the no-load limit 2N(Vp - 0.7 V), the textbook formulas approached with
// near-ideal parts, the drawing held to the state, and every number the lesson
// quotes held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {simulateLadder, sampleLadder, textbook, diodesOf, LADDER, MULTIPLIER_DOMAINS} from './voltage-multiplier-physics.js';
import {createVoltageMultiplierModel, nodePlace, capacitorSize, BAR_CHART, OUTPUT_CHART} from './voltage-multiplier-model.js';
import {voltageMultiplierLesson} from './voltage-multiplier-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

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
      diodes.forEach(([p, q], d) => { if (on[d]) { link(p, q, 0.2); push(p, q, 0.7 * 0.2); } else link(p, q, 1e-9); });
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
  t.near(run.steady.mean, again.mean, 0.003 * again.mean, `${where}: steady output`);
  t.near(run.steady.ripple, again.ripple, 0.03 * again.ripple + 0.05, `${where}: steady ripple`);
}

// 2. Energy, charge, and the limits.
for (const values of [{}, {stages: 3}, {stages: 4}, {frequency: 500}, {capacitance: 5}, {stages: 4, peak: 100, capacitance: 0.5, load: 500}, {load: 0}]) {
  const run = simulateLadder(values), where = JSON.stringify(values), {source, load, winding, diodes, stored} = run.energy;
  t.near(source, load + winding + diodes + stored, 0.03 * source, `${where}: energy from the source accounted for`);
  t.ok(load <= source && stored > 0, `${where}: no energy made`);
  const period = run.lastCycle.length, loadCurrent = run.steady.current;
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
  t.near(run.steady.mean, 2 * run.N * (run.values.peak - 0.7), tolerance, `${JSON.stringify(values)}: no-load output 2N(Vp - 0.7 V)`);
}
for (const values of [{}, {stages: 4}, {frequency: 500}, {stages: 3, capacitance: 2}]) {
  const ideal = simulateLadder(values, {source: 1e-3, drop: 0, on: 1e-3}), current = ideal.steady.current * 1e6, formula = textbook({...ideal.values, load: current});
  t.near(formula.ideal - ideal.steady.mean, formula.sag, 0.15 * formula.sag, `${JSON.stringify(values)}: near-ideal ladder sags as the textbook says`);
  t.near(ideal.steady.ripple, formula.ripple, 0.1 * formula.ripple, `${JSON.stringify(values)}: near-ideal ladder ripples as the textbook says`);
}
for (const values of [{stages: 1}, {stages: 4}, {load: 350}]) {
  const tb = textbook({...simulateLadder(values).values});
  const N = tb.ideal / (2 * simulateLadder(values).values.peak), k = simulateLadder(values).values.load * 1e-6 / (simulateLadder(values).values.frequency * simulateLadder(values).values.capacitance * 1e-6);
  t.near(tb.sag, k * (2 * N ** 3 / 3 + N * N / 2 - N / 6), 1e-9, 'textbook sag');
  t.near(tb.ripple, k * N * (N + 1) / 2, 1e-9, 'textbook ripple');
}

// 3. The drawing.
const m = createVoltageMultiplierModel(), p = m.topology, MM = p.MM;
const EMPTY = new THREE.Color(0xf0dfaf), FULL = new THREE.Color(0xe3b45e);
for (const values of [{}, {stages: 1, capacitance: 0.5}, {stages: 4, capacitance: 5}, {stages: 3, load: 0, frequency: 1000}, {stages: 4, peak: 100, capacitance: 0.5, load: 500}]) for (const cycles of [0, 0.5, 3.25, 17, 40, 55]) {
  m.reset(); m.update(values); m.advance(cycles / p.CYCLES_PER_SECOND);
  m.root.updateMatrixWorld(true);
  const s = m.getState(), N = s.N, now = s.now, top = 2 * N * s.values.peak, where = `${JSON.stringify(values)} at ${cycles} cycles`;
  t.near(s.cycle, Math.min(40, cycles), 1e-9, `${where}: two cycles a second, forty in all`);
  t.near(p.boardMesh.scale.y * (30 + 36 * 4), 30 + 36 * N, 1e-9, `${where}: board as tall as its stages`);
  t.near(p.boardMesh.position.y / MM, 15 + 18 * N, 1e-6, `${where}: board centered on its stages`);
  if (cycles > 0) t.near(now.output, s.samples[Math.round(Math.min(40, cycles) * 60) - 1].output, 1e-12, `${where}: the sample for now`);
  const size = capacitorSize(s.values.capacitance);
  t.near(size[0] * size[1] * size[2], 8.5 * 18 * 14.5 * s.values.capacitance, 1e-9, `${where}: capacitor volume follows capacitance`);
  p.capacitors.forEach(({column, k, group, body}) => {
    assert.equal(group.visible, k <= N);
    t.near(body.scale.y * 18, size[1], 1e-9, `${where}: capacitor drawn its length`);
    if (k > N) return;
    const [lower, upper] = column === 'pump' ? [k - 1, k] : [k === 1 ? -1 : N + k - 1, N + k];
    const volts = (upper < 0 ? 0 : now.nodes[upper]) - (lower < 0 ? 0 : now.nodes[lower]), color = EMPTY.clone().lerp(FULL, Math.min(1, Math.abs(volts) / (2 * s.values.peak)));
    t.ok(Math.abs(body.material.color.g - color.g) < 1e-9 && Math.abs(body.material.color.b - color.b) < 1e-9, `${where}: capacitor ${column} ${k} colored by its voltage`);
    const low = nodePlace(4, column === 'pump' ? k - 1 : (k === 1 ? -1 : 4 + k - 1)), high = nodePlace(4, column === 'pump' ? k : 4 + k);
    t.near(body.position.y / MM, (low[1] + high[1]) / 2, 1e-6, `${where}: capacitor between its nodes`);
  });
  p.diodes.forEach(({index, k, group, body}) => {
    assert.equal(group.visible, k <= N);
    t.ok(body.material.color.getHex() === (k <= N && now.on[index] ? 0xc14f39 : 0x374736), `${where}: diode ${index + 1} red only while conducting`);
    const [anode, cathode] = diodesOf(4)[index], a = nodePlace(4, anode), c = nodePlace(4, cathode);
    t.near(body.position.x / MM, (a[0] + c[0]) / 2, 1e-6, `${where}: diode between its nodes`);
    t.near(body.position.y / MM, (a[1] + c[1]) / 2, 1e-6, `${where}: diode between its nodes`);
    body.geometry.computeBoundingBox();
    t.near(body.geometry.parameters.height / MM, 5.2, 1e-9, `${where}: DO-41 body 5.2 mm long`);
  });
  p.loads.forEach((group, index) => assert.equal(group.visible, index + 1 === N));
  p.bars.forEach((bar, node) => {
    assert.equal(bar.visible, node <= 2 * N);
    if (node > 2 * N) return;
    const height = now.nodes[node] / top * BAR_CHART.height;
    t.near(bar.scale.y, Math.max(1e-3, Math.abs(height)), 1e-9, `${where}: node ${node} bar height`);
    t.near(bar.position.y / MM, BAR_CHART.bottom + height / 2, 1e-6, `${where}: node ${node} bar from zero`);
    assert.equal(bar.material, node > N ? p.smoothMaterial : p.pumpMaterial);
  });
  const line = p.outputLine.geometry.attributes.position, y = volts => (OUTPUT_CHART.bottom + Math.max(-0.25, Math.min(1.1, volts / top)) * OUTPUT_CHART.height) * MM;
  for (const i of [0, 61, 600, 1799, 2400]) {
    t.near(line.getX(i), (OUTPUT_CHART.left + i / 60 / 40 * OUTPUT_CHART.width) * MM, 1e-5, `${where}: output chart across`);
    t.near(line.getY(i), y(i === 0 ? 0 : s.samples[i - 1].output), 1e-5, `${where}: output chart up`);
  }
  t.near(p.steadyLine.geometry.attributes.position.getY(0), y(s.steady.mean), 1e-5, `${where}: steady output line`);
  assert.equal(p.textbookLine.visible, s.estimate > 0);
  t.near(p.cursor.geometry.attributes.position.getX(0), (OUTPUT_CHART.left + s.cycle / 40 * OUTPUT_CHART.width) * MM, 1e-5, `${where}: line for now`);
  if (cycles === 17) checkFinite(m.root, t);
}

// 4. The lesson, the texts, controls, refusals and disposal.
const run = values => { m.reset(); m.update(values); return m.getState(); };
checkTrialNumbers(voltageMultiplierLesson, {
  'Switch it on': st => ({'36.3': st.samples[59].output, '143.6': st.samples[599].output, '10': 10, '180.5': st.samples[2399].output, '40': 40, '182.8': st.steady.mean, '50': st.values.peak}),
  'No load': st => ({'197.2': st.steady.mean, '200': st.textbook.ideal, '0.7': LADDER.drop, '4': 2 * st.N}),
  'Ripple': st => ({'91.4': st.steady.current * 1e6, '5.09': st.steady.ripple}),
  'More stages': st => (t.ok(st.textbook.sag / textbook({...st.values, stages: 2}).sag > 2 * 2, 'the sag grows far faster than the stages'), {'400': st.textbook.ideal, '314.0': st.steady.mean, '40': 40, '265.0': st.samples[2399].output}),
  'Faster source': st => ({'0.57': st.steady.ripple, '195.0': st.steady.mean}),
  'Bigger capacitors': st => ({'1.12': st.steady.ripple, '193.7': st.steady.mean}),
  'The textbook formula': st => ({'100': st.values.load, '186.0': st.estimate, '6.00': st.textbook.ripple, '182.8': st.steady.mean, '5.09': st.steady.ripple}),
  'Too heavy a load': st => (assert.ok(st.estimate < 0), {'1,000': st.textbook.sag, '800': st.textbook.ideal, '350.9': st.steady.mean, '219.3': st.steady.current * 1e6}),
}, run, t);
checkQuotedText(voltageMultiplierLesson.limits, {
  '50 Ω of winding': `${LADDER.source} Ω of winding`, '0.7 V drop in series with 5 Ω': `${LADDER.drop} V drop in series with ${LADDER.on} Ω`, '1 GΩ': `${fixed(LADDER.off / 1e9, 0)} GΩ`,
  '240 steps a cycle for 400 cycles': `${LADDER.steps} steps a cycle for ${LADDER.cycles} cycles`, 'first 40 cycles play two to a second': `first ${LADDER.played} cycles play two to a second`,
}, t);
t.ok(p.CYCLES_PER_SECOND === 2, 'two cycles a second');
const partText = id => m.parts.find(part => part.id === id).description;
checkQuotedText(partText('source'), {'50 Ω': `${LADDER.source} Ω`}, t);
checkControlsMove(m, () => [p.capacitors.map(c => c.group.visible), p.capacitors[0].body.scale.x, p.bars.map(bar => bar.scale.y), p.outputLine.geometry.attributes.position.getY(600)], model => model.advance(5 / p.CYCLES_PER_SECOND), t);
checkRefusals(sampleLadder, MULTIPLIER_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS voltage multiplier: ${t.count} checks, ${voltageMultiplierLesson.tryIt.length} trials, ${resources} resources`);

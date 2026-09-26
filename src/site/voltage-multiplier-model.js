import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {sampleLadder, diodesOf, LADDER, MULTIPLIER_DEFAULTS, MULTIPLIER_DOMAINS} from './voltage-multiplier-physics.js';

// ---------------------------------------------------------------------------
// Voltage multiplier: a half-wave Cockcroft-Walton ladder built on a circuit
// board, charged from nothing, with its node voltages and output charted.
//
// Scale: one millimeter is 0.03 scene units for every length: DO-41 rectifier
// diodes 5.2 mm long and 2.7 mm across; film capacitors 18 by 8.5 by 14.5 mm at
// 1 µF, every side growing with the cube root of the capacitance so their volume
// follows it; a 1.6 mm board; stages 36 mm apart; a quarter-watt load resistor
// 6.3 mm long.
//
// Time: the first 40 cycles play two to a second, however fast the source
// alternates, from uncharged capacitors.
//
// Colors: each capacitor fills from cream to gold as its voltage rises toward
// twice the peak; a diode's body glows red while it conducts.
//
// Charts, beside the board, not to its scale: the voltage at every node now,
// the source terminal and pump column in gold and the smoothing column in blue,
// from the peak below zero to 2 N Vp above; and the output over the 40 cycles
// (red) on the same top, with the steady output it settles to (gray), the
// textbook estimate (blue), and a line for now.
// ---------------------------------------------------------------------------

const MM = 0.03;
const PITCH = 36;
const BASE = 15;
const MOST = 4;
const CYCLES_PER_SECOND = 2;
const EMPTY = new THREE.Color(0xf0dfaf), FULL = new THREE.Color(0xe3b45e), OFF = new THREE.Color(0x374736), ON = new THREE.Color(0xc14f39);
export const COLUMNS = Object.freeze({pump: -22, smooth: 22, load: 40});
export const BAR_CHART = Object.freeze({left: 70, bottom: 45, height: 120, gap: 11, width: 8});
export const OUTPUT_CHART = Object.freeze({left: 190, bottom: 45, width: 140, height: 120});
const scaled = point => point.map(v => v * MM);
const clamp01 = x => Math.max(0, Math.min(1, x));

/** Where a node sits on the board, in millimeters: node 0 the source terminal, 1..N the pump column, N+1..2N the smoothing column, -1 ground. */
export function nodePlace(N, node) {
  if (node < 0) return [COLUMNS.smooth, BASE, 0];
  if (node <= N) return [COLUMNS.pump, BASE + PITCH * node, 0];
  return [COLUMNS.smooth, BASE + PITCH * (node - N), 0];
}
export const capacitorSize = microfarads => { const f = Math.cbrt(microfarads); return [8.5 * f, 18 * f, 14.5 * f]; };
/** Bar height in millimeters for a node voltage, on a top of 2 N Vp. */
export const barHeight = (volts, top) => volts / top * BAR_CHART.height;
export const outputPoint = (cycles, volts, top) => [(OUTPUT_CHART.left + cycles / LADDER.played * OUTPUT_CHART.width) * MM, (OUTPUT_CHART.bottom + Math.max(-0.25, Math.min(1.1, volts / top)) * OUTPUT_CHART.height) * MM, 0];

export function createVoltageMultiplierModel() {
  const kit = houseModel('Voltage multiplier'), {root, part, control, finish} = kit;
  const system = part('system', 'Voltage multiplier', 'A Cockcroft-Walton ladder: diodes and capacitors that turn an alternating voltage into a steady one several times its peak. Drawn at true size on its circuit board.', [0, 0, 0]);

  const board = part('board', 'Circuit board', 'A 1.6 mm glass-fiber board with copper pads at every node.', [0, 0, 0], system);
  const boardMesh = kit.box([100 * MM, (BASE * 2 + PITCH * MOST) * MM, 1.6 * MM], [0, (BASE + PITCH * MOST / 2) * MM, -0.8 * MM], 'leaf', board);

  const source = part('source', 'Alternating source', 'Terminals for the transformer’s secondary winding, 50 Ω of resistance, alternating between plus and minus the peak voltage. The right terminal is ground.', [0, 0, 0], system);
  kit.box([16 * MM, 8 * MM, 10 * MM], scaled([COLUMNS.pump, 4, 5]), 'blue', source);
  kit.box([16 * MM, 8 * MM, 10 * MM], scaled([COLUMNS.smooth, 4, 5]), 'blue', source);
  kit.rod(scaled([COLUMNS.pump, 8, 2.5]), scaled([COLUMNS.pump, BASE, 2.5]), 0.4 * MM, 'metal', source);
  kit.rod(scaled([COLUMNS.smooth, 8, 2.5]), scaled([COLUMNS.smooth, BASE, 2.5]), 0.4 * MM, 'metal', source);

  const pumpPart = part('pump', 'Pump capacitors', 'The left column, driven by the source from below. Each one’s lower end swings with the alternating voltage, lifting the charge stored above it.', [0, 0, 0], system);
  const smoothPart = part('smoothing', 'Smoothing capacitors', 'The right column, stacked from ground. Each holds twice the peak once charged, and together they hold the output steady.', [0, 0, 0], system);
  const diodePart = part('diodes', 'Diodes', 'Silicon rectifiers that let current through one way only. Odd ones charge the pump column near the negative peak; even ones pass charge across to the smoothing column near the positive peak.', [0, 0, 0], system);

  const capacitors = [];
  for (const [column, parent] of [['pump', pumpPart], ['smooth', smoothPart]]) {
    for (let k = 1; k <= MOST; k++) {
      const x = COLUMNS[column], group = new THREE.Group();
      parent.add(group);
      const body = kit.box([8.5 * MM, 18 * MM, 14.5 * MM], scaled([x, BASE + PITCH * (k - 0.5), 7.25]), 'cream', group);
      body.material = body.material.clone();
      const low = kit.rod(scaled([x, BASE + PITCH * (k - 1), 2.5]), scaled([x, BASE + PITCH * (k - 0.5) - 9, 2.5]), 0.4 * MM, 'metal', group);
      const high = kit.rod(scaled([x, BASE + PITCH * (k - 0.5) + 9, 2.5]), scaled([x, BASE + PITCH * k, 2.5]), 0.4 * MM, 'metal', group);
      const pad = kit.cylinder(2.2 * MM, 0.3 * MM, scaled([x, BASE + PITCH * k, 0.15]), 'gold', group);
      pad.rotation.x = Math.PI / 2;
      capacitors.push({column, k, group, body, low, high});
    }
  }
  const diodes = [];
  diodesOf(MOST).forEach(([anode, cathode], index) => {
    const group = new THREE.Group();
    diodePart.add(group);
    const k = Math.floor(index / 2) + 1, a = new THREE.Vector3(...nodePlace(MOST, anode)), c = new THREE.Vector3(...nodePlace(MOST, cathode));
    a.z = c.z = 2.5;
    const u = c.clone().sub(a).normalize(), mid = a.clone().add(c).multiplyScalar(0.5), start = mid.clone().addScaledVector(u, -2.6), end = mid.clone().addScaledVector(u, 2.6);
    kit.rod(scaled(a.toArray()), scaled(start.toArray()), 0.4 * MM, 'metal', group);
    kit.rod(scaled(end.toArray()), scaled(c.toArray()), 0.4 * MM, 'metal', group);
    const body = kit.rod(scaled(start.toArray()), scaled(end.toArray()), 1.35 * MM, 'ink', group);
    body.material = body.material.clone();
    kit.rod(scaled(mid.clone().addScaledVector(u, 1.7).toArray()), scaled(end.toArray()), 1.42 * MM, 'metal', group);
    diodes.push({index, k, group, body, anode: a, cathode: c});
  });

  const load = part('load', 'Load resistor and output', 'A quarter-watt resistor from the top of the smoothing column to ground, drawing the set current at the ideal output. The red post is the output.', [0, 0, 0], system);
  const loads = Array.from({length: MOST}, (_, index) => {
    const N = index + 1, top = BASE + PITCH * N, group = new THREE.Group();
    load.add(group);
    kit.rod(scaled([COLUMNS.smooth, top, 2.5]), scaled([COLUMNS.load, top, 2.5]), 0.4 * MM, 'metal', group);
    kit.rod(scaled([COLUMNS.load, top, 2.5]), scaled([COLUMNS.load, top - 8.85, 2.5]), 0.4 * MM, 'metal', group);
    kit.rod(scaled([COLUMNS.load, top - 8.85, 2.5]), scaled([COLUMNS.load, top - 15.15, 2.5]), 1.25 * MM, 'wood', group);
    kit.rod(scaled([COLUMNS.load, top - 15.15, 2.5]), scaled([COLUMNS.load, BASE, 2.5]), 0.4 * MM, 'metal', group);
    kit.rod(scaled([COLUMNS.load, BASE, 2.5]), scaled([COLUMNS.smooth, BASE, 2.5]), 0.4 * MM, 'metal', group);
    kit.cylinder(1.5 * MM, 8 * MM, scaled([COLUMNS.smooth, top, 6.5]), 'red', group).rotation.x = Math.PI / 2;
    return group;
  });

  const charts = part('charts', 'Charts', 'The voltage at every node now, and the output over the first 40 cycles with the level it settles to and the textbook estimate. Not to the board’s scale.', [0, 0, 0], system);
  kit.rod(scaled([BAR_CHART.left - 6, BAR_CHART.bottom, 0]), scaled([BAR_CHART.left + BAR_CHART.gap * (2 * MOST) + 6, BAR_CHART.bottom, 0]), 0.6 * MM, 'ink', charts);
  kit.rod(scaled([OUTPUT_CHART.left, OUTPUT_CHART.bottom, 0]), scaled([OUTPUT_CHART.left + OUTPUT_CHART.width, OUTPUT_CHART.bottom, 0]), 0.6 * MM, 'ink', charts);
  kit.rod(scaled([OUTPUT_CHART.left, OUTPUT_CHART.bottom, 0]), scaled([OUTPUT_CHART.left, OUTPUT_CHART.bottom + OUTPUT_CHART.height, 0]), 0.6 * MM, 'ink', charts);
  const bars = Array.from({length: 2 * MOST + 1}, (_, node) => kit.box([BAR_CHART.width * MM, MM, 3 * MM], scaled([BAR_CHART.left + BAR_CHART.gap * node, BAR_CHART.bottom, 0]), 'gold', charts));
  const pumpMaterial = bars[0].material, smoothMaterial = pumpMaterial.clone();
  smoothMaterial.color.set(0x2f6690);
  const outputLine = lineObject(LADDER.played * LADDER.kept + 1, 0xc14f39, charts), steadyLine = lineObject(2, 0x9aa7ad, charts), textbookLine = lineObject(2, 0x2f6690, charts), cursor = lineObject(2, 0x374736, charts);
  // The scale's top is the ideal output, which the stages and the source set, so its number is redrawn with them.
  const barPoint = (node, share) => scaled([BAR_CHART.left + BAR_CHART.gap * node, BAR_CHART.bottom + share * BAR_CHART.height, 0]);
  chartText(charts, barPoint, {
    title: 'Every node now', size: 9 * MM,
    x: {min: 0, max: 2 * MOST, title: 'Nodes, from the source outward', ticks: []},
    y: {min: 0, max: 1, title: 'Volts', ticks: [[0, '0']]},
    legend: [['Pump capacitors', 0xb8862f], ['Smoothing capacitors', 0x2f6690]],
  });
  chartText(charts, (cycles, share) => scaled([OUTPUT_CHART.left + cycles / LADDER.played * OUTPUT_CHART.width, OUTPUT_CHART.bottom + share * OUTPUT_CHART.height, 0]), {
    title: 'Output over the first 40 cycles', size: 9 * MM,
    x: {min: 0, max: LADDER.played, title: 'Cycles of the source', ticks: [[0, '0'], [20, '20'], [40, '40']]},
    y: {min: 0, max: 1, title: 'Volts', ticks: [[0, '0']]},
    legend: [['Output', 0xc14f39], ['Where it settles', 0x7a8b83], ['Textbook estimate', 0x2f6690]], legendAt: [LADDER.played, 0.62],
  });
  const topLabels = [BAR_CHART.left - 6, OUTPUT_CHART.left].map(x => textLabel(charts, '', {height: 9 * MM, width: 40 * MM, align: 'right', position: scaled([x - 4, BAR_CHART.bottom + BAR_CHART.height, 0.3])}));

  const specs = {
    stages: ['Stages', '', 'Each stage is two capacitors and two diodes.'],
    peak: ['Source peak', 'V', 'The peak of the alternating voltage from the transformer.'],
    frequency: ['Frequency', 'Hz', 'How many times a second the source alternates.'],
    capacitance: ['Each capacitor', 'µF', 'All capacitors are equal.'],
    load: ['Load current', 'µA', 'What the load resistor draws at the ideal output.'],
  };
  for (const [key, [min, max, step]] of Object.entries(MULTIPLIER_DOMAINS)) {
    const [label, unit, help] = specs[key];
    control(key, label, min, max, step, MULTIPLIER_DEFAULTS[key], unit, help);
  }

  let cycles = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleLadder(values, cycles), N = s.N, now = s.now, top = 2 * N * values.peak, size = capacitorSize(values.capacitance);
    for (const label of topLabels) label.userData.setText(`${fixed(top, 0)} V`);
    boardMesh.scale.y = (BASE * 2 + PITCH * N) / (BASE * 2 + PITCH * MOST);
    boardMesh.position.y = (BASE + PITCH * N / 2) * MM;
    capacitors.forEach(({column, k, group, body}) => {
      group.visible = k <= N;
      body.scale.set(size[0] / 8.5, size[1] / 18, size[2] / 14.5);
      body.position.z = size[2] / 2 * MM;
      if (k > N) return;
      const [lower, upper] = column === 'pump' ? [k - 1, k] : [k === 1 ? -1 : N + k - 1, N + k];
      const volts = (upper < 0 ? 0 : now.nodes[upper]) - (lower < 0 ? 0 : now.nodes[lower]);
      body.material.color.copy(EMPTY).lerp(FULL, clamp01(Math.abs(volts) / (2 * values.peak)));
    });
    diodes.forEach(({index, k, group, body}) => {
      group.visible = k <= N;
      body.material.color.copy(k <= N && now.on[index] ? ON : OFF);
    });
    loads.forEach((group, index) => { group.visible = index + 1 === N; });
    bars.forEach((bar, node) => {
      bar.visible = node <= 2 * N;
      const height = node <= 2 * N ? barHeight(now.nodes[node], top) : 0;
      bar.scale.y = Math.max(1e-3, Math.abs(height));
      bar.position.y = (BAR_CHART.bottom + height / 2) * MM;
      bar.material = node > N ? smoothMaterial : pumpMaterial;
    });

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      const array = outputLine.geometry.attributes.position.array;
      array.set(outputPoint(0, 0, top), 0);
      s.samples.forEach((sample, i) => array.set(outputPoint((i + 1) / LADDER.kept, sample.output, top), (i + 1) * 3));
      outputLine.geometry.attributes.position.needsUpdate = true;
      outputLine.geometry.computeBoundingSphere();
      steadyLine.geometry.attributes.position.array.set([...outputPoint(0, s.steady.mean, top), ...outputPoint(LADDER.played, s.steady.mean, top)]);
      const estimate = s.textbook.ideal - s.textbook.sag;
      textbookLine.visible = estimate > 0;
      textbookLine.geometry.attributes.position.array.set([...outputPoint(0, estimate, top), ...outputPoint(LADDER.played, estimate, top)]);
      for (const line of [steadyLine, textbookLine]) { line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere(); }
    }
    cursor.geometry.attributes.position.array.set([...outputPoint(s.cycle, -0.25 * top, top), ...outputPoint(s.cycle, 1.1 * top, top)]);
    cursor.geometry.attributes.position.needsUpdate = true;

    const estimate = s.textbook.ideal - s.textbook.sag, conducting = now.on.map((on, index) => (on ? `D${index + 1}` : null)).filter(Boolean);
    return {
      state: {...s, top, estimate, conducting},
      readings: [
        r('Your result', cycles === 0 ? `Ready · ideal output ${fixed(top, 0)} V; press Play to charge the ladder` : `${fixed(now.output, 1)} V at the output after ${fixed(s.cycle, 1)} cycles · it settles at ${fixed(s.steady.mean, 1)} V`),
        r('Steady output', `${fixed(s.steady.mean, 1)} V, rippling ${fixed(s.steady.ripple, 2)} V`, `The load draws ${fixed(s.steady.current * 1e6, 1)} µA, ${fixed(s.steady.mean * s.steady.current * 1000, 2)} mW.`),
        r('Textbook estimate', estimate > 0 ? `${fixed(estimate, 1)} V, rippling ${fixed(s.textbook.ripple, 2)} V` : 'breaks down', `For ideal diodes and a small steady load, ${fixed(top, 0)} V less a sag of ${fixed(s.textbook.sag, 1)} V.${estimate > 0 ? '' : ' This load is far too heavy for that formula.'}`),
        r('Lost in the diodes', `${fixed(2 * N * LADDER.drop, 1)} V at no load`, `Every diode drops ${LADDER.drop} V, so with no load the output settles at 2N(Vp − ${LADDER.drop} V).`),
        r('Conducting now', conducting.length ? conducting.join(', ') : 'none', 'Odd diodes charge the pump column near the negative peak; even diodes pass charge across near the positive peak.'),
        r('Source now', `${fixed(now.e, 1)} V`, `${values.peak} V peak at ${values.frequency} Hz: a cycle every ${fixed(1000 / values.frequency, 1)} ms.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) cycles = Math.min(LADDER.played, cycles + dt * CYCLES_PER_SECOND); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { cycles = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the diodes', part: 'diodes', view: 'front', replay: false, run() { cycles = 10.25; return render(); }},
    {label: 'Inspect: the capacitors charged', part: 'smoothing', view: 'front', replay: false, run() { cycles = LADDER.played; return render(); }},
    {label: 'Inspect: the charts after 40 cycles', part: 'charts', view: 'front', replay: false, run() { cycles = LADDER.played; return render(); }},
  ];
  result.playback = {
    label: 'Switch on the source',
    description: 'The first 40 cycles, two to a second, from uncharged capacitors.',
    stepLabel: 'Advance one cycle',
    advance: result.advance,
    step: () => result.advance(1 / CYCLES_PER_SECOND),
    complete: () => cycles >= LADDER.played,
    blocked: () => false,
  };

  root.rotation.set(0.25, -0.2, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, board, boardMesh, source, pumpPart, smoothPart, diodePart, capacitors, diodes, load, loads, charts, bars, pumpMaterial, smoothMaterial, outputLine, steadyLine, textbookLine, cursor, MM, MOST, PITCH, BASE, CYCLES_PER_SECOND};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

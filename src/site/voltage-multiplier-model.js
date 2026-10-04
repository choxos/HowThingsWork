import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {textLabel} from './scene-kit.js';
import {multiplierCharts} from './voltage-multiplier-charts.js';
import {sampleLadder, diodesOf, LADDER, MULTIPLIER_DEFAULTS, MULTIPLIER_DOMAINS} from './voltage-multiplier-physics.js';

// Illustrative three-dimensional layout of a positive-output Cockcroft-Walton
// ladder. Packages are visual proxies, not a component selection or PCB design.
// Startup and a separately computed late cycle have distinct playback windows.

const MM = 0.03;
const PITCH = 36;
const BASE = 15;
const MOST = 4;
const CYCLES_PER_SECOND = 2;
const EMPTY = new THREE.Color(0xf0dfaf), FULL = new THREE.Color(0xe3b45e), OFF = new THREE.Color(0x374736), ON = new THREE.Color(0xc14f39);
export const COLUMNS = Object.freeze({pump: -22, smooth: 22, load: 40});
const scaled = point => point.map(v => v * MM);
const clamp01 = x => Math.max(0, Math.min(1, x));

/** Where a node sits on the board, in millimeters: node 0 the source terminal, 1..N the pump column, N+1..2N the smoothing column, -1 ground. */
export function nodePlace(N, node) {
  if (node < 0) return [COLUMNS.smooth, BASE, 0];
  if (node <= N) return [COLUMNS.pump, BASE + PITCH * node, 0];
  return [COLUMNS.smooth, BASE + PITCH * (node - N), 0];
}
export const capacitorSize = microfarads => { const f = Math.cbrt(microfarads); return [8.5 * f, 18 * f, 14.5 * f]; };
export function createVoltageMultiplierModel() {
  const kit = houseModel('Voltage multiplier'), {root, part, control, finish} = kit;
  const system = part('system', 'Voltage multiplier', 'A Cockcroft-Walton ladder: diodes and capacitors that turn an alternating voltage into a steady one several times its peak. This positive-output example uses illustrative packages; reversing every diode produces a negative-output ladder.', [0, 0, 0]);

  const board = part('board', 'Circuit board', 'A 1.6 mm glass-fiber board with copper pads at every node.', [0, 0, 0], system);
  const boardMesh = kit.box([100 * MM, (BASE * 2 + PITCH * MOST) * MM, 1.6 * MM], [0, (BASE + PITCH * MOST / 2) * MM, -0.8 * MM], 'leaf', board);

  const source = part('source', 'Alternating source', 'Terminals for the transformer’s secondary winding, 50 Ω of resistance, alternating between plus and minus the peak voltage. The right terminal is ground.', [0, 0, 0], system);
  kit.box([16 * MM, 8 * MM, 10 * MM], scaled([COLUMNS.pump, 4, 5]), 'blue', source);
  kit.box([16 * MM, 8 * MM, 10 * MM], scaled([COLUMNS.smooth, 4, 5]), 'blue', source);
  kit.rod(scaled([COLUMNS.pump, 8, 2.5]), scaled([COLUMNS.pump, BASE, 2.5]), 0.4 * MM, 'metal', source);
  kit.rod(scaled([COLUMNS.smooth, 8, 2.5]), scaled([COLUMNS.smooth, BASE, 2.5]), 0.4 * MM, 'metal', source);

  const pumpPart = part('pump', 'Pump capacitors', 'The left column, driven by the source from below. Each one’s lower end swings with the alternating voltage, lifting the charge stored above it.', [0, 0, 0], system);
  const smoothPart = part('smoothing', 'Smoothing capacitors', 'The right column, stacked from ground. At the ideal no-load limit each approaches twice the source peak. Their voltages add; a load and finite charging time reduce the result.', [0, 0, 0], system);
  const diodePart = part('diodes', 'Diodes', 'Silicon rectifiers that let current through one way only. Odd ones charge the pump column near the negative peak; even ones pass charge across to the smoothing column near the positive peak.', [0, 0, 0], system);

  const capacitors = [];
  for (const [column, parent] of [['pump', pumpPart], ['smooth', smoothPart]]) {
    for (let k = 1; k <= MOST; k++) {
      const x = COLUMNS[column], id = `${column}-${k}`, mark = `${column === 'pump' ? 'CP' : 'CS'}${k}`;
      const group = part(id, `${column === 'pump' ? 'Pump' : 'Smoothing'} capacitor ${mark}`, `An illustrative capacitor between adjacent ${column} nodes. Its voltage is the difference between those nodes, not the node voltage to ground.`, [0, 0, 0], parent);
      const label = textLabel(group, mark, {height: 3 * MM, width: 13 * MM, position: scaled([x, BASE + PITCH * (k - .5), 15])});
      const body = kit.box([8.5 * MM, 18 * MM, 14.5 * MM], scaled([x, BASE + PITCH * (k - 0.5), 7.25]), 'cream', group);
      body.material = body.material.clone();
      const low = kit.rod(scaled([x, BASE + PITCH * (k - 1), 2.5]), scaled([x, BASE + PITCH * (k - 0.5) - 9, 2.5]), 0.4 * MM, 'metal', group);
      const high = kit.rod(scaled([x, BASE + PITCH * (k - 0.5) + 9, 2.5]), scaled([x, BASE + PITCH * k, 2.5]), 0.4 * MM, 'metal', group);
      const pad = kit.cylinder(2.2 * MM, 0.3 * MM, scaled([x, BASE + PITCH * k, 0.15]), 'gold', group);
      pad.rotation.x = Math.PI / 2;
      kit.rod(scaled([x, BASE + PITCH * k, .15]), scaled([x, BASE + PITCH * k, 2.5]), .6 * MM, 'gold', group);
      textLabel(group, `${column === 'pump' ? 'P' : 'S'}${k}`, {height: 3.5 * MM, width: 12 * MM, color: '#182217', position: scaled([x + (column === 'pump' ? -7 : 7), BASE + PITCH * k, 4])});
      capacitors.push({column, k, group, body, low, high, label});
    }
  }
  const diodes = [];
  diodesOf(MOST).forEach(([anode, cathode], index) => {
    const group = part(`diode-${index + 1}`, `Diode D${index + 1}`, 'The silver band marks the cathode. Red indicates forward conventional current from anode to cathode; it does not mean electrons travel in that direction.', [0, 0, 0], diodePart);
    const k = Math.floor(index / 2) + 1, a = new THREE.Vector3(...nodePlace(MOST, anode)), c = new THREE.Vector3(...nodePlace(MOST, cathode));
    a.z = c.z = 2.5;
    const innerA = a.clone(), innerC = c.clone(); innerA.x = Math.sign(a.x) * 12; innerC.x = Math.sign(c.x) * 12;
    const u = innerC.clone().sub(innerA).normalize(), mid = innerA.clone().add(innerC).multiplyScalar(.5), start = mid.clone().addScaledVector(u, -2.6), end = mid.clone().addScaledVector(u, 2.6);
    const routes = [[a, innerA], [innerA, start], [end, innerC], [innerC, c]];
    routes.forEach(([from, to]) => kit.rod(scaled(from.toArray()), scaled(to.toArray()), .4 * MM, 'metal', group));
    textLabel(group, `D${index + 1}`, {height: 3 * MM, width: 10 * MM, position: scaled([mid.x, mid.y + 5, 5])});
    const body = kit.rod(scaled(start.toArray()), scaled(end.toArray()), 1.35 * MM, 'ink', group);
    body.material = body.material.clone();
    kit.rod(scaled(mid.clone().addScaledVector(u, 1.7).toArray()), scaled(end.toArray()), 1.42 * MM, 'metal', group);
    diodes.push({index, k, group, body, anode: a, cathode: c, routes});
  });

  const load = part('load', 'Load resistor and output', 'An illustrative load from the final smoothing node to ground. Its resistance is chosen from the nominal current at ideal voltage. Actual current falls as voltage sags. Setting zero opens this branch; the red output post remains.', [0, 0, 0], system);
  const loads = Array.from({length: MOST}, (_, index) => {
    const N = index + 1, top = BASE + PITCH * N, group = new THREE.Group();
    load.add(group);
    const branch = new THREE.Group(); group.add(branch);
    kit.rod(scaled([COLUMNS.smooth, top, 2.5]), scaled([COLUMNS.load, top, 2.5]), 0.4 * MM, 'metal', branch);
    kit.rod(scaled([COLUMNS.load, top, 2.5]), scaled([COLUMNS.load, top - 8.85, 2.5]), 0.4 * MM, 'metal', branch);
    kit.rod(scaled([COLUMNS.load, top - 8.85, 2.5]), scaled([COLUMNS.load, top - 15.15, 2.5]), 1.25 * MM, 'wood', branch);
    kit.rod(scaled([COLUMNS.load, top - 15.15, 2.5]), scaled([COLUMNS.load, BASE, 2.5]), 0.4 * MM, 'metal', branch);
    kit.rod(scaled([COLUMNS.load, BASE, 2.5]), scaled([COLUMNS.smooth, BASE, 2.5]), 0.4 * MM, 'metal', branch);
    kit.cylinder(1.5 * MM, 8 * MM, scaled([COLUMNS.smooth, top, 6.5]), 'red', group).rotation.x = Math.PI / 2;
    return {group, branch};
  });

  for (const [x, name] of [[COLUMNS.pump, 'AC'], [COLUMNS.smooth, '0 V']]) {
    const pad = kit.cylinder(2.2 * MM, .3 * MM, scaled([x, BASE, .15]), 'gold', source); pad.rotation.x = Math.PI / 2;
    kit.rod(scaled([x, BASE, .15]), scaled([x, BASE, 2.5]), .6 * MM, 'gold', source);
    textLabel(source, name, {height: 4 * MM, width: 20 * MM, position: scaled([x, 4, 10.5])});
  }
  const plots = multiplierCharts(kit, system, MM, LADDER.played, LADDER.kept, LADDER.steps);
  control('window', 'Experiment window', 0, 1, 1, 0, '', 'Startup begins uncharged. The late window replays cycle 400 from the same calculated run. Changing a setting restarts the selected window.');

  const specs = {
    stages: ['Stages', '', 'Each stage is two capacitors and two diodes.'],
    peak: ['Source peak', 'V', 'The peak of the alternating voltage from the transformer.'],
    frequency: ['Frequency', 'Hz', 'How many times a second the source alternates.'],
    capacitance: ['Each capacitor', 'µF', 'All capacitors are equal.'],
    load: ['Nominal load demand', 'µA', 'The resistor is sized to draw this current at ideal voltage. Actual current changes with output voltage. Zero opens the load.'],
  };
  for (const [key, [min, max, step]] of Object.entries(MULTIPLIER_DOMAINS)) {
    const [label, unit, help] = specs[key];
    control(key, label, min, max, step, MULTIPLIER_DEFAULTS[key], unit, help);
  }

  let cycles = 0, lastClock = 0, disposed = false, settingsKey = '', restoring = false;
  const result = finish(values => {
    const {window: windowSetting, ...physical} = values, window = windowSetting ? 'late' : 'startup', key = JSON.stringify(values);
    if (key !== settingsKey) {if (!restoring) cycles = windowSetting ? LADDER.cycles - 1 : 0; settingsKey = key;}
    const s = sampleLadder(physical, cycles, window), N = s.N, now = s.now, top = 2 * N * values.peak, size = capacitorSize(values.capacitance);
    cycles = s.cycle;
    boardMesh.scale.y = (BASE * 2 + PITCH * N) / (BASE * 2 + PITCH * MOST);
    boardMesh.position.y = (BASE + PITCH * N / 2) * MM;
    capacitors.forEach(({column, k, group, body, low, high, label}) => {
      group.visible = k <= N;
      body.scale.set(size[0] / 8.5, size[1] / 18, size[2] / 14.5);
      body.position.z = size[2] / 2 * MM;
      label.position.z = (size[2] + .5) * MM;
      const middle = BASE + PITCH * (k - .5), bottom = BASE + PITCH * (k - 1), upper = BASE + PITCH * k;
      const leadLength = (PITCH - size[1]) / 2;
      low.scale.y = high.scale.y = leadLength / 9;
      low.position.y = (bottom + middle - size[1] / 2) / 2 * MM;
      high.position.y = (middle + size[1] / 2 + upper) / 2 * MM;
      if (k > N) return;
      const lowerNode = column === 'pump' ? k - 1 : k === 1 ? -1 : N + k - 1, upperNode = column === 'pump' ? k : N + k;
      const volts = now.nodes[upperNode] - (lowerNode < 0 ? 0 : now.nodes[lowerNode]);
      body.material.color.copy(EMPTY).lerp(FULL, clamp01(Math.abs(volts) / (2 * values.peak)));
    });
    diodes.forEach(({index, k, group, body}) => {group.visible = k <= N; body.material.color.copy(k <= N && now.on[index] ? ON : OFF);});
    loads.forEach(({group, branch}, index) => {group.visible = index + 1 === N; branch.visible = values.load > 0;});
    const estimate = s.textbook.ideal - s.textbook.sag, conducting = now.on.map((on, index) => on ? `D${index + 1}` : null).filter(Boolean);
    const state = {...s, top, estimate, conducting}; plots.update(state);
    const capVolts = Array.from({length: N}, (_, i) => now.nodes[N + i + 1] - (i ? now.nodes[N + i] : 0));
    return {state, readings: [
      r('Your result', `${fixed(now.output, 1)} V at cycle ${fixed(s.cycle, 2)} · ${window === 'late' ? 'late-cycle view' : 'startup view'}`, 'Every shown voltage is relative to the grounded source terminal. Inspections preserve time; changed settings restart the selected window.'),
      r('Cycle-400 output', `${fixed(s.late.mean, 1)} V mean · ${fixed(s.late.ripple, 3)} V range`, `This is the final simulated cycle, not an assumed infinite-time limit. Its minimum is ${fixed(s.late.low, 3)} V and maximum ${fixed(s.late.high, 3)} V.`),
      r('Still settling?', s.late.repeating ? 'Repeats within 0.001 V per cycle' : 'Yes: cycle 400 still differs', `Largest matched-phase node change from cycle 399: ${fixed(s.late.nodeCycleChange, 6)} V. A small change over one cycle alone does not prove the final limiting voltage.`),
      r('Load and delivered power', `${fixed(s.late.current * 1e6, 1)} µA · ${fixed(s.late.loadPower * 1000, 3)} mW`, values.load ? `Cycle-400 averages with a ${fixed(1 / s.loadConductance / 1e6, 3)} MΩ resistor. Power averages voltage squared divided by resistance, including the waveform.` : 'The load branch is open. No current or power is delivered to an external load.'),
      r('Stacked capacitor voltages now', capVolts.map((v, i) => `CS${i + 1}: ${fixed(v, 1)} V`).join(' + '), `These smoothing-capacitor voltage differences sum to the output: ${fixed(now.output, 1)} V.`),
      r('Small-load textbook reference', estimate > 0 ? `${fixed(estimate, 1)} V · ${fixed(s.textbook.ripple, 2)} V ripple` : 'Outside the small-load approximation', `Ideal diodes and a fixed ${values.load} µA current, rather than this circuit's resistive load and finite source resistance. Ideal no-load voltage is ${fixed(top, 0)} V.`),
      r('No-load diode-drop limit', `${fixed(2 * N * (values.peak - LADDER.drop), 1)} V`, `Approximate limiting voltage with ${2 * N} forward drops of ${LADDER.drop} V. Finite charging time, reverse leakage and source resistance keep this from being an exact cycle-400 result.`),
      r('Conducting now', conducting.length ? conducting.join(', ') : 'None', 'Match D labels on the board. Red denotes forward conventional current, from anode toward the silver-banded cathode.'),
      r('Source now', `${fixed(now.e, 1)} V ideal · ${fixed(now.nodes[0], 1)} V at AC terminal`, `${values.peak} V peak at ${values.frequency} Hz, behind ${LADDER.source} Ω. Playback slows cycles independently of physical frequency.`),
    ]};
  });
  const windowControl = result.controls.find(item => item.key === 'window');
  windowControl.options = [{value: 0, label: 'First 40 cycles'}, {value: 1, label: 'Cycle 400: ripple and drift'}];
  windowControl.primary = true;
  const render = result.update;
  const speed = () => result.getState().window === 'late' ? .25 : CYCLES_PER_SECOND;
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) cycles = Math.min(result.getState().end, cycles + dt * speed()); return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = (initial = {}) => {
    const settings = {...result.defaults, ...(initial.settings || {})};
    cycles = Number.isFinite(initial.cycle) ? initial.cycle : settings.window ? LADDER.cycles - 1 : 0;
    lastClock = 0; restoring = true;
    try {return render(settings);} finally {restoring = false;}
  };
  result.replayState = () => ({settings: result.getState().values, cycle: result.getState().start});
  const inspect = (label, part, isolate = false) => ({label, part, isolate, view: 'front', replay: false, run: () => result.update()});
  result.actions = [
    inspect('Inspect: complete ladder', 'system'), inspect('Inspect: pump capacitors', 'pump'),
    inspect('Inspect: smoothing capacitors', 'smoothing'), inspect('Inspect: rectifier diodes', 'diodes'),
    inspect('Inspect: load and output', 'load'), inspect('Compare node voltages', 'node-chart', true),
    inspect('Compare startup output', 'charts', true), inspect('Inspect cycle-400 waveform', 'ripple-chart', true),
  ];
  result.playback = {
    label: 'Play selected window', description: 'Startup plays two cycles per second. The late window plays one cycle over four seconds. Both use the selected physical frequency.',
    stepLabel: 'Step through selected window', advance: result.advance,
    step: () => result.advance(result.getState().window === 'late' ? 1 : 1 / CYCLES_PER_SECOND),
    complete: () => cycles >= result.getState().end, blocked: () => false,
  };
  root.rotation.set(0, 0, 0);
  result.initialPart = result.autoFramePart = 'system'; result.initialView = 'front';
  result.frameVisibleOnly = true; result.framePadding = .62; result.selectionOutline = false; result.transparentBackground = true;
  result.thumbnailOmit = [plots.nodes.group, plots.startup.group, plots.ripple.group];
  result.partViewDirections = {};
  for (const id of ['node-chart', 'charts', 'ripple-chart']) {
    Object.assign(result.parts.find(part => part.id === id), {framePadding: .58, maxZoom: 150});
    result.partViewDirections[id] = {front: [0, 0, 3]};
  }
  result.topology = {system, board, boardMesh, source, pumpPart, smoothPart, diodePart, capacitors, diodes, load, loads, plots, MM, MOST, PITCH, BASE, CYCLES_PER_SECOND};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

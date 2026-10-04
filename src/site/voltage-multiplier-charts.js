import * as THREE from 'three';
import {lineObject, textLabel} from './scene-kit.js';
import {fixed} from './format.js';

// Separate inspection planes keep the circuit large and each chart readable.
export function multiplierCharts(kit, system, scale, played, kept, steps) {
  const point = (x, y, z = 0) => [x * scale, y * scale, z * scale];
  const chart = (id, name, description, title, xlabel) => {
    const group = kit.part(id, name, description, [0, 0, 0], system);
    group.userData.inspectionOnly = id;
    group.userData.explosionExcluded = true;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(...point(430, 400, 1)), new THREE.MeshBasicMaterial({color: 0xf8f5e9}));
    panel.position.z = -2 * scale; group.add(panel);
    const label = (text, x, y, width = 400, align = 'center', height = 30) => textLabel(group, text, {height: height * scale, width: width * scale, align, position: point(x, y, .5)});
    label(title, 0, 168); label(xlabel, 0, -150, 400, 'center', 28); label('Volts', -165, 130, 100, 'center', 28);
    const xaxis = lineObject(2, 0x374736, group), yaxis = lineObject(2, 0x374736, group);
    yaxis.geometry.attributes.position.array.set([...point(-140, -95), ...point(-140, 95)]);
    xaxis.geometry.attributes.position.array.set([...point(-140, -95), ...point(140, -95)]);
    const ticks = [-95, 0, 95].map(y => label('', -152, y, 88, 'right', 28));
    const note = label('', 0, -185, 420, 'center', 25);
    return {group, label, ticks, note, xaxis, yaxis};
  };
  const nodes = chart('node-chart', 'Node voltages', 'AC is the source terminal. P1 onward are pump nodes; S1 onward are smoothing nodes. Every voltage is measured relative to the grounded source terminal.', 'Node voltages now', 'Circuit nodes');
  const startup = chart('charts', 'Startup output', 'The first 40 cycles start with uncharged capacitors. The horizontal comparison is the mean of the separately simulated cycle 400, which is not assumed to be an infinite-time limit.', 'Charging the ladder', 'Source cycles');
  const ripple = chart('ripple-chart', 'Late-cycle output', 'A magnified view of simulated cycle 400. Its voltage range can include ongoing startup drift. Compare the previous cycle before calling the pattern steady.', 'Cycle 400 output', 'Source cycles');
  const bars = Array.from({length: 9}, () => kit.box(point(16, 1, 2), point(0, 0, 1), 'gold', nodes.group));
  const smoothMaterial = bars[0].material.clone(); smoothMaterial.color.set(0x2f6690);
  const nodeLabels = bars.map(() => nodes.label('', 0, -118, 38, 'center', 25));
  const startupTicks = [0, 20, 40].map((cycle, i) => startup.label(String(cycle), -140 + i * 140, -118, 65, 'center', 26));
  const rippleTicks = [399, 399.5, 400].map((cycle, i) => ripple.label(String(cycle), -140 + i * 140, -118, 80, 'center', 26));
  const outputLine = lineObject(played * kept + 1, 0xc14f39, startup.group);
  const lateMeanLine = lineObject(2, 0x7a8b83, startup.group);
  const startupCursor = lineObject(2, 0x374736, startup.group);
  const rippleLine = lineObject(steps + 1, 0xc14f39, ripple.group);
  const rippleCursor = lineObject(2, 0x374736, ripple.group);
  const nodePoint = (index, volts, state) => point(-140 + index / (2 * state.N) * 280, -95 + (volts + state.values.peak) / (state.top + state.values.peak) * 190);
  const outputPoint = (cycle, volts, state) => point(-140 + cycle / played * 280, -95 + volts / state.top * 190);
  const ripplePoint = (phase, volts, limits) => point(-140 + phase * 280, -95 + (volts - limits.min) / limits.span * 190);
  const put = (line, points) => {
    line.geometry.attributes.position.array.set(points.flat());
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  };
  let key = '', limits;
  function update(state) {
    const {N, values, now, late} = state, next = JSON.stringify([N, values.peak, values.frequency, values.capacitance, values.load]);
    if (next !== key) {
      key = next;
      const half = (late.low + late.high) / 2, span = Math.max(.02, late.high - late.low) * 1.35;
      limits = {min: half - span / 2, span};
      nodes.ticks.forEach((label, i) => label.userData.setText(fixed(-values.peak + i / 2 * (state.top + values.peak), 1)));
      startup.ticks.forEach((label, i) => label.userData.setText(fixed(i / 2 * state.top, 0)));
      ripple.ticks.forEach((label, i) => label.userData.setText(fixed(limits.min + i / 2 * span, 3)));
      put(outputLine, [outputPoint(0, 0, state), ...state.samples.map((sample, i) => outputPoint((i + 1) / kept, sample.output, state))]);
      put(lateMeanLine, [outputPoint(0, late.mean, state), outputPoint(played, late.mean, state)]);
      put(rippleLine, [ripplePoint(0, state.previousCycle.at(-1).output, limits), ...state.lastCycle.map((sample, i) => ripplePoint((i + 1) / state.parts.steps, sample.output, limits))]);
      startup.note.userData.setText('Red: startup · Gray: late mean');
      ripple.note.userData.setText(late.repeating ? 'Change < 0.001 V per cycle' : 'Still changing at cycle 400');
      for (let node = 0; node < bars.length; node++) {
        nodeLabels[node].visible = node <= 2 * N;
        if (node <= 2 * N) {
          nodeLabels[node].position.x = nodePoint(node, 0, state)[0];
          nodeLabels[node].userData.setText(node === 0 ? 'AC' : node <= N ? `P${node}` : `S${node - N}`);
          if (node > N) bars[node].material = smoothMaterial;
          else bars[node].material = bars[0].material;
        }
      }
    }
    const zeroY = nodePoint(0, 0, state)[1];
    put(nodes.xaxis, [[-140 * scale, zeroY, 0], [140 * scale, zeroY, 0]]);
    for (let node = 0; node < bars.length; node++) {
      const bar = bars[node]; bar.visible = node <= 2 * N;
      if (!bar.visible) continue;
      const at = nodePoint(node, now.nodes[node], state), delta = at[1] - zeroY;
      bar.position.set(at[0], (at[1] + zeroY) / 2, scale);
      bar.scale.y = Math.max(.001, Math.abs(delta) / scale);
    }
    nodes.note.userData.setText(`Cycle ${fixed(state.cycle, 2)} · Ground = 0 V`);
    startupCursor.visible = state.window === 'startup';
    rippleCursor.visible = state.window === 'late';
    if (startupCursor.visible) {
      const x = outputPoint(state.cycle, 0, state)[0]; put(startupCursor, [[x, -95 * scale, 0], [x, 95 * scale, 0]]);
    }
    if (rippleCursor.visible) {
      const x = ripplePoint(state.cycle - state.start, 0, limits)[0]; put(rippleCursor, [[x, -95 * scale, 0], [x, 95 * scale, 0]]);
    }
  }
  return {nodes, startup, ripple, bars, nodeLabels, startupTicks, rippleTicks, outputLine, lateMeanLine, startupCursor, rippleLine, rippleCursor, update, nodePoint, outputPoint, ripplePoint, getLimits: () => ({...limits})};
}

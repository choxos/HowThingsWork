import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed, significant} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {generatorPlan, generatorAt, COIL, COIL_AREA, BRIDGE, GENERATOR_DEFAULTS, GENERATOR_DOMAINS, GENERATOR_SAMPLES, OUTPUT_OPTIONS} from './grid-physics.js';

export const METER = 10;
export const WIRE = 2 * Math.sqrt(COIL.wire / Math.PI);
export const MACHINE = Object.freeze([-1.7, 0.85, 0]);
export const BENCH = Object.freeze({
  half: COIL.length / 2 * METER, radius: COIL.width / 2 * METER, pitch: WIRE * METER * 1.06,
  shaft: 2, shaftRadius: 0.045, gap: 0.8, poleThick: 0.32, poleWide: 2.4, poleDeep: 1.4,
  ringRadius: 0.18, ringWidth: 0.1, ringA: -1.3, ringB: -1.55,
  barRadius: 0.18, barLength: 0.22, barX: -1.43, brushDepth: 0.085,
  fieldZ: Object.freeze([-0.55, 0, 0.55]),
});
export const CHART = Object.freeze({x: 1.15, y: 0.85, w: 3, h: 1.5, volts: 400, z: 0, cursor: 0.055});
export const LOAD = Object.freeze({x: -1.7, y: -1.25, z: 0.9, width: 3.1, bar: 2.2, barHeight: 0.12});
export const COLORS = Object.freeze({north: 0xc14f39, south: 0x83b4c1, copper: 0xce825f, brass: 0xe3b45e, ink: 0x374736, faint: 0xa7ad9e, rings: 0x2b5d9c, bars: 0xc14f39, field: 0x83b4c1, current: 0xe3b45e, effort: 0xd9822b});
export const chartX = theta => CHART.x + theta / (2 * Math.PI) * CHART.w;
export const chartY = volts => CHART.y + volts / CHART.volts * CHART.h / 2;
const heat = watts => Math.abs(watts) >= 100 ? fixed(watts, 1) : significant(watts, 3);

// Positive winding current follows this order; its area normal starts toward −y, along B.
export function turnCorners(k, turns) {
  const y = (k - (turns - 1) / 2) * BENCH.pitch, {half, radius} = BENCH;
  return [[-half, y, radius], [-half, y, -radius], [half, y, -radius], [half, y, radius]];
}
export function windingPath(turns) {
  const points = [];
  for (let k = 0; k < turns; k++) points.push(...turnCorners(k, turns));
  points.push(turnCorners(turns - 1, turns)[0]);
  return points;
}

export function createGeneratorModel({commutatorLesson = false} = {}) {
  const kit = houseModel('Electric generator'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, drawnTurns = -1, disposed = false;
  const system = part('system', 'Generator and electrical load', 'An ideal shaft driver turns an insulated winding in a uniform magnetic field. Select slip rings or a split ring to compare the two ways of taking current off the rotating coil.');
  const structure = part('structure', 'Stationary supports', 'The base, pole supports and two bearing pedestals hold the fixed parts. The shaft turns inside the bearing bores.', MACHINE, system);
  kit.box([4.45, 0.14, 1.7], [0, -1.14, 0], 'wood', structure);
  for (const x of [-1.85, 1.45]) {
    kit.box([0.16, 0.91, 0.25], [x, -0.58, 0], 'cream', structure);
    const bearing = kit.ring(0.085, 0.025, [x, 0, 0], 'metal', structure); bearing.rotation.y = Math.PI / 2;
  }
  for (const x of [-1.12, 1.12]) kit.box([0.12, 2.1, 0.12], [x, -0.05, -0.72], 'metal', structure);
  const field = part('field', 'North and south poles', 'The upper north pole faces the lower south pole. Blue arrows point downward through the gap. The field is assumed uniform; arrows indicate direction and relative strength.', MACHINE, system);
  const poles = [1, -1].map(side => kit.box([BENCH.poleWide, BENCH.poleThick, BENCH.poleDeep], [0, side * (BENCH.gap + BENCH.poleThick / 2), 0], side > 0 ? COLORS.north : COLORS.south, field));
  for (const side of [1, -1]) textLabel(field, side > 0 ? 'N' : 'S', {height: 0.18, position: [0, side * (BENCH.gap + BENCH.poleThick / 2), 0.715], color: '#fff8e5', weight: '600'});
  const fieldArrows = BENCH.fieldZ.map(z => { const arrow = solidArrow(kit, COLORS.field, field, 0.014); arrow.position.set(0.9, BENCH.gap - 0.07, z); arrow.userData.setDirection(new THREE.Vector3(0, -1, 0)); return arrow; });

  const coil = part('coil', 'Connected rotating winding', 'One continuous insulated wire forms the selected number of 200 × 100 mm turns. Insulating crossbars join the winding to its shaft. Flux is largest when the loop plane is perpendicular to the field; voltage peaks a quarter turn later.', MACHINE, system);
  const spinner = new THREE.Group(); coil.add(spinner);
  const shaft = kit.rod([-BENCH.shaft, 0, 0], [BENCH.shaft, 0, 0], BENCH.shaftRadius, 'metal', spinner);
  const arms = [-0.6, 0.6].map(x => kit.box([0.08, 0.09, 0.97], [x, 0, 0], 'cream', spinner));
  const wireMaterial = new THREE.MeshToonMaterial({color: COLORS.copper});
  const windings = new THREE.Mesh(new THREE.BufferGeometry(), wireMaterial); spinner.add(windings);
  function polylineGeometry(points, radius) {
    const curve = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    return new THREE.TubeGeometry(curve, Math.max(16, points.length * 6), radius, 8, false);
  }
  function wire(points, parent, radius = 0.022, color = COLORS.copper) {
    const mesh = new THREE.Mesh(polylineGeometry(points, radius), new THREE.MeshToonMaterial({color})); parent.add(mesh); return mesh;
  }
  const drive = part('drive', 'Driven pulley and shaft', 'An ideal external driver turns this pulley at the selected speed. It must supply the electrical load and winding heat. Rotor inertia, bearing friction and windage are omitted.', MACHINE, system);
  const driveSpinner = new THREE.Group(); drive.add(driveSpinner);
  const pulley = kit.ring(0.38, 0.045, [1.72, 0, 0], 'wood', driveSpinner); pulley.rotation.y = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; kit.rod([1.72, 0, 0], [1.72, 0.36 * Math.cos(a), 0.36 * Math.sin(a)], 0.025, 'metal', driveSpinner); }

  // Extruded annular sectors give the electrical contact calculation real matching surfaces.
  function sector(parent, x, inner, outer, depth, start, sweep, color) {
    const shape = new THREE.Shape();
    shape.moveTo(outer * Math.cos(start), outer * Math.sin(start));
    shape.absarc(0, 0, outer, start, start + sweep, false);
    shape.lineTo(inner * Math.cos(start + sweep), inner * Math.sin(start + sweep));
    shape.absarc(0, 0, inner, start + sweep, start, true); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 64}), new THREE.MeshToonMaterial({color}));
    mesh.rotation.y = Math.PI / 2; mesh.position.x = x - depth / 2; parent.add(mesh); return mesh;
  }
  const rings = part('rings', 'Two slip rings and fixed brushes', 'Copper-colored ring A connects to the winding start; gold-colored ring B to its end. Insulating sleeves separate both copper rings from the shaft. The cream side marks show rotation, not gaps. Each fixed carbon brush touches its own complete ring continuously.', MACHINE, system);
  const ringSpinner = new THREE.Group(); rings.add(ringSpinner);
  const ringMeshes = [BENCH.ringA, BENCH.ringB].map((x, i) => sector(ringSpinner, x, 0.1, BENCH.ringRadius, BENCH.ringWidth, 0, Math.PI * 2, i ? COLORS.brass : COLORS.copper));
  const ringKeys = [BENCH.ringA, BENCH.ringB].map(x => kit.box([0.003, 0.02, 0.025], [x + BENCH.ringWidth / 2 + 0.002, 0.14, 0], 'cream', ringSpinner));
  for (const x of [BENCH.ringA, BENCH.ringB]) { const sleeve = kit.cylinder(0.1, 0.12, [x, 0, 0], 'cream', ringSpinner); sleeve.rotation.z = Math.PI / 2; }
  const ringBrushes = [BENCH.ringA, BENCH.ringB].map((x, i) => sector(rings, x, BENCH.ringRadius, BENCH.ringRadius + 0.12, 0.075, (i ? 1 : -1) * Math.PI / 2 - COIL.brush * Math.PI / 360, COIL.brush * Math.PI / 180, COLORS.ink));
  const ringLeads = [0, 1].map(() => wire([[0, 0, 0], [0, 0, 1]], ringSpinner, WIRE * METER / 2));

  const commutator = part('commutator', 'Split ring and fixed brushes', 'Each colored copper half connects to one winding end. Cream separators insulate the halves. The 10° curved brush faces exceed the 6° insulating gaps, shorting the winding for 2° on either side of each voltage zero. This resistive model omits switching arcs and inductance.', MACHINE, system);
  const barSpinner = new THREE.Group(); commutator.add(barSpinner);
  const sleeve = kit.cylinder(0.1, BENCH.barLength, [BENCH.barX, 0, 0], 'cream', barSpinner); sleeve.rotation.z = Math.PI / 2;
  const gap = COIL.gap * Math.PI / 180;
  const segments = [0, 1].map(i => sector(barSpinner, BENCH.barX, 0.1, BENCH.barRadius, BENCH.barLength, Math.PI / 2 + gap / 2 + i * Math.PI, Math.PI - gap, i ? COLORS.brass : COLORS.copper));
  const segmentInsulators = [0, 1].map(i => sector(barSpinner, BENCH.barX, 0.1, BENCH.barRadius, BENCH.barLength, Math.PI / 2 - gap / 2 + i * Math.PI, gap, 0xf3edcc));
  const barBrushes = [1, -1].map(side => sector(commutator, BENCH.barX, BENCH.barRadius, BENCH.barRadius + 0.12, 0.15, side * Math.PI / 2 - COIL.brush * Math.PI / 360, COIL.brush * Math.PI / 180, COLORS.ink));
  const barLeads = [0, 1].map(() => wire([[0, 0, 0], [0, 0, 1]], barSpinner, WIRE * METER / 2));

  const load = part('load', 'Resistor and series switch', 'The external resistor dissipates I²R. Opening the blade breaks its circuit while the turning coil still induces voltage. A split-ring bridge can still heat the winding with this switch open.', [LOAD.x, LOAD.y, LOAD.z], system);
  kit.box([LOAD.width, 0.12, 0.65], [0, -0.22, 0], 'wood', load);
  const resistor = kit.box([0.85, 0.28, 0.3], [0.6, 0, 0], 'leaf', load);
  const switchPivot = new THREE.Group(); switchPivot.position.set(-0.75, 0, 0); load.add(switchPivot);
  const blade = kit.rod([0, 0, 0], [0.55, 0, 0], 0.035, COLORS.brass, switchPivot);
  const studs = [-0.75, -0.2].map(x => kit.sphere(0.06, [x, 0, 0], COLORS.brass, load));
  const wires = [[-1.5, -0.75], [-0.2, 0.18], [1.02, 1.5]].map(([a, b]) => kit.rod([a, 0, 0], [b, 0, 0], 0.025, COLORS.copper, load));
  const loadName = textLabel(load, '', {height: 0.11, width: 1.2, position: [0.6, 0.24, 0.17]});
  const powerRail = kit.box([LOAD.bar, LOAD.barHeight, 0.05], [0, -0.46, 0], COLORS.ink, load);
  const powerBar = kit.box([LOAD.bar, LOAD.barHeight * 0.6, 0.03], [0, -0.46, 0.035], COLORS.current, load);
  const powerLabel = textLabel(load, '', {height: 0.12, width: 3.1, position: [0, -0.66, 0.1]});
  const currentArrows = [-1.2, 1.2].map(x => { const a = solidArrow(kit, COLORS.current, load, 0.015); a.position.set(x, 0.14, 0.15); return a; });
  const leads = part('leads', 'Stationary circuit leads', 'Insulated fixed leads connect the selected brushes to the switch and resistor. Conventional current leaves brush B for positive AC voltage; the split-ring connections keep the load current in one direction.', [0, 0, 0], system);
  const tapWires = [0, 1].map(() => wire([[0, 0, 0], [0, 0, 1]], leads));
  const feedTops = [[LOAD.x - 1.5, LOAD.y, LOAD.z], [LOAD.x + 1.5, LOAD.y, LOAD.z]];
  const ringTap = [[MACHINE[0] + BENCH.ringB, MACHINE[1] + 0.27, 0], [MACHINE[0] + BENCH.ringA, MACHINE[1] - 0.27, 0]];
  const barTap = [[MACHINE[0] + BENCH.barX, MACHINE[1] + 0.27, 0], [MACHINE[0] + BENCH.barX, MACHINE[1] - 0.27, 0]];
  let lastOutput = -1;

  const forces = part('forces', 'Winding current and reaction forces', 'Gold arrows show conventional current; orange arrows show magnetic forces on the two active wire sides. Their torque opposes the imposed rotation. Arrow lengths use a bounded visual scale.', MACHINE, system);
  const coilCurrentArrows = [1, -1].map(() => solidArrow(kit, COLORS.current, forces, 0.012));
  const forceArrows = [1, -1].map(() => solidArrow(kit, COLORS.effort, forces, 0.016));

  const output = part('output', 'Brush voltage over one turn', 'Blue compares slip rings; red compares a split ring at the same speed, field, winding and load. Both include winding voltage loss when the switch is closed. The cursor follows the selected contacts. The horizontal axis is shaft angle, so changing speed changes frequency without changing the chart width.', [0, 0, 0], system);
  const frame = lineObject(5, COLORS.faint, output), zeroLine = lineObject(2, COLORS.ink, output);
  fillLine(frame, [[CHART.x, chartY(-400), 0], [CHART.x + CHART.w, chartY(-400), 0], [CHART.x + CHART.w, chartY(400), 0], [CHART.x, chartY(400), 0], [CHART.x, chartY(-400), 0]]);
  fillLine(zeroLine, [[CHART.x, CHART.y, 0], [CHART.x + CHART.w, CHART.y, 0]]);
  const ringTrace = lineObject(GENERATOR_SAMPLES, COLORS.rings, output), barTrace = lineObject(GENERATOR_SAMPLES, COLORS.bars, output), cursor = segmentLines(2, COLORS.ink, output);
  chartText(output, (angle, volts) => [chartX(angle * Math.PI / 180), chartY(volts), 0], {title: 'Brush voltage', size: 0.24, x: {min: 0, max: 360, title: 'Shaft angle', ticks: [0, 90, 180, 270, 360].map(a => [a, `${a}°`])}, y: {min: -400, max: 400, title: 'V', ticks: [[-400, '−400'], [0, '0'], [400, '400']]}});
  for (const [i, label, color] of [[0, 'Slip rings', COLORS.rings], [1, 'Split ring', COLORS.bars]]) {
    const x = CHART.x + 0.1 + i * 1.55;
    kit.rod([x, CHART.y - 1.6, 0], [x + 0.2, CHART.y - 1.6, 0], 0.014, color, output);
    textLabel(output, label, {height: 0.22, align: 'left', position: [x + 0.25, CHART.y - 1.6, 0]});
  }
  const liveLabel = textLabel(output, '', {height: 0.22, width: 3.1, position: [CHART.x + CHART.w / 2, CHART.y - 2, 0]});

  const d = GENERATOR_DEFAULTS;
  control('output', 'Contacts', ...GENERATOR_DOMAINS.output, d.output, '', 'Swap the physical contacts: two continuous slip rings or one split ring.', OUTPUT_OPTIONS, {primary:true});
  control('speed', 'Shaft speed', ...GENERATOR_DOMAINS.speed, d.speed, 'rpm', 'Ideal maintained speed. One pole pair makes one electrical cycle per turn.');
  control('field', 'Field', ...GENERATOR_DOMAINS.field, d.field, 'T', 'Assumed uniform field between the poles.');
  control('turns', 'Turns', ...GENERATOR_DOMAINS.turns, d.turns, '', 'Every turn is drawn and connected. More turns increase induction and winding resistance.');
  control('load', 'Load', ...GENERATOR_DOMAINS.load, d.load, 'Ω', 'External resistance. A smaller resistance draws more current.');
  control('closed', 'Switch', ...GENERATOR_DOMAINS.closed, d.closed, '', 'Open interrupts the load path. Split-ring brushes can still short the winding during commutation.', [{value: 1, label: 'Closed'}, {value: 0, label: 'Open'}]);

  const replaceWire = (mesh, points, radius) => { mesh.geometry.dispose(); mesh.geometry = polylineGeometry(points, radius); mesh.userData.path = points; };
  const result = finish(v => {
    const plan = generatorPlan(v), now = generatorAt(plan, clock);
    if (drawnTurns !== plan.turns) {
      drawnTurns = plan.turns;
      const points = windingPath(plan.turns), start = points[0], end = points.at(-1);
      replaceWire(windings, points, WIRE * METER / 2);
      for (const arm of arms) arm.scale.y = Math.max(1, plan.turns * BENCH.pitch / 0.09);
      for (const [i, tip] of [start, end].entries()) {
        const side = i ? -1 : 1;
        const approach = i
          ? [tip, [-1.08, tip[1], 0.57], [-1.13, -0.13, 0.57], [-1.17, -0.13, -0.075], [-1.17, 0, -0.075]]
          : [tip, [-1.08, tip[1], 0.5], [-1.13, 0, 0.075]];
        const ringX = [BENCH.ringA, BENCH.ringB][i];
        replaceWire(ringLeads[i], [...approach, [ringX, 0, side * 0.075], [ringX, 0, side * 0.11]], WIRE * METER / 2);
        replaceWire(barLeads[i], [...approach, [BENCH.barX, 0, side * 0.075], [BENCH.barX, 0, side * 0.11]], WIRE * METER / 2);
      }
    }
    for (const group of [spinner, ringSpinner, barSpinner, driveSpinner]) group.rotation.x = now.theta;
    rings.visible = plan.alternating; commutator.visible = !plan.alternating;
    if (lastOutput !== plan.output) {
      lastOutput = plan.output;
      const taps = plan.alternating ? ringTap : barTap;
      for (let i = 0; i < 2; i++) {
        const a = taps[i], end = feedTops[i], laneX = i ? MACHINE[0] - 2.02 : MACHINE[0] - 2.22, z = i ? 0.82 : 1.06;
        replaceWire(tapWires[i], [a, [laneX, a[1], 0], [laneX, a[1], z], [laneX, LOAD.y - i * 0.13, z], [end[0], LOAD.y - i * 0.13, z], end], 0.022);
      }
    }
    switchPivot.rotation.z = plan.closed ? 0 : Math.PI / 3;
    for (const arrow of fieldArrows) arrow.userData.setLength((2 * BENCH.gap - 0.14) * plan.field / 1.2);
    for (let i = 0; i < 2; i++) {
      const side = i ? -1 : 1;
      const point = new THREE.Vector3(0, 0, side * (BENCH.radius + 0.07)).applyAxisAngle(new THREE.Vector3(1, 0, 0), now.theta);
      const current = coilCurrentArrows[i], force = forceArrows[i], sign = Math.abs(now.coilCurrent) > 1e-9 ? Math.sign(now.coilCurrent) : 0;
      current.position.copy(point).add(new THREE.Vector3(side * 0.25, 0, 0)); current.userData.setDirection(new THREE.Vector3(-side * (sign || 1), 0, 0)); current.userData.setLength(sign ? 0.4 : 0);
      force.position.copy(point); force.userData.setDirection(new THREE.Vector3(0, 0, side * (sign || 1))); force.userData.setLength(sign ? Math.min(0.5, Math.abs(now.coilCurrent) * plan.field * 0.035) : 0);
    }
    for (const arrow of currentArrows) { arrow.userData.setDirection(new THREE.Vector3(Math.sign(now.current) || 1, 0, 0)); arrow.userData.setLength(Math.abs(now.current) > 1e-10 ? 0.23 : 0); }
    const peakLoadPower = plan.currentPeak ** 2 * plan.load, share = peakLoadPower > 0 ? now.loadPower / peakLoadPower : 0;
    powerBar.visible = share > 1e-12; powerBar.scale.x = Math.max(1e-9, share); powerBar.position.x = (share - 1) * LOAD.bar / 2;
    powerLabel.userData.setText(`${fixed(now.loadPower, 1)} W now · scale 0–${fixed(peakLoadPower, 0)} W`);
    loadName.userData.setText(`${plan.load} Ω load`);
    fillLine(ringTrace, plan.chart.map(s => [chartX(s.theta), chartY(s.rings), 0.01]));
    fillLine(barTrace, plan.chart.map(s => [chartX(s.theta), chartY(s.commutator), 0.012]));
    const x = chartX(now.theta), y = chartY(now.terminal), c = CHART.cursor;
    fillLine(cursor, [[x - c, y, 0.025], [x + c, y, 0.025], [x, y - c, 0.025], [x, y + c, 0.025]]);
    liveLabel.userData.setText(`${fixed(now.terminal, 1)} V · ${fixed(now.current, 2)} A now`);
    const turning = plan.period !== null, outputValue = plan.alternating ? `${fixed(plan.terminalRms, 2)} V RMS` : `${fixed(plan.terminalMean, 2)} V mean`;
    const status = !turning ? 'Standing still · changing flux needs motion; raise shaft speed to run'
      : clock <= 0 ? `Ready · ${outputValue} at the brushes over one turn; press Play`
      : now.done ? `One turn done · ${outputValue}; ${fixed(plan.loadPower, 1)} W average into the resistor`
      : `Turning · ${fixed(now.terminal, 1)} V at the brushes; ${fixed(now.current, 2)} A through the load`;
    return {state: {...plan, now, clock, drawnTurns, alternating: plan.alternating, turning}, readings: [
      r('Your result', status),
      r('Brush output', turning ? outputValue : '0 V', 'Cycle measurement at the brushes, including the voltage lost in winding resistance. Mean and RMS are different measures.'),
      r('Coil EMF', `${fixed(now.coilEmf, 2)} V`, `Instantaneous signed induction. Peak N B A ω = ${fixed(plan.peak, 2)} V. Winding resistance lowers the delivered voltage.`),
      r('Brush voltage', `${fixed(now.terminal, 2)} V`, 'Instantaneous voltage between the contacted brushes. With the load switch open it can remain nonzero.'),
      r('Load voltage', `${fixed(now.loadVoltage, 2)} V`, 'Instantaneous voltage across the resistor, equal to current times load resistance. Zero when its switch is open.'),
      r('Load current', `${fixed(now.current, 3)} A`, 'Conventional current. Positive flows left to right through the pictured resistor. AC reverses each half turn.'),
      r('Winding current', `${fixed(now.coilCurrent, 3)} A`, 'Signed current inside the rotating winding. During a split-ring bridge, it can circulate through the brushes even with the external load open.'),
      r('Shaft angle', `${fixed(now.theta * 180 / Math.PI, 1)}°`, 'Mechanical angle within this turn. Each Step advances 22.5°. Voltage peaks at 90° and 270°.'),
      r('Frequency', turning ? `${fixed(plan.frequency, 2)} Hz` : 'not turning', 'One full coil-voltage cycle per shaft revolution. The split ring gives two output pulses per revolution.'),
      r('Load', `${fixed(plan.loadPower, 1)} W`, 'Cycle-average resistor heating. The bar shows instantaneous power on its labeled scale.'),
      r('Winding heat', `${heat(plan.windingPower)} W`, plan.alternating ? 'Cycle-average I²R loss in the copper.' : `Includes ${heat(plan.peak ** 2 * plan.bridgeShare / plan.winding)} W during the short brush bridges, even with the load switch open. No arcing model is included.`),
      r('Shaft', `${fixed(plan.drivePower, 1)} W`, 'Cycle-average mechanical input equals load power plus winding heat. An ideal driver maintains speed.'),
      r('Drive torque now', `${significant(now.torque, 3)} N·m`, 'Required electromagnetic drive torque; the reaction on the shaft has equal magnitude and opposite direction.'),
      r('Flux linkage', `${fixed(now.flux * 1000, 1)} mWb·turn`, 'N times the flux through one turn. Greatest magnitude with the loop plane perpendicular to the field; zero when parallel.'),
      r('Contacts', plan.alternating ? 'Continuous slip rings' : now.bridged ? 'Brushes bridge both halves' : 'Each brush touches one half', 'The Contacts selector swaps the physical ring assembly as well as the electrical connection.'),
      r('Slowed', turning ? `${fixed(plan.slow, 0)} times` : 'not turning', `One turn is drawn in ${COIL.show} seconds. Electrical time is ${fixed((plan.period ?? 0) * 1000, 2)} ms per turn.`),
    ]};
  });
  const render = result.update;
  result.update = next => {
    const before = result.getState().values; render(next);
    if (Object.entries(result.getState().values).some(([key, value]) => before[key] !== value)) { clock = 0; lastClock = 0; }
    return render();
  };
  result.advance = dt => { const p = result.getState().period; if (Number.isFinite(dt) && dt > 0 && p !== null) clock = Math.min(p, clock + dt * p / COIL.show); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect the winding', part: 'coil', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect the contacts', get part() { return result.getState().alternating ? 'rings' : 'commutator'; }, view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect the load', part: 'load', view: 'front', replay: false, run: () => render()},
    {label: 'Inspect the voltage chart', part: 'output', view: 'front', isolate: true, replay: false, run: () => render()},
  ];
  if (commutatorLesson) result.actions.push({
    label: 'Pause at brush bridge', part: 'commutator', view: 'side', isolate: true, replay: false,
    run: () => {
      render({...result.getState().values, output: 1});
      clock = (result.getState().period ?? 0) * 179 / 360;
      lastClock = 0;
      return render();
    },
  });
  result.playback = {label: 'Turn the shaft', description: 'One complete turn, drawn in eight seconds. Pause freezes the measured phase.', stepLabel: 'Advance a sixteenth of a turn', advance: result.advance, step: () => result.advance(COIL.show / 16), complete: () => result.getState().now.done, blocked: () => !result.getState().turning};
  result.resultPart = {id: 'output', label: 'Inspect brush voltage', view: 'front', focusOnComplete: false, available: () => result.getState().now.done};
  forces.userData.explosionExcluded = true;
  for (const arrow of [...fieldArrows, ...currentArrows]) arrow.userData.explosionExcluded = true;
  for (const [id, name, ids] of [
    ['stationary-group', 'Supports and magnetic field', ['structure', 'field']],
    ['rotating-group', 'Rotating assembly', ['coil', 'drive']],
    ['circuit-group', 'Electrical connections and load', ['rings', 'commutator', 'leads', 'load']],
  ]) {
    const category = part(id, name, name + ' grouped for inspection and separation.', [0, 0, 0], system);
    category.userData.explosionCategory = true;
    for (const childId of ids) {
      const child = kit.parts.find(item => item.id === childId);
      category.attach(child.object); child.parentId = id;
    }
  }
  output.userData.explosionCategory = true;
  kit.root.rotation.set(0.08, -0.12, 0);
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.57;
  result.selectionOutline = false; result.transparentBackground = true;
  result.topology = {system, structure, field, poles, fieldArrows, coil, shaft, spinner, windings, arms, driveSpinner, rings, ringSpinner, ringMeshes, ringKeys, ringBrushes, ringLeads, commutator, barSpinner, segments, segmentInsulators, barLeads, barBrushes, output, frame, zeroLine, ringTrace, barTrace, cursor, load, resistor, switchPivot, blade, studs, wires, powerRail, powerBar, currentArrows, forces, coilCurrentArrows, forceArrows, leads, tapWires, ringTap, barTap, feedTops};
  const dispose = result.dispose; result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

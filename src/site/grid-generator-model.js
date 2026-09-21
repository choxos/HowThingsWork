import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow, surface} from './scene-kit.js';
import {generatorPlan, generatorAt, commutatedEmf, windingResistanceOf, COIL, COIL_AREA, BRIDGE, GENERATOR_DEFAULTS, GENERATOR_DOMAINS, GENERATOR_SAMPLES, OUTPUT_OPTIONS, SUPPLY, SYNCHRONOUS} from './grid-physics.js';

// ---------------------------------------------------------------------------
// The generator: one rectangular coil turning between two poles, its ends
// carried out either by two slip rings or by a split ring, and the two outputs
// drawn against each other over one turn.
//
// Scale: the machine is drawn at true size, 1 m to 10 scene units, so the
// coil's 200 by 100 mm loop is 2.0 by 1.0 units and each turn of 2.5 mm² wire
// is 1.78 mm thick. The chart is not to scale: it is fixed at one turn across
// and 400 V up and down, said in the part text and in a reading.
//
// Time: one turn is drawn in 8 seconds, so the shaft is slowed by 8 divided by
// the turn's length, which a reading gives.
// ---------------------------------------------------------------------------

/** Scene units per meter: the machine is at true size. */
export const METER = 10;
/** The wire's diameter, m, for a round wire of the declared cross section. */
export const WIRE = 2 * Math.sqrt(COIL.wire / Math.PI);
export const MACHINE = Object.freeze([-1.9, 0.9, 0]);
/** The machine in scene units: the loop, the shaft, the poles and the two sets of contacts. */
export const BENCH = Object.freeze({
  half: COIL.length / 2 * METER, radius: COIL.width / 2 * METER, pitch: WIRE * METER,
  shaft: 1.7, shaftRadius: 0.045, gap: 0.8, poleThick: 0.5, poleWide: 2.4, poleDeep: 1.4,
  ringRadius: 0.16, ringWidth: 0.1, ringA: -1.25, ringB: -1.05, ringKey: 0.05,
  barRadius: 0.16, barLength: 0.24, barX: 1.15, brushGap: 0.02, brushSize: 0.18,
  arrowZ: 0.62, arrow: 0.035, fieldZ: Object.freeze([-0.45, 0, 0.45]),
});
/** The chart: one turn across and 400 V up and down, on a fixed scale. */
export const CHART = Object.freeze({x: 0.35, y: 0.95, w: 2.8, h: 0.6, volts: 400, z: 0, tick: 0.06, cursor: 0.07});
/** The load bench under the machine. */
export const LOAD = Object.freeze({x: -1.9, y: -1.15, z: 0, width: 3, height: 0.55, bar: 2.2, barHeight: 0.12, watts: 1400});
export const COLORS = Object.freeze({north: 0xc14f39, south: 0x83b4c1, steel: 0xb4c5b0, copper: 0xce825f, brass: 0xe3b45e, ink: 0x374736, faint: 0x9aa39a, rings: 0x2b5d9c, bars: 0xc14f39, board: 0xf0dfaf, field: 0x83b4c1, current: 0xe3b45e, effort: 0xd9822b, shell: 0xae8056});

/** Where a turn angle and a voltage fall on the chart. */
export const chartX = theta => CHART.x + Math.max(0, Math.min(1, theta / (2 * Math.PI))) * CHART.w;
export const chartY = volts => CHART.y + Math.max(-1, Math.min(1, volts / CHART.volts)) * CHART.h / 2;

/** The rectangle of turn `k` of `turns`, in the coil's own frame: four corners around the loop. */
export function turnCorners(k, turns) {
  const y = (k - (turns - 1) / 2) * BENCH.pitch, {half, radius} = BENCH;
  return [[-half, y, radius], [half, y, radius], [half, y, -radius], [-half, y, -radius]];
}

export function createGeneratorModel() {
  const kit = houseModel('Electric generator'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, drawnTurns = -1;
  const unlit = color => new THREE.MeshBasicMaterial({color});
  const flat = (color, parent) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };

  const system = part('system', 'The generator and what it delivers', `A coil of wire turning between two poles, drawn at true size, 1 m to ${fixed(METER, 0)} scene units. Its ends come out either at two slip rings, which hand the coil's voltage out as it stands, or at a split ring, which hands out its size. Press Play to turn the shaft through one turn, drawn in ${fixed(COIL.show, 0)} seconds.`);

  // The poles.
  const field = part('field', 'The two poles and their field', `Two poles face each other ${fixed(2 * BENCH.gap / METER * 1000, 0)} mm apart. The warm pole above is north and the cool one below is south, and the field runs from one to the other. The arrows grow with the field you set.`, MACHINE, system);
  const poles = [1, -1].map(side => kit.box([BENCH.poleWide, BENCH.poleThick, BENCH.poleDeep], [0, side * (BENCH.gap + BENCH.poleThick / 2), 0], side > 0 ? COLORS.north : COLORS.south, field));
  const fieldArrows = BENCH.fieldZ.map(z => { const arrow = solidArrow(kit, COLORS.field, field, BENCH.arrow); arrow.position.set(0, BENCH.gap, z); arrow.userData.setDirection(new THREE.Vector3(0, -1, 0)); return arrow; });

  // The coil and its shaft.
  const coil = part('coil', 'The turning coil', `A loop ${fixed(COIL.length * 1000, 0)} by ${fixed(COIL.width * 1000, 0)} mm, wound with ${fixed(COIL.wire * 1e6, 1)} mm² copper wire ${fixed(WIRE * 1000, 2)} mm across, turning on a shaft. Every turn you ask for is drawn, and every turn adds both voltage and winding resistance. Edge on to the field the loop holds the most flux and makes no voltage; face on it holds none and makes the most.`, MACHINE, system);
  const shaft = kit.rod([-BENCH.shaft, 0, 0], [BENCH.shaft, 0, 0], BENCH.shaftRadius, 'metal', coil);
  const spinner = new THREE.Group();
  coil.add(spinner);
  const windings = segmentLines(GENERATOR_DOMAINS.turns[1] * 4, COLORS.copper, spinner);
  const arms = [-1, 1].map(side => { const arm = kit.box([0.12, 0.12, 2 * BENCH.radius], [side * BENCH.half * 0.6, 0, 0], 'cream', spinner); return arm; });

  // The slip rings and their brushes.
  const rings = part('rings', 'Two slip rings', `Each end of the coil is joined to its own copper ring, and a fixed brush rubs on each. The rings never change which brush they touch, so the coil's voltage reaches the load exactly as the coil makes it: it rises, falls, and changes sign twice a turn. The white key on each ring shows it turning.`, MACHINE, system);
  const ringSpinner = new THREE.Group();
  rings.add(ringSpinner);
  const ringMeshes = [BENCH.ringA, BENCH.ringB].map((x, i) => { const mesh = kit.cylinder(BENCH.ringRadius, BENCH.ringWidth, [x, 0, 0], i === 0 ? COLORS.copper : COLORS.brass, ringSpinner); mesh.rotation.z = Math.PI / 2; return mesh; });
  const ringKeys = [BENCH.ringA, BENCH.ringB].map(x => kit.box([BENCH.ringWidth * 0.8, BENCH.ringKey, BENCH.ringKey], [x, BENCH.ringRadius + BENCH.ringKey / 2, 0], 'cream', ringSpinner));
  const ringBrushes = [[BENCH.ringA, 1], [BENCH.ringB, -1]].map(([x, side]) => kit.box([BENCH.brushSize * 0.7, BENCH.brushSize, BENCH.brushSize], [x, side * (BENCH.ringRadius + BENCH.brushGap + BENCH.brushSize / 2), 0], COLORS.ink, rings));
  const ringLeads = [[BENCH.ringA, BENCH.radius], [BENCH.ringB, -BENCH.radius]].map(([x, z]) => kit.rod([x, 0, 0], [-BENCH.half, 0, z], 0.03, COLORS.copper, ringSpinner));

  // The split ring and its brushes.
  const commutator = part('commutator', 'The split ring', `One ring cut into two halves, each joined to one end of the coil. The halves turn with the shaft, so every half turn each brush meets the other half: the coil's voltage still changes sign, but the brush that was positive stays positive. The gaps are ${fixed(COIL.gap, 0)}° wide and the brush faces ${fixed(COIL.brush, 0)}°, so a brush is wider than a gap and bridges both halves for ${fixed(BRIDGE * 180 / Math.PI, 0)}° either side of every crossing.`, MACHINE, system);
  const barSpinner = new THREE.Group();
  commutator.add(barSpinner);
  const segments = [0, 1].map(i => {
    const start = COIL.gap / 2 * Math.PI / 180 + i * Math.PI, sweep = Math.PI - COIL.gap * Math.PI / 180;
    const mesh = surface(kit, new THREE.CylinderGeometry(BENCH.barRadius, BENCH.barRadius, BENCH.barLength, 24, 1, true, start, sweep), i === 0 ? COLORS.copper : COLORS.brass, barSpinner, true);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(BENCH.barX, 0, 0);
    return mesh;
  });
  const barLeads = [BENCH.radius, -BENCH.radius].map(z => kit.rod([BENCH.barX, 0, 0], [BENCH.half, 0, z], 0.03, COLORS.copper, barSpinner));
  const barBrushes = [1, -1].map(side => kit.box([BENCH.brushSize * 0.7, BENCH.brushSize, BENCH.brushSize], [BENCH.barX, side * (BENCH.barRadius + BENCH.brushGap + BENCH.brushSize / 2), 0], COLORS.ink, commutator));

  // The chart of both outputs over one turn.
  const output = part('output', 'The two outputs, over one turn', `What each set of contacts hands out through one whole turn, on a fixed scale of ${fixed(CHART.volts, 0)} V up and down. The blue curve is the slip rings: a sine that changes sign twice a turn. The red curve is the split ring: the same size, never below zero, notched where the brush bridges both halves. The cross marks where the shaft is now.`, [0, 0, 0], system);
  const frame = lineObject(5, COLORS.ink, output);
  const zeroLine = segmentLines(1, COLORS.faint, output);
  const ticks = segmentLines(3, COLORS.faint, output);
  const ringTrace = lineObject(GENERATOR_SAMPLES, COLORS.rings, output);
  const barTrace = lineObject(GENERATOR_SAMPLES, COLORS.bars, output);
  const cursor = segmentLines(2, COLORS.ink, output);
  fillLine(frame, [[CHART.x, CHART.y - CHART.h / 2, CHART.z], [CHART.x + CHART.w, CHART.y - CHART.h / 2, CHART.z], [CHART.x + CHART.w, CHART.y + CHART.h / 2, CHART.z], [CHART.x, CHART.y + CHART.h / 2, CHART.z], [CHART.x, CHART.y - CHART.h / 2, CHART.z]]);
  fillLine(zeroLine, [[CHART.x, CHART.y, CHART.z], [CHART.x + CHART.w, CHART.y, CHART.z]]);
  fillLine(ticks, [1, 2, 3].flatMap(k => [[chartX(k * Math.PI / 2), CHART.y - CHART.h / 2, CHART.z], [chartX(k * Math.PI / 2), CHART.y - CHART.h / 2 - CHART.tick, CHART.z]]));

  // The load.
  const load = part('load', 'The load and the switch', `A resistor across the brushes, with a switch in the line. Closed, the coil drives a current through it and the shaft has to work; open, the coil still makes its voltage but nothing flows and the shaft turns free. The bar below shows the power the resistor is taking, on a fixed scale of ${fixed(LOAD.watts, 0)} W.`, [LOAD.x, LOAD.y, LOAD.z], system);
  const board = kit.box([LOAD.width, 0.12, 0.6], [0, -LOAD.height / 2 - 0.06, 0], 'wood', load);
  const resistor = kit.box([0.9, 0.34, 0.34], [0.6, 0, 0], 'leaf', load);
  const switchPivot = new THREE.Group();
  switchPivot.position.set(-0.75, 0, 0);
  load.add(switchPivot);
  const blade = kit.rod([0, 0, 0], [0.55, 0, 0], 0.035, COLORS.brass, switchPivot);
  const studs = [-0.75, -0.2].map(x => kit.sphere(0.06, [x, 0, 0], COLORS.brass, load));
  const wires = [[-1.5, -0.75], [-0.2, 0.15], [1.05, 1.5]].map(([a, b]) => kit.rod([a, 0, 0], [b, 0, 0], 0.03, COLORS.copper, load));
  const feeds = [-1.5, 1.5].map(x => kit.rod([x, 0, 0], [x, 0.55, 0], 0.03, COLORS.copper, load));
  const powerRail = kit.box([LOAD.bar, LOAD.barHeight, 0.08], [0, -LOAD.height / 2 - 0.34, 0.06], COLORS.ink, load);
  const powerBar = flat(COLORS.current, load);
  const currentArrows = [-1, 1].map(side => { const arrow = solidArrow(kit, COLORS.current, load, 0.03); arrow.position.set(side * 1.18, 0.28, 0.1); arrow.userData.setDirection(new THREE.Vector3(side, 0, 0)); return arrow; });
  const effort = solidArrow(kit, COLORS.effort, system, 0.04);
  effort.position.set(MACHINE[0] + BENCH.shaft + 0.1, MACHINE[1], 0);
  effort.userData.setDirection(new THREE.Vector3(0, 1, 0));
  // The two leads that carry whichever set of contacts is wired to the load.
  const tapWires = segmentLines(2, COLORS.copper, system);
  const brushHeight = BENCH.ringRadius + BENCH.brushGap + BENCH.brushSize / 2;
  const feedTops = [[LOAD.x - 1.5, LOAD.y + 0.55, 0], [LOAD.x + 1.5, LOAD.y + 0.55, 0]];
  const ringTap = [[MACHINE[0] + BENCH.ringA, MACHINE[1] + brushHeight, 0], [MACHINE[0] + BENCH.ringB, MACHINE[1] - brushHeight, 0]];
  const barTap = [[MACHINE[0] + BENCH.barX, MACHINE[1] - brushHeight, 0], [MACHINE[0] + BENCH.barX, MACHINE[1] + brushHeight, 0]];

  const d = GENERATOR_DEFAULTS;
  control('output', 'Contacts', ...GENERATOR_DOMAINS.output, d.output, '', 'Two slip rings, which hand the coil voltage out as it stands, or a split ring, which hands out its size.', OUTPUT_OPTIONS);
  control('speed', 'Shaft speed', ...GENERATOR_DOMAINS.speed, d.speed, 'rpm', 'How fast the drive turns the shaft. A machine with one pole pair makes one cycle a turn.');
  control('field', 'Field', ...GENERATOR_DOMAINS.field, d.field, 'T', 'How strong the field between the poles is. Not from a source.');
  control('turns', 'Turns', ...GENERATOR_DOMAINS.turns, d.turns, '', 'How many turns of wire the loop carries. Every turn adds voltage and adds resistance.');
  control('load', 'Load', ...GENERATOR_DOMAINS.load, d.load, 'Ω', 'The resistor across the brushes. Not from a source.');
  control('closed', 'Switch', ...GENERATOR_DOMAINS.closed, d.closed, '', 'Closed lets current flow; open leaves the coil making its voltage with nothing to drive.', [{value: 1, label: 'Closed'}, {value: 0, label: 'Open'}]);

  const result = finish(v => {
    const plan = generatorPlan(v), now = generatorAt(plan, clock);

    // Every turn asked for, drawn.
    if (drawnTurns !== plan.turns) {
      drawnTurns = plan.turns;
      const points = [];
      for (let k = 0; k < plan.turns; k++) {
        const corners = turnCorners(k, plan.turns);
        for (let i = 0; i < 4; i++) points.push(corners[i], corners[(i + 1) % 4]);
      }
      fillLine(windings, points);
      for (const arm of arms) arm.scale.y = Math.max(1, plan.turns * BENCH.pitch / 0.12);
    }
    spinner.rotation.x = now.theta;
    ringSpinner.rotation.x = now.theta;
    barSpinner.rotation.x = now.theta;

    // The field: the arrows grow with it and vanish when it is switched off.
    for (const arrow of fieldArrows) arrow.userData.setLength(plan.field > 0 ? 2 * BENCH.gap * plan.field / GENERATOR_DOMAINS.field[1] : 0);

    // Which contacts are wired to the load.
    const alternating = plan.alternating;
    const tap = alternating ? ringTap : barTap;
    fillLine(tapWires, [tap[0], feedTops[0], tap[1], feedTops[1]]);
    switchPivot.rotation.z = plan.closed ? 0 : Math.PI / 3;
    for (const arrow of currentArrows) {
      const size = Math.min(0.5, Math.abs(now.current) / 20 * 0.5);
      arrow.userData.setLength(size);
      arrow.userData.setDirection(new THREE.Vector3(Math.sign(now.current) || 1, 0, 0).multiplyScalar(arrow.position.x > 0 ? 1 : -1));
    }
    const share = Math.max(0, Math.min(1, now.loadPower / LOAD.watts));
    rect(powerBar, -LOAD.bar / 2, -LOAD.bar / 2 + share * LOAD.bar, -LOAD.height / 2 - 0.34 - LOAD.barHeight / 2 + 0.02, -LOAD.height / 2 - 0.34 + LOAD.barHeight / 2 - 0.02, 0.11);
    powerBar.visible = share > 0;
    effort.userData.setLength(plan.drivePower > 0 ? Math.min(0.9, plan.drivePower / 1500 * 0.9) : 0);

    // The two traces and the cursor.
    fillLine(ringTrace, plan.chart.map(sample => [chartX(sample.theta), chartY(sample.rings), CHART.z]));
    fillLine(barTrace, plan.chart.map(sample => [chartX(sample.theta), chartY(sample.commutator), CHART.z]));
    const cx = chartX(now.theta), cy = chartY(now.terminal);
    fillLine(cursor, [[cx - CHART.cursor, cy, CHART.z], [cx + CHART.cursor, cy, CHART.z], [cx, cy - CHART.cursor, CHART.z], [cx, cy + CHART.cursor, CHART.z]]);

    const turning = plan.period !== null;
    const status = !turning ? 'Standing still · a field alone makes no voltage; set a speed and press Play'
      : clock <= 0 ? `Ready · ${alternating ? 'the slip rings' : 'the split ring'} will hand out ${alternating ? `${fixed(plan.rms, 1)} V RMS` : `${fixed(plan.mean, 1)} V on average`}; press Play`
      : !now.done ? `Turning · ${fixed(now.terminal, 1)} V at the brushes, ${fixed(Math.abs(now.current), 2)} A through the load`
      : `One turn done · ${alternating ? `${fixed(plan.rms, 1)} V RMS` : `${fixed(plan.mean, 1)} V on average`}, ${fixed(plan.loadPower, 0)} W into the resistor`;

    return {
      state: {...plan, now, clock, drawnTurns, alternating, turning},
      readings: [
        r('Your result', status),
        r('Output', turning ? (alternating ? `${fixed(plan.rms, 2)} V RMS` : `${fixed(plan.mean, 2)} V mean`) : '0 V', turning
          ? `The coil's peak is N B A ω: ${fixed(plan.turns, 0)} turns through ${fixed(plan.field, 2)} T over ${fixed(COIL_AREA, 3)} m² at ${fixed(plan.omega, 1)} rad/s give ${fixed(plan.peak, 2)} V. The slip rings hand that sine out as it stands, ${fixed(plan.rms, 2)} V RMS, which is the peak over the square root of 2. The split ring hands out its size, whose mean is 2/π of the peak less the notches, ${fixed(plan.mean, 2)} V.`
          : 'With the shaft still the flux through the loop never changes, so there is no voltage at all, however strong the field.'),
        r('Frequency', turning ? `${fixed(plan.frequency, 2)} Hz` : 'not turning', `One pole pair makes one cycle every turn, so the frequency is the speed over 60. A machine with ${SYNCHRONOUS.poles} poles has to turn at ${fixed(plan.synchronous.fifty, 0)} rpm for ${fixed(SUPPLY.frequency, 0)} Hz and ${fixed(plan.synchronous.sixty, 0)} rpm for 60 Hz, because the speed follows N = 120 f / P.`),
        r('Load', plan.closed ? `${fixed(plan.loadPower, 1)} W` : 'switch open', plan.closed
          ? `The loop's own winding is ${fixed(plan.winding, 4)} Ω: ${fixed(plan.turns, 0)} turns of ${fixed(COIL.wire * 1e6, 1)} mm² copper make ${fixed(plan.turns * 2 * (COIL.length + COIL.width), 1)} m of wire. With ${fixed(plan.load, 0)} Ω beyond it the current peaks at ${fixed(plan.currentPeak, 2)} A and the resistor takes ${fixed(plan.loadPower, 1)} W.`
          : `The coil still makes ${fixed(plan.peak, 2)} V at its peak, but with the switch open nothing flows, nothing is delivered, and the shaft costs no extra torque.`),
        r('Winding heat', `${fixed(plan.windingPower, 3)} W`, alternating
          ? `The same current runs through the winding's ${fixed(plan.winding, 4)} Ω on its way to the load, and heats it. This is the price of the wire, not of the load.`
          : `While a brush bridges both halves the coil is shorted through itself, whatever the switch is doing, and its own ${fixed(plan.winding, 4)} Ω takes ${fixed(plan.peak ** 2 * plan.bridgeShare / plan.winding, 3)} W of the ${fixed(plan.windingPower, 3)} W. That short is why a commutator sparks.`),
        r('Shaft', turning ? `${fixed(plan.drivePower, 1)} W` : '0 W', `Whatever the coil delivers and whatever the winding wastes has to come in at the shaft: ${fixed(plan.loadPower, 1)} W plus ${fixed(plan.windingPower, 3)} W. Nothing comes from the magnet. The orange arrow is the effort the drive supplies.`),
        r('Flux', `${fixed(plan.fluxPeak * 1000, 3)} mWb`, `Edge on to the field the loop holds ${fixed(plan.turns, 0)} turns times ${fixed(plan.field, 2)} T times ${fixed(COIL_AREA, 3)} m², which is ${fixed(plan.fluxPeak * 1000, 3)} mWb, and makes no voltage. A quarter turn later it holds none and makes its most. The voltage follows the rate the flux changes, not the flux.`),
        r('Slowed', turning ? `${fixed(plan.slow, 0)} times` : 'not turning', `One turn takes ${fixed((plan.period ?? 0) * 1000, 2)} ms and is drawn in ${fixed(COIL.show, 0)} seconds. The machine itself is drawn at true size; the chart is on a fixed scale of ${fixed(CHART.volts, 0)} V up and down.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().period;
  result.advance = dt => {
    const period = duration();
    if (Number.isFinite(dt) && dt > 0 && period !== null) clock = Math.min(period, clock + dt * period / COIL.show);
    return render();
  };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = share => { const period = duration(); clock = period === null ? 0 : period * share; return render(); };
  result.actions = [
    {label: 'Inspect: the coil face on', part: 'coil', view: 'front', replay: false, run() { return inspect(0.25); }},
    {label: 'Inspect: the slip rings', part: 'rings', view: 'front', replay: false, run() { return inspect(0.125); }},
    {label: 'Inspect: the split ring', part: 'commutator', view: 'front', replay: false, run() { return inspect(0.5); }},
    {label: 'Inspect: the load', part: 'load', view: 'front', replay: false, run() { return inspect(0.25); }},
  ];
  result.playback = {
    label: 'Turn the shaft',
    description: `One whole turn of the shaft, drawn in ${fixed(COIL.show, 0)} seconds however fast it is really turning.`,
    stepLabel: 'Advance a sixteenth of a turn',
    advance: result.advance,
    step: () => result.advance(COIL.show / 16),
    complete: () => { const period = duration(); return period !== null && clock >= period; },
    blocked: () => duration() === null,
  };
  result.resultPart = {id: 'output', label: 'Inspect the two outputs', view: 'front', focusOnComplete: false, available: () => { const period = duration(); return period !== null && clock >= period; }};

  kit.root.rotation.set(0.05, -0.12, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, field, poles, fieldArrows, coil, shaft, spinner, windings, arms, rings, ringSpinner, ringMeshes, ringKeys, ringBrushes, ringLeads, commutator, barSpinner, segments, barLeads, barBrushes, output, frame, zeroLine, ticks, ringTrace, barTrace, cursor, load, board, resistor, switchPivot, blade, studs, wires, feeds, powerRail, powerBar, currentArrows, effort, tapWires, ringTap, barTap, feedTops};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

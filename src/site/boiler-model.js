import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {boilerPlan, boilerAt, tankAt, combustionOf, AIR, BOILER_DEFAULTS, BOILER_DOMAINS, DECLARED, EFFICIENCY, LAMBDA, AIR_MASS, VOGUE, WATER} from './boiler-physics.js';

// ---------------------------------------------------------------------------
// Gas boiler: the boiler cut open at true size, what goes up its flue, the
// pipe from it to the tap, and the temperatures through a run.
//
// Scale: the boiler is drawn at true size, 1 mm to 0.002 scene units, its
// casing the sheet's 740 by 445 mm and everything inside it illustrative in
// size and place. The pipe to the tap is drawn 20 times smaller than that, so
// 15 m of it fits beside the boiler. The flue gas bar and the chart are not to
// scale.
//
// Time: the run plays 5 times faster than the real thing, said in the part
// text and in a reading.
// ---------------------------------------------------------------------------

export const MM = 0.002;
export const METER = 0.1;

/** How many times smaller than the boiler beside it the pipe to the tap is drawn. */
export const timesSmaller = (unitsPerMeter = METER) => MM * 1000 / unitsPerMeter;

/** The boiler, mm about the middle of its casing: the casing, the combustion chamber, the burner and its flames, the exchanger's passes, the fan and flue, the gas valve and its pipe, the electrodes, the water pipes and the turbine, and the control box with its knob. */
export const BOILER = Object.freeze({
  origin: Object.freeze([-1.52, 0, 0]),
  chamber: Object.freeze([-105, 105, -55, 255]),
  burner: Object.freeze([-85, 85, -34, -20]), flames: 9, flame: Object.freeze([9, 60]),
  passes: 5, pass: Object.freeze([-95, 95, 60, 220]), tube: 9,
  fan: Object.freeze([0, 300, 45]), blades: 5,
  flue: Object.freeze([345, 470, 50, 30]),
  valve: Object.freeze([-150, -90, -145, -85]), gate: 16, gasPipe: -120,
  electrodes: Object.freeze([-55, 55, -4, 44]),
  coldPipe: -190, hotPipe: 190, turbine: Object.freeze([-190, -300, 24]),
  control: Object.freeze([95, 175, -310, -225]), knob: Object.freeze([135, -267, 27]),
});

/** The chart of temperatures through the run, scene units, and the range it spans in °C. */
export const CHART = Object.freeze({x: -0.62, y: 0.3, w: 1.95, h: 0.72, z: 0, range: Object.freeze([0, 70]), tickEvery: 10, tick: 0.022, cursor: 0.022, mark: 0.03});

/** What goes up the flue: where the bar sits, its size, the gap between gases, and the temperature scale beneath it. */
export const FLUEVIEW = Object.freeze({origin: Object.freeze([-0.62, -0.42, 0]), bar: Object.freeze([1.95, 0.17]), gap: 0.004, scale: Object.freeze([0, 90]), axis: Object.freeze([0.3, 1.95, 0.05])});

/** The pipe to the tap: where it starts, how thick it is drawn, how many pieces carry its colors, and the tap at its end. */
export const PIPEVIEW = Object.freeze({origin: Object.freeze([-0.62, -1.0, 0]), thickness: 0.055, pieces: 24, tap: Object.freeze([0.07, 0.16, 0.05]), stream: Object.freeze([0.03, 0.22])});

/** The colors water takes between these two temperatures, °C. */
export const HEAT_SCALE = Object.freeze([5, 70]);

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, chamber: 0xf3ede1, metal: 0xb4c5b0, board: 0x4f5b55, knob: 0x2f3336,
  flame: 0xe07a3c, flameCore: 0x5f8fd0, gas: 0xe3b45e, spark: 0xf0c419, faint: 0x9aa39a, text: 0x6b7378,
  cold: 0x3f7fbf, hot: 0xc14f39, chart: 0x374736, set: 0x7d5ba6, inlet: 0x86a5bf,
  nitrogen: 0xa9bfd6, water: 0x86a5bf, carbonDioxide: 0x6b7378, oxygen: 0x2e8b57, argon: 0xd6cae6, dew: 0x7d5ba6, flue: 0xc9785a,
});

/** The five gases the flue carries, in the order the bar stacks them. */
export const GASES = Object.freeze(['nitrogen', 'water', 'carbonDioxide', 'oxygen', 'argon']);
export const GAS_NAMES = Object.freeze({nitrogen: 'nitrogen', water: 'steam', carbonDioxide: 'carbon dioxide', oxygen: 'oxygen', argon: 'argon'});

/** Where a time, s, and a temperature, °C, fall on the chart. */
export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.range[0]) / (CHART.range[1] - CHART.range[0])) * CHART.h;
/** Where a temperature falls on the flue panel's scale. */
export const scaleX = celsius => clamp((celsius - FLUEVIEW.scale[0]) / (FLUEVIEW.scale[1] - FLUEVIEW.scale[0])) * FLUEVIEW.bar[0];

/** What the sheet's full hot water output sends up the flue, for the reading that adds the heat up. */
export const FULL = combustionOf(VOGUE.inputGross);

const cold = new THREE.Color(COLORS.cold), hot = new THREE.Color(COLORS.hot);
/** The color of water at `celsius`. */
export const heatColor = celsius => cold.clone().lerp(hot, clamp((celsius - HEAT_SCALE[0]) / (HEAT_SCALE[1] - HEAT_SCALE[0])));

export function createGasBoilerModel() {
  const kit = houseModel('Gas boiler'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const millimeters = (mesh, x0, x1, y0, y1, z = 0) => rect(mesh, x0 * MM, x1 * MM, y0 * MM, y1 * MM, z);
  const outline = (line, x0, x1, y0, y1, z, scale = MM) => fillLine(line, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => [x * scale, y * scale, z]));
  const circlePoints = (cx, cy, radius, count, z, scale = MM) => Array.from({length: count}, (_, i) => { const a = 2 * Math.PI * i / (count - 1); return [(cx + radius * Math.cos(a)) * scale, (cy + radius * Math.sin(a)) * scale, z]; });

  const [caseH, caseW] = VOGUE.casing, halfW = caseW / 2, halfH = caseH / 2;
  const system = part('system', 'Gas boiler, cut open', `A gas boiler cut open at true size, ${fixed(caseH, 0)} mm tall and ${fixed(caseW, 0)} mm wide, everything inside it illustrative: the burner, the heat exchanger above it, the fan and flue, the gas valve, and the control with the turbine that tells it the tap is running. Beside it, what goes up the flue, the pipe to the tap drawn ${fixed(timesSmaller(), 0)} times smaller, and the temperatures through the run. Press Play to open the hot tap: the run plays ${DECLARED.faster} times faster than the real thing.`);

  // The boiler, cut open at true size.
  const shell = part('boiler', 'Boiler casing', `The casing, ${fixed(caseH, 0)} mm by ${fixed(caseW, 0)} mm by ${fixed(VOGUE.casing[2], 0)} mm, as the sheet gives it, drawn at true size and cut open from the front. Inside, the burner fires up into the heat exchanger, the fan pulls the hot gas through it and out the flue, and the water runs the other way, in cold at the bottom and out hot to the tap.`, BOILER.origin, system);
  const board = flat(COLORS.casing, shell);
  millimeters(board, -halfW, halfW, -halfH, halfH, -0.01);
  const caseLine = lineObject(5, COLORS.shell, shell);
  outline(caseLine, -halfW, halfW, -halfH, halfH, -0.008);
  const [chamber0, chamber1, chamberLow, chamberHigh] = BOILER.chamber;
  const chamberFace = flat(COLORS.chamber, shell);
  millimeters(chamberFace, chamber0, chamber1, chamberLow, chamberHigh, -0.007);
  const chamberLine = lineObject(5, COLORS.faint, shell);
  outline(chamberLine, chamber0, chamber1, chamberLow, chamberHigh, -0.006);

  // The burner and its flames.
  const burner = part('burner', 'Gas burner', `The burner bar, ${fixed(BOILER.burner[1] - BOILER.burner[0], 0)} mm across, with the spark electrode on one side and the flame sensing electrode on the other. Its ${BOILER.flames} flames stand tall in proportion to how hard the burner fires, from nothing to the sheet’s ${fixed(VOGUE.output, 1)} kW.`, BOILER.origin, system);
  const [burner0, burner1, burnerLow, burnerHigh] = BOILER.burner;
  const burnerBar = flat(COLORS.shell, burner);
  millimeters(burnerBar, burner0, burner1, burnerLow, burnerHigh, -0.004);
  const flameGeometry = new THREE.BufferGeometry();
  flameGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOILER.flames * 9), 3));
  const flames = new THREE.Mesh(flameGeometry, unlit(COLORS.flame, {side: THREE.DoubleSide}));
  flames.frustumCulled = false;
  burner.add(flames);
  const coreGeometry = new THREE.BufferGeometry();
  coreGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOILER.flames * 9), 3));
  const cores = new THREE.Mesh(coreGeometry, unlit(COLORS.flameCore, {side: THREE.DoubleSide}));
  cores.frustumCulled = false;
  burner.add(cores);
  const [sparkX, senseX, electrodeLow, electrodeHigh] = BOILER.electrodes;
  const electrodes = segmentLines(2, COLORS.chart, burner);
  fillLine(electrodes, [[sparkX, electrodeHigh], [sparkX, electrodeLow], [senseX, electrodeHigh], [senseX, electrodeLow]].map(([x, y]) => [x * MM, y * MM, -0.003]));
  const spark = lineObject(5, COLORS.spark, burner);
  const sparkStep = (electrodeLow - burnerHigh) / 4;
  fillLine(spark, [0, 1, 2, 3, 4].map(i => [sparkX + [0, 7, -6, 5, 0][i], electrodeLow - i * sparkStep]).map(([x, y]) => [x * MM, y * MM, -0.002]));

  // The heat exchanger: passes of water above the flames.
  const exchanger = part('exchanger', 'Heat exchanger', `The water’s way through the flame’s gases: ${BOILER.passes} passes with returns at their ends, holding the sheet’s ${fixed(VOGUE.content, 1)} L. The model treats that water as one well stirred volume, so every pass takes the color of the water leaving it.`, BOILER.origin, system);
  const [pass0, pass1, passLow, passHigh] = BOILER.pass, passes = [];
  for (let i = 0; i < BOILER.passes; i++) {
    const y = passLow + (passHigh - passLow) * i / (BOILER.passes - 1), mesh = flat(COLORS.cold, exchanger);
    millimeters(mesh, pass0, pass1, y - BOILER.tube / 2, y + BOILER.tube / 2, -0.004);
    passes.push(mesh);
    if (i === BOILER.passes - 1) continue;
    const next = passLow + (passHigh - passLow) * (i + 1) / (BOILER.passes - 1), side = i % 2 ? pass0 : pass1, turn = flat(COLORS.cold, exchanger);
    millimeters(turn, Math.min(side, side + (i % 2 ? -BOILER.tube : BOILER.tube)), Math.max(side, side + (i % 2 ? -BOILER.tube : BOILER.tube)), y - BOILER.tube / 2, next + BOILER.tube / 2, -0.004);
    passes.push(turn);
  }

  // The fan and the flue.
  const fanPart = part('fan', 'Fan and flue', `The fan that pulls the burner’s gases through the exchanger and drives them out of the ${fixed(VOGUE.flueDiameter, 0)} mm flue the sheet gives. The flue is a pipe within a pipe: the gases leave up the middle and the air for the burner comes down around them.`, BOILER.origin, system);
  const [fanX, fanY, fanR] = BOILER.fan;
  const fanRing = lineObject(33, COLORS.chart, fanPart);
  fillLine(fanRing, circlePoints(fanX, fanY, fanR, 33, -0.004));
  const rotor = new THREE.Group();
  rotor.position.set(fanX * MM, fanY * MM, -0.003);
  fanPart.add(rotor);
  const blades = segmentLines(BOILER.blades, COLORS.chart, rotor);
  fillLine(blades, Array.from({length: BOILER.blades}, (_, i) => { const a = 2 * Math.PI * i / BOILER.blades; return [[0, 0, 0], [fanR * 0.86 * Math.cos(a) * MM, fanR * 0.86 * Math.sin(a) * MM, 0]]; }).flat());
  const [flueLow, flueHigh, flueOuter, flueInner] = BOILER.flue;
  const flueWalls = segmentLines(4, COLORS.metal, fanPart);
  fillLine(flueWalls, [[-flueOuter, flueLow, -flueOuter, flueHigh], [flueOuter, flueLow, flueOuter, flueHigh], [-flueInner, flueLow, -flueInner, flueHigh], [flueInner, flueLow, flueInner, flueHigh]]
    .flatMap(([x0, y0, x1, y1]) => [[x0 * MM, y0 * MM, -0.004], [x1 * MM, y1 * MM, -0.004]]));
  const flueArrow = solidArrow(kit, COLORS.flue, fanPart, 0.006), airArrow = solidArrow(kit, COLORS.cold, fanPart, 0.006);
  flueArrow.position.set(0, flueLow * MM + 0.02, -0.002);
  flueArrow.userData.setDirection(new THREE.Vector3(0, 1, 0));
  airArrow.position.set((flueOuter + flueInner) / 2 * MM, flueHigh * MM - 0.02, -0.002);
  airArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));

  // The gas valve and its supply pipe.
  const valve = part('valve', 'Gas valve and supply pipe', `The valve the control opens to let gas to the burner, on the supply pipe at the sheet’s ${fixed(VOGUE.supply, 0)} mbar. It opens only once the turbine says water is running and the fan has cleared the chamber, and it shuts the moment the flame is not sensed.`, BOILER.origin, system);
  const [valve0, valve1, valveLow, valveHigh] = BOILER.valve;
  const valveBody = flat(COLORS.gas, valve);
  millimeters(valveBody, valve0, valve1, valveLow, valveHigh, -0.004);
  const gate = flat(COLORS.shell, valve);
  const gasPipe = flat(COLORS.gas, valve);
  millimeters(gasPipe, BOILER.gasPipe - 7, BOILER.gasPipe + 7, -halfH, valveLow, -0.005);
  const gasLine = segmentLines(2, COLORS.gas, valve);

  // The water: in cold past the turbine, out hot to the tap.
  const waterPart = part('water', 'Water pipes and flow turbine', `The cold water comes in at the bottom, turns the flow turbine, and runs up to the exchanger; the hot water leaves at the other side. The turbine spins in proportion to the flow, and the sheet says the boiler fires only from ${fixed(VOGUE.minDraw, 0)} L/min up.`, BOILER.origin, system);
  const coldPipe = flat(COLORS.cold, waterPart), hotPipe = flat(COLORS.cold, waterPart), coldFeed = flat(COLORS.cold, waterPart), hotFeed = flat(COLORS.cold, waterPart);
  millimeters(coldPipe, BOILER.coldPipe - 7, BOILER.coldPipe + 7, -halfH, passLow, -0.005);
  millimeters(coldFeed, BOILER.coldPipe, pass0, passLow - 7, passLow + 7, -0.005);
  millimeters(hotPipe, BOILER.hotPipe - 7, BOILER.hotPipe + 7, -halfH, passHigh, -0.005);
  millimeters(hotFeed, pass1, BOILER.hotPipe, passHigh - 7, passHigh + 7, -0.005);
  const [turbineX, turbineY, turbineR] = BOILER.turbine;
  const turbineRing = lineObject(25, COLORS.chart, waterPart);
  fillLine(turbineRing, circlePoints(turbineX, turbineY, turbineR, 25, -0.003));
  const turbine = new THREE.Group();
  turbine.position.set(turbineX * MM, turbineY * MM, -0.002);
  waterPart.add(turbine);
  const vanes = segmentLines(4, COLORS.chart, turbine);
  fillLine(vanes, Array.from({length: 4}, (_, i) => { const a = Math.PI * i / 4; return [[-turbineR * 0.8 * Math.cos(a) * MM, -turbineR * 0.8 * Math.sin(a) * MM, 0], [turbineR * 0.8 * Math.cos(a) * MM, turbineR * 0.8 * Math.sin(a) * MM, 0]]; }).flat());

  // The control and its knob.
  const controlPart = part('control', 'Control and its knob', `The control that watches the turbine and the outlet temperature and sets how hard the burner fires. Its knob asks for a hot water temperature, and the sheet limits that to ${fixed(VOGUE.maxTemp, 0)} °C. The pointer turns with your setting.`, BOILER.origin, system);
  const [control0, control1, controlLow, controlHigh] = BOILER.control;
  const controlBox = flat(COLORS.board, controlPart);
  millimeters(controlBox, control0, control1, controlLow, controlHigh, -0.004);
  const [knobX, knobY, knobR] = BOILER.knob;
  const knobRing = lineObject(33, COLORS.casing, controlPart);
  fillLine(knobRing, circlePoints(knobX, knobY, knobR, 33, -0.003));
  const pointer = segmentLines(1, COLORS.casing, controlPart);

  // What goes up the flue.
  const fluePart = part('flue-gas', 'What goes up the flue', `Every ${fixed(1, 0)} m³ of the flue’s gas, by volume, with the steam that the flame makes marked out, and beneath it the temperature scale: where the gas leaves at the sheet’s ${fixed(VOGUE.flueTemp, 0)} °C, and the dew point, the temperature the steam would start condensing at. Not to scale.`, FLUEVIEW.origin, system);
  const bars = GASES.map(name => flat(COLORS[name], fluePart));
  const barFrame = lineObject(5, COLORS.chart, fluePart);
  outline(barFrame, 0, FLUEVIEW.bar[0], 0, FLUEVIEW.bar[1], 0.002, 1);
  const [axisDrop, axisWidth, axisTick] = FLUEVIEW.axis;
  const axis = segmentLines(1, COLORS.chart, fluePart);
  fillLine(axis, [[0, -axisDrop, 0], [axisWidth, -axisDrop, 0]]);
  const axisTicks = segmentLines(8, COLORS.faint, fluePart);
  fillLine(axisTicks, Array.from({length: 8}, (_, i) => { const x = scaleX(FLUEVIEW.scale[0] + (i + 1) * 10); return [[x, -axisDrop, 0], [x, -axisDrop - axisTick / 2, 0]]; }).flat());
  const dewMark = segmentLines(1, COLORS.dew, fluePart), flueMark = segmentLines(1, COLORS.flue, fluePart);

  // The pipe to the tap.
  const pipePart = part('pipe', 'Pipe to the tap', `The ${fixed(VOGUE.connection, 0)} mm copper pipe from the boiler to the tap, drawn ${fixed(timesSmaller(), 0)} times smaller than the boiler: its water keeps the color of its temperature, so you can watch the hot water push the cold out of it. The tap pours what reaches its end.`, PIPEVIEW.origin, system);
  const pieces = Array.from({length: PIPEVIEW.pieces}, () => flat(COLORS.cold, pipePart));
  const [tapWide, tapTall, tapLip] = PIPEVIEW.tap;
  const tapBody = flat(COLORS.metal, pipePart), tapSpout = flat(COLORS.metal, pipePart), stream = flat(COLORS.cold, pipePart);
  const leaders = segmentLines(2, COLORS.faint, system);

  // The temperatures through the run.
  const chartPart = part('chart', 'Temperatures through the run', `What the water leaving the boiler reads (the red curve) and what the tap reads (the blue one) from the moment the tap opens, from ${fixed(CHART.range[0], 0)} to ${fixed(CHART.range[1], 0)} °C, with a tick every ${fixed(CHART.tickEvery, 0)} s. The violet line is your setting and the faint one the water coming in; the first mark is the flame lighting and the second the tap coming up to temperature.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, CHART.z, 1);
  const setLine = segmentLines(1, COLORS.set, chartPart), inletLine = segmentLines(1, COLORS.faint, chartPart);
  const ticks = segmentLines(Math.ceil(DECLARED.longest / CHART.tickEvery), COLORS.chart, chartPart);
  const guideTank = lineObject(DECLARED.samples, COLORS.faint, chartPart), guideTap = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const curveTank = lineObject(DECLARED.samples + 1, COLORS.hot, chartPart), curveTap = lineObject(DECLARED.samples + 1, COLORS.cold, chartPart);
  const litMark = segmentLines(1, COLORS.flame, chartPart), hotMark = segmentLines(1, COLORS.chart, chartPart), cursor = segmentLines(2, COLORS.chart, chartPart);

  const d = BOILER_DEFAULTS, [flowDomain, setDomain, inletDomain, pipeDomain] = ['flow', 'set', 'inlet', 'pipe'].map(key => BOILER_DOMAINS[key]);
  control('flow', 'Tap flow', ...flowDomain, d.flow, 'L/min', `How much water the hot tap draws. The sheet rates this boiler at ${fixed(VOGUE.flow, 1)} L/min at a ${fixed(VOGUE.rise, 0)} °C rise and says it runs down to ${fixed(VOGUE.minDraw, 0)} L/min.`);
  control('set', 'Hot water setting', ...setDomain, d.set, '°C', `What the hot water knob asks for. The sheet limits it to ${fixed(VOGUE.maxTemp, 0)} °C.`);
  control('inlet', 'Mains temperature', ...inletDomain, d.inlet, '°C', 'How warm the cold water coming into the boiler is.');
  control('pipe', 'Pipe to the tap', ...pipeDomain, d.pipe, 'm', `How far the tap is from the boiler, in ${fixed(VOGUE.connection, 0)} mm copper pipe.`);

  const result = finish(v => {
    const plan = boilerPlan(v), now = boilerAt(plan, clock), values = plan.values;

    // The burner's flames, tall in proportion to the firing.
    const lit = now.lit, share = lit ? plan.share : 0;
    const positions = flames.geometry.attributes.position.array, cores0 = cores.geometry.attributes.position.array;
    const [flameWide, flameTall] = BOILER.flame, spacing = (burner1 - burner0) / BOILER.flames;
    for (let i = 0; i < BOILER.flames; i++) {
      const x = burner0 + spacing * (i + 0.5), wobble = lit ? 1 + 0.08 * Math.sin(clock * 6 + i) : 0, height = flameTall * share * wobble;
      positions.set([(x - flameWide) * MM, burnerHigh * MM, -0.0035, (x + flameWide) * MM, burnerHigh * MM, -0.0035, x * MM, (burnerHigh + height) * MM, -0.0035], i * 9);
      cores0.set([(x - flameWide * 0.45) * MM, burnerHigh * MM, -0.003, (x + flameWide * 0.45) * MM, burnerHigh * MM, -0.003, x * MM, (burnerHigh + height * 0.42) * MM, -0.003], i * 9);
    }
    for (const geometry of [flames.geometry, cores.geometry]) {
      geometry.attributes.position.needsUpdate = true;
      geometry.boundingBox = null;
      geometry.boundingSphere = null;
    }
    flames.visible = cores.visible = share > 0;
    spark.visible = now.sparking;

    // The valve's gate, open while the burner fires, and the gas on its way to the burner.
    const open = lit || now.sparking;
    rect(gate, (valve1 - BOILER.gate / 2) * MM, (valve1 + BOILER.gate / 2) * MM, (open ? valveHigh : valveLow) * MM, ((open ? valveHigh : valveLow) + BOILER.gate) * MM, -0.003);
    gasLine.visible = open;
    if (open) fillLine(gasLine, [[valve1 * MM, (valveLow + valveHigh) / 2 * MM, -0.004], [burner0 * MM, (valveLow + valveHigh) / 2 * MM, -0.004], [burner0 * MM, (valveLow + valveHigh) / 2 * MM, -0.004], [burner0 * MM, burnerLow * MM, -0.004]]);

    // The water: the exchanger at the temperature of the water leaving it, the pipes at theirs.
    const tankColor = heatColor(now.tank);
    for (const pass of passes) pass.material.color.copy(tankColor);
    for (const mesh of [coldPipe, coldFeed]) mesh.material.color.copy(heatColor(values.inlet));
    for (const mesh of [hotPipe, hotFeed]) mesh.material.color.copy(tankColor);
    turbine.rotation.z = now.open ? -clock * values.flow / 3 : 0;
    rotor.rotation.z = now.open && plan.firing ? clock * (2 + 3 * share) : 0;
    flueArrow.userData.setLength(lit ? 0.05 + 0.05 * share : 0);
    airArrow.userData.setLength(lit ? 0.05 + 0.05 * share : 0);

    // The knob's pointer, turned to the setting.
    const turn = Math.PI * 1.25 - 1.5 * Math.PI * (values.set - setDomain[0]) / (setDomain[1] - setDomain[0]);
    fillLine(pointer, [[knobX * MM, knobY * MM, -0.002], [(knobX + knobR * 0.86 * Math.cos(turn)) * MM, (knobY + knobR * 0.86 * Math.sin(turn)) * MM, -0.002]]);

    // What goes up the flue: the gases by volume, and the two temperatures.
    let left = 0;
    GASES.forEach((name, i) => {
      const width = plan.flue.shares[name] * FLUEVIEW.bar[0];
      rect(bars[i], left, Math.max(left, left + width - FLUEVIEW.gap), 0, FLUEVIEW.bar[1], 0.001);
      left += width;
    });
    fillLine(dewMark, [[scaleX(plan.flue.dew), -axisDrop + axisTick, 0], [scaleX(plan.flue.dew), -axisDrop - axisTick, 0]]);
    fillLine(flueMark, [[scaleX(VOGUE.flueTemp), -axisDrop + axisTick, 0], [scaleX(VOGUE.flueTemp), -axisDrop - axisTick, 0]]);

    // The pipe to the tap, each piece at the temperature of the water in it.
    const length = values.pipe * METER;
    pieces.forEach((piece, i) => {
      const from = length * i / PIPEVIEW.pieces, to = length * (i + 1) / PIPEVIEW.pieces;
      piece.visible = values.pipe > 0;
      rect(piece, from, to, -PIPEVIEW.thickness / 2, PIPEVIEW.thickness / 2, 0);
      const back = plan.delay === null ? 0 : plan.delay * (i + 0.5) / PIPEVIEW.pieces;
      piece.material.color.copy(heatColor(now.open ? tankAt(plan, now.t - back) : values.inlet));
    });
    rect(tapBody, length, length + tapWide, -PIPEVIEW.thickness / 2, tapTall, 0.001);
    rect(tapSpout, length, length + tapWide + tapLip, -PIPEVIEW.thickness / 2 - 0.02, -PIPEVIEW.thickness / 2, 0.001);
    const [streamWide, streamTall] = PIPEVIEW.stream;
    stream.visible = now.open && plan.drawing;
    rect(stream, length + tapWide + tapLip - streamWide, length + tapWide + tapLip, -PIPEVIEW.thickness / 2 - 0.02 - streamTall, -PIPEVIEW.thickness / 2 - 0.02, 0.001);
    if (now.tap !== null) stream.material.color.copy(heatColor(now.tap));

    // The chart.
    fillLine(setLine, [[CHART.x, chartY(values.set), CHART.z], [CHART.x + CHART.w, chartY(values.set), CHART.z]]);
    fillLine(inletLine, [[CHART.x, chartY(values.inlet), CHART.z], [CHART.x + CHART.w, chartY(values.inlet), CHART.z]]);
    const tickCount = Math.round(plan.duration / CHART.tickEvery) - 1;
    fillLine(ticks, Array.from({length: tickCount}, (_, i) => { const x = chartX(plan, (i + 1) * CHART.tickEvery); return [[x, CHART.y, CHART.z], [x, CHART.y - CHART.tick, CHART.z]]; }).flat());
    fillLine(guideTank, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.tank), CHART.z]));
    fillLine(guideTap, plan.drawing ? plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.tap), CHART.z]) : []);
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    fillLine(curveTank, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.tank), CHART.z]), [chartX(plan, now.t), chartY(now.tank), CHART.z]] : []);
    fillLine(curveTap, clock > 0 && plan.drawing ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.tap), CHART.z]), [chartX(plan, now.t), chartY(now.tap), CHART.z]] : []);
    litMark.visible = plan.firing;
    if (plan.firing) fillLine(litMark, [[chartX(plan, plan.litAt), CHART.y, CHART.z], [chartX(plan, plan.litAt), CHART.y + CHART.mark, CHART.z]]);
    hotMark.visible = plan.reaches;
    if (plan.reaches) fillLine(hotMark, [[chartX(plan, plan.hotAt), CHART.y, CHART.z], [chartX(plan, plan.hotAt), CHART.y + CHART.mark, CHART.z]]);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor), mark = celsius => [[cx - CHART.cursor, chartY(celsius), CHART.z], [cx + CHART.cursor, chartY(celsius), CHART.z]];
    fillLine(cursor, clock > 0 ? [...mark(now.tank), ...mark(now.tap === null ? now.tank : now.tap)] : []);

    // Leaders from the boiler to the flue panel and to the pipe.
    fillLine(leaders, [
      [BOILER.origin[0], (flueHigh + 10) * MM, 0], [FLUEVIEW.origin[0], FLUEVIEW.origin[1] + FLUEVIEW.bar[1] / 2, 0],
      [BOILER.origin[0] + BOILER.hotPipe * MM, BOILER.origin[1] - (halfH + 10) * MM, 0], [PIPEVIEW.origin[0], PIPEVIEW.origin[1] + PIPEVIEW.thickness, 0],
    ]);

    // Readings.
    const t0 = fixed(plan.values.flow, 1), status = !plan.drawing ? 'Ready · the tap is closed; open it with the flow control, then press Play'
      : clock <= 0 ? (plan.firing
        ? `Ready · at ${t0} L/min the burner will settle at ${fixed(plan.power, 1)} kW and the tap will run at ${fixed(plan.outlet, 1)} °C; press Play to open the tap`
        : `Ready · ${t0} L/min is below the ${fixed(VOGUE.minDraw, 0)} L/min this boiler fires at, so the tap will run cold; press Play to open it`)
      : !plan.firing ? `Cold · the turbine sees only ${t0} L/min, so the burner never lights`
      : now.purging ? 'Purging · the fan clears the chamber before the gas valve opens'
      : now.sparking ? 'Sparking · the gas valve is open and the spark is running'
      : now.hot ? `Hot · the tap reads ${fixed(now.tap, 1)} °C, ${fixed(plan.hotAt, 0)} s after it opened`
      : `Burning · the burner holds ${fixed(plan.power, 1)} kW, and the tap reads ${fixed(now.tap, 1)} °C`;
    const held = plan.held === 'short' ? `The tap asks for ${fixed(plan.need, 1)} kW, more than the ${fixed(VOGUE.output, 1)} kW this boiler has, so the water leaves ${fixed(plan.values.set - plan.outlet, 1)} °C short of your setting.`
      : plan.held === 'lowest' ? `The tap asks for only ${fixed(plan.need, 1)} kW, less than the ${fixed(DECLARED.minFiring, 1)} kW the burner turns down to, so the water leaves ${fixed(plan.outlet - plan.values.set, 1)} °C above your setting.`
      : `The tap asks for ${fixed(plan.need === null ? 0 : plan.need, 1)} kW, inside the burner’s range, so the control holds the water at your setting.`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Tap', !plan.drawing ? 'closed' : `${fixed(plan.firing ? plan.outlet : plan.values.inlet, 1)} °C at ${t0} L/min`,
          !plan.drawing ? 'With the tap closed nothing runs through the turbine, so the control keeps the gas valve shut.'
            : plan.firing ? `Heat carried away is the flow times water’s heat capacity times the rise: ${t0} L/min of water at ${fixed(WATER.density, 0)} kg/L and ${fixed(WATER.cp, 0)} J/(kg·K), raised ${fixed(plan.rise, 1)} °C, carries ${fixed(plan.power, 1)} kW. ${held}`
            : `The sheet says the boiler runs down to ${fixed(VOGUE.minDraw, 0)} L/min of hot water; below that the control leaves the burner off and the tap runs at the mains temperature.`),
        r('Water in the boiler', `${fixed(now.tank, 1)} °C`, `The boiler holds the sheet’s ${fixed(VOGUE.content, 1)} L of hot water. ${plan.firing ? `At ${t0} L/min that water is replaced every ${fixed(plan.tau, 1)} s, so after the flame lights the temperature closes on ${fixed(plan.outlet, 1)} °C by that much each time.` : 'With the burner off it stays at the temperature of the water coming in.'}`),
        r('Burner', plan.firing ? `${fixed(plan.power, 1)} kW` : 'off', `This boiler modulates from ${fixed(DECLARED.minFiring, 1)} kW to the sheet’s ${fixed(VOGUE.output, 1)} kW of hot water output, a turndown of ${fixed(VOGUE.output / DECLARED.minFiring, 1)} to 1. ${held}`),
        r('Gas', plan.firing ? `${fixed(plan.gas, 2)} m³/h` : 'none', `Gross input is the output over ${fixed(100 * EFFICIENCY, 1)}%, the sheet’s ${fixed(VOGUE.output, 1)} kW out of ${fixed(VOGUE.inputGross, 1)} kW in. ${plan.firing ? `Here that is ${fixed(plan.gross, 1)} kW, and at the sheet’s gross calorific value of ${fixed(VOGUE.cvGross, 1)} MJ/m³ it burns ${fixed(plan.gas, 2)} m³/h; the sheet gives ${fixed(VOGUE.gasRate, 3)} m³/h at full output.` : 'With the burner off the valve passes no gas at all.'}`),
        r('Flue gas', plan.firing ? `${fixed(plan.flue.mass, 1)} g/s at ${fixed(VOGUE.flueTemp, 0)} °C` : 'none', `Burning ${fixed(AIR_MASS, 1)} kg of air for each kilogram of methane would use it all up; the sheet’s ${fixed(VOGUE.flueMass, 0)} g/s of flue gas at full output means ${fixed(100 * (LAMBDA - 1), 0)}% more air than that, which the model keeps at every firing rate. ${plan.firing ? `At ${fixed(plan.power, 1)} kW the burner takes ${fixed(plan.flue.fuel, 2)} g/s of gas and ${fixed(plan.flue.air, 1)} g/s of air.` : ''}`),
        r('Steam', `${fixed(100 * plan.flue.shares.water, 1)}% of the flue gas`, `Every molecule of methane makes two of water, so steam is ${fixed(100 * plan.flue.shares.water, 1)}% of the flue gas by volume, a partial pressure of ${fixed(plan.flue.partial / 10, 1)} kPa of the ${fixed(AIR.standard, 1)} kPa around it. The Arden Buck equation puts the dew point of that at ${fixed(plan.flue.dew, 0)} °C, and the sheet’s flue runs at ${fixed(VOGUE.flueTemp, 0)} °C, ${fixed(VOGUE.flueTemp - plan.flue.dew, 0)} °C above it, so in this model the steam stays steam.`),
        r('Where the heat goes', `${fixed(100 * EFFICIENCY, 1)}% to the water`, `Of the sheet’s ${fixed(VOGUE.inputGross, 1)} kW gross at full output, ${fixed(VOGUE.output, 1)} kW reaches the water, ${fixed(FULL.latent, 2)} kW leaves as steam that never gives up its heat, and ${fixed(FULL.sensible, 2)} kW leaves as warm gas; together ${fixed(VOGUE.output + FULL.latent + FULL.sensible, 1)} kW against the ${fixed(VOGUE.inputGross, 1)} kW going in, which is as close as these sheet numbers come to each other.`),
        r('Waiting', plan.hotAt === null ? 'the tap stays cold' : plan.reaches ? `hot after ${fixed(plan.hotAt, 0)} s` : `not hot within ${fixed(plan.duration, 0)} s`, plan.firing
          ? `The fan purges for ${fixed(DECLARED.purge, 0)} s and the spark runs for ${fixed(DECLARED.spark, 0)} s, so the flame lights ${fixed(plan.litAt, 0)} s in. The boiler’s ${fixed(VOGUE.content, 1)} L then warms with ${fixed(plan.tau, 1)} s to spare each time, and the ${fixed(plan.pipeVolume, 2)} L in the pipe takes another ${fixed(plan.delay, 1)} s to push out.`
          : 'Nothing lights, so nothing warms up.'),
        r('Pipe', `${fixed(plan.values.pipe, 1)} m holds ${fixed(plan.pipeVolume, 2)} L`, `A ${fixed(VOGUE.connection, 0)} mm copper pipe with a bore of ${fixed(DECLARED.bore, 1)} mm holds ${fixed(1000 * Math.PI / 4 * (DECLARED.bore / 1000) ** 2, 2)} L for each meter. ${plan.drawing ? `At ${t0} L/min the water in it takes ${fixed(plan.delay, 1)} s to reach the tap, and until it does the tap pours what was already standing there.` : 'With the tap closed that water stands still and cools, which is why the first water from a tap is never hot.'}`),
        r('Sped up', `${DECLARED.faster} times faster`, `The run plays ${DECLARED.faster} times faster than the real thing: this one takes ${fixed(plan.duration, 0)} s and plays in ${fixed(plan.duration / DECLARED.faster, 0)} s. The boiler is drawn at true size and the pipe to the tap ${fixed(timesSmaller(), 0)} times smaller.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * DECLARED.faster); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the burner', part: 'burner', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the heat exchanger', part: 'exchanger', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: what goes up the flue', part: 'flue-gas', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the pipe to the tap', part: 'pipe', view: 'front', replay: false, run() { return inspect(duration() / 2); }},
    {label: 'Inspect: the whole boiler', part: 'boiler', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Open the hot tap',
    description: `The hot tap opens and stays open. The run plays ${DECLARED.faster} times faster than the real thing.`,
    stepLabel: `Advance ${DECLARED.faster} s`,
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => clock >= duration(),
    blocked: () => result.getState().values.flow === 0,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the temperatures', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.06, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, shell, board, caseLine, chamberFace, chamberLine, burner, burnerBar, flames, cores, electrodes, spark, exchanger, passes, fanPart, fanRing, rotor, blades, flueWalls, flueArrow, airArrow, valve, valveBody, gate, gasPipe, gasLine, waterPart, coldPipe, coldFeed, hotPipe, hotFeed, turbineRing, turbine, vanes, controlPart, controlBox, knobRing, pointer, fluePart, bars, barFrame, axis, axisTicks, dewMark, flueMark, pipePart, pieces, tapBody, tapSpout, stream, leaders, chartPart, chartFrame, setLine, inletLine, ticks, guideTank, guideTap, curveTank, curveTap, litMark, hotMark, cursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

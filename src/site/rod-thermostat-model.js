import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, solidArrow, textLabel} from './scene-kit.js';
import {rodPlan, rodAt, ROD_DEFAULTS, ROD_DOMAINS, BYPASSES, DECLARED} from './thermostat-physics.js';

export const MM = 0.0058;
export const MOVE_TIMES = 100;
export const ROD = Object.freeze({origin: Object.freeze([-0.83, 0.24, 0]), root: 70, length: 200, axisY: 20, springRoot: -58, tubeRadius: 9, rodRadius: 3});
export const CHART = Object.freeze({x: -1.36, y: -1.12, w: 2.88, h: 0.38, temperature: Object.freeze([0, 320])});
export const COLORS = Object.freeze({body: 0xe1ddd0, edge: 0x374736, brass: 0xe3b45e, steel: 0x9baeb2, gas: 0x588caf, flame: 0xd8783f, flow: 0xa5e5e5, valve: 0xb65e49, set: 0x826596, cool: 0x9cc2cd});
export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + celsius / 320 * CHART.h;

export function createRodThermostatModel() {
  const kit = houseModel('Rod thermostat'), {part, box, cylinder, sphere, tube, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const point = (x, y, z = 0) => [x * MM, y * MM, z * MM];
  const mesh = (geometry, color, parent) => { const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color, roughness: 0.55, side: THREE.DoubleSide})); parent.add(object); return object; };
  const label = (parent, text, position, width = 1, height = 0.085) => textLabel(parent, text, {height, width, position: point(...position)});
  const axial = (radius, length, position, color, parent) => { const object = cylinder(radius * MM, length * MM, point(...position), color, parent); object.rotation.z = -Math.PI / 2; return object; };
  const shell = (radius, parent, color) => { const object = mesh(new THREE.CylinderGeometry(radius * MM, radius * MM, MM, 40, 1, true, Math.PI / 2, Math.PI), color, parent); object.rotation.z = -Math.PI / 2; return object; };
  const ring = (outer, inner, length, x, parent, color) => {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer * MM, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner * MM, 0, Math.PI * 2, true); shape.holes.push(hole);
    const object = mesh(new THREE.ExtrudeGeometry(shape, {depth: length * MM, bevelEnabled: false, steps: 1, curveSegments: 32}), color, parent);
    object.rotation.y = Math.PI / 2; object.position.set(...point(x, ROD.axisY)); return object;
  };
  const system = part('system', 'Thermostat and oven', 'A brass tube and steel rod sense oven temperature. Their unequal expansion changes a spring-loaded gas valve. The connected burner heats the oven. Thermal extensions and valve travel are enlarged 100 times. Press Play to open the gas cock and attempt ignition.', ROD.origin);
  const body = part('body', 'Valve housing and tube support', 'The cutaway housing holds a fixed valve seat and the left end of the brass tube. The tube enters the oven; its far cap carries the steel rod. The front halves of the housing and tube are removed for inspection.', [0, 0, 0], system);
  const housing = shell(25, body, COLORS.body); housing.scale.y = 129; housing.position.set(...point(0.5, ROD.axisY));
  const backPlate = box(point(138, 60, 4), point(0, ROD.axisY, -27), COLORS.body, body);
  const collar = ring(13, 9, 8, 66, body, COLORS.edge);
  const supplyEnd = axial(25, 4, [-66, ROD.axisY], COLORS.body, body);

  const sensor = part('tube', 'Brass sensing tube', 'The brass tube is fixed at the valve housing and joined to the steel rod at its far cap. Both metals warm together here. Brass expands more, moving the shared far end away from the valve. Only thermal changes are enlarged 100 times.', [0, 0, 0], system);
  const tubeOuter = shell(9, sensor, COLORS.brass), tubeInner = shell(7.5, sensor, COLORS.brass);
  const tubeEdges = [-8.25, 8.25].map(y => box(point(1, 1.5, 1.5), point(0, ROD.axisY + y), COLORS.brass, sensor));
  const tubeCap = axial(9, 3, [270, ROD.axisY], COLORS.brass, sensor);
  label(sensor, 'Brass / steel', [240, 64, 14], 1.0);
  label(sensor, 'Thermal motion ×100', [240, 84, 14], 1.15, 0.068);

  const rodPart = part('rod', 'Steel rod and far-end joint', 'The steel rod expands too. Its right end stays joined to the brass cap. Because the tube grows more, the free left end retreats from the valve as temperature rises. Cooling brings it back to push the valve open.', [0, 0, 0], system);
  const rodBar = axial(3, 1, [170, ROD.axisY], COLORS.steel, rodPart);
  const joint = sphere(4.5 * MM, point(270, ROD.axisY), COLORS.steel, rodPart);

  const valve = part('valve', 'Poppet valve and closing spring', 'The steel rod pushes the adjustable stem and lifts the poppet away from its seat. As the rod retreats, the compressed spring moves the poppet toward the seat. Once seated, a gap can open between rod and stem. Gas passes through the annular opening, not through the solid poppet.', [0, 0, 0], system);
  const seat = ring(20, 6, 3, 0, valve, COLORS.edge);
  const poppet = axial(9, 3, [-1.5, ROD.axisY], COLORS.valve, valve);
  const stem = axial(2.2, 45, [22.5, ROD.axisY], COLORS.steel, valve);
  const springGroup = new THREE.Group(); springGroup.position.set(...point(ROD.springRoot, ROD.axisY)); springGroup.rotation.z = -Math.PI / 2; valve.add(springGroup);
  const spring = kit.spring([0, 0, 0], 10 * MM, 55 * MM, 6, springGroup, 0.9 * MM);
  const valveWord = label(valve, '', [0, 63, 10], 0.92);

  const dial = part('dial', 'Threaded setting adjustment', 'The thumbwheel turns an adjustable extension on the poppet stem. A longer extension holds the valve open until the rod has retreated farther, giving a hotter setting. The illustrative dial is calibrated with a bypass at 20 mbar. Changing any control starts a new trial.', [0, 0, 0], system);
  const extension = axial(2.7, 1, [60, ROD.axisY], COLORS.steel, dial);
  const adjuster = new THREE.Group(); dial.add(adjuster);
  const knob = axial(12, 5, [0, 0], COLORS.edge, adjuster);
  const knobMark = box(point(5.3, 3, 3), point(0, 8, 7), COLORS.brass, adjuster);
  const thread = lineObject(257, COLORS.edge, dial);
  const settingWord = label(dial, '', [0, 91, 14], 0.97);

  const bypass = part('bypass', 'Separate gas bypass', 'This small fixed passage connects the upstream and downstream sides of the main valve. With the gas cock open it can supply gas while the poppet is seated. The model assumes a flame can burn this flow; a bypass cannot guarantee ignition or replace flame-failure protection.', [0, 0, 0], system);
  const bypassPoints = [[-40, 20, 8], [-40, -27, 8], [35, -27, 8], [35, 20, 8]].map(p => point(...p));
  const bypassPipe = tube(bypassPoints, 2.8 * MM, COLORS.gas, bypass);
  const bypassMarks = Array.from({length: 3}, () => sphere(3.2 * MM, [0, 0, 0], COLORS.flow, bypass));
  const bypassPath = new THREE.CatmullRomCurve3(bypassPoints.map(p => new THREE.Vector3(...p)));
  const bypassWord = label(bypass, '', [-3, -44, 13], 0.9, 0.07);

  const oven = part('oven', 'Oven and thermometer', 'The sensing tube and burner share this cutaway oven. One uniform temperature represents the oven and its thermal contents. Effective heat capacity is 12 kJ/K and heat loss is 5 W/K to a 20 °C kitchen. The thermometer and wall color show the calculated temperature.', [0, 0, 0], system);
  const floor = box(point(344, 6, 148), point(242, -140, 0), COLORS.body, oven);
  const ovenBack = box(point(344, 250, 6), point(242, -15, -74), COLORS.body, oven);
  const leftWall = [[70, -72, 6, 132], [70, 71, 6, 78]].map(([x, y, w, h]) => box(point(w, h, 26), point(x, y, -61), COLORS.body, oven));
  const rim = [-71, 71].map(z => box(point(6, 250, 6), point(414, -15, z), COLORS.body, oven));
  const ovenTint = mesh(new THREE.PlaneGeometry(325 * MM, 233 * MM), COLORS.cool, oven); ovenTint.position.set(...point(242, -15, -70.5));
  const thermometer = new THREE.Group(); thermometer.position.set(...point(380, -96, 47)); oven.add(thermometer);
  const thermometerTrack = cylinder(3.8 * MM, 145 * MM, point(0, 72.5), COLORS.body, thermometer);
  const thermometerBulb = sphere(6 * MM, [0, 0, 0], COLORS.valve, thermometer);
  const thermometerFluid = cylinder(2.5 * MM, 1, point(0, 0, 4), COLORS.valve, thermometer);
  const ovenWord = label(oven, '', [268, 114, 35], 1.3, 0.1);

  const burner = part('burner', 'Gas burner', 'The connected burner converts burning methane into oven heat. Its flames and heat arrows appear only after successful ignition. A single ignition attempt happens when playback starts. If no gas is then available, later gas stays unlit in this teaching model.', [0, 0, 0], oven);
  const burnerBar = axial(5, 178, [245, -109, 15], COLORS.edge, burner);
  const supports = [166, 324].map(x => box(point(10, 23, 20), point(x, -127, 15), COLORS.edge, burner));
  const flames = new THREE.Group(); burner.add(flames);
  const flameMeshes = Array.from({length: 9}, (_, i) => { const flame = mesh(new THREE.ConeGeometry(4.2 * MM, MM, 12), COLORS.flame, flames); flame.position.set(...point(167 + i * 19.5, -103, 15)); return flame; });
  const heatArrows = [210, 279].map(x => { const arrow = solidArrow(kit, COLORS.flame, burner, 0.008); arrow.position.set(...point(x, -48, 15)); return arrow; });
  const burnerWord = label(burner, '', [245, -125, 50], 1.4, 0.08);

  const circuit = part('circuit', 'Gas cock and connected pipes', 'The upstream gas cock is shut before playback. Play opens it and makes one ignition attempt. Gas then follows the main seat and, if fitted, the separate bypass to the burner. Moving blue markers show gas flow, not burning or heat. Real flame-failure shutoff hardware is omitted.', [0, 0, 0], system);
  const inletPoints = [[-94, -114, 0], [-94, 20, 0], [-66, 20, 0]].map(p => point(...p));
  const outletPoints = [[35, 20, -6], [35, -76, -6], [150, -76, 15], [150, -109, 15], [160, -109, 15]].map(p => point(...p));
  const inlet = tube(inletPoints, 4 * MM, COLORS.gas, circuit), outlet = tube(outletPoints, 4 * MM, COLORS.gas, circuit);
  const cock = sphere(8 * MM, point(-94, -65), COLORS.edge, circuit);
  const cockHandle = box(point(4, 25, 4), point(-94, -65, 10), COLORS.valve, circuit);
  const cockWord = label(circuit, '', [-48, -115, 18], 1.02, 0.078);
  const gasPath = new THREE.CatmullRomCurve3(outletPoints.map(p => new THREE.Vector3(...p)));
  const gasMarks = Array.from({length: 5}, () => sphere(4.3 * MM, [0, 0, 0], COLORS.flow, circuit));
  const mainFlowLine = lineObject(6, COLORS.gas, circuit);
  const mainFlowMarks = Array.from({length: 3}, () => sphere(1.2 * MM, [0, 0, 0], COLORS.flow, circuit));

  const chart = part('chart', 'Elapsed oven temperature', 'Only observed oven temperature is drawn across the 40-minute run. The violet line marks the selected dial setting. The temperature axis runs from 0 to 320 °C; it does not represent valve opening. The graph and oven use schematic scales.', ROD.origin.map(value => -value), system);
  const chartFrame = lineObject(5, COLORS.edge, chart);
  fillLine(chartFrame, [[CHART.x, CHART.y, 0], [CHART.x + CHART.w, CHART.y, 0], [CHART.x + CHART.w, CHART.y + CHART.h, 0], [CHART.x, CHART.y + CHART.h, 0], [CHART.x, CHART.y, 0]]);
  chartText(chart, (share, temperature) => [CHART.x + share * CHART.w, chartY(temperature), 0], {size: 0.045, x: {min: 0, max: 1, title: 'Elapsed minutes', ticks: [[0, '0'], [0.5, '20'], [1, '40']]}, y: {min: 0, max: 320, ticks: [[0, '0 °C'], [160, '160 °C'], [320, '320 °C']]}});
  const settingLine = lineObject(2, COLORS.set, chart), curve = lineObject(164, COLORS.flame, chart);
  textLabel(chart, 'Oven °C · violet line is dial setting', {height: 0.06, width: 2.05, position: [0.08, CHART.y + CHART.h + 0.075, 0.01]});

  const d = ROD_DEFAULTS, D = ROD_DOMAINS;
  control('setting', 'Oven setting', ...D.setting, d.setting, '°C', 'Changes the threaded stem extension. A higher setting needs more thermal retreat before the valve closes. Any changed control resets elapsed time.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'Initial oven, tube and rod temperature. A hot start can hold the main valve completely shut during the ignition attempt.');
  control('supply', 'Gas supply pressure', ...D.supply, d.supply, 'mbar', 'Gauge pressure at the valve inlet. Higher pressure increases flow through the same opening. The dial stays calibrated for 20 mbar, so the final temperature can shift.');
  control('bypass', 'Bypass', ...D.bypass, d.bypass, '', 'Choose the separate fixed gas passage in this model. Compare the two hot-start trials to see whether gas is available at the initial ignition attempt.', BYPASSES);

  const result = finish(values => {
    const plan = rodPlan(values), now = rodAt(plan, clock);
    const show = meters => meters * 1000 * MOVE_TIMES;
    const capX = ROD.root + ROD.length + show(now.brassExpansion), tipX = ROD.root + show(now.differential);
    const tubeLength = capX - ROD.root, rodLength = capX - tipX;
    for (const object of [tubeOuter, tubeInner]) { object.scale.y = tubeLength; object.position.set(...point(ROD.root + tubeLength / 2, ROD.axisY)); }
    for (const edge of tubeEdges) { edge.scale.x = tubeLength; edge.position.x = (ROD.root + tubeLength / 2) * MM; }
    tubeCap.position.x = (capX + 1.5) * MM;
    rodBar.scale.y = rodLength; rodBar.position.x = (capX + tipX) / 2 * MM; joint.position.x = capX * MM;
    const faceX = -show(now.lift), extensionLength = ROD.root + show(plan.dialExtension), contactX = faceX + extensionLength;
    poppet.position.x = (faceX - 1.5) * MM; stem.position.x = (faceX + 22.5) * MM;
    extension.scale.y = extensionLength - 45; extension.position.x = (faceX + (45 + extensionLength) / 2) * MM;
    adjuster.position.set(...point(faceX + 45, ROD.axisY)); adjuster.rotation.x = -(show(plan.dialExtension) / 8) * 2 * Math.PI;
    fillLine(thread, Array.from({length: 257}, (_, i) => { const a = i / 256 * 14 * Math.PI * 2; return point(faceX + 45 + (extensionLength - 45) * i / 256, ROD.axisY + 3.15 * Math.cos(a), 3.15 * Math.sin(a)); }));
    spring.userData.setLength((faceX - 3 - ROD.springRoot) * MM);
    valveWord.userData.setText(now.lift > 1e-12 ? `Open ${fixed(now.lift * 1e6, 0)} µm` : 'Valve seated');
    settingWord.userData.setText(`Dial ${values.setting} °C`);
    bypassPipe.visible = values.bypass === 1;
    bypassWord.userData.setText(values.bypass ? 'Bypass' : 'No bypass');
    bypassMarks.forEach((mark, i) => { mark.visible = now.bypassFlow > 0; bypassPath.getPoint((clock / 110 + i / 3) % 1, mark.position); });
    cockHandle.rotation.z = now.mainOn ? 0 : Math.PI / 2;
    cockWord.userData.setText(now.mainOn ? 'Gas open' : 'Gas shut');
    gasMarks.forEach((mark, i) => { mark.visible = now.flow > 0; gasPath.getPoint((clock / 95 + i / 5) % 1, mark.position); });
    const mainPoints = [[-66, 20, 4], [faceX - 6, 32, 4], [faceX / 2, 32, 4], [faceX / 2, 24, 4], [25, 24, 4], [35, 20, -6]].map(p => point(...p));
    fillLine(mainFlowLine, now.mainFlow > 0 ? mainPoints : []);
    const mainPath = new THREE.CurvePath();
    for (let i = 1; i < mainPoints.length; i++) mainPath.add(new THREE.LineCurve3(new THREE.Vector3(...mainPoints[i - 1]), new THREE.Vector3(...mainPoints[i])));
    mainFlowMarks.forEach((mark, i) => { mark.visible = now.mainFlow > 0; mainPath.getPoint((clock / 60 + i / 3) % 1, mark.position); });
    flames.visible = now.lit;
    const flameHeight = now.lit ? 3 + 43 * Math.sqrt(clamp(now.power / 12500)) : 0;
    for (const flame of flameMeshes) { flame.scale.y = Math.max(1e-6, flameHeight); flame.position.y = (-104 + flameHeight / 2) * MM; }
    for (const arrow of heatArrows) arrow.userData.setLength(now.lit ? (14 + 28 * clamp(now.power / 12500)) * MM : 0);
    burnerWord.userData.setText(now.lit ? `${fixed(now.power, 0)} W · flame lit` : now.mainOn ? now.flow > 0 ? 'Gas · no flame or heat' : 'No gas · no flame' : 'Burner off');
    const share = clamp(now.celsius / 320), fluidHeight = 139 * MM * share;
    thermometerFluid.scale.y = Math.max(1e-6, fluidHeight); thermometerFluid.position.y = fluidHeight / 2;
    ovenTint.material.color.setHex(COLORS.cool).lerp(new THREE.Color(COLORS.flame), share);
    ovenWord.userData.setText(`Oven ${fixed(now.celsius, 1)} °C`);
    fillLine(settingLine, [[CHART.x, chartY(values.setting), 0.002], [CHART.x + CHART.w, chartY(values.setting), 0.002]]);
    const shown = plan.chart.filter(sample => sample.t < now.t);
    fillLine(curve, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0.004]), [chartX(plan, now.t), chartY(now.celsius), 0.004]] : []);
    const outcome = !now.lit ? now.flow > 0 ? 'Gas has returned, but there is no flame to heat the oven' : 'Main valve closed; no gas was available at ignition'
      : Math.abs(now.rate) < 0.002 ? 'Burner heat nearly balances oven heat loss' : now.rate > 0 ? 'Oven warming; rod retreat lets the spring reduce valve lift' : 'Oven cooling; rod approaches the valve to open it farther';
    const status = clock === 0 ? `Ready · oven ${fixed(now.celsius, 1)} °C; gas cock shut. Play opens it and tries ignition once.` : `${now.done ? '40 min complete' : `${fixed(now.t / 60, 1)} min elapsed`} · ${fixed(now.celsius, 1)} °C. ${outcome}.`;
    return {state: {...plan, now, clock, geometry: {capX, tipX, faceX, contactX, tubeLength, rodLength, extensionLength}}, readings: [
      r('Your result', status),
      r('Oven temperature', `${fixed(now.celsius, 2)} °C`, 'One uniform oven and sensor temperature. Heat capacity 12 kJ/K; heat loss 5 W/K to a 20 °C kitchen. This omits sensor lag and hot spots.'),
      r('Main valve lift', `${fixed(now.lift * 1e6, 2)} µm`, `The poppet is seated at and above ${fixed(plan.shutsAt, 2)} °C for this dial setting. Below that point the steel rod pushes it open. The curtain opening has area π × seat diameter × lift.`),
      r('Rod to stem gap', `${fixed(now.gap * 1e6, 2)} µm`, 'Zero while the rod pushes the valve. Once the poppet seats, further rod retreat leaves a gap. The spring supplies the closing force; its load is assumed small enough to neglect metal strain.'),
      r('Thermal expansion', `${fixed(now.brassExpansion * 1000, 3)} / ${fixed(now.steelExpansion * 1000, 3)} mm`, `Brass / steel growth from 20 °C over 200 mm. Their difference is ${fixed(now.differential * 1000, 3)} mm, changing 1.4 µm per degree. Both lengths change in the scene.`),
      r('Gas to burner', `${fixed(now.flow * 1e6, 2)} mL/s`, `Main valve ${fixed(now.mainFlow * 1e6, 2)}; bypass ${fixed(now.bypassFlow * 1e6, 2)} mL/s. Volumes refer to upstream gas at 25 °C and inlet absolute pressure. A fixed coefficient of 0.6 approximates flow through these openings.`),
      r('Burner heat', `${fixed(now.power, 0)} W · ${now.lit ? 'flame lit' : 'unlit'}`, 'The model retains 45% of pure methane gross combustion energy as oven heat. Gas can flow without burning. Ignition is attempted only at playback start; flame stability and real flame-failure shutoff are omitted.'),
      r('Elapsed gas and heat', `${fixed(now.volume * 1000, 2)} L supplied`, `${fixed(now.inputEnergy / 1000, 1)} kJ entered the oven, ${fixed(now.storedEnergy / 1000, 1)} kJ changed stored heat, and ${fixed(now.environmentEnergy / 1000, 1)} kJ transferred outward. Negative outward heat means the kitchen warmed the oven.`),
      r('Setting and scale', `${values.setting} °C · calibrated at 20 mbar`, 'The illustrative dial is calibrated with its bypass fitted at 20 mbar. Supply pressure or bypass changes can shift the balance temperature. Thermal extensions and valve travel ×100; playback ×120. Dimensions and oven properties are teaching choices.'),
    ]};
  });
  const render = result.update;
  result.update = next => { const before = result.getState().values, readings = render(next); if (Object.keys(before).some(key => result.getState().values[key] !== before[key])) { clock = 0; lastClock = 0; return render(); } return readings; };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) { const next = clock + dt * DECLARED.slower; clock = next >= DECLARED.ovenRun - 1e-8 ? DECLARED.ovenRun : next; } return render(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: tube and rod', part: 'tube', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: valve and spring', part: 'valve', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: setting dial', part: 'dial', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: oven and burner', part: 'oven', view: 'front', replay: false, run: () => render()},
  ];
  result.playback = {label: 'Start the oven trial', description: 'Open the gas cock and attempt ignition once. Run 40 oven minutes in 20 seconds. Pause freezes time; changing a control starts a new trial.', stepLabel: 'Advance 5 min', advance: result.advance, step: () => result.advance(300 / DECLARED.slower), complete: () => clock >= DECLARED.ovenRun, blocked: () => false};
  result.resultPart = {id: 'oven', label: 'Inspect the oven', view: 'front', focusOnComplete: false, available: () => clock >= DECLARED.ovenRun};
  result.viewDirections = {front: [0, 0.35, 2.7], side: [2.7, 0.5, 1], top: [0, 2.7, 0.7]};
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.53; result.selectionOutline = false; result.transparentBackground = true;
  result.catalogParts = result.parts.filter(part => part.id !== 'system');
  result.topology = {system, body, housing, backPlate, collar, supplyEnd, sensor, tubeOuter, tubeInner, tubeEdges, tubeCap, rodPart, rodBar, joint, valve, seat, poppet, stem, springGroup, spring, dial, extension, adjuster, knob, knobMark, thread, bypass, bypassPipe, bypassMarks, oven, floor, ovenBack, leftWall, rim, ovenTint, thermometer, thermometerTrack, thermometerBulb, thermometerFluid, burner, burnerBar, supports, flames, flameMeshes, heatArrows, circuit, inlet, outlet, cock, cockHandle, gasMarks, mainFlowLine, mainFlowMarks, chart, chartFrame, settingLine, curve};
  const dispose = result.dispose; result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

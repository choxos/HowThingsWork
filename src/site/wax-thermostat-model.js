import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, solidArrow, textLabel} from './scene-kit.js';
import {waxPlan, waxAt, WAX_DEFAULTS, WAX_DOMAINS, WAX_SPEC as S, COOLANT} from './thermostat-physics.js';

export const MM = 0.04;
export const ELEMENT = Object.freeze({origin: Object.freeze([0, .5, 0]), rodTip: -18, rodTop: 23, cupFloor: -20,
  innerRadius: Math.sqrt((900 + Math.PI * 4 * 18) / (20 * Math.PI)), outerRadius: 6.5,
  seatRadius: 20, discRadius: 22, discThickness: 2, springBase: -44, springRadius: 10, springWire: .7});
export const CHART = Object.freeze({x: -2.85, y: -3.45, w: 5.7, h: .64, temperature: Object.freeze([-10, 120])});
export const COLORS = Object.freeze({body: 0xe1ddd0, edge: 0x374736, brass: 0xc9a66a, steel: 0x9baeb2,
  solid: 0xe8bd65, liquid: 0xb96d39, cool: 0x5a9db9, hot: 0xcb6550, wax: 0x987136, flow: 0xbcece9, heat: 0xd8783f});
export const chartX = (plan, time) => CHART.x + time / plan.duration * CHART.w;
export const chartY = temperature => CHART.y + (temperature + 10) / 130 * CHART.h;
export const coolantColor = temperature => new THREE.Color(COLORS.cool).lerp(new THREE.Color(COLORS.hot), clamp((temperature + 10) / 130));

export function createWaxThermostatModel() {
  const kit = houseModel('Wax thermostat'), {part, box, cylinder, sphere, tube, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const mm = (x, y, z = 0) => [x * MM, y * MM, z * MM];
  const mesh = (geometry, color, parent) => { const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color, roughness: .55, side: THREE.DoubleSide})); parent.add(object); return object; };
  const label = (parent, text, position, width = 1.6, height = .15) => { const object = textLabel(parent, text, {position, width, height}); object.material.depthTest = false; object.material.side = THREE.FrontSide; object.renderOrder = 2; return object; };
  const annulus = (outer, inner, height, top, color, parent, half = false) => {
    const shape = new THREE.Shape();
    if (half) {
      shape.moveTo(outer * MM, 0); shape.absarc(0, 0, outer * MM, 0, Math.PI, true);
      if (inner) { shape.lineTo(-inner * MM, 0); shape.absarc(0, 0, inner * MM, Math.PI, 0, false); }
      else shape.lineTo(0, 0);
      shape.closePath();
    } else {
      shape.absarc(0, 0, outer * MM, 0, Math.PI * 2, false);
      if (inner) { const hole = new THREE.Path(); hole.absarc(0, 0, inner * MM, 0, Math.PI * 2, true); shape.holes.push(hole); }
    }
    const object = mesh(new THREE.ExtrudeGeometry(shape, {depth: height * MM, bevelEnabled: false, curveSegments: 48}), color, parent);
    object.material.side = THREE.FrontSide;
    object.rotation.x = Math.PI / 2; object.position.y = top * MM; return object;
  };
  const route = (points, parent, count = 4) => {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const pipe = tube(points, .047, COLORS.cool, parent); pipe.material = pipe.material.clone();
    const marks = Array.from({length: count}, () => sphere(.061, [0, 0, 0], COLORS.flow, parent));
    return {points, path, pipe, marks};
  };
  const showFlow = (path, temperature, flow, volume) => {
    path.pipe.material.color.copy(coolantColor(temperature));
    path.marks.forEach((mark, i) => { mark.visible = flow > 0; path.path.getPoint((volume / .05 + i / path.marks.length) % 1, mark.position); });
  };

  const system = part('system', 'Wax thermostat and cooling loop', 'A pump sends coolant through the engine. Warm coolant heats the wax; expansion drives a rigid capsule and valve downward against a return spring. Opening the valve sends some coolant through the radiator. The thermostat is enlarged relative to the schematic loop; its internal dimensions share one scale.');
  const frame = part('frame', 'Fixed housing, seat and supports', 'The upper bridge anchors the piston. The housing holds a fixed annular seat and the lower spring support. Coolant enters the lower chamber and can cross the seat only when the valve moves down. Front halves of the housing and capsule are cut away.', ELEMENT.origin, system);
  const housing = mesh(new THREE.CylinderGeometry(30 * MM, 30 * MM, 74 * MM, 64, 1, true, Math.PI / 2, Math.PI), COLORS.body, frame); housing.position.y = -11 * MM;
  const housingInside = mesh(new THREE.CylinderGeometry(28.5 * MM, 28.5 * MM, 74 * MM, 64, 1, true, Math.PI / 2, Math.PI), COLORS.body, frame); housingInside.position.y = -11 * MM;
  const cutEdges = [[-29.25, -48, -35], [-29.25, -29, 26], [29.25, -48, 9], [29.25, 15, 26]].map(([x, low, high]) => box(mm(1.5, high - low, 1.5), mm(x, (low + high) / 2), COLORS.body, frame));
  const ports = [[-30, -32, 2], [30, 12, 2]].map(position => { const port = kit.ring(2 * MM, .8 * MM, mm(...position), COLORS.edge, frame); port.rotation.y = Math.PI / 2; return port; });
  const seat = annulus(29.25, ELEMENT.seatRadius, 2, 2, COLORS.edge, frame);
  const lowerSeat = annulus(14, 7, 2, ELEMENT.springBase, COLORS.edge, frame);
  const supports = [-1, 1].flatMap(side => [
    kit.rod(mm(side * 27, 2, -7), mm(side * 4, 24.5, -7), 1.3 * MM, COLORS.steel, frame),
    kit.rod(mm(side * 27, -2, -7), mm(side * 13, -45, -7), 1.3 * MM, COLORS.steel, frame),
  ]);
  const bridge = box(mm(10, 3, 16), mm(0, 24.5, -3), COLORS.steel, frame);
  label(frame, 'Fixed rod · moving cup', mm(0, 44, 0), 2.25, .16);

  const piston = part('piston', 'Fixed piston', 'This rod does not stretch or rise. Its upper end bears on the fixed bridge, so expanding wax pushes the capsule downward around it. A sliding seal keeps the wax inside. The drawing simplifies the flexible boot used in many commercial elements.', [0, 0, 0], frame);
  const rod = mesh(new THREE.CylinderGeometry(2 * MM, 2 * MM, (ELEMENT.rodTop - ELEMENT.rodTip) * MM, 96), COLORS.steel, piston);
  rod.position.y = (ELEMENT.rodTop + ELEMENT.rodTip) / 2 * MM;

  const capsule = part('capsule', 'Moving wax capsule and seal', 'The rigid brass cup, seal and attached valve descend together. Their dimensions stay fixed. In the declared geometry, extra wax volume equals piston area times travel. The front half of the cup is removed so the wax and rod overlap can be inspected.', [0, 0, 0], frame);
  const shell = annulus(ELEMENT.outerRadius, ELEMENT.innerRadius, 22, 0, COLORS.brass, capsule, true);
  const floor = annulus(ELEMENT.innerRadius, 0, 2, ELEMENT.cupFloor, COLORS.brass, capsule, true);
  const seal = annulus(ELEMENT.outerRadius, 2, 2, 2, COLORS.edge, capsule, true);
  const waxPart = part('wax', 'Wax and phase change', 'Wax absorbs heat before and during melting. Here its temperature can lag behind the coolant, and freezing follows a lower temperature curve than melting. The amber-to-brown color represents the liquid fraction of a uniform mixture. The occupied volume grows as the cup moves away from the fixed rod.', [0, 0, 0], capsule);
  const waxUpper = annulus(ELEMENT.innerRadius, 2, 1, 0, COLORS.solid, waxPart, true);
  const waxLower = annulus(ELEMENT.innerRadius, 0, 1, ELEMENT.rodTip, COLORS.solid, waxPart, true);
  const valve = part('valve', 'Moving valve disc', 'The disc is attached to the capsule. Cold, its upper face touches the underside of the fixed seat. As it moves down, coolant can pass around its edge and upward through the annular port. The opening area grows with seat circumference times lift until the port becomes the limit.', [0, 0, 0], capsule);
  const disc = annulus(ELEMENT.discRadius, ELEMENT.outerRadius, ELEMENT.discThickness, 0, COLORS.hot, valve);
  const liftArrow = solidArrow(kit, COLORS.hot, frame, .009); liftArrow.position.set(...mm(24, 0, 10)); liftArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));
  const valveWord = label(frame, '', mm(0, 36, 0), 2.0, .15);

  const springPart = part('spring', 'Return spring', 'The lower frame supports a preloaded spring under the valve disc. Opening compresses it. When wax releases heat and contracts, the spring raises the cup and reseats the valve. The model omits seal friction and mechanical failure; real thermostats can jam.', [0, 0, 0], frame);
  const spring = kit.spring(mm(0, ELEMENT.springBase + ELEMENT.springWire), ELEMENT.springRadius * MM, (42 - 2 * ELEMENT.springWire) * MM, 6, springPart, ELEMENT.springWire * MM);
  const springEnds = [ELEMENT.springBase + ELEMENT.springWire, -2 - ELEMENT.springWire].map(y => { const end = kit.ring(ELEMENT.springRadius * MM, ELEMENT.springWire * MM, mm(0, y), COLORS.steel, springPart); end.rotation.x = Math.PI / 2; return end; });
  const waxWord = label(frame, '', mm(0, -58, 4), 2.3, .15);

  const engine = part('engine', 'Engine and coolant jacket', 'Engine heat enters a lumped 90 kJ/K thermal store. Coolant returns from the pump, crosses the cutaway jacket and leaves toward the wax capsule. Heat also transfers between the block and outdoor air. A zero heat setting removes engine input while the independent model pump keeps running.', [0, 0, 0], system);
  const engineBack = box([1.18, 1.5, .12], [-2.45, .08, -.25], COLORS.body, engine);
  const engineSides = [[-3.04, -.67, .83], [-1.86, -.67, .40], [-1.86, .72, .83]].map(([x, low, high]) => box([.09, high - low, .48], [x, (low + high) / 2, -.06], COLORS.body, engine));
  const cylinders = [-2.78, -2.45, -2.12].map(x => { const object = cylinder(.12, .83, [x, .08, .04], COLORS.hot, engine); object.material = object.material.clone(); return object; });
  const jacket = route([[-2.45, -.67, .14], [-2.45, -.43, .14], [-2.89, -.43, .14], [-2.89, .56, .14], [-1.86, .56, .14]], engine);
  const inputArrows = [-2.62, -2.28].map(x => { const arrow = solidArrow(kit, COLORS.heat, engine, .015); arrow.position.set(x, -.05, .28); return arrow; });
  const engineWord = label(engine, '', [-2.45, 1.17, .2], 1.6, .17);
  const loadWord = label(engine, '', [-2.45, .93, .2], 1.6, .14);

  const pump = part('pump', 'Independent coolant pump', 'The teaching pump supplies 0.8 L/s after Play, including when engine heat is zero. The rotor and moving markers show circulation. A real engine-driven pump may stop with its engine; this separate pump is used to make the cooling trial possible.', [0, 0, 0], system);
  const pumpBody = new THREE.Group(); pumpBody.position.set(-2.45, -1.85, .1); pump.add(pumpBody);
  for (const [start, end] of [[.25, Math.PI / 2 - .25], [Math.PI / 2 + .25, Math.PI * 2 - .25]]) { const casing = mesh(new THREE.TorusGeometry(.26, .055, 8, 64, end - start), COLORS.edge, pumpBody); casing.rotation.z = start; }
  const pumpLiquid = kit.disk(.205, .035, [-2.45, -1.85, .055], COLORS.cool, pump); pumpLiquid.material = pumpLiquid.material.clone();
  const rotor = new THREE.Group(); rotor.position.set(-2.45, -1.85, .12); pump.add(rotor);
  const pumpHub = kit.disk(.07, .07, [0, 0, 0], COLORS.steel, rotor);
  const blades = Array.from({length: 5}, (_, i) => { const blade = box([.2, .065, .055], [.09, 0, 0], COLORS.steel, rotor); const holder = new THREE.Group(); rotor.add(holder); holder.add(blade); holder.rotation.z = i * 2 * Math.PI / 5; return holder; });
  const pumpWord = label(pump, '', [-2.45, -2.33, .2], 1.5, .14);

  const radiator = part('radiator', 'Radiator and outdoor air', 'Opening the thermostat sends coolant through these parallel tubes. Heat flows toward the cooler side. The model approximates air as a reservoir at the selected temperature, with fixed radiator conductance. Tube colors and outlet temperature show the resulting cooling or warming.', [0, 0, 0], system);
  const radiatorFrame = box([1.18, 1.87, .12], [2.45, .14, -.16], COLORS.edge, radiator);
  const fins = Array.from({length: 10}, (_, i) => box([1.12, .045, .34], [2.45, -.68 + i * .18, -.07], COLORS.steel, radiator));
  const radiatorTop = kit.rod([1.94, 1.02, .17], [2.96, 1.02, .17], .069, COLORS.hot, radiator); radiatorTop.material = radiatorTop.material.clone();
  const radiatorBottom = kit.rod([1.94, -.77, .17], [2.96, -.77, .17], .069, COLORS.cool, radiator); radiatorBottom.material = radiatorBottom.material.clone();
  const radiatorTubes = Array.from({length: 5}, (_, i) => Array.from({length: 8}, (_, j) => {
    const x = 2 + i * .225, top = 1.02 - 1.79 * j / 8, bottom = 1.02 - 1.79 * (j + 1) / 8;
    const object = kit.rod([x, top, .19], [x, bottom, .19], .036, COLORS.cool, radiator); object.material = object.material.clone(); return object;
  }));
  const radiatorMarks = Array.from({length: 5}, (_, i) => sphere(.052, [2 + i * .225, 0, .25], COLORS.flow, radiator));
  const rejectionArrow = solidArrow(kit, COLORS.heat, radiator, .012); rejectionArrow.position.set(3.12, .16, .2);
  const radiatorWord = label(radiator, '', [2.45, 1.83, .25], 1.9, .16);
  const airWord = label(radiator, '', [2.45, 2.1, .25], 1.8, .14);
  const heatWord = label(radiator, '', [2.45, -1.1, .25], 1.8, .14);

  const bypass = part('bypass', 'Always-open bypass', 'This branch returns hot coolant to the pump without crossing the radiator. With the main valve seated, all pumped coolant takes this path. It stays open in this single-valve model; some real thermostats have a second valve that progressively closes the bypass.', [0, 0, 0], system);
  const bypassRoute = route([[-1.52, -.78, .14], [-1.52, -1.38, .14], [-1.52, -1.98, .14]], bypass, 3);
  label(bypass, 'Bypass', [-1.55, -1.18, .34], .8, .14);

  const circuit = part('circuit', 'Connected coolant paths', 'From the pump, coolant passes through the engine and divides between the thermostat and bypass. Radiator coolant rejoins bypass coolant before returning to the pump. Markers show direction and relative flow, not individual parcels or a calibrated transit time.', [0, 0, 0], system);
  const pumpOutlet = route([[-2.45, -1.59, .14], [-2.45, -1.15, .14], [-2.45, -.67, .14]], circuit, 3);
  const engineOutlet = route([[-1.86, .56, .14], [-1.52, .56, .14], [-1.52, -.78, .14], [-1.2, -.78, .08]], circuit, 3);
  const radiatorInlet = route([[1.2, .98, .08], [1.6, .98, .08], [1.94, 1.02, .17]], circuit, 3);
  const radiatorReturn = route([[2.96, -.77, .17], [3.2, -.77, .14], [3.2, -1.98, .14], [-1.52, -1.98, .14]], circuit, 4);
  const mixedReturn = route([[-1.52, -1.98, .14], [-2.03, -1.98, .14], [-2.03, -1.85, .14], [-2.19, -1.85, .14]], circuit, 3);
  const mainFlowLine = lineObject(12, COLORS.flow, frame);
  const mainFlowMarks = Array.from({length: 5}, () => sphere(.02, [0, 0, 0], COLORS.flow, frame));
  const returnWord = label(circuit, '', [.45, -2.21, .22], 2.2, .14);

  const chart = part('chart', 'Elapsed engine and wax temperatures', 'Both traces use degrees Celsius and include only elapsed time. Red is engine coolant; amber is wax. Their separation shows sensor lag. The heating and cooling phase rules also differ by 4 °C. The final point is the end of a twenty-minute trial, not proof of a steady temperature.', [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.edge, chart);
  fillLine(chartFrame, [[CHART.x, CHART.y, 0], [CHART.x + CHART.w, CHART.y, 0], [CHART.x + CHART.w, CHART.y + CHART.h, 0], [CHART.x, CHART.y + CHART.h, 0], [CHART.x, CHART.y, 0]]);
  chartText(chart, (share, temperature) => [CHART.x + share * CHART.w, chartY(temperature), 0], {size: .095,
    x: {min: 0, max: 1, title: 'Elapsed minutes', ticks: [[0, '0'], [.5, '10'], [1, '20']]},
    y: {min: -10, max: 120, ticks: [[-10, '-10 °C'], [60, '60 °C'], [120, '120 °C']]}}).forEach(object => { object.material.side = THREE.FrontSide; });
  const engineCurve = lineObject(S.samples + 1, COLORS.hot, chart), waxCurve = lineObject(S.samples + 1, COLORS.wax, chart);
  label(chart, 'Engine °C / wax °C · elapsed only', [0, CHART.y + CHART.h + .18, .02], 3.2, .14);

  const d = WAX_DEFAULTS, D = WAX_DOMAINS;
  control('growth', 'Full-melt wax growth', ...D.growth, d.growth, '%', 'Extra volume when all the wax has melted. More growth gives more valve travel at the same melted fraction. Changing any control resets the trial.');
  control('load', 'Engine heat to coolant', ...D.load, d.load, 'kW', 'Heat entering the engine and coolant. Zero removes that heat while the independent pump keeps circulating.');
  control('ambient', 'Outside air', ...D.ambient, d.ambient, '°C', 'Air temperature around the radiator and block. Heat flows toward the cooler side.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'Initial engine and wax temperature. The wax is prepared on its warming curve; a hot start can begin with the valve open.');

  const result = finish(values => {
    const plan = waxPlan(values), now = waxAt(plan, clock), stroke = now.stroke * 1000;
    capsule.position.y = -stroke * MM;
    waxUpper.scale.z = 18 - stroke;
    waxLower.scale.z = 2 + stroke; waxLower.position.y = (ELEMENT.rodTip + stroke) * MM;
    for (const object of [waxUpper, waxLower]) object.material.color.setHex(COLORS.solid).lerp(new THREE.Color(COLORS.liquid), now.melted);
    spring.userData.setLength((42 - stroke - 2 * ELEMENT.springWire) * MM);
    springEnds[1].position.y = (-2 - stroke - ELEMENT.springWire) * MM;
    liftArrow.userData.setLength(stroke * MM);
    valveWord.userData.setText(stroke > 1e-7 ? `Valve down ${fixed(stroke, 2)} mm` : 'Valve seated');
    waxWord.userData.setText(`Wax ${fixed(now.waxCelsius, 1)} °C · ${fixed(now.melted * 100, 0)}% liquid`);
    const mainPoints = [[-30, -32, 2], [-25, -28, 3], [-25, -stroke / 2, 0], [-18, -stroke / 2, 0], [-15, 10, 8], [15, 12, 8], [30, 12, 2]].map(p => mm(...p));
    fillLine(mainFlowLine, now.toRadiator > 0 ? mainPoints : []);
    const mainPath = new THREE.CurvePath();
    for (let i = 1; i < mainPoints.length; i++) mainPath.add(new THREE.LineCurve3(new THREE.Vector3(...mainPoints[i - 1]), new THREE.Vector3(...mainPoints[i])));
    mainFlowMarks.forEach((mark, i) => { mark.visible = now.toRadiator > 0; mark.scale.setScalar(Math.min(1, stroke * MM / .06)); mainPath.getPoint((now.radiatorVolume / .05 + i / mainFlowMarks.length) % 1, mark.position); });
    for (const object of cylinders) object.material.color.copy(coolantColor(now.celsius));
    for (const arrow of inputArrows) arrow.userData.setLength(now.power > 0 ? .1 + .26 * now.power / 24000 : 0);
    rotor.rotation.z = -now.t * Math.PI / 30;
    pumpLiquid.material.color.copy(coolantColor(now.returnCelsius));
    engineWord.userData.setText(`Engine ${fixed(now.celsius, 1)} °C`);
    loadWord.userData.setText(`${fixed(now.power / 1000, 0)} kW heat input`);
    pumpWord.userData.setText(now.mainOn ? 'Pump 0.8 L/s' : 'Pump ready');
    radiatorWord.userData.setText(now.toRadiator > 0 ? `Outlet ${fixed(now.radiatorOutlet, 1)} °C` : 'Radiator · no flow');
    airWord.userData.setText(`Air ${values.ambient} °C`);
    heatWord.userData.setText(`${fixed(Math.abs(now.radiatorHeat) / 1000, 1)} kW ${now.radiatorHeat < 0 ? 'from air' : 'to air'}`);
    returnWord.userData.setText(now.mainOn ? `Mixed return ${fixed(now.returnCelsius, 1)} °C` : 'Return to pump');
    const outletTemperature = now.toRadiator > 0 ? now.radiatorOutlet : values.ambient;
    radiatorTop.material.color.copy(coolantColor(now.toRadiator > 0 ? now.celsius : values.ambient)); radiatorBottom.material.color.copy(coolantColor(outletTemperature));
    const capacityRate = now.toRadiator * COOLANT.density * COOLANT.heat;
    radiatorTubes.forEach(row => row.forEach((object, j) => object.material.color.copy(coolantColor(capacityRate > 0 ? values.ambient + (now.celsius - values.ambient) * Math.exp(-S.radiatorUA * (j + .5) / 8 / capacityRate) : values.ambient))));
    radiatorMarks.forEach((mark, i) => { mark.visible = now.toRadiator > 0; mark.position.y = 1.02 - 1.79 * ((now.radiatorVolume / .05 + i / 5) % 1); });
    rejectionArrow.userData.setDirection(new THREE.Vector3(now.radiatorHeat < 0 ? -1 : 1, 0, 0)); rejectionArrow.userData.setLength(Math.abs(now.radiatorHeat) > 1 ? .12 + .2 * clamp(Math.abs(now.radiatorHeat) / 30000) : 0);
    showFlow(jacket, now.celsius, now.pumpFlow, now.pumpVolume);
    showFlow(pumpOutlet, now.returnCelsius, now.pumpFlow, now.pumpVolume);
    showFlow(engineOutlet, now.celsius, now.pumpFlow, now.pumpVolume);
    showFlow(bypassRoute, now.celsius, now.toBypass, now.bypassVolume);
    showFlow(radiatorInlet, now.celsius, now.toRadiator, now.radiatorVolume);
    showFlow(radiatorReturn, outletTemperature, now.toRadiator, now.radiatorVolume);
    showFlow(mixedReturn, now.returnCelsius, now.pumpFlow, now.pumpVolume);
    const shown = now.t > 0 ? [...plan.chart.filter(sample => sample.t < now.t), now] : [];
    fillLine(engineCurve, shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), .01]));
    fillLine(waxCurve, shown.map(sample => [chartX(plan, sample.t), chartY(sample.waxCelsius), .012]));
    const balance = Math.abs(now.rate) < .001 ? 'Heat input nearly balances heat transfer' : now.rate > 0 ? 'Engine still warming' : 'Engine cooling';
    const routing = now.toRadiator > 0 ? `${fixed(now.toRadiator * 1e6, 0)} mL/s through radiator` : 'Valve seated; all flow uses bypass';
    const status = !now.mainOn ? `Ready · engine and wax ${fixed(now.celsius, 1)} °C; pump stopped. Play starts this prepared trial.`
      : `${now.done ? '20 min complete' : `${fixed(now.t / 60, 1)} min elapsed`} · ${fixed(now.celsius, 1)} °C. ${balance}; ${routing}.`;
    return {state: {...plan, now, clock, geometry: {stroke, rodTip: ELEMENT.rodTip, cupFloor: ELEMENT.cupFloor - stroke, discTop: -stroke, springBottom: ELEMENT.springBase, springTop: -2 - stroke}}, readings: [
      r('Your result', status),
      r('Engine / wax temperature', `${fixed(now.celsius, 2)} / ${fixed(now.waxCelsius, 2)} °C`, 'The two temperatures can differ because heat takes time to enter or leave the capsule. The graph shows only elapsed temperatures.'),
      r('Wax phase and volume', `${fixed(now.melted * 100, 1)}% liquid · ${fixed(now.waxVolume * 1e9, 1)} mm³`, 'The declared pellet begins at 900 mm³. Melting follows 82–95 °C; freezing follows 78–91 °C. At a reversal, the liquid fraction holds until the opposite boundary is reached. This illustrative phase-history rule is distinct from temperature lag.'),
      r('Valve travel', `${fixed(stroke, 2)} mm down`, `The rod stays fixed. The cup and attached disc move by extra wax volume divided by the 4 mm piston area. Full melt at this growth gives ${fixed(plan.fullStroke * 1000, 2)} mm of travel; current port opening is ${fixed(now.area * 1e6, 1)} mm².`),
      r('Return spring', `${fixed(now.spring, 1)} N upward`, `A 30 N preload keeps the cold disc seated. Opening adds 9 N per millimeter. The spring stores ${fixed(now.springEnergy, 3)} J relative to the seated state and returns that work during closure. Seal friction and valve pressure forces are omitted.`),
      r('Radiator / bypass flow', `${fixed(now.toRadiator * 1e6, 1)} / ${fixed(now.toBypass * 1e6, 1)} mL/s`, 'The pump supplies 800 mL/s once started. Two equivalent parallel restrictions divide this flow. The bypass stays open in this model; real pump curves and secondary bypass valves are omitted.'),
      r('Radiator outlet / mixed return', now.toRadiator > 0 ? `${fixed(now.radiatorOutlet, 2)} / ${fixed(now.returnCelsius, 2)} °C` : `No radiator flow / ${fixed(now.returnCelsius, 2)} °C`, 'Radiator heat transfer and outlet temperature share one coolant enthalpy balance. Cooled coolant mixes with bypass coolant before the pump. With zero radiator flow there is no flowing outlet temperature.'),
      r('Heat input / heat to air', `${fixed(now.power / 1000, 2)} / ${fixed(now.radiatorHeat / 1000, 2)} kW`, `Radiator transfer is positive toward air. Block transfer is ${fixed(now.blockHeat / 1000, 2)} kW; heat into the wax is ${fixed(now.waxHeat, 2)} W. Negative transfer means heat flows in the opposite direction.`),
      r('Elapsed energy balance', `${fixed(now.inputEnergy / 1000, 1)} kJ supplied`, `${fixed(now.storedEnergy / 1000, 1)} kJ changed engine storage; ${fixed(now.actuatorEnergy / 1000, 3)} kJ changed wax, capsule and spring energy; ${fixed((now.radiatorEnergy + now.blockEnergy) / 1000, 1)} kJ transferred to surroundings.`),
      r('Coolant and scale', '50% glycol by volume · playback ×60', 'Constant properties represent a 50% ethylene-glycol mixture at 90 °C. Minimum absolute pressure is 200 kPa; this liquid model is limited to −10 through 120 °C. Thermostat dimensions and thermal constants are teaching choices. It is enlarged relative to the loop; marker speed is schematic.'),
    ]};
  });
  const render = result.update;
  result.update = next => { const before = result.getState().values, readings = render(next); if (Object.keys(before).some(key => result.getState().values[key] !== before[key])) { clock = 0; lastClock = 0; return render(); } return readings; };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) { const next = clock + dt * S.slower; clock = next >= S.duration - 1e-8 ? S.duration : next; } return render(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: wax capsule', part: 'capsule', view: 'front', replay: false, run: () => render()},
    {label: 'Inspect: fixed piston', part: 'piston', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: valve and spring', part: 'frame', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: cooling loop', part: 'system', view: 'front', replay: false, run: () => render()},
  ];
  result.playback = {label: 'Start the cooling trial', description: 'Start the independent pump and selected engine heat. Run twenty minutes in twenty seconds. Pause freezes time; changing a control resets the trial.', stepLabel: 'Advance 2 min', advance: result.advance, step: () => result.advance(120 / S.slower), complete: () => clock >= S.duration, blocked: () => false};
  result.resultPart = {id: 'system', label: 'Inspect the cooling loop', view: 'front', focusOnComplete: false, available: () => clock >= S.duration};
  result.viewDirections = {front: [0, .25, 4], side: [3, .6, 3], top: [0, 3, 3], bottom: [0, -1.5, 3.5]};
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .5; result.overviewZoom = 1.4; result.selectionOutline = false; result.transparentBackground = true;
  result.catalogParts = result.parts.filter(item => item.id !== 'system');
  for (const id of ['piston', 'capsule', 'wax', 'valve', 'spring', 'engine', 'radiator', 'bypass', 'circuit']) result.parts.find(part => part.id === id).framePadding = .75;
  result.topology = {system, frame, housing, housingInside, cutEdges, ports, seat, lowerSeat, supports, bridge, piston, rod, capsule, shell, floor, seal, waxPart, waxUpper, waxLower, valve, disc, liftArrow, springPart, spring, springEnds, engine, engineBack, engineSides, cylinders, jacket, inputArrows, pump, pumpBody, pumpLiquid, rotor, pumpHub, blades, radiator, radiatorFrame, fins, radiatorTop, radiatorBottom, radiatorTubes, radiatorMarks, rejectionArrow, bypass, bypassRoute, circuit, pumpOutlet, engineOutlet, radiatorInlet, radiatorReturn, mixedReturn, mainFlowLine, mainFlowMarks, chart, chartFrame, engineCurve, waxCurve};
  const dispose = result.dispose; result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

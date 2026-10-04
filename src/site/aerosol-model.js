import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText} from './scene-kit.js';
import {sampleAerosol, aerosolPlan, aerosolInitialAmounts, AEROSOL, PROPELLANT_OPTIONS, AEROSOL_DEFAULTS, AEROSOL_DOMAINS} from './aerosol-physics.js';
import {AS, aerosolEquilibrium} from './aerosol-equilibrium.js';
import {MM, CAN, VALVE, point, bottomAt, radiusAt, levelFor, liquidOutline, lathe, hollowCylinder, hollowCurve, stemGeometry, dipTubeCurve, ActuatorCurve} from './aerosol-geometry.js';
export {CAN, bottomAt, radiusAt, levelFor, liquidOutline, BRIMFUL} from './aerosol-geometry.js';

const STEEL = new THREE.Color(0xb4c5b0), COLD = new THREE.Color(0x86b4c1);
const chartPoint = (x, pressure, span) => point([-100 + x / span * 200, -65 + pressure / 1.2e6 * 150, 0]);
export const pressurePoint = (t, p) => chartPoint(t, p, 180);
export const temperaturePoint = (t, p) => chartPoint(t, p, 50);

export function createAerosolCanModel() {
  const kit = houseModel('Aerosol spray can'), {root, part, control, finish} = kit;
  const box = (size, pos, color, parent) => kit.box(point(size), point(pos), color, parent);
  const cylinder = (radius, length, pos, color, parent) => kit.cylinder(radius * MM, length * MM, point(pos), color, parent);
  const mesh = (geometry, color, parent, opacity = 1) => {
    const template = box([1, 1, 1], [0, 0, 0], color, parent);template.geometry.dispose();template.geometry = geometry;
    template.material = template.material.clone();Object.assign(template.material, {side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity === 1});return template;
  };
  const ring = (inside, outside, length, pos, color, parent, opacity = 1, start = 0, span = Math.PI * 2) => {const m = mesh(hollowCylinder(inside, outside, length, start, span), color, parent, opacity);m.position.set(...point(pos));return m;};
  const system = part('system', 'Aerosol spray can', 'An original cutaway with a dip tube, spring-return valve and hollow actuator. Pressure drives discharge when the radial stem ports open below their gasket.', [0, 0, 0]);
  const holder = new THREE.Group();system.add(holder);
  const container = part('container', 'Can and liquid supply', 'A nominal 500 mL rigid vessel and its dip tube. The original teaching shape has a domed base and a sloped shoulder; wall strength is not calculated.', [0, 0, 0], holder);
  const valve = part('valve', 'Spring-return valve', 'A fixed gasket covers both stem ports. Pressing the actuator moves the stem 2.4 mm down, exposing the ports to the chamber. The spring returns the stem when released.', [0, 0, 0], holder);
  const actuator = part('actuator', 'Actuator and discharge path', 'The moving cap bears on the valve stem. Its internal elbow carries fluid to an open, tapered nozzle insert.', [0, 0, 0], holder);
  const can = part('can', 'Domed cutaway can', 'An illustrative thin shell with a front sector removed. Its pale blue tint indicates cooling, not ice or a predicted material change.', [0, 0, 0], container);
  const inside = [...Array.from({length: 25}, (_, k) => [CAN.chine * k / 24, bottomAt(CAN.chine * k / 24)]), [CAN.radius, 0], [CAN.radius, CAN.wallTop], [CAN.neck, CAN.shoulderTop]];
  const outside = inside.map(([radius, y]) => [radius === 0 ? 0 : radius + .3, y - .3]);
  const shell = mesh(lathe([...outside, ...inside.toReversed(), outside[0]], Math.PI / 4, 1.5 * Math.PI), 'metal', can);
  const rim = kit.ring(CAN.neck * MM, .65 * MM, point([0, 165, 0]), 'metal', can);rim.rotation.x = Math.PI / 2;

  const tube = part('dip-tube', 'Hollow dip tube', 'An open 2.2 mm bore reaches the bottom corner. Liquid delivery stops when the free surface falls below that inlet. Upside down, the inlet lies in the gas region.', [0, 0, 0], container);
  const tubeCurve = dipTubeCurve(), dipTube = mesh(hollowCurve(tubeCurve, 1.1, 1.5), 'cream', tube, .38);
  const cup = part('mounting-cup', 'Mounting cup and neck seal', 'The metal cup supports the valve at the can neck. Its central opening lets the stem slide through a stationary gasket.', [0, 0, 0], valve);
  const cupMesh = ring(1.85, 13.5, 1, [0, 166.5, 0], 'metal', cup, .35);
  ring(12.7, 13.5, .8, [0, 165.5, 0], 'ink', cup);
  const housing = part('housing', 'Valve housing and inlet', 'A hollow chamber joins the dip tube to the stem ports. Its open front is a cutaway. Space around the spring and stem seat lets fluid reach the ports.', [0, 0, 0], valve);
  const housingWall = ring(4.5, 5.5, 18, [0, 155, 0], 'cream', housing, .5, Math.PI / 4, 1.5 * Math.PI);
  const housingBase = ring(1.1, 5.5, 2, [0, 146, 0], 'cream', housing, .6);
  const gasket = part('gasket', 'Stem-port sealing gasket', 'The annular seal spans 164–166 mm. Both ports sit inside that band when released and move completely below it when pressed.', [0, 0, 0], valve);
  const gasketMesh = ring(1.8, 5.5, 2, [0, 165, 0], 'ink', gasket);
  const sealContact = part('seal-contact', 'Stem ports and gasket close-up', 'Compare the ports covered by the fixed gasket with the ports exposed below it. The fine brackets frame this inspection; they are not can components.', [0, 0, 0], holder);
  sealContact.userData.inspectionOnly = 'seal-contact';sealContact.userData.explosionExcluded = true;
  for (const sign of [-1, 1]) for (const [a, b] of [[[6.2 * sign, 161.8, 0], [6.2 * sign, 166.5, 0]], [[5.7 * sign, 161.8, 0], [6.2 * sign, 161.8, 0]], [[5.7 * sign, 166.5, 0], [6.2 * sign, 166.5, 0]]]) kit.rod(point(a), point(b), .035 * MM, 'leaf', sealContact);
  const stem = part('stem', 'Hollow stem and radial ports', 'Two real side openings lead into a blind-bottom stem bore. The lower seat transmits the spring force; the upper end meets the actuator channel.', [0, 0, 0], valve);
  const stemWall = mesh(stemGeometry(), 'metal', stem);
  const stemPlug = cylinder(1.8, 1, [0, 157.5, 0], 'metal', stem);
  const springSeat = cylinder(3.5, 1, [0, 157, 0], 'metal', stem);
  const springPart = part('spring', 'Return spring', 'A supported coil between the housing floor and stem seat shortens by 2.4 mm when the button goes down. This motion is prescribed; spring force is not modeled.', [0, 0, 0], valve);
  const spring = kit.spring(point([0, 147.25, 0]), 2.7 * MM, 9 * MM, 6, springPart, .25 * MM);

  const cap = part('cap', 'Cutaway actuator cap', 'The hollow cap carries the stem socket, elbow and nozzle. A front cutaway reveals those passages; the casing itself is not the fluid conduit.', [0, 0, 0], actuator);
  ring(12, 13, 8.5, [0, 176.25, 0], 'clay', cap, .5, Math.PI / 4, 1.5 * Math.PI);
  ring(12, 13, 3.5, [0, 187.25, 0], 'clay', cap, .5, Math.PI / 4, 1.5 * Math.PI);
  // Leave a real opening where the nozzle passes through the cap wall.
  ring(12, 13, 5, [0, 183, 0], 'clay', cap, .5, Math.PI / 4, Math.PI / 4 - .3);
  ring(12, 13, 5, [0, 183, 0], 'clay', cap, .5, Math.PI / 2 + .3, 1.25 * Math.PI - .3);
  cylinder(13, 1, [0, 189.5, 0], 'clay', cap);
  for (const direction of [[1, 0], [-1, 0], [0, -1]]) kit.rod(point([2.8 * direction[0], 175, 2.8 * direction[1]]), point([12 * direction[0], 175, 12 * direction[1]]), .7 * MM, 'clay', cap);
  const channel = part('channel', 'Stem socket and elbow', 'A socket fits over the stem. The 2 mm inner bore rises into a 3 mm-radius elbow and turns toward the nozzle.', [0, 0, 0], actuator);
  const socket = ring(1.8, 2.8, 8, [0, 176, 0], 'cream', channel, .55);
  ring(1, 2.8, .5, [0, 179.75, 0], 'cream', channel, .55);
  const actuatorCurve = new ActuatorCurve(), elbow = mesh(hollowCurve(actuatorCurve, 1, 1.4, 100), 'cream', channel, .5);
  const nozzle = part('nozzle', 'Tapered nozzle insert', 'The connected bore narrows to a 0.45 mm exit. The assigned discharge law is a single-phase approximation; internal flashing and droplet sizes are not predicted.', [0, 0, 0], actuator);
  const insert = mesh(lathe([[1, -2.5], [2.5, -2.5], [2.5, 2.5], [.225, 2.5], [.225, 1], [1, -2.5]]), 'ink', nozzle);
  insert.rotation.z = -Math.PI / 2;insert.position.set(...point([12.5, 183, 0]));

  const liquidPart = part('liquid', 'Liquid inventory and surface', 'The liquid level follows the conserved volume. Enlarged flow markers are teaching symbols, not simulated droplet sizes.', [0, 0, 0], holder);liquidPart.userData.explosionExcluded = true;
  const liquid = mesh(new THREE.BufferGeometry(), 'gold', liquidPart, .24);
  const gas = part('gas', 'Gas headspace', 'Gas presses on the liquid. These markers locate the headspace; they do not count molecules or predict collision trajectories.', [0, 0, 0], holder);gas.userData.explosionExcluded = true;
  const gasDots = Array.from({length: 24}, () => kit.sphere(.4 * MM, [0, 0, 0], 'ink', gas));
  const gasMaterial = gasDots[0].material.clone();gasDots.forEach(dot => {dot.material = gasMaterial;});
  const flow = part('flow', 'Connected flow markers', 'Schematic markers show the connected dip-tube, chamber, open stem-port and nozzle route. They stop when the valve closes; transit speed is illustrative.', [0, 0, 0], holder);flow.userData.explosionExcluded = true;
  const flowDots = Array.from({length: 45}, () => kit.sphere(.12 * MM, [0, 0, 0], 'blue', flow));
  const spray = part('spray', 'Discharge markers', 'An enlarged indication of liquid or gas leaving the outlet. This diagram does not solve atomization, droplet size, cone angle or flash fraction.', [0, 0, 0], holder);spray.userData.explosionExcluded = true;
  const sprayDots = Array.from({length: 36}, () => kit.sphere(.7 * MM, [0, 0, 0], 'gold', spray));
  const sprayMaterial = sprayDots[0].material.clone();sprayDots.forEach(dot => {dot.material = sprayMaterial;});

  const pressureChart = part('pressure-chart', 'Pressure during the trial', 'Pressure above room across the selected 180-second valve program. Closing the valve stops withdrawal while room heat can still change pressure.', point([350, 100, 0]), system);
  const temperatureChart = part('temperature-chart', 'Fresh-charge pressure and temperature', 'Two sealed fresh charges compared at each temperature. The marker identifies the selected initial condition, not a partly emptied can.', point([350, 100, 0]), system);
  const charts = [pressureChart, temperatureChart];
  for (const [chart, id, map, title, span] of [[pressureChart, 'pressure-chart', pressurePoint, 'Pressure during the trial', 180], [temperatureChart, 'temperature-chart', temperaturePoint, 'Fresh sealed charges', 50]]) {
    chart.userData.inspectionOnly = id;chart.userData.explosionExcluded = true;
    box([300, 245, 1], [0, 12, -3], 'cream', chart).material = new THREE.MeshBasicMaterial({color: 0xf8f5e9});
    kit.rod(map(0, 0), map(span, 0), .35 * MM, 'ink', chart);kit.rod(map(0, 0), map(0, 1.2e6), .35 * MM, 'ink', chart);
    chartText(chart, map, {title, size: 11 * MM, x: {min: 0, max: span, title: chart === pressureChart ? 'Time (s)' : 'Initial temperature (°C)', ticks: [[0, '0'], [span / 2, String(span / 2)], [span, String(span)]]}, y: {min: 0, max: 1.2e6, title: 'Pressure above room (bar)', ticks: [[0, '0'], [6e5, '6'], [1.2e6, '12']]}, legend: chart === pressureChart ? [['Selected trial', 0xc14f39]] : [['Liquefied blend', 0xb8862f], ['Nitrogen', 0x2f6690]]});
  }
  const pressureLine = lineObject(361, 0xc14f39, pressureChart), cursor = lineObject(2, 0x374736, pressureChart);
  const liquefiedLine = lineObject(51, 0xb8862f, temperatureChart), nitrogenLine = lineObject(51, 0x2f6690, temperatureChart), temperatureDot = kit.sphere(2 * MM, [0, 0, 0], 'clay', temperatureChart);
  for (let i = 0; i <= 50; i++) for (const [propellant, line] of [[0, liquefiedLine], [1, nitrogenLine]]) line.geometry.attributes.position.array.set(temperaturePoint(i, aerosolEquilibrium(aerosolInitialAmounts({propellant}), i + 273.15).P - AEROSOL.atmosphere), i * 3);
  for (const line of [liquefiedLine, nitrogenLine]) line.geometry.computeBoundingSphere();

  const specs = {
    propellant: ['Propellant', PROPELLANT_OPTIONS, '', 'Compare liquefied propellants with compressed nitrogen. Every changed setting starts a fresh trial.'],
    temperature: ['Initial can and room temperature', null, '°C', 'A simulated temperature comparison. Do not heat a real aerosol container.'],
    orientation: ['Can position', [{value: 0, label: 'Upright'}, {value: 1, label: 'Upside down'}], '', 'The dip-tube inlet determines whether liquid or gas reaches the valve.'],
    button: ['Button', [{value: 0, label: 'Released throughout'}, {value: 1, label: 'Held down'}, {value: 2, label: 'Release after 10 seconds'}, {value: 3, label: 'Release after 120 seconds'}], '', 'Pausing freezes time; releasing closes the valve. The timed release leaves the can warming without further discharge.'],
  };
  for (const [key, [min, max, step]] of Object.entries(AEROSOL_DOMAINS)) {const [label, options, unit, help] = specs[key];control(key, label, min, max, step, AEROSOL_DEFAULTS[key], unit, help, options, {primary: key === 'propellant'});}
  let clock = 0, lastClock = 0, initialTime = null, preparedSettings = null, key = '', liquidKey = '', disposed = false;
  const result = finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== key) {key = nextKey;clock = initialTime ?? 0;lastClock = 0;const plan = aerosolPlan(values);plan.samples.forEach((s, i) => pressureLine.geometry.attributes.position.array.set(pressurePoint(s.t, s.P - AEROSOL.atmosphere), i * 3));pressureLine.geometry.attributes.position.needsUpdate = true;pressureLine.geometry.computeBoundingSphere();}
    const s = sampleAerosol(values, clock), press = s.down ? VALVE.travel : 0;
    holder.rotation.z = s.upright ? 0 : Math.PI;holder.position.y = s.upright ? 0 : CAN.actuatorTop * MM;
    stem.position.y = actuator.position.y = -press * MM;spring.userData.setLength((9 - press) * MM);
    const level = levelFor(s.V, s.upright), shape = `${s.upright}:${level.toFixed(5)}`;
    if (shape !== liquidKey) {liquidKey = shape;liquid.geometry.dispose();liquid.geometry = lathe(liquidOutline(level, s.upright));}
    shell.material.color.copy(STEEL).lerp(COLD, Math.max(0, Math.min(1, (values.temperature + 273.15 - s.T) / 18)));
    const low = s.upright ? level + 1 : CAN.dome + 2, high = s.upright ? CAN.shoulderTop - 2 : level - 1;
    gasDots.forEach((dot, i) => {const y = low + (high - low) * ((i * .754877666 + .13) % 1), radius = radiusAt(y) * (.25 + .6 * ((i * .569840291) % 1)), angle = -.7 + 1.4 * ((i * .414213562) % 1);dot.position.set(...point([radius * Math.sin(angle), y, radius * Math.cos(angle)]));dot.visible = high > low;dot.material.color.setHex(s.liquefied ? 0xb8862f : 0x2f6690);});
    const moving = s.down && (s.volumeRate > 0 || s.gasRate > 0);
    const chamberPath = new THREE.CurvePath(), chamberPoints = [[0, 146, 0], [0, 147.125, 0], [0, 147.125, 3.9], [0, 165 - press, 3.9], [0, 165 - press, 0], [0, 180 - press, 0]].map(p => new THREE.Vector3(...point(p)));
    for (let i = 1; i < chamberPoints.length; i++) chamberPath.add(new THREE.LineCurve3(chamberPoints[i - 1], chamberPoints[i]));
    flowDots.forEach((dot, i) => {dot.visible = moving;if (!moving) return;const phase = (clock / 4 + i / flowDots.length) % 1;let p;if (phase < .65) p = tubeCurve.getPointAt(1 - phase / .65);else if (phase < .85) p = chamberPath.getPointAt((phase - .65) / .2);else if (phase < .97) {p = actuatorCurve.getPointAt((phase - .85) / .12);p.y -= press * MM;}else p = new THREE.Vector3(...point([10 + (phase - .97) / .03 * 5, 183 - press, 0]));dot.position.copy(p);});
    const strength = s.volumeRate > 0 ? s.massRate / .004 : s.gasRate / .0003;
    sprayDots.forEach((dot, i) => {dot.visible = moving && i < Math.max(1, Math.round(36 * Math.min(1, strength)));const u = (clock / 3 + i / 36) % 1;dot.position.set(...point([15 + 100 * u, 183 - press + Math.sin(i * 2.4) * 15 * u, Math.cos(i * 1.7) * 15 * u]));dot.material.color.setHex(s.volumeRate > 0 ? 0xb8862f : 0x2f6690);});
    cursor.geometry.attributes.position.array.set([...pressurePoint(clock, 0), ...pressurePoint(clock, 1.2e6)]);cursor.geometry.attributes.position.needsUpdate = true;
    temperatureDot.position.set(...temperaturePoint(values.temperature, s.plan.initial.P - AEROSOL.atmosphere));
    const grams = n => fixed(n * 1000, 2), totalOut = s.massOut.reduce((a, b) => a + b, 0), left = s.liquidMass + s.vaporMass, start = s.plan.initial.liquidMass + s.plan.initial.vaporMass;
    const outcome = !s.down ? (clock >= AEROSOL.duration ? 'Trial complete' : 'Valve closed') : s.volumeRate > 0 ? 'Liquid leaves the nozzle' : s.gasRate > 0 ? 'Gas leaves; product stays inside' : 'No pressure-driven discharge';
    return {state: {...s, level, press, totalOut, left, start}, readings: [
      r('Your result', `${outcome} · ${grams(s.sprayedProduct)} g product delivered`, `${fixed(clock, 1)} of 180 seconds. ${s.down ? 'Stem ports open below the gasket.' : 'Gasket seals the stem ports.'}`),
      r('Mass account', `${grams(left)} + ${grams(totalOut)} = ${grams(start)} g`, 'Mass still in the can + mass discharged = original charge. Each chemical species is also conserved.'),
      r('Pressure above room', `${fixed(Math.max(0, s.gauge) / 1e5, 2)} bar`, `${fixed(s.P / 1e5, 2)} bar absolute. Pressure depends on temperature, headspace and changing composition.`),
      r('Liquid and gas space', `${fixed(s.V * 1e6, 1)} / ${fixed(s.gasVolume * 1e6, 1)} mL`, `${s.upright ? 'Upright' : 'Upside down'}: the dip-tube inlet is in ${s.drawsLiquid ? 'liquid' : 'gas'}.`),
      r('Discharge rate', `${fixed(s.massRate * 1000, 3)} g/s liquid · ${fixed(s.gasRate * 1000, 3)} g/s gas`, 'Assigned single-phase outlet approximation. Internal flashing, droplet sizes and spray quality are not calculated.'),
      r('Can temperature', `${fixed(s.T - 273.15, 2)} °C`, `${fixed(s.heat, 2)} W enters from the room. The energy account includes heat transfer and enthalpy leaving with discharged material.`),
      r('Propane fraction', s.liquefied ? `${fixed(100 * s.liquidPropaneFraction, 1)}% liquid · ${fixed(100 * s.vaporPropaneFraction, 1)}% vapor` : 'No propane in the nitrogen charge', 'Mole fractions within the propane/isobutane blend. Preferential evaporation changes the remaining blend.'),
      r('Species discharged', AS.map((species, i) => `${species.name}: ${grams(s.massOut[i])} g`).join(' · '), 'No material respawns or changes chemical identity. The enlarged scene markers show routes, not measured droplets.'),
      r('Valve program', values.button === 0 ? 'Released throughout' : values.button === 2 ? 'Release after 10 seconds' : values.button === 3 ? 'Release after 120 seconds' : 'Held through the trial', 'Play advances time at 6×. Pause freezes the simulation; it does not release the button. A changed setting starts a fresh charge.'),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values);if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null;preparedSettings = null;}return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null;preparedSettings = null;clock = Math.min(AEROSOL.duration, clock + dt * AEROSOL.speed);}return render();};
  result.animate = time => {const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0;if (Number.isFinite(time)) lastClock = time;return result.advance(dt);};
  result.reset = ({time = 0, settings} = {}) => {preparedSettings = {...(settings ?? result.defaults)};aerosolPlan(preparedSettings);if (!Number.isFinite(time) || time < 0 || time > AEROSOL.duration) throw new RangeError('Invalid aerosol checkpoint');initialTime = time;key = '';clock = lastClock = 0;return render(preparedSettings);};
  result.replayState = () => ({time: 0, settings: result.getState().values});
  const inspect = (label, id, view = 'front', isolate = false) => ({label, part: id, view, isolate, replay: false, run: () => render()});
  result.actions = [inspect('Inspect: complete can', 'system'), inspect('Inspect: spring-return valve', 'valve'), inspect('Inspect: valve seal', 'seal-contact'), inspect('Inspect: stem ports', 'stem', 'front', true), inspect('Inspect: sealing gasket', 'gasket', 'front', true), inspect('Inspect: dip-tube inlet', 'dip-tube'), inspect('Inspect: actuator channels', 'actuator'), inspect('Inspect: nozzle bore', 'nozzle', 'front', true), inspect('Compare pressure during the trial', 'pressure-chart', 'front', true), inspect('Compare fresh-charge temperatures', 'temperature-chart', 'front', true)];
  result.playback = {label: 'Run the valve program', description: 'Three simulated minutes at 6×. Experiments open at named checkpoints. Pause freezes time; the Button control determines valve release.', stepLabel: 'Advance five seconds', advance: result.advance, step: () => result.advance(5 / AEROSOL.speed), complete: () => clock >= AEROSOL.duration, blocked: () => false};
  result.initialPart = result.autoFramePart = 'system';result.initialView = 'front';result.frameVisibleOnly = true;result.framePadding = .68;result.selectionOutline = false;result.transparentBackground = true;
  result.viewDirections = {front: [.35, .18, 3], iso: [1.4, .6, 2.7], back: [0, .1, -3], side: [3, .2, 0]};
  result.partViewDirections = {'pressure-chart': {front: [0, 0, 3]}, 'temperature-chart': {front: [0, 0, 3]}, 'seal-contact': {front: [.2, -.16, 3]}, nozzle: {front: [3, .3, .5]}};
  result.thumbnailOmit = [...charts, sealContact, flow, spray, gas];
  for (const item of result.parts) {item.maxZoom = 600;item.framePadding = item.id.endsWith('chart') ? .58 : .68;}
  result.topology = {system, holder, container, valve, actuator, can, shell, rim, tube, tubeCurve, dipTube, cup, cupMesh, housing, housingWall, housingBase, gasket, gasketMesh, sealContact, stem, stemWall, stemPlug, springSeat, springPart, spring, cap, channel, socket, actuatorCurve, elbow, nozzle, insert, liquidPart, liquid, gas, gasDots, flow, flowDots, spray, sprayDots, pressureChart, temperatureChart, pressureLine, cursor, liquefiedLine, nitrogenLine, temperatureDot, MM};
  const dispose = result.dispose;result.dispose = () => {if (disposed) return;disposed = true;dispose();};return result;
}

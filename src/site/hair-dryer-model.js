import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, solidArrow, textLabel} from './scene-kit.js';
import {wireColor} from './element-scene.js';
import {dryerPlan, dryerAt, resistanceAt, DRYER_DEFAULTS, DRYER_DOMAINS, DRYER_WIRE, DRYER_AIR, DRYER_THERMAL as THERMAL, BLOCKED, DECLARED} from './element-physics.js';

export const MM = 0.007;
export const DRYER = Object.freeze({origin: Object.freeze([-0.6, 0.35, 0]), barrel: Object.freeze([-100, 100]), radius: 39, motorX: -76, fanX: -47, fanRadius: 32, blades: 7, coilStart: -8, coilEnd: 82, coilRadius: 23, drawnWireRadius: 0.6, hairX: 225});
export const CHART = Object.freeze({x: -1.23, y: -1.23, w: 2.18, h: 0.43, temperature: Object.freeze([0, 250])});
export const COLORS = Object.freeze({shell: 0xe4e4d5, edge: 0x374736, motor: 0xa8b9b3, insulation: 0xe4c88a, cool: 0x83b4c1, warm: 0xd87c4f, hair: 0x72503b, wet: 0x473d32, water: 0x5b9bbb, live: 0xb96048, neutral: 0x587fa1, gold: 0xe3b45e});
export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp(celsius / CHART.temperature[1]) * CHART.h;
export const airColor = celsius => new THREE.Color(COLORS.cool).lerp(new THREE.Color(COLORS.warm), clamp((celsius - 20) / 90));

export class DryerWirePath extends THREE.Curve {
  constructor() { super(); this.turns = Math.sqrt((DRYER_WIRE.length * 1000) ** 2 - (DRYER.coilEnd - DRYER.coilStart) ** 2) / (2 * Math.PI * DRYER.coilRadius); }
  getPoint(t, target = new THREE.Vector3()) {
    const phase = 2 * Math.PI * this.turns * t;
    return target.set((DRYER.coilStart + t * (DRYER.coilEnd - DRYER.coilStart)) * MM, DRYER.coilRadius * Math.cos(phase) * MM, DRYER.coilRadius * Math.sin(phase) * MM);
  }
}

export function createHairDryerModel() {
  const kit = houseModel('Hair dryer'), {part, box, cylinder, sphere, rod, tube, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const system = part('system', 'Hair dryer, cut open', 'A motor turns an axial fan. Air passes the insulated supports and resistance wire, then reaches a small wet test lock. Evaporation removes surface water. A separate heated bimetal switch can interrupt the heater circuit. Press Play to begin.');
  const point = (x, y, z = 0) => [x * MM, y * MM, z * MM];
  const material = (color, opacity = 1) => new THREE.MeshStandardMaterial({color, roughness: 0.6, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity === 1});
  const mesh = (geometry, color, parent, opacity = 1) => { const object = new THREE.Mesh(geometry, material(color, opacity)); parent.add(object); return object; };
  const label = (parent, text, position, width = 0.7) => textLabel(parent, text, {height: 0.044, width, position});

  const body = part('body', 'Barrel, grip and grilles', 'The rear grille admits air; the barrel guides it past the heater and through the front outlet. The near half of the shell is cut away. The grip carries the switch. Dimensions and wiring positions are illustrative.', DRYER.origin, system);
  const shell = mesh(new THREE.CylinderGeometry(39 * MM, 39 * MM, 200 * MM, 48, 1, true, Math.PI / 2, Math.PI), COLORS.shell, body); shell.rotation.z = -Math.PI / 2;
  const innerWall = mesh(new THREE.CylinderGeometry(37 * MM, 37 * MM, 200 * MM, 48, 1, true, Math.PI / 2, Math.PI), 0xcbd3c4, body); innerWall.rotation.z = -Math.PI / 2;
  const cutEdges = [-1, 1].map(sign => rod(point(-100, sign * 38), point(100, sign * 38), 1.8 * MM, COLORS.edge, body));
  const nozzle = mesh(new THREE.CylinderGeometry(27 * MM, 37 * MM, 30 * MM, 48, 1, true, Math.PI / 2, Math.PI), COLORS.motor, body); nozzle.rotation.z = -Math.PI / 2; nozzle.position.x = 115 * MM;
  const grille = [];
  for (const [x, radius] of [[-102, 36], [132, 25]]) {
    for (const offset of [-20, -10, 0, 10, 20]) {
      const reach = Math.sqrt(radius ** 2 - offset ** 2);
      grille.push(rod(point(x, offset, -reach), point(x, offset, reach), 0.7 * MM, COLORS.edge, body));
      grille.push(rod(point(x, -reach, offset), point(x, reach, offset), 0.7 * MM, COLORS.edge, body));
    }
  }
  const gripShape = new THREE.Shape(); gripShape.moveTo(-68 * MM, -38 * MM); gripShape.lineTo(-61 * MM, -140 * MM); gripShape.lineTo(-22 * MM, -140 * MM); gripShape.lineTo(-26 * MM, -38 * MM); gripShape.closePath();
  const grip = mesh(new THREE.ExtrudeGeometry(gripShape, {depth: 26 * MM, bevelEnabled: false}), COLORS.shell, body); grip.position.z = -13 * MM;
  const obstruction = mesh(new THREE.CircleGeometry(38 * MM, 48), COLORS.live, body, 0.75); obstruction.rotation.y = -Math.PI / 2; obstruction.position.x = -105 * MM;

  const motor = part('motor', 'Motor and shaft', 'The motor drives the fan through this shaft. Fan speed and heater voltage are controlled independently in this schematic. Motor losses and control electronics are omitted from the heater energy calculation.', DRYER.origin, system);
  const motorBody = cylinder(12 * MM, 28 * MM, point(DRYER.motorX, 0), COLORS.motor, motor); motorBody.rotation.z = -Math.PI / 2;
  const shaft = rod(point(-80, 0), point(-42, 0), 2.2 * MM, COLORS.edge, motor);
  for (const y of [-1, 1]) rod(point(-76, y * 12), point(-76, y * 36), 1.8 * MM, COLORS.edge, motor);

  const fanPart = part('fan', 'Axial fan', 'Pitched blades turn about the shaft and drive air along the barrel. Rotation is slowed for viewing. Covering the inlet stops through-flow in this model while the independently powered motor still turns.', DRYER.origin, system);
  const rotor = new THREE.Group(); rotor.position.x = DRYER.fanX * MM; fanPart.add(rotor);
  const hub = cylinder(6 * MM, 8 * MM, [0, 0, 0], COLORS.edge, rotor); hub.rotation.z = -Math.PI / 2;
  const blades = Array.from({length: DRYER.blades}, (_, i) => {
    const pivot = new THREE.Group(); pivot.rotation.x = i * 2 * Math.PI / DRYER.blades; rotor.add(pivot);
    const blade = box(point(2.5, 24, 13), point(0, 18), COLORS.motor, pivot); blade.rotation.y = 0.55; return blade;
  });

  const insulation = part('insulation', 'Mica supports', 'Two crossed insulating sheets support the bare resistance coil while leaving open passages for air. They keep the intended electrical path in the wire. Their thermal mass is omitted here.', DRYER.origin, system);
  const supports = [box(point(92, 45.6, 1.6), point(37, 0), COLORS.insulation, insulation), box(point(92, 1.6, 45.6), point(37, 0), COLORS.insulation, insulation)];
  const element = part('element', 'Resistance coil', 'A 3.05 m nickel chromium wire is wound around the crossed supports. Its calculated resistance and heat capacity use a 0.4 mm diameter. The drawn diameter is enlarged three times for visibility. Heat passes to moving air, the sensor and the surroundings.', DRYER.origin, system);
  const wirePath = new DryerWirePath();
  const coil = mesh(new THREE.TubeGeometry(wirePath, Math.ceil(wirePath.turns * 32), DRYER.drawnWireRadius * MM, 6, false), COLORS.edge, element);
  const wireWord = label(element, '', point(32, 51, 12), 0.75);

  const cutout = part('cutout', 'Bimetal cutout', 'Heat from the nearby wire warms the sensor, supported on an insulating mount. Its two metals expand differently. In this illustrative switch the contacts snap open at 120 °C and close after cooling to 90 °C. The heater branch opens; the motor branch remains powered. Real appliances can have additional one-use protection.', DRYER.origin, system);
  const cutBase = box(point(27, 5, 18), point(88, 40, 2), COLORS.insulation, cutout);
  const contactA = box(point(3, 5, 7), point(76, 45, 7), COLORS.live, cutout);
  const contactB = box(point(3, 5, 7), point(99, 45, 7), COLORS.live, cutout);
  const cutPivot = new THREE.Group(); cutPivot.position.set(...point(76, 47.5, 7)); cutout.add(cutPivot);
  const stripLayers = [box(point(23, 1, 7), point(11.5, 0.5), COLORS.gold, cutPivot), box(point(23, 1, 7), point(11.5, 1.5), COLORS.motor, cutPivot)];
  const sensorMount = rod(point(80, 22.8, 0), point(88, 37.5, 2), 2 * MM, COLORS.insulation, cutout);
  const sensorWord = label(cutout, '', point(100, 65, 8), 0.83);

  const circuit = part('circuit', 'Switch and current paths', 'The main switch supplies parallel motor and heater branches. Heater voltage represents an independently controlled effective AC voltage. The bimetal contacts are in series with the coil. These paths explain switching; they omit controller electronics, motor losses and any secondary fuse.', DRYER.origin, system);
  const supply = sphere(9 * MM, point(-118, -144, 4), COLORS.neutral, circuit);
  label(circuit, '~', point(-118, -144, 14), 0.09);
  const mainPivot = new THREE.Group(); mainPivot.position.set(...point(-58, -66, 20)); circuit.add(mainPivot);
  const mainBlade = box(point(17, 2.5, 4), point(8.5, 0), COLORS.live, mainPivot);
  const mainContacts = [-58, -41].map(x => box(point(3, 4, 7), point(x, -68, 20), COLORS.live, circuit));
  const leads = [], addLead = (points, color) => { const lead = tube(points.map(p => point(...p)), 0.75 * MM, color, circuit); leads.push(lead); return lead; };
  addLead([[-118, -144, 4], [-80, -148, 18], [-58, -135, 20], [-58, -66, 20]], COLORS.live);
  addLead([[-41, -66, 20], [-30, -53, 23], [-70, -20, 15], [-82, -7, 10]], COLORS.live);
  addLead([[-41, -66, 20], [105, -58, 24], [110, 43, 10], [99, 43, 7]], COLORS.live);
  const start = wirePath.getPoint(0).multiplyScalar(1 / MM).toArray(), end = wirePath.getPoint(1).multiplyScalar(1 / MM).toArray();
  addLead([[76, 43, 7], [65, 30, 27], [-8, 30, 27], start], COLORS.live);
  addLead([end, [86, -32, -22], [-40, -48, -18], [-76, -144, -12], [-118, -144, 4]], COLORS.neutral);
  addLead([[-82, 7, -10], [-86, -28, -18], [-40, -48, -18]], COLORS.neutral);

  const air = part('air', 'Air and heat flow', 'Air enters behind the motor and fan, crosses the exposed coil, and leaves toward the wet lock. Marker color follows the calculated stream temperature. A blocked inlet has no through-flow even though the fan turns. Markers and motor motion are slowed cues, not individual air molecules.', DRYER.origin, system);
  const marks = Array.from({length: 24}, () => mesh(new THREE.SphereGeometry(1.6 * MM, 8, 6), COLORS.cool, air));
  const airArrows = [-130, 145].map(x => { const arrow = solidArrow(kit, COLORS.cool, air, 0.005); arrow.position.set(...point(x, -26, 23)); arrow.userData.setDirection(new THREE.Vector3(1, 0, 0)); return arrow; });
  const airWord = label(air, '', point(151, -49, 23), 0.61);

  const hairPart = part('hair', 'Wet test lock', 'This small lock begins with 0.35 g of surface water. Warm moving air supplies energy for evaporation and carries vapor away. Blue water markers shrink with remaining mass; vapor markers are a cue for invisible gas. This illustrative sample is not a full head of hair or a drying-time prediction.', DRYER.origin, system);
  const hairStand = box(point(6, 110, 6), point(246, -15, -5), COLORS.motor, hairPart);
  const hairClamp = box(point(29, 5, 16), point(234, 40, 0), COLORS.edge, hairPart);
  box(point(37, 5, 18), point(231, -72, -5), COLORS.edge, hairPart);
  const lock = new THREE.Group(); lock.position.set(...point(DRYER.hairX, 40)); hairPart.add(lock);
  const strands = Array.from({length: 11}, (_, i) => {
    const x = (i - 5) * 0.8, z = (i % 3 - 1) * 3;
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[x, 0, z], [x - 4 + i % 3, -25, z + 2], [x + 2 + i % 2, -52, z - 2], [x - 2 + i % 3, -79, z + 1]].map(p => new THREE.Vector3(...point(...p)))), 24, 0.55 * MM, 5, false), COLORS.wet, lock);
  });
  const droplets = Array.from({length: 9}, (_, i) => {
    const drop = mesh(new THREE.SphereGeometry(2.3 * MM, 12, 8), COLORS.water, lock, 0.8); drop.position.set(...point((i % 3 - 1) * 2, -8 - i * 7.5, 6)); return drop;
  });
  const vaporDots = Array.from({length: 12}, () => mesh(new THREE.SphereGeometry(1.2 * MM, 8, 6), COLORS.water, hairPart, 0.75));
  const hairWord = label(hairPart, '', point(224, 62, 12), 0.7);

  const chartPart = part('chart', 'Elapsed temperatures', 'The outlet-air and test-lock temperatures are drawn only up to the elapsed time. Once surface water is gone, evaporative cooling stops and the lock can warm toward the air temperature. The chart is a separate display, not part of the appliance.', [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.edge, chartPart);
  fillLine(chartFrame, [[CHART.x, CHART.y, 0], [CHART.x + CHART.w, CHART.y, 0], [CHART.x + CHART.w, CHART.y + CHART.h, 0], [CHART.x, CHART.y + CHART.h, 0], [CHART.x, CHART.y, 0]]);
  chartText(chartPart, (share, temperature) => [CHART.x + share * CHART.w, chartY(temperature), 0], {size: 0.034, x: {min: 0, max: 1, title: 'Elapsed seconds', ticks: [[0, '0'], [1, '30']]}, y: {min: 0, max: 250, ticks: [[0, '0 °C'], [125, '125 °C'], [250, '250 °C']]}});
  textLabel(chartPart, 'Outlet air', {height: 0.044, width: 0.5, position: [CHART.x + CHART.w * 0.36, CHART.y + CHART.h + 0.06, 0.005], color: '#b4512a'});
  textLabel(chartPart, 'Test lock', {height: 0.044, width: 0.5, position: [CHART.x + CHART.w * 0.66, CHART.y + CHART.h + 0.06, 0.005], color: '#72503b'});
  const curves = [{key: 'outlet', line: lineObject(DECLARED.samples + 1, COLORS.warm, chartPart)}, {key: 'hair', line: lineObject(DECLARED.samples + 1, COLORS.hair, chartPart)}];

  const d = DRYER_DEFAULTS, D = DRYER_DOMAINS;
  control('volts', 'Heater voltage', ...D.volts, d.volts, 'V', 'Effective voltage across this same coil while its contacts are closed. The fan is controlled separately. Zero gives a cool-air trial; this is not advice for connecting an appliance to a different supply.');
  control('airflow', 'Fan airflow', ...D.airflow, d.airflow, 'L/s', 'Inlet volume flow once the fan reaches speed, when the grille is clear. More moving air shares the heater output and changes heat and vapor transfer at the test lock.');
  control('room', 'Room temperature', ...D.room, d.room, '°C', 'Initial air, coil, sensor and wet-lock temperature. The room remains at this temperature and 50% relative humidity.');
  control('blocked', 'The inlet', ...D.blocked, d.blocked, '', 'Compare clear airflow with a blocked inlet in this on-screen model. Never block a real dryer grille. A real dryer that overheats should be unplugged and allowed to cool according to its manual.', BLOCKED);

  const result = finish(values => {
    const plan = dryerPlan(values), now = dryerAt(plan, clock);
    const fanIntegral = now.t < THERMAL.spinUp ? now.t ** 2 / (2 * THERMAL.spinUp) : now.t - THERMAL.spinUp / 2;
    rotor.rotation.x = -fanIntegral * values.airflow * 0.16;
    obstruction.visible = plan.blocked;
    coil.material.color.copy(wireColor(now.celsius));
    cutPivot.rotation.z = now.closed ? 0 : 0.38;
    mainPivot.rotation.z = clock > 0 ? 0 : -0.45;
    wireWord.userData.setText(`Wire ${fixed(now.celsius, 0)} °C`);
    sensorWord.userData.setText(`${fixed(now.sensor, 0)} °C · ${now.closed ? 'closed' : 'open'}`);
    const airDistance = fanIntegral * values.airflow * 0.018;
    marks.forEach((mark, i) => {
      const phase = (airDistance + i / marks.length) % 1, x = -132 + phase * 348;
      mark.position.set(...point(x, i % 2 ? 18 : -18, i % 3 ? 12 : -12));
      const fraction = clamp((x - DRYER.coilStart) / (DRYER.coilEnd - DRYER.coilStart));
      const localAir = values.room + (now.celsius - values.room) * (now.massFlow > 0 ? -Math.expm1(-now.conductance * fraction / (now.massFlow * DRYER_AIR.heat)) : 0);
      mark.material.color.copy(airColor(localAir)); mark.visible = now.flow > 0;
    });
    for (const [i, arrow] of airArrows.entries()) {
      arrow.userData.setLength(now.flow > 0 ? 0.08 + now.flow / D.airflow[1] * 0.13 : 0);
      arrow.traverse(object => { if (object.material) object.material.color.copy(airColor(i ? now.outlet : values.room)); });
    }
    airWord.userData.setText(now.flow > 0 ? `${fixed(now.outlet, 1)} °C air` : 'No air stream');
    const waterShare = clamp(now.water / THERMAL.hairWater);
    lock.rotation.z = now.flow > 0 ? -0.07 * now.flow / D.airflow[1] * (0.7 + 0.3 * Math.sin(clock * 4)) : 0;
    for (const strand of strands) strand.material.color.setHex(waterShare > 0.1 ? COLORS.wet : COLORS.hair);
    for (const drop of droplets) { drop.visible = waterShare > 0; drop.scale.setScalar(Math.cbrt(waterShare)); }
    vaporDots.forEach((dot, i) => {
      const phase = (clock * 0.8 + i / vaporDots.length) % 1;
      dot.position.set(...point(DRYER.hairX + 8 + 30 * phase, 28 - i * 5 + 8 * phase, 9));
      dot.visible = now.evaporation > 0; dot.material.opacity = 0.7 * (1 - phase);
    });
    hairWord.userData.setText(now.dry ? 'Surface water gone' : `${fixed(now.water * 1000, 2)} g water`);
    for (const {key, line} of curves) {
      const shown = plan.chart.filter(sample => sample.t < now.t);
      fillLine(line, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample[key]), 0.003]), [chartX(plan, now.t), chartY(now[key]), 0.003]] : []);
    }
    const events = plan.events.filter(event => event.t <= now.t), firstOpen = events.find(event => !event.closed);
    const status = clock === 0 ? 'Ready · main switch open; press Play to dry the wet test lock'
      : plan.blocked ? firstOpen ? `No through-flow · cutout first opened at ${fixed(firstOpen.t, 2)} s; water remains on the lock` : 'Blocked model · fan turns without through-flow; sensor is warming'
      : now.dry ? `Surface water gone at ${fixed(plan.driedAt, 1)} s · the dry lock is still warming`
      : now.done ? `30 s complete · ${fixed(now.evaporated * 1000, 2)} g evaporated; ${fixed(now.water * 1000, 2)} g remains`
      : `${values.volts === 0 ? 'Cool air' : 'Drying'} · ${fixed(now.evaporated * 1000, 2)} g evaporated after ${fixed(now.t, 1)} s`;
    return {state: {...plan, now, clock}, readings: [
      r('Your result', status),
      r('Water remaining', `${fixed(now.water * 1000, 3)} g`, 'The test lock begins with 0.350 g of surface water. Its blue markers shrink with remaining water volume. Bound water inside real hair is not modeled.'),
      r('Heater circuit', `${now.on ? 'On' : 'Off'} · ${fixed(now.power, 0)} W`, `${fixed(now.current, 2)} A through ${fixed(resistanceAt(plan.wire, now.celsius), 2)} Ω. Zero heater voltage leaves the motor branch running; an open bimetal contact interrupts the heater.`),
      r('Air at the nozzle', now.flow > 0 ? `${fixed(now.outlet, 1)} °C` : 'No stream', `${fixed(now.flow, 1)} L/s at the inlet; ${fixed(now.massFlow * 1000, 1)} g/s. Heat transferred to the stream equals mass flow times air heat capacity times its temperature rise.`),
      r('Wire and sensor', `${fixed(now.celsius, 0)} °C / ${fixed(now.sensor, 1)} °C`, 'Both store heat. The sensor is thermally coupled to the wire and cooled by inlet air. It can keep warming briefly after the heater contacts open.'),
      r('Thermal cutout', now.closed ? 'Closed' : 'Open', `The illustrated bimetal opens at 120 °C and closes at 90 °C. ${firstOpen ? `${events.length} contact changes have occurred.` : 'No opening has occurred.'} This model omits any secondary thermal fuse and does not establish safe blocked operation.`),
      r('Test-lock temperature', `${fixed(now.hair, 1)} °C`, 'Evaporation takes energy from the wet lock, so it can be cooler than the jet. Once its surface water is gone, that cooling stops. A fixed 50% room humidity is assumed.'),
      r('Evaporated water', `${fixed(now.evaporated * 1000, 3)} g`, `${fixed(now.evaporationEnergy, 0)} J used as latent heat, approximated as 2.43 MJ/kg. Vapor-pressure difference and a declared transfer coefficient set the rate; water need not boil.`),
      r('Heater energy supplied', `${fixed(now.inputEnergy / 1000, 2)} kJ`, `${fixed(now.airEnergy / 1000, 2)} kJ transferred to the air; ${fixed((now.storedEnergy + now.sensorEnergy) / 1000, 2)} kJ stored in wire and sensor; ${fixed(now.ambientEnergy / 1000, 2)} kJ to surroundings. Motor power is omitted.`),
    ]};
  });
  const render = result.update;
  result.update = next => { const before = result.getState().values, readings = render(next); if (Object.keys(before).some(key => result.getState().values[key] !== before[key])) { clock = 0; lastClock = 0; return render(); } return readings; };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) { const next = clock + dt; clock = next >= THERMAL.run - 1e-9 ? THERMAL.run : next; } return render(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the coil', part: 'element', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the motor and fan', part: 'fan', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the cutout', part: 'cutout', view: 'front', replay: false, run: () => render()},
    {label: 'Inspect: the wet lock', part: 'hair', view: 'front', replay: false, run: () => render()},
  ];
  result.parts.find(p => p.id === 'cutout').inspectionView = 'front';
  result.parts.find(p => p.id === 'hair').inspectionView = 'front';
  result.playback = {label: 'Switch it on', description: 'Start the motor and heater together. Follow airflow, heating and evaporation for 30 seconds at real time. Pause freezes time; changing a setting starts a fresh wet-lock trial.', stepLabel: 'Advance 1 s', advance: result.advance, step: () => result.advance(1), complete: () => clock >= THERMAL.run, blocked: () => false};
  result.resultPart = {id: 'hair', label: 'Inspect the test lock', view: 'front', focusOnComplete: false, available: () => clock >= THERMAL.run};
  result.initialPart = 'system'; result.initialView = 'iso'; result.frameVisibleOnly = true; result.framePadding = 0.53; result.selectionOutline = false; result.transparentBackground = true;
  result.topology = {system, body, shell, innerWall, cutEdges, nozzle, grille, grip, obstruction, motor, motorBody, shaft, fanPart, rotor, hub, blades, insulation, supports, element, wirePath, coil, cutout, cutBase, contactA, contactB, cutPivot, stripLayers, sensorMount, circuit, supply, mainPivot, mainBlade, mainContacts, leads, air, marks, airArrows, hairPart, hairStand, hairClamp, lock, strands, droplets, vaporDots, chartPart, chartFrame, curves};
  const dispose = result.dispose; result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

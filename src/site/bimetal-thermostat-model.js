import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, solidArrow, textLabel} from './scene-kit.js';
import {bimetalPlan, bimetalAt, bimetalBeamAt, stripTipAt, BIMETAL_BEAM, BIMETAL_DEFAULTS, BIMETAL_DOMAINS, DECLARED} from './thermostat-physics.js';

export const MM = 0.013;
export const BEND_TIMES = 100;
export const THICKNESS_TIMES = 3;
export const STRIP = Object.freeze({origin: Object.freeze([-0.76, 0.38, 0]), root: Object.freeze([-25, 0]), length: 50, thickness: 0.6, width: 6, segments: 40, contactRadius: 2, screwX: 38});
export const ROOM = Object.freeze({origin: Object.freeze([0.66, 0.38, -0.65]), width: 1.05, height: 0.96, depth: 0.58});
export const CHART = Object.freeze({x: -1.32, y: -1.07, w: 2.52, h: 0.37, temperature: Object.freeze([0, 30])});
export const COLORS = Object.freeze({body: 0xe4e4d5, edge: 0x374736, brass: 0xe3b45e, iron: 0x9baeb2, live: 0xbf6044, neutral: 0x587fa1, magnet: 0x8c688c, insulation: 0xd5bd91, warm: 0xd78453, cool: 0x8ab7c7, set: 0x826596});
export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + celsius / 30 * CHART.h;

function layerGeometry() {
  const geometry = new THREE.BufferGeometry(), indices = [];
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((STRIP.segments + 1) * 12), 3));
  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  for (let i = 0; i < STRIP.segments; i++) {
    const a = i * 4, b = a + 4;
    quad(a, b, b + 1, a + 1); quad(a + 2, a + 3, b + 3, b + 2);
    quad(a, a + 2, b + 2, b); quad(a + 1, b + 1, b + 3, a + 3);
  }
  quad(0, 1, 3, 2); const last = STRIP.segments * 4; quad(last, last + 2, last + 3, last + 1);
  geometry.setIndex(indices); return geometry;
}

export function createBimetalThermostatModel() {
  const kit = houseModel('Bimetal thermostat'), {part, box, cylinder, sphere, rod, tube, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const point = (x, y, z = 0) => [x * MM, y * MM, z * MM];
  const mesh = (geometry, color, parent) => { const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color, roughness: 0.55, side: THREE.DoubleSide})); parent.add(object); return object; };
  const label = (parent, text, position, width = 0.7) => textLabel(parent, text, {height: 0.046, width, position});
  const system = part('system', 'Thermostat and room', 'A brass and iron strip senses room temperature. Its moving contact switches a resistance heater. A magnet gives different opening and closing temperatures, and the dial moves the contact carriage. The cutaway room shows the result. Press Play to close the main switch.');
  const body = part('body', 'Mounting plate and clamp', 'An insulating plate supports the strip clamp, contact carriage and setting screw. The near cover is removed so the moving parts are visible. The root of the strip stays fixed while its free end bends.', STRIP.origin, system);
  const back = box(point(96, 86, 3), point(0, -7, -11), COLORS.body, body);
  const rails = [-46, 46].map(x => box(point(3, 86, 11), point(x, -7, -5), COLORS.body, body));
  const clampBase = box(point(9, 10, 12), point(-28, 0, -1), COLORS.insulation, body);
  const clampTerminal = box(point(4, 2.8, 7), point(-26, 0), COLORS.live, body);
  label(body, 'Brass + iron', point(-10, 28, 4), 0.65);
  label(body, 'Bend ×100 · thickness ×3', point(-2, 21, 4), 1.03);

  const strip = part('strip', 'Bonded brass and iron', 'The lower brass layer expands more than the upper iron layer. Above the 20 °C flat reference, the free strip curves with brass on the outside; below it, the free bend reverses. Contact force also bends the touching strip. The layers remain bonded. Deflection is enlarged 100 times and thickness three times.', STRIP.origin, system);
  const brass = mesh(layerGeometry(), COLORS.brass, strip), iron = mesh(layerGeometry(), COLORS.iron, strip);
  const layers = [{object: brass, low: -STRIP.thickness * THICKNESS_TIMES / 2, high: 0}, {object: iron, low: 0, high: STRIP.thickness * THICKNESS_TIMES / 2}];

  const contact = part('contact', 'Moving and fixed contacts', 'The silver sphere is attached to the strip tip. It touches the flat pad while the heater circuit is closed. Warming builds an upward force until the magnet releases the strip. Cooling closes the gap again. The flat pad and magnet move together when the setting changes.', STRIP.origin, system);
  const moving = sphere(STRIP.contactRadius * MM, point(25, 0), COLORS.iron, contact);
  const carriage = new THREE.Group(); contact.add(carriage);
  const fixedPad = box(point(8, 2, 8), point(25, -3), COLORS.live, carriage);
  const carrier = box(point(19, 4, 12), point(32, -6), COLORS.insulation, carriage);
  const contactWord = label(contact, '', point(9, 17, 8), 1.04);

  const magnet = part('magnet', 'Magnetic contact retention', 'This visible U-shaped magnet attracts the iron layer across a small gap. It holds the touching contact until the strip can pull free. The model uses a fixed release force and zero-gap recapture; its straight strip and magnetic layout are illustrative, not a calibrated thermostat design.', STRIP.origin, system);
  const magnetCarriage = new THREE.Group(); magnet.add(magnetCarriage);
  const poles = [-8, 8].map(z => box(point(5, 8, 4), point(25, -5, z), COLORS.magnet, magnetCarriage));
  const magnetBase = box(point(5, 3, 20), point(25, -10), COLORS.magnet, magnetCarriage);

  const dial = part('dial', 'Setting screw and dial', 'Turning the thumbwheel rotates this threaded shaft. Its guided carriage moves the fixed contact and magnet vertically. The strip must become warmer to release a higher contact position. The mechanism and screw pitch are illustrative.', STRIP.origin, system);
  const screw = new THREE.Group(); screw.position.x = STRIP.screwX * MM; dial.add(screw);
  const screwShaft = cylinder(1.5 * MM, 68 * MM, point(0, -7), COLORS.iron, screw);
  const threadPoints = Array.from({length: 257}, (_, i) => { const angle = i / 256 * 16 * Math.PI * 2; return new THREE.Vector3(...point(2 * Math.cos(angle), -40 + i / 256 * 65, 2 * Math.sin(angle))); });
  const thread = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(threadPoints), 384, 0.3 * MM, 5, false), COLORS.edge, screw);
  const knob = cylinder(8 * MM, 5 * MM, point(0, -43), COLORS.edge, screw);
  const knobMark = box(point(2, 5.3, 3), point(0, -43, 6), COLORS.brass, screw);
  const settingWord = label(dial, '', point(-13, -32, 7), 0.77);

  const room = part('room', 'Room and thermometer', 'The heater warms one well-mixed room. Its effective heat capacity is 300 kJ per degree and its heat exchange with outdoors is 55 W per degree of difference. The thermometer and room color follow the calculated temperature. This small cutaway uses a separate schematic scale.', ROOM.origin, system);
  const floor = box([ROOM.width, 0.035, ROOM.depth], [0, -ROOM.height / 2, 0], COLORS.body, room);
  const roomBack = box([ROOM.width, ROOM.height, 0.025], [0, 0, -ROOM.depth / 2], COLORS.body, room);
  const roomSide = box([0.025, ROOM.height, ROOM.depth], [-ROOM.width / 2, 0, 0], COLORS.body, room);
  const roomTint = mesh(new THREE.PlaneGeometry(ROOM.width - 0.1, ROOM.height - 0.1), COLORS.cool, room); roomTint.position.set(0, 0, -ROOM.depth / 2 + 0.015);
  const thermometer = new THREE.Group(); thermometer.position.set(0.35, -0.25, 0.18); room.add(thermometer);
  const thermometerTrack = cylinder(0.021, 0.46, [0, 0.23, 0], COLORS.body, thermometer);
  const bulb = sphere(0.033, [0, 0, 0], COLORS.live, thermometer);
  const thermometerFluid = cylinder(0.014, 1, [0, 0, 0.024], COLORS.live, thermometer);
  const roomWord = label(room, '', [0, 0.59, 0.18], 0.95);
  const outsideWord = label(room, '', [0.08, -0.69, 0.18], 1.07);
  const lossArrows = [-0.05, 0.2].map(y => { const arrow = solidArrow(kit, COLORS.cool, room, 0.008); arrow.position.set(0.54, y, 0.08); return arrow; });

  const heater = part('heater', 'Switched resistance heater', 'The connected resistance element supplies the selected power only while both switches are closed. Orange indicates power, not a glowing room heater. This on/off teaching model omits heater heat storage and control electronics; other real heaters can modulate their output.', [-0.04, -0.32, 0.09], room);
  const heaterBase = box([0.5, 0.04, 0.22], [0, -0.08, 0], COLORS.edge, heater);
  const supports = [-0.23, 0.23].map(x => box([0.025, 0.17, 0.2], [x, 0, 0], COLORS.insulation, heater));
  const coilPoints = Array.from({length: 25}, (_, i) => [-0.21 + i / 24 * 0.42, i === 0 || i === 24 ? 0 : i % 2 ? 0.06 : -0.05, 0.07]);
  const heaterCoil = tube(coilPoints, 0.009, COLORS.iron, heater);
  heaterCoil.material = heaterCoil.material.clone();
  const heatArrows = [-0.11, 0.08].map(x => { const arrow = solidArrow(kit, COLORS.warm, heater, 0.008); arrow.position.set(x, 0.08, 0.04); return arrow; });
  const heaterWord = label(heater, '', [0, -0.2, 0.18], 0.85);

  const circuit = part('circuit', 'Main switch and heater circuit', 'Current has a complete route from the supply through the main switch, strip, touching contacts and heater, then back to the supply. Either open switch breaks that route. Moving red markers indicate an energized circuit, not individual electrons or the alternating-current waveform.', [0, 0, 0], system);
  const at = (x, y, z = 0) => new THREE.Vector3(...point(x, y, z)).add(new THREE.Vector3(...STRIP.origin)).toArray();
  const supply = sphere(0.075, at(-38, -55, 4), COLORS.neutral, circuit);
  label(circuit, '~', at(-38, -55, 11), 0.07);
  const mainPivot = new THREE.Group(); mainPivot.position.set(...at(-24, -44, 3)); circuit.add(mainPivot);
  const mainBlade = box(point(16, 2, 3), point(8, 0), COLORS.live, mainPivot);
  const mainContacts = [-24, -8].map(x => box(point(3, 3, 6), at(x, -46, 3), COLORS.live, circuit));
  const leads = [], addLead = (points, color) => { const object = tube(points, 0.008, color, circuit); leads.push(object); return object; };
  addLead([at(-38, -55, 4), at(-24, -55, 3), at(-24, -44, 3)], COLORS.live);
  addLead([at(-8, -44, 3), at(-16, -37, 3), at(-41, -31, 3), at(-41, 0, 0), at(-26, 0, 0)], COLORS.live);
  const padLead = rod(at(29, -3), at(43, -36), 0.008, COLORS.live, circuit);
  const heaterIn = heater.localToWorld(new THREE.Vector3(...coilPoints[0])).toArray();
  const heaterOut = heater.localToWorld(new THREE.Vector3(...coilPoints.at(-1))).toArray();
  const outgoing = [at(43, -36), [-0.06, -0.22, 0.2], [0.27, -0.05, 0.17], heaterIn];
  const returning = [heaterOut, [0.98, -0.15, 0.18], [0.78, -0.39, 0.18], at(-38, -62, 4), at(-38, -55, 4)];
  addLead(outgoing, COLORS.live); addLead(returning, COLORS.neutral);
  const currentPath = new THREE.CatmullRomCurve3(outgoing.map(p => new THREE.Vector3(...p)));
  const currentMarks = Array.from({length: 5}, () => { const mark = sphere(0.018, [0, 0, 0], COLORS.live, circuit); return mark; });
  const switchWord = label(circuit, '', at(-18, -72, 9), 1.08);

  const chart = part('chart', 'Elapsed room temperature', 'Only the elapsed part of the 90-minute trial is drawn. The upper violet line is the opening temperature. The lower line is the closing temperature. Exact switch events are included, so this ideal model has no numerical overshoot.', [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.edge, chart);
  fillLine(chartFrame, [[CHART.x, CHART.y, 0], [CHART.x + CHART.w, CHART.y, 0], [CHART.x + CHART.w, CHART.y + CHART.h, 0], [CHART.x, CHART.y + CHART.h, 0], [CHART.x, CHART.y, 0]]);
  chartText(chart, (share, temperature) => [CHART.x + share * CHART.w, chartY(temperature), 0], {size: 0.034, x: {min: 0, max: 1, title: 'Elapsed minutes', ticks: [[0, '0'], [0.5, '45'], [1, '90']]}, y: {min: 0, max: 30, ticks: [[0, '0 °C'], [15, '15 °C'], [30, '30 °C']]}});
  const thresholds = [lineObject(2, COLORS.set, chart), lineObject(2, COLORS.cool, chart)];
  const curve = lineObject(512, COLORS.live, chart);
  label(chart, 'Room temperature · opening and closing levels', [CHART.x + CHART.w / 2, CHART.y + CHART.h + 0.07, 0.01], 2.0);

  const d = BIMETAL_DEFAULTS, D = BIMETAL_DOMAINS;
  control('setting', 'Temperature setting', ...D.setting, d.setting, '°C', 'Moves the fixed contact and magnet. The heater contacts open at this temperature and close about 0.94 °C lower. Changing any control starts a new trial.');
  control('outdoor', 'Outdoor temperature', ...D.outdoor, d.outdoor, '°C', 'Heat flows toward the cooler side. Cold outdoors increases heat loss; warmer outdoors can heat this room even while its heater is off.');
  control('power', 'Heater power', ...D.power, d.power, 'W', 'Power while both switches are closed. More power reaches the opening temperature sooner. A small heater may be unable to offset the room heat loss.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'Initial room and strip temperature. The contact starts open at or above the setting and closed below it.');

  const result = finish(values => {
    const plan = bimetalPlan(values), now = bimetalAt(plan, clock);
    for (const {object, low, high} of layers) {
      const position = object.geometry.attributes.position;
      for (let i = 0; i <= STRIP.segments; i++) {
        const x = DECLARED.stripLength * i / STRIP.segments, beam = bimetalBeamAt(plan, now, x);
        const angle = Math.atan(beam.slope * BEND_TIMES), normalX = -Math.sin(angle), normalY = Math.cos(angle);
        for (const [j, offset, z] of [[0, low, 3], [1, low, -3], [2, high, 3], [3, high, -3]]) {
          position.setXYZ(i * 4 + j, (STRIP.root[0] + x * 1000 + normalX * offset) * MM, (beam.y * 1000 * BEND_TIMES + normalY * offset) * MM, z * MM);
        }
      }
      position.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
    }
    const tip = bimetalBeamAt(plan, now), postY = plan.tipAtClose * 1000 * BEND_TIMES;
    moving.position.set(...point(25, tip.y * 1000 * BEND_TIMES));
    carriage.position.y = postY * MM; magnetCarriage.position.y = postY * MM;
    screw.rotation.y = -(postY - (stripTipAt(D.setting[0]) - DECLARED.snap) * 1000 * BEND_TIMES) / (65 / 16) * Math.PI * 2;
    settingWord.userData.setText(`Set ${values.setting} °C`);
    contactWord.userData.setText(now.closed ? 'Contacts touching' : 'Contacts open');
    const a = new THREE.Vector3(...at(29, postY - 3)), b = new THREE.Vector3(...at(43, -36));
    padLead.position.copy(a).add(b).multiplyScalar(0.5); padLead.scale.y = a.distanceTo(b) / padLead.geometry.parameters.height;
    padLead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    mainPivot.rotation.z = now.mainOn ? 0 : -0.48;
    switchWord.userData.setText(now.mainOn ? 'Main switch closed' : 'Main switch open');
    heaterCoil.material.color.setHex(now.on ? COLORS.warm : COLORS.iron);
    heaterWord.userData.setText(`${now.power} W · ${now.on ? 'heater on' : 'heater off'}`);
    for (const arrow of heatArrows) arrow.userData.setLength(now.on ? 0.12 + 0.1 * values.power / 3000 : 0);
    currentMarks.forEach((mark, i) => { mark.visible = now.on; currentPath.getPoint((clock / 120 + i / currentMarks.length) % 1, mark.position); });
    const share = clamp(now.celsius / 30), fluidHeight = 0.44 * share;
    thermometerFluid.scale.y = Math.max(1e-6, fluidHeight); thermometerFluid.position.y = fluidHeight / 2;
    roomTint.material.color.setHex(COLORS.cool).lerp(new THREE.Color(COLORS.warm), share);
    roomWord.userData.setText(`Room ${fixed(now.celsius, 1)} °C`);
    outsideWord.userData.setText(`Outside ${values.outdoor} °C · ${now.heatLoss >= 0 ? 'heat leaves' : 'heat enters'}`);
    for (const arrow of lossArrows) {
      arrow.position.x = now.heatLoss >= 0 ? 0.54 : 0.77;
      arrow.userData.setDirection(new THREE.Vector3(now.heatLoss >= 0 ? 1 : -1, 0, 0));
      arrow.userData.setLength(Math.abs(now.heatLoss) > 0.01 ? 0.09 + 0.15 * clamp(Math.abs(now.heatLoss) / 2000) : 0);
    }
    for (const [i, temperature] of [plan.opensAt, plan.closesAt].entries()) fillLine(thresholds[i], [[CHART.x, chartY(temperature), 0.002], [CHART.x + CHART.w, chartY(temperature), 0.002]]);
    const shown = plan.chart.filter(sample => sample.t < now.t);
    fillLine(curve, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0.004]), [chartX(plan, now.t), chartY(now.celsius), 0.004]] : []);
    const outcome = plan.limit === 'insufficientHeat' ? 'Heater cannot reach the opening temperature in this weather'
      : plan.limit === 'noCooling' ? 'Heater cannot cool the room below the warm outdoors'
      : now.switches > 1 ? 'Contacts are regulating through their switching band' : now.closed ? 'Room is warming toward the opening temperature' : 'Room is cooling toward the closing temperature';
    const status = clock === 0 ? 'Ready · main switch open; press Play to begin the room trial'
      : `${now.done ? '90 min complete' : `${fixed(now.t / 60, 1)} min elapsed`} · ${fixed(now.celsius, 2)} °C. ${outcome}.`;
    return {state: {...plan, now, clock}, readings: [
      r('Your result', status),
      r('Room temperature', `${fixed(now.celsius, 2)} °C`, `One illustrative ${DECLARED.roomVolume} m³ room has an effective heat capacity of 300 kJ/K. Air and furnishings share one temperature; sensor lag and cold corners are omitted.`),
      r('Contacts', now.closed ? 'Touching' : 'Open', `A visible magnet retains the iron layer until the free tip would stand 20 µm above the pad. The release load is ${fixed(DECLARED.snap * BIMETAL_BEAM.tipStiffness * 1000, 2)} mN. Cold recapture is idealized at zero gap.`),
      r('Opening / closing', `${fixed(plan.opensAt, 2)} / ${fixed(plan.closesAt, 2)} °C`, `The ${fixed(plan.band, 3)} °C difference is hysteresis. Inside this band the existing contact state is retained. With no earlier history, a new trial starts closed below its setting.`),
      r('Heater circuit', `${now.power} W · ${now.on ? 'on' : 'off'}`, `${now.mainOn ? 'Main switch closed' : 'Main switch open'}. The thermostat contact and main switch are in series with this on/off heater.`),
      r('Heat exchange outdoors', `${fixed(Math.abs(now.heatLoss), 0)} W ${now.heatLoss >= 0 ? 'out' : 'in'}`, `55 W/K times the room-to-outdoor temperature difference. At full heater power the long-run balance would be ${fixed(plan.equilibrium, 1)} °C if its contact never opened.`),
      r('Elapsed switch changes', `${now.switches}`, `${fixed(now.t / 60, 1)} minutes observed. Heater on for ${fixed(now.onTime / 60, 1)} minutes, or ${fixed(now.duty * 100, 1)}% of elapsed time; this includes initial warming or cooling.`),
      r('Energy balance', `${fixed(now.inputEnergy / 1000, 1)} kJ supplied`, `${fixed(now.storedEnergy / 1000, 1)} kJ change stored in the room; ${fixed(now.environmentEnergy / 1000, 1)} kJ net outward heat transfer. A negative outward value means energy entered from outdoors.`),
      r('Movement and scale', `${fixed((stripTipAt(21) - stripTipAt(20)) * 1e6, 1)} µm/K free tip`, 'A 50 × 6 × 0.6 mm strip, with representative brass and iron properties. Deflection ×100, thickness ×3; room and chart have separate schematic scales. Playback runs 120 times faster.'),
    ]};
  });
  const render = result.update;
  result.update = next => { const before = result.getState().values, readings = render(next); if (Object.keys(before).some(key => result.getState().values[key] !== before[key])) { clock = 0; lastClock = 0; return render(); } return readings; };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) { const next = clock + dt * DECLARED.slower; clock = next >= DECLARED.roomRun - 1e-8 ? DECLARED.roomRun : next; } return render(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the strip', part: 'strip', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the contacts', part: 'contact', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the setting dial', part: 'dial', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the room', part: 'room', view: 'front', replay: false, run: () => render()},
  ];
  result.playback = {label: 'Switch the heating on', description: 'Run 90 minutes of room heating in 45 seconds. Pause freezes time. Changing a control starts a new trial.', stepLabel: 'Advance 5 min', advance: result.advance, step: () => result.advance(300 / DECLARED.slower), complete: () => clock >= DECLARED.roomRun, blocked: () => false};
  result.resultPart = {id: 'room', label: 'Inspect the room', view: 'front', focusOnComplete: false, available: () => clock >= DECLARED.roomRun};
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.53; result.selectionOutline = false; result.transparentBackground = true;
  result.catalogParts = result.parts.filter(part => part.id !== 'system');
  result.topology = {system, body, back, rails, clampBase, clampTerminal, strip, layers, brass, iron, contact, moving, carriage, fixedPad, carrier, magnet, magnetCarriage, poles, magnetBase, dial, screw, screwShaft, thread, knob, knobMark, room, floor, roomBack, roomSide, roomTint, thermometer, thermometerTrack, bulb, thermometerFluid, lossArrows, heater, heaterBase, supports, heaterCoil, heatArrows, circuit, supply, mainPivot, mainBlade, mainContacts, leads, padLead, currentMarks, chart, chartFrame, thresholds, curve};
  const dispose = result.dispose; result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

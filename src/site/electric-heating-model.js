import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {wireColor} from './element-scene.js';
import {
  heaterPlan, heaterAt, HEATER_DEFAULTS, HEATER_DOMAINS, HEATER_DIAMETER, REFLECTORS,
  DECLARED, NIKROTHAL,
} from './element-physics.js';

export const MM = 0.002;
export const WIRE_TIMES = 2;
export const HEATER = Object.freeze({
  origin: Object.freeze([-0.35, 0.42, 0]), casing: Object.freeze([600, 260, 150]),
  coilSpan: 460, coilRadius: 7, coilZ: 17.5, guardZ: 85,
});
export const CHART = Object.freeze({x: -1.04, y: -0.65, w: 1.65, h: 0.56, temperature: Object.freeze([0, 1400]), tickEvery: 30});
export const COLORS = Object.freeze({casing: 0xe9e4d8, shell: 0x374736, reflector: 0xc4ccc3, guard: 0x667b72, heat: 0xd56537, air: 0x5784a5, wire: 0x6b6f66});
export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp(celsius / CHART.temperature[1]) * CHART.h;

/** An exact helical centerline; the tube tessellation approximates this curve. */
export class HeaterCoil extends THREE.Curve {
  constructor(length) {
    super();
    this.span = HEATER.coilSpan * MM;
    this.radius = HEATER.coilRadius * MM;
    this.turns = Math.sqrt((length * 1000 * MM) ** 2 - this.span ** 2) / (2 * Math.PI * this.radius);
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * 2 * Math.PI;
    return target.set((t - 0.5) * this.span, Math.sin(a) * this.radius, HEATER.coilZ * MM + Math.cos(a) * this.radius);
  }
}

export function createElectricHeatingModel() {
  const kit = houseModel('Electric heating'), {part, box, rod, cylinder, finish, control} = kit;
  let clock = 0, lastClock = 0, drawnLength = null, disposed = false;
  const system = part('system', 'Electric heater and test tile', 'Close the switch to drive current through the coiled wire. The wire warms, radiates, and heats a separate tile without touching it. The chart records this run only.');
  const body = part('body', 'Case and feet', 'The frame supports the coil, reflector and guard. Its dimensions are illustrative; this is a thermal demonstration, not a construction design.', HEATER.origin, system);
  const [width, height, depth] = HEATER.casing.map(n => n * MM);
  const caseMeshes = [
    box([width, 0.028, depth], [0, -(height - 0.028) / 2, 0], COLORS.casing, body),
    box([width, 0.028, depth], [0, (height - 0.028) / 2, 0], COLORS.casing, body),
    ...[-1, 1].map(sign => box([0.035, height, depth], [sign * (width - 0.035) / 2, 0, 0], COLORS.shell, body)),
    ...[-0.43, 0.43].map(x => box([0.14, 0.06, 0.36], [x, -height / 2 - 0.03, 0], COLORS.shell, body)),
  ];
  const reflector = part('reflector', 'Reflector', 'This curved sheet redirects a chosen share of the radiation forward: 75% when fitted and 35% when absent. These are illustrative shares, not an optical calculation or measured heater performance.', HEATER.origin, system);
  const positions = [];
  for (let i = 0; i < 32; i++) {
    const y0 = -0.21 + 0.42 * i / 32, y1 = -0.21 + 0.42 * (i + 1) / 32;
    const z0 = -0.095 + 0.22 * (y0 / 0.21) ** 2, z1 = -0.095 + 0.22 * (y1 / 0.21) ** 2;
    positions.push(-0.565, y0, z0, 0.565, y0, z0, 0.565, y1, z1, -0.565, y0, z0, 0.565, y1, z1, -0.565, y1, z1);
  }
  const dishGeometry = new THREE.BufferGeometry();
  dishGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  dishGeometry.computeVertexNormals();
  const dish = new THREE.Mesh(dishGeometry, new THREE.MeshStandardMaterial({color: COLORS.reflector, metalness: 0.45, roughness: 0.35, side: THREE.DoubleSide}));
  reflector.add(dish);

  const element = part('element', 'Resistance element', 'Nikrothal 80 wire, 0.4 mm in diameter, wound into a real helix. The length control changes the number of turns and the electrical resistance. Only the wire diameter is drawn twice as large for visibility. Color is a temperature cue, not a computed spectrum.', HEATER.origin, system);
  const coil = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({color: COLORS.wire}));
  element.add(coil);
  const terminals = [-1, 1].map(sign => {
    const insulator = cylinder(0.026, 0.1, [sign * 0.515, 0, HEATER.coilZ * MM], COLORS.casing, element);
    insulator.rotation.z = Math.PI / 2;
    return insulator;
  });
  const endLeads = segmentLines(2, COLORS.wire, element);

  const circuit = part('circuit', 'Supply and switch', 'The supply, switch, coil and return lead make one circuit. Play closes the switch; Pause freezes simulated time and does not switch off the heater. Changing a setting starts a new cold experiment.', [0, 0, 0], system);
  const supply = cylinder(0.075, 0.04, [-1.18, 0.30, 0], COLORS.air, circuit);
  supply.rotation.x = Math.PI / 2;
  textLabel(circuit, '~', {height: 0.075, position: [-1.18, 0.30, 0.025], color: '#ffffff'});
  const connect = (points, color) => points.slice(1).map((point, i) => rod(points[i], point, 0.006, color, circuit));
  const liveLead = connect([[-1.18, 0.37, 0], [-1.18, 0.55, 0], [-1.05, 0.55, 0]], 0xb9634e);
  const switchedLead = connect([[-0.91, 0.55, 0], [-0.85, 0.55, 0.035], [-0.85, 0.42, 0.035]], 0xb9634e);
  const returnLead = connect([[0.15, 0.42, 0.035], [0.30, 0.42, 0.035], [0.30, 0.065, 0.035], [-1.18, 0.065, 0.035], [-1.18, 0.23, 0]], COLORS.air);
  const switchPivot = new THREE.Group(); switchPivot.position.set(-1.05, 0.55, 0); circuit.add(switchPivot);
  const switchBlade = rod([0, 0, 0], [0.14, 0, 0], 0.01, 'gold', switchPivot);
  const switchWord = textLabel(circuit, '', {height: 0.052, width: 0.34, position: [-1.05, 0.78, 0.035]});

  const guard = part('guard', 'Guard', 'Bars stand in front of the coil, leaving air space around the hot wire. A guard can itself become hot and does not make contact with a real heater safe.', HEATER.origin, system);
  const bars = Array.from({length: 11}, (_, i) => rod([-0.55 + i * 0.11, -0.22, HEATER.guardZ * MM], [-0.55 + i * 0.11, 0.22, HEATER.guardZ * MM], 0.003, COLORS.guard, guard));
  for (const y of [-0.22, 0.22]) bars.push(rod([-0.55, y, HEATER.guardZ * MM], [0.55, y, HEATER.guardZ * MM], 0.004, COLORS.guard, guard));
  for (const x of [-0.55, 0.55]) for (const sign of [-1, 1]) bars.push(rod([x, sign * 0.22, HEATER.guardZ * MM], [x, sign * 0.246, 0.15], 0.006, COLORS.guard, guard));

  const tilePart = part('tile', 'Absorbing test tile', 'A separate illustrative tile absorbs 10% of the forward radiation. Its heat capacity is 500 J/K and its heat loss is 1.5 W/K above room temperature. Its temperature follows received energy minus heat loss; it is not a prediction for a particular material.', [0.89, 0.40, 0.62], system);
  const tile = box([0.25, 0.34, 0.04], [0, 0, 0], 0x658fa0, tilePart);
  tile.material = tile.material.clone();
  const stand = box([0.32, 0.03, 0.18], [0, -0.20, 0], COLORS.shell, tilePart);
  const tileWord = textLabel(tilePart, '', {height: 0.058, width: 0.42, position: [0, 0.26, 0.03]});
  textLabel(tilePart, 'Test tile', {height: 0.045, position: [0, -0.28, 0.03]});

  const beamPart = part('beam', 'Heat leaving the element', 'Orange arrows show radiation toward the tile and other surfaces; the blue arrow shows convection to the air. Arrow directions are explanatory paths, not ray tracing. Width follows power on one scale; the tile receives only a tenth of the forward radiation.', [0, 0, 0], system);
  const beamSpecs = [
    {key: 'absorbed', start: [0.17, 0.42, 0.19], end: [0.73, 0.42, 0.60], color: COLORS.heat},
    {key: 'frontOther', start: [-0.39, 0.38, 0.19], end: [-0.39, 0.38, 0.68], color: COLORS.heat},
    {key: 'backward', start: [-0.35, 0.45, -0.16], end: [-0.35, 0.45, -0.55], color: COLORS.heat},
    {key: 'convected', start: [0.04, 0.66, 0], end: [0.04, 0.96, 0], color: COLORS.air},
  ];
  const beams = beamSpecs.map(spec => {
    const arrow = solidArrow(kit, spec.color, beamPart, 0.013);
    const a = new THREE.Vector3(...spec.start), b = new THREE.Vector3(...spec.end);
    arrow.position.copy(a); arrow.userData.setDirection(b.clone().sub(a).normalize()); arrow.userData.setLength(a.distanceTo(b));
    return arrow;
  });
  const heatWord = textLabel(beamPart, '', {height: 0.048, width: 0.50, position: [0.52, 0.14, 0.63]});
  const airWord = textLabel(beamPart, '', {height: 0.044, width: 0.58, position: [0.10, 1.04, 0]});
  const wireWord = textLabel(element, '', {height: 0.051, width: 0.58, position: [0, -0.13, 0.19]});

  const chartPart = part('chart', 'The element warming up', 'Recorded wire temperature during this 120-second experiment. No future curve is shown. The horizontal line marks the manufacturer’s 1,200 °C continuous operating temperature; use depends on actual service conditions.', [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.shell, chartPart), curve = lineObject(DECLARED.samples + 1, COLORS.heat, chartPart);
  fillLine(chartFrame, [[CHART.x, CHART.y, 0], [CHART.x + CHART.w, CHART.y, 0], [CHART.x + CHART.w, CHART.y + CHART.h, 0], [CHART.x, CHART.y + CHART.h, 0], [CHART.x, CHART.y, 0]]);
  const limitLine = segmentLines(1, 0x94638e, chartPart);
  fillLine(limitLine, [[CHART.x, chartY(NIKROTHAL.continuous), 0], [CHART.x + CHART.w, chartY(NIKROTHAL.continuous), 0]]);
  chartText(chartPart, (seconds, temperature) => [CHART.x + seconds / DECLARED.heaterRun * CHART.w, chartY(temperature), 0], {
    size: 0.043,
    x: {min: 0, max: DECLARED.heaterRun, title: 'Simulated seconds', ticks: [0, 30, 60, 90, 120].map(n => [n, String(n)])},
    y: {min: 0, max: CHART.temperature[1], ticks: [0, 400, 800, 1200].map(n => [n, `${n} °C`])},
  });
  textLabel(chartPart, 'Wire temperature', {height: 0.051, position: [CHART.x + CHART.w / 2, CHART.y + CHART.h + 0.07, 0]});
  textLabel(chartPart, '1,200 °C\ndatasheet limit', {height: 0.075, width: 0.40, position: [CHART.x + CHART.w + 0.24, chartY(1200), 0]});

  const apparatus = new THREE.Group(); system.add(apparatus);
  for (const object of [body, reflector, element, circuit, guard, tilePart, beamPart]) apparatus.add(object);
  apparatus.rotation.set(0.10, -0.27, 0);

  const d = HEATER_DEFAULTS, D = HEATER_DOMAINS;
  control('volts', 'Supply voltage', ...D.volts, d.volts, 'V', 'Effective AC voltage. Once the switch closes, power equals voltage squared divided by wire resistance. A setting change starts a new cold run.');
  control('length', 'Element length', ...D.length, d.length, 'm', 'More wire makes more turns and raises resistance. At the same voltage, a longer coil draws less power.');
  control('reflector', 'Reflector', ...D.reflector, d.reflector, '', 'Redirect a declared share of the radiation toward the front. Total electrical input and wire temperature are unchanged.', REFLECTORS);
  control('room', 'Room temperature', ...D.room, d.room, '°C', 'The starting temperature of the wire and test tile, and the fixed temperature of their surroundings.');

  const result = finish(values => {
    const plan = heaterPlan(values), now = heaterAt(plan, clock);
    if (drawnLength !== values.length) {
      const path = new HeaterCoil(values.length);
      coil.geometry.dispose();
      coil.geometry = new THREE.TubeGeometry(path, Math.ceil(path.turns * 24), HEATER_DIAMETER * 1000 * MM * WIRE_TIMES / 2, 5, false);
      coil.userData.turns = path.turns; coil.userData.path = path;
      fillLine(endLeads, [[-0.5, 0, HEATER.coilZ * MM], path.getPoint(0).toArray(), path.getPoint(1).toArray(), [0.5, 0, HEATER.coilZ * MM]]);
      drawnLength = values.length;
    }
    coil.material.color.copy(wireColor(now.celsius));
    dish.visible = values.reflector === 1;
    switchPivot.rotation.z = now.on ? 0 : Math.PI / 5;
    switchWord.userData.setText(now.on ? 'Closed' : 'Open');
    tile.material.color.set(0x658fa0).lerp(new THREE.Color(0xd78052), clamp((now.tile - values.room) / 30));
    tileWord.userData.setText(`${fixed(now.tile, 1)} °C`);
    wireWord.userData.setText(`${fixed(now.celsius, 0)} °C wire`);
    const powerByPath = {...now, frontOther: now.forward - now.absorbed};
    beams.forEach((beam, i) => {
      const power = powerByPath[beamSpecs[i].key];
      beam.visible = power > 1e-8;
      beam.userData.power = power;
      // Width has a small visibility floor; labels carry the exact powers.
      beam.scale.x = beam.scale.z = 0.2 + 1.8 * Math.sqrt(Math.max(0, power) / 1800);
    });
    heatWord.userData.setText(`${fixed(now.absorbed, 0)} W to tile`);
    airWord.userData.setText(`${fixed(now.convected, 0)} W to air`);
    const shown = plan.chart.filter(point => point.t < now.t);
    fillLine(curve, clock > 0 ? [...shown.map(point => [chartX(plan, point.t), chartY(point.celsius), 0.002]), [chartX(plan, now.t), chartY(now.celsius), 0.002]] : []);
    const status = values.volts === 0 ? 'No supply · choose a voltage above zero to run'
      : clock === 0 ? 'Ready · circuit open, wire and tile at room temperature. Press Play to close the switch'
      : now.done ? `Run complete · after 120 s the wire is ${fixed(now.celsius, 0)} °C and the tile is ${fixed(now.tile, 1)} °C`
      : `Heating · ${fixed(now.t, 1)} s elapsed; current warms the wire and radiation warms the tile`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Circuit', now.on ? 'Closed' : 'Open', 'Play closes the switch. Pause freezes time. Reset or a setting change begins a new cold experiment.'),
        r('Element temperature', `${fixed(now.celsius, 0)} °C`, `${now.celsius > NIKROTHAL.continuous ? 'Above the datasheet’s 1,200 °C continuous operating temperature. ' : ''}The wire warms while electrical input exceeds radiation and convection. Glow color is illustrative.`),
        r('Element power', `${fixed(now.power, 0)} W`, 'For a closed circuit, P = V²/R. The manufacturer’s temperature factor changes the resistance as the wire warms.'),
        r('Current', `${fixed(now.current, 2)} A`, `The present wire resistance is ${fixed(now.resistance, 1)} Ω. An open switch carries no current.`),
        r('Radiation', `${fixed(now.radiated, 0)} W`, 'Net radiation to the surroundings uses absolute temperature to the fourth power, emissivity 0.88, and the surface area of the selected wire length.'),
        r('Convection', `${fixed(now.convected, 0)} W`, 'Air next to the wire warms. The model uses an illustrative coefficient of 15 W/(m²·K).'),
        r('Forward radiation', `${fixed(now.forward, 0)} W`, `${values.reflector ? '75%' : '35%'} of radiation goes forward; ${fixed(now.backward, 0)} W goes elsewhere. These declared shares are not measured or ray traced.`),
        r('Test tile', `${fixed(now.tile, 1)} °C`, `The tile absorbs ${fixed(now.absorbed, 1)} W, one tenth of forward radiation, and loses ${fixed(now.tileReleased, 1)} W to the room. Heat capacity: 500 J/K. Heat-loss coefficient: 1.5 W/K. These are illustrative choices.`),
        r('Energy stored in wire', `${fixed(now.storedEnergy / 1000, 2)} kJ`, 'A hot wire stores energy. Stored energy is mass times the integral of its temperature-dependent specific heat; a real wire takes time to cool after switch-off.'),
        r('Electrical energy supplied', `${fixed(now.inputEnergy / 1000, 2)} kJ`, `${fixed(now.radiatedEnergy / 1000, 2)} kJ left as radiation and ${fixed(now.convectedEnergy / 1000, 2)} kJ by convection. The rest is stored in the wire. Energy reaching the tile is part of radiation, not extra energy.`),
        r('Coil and playback', `${fixed(coil.userData.turns, 1)} turns · 8× time`, 'The coil has a 460 mm span and 14 mm centerline diameter. Wire diameter is 0.4 mm, drawn 2 times thicker. Enclosure dimensions are illustrative; this 120-second run plays in 15 seconds.'),
      ],
    };
  });
  const render = result.update;
  result.update = next => {
    const before = result.getState().values;
    const readings = render(next);
    if (Object.keys(before).some(key => result.getState().values[key] !== before[key])) {
      clock = 0; lastClock = 0; return render();
    }
    return readings;
  };
  result.advance = dt => {
    if (Number.isFinite(dt) && dt > 0 && result.getState().values.volts > 0) {
      const next = clock + dt * DECLARED.heaterFaster;
      clock = next >= DECLARED.heaterRun - 1e-9 ? DECLARED.heaterRun : next;
    }
    return render();
  };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the element', part: 'element', view: 'front', replay: false, run: () => render()},
    {label: 'Inspect: the reflector', part: 'reflector', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: where the heat goes', part: 'beam', view: 'front', replay: false, run: () => render()},
    {label: 'Inspect: the warm up', part: 'chart', view: 'front', replay: false, run: () => render()},
  ];
  result.playback = {
    label: 'Switch it on', description: 'Close the switch and watch 120 simulated seconds of heating, played 8 times faster. Pause freezes time; it does not cut the power.',
    stepLabel: 'Advance 30 s', advance: result.advance, step: () => result.advance(30 / DECLARED.heaterFaster),
    complete: () => clock >= DECLARED.heaterRun, blocked: () => result.getState().values.volts === 0,
  };
  result.resultPart = {id: 'tile', label: 'Inspect the warmed tile', view: 'iso', focusOnComplete: false, available: () => clock >= DECLARED.heaterRun};
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true;
  result.framePadding = 0.52; result.selectionOutline = false; result.transparentBackground = true;
  result.topology = {system, apparatus, body, caseMeshes, reflector, dish, element, coil, terminals, endLeads, circuit, supply, liveLead, switchedLead, returnLead, switchPivot, switchBlade, guard, bars, tilePart, tile, stand, beamPart, beams, beamSpecs, chartPart, chartFrame, limitLine, curve};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

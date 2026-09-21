import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, solidArrow, fillLine, surface} from './scene-kit.js';
import {sampleFridge, fridgePlan, indicator, piston, cylinderPressure, runningTime, latentHeat, vaporHeat, saturation, FRIDGE, COILS, SEALS, STARTS, FRIDGE_DEFAULTS as D, FRIDGE_DOMAINS} from './refrigerator-physics.js';

// ---------------------------------------------------------------------------
// Refrigerator: insulated cabinet, evaporator, compressor, condenser and
// capillary tube, seen from behind and to the right with its side cut away.
//
// Scale: one millimeter is 0.002 scene units for every length, including the
// compressor's 20 mm piston.
//
// Time: the clock runs 720 times faster than real time, so six hours play in
// half a minute. The compressor's crank is drawn turning once a second of
// playback, not at its real 2,900 rpm, and the refrigerant's dots move at a pace
// chosen to be seen, faster with more flow, only while the compressor runs.
//
// Arrows: heat and power, 2 mm per watt, all on one scale: heat leaking in
// through the side, heat the evaporator takes from the cabinet, heat the
// condenser gives the room, and electrical power into the compressor.
//
// Colors of the refrigerant: red for hot vapor, dark blue for liquid, pale blue
// for boiling liquid, gray for cool vapor.
//
// Charts, not to the refrigerator's scale: the cycle on a pressure against
// enthalpy chart with the refrigerant's boiling dome; the cabinet's temperature
// over six hours with the compressor's running marked beneath; and, beside the
// compressor, the pressure in its cylinder against its volume.
// ---------------------------------------------------------------------------

const MM = 0.002;
const TAU = Math.PI * 2;
const WATT = 2;
const COMP = {x: 120, y: 95, z: -405};
const TURN = Math.PI * 0.73;
const PH = {width: 520, bottom: 350, height: 300, hMax: 700e3, pLow: 0.3e5, pHigh: 20e5};
const TT = {width: 520, bottom: 380, height: 340};
const PV = {width: 260, bottom: 0, height: 210, vMax: 6e-6, pMax: 16e5};
/** The charts stand this far to the right of the refrigerator as seen, facing the viewer. */
const CHART_OFFSET = -260;
const HOT = 0xd23b1f, LIQUID = 0x2f6690, BOILING = 0x83b4c1, COOL = 0x9aa7ad;
const DOTS = 90, DOT_PACE = 150;

/** Enthalpy of saturated liquid and vapor, from liquid at -40 degrees. */
export const liquidEnthalpy = T => FRIDGE.liquidHeat * (T + 40);
export const vaporEnthalpy = T => liquidEnthalpy(T) + latentHeat(T);
/** The cycle's four corners on the pressure and enthalpy chart. */
export const cyclePoints = c => {
  const h1 = vaporEnthalpy(c.Te) + vaporHeat() * FRIDGE.superheat, h3 = liquidEnthalpy(c.Tc);
  return [[h1, c.Pe], [h1 + c.work, c.Pc], [h3, c.Pc], [h3, c.Pe]];
};
export const phPoint = (h, P) => [(h / PH.hMax * PH.width) * MM, (PH.bottom + Math.log(P / PH.pLow) / Math.log(PH.pHigh / PH.pLow) * PH.height) * MM, 0];
/** The temperature chart's range: the thermostat band with room around it, up to the kitchen's temperature for a warm start. */
export const tempRange = values => [values.setting - 3, values.start ? values.room + 1 : values.setting + 4];
export const ttPoint = (t, T, [low, high]) => [(t / FRIDGE.duration * TT.width) * MM, (TT.bottom + (T - low) / (high - low) * TT.height) * MM, 0];
export const pvPoint = (V, P) => [(V / PV.vMax * PV.width) * MM, (PV.bottom + P / PV.pMax * PV.height) * MM, 0];

/** The refrigerant's path, in millimeters, with where each stretch begins. */
export const LOOP = (() => {
  const discharge = [COMP.x + 27.64, COMP.y + 44, COMP.z - 7];
  const suction = [COMP.x + 27.64, COMP.y + 44, COMP.z + 7];
  const points = [discharge, [180, 200, -405], [280, 200, -345], [280, 1480, -345], [250, 1450, -345]];
  const marks = {condenser: points.length - 1};
  for (let row = 0; row < 11; row++) {
    const y = 1450 - row * 110;
    points.push([row % 2 ? 250 : -250, y, -345]);
    if (row < 10) points.push([row % 2 ? 250 : -250, y - 110, -345]);
  }
  marks.liquid = points.length - 1;
  points.push([-285, 350, -380], [-263, 380, -380]);
  marks.capillary = points.length - 1;
  for (let i = 1; i <= 224; i++) {
    const angle = i * Math.PI / 8;
    points.push([-285 + 22 * Math.cos(angle), 380 + 400 * i / 224, -380 + 22 * Math.sin(angle)]);
  }
  points.push([-285, 800, -340], [-250, 1230, -330], [-250, 1250, -245]);
  marks.evaporator = points.length - 1;
  for (let row = 0; row < 4; row++) {
    const y = 1250 + row * 50;
    points.push([row % 2 ? -250 : 250, y, -245]);
    if (row < 3) points.push([row % 2 ? -250 : 250, y + 50, -245]);
  }
  marks.suction = points.length - 1;
  points.push([-245, 1420, -245], [-245, 1430, -330], [20, 250, -405], suction);
  marks.compressor = points.length - 1;
  points.push([COMP.x + 22, COMP.y + 44, COMP.z + 7], [COMP.x + 22, COMP.y + 44, COMP.z - 7], discharge);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(...points[i].map((v, k) => v - points[i - 1][k])));
  const sections = [
    {part: 'pipes', from: 0, to: marks.condenser},
    {part: 'condenser', from: marks.condenser, to: marks.liquid},
    {part: 'pipes', from: marks.liquid, to: marks.capillary},
    {part: 'capillary', from: marks.capillary, to: marks.evaporator},
    {part: 'evaporator', from: marks.evaporator, to: marks.suction},
    {part: 'pipes', from: marks.suction, to: marks.compressor},
    {part: 'compressor', from: marks.compressor, to: points.length - 1},
  ];
  return {points, marks, lengths, sections, total: lengths.at(-1)};
})();

export function loopAt(distance) {
  const {points, lengths, total, marks, sections} = LOOP, s = ((distance % total) + total) % total;
  let i = 1;
  while (lengths[i] < s) i++;
  const u = (s - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
  const position = points[i - 1].map((v, k) => v + (points[i][k] - v) * u);
  const section = sections.find(section => i <= section.to);
  const condenserFraction = (s - lengths[marks.condenser]) / (lengths[marks.liquid] - lengths[marks.condenser]);
  const state = s < lengths[marks.condenser] ? HOT
    : s < lengths[marks.liquid] ? (condenserFraction < 0.2 ? HOT : condenserFraction < 0.85 ? BOILING : LIQUID)
    : s < lengths[marks.capillary] ? LIQUID
    : s < lengths[marks.suction] ? BOILING : COOL;
  return {position, state, part: section.part};
}

export function createRefrigeratorModel() {
  const kit = houseModel('Refrigerator'), {root, part, control, finish, covers} = kit;
  const labels = [], textures = [];
  function label(text, pos, width, parent, color = '#394233', height = 42) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    let ctx, texture;
    if (canvas) { canvas.height = 96; canvas.width = Math.ceil(96 * width / height); ctx = canvas.getContext('2d'); texture = new THREE.CanvasTexture(canvas); }
    else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * MM, height * MM), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide}));
    mesh.position.set(...pos.map(v => v * MM)); parent.add(mesh); labels.push(mesh);
    mesh.userData.setText = value => {
      if (mesh.userData.labelText === value) return;
      mesh.userData.labelText = value;
      if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = '76px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, canvas.width / 2, 48, canvas.width * 0.98); }
      texture.needsUpdate = true;
    };
    mesh.userData.setText(text); return mesh;
  }
  const system = part('system', 'Refrigerator', 'A pump for heat. Refrigerant boils in the evaporator inside, taking heat from the cabinet; the compressor squeezes the vapor; it condenses in the coils at the back, giving that heat and the compressor’s work to the room. Dimensions are chosen for this teaching model. Look inside removes the front, right and rear panels and the compressor shell.');

  const cabinet = part('cabinet', 'Insulated cabinet', 'A steel box lined with 5 cm of foam. Heat leaks in through it all the time, and faster past a worn door seal. Look inside reveals the cabinet and tubing by removing three panels.', [0, 0, 0], system);
  const panel = (size, pos, cover = false) => { const mesh = kit.box(size.map(v => v * MM), pos.map(v => v * MM), 'cream', cabinet); if (cover) covers.push(mesh); return mesh; };
  panel([600, 50, 620], [0, 25, 0]);
  panel([600, 50, 620], [0, 1475, 0]);
  panel([600, 1500, 50], [0, 750, -285], true);
  panel([50, 1500, 620], [-275, 750, 0]);
  panel([50, 1500, 620], [275, 750, 0], true);
  panel([600, 1500, 50], [0, 750, 285], true);
  covers.push(kit.rod([220 * MM, 880 * MM, 335 * MM], [220 * MM, 1130 * MM, 335 * MM], 8 * MM, 'metal', cabinet));
  for (const y of [880, 1130]) covers.push(kit.rod([220 * MM, y * MM, 310 * MM], [220 * MM, y * MM, 335 * MM], 6 * MM, 'metal', cabinet));
  kit.box([200 * MM, 10 * MM, 210 * MM], [120 * MM, 10 * MM, -390 * MM], 'metal', cabinet);
  const doorSeal = part('door-seal', 'Door gasket', 'The flexible gasket limits heat leakage around the closed door. Worn mode opens the highlighted top segment and increases the chosen leakage conductance.', [0, 0, 0], system);
  for (const x of [-250, 250]) kit.box([8 * MM, 1400 * MM, 8 * MM], [x * MM, 750 * MM, 260 * MM], 'ink', doorSeal);
  kit.box([500 * MM, 8 * MM, 8 * MM], [0, 50 * MM, 260 * MM], 'ink', doorSeal);
  for (const x of [-150, 150]) kit.box([200 * MM, 8 * MM, 8 * MM], [x * MM, 1450 * MM, 260 * MM], 'ink', doorSeal);
  const sealPatch = kit.box([100 * MM, 8 * MM, 8 * MM], [0, 1450 * MM, 260 * MM], 'ink', doorSeal);
  const air = kit.box([498 * MM, 1398 * MM, 518 * MM], [0, 750 * MM, 0], 'blue', cabinet);
  air.material = air.material.clone();
  air.material.transparent = true;
  air.material.depthWrite = false;
  air.raycast = () => {};
  for (const y of [420, 760, 1100]) kit.box([500 * MM, 6 * MM, 500 * MM], [0, y * MM, 0], 'metal', cabinet);
  const food = [[[-150, 470, 40], [120, 90, 120], 'red'], [[90, 800, -60], [70, 80, 70], 'gold'], [[-60, 1150, 60], [200, 90, 140], 'leaf'], [[160, 480, -80], [90, 110, 90], 'clay']];
  for (const [pos, size, color] of food) kit.box(size.map(v => v * MM), pos.map(v => v * MM), color, cabinet);

  const evaporator = part('evaporator', 'Evaporator', 'A plate and tube inside the top of the cabinet, where the refrigerant boils below the cabinet’s temperature and so draws heat from it.', [0, 0, 0], system);
  kit.box([520 * MM, 170 * MM, 6 * MM], [0, 1325 * MM, -262 * MM], 'metal', evaporator);

  const condenser = part('condenser', 'Condenser', 'A long tube zigzagging down the back, with wires to spread its heat. The hot vapor inside gives its heat to the room and condenses to liquid. Dust on it slows the heat and raises the pressure the compressor must reach.', [0, 0, 0], system);
  for (let i = 0; i < 18; i++) kit.rod([(-260 + i * 30) * MM, 330 * MM, -352 * MM], [(-260 + i * 30) * MM, 1460 * MM, -352 * MM], 1.2 * MM, 'ink', condenser);
  const dust = kit.box([560 * MM, 1150 * MM, 4 * MM], [0, 895 * MM, -358 * MM], 'clay', condenser);
  dust.material = dust.material.clone();
  dust.material.transparent = true;
  dust.material.opacity = 0.45;

  const pipes = part('pipes', 'Refrigerant circuit', 'The sealed loop: discharge line, condenser, capillary tube, evaporator, and suction line back to the compressor. The dots show the refrigerant moving while the compressor runs.', [0, 0, 0], system);
  const capillary = part('capillary', 'Capillary tube', 'A tube under a millimeter wide and a few meters long, coiled up here. It lets the liquid through only slowly, holding the high pressure behind it; as the pressure falls, some of the liquid flashes to vapor and the rest is chilled.', [0, 0, 0], system);

  const compressor = part('compressor', 'Refrigerant compressor', 'A sealed can holding an electric motor and a small piston pump. The piston, 20 mm across with a 16 mm stroke, draws in cool vapor and squeezes it to the condenser’s pressure. The can is cut open.', [COMP.x * MM, COMP.y * MM, COMP.z * MM], system);
  const shell = kit.cylinder(75 * MM, 150 * MM, [0, 0, 0], 'ink', compressor);
  covers.push(shell);
  for (const x of [-55, 55]) kit.cylinder(10 * MM, 5 * MM, [x * MM, -77.5 * MM, 0], 'ink', compressor);
  kit.box([80 * MM, 6 * MM, 46 * MM], [0, 29 * MM, 0], 'metal', compressor);
  for (const x of [-38, 0]) kit.rod([x * MM, -28 * MM, 0], [x * MM, 26 * MM, 0], 3 * MM, 'metal', compressor);
  kit.cylinder(32 * MM, 40 * MM, [-20 * MM, -48 * MM, 0], 'gold', compressor);
  const motorShaft = kit.cylinder(3 * MM, 68 * MM, [-20 * MM, 6 * MM, 0], 'metal', compressor);
  const crankCenter = new THREE.Group();
  crankCenter.position.set(-20 * MM, 40 * MM, 0);
  compressor.add(crankCenter);
  const crank = kit.cylinder(12 * MM, 5 * MM, [0, 0, 0], 'metal', crankCenter);
  const pin = kit.sphere(3 * MM, [0, 4 * MM, 0], 'red', crankCenter);
  const bore = FRIDGE.bore * 1000, stroke = FRIDGE.stroke * 1000, rod = FRIDGE.rod * 1000, head = stroke / 2 + rod + 6 + FRIDGE.clearance * stroke;
  const barrel = kit.cylinder((bore / 2 + 2) * MM, (stroke + 24) * MM, [0, 0, 0], 'metal', crankCenter);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set((head - (stroke + 24) / 2 + 3) * MM, 4 * MM, 0);
  barrel.material = barrel.material.clone();
  barrel.material.transparent = true;
  barrel.material.opacity = 0.35;
  const pistonHead = kit.cylinder(bore / 2 * MM, 12 * MM, [0, 0, 0], 'cream', crankCenter);
  pistonHead.rotation.z = Math.PI / 2;
  const link = lineObject(2, 0x374736, crankCenter);
  const valves = kit.box([3 * MM, bore * MM, bore * MM], [(head + 1.5) * MM, 4 * MM, 0], 'gold', crankCenter);
  const suctionValve = kit.box([0.6 * MM, 6 * MM, 5 * MM], [(head - 0.3) * MM, 4 * MM, 6 * MM], 'blue', crankCenter);
  const dischargeValve = kit.box([0.6 * MM, 6 * MM, 5 * MM], [(head + 3.3) * MM, 4 * MM, -6 * MM], 'red', crankCenter);
  const pipeParents = {pipes, condenser, capillary, evaporator, compressor};
  const tubes = LOOP.sections.map(section => {
    const parent = pipeParents[section.part], curve = new THREE.CurvePath();
    const points = LOOP.points.slice(section.from, section.to + 1).map(point => new THREE.Vector3(...point.map(v => v * MM)).sub(parent.position));
    for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
    const tube = surface(kit, new THREE.TubeGeometry(curve, Math.max(40, points.length * 6), (section.part === 'capillary' ? 1.2 : 3) * MM, 8, false), 'metal', parent);
    tube.userData.section = section; return tube;
  });
  const dots = Array.from({length: DOTS}, () => {
    const dot = kit.sphere(5 * MM, [0, 0, 0], 'blue', pipes);
    dot.material = dot.material.clone(); dot.userData.explosionExcluded = true; dot.raycast = () => {}; return dot;
  });
  const thermostat = part('thermostat', 'Thermostat and sensor', 'An ideal temperature switch. The cabinet sensor calls for cooling at the upper threshold and stops it at the lower threshold. Green means the motor circuit is closed; gray means open.', [0, 0, 0], system);
  kit.box([65 * MM, 50 * MM, 35 * MM], [220 * MM, 1170 * MM, -225 * MM], 'cream', thermostat);
  const thermostatLamp = kit.sphere(8 * MM, [220 * MM, 1170 * MM, -200 * MM], 'leaf', thermostat); thermostatLamp.material = thermostatLamp.material.clone();
  kit.rod([220 * MM, 1160 * MM, -245 * MM], [180 * MM, 1070 * MM, -245 * MM], 2 * MM, 'metal', thermostat);
  kit.cylinder(5 * MM, 45 * MM, [180 * MM, 1050 * MM, -245 * MM], 'metal', thermostat);

  const flows = part('heat-flow', 'Heat and power arrows', 'Orange enters the cabinet, blue enters the evaporator, red leaves the condenser, gold powers the compressor, and clay leaves the motor. All lengths use 2 mm per watt.', [0, 0, 0], system);
  const arrow = color => solidArrow(kit, color, flows, 5 * MM);
  const arrows = {leak: arrow(0xd9822b), removed: arrow(0x2f6690), released: arrow(0xd23b1f), power: arrow(0xe3b45e), motorLoss: arrow(0xce825f)};
  const anchors = {leak: {tip: [300, 800, 0], out: [1, 0, 0]}, removed: {tip: [0, 1240, -200], out: [0, -1, 0]}, released: {tip: [0, 900, -365], out: [0, 0, 1]}, power: {tip: [COMP.x + 80, COMP.y, COMP.z], out: [1, 0, 0]}, motorLoss: {tip: [COMP.x, COMP.y, COMP.z - 130], out: [0, 0, 1]}};

  const charts = part('charts', 'Cabinet temperature chart', 'Blue shows cabinet temperature over the full six-hour trial. Gray lines are thermostat thresholds; gold intervals show compressor operation. Curves preview the whole selected trial.', [CHART_OFFSET * MM, 0, 0], root);
  charts.userData.inspectionOnly = 'charts';
  const cycleChart = part('cycle-chart', 'Refrigerant cycle chart', 'Running-cycle pressure (logarithmic bar) versus enthalpy. The two colored saturation branches bound the liquid-vapor region in this approximate property model; they are not a real-fluid critical-point dome.', [CHART_OFFSET * MM, 0, 0], root);
  cycleChart.userData.inspectionOnly = 'cycle-chart';
  const axis = (a, b, parent = cycleChart) => kit.rod(a, b, 1.2 * MM, 'ink', parent);
  axis(phPoint(0, PH.pLow), phPoint(PH.hMax, PH.pLow));
  axis(phPoint(0, PH.pLow), phPoint(0, PH.pHigh));
  const DOME = 60;
  const domeLiquid = lineObject(DOME, 0x2f6690, cycleChart), domeVapor = lineObject(DOME, 0xd23b1f, cycleChart);
  for (let i = 0; i < DOME; i++) {
    const T = -39 + i * 157 / (DOME - 1), P = saturation(T);
    domeLiquid.geometry.attributes.position.array.set(phPoint(liquidEnthalpy(T), P), i * 3);
    domeVapor.geometry.attributes.position.array.set(phPoint(vaporEnthalpy(T), P), i * 3);
  }
  const loopLine = lineObject(5, 0x374736, cycleChart);
  const phDot = kit.sphere(8 * MM, [0, 0, 0], 'red', cycleChart);
  axis([0, TT.bottom * MM, 0], [TT.width * MM, TT.bottom * MM, 0], charts);
  axis([0, TT.bottom * MM, 0], [0, (TT.bottom + TT.height) * MM, 0], charts);
  const trace = lineObject(Math.round(FRIDGE.duration / (FRIDGE.step * FRIDGE.every)) + 1500, 0x2f6690, charts);
  const band = [lineObject(2, 0x9aa7ad, charts), lineObject(2, 0x9aa7ad, charts)];
  const runs = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: 0xe3b45e}));
  runs.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 1500), 3));
  runs.frustumCulled = false;
  charts.add(runs);
  const clockLine = lineObject(2, 0x374736, charts);

  const indicatorChart = part('indicator', 'Pressure in the cylinder', 'Ideal pressure-volume loop before compression-efficiency losses. Its area is ideal indicated work, not the actual electrical input. The dot follows the slowed piston.', [0, 0, 0], root);
  indicatorChart.userData.inspectionOnly = 'indicator';
  kit.rod(pvPoint(0, 0), pvPoint(PV.vMax, 0), 0.8 * MM, 'ink', indicatorChart);
  kit.rod(pvPoint(0, 0), pvPoint(0, PV.pMax), 0.8 * MM, 'ink', indicatorChart);
  const pvLine = lineObject(121, 0xd23b1f, indicatorChart);
  const pvDot = kit.sphere(4 * MM, [0, 0, 0], 'red', indicatorChart);
  label('Pressure (bar, log scale)', [260, 700, 0], 520, cycleChart);
  for (const P of [0.3, 1, 5, 20]) label(String(P), [-38, phPoint(0, P * 1e5)[1] / MM, 0], 64, cycleChart, '#394233', 40);
  for (const h of [0, 200, 400, 600]) label(String(h), [phPoint(h * 1000, 1e5)[0] / MM, 315, 0], 70, cycleChart, '#394233', 40);
  label('Enthalpy (kJ/kg)', [260, 260, 0], 510, cycleChart, '#394233', 42);
  label('1 Vapor in · 2 After compression', [260, 205, 0], 580, cycleChart, '#394233', 40);
  label('3 Liquid out · 4 Low-pressure mix', [260, 155, 0], 580, cycleChart, '#394233', 40);
  const cycleStatus = label('', [260, 100, 0], 580, cycleChart, '#394233', 40);
  const cornerLabels = [1, 2, 3, 4].map(n => label(String(n), [0, 0, 0], 40, cycleChart, '#394233', 40));
  label('Cabinet (°C)', [260, 760, 0], 430, charts);
  const tempLabels = [0, 1, 2].map(() => label('', [-45, 0, 0], 70, charts, '#394233', 40));
  for (const h of [0, 2, 4, 6]) label(String(h), [h / 6 * TT.width, 340, 0], 50, charts, '#394233', 40);
  label('Hours · gold: compressor on', [260, 295, 0], 560, charts, '#997317', 40);
  label('Ideal pressure (bar)', [130, 260, 0], 380, indicatorChart, '#394233', 35);
  for (const P of [0, 8, 16]) label(String(P), [-30, pvPoint(0, P * 1e5)[1] / MM, 0], 40, indicatorChart, '#394233', 34);
  for (const V of [0, 3, 6]) label(String(V), [pvPoint(V * 1e-6, 0)[0] / MM, -28, 0], 40, indicatorChart, '#394233', 34);
  label('Volume (cm³)', [130, -62, 0], 300, indicatorChart, '#394233', 35);
  const chartStatus = label('', [260, 230, 0], 600, charts, '#394233', 40);
  for (const guide of [charts, cycleChart, indicatorChart, flows]) { guide.userData.explosionExcluded = true; guide.traverse(object => { object.raycast = () => {}; }); }

  const specs = {
    setting: ['Thermostat', '°C', null, 'The compressor starts 1 degree above this and stops 1 degree below.'],
    room: ['Kitchen', '°C', null, 'The air around the refrigerator, which heat leaks in from and the condenser must give heat to.'],
    coils: ['Condenser coils', '', COILS.map(({value, label}) => ({value, label})), 'Dust halves how well the coils give heat to the room.'],
    seal: ['Door seal', '', SEALS.map(({value, label}) => ({value, label})), 'A worn seal lets warm air creep in.'],
    start: ['Starting from', '', STARTS.map(({value, label}) => ({value, label})), 'A refrigerator just switched on is at the kitchen’s temperature.'],
  };
  for (const [name, [min, max, step]] of Object.entries(FRIDGE_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options);
  }

  let clock = 0, lastClock = 0, disposed = false, chartKey = '', physicalKey = '';
  const result = finish(values => {
    const key = JSON.stringify(values);
    if (key !== physicalKey) { clock = lastClock = 0; physicalKey = key; }
    const s = sampleFridge(values, clock), c = s.cycle, on = s.on;
    air.material.color.set(0x83b4c1).lerp(new THREE.Color(0xf0dfaf), Math.max(0, Math.min(1, (s.T - 2) / 30)));
    air.material.opacity = 0.18;
    dust.visible = values.coils === 1;
    sealPatch.visible = values.seal === 0;

    const distance = runningTime(s, clock) / FRIDGE.speedUp * DOT_PACE * s.typical.flow / 3.83e-4;
    dots.forEach((dot, i) => {
      const at = loopAt(distance + i * LOOP.total / DOTS);
      pipeParents[at.part].add(dot);
      dot.position.set(...at.position.map(v => v * MM)).sub(dot.parent.position);
      dot.material.color.set(at.state);
    });

    const theta = TAU * runningTime(s, clock) / FRIDGE.speedUp, kinematics = piston(theta), crankRadius = stroke / 2;
    crank.rotation.y = -theta;
    pin.position.set(crankRadius * Math.cos(theta) * MM, 4 * MM, crankRadius * Math.sin(theta) * MM);
    const pinX = crankRadius * Math.cos(theta) + Math.sqrt(rod * rod - (crankRadius * Math.sin(theta)) ** 2);
    pistonHead.position.set(pinX * MM, 4 * MM, 0);
    link.geometry.attributes.position.array.set([crankRadius * Math.cos(theta) * MM, 4 * MM, crankRadius * Math.sin(theta) * MM, pinX * MM, 4 * MM, 0]);
    link.geometry.attributes.position.needsUpdate = true;
    link.geometry.computeBoundingSphere();

    const idealPressure = cylinderPressure(c, theta), down = theta % TAU < Math.PI;
    suctionValve.position.x = (head - 0.3 - (on && down && Math.abs(idealPressure - c.Pe) < 1 ? 1.2 : 0)) * MM;
    dischargeValve.position.x = (head + 3.3 + (on && !down && Math.abs(idealPressure - c.Pc) < 1 ? 1.2 : 0)) * MM;
    thermostatLamp.material.color.set(on ? 0x45664b : 0x9aa7ad);
    const watts = {leak: s.leak * (values.room - s.T), removed: on ? c.capacity : 0, released: on ? c.rejected : 0, power: on ? c.electric : 0, motorLoss: on ? c.motorLoss : 0};
    for (const [key, {tip, out}] of Object.entries(anchors)) {
      const length = Math.max(0, watts[key]) * WATT, a = arrows[key];
      a.userData.setLength(length * MM);
      a.userData.setDirection(new THREE.Vector3(...out).multiplyScalar(-1));
      a.position.set(...tip.map((v, k) => (v + (key === 'released' || key === 'motorLoss' ? 0 : out[k] * length)) * MM));
    }

    const points = cyclePoints(c);
    points.forEach((point, i) => { const pos = phPoint(...point); cornerLabels[i].position.set(pos[0] + (i < 2 ? 22 : -22) * MM, pos[1] + (i === 1 || i === 2 ? 22 : -22) * MM, 0); });
    cycleStatus.userData.setText(on ? 'Running cycle snapshot' : 'Off: predicted running cycle');
    pvDot.visible = on;
    [...points, points[0]].forEach((point, i) => loopLine.geometry.attributes.position.array.set(phPoint(...point), i * 3));
    loopLine.geometry.attributes.position.needsUpdate = true;
    loopLine.geometry.computeBoundingSphere();
    phDot.position.set(...phPoint(...points[0]));
    if (key !== chartKey) {
      chartKey = key;
      const range = tempRange(values);
      fillLine(trace, s.samples.map(sample => ttPoint(sample.t, sample.T, range)));
      tempLabels.forEach((label, i) => { const T = range[0] + (range[1] - range[0]) * i / 2; label.userData.setText(fixed(T, 1)); label.position.y = ttPoint(0, T, range)[1]; });
      band.forEach((line, i) => { line.geometry.attributes.position.array.set([...ttPoint(0, values.setting + (i ? 1 : -1) * FRIDGE.band, range), ...ttPoint(FRIDGE.duration, values.setting + (i ? 1 : -1) * FRIDGE.band, range)]); line.geometry.attributes.position.needsUpdate = true; });
      const segments = [];
      let since = s.samples[0].on ? 0 : null;
      const mark = (a, b) => segments.push(ttPoint(a, range[0] - 0.4, range), ttPoint(b, range[0] - 0.4, range));
      for (const change of s.switches) { if (change.on) since = change.t; else { mark(since, change.t); since = null; } }
      if (since !== null) mark(since, FRIDGE.duration);
      fillLine(runs, segments);
    }
    clockLine.geometry.attributes.position.array.set([...ttPoint(clock, tempRange(values)[0], tempRange(values)), ...ttPoint(clock, tempRange(values)[1], tempRange(values))]);
    clockLine.geometry.attributes.position.needsUpdate = true;

    const ind = indicator(c);
    for (let i = 0; i <= 120; i++) { const angle = TAU * i / 120; pvLine.geometry.attributes.position.array.set(pvPoint(piston(angle).volume, cylinderPressure(c, angle)), i * 3); }
    pvLine.geometry.attributes.position.needsUpdate = true;
    pvLine.geometry.computeBoundingSphere();
    pvDot.position.set(...pvPoint(kinematics.volume, cylinderPressure(c, theta)));

    chartStatus.userData.setText(`${fixed(clock / 3600, 2)} h · ${on ? 'on' : 'off'} · band ${values.setting - 1}–${values.setting + 1}°C`);
    const bar = P => fixed(P / 1e5, 2);
    const outcome = clock === 0 ? 'Ready · compressor on · Play advances six hours' : s.complete
      ? (s.reaches ? `Six hours · compressor ran ${fixed(s.duty * 100, 0)}% of the time, ${fixed(s.daily / 3.6e6, 3)} kWh a day` : `Six hours · never cold enough to switch off, so it runs nonstop: ${fixed(s.daily / 3.6e6, 3)} kWh a day`)
      : `${on ? 'Compressor running' : 'Compressor resting'} · cabinet ${fixed(s.T, 1)} °C`;
    return {
      state: {...s, watts, theta, cylinderVolume: kinematics.volume, idealPressure},
      readings: [
        r('Your result', outcome),
        r('Cabinet', `${fixed(s.T, 1)} °C`, `Target band ${values.setting - 1}–${values.setting + 1} °C. ${s.reaches ? 'An initially warm cabinet must cool down first.' : 'This load cannot reach the switch-off threshold.'}`),
        r('Compressor', on ? `running, ${fixed(c.electric, 0)} W` : 'resting', s.reaches ? `Selected six-hour trial: ${fixed(s.duty * 100, 0)}% running; ${s.period === null ? 'complete cycle not yet measured' : `last cycle ${fixed(s.period / 60, 0)} minutes`}.` : 'No switch-off reached in six hours; cooling cannot reach the lower threshold.'),
        r('Evaporator', on ? `boiling at ${fixed(c.Te, 1)} °C and ${bar(c.Pe)} bar` : 'Compressor off', 'Pressure values describe the quasisteady running cycle. Stopped pressure equalization is not simulated.'),
        r('Condenser', on ? `condensing at ${fixed(c.Tc, 1)} °C and ${bar(c.Pc)} bar` : 'Compressor off', `The compressor raises the pressure ${fixed(c.ratio, 2)} times, so the vapor condenses above the kitchen’s temperature.`),
        r('Refrigerant flow', `${fixed(on ? c.flow * 1000 : 0, 3)} g a second`, `${fixed(c.flash * 100, 0)}% of the liquid flashes to vapor in the capillary tube, chilling the rest.`),
        r('Heat taken from the cabinet', `${fixed(on ? c.capacity : 0, 1)} W`, `Heat leaks in at ${fixed(watts.leak, 1)} W.`),
        r('Heat given to the room', `${fixed(on ? c.roomHeat : 0, 1)} W`, `Condenser ${fixed(watts.released, 1)} W plus motor loss ${fixed(watts.motorLoss, 1)} W. Together: cooling plus electrical input.`),
        r('Cooling per electrical watt', on ? fixed(c.electricCop, 2) : 'Not running', `Running-cycle COP: ${fixed(c.cop, 2)} per shaft watt; ideal limit ${fixed(c.carnot, 2)}. Motor loss lowers the electrical COP.`),
        r('Energy', `${fixed(s.energy / 3.6e6, 3)} kWh so far`, `Extrapolated from the last ${s.period === null ? 'simulated hour' : 'full cycle'}: ${fixed(s.daily / 3.6e6, 3)} kWh/day. Not a product rating.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(FRIDGE.duration, clock + dt * FRIDGE.speedUp); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; physicalKey = ''; return render(result.defaults); };
  const firstRun = () => { const plan = fridgePlan(result.getState().values); return plan.samples[0].on ? 60 : (plan.switches.find(change => change.on)?.t ?? 0) + 60; };
  result.actions = [
    {label: 'Inspect: the compressor running', part: 'compressor', view: 'front', replay: false, run() { clock = firstRun() + 0.3; return render(); }},
    {label: 'Inspect: refrigerant cycle', part: 'cycle-chart', isolate: true, view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: cylinder pressure', part: 'indicator', isolate: true, view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the whole six hours', part: 'charts', isolate: true, view: 'front', replay: false, run() { clock = FRIDGE.duration; return render(); }},
    {label: 'Inspect: thermostat switches off', part: 'system', view: 'front', replay: false, run() { clock = fridgePlan(result.getState().values).switches.find(change => !change.on)?.t ?? FRIDGE.duration; return render(); }},
    {label: 'Inspect: thermostat restarts', part: 'system', view: 'front', replay: false, run() { clock = fridgePlan(result.getState().values).switches.find(change => change.on)?.t ?? FRIDGE.duration; return render(); }},
    {label: 'Inspect: the evaporator', part: 'evaporator', view: 'front', replay: false, run() { clock = firstRun(); return render(); }},
  ];
  result.playback = {
    label: 'Run six hours',
    description: 'Six hours play in 30 seconds. The crank and flow markers are slowed independently for visibility. Changing a setting starts a fresh trial.',
    stepLabel: 'Advance ten minutes',
    advance: result.advance,
    step: () => result.advance(600 / FRIDGE.speedUp),
    complete: () => Boolean(result.getState().complete),
    blocked: () => false,
  };
  root.rotation.set(0.12, -TURN, 0); for (const chart of [charts, cycleChart, indicatorChart]) chart.quaternion.copy(root.quaternion).invert();
  result.frameBoundsForPart = id => { root.updateWorldMatrix(true, false); const chart = {charts, 'cycle-chart': cycleChart, indicator: indicatorChart}[id]; if (chart) return new THREE.Box3().setFromObject(chart); if (id === 'system') return new THREE.Box3().setFromObject(system); return null; };
  result.thumbnailOmit = [charts, cycleChart, indicatorChart, flows];
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {tempRange, system, cabinet, air, evaporator, condenser, dust, pipes, dots, capillary, compressor, shell, crankCenter, crank, pin, pistonHead, link, valves, flows, arrows, anchors, charts, domeLiquid, domeVapor, loopLine, phDot, trace, band, runs, clockLine, indicatorChart, pvLine, pvDot, tubes, pipeParents, cycleChart, doorSeal, sealPatch, motorShaft, barrel, suctionValve, dischargeValve, thermostat, thermostatLamp, head, labels, textures, tempLabels, chartStatus, cycleStatus, cornerLabels, MM, WATT, COMP, TURN, DOTS, DOT_PACE};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; textures.forEach(texture => texture.dispose()); dispose(); } };
  return result;
}

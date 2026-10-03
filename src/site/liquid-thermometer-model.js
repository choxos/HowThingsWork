import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {textLabel, lineObject} from './scene-kit.js';
import {fixed} from './format.js';
import {LIQUID_GLASS_DEFAULTS, LIQUID_GLASS_DOMAINS, THERMOMETRIC_LIQUIDS, LIQUID_GLASS, sampleLiquidThermometer, thermometerMark} from './liquid-thermometer-physics.js';

const MM = .01, WIDTH = 1, SIDES = 48;
const basic = color => new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide, toneMapped: false});
const degrees = n => `${fixed(n, 2)} °C`;
const formatTemperature = n => String(n).replace('-', '−');
const reason = {readable: 'Read the top of the liquid', 'below-capillary': 'Liquid has retreated into the bulb', 'expansion-chamber': 'Liquid has entered the upper chamber', 'phase-limit': 'Liquid-only model ends at freezing'};

function lathe(profile, start = 0, length = 2 * Math.PI) {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), SIDES, start, length);
}

function radiusAt(profile, height) {
  const index = profile.findIndex(point => point[1] >= height);
  if (index <= 0) return profile[0][0];
  const a = profile[index - 1], b = profile[index], fraction = (height - a[1]) / (b[1] - a[1]);
  return a[0] + fraction * (b[0] - a[0]);
}

function liquidSurface(profile, parent, material) {
  const rings = profile.length + 2, vertices = new Float32Array((SIDES + 1) * rings * 3), indices = [];
  for (let i = 0; i < SIDES; i++) for (let j = 0; j < rings - 1; j++) {
    const a = i * rings + j, b = a + rings;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material); parent.add(mesh);
  let previous;
  const update = height => {
    const level = Math.max(profile[0][1], Math.min(profile.at(-1)[1], height));
    mesh.visible = height > profile[0][1];
    if (previous === level) return;
    previous = level;
    const radius = radiusAt(profile, level);
    const points = [[0, profile[0][1]], ...profile.map(([r, y], i) => y <= level ? [r, y] : profile[i - 1]?.[1] < level ? [radius, level] : [0, level]), [0, level]];
    for (let i = 0; i <= SIDES; i++) {
      const angle = i * 2 * Math.PI / SIDES;
      for (let j = 0; j < rings; j++) vertices.set([points[j][0] * Math.sin(angle) * MM, points[j][1] * MM, points[j][0] * Math.cos(angle) * MM], (i * rings + j) * 3);
    }
    geometry.attributes.position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    mesh.userData.level = level;
  };
  return {mesh, update, profile};
}

export function createLiquidThermometerModel() {
  const kit = houseModel('Liquid-in-glass thermometer'), {root, part, control, finish} = kit;
  const system = part('system', 'Liquid-in-glass thermometer', 'A sealed continuous cavity contains liquid and space above it. Liquid and glass expand together; their different expansion moves the level. All physical lengths use a common scale. Use the part inspections to enlarge the fine bore and curved reservoirs.');
  const thermal = new THREE.Group(), physical = new THREE.Group(); system.add(thermal); thermal.add(physical); physical.scale.set(WIDTH, 1, WIDTH);
  const bulb = part('bulb', 'Lower bulb', 'The reservoir joins the capillary without a gap. Most liquid is here. At very low off-scale temperatures, the free surface can retreat into this bulb.', [0, 0, 0], physical);
  const stem = part('stem', 'Capillary and column', 'A narrow continuous bore converts small changes in liquid volume into a large vertical movement. The liquid in the stem contributes to expansion too.', [0, 0, 0], physical);
  const chamber = part('chamber', 'Upper expansion chamber', 'Extra cavity above the calibrated stem receives the liquid when it rises beyond the capillary. There is no valid stem reading in this chamber.', [0, 0, 0], physical);
  const meniscus = part('meniscus', 'Liquid surface', 'Read the level of the liquid surface against the scale. This drawing uses a flat surface; curvature and optical refraction are omitted.', [0, 0, 0], physical);
  meniscus.userData.explosionExcluded = true;
  const liquidMaterial = new THREE.MeshPhongMaterial({color: 0x993d2b, shininess: 25, side: THREE.DoubleSide});
  const surface = new THREE.Mesh(new THREE.CircleGeometry(MM, SIDES), liquidMaterial); surface.rotation.x = -Math.PI / 2; meniscus.add(surface);
  const scale = part('scale', 'Calibrated scale', 'Marks are computed for the chosen liquid and bore and drawn beside the tube for clarity. Their heights expand with the glass. Changing liquid or bore represents a different, recalibrated instrument.', [0, 0, 0], thermal);
  const tickGeometry = new THREE.BufferGeometry(), tickArray = new Float32Array(111 * 6);
  tickGeometry.setAttribute('position', new THREE.BufferAttribute(tickArray, 3));
  const ticks = new THREE.LineSegments(tickGeometry, new THREE.LineBasicMaterial({color: 0x394233})); scale.add(ticks);
  const numbers = Array.from({length: 23}, (_, i) => textLabel(scale, formatTemperature(-50 + i * 5), {height: 13 * MM, width: 25 * MM, align: 'left'}));
  const scaleTitle = textLabel(scale, '°C', {height: 8.5 * MM, position: [19 * MM, 213 * MM, 0]});
  const guide = new THREE.Group(); thermal.add(guide); guide.userData.explosionExcluded = true; guide.userData.inspectionOnly = 'system';
  const leader = lineObject(2, 0x394233, guide);
  const levelLabel = textLabel(guide, '', {height: 9 * MM, width: 52 * MM, align: 'right'});
  const stateLabel = textLabel(guide, '', {height: 8.5 * MM, width: 59 * MM, align: 'right'});
  const widthLabel = textLabel(guide, 'Uniform scale', {height: 8.5 * MM, position: [0, -15 * MM, 0]});
  guide.traverse(object => {object.raycast = () => {};});

  const chart = part('chart', 'Temperature response', 'An explanatory chart of the imposed first-order temperature response. The liquid-only curve ends at a freezing boundary. Off-scale liquid still has a modeled temperature, but no valid thermometer reading.');
  chart.userData.inspectionOnly = 'chart'; chart.userData.explosionExcluded = true;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(190 * MM, 180 * MM), basic(0xf0dfaf)); board.position.set(0, 0, -.1 * MM); chart.add(board);
  const chartPoint = (time, temperature) => [(-62 + time / LIQUID_GLASS.duration * 138) * MM, (-43 + (temperature + 50) / 110 * 88) * MM, .1 * MM];
  const chartLabel = (text, x, y, options = {}) => textLabel(chart, text, {height: 14 * MM, position: [x * MM, y * MM, .2 * MM], ...options});
  const chartStatus = chartLabel('Temperature response', 0, 75, {weight: '600', width: 174 * MM});
  chartLabel('Temperature (°C)', -85, 58, {align: 'left', height: 12 * MM});
  chartLabel('Time (s)', 8, -66, {height: 12 * MM});
  for (const temperature of [-50, 0, 60]) {
    const y = chartPoint(0, temperature)[1] / MM;
    chartLabel(formatTemperature(temperature), -69, y, {align: 'right', height: 12 * MM});
    const grid = lineObject(2, 0xc4c6ac, chart); grid.geometry.attributes.position.array.set([...chartPoint(0, temperature), ...chartPoint(900, temperature)]); grid.geometry.computeBoundingSphere();
  }
  for (const time of [0, 300, 600, 900]) chartLabel(String(time), chartPoint(time, -50)[0] / MM, -53, {height: 12 * MM});
  const trace = lineObject(181, 0x993d2b, chart), target = lineObject(2, 0x576f55, chart);
  const cursor = new THREE.Mesh(new THREE.CircleGeometry(1.4 * MM, 24), basic(0x172d38)); chart.add(cursor);
  chartLabel('Liquid', -40, -80, {height: 12 * MM, color: '#993d2b'});
  chartLabel('Surroundings', 40, -80, {height: 12 * MM, color: '#576f55'});

  const specs = {
    liquid: ['Liquid', '', THERMOMETRIC_LIQUIDS.map(({value, label}) => ({value, label})), 'Compare representative expansion coefficients. Each selection uses its own calibrated scale.'],
    bore: ['Bore diameter', 'mm', null, 'A thinner bore gives greater height sensitivity but a smaller temperature span on this stem.'],
    initial: ['Initial temperature', '°C', null, 'The instrument starts uniformly at this temperature before the surroundings change.'],
    surroundings: ['Surroundings', '°C', null, 'An ideal uniform environment. Its temperature stays fixed during this comparison.'],
    response: ['Response time constant', 's', null, 'Choose the ideal response: after one time constant, 63.2% of the temperature gap has closed. This is not a prediction for a particular bath.'],
  };
  for (const [key, [min, max, step]] of Object.entries(LIQUID_GLASS_DOMAINS)) {
    const [label, unit, options, help] = specs[key]; control(key, label, min, max, step, LIQUID_GLASS_DEFAULTS[key], unit, help, options, {primary: key === 'liquid'});
  }

  let clock = 0, lastClock = 0, geometryKey, chartKey, disposed = false, surfaces = [], shells = [];
  function buildCavity(cavity) {
    for (const object of shells) {object.removeFromParent(); object.geometry.dispose(); object.material.dispose();}
    for (const liquid of surfaces) {liquid.mesh.removeFromParent(); liquid.mesh.geometry.dispose();}
    kit.covers.length = 0; shells = []; surfaces = [];
    const profiles = [cavity.points.slice(0, 257), cavity.points.slice(256, 258), cavity.points.slice(257)];
    const lowerEnd = Math.acos(1.6 / 3.4), upperStart = -Math.acos(1.6 / 2.7), outerCenter = 200 + Math.sqrt(2.7 ** 2 - 1.6 ** 2);
    const lower = Array.from({length: 129}, (_, i) => {
      const angle = -Math.PI / 2 + (lowerEnd + Math.PI / 2) * i / 128;
      return [3.4 * Math.cos(angle), -3.4 + (3.4 * Math.sin(angle) + 3.4) * (cavity.neck + 3.4) / (3.4 * Math.sin(lowerEnd) + 3.4)];
    });
    const upper = Array.from({length: 129}, (_, i) => {const angle = upperStart + (Math.PI / 2 - upperStart) * i / 128; return [2.7 * Math.cos(angle), outerCenter + 2.7 * Math.sin(angle)];});
    const outside = [lower, [[1.6, cavity.neck], [1.6, 200]], upper];
    for (let i = 0; i < 3; i++) {
      const parent = [bulb, stem, chamber][i], profile = [...outside[i], ...profiles[i].toReversed(), outside[i][0]];
      for (const front of [false, true]) {
        const material = new THREE.MeshPhongMaterial({color: 0xa8c6c9, transparent: true, opacity: front ? .25 : .35, depthWrite: false, side: THREE.DoubleSide, shininess: 55});
        const shell = new THREE.Mesh(lathe(profile, front ? -Math.PI / 2 : Math.PI / 2, Math.PI), material);
        shell.renderOrder = front ? 2 : 1; parent.add(shell); shells.push(shell); if (front) kit.covers.push(shell);
      }
      surfaces.push(liquidSurface(profiles[i], parent, liquidMaterial));
    }
  }
  const model = finish(values => {
    const s = sampleLiquidThermometer(values, clock);
    if (geometryKey !== values.bore) {geometryKey = values.bore; buildCavity(s.cavity);}
    for (const liquid of surfaces) liquid.update(s.meniscus);
    liquidMaterial.color.set(s.liquid.color); thermal.scale.setScalar(s.growth);
    meniscus.position.y = s.meniscus * MM; const radius = radiusAt(s.cavity.points, s.meniscus); surface.scale.set(radius, radius, 1);
    const key = JSON.stringify(values);
    if (chartKey !== key) {
      chartKey = key;
      const labelStep = s.sensitivity < .26 ? 100 : s.sensitivity < .45 ? 50 : s.sensitivity < 1.1 ? 20 : s.sensitivity < 3 ? 10 : 5;
      for (let i = 0; i < 111; i++) {
        const temperature = i - 50, y = thermometerMark(s, temperature), on = temperature >= s.markedLow && temperature <= s.markedHigh;
        const length = temperature % labelStep === 0 ? 6 : temperature % 5 === 0 ? 3.5 : 1.8;
        tickArray.set(on ? [8 * MM, y * MM, 0, (8 + length) * MM, y * MM, 0] : [0, 0, 0, 0, 0, 0], i * 6);
      }
      tickGeometry.attributes.position.needsUpdate = true; tickGeometry.computeBoundingBox(); tickGeometry.computeBoundingSphere();
      numbers.forEach((label, i) => {const temperature = -50 + 5 * i; label.visible = temperature >= s.markedLow && temperature <= s.markedHigh && temperature % labelStep === 0; label.userData.place(17 * MM, thermometerMark(s, temperature) * MM, 0);});
      const end = Math.min(LIQUID_GLASS.duration, s.phaseTime), positions = trace.geometry.attributes.position.array;
      for (let i = 0; i <= 180; i++) {const time = end * i / 180; positions.set(chartPoint(time, sampleLiquidThermometer(values, time).temperature), 3 * i);}
      trace.geometry.attributes.position.needsUpdate = true; trace.geometry.computeBoundingSphere();
      target.geometry.attributes.position.array.set([...chartPoint(0, values.surroundings), ...chartPoint(900, values.surroundings)]); target.geometry.attributes.position.needsUpdate = true; target.geometry.computeBoundingSphere();
    }
    const y = s.meniscus * MM;
    leader.geometry.attributes.position.array.set([-18 * MM, y, 0, -radius * WIDTH * MM, y, 0]); leader.geometry.attributes.position.needsUpdate = true; leader.geometry.computeBoundingSphere();
    levelLabel.userData.place(-20 * MM, y + 4 * MM, 0); levelLabel.userData.setText(s.reading === null ? 'No reading' : degrees(s.reading));
    stateLabel.userData.place(-20 * MM, y - 4 * MM, 0); stateLabel.userData.setText(s.status === 'readable' ? 'Liquid surface' : s.status === 'phase-limit' ? 'Freezing boundary' : s.status === 'below-capillary' ? 'Inside lower bulb' : 'Inside upper chamber');
    cursor.position.set(...chartPoint(s.clock, s.temperature)); cursor.position.z = .4 * MM;
    chartStatus.userData.setText(s.phaseTime <= LIQUID_GLASS.duration ? 'Liquid model ends at freezing' : 'Temperature response');
    return {state: s, readings: [
      r('Your result', reason[s.status], s.status === 'readable' ? 'The column shows the liquid temperature, which can still differ from the surroundings.' : 'No calibrated capillary reading is available in this state.'),
      r('Thermometer reading', s.reading === null ? 'Unavailable' : degrees(s.reading)),
      r('Elapsed time', `${fixed(s.clock, 2)} s`, s.phaseLimit ? 'Simulation stopped at the phase boundary. Replay returns to the chosen initial state.' : 'Fifteen modeled minutes per run; pause or step to compare exact moments. Playback speed changes the animation rate.'),
      r('Liquid temperature', degrees(s.temperature), s.phaseLimit ? 'Last liquid-only boundary state. No claim about subsequent temperature or frozen geometry.' : 'One uniform modeled temperature for liquid and glass.'),
      r('Surroundings', degrees(values.surroundings), 'Fixed target of the ideal response.'),
      r('Remaining temperature gap', `${fixed(s.gap, 2)} °C`, 'Surroundings minus liquid temperature.'),
      r('Height sensitivity at 20 °C', `${fixed(s.sensitivity, 3)} mm/°C`, 'Includes all liquid in the lower bulb and reference capillary fill, relative to glass expansion.'),
      r('Calibrated span shown', `${fixed(s.markedLow, 2)} to ${fixed(s.markedHigh, 2)} °C`, 'Intersection of the capillary span, liquid-phase limit and offered temperature range. Tick labels are thinned where marks are close.'),
      r('Liquid volume', `${fixed(s.liquidVolume, 4)} µL`, `Reference fill at 20 °C: ${fixed(s.referenceVolume, 4)} µL. One cubic millimeter is one microliter.`),
      r('Relative volume change', `${fixed(s.relativeVolumeChange, 4)} µL`, 'Liquid expansion minus expansion of the same initial volume of glass cavity, relative to 20 °C.'),
      r('Chosen response', `${values.response} s`, s.settle === null ? 'The freezing boundary is reached before the gap can close to 0.5 °C.' : `Gap reaches 0.5 °C or less after ${fixed(s.settle, 2)} s, if the liquid model remains valid.`),
    ]};
  });
  const render = model.update;
  model.advance = dt => {if (Number.isFinite(dt) && dt > 0 && !model.getState().complete) clock = Math.min(LIQUID_GLASS.duration, clock + dt * LIQUID_GLASS.speed); return render();};
  model.animate = time => {const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return model.advance(dt);};
  model.reset = ({time = 0} = {}) => {clock = Number.isFinite(time) ? Math.max(0, Math.min(LIQUID_GLASS.duration, time)) : 0; lastClock = 0; return render(model.defaults);};
  model.replayState = () => ({time: 0});
  const inspect = (label, id, time, view = 'front') => ({label, part: id, view, isolate: ['chart', 'bulb', 'chamber'].includes(id), replay: false, run() {if (time !== undefined) clock = typeof time === 'function' ? time(model.getState()) : time; return render();}});
  model.actions = [inspect('Inspect: complete thermometer', 'system'), inspect('Inspect: lower bulb', 'bulb', undefined, 'iso'), inspect('Inspect: liquid surface', 'meniscus', undefined, 'iso'), inspect('Inspect: capillary and scale', 'stem'), inspect('Inspect: upper chamber', 'chamber', undefined, 'iso'), inspect('Inspect: temperature response', 'chart'), inspect('Inspect: initial state', 'system', 0), inspect('Inspect: after one minute', 'system', 60), inspect('Inspect: after one time constant', 'system', s => s.values.response), inspect('Inspect: after five time constants', 'system', s => 5 * s.values.response), inspect('Inspect: end of comparison', 'system', LIQUID_GLASS.duration)];
  model.playback = {label: 'Change the surroundings', description: 'Fifteen modeled minutes. Playback speed changes the animation rate. The liquid-only model stops if mercury reaches its freezing boundary.', stepLabel: 'Advance thirty seconds', advance: model.advance, step: () => model.advance(30 / LIQUID_GLASS.speed), complete: () => model.getState().complete, blocked: () => false};
  for (const p of model.parts) {p.maxZoom = 300; p.framePadding = .62;}
  model.parts.find(p => p.id === 'chart').framePadding = .52;
  model.initialPart = 'system'; model.initialView = 'front'; model.frameVisibleOnly = true; model.framePadding = .62; model.selectionOutline = false; model.transparentBackground = true;
  model.followParts = ['meniscus']; model.thumbnailOmit = [guide, chart];
  model.frameBoundsForPart = id => {
    root.updateMatrixWorld(true);
    if (id === 'system') return new THREE.Box3(new THREE.Vector3(-82 * MM, -22 * MM, -14 * MM), new THREE.Vector3(45 * MM, 220 * MM, 14 * MM)).applyMatrix4(thermal.matrixWorld);
    if (id === 'meniscus') {const y = model.getState().meniscus; return new THREE.Box3(new THREE.Vector3(-15 * MM, (y - 8) * MM, -15 * MM), new THREE.Vector3(32 * MM, (y + 8) * MM, 15 * MM)).applyMatrix4(thermal.matrixWorld);}
    return null;
  };
  model.topology = {MM, WIDTH, system, thermal, physical, bulb, stem, chamber, meniscus, surface, scale, ticks, numbers, scaleTitle, guide, leader, levelLabel, stateLabel, widthLabel, chart, trace, target, cursor, chartPoint, chartStatus, get surfaces() {return surfaces;}, get shells() {return shells;}};
  const dispose = model.dispose; model.dispose = () => {if (!disposed) {disposed = true; dispose();}};
  return model;
}

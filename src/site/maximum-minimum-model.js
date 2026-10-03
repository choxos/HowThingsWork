import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {textLabel, lineObject} from './scene-kit.js';
import {fixed} from './format.js';
import {MAX_MIN_DEFAULTS, MAX_MIN_DOMAINS, MAX_MIN, SIX_RESERVOIR, sixLevels, sampleMaximumMinimum, sixClock} from './maximum-minimum-physics.js';

const MM = .01, SIDES = 48;
const degrees = n => `${fixed(n, 2)} °C`;
const basic = color => new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide, toneMapped: false});
const lathe = (profile, start = 0, length = 2 * Math.PI) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * MM, y * MM)), SIDES, start, length);
const setLine = (line, values) => {line.geometry.attributes.position.array.set(values); line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();};
const setSpan = (rod, lo, hi) => {rod.position.y = (lo + hi) / 2 * MM; rod.scale.y = (hi - lo) * MM;};

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

function uShell(front) {
  const path = [[-MAX_MIN.arm, MAX_MIN.top, -1, 0]];
  for (let i = 0; i <= 96; i++) {const angle = Math.PI + Math.PI * i / 96; path.push([MAX_MIN.arm * Math.cos(angle), MAX_MIN.bottom + MAX_MIN.arm * Math.sin(angle), Math.cos(angle), Math.sin(angle)]);}
  path.push([MAX_MIN.arm, MAX_MIN.top, 1, 0]);
  const profile = [];
  for (const radius of [1.2, .5]) for (let i = 0; i <= 24; i++) {const angle = (front ? 0 : Math.PI) + Math.PI * (radius === 1.2 ? i : 24 - i) / 24; profile.push([radius * Math.cos(angle), radius * Math.sin(angle)]);}
  profile.push(profile[0]);
  const vertices = [], indices = [], stride = profile.length;
  for (const [x, y, nx, ny] of path) for (const [across, z] of profile) vertices.push((x + across * nx) * MM, (y + across * ny) * MM, z * MM);
  for (let j = 0; j < path.length - 1; j++) for (let i = 0; i < stride - 1; i++) {const a = j * stride + i, b = a + stride; indices.push(a, b, a + 1, b, b + 1, a + 1);}
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function createSixThermometerModel() {
  const kit = houseModel('Maximum-minimum thermometer'), {root, part, control, finish} = kit;
  const system = part('system', 'Maximum-minimum thermometer', 'An illustrative classic Six mechanism: alcohol expands, a connected mercury thread moves around the U, and two friction-held indices remember extremes. All physical lengths share one scale.');
  const thermal = new THREE.Group(); system.add(thermal);
  const tube = part('tube', 'Connected U-tube', 'One sealed glass cavity joins both bulbs through a 1 mm bore and a curved bottom. The front glass can be hidden to see inside.', [0, 0, 0], thermal);
  const sensor = part('sensor', 'Sensing reservoir', 'This bulb and the liquid above the left mercury interface are full of alcohol. Their combined expansion drives the thread.', [-MAX_MIN.arm * MM, 0, 0], thermal);
  const receiver = part('receiver', 'Receiving reservoir', 'Alcohol partly fills this bulb. The remaining gas space accommodates changing liquid volume. Gas pressure is not calculated in this ideal volume model.', [MAX_MIN.arm * MM, 0, 0], thermal);
  const thread = part('thread', 'Alcohol and mercury thread', 'Red alcohol lies above the silver mercury in both arms. Mercury stays connected through the bend. Its own expansion makes the two scale calibrations slightly different.', [0, 0, 0], thermal);
  const minIndex = part('min-index', 'Minimum index and spring', 'Cooling raises the left mercury interface and pushes this index up. Its elastic wire presses against the glass, holding the index when mercury retreats. Read its lower end on the downward-increasing scale.', [-MAX_MIN.arm * MM, 0, 0], thermal);
  const maxIndex = part('max-index', 'Maximum index and spring', 'Warming raises the right mercury interface and pushes this index up. Its elastic wire holds the index after cooling. Read its lower end on the upward-increasing scale.', [MAX_MIN.arm * MM, 0, 0], thermal);
  const magnet = part('magnet', 'Reset magnet', 'Move an external magnet along each arm to pull the index back to the mercury. Preparing a reset freezes the weather clock while you play or step through the two returns.', [0, 0, 0], thermal);
  const magnetBody = new THREE.Group(); magnet.add(magnetBody);
  kit.box([4 * MM, 6 * MM, 3 * MM], [-2 * MM, 0, 0], 'red', magnetBody);
  kit.box([4 * MM, 6 * MM, 3 * MM], [2 * MM, 0, 0], 'blue', magnetBody);
  const shells = [];
  const glassMaterial = front => new THREE.MeshPhongMaterial({color: 0x8aaeb5, transparent: true, opacity: front ? .2 : .3, depthWrite: false, side: THREE.DoubleSide, shininess: 70});
  const outsideRadius = 6.4, outsideStart = -Math.acos(1.2 / outsideRadius), outsideCenter = MAX_MIN.top + Math.sqrt(outsideRadius ** 2 - 1.2 ** 2);
  const outside = Array.from({length: 129}, (_, i) => {const angle = outsideStart + (Math.PI / 2 - outsideStart) * i / 128; return [i === 128 ? 0 : outsideRadius * Math.cos(angle), outsideCenter + outsideRadius * Math.sin(angle)];});
  const shellProfile = [...outside, ...SIX_RESERVOIR.points.toReversed(), outside[0]];
  for (const front of [false, true]) {
    for (const [parent, geometry] of [[tube, uShell(front)], [sensor, lathe(shellProfile, front ? -Math.PI / 2 : Math.PI / 2, Math.PI)], [receiver, lathe(shellProfile, front ? -Math.PI / 2 : Math.PI / 2, Math.PI)]]) {
      const mesh = new THREE.Mesh(geometry, glassMaterial(front)); mesh.renderOrder = front ? 3 : 2; parent.add(mesh); shells.push(mesh); if (front) kit.covers.push(mesh);
    }
  }
  const alcohol = new THREE.MeshPhongMaterial({color: 0xa34531, transparent: true, opacity: .58, depthWrite: false, side: THREE.DoubleSide, shininess: 40});
  const mercury = new THREE.MeshPhongMaterial({color: 0x647780, shininess: 95});
  const leftBulb = liquidSurface(SIX_RESERVOIR.points, sensor, alcohol), rightBulb = liquidSurface(SIX_RESERVOIR.points, receiver, alcohol);
  leftBulb.update(SIX_RESERVOIR.points.at(-1)[1]);
  const arms = {};
  for (const [side, x] of [['left', -MAX_MIN.arm], ['right', MAX_MIN.arm]]) {
    arms[side] = {};
    for (const [name, material] of [['mercury', mercury], ['alcohol', alcohol]]) {const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.5 * MM, .5 * MM, 1, SIDES), material); mesh.position.x = x * MM; thread.add(mesh); arms[side][name] = mesh;}
  }
  const bend = new THREE.Mesh(new THREE.TorusGeometry(MAX_MIN.arm * MM, .5 * MM, SIDES, 96, Math.PI), mercury); bend.rotation.z = Math.PI; bend.position.y = MAX_MIN.bottom * MM; thread.add(bend);
  const markerBodies = [];
  for (const parent of [minIndex, maxIndex]) {
    const body = kit.cylinder(.22 * MM, MAX_MIN.markerLength * MM, [0, MAX_MIN.markerLength / 2 * MM, 0], 'ink', parent); markerBodies.push(body);
    const contacts = [[.22, 3.6, 0], [.38, 2.9, 0], [.48, 2, 0], [.38, 1.1, 0], [.22, .4, 0]];
    kit.tube(contacts.map(p => p.map(n => n * MM)), .02 * MM, 'gold', parent);
  }
  for (const [side, index] of [['left', minIndex], ['right', maxIndex]]) {
    arms[side].alcohol.raycast = function (raycaster, hits) {
      let visible = true;
      for (let object = index; object; object = object.parent) if (!object.visible) visible = false;
      if (visible && raycaster.intersectObject(index, true).length) return;
      THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
    };
  }
  const scales = part('scales', 'Minimum and maximum scales', 'Read the lower ends of the indices. Celsius increases downward on the minimum side and upward on the maximum side. Marks include expansion of both liquids and the glass.', [0, 0, 0], thermal);
  const ticks = lineObject(81 * 4, 0x374736, scales); ticks.geometry.dispose(); ticks.geometry = new THREE.BufferGeometry(); ticks.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(81 * 12), 3));
  const lines = new THREE.LineSegments(ticks.geometry, ticks.material); ticks.removeFromParent(); scales.add(lines);
  const labels = [];
  for (let i = 0; i <= 80; i++) {
    const temperature = i - 30, levels = sixLevels(temperature), length = temperature % 10 === 0 ? 4 : temperature % 5 === 0 ? 2.8 : 1.5;
    lines.geometry.attributes.position.array.set([-16 * MM, levels.left * MM, 0, (-16 - length) * MM, levels.left * MM, 0, 16 * MM, levels.right * MM, 0, (16 + length) * MM, levels.right * MM, 0], i * 12);
    if (temperature % 10 === 0) for (const [x, y, align] of [[-22, levels.left, 'right'], [22, levels.right, 'left']]) labels.push(textLabel(scales, String(temperature).replace('-', '−'), {height: 7 * MM, position: [x * MM, y * MM, 0], align}));
  }
  lines.geometry.computeBoundingSphere();
  textLabel(scales, 'MIN °C', {height: 7 * MM, position: [-27 * MM, 81 * MM, 0]}); textLabel(scales, 'MAX °C', {height: 7 * MM, position: [27 * MM, 81 * MM, 0]});
  const guide = new THREE.Group(); thermal.add(guide); guide.userData.inspectionOnly = 'system'; guide.userData.explosionExcluded = true;
  const timeLabel = textLabel(guide, '', {height: 9 * MM, width: 130 * MM, position: [0, 118 * MM, 0]});
  const readingLabel = textLabel(guide, '', {height: 8 * MM, width: 130 * MM, position: [0, 108 * MM, 0]});
  const minLeader = lineObject(2, 0x657a3a, guide), maxLeader = lineObject(2, 0x3d606f, guide);
  const minLabel = textLabel(guide, '', {height: 7 * MM, width: 52 * MM, align: 'right', color: '#52672f'});
  const maxLabel = textLabel(guide, '', {height: 7 * MM, width: 52 * MM, align: 'left', color: '#3d606f'});
  const statusLabel = textLabel(guide, '', {height: 8 * MM, width: 160 * MM, position: [0, -116 * MM, 0]});
  guide.traverse(o => {o.raycast = () => {};});
  const chart = part('chart', 'Day and recorded extremes', 'The prescribed air cycle and lagging instrument temperature over 24 hours. Colored horizontal lines show the stored extremes for the current recording interval. This chart is an explanation, not a physical component.');
  chart.userData.inspectionOnly = 'chart'; chart.userData.explosionExcluded = true;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(200 * MM, 180 * MM), basic(0xf0dfaf)); board.position.z = -.1 * MM; chart.add(board);
  const chartPoint = (h, T) => [(-70 + h / 24 * 154) * MM, (-38 + (T + 30) / 80 * 81) * MM, .1 * MM];
  const chartLabel = (t, x, y, extra = {}) => textLabel(chart, t, {height: 12 * MM, position: [x * MM, y * MM, .2 * MM], ...extra});
  chartLabel('Day and recorded extremes', 0, 75, {height: 13 * MM, width: 190 * MM, weight: '600'});
  chartLabel('Temperature (°C)', -88, 58, {align: 'left'});
  for (const T of [-30, 0, 50]) {const y = chartPoint(0, T)[1] / MM; chartLabel(String(T).replace('-', '−'), -76, y, {align: 'right'}); const grid = lineObject(2, 0xc4c6ac, chart); setLine(grid, [...chartPoint(0, T), ...chartPoint(24, T)]);}
  for (const [h, label] of [[0, '9 am'], [6, '3 pm'], [18, '3 am'], [24, '9 am']]) chartLabel(label, chartPoint(h, 0)[0] / MM, -49, {height: 10 * MM});
  chartLabel('Morning → next morning', 4, -62, {height: 10 * MM});
  chartLabel('Air', -68, -77, {color: '#a07724', height: 11 * MM}); chartLabel('Liquid', -23, -77, {color: '#993d2b', height: 11 * MM}); chartLabel('Max', 27, -77, {color: '#3d606f', height: 11 * MM}); chartLabel('Min', 72, -77, {color: '#657a3a', height: 11 * MM});
  const airLine = lineObject(145, 0xa07724, chart), liquidLine = lineObject(145, 0x993d2b, chart), highLine = lineObject(2, 0x3d606f, chart), lowLine = lineObject(2, 0x657a3a, chart), cursor = lineObject(2, 0x394233, chart), resetLine = lineObject(2, 0x9c8b78, chart);
  const specs = {mean: ['Day’s average', '°C', 'The center of the prescribed daily air-temperature cycle.'], swing: ['Swing either side', '°C', 'Air reaches this many degrees above the average at 3 pm and below it at 3 am.'], response: ['Response time constant', 's', 'Choose an ideal first-order lag. Zero follows the air instantly. The day starts after the periodic response has settled.']};
  for (const [key, [min, max, step]] of Object.entries(MAX_MIN_DOMAINS)) {const [label, unit, help] = specs[key]; control(key, label, min, max, step, MAX_MIN_DEFAULTS[key], unit, help);}
  let hours = 0, resetAt = 0, lastClock = 0, resetElapsed = null, chartKey, disposed = false;
  const model = finish(values => {
    const s = sampleMaximumMinimum(values, hours, resetAt), resetting = resetElapsed !== null, progress = resetting ? Math.min(1, resetElapsed / MAX_MIN.resetDuration) : 0;
    const leftProgress = Math.min(1, progress / .4), rightProgress = Math.max(0, Math.min(1, (progress - .6) / .3));
    const leftMarker = s.minIndex + (s.left - s.minIndex) * leftProgress, rightMarker = s.maxIndex + (s.right - s.maxIndex) * rightProgress;
    thermal.scale.setScalar(s.growth);
    for (const side of ['left', 'right']) {setSpan(arms[side].mercury, MAX_MIN.bottom, s[side]); setSpan(arms[side].alcohol, s[side], MAX_MIN.top);}
    rightBulb.update(s.receivingLevel); minIndex.position.y = leftMarker * MM; maxIndex.position.y = rightMarker * MM;
    if (resetting) {
      if (progress <= .4) magnetBody.position.set(-MAX_MIN.arm * MM, (leftMarker + 2) * MM, 4 * MM);
      else if (progress < .6) {const p = (progress - .4) / .2; magnetBody.position.set((-MAX_MIN.arm + 2 * MAX_MIN.arm * p) * MM, (leftMarker + (rightMarker - leftMarker) * p + 2) * MM, (4 + 5 * Math.sin(Math.PI * p)) * MM);}
      else if (progress <= .9) magnetBody.position.set(MAX_MIN.arm * MM, (rightMarker + 2) * MM, 4 * MM);
      else {const p = (progress - .9) / .1; magnetBody.position.set((MAX_MIN.arm + (30 - MAX_MIN.arm) * p) * MM, (rightMarker + 2 + (-93 - rightMarker) * p) * MM, 4 * (1 - p) * MM);}
    } else magnetBody.position.set(30 * MM, -91 * MM, 0);
    for (const [line, label, side, y, temperature] of [[minLeader, minLabel, -1, leftMarker, s.lowest], [maxLeader, maxLabel, 1, rightMarker, s.highest]]) {
      setLine(line, [side * MAX_MIN.arm * MM, y * MM, .6 * MM, side * 41 * MM, (y + 4) * MM, .6 * MM]);
      label.userData.place(side * 43 * MM, (y + 4) * MM, .6 * MM); label.userData.setText(resetting ? 'Resetting' : `${side < 0 ? 'Min' : 'Max'} ${fixed(temperature, 2)}°`);
    }
    timeLabel.userData.setText(sixClock(hours)); readingLabel.userData.setText(`Now ${degrees(s.temperature)}`);
    statusLabel.userData.setText(resetting ? 'Reset in progress · Play or step' : `Min ${fixed(s.lowest, 2)} °C · Max ${fixed(s.highest, 2)} °C`);
    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      const airPoints = [], liquidPoints = [];
      for (let i = 0; i <= 144; i++) {const at = sampleMaximumMinimum(values, i / 6); airPoints.push(...chartPoint(at.clock, at.air)); liquidPoints.push(...chartPoint(at.clock, at.temperature));}
      setLine(airLine, airPoints); setLine(liquidLine, liquidPoints);
    }
    setLine(highLine, [...chartPoint(resetAt, s.highest), ...chartPoint(hours, s.highest)]); setLine(lowLine, [...chartPoint(resetAt, s.lowest), ...chartPoint(hours, s.lowest)]);
    setLine(cursor, [...chartPoint(hours, -30), ...chartPoint(hours, 50)]); setLine(resetLine, [...chartPoint(resetAt, -30), ...chartPoint(resetAt, 50)]);
    highLine.visible = lowLine.visible = !resetting;
    const status = resetting ? (progress <= .4 ? 'Returning minimum index' : progress < .6 ? 'Moving magnet to maximum arm' : progress <= .9 ? 'Returning maximum index' : 'Putting magnet away') : 'Recording extremes';
    return {state: {...s, resetting, resetProgress: progress, leftMarker, rightMarker, complete: s.complete && !resetting}, readings: [
      r('Your result', status, resetting ? 'Weather is held fixed while the magnet returns both indices. Press Play or step to finish. Previous extremes are erased only when the reset finishes.' : `Since ${sixClock(resetAt)}: maximum ${degrees(s.highest)}, minimum ${degrees(s.lowest)}.`),
      r('Clock', sixClock(hours), 'The example runs from 9 am to 9 am the next day.'),
      r('Current liquid temperature', degrees(s.temperature), 'Both mercury interfaces indicate the current temperature on their own scales.'),
      r('Air temperature', degrees(s.air), 'A prescribed daily cycle, warmest at 3 pm and coldest at 3 am.'),
      r('Maximum index', resetting ? 'Reset in progress' : degrees(s.highest), resetting ? 'Do not read an index while the magnet moves it.' : `Reached at ${sixClock(s.highAt)}. Read the lower end of the right index.`),
      r('Minimum index', resetting ? 'Reset in progress' : degrees(s.lowest), resetting ? 'Both indices will meet their current mercury interfaces.' : `Reached at ${sixClock(s.lowAt)}. Read the lower end of the left index.`),
      r('Recording started', sixClock(resetAt), 'Resetting the indices changes this time without rewinding the day.'),
      r('Chosen response', `${values.response} s`, `The steady daily response peaks ${fixed(s.lag * 60, 2)} minutes after the air. This is a prescribed comparison, not a measured instrument response.`),
      r('Index gaps above mercury', resetting ? 'Changing during reset' : `Min ${fixed(leftMarker - s.left, 3)} mm · Max ${fixed(rightMarker - s.right, 3)} mm`, 'Distances in the reference glass geometry; a pushed index touches the advancing interface.'),
      r('Receiving gas space', `${fixed(s.gasVolume, 2)} µL`, 'The upper right reservoir stays partly empty as the liquids expand and contract.'),
      r('Liquid volumes', `${fixed(s.leftVolume * s.glassFactor, 2)} / ${fixed(s.mercuryVolume * s.glassFactor, 2)} / ${fixed(s.rightVolume * s.glassFactor, 2)} µL`, 'Left alcohol / mercury / right alcohol. All three volumes and glass expansion are included.'),
    ]};
  });
  const render = model.update;
  model.advance = dt => {
    if (Number.isFinite(dt) && dt > 0) {
      if (resetElapsed !== null) {resetElapsed = Math.min(MAX_MIN.resetDuration, resetElapsed + dt); if (resetElapsed >= MAX_MIN.resetDuration) {resetAt = hours; resetElapsed = null;}}
      else hours = Math.min(MAX_MIN.duration, hours + dt * MAX_MIN.speed);
    }
    return render();
  };
  model.animate = time => {const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return model.advance(dt);};
  model.reset = ({time = 0, since = 0, resetting = false, resetProgress = 0} = {}) => {hours = Number.isFinite(time) ? Math.max(0, Math.min(24, time)) : 0; resetAt = Number.isFinite(since) ? Math.max(0, Math.min(hours, since)) : 0; resetElapsed = resetting ? Math.max(0, Math.min(1, resetProgress)) * MAX_MIN.resetDuration : null; lastClock = 0; return render(model.defaults);};
  model.replayState = () => ({time: 0, since: 0});
  const inspect = (label, id, time, view = 'front') => ({label, part: id, view, isolate: ['sensor', 'receiver', 'chart'].includes(id), replay: false, run() {if (time !== undefined) {hours = typeof time === 'function' ? time(model.getState()) : time; resetAt = Math.min(resetAt, hours); resetElapsed = null;} return render();}});
  model.actions = [inspect('Inspect: whole instrument', 'system'), inspect('Inspect: sensing reservoir', 'sensor', undefined, 'iso'), inspect('Inspect: receiving reservoir', 'receiver', undefined, 'iso'), inspect('Inspect: minimum index', 'min-index'), inspect('Inspect: maximum index', 'max-index'), inspect('Inspect: day and records', 'chart'), inspect('Inspect: noon', 'system', 3), inspect('Inspect: warmest liquid', 'max-index', s => s.peak), inspect('Inspect: coldest liquid', 'min-index', s => s.trough), inspect('Inspect: next morning', 'system', 24),
    {label: 'Prepare magnet reset', part: 'system', view: 'front', replay: false, run() {resetElapsed = 0; return render();}},
    {label: 'Finish magnet reset', part: 'system', view: 'front', replay: false, run() {resetAt = hours; resetElapsed = null; return render();}}];
  model.playback = {label: 'Run the day or prepared reset', description: 'A day takes 96 playback seconds. Preparing a magnet reset holds the weather while Play returns both indices over six seconds, then resumes the day.', stepLabel: 'Advance fifteen minutes or one reset second', advance: model.advance, step: () => model.advance(1), complete: () => model.getState().complete, blocked: () => false};
  model.initialPart = 'system'; model.initialView = 'front'; model.frameVisibleOnly = true; model.framePadding = .62; model.selectionOutline = false; model.transparentBackground = true;
  model.thumbnailOmit = [guide, chart]; model.followParts = ['min-index', 'max-index'];
  for (const p of model.parts) {p.maxZoom = 300; p.framePadding = .62;}
  model.frameBoundsForPart = id => {
    root.updateMatrixWorld(true);
    if (id === 'system') return new THREE.Box3(new THREE.Vector3(-85 * MM, -123 * MM, -12 * MM), new THREE.Vector3(85 * MM, 124 * MM, 12 * MM)).applyMatrix4(thermal.matrixWorld);
    if (['min-index', 'max-index'].includes(id)) {const s = model.getState(), left = id === 'min-index', x = left ? -MAX_MIN.arm : MAX_MIN.arm, y = left ? s.leftMarker : s.rightMarker; return new THREE.Box3(new THREE.Vector3((x - 16) * MM, (y - 9) * MM, -10 * MM), new THREE.Vector3((x + 16) * MM, (y + 11) * MM, 10 * MM)).applyMatrix4(thermal.matrixWorld);}
    return null;
  };
  model.topology = {MM, system, thermal, tube, sensor, receiver, thread, minIndex, maxIndex, markerBodies, magnet, magnetBody, shells, arms, bend, leftBulb, rightBulb, scales, lines, labels, guide, timeLabel, readingLabel, statusLabel, minLeader, maxLeader, minLabel, maxLabel, chart, chartPoint, airLine, liquidLine, highLine, lowLine, cursor, resetLine};
  const dispose = model.dispose; model.dispose = () => {if (!disposed) {disposed = true; dispose();}};
  return model;
}

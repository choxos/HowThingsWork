import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject} from './scene-kit.js';
import {spurGearShape} from './gear-geometry.js';
import {ESCAPEMENT, PALLETS, escapeOutline} from './clock-escapement.js';
import {sampleClock, clockPlan, RODS, CARE, CLOCK, GEAR_TEETH as N, CLOCK_DEFAULTS as D, CLOCK_DOMAINS} from './pendulum-clock-physics.js';

const MM = .002, TAU = 2 * Math.PI, DURATION = 60;
const ESCAPE = [35, 55, -8], ANCHOR = [35, 55 + ESCAPEMENT.pivotHeight, -8];
const SUSPENSION = [ANCHOR[0], ANCHOR[1], -68], START = 10 * 3600 + 8 * 60 + 30;
const WEIGHT = {x: -45 - CLOCK.drumRadius * 1000, radius: 25, top: -460, barrel: [-45, 0], z: -55};
const CHART = {left: 240, bottom: -500, width: 350, height: 240, spread: 10};
const ROD_COLORS = [0x526e60, 0x996d16, 0x2f6690];
export const chartPoint = (temperature, change) => [(CHART.left + (temperature - 10) / 20 * CHART.width) * MM, (CHART.bottom + (change / CHART.spread + 1) / 2 * CHART.height) * MM, 0];
export const weightHeight = mass => mass / (11340 * Math.PI * (WEIGHT.radius / 1000) ** 2) * 1000;
export const rateChange = (values, rod, temperature) => {
  const at = clockPlan({...values, rod, temperature}), base = clockPlan({...values, rod, temperature: 20});
  return at.running && base.running ? at.rate - base.rate : null;
};
export function escapeWheelShape() {
  const shape = new THREE.Shape(escapeOutline().map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes.push(new THREE.Path().absarc(0, 0, 1.4, 0, TAU, true));
  for (let i = 0; i < 4; i++) shape.holes.push(new THREE.Path().absarc(11 * Math.cos(i * TAU / 4), 11 * Math.sin(i * TAU / 4), 6, 0, TAU, true));
  return shape;
}
const meshPhase = (driver, driven, bearing) => (Math.PI + bearing + driver / driven * bearing - Math.PI / driven) % (TAU / driven);

export function createPendulumClockModel() {
  const kit = houseModel('Mechanical clock'), {root, part, control, covers} = kit;
  const textures = [], labels = [], shafts = [], bearings = [];
  const system = part('system', 'Pendulum clock', 'A falling weight supplies energy. A toothed train and deadbeat anchor escapement release two beats per pendulum cycle. The hands follow that same train.');
  const body = part('case', 'Case and movement supports', 'The cutaway wooden case supports the arbors and pendulum. All physical lengths share one scale.', [0, 0, 0], system);
  covers.push(kit.box([310 * MM, 1230 * MM, 12 * MM], [0, -435 * MM, -95 * MM], 'wood', body));
  for (const side of [-1, 1]) covers.push(kit.box([10 * MM, 1230 * MM, 180 * MM], [side * 155 * MM, -435 * MM, 0], 'wood', body));
  for (const y of [-1050, 180]) covers.push(kit.box([320 * MM, 10 * MM, 180 * MM], [0, y * MM, 0], 'wood', body));
  const door = kit.box([310 * MM, 1230 * MM, 4 * MM], [0, -435 * MM, 90 * MM], 'blue', body);
  door.material = door.material.clone(); door.material.transparent = true; door.material.opacity = .16; covers.push(door);
  const movement = part('movement', 'Clock movement', 'Inspect the actual toothed train, two concentric pallet faces, and the separate twelve-to-one hand reduction.', [0, 0, 0], system);
  const train = part('train', 'Wheel train', '160:20, 120:20 and 200:20 external gear pairs connect the winding barrel to the escape wheel. The escape wheel turns sixty times for each center-wheel turn.', [0, 0, 0], movement);
  function extrude(shape, depth, parent, color, position = [0, 0, 0]) {
    const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 32}); geometry.scale(MM, MM, MM);
    const mesh = surface(kit, geometry, color, parent); mesh.position.set(...position.map(v => v * MM)); return mesh;
  }
  function annulus(outer, inner) {
    const shape = new THREE.Shape().absarc(0, 0, outer, 0, TAU, false);
    shape.holes.push(new THREE.Path().absarc(0, 0, inner, 0, TAU, true));
    return shape;
  }
  function gear(teeth, module, z, parent, color, phase = 0, bore = 1.4) {
    const shape = spurGearShape({teeth, module, bore}), radius = teeth * module / 2;
    if (radius > 15) for (let i = 0; i < 4; i++) shape.holes.push(new THREE.Path().absarc(.57 * radius * Math.cos(i * TAU / 4), .57 * radius * Math.sin(i * TAU / 4), .27 * radius, 0, TAU, true));
    const mesh = extrude(shape, 2, parent, color, [0, 0, z]); mesh.rotation.z = phase;
    mesh.userData.teeth = teeth; mesh.userData.module = module; mesh.userData.mountingPhase = phase; return mesh;
  }
  function arbor(id, name, description, x, y, end) {
    const group = part(id, name, description, [x * MM, y * MM, 0], train);
    shafts.push(kit.disk(1.4 * MM, (end + 86) * MM, [0, 0, (end - 86) / 2 * MM], 'ink', group));
    bearings.push(extrude(annulus(4, 1.6), 4, body, 'gold', [x, y, -84]));
    extrude(annulus(3, 1.6), 12, body, 'metal', [x, y, -92]);
    return group;
  }
  const barrel = arbor('barrel', 'Winding barrel and great wheel', 'The cord pulls the left side of a fixed-radius drum. Its 160-tooth great wheel turns the center pinion with 20 teeth.', -45, 0, -40);
  const center = arbor('center-wheel', 'Center wheel and pinion', 'The 20-tooth pinion and 120-tooth wheel share one shaft with the minute hand. One full center turn represents one hour.', 0, 0, 43);
  const third = arbor('third-wheel', 'Third wheel and pinion', 'A 20-tooth pinion is driven six times as fast as the center wheel. Its 200-tooth wheel drives the escape pinion ten times faster again.', 35, 0, -20);
  const escapePinion = arbor('escape-pinion', 'Escape-wheel pinion and arbor', 'This 20-tooth pinion shares the escape-wheel shaft. Its seconds hand turns once per sixty displayed seconds.', ESCAPE[0], ESCAPE[1], 40);
  const gears = {
    barrel: gear(N.barrel, .5, -42, barrel, 'gold'),
    centerPinion: gear(N.centerPinion, .5, -42, center, 'metal', meshPhase(N.barrel, N.centerPinion, 0)),
    center: gear(N.center, .5, -32, center, 'gold'),
    thirdPinion: gear(N.thirdPinion, .5, -32, third, 'metal', meshPhase(N.center, N.thirdPinion, 0)),
    third: gear(N.third, .5, -22, third, 'gold'),
    escapePinion: gear(N.escapePinion, .5, -22, escapePinion, 'metal', meshPhase(N.third, N.escapePinion, Math.PI / 2)),
  };
  const drum = kit.disk(CLOCK.drumRadius * 1000 * MM, 12 * MM, [0, 0, WEIGHT.z * MM], 'wood', barrel);
  kit.box([1 * MM, 6 * MM, 1 * MM], [0, 4 * MM, -48 * MM], 'ink', barrel);

  const escapement = part('escapement', 'Anchor escapement', 'A 30-tooth escape wheel meets two working pallets. Curved faces lock without recoil; sloping faces push the anchor through two degrees; each release advances half a tooth.', [0, 0, 0], movement);
  const escapeWheel = extrude(escapeWheelShape(), 2, escapement, 'gold', ESCAPE);
  const anchor = new THREE.Group(); anchor.position.set(...ANCHOR.map(v => v * MM)); escapement.add(anchor);
  const palletParts = PALLETS.map(p => part(`${p.side}-pallet`, `${p.side === 'entry' ? 'Entry' : 'Exit'} pallet`, 'The curved locking face is concentric with the anchor pivot. The straight impulse face allows the tooth to advance while pushing the anchor.', [0, 0, 0], anchor));
  const palletMeshes = PALLETS.map((p, i) => {
    const mesh = extrude(new THREE.Shape(p.outline.map(([x, y]) => new THREE.Vector2(x, y))), 2, palletParts[i], 'red');
    const heel = p.outline[0];
    kit.rod([0, 0, -5 * MM], [heel[0] * MM, heel[1] * MM, -5 * MM], 1.4 * MM, 'metal', anchor);
    kit.disk(1.2 * MM, 7 * MM, [heel[0] * MM, heel[1] * MM, -2 * MM], 'metal', anchor);
    return mesh;
  });
  const anchorShaft = kit.disk(3 * MM, 76 * MM, [0, 0, -38 * MM], 'ink', anchor);
  extrude(annulus(5, 3.2), 4, body, 'gold', [ANCHOR[0], ANCHOR[1], -84]);
  extrude(annulus(4, 3.2), 12, body, 'metal', [ANCHOR[0], ANCHOR[1], -92]);
  const crutch = kit.rod([0, 0, -51 * MM], [0, -100 * MM, -51 * MM], 1.1 * MM, 'metal', anchor);
  kit.box([9 * MM, 3 * MM, 3 * MM], [0, -100 * MM, -51 * MM], 'metal', anchor);
  const fork = [-1, 1].map(side => kit.box([1 * MM, 5 * MM, 14 * MM], [side * 2.5 * MM, -100 * MM, -56 * MM], 'metal', anchor));

  const dial = part('dial', 'Dial and hand reduction', 'The minute shaft drives 30:90 and 18:72 gear pairs. Two reversals keep both hands clockwise; together the pairs slow the hour hand twelvefold.', [0, 0, 0], movement);
  const motionWork = part('motion-work', 'Twelve-to-one hand reduction', 'The minute shaft carries 30 teeth, driving a 90-tooth wheel. Its attached 18-tooth pinion drives a 72-tooth hour wheel on a hollow sleeve around the minute shaft.', [0, 0, 0], dial);
  const cannon = new THREE.Group(), motion = new THREE.Group(), hourWheel = new THREE.Group();
  motionWork.add(cannon, motion, hourWheel); motion.position.x = -24 * MM;
  gears.cannon = gear(N.cannon, .4, 6, cannon, 'metal');
  gears.motion = gear(N.motion, .4, 6, motion, 'gold', meshPhase(N.cannon, N.motion, Math.PI));
  gears.motionPinion = gear(N.motionPinion, 8 / 15, 12, motion, 'metal');
  gears.hour = gear(N.hour, 8 / 15, 12, hourWheel, 'gold', meshPhase(N.motionPinion, N.hour, 0), 2.7);
  kit.disk(1.4 * MM, 18 * MM, [-24 * MM, 0, 10 * MM], 'ink', dial);
  extrude(annulus(5, 1.6), 4, body, 'gold', [-24, 0, 1]);
  kit.rod([-125 * MM, 0, 2 * MM], [-28 * MM, 0, 2 * MM], 3 * MM, 'metal', body);
  kit.rod([-125 * MM, 0, -92 * MM], [-125 * MM, 0, 2 * MM], 3 * MM, 'metal', body);
  const sleeve = extrude(annulus(2.7, 1.6), 27, hourWheel, 'metal', [0, 0, 12]);
  const ring = surface(kit, new THREE.RingGeometry(91 * MM, 124 * MM, 96), 'cream', dial, true); ring.position.z = 33 * MM;
  for (let i = 0; i < 60; i++) {
    const mark = kit.box([(i % 5 ? 1 : 3) * MM, (i % 5 ? 5 : 12) * MM, MM], [111 * Math.sin(TAU * i / 60) * MM, 111 * Math.cos(TAU * i / 60) * MM, 35 * MM], 'ink', dial); mark.rotation.z = -TAU * i / 60;
  }
  kit.ring(27 * MM, .8 * MM, [ESCAPE[0] * MM, ESCAPE[1] * MM, 35 * MM], 'ink', dial);
  function hand(length, width, pivot, color, bore = 0) {
    const group = new THREE.Group(); group.position.set(...pivot.map(v => v * MM)); dial.add(group);
    const start = bore ? 2.7 : 0;
    kit.box([width * MM, (length - start) * MM, 1.5 * MM], [0, (length + start) / 2 * MM, 0], color, group);
    if (bore) extrude(annulus(width, bore), 2, group, color, [0, 0, -1]);
    else kit.disk(Math.max(2, width) * MM, 2 * MM, [0, 0, 0], color, group);
    return group;
  }
  const hourHand = hand(65, 5, [0, 0, 38], 'ink', 1.6), minuteHand = hand(100, 3, [0, 0, 41], 'ink'), secondsHand = hand(24, 1.2, [ESCAPE[0], ESCAPE[1], 38], 'red');

  const pendulum = part('pendulum', 'Pendulum and rating nut', 'A 1.5 kg bob swings from the same axis as the anchor, through a rear crutch. The rating nut sets the suspension-to-bob distance. Rendered length includes thermal expansion.', SUSPENSION.map(v => v * MM), system);
  const regulator = part('regulator', 'Bob and rating nut', 'The threaded rating nut supports the bob. Raising it shortens the distance from suspension to bob center, making the clock faster.', [0, 0, 0], pendulum);
  const rod = kit.cylinder(2 * MM, 1, [0, 0, 0], 'metal', pendulum); rod.material = rod.material.clone();
  const bob = kit.disk(60 * MM, 22 * MM, [0, 0, 0], 'gold', regulator), nut = kit.cylinder(7 * MM, 10 * MM, [0, -65 * MM, 0], 'ink', regulator);
  const thread = lineObject(961, 0x374736, pendulum);
  for (let i = 0; i <= 960; i++) { const a = i / 960 * TAU * 60; thread.geometry.attributes.position.setXYZ(i, 2.15 * Math.cos(a) * MM, (-1045 - i / 960 * 30) * MM, 2.15 * Math.sin(a) * MM); }
  thread.geometry.computeBoundingSphere();
  const weight = part('weight', 'Driving weight and cord', 'The lead cylinder unwinds the barrel. At the designed rate it falls 15 cm per day; actual travel follows the visible train. During this minute the movement is small, about a tenth of a millimeter.', [0, 0, 0], system);
  const lead = kit.cylinder(WEIGHT.radius * MM, 1, [WEIGHT.x * MM, 0, WEIGHT.z * MM], 'metal', weight);
  const hook = kit.ring(3 * MM, .8 * MM, [WEIGHT.x * MM, 0, WEIGHT.z * MM], 'metal', weight);
  const cord = lineObject(51, 0x374736, weight);

  const chart = part('chart', 'Temperature comparison', 'Rate change relative to the same clock at 20 °C. Labeled axes show temperature and seconds gained or lost per day. This comparison panel is not a physical clock part.', [0, 0, 0], system);
  chart.userData.explosionExcluded = true;
  function label(text, x, y, width, parent = chart, height = 13, color = '#394233') {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas'); let texture, ctx;
    if (canvas) { canvas.width = 1024; canvas.height = Math.round(1024 * height / width); ctx = canvas.getContext('2d'); texture = new THREE.CanvasTexture(canvas); }
    else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * MM, height * MM), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide}));
    mesh.position.set(x * MM, y * MM, 2 * MM); parent.add(mesh); mesh.raycast = () => {}; labels.push(mesh);
    mesh.userData.setText = value => { if (mesh.userData.labelText === value) return; mesh.userData.labelText = value; if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = `${canvas.height * .78}px sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, canvas.width / 2, canvas.height / 2, canvas.width); } texture.needsUpdate = true; };
    mesh.userData.setText(text); return mesh;
  }
  const chartTitle = label('Rate change from 20 °C (seconds/day)', 415, -225, 400);
  label('Room temperature (°C)', 415, -535, 300);
  for (const change of [-10, -5, 0, 5, 10]) {
    const a = chartPoint(10, change), b = chartPoint(30, change);
    kit.rod(a, b, (change ? .35 : .7) * MM, 'metal', chart); label(`${change > 0 ? '+' : ''}${change}`, 215, a[1] / MM, 38);
  }
  for (const temp of [10, 15, 20, 25, 30]) { const p = chartPoint(temp, -10); label(String(temp), p[0] / MM, -515, 40); }
  RODS.forEach((entry, i) => label(entry.label, 295 + i * 120, -565, 105, chart, 13, `#${ROD_COLORS[i].toString(16).padStart(6, '0')}`));
  const lines = RODS.map((_, i) => lineObject(21, ROD_COLORS[i], chart));
  const marker = kit.sphere(3 * MM, [0, 0, 0], 'red', chart);
  const specs = {
    length: ['Pendulum length at 20 °C', 'mm', null, 'Suspension to bob center. Shorten it to make the clock run faster.'],
    rod: ['Pendulum rod', '', RODS.map(({value, label}) => ({value, label})), 'The rod expands with temperature. Compare metals using Inspect: temperature chart.'],
    temperature: ['Room temperature', '°C', null, 'Changes the actual rod length and clock rate.'],
    weight: ['Driving weight', 'kg', null, 'Changes work per beat and the settled swing, not the gear ratios.'],
    care: ['Movement condition', '', CARE.map(({value, label}) => ({value, label})), 'Lower Q means more energy lost each period; insufficient swing stops the clock.'],
  };
  for (const [name, [min, max, step]] of Object.entries(CLOCK_DOMAINS)) { const [title, unit, options, help] = specs[name]; control(name, title, min, max, step, D[name], unit, help, options); }
  let time = 0, lastClock = 0, initialPhase = 0, physicalKey = '', disposed = false;
  const result = kit.finish(values => {
    const key = JSON.stringify(values), changed = key !== physicalKey; if (changed) { time = initialPhase * clockPlan(values).period; lastClock = 0; physicalKey = key; }
    const s = sampleClock(values, time), length = s.L * 1000, height = weightHeight(values.weight);
    pendulum.rotation.z = anchor.rotation.z = s.angle;
    const thermal = length / values.length, rodLength = 1075 * thermal;
    rod.material.color.set(ROD_COLORS[values.rod]); rod.scale.y = rodLength * MM; rod.position.y = -rodLength / 2 * MM; thread.scale.y = thermal;
    regulator.position.y = -length * MM;
    barrel.rotation.z = s.gears.barrel; center.rotation.z = s.gears.center; third.rotation.z = s.gears.third; escapePinion.rotation.z = escapeWheel.rotation.z = s.gears.escape;
    cannon.rotation.z = s.gears.cannon; motion.rotation.z = s.gears.motion; hourWheel.rotation.z = s.gears.hour;
    const shown = START + s.clockSeconds;
    secondsHand.rotation.z = -TAU * (START % 60) / 60 + s.gears.escape;
    minuteHand.rotation.z = -TAU * START / 3600 + s.gears.center;
    hourHand.rotation.z = -TAU * START / 43200 + s.gears.hour;
    const top = WEIGHT.top - s.descent * 1000;
    lead.scale.y = height * MM; lead.position.y = (top - height / 2) * MM; hook.position.y = (top + 3) * MM;
    const positions = cord.geometry.attributes.position;
    for (let i = 0; i < 50; i++) { const a = s.gears.barrel + i / 49 * (Math.PI - s.gears.barrel); positions.setXYZ(i, (WEIGHT.barrel[0] + CLOCK.drumRadius * 1000 * Math.cos(a)) * MM, CLOCK.drumRadius * 1000 * Math.sin(a) * MM, WEIGHT.z * MM); }
    positions.setXYZ(50, WEIGHT.x * MM, (top + 6) * MM, WEIGHT.z * MM); positions.needsUpdate = true; cord.geometry.computeBoundingSphere();
    if (changed) lines.forEach((line, i) => { line.visible = s.running; if (s.running) { for (let j = 0; j <= 20; j++) line.geometry.attributes.position.array.set(chartPoint(10 + j, rateChange(values, i, 10 + j)), j * 3); line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere(); } });
    marker.visible = s.running; if (s.running) marker.position.set(...chartPoint(values.temperature, rateChange(values, values.rod, values.temperature)));
    chartTitle.userData.setText(s.running ? 'Rate change from 20 °C (seconds/day)' : 'Clock stopped; no running rate to compare');
    const degrees = s.theta * 180 / Math.PI, whole = Math.floor(shown + 1e-8), hms = `${Math.floor(whole / 3600) % 12 || 12}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
    const rateText = s.rate === null ? 'Stopped' : `${s.rate >= 0 ? 'Gains' : 'Loses'} ${fixed(Math.abs(s.rate), 2)} s/day`;
    return {state: {...s, shown}, readings: [
      r('Your result', rateText, s.running ? 'Fixed gears count sixty beats per displayed minute. They are designed for a two-second pendulum period.' : `Supported swing ${fixed(degrees, 2)}° is below the ${fixed(CLOCK.release * 180 / Math.PI, 2)}° release requirement. Increase drive or choose a clean movement.`),
      r('Escapement', s.stage, s.stage === 'Impulse' ? 'A tooth slides along a sloping face and pushes the pendulum.' : s.stage === 'Drop' ? 'The tooth has cleared; the wheel advances to the other locking face.' : s.running ? 'A concentric face holds every gear still while the pendulum continues swinging.' : 'The train holds still at a static pallet contact.'),
      r('Dial', hms, `${s.beats} completed releases. Seconds, minutes and hours all follow the same gear train.`),
      r('Pendulum period', `${fixed(s.period, 6)} s`, 'Time there and back at the supported swing. Exactly 2 s would give zero average rate error.'),
      r('Actual pendulum length', `${fixed(length, 4)} mm`, `${RODS[values.rod].label}: expansion ${fixed(RODS[values.rod].expansion * 1e6, 1)} millionths per degree. Now ${fixed(Math.abs(s.growth) * 1e6, 1)} µm ${s.growth >= 0 ? 'longer' : 'shorter'} than at 20 °C. Length is measured to bob center; the threaded rod continues below it.`),
      r('Supported swing', `${fixed(degrees, 2)}° each way`, s.running ? 'Settled amplitude where work per cycle replaces loss. Wider swings take slightly longer.' : 'This predicted amplitude cannot sustain releases; the pictured pendulum is at rest.'),
      r('Weight travel', `${fixed(s.descent * 1e6, 2)} µm`, 'Actual drum rotation times radius. About 104 µm per displayed minute; too small for a dramatic visible fall at this scale.'),
      r('Energy per beat', `${fixed(s.beatEnergy * 1e6, 2)} µJ`, s.running ? `25% of the weight's ${fixed(s.beatWork * 1e6, 2)} µJ of work reaches the pendulum. Average delivered power ${fixed(s.power * 1e6, 2)} µW.` : 'No repeating beats means no continuing weight descent or delivered power.'),
      r('Circular error', `${fixed((s.period / s.small - 1) * 1e6, 1)} ppm`, 'Increase in period compared with an infinitesimal swing of the same length.'),
      r('One-week projection', s.week === null ? 'Unavailable while stopped' : `${fixed(Math.abs(s.week), 1)} s ${s.week >= 0 ? 'fast' : 'slow'}`, 'Average rate extrapolated with unchanged temperature, drive and friction; this is not a seven-day simulation.'),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0 && result.getState().running) time = Math.min(DURATION, time + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = ({phase = 0} = {}) => {
    if (!Number.isFinite(phase) || phase < 0 || phase > 1) throw new RangeError('Initial clock phase must be between zero and one');
    initialPhase = phase; time = lastClock = 0; physicalKey = ''; return render(result.defaults);
  };
  result.actions = [
    {label: 'Inspect: clock movement', part: 'movement', view: 'front', replay: false, run: () => render()},
    ...[['entry lock', .05], ['entry impulse', .25], ['exit lock', .45], ['exit impulse', .75]].map(([name, phase]) => ({label: `Inspect: ${name}`, part: 'escapement', view: 'front', replay: false, run() { time = clockPlan(result.getState().values).period * phase; return render(); }})),
    ...[['entry', .25], ['exit', .75]].map(([name, phase]) => ({label: `Inspect: ${name} contact`, part: `${name}-pallet`, view: 'front', replay: false, run() { time = clockPlan(result.getState().values).period * phase; return render(); }})),
    {label: 'Inspect: wheel train', part: 'train', isolate: true, view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: hand reduction', part: 'motion-work', isolate: true, view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: bob and rating nut', part: 'regulator', view: 'front', replay: false, run: () => render()},
    {label: 'Inspect: temperature chart', part: 'chart', isolate: true, view: 'front', replay: false, run: () => render()},
  ];
  result.playback = {label: 'Run clock for one minute', description: 'Sixty seconds of real time after the swing has settled. Low drive can block playback. Reset rewinds the demonstration and restores default settings.', stepLabel: 'Advance one beat', advance: result.advance, step: () => result.advance(clockPlan(result.getState().values).period / 2), complete: () => time >= DURATION, blocked: () => !result.getState().running};
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .6; result.selectionOutline = false; result.transparentBackground = true;
  Object.assign(result.parts.find(p => p.id === 'motion-work'), {maxZoom: 80, framePadding: .7});
  for (const entry of result.parts.filter(p => p.id.endsWith('-pallet'))) { entry.maxZoom = 200; entry.framePadding = 3; }
  result.frameBoundsForPart = id => {
    root.updateWorldMatrix(true, false);
    if (id === 'system') { const b = new THREE.Box3(); for (const object of [body, movement, pendulum, weight]) b.union(new THREE.Box3().setFromObject(object)); return b; }
    if (id === 'escapement') { const b = new THREE.Box3().setFromObject(escapeWheel); palletMeshes.forEach(p => b.union(new THREE.Box3().setFromObject(p))); b.expandByPoint(anchor.getWorldPosition(new THREE.Vector3())); return b; }
    return null;
  };
  result.thumbnailOmit = [chart];
  result.topology = {system, body, movement, dial, motionWork, hourHand, minuteHand, secondsHand, train, gears, barrel, center, third, escapePinion, cannon, motion, hourWheel, sleeve, drum, shafts, bearings, escapement, escapeWheel, anchor, anchorShaft, palletParts, palletMeshes, crutch, fork, pendulum, regulator, rod, bob, nut, thread, weight, lead, hook, cord, chart, chartTitle, lines, marker, labels, textures, MM, START, WEIGHT, DURATION, ESCAPE, ANCHOR, SUSPENSION};
  const dispose = result.dispose; result.dispose = () => { if (disposed) return; disposed = true; textures.forEach(t => t.dispose()); dispose(); };
  return result;
}

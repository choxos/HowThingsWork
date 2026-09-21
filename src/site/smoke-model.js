import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines} from './scene-kit.js';
import {
  smokePlan, smokeAt, trackOf, ionDensity, pairsPerMillimeter, airEnergyAfter, afterGold, airRange,
  SENSING, REFERENCE, CHAMBER, OPTICS, SMOKE, AMERICIUM, LINES, RATED, EMITTER, DIODE,
  IONIZATION_IC, PHOTO_IC, PHOTO_LIMIT, PAIR_ENERGY, SIZE_OPTIONS, SMOKE_DEFAULTS, SMOKE_DOMAINS,
} from './smoke-physics.js';

// ---------------------------------------------------------------------------
// Smoke detector: a combination alarm at true size, its ionization chamber cut
// open with the alpha particles crossing it and the ions they leave, the
// americium button that fires them, its optical chamber cut open with the
// light scattered off the smoke, the comparators that decide, and the run.
//
// Scale: the alarm is drawn at true size, 1 mm to 0.01 scene units; what is
// inside it is arranged for the drawing. The ionization chambers are cut open
// 4 times larger, 1 mm to 0.04 units. The americium button is cut open 15
// times larger across and 150 times larger through its thickness, so that its
// gold cover, one percent of that thickness, can be seen. The optical chamber
// is cut open 2.5 times larger, 1 mm to 0.025 units. Ions and smoke particles
// are drawn as dots, far larger than they are and fewer, said in the part
// text. The gauges and the charts are not to scale.
//
// Time: the run lasts 10 minutes and is drawn 20 times faster, said in the
// part text and in a reading.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const ION = 0.04;
export const BUTTON = 0.15;
export const THROUGH = 1.5;
export const OPTIC = 0.025;

/** How many times larger than true size a scale per millimeter draws. */
export const timesLarger = perMillimeter => perMillimeter / MM;

/** Inside the alarm, mm about the middle of its disk: where the drawing puts the battery, the horn, the two chambers and the test button. */
export const ALARM = Object.freeze({
  origin: Object.freeze([-2.02, 0.56, 0]), radius: RATED.disk / 2, board: Object.freeze([104, 84]),
  battery: Object.freeze([-26, -26]), horn: Object.freeze([30, 26]), hornRadius: 16,
  ion: Object.freeze([-24, 20]), photo: Object.freeze([20, -6]), test: Object.freeze([-2, 42]), testRadius: 6, vents: 24,
});
/** The ionization chambers, mm from the middle of the source’s face: the two gaps, the radius, the plates, the wall between the halves, the dots drawn for the open half in clean air, and the alpha tracks drawn. */
export const IONS = Object.freeze({origin: Object.freeze([-0.65, -0.33, 0]), plate: 1.2, wall: 0.35, dots: 54, room: 150, dotRadius: 0.32, margin: 0.8, pair: 0.6, smokeDot: 4e-6, smokeCap: 90, tracks: 8, seed: 2026, sign: 2.4, bar: 0.6});
/** The americium button, mm: the layers under its face, and the chart of what one alpha leaves behind it. */
export const SOURCE = Object.freeze({origin: Object.freeze([-1.86, -0.92, 0]), holder: 7.4, silver: 0.09, core: 0.108, cover: AMERICIUM.thickness * AMERICIUM.coverShare, rim: 0.5, chart: Object.freeze({x: -1.26, y: -1.3, w: 1.15, h: 0.52, far: 40, top: 8000, tick: 10, mark: 0.02})});
/** The optical chamber, mm about the smoke the beam lights: the chamber’s wall, the emitter and the two photodiodes. */
export const OPTIC_VIEW = Object.freeze({origin: Object.freeze([0.62, 0.52, 0]), wall: 23, emitter: Object.freeze([4, 3]), diode: Object.freeze([3.1, 2.4]), vents: 5, ray: 0.9});
/** The gauges, in scene units: four bars with a line across each, and the horn. */
export const GAUGE = Object.freeze({origin: Object.freeze([1.86, 0.52, 0]), width: 0.11, height: 0.62, gap: 0.19, base: -0.32, horn: Object.freeze([0.0, 0.92]), hornRadius: 0.09, arcs: 3});
/** The chart of the run, in scene units: time across, and how far each detector has come toward its alarm up the side. */
export const CHART = Object.freeze({x: 0.02, y: -1.3, w: 2.3, h: 0.52, top: 1.5, tickEvery: 60, tick: 0.02, cursor: 0.02, z: 0});
export const COLORS = Object.freeze({
  case: 0xe8e2d2, rim: 0x6f6a5c, board: 0x4f6b52, batteryBody: 0x2f3336, batteryTop: 0xb4c5b0, horn: 0x9aa39a, sound: 0xc14f39,
  metal: 0xb7bcae, sealed: 0x8f989b, open: 0xcfd6c8, wall: 0x6f6a5c, holder: 0xa9b0a4, silver: 0xd7dbd2, core: 0x6b5f3f, gold: 0xe3b45e,
  track: 0xd99a2b, positive: 0xc14f39, negative: 0x2b5d9c, smoke: 0x5c5a55, beam: 0xb03a4a, ray: 0xd99a2b, diode: 0x37474f, face: 0x8aa0aa,
  chart: 0x374736, faint: 0x9aa39a, ion: 0x2b5d9c, photo: 0xc14f39, limit: 0x6f6a5c, alarm: 0xc14f39, ink: 0x374736,
});

/** Where a time, s, and a share of the way to an alarm fall on the chart. */
export const chartX = time => CHART.x + Math.max(0, Math.min(1, time / SMOKE.duration)) * CHART.w;
export const chartY = share => CHART.y + Math.max(0, Math.min(1, share / CHART.top)) * CHART.h;
/** Where a share of a gauge’s full scale falls, for the gauge in column `column`. */
export const gaugeX = column => GAUGE.base + column * GAUGE.gap;
export const gaugeY = share => Math.max(0, Math.min(1, share)) * GAUGE.height;

/** Points, in mm, of a circle of `radius` about `center`. */
export function circlePoints(radius, center = [0, 0], count = 48, from = 0, to = 2 * Math.PI) {
  return Array.from({length: count + 1}, (_, i) => {
    const angle = from + (to - from) * i / count;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  });
}

/** Places for the dots that stand for ions and for smoke, each a pair in [0, 1), from a fixed seed so they do not dance. */
export function dotPlaces(count, seed) {
  let state = seed >>> 0;
  const next = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({length: count}, () => [next(), next()]);
}

export function createSmokeDetectorModel() {
  const kit = houseModel('Smoke detector'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const disc = (color, parent, segments = 48) => { const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, segments), unlit(color)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const put = (mesh, x, y, radius, z = 0) => { mesh.position.set(x, y, z); mesh.scale.set(radius, radius, 1); };
  const frame = (line, x, y, w, h, z = 0) => fillLine(line, [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]]);

  const system = part('system', 'Smoke alarm, cut open', `A combination smoke alarm at true size, its ionization chambers cut open ${fixed(timesLarger(ION), 0)} times larger, the americium button that feeds them ${fixed(timesLarger(BUTTON), 0)} times larger across, its optical chamber cut open ${fixed(timesLarger(OPTIC), 1)} times larger, and the two comparators that sound the horn. Press Play to let smoke build up in the room: the run of ${fixed(SMOKE.duration / 60, 0)} minutes is drawn ${SMOKE.speed} times faster than it happens.`);

  // The alarm at true size.
  const detector = part('detector', 'The alarm, true size', `A smoke alarm ${fixed(RATED.disk, 0)} mm across and ${fixed(RATED.thick, 0)} mm thick, drawn at true size and opened up. Inside: a ${fixed(RATED.battery[0], 1)} mm by ${fixed(RATED.battery[1], 1)} mm nine volt battery, the horn, the ionization chamber with its source, and the optical chamber, which the two close ups follow. Where the parts sit inside is arranged for the drawing.`, ALARM.origin, system);
  const shell = disc(COLORS.case, detector, 64);
  put(shell, 0, 0, ALARM.radius * MM, -0.004);
  const rim = lineObject(49, COLORS.rim, detector);
  fillLine(rim, circlePoints(ALARM.radius).map(([x, y]) => [x * MM, y * MM, -0.003]));
  const board = flat(COLORS.board, detector);
  rect(board, -ALARM.board[0] / 2 * MM, ALARM.board[0] / 2 * MM, -ALARM.board[1] / 2 * MM, ALARM.board[1] / 2 * MM, -0.0025);
  const battery = flat(COLORS.batteryBody, detector), batteryTop = flat(COLORS.batteryTop, detector);
  rect(battery, (ALARM.battery[0] - RATED.battery[0] / 2) * MM, (ALARM.battery[0] + RATED.battery[0] / 2) * MM, (ALARM.battery[1] - RATED.battery[1] / 2) * MM, (ALARM.battery[1] + RATED.battery[1] / 2) * MM, -0.002);
  rect(batteryTop, (ALARM.battery[0] - RATED.battery[0] / 2) * MM, (ALARM.battery[0] - RATED.battery[0] / 2 + 6) * MM, (ALARM.battery[1] - RATED.battery[1] / 2) * MM, (ALARM.battery[1] + RATED.battery[1] / 2) * MM, -0.0015);
  const horn = disc(COLORS.horn, detector, 40), hornCenter = disc(COLORS.rim, detector, 32);
  put(horn, ALARM.horn[0] * MM, ALARM.horn[1] * MM, ALARM.hornRadius * MM, -0.002);
  put(hornCenter, ALARM.horn[0] * MM, ALARM.horn[1] * MM, ALARM.hornRadius * MM / 3, -0.0015);
  const hornArcs = segmentLines(GAUGE.arcs * 24, COLORS.sound, detector);
  const ionCase = disc(COLORS.sealed, detector, 40), ionSource = disc(COLORS.gold, detector, 16);
  put(ionCase, ALARM.ion[0] * MM, ALARM.ion[1] * MM, CHAMBER.radius * MM, -0.002);
  put(ionSource, ALARM.ion[0] * MM, ALARM.ion[1] * MM, AMERICIUM.diameter / 2 * MM, -0.0015);
  const photoCase = disc(COLORS.diode, detector, 48), photoBeam = flat(COLORS.beam, detector);
  put(photoCase, ALARM.photo[0] * MM, ALARM.photo[1] * MM, OPTIC_VIEW.wall * MM, -0.002);
  rect(photoBeam, (ALARM.photo[0] - OPTICS.source) * MM, (ALARM.photo[0] + OPTICS.source) * MM, (ALARM.photo[1] - 1.5) * MM, (ALARM.photo[1] + 1.5) * MM, -0.0015);
  const testButton = disc(COLORS.rim, detector, 24);
  put(testButton, ALARM.test[0] * MM, ALARM.test[1] * MM, ALARM.testRadius * MM, -0.0015);
  const vents = segmentLines(ALARM.vents, COLORS.rim, detector);
  fillLine(vents, Array.from({length: ALARM.vents}, (_, i) => {
    const angle = 2 * Math.PI * i / ALARM.vents;
    return [[(ALARM.radius - 9) * Math.cos(angle) * MM, (ALARM.radius - 9) * Math.sin(angle) * MM, -0.0028], [(ALARM.radius - 3) * Math.cos(angle) * MM, (ALARM.radius - 3) * Math.sin(angle) * MM, -0.0028]];
  }).flat());
  const leaders = segmentLines(2, COLORS.faint, system);

  // The ionization chambers, cut open.
  const ions = part('ions', 'Ionization chambers, cut open', `One americium source between two half chambers, drawn ${fixed(timesLarger(ION), 0)} times larger: the open half on the right, ${fixed(CHAMBER.sensing, 0)} mm from the source’s plate to its own, and the sealed half on the left, ${fixed(CHAMBER.reference, 1)} mm, both ${fixed(CHAMBER.radius, 0)} mm in radius. The gold lines are alpha particles, each drawn to where it stops. The blue and red dots stand for the ions they leave, far bigger and far fewer than the real ones, and their number follows the ion density. Smoke reaches the open half only.`, IONS.origin, system);
  const sealedFill = flat(COLORS.sealed, ions), openFill = flat(COLORS.open, ions);
  rect(sealedFill, -CHAMBER.radius * ION, 0, 0, CHAMBER.reference * ION, -0.003);
  rect(openFill, 0, CHAMBER.radius * ION, 0, CHAMBER.sensing * ION, -0.003);
  const bottomPlate = flat(COLORS.metal, ions), sealedPlate = flat(COLORS.metal, ions), openPlate = flat(COLORS.metal, ions);
  rect(bottomPlate, -CHAMBER.radius * ION, CHAMBER.radius * ION, -IONS.plate * ION, 0, -0.002);
  rect(sealedPlate, -CHAMBER.radius * ION, 0, CHAMBER.reference * ION, (CHAMBER.reference + IONS.plate) * ION, -0.002);
  rect(openPlate, 0, CHAMBER.radius * ION, CHAMBER.sensing * ION, (CHAMBER.sensing + IONS.plate) * ION, -0.002);
  const divider = flat(COLORS.wall, ions);
  rect(divider, -IONS.wall / 2 * ION, IONS.wall / 2 * ION, 0, CHAMBER.reference * ION, -0.0015);
  const sealedWall = flat(COLORS.wall, ions);
  rect(sealedWall, -(CHAMBER.radius + IONS.plate) * ION, -CHAMBER.radius * ION, 0, (CHAMBER.reference + IONS.plate) * ION, -0.002);
  const mesh = segmentLines(16, COLORS.wall, ions);
  fillLine(mesh, Array.from({length: 8}, (_, i) => {
    const y = (i + 0.5) / 8 * CHAMBER.sensing * ION;
    return [[CHAMBER.radius * ION, y, -0.002], [(CHAMBER.radius + IONS.plate) * ION, y, -0.002]];
  }).flat());
  const button = flat(COLORS.gold, ions);
  rect(button, -AMERICIUM.diameter / 2 * ION, AMERICIUM.diameter / 2 * ION, 0, AMERICIUM.thickness * ION, -0.001);
  const tracks = segmentLines(2 * IONS.tracks, COLORS.track, ions);
  const dotGeometry = new THREE.CircleGeometry(1, 10);
  const positives = new THREE.InstancedMesh(dotGeometry, unlit(COLORS.positive), 2 * IONS.room);
  const negatives = new THREE.InstancedMesh(dotGeometry.clone(), unlit(COLORS.negative), 2 * IONS.room);
  const smokes = new THREE.InstancedMesh(dotGeometry.clone(), unlit(COLORS.smoke), IONS.smokeCap);
  for (const item of [positives, negatives, smokes]) { item.frustumCulled = false; item.count = 0; ions.add(item); }
  const signs = [flat(COLORS.ink, ions), flat(COLORS.ink, ions), flat(COLORS.ink, ions)];
  const nodeWire = lineObject(4, COLORS.ink, ions);

  // The americium button, cut open, and what one alpha leaves behind it.
  const source = part('source', 'The americium button', `The source, drawn ${fixed(timesLarger(BUTTON), 0)} times larger across and ${fixed(THROUGH / MM, 0)} times larger through its thickness: a disc ${fixed(AMERICIUM.diameter, 1)} mm across and ${fixed(AMERICIUM.thickness, 1)} mm thick in an aluminum holder, americium dioxide mixed with gold, a silver backing below, and the gold cover on top, one percent of the thickness, which the alphas cross on their way out. Below: the ion pairs one ${fixed(LINES[0][0], 3)} MeV alpha leaves in each millimeter of air after that cover, with the two chambers' plates and the end of its range marked.`, SOURCE.origin, system);
  const holder = flat(COLORS.holder, source), silver = flat(COLORS.silver, source), core = flat(COLORS.core, source), cover = flat(COLORS.gold, source);
  const total = AMERICIUM.thickness;
  rect(holder, -(AMERICIUM.diameter / 2 + SOURCE.rim) * BUTTON, (AMERICIUM.diameter / 2 + SOURCE.rim) * BUTTON, -0.4 * total * THROUGH, 1.15 * total * THROUGH, -0.003);
  rect(silver, -AMERICIUM.diameter / 2 * BUTTON, AMERICIUM.diameter / 2 * BUTTON, 0, SOURCE.silver * THROUGH, -0.002);
  rect(core, -AMERICIUM.diameter / 2 * BUTTON, AMERICIUM.diameter / 2 * BUTTON, SOURCE.silver * THROUGH, (SOURCE.silver + SOURCE.core) * THROUGH, -0.002);
  rect(cover, -AMERICIUM.diameter / 2 * BUTTON, AMERICIUM.diameter / 2 * BUTTON, (SOURCE.silver + SOURCE.core) * THROUGH, total * THROUGH, -0.002);
  const escaping = segmentLines(5, COLORS.track, source);
  fillLine(escaping, Array.from({length: 5}, (_, i) => {
    const x = (-2 + i) * 1.1 * BUTTON, lean = (i - 2) * 0.22;
    return [[x, total * THROUGH, -0.001], [x + lean * 0.6 * BUTTON, total * THROUGH + 0.09, -0.001]];
  }).flat());
  const braggFrame = lineObject(5, COLORS.chart, source), braggCurve = lineObject(SOURCE.chart.far * 4 + 1, COLORS.track, source);
  const braggMarks = segmentLines(3, COLORS.chart, source), braggTicks = segmentLines(Math.floor(SOURCE.chart.far / SOURCE.chart.tick), COLORS.faint, source);
  const braggGroup = new THREE.Group();
  braggGroup.position.set(-SOURCE.origin[0], -SOURCE.origin[1], -SOURCE.origin[2]);
  source.add(braggGroup);
  for (const line of [braggFrame, braggCurve, braggMarks, braggTicks]) { source.remove(line); braggGroup.add(line); }
  frame(braggFrame, SOURCE.chart.x, SOURCE.chart.y, SOURCE.chart.w, SOURCE.chart.h);
  const braggX = millimeters => SOURCE.chart.x + Math.max(0, Math.min(1, millimeters / SOURCE.chart.far)) * SOURCE.chart.w;
  const braggY = pairs => SOURCE.chart.y + Math.max(0, Math.min(1, pairs / SOURCE.chart.top)) * SOURCE.chart.h;
  {
    const start = afterGold(LINES[0][0], CHAMBER.cover), range = airRange(start) * 10;
    fillLine(braggCurve, Array.from({length: SOURCE.chart.far * 4 + 1}, (_, i) => {
      const distance = i / 4;
      return [braggX(distance), braggY(distance <= range ? pairsPerMillimeter(airEnergyAfter(start, distance)) : 0), 0];
    }));
    fillLine(braggMarks, [CHAMBER.sensing, CHAMBER.reference, range].flatMap(distance => [[braggX(distance), SOURCE.chart.y, 0], [braggX(distance), SOURCE.chart.y + SOURCE.chart.h, 0]]));
    fillLine(braggTicks, Array.from({length: Math.floor(SOURCE.chart.far / SOURCE.chart.tick)}, (_, i) => {
      const x = braggX((i + 1) * SOURCE.chart.tick);
      return [[x, SOURCE.chart.y, 0], [x, SOURCE.chart.y - SOURCE.chart.mark, 0]];
    }).flat());
  }

  // The optical chamber, cut open.
  const chamber = part('chamber', 'Optical chamber, cut open', `The optical chamber drawn ${fixed(timesLarger(OPTIC), 1)} times larger: an infrared emitter at ${EMITTER.wavelength * 1e9} nm on the left, the smoke it lights ${fixed(OPTICS.source, 0)} mm away, the photodiode ${fixed(OPTICS.sensor, 0)} mm off the beam, and a second photodiode ${fixed(OPTICS.direct, 0)} mm down the beam itself. Smoke sends a little of the beam sideways onto the first and takes a little out of the second. The dots stand for smoke particles, far bigger and far fewer than the real ones. The black walls and baffles that keep the emitter’s light off the first photodiode are not drawn.`, OPTIC_VIEW.origin, system);
  const chamberFill = disc(COLORS.diode, chamber, 56);
  put(chamberFill, 0, 0, OPTIC_VIEW.wall * OPTIC, -0.004);
  const chamberRim = lineObject(49, COLORS.rim, chamber);
  fillLine(chamberRim, circlePoints(OPTIC_VIEW.wall).map(([x, y]) => [x * OPTIC, y * OPTIC, -0.0035]));
  const cone = new THREE.Mesh(new THREE.BufferGeometry(), unlit(COLORS.beam, {transparent: true, opacity: 0.45}));
  {
    // The beam spreads at the emitter’s half angle, measured from the emitter.
    const geometry = cone.geometry, reach = OPTICS.direct - OPTICS.source, spread = OPTICS.direct * Math.tan(EMITTER.half * Math.PI / 180);
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -OPTICS.source * OPTIC, 0, -0.003,
      reach * OPTIC, -spread * OPTIC, -0.003,
      reach * OPTIC, spread * OPTIC, -0.003,
    ]), 3));
    chamber.add(cone);
  }
  const emitter = flat(COLORS.metal, chamber), emitterFace = flat(COLORS.beam, chamber);
  rect(emitter, (-OPTICS.source - OPTIC_VIEW.emitter[0]) * OPTIC, -OPTICS.source * OPTIC, -OPTIC_VIEW.emitter[1] / 2 * OPTIC, OPTIC_VIEW.emitter[1] / 2 * OPTIC, -0.002);
  rect(emitterFace, -OPTICS.source * OPTIC, (-OPTICS.source + 0.6) * OPTIC, -OPTIC_VIEW.emitter[1] / 2 * OPTIC, OPTIC_VIEW.emitter[1] / 2 * OPTIC, -0.0015);
  const lit = flat(COLORS.beam, chamber, {transparent: true, opacity: 0.8});
  rect(lit, -OPTICS.length / 2 * OPTIC, OPTICS.length / 2 * OPTIC, -OPTICS.beam / 2 * OPTIC, OPTICS.beam / 2 * OPTIC, -0.0025);
  const scatterDiode = flat(COLORS.metal, chamber), scatterFace = flat(COLORS.face, chamber);
  const straightDiode = flat(COLORS.metal, chamber), straightFace = flat(COLORS.face, chamber);
  rect(straightDiode, (OPTICS.direct - OPTICS.source) * OPTIC, (OPTICS.direct - OPTICS.source + OPTIC_VIEW.diode[0]) * OPTIC, -OPTIC_VIEW.diode[1] / 2 * OPTIC, OPTIC_VIEW.diode[1] / 2 * OPTIC, -0.002);
  rect(straightFace, (OPTICS.direct - OPTICS.source) * OPTIC, (OPTICS.direct - OPTICS.source + 0.5) * OPTIC, -OPTIC_VIEW.diode[1] / 2 * OPTIC, OPTIC_VIEW.diode[1] / 2 * OPTIC, -0.0015);
  const ray = lineObject(2, COLORS.ray, chamber);
  const chamberVents = segmentLines(OPTIC_VIEW.vents * 2, COLORS.rim, chamber);
  fillLine(chamberVents, Array.from({length: OPTIC_VIEW.vents * 2}, (_, i) => {
    const angle = Math.PI / 2 + (i - OPTIC_VIEW.vents + 0.5) * 0.16;
    return [[OPTIC_VIEW.wall * Math.cos(angle) * OPTIC, OPTIC_VIEW.wall * Math.sin(angle) * OPTIC, -0.003], [(OPTIC_VIEW.wall + 2.4) * Math.cos(angle) * OPTIC, (OPTIC_VIEW.wall + 2.4) * Math.sin(angle) * OPTIC, -0.003]];
  }).flat());
  const chamberSmoke = new THREE.InstancedMesh(dotGeometry.clone(), unlit(COLORS.smoke), IONS.smokeCap);
  chamberSmoke.frustumCulled = false;
  chamberSmoke.count = 0;
  chamber.add(chamberSmoke);

  // The two comparators, the battery check and the horn.
  const circuit = part('circuit', 'What the circuit decides', `Four gauges, not to scale: the current the open chamber carries against the current it would carry if every ion reached a plate; the voltage at the detect input against the set point, half the battery’s; the photodiode’s current against the limit stored at calibration; and the battery against the voltage below which the alarm chirps. The horn sounds when either comparator crosses its line.`, GAUGE.origin, system);
  const gaugeFrames = Array.from({length: 4}, () => lineObject(5, COLORS.chart, circuit));
  const gaugeBars = [COLORS.ion, COLORS.ion, COLORS.photo, COLORS.ink].map(color => flat(color, circuit));
  const gaugeLines = Array.from({length: 4}, (_, i) => segmentLines(i === 1 ? 2 : 1, i === 3 ? COLORS.alarm : COLORS.limit, circuit));
  gaugeFrames.forEach((line, i) => frame(line, gaugeX(i) - GAUGE.width / 2, 0, GAUGE.width, GAUGE.height));
  const hornBody = disc(COLORS.horn, circuit, 32);
  put(hornBody, GAUGE.horn[0], GAUGE.horn[1], GAUGE.hornRadius, -0.002);
  const hornRing = disc(COLORS.rim, circuit, 24);
  put(hornRing, GAUGE.horn[0], GAUGE.horn[1], GAUGE.hornRadius / 2.6, -0.0015);
  const sound = segmentLines(GAUGE.arcs * 12, COLORS.sound, circuit);

  // The run.
  const chart = part('chart', 'The run', `How far each detector has come toward its alarm, from nothing at the bottom to its threshold at the line: blue for the ionization chamber, red for the photodiode. Faint for the whole run, dark as far as the clock has run, with a tick below every ${fixed(CHART.tickEvery, 0)} seconds and a mark where each alarm sounds. Not to scale.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chart);
  frame(chartFrame, CHART.x, CHART.y, CHART.w, CHART.h, CHART.z);
  const ionGuide = lineObject(SMOKE.samples, COLORS.faint, chart), photoGuide = lineObject(SMOKE.samples, COLORS.faint, chart);
  const ionCurve = lineObject(SMOKE.samples + 1, COLORS.ion, chart), photoCurve = lineObject(SMOKE.samples + 1, COLORS.photo, chart);
  const threshold = segmentLines(1, COLORS.limit, chart), alarmMarks = segmentLines(2, COLORS.alarm, chart);
  const chirpMarks = segmentLines(Math.ceil(SMOKE.duration / IONIZATION_IC.batteryEvery) + 1, COLORS.alarm, chart);
  const chartTicks = segmentLines(Math.round(SMOKE.duration / CHART.tickEvery), COLORS.faint, chart), chartCursor = segmentLines(1, COLORS.chart, chart);
  fillLine(threshold, [[chartX(0), chartY(1), CHART.z], [chartX(SMOKE.duration), chartY(1), CHART.z]]);
  fillLine(chartTicks, Array.from({length: Math.round(SMOKE.duration / CHART.tickEvery)}, (_, i) => {
    const x = chartX((i + 1) * CHART.tickEvery);
    return [[x, CHART.y, CHART.z], [x, CHART.y - CHART.tick, CHART.z]];
  }).flat());

  const d = SMOKE_DEFAULTS;
  control('size', 'Particle size', ...SMOKE_DOMAINS.size, d.size, 'μm', 'How big the smoke particles are. Flaming fires make the small ones and smoldering fires the large ones.', SIZE_OPTIONS);
  control('growth', 'Smoke growth', ...SMOKE_DOMAINS.growth, d.growth, 'mg/m³ a minute', 'How fast smoke builds up in the room. The mass in each cubic meter rises at this rate; the chambers follow the room with a lag. Not from a source.');
  control('battery', 'Battery', ...SMOKE_DOMAINS.battery, d.battery, 'V', 'The battery the alarm runs on. It sets the voltage across both chambers and the set point the detect input is compared to, and below the trip voltage the alarm chirps.');
  control('angle', 'Scattering angle', ...SMOKE_DOMAINS.angle, d.angle, '°', 'Where the photodiode sits, as an angle away from the beam. The chamber NIST measured used 21°; the limit here is the one calibration stored for that chamber.');

  const matrix = new THREE.Matrix4();
  const sealedPlaces = dotPlaces(IONS.room, IONS.seed);
  const openPlaces = dotPlaces(IONS.room, IONS.seed + 17);
  const smokePlaces = dotPlaces(IONS.smokeCap, IONS.seed + 31);
  const chamberPlaces = dotPlaces(IONS.smokeCap, IONS.seed + 53);
  // Inside a half chamber, mm: a dot’s place from its pair of numbers, kept clear of the walls.
  const insideHalf = ([u, v], gap, side) => [side * (IONS.margin + u * (CHAMBER.radius - 2 * IONS.margin)), IONS.margin + v * (gap - 2 * IONS.margin)];
  // Inside the optical chamber, mm: spread evenly over a disk well inside its wall.
  const insideChamber = ([u, v]) => { const radius = OPTIC_VIEW.wall * 0.86 * Math.sqrt(u), angle = 2 * Math.PI * v; return [radius * Math.cos(angle), radius * Math.sin(angle)]; };
  const cleanDensity = ionDensity(SENSING, smokePlan(SMOKE_DEFAULTS).cleanNode);

  const result = finish(v => {
    const plan = smokePlan(v), now = smokeAt(plan, clock), particle = plan.particle;

    // The ions in each half, as dots whose number follows the ion density.
    const sealedDensity = ionDensity(REFERENCE, plan.supply - now.node);
    const area = (radius, gap) => 2 * radius * gap;
    const openArea = area(CHAMBER.radius, CHAMBER.sensing), sealedArea = area(CHAMBER.radius, CHAMBER.reference);
    const openDots = Math.min(IONS.room, Math.round(IONS.dots * (now.density / cleanDensity)));
    const sealedDots = Math.min(IONS.room, Math.round(IONS.dots * (sealedDensity / cleanDensity) * sealedArea / openArea));
    let positive = 0, negative = 0;
    const place = (places, index, gap, side) => {
      const [x, y] = insideHalf(places[index], gap, side), radius = IONS.dotRadius * ION;
      for (const sign of [1, -1]) {
        matrix.makeScale(radius, radius, 1).setPosition((x - sign * IONS.pair / 2) * ION, y * ION, sign > 0 ? 0.0015 : 0.001);
        if (sign > 0) positives.setMatrixAt(positive++, matrix); else negatives.setMatrixAt(negative++, matrix);
      }
    };
    for (let i = 0; i < openDots; i++) place(openPlaces, i, CHAMBER.sensing, 1);
    for (let i = 0; i < sealedDots; i++) place(sealedPlaces, i, CHAMBER.reference, -1);
    positives.count = positive;
    negatives.count = negative;
    positives.instanceMatrix.needsUpdate = negatives.instanceMatrix.needsUpdate = true;
    positives.computeBoundingSphere();
    negatives.computeBoundingSphere();

    // Smoke, as dots whose number follows the mass inside, drawn larger for larger particles.
    const smokeDots = Math.min(IONS.smokeCap, Math.round(now.mass / IONS.smokeDot));
    const dotSize = (0.2 + 0.25 * Math.log10(particle.diameter / SMOKE_DOMAINS.size[0]) / Math.log10(SMOKE_DOMAINS.size[1] / SMOKE_DOMAINS.size[0]));
    for (let i = 0; i < smokeDots; i++) {
      const [x, y] = insideHalf(smokePlaces[i], CHAMBER.sensing, 1), radius = dotSize * ION;
      matrix.makeScale(radius, radius, 1).setPosition(x * ION, y * ION, 0.002);
      smokes.setMatrixAt(i, matrix);
    }
    smokes.count = smokeDots;
    smokes.instanceMatrix.needsUpdate = true;
    smokes.computeBoundingSphere();
    for (let i = 0; i < smokeDots; i++) {
      const [x, y] = insideChamber(chamberPlaces[i]), radius = dotSize * OPTIC;
      matrix.makeScale(radius, radius, 1).setPosition(x * OPTIC, y * OPTIC, 0.002);
      chamberSmoke.setMatrixAt(i, matrix);
    }
    chamberSmoke.count = smokeDots;
    chamberSmoke.instanceMatrix.needsUpdate = true;
    chamberSmoke.computeBoundingSphere();

    // The alpha tracks, each drawn to where it stops.
    const lines = [];
    for (let i = 0; i < IONS.tracks; i++) {
      const angle = (i + 0.5) / IONS.tracks * Math.PI / 2 * 0.94;
      for (const side of [-1, 1]) {
        const gap = side > 0 ? CHAMBER.sensing : CHAMBER.reference;
        const track = trackOf(LINES[0][0], Math.cos(angle), gap, CHAMBER.radius);
        lines.push([0, AMERICIUM.thickness * ION, 0.0012], [side * track.length * Math.sin(angle) * ION, (AMERICIUM.thickness + track.length * Math.cos(angle)) * ION, 0.0012]);
      }
    }
    fillLine(tracks, lines);

    // The signs on the plates and the wire to the detect input.
    const signY = [(CHAMBER.reference + IONS.plate / 2) * ION, (CHAMBER.sensing + IONS.plate / 2) * ION], arm = IONS.sign / 2 * ION;
    rect(signs[0], -CHAMBER.radius * 0.6 * ION - arm, -CHAMBER.radius * 0.6 * ION + arm, signY[0] - IONS.bar / 2 * ION, signY[0] + IONS.bar / 2 * ION, 0.001);
    rect(signs[1], -CHAMBER.radius * 0.6 * ION - IONS.bar / 2 * ION, -CHAMBER.radius * 0.6 * ION + IONS.bar / 2 * ION, signY[0] - arm, signY[0] + arm, 0.001);
    rect(signs[2], CHAMBER.radius * 0.6 * ION - arm, CHAMBER.radius * 0.6 * ION + arm, signY[1] - IONS.bar / 2 * ION, signY[1] + IONS.bar / 2 * ION, 0.001);
    fillLine(nodeWire, [[0, -IONS.plate / 2 * ION, 0.001], [-(CHAMBER.radius + 3) * ION, -IONS.plate / 2 * ION, 0.001], [-(CHAMBER.radius + 3) * ION, -(IONS.plate + 3) * ION, 0.001], [(CHAMBER.radius + 3) * ION, -(IONS.plate + 3) * ION, 0.001]]);

    // The optical chamber: where the photodiode sits, and the ray it catches.
    const radians = v.angle * Math.PI / 180, dx = Math.cos(radians) * OPTICS.sensor, dy = Math.sin(radians) * OPTICS.sensor;
    const along = OPTIC_VIEW.diode[0] / 2, across = OPTIC_VIEW.diode[1] / 2;
    rect(scatterDiode, (dx - along) * OPTIC, (dx + along) * OPTIC, (dy - across) * OPTIC, (dy + across) * OPTIC, -0.002);
    rect(scatterFace, (dx - along * 0.5) * OPTIC, (dx + along * 0.5) * OPTIC, (dy - across * 0.8) * OPTIC, (dy + across * 0.8) * OPTIC, -0.0015);
    scatterDiode.rotation.z = radians;
    scatterFace.rotation.z = radians;
    scatterFace.position.set(dx * OPTIC, dy * OPTIC, -0.0015);
    scatterDiode.position.set(dx * OPTIC, dy * OPTIC, -0.002);
    scatterFace.material.color.setHex(COLORS.face).lerp(new THREE.Color(COLORS.ray), Math.min(1, now.scattered / plan.photoLimit));
    fillLine(ray, now.scattered > 0 ? [[0, 0, -0.001], [dx * OPTIC * OPTIC_VIEW.ray, dy * OPTIC * OPTIC_VIEW.ray, -0.001]] : []);

    // The gauges.
    const shares = [now.ratio, now.node / plan.supply, now.scattered / (2 * plan.photoLimit), plan.supply / SMOKE_DOMAINS.battery[1]];
    const marks = [plan.cleanRatio, plan.setPoint / plan.supply, 0.5, CHAMBER.lowBattery / SMOKE_DOMAINS.battery[1]];
    gaugeBars.forEach((bar, i) => {
      rect(bar, gaugeX(i) - GAUGE.width / 2 + 0.006, gaugeX(i) + GAUGE.width / 2 - 0.006, 0.004, Math.max(0.004, gaugeY(shares[i])), -0.001);
      const line = gaugeLines[i], points = [[gaugeX(i) - GAUGE.width / 2, gaugeY(marks[i]), 0], [gaugeX(i) + GAUGE.width / 2, gaugeY(marks[i]), 0]];
      if (i === 1 && now.ionSounding) points.push([gaugeX(i) - GAUGE.width / 2, gaugeY((plan.setPoint - IONIZATION_IC.hysteresis) / plan.supply), 0], [gaugeX(i) + GAUGE.width / 2, gaugeY((plan.setPoint - IONIZATION_IC.hysteresis) / plan.supply), 0]);
      fillLine(line, points);
    });
    gaugeBars[1].material.color.setHex(now.ionSounding ? COLORS.alarm : COLORS.ion);
    gaugeBars[2].material.color.setHex(now.photoSounding ? COLORS.alarm : COLORS.photo);
    gaugeBars[3].material.color.setHex(plan.lowBattery ? COLORS.alarm : COLORS.ink);
    const arcSegments = (center, radius, grow, z) => Array.from({length: GAUGE.arcs}, (_, k) => {
      const reach = radius * (grow + 0.5 * k);
      return Array.from({length: 12}, (_, j) => {
        const from = -0.6 + 1.2 * j / 12, to = -0.6 + 1.2 * (j + 1) / 12;
        return [[center[0] + reach * Math.cos(from), center[1] + reach * Math.sin(from), z], [center[0] + reach * Math.cos(to), center[1] + reach * Math.sin(to), z]];
      }).flat();
    }).flat();
    fillLine(sound, now.sounding ? arcSegments(GAUGE.horn, GAUGE.hornRadius, 1.7, 0) : []);
    fillLine(hornArcs, now.sounding ? arcSegments([ALARM.horn[0] * MM, ALARM.horn[1] * MM], ALARM.hornRadius * MM, 1.4, -0.001) : []);

    // The chart of the run.
    fillLine(ionGuide, plan.chart.map(sample => [chartX(sample.time), chartY(sample.ionShare), CHART.z]));
    fillLine(photoGuide, plan.chart.map(sample => [chartX(sample.time), chartY(sample.photoShare), CHART.z]));
    const shown = plan.chart.filter(sample => sample.time < now.t);
    fillLine(ionCurve, clock > 0 ? [...shown.map(sample => [chartX(sample.time), chartY(sample.ionShare), CHART.z]), [chartX(now.t), chartY((now.node - plan.cleanNode) / (plan.setPoint - plan.cleanNode)), CHART.z]] : []);
    fillLine(photoCurve, clock > 0 ? [...shown.map(sample => [chartX(sample.time), chartY(sample.photoShare), CHART.z]), [chartX(now.t), chartY(now.scattered / plan.photoLimit), CHART.z]] : []);
    fillLine(alarmMarks, [[plan.ionAlarm, now.ionSounding], [plan.photoAlarm, now.photoSounding]].flatMap(([time, reached]) => (time !== null && reached ? [[chartX(time), CHART.y, CHART.z], [chartX(time), CHART.y + CHART.h, CHART.z]] : [])));
    fillLine(chirpMarks, Array.from({length: now.chirps}, (_, i) => {
      const x = chartX((i + 1) * IONIZATION_IC.batteryEvery);
      return [[x, CHART.y - CHART.tick, CHART.z], [x, CHART.y - 2.4 * CHART.tick, CHART.z]];
    }).flat());
    fillLine(chartCursor, [[chartX(now.t), CHART.y, CHART.z], [chartX(now.t), CHART.y + CHART.h, CHART.z]]);

    // Leaders from the alarm to the two close ups.
    fillLine(leaders, [
      [ALARM.origin[0] + (ALARM.ion[0] + CHAMBER.radius) * MM, ALARM.origin[1] + ALARM.ion[1] * MM, 0], [IONS.origin[0] - CHAMBER.radius * ION, IONS.origin[1] + CHAMBER.sensing / 2 * ION, 0],
      [ALARM.origin[0] + (ALARM.photo[0] + OPTIC_VIEW.wall) * MM, ALARM.origin[1] + ALARM.photo[1] * MM, 0], [OPTIC_VIEW.origin[0] - OPTIC_VIEW.wall * OPTIC, OPTIC_VIEW.origin[1], 0],
    ]);

    // Readings.
    const at = time => (time === null ? 'never' : `${fixed(time, 0)} s`);
    const status = clock <= 0
      ? `Ready · clean air, the open chamber carrying ${fixed(plan.cleanCurrent * 1e12, 1)} pA; press Play`
      : !now.sounding ? `Filling · ${fixed(now.mass * 1e6, 1)} mg/m³ inside, ${fixed(now.obscuration, 2)}% obscuration a meter, chamber ${fixed(now.current * 1e12, 1)} pA, photodiode ${fixed(now.scattered * 1e9, 1)} nA`
      : `${now.ionSounding && now.photoSounding ? 'Both alarms sounding' : now.ionSounding ? 'Ionization alarm sounding' : 'Photoelectric alarm sounding'} · ionization at ${at(plan.ionAlarm)}, photoelectric at ${at(plan.photoAlarm)}`;
    return {
      state: {...plan, now, clock, openDots, sealedDots, smokeDots, sealedDensity, dotSize},
      readings: [
        r('Your result', status),
        r('Chamber current', `${fixed(now.current * 1e12, 2)} pA`, `The open half carries ${fixed(now.current * 1e12, 2)} pA of the ${fixed(plan.sensing.saturation * 1e12, 1)} pA it would carry if every ion reached a plate, ${fixed(100 * now.ratio, 0)}% of it, at ${fixed(now.node, 2)} V across ${fixed(CHAMBER.sensing, 0)} mm. In clean air it carries ${fixed(plan.cleanCurrent * 1e12, 2)} pA, so smoke has taken ${fixed(100 - 100 * now.share, 1)}% of it away. The sealed half carries that same current, since the two sit in series, and needs ${fixed(plan.supply - now.node, 2)} V to do it.`),
        r('Detect input', `${fixed(now.node, 2)} V`, `The two halves sit in series across the battery, and the detect input is the plate between them. Smoke lowers what the open half can carry, so the input climbs from ${fixed(plan.cleanNode, 2)} V toward the set point at ${fixed(plan.setPoint, 2)} V, ${fixed(100 * IONIZATION_IC.set, 0)}% of the battery. ${IONIZATION_IC.name} looks every ${fixed(IONIZATION_IC.period, 2)} s, and once it alarms it moves the set point down ${fixed(IONIZATION_IC.hysteresis * 1000, 0)} mV.`),
        r('Smoke inside', `${fixed(now.mass * 1e6, 1)} mg/m³`, `${fixed(now.number / 1e12, 2)} million particles of ${fixed(particle.diameter, 1)} μm in every cubic centimeter, which dim a beam by ${fixed(now.obscuration, 2)}% a meter, or ${fixed(now.obscurationFoot, 2)}% a foot. The room is at ${fixed(plan.growth * plan.duration * 1e6 * now.t / plan.duration, 1)} mg/m³; a chamber follows it with a lag of ${fixed(SMOKE.lag, 0)} s.`),
        r('Scattered light', `${fixed(now.scattered * 1e9, 1)} nA`, `The photodiode ${fixed(v.angle, 0)}° off the beam collects ${fixed(now.scattered * 1e9, 1)} nA against the ${fixed(plan.photoLimit * 1e9, 1)} nA limit stored at calibration, which is ${OPTICS.limitSteps} of the ${PHOTO_IC.name}’s ${PHOTO_IC.steps} steps. ${PHOTO_IC.name} pulses the emitter for ${fixed(PHOTO_IC.pulse * 1e6, 0)} μs every ${fixed(PHOTO_IC.period, 1)} s and wants ${PHOTO_IC.needed} readings over the limit in a row.`),
        r('Straight through', `${fixed(100 * now.beamShare, 2)}% of the beam`, `The second photodiode, ${fixed(OPTICS.direct, 0)} mm down the beam, still receives ${fixed(100 * now.beamShare, 2)}% of the ${fixed(plan.cleanBeam * 1e6, 0)} μA it reads in clean air: over so short a path smoke hides almost nothing. The same smoke across a room, ${fixed(OPTICS.room, 0)} m of it, leaves ${fixed(100 * now.roomShare, 1)}%.`),
        r('Alarms', plan.ionAlarm === null && plan.photoAlarm === null ? 'neither in this run' : `ionization ${at(plan.ionAlarm)}, photoelectric ${at(plan.photoAlarm)}`, `The ionization chamber crosses its set point at ${at(plan.ionCross)} and the ${IONIZATION_IC.name} sounds at its next look, ${at(plan.ionAlarm)}. The photodiode crosses its limit at ${at(plan.photoCross)}, and the ${PHOTO_IC.name} sounds ${PHOTO_IC.needed} readings later, at ${at(plan.photoAlarm)}. ${plan.ionObscuration === null ? 'This smoke never takes enough ions for the ionization chamber' : `That is ${fixed(plan.ionObscuration, 2)}% obscuration a meter for the ionization chamber`}${plan.photoObscuration === null ? ' and never enough light for the photodiode' : ` and ${fixed(plan.photoObscuration, 2)}% for the photodiode`}, against NIST’s ${fixed(RATED.ionization[1], 1)}% and ${fixed(RATED.photoelectric[1], 1)}%.`),
        r('Battery', `${fixed(plan.supply, 1)} V`, plan.lowBattery
          ? `Below the ${fixed(CHAMBER.lowBattery, 1)} V trip, so the alarm chirps for ${fixed(IONIZATION_IC.chirp * 1000, 0)} ms every ${fixed(IONIZATION_IC.batteryEvery, 0)} s: ${fixed(now.chirps, 0)} chirps so far. Smoke stops the chirp; the horn takes over. The horn sounds between ${fixed(RATED.tone[0], 0)} and ${fixed(RATED.tone[1], 0)} Hz at ${fixed(RATED.loud, 0)} dB from ${fixed(RATED.loudAt, 0)} ft.`
          : `Above the ${fixed(CHAMBER.lowBattery, 1)} V trip, so no chirp. The ${IONIZATION_IC.name} checks the battery every ${fixed(IONIZATION_IC.batteryEvery, 0)} s under a ${fixed(IONIZATION_IC.load * 1000, 0)} mA load and draws ${fixed(IONIZATION_IC.draw * 1e6, 0)} μA itself. The horn sounds between ${fixed(RATED.tone[0], 0)} and ${fixed(RATED.tone[1], 0)} Hz at ${fixed(RATED.loud, 0)} dB from ${fixed(RATED.loudAt, 0)} ft.`),
        r('Sped up', `${fixed(SMOKE.speed, 0)} times`, `The run of ${fixed(plan.duration, 0)} s is drawn in ${fixed(plan.duration / SMOKE.speed, 0)} s. The clock stands at ${fixed(now.t, 0)} s. The chambers are drawn ${fixed(timesLarger(ION), 0)} and ${fixed(timesLarger(OPTIC), 1)} times larger, and the alarm at true size.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(SMOKE.duration, clock + dt * SMOKE.speed); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.max(0, Math.min(SMOKE.duration, time)); return render(); };
  result.actions = [
    {label: 'Inspect: the ionization chambers', part: 'ions', view: 'front', replay: false, run() { const plan = result.getState(); return inspect(plan.ionAlarm ?? SMOKE.duration / 2); }},
    {label: 'Inspect: the americium button', part: 'source', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the optical chamber', part: 'chamber', view: 'front', replay: false, run() { const plan = result.getState(); return inspect(plan.photoAlarm ?? SMOKE.duration); }},
    {label: 'Inspect: what the circuit decides', part: 'circuit', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the alarm at true size', part: 'detector', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Let the smoke build up',
    description: `Smoke builds up in the room and reaches both chambers, ${SMOKE.speed} times faster than it happens.`,
    stepLabel: 'Advance 1 s',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => clock >= SMOKE.duration,
    blocked: () => false,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the run', view: 'front', focusOnComplete: false, available: () => clock >= SMOKE.duration};

  kit.root.rotation.set(0.04, -0.08, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {
    system, detector, shell, rim, board, battery, batteryTop, horn, hornCenter, hornArcs, ionCase, ionSource, photoCase, photoBeam, testButton, vents, leaders,
    ions, sealedFill, openFill, bottomPlate, sealedPlate, openPlate, divider, sealedWall, mesh, button, tracks, positives, negatives, smokes, signs, nodeWire,
    source, holder, silver, core, cover, escaping, braggFrame, braggCurve, braggMarks, braggTicks, braggGroup,
    chamber, chamberFill, chamberRim, cone, emitter, emitterFace, lit, scatterDiode, scatterFace, straightDiode, straightFace, ray, chamberVents, chamberSmoke,
    circuit, gaugeFrames, gaugeBars, gaugeLines, hornBody, hornRing, sound,
    chart, chartFrame, ionGuide, photoGuide, ionCurve, photoCurve, threshold, alarmMarks, chirpMarks, chartTicks, chartCursor,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

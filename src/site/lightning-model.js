import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow, stripGeometry} from './scene-kit.js';
import {
  lightningPlan, lightningAt, timeOfClock, clockOfTime, RUN,
  ATMOSPHERE, CONDUCTOR, CORONA, DECLARED, DEHN, HEIDLER, IET, LEVELS, PAGES, WITHSTAND,
  LEVEL_OPTIONS, STROKE_OPTIONS, LIGHTNING_DEFAULTS, LIGHTNING_DOMAINS,
} from './lightning-physics.js';

// ---------------------------------------------------------------------------
// Lightning conductor: a house in a storm with its air terminal, down
// conductor, bonded pipe and earth rod; the terminal’s tip close up with the
// equipotentials about it and the air it ionizes; the gap between the
// conductor and the pipe close up; the strike’s current and voltages against
// time; and the ground’s potential out from the rod.
//
// Scale: the house and everything on it are drawn 100 times smaller than true
// size, 1 m to 0.1 units; the tip’s close up 8 times larger, 1 mm to 0.08
// units, in a window 15 mm wide; and the gap close up 20 times smaller, 1 m to
// 0.5 units. The cloud, its charges and the field arrows are not to scale, and
// the two charts are not to scale: time runs across them by its logarithm and
// the voltages up theirs.
//
// Time: the clock takes 2 s for every tenfold in time, from 0.1 μs to 5 ms, so
// Play lasts 9.4 s; it is said in the part text and in a reading.
// ---------------------------------------------------------------------------

export const MM = 0.01;
/** How many times larger than true size a scale in units per mm draws. */
export const timesLarger = unitsPerMillimeter => unitsPerMillimeter / MM;
/** Units per meter in the house view, units per mm in the tip close up, and units per meter in the gap close up. */
export const SCALE = Object.freeze({storm: 0.1, tip: 0.08, gap: 0.5});

/** The house view, m about the down conductor’s foot at the ground: the soil, the house, the roof plane drawn past it, the air terminal, the conductor, the pipe, the bonding bar, the rod, the cloud, the charges, the field arrows, the ion plume, the strike channel, the voltage wedge and the current arrow. */
export const STORM = Object.freeze({
  origin: Object.freeze([-1.75, -0.45, 0]),
  soil: Object.freeze([-15.9, 4.2, -9.5]), house: Object.freeze([-12, 0.4, 10]), roofReach: -15.9,
  terminal: Object.freeze([0.1, 12]), conductor: 0.05, pipe: 0.07, bar: Object.freeze([0.25, 0.4]), rod: Object.freeze([0.06, -9]),
  cloud: Object.freeze([13.8, 15.6]), charges: Object.freeze([-15, 3.6]), chargeMark: 0.5, ground: Object.freeze([-15, 3.6]), groundMark: Object.freeze([-0.45, 0.35]),
  arrows: Object.freeze([-13, -9.5, -6, -2.5]), arrowFoot: 10.4, arrowPerVolt: 0.00016, arrowThickness: 0.004,
  ions: Object.freeze({count: 9, first: 12.25, step: 0.16, sway: 0.12, radius: 0.09}),
  channel: Object.freeze({points: 9, sway: 0.35}), touchMark: 0.5, arcPoints: 33,
  wedgePerVolt: 1.2e-6, current: Object.freeze({x: 3.9, top: 9.5, perAmpere: 3.5e-5, thickness: 0.05}),
  spark: Object.freeze({points: 7, sway: 0.16}),
});

/** The tip close up, m about the terminal’s apex: where it sits, its window, and how the spheroid, the zone and the ions are drawn. */
export const TIPVIEW = Object.freeze({origin: Object.freeze([-0.6, 0.31, 0]), samples: 40, ions: Object.freeze({count: 7, first: 1.6e-3, step: 1.1e-3, sway: 0.5e-3, radius: 0.25e-3})});

/** The gap close up, m about the down conductor’s top: where it sits, the window, the conductor and pipe widths, the bracket for the standard’s separation distance and the line for the gap. */
export const GAPVIEW = Object.freeze({
  origin: Object.freeze([-0.45, -0.9, 0]), window: Object.freeze([-1.45, 0.35, -1, 0.4]),
  conductor: 0.05, pipe: 0.07, terminal: 0.1, bracket: 0.25, mark: -0.15, tick: 0.06, spark: Object.freeze({points: 7, sway: 0.05}),
});

/** The two panels of the strike’s chart and the panel of the ground’s potential: where they sit, how wide, how tall, and what they span. */
export const CHART = Object.freeze({x: 0.25, w: 1.8, current: Object.freeze({y: 0.51, h: 0.6, top: 220e3, every: 50e3}), volts: Object.freeze({y: -0.42, h: 0.75, low: 1e3, high: 1e8}), tick: 0.03});
export const EARTH = Object.freeze({x: 0.25, y: -1.4, w: 1.8, h: 0.6, low: 1e3, high: 1e8, foot: 0.05});

export const COLORS = Object.freeze({
  sky: 0x8a94a6, soil: 0xd8c49a, soilLine: 0x8a7350, house: 0xf0dfaf, wall: 0x6b7378, roof: 0xb6b0a2,
  copper: 0xb87333, steel: 0x8f989b, rod: 0x6f7a73, field: 0x2b5d9c, faint: 0x9aa39a, frame: 0x374736,
  minus: 0x2b5d9c, plus: 0xc14f39, corona: 0x8e6bbf, ion: 0xd9a441, current: 0xd9a441, volts: 0xc14f39,
  earth: 0x9a6b3f, withstand: 0x6b7378, spark: 0xc14f39, sphere: 0xa9bfd6, arc: 0x2f7d6b,
});

/** Where a time, s, falls across a chart: its logarithm from the clock’s first to its last. */
export const timeX = time => {
  const {start, end} = DECLARED.clock, share = Math.log10(Math.max(time, start) / start) / Math.log10(end / start);
  return CHART.x + CHART.w * Math.max(0, Math.min(1, share));
};
/** Where a current, A, falls up the current panel, and a voltage, V, up the log panel of either chart. */
export const currentY = current => CHART.current.y + CHART.current.h * Math.max(0, Math.min(1, current / CHART.current.top));
const logShare = (volts, low, high) => Math.max(0, Math.min(1, Math.log10(Math.max(Math.abs(volts), low) / low) / Math.log10(high / low)));
export const voltsY = volts => CHART.volts.y + CHART.volts.h * logShare(volts, CHART.volts.low, CHART.volts.high);
/** Where a distance from the rod, m, and a potential, V, fall on the ground’s chart. */
export const groundX = distance => EARTH.x + EARTH.w * Math.max(0, Math.min(1, distance / DECLARED.reach));
export const groundY = volts => EARTH.y + EARTH.h * logShare(volts, EARTH.low, EARTH.high);

/** A number with a true minus sign. */
export const signed = (value, digits) => { const text = fixed(Math.abs(value), digits); return value < 0 && text !== fixed(0, digits) ? `−${text}` : text; };
/** A time since the strike attached, in the unit that suits it. */
export const timeText = t => (t < 1e-3 ? `${fixed(t * 1e6, 2)} μs` : `${fixed(t * 1e3, 2)} ms`);

const zigzag = (from, to, count, sway) => Array.from({length: count}, (_, i) => {
  const share = i / (count - 1), x = from[0] + (to[0] - from[0]) * share, y = from[1] + (to[1] - from[1]) * share;
  return [x + (i === 0 || i === count - 1 ? 0 : (i % 2 ? sway : -sway)), y];
});

export function createLightningConductorModel() {
  const kit = houseModel('Lightning conductor'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const dot = (color, parent, radius) => { const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 16), unlit(color)); parent.add(mesh); return mesh; };
  const strip = (color, parent, pairs, extra) => {
    const geometry = stripGeometry(pairs), mesh = new THREE.Mesh(geometry, unlit(color, extra));
    mesh.frustumCulled = false;
    parent.add(mesh);
    return {mesh, geometry, pairs};
  };
  /** Fills a strip with pairs of points, keeping the leftover pairs on the last one so nothing stray is drawn. */
  const fillStrip = (item, rows, z = 0) => {
    const array = item.geometry.attributes.position.array, used = Math.min(rows.length, item.pairs);
    item.mesh.visible = used > 1;
    for (let i = 0; i < item.pairs; i++) {
      const row = rows[Math.min(i, used - 1)] || [[0, 0], [0, 0]];
      array.set([row[0][0], row[0][1], z], 6 * i);
      array.set([row[1][0], row[1][1], z], 6 * i + 3);
    }
    item.geometry.attributes.position.needsUpdate = true;
    item.geometry.boundingBox = null;
    item.geometry.boundingSphere = null;
  };

  const system = part('system', 'Lightning conductor, the whole installation', `A house with an air terminal, a down conductor, a bonded pipe and an earth rod, drawn ${fixed(1 / timesLarger(SCALE.storm / 1000), 0)} times smaller than true size; the terminal’s tip ${fixed(timesLarger(SCALE.tip), 0)} times larger, with the equipotentials about it and the air it ionizes; the gap between the conductor and the pipe ${fixed(1 / timesLarger(SCALE.gap / 1000), 0)} times smaller; the strike’s current and voltages against time; and the ground’s potential out from the rod. Press Play to strike the terminal: the clock takes ${fixed(DECLARED.clock.decade, 0)} s for every tenfold in time, from ${fixed(DECLARED.clock.start * 1e6, 1)} μs to ${fixed(DECLARED.clock.end * 1e3, 0)} ms.`);

  // ---------------------------------------------------------------------------
  // The house in the storm.
  // ---------------------------------------------------------------------------
  const storm = part('storm', 'House in the storm', `The house and its lightning protection drawn ${fixed(1 / timesLarger(SCALE.storm / 1000), 0)} times smaller than true size: an air terminal ${fixed(DECLARED.height, 0)} m tall on a roof ${fixed(STORM.house[2], 0)} m up, a copper down conductor ${fixed(DECLARED.length, 0)} m long to a bonding bar at the ground, a steel pipe beside it bonded to the same bar, and an earth rod ${fixed(DEHN.rod, 0)} m deep. Blue arrows are the storm’s field and grow with it, the bars under the cloud are its charge and the crosses in the ground the charge it draws up; the green arc is the level’s rolling sphere resting on the roof. While the current runs, the gold arrow beside the conductor is as long as the current, full length at ${fixed(CHART.current.top / 1e3, 0)} kA, and the red wedge is the voltage between the conductor and the pipe at each height.`, STORM.origin, system);
  const sm = ([x, y]) => [x * SCALE.storm, y * SCALE.storm];
  const smPoint = ([x, y], z = 0) => [x * SCALE.storm, y * SCALE.storm, z];
  const [soilLeft, soilRight, soilDeep] = STORM.soil, [houseLeft, houseRight, houseTop] = STORM.house;
  const soil = flat(COLORS.soil, storm);
  rect(soil, ...sm([soilLeft, soilRight]), ...sm([soilDeep, 0]), -0.01);
  const house = flat(COLORS.house, storm);
  rect(house, ...sm([houseLeft, houseRight]), ...sm([0, houseTop]), -0.008);
  const walls = lineObject(5, COLORS.wall, storm);
  fillLine(walls, [[houseLeft, 0], [houseLeft, houseTop], [houseRight, houseTop], [houseRight, 0], [houseLeft, 0]].map(point => smPoint(point, 0.002)));
  const roofPlane = segmentLines(1, COLORS.faint, storm);
  fillLine(roofPlane, [smPoint([STORM.roofReach, houseTop], 0.001), smPoint([houseLeft, houseTop], 0.001)]);
  const groundLine = segmentLines(1, COLORS.soilLine, storm);
  fillLine(groundLine, [smPoint([soilLeft, 0], 0.003), smPoint([soilRight, 0], 0.003)]);
  const cloud = flat(COLORS.sky, storm);
  rect(cloud, ...sm([soilLeft, soilRight]), ...sm(STORM.cloud), -0.009);
  const minuses = segmentLines(24, COLORS.minus, storm), pluses = segmentLines(48, COLORS.plus, storm);
  const terminal = strip(COLORS.copper, storm, 2);
  const conductorBar = flat(COLORS.copper, storm);
  rect(conductorBar, ...sm([-STORM.conductor, STORM.conductor]), ...sm([0, houseTop]), 0.004);
  const rodBar = flat(COLORS.rod, storm);
  rect(rodBar, ...sm([-STORM.rod[0], STORM.rod[0]]), ...sm([STORM.rod[1], 0]), 0.004);
  const pipeBar = flat(COLORS.steel, storm);
  const bondBar = flat(COLORS.copper, storm);
  const fieldArrows = STORM.arrows.map(() => { const arrow = solidArrow(kit, COLORS.field, storm, STORM.arrowThickness); arrow.userData.setDirection(new THREE.Vector3(0, 1, 0)); return arrow; });
  fieldArrows.forEach((arrow, i) => arrow.position.set(...smPoint([STORM.arrows[i], STORM.arrowFoot], 0.005)));
  const sphereArc = lineObject(STORM.arcPoints, COLORS.arc, storm), touchTick = segmentLines(1, COLORS.arc, storm);
  const ionDots = Array.from({length: STORM.ions.count}, () => dot(COLORS.ion, storm, STORM.ions.radius * SCALE.storm));
  const channel = lineObject(STORM.channel.points, COLORS.current, storm);
  const wedge = strip(COLORS.volts, storm, 2, {transparent: true, opacity: 0.45});
  const currentArrow = solidArrow(kit, COLORS.current, storm, STORM.current.thickness * SCALE.storm);
  currentArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));
  currentArrow.position.set(...smPoint([STORM.current.x, STORM.current.top], 0.006));
  const stormSpark = lineObject(STORM.spark.points, COLORS.spark, storm);

  // ---------------------------------------------------------------------------
  // The tip, close up.
  // ---------------------------------------------------------------------------
  const tip = part('tip', 'Air terminal tip, close up', `The top of the air terminal drawn ${fixed(timesLarger(SCALE.tip), 0)} times larger, in a window ${fixed(2 * DECLARED.window.half * 1000, 0)} mm wide reaching ${fixed(DECLARED.window.above * 1000, 0)} mm above the tip. The blue curves are equipotentials, one every ${fixed(DECLARED.spacing, 0)} V, crowding where the field is strongest; the violet patch is the air within reach of ${fixed(PAGES.air / 1e6, 0)} MV/m, the field at which air breaks down, and it fills in once the tip passes the ${fixed(CORONA.onset / 1e6, 2)} MV/m that starts a corona. The gold dots stand for the positive ions the corona sends up; how fast they go is not modeled.`, TIPVIEW.origin, system);
  const tp = (x, y, z = 0) => [x * 1000 * SCALE.tip, y * 1000 * SCALE.tip, z];
  const {half: windowHalf, below: windowBelow, above: windowAbove} = DECLARED.window;
  const tipFrame = lineObject(5, COLORS.faint, tip);
  fillLine(tipFrame, [[-windowHalf, -windowBelow], [windowHalf, -windowBelow], [windowHalf, windowAbove], [-windowHalf, windowAbove], [-windowHalf, -windowBelow]].map(([x, y]) => tp(x, y, -0.004)));
  const metal = strip(COLORS.steel, tip, TIPVIEW.samples + 1);
  const metalLine = lineObject(2 * TIPVIEW.samples + 3, COLORS.wall, tip);
  const equipotentials = segmentLines(DECLARED.contours * 2 * DECLARED.points, COLORS.sphere, tip);
  const zoneFill = strip(COLORS.corona, tip, 2 * DECLARED.points + 1, {transparent: true, opacity: 0.5});
  const zoneLine = lineObject(2 * DECLARED.points + 1, COLORS.corona, tip);
  const tipIons = Array.from({length: TIPVIEW.ions.count}, () => dot(COLORS.ion, tip, TIPVIEW.ions.radius * 1000 * SCALE.tip));

  // ---------------------------------------------------------------------------
  // The gap, close up.
  // ---------------------------------------------------------------------------
  const gap = part('gap', 'Down conductor and pipe, close up', `The top of the down conductor and of the pipe beside it, drawn ${fixed(1 / timesLarger(SCALE.gap / 1000), 0)} times smaller than true size. The lower line measures the gap you set; the upper bracket is the separation distance the standard asks for at this level, s = ki·kc·l/km. A spark crosses the gap when the voltage along the conductor breaks it down.`, GAPVIEW.origin, system);
  const gp = (x, y, z = 0) => [x * SCALE.gap, y * SCALE.gap, z];
  const [gapLeft, gapRight, gapBottom, gapTopEdge] = GAPVIEW.window;
  const gapFrame = lineObject(5, COLORS.faint, gap);
  fillLine(gapFrame, [[gapLeft, gapBottom], [gapRight, gapBottom], [gapRight, gapTopEdge], [gapLeft, gapTopEdge], [gapLeft, gapBottom]].map(([x, y]) => gp(x, y, -0.004)));
  const gapRoof = segmentLines(1, COLORS.roof, gap);
  fillLine(gapRoof, [gp(gapLeft, 0, -0.002), gp(gapRight, 0, -0.002)]);
  const gapConductor = flat(COLORS.copper, gap);
  rect(gapConductor, -GAPVIEW.conductor * SCALE.gap, GAPVIEW.conductor * SCALE.gap, gapBottom * SCALE.gap, 0, 0.002);
  const gapTerminal = strip(COLORS.copper, gap, 2);
  fillStrip(gapTerminal, [[[GAPVIEW.terminal, 0], [-GAPVIEW.terminal, 0]].map(([x, y]) => [x * SCALE.gap, y * SCALE.gap]), [[0, gapTopEdge * SCALE.gap], [0, gapTopEdge * SCALE.gap]]], 0.002);
  const gapPipe = flat(COLORS.steel, gap);
  const gapBracket = segmentLines(3, COLORS.frame, gap), gapMark = segmentLines(3, COLORS.volts, gap);
  const gapSpark = lineObject(GAPVIEW.spark.points, COLORS.spark, gap);

  // ---------------------------------------------------------------------------
  // The strike against time.
  // ---------------------------------------------------------------------------
  const chart = part('chart', 'The strike over time', `What the strike does, on a clock that takes ${fixed(DECLARED.clock.decade, 0)} s for every tenfold in time. Across both panels runs the time since the strike attached, by its logarithm, from ${fixed(DECLARED.clock.start * 1e6, 1)} μs to ${fixed(DECLARED.clock.end * 1e3, 0)} ms, with a tick at every tenfold. The upper panel carries the current, ${fixed(CHART.current.top / 1e3, 0)} kA at the top with a line every ${fixed(CHART.current.every / 1e3, 0)} kA. The lower panel carries voltages by the logarithm of their size, from ${fixed(CHART.volts.low / 1e3, 0)} kV to ${fixed(CHART.volts.high / 1e6, 0)} MV, so a voltage that turns negative as the current falls away still shows its size: red is the voltage between the conductor’s top and the pipe, brown the earth termination’s rise, and the gray line is the voltage this gap can take.`, [0, 0, 0], system);
  const chartFrames = segmentLines(8, COLORS.frame, chart), chartGrid = segmentLines(12, COLORS.faint, chart), chartTicks = segmentLines(12, COLORS.frame, chart);
  const currentGuide = lineObject(DECLARED.samples, COLORS.faint, chart), currentCurve = lineObject(DECLARED.samples + 1, COLORS.current, chart);
  const gapGuide = lineObject(DECLARED.samples, COLORS.faint, chart), gapCurve = lineObject(DECLARED.samples + 1, COLORS.volts, chart);
  const earthGuide = lineObject(DECLARED.samples, COLORS.faint, chart), earthCurve = lineObject(DECLARED.samples + 1, COLORS.earth, chart);
  const withstandLine = segmentLines(1, COLORS.withstand, chart), cursor = segmentLines(2, COLORS.frame, chart);
  {
    const panels = [[CHART.current.y, CHART.current.h], [CHART.volts.y, CHART.volts.h]];
    fillLine(chartFrames, panels.flatMap(([y, h]) => [[CHART.x, y], [CHART.x + CHART.w, y], [CHART.x + CHART.w, y], [CHART.x + CHART.w, y + h], [CHART.x + CHART.w, y + h], [CHART.x, y + h], [CHART.x, y + h], [CHART.x, y]]).map(([x, y]) => [x, y, 0]));
    const lines = [];
    for (let level = CHART.current.every; level < CHART.current.top; level += CHART.current.every) lines.push([[CHART.x, currentY(level), 0], [CHART.x + CHART.w, currentY(level), 0]]);
    for (let volts = CHART.volts.low * 10; volts < CHART.volts.high; volts *= 10) lines.push([[CHART.x, voltsY(volts), 0], [CHART.x + CHART.w, voltsY(volts), 0]]);
    fillLine(chartGrid, lines.flat());
    const ticks = [];
    for (let t = DECLARED.clock.start; t <= DECLARED.clock.end * 1.0000001; t *= 10) ticks.push([[timeX(t), CHART.volts.y, 0], [timeX(t), CHART.volts.y - CHART.tick, 0]]);
    fillLine(chartTicks, ticks.flat());
  }

  // ---------------------------------------------------------------------------
  // The ground about the rod.
  // ---------------------------------------------------------------------------
  const earth = part('earth', 'The ground around the rod', `The ground’s potential out from the earth rod, from the rod’s own surface to ${fixed(DECLARED.reach, 0)} m away across the panel, and up it by its logarithm from ${fixed(EARTH.low / 1e3, 0)} kV to ${fixed(EARTH.high / 1e6, 0)} MV. The faint curve is the potential at the current’s peak and the dark one where the clock stands. The two marks are a person ${fixed(DECLARED.person, 0)} m from the rod with feet one step apart, and the bracket between them is the step voltage.`, [0, 0, 0], system);
  const earthFrame = segmentLines(4, COLORS.frame, earth), earthGrid = segmentLines(6, COLORS.faint, earth);
  const earthTicks = segmentLines(5, COLORS.frame, earth), earthCurveGuide = lineObject(DECLARED.ground, COLORS.faint, earth), earthNow = lineObject(DECLARED.ground, COLORS.earth, earth);
  const feet = segmentLines(2, COLORS.frame, earth), stepBracket = segmentLines(3, COLORS.volts, earth);
  {
    fillLine(earthFrame, [[EARTH.x, EARTH.y], [EARTH.x + EARTH.w, EARTH.y], [EARTH.x + EARTH.w, EARTH.y], [EARTH.x + EARTH.w, EARTH.y + EARTH.h], [EARTH.x + EARTH.w, EARTH.y + EARTH.h], [EARTH.x, EARTH.y + EARTH.h], [EARTH.x, EARTH.y + EARTH.h], [EARTH.x, EARTH.y]].map(([x, y]) => [x, y, 0]));
    const lines = [];
    for (let volts = EARTH.low * 10; volts < EARTH.high; volts *= 10) lines.push([[EARTH.x, groundY(volts), 0], [EARTH.x + EARTH.w, groundY(volts), 0]]);
    fillLine(earthGrid, lines.flat());
    const ticks = [];
    for (let distance = 5; distance <= DECLARED.reach; distance += 5) ticks.push([[groundX(distance), EARTH.y, 0], [groundX(distance), EARTH.y - CHART.tick, 0]]);
    fillLine(earthTicks, ticks.flat());
  }

  const d = LIGHTNING_DEFAULTS, domain = key => LIGHTNING_DOMAINS[key];
  control('field', 'Storm field at the roof', ...domain('field'), d.field, 'kV/m', 'How strong the storm leaves the field at the roof, before the point gathers it. Measured surface fields under thunderstorms rarely pass 8 kV/m in Florida and are usually under 12 kV/m in New Mexico.');
  control('tip', 'Tip radius', ...domain('tip'), d.tip, 'mm', 'How sharply the air terminal is rounded at its tip. The sharper it is, the more it multiplies the storm’s field.');
  control('level', 'Protection level', ...domain('level'), d.level, '', 'The lightning protection level the system is built for. Level I takes the largest currents and the smallest rolling sphere; level IV the least.', LEVEL_OPTIONS);
  control('stroke', 'Which stroke', ...domain('stroke'), d.stroke, '', 'The standard gives a first short stroke, which carries the charge, and a subsequent short stroke, which rises far faster.', STROKE_OPTIONS);
  control('soil', 'Soil resistivity', ...domain('soil'), d.soil, 'Ω·m', 'How poorly the ground conducts. The rod’s resistance and the potential around it follow it in proportion.');
  control('gap', 'Gap to the pipe', ...domain('gap'), d.gap, 'm', 'How far the pipe runs from the down conductor. The standard asks for at least s = ki·kc·l/km of air.');

  const result = finish(values => {
    const plan = lightningPlan(values), t = timeOfClock(clock), now = lightningAt(plan, t), started = clock > 0;
    const {level, stroke, shape} = plan;

    // The house: the pipe at its gap, the bonding bar, the charges, the field arrows and the rolling sphere.
    rect(pipeBar, ...sm([-values.gap - STORM.pipe, -values.gap + STORM.pipe]), ...sm([0, STORM.house[2]]), 0.003);
    rect(bondBar, ...sm([-values.gap - STORM.pipe, STORM.conductor]), ...sm(STORM.bar), 0.005);
    fillStrip(terminal, [[sm([STORM.terminal[0], STORM.house[2]]), sm([-STORM.terminal[0], STORM.house[2]])], [sm([0, STORM.terminal[1]]), sm([0, STORM.terminal[1]])]], 0.004);
    const marks = Math.round(values.field), [chargeLeft, chargeRight] = STORM.charges;
    fillLine(minuses, Array.from({length: marks}, (_, i) => {
      const x = chargeLeft + (chargeRight - chargeLeft) * (marks > 1 ? i / (marks - 1) : 0.5);
      return [smPoint([x - STORM.chargeMark / 2, STORM.cloud[0] + 0.2], 0.002), smPoint([x + STORM.chargeMark / 2, STORM.cloud[0] + 0.2], 0.002)];
    }).flat());
    fillLine(pluses, Array.from({length: marks}, (_, i) => {
      const x = STORM.ground[0] + (STORM.ground[1] - STORM.ground[0]) * (marks > 1 ? i / (marks - 1) : 0.5), y = STORM.groundMark[0], arm = STORM.groundMark[1] / 2;
      return [smPoint([x - arm, y], 0.002), smPoint([x + arm, y], 0.002), smPoint([x, y - arm], 0.002), smPoint([x, y + arm], 0.002)];
    }).flat());
    for (const arrow of fieldArrows) arrow.userData.setLength(plan.ambient * STORM.arrowPerVolt * SCALE.storm);
    const radius = level.radius, touch = plan.roofTouch, centerY = STORM.house[2] + radius, sweep = Math.atan2(touch, radius - DECLARED.height);
    fillLine(sphereArc, Array.from({length: STORM.arcPoints}, (_, i) => {
      const angle = sweep * i / (STORM.arcPoints - 1);
      return smPoint([-touch + radius * Math.sin(angle), centerY - radius * Math.cos(angle)], 0.006);
    }));
    fillLine(touchTick, [smPoint([-touch, STORM.house[2]], 0.006), smPoint([-touch, STORM.house[2] + STORM.touchMark], 0.006)]);
    const plume = plan.corona && !started;
    ionDots.forEach((mark, i) => {
      mark.visible = plume;
      mark.position.set(...smPoint([(i % 2 ? 1 : -1) * STORM.ions.sway, STORM.ions.first + i * STORM.ions.step], 0.006));
    });
    fillLine(channel, started ? zigzag([0, STORM.cloud[0]], [0, STORM.terminal[1]], STORM.channel.points, STORM.channel.sway).map(point => smPoint(point, 0.005)) : []);
    const width = Math.abs(now.gap) * STORM.wedgePerVolt;
    fillStrip(wedge, started ? [[sm([STORM.conductor, 0]), sm([STORM.conductor, 0])], [sm([STORM.conductor + width, STORM.house[2]]), sm([STORM.conductor, STORM.house[2]])]] : [], 0.003);
    currentArrow.userData.setLength(started ? now.current * STORM.current.perAmpere * SCALE.storm : 0);
    fillLine(stormSpark, now.flashed ? zigzag([-values.gap, STORM.house[2]], [0, STORM.house[2]], STORM.spark.points, STORM.spark.sway).map(point => smPoint(point, 0.007)) : []);

    // The tip: the metal, the equipotentials, the zone where air breaks down and the ions.
    const spheroid = plan.spheroid, rows = [];
    for (let i = 0; i <= TIPVIEW.samples; i++) {
      const depth = windowBelow * (i / TIPVIEW.samples) ** 2, height = spheroid.c - depth;
      const across = Math.min(windowHalf, spheroid.b * Math.sqrt(Math.max(0, 1 - (height / spheroid.c) ** 2)));
      rows.unshift([[across * 1000 * SCALE.tip, -depth * 1000 * SCALE.tip], [-across * 1000 * SCALE.tip, -depth * 1000 * SCALE.tip]]);
    }
    fillStrip(metal, rows, -0.002);
    fillLine(metalLine, [...rows.map(row => [row[1][0], row[1][1], -0.001]), ...rows.slice().reverse().map(row => [row[0][0], row[0][1], -0.001])]);
    fillLine(equipotentials, plan.contours.flatMap(contour => contour.points.slice(0, -1).flatMap((point, i) => [tp(point[0], point[1], 0.001), tp(contour.points[i + 1][0], contour.points[i + 1][1], 0.001)])));
    const zone = plan.zone;
    if (zone) {
      const left = zone.rows.slice(1).reverse().map(row => [[-row.surface[0], row.surface[1]], [-row.boundary[0], row.boundary[1]]]);
      const both = [...left, ...zone.rows.map(row => [row.surface, row.boundary])];
      fillStrip(zoneFill, both.map(([inner, outer]) => [tp(inner[0], inner[1]).slice(0, 2), tp(outer[0], outer[1]).slice(0, 2)]), -0.0015);
      fillLine(zoneLine, both.map(([, outer]) => tp(outer[0], outer[1], 0.0005)));
      zoneFill.mesh.visible = plan.corona;
    } else {
      fillStrip(zoneFill, []);
      fillLine(zoneLine, []);
    }
    tipIons.forEach((mark, i) => {
      mark.visible = plan.corona && !started;
      const height = (zone ? zone.height : 0) + TIPVIEW.ions.first + i * TIPVIEW.ions.step;
      mark.position.set(...tp((i % 2 ? 1 : -1) * TIPVIEW.ions.sway, height, 0.002));
    });

    // The gap: the pipe at its distance, the gap measured, the standard’s bracket and the spark.
    rect(gapPipe, (-values.gap - GAPVIEW.pipe) * SCALE.gap, (-values.gap + GAPVIEW.pipe) * SCALE.gap, gapBottom * SCALE.gap, 0, 0.002);
    fillLine(gapMark, [[-values.gap, GAPVIEW.mark], [0, GAPVIEW.mark], [-values.gap, GAPVIEW.mark - GAPVIEW.tick / 2], [-values.gap, GAPVIEW.mark + GAPVIEW.tick / 2], [0, GAPVIEW.mark - GAPVIEW.tick / 2], [0, GAPVIEW.mark + GAPVIEW.tick / 2]].map(([x, y]) => gp(x, y, 0.004)));
    fillLine(gapBracket, [[-plan.separation, GAPVIEW.bracket], [0, GAPVIEW.bracket], [-plan.separation, GAPVIEW.bracket - GAPVIEW.tick / 2], [-plan.separation, GAPVIEW.bracket + GAPVIEW.tick / 2], [0, GAPVIEW.bracket - GAPVIEW.tick / 2], [0, GAPVIEW.bracket + GAPVIEW.tick / 2]].map(([x, y]) => gp(x, y, 0.004)));
    fillLine(gapSpark, now.flashed ? zigzag([-values.gap, 0], [0, 0], GAPVIEW.spark.points, GAPVIEW.spark.sway).map(([x, y]) => gp(x, y, 0.005)) : []);

    // The charts: the whole strike faintly, and as far as the clock has run.
    const shown = started ? plan.samples.filter(sample => sample.t < t) : [];
    fillLine(currentGuide, plan.samples.map(sample => [timeX(sample.t), currentY(sample.current), 0]));
    fillLine(gapGuide, plan.samples.map(sample => [timeX(sample.t), voltsY(sample.gap), 0]));
    fillLine(earthGuide, plan.samples.map(sample => [timeX(sample.t), voltsY(sample.earth), 0]));
    fillLine(currentCurve, started ? [...shown.map(sample => [timeX(sample.t), currentY(sample.current), 0]), [timeX(t), currentY(now.current), 0]] : []);
    fillLine(gapCurve, started ? [...shown.map(sample => [timeX(sample.t), voltsY(sample.gap), 0]), [timeX(t), voltsY(now.gap), 0]] : []);
    fillLine(earthCurve, started ? [...shown.map(sample => [timeX(sample.t), voltsY(sample.earth), 0]), [timeX(t), voltsY(now.earth), 0]] : []);
    fillLine(withstandLine, [[CHART.x, voltsY(plan.withstand), 0], [CHART.x + CHART.w, voltsY(plan.withstand), 0]]);
    fillLine(cursor, started ? [[timeX(t), CHART.current.y, 0], [timeX(t), CHART.current.y + CHART.current.h, 0], [timeX(t), CHART.volts.y, 0], [timeX(t), CHART.volts.y + CHART.volts.h, 0]] : []);

    // The ground: its potential at the peak, and where the clock stands.
    fillLine(earthCurveGuide, plan.ground.map(sample => [groundX(sample.x), groundY(sample.volts), 0]));
    fillLine(earthNow, started ? plan.ground.map(sample => [groundX(sample.x), groundY(sample.volts * now.share), 0]) : []);
    const stepShare = started ? now.share : 1, near = plan.step.near * stepShare, far = plan.step.far * stepShare;
    fillLine(feet, [DECLARED.person, DECLARED.person + DEHN.step].flatMap(distance => [[groundX(distance), EARTH.y, 0], [groundX(distance), EARTH.y - EARTH.foot, 0]]));
    fillLine(stepBracket, [[groundX(DECLARED.person), groundY(near), 0], [groundX(DECLARED.person), groundY(far), 0], [groundX(DECLARED.person), groundY(far), 0], [groundX(DECLARED.person + DEHN.step), groundY(far), 0]]);

    // Readings.
    const coronaText = plan.corona ? `on, ionizing ${fixed(plan.zone.height * 1000, 2)} mm above the tip` : 'off';
    const status = !started
      ? `Ready · the tip stands at ${fixed(plan.tipField / 1e6, 2)} MV/m, ${plan.corona ? 'past' : 'short of'} the ${fixed(CORONA.onset / 1e6, 2)} MV/m that starts a corona; press Play to strike it`
      : now.flashed
        ? `Side flash · the gap broke down ${timeText(plan.flash)} in, at ${fixed(plan.withstand / 1e6, 2)} MV across ${fixed(values.gap, 2)} m`
        : clock >= RUN
          ? `Done · ${fixed(now.charge, 1)} C went to earth, the ground rose ${fixed(plan.earthMax / 1e6, 2)} MV at the rod, and the gap held`
          : now.current < 1e-3 * plan.top
            ? `Striking · the current has not begun to rise, ${timeText(t)} in`
            : `Striking · ${fixed(now.current / 1e3, 1)} kA ${now.slope >= 0 ? 'and rising' : 'and falling'}, ${timeText(t)} in`;
    return {
      state: {...plan, now, clock, t},
      readings: [
        r('Your result', status),
        r('Tip field', `${fixed(plan.tipField / 1e6, 2)} MV/m`, `The terminal is Moore’s semi-ellipsoid ${fixed(DECLARED.height, 0)} m tall with a tip radius of ${fixed(values.tip, 1)} mm, so c/a is ${fixed(plan.ratio, 0)} and the tip multiplies the storm’s ${fixed(values.field, 0)} kV/m by ${fixed(plan.enhancement, 0)}. Corona starts where the field reaches ${fixed(CORONA.detach, 0)} V/m for every pascal of air, which at ${fixed(ATMOSPHERE, 0)} Pa is ${fixed(CORONA.onset / 1e6, 2)} MV/m; this tip reaches that once the storm’s field passes ${fixed(plan.onsetField / 1e3, 2)} kV/m.`),
        r('Corona', coronaText, `${plan.corona ? `The air breaks down at ${fixed(PAGES.air / 1e6, 0)} MV/m, so the field is that strong for ${fixed(plan.zone.height * 1000, 2)} mm straight up from the tip and ${fixed(Math.abs(plan.zone.rows.at(-1).surface[1]) * 1000, 2)} mm down its sides.` : `The tip is ${fixed(plan.tipField / 1e6, 2)} MV/m, short of the ${fixed(CORONA.onset / 1e6, 2)} MV/m a corona needs; a tip this round needs ${fixed(plan.onsetField / 1e3, 2)} kV/m from the storm.`} ${fixed(CORONA.falloff.radii, 0)} tip radii up, the field is down to ${plan.falloff === null ? 'nothing, with no storm field at all' : `${fixed(100 * plan.falloff, 2)}% of the tip’s`}, so whatever the point does it does close by.`),
        r('Stroke', started ? `${fixed(now.current / 1e3, 1)} kA now` : `${fixed(plan.peak / 1e3, 0)} kA peak`, `Level ${level.name}'s ${stroke.name} is ${fixed(plan.peak / 1e3, 0)} kA of ${stroke.label}. The function the standard fixes rises from a tenth to nine tenths of its peak in ${fixed((shape.t90 - shape.t10) * 1e6, 2)} μs and falls to half in ${fixed(shape.half * 1e6, 0)} μs, carrying ${fixed(plan.charge, 1)} C and ${fixed(plan.energy / 1e6, 2)} MJ for each ohm it runs through.`),
        r('Steepness', started ? `${signed(now.slope / 1e9, 1)} kA/μs now` : `${fixed(plan.steepest / 1e9, 1)} kA/μs at most`, `The current is steepest ${timeText(plan.steepestTime)} in, at ${fixed(plan.steepest / 1e9, 1)} kA/μs, where the current itself is only ${fixed(plan.steepestCurrent / 1e3, 0)} kA. Between three tenths and nine tenths of the peak it averages ${fixed(plan.average / 1e9, 0)} kA/μs.`),
        r('Down conductor', started ? `${signed(now.gap / 1e6, 2)} MV now` : `${fixed(plan.gapMax / 1e6, 2)} MV at most`, `A down conductor carries about ${fixed(IET.inductance * 1e6, 0)} µH for every meter, so ${fixed(DECLARED.length, 0)} m of it turns the steepest rise into ${fixed(plan.inductiveMax / 1e6, 2)} MV between its top and the pipe bonded to its foot. The same ${fixed(DECLARED.length, 0)} m of ${fixed(DEHN.diameter * 1000, 0)} mm copper is only ${fixed(CONDUCTOR.resistance * 1e3, 2)} mΩ, which even ${fixed(plan.peak / 1e3, 0)} kA turns into ${fixed(CONDUCTOR.resistance * plan.top / 1e3, 2)} kV.`),
        r('Earth rise', started ? `${fixed(now.earth / 1e6, 2)} MV now` : `${fixed(plan.earthMax / 1e6, 2)} MV at the peak`, `The rod is ${fixed(DEHN.rod, 0)} m long and ${fixed(2 * DECLARED.rodRadius * 1000, 0)} mm across, so in ${fixed(values.soil, 0)} Ω·m soil its resistance is ρ/(2πl)·ln(2l/r) = ${fixed(plan.earthResistance, 1)} Ω, and ${fixed(plan.top / 1e3, 0)} kA lifts the whole earth termination ${fixed(plan.earthMax / 1e6, 2)} MV above remote earth. DEHN asks for ${fixed(DEHN.earth, 0)} Ω or less, measured at low frequency, which this rod reaches up to ${fixed(DEHN.earth * 2 * Math.PI * DEHN.rod / Math.log(2 * DEHN.rod / DECLARED.rodRadius), 0)} Ω·m.`),
        r('Step voltage', started ? `${fixed(now.step / 1e3, 0)} kV now` : `${fixed(plan.step.volts / 1e3, 0)} kV at the peak`, `Right at the rod the ground is at ${fixed(plan.earthMax / 1e6, 2)} MV, ${fixed(plan.ground.at(-1).volts / 1e3, 0)} kV ${fixed(DECLARED.reach, 0)} m away. A person standing ${fixed(DECLARED.person, 0)} m out with feet one step of ${fixed(DEHN.step, 0)} m apart has ${fixed(plan.step.volts / 1e3, 0)} kV between them at the peak.`),
        r('Side flash', plan.flash === null ? `holds: ${fixed(plan.gapField / 1e6, 2)} MV/m across ${fixed(values.gap, 2)} m` : `flashes ${timeText(plan.flash)} in`, `The standard asks for s = ki·kc·l/km = ${fixed(level.ki, 2)} × ${fixed(DEHN.kc, 0)} × ${fixed(DECLARED.length, 0)} m / ${fixed(DEHN.air, 0)} = ${fixed(plan.separation, 2)} m of air at level ${level.name}. This stroke puts ${fixed(plan.gapMax / 1e6, 2)} MV across the gap, ${fixed(plan.gapField / 1e6, 2)} MV/m across ${fixed(values.gap, 2)} m, against air’s ${fixed(PAGES.air / 1e6, 0)} MV/m and the ${fixed(WITHSTAND / 1e6, 2)} MV/m this model takes the gap to hold; it flashes anything under ${fixed(plan.threshold, 2)} m.`),
        r('Rolling sphere', `${fixed(level.radius, 0)} m`, `Level ${level.name} is drawn against strikes of ${fixed(level.minimum / 1e3, 0)} kA and up, which is ${fixed(100 * level.above, 0)}% of them, and r = 10·I^0.65 makes that ${fixed(plan.strikeRadius, 1)} m against the ${fixed(level.radius, 0)} m the standard rounds it to. Resting on the roof, a sphere that size touching the tip touches the roof ${fixed(plan.roofTouch, 1)} m away; roof farther out than that can still be struck.`),
        r('Clock', started ? timeText(t) : 'before the strike', `The clock takes ${fixed(DECLARED.clock.decade, 0)} s for every tenfold in time, from ${fixed(DECLARED.clock.start * 1e6, 1)} μs to ${fixed(DECLARED.clock.end * 1e3, 0)} ms, so the whole strike takes ${fixed(RUN, 1)} s to watch. ${started ? `At ${timeText(t)} the clock is running ${fixed(DECLARED.clock.decade / (Math.LN10 * t), 0)} times slower than the strike.` : `Its peak comes ${timeText(plan.peakTime)} in.`}`),
        r('Scales', `${fixed(1 / timesLarger(SCALE.storm / 1000), 0)} times smaller`, `The house and its conductor are drawn ${fixed(1 / timesLarger(SCALE.storm / 1000), 0)} times smaller than true size, the tip’s close up ${fixed(timesLarger(SCALE.tip), 0)} times larger in a window ${fixed(2 * DECLARED.window.half * 1000, 0)} mm wide, and the gap close up ${fixed(1 / timesLarger(SCALE.gap / 1000), 0)} times smaller. The cloud, its charges and the field arrows are not to scale.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(RUN, clock + dt); return render(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = clockOfTime(time); return render(); };
  result.actions = [
    {label: 'Inspect: the point before the strike', part: 'tip', view: 'front', replay: false, run() { clock = 0; return render(); }},
    {label: 'Inspect: the steepest rise', part: 'chart', view: 'front', replay: false, run() { return inspect(result.getState().gapTime); }},
    {label: 'Inspect: the gap', part: 'gap', view: 'front', replay: false, run() { return inspect(result.getState().gapTime); }},
    {label: 'Inspect: the ground at the peak', part: 'earth', view: 'front', replay: false, run() { return inspect(result.getState().peakTime); }},
    {label: 'Inspect: the whole installation', part: 'storm', view: 'front', replay: false, run() { return inspect(result.getState().peakTime); }},
  ];
  result.playback = {
    label: 'Strike',
    description: `The strike attaches to the air terminal and its current runs down to earth, on a clock that takes ${fixed(DECLARED.clock.decade, 0)} s for every tenfold in time, from ${fixed(DECLARED.clock.start * 1e6, 1)} μs to ${fixed(DECLARED.clock.end * 1e3, 0)} ms.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= RUN,
    blocked: () => false,
  };
  result.resultPart = {id: 'chart', label: 'Inspect what the strike did', view: 'front', focusOnComplete: false, available: () => clock >= RUN};

  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {
    system, storm, tip, gap, chart, earth,
    soil, house, walls, roofPlane, groundLine, cloud, minuses, pluses, terminal, conductorBar, pipeBar, bondBar, rodBar, fieldArrows, sphereArc, touchTick, ionDots, channel, wedge, currentArrow, stormSpark,
    tipFrame, metal, metalLine, equipotentials, zoneFill, zoneLine, tipIons,
    gapFrame, gapRoof, gapConductor, gapTerminal, gapPipe, gapBracket, gapMark, gapSpark,
    chartFrames, chartGrid, chartTicks, currentGuide, currentCurve, gapGuide, gapCurve, earthGuide, earthCurve, withstandLine, cursor,
    earthFrame, earthGrid, earthTicks, earthCurveGuide, earthNow, feet, stepBracket,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

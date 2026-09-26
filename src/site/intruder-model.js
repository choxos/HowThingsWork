import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, textLabel} from './scene-kit.js';
import {
  intruderPlan, intruderAt, coverOf, AREA,
  LENS, DECLARED, OPTEX, EMITTER, RECEIVER, PAPIRS, PYRO, MURATA, SKIN, WALKING,
  MODE_OPTIONS, HOLD_OPTIONS, INTRUDER_DEFAULTS, INTRUDER_DOMAINS, CONTROL_MODES,
} from './intruder-physics.js';

// ---------------------------------------------------------------------------
// Two burglar alarms watching one walker, each drawn from above: an active
// infrared beam barrier across a path, with the crossing close up and the power
// reaching the receiver; and a passive infrared detector on a wall, with its
// zones, its lens and elements cut open, and what the elements give.
//
// Scale: the site draws true size as 1 mm to 0.01 scene units. The beam and its
// posts are drawn 100 times smaller than that, 1 m to 0.1 units; the crossing 20
// times smaller, 1 m to 0.5 units; the zones 50 times smaller, 1 m to 0.2 units;
// and the lens with its elements 8 times larger, 1 mm to 0.08 units. The posts
// and the detector’s case are markers, not drawn to their size. The charts are
// not to scale, and each panel’s top is set to the largest in its watch.
//
// Time: the clock runs in real time, 4 s for the beam and 12 s for the zones.
// ---------------------------------------------------------------------------

export const TRUE_MM = 0.01;
export const BEAM_M = 0.1;
export const CROSS_M = 0.5;
export const ZONE_M = 0.2;
export const LENS_MM = 0.08;

/** How many times smaller than true size a scale in units per meter draws. */
export const timesSmaller = perMeter => TRUE_MM * 1000 / perMeter;
/** How many times larger than true size a scale in units per millimeter draws. */
export const timesLarger = perMillimeter => perMillimeter / TRUE_MM;

/** The beam plan: where it sits, the post markers, how far the path is drawn either way, m, and the walker’s dot. */
export const BEAM = Object.freeze({origin: Object.freeze([0, 0.95, 0]), post: Object.freeze([0.1, 0.26]), reach: 3.5, dot: 0.024, lamp: 0.05, lift: 0.004});
/** The crossing close up: where it sits, how far it is drawn either way, m, and the body’s width and depth, m. */
export const CROSS = Object.freeze({origin: Object.freeze([-1.75, -0.6, 0]), half: 1.15, body: Object.freeze([0.45, 0.25]), tick: 0.04, lift: 0.004});
/** The zones plan: where it sits, how far the zones are drawn, m, the case marker, and the body. */
export const ZONEVIEW = Object.freeze({origin: Object.freeze([-1.4, -1.15, 0]), reach: 10.5, box: Object.freeze([0.42, 0.2]), body: Object.freeze([0.45, 0.25]), lamp: 0.05, lift: 0.004});
/** The lens close up: where it sits, how wide the element plane is drawn, mm, the grooves on each facet, the facet’s share of its step, and the elements. */
export const LENSVIEW = Object.freeze({origin: Object.freeze([1.5, 0.12, 0]), plane: 3.4, grooves: 3, facet: 0.86, depth: 0.5, lift: 0.004});
/** The beam’s chart: the frame, the decades it spans, the ticks, and the strip of flashes below it. */
export const BEAMCHART = Object.freeze({x: -0.55, y: -1.02, w: 2.6, h: 0.86, low: -1, high: 4, tickEvery: 0.5, tick: 0.02, cursor: 0.03, bar: 0.035, gap: 0.018, strip: Object.freeze({y: -1.26, h: 0.14, window: 0.04}), z: 0});
/** The elements' two panels: the power above and the difference below, with the seconds between ticks. */
export const POWER = Object.freeze({x: 0.6, y: -0.62, w: 2.25, h: 0.44, tickEvery: 1, tick: 0.02, cursor: 0.03, z: 0});
export const OUTPUT = Object.freeze({x: 0.6, y: -1.3, w: 2.25, h: 0.56, tickEvery: 1, tick: 0.02, cursor: 0.03, z: 0});

export const COLORS = Object.freeze({
  ground: 0xe9e4d8, chart: 0x374736, faint: 0x9aa39a, guide: 0xc2cabf, post: 0x4b5550, case: 0x4b5550,
  beam: 0xd99a2b, dim: 0xb9bdb4, body: 0xc14f39, path: 0x9aa39a, plus: 0xd99a2b, minus: 0x2b5d9c,
  alarm: 0xc14f39, quiet: 0x8f989b, element: 0x8f989b, lens: 0xbfd0d6, warm: 0xe8c98a, cool: 0xa9bfd6, single: 0xc9b38a,
});

/** A number with a true minus sign. */
export const signed = (value, digits) => { const text = fixed(Math.abs(value), digits); return value < 0 && text !== fixed(0, digits) ? `−${text}` : text; };

/** A round number at or above `value` from 1, 2 and 5 in each decade. */
export function niceTop(value) {
  if (!(value > 0)) return 1;
  const decade = 10 ** Math.floor(Math.log10(value)), steps = [1, 2, 5, 10];
  return decade * steps.find(step => value <= step * decade * (1 + 1e-12));
}

/** Where a time and a level, in threshold units, fall on the beam’s chart; a level of zero sits on the floor. */
export const beamX = t => BEAMCHART.x + Math.max(0, Math.min(1, t / DECLARED.beamWatch)) * BEAMCHART.w;
export const beamY = level => {
  const decades = Math.max(BEAMCHART.low, Math.min(BEAMCHART.high, level > 0 ? Math.log10(level) : BEAMCHART.low));
  return BEAMCHART.y + (decades - BEAMCHART.low) / (BEAMCHART.high - BEAMCHART.low) * BEAMCHART.h;
};
/** Where a time, a power and an output fall on the elements’ panels. */
export const zoneX = (panel, t) => panel.x + Math.max(0, Math.min(1, t / DECLARED.zoneWatch)) * panel.w;
export const powerY = (watts, top) => POWER.y + Math.max(0, Math.min(1, watts / top)) * POWER.h;
export const outputY = (volts, top) => OUTPUT.y + (Math.max(-1, Math.min(1, volts / top)) + 1) / 2 * OUTPUT.h;

export function createIntruderModel() {
  const kit = houseModel('Active burglar alarm'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownSpan = '', shownZones = '';
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const disc = (radius, color, parent, segments = 32) => { const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), unlit(color)); parent.add(mesh); return mesh; };
  const frameLine = (line, box) => fillLine(line, [[box.x, box.y, box.z], [box.x + box.w, box.y, box.z], [box.x + box.w, box.y + box.h, box.z], [box.x, box.y + box.h, box.z], [box.x, box.y, box.z]]);
  /** Dashes along a line: `count` of them spanning from `from` to `to`, each covering half its step. */
  const dashes = (count, from, to, place) => Array.from({length: count}, (_, i) => { const step = (to - from) / count, a = from + i * step; return [place(a), place(a + step / 2)]; }).flat();
  const shade = (material, color, share) => material.color.setHex(COLORS.ground).lerp(new THREE.Color(color), Math.max(0, Math.min(1, share)));

  const system = part('system', 'Two burglar alarms, from above', `An infrared beam barrier across a path, drawn ${fixed(timesSmaller(BEAM_M), 0)} times smaller than true size with the crossing ${fixed(timesSmaller(CROSS_M), 0)} times smaller, and a passive infrared detector on a wall, its zones ${fixed(timesSmaller(ZONE_M), 0)} times smaller and its lens and elements ${fixed(timesLarger(LENS_MM), 0)} times larger. Press Play to send a walker across: the clock runs in real time, ${fixed(DECLARED.beamWatch, 0)} s of it for the beam and ${fixed(DECLARED.zoneWatch, 0)} s for the zones.`);

  // The beam barrier from above.
  const beam = part('beam', 'Beam barrier, from above', `The barrier from above, drawn ${fixed(timesSmaller(BEAM_M), 0)} times smaller than true size: a transmitter flashing infrared at one post and a receiver at the other, with the walker crossing the line between them. The lamp by the receiver lights while it sounds. The posts are markers, not drawn to their size.`, BEAM.origin, system);
  const groundLine = lineObject(2, COLORS.guide, beam);
  const transmitter = flat(COLORS.post, beam), receiver = flat(COLORS.post, beam);
  const beamNear = lineObject(2, COLORS.beam, beam), beamFar = lineObject(2, COLORS.beam, beam);
  const beamPath = segmentLines(7, COLORS.path, beam);
  const beamWalker = disc(BEAM.dot, COLORS.body, beam);
  const beamLamp = disc(BEAM.lamp, COLORS.quiet, beam, 24);

  // Where the walker crosses it.
  const crossing = part('crossing', 'Where the walker crosses the beam', `The crossing drawn ${fixed(timesSmaller(CROSS_M), 0)} times smaller than true size: the beam taken as a line between the two lenses, and the body ${fixed(PAPIRS.target.width * 1000, 0)} mm deep along its path, the depth of Panasonic’s test target. While the body covers the line, no flash reaches the receiver, and while the walker is still outside this view a triangle on its path says which way it is coming from.`, CROSS.origin, system);
  const crossNear = lineObject(2, COLORS.beam, crossing), crossFar = lineObject(2, COLORS.beam, crossing);
  const crossPath = segmentLines(9, COLORS.path, crossing);
  const crossBody = flat(COLORS.body, crossing);
  const crossDepth = segmentLines(3, COLORS.chart, crossing);
  const crossAhead = disc(CROSS.tick, COLORS.body, crossing, 3);

  // The passive detector’s zones from above.
  const zones = part('zones', 'Detection zones, from above', `The passive detector’s zones from above, drawn ${fixed(timesSmaller(ZONE_M), 0)} times smaller than true size: each of the lens’s ${fixed(DECLARED.facets, 0)} facets sends one strip of the room onto the + element (gold) and one onto the − element (blue), with gaps between where it sees neither. The walker crosses along the path you set, and the lamp lights while the detector sounds.`, ZONEVIEW.origin, system);
  const wedgeGeometry = new THREE.BufferGeometry();
  // White, so each wedge shows the color its own vertices carry rather than that color times this one.
  const wedges = new THREE.Mesh(wedgeGeometry, unlit(0xffffff, {vertexColors: true, transparent: true, opacity: 0.55}));
  zones.add(wedges);
  const detectorCase = flat(COLORS.case, zones);
  const zonePath = segmentLines(13, COLORS.path, zones);
  const zoneWalker = disc(0.5, COLORS.body, zones, 24);
  const zoneLamp = disc(ZONEVIEW.lamp, COLORS.quiet, zones, 24);

  // The lens and its elements, cut open.
  const lens = part('lens', 'Fresnel lens and its two elements, cut open', `The lens and its elements from above, drawn ${fixed(timesLarger(LENS_MM), 0)} times larger than true size: each facet sits ${fixed(DECLARED.focal, 1)} mm in front of the elements and turns a direction into a place on them, so a body to the right of a facet’s axis lands on the left element. The bar under each facet shows where the body’s infrared falls now, gold on the + element and blue on the −, and each element’s shade shows the power reaching it.`, LENSVIEW.origin, system);
  const planeLine = lineObject(2, COLORS.chart, lens);
  const elementPlus = flat(COLORS.element, lens), elementMinus = flat(COLORS.element, lens);
  const facetLines = segmentLines(DECLARED.facets * (1 + LENSVIEW.grooves), COLORS.lens, lens);
  const rays = segmentLines(DECLARED.facets * 2, COLORS.faint, lens);
  const images = segmentLines(DECLARED.facets, COLORS.body, lens);

  // What the alarm sees.
  const signal = part('signal', 'What the alarm sees', `In beam mode: the power reaching the receiver against the threshold it needs, over the watch, each step of the scale ten times the one below, with the flashes of the ${fixed(BEAMCHART.strip.window * 1000, 0)} ms around the clock drawn below. In passive infrared mode: the power on each element above, and the difference the two give below, against the threshold of ${fixed(DECLARED.threshold * 1e6, 0)} μV either way. Each panel’s top is set to the largest in its watch.`, [0, 0, 0], system);
  const beamPanel = new THREE.Group(), zonePanel = new THREE.Group();
  signal.add(beamPanel, zonePanel);
  const beamFrame = lineObject(5, COLORS.chart, beamPanel);
  frameLine(beamFrame, BEAMCHART);
  const beamGrid = segmentLines(BEAMCHART.high - BEAMCHART.low, COLORS.guide, beamPanel);
  fillLine(beamGrid, Array.from({length: BEAMCHART.high - BEAMCHART.low}, (_, i) => { const y = beamY(10 ** (BEAMCHART.low + i + 1)); return [[BEAMCHART.x, y, BEAMCHART.z], [BEAMCHART.x + BEAMCHART.w, y, BEAMCHART.z]]; }).flat());
  const beamThreshold = segmentLines(1, COLORS.alarm, beamPanel);
  fillLine(beamThreshold, [[BEAMCHART.x, beamY(1), BEAMCHART.z], [BEAMCHART.x + BEAMCHART.w, beamY(1), BEAMCHART.z]]);
  const beamTicks = segmentLines(Math.round(DECLARED.beamWatch / BEAMCHART.tickEvery) - 1, COLORS.chart, beamPanel);
  fillLine(beamTicks, Array.from({length: Math.round(DECLARED.beamWatch / BEAMCHART.tickEvery) - 1}, (_, i) => { const x = beamX((i + 1) * BEAMCHART.tickEvery); return [[x, BEAMCHART.y, BEAMCHART.z], [x, BEAMCHART.y - BEAMCHART.tick, BEAMCHART.z]]; }).flat());
  const beamCurve = lineObject(6, COLORS.chart, beamPanel);
  const beamHold = segmentLines(3, COLORS.alarm, beamPanel);
  const beamOutput = flat(COLORS.alarm, beamPanel);
  const beamCursor = segmentLines(2, COLORS.chart, beamPanel);
  const stripFrame = lineObject(5, COLORS.faint, beamPanel);
  const flashes = segmentLines(Math.round(BEAMCHART.strip.window * DECLARED.rate) + 1, COLORS.beam, beamPanel);

  const powerFrame = lineObject(5, COLORS.chart, zonePanel), outputFrame = lineObject(5, COLORS.chart, zonePanel);
  frameLine(powerFrame, POWER);
  frameLine(outputFrame, OUTPUT);
  const zoneTicks = segmentLines(2 * (DECLARED.zoneWatch / POWER.tickEvery - 1), COLORS.chart, zonePanel);
  fillLine(zoneTicks, [POWER, OUTPUT].flatMap(panel => Array.from({length: DECLARED.zoneWatch / panel.tickEvery - 1}, (_, i) => { const x = zoneX(panel, (i + 1) * panel.tickEvery); return [[x, panel.y, panel.z], [x, panel.y - panel.tick, panel.z]]; }).flat()));
  const zeroLine = segmentLines(1, COLORS.faint, zonePanel);
  const thresholdLines = segmentLines(2, COLORS.alarm, zonePanel);
  const plusCurve = lineObject(DECLARED.samples, COLORS.plus, zonePanel), minusCurve = lineObject(DECLARED.samples, COLORS.minus, zonePanel);
  const outputGuide = lineObject(DECLARED.samples, COLORS.guide, zonePanel), outputCurve = lineObject(DECLARED.samples + 1, COLORS.chart, zonePanel);
  const singleCurve = lineObject(DECLARED.samples, COLORS.single, zonePanel);
  const zoneCursor = segmentLines(2, COLORS.chart, zonePanel);

  // The panels' words: titles, axes, and keys to the right.
  const TEXT = 0.04, css = color => `#${color.toString(16).padStart(6, '0')}`;
  const words = (parent, text, x, y, options = {}) => textLabel(parent, text, {height: TEXT, position: [x, y, 0.001], color: css(COLORS.chart), ...options});
  const seconds = watch => [0, watch / 2, watch].map(t => [t, fixed(t, 0)]);
  const B = BEAMCHART;
  chartText(beamPanel, (t, level) => [beamX(t), beamY(level), B.z], {
    title: 'Power at the receiver', size: TEXT,
    x: {min: 0, max: DECLARED.beamWatch, ticks: seconds(DECLARED.beamWatch)},
    y: {min: 10 ** B.low, max: 10 ** B.high, title: 'Times the threshold', ticks: Array.from({length: B.high - B.low + 1}, (_, i) => 10 ** (B.low + i)).map(level => [level, level < 1 ? String(level) : fixed(level, 0)])},
  });
  words(beamPanel, 'Seconds', B.x + B.w / 2, B.strip.y - 0.05);
  words(beamPanel, `Flashes, ${fixed(B.strip.window * 1000, 0)} ms around now`, B.x - 0.03, B.strip.y + B.strip.h / 2, {align: 'right', height: 0.034});
  words(beamPanel, 'Threshold', B.x + B.w + 0.03, beamY(1), {align: 'left', color: css(COLORS.alarm)});
  chartText(zonePanel, (t, v) => [zoneX(OUTPUT, t), OUTPUT.y + v * OUTPUT.h, OUTPUT.z], {x: {min: 0, max: DECLARED.zoneWatch, title: 'Seconds', ticks: seconds(DECLARED.zoneWatch)}, y: {min: 0, max: 1}, size: TEXT});
  words(zonePanel, 'Power on each element', POWER.x, POWER.y + POWER.h + 0.05, {align: 'left', weight: '600'});
  words(zonePanel, 'What the pair gives, against the threshold', OUTPUT.x, OUTPUT.y + OUTPUT.h + 0.05, {align: 'left', height: 0.034});
  words(zonePanel, 'Plus element', POWER.x + POWER.w + 0.03, POWER.y + POWER.h - 0.04, {align: 'left', color: css(COLORS.plus)});
  words(zonePanel, 'Minus element', POWER.x + POWER.w + 0.03, POWER.y + POWER.h - 0.09, {align: 'left', color: css(COLORS.minus)});
  words(zonePanel, 'Threshold', OUTPUT.x + OUTPUT.w + 0.03, OUTPUT.y + OUTPUT.h - 0.04, {align: 'left', color: css(COLORS.alarm)});
  const singleWord = words(zonePanel, 'One element alone', OUTPUT.x + OUTPUT.w + 0.03, OUTPUT.y + OUTPUT.h - 0.09, {align: 'left', color: css(COLORS.single)});

  const d = INTRUDER_DEFAULTS, domain = key => INTRUDER_DOMAINS[key];
  const only = key => values => CONTROL_MODES[key] === null || values.mode === CONTROL_MODES[key];
  control('mode', 'Method', ...domain('mode'), d.mode, '', 'An active barrier sends a beam of its own across a path; a passive detector sends nothing and watches the infrared the room already gives off.', MODE_OPTIONS);
  control('speed', 'Walker', ...domain('speed'), d.speed, 'm/s', `How fast the walker crosses. Panasonic tests its detectors at ${fixed(PAPIRS.speed, 1)} m/s; the Preferred walking speed page gives ${fixed(WALKING, 1)} m/s as a typical walk. At zero the walker stands in the beam, or in a zone.`, undefined, {enabledWhen: only('speed')});
  control('span', 'Posts apart', ...domain('span'), d.span, 'm', `How far the receiver stands from the transmitter. Optex rates the ${OPTEX.model} for ${fixed(OPTEX.range, 0)} m.`, undefined, {enabledWhen: only('span')});
  control('hold', 'Interruption setting', ...domain('hold'), d.hold, '', 'How long the receiver needs the beam to stay blocked before it sounds. These are the four settings on the Optex receiver.', HOLD_OPTIONS, {enabledWhen: only('hold')});
  control('range', 'Path from the detector', ...domain('range'), d.range, 'm', `How far in front of the detector the walker passes. Panasonic specifies its standard sensors to ${fixed(PAPIRS.distance, 0)} m.`, undefined, {enabledWhen: only('range')});
  control('contrast', 'Body over the room', ...domain('contrast'), d.contrast, '°C', `How much warmer the walker’s surface is than the room, which Panasonic’s test sets at ${fixed(PAPIRS.contrast, 0)} °C over a room at ${fixed(PAPIRS.ambient, 0)} °C. At zero the walker gives off exactly what the room does.`, undefined, {enabledWhen: only('contrast')});
  control('warming', 'Everything in view warms', ...domain('warming'), d.warming, '°C/min', 'Warms the room, its walls and the walker together, as sunlight or warm air from a heater would. Panasonic warns that a sudden temperature change in the detection area can be taken for an intruder.', undefined, {enabledWhen: only('warming')});

  const walkerColor = new THREE.Color(COLORS.body);
  const result = finish(v => {
    const plan = intruderPlan(v), now = intruderAt(plan, clock), beamMode = plan.mode === 0, b = plan.beam, z = plan.zones;
    let tops = null;
    beam.visible = crossing.visible = beamPanel.visible = beamMode;
    zones.visible = lens.visible = zonePanel.visible = !beamMode;

    if (beamMode) {
      // The posts, the beam between them and the walker crossing it.
      const half = v.span / 2 * BEAM_M, [postWide, postTall] = BEAM.post;
      if (shownSpan !== String(v.span)) {
        shownSpan = String(v.span);
        rect(transmitter, -half - postWide, -half, -postTall / 2, postTall / 2, BEAM.lift);
        rect(receiver, half, half + postWide, -postTall / 2, postTall / 2, BEAM.lift);
        fillLine(groundLine, [[-half - postWide, 0, -0.002], [half + postWide, 0, -0.002]]);
        fillLine(beamPath, dashes(7, -BEAM.reach * BEAM_M, BEAM.reach * BEAM_M, y => [0, y, 0.001]));
      }
      const at = Math.max(-BEAM.reach, Math.min(BEAM.reach, now.x)) * BEAM_M;
      beamWalker.position.set(0, at, BEAM.lift + 0.002);
      beamWalker.visible = Math.abs(now.x) <= BEAM.reach;
      fillLine(beamNear, [[-half, 0, BEAM.lift], [0, 0, BEAM.lift]]);
      fillLine(beamFar, [[0, 0, BEAM.lift], [half, 0, BEAM.lift]]);
      beamFar.material.color.setHex(now.blocked ? COLORS.dim : COLORS.beam);
      beamLamp.position.set(half + postWide + BEAM.lamp * 1.4, postTall / 2, BEAM.lift);
      beamLamp.material.color.setHex(now.sounding ? COLORS.alarm : COLORS.quiet);

      // The crossing, close up.
      const [bodyWide, bodyDeep] = CROSS.body;
      fillLine(crossPath, dashes(9, -CROSS.half * CROSS_M, CROSS.half * CROSS_M, y => [0, y, 0.001]));
      fillLine(crossNear, [[-CROSS.half * CROSS_M, 0, CROSS.lift], [0, 0, CROSS.lift]]);
      fillLine(crossFar, [[0, 0, CROSS.lift], [CROSS.half * CROSS_M, 0, CROSS.lift]]);
      crossFar.material.color.setHex(now.blocked ? COLORS.dim : COLORS.beam);
      rect(crossBody, -bodyWide / 2 * CROSS_M, bodyWide / 2 * CROSS_M, (now.x - bodyDeep / 2) * CROSS_M, (now.x + bodyDeep / 2) * CROSS_M, CROSS.lift + 0.002);
      crossBody.visible = Math.abs(now.x) <= CROSS.half + bodyDeep;
      const edge = bodyWide / 2 * CROSS_M + CROSS.tick;
      fillLine(crossDepth, [
        [edge, (now.x - bodyDeep / 2) * CROSS_M, CROSS.lift], [edge + CROSS.tick, (now.x - bodyDeep / 2) * CROSS_M, CROSS.lift],
        [edge, (now.x + bodyDeep / 2) * CROSS_M, CROSS.lift], [edge + CROSS.tick, (now.x + bodyDeep / 2) * CROSS_M, CROSS.lift],
        [edge + CROSS.tick / 2, (now.x - bodyDeep / 2) * CROSS_M, CROSS.lift], [edge + CROSS.tick / 2, (now.x + bodyDeep / 2) * CROSS_M, CROSS.lift],
      ]);
      crossDepth.visible = crossBody.visible;
      // While the walker is still outside this view, a triangle on the path says which way it is coming from.
      crossAhead.visible = Math.abs(now.x) > CROSS.half;
      crossAhead.position.set(0, Math.sign(now.x) * CROSS.half * CROSS_M, CROSS.lift + 0.002);
      crossAhead.rotation.z = Math.PI / 2;

      // The chart: the level the receiver gets, the setting it waits out, and the flashes.
      const floor = beamY(0), top = beamY(b.margin);
      const curve = b.still
        ? [[beamX(0), floor], [beamX(DECLARED.beamWatch), floor]]
        : [[beamX(0), top], [beamX(b.start), top], [beamX(b.start), floor], [beamX(b.end), floor], [beamX(b.end), top], [beamX(DECLARED.beamWatch), top]];
      fillLine(beamCurve, curve.map(([x, y]) => [x, y, BEAMCHART.z]));
      const holdFrom = b.still ? 0 : b.start, holdTo = holdFrom + v.hold / 1000;
      fillLine(beamHold, [
        [beamX(holdFrom), floor + BEAMCHART.gap, BEAMCHART.z], [beamX(holdTo), floor + BEAMCHART.gap, BEAMCHART.z],
        [beamX(holdFrom), floor + BEAMCHART.gap - BEAMCHART.tick / 2, BEAMCHART.z], [beamX(holdFrom), floor + BEAMCHART.gap + BEAMCHART.tick / 2, BEAMCHART.z],
        [beamX(holdTo), floor + BEAMCHART.gap - BEAMCHART.tick / 2, BEAMCHART.z], [beamX(holdTo), floor + BEAMCHART.gap + BEAMCHART.tick / 2, BEAMCHART.z],
      ]);
      // The bar grows while the receiver sounds, so it never shows an alarm before the clock reaches it.
      beamOutput.visible = b.alarmAt !== null && now.t >= b.alarmAt;
      if (beamOutput.visible) rect(beamOutput, beamX(b.alarmAt), beamX(Math.min(b.alarmEnds, now.t)), BEAMCHART.y - BEAMCHART.gap - BEAMCHART.bar, BEAMCHART.y - BEAMCHART.gap, BEAMCHART.z);
      const cx = beamX(now.t), cy = beamY(now.level);
      fillLine(beamCursor, [[cx - BEAMCHART.cursor, cy, BEAMCHART.z], [cx + BEAMCHART.cursor, cy, BEAMCHART.z], [cx, cy - BEAMCHART.cursor, BEAMCHART.z], [cx, cy + BEAMCHART.cursor, BEAMCHART.z]]);
      const strip = BEAMCHART.strip, from = now.t - strip.window / 2, count = Math.round(strip.window * DECLARED.rate) + 1;
      frameLine(stripFrame, {x: BEAMCHART.x, y: strip.y, w: BEAMCHART.w, h: strip.h, z: BEAMCHART.z});
      fillLine(flashes, Array.from({length: count}, (_, i) => {
        const when = Math.ceil(from * DECLARED.rate) / DECLARED.rate + i / DECLARED.rate;
        const x = BEAMCHART.x + Math.max(0, Math.min(1, (when - from) / strip.window)) * BEAMCHART.w;
        const lit = !(b.still ? true : Math.abs(v.speed * (when - DECLARED.beamWatch / 2)) < b.depth / 2) && when >= 0 && when <= DECLARED.beamWatch;
        return [[x, strip.y, BEAMCHART.z], [x, strip.y + (lit ? strip.h : strip.h * 0.12), BEAMCHART.z]];
      }).flat());
    } else {
      // The zones from above, and the walker on the path.
      if (shownZones !== 'drawn') {
        shownZones = 'drawn';
        const vertices = [], colors = [], plus = new THREE.Color(COLORS.plus), minus = new THREE.Color(COLORS.minus);
        const fan = (from, to, color) => {
          const first = [Math.sin(from) * ZONEVIEW.reach * ZONE_M, Math.cos(from) * ZONEVIEW.reach * ZONE_M], second = [Math.sin(to) * ZONEVIEW.reach * ZONE_M, Math.cos(to) * ZONEVIEW.reach * ZONE_M];
          // Wound from the far edge back to the near one, so every wedge faces the viewer.
          vertices.push(0, 0, 0, second[0], second[1], 0, first[0], first[1], 0);
          for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
        };
        LENS.plus.forEach(([from, to]) => fan(from, to, plus));
        LENS.minus.forEach(([from, to]) => fan(from, to, minus));
        wedgeGeometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(vertices), 3));
        wedgeGeometry.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(colors), 3));
        rect(detectorCase, -ZONEVIEW.box[0] / 2, ZONEVIEW.box[0] / 2, -ZONEVIEW.box[1], 0, ZONEVIEW.lift);
      }
      // The path is drawn across the fan itself, so it never runs out past the zones drawn.
      const reach = Math.min(v.range * Math.tan(LENS.edge), Math.sqrt(Math.max(0, ZONEVIEW.reach ** 2 - v.range ** 2))), y = v.range * ZONE_M;
      fillLine(zonePath, dashes(13, -reach * ZONE_M, reach * ZONE_M, x => [x, y, 0.001]));
      zoneWalker.position.set(now.x * ZONE_M, y, ZONEVIEW.lift + 0.002);
      zoneWalker.scale.set(ZONEVIEW.body[0] * ZONE_M, ZONEVIEW.body[1] * ZONE_M, 1);
      zoneWalker.visible = Math.abs(now.x) <= reach + ZONEVIEW.body[0];
      shade(zoneWalker.material, walkerColor, v.contrast > 0 ? 0.35 + 0.65 * Math.min(1, v.contrast / PAPIRS.contrast) : 0.12);
      zoneLamp.position.set(ZONEVIEW.box[0] / 2 + ZONEVIEW.lamp * 1.6, -ZONEVIEW.box[1] / 2, ZONEVIEW.lift);
      zoneLamp.material.color.setHex(now.sounding ? COLORS.alarm : COLORS.quiet);

      // The lens: each facet’s image of the body, and the elements it lands on.
      const gap = DECLARED.gap / 2, wide = PYRO.element.width;
      rect(elementPlus, -(gap + wide) * LENS_MM, -gap * LENS_MM, -LENSVIEW.depth / 2 * LENS_MM, LENSVIEW.depth / 2 * LENS_MM, LENSVIEW.lift);
      rect(elementMinus, gap * LENS_MM, (gap + wide) * LENS_MM, -LENSVIEW.depth / 2 * LENS_MM, LENSVIEW.depth / 2 * LENS_MM, LENSVIEW.lift);
      fillLine(planeLine, [[-LENSVIEW.plane / 2 * LENS_MM, 0, LENSVIEW.lift - 0.001], [LENSVIEW.plane / 2 * LENS_MM, 0, LENSVIEW.lift - 0.001]]);
      const cover = coverOf(now.x, v.range), facetAt = axis => [Math.sin(axis) * DECLARED.focal * LENS_MM, Math.cos(axis) * DECLARED.focal * LENS_MM];
      const facetSegments = [], raySegments = [], imageSegments = [];
      LENS.axes.forEach(axis => {
        const [fx, fy] = facetAt(axis), across = LENS.pitch * DECLARED.focal * LENSVIEW.facet / 2 * LENS_MM;
        const along = [Math.cos(axis), -Math.sin(axis)];
        facetSegments.push([fx - along[0] * across, fy - along[1] * across, LENSVIEW.lift], [fx + along[0] * across, fy + along[1] * across, LENSVIEW.lift]);
        for (let g = 0; g < LENSVIEW.grooves; g++) {
          const share = (g + 1) / (LENSVIEW.grooves + 1) * 2 - 1, gx = fx + along[0] * across * share, gy = fy + along[1] * across * share;
          facetSegments.push([gx, gy, LENSVIEW.lift], [gx - Math.sin(axis) * 0.05, gy - Math.cos(axis) * 0.05, LENSVIEW.lift]);
        }
        const lands = angle => -DECLARED.focal * Math.tan(angle - axis) * LENS_MM;
        const low = lands(cover.theta + cover.half), high = lands(cover.theta - cover.half), half = LENSVIEW.plane / 2 * LENS_MM;
        const inside = Math.min(high, half) - Math.max(low, -half);
        raySegments.push([fx, fy, LENSVIEW.lift - 0.002], [Math.max(-half, Math.min(half, lands(cover.theta))), 0, LENSVIEW.lift - 0.002]);
        if (inside > 0) imageSegments.push([Math.max(low, -half), 0, LENSVIEW.lift + 0.002], [Math.min(high, half), 0, LENSVIEW.lift + 0.002]);
      });
      fillLine(facetLines, facetSegments);
      fillLine(rays, raySegments);
      fillLine(images, imageSegments);
      const strongest = Math.max(z.stillPlus, ...z.chart.map(sample => Math.max(sample.plus, sample.minus)), 1e-12);
      shade(elementPlus.material, new THREE.Color(COLORS.plus), now.plus / strongest);
      shade(elementMinus.material, new THREE.Color(COLORS.minus), now.minus / strongest);

      // The two panels: the power on each element, and the difference.
      const powerTop = niceTop(Math.max(...z.chart.map(sample => Math.max(sample.plus, sample.minus))) * 1e9) * 1e-9;
      const outputTop = niceTop(Math.max(z.peak, z.single, DECLARED.threshold * 1.2) * 1e6) * 1e-6;
      fillLine(plusCurve, z.chart.map(sample => [zoneX(POWER, sample.t), powerY(sample.plus, powerTop), POWER.z]));
      fillLine(minusCurve, z.chart.map(sample => [zoneX(POWER, sample.t), powerY(sample.minus, powerTop), POWER.z]));
      fillLine(outputGuide, z.chart.map(sample => [zoneX(OUTPUT, sample.t), outputY(sample.output, outputTop), OUTPUT.z]));
      const shownSamples = clock > 0 ? z.chart.filter(sample => sample.t < now.t) : [];
      fillLine(outputCurve, clock > 0 ? [...shownSamples.map(sample => [zoneX(OUTPUT, sample.t), outputY(sample.output, outputTop), OUTPUT.z]), [zoneX(OUTPUT, now.t), outputY(now.output, outputTop), OUTPUT.z]] : []);
      fillLine(singleCurve, v.warming > 0 ? z.chart.map(sample => [zoneX(OUTPUT, sample.t), outputY(sample.single, outputTop), OUTPUT.z]) : []);
      singleWord.visible = v.warming > 0;
      fillLine(zeroLine, [[OUTPUT.x, outputY(0, outputTop), OUTPUT.z], [OUTPUT.x + OUTPUT.w, outputY(0, outputTop), OUTPUT.z]]);
      fillLine(thresholdLines, [DECLARED.threshold, -DECLARED.threshold].flatMap(level => [[OUTPUT.x, outputY(level, outputTop), OUTPUT.z], [OUTPUT.x + OUTPUT.w, outputY(level, outputTop), OUTPUT.z]]));
      const zx = zoneX(OUTPUT, now.t), zy = outputY(now.output, outputTop);
      fillLine(zoneCursor, [[zx - OUTPUT.cursor, zy, OUTPUT.z], [zx + OUTPUT.cursor, zy, OUTPUT.z], [zx, zy - OUTPUT.cursor, OUTPUT.z], [zx, zy + OUTPUT.cursor, OUTPUT.z]]);
      tops = {power: powerTop, output: outputTop, strongest};
    }

    // Readings: only the method chosen.
    const micro = volts => `${signed(volts * 1e6, 1)} μV`, nano = watts => `${signed(watts * 1e9, 2)} nW`;
    if (beamMode) {
      const status = clock <= 0
        ? b.still
          ? `Ready · the walker is already standing in the beam, so the receiver finds it blocked; press Play`
          : `Ready · the beam arrives ${fixed(b.margin, 0)} times stronger than the receiver needs; press Play to send the walker across`
        : now.alarm
          ? `Alarm · the beam stayed blocked for the ${fixed(v.hold, 0)} ms this setting waits out`
          : now.blocked
            ? `Blocked · ${fixed(now.missed, 0)} flashes missed of the ${fixed(b.pulses, 0)} it takes`
            : now.done
              ? `No alarm · the body covered the beam for ${fixed(b.blockedFor * 1000, 0)} ms, short of the ${fixed(v.hold, 0)} ms this setting waits out`
              : `Watching · the walker is ${fixed(Math.abs(now.x), 2)} m from the beam`;
      return {
        state: {...plan, now, clock, tops, mode: plan.mode},
        readings: [
          r('Your result', status),
          r('Beam', `${fixed(b.margin, 0)} times the threshold`, `Optex rates the ${OPTEX.model} for ${fixed(OPTEX.range, 0)} m, and gives ${fixed(OPTEX.arrival, 0)} m as the farthest its beam still arrives. Taking that as where the beam falls to what the receiver needs, and its power as falling with the square of the distance, ${fixed(v.span, 0)} m apart the beam arrives ${fixed(b.margin, 0)} times stronger than the threshold.`),
          r('Covered', b.still ? 'the whole watch' : `${fixed(b.blockedFor * 1000, 0)} ms`, b.still ? `A body standing on the line covers it for as long as it stands there, and a barrier sounds at a body that does not move.` : `A body ${fixed(b.depth * 1000, 0)} mm deep across its path, Panasonic’s test target, covers the line for ${fixed(b.depth * 1000, 0)} mm at ${fixed(v.speed, 1)} m/s, which is ${fixed(b.blockedFor * 1000, 0)} ms. The beam is taken as a line between the two lenses.`),
          r('Setting', `${fixed(v.hold, 0)} ms`, `Optex’s receiver waits out ${OPTEX.holds.map(ms => fixed(ms, 0)).join(', ')} ms, its four settings for ${OPTEX.names.map(name => name.toLowerCase()).join(', ')}. This one lets a walker through at any speed above ${fixed(b.fastest, 1)} m/s, and ignores anything shorter, like a bird or a leaf.`),
          r('Receiver now', now.blocked ? 'nothing arrives' : `${fixed(b.margin, 0)} times the threshold`, `The receiver is a ${RECEIVER.model} photodiode, which gives ${fixed(RECEIVER.current * 1e6, 0)} μA at 1 mW/cm² of ${fixed(RECEIVER.wavelength, 0)} nm light and carries a daylight blocking filter. Flashed at ${fixed(EMITTER.pulsed.current, 0)} A, a bare ${EMITTER.model} would light it at ${fixed(b.bareCurrent * 1e9, 1)} nA over ${fixed(v.span, 0)} m, ${fixed(b.bareCurrent / RECEIVER.dark, 0)} times its dark current: a real barrier puts a lens in front of each.`),
          r('Flashes', `${fixed(DECLARED.rate, 0)} a second`, `The transmitter flashes rather than shining steadily: the ${EMITTER.model} gives ${fixed(EMITTER.pulsed.intensity * 1000, 0)} mW/sr in ${fixed(EMITTER.pulsed.width * 1e6, 0)} μs flashes of ${fixed(EMITTER.pulsed.current, 0)} A against ${fixed(EMITTER.steady.intensity * 1000, 0)} mW/sr at a steady ${fixed(EMITTER.steady.current * 1000, 0)} mA, ${fixed(b.boost, 1)} times as much. The receiver answers only to flashes at its own rate, so steady sunlight passes unnoticed, and Optex gives its beams ${fixed(OPTEX.channels, 0)} of these rates so that two barriers do not answer each other. The rate is not from a source.`),
          r('Sounder', now.sounding ? 'sounding' : now.alarm ? 'alarm sent' : 'quiet', `Optex’s receiver holds its alarm output for ${fixed(OPTEX.alarm, 0)} s.`),
          r('Drawn', `${fixed(timesSmaller(BEAM_M), 0)} times smaller`, `The posts and the beam are drawn ${fixed(timesSmaller(BEAM_M), 0)} times smaller than true size and the crossing ${fixed(timesSmaller(CROSS_M), 0)} times smaller, with the posts as markers. The clock runs in real time, ${fixed(DECLARED.beamWatch, 0)} s of it.`),
        ],
      };
    }
    const overs = z.overs.length, reach = z.farthest;
    const status = clock <= 0
      ? z.still
        ? `Ready · the walker is standing in a + zone; press Play`
        : `Ready · press Play to send the walker across the zones`
      : z.still
        ? `Still · the + element takes ${nano(z.stillPlus)} more than the − element, and has all along, so the output holds at ${micro(now.output)}`
        : now.alarm
          ? `Alarm · the output reached ${micro(DECLARED.threshold)} at ${fixed(z.alarmAt, 2)} s`
          : now.done
            ? `No alarm · the output peaked at ${micro(z.peak)}, short of the ${micro(DECLARED.threshold)} it takes`
            : `Watching · the output is ${micro(now.output)} of the ${micro(DECLARED.threshold)} it takes`;
    return {
      state: {...plan, now, clock, tops, mode: plan.mode},
      readings: [
        r('Your result', status),
        r('Output', `${micro(z.peak)} at most`, `The elements give ${fixed(PYRO.responsivity.typical, 0)} V/W at ${fixed(PYRO.responsivity.at, 0)} Hz on the ${PYRO.model}'s sheet, and only while the power on them changes: a thermal lag of ${fixed(DECLARED.thermal, 1)} s and an electrical leak of ${fixed(DECLARED.electrical, 1)} s, neither from a source, leave them deaf to a steady view and to a body that crosses too fast. The threshold is ${micro(DECLARED.threshold)}, the largest noise that sheet allows, and the output crossed it ${fixed(overs, 0)} times in this watch.`),
        r('Body', `${fixed(z.band, 1)} W/m² more`, `Stefan and Boltzmann give εσT⁴: skin at an emissivity of ${fixed(DECLARED.emissivity, 2)}, inside the Emissivity page’s ${fixed(SKIN[0], 2)} to ${fixed(SKIN[1], 3)}, sends ${fixed(z.total, 1)} W/m² more than the room’s walls at ${fixed(v.contrast, 1)} °C colder, and ${fixed(z.band, 1)} W/m² of that, ${fixed(100 * z.band / Math.max(z.total, 1e-12), 0)}%, is longer than the ${fixed(MURATA.filter * 1e6, 0)} μm the ${MURATA.model}'s filter passes. Wien’s law puts the body’s peak at ${fixed(z.peaks[0] * 1e6, 2)} μm and the room’s at ${fixed(z.peaks[1] * 1e6, 2)} μm, around the ${fixed(10, 0)} μm the Infrared page gives for a body.`),
        r('Zones', `${fixed(z.zoneWidth, 2)} m wide`, `Each element is ${fixed(PYRO.element.width, 0)} mm wide and ${fixed(PYRO.element.height, 0)} mm tall, ${fixed(DECLARED.gap, 0)} mm from the other, ${fixed(DECLARED.focal, 1)} mm behind a facet: that turns into a zone ${fixed(LENS.across * 180 / Math.PI, 2)}° wide and ${fixed(LENS.elevation * 180 / Math.PI, 2)}° tall, which at ${fixed(v.range, 1)} m is ${fixed(z.zoneWidth, 2)} m across. The ${fixed(DECLARED.facets, 0)} facets put ${fixed(2 * DECLARED.facets, 0)} zones inside ${fixed(2 * LENS.edge * 180 / Math.PI, 0)}°, the next + zone ${fixed(z.pitchAt, 2)} m along the path. Panasonic packs ${fixed(PAPIRS.zones, 0)} zones into a lens ${fixed(PAPIRS.lens, 1)} mm across.`),
        r('Elements now', `+ ${nano(now.plus)}, − ${nano(now.minus)}`, `What the body puts on each element through the facets, whose collecting area of ${fixed(AREA * 1e6, 3)} mm² is the one number here fitted rather than read from a sheet. The two are wired against each other, so what leaves the pair is the difference, ${nano(now.plus - now.minus)} now, and even that moves the output only while it changes.`),
        r('Crossing', z.crossing === null ? 'standing still' : `${fixed(z.crossing, 2)} Hz`, z.crossing === null ? `A body that does not move changes nothing on the elements, so they give nothing: the detector answers to change alone.` : `At ${fixed(v.speed, 1)} m/s the walker reaches the next + zone every ${fixed(z.pitchAt / v.speed, 2)} s, so the power on each element swings at ${fixed(z.crossing, 2)} Hz, where the model’s elements give ${fixed(z.responsivity, 0)} V/W against ${fixed(PYRO.responsivity.typical, 0)} V/W at ${fixed(PYRO.responsivity.at, 0)} Hz. Panasonic specifies its analog sensors between ${fixed(PAPIRS.analog[0], 1)} and ${fixed(PAPIRS.analog[1], 1)} m/s.`),
        r('Warming', v.warming > 0 ? `${micro(z.single)} alone, ${micro(z.peak)} as a pair` : 'nothing warming', v.warming > 0 ? `Everything in view warming at ${fixed(v.warming, 0)} °C a minute raises the power on both elements together. One element alone would read ${micro(z.single)} of it; wired against each other and matched to ${fixed(PYRO.match.typical * 100, 0)}%, the pair gives ${micro(z.peak)}.` : `With nothing warming, the pair has only the walker to answer to.`),
        r('Reaches', reach === null ? 'no path this walk trips' : `${fixed(reach, 1)} m`, `The facets’ collecting area is chosen so Panasonic’s target, ${fixed(PAPIRS.target.height * 1000, 0)} by ${fixed(PAPIRS.target.width * 1000, 0)} mm and ${fixed(PAPIRS.contrast, 0)} °C over the room, just reaches the threshold at the ${fixed(PAPIRS.distance, 0)} m its sheet specifies at ${fixed(PAPIRS.speed, 1)} m/s. ${reach === null ? 'This walk never reaches it inside the 10 m the path can be set to.' : `This walk reaches it out to ${fixed(reach, 1)} m.`}`),
        r('Drawn', `${fixed(timesSmaller(ZONE_M), 0)} times smaller`, `The zones are drawn ${fixed(timesSmaller(ZONE_M), 0)} times smaller than true size and the lens and elements ${fixed(timesLarger(LENS_MM), 0)} times larger, with the detector’s case as a marker. The clock runs in real time, ${fixed(DECLARED.zoneWatch, 0)} s of it.`),
      ],
    };
  });

  const render = result.update;
  const watchOf = () => result.getState().watch;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(watchOf(), clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = (values, time) => { render(values); clock = Math.min(watchOf(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the walker at the beam', part: 'crossing', view: 'front', replay: false, run() { return inspect({mode: 0}, DECLARED.beamWatch / 2); }},
    {label: 'Inspect: the beam from above', part: 'beam', view: 'front', replay: false, run() { return inspect({mode: 0}, clock); }},
    {label: 'Inspect: the lens and its elements', part: 'lens', view: 'front', replay: false, run() { return inspect({mode: 1}, intruderPlan({...result.getState().values, mode: 1}).zones.peakAt); }},
    {label: 'Inspect: the zones from above', part: 'zones', view: 'front', replay: false, run() { return inspect({mode: 1}, clock); }},
  ];
  result.playback = {
    label: 'Watch',
    description: `One walker crosses in real time: ${fixed(DECLARED.beamWatch, 0)} s of it for the beam and ${fixed(DECLARED.zoneWatch, 0)} s for the zones.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= watchOf(),
    blocked: () => false,
  };
  result.resultPart = {id: 'signal', label: 'Inspect what the alarm saw', view: 'front', focusOnComplete: false, available: () => clock >= watchOf()};

  kit.root.rotation.set(0, 0, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {
    system, beam, groundLine, transmitter, receiver, beamNear, beamFar, beamPath, beamWalker, beamLamp,
    crossing, crossNear, crossFar, crossPath, crossBody, crossDepth, crossAhead,
    zones, wedges, detectorCase, zonePath, zoneWalker, zoneLamp,
    lens, planeLine, elementPlus, elementMinus, facetLines, rays, images,
    signal, beamPanel, zonePanel, beamFrame, beamGrid, beamThreshold, beamTicks, beamCurve, beamHold, beamOutput, beamCursor, stripFrame, flashes,
    powerFrame, outputFrame, zoneTicks, zeroLine, thresholdLines, plusCurve, minusCurve, outputGuide, outputCurve, singleCurve, zoneCursor,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

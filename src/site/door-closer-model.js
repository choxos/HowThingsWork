import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {
  doorPlan, doorAt, pistonArea,
  CLOSER, ORIFICES, ANGLES, CLOCK, LATCH_FORCE, RADIAN,
  DOOR_OPTIONS, SIZE_OPTIONS, CHECK_OPTIONS, DOOR_DEFAULTS, DOOR_DOMAINS,
} from './door-closer-physics.js';

// ---------------------------------------------------------------------------
// A door closer: the door in plan, the closer cut open, its three orifices, and
// the angle the door stands at through one whole swing.
//
// Three scales, each stated in the part the reader is looking at:
//   The door and its frame, in plan, at 1 scene unit to 1,000 mm, so every leaf
//   in BS EN 1154's table is drawn at its tabulated width.
//   The closer, cut open, 6 times larger than that, 1 unit to 166.7 mm. Its
//   enclosure uses reference dimensions of 245 mm by 60 mm. The piston,
//   pinion and travel share that scale; the assembly is a declared schematic.
//   The three orifices, drawn to 1 unit to 2 mm, which is 500 times the door,
//   because a sweep orifice a third of a millimeter across would otherwise be
//   a fifth of the width of a line.
//
// Time follows the declared model in seconds; it is not a hardware calibration.
//
// Arrows: orange is the hand's push, steel is the moment the closer returns.
// They share one scale, 200 N.m to half a scene unit.
// ---------------------------------------------------------------------------

/** Scene units per millimeter, for the plan, the cut open closer, and the orifices. */
export const PLAN = 0.001;
export const BODY = 0.006;
export const HOLE = 0.5;

/** How many times larger than the plan a scale draws. */
export const timesLarger = per => per / PLAN;

export const FRAME = Object.freeze({origin: Object.freeze([-1.05, -0.15, 0]), wall: 0.36, thick: 0.05, leaf: 44, arc: 0.1, ticks: Object.freeze([0, 30, 60, 90, 120])});
export const CLOSERVIEW = Object.freeze({origin: Object.freeze([2.2, 0.78, 0]), length: 245, height: 60, wall: 5, rack: 14, rackLength: 130, teeth: 31, pinionTeeth: 18, coils: 9, spare: 64});
export const VALVES = Object.freeze({origin: Object.freeze([2.2, -0.62, 0]), gap: 0.55, wide: 1.1, fan: 40, bar: Object.freeze([0.18, 0.4]), floor: 10});
export const CHART = Object.freeze({x: -1.95, y: -1.32, w: 1.95, h: 0.78, z: 0, tick: 0.03, cursor: 0.025, samples: 160});
export const ARROW = Object.freeze({per: 0.5 / 200, thickness: 0.016, lift: 0.02});
export const COLORS = Object.freeze({
  wall: 0xc9cdbf, jamb: 0x9aa39a, leafFace: 0xae8056, leafEdge: 0x6f5137, hinge: 0x8f989b, arc: 0x9aa39a,
  sweepBand: 0xd9d2c3, checkBand: 0xe3b45e, latchBand: 0xd99a2b, strike: 0xb4c5b0, bolt: 0xe3b45e, home: 0x91aa7e, ajar: 0xc14f39,
  body: 0x8f989b, oil: 0xcf9a4b, piston: 0xb4c5b0, spring: 0x83b4c1, pinion: 0xe3b45e, rack: 0xb4c5b0, ink: 0x374736, faint: 0x9aa39a,
  hole: 0x2f3336, holeFace: 0xe4e0d4, live: 0xd99a2b, chart: 0x374736, angle: 0x2b5d9c, pressure: 0x9aa39a, effort: 0xd99a2b, delivered: 0x8f989b,
});

/** Where a time and an angle in degrees fall on the trace. */
export const traceX = (plan, t) => CHART.x + Math.max(0, Math.min(1, plan.duration > 0 ? t / plan.duration : 0)) * CHART.w;
export const traceY = degrees => CHART.y + Math.max(0, Math.min(1, degrees / ANGLES.stop)) * CHART.h;
/** And where a pressure in bar falls, on an axis scaled so this swing's own highest pressure reaches the top of the frame. */
export const pressureY = (bar, top) => CHART.y + Math.max(0, Math.min(1, bar / Math.max(VALVES.floor, top))) * CHART.h;
/** The pressure the axis is scaled to, bar, never below VALVES.floor so a still door does not get a magnified axis. */
export const pressureTop = plan => Math.max(VALVES.floor, plan.peakPressure / 1e5);

/** The leading corners of a leaf `width` mm long and `FRAME.leaf` mm thick, in plan, at a door angle in radians. */
export function leafCorners(width, theta) {
  const along = [Math.cos(theta), Math.sin(theta)], across = [-Math.sin(theta), Math.cos(theta)];
  const w = width * PLAN, t = FRAME.leaf * PLAN;
  return [0, 1].flatMap(side => [0, 1].map(end => [
    along[0] * w * end + across[0] * t * (side - 0.5),
    along[1] * w * end + across[1] * t * (side - 0.5),
  ]));
}

/** An arc of `count` points from `from` to `to` degrees at a radius in scene units. */
export const arcPoints = (from, to, radius, count, z = 0) =>
  Array.from({length: count}, (_, i) => {
    const a = (from + (to - from) * i / (count - 1)) * RADIAN;
    return [radius * Math.cos(a), radius * Math.sin(a), z];
  });

export function createDoorCloserModel() {
  const kit = houseModel('Door closer'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownLeaf = '', shownHoles = '', shownTrace = '';
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const box = (line, x0, y0, w, h, z = 0) => fillLine(line, [[x0, y0, z], [x0 + w, y0, z], [x0 + w, y0 + h, z], [x0, y0 + h, z], [x0, y0, z]]);

  const system = part('system', 'Door closer, cut open', `Follow one swing through the door plan, enlarged spring and piston, selected oil passage and angle trace. The cutaway is ${fixed(timesLarger(BODY), 0)} times the door scale; its three restrictive orifices are shown separately at ${fixed(timesLarger(HOLE), 0)} times the door scale. A direct shaft stands in for the arm linkage of an overhead closer. The cutaway views that shaft from the opposite end.`);

  // The frame, the swing arc and its zones.
  const frame = part('frame', 'Frame, hinge and swing', `The wall, the jamb and the hinge the leaf turns about, with the arc it sweeps. The gold band past ${ANGLES.backcheck}° is where the back check answers; the band under ${ANGLES.latch}° is where the latch valve takes over from the sweep valve, and the darker wedge under ${ANGLES.engage}° is where the bolt meets its strike. The stop is at ${ANGLES.stop}°.`, FRAME.origin, system);
  const wallLeft = flat(COLORS.wall, frame), wallRight = flat(COLORS.wall, frame), jamb = flat(COLORS.jamb, frame);
  const hinge = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), unlit(COLORS.hinge));
  frame.add(hinge);
  const sweepBand = lineObject(FRAME.ticks.length * 24, COLORS.sweepBand, frame);
  const checkBand = lineObject(24, COLORS.checkBand, frame);
  const latchBand = lineObject(18, COLORS.latchBand, frame);
  const engageBand = lineObject(12, COLORS.ajar, frame);
  const stopMark = segmentLines(2, COLORS.ink, frame);
  const arcTicks = segmentLines(FRAME.ticks.length, COLORS.faint, frame);

  // The leaf.
  const door = part('door', 'Door leaf, in plan', `The leaf turns about its hinge. Door presets pair widths and test masses from the dhf guide; those masses are not maximum service ratings. Orange shows hand torque and gray shows spring torque on the same scale.`, FRAME.origin, system);
  const leafGroup = new THREE.Group();
  door.add(leafGroup);
  const leaf = flat(COLORS.leafFace, leafGroup);
  const leafOutline = lineObject(5, COLORS.leafEdge, leafGroup);
  const effort = solidArrow(kit, COLORS.effort, door, ARROW.thickness);
  const delivered = solidArrow(kit, COLORS.delivered, door, ARROW.thickness);

  // The latch.
  const latch = part('latch', 'Latch bolt and strike', `The bolt at the leading edge and the strike in the far jamb. Over the last ${ANGLES.engage}° the bolt has to be pushed back against its own spring, which takes ${LATCH_FORCE} N at the leading edge however wide the leaf is. Spring work and arrival kinetic energy together must overcome this resistance; otherwise the door stops short.`, FRAME.origin, system);
  const strike = flat(COLORS.strike, latch), bolt = flat(COLORS.bolt, latch);
  const latchMark = lineObject(5, COLORS.ink, latch);

  // The closer, cut open.
  const closer = part('closer', 'Closer, cut open', `Opening turns a fixed pinion, translates a rigid rack and piston, and compresses the spring. Closing reverses that motion. This schematic combines a ${CLOSERVIEW.length} by ${CLOSERVIEW.height} mm enclosure and ${fixed(CLOSER.bore * 1000, 1)} mm bore as reference dimensions; it is not a cutaway or calibration of either cited product.`, CLOSERVIEW.origin, system);
  const bodyPart = part('body', 'Body and oil chambers', 'The piston divides two oil chambers. During opening the left spring chamber shrinks; during closing the right chamber shrinks. Oil returns through the selected passage below.', [0, 0, 0], closer);
  const pistonPart = part('piston', 'Hydraulic piston', 'The piston moves with the rack. Its displacement transfers an equal volume between the ideal chambers through the selected oil passage.', [0, 0, 0], closer);
  const rackPart = part('rack', 'Rigid rack', 'The rack keeps its length and tooth spacing as it translates. Its motion is the pinion pitch radius times shaft angle.', [0, 0, 0], closer);
  const pinionPart = part('pinion', 'Fixed shaft and pinion', 'The shaft center stays fixed in the body. Clockwise rotation pulls the rack left and compresses the spring; the returning spring turns it back.', [0, 0, 0], closer);
  const springPart = part('spring', 'Preloaded compression spring', 'Opening shortens this spring and increases its stored energy. It stays preloaded when the door is shut; reported energy is the additional energy above that closed position.', [0, 0, 0], closer);
  const shell = flat(COLORS.body, bodyPart), chamberBack = flat(COLORS.oil, bodyPart), chamberFront = flat(COLORS.oil, bodyPart);
  const shellOutline = lineObject(5, COLORS.ink, bodyPart);
  const piston = flat(COLORS.piston, pistonPart), rack = flat(COLORS.rack, rackPart);
  const rackTeeth = segmentLines(CLOSERVIEW.teeth, COLORS.ink, rackPart);
  const pinion = new THREE.Mesh(new THREE.CircleGeometry(CLOSER.pinion * 1000 * BODY, 32), unlit(COLORS.pinion));
  pinionPart.add(pinion);
  const pinionMark = segmentLines(1, COLORS.ink, pinionPart);
  const pinionTeeth = lineObject(CLOSERVIEW.pinionTeeth * 4 + 1, COLORS.ink, pinionPart);
  const spring = lineObject(CLOSERVIEW.coils * 2 + 2, COLORS.spring, springPart);

  // The three orifices.
  const valves = part('valves', 'Oil paths and valves', `Follow oil from one chamber to the other through the highlighted path. Sweep governs closing above ${ANGLES.latch}°, latch governs the final ${ANGLES.latch}°, and back check resists opening beyond ${ANGLES.backcheck}°. The opening bypass is shown as a valve symbol. Port switching is schematic; unselected paths are shut.`, VALVES.origin, system);
  const valveNames = ['Sweep', 'Latch', 'Back check', 'Bypass'];
  const valveParts = ['sweep-valve', 'latch-valve', 'backcheck-valve', 'bypass'].map((id, i) => part(id, valveNames[i] + ' passage', [
    'A smaller sweep orifice raises resistance during the main closing arc.',
    'This separate restriction controls closing below 12 degrees. It changes arrival speed without changing spring strength.',
    'During opening beyond 70 degrees, this restriction replaces the easy-flow bypass when back check is enabled. It does not replace a physical door stop.',
    'The one-way opening path offers little hydraulic resistance before back check begins. During closing it shuts and oil uses the sweep or latch path.',
  ][i], [0, 0, 0], valves));
  const holeFaces = [0, 1, 2].map(() => new THREE.Mesh(new THREE.CircleGeometry(1, VALVES.fan), unlit(COLORS.holeFace)));
  holeFaces.forEach((face, i) => valveParts[i].add(face));
  const holeRings = [0, 1, 2].map(i => lineObject(VALVES.fan + 1, COLORS.hole, valveParts[i]));
  const bypass = lineObject(4, COLORS.hole, valveParts[3]);
  const passages = valveParts.map(parent => segmentLines(2, COLORS.faint, parent));
  const gates = valveParts.map(parent => segmentLines(1, COLORS.ink, parent));
  const oilLoop = lineObject(10, COLORS.live, valves);
  const supplyPaths = segmentLines(8, COLORS.faint, valves);
  const flowArrow = solidArrow(kit, COLORS.live, valves, 0.018);
  const pressureBar = flat(COLORS.live, valves), pressureFrame = lineObject(5, COLORS.chart, valves);
  valveNames.forEach((name, i) => textLabel(valveParts[i], name, {height: 0.085, position: [(i - 1.5) * VALVES.gap, 0.37, 0.01]}));
  const phaseText = textLabel(closer, '', {height: 0.095, width: 2.4, position: [0, 0.48, 0.01]});
  textLabel(closer, 'Spring      Piston          Rack / pinion', {height: 0.075, width: 2.1, position: [0, -0.31, 0.01]});
  textLabel(valves, 'Selected oil path', {height: 0.095, position: [0, 0.63, 0.01]});
  const pressureText = textLabel(valves, '', {height: 0.085, width: 2.3, position: [0, -0.56, 0.01]});
  const shaftGuide = lineObject(4, COLORS.faint, system);
  fillLine(shaftGuide, [[FRAME.origin[0], FRAME.origin[1], -0.005], [FRAME.origin[0], 1.85, -0.005], [CLOSERVIEW.origin[0], 1.85, -0.005], [CLOSERVIEW.origin[0], CLOSERVIEW.origin[1] + 0.2, -0.005]]);
  textLabel(system, 'Opposite shaft end / enlarged cutaway', {height: 0.085, width: 2.5, position: [0.35, 1.95, 0.01]});

  // The trace.
  const trace = part('trace', 'The angle, through the swing', `How far open the door stands, from shut at the bottom to the ${ANGLES.stop}° stop at the top, faint for the whole swing and dark as far as the clock has run. Gray: the pressure across whichever orifice the oil is going through, on an axis scaled so this swing's own highest pressure reaches the top of the frame. A tick marks every second.`, [0, 0, 0], system);
  const traceFrame = lineObject(5, COLORS.chart, trace);
  const traceCheck = flat(COLORS.checkBand, trace, {transparent: true, opacity: 0.2}), traceLatch = flat(COLORS.latchBand, trace, {transparent: true, opacity: 0.25});
  const traceGuide = lineObject(CHART.samples, COLORS.faint, trace), traceCurve = lineObject(CHART.samples + 1, COLORS.angle, trace);
  const tracePressure = lineObject(CHART.samples + 1, COLORS.pressure, trace);
  const traceTicks = segmentLines(Math.ceil(CLOCK.limit + CLOCK.hold) + 1, COLORS.chart, trace), traceCursor = segmentLines(2, COLORS.chart, trace);
  // The chart's words: the swing's length under its right end changes with the settings.
  const TEXT = 0.065, css = color => `#${color.toString(16).padStart(6, '0')}`;
  const key = (parent, entries) => entries.forEach(([text, color], i) => textLabel(parent, text, {height: TEXT, align: 'left', color: css(color), position: [CHART.x + CHART.w + 0.04, CHART.y + CHART.h - 0.035 - 0.085 * i, 0.001]}));
  chartText(trace, (share, degrees) => [CHART.x + share * CHART.w, traceY(degrees), CHART.z], {
    title: 'The angle, through the swing', size: TEXT,
    x: {min: 0, max: 1, title: 'Seconds, a tick for each', ticks: [[0, '0']]},
    y: {min: 0, max: ANGLES.stop, ticks: [0, ANGLES.stop / 2, ANGLES.stop].map(degrees => [degrees, `${fixed(degrees, 0)}°`])},
  });
  const traceEnd = textLabel(trace, '', {height: TEXT, width: TEXT * 3.5, color: css(COLORS.chart), position: [CHART.x + CHART.w, CHART.y - 1.1 * TEXT, 0.001]});
  key(trace, [['Door angle', COLORS.angle], ['Oil pressure', COLORS.pressure], ['Back check', COLORS.checkBand], ['Latch zone', COLORS.latchBand]]);

  const d = DOOR_DEFAULTS;
  control('door', 'Door', ...DOOR_DOMAINS.door, d.door, '', 'The seven test doors of BS EN 1154 table 1, each with the leaf width and the mass the standard tabulates against a power size.', DOOR_OPTIONS);
  control('size', 'Spring strength', ...DOOR_DOMAINS.size, d.size, '', 'Seven declared spring levels. Level 3 supplies 23.5 N·m at shut and 47 N·m at 60 degrees. These levels are not certified closer power sizes.', SIZE_OPTIONS);
  control('sweep', 'Sweep valve', ...DOOR_DOMAINS.sweep, d.sweep, 'mm', 'How wide the main orifice is opened. It sets the speed over the whole close but the last few degrees.');
  control('latch', 'Latch valve', ...DOOR_DOMAINS.latch, d.latch, 'mm', `How wide the second orifice is opened. It takes over under ${ANGLES.latch}° and can be set faster than the sweep so the door reaches its latch with something left.`);
  control('backcheck', 'Back check', ...DOOR_DOMAINS.backcheck, d.backcheck, '', 'Extra hydraulic resistance during opening past 70 degrees. It can reduce impact but is not a door stop.', CHECK_OPTIONS);
  control('open', 'Target release angle', ...DOOR_DOMAINS.open, d.open, '°', 'The hand releases at this angle, or at the first turning point if the push cannot get that far. Momentum can carry the released door farther.');
  control('push', 'Push', ...DOOR_DOMAINS.push, d.push, 'N·m', 'The moment the hand puts on the door while it is opening it. Below the spring’s own moment the door does not move at all.');

  const result = finish(v => {
    if (shownTrace !== JSON.stringify(v)) { clock = 0; lastClock = 0; }
    const plan = doorPlan(v), now = doorAt(plan, clock), leafWidth = plan.leaf.width, W = leafWidth * PLAN;
    const radius = W + FRAME.arc;

    // The frame, the arc and its zones, which change only with the leaf.
    const leafKey = `${leafWidth}:${v.backcheck}`;
    if (shownLeaf !== leafKey) {
      shownLeaf = leafKey;
      rect(wallLeft, -FRAME.wall, 0, -FRAME.thick, 0, -0.004);
      rect(wallRight, W, W + FRAME.wall, -FRAME.thick, 0, -0.004);
      rect(jamb, -0.02, 0.02, -FRAME.thick, 0.02, -0.003);
      hinge.position.set(0, 0, 0.006);
      fillLine(sweepBand, arcPoints(ANGLES.latch, ANGLES.backcheck, radius, 40, -0.002));
      fillLine(checkBand, arcPoints(ANGLES.backcheck, ANGLES.stop, radius, 24, -0.002));
      checkBand.visible = v.backcheck === 1;
      fillLine(latchBand, arcPoints(ANGLES.engage, ANGLES.latch, radius, 18, -0.002));
      fillLine(engageBand, arcPoints(0, ANGLES.engage, radius, 12, -0.002));
      fillLine(stopMark, [[radius * Math.cos(ANGLES.stop * RADIAN), radius * Math.sin(ANGLES.stop * RADIAN), 0], [(radius + 0.09) * Math.cos(ANGLES.stop * RADIAN), (radius + 0.09) * Math.sin(ANGLES.stop * RADIAN), 0]]);
      fillLine(arcTicks, FRAME.ticks.flatMap(angle => {
        const a = angle * RADIAN;
        return [[(radius + 0.02) * Math.cos(a), (radius + 0.02) * Math.sin(a), 0], [(radius + 0.06) * Math.cos(a), (radius + 0.06) * Math.sin(a), 0]];
      }));
      rect(strike, W - 0.02, W + 0.045, -FRAME.thick, 0, -0.001);
      box(latchMark, W - 0.05, -FRAME.thick - 0.01, 0.12, FRAME.thick + 0.02, 0.005);
    }

    // The leaf, turned to the angle the trace gives.
    leafGroup.rotation.set(0, 0, now.theta);
    rect(leaf, 0, W, -FRAME.leaf * PLAN / 2, FRAME.leaf * PLAN / 2, 0.002);
    box(leafOutline, 0, -FRAME.leaf * PLAN / 2, W, FRAME.leaf * PLAN, 0.003);

    // The arrows at the leading edge, tangent to the swing, on one scale.
    const tangent = new THREE.Vector3(-Math.sin(now.theta), Math.cos(now.theta), 0);
    const tip = [(W + 0.02) * Math.cos(now.theta), (W + 0.02) * Math.sin(now.theta)];
    effort.position.set(tip[0], tip[1], ARROW.lift);
    effort.userData.setDirection(tangent);
    effort.userData.setLength(clock > 0 && now.pushing ? v.push * ARROW.per : 0);
    delivered.position.set(tip[0], tip[1], ARROW.lift);
    delivered.userData.setDirection(tangent.clone().negate());
    delivered.userData.setLength(clock > 0 ? now.moment * ARROW.per : 0);

    // The bolt: out while the door is open, home when it latches, red when it stalls short.
    const home = plan.latched && now.t >= plan.latchedAt;
    const stuck = plan.stalledAt !== null && now.t >= plan.stalledAt;
    const out = home ? 0.05 : 0.026;
    bolt.scale.set(out, 0.024, 1);
    bolt.position.set(Math.cos(now.theta) * (W + out / 2), Math.sin(now.theta) * (W + out / 2), 0.004);
    bolt.rotation.set(0, 0, now.theta);
    bolt.material.color.setHex(home ? COLORS.home : stuck ? COLORS.ajar : COLORS.bolt);
    latchMark.material.color.setHex(stuck ? COLORS.ajar : COLORS.ink);

    // The closer, cut open: the piston where the pinion has carried it.
    const L = CLOSERVIEW.length * BODY, H = CLOSERVIEW.height * BODY, wall = CLOSERVIEW.wall * BODY;
    const bore = CLOSER.bore * 1000 * BODY, travel = CLOSER.pinion * 1000 * BODY * now.theta;
    const left = -L / 2, right = L / 2, mid = 0;
    rect(shell, left, right, -H / 2, H / 2, -0.003);
    box(shellOutline, left, -H / 2, L, H, 0.004);
    const face = left + wall + CLOSERVIEW.spare * BODY - travel;
    rect(chamberBack, left + wall, face, -bore / 2, bore / 2, -0.002);
    rect(chamberFront, face + wall, right - wall, -bore / 2, bore / 2, -0.002);
    rect(piston, face, face + wall, -bore / 2, bore / 2, 0.001);
    rect(rack, face + wall, face + wall + CLOSERVIEW.rackLength * BODY, bore / 2 - CLOSERVIEW.rack * BODY, bore / 2, 0.002);
    const pitch = 2 * Math.PI * CLOSER.pinion * 1000 * BODY / CLOSERVIEW.pinionTeeth;
    fillLine(rackTeeth, Array.from({length: CLOSERVIEW.teeth}, (_, i) => {
      const x = face + wall + (i + 0.5) * pitch;
      return [[x, bore / 2 - CLOSERVIEW.rack * BODY, 0.003], [x, bore / 2, 0.003]];
    }).flat());
    pinion.position.set(0, bore / 2 + CLOSER.pinion * 1000 * BODY, 0.0025);
    fillLine(pinionMark, [[pinion.position.x, pinion.position.y, 0.004], [pinion.position.x + CLOSER.pinion * 1000 * BODY * Math.cos(-now.theta + Math.PI / 2), pinion.position.y + CLOSER.pinion * 1000 * BODY * Math.sin(-now.theta + Math.PI / 2), 0.004]]);
    fillLine(pinionTeeth, Array.from({length: CLOSERVIEW.pinionTeeth * 4 + 1}, (_, i) => {
      const angle = i / (CLOSERVIEW.pinionTeeth * 4) * Math.PI * 2 - now.theta;
      const radius = (CLOSER.pinion * 1000 + (i % 4 < 2 ? 1.4 : -1.4)) * BODY;
      return [pinion.position.x + radius * Math.cos(angle), pinion.position.y + radius * Math.sin(angle), 0.004];
    }));
    const coilFrom = left + wall, coilTo = face;
    fillLine(spring, Array.from({length: CLOSERVIEW.coils * 2 + 2}, (_, i) => {
      const share = i / (CLOSERVIEW.coils * 2 + 1);
      return [coilFrom + (coilTo - coilFrom) * share, (i % 2 ? 1 : -1) * bore * 0.36 * (i === 0 || i === CLOSERVIEW.coils * 2 + 1 ? 0 : 1), 0.002];
    }));
    const flowing = clock > 0 && Math.abs(now.omega) > 1e-5;
    phaseText.userData.setText(clock <= 0 ? 'Open, store energy, then release' : now.finished ? (plan.latched ? 'Latched: flow has stopped' : 'Stopped short: flow has stopped') : now.opening ? 'Opening: spring compresses' : 'Closing: spring expands');
    chamberBack.material.color.setHex(flowing && now.opening ? COLORS.live : COLORS.oil);
    chamberFront.material.color.setHex(flowing && !now.opening ? COLORS.live : COLORS.oil);

    // The three orifices, to one scale, the live one filled.
    const holes = [v.sweep, v.latch, ORIFICES.backcheck];
    const holeKey = `${v.sweep}:${v.latch}`;
    if (shownHoles !== holeKey) {
      shownHoles = holeKey;
      holes.forEach((diameter, i) => {
        const x = (i - 1.5) * VALVES.gap;
        holeFaces[i].position.set(x, 0.12, 0.001);
        holeFaces[i].scale.setScalar(diameter * HOLE / 2);
        fillLine(holeRings[i], arcPoints(0, 360, diameter * HOLE / 2, VALVES.fan + 1, 0.002).map(([px, py, pz]) => [px + x, py + 0.12, pz]));
      });
      const bx = 1.5 * VALVES.gap;
      fillLine(bypass, [[bx - 0.1, 0.22, 0.002], [bx + 0.1, 0.22, 0.002], [bx, 0.02, 0.002], [bx - 0.1, 0.22, 0.002]]);
      passages.forEach((line, i) => {
        const x = (i - 1.5) * VALVES.gap, radius = i < 3 ? holes[i] * HOLE / 2 : 0.1;
        fillLine(line, [[x, 0.58, 0], [x, 0.12 + radius, 0], [x, 0.12 - radius, 0], [x, -0.2, 0]]);
        fillLine(gates[i], [[x - 0.055, 0.5, 0.003], [x + 0.055, 0.5, 0.003]]);
      });
      box(pressureFrame, -VALVES.wide, VALVES.bar[0] - 0.62, 2 * VALVES.wide, VALVES.bar[1] - VALVES.bar[0], 0);
    }
    const liveIndex = flowing ? (now.opening ? (now.checking ? 2 : 3) : (now.latching ? 1 : 0)) : -1;
    holeFaces.forEach((mesh, i) => mesh.material.color.setHex(i === liveIndex ? COLORS.live : COLORS.holeFace));
    passages.forEach((line, i) => { line.material.color.setHex(i === liveIndex ? COLORS.live : COLORS.faint); gates[i].visible = i !== liveIndex; });
    bypass.material.color.setHex(liveIndex === 3 ? COLORS.live : COLORS.hole);
    const py = CLOSERVIEW.origin[1] - VALVES.origin[1] - 0.04;
    const portLeft = [left + wall + 0.02, py, 0], portRight = [right - wall - 0.02, py, 0];
    fillLine(supplyPaths, [portLeft, [-VALVES.wide, py, 0], [-VALVES.wide, py, 0], [-VALVES.wide, 0.58, 0], [-VALVES.wide, 0.58, 0], [1.5 * VALVES.gap, 0.58, 0], [-1.5 * VALVES.gap, -0.2, 0], [VALVES.wide, -0.2, 0], [VALVES.wide, -0.2, 0], [VALVES.wide, py, 0], [VALVES.wide, py, 0], portRight]);
    const routeX = (Math.max(0, liveIndex) - 1.5) * VALVES.gap;
    fillLine(oilLoop, flowing ? [portLeft, [-VALVES.wide, py, 0.002], [-VALVES.wide, 0.58, 0.002], [routeX, 0.58, 0.002], [routeX, -0.2, 0.002], [VALVES.wide, -0.2, 0.002], [VALVES.wide, py, 0.002], portRight] : []);
    flowArrow.position.set(-VALVES.wide, now.opening ? 0.95 : 0.75, 0.01);
    flowArrow.userData.setDirection(new THREE.Vector3(0, now.opening ? -1 : 1, 0));
    flowArrow.userData.setLength(flowing ? 0.15 : 0);
    const bar = now.pressure / 1e5, topBar = pressureTop(plan);
    rect(pressureBar, -VALVES.wide, -VALVES.wide + 2 * VALVES.wide * Math.min(1, bar / topBar), VALVES.bar[0] - 0.62, VALVES.bar[1] - 0.62, 0.001);
    pressureBar.visible = bar > 0.01;
    pressureText.userData.setText(`${fixed(bar, 1)} bar / ${liveIndex < 0 ? 'no flow' : valveNames[liveIndex].toLowerCase()}`);

    // The trace.
    const traceKey = JSON.stringify(v);
    if (shownTrace !== traceKey) {
      shownTrace = traceKey;
      box(traceFrame, CHART.x, CHART.y, CHART.w, CHART.h, CHART.z);
      rect(traceCheck, CHART.x, CHART.x + CHART.w, traceY(ANGLES.backcheck), traceY(ANGLES.stop), -0.002);
      traceCheck.visible = v.backcheck === 1;
      rect(traceLatch, CHART.x, CHART.x + CHART.w, traceY(0), traceY(ANGLES.latch), -0.002);
      fillLine(traceGuide, Array.from({length: CHART.samples}, (_, i) => {
        const t = plan.duration * i / (CHART.samples - 1), at = doorAt(plan, t);
        return [traceX(plan, t), traceY(at.degrees), CHART.z];
      }));
      const ticks = [];
      for (let t = 1; t < plan.duration; t += 1) ticks.push([traceX(plan, t), CHART.y, CHART.z], [traceX(plan, t), CHART.y - CHART.tick, CHART.z]);
      fillLine(traceTicks, ticks);
      traceEnd.userData.setText(fixed(plan.duration, 1));
    }
    const shown = [];
    const shownPressure = [];
    for (let i = 0; i < CHART.samples; i++) {
      const t = plan.duration * i / (CHART.samples - 1);
      if (t >= now.t) break;
      const at = doorAt(plan, t);
      shown.push([traceX(plan, t), traceY(at.degrees), CHART.z]);
      shownPressure.push([traceX(plan, t), pressureY(at.pressure / 1e5, topBar), CHART.z]);
    }
    fillLine(traceCurve, clock > 0 ? [...shown, [traceX(plan, now.t), traceY(now.degrees), CHART.z]] : []);
    fillLine(tracePressure, clock > 0 ? [...shownPressure, [traceX(plan, now.t), pressureY(bar, topBar), CHART.z]] : []);
    const cx = traceX(plan, now.t), cy = traceY(now.degrees);
    fillLine(traceCursor, [[cx - CHART.cursor, cy, CHART.z], [cx + CHART.cursor, cy, CHART.z], [cx, cy - CHART.cursor, CHART.z], [cx, cy + CHART.cursor, CHART.z]]);

    const degrees = value => `${fixed(value, 1)}°`;
    const ended = now.finished || now.done;
    const status = !plan.opens ? `Blocked at shut: ${fixed(v.push, 0)} N·m cannot overcome spring and static friction`
      : clock <= 0 ? 'Ready: push, release, then watch the return'
      : now.finished ? (plan.latched ? `Latched after ${fixed(plan.latchedAt, 2)} s` : `Stopped ${degrees(plan.ajar)} short of shut`)
      : now.done ? `Observation limit: still ${degrees(now.degrees)} open`
      : now.opening ? (now.pushing ? 'Opening under the hand’s push' : 'Coasting after release') : 'Closing under spring force';
    const releaseText = !plan.opens ? 'Push too weak to start' : plan.handOff === null || clock < plan.handOff ? 'Hand has not released yet'
      : `${degrees(plan.releaseAngle / RADIAN)}${plan.releaseReason === 'push-limit' ? ' / target not reached' : ' / target reached'}`;
    const spent = plan.oilHeat + plan.frictionHeat + plan.latchWork + plan.stopLoss + plan.arrivalEnergy + plan.residual + plan.kinetic;
    return {
      state: {...plan, now, clock, bar, liveIndex, leafWidth, radius},
      readings: [
        r('Your result', status),
        r('Swing progress', `${fixed(100 * clock / plan.duration, 1)}%`, `${fixed(clock, 2)} s elapsed. The clock runs in real time; the result is held briefly at the end.`),
        r('Door angle', degrees(now.degrees), 'Zero is shut. The stop is at 120 degrees; momentum may carry the door beyond its release angle.'),
        r('Angular speed', `${fixed(now.omega / RADIAN, 1)}°/s`, 'Positive opens the door; negative closes it. Zero means stationary.'),
        r('Oil path', liveIndex < 0 ? 'No flow' : valveNames[liveIndex], 'Only the highlighted passage carries oil. Opening and closing transfer oil in opposite directions between the two chambers.'),
        r('Oil pressure', `${fixed(bar, 1)} bar`, flowing ? `${fixed(pistonArea() * CLOSER.pinion * Math.abs(now.omega) * 1e6, 1)} cm³/s through a ${fixed(now.orifice, 2)} mm equivalent orifice. This is an ideal incompressible pressure difference, not a hardware pressure prediction.` : 'With no flow, the ideal orifice pressure drop is zero. Spring preload remains.'),
        r('Spring torque', `${fixed(now.moment, 1)} N·m`, `Declared spring level ${v.size}. Torque rises as the spring compresses; its closing-position value is ${fixed(plan.latchSpring, 1)} N·m.`),
        r('Stored spring energy', `${fixed(now.energy, 2)} J`, 'Additional energy above the preloaded, closed position. Opening also spends energy in friction and oil resistance.'),
        r('Hand release', releaseText, `Target: ${v.open}°. If the door turns back before reaching it, the hand releases at that first turning point. A stronger push can reach farther.`),
        r('Sweep time', plan.sweepTime === null ? 'No complete 90° to 12° sweep' : `${ended ? '' : 'Predicted: '}${fixed(plan.sweepTime, 2)} s`, 'This interval compares valve settings. Spring torque, hydraulic resistance, friction and inertia all enter the result; it does not certify an installed door.'),
        r('Latch result', !ended ? 'Pending' : plan.latched ? `Latched at ${fixed(plan.arrival / RADIAN, 1)}°/s` : !plan.opens ? 'Never opened' : plan.limited ? 'Observation ended while moving' : `Left ${degrees(plan.ajar)} open`, `The declared bolt load is ${fixed(plan.latchMoment, 1)} N·m plus hinge friction. Arrival energy can carry a door through a load that its spring alone cannot overcome.`),
        r('Energy balance', ended ? `${fixed(plan.handWork, 2)} J in / ${fixed(spent, 2)} J accounted for` : 'Available after the swing', ended ? `Oil ${fixed(plan.oilHeat, 2)} J; friction ${fixed(plan.frictionHeat, 2)} J; bolt ${fixed(plan.latchWork, 2)} J; stop ${fixed(plan.stopLoss, 2)} J; closing impact ${fixed(plan.arrivalEnergy, 2)} J; retained spring ${fixed(plan.residual, 2)} J; retained motion ${fixed(plan.kinetic, 2)} J.` : 'Compare hand work with heat, bolt work, impacts and remaining stored energy once the observation ends.'),
        r('Model limit', 'Ideal direct drive and incompressible oil', 'This supplementary house lesson is not a calibrated product, an EN power rating or a compliance test. Linkage geometry, oil compressibility, temperature effects, wind and real valve porting are omitted.'),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), Math.max(0, time)); return render(); };
  result.actions = [
    {label: 'Restart this swing', part: 'system', view: 'front', replay: false, run() { clock = 0; lastClock = 0; return render(); }},
    {label: 'Inspect: the closer, cut open', part: 'closer', view: 'front', replay: false, run() { const state = result.getState(); return inspect(state.handOff === null ? 0 : state.handOff / 2); }},
    {label: 'Inspect oil paths', part: 'valves', view: 'front', replay: false, run() { const state = result.getState(); return inspect(state.peakAt === null ? 0 : state.peakAt + (state.ended - state.peakAt) / 2); }},
    {label: 'Inspect: the latch', part: 'latch', view: 'front', replay: false, run() { return inspect(result.getState().duration); }},
    {label: 'Inspect: the angle trace', part: 'trace', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Open it and let go',
    description: 'The hand releases at the target angle or at the first turning point if the push is too weak. The spring then returns the door against hydraulic resistance.',
    stepLabel: 'Advance half a second',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'latch', context: 'system', label: 'Inspect the latch', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.52;
  result.overviewZoom = 0.7 / result.framePadding;
  // Keep edge views oblique so this flat teaching cutaway remains readable.
  result.viewDirections = {side: [2.7, 0.15, 2], top: [0, 2.7, 2], bottom: [0, -2.7, 2]};
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.followParts = ['door', 'latch', 'closer', 'piston', 'rack', 'spring'];
  result.catalogParts = result.parts.filter(part => part.id !== 'system');
  result.topology = {
    system, frame, wallLeft, wallRight, jamb, hinge, sweepBand, checkBand, latchBand, engageBand, stopMark, arcTicks,
    door, leafGroup, leaf, leafOutline, effort, delivered, latch, strike, bolt, latchMark,
    closer, shell, chamberBack, chamberFront, shellOutline, piston, rack, rackTeeth, pinion, pinionMark, pinionTeeth, spring, flowArrow, shaftGuide,
    valves, valveParts, holeFaces, holeRings, bypass, passages, gates, oilLoop, supplyPaths, pressureBar, pressureFrame,
    trace, traceFrame, traceCheck, traceLatch, traceGuide, traceCurve, tracePressure, traceTicks, traceCursor,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

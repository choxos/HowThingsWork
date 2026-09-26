import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {
  doorPlan, doorAt, springMoment, pistonArea,
  SIZE3, CLOSER, ORIFICES, ANGLES, GRADES, ADA, CLOCK, LATCH_FORCE, FRICTION, RADIAN,
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
//   body is dormakaba's TS 83 at 245 mm by 60 mm, and the piston, the pinion
//   and the piston's travel are all drawn at that one scale.
//   The three orifices, drawn to 1 unit to 2 mm, which is 500 times the door,
//   because a sweep orifice a third of a millimeter across would otherwise be
//   a fifth of the width of a line.
//
// Time runs at life: the swing takes as long here as it does on a door.
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
export const CLOSERVIEW = Object.freeze({origin: Object.freeze([2.1, 0.78, 0]), length: 245, height: 60, wall: 5, rack: 14, teeth: 9, coils: 9, spare: 34});
export const VALVES = Object.freeze({origin: Object.freeze([2.25, -0.62, 0]), gap: 0.62, wide: 0.85, fan: 40, bar: Object.freeze([0.18, 0.62]), floor: 10});
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
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const box = (line, x0, y0, w, h, z = 0) => fillLine(line, [[x0, y0, z], [x0 + w, y0, z], [x0 + w, y0 + h, z], [x0, y0 + h, z], [x0, y0, z]]);

  const system = part('system', 'Door closer, cut open', `A door in plan at 1 scene unit to ${fixed(1 / PLAN, 0)} mm, the closer cut open ${fixed(timesLarger(BODY), 0)} times larger, its three orifices ${fixed(timesLarger(HOLE), 0)} times larger, and the angle the door stands at through the whole swing. Press Play: the door is pushed open, let go, and closed by the spring against the oil.`);

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
  const door = part('door', 'Door leaf, in plan', `The leaf, drawn at the width BS EN 1154 tabulates for the door chosen, turning about its hinge. The orange arrow is the hand's push and the steel arrow the moment the closer returns; they share one scale, ${fixed(0.5 / ARROW.per, 0)} N·m to half a scene unit.`, FRAME.origin, system);
  const leafGroup = new THREE.Group();
  door.add(leafGroup);
  const leaf = flat(COLORS.leafFace, leafGroup);
  const leafOutline = lineObject(5, COLORS.leafEdge, leafGroup);
  const effort = solidArrow(kit, COLORS.effort, door, ARROW.thickness);
  const delivered = solidArrow(kit, COLORS.delivered, door, ARROW.thickness);

  // The latch.
  const latch = part('latch', 'Latch bolt and strike', `The bolt at the leading edge and the strike in the far jamb. Over the last ${ANGLES.engage}° the bolt has to be pushed back against its own spring, which takes ${LATCH_FORCE} N at the leading edge however wide the leaf is. A closer that cannot supply it leaves the door standing open.`, FRAME.origin, system);
  const strike = flat(COLORS.strike, latch), bolt = flat(COLORS.bolt, latch);
  const latchMark = lineObject(5, COLORS.ink, latch);

  // The closer, cut open.
  const closer = part('closer', 'Closer, cut open', `A rack and pinion closer drawn ${fixed(timesLarger(BODY), 0)} times larger: a body ${CLOSERVIEW.length} mm long and ${CLOSERVIEW.height} mm high, dormakaba’s TS 83 size, holding a piston of LCN’s ${fixed(CLOSER.bore * 1000, 1)} mm bore on a rack, a pinion of ${fixed(CLOSER.pinion * 2000, 0)} mm pitch diameter turned by the door, and the spring. Opening the door drives the piston along and compresses the spring; letting go, the spring drives the piston back and pushes the oil through an orifice.`, CLOSERVIEW.origin, system);
  const shell = flat(COLORS.body, closer), chamberBack = flat(COLORS.oil, closer), chamberFront = flat(COLORS.oil, closer);
  const shellOutline = lineObject(5, COLORS.ink, closer);
  const piston = flat(COLORS.piston, closer), rack = flat(COLORS.rack, closer);
  const rackTeeth = segmentLines(CLOSERVIEW.teeth * 2, COLORS.ink, closer);
  const pinion = new THREE.Mesh(new THREE.CircleGeometry(CLOSER.pinion * 1000 * BODY, 32), unlit(COLORS.pinion));
  closer.add(pinion);
  const pinionMark = segmentLines(2, COLORS.ink, closer);
  const spring = lineObject(CLOSERVIEW.coils * 2 + 2, COLORS.spring, closer);
  const flowArrow = solidArrow(kit, COLORS.live, closer, 0.012);

  // The three orifices.
  const valves = part('valves', 'The three orifices', `The holes the oil has to get through, drawn ${fixed(timesLarger(HOLE), 0)} times larger, so a third of a millimeter is a third of a scene unit. The sweep valve carries the door from wide open down to ${ANGLES.latch}°, the latch valve carries the last ${ANGLES.latch}°, and the back check only meets oil while the door is being opened past ${ANGLES.backcheck}°. The one passing oil now is filled, and the bar below is the pressure across it against the highest this swing reaches.`, VALVES.origin, system);
  const holeFaces = [0, 1, 2].map(() => new THREE.Mesh(new THREE.CircleGeometry(1, VALVES.fan), unlit(COLORS.holeFace)));
  for (const face of holeFaces) valves.add(face);
  const holeRings = [0, 1, 2].map(() => lineObject(VALVES.fan + 1, COLORS.hole, valves));
  const holeLabels = segmentLines(3, COLORS.faint, valves);
  const pressureBar = flat(COLORS.live, valves), pressureFrame = lineObject(5, COLORS.chart, valves);

  // The trace.
  const trace = part('trace', 'The angle, through the swing', `How far open the door stands, from shut at the bottom to the ${ANGLES.stop}° stop at the top, faint for the whole swing and dark as far as the clock has run. Gray: the pressure across whichever orifice the oil is going through, on an axis scaled so this swing's own highest pressure reaches the top of the frame. A tick marks every second.`, [0, 0, 0], system);
  const traceFrame = lineObject(5, COLORS.chart, trace);
  const traceCheck = flat(COLORS.checkBand, trace), traceLatch = flat(COLORS.latchBand, trace);
  const traceGuide = lineObject(CHART.samples, COLORS.faint, trace), traceCurve = lineObject(CHART.samples + 1, COLORS.angle, trace);
  const tracePressure = lineObject(CHART.samples + 1, COLORS.pressure, trace);
  const traceTicks = segmentLines(Math.ceil(CLOCK.limit) + 1, COLORS.chart, trace), traceCursor = segmentLines(2, COLORS.chart, trace);
  // The chart's words: the swing's length under its right end changes with the settings.
  const TEXT = 0.04, css = color => `#${color.toString(16).padStart(6, '0')}`;
  const key = (parent, entries) => entries.forEach(([text, color], i) => textLabel(parent, text, {height: TEXT, align: 'left', color: css(color), position: [CHART.x + CHART.w + 0.04, CHART.y + CHART.h - 0.035 - 0.05 * i, 0.001]}));
  chartText(trace, (share, degrees) => [CHART.x + share * CHART.w, traceY(degrees), CHART.z], {
    title: 'The angle, through the swing', size: TEXT,
    x: {min: 0, max: 1, title: 'Seconds, a tick for each', ticks: [[0, '0']]},
    y: {min: 0, max: ANGLES.stop, ticks: [0, ANGLES.stop / 2, ANGLES.stop].map(degrees => [degrees, `${fixed(degrees, 0)}°`])},
  });
  const traceEnd = textLabel(trace, '', {height: TEXT, width: TEXT * 3.5, color: css(COLORS.chart), position: [CHART.x + CHART.w, CHART.y - 1.1 * TEXT, 0.001]});
  key(trace, [['Door angle', COLORS.angle], ['Oil pressure', COLORS.pressure], ['Back check', COLORS.checkBand], ['Latch zone', COLORS.latchBand]]);

  const d = DOOR_DEFAULTS;
  control('door', 'Door', ...DOOR_DOMAINS.door, d.door, '', 'The seven test doors of BS EN 1154 table 1, each with the leaf width and the mass the standard tabulates against a power size.', DOOR_OPTIONS);
  control('size', 'Closer power size', ...DOOR_DOMAINS.size, d.size, '', 'How strong the spring is. A size 3 closer has a maximum opening moment of 47 N.m; every other size here is scaled from that in proportion to its tabulated test door mass.', SIZE_OPTIONS);
  control('sweep', 'Sweep valve', ...DOOR_DOMAINS.sweep, d.sweep, 'mm', 'How wide the main orifice is opened. It sets the speed over the whole close but the last few degrees.');
  control('latch', 'Latch valve', ...DOOR_DOMAINS.latch, d.latch, 'mm', `How wide the second orifice is opened. It takes over under ${ANGLES.latch}° and can be set faster than the sweep so the door reaches its latch with something left.`);
  control('backcheck', 'Back check', ...DOOR_DOMAINS.backcheck, d.backcheck, '', 'A third orifice that meets the oil only while the door is opened past 70 degrees, so a door flung open is caught before it reaches the wall.', CHECK_OPTIONS);
  control('open', 'Let go at', ...DOOR_DOMAINS.open, d.open, '°', 'The angle at which the hand stops pushing. A door with speed still in it carries on past this.');
  control('push', 'Push', ...DOOR_DOMAINS.push, d.push, 'N·m', 'The moment the hand puts on the door while it is opening it. Below the spring’s own moment the door does not move at all.');

  const result = finish(v => {
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
    effort.userData.setLength(now.pushing ? v.push * ARROW.per : 0);
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
    const face = left + wall + CLOSERVIEW.spare * BODY + travel;
    rect(chamberBack, left + wall, face, -bore / 2, bore / 2, -0.002);
    rect(chamberFront, face + wall, right - wall, -bore / 2, bore / 2, -0.002);
    rect(piston, face, face + wall, -bore / 2, bore / 2, 0.001);
    rect(rack, face + wall, right - wall, bore / 2 - CLOSERVIEW.rack * BODY, bore / 2, 0.002);
    fillLine(rackTeeth, Array.from({length: CLOSERVIEW.teeth}, (_, i) => {
      const x = face + wall + (i + 0.5) * (right - wall - face - wall) / CLOSERVIEW.teeth;
      return [[x, bore / 2 - CLOSERVIEW.rack * BODY, 0.003], [x, bore / 2, 0.003]];
    }).flat());
    pinion.position.set((face + wall + right - wall) / 2, bore / 2 + CLOSER.pinion * 1000 * BODY, 0.0025);
    fillLine(pinionMark, [[pinion.position.x, pinion.position.y, 0.004], [pinion.position.x + CLOSER.pinion * 1000 * BODY * Math.cos(-now.theta + Math.PI / 2), pinion.position.y + CLOSER.pinion * 1000 * BODY * Math.sin(-now.theta + Math.PI / 2), 0.004]]);
    const coilFrom = left + wall, coilTo = face;
    fillLine(spring, Array.from({length: CLOSERVIEW.coils * 2 + 2}, (_, i) => {
      const share = i / (CLOSERVIEW.coils * 2 + 1);
      return [coilFrom + (coilTo - coilFrom) * share, (i % 2 ? 1 : -1) * bore * 0.36 * (i === 0 || i === CLOSERVIEW.coils * 2 + 1 ? 0 : 1), 0.002];
    }));
    const flowing = clock > 0 && Math.abs(now.omega) > 1e-3;
    flowArrow.position.set(face - 0.02, -bore / 2 - 0.05, 0.004);
    flowArrow.userData.setDirection(new THREE.Vector3(now.omega > 0 ? 1 : -1, 0, 0));
    flowArrow.userData.setLength(flowing ? 0.12 : 0);

    // The three orifices, to one scale, the live one filled.
    const holes = [v.sweep, v.latch, ORIFICES.backcheck];
    const holeKey = `${v.sweep}:${v.latch}`;
    if (shownHoles !== holeKey) {
      shownHoles = holeKey;
      holes.forEach((diameter, i) => {
        const x = (i - 1) * VALVES.gap;
        holeFaces[i].position.set(x, 0.12, 0.001);
        holeFaces[i].scale.setScalar(diameter * HOLE / 2);
        fillLine(holeRings[i], arcPoints(0, 360, diameter * HOLE / 2, VALVES.fan + 1, 0.002).map(([px, py, pz]) => [px + x, py + 0.12, pz]));
      });
      fillLine(holeLabels, holes.flatMap((_, i) => { const x = (i - 1) * VALVES.gap; return [[x - 0.16, -0.2, 0], [x + 0.16, -0.2, 0]]; }));
      box(pressureFrame, -VALVES.wide, VALVES.bar[0] - 0.62, 2 * VALVES.wide, VALVES.bar[1] - VALVES.bar[0], 0);
    }
    const liveIndex = now.opening ? (now.checking ? 2 : -1) : (now.latching ? 1 : 0);
    holeFaces.forEach((mesh, i) => mesh.material.color.setHex(i === liveIndex && clock > 0 ? COLORS.live : COLORS.holeFace));
    const bar = now.pressure / 1e5, topBar = pressureTop(plan);
    rect(pressureBar, -VALVES.wide, -VALVES.wide + 2 * VALVES.wide * Math.min(1, bar / topBar), VALVES.bar[0] - 0.62, VALVES.bar[1] - 0.62, 0.001);
    pressureBar.visible = bar > 0.01;

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

    // Readings.
    const degrees = value => `${fixed(value, 1)}°`;
    const status = !plan.opens ? `The door does not move · ${fixed(v.push, 0)} N·m will not beat the spring's ${fixed(plan.latchSpring, 1)} N·m at the shut position`
      : clock <= 0 ? 'Ready · press Play to push it open and let go'
      : now.opening ? (now.pushing ? `Opening · ${degrees(now.degrees)}, pushed` : `Coasting open · ${degrees(now.degrees)}${now.checking ? ', the back check has it' : ''}`)
      : !now.finished ? `Closing · ${degrees(now.degrees)} at ${fixed(now.speed, 1)}°/s${now.latching ? ', on the latch valve' : ''}`
      : plan.latched ? `Latched · shut in ${fixed(plan.latchedAt, 1)} s, arriving at ${fixed(plan.arrival / RADIAN, 1)}°/s`
      : `Left ajar · stopped ${degrees(plan.ajar)} short, with the spring ${fixed(plan.latchMoment + FRICTION.hinge - springMoment(v.size, plan.stalledAngle), 1)} N·m under what the bolt asks`;
    const sweepText = plan.sweepTime === null
      ? `The door never reached ${ANGLES.from}°, so there is nothing to time.`
      : `${fixed(plan.sweepTime, 2)} s from ${ANGLES.from}° to ${ANGLES.to}° from the latch, against the ${ADA.seconds} s LCN's guide gives as the least an accessible door may take. The sweep valve alone sets it: the oil's resistance grows as the square of the speed, so the door settles where the spring and the orifice balance and the door's own mass hardly enters.`;
    return {
      state: {...plan, now, clock, bar, liveIndex, leafWidth, radius},
      readings: [
        r('Your result', status),
        r('Closing moment', `${fixed(plan.latchSpring, 1)} N·m at the latch`, `A size ${v.size} closer. Its moment runs from ${fixed(plan.latchSpring, 1)} N·m shut to ${fixed(plan.openingMoment, 1)} N·m at ${SIZE3.angle}° and ${fixed(plan.stopMoment, 1)} N·m at the ${ANGLES.stop}° stop, because the rack compresses the spring further the wider the door goes. BS EN 1154 rates this size for a leaf up to ${fixed(plan.rated.width, 0)} mm and ${fixed(plan.rated.mass, 0)} kg.`),
        r('The bolt asks', `${fixed(plan.latchMoment, 1)} N·m`, `${LATCH_FORCE} N at the leading edge of a ${fixed(plan.leaf.width, 0)} mm leaf, over the last ${ANGLES.engage}°. The spring holds ${fixed(plan.latchSpring, 1)} N·m there, ${plan.latchSpring >= plan.latchMoment + FRICTION.hinge ? 'enough to drive the bolt home standing still' : 'not enough on its own, so the door has to arrive with speed in it'}.`),
        r('Oil pressure', `${fixed(bar, 1)} bar`, clock > 0 && Math.abs(now.omega) > 1e-3 ? `Through the ${fixed(now.orifice, 2)} mm ${liveIndex === 2 ? 'back check' : liveIndex === 1 ? 'latch' : 'sweep'} orifice. The piston of ${fixed(CLOSER.bore * 1000, 1)} mm bore sweeps ${fixed(pistonArea() * CLOSER.pinion * Math.abs(now.omega) * 1e6, 1)} cm³ a second at ${fixed(Math.abs(now.omega) / RADIAN, 1)}°/s, and rho Q²/(2 Cd² A²) is what it takes to push that through the hole. The highest this swing reaches is ${fixed(topBar, 1)} bar, which is where the gray curve touches the top of the trace.` : `Nothing is moving, so no oil is going anywhere and the pressure is zero. The highest this swing reaches is ${fixed(topBar, 1)} bar.`),
        r('Sweep', plan.sweepTime === null ? 'not timed' : `${fixed(plan.sweepTime, 2)} s`, sweepText),
        r('Latch', plan.latched ? 'closes and latches' : plan.opens ? `left ${degrees(plan.ajar ?? 0)} open` : 'never opened', plan.latched ? `The door reaches the strike at ${fixed(plan.arrival / RADIAN, 1)}°/s, carrying ${fixed(plan.arrivalEnergy, 2)} J into the bolt and the frame.` : plan.opens ? `The spring runs out before the bolt is home. BS EN 1154 rules sizes 1 and 2 out of fire doors for exactly this, and asks an adjustable closer to reach at least power size ${GRADES.fireSize}.` : 'A closer stronger than the hand is a door nobody opens.'),
        r('Back check', v.backcheck === 1 ? `on past ${ANGLES.backcheck}°` : 'switched off', plan.opens ? `The door reached ${degrees(plan.peakDegrees)}${plan.hitStop === null ? ', short of the stop' : `, hitting the stop at ${fixed(plan.stopSpeed / RADIAN, 0)}°/s and leaving ${fixed(plan.stopLoss, 1)} J in it`}. The back check is a third orifice of ${fixed(ORIFICES.backcheck, 2)} mm that the oil only meets on the way out past ${ANGLES.backcheck}°.` : 'Nothing to check: the door never moved.'),
        r('Energy', `${fixed(plan.stored, 1)} J stored`, plan.opens ? `The hand put in ${fixed(plan.handWork, 1)} J, the spring held ${fixed(plan.stored, 1)} J at ${degrees(plan.peakDegrees)}, and the swing spent ${fixed(plan.oilHeat, 1)} J warming the oil, ${fixed(plan.frictionHeat, 1)} J on friction and ${fixed(plan.latchWork, 2)} J on the bolt${plan.stopLoss > 0 ? `, with ${fixed(plan.stopLoss, 1)} J left in the stop` : ''}. ${plan.latched ? 'Nothing is stored at the end: a closer is a machine for throwing away exactly what you gave it.' : `It is still holding ${fixed(plan.residual, 2)} J against a bolt it cannot open.`}` : 'The hand never moved the door, so it did no work on it.'),
        r('The door', `${fixed(plan.leaf.width, 0)} mm, ${fixed(plan.leaf.mass, 0)} kg`, `About its hinge a uniform leaf has m b²/3, here ${fixed(plan.inertia, 1)} kg·m². That inertia decides how far a push throws the door and how much it carries into the latch; it barely touches the sweep, where the oil is in charge.`),
        r('Drawn', `${fixed(timesLarger(BODY), 0)} times larger`, `The door and its frame are in plan at 1 scene unit to ${fixed(1 / PLAN, 0)} mm, the closer is cut open ${fixed(timesLarger(BODY), 0)} times larger than that, and the three orifices are drawn ${fixed(timesLarger(HOLE), 0)} times larger again. The clock runs at life.`),
        r('Model limit', 'One leaf, no wind, no seals, no temperature', `Every spring but size ${SIZE3.size} is scaled from that size's sourced moment by its tabulated test door mass. The latch, the hinge friction, the pinion radius and the back check orifice are declared. Smoke seals, wind, the arm's geometry and the way oil thins when it warms are all left out.`),
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
    {label: 'Inspect: the closer, cut open', part: 'closer', view: 'front', replay: false, run() { const state = result.getState(); return inspect(state.peakAt === null ? 0 : state.peakAt / 2); }},
    {label: 'Inspect: the three orifices', part: 'valves', view: 'front', replay: false, run() { const state = result.getState(); return inspect(state.peakAt === null ? 0 : state.peakAt + (state.ended - state.peakAt) / 2); }},
    {label: 'Inspect: the latch', part: 'latch', view: 'front', replay: false, run() { return inspect(result.getState().duration); }},
    {label: 'Inspect: the angle trace', part: 'trace', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Open it and let go',
    description: 'The hand pushes the door open, lets go at the angle chosen, and the closer takes it from there. The clock runs at life.',
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
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.followParts = ['door', 'latch', 'closer'];
  result.topology = {
    system, frame, wallLeft, wallRight, jamb, hinge, sweepBand, checkBand, latchBand, engageBand, stopMark, arcTicks,
    door, leafGroup, leaf, leafOutline, effort, delivered, latch, strike, bolt, latchMark,
    closer, shell, chamberBack, chamberFront, shellOutline, piston, rack, rackTeeth, pinion, pinionMark, spring, flowArrow,
    valves, holeFaces, holeRings, holeLabels, pressureBar, pressureFrame,
    trace, traceFrame, traceCheck, traceLatch, traceGuide, traceCurve, tracePressure, traceTicks, traceCursor,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

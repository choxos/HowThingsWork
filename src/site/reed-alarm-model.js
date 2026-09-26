import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, stripGeometry, textLabel} from './scene-kit.js';
import {
  reedAlarmPlan, reedAlarmAt, fieldOf, separationOf, RUN, SLOWER,
  CONTACT, DECLARED, MAGNET, REED, RATIO_BAND,
  SWITCH_OPTIONS, MAGNET_OPTIONS, ARMED_OPTIONS, REED_ALARM_DEFAULTS, REED_ALARM_DOMAINS,
} from './reed-alarm-physics.js';

// ---------------------------------------------------------------------------
// Magnetic burglar alarm: a door seen from above with its magnet and the switch
// on the frame; the magnet and the switch close up, with the blades touching or
// apart; the field at the switch against how far the magnet has gone, with the
// two levels that close and open the contacts drawn across it; the loop the
// panel watches; and the swing over time.
//
// Scale: the door is drawn 10 times smaller than true size, 1 m to 0.1 units;
// the magnet and the switch close up twice as large, 1 mm to 0.02 units, in a
// window 60 mm wide. The blades inside the switch are drawn far larger again
// and only to show which way they move, not to any scale. The two charts are
// not to scale: the field runs up them by its logarithm.
//
// Time: the door takes 0.8 s to swing out and back in life and 8 s here, ten
// times slower, which is said in the part text and in a reading.
// ---------------------------------------------------------------------------

export const MM = 0.01;
/** How many times larger than true size a scale in units per mm draws. */
export const timesLarger = unitsPerMillimeter => unitsPerMillimeter / MM;
/** Units per meter in the door view, and units per mm in the close up. */
export const SCALE = Object.freeze({door: 1.0, close: 0.02});

/** The door from above, m about the hinge: the frame, the leaf, the magnet on its latch edge, the switch on the frame, and the arc the magnet swings through. */
export const DOOR = Object.freeze({
  origin: Object.freeze([-1.72, 0.78, 0]),
  leaf: 0.06, frame: Object.freeze([-0.12, 0.1]), jamb: 0.09,
  magnet: Object.freeze([0.05, 0.11]), body: Object.freeze([0.06, 0.13]),
  arc: 33, sweep: 8, tick: 0.05,
});

/** The close up, mm about the switch's face: where it sits, its window, the switch body, the blades and the gap between them. */
export const CLOSE = Object.freeze({
  origin: Object.freeze([-1.34, 0.1, 0]),
  window: Object.freeze([-8, 62, -13, 13]),
  body: Object.freeze({length: 14, height: 7}), blade: Object.freeze({length: 11, height: 0.9, overlap: 3.4, apart: 2.2}),
  arrows: 3, arrowPerTesla: 26, arrowTop: 11,
});

/** The loop the panel watches, units about its own corner. */
export const LOOP = Object.freeze({
  origin: Object.freeze([-1.72, -1.05, 0]),
  box: Object.freeze([0.3, 0.26]), sounder: Object.freeze([0.16, 0.16]), run: 0.98, rise: 0.3,
  contact: 0.1, marks: 7, lamp: Object.freeze([0.15, 0.13]),
});

/** The field chart and the run chart: where they sit, how wide and tall, and what they span. */
export const CHART = Object.freeze({
  x: 0.2, w: 1.7,
  field: Object.freeze({y: 0.2, h: 0.72, low: 0.01e-3, high: 300e-3}),
  run: Object.freeze({y: -1.3, h: 0.72, low: 0.01e-3, high: 300e-3}),
  tick: 0.03,
});

export const COLORS = Object.freeze({
  wall: 0xb6b0a2, leaf: 0xd9c49a, leafLine: 0x8a7350, jamb: 0x8f989b, frame: 0x374736, faint: 0x9aa39a,
  magnet: 0xc14f39, magnetBack: 0x2b5d9c, body: 0xa9bfd6, glass: 0xd7e3ec, blade: 0x8f989b,
  field: 0x2b5d9c, closed: 0x2f7d6b, open: 0xc14f39, wire: 0xb87333, panel: 0xcfd8d3, sounder: 0xd9a441,
  operate: 0x2f7d6b, release: 0xc14f39, arc: 0x6f7a73,
});

/** Where a separation, m, falls across a chart, and where a field, T, falls up it. */
export const fieldX = distance => CHART.x + CHART.w * Math.max(0, Math.min(1, distance / DECLARED.reach));
const logShare = (value, low, high) => Math.max(0, Math.min(1, Math.log10(Math.max(Math.abs(value), low) / low) / Math.log10(high / low)));
export const fieldY = field => CHART.field.y + CHART.field.h * logShare(field, CHART.field.low, CHART.field.high);
/** Where a second of the run falls across the run chart, and a field up it. */
export const runX = seconds => CHART.x + CHART.w * Math.max(0, Math.min(1, seconds / RUN));
export const runY = field => CHART.run.y + CHART.run.h * logShare(field, CHART.run.low, CHART.run.high);

/** A field in the unit that suits it. */
export const fieldText = field => (field >= 1e-3 ? `${fixed(field * 1e3, 2)} mT` : `${fixed(field * 1e6, 0)} μT`);

export function createReedAlarmModel() {
  const kit = houseModel('Magnetic burglar alarm'), {part, control, finish} = kit;
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

  const system = part('system', 'Magnetic burglar alarm, the whole installation', `A door seen from above with a magnet on its latch edge and a reed switch on the frame, drawn ${fixed(1 / timesLarger(SCALE.door / 1000), 0)} times smaller than true size; the magnet and the switch close up, drawn ${fixed(timesLarger(SCALE.close), 0)} times larger, with the blades inside shown only to say which way they move; the field the magnet leaves at the switch against how far away it is, with the levels that close and open the contacts across it; the loop the panel watches; and the swing over time. Press Play to open the door and shut it again: it takes ${fixed(DECLARED.live, 1)} s in life and ${fixed(RUN, 0)} s here, ${fixed(SLOWER, 0)} times slower.`);

  // ---------------------------------------------------------------------------
  // The door from above.
  // ---------------------------------------------------------------------------
  const door = part('door', 'The door and its frame, from above', `The door seen from above, drawn ${fixed(1 / timesLarger(SCALE.door / 1000), 0)} times smaller than true size, with its hinge on the left and the magnet on its latch edge ${fixed(DECLARED.width, 2)} m away. The switch stands on the frame beside the magnet, the gap between them when the door is shut being the one you set. The green arc is the path the magnet swings through, and the ticks on it are where the contacts let go on the way out and take hold again on the way back.`, DOOR.origin, system);
  const dr = ([x, y], z = 0) => [x * SCALE.door, y * SCALE.door, z];
  const jamb = flat(COLORS.wall, door);
  const pivot = new THREE.Group();
  door.add(pivot);
  const leaf = flat(COLORS.leaf, pivot);
  const leafLine = lineObject(5, COLORS.leafLine, pivot);
  const magnetMark = flat(COLORS.magnet, pivot);
  const magnetBack = flat(COLORS.magnetBack, pivot);
  const switchBody = flat(COLORS.body, door);
  const swingArc = lineObject(DOOR.arc, COLORS.arc, door);
  const openTick = segmentLines(1, COLORS.open, door), closeTick = segmentLines(1, COLORS.closed, door);
  const reach = segmentLines(1, COLORS.faint, door);

  // ---------------------------------------------------------------------------
  // The magnet and the switch, close up.
  // ---------------------------------------------------------------------------
  const close = part('switch', 'The magnet and the reed switch, close up', `The magnet and the switch drawn ${fixed(timesLarger(SCALE.close), 0)} times larger than true size, in a window ${fixed(CLOSE.window[1] - CLOSE.window[0], 0)} mm wide, so the distance between them is the one the model works with. Inside the glass are two ${REED.metals[0]} plated blades sealed in ${REED.fill}; they are drawn far larger than they are and only to say which way they move. Blue arrows are the field the magnet leaves at the blades, and they grow with it.`, CLOSE.origin, system);
  const cl = ([x, y], z = 0) => [x * SCALE.close, y * SCALE.close, z];
  const closeFrame = lineObject(5, COLORS.faint, close);
  const glass = flat(COLORS.glass, close);
  const bladeTop = flat(COLORS.blade, close), bladeBottom = flat(COLORS.blade, close);
  const magnetClose = flat(COLORS.magnet, close), magnetCloseBack = flat(COLORS.magnetBack, close);
  const fieldArrows = Array.from({length: CLOSE.arrows}, () => { const arrow = solidArrow(kit, COLORS.field, close, 0.004); arrow.userData.setDirection(new THREE.Vector3(-1, 0, 0)); return arrow; });
  const separationLine = segmentLines(3, COLORS.frame, close);
  const touchMark = dot(COLORS.closed, close, 0.012);

  // ---------------------------------------------------------------------------
  // The field against the distance.
  // ---------------------------------------------------------------------------
  const chart = part('field', 'The field at the switch', `How strong the magnet's field is at the switch as the magnet goes away, across ${fixed(DECLARED.reach * 1000, 0)} mm and up the panel by its logarithm from ${fixed(CHART.field.low * 1e6, 0)} μT to ${fixed(CHART.field.high * 1e3, 0)} mT. The green line is the field this switch needs to close, which the Standex guide gives, and the red line the ${fixed(100 * DECLARED.release, 0)}% of it this model lets it fall to before the blades part. Where each crosses the curve is a distance: the nearer one closes the contacts, the farther one opens them. The gray curve is what a single dipole of the same moment would give, which is what the field becomes far out.`, [0, 0, 0], system);
  const chartFrame = segmentLines(4, COLORS.frame, chart), chartGrid = segmentLines(6, COLORS.faint, chart), chartTicks = segmentLines(7, COLORS.frame, chart);
  const fieldCurve = lineObject(DECLARED.samples, COLORS.field, chart);
  const dipoleCurve = lineObject(DECLARED.samples, COLORS.faint, chart);
  const operateLine = segmentLines(1, COLORS.operate, chart), releaseLine = segmentLines(1, COLORS.release, chart);
  const operateDrop = segmentLines(1, COLORS.operate, chart), releaseDrop = segmentLines(1, COLORS.release, chart);
  const nowDot = dot(COLORS.field, chart, 0.016);

  // ---------------------------------------------------------------------------
  // The loop the panel watches.
  // ---------------------------------------------------------------------------
  const loop = part('loop', 'The monitored loop', `The circuit the panel watches: a closed loop out to the switch and back, with the reed contacts in it and the sounder at the panel. George Risk sell these contacts for a closed loop with normally open contacts, rated ${fixed(CONTACT.formA.watts, 0)} W, ${fixed(CONTACT.formA.volts, 0)} V and ${fixed(CONTACT.formA.amps, 1)} A, with ${fixed(CONTACT.formA.resistance, 3)} Ω of their own. While the contacts are closed the loop is whole; when they part it is broken, and an armed panel sets the sounder going and keeps it going.`, LOOP.origin, system);
  const panelBox = flat(COLORS.panel, loop);
  const sounderBox = flat(COLORS.sounder, loop);
  const loopWire = lineObject(7, COLORS.wire, loop);
  const armedLamp = dot(COLORS.open, loop, 0.022);
  const contactGap = segmentLines(2, COLORS.open, loop);
  const currentMarks = Array.from({length: LOOP.marks}, () => dot(COLORS.wire, loop, 0.014));

  // ---------------------------------------------------------------------------
  // The swing over time.
  // ---------------------------------------------------------------------------
  const runPart = part('run', 'The swing over time', `The door swinging out and shutting again, on a clock ${fixed(SLOWER, 0)} times slower than life. Across the panel runs the ${fixed(RUN, 0)} s of the swing, and up it the field at the switch by its logarithm, on the same scale as the other chart. The green and red lines are again the fields that close and open the contacts, and the band along the bottom is the loop: whole where it is green, broken where it is red.`, [0, 0, 0], system);
  const runFrame = segmentLines(4, COLORS.frame, runPart), runGrid = segmentLines(6, COLORS.faint, runPart), runTicks = segmentLines(9, COLORS.frame, runPart);
  const runGuide = lineObject(DECLARED.run, COLORS.faint, runPart), runCurve = lineObject(DECLARED.run + 1, COLORS.field, runPart);
  const runOperate = segmentLines(1, COLORS.operate, runPart), runRelease = segmentLines(1, COLORS.release, runPart);
  const loopBand = strip(COLORS.closed, runPart, DECLARED.run);
  const runCursor = segmentLines(1, COLORS.frame, runPart);

  {
    const panels = [[CHART.field.y, CHART.field.h, chartFrame, chartGrid, chartTicks], [CHART.run.y, CHART.run.h, runFrame, runGrid, runTicks]];
    for (const [y, h, frameLines, gridLines, tickLines] of panels) {
      fillLine(frameLines, [[CHART.x, y], [CHART.x + CHART.w, y], [CHART.x + CHART.w, y], [CHART.x + CHART.w, y + h], [CHART.x + CHART.w, y + h], [CHART.x, y + h], [CHART.x, y + h], [CHART.x, y]].map(([px, py]) => [px, py, 0]));
      const lines = [];
      for (let field = CHART.field.low * 10; field < CHART.field.high; field *= 10) {
        const py = y + h * logShare(field, CHART.field.low, CHART.field.high);
        lines.push([[CHART.x, py, 0], [CHART.x + CHART.w, py, 0]]);
      }
      fillLine(gridLines, lines.flat());
      const ticks = [];
      if (tickLines === chartTicks) for (let mm = 10; mm <= DECLARED.reach * 1000; mm += 10) ticks.push([[fieldX(mm / 1000), y, 0], [fieldX(mm / 1000), y - CHART.tick, 0]]);
      else for (let second = 1; second < RUN; second++) ticks.push([[runX(second), y, 0], [runX(second), y - CHART.tick, 0]]);
      fillLine(tickLines, ticks.flat());
    }
  }

  // The charts' words. Both share the field scale; the run's times sit under the loop's band.
  const TEXT = 0.045, css = color => `#${color.toString(16).padStart(6, '0')}`;
  const words = (parent, text, x, y, options = {}) => textLabel(parent, text, {height: TEXT, position: [x, y, 0.001], color: css(COLORS.frame), ...options});
  const teslas = (y, h) => [1e-5, 1e-4, 1e-3, 1e-2, 1e-1].map(field => [y + h * logShare(field, CHART.field.low, CHART.field.high), field < 1e-4 ? `${fixed(field * 1e6, 0)} μT` : `${field < 1e-3 ? fixed(field * 1e3, 1) : fixed(field * 1e3, 0)} mT`]);
  const F = CHART.field, U = CHART.run, reachMm = DECLARED.reach * 1000;
  chartText(chart, (mm, y) => [fieldX(mm / 1000), y, 0], {
    title: 'The field at the switch', size: TEXT,
    x: {min: 0, max: reachMm, title: 'Magnet to switch, mm', ticks: [0, reachMm / 3, 2 * reachMm / 3, reachMm].map(mm => [mm, fixed(mm, 0)])},
    y: {min: F.y, max: F.y + F.h, title: 'Field, log scale', ticks: teslas(F.y, F.h)},
  });
  [['Field', COLORS.field], ['Pulls in', COLORS.operate], ['Lets go', COLORS.release], ['One dipole', COLORS.faint]].forEach(([text, color], i) => words(chart, text, CHART.x + CHART.w + 0.04, F.y + F.h - 0.04 - 0.06 * i, {align: 'left', color: css(color)}));
  chartText(runPart, (seconds, y) => [runX(seconds), y, 0], {
    title: 'The swing over time', size: TEXT,
    x: {min: 0, max: RUN, title: 'Seconds of the swing', ticks: [0, RUN / 2, RUN].map(t => [t, fixed(t, 0)])},
    y: {min: U.y - CHART.tick * 2 - 0.06, max: U.y + U.h, title: 'Field, log scale', ticks: teslas(U.y, U.h)},
  });
  words(runPart, 'Loop', CHART.x - 0.03, U.y - CHART.tick * 2 - 0.03, {align: 'right'});

  const d = REED_ALARM_DEFAULTS, domain = key => REED_ALARM_DOMAINS[key];
  control('angle', 'Door open', ...domain('angle'), d.angle, '°', 'How far the door stands open. The contacts let go before it has moved a finger’s width, so this slider works in tenths of a degree.');
  control('switch', 'Reed switch', ...domain('switch'), d.switch, '', 'Which switch is on the frame. Standex give each one the field it needs to pull in; the stiffer it is, the closer the magnet has to be.', SWITCH_OPTIONS);
  control('gap', 'Installed gap', ...domain('gap'), d.gap, 'mm', 'How far the installer left the magnet from the switch with the door shut. Too far and the contacts never close at all, so the panel reads an open loop on a shut door.');
  control('magnet', 'Magnet', ...domain('magnet'), d.magnet, '', 'How big the magnet on the door is. A bigger one holds the contacts closed from further away.', MAGNET_OPTIONS);
  control('width', 'Hinge to magnet', ...domain('width'), d.width, 'm', 'How far the magnet sits from the hinge. The further out it is, the further it travels for each degree the door opens.');
  control('armed', 'Alarm', ...domain('armed'), d.armed, '', 'Whether the panel is watching the loop. Disarmed, it still sees the loop break; it just does not sound.', ARMED_OPTIONS);

  const result = finish(values => {
    const plan = reedAlarmPlan(values), now = reedAlarmAt(plan, clock), started = clock > 0;
    // Before Play the door stands shut; the slider says how wide it gets opened.
    const angle = started ? now.angle : 0;
    const separation = started ? now.separation : separationOf(values.width, plan.gap, angle);
    const field = started ? now.field : fieldOf(plan.magnet, separation);
    const closed = started ? now.closed : (plan.closes && (plan.openAngle === null || angle < plan.openAngle));
    const sounding = started ? now.sounding : (values.armed === 1 && plan.closes && plan.openAngle !== null && angle >= plan.openAngle);

    // The door: the leaf swung about its hinge, the magnet on its edge, the switch on the frame.
    rect(jamb, ...[DOOR.frame[0], DOOR.frame[1]].map(v => v * SCALE.door), ...[-DOOR.jamb / 2, DOOR.jamb / 2].map(v => v * SCALE.door), -0.006);
    pivot.rotation.z = angle * Math.PI / 180;
    rect(leaf, 0, values.width * SCALE.door, -DOOR.leaf / 2 * SCALE.door, DOOR.leaf / 2 * SCALE.door, -0.004);
    fillLine(leafLine, [[0, -DOOR.leaf / 2], [values.width, -DOOR.leaf / 2], [values.width, DOOR.leaf / 2], [0, DOOR.leaf / 2], [0, -DOOR.leaf / 2]].map(point => dr(point, -0.003)));
    rect(magnetMark, (values.width - DOOR.magnet[0]) * SCALE.door, values.width * SCALE.door, -DOOR.magnet[1] / 2 * SCALE.door, DOOR.magnet[1] / 2 * SCALE.door, 0.002);
    rect(magnetBack, (values.width - 2 * DOOR.magnet[0]) * SCALE.door, (values.width - DOOR.magnet[0]) * SCALE.door, -DOOR.magnet[1] / 2 * SCALE.door, DOOR.magnet[1] / 2 * SCALE.door, 0.002);
    rect(switchBody, (values.width + plan.gap) * SCALE.door, (values.width + plan.gap + DOOR.body[0]) * SCALE.door, -DOOR.body[1] / 2 * SCALE.door, DOOR.body[1] / 2 * SCALE.door, 0.001);
    fillLine(swingArc, Array.from({length: DOOR.arc}, (_, i) => {
      const step = DOOR.sweep * i / (DOOR.arc - 1) * Math.PI / 180;
      return dr([values.width * Math.cos(step), values.width * Math.sin(step)], 0.003);
    }));
    const tickAt = (line, degrees, colorLine) => {
      if (degrees === null) { fillLine(line, []); return; }
      const step = degrees * Math.PI / 180, inner = values.width - DOOR.tick, outer = values.width + DOOR.tick;
      fillLine(line, [dr([inner * Math.cos(step), inner * Math.sin(step)], 0.004), dr([outer * Math.cos(step), outer * Math.sin(step)], 0.004)]);
    };
    tickAt(openTick, plan.openAngle !== null && plan.openAngle <= DOOR.sweep ? plan.openAngle : null);
    tickAt(closeTick, plan.closeAngle !== null && plan.closeAngle <= DOOR.sweep ? plan.closeAngle : null);
    fillLine(reach, [dr([values.width + plan.gap + DOOR.body[0], -DOOR.jamb / 2], 0.001), dr([values.width + plan.gap + DOOR.body[0], DOOR.jamb / 2], 0.001)]);

    // The close up: the switch, its blades, and the magnet at the distance it stands.
    const [left, right, bottom, top] = CLOSE.window;
    fillLine(closeFrame, [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]].map(point => cl(point, -0.004)));
    rect(glass, left * SCALE.close, (left + CLOSE.body.length) * SCALE.close, -CLOSE.body.height / 2 * SCALE.close, CLOSE.body.height / 2 * SCALE.close, -0.002);
    const spread = closed ? 0 : CLOSE.blade.apart;
    rect(bladeTop, (left + 1) * SCALE.close, (left + 1 + CLOSE.blade.length) * SCALE.close, spread / 2 * SCALE.close, (spread / 2 + CLOSE.blade.height) * SCALE.close, 0.001);
    rect(bladeBottom, (left + CLOSE.body.length - 1 - CLOSE.blade.length) * SCALE.close, (left + CLOSE.body.length - 1) * SCALE.close, (-spread / 2 - CLOSE.blade.height) * SCALE.close, -spread / 2 * SCALE.close, 0.001);
    touchMark.visible = closed;
    touchMark.position.set(...cl([left + CLOSE.body.length / 2, 0], 0.003));
    const magnetMm = plan.magnet.width * 1000, magnetAt = Math.min(separation * 1000, right - magnetMm);
    rect(magnetClose, magnetAt * SCALE.close, (magnetAt + magnetMm / 2) * SCALE.close, -plan.magnet.depth * 500 * SCALE.close, plan.magnet.depth * 500 * SCALE.close, 0.002);
    rect(magnetCloseBack, (magnetAt + magnetMm / 2) * SCALE.close, (magnetAt + magnetMm) * SCALE.close, -plan.magnet.depth * 500 * SCALE.close, plan.magnet.depth * 500 * SCALE.close, 0.002);
    fieldArrows.forEach((arrow, i) => {
      arrow.position.set(...cl([left + CLOSE.body.length + 1, CLOSE.arrowTop - i * CLOSE.arrowTop], 0.003));
      arrow.userData.setLength(Math.min(0.5, field * CLOSE.arrowPerTesla));
    });
    fillLine(separationLine, [[left + CLOSE.body.length, bottom + 3], [magnetAt, bottom + 3], [magnetAt, bottom + 2], [magnetAt, bottom + 4], [left + CLOSE.body.length, bottom + 2], [left + CLOSE.body.length, bottom + 4]].map(point => cl(point, 0.004)));

    // The field chart: the curve, the dipole it becomes, the two levels and the two distances.
    fillLine(fieldCurve, plan.curve.map(sample => [fieldX(sample.distance), fieldY(sample.field), 0]));
    fillLine(dipoleCurve, plan.curve.map(sample => [fieldX(sample.distance), fieldY(sample.dipole), 0]));
    fillLine(operateLine, [[CHART.x, fieldY(plan.operate), 0], [CHART.x + CHART.w, fieldY(plan.operate), 0]]);
    fillLine(releaseLine, [[CHART.x, fieldY(plan.release), 0], [CHART.x + CHART.w, fieldY(plan.release), 0]]);
    const dropAt = (line, distance, level) => fillLine(line, distance === null ? [] : [[fieldX(distance), CHART.field.y, 0], [fieldX(distance), fieldY(level), 0]]);
    dropAt(operateDrop, plan.operateDistance, plan.operate);
    dropAt(releaseDrop, plan.releaseDistance, plan.release);
    nowDot.position.set(fieldX(separation), fieldY(field), 0.004);

    // The loop: whole or broken, with the current running round it.
    rect(panelBox, 0, LOOP.box[0], 0, LOOP.box[1], 0.001);
    rect(sounderBox, LOOP.box[0] / 2 - LOOP.sounder[0] / 2, LOOP.box[0] / 2 + LOOP.sounder[0] / 2, LOOP.box[1] + 0.03, LOOP.box[1] + 0.03 + LOOP.sounder[1], 0.002);
    sounderBox.material.color.setHex(sounding ? COLORS.open : COLORS.panel);
    armedLamp.visible = values.armed === 1;
    armedLamp.position.set(...LOOP.lamp, 0.003);
    const bar = LOOP.box[1] / 2, breakAt = LOOP.box[0] + LOOP.run;
    fillLine(loopWire, [[LOOP.box[0], bar + 0.05], [breakAt, bar + 0.05], [breakAt, bar - 0.05], [LOOP.box[0], bar - 0.05]].map(([x, y]) => [x, y, 0.001]));
    fillLine(contactGap, closed ? [] : [[breakAt - LOOP.contact, bar + 0.05, 0.003], [breakAt - LOOP.contact, bar + 0.05 + 0.05, 0.003], [breakAt - LOOP.contact, bar - 0.05, 0.003], [breakAt - LOOP.contact, bar - 0.05 - 0.05, 0.003]]);
    currentMarks.forEach((mark, i) => {
      mark.visible = closed;
      const along = (i + 0.5) / LOOP.marks;
      mark.position.set(LOOP.box[0] + along * LOOP.run, bar + 0.05, 0.004);
    });

    // The run chart: the whole swing faintly, as far as the clock has run, and the loop band.
    fillLine(runGuide, plan.samples.map(sample => [runX(sample.t), runY(sample.field), 0]));
    const shown = started ? plan.samples.filter(sample => sample.t < clock) : [];
    fillLine(runCurve, started ? [...shown.map(sample => [runX(sample.t), runY(sample.field), 0]), [runX(clock), runY(now.field), 0]] : []);
    fillLine(runOperate, [[CHART.x, runY(plan.operate), 0], [CHART.x + CHART.w, runY(plan.operate), 0]]);
    fillLine(runRelease, [[CHART.x, runY(plan.release), 0], [CHART.x + CHART.w, runY(plan.release), 0]]);
    fillStrip(loopBand, plan.samples.map(sample => {
      const whole = reedAlarmAt(plan, sample.t).closed;
      const y = CHART.run.y - CHART.tick * 2;
      return [[runX(sample.t), y - (whole ? 0.03 : 0.05)], [runX(sample.t), y]];
    }), 0.002);
    loopBand.mesh.material.color.setHex(closed ? COLORS.closed : COLORS.open);
    fillLine(runCursor, started ? [[runX(clock), CHART.run.y, 0], [runX(clock), CHART.run.y + CHART.run.h, 0]] : []);

    const state = !plan.closes
      ? `The loop never closes · ${fieldText(plan.shut)} at the switch with the door shut is under the ${fieldText(plan.operate)} this switch needs, so the panel reads an open loop on a shut door`
      : !started
        ? `Ready · the door is shut, the magnet ${fixed(separation * 1000, 1)} mm from the switch at ${fieldText(field)} holding the contacts closed; press Play to swing it ${fixed(values.angle, 1)}° open and back${plan.openAngle > values.angle ? `, which will not reach the ${fixed(plan.openAngle, 2)}° that parts them` : ''}`
        : now.sounding && !now.closed
          ? `Sounding · the contacts parted ${fixed(plan.openAngle, 2)}° out and the loop is broken`
          : now.sounding
            ? `Still sounding · the door is shut and the contacts are closed again, but the panel latched when the loop broke`
            : closed
              ? `Whole · ${fixed(angle, 2)}° out, ${fieldText(field)} at the switch, the contacts holding`
              : `Broken · ${fixed(angle, 2)}° out, ${fieldText(field)} at the switch, the blades apart`;

    return {
      state: {...plan, now, clock, angle, separation, field, closed, sounding},
      readings: [
        r('Your result', state),
        r('Field at the reed', fieldText(field), `The magnet is ${fixed(plan.magnet.width * 1000, 0)} by ${fixed(plan.magnet.depth * 1000, 0)} by ${fixed(plan.magnet.length * 1000, 0)} mm of neodymium at ${fixed(DECLARED.remanence, 1)} T, which is inside the ${fixed(MAGNET.remanence[0], 0)} to ${fixed(MAGNET.remanence[1], 1)} T such magnets are made to. Its field on the axis comes from the pole model, and ${fixed(plan.curve.at(-1).distance * 1000, 0)} mm out it is ${fieldText(plan.curve.at(-1).field)}, within ${fixed(100 * Math.abs(plan.curve.at(-1).dipole / plan.curve.at(-1).field - 1), 1)}% of what a single dipole of its ${fixed(plan.moment, 3)} A·m² would leave there.`),
        r('Contacts', closed ? 'closed' : 'open', `The blades are ${REED.metals[0]} plated and sealed in ${REED.fill}. They are pulled together while the field is at least ${fieldText(plan.operate)}, which is what Standex give for ${plan.row.part}, and their own spring pulls them apart again once it has fallen to ${fieldText(plan.release)}.`),
        r('Operate and release', `${fieldText(plan.operate)} and ${fieldText(plan.release)}`, `Standex give this switch a pull-in of ${fieldText(plan.operate)}. This model lets the field fall to ${fixed(100 * DECLARED.release, 0)}% of that before the blades part, which is not a figure any page read gives for one switch; it is chosen so the distances come out ${fixed(plan.ratio, 3)} apart, inside the ${fixed(RATIO_BAND[0], 3)} to ${fixed(RATIO_BAND[1], 3)} the guide's own four rows span.`),
        r('Trip angle', plan.openAngle === null ? 'never closes' : `${fixed(plan.openAngle, 2)}° out, ${fixed(plan.closeAngle, 2)}° back`, `The magnet swings on a circle ${fixed(values.width, 2)} m across from the hinge, so a door open θ has carried it a chord of 2·${fixed(values.width, 2)}·sin(θ/2). ${plan.openAngle === null ? 'This magnet never closes these contacts, so there is nothing to open.' : `The contacts let go at ${fixed(plan.openAngle, 2)}°, where the magnet stands ${fixed(plan.releaseDistance * 1000, 1)} mm away, and take hold again only at ${fixed(plan.closeAngle, 2)}°, ${fixed(plan.operateDistance * 1000, 1)} mm away.`}`),
        r('Hysteresis', plan.span === null ? 'none to show' : `${fixed(plan.span, 2)}° wide`, `A switch does not let go where it took hold. Standex's own four rows show it as distance: 15.0 mm pulls in and 17.5 mm drops out on the most sensitive, 10.0 and 13.5 on the stiffest, so the ratio runs ${fixed(RATIO_BAND[0], 3)} to ${fixed(RATIO_BAND[1], 3)}. Here it is ${fixed(plan.ratio, 3)}, which on this door is ${plan.span === null ? 'nothing' : `${fixed(plan.span, 2)}° of swing`}.`),
        r('Separation', `${fixed(separation * 1000, 1)} mm`, `With the door shut the magnet sits the installed ${fixed(values.gap, 1)} mm from the switch. Opened ${fixed(angle, 2)}°, it has swung ${fixed(2 * values.width * Math.sin(angle * Math.PI / 360) * 1000, 1)} mm along its arc, and the two together put it ${fixed(separation * 1000, 1)} mm away.`),
        r('Loop', closed ? 'whole' : 'broken', `George Risk sell these as a closed loop with normally open contacts, form A, rated ${fixed(CONTACT.formA.watts, 0)} W, ${fixed(CONTACT.formA.volts, 0)} VDC and ${fixed(CONTACT.formA.amps, 1)} A, with no more than ${fixed(CONTACT.formA.resistance, 3)} Ω of contact resistance. Their normally closed and changeover parts are rated lower, ${fixed(CONTACT.formBC.watts, 0)} W and ${fixed(CONTACT.formBC.amps, 2)} A.`),
        r('Alarm', sounding ? 'sounding' : values.armed ? 'armed and quiet' : 'disarmed', `The panel watches the loop rather than the door. ${values.armed ? 'Armed, it sets the sounder going the moment the loop breaks, and keeps it going after the door is shut and the contacts have closed again.' : 'Disarmed, it still sees the loop break; it simply does not sound.'}`),
        r('Magnet', `${fixed(plan.operateDistance * 1000, 1)} mm reach`, `This magnet closes ${plan.row.part} at ${fixed(plan.operateDistance * 1000, 1)} mm and lets it go at ${fixed(plan.releaseDistance * 1000, 1)} mm. Door contacts are sold for the gap they must bridge, and George Risk list ${CONTACT.gaps.map(item => item.name).join(', ')}; this one lands on their ${plan.nearest.name}, ${fixed(Math.abs(plan.nearestError) * 1000, 2)} mm from it.`),
        r('Clock', started ? `${fixed(clock, 2)} s` : 'before the swing', `The door takes ${fixed(DECLARED.live, 1)} s to swing out and shut again in life and ${fixed(RUN, 0)} s here, ${fixed(SLOWER, 0)} times slower. ${started ? `At ${fixed(clock, 2)} s it stands ${fixed(now.angle, 2)}° open.` : `It opens to ${fixed(DECLARED.swing, 0)}° and comes back.`}`),
        r('Scales', `${fixed(1 / timesLarger(SCALE.door / 1000), 0)} times smaller`, `The door is drawn ${fixed(1 / timesLarger(SCALE.door / 1000), 0)} times smaller than true size and the close up ${fixed(timesLarger(SCALE.close), 0)} times larger, in a window ${fixed(CLOSE.window[1] - CLOSE.window[0], 0)} mm wide. The blades inside the glass are drawn far larger again, only to say which way they move.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(RUN, clock + dt); return render(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = seconds => { clock = Math.max(0, Math.min(RUN, seconds)); return render(); };
  result.actions = [
    {label: 'Inspect: the switch before the door moves', part: 'switch', view: 'front', replay: false, run() { clock = 0; return render(); }},
    {label: 'Inspect: the moment the contacts part', part: 'switch', view: 'front', replay: false, run() { return inspect(result.getState().openTime ?? 0); }},
    {label: 'Inspect: the two distances', part: 'field', view: 'front', replay: false, run() { clock = 0; return render(); }},
    {label: 'Inspect: the loop', part: 'loop', view: 'front', replay: false, run() { return inspect(result.getState().openTime ?? 0); }},
    {label: 'Inspect: the whole swing', part: 'run', view: 'front', replay: false, run() { return inspect(RUN); }},
  ];
  result.playback = {
    label: 'Swing',
    description: `The door swings out to ${fixed(DECLARED.swing, 0)}° and shuts again, ${fixed(SLOWER, 0)} times slower than life, so the contacts can be watched letting go on the way out and taking hold again further in on the way back.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= RUN,
    blocked: () => false,
  };
  result.resultPart = {id: 'run', label: 'Inspect what the swing did', view: 'front', focusOnComplete: false, available: () => clock >= RUN};

  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {
    system, door, close, chart, loop, run: runPart,
    jamb, leaf, leafLine, pivot, magnetMark, magnetBack, switchBody, swingArc, openTick, closeTick, reach,
    closeFrame, glass, bladeTop, bladeBottom, magnetClose, magnetCloseBack, fieldArrows, separationLine, touchMark,
    chartFrame, chartGrid, chartTicks, fieldCurve, dipoleCurve, operateLine, releaseLine, operateDrop, releaseDrop, nowDot,
    panelBox, sounderBox, loopWire, armedLamp, contactGap, currentMarks,
    runFrame, runGrid, runTicks, runGuide, runCurve, runOperate, runRelease, loopBand, runCursor,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

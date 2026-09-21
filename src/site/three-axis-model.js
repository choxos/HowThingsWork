import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {
  stagePlan, stageAt, trapezoidAt, MOTORS, MICROSTEPS, MOTOR, BELT, LEADS, MARLIN, STAGE,
  STAGE_DEFAULTS, STAGE_DOMAINS, AXIS_OPTIONS, MOTOR_OPTIONS, MICRO_OPTIONS,
} from './printing-physics.js';

// ---------------------------------------------------------------------------
// Three axis positioning: a stage that puts a tool at a point in space, the
// motor that drives one axis, the belt or screw that turns its turning into
// travel, the grid of microsteps the tool can actually stop on, the lost motion
// a reversal gives up, and the speed the move is held to.
//
// Scale: the stage and the motor are drawn at true size, 1 mm to 0.02 scene
// units, so the motor's body really is the 43.18 mm of a NEMA 17. The drive
// close up is drawn 10 times larger, 1 mm to 0.2 units. The step grid and the
// lost motion are drawn to fit their own window, so their magnification changes
// with the step size, from about 106 times at the coarsest setting to about
// 21,000 times at the finest; the magnification is carried in a reading. The
// speed chart is not to scale.
//
// Time: a belt move takes a fraction of a second and a screw move takes many,
// so the drawing stretches whichever is running to about four seconds. The
// factor it used is carried in a reading and named in the part text.
// ---------------------------------------------------------------------------

export const BENCH = 0.02;
export const CLOSE = 0.2;

/** How many times larger than true size a scale in units per mm draws. */
export const timesLarger = perMm => perMm / BENCH;

/** The stage drawn in millimeters: its base, uprights, rail, carriage and pulleys. */
export const RIG = Object.freeze({origin: Object.freeze([-1.78, 0.1, 0]), base: Object.freeze([96, 6]), upright: Object.freeze([6, 46]), span: 84, rail: 4, carriage: Object.freeze([14, 12]), pulley: 6.4, railY: 34, markY: 12, scaleBar: 20});
export const MOTORVIEW = Object.freeze({origin: Object.freeze([-0.33, 0.66, 0]), shaft: 2.5, pulleyTeeth: BELT.teeth, pulleyRadius: BELT.pitch * BELT.teeth / (2 * Math.PI), pointer: 0.8, fan: 64});
export const DRIVE = Object.freeze({origin: Object.freeze([-0.55, -0.42, 0]), run: 6, toothHigh: 0.7, beltHigh: 1.1, threadTurns: 3, bore: 2.4});
// The window holds at most `cells` microsteps, so at whole stepping every one
// of those is also a whole step; `heavy` has to have room for all of them.
export const GRIDVIEW = Object.freeze({origin: Object.freeze([1.12, 0.62, 0]), width: 1.7, high: 0.34, window: 0.8, cells: 64, fine: 88, heavy: 72, tick: 0.05});
export const LASHVIEW = Object.freeze({origin: Object.freeze([1.12, -0.06, 0]), width: 1.7, high: 0.3, slot: 0.24});
export const CHART = Object.freeze({x: 0.27, y: -0.92, w: 1.7, h: 0.42, top: 0.86, z: 0, samples: 121, tick: 0.02, cursor: 0.02});
export const COLORS = Object.freeze({frame: 0x6f7a6b, deck: 0xc9cdbf, rail: 0x8f989b, carriage: 0x83b4c1, belt: 0x374736, tooth: 0x78866f, motor: 0x2f3336, rotor: 0xb4c5b0, pulley: 0xe3b45e, screw: 0xe3b45e, commanded: 0xd99a2b, reached: 0x8f989b, grid: 0x374736, faint: 0x9aa39a, wave: 0x2b5d9c, warn: 0xc14f39, paper: 0xf0dfaf, table: 0x91aa7e});

/** Where a time and a speed fall on the speed chart. */
export const chartX = (plan, t) => CHART.x + Math.max(0, Math.min(1, plan.duration > 0 ? t / plan.duration : 0)) * CHART.w;
export const chartY = (plan, speed) => CHART.y + Math.max(0, Math.min(1, plan.feed > 0 ? speed / plan.feed : 0)) * CHART.top * CHART.h;

/**
 * The window the step grid is drawn over, mm: a fixed 0.8 mm, or the 64
 * microsteps that fit in less than that, so a fine grid never draws more lines
 * than it can show.
 */
export const gridWindow = plan => Math.min(GRIDVIEW.window, GRIDVIEW.cells * plan.microstep);

export function createThreeAxisModel() {
  const kit = houseModel('Three-axis positioning'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownRig = '', shownDrive = '';
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const frameLine = (line, x, y, w, h, z = 0) => fillLine(line, [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]]);

  const system = part('system', 'Putting a tool at a point', 'A stage that carries a tool to a point in space, drawn at true size, with the motor that drives one axis beside it. The step grid and the lost motion are drawn to fit their windows, so their magnification changes with the step size and is carried in a reading. Press Play to run the move out and back; the drawing stretches it to about four seconds and a reading says by how much.');

  // The stage at true size.
  const rig = part('stage', 'The stage, true size', `One axis of a three axis stage drawn at true size: a rail, a carriage on it, and a closed belt around two pulleys. The orange mark is the point asked for and the steel mark is the point the carriage reaches. The bar below is ${RIG.scaleBar} mm long.`, RIG.origin, system);
  const deck = flat(COLORS.deck, rig), baseBar = flat(COLORS.frame, rig);
  const uprights = [flat(COLORS.frame, rig), flat(COLORS.frame, rig)];
  const railBar = flat(COLORS.rail, rig);
  const carriage = flat(COLORS.carriage, rig), tool = flat(COLORS.grid, rig);
  const beltLine = lineObject(5, COLORS.belt, rig);
  const pulleys = [lineObject(41, COLORS.pulley, rig), lineObject(41, COLORS.pulley, rig)];
  const commandedMark = segmentLines(1, COLORS.commanded, rig), reachedMark = segmentLines(1, COLORS.reached, rig);
  const scaleBar = segmentLines(3, COLORS.grid, rig);
  const travelArrow = solidArrow(kit, COLORS.commanded, rig, 0.006);

  // The motor at true size.
  const motorPart = part('motor', 'The motor, true size', `A stepper motor drawn at true size: a ${fixed(MOTOR.faceplate, 2)} mm faceplate, a shaft, and a toothed pulley of ${BELT.teeth} teeth at a ${BELT.pitch} mm pitch. The pointer turns by the angle the move asks of it. One whole step turns the rotor by the step angle; the driver divides that step further.`, MOTORVIEW.origin, system);
  const motorBody = flat(COLORS.motor, motorPart);
  const motorFace = lineObject(5, COLORS.faint, motorPart);
  const pulleyRing = lineObject(MOTORVIEW.fan + 1, COLORS.pulley, motorPart);
  const pulleyTeeth = segmentLines(MOTORVIEW.pulleyTeeth, COLORS.tooth, motorPart);
  const pointer = segmentLines(1, COLORS.commanded, motorPart);
  const stepWedge = lineObject(3, COLORS.wave, motorPart);

  // The belt or the screw, close up.
  const drive = part('drive', 'Belt or screw, close up', `What turns turning into travel, drawn ${fixed(timesLarger(CLOSE), 0)} times larger. A belt of ${BELT.pitch} mm pitch on a ${BELT.teeth} tooth pulley carries ${fixed(BELT.pitch * BELT.teeth, 0)} mm a turn; an M5 screw of ${LEADS.m5} mm lead carries ${LEADS.m5} mm a turn, fifty times less. Dividing the steps a turn by that distance gives the steps a millimeter.`, DRIVE.origin, system);
  const beltBody = flat(COLORS.belt, drive), beltTeeth = segmentLines(24, COLORS.tooth, drive);
  const screwBody = flat(COLORS.screw, drive), screwThread = lineObject(200, COLORS.grid, drive);
  const driveSpan = segmentLines(3, COLORS.wave, drive);

  // The grid of microsteps.
  const grid = part('grid', 'The step grid', `Every place the drive can stand. The heavy lines are whole steps and the light ones the microsteps the driver puts between them. The orange mark is the millimeter asked for and the steel mark the microstep it is rounded to; the gap between them is all the stage can be wrong by, and it is never more than half a microstep. Drawn to fit a window that holds at most ${GRIDVIEW.cells} microsteps, so the magnification changes with the step size and is carried in a reading.`, GRIDVIEW.origin, system);
  const gridFrame = lineObject(5, COLORS.grid, grid);
  const fineLines = segmentLines(GRIDVIEW.fine, COLORS.faint, grid), heavyLines = segmentLines(GRIDVIEW.heavy, COLORS.grid, grid);
  const gridCommanded = segmentLines(1, COLORS.commanded, grid), gridReached = segmentLines(1, COLORS.reached, grid);
  const residualBar = flat(COLORS.warn, grid);

  // The lost motion a reversal gives up.
  const lashPart = part('lash', 'Lost motion, close up', 'The drive and the thing it carries, with the play between them drawn as a slot. Going out, the drive pushes on one face and the table follows exactly. On the way back the drive must cross the whole slot before it touches the other face, so the table stands still for that much of the move and ends short of where it started. Drawn to fit its window.', LASHVIEW.origin, system);
  const lashFrame = lineObject(5, COLORS.grid, lashPart);
  const lashSlot = flat(COLORS.paper, lashPart), lashDriver = flat(COLORS.carriage, lashPart), lashTable = flat(COLORS.table, lashPart);
  const lashGap = segmentLines(2, COLORS.warn, lashPart);
  const lashHome = segmentLines(1, COLORS.faint, lashPart);

  // The speed the move is held to.
  const chart = part('chart', 'Speed through the move', 'How fast the drive goes through the move. It cannot start at speed: the acceleration limit ramps it up, holds it at the feed rate if the move is long enough to reach it, and ramps it down in time to stop. A move too short to reach the feed rate is a triangle with no flat top. The line down the middle is the turn, where the move reverses and the play is given up. Drawn slower than it runs, by the factor a reading carries.', [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.grid, chart);
  const speedGuide = lineObject(CHART.samples, COLORS.faint, chart), speedCurve = lineObject(CHART.samples + 1, COLORS.wave, chart);
  const feedLine = segmentLines(1, COLORS.commanded, chart), legLine = segmentLines(1, COLORS.faint, chart);
  const chartCursor = segmentLines(2, COLORS.grid, chart);

  const d = STAGE_DEFAULTS;
  control('axis', 'Axis', ...STAGE_DOMAINS.axis, d.axis, '', 'Which axis to drive. The two belt axes carry the pulley’s circumference in a turn; the screw axis carries its lead, so it takes far more steps a millimeter and runs far slower.', AXIS_OPTIONS);
  control('motor', 'Motor', ...STAGE_DOMAINS.motor, d.motor, '', 'The step angle, and the whole steps a revolution that go with it.', MOTOR_OPTIONS);
  control('micro', 'Driver', ...STAGE_DOMAINS.micro, d.micro, '', 'How finely the driver divides a whole step. Finer division puts the drive nearer the point asked for, but the page these come from warns that step travel stays even only to about a tenth of a step.', MICRO_OPTIONS);
  control('travel', 'Move', ...STAGE_DOMAINS.travel, d.travel, 'mm', 'How far to send the carriage before bringing it back.');
  control('feed', 'Feed rate', ...STAGE_DOMAINS.feed, d.feed, 'mm/s', 'The fastest the move is allowed to go. Each axis has its own ceiling, and the screw axis is much slower than the belts.');
  control('accel', 'Acceleration', ...STAGE_DOMAINS.accel, d.accel, 'mm/s²', 'How hard the drive is allowed to change speed. A short move may stop accelerating before it ever reaches the feed rate.');
  control('lash', 'Lost motion', ...STAGE_DOMAINS.lash, d.lash, 'mm', 'The play in the coupling. The drive gives this up every time it reverses.');

  const result = finish(v => {
    const plan = stagePlan(v), now = stageAt(plan, clock), S = BENCH;
    const span = RIG.span, mmToUnits = span / STAGE.travel;

    // The stage: the frame is fixed, the carriage rides the rail.
    const rigKey = `${plan.axis}`;
    if (shownRig !== rigKey) {
      shownRig = rigKey;
      const [bw, bh] = RIG.base;
      rect(deck, -bw / 2 * S, bw / 2 * S, -bh * S, 0, -0.002);
      rect(baseBar, -bw / 2 * S, bw / 2 * S, -bh * S, -bh * S + 2 * S, -0.001);
      uprights.forEach((upright, i) => { const x = (i ? 1 : -1) * (bw / 2 - RIG.upright[0] / 2); rect(upright, (x - RIG.upright[0] / 2) * S, (x + RIG.upright[0] / 2) * S, 0, RIG.upright[1] * S, -0.001); });
      rect(railBar, -span / 2 * S, span / 2 * S, (RIG.railY - RIG.rail / 2) * S, (RIG.railY + RIG.rail / 2) * S, 0);
      pulleys.forEach((ring, i) => { const cx = (i ? 1 : -1) * span / 2; fillLine(ring, Array.from({length: 41}, (_, k) => { const a = 2 * Math.PI * k / 40; return [(cx + RIG.pulley * Math.cos(a)) * S, (RIG.railY + RIG.pulley * Math.sin(a)) * S, 0.001]; })); });
      fillLine(beltLine, [[-span / 2 * S, (RIG.railY + RIG.pulley) * S, 0.0015], [span / 2 * S, (RIG.railY + RIG.pulley) * S, 0.0015], [span / 2 * S, (RIG.railY - RIG.pulley) * S, 0.0015], [-span / 2 * S, (RIG.railY - RIG.pulley) * S, 0.0015], [-span / 2 * S, (RIG.railY + RIG.pulley) * S, 0.0015]]);
      fillLine(scaleBar, [[-RIG.scaleBar / 2 * S, -bh * S - 0.05, 0], [RIG.scaleBar / 2 * S, -bh * S - 0.05, 0], [-RIG.scaleBar / 2 * S, -bh * S - 0.07, 0], [-RIG.scaleBar / 2 * S, -bh * S - 0.03, 0], [RIG.scaleBar / 2 * S, -bh * S - 0.07, 0], [RIG.scaleBar / 2 * S, -bh * S - 0.03, 0]]);
    }
    const home = -span / 2 + RIG.carriage[0];
    const atX = mm => (home + mm * mmToUnits) * S;
    rect(carriage, atX(now.table) - RIG.carriage[0] / 2 * S, atX(now.table) + RIG.carriage[0] / 2 * S, (RIG.railY - RIG.carriage[1] / 2) * S, (RIG.railY + RIG.carriage[1] / 2) * S, 0.002);
    rect(tool, atX(now.table) - 1 * S, atX(now.table) + 1 * S, (RIG.markY) * S, (RIG.railY - RIG.carriage[1] / 2) * S, 0.002);
    fillLine(commandedMark, [[atX(plan.commanded), RIG.markY * S - 0.05, 0.003], [atX(plan.commanded), RIG.markY * S + 0.01, 0.003]]);
    fillLine(reachedMark, [[atX(now.table), RIG.markY * S - 0.05, 0.003], [atX(now.table), RIG.markY * S + 0.01, 0.003]]);
    travelArrow.position.set(atX(0), (RIG.markY - 5) * S, 0.003);
    travelArrow.userData.setDirection(new THREE.Vector3(1, 0, 0));
    travelArrow.userData.setLength(Math.max(0, plan.reached * mmToUnits * S));

    // The motor at true size, turned by the move so far.
    const face = MOTOR.faceplate;
    rect(motorBody, -face / 2 * S, face / 2 * S, -face / 2 * S, face / 2 * S, 0);
    frameLine(motorFace, -face / 2 * S, -face / 2 * S, face * S, face * S, 0.001);
    const pr = MOTORVIEW.pulleyRadius;
    fillLine(pulleyRing, Array.from({length: MOTORVIEW.fan + 1}, (_, k) => { const a = 2 * Math.PI * k / MOTORVIEW.fan; return [pr * Math.cos(a) * S, pr * Math.sin(a) * S, 0.002]; }));
    const turned = plan.lead > 0 ? 2 * Math.PI * now.motor / plan.lead : 0;
    fillLine(pulleyTeeth, Array.from({length: MOTORVIEW.pulleyTeeth}, (_, k) => {
      const a = turned + 2 * Math.PI * k / MOTORVIEW.pulleyTeeth;
      return [[pr * 0.82 * Math.cos(a) * S, pr * 0.82 * Math.sin(a) * S, 0.003], [pr * Math.cos(a) * S, pr * Math.sin(a) * S, 0.003]];
    }).flat());
    fillLine(pointer, [[0, 0, 0.004], [pr * 1.5 * Math.cos(turned) * S, pr * 1.5 * Math.sin(turned) * S, 0.004]]);
    const wedge = plan.motor.angle * Math.PI / 180;
    fillLine(stepWedge, [[pr * 1.2 * Math.cos(turned) * S, pr * 1.2 * Math.sin(turned) * S, 0.004], [0, 0, 0.004], [pr * 1.2 * Math.cos(turned + wedge) * S, pr * 1.2 * Math.sin(turned + wedge) * S, 0.004]]);

    // The belt or the screw.
    const driveKey = `${plan.belt}`;
    if (shownDrive !== driveKey) {
      shownDrive = driveKey;
      beltBody.visible = beltTeeth.visible = plan.belt;
      screwBody.visible = screwThread.visible = !plan.belt;
      if (plan.belt) {
        rect(beltBody, -DRIVE.run / 2 * CLOSE, DRIVE.run / 2 * CLOSE, 0, DRIVE.beltHigh * CLOSE, 0);
        const teeth = [];
        for (let x = -DRIVE.run / 2; x <= DRIVE.run / 2 + 1e-9; x += BELT.pitch) teeth.push([x * CLOSE, 0, 0.001], [x * CLOSE, -DRIVE.toothHigh * CLOSE, 0.001]);
        fillLine(beltTeeth, teeth);
      } else {
        rect(screwBody, -DRIVE.run / 2 * CLOSE, DRIVE.run / 2 * CLOSE, -DRIVE.bore / 2 * CLOSE, DRIVE.bore / 2 * CLOSE, 0);
        fillLine(screwThread, Array.from({length: 200}, (_, k) => { const x = -DRIVE.run / 2 + DRIVE.run * k / 199, a = 2 * Math.PI * x / LEADS.m5; return [x * CLOSE, DRIVE.bore / 2 * Math.sin(a) * CLOSE, 0.002]; }));
      }
      const one = plan.belt ? BELT.pitch : LEADS.m5;
      fillLine(driveSpan, [[-DRIVE.run / 2 * CLOSE, -DRIVE.toothHigh * CLOSE - 0.06, 0.002], [(-DRIVE.run / 2 + one) * CLOSE, -DRIVE.toothHigh * CLOSE - 0.06, 0.002],
        [-DRIVE.run / 2 * CLOSE, -DRIVE.toothHigh * CLOSE - 0.09, 0.002], [-DRIVE.run / 2 * CLOSE, -DRIVE.toothHigh * CLOSE - 0.03, 0.002],
        [(-DRIVE.run / 2 + one) * CLOSE, -DRIVE.toothHigh * CLOSE - 0.09, 0.002], [(-DRIVE.run / 2 + one) * CLOSE, -DRIVE.toothHigh * CLOSE - 0.03, 0.002]]);
    }

    // The step grid, drawn to fit its window.
    const win = gridWindow(plan), perMm = GRIDVIEW.width / win, center = plan.commanded;
    const toGrid = mm => (mm - center) * perMm;
    frameLine(gridFrame, -GRIDVIEW.width / 2, -GRIDVIEW.high / 2, GRIDVIEW.width, GRIDVIEW.high, 0);
    const fullStep = plan.micro * plan.microstep, fine = [], heavy = [];
    const first = Math.ceil((center - win / 2) / plan.microstep - 1e-9);
    for (let k = first; k * plan.microstep <= center + win / 2 + 1e-9 && fine.length < 2 * GRIDVIEW.fine; k++) {
      const x = toGrid(k * plan.microstep);
      if (Math.abs(k % plan.micro) < 1e-9) continue;
      fine.push([x, -GRIDVIEW.high / 2 + 0.03, 0.001], [x, GRIDVIEW.high / 2 - 0.03, 0.001]);
    }
    const firstFull = Math.ceil((center - win / 2) / fullStep - 1e-9);
    for (let k = firstFull; k * fullStep <= center + win / 2 + 1e-9 && heavy.length < 2 * GRIDVIEW.heavy; k++) {
      const x = toGrid(k * fullStep);
      heavy.push([x, -GRIDVIEW.high / 2 + 0.015, 0.002], [x, GRIDVIEW.high / 2 - 0.015, 0.002]);
    }
    fillLine(fineLines, fine);
    fillLine(heavyLines, heavy);
    fillLine(gridCommanded, [[toGrid(plan.commanded), -GRIDVIEW.high / 2, 0.004], [toGrid(plan.commanded), GRIDVIEW.high / 2, 0.004]]);
    fillLine(gridReached, [[toGrid(plan.reached), -GRIDVIEW.high / 2, 0.004], [toGrid(plan.reached), GRIDVIEW.high / 2, 0.004]]);
    const lo = Math.min(toGrid(plan.commanded), toGrid(plan.reached)), hi = Math.max(toGrid(plan.commanded), toGrid(plan.reached));
    rect(residualBar, lo, hi, -0.02, 0.02, 0.003);
    residualBar.visible = hi - lo > 1e-6;

    // The lost motion, drawn to fit its window.
    const lashWin = Math.max(plan.lash, plan.microstep * 4), lashPer = (LASHVIEW.width - LASHVIEW.slot) / (2 * lashWin);
    frameLine(lashFrame, -LASHVIEW.width / 2, -LASHVIEW.high / 2, LASHVIEW.width, LASHVIEW.high, 0);
    const driverX = 0, tableX = (now.table - now.motor) * lashPer;
    rect(lashSlot, driverX - LASHVIEW.slot / 2 - plan.lash * lashPer, driverX + LASHVIEW.slot / 2, -LASHVIEW.high / 2 + 0.04, LASHVIEW.high / 2 - 0.04, 0.001);
    rect(lashDriver, driverX - 0.03, driverX + 0.03, -LASHVIEW.high / 2 + 0.02, LASHVIEW.high / 2 - 0.02, 0.003);
    rect(lashTable, tableX - 0.05, tableX + 0.05, -LASHVIEW.high / 2 + 0.06, LASHVIEW.high / 2 - 0.06, 0.002);
    fillLine(lashGap, [[driverX, -LASHVIEW.high / 2 + 0.02, 0.004], [driverX - plan.lash * lashPer, -LASHVIEW.high / 2 + 0.02, 0.004],
      [driverX - plan.lash * lashPer, -LASHVIEW.high / 2 + 0.05, 0.004], [driverX - plan.lash * lashPer, -LASHVIEW.high / 2 - 0.01, 0.004]]);
    fillLine(lashHome, [[0, -LASHVIEW.high / 2, 0.002], [0, LASHVIEW.high / 2, 0.002]]);

    // The speed chart.
    frameLine(chartFrame, CHART.x, CHART.y, CHART.w, CHART.h, CHART.z);
    const speedAt = t => {
      for (const leg of plan.legs) { const within = t - leg.start; if (within >= 0 && within <= leg.profile.time) return trapezoidAt(leg.profile, within, plan.accel).speed; }
      return 0;
    };
    fillLine(speedGuide, Array.from({length: CHART.samples}, (_, k) => { const t = plan.duration * k / (CHART.samples - 1); return [chartX(plan, t), chartY(plan, speedAt(t)), CHART.z]; }));
    const shown = Array.from({length: CHART.samples}, (_, k) => plan.duration * k / (CHART.samples - 1)).filter(t => t < now.t);
    fillLine(speedCurve, clock > 0 ? [...shown.map(t => [chartX(plan, t), chartY(plan, speedAt(t)), CHART.z]), [chartX(plan, now.t), chartY(plan, now.speed), CHART.z]] : []);
    fillLine(feedLine, [[CHART.x, chartY(plan, plan.feed), CHART.z], [CHART.x + CHART.w, chartY(plan, plan.feed), CHART.z]]);
    fillLine(legLine, [[chartX(plan, plan.out.time), CHART.y, CHART.z], [chartX(plan, plan.out.time), CHART.y + CHART.h, CHART.z]]);
    const cx = chartX(plan, now.t), cy = chartY(plan, now.speed);
    fillLine(chartCursor, [[cx - CHART.cursor, cy, CHART.z], [cx + CHART.cursor, cy, CHART.z], [cx, cy - CHART.cursor, CHART.z], [cx, cy + CHART.cursor, CHART.z]]);

    // Readings.
    const micron = mm => `${fixed(mm * 1000, mm * 1000 < 10 ? 2 : 1)} μm`;
    const status = clock <= 0 ? `Ready · asked for ${fixed(plan.commanded, 3)} mm on the ${plan.axisName} axis; press Play`
      : !now.done ? `${now.leg === 0 ? 'Going out' : 'Coming back'} · the drive is at ${fixed(now.motor, 3)} mm and the table at ${fixed(now.table, 3)} mm`
      : plan.lash > 0 ? `Back · the drive returned to 0 but the table stopped ${micron(plan.endTable)} short, the lost motion it gave up on the reversal`
      : `Back · with no play in the coupling the table returned to where it started`;
    return {
      state: {...plan, now, clock, window: win, gridPerMm: perMm, magnification: perMm / BENCH, drawnFine: fine.length / 2, drawnHeavy: heavy.length / 2},
      readings: [
        r('Your result', status),
        r('Steps a millimeter', `${fixed(plan.stepsPerMm, plan.stepsPerMm < 100 ? 1 : 0)}`, `${plan.motor.steps} whole steps a turn at ${plan.motor.angle}°, divided into ${plan.micro}, is ${fixed(plan.motor.steps * plan.micro, 0)} microsteps a turn. ${plan.belt ? `A ${BELT.teeth} tooth pulley at a ${BELT.pitch} mm pitch carries ${fixed(BELT.pitch * BELT.teeth, 0)} mm a turn` : `A screw of ${LEADS.tall} mm lead carries ${LEADS.tall} mm a turn`}, so that is ${fixed(plan.stepsPerMm, plan.stepsPerMm < 100 ? 1 : 0)} steps a millimeter. Marlin ships ${fixed(plan.marlinStepsPerMm, 0)} for this axis.`),
        r('One microstep', micron(plan.microstep), `The stage can stand only on whole microsteps, ${micron(plan.microstep)} apart. The page these motors come from warns that step travel stays even only down to about a tenth of a step, and that with very fine division many commands can pass before anything moves at all.`),
        r('Reached', `${fixed(plan.reached, 4)} mm`, `${fixed(plan.commanded, 3)} mm was asked for; the nearest microstep is ${fixed(plan.reached, 4)} mm, which is ${micron(Math.abs(plan.residual))} away. Rounding can never be wrong by more than half a microstep, ${micron(plan.worst)} here.`),
        r('Lost motion', plan.lash > 0 ? `${micron(plan.lash)}` : 'none', plan.lash > 0
          ? `The coupling has ${micron(plan.lash)} of play. Going out the drive pushes on one face and the table follows it exactly; reversing, the drive crosses the whole slot before it touches the other face, so the table ends ${micron(plan.endTable)} short of where it started. Marlin measures this to ${micron(MARLIN.lashResolution)} and expects it under ${fixed(MARLIN.lashLimit, 1)} mm.`
          : `With no play the table follows the drive in both directions and comes back to where it started. Marlin measures play to ${micron(MARLIN.lashResolution)} and expects it under ${fixed(MARLIN.lashLimit, 1)} mm.`),
        r('The move', `${fixed(plan.duration, 2)} s`, `Out and back, ${fixed(plan.reached, 3)} mm each way. ${plan.out.triangular ? `The move is too short to reach ${fixed(plan.feed, 2)} mm/s: it accelerates to ${fixed(plan.out.top, 1)} mm/s at the halfway point and brakes from there.` : `It ramps up over ${fixed(plan.out.ramp, 2)} mm, holds ${fixed(plan.feed, 2)} mm/s for ${fixed(plan.out.cruise, 2)} mm, and ramps down over ${fixed(plan.out.ramp, 2)} mm.`} ${plan.feedCapped ? `The ${fixed(plan.askedFeed, 0)} mm/s asked for is above this axis’s ceiling of ${fixed(plan.maxFeed, 2)} mm/s and was held there. ` : ''}${plan.accelCapped ? `The ${fixed(plan.askedAccel, 0)} mm/s² asked for is above this axis’s ceiling of ${fixed(plan.maxAccel, 0)} mm/s² and was held there. ` : ''}Drawn ${fixed(plan.slow, 0)} times slower, which fills about ${fixed(plan.duration * plan.slow, 1)} s.`),
        r('Drawn', `${fixed(perMm / BENCH, 0)} times larger`, `The stage and the motor are at true size, 1 mm to ${BENCH} scene units, so the motor’s body really is ${fixed(MOTOR.faceplate, 2)} mm across. The belt and screw close up is ${fixed(timesLarger(CLOSE), 0)} times larger. The step grid fits a window ${fixed(win * 1000, 0)} μm wide into ${fixed(GRIDVIEW.width, 2)} units, which is ${fixed(perMm / BENCH, 0)} times larger than true size; it holds ${fixed(plan.micro, 0)} microsteps to a whole step.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  const slowness = () => result.getState().slow;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt / slowness()); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the step grid', part: 'grid', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the lost motion', part: 'lash', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the stage', part: 'stage', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the speed', part: 'chart', view: 'front', replay: false, run() { return inspect(duration() / 4); }},
  ];
  result.playback = {
    label: 'Run the move',
    description: 'The stage runs out to the point asked for and back again, stretched to about four seconds whatever the axis, by the factor the readings carry.',
    stepLabel: 'Advance 0.2 s',
    advance: result.advance,
    step: () => result.advance(0.2),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'lash', label: 'Inspect where it stopped', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0, 0, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, rig, deck, baseBar, uprights, railBar, carriage, tool, beltLine, pulleys, commandedMark, reachedMark, scaleBar, travelArrow, motorPart, motorBody, motorFace, pulleyRing, pulleyTeeth, pointer, stepWedge, drive, beltBody, beltTeeth, screwBody, screwThread, driveSpan, grid, gridFrame, fineLines, heavyLines, gridCommanded, gridReached, residualBar, lashPart, lashFrame, lashSlot, lashDriver, lashTable, lashGap, lashHome, chart, chartFrame, speedGuide, speedCurve, feedLine, legLine, chartCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

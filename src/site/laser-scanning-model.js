import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines} from './scene-kit.js';
import {
  scanPlan, scanAt, traceSample, depthResolution, imageOf, heightAt,
  SCAN, SCANNER, PIXELS, SUBPIXELS, SCAN_DEFAULTS, SCAN_DOMAINS,
  PIXEL_OPTIONS, SUBPIXEL_OPTIONS, SPACING_OPTIONS, SIDE_OPTIONS,
} from './printing-physics.js';

// ---------------------------------------------------------------------------
// Laser scanning of 3D objects: a laser line thrown across an object, a
// receiver off to one side that sees it displaced, and the triangle those two
// make, which turns the displacement into a distance.
//
// Scale: the bench is drawn at true size, 1 mm to 0.018 scene units, so the
// standoff really is the 53.5 to 78.5 mm of a laser profile scanner's measuring
// range. The target's cross section is drawn 3 times larger, 1 mm to 0.054
// units. The sensor is drawn to fit a window of a few pixels, so its
// magnification changes with the pixel pitch and the interpolation, from about
// 1,400 times to about 382,000 times; the figure is carried in a reading.
// The point cloud is drawn at the cross section's scale, slid sideways to show
// one profile behind another, and the chart is not to scale.
//
// Time: the sweep runs at the table's real 4 mm/s, so its 6 seconds are 6
// seconds; nothing is slowed.
// ---------------------------------------------------------------------------

export const BENCH = 0.018;
export const PROFILE = 0.054;

/** How many times larger than true size a scale in units per mm draws. */
export const timesLarger = perMm => perMm / BENCH;

export const RIG = Object.freeze({origin: Object.freeze([-1.86, -0.62, 0]), table: Object.freeze([30, 3]), head: 5, lens: 3.4, fan: 9});
export const PROFILEVIEW = Object.freeze({origin: Object.freeze([-0.52, 0.5, 0]), width: 1.42, high: 0.5, dot: 0.017});
export const SENSOR = Object.freeze({origin: Object.freeze([-0.52, -0.52, 0]), width: 1.42, high: 0.26, cells: 9, tick: 0.05});
export const CLOUD = Object.freeze({origin: Object.freeze([1.2, 0.42, 0]), slide: 0.021, rise: 0.011, dot: 0.014, room: 700});
export const CHART = Object.freeze({x: 0.42, y: -0.98, w: 1.5, h: 0.44, top: 0.86, z: 0, samples: 61, cursor: 0.02});
export const COLORS = Object.freeze({table: 0x8f989b, target: 0x91aa7e, ridge: 0xce825f, laser: 0xc14f39, seen: 0xe3b45e, blocked: 0x9aa39a, head: 0x2f3336, grid: 0x374736, faint: 0x9aa39a, wave: 0x2b5d9c, cloud: 0x374736, gap: 0xc14f39, pixel: 0xc9cdbf, lit: 0xd99a2b, paper: 0xf0dfaf});

/** Where a distance in mm and a depth resolution in microns fall on the chart. */
export const chartX = z => CHART.x + (z - SCANNER.start) / (SCANNER.end - SCANNER.start) * CHART.w;
export const chartY = (microns, top) => CHART.y + Math.max(0, Math.min(1, microns / top)) * CHART.top * CHART.h;

export function createLaserScanningModel() {
  const kit = houseModel('Laser scanning'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const frameLine = (line, x, y, w, h, z = 0) => fillLine(line, [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]]);

  const system = part('system', 'Measuring a shape with light', 'A laser throws a line across an object and a receiver off to one side watches it. Because the receiver looks from an angle, a taller surface pushes the line sideways in its view, and the triangle the laser, the receiver and the lit point make turns that sideways shift into a distance. Press Play to carry the target through the line and gather the points.');

  // The bench at true size.
  const bench = part('bench', 'The bench, true size', `The laser above the middle of the target, the receiver a known distance to one side, and the two paths that have to be clear for a point to be measured: the laser must reach the surface and the light must get back. Drawn at true size, 1 mm to ${BENCH} scene units, so the standoff really is the ${SCANNER.start} to ${SCANNER.end} mm of a real scanner's measuring range.`, RIG.origin, system);
  const tableTop = flat(COLORS.table, bench);
  const targetBase = flat(COLORS.target, bench), ridgeBlock = flat(COLORS.ridge, bench);
  const laserHead = flat(COLORS.head, bench), receiverHead = flat(COLORS.head, bench);
  const laserRays = segmentLines(40, COLORS.laser, bench);
  const seenRays = segmentLines(40, COLORS.seen, bench);
  const blockedRays = segmentLines(40, COLORS.blocked, bench);
  const baselineBar = segmentLines(3, COLORS.wave, bench);
  const standoffBar = segmentLines(3, COLORS.grid, bench);

  // The target's cross section with what came back and what did not.
  const profile = part('profile', 'The cross section, 3 times larger', `The line the laser lays across the target, drawn ${fixed(timesLarger(PROFILE), 0)} times larger. A filled mark is a point the receiver measured; a hollow one is a place it attempted and got nothing, because the ridge stood in one of the two paths. A gap is kept as a gap; nothing is filled in from a shape the scanner cannot see.`, PROFILEVIEW.origin, system);
  const profileFrame = lineObject(5, COLORS.grid, profile);
  const surfaceLine = lineObject(9, COLORS.target, profile);
  const measuredDots = new THREE.InstancedMesh(new THREE.CircleGeometry(PROFILEVIEW.dot, 12), unlit(COLORS.wave), 40);
  const missedDots = new THREE.InstancedMesh(new THREE.CircleGeometry(PROFILEVIEW.dot, 12), unlit(COLORS.gap), 40);
  for (const mesh of [measuredDots, missedDots]) { mesh.frustumCulled = false; mesh.count = 0; profile.add(mesh); }

  // The sensor, drawn to fit a window of a few pixels.
  const sensor = part('sensor', 'The sensor, close up', `Where the light lands on the receiver. The cells are the sensor's pixels and the gold one is the pixel the spot falls in; the blue line is where the spot really is. The reading can only be a whole cell, so the measurement is rounded to one, exactly as the stage in the positioning lesson can stop only on a whole microstep. Drawn to fit a window of ${SENSOR.cells} cells, so the magnification changes with the pixel and is carried in a reading.`, SENSOR.origin, system);
  const sensorFrame = lineObject(5, COLORS.grid, sensor);
  const sensorCells = [];
  for (let k = 0; k < SENSOR.cells; k++) sensorCells.push(flat(COLORS.pixel, sensor));
  const sensorEdges = segmentLines(SENSOR.cells + 1, COLORS.faint, sensor);
  const spotLine = segmentLines(1, COLORS.wave, sensor);
  const readLine = segmentLines(1, COLORS.lit, sensor);

  // The cloud the sweep gathers.
  const cloud = part('cloud', 'The measured cloud', 'Every point the receiver actually measured, laid out one profile behind another. It is worked out from where the light landed and the known geometry, never copied from the shape the bench already knows. Where the receiver saw nothing, the cloud simply has no point.', CLOUD.origin, system);
  const cloudDots = new THREE.InstancedMesh(new THREE.CircleGeometry(CLOUD.dot, 10), unlit(COLORS.cloud), CLOUD.room);
  cloudDots.frustumCulled = false;
  cloudDots.count = 0;
  cloud.add(cloudDots);
  const cloudFloor = segmentLines(2, COLORS.faint, cloud);

  // Depth resolution against distance.
  const chart = part('chart', 'What one pixel is worth', `How much depth a single sensor cell stands for, across the ${SCANNER.height} mm the scanner's measuring range covers. It grows as the square of the distance, because the image of a point moves less and less as the point goes further away, so the far end of the range is always coarser than the near end. A wider baseline pushes the whole curve down.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.grid, chart);
  const resolutionCurve = lineObject(CHART.samples, COLORS.wave, chart);
  const catalogLine = segmentLines(1, COLORS.gap, chart);
  const chartCursor = segmentLines(2, COLORS.grid, chart);

  const d = SCAN_DEFAULTS;
  control('standoff', 'Standoff', ...SCAN_DOMAINS.standoff, d.standoff, 'mm', 'How far the scanner stands from the surface. Its measuring range runs from 53.5 mm to 78.5 mm, and one pixel is worth more depth at the far end than at the near one.');
  control('baseline', 'Baseline', ...SCAN_DOMAINS.baseline, d.baseline, 'mm', 'How far the receiver sits from the laser. A wider baseline makes a fatter triangle, so the same step in height moves the spot further and the measurement is finer; but it also lets the object hide more from the receiver.');
  control('pixel', 'Pixel', ...SCAN_DOMAINS.pixel, d.pixel, '', 'The pixel pitch of the sensor, from three real cameras.', PIXEL_OPTIONS);
  control('subpixel', 'Reading', ...SCAN_DOMAINS.subpixel, d.subpixel, '', 'Whether the spot is read to the nearest whole pixel, or interpolated across several to a fiftieth of one.', SUBPIXEL_OPTIONS);
  control('ridge', 'Ridge', ...SCAN_DOMAINS.ridge, d.ridge, 'mm', 'How tall the step in the middle of the target stands. A taller ridge blocks more of the two paths, so more attempts come back with nothing.');
  control('spacing', 'Sampling', ...SCAN_DOMAINS.spacing, d.spacing, '', 'How far apart the samples are taken across the line and between profiles.', SPACING_OPTIONS);
  control('side', 'Receiver', ...SCAN_DOMAINS.side, d.side, '', 'Which side of the laser the receiver stands on. Moving it puts the shadow on the other side of the ridge.', SIDE_OPTIONS);

  const matrix = new THREE.Matrix4();
  const result = finish(v => {
    const plan = scanPlan(v), now = scanAt(plan, clock), S = BENCH;
    const half = SCAN.width / 2, ridgeHalf = SCAN.ridgeWidth / 2;

    // The bench.
    rect(tableTop, -RIG.table[0] / 2 * S, RIG.table[0] / 2 * S, -RIG.table[1] * S, 0, -0.002);
    rect(targetBase, -half * S, half * S, 0, 2 * S, -0.001);
    rect(ridgeBlock, -ridgeHalf * S, ridgeHalf * S, 2 * S, (2 + plan.ridge) * S, 0);
    ridgeBlock.visible = plan.ridge > 0;
    const top = (2 + plan.standoff) * S, receiverX = plan.sideSign * plan.baseline * S;
    rect(laserHead, -RIG.head / 2 * S, RIG.head / 2 * S, top, top + RIG.head * S, 0.001);
    rect(receiverHead, receiverX - RIG.lens / 2 * S, receiverX + RIG.lens / 2 * S, top, top + RIG.head * S, 0.001);
    const lit = [], seen = [], missed = [];
    for (const sample of plan.samples) {
      const hit = [sample.x * S, (2 + sample.surface) * S, 0.002];
      lit.push([0, top, 0.002], hit);
      if (sample.measured !== null) seen.push([receiverX, top, 0.003], hit);
      else if (sample.reason === 'The receiver cannot see it') missed.push([receiverX, top, 0.002], hit);
    }
    fillLine(laserRays, lit);
    fillLine(seenRays, seen);
    fillLine(blockedRays, missed);
    fillLine(baselineBar, [[0, top + RIG.head * S + 0.03, 0.003], [receiverX, top + RIG.head * S + 0.03, 0.003],
      [0, top + RIG.head * S + 0.01, 0.003], [0, top + RIG.head * S + 0.05, 0.003],
      [receiverX, top + RIG.head * S + 0.01, 0.003], [receiverX, top + RIG.head * S + 0.05, 0.003]]);
    fillLine(standoffBar, [[-half * S - 0.05, 2 * S, 0.003], [-half * S - 0.05, top, 0.003],
      [-half * S - 0.07, 2 * S, 0.003], [-half * S - 0.03, 2 * S, 0.003],
      [-half * S - 0.07, top, 0.003], [-half * S - 0.03, top, 0.003]]);

    // The cross section and what came back.
    const pw = PROFILEVIEW.width, ph = PROFILEVIEW.high;
    frameLine(profileFrame, -pw / 2, -ph / 2, pw, ph, 0);
    const tall = Math.max(4, plan.ridge + 2), perMm = (ph - 0.1) / tall;
    const atX = x => x / SCAN.width * (pw - 0.1), atY = h => -ph / 2 + 0.05 + h * perMm;
    fillLine(surfaceLine, [[atX(-half), atY(0), 0.001], [atX(-ridgeHalf), atY(0), 0.001], [atX(-ridgeHalf), atY(plan.ridge), 0.001],
      [atX(ridgeHalf), atY(plan.ridge), 0.001], [atX(ridgeHalf), atY(0), 0.001], [atX(half), atY(0), 0.001],
      [atX(half), atY(0), 0.001], [atX(half), atY(0), 0.001], [atX(half), atY(0), 0.001]]);
    let good = 0, bad = 0;
    for (const sample of plan.samples) {
      const y = sample.measured !== null ? atY(sample.measured) : atY(sample.surface);
      matrix.makeTranslation(atX(sample.x), y, sample.measured !== null ? 0.003 : 0.002);
      if (sample.measured !== null) measuredDots.setMatrixAt(good++, matrix); else missedDots.setMatrixAt(bad++, matrix);
    }
    measuredDots.count = good;
    missedDots.count = bad;
    measuredDots.instanceMatrix.needsUpdate = missedDots.instanceMatrix.needsUpdate = true;
    measuredDots.computeBoundingSphere();
    missedDots.computeBoundingSphere();

    // The sensor, around the spot the middle ray makes.
    const middle = plan.samples.find(sample => Math.abs(sample.x) < 1e-9) || plan.samples[0];
    const spot = middle && middle.image !== null && middle.image !== undefined ? middle.image : imageOf(plan.standoff, SCAN.focal, plan.baseline);
    const cell = plan.grid, window = SENSOR.cells * cell, perCell = (SENSOR.width - 0.06) / SENSOR.cells;
    const centerCell = Math.round(spot / cell);
    frameLine(sensorFrame, -SENSOR.width / 2, -SENSOR.high / 2, SENSOR.width, SENSOR.high, 0);
    const edges = [];
    sensorCells.forEach((box, k) => {
      const index = centerCell - Math.floor(SENSOR.cells / 2) + k;
      const x0 = (k - SENSOR.cells / 2) * perCell, x1 = x0 + perCell;
      rect(box, x0 + 0.004, x1 - 0.004, -SENSOR.high / 2 + 0.05, SENSOR.high / 2 - 0.05, 0.001);
      box.material.color.setHex(index === (middle && middle.reached !== null && middle.reached !== undefined ? Math.round(middle.reached / cell) : centerCell) ? COLORS.lit : COLORS.pixel);
      edges.push([x0, -SENSOR.high / 2 + 0.03, 0.002], [x0, SENSOR.high / 2 - 0.03, 0.002]);
    });
    edges.push([SENSOR.cells / 2 * perCell, -SENSOR.high / 2 + 0.03, 0.002], [SENSOR.cells / 2 * perCell, SENSOR.high / 2 - 0.03, 0.002]);
    fillLine(sensorEdges, edges);
    const spotX = (spot / cell - centerCell) * perCell;
    fillLine(spotLine, [[spotX, -SENSOR.high / 2, 0.004], [spotX, SENSOR.high / 2, 0.004]]);
    const readAt = middle && middle.reached !== null && middle.reached !== undefined ? (middle.reached / cell - centerCell) * perCell : 0;
    fillLine(readLine, [[readAt, -SENSOR.high / 2 + 0.02, 0.004], [readAt, SENSOR.high / 2 - 0.02, 0.004]]);

    // The cloud.
    let drawn = 0;
    for (const [x, height, y] of now.cloud) {
      if (drawn >= CLOUD.room) break;
      matrix.makeTranslation(x * PROFILE + y * CLOUD.slide, height * PROFILE + y * CLOUD.rise, 0.002);
      cloudDots.setMatrixAt(drawn++, matrix);
    }
    cloudDots.count = drawn;
    cloudDots.instanceMatrix.needsUpdate = true;
    cloudDots.computeBoundingSphere();
    fillLine(cloudFloor, [[-half * PROFILE - SCAN.depth / 2 * CLOUD.slide, -SCAN.depth / 2 * CLOUD.rise, 0], [half * PROFILE - SCAN.depth / 2 * CLOUD.slide, -SCAN.depth / 2 * CLOUD.rise, 0],
      [-half * PROFILE + SCAN.depth / 2 * CLOUD.slide, SCAN.depth / 2 * CLOUD.rise, 0], [half * PROFILE + SCAN.depth / 2 * CLOUD.slide, SCAN.depth / 2 * CLOUD.rise, 0]]);

    // The chart.
    frameLine(chartFrame, CHART.x, CHART.y, CHART.w, CHART.h, CHART.z);
    const topMicrons = Math.max(depthResolution(SCANNER.end, SCAN.focal, plan.baseline, plan.grid) * 1000, SCANNER.linearity) * 1.15;
    fillLine(resolutionCurve, Array.from({length: CHART.samples}, (_, k) => {
      const z = SCANNER.start + (SCANNER.end - SCANNER.start) * k / (CHART.samples - 1);
      return [chartX(z), chartY(depthResolution(z, SCAN.focal, plan.baseline, plan.grid) * 1000, topMicrons), CHART.z];
    }));
    fillLine(catalogLine, [[CHART.x, chartY(SCANNER.linearity, topMicrons), CHART.z], [CHART.x + CHART.w, chartY(SCANNER.linearity, topMicrons), CHART.z]]);
    const cx = chartX(plan.standoff), cy = chartY(plan.resolutionMicrons, topMicrons);
    fillLine(chartCursor, [[cx - CHART.cursor, cy, CHART.z], [cx + CHART.cursor, cy, CHART.z], [cx, cy - CHART.cursor, CHART.z], [cx, cy + CHART.cursor, CHART.z]]);

    // Readings.
    const magnification = (perCell / cell) / BENCH;
    const heightNow = clock > 0 && middle && middle.measured !== null ? middle.measured : null;
    const status = clock <= 0 ? `Ready · nothing measured yet; press Play to carry the target through the line`
      : !now.done ? `Scanning · ${fixed(now.profiles, 0)} profiles taken, ${fixed(now.held, 0)} points held and ${fixed(now.gaps, 0)} attempts that came back with nothing`
      : `Scanned · ${fixed(now.held, 0)} points from ${fixed(now.attempted, 0)} attempts, with ${fixed(now.gaps, 0)} gaps the receiver could not see into`;
    return {
      state: {...plan, now, clock, magnification, spot, middle},
      readings: [
        r('Your result', status),
        r('Measured height', heightNow === null ? 'not yet measured' : `${fixed(heightNow, 4)} mm`, heightNow === null
          ? `Nothing has been measured yet. The height shown here is worked out from where the light lands, so before the sweep starts there is no reading to give.`
          : `The middle of the line sits ${fixed(middle.surface, 2)} mm up, so it is ${fixed(middle.depth, 2)} mm from the receiver. Its light lands ${fixed(middle.image, 4)} mm off the sensor's axis, which rounds to the cell at ${fixed(middle.reached, 4)} mm, and that cell works back to ${fixed(heightNow, 4)} mm: out by ${fixed(Math.abs(middle.error) * 1000, 1)} μm.`),
        r('One pixel is worth', `${fixed(plan.resolutionMicrons, plan.resolutionMicrons < 10 ? 2 : 1)} μm`, `A point at ${fixed(plan.standoff, 1)} mm images at the focal length times the baseline over the distance. Move the point and that image moves the other way as the square of the distance, so one grid step of ${fixed(plan.gridMicrons, 3)} μm on the sensor stands for ${fixed(plan.resolutionMicrons, 2)} μm of depth here: ${fixed(plan.atStart, 2)} μm at the near end of the range and ${fixed(plan.atEnd, 2)} μm at the far end. A real scanner of this range holds its line to ${SCANNER.linearity} μm.`),
        r('The triangle', `${fixed(plan.baseline, 0)} mm baseline`, `The laser, the receiver and the lit point make a triangle whose base is the ${fixed(plan.baseline, 0)} mm between laser and receiver, which stands to the ${plan.sideSign > 0 ? 'right' : 'left'} of it. The receiver looks along it at ${fixed(Math.atan2(plan.baseline, plan.standoff) * 180 / Math.PI, 2)}° from straight down. Widening the base moves the spot further for the same change in height, so the measurement is finer; the cost is that the object hides more from the receiver.`),
        r('Returns', `${fixed(plan.returned, 0)} of ${fixed(plan.samples.length, 0)}`, plan.missing > 0
          ? `A point needs two clear paths: the laser has to reach it, and the light has to get back to the receiver. ${fixed(plan.samples.filter(sample => !sample.lit).length, 0)} of these attempts were never lit and ${fixed(plan.samples.filter(sample => sample.lit && !sample.seen).length, 0)} were lit but hidden from the receiver, on the ${plan.sideSign > 0 ? 'left' : 'right'} of the ridge, the side away from the receiver. Putting the receiver on the other side moves the shadow across; it does not remove it.`
          : `Every attempt came back. With no ridge in the way, both paths are clear everywhere along the line, whichever side the receiver stands on.`),
        r('The sweep', `${fixed(plan.profiles, 0)} profiles`, `The table carries the target through the fixed laser line at ${SCAN.speed} mm/s, taking a profile every ${fixed(plan.spacing, 0)} mm over ${SCAN.depth} mm, so the whole sweep is ${fixed(plan.duration, 0)} s and gathers at most ${fixed(plan.profiles * plan.returned, 0)} points. A real scanner of this kind reads ${fixed(SCANNER.points, 0)} points along each profile and can take ${fixed(SCANNER.fast, 0)} profiles a second.`),
        r('Drawn', `${fixed(magnification, 0)} times larger`, `The bench is at true size, 1 mm to ${BENCH} scene units, so the standoff really is ${fixed(plan.standoff, 1)} mm. The cross section is ${fixed(timesLarger(PROFILE), 0)} times larger. The sensor fits ${SENSOR.cells} cells of ${fixed(plan.gridMicrons, 3)} μm into its window, which is ${fixed(magnification, 0)} times larger than true size. The chart is not to scale.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the bench', part: 'bench', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the cross section', part: 'profile', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the sensor', part: 'sensor', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: what one pixel is worth', part: 'chart', view: 'front', replay: false, run() { return inspect(duration()); }},
  ];
  result.playback = {
    label: 'Scan the target',
    description: `The table carries the target through the fixed laser line at ${SCAN.speed} mm/s, taking one profile every few millimeters. The sweep runs at its real speed.`,
    stepLabel: 'Advance 1 s',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'cloud', label: 'Inspect the measured cloud', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0, 0, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, bench, tableTop, targetBase, ridgeBlock, laserHead, receiverHead, laserRays, seenRays, blockedRays, baselineBar, standoffBar, profile, profileFrame, surfaceLine, measuredDots, missedDots, sensor, sensorFrame, sensorCells, sensorEdges, spotLine, readLine, cloud, cloudDots, cloudFloor, chart, chartFrame, resolutionCurve, catalogLine, chartCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, stripGeometry, surface, textLabel} from './scene-kit.js';
import {dipPenPlan, dipPenAt, clockTime, clockSeconds, riseAt, wedgeAt, wedgeLength, BENCH, CLOCK, NIB, LIQUID_OPTIONS, DIP_DEFAULTS, DIP_DOMAINS} from './pens-physics.js';

// ---------------------------------------------------------------------------
// Dip pen and capillary bench: a steel nib dipped into ink, its tip pressed
// on paper close up, and beside them a glass tube and a wedge of glass plates
// dipped into a dish, the top of the liquid in the tube close up, and a chart
// of the rise.
//
// Scale: the nib, the inkwell and the bench are drawn at true size, 1 mm to
// 0.01 scene units, with y up from the liquid's surface, except that the
// bench tube's bore and the plates' gap are drawn 10 times wider so they
// show; heights stay true. The nib's slit, 0.02 mm wide, is drawn as a line.
// The tip close up is drawn 50 times larger, tipped back to look down onto the paper. The meniscus close up is drawn
// with the bore always 20 mm across. The chart is not to scale.
//
// Time runs on a log scale: each second of playback shows ten times as much
// time as the one before, from 1 ms to 1,000 s. The part text and a reading
// say so, and the reading carries the real time since dipping.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const WIDEN = 10;
export const TIP = 50;
export const SHOULDER = 20;
export const TIP_WINDOW = 1.5;
export const TIP_TILT = 0.35;

/** The inkwell and the holder, mm: the well's radius, floor and rim, and the wooden holder's radius and ends. */
export const INKWELL = Object.freeze({radius: 12, floor: -20, rim: 8, holder: 4, holderFrom: 22, holderTo: 90});
export const TIP_ORIGIN = Object.freeze([-0.75, 0.55, 0]);
export const BENCH_ORIGIN = Object.freeze([0.45, 0, 0]);

/** The bench as drawn, mm from its origin: the dish, the tube's place and glass, the wedge's place and plates, and its strips. */
export const LAYOUT = Object.freeze({dishX0: 0, dishX1: 90, floor: -25, back: -20, front: -7, tubeX: 20, wedgeX: 45, wall: 1, plate: 0.5, strips: 40, mark: 0.5});
export const MENISCUS = Object.freeze({origin: [1.75, 1.35, 0], bore: 10, wall: 2, below: 30, above: 20, steps: 24, tangent: 8});
export const CHART = Object.freeze({x: 1.35, y: 0.2, w: 0.8, h: 0.7, z: 0, low: -20, high: 160, first: -3, decades: 6, levelTick: 40, tick: 0.02, points: 64, cursor: 0.025});
export const COLORS = Object.freeze({liquids: Object.freeze([0x6fa8dc, 0xb9a3d6, 0xa9b1b8]), lines: Object.freeze([0x2f78b7, 0x7a5aa6, 0x6b737a]), ink: 0x2b5d9c, slit: 0x374736, chart: 0x374736, faint: 0x9aa39a, glass: 0xcfe0e6});

/** A time since dipping, s, on the chart's log scale across. */
export const chartX = time => CHART.x + Math.max(0, Math.min(1, (Math.log10(Math.max(time, 1e-300)) - CHART.first) / CHART.decades)) * CHART.w;

/** A level about the liquid outside, mm, on the chart. */
export const chartY = level => CHART.y + Math.max(0, Math.min(1, (level - CHART.low) / (CHART.high - CHART.low))) * CHART.h;

/** The times the chart's curves are drawn at, evenly spread on the log scale. */
export const chartTimes = () => Array.from({length: CHART.points}, (_, j) => 10 ** (CHART.first + CHART.decades * j / (CHART.points - 1)));

/** A time for a reading. */
export const timeText = t => (t < 0.01 ? `${fixed(t * 1000, 2)} ms` : t < 1 ? `${fixed(t * 1000, 0)} ms` : t < 100 ? `${fixed(t, 2)} s` : `${fixed(t, 0)} s`);

/**
 * The top of a liquid in a tube of radius `a`, meeting the glass at `angle`
 * degrees through the liquid, as [radius, height] from the wall to the axis,
 * heights from where it meets the wall. A sphere of radius a / |cos θ|: dipping
 * in the middle when cos θ > 0, bulging up when cos θ < 0.
 */
export function meniscusCurve(angle, a, steps = MENISCUS.steps) {
  const c = Math.cos(angle * Math.PI / 180);
  if (Math.abs(c) < 1e-12) return [[a, 0], [0, 0]];
  const R = a / Math.abs(c), rise = Math.sqrt(Math.max(0, R * R - a * a)), sign = c > 0 ? -1 : 1;
  return Array.from({length: steps + 1}, (_, i) => { const rho = a * (1 - i / steps); return [rho, sign * (Math.sqrt(Math.max(0, R * R - rho * rho)) - rise)]; });
}

/** A tine's inner edge along the slit, mm from the nib's middle, `s` mm above the tip. The tines hinge at the vent hole, so a splay opens the tip most. */
export const tineInner = (plan, s) => NIB.gap / 2 + plan.splay / 2 * (1 - s / NIB.slit);

/** A tine's outer edge, mm from the nib's middle, `s` mm above the tip: the two tips together span the line the nib leaves. */
export const tineOuter = (plan, s) => tineInner(plan, s) - NIB.gap / 2 + NIB.tip / 2 + (NIB.width / 2 - NIB.tip / 2) * s / SHOULDER;

export function createDipPenModel() {
  const kit = houseModel('Dip pen'), {part, control, finish} = kit;
  const mm = value => value * MM;
  const block = (color, parent) => surface(kit, new THREE.BoxGeometry(1, 1, 1), color, parent);
  const setBox = (mesh, [x0, x1], [y0, y1], [z0, z1]) => {
    mesh.position.set(mm(x0 + x1) / 2, mm(y0 + y1) / 2, mm(z0 + z1) / 2);
    mesh.scale.set(Math.max(1e-9, mm(x1 - x0)), Math.max(1e-9, mm(y1 - y0)), Math.max(1e-9, mm(z1 - z0)));
  };
  const rod = (color, parent) => surface(kit, new THREE.CylinderGeometry(1, 1, 1, 40), color, parent);
  const setRod = (mesh, x, radius, y0, y1) => {
    mesh.position.set(mm(x), mm(y0 + y1) / 2, 0);
    mesh.scale.set(Math.max(1e-9, mm(radius)), Math.max(1e-9, mm(y1 - y0)), Math.max(1e-9, mm(radius)));
    mesh.visible = y1 - y0 > 1e-9;
  };
  const halfShell = (color, parent) => surface(kit, new THREE.CylinderGeometry(1, 1, 1, 40, 1, true, Math.PI / 2, Math.PI), color, parent, true);
  const flat = points => new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(mm(x), mm(y)))));

  const system = part('system', 'Dip pen and capillary bench', 'A dip pen dipped into ink, its tip pressed on paper close up, and beside it a capillary bench: a glass tube and a wedge of two glass plates standing in a dish. Choose the liquid on the bench, the tube’s radius and how hard the nib is pressed, then press Play. Time runs on a log scale.', [0, 0, 0]);

  // The nib and its inkwell, true size.
  const nib = part('nib', 'Nib and inkwell', `The nib and its inkwell, drawn at true size. The slit from the tip to the vent hole is ${fixed(NIB.gap, 2)} mm wide, far too narrow to see, so it is drawn as a line, with the ink climbing it in blue. The nib is dipped ${fixed(NIB.dip, 0)} mm with its tines at rest.`, [0, 0, 0], system);
  const outline = new THREE.Shape([[0, 0], [NIB.width / 2, SHOULDER], [NIB.width / 2, NIB.length], [-NIB.width / 2, NIB.length], [-NIB.width / 2, SHOULDER]].map(([x, y]) => new THREE.Vector2(x, y)));
  outline.holes.push(new THREE.Path().absarc(0, NIB.slit, NIB.vent, 0, 2 * Math.PI, true));
  const plateGeometry = new THREE.ExtrudeGeometry(outline, {depth: NIB.thick, bevelEnabled: false, curveSegments: 24});
  plateGeometry.scale(MM, MM, MM);
  const plate = surface(kit, plateGeometry, 'metal', nib);
  plate.position.set(0, mm(-NIB.dip), mm(-NIB.thick / 2));
  const slitLine = segmentLines(1, COLORS.slit, nib);
  fillLine(slitLine, [[0, mm(-NIB.dip), mm(NIB.thick)], [0, mm(NIB.slit - NIB.vent - NIB.dip), mm(NIB.thick)]]);
  const slitInk = segmentLines(1, COLORS.ink, nib);
  const holder = rod('wood', nib);
  setRod(holder, 0, INKWELL.holder, INKWELL.holderFrom, INKWELL.holderTo);
  const well = halfShell('blue', nib);
  well.material.color.set(COLORS.glass);
  well.position.set(0, mm(INKWELL.floor + INKWELL.rim) / 2, 0);
  well.scale.set(mm(INKWELL.radius), mm(INKWELL.rim - INKWELL.floor), mm(INKWELL.radius));
  const inkBody = halfShell('blue', nib);
  inkBody.material.color.set(COLORS.ink);
  inkBody.position.set(0, mm(INKWELL.floor) / 2, 0);
  inkBody.scale.set(mm(INKWELL.radius - 0.5), mm(-INKWELL.floor), mm(INKWELL.radius - 0.5));
  const inkTop = surface(kit, new THREE.CircleGeometry(1, 40, 0, Math.PI), 'blue', nib);
  inkTop.material = inkBody.material;
  inkTop.rotation.x = -Math.PI / 2;
  inkTop.scale.setScalar(mm(INKWELL.radius - 0.5));

  // The tip pressed on paper, close up.
  const tip = part('tip', 'Tip on the paper, close up', `The same tip pressed on paper, drawn ${TIP} times larger: the last ${fixed(TIP_WINDOW, 1)} mm of the tines, the ink between them and the line they leave, tipped back to look down onto the paper. Pressing splays the tines ${fixed(NIB.compliance, 1)} mm for every newton, an illustrative springiness.`, TIP_ORIGIN, system);
  tip.rotation.x = TIP_TILT;
  const tines = [0, 1].map(() => surface(kit, new THREE.BufferGeometry(), 'metal', tip, true));
  const gapInk = surface(kit, new THREE.BufferGeometry(), 'blue', tip, true);
  gapInk.material.color.set(COLORS.ink);
  const tipPaper = block('cream', tip);
  setBox(tipPaper, [-25, 25], [-2, 0], [-40, 12]);
  const tipLine = block('blue', tip);
  tipLine.material = gapInk.material;

  // The capillary bench.
  const bench = part('capillary', 'Capillary bench', `A glass tube and a wedge of two glass plates, dipped ${fixed(BENCH.depth, 0)} mm into the dish. Heights are drawn at true size, but the tube’s bore and the plates’ gap are drawn ${WIDEN} times wider so they show. The wedge opens from ${fixed(BENCH.narrow, 1)} mm to ${fixed(BENCH.wide, 1)} mm across its ${fixed(BENCH.width, 0)} mm, its front plate drawn only in outline; the dark upright line marks where its gap equals the tube’s radius. Time runs on a log scale.`, BENCH_ORIGIN, system);
  const dish = block('blue', bench);
  const liquidMaterial = dish.material.clone();
  liquidMaterial.side = THREE.DoubleSide;
  dish.material = liquidMaterial;
  setBox(dish, [LAYOUT.dishX0, LAYOUT.dishX1], [LAYOUT.floor, 0], [LAYOUT.back, LAYOUT.front]);
  const surfaceLine = segmentLines(1, COLORS.faint, bench);
  fillLine(surfaceLine, [[mm(LAYOUT.dishX0), 0, mm(8)], [mm(LAYOUT.dishX1), 0, mm(8)]]);
  const tubeGlass = halfShell('blue', bench);
  tubeGlass.material.color.set(COLORS.glass);
  const column = rod('blue', bench);
  column.material = liquidMaterial;
  const backPlate = block('blue', bench);
  backPlate.material = tubeGlass.material;
  const plateZ = gap => WIDEN * gap / 2 + LAYOUT.plate / 2;
  {
    const x0 = LAYOUT.wedgeX, x1 = LAYOUT.wedgeX + BENCH.width, z0 = -plateZ(BENCH.narrow), z1 = -plateZ(BENCH.wide);
    backPlate.position.set(mm(x0 + x1) / 2, mm(BENCH.tall - BENCH.depth) / 2, mm(z0 + z1) / 2);
    backPlate.scale.set(mm(Math.hypot(x1 - x0, z1 - z0)), mm(BENCH.tall + BENCH.depth), mm(LAYOUT.plate));
    backPlate.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  }
  const frontPlate = lineObject(5, COLORS.faint, bench);
  {
    const x0 = LAYOUT.wedgeX, x1 = LAYOUT.wedgeX + BENCH.width, z0 = plateZ(BENCH.narrow), z1 = plateZ(BENCH.wide);
    fillLine(frontPlate, [[mm(x0), mm(-BENCH.depth), mm(z0)], [mm(x1), mm(-BENCH.depth), mm(z1)], [mm(x1), mm(BENCH.tall), mm(z1)], [mm(x0), mm(BENCH.tall), mm(z0)], [mm(x0), mm(-BENCH.depth), mm(z0)]]);
  }
  const sheet = surface(kit, stripGeometry(LAYOUT.strips + 1), 'blue', bench);
  sheet.material = liquidMaterial;
  sheet.geometry.attributes.normal.array.fill(0);
  for (let i = 0; i <= 2 * LAYOUT.strips + 1; i++) sheet.geometry.attributes.normal.array[3 * i + 2] = 1;
  const matchMark = segmentLines(1, COLORS.chart, bench);

  // The top of the liquid in the tube, close up.
  const meniscus = part('meniscus', 'Meniscus, close up', `The top of the liquid in the tube, cut open and drawn so the bore is always ${fixed(2 * MENISCUS.bore, 0)} mm across, with a short line along the surface where it meets the glass. Its shape stays the same as the liquid climbs, so it is drawn for any liquid that gets in. Water and ethanol wet glass, so the surface meets it straight along the wall and dips in the middle; mercury meets it at 140° and bulges up.`, MENISCUS.origin, system);
  const menWalls = [-1, 1].map(side => {
    const wall = block('blue', meniscus);
    wall.material = tubeGlass.material;
    const inner = side * MENISCUS.bore, outer = side * (MENISCUS.bore + MENISCUS.wall);
    setBox(wall, [Math.min(inner, outer), Math.max(inner, outer)], [-MENISCUS.below, MENISCUS.above], [-MENISCUS.wall, 0]);
    return wall;
  });
  const menColumn = surface(kit, new THREE.BufferGeometry(), 'blue', meniscus);
  menColumn.material = liquidMaterial;
  const tangents = segmentLines(2, COLORS.chart, meniscus);

  // The chart of the rise, on a log scale of time.
  const chart = part('chart', 'Rise over time', `The level in the tube against the time since dipping: from ${fixed(CHART.low, 0)} mm to ${fixed(CHART.high, 0)} mm about the liquid outside, and from 1 ms to 1,000 s across on a log scale, a tick at every tenfold. Solid: the tube. Faint: the wedge where its gap equals the tube’s radius. The faint level line is the liquid outside. A liquid that stays out draws no line.`, [0, 0, 0], system);
  const frame = lineObject(5, COLORS.chart, chart);
  fillLine(frame, [[CHART.x, CHART.y, CHART.z], [CHART.x + CHART.w, CHART.y, CHART.z], [CHART.x + CHART.w, CHART.y + CHART.h, CHART.z], [CHART.x, CHART.y + CHART.h, CHART.z], [CHART.x, CHART.y, CHART.z]]);
  const zeroLine = segmentLines(1, COLORS.faint, chart);
  fillLine(zeroLine, [[CHART.x, chartY(0), CHART.z], [CHART.x + CHART.w, chartY(0), CHART.z]]);
  const ticks = segmentLines(8, COLORS.faint, chart);
  const tickPoints = [];
  for (let decade = CHART.first + 1; decade < CHART.first + CHART.decades; decade++) { const x = chartX(10 ** decade); tickPoints.push([x, CHART.y, CHART.z], [x, CHART.y - CHART.tick, CHART.z]); }
  for (let level = CHART.levelTick; level < CHART.high; level += CHART.levelTick) { const y = chartY(level); tickPoints.push([CHART.x, y, CHART.z], [CHART.x - CHART.tick, y, CHART.z]); }
  fillLine(ticks, tickPoints);
  const tubeCurve = lineObject(CHART.points, COLORS.lines[0], chart), platesCurve = lineObject(CHART.points, COLORS.faint, chart);
  const tubeCursor = segmentLines(2, COLORS.chart, chart), platesCursor = segmentLines(2, COLORS.faint, chart);
  // The chart's words, every second tenfold named across it, and its key to its right.
  const TEXT = 0.04, css = color => `#${color.toString(16).padStart(6, '0')}`;
  const timeText = seconds => (seconds < 1 ? `${fixed(seconds * 1000, 0)} ms` : `${fixed(seconds, 0)} s`);
  chartText(chart, (seconds, level) => [chartX(seconds), chartY(level), CHART.z], {
    title: 'Rise over time', size: TEXT,
    x: {min: 10 ** CHART.first, max: 10 ** (CHART.first + CHART.decades), title: 'Time since dipping, log scale', ticks: Array.from({length: CHART.decades / 2 + 1}, (_, i) => 10 ** (CHART.first + 2 * i)).map(seconds => [seconds, timeText(seconds)])},
    y: {min: CHART.low, max: CHART.high, title: 'Level, mm', ticks: Array.from({length: CHART.high / CHART.levelTick + 1}, (_, i) => [i * CHART.levelTick, fixed(i * CHART.levelTick, 0)])},
  });
  // One 'Tube' word in each liquid's color; the one for the liquid chosen shows.
  const tubeWords = COLORS.lines.map(color => textLabel(chart, 'Tube', {height: TEXT, align: 'left', color: css(color), position: [CHART.x + CHART.w + 0.04, CHART.y + CHART.h - 0.04, 0.001]}));
  const wedgeWord = textLabel(chart, 'Wedge', {height: TEXT, align: 'left', color: css(COLORS.faint), position: [CHART.x + CHART.w + 0.04, CHART.y + CHART.h - 0.1, 0.001]});

  control('press', 'Press on the nib', ...DIP_DOMAINS.press, DIP_DEFAULTS.press, 'N', 'How hard the nib is pressed on the paper, in the close up of its tip.');
  control('liquid', 'Liquid on the bench', ...DIP_DOMAINS.liquid, DIP_DEFAULTS.liquid, '', 'The liquid in the bench’s dish. The nib is always dipped in water-based ink.', LIQUID_OPTIONS.map(option => ({...option})));
  control('radius', 'Tube radius', ...DIP_DOMAINS.radius, DIP_DEFAULTS.radius, 'mm', 'The radius of the bench tube’s bore.');

  // What changes only with the settings.
  let drawnKey = '';
  const redraw = plan => {
    const key = JSON.stringify(plan.values);
    if (key === drawnKey) return;
    drawnKey = key;
    const v = plan.values, bore = WIDEN * plan.radius;
    liquidMaterial.color.set(COLORS.liquids[v.liquid]);

    tines.forEach((mesh, i) => {
      const side = i ? 1 : -1;
      mesh.geometry.dispose();
      mesh.geometry = flat([[side * tineInner(plan, 0), 0], [side * tineOuter(plan, 0), 0], [side * tineOuter(plan, TIP_WINDOW), TIP_WINDOW], [side * tineInner(plan, TIP_WINDOW), TIP_WINDOW]].map(([x, y]) => [x * TIP, y * TIP]));
    });
    gapInk.geometry.dispose();
    gapInk.geometry = flat([[-tineInner(plan, 0), 0], [tineInner(plan, 0), 0], [tineInner(plan, TIP_WINDOW), TIP_WINDOW], [-tineInner(plan, TIP_WINDOW), TIP_WINDOW]].map(([x, y]) => [x * TIP, y * TIP]));
    setBox(tipLine, [-plan.line / 2 * TIP, plan.line / 2 * TIP], [0, 0.3], [-40, 0]);

    tubeGlass.position.set(mm(LAYOUT.tubeX), mm(BENCH.tall - BENCH.depth) / 2, 0);
    tubeGlass.scale.set(mm(bore + LAYOUT.wall), mm(BENCH.tall + BENCH.depth), mm(bore + LAYOUT.wall));
    const across = LAYOUT.wedgeX + wedgeAt(plan.radius);
    fillLine(matchMark, [[mm(across), mm(-BENCH.depth), mm(LAYOUT.mark)], [mm(across), mm(BENCH.tall), mm(LAYOUT.mark)]]);

    const curve = meniscusCurve(plan.liquid.angle, MENISCUS.bore);
    const profile = [[0, -MENISCUS.below], [MENISCUS.bore, -MENISCUS.below], ...curve].map(([x, y]) => new THREE.Vector2(mm(x), mm(y)));
    menColumn.geometry.dispose();
    menColumn.geometry = new THREE.LatheGeometry(profile, 40, Math.PI / 2, Math.PI);
    const s = Math.sin(plan.liquid.angle * Math.PI / 180), c = Math.cos(plan.liquid.angle * Math.PI / 180);
    fillLine(tangents, [[mm(MENISCUS.bore), 0, mm(MENISCUS.bore)], [mm(MENISCUS.bore - s * MENISCUS.tangent), mm(-c * MENISCUS.tangent), mm(MENISCUS.bore)], [mm(-MENISCUS.bore), 0, mm(MENISCUS.bore)], [mm(-MENISCUS.bore + s * MENISCUS.tangent), mm(-c * MENISCUS.tangent), mm(MENISCUS.bore)]]);

    tubeCurve.material.color.set(COLORS.lines[v.liquid]);
    const times = chartTimes();
    fillLine(tubeCurve, plan.enters ? times.map(t => [chartX(t), chartY(1000 * riseAt(plan.tube, t) - BENCH.depth), CHART.z]) : []);
    fillLine(platesCurve, plan.enters ? times.map(t => [chartX(t), chartY(1000 * riseAt(plan.plates, t) - BENCH.depth), CHART.z]) : []);
    tubeWords.forEach((word, i) => { word.visible = plan.enters && i === v.liquid; });
    wedgeWord.visible = plan.enters;
  };

  let clock = 0, lastClock = 0, disposed = false;
  const result = finish(values => {
    const plan = dipPenPlan(values), time = clockTime(clock), now = dipPenAt(plan, time), v = plan.values;
    redraw(plan);

    // The ink up the nib's slit, from the tip.
    fillLine(slitInk, now.slit > 0 ? [[0, mm(-NIB.dip), mm(NIB.thick + 0.05)], [0, mm(now.slit - NIB.dip), mm(NIB.thick + 0.05)]] : []);

    // The tube's column, from its bottom end to its level, and the sheet between the plates.
    const bore = WIDEN * plan.radius, columnTop = plan.enters ? now.level : -BENCH.depth;
    setRod(column, LAYOUT.tubeX, bore, -BENCH.depth, columnTop);
    const positions = sheet.geometry.attributes.position.array, tops = [];
    for (let i = 0; i <= LAYOUT.strips; i++) {
      const x = BENCH.width * i / LAYOUT.strips, top = wedgeLength(plan.liquid, x, time) - BENCH.depth;
      tops.push(top);
      positions.set([mm(LAYOUT.wedgeX + x), mm(-BENCH.depth), 0, mm(LAYOUT.wedgeX + x), mm(top), 0], i * 6);
    }
    sheet.geometry.attributes.position.needsUpdate = true;
    sheet.geometry.computeBoundingBox();
    sheet.geometry.computeBoundingSphere();

    // The meniscus close up: its shape does not change as the liquid climbs, so it shows for any liquid that gets in.
    const inTube = plan.enters;
    menColumn.visible = inTube;
    tangents.visible = inTube;

    // Where the rise is on the chart.
    const cross = (line, level) => fillLine(line, level === null ? [] : [[chartX(time) - CHART.cursor, chartY(level), CHART.z], [chartX(time) + CHART.cursor, chartY(level), CHART.z], [chartX(time), chartY(level) - CHART.cursor, CHART.z], [chartX(time), chartY(level) + CHART.cursor, CHART.z]]);
    cross(tubeCursor, plan.enters && time > 0 ? now.level : null);
    cross(platesCursor, plan.enters && time > 0 ? now.plateLevel : null);

    const name = plan.liquid.name, lower = name.toLowerCase(), tube = `${fixed(plan.radius, 2)} mm tube`;
    const levelText = level => (level >= 0 ? `${fixed(level, 1)} mm above the ${lower} outside` : `${fixed(-level, 1)} mm below the ${lower} outside`);
    const finalText = plan.enters ? (plan.height >= 0 ? `${name} stands ${fixed(plan.height, 1)} mm up the ${tube}` : `${name} stands ${fixed(-plan.height, 1)} mm below the level outside the ${tube}`) : `${name} stays out of the ${tube}`;
    const status = clock <= 0 ? `Ready · ${lower} and a ${tube}; press Play` : clock >= CLOCK.seconds ? finalText : `${timeText(time)} · ${plan.enters ? levelText(now.level) : `${lower} stays out`}`;
    const tubeHint = plan.enters
      ? `Jurin’s law gives ${fixed(Math.abs(plan.height), 1)} mm ${plan.height >= 0 ? 'up' : 'down'} for a ${tube}: there the curved surface’s ${plan.pull >= 0 ? 'pull' : 'push'} of ${fixed(Math.abs(plan.pull), 0)} Pa balances the weight of that much ${lower}. It gets 90% of the way in ${timeText(plan.tube90)}. The capillary length of ${lower} is ${fixed(plan.capillary, 2)} mm, and every tube here is narrower, as Jurin’s law needs.`
      : `Mercury does not wet glass, so its surface bulges up and pushes down with ${fixed(-plan.pull / 1000, 2)} kPa. Mercury ${fixed(BENCH.depth, 0)} mm deep pushes up with only ${fixed(plan.head / 1000, 2)} kPa, so none gets in: the level would sit ${fixed(-plan.height, 1)} mm down, deeper than the tube is dipped.`;
    const platesHint = `Between two plates, the gap times the height stays the same, so where the wedge’s gap equals the tube’s radius the ${lower} stands exactly as ${plan.height >= 0 ? 'high' : 'deep'}${plan.enters ? `, but it takes 1.5 times as long, 90% of the way in ${timeText(plan.plates90)}` : ''}. Across the wedge its edge traces a hyperbola.`;
    return {
      state: {...plan, now, clock, time, bore, columnTop, tops, inTube},
      readings: [
        r('Your result', status),
        r('Clock', time > 0 ? `${timeText(time)} after dipping` : 'Not yet dipped', 'Time runs on a log scale: each second of playback shows ten times as much time as the one before, from 1 ms to 1,000 s.'),
        r('Tube', !plan.enters ? `Stays out: its level would be ${fixed(-plan.height, 1)} mm down` : time > 0 ? levelText(now.level) : `Its bottom end ${fixed(BENCH.depth, 0)} mm under the ${lower}`, tubeHint),
        r('Plates', !plan.enters ? `Stays out where the gap is ${fixed(plan.radius, 2)} mm` : time > 0 ? `${levelText(now.plateLevel)}, where the gap is ${fixed(plan.radius, 2)} mm` : `Their bottom edge ${fixed(BENCH.depth, 0)} mm under the ${lower}`, platesHint),
        r('Nib', now.filled ? 'Ink up the slit to the vent hole' : time > 0 ? `Ink ${fixed(now.slit, 2)} mm up the slit` : `Dipped ${fixed(NIB.dip, 0)} mm into the ink`, `The slit, ${fixed(NIB.gap, 2)} mm wide at rest, is a pair of plates: it could hold water-based ink ${fixed(plan.holdRest, 0)} mm up, far more than its ${fixed(NIB.slit, 0)} mm to the vent hole, which the ink reaches ${timeText(plan.fill)} after dipping.`),
        r('Press', `${fixed(v.press, 1)} N · tip open ${fixed(plan.tipGap, 2)} mm`, v.press > 0 ? `Pressing splays the tines ${fixed(NIB.compliance, 1)} mm for every newton, an illustrative springiness. The line widens to ${fixed(plan.line, 2)} mm, the slit lets ink through ${fixed(plan.flow, 0)} times as easily, since flow between plates grows with the cube of the gap, and it could still hold ink ${fixed(plan.hold, 0)} mm up.` : `Resting on the paper, the tines stand ${fixed(NIB.gap, 2)} mm apart and leave a line ${fixed(plan.line, 2)} mm wide. Pressing splays them ${fixed(NIB.compliance, 1)} mm for every newton, an illustrative springiness.`),
        r('Liquid', `${name}: ${fixed(plan.liquid.tension * 1000, 2)} mN/m`, `Surface tension ${fixed(plan.liquid.tension * 1000, 2)} mN/m, density ${fixed(plan.liquid.density, plan.liquid.density % 1 ? 2 : 0)} kg/m³, viscosity ${Number((plan.liquid.viscosity * 1000).toFixed(4))} mPa·s, and a contact angle on glass of ${fixed(plan.liquid.angle, 0)}°.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(CLOCK.seconds, clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const at = seconds => { clock = Math.min(CLOCK.seconds, seconds); return render(); };
  result.actions = [
    {label: 'Inspect: the tube and the wedge', part: 'capillary', view: 'front', replay: false, run() { return at(CLOCK.seconds); }},
    {label: 'Inspect: the meniscus', part: 'meniscus', view: 'front', replay: false, run() { return at(CLOCK.seconds); }},
    {label: 'Inspect: the rise over time', part: 'chart', view: 'front', replay: false, run() { return at(CLOCK.seconds); }},
    {label: 'Inspect: the nib in the ink', part: 'nib', view: 'front', replay: false, run() { return at(clockSeconds(result.getState().fill)); }},
    {label: 'Inspect: the tip on the paper', part: 'tip', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Dip',
    description: 'The nib, the tube and the wedge are dipped at once. Time runs on a log scale: each second of playback shows ten times as much time as the one before, from 1 ms to 1,000 s.',
    stepLabel: 'Advance 0.1 s of playback',
    advance: result.advance,
    step: () => result.advance(0.1),
    complete: () => clock >= CLOCK.seconds,
    blocked: () => false,
  };
  result.resultPart = {id: 'capillary', label: 'Inspect the bench', view: 'front', focusOnComplete: false, available: () => clock >= CLOCK.seconds};

  kit.root.rotation.set(0.12, -0.25, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, nib, plate, slitLine, slitInk, holder, well, inkBody, inkTop, tip, tines, gapInk, tipPaper, tipLine, bench, dish, liquidMaterial, surfaceLine, tubeGlass, column, backPlate, frontPlate, sheet, matchMark, meniscus, menWalls, menColumn, tangents, chart, frame, zeroLine, ticks, tubeCurve, platesCurve, tubeCursor, platesCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

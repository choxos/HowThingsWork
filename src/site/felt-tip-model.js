import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, surface} from './scene-kit.js';
import {feltTipPlan, feltTipAt, paceRatio, FELT, FELT_DEFAULTS, FELT_DOMAINS, INK_OPTIONS, INKS} from './pens-physics.js';

// ---------------------------------------------------------------------------
// Felt-tip pen: a marker writing a line and resting at its end, two of the
// pores that carry its ink drawn larger beside it, and a chart of how far ink
// soaks into the paper over time.
//
// Scale: the pen and the paper are drawn at true size, 1 mm to 0.01 scene
// units, with x along the line, y up from the paper and z across it. The
// pores are drawn 200 times larger, and each pore's pull as a bar 5 mm tall
// for every kPa. The chart is not to scale.
//
// Time: the pen moves at the speed you set, in real time, then rests 2 s.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const PORES = 200;
export const KPA = 5;

/** The marker, mm up its axis from the tip: the nib's cone and shank, the core, and the barrel cut open. */
export const PEN = Object.freeze({cone: 3, shank: 1.5, into: 18, core: 3.5, coreFrom: 15, coreTo: 78, neck: 2, neckAt: 6, front: 12, barrel: 5, top: 80});
export const PAPER = Object.freeze({x0: -12, x1: 58, z: 16, thick: 0.1});

/** How far the drawn ink stands above the paper, mm, so it shows; the blot stands a little higher than the line. */
export const FILM = 0.03;

/** The pores close up, mm as drawn: centers `spacing` apart, `tall`, walls, and the pull bars beside them. */
export const CLOSE = Object.freeze({origin: [0.9, 0, 0], spacing: 40, tall: 40, wall: 0.8, gap: 5, bar: 4});
export const CHART = Object.freeze({x: 1.6, y: 0.2, w: 0.8, h: 0.5, z: 0, time: 4, soak: 1, timeTick: 1, soakTick: 0.25, cursor: 0.02, points: 48});
export const COLORS = Object.freeze({inks: Object.freeze([0x2b5d9c, 0x8a3c6f]), chart: 0x374736, faint: 0x9aa39a});

const clampTo = (value, top) => Math.max(0, Math.min(top, value));

/** A point on the chart for a time, s, and a distance soaked, mm, held inside the chart. */
export const chartPoint = (time, soak) => [CHART.x + clampTo(time, CHART.time) / CHART.time * CHART.w, CHART.y + clampTo(soak, CHART.soak) / CHART.soak * CHART.h, CHART.z];

/** A drawn pore's radius, mm, for a pore of `micrometers`. */
export const poreRadius = micrometers => micrometers / 1000 * PORES;

/** The ink in a pore as a profile to turn about its axis: a column of `radius` whose top dips in a hemisphere, as ink that wets the fibers does. */
export function poreProfile(radius, tall, steps = 16) {
  const points = [new THREE.Vector2(0, 0), new THREE.Vector2(radius, 0), new THREE.Vector2(radius, tall)];
  for (let i = 1; i <= steps; i++) {
    const a = i / steps * Math.PI / 2;
    points.push(new THREE.Vector2(radius * Math.cos(a), tall - radius * Math.sin(a)));
  }
  return points;
}

export function createFeltTipModel() {
  const kit = houseModel('Felt-tip pen'), {part, control, finish} = kit;
  const mm = value => value * MM;
  const block = (color, parent) => surface(kit, new THREE.BoxGeometry(1, 1, 1), color, parent);
  const setBox = (mesh, [x0, x1], [y0, y1], [z0, z1]) => {
    mesh.position.set(mm(x0 + x1) / 2, mm(y0 + y1) / 2, mm(z0 + z1) / 2);
    mesh.scale.set(Math.max(1e-9, mm(x1 - x0)), Math.max(1e-9, mm(y1 - y0)), Math.max(1e-9, mm(z1 - z0)));
  };
  const disc = parent => surface(kit, new THREE.CylinderGeometry(1, 1, 1, 48), 'blue', parent);
  const setDisc = (mesh, x, radius, y0, y1) => {
    mesh.position.set(mm(x), mm(y0 + y1) / 2, 0);
    mesh.scale.set(Math.max(1e-9, mm(radius)), Math.max(1e-9, mm(y1 - y0)), Math.max(1e-9, mm(radius)));
    mesh.visible = radius > 0;
  };
  const shell = (top, bottom, height, color, parent) => surface(kit, new THREE.CylinderGeometry(mm(top), mm(bottom), mm(height), 40, 1, true, Math.PI / 2, Math.PI), color, parent, true);

  const system = part('system', 'Felt-tip pen, pores and chart', `A felt-tip pen writing a line and resting at its end, drawn at true size, with two of the pores that carry its ink drawn ${PORES} times larger and a chart of how far ink soaks into the paper. Choose the ink and the writing speed, then press Play.`, [0, 0, 0]);

  // The paper and the ink on it.
  const paper = part('paper', 'Paper and ink', `A corner of the page, drawn at true size. The line is as wide as the ${fixed(FELT.contact, 1)} mm tip plus the ink that soaks past it on each side while the tip passes; where the pen stops, the ink keeps soaking out into a blot. How fast paper drinks ink is illustrative.`, [0, 0, 0], system);
  const sheet = block('cream', paper);
  setBox(sheet, [PAPER.x0, PAPER.x1], [-PAPER.thick, 0], [-PAPER.z, PAPER.z]);
  const line = block('blue', paper);
  const inkMaterial = line.material.clone();
  inkMaterial.side = THREE.DoubleSide;
  line.material = inkMaterial;
  const startCap = disc(paper), endCap = disc(paper), blot = disc(paper);
  for (const mesh of [startCap, endCap, blot]) mesh.material = inkMaterial;

  // The marker, cut open.
  const marker = part('marker', 'Marker', `The pen cut open, drawn at true size: a barrel holding a core of fibers soaked in ink, and a nib of pressed fibers ${fixed(FELT.nib, 0)} mm long that carries the ink from the core to the paper.`, [0, 0, 0], system);
  const pen = new THREE.Group();
  marker.add(pen);
  const nibCone = surface(kit, new THREE.CylinderGeometry(mm(PEN.shank), mm(FELT.contact / 2), mm(PEN.cone), 32), 'blue', pen);
  nibCone.position.y = mm(PEN.cone / 2);
  const nibShank = surface(kit, new THREE.CylinderGeometry(mm(PEN.shank), mm(PEN.shank), mm(PEN.into - PEN.cone), 32), 'blue', pen);
  nibShank.position.y = mm(PEN.into + PEN.cone) / 2;
  const core = surface(kit, new THREE.CylinderGeometry(mm(PEN.core), mm(PEN.core), mm(PEN.coreTo - PEN.coreFrom), 32), 'blue', pen);
  core.position.y = mm(PEN.coreTo + PEN.coreFrom) / 2;
  for (const mesh of [nibCone, nibShank, core]) mesh.material = inkMaterial;
  const neck = shell(PEN.barrel, PEN.neck, PEN.front - PEN.neckAt, 'leaf', pen);
  neck.position.y = mm(PEN.front + PEN.neckAt) / 2;
  const barrel = shell(PEN.barrel, PEN.barrel, PEN.top - PEN.front, 'leaf', pen);
  barrel.position.y = mm(PEN.top + PEN.front) / 2;

  // Two pores, much larger, and how hard each pulls.
  const pores = part('pores', 'Pores, close up', `Two pores cut open and drawn ${PORES} times larger: one ${FELT.reservoirPore} μm in radius, as among the loose fibers of the core, and one ${FELT.nibPore} μm, as in the pressed nib, both illustrative. The ink wets the fibers, so its surface dips in each pore; the tighter the curve, the harder it pulls the ink along. Bars: each pore’s pull, ${KPA} mm tall for every kPa.`, CLOSE.origin, system);
  const poreSizes = [FELT.reservoirPore, FELT.nibPore];
  const poreInks = poreSizes.map((size, i) => {
    const mesh = surface(kit, new THREE.LatheGeometry(poreProfile(mm(poreRadius(size)), mm(CLOSE.tall)), 40, Math.PI / 2, Math.PI), 'blue', pores);
    mesh.material = inkMaterial;
    mesh.position.x = mm(i * CLOSE.spacing);
    return mesh;
  });
  const poreWalls = poreSizes.map((size, i) => {
    const wall = shell(poreRadius(size) + CLOSE.wall, poreRadius(size) + CLOSE.wall, CLOSE.tall, 'metal', pores);
    wall.position.set(mm(i * CLOSE.spacing), mm(CLOSE.tall / 2), 0);
    return wall;
  });
  const bars = poreSizes.map(() => block('clay', pores));

  // The chart: soaking in over time, for both inks.
  const chart = part('chart', 'Soaking in over time', `How far ink soaks into the paper against how long it has been there, from 0 to ${fixed(CHART.time, 0)} s across and 0 to ${fixed(CHART.soak, 0)} mm up, for both inks, the ink in the pen in its own color and the other faint. Soaking goes with the square root of time. The faint upright line marks how long each spot of the line spends under the tip; the cross follows the spot under the tip.`, [0, 0, 0], system);
  const frame = lineObject(5, COLORS.chart, chart);
  fillLine(frame, [chartPoint(0, 0), chartPoint(CHART.time, 0), chartPoint(CHART.time, CHART.soak), chartPoint(0, CHART.soak), chartPoint(0, 0)]);
  const ticks = segmentLines(6, COLORS.faint, chart);
  const tickPoints = [];
  for (let time = CHART.timeTick; time < CHART.time - 1e-9; time += CHART.timeTick) { const [x, y, z] = chartPoint(time, 0); tickPoints.push([x, y, z], [x, y - CHART.cursor, z]); }
  for (let soak = CHART.soakTick; soak < CHART.soak - 1e-9; soak += CHART.soakTick) { const [x, y, z] = chartPoint(0, soak); tickPoints.push([x, y, z], [x - CHART.cursor, y, z]); }
  fillLine(ticks, tickPoints);
  const curves = INKS.map((ink, i) => {
    const curve = lineObject(CHART.points, COLORS.inks[i], chart), pace = FELT.pace * paceRatio(ink);
    fillLine(curve, Array.from({length: CHART.points}, (_, j) => { const time = CHART.time * (j / (CHART.points - 1)) ** 2; return chartPoint(time, pace * Math.sqrt(time)); }));
    return curve;
  });
  const dwellMark = segmentLines(1, COLORS.faint, chart);
  const cursor = segmentLines(2, COLORS.chart, chart);

  control('ink', 'Ink', ...FELT_DOMAINS.ink, FELT_DEFAULTS.ink, '', 'What the ink is made on. Water stands in for a water-based ink and ethanol for an alcohol-based one.', INK_OPTIONS.map(option => ({...option})));
  control('speed', 'Writing speed', ...FELT_DOMAINS.speed, FELT_DEFAULTS.speed, 'mm/s', 'How fast the tip moves along the line.');

  let clock = 0, lastClock = 0, disposed = false;
  const result = finish(values => {
    const plan = feltTipPlan(values), now = feltTipAt(plan, clock), v = plan.values, half = plan.width / 2;
    inkMaterial.color.set(COLORS.inks[v.ink]);

    // The pen over the end of its line, the line, and the blot where it stops.
    pen.position.set(mm(now.travel), 0, 0);
    setBox(line, [0, now.travel], [0, FILM], [-half, half]);
    line.visible = now.travel > 0;
    setDisc(startCap, 0, now.travel > 0 ? half : 0, 0, FILM);
    setDisc(endCap, now.travel, now.travel > 0 ? half : 0, 0, FILM);
    setDisc(blot, FELT.line, now.blot, 0, 1.5 * FILM);

    // Each pore's pull.
    [plan.reservoirPull, plan.nibPull].forEach((pull, i) => {
      const x0 = i * CLOSE.spacing + poreRadius(poreSizes[i]) + CLOSE.wall + CLOSE.gap;
      setBox(bars[i], [x0, x0 + CLOSE.bar], [0, pull / 1000 * KPA], [-CLOSE.bar / 2, CLOSE.bar / 2]);
    });

    // The chart: the ink in the pen in its color, how long a spot is under the tip, and the spot under the tip now.
    curves.forEach((curve, i) => curve.material.color.set(i === v.ink ? COLORS.inks[i] : COLORS.faint));
    fillLine(dwellMark, [chartPoint(plan.dwell, 0), chartPoint(plan.dwell, CHART.soak)]);
    const soakTime = now.rest > 0 ? plan.dwell + now.rest : Math.min(plan.dwell, clock), soaked = plan.pace * Math.sqrt(soakTime), point = chartPoint(soakTime, soaked);
    fillLine(cursor, [[point[0] - CHART.cursor, point[1], CHART.z], [point[0] + CHART.cursor, point[1], CHART.z], [point[0], point[1] - CHART.cursor, CHART.z], [point[0], point[1] + CHART.cursor, CHART.z]]);

    const across = diameter => `${fixed(diameter, 2)} mm across`;
    const status = clock <= 0 ? `Ready · ${fixed(FELT.line, 0)} mm of line at ${fixed(plan.speed, 0)} mm/s; press Play`
      : now.done ? `A line ${fixed(plan.width, 2)} mm wide, ending in a blot ${across(2 * plan.blot)}`
      : now.rest > 0 ? `Resting on the paper · blot ${across(2 * now.blot)}`
      : `Writing · ${fixed(now.travel, 1)} mm of line`;
    return {
      state: {...plan, now, clock, soakTime, soaked},
      readings: [
        r('Your result', status),
        r('Line', `${fixed(plan.width, 2)} mm wide`, `Each spot is under the ${fixed(FELT.contact, 1)} mm tip for ${fixed(plan.dwell, 3)} s, and in that time the ink soaks ${fixed(plan.spread, 3)} mm past the tip on each side. Soaking grows with the square root of time, so writing at half the speed soaks each spot ${fixed(Math.SQRT2, 2)} times as far.`),
        r('Blot', now.rest > 0 ? across(2 * now.blot) : 'None yet: the tip is still moving', `Where the pen stops, ink keeps soaking out from under the tip: after ${fixed(FELT.rest, 0)} s at rest the blot is ${across(2 * plan.blot)}.`),
        r('Nib', `Pulls with ${fixed(plan.nibPull / 1000, 1)} kPa`, `A pore pulls with twice the surface tension over its radius. The nib’s ${FELT.nibPore} μm pores pull ${fixed(plan.nibPull / plan.reservoirPull, 0)} times as hard as the core’s ${FELT.reservoirPore} μm ones, which pull with ${fixed(plan.reservoirPull / 1000, 2)} kPa, so ink leaves the core for the nib, and the paper draws it on. It wicks along the nib’s ${fixed(FELT.nib, 0)} mm in ${fixed(plan.wick, 2)} s.`),
        r('Holding', `Up to ${fixed(plan.hold, 2)} m of ink`, `The nib’s pores could hold up a column of this ink ${fixed(plan.hold, 2)} m tall, far taller than the pen, so the ink’s own weight cannot drain the nib whichever way the pen points.`),
        r('Ink', INK_OPTIONS[v.ink].label, `Surface tension ${fixed(plan.ink.tension * 1000, 2)} mN/m and viscosity ${fixed(plan.ink.viscosity * 1000, 2)} mPa·s. Ink soaks in at a pace that grows with the square root of the one over the other, so the alcohol-based ink soaks in ${fixed(paceRatio(INKS[1]), 2)} times as fast as the water-based one.`),
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
    {label: 'Inspect: the line and the blot', part: 'paper', view: 'top', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the pores', part: 'pores', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: soaking in over time', part: 'chart', view: 'front', replay: false, run() { return inspect(duration()); }},
  ];
  result.playback = {
    label: 'Write',
    description: `The pen writes ${fixed(FELT.line, 0)} mm at the speed you set, in real time, then rests on the paper for ${fixed(FELT.rest, 0)} s.`,
    stepLabel: 'Advance 0.1 s',
    advance: result.advance,
    step: () => result.advance(0.1),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'paper', label: 'Inspect the line and the blot', view: 'top', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.45, -0.35, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, paper, sheet, line, inkMaterial, startCap, endCap, blot, marker, pen, nibCone, nibShank, core, neck, barrel, pores, poreInks, poreWalls, bars, chart, frame, ticks, curves, dwellMark, cursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

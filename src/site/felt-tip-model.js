import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, surface, textLabel} from './scene-kit.js';
import {feltTipPlan, feltTipAt, feltTipPaperAt, paceRatio, FELT, FELT_DEFAULTS, FELT_DOMAINS, INKS} from './pens-physics.js';

// Assigned teaching geometry: 100 mm per scene unit. A square contact makes
// each paper row's exposure explicit. Only transverse spreading is modeled.
export const MM = 0.01;
export const PORES = 200;
export const KPA = 2;
export const PEN = Object.freeze({cone: 3, shank: 1, into: 10, core: 3.5, coreFrom: 10, coreShoulder: 16, coreTo: 78, neck: 1.6, neckAt: 6, front: 14, barrel: 5, top: 80});
export const PAPER = Object.freeze({x0: -12, x1: 58, z: 16, thick: 0.1});
export const FILM = 0.03;
export const STRIPS = 256;
export const CLOSE = Object.freeze({origin: [0.85, 0, 0], spacing: 38, tall: 40, wall: 0.8, gap: 5, bar: 4});
export const CHART = Object.freeze({x: 1.5, y: 0.18, w: 0.8, h: 0.5, z: 0, time: 4.2, soak: 1.1, cursor: 0.016, points: 65});
export const COLORS = Object.freeze({inks: Object.freeze([0x2b5d9c, 0x8a3c6f]), chart: 0x374736, faint: 0x69725c});
export const chartPoint = (time, soak) => [CHART.x + time / CHART.time * CHART.w, CHART.y + soak / CHART.soak * CHART.h, CHART.z];
export const poreRadius = micrometers => micrometers / 1000 * PORES;

/** A local zero-contact-angle meniscus, not a drawing of the equilibrium rise. */
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
    mesh.scale.set(mm(x1 - x0), mm(y1 - y0), mm(z1 - z0));
  };
  const shell = (top, bottom, height, color, parent, front = false) => surface(kit, new THREE.CylinderGeometry(mm(top), mm(bottom), mm(height), 40, 1, true, front ? -Math.PI / 2 : Math.PI / 2, Math.PI), color, parent, true);
  const system = part('system', 'Marker and capillary experiments', 'A primed marker writes a 40 mm stroke. Inspect its connected porous core and nib, the ink on the page, or the separate enlarged pore and paper charts. Geometry and paper absorption are assigned teaching examples.', [0, 0, 0]);
  const paper = part('paper', 'Paper and ink', 'A 1 mm square tip moves along the page. Each row gains ink when the tip arrives. Sideways spread grows only for that row’s actual contact time. The marked end row is 40 mm from the starting center. This is a bounded illustration, not a prediction of a real stain.', [0, 0, 0], system);
  const sheet = block('cream', paper);
  setBox(sheet, [PAPER.x0, PAPER.x1], [-PAPER.thick, 0], [-PAPER.z, PAPER.z]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((STRIPS + 1) * 6), 3));
  const indices = [];
  for (let i = 0; i < STRIPS; i++) {const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);}
  geometry.setIndex(indices);
  const line = surface(kit, geometry, 'blue', paper, true), inkMaterial = line.material.clone();
  inkMaterial.side = THREE.DoubleSide; line.material = inkMaterial;
  const endMark = segmentLines(2, COLORS.chart, paper);
  fillLine(endMark, [[.4, .0005, -.04], [.4, .0005, -.025], [.4, .0005, .025], [.4, .0005, .04]]);

  const carriage = new THREE.Group(); system.add(carriage);
  const barrel = part('barrel', 'Barrel and rear plug', 'The barrel supports the nib and holds the porous reservoir. Look inside removes the front half. A small vent in the rear plug admits replacement air. The removable storage cap is outside this writing experiment.', [0, 0, 0], carriage);
  const bodyBack = shell(PEN.barrel, PEN.barrel, PEN.top - PEN.front, 'leaf', barrel);
  const bodyFront = shell(PEN.barrel, PEN.barrel, PEN.top - PEN.front, 'leaf', barrel, true);
  for (const mesh of [bodyBack, bodyFront]) mesh.position.y = mm(PEN.top + PEN.front) / 2;
  const neckBack = shell(PEN.barrel, PEN.neck, PEN.front - PEN.neckAt, 'leaf', barrel);
  const neckFront = shell(PEN.barrel, PEN.neck, PEN.front - PEN.neckAt, 'leaf', barrel, true);
  for (const mesh of [neckBack, neckFront]) mesh.position.y = mm(PEN.front + PEN.neckAt) / 2;
  const holderShape = new THREE.Shape(); holderShape.absarc(0, 0, mm(PEN.neck), 0, Math.PI * 2, false);
  const holderHole = new THREE.Path(); holderHole.moveTo(-.01, -.01); holderHole.lineTo(-.01, .01); holderHole.lineTo(.01, .01); holderHole.lineTo(.01, -.01); holderHole.closePath(); holderShape.holes.push(holderHole);
  const nibHolder = surface(kit, new THREE.ExtrudeGeometry(holderShape, {depth: .008, bevelEnabled: false, curveSegments: 32}), 'leaf', barrel);
  nibHolder.rotation.x = Math.PI / 2; nibHolder.position.y = .068;
  const plugProfile = [[.4, 79], [.4, 81], [5, 81], [5, 79], [.4, 79]].map(([x, y]) => new THREE.Vector2(mm(x), mm(y)));
  const rearPlug = surface(kit, new THREE.LatheGeometry(plugProfile, 40), 'leaf', barrel);
  const reservoir = part('reservoir', 'Porous ink reservoir', 'Ink occupies connected spaces among fibers. The tapered end meets the nib at 10 mm above the paper. Sparse visible strands indicate fibers; their spacing is not a pore-size measurement.', [0, 0, 0], carriage);
  const coreProfile = [[0, PEN.coreFrom], [1.5, PEN.coreFrom], [PEN.core, PEN.coreShoulder], [PEN.core, PEN.coreTo], [0, PEN.coreTo]].map(([x, y]) => new THREE.Vector2(mm(x), mm(y)));
  const core = surface(kit, new THREE.LatheGeometry(coreProfile, 40), 'blue', reservoir);
  core.material = inkMaterial;
  const nib = part('nib', 'Porous writing nib', 'The nib has a 1 mm square paper contact and widens to a 2 mm square shank. Its path from reservoir contact to paper is 10 mm. This primed nib is already wet; the separate filling estimate describes an initially dry ideal pore.', [0, 0, 0], carriage);
  const nibCone = surface(kit, new THREE.CylinderGeometry(mm(Math.SQRT2), mm(Math.SQRT1_2), mm(PEN.cone), 4), 'blue', nib);
  nibCone.rotation.y = Math.PI / 4; nibCone.position.y = mm(PEN.cone / 2); nibCone.material = inkMaterial;
  const nibShank = block('blue', nib); nibShank.material = inkMaterial;
  setBox(nibShank, [-1, 1], [PEN.cone, PEN.into], [-1, 1]);
  const coreFibers = segmentLines(10, 0x8cabc1, reservoir);
  fillLine(coreFibers, Array.from({length: 10}, (_, i) => {
    const a = (i + .5) / 10 * 2 * Math.PI;
    return [[mm(3.51 * Math.cos(a)), mm(PEN.coreShoulder), mm(3.51 * Math.sin(a))], [mm(3.51 * Math.cos(a)), mm(PEN.coreTo), mm(3.51 * Math.sin(a))]];
  }).flat());
  const nibFibers = segmentLines(6, 0x8cabc1, nib);
  fillLine(nibFibers, Array.from({length: 3}, (_, i) => [-1, 1].map(sign => [[mm((i - 1) * .6), mm(PEN.cone), sign * .0101], [mm((i - 1) * .6), mm(PEN.into), sign * .0101]])).flat(2));

  const pores = part('pores', 'Pores and capillary pressure', `Local menisci drawn ${PORES} times larger. Core radius is 50 μm; choose the nib radius. Each pressure bar is ${KPA} mm tall for every kPa. Smaller ideal pores give more capillary pressure but more resistance and a longer filling time. These short samples do not depict equilibrium rise.`, CLOSE.origin, system);
  const poreInks = [0, 1].map(() => {const mesh = surface(kit, new THREE.BufferGeometry(), 'blue', pores); mesh.material = inkMaterial; return mesh;});
  const poreWalls = [0, 1].map(() => shell(1, 1, CLOSE.tall, 'metal', pores));
  const bars = [0, 1].map(() => block('clay', pores));
  ['Core: 50 μm', 'Nib: selected radius'].forEach((word, i) => textLabel(pores, word, {height: .032, position: [mm(i * CLOSE.spacing), -.055, .001]}));
  textLabel(pores, 'Capillary pressure', {height: .035, position: [.19, .66, .001]});
  let lastPore = null;

  const chart = part('chart', 'Paper contact-time chart', 'Sideways spread beyond the square tip against local feeding time. Both assigned reference fluids remain visible. The cross follows the marked end row, which stays dry until the tip reaches it, then is fed for half a transit time plus the selected hold. This is a paper example, separate from ideal nib filling.', [0, 0, 0], system);
  const frame = lineObject(5, COLORS.chart, chart);
  fillLine(frame, [chartPoint(0, 0), chartPoint(CHART.time, 0), chartPoint(CHART.time, CHART.soak), chartPoint(0, CHART.soak), chartPoint(0, 0)]);
  const curves = INKS.map((ink, i) => {
    const curve = lineObject(CHART.points, COLORS.inks[i], chart), pace = FELT.pace * paceRatio(ink);
    fillLine(curve, Array.from({length: CHART.points}, (_, j) => {const time = CHART.time * (j / (CHART.points - 1)) ** 2; return chartPoint(time, pace * Math.sqrt(time));}));
    return curve;
  });
  const dwellMark = segmentLines(1, COLORS.faint, chart), cursor = segmentLines(2, COLORS.chart, chart);
  chartText(chart, chartPoint, {title: 'Spread while fed', size: .04, x: {min: 0, max: CHART.time, title: 'Local contact time (s)', ticks: [0, 1, 2, 3, 4].map(x => [x, String(x)])}, y: {min: 0, max: CHART.soak, title: 'Sideways spread (mm)', ticks: [0, .5, 1].map(y => [y, fixed(y, 1)])}});
  ['Water reference', 'Ethanol reference'].forEach((word, i) => textLabel(chart, word, {height: .035, align: 'left', color: `#${COLORS.inks[i].toString(16)}`, position: [CHART.x + .06, CHART.y + CHART.h + .11 + i * .055, .001]}));

  control('ink', 'Reference fluid', ...FELT_DOMAINS.ink, FELT_DEFAULTS.ink, '', 'Assigned water and ethanol properties illustrate capillary scaling. They do not predict every commercial ink.', [{value: 0, label: 'Water reference'}, {value: 1, label: 'Ethanol reference'}]);
  control('speed', 'Writing speed', ...FELT_DOMAINS.speed, FELT_DEFAULTS.speed, 'mm/s', 'Faster travel gives each interior row less feeding time.');
  control('hold', 'Hold at the end', ...FELT_DOMAINS.hold, FELT_DEFAULTS.hold, 's', 'How long the tip remains at the end after its 40 mm stroke.');
  control('pore', 'Nib pore radius', ...FELT_DOMAINS.pore, FELT_DEFAULTS.pore, 'μm', 'Compare local pressure and ideal dry-pore filling time. The separate paper model assumes sufficient ink supply.');

  let clock = 0, lastClock = 0, disposed = false;
  const result = finish(values => {
    const plan = feltTipPlan(values); clock = Math.min(clock, plan.duration);
    const now = feltTipAt(plan, clock), v = plan.values;
    inkMaterial.color.set(COLORS.inks[v.ink]); carriage.position.x = mm(now.travel);
    const positions = line.geometry.attributes.position, x0 = -FELT.contact / 2, x1 = now.travel + FELT.contact / 2;
    for (let i = 0; i <= STRIPS; i++) {
      const x = x0 + (x1 - x0) * i / STRIPS, half = feltTipPaperAt(plan, clock, x).width / 2;
      positions.setXYZ(2 * i, mm(x), mm(FILM), -mm(half)); positions.setXYZ(2 * i + 1, mm(x), mm(FILM), mm(half));
    }
    positions.needsUpdate = true; line.geometry.computeVertexNormals(); line.geometry.computeBoundingBox(); line.geometry.computeBoundingSphere(); line.visible = clock > 0;
    if (lastPore !== v.pore) {
      [FELT.reservoirPore, v.pore].forEach((size, i) => {
        poreInks[i].geometry.dispose(); poreInks[i].geometry = new THREE.LatheGeometry(poreProfile(mm(poreRadius(size)), mm(CLOSE.tall)), 40, Math.PI / 2, Math.PI);
        poreInks[i].position.x = mm(i * CLOSE.spacing);
        poreWalls[i].scale.set(poreRadius(size) + CLOSE.wall, 1, poreRadius(size) + CLOSE.wall);
        poreWalls[i].position.set(mm(i * CLOSE.spacing), mm(CLOSE.tall / 2), 0);
      }); lastPore = v.pore;
    }
    [plan.reservoirPull, plan.nibPull].forEach((pull, i) => {
      const x = i * CLOSE.spacing + poreRadius(i ? v.pore : FELT.reservoirPore) + CLOSE.wall + CLOSE.gap;
      setBox(bars[i], [x, x + CLOSE.bar], [0, pull / 1000 * KPA], [-CLOSE.bar / 2, CLOSE.bar / 2]);
    });
    fillLine(dwellMark, [chartPoint(plan.dwell, 0), chartPoint(plan.dwell, CHART.soak)]);
    const soakTime = now.end.exposure, soaked = plan.pace * Math.sqrt(soakTime), point = chartPoint(soakTime, soaked);
    fillLine(cursor, [[point[0] - CHART.cursor, point[1], 0], [point[0] + CHART.cursor, point[1], 0], [point[0], point[1] - CHART.cursor, 0], [point[0], point[1] + CHART.cursor, 0]]);
    const status = clock === 0 ? 'Ready · primed nib; press Play' : now.done ? 'Complete · inspect the line and end stain' : now.rest > 0 ? `Holding · ${fixed(now.rest, 2)} s at the end` : `Writing · ${fixed(now.travel, 1)} mm traveled`;
    return {state: {...plan, now, clock, soakTime, soaked}, readings: [
      r('Your result', status),
      r('Interior line', now.middle.wet ? `${fixed(now.middle.width, 2)} mm at the middle row` : 'Middle row still dry', `After a full pass: ${fixed(plan.width, 2)} mm, including the 1 mm contact. Each interior row is fed for ${fixed(plan.dwell, 3)} s; the assigned sideways spread is ${fixed(plan.spread, 3)} mm per side. Start and end rows have different histories.`),
      r('End row', now.end.wet ? `${fixed(now.end.width, 2)} mm wide · ${fixed(soakTime, 3)} s fed` : 'Tip has not reached the marked row', `Final width: ${fixed(plan.endWidth, 2)} mm after ${v.hold} s holding. The center of the end footprint receives half a transit time before the hold, not a full transit time. The chart cross follows this row.`),
      r('Capillary pressure', `${fixed(plan.nibPull / 1000, 2)} kPa in the nib pore`, `Core reference: ${fixed(plan.reservoirPull / 1000, 2)} kPa. For a fully wetting cylindrical pore, pressure is 2γ/r. These are local meniscus comparisons, not the net pressure across the assembled marker.`),
      r('Ideal dry-pore filling', `${fixed(plan.wick, 3)} s along 10 mm`, 'Washburn filling neglects gravity and inertia: time = 2ηL²/(γr). A smaller pore has stronger suction but takes longer to fill the same length. The writing nib starts primed; this estimate does not delay the stroke.'),
      r('Reference fluid', v.ink === 0 ? 'Water reference' : 'Ethanol reference', `Assigned γ = ${fixed(plan.ink.tension * 1000, 2)} mN/m, η = ${fixed(plan.ink.viscosity * 1000, 4)} mPa·s and complete wetting. Paper spread coefficient: ${fixed(plan.pace, 3)} mm/√s. Real ink additives, paper structure and contact angle can change the comparison.`),
    ]};
  });
  const render = result.update, duration = () => result.getState().duration;
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), Number((clock + dt).toFixed(12))); return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = (initial = {}) => {const settings = {...result.defaults, ...(initial.settings || {})}; const plan = feltTipPlan(settings); clock = Number.isFinite(initial.time) ? Math.max(0, Math.min(plan.duration, initial.time)) : 0; lastClock = 0; return render(settings);};
  result.replayState = () => ({settings: result.getState().values, time: 0});
  result.actions = [['Inspect: complete experiment', 'system'], ['Inspect: barrel', 'barrel'], ['Inspect: porous reservoir', 'reservoir'], ['Inspect: writing nib', 'nib'], ['Inspect: paper and ink', 'paper'], ['Inspect: capillary pores', 'pores'], ['Inspect: contact-time chart', 'chart']].map(([label, part]) => ({label, part, view: part === 'paper' ? 'top' : 'front', isolate: true, replay: false, run: () => render()}));
  result.playback = {label: 'Write', description: 'Write 40 mm at the selected speed, then hold for the selected time.', stepLabel: 'Advance 0.1 s', advance: result.advance, step: () => result.advance(.1), complete: () => clock >= duration(), blocked: () => false};
  result.resultPart = {id: 'paper', label: 'Inspect the ink on paper', view: 'top', focusOnComplete: false, available: () => clock >= duration()};
  result.covers.push(bodyFront, neckFront); result.initialCutaway = true;
  result.catalogParts = result.parts.filter(p => p.id !== 'system');
  result.controls.find(c => c.key === 'ink').primary = true;
  for (const object of [paper, pores, chart]) object.userData.explosionExcluded = true;
  pores.userData.inspectionOnly = 'pores'; chart.userData.inspectionOnly = 'chart';
  for (const object of [barrel, reservoir, nib]) object.userData.explosionCategory = true;
  result.thumbnailOmit = [paper, pores, chart]; result.followParts = ['barrel', 'reservoir', 'nib'];
  result.partViewDirections = Object.fromEntries(result.parts.map(p => [p.id, {front: [0, .2, 3]}]));
  result.partViewDirections.system.front = [0, .9, 3];
  result.partViewDirections.chart.front = [0, 0, 3]; result.partViewDirections.pores.front = [0, 0, 3];
  result.parts.find(p => p.id === 'nib').maxZoom = 150;
  result.frameBoundsForPart = id => id === 'system' ? new THREE.Box3(new THREE.Vector3(-.12, -.01, -.16), new THREE.Vector3(.58, .82, .16)).applyMatrix4(kit.root.matrixWorld) : null;
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .62;
  result.selectionOutline = false; result.transparentBackground = true;
  result.topology = {system, paper, sheet, line, inkMaterial, endMark, carriage, barrel, bodyBack, bodyFront, neckBack, neckFront, nibHolder, rearPlug, reservoir, core, coreFibers, nib, nibCone, nibShank, nibFibers, pores, poreInks, poreWalls, bars, chart, frame, curves, dwellMark, cursor};
  const dispose = result.dispose; result.dispose = () => {if (!disposed) {disposed = true; dispose();}};
  return result;
}

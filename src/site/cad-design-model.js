import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines} from './scene-kit.js';
import {
  designPlan, designAt, polygonPerimeter, chordError, stlBytes, STL, SLICING, MARLIN,
  DESIGN, DESIGN_DEFAULTS, DESIGN_DOMAINS,
} from './printing-physics.js';

// ---------------------------------------------------------------------------
// Computer aided design: a round cup described by its surface as triangles, the
// chord a flat facet leaves across a curve, the bytes a file spends on one
// triangle, and what a slicer makes of the shape.
//
// Scale: the cup is drawn at true size, 1 mm to 0.04 scene units. One facet
// against the arc it stands in for is drawn 100 times larger, 1 mm to 4 units.
// One layer's toolpath is drawn 3 times larger, 1 mm to 0.12 units, as a
// straight span of the wall rather than the whole ring, which at any useful
// magnification would be wider than the bench. The byte record and the charts
// are not to scale.
//
// A range spanning decades is drawn on its logarithm: the chord error falls
// from about 0.9 mm at 8 facets to about 0.004 mm at 128, a factor of 250, so
// the chart of it is drawn on a logarithmic height. This is said here, in the
// part text and in a reading.
//
// Time: the construction is an explanation of three digital operations, not a
// machine cutting anything, and it runs over 9 seconds.
// ---------------------------------------------------------------------------

export const CUP = 0.04;
export const FACET = 4;
export const PATHVIEW = 0.12;

/** How many times larger than true size a scale in units per mm draws. */
export const timesLarger = perMm => perMm / CUP;

export const SOLID = Object.freeze({origin: Object.freeze([-1.72, 0.18, 0]), lift: 0.62, fan: 132, elevation: 0.5});
export const FACETVIEW = Object.freeze({origin: Object.freeze([-0.18, 0.62, 0]), arc: 80, reach: 0.34});
export const FILEVIEW = Object.freeze({origin: Object.freeze([-0.18, -0.34, 0]), width: 1.28, high: 0.16, gap: 0.006});
export const SLICEVIEW = Object.freeze({origin: Object.freeze([1.18, 0.56, 0]), width: 1.5, high: 0.62, lines: 130});
export const PATHV = Object.freeze({origin: Object.freeze([1.18, -0.3, 0]), span: 8, fill: 70});
export const CHART = Object.freeze({x: 0.3, y: -1.04, w: 1.64, h: 0.4, top: 0.88, z: 0, samples: 61, decades: Object.freeze([-2.5, 0]), cursor: 0.02});
export const COLORS = Object.freeze({solid: 0x83b4c1, wall: 0x91aa7e, arc: 0x9aa39a, chord: 0x2b5d9c, error: 0xc14f39, grid: 0x374736, faint: 0x9aa39a, header: 0xce825f, normal: 0xe3b45e, vertex: 0x83b4c1, attribute: 0x8f989b, layerLine: 0xb4c5b0, bead: 0x374736, infill: 0xd99a2b, paper: 0xf0dfaf, sketch: 0xd99a2b});

/** Where a facet count and a chord error in mm fall on the logarithmic chart. */
export const chartX = facets => CHART.x + (facets - DESIGN_DOMAINS.facets[0]) / (DESIGN_DOMAINS.facets[1] - DESIGN_DOMAINS.facets[0]) * CHART.w;
export const chartY = error => {
  const [lo, hi] = CHART.decades, decade = Math.log10(Math.max(1e-9, error));
  return CHART.y + Math.max(0, Math.min(1, (decade - lo) / (hi - lo))) * CHART.top * CHART.h;
};

/** The corners of a regular polygon of `facets` sides standing on a circle of `radius`, as [x, y] in mm. */
export function polygonPoints(radius, facets, turn = 0) {
  return Array.from({length: facets + 1}, (_, k) => {
    const a = turn + 2 * Math.PI * (k % facets) / facets;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });
}

export function createCADDesignModel() {
  const kit = houseModel('Computer-aided design'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownFile = '';
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const frameLine = (line, x, y, w, h, z = 0) => fillLine(line, [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]]);

  const system = part('system', 'A shape held as numbers', 'A round cup described by its surface, drawn at true size, with the facets a curve becomes, the bytes one triangle costs, and what a slicer makes of the shape. Press Play to build it: a sketch, then the wall rising, then the pocket sinking. None of this cuts anything; it is arithmetic about a shape.');

  // The cup at true size: a plan above and an elevation below.
  const solid = part('solid', 'The cup, true size', `The shape the design describes, drawn at true size, 1 mm to ${CUP} scene units. Above is the plan looking down: the outer curve and the pocket inside it, each a ring of straight facets rather than a true circle. Below is a section through the middle, showing the wall, the floor and the height.`, SOLID.origin, system);
  const outerPlan = lineObject(SOLID.fan + 1, COLORS.grid, solid), innerPlan = lineObject(SOLID.fan + 1, COLORS.wall, solid);
  const truePlan = lineObject(SOLID.fan + 1, COLORS.arc, solid);
  const sketchLine = lineObject(SOLID.fan + 1, COLORS.sketch, solid);
  const wallLeft = flat(COLORS.solid, solid), wallRight = flat(COLORS.solid, solid), floorBlock = flat(COLORS.wall, solid);
  const elevationFrame = lineObject(5, COLORS.faint, solid);

  // One facet against the arc it replaces.
  const facetPart = part('facet', 'One facet, 100 times larger', `A single facet against the arc it stands in for, drawn ${fixed(timesLarger(FACET), 0)} times larger. The gray curve is the circle the design means; the blue line is the flat facet the surface actually carries. The red bar between them at the middle is the chord error, and it is the sagitta of half a facet's arc: the radius times one minus the cosine of half the angle a facet spans.`, FACETVIEW.origin, system);
  const trueArc = lineObject(FACETVIEW.arc + 1, COLORS.arc, facetPart);
  const chordLine = segmentLines(1, COLORS.chord, facetPart);
  const errorBar = segmentLines(1, COLORS.error, facetPart);
  const facetRadii = segmentLines(2, COLORS.faint, facetPart);

  // One triangle's record in a binary file.
  const filePart = part('file', 'One triangle in the file', `What a binary file spends on a single triangle: ${STL.floats} numbers of ${STL.floatBytes} bytes each, ${fixed(STL.floats * STL.floatBytes, 0)} bytes, plus ${STL.attribute} more. Three of those numbers are the direction the face points and nine are the three corners. Ahead of every triangle the file carries an ${STL.header} byte header and a ${STL.count} byte count. Not to scale against the whole file.`, FILEVIEW.origin, system);
  const fileBlocks = [];
  for (let k = 0; k < STL.floats + 1; k++) fileBlocks.push(flat(k < 3 ? COLORS.normal : k < STL.floats ? COLORS.vertex : COLORS.attribute, filePart));
  const fileFrame = lineObject(5, COLORS.grid, filePart);
  const fileGroups = segmentLines(3, COLORS.grid, filePart);

  // The layers the slicer cuts.
  const slice = part('slice', 'The layers the slicer cuts', 'The finished shape cut into flat layers, seen from the side. Every line is one layer; the slicer walks the tool round each of them in turn. A shorter layer height makes more of them and a finer staircase up the outside, and nothing at all to the detail around the shape.', SLICEVIEW.origin, system);
  const sliceFrame = lineObject(5, COLORS.grid, slice);
  const sliceOutline = lineObject(9, COLORS.grid, slice);
  const sliceLines = segmentLines(SLICEVIEW.lines, COLORS.layerLine, slice);
  const sliceCursor = segmentLines(1, COLORS.infill, slice);

  // One layer's toolpath.
  const pathPart = part('path', 'One layer, 3 times larger', `A straight span of one layer of the wall, drawn ${fixed(timesLarger(PATHVIEW), 0)} times larger and seen from above: the loops the tool walks in from each face, laid side by side, and the infill hatching whatever they leave between them. A bead is not a rectangle; it is one with a rounded end each side, which is why two of them side by side measure less than twice one.`, PATHV.origin, system);
  const wallBand = flat(COLORS.paper, pathPart);
  const pathLoops = [];
  for (let k = 0; k < DESIGN_DOMAINS.perimeters[1] * 2; k++) pathLoops.push(lineObject(2, k % 2 ? COLORS.wall : COLORS.bead, pathPart));
  const infillLines = segmentLines(PATHV.fill, COLORS.infill, pathPart);

  // Chord error against facet count.
  const chart = part('chart', 'What facets cost', `How far the flat facets fall from the curve as more of them are used, from ${DESIGN_DOMAINS.facets[0]} to ${DESIGN_DOMAINS.facets[1]}. The error falls by a factor of about 250 across that range, so the height of this chart is drawn on its logarithm and the reading carries the real figure.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.grid, chart);
  const errorCurve = lineObject(CHART.samples, COLORS.chord, chart);
  const nozzleLine = segmentLines(1, COLORS.error, chart);
  const chartCursor = segmentLines(2, COLORS.grid, chart);

  const d = DESIGN_DEFAULTS;
  control('radius', 'Outer radius', ...DESIGN_DOMAINS.radius, d.radius, 'mm', 'How wide the cup is. A larger circle drawn with the same number of facets falls further from the curve, because the error grows with the radius.');
  control('facets', 'Facets', ...DESIGN_DOMAINS.facets, d.facets, '', 'How many flat sides stand in for each circle. The surface is only ever triangles, so a curve is always an approximation; more facets bring it closer and cost more of them.');
  control('height', 'Height', ...DESIGN_DOMAINS.height, d.height, 'mm', 'How tall the cup is, which sets how many layers it takes.');
  control('wall', 'Wall', ...DESIGN_DOMAINS.wall, d.wall, 'mm', 'How thick the wall and the floor are. The pocket is what is left inside.');
  control('layer', 'Layer height', ...DESIGN_DOMAINS.layer, d.layer, 'mm', 'How tall each slice is. A nozzle cannot lay a layer taller than about four fifths of its own diameter.');
  control('width', 'Bead width', ...DESIGN_DOMAINS.width, d.width, 'mm', 'How wide a line the tool lays. It sets how much of the wall each loop fills.');
  control('perimeters', 'Loops', ...DESIGN_DOMAINS.perimeters, d.perimeters, '', 'How many loops to walk round each layer before filling. Strength comes mostly from these rather than from the infill.');
  control('infill', 'Infill', ...DESIGN_DOMAINS.infill, d.infill, '%', 'How much of what the loops leave is filled in. Nothing at all leaves the shape hollow.');

  const result = finish(v => {
    const plan = designPlan(v), now = designAt(plan, clock);

    // The cup: plan above, section below.
    const turn = Math.PI / plan.facets;
    const toPlan = ([x, y]) => [x * CUP, y * CUP + SOLID.lift, 0.001];
    fillLine(truePlan, Array.from({length: SOLID.fan + 1}, (_, k) => { const a = 2 * Math.PI * k / SOLID.fan; return toPlan([plan.radius * Math.cos(a), plan.radius * Math.sin(a)]); }));
    const outer = polygonPoints(plan.radius, plan.facets, turn);
    fillLine(outerPlan, now.risen > 0 || now.sketch >= 1 ? outer.map(toPlan) : []);
    fillLine(innerPlan, plan.inner > 0 && now.sunk > 0 ? polygonPoints(plan.inner, plan.facets, turn).map(toPlan) : []);
    fillLine(sketchLine, now.sketch < 1 ? outer.slice(0, Math.max(2, now.drawn + 1)).map(toPlan) : []);
    const halfW = plan.radius * CUP, base = -SOLID.elevation;
    rect(wallLeft, -halfW, -plan.inner * CUP, base, base + now.outerHeight * CUP, 0);
    rect(wallRight, plan.inner * CUP, halfW, base, base + now.outerHeight * CUP, 0);
    rect(floorBlock, -plan.inner * CUP, plan.inner * CUP, base, base + Math.max(0, now.outerHeight - now.pocketDepth) * CUP, 0);
    wallLeft.visible = wallRight.visible = floorBlock.visible = now.outerHeight > 1e-9;
    frameLine(elevationFrame, -halfW, base, 2 * halfW, Math.max(1e-6, plan.height * CUP), -0.001);

    // One facet against its arc.
    const span = 2 * Math.PI / plan.facets, reach = FACETVIEW.reach, unit = reach / Math.max(1e-9, plan.radius * (1 - Math.cos(span / 2)) + plan.radius * Math.sin(span / 2));
    const drawR = plan.radius * unit;
    fillLine(trueArc, Array.from({length: FACETVIEW.arc + 1}, (_, k) => {
      const a = -span / 2 + span * k / FACETVIEW.arc;
      return [drawR * Math.sin(a), drawR * Math.cos(a) - drawR, 0.001];
    }));
    const chordY0 = drawR * Math.cos(span / 2) - drawR, edge = drawR * Math.sin(span / 2);
    fillLine(chordLine, [[-edge, chordY0, 0.002], [edge, chordY0, 0.002]]);
    fillLine(errorBar, [[0, chordY0, 0.003], [0, 0, 0.003]]);
    // Stubs toward the center, not the whole radius: the center of a finely
    // faceted circle lies far below the arc and would swamp the bench.
    fillLine(facetRadii, [[-edge, chordY0, 0.001], [-edge * 0.6, chordY0 - FACETVIEW.reach * 0.5, 0.001], [edge, chordY0, 0.001], [edge * 0.6, chordY0 - FACETVIEW.reach * 0.5, 0.001]]);

    // One triangle's bytes.
    const fileKey = 'one';
    if (shownFile !== fileKey) {
      shownFile = fileKey;
      const cells = STL.floats + 1, totalBytes = STL.floats * STL.floatBytes + STL.attribute;
      let cursor = -FILEVIEW.width / 2;
      fileBlocks.forEach((block, k) => {
        const bytes = k < STL.floats ? STL.floatBytes : STL.attribute;
        const wide = FILEVIEW.width * bytes / totalBytes - FILEVIEW.gap;
        rect(block, cursor, cursor + wide, -FILEVIEW.high / 2, FILEVIEW.high / 2, 0.001);
        cursor += wide + FILEVIEW.gap;
      });
      frameLine(fileFrame, -FILEVIEW.width / 2, -FILEVIEW.high / 2, FILEVIEW.width, FILEVIEW.high, 0);
      const at = index => -FILEVIEW.width / 2 + FILEVIEW.width * index * STL.floatBytes / totalBytes;
      fillLine(fileGroups, [[at(3), -FILEVIEW.high / 2 - 0.03, 0.002], [at(3), FILEVIEW.high / 2 + 0.03, 0.002],
        [at(6), -FILEVIEW.high / 2 - 0.03, 0.002], [at(6), FILEVIEW.high / 2 + 0.03, 0.002],
        [at(9), -FILEVIEW.high / 2 - 0.03, 0.002], [at(9), FILEVIEW.high / 2 + 0.03, 0.002]]);
      void cells;
    }

    // The layers.
    const sw = SLICEVIEW.width, sh = SLICEVIEW.high, perMm = sh / Math.max(1e-9, plan.height);
    frameLine(sliceFrame, -sw / 2, -sh / 2, sw, sh, 0);
    fillLine(sliceOutline, [[-sw / 2 + 0.06, -sh / 2, 0.001], [sw / 2 - 0.06, -sh / 2, 0.001], [sw / 2 - 0.06, sh / 2, 0.001], [sw / 2 - 0.06 - 0.12, sh / 2, 0.001], [sw / 2 - 0.06 - 0.12, -sh / 2 + plan.base * perMm, 0.001], [-sw / 2 + 0.06 + 0.12, -sh / 2 + plan.base * perMm, 0.001], [-sw / 2 + 0.06 + 0.12, sh / 2, 0.001], [-sw / 2 + 0.06, sh / 2, 0.001], [-sw / 2 + 0.06, -sh / 2, 0.001]]);
    const lines = [];
    for (let k = 1; k <= plan.layers && lines.length < 2 * SLICEVIEW.lines; k++) {
      const y = -sh / 2 + Math.min(plan.height, k * plan.layer) * perMm;
      lines.push([-sw / 2 + 0.06, y, 0.002], [sw / 2 - 0.06, y, 0.002]);
    }
    fillLine(sliceLines, lines);
    const shownLayer = -sh / 2 + Math.min(plan.height, plan.base + plan.layer) * perMm;
    fillLine(sliceCursor, [[-sw / 2 + 0.02, shownLayer, 0.003], [sw / 2 - 0.02, shownLayer, 0.003]]);

    // One layer's toolpath, as a straight span across the wall.
    const spanMm = PATHV.span, wallHalf = plan.wall / 2;
    rect(wallBand, -spanMm / 2 * PATHVIEW, spanMm / 2 * PATHVIEW, -wallHalf * PATHVIEW, wallHalf * PATHVIEW, 0);
    pathLoops.forEach((loop, k) => {
      const outward = k < plan.perimeters, index = outward ? k : k - plan.perimeters;
      if (index >= plan.perimeters) { fillLine(loop, []); return; }
      const offset = outward ? wallHalf - (index + 0.5) * plan.width : -wallHalf + (index + 0.5) * plan.width;
      if (Math.abs(offset) > wallHalf) { fillLine(loop, []); return; }
      fillLine(loop, [[-spanMm / 2 * PATHVIEW, offset * PATHVIEW, 0.002], [spanMm / 2 * PATHVIEW, offset * PATHVIEW, 0.002]]);
    });
    const fills = [];
    if (plan.infill > 0 && plan.gap > 0) {
      const step = plan.width * 100 / plan.infill, gapHalf = plan.gap / 2;
      for (let x = -spanMm / 2 + step / 2; x < spanMm / 2 && fills.length < 2 * PATHV.fill; x += step) {
        fills.push([x * PATHVIEW, -gapHalf * PATHVIEW, 0.003], [x * PATHVIEW, gapHalf * PATHVIEW, 0.003]);
      }
    }
    fillLine(infillLines, fills);

    // The chart.
    frameLine(chartFrame, CHART.x, CHART.y, CHART.w, CHART.h, CHART.z);
    fillLine(errorCurve, Array.from({length: CHART.samples}, (_, k) => {
      const n = DESIGN_DOMAINS.facets[0] + (DESIGN_DOMAINS.facets[1] - DESIGN_DOMAINS.facets[0]) * k / (CHART.samples - 1);
      return [chartX(n), chartY(chordError(plan.radius, n)), CHART.z];
    }));
    fillLine(nozzleLine, [[CHART.x, chartY(plan.layer), CHART.z], [CHART.x + CHART.w, chartY(plan.layer), CHART.z]]);
    const cx = chartX(plan.facets), cy = chartY(plan.outerError);
    fillLine(chartCursor, [[cx - CHART.cursor, cy, CHART.z], [cx + CHART.cursor, cy, CHART.z], [cx, cy - CHART.cursor, CHART.z], [cx, cy + CHART.cursor, CHART.z]]);

    // Readings.
    const status = clock <= 0 ? 'Ready · the shape is described but not yet built; press Play'
      : now.stage === 'sketch' ? `Sketching · ${fixed(now.drawn, 0)} of ${fixed(plan.facets, 0)} facets laid down, with no thickness yet`
      : now.stage === 'extrude' ? `Rising · the wall stands ${fixed(now.outerHeight, 2)} mm of ${fixed(plan.height, 0)} mm`
      : !now.done ? `Sinking the pocket · ${fixed(now.pocketDepth, 2)} mm of ${fixed(plan.pocket, 2)} mm`
      : `Built · ${fixed(plan.triangles, 0)} triangles holding ${fixed(plan.facetedVolume / 1000, 3)} mL of solid`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Triangles', `${fixed(plan.triangles, 0)}`, `The surface is only ever flat triangles. The outer wall, the pocket wall and the rim are each a band of two triangles a facet, ${fixed(3 * 2 * plan.facets, 0)} in all, and the pocket floor and the underside are each a fan of ${fixed(plan.facets - 2, 0)}. Every edge belongs to exactly two of them, which is what makes the surface a closed solid rather than a sheet.`),
        r('Chord error', `${fixed(plan.outerError * 1000, 1)} μm`, `A facet is a straight chord across the arc it stands in for, and at the middle it falls short of the curve by the radius times one minus the cosine of half the angle the facet spans: ${fixed(plan.radius, 0)} mm times one minus the cosine of ${fixed(180 / plan.facets, 2)}°, or ${fixed(plan.outerError * 1000, 1)} μm. The chart is drawn on its logarithm because the error falls by a factor of about 250 across the range.`),
        r('File size', `${fixed(plan.bytes, 0)} bytes`, `An ${STL.header} byte header, a ${STL.count} byte count of the triangles, then ${fixed(STL.floats * STL.floatBytes + STL.attribute, 0)} bytes each: ${STL.floats} numbers of ${STL.floatBytes} bytes, three for the direction the face points and nine for its three corners, and ${STL.attribute} more after them. ${fixed(plan.triangles, 0)} triangles come to ${fixed(plan.bytes, 0)} bytes.`),
        r('Layers', `${fixed(plan.layers, 0)}`, `${fixed(plan.height, 0)} mm at ${fixed(plan.layer, 2)} mm a layer needs ${fixed(plan.layers, 0)} of them, the last ${fixed(plan.lastLayer, 3)} mm tall. A layer taller than ${fixed(plan.nozzleLimit, 2)} mm is more than four fifths of a ${fixed(SLICING.nozzle, 1)} mm nozzle, which is as much as it can lay. Layer height changes the staircase up the side and nothing about the detail around it.`),
        r('Solid', `${fixed(plan.facetedVolume / 1000, 3)} mL`, `The facets hold ${fixed(plan.facetedVolume, 0)} mm³ against the ${fixed(plan.roundVolume, 0)} mm³ the true curves would, ${fixed(plan.missing, 0)} mm³ less, because every facet cuts a sliver off the circle. With more facets the two close up.`),
        r('The path', `${fixed(plan.totalPath / 1000, 2)} m`, `${fixed(plan.perimeters, 0)} loop${plan.perimeters === 1 ? '' : 's'} of ${fixed(plan.width, 2)} mm measure ${fixed(plan.shell, 3)} mm across, not ${fixed(plan.perimeters * plan.width, 2)} mm, because a bead is a rectangle with a rounded end each side and neighbors overlap those ends. Each bead carries ${fixed(plan.bead, 4)} mm², so the whole ${fixed(plan.totalPath / 1000, 2)} m of path lays ${fixed(plan.printVolume / 1000, 2)} mL. ${plan.thin ? 'The loops are wider than the wall, so they would have to be squeezed or dropped.' : `The wall holds ${fixed(plan.fits, 0)} of them.`}`),
        r('Drawn', `${fixed(timesLarger(FACET), 0)} times larger`, `The cup is at true size, 1 mm to ${CUP} scene units. One facet against its arc is ${fixed(timesLarger(FACET), 0)} times larger and one layer's path ${fixed(timesLarger(PATHVIEW), 0)} times larger. The byte record and the charts are not to scale, and the chart's height is logarithmic.`),
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
    {label: 'Inspect: one facet', part: 'facet', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: one triangle in the file', part: 'file', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the layers', part: 'slice', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: one layer’s path', part: 'path', view: 'front', replay: false, run() { return inspect(duration()); }},
  ];
  result.playback = {
    label: 'Build the shape',
    description: 'A sketch of the outer ring, the wall rising from it, then the pocket sinking into the middle. These are three operations on numbers, not a machine cutting anything.',
    stepLabel: 'Advance 1 s',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'slice', label: 'Inspect what the slicer made', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0, 0, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, solid, outerPlan, innerPlan, truePlan, sketchLine, wallLeft, wallRight, floorBlock, elevationFrame, facetPart, trueArc, chordLine, errorBar, facetRadii, filePart, fileBlocks, fileFrame, fileGroups, slice, sliceFrame, sliceOutline, sliceLines, sliceCursor, pathPart, wallBand, pathLoops, infillLines, chart, chartFrame, errorCurve, nozzleLine, chartCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

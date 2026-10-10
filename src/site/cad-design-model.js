import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, textLabel} from './scene-kit.js';
import {designPlan, designAt, chordError, STL, DESIGN_DEFAULTS, DESIGN_DOMAINS} from './printing-physics.js';
import {cupSurface, designRing} from './cad-design-geometry.js';

export const CUP = 0.075;
export const FILEVIEW = Object.freeze({width: 3, high: .3, gap: .015});
export const CHART = Object.freeze({x: -1.4, y: -.55, w: 2.8, h: 1.2, decades: Object.freeze([-3, .3]), samples: 61});
export const COLORS = Object.freeze({solid: 0x83b4c1, wall: 0x91aa7e, arc: 0x9aa39a, chord: 0x2b5d9c, error: 0xc14f39, grid: 0x374736, header: 0xce825f, normal: 0xe3b45e, vertex: 0x83b4c1, attribute: 0x8f989b, layerLine: 0x91aa7e, bead: 0x374736, infill: 0xd99a2b, sketch: 0xd99a2b});
export const chartX = n => CHART.x + (n - 8) / 120 * CHART.w;
export const chartY = error => CHART.y + (Math.log10(error) - CHART.decades[0]) / (CHART.decades[1] - CHART.decades[0]) * CHART.h;
const close = points => [...points, [...points[0]]];

export function createCADDesignModel() {
  const kit = houseModel('Computer-aided design'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, previousValues;
  const label = (parent, text, y, size = .18) => textLabel(parent, text, {height: size, width: 3.6, position: [0, y, .025]});
  const system = part('system', 'From shape to printer paths', 'Design a cup with circular dimensions. Watch its sketch rise, then subtract a pocket. Next approximate its surface with flat STL triangles and cut that mesh into layers. The orange paths are digital instructions, not deposited plastic.');
  const solid = part('solid', 'Editable cup', 'Radius, height, and wall thickness define the ideal circular solid. The wall control also sets the floor thickness. The shaded preview uses fine rendering triangles; the CAD dimensions still describe circles. At the mesh stage, the selected facet count replaces that preview.', [0, -.55, 0], system);
  solid.rotation.set(.55, -.4, 0);
  const surfaceMaterial = new THREE.MeshStandardMaterial({color: COLORS.solid, roughness: .78, metalness: 0, flatShading: true});
  const cup = new THREE.Mesh(new THREE.BufferGeometry(), surfaceMaterial); solid.add(cup);
  const ghost = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({color: COLORS.arc, transparent: true, opacity: .08, depthWrite: false})); solid.add(ghost);
  const meshEdges = segmentLines(128 * 24, COLORS.grid, solid);
  const sketchLine = lineObject(257, COLORS.sketch, solid), sketchGuide = lineObject(257, COLORS.arc, solid);
  const sectionCursor = lineObject(129, COLORS.infill, solid);
  const stageTitle = label(system, '', 1.5, .24), stageDetail = label(system, '', 1.25);
  const wallDimension = label(system, '', -1.68, .18);
  const dimensions = label(system, '', -1.45, .18);

  const inspections = [];
  const inspectPart = (id, name, description) => {
    const object = part(id, name, description, [0, 0, 0], system);
    object.userData.inspectionOnly = id; object.userData.explosionExcluded = true; inspections.push(object);
    return object;
  };
  const facetPart = inspectPart('facet', 'A facet against its curve', 'The gray arc is the ideal circle. The blue chord is one mesh facet. The red distance at its middle is the maximum radial error. This close-up fits the chord to the frame, so its magnification changes with radius and facet count.');
  const trueArc = lineObject(81, COLORS.arc, facetPart), chordLine = segmentLines(1, COLORS.chord, facetPart), errorBar = segmentLines(1, COLORS.error, facetPart);
  label(facetPart, 'Curve and flat facet', .75, .22);
  const facetScale = label(facetPart, '', -.65), facetError = label(facetPart, '', -.4);
  label(facetPart, 'Gray: curve · blue: chord · red: gap', .5, .16);

  const filePart = inspectPart('file', 'Inside a binary STL file', 'One 80-byte header and one 4-byte triangle count begin the entire file. Each triangle then uses 12 bytes for its normal, 36 for three vertex coordinates, and 2 attribute bytes. STL stores no units; this example interprets coordinates as millimeters.');
  label(filePart, 'Inside binary STL', .75, .22);
  label(filePart, 'Bytes: 80 + 4 + 50 × triangles', .51);
  const fileBlocks = [], fileFrame = lineObject(5, COLORS.grid, filePart);
  let byteX = -FILEVIEW.width / 2;
  for (let k = 0; k < 13; k++) {
    const bytes = k < 12 ? 4 : 2, width = FILEVIEW.width * bytes / 50 - FILEVIEW.gap;
    const block = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({color: k < 3 ? COLORS.normal : k < 12 ? COLORS.vertex : COLORS.attribute}));
    block.position.set(byteX + width / 2, .05, .001); block.scale.set(width, FILEVIEW.high, 1); filePart.add(block); fileBlocks.push(block); byteX += width + FILEVIEW.gap;
  }
  fillLine(fileFrame, [[-1.5, -.1, 0], [1.5, -.1, 0], [1.5, .2, 0], [-1.5, .2, 0], [-1.5, -.1, 0]]);
  label(filePart, '3 normal + 9 vertex numbers + attributes', -.25, .16);
  const fileTotal = label(filePart, '', -.56, .2);
  label(filePart, 'No units, curves, or toolpaths', -.8, .16);

  const slice = inspectPart('slice', 'Cut the mesh into layers', 'This section through the cup shows every layer at its middle height. Above the floor, each slice has material only in the walls. Two short boundary layers, when needed, preserve the exact floor and top. Fine levels merge at overview scale; zoom in to see individual lines. The orange level is the layer shown in the path inspection.');
  const sliceOutline = lineObject(9, COLORS.grid, slice), sliceLines = segmentLines(964, COLORS.layerLine, slice), sliceCursor = segmentLines(1, COLORS.infill, slice);
  label(slice, 'Section through the cup', 1.3, .22);
  const sliceCount = label(slice, '', -1.15), sliceBoundary = label(slice, '', -1.38, .16);

  const pathPart = inspectPart('path', 'One complete layer path', 'Green loops follow both boundaries of this slice. Orange lines fill only the space left between them. The empty pocket stays empty. Loop centers use perpendicular offsets and rounded-bead spacing. This example keeps matching loop counts from both boundaries. Requested pairs that do not fit are reduced; very thin walls get one centered loop instead. It does not insert an extra odd loop between paired sets. These are centerlines, not a rendering of bead width.');
  const pathOuter = lineObject(129, COLORS.arc, pathPart), pathInner = lineObject(129, COLORS.arc, pathPart);
  const pathLoops = Array.from({length: 8}, () => lineObject(129, COLORS.bead, pathPart));
  const infillLines = segmentLines(512, COLORS.infill, pathPart);
  label(pathPart, 'Green: loops · orange: fill', 1.72, .19);
  const pathCount = label(pathPart, '', -1.68), pathNote = label(pathPart, '', -1.92, .16);

  const chart = inspectPart('chart', 'Facet error versus facet count', 'Only tessellation changes this radial error. Increasing the facet count lowers the chord error; increasing the radius raises it. The vertical scale is logarithmic. Layer height controls a different direction and does not change these mesh facets.');
  const errorCurve = lineObject(CHART.samples, COLORS.chord, chart), chartCursor = segmentLines(2, COLORS.error, chart);
  chartText(chart, (n, decade) => [chartX(n), CHART.y + (decade + 3) / 3.3 * CHART.h, 0], {
    title: 'Facet error, log scale', size: .135,
    x: {min: 8, max: 128, title: 'Facets around the circle', ticks: [[8, '8'], [64, '64'], [128, '128']]},
    y: {min: -3, max: .3, title: 'Radial error (mm)', ticks: [[-3, '0.001'], [-2, '0.01'], [-1, '0.1'], [0, '1']]},
  });
  const chartValue = label(chart, '', -1.08);
  system.traverse(object => { if (object.userData.textLabel) object.material.side = THREE.FrontSide; });

  const d = DESIGN_DEFAULTS;
  control('radius', 'Outer radius', ...DESIGN_DOMAINS.radius, d.radius, 'mm', 'Resize the ideal cup. At the same facet count, a larger radius produces a larger mesh error.');
  control('facets', 'Facets', ...DESIGN_DOMAINS.facets, d.facets, '', 'Set the polygon sides used for STL tessellation. This changes mesh size and error, not the ideal CAD circles.');
  control('height', 'Height', ...DESIGN_DOMAINS.height, d.height, 'mm', 'Set the extrusion height. A taller cup needs more slices.');
  control('wall', 'Wall', ...DESIGN_DOMAINS.wall, d.wall, 'mm', 'Set both radial wall thickness and floor thickness. Coarse mesh walls are slightly thinner perpendicular to a facet.');
  control('layer', 'Layer height', ...DESIGN_DOMAINS.layer, d.layer, 'mm', 'Maximum slice height. A shorter layer is inserted at the pocket floor or top when needed. This changes vertical detail, not facet error.');
  control('width', 'Bead width', ...DESIGN_DOMAINS.width, d.width, 'mm', 'Set ideal bead width. Wider beads need more space between path centers.');
  control('perimeters', 'Loops', ...DESIGN_DOMAINS.perimeters, d.perimeters, '', 'Request this many loops from each wall boundary. The planner reduces them when both sets cannot fit.');
  control('infill', 'Infill', ...DESIGN_DOMAINS.infill, d.infill, '%', 'Set spacing of straight filling paths between perimeter shells. The floor uses solid fill; the cup pocket stays empty.');

  const replaceSurface = (object, surface) => {
    object.geometry.dispose();
    object.geometry = new THREE.BufferGeometry();
    object.geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.vertices.flat().map(v => v * CUP), 3));
    object.geometry.setIndex(surface.faces.flat()); object.geometry.computeVertexNormals();
  };
  let surfaceKey = '', ghostKey = '', frameBounds = new THREE.Box3();
  const result = finish(v => {
    const plan = designPlan(v);
    const valuesKey = JSON.stringify(plan.values);
    if (previousValues && previousValues !== valuesKey) { clock = 0; lastClock = 0; }
    previousValues = valuesKey;
    const now = designAt(plan, clock), displayFacets = now.meshed ? plan.facets : 256;
    const key = `${plan.radius}:${plan.inner}:${displayFacets}:${now.outerHeight}:${now.pocketDepth}`;
    cup.visible = now.outerHeight > 1e-8;
    if (cup.visible && key !== surfaceKey) { surfaceKey = key; replaceSurface(cup, cupSurface(plan.radius, plan.inner, displayFacets, now.outerHeight, now.pocketDepth)); }
    const targetKey = `${plan.radius}:${plan.inner}:${plan.height}`;
    if (targetKey !== ghostKey) {
      ghostKey = targetKey; replaceSurface(ghost, cupSurface(plan.radius, plan.inner, 128, plan.height, plan.pocket));
      ghost.geometry.computeBoundingBox(); solid.updateMatrix();
      const bounds = ghost.geometry.boundingBox.clone().applyMatrix4(solid.matrix);
      stageTitle.userData.place(0,bounds.max.y+.5); stageDetail.userData.place(0,bounds.max.y+.25);
      dimensions.userData.place(0,bounds.min.y-.3); wallDimension.userData.place(0,bounds.min.y-.55);
      frameBounds = bounds.clone().union(new THREE.Box3(new THREE.Vector3(-1.8,bounds.min.y-.68,bounds.min.z),new THREE.Vector3(1.8,bounds.max.y+.64,bounds.max.z)));
    }
    ghost.visible = !now.meshed;
    const ring = close(designRing(plan.radius, 256));
    fillLine(sketchGuide, !now.meshed ? ring.map(([x, z]) => [x * CUP, 0, z * CUP]) : []);
    fillLine(sketchLine, now.stage === 'sketch' ? ring.slice(0, Math.max(1, Math.ceil(now.sketch * 256) + 1)).map(([x, z]) => [x * CUP, .002, z * CUP]) : []);
    const edgePoints = [];
    if (now.meshed) for (const [a, b, c] of plan.surface.faces) for (const index of [a, b, b, c, c, a]) edgePoints.push(plan.surface.vertices[index].map(v => v * CUP));
    fillLine(meshEdges, edgePoints);
    const selectedSlice = now.stage === 'slice' && !now.done ? plan.slices[Math.min(plan.layers - 1, Math.floor(now.slicing * plan.layers))] : plan.wallSlice;
    const selectedIndex = plan.slices.indexOf(selectedSlice);
    fillLine(sectionCursor, now.stage === 'slice' ? close(designRing(plan.radius, plan.facets)).map(([x, z]) => [x * CUP, selectedSlice.middle * CUP, z * CUP]) : []);
    const titles = {sketch: '1. Sketch a circular outline', extrude: '2. Raise it into a solid', pocket: '3. Subtract a blind pocket', mesh: '4. Approximate the surface with triangles', slice: now.done ? '5. Shape ready for layer paths' : '5. Slice the mesh from bottom to top'};
    stageTitle.userData.setText({sketch:'1/5 · Sketch',extrude:'2/5 · Extrude',pocket:'3/5 · Pocket',mesh:'4/5 · STL mesh',slice:'5/5 · Layers and paths'}[now.stage]);
    stageDetail.userData.setText(clock === 0 ? 'Press Play to build the cup' : now.meshed ? `${plan.triangles} triangles · ${plan.layers} layers` : 'Editable circular design');
    dimensions.userData.setText(`Radius ${plan.radius} mm · height ${plan.height} mm`);
    wallDimension.userData.setText(`Wall and floor: ${plan.wall} mm`);

    const half = Math.PI / plan.facets, facetUnit = 1.5 / (plan.radius * Math.sin(half));
    fillLine(trueArc, Array.from({length: 81}, (_, i) => { const a = -half + 2 * half * i / 80; return [plan.radius * Math.sin(a) * facetUnit, plan.radius * (Math.cos(a) - 1) * facetUnit, .001]; }));
    const errorY = -plan.outerError * facetUnit;
    fillLine(chordLine, [[-1.5, errorY, .002], [1.5, errorY, .002]]); fillLine(errorBar, [[0, errorY, .003], [0, 0, .003]]);
    facetScale.userData.setText(`Close-up: ${(facetUnit / CUP).toFixed(1)}× the cup scale`);
    facetError.userData.setText(`Radial error: ${(plan.outerError * 1000).toFixed(1)} μm`);
    fileTotal.userData.setText(`${plan.triangles} triangles → ${plan.bytes.toLocaleString('en-US')} bytes`);

    const x = plan.radius * Math.cos(Math.PI / plan.facets) * CUP, innerX = plan.inner * Math.cos(Math.PI / plan.facets) * CUP, y0 = -.8, top = y0 + plan.height * CUP, base = y0 + plan.base * CUP;
    fillLine(sliceOutline, [[-x,y0,0],[x,y0,0],[x,top,0],[innerX,top,0],[innerX,base,0],[-innerX,base,0],[-innerX,top,0],[-x,top,0],[-x,y0,0]]);
    const levels = [];
    for (const s of plan.slices) {
      const y = y0 + s.middle * CUP;
      if (s.floor) levels.push([-x,y,.001],[x,y,.001]);
      else levels.push([-x,y,.001],[-innerX,y,.001],[innerX,y,.001],[x,y,.001]);
    }
    fillLine(sliceLines, levels);
    const shownY = y0 + selectedSlice.middle * CUP; fillLine(sliceCursor, [[-x-.05,shownY,.002],[x+.05,shownY,.002]]);
    sliceCount.userData.setText(`${plan.layers} layers · orange: layer ${selectedIndex + 1}`);
    sliceBoundary.userData.setText(`At ${selectedSlice.middle.toFixed(3)} mm · max. height ${plan.layer.toFixed(2)} mm`);
    fillLine(pathOuter, close(designRing(plan.radius, plan.facets)).map(([x,y]) => [x*CUP,y*CUP,0]));
    fillLine(pathInner, selectedSlice.floor ? [] : close(designRing(plan.inner, plan.facets)).map(([x,y]) => [x*CUP,y*CUP,0]));
    const loops = selectedSlice.paths.filter(path => path.kind === 'perimeter');
    pathLoops.forEach((line, i) => fillLine(line, loops[i]?.points.map(([x,y]) => [x*CUP,y*CUP,.002]) || []));
    fillLine(infillLines, selectedSlice.paths.filter(path => path.kind === 'infill').flatMap(path => path.points.map(([x,y]) => [x*CUP,y*CUP,.003])));
    pathCount.userData.setText(`Layer ${selectedIndex + 1}: ${selectedSlice.loopCount} loop${selectedSlice.loopCount === 1 ? '' : 's'} · ${selectedSlice.length.toFixed(1)} mm`);
    pathNote.userData.setText(selectedSlice.reduced ? selectedSlice.loopCount === 1 ? `Requested ${selectedSlice.requested}; one centered loop fits` : `Requested ${selectedSlice.requested}; ${selectedSlice.pairs} matching pairs fit` : `${selectedSlice.floor ? 'Floor fill: 100%' : `Wall fill: ${plan.infill}%`} · centerlines`);
    fillLine(errorCurve, Array.from({length: CHART.samples}, (_, i) => { const n = 8 + 120 * i / (CHART.samples - 1); return [chartX(n), chartY(chordError(plan.radius,n)),0]; }));
    const cx = chartX(plan.facets), cy = chartY(plan.outerError);
    fillLine(chartCursor, [[cx-.04,cy,.002],[cx+.04,cy,.002],[cx,cy-.04,.002],[cx,cy+.04,.002]]);
    chartValue.userData.setText(`${plan.facets} facets · ${(plan.outerError * 1000).toFixed(1)} μm radial error`);
    const fit = plan.wallSlice;
    return {state: {...plan, now, clock, displayFacets, selectedLayer: selectedIndex, facetScale: facetUnit / CUP}, readings: [
      r('Your result', now.done ? `Ready · ${plan.triangles} triangles → ${plan.layers} layers → ${(plan.totalPath/1000).toFixed(2)} m of ideal path` : `${titles[now.stage]}${clock === 0 ? ' · press Play' : ''}`, 'Changing any parameter returns to the cup and restarts construction. Use the inspection buttons to compare the finished design, mesh, layers, and paths.'),
      r('Triangles', `${plan.triangles}`, 'The closed mesh has three bands of two triangles per facet and two polygonal caps of N − 2 triangles. Its hollow pocket has a closed floor; the material boundary is watertight.'),
      r('Chord error', `${fixed(plan.outerError*1000,1)} μm`, 'For radius R and N facets, maximum radial error is R(1 − cos(π/N)). This is mesh approximation error, not printer positioning error.'),
      r('STL size', `${plan.bytes.toLocaleString('en-US')} bytes`, 'One 80-byte header, one 4-byte count, then 50 bytes per triangle. Coordinates are interpreted as millimeters here; STL does not store units.'),
      r('Layers', `${plan.layers}`, `${plan.floorLayers} floor layers and ${plan.layers-plan.floorLayers} wall layers. Maximum height ${plan.layer.toFixed(2)} mm; the last layer is ${plan.lastLayer.toFixed(3)} mm. Boundary layers preserve the exact pocket floor and top.`),
      r('Ideal solid / mesh', `${(plan.roundVolume/1000).toFixed(3)} / ${(plan.facetedVolume/1000).toFixed(3)} mL`, `Tessellation changes the material volume by ${plan.missing.toFixed(1)} mm³. This is solid geometric volume, not cup capacity or an estimate of print strength.`),
      r('Loops that fit', `${fit.loopCount} of ${fit.requested}`, fit.reduced ? `Requested loops were reduced because both sides must fit across ${fit.thickness.toFixed(3)} mm perpendicular to a facet. ${fit.loopCount===1 ? 'One centered loop replaces the opposing sets.' : `${fit.pairs} matching pairs fit. An extra odd loop between the sets is outside this planner.`}` : `${fit.pairs} loops from each face fit. Centers are ${fit.spacing.toFixed(3)} mm apart, using rounded-bead spacing rather than full bead width.`),
      r('Ideal extrusion path', `${(plan.totalPath/1000).toFixed(2)} m`, `Sum of the actual perimeter and clipped infill centerlines on every slice. Rounded-bead volume estimate: ${(plan.printVolume/1000).toFixed(2)} mL using each slice's own height. Travel moves, seam order, corner flow, small gap fill, and print time are not modeled.`),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(result.getState().duration, clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0,t-lastClock) : 0; if (Number.isFinite(t)) lastClock=t; return result.advance(dt); };
  result.reset = () => { clock=0; lastClock=0; return render(result.defaults); };
  const inspect = () => { clock=result.getState().duration; return render(); };
  result.actions = [
    {label:'Inspect: editable cup',part:'solid',view:'front',replay:false,isolate:false,run:inspect},
    ...[['facet','one facet'],['file','binary STL'],['slice','all layers'],['path','one layer’s path'],['chart','facet error']].map(([part,title])=>({label:`Inspect: ${title}`,part,view:'front',replay:false,isolate:true,run:inspect})),
  ];
  result.playback = {label:'Build the shape',description:'Sketch, extrude, pocket, tessellate, then slice. These are digital operations, not real machining or printing.',stepLabel:'Advance 1 s',advance:result.advance,step:()=>result.advance(1),complete:()=>clock>=result.getState().duration,blocked:()=>false};
  result.resultPart = {id:'path',label:'Inspect the layer paths',view:'front',focusOnComplete:false,available:()=>clock>=result.getState().duration};
  result.initialPart='system'; result.initialView='front'; result.frameVisibleOnly=true; result.framePadding=.52;
  result.autoFramePart='system';
  result.selectionOutline=false; result.transparentBackground=true;
  result.inspectionObjects=id=>inspections.filter(object=>object.userData.inspectionOnly===id);
  result.thumbnailOmit=inspections;
  result.catalogParts=result.parts.filter(p=>p.id!=='system');
  result.frameBoundsForPart=id=>id==='system'||id==='solid'?frameBounds.clone().applyMatrix4(system.matrixWorld):null;
  result.topology={system,solid,cup,ghost,meshEdges,sketchLine,sketchGuide,sectionCursor,stageTitle,stageDetail,dimensions,wallDimension,facetPart,trueArc,chordLine,errorBar,facetScale,facetError,filePart,fileBlocks,fileFrame,fileTotal,slice,sliceOutline,sliceLines,sliceCursor,sliceCount,sliceBoundary,pathPart,pathOuter,pathInner,pathLoops,infillLines,pathCount,pathNote,chart,errorCurve,chartCursor,chartValue};
  const dispose=result.dispose; result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

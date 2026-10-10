import {DESIGN_DEFAULTS, SCAN_DEFAULTS} from './printing-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  marlinConfig: {title: 'Marlin: Configuration.h', url: 'https://marlinfw.org/docs/configuration/configuration.html'},
  marlinMove: {title: 'Marlin: G0 and G1, linear move', url: 'https://marlinfw.org/docs/gcode/G000-G001.html'},
  calculator: {title: 'Prusa: RepRap Calculator', url: 'https://blog.prusa3d.com/calculator_3416/'},
  stepper: {title: 'Wikipedia: Stepper motor', url: 'https://en.wikipedia.org/wiki/Stepper_motor'},
  nema17: {title: 'RepRap: NEMA 17 stepper motor', url: 'https://reprap.org/wiki/NEMA_17_Stepper_motor'},
  datasheet: {title: 'Stepper motor datasheet, Changzhou Songyang, hosted by Pololu', url: 'https://www.pololu.com/file/0J715/SY42STH47-1206A.pdf'},
  backlash: {title: 'Wikipedia: Backlash (engineering)', url: 'https://en.wikipedia.org/wiki/Backlash_(engineering)'},
  leadscrew: {title: 'Wikipedia: Leadscrew', url: 'https://en.wikipedia.org/wiki/Leadscrew'},
  stl: {title: 'Wikipedia: STL (file format)', url: 'https://en.wikipedia.org/wiki/STL_(file_format)'},
  slicer: {title: 'Wikipedia: Slicer (3D printing)', url: 'https://en.wikipedia.org/wiki/Slicer_(3D_printing)'},
  prusaLayers: {title: 'Prusa Knowledge Base: Layers and perimeters', url: 'https://help.prusa3d.com/article/layers-and-perimeters_1748'},
  sagitta: {title: 'Wikipedia: Sagitta (geometry)', url: 'https://en.wikipedia.org/wiki/Sagitta_(geometry)'},
  fff: {title: 'Wikipedia: Fused filament fabrication', url: 'https://en.wikipedia.org/wiki/Fused_filament_fabrication'},
  cad: {title: 'Wikipedia: Computer-aided design', url: 'https://en.wikipedia.org/wiki/Computer-aided_design'},
  scanning: {title: 'Wikipedia: 3D scanning', url: 'https://en.wikipedia.org/wiki/3D_scanning'},
  structured: {title: 'Wikipedia: Structured-light 3D scanner', url: 'https://en.wikipedia.org/wiki/Structured-light_3D_scanner'},
  scanControl: {title: 'Micro-Epsilon: scanCONTROL catalog', url: 'https://www.micro-epsilon.com/fileadmin/download/products/cat--scanCONTROL--en-us.pdf'},
  triangulation: {title: 'Wikipedia: Triangulation (computer vision)', url: 'https://en.wikipedia.org/wiki/Triangulation_(computer_vision)'},
  sensorFormat: {title: 'Wikipedia: Image sensor format', url: 'https://en.wikipedia.org/wiki/Image_sensor_format'},
};

/** What all three lessons take without a source. */
export const sharedLimits = 'These benches use illustrative dimensions and idealized models. Read each lesson’s limits before interpreting its numbers as hardware performance.';

/** What the design takes without a source. */
export const designLimits = 'The cup and its dimensions are an invented example. Circular CAD dimensions are ideal; the screen preview uses rendering triangles. STL tessellation is a separate, deliberate approximation. This teaching slicer uses fixed-width paths and straight infill, with short layers at the pocket floor and top. It retains matching loop counts from both faces, reducing pairs when they do not fit, or using one centered loop if no pair fits. It does not add an extra odd loop between paired sets. Tiny gap filling, seam order, travel, supports, corner flow, cooling, strength, and actual print time are not modeled. Path length is the sum of the displayed centerlines; bead volume is only a rounded-cross-section estimate.';

/** What the scanner takes without a source. */
export const scanLimits = 'Not from a source: the focal length of 20 mm, the baseline, and the sensor, chosen together so that at the catalog’s own middle of range, its own pixel and the interpolation the structured light page gives, the depth resolution comes out at the 2 μm the catalog quotes. The stepped target and its ridge are invented. The surface is taken as perfectly matte, returning light to the receiver from everywhere both paths are clear, and the geometry is taken as known exactly. Speckle, noise, lens distortion, calibration error, second reflections off shiny surfaces, and the way a real laser line has width rather than being infinitely thin are all left out. One sweep from one side is all there is: there is no second view, no merging, no surface built over the points, and nothing is ever filled in where the receiver saw nothing.';

export {threeAxisLesson} from './three-axis-lesson.js';

// ---------------------------------------------------------------------------
// Computer aided design.
// ---------------------------------------------------------------------------

const cadTrial = (part, title, instruction, observe, values = {}) => ({...trial(DESIGN_DEFAULTS, part)(title, instruction, observe, values), isolate: !['system','solid'].includes(part)});

export const cadDesignLesson = {
  simple: 'How does an editable shape become paths a printer can follow?',
  overview: 'Start with a circle, raise it into a solid, and subtract a smaller pocket to make a cup. CAD keeps the dimensions editable. For one printing workflow, the curved surface is then approximated by flat STL triangles. A slicer cuts that mesh into horizontal layers and places paths inside the material. Press Play to follow all five stages, then inspect the mesh, layers, and paths. Each control changes the same cup or the instructions made from it.',
  steps: [
    {title: 'Sketch a circle', body: 'An outer radius defines the circular outline. It has no thickness yet; the pale cup shows the target shape.'},
    {title: 'Extrude upward', body: 'Raise the outline by the selected height. This creates a solid cylinder in the digital design.'},
    {title: 'Subtract the pocket', body: 'Remove a smaller cylinder from the top. Stop before the bottom to leave a floor; here the wall setting also sets that floor thickness.'},
    {title: 'Tessellate the surface', body: 'Replace circular boundaries with polygons, then describe the closed surface with triangles. More facets reduce mesh error and increase the binary STL size.'},
    {title: 'Slice and plan paths', body: 'Cut the mesh into layers. Trace its boundaries, then place filling paths only in the material left between them. The cup pocket remains empty.'},
  ],
  parts: [
    {name: 'Editable cup', role: 'The circular sketch, growing extrusion, and pocket subtraction in three dimensions.'},
    {name: 'A facet against its curve', role: 'A magnified arc, its straight chord, and the error between them.'},
    {name: 'Inside a binary STL file', role: 'One header and count, followed by 50 bytes for each triangle.'},
    {name: 'Cut the mesh into layers', role: 'Every slice shown through the floor or through the two walls of the section.'},
    {name: 'One complete layer path', role: 'Actual perimeter and infill centerlines, with an empty pocket and an explicit loop-fit result.'},
    {name: 'Facet error versus facet count', role: 'A logarithmic comparison that separates mesh detail from layer height.'},
  ],
  tryIt: [
    cadTrial('system', 'Describe the shape', 'Press Play to build the cup, then inspect its layer paths.', 'The circle rises into a cylinder before the pocket is removed. Tessellation then produces 252 triangles; slicing produces 60 layers. Inspect one layer to see which lines a printer could follow.'),
    cadTrial('facet', 'Use only eight facets', 'This preset selects 8 facets. Press Play or inspect one facet.', 'The coarse mesh has 60 triangles. Its maximum radial error is 913.4 μm, although the ideal CAD radius is still 12 mm.', {facets: 8}),
    cadTrial('file', 'Use a hundred and twenty eight', 'This preset selects 128 facets. Compare the file and the facet error.', 'The mesh has 1,020 triangles and needs 51,084 bytes in binary STL. The radial error falls to 3.6 μm. Extra facets improve the mesh without changing the ideal cup dimensions.', {facets: 128}),
    cadTrial('slice', 'Cut it into thinner layers', 'This preset selects a 0.05 mm maximum layer height.', 'The same mesh now has 240 layers instead of 60. Every layer is present in the section. Facet error stays 57.8 μm because layer height does not change the mesh.', {layer: .05}),
    cadTrial('slice', 'Cut it into thicker ones', 'This preset selects a 0.30 mm maximum layer height.', 'The cup needs 40 layers. That changes vertical sampling and total path length, while the mesh still has 252 triangles.', {layer: .3}),
    cadTrial('path', 'Ask for too many loops', 'Request four loops from each boundary of the wall.', 'Eight requested wall loops cannot fit. The planner retains two from each face, four total, and explains the reduction. The floor can fit more because it has no pocket.', {perimeters: 4}),
    cadTrial('path', 'Fill the space between loops', 'Set the wall infill spacing to 100%.', 'Orange lines become more closely spaced in the region left between perimeter shells. They never fill the open pocket. Tiny corner gaps and exact bead coverage remain outside this model.', {infill: 100}),
    cadTrial('system', 'Make a wider, taller cup', 'Build a cup with a 20 mm radius and 24 mm height.', 'The cup grows in both directions. At 32 facets, radial error rises to 96.3 μm, and the height needs 120 layers. Triangle count stays 252 because the same mesh pattern is stretched.', {radius: 20, height: 24}),
    cadTrial('path', 'Try a thin wall and wide bead', 'Use a 0.8 mm wall, a 0.7 mm bead, and request four loops per face.', 'Only one centered wall loop fits; it replaces the opposing sets. No infill is added to this narrow wall. The visible warning explains why increasing the requested loops cannot add more paths.', {wall: .8, width: .7, perimeters: 4}),
  ],
  deeper: [
    {title: 'CAD geometry and mesh geometry', body: 'A parametric CAD system can retain circular curves and analytic surfaces, along with editable dimensions and construction history. Tessellation converts that geometry into a mesh. This lesson uses a circular cup as the ideal design and a regular polygonal cup as the STL approximation. The triangles used to render a smooth screen preview are not a claim that all CAD files store only triangles.'},
    {title: 'A closed boundary around hollow material', body: 'An open cup can still have a closed material boundary. The outer wall, inner wall, rim, underside, and pocket floor meet without gaps. With N facets, the three wall/rim bands have 6N triangles and the two caps have 2(N − 2), giving 8N − 4 total. Each mesh edge belongs to two oppositely oriented faces.'},
    {title: 'Deriving the facet error', body: 'Join the circle center to the ends and midpoint of one chord. The half-angle is π/N; the distance from center to chord is R cos(π/N). Subtract it from radius R to get the maximum radial error R(1 − cos(π/N)). At R = 12 mm and N = 32, the error is 0.0578 mm. Layer height does not enter this equation.'},
    {title: 'What binary STL records', body: 'The file starts with an 80-byte header and a 4-byte triangle count. Each triangle uses twelve 32-bit floating-point values: three for a normal and nine for its corners. Two attribute bytes bring each record to 50 bytes. Total size is 84 + 50T bytes for T triangles. STL has no native units or editable circle parameters.'},
    {title: 'A slice is not a toolpath', body: 'A slice is the intersection of geometry with a horizontal plane. Below the pocket floor it is a filled polygon; above the floor it is a polygonal ring. Perimeter paths sit inside those boundaries by roughly half a bead width. This teaching planner then clips straight infill lines to the remaining material and sums their actual lengths. A production slicer also decides travel order, seams, supports, flow adjustments, and machine instructions.'},
    {title: 'Why neighboring paths can overlap slightly', body: 'The rounded-bead approximation uses a rectangle with semicircular ends. For bead width w and layer height h, its area is wh − h²(1 − π/4). With the Slic3r spacing rule, neighboring centers are w − h(1 − π/4) apart. Two 0.45 mm beads at 0.20 mm height occupy about 0.857 mm across. Both opposing sets must fit inside the wall; extra requested loops cannot be counted as if space were unlimited.'},
    {title: 'Layer height and short boundary layers', body: 'Smaller layers sample vertical features more finely and require more passes. They do not repair coarse facets around the cup. This demonstration inserts shorter layers at the pocket floor and at the top when the selected height does not divide those regions exactly. It uses each actual layer height in the bead-volume estimate. Real printer profiles also account for nozzle size, first-layer adhesion, and material behavior.'},
  ],
  misconception: 'CAD design, STL mesh, and printer paths are different descriptions. A CAD circle can remain exact. Tessellation approximates it with facets, while slicing adds layers and paths; changing layer height cannot undo mesh error.',
  limits: `${designLimits} ${sharedLimits}`,
  sources: [
    {title:'Autodesk Fusion: Mesh creation',url:'https://help.autodesk.com/cloudhelp/ENU/Fusion-Mesh/files/MESH-CREATE-TOOLS.htm'},
    {title:'FreeCAD: PartDesign Pocket',url:'https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/PartDesign_Pocket.md'},
    {title:'Three.js: STLExporter',url:'https://github.com/mrdoob/three.js/blob/master/examples/jsm/exporters/STLExporter.js'},
    sources.prusaLayers,
    {title:'Slic3r Manual: Flow Math',url:'https://manual.slic3r.org/advanced/flow-math'},
  ],
  quiz: {
    question:'You lower the layer height but keep 8 facets around the cup. What changes?',
    options:['More layers are made, but the coarse polygonal outline stays the same.','The circular outline becomes exact.','The STL gains more triangles automatically.'],
    answer:0,
    explanation:'Layer height changes slicing. Facet count changes mesh approximation. The ideal CAD radius can stay unchanged through both choices.',
  },
};

// ---------------------------------------------------------------------------
// Laser scanning of 3D objects.
// ---------------------------------------------------------------------------

const scanBench = trial(SCAN_DEFAULTS, 'bench'), scanSensor = trial(SCAN_DEFAULTS, 'sensor'), scanProfile = trial(SCAN_DEFAULTS, 'profile'), scanChart = trial(SCAN_DEFAULTS, 'chart');

export const laserScanningLesson = {
  simple: 'How can a beam of light measure the shape of a real object?',
  overview: 'A laser throws a thin line across the object and a receiver watches that line from off to one side. Because it looks from an angle, a surface standing taller pushes the line sideways in what the receiver sees, and the triangle the laser, the receiver and the lit point make turns that sideways shift into a distance. The receiver can only read whole sensor cells, so the measurement lands on a grid, exactly as the positioning stage lands on a grid of steps. Press Play to carry the target through the line and gather the points.',
  steps: [
    {title: 'Throw a line across it', body: 'The laser spreads a thin sheet of light, and where that sheet meets the object it draws a bright line along the surface.'},
    {title: 'Watch it from one side', body: 'The receiver sits a known distance away from the laser, so it sees the line from an angle rather than straight on.'},
    {title: 'Read where the light landed', body: 'A taller surface is nearer the receiver, and its light lands further across the sensor, on one of a fixed row of cells.'},
    {title: 'Solve the triangle', body: 'The known distance between laser and receiver, and the direction the light came in, fix where the lit point must have been.'},
    {title: 'Carry the object through', body: 'Moving the object through the fixed line brings a new cross section under it each time, and the profiles stack up into a shape.'},
  ],
  parts: [
    {name: 'The bench, true size', role: 'The laser, the receiver and the two paths that both have to be clear.'},
    {name: 'The cross section, 3 times larger', role: 'One line across the target, with what came back and what did not.'},
    {name: 'The sensor, close up', role: 'The row of cells the light lands on, and the one it is rounded to.'},
    {name: 'The measured cloud', role: 'Only the points the receiver actually measured, with the gaps kept as gaps.'},
    {name: 'What one pixel is worth', role: 'How much depth a single cell stands for, across the measuring range.'},
    {name: 'The triangle', role: 'The base between laser and receiver that makes the whole measurement possible.'},
  ],
  tryIt: [
    scanBench('Measure one point', 'Press Play and watch the middle of the line.', 'The middle of the target stands 6.00 mm up, so it is 60.00 mm from the receiver. Its light lands 2.6667 mm across the sensor, and working the triangle back the other way gives a height of 5.9999 mm. One cell of the sensor is worth 2.01 μm of depth here.'),
    scanSensor('Read only whole pixels', 'Set the reading to whole pixels and press Play.', 'Without interpolation the spot can only be read to the nearest whole cell, 3.700 μm wide instead of 0.074. The same point now reads 2.6677 mm across the sensor and 6.0232 mm tall, out by 23.2 μm, and one cell is worth 100.73 μm of depth. Reading between the cells is what buys the last two decimal places.', {subpixel: 0}),
    scanChart('Widen the baseline', 'Set the baseline to 16 mm and press Play.', 'The receiver now looks in at 13.63° instead of straight down, and the same point images 5.3333 mm across the sensor rather than 2.6667. A given change in height moves the spot twice as far, so one cell is worth only 1.01 μm. The cost shows immediately: 2 of the attempts are now hidden from the receiver where 1 was before.', {baseline: 16}),
    scanChart('Narrow it', 'Set the baseline to 4 mm and press Play.', 'From 3.47° the receiver sees almost what the laser sees, so nothing is hidden at all and all 25 attempts come back. But the spot only moves 1.3333 mm across the sensor, and one cell is now worth 4.03 μm of depth. A scanner that can see everywhere measures least well.', {baseline: 4}),
    scanChart('Stand further off', 'Set the standoff to 78.5 mm and press Play.', 'The point is now 72.50 mm from the receiver and images at 2.2069 mm rather than 2.6667. Its image moves less and less as it goes further away, so one cell is worth 2.85 μm instead of 2.01. Resolution falls off as the square of the distance, which is why every scanner quotes a measuring range.', {standoff: 78.5}),
    scanProfile('Raise the ridge', 'Set the ridge to 12 mm and press Play.', 'The top of the ridge reads 11.9999 mm, but its edges now cast shadows: of the 25 attempts only 21 come back, 2 because the laser never reaches them and 2 because the receiver cannot see the lit surface past the ridge. The cloud keeps those four as gaps rather than guessing what is there.', {ridge: 12}),
    scanProfile('Move the receiver over', 'Put the receiver on the other side and press Play.', 'The same 24 of 25 attempts come back and the same 1 is lost, but it is a different one: the hidden point moves from one side of the ridge to the other, to 7 mm across instead of the same distance the other way. Moving the receiver does not remove a shadow; it only puts it somewhere else.', {side: 1}),
  ],
  deeper: [
    {title: 'Why this is called triangulation', body: 'The page on scanning in three dimensions says the laser shines on the subject and a camera looks for the location of the laser dot, and that the technique is called triangulation because the laser dot, the camera and the laser emitter form a triangle. One side of that triangle is known because the machine was built that way, and the angle at the camera is what the sensor reads, so the rest of the triangle follows. The page on triangulation in computer vision puts the same thing as two known lines that must intersect where the point is.'},
    {title: 'What one cell of the sensor is worth', body: 'A point at a distance images across the sensor at the focal length times the baseline divided by that distance. Move the point and its image moves the other way as the square of the distance, so one cell of the sensor stands for the distance squared times the cell width over the focal length times the baseline. At the middle of this range that is 2.01 μm; at the near end 1.32 μm and at the far end 2.85 μm. The catalog this range comes from holds its line to 2 μm.'},
    {title: 'Reading between the cells', body: 'The line does not land on one cell; it spreads across several, and its middle can be estimated from how brightly each of them was lit. The page on structured light scanners says that interpolating over several pixels of the acquired image can yield a reliable height resolution down to a fiftieth of a pixel. That is the difference between the two readings here: a cell of 3.700 μm read whole, or a grid of 0.074 μm read between, and a height out by 23.2 μm rather than by a tenth of a micron.'},
    {title: 'The bargain the baseline drives', body: 'Everything good about a wide baseline and everything bad about it come from the same fact: the receiver looks in from further to one side. Looking in from further makes the same change in height move the spot further across the sensor, so the measurement is finer. It also means more of the object stands between the receiver and the surface, so more of the surface is hidden. There is no setting that is best; a scanner is built for the shapes it expects.'},
    {title: 'Two paths, both of which must be clear', body: 'A point is measured only if the laser reaches it and the light gets back. Those fail separately: with a tall ridge, some places are never lit at all and others are lit perfectly well but hidden from the receiver behind the ridge. Both come back as nothing, and nothing is what the cloud records. The temptation is to fill a gap in from the shape you think is there; a scan that does that is no longer a measurement.'},
    {title: 'What a real one does', body: 'The catalog this bench borrows its numbers from describes a scanner whose measuring range runs from 53.5 mm to 78.5 mm, 25 mm deep, holding its line to 2 μm and reading 1,280 points along every profile at up to 2,000 profiles a second with a 658 nm laser. This bench reads far fewer points far more slowly, and moves the object rather than the head, but the triangle it solves is the same one.'},
  ],
  misconception: 'The camera does not measure a distance by itself. All it knows is which way the light came in; the distance only exists because the laser is a known distance away from it, and a point neither of them can reach is not measured at all.',
  limits: `${scanLimits} ${sharedLimits}`,
  sources: [sources.scanning, sources.structured, sources.scanControl, sources.triangulation, sources.sensorFormat],
  quiz: {
    question: 'The laser lights a surface but the receiver cannot see it past a ridge. What should the scan show there?',
    options: ['Nothing at all, because no measurement was made.', 'The surface copied from the shape the machine already knows.', 'A flat patch bridging the gap.'],
    answer: 0,
    explanation: 'A point needs both paths clear. With the tall ridge, 4 of the 25 attempts fail, and keeping them as gaps is what makes the result a measurement rather than a guess.',
  },
};

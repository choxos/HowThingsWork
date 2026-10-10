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
export const scanLimits = 'This is one ideal laser-line triangulation example, not a replica of the reference scanner or a model of every scanning method. The stepped target, focal length, baselines, pixel pitches, fine estimation grid and table speed are illustrative. Only selected upper-face positions are attempted. Vertical faces, underside and spaces between samples remain unmeasured. Pixel rounding omits intensity fitting, speckle, sensor noise, lens distortion, reflectance, calibration error and multiple reflections. The result is a partial point cloud; no missing data is filled, views merged, surface meshed, CAD solid created or printer path generated.';

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

const scanTrial = (part, title, instruction, observe, values = {}) => ({...trial(SCAN_DEFAULTS, part)(title, instruction, observe, values), isolate: part !== 'system'});

export const laserScanningLesson = {
  simple: 'How can light recover a shape, and why are some points missing?',
  overview: 'A thin laser plane crosses a real object. A camera outside that plane sees the illuminated line from an angle. Its image tells the computer where each visible point lies across the line and how high it stands. As the table moves, acquired profiles build a separate three-dimensional point cloud. Press Play to follow the sweep. The original is on the left; the enlarged measurement is on the right. The result starts empty and keeps missing returns as gaps.',
  steps: [
    {title: 'Illuminate a cross section', body: 'The fixed laser plane intersects the moving target. Red rays stop at the first surface they encounter; a ridge can prevent them from reaching a requested sample.'},
    {title: 'Observe from outside the plane', body: 'The camera is separated from the laser plane by a known baseline. Gold segments show clear views; gray ones stop where the ridge blocks the camera.'},
    {title: 'Locate the image', body: 'Both image coordinates are estimated on the selected grid. The close-up shows how rounding the depth-sensitive coordinate changes a recovered height.'},
    {title: 'Recover a point', body: 'Intersect the camera direction with the known laser plane. This gives the height and position across the line. A missing return or a point outside the depth window gives no measurement.'},
    {title: 'Keep the acquired profiles', body: 'Known table movement locates each profile in the target frame. The cloud retains those coordinates while the original moves. Rotate the result to inspect its depth and gaps.'},
  ],
  parts: [
    {name: 'Laser, camera and moving target', role: 'The actual baseline, light paths, obstruction and table motion.'},
    {name: 'An acquired cross section', role: 'A stored measured profile beside the known reference outline; missing samples sit below the outline.'},
    {name: 'From image coordinates to height', role: 'One physical pixel with an ideal spot, rounded estimate and optional finer estimation grid.'},
    {name: 'Measured point cloud', role: 'Only acquired returns, arranged in three dimensions with missing data left absent.'},
    {name: 'Depth sensitivity and distance', role: 'A comparison of ideal quantization sensitivity, distinct from real accuracy.'},
  ],
  tryIt: [
    scanTrial('system', 'Measure one point', 'Press Play, then inspect the stored profile and image estimate.', 'The default sweep acquires 25 profiles and 625 points. The stored center sample is on the 6 mm ridge; its recovered height is 5.9999 mm. The cloud is an upper-surface sample, not a closed solid.'),
    scanTrial('sensor', 'Read only whole pixels', 'Run the sweep with whole-pixel rounding.', 'The same center sample now reads 6.0232 mm high instead of 5.9999 mm. Gold rounds to the center of the enlarged pixel. Ideal grid pitch rises from 0.074 to 3.700 μm; this comparison does not predict actual camera accuracy.', {subpixel: 0}),
    scanTrial('chart', 'Widen the baseline', 'Run with the camera 16 mm from the laser plane.', 'At the 66 mm reference depth, one estimation step represents 1.01 μm of depth instead of 2.01 μm. The camera also loses 13 samples behind the ridge. Inspect the cloud to see the missing row.', {baseline: 16}),
    scanTrial('chart', 'Narrow it', 'Run with a 4 mm baseline.', 'All 625 sampled positions return at these settings. Ideal depth per step rises to 4.03 μm. A narrow baseline reduces the camera shadow here but makes height less sensitive to image position.', {baseline: 4}),
    scanTrial('chart', 'Stand further off', 'Move to a standoff of 78.5 mm and run.', 'At that reference depth, the same estimation grid represents 2.85 μm of depth rather than 2.01 μm. The original scanner moves higher, and the sensitivity marker moves along the curve.', {standoff: 78.5}),
    scanTrial('cloud', 'Raise the ridge', 'Run with a 12 mm ridge.', 'Only 600 of 625 attempts return. Ten samples lose illumination and fifteen are hidden from the camera. The raised points and the missing lower row remain separate; the cloud never draws a wall across the gap.', {ridge: 12}),
    scanTrial('cloud', 'Move the receiver over', 'Run the same tall ridge with the camera on the opposite side.', 'The sweep still returns 600 of 625 samples. The camera shadow changes sides along the direction of table travel. The illumination gaps stay fixed because the laser did not move.', {ridge: 12, side: 1}),
    scanTrial('cloud', 'Scan a flat surface', 'Remove the ridge and run the sweep.', 'All 625 attempts return. Rotating the cloud shows a single plane, with no invented thickness or underside. The tiny recovered height error comes from ideal image rounding.', {ridge: 0}),
    scanTrial('cloud', 'Leave wider gaps', 'Scan the tall ridge with samples 4 mm apart.', 'The scan makes only 49 attempts, and all return at these positions. It skips the narrow shadow sampled by the denser sweep. More successful returns as a fraction of attempts do not mean more complete detail.', {ridge: 12, spacing: 2}),
    scanTrial('profile', 'Move too close', 'Set the standoff to 53.5 mm and run.', 'The raised top is closer than the accepted depth window. Its 65 attempted samples are rejected, leaving 560 returned points. The profile shows the known reference outline but no measured marks on that top.', {standoff: 53.5}),
  ],
  deeper: [
    {title: 'A plane and a camera ray', body: 'The laser provides a known plane, while a point in the camera image gives a direction. Their intersection locates the illuminated point. The camera must sit outside the laser plane: placing both in the same plane makes this intersection ambiguous. Laser scanning can also use other methods; this lesson chooses line triangulation.'},
    {title: 'Two image coordinates recover two surface coordinates', body: 'Let X run across the line, Y be height, and Z be table travel. At one profile, the camera is at (0, H, −b) and the light plane is Z = 0. For a point (x, y, 0), depth d = H − y. With focal length f, a virtual image in front of the pinhole has u = fx/d and v = fb/d. Recover d = fb/v, x = ud/f and y = H − d. The sign of b changes when the camera changes sides. A physical sensor behind the pinhole has inverted image signs.'},
    {title: 'Table motion supplies the third coordinate', body: 'The laser and camera stay fixed while the target translates. The program removes that known translation before storing each reconstructed point. Otherwise all profiles would sit in the laser plane, or the stored shape would move with the table. Here the table travels 24 mm in 6 seconds, with profile spacing set by the Sampling control.'},
    {title: 'Pixel pitch and estimation grids', body: 'Pixel pitch is the physical spacing of detector cells. Real algorithms can estimate a light stripe’s center between cells using their intensities. This lesson does not fit intensities: it compares ideal rounding to a full pixel with rounding to 1/50 pixel. The fine divisions in the close-up are estimator positions inside one physical pixel, not fifty new detector cells. Pixel pitch and estimation mode both change the recovered coordinates.'},
    {title: 'Depth sensitivity is not an accuracy guarantee', body: 'Differentiating d = fb/v gives a local depth change of d²p/(f|b|) for image-grid pitch p. Doubling baseline halves that sensitivity; increasing depth makes it coarser. At the 66 mm reference depth, a 20 mm focal length, 8 mm baseline and 0.074 μm image step give 2.01465 μm per step. This derivative is not an exact error bound. Calibration, noise and surface behavior affect real accuracy.'},
    {title: 'Two paths and a finite depth window', body: 'An attempted upper-face point needs a clear illumination path and a clear view back to the camera. The drawn segments stop at their first ridge intersection. Separately, a point may lie outside the accepted depth window or image window. All these cases remain absent from the cloud, while profiles not yet reached are not counted as missing. Vertical faces and the underside are outside this sampling model.'},
    {title: 'What the reference scanner specifies', body: 'The Micro-Epsilon catalog lists a 53.5 to 78.5 mm depth range for the LLT29xx-25, 1,280 points per profile, and a 2 μm linearity specification under stated reference-object and averaging conditions. That linearity is a different quantity from this model’s grid sensitivity. The borrowed depth window helps demonstrate rejected points; the illustrative optics and slow sweep do not reproduce that instrument’s performance.'},
    {title: 'A cloud still needs interpretation', body: 'Completing a sweep means every selected profile was attempted. It does not reveal hidden surfaces or guarantee a printable object. More views, registration and surface reconstruction can help turn measurements into a usable model, but each adds assumptions. No unseen wall, underside or missing strip is filled here.'},
  ],
  misconception: 'A complete sweep can produce an incomplete shape. Only accepted image records become points; holes and unsampled faces do not become known merely because the original object is visible beside the result.',
  limits: `${scanLimits} ${sharedLimits}`,
  sources: [
    {title: 'Micro-Epsilon: Laser triangulation', url: 'https://www.micro-epsilon.com/wiki/laser-triangulation/'},
    sources.scanControl,
  ],
  quiz: {
    question: 'The laser lights a surface but the camera cannot see it past a ridge. What belongs in the measured cloud there?',
    options: ['No point, because no measurement was received.', 'The surface copied from the known original.', 'A flat patch joining the visible points.'],
    answer: 0,
    explanation: 'Both paths must be clear. The reference outline can explain the missing region, but it must remain separate from the acquired result.',
  },
};

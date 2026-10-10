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
export const designLimits = 'Not from a source: the cup itself and every one of its dimensions, and the infill drawn as straight lines at one spacing. The solid is described only as triangles, which is what the file format carries; the smooth surface a designer actually draws is kept elsewhere and is left out here. The slicer is reduced to layers, loops and infill: supports, brims, the order the tool walks the loops, the speed it walks them and where it starts and stops each one are all left out, and so is anything about whether the result would be strong enough.';

/** What the scanner takes without a source. */
export const scanLimits = 'Not from a source: the focal length of 20 mm, the baseline, and the sensor, chosen together so that at the catalog’s own middle of range, its own pixel and the interpolation the structured light page gives, the depth resolution comes out at the 2 μm the catalog quotes. The stepped target and its ridge are invented. The surface is taken as perfectly matte, returning light to the receiver from everywhere both paths are clear, and the geometry is taken as known exactly. Speckle, noise, lens distortion, calibration error, second reflections off shiny surfaces, and the way a real laser line has width rather than being infinitely thin are all left out. One sweep from one side is all there is: there is no second view, no merging, no surface built over the points, and nothing is ever filled in where the receiver saw nothing.';

export {threeAxisLesson} from './three-axis-lesson.js';

// ---------------------------------------------------------------------------
// Computer aided design.
// ---------------------------------------------------------------------------

const cadSolid = trial(DESIGN_DEFAULTS, 'solid'), cadFacet = trial(DESIGN_DEFAULTS, 'facet'), cadFile = trial(DESIGN_DEFAULTS, 'file'), cadSlice = trial(DESIGN_DEFAULTS, 'slice'), cadPath = trial(DESIGN_DEFAULTS, 'path');

export const cadDesignLesson = {
  simple: 'How do you write down a shape so a machine can make it?',
  overview: 'A design is a shape held as numbers. The file that carries it to a machine does not describe smooth curves at all: it lists flat triangles, and a circle becomes a ring of straight facets that never quite touches it. Then a slicer cuts the shape into layers and works out the path a tool would walk round each one. Press Play to build the shape, then change how many facets the curves get and see what it costs in triangles, in bytes and in how far the shape falls from the curve it means.',
  steps: [
    {title: 'Sketch the outline', body: 'A closed outline on a flat plane says how wide the shape is, and carries no thickness at all.'},
    {title: 'Raise it into a solid', body: 'Sweeping that outline upward gives it height and makes it a solid with an inside and an outside.'},
    {title: 'Sink the pocket', body: 'A smaller outline taken out of the middle leaves a wall around it and a floor under it.'},
    {title: 'Write the surface as triangles', body: 'The file lists the flat triangles that make up the surface, each with its corners and the direction it faces.'},
    {title: 'Cut it into layers', body: 'A slicer takes the finished shape, cuts it into flat layers, and lays out the loops and filling a tool would walk on each.'},
  ],
  parts: [
    {name: 'The cup, true size', role: 'The shape the numbers describe, in plan and in section.'},
    {name: 'One facet, 100 times larger', role: 'A flat facet against the arc it stands in for, and the gap between them.'},
    {name: 'One triangle in the file', role: 'The bytes a single triangle costs, and what each of them holds.'},
    {name: 'The layers the slicer cuts', role: 'The flat slices the shape becomes on the way to being made.'},
    {name: 'One layer, 3 times larger', role: 'The loops and the filling the tool would walk on a single layer.'},
    {name: 'What facets cost', role: 'How the gap between facet and curve falls as more facets are used.'},
  ],
  tryIt: [
    cadFacet('Describe the shape', 'Press Play and watch the shape being built.', 'The finished surface is 252 flat triangles. Each circle is a ring of straight facets meeting the curve only at their corners, so at the middle of a facet the surface falls 57.8 μm short of the circle it means; that is the radius times one minus the cosine of 5.63°, half the angle a facet spans. The facets hold 2,632 mm³ where the true curves would hold 2,649 mm³, 17.0 mm³ less.'),
    cadFacet('Use only eight facets', 'Set the facets to 8 and press Play.', 'The ring is now visibly a polygon. With 8 facets each spans 22.50° to the half, and the surface falls 913.4 μm from the curve at the middle of each one, nearly a millimeter. The whole surface is only 60 triangles and the shape has lost 264.1 mm³ against its true curves.', {facets: 8}),
    cadFile('Use a hundred and twenty eight', 'Set the facets to 128 and press Play.', 'The gap between facet and curve falls to 3.6 μm and the lost volume to 1.1 mm³, but the surface now takes 1,020 triangles and the file grows to 51,084 bytes: an 80 byte header, a 4 byte count, and 50 bytes for every triangle. Smoothness is bought by the byte.', {facets: 128}),
    cadSlice('Cut it into thinner layers', 'Set the layer height to 0.05 mm and press Play.', 'The same shape now takes 240 layers instead of 60, and the path the tool would walk grows to 103.04 m. Each bead is thinner too, carrying 0.0220 mm² rather than 0.0814, so the extra path is not extra material.', {layer: 0.05}),
    cadSlice('Cut it into thicker ones', 'Set the layer height to 0.3 mm and press Play.', 'Now it is 40 layers and 17.32 m of path. A taller layer only coarsens the staircase up the side; it does nothing at all to the facets around the shape, which are set by the design and not by the slicing.', {layer: 0.3}),
    cadPath('Walk more loops', 'Set the loops to 4 and press Play.', 'Four loops of 0.45 mm do not measure 1.80 mm across but 1.671 mm, because a bead is a rectangle with a rounded end each side and neighbors overlap those ends. The path grows to 38.51 m, and the loops now fill the wall completely, leaving nothing between them to fill in.', {perimeters: 4}),
    cadPath('Fill the wall solid', 'Set the infill to 100% and press Play.', 'Filling everything the loops leave takes the path to 30.08 m. Infill only ever fills what the loops did not reach, which is why a wall thin enough to be covered by its loops takes no infill however high the setting.', {infill: 100}),
  ],
  deeper: [
    {title: 'A surface of triangles', body: 'The file format’s page says it describes a raw, unstructured triangulated surface by the unit normal and vertices of the triangles, ordered by the right hand rule. There is no curve anywhere in it. For the surface to be a solid rather than a sheet, its page adds, it must be closed and connected, every edge shared by exactly two faces, and not self intersecting. Here the outer wall, the pocket wall and the rim are each a band of two triangles a facet, and the pocket floor and the underside are each a fan, 252 in all.'},
    {title: 'How far a facet falls from its curve', body: 'A facet is a straight chord across the arc it replaces, and the distance from the middle of that arc to the middle of its chord is what geometry calls the sagitta. For a ring of facets each spanning a full turn divided by their number, the gap is the radius times one minus the cosine of half that angle. At 32 facets on a 12 mm radius it is 57.8 μm; at 8 facets it is 913.4 μm and at 128 it is 3.6 μm, a fall of about 250 times across the range, which is why the chart of it is drawn on its logarithm.'},
    {title: 'What a triangle costs', body: 'A binary file opens with an 80 byte header and a 4 byte count of the triangles. Then every triangle is 12 numbers of 4 bytes, three for the direction the face points and nine for its three corners, and 2 more bytes after them: 50 bytes each. So the whole file is 84 bytes plus 50 a triangle, and the 252 triangles of this shape come to 12,684 bytes while the 1,020 of its smoothest version come to 51,084.'},
    {title: 'What a slicer adds', body: 'The slicer’s page says it segments the object as a stack of flat layers and then describes those layers through linear movements of the extruder, compiled into machine instructions. None of that is in the design. The design says what shape is wanted; the slicer decides how tall a layer is, how many loops to walk, and how much of the inside to fill, and the same shape sliced differently becomes a different set of instructions without a single number of the design changing.'},
    {title: 'Why a bead is not a rectangle', body: 'Prusa’s page says the slicer takes the cross section of an extrusion to be a rectangle with semicircular ends, and that the width includes those ends. So two beads laid side by side overlap where their round ends meet: its own example puts two 0.45 mm perimeters at a 0.2 mm layer height at 0.86 mm rather than 0.90 mm. The same arithmetic here gives 0.857 mm, and the cross section of one bead, 0.0814 mm², is what turns a path length into a volume.'},
    {title: 'What the layer height can be', body: 'Prusa’s page says the layer height should be below 80 percent of the nozzle diameter, which puts about 0.32 mm at the top for a 0.4 mm nozzle, and that it does not suggest going below 0.10 mm because the gain over 0.07 or 0.05 mm layers is small against much longer prints. It also says plainly that layer height changes only the vertical resolution: an embossed detail lying flat looks the same whatever the layer height, because that detail is in the facets, not in the slicing.'},
  ],
  misconception: 'The file that describes a shape does not hold curves. It holds flat triangles, so every curve in the design is already an approximation before any machine touches it, and how good an approximation is a choice someone made.',
  limits: `${designLimits} ${sharedLimits}`,
  sources: [sources.stl, sources.slicer, sources.prusaLayers, sources.sagitta, sources.fff, sources.cad],
  quiz: {
    question: 'Why does a curve in a finished design never quite reach the circle it stands for?',
    options: ['The surface is made of flat triangles, so each one cuts a chord across the arc.', 'The machine that makes it cannot move accurately enough.', 'The file rounds off the numbers it stores.'],
    answer: 0,
    explanation: 'At 32 facets on this shape the surface falls 57.8 μm short of the curve at the middle of each facet. Adding facets closes the gap and costs triangles and bytes; it never shuts it completely.',
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

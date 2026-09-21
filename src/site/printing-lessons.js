import {STAGE_DEFAULTS, DESIGN_DEFAULTS, SCAN_DEFAULTS} from './printing-physics.js';

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
export const sharedLimits = 'The three benches share one idea and one piece of code: a position that exists only on a grid. The stage rounds a commanded millimeter to a whole microstep and the scanner rounds a measured spot to a whole sensor cell, and the same function does both.';

/** What the stage takes without a source. */
export const stageLimits = 'Not from a source: the 20 tooth pulley, which with the sourced 2 mm belt pitch gives exactly the 80 steps a millimeter Marlin ships; the stage’s size and its out and back move; and the play in the coupling, which Marlin ships at zero and measures rather than assumes. The drive is taken as ideal: the motor never loses a step, the belt does not stretch, nothing flexes under load, and the only two things standing between the point asked for and the point reached are the step grid and the play. Motor torque, current, heating and resonance are left out, and so is homing, which is what tells a real machine where zero is.';

/** What the design takes without a source. */
export const designLimits = 'Not from a source: the cup itself and every one of its dimensions, and the infill drawn as straight lines at one spacing. The solid is described only as triangles, which is what the file format carries; the smooth surface a designer actually draws is kept elsewhere and is left out here. The slicer is reduced to layers, loops and infill: supports, brims, the order the tool walks the loops, the speed it walks them and where it starts and stops each one are all left out, and so is anything about whether the result would be strong enough.';

/** What the scanner takes without a source. */
export const scanLimits = 'Not from a source: the focal length of 20 mm, the baseline, and the sensor, chosen together so that at the catalog’s own middle of range, its own pixel and the interpolation the structured light page gives, the depth resolution comes out at the 2 μm the catalog quotes. The stepped target and its ridge are invented. The surface is taken as perfectly matte, returning light to the receiver from everywhere both paths are clear, and the geometry is taken as known exactly. Speckle, noise, lens distortion, calibration error, second reflections off shiny surfaces, and the way a real laser line has width rather than being infinitely thin are all left out. One sweep from one side is all there is: there is no second view, no merging, no surface built over the points, and nothing is ever filled in where the receiver saw nothing.';

// ---------------------------------------------------------------------------
// Three axis positioning.
// ---------------------------------------------------------------------------

const stageGrid = trial(STAGE_DEFAULTS, 'grid'), stageLash = trial(STAGE_DEFAULTS, 'lash'), stageChart = trial(STAGE_DEFAULTS, 'chart'), stageDrive = trial(STAGE_DEFAULTS, 'drive');

export const threeAxisLesson = {
  simple: 'How does a machine put a tool exactly where you asked?',
  overview: 'A stepper motor does not turn smoothly; it turns in steps, and its driver can split each step into smaller ones. A belt or a screw turns that turning into travel, so the tool can stop only on a grid of fixed places. Ask for a point between two of them and the machine goes to the nearer one. Reverse, and the play in the coupling is given up before anything moves at all. Press Play to run a move out and back, then change the motor, the driver, the drive and the play.',
  steps: [
    {title: 'Count the steps', body: 'The motor turns by a fixed angle each time it is told to step, and the driver can divide that angle further.'},
    {title: 'Turn turning into travel', body: 'A toothed belt on a pulley, or a screw in a nut, carries a fixed distance for every turn of the motor.'},
    {title: 'Round to a step', body: 'Dividing the steps a turn by the distance a turn carries gives the steps a millimeter, and the tool can stop only on those.'},
    {title: 'Plan the speed', body: 'The drive cannot start at speed. It ramps up, holds the feed rate if the move is long enough to reach it, and ramps down in time to stop.'},
    {title: 'Give up the play on a reversal', body: 'Turning back, the drive crosses the slack in the coupling before it touches the other face, so the tool stands still for that much of the move.'},
  ],
  parts: [
    {name: 'The stage, true size', role: 'The rail, the carriage and the belt that carry the tool.'},
    {name: 'The motor, true size', role: 'The stepper whose fixed step angle every position is counted in.'},
    {name: 'Belt or screw, close up', role: 'What turns a revolution into a distance.'},
    {name: 'The step grid', role: 'Every place the drive can actually stand, and the gap left over.'},
    {name: 'Lost motion, close up', role: 'The play the coupling gives up whenever the drive reverses.'},
    {name: 'Speed through the move', role: 'The ramp up, the cruise and the ramp down the acceleration limit forces.'},
  ],
  tryIt: [
    stageGrid('Ask for a point between two steps', 'Ask the stage for 6.37 mm and press Play.', 'A 1.8° motor takes 200 whole steps a turn, and a driver dividing each into 16 makes 3,200 a turn. A 20 tooth pulley at a 2 mm pitch carries 40.0 mm a turn, so the stage moves in steps of 12.50 μm and can stand nowhere else. The nearest one to 6.37 mm is 6.3750 mm, which is 5.00 μm away; rounding can never miss by more than half a step, 6.25 μm.'),
    stageGrid('Turn the driver off', 'Set the driver to whole steps and press Play.', 'Now the motor moves only in its own 200 steps a turn, so the grid is 200.00 μm wide. The nearest place to the point asked for is 6.4000 mm, a whole 30.00 μm away, and the worst the stage could be is 100.00 μm.', {micro: 0}),
    stageGrid('Divide the step finely', 'Set the driver to its finest division and press Play.', 'A step is now cut into 32, making 6,400 a turn and a grid 6.25 μm wide. The stage reaches 6.3688 mm, 1.25 μm from the point asked for. The page these motors come from warns that this is not free: step travel stays even only down to about a tenth of a step.', {micro: 5}),
    stageDrive('Drive it with a screw instead', 'Choose the screw axis and press Play.', 'The screw carries only 0.8 mm a turn against the belt’s 40.0 mm, so the same 3,200 microsteps a turn now make 4,000.0 steps a millimeter and a grid just 0.25 μm wide; this is exactly what Marlin ships for its up and down axis. The point asked for lands on a step exactly. The cost is speed: the axis is held to 2.25 mm/s, so the move takes 5.71 s instead of a third of a second.', {axis: 1}),
    stageLash('Take the play out', 'Set the lost motion to 0 mm and press Play.', 'With no slack in the coupling the carriage follows the drive in both directions and comes back to 0.0 μm from where it started.', {lash: 0}),
    stageLash('Put the play back', 'Set the lost motion to 0.5 mm and press Play.', 'Going out, the drive pushes on one face and the carriage follows it exactly. Coming back it has to cross the whole slot before it touches the other face, so the carriage stops 500.0 μm short of where it began. Nothing was miscounted; the motion was simply lost.', {lash: 0.5}),
    stageChart('Ask for a move too short to get up to speed', 'Ask for a 1 mm move at 200 mm/s with 3,000 mm/s² and press Play.', 'The move never reaches the feed rate asked for. It accelerates for 0.50 mm, which is half the whole move, tops out at 54.77 mm/s and brakes from there, so the speed is a triangle with no flat top and the whole move out and back takes 0.07 s.', {travel: 1, feed: 200, accel: 3000}),
  ],
  deeper: [
    {title: 'Where the steps a millimeter come from', body: 'Marlin asks for one number an axis: how many steps make a millimeter. Its own page says that number depends on belt pitch, the teeth on the pulley, the thread pitch on lead screws and the microstepping, and it ships 80 for the two flat axes and 4000 for the up and down one. Both fall straight out of the arithmetic: 200 steps a turn at a sixteenth is 3,200 microsteps, over a 20 tooth pulley of 2 mm pitch carrying 40.0 mm a turn, is 80.0; the same 3,200 over an M5 screw carrying 0.8 mm a turn is 4,000.0.'},
    {title: 'Finer is not always better', body: 'Dividing a step further shrinks the grid, and the machine lands nearer what was asked. But the page on stepper motors says that a motor holds its 3 or 5 percent evenness of step travel only down to about a tenth of a step, and that past that the repeatability decays until many microstep commands can pass before anything moves at all and the motion arrives as a jump. The grid this model draws is the ideal one; a real motor sits somewhere inside each cell.'},
    {title: 'Why a reversal loses motion', body: 'The page on backlash calls it lash, play or slop, and says it shows itself when the direction of movement is reversed and the lost motion is taken up before the reversal is complete. That is exactly what the close up draws: a slot the drive must cross before it touches the far face. Marlin can compensate for it, ships the distance at zero because it is a property of the machine and not of the firmware, and when asked to measure it does so to 5.00 μm and expects an answer under 0.5 mm.'},
    {title: 'Arriving together', body: 'Marlin says a linear move traces a straight line from one point to another, ensuring that the specified axes arrive simultaneously at the given coordinates. That is why the axes cannot simply run at their own speeds: they are scaled so they finish together, and the slowest one sets the pace. It is also why the screw axis is the one that hurts, because its ceiling of 2.25 mm/s is a two hundredth of the belts’ 500 mm/s.'},
    {title: 'Why it cannot start at speed', body: 'Marlin ships an acceleration of 3000 mm/s² and explains it as an axis gaining 100 mm/s within a thirtieth of a second. A move long enough to reach its feed rate spends a ramp getting there, cruises, and spends an equal ramp stopping. A short move never gets there at all: it accelerates to the middle and brakes, and its top speed is the square root of the acceleration times the length. That is why a machine covered in short segments runs far below the speed it was asked for.'},
    {title: 'What the book draws and what this draws', body: 'The book’s spread on this machine has chains and cogs turning the two flat axes and a screw turning the up and down one, with a plate that moves backward and forward under a head that moves side to side. The kinematics here are the same and the drive is different: a toothed belt in place of the chain, which is what small machines actually use now, and what lets the pitch and the tooth count be quoted as one number. A chain and a belt both carry a fixed distance for every turn of their cog, which is the only property any of this arithmetic needs.'},
  ],
  misconception: 'Asking for a position is not the same as reaching it. The machine can only stop where its steps let it, and reversing costs it whatever play the coupling holds, so the point reached is always the nearest one it can stand on and sometimes not even that.',
  limits: `${stageLimits} ${sharedLimits}`,
  sources: [sources.marlinConfig, sources.marlinMove, sources.calculator, sources.stepper, sources.nema17, sources.datasheet, sources.backlash, sources.leadscrew],
  quiz: {
    question: 'Why does the carriage not come back to exactly where it started?',
    options: ['The drive has to cross the play in its coupling before it pushes the other way.', 'The motor forgets how many steps it has taken.', 'The belt stretches a little more each time it is used.'],
    answer: 0,
    explanation: 'The count is never lost. With half a millimeter of play the drive spends the first half millimeter of the return crossing the slot, so the carriage stands still for it and stops 500.0 μm short.',
  },
};

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

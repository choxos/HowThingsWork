import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Making a three dimensional object: a design held as numbers, a machine that
// puts a tool at a point in space, and a scanner that measures a real object
// back into numbers.
//
// The three share one piece of physics: a position that exists only on a grid.
// The stage can stop only on whole microsteps, so a commanded millimeter is
// rounded to the nearest one; the scanner can read the laser only on whole
// sensor pixels, so a measured spot is rounded the same way. Both call
// `onGrid`, and both report the residual it leaves. The grid is 12.5 μm wide
// on the stage at Marlin's 80 steps per millimeter and 3.7 μm wide on the
// sensor at the pixel pitch of a real camera; the same function answers both.
// The slicer is the other link: the path it lays out for one layer is handed
// to the stage's own planner, so the design's facets set the move times.
//
// Exact within the model: steps per millimeter from step angle, microstepping
// and either belt pitch times pulley teeth or screw lead; the reached point as
// the commanded point rounded to the nearest microstep; lost motion on a
// reversal as a dead band the drive must cross before the table follows; a
// move's trapezoidal speed profile under an acceleration and a feed rate limit,
// and where it stands at a time; the area and volume of a regular polygon
// standing in for a circle, and the chord error the sagitta gives; the triangle
// count and byte size of a binary STL file; a bead's cross section as a
// rectangle with two semicircular ends; and laser triangulation, where a point
// at depth z on the laser plane images at u = f·b/z, so z = f·b/u and one pixel
// of pitch p is worth z²·p/(f·b) of depth.
//
// Sourced: 200 full steps a revolution at 1.8°, and 400 at 0.9° and 48 at 7.5°;
// microstepping to 1/32; step travel repeatable to 3 or 5 percent down to about
// 1/10 step; a NEMA 17's 43.18 mm faceplate; one motor's step angle, phases,
// current, voltage, resistance, inductance and holding torque; a belt pitch of
// 2 mm and the M5, M6, M8 and 8 mm screw leads; Marlin's 80, 80 and 4000 steps
// per millimeter, its feed rate and acceleration limits, its default
// acceleration of 3000 mm/s², its junction deviation, and the 0.5 mm limit and
// 5 μm resolution of its backlash measurement; a binary STL's 80 byte header,
// 4 byte count and 50 bytes a triangle; Prusa's layer height band, its 0.45 mm
// extrusion width, its 0.86 mm for two of them at a 0.2 mm layer, its two
// perimeter minimum and its 0.20 mm first layer; a nozzle of 0.3 to 1.0 mm;
// a laser profile scanner's 53.5, 66 and 78.5 mm measuring range, its 25 mm
// height, its 2 μm line linearity, its 1,280 points a profile, its 2,000 Hz and
// its 658 nm laser; sub-pixel interpolation down to 1/50 pixel; and pixel
// pitches of 1.1, 3.7 and 6 μm.
//
// Declared, not from a source: the 20 tooth pulley that, with the sourced 2 mm
// pitch, gives Marlin's sourced 80 steps per millimeter; the stage's 60 mm of
// travel and its out and back move; the cup the design describes and every one
// of its dimensions; the infill drawn as straight lines at one spacing; the
// scanner's focal length of 20 mm, its baseline of 8 mm and its 1,280 pixel
// sensor line, chosen so that at the sourced 66 mm, the sourced 3.7 μm pixel
// and the sourced 1/50 pixel interpolation the depth resolution comes out at
// the 2 μm the catalog gives; the stepped target and its ridge; and a surface
// that returns light to the receiver from everywhere the two paths are clear.
// ---------------------------------------------------------------------------

// --- Sourced constants ------------------------------------------------------

/** Full steps a revolution and the step angle that goes with each, from Prusa's RepRap Calculator. */
export const MOTORS = Object.freeze([
  Object.freeze({steps: 48, angle: 7.5}),
  Object.freeze({steps: 200, angle: 1.8}),
  Object.freeze({steps: 400, angle: 0.9}),
]);

/** Microstepping divisors a driver offers, from Prusa's RepRap Calculator. */
export const MICROSTEPS = Object.freeze([1, 2, 4, 8, 16, 32]);

/** One NEMA 17: faceplate in mm, step angle, phases, holding torque in N·cm, rated current in A, rated voltage in V, resistance in ohm a phase, inductance in mH a phase, mass in kg, and the percent a full step's travel is repeatable to. */
export const MOTOR = Object.freeze({faceplate: 43.18, angle: 1.8, phases: 2, holding: 36, current: 1.68, voltage: 2.8, resistance: 1.65, inductance: 3.2, mass: 0.28, repeatableLow: 3, repeatable: 5, smoothTo: 10});

/** Belt pitch in mm, from Prusa's RepRap Calculator; the 20 tooth pulley is declared. */
export const BELT = Object.freeze({pitch: 2, teeth: 20});

/** Screw leads in mm a revolution, from Prusa's RepRap Calculator: M5, M6, M8 and the 8 mm its own default reads. */
export const LEADS = Object.freeze({m5: 0.8, m6: 1, m8: 1.25, tall: 8});

/** Marlin's defaults: steps a millimeter, feed rate limits in mm/s, acceleration limits in mm/s², the printing acceleration, junction deviation and minimum planner speed in mm, and the limit and resolution of its backlash measurement in mm. */
export const MARLIN = Object.freeze({
  stepsPerMm: Object.freeze([80, 80, 4000, 500]),
  maxFeed: Object.freeze([500, 500, 2.25, 45]),
  maxAccel: Object.freeze([3000, 3000, 100, 10000]),
  accel: 3000, junction: 0.013, minimumSpeed: 0.05, lashLimit: 0.5, lashResolution: 0.005,
});

/** A binary STL file: header bytes, count bytes, floats a triangle, bytes a float and the attribute bytes after each triangle. */
export const STL = Object.freeze({header: 80, count: 4, floats: 12, floatBytes: 4, attribute: 2});

/** Prusa's slicing figures, mm: the layer heights it suggests and allows, the nozzle it assumes, its extrusion width, what two of them measure at a 0.2 mm layer, its first layer and its perimeter minimum. */
export const SLICING = Object.freeze({suggestFrom: 0.1, fine: Object.freeze([0.07, 0.05]), nozzle: 0.4, share: 0.8, width: 0.45, twoPerimeters: 0.86, atLayer: 0.2, firstLayer: 0.2, minimumPerimeters: 2, nozzleRange: Object.freeze([0.3, 1])});

/** One laser profile scanner: measuring range in mm at start, middle and end, its height, line linearity in μm, points a profile, profile rates in Hz and the laser's wavelength in nm and power in mW. */
export const SCANNER = Object.freeze({start: 53.5, middle: 66, end: 78.5, height: 25, linearity: 2, points: 1280, standard: 300, fast: 2000, wavelength: 658, power: 8});

/** Pixel pitches of three real cameras, μm. */
export const PIXELS = Object.freeze([1.1, 3.7, 6]);

/** Sub-pixel interpolation: a whole pixel, or the 1/50 pixel structured light reaches. */
export const SUBPIXELS = Object.freeze([1, 50]);

// --- The physics the stage and the scanner share ----------------------------

/**
 * A value a machine can reach only on a grid `pitch` wide: how many grid steps
 * that is, where it lands, and how far that is from what was asked. The stage
 * calls this with a microstep and the scanner with a sensor pixel.
 */
export function onGrid(value, pitch) {
  if (!Number.isFinite(value) || !Number.isFinite(pitch) || pitch <= 0) throw new RangeError('onGrid needs a finite value and a positive pitch');
  const steps = Math.round(value / pitch), reached = steps * pitch;
  return {steps, reached, residual: reached - value, worst: pitch / 2};
}

/**
 * Where a table stands when its drive stands at `motor` and the coupling has
 * `lash` of play, given where the table was. The table can lie anywhere from
 * `motor` to `motor + lash`, and moves only when the drive pushes it to one of
 * those bounds, which is what lost motion on a reversal means. The slack starts
 * taken up in the positive direction, so an outward move is exact and the
 * return falls short.
 */
export const followWithLash = (was, motor, lash) => Math.min(Math.max(was, motor), motor + lash);

// --- Steps a millimeter -----------------------------------------------------

/** Steps a millimeter for a belt: whole steps a revolution times the microstepping, over the millimeters a revolution carries. */
export const beltStepsPerMm = (steps, micro, pitch = BELT.pitch, teeth = BELT.teeth) => steps * micro / (pitch * teeth);

/** Steps a millimeter for a screw: the same, over the screw's lead. */
export const screwStepsPerMm = (steps, micro, lead) => steps * micro / lead;

// --- A move under an acceleration limit ------------------------------------

/**
 * A move of `length` mm under acceleration `accel` and feed rate `feed`: the
 * top speed it actually reaches, how far each ramp runs, how far it cruises and
 * how long it takes. A move too short to reach the feed rate is a triangle with
 * no cruise, and its top speed is sqrt(accel × length).
 */
export function trapezoid(length, feed, accel) {
  if (!(length > 0)) return {length: 0, top: 0, ramp: 0, cruise: 0, time: 0, triangular: true};
  const peak = Math.sqrt(accel * length);
  if (peak <= feed) return {length, top: peak, ramp: length / 2, cruise: 0, time: 2 * peak / accel, triangular: true};
  const ramp = feed * feed / (2 * accel);
  return {length, top: feed, ramp, cruise: length - 2 * ramp, time: 2 * feed / accel + (length - 2 * ramp) / feed, triangular: false};
}

/** How far along a trapezoidal move it has gone after `t` seconds, and how fast it is going. */
export function trapezoidAt(profile, t, accel) {
  const {top, ramp, cruise, time, length} = profile;
  if (!(length > 0) || t <= 0) return {distance: 0, speed: 0};
  if (t >= time) return {distance: length, speed: 0};
  const rampTime = top / accel, cruiseTime = cruise > 0 ? cruise / top : 0;
  if (t <= rampTime) return {distance: accel * t * t / 2, speed: accel * t};
  if (t <= rampTime + cruiseTime) return {distance: ramp + top * (t - rampTime), speed: top};
  const down = t - rampTime - cruiseTime;
  return {distance: ramp + cruise + top * down - accel * down * down / 2, speed: Math.max(0, top - accel * down)};
}

// --- A curve made of flat facets -------------------------------------------

/** The gap between a chord of a regular `facets`-gon and the circle of radius `radius` it stands in for: the sagitta of half a facet's arc. */
export const chordError = (radius, facets) => radius * (1 - Math.cos(Math.PI / facets));

/** The area of a regular `facets`-gon whose corners sit on a circle of radius `radius`. */
export const polygonArea = (radius, facets) => facets * radius * radius * Math.sin(2 * Math.PI / facets) / 2;

/** The length once around that polygon. */
export const polygonPerimeter = (radius, facets) => 2 * facets * radius * Math.sin(Math.PI / facets);

/** Bytes a binary STL file of `triangles` triangles takes: an 80 byte header, a 4 byte count, and 12 floats of 4 bytes plus 2 attribute bytes each. */
export const stlBytes = triangles => STL.header + STL.count + triangles * (STL.floats * STL.floatBytes + STL.attribute);

/** The cross section of one bead, mm²: a rectangle `width` wide and `layer` tall with a semicircular end at each side. */
export const beadArea = (width, layer) => width * layer - layer * layer * (1 - Math.PI / 4);

/** How wide `count` beads laid side by side measure, mm: their widths less the overlap each shared edge saves. */
export const beadsWide = (count, width, layer) => count * width - (count - 1) * layer * (1 - Math.PI / 4);

// --- Laser triangulation ----------------------------------------------------

/** Where a point at depth `z` on the laser plane falls on the sensor, mm from the axis: u = f·b/z. */
export const imageOf = (z, focal, baseline) => focal * baseline / z;

/** The depth a spot `u` mm off the sensor's axis implies: z = f·b/u. */
export const depthOf = (u, focal, baseline) => focal * baseline / u;

/** The depth one grid step of `pitch` mm on the sensor is worth at depth `z`: z²·p/(f·b), from differentiating z = f·b/u. */
export const depthResolution = (z, focal, baseline, pitch) => z * z * pitch / (focal * baseline);

// --- The three machines -----------------------------------------------------

// The two flat axes are the same mechanism, so the choice that matters is belt
// against screw, not X against Y.
const AXIS_NAMES = Object.freeze(['belt', 'screw']);
export const AXIS_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'a belt axis'}), Object.freeze({value: 1, label: 'the screw axis'})]);
export const MOTOR_OPTIONS = Object.freeze(MOTORS.map((motor, value) => Object.freeze({value, label: `${motor.angle}°, ${motor.steps} a turn`})));
export const MICRO_OPTIONS = Object.freeze(MICROSTEPS.map((micro, value) => Object.freeze({value, label: micro === 1 ? 'whole steps' : `${micro} microsteps`})));
export const PIXEL_OPTIONS = Object.freeze(PIXELS.map((pitch, value) => Object.freeze({value, label: `${pitch} μm pixels`})));
export const SUBPIXEL_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'whole pixels'}), Object.freeze({value: 1, label: 'a fiftieth of a pixel'})]);
export const SPACING_OPTIONS = Object.freeze([1, 2, 4].map((mm, value) => Object.freeze({value, label: `${mm} mm apart`})));
export const SIDE_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'one side'}), Object.freeze({value: 1, label: 'the other side'})]);

/** Declared: the stage's travel in mm, the two legs of its move, and the seconds the drawn move is stretched to fill. */
export const STAGE = Object.freeze({travel: 60, target: 4, legs: 2});

export const STAGE_DEFAULTS = Object.freeze({axis: 0, motor: 1, micro: 4, travel: 6.37, feed: 60, accel: 1000, lash: 0.1});
export const STAGE_DOMAINS = Object.freeze({
  axis: Object.freeze([0, 1, 1]), motor: Object.freeze([0, 2, 1]), micro: Object.freeze([0, 5, 1]),
  travel: Object.freeze([1, 20, 0.01]), feed: Object.freeze([5, 200, 5]), accel: Object.freeze([100, 3000, 100]), lash: Object.freeze([0, 0.5, 0.005]),
});

const stagePlans = new Map();

/** Everything about the stage that does not change as its move runs. */
export function stagePlan(input) {
  const values = validateControls(input, STAGE_DEFAULTS, STAGE_DOMAINS, 'three axis stage');
  const key = JSON.stringify(values);
  if (stagePlans.has(key)) return stagePlans.get(key);
  const {axis, travel, lash} = values, motor = MOTORS[values.motor], micro = MICROSTEPS[values.micro];
  // A belt axis is Marlin's X and Y; the screw axis is its Z, whose shipped
  // 4000 steps a millimeter is exactly 200 steps at a sixteenth over an M5 lead.
  const belt = axis === 0, slot = belt ? 0 : 2, lead = belt ? BELT.pitch * BELT.teeth : LEADS.m5;
  const stepsPerMm = belt ? beltStepsPerMm(motor.steps, micro) : screwStepsPerMm(motor.steps, micro, LEADS.m5);
  const microstep = 1 / stepsPerMm;
  const feed = Math.min(values.feed, MARLIN.maxFeed[slot]), accel = Math.min(values.accel, MARLIN.maxAccel[slot]);
  const commanded = travel, target = onGrid(commanded, microstep);
  const out = trapezoid(target.reached, feed, accel), back = trapezoid(target.reached, feed, accel);
  const legs = [
    {from: 0, to: target.reached, sign: 1, profile: out, start: 0},
    {from: target.reached, to: 0, sign: -1, profile: back, start: out.time},
  ];
  const duration = out.time + back.time;
  // A belt move takes a fraction of a second and a screw move takes many, so the
  // drawing stretches each to about the same few seconds and reports the factor.
  const slow = Math.max(1, Math.min(20, Math.round(STAGE.target / duration)));
  // Where the table ends: the drive returns to 0 but the lash is only taken up
  // in the direction it is moving, so the table stops short by the lash.
  let table = 0;
  table = followWithLash(table, target.reached, lash);
  const outTable = table;
  table = followWithLash(table, 0, lash);
  const plan = {
    values, axis, axisName: AXIS_NAMES[axis], belt, motor, micro, stepsPerMm, microstep, microstepMicrons: microstep * 1000,
    commanded, reached: target.reached, residual: target.residual, residualMicrons: target.residual * 1000, steps: target.steps, worst: target.worst,
    feed, accel, askedFeed: values.feed, askedAccel: values.accel, feedCapped: values.feed > MARLIN.maxFeed[slot], accelCapped: values.accel > MARLIN.maxAccel[slot],
    lash, legs, duration, out, back, outTable, endTable: table, lost: table - 0,
    slow, marlinStepsPerMm: MARLIN.stepsPerMm[slot], maxFeed: MARLIN.maxFeed[slot], maxAccel: MARLIN.maxAccel[slot], lead,
    // At the far end of the move the drive has to be told to stop somewhere it can stand.
    stepsCommanded: target.steps, fullSteps: target.steps / micro,
  };
  if (stagePlans.size >= 64) stagePlans.clear();
  stagePlans.set(key, plan);
  return plan;
}

/** The stage `time` seconds into its move: where the drive stands, where the table stands, and how fast. */
export function stageAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration);
  let motor = 0, speed = 0, leg = 0;
  for (let i = 0; i < plan.legs.length; i++) {
    const item = plan.legs[i], within = t - item.start;
    if (within < 0) break;
    leg = i;
    const now = trapezoidAt(item.profile, within, plan.accel);
    motor = item.from + item.sign * now.distance;
    speed = within >= item.profile.time ? 0 : now.speed;
  }
  // The table follows the drive through the whole move, so the lash is taken up
  // where the drive crosses it, not at the end.
  let table = 0;
  const grain = Math.max(1, Math.ceil(t * 400));
  for (let i = 1; i <= grain; i++) {
    const at = t * i / grain;
    let position = 0;
    for (let j = 0; j < plan.legs.length; j++) {
      const item = plan.legs[j], within = at - item.start;
      if (within < 0) break;
      position = item.from + item.sign * trapezoidAt(item.profile, within, plan.accel).distance;
    }
    table = followWithLash(table, position, plan.lash);
  }
  return {time, t, leg, motor, table, speed, moving: speed > 0, gap: table - motor, done: time >= plan.duration};
}

export const sampleStage = (input, time = 0) => stageAt(stagePlan(input), time);

/** Declared: the cup the design describes, and how many times larger the facet is drawn. */
// The wall starts thick enough that two loops of the default bead leave room
// between them; a thinner wall is filled by its loops alone and has nothing to
// infill, which is true of a real thin wall and is said in the reading.
export const DESIGN_DEFAULTS = Object.freeze({radius: 12, facets: 32, height: 12, wall: 2.4, layer: 0.2, width: 0.45, perimeters: 2, infill: 15});
export const DESIGN_DOMAINS = Object.freeze({
  radius: Object.freeze([6, 20, 1]), facets: Object.freeze([8, 128, 8]), height: Object.freeze([6, 24, 1]), wall: Object.freeze([0.8, 3, 0.1]),
  layer: Object.freeze([0.05, 0.3, 0.05]), width: Object.freeze([0.35, 0.7, 0.05]), perimeters: Object.freeze([1, 4, 1]), infill: Object.freeze([0, 100, 5]),
});

/** Declared: the cup's base thickness follows its wall, the infill is drawn as straight lines, and the construction takes this long. */
export const DESIGN = Object.freeze({build: 9, infillAngle: Math.PI / 4, facetTimes: 2, slow: 1});

const designPlans = new Map();

/**
 * The cup the design describes: a round outer wall, a round pocket inside it and
 * a floor under the pocket, every curve standing in for a circle as a regular
 * polygon of `facets` sides.
 */
export function designPlan(input) {
  const values = validateControls(input, DESIGN_DEFAULTS, DESIGN_DOMAINS, 'computer aided design');
  const key = JSON.stringify(values);
  if (designPlans.has(key)) return designPlans.get(key);
  const {radius, facets, height, wall, layer, width, perimeters, infill} = values;
  const inner = Math.max(0, radius - wall), base = wall, pocket = Math.max(0, height - base);
  // The surface as triangles: the outer wall, the pocket wall and the rim are
  // each a band of 2 triangles a facet; the pocket floor and the underside are
  // each a fan of facets minus 2.
  const triangles = 3 * 2 * facets + 2 * (facets - 2);
  const bytes = stlBytes(triangles);
  const outerError = chordError(radius, facets), innerError = chordError(inner, facets);
  const roundVolume = Math.PI * radius * radius * height - Math.PI * inner * inner * pocket;
  const facetedVolume = polygonArea(radius, facets) * height - polygonArea(inner, facets) * pocket;
  const layers = Math.max(1, Math.round(Math.ceil(height / layer - 1e-9)));
  const lastLayer = height - (layers - 1) * layer;
  const bead = beadArea(width, layer), shell = beadsWide(perimeters, width, layer);
  const fits = Math.max(1, Math.floor((wall + layer * (1 - Math.PI / 4)) / (width + layer * (1 - Math.PI / 4)) + 1e-9));
  // One layer above the floor: `perimeters` loops around the outside and the
  // same inside, then straight infill lines across whatever the shells leave.
  const loopsOut = Array.from({length: perimeters}, (_, k) => polygonPerimeter(Math.max(0, radius - (k + 0.5) * width), facets));
  const loopsIn = Array.from({length: perimeters}, (_, k) => polygonPerimeter(Math.max(0, inner + (k + 0.5) * width), facets));
  const wallPath = loopsOut.reduce((a, b) => a + b, 0) + (inner > 0 ? loopsIn.reduce((a, b) => a + b, 0) : 0);
  const shellOuter = Math.max(0, radius - shell), shellInner = inner > 0 ? inner + shell : 0;
  const gap = Math.max(0, shellOuter - shellInner);
  const fillArea = inner > 0 ? Math.max(0, polygonArea(shellOuter, facets) - polygonArea(shellInner, facets)) : polygonArea(shellOuter, facets);
  const fillPath = infill > 0 ? fillArea * (infill / 100) / width : 0;
  const floorPath = polygonPerimeter(radius, facets) * perimeters + polygonArea(shellOuter, facets) / width;
  const layerPath = wallPath + fillPath;
  const floorLayers = Math.max(0, Math.min(layers, Math.round(base / layer)));
  const totalPath = floorLayers * floorPath + (layers - floorLayers) * layerPath;
  const printVolume = totalPath * bead;
  const plan = {
    values, radius, facets, height, wall, inner, base, pocket, layer, width, perimeters, infill,
    triangles, bytes, outerError, innerError, roundVolume, facetedVolume, missing: roundVolume - facetedVolume,
    layers, lastLayer, bead, shell, fits, wallPath, fillPath, fillArea, gap, layerPath, floorPath, floorLayers, totalPath, printVolume,
    vertices: 2 * facets + 2 * facets, edges: triangles * 3 / 2,
    duration: DESIGN.build, sketchEnds: DESIGN.build / 3, extrudeEnds: 2 * DESIGN.build / 3,
    nozzleLimit: SLICING.nozzle * SLICING.share, thin: shell > wall + 1e-9,
    // What the stage makes of one layer: the same planner, at a stated feed.
    layerMove: trapezoid(layerPath, SLICING.width * 100, MARLIN.accel),
  };
  if (designPlans.size >= 64) designPlans.clear();
  designPlans.set(key, plan);
  return plan;
}

/** The design `time` seconds into its construction: the sketch drawn, the wall risen, and the pocket sunk. */
export function designAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), third = plan.duration / 3;
  const sketch = clamp(t / third), risen = clamp((t - third) / third), sunk = clamp((t - 2 * third) / third);
  const drawn = Math.round(plan.facets * sketch);
  return {
    time, t, sketch, risen, sunk, drawn,
    stage: t < third ? 'sketch' : t < 2 * third ? 'extrude' : 'pocket',
    outerHeight: plan.height * risen, pocketDepth: plan.pocket * sunk,
    solid: polygonArea(plan.radius, plan.facets) * plan.height * risen - polygonArea(plan.inner, plan.facets) * plan.pocket * sunk,
    done: time >= plan.duration,
  };
}

export const sampleDesign = (input, time = 0) => designAt(designPlan(input), time);

/** Declared: the scanner's focal length and sensor line, the target it measures, and how long the sweep takes. */
export const SCAN = Object.freeze({focal: 20, sensorHalf: 3.5, width: 24, ridgeWidth: 12, ridgeDepth: 4, depth: 24, duration: 6, speed: 4});

export const SCAN_DEFAULTS = Object.freeze({standoff: 66, baseline: 8, pixel: 1, subpixel: 1, ridge: 6, spacing: 0, side: 0});
export const SCAN_DOMAINS = Object.freeze({
  standoff: Object.freeze([53.5, 78.5, 0.5]), baseline: Object.freeze([4, 16, 1]), pixel: Object.freeze([0, 2, 1]), subpixel: Object.freeze([0, 1, 1]),
  ridge: Object.freeze([0, 12, 2]), spacing: Object.freeze([0, 2, 1]), side: Object.freeze([0, 1, 1]),
});

/** The target's height above its table at `x` mm across: a flat surface with one raised ridge in the middle. */
export const heightAt = (x, ridge) => (ridge > 0 && Math.abs(x) <= SCAN.ridgeWidth / 2 ? ridge : 0);

/**
 * One attempted sample at `x` across the laser line. The laser stands above the
 * middle of the target and fans across it; the receiver stands a baseline to one
 * side. Both paths must clear the ridge, and the spot must land on the sensor.
 */
export function traceSample(x, plan) {
  const {ridge, standoff} = plan, half = SCAN.ridgeWidth / 2;
  const surface = heightAt(x, ridge), depth = standoff - surface;
  const clears = (fromX, toX, toHeight) => {
    if (ridge <= 0) return true;
    for (const edge of [-half, half]) {
      if ((edge - fromX) * (edge - toX) > 0) continue;
      if (Math.abs(toX) <= half + 1e-12 && Math.abs(fromX - toX) < 1e-12) continue;
      const share = (edge - fromX) / (toX - fromX);
      const heightThere = standoff + share * (toHeight - standoff);
      if (heightThere < ridge - 1e-12) return false;
    }
    return true;
  };
  if (!clears(0, x, surface)) return {x, surface, depth, reason: 'The laser never reaches it', lit: false, seen: false, measured: null, image: null, reached: null};
  const receiver = plan.sideSign * plan.baseline;
  if (!clears(receiver, x, surface)) return {x, surface, depth, reason: 'The receiver cannot see it', lit: true, seen: false, measured: null, image: null, reached: null};
  const image = imageOf(depth, SCAN.focal, plan.baseline);
  if (Math.abs(image - plan.sensorCenter) > SCAN.sensorHalf) return {x, surface, depth, reason: 'The spot falls off the sensor', lit: true, seen: true, measured: null, image, reached: null};
  const grid = onGrid(image, plan.grid);
  const measured = plan.standoff - depthOf(grid.reached, SCAN.focal, plan.baseline);
  return {x, surface, depth, reason: null, lit: true, seen: true, image, reached: grid.reached, residual: grid.residual, measured, error: measured - surface};
}

const scanPlans = new Map();

/** Everything about the scanner that does not change as the sweep runs. */
export function scanPlan(input) {
  const values = validateControls(input, SCAN_DEFAULTS, SCAN_DOMAINS, 'laser scanning');
  const key = JSON.stringify(values);
  if (scanPlans.has(key)) return scanPlans.get(key);
  const pixel = PIXELS[values.pixel] / 1000, subpixel = SUBPIXELS[values.subpixel], spacing = [1, 2, 4][values.spacing];
  const grid = pixel / subpixel;
  const plan = {
    values, standoff: values.standoff, baseline: values.baseline, ridge: values.ridge, spacing,
    pixel, pixelMicrons: PIXELS[values.pixel], subpixel, grid, gridMicrons: grid * 1000,
    sensorCenter: imageOf(SCANNER.middle, SCAN.focal, values.baseline), sensorPixels: Math.round(2 * SCAN.sensorHalf / pixel), catalogPoints: SCANNER.points,
    sideSign: values.side === 0 ? 1 : -1, focal: SCAN.focal, duration: SCAN.duration, speed: SCAN.speed,
    resolution: depthResolution(values.standoff, SCAN.focal, values.baseline, grid),
    resolutionMicrons: depthResolution(values.standoff, SCAN.focal, values.baseline, grid) * 1000,
    atStart: depthResolution(SCANNER.start, SCAN.focal, values.baseline, grid) * 1000,
    atEnd: depthResolution(SCANNER.end, SCAN.focal, values.baseline, grid) * 1000,
    columns: [], profiles: Math.round(SCAN.depth / spacing) + 1,
  };
  for (let x = -SCAN.width / 2; x <= SCAN.width / 2 + 1e-9; x += spacing) plan.columns.push(Number(x.toFixed(6)));
  plan.samples = plan.columns.map(x => traceSample(x, plan));
  plan.returned = plan.samples.filter(sample => sample.measured !== null).length;
  plan.missing = plan.samples.length - plan.returned;
  const errors = plan.samples.filter(sample => sample.measured !== null).map(sample => Math.abs(sample.error));
  plan.worstError = errors.length ? Math.max(...errors) : null;
  plan.worstErrorMicrons = errors.length ? Math.max(...errors) * 1000 : null;
  if (scanPlans.size >= 64) scanPlans.clear();
  scanPlans.set(key, plan);
  return plan;
}

/** The sweep `time` seconds in: how far the table has carried the target, and how many profiles have landed. */
export function scanAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration);
  const moved = Math.min(SCAN.depth, t * plan.speed), position = -SCAN.depth / 2 + moved;
  const taken = Math.min(plan.profiles, Math.floor(moved / plan.spacing + 1e-9) + 1);
  const cloud = [];
  for (let profile = 0; profile < taken; profile++) {
    const y = -SCAN.depth / 2 + profile * plan.spacing;
    for (const sample of plan.samples) if (sample.measured !== null) cloud.push([sample.x, sample.measured, y]);
  }
  return {time, t, moved, position, profiles: taken, cloud, attempted: taken * plan.samples.length, held: taken * plan.returned, gaps: taken * plan.missing, done: time >= plan.duration};
}

export const sampleScan = (input, time = 0) => scanAt(scanPlan(input), time);

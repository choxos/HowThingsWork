/**
 * Ideal (frictionless) mechanics for the three simple machines in this study.
 *
 * Every one of them obeys the same bargain: the work you put in equals the work
 * you get out, so whatever you gain in force you pay for in distance moved.
 */

/** Force and distance, expressed as multiples of the load and of the load's travel. */
export type Advantage = {
  /** Load force divided by effort force. Above 1 means the machine multiplies force. */
  forceRatio: number;
  /** Distance the effort moves divided by the distance the load moves. */
  distanceRatio: number;
};

const finite = (value: number, name: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a positive finite number`);
  return value;
};

/**
 * A ramp trades a short steep lift for a long gentle push. A slope three times
 * the height needs a third of the effort over three times the distance.
 * Ideal case: no friction, no rolling resistance, and steady motion.
 */
export function inclinedPlane(slopeLength: number, height: number): Advantage {
  finite(slopeLength, 'slopeLength');
  finite(height, 'height');
  if (slopeLength < height) throw new RangeError('slopeLength cannot be shorter than height');
  const ratio = slopeLength / height;
  return {forceRatio: ratio, distanceRatio: ratio};
}

/** The angle of a ramp, in degrees, from its slope length and the height it climbs. */
export function slopeAngle(slopeLength: number, height: number): number {
  finite(slopeLength, 'slopeLength');
  finite(height, 'height');
  return (Math.asin(Math.min(1, height / slopeLength)) * 180) / Math.PI;
}

export type LeverClass = 'first' | 'second' | 'third';

/**
 * Effort times its arm equals load times its arm, where an arm is the distance
 * from the fulcrum measured square to the line the force acts along. The three
 * classes differ only in where the effort, fulcrum and load sit.
 */
export function lever(effortArm: number, loadArm: number): Advantage {
  finite(effortArm, 'effortArm');
  finite(loadArm, 'loadArm');
  const ratio = effortArm / loadArm;
  return {forceRatio: ratio, distanceRatio: ratio};
}

/**
 * Where the effort, fulcrum and load sit along a bar of the given length.
 * `pivot` is the one point the reader moves; the other two are fixed by the class.
 * A first class lever has the fulcrum in the middle, a second class lever the
 * load, and a third class lever the effort.
 */
export function leverGeometry(leverClass: LeverClass, bar: number, pivot: number) {
  finite(bar, 'bar');
  const at = Math.min(Math.max(pivot, bar * 0.08), bar * 0.92);
  if (leverClass === 'first') return {fulcrum: at, effort: 0, load: bar};
  if (leverClass === 'second') return {fulcrum: 0, effort: bar, load: at};
  return {fulcrum: 0, effort: at, load: bar};
}

/** Arm lengths for a lever laid out by {@link leverGeometry}. */
export function leverArms(leverClass: LeverClass, bar: number, pivot: number): Advantage {
  const {fulcrum, effort, load} = leverGeometry(leverClass, bar, pivot);
  return lever(Math.abs(effort - fulcrum), Math.abs(load - fulcrum));
}

/**
 * A wheel and axle is a lever bent into a circle: the rim is the long arm and
 * the axle is the short one, so effort at the rim turns into force at the axle.
 */
export function wheelAndAxle(wheelRadius: number, axleRadius: number): Advantage {
  finite(wheelRadius, 'wheelRadius');
  finite(axleRadius, 'axleRadius');
  const ratio = wheelRadius / axleRadius;
  return {forceRatio: ratio, distanceRatio: ratio};
}

/**
 * Meshing teeth cannot slip, so both wheels sweep the same arc at their rims.
 * The wheel with more teeth turns more slowly and with proportionally more
 * torque. A belt over two pulleys obeys the same ratio, using circumference in
 * place of tooth count, and leaves both wheels turning the same way.
 */
export function gearTrain(driverTeeth: number, drivenTeeth: number): Advantage {
  finite(driverTeeth, 'driverTeeth');
  finite(drivenTeeth, 'drivenTeeth');
  const ratio = drivenTeeth / driverTeeth;
  return {forceRatio: ratio, distanceRatio: ratio};
}

/** A crank pin set this far off center draws the rod through twice that distance. */
export function crankStroke(throwRadius: number): number {
  finite(throwRadius, 'throwRadius');
  return throwRadius * 2;
}

/**
 * The furthest the connecting rod leans from straight, in degrees. A longer rod
 * leans less, which is why long rods give smoother, more even strokes.
 */
export function rodObliquity(throwRadius: number, rodLength: number): number {
  finite(throwRadius, 'throwRadius');
  finite(rodLength, 'rodLength');
  if (rodLength <= throwRadius) throw new RangeError('rodLength must exceed throwRadius');
  return (Math.asin(throwRadius / rodLength) * 180) / Math.PI;
}

/** Effort needed to balance a load through a machine with the given advantage. */
export function effortFor(load: number, advantage: Advantage): number {
  return load / advantage.forceRatio;
}

/**
 * Work for a steady force acting along the direction of travel, which is the
 * case every machine in this study is set up as. A force at an angle to the
 * path, or one that varies along it, needs the component along the path
 * integrated over the distance instead.
 */
export function work(force: number, distance: number): number {
  return force * distance;
}

/**
 * A pulley system's advantage is the number of rope parts that pull upward on
 * the moving block, not the number of wheels. A single fixed pulley supports
 * the load on one part, so it changes the direction of the pull and nothing
 * else. Doubling the supporting strand count halves the effort and doubles
 * the rope that has to be hauled in.
 */
export function pulley(strands: number): Advantage {
  finite(strands, 'strands');
  if (!Number.isInteger(strands)) throw new RangeError('strands must be a whole number');
  return {forceRatio: strands, distanceRatio: strands};
}

/**
 * A screw is an inclined plane wrapped around a cylinder. One full turn of the
 * head carries your hand once around the circle it describes, while the thread
 * advances by its lead: the pitch multiplied by the number of separate threads
 * started at the head. The ideal ratio between the two is enormous, and real
 * screws never deliver it, because the friction that swallows most of the gain
 * is the same friction that stops the thread from unwinding under load.
 */
export function screw(turningRadius: number, lead: number): Advantage {
  finite(turningRadius, 'turningRadius');
  finite(lead, 'lead');
  const ratio = (2 * Math.PI * turningRadius) / lead;
  return {forceRatio: ratio, distanceRatio: ratio};
}

/** The lead of a thread: how far one turn advances it. */
export function threadLead(pitch: number, starts = 1): number {
  finite(pitch, 'pitch');
  finite(starts, 'starts');
  return pitch * starts;
}

/**
 * The angle of the thread measured from a plane square to the shaft, which is
 * the slope of the ramp once you unwrap it from the cylinder.
 */
export function helixAngle(threadRadius: number, lead: number): number {
  finite(threadRadius, 'threadRadius');
  finite(lead, 'lead');
  return (Math.atan(lead / (2 * Math.PI * threadRadius)) * 180) / Math.PI;
}

/**
 * The inward force that holds something on a circular path. Nothing throws a
 * spinning object outward: it would travel in a straight line if it could, and
 * this is the force that keeps bending its path into a circle. Take the force
 * away and it leaves along the tangent, not along the radius.
 */
export function centripetalForce(mass: number, radius: number, rateHz: number): number {
  finite(mass, 'mass');
  finite(radius, 'radius');
  finite(rateHz, 'rateHz');
  const omega = 2 * Math.PI * rateHz;
  return mass * omega * omega * radius;
}

/** Energy stored in a spinning wheel, which is what makes a flywheel useful. */
export function rotationalEnergy(inertia: number, rateHz: number): number {
  finite(inertia, 'inertia');
  finite(rateHz, 'rateHz');
  const omega = 2 * Math.PI * rateHz;
  return 0.5 * inertia * omega * omega;
}

/** Moment of inertia of a uniform disc about its own axis. */
export function discInertia(mass: number, radius: number): number {
  finite(mass, 'mass');
  finite(radius, 'radius');
  return 0.5 * mass * radius * radius;
}

/**
 * How fast a spinning wheel's axis swings around when a torque tries to tip it.
 * The torque does not tip the axis over; it moves the axis sideways, because a
 * torque changes angular momentum in the direction the torque points. Spin the
 * wheel faster and the same torque moves it more slowly.
 *
 * The result is in turns per second, and it is negative when the spin is
 * reversed, because the swing follows the direction of the spin.
 */
export function precessionRate(torque: number, inertia: number, rateHz: number): number {
  finite(torque, 'torque');
  finite(inertia, 'inertia');
  if (!Number.isFinite(rateHz) || rateHz === 0) throw new RangeError('rateHz must be a non-zero finite number');
  const spin = 2 * Math.PI * rateHz;
  return torque / inertia / spin / (2 * Math.PI);
}

/**
 * Hooke's law: within its working range, a spring pushes back in proportion to
 * how far it has been moved from rest. Past that range it takes a permanent
 * set, and the law stops describing it.
 */
export function springForce(stiffness: number, deflection: number): number {
  finite(stiffness, 'stiffness');
  return stiffness * deflection;
}

/** Energy stored in a deflected spring: the area under its own force line. */
export function springEnergy(stiffness: number, deflection: number): number {
  finite(stiffness, 'stiffness');
  return 0.5 * stiffness * deflection * deflection;
}

/**
 * Springs end to end share the load and each one gives, so the set is softer
 * than any single member. Springs side by side split the load, so the set is
 * stiffer.
 */
export function springsInSeries(stiffnesses: number[]): number {
  if (stiffnesses.length === 0) throw new RangeError('need at least one spring');
  return 1 / stiffnesses.reduce((total, k) => total + 1 / finite(k, 'stiffness'), 0);
}

export function springsInParallel(stiffnesses: number[]): number {
  if (stiffnesses.length === 0) throw new RangeError('need at least one spring');
  return stiffnesses.reduce((total, k) => total + finite(k, 'stiffness'), 0);
}

/**
 * Friction between two dry surfaces: proportional to how hard they are pressed
 * together and, to a good approximation, independent of how much of them is
 * touching. The coefficient is a property of the pair of materials, not of
 * either one alone.
 */
export function frictionForce(coefficient: number, normalForce: number): number {
  finite(coefficient, 'coefficient');
  finite(normalForce, 'normalForce');
  return coefficient * normalForce;
}

/**
 * The angle at which a block on a slope begins to slide, which is the tidiest
 * way to measure a coefficient of friction: tip the surface until it goes, and
 * the tangent of that angle is the coefficient.
 */
export function slipAngle(coefficient: number): number {
  finite(coefficient, 'coefficient');
  return (Math.atan(coefficient) * 180) / Math.PI;
}

/**
 * Work turned into heat by dragging something across a surface. Nothing is
 * stored and nothing comes back: this is the share of the effort a machine
 * never gets to use.
 */
export function frictionHeat(coefficient: number, normalForce: number, distance: number): number {
  return frictionForce(coefficient, normalForce) * distance;
}

// ---------------------------------------------------------------------------
// Part 2: harnessing the elements.
// ---------------------------------------------------------------------------

/** Standard gravity, in meters per second squared. */
export const GRAVITY = 9.81;

/**
 * Archimedes: a body in a fluid is pushed up by the weight of the fluid it
 * shoves aside. Nothing about the body's shape or material enters into it,
 * only how much room it takes up below the surface.
 */
export function buoyantForce(displacedVolume: number, fluidDensity: number): number {
  finite(displacedVolume, 'displacedVolume');
  finite(fluidDensity, 'fluidDensity');
  return displacedVolume * fluidDensity * GRAVITY;
}

/**
 * How much of a floating body sits below the surface, as a fraction of its own
 * volume: its average density divided by the fluid's. Exactly 1 is neutral: it
 * floats level with the surface and stays wherever it is put, which is what a
 * submarine trims for. Above 1 it cannot hold itself up at all, because even
 * fully under it does not displace its own weight. Average density is what
 * counts, which is why a steel hull full of air floats and the same steel in a
 * lump does not.
 */
export function submergedFraction(bodyDensity: number, fluidDensity: number): number {
  finite(bodyDensity, 'bodyDensity');
  finite(fluidDensity, 'fluidDensity');
  return bodyDensity / fluidDensity;
}

/** Pressure from the weight of fluid standing above a given depth. */
export function pressureAtDepth(depth: number, fluidDensity: number): number {
  finite(fluidDensity, 'fluidDensity');
  if (depth < 0) throw new RangeError('depth cannot be negative');
  return depth * fluidDensity * GRAVITY;
}

/**
 * The pressure a moving fluid carries by virtue of its motion, which is the
 * quantity every aerodynamic force is measured against.
 */
export function dynamicPressure(fluidDensity: number, speed: number): number {
  finite(fluidDensity, 'fluidDensity');
  if (speed < 0) throw new RangeError('speed cannot be negative');
  return 0.5 * fluidDensity * speed * speed;
}

/**
 * A wing works by turning air downward. The air leaves with downward momentum
 * it did not have before, and the equal and opposite push on the wing is lift.
 * The pressure difference between the two surfaces is how that push is
 * delivered, not a separate cause, and it has nothing to do with the two halves
 * of a parted airflow having to meet again at the back.
 *
 * Tilt the wing further into the flow and it turns more air, so lift climbs in
 * proportion, until the flow can no longer follow the upper surface. Past that
 * angle it separates, lift falls away and the wing has stalled. The slope used
 * here is the thin airfoil result of about 0.11 per degree.
 */
export function liftCoefficient(angleOfAttack: number, stallAngle = 15): number {
  finite(stallAngle, 'stallAngle');
  const slope = 2 * Math.PI * (Math.PI / 180);
  if (angleOfAttack <= stallAngle) return slope * angleOfAttack;
  // Past the stall the flow separates and what is left falls away quickly.
  const peak = slope * stallAngle;
  return Math.max(peak * 0.35, peak * (1 - (angleOfAttack - stallAngle) * 0.09));
}

/**
 * This flap model increases lift through greater camber and assumes a lower
 * stall angle. Real changes depend on the wing and flap design. Past the stall only a fraction
 * of that extra survives, because the flow has left the surface either way.
 */
export function wingLift(angleOfAttack: number, stallAngle: number, flapBonus = 0): number {
  const base = liftCoefficient(angleOfAttack, stallAngle);
  return base + flapBonus * (angleOfAttack <= stallAngle ? 1 : 0.35);
}

/** Lift or drag from its coefficient, the air it moves through and the wing area. */
export function aerodynamicForce(coefficient: number, fluidDensity: number, speed: number, area: number): number {
  finite(area, 'area');
  return coefficient * dynamicPressure(fluidDensity, speed) * area;
}

/**
 * Drag has two parts. One is the price of having any shape at all and barely
 * changes; the other is the price of making lift, and it grows with the square
 * of the lift, divided by the slenderness of the wing. A long thin wing pays
 * less for the same lift, which is why gliders have the wings they do.
 */
export function dragCoefficient(lift: number, aspectRatio: number, formDrag = 0.02, efficiency = 0.8): number {
  finite(aspectRatio, 'aspectRatio');
  return formDrag + (lift * lift) / (Math.PI * efficiency * aspectRatio);
}

/**
 * Drag on a wing, valid on both sides of the stall. While the flow is attached
 * it is the form drag plus the price of lift. Once it separates the section
 * behaves more like a flat plate held across the stream: drag climbs steeply
 * with the angle and soon dwarfs anything the wing was paying before.
 */
export function wingDrag(
  angleOfAttack: number,
  stallAngle: number,
  lift: number,
  aspectRatio: number,
  formDrag = 0.02,
): number {
  const attached = dragCoefficient(lift, aspectRatio, formDrag);
  if (angleOfAttack <= stallAngle) return attached;
  const beyond = angleOfAttack - stallAngle;
  return attached + 0.9 * (1 - Math.cos((2 * beyond * Math.PI) / 180)) + 0.02 * beyond;
}

/**
 * Pascal: press on a trapped liquid and the pressure everywhere in it rises by
 * the same amount. The pressure itself still varies with height, because the
 * fluid has weight; it is the change that is passed on undiminished. A small
 * piston pushing on a large one therefore delivers force in the ratio of their
 * areas, and the same bargain as every other machine applies: the large piston
 * moves that many times less far.
 */
export function hydraulicPress(inputArea: number, outputArea: number): Advantage {
  finite(inputArea, 'inputArea');
  finite(outputArea, 'outputArea');
  const ratio = outputArea / inputArea;
  return {forceRatio: ratio, distanceRatio: ratio};
}

/** The area of a circular piston from its bore. */
export function pistonArea(diameter: number): number {
  finite(diameter, 'diameter');
  return Math.PI * (diameter / 2) ** 2;
}

/**
 * Boyle: squeeze a fixed quantity of gas into half the room, at the same
 * temperature, and its pressure doubles. This is the difference a gas makes in
 * a machine that a liquid does not: it gives, stores energy, and springs back.
 */
export function boylePressure(pressure: number, volume: number, newVolume: number): number {
  finite(pressure, 'pressure');
  finite(volume, 'volume');
  finite(newVolume, 'newVolume');
  return (pressure * volume) / newVolume;
}

/** The same law read the other way: how far a gas is squeezed by a given pressure. */
export function boyleVolume(pressure: number, volume: number, newPressure: number): number {
  finite(pressure, 'pressure');
  finite(volume, 'volume');
  finite(newPressure, 'newPressure');
  return (pressure * volume) / newPressure;
}

/** Atmospheric pressure at sea level, in bar. */
export const ATMOSPHERE = 1.01325;

/**
 * The most work any heat engine can get from heat flowing between two
 * temperatures, whatever it is made of. Temperatures must be absolute, in
 * kelvin, because the ratio is what matters and a scale with an arbitrary zero
 * would give an arbitrary answer.
 */
export function carnotEfficiency(hotKelvin: number, coldKelvin: number): number {
  finite(hotKelvin, 'hotKelvin');
  finite(coldKelvin, 'coldKelvin');
  if (coldKelvin > hotKelvin) throw new RangeError('the cold side cannot be hotter than the hot side');
  return 1 - coldKelvin / hotKelvin;
}

/**
 * The ideal efficiency of a spark ignition engine, set by how far it squeezes
 * the mixture before lighting it. Squeezing harder wins more, with diminishing
 * returns, and is limited by the fuel igniting on its own.
 */
export function ottoEfficiency(compressionRatio: number, gamma = 1.4): number {
  finite(compressionRatio, 'compressionRatio');
  if (compressionRatio <= 1) throw new RangeError('compressionRatio must exceed 1');
  return 1 - compressionRatio ** (1 - gamma);
}

/**
 * Run a heat engine backward and it becomes a refrigerator: work goes in and
 * heat is carried from the cold side to the hot. The most it can move for each
 * unit of work is the cold temperature divided by the difference between the
 * two. Across a narrow gap, a kitchen against a freezer, that is several units
 * of heat for one of work. Across a wide one it falls below a single unit, and
 * a machine asked to hold a large difference does badly at it.
 */
export function coolingLimit(hotKelvin: number, coldKelvin: number): number {
  finite(hotKelvin, 'hotKelvin');
  finite(coldKelvin, 'coldKelvin');
  if (coldKelvin >= hotKelvin) throw new RangeError('a refrigerator needs the cold side to be colder');
  return coldKelvin / (hotKelvin - coldKelvin);
}

/** Speed of light in a vacuum, in meters per second. */
export const LIGHT_SPEED = 299_792_458;

/**
 * The energy locked in a given mass. Nuclear reactions release a great deal
 * because they convert a measurable fraction of the mass of the fuel; chemical
 * reactions convert a fraction so small it has never been weighed.
 */
export function massEnergy(mass: number): number {
  finite(mass, 'mass');
  return mass * LIGHT_SPEED * LIGHT_SPEED;
}

/**
 * How a population of neutrons grows or dies away. Each fission releases
 * several neutrons; the multiplication factor is how many of them go on to
 * split another nucleus. Below one the reaction dies out, at exactly one it
 * holds steady, and above one it runs away.
 */
export function chainGrowth(multiplication: number, generations: number): number {
  if (!Number.isFinite(multiplication) || multiplication < 0) throw new RangeError('multiplication must be zero or more');
  if (!Number.isFinite(generations) || generations < 0) throw new RangeError('generations must be zero or more');
  return multiplication ** generations;
}

/** What is left of a radioactive sample after a given time. */
export function remainingFraction(elapsed: number, halfLife: number): number {
  finite(halfLife, 'halfLife');
  if (elapsed < 0) throw new RangeError('elapsed cannot be negative');
  return 2 ** (-elapsed / halfLife);
}

// ---------------------------------------------------------------------------
// Part 3: working with waves.
// ---------------------------------------------------------------------------

/** Speed of sound in air at about twenty degrees, in meters per second. */
export const SOUND_SPEED = 343;

export type Image = {
  /** Where the image forms, on the far side when positive. */
  distance: number;
  /** Size of the image against the object. Negative means it is upside down. */
  magnification: number;
  /** A real image can be caught on a screen; a virtual one only looked at. */
  real: boolean;
};

/**
 * The thin lens equation: one over the focal length is one over the object
 * distance plus one over the image distance. The convention here is the one
 * the numbers are reported in: a real object in front of the lens has a
 * positive distance, a real image formed beyond it has a positive distance, a
 * virtual image has a negative one, and the magnification is minus the image
 * distance over the object distance, so a negative result means upside down.
 * A concave mirror of the same focal length behaves identically, with the
 * image folded back to the side the light came from.
 *
 * This is the paraxial idealization: rays close to the axis, a lens thin
 * against its focal length, and one focal length for every color. A real lens
 * brings neither every ray nor every color to quite the same point.
 *
 * Bring the object to the focal point and the rays leave parallel: the image
 * goes to infinity. Inside the focal point the image turns virtual, upright
 * and magnified, which is what a magnifying glass does. The same equation
 * covers a mirror, a diverging lens and a flat mirror, with no change but the
 * focal length: see the note on its sign below.
 */
/**
 * The five elements the optical bench offers, and the whole of what separates
 * them: a focal length, and whether the light carries on or comes back. One
 * equation covers all five, so nothing else about them needs naming here.
 *
 * This lives beside the equation rather than beside the drawing, so that the
 * gallery can read it without loading a three dimensional scene to do it.
 */
export const FOCAL_RANGE = {shortest: 40, longest: 220} as const;

export const OPTICAL_ELEMENTS: Record<string, {focal: number; mirror: boolean}> = {
  converging: {focal: 100, mirror: false},
  diverging: {focal: -100, mirror: false},
  'concave-mirror': {focal: 100, mirror: true},
  'convex-mirror': {focal: -100, mirror: true},
  'plane-mirror': {focal: Infinity, mirror: true},
};

export function thinLens(focalLength: number, objectDistance: number): Image {
  // A focal length may be negative, and the sign is the whole of the difference
  // between the two families of element. Positive gathers light: a converging
  // lens, or a mirror dished away from it. Negative spreads it: a diverging
  // lens, or a mirror bulging toward it, and those can only ever make a virtual
  // image. Infinite is a flat mirror, which brings parallel light to no point
  // at all and puts the image as far behind the surface as the object stands in
  // front of it, the same way up and the same size. Zero is not an element.
  if (Number.isNaN(focalLength) || focalLength === 0) {
    throw new RangeError('focalLength must be a nonzero number, or Infinity for a flat surface');
  }
  finite(objectDistance, 'objectDistance');
  const inverse = 1 / focalLength - 1 / objectDistance;
  if (inverse === 0) return {distance: Infinity, magnification: -Infinity, real: true};
  const distance = 1 / inverse;
  return {distance, magnification: -distance / objectDistance, real: distance > 0};
}

/**
 * Light through a lens goes with the area of the opening, and the f number is
 * the focal length divided by the diameter of that opening, so the light
 * admitted goes with one over its square. That is why the standard series
 * climbs by a factor of the square root of two: each step halves the light.
 */
export function apertureLight(fNumber: number): number {
  finite(fNumber, 'fNumber');
  return 1 / (fNumber * fNumber);
}

/** How many stops apart two f numbers are: one stop is a factor of two in light. */
export function stopsBetween(from: number, to: number): number {
  finite(from, 'from');
  finite(to, 'to');
  return 2 * Math.log2(to / from);
}

/**
 * The exposure that matches a reference one. Close the aperture by a stop and
 * the shutter must stay open twice as long; double the sensitivity and it need
 * only stay open half as long.
 */
export function exposureTime(
  fNumber: number,
  sensitivity: number,
  reference = {fNumber: 8, sensitivity: 100, seconds: 1 / 125},
): number {
  finite(fNumber, 'fNumber');
  finite(sensitivity, 'sensitivity');
  return reference.seconds * (fNumber / reference.fNumber) ** 2 * (reference.sensitivity / sensitivity);
}

/**
 * How much of the scene is sharp, from the near limit to the far one. A
 * narrower opening deepens it, a longer lens shrinks it, and moving back
 * deepens it fastest of all, because the subject distance enters squared.
 *
 * The circle of confusion is how large a blur may be before the eye calls it
 * a blur; for a 35 mm frame it is taken as about 0.03 mm.
 */
export function depthOfField(
  focalLength: number,
  fNumber: number,
  subjectDistance: number,
  circleOfConfusion = 0.03,
): {near: number; far: number; depth: number} {
  finite(focalLength, 'focalLength');
  finite(fNumber, 'fNumber');
  finite(subjectDistance, 'subjectDistance');
  finite(circleOfConfusion, 'circleOfConfusion');
  const hyperfocal = (focalLength * focalLength) / (fNumber * circleOfConfusion) + focalLength;
  const near = (subjectDistance * (hyperfocal - focalLength)) / (hyperfocal + subjectDistance - 2 * focalLength);
  const far =
    subjectDistance >= hyperfocal
      ? Infinity
      : (subjectDistance * (hyperfocal - focalLength)) / (hyperfocal - subjectDistance);
  return {near, far, depth: far - near};
}

/**
 * A halftone has no gray ink in it. It prints solid dots of varying size, and
 * the tint you see is the average of the paper showing through and the ink
 * covering it, in proportion to how much of the area each holds.
 */
export function halftoneTint(dotArea: number, paperReflectance = 0.9, inkReflectance = 0.05): number {
  if (dotArea < 0 || dotArea > 1) throw new RangeError('dotArea must be between zero and one');
  return (1 - dotArea) * paperReflectance + dotArea * inkReflectance;
}

/** Distance from one halftone dot to the next, in millimeters, from lines per inch. */
export function dotPitch(ruling: number): number {
  finite(ruling, 'ruling');
  return 25.4 / ruling;
}

/**
 * How large a detail looks, in minutes of arc. The eye separates two things
 * about a minute apart, so a halftone finer than that reads as continuous tone.
 */
export function angularSize(size: number, distance: number): number {
  finite(size, 'size');
  finite(distance, 'distance');
  return (Math.atan(size / distance) * 180 * 60) / Math.PI;
}

/**
 * A stretched string sounds at a pitch set by three things: its length, how
 * hard it is pulled, and how heavy it is for its length. Halve the length and
 * the pitch goes up an octave, which is why a finger on a fingerboard works.
 */
export function stringFrequency(length: number, tension: number, linearDensity: number): number {
  finite(length, 'length');
  finite(tension, 'tension');
  finite(linearDensity, 'linearDensity');
  return Math.sqrt(tension / linearDensity) / (2 * length);
}

/**
 * A column of air sounds at a pitch set by its length. Open at both ends it
 * fits half a wavelength; stopped at one end it fits only a quarter, so it
 * sounds an octave lower for the same length, and it can only give the odd
 * members of the harmonic series.
 */
export function pipeFrequency(length: number, stopped = false): number {
  finite(length, 'length');
  return SOUND_SPEED / ((stopped ? 4 : 2) * length);
}

/** Wavelength from a speed and a frequency: they multiply to give the speed. */
export function wavelength(speed: number, frequency: number): number {
  finite(speed, 'speed');
  finite(frequency, 'frequency');
  return speed / frequency;
}

/**
 * How far a pitch is from a reference, in semitones. Twelve semitones make an
 * octave, and an octave is a doubling, so the scale is logarithmic.
 */
export function semitonesFrom(reference: number, frequency: number): number {
  finite(reference, 'reference');
  finite(frequency, 'frequency');
  return 12 * Math.log2(frequency / reference);
}

const NAMES = ['A', 'A♯', 'B', 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯'];

/** The nearest named note to a frequency, counting from A above middle C. */
export function noteName(frequency: number, referenceA = 440): string {
  const steps = Math.round(semitonesFrom(referenceA, frequency));
  const octave = 4 + Math.floor((steps + 9) / 12);
  return `${NAMES[((steps % 12) + 12) % 12]}${octave}`;
}

/**
 * Loudness in decibels, which is a ratio of powers on a logarithmic scale:
 * ten decibels is ten times the power, not twice it, and twenty decibels is a
 * hundred times.
 */
export function decibels(ratio: number): number {
  finite(ratio, 'ratio');
  return 10 * Math.log10(ratio);
}

/**
 * A quarter wave antenna is a quarter of the wavelength it is cut for, which
 * is why a long wave transmitter needs a mast and a phone does not.
 */
export function quarterWave(frequency: number): number {
  finite(frequency, 'frequency');
  return LIGHT_SPEED / (4 * frequency);
}

// ---------------------------------------------------------------------------
// Part 4: electricity and automation.
// ---------------------------------------------------------------------------

/** Values that are allowed to be zero or negative, unlike the ones finite() guards. */
const real = (value: number, name: string) => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
  return value;
};

/** The charge on one electron, in coulombs. Exact by the SI definition of the ampere. */
export const ELEMENTARY_CHARGE = 1.602176634e-19;

/**
 * Free electrons per cubic meter in copper, taking one from each atom. This is
 * the usual textbook figure and is good to about a percent, which is all the
 * drift speed below is meant to claim.
 */
export const COPPER_CARRIERS = 8.5e28;

/**
 * The magnetic constant, in henries per meter. Before 2019 it was exactly
 * 4 pi times ten to the minus seven; it is now measured, and differs from that
 * value by about two parts in ten thousand million, which nothing here can see.
 */
export const MU0 = 4 * Math.PI * 1e-7;

/**
 * Ohm's law. Current is the voltage across a conductor divided by its
 * resistance, so at a fixed voltage a larger resistance passes less current.
 * It holds for metals at a steady temperature and not for every material.
 */
export function ohmsCurrent(volts: number, ohms: number): number {
  real(volts, 'volts');
  finite(ohms, 'ohms');
  return volts / ohms;
}

/** Electrical power: every volt of drop across a component, times every amp through it. */
export function electricalPower(volts: number, amps: number): number {
  real(volts, 'volts');
  real(amps, 'amps');
  return volts * amps;
}

/**
 * Resistances in a line add. The same current passes through each of them in
 * turn, and their voltage drops add up to the supply.
 */
export function seriesResistance(ohms: number[]): number {
  if (ohms.length === 0) throw new RangeError('ohms must not be empty');
  return ohms.reduce((total, value) => total + finite(value, 'ohms'), 0);
}

/**
 * Resistances side by side pass current in parallel, so their conductances add
 * and the total is always smaller than the smallest of them. Two equal ones
 * halve the resistance and double the current the supply has to deliver.
 */
export function parallelResistance(ohms: number[]): number {
  if (ohms.length === 0) throw new RangeError('ohms must not be empty');
  return 1 / ohms.reduce((total, value) => total + 1 / finite(value, 'ohms'), 0);
}

/** How many electrons pass a point each second at a given current. */
export function electronsPerSecond(amps: number): number {
  finite(amps, 'amps');
  return amps / ELEMENTARY_CHARGE;
}

/**
 * How fast the electrons themselves actually move along the wire, in meters
 * per second, for a cross section given in square millimeters. The answer is
 * startling: a current that lights a lamp the instant it is switched on is
 * carried by electrons drifting slower than a snail. The signal travels at
 * nearly the speed of light; the electrons do not.
 */
export function driftSpeed(amps: number, areaMm2: number, carriers = COPPER_CARRIERS): number {
  finite(amps, 'amps');
  finite(areaMm2, 'areaMm2');
  finite(carriers, 'carriers');
  return amps / (carriers * areaMm2 * 1e-6 * ELEMENTARY_CHARGE);
}

/**
 * The field inside a long solenoid, in teslas: the magnetic constant times the
 * turns per meter times the current. This is the interior of an ideal coil far
 * longer than it is wide, and it says nothing about the field outside.
 * An iron core multiplies it by the relative permeability of the iron, until
 * the iron saturates, which this does not model.
 */
export function solenoidField(turns: number, lengthM: number, amps: number, relativePermeability = 1): number {
  finite(turns, 'turns');
  finite(lengthM, 'lengthM');
  finite(amps, 'amps');
  finite(relativePermeability, 'relativePermeability');
  return MU0 * relativePermeability * (turns / lengthM) * amps;
}

/**
 * The field on the axis of a solenoid of finite length, inside it or beyond its
 * end, in teslas. This is exact for an ideal thin winding and needs no far
 * field assumption: at the middle of a long coil it reduces to the turns per
 * meter times the current times the magnetic constant, and far outside it falls
 * away like a dipole.
 *
 * The axial distance is measured from the middle of the coil.
 */
export function solenoidAxisField(
  turns: number,
  lengthM: number,
  radiusM: number,
  amps: number,
  axialM: number,
  relativePermeability = 1,
): number {
  finite(turns, 'turns');
  finite(lengthM, 'lengthM');
  finite(radiusM, 'radiusM');
  real(amps, 'amps');
  real(axialM, 'axialM');
  finite(relativePermeability, 'relativePermeability');
  const half = lengthM / 2;
  const cosine = (offset: number) => offset / Math.hypot(offset, radiusM);
  const density = (turns / lengthM) * amps;
  return ((MU0 * relativePermeability * density) / 2) * (cosine(axialM + half) - cosine(axialM - half));
}

/**
 * The earth's own field, in teslas. It varies from about 25 to 65 microteslas
 * over the surface and this is a round middle figure, which is all a compass
 * needle needs to be argued about.
 */
export const EARTH_FIELD = 50e-6;

/**
 * Where a compass needle points when two fields cross it: the angle away from
 * the first field, in degrees, given the second at right angles to it. This is
 * Oersted's experiment, and it is how the size of a coil's field was first
 * measured against something already known.
 */
export function compassDeflection(alongNeedle: number, across: number): number {
  finite(alongNeedle, 'alongNeedle');
  real(across, 'across');
  return (Math.atan2(across, alongNeedle) * 180) / Math.PI;
}

/** The field around a long straight wire, which falls off with distance rather than distance squared. */
export function wireField(amps: number, distanceM: number): number {
  finite(amps, 'amps');
  finite(distanceM, 'distanceM');
  return (MU0 * amps) / (2 * Math.PI * distanceM);
}

/**
 * The force on a wire carrying current across a field: field times current
 * times the length in the field. This is the motor effect, and the whole of
 * the next study rests on it.
 */
export function forceOnWire(field: number, amps: number, lengthM: number): number {
  real(field, 'field');
  real(amps, 'amps');
  finite(lengthM, 'lengthM');
  return field * amps * lengthM;
}

/**
 * A field line of a magnetic dipole, in polar form: the distance from the
 * middle is the equatorial radius times the square of the sine of the angle
 * from the axis. Every line leaves one pole and returns to the other, which is
 * why iron filings make closed loops and never loose ends.
 */
export function dipoleLineRadius(equatorRadius: number, thetaRad: number): number {
  finite(equatorRadius, 'equatorRadius');
  real(thetaRad, 'thetaRad');
  return equatorRadius * Math.sin(thetaRad) ** 2;
}

/**
 * The turning force on a coil in a field: turns, field, current and area
 * multiplied, times the cosine of the angle between the plane of the coil and
 * the field. Flat along the field it turns hardest; square across the field
 * the two side forces pull straight apart and it does not turn at all, which
 * is the dead point a commutator carries the coil through.
 */
export function motorTorque(
  turns: number,
  field: number,
  amps: number,
  areaM2: number,
  planeAngleDeg: number,
): number {
  finite(turns, 'turns');
  real(field, 'field');
  real(amps, 'amps');
  finite(areaM2, 'areaM2');
  real(planeAngleDeg, 'planeAngleDeg');
  return turns * field * amps * areaM2 * Math.cos((planeAngleDeg * Math.PI) / 180);
}

/**
 * The peak voltage a coil generates turning in a field, which is also the peak
 * back voltage a motor makes as it speeds up: turns, field, area and the
 * angular rate multiplied. A motor at rest makes none of it, which is why it
 * draws its largest current at the moment of starting.
 */
export function inducedEmfPeak(turns: number, field: number, areaM2: number, rateHz: number): number {
  finite(turns, 'turns');
  real(field, 'field');
  finite(areaM2, 'areaM2');
  real(rateHz, 'rateHz');
  return turns * field * areaM2 * 2 * Math.PI * rateHz;
}

/**
 * The steady value of a sine: its peak divided by the square root of two. This
 * ratio belongs to the sine and to nothing else. A square wave of the same peak
 * has the same value again as its steady equivalent, and a triangle has the peak
 * divided by the square root of three.
 */
export function sineRms(peak: number): number {
  finite(peak, 'peak');
  return peak / Math.SQRT2;
}

/**
 * What a motor actually draws: the supply less the back voltage, divided by
 * the winding resistance. Loading a motor slows it, which lowers the back
 * voltage, which raises the current, which is how a motor answers a load
 * without being told about it.
 */
export function motorCurrent(supplyVolts: number, backEmfVolts: number, windingOhms: number): number {
  real(supplyVolts, 'supplyVolts');
  real(backEmfVolts, 'backEmfVolts');
  finite(windingOhms, 'windingOhms');
  return (supplyVolts - backEmfVolts) / windingOhms;
}

/**
 * A transformer trades voltage for current in the ratio of its turns. The
 * secondary voltage is the primary voltage times the turns ratio, and in the
 * ideal case with no losses the power out equals the power in.
 */
export function transformerVolts(primaryVolts: number, primaryTurns: number, secondaryTurns: number): number {
  real(primaryVolts, 'primaryVolts');
  finite(primaryTurns, 'primaryTurns');
  finite(secondaryTurns, 'secondaryTurns');
  return (primaryVolts * secondaryTurns) / primaryTurns;
}

/** The other half of the same bargain: more turns means more volts and proportionally fewer amps. */
export function transformerAmps(primaryAmps: number, primaryTurns: number, secondaryTurns: number): number {
  real(primaryAmps, 'primaryAmps');
  finite(primaryTurns, 'primaryTurns');
  finite(secondaryTurns, 'secondaryTurns');
  return (primaryAmps * primaryTurns) / secondaryTurns;
}

/**
 * What a transmission line wastes as heat: the current it has to carry for a
 * given power, squared, times its resistance. Because the current falls in
 * proportion to the voltage, the loss falls with the square of the voltage,
 * which is the entire reason the grid runs at hundreds of thousands of volts.
 */
export function lineLoss(powerW: number, lineVolts: number, lineOhms: number): number {
  finite(powerW, 'powerW');
  finite(lineVolts, 'lineVolts');
  finite(lineOhms, 'lineOhms');
  return (powerW / lineVolts) ** 2 * lineOhms;
}

/**
 * A potential divider: the supply voltage split between two resistances in the
 * ratio of their sizes. Nearly every sensor works this way, by putting
 * something that changes with the world in one half of the pair.
 */
export function dividerVoltage(supplyVolts: number, upperOhms: number, lowerOhms: number): number {
  real(supplyVolts, 'supplyVolts');
  finite(upperOhms, 'upperOhms');
  finite(lowerOhms, 'lowerOhms');
  return (supplyVolts * lowerOhms) / (upperOhms + lowerOhms);
}

/**
 * A thermistor's resistance, from the beta model: it falls exponentially as
 * the temperature rises, steeply enough that a few degrees are easy to read.
 * Beta is fitted over a limited range, so this is an interpolation and not a
 * law of nature.
 */
export function thermistorResistance(
  referenceOhms: number,
  beta: number,
  kelvin: number,
  referenceKelvin = 298.15,
): number {
  finite(referenceOhms, 'referenceOhms');
  finite(beta, 'beta');
  finite(kelvin, 'kelvin');
  finite(referenceKelvin, 'referenceKelvin');
  return referenceOhms * Math.exp(beta * (1 / kelvin - 1 / referenceKelvin));
}

/**
 * A thermocouple's voltage: two different metals joined make a small voltage
 * that grows with the temperature difference between the joint and the far
 * ends. The coefficient is given in microvolts per kelvin and the answer is in
 * volts. Real thermocouples are only roughly linear over a wide span.
 */
export function seebeckVoltage(microvoltsPerKelvin: number, deltaKelvin: number): number {
  finite(microvoltsPerKelvin, 'microvoltsPerKelvin');
  real(deltaKelvin, 'deltaKelvin');
  return microvoltsPerKelvin * 1e-6 * deltaKelvin;
}

/**
 * A platinum resistance thermometer: its resistance rises very nearly in
 * proportion to temperature, by about 0.385 percent of its ice point value for
 * each degree. Linear is an approximation over a wide span, but it is a far
 * better one than a thermistor manages.
 */
export function rtdResistance(referenceOhms: number, alphaPerCelsius: number, celsius: number): number {
  finite(referenceOhms, 'referenceOhms');
  finite(alphaPerCelsius, 'alphaPerCelsius');
  real(celsius, 'celsius');
  return referenceOhms * (1 + alphaPerCelsius * celsius);
}

/**
 * A strain gauge stretched with the thing it is glued to gets longer and
 * thinner, so its resistance rises. The gauge factor is how many parts of
 * resistance change per part of length change, and it is about two for foil.
 */
export function strainGaugeResistance(baseOhms: number, gaugeFactor: number, strain: number): number {
  finite(baseOhms, 'baseOhms');
  finite(gaugeFactor, 'gaugeFactor');
  real(strain, 'strain');
  return baseOhms * (1 + gaugeFactor * strain);
}

// ---------------------------------------------------------------------------
// Part 5: the digital domain.
// ---------------------------------------------------------------------------

const whole = (value: number, name: string) => {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a whole number, zero or more`);
  return value;
};

/** How many different values a given number of bits can tell apart. */
export function quantizationLevels(bits: number): number {
  whole(bits, 'bits');
  return 2 ** bits;
}

/**
 * The best signal to noise ratio a given depth can give, in decibels, for a
 * full scale sine wave, under the usual assumption that the rounding error is
 * spread evenly across one step: about six decibels for every bit, plus a
 * little. It is not a figure for any other waveform, and a quieter signal uses
 * fewer levels and does worse.
 */
export function quantizationSnr(bits: number): number {
  whole(bits, 'bits');
  return 6.02 * bits + 1.76;
}

/**
 * The sampling rate a signal needs. To reconstruct a wave you must sample at
 * more than twice its highest frequency, so this returns the rate to exceed
 * and not a rate that is sufficient on its own.
 */
export function nyquistRate(frequency: number): number {
  finite(frequency, 'frequency');
  return 2 * frequency;
}

/**
 * What a signal sampled too slowly turns into, keeping the sign. Anything above
 * half the sample rate folds back down into the range below it, and the sign
 * matters: where the fold comes out negative the tone comes back inverted, and a
 * wave drawn without that inversion will not pass through the samples it is
 * supposed to explain. Zero means every sample catches the same phase, so what
 * is stored is a constant rather than any tone at all.
 */
export function aliasSigned(signal: number, sampleRate: number): number {
  finite(signal, 'signal');
  finite(sampleRate, 'sampleRate');
  return signal - sampleRate * Math.round(signal / sampleRate);
}

/** How fast the folded tone appears to run, without regard to its sign. */
export function aliasFrequency(signal: number, sampleRate: number): number {
  return Math.abs(aliasSigned(signal, sampleRate));
}

/**
 * Rounding to a fixed ladder, the way a signed converter does it. Two to the n
 * levels run from minus one up to one step short of plus one, with zero itself
 * one of them, and the count of distinct outputs is the count of levels and
 * never one more. Anything past either end is clipped to it, which is what a
 * real converter does and why recordings are made with headroom.
 *
 * Zero has to be a level. On a ladder with a boundary there instead, a signal
 * that sits at zero flips between the two levels either side of it on nothing
 * more than arithmetic dust.
 */
export function quantize(value: number, bits: number): number {
  real(value, 'value');
  whole(bits, 'bits');
  const half = 2 ** bits / 2;
  const code = Math.min(half - 1, Math.max(-half, Math.round(value * half)));
  const level = code / half;
  // Negative zero is the same number as zero and draws in the same place, but it
  // compares unequal under a strict check, so it is not worth carrying around.
  return level === 0 ? 0 : level;
}

/** The value one code stands for, so a ladder can be ruled where the rounding lands. */
export function quantizationLevel(code: number, bits: number): number {
  whole(code, 'code');
  whole(bits, 'bits');
  const levels = 2 ** bits;
  if (code >= levels) throw new RangeError('code does not fit in bits');
  return (code - levels / 2) / (levels / 2);
}

/** Bits per second from a sampling rate, a depth and a number of channels. */
export function sampleBitrate(rateHz: number, bits: number, channels = 1): number {
  finite(rateHz, 'rateHz');
  whole(bits, 'bits');
  finite(channels, 'channels');
  return rateHz * bits * channels;
}

/**
 * How long the disc takes to bring a wanted sector under the head, on average:
 * half a turn. At 7,200 revolutions a minute that is about four milliseconds,
 * and no amount of cleverness in the software makes it shorter.
 */
export function rotationalLatency(rpm: number): number {
  finite(rpm, 'rpm');
  return 30 / rpm;
}

/** Bytes on one surface: tracks times sectors times the bytes in a sector. */
export function trackCapacity(sectors: number, bytesPerSector: number): number {
  finite(sectors, 'sectors');
  finite(bytesPerSector, 'bytesPerSector');
  return sectors * bytesPerSector;
}

/** What the head reads while one track passes under it, each turn of the disc. */
export function transferRate(bytesPerTrack: number, rpm: number): number {
  finite(bytesPerTrack, 'bytesPerTrack');
  finite(rpm, 'rpm');
  return (bytesPerTrack * rpm) / 60;
}

/** The largest number a given width of bits can hold, counting from zero. */
export function maxUnsigned(bits: number): number {
  whole(bits, 'bits');
  return 2 ** bits - 1;
}

/** A number written in binary, padded to a given width. */
export function binaryString(value: number, bits: number): string {
  whole(value, 'value');
  whole(bits, 'bits');
  if (value > maxUnsigned(bits)) throw new RangeError('value does not fit in bits');
  return value.toString(2).padStart(bits, '0');
}

/**
 * How long a ripple carry adder takes: the carry has to cross every stage in
 * turn before the top bit is known. Two gate delays per stage is the usual
 * model for a full adder's carry path, and a real adder is built to beat it.
 */
export function rippleCarryDelay(bits: number, gateDelaySeconds: number, gatesPerStage = 2): number {
  finite(bits, 'bits');
  finite(gateDelaySeconds, 'gateDelaySeconds');
  finite(gatesPerStage, 'gatesPerStage');
  return bits * gatesPerStage * gateDelaySeconds;
}

/**
 * A carry lookahead adder works the carries out from the inputs directly
 * rather than passing them along, so its delay grows with the logarithm of the
 * width instead of the width. Two gate delays for each level of the tree, and
 * one at each end, are a model of the usual arrangement and not a measurement
 * of any particular silicon.
 */
export function lookaheadDelay(bits: number, gateDelaySeconds: number): number {
  finite(bits, 'bits');
  finite(gateDelaySeconds, 'gateDelaySeconds');
  return (2 + 2 * Math.ceil(Math.log2(bits))) * gateDelaySeconds;
}

/** A power ratio from decibels: ten decibels is ten times the power, not twice. */
export function powerRatio(decibelValue: number): number {
  real(decibelValue, 'decibelValue');
  return 10 ** (decibelValue / 10);
}

/**
 * Shannon's limit: the fastest a channel of a given bandwidth can carry error
 * free information through a given amount of noise. The ratio here is a ratio
 * of powers, not decibels. No cleverness of coding gets past it, and nothing
 * reaches it either.
 */
export function shannonCapacity(bandwidthHz: number, signalToNoise: number): number {
  finite(bandwidthHz, 'bandwidthHz');
  real(signalToNoise, 'signalToNoise');
  if (signalToNoise < 0) throw new RangeError('signalToNoise must be zero or more');
  return bandwidthHz * Math.log2(1 + signalToNoise);
}

/** How long a number of bytes takes to send down a link of a given rate, ignoring overheads. */
export function transferSeconds(bytes: number, bitsPerSecond: number): number {
  finite(bytes, 'bytes');
  finite(bitsPerSecond, 'bitsPerSecond');
  return (bytes * 8) / bitsPerSecond;
}

/** How many colors a given depth per channel can name across three channels. */
export function colorCount(bitsPerChannel: number, channels = 3): number {
  whole(bitsPerChannel, 'bitsPerChannel');
  whole(channels, 'channels');
  return 2 ** (bitsPerChannel * channels);
}

/** The bytes in one uncompressed frame, from its pixels and its bits per pixel. */
export function frameBytes(pixels: number, bitsPerPixel: number): number {
  finite(pixels, 'pixels');
  finite(bitsPerPixel, 'bitsPerPixel');
  return (pixels * bitsPerPixel) / 8;
}

/** Bits per second of uncompressed video, which is why video is never sent uncompressed. */
export function videoBitrate(bytesPerFrame: number, fps: number): number {
  finite(bytesPerFrame, 'bytesPerFrame');
  finite(fps, 'fps');
  return bytesPerFrame * 8 * fps;
}

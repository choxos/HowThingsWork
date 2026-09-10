import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crankStroke,
  effortFor,
  gearTrain,
  inclinedPlane,
  lever,
  leverArms,
  leverGeometry,
  rodObliquity,
  slopeAngle,
  wheelAndAxle,
  work,
  pulley,
  screw,
  threadLead,
  helixAngle,
  centripetalForce,
  rotationalEnergy,
  discInertia,
  precessionRate,
  springForce,
  springEnergy,
  springsInSeries,
  springsInParallel,
  frictionForce,
  slipAngle,
  frictionHeat,
  GRAVITY,
  buoyantForce,
  submergedFraction,
  pressureAtDepth,
  dynamicPressure,
  liftCoefficient,
  wingLift,
  aerodynamicForce,
  dragCoefficient,
  wingDrag,
  hydraulicPress,
  pistonArea,
  boylePressure,
  boyleVolume,
  ATMOSPHERE,
  carnotEfficiency,
  ottoEfficiency,
  coolingLimit,
  massEnergy,
  chainGrowth,
  remainingFraction,
  SOUND_SPEED,
  thinLens,
  OPTICAL_ELEMENTS,
  apertureLight,
  stopsBetween,
  exposureTime,
  depthOfField,
  halftoneTint,
  dotPitch,
  angularSize,
  stringFrequency,
  pipeFrequency,
  wavelength,
  semitonesFrom,
  noteName,
  decibels,
  quarterWave,
} from './physics.ts';

test('a ramp twice as long as it is tall halves the effort', () => {
  const ramp = inclinedPlane(4, 2);
  assert.equal(ramp.forceRatio, 2);
  assert.equal(effortFor(100, ramp), 50);
});

test('work put in equals work got out', () => {
  const load = 240;
  const height = 1.5;
  const ramp = inclinedPlane(6, height);
  assert.equal(work(effortFor(load, ramp), 6), work(load, height));
});

test('slope angle falls as the ramp lengthens', () => {
  assert.equal(Math.round(slopeAngle(2, 2)), 90);
  assert.equal(Math.round(slopeAngle(4, 2)), 30);
  assert.ok(slopeAngle(8, 2) < slopeAngle(4, 2));
});

test('a ramp cannot be shorter than the height it climbs', () => {
  assert.throws(() => inclinedPlane(1, 2), RangeError);
  assert.throws(() => wheelAndAxle(1, 0), RangeError);
});

test('effort times its arm equals load times its arm', () => {
  const balance = lever(3, 1);
  assert.equal(balance.forceRatio, 3);
  assert.equal(effortFor(90, balance), 30);
});

test('a second class lever always multiplies force, a third class one never does', () => {
  const bar = 10;
  for (const pivot of [1, 3, 5, 7, 9]) {
    assert.ok(leverArms('second', bar, pivot).forceRatio > 1);
    assert.ok(leverArms('third', bar, pivot).forceRatio < 1);
  }
});

test('a first class lever with a centered fulcrum balances', () => {
  assert.equal(leverArms('first', 10, 5).forceRatio, 1);
  assert.ok(leverArms('first', 10, 8).forceRatio > 1);
});

test('the fulcrum stays on the bar however far the slider is pushed', () => {
  for (const pivot of [-40, 0, 5, 10, 400]) {
    const {fulcrum} = leverGeometry('first', 10, pivot);
    assert.ok(fulcrum > 0 && fulcrum < 10);
  }
});

test('a winch drum four times narrower than its handles quadruples the force', () => {
  const winch = wheelAndAxle(0.8, 0.2);
  assert.equal(winch.forceRatio, 4);
  assert.equal(winch.distanceRatio, 4);
});

test('a gear with three times the teeth turns a third as fast and three times as hard', () => {
  const train = gearTrain(12, 36);
  assert.equal(train.forceRatio, 3);
  assert.equal(train.distanceRatio, 3);
});

test('equal gears pass motion straight through', () => {
  assert.equal(gearTrain(20, 20).forceRatio, 1);
  assert.throws(() => gearTrain(20, 0), RangeError);
});

test('a crank draws its rod through twice the throw', () => {
  assert.equal(crankStroke(0.4), 0.8);
  assert.throws(() => crankStroke(-1), RangeError);
});

test('a longer connecting rod leans less', () => {
  assert.ok(rodObliquity(1, 3) > rodObliquity(1, 6));
  assert.equal(Math.round(rodObliquity(1, 2)), 30);
  assert.throws(() => rodObliquity(2, 2), RangeError);
});

test('a pulley system counts supporting rope parts, not wheels', () => {
  assert.equal(pulley(1).forceRatio, 1);
  assert.equal(pulley(4).forceRatio, 4);
  assert.equal(pulley(4).distanceRatio, 4);
  assert.throws(() => pulley(2.5), RangeError);
});

test('a finer thread multiplies force more', () => {
  const coarse = screw(0.12, 0.004);
  const fine = screw(0.12, 0.001);
  assert.ok(fine.forceRatio > coarse.forceRatio);
  assert.equal(Math.round(screw(1 / (2 * Math.PI), 0.01).forceRatio), 100);
});

test('lead is the pitch times the number of thread starts', () => {
  assert.equal(threadLead(0.002), 0.002);
  assert.equal(threadLead(0.002, 3), 0.006);
});

test('the helix angle is the slope of the unwrapped ramp', () => {
  // A thread whose lead equals its own circumference unwraps to a 45 degree ramp.
  assert.equal(Math.round(helixAngle(1, 2 * Math.PI)), 45);
  assert.ok(helixAngle(1, 0.5) < helixAngle(1, 1));
});

test('centripetal force grows with the square of the rate', () => {
  const slow = centripetalForce(2, 0.5, 1);
  const fast = centripetalForce(2, 0.5, 2);
  assert.ok(Math.abs(fast / slow - 4) < 1e-9);
  assert.ok(Math.abs(centripetalForce(1, 1, 1 / (2 * Math.PI)) - 1) < 1e-12);
});

test('a flywheel stores energy with the square of the rate', () => {
  assert.equal(discInertia(4, 0.5), 0.5);
  const one = rotationalEnergy(discInertia(4, 0.5), 1);
  const two = rotationalEnergy(discInertia(4, 0.5), 2);
  assert.ok(Math.abs(two / one - 4) < 1e-9);
});

test('a faster spin precesses more slowly, and reverses with the spin', () => {
  const slow = precessionRate(1, 0.02, 4);
  const fast = precessionRate(1, 0.02, 8);
  assert.ok(Math.abs(slow / fast - 2) < 1e-9);
  assert.ok(precessionRate(1, 0.02, -4) < 0);
  assert.throws(() => precessionRate(1, 0.02, 0), RangeError);
});

test('a spring answers in proportion, and stores the area under that line', () => {
  assert.equal(springForce(200, 0.05), 10);
  assert.equal(springForce(200, -0.05), -10);
  assert.equal(springEnergy(200, 0.05), 0.25);
  // Twice the deflection stores four times the energy.
  assert.equal(springEnergy(200, 0.1) / springEnergy(200, 0.05), 4);
});

test('springs end to end are softer, side by side stiffer', () => {
  assert.equal(springsInSeries([100, 100]), 50);
  assert.equal(springsInParallel([100, 100]), 200);
  assert.ok(springsInSeries([100, 300]) < 100);
  assert.throws(() => springsInSeries([]), RangeError);
});

test('friction scales with the pressing force and sets the slip angle', () => {
  assert.equal(frictionForce(0.4, 250), 100);
  assert.equal(Math.round(slipAngle(1)), 45);
  assert.ok(slipAngle(0.2) < slipAngle(0.8));
  assert.equal(frictionHeat(0.4, 250, 3), 300);
});

test('upthrust is the weight of the fluid pushed aside', () => {
  // A cubic meter of fresh water weighs about 9.81 kN.
  assert.ok(Math.abs(buoyantForce(1, 1000) - 9810) < 1e-9);
  assert.equal(buoyantForce(2, 1000) / buoyantForce(1, 1000), 2);
  assert.throws(() => buoyantForce(0, 1000), RangeError);
});

test('what floats sits as deep as its density says', () => {
  // Ice at 917 against sea water at 1025: about a ninth shows.
  assert.ok(Math.abs(submergedFraction(917, 1025) - 0.8946) < 0.001);
  // Steel cannot float as a lump but a hull of the same steel can.
  assert.ok(submergedFraction(7850, 1000) > 1);
  assert.ok(submergedFraction(7850 / 12, 1000) < 1);
  // The same body floats higher in salt water than in fresh.
  assert.ok(submergedFraction(700, 1025) < submergedFraction(700, 1000));
});

test('pressure grows with depth and with the density of the fluid', () => {
  assert.ok(Math.abs(pressureAtDepth(10, 1000) - 98100) < 1e-9);
  assert.equal(pressureAtDepth(0, 1000), 0);
  assert.ok(pressureAtDepth(10, 1025) > pressureAtDepth(10, 1000));
});

test('dynamic pressure and lift both go with the square of the speed', () => {
  assert.ok(Math.abs(dynamicPressure(1.225, 10) - 61.25) < 1e-9);
  const slow = aerodynamicForce(1, 1.225, 50, 20);
  const fast = aerodynamicForce(1, 1.225, 100, 20);
  assert.ok(Math.abs(fast / slow - 4) < 1e-9);
});

test('lift climbs with the angle until the wing stalls', () => {
  assert.equal(liftCoefficient(0), 0);
  // The thin airfoil slope: about 0.11 for every degree.
  assert.ok(Math.abs(liftCoefficient(5) / 5 - 0.1097) < 0.001);
  assert.ok(liftCoefficient(10) > liftCoefficient(5));
  // Past the stall it falls away rather than continuing to climb.
  assert.ok(liftCoefficient(20) < liftCoefficient(15));
  assert.ok(liftCoefficient(30) < liftCoefficient(20));
});

test('a stalled wing pays far more drag than a flying one', () => {
  // Attached, the two agree exactly.
  assert.equal(wingDrag(10, 15, wingLift(10, 15), 9), dragCoefficient(wingLift(10, 15), 9));
  // Past the stall, glide performance collapses rather than improving.
  const flying = wingLift(15, 15) / wingDrag(15, 15, wingLift(15, 15), 9);
  const stalled = wingLift(24, 15) / wingDrag(24, 15, wingLift(24, 15), 9);
  assert.ok(stalled < flying / 5);
});

test('a slender wing pays less drag for the same lift', () => {
  assert.ok(dragCoefficient(1, 20) < dragCoefficient(1, 6));
  // The price of lift goes with its square.
  const one = dragCoefficient(1, 8, 0) ;
  const two = dragCoefficient(2, 8, 0);
  assert.ok(Math.abs(two / one - 4) < 1e-9);
});

test('a hydraulic press trades area for distance', () => {
  const press = hydraulicPress(pistonArea(20), pistonArea(100));
  assert.ok(Math.abs(press.forceRatio - 25) < 1e-9);
  assert.equal(press.forceRatio, press.distanceRatio);
  assert.ok(Math.abs(pistonArea(2) - Math.PI) < 1e-9);
});

test('a gas gives where a liquid does not', () => {
  assert.equal(boylePressure(100, 2, 1), 200);
  assert.equal(boylePressure(100, 1, 4), 25);
  // Read the other way: four times the pressure leaves a quarter of the room.
  assert.equal(boyleVolume(1, 100, 4), 25);
  assert.equal(boyleVolume(1, 100, boylePressure(1, 100, 25)), 25);
  assert.ok(ATMOSPHERE > 1 && ATMOSPHERE < 1.02);
});

test('no engine beats the Carnot figure, and it needs kelvin', () => {
  // 600 K in, 300 K out: half at the very best.
  assert.ok(Math.abs(carnotEfficiency(600, 300) - 0.5) < 1e-9);
  assert.equal(carnotEfficiency(400, 400), 0);
  assert.throws(() => carnotEfficiency(300, 400), RangeError);
  // A wider gap allows more.
  assert.ok(carnotEfficiency(800, 300) > carnotEfficiency(600, 300));
});

test('squeezing harder wins more, with diminishing returns', () => {
  assert.ok(Math.abs(ottoEfficiency(10) - 0.6019) < 0.001);
  assert.ok(ottoEfficiency(12) > ottoEfficiency(10));
  assert.ok(ottoEfficiency(12) - ottoEfficiency(10) < ottoEfficiency(10) - ottoEfficiency(8));
  assert.throws(() => ottoEfficiency(1), RangeError);
});

test('a refrigerator moves more heat than the energy it uses', () => {
  // Freezer at 255 K in a 295 K kitchen: about six units moved per unit spent.
  assert.ok(Math.abs(coolingLimit(295, 255) - 6.375) < 0.001);
  // And it does worse the harder the job.
  assert.ok(coolingLimit(295, 235) < coolingLimit(295, 255));
  assert.throws(() => coolingLimit(295, 295), RangeError);
});

test('mass is energy, and a chain either dies or runs away', () => {
  assert.ok(Math.abs(massEnergy(1) - 8.98755178736818e16) < 1e9);
  assert.equal(chainGrowth(1, 100), 1);
  // No generations have passed yet, so nothing has happened.
  assert.equal(chainGrowth(1.04, 0), 1);
  assert.throws(() => chainGrowth(1.04, -1), RangeError);
  assert.ok(chainGrowth(0.99, 200) < 0.2);
  assert.ok(chainGrowth(1.01, 200) > 7);
  assert.equal(remainingFraction(0, 30), 1);
  assert.equal(remainingFraction(30, 30), 0.5);
  assert.equal(remainingFraction(90, 30), 0.125);
  assert.throws(() => remainingFraction(-1, 30), RangeError);
});

test('gravity is the standard figure the rest of this file assumes', () => {
  assert.equal(GRAVITY, 9.81);
});

test('flaps make more lift at every angle and stall a little sooner', () => {
  assert.ok(wingLift(6, 12, 0.8) > wingLift(6, 15));
  assert.equal(wingLift(6, 15, 0), liftCoefficient(6, 15));
  // A flapped wing gives up earlier, so beyond its stall it is the worse of the two.
  assert.ok(wingLift(14, 12, 0.8) < wingLift(14, 15, 0) + 0.8);
});

test('a thin lens puts the image where the equation says', () => {
  // Twice the focal length out gives twice the focal length back, life size,
  // upside down.
  const even = thinLens(100, 200);
  assert.ok(Math.abs(even.distance - 200) < 1e-9);
  assert.ok(Math.abs(even.magnification + 1) < 1e-9);
  assert.equal(even.real, true);
  // At the focal point the rays leave parallel and there is no image.
  assert.equal(thinLens(100, 100).distance, Infinity);
  // Inside it the image turns virtual, upright and larger: a magnifying glass.
  const glass = thinLens(100, 50);
  assert.ok(glass.distance < 0);
  assert.equal(glass.real, false);
  assert.ok(glass.magnification > 1);
  // Far away, the image sits at the focal plane and is tiny.
  const distant = thinLens(50, 100000);
  assert.ok(Math.abs(distant.distance - 50.025) < 0.01);
  assert.ok(Math.abs(distant.magnification) < 0.001);
});

test('one stop is a factor of two in light', () => {
  assert.ok(Math.abs(stopsBetween(8, 11.3) - 1) < 0.01);
  assert.ok(Math.abs(stopsBetween(8, 4) + 2) < 1e-9);
  assert.ok(Math.abs(apertureLight(4) / apertureLight(8) - 4) < 1e-9);
  // And the shutter has to make up exactly what the aperture took away.
  assert.ok(Math.abs(exposureTime(11.3, 100) / exposureTime(8, 100) - 2) < 0.01);
  assert.ok(Math.abs(exposureTime(8, 800) / exposureTime(8, 100) - 0.125) < 1e-9);
  assert.ok(Math.abs(exposureTime(8, 100) - 1 / 125) < 1e-12);
});

test('a narrower aperture deepens the field, a longer lens shrinks it', () => {
  const wide = depthOfField(50, 2, 2000);
  const narrow = depthOfField(50, 16, 2000);
  assert.ok(narrow.depth > wide.depth);
  assert.ok(depthOfField(100, 8, 2000).depth < depthOfField(50, 8, 2000).depth);
  // Stepping back deepens it faster than closing down does.
  assert.ok(depthOfField(50, 8, 4000).depth > 3 * depthOfField(50, 8, 2000).depth);
  // Past the hyperfocal distance everything to the horizon is sharp.
  assert.equal(depthOfField(50, 8, 100000).far, Infinity);
});

test('a halftone is an average of paper and solid ink', () => {
  assert.ok(Math.abs(halftoneTint(0) - 0.9) < 1e-9);
  assert.ok(Math.abs(halftoneTint(1) - 0.05) < 1e-9);
  assert.ok(Math.abs(halftoneTint(0.5) - 0.475) < 1e-9);
  assert.throws(() => halftoneTint(1.2), RangeError);
  assert.ok(Math.abs(dotPitch(150) - 0.1693) < 0.001);
  // A 150 line screen at arm's length is under a minute of arc, so it reads
  // as continuous tone.
  assert.ok(angularSize(dotPitch(150), 300) < 2);
  assert.ok(angularSize(dotPitch(25), 300) > 5);
});

test('a string sounds by its length, its tension and its weight', () => {
  // A string an octave shorter sounds an octave higher.
  const open = stringFrequency(0.65, 70, 0.0005);
  const stopped = stringFrequency(0.325, 70, 0.0005);
  assert.ok(Math.abs(stopped / open - 2) < 1e-9);
  // Four times the tension is one octave, because the pitch goes with the root.
  assert.ok(Math.abs(stringFrequency(0.65, 280, 0.0005) / open - 2) < 1e-9);
  assert.ok(stringFrequency(0.65, 70, 0.002) < open);
});

test('a stopped pipe sounds an octave below an open one of the same length', () => {
  assert.ok(Math.abs(pipeFrequency(0.5, false) / pipeFrequency(0.5, true) - 2) < 1e-9);
  assert.ok(Math.abs(pipeFrequency(0.5) - 343) < 1e-9);
  assert.ok(Math.abs(wavelength(SOUND_SPEED, 343) - 1) < 1e-9);
});

test('twelve semitones make a doubling, and decibels are powers of ten', () => {
  assert.ok(Math.abs(semitonesFrom(440, 880) - 12) < 1e-9);
  assert.equal(noteName(440), 'A4');
  assert.equal(noteName(880), 'A5');
  assert.equal(noteName(261.63), 'C4');
  assert.ok(Math.abs(decibels(10) - 10) < 1e-9);
  assert.ok(Math.abs(decibels(100) - 20) < 1e-9);
  assert.ok(Math.abs(decibels(2) - 3.0103) < 0.001);
});

test('a quarter wave antenna is a quarter of the wave it listens for', () => {
  // 100 MHz has a three meter wavelength, so the antenna is three quarters of one.
  assert.ok(Math.abs(quarterWave(100e6) - 0.7495) < 0.001);
  // Long wave needs a mast; a phone band needs a few centimeters.
  assert.ok(quarterWave(198e3) > 300);
  assert.ok(quarterWave(1.8e9) < 0.05);
});


test('friction readouts distinguish holding grip from sliding resistance', async () => {
  const {readings} = await import('./studio-controls.ts');
  for (const coefficient of [0.05, 0.6, 1.2]) {
    // At every weight the second slider offers, because the pull and the heat
    // follow it and the angle famously does not.
    for (const weight of [200, 981, 3000]) {
      const rows = readings('friction', coefficient, '', {weight});
      assert.equal(rows.find(r => r.label === 'Pull to drag the block')?.value,
        `${Math.round(coefficient * 0.8 * weight)} N`);
      assert.equal(rows.find(r => r.label === 'Heat per meter')?.value,
        `${Math.round(coefficient * 0.8 * weight)} J`);
      assert.equal(rows.find(r => r.label === 'Slips at')?.value,
        `${(Math.atan(coefficient) * 180 / Math.PI).toFixed(1)}°`);
    }
  }
});

// ---------------------------------------------------------------------------
// Electricity and automation.
// ---------------------------------------------------------------------------

test('Ohm’s law and power agree with each other', async () => {
  const {ohmsCurrent, electricalPower} = await import('./physics.ts');
  assert.equal(ohmsCurrent(12, 6), 2);
  assert.equal(electricalPower(12, ohmsCurrent(12, 6)), 24);
  // Doubling the resistance halves the current and halves the power.
  assert.equal(electricalPower(12, ohmsCurrent(12, 12)), 12);
});

test('resistances add in series and share the load in parallel', async () => {
  const {seriesResistance, parallelResistance} = await import('./physics.ts');
  assert.equal(seriesResistance([10, 20, 30]), 60);
  assert.equal(parallelResistance([10, 10]), 5);
  // Parallel is always below the smallest branch.
  assert.ok(parallelResistance([10, 40]) < 10);
  assert.equal(parallelResistance([12]), 12);
});

test('electrons are many and slow', async () => {
  const {electronsPerSecond, driftSpeed, ELEMENTARY_CHARGE} = await import('./physics.ts');
  assert.equal(electronsPerSecond(1), 1 / ELEMENTARY_CHARGE);
  // One amp in 1.5 square millimeters of copper drifts well under a millimeter a second.
  const speed = driftSpeed(1, 1.5);
  assert.ok(speed > 2e-5 && speed < 1e-4, `drift speed ${speed}`);
});

test('a solenoid field grows with turns per meter and with current', async () => {
  const {solenoidField, MU0} = await import('./physics.ts');
  assert.equal(solenoidField(400, 0.2, 2), MU0 * 2000 * 2);
  assert.ok(Math.abs(solenoidField(400, 0.2, 2) - 0.00503) < 1e-4);
  // An iron core multiplies it, and doubling the current doubles it again.
  assert.equal(solenoidField(400, 0.2, 2, 200), 200 * solenoidField(400, 0.2, 2));
  assert.equal(solenoidField(400, 0.2, 4), 2 * solenoidField(400, 0.2, 2));
});

test('dipole field lines close on themselves', async () => {
  const {dipoleLineRadius} = await import('./physics.ts');
  // On the axis the line has no width; at the equator it reaches its full radius.
  assert.equal(dipoleLineRadius(2, 0), 0);
  assert.ok(Math.abs(dipoleLineRadius(2, Math.PI) - 0) < 1e-15);
  assert.equal(dipoleLineRadius(2, Math.PI / 2), 2);
});

test('coil torque peaks along the field and vanishes across it', async () => {
  const {motorTorque} = await import('./physics.ts');
  const flat = motorTorque(50, 0.4, 3, 0.01, 0);
  assert.ok(Math.abs(flat - 50 * 0.4 * 3 * 0.01) < 1e-12);
  assert.ok(Math.abs(motorTorque(50, 0.4, 3, 0.01, 90)) < 1e-12);
  // Half way round the coil has turned past the dead point and pushes the other way.
  assert.ok(motorTorque(50, 0.4, 3, 0.01, 180) < 0);
});

test('back voltage limits the current a motor draws', async () => {
  const {inducedEmfPeak, motorCurrent} = await import('./physics.ts');
  // Stalled, the winding resistance is all that holds the current back.
  assert.equal(motorCurrent(12, 0, 1.5), 8);
  const running = inducedEmfPeak(50, 0.4, 0.01, 20);
  assert.ok(running > 0);
  assert.ok(motorCurrent(12, running, 1.5) < 8);
});

test('a transformer trades volts for amps at the same power', async () => {
  const {transformerVolts, transformerAmps} = await import('./physics.ts');
  assert.equal(transformerVolts(230, 1000, 100), 23);
  assert.equal(transformerAmps(1, 1000, 100), 10);
  // Ideal, so the power is unchanged either way round.
  assert.ok(Math.abs(230 * 1 - transformerVolts(230, 1000, 100) * transformerAmps(1, 1000, 100)) < 1e-9);
});

test('line loss falls with the square of the transmission voltage', async () => {
  const {lineLoss} = await import('./physics.ts');
  const low = lineLoss(1e6, 1e4, 5);
  const high = lineLoss(1e6, 1e5, 5);
  assert.ok(Math.abs(low / high - 100) < 1e-9);
});

test('a divider splits the supply in the ratio of its halves', async () => {
  const {dividerVoltage} = await import('./physics.ts');
  assert.equal(dividerVoltage(5, 1000, 1000), 2.5);
  assert.equal(dividerVoltage(5, 3000, 1000), 1.25);
});

test('sensors answer the world in the direction they should', async () => {
  const {thermistorResistance, seebeckVoltage, strainGaugeResistance} = await import('./physics.ts');
  // At its reference temperature a thermistor reads its reference resistance.
  assert.ok(Math.abs(thermistorResistance(10000, 3950, 298.15) - 10000) < 1e-9);
  // Hotter means less resistance for this type.
  assert.ok(thermistorResistance(10000, 3950, 323.15) < 10000);
  assert.ok(thermistorResistance(10000, 3950, 273.15) > 10000);
  // A type K thermocouple gives about forty microvolts per kelvin.
  assert.ok(Math.abs(seebeckVoltage(41, 100) - 0.0041) < 1e-12);
  assert.equal(seebeckVoltage(41, 0), 0);
  assert.equal(strainGaugeResistance(120, 2, 0), 120);
  assert.ok(Math.abs(strainGaugeResistance(120, 2, 0.001) - 120.24) < 1e-9);
});

// ---------------------------------------------------------------------------
// The digital domain.
// ---------------------------------------------------------------------------

test('bit depth sets both the levels and the noise floor', async () => {
  const {quantizationLevels, quantizationSnr} = await import('./physics.ts');
  assert.equal(quantizationLevels(8), 256);
  assert.equal(quantizationLevels(16), 65536);
  assert.equal(quantizationLevels(0), 1);
  // Every added bit is worth about six decibels.
  assert.ok(Math.abs(quantizationSnr(16) - quantizationSnr(15) - 6.02) < 1e-9);
  assert.ok(Math.abs(quantizationSnr(16) - 98.08) < 1e-9);
});

test('sampling below the Nyquist rate folds a tone down to a lower one', async () => {
  const {nyquistRate, aliasFrequency} = await import('./physics.ts');
  assert.equal(nyquistRate(20000), 40000);
  // Sampled fast enough, the tone is itself.
  assert.equal(aliasFrequency(1000, 44100), 1000);
  // Sampled too slowly, 30 kHz arrives as 14.1 kHz and cannot be told from a real one.
  assert.ok(Math.abs(aliasFrequency(30000, 44100) - 14100) < 1e-9);
  // Exactly at half the rate it folds onto itself.
  assert.equal(aliasFrequency(22050, 44100), 22050);
});

test('a compact disc stream comes out at the rate it is famous for', async () => {
  const {sampleBitrate} = await import('./physics.ts');
  assert.equal(sampleBitrate(44100, 16, 2), 1411200);
});

test('half a turn is the average wait for a sector', async () => {
  const {rotationalLatency, trackCapacity, transferRate} = await import('./physics.ts');
  assert.ok(Math.abs(rotationalLatency(7200) - 0.0041667) < 1e-6);
  assert.equal(trackCapacity(63, 512), 32256);
  assert.equal(transferRate(32256, 7200), 32256 * 120);
});

test('binary width sets what a machine can count to', async () => {
  const {maxUnsigned, binaryString, rippleCarryDelay} = await import('./physics.ts');
  assert.equal(maxUnsigned(8), 255);
  assert.equal(maxUnsigned(1), 1);
  assert.equal(binaryString(5, 4), '0101');
  assert.equal(binaryString(0, 3), '000');
  assert.throws(() => binaryString(16, 4), RangeError);
  // Twice the width is twice the wait for the carry.
  assert.equal(rippleCarryDelay(8, 1e-9), 16e-9);
  assert.equal(rippleCarryDelay(16, 1e-9) / rippleCarryDelay(8, 1e-9), 2);
});

test('Shannon’s limit rises with bandwidth and with the signal to noise ratio', async () => {
  const {shannonCapacity, powerRatio, transferSeconds} = await import('./physics.ts');
  // A telephone line: about 3.1 kHz at 30 dB carries a little over 30 kbit/s.
  const capacity = shannonCapacity(3100, powerRatio(30));
  assert.ok(capacity > 30000 && capacity < 32000, `capacity ${capacity}`);
  // No noise ratio at all leaves no capacity.
  assert.equal(shannonCapacity(3100, 0), 0);
  assert.equal(powerRatio(0), 1);
  assert.ok(Math.abs(powerRatio(20) - 100) < 1e-9);
  assert.equal(transferSeconds(1e6, 8e6), 1);
});

test('pictures grow with pixels and with depth', async () => {
  const {colorCount, frameBytes, videoBitrate} = await import('./physics.ts');
  assert.equal(colorCount(8), 16777216);
  assert.equal(colorCount(1), 8);
  assert.equal(frameBytes(1920 * 1080, 24), 1920 * 1080 * 3);
  assert.equal(videoBitrate(frameBytes(1920 * 1080, 24), 30), 1920 * 1080 * 3 * 8 * 30);
});

test('a platinum sensor is very nearly a straight line', async () => {
  const {rtdResistance} = await import('./physics.ts');
  assert.equal(rtdResistance(100, 0.00385, 0), 100);
  assert.ok(Math.abs(rtdResistance(100, 0.00385, 100) - 138.5) < 1e-9);
  // Equal steps in temperature give equal steps in resistance, which a thermistor does not.
  const a = rtdResistance(100, 0.00385, 50) - rtdResistance(100, 0.00385, 0);
  const b = rtdResistance(100, 0.00385, 100) - rtdResistance(100, 0.00385, 50);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('lookahead beats ripple once the word gets wide', async () => {
  const {lookaheadDelay, rippleCarryDelay} = await import('./physics.ts');
  assert.equal(lookaheadDelay(16, 1e-9), 10e-9);
  assert.ok(lookaheadDelay(16, 1e-9) < rippleCarryDelay(16, 1e-9));
  // At one bit there is nothing to look ahead through, so the two agree.
  assert.equal(lookaheadDelay(1, 1e-9), rippleCarryDelay(1, 1e-9));
});

test('the axial field of a real solenoid meets the long coil figure in the middle', async () => {
  const {solenoidAxisField, solenoidField} = await import('./physics.ts');
  // A coil far longer than it is wide: the middle matches the ideal interior value.
  const ideal = solenoidField(400, 2, 2);
  const middle = solenoidAxisField(400, 2, 0.01, 2, 0);
  assert.ok(Math.abs(middle / ideal - 1) < 1e-3, `${middle} against ${ideal}`);
  // At the mouth of a long coil the field is half what it is in the middle.
  const mouth = solenoidAxisField(400, 2, 0.01, 2, 1);
  assert.ok(Math.abs(mouth / middle - 0.5) < 1e-2, `${mouth} against ${middle}`);
  // Outside, it falls away and never turns round.
  const near = solenoidAxisField(400, 0.2, 0.026, 2, 0.25);
  const far = solenoidAxisField(400, 0.2, 0.026, 2, 0.5);
  assert.ok(near > far && far > 0);
  // An iron core multiplies the whole of it in this model.
  assert.ok(Math.abs(solenoidAxisField(400, 0.2, 0.026, 2, 0.25, 600) / near - 600) < 1e-9);
});

test('a compass answers to the ratio of the two fields across it', async () => {
  const {compassDeflection, EARTH_FIELD} = await import('./physics.ts');
  assert.equal(compassDeflection(EARTH_FIELD, 0), 0);
  assert.ok(Math.abs(compassDeflection(EARTH_FIELD, EARTH_FIELD) - 45) < 1e-9);
  // A field much larger than the earth's swings the needle nearly all the way.
  assert.ok(compassDeflection(EARTH_FIELD, 100 * EARTH_FIELD) > 89);
  assert.ok(compassDeflection(EARTH_FIELD, 100 * EARTH_FIELD) < 90);
});

test('the quantizer has exactly as many levels as the depth allows', async () => {
  const {quantize, quantizationLevel, quantizationLevels} = await import('./physics.ts');
  for (const bits of [1, 2, 4, 8]) {
    const ladder = Array.from({length: quantizationLevels(bits)}, (_, k) => quantizationLevel(k, bits));
    const seen = new Set<number>();
    for (let i = 0; i <= 4000; i += 1) seen.add(quantize(Math.sin(i / 71) * 1.4, bits));
    assert.equal(seen.size, quantizationLevels(bits), `${bits} bits gave ${seen.size} values`);
    for (const value of seen) {
      assert.ok(ladder.some(rung => Math.abs(rung - value) < 1e-12), `${value} is not on the ${bits} bit ladder`);
    }
  }
  // Zero is one of the levels, so a signal sitting on it cannot flicker between two.
  assert.equal(quantize(0, 8), 0);
  assert.equal(quantize(-1e-15, 8), 0);
  // Anything past either end is clipped rather than wrapped.
  assert.equal(quantize(9, 4), quantize(1, 4));
  assert.equal(quantize(-9, 4), -1);
});

test('the fold keeps the sign that makes it meet its samples', async () => {
  const {aliasSigned, aliasFrequency} = await import('./physics.ts');
  assert.equal(aliasSigned(12000, 16000), -4000);
  assert.equal(aliasFrequency(12000, 16000), 4000);
  // The folded wave agrees with the original at every sample instant.
  for (const rate of [7000, 9000, 16000, 20000]) {
    const signed = aliasSigned(12000, rate);
    for (let n = 0; n < 12; n += 1) {
      const t = n / rate;
      assert.ok(
        Math.abs(Math.sin(2 * Math.PI * 12000 * t) - Math.sin(2 * Math.PI * signed * t)) < 1e-9,
        `sample ${n} disagrees at ${rate}`,
      );
    }
  }
});

test('the sine RMS helper is about sines and refuses a negative peak', async () => {
  const {sineRms} = await import('./physics.ts');
  assert.ok(Math.abs(sineRms(10) - 7.0710678118654755) < 1e-12);
  assert.throws(() => sineRms(-10), RangeError);
});

test('one lens equation covers every element on the bench', () => {
  // The sign of the focal length is the whole of the difference between an
  // element that can project an image and one that never can.
  for (const [name, {focal}] of Object.entries(OPTICAL_ELEMENTS)) {
    for (let distance = 5; distance <= 500; distance += 5) {
      const image = thinLens(focal, distance);
      if (focal > 0) continue;
      assert.equal(image.real, false, `${name} made a real image at ${distance} mm`);
      assert.ok(Math.abs(image.magnification) <= 1, `${name} magnified at ${distance} mm`);
      assert.ok(image.magnification > 0, `${name} inverted the image at ${distance} mm`);
    }
  }
  // A flat mirror puts the image as far behind as the object stands in front,
  // the same way up and the same size, at every distance.
  for (let distance = 5; distance <= 500; distance += 5) {
    const image = thinLens(Infinity, distance);
    // Taking one reciprocal and then another does not always land back on the
    // number it started from, so this is a comparison and not an equality.
    assert.ok(Math.abs(image.distance + distance) < 1e-9, `flat mirror put the image at ${image.distance}`);
    assert.ok(Math.abs(image.magnification - 1) < 1e-12, `flat mirror resized by ${image.magnification}`);
  }
  // A gathering element changes over from real to virtual at the focal point
  // and nowhere else.
  assert.equal(thinLens(100, 100.1).real, true);
  assert.equal(thinLens(100, 99.9).real, false);
  assert.equal(thinLens(100, 100).distance, Infinity);
  // Zero is not an element.
  assert.throws(() => thinLens(0, 100), RangeError);
  assert.throws(() => thinLens(Number.NaN, 100), RangeError);
});

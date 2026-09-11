import {houseModel, reading as r} from './house-model-kit.js';

// ---------------------------------------------------------------------------
// A siphon cistern: the flush that cannot leak.
//
// Scale: one scene unit is 60 mm. The cistern is 360 mm wide and drawn 6 units;
// its 300 mm depth of water is drawn 5.
//
// Nothing here is on a timer. The whole cycle follows from two pieces of
// hydraulics and one piece of geometry.
//
// Torricelli. Once the siphon is primed, the water in the tank is connected to
// the outlet by a full pipe, and the head driving it is the height of the
// surface above that outlet. The speed is the square root of twice gravity
// times that head, so the discharge is fastest at the start and slows as the
// level falls. It is not a constant rate and the flush is not a straight line.
//
// The air break. The siphon stops not because the water runs out but because
// the level falls to the bottom lip of the bell and air gets in. The moment it
// does, the column parts and the flow stops dead. That is the whole reason a
// siphon cistern cannot leak into the bowl: there is no valve to hold, and no
// partly open state to sit in. It is either full of water or full of air.
//
// The float valve. On the way back up the valve is not open or shut but
// somewhere in between, closing as the float rises, so the refill slows into
// its final level rather than slamming shut. What it can deliver at all depends
// on the supply pressure, through the same square root.
//
// The geometry. How much water a flush uses is not the size of the tank; it is
// the distance between the starting level and the bell lip, times the area of
// the tank. Raising the float raises both the volume and the driving head, so a
// tank set too high wastes water on every flush for the rest of its life.
//
// What is not modeled: the bowl and its trap, the swirl, the priming stroke's
// own hydraulics, friction losses in the bell, and the flapper valve cisterns
// used elsewhere, which do have a part that can be held open.
// ---------------------------------------------------------------------------

const UNIT = 0.06;

export const cisternConstants = Object.freeze({
  /** Plan area of the cistern; level times this is volume. */
  tankArea: 0.055,
  /** How far the outlet sits below the floor of the cistern. */
  outletDrop: 0.25,
  /** The bell's bottom lip. The level falls to here and the siphon takes air. */
  breakLevel: 0.012,
  /** A siphon this well made discharges about this fraction of the ideal. */
  discharge: 0.7,
  gravity: 9.81,
  /** What the float valve can pass wide open at one bar. */
  fillAtOneBar: 0.00008,
  /** Over this much of the last of the rise, the float valve closes down. */
  closingBand: 0.03,
  /** The priming stroke has to lift water this far over the crest. */
  primeStroke: 0.02,
  /** The refill is called finished when the level is this close to its mark. */
  settled: 1e-5,
  duration: 240,
});

const area = diameter => (Math.PI * diameter * diameter) / 4;

/** The instantaneous discharge from a primed siphon at a given level. */
export function siphonDischarge(level, bore) {
  const C = cisternConstants;
  if (level <= C.breakLevel) return 0;
  const head = C.outletDrop + level;
  return C.discharge * area(bore) * Math.sqrt(2 * C.gravity * head);
}

/** What the float valve passes at a given level, with a given supply. */
export function fillRate(level, target, pressure) {
  const C = cisternConstants;
  const short = target - level;
  if (short <= 0) return 0;
  // Wide open until the last few centimetres, then closing in proportion.
  const opening = Math.min(1, short / C.closingBand);
  return C.fillAtOneBar * Math.sqrt(Math.max(0, pressure)) * opening;
}

/**
 * The volume one flush uses, which is geometry alone: the fall from the
 * starting level to the lip, over the plan area of the tank.
 */
export function flushVolume(startLevel) {
  const C = cisternConstants;
  return Math.max(0, startLevel - C.breakLevel) * C.tankArea * 1000;
}

export function createToiletTankModel() {
  const m = houseModel('Toilet tank');
  const {part, box, cylinder, disk, sphere, rod, tube, control, finish, covers} = m;
  const C = cisternConstants;

  const system = part(
    'system',
    'Siphon cistern',
    'A tank, a bell, a standpipe and a float. Lift the disk once and the whole charge goes, whether you want it to or not.',
  );

  const tank = part(
    'tank',
    'Cistern',
    'Holds the charge. Its plan area turns a level into a volume, which is why the same fall means the same litres however the tank is shaped in height.',
    [0, 0, 0],
    system,
  );
  box([6.2, 0.16, 2.8], [0, 0.08, 0], 'cream', tank);
  box([6.2, 5.4, 0.14], [0, 2.7, -1.4], 'cream', tank);
  for (const x of [-3.1, 3.1]) box([0.14, 5.4, 2.8], [x, 2.7, 0], 'cream', tank);
  const front = box([6.2, 5.4, 0.1], [0, 2.7, 1.4], 'cream', tank);
  covers.push(front);

  const waterPart = part(
    'water',
    'Stored water',
    'It falls quickly at first and more slowly as it goes, because the head driving it is falling with it.',
    [0, 0, 0],
    system,
  );
  const water = box([5.9, 1, 2.6], [0, 0, 0], 'blue', waterPart);

  const siphon = part(
    'siphon',
    'Bell siphon',
    'An upturned bell over a standpipe. Water rises inside it, crosses the crest, and falls away down the pipe.',
    [1.1, 0, 0],
    system,
  );
  const bell = part(
    'bell',
    'Siphon bell',
    'Its bottom lip is the whole of the timing. When the falling level reaches it, air enters and the siphon dies at once.',
    [0, 0, 0],
    siphon,
  );
  for (const x of [-0.62, 0.62]) box([0.14, 3.4, 1.5], [x, 2.0, 0], 'gold', bell);
  box([1.4, 0.16, 1.5], [0, 3.7, 0], 'gold', bell);
  const lip = part(
    'lip',
    'Air-break lip',
    'Drawn at its true height above the floor of the tank. The fall from the starting level down to this lip, times the plan area, is the flush.',
    [0, C.breakLevel / UNIT, 0],
    siphon,
  );
  for (const x of [-0.62, 0.62]) box([0.2, 0.1, 1.5], [x, 0, 0], 'red', lip);

  const outlet = part(
    'outlet',
    'Outlet standpipe',
    'The falling leg. How far the outlet sits below the water is the head, and the head is what sets the speed.',
    [0, 0, 0],
    siphon,
  );
  tube(
    [
      [0, 3.5, 0],
      [0, 0.2, 0],
      [0.9, -1.4, 0],
    ],
    0.34,
    'metal',
    outlet,
  );

  const lifter = part(
    'lifting-disk',
    'Priming disk',
    'One short stroke throws a slug of water over the crest and fills the leg. After that the disk has no further part to play.',
    [0, 1.5, 0],
    siphon,
  );
  const lifterMesh = cylinder(0.62, 0.14, [0, 0, 0], 'clay', lifter);

  const handlePart = part(
    'handle',
    'Handle and linkage',
    'The only thing the hand touches, and it only has to do one thing once.',
    [2.6, 4.6, 1.5],
    system,
  );
  const handle = rod([0, 0, 0], [-1.1, 0, 0], 0.12, 'gold', handlePart);
  rod([-1.1, 0, -1.5], [-1.5, -2.4, -1.5], 0.06, 'metal', handlePart);

  const inlet = part(
    'inlet',
    'Float-operated fill valve',
    'It does not snap shut. Over the last few centimetres it closes in proportion to how far the float still has to rise, which is why a refill fades out rather than banging.',
    [-2.2, 0, 0],
    system,
  );
  rod([0, 0.2, 0], [0, 4.8, 0], 0.18, 'metal', inlet);
  const floatPart = part(
    'float',
    'Float',
    'It reads the level and nothing else. Where it is set to shut off is where the tank fills to, and that setting decides every flush from now on.',
    [0, 0, 0.4],
    inlet,
  );
  const floatBall = sphere(0.55, [0, 0, 0], 'clay', floatPart);
  rod([0, 0, 0], [-0.7, 0.4, 0], 0.08, 'metal', floatPart);

  const streamPart = part(
    'stream',
    'Water over the crest',
    'Visible only while the siphon is primed. When the lip takes air, it vanishes at once rather than tailing off.',
    [0, 0, 0],
    system,
  );
  const stream = tube(
    [
      [0.6, 1.2, 0.8],
      [0.6, 3.6, 0.8],
      [1.1, 3.8, 0.8],
      [1.1, 0.2, 0.8],
      [2.0, -1.3, 0.8],
    ],
    0.14,
    'blue',
    streamPart,
  );

  const fillStream = part(
    'refill',
    'Refill stream',
    'Its thickness follows the valve opening, so it thins away as the float rises rather than stopping in one step.',
    [0, 0, 0],
    system,
  );
  const refillJet = cylinder(0.16, 1, [-2.2, 2.4, 0], 'blue', fillStream);

  control(
    'level',
    'Fill the cistern to',
    0.05,
    0.28,
    0.005,
    0.12,
    'm',
    'Where the float is set to shut the valve. It sets the flush volume and the head together, so raising it wastes water on every flush from now on.',
  );
  control(
    'bore',
    'Siphon bore',
    0.025,
    0.045,
    0.001,
    0.032,
    'm',
    'How wide the leg is. It changes how fast the charge goes, and not at all how much of it goes.',
  );
  control(
    'pressure',
    'Supply pressure',
    0.5,
    5,
    0.5,
    2,
    'bar',
    'What the float valve has behind it. It sets the refill time and nothing about the flush.',
  );
  control(
    'stroke',
    'Priming stroke',
    0,
    0.04,
    0.005,
    0.025,
    'm',
    'How far the handle lifts the disk. Anything over 20 mm primes the siphon; anything under it does not, and the handle does nothing at all.',
  );
  control(
    'perDay',
    'Flushes a day',
    1,
    12,
    1,
    5,
    '',
    'Used only to turn one flush into a year, which is the scale at which a float set too high is worth noticing.',
  );

  let stage = 'ready';
  let complete = false;
  let elapsed = 0;
  let level = 0.12;
  let discharged = 0;
  let refilled = 0;
  let peak = 0;
  let flushEnded = 0;
  let accumulator = 0;
  let lastClock = 0;
  let armed = false;

  const fmt = (n, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : '—');

  const result = finish(
    (values, phase) => {
      const primes = values.stroke >= C.primeStroke;
      const drawn = Math.max(0.02, level / UNIT);
      water.scale.y = drawn;
      water.position.y = 0.16 + (drawn * 1) / 2 - 0.5 + 0.5;
      water.position.y = 0.16 + drawn / 2;
      floatPart.position.y = Math.max(0.5, level / UNIT);
      lifterMesh.position.y = stage === 'priming' ? (values.stroke / UNIT) * (elapsed / 0.4) : 0;
      handle.parent.rotation.z = stage === 'priming' ? -0.5 * Math.min(1, elapsed / 0.4) : 0;

      const running = stage === 'siphoning';
      streamPart.visible = running;
      const flow = running ? siphonDischarge(level, values.bore) : 0;
      stream.scale.x = stream.scale.z = Math.max(0.4, Math.sqrt(flow / 0.0016));

      const filling = stage === 'refilling';
      const fill = filling ? fillRate(level, values.level, values.pressure) : 0;
      fillStream.visible = fill > 0;
      refillJet.scale.x = refillJet.scale.z = Math.max(0.2, Math.sqrt(fill / C.fillAtOneBar));
      refillJet.scale.y = Math.max(0.4, (level / UNIT) * 0.5);

      const perFlush = flushVolume(values.level);
      // What the refill will cost at this pressure, worked out at rest so the
      // pressure control says something before the run rather than only during
      // it. Wide open for all but the closing band, then tapering to nothing.
      // Two parts: the open stretch at a steady rate, and the closing band, where
      // the rate falls in proportion to what is left so the level approaches its
      // mark exponentially and the time runs as a logarithm.
      const wideOpen = fillRate(0, values.level, values.pressure);
      const band = Math.min(C.closingBand, Math.max(0, values.level - C.breakLevel));
      const openStretch = Math.max(0, perFlush / 1000 - band * C.tankArea);
      const refillEstimate =
        wideOpen > 0
          ? openStretch / wideOpen +
            ((band * C.tankArea) / wideOpen) * Math.log(band / C.settled)
          : null;
      const litresPerDay = perFlush * values.perDay;
      const head = C.outletDrop + level;

      const outcome =
        stage === 'ready'
          ? primes
            ? 'Ready · press Flush it'
            : `Ready · a ${fmt(values.stroke * 1000, 0)} mm stroke will not prime the siphon`
          : stage === 'priming'
            ? primes
              ? 'The disk throws water over the crest'
              : 'The disk lifts, the water falls back, and nothing happens'
            : stage === 'siphoning'
              ? `Siphoning · ${fmt(discharged, 2)} L gone, ${fmt(flow * 1000, 2)} L/s going`
              : stage === 'refilling'
                ? `Air broke the siphon at the lip · refilling, ${fmt(refilled, 2)} of ${fmt(perFlush, 2)} L back`
                : `Cycle complete · ${fmt(discharged, 2)} L flushed, back to level in ${fmt(elapsed - flushEnded, 1)} s`;

      return {
        state: {
          stage,
          complete,
          elapsed,
          level,
          head,
          flow,
          fill,
          discharged,
          refilled,
          peak,
          perFlush,
          litresPerDay,
          primes,
          flushEnded,
          blocked: false,
        },
        readings: [
          r('Your result', outcome),
          r('Water level', `${fmt(level * 1000, 1)} mm`, `The air-break lip is at ${fmt(C.breakLevel * 1000, 0)} mm, and the siphon dies the moment the level reaches it.`),
          r(
            'Head driving the siphon',
            `${fmt(head * 1000, 0)} mm`,
            'The surface above the outlet, which is the level plus the 250 mm the outlet sits below the floor of the tank.',
          ),
          r(
            'Discharge now',
            `${fmt(flow * 1000, 2)} L/s`,
            'Torricelli: the square root of twice gravity times the head, through the bore, at seven tenths of the ideal. It falls as the level does.',
          ),
          r('Peak discharge', `${fmt(peak * 1000, 2)} L/s`, 'Reached in the first instant, when the head is greatest.'),
          r('Discharged so far', `${fmt(discharged, 2)} L`),
          r(
            'This flush will use',
            `${fmt(perFlush, 2)} L`,
            'The fall from the set level down to the lip, times the plan area of the tank. The bore changes how fast it goes and not how much goes.',
          ),
          r(
            'Refill valve',
            fill > 0 ? `${fmt(fill * 1000, 3)} L/s` : stage === 'refilling' ? 'Shut' : 'Waiting',
            'Wide open until the last 30 mm, then closing in proportion to how far the float still has to rise.',
          ),
          r('Refilled', `${fmt(refilled, 2)} L`),
          r(
            'Refill will take',
            `${fmt(refillEstimate, 0)} s`,
            'The charge divided by what the float valve passes, allowing for its closing over the last 30 mm. Supply pressure changes this and nothing about the flush.',
          ),
          r(
            'Priming',
            primes ? `${fmt(values.stroke * 1000, 0)} mm stroke · enough` : `${fmt(values.stroke * 1000, 0)} mm stroke · not enough`,
            `The disk has to throw water over the crest, which takes at least ${fmt(C.primeStroke * 1000, 0)} mm. Below that the handle moves and nothing else does.`,
          ),
          r(
            'At this setting, in a year',
            `${fmt((litresPerDay * 365) / 1000, 1)} m³`,
            `${fmt(values.perDay, 0)} flushes a day of ${fmt(perFlush, 2)} L. Raising the float by ten millimetres adds about ${fmt((0.01 * C.tankArea * 1000 * values.perDay * 365) / 1000, 2)} m³ a year.`,
          ),
          r('Time', `${fmt(elapsed, 1)} s`),
          r(
            'Model limit',
            'Cistern only · no bowl, trap or swirl',
            'A 0.055 m² tank with its outlet 250 mm below the floor and the bell lip 12 mm above it. Friction inside the bell, the hydraulics of the priming stroke itself, and flapper valve cisterns are all left out.',
          ),
        ],
      };
    },
    {animated: true},
  );

  const render = result.update;
  result.update = next => {
    const before = {...result.getState().values};
    const readings = render(next);
    const after = result.getState().values;
    if (Object.keys(before).some(key => before[key] !== after[key])) {
      stage = 'ready';
      complete = false;
      elapsed = 0;
      level = after.level;
      discharged = 0;
      refilled = 0;
      peak = 0;
      flushEnded = 0;
      accumulator = 0;
      armed = false;
      return render();
    }
    return readings;
  };

  function tick(dt) {
    const values = result.getState().values;
    if (stage === 'ready') {
      stage = 'priming';
      elapsed = 0;
      level = values.level;
      discharged = 0;
      refilled = 0;
      peak = 0;
      flushEnded = 0;
      armed = values.stroke >= C.primeStroke;
    }
    elapsed += dt;
    if (stage === 'priming') {
      if (elapsed >= 0.4) {
        if (armed) {
          stage = 'siphoning';
        } else {
          // A stroke too short throws no water over the crest, so the cycle is
          // over before it starts.
          stage = 'done';
          complete = true;
        }
      }
      return render();
    }
    if (stage === 'siphoning') {
      const flow = siphonDischarge(level, values.bore);
      peak = Math.max(peak, flow);
      const fall = (flow * dt) / C.tankArea;
      level = Math.max(C.breakLevel, level - fall);
      discharged += flow * dt * 1000;
      if (level <= C.breakLevel + 1e-9) {
        // The lip takes air and the column parts. There is no tailing off.
        stage = 'refilling';
        flushEnded = elapsed;
      }
      return render();
    }
    if (stage === 'refilling') {
      const fill = fillRate(level, values.level, values.pressure);
      level = Math.min(values.level, level + (fill * dt) / C.tankArea);
      refilled += fill * dt * 1000;
      if (values.level - level < C.settled) {
        level = values.level;
        stage = 'done';
        complete = true;
      }
      return render();
    }
    return render();
  }

  function advance(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || complete) return render();
    accumulator += dt;
    while (accumulator >= 0.01 - 1e-9 && !complete) {
      accumulator -= 0.01;
      tick(0.01);
    }
    if (complete) accumulator = 0;
    return render();
  }

  result.reset = () => {
    stage = 'ready';
    complete = false;
    elapsed = 0;
    discharged = 0;
    refilled = 0;
    peak = 0;
    flushEnded = 0;
    accumulator = 0;
    lastClock = 0;
    armed = false;
    const readings = render(result.defaults);
    level = result.getState().values.level;
    return render();
  };
  result.advance = advance;
  result.animate = t => {
    const dt = Math.max(0, t - lastClock);
    lastClock = t;
    return advance(dt);
  };
  result.playback = {
    label: 'Flush it',
    stepLabel: 'Advance half a second',
    description:
      'Primes the siphon, lets the charge go at whatever rate the head allows, breaks the siphon at the lip, and refills to the set level.',
    advance,
    step: () => advance(0.5),
    complete: () => complete,
    blocked: () => false,
  };
  result.actions = [
    {
      label: 'Set the float low, for a short flush',
      run: () => result.update({level: 0.09}),
    },
    {
      label: 'Set the float high',
      run: () => result.update({level: 0.26}),
    },
  ];
  result.followParts = ['water', 'bell', 'lip', 'float'];
  result.resultPart = {
    id: 'lip',
    context: 'siphon',
    view: 'front',
    focusOnComplete: true,
    label: 'Inspect the air-break lip',
    available: () => complete,
  };
  return result;
}

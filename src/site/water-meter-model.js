import {houseModel, reading as r} from './house-model-kit.js';

// ---------------------------------------------------------------------------
// A domestic water meter, and the flows it cannot see.
//
// Scale: one scene unit is 30 mm. The measuring chamber is 60 mm across and
// drawn 2 units; the register dial is 45 mm and drawn 1.5.
//
// A meter is a turbine and a gearbox. Water drives an impeller, the impeller
// turns a train of gears, and the gears move a register. The turns are
// proportional to the volume that has gone past, and the constant of
// proportionality is the whole of the calibration.
//
// What makes a meter interesting is where that proportionality fails. Below a
// starting flow the impeller does not turn at all, because the torque the water
// makes cannot overcome the friction in the bearings and the train. Above it,
// and up to the minimum flow the meter is specified at, it turns but registers
// less than passes. Only above that is it accurate, and the accuracy it is held
// to is a band, not a number.
//
// That is the reason a slowly dripping tap can run for a year without the
// meter moving, and the reason the small star wheel exists: it has almost no
// friction of its own, so it turns when the register will not, and it is the
// only honest way to see whether anything at all is flowing.
//
// The standard is EN ISO 4064. A meter is described by its permanent flow Q3
// and a ratio R; from those, Q1 is Q3 divided by R, Q2 is 1.6 times Q1, and the
// error the meter is allowed is plus or minus 5 percent between Q1 and Q2 and
// plus or minus 2 percent above Q2. What it does below Q1 is not specified at
// all, and this model takes it smoothly down to registering nothing at the
// starting flow.
//
// What is not modeled: temperature, air in the line, wear, the difference
// between a single jet and a multi jet chamber, and the way a real error curve
// wanders inside its band rather than sitting on one edge of it.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

export const meterConstants = Object.freeze({
  /** Turns of the impeller for every litre that passes. */
  turnsPerLitre: 10,
  /** One full sweep of the red needle. */
  litresPerSweep: 1,
  /** The pressure a meter at its permanent flow is allowed to cost, in bar. */
  dropAtQ3: 0.63,
  /** Where the register runs out and rolls over, in cubic metres. */
  registerDigits: 5,
  duration: 3600,
});

/** The two meters on offer, by permanent flow in litres a minute and ratio. */
export const meterSizes = Object.freeze({
  0: {label: 'Q3 = 2.5 m³/h', permanent: 2500 / 60, ratio: 160},
  1: {label: 'Q3 = 4 m³/h', permanent: 4000 / 60, ratio: 100},
});

/**
 * What the meter does with a given flow, in litres a minute.
 *
 * Everything is derived from the two numbers that describe the meter, exactly
 * as the standard derives them.
 */
export function meterResponse(flowLitresPerMinute, size = 0) {
  const C = meterConstants;
  const spec = meterSizes[size] ?? meterSizes[0];
  const q3 = spec.permanent;
  const q1 = q3 / spec.ratio;
  const q2 = 1.6 * q1;
  // Below half the minimum flow, the impeller cannot start at all.
  const starting = q1 / 2;
  const flow = Math.max(0, flowLitresPerMinute);

  let error;
  let band;
  if (flow <= starting) {
    error = -1;
    band = 'below the starting flow';
  } else if (flow < q1) {
    // From registering nothing at the starting flow up to the edge of the band
    // at Q1, taken as a straight line in between.
    const along = (flow - starting) / (q1 - starting);
    error = -1 + along * 0.95;
    band = 'under-registering: above the starting flow but below Q1';
  } else if (flow < q2) {
    error = -0.05;
    band = 'between Q1 and Q2, allowed five percent';
  } else {
    error = -0.02;
    band = 'above Q2, allowed two percent';
  }

  const registered = flow * (1 + error);
  const unregistered = flow - registered;
  const turning = flow > starting;
  // The star wheel has almost no load on it, so it moves on anything at all.
  const starWheel = flow > 0;
  const impellerTurns = registered * C.turnsPerLitre;
  const drop = C.dropAtQ3 * (flow / q3) ** 2;

  return {
    q1,
    q2,
    q3,
    starting,
    ratio: spec.ratio,
    label: spec.label,
    flow,
    error,
    band,
    registered,
    unregistered,
    turning,
    starWheel,
    impellerTurnsPerMinute: impellerTurns,
    drop,
  };
}

export function createWaterMeterModel() {
  const m = houseModel('Water meter');
  const {part, box, cylinder, disk, sphere, ring, rod, tube, gear, control, finish, covers} = m;
  const C = meterConstants;

  const system = part(
    'system',
    'Water meter and its register',
    'A turbine in the line, a train of gears, and a register that counts what the turbine turned. Its interesting behaviour is all at the bottom of its range.',
  );

  const pipe = part(
    'pipe',
    'Supply pipe',
    'The meter is cut into the incoming main, so everything the house uses goes through it.',
    [0, 0, 0],
    system,
  );
  tube(
    [
      [-3.4, 0.7, 0],
      [-1.3, 0.7, 0],
      [1.3, 0.7, 0],
      [3.4, 0.7, 0],
    ],
    0.26,
    'metal',
    pipe,
  );

  const chamber = part(
    'chamber',
    'Measuring chamber',
    'Jets of water are directed at the impeller blades around the edge. Every litre that passes turns it the same number of times.',
    [0, 0.75, 0],
    system,
  );
  const shell = cylinder(1.05, 1.1, [0, 0, 0], 'leaf', chamber);
  covers.push(shell);
  for (let i = 0; i < 4; i += 1) {
    const a = (i * TAU) / 4;
    rod([0.75 * Math.cos(a), -0.3, 0.75 * Math.sin(a)], [0.98 * Math.cos(a), -0.3, 0.98 * Math.sin(a)], 0.06, 'blue', chamber);
  }

  const impeller = part(
    'impeller',
    'Impeller',
    'The only moving part the water touches. It has to overcome the friction of its own bearings and of the whole gear train, which is why the smallest flows never start it.',
    [0, 0.75, 0],
    system,
  );
  cylinder(0.2, 0.5, [0, 0, 0], 'gold', impeller);
  for (let i = 0; i < 8; i += 1) {
    const a = (i * TAU) / 8;
    const blade = box([0.5, 0.4, 0.06], [0.45 * Math.cos(a), 0, 0.45 * Math.sin(a)], 'clay', impeller);
    blade.rotation.y = -a;
  }

  const train = part(
    'train',
    'Reduction train',
    'Ten turns of the impeller to a litre would spin a dial too fast to read, so a gear train trades that speed for the slow, countable movement of the register.',
    [0, 0, 0],
    system,
  );
  const firstWheel = gear(0.42, 24, [0, 1.95, 0.2], 'gold', train);
  const secondWheel = gear(0.22, 12, [0.62, 1.95, 0.2], 'clay', train);

  const register = part(
    'register',
    'Cumulative register',
    'Cubic metres, and it only ever goes up. A bill is the difference between two readings of it, so an error at one reading is an error in the bill.',
    [0, 2.9, 0],
    system,
  );
  box([2.3, 0.6, 0.5], [0, 0, 0], 'cream', register);
  const digits = [];
  for (let i = 0; i < C.registerDigits; i += 1) {
    const wheelPart = part(
      `digit-${i}`,
      `Register digit ${i + 1}`,
      i < 3 ? 'Whole cubic metres. These are the figures a bill is read from.' : 'Tenths and hundredths of a cubic metre, which is where a small leak shows first.',
      [-0.78 + i * 0.39, 0, 0.28],
      register,
    );
    const wheel = disk(0.17, 0.14, [0, 0, 0], i < 3 ? 'ink' : 'red', wheelPart);
    digits.push(wheel);
  }

  const needlePart = part(
    'needle',
    'Sweep needle',
    'One turn to a litre. It is the fastest thing on the face and the easiest way to time a flow by eye.',
    [0, 1.35, 0.62],
    system,
  );
  disk(0.78, 0.1, [0, 0, 0], 'cream', needlePart);
  for (let i = 0; i < 10; i += 1) {
    const a = (i * TAU) / 10;
    rod([0.6 * Math.cos(a), 0.6 * Math.sin(a), 0.06], [0.72 * Math.cos(a), 0.72 * Math.sin(a), 0.06], 0.025, 'ink', needlePart);
  }
  const needle = rod([0, 0, 0.08], [0, 0.62, 0.08], 0.035, 'red', needlePart);

  const starPart = part(
    'star-wheel',
    'Leak detector star wheel',
    'Almost frictionless, geared to almost nothing, and therefore the only part that moves on a flow too small for the register. If this is turning with every tap shut, something is leaking.',
    [1.3, 1.35, 0.62],
    system,
  );
  const star = disk(0.3, 0.08, [0, 0, 0], 'gold', starPart);
  for (let i = 0; i < 6; i += 1) {
    const a = (i * TAU) / 6;
    box([0.16, 0.16, 0.1], [0.3 * Math.cos(a), 0.3 * Math.sin(a), 0.05], 'red', starPart).rotation.z = a;
  }

  control(
    'flow',
    'Flow through the meter',
    0,
    30,
    0.05,
    6,
    'L/min',
    'Everything the house is drawing at once. A shower is around 9, a running tap 12, a dripping tap 0.005.',
  );
  control(
    'hours',
    'How long it runs at this flow',
    0,
    24,
    0.25,
    0.5,
    'h',
    'Volume is flow times time, and a small flow left alone for long enough still adds up.',
  );
  control(
    'size',
    'Meter',
    0,
    1,
    1,
    0,
    '',
    'The permanent flow the meter is sized for. Everything else about it follows: Q1 is that divided by the ratio, and Q2 is 1.6 times Q1.',
    [
      {value: 0, label: 'Q3 = 2.5 m³/h · R160'},
      {value: 1, label: 'Q3 = 4 m³/h · R100'},
    ],
  );
  control(
    'leak',
    'A leak somewhere on the supply',
    0,
    0.5,
    0.005,
    0,
    'L/min',
    'Added to whatever the house is drawing. A tap dripping once a second is about 0.005; a leaking loo valve is a hundred times that.',
  );
  control(
    'tariff',
    'Price of water',
    0.5,
    6,
    0.1,
    2.4,
    '/m³',
    'What the registered volume, not the delivered volume, is charged at.',
  );

  let stage = 'ready';
  let complete = false;
  let elapsed = 0;
  let registeredVolume = 0;
  let deliveredVolume = 0;
  let accumulator = 0;
  let lastClock = 0;

  const fmt = (n, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : '—');

  const result = finish(
    (values, phase) => {
      const total = values.flow + values.leak;
      const response = meterResponse(total, values.size);

      // Turns are the registered volume, because that is what the train sees.
      const turns = registeredVolume * C.turnsPerLitre;
      impeller.rotation.y = (turns + (response.turning ? phase * response.impellerTurnsPerMinute * 0.02 : 0)) * TAU;
      firstWheel.rotation.z = -turns * TAU * 0.05;
      secondWheel.rotation.z = turns * TAU * 0.1;
      needle.parent.rotation.z = -(registeredVolume / C.litresPerSweep) * TAU;
      star.parent.rotation.z = response.starWheel ? -(deliveredVolume * 6 + phase * 2) : 0;

      for (const [i, wheel] of digits.entries()) {
        const place = 10 ** (2 - i);
        wheel.rotation.x = ((registeredVolume / 1000 / place) % 10) * (TAU / 10);
      }

      const cubicMetres = registeredVolume / 1000;
      const deliveredCubic = deliveredVolume / 1000;
      const cost = cubicMetres * values.tariff;
      const missed = deliveredCubic - cubicMetres;

      const outcome =
        stage === 'ready'
          ? total <= 0
            ? 'Ready · nothing is flowing'
            : response.turning
              ? `Ready · ${fmt(total, 3)} L/min is ${response.band}`
              : `Ready · ${fmt(total, 3)} L/min is below the starting flow; the register will not move at all`
          : stage === 'running'
            ? `Running · ${fmt(cubicMetres, 4)} m³ registered of ${fmt(deliveredCubic, 4)} delivered`
            : response.turning
              ? `Registered ${fmt(cubicMetres, 4)} m³ of the ${fmt(deliveredCubic, 4)} m³ that passed`
              : `${fmt(deliveredCubic, 4)} m³ passed and the register never moved`;

      return {
        state: {
          ...response,
          stage,
          complete,
          elapsed,
          registeredVolume,
          deliveredVolume,
          cubicMetres,
          deliveredCubic,
          cost,
          missed,
          blocked: false,
        },
        readings: [
          r('Your result', outcome),
          r(
            'Flow through the meter',
            `${fmt(total, 3)} L/min`,
            'What the house is drawing, plus whatever is leaking.',
          ),
          r(
            'Where that sits on the meter',
            response.band,
            `This meter is ${response.label} with a ratio of ${response.ratio}, so Q1 is ${fmt(response.q1, 3)} L/min, Q2 is ${fmt(response.q2, 3)}, and it starts turning at about ${fmt(response.starting, 3)}.`,
          ),
          r(
            'Registration error',
            `${fmt(response.error * 100, 1)} %`,
            'Negative all the way: a meter that under-reads is the one the water company has to accept, and the standard bounds how far.',
          ),
          r('Impeller', response.turning ? `${fmt(response.impellerTurnsPerMinute, 1)} turns a minute` : 'Not turning'),
          r(
            'Star wheel',
            response.starWheel ? 'Turning' : 'Still',
            'It moves on any flow at all. With every tap in the house shut, a turning star wheel means a leak whatever the register says.',
          ),
          r('Registered', `${fmt(cubicMetres, 4)} m³`, 'The figure a bill is read from.'),
          r('Actually delivered', `${fmt(deliveredCubic, 4)} m³`),
          r(
            'Never registered',
            `${fmt(missed * 1000, 1)} L`,
            'Water that went through the meter without being counted, because it went through too slowly to be seen.',
          ),
          r('Cost of what was registered', `${fmt(cost, 2)}`, `At ${fmt(values.tariff, 2)} per cubic metre.`),
          r(
            'Pressure the meter costs',
            `${fmt(response.drop, 3)} bar`,
            `It rises as the square of the flow, and reaches ${C.dropAtQ3} bar at the permanent flow, which is the most a meter is allowed to take.`,
          ),
          r('Time run', `${fmt(elapsed / 3600, 2)} h`),
          r(
            'Model limit',
            'One error curve per band · no temperature, air or wear',
            'The bands and their limits are those of EN ISO 4064; the error inside each band is taken at the bottom edge rather than wandering, and below Q1 it is taken as a straight line down to nothing at the starting flow.',
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
      registeredVolume = 0;
      deliveredVolume = 0;
      accumulator = 0;
      return render();
    }
    return readings;
  };

  function tick(dt) {
    const values = result.getState().values;
    if (stage === 'ready') {
      stage = 'running';
      elapsed = 0;
      registeredVolume = 0;
      deliveredVolume = 0;
    }
    const response = meterResponse(values.flow + values.leak, values.size);
    // The run is watched at a thousand times life, so a day of leaking is not a
    // day of waiting. The clock and every volume are the real ones.
    const seconds = dt * 1000;
    const capped = Math.min(seconds, values.hours * 3600 - elapsed);
    elapsed += capped;
    deliveredVolume += (response.flow * capped) / 60;
    registeredVolume += (response.registered * capped) / 60;
    if (elapsed >= values.hours * 3600 - 1e-9) {
      stage = 'done';
      complete = true;
    }
    return render();
  }

  function advance(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || complete) return render();
    accumulator += dt;
    while (accumulator >= 0.02 - 1e-9 && !complete) {
      accumulator -= 0.02;
      tick(0.02);
    }
    if (complete) accumulator = 0;
    return render();
  }

  result.reset = () => {
    stage = 'ready';
    complete = false;
    elapsed = 0;
    registeredVolume = 0;
    deliveredVolume = 0;
    accumulator = 0;
    lastClock = 0;
    return render(result.defaults);
  };
  result.advance = advance;
  result.animate = t => {
    const dt = Math.max(0, t - lastClock);
    lastClock = t;
    return advance(dt);
  };
  result.playback = {
    label: 'Run the water',
    stepLabel: 'Advance a quarter hour',
    description:
      'Runs the chosen flow for the chosen time and fills in the register, the delivered volume and the difference between them.',
    advance,
    step: () => advance(0.9),
    complete: () => complete,
    blocked: () => false,
  };
  result.actions = [
    {
      label: 'Shut every tap in the house',
      run: () => result.update({flow: 0}),
    },
    {
      label: 'Add a dripping tap',
      run: () => result.update({leak: 0.005}),
    },
  ];
  result.followParts = ['impeller', 'register', 'star-wheel'];
  result.resultPart = {
    id: 'register',
    context: 'system',
    view: 'front',
    focusOnComplete: true,
    label: 'Read the register',
    available: () => complete,
  };
  return result;
}

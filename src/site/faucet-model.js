import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';

// ---------------------------------------------------------------------------
// A pillar tap, from the thread to the bang in the pipe.
//
// Scale: one scene unit is 40 mm. The seat bore is 12 mm across, so it is drawn
// 0.3 units; the handle is 90 mm across and drawn 2.25. Every length in the
// drawing is a real length divided by 40 mm.
//
// Four separate pieces of physics meet in one small machine.
//
// The thread. A turn of the handle lifts the washer by exactly the pitch of the
// spindle thread, 1.5 mm, so the opening is set by turns and by nothing else.
//
// The opening. What the water sees is not the bore of the seat but the curtain
// between the washer and the seat: a cylinder of diameter 12 mm and height
// equal to the lift. That curtain is smaller than the bore until the washer is
// a quarter of the bore diameter up, which is why the first turn of a tap does
// nearly all of the work and the last one does almost none.
//
// The flow. The tap is an orifice in series with the whole run of pipe behind
// it, and both resist as the square of the flow, so the two add and the flow
// goes as the square root of the pressure. That square root is why doubling the
// pressure does not double the flow.
//
// The bang. Stopping moving water is stopping a moving mass. Joukowsky's
// relation gives the pressure it takes: the density times the speed of sound in
// the pipe times the change in speed. Close a tap in a hundredth of a second on
// water moving two metres a second and the surge is tens of bar, far beyond the
// supply pressure. Close it slowly and the wave has time to run to the far end
// of the pipe and back, which relieves it.
//
// What is not modeled: temperature, dissolved air, the detail of the aerator's
// mixing, cavitation at the seat, the flexing of the pipe, and any protection
// device fitted to absorb the surge.
// ---------------------------------------------------------------------------

/** Metres to a scene unit. */
const UNIT = 0.04;
const TAU = Math.PI * 2;

export const faucetConstants = Object.freeze({
  /** The spindle thread lifts the washer this far for every turn of the handle. */
  pitch: 0.0015,
  turnsToStop: 4,
  /** Seat bore, which is also the bore of the spout. */
  seatDiameter: 0.012,
  /** A sharp-edged orifice discharges about this fraction of the ideal. */
  discharge: 0.62,
  /** Everything behind the tap, as a loss coefficient on the 15 mm pipe. */
  pipeLoss: 200,
  pipeDiameter: 0.015,
  /** Water. */
  density: 1000,
  /** Pressure waves travel this fast in a water filled copper pipe. */
  waveSpeed: 1200,
  /** How far it is back to the nearest thing that can absorb a surge. */
  pipeRun: 20,
  /** The bucket the demonstration fills. */
  bucket: 10,
  /** A drip is this many millilitres. */
  dripVolume: 0.05,
  duration: 90,
});

/**
 * What the washer lets past when it is supposed to be shut, in square
 * millimetres. These are small numbers on purpose: a tap that drips once a
 * second is losing about three millilitres a minute, and at mains pressure that
 * takes an opening of a few thousandths of a square millimetre.
 */
export const washerLeak = Object.freeze({0: 0, 1: 0.0007, 2: 0.007});
/** An aerator adds its own resistance; taking it off leaves the tap barer and faster. */
export const aeratorLoss = Object.freeze({0: 0, 1: 60});

const area = diameter => (Math.PI * diameter * diameter) / 4;

/**
 * The whole tap at one handle position and one supply pressure.
 *
 * Everything here is arithmetic on the constants above; nothing is fitted to
 * make a number come out nicely.
 */
export function faucetFlow(values) {
  const C = faucetConstants;
  const lift = Math.max(0, values.turns) * C.pitch;
  const bore = area(C.seatDiameter);
  // The water squeezes through the cylindrical curtain between washer and seat,
  // until that curtain is wider than the bore it is feeding.
  const curtain = Math.PI * C.seatDiameter * lift;
  const leak = (washerLeak[values.washer] ?? 0) * 1e-6;
  const openArea = lift > 0 ? Math.min(bore, curtain) : leak;
  const limitedBy = lift <= 0 ? 'a washer that no longer seals' : curtain < bore ? 'the gap under the washer' : 'the bore of the seat';

  const supply = values.pressure * 1e5;
  const pipeArea = area(C.pipeDiameter);
  const extra = aeratorLoss[values.aerator] ?? 0;
  // Two resistances in series, each going as the square of the flow, so they add
  // as coefficients and the flow comes out as a square root.
  const seatCoefficient =
    openArea > 0 ? 1 / (C.discharge * C.discharge * openArea * openArea) : Infinity;
  const pipeCoefficient = (C.pipeLoss + extra) / (pipeArea * pipeArea);
  const total = seatCoefficient + pipeCoefficient;
  const flow =
    openArea > 0 && supply > 0 ? Math.sqrt(((2 * supply) / C.density) / total) : 0;

  // How the supply pressure is spent between the tap and everything behind it.
  const seatDrop = openArea > 0 ? ((C.density / 2) * flow * flow * seatCoefficient) / 1e5 : 0;
  const pipeDrop = ((C.density / 2) * flow * flow * pipeCoefficient) / 1e5;

  const spoutSpeed = flow / bore;
  const litresPerMinute = flow * 60000;
  // Null rather than an infinity: nothing is filling, and a state carrying a
  // non-finite number is the shape of a bug rather than of a shut tap.
  const fillTime = flow > 0 ? C.bucket / (flow * 1000) : null;

  // Joukowsky, relieved by however much longer than one pipe period the closing
  // takes. The wave needs to reach the far end and come back before the tap is
  // shut for the surge to be less than the full value.
  const pipePeriod = (2 * C.pipeRun) / C.waveSpeed;
  const closing = Math.max(1e-4, values.closing);
  const fullSurge = (C.density * C.waveSpeed * spoutSpeed) / 1e5;
  const surge = fullSurge * Math.min(1, pipePeriod / closing);

  return {
    lift,
    bore,
    curtain,
    openArea,
    limitedBy,
    leak,
    flow,
    litresPerMinute,
    spoutSpeed,
    fillTime,
    seatDrop,
    pipeDrop,
    surge,
    fullSurge,
    pipePeriod,
    sealed: lift <= 0 && leak <= 0,
    dripping: lift <= 0 && leak > 0,
  };
}

export function createFaucetModel() {
  const m = houseModel('Faucet');
  const {part, box, cylinder, disk, sphere, ring, rod, tube, control, finish, covers} = m;
  const C = faucetConstants;
  const seatRadius = C.seatDiameter / 2 / UNIT;

  const system = part(
    'system',
    'Pillar tap and the pipe behind it',
    'A screw lifts a washer off a seat. What comes out is decided by the gap that opens, by the pressure behind it, and by every metre of pipe on the way.',
  );

  const basin = part(
    'basin',
    'Basin and standpipe',
    'The tap is bolted through the basin; the supply arrives from below at mains pressure.',
    [0, 0, 0],
    system,
  );
  box([5.2, 0.3, 3], [0.9, -0.15, 0], 'cream', basin);
  cylinder(0.55, 0.5, [0, 0.25, 0], 'metal', basin);

  const bodyPart = part(
    'body',
    'Tap body and waterway',
    'Cast in one piece. The supply comes up the middle, turns at the seat, and leaves along the spout.',
    [0, 0, 0],
    system,
  );
  const shell = tube(
    [
      [0, 0.2, 0],
      [0, 2.0, 0],
      [0.9, 2.3, 0],
      [1.9, 2.0, 0],
      [2.1, 1.3, 0],
    ],
    0.42,
    'metal',
    bodyPart,
  );
  covers.push(shell);
  const waterway = part(
    'waterway',
    'Waterway through the tap',
    'Look inside to follow it: up the inlet, through the seat, along the spout and down.',
    [0, 0, 0],
    bodyPart,
  );
  tube(
    [
      [0, 0.2, 0],
      [0, 1.95, 0],
      [0.9, 2.22, 0],
      [1.85, 1.95, 0],
      [2.05, 1.35, 0],
    ],
    0.28,
    'blue',
    waterway,
  );

  const seat = part(
    'seat',
    'Valve seat',
    'A flat ring of 12 mm bore. It is the thing the washer closes on, and the bore the water can never beat however far the handle is turned.',
    [0, 1.9, 0],
    system,
  );
  const seatRing = ring(seatRadius, 0.07, [0, 0, 0], 'gold', seat);
  seatRing.rotation.x = Math.PI / 2;
  disk(seatRadius + 0.24, 0.12, [0, -0.08, 0], 'gold', seat).rotation.x = Math.PI / 2;

  const spindlePart = part(
    'spindle',
    'Threaded spindle',
    'A 1.5 mm pitch thread. One full turn of the handle raises the washer 1.5 mm, no matter how hard or how gently it is turned.',
    [0, 0, 0],
    system,
  );
  const spindle = new THREE.Group();
  spindlePart.add(spindle);
  rod([0, 1.95, 0], [0, 4.2, 0], 0.16, 'gold', spindle);
  for (let i = 0; i < 11; i += 1) {
    const thread = ring(0.2, 0.035, [0, 2.6 + i * 0.13, 0], 'metal', spindle);
    thread.rotation.x = Math.PI / 2;
  }
  const washerPart = part(
    'washer',
    'Washer',
    'A disc of rubber on the end of the spindle. New it seals; worn it weeps; perished it runs whatever the handle is doing.',
    [0, 0, 0],
    spindle,
  );
  const washer = cylinder(seatRadius + 0.12, 0.16, [0, 1.98, 0], 'ink', washerPart);

  const handlePart = part(
    'handle',
    'Handle',
    'The only thing the hand touches. Its turns are the whole of the setting; how hard it is gripped changes nothing.',
    [0, 0, 0],
    spindle,
  );
  disk(1.1, 0.2, [0, 4.3, 0], 'clay', handlePart).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i += 1) {
    const a = (i * TAU) / 4;
    box([0.9, 0.24, 0.3], [Math.cos(a) * 0.7, 4.3, Math.sin(a) * 0.7], 'clay', handlePart).rotation.y = -a;
  }

  const aeratorPart = part(
    'aerator',
    'Aerator',
    'A gauze and a chamber at the spout mouth. It mixes air into the stream so the same flow feels fuller, and it is one more resistance in the line.',
    [2.1, 1.25, 0],
    system,
  );
  const aeratorMesh = cylinder(0.34, 0.22, [0, 0, 0], 'gold', aeratorPart);
  for (let i = 0; i < 3; i += 1) ring(0.26 - i * 0.05, 0.02, [0, -0.05 - i * 0.04, 0], 'metal', aeratorPart).rotation.x = Math.PI / 2;

  const streamPart = part(
    'stream',
    'The stream',
    'Its thickness follows the flow and its length follows the speed, so a wide slow stream and a thin fast one look as different here as they do at a sink.',
    [0, 0, 0],
    system,
  );
  const jet = cylinder(0.2, 1, [2.1, 0.6, 0], 'blue', streamPart);
  const dripPart = part(
    'drip',
    'The drip',
    'A washer that no longer seals lets a measured trickle past with the handle hard shut.',
    [0, 0, 0],
    system,
  );
  const drip = sphere(0.13, [2.1, 0.8, 0], 'blue', dripPart);

  const bucketPart = part(
    'bucket',
    'Ten litre bucket',
    'The demonstration fills it. Filling time is the honest way to feel a flow rate: litres a minute is an abstraction, a bucket is not.',
    [2.1, 0, 0],
    system,
  );
  cylinder(1.05, 1.5, [0, 0.45, 0], 'leaf', bucketPart);
  const water = cylinder(0.95, 1, [0, 0.2, 0], 'blue', bucketPart);

  const surgePart = part(
    'surge',
    'Pressure wave in the supply',
    'When the tap shuts, the column of moving water behind it has to be stopped. The shorter the stop, the larger the pressure it takes.',
    [0, 0, 0],
    system,
  );
  const surgeGlow = ring(0.62, 0.1, [0, 1.0, 0], 'red', surgePart);
  surgeGlow.rotation.x = Math.PI / 2;

  control(
    'turns',
    'Turns of the handle',
    0,
    4,
    0.25,
    0,
    'turns',
    'Each turn raises the washer 1.5 mm. Shut is shut; after about two thirds of a turn the seat bore is the limit and further turning does almost nothing.',
  );
  control(
    'pressure',
    'Supply pressure',
    0.5,
    6,
    0.5,
    2,
    'bar',
    'What the mains delivers at the tap with nothing flowing. Flow follows its square root, not the pressure itself.',
  );
  control(
    'washer',
    'Washer condition',
    0,
    2,
    1,
    0,
    '',
    'What the tap does with the handle hard shut.',
    [
      {value: 0, label: 'New · seals'},
      {value: 1, label: 'Worn · weeps'},
      {value: 2, label: 'Perished · runs'},
    ],
  );
  control(
    'aerator',
    'Aerator',
    0,
    1,
    1,
    1,
    '',
    'Fitted, it mixes air in and adds resistance. Removed, the tap is barer, faster and noisier.',
    [
      {value: 1, label: 'Fitted'},
      {value: 0, label: 'Removed'},
    ],
  );
  control(
    'closing',
    'Time taken to close it',
    0.05,
    2,
    0.05,
    1,
    's',
    'How quickly the handle is shut at the end of the run. The pressure wave needs a thirtieth of a second to reach the far end of the pipe and back; a stop quicker than that gets the full surge.',
  );

  let stage = 'ready';
  let complete = false;
  let elapsed = 0;
  let filled = 0;
  let closingFor = 0;
  let peakSurge = 0;
  let accumulator = 0;
  let lastClock = 0;

  const fmt = (n, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : '—');

  const result = finish(
    values => {
      const open = stage === 'closing' ? Math.max(0, 1 - closingFor / Math.max(1e-4, values.closing)) : stage === 'ready' || stage === 'filling' ? 1 : 0;
      const effective = {...values, turns: values.turns * open};
      const flow = faucetFlow(effective);
      const shut = faucetFlow({...values, turns: 0});

      spindle.position.y = (flow.lift / UNIT) * 6;
      spindle.rotation.y = values.turns * open * TAU;
      washer.position.y = 1.98;

      aeratorPart.visible = values.aerator === 1;

      const running = flow.flow > 0 && stage !== 'ready';
      streamPart.visible = running;
      jet.scale.x = jet.scale.z = Math.max(0.25, Math.sqrt(flow.litresPerMinute / 14));
      jet.scale.y = Math.max(0.4, Math.min(2.2, flow.spoutSpeed / 1.6));
      jet.position.y = 1.25 - jet.scale.y / 2;

      dripPart.visible = !running && shut.dripping;
      drip.position.y = 0.9 - ((elapsed % 1) * 0.5);

      const level = Math.min(1, filled / C.bucket);
      water.scale.y = Math.max(0.001, level);
      water.position.y = 0.45 - 0.75 + (1.5 * level) / 2;

      surgePart.visible = peakSurge > 0.2;
      surgeGlow.scale.setScalar(Math.max(0.4, Math.min(2.6, peakSurge / 4)));

      // Cubic metres a second to millilitres a minute, then counted out in drips.
      const millilitresPerMinute = shut.flow * 60 * 1e6;
      const dripsPerMinute = millilitresPerMinute / C.dripVolume;

      const outcome =
        stage === 'ready'
          ? flow.lift > 0
            ? 'Ready · the handle is open; press Fill the bucket'
            : shut.dripping
              ? 'Ready · shut, and still losing water past the washer'
              : 'Ready · shut and sealed'
          : stage === 'filling'
            ? flow.flow > 0
              ? `Filling · ${fmt(filled, 2)} of ${C.bucket} litres`
              : 'Nothing is coming out · open the handle'
            : stage === 'closing'
              ? 'Closing the handle'
              : peakSurge > 4
                ? `Bucket full · closing it that fast put ${fmt(peakSurge, 1)} bar into the pipe`
                : `Bucket full in ${fmt(elapsed, 1)} s · surge on closing ${fmt(peakSurge, 2)} bar`;

      return {
        state: {
          ...flow,
          stage,
          complete,
          elapsed,
          filled,
          peakSurge,
          dripsPerMinute,
          shutFlow: shut.flow,
          blocked: false,
        },
        readings: [
          r('Your result', outcome),
          r(
            'Washer lift',
            `${fmt(flow.lift * 1000, 2)} mm`,
            'Turns times the 1.5 mm thread pitch. The thread is the only thing that sets it.',
          ),
          r(
            'Opening the water sees',
            `${fmt(flow.openArea * 1e6, 1)} mm²`,
            `Set by ${flow.limitedBy}. The gap under the washer is a curtain of 12 mm diameter and the lift in height; it only stops mattering once it is wider than the 113 mm² bore.`,
          ),
          r(
            'Flow',
            `${fmt(flow.litresPerMinute, 2)} L/min`,
            'The seat and the pipe behind it both resist as the square of the flow, so the flow goes as the square root of the pressure.',
          ),
          r(
            'Speed in the spout',
            `${fmt(flow.spoutSpeed, 2)} m/s`,
            'Flow divided by the 113 mm² bore. This is the speed the pipe has to lose when the tap is shut.',
          ),
          r(
            'Where the pressure goes',
            `${fmt(flow.seatDrop, 2)} bar at the seat · ${fmt(flow.pipeDrop, 2)} bar in the pipe`,
            'Wide open, most of the supply is spent getting through the pipework rather than through the tap.',
          ),
          r(
            'Time to fill ten litres',
            `${fmt(flow.fillTime, 1)} s`,
            'The honest version of a flow rate.',
          ),
          r('Water in the bucket', `${fmt(filled, 2)} L`),
          r(
            'Losing when shut',
            shut.dripping
              ? `${fmt(millilitresPerMinute, 1)} mL/min · about ${fmt(dripsPerMinute, 0)} drips a minute`
              : 'Nothing',
            shut.dripping
              ? 'A perished washer leaves an opening the supply pressure pushes water through all day.'
              : 'A new washer seals against the seat and the opening is zero.',
          ),
          r(
            'Surge on closing',
            `${fmt(peakSurge, 2)} bar`,
            `Density times the speed of sound in the pipe times the speed lost, relieved by however much longer than ${fmt(flow.pipePeriod * 1000, 0)} ms the closing takes. Stopped instantly it would be ${fmt(flow.fullSurge, 1)} bar.`,
          ),
          r('Time running', `${fmt(elapsed, 1)} s`),
          r(
            'Model limit',
            'Steady incompressible flow · one fixed pipe run · no temperature',
            '15 mm pipe with a loss coefficient of 200 standing for 20 m of run, bends and a stop valve. Cavitation at the seat, pipe flexing, dissolved air and any surge arrestor are all left out.',
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
      filled = 0;
      closingFor = 0;
      peakSurge = 0;
      accumulator = 0;
      return render();
    }
    return readings;
  };

  function tick(dt) {
    const values = result.getState().values;
    if (stage === 'ready') {
      stage = 'filling';
      filled = 0;
      elapsed = 0;
      closingFor = 0;
      peakSurge = 0;
    }
    elapsed += dt;
    if (stage === 'filling') {
      const flow = faucetFlow(values);
      filled = Math.min(C.bucket, filled + flow.flow * 1000 * dt);
      if (flow.flow <= 0 && elapsed > 3) {
        stage = 'done';
        complete = true;
      } else if (filled >= C.bucket) {
        stage = 'closing';
        closingFor = 0;
        // The surge belongs to the speed the water had when the closing began.
        peakSurge = flow.surge;
      }
      return render();
    }
    if (stage === 'closing') {
      closingFor += dt;
      if (closingFor >= values.closing) {
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

  result.reset = (initialState = {}) => {
    stage = 'ready';
    complete = false;
    elapsed = 0;
    filled = Number.isFinite(initialState.filled) ? initialState.filled : 0;
    closingFor = 0;
    peakSurge = 0;
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
    label: 'Fill the bucket',
    stepLabel: 'Advance one second',
    description:
      'Runs the tap at the chosen setting until ten litres are in the bucket, then closes the handle over the time you chose and reports the surge that stopping the water costs.',
    advance,
    step: () => advance(1),
    complete: () => complete,
    blocked: () => false,
  };
  result.actions = [
    {
      label: 'Open the handle one turn',
      run: () => {
        const values = result.getState().values;
        result.update({turns: Math.min(C.turnsToStop, values.turns + 1)});
      },
    },
    {
      label: 'Shut it hard',
      run: () => result.update({turns: 0}),
    },
  ];
  result.followParts = ['seat', 'washer', 'stream'];
  result.resultPart = {
    id: 'bucket',
    context: 'system',
    view: 'front',
    focusOnComplete: true,
    label: 'Inspect the bucket',
    available: () => complete,
  };
  return result;
}

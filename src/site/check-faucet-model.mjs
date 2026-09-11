// The tap, held to the laws it claims rather than to its own arithmetic.
//
// Every expected value below is written out from the constants by hand: the
// lift from the pitch, the curtain from its circumference and height, the flow
// from the two resistances in series, the surge from Joukowsky. Nothing is read
// back out of the model and compared with itself.
import assert from 'node:assert/strict';
import {createFaucetModel, faucetFlow, faucetConstants as C, washerLeak, aeratorLoss} from './faucet-model.js';

let checks = 0;
const close = (actual, expected, tolerance, message) => {
  const room = Math.max(tolerance, Math.abs(expected) * tolerance);
  assert.ok(Math.abs(actual - expected) <= room, `${message}: ${actual} vs ${expected}`);
  checks += 1;
};
const ok = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};

const bore = (Math.PI * C.seatDiameter * C.seatDiameter) / 4;
const pipeArea = (Math.PI * C.pipeDiameter * C.pipeDiameter) / 4;
const base = {turns: 2, pressure: 2, washer: 0, aerator: 1, closing: 1};

// --- the thread ------------------------------------------------------------
for (const turns of [0, 0.25, 0.5, 1, 2, 3, 4]) {
  const state = faucetFlow({...base, turns});
  close(state.lift, turns * C.pitch, 1e-12, 'the thread lifts the washer by its pitch');
}

// --- the opening -----------------------------------------------------------
for (const turns of [0.25, 0.5, 1, 1.5, 2, 3, 4]) {
  const state = faucetFlow({...base, turns});
  const curtain = Math.PI * C.seatDiameter * turns * C.pitch;
  close(state.openArea, Math.min(bore, curtain), 1e-15, 'the water sees the smaller of curtain and bore');
  ok(state.openArea <= bore + 1e-15, 'and never more than the bore');
}
// The two are equal when the lift is a quarter of the bore diameter, which is
// where the seat takes over as the limit. Either side of that the limit differs.
const crossoverTurns = C.seatDiameter / 4 / C.pitch;
ok(faucetFlow({...base, turns: crossoverTurns * 0.8}).limitedBy.includes('under the washer'), 'below the crossover the gap is the limit');
ok(faucetFlow({...base, turns: crossoverTurns * 1.2}).limitedBy.includes('bore'), 'above it the bore is');

// --- the flow --------------------------------------------------------------
for (const turns of [0.5, 1, 2, 4]) {
  for (const pressure of [1, 2, 4, 6]) {
    for (const aerator of [0, 1]) {
      const state = faucetFlow({...base, turns, pressure, aerator});
      const seat = 1 / (C.discharge * C.discharge * state.openArea * state.openArea);
      const pipe = (C.pipeLoss + aeratorLoss[aerator]) / (pipeArea * pipeArea);
      close(
        state.flow,
        Math.sqrt((2 * pressure * 1e5) / C.density / (seat + pipe)),
        1e-12,
        'two turbulent resistances in series give a square root law',
      );
      // Every bar of supply is spent somewhere.
      close(state.seatDrop + state.pipeDrop, pressure, 1e-9, 'the supply pressure is all accounted for');
      ok(state.seatDrop >= 0 && state.pipeDrop >= 0, 'and neither part returns pressure');
      close(state.spoutSpeed, state.flow / bore, 1e-12, 'the spout speed is the flow over the bore');
      close(state.fillTime * state.flow * 1000, C.bucket, 1e-9, 'filling time is the bucket over the flow');
    }
  }
}

// Four times the pressure is exactly twice the flow, whatever else is set.
for (const turns of [0.5, 1, 4]) {
  const single = faucetFlow({...base, turns, pressure: 1});
  const quadruple = faucetFlow({...base, turns, pressure: 4});
  close(quadruple.flow / single.flow, 2, 1e-9, 'flow follows the square root of pressure');
}

// Opening further never gives less, and it gives strictly more only while the
// gap under the washer is still the narrower of the two.
let previous = -1;
for (const turns of [0.25, 0.5, 1, 2, 3, 4]) {
  const state = faucetFlow({...base, turns});
  ok(state.flow >= previous - 1e-15, 'opening the handle never reduces the flow');
  if (turns <= crossoverTurns) ok(state.flow > previous, 'and below the crossover it increases it');
  previous = state.flow;
}
close(
  faucetFlow({...base, turns: 3}).flow,
  faucetFlow({...base, turns: 4}).flow,
  1e-15,
  'once the bore is the limit, further turns change nothing at all',
);
const atCrossover = faucetFlow({...base, turns: 2}).flow;
const wideOpen = faucetFlow({...base, turns: 4}).flow;
ok(wideOpen - atCrossover < atCrossover * 0.01, 'past the crossover the last two turns add under one percent');
const quarterTurn = faucetFlow({...base, turns: 0.25}).flow;
ok(quarterTurn > wideOpen * 0.5, 'while the first quarter turn is already more than half of it');

// Removing the aerator removes a resistance, so more comes out.
ok(faucetFlow({...base, turns: 4, aerator: 0}).flow > faucetFlow({...base, turns: 4, aerator: 1}).flow, 'a tap with the aerator off runs faster');

// --- the washer ------------------------------------------------------------
const sealed = faucetFlow({...base, turns: 0, washer: 0});
close(sealed.flow, 0, 1e-15, 'a new washer passes nothing at all');
ok(sealed.sealed && !sealed.dripping, 'and is reported as sealed');
for (const washer of [1, 2]) {
  const leaking = faucetFlow({...base, turns: 0, washer});
  close(leaking.openArea, washerLeak[washer] * 1e-6, 1e-15, 'a failed washer leaves its own opening');
  ok(leaking.flow > 0 && leaking.dripping, 'and water goes on through it with the handle shut');
}
ok(
  faucetFlow({...base, turns: 0, washer: 2}).flow > faucetFlow({...base, turns: 0, washer: 1}).flow,
  'a perished washer loses more than a worn one',
);

// --- the surge -------------------------------------------------------------
const period = (2 * C.pipeRun) / C.waveSpeed;
for (const closing of [0.01, 0.05, 0.2, 1, 2]) {
  const state = faucetFlow({...base, turns: 4, closing});
  const full = (C.density * C.waveSpeed * state.spoutSpeed) / 1e5;
  close(state.fullSurge, full, 1e-9, 'stopping the water instantly costs density times wave speed times speed');
  close(state.surge, full * Math.min(1, period / closing), 1e-9, 'and a slower closure is relieved in proportion');
  ok(state.surge <= full + 1e-9, 'no closure costs more than stopping it instantly');
}
ok(
  faucetFlow({...base, turns: 4, closing: 0.01}).surge > 10 * faucetFlow({...base, turns: 4, closing: 1}).surge,
  'shutting a tap in a hundredth of a second is worth more than ten times the slow surge',
);
close(faucetFlow({...base, turns: 0, washer: 0, closing: 0.01}).surge, 0, 1e-12, 'stopping water that was not moving costs nothing');

// --- the whole machine -----------------------------------------------------
const model = createFaucetModel();
ok(model.controls.length >= 5, 'the tap offers at least five controls');
ok(model.actions.length >= 2, 'and at least two actions');
ok(Boolean(model.playback), 'and a run to watch');
const opening = model.getState().readings;
ok(opening.length >= 10, 'at least ten readings');
ok(opening.filter(item => item.hint).length >= 6, 'most of them explained');
ok(opening.some(item => item.label === 'Model limit'), 'and the limits stated');

model.update({turns: 2, pressure: 3, washer: 0, aerator: 1, closing: 0.2});
for (let frame = 0; frame < 20000 && !model.playback.complete(); frame += 1) model.advance(0.01);
const run = model.getState();
ok(model.playback.complete(), 'the run finishes');
close(run.filled, C.bucket, 1e-6, 'and stops with exactly ten litres in the bucket');
const expectedFill = faucetFlow({turns: 2, pressure: 3, washer: 0, aerator: 1, closing: 0.2}).fillTime;
close(run.elapsed - 0.2, expectedFill, 0.05, 'in the time the flow says it should take');
ok(run.peakSurge > 0, 'and records the surge that closing it cost');

model.update({turns: 0, pressure: 2, washer: 2, aerator: 1, closing: 1});
ok(!model.playback.complete(), 'changing a control starts the run again');
const dripping = model.getState();
ok(dripping.dripsPerMinute > 50, 'a perished washer is counted in drips a minute');

model.reset();
close(model.getState().filled, 0, 1e-12, 'reset empties the bucket');
assert.deepEqual(model.getState().values, model.defaults, 'and returns every control to its opening setting');
checks += 1;
model.dispose();

console.log(`PASS ${checks} faucet checks: thread pitch, curtain against bore, two resistances in series, the square root law, pressure accounting, washer leakage, the Joukowsky surge and a complete bucket.`);

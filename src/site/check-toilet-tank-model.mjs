// The siphon cistern, held to Torricelli and to its own geometry.
//
// The discharge is worked out here from the head and the bore rather than read
// back from the model, the flush volume from the fall and the plan area, and the
// whole emptying is integrated independently and compared with the run.
import assert from 'node:assert/strict';
import {
  createToiletTankModel,
  siphonDischarge,
  fillRate,
  flushVolume,
  cisternConstants as C,
} from './toilet-tank-model.js';

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

const area = d => (Math.PI * d * d) / 4;

// --- Torricelli ------------------------------------------------------------
for (const bore of [0.025, 0.032, 0.045]) {
  for (const level of [0.02, 0.05, 0.12, 0.2, 0.28]) {
    const head = C.outletDrop + level;
    close(
      siphonDischarge(level, bore),
      C.discharge * area(bore) * Math.sqrt(2 * C.gravity * head),
      1e-15,
      'the discharge is the square root of twice gravity times the head, through the bore',
    );
  }
  // Four times the head is exactly twice the speed.
  const low = C.outletDrop + 0.02;
  const high = 4 * low - C.outletDrop;
  close(siphonDischarge(high, bore) / siphonDischarge(0.02, bore), 2, 1e-9, 'four times the head is twice the discharge');
  // Twice the bore is four times the area and so four times the flow.
  close(siphonDischarge(0.12, bore * 2) / siphonDischarge(0.12, bore), 4, 1e-9, 'twice the bore is four times the discharge');
  // At and below the lip there is nothing left to drive.
  close(siphonDischarge(C.breakLevel, bore), 0, 1e-15, 'at the lip the siphon is finished');
  close(siphonDischarge(C.breakLevel - 0.001, bore), 0, 1e-15, 'and below it there is nothing');
}
// Falling head means falling discharge, always.
let previous = Infinity;
for (let level = 0.28; level > C.breakLevel; level -= 0.01) {
  const flow = siphonDischarge(level, 0.032);
  ok(flow < previous, 'the discharge only ever falls as the level does');
  previous = flow;
}

// --- the geometry of a flush ----------------------------------------------
for (const level of [0.05, 0.09, 0.12, 0.2, 0.26]) {
  close(flushVolume(level), (level - C.breakLevel) * C.tankArea * 1000, 1e-12, 'the flush is the fall to the lip over the plan area');
}
close(flushVolume(C.breakLevel), 0, 1e-15, 'a tank filled only to the lip has no flush in it');
close(flushVolume(0.002), 0, 1e-15, 'and one below it has none either');
// Ten millimetres of float is the same litres wherever it is added.
close(
  flushVolume(0.13) - flushVolume(0.12),
  flushVolume(0.27) - flushVolume(0.26),
  1e-12,
  'a millimetre of float is worth the same volume at any setting',
);

// --- the float valve -------------------------------------------------------
for (const pressure of [0.5, 2, 5]) {
  close(fillRate(0, 0.2, pressure), C.fillAtOneBar * Math.sqrt(pressure), 1e-15, 'wide open, the valve passes what the pressure gives');
  close(fillRate(0.2, 0.2, pressure), 0, 1e-15, 'at the set level it is shut');
  close(
    fillRate(0.2 - C.closingBand / 2, 0.2, pressure),
    C.fillAtOneBar * Math.sqrt(pressure) * 0.5,
    1e-12,
    'and halfway through the closing band it is half open',
  );
}
close(fillRate(0, 0.2, 4) / fillRate(0, 0.2, 1), 2, 1e-12, 'four times the pressure is twice the refill');

// --- a whole cycle ---------------------------------------------------------
const model = createToiletTankModel();
ok(model.controls.length >= 5, 'five controls');
ok(model.actions.length >= 2, 'two actions');
ok(Boolean(model.playback), 'and a cycle to watch');
const opening = model.getState().readings;
ok(opening.length >= 10, 'at least ten readings');
ok(opening.filter(item => item.hint).length >= 6, 'most of them explained');
ok(opening.some(item => item.label === 'Model limit'), 'and the limits stated');

const run = (values, dt = 0.005) => {
  model.update(values);
  for (let frame = 0; frame < 200000 && !model.playback.complete(); frame += 1) model.advance(dt);
  ok(model.playback.complete(), 'the cycle finishes');
  return model.getState();
};

// Integrated here, in the same way but entirely separately, to compare.
function emptyIndependently(level, bore, dt = 0.0005) {
  let height = level;
  let volume = 0;
  let time = 0;
  for (let step = 0; step < 2000000 && height > C.breakLevel; step += 1) {
    const flow = siphonDischarge(height, bore);
    height = Math.max(C.breakLevel, height - (flow * dt) / C.tankArea);
    volume += flow * dt * 1000;
    time += dt;
  }
  return {volume, time};
}

for (const [level, bore, pressure] of [
  [0.12, 0.032, 2],
  [0.26, 0.032, 2],
  [0.12, 0.045, 2],
  [0.09, 0.025, 1],
]) {
  const state = run({level, bore, pressure, stroke: 0.025, perDay: 5});
  const expected = emptyIndependently(level, bore);
  close(state.discharged, flushVolume(level), 0.02, 'the flush delivers the volume the geometry promised');
  close(state.discharged, expected.volume, 0.02, 'and matches an independent integration of it');
  close(state.flushEnded - 0.4, expected.time, 0.05, 'in the time that integration takes');
  close(state.peak, siphonDischarge(level, bore), 1e-9, 'and peaks at the discharge the starting head gives');
  close(state.level, level, 1e-6, 'the refill returns to the set level');
  close(state.refilled, flushVolume(level), 0.03, 'putting back exactly what went out');
}

// The bore changes the rate and not the amount.
const narrow = run({level: 0.12, bore: 0.025, pressure: 2, stroke: 0.025, perDay: 5});
const wide = run({level: 0.12, bore: 0.045, pressure: 2, stroke: 0.025, perDay: 5});
close(wide.discharged, narrow.discharged, 0.02, 'a wider bore flushes the same water');
ok(wide.flushEnded < narrow.flushEnded * 0.55, 'and gets it away in much less time');

// The pressure changes the refill and not the flush.
const soft = run({level: 0.12, bore: 0.032, pressure: 1, stroke: 0.025, perDay: 5});
const hard = run({level: 0.12, bore: 0.032, pressure: 4, stroke: 0.025, perDay: 5});
close(hard.discharged, soft.discharged, 1e-6, 'supply pressure changes nothing about the flush');
close(hard.flushEnded, soft.flushEnded, 1e-6, 'nor how long it takes');
const softRefill = soft.elapsed - soft.flushEnded;
const hardRefill = hard.elapsed - hard.flushEnded;
close(softRefill / hardRefill, 2, 0.05, 'while four times the pressure halves the refill');

// A stroke too short does nothing at all.
const failed = run({level: 0.12, bore: 0.032, pressure: 2, stroke: 0.01, perDay: 5});
close(failed.discharged, 0, 1e-12, 'a stroke below the priming threshold flushes nothing');
close(failed.level, 0.12, 1e-9, 'and leaves the tank where it was');
ok(!failed.primes, 'and says so');

// A year of it.
const yearly = run({level: 0.12, bore: 0.032, pressure: 2, stroke: 0.025, perDay: 5});
close(yearly.litresPerDay, flushVolume(0.12) * 5, 1e-9, 'five flushes a day is five flushes of water');

// The refill estimate offered before the run has to be the refill that happens.
for (const pressure of [0.5, 2, 5]) {
  model.update({level: 0.12, bore: 0.032, pressure, stroke: 0.025, perDay: 5});
  const promised = Number(
    model.getState().readings.find(item => item.label === 'Refill will take').value.split(' ')[0],
  );
  const state = run({level: 0.12, bore: 0.032, pressure, stroke: 0.025, perDay: 5});
  close(state.elapsed - state.flushEnded, promised, 0.02, 'the refill takes as long as the reading promised');
}

model.reset();
assert.deepEqual(model.getState().values, model.defaults, 'reset returns every control to its opening setting');
checks += 1;
model.dispose();

console.log(`PASS ${checks} cistern checks: Torricelli against head and bore, a flush set by geometry alone, a float valve closing in proportion, four independent integrations of the emptying, and bore, pressure and priming each changing only what they should.`);

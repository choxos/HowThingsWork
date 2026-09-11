// The water meter, held to EN ISO 4064 rather than to its own arithmetic.
//
// Q1, Q2 and the error bands are written out here from the permanent flow and
// the ratio, the way the standard derives them, and compared with what the
// model reports. The volumes are integrated independently of the model's own
// accumulation and compared at the end of a run.
import assert from 'node:assert/strict';
import {createWaterMeterModel, meterResponse, meterConstants as C, meterSizes} from './water-meter-model.js';

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

// --- the standard's own arithmetic ----------------------------------------
for (const size of [0, 1]) {
  const spec = meterSizes[size];
  const q1 = spec.permanent / spec.ratio;
  const state = meterResponse(spec.permanent, size);
  close(state.q3, spec.permanent, 1e-12, 'the permanent flow is what the meter is described by');
  close(state.q1, q1, 1e-12, 'Q1 is the permanent flow over the ratio');
  close(state.q2, 1.6 * q1, 1e-12, 'and Q2 is 1.6 times Q1');
  close(state.starting, q1 / 2, 1e-12, 'the impeller starts at half of Q1');

  // The error bands, at points chosen inside each one.
  close(meterResponse(q1 * 1.2, size).error, -0.05, 1e-12, 'between Q1 and Q2 the meter may be five percent out');
  close(meterResponse(q1 * 2, size).error, -0.02, 1e-12, 'and above Q2, two percent');
  close(meterResponse(q1 / 4, size).error, -1, 1e-12, 'below the starting flow it registers nothing');
  close(meterResponse(0, size).error, -1, 1e-12, 'and nothing is nothing');

  // The ramp between the starting flow and Q1 is continuous at both ends.
  close(meterResponse(q1 / 2 + 1e-9, size).error, -1, 1e-6, 'the ramp starts at registering nothing');
  close(meterResponse(q1 - 1e-9, size).error, -0.05, 1e-6, 'and arrives exactly at the five percent band');

  // Never over-reads, anywhere.
  for (let flow = 0; flow <= spec.permanent * 1.5; flow += spec.permanent / 40) {
    const point = meterResponse(flow, size);
    ok(point.error <= 0 + 1e-12, 'friction only ever makes a turbine read low');
    ok(point.registered <= point.flow + 1e-12, 'so the register never claims more than passed');
    ok(point.unregistered >= -1e-12, 'and the difference is never negative');
    close(point.registered + point.unregistered, point.flow, 1e-9, 'registered and missed together are what passed');
  }
}

// A meter sized for more water is blinder to small flows.
ok(meterResponse(1, 1).q1 > meterResponse(1, 0).q1, 'the larger meter has the higher minimum flow');
const awkward = 0.3;
ok(meterResponse(awkward, 0).turning && !meterResponse(awkward, 1).turning, 'and a flow the small meter can see is one the large meter cannot');

// --- the star wheel --------------------------------------------------------
ok(meterResponse(0.0001, 0).starWheel, 'the star wheel moves on any flow at all');
ok(!meterResponse(0, 0).starWheel, 'and stops when there is none');
ok(!meterResponse(0.0001, 0).turning, 'while the register is still at rest');

// --- the pressure it costs -------------------------------------------------
for (const size of [0, 1]) {
  const spec = meterSizes[size];
  close(meterResponse(spec.permanent, size).drop, C.dropAtQ3, 1e-12, 'a meter at its permanent flow costs the allowed drop');
  close(meterResponse(spec.permanent / 2, size).drop, C.dropAtQ3 / 4, 1e-12, 'half the flow costs a quarter of the pressure');
  close(meterResponse(0, size).drop, 0, 1e-15, 'and no flow costs none');
}

// --- a whole run -----------------------------------------------------------
const model = createWaterMeterModel();
ok(model.controls.length >= 5, 'five controls');
ok(model.actions.length >= 2, 'two actions');
ok(Boolean(model.playback), 'and a run');
const opening = model.getState().readings;
ok(opening.length >= 10, 'at least ten readings');
ok(opening.filter(item => item.hint).length >= 6, 'most of them explained');
ok(opening.some(item => item.label === 'Model limit'), 'and the limits stated');

for (const [flow, leak, hours, size] of [
  [9, 0, 0.5, 0],
  [0, 0.005, 24, 0],
  [0, 0.3, 24, 0],
  [0, 0.3, 24, 1],
  [30, 0, 0.25, 0],
]) {
  model.update({flow, hours, size, leak, tariff: 2.4});
  for (let frame = 0; frame < 400000 && !model.playback.complete(); frame += 1) model.advance(0.05);
  const run = model.getState();
  ok(model.playback.complete(), 'the run finishes');
  close(run.elapsed, hours * 3600, 1e-6, 'and runs for exactly the time asked');

  // Volume worked out here, from the flow and the clock, with no reference to
  // how the model accumulated it.
  const response = meterResponse(flow + leak, size);
  close(run.deliveredVolume, ((flow + leak) * hours * 3600) / 60, 1e-6, 'the delivered volume is flow times time');
  close(run.registeredVolume, (response.registered * hours * 3600) / 60, 1e-6, 'and the registered volume is the flow it admits to, times time');
  close(run.cost, (run.registeredVolume / 1000) * 2.4, 1e-9, 'the bill follows the register, not the delivery');
  ok(run.missed >= -1e-12, 'and what was missed is never negative');
}

// The dripping tap that the meter never sees.
model.update({flow: 0, hours: 24, size: 0, leak: 0.005, tariff: 2.4});
for (let frame = 0; frame < 400000 && !model.playback.complete(); frame += 1) model.advance(0.05);
const dripped = model.getState();
close(dripped.registeredVolume, 0, 1e-12, 'a day of dripping registers nothing');
close(dripped.deliveredVolume, 7.2, 1e-6, 'though 7.2 litres went through');
close(dripped.cost, 0, 1e-12, 'and none of it is charged for');
ok(dripped.starWheel, 'while the star wheel turned the whole time');

model.reset();
close(model.getState().registeredVolume, 0, 1e-12, 'reset clears the register');
assert.deepEqual(model.getState().values, model.defaults, 'and every control returns to its opening setting');
checks += 1;
model.dispose();

console.log(`PASS ${checks} water meter checks: Q1 and Q2 from the ratio, the error bands and the ramp below them, a meter that never over-reads, the star wheel below the starting flow, a pressure drop going as the square, and volumes integrated independently over five runs.`);

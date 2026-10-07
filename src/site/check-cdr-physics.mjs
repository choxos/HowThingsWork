import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { cdrPlan, cdrAt, cdrStoredMark, cdrPassPosition, cdrSettings, createCdrController, cdrCacheSizes, CDR_TIMING, CDR_DEFAULTS, CDR_DOMAINS } from './cdr-physics.js';
import { cdrBlankMedium, cdrWriteMedium, CDR_CHANNEL_CELLS, CDR_WRITE_RATE } from './cdr-medium.js';
import { CD_CHANNEL_RATE } from './cd-codec.js';

const out = process.env.EVIDENCE_DIR || 'documentation/audit/evidence/cdr-model';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const throws = (fn, type) => { assert.throws(fn, type); checks++; };
const started = Date.now(), cases = [], boundaries = [0, 1, 2.03125, 3.0625, 4, 5, 5.5, 6, 7, 8.5, 10, 10.999, 11];
equal([0, 1, 4, 5, 6].map(cdrPassPosition), [0, 13052, 13092, CDR_CHANNEL_CELLS, CDR_CHANNEL_CELLS], 'Piecewise teaching time preserves the exact channel order');
for (let high = 0; high < 16; high++) for (let low = 0; low < 16; low++) {
  for (let medium = 0; medium < 3; medium++) for (let power = 0; power < 3; power++) for (let readLight = 0; readLight < 2; readLight++) {
    const values = { high, low, medium, power, readLight }, plan = cdrPlan(values), byte = high * 16 + low;
    const recorded = medium !== 0 || power === 0, expectedByte = medium === 1 ? 85 : medium === 2 ? 170 : byte, available = recorded && Boolean(readLight);
    let marks = -1, received = -1;
    for (const time of boundaries) {
      const state = cdrAt(plan, time);
      check(state.storedMarks >= marks, 'Marks persist through writing, return motion, and reading'); marks = state.storedMarks;
      check(state.readReceived >= received, 'Read progress does not run backward'); received = state.readReceived;
      check(state.available === (time === 11 && available), 'No user byte appears before complete valid sector checks');
      check(state.outputByte === (time === 11 && available ? expectedByte : null), 'Output follows the physical region and light state');
      check(!state.exposing || (state.writing && medium === 0 && power === 0), 'Only a blank region with recording exposure forms marks');
      if (time < 6 || !readLight) check(state.receivedWord === null, 'No word is received before read light visits it');
      if (!readLight && state.seeking) check(state.status.includes('read light will stay off'), 'Return instructions honor the selected dark read');
      if (!readLight && state.reading) check(state.status.includes('without received transitions'), 'A dark scan does not claim light or transitions arrive');
      if (medium !== 0 || power !== 0) check(state.addedMarks === 0, 'Blocked or low-power writing does not add marks');
      if (medium !== 0) check(state.storedMarks === plan.initialMarks, 'A recorded region keeps its previous pattern');
      if (time >= 5) equal(state.windowMarks, Array.from(plan.final.marks.slice(CDR_TIMING.windowStart, CDR_TIMING.windowEnd)), 'Visible track equals the actual stored medium');
      check(state.windowReceived.every((bit, i) => bit === (state.readReceived > CDR_TIMING.windowStart + i ? plan.read.bits[CDR_TIMING.windowStart + i] : null)), 'Received track reveals only cells already visited');
      check([state.spiral.radiusMm, state.spiral.rpm, state.spiral.angle, state.writeSeconds, state.readSeconds].every(Number.isFinite), 'Track state remains finite');
    }
    const final = cdrAt(plan, 11);
    check(final.complete && !final.light && !final.exposing, 'Completed experiment turns beams off');
    check(final.writeSeconds === CDR_CHANNEL_CELLS / CDR_WRITE_RATE && final.readSeconds === CDR_CHANNEL_CELLS / CD_CHANNEL_RATE, 'Real channel time uses the distinct write and read clocks');
    check(final.spiral.travelMicrometers > .3 && final.spiral.travelMicrometers < .4, 'Finite excerpt advances the reference spiral by its physical length');
    if (available) check(plan.read.sector.syncOk && plan.read.sector.addressOk && plan.read.sector.edcOk && plan.read.sector.parityOk, 'A reported byte passes real sector checks');
    cases.push({ ...values, input: byte, output: final.outputByte, marks: final.storedMarks, available: final.available });
  }
  const plan = cdrPlan({ high, low });
  for (const time of [0, .5, 1.331, 2.277, 3.999, 4.5, 5]) {
    const state = cdrAt(plan, time), partial = cdrWriteMedium(cdrBlankMedium(), plan.program, 'record', state.writeCells).medium;
    check(partial.marks.reduce((a, b) => a + b, 0) === state.storedMarks, 'Fast animation count matches material writes');
    check(partial.marks.every((mark, i) => cdrStoredMark(plan, state, i) === mark), 'Every animated mark matches the independent material boundary');
  }
  const state = cdrAt(plan, 2.4), expectedRpm = 60 * 4.8 / (2 * Math.PI * state.spiral.radiusMm / 1000);
  check(Math.abs(state.spiral.rpm - expectedRpm) < 1e-10, 'Four-times track speed sets writing rpm');
  const controller = createCdrController({ values: { high, low } });
  const paused = controller.advance(2.4); equal(controller.advance(0), paused, 'A paused writer keeps every mark');
  controller.advance(2.6); const written = controller.getState().windowMarks;
  controller.advance(1); equal(controller.getState().windowMarks, written, 'Return motion cannot erase the dye');
  controller.advance(5); equal(controller.getState(), cdrAt(plan, 11), 'Partitioned advance equals direct evaluation');
  controller.reset(controller.replayState()); equal(controller.getState(), cdrAt(plan, 0), 'Replay prepares the same new experiment');
  check(cdrCacheSizes().prepared <= 2 && cdrCacheSizes().written <= 8, 'Persistent medium caches stay bounded');
}
const control = createCdrController();
for (const [key, [lo, hi]] of Object.entries(CDR_DOMAINS)) for (const value of [lo, hi]) {
  control.reset({ values: { ...CDR_DEFAULTS, [key]: value === lo ? hi : lo }, time: 8 });
  const changed = control.update({ [key]: value });
  check(changed.time === 0 && changed.values[key] === value && !changed.available, 'Changed controls prepare a new experiment with the chosen medium');
  equal(control.replayState(), { values: changed.values, time: 0 }, 'Replay keeps the newly selected experiment');
}
control.reset({ values: { high: 2 }, time: 8 }); const unchanged = control.getState();
equal(control.update({ high: 2 }), unchanged, 'Same control value preserves current writing and reading state');
for (const input of [null, [], 3]) throws(() => cdrSettings(input), TypeError);
for (const input of [{ unknown: 1 }, { high: 16 }, { low: -.1 }, { medium: .5 }, { power: 3 }, { readLight: NaN }]) throws(() => cdrSettings(input), RangeError);
for (const time of [-1, NaN, Infinity]) throws(() => cdrAt(cdrPlan(), time), RangeError);
throws(() => control.reset({ values: {}, extra: 1 }), TypeError);
throws(() => control.reset({ time: 12 }), RangeError);
throws(() => cdrStoredMark(cdrPlan(), control.getState(), CDR_CHANNEL_CELLS), RangeError);
await writeFile(out + '/physics.json', JSON.stringify({ passed: true, checks, combinations: cases.length, boundaries, cases, elapsedMs: Date.now() - started,
  scope: 'All requested eight-bit patterns, all medium/power/read-light combinations, exact stored-mark timing, checked readback, and controller replay. Material formation and motion between passes are teaching approximations.' }, null, 2));
console.log(`PASS CD-R physics: ${checks} checks, ${cases.length} control combinations, exact stored-mark animation parity`);

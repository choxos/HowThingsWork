import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dvdrPlan, dvdrAt, dvdrStoredMark, dvdrPassPosition, dvdrSettings, createDvdrController, dvdrCacheSizes, DVDR_DEFAULTS, DVDR_DOMAINS, DVDR_TIMING, DVDR_FILE_TRACE } from './dvdr-physics.js';
import { dvdrBlankMedium, dvdrWriteMedium, dvdrRunAt, dvdrReferencePulses, DVDR_CHANNEL_CELLS } from './dvdr-medium.js';
import { DVDR_FILE_NAMES } from './dvdr-files.js';
import { DVD_CHANNEL_RATE, DVD_USER_BYTES, DVD_FIRST_SECTOR, dvdScramble } from './dvd-codec.js';

const out = process.env.EVIDENCE_DIR || 'documentation/audit/evidence/dvdr-model';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
const equal = (value, expected, message) => { assert.deepEqual(value, expected, message); checks++; };
const started = Date.now(), cases = [], traces = [], materialParity = [];
const boundaries = [0, 1, 2.03125, 3.0625, 4, 5, 5.5, 6, 7, 8.5, 10, 10.999, 11, 11.04, 12.96, 13, 13.25];
equal([0, 1, 4, 5, 6].map(dvdrPassPosition), [0, DVDR_TIMING.windowStart, DVDR_TIMING.windowEnd, DVDR_CHANNEL_CELLS, DVDR_CHANNEL_CELLS], 'The displayed pass preserves channel order and the entire excerpt.');
for (let content = 0; content < 3; content++) {
  for (let medium = 0; medium < 4; medium++) for (let power = 0; power < 3; power++) for (let readLight = 0; readLight < 2; readLight++) for (let pulseType = 0; pulseType < 3; pulseType++) {
    const values = { content, medium, power, readLight, pulseType }, p = dvdrPlan(values);
    const expected = DVDR_FILE_NAMES[medium ? medium - 1 : content].replace(';1', ''), available = Boolean(readLight && (medium || power === 0));
    let marks = -1, received = -1;
    for (const time of boundaries) {
      const s = dvdrAt(p, time);
      check(s.storedMarks >= marks && s.readReceived >= received, 'Material and read progress never run backward.'); marks = s.storedMarks; received = s.readReceived;
      check(s.available === (time >= 11 && available), 'Movie waits for full readback and required sector checks.');
      check(s.storedName === (s.available ? expected : null), 'Directory in recorded material determines the returned filename.');
      check(s.available ? s.picture === p.read.file.video.frames[s.frameIndex] : s.picture === null, 'Only decoded received pictures supply movie output.');
      check(!s.exposing || s.writing && !medium && power === 0, 'Only matched exposure on blank material writes.');
      if (medium || power !== 0) check(s.addedMarks === 0, 'Blocked or weak writing adds no marks.');
      if (medium) check(s.storedMarks === p.initialMarks, 'Original material persists in occupied regions.');
      if (time >= 5) equal(s.windowMarks, Array.from(p.final.marks.subarray(DVDR_TIMING.windowStart, DVDR_TIMING.windowEnd)), 'Magnified track shows actual final material.');
      check(s.windowReceived.every((bit, n) => bit === (DVDR_TIMING.windowStart + n < s.readReceived ? p.read.bits[DVDR_TIMING.windowStart + n] : null)), 'Visible transitions arrive only after the reading spot.');
      if (time < 6 || !readLight) check(s.receivedWord === null && s.decodedWordByte === null, 'No data arrives before reading light.');
      if (s.reading && !readLight) check(s.status.includes('No transitions'), 'Dark read explains its missing signal.');
      if (time >= 11) check(!s.light && !s.exposing && s.spiral.rpm === 0, 'Finished passes stop the drive while video playback can continue.');
      check([s.spiral.radiusMm, s.spiral.rpm, s.spiral.angle, s.writeSeconds, s.readSeconds].every(Number.isFinite), 'Motion remains finite.');
    }
    const final = dvdrAt(p, DVDR_TIMING.duration);
    check(final.complete && final.frameIndex === 49, 'Completion retains the last decoded frame.');
    check(final.writeSeconds === DVDR_CHANNEL_CELLS / DVD_CHANNEL_RATE && final.readSeconds === final.writeSeconds, 'One-times physical clocks are distinct from illustrative screen time.');
    if (available) check(p.read.recovered.sectors.every(sector => sector.valid), 'Recovered volume passes every sector check.');
    cases.push({ ...values, available, storedName: final.storedName, markedCells: final.storedMarks });
  }
  const p = dvdrPlan({ content }), f = DVDR_FILE_TRACE;
  const payload = p.program.volume.bytes.subarray(f.lba * DVD_USER_BYTES, (f.lba + 1) * DVD_USER_BYTES);
  const scrambled = dvdScramble(payload, DVD_FIRST_SECTOR + f.lba)[f.frameByte - 12];
  equal(p.program.volume.file.bytes[f.fileByte], [47, 185, 46][content], 'Trace selects a real distinct byte in each movie.');
  equal(p.program.recording[f.recordingByte], scrambled, 'File-byte trace includes sector scrambling and interleaving.');
  equal(p.read.efm.recording[f.recordingByte], scrambled, 'Received EFMplus word decodes the traced byte.');
  equal(p.read.file.bytes[f.fileByte], p.program.volume.file.bytes[f.fileByte], 'Descrambling and file retrieval recover the original byte.');
  traces.push({ content, ...f, fileByteValue: p.program.volume.file.bytes[f.fileByte], scrambled, word: Array.from(p.program.channel.bits.subarray(f.firstCell, f.firstCell + 16)).join('') });
  const pulseShapes = [];
  for (let type = 0; type < 3; type++) {
    const shape = []; let at = DVDR_TIMING.windowStart;
    while (at < DVDR_TIMING.windowEnd) { const run = dvdrRunAt(p.program, at); shape.push(...dvdrReferencePulses(run, type)); at = run.end; }
    pulseShapes.push(JSON.stringify(shape));
  }
  check(new Set(pulseShapes).size === 3, 'Each reference-pulse choice changes the actual selected-patch diagram.');
  for (const time of [0, 1.331, 2.277, 4.5, 5]) {
    const s = dvdrAt(p, time), actual = dvdrWriteMedium(dvdrBlankMedium(), p.program, 'record', s.writeCells).medium;
    equal(actual.marks.reduce((a, b) => a + b, 0), s.storedMarks, 'Animation count matches an independent partial material write.');
    check(actual.marks.every((mark, cell) => dvdrStoredMark(p, s, cell) === mark), 'Every animated material cell matches the write operation.');
    materialParity.push({ content, time, cells: actual.marks.length, marked: s.storedMarks });
  }
  const s = dvdrAt(p, 2.4), expectedRpm = 60 * 3.49 / (2 * Math.PI * s.spiral.radiusMm / 1000);
  check(Math.abs(s.spiral.rpm - expectedRpm) < 1e-10, 'Disc speed follows track velocity and radius.');
  const controller = createDvdrController({ values: { content } });
  const paused = controller.advance(2.4); equal(controller.advance(0), paused, 'Paused state keeps all material and output.');
  for (const dt of [2.6, 1, 5, .04, 1.96, .25]) controller.advance(dt);
  equal(controller.getState(), dvdrAt(p, DVDR_TIMING.duration), 'Partitioned playback reaches the same final state.');
  controller.reset(controller.replayState()); equal(controller.getState(), dvdrAt(p, 0), 'Replay prepares the original selected comparison.');
}
const controller = createDvdrController();
for (const [key, [lo, hi]] of Object.entries(DVDR_DOMAINS)) for (const value of [lo, hi]) {
  controller.reset({ values: { ...DVDR_DEFAULTS, [key]: value === lo ? hi : lo }, time: 12 });
  const s = controller.update({ [key]: value });
  check(s.time === 0 && !s.available && s.picture === null && s.values[key] === value, 'Changing any control clears old output and prepares the requested experiment.');
  equal(controller.replayState(), { values: s.values, time: 0 }, 'Replay retains new selections.');
}
controller.reset({ values: { content: 2 }, time: 12 }); const unchanged = controller.getState();
equal(controller.update({ content: 2 }), unchanged, 'Unchanged controls preserve playback.');
for (const value of [null, [], 3]) { assert.throws(() => dvdrSettings(value), TypeError); checks++; }
for (const value of [{ extra: 1 }, { content: 3 }, { medium: 4 }, { power: -.1 }, { readLight: NaN }, { pulseType: .5 }]) { assert.throws(() => dvdrSettings(value), RangeError); checks++; }
for (const time of [-1, NaN, Infinity]) { assert.throws(() => dvdrAt(dvdrPlan(), time), RangeError); checks++; }
assert.throws(() => controller.reset({ time: 14 }), RangeError); checks++;
assert.throws(() => controller.reset({ extra: 1 }), TypeError); checks++;
check(dvdrCacheSizes().recorded === 3, 'Stored-material cache is bounded by the three allowed files.');
await writeFile(out + '/physics.json', JSON.stringify({ passed: true, checks, combinations: cases.length, boundaries, traces, materialParity, cases, elapsedMs: Date.now() - started,
  scope: 'All controls, received-file provenance, exact animation/material parity, source-byte trace, pulse-choice visibility, channel/spiral timing and controller state. Ideal mark formation is not a calibrated thermal simulation.' }, null, 2));
console.log(`PASS DVD-R physics: ${checks} checks, ${cases.length} combinations, ${materialParity.length} full-material comparisons`);

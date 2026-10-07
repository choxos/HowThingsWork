import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { cdrBits, cdrWriteProgram, cdrBlankMedium, cdrWriteMedium, cdrReadMedium, cdrReferencePulse, cdrMediumCacheSize, CDR_CHANNEL_CELLS, CDR_BYTE_TRACE, CDR_WRITE_RATE } from './cdr-medium.js';
import { CD_EFM_WORDS } from './cd-efm-table.js';

const out = process.env.EVIDENCE_DIR || 'documentation/audit/evidence/cdr-model';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
const throws = (fn, type) => { assert.throws(fn, type); checks++; };
const cases = [], started = Date.now();
check(CDR_CHANNEL_CELLS === 122892, 'One Mode 1 sector plus the finite CIRC tail');
check(CDR_WRITE_RATE === 17287200, 'Four times nominal CD channel clock');
// Independent vectors from ECMA-394 sections 2.3.3, 2.3.4 and 4.4.4.1.
// LTS is 4x; theta = 0.5T, delta = T/16 after a 3T land, deltaP = 0.04PW.
const referenceVectors = [[3, 3, 2.4375, 1.04], [3, 4, 2.5, 1.04], [4, 3, 3.4375, 1], [4, 4, 3.5, 1], [11, 3, 10.4375, 1], [11, 11, 10.5, 1]];
for (const [cells, preceding, width, height] of referenceVectors) {
  const pulse = cdrReferencePulse({ start: 100, end: 100 + cells, cells, mark: true, clipped: false }, { cells: preceding });
  check(pulse.widthCells === width && pulse.start === 100 + cells - width && pulse.end === 100 + cells, 'Reference timing matches a literal standard-derived vector');
  check(pulse.relativePower === height, 'Three-cell marks receive the specified relative-height increase');
  check(Math.abs(pulse.physicalSeconds - width / 17287200) < 1e-18, 'Literal four-times clock converts each reference width to seconds');
}
const blank = cdrBlankMedium();
check(!cdrReadMedium(blank).available, 'Unwritten medium cannot supply a validated byte');
for (let byte = 0; byte < 256; byte++) {
  const program = cdrWriteProgram(byte), encoded = program.run;
  check(cdrBits(byte) === byte.toString(2).padStart(8, '0'), 'All eight input bits remain visible');
  check(program.trace.scrambledByte === encoded.frames[0][17], 'First user byte follows the prescribed paired-byte mapping');
  check(program.trace.scrambledByte === encoded.circ.c2[2][5], 'Source byte survives the first CIRC delay and permutation');
  check(program.trace.scrambledByte === encoded.circ.frames[22][5], 'Source byte reaches channel frame 22, data symbol 5');
  check(Array.from(encoded.channel.bits.slice(CDR_BYTE_TRACE.firstCell, CDR_BYTE_TRACE.firstCell + 14)).join('') === CD_EFM_WORDS[program.trace.scrambledByte], 'Magnified word is the actual encoded source byte');
  const write = cdrWriteMedium(blank, program);
  check(write.status === 'recorded' && write.medium.occupied, 'Completed writing occupies the region');
  check(write.medium.marks.every((x, i) => x === Number(encoded.levels[i] < 0)), 'Every stored mark follows the encoded channel polarity');
  check(blank.marks.every(x => x === 0) && !blank.occupied, 'A new medium result does not mutate another experiment');
  const snapshot = JSON.parse(JSON.stringify({ marks: Array.from(write.medium.marks), occupied: write.medium.occupied }));
  const read = cdrReadMedium({ marks: Uint8Array.from(snapshot.marks), occupied: snapshot.occupied });
  check(read.available && read.byte === byte, 'Stored-medium-only snapshot returns the requested byte');
  check(read.sector.data.slice(1).every(x => x === 0), 'Remaining user bytes retain actual zero padding');
  check(read.sector.syncOk && read.sector.addressOk && read.sector.edcOk && read.sector.parityOk, 'Recovered sector passes all structural and code checks');
  const alternate = cdrWriteProgram(byte ^ 255);
  const blocked = cdrWriteMedium(write.medium, alternate);
  check(blocked.status === 'occupied' && blocked.medium === write.medium && blocked.addedMarks === 0, 'A different requested byte cannot replace the recorded region');
  for (const power of ['read', 'off']) {
    const low = cdrWriteMedium(blank, program, power);
    check(low.medium === blank && low.addedMarks === 0, 'Read power and laser-off leave blank dye unchanged');
    check(cdrWriteMedium(write.medium, alternate, power).medium === write.medium, 'Lower power cannot erase existing marks');
  }
  if ([0, 85, 170, 255].includes(byte)) {
    check(!cdrReadMedium(write.medium, false).available, 'A dark reader does not recover stored input');
    const erased = { marks: new Uint8Array(CDR_CHANNEL_CELLS), occupied: true };
    check(!cdrReadMedium(erased).available, 'Occupancy metadata cannot substitute missing physical marks');
    let medium = cdrBlankMedium(), previousCount = 0;
    for (const position of [0, 1, 10, 11, 13062, 13079, 13100, CDR_CHANNEL_CELLS - 1, CDR_CHANNEL_CELLS]) {
      const step = cdrWriteMedium(medium, program, 'record', position);
      check(step.medium.marks.every((x, i) => x >= medium.marks[i]), 'Recording never changes an existing mark back to blank');
      const count = step.medium.marks.reduce((a, b) => a + b, 0);
      check(count >= previousCount, 'Persistent mark count cannot decrease while writing');
      check(step.medium.occupied === (position === CDR_CHANNEL_CELLS), 'A partial excerpt is not labeled a completed recording');
      medium = step.medium; previousCount = count;
    }
    check(medium.marks.every((x, i) => x === write.medium.marks[i]), 'Paused and resumed exposure produces the same stored channel');
  }
  const pulses = program.runs.flatMap((run, i) => {
    const pulse = cdrReferencePulse(run, program.runs[i - 1]);
    if (!pulse) return [];
    check(run.cells >= 3 && run.cells <= 11, 'Reference pulse describes a legal EFM mark');
    check(pulse.end === run.end && pulse.start > run.start && pulse.start < pulse.end, 'Reference pulse lies within its nominal mark interval');
    check(Math.abs(pulse.physicalSeconds * CDR_WRITE_RATE - pulse.widthCells) < 1e-12, 'Reference pulse time uses the four-times clock');
    return [pulse];
  });
  check(pulses.length > 1000, 'Actual coded stream supplies pulse references');
  check(cdrMediumCacheSize() <= 8, 'Encoding cache remains bounded');
  cases.push({ byte, bits: program.inputBits, cells: write.visited, storedMarks: write.addedMarks, recovered: read.byte, pulses: pulses.length });
}
for (const byte of [-1, 256, 0.5, NaN, '10']) throws(() => cdrWriteProgram(byte), RangeError);
throws(() => cdrReadMedium({ marks: new Uint8Array(10), occupied: false }), TypeError);
throws(() => cdrReadMedium({ marks: new Uint8Array(CDR_CHANNEL_CELLS).fill(2), occupied: false }), TypeError);
throws(() => cdrReadMedium(blank, 1), TypeError);
throws(() => cdrWriteMedium(blank, cdrWriteProgram(0), 'erase'), RangeError);
throws(() => cdrWriteMedium(blank, cdrWriteProgram(0), 'record', -1), RangeError);
throws(() => cdrWriteMedium(blank, cdrWriteProgram(0), 'record', CDR_CHANNEL_CELLS + 1), RangeError);
const report = { passed: true, checks, cases, elapsedMs: Date.now() - started,
  scope: 'Actual stored-mark and recovered-sector behavior for all 256 selected bytes. Ideal material formation and transition detection; no calibrated thermal, OPC, diffraction, analog readout or complete-disc claim.' };
await writeFile(out + '/medium.json', JSON.stringify(report, null, 2));
console.log(`PASS CD-R medium: ${checks} checks, ${cases.length} byte values, stored-mark-only readback`);

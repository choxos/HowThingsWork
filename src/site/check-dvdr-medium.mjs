import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dvdrWriteProgram, dvdrBlankMedium, dvdrWriteMedium, dvdrReadMedium, dvdrRunAt, dvdrReferencePulses, dvdrProgramCacheSize, DVDR_CHANNEL_CELLS } from './dvdr-medium.js';
import { DVDR_FILE_NAMES, dvdrReadFile } from './dvdr-files.js';
import { DVD_CHANNEL_RATE, DVD_SECTOR_BITS } from './dvd-codec.js';

const out = process.env.EVIDENCE_DIR || 'documentation/audit/evidence/dvdr-model';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
const cases = [];
const blank = dvdrBlankMedium(), blankRead = dvdrReadMedium(blank);
check(!blankRead.file.available && blankRead.file.bytes === null, 'Blank material cannot supply a file.');
check(!dvdrReadMedium({ marks: blank.marks, occupied: true }).file.available, 'Occupancy does not fabricate data.');

for (let content = 0; content < 3; content++) {
  const program = dvdrWriteProgram(content);
  check(program.marks.length === DVDR_CHANNEL_CELLS && program.ends.at(-1) === DVDR_CHANNEL_CELLS, 'Complete finite channel.');
  let start = 0, markedCells = 0;
  const lengths = new Set();
  for (let n = 0; n < program.ends.length; n++) {
    const end = program.ends[n], count = end - start;
    check(count > 0, 'Run ends strictly increase.');
    if (n > 0 && n + 1 < program.ends.length) check(count >= 3 && count <= 11 || count === 14, 'Data runs are 3T through 11T; sync permits 14T.');
    if (program.marks[start]) { markedCells += count; if (n > 0 && n + 1 < program.ends.length) lengths.add(count); }
    start = end;
  }
  check(lengths.has(3) && lengths.has(14), 'Both short marks and long sync marks are present.');
  const written = dvdrWriteMedium(blank, program);
  check(written.medium.occupied && written.addedMarks === markedCells && written.status === 'recorded', 'Recording creates exactly the selected marks.');
  check(blank.marks.every(mark => mark === 0) && !blank.occupied, 'Independent blank input remains unchanged.');
  check(written.medium.marks.every((mark, cell) => mark === program.marks[cell]), 'Written physical pattern matches channel level pattern.');
  const copiedMaterial = { marks: Uint8Array.from(written.medium.marks), occupied: false };
  const read = dvdrReadMedium(copiedMaterial);
  check(read.file.available && read.file.entry.name === DVDR_FILE_NAMES[content], 'File identity is recovered from material and directory.');
  assert.deepEqual(read.file.bytes, program.volume.file.bytes); checks++;
  check(read.recovered.sectors.every(sector => sector.valid) && read.file.video.frames.length === 50, 'All sectors and movie frames validate.');
  const dark = dvdrReadMedium(written.medium, false);
  check(!dark.file.available && dark.file.bytes === null && dark.file.video === null, 'No reading light means no file or old movie.');
  check(written.medium.marks.every((mark, cell) => mark === program.marks[cell]), 'Reading with light off does not erase marks.');
  for (const power of ['record', 'read', 'off']) {
    const blocked = dvdrWriteMedium(written.medium, dvdrWriteProgram((content + 1) % 3), power);
    check(blocked.status === 'occupied' && blocked.medium === written.medium && blocked.addedMarks === 0, 'Occupied region refuses replacement.');
  }
  for (const power of ['read', 'off']) {
    const weak = dvdrWriteMedium(blank, program, power);
    check(weak.medium === blank && weak.addedMarks === 0 && !weak.medium.occupied, 'Reading exposure and laser off cannot record.');
  }
  await writeFile(out + '/' + content + '.iso', Uint8Array.from(read.recovered.mainData));
  await writeFile(out + '/' + content + '.m2v', read.file.bytes);
  cases.push({ content, file: read.file.entry.name, fileBytes: read.file.bytes.length, channelCells: DVDR_CHANNEL_CELLS,
    runs: program.ends.length, markedCells, frames: read.file.video.frames.length, sectorCount: read.recovered.sectors.length });
  console.log('PASS written material and preserved file:', read.file.entry.name);
}

const program = dvdrWriteProgram(0), completed = dvdrWriteMedium(blank, program).medium;
for (const through of [0, 16, 32, 50, Math.floor(DVDR_CHANNEL_CELLS / 2), DVDR_CHANNEL_CELLS - 1]) {
  const partial = dvdrWriteMedium(blank, program, 'record', through);
  const active = dvdrRunAt(program, through);
  check(partial.status === 'writing' && !partial.medium.occupied, 'Partial pass stays incomplete.');
  check(partial.medium.marks.every((mark, cell) => mark === (cell < active.start ? program.marks[cell] : 0)), 'Only completed runs have changed material.');
  const resumed = dvdrWriteMedium(partial.medium, program);
  check(resumed.medium.marks.every((mark, cell) => mark === completed.marks[cell]), 'Resuming preserves old marks and completes the same recording.');
}
for (const firstSector of [16, 64]) {
  const damaged = { marks: completed.marks.slice(), occupied: true };
  damaged.marks.fill(0, firstSector * DVD_SECTOR_BITS, (firstSector + 16) * DVD_SECTOR_BITS);
  check(!dvdrReadMedium(damaged).file.available, 'Missing metadata or file block must prevent recovered-file output.');
}
for (let type = 0; type < 3; type++) for (const cells of [3, 4, 5, 6, 7, 8, 9, 10, 11, 14]) {
  const run = { start: 100, end: 100 + cells, cells, mark: true, clipped: false }, pulses = dvdrReferencePulses(run, type);
  const top = [[1.55, 1.50, 1.55], [1.50, 1.50, 1.55], [1.25, 1.15, 1.15]][type][cells === 3 ? 0 : cells === 4 ? 1 : 2];
  check(pulses.length === cells - 2 && pulses[0].end === 103, 'One top pulse and one train pulse per later T.');
  check(Math.abs(pulses[0].width - top) < 1e-12, 'Normative top width.');
  for (let n = 0; n < pulses.length; n++) {
    const pulse = pulses[n];
    check(pulse.start > run.start && pulse.end <= run.end && (!n || pulse.start > pulses[n - 1].end), 'Pulses stay inside their run and have cooling gaps.');
    check(Math.abs(pulse.seconds - pulse.width / DVD_CHANNEL_RATE) < 1e-18, 'Physical pulse time follows channel clock.');
    if (n) check(pulse.end === 103 + n && Math.abs(pulse.width - (type === 2 ? .60 : .65)) < 1e-12, 'Repeated pulse occupies the end of each T interval.');
  }
}
check(dvdrReferencePulses({ cells: 8, mark: false }).length === 0 && dvdrReferencePulses({ cells: 8, mark: true, clipped: true }).length === 0, 'No reference pulse is invented for lands or clipped runs.');
for (const value of [-1, 3, 1.2, NaN, '1']) { assert.throws(() => dvdrWriteProgram(value), RangeError); checks++; }
assert.throws(() => dvdrReadMedium(blank, 1), TypeError); checks++;
assert.throws(() => dvdrWriteMedium(blank, program, 'erase'), RangeError); checks++;
assert.throws(() => dvdrWriteMedium(blank, program, 'record', DVDR_CHANNEL_CELLS + 1), RangeError); checks++;
check(!dvdrReadFile(null).available, 'Absent sectors do not produce a file.');
check(dvdrProgramCacheSize() === 3, 'Only the three allowed programs are retained.');
await writeFile(out + '/medium.json', JSON.stringify({ passed: true, checks, cases, knownLimits: ['Ideal completed-run dye change; no thermal model.', 'Finite ISO volume and limited MPEG-2 movie files; no whole-disc finalization or DVD-Video authoring.'] }, null, 2));
console.log('PASS DVD-R material checks:', checks);

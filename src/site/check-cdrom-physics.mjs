import assert from 'node:assert/strict';
import { cdromSettings, cdromPlan, cdromAt, cdromRadius, createCdromController, CDROM_DEFAULTS, CDROM_DOMAINS, CDROM_REFERENCE, CDROM_TIMING } from './cdrom-physics.js';
import { cdromSampleFiles, CDROM_FILES, CDROM_CAPACITY_SECTORS } from './cdrom-files.js';
import { CD_CHANNEL_RATE, CD_FRAME_BITS, CD_CIRC_TAIL } from './cd-codec.js';

let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const same = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const close = (a, b, label) => check(Math.abs(a - b) < 1e-9, label);
const rejects = (run, label) => { assert.throws(run, undefined, label); checks++; };
const source = new Map(cdromSampleFiles().map(file => [file.name, file.bytes]));
let settingsCount = 0;

for (let content = 0; content < 3; content++) for (let location = 0; location < 3; location++) for (let loss = 0; loss < 6; loss++) for (let laser = 0; laser < 2; laser++) {
  const values = { content, location, loss, laser }, plan = cdromPlan(values), end = cdromAt(plan, 10);
  const available = !!laser && loss <= 3;
  same(end.fileReady, available, 'Availability follows actual transport success');
  same(end.complete, true, 'Every finite experiment reaches completion');
  if (available) {
    same(end.file, source.get(CDROM_FILES[content]), 'Displayed file matches bytes recovered for the selected filename');
    same(end.checkedSectors, content === 1 ? 5 : 3, 'Metadata sectors and all file sectors are checked');
    same(end.stats.failedSectors, 0, 'Recoverable read has no failed sectors');
    same(end.output.type, ['text', 'picture', 'data'][content], 'File type drives the visible result');
    if (loss === 1) check(end.stats.c1Repaired > 0, 'C1 profile needs C1 recovery');
    if (loss === 2) check(end.stats.c2Repaired > 0, 'C2 profile needs C2 recovery');
    if (loss === 3) same(end.stats.pRepaired, 48, 'Sector parity profile genuinely repairs post-CIRC loss');
  } else {
    same(end.file, null, 'Failed read exposes no file bytes'); same(end.output, null, 'Failed read exposes no text, picture or plot');
    if (!laser) { same(end.receivedCells, 0, 'Laser off receives no cells'); same(end.checkedSectors, 0, 'Laser off checks no sectors'); same(plan.jobs.length, 1, 'No metadata fallback when volume is unreadable'); }
    else { check(end.stats.failedSectors > 0, 'Loss failure has at least one failed sector'); if (loss === 5) { same(plan.jobs.length, 2, 'Unreadable directory prevents file read'); same(end.entry, null, 'Unreadable directory supplies no hidden file address'); } }
  }
  const times = [0, .0625, 1, 3.99, 4, 4.5, 4.999999, 5, 5.25, 5.5, 6.499999, 6.5, 7, 7.5, 8, 9, 9.499999, 9.5, 10, 100];
  let previousCells = -1, previousChecks = -1;
  for (const time of times) {
    const s = cdromAt(plan, time);
    check(s.receivedCells >= previousCells && s.checkedSectors >= previousChecks, 'Retrieved cells and checked sectors are monotonic'); previousCells = s.receivedCells; previousChecks = s.checkedSectors;
    check(s.spiral.radiusMm >= 25 && s.spiral.radiusMm <= 58, 'All reads and seeks fit the disc annulus');
    check(Number.isFinite(s.spiral.angle) && Number.isFinite(s.spiral.rpm), 'Finite rotation and spindle speed');
    close(s.spiral.rpm * 2 * Math.PI * s.spiral.radiusMm / 1000 / 60, 1.2, 'CLV spindle law holds through displayed positions');
    if (time < 5) { same(s.volume, null, 'No volume before its complete guarded sector'); same(s.directory, null, 'No hidden directory before metadata'); }
    if (time < 6.5) same(s.entry, null, 'No filename-to-extent result before directory read');
    if (time < 9.5) { same(s.file, null, 'File content waits for every required sector'); same(s.output, null, 'Screen cannot reveal a prefetched file early'); }
    if (!laser) same(s.detectorBit, null, 'Laser off supplies no detected bit');
  }
  for (let format = 0; format < 3; format++) for (let depth = 0; depth < 4; depth++) {
    const comparison = cdromPlan({ ...values, format, depth }), s = cdromAt(comparison, 10);
    same(s.file, end.file, 'Optical references cannot alter recovered file bytes');
    same(s.stats, end.stats, 'Optical reference controls cannot alter digital recovery');
    close(comparison.comparison.intensity, (1 + Math.cos(4 * Math.PI / [4, 6, 8, 2][depth])) / 2, 'Equal-wave intensity follows the stated phase relation');
    settingsCount++;
  }
}
same(settingsCount, 1296, 'Every exposed settings combination covered');

const plan = cdromPlan({ content: 1, location: 2 }), initial = cdromAt(plan, 0), complete = cdromAt(plan, 10);
check(complete.spiral.rpm < initial.spiral.rpm, 'Outer file requires fewer rpm than inner metadata');
check(cdromRadius(CDROM_CAPACITY_SECTORS - 1, 2 * 98 * 588) < CDROM_REFERENCE.outer, 'Last sample sector and finite guard fit the nominal annulus');
close(cdromRadius(0) ** 2, .025 ** 2 + 1.6e-6 * 1.2 * 2 / Math.PI, 'Physical placement includes the first-track two-second pause');
for (const [i, job] of plan.jobs.entries()) for (let n = 0; n < job.run.count; n++) {
  const required = ((n + 1) * 98 + CD_CIRC_TAIL) * CD_FRAME_BITS;
  if (job.role === 'volume') continue;
  const time = job.start + required / job.run.channel.bits.length * (job.end - job.start);
  same(cdromAt(plan, time - 1e-7).checkedByJob[i], n, 'Sector waits for final CIRC guard cell');
  same(cdromAt(plan, time).checkedByJob[i], n + 1, 'Sector becomes checkable at exact guarded boundary');
}
close(complete.readSeconds, plan.jobs.reduce((n, job) => n + job.run.channel.bits.length / CD_CHANNEL_RATE, 0), 'Actual channel-time sum excludes illustrative seek durations');

const controller = createCdromController(); controller.advance(1); same(controller.getState().cells, 16, 'Slow period reads sixteen cells per display second');
const before = controller.getState(); controller.update({ format: 2, depth: 3 });
same(controller.getState().time, before.time, 'Reference controls preserve time');
same(controller.getState().receivedCells, before.receivedCells, 'Reference controls preserve retrieval progress');
controller.update({ location: 2 }); same(controller.getState().time, 0, 'Changing stored layout starts a new read');
controller.reset({ values: { loss: 3, content: 1 }, time: 7.5 }); controller.advance(100);
const replay = controller.replayState(); same(replay.time, 7.5, 'Prepared replay preserves its start checkpoint');
controller.reset(replay); same(controller.getState().fileReady, false, 'Replay clears old completed file');
controller.advance(2); check(controller.getState().fileReady, 'Replayed read recovers the file again');
controller.reset(); same(controller.getState().values, CDROM_DEFAULTS, 'Reset restores defaults'); same(controller.getState().receivedCells, 0, 'Reset clears reception');
for (const [key, [min, max, step]] of Object.entries(CDROM_DOMAINS)) {
  for (const value of [min - step, max + step, min + step / 2, NaN, Infinity, '1', null]) rejects(() => cdromSettings({ [key]: value }), 'Invalid control rejected');
}
for (const value of [null, [], 'value', { extra: 1 }]) rejects(() => cdromSettings(value), 'Malformed settings rejected');
for (const value of [-1, NaN, Infinity, '1']) { rejects(() => controller.advance(value), 'Invalid elapsed time rejected'); rejects(() => cdromAt(plan, value), 'Invalid sample time rejected'); }
rejects(() => controller.reset({ time: 11 }), 'Starting beyond duration rejected');
rejects(() => controller.reset({ extra: true }), 'Unknown starting-state field rejected');
same(CDROM_TIMING.duration, 10, 'Declared duration includes final file presentation interval');
console.log(`CD-ROM physics checks passed: ${checks} assertions, ${settingsCount} settings combinations`);

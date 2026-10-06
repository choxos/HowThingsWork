import { validateControls, validTime } from './physics-kit.js';
import { CD_CHANNEL_RATE, CD_FRAME_BITS, CD_CIRC_TAIL } from './cd-codec.js';
import { dvdComparison } from './dvd-physics.js';
import { cdromEncodeRun, cdromReceiveRun, cdromMsf, CDROM_FRAMES_PER_SECTOR } from './cdrom-sector.js';
import { cdromMakeVolume, cdromReadVolume, cdromReadDirectory, cdromCollectFile, cdromOpenFile, CDROM_FILES, CDROM_CAPACITY_SECTORS } from './cdrom-files.js';

export const CDROM_DEFAULTS = Object.freeze({ content: 0, location: 0, loss: 0, laser: 1, format: 0, depth: 0 });
export const CDROM_DOMAINS = Object.freeze({ content: [0, 2, 1], location: [0, 2, 1], loss: [0, 5, 1], laser: [0, 1, 1], format: [0, 2, 1], depth: [0, 3, 1] });
export const CDROM_LOSSES = Object.freeze(['Clean reading', 'C1 repairs four words', 'C2 repairs a short burst', 'Sector parity repairs remaining loss', 'File sector cannot be recovered', 'Directory cannot be recovered']);
export const CDROM_TIMING = Object.freeze({ slowCells: 64, slowEnd: 4, volumeEnd: 5, directoryStart: 5.5, directoryEnd: 6.5, fileStart: 7.5, fileEnd: 9.5, duration: 10 });
export const CDROM_REFERENCE = Object.freeze({ velocity: 1.2, pitch: 1.6e-6, inner: .025, outer: .058, initialPause: 150, channelRate: CD_CHANNEL_RATE, sectorRate: 75 });
export const cdromSettings = (input = {}) => validateControls(input, CDROM_DEFAULTS, CDROM_DOMAINS, 'CD-ROM');
const masterCache = new Map(), runCache = new Map(), readCache = new Map();
const cached = (cache, key, make, limit) => {
  if (cache.has(key)) return cache.get(key);
  const value = make(); cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value);
  return value;
};

export function cdromLossPositions(loss, role = 'file') {
  cdromSettings({ loss });
  if (!['volume', 'directory', 'file'].includes(role)) throw new RangeError('Unknown CD-ROM read role');
  const mode = role === 'file' ? (loss === 5 ? 0 : loss) : role === 'directory' && loss === 5 ? 4 : 0;
  if (mode === 1) return [0, 2, 4, 6].map(symbol => [60, symbol]);
  const frames = mode === 2 ? Array.from({ length: 12 }, (_, i) => 60 + i) :
    mode === 3 ? [0, 7, 14, 21, 27].map(i => 45 + 4 * i) : mode === 4 ? Array.from({ length: 20 }, (_, i) => 60 + i) : [];
  return frames.flatMap(frame => Array.from({ length: 32 }, (_, symbol) => [frame, symbol]));
}

function readJob(master, role, firstLba, count, loss, laser) {
  const key = `${master.location}:${role}:${firstLba}:${count}`;
  const run = cached(runCache, key, () => cdromEncodeRun(Array.from({ length: count }, (_, i) => {
    const bytes = master.sectors.get(firstLba + i);
    if (!bytes) throw new Error('Requested extent is absent from this authored volume');
    return bytes;
  }), firstLba), 12);
  const erasures = cdromLossPositions(loss, role), readKey = `${key}:${loss}:${laser}`;
  const read = cached(readCache, readKey, () => cdromReceiveRun(run, erasures, !!laser), 12);
  const timing = role === 'volume' ? [0, CDROM_TIMING.volumeEnd] : role === 'directory' ? [CDROM_TIMING.directoryStart, CDROM_TIMING.directoryEnd] : [CDROM_TIMING.fileStart, CDROM_TIMING.fileEnd];
  return { role, run, read, erasures, start: timing[0], end: timing[1], seconds: run.channel.bits.length / CD_CHANNEL_RATE };
}

export function cdromPlan(input = {}) {
  const values = cdromSettings(input), master = cached(masterCache, values.location, () => cdromMakeVolume(values.location), 3);
  const jobs = [], volumeJob = readJob(master, 'volume', 16, 1, values.loss, values.laser);
  jobs.push(volumeJob);
  let volume = null, directory = null, entry = null, file = null, output = null, error = null;
  try {
    if (!volumeJob.read.sectors[0].ok) throw new Error('Volume descriptor sector failed checks.');
    volume = cdromReadVolume(volumeJob.read.sectors[0].data);
    const directoryJob = readJob(master, 'directory', volume.root.extent, volume.root.sectorCount, values.loss, values.laser); jobs.push(directoryJob);
    if (!directoryJob.read.sectors.every(x => x.ok)) throw new Error('Directory sector failed checks; file locations are unavailable.');
    directory = cdromReadDirectory(directoryJob.read.sectors[0].data, volume);
    entry = directory.find(x => x.name === CDROM_FILES[values.content]);
    if (!entry) throw new Error('Requested file is absent from the recovered directory.');
    const fileJob = readJob(master, 'file', entry.extent, entry.sectorCount, values.loss, values.laser); jobs.push(fileJob);
    file = cdromCollectFile(entry, fileJob.read.sectors.map(x => x.data));
    if (!file) throw new Error('File sector failed checks; incomplete file stays unavailable.');
    output = cdromOpenFile(entry.name, file);
  } catch (failure) { error = failure.message; }
  return { values, jobs, volume, directory, entry, file, output, error, comparison: dvdComparison(values.format, values.depth), duration: CDROM_TIMING.duration };
}

export function cdromRadius(lba, cells = 0) {
  cdromMsf(lba); validTime(cells);
  const f = CDROM_REFERENCE;
  // The first digital track begins with a two-second pause (clause 20.2).
  return Math.sqrt(f.inner ** 2 + f.pitch * f.velocity * ((lba + f.initialPause) / 75 + cells / CD_CHANNEL_RATE) / Math.PI);
}

function jobCells(job, time) {
  const total = job.run.channel.bits.length;
  const fraction = Math.max(0, Math.min(1, (time - job.start) / (job.end - job.start)));
  if (job.role !== 'volume') return Math.min(total, Math.floor(total * fraction + 1e-7));
  const count = time <= CDROM_TIMING.slowEnd ? CDROM_TIMING.slowCells * time / CDROM_TIMING.slowEnd :
    CDROM_TIMING.slowCells + (total - CDROM_TIMING.slowCells) * Math.min(1, (time - CDROM_TIMING.slowEnd) / (job.end - CDROM_TIMING.slowEnd));
  return Math.min(total, Math.floor(count + 1e-7));
}

export function cdromAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), v = plan.values, jobs = plan.jobs;
  const checkedByJob = [], stats = { erased: 0, c1Repaired: 0, c2Repaired: 0, pRepaired: 0, qRepaired: 0, missing: 0, failedSectors: 0 };
  let receivedCells = 0, checkedSectors = 0, checkedBytes = 0, activeIndex = 0, angle = 0, readSeconds = 0;
  for (let j = 0; j < jobs.length; j++) {
    const job = jobs[j], cells = jobCells(job, t), frames = Math.floor(cells / CD_FRAME_BITS);
    const received = v.laser ? cells : 0;
    receivedCells += received; readSeconds += cells / CD_CHANNEL_RATE;
    const count = v.laser ? Math.max(0, Math.min(job.run.count, Math.floor((frames - CD_CIRC_TAIL) / CDROM_FRAMES_PER_SECTOR))) : 0;
    checkedByJob.push(count); checkedSectors += count;
    stats.erased += job.erasures.filter(([frame, symbol]) => received >= frame * CD_FRAME_BITS + 44 + 17 * symbol + 14).length;
    const c1Count = Math.max(0, Math.min(job.read.circ.events.c1.length, Math.floor(received / CD_FRAME_BITS) - 1));
    const c2Count = Math.max(0, Math.min(job.read.circ.events.c2.length, Math.floor(received / CD_FRAME_BITS) - 109));
    for (let n = 0; n < c1Count; n++) stats.c1Repaired += job.read.circ.events.c1[n].repaired;
    for (let n = 0; n < c2Count; n++) stats.c2Repaired += job.read.circ.events.c2[n].repaired;
    for (let n = 0; n < count; n++) {
      const sector = job.read.sectors[n];
      stats.pRepaired += sector.pRepaired; stats.qRepaired += sector.qRepaired; stats.missing += sector.missing; stats.failedSectors += Number(!sector.ok); checkedBytes += sector.ok ? 2048 : 0;
    }
    angle += (cdromRadius(job.run.firstLba, cells) - cdromRadius(job.run.firstLba)) / CDROM_REFERENCE.pitch * 2 * Math.PI;
    if (t >= job.start) activeIndex = j;
  }
  const active = jobs[activeIndex], cells = jobCells(active, t), localReceived = v.laser ? cells : 0;
  const next = jobs[activeIndex + 1], seeking = !!next && t >= active.end && t < next.start;
  const seekFraction = seeking ? (t - active.end) / (next.start - active.end) : 0;
  const startRadius = cdromRadius(active.run.firstLba), readRadius = cdromRadius(active.run.firstLba, cells);
  const radius = seeking ? readRadius + (cdromRadius(next.run.firstLba) - readRadius) * seekFraction : readRadius;
  const volumeReady = !!plan.volume && t >= CDROM_TIMING.volumeEnd, directoryReady = !!plan.directory && t >= CDROM_TIMING.directoryEnd;
  const fileReady = !!plan.file && t >= CDROM_TIMING.fileEnd, output = fileReady ? plan.output : null;
  const errorReady = !!plan.error && t >= jobs.at(-1).end, complete = t === plan.duration;
  const role = seeking ? `seek-${next.role}` : active.role;
  const reading = t >= active.start && t < active.end, stopped = t >= jobs.at(-1).end;
  const status = !v.laser ? 'Laser off: no sectors or files can be retrieved.' : t === 0 ? 'Read the volume, find the directory, then open the stored file.' :
    errorReady ? plan.error : fileReady ? `${plan.entry.name.replace(';1', '')}: ${plan.entry.size.toLocaleString('en-US')} bytes available${stats.erased ? ' after parity repair' : ''}.` :
    seeking ? `Move the pickup to the ${next.role === 'file' ? 'file extent found in the directory' : 'root directory found in the volume descriptor'}.` :
    role === 'volume' ? `${localReceived.toLocaleString('en-US')} cells read; locate the volume descriptor at sector 16.` :
    role === 'directory' ? 'Read the directory to recover file names, locations and lengths.' : `${checkedByJob[activeIndex]} of ${active.run.count} file sectors checked; wait for the complete file.`;
  return { time: t, duration: plan.duration, values: { ...v }, complete, reading, seeking, stopped, activeIndex, role, cells, localReceived, receivedCells, checkedSectors, checkedBytes, checkedByJob, stats,
    volumeReady, directoryReady, fileReady, volume: volumeReady ? plan.volume : null, directory: directoryReady ? plan.directory : null, entry: directoryReady ? plan.entry : null,
    file: fileReady ? plan.file : null, output, status, readSeconds, error: errorReady ? plan.error : null,
    currentLba: active.run.firstLba + Math.min(active.run.count - 1, Math.floor(Math.max(0, localReceived / CD_FRAME_BITS - CD_CIRC_TAIL) / CDROM_FRAMES_PER_SECTOR)),
    detectorBit: localReceived && reading ? active.read.received[localReceived - 1] : null,
    detectorLevel: localReceived && reading ? active.run.levels[localReceived - 1] : null,
    spiral: { radiusMm: radius * 1000, startMm: startRadius * 1000, travelMicrometers: (readRadius - startRadius) * 1e6, turns: (readRadius - startRadius) / CDROM_REFERENCE.pitch, angle,
      rpm: 60 * CDROM_REFERENCE.velocity / (2 * Math.PI * radius), innerRpm: 60 * CDROM_REFERENCE.velocity / (2 * Math.PI * CDROM_REFERENCE.inner), outerRpm: 60 * CDROM_REFERENCE.velocity / (2 * Math.PI * cdromRadius(CDROM_CAPACITY_SECTORS - 1)) },
  };
}

export function createCdromController(initial = {}) {
  let plan, time, start;
  function reset(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['values', 'time'].includes(k))) throw new TypeError('Expected CD-ROM starting state');
    const next = cdromPlan(input.values ?? {}), at = validTime(input.time ?? 0);
    if (at > next.duration) throw new RangeError('Starting time exceeds CD-ROM experiment');
    plan = next; time = at; start = { values: { ...next.values }, time: at }; return cdromAt(plan, time);
  }
  reset(initial);
  return { reset, getPlan: () => plan, getState: () => cdromAt(plan, time), replayState: () => ({ values: { ...start.values }, time: start.time }),
    update(input = {}) {
      const values = validateControls(input, plan.values, CDROM_DOMAINS, 'CD-ROM');
      const changed = Object.keys(values).some(key => !['format', 'depth'].includes(key) && values[key] !== plan.values[key]);
      plan = cdromPlan(values);
      if (changed) { time = 0; start = { values: { ...values }, time: 0 }; } else { start.values.format = values.format; start.values.depth = values.depth; }
      return cdromAt(plan, time);
    },
    advance(seconds) { validTime(seconds); time = Math.min(plan.duration, Number((time + seconds).toFixed(12))); return cdromAt(plan, time); },
  };
}

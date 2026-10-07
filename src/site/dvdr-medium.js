import { dvdrMakeVolume, dvdrReadFile, DVDR_VOLUME_SECTORS } from './dvdr-files.js';
import { dvdEncodeSectors, dvdDecodeSectors, dvdEfmEncode, dvdEfmDecode, dvdDetectTransitions, DVD_FIRST_SECTOR, DVD_SECTOR_BITS, DVD_CHANNEL_RATE } from './dvd-codec.js';

export const DVDR_CHANNEL_CELLS = DVDR_VOLUME_SECTORS * DVD_SECTOR_BITS + 32;
const programs = new Map();

function checkMedium(medium) {
  if (!medium || !(medium.marks instanceof Uint8Array) || medium.marks.length !== DVDR_CHANNEL_CELLS || medium.marks.some(mark => mark > 1) || typeof medium.occupied !== 'boolean') throw new TypeError('Expected a binary DVD-R material region');
}

export function dvdrWriteProgram(content = 0) {
  if (!Number.isInteger(content) || content < 0 || content > 2) throw new RangeError('Unknown DVD-R file');
  if (programs.has(content)) return programs.get(content);
  const volume = dvdrMakeVolume(content), recording = dvdEncodeSectors(volume.bytes, DVD_FIRST_SECTOR), channel = dvdEfmEncode(recording);
  const marks = new Uint8Array(channel.bits.length), ends = [];
  let level = 1;
  for (let cell = 0; cell < channel.bits.length; cell++) {
    if (channel.bits[cell]) level = -level;
    marks[cell] = Number(level < 0);
    if (cell && marks[cell] !== marks[cell - 1]) ends.push(cell);
  }
  ends.push(marks.length);
  const program = { content, volume, recording, channel, marks, ends: Uint32Array.from(ends) };
  programs.set(content, program);
  return program;
}

export function dvdrBlankMedium() {
  return { marks: new Uint8Array(DVDR_CHANNEL_CELLS), occupied: false };
}

export function dvdrRunAt(program, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= DVDR_CHANNEL_CELLS) throw new RangeError('DVD-R channel cell');
  let low = 0, high = program.ends.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (program.ends[middle] <= cell) low = middle + 1; else high = middle;
  }
  const start = low ? program.ends[low - 1] : 0, end = program.ends[low];
  return { index: low, start, end, cells: end - start, mark: !!program.marks[start], clipped: low === 0 || low === program.ends.length - 1 };
}

export function dvdrWriteMedium(medium, program, power = 'record', through = DVDR_CHANNEL_CELLS) {
  checkMedium(medium);
  if (!program || !(program.marks instanceof Uint8Array) || program.marks.length !== DVDR_CHANNEL_CELLS || !(program.ends instanceof Uint32Array)) throw new TypeError('Expected a DVD-R recording program');
  if (!['record', 'read', 'off'].includes(power)) throw new RangeError('DVD-R writing exposure');
  if (!Number.isInteger(through) || through < 0 || through > DVDR_CHANNEL_CELLS) throw new RangeError('DVD-R write progress');
  if (medium.occupied) return { medium, status: 'occupied', addedMarks: 0, visited: 0 };
  if (power !== 'record') return { medium, status: power === 'read' ? 'read-power' : 'laser-off', addedMarks: 0, visited: through };
  // Completed mark runs are the ideal material boundary. No chemical or heat solver.
  const marks = medium.marks.slice();
  const run = through < DVDR_CHANNEL_CELLS ? dvdrRunAt(program, through) : null;
  const committed = run ? run.start : DVDR_CHANNEL_CELLS;
  let addedMarks = 0;
  for (let cell = 0; cell < committed; cell++) if (program.marks[cell] && !marks[cell]) { marks[cell] = 1; addedMarks++; }
  return { medium: { marks, occupied: through === DVDR_CHANNEL_CELLS }, status: through === DVDR_CHANNEL_CELLS ? 'recorded' : 'writing', addedMarks, visited: through };
}

export function dvdrReadMedium(medium, readingLight = true) {
  checkMedium(medium);
  if (typeof readingLight !== 'boolean') throw new TypeError('DVD-R reading light must be boolean');
  const levels = Int8Array.from(medium.marks, mark => readingLight ? mark ? -1 : 1 : 0);
  const bits = dvdDetectTransitions(levels), efm = dvdEfmDecode(bits), recovered = dvdDecodeSectors(efm.recording);
  // Neither the source file, requested content nor occupancy supplies decoded data.
  return { levels, bits, efm, recovered, file: dvdrReadFile(recovered) };
}

export function dvdrReferencePulses(run, type = 0) {
  if (!Number.isInteger(type) || type < 0 || type > 2) throw new RangeError('DVD-R reference pulse type');
  if (!run?.mark || run.clipped || !Number.isInteger(run.cells) || !(run.cells >= 3 && run.cells <= 11 || run.cells === 14)) return [];
  const widths = [[1.55, 1.50, 1.55], [1.50, 1.50, 1.55], [1.25, 1.15, 1.15]][type];
  const top = widths[run.cells === 3 ? 0 : run.cells === 4 ? 1 : 2], repeated = type === 2 ? .60 : .65;
  const pulses = [{ start: run.start + 3 - top, end: run.start + 3, kind: 'top' }];
  for (let end = 4; end <= run.cells; end++) pulses.push({ start: run.start + end - repeated, end: run.start + end, kind: 'train' });
  return pulses.map(pulse => ({ ...pulse, width: pulse.end - pulse.start, seconds: (pulse.end - pulse.start) / DVD_CHANNEL_RATE, relativePower: 1 }));
}

export const dvdrProgramCacheSize = () => programs.size;

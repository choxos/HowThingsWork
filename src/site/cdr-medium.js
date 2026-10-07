import { CD_CHANNEL_RATE, CD_CIRC_TAIL, CD_FRAME_BITS, cdDetectTransitions, cdEfmDecode, cdCircDecode } from './cd-codec.js';
import { CD_EFM_WORDS } from './cd-efm-table.js';
import { CDROM_FRAMES_PER_SECTOR, CDROM_SECTOR_BYTES, CDROM_USER_BYTES, cdromEncodeRun, cdromReadSector, cdromScramble } from './cdrom-sector.js';

// ECMA-394:2010 and ECMA-130:1996. The medium stores irreversible marks in a
// finite, guarded Mode 1 sector example. Material heating and analog readout
// are idealized; this is not a complete physical disc or recording strategy.
export const CDR_LBA = 100;
export const CDR_CHANNEL_CELLS = (CDROM_FRAMES_PER_SECTOR + CD_CIRC_TAIL) * CD_FRAME_BITS;
export const CDR_WRITE_RATE = 4 * CD_CHANNEL_RATE;
export const CDR_BYTE_TRACE = Object.freeze({ sectorByte: 16, inputFrame: 0, inputPosition: 17, c2Frame: 2, c2Position: 5, channelFrame: 22, channelSymbol: 5, firstCell: 13065 });
const programs = new Map();

function checkByte(byte) {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new RangeError('Expected one eight-bit byte');
}

function checkMedium(medium) {
  if (!(medium?.marks instanceof Uint8Array) || medium.marks.length !== CDR_CHANNEL_CELLS || medium.marks.some(x => x !== 0 && x !== 1) || typeof medium.occupied !== 'boolean') {
    throw new TypeError('Expected a CD-R medium with binary marks and an occupancy state');
  }
}

export function cdrBits(byte) {
  checkByte(byte); return byte.toString(2).padStart(8, '0');
}

export function cdrWriteProgram(byte) {
  checkByte(byte);
  if (programs.has(byte)) return programs.get(byte);
  const payload = new Uint8Array(CDROM_USER_BYTES); payload[0] = byte;
  const run = cdromEncodeRun([payload], CDR_LBA), marks = Uint8Array.from(run.levels, level => Number(level < 0));
  const runs = [];
  for (let start = 0; start < marks.length;) {
    let end = start + 1;
    while (end < marks.length && marks[end] === marks[start]) end++;
    runs.push({ start, end, cells: end - start, mark: Boolean(marks[start]), clipped: start === 0 || end === marks.length });
    start = end;
  }
  const value = cdromScramble(run.sectors[0])[CDR_BYTE_TRACE.sectorByte];
  const program = { byte, inputBits: cdrBits(byte), run, marks, runs, trace: { ...CDR_BYTE_TRACE, scrambledByte: value, word: CD_EFM_WORDS[value] } };
  programs.set(byte, program);
  if (programs.size > 8) programs.delete(programs.keys().next().value);
  return program;
}

export function cdrBlankMedium() {
  return { marks: new Uint8Array(CDR_CHANNEL_CELLS), occupied: false };
}

// Only a matched recording exposure commits a complete mark. The simulation
// treats successful mark formation as an ideal material boundary, without
// inventing a universal dye temperature or laser-power threshold.
export function cdrWriteMedium(medium, program, power = 'record', through = CDR_CHANNEL_CELLS) {
  checkMedium(medium);
  if (!program || program.marks?.length !== CDR_CHANNEL_CELLS || !Array.isArray(program.runs)) throw new TypeError('Expected a CD-R write program');
  if (!['record', 'read', 'off'].includes(power)) throw new RangeError('Unknown CD-R writing power');
  if (!Number.isInteger(through) || through < 0 || through > CDR_CHANNEL_CELLS) throw new RangeError('CD-R writing position outside the excerpt');
  if (medium.occupied) return { medium, status: 'occupied', addedMarks: 0, visited: 0 };
  if (power !== 'record') return { medium, status: power === 'read' ? 'read-power' : 'laser-off', addedMarks: 0, visited: through };
  const marks = medium.marks.slice(); let addedMarks = 0;
  for (const run of program.runs) {
    if (run.end > through) break;
    if (run.mark) for (let i = run.start; i < run.end; i++) {
      if (!marks[i]) { marks[i] = 1; addedMarks++; }
    }
  }
  return { medium: { marks, occupied: through === CDR_CHANNEL_CELLS }, status: through === CDR_CHANNEL_CELLS ? 'recorded' : 'writing', addedMarks, visited: through };
}

// The receiver gets stored marks only. No requested byte, source sector or
// encoder output is available at this boundary.
export function cdrReadMedium(medium, light = true) {
  checkMedium(medium);
  if (typeof light !== 'boolean') throw new TypeError('Expected CD-R read-light state');
  const levels = Int8Array.from(medium.marks, mark => mark ? -1 : 1);
  const bits = light ? cdDetectTransitions(levels) : new Uint8Array(CDR_CHANNEL_CELLS);
  const efm = cdEfmDecode(bits), circ = cdCircDecode(efm.frames);
  const scrambled = Int16Array.from({ length: CDROM_SECTOR_BYTES }, (_, j) => circ.frames[Math.floor(j / 24)][(j % 24) ^ 1]);
  const sector = cdromReadSector(cdromScramble(scrambled), CDR_LBA);
  return { levels, bits, efm, circ, sector, available: sector.ok, byte: sector.ok ? sector.data[0] : null };
}

// This is the standard's 4x media-test pulse shape, shown as a reference.
// Relative heights avoid presenting an illustrative power as a drive rating.
export function cdrReferencePulse(run, previous) {
  if (!run?.mark || run.clipped || run.cells < 3 || run.cells > 11) return null;
  const shortening = 0.5 + (previous?.cells === 3 ? 1 / 16 : 0);
  return { start: run.start + shortening, end: run.end, widthCells: run.cells - shortening, relativePower: run.cells === 3 ? 1.04 : 1, physicalSeconds: (run.cells - shortening) / CDR_WRITE_RATE };
}

export function cdrMediumCacheSize() {
  return programs.size;
}

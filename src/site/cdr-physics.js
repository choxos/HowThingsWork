import { validateControls, validTime, clamp } from './physics-kit.js';
import { CD_CHANNEL_RATE } from './cd-codec.js';
import { cdromRadius } from './cdrom-physics.js';
import { CDR_LBA, CDR_CHANNEL_CELLS, CDR_WRITE_RATE, CDR_BYTE_TRACE, cdrBits, cdrBlankMedium, cdrWriteProgram, cdrWriteMedium, cdrReadMedium, cdrReferencePulse } from './cdr-medium.js';

export const CDR_DEFAULTS = Object.freeze({ high: 10, low: 5, medium: 0, power: 0, readLight: 1 });
export const CDR_DOMAINS = Object.freeze({ high: [0, 15, 1], low: [0, 15, 1], medium: [0, 2, 1], power: [0, 2, 1], readLight: [0, 1, 1] });
export const CDR_MEDIA = Object.freeze(['Blank region', 'Region already stores 01010101', 'Region already stores 10101010']);
export const CDR_POWER = Object.freeze(['Matched recording exposure', 'Reading light only', 'Laser off']);
export const CDR_TIMING = Object.freeze({ windowStart: 13052, windowEnd: 13092, writeEnd: 5, readStart: 6, duration: 11 });
export const cdrSettings = (input = {}) => validateControls(input, CDR_DEFAULTS, CDR_DOMAINS, 'CD-R');
const blank = cdrBlankMedium(), prepared = new Map(), written = new Map(), reads = new WeakMap(), metadata = new WeakMap();

function remember(cache, key, make, limit) {
  if (cache.has(key)) return cache.get(key);
  const result = make(); cache.set(key, result);
  if (cache.size > limit) cache.delete(cache.keys().next().value);
  return result;
}

function readStored(medium, light) {
  if (!reads.has(medium)) reads.set(medium, new Map());
  return remember(reads.get(medium), light, () => cdrReadMedium(medium, light), 2);
}

function programMetadata(program) {
  if (!metadata.has(program)) {
    let marks = 0;
    metadata.set(program, program.runs.map(run => { marks += run.mark ? run.cells : 0; return marks; }));
  }
  return metadata.get(program);
}

export function cdrPlan(input = {}) {
  const values = cdrSettings(input), byte = values.high * 16 + values.low, program = cdrWriteProgram(byte);
  const initial = values.medium === 0 ? blank : remember(prepared, values.medium, () => cdrWriteMedium(blank, cdrWriteProgram(values.medium === 1 ? 85 : 170)).medium, 2);
  const canWrite = !initial.occupied && values.power === 0;
  const final = canWrite ? remember(written, byte, () => cdrWriteMedium(initial, program).medium, 8) : initial;
  const read = readStored(final, Boolean(values.readLight));
  const prefix = programMetadata(program), initialMarks = initial.marks.reduce((a, b) => a + b, 0);
  return { values, byte, program, initial, final, read, prefix, initialMarks, canWrite, duration: CDR_TIMING.duration };
}

// Each pass slows down the real word carrying the selected input byte. The
// surrounding channel cells and finite CIRC tail are traversed faster on screen.
export function cdrPassPosition(seconds) {
  validTime(seconds);
  const { windowStart, windowEnd } = CDR_TIMING;
  return seconds <= 1 ? windowStart * seconds : seconds <= 4 ? windowStart + (windowEnd - windowStart) * (seconds - 1) / 3 :
    windowEnd + (CDR_CHANNEL_CELLS - windowEnd) * clamp(seconds - 4);
}

function completedRuns(runs, through) {
  let lo = 0, hi = runs.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (runs[mid].end <= through) lo = mid + 1; else hi = mid; }
  return lo;
}

export function cdrStoredMark(plan, state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= CDR_CHANNEL_CELLS) throw new RangeError('CD-R mark index outside the excerpt');
  return plan.initial.marks[index] || Number(plan.canWrite && index < state.committedThrough && plan.program.marks[index]);
}

export function cdrAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), v = plan.values, timing = CDR_TIMING;
  const writing = t < timing.writeEnd, seeking = t >= timing.writeEnd && t < timing.readStart, reading = t >= timing.readStart && t < plan.duration, complete = t === plan.duration;
  const writePosition = cdrPassPosition(Math.min(t, timing.writeEnd)), readPosition = cdrPassPosition(Math.max(0, t - timing.readStart));
  const writeCells = Math.min(CDR_CHANNEL_CELLS, Math.floor(writePosition + 1e-7)), readCells = Math.min(CDR_CHANNEL_CELLS, Math.floor(readPosition + 1e-7));
  const done = completedRuns(plan.program.runs, writeCells), committedThrough = plan.canWrite && done ? plan.program.runs[done - 1].end : 0;
  const addedMarks = plan.canWrite && done ? plan.prefix[done - 1] : 0, storedMarks = plan.initialMarks + addedMarks;
  const nominal = writing ? plan.program.runs[done] : null, pulse = nominal ? cdrReferencePulse(nominal, plan.program.runs[done - 1]) : null;
  const exposing = Boolean(plan.canWrite && writing && nominal?.mark && (pulse ? writePosition >= pulse.start && writePosition < pulse.end : true));
  const light = writing ? !plan.initial.occupied && v.power !== 2 : reading && Boolean(v.readLight);
  const position = writing ? writePosition : reading || complete ? readPosition : CDR_CHANNEL_CELLS;
  const readReceived = v.readLight ? readCells : 0, available = complete && plan.read.available;
  const outputByte = available ? plan.read.byte : null, outputBits = available ? cdrBits(outputByte) : null;
  const receivedWord = readReceived >= CDR_BYTE_TRACE.firstCell + 14 ? Array.from(plan.read.bits.subarray(CDR_BYTE_TRACE.firstCell, CDR_BYTE_TRACE.firstCell + 14)).join('') : null;
  const decodedWordByte = receivedWord === null ? null : plan.read.efm.frames[CDR_BYTE_TRACE.channelFrame][CDR_BYTE_TRACE.channelSymbol];
  const initialRadius = cdromRadius(CDR_LBA), endRadius = cdromRadius(CDR_LBA, CDR_CHANNEL_CELLS);
  const radius = seeking ? endRadius + (initialRadius - endRadius) * (t - timing.writeEnd) / (timing.readStart - timing.writeEnd) : cdromRadius(CDR_LBA, position);
  const passAngle = cells => { const r = cdromRadius(CDR_LBA, cells); return 2 * (cells * 1.2 / CD_CHANNEL_RATE) / (initialRadius + r); };
  const angle = passAngle(writePosition) + passAngle(readPosition), velocity = writing ? 4.8 : reading ? 1.2 : 0;
  const blocked = plan.initial.occupied ? 'This region is already recorded. The writer blocks replacement; unused disc space could still be recorded.' :
    v.power === 1 ? 'Reading light does not change the dye. This blank region stays blank.' : v.power === 2 ? 'Writing laser off. No new marks form.' : null;
  const status = complete ? available ? plan.initial.occupied ? `Read back the existing ${outputBits}. Recording cannot replace this region.` : `Read back ${outputBits}. Stored marks supplied the checked byte.` :
    !v.readLight ? `Read light off: no byte recovered. ${storedMarks ? 'Stored marks remain.' : 'The region is still blank.'}` : 'No valid sector recovered. The region was never recorded.' :
    seeking ? v.readLight ? 'Writing pass finished. Move back to read the same region with low-power light.' : 'Writing pass finished. Return to the same region; read light will stay off.' :
      reading ? v.readLight ? `${readReceived.toLocaleString('en-US')} channel cells received. Wait for the full sector checks.` : 'Read light off: scanning without received transitions. The dye stays unchanged.' : blocked || `Recording ${plan.program.inputBits}: ${addedMarks.toLocaleString('en-US')} marked cells formed.`;
  const state = { time: t, duration: plan.duration, values: { ...v }, writing, seeking, reading, complete, phase: writing ? 'write' : seeking ? 'return' : reading ? 'read' : 'result',
    writePosition, readPosition, position, writeCells, readCells, readReceived, committedThrough, addedMarks, storedMarks,
    canWrite: plan.canWrite, light, exposing, pulse, blocked, inputByte: plan.byte, inputBits: plan.program.inputBits,
    available, outputByte, outputBits, receivedWord, decodedWordByte, status,
    writeSeconds: writeCells / CDR_WRITE_RATE, readSeconds: readCells / CD_CHANNEL_RATE,
    spiral: { radiusMm: radius * 1000, angle, rpm: velocity * 60 / (2 * Math.PI * radius), velocity, travelMicrometers: (endRadius - initialRadius) * 1e6 },
    detectorBit: reading && readReceived ? plan.read.bits[readReceived - 1] : null,
    detectorMark: reading && readReceived ? plan.final.marks[readReceived - 1] : null,
  };
  state.windowMarks = Array.from({ length: timing.windowEnd - timing.windowStart }, (_, i) => cdrStoredMark(plan, state, timing.windowStart + i));
  state.windowReceived = Array.from({ length: timing.windowEnd - timing.windowStart }, (_, i) => timing.windowStart + i < readReceived ? plan.read.bits[timing.windowStart + i] : null);
  return state;
}

export function createCdrController(initial = {}) {
  let plan, time, start;
  function reset(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['values', 'time'].includes(k))) throw new TypeError('Expected CD-R starting state');
    const next = cdrPlan(input.values ?? {}), at = validTime(input.time ?? 0);
    if (at > next.duration) throw new RangeError('Starting time exceeds CD-R experiment');
    plan = next; time = at; start = { values: { ...next.values }, time: at }; return cdrAt(plan, time);
  }
  reset(initial);
  return { reset, getPlan: () => plan, getState: () => cdrAt(plan, time), replayState: () => ({ values: { ...start.values }, time: start.time }),
    update(input = {}) {
      const values = validateControls(input, plan.values, CDR_DOMAINS, 'CD-R');
      if (Object.keys(values).some(key => values[key] !== plan.values[key])) { plan = cdrPlan(values); time = 0; start = { values: { ...values }, time: 0 }; }
      return cdrAt(plan, time);
    },
    advance(seconds) { validTime(seconds); time = Math.min(plan.duration, Number((time + seconds).toFixed(12))); return cdrAt(plan, time); },
  };
}

export const cdrCacheSizes = () => ({ prepared: prepared.size, written: written.size });

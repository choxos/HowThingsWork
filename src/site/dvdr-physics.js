import { validateControls, validTime, clamp } from './physics-kit.js';
import { DVD_CHANNEL_RATE, DVD_USER_BYTES, DVD_RECORDING_BYTES, DVD_SYNC_BITS } from './dvd-codec.js';
import { DVD_VIDEO_FRAMES, DVD_VIDEO_FPS } from './dvd-video.js';
import { DVDR_FILE_NAMES, DVDR_FILE_LBA } from './dvdr-files.js';
import { DVDR_CHANNEL_CELLS, dvdrBlankMedium, dvdrWriteProgram, dvdrWriteMedium, dvdrReadMedium, dvdrRunAt, dvdrReferencePulses } from './dvdr-medium.js';

export const DVDR_DEFAULTS = Object.freeze({ content: 0, medium: 0, power: 0, readLight: 1, pulseType: 0 });
export const DVDR_DOMAINS = Object.freeze({ content: [0, 2, 1], medium: [0, 3, 1], power: [0, 2, 1], readLight: [0, 1, 1], pulseType: [0, 2, 1] });
export const DVDR_MEDIA = Object.freeze(['Blank region', 'Region already stores BALL.M2V', 'Region already stores ROCKET.M2V', 'Region already stores SUN.M2V']);
export const DVDR_POWER = Object.freeze(['Matched recording exposure', 'Reading light only', 'Laser off']);
export const DVDR_REFERENCE = Object.freeze({ velocity: 3.49, pitch: .74e-6, inner: .024, wavelength: 650, aperture: .60, cover: .6, backing: .6 });
const fileByte = 4132, lba = DVDR_FILE_LBA + Math.floor(fileByte / DVD_USER_BYTES), frameByte = 12 + fileByte % DVD_USER_BYTES;
const recordingByte = lba * DVD_RECORDING_BYTES + Math.floor(frameByte / 172) * 182 + frameByte % 172;
const firstCell = Math.floor(recordingByte / 91) * DVD_SYNC_BITS + 32 + recordingByte % 91 * 16;
export const DVDR_FILE_TRACE = Object.freeze({ fileByte, lba, frameByte, recordingByte, firstCell });
export const DVDR_TIMING = Object.freeze({ windowStart: firstCell - 12, windowEnd: firstCell + 28, writeEnd: 5, readStart: 6, readEnd: 11, movieEnd: 13, duration: 13.25 });
export const dvdrSettings = (input = {}) => validateControls(input, DVDR_DEFAULTS, DVDR_DOMAINS, 'DVD-R');
const blank = dvdrBlankMedium(), recorded = new Map(), reads = new WeakMap(), metadata = new WeakMap();

function programMetadata(program) {
  if (!metadata.has(program)) {
    const prefix = new Uint32Array(program.ends.length);
    let start = 0, count = 0;
    for (let n = 0; n < program.ends.length; n++) {
      if (program.marks[start]) count += program.ends[n] - start;
      prefix[n] = count; start = program.ends[n];
    }
    metadata.set(program, prefix);
  }
  return metadata.get(program);
}

function storedMedium(content) {
  if (!recorded.has(content)) recorded.set(content, dvdrWriteMedium(blank, dvdrWriteProgram(content)).medium);
  return recorded.get(content);
}

function readStored(medium, light) {
  if (!reads.has(medium)) reads.set(medium, new Map());
  const cache = reads.get(medium);
  if (!cache.has(light)) cache.set(light, dvdrReadMedium(medium, light));
  return cache.get(light);
}

export function dvdrPlan(input = {}) {
  const values = dvdrSettings(input), program = dvdrWriteProgram(values.content);
  const initial = values.medium ? storedMedium(values.medium - 1) : blank;
  const canWrite = !initial.occupied && values.power === 0, final = canWrite ? storedMedium(values.content) : initial;
  const read = readStored(final, Boolean(values.readLight)), prefix = programMetadata(program);
  const initialMarks = values.medium ? programMetadata(dvdrWriteProgram(values.medium - 1)).at(-1) : 0;
  return { values, program, initial, final, canWrite, read, prefix, initialMarks, duration: DVDR_TIMING.duration };
}

export function dvdrPassPosition(seconds) {
  validTime(seconds);
  const { windowStart, windowEnd } = DVDR_TIMING;
  return seconds <= 1 ? windowStart * seconds : seconds <= 4 ? windowStart + (windowEnd - windowStart) * (seconds - 1) / 3 :
    windowEnd + (DVDR_CHANNEL_CELLS - windowEnd) * clamp(seconds - 4);
}

export function dvdrStoredMark(plan, state, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= DVDR_CHANNEL_CELLS) throw new RangeError('DVD-R material cell outside the excerpt');
  return plan.initial.marks[cell] || Number(plan.canWrite && cell < state.committedThrough && plan.program.marks[cell]);
}

export function dvdrAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), v = plan.values, timing = DVDR_TIMING, f = DVDR_REFERENCE;
  const writing = t < timing.writeEnd, seeking = t >= timing.writeEnd && t < timing.readStart;
  const reading = t >= timing.readStart && t < timing.readEnd, playing = t >= timing.readEnd && t < timing.movieEnd, complete = t === plan.duration;
  const writePosition = dvdrPassPosition(Math.min(t, timing.writeEnd)), readPosition = dvdrPassPosition(Math.max(0, t - timing.readStart));
  const writeCells = Math.min(DVDR_CHANNEL_CELLS, Math.floor(writePosition + 1e-7)), readCells = Math.min(DVDR_CHANNEL_CELLS, Math.floor(readPosition + 1e-7));
  const nominal = writeCells < DVDR_CHANNEL_CELLS ? dvdrRunAt(plan.program, writeCells) : null;
  const done = nominal ? nominal.index : plan.program.ends.length;
  const committedThrough = plan.canWrite && done ? plan.program.ends[done - 1] : 0;
  const addedMarks = plan.canWrite && done ? plan.prefix[done - 1] : 0, storedMarks = plan.initialMarks + addedMarks;
  const pulses = nominal && writing ? dvdrReferencePulses(nominal, v.pulseType) : [];
  const exposing = Boolean(plan.canWrite && writing && nominal?.mark && (nominal.clipped || pulses.some(pulse => writePosition >= pulse.start && writePosition < pulse.end)));
  const light = writing ? !plan.initial.occupied && v.power !== 2 : reading && Boolean(v.readLight);
  const readReceived = v.readLight ? readCells : 0, readComplete = readReceived === DVDR_CHANNEL_CELLS;
  const available = t >= timing.readEnd && readComplete && plan.read.file.available;
  const entry = available ? plan.read.file.entry : null, movieTime = Math.max(0, Math.min(2, t - timing.readEnd));
  const frameIndex = Math.min(DVD_VIDEO_FRAMES - 1, Math.floor(movieTime * DVD_VIDEO_FPS + 1e-8));
  const picture = available ? plan.read.file.video.frames[frameIndex] : null;
  const receivedWord = readReceived >= firstCell + 16 ? Array.from(plan.read.bits.subarray(firstCell, firstCell + 16)).map(bit => bit < 0 ? '?' : bit).join('') : null;
  const decodedWordByte = readReceived >= firstCell + 32 ? plan.read.efm.recording[recordingByte] : null;
  const radiusAt = cells => Math.sqrt(f.inner ** 2 + f.pitch * cells * f.velocity / DVD_CHANNEL_RATE / Math.PI);
  const endRadius = radiusAt(DVDR_CHANNEL_CELLS), position = writing ? writePosition : t >= timing.readStart ? readPosition : DVDR_CHANNEL_CELLS;
  const radius = seeking ? endRadius + (f.inner - endRadius) * (t - timing.writeEnd) : radiusAt(position);
  const angleAt = cells => 2 * (cells * f.velocity / DVD_CHANNEL_RATE) / (f.inner + radiusAt(cells));
  const velocity = writing || reading ? f.velocity : 0;
  const blocked = plan.initial.occupied ? 'This region already holds a file. The writer refuses replacement; unused disc space could still be recorded.' :
    v.power === 1 ? 'Reading light leaves the dye unchanged. No file is recorded.' : v.power === 2 ? 'Writing laser off. No new marks form.' : null;
  const requestedName = DVDR_FILE_NAMES[v.content].replace(';1', ''), storedName = entry?.name.replace(';1', '') ?? null;
  const status = t >= timing.readEnd ? available ? `${playing ? 'Playing' : 'Recovered'} ${storedName} from recorded marks${plan.initial.occupied ? '; the existing file was preserved' : ''}.` :
    !v.readLight ? `Reading light off: no file recovered. ${storedMarks ? 'Recorded marks remain.' : 'The region is blank.'}` : 'No file recovered. Required directory or file sectors did not validate.' :
    seeking ? 'Writing pass finished. Return to the same region for readback.' :
    reading ? v.readLight ? `${readReceived.toLocaleString('en-US')} channel cells received. Directory and file checks must finish before playback.` : 'Scanning with reading light off. No transitions reach the decoder.' :
    blocked || `Recording ${requestedName}: ${addedMarks.toLocaleString('en-US')} marked cells formed.`;
  const state = { time: t, duration: plan.duration, values: { ...v }, writing, seeking, reading, playing, complete,
    phase: writing ? 'write' : seeking ? 'return' : reading ? 'read' : playing ? 'play' : 'result',
    writePosition, readPosition, position, writeCells, readCells, readReceived, readComplete, committedThrough, addedMarks, storedMarks,
    canWrite: plan.canWrite, light, exposing, pulses, blocked, requestedName, storedName, available, entry, movieTime, frameIndex, picture,
    receivedWord, decodedWordByte, status, writeSeconds: writeCells / DVD_CHANNEL_RATE, readSeconds: readCells / DVD_CHANNEL_RATE,
    spiral: { radiusMm: radius * 1000, angle: angleAt(writePosition) + angleAt(readPosition), rpm: velocity * 60 / (2 * Math.PI * radius), velocity, travelMicrometers: (endRadius - f.inner) * 1e6 },
    detectorBit: reading && readReceived ? plan.read.bits[readReceived - 1] : null,
    detectorMark: reading && readReceived ? plan.final.marks[readReceived - 1] : null };
  state.windowMarks = Array.from({ length: timing.windowEnd - timing.windowStart }, (_, n) => dvdrStoredMark(plan, state, timing.windowStart + n));
  state.windowReceived = Array.from({ length: timing.windowEnd - timing.windowStart }, (_, n) => timing.windowStart + n < readReceived ? plan.read.bits[timing.windowStart + n] : null);
  return state;
}

export function createDvdrController(initial = {}) {
  let plan, time, start;
  function reset(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['values', 'time'].includes(key))) throw new TypeError('Expected DVD-R starting state');
    const next = dvdrPlan(input.values ?? {}), at = validTime(input.time ?? 0);
    if (at > next.duration) throw new RangeError('Starting time exceeds DVD-R experiment');
    plan = next; time = at; start = { values: { ...next.values }, time: at }; return dvdrAt(plan, time);
  }
  reset(initial);
  return { reset, getPlan: () => plan, getState: () => dvdrAt(plan, time), replayState: () => ({ values: { ...start.values }, time: start.time }),
    update(input = {}) {
      const values = validateControls(input, plan.values, DVDR_DOMAINS, 'DVD-R');
      if (Object.keys(values).some(key => values[key] !== plan.values[key])) { plan = dvdrPlan(values); time = 0; start = { values: { ...values }, time: 0 }; }
      return dvdrAt(plan, time);
    },
    advance(seconds) { validTime(seconds); time = Math.min(plan.duration, Number((time + seconds).toFixed(12))); return dvdrAt(plan, time); } };
}

export const dvdrCacheSizes = () => ({ recorded: recorded.size });

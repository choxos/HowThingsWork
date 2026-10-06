import { validateControls, validTime } from './physics-kit.js';
import { DISC_FORMATS } from './blu-ray-player-physics.js';
import { dvdEncodeVideo, dvdDecodeVideo, DVD_VIDEO_FRAMES, DVD_VIDEO_FPS, DVD_CLIPS } from './dvd-video.js';
import { dvdEncodeSectors, dvdDecodeSectors, dvdEfmEncode, dvdEfmDecode, dvdNrziLevels, dvdDetectTransitions, dvdEraseRecordingBytes, DVD_FIRST_SECTOR, DVD_CHANNEL_RATE, DVD_SECTOR_BITS, DVD_SYNC_BITS, DVD_USER_BYTES } from './dvd-codec.js';

export const DVD_DEFAULTS = Object.freeze({ content: 0, radius: 24, loss: 0, laser: 1, format: 1, depth: 0 });
export const DVD_DOMAINS = Object.freeze({ content: [0, 2, 1], radius: [24, 58, 1], loss: [0, 3, 1], laser: [0, 1, 1], format: [0, 2, 1], depth: [0, 3, 1] });
export const DVD_LOSSES = Object.freeze(['Clean reading', '8 missing words in one row', '12 missing words across 16 rows', '12 missing words across 17 rows']);
export const DVD_TIMING = Object.freeze({ slowCells: 64, slowEnd: 4, readEnd: 6, video: DVD_VIDEO_FRAMES / DVD_VIDEO_FPS, duration: 8.25 });
export const DVD_REFERENCE = Object.freeze({ velocity: 3.49, pitch: .74e-6, inner: .024, outer: .058, wavelength: 650, aperture: .60, index: 1.56, cover: .6, backing: .6, firstDark: 3.8317059702075125 });
export const DVD_DEPTHS = Object.freeze([4, 6, 8, 2]);
export const dvdSettings = (input = {}) => validateControls(input, DVD_DEFAULTS, DVD_DOMAINS, 'DVD');
const BLOCK_BITS = 16 * DVD_SECTOR_BITS;
const cachePut = (map, key, value, limit) => { map.set(key, value); while (map.size > limit) map.delete(map.keys().next().value); return value; };

export function dvdComparison(format = 1, depth = 0) {
  dvdSettings({ format, depth });
  const f = DISC_FORMATS[format], index = format === 0 ? 1.55 : 1.56;
  const diameterNm = DVD_REFERENCE.firstDark / Math.PI * f.wavelength / f.aperture;
  const radians = 4 * Math.PI / DVD_DEPTHS[depth];
  return { ...f, index, diameterNm, cellNm: f.velocity / f.channelRate * 1e9,
    minimumNm: f.minimumRun * f.velocity / f.channelRate * 1e9,
    airHalfAngle: Math.asin(f.aperture) * 180 / Math.PI, plasticHalfAngle: Math.asin(f.aperture / index) * 180 / Math.PI,
    depthNm: f.wavelength / (index * DVD_DEPTHS[depth]), denominator: DVD_DEPTHS[depth], radians,
    intensity: (1 + Math.cos(radians)) / 2,
    twoCellPeriodNm: 4 * f.velocity / f.channelRate * 1e9 };
}

export function dvdPlacement(radius, sectors) {
  dvdSettings({ radius });
  if (!Number.isInteger(sectors) || sectors <= 0 || sectors % 16) throw new RangeError('DVD placement needs complete ECC blocks');
  const f = DVD_REFERENCE, sectorLength = f.velocity / DVD_CHANNEL_RATE * DVD_SECTOR_BITS;
  const length = Math.PI * (f.outer ** 2 - f.inner ** 2) / f.pitch;
  const maxSectors = Math.floor(length / sectorLength);
  const requestedSector = Math.round(Math.PI * ((radius / 1000) ** 2 - f.inner ** 2) / f.pitch / sectorLength / 16) * 16;
  const sectorOffset = Math.min(requestedSector, Math.floor((maxSectors - sectors - 1) / 16) * 16);
  if (sectorOffset < 0) throw new RangeError('DVD excerpt does not fit');
  const start = Math.sqrt(f.inner ** 2 + sectorOffset * sectorLength * f.pitch / Math.PI);
  return { firstAddress: DVD_FIRST_SECTOR + sectorOffset, sectorOffset, start, sectorLength, referenceLength: length,
    capacityBytes: maxSectors * DVD_USER_BYTES, edgeAdjusted: sectorOffset < requestedSector };
}

export function dvdSpiral(placement, seconds) {
  validTime(seconds);
  const f = DVD_REFERENCE, radius = Math.sqrt(placement.start ** 2 + f.pitch * f.velocity * seconds / Math.PI);
  const turns = (radius - placement.start) / f.pitch;
  return { startMm: placement.start * 1000, radiusMm: radius * 1000, turns, angle: turns * 2 * Math.PI,
    travelMicrometers: (radius - placement.start) * 1e6, rpm: 60 * f.velocity / (2 * Math.PI * radius),
    innerRpm: 60 * f.velocity / (2 * Math.PI * f.inner), outerRpm: 60 * f.velocity / (2 * Math.PI * f.outer), edgeAdjusted: placement.edgeAdjusted };
}

const videos = new Map(), discs = new Map(), readings = new Map();
export function dvdStoredDisc(content = 0, radius = 24) {
  dvdSettings({ content, radius });
  const key = `${content}:${radius}`;
  if (discs.has(key)) return discs.get(key);
  if (!videos.has(content)) videos.set(content, dvdEncodeVideo(content));
  const video = videos.get(content), sectors = Math.ceil(video.length / 32768) * 16, placement = dvdPlacement(radius, sectors);
  const recording = dvdEncodeSectors(video, placement.firstAddress), channel = dvdEfmEncode(recording), levels = dvdNrziLevels(channel.bits);
  return cachePut(discs, key, { key, content, name: DVD_CLIPS[content], videoBytes: video.length, sectors, placement, recording, channel, levels, seconds: channel.bits.length / DVD_CHANNEL_RATE }, 2);
}

export function dvdReadDisc(disc, loss = 0) {
  dvdSettings({ loss });
  const key = `${disc.key}:${loss}`;
  if (readings.has(key)) return readings.get(key);
  const positions = [], block = Math.floor(disc.sectors / 32), rows = loss === 1 ? 1 : loss === 2 ? 16 : loss === 3 ? 17 : 0, cols = loss === 1 ? 8 : 12;
  for (let row = 0; row < rows; row++) for (let col = 20; col < 20 + cols; col++) positions.push(block * 37856 + (row + Math.floor(row / 12)) * 182 + col);
  const detected = dvdDetectTransitions(disc.levels), received = positions.length ? dvdEraseRecordingBytes(detected, positions) : detected;
  const efm = dvdEfmDecode(received), recovered = dvdDecodeSectors(efm.recording), video = dvdDecodeVideo(recovered.mainData);
  const erasedByBlock = new Uint32Array(disc.sectors / 16 + 1);
  for (let b = 0; b < disc.sectors / 16; b++) erasedByBlock[b + 1] = erasedByBlock[b] + efm.recording.subarray(b * 37856, (b + 1) * 37856).reduce((sum, x) => sum + Number(x < 0), 0);
  // Bounded caches hold only recent lessons. The decoder receives no source video.
  return cachePut(readings, key, { key, loss, block, positions, received, efm, recovered, video, erasedByBlock }, 4);
}

export function dvdPlan(input = {}) {
  const values = dvdSettings(input), disc = dvdStoredDisc(values.content, values.radius), read = values.laser ? dvdReadDisc(disc, values.loss) : null;
  return { values, disc, read, comparison: dvdComparison(values.format, values.depth), duration: DVD_TIMING.duration };
}

export function dvdAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), v = plan.values, total = plan.disc.channel.bits.length;
  const count = t <= DVD_TIMING.slowEnd ? t / DVD_TIMING.slowEnd * DVD_TIMING.slowCells : DVD_TIMING.slowCells + Math.min(1, (t - DVD_TIMING.slowEnd) / (DVD_TIMING.readEnd - DVD_TIMING.slowEnd)) * (total - DVD_TIMING.slowCells);
  const cells = Math.min(total, Math.floor(count + 1e-7)), receivedCells = v.laser ? cells : 0;
  const blocks = Math.max(0, Math.min(plan.disc.sectors / 16, Math.floor((receivedCells - 16) / BLOCK_BITS)));
  const availableBytes = blocks * 32768, lookedAheadCells = Math.max(0, receivedCells - 16), stats = { erased: 0, piRepaired: 0, poRepaired: 0, failedSectors: 0, missingBytes: 0 };
  if (plan.read) {
    stats.erased = plan.read.erasedByBlock[blocks];
    for (let b = 0; b < blocks; b++) for (const key of ['piRepaired', 'poRepaired', 'failedSectors', 'missingBytes']) stats[key] += plan.read.recovered.blockStats[b][key];
  }
  const videoTime = Math.max(0, Math.min(DVD_TIMING.video, t - DVD_TIMING.readEnd));
  const frameIndex = Math.min(DVD_VIDEO_FRAMES - 1, Math.floor(videoTime * DVD_VIDEO_FPS + 1e-8));
  const candidate = plan.read?.video.frames.find(frame => frame.reference === frameIndex);
  const displaying = t >= DVD_TIMING.readEnd && !!v.laser;
  const picture = displaying && candidate?.valid && candidate.end <= availableBytes ? candidate : null;
  const availableFrames = plan.read?.video.frames.filter(frame => frame.valid && frame.end <= availableBytes).length ?? 0;
  const complete = t === plan.duration, readComplete = receivedCells === total;
  const status = !v.laser ? 'Laser off: no retrieved bytes or video.' : t === 0 ? 'Read channel transitions, recover sectors, then play the decoded two-second clip.' :
    t < DVD_TIMING.slowEnd ? `${receivedCells} of the first 64 channel cells read slowly.` :
    t < DVD_TIMING.readEnd ? `${blocks * 16} sectors checked; ${availableFrames} video frames available.` :
    !picture ? `Video frame ${frameIndex + 1} is unavailable because its compressed bytes did not pass sector checks.` :
    complete ? `${availableFrames} of 50 frames decoded${stats.failedSectors ? `; ${stats.failedSectors} failed sectors left gaps during playback` : stats.erased ? ' after repairing the flagged loss' : ''}.` :
    `Decoded frame ${frameIndex + 1} of 50 at 25 frames per second.`;
  return { time: t, duration: plan.duration, values: { ...v }, cells, receivedCells, blocks, sectors: blocks * 16, availableBytes, availableFrames,
    decodedSymbols: Math.min(plan.disc.recording.length, Math.max(0, Math.floor(lookedAheadCells / DVD_SYNC_BITS) * 91 + Math.min(91, Math.max(0, Math.floor((lookedAheadCells % DVD_SYNC_BITS - 32) / 16))))),
    stats, complete, readComplete, displaying, reading: t < DVD_TIMING.readEnd, videoTime, frameIndex, picture, status,
    spiral: dvdSpiral(plan.disc.placement, cells / DVD_CHANNEL_RATE), detectorBit: receivedCells ? plan.read.received[receivedCells - 1] : null,
    detectorLevel: receivedCells ? plan.disc.levels[receivedCells - 1] : null, checkedBytes: availableBytes - stats.failedSectors * DVD_USER_BYTES };
}

export function createDvdController(initial = {}) {
  let plan, time, start;
  function reset(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['values', 'time'].includes(k))) throw new TypeError('Expected DVD starting state');
    const next = dvdPlan(input.values ?? {}), at = validTime(input.time ?? 0);
    if (at > next.duration) throw new RangeError('Starting time exceeds DVD experiment');
    plan = next; time = at; start = { values: { ...next.values }, time: at }; return dvdAt(plan, time);
  }
  reset(initial);
  return { reset, getPlan: () => plan, getState: () => dvdAt(plan, time), replayState: () => ({ values: { ...start.values }, time: start.time }),
    update(input = {}) {
      const values = validateControls(input, plan.values, DVD_DOMAINS, 'DVD');
      const changed = Object.keys(values).some(key => !['format', 'depth'].includes(key) && values[key] !== plan.values[key]);
      plan = dvdPlan(values);
      if (changed) { time = 0; start = { values: { ...values }, time: 0 }; } else { start.values.format = values.format; start.values.depth = values.depth; }
      return dvdAt(plan, time);
    },
    advance(seconds) { validTime(seconds); time = Math.min(plan.duration, Number((time + seconds).toFixed(12))); return dvdAt(plan, time); },
  };
}

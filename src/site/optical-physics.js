import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Optical discs: how a CD, a DVD and a Blu-ray Disc lay their data along a
// spiral, how fast they turn, and how a focused spot of laser light reads the
// pits back.
//
// Exact, for the constants below:
// - A channel bit is as long as the scanning velocity over the channel bit
//   rate, and a run of n channel bits is n times that.
// - The spot's bright middle is 1.22 λ/NA across to its first dark ring, at
//   the first zero of J₁ in the Airy pattern; its second dark ring lies at the
//   second zero.
// - A lens of numerical aperture NA sends back no pattern repeating finer than
//   λ/(2NA): the circular lens's transfer function falls to zero there.
// - Constant linear velocity turns a disc 60 v / (2π r) times a minute.
// - The spiral is as long as the area it covers over its pitch.
// - Light off a bump d nearer the laser, inside plastic of refractive index n,
//   comes back 4π n d / λ out of step with light off the land around it.
// - The CD's frames and sectors, the DVD's sector, and what each disc's
//   channel bits hold at its data rate.
//
// Illustrative, stated where they are used: the light sent back is the pits
// blurred along the track by the lens's transfer function, dimmed at most as
// far as two equal halves of the light, one off a pit and one off the land,
// cancel, with the pits' width and the neighboring tracks left out; the runs
// around the ladder of every run length are drawn at random within each
// code's limits; pits are drawn 5/16 of the track pitch wide, the CD's
// 500 nm; a Blu-ray Disc's data radii and plastic are taken as a DVD's.
// ---------------------------------------------------------------------------

/** Refractive index of the discs' plastic: ECMA-130 8.6 for a CD and ECMA-267 12.1 for a DVD; taken as the same for a Blu-ray Disc. */
export const INDEX = 1.55;

/** The first two zeros of the Bessel function J₁, where the Airy pattern's dark rings fall. */
export const J1_ZEROS = Object.freeze([3.8317059702075125, 7.015586669815619]);

/** CD audio: samples a second, bits a sample and channels (Compact Disc Digital Audio page). */
export const AUDIO = Object.freeze({rate: 44100, bits: 16, channels: 2});

/**
 * A CD frame (Compact Disc Digital Audio page, ECMA-130 clauses 16 to 19): six
 * stereo samples, 24 bytes of them, 8 bytes of CIRC parity and a subcode byte;
 * each byte written as 14 channel bits and 3 merging bits, after a 24 channel
 * bit sync pattern and its 3 merging bits.
 */
export const CD_FRAME = Object.freeze({samples: 6, audio: 24, parity: 8, subcode: 1, symbol: 14, merging: 3, sync: 24});

/** A CD sector (ECMA-130 clause 14, CD-ROM page): 98 frames, 2,352 bytes, 75 a second; in Mode 1, 12 sync, 4 header, 2,048 data, 4 detection, 8 zero, 172 P-parity and 104 Q-parity bytes. */
export const CD_SECTOR = Object.freeze({frames: 98, bytes: 2352, perSecond: 75, sync: 12, header: 4, data: 2048, detection: 4, zeros: 8, pParity: 172, qParity: 104});

/** CIRC's second code and interleave (ECMA-130 annex C): a (28,24) Reed-Solomon code whose symbols are spread 4 frames apart. */
export const CIRC = Object.freeze({symbols: 28, data: 24, step: 4});

/** A DVD sector (ECMA-267 clauses 20 and 21, table 4): 26 sync frames, each a 32 channel bit sync code and 1,456 channel bits, carrying 2,048 bytes of data. */
export const DVD_SECTOR = Object.freeze({frames: 26, sync: 32, bits: 1456, data: 2048});

/** Channel bits in a CD frame. */
export const frameBits = (frame = CD_FRAME) => frame.sync + frame.merging + (frame.audio + frame.parity + frame.subcode) * (frame.symbol + frame.merging);

/** Channel bits in a DVD sector. */
export const dvdSectorBits = (sector = DVD_SECTOR) => sector.frames * (sector.sync + sector.bits);

/** The longest burst of whole frames CIRC's second code can rebuild: as many frames as its parity symbols, times the frames between them. */
export const burstFrames = (circ = CIRC) => (circ.symbols - circ.data) * circ.step;

/**
 * The three discs: wavelength nm, numerical aperture, track pitch nm, scanning
 * velocity m/s, channel bits a second, the shortest and longest runs of channel
 * bits the code lays down, the plastic between the lens and the data and the
 * plastic behind it, mm, the data's inner and outer radii, mm, and the data a
 * reader gets, bits a second.
 * CD: ECMA-130's 780 nm, 0.45, 1.6 μm, 1.20 to 1.40 m/s at 4.3218 Mbit/s and
 * 1.2 mm, read at 1.2 m/s as the compact disc and constant linear velocity
 * pages do; two to ten zeros between ones, so runs of 3 to 11; data from 25 to
 * 58 mm (Compact disc page); audio at 1,411,200 bits a second.
 * DVD: ECMA-267's 650 nm, 0.60, 0.74 μm, 3.49 m/s at 26.15625 Mbit/s for a
 * single layer, runs of 3 to 11 in its data, 0.6 mm halves (DVD page), a data
 * zone from 24 to 58 mm and 2,048 bytes in every sector.
 * Blu-ray: 405 nm, 0.85, 320 nm, 36 Mbit/s and a 0.1 mm cover over 1.1 mm
 * (Blu-ray page); 4.917 m/s and a 66 MHz channel clock (Japanese Wikipedia),
 * whose 1-7PP code is taken to lay runs of 2 to 8; radii as a DVD's.
 */
export const FORMATS = Object.freeze([
  Object.freeze({name: 'CD', wavelength: 780, aperture: 0.45, pitch: 1600, velocity: 1.2, rate: 4321800, shortest: 3, longest: 11, cover: 1.2, backing: 0, inner: 25, outer: 58, userRate: 1411200}),
  Object.freeze({name: 'DVD', wavelength: 650, aperture: 0.6, pitch: 740, velocity: 3.49, rate: 26156250, shortest: 3, longest: 11, cover: 0.6, backing: 0.6, inner: 24, outer: 58, userRate: 26156250 * DVD_SECTOR.data * 8 / dvdSectorBits()}),
  Object.freeze({name: 'Blu-ray', wavelength: 405, aperture: 0.85, pitch: 320, velocity: 4.917, rate: 66e6, shortest: 2, longest: 8, cover: 0.1, backing: 1.1, inner: 24, outer: 58, userRate: 36e6}),
]);
export const [CD, DVD, BLU_RAY] = FORMATS;

/** Pit depths, as a share of the light's wavelength inside the plastic. */
export const DEPTHS = Object.freeze([
  Object.freeze({label: 'A quarter wavelength', share: 1 / 4}),
  Object.freeze({label: 'A sixth of a wavelength', share: 1 / 6}),
  Object.freeze({label: 'An eighth of a wavelength', share: 1 / 8}),
  Object.freeze({label: 'Half a wavelength', share: 1 / 2}),
]);

/**
 * How the reading is shown: channel bits a second along the close up, how many
 * times slower the drawn disc turns, the close up's half width and half height,
 * nm, the pits' width as a share of the track pitch (the CD's 500 nm over
 * 1.6 μm), and chart samples a channel bit.
 */
export const READ = Object.freeze({bitsPerSecond: 10, spin: 100, halfWindow: 4000, halfAcross: 3000, pitShare: 5 / 16, samples: 4});

export const FORMAT_OPTIONS = Object.freeze(FORMATS.map((format, value) => Object.freeze({value, label: format.name})));
export const DEPTH_OPTIONS = Object.freeze(DEPTHS.map((depth, value) => Object.freeze({value, label: depth.label})));
export const READ_DEFAULTS = Object.freeze({format: 2, radius: 25, depth: 0});
export const READ_DOMAINS = Object.freeze({format: [0, 2, 1], radius: [25, 58, 1], depth: [0, 3, 1]});

// ---------------------------------------------------------------------------
// Lengths, speeds and sizes.
// ---------------------------------------------------------------------------

/** A channel bit's length along the track, nm. */
export const bitLength = format => format.velocity / format.rate * 1e9;

/** The spot's bright middle across, to its first dark ring, nm. */
export const spotAcross = format => J1_ZEROS[0] / Math.PI * format.wavelength / format.aperture;

/** The radius of the spot's second dark ring, nm. */
export const secondDarkRing = format => J1_ZEROS[1] / (2 * Math.PI) * format.wavelength / format.aperture;

/** The finest period the lens sends back, nm. */
export const cutoffPeriod = format => format.wavelength / (2 * format.aperture);

/** Turns a minute at `radius` mm to keep the track passing at the disc's scanning velocity. */
export const spinRate = (format, radius) => 60 * format.velocity / (2 * Math.PI * radius / 1000);

/** The spiral's length, m: the area it covers over its pitch. */
export const trackLength = format => Math.PI * (format.outer ** 2 - format.inner ** 2) / (format.pitch / 1e6) / 1000;

/** Turns of the spiral from the inner radius to the outer. */
export const turnsOf = format => (format.outer - format.inner) / (format.pitch / 1e6);

/** How long the whole spiral takes to pass the spot, s. */
export const playTime = format => trackLength(format) / format.velocity;

/** Bytes of data the spiral's channel bits carry at the disc's data rate. */
export const capacityOf = format => trackLength(format) / (bitLength(format) / 1e9) * format.userRate / format.rate / 8;

/** The half-angle of the cone of focused light, radians, in a medium of refractive index `index`. */
export const coneAngle = (format, index = 1) => Math.asin(format.aperture / index);

/** A pit's depth, nm, for a share of the light's wavelength inside the plastic. */
export const depthOf = (format, share) => share * format.wavelength / INDEX;

/** How far out of step, radians, light off a bump comes back from light off the land: twice its depth, in wavelengths inside the plastic. */
export const phaseOf = share => 4 * Math.PI * share;

/** What two equal halves of the light leave, one off a long pit and one off the land, that far out of step. */
export const longPitLevel = share => Math.cos(phaseOf(share) / 2) ** 2;

// ---------------------------------------------------------------------------
// The spot's blur along the track.
// ---------------------------------------------------------------------------

/** The circular lens's transfer function at a spatial frequency `v`, as a share of the cutoff 2NA/λ. */
export const transfer = v => (v <= 0 ? 1 : v >= 1 ? 0 : 2 / Math.PI * (Math.acos(v) - v * Math.sqrt(1 - v * v)));

/** The edge spread table: out to `reach` cutoff periods either side, a node every `step`, each by Simpson's rule over `intervals`. */
export const EDGE = Object.freeze({reach: 20, step: 0.02, intervals: 1200});

let edgeTables = null;
function tables() {
  if (edgeTables) return edgeTables;
  const count = Math.round(EDGE.reach / EDGE.step), N = EDGE.intervals, h = 1 / N;
  const nodes = new Float64Array(N + 1), weights = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) { nodes[i] = transfer(i * h); weights[i] = (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * h / 3; }
  const spread = new Float64Array(count + 1), line = new Float64Array(count + 1);
  for (let j = 0; j <= count; j++) {
    const w = 2 * Math.PI * j * EDGE.step;
    let s = weights[0] * w, c = weights[0];
    for (let i = 1; i <= N; i++) { const v = i * h; s += weights[i] * nodes[i] * Math.sin(w * v) / v; c += weights[i] * nodes[i] * Math.cos(w * v); }
    spread[j] = 0.5 + s / Math.PI;
    line[j] = 2 * c;
  }
  edgeTables = {spread, line};
  return edgeTables;
}

/**
 * How much of a long pit's dimming reaches a spot `xi` cutoff periods past the
 * pit's leading edge: the edge spread, 1/2 + (1/π)∫₀¹ T(v) sin(2πvξ)/v dv.
 * Hermite interpolation between the table's nodes, whose slopes are the line
 * spread; beyond the table, its tail 1 − 2/(π³ξ).
 */
export function edgeSpread(xi) {
  if (Number.isNaN(xi)) return NaN;
  const a = Math.abs(xi);
  let value;
  if (a >= EDGE.reach) value = 1 - 2 / (Math.PI ** 3 * a);
  else {
    const {spread, line} = tables(), u = a / EDGE.step, j = Math.min(Math.floor(u), spread.length - 2), t = u - j, t2 = t * t, t3 = t2 * t, h = EDGE.step;
    value = (2 * t3 - 3 * t2 + 1) * spread[j] + (t3 - 2 * t2 + t) * h * line[j] + (3 * t2 - 2 * t3) * spread[j + 1] + (t3 - t2) * h * line[j + 1];
  }
  return xi < 0 ? 1 - value : value;
}

/** How much of a long pit's dimming reaches the spot `s` channel bits along a row of pits, each [start, end] in channel bits, when a channel bit is `scale` cutoff periods long. */
export function blurAt(pits, s, scale) {
  let sum = 0;
  for (const [start, end] of pits) sum += edgeSpread((s - start) * scale) - edgeSpread((s - end) * scale);
  return sum;
}

const levelCache = new Map();
/**
 * For pits and lands `n` channel bits long, repeating: the blur at a pit's
 * middle and at a land's middle. The pits within 400 periods either side are
 * summed; those beyond add the same to both, 1/(π³ n k (J + 1/2)), from the
 * edge spread's tail, where k is a channel bit in cutoff periods.
 */
export function patternLevels(format, n) {
  const key = `${format.name}:${n}`;
  if (levelCache.has(key)) return levelCache.get(key);
  const scale = bitLength(format) / cutoffPeriod(format), reach = 400;
  const beyond = 1 / (Math.PI ** 3 * n * scale * (reach + 0.5));
  const at = s => { let sum = beyond; for (let j = -reach; j <= reach; j++) sum += edgeSpread((s - 2 * n * j) * scale) - edgeSpread((s - 2 * n * j - n) * scale); return sum; };
  const levels = Object.freeze({pit: at(n / 2), land: at(n / 2 + n)});
  levelCache.set(key, levels);
  return levels;
}

// ---------------------------------------------------------------------------
// The tracks in the close up.
// ---------------------------------------------------------------------------

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const layoutCache = new Map();
/**
 * The close up's tracks for a disc, positions in channel bits along the track
 * from where the spot starts: rows one pitch apart whose pits fit within the
 * close up, each a
 * list of pits [start, end]. The row under the spot runs through the ladder,
 * a pit and then a land of every run length from the shortest to the longest,
 * starting under the spot; around it, and on every other row, runs are drawn at
 * random within the code's limits. Also the ladder's pit edges, and the blur
 * under the spot sampled along the ladder.
 */
export function layoutOf(index) {
  if (layoutCache.has(index)) return layoutCache.get(index);
  const format = FORMATS[index], bit = bitLength(format), scale = bit / cutoffPeriod(format);
  const ladder = [];
  for (let n = format.shortest; n <= format.longest; n++) ladder.push(n);
  const length = 2 * ladder.reduce((sum, n) => sum + n, 0);
  const span = Math.ceil((READ.halfWindow + EDGE.reach * cutoffPeriod(format)) / bit) + format.longest;
  const draw = next => format.shortest + Math.floor(next() * (format.longest - format.shortest + 1));
  const count = Math.floor((READ.halfAcross - READ.pitShare * format.pitch / 2) / format.pitch), rows = [];
  for (let k = -count; k <= count; k++) {
    const next = random(1000 * (index + 1) + 37 * (k + count) + 11), pits = [];
    if (k === 0) {
      const before = [];
      let p = 0, pit = false;
      while (p > -span) { const n = draw(next); if (pit) before.push([p - n, p]); p -= n; pit = !pit; }
      pits.push(...before.reverse());
      p = 0;
      for (const n of ladder) { pits.push([p, p + n]); p += 2 * n; }
      pit = true;
      while (p < length + span) { const n = draw(next); if (pit) pits.push([p, p + n]); p += n; pit = !pit; }
    } else {
      let p = -span - Math.floor(next() * 2 * format.longest), pit = next() < 0.5;
      while (p < length + span) { const n = draw(next); if (pit) pits.push([p, p + n]); p += n; pit = !pit; }
    }
    rows.push(Object.freeze({row: k, offset: k * format.pitch, pits: Object.freeze(pits.map(pair => Object.freeze(pair)))}));
  }
  const read = rows.find(row => row.row === 0);
  const edges = [];
  for (let i = 0, p = 0; i < ladder.length; p += 2 * ladder[i], i++) edges.push(p, p + ladder[i]);
  const blur = new Float64Array(length * READ.samples + 1);
  for (let j = 0; j < blur.length; j++) blur[j] = blurAt(read.pits, j / READ.samples, scale);
  const layout = Object.freeze({rows: Object.freeze(rows), read, ladder: Object.freeze(ladder), length, span, edges: Object.freeze(edges), blur});
  layoutCache.set(index, layout);
  return layout;
}

// ---------------------------------------------------------------------------
// Reading.
// ---------------------------------------------------------------------------

/** Everything about reading one disc at one radius with pits of one depth that does not change as it plays. */
export function readPlan(input = {}) {
  const values = validateControls(input, READ_DEFAULTS, READ_DOMAINS, 'optical disc');
  const index = values.format, format = FORMATS[index], depth = DEPTHS[values.depth];
  const bit = bitLength(format), cutoff = cutoffPeriod(format), layout = layoutOf(index), level = longPitLevel(depth.share);
  return Object.freeze({
    values, index, format, depth, bit, cutoff, scale: bit / cutoff,
    spot: spotAcross(format), ring: secondDarkRing(format),
    shortestRun: format.shortest * bit, longestRun: format.longest * bit, pitWidth: format.pitch * READ.pitShare,
    share: depth.share, depthNm: depthOf(format, depth.share), wavelengthInside: format.wavelength / INDEX,
    phase: phaseOf(depth.share), level, dimming: 1 - level,
    radius: values.radius, rpm: spinRate(format, values.radius), omega: format.velocity / (values.radius / 1000),
    slow: format.rate / READ.bitsPerSecond, duration: layout.length / READ.bitsPerSecond, layout,
    track: trackLength(format), turns: turnsOf(format), time: playTime(format), capacity: capacityOf(format), userShare: format.userRate / format.rate,
    cone: coneAngle(format), coneInside: coneAngle(format, INDEX),
    shortestLevels: patternLevels(format, format.shortest), longestLevels: patternLevels(format, format.longest),
  });
}

/** The reading `time` s into playback: channel bits passed, the drawn disc's turn, radians, the run under the spot, and the light it sends back. */
export function readAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration), travel = t * READ.bitsPerSecond, {ladder, length, edges, read} = plan.layout;
  let run = null;
  for (let i = 0, p = 0; i < ladder.length; p += 2 * ladder[i], i++) {
    const n = ladder[i];
    if (travel < p + n) { run = {kind: 'pit', n, start: p}; break; }
    if (travel < p + 2 * n) { run = {kind: 'land', n, start: p + n}; break; }
  }
  const blur = blurAt(read.pits, travel, plan.scale);
  return {
    t, travel, done: t >= plan.duration, angle: plan.omega * t / READ.spin, run,
    bits: Math.min(length, Math.floor(travel + 1e-9)), ones: edges.filter(edge => edge < travel).length,
    blur, light: 1 - plan.dimming * blur,
  };
}

export const sampleRead = (input, time = 0) => readAt(readPlan(input), time);

import { CD_EFM_WORDS } from './cd-efm-table.js';

// ECMA-130, sections 17-19 and annexes C-E. This is a finite channel excerpt,
// not a disc image: there is no lead-in, table of contents or Q-channel clock.
export const CD_SAMPLE_RATE = 44100;
export const CD_FRAME_BITS = 588;
export const CD_CHANNEL_RATE = 4321800;
export const CD_FRAME_SYNC = '100000000001000000000010';
export const CD_SECTION_SYNC = ['00100000000001', '00000000010010'];
export const CD_CIRC_TAIL = 111;
const WORD_ORDER = [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11];
const Q_POSITIONS = [12, 13, 14, 15], P_POSITIONS = [28, 29, 30, 31];
const EXP = new Uint8Array(510), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d;
}
for (let i = 255; i < 510; i++) EXP[i] = EXP[i - 255];
const multiply = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
const coefficient = (row, length, column) => EXP[row * (length - 1 - column) % 255];
const parityPosition = i => i >= 12 && i <= 15 || i >= 28;
const delayedWord = word => word % 4 < 2;
const dataPosition = word => { const i = WORD_ORDER.indexOf(word); return 2 * i + (i >= 6 ? 4 : 0); };

function checkFrames(frames, width, erasures = false) {
  if (!Array.isArray(frames) || !frames.length) throw new TypeError('Expected nonempty CD frames');
  for (const frame of frames) {
    if (frame.length !== width || Array.from(frame).some(x => !Number.isInteger(x) || x < (erasures ? -1 : 0) || x > 255)) throw new TypeError(`Expected ${width} CD bytes per frame`);
  }
}

export function cdSyndromes(codeword) {
  return Array.from({ length: 4 }, (_, r) => codeword.reduce((sum, value, j) => sum ^ multiply(value, coefficient(r, codeword.length, j)), 0));
}

function solve(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]), n = rhs.length;
  for (let c = 0; c < n; c++) {
    const pivot = a.findIndex((row, i) => i >= c && row[c]);
    if (pivot < 0) return null;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    const inv = EXP[255 - LOG[a[c][c]]];
    for (let j = c; j <= n; j++) a[c][j] = multiply(a[c][j], inv);
    for (let r = 0; r < n; r++) if (r !== c) {
      const factor = a[r][c];
      for (let j = c; j <= n; j++) a[r][j] ^= multiply(factor, a[c][j]);
    }
  }
  return a.map(row => row[n]);
}

function insertParity(codeword, positions) {
  const sums = cdSyndromes(codeword), matrix = sums.map((_, r) => positions.map(j => coefficient(r, codeword.length, j)));
  const parity = solve(matrix, sums);
  positions.forEach((p, j) => { codeword[p] = parity[j]; });
  return codeword;
}

// Known erasures only. A failed syndrome check invalidates the whole word;
// guessing the positions of arbitrary corrupt bytes is outside this model.
export function cdRestoreErasures(input) {
  if (![28, 32].includes(input.length) || Array.from(input).some(x => !Number.isInteger(x) || x < -1 || x > 255)) throw new TypeError('Expected a C1 or C2 codeword');
  const positions = [], codeword = Int16Array.from(input, (x, j) => { if (x < 0) positions.push(j); return Math.max(0, x); });
  const fail = () => ({ bytes: new Int16Array(input.length).fill(-1), repaired: 0, ok: false, erasures: positions.length });
  if (positions.length > 4) return fail();
  if (positions.length) {
    const sums = cdSyndromes(codeword), matrix = positions.map((_, r) => positions.map(j => coefficient(r, input.length, j)));
    const restored = solve(matrix, sums.slice(0, positions.length));
    if (!restored) return fail();
    positions.forEach((p, j) => { codeword[p] = restored[j]; });
  }
  if (cdSyndromes(codeword).some(x => x)) return fail();
  return { bytes: codeword, repaired: positions.length, ok: true, erasures: positions.length };
}

export function cdCircEncode(input) {
  checkFrames(input, 24);
  const count = input.length + CD_CIRC_TAIL;
  const c2 = Array.from({ length: count }, (_, n) => {
    const bytes = new Uint8Array(28);
    for (let w = 0; w < 12; w++) {
      const frame = input[n - (delayedWord(w) ? 2 : 0)], j = dataPosition(w);
      if (frame) { bytes[j] = frame[2 * w]; bytes[j + 1] = frame[2 * w + 1]; }
    }
    return insertParity(bytes, Q_POSITIONS);
  });
  const c1 = Array.from({ length: count }, (_, n) => {
    const bytes = new Uint8Array(32);
    for (let j = 0; j < 28; j++) bytes[j] = c2[n - 4 * j]?.[j] ?? 0;
    return insertParity(bytes, P_POSITIONS);
  });
  const frames = Array.from({ length: count }, (_, n) => Uint8Array.from({ length: 32 }, (_, j) => (c1[n - (j % 2 === 0 ? 1 : 0)]?.[j] ?? 0) ^ (parityPosition(j) ? 255 : 0)));
  return { frames, c1, c2, inputFrames: input.length };
}

export function cdCircDecode(input) {
  checkFrames(input, 32, true);
  if (input.length <= CD_CIRC_TAIL) throw new RangeError('CD excerpt needs its complete CIRC tail');
  const stats = { c1Repaired: 0, c2Repaired: 0, c1Failed: 0, c2Failed: 0, missingBytes: 0 };
  const events = { c1: [], c2: [] };
  const c1 = Array.from({ length: input.length - 1 }, (_, n) => {
    const bytes = Int16Array.from({ length: 32 }, (_, j) => { const x = input[n + (j % 2 === 0 ? 1 : 0)][j]; return x < 0 ? -1 : x ^ (parityPosition(j) ? 255 : 0); });
    const result = cdRestoreErasures(bytes); stats.c1Repaired += result.repaired; stats.c1Failed += Number(!result.ok);
    events.c1.push({ repaired: result.repaired, failed: Number(!result.ok) }); return result.bytes;
  });
  const c2 = Array.from({ length: c1.length - 108 }, (_, n) => {
    const result = cdRestoreErasures(Int16Array.from({ length: 28 }, (_, j) => c1[n + 4 * j][j]));
    stats.c2Repaired += result.repaired; stats.c2Failed += Number(!result.ok);
    events.c2.push({ repaired: result.repaired, failed: Number(!result.ok) }); return result.bytes;
  });
  const frames = Array.from({ length: c2.length - 2 }, (_, n) => {
    const bytes = new Int16Array(24);
    for (let w = 0; w < 12; w++) { const source = c2[n + (delayedWord(w) ? 2 : 0)], j = dataPosition(w); bytes[2 * w] = source[j]; bytes[2 * w + 1] = source[j + 1]; }
    stats.missingBytes += bytes.filter(x => x < 0).length;
    return bytes;
  });
  return { frames, c1, c2, stats, events };
}

const DECODE_EFM = new Map(CD_EFM_WORDS.map((word, i) => [parseInt(word, 2), i]));
const MERGES = ['000', '001', '010', '100'];
function runAllowed(bridge) {
  let previous = -1;
  for (let i = 0; i < bridge.length; i++) if (bridge[i] === '1') {
    if (previous >= 0 && (i - previous < 3 || i - previous > 11)) return false;
    previous = i;
  }
  return true;
}
function syncAllowed(bridge, permitted = -1) {
  let at = bridge.indexOf(CD_FRAME_SYNC);
  while (at >= 0) { if (at !== permitted) return false; at = bridge.indexOf(CD_FRAME_SYNC, at + 1); }
  return true;
}
function digitalSum(bits, level, sum) {
  for (const bit of bits) { if (bit === '1') level = -level; sum += level; }
  return { level, sum };
}

export function cdEfmEncode(frames) {
  checkFrames(frames, 32);
  const bits = new Uint8Array(frames.length * CD_FRAME_BITS), merges = new Uint8Array(frames.length * 34);
  let offset = 0, tail = '', level = 1, sum = 0, maxAbsDsv = 0, mergeIndex = 0;
  const emit = word => {
    for (const char of word) { const bit = char === '1' ? 1 : 0; bits[offset++] = bit; if (bit) level = -level; sum += level; maxAbsDsv = Math.max(maxAbsDsv, Math.abs(sum)); }
    tail = (tail + word).slice(-23);
  };
  const mergeFor = (word, sync = false) => {
    let best = null;
    for (const merge of sync ? ['000', '100'] : MERGES) {
      const bridge = tail + merge + word;
      if (!runAllowed(bridge) || !syncAllowed(bridge, sync ? tail.length + 3 : -1)) continue;
      const score = Math.abs(digitalSum(merge + (sync ? '' : word), level, sum).sum);
      if (!best || score < best.score || score === best.score && best.merge === '000' && merge !== '000') best = { merge, score };
    }
    if (!best) throw new Error('No legal CD merging bits');
    merges[mergeIndex++] = parseInt(best.merge, 2); emit(best.merge);
  };
  for (let n = 0; n < frames.length; n++) {
    emit(CD_FRAME_SYNC);
    const control = n % 98 < 2 ? CD_SECTION_SYNC[n % 98] : CD_EFM_WORDS[0];
    mergeFor(control); emit(control);
    for (const value of frames[n]) { const word = CD_EFM_WORDS[value]; mergeFor(word); emit(word); }
    mergeFor(CD_FRAME_SYNC, true);
  }
  return { bits, merges, dsv: sum, maxAbsDsv };
}

export function cdNrziLevels(bits, initial = 1) {
  let level = initial;
  return Int8Array.from(bits, bit => { if (bit) level = -level; return level; });
}

export function cdDetectTransitions(levels, initial = 1) {
  let previous = initial;
  return Uint8Array.from(levels, level => { const bit = level === previous ? 0 : 1; previous = level; return bit; });
}

export function cdEfmDecode(bits) {
  if (!bits.length || bits.length % CD_FRAME_BITS || Array.from(bits).some(x => x !== 0 && x !== 1)) throw new TypeError('Expected complete binary CD channel frames');
  const frames = [], controls = []; let invalidSymbols = 0, invalidSyncs = 0;
  for (let base = 0, n = 0; base < bits.length; base += CD_FRAME_BITS, n++) {
    const validSync = CD_FRAME_SYNC.split('').every((char, j) => bits[base + j] === Number(char));
    const frame = new Int16Array(32);
    if (!validSync) invalidSyncs++;
    for (let j = 0; j < 33; j++) {
      const start = base + 27 + 17 * j; let word = 0;
      for (let b = 0; b < 14; b++) word = word * 2 + bits[start + b];
      const value = DECODE_EFM.get(word) ?? -1;
      if (!j) {
        const special = n % 98 < 2, expected = special ? parseInt(CD_SECTION_SYNC[n % 98], 2) : null;
        controls.push(special ? (word === expected ? `SYNC${n % 98}` : null) : value);
      } else { frame[j - 1] = validSync ? value : -1; if (frame[j - 1] < 0) invalidSymbols++; }
    }
    frames.push(frame);
  }
  return { frames, controls, invalidSymbols, invalidSyncs };
}

export function cdEraseSymbols(bits, positions) {
  const received = bits.slice();
  for (const [frame, symbol] of positions) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= bits.length / CD_FRAME_BITS || !Number.isInteger(symbol) || symbol < 0 || symbol > 31) throw new RangeError('CD erasure lies outside its frame');
    // The all-zero word is absent from the EFM table, so the reader flags it.
    const start = frame * CD_FRAME_BITS + 44 + 17 * symbol; received.fill(0, start, start + 14);
  }
  return received;
}

export function cdPcmFrames(channels) {
  if (channels.length !== 2 || channels[0].length !== channels[1].length || !channels[0].length || channels[0].length % 6) throw new TypeError('Expected stereo PCM in groups of six sample pairs');
  const frames = [];
  for (let start = 0; start < channels[0].length; start += 6) {
    const bytes = new Uint8Array(24);
    for (let k = 0; k < 6; k++) for (let ch = 0; ch < 2; ch++) {
      const x = channels[ch][start + k], i = 4 * k + 2 * ch;
      if (!Number.isInteger(x) || x < -32768 || x > 32767) throw new RangeError('Expected signed 16-bit PCM');
      bytes[i] = x >> 8 & 255; bytes[i + 1] = x & 255;
    }
    frames.push(bytes);
  }
  return frames;
}

export function cdRecoveredPcm(frames) {
  checkFrames(frames, 24, true);
  const pcm = [new Int16Array(frames.length * 6), new Int16Array(frames.length * 6)], valid = [new Uint8Array(frames.length * 6), new Uint8Array(frames.length * 6)];
  let missingSamples = 0;
  frames.forEach((frame, n) => {
    for (let k = 0; k < 6; k++) for (let ch = 0; ch < 2; ch++) {
      const i = 4 * k + 2 * ch, index = 6 * n + k;
      if (frame[i] < 0 || frame[i + 1] < 0) { missingSamples++; continue; }
      pcm[ch][index] = frame[i] * 256 + frame[i + 1]; valid[ch][index] = 1;
    }
  });
  return { pcm, valid, missingSamples };
}

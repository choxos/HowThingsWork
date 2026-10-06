import { DVD_EFM_MAIN, DVD_EFM_SUBSTITUTION } from './dvd-efm-tables.js';

export const DVD_USER_BYTES = 2048;
export const DVD_FRAME_BYTES = 2064;
export const DVD_RECORDING_BYTES = 2366;
export const DVD_SYNC_BITS = 1488;
export const DVD_SECTOR_BITS = 38688;
export const DVD_CHANNEL_RATE = 26156250;
export const DVD_FIRST_SECTOR = 0x030000;
export const DVD_SYNC_ORDER = [0, 5, 1, 5, 2, 5, 3, 5, 4, 5, 1, 6, 2, 6, 3, 6, 4, 6, 1, 7, 2, 7, 3, 7, 4, 7];
const SCRAMBLE_SEEDS = [0x0001, 0x5500, 0x0002, 0x2a00, 0x0004, 0x5400, 0x0008, 0x2800, 0x0010, 0x5000, 0x0020, 0x2001, 0x0040, 0x4002, 0x0080, 0x0005];
// ECMA-267 Table 4: the high 16 bits; every sync ends in 0x0011.
export const DVD_SYNCS = [
  [[0x1244, 0x1204], [0x0404, 0x0444], [0x1004, 0x1044], [0x0804, 0x0844], [0x2004, 0x2044], [0x2244, 0x2204], [0x2484, 0x2084], [0x2444, 0x2404]],
  [[0x9204, 0x9244], [0x8444, 0x8404], [0x9044, 0x9004], [0x8244, 0x8204], [0x8844, 0x8804], [0x8904, 0x8104], [0x9084, 0x8044], [0x8884, 0x8084]],
];

const GF_EXP = new Uint8Array(510), GF_LOG = new Uint8Array(256);
for (let i = 0, value = 1; i < 255; i++) {
  GF_EXP[i] = value; GF_LOG[value] = i;
  value <<= 1; if (value & 256) value ^= 0x11d;
}
for (let i = 255; i < 510; i++) GF_EXP[i] = GF_EXP[i - 255];
const multiply = (a, b) => a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;
const divide = (a, b) => a ? GF_EXP[(GF_LOG[a] - GF_LOG[b] + 255) % 255] : 0;
const GENERATORS = new Map();
function generator(parity) {
  if (!GENERATORS.has(parity)) {
    let g = [1];
    for (let k = 0; k < parity; k++) {
      const next = new Uint8Array(g.length + 1);
      g.forEach((x, i) => { next[i] ^= x; next[i + 1] ^= multiply(x, GF_EXP[k]); }); g = next;
    }
    GENERATORS.set(parity, g);
  }
  return GENERATORS.get(parity);
}

function checkSymbols(input, parity, erasures = false) {
  if (![2, 10, 16].includes(parity) || !input || input.length + (erasures ? 0 : parity) > 255 || input.length <= (erasures ? parity : 0)) throw new RangeError('DVD Reed-Solomon dimensions');
  for (const x of input) if (!Number.isInteger(x) || x < (erasures ? -1 : 0) || x > 255) throw new TypeError('DVD Reed-Solomon byte');
}

export function dvdRsEncode(data, parity) {
  checkSymbols(data, parity);
  const output = new Uint8Array(data.length + parity); output.set(data);
  const remainder = output.slice(), g = generator(parity);
  for (let i = 0; i < data.length; i++) {
    const coefficient = remainder[i];
    if (coefficient) for (let j = 0; j <= parity; j++) remainder[i + j] ^= multiply(coefficient, g[j]);
  }
  output.set(remainder.subarray(data.length), data.length); return output;
}

export function dvdRsSyndromes(codeword, parity) {
  const sums = new Uint8Array(parity);
  for (let r = 0; r < parity; r++) for (const byte of codeword) sums[r] = multiply(sums[r], GF_EXP[r]) ^ Math.max(0, byte);
  return sums;
}

export function dvdRsRestore(input, parity) {
  checkSymbols(input, parity, true);
  const bytes = Int16Array.from(input), missing = [];
  for (let i = 0; i < bytes.length; i++) if (bytes[i] < 0) missing.push(i);
  const fail = () => ({ bytes: Int16Array.from(input), ok: false, repaired: 0 });
  if (missing.length > parity) return fail();
  const sums = dvdRsSyndromes(bytes, parity);
  if (!missing.length) return { bytes, ok: sums.every(x => x === 0), repaired: 0 };
  const matrix = missing.map((_, row) => {
    const values = new Uint8Array(missing.length + 1);
    missing.forEach((position, col) => { values[col] = GF_EXP[(row * (bytes.length - 1 - position)) % 255]; });
    values[missing.length] = sums[row]; return values;
  });
  for (let col = 0; col < missing.length; col++) {
    let pivot = col; while (pivot < missing.length && !matrix[pivot][col]) pivot++;
    if (pivot === missing.length) return fail();
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const divisor = matrix[col][col];
    for (let j = col; j <= missing.length; j++) matrix[col][j] = divide(matrix[col][j], divisor);
    for (let row = 0; row < missing.length; row++) if (row !== col && matrix[row][col]) {
      const factor = matrix[row][col];
      for (let j = col; j <= missing.length; j++) matrix[row][j] ^= multiply(factor, matrix[col][j]);
    }
  }
  missing.forEach((position, i) => { bytes[position] = matrix[i][missing.length]; });
  if (dvdRsSyndromes(bytes, parity).some(x => x !== 0)) return fail();
  return { bytes, ok: true, repaired: missing.length };
}

export function dvdEdc(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc = (crc ^ (byte << 24)) >>> 0;
    for (let b = 0; b < 8; b++) crc = ((crc << 1) ^ (crc & 0x80000000 ? 0x80000011 : 0)) >>> 0;
  }
  return crc;
}

export function dvdScramble(mainData, address) {
  if (mainData.length !== DVD_USER_BYTES) throw new RangeError('DVD main-data length');
  let state = SCRAMBLE_SEEDS[(address >>> 4) & 15];
  return Uint8Array.from(mainData, byte => {
    const output = byte ^ (state & 255);
    for (let i = 0; i < 8; i++) state = ((state << 1) | (((state >>> 14) ^ (state >>> 10)) & 1)) & 0x7fff;
    return output;
  });
}

export function dvdDataFrame(mainData, address) {
  if (mainData.length !== DVD_USER_BYTES || !Number.isInteger(address) || address < DVD_FIRST_SECTOR || address > 0xffffff) throw new RangeError('DVD data frame');
  const bytes = new Uint8Array(DVD_FRAME_BYTES);
  bytes.set(dvdRsEncode(Uint8Array.of(0, address >>> 16, (address >>> 8) & 255, address & 255), 2));
  bytes.set(mainData, 12);
  const edc = dvdEdc(bytes.subarray(0, 2060));
  bytes.set([edc >>> 24, (edc >>> 16) & 255, (edc >>> 8) & 255, edc & 255], 2060);
  return bytes;
}

export function dvdEncodeSectors(mainData, firstAddress = DVD_FIRST_SECTOR) {
  if (!mainData.length || firstAddress % 16) throw new RangeError('DVD ECC block alignment');
  const count = Math.ceil(mainData.length / (16 * DVD_USER_BYTES)) * 16;
  const recording = new Uint8Array(count * DVD_RECORDING_BYTES);
  for (let block = 0; block < count / 16; block++) {
    const ecc = new Uint8Array(208 * 182);
    for (let sector = 0; sector < 16; sector++) {
      const index = block * 16 + sector, payload = new Uint8Array(DVD_USER_BYTES);
      payload.set(mainData.subarray(index * DVD_USER_BYTES, (index + 1) * DVD_USER_BYTES));
      const frame = dvdDataFrame(payload, firstAddress + index);
      frame.set(dvdScramble(frame.subarray(12, 2060), firstAddress + index), 12);
      for (let row = 0; row < 12; row++) ecc.set(frame.subarray(row * 172, (row + 1) * 172), (sector * 12 + row) * 182);
    }
    for (let col = 0; col < 172; col++) {
      const data = Uint8Array.from({ length: 192 }, (_, row) => ecc[row * 182 + col]);
      const codeword = dvdRsEncode(data, 16);
      for (let row = 192; row < 208; row++) ecc[row * 182 + col] = codeword[row];
    }
    for (let row = 0; row < 208; row++) ecc.set(dvdRsEncode(ecc.subarray(row * 182, row * 182 + 172), 10), row * 182);
    for (let row = 0; row < 208; row++) {
      const recordedRow = row < 192 ? row + Math.floor(row / 12) : 13 * (row - 191) - 1;
      recording.set(ecc.subarray(row * 182, (row + 1) * 182), block * 37856 + recordedRow * 182);
    }
  }
  return recording;
}

export function dvdDecodeSectors(recording) {
  if (!recording.length || recording.length % 37856) throw new RangeError('DVD recording-block length');
  const blocks = recording.length / 37856, mainData = new Int16Array(blocks * 16 * DVD_USER_BYTES).fill(-1);
  const sectors = [], blockStats = [], eccBlocks = [], stats = { piRepaired: 0, poRepaired: 0, failedSectors: 0, missingBytes: 0, passes: 0 };
  for (let block = 0; block < blocks; block++) {
    const before = { ...stats };
    const ecc = new Int16Array(208 * 182);
    for (let row = 0; row < 208; row++) {
      const recordedRow = row < 192 ? row + Math.floor(row / 12) : 13 * (row - 191) - 1;
      ecc.set(recording.subarray(block * 37856 + recordedRow * 182, block * 37856 + (recordedRow + 1) * 182), row * 182);
    }
    for (let pass = 0; pass < 208; pass++) {
      let restored = 0; stats.passes++;
      for (let row = 0; row < 208; row++) {
        const start = row * 182, result = dvdRsRestore(ecc.subarray(start, start + 182), 10);
        if (result.ok && result.repaired) { ecc.set(result.bytes, start); stats.piRepaired += result.repaired; restored += result.repaired; }
      }
      for (let col = 0; col < 172; col++) {
        const data = Int16Array.from({ length: 208 }, (_, row) => ecc[row * 182 + col]);
        const result = dvdRsRestore(data, 16);
        if (result.ok && result.repaired) {
          for (let row = 0; row < 208; row++) ecc[row * 182 + col] = result.bytes[row];
          stats.poRepaired += result.repaired; restored += result.repaired;
        }
      }
      if (!restored) break;
    }
    for (let sector = 0; sector < 16; sector++) {
      const frame = new Int16Array(DVD_FRAME_BYTES);
      for (let row = 0; row < 12; row++) frame.set(ecc.subarray((sector * 12 + row) * 182, (sector * 12 + row) * 182 + 172), row * 172);
      const known = frame.every(x => x >= 0), address = known ? (frame[1] << 16) | (frame[2] << 8) | frame[3] : null;
      const idValid = known && frame[0] === 0 && dvdRsSyndromes(frame.subarray(0, 6), 2).every(x => x === 0);
      if (idValid) frame.set(dvdScramble(frame.subarray(12, 2060), address), 12);
      const valid = idValid && dvdEdc(frame) === 0;
      const index = block * 16 + sector;
      if (valid) mainData.set(frame.subarray(12, 2060), index * DVD_USER_BYTES); else stats.failedSectors++;
      stats.missingBytes += frame.reduce((sum, byte) => sum + Number(byte < 0), 0);
      sectors.push({ index, address, valid, idValid, known, edc: known && idValid ? dvdEdc(frame) : null });
    }
    blockStats.push(Object.fromEntries(Object.keys(stats).map(key => [key, stats[key] - before[key]])));
    eccBlocks.push(ecc);
  }
  return { mainData, sectors, stats, blockStats, eccBlocks };
}

const WORD_DSV = new Int8Array(65536), WORD_POLARITY = new Int8Array(65536), LEADING = new Uint8Array(65536), TRAILING = new Uint8Array(65536);
for (let word = 0; word < 65536; word++) {
  let level = 1, sum = 0, lead = 0, trail = 0;
  for (let bit = 15; bit >= 0; bit--) { if (word & (1 << bit)) level = -level; sum += level; }
  for (let bit = 15; bit >= 0 && !(word & (1 << bit)); bit--) lead++;
  for (let bit = 0; bit < 16 && !(word & (1 << bit)); bit++) trail++;
  WORD_DSV[word] = sum; WORD_POLARITY[word] = level; LEADING[word] = lead; TRAILING[word] = trail;
}
const DECODE_WORD = new Map();
for (const table of [DVD_EFM_MAIN, DVD_EFM_SUBSTITUTION]) table.forEach((row, byte) => {
  for (let state = 0; state < 4; state++) {
    const key = row[state * 2] * 4 + row[state * 2 + 1] - 1;
    if (DECODE_WORD.has(key) && DECODE_WORD.get(key) !== byte) throw new Error('Ambiguous EFMplus table');
    DECODE_WORD.set(key, byte);
  }
});

function addWord(stream, word, nextState) {
  stream.words.push(word); stream.dsv += stream.level * WORD_DSV[word]; stream.level *= WORD_POLARITY[word];
  stream.state = nextState; stream.trailing = TRAILING[word];
}
function alternatives(byte, stream) {
  const offset = (stream.state - 1) * 2, row = DVD_EFM_MAIN[byte], base = [row[offset], row[offset + 1]];
  if (byte < 88) return [base, DVD_EFM_SUBSTITUTION[byte].slice(offset, offset + 2)];
  if (stream.state !== 1 && stream.state !== 4) return [base];
  const otherOffset = stream.state === 1 ? 6 : 0, word = row[otherOffset], gap = stream.trailing + LEADING[word];
  return gap >= 2 && gap <= 10 ? [base, [word, row[otherOffset + 1]]] : [base];
}
const cloneStream = stream => ({ ...stream, words: stream.words.slice() });
function startStream(state, level, dsv, sync, variant) {
  const stream = { state, level, dsv, words: [], trailing: 0, variant };
  addWord(stream, DVD_SYNCS[state <= 2 ? 0 : 1][sync][variant], 1); addWord(stream, 0x11, 1); return stream;
}

// Section 22 uses two candidate streams. A byte-level greedy choice would be different.
export function dvdEncodeSync(bytes, sync, initial = { state: 1, level: 1, dsv: 0 }) {
  if (bytes.length !== 91 || !Number.isInteger(sync) || sync < 0 || sync > 7) throw new RangeError('DVD sync frame');
  let streams = [startStream(initial.state, initial.level, initial.dsv, sync, 0), startStream(initial.state, initial.level, initial.dsv, sync, 1)];
  for (const byte of bytes) {
    const options = streams.map(stream => alternatives(byte, stream));
    const best = Math.abs(streams[0].dsv) <= Math.abs(streams[1].dsv) ? 0 : 1;
    if (options[best].length === 2) {
      const source = streams[best]; streams = [cloneStream(source), cloneStream(source)];
      for (let i = 0; i < 2; i++) addWord(streams[i], ...options[best][i]);
    } else {
      for (let i = 0; i < 2; i++) addWord(streams[i], ...options[i][0]);
    }
  }
  let chosen = streams[Math.abs(streams[0].dsv) <= Math.abs(streams[1].dsv) ? 0 : 1];
  let syncFlipped = false;
  if (chosen.dsv > 63 || chosen.dsv < -64) {
    const alternate = startStream(initial.state, initial.level, initial.dsv, sync, 1 - chosen.variant);
    for (let i = 2; i < chosen.words.length; i++) addWord(alternate, chosen.words[i], chosen.state);
    if (Math.abs(alternate.dsv) < Math.abs(chosen.dsv)) { chosen = alternate; syncFlipped = true; }
  }
  return { ...chosen, syncFlipped };
}

export function dvdEfmEncode(recording) {
  if (!recording.length || recording.length % DVD_RECORDING_BYTES) throw new RangeError('DVD recording-frame length');
  const count = recording.length / 91, bits = new Uint8Array(count * DVD_SYNC_BITS + 32);
  let offset = 0, state = { state: 1, level: 1, dsv: 0 }, maxAbsDsv = 0;
  const syncDsv = new Int16Array(count);
  const emit = word => { for (let bit = 15; bit >= 0; bit--) bits[offset++] = (word >>> bit) & 1; };
  for (let frame = 0; frame < count; frame++) {
    const encoded = dvdEncodeSync(recording.subarray(frame * 91, (frame + 1) * 91), DVD_SYNC_ORDER[frame % 26], state);
    for (const word of encoded.words) emit(word);
    state = { state: encoded.state, level: encoded.level, dsv: encoded.dsv };
    syncDsv[frame] = state.dsv; maxAbsDsv = Math.max(maxAbsDsv, Math.abs(state.dsv));
  }
  // The next physical sector's SY0 supplies lookahead for the last data word.
  emit(DVD_SYNCS[state.state <= 2 ? 0 : 1][0][0]); emit(0x11);
  return { bits, syncDsv, maxAbsSyncDsv: maxAbsDsv, endState: state };
}

function readWord(bits, offset) {
  let word = 0;
  for (let i = 0; i < 16; i++) { if (bits[offset + i] !== 0 && bits[offset + i] !== 1) return -1; word = (word << 1) | bits[offset + i]; }
  return word;
}

export function dvdDecodeChannelWord(word, nextWord) {
  if (!Number.isInteger(word) || word < 0 || word > 65535) return -1;
  const trailing = TRAILING[word];
  let nextState = trailing <= 1 ? 1 : trailing >= 6 && trailing <= 9 ? 4 : 0;
  if (trailing >= 2 && trailing <= 5 && Number.isInteger(nextWord) && nextWord >= 0 && nextWord <= 65535) nextState = (nextWord & 0x8008) ? 3 : 2;
  return nextState ? DECODE_WORD.get(word * 4 + nextState - 1) ?? -1 : -1;
}

export function dvdEfmDecode(bits) {
  if (bits.length < DVD_SECTOR_BITS + 32 || (bits.length - 32) % DVD_SECTOR_BITS) throw new RangeError('DVD physical-sector length');
  const frames = (bits.length - 32) / DVD_SYNC_BITS, recording = new Int16Array(frames * 91).fill(-1);
  let invalidSymbols = 0, invalidSyncs = 0;
  for (let frame = 0; frame < frames; frame++) {
    const base = frame * DVD_SYNC_BITS, high = readWord(bits, base), low = readWord(bits, base + 16), sync = DVD_SYNC_ORDER[frame % 26];
    const validSync = low === 0x11 && DVD_SYNCS.some(group => group[sync].includes(high));
    if (!validSync) { invalidSyncs++; invalidSymbols += 91; continue; }
    for (let n = 0; n < 91; n++) {
      const offset = base + 32 + n * 16, word = readWord(bits, offset);
      const value = dvdDecodeChannelWord(word, readWord(bits, offset + 16));
      if (value < 0) invalidSymbols++; else recording[frame * 91 + n] = value;
    }
  }
  return { recording, invalidSymbols, invalidSyncs };
}

export function dvdNrziLevels(bits, initial = 1) {
  let level = initial;
  return Int8Array.from(bits, bit => { if (bit !== 0 && bit !== 1) return 0; if (bit) level = -level; return level; });
}

export function dvdDetectTransitions(levels, initial = 1) {
  let previous = initial;
  return Int8Array.from(levels, level => {
    const bit = (level !== 1 && level !== -1) || (previous !== 1 && previous !== -1) ? -1 : Number(level !== previous);
    previous = level; return bit;
  });
}

export function dvdEraseRecordingBytes(bits, positions) {
  const received = Int8Array.from(bits), count = (bits.length - 32) / DVD_SYNC_BITS * 91;
  for (const position of positions) {
    if (!Number.isInteger(position) || position < 0 || position >= count) throw new RangeError('DVD erasure position');
    const start = Math.floor(position / 91) * DVD_SYNC_BITS + 32 + (position % 91) * 16;
    received.fill(-1, start, start + 16);
  }
  return received;
}

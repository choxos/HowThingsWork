import { cdCircEncode, cdCircDecode, cdEfmEncode, cdEfmDecode, cdNrziLevels, cdDetectTransitions, cdEraseSymbols, CD_FRAME_BITS } from './cd-codec.js';

// ECMA-130:1996, clauses 14-16 and annexes A-B. Byte offsets are zero based.
export const CDROM_SECTOR_BYTES = 2352;
export const CDROM_USER_BYTES = 2048;
export const CDROM_FRAMES_PER_SECTOR = 98;
const SYNC = Uint8Array.of(0, ...Array(10).fill(255), 0);
const EXP = new Uint8Array(510), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 510; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
const div = (a, b) => { if (!b) throw new RangeError('Zero GF divisor'); return a ? EXP[(LOG[a] - LOG[b] + 255) % 255] : 0; };
const bcd = n => (Math.floor(n / 10) << 4) | n % 10;

function checkBytes(bytes, length, erasures = false) {
  if (bytes?.length !== length || Array.from(bytes).some(x => !Number.isInteger(x) || x < (erasures ? -1 : 0) || x > 255)) throw new TypeError(`Expected ${length} CD-ROM bytes`);
}

export function cdromEdc(bytes) {
  let crc = 0;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xd8018001 : 0);
  }
  return crc >>> 0;
}

export function cdromMsf(lba) {
  if (!Number.isInteger(lba) || lba < 0 || lba >= 449850) throw new RangeError('CD-ROM LBA outside the two-digit minute address');
  const absolute = lba + 150, minute = Math.floor(absolute / 4500), second = Math.floor(absolute / 75) % 60, frame = absolute % 75;
  return { minute, second, frame, bytes: Uint8Array.of(bcd(minute), bcd(second), bcd(frame)), label: [minute, second, frame].map(x => String(x).padStart(2, '0')).join(':') };
}

// Annex A defines two byte planes over the same word-index matrix.
const P_VECTORS = [], Q_VECTORS = [];
for (let plane = 0; plane < 2; plane++) {
  for (let column = 0; column < 43; column++) P_VECTORS.push(Array.from({ length: 26 }, (_, row) => 12 + 2 * (43 * row + column) + plane));
  for (let row = 0; row < 26; row++) Q_VECTORS.push([
    ...Array.from({ length: 43 }, (_, column) => 12 + 2 * ((44 * column + 43 * row) % 1118) + plane),
    12 + 2 * (1118 + row) + plane, 12 + 2 * (1144 + row) + plane,
  ]);
}

function syndromes(bytes, positions) {
  let sum = 0, weighted = 0;
  positions.forEach((position, j) => { const value = Math.max(0, bytes[position]); sum ^= value; weighted ^= mul(value, EXP[positions.length - 1 - j]); });
  return [sum, weighted];
}

function addParity(bytes, positions) {
  const [sum, weighted] = syndromes(bytes, positions), first = div(weighted ^ sum, 3);
  bytes[positions.at(-2)] = first; bytes[positions.at(-1)] = first ^ sum;
}

export function cdromMakeSector(data, lba) {
  checkBytes(data, CDROM_USER_BYTES);
  const bytes = new Uint8Array(CDROM_SECTOR_BYTES);
  bytes.set(SYNC); bytes.set(cdromMsf(lba).bytes, 12); bytes[15] = 1; bytes.set(data, 16);
  const crc = cdromEdc(bytes.subarray(0, 2064));
  for (let i = 0; i < 4; i++) bytes[2064 + i] = crc >>> (8 * i);
  P_VECTORS.forEach(positions => addParity(bytes, positions));
  Q_VECTORS.forEach(positions => addParity(bytes, positions));
  return bytes;
}

// XOR is its own inverse. Erasure flags survive descrambling unchanged.
export function cdromScramble(input) {
  checkBytes(input, CDROM_SECTOR_BYTES, true);
  const bytes = Int16Array.from(input); let register = 1;
  for (let i = 12; i < bytes.length; i++) {
    let mask = 0;
    for (let bit = 0; bit < 8; bit++) { mask |= (register & 1) << bit; register = (register >>> 1) | (((register ^ (register >>> 1)) & 1) << 14); }
    if (bytes[i] >= 0) bytes[i] ^= mask;
  }
  return bytes;
}

function restoreVector(bytes, positions) {
  const missing = positions.flatMap((p, j) => bytes[p] < 0 ? [j] : []);
  if (!missing.length || missing.length > 2) return 0;
  const [sum, weighted] = syndromes(bytes, positions), a = EXP[positions.length - 1 - missing[0]];
  const restored = missing.length === 1 ? [sum] : [div(weighted ^ mul(EXP[positions.length - 1 - missing[1]], sum), a ^ EXP[positions.length - 1 - missing[1]])];
  if (missing.length === 2) restored.push(restored[0] ^ sum);
  if (missing.length === 1 && mul(restored[0], a) !== weighted) return 0;
  missing.forEach((j, k) => { bytes[positions[j]] = restored[k]; });
  return missing.length;
}

export function cdromReadSector(input, expectedLba) {
  checkBytes(input, CDROM_SECTOR_BYTES, true); cdromMsf(expectedLba);
  const bytes = Int16Array.from(input), missingBefore = bytes.filter(x => x < 0).length;
  let pRepaired = 0, qRepaired = 0;
  // Keep known symbols when a vector fails. Alternating planes may make more
  // vectors solvable. Only known erasures are repaired, never guessed errors.
  for (let pass = 0; pass < CDROM_SECTOR_BYTES; pass++) {
    let progress = 0;
    for (const positions of P_VECTORS) { const n = restoreVector(bytes, positions); pRepaired += n; progress += n; }
    for (const positions of Q_VECTORS) { const n = restoreVector(bytes, positions); qRepaired += n; progress += n; }
    if (!progress) break;
  }
  const missing = bytes.filter(x => x < 0).length;
  const syncOk = SYNC.every((x, i) => bytes[i] === x), addressOk = cdromMsf(expectedLba).bytes.every((x, i) => bytes[12 + i] === x);
  const modeOk = bytes[15] === 1, intermediateOk = bytes.slice(2068, 2076).every(x => x === 0);
  const storedEdc = (bytes[2064] | (bytes[2065] << 8) | (bytes[2066] << 16) | (bytes[2067] << 24)) >>> 0;
  const edcOk = !bytes.slice(0, 2068).some(x => x < 0) && cdromEdc(bytes.slice(0, 2064)) === storedEdc;
  const parityOk = !missing && [...P_VECTORS, ...Q_VECTORS].every(positions => syndromes(bytes, positions).every(x => x === 0));
  const ok = !missing && syncOk && addressOk && modeOk && intermediateOk && edcOk && parityOk;
  return { bytes, data: ok ? Uint8Array.from(bytes.slice(16, 2064)) : null, ok, missingBefore, missing, pRepaired, qRepaired, syncOk, addressOk, modeOk, intermediateOk, edcOk, parityOk };
}

export function cdromEncodeRun(payloads, firstLba) {
  if (!Array.isArray(payloads) || !payloads.length) throw new TypeError('Expected CD-ROM payload sectors');
  const sectors = payloads.map((bytes, i) => cdromMakeSector(bytes, firstLba + i)), frames = [];
  for (const sector of sectors) {
    const scrambled = cdromScramble(sector);
    for (let offset = 0; offset < CDROM_SECTOR_BYTES; offset += 24) frames.push(Uint8Array.from({ length: 24 }, (_, j) => scrambled[offset + (j ^ 1)]));
  }
  const circ = cdCircEncode(frames), channel = cdEfmEncode(circ.frames);
  return { firstLba, sectors, frames, circ, channel, levels: cdNrziLevels(channel.bits), count: sectors.length };
}

export function cdromReceiveRun(run, erasures = [], laser = true) {
  if (typeof laser !== 'boolean') throw new TypeError('Expected laser state');
  const detected = laser ? cdDetectTransitions(run.levels) : new Uint8Array(run.channel.bits.length);
  const received = cdEraseSymbols(detected, erasures), efm = cdEfmDecode(received), circ = cdCircDecode(efm.frames);
  const sectors = Array.from({ length: run.count }, (_, i) => {
    const scrambled = Int16Array.from({ length: CDROM_SECTOR_BYTES }, (_, j) => circ.frames[i * CDROM_FRAMES_PER_SECTOR + Math.floor(j / 24)][(j % 24) ^ 1]);
    return cdromReadSector(cdromScramble(scrambled), run.firstLba + i);
  });
  return { received, efm, circ, sectors, erased: erasures.length, channelFrames: received.length / CD_FRAME_BITS };
}

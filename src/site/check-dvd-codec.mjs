import assert from 'node:assert/strict';
import { DVD_EFM_MAIN, DVD_EFM_SUBSTITUTION } from './dvd-efm-tables.js';
import { dvdRsEncode, dvdRsRestore, dvdRsSyndromes, dvdEdc, dvdScramble, dvdDataFrame, dvdEncodeSectors, dvdDecodeSectors, dvdDecodeChannelWord, dvdEfmEncode, dvdEfmDecode, dvdNrziLevels, dvdDetectTransitions, dvdEraseRecordingBytes, DVD_SYNC_BITS, DVD_SECTOR_BITS } from './dvd-codec.js';
import { dvdEncodeVideo, dvdDecodeVideo, dvdSourceVideoFrame, dvdVideoYuv, dvdVideoRgba } from './dvd-video.js';

let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const same = (value, expected, label) => { assert.deepEqual(value, expected, label); checks++; };
const bytesEqual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
let randomState = 0x4d504547;
const randomByte = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return randomState & 255; };

// Bit-polynomial multiplication and direct root evaluation are independent of
// the implementation's logarithm tables and polynomial-division encoder.
function times(a, b) { let n = 0; while (b) { if (b & 1) n ^= a; b >>>= 1; a <<= 1; if (a & 256) a ^= 0x11d; } return n; }
function rootRemainders(codeword, parity) {
  const values = [];
  for (let r = 0, root = 1; r < parity; r++, root = times(root, 2)) {
    let value = 0; for (const byte of codeword) value = times(value, root) ^ byte; values.push(value);
  }
  return values;
}

for (const [parity, length] of [[2, 4], [10, 172], [16, 192]]) {
  const data = Uint8Array.from({ length }, randomByte), encoded = dvdRsEncode(data, parity);
  same(rootRemainders(encoded, parity), Array(parity).fill(0), 'All independent generator roots vanish');
  for (let count = 1; count <= parity; count++) for (let start = 0; start < encoded.length; start += 7) {
    const lost = Int16Array.from(encoded);
    for (let i = 0; i < count; i++) lost[(start + i * 5) % lost.length] = -1;
    const restored = dvdRsRestore(lost, parity);
    check(restored.ok && restored.repaired === count && bytesEqual(restored.bytes, encoded), 'Exact recovery throughout known-erasure parity limit');
  }
  const beyond = Int16Array.from(encoded); beyond.fill(-1, 0, parity + 1);
  check(!dvdRsRestore(beyond, parity).ok, 'Beyond parity count is unresolved');
  const corrupt = Int16Array.from(encoded); corrupt[1] ^= 1;
  check(!dvdRsRestore(corrupt, parity).ok, 'Unknown single error is detected, not claimed repaired');
  corrupt[2] = -1;
  check(!dvdRsRestore(corrupt, parity).ok, 'Mixed unlocated error plus one erasure is rejected');
}

let tablePairs = 0;
for (const table of [DVD_EFM_MAIN, DVD_EFM_SUBSTITUTION]) table.forEach((row, byte) => {
  for (let inputState = 0; inputState < 4; inputState++) {
    const word = row[2 * inputState], nextState = row[2 * inputState + 1];
    const next = DVD_EFM_MAIN[123][2 * (nextState - 1)];
    same(dvdDecodeChannelWord(word, next), byte, 'Every table entry decodes using channel lookahead alone');
    const serial = word.toString(2).padStart(16, '0');
    check(/^0*1(?:0{2,10}1)*0*$/.test(serial), 'Every codeword has legal internal runs');
    for (let following = 0; following < 256; following++) {
      const nextWord = DVD_EFM_MAIN[following][2 * (nextState - 1)].toString(2).padStart(16, '0');
      check(!/10{0,1}1|10{11,}1/.test(serial + nextWord), 'All following main words obey RLL and next-state classification');
    }
    tablePairs++;
  }
});
same(tablePairs, 1376, 'Both normative tables covered in all four states');
same(dvdDecodeChannelWord(0, 0), -1, 'Zero word rejected');
same(dvdDecodeChannelWord(65535, 0), -1, 'Impossible transition word rejected');

for (let seed = 0; seed < 16; seed++) {
  const data = Uint8Array.from({ length: 2048 }, randomByte), address = 0x030000 + seed * 16;
  check(bytesEqual(dvdScramble(dvdScramble(data, address), address), data), 'All sixteen scrambler seeds are reversible');
  const frame = dvdDataFrame(data, address);
  same(dvdEdc(frame), 0, 'EDC remainder vanishes across complete data frame');
  check(dvdRsSyndromes(frame.subarray(0, 6), 2).every(x => x === 0), 'ID parity is valid');
  for (const position of [0, 4, 6, 11, 12, 1024, 2059, 2060, 2063]) {
    const corrupt = frame.slice(); corrupt[position] ^= 1;
    check(dvdEdc(corrupt) !== 0, 'EDC detects a changed header, payload or check byte');
  }
}

const payload = Uint8Array.from({ length: 32768 }, randomByte), recording = dvdEncodeSectors(payload);
const modulation = dvdEfmEncode(recording), decoded = dvdEfmDecode(modulation.bits);
same(modulation.bits.length, 16 * DVD_SECTOR_BITS + 32, 'Sixteen sectors plus explicit next-sector sync guard');
check(bytesEqual(recording, decoded.recording), 'All recovered recording bytes match');
check(bytesEqual(payload, dvdDecodeSectors(decoded.recording).mainData), 'Whole product-code block round-trips');
check(bytesEqual(dvdDetectTransitions(dvdNrziLevels(modulation.bits)), modulation.bits), 'Physical pit/land level transitions reproduce channel bits');
let previous = -1, level = 1, dsv = 0, syncs = 0;
for (let i = 0; i < modulation.bits.length; i++) {
  if (modulation.bits[i]) {
    if (previous >= 0) {
      const run = i - previous;
      check((run >= 3 && run <= 11) || run === 14, 'Complete stream has 3T–11T data or 14T sync runs');
      if (run === 14) { same(i % DVD_SYNC_BITS, 27, '14T run occurs only inside actual sync'); syncs++; }
    }
    level = -level; previous = i;
  }
  dsv += level;
  if ((i + 1) % DVD_SYNC_BITS === 0) same(dsv, modulation.syncDsv[(i + 1) / DVD_SYNC_BITS - 1], 'DSV recomputed from emitted NRZI cells');
}
same(syncs, 417, 'One 14T feature per sync frame, including lookahead guard');

const recordingPosition = (row, col) => (row + Math.floor(row / 12)) * 182 + col;
for (const [rows, cols, expectedFailure] of [[1, 8, false], [16, 12, false], [17, 12, true]]) {
  const positions = [];
  for (let row = 0; row < rows; row++) for (let col = 20; col < 20 + cols; col++) positions.push(recordingPosition(row, col));
  const demodulated = dvdEfmDecode(dvdEraseRecordingBytes(modulation.bits, positions));
  const recovered = dvdDecodeSectors(demodulated.recording);
  if (expectedFailure) check(recovered.stats.failedSectors > 0 && recovered.mainData.some(x => x < 0), 'Unrepairable product-code rectangle remains missing');
  else check(bytesEqual(recovered.mainData, payload), 'PI/PO repair recovers actual channel-word erasures');
  if (rows === 16) check(recovered.stats.poRepaired > 0, 'Longer erasure uses outer parity');
}
const laserOff = dvdEfmDecode(dvdDetectTransitions(new Int8Array(modulation.bits.length)));
same(dvdDecodeSectors(laserOff.recording).stats.failedSectors, 16, 'Laser off yields no readable sectors');
const changedRecording = recording.slice(); changedRecording[27] ^= 1;
check(dvdDecodeSectors(changedRecording).stats.failedSectors > 0, 'Unlocated changed byte fails EDC');

const clipResults = [];
for (let clip = 0; clip < 3; clip++) {
  const video = dvdEncodeVideo(clip), decodedVideo = dvdDecodeVideo(video);
  check(decodedVideo.sequenceValid && decodedVideo.ended && decodedVideo.errors.length === 0, 'MPEG-2 sequence and end marker parsed');
  same(decodedVideo.frames.length, 50, 'Fifty pictures form two seconds at 25 Hz');
  for (let frame = 0; frame < 50; frame++) {
    const picture = decodedVideo.frames[frame];
    check(picture.valid && picture.reference === frame && bytesEqual(picture.blocks, dvdSourceVideoFrame(clip, frame)), 'Recovered flat blocks match source picture');
  }
  const videoDisc = dvdEfmEncode(dvdEncodeSectors(video));
  const recovered = dvdDecodeSectors(dvdEfmDecode(dvdDetectTransitions(dvdNrziLevels(videoDisc.bits))).recording);
  const output = dvdDecodeVideo(recovered.mainData);
  same(output.errors, [], 'Retrieved compressed bytes form valid MPEG-2 video');
  check(bytesEqual(output.frames[25].blocks, decodedVideo.frames[25].blocks), 'Middle visible frame comes through whole disc pipeline');
  same(dvdVideoYuv(output.frames[25]).length, 720 * 576 * 1.5, 'Planar YUV dimensions');
  same(dvdVideoRgba(output.frames[25]).length, 720 * 576 * 4, 'Decoded screen texture dimensions');
  const missing = Int16Array.from(video), picture = decodedVideo.frames[25];
  missing[picture.offset + 45] = -1;
  const damaged = dvdDecodeVideo(missing);
  check(damaged.frames.some(x => x.reference === 25 && !x.valid && x.blocks === null), 'Missing compressed byte blanks affected picture');
  check(damaged.frames.some(x => x.reference === 26 && x.valid), 'Following independent picture recovers');
  const unsupported = video.slice(); unsupported[7] = (unsupported[7] & 15) | 0x10;
  check(!dvdDecodeVideo(unsupported).sequenceValid, 'Unsupported aspect field does not silently masquerade as supported stream');
  clipResults.push({ clip, bytes: video.length, sectors: recovered.sectors.length, validPictures: output.frames.filter(x => x.valid).length });
}
console.log(JSON.stringify({ status: 'PASS', checks, tablePairs, clipResults }, null, 2));

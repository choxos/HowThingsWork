import assert from 'node:assert/strict';
import { CD_CHANNEL_RATE, CD_FRAME_BITS, CD_CIRC_TAIL } from './cd-codec.js';
import { cdromMakeSector, cdromReadSector, cdromScramble, cdromEdc, cdromMsf, cdromEncodeRun, cdromReceiveRun } from './cdrom-sector.js';
import { cdromMakeVolume, cdromReadVolume, cdromReadDirectory, cdromCollectFile, cdromOpenFile, cdromSampleFiles, CDROM_FILE_LOCATIONS, CDROM_CAPACITY_SECTORS } from './cdrom-files.js';

let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const same = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const rejects = (run, label) => { assert.throws(run, undefined, label); checks++; };
const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
let seed = 130;
const byte = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 24; };

same([...cdromMsf(0).bytes], [0, 2, 0], 'LBA zero uses the conventional two-second address offset');
same([...cdromMsf(4349).bytes], [0, 0x59, 0x74], 'Last sector before a minute boundary');
same([...cdromMsf(4350).bytes], [1, 0, 0], 'Minute carry uses BCD');
same(cdromMsf(449849).label, '99:59:74', 'Maximum two-digit minute address');
for (const lba of [-1, 449850, .5, NaN, Infinity, '16']) rejects(() => cdromMsf(lba), 'Invalid sector address rejected');
same(CD_CHANNEL_RATE / CD_FRAME_BITS / 98, 75, 'Exactly 75 sector-equivalents per second');

const data = Uint8Array.from({ length: 2048 }, byte), sector = cdromMakeSector(data, 166500);
same(cdromEdc(sector.slice(0, 2068)), 0, 'Full EDC codeword has zero remainder');
check(equal(cdromScramble(cdromScramble(sector)), sector), 'Scrambler is reversible');
same([...cdromScramble(new Uint8Array(2352)).slice(12, 20)], [1, 128, 0, 96, 0, 40, 0, 30], 'First scrambler bytes follow the standard register direction');
check(cdromReadSector(sector, 166500).ok, 'Valid sector passes all checks');
check(!cdromReadSector(sector, 166501).ok, 'Valid data at the wrong address is not accepted');
for (let position = 0; position < 2352; position++) {
  const corrupt = sector.slice(); corrupt[position] ^= 1;
  check(!cdromReadSector(corrupt, 166500).ok, `Unlocated error at byte ${position} is rejected`);
  const missing = Int16Array.from(sector); missing[position] = -1;
  const result = cdromReadSector(missing, 166500);
  if (position < 12) check(!result.ok, 'Sector sync is outside the P/Q code');
  else check(result.ok && equal(result.bytes, sector), 'Every protected single erasure recovers exactly');
}
for (let n = 0; n < 100; n++) {
  const missing = Int16Array.from(sector), positions = new Set();
  while (positions.size < 2) positions.add(12 + ((byte() * 256 + byte()) % 2340));
  for (const p of positions) missing[p] = -1;
  const result = cdromReadSector(missing, 166500);
  check(result.ok && equal(result.bytes, sector), 'Two distributed protected erasures recover');
}
const qCase = Int16Array.from(sector); [16, 102, 188].forEach(p => { qCase[p] = -1; });
const qResult = cdromReadSector(qCase, 166500);
check(qResult.ok && qResult.pRepaired === 0 && qResult.qRepaired === 3 && equal(qResult.bytes, sector), 'Q diagonals recover three losses that share one unsolvable P vector');
const mixed = Int16Array.from(sector); mixed[16] ^= 1; mixed[17] = -1;
check(!cdromReadSector(mixed, 166500).ok, 'Unknown error plus erasure is rejected');
const blank = new Int16Array(2352).fill(-1);
check(!cdromReadSector(blank, 166500).ok, 'No bytes cannot produce a valid sector');
const flag = Int16Array.from(sector); flag[32] = -1;
same(cdromScramble(flag)[32], -1, 'Descrambling preserves unknown byte flags');
for (const invalid of [[], new Uint8Array(2047), Array(2048).fill(-1), Array(2048).fill(256)]) rejects(() => cdromMakeSector(invalid, 0), 'Invalid sector payload rejected');

const payloads = [data, Uint8Array.from({ length: 2048 }, byte), new Uint8Array(2048)], run = cdromEncodeRun(payloads, 166500);
same(run.channel.bits.length, (3 * 98 + CD_CIRC_TAIL) * CD_FRAME_BITS, 'Contiguous three-sector excerpt includes its CIRC tail');
const scrambled = cdromScramble(run.sectors[0]);
for (let i = 0; i < 2352; i++) same(run.frames[Math.floor(i / 24)][(i % 24) ^ 1], scrambled[i], 'F1 byte pairs swap before CIRC');
const clean = cdromReceiveRun(run);
check(clean.sectors.every((s, i) => s.ok && equal(s.data, payloads[i])), 'Actual NRZI transition, EFM, CIRC and sector path recovers all payloads');
const patterns = [
  { name: 'C1', positions: [0, 2, 4, 6].map(i => [60, i]), stage: 'c1Repaired' },
  { name: 'C2', positions: Array.from({ length: 12 * 32 }, (_, i) => [60 + Math.floor(i / 32), i % 32]), stage: 'c2Repaired' },
  { name: 'P', positions: [0, 7, 14, 21, 27].flatMap(j => Array.from({ length: 32 }, (_, symbol) => [45 + j * 4, symbol])), stage: 'pRepaired' },
];
for (const pattern of patterns) {
  const read = cdromReceiveRun(run, pattern.positions);
  check(read.sectors.every((s, i) => s.ok && equal(s.data, payloads[i])), `${pattern.name} recovers original file bytes through the damaged channel`);
  check((read.circ.stats[pattern.stage] ?? read.sectors.reduce((n, s) => n + s[pattern.stage], 0)) > 0, `${pattern.name} recovery genuinely used`);
}
const failed = cdromReceiveRun(run, Array.from({ length: 20 * 32 }, (_, i) => [60 + Math.floor(i / 32), i % 32]));
check(!failed.sectors[0].ok && failed.sectors[0].data === null, 'Failed first sector has no payload');
check(failed.sectors.slice(1).every((s, i) => s.ok && equal(s.data, payloads[i + 1])), 'Later unaffected sectors recover independently');
const dark = cdromReceiveRun(run, [], false);
check(dark.sectors.every(s => !s.ok && s.data === null), 'Laser off cannot recover any sector');

for (let location = 0; location < 3; location++) {
  const master = cdromMakeVolume(location), volume = cdromReadVolume(master.sectors.get(16)), directory = cdromReadDirectory(master.sectors.get(volume.root.extent), volume);
  same(volume.size, CDROM_CAPACITY_SECTORS, 'Authored volume has the declared capacity');
  same(directory[0].extent, CDROM_FILE_LOCATIONS[location], 'Moving layout changes actual file extents');
  for (const entry of directory) {
    const bytes = cdromCollectFile(entry, Array.from({ length: entry.sectorCount }, (_, i) => master.sectors.get(entry.extent + i)));
    same(bytes, cdromSampleFiles().find(x => x.name === entry.name).bytes, 'Directory extent and byte count recover only file content');
    const output = cdromOpenFile(entry.name, bytes); check(['text', 'picture', 'data'].includes(output.type), 'Stored file opens using its real format');
    same(cdromCollectFile(entry, Array(entry.sectorCount).fill(null)), null, 'A missing sector cannot supply a file');
    if (entry.sectorCount > 1) { const partial = Array.from({ length: entry.sectorCount }, (_, i) => master.sectors.get(entry.extent + i)); partial[1] = null; same(cdromCollectFile(entry, partial), null, 'One missing middle sector blocks the entire file'); }
  }
  const pvd = master.sectors.get(16), root = master.sectors.get(volume.root.extent);
  for (const offset of [1, 6, 80, 120, 124, 128, 158, 166, 181, 881]) { const bad = pvd.slice(); bad[offset] ^= 1; rejects(() => cdromReadVolume(bad), 'Malformed descriptor is rejected independently of sector transport'); }
  for (const offset of [0, 1, 2, 10, 25, 26, 27, 28, 32, 68 + 2, 68 + 25]) { const bad = root.slice(); bad[offset] ^= 1; rejects(() => cdromReadDirectory(bad, volume), 'Malformed directory cannot supply a file address'); }
}
const pictureFile = cdromSampleFiles().find(f => f.name.endsWith('.BMP;1')), image = cdromOpenFile(pictureFile.name, pictureFile.bytes);
same([image.width, image.height, image.rgba.length], [48, 32, 6144], 'BMP dimensions and RGBA size');
same([...image.rgba.slice(0, 4)], [115, 188, 220, 255], 'BMP top row is sky after reversing stored bottom-up rows');
same([...image.rgba.slice((31 * 48) * 4, (31 * 48 + 1) * 4)], [63, 116, 73, 255], 'BMP bottom row is ground');
for (const offset of [0, 2, 10, 14, 18, 22, 26, 28, 30]) { const bad = pictureFile.bytes.slice(); bad[offset] ^= 1; rejects(() => cdromOpenFile(pictureFile.name, bad), 'Unsupported BMP layout is rejected'); }
rejects(() => cdromOpenFile('BAD.CSV;1', new TextEncoder().encode('hour,temperature_c\n6,wrong')), 'Nonnumeric CSV data rejected');
same(cdromOpenFile('README.TXT;1', null), null, 'No source-text fallback without file bytes');
console.log(`CD-ROM sector and file checks passed: ${checks} assertions`);

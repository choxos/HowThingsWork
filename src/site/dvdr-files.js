import { DVD_USER_BYTES, DVD_FIRST_SECTOR } from './dvd-codec.js';
import { dvdEncodeVideo, dvdDecodeVideo, DVD_VIDEO_FRAMES, DVD_CLIPS } from './dvd-video.js';
import { cdromReadVolume, cdromReadDirectory, cdromCollectFile } from './cdrom-files.js';

// A complete small ISO 9660 Level 1 volume inside the modeled data-zone excerpt.
// The selected file is an MPEG-2 elementary stream, not a DVD-Video title.
export const DVDR_FILE_NAMES = Object.freeze(['BALL.M2V;1', 'ROCKET.M2V;1', 'SUN.M2V;1']);
export const DVDR_FILE_LABELS = Object.freeze([...DVD_CLIPS]);
export const DVDR_VOLUME_SECTORS = 192;
export const DVDR_FILE_LBA = 24;
const encoder = new TextEncoder();
const dataView = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const put16 = (bytes, offset, value, little = true) => dataView(bytes).setUint16(offset, value, little);
const put32 = (bytes, offset, value, little = true) => dataView(bytes).setUint32(offset, value, little);
const both16 = (bytes, offset, value) => { put16(bytes, offset, value); put16(bytes, offset + 2, value, false); };
const both32 = (bytes, offset, value) => { put32(bytes, offset, value); put32(bytes, offset + 4, value, false); };
const textField = (bytes, offset, length, text = '') => { bytes.fill(32, offset, offset + length); bytes.set(encoder.encode(text), offset); };

function directoryRecord(identifier, extent, length, directory = false) {
  const id = typeof identifier === 'number' ? Uint8Array.of(identifier) : encoder.encode(identifier);
  const bytes = new Uint8Array(33 + id.length + Number(id.length % 2 === 0));
  bytes[0] = bytes.length; both32(bytes, 2, extent); both32(bytes, 10, length);
  bytes[25] = directory ? 2 : 0; both16(bytes, 28, 1); bytes[32] = id.length; bytes.set(id, 33);
  return bytes;
}

export function dvdrMakeVolume(content = 0) {
  if (!Number.isInteger(content) || content < 0 || content >= DVDR_FILE_NAMES.length) throw new RangeError('Unknown DVD-R file');
  const file = { name: DVDR_FILE_NAMES[content], bytes: dvdEncodeVideo(content), extent: DVDR_FILE_LBA };
  file.sectorCount = Math.ceil(file.bytes.length / DVD_USER_BYTES);
  if (file.extent + file.sectorCount > DVDR_VOLUME_SECTORS) throw new RangeError('DVD-R example file exceeds its volume');
  const bytes = new Uint8Array(DVDR_VOLUME_SECTORS * DVD_USER_BYTES);
  const sector = lba => bytes.subarray(lba * DVD_USER_BYTES, (lba + 1) * DVD_USER_BYTES);
  const rootLba = 20, pvd = sector(16), root = sector(rootLba);
  let offset = 0;
  for (const identifier of [0, 1]) {
    const entry = directoryRecord(identifier, rootLba, DVD_USER_BYTES, true);
    root.set(entry, offset); offset += entry.length;
  }
  root.set(directoryRecord(file.name, file.extent, file.bytes.length), offset);
  bytes.set(file.bytes, file.extent * DVD_USER_BYTES);
  pvd[0] = 1; pvd.set(encoder.encode('CD001'), 1); pvd[6] = 1;
  textField(pvd, 8, 32); textField(pvd, 40, 32, 'DVDR_LAB'); both32(pvd, 80, DVDR_VOLUME_SECTORS);
  both16(pvd, 120, 1); both16(pvd, 124, 1); both16(pvd, 128, DVD_USER_BYTES); both32(pvd, 132, 10);
  put32(pvd, 140, 18); put32(pvd, 148, 19, false); pvd.set(directoryRecord(0, rootLba, DVD_USER_BYTES, true), 156);
  for (const [start, length] of [[190, 128], [318, 128], [446, 128], [574, 128], [702, 37], [739, 37], [776, 37]]) textField(pvd, start, length);
  for (const start of [813, 830, 847, 864]) pvd.fill(48, start, start + 16);
  pvd[881] = 1;
  const terminator = sector(17); terminator[0] = 255; terminator.set(encoder.encode('CD001'), 1); terminator[6] = 1;
  for (const [lba, little] of [[18, true], [19, false]]) {
    const path = sector(lba); path[0] = 1; put32(path, 2, rootLba, little); put16(path, 6, 1, little);
  }
  return { bytes, file, rootLba, sectors: DVDR_VOLUME_SECTORS };
}

// Only checked received sectors enter this reader. No chosen-file or source-byte input.
export function dvdrReadFile(recovered) {
  let volume = null, entry = null;
  try {
    const readSector = lba => {
      const sector = recovered?.sectors?.[lba];
      if (!sector?.valid || sector.address !== DVD_FIRST_SECTOR + lba) throw new Error('Required file or directory sector failed its checks');
      const data = recovered.mainData.subarray(lba * DVD_USER_BYTES, (lba + 1) * DVD_USER_BYTES);
      if (data.length !== DVD_USER_BYTES || data.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('Required file or directory bytes are unavailable');
      return Uint8Array.from(data);
    };
    volume = cdromReadVolume(readSector(16));
    if (volume.size !== DVDR_VOLUME_SECTORS) throw new Error('Unsupported DVD-R example volume size');
    const terminator = readSector(17);
    if (terminator[0] !== 255 || terminator[6] !== 1 || String.fromCharCode(...terminator.slice(1, 6)) !== 'CD001') throw new Error('Invalid volume descriptor terminator');
    const files = cdromReadDirectory(readSector(volume.root.extent), volume);
    if (files.length !== 1 || !files[0].name.endsWith('.M2V;1')) throw new Error('Expected one stored movie file');
    entry = files[0];
    const sectors = Array.from({ length: entry.sectorCount }, (_, n) => readSector(entry.extent + n));
    const bytes = cdromCollectFile(entry, sectors), video = dvdDecodeVideo(bytes);
    if (!video.sequenceValid || !video.ended || video.errors.length || video.frames.length !== DVD_VIDEO_FRAMES || video.frames.some((frame, n) => !frame.valid || frame.reference !== n)) throw new Error('Stored movie file cannot be completely decoded');
    return { available: true, volume, entry, bytes, video, reason: null };
  } catch (error) {
    return { available: false, volume, entry, bytes: null, video: null, reason: error.message };
  }
}

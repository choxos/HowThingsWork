import { CDROM_USER_BYTES } from './cdrom-sector.js';

// Classic ECMA-119:1987 / ISO 9660 Level 1 sample volume: one root directory,
// one extent per file, 2048-byte logical blocks, no filesystem extensions.
export const CDROM_FILES = ['README.TXT;1', 'GARDEN.BMP;1', 'WEATHER.CSV;1'];
export const CDROM_FILE_LABELS = ['Read a text file', 'Open a picture', 'Plot a data file'];
export const CDROM_CAPACITY_SECTORS = 74 * 60 * 75;
export const CDROM_FILE_LOCATIONS = [24, 166500, 332900];
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const put16 = (bytes, offset, value, little = true) => view(bytes).setUint16(offset, value, little);
const put32 = (bytes, offset, value, little = true) => view(bytes).setUint32(offset, value, little);
const both16 = (bytes, offset, value) => { put16(bytes, offset, value); put16(bytes, offset + 2, value, false); };
const both32 = (bytes, offset, value) => { put32(bytes, offset, value); put32(bytes, offset + 4, value, false); };
const textField = (bytes, offset, length, text = '') => { bytes.fill(32, offset, offset + length); bytes.set(encoder.encode(text).slice(0, length), offset); };

export function cdromMakePicture() {
  const width = 48, height = 32, stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = new Uint8Array(54 + stride * height);
  bytes.set([66, 77]); put32(bytes, 2, bytes.length); put32(bytes, 10, 54); put32(bytes, 14, 40);
  put32(bytes, 18, width); put32(bytes, 22, height); put16(bytes, 26, 1); put16(bytes, 28, 24); put32(bytes, 34, stride * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let rgb = y < 23 ? [115, 188, 220] : [63, 116, 73];
    if ((x - 37) ** 2 + (y - 7) ** 2 <= 16) rgb = [255, 216, 93];
    if (x >= 9 && x <= 29 && y >= 15 && y < 28) rgb = [243, 208, 150];
    if (y >= 6 && y <= 15 && Math.abs(x - 19) <= (y - 5) * 1.4) rgb = [168, 73, 67];
    if (x >= 17 && x <= 22 && y >= 21 && y < 28) rgb = [93, 62, 46];
    if ((x >= 11 && x <= 14 || x >= 25 && x <= 28) && y >= 18 && y <= 21) rgb = [39, 82, 122];
    if ((x === 4 || x === 42) && y >= 24 && y <= 28) rgb = [230, 115, 137];
    bytes.set([rgb[2], rgb[1], rgb[0]], 54 + (height - 1 - y) * stride + x * 3);
  }
  return bytes;
}

export function cdromSampleFiles() {
  return [
    { name: CDROM_FILES[0], bytes: encoder.encode('A FILE FROM LIGHT\r\n\r\nThis text was stored as bytes on a CD-ROM.\r\nThe drive detected track transitions, recovered\r\nsectors, and checked their error-detection codes.\r\nThe directory supplied this file name and location.\r\n\r\nRead-only means reading does not rewrite the disc.\r\n') },
    { name: CDROM_FILES[1], bytes: cdromMakePicture() },
    { name: CDROM_FILES[2], bytes: encoder.encode('hour,temperature_c\r\n6,12\r\n8,15\r\n10,20\r\n12,24\r\n14,26\r\n16,23\r\n18,19\r\n20,16\r\n') },
  ];
}

function directoryRecord(identifier, extent, length, directory = false) {
  const id = typeof identifier === 'number' ? Uint8Array.of(identifier) : encoder.encode(identifier);
  const bytes = new Uint8Array(33 + id.length + Number(id.length % 2 === 0));
  bytes[0] = bytes.length; both32(bytes, 2, extent); both32(bytes, 10, length);
  bytes[25] = directory ? 2 : 0; both16(bytes, 28, 1); bytes[32] = id.length; bytes.set(id, 33);
  return bytes;
}

export function cdromMakeVolume(location = 0) {
  if (!Number.isInteger(location) || location < 0 || location >= CDROM_FILE_LOCATIONS.length) throw new RangeError('Unknown CD-ROM file location');
  const sectors = new Map(), files = cdromSampleFiles().sort((a, b) => a.name < b.name ? -1 : 1);
  const rootLba = 20, pvd = new Uint8Array(CDROM_USER_BYTES), root = new Uint8Array(CDROM_USER_BYTES);
  let extent = CDROM_FILE_LOCATIONS[location], offset = 0;
  for (const identifier of [0, 1]) { const entry = directoryRecord(identifier, rootLba, CDROM_USER_BYTES, true); root.set(entry, offset); offset += entry.length; }
  for (const file of files) {
    file.extent = extent; file.sectorCount = Math.ceil(file.bytes.length / CDROM_USER_BYTES);
    const entry = directoryRecord(file.name, extent, file.bytes.length); root.set(entry, offset); offset += entry.length;
    for (let n = 0; n < file.sectorCount; n++) { const data = new Uint8Array(CDROM_USER_BYTES); data.set(file.bytes.slice(n * CDROM_USER_BYTES, (n + 1) * CDROM_USER_BYTES)); sectors.set(extent + n, data); }
    extent += file.sectorCount;
  }
  pvd[0] = 1; pvd.set(encoder.encode('CD001'), 1); pvd[6] = 1;
  textField(pvd, 8, 32); textField(pvd, 40, 32, 'CDROM_LAB'); both32(pvd, 80, CDROM_CAPACITY_SECTORS);
  both16(pvd, 120, 1); both16(pvd, 124, 1); both16(pvd, 128, CDROM_USER_BYTES); both32(pvd, 132, 10);
  put32(pvd, 140, 18); put32(pvd, 148, 19, false); pvd.set(directoryRecord(0, rootLba, CDROM_USER_BYTES, true), 156);
  for (const [start, length] of [[190, 128], [318, 128], [446, 128], [574, 128], [702, 37], [739, 37], [776, 37]]) textField(pvd, start, length);
  for (const start of [813, 830, 847, 864]) pvd.fill(48, start, start + 16);
  pvd[881] = 1;
  const terminator = new Uint8Array(CDROM_USER_BYTES); terminator[0] = 255; terminator.set(encoder.encode('CD001'), 1); terminator[6] = 1;
  sectors.set(16, pvd); sectors.set(17, terminator); sectors.set(rootLba, root);
  for (const [lba, little] of [[18, true], [19, false]]) {
    const path = new Uint8Array(CDROM_USER_BYTES); path[0] = 1; put32(path, 2, rootLba, little); put16(path, 6, 1, little); sectors.set(lba, path);
  }
  return { sectors, files, size: CDROM_CAPACITY_SECTORS, rootLba, location };
}

function readBoth(bytes, offset, width) {
  const data = view(bytes), method = width === 2 ? 'getUint16' : 'getUint32';
  const value = data[method](offset, true);
  if (value !== data[method](offset + width, false)) throw new Error('Inconsistent ISO 9660 byte orders');
  return value;
}

function parseRecord(bytes, offset, volumeSize) {
  const length = bytes[offset], idLength = bytes[offset + 32];
  if (length < 34 || length % 2 || offset + length > bytes.length || idLength < 1 || 33 + idLength + Number(idLength % 2 === 0) > length) throw new Error('Invalid ISO 9660 directory record');
  if (bytes[offset + 1] || bytes[offset + 26] || bytes[offset + 27] || ![0, 2].includes(bytes[offset + 25]) || readBoth(bytes, offset + 28, 2) !== 1) throw new Error('Unsupported ISO 9660 file attributes');
  const extent = readBoth(bytes, offset + 2, 4), size = readBoth(bytes, offset + 10, 4), sectorCount = Math.ceil(size / CDROM_USER_BYTES);
  if (!size || extent < 18 || extent + sectorCount > volumeSize) throw new Error('ISO 9660 extent outside the volume');
  const id = bytes.slice(offset + 33, offset + 33 + idLength), directory = bytes[offset + 25] === 2;
  const name = directory && idLength === 1 && id[0] <= 1 ? (id[0] ? '..' : '.') : decoder.decode(id);
  if (!directory && !/^[A-Z0-9_]{1,8}\.[A-Z0-9_]{1,3};1$/.test(name)) throw new Error('Unsupported ISO 9660 file identifier');
  return { name, extent, size, sectorCount, directory, recordLength: length };
}

export function cdromReadVolume(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== CDROM_USER_BYTES || bytes[0] !== 1 || decoder.decode(bytes.slice(1, 6)) !== 'CD001' || bytes[6] !== 1 || bytes[881] !== 1) throw new Error('Unreadable ISO 9660 primary volume descriptor');
  if (readBoth(bytes, 128, 2) !== CDROM_USER_BYTES || readBoth(bytes, 120, 2) !== 1 || readBoth(bytes, 124, 2) !== 1) throw new Error('Unsupported ISO 9660 volume layout');
  const size = readBoth(bytes, 80, 4), root = parseRecord(bytes, 156, size);
  if (!root.directory || root.name !== '.' || root.size !== CDROM_USER_BYTES) throw new Error('Unsupported ISO 9660 root directory');
  return { name: decoder.decode(bytes.slice(40, 72)).trim(), size, root };
}

export function cdromReadDirectory(bytes, volume) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== volume.root.size) throw new Error('Unreadable ISO 9660 root directory');
  const records = []; let offset = 0;
  while (offset < bytes.length && bytes[offset]) { const record = parseRecord(bytes, offset, volume.size); records.push(record); offset += record.recordLength; }
  if (bytes.slice(offset).some(x => x !== 0)) throw new Error('Invalid ISO 9660 directory padding');
  if (records.length < 2 || records[0].name !== '.' || records[1].name !== '..' || records.slice(0, 2).some(x => !x.directory || x.extent !== volume.root.extent || x.size !== volume.root.size)) throw new Error('Invalid ISO 9660 root links');
  const files = records.slice(2);
  if (files.some(x => x.directory) || new Set(files.map(x => x.name)).size !== files.length) throw new Error('Unsupported ISO 9660 directory hierarchy');
  return files;
}

export function cdromCollectFile(entry, sectors) {
  if (!entry || entry.directory || !Array.isArray(sectors) || sectors.length !== entry.sectorCount || sectors.some(x => !(x instanceof Uint8Array) || x.length !== CDROM_USER_BYTES)) return null;
  const bytes = new Uint8Array(entry.size);
  sectors.forEach((sector, i) => bytes.set(sector.slice(0, Math.min(CDROM_USER_BYTES, entry.size - i * CDROM_USER_BYTES)), i * CDROM_USER_BYTES));
  return bytes;
}

export function cdromOpenFile(name, bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  if (name.endsWith('.TXT;1')) return { type: 'text', text: decoder.decode(bytes) };
  if (name.endsWith('.CSV;1')) {
    const rows = decoder.decode(bytes).trim().split(/\r?\n/);
    if (rows.shift() !== 'hour,temperature_c') throw new Error('Unsupported example data columns');
    const points = rows.map(row => row.split(',').map(Number));
    if (!points.length || points.some(row => row.length !== 2 || row.some(x => !Number.isFinite(x)))) throw new Error('Invalid example data row');
    return { type: 'data', points, xLabel: 'Hour', yLabel: 'Temperature (°C)' };
  }
  if (name.endsWith('.BMP;1')) {
    if (bytes.length < 54) throw new Error('Truncated BMP header');
    const data = view(bytes), width = data.getInt32(18, true), height = data.getInt32(22, true), offset = data.getUint32(10, true), stride = Math.ceil(width * 3 / 4) * 4;
    if (bytes[0] !== 66 || bytes[1] !== 77 || data.getUint32(2, true) !== bytes.length || data.getUint32(14, true) !== 40 || data.getUint16(26, true) !== 1 || data.getUint16(28, true) !== 24 || data.getUint32(30, true) !== 0 || width <= 0 || height <= 0 || width > 1024 || height > 1024 || offset < 54 || offset + stride * height !== bytes.length) throw new Error('Unsupported BMP layout');
    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const at = offset + (height - 1 - y) * stride + x * 3;
      rgba.set([bytes[at + 2], bytes[at + 1], bytes[at], 255], (y * width + x) * 4);
    }
    return { type: 'picture', width, height, rgba };
  }
  throw new Error('Unsupported example file type');
}

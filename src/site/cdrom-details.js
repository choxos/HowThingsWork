import * as THREE from 'three';
import { fillLine, lineObject, textLabel } from './scene-kit.js';
import { CD_FRAME_BITS, CD_CIRC_TAIL } from './cd-codec.js';
import { cdromMsf } from './cdrom-sector.js';
import { CDROM_LOSSES } from './cdrom-physics.js';
import { CDROM_CAPACITY_SECTORS } from './cdrom-files.js';
import { dvdComparison } from './dvd-physics.js';

const C = { ink: 0x374736, paper: 0xfbf6e9, pale: 0xe7dfce, blue: 0x397b94, gold: 0xb08a38, red: 0xc14f39, green: 0x78a477, gray: 0xa8b4a4, purple: 0x8063a3 };
const label = (p, text, x, y, w = 5.8, h = .19, z = .13) => textLabel(p, text, { width: w, height: h, position: [x, y, z] });
const line = (p, points, color = C.gray) => { const o = lineObject(points.length, color, p); fillLine(o, points); return o; };
const own = o => { o.material = o.material.clone(); return o; };
const flat = (o, color) => { o.material = new THREE.MeshBasicMaterial({ color }); return o; };
const set = (o, text) => o.userData.setText(text);
const hex = x => x < 0 ? '?' : x.toString(16).toUpperCase().padStart(2, '0');
const number = x => x.toLocaleString('en-US');

export function createCdromDetails(kit, hardware) {
  const details = [], panels = {};
  const panel = (id, name, description, title) => {
    const p = kit.part(id, name, description, [0, 0, 0], hardware.system);
    p.userData.inspectionOnly = id; p.userData.explosionExcluded = true; details.push(p); panels[id] = p;
    flat(kit.box([6.12, 5.45, .035], [0, -.04, -.08], C.paper, p), C.paper);
    label(p, title, 0, 2.42, 5.8, .25); return p;
  };
  const optics = panel('optics', 'Laser to detector', 'The 780 nm laser is focused through a 1.2 mm clear substrate. A polarizing splitter and quarter-wave plate route returned light to the detector. Both pits and lands reflect. Diffraction changes the collected signal; the digital model starts after ideal transition detection.', 'RETURNED LIGHT STARTS THE DATA PATH');
  flat(kit.box([4.4, .22, .1], [.3, 1.50, 0], C.blue, optics), 0xbdd5d9);
  kit.box([4.4, .014, .11], [.3, 1.62, .01], C.ink, optics);
  label(optics, 'Reflective pattern above 1.2 mm of clear plastic', .1, 1.95, 5.5, .19);
  kit.box([.68, .35, .13], [-2.1, -.55, 0], C.ink, optics); label(optics, '780 nm laser', -2.1, -.97, 1.4, .17);
  kit.box([.12, .68, .13], [-1.37, -.55, 0], C.blue, optics); label(optics, 'Collimator', -1.35, -1.27, 1.4, .16);
  kit.box([.54, .54, .08], [-.47, -.55, 0], C.pale, optics);
  line(optics, [[-.74, -.82, .12], [-.20, -.28, .12]], C.ink); label(optics, 'Splitter', -.48, -.08, 1.12, .17);
  kit.box([.10, .60, .08], [.16, -.55, 0], C.purple, optics); label(optics, 'Quarter-wave plate', .45, -1.01, 1.78, .15);
  const mirror = kit.box([.10, .48, .13], [.92, -.55, 0], C.gray, optics); mirror.rotation.z = -Math.PI / 4;
  label(optics, 'Fold mirror', 2.02, -.63, 1.55, .17);
  kit.box([.62, .17, .13], [.92, .65, 0], C.blue, optics); label(optics, 'Objective', 2.03, .65, 1.6, .17);
  kit.box([.68, .30, .13], [-.47, -1.50, 0], C.gold, optics); label(optics, 'Detector', .76, -1.50, 1.65, .18);
  const outgoing = lineObject(6, C.red, optics), returning = lineObject(6, C.gold, optics);
  const lightStatus = label(optics, '', 0, -2.02, 5.8, .19);
  label(optics, 'Route schematic; beam widths and component sizes are enlarged', 0, -2.43, 5.8, .16);

  const track = panel('track', 'Stored marks and transitions', 'This patch uses the actual EFM recording. A one marks a change of pit or land level. The CD spot circle is a scalar Airy first-dark-ring reference, not a measured detector profile. Both levels reflect light.', 'A TRANSITION IS A CHANNEL ONE');
  const trackTitle = label(track, '', 0, 2.01, 5.8, .18), trackScale = label(track, '', 0, 1.69, 5.8, .17);
  const pits = Array.from({ length: 64 }, () => own(kit.box([1, .15, .055], [0, 1.02, .055], C.ink, track)));
  line(track, [[-2.6, 1.02, .015], [2.6, 1.02, .015]], C.gray);
  const neighbors = [lineObject(2, C.gray, track), lineObject(2, C.gray, track)];
  const spot = own(kit.disk(1, .008, [0, 1.02, .12], C.red, track)); spot.material.transparent = true; spot.material.opacity = .20; spot.material.depthWrite = false;
  const spotRing = kit.ring(1, .013, [0, 1.02, .14], C.red, track), cursor = lineObject(2, C.red, track), levels = lineObject(128, C.blue, track);
  const dots = Array.from({ length: 64 }, () => kit.sphere(.022, [0, -.47, .12], C.gold, track));
  label(track, 'Ideal pit/land level; this is not analog detector voltage', 0, -.81, 5.8, .17);
  const bitsA = label(track, '', 0, -1.16, 5.8, .18), bitsB = label(track, '', 0, -1.46, 5.8, .18), trackResult = label(track, '', 0, -1.93, 5.8, .18);
  label(track, 'Data runs: 3T to 11T. Each frame begins with a 24-cell sync.', 0, -2.42, 5.8, .17);



  const codec = panel('codec', 'Channel frame and EFM', 'A CD channel frame contains 588 cells: 24 sync cells, a 14-cell control word, 32 fourteen-cell data words and 102 merging cells. EFM recovers bytes, then CIRC reverses their interleaving and repairs known losses. A recovered F1 frame carries 24 raw sector bytes, including their sector overhead.', 'CHANNEL WORDS BECOME SECTOR BYTES');
  label(codec, '588 cells = 24 sync + 14 control + 32 × 14 data + 102 merge', 0, 2.00, 5.8, .18);
  label(codec, 'An EFM word uses 14 cells to encode one 8-bit byte', 0, 1.65, 5.8, .19);
  const codeHeader = label(codec, '', 0, 1.23, 5.8, .17);
  const codeBits = Array.from({ length: 14 }, (_, i) => {
    const x = -2.53 + 5.06 * i / 13;
    return { box: flat(kit.box([.32, .38, .05], [x, .76, .03], C.pale, codec), C.pale), text: label(codec, '', x, .76, .29, .22) };
  });
  const receivedWord = label(codec, '', 0, .22, 5.8, .19), byteResult = label(codec, '', 0, -.32, 5.8, .23);
  label(codec, '98 × 24 F1 bytes = one 2,352-byte raw sector', 0, -.91, 5.8, .20);
  label(codec, 'CIRC rearranges these bytes across many channel frames', 0, -1.34, 5.8, .18);
  const codeProgress = label(codec, '', 0, -1.88, 5.8, .18);
  label(codec, 'Sector boundaries need not align with control-section boundaries', 0, -2.43, 5.8, .16);

  const sectors = panel('sectors', 'Mode 1 sector and checks', 'A raw sector has 2,352 bytes, including 2,048 user bytes. Sync and header locate the sector. The 32-bit EDC detects corruption; P/Q parity can recover known missing bytes left after CIRC. A file becomes available only when all its required sectors pass.', 'CHECK THE SECTOR BEFORE USING ITS FILE BYTES');
  label(sectors, 'MODE 1: 2,352 bytes after CIRC and descrambling', 0, 2.00, 5.8, .20);
  const fields = [['Sync', '12', .72], ['Header', '4', .83], ['User data', '2,048', 1.66], ['EDC', '4', .66], ['Zero', '8', .67], ['P + Q', '276', 1.06]];
  let x = -2.8;
  for (const [name, count, width] of fields) {
    flat(kit.box([width - .04, .65, .04], [x + width / 2, 1.26, .03], C.pale, sectors), name === 'User data' ? 0xbdd5d9 : 0xe6d6a8);
    label(sectors, name, x + width / 2, 1.37, width - .06, .15); label(sectors, count, x + width / 2, 1.09, width - .06, .17); x += width;
  }
  label(sectors, 'Field boxes are labeled, not proportional to their byte counts', 0, .72, 5.8, .16);
  label(sectors, 'P parity: 172 bytes · Q parity: 104 bytes', 0, .29, 5.8, .21);
  const sectorId = label(sectors, '', 0, -.24, 5.8, .20), sectorHeader = label(sectors, '', 0, -.68, 5.8, .18);
  const sectorEdc = label(sectors, '', 0, -1.17, 5.8, .19), sectorProgress = label(sectors, '', 0, -1.76, 5.8, .18);
  label(sectors, 'Header bytes use BCD minute:second:frame; one second is 75 sectors', 0, -2.40, 5.8, .16);

  const errors = panel('errors', 'CIRC and sector parity repair', 'Known unreadable channel words are flagged. C1 and C2 parity repair losses through interleaving. Sector P and Q vectors can each repair up to two remaining known erasures. The two grids show actual sector bytes after CIRC and after P/Q. These selected loss patterns are not calibrated scratches.', 'CD-ROM ADDS SECTOR REPAIR AFTER CIRC');
  const errorHeader = label(errors, '', 0, 2.01, 5.8, .19);
  label(errors, 'AFTER CIRC', -1.42, 1.61, 2.55, .18); label(errors, 'AFTER P + Q', 1.42, 1.61, 2.55, .18);
  const grids = [-1.42, 1.42].map(center => Array.from({ length: 140 }, (_, i) => {
    const col = i % 14, row = Math.floor(i / 14);
    return flat(kit.box([.153, .15, .035], [center + (col - 6.5) * .169, 1.24 - row * .169, .02], C.pale, errors), C.pale);
  }));
  label(errors, 'Raw sector bytes 1008–1147, in reading order', 0, -.60, 5.8, .17);
  const circCounts = label(errors, '', 0, -1.03, 5.8, .18), repairCounts = label(errors, '', 0, -1.43, 5.8, .18), failedCounts = label(errors, '', 0, -1.86, 5.8, .18);
  label(errors, 'Gray waiting · blue received · red missing · green repaired', 0, -2.43, 5.8, .16);

  const directory = panel('directory', 'Find the stored file', 'The reader begins at volume-descriptor sector 16. That recovered descriptor locates the root directory. Recovered directory entries give each filename, first sector and exact byte count. This example uses a classic ISO 9660 root with one extent per file.', 'A DIRECTORY TURNS SECTORS INTO NAMED FILES');
  const volumeLine = label(directory, '', 0, 1.92, 5.8, .20), rootLine = label(directory, '', 0, 1.43, 5.8, .20);
  label(directory, 'FILENAME', -1.92, .87, 1.9, .17); label(directory, 'FIRST SECTOR', .31, .87, 1.75, .17); label(directory, 'BYTES', 2.09, .87, 1.1, .17);
  const rows = [.38, -.14, -.66].map(y => ({
    highlight: flat(kit.box([5.5, .40, .025], [0, y, .01], C.pale, directory), C.pale),
    name: label(directory, '', -1.83, y, 2.05, .18), extent: label(directory, '', .30, y, 1.64, .18), size: label(directory, '', 2.1, y, 1.15, .18),
  }));
  const directoryResult = label(directory, '', 0, -1.32, 5.8, .20), directoryBytes = label(directory, '', 0, -1.85, 5.8, .18);
  label(directory, 'File location changes rebuild this sample; a pressed disc is read-only', 0, -2.42, 5.8, .15);

  const files = panel('files', 'Open the recovered file', 'The computer opens only bytes obtained through the channel, CIRC, sector checks and directory. Choose text, a 48 by 32 BMP picture or a CSV plot. If a required sector is missing, the file remains unavailable. No source image or source text is substituted.', 'THE COMPUTER USES THE RETRIEVED FILE');
  const fileHeader = label(files, '', 0, 2.00, 5.8, .18);
  kit.box([4.78, 3.61, .045], [0, -.10, .01], C.ink, files);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.72, 3.54), new THREE.MeshBasicMaterial({ map: hardware.fileTexture, toneMapped: false })); screen.position.set(0, -.10, .05); files.add(screen);
  const fileResult = label(files, '', 0, -2.09, 5.8, .18);
  label(files, 'Same recovered content appears on the connected computer screen', 0, -2.45, 5.8, .15);

  const layers = panel('layers', 'Cover layer and light cone', 'The comparison changes the diagram, while the player remains a CD-ROM drive. Numerical aperture defines the cone angle in air. Refraction narrows that angle in plastic. The transparent read layer is 1.2 mm for CD, 0.6 mm for DVD and 0.1 mm for Blu-ray.', 'WIDER APERTURE; THINNER TRANSPARENT READ LAYER');
  const layerHeader = label(layers, '', 0, 2.01, 5.8, .19);
  const backing = flat(kit.box([4.5, 1, .04], [0, 1, -.01], C.pale, layers), C.pale), cover = flat(kit.box([4.5, 1, .04], [0, 0, -.01], C.blue, layers), 0xbdd5d9);
  const dataLayer = kit.box([4.5, .022, .04], [0, .4, .04], C.ink, layers);
  const layerLabel = label(layers, '', 0, 1.48, 5.8, .17), lens = kit.box([1, .12, .04], [0, -1.50, .01], C.gray, layers);
  const cones = [lineObject(3, C.red, layers), lineObject(3, C.red, layers)];
  const layerAngles = label(layers, '', 0, -1.95, 5.8, .17);
  label(layers, 'Diagram uses a stated reference index; coatings and pit relief omitted', 0, -2.43, 5.8, .15);

  const comparison = panel('comparison', 'Compare optical formats', 'A shorter wavelength and larger numerical aperture reduce the reference spot diameter. Track pitch, channel cells, minimum runs and coding rules all matter. A spot diameter by itself does not predict a detector signal or a read/no-read threshold.', 'SMALLER FEATURES PACK MORE INTO THE DISC');
  const columns = [-1.94, 0, 1.94].map((x, format) => {
    const f = dvdComparison(format), p = new THREE.Group(); p.position.x = x; comparison.add(p);
    const highlight = own(kit.box([1.82, 3.83, .022], [0, -.04, -.015], C.pale, p));
    label(p, f.name, 0, 1.57, 1.7, .22);
    const ring = kit.ring(f.diameterNm / 2600, .017, [0, .52, .05], C.red, p);
    label(p, `${(f.diameterNm / 1000).toFixed(2)} µm spot`, 0, -.45, 1.73, .17);
    label(p, `${f.wavelength} nm · NA ${f.aperture.toFixed(2)}`, 0, -.83, 1.73, .16);
    label(p, `${(f.pitch / 1000).toFixed(2)} µm pitch`, 0, -1.20, 1.73, .17);
    label(p, `${f.minimumNm.toFixed(0)} nm min. run`, 0, -1.58, 1.73, .16);
    return { p, highlight, ring };
  });
  const comparisonNote = label(comparison, '', 0, -2.12, 5.8, .17);
  label(comparison, 'Circle: scalar first-dark-ring reference; no hard readability cutoff', 0, -2.46, 5.8, .15);

  const phase = panel('phase', 'Separate two-wave experiment', 'Equal coherent waves with round-trip phase 4πnh/λ add to normalized intensity cos²(2πnh/λ). This illustrates phase only. It does not calculate real pit contrast, alter stored bytes or predict read failures.', 'HEIGHT CAN CHANGE HOW WAVES ADD');
  const phaseHeader = label(phase, '', 0, 2.00, 5.8, .18), phaseLines = [lineObject(181, C.blue, phase), lineObject(181, C.gold, phase), lineObject(181, C.purple, phase)];
  for (const [title, y] of [['First wave', 1.26], ['Second wave', .20], ['Their sum', -.86]]) {
    label(phase, title, -2.26, y + .33, 1.3, .17); line(phase, [[-2.7, y, .02], [2.7, y, .02]], C.pale);
  }
  const phaseResult = label(phase, '', 0, -1.62, 5.8, .22);
  label(phase, 'Reference format and depth change this comparison only', 0, -2.06, 5.8, .17);
  label(phase, 'Equal-wave intensity does not predict real disc contrast', 0, -2.43, 5.8, .16);



  const spin = panel('spin', 'Seek, then follow the spiral', 'The computer first reads volume and directory metadata, then seeks to the recovered file address. During reading, a 1.2 m/s reference track speed gives 75 sectors per second. Outer tracks need fewer rpm. The thin-spiral relation is r² = r₀² + pvt/π, with 1.6 micrometer pitch. Seeks are schematic; their duration and spindle angle are not a servo simulation.', 'FIND THE FILE, THEN KEEP A STEADY DATA RATE');
  kit.ring(1.27, .024, [-1.20, .60, .03], C.gray, spin); kit.ring(.164, .017, [-1.20, .60, .04], C.gray, spin);
  const spiral = lineObject(1601, C.blue, spin), spinMarker = kit.sphere(.055, [-1.20, .60, .12], C.red, spin), radiusGuide = lineObject(2, C.red, spin);
  fillLine(spiral, Array.from({ length: 1601 }, (_, i) => { const a = 16 * 2 * Math.PI * i / 1600, r = 1.27 * (25 + 33 * i / 1600) / 58; return [-1.20 + r * Math.cos(a), .60 + r * Math.sin(a), .06]; }));
  const spinReadouts = [1.55, 1.08, .61, .14, -.33].map(y => label(spin, '', 1.35, y, 2.50, .18));
  label(spin, 'Turn spacing exaggerated', -1.2, -1.00, 2.7, .17);
  const spinProgress = label(spin, '', 0, -1.41, 5.8, .18), spinStage = label(spin, '', 0, -1.91, 5.8, .18);
  label(spin, 'Reading rotation follows channel time; seek motion is illustrative', 0, -2.44, 5.8, .16);

  const capacity = panel('capacity', 'Frames, sectors and capacity', 'At 1× speed a CD supplies 7,350 channel frames or 75 raw sectors per second. Mode 1 makes 2,048 user bytes available per sector. This 74-minute example has 333,000 sectors. The three tiny files occupy only five file sectors, plus filesystem metadata. Faster reading would not add stored bytes.', 'MORE CHANNEL CELLS THAN USEFUL FILE BITS');
  const capacityLines = [1.92, 1.43, .94, .45, -.04, -.53, -1.02, -1.51].map(y => label(capacity, '', 0, y, 5.8, .20));
  label(capacity, 'GB uses 1,000,000,000 bytes; MiB uses 1,048,576 bytes', 0, -2.03, 5.8, .17);
  label(capacity, 'A 74-minute example; not an exact capacity claim for every CD-ROM', 0, -2.43, 5.8, .16);
  return { details, panels, outgoing, returning, lightStatus, trackTitle, trackScale, pits, neighbors, spot, spotRing, cursor, levels, dots, bitsA, bitsB, trackResult,
    codeHeader, codeBits, receivedWord, byteResult, codeProgress, sectorId, sectorHeader, sectorEdc, sectorProgress, errorHeader, grids, circCounts, repairCounts, failedCounts,
    volumeLine, rootLine, rows, directoryResult, directoryBytes, screen, fileHeader, fileResult,
    layerHeader, backing, cover, dataLayer, layerLabel, lens, cones, layerAngles, columns, comparisonNote, phaseHeader, phaseLines, phaseResult,
    spinMarker, radiusGuide, spinReadouts, spinProgress, spinStage, capacityLines };
}

export function updateCdromDetails(g, s, p) {
  const lit = !!s.values.laser, beam = lit && s.reading, job = p.jobs[s.activeIndex];
  fillLine(g.outgoing, beam ? [[-1.75, -.55, .16], [-.47, -.55, .16], [.16, -.55, .16], [.92, -.55, .16], [.92, .65, .16], [.92, 1.62, .16]] : []);
  fillLine(g.returning, beam ? [[1.0, 1.62, .17], [1.0, .65, .17], [1.0, -.47, .17], [.16, -.47, .17], [-.39, -.47, .17], [-.39, -1.34, .17]] : []);
  set(g.lightStatus, !lit ? 'Laser off: no optical signal reaches the reader' : s.reading ? 'Returned light supplies ideal detected transitions' : s.seeking ? 'The pickup moves to the recovered sector address' : s.fileReady ? 'The retrieved file is now available to the computer' : 'Reading stopped; the file is unavailable');
  const total = job.run.channel.bits.length, start = Math.min(total - 64, Math.floor(Math.min(s.cells, total - 1) / 64) * 64), width = 5.2 / 64;
  const levels = job.run.levels.subarray(start, start + 64), bits = job.run.channel.bits.subarray(start, start + 64), cd = dvdComparison(0);
  let at = 0, used = 0;
  while (at < 64) { let end = at + 1; while (end < 64 && levels[end] === levels[at]) end++;
    if (levels[at] < 0) { const pit = g.pits[used++]; pit.visible = true; pit.position.x = -2.6 + (at + end) * width / 2; pit.scale.x = (end - at) * width; } at = end;
  }
  for (let i = used; i < g.pits.length; i++) g.pits[i].visible = false;
  const pitch = 1600 / cd.cellNm * width, spotRadius = cd.diameterNm / cd.cellNm * width / 2, x = -2.6 + Math.min(64, Math.max(0, s.cells - start)) * width;
  g.neighbors.forEach((o, i) => fillLine(o, [[-2.6, 1.02 + (i ? 1 : -1) * pitch, .025], [2.6, 1.02 + (i ? 1 : -1) * pitch, .025]]));
  g.spot.scale.setScalar(spotRadius); g.spot.position.x = x; g.spot.visible = beam;
  g.spotRing.scale.set(spotRadius, spotRadius, 1); g.spotRing.position.x = x; g.spotRing.visible = beam;
  fillLine(g.cursor, [[x, -.52, .14], [x, 1.52, .14]]);
  fillLine(g.levels, Array.from(levels, (value, i) => [[-2.6 + i * width, -.03 + value * .18, .12], [-2.6 + (i + 1) * width, -.03 + value * .18, .12]]).flat());
  g.dots.forEach((o, i) => { o.position.x = -2.6 + i * width; o.visible = !!bits[i]; });
  set(g.trackTitle, `${job.role.toUpperCase()} read · stored cells ${number(start)}–${number(start + 63)}`);
  set(g.trackScale, `Cell ${cd.cellNm.toFixed(1)} nm · pitch 1.6 µm · spot ${(cd.diameterNm / 1000).toFixed(2)} µm reference`);
  set(g.bitsA, Array.from(bits.subarray(0, 32)).join(' ')); set(g.bitsB, Array.from(bits.subarray(32)).join(' '));
  set(g.trackResult, !lit ? 'Stored marks remain, but no transitions are retrieved' : `${number(s.receivedCells)} cells retrieved; both pit and land levels reflect`);

  const exampleIndex = p.jobs.length - 1, example = p.jobs[exampleIndex], exampleCells = s.activeIndex === exampleIndex ? s.localReceived : s.activeIndex > exampleIndex ? example.run.channel.bits.length : 0;
  const symbolFrame = 60, symbol = 0, first = symbolFrame * CD_FRAME_BITS + 44 + symbol * 17, arrived = exampleCells >= first + 14;
  const storedWord = example.run.channel.bits.subarray(first, first + 14);
  g.codeBits.forEach(({ box, text }, i) => { box.material.color.set(storedWord[i] ? 0xe6d6a8 : C.pale); set(text, String(storedWord[i])); });
  set(g.codeHeader, `${example.role} read: channel frame 60, data symbol 0`);
  const byte = arrived ? example.read.efm.frames[symbolFrame][symbol] : null;
  set(g.receivedWord, arrived ? `Received: ${Array.from(example.read.received.subarray(first, first + 14)).join(' ')}` : 'Received word: waiting for this part of the track');
  set(g.byteResult, byte === null ? 'No retrieved byte yet' : byte < 0 ? 'Invalid EFM word → known erasure' : `14 cells → byte ${byte} (0x${hex(byte)})`);
  set(g.codeProgress, `${s.checkedSectors} raw sectors checked; ${number(s.checkedBytes)} user bytes recovered`);

  const ready = s.checkedByJob[exampleIndex] > 0, sector = ready ? example.read.sectors[0] : null, address = example.run.firstLba;
  set(g.sectorId, `Example ${example.role} sector: LBA ${address} · address ${cdromMsf(address).label}`);
  set(g.sectorHeader, sector ? `Recovered header: ${Array.from(sector.bytes.slice(12, 16), hex).join(' ')} (hex)` : 'Recovered header: waiting for CIRC and a complete sector');
  set(g.sectorEdc, !ready ? 'EDC and parity: waiting' : sector.ok ? 'EDC and P/Q parity: pass' : `Sector unavailable: ${sector.missing} missing bytes; checks failed`);
  set(g.sectorProgress, `${s.checkedSectors} checked sectors · ${s.stats.failedSectors} failed · ${number(s.checkedBytes)} valid user bytes`);
  set(g.errorHeader, CDROM_LOSSES[s.values.loss]);
  for (let i = 0; i < 140; i++) {
    const offset = 1008 + i, f1 = Math.floor(offset / 24), symbolIndex = (offset % 24) ^ 1;
    const known = lit && exampleCells >= (f1 + 1 + CD_CIRC_TAIL) * CD_FRAME_BITS;
    const before = known ? example.read.circ.frames[f1][symbolIndex] : -1, after = ready ? sector.bytes[offset] : -1;
    g.grids[0][i].material.color.set(!known ? C.pale : before < 0 ? C.red : C.blue);
    g.grids[1][i].material.color.set(!ready ? C.pale : after < 0 ? C.red : before < 0 ? C.green : C.blue);
  }
  set(g.circCounts, `${s.stats.erased} words flagged · C1 repaired ${s.stats.c1Repaired} · C2 repaired ${s.stats.c2Repaired}`);
  set(g.repairCounts, `Sector parity repaired P ${s.stats.pRepaired} + Q ${s.stats.qRepaired} bytes`);
  set(g.failedCounts, `${s.stats.failedSectors} failed sectors · file ${s.fileReady ? 'available' : s.error || !lit ? 'unavailable' : 'waiting'}`);

  set(g.volumeLine, s.volumeReady ? `Sector 16 → volume ${s.volume.name}` : 'Sector 16 → volume descriptor waiting');
  set(g.rootLine, s.volumeReady ? `Volume descriptor → root directory at sector ${s.volume.root.extent}` : 'Directory address: not recovered yet');
  g.rows.forEach((row, i) => {
    const entry = s.directory?.[i]; set(row.name, entry ? entry.name : 'Waiting'); set(row.extent, entry ? number(entry.extent) : '…'); set(row.size, entry ? number(entry.size) : '…');
    row.highlight.material.color.set(entry && entry.name === s.entry?.name ? 0xd7e3cf : C.pale);
  });
  set(g.directoryResult, s.entry ? `Selected extent: ${s.entry.sectorCount} sector${s.entry.sectorCount === 1 ? '' : 's'} beginning at ${number(s.entry.extent)}` : s.error ? 'No reliable file location: stop before the file read' : 'A filename alone cannot locate its bytes');
  set(g.directoryBytes, s.entry ? `${number(s.entry.size)} file bytes; ${number(s.entry.sectorCount * 2048 - s.entry.size)} padding bytes excluded` : 'The directory length prevents sector padding from entering the file');
  set(g.fileHeader, s.fileReady ? `${s.entry.name} · ${number(s.file.length)} retrieved bytes` : s.error || !lit ? 'No complete file is available' : 'Read metadata and all file sectors first');
  set(g.fileResult, s.fileReady ? `Opened ${s.output.type === 'data' ? 'example data plot' : s.output.type === 'picture' ? 'decoded BMP picture' : 'recovered text'}` : 'Incomplete data never becomes a substitute file');

  const f = p.comparison, scale = .95, bottom = -.25, dataY = bottom + f.cover * scale, top = bottom + 1.2 * scale;
  g.cover.scale.y = f.cover * scale; g.cover.position.y = bottom + f.cover * scale / 2;
  g.backing.visible = f.backing > 0; g.backing.scale.y = f.backing * scale; g.backing.position.y = dataY + f.backing * scale / 2;
  g.dataLayer.position.y = dataY;
  const surfaceX = f.cover * scale * Math.tan(f.plasticHalfAngle * Math.PI / 180), lensX = surfaceX + (bottom + 1.50) * Math.tan(f.airHalfAngle * Math.PI / 180);
  g.lens.scale.x = 2 * lensX + .10;
  g.cones.forEach((o, i) => { const side = i ? 1 : -1; fillLine(o, [[side * lensX, -1.50, .13], [side * surfaceX, bottom, .13], [0, dataY, .13]]); });
  set(g.layerHeader, `${f.name} comparison: read layer ${f.cover.toFixed(1)} mm; total disc 1.2 mm`);
  set(g.layerLabel, `Pattern at the read-layer boundary · ${f.backing.toFixed(1)} mm backing above it`); g.layerLabel.position.y = top + .43;
  set(g.layerAngles, `Half-angle: air ${f.airHalfAngle.toFixed(1)}° · plastic ${f.plasticHalfAngle.toFixed(1)}° (n = ${f.index.toFixed(2)})`);
  g.columns.forEach((column, i) => column.highlight.material.color.set(i === s.values.format ? 0xd7e3cf : C.pale));
  set(g.comparisonNote, `${f.name} highlighted; the live drive still reads CD-ROM files`);
  set(g.phaseHeader, `${f.name} reference: h = ${f.depthNm.toFixed(1)} nm · optical depth λ/${f.denominator}`);
  g.phaseLines.forEach((o, j) => fillLine(o, Array.from({ length: 181 }, (_, i) => {
    const angle = i / 180 * 4 * Math.PI, first = Math.sin(angle), second = Math.sin(angle + f.radians), value = j === 0 ? first : j === 1 ? second : (first + second) / 2;
    return [-2.70 + 5.4 * i / 180, [1.26, .20, -.86][j] + .25 * value, .12];
  })));
  set(g.phaseResult, `${(f.radians * 180 / Math.PI).toFixed(0)}° phase difference → ${(100 * f.intensity).toFixed(0)}% normalized intensity`);



  const radius = 1.27 * s.spiral.radiusMm / 58, angle = -s.spiral.angle, px = -1.20 + radius * Math.cos(angle), py = .60 + radius * Math.sin(angle);
  g.spinMarker.position.set(px, py, .13); fillLine(g.radiusGuide, [[-1.20, .60, .12], [px, py, .12]]);
  ['1.2 m/s track speed', `${s.spiral.rpm.toFixed(1)} rpm here`, `${s.spiral.radiusMm.toFixed(4)} mm radius`, '75 sectors/s at 1×', '153,600 user bytes/s'].forEach((value, i) => set(g.spinReadouts[i], value));
  set(g.spinProgress, `This read moves outward ${s.spiral.travelMicrometers.toFixed(3)} µm; ${s.spiral.turns.toFixed(3)} turns`);
  set(g.spinStage, s.seeking ? 'Seek: move to the address recovered from metadata' : `${job.role} read at sector ${s.currentLba}; inner ${s.spiral.innerRpm.toFixed(1)} → outer ${s.spiral.outerRpm.toFixed(1)} rpm`);
  const bytes = CDROM_CAPACITY_SECTORS * 2048;
  [
    '4,321,800 channel cells each second at 1×',
    '÷ 588 cells/frame = 7,350 channel frames/s',
    '÷ 98 frames/sector = 75 sectors/s',
    '× 2,048 user bytes = 153,600 bytes/s (150 KiB/s)',
    '74 × 60 × 75 = 333,000 sectors',
    `${number(bytes)} user bytes = ${(bytes / 1048576).toFixed(1)} MiB`,
    `At 1.2 m/s: ${(74 * 60 * 1.2 / 1000).toFixed(3)} km of track`,
    `This sample: five file sectors plus directory and volume metadata`,
  ].forEach((value, i) => set(g.capacityLines[i], value));
}

import * as THREE from 'three';
import { fillLine, lineObject, textLabel } from './scene-kit.js';
import { DVD_SECTOR_BITS, DVD_SYNC_BITS, DVD_USER_BYTES } from './dvd-codec.js';
import { dvdComparison, DVD_REFERENCE, DVD_LOSSES } from './dvd-physics.js';

const C = { ink: 0x374736, paper: 0xfbf6e9, pale: 0xe7dfce, blue: 0x397b94, gold: 0xb08a38, red: 0xc14f39, green: 0x78a477, gray: 0xa8b4a4, purple: 0x8063a3 };
const label = (p, text, x, y, w = 5.8, h = .19, z = .13) => textLabel(p, text, { width: w, height: h, position: [x, y, z] });
const line = (p, points, color = C.gray) => { const o = lineObject(points.length, color, p); fillLine(o, points); return o; };
const own = o => { o.material = o.material.clone(); return o; };
const flat = (o, color) => { o.material = new THREE.MeshBasicMaterial({ color }); return o; };
const set = (o, text) => o.userData.setText(text);
const hex = x => x < 0 ? '?' : x.toString(16).toUpperCase().padStart(2, '0');
const number = x => x.toLocaleString('en-US');

export function createDvdDetails(kit, hardware) {
  const details = [], panels = {};
  const panel = (id, name, description, title) => {
    const p = kit.part(id, name, description, [0, 0, 0], hardware.system);
    p.userData.inspectionOnly = id; p.userData.explosionExcluded = true; details.push(p); panels[id] = p;
    flat(kit.box([6.12, 5.45, .035], [0, -.04, -.08], C.paper, p), C.paper);
    label(p, title, 0, 2.42, 5.8, .25); return p;
  };
  const optics = panel('optics', 'Laser to detector', 'The 650 nm laser is focused through a 0.6 mm clear substrate. A polarizing splitter and quarter-wave plate route returned light to the detector. Both pits and lands reflect. Diffraction changes the collected signal; the digital model starts after ideal transition detection.', 'RETURNED LIGHT STARTS THE DATA PATH');
  flat(kit.box([4.4, .22, .1], [.3, 1.50, 0], C.blue, optics), 0xbdd5d9);
  kit.box([4.4, .014, .11], [.3, 1.62, .01], C.ink, optics);
  label(optics, 'Reflective pattern above 0.6 mm of clear plastic', .1, 1.95, 5.5, .19);
  kit.box([.68, .35, .13], [-2.1, -.55, 0], C.ink, optics); label(optics, '650 nm laser', -2.1, -.97, 1.4, .17);
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

  const track = panel('track', 'Stored marks and transitions', 'This patch uses the actual EFMplus recording. A one marks a change of pit or land level. The DVD spot circle is a scalar Airy first-dark-ring reference, not a measured detector profile. Both levels reflect light.', 'A TRANSITION IS A CHANNEL ONE');
  const trackTitle = label(track, '', 0, 2.01, 5.8, .18), trackScale = label(track, '', 0, 1.69, 5.8, .17);
  const pits = Array.from({ length: 64 }, () => own(kit.box([1, .15, .055], [0, 1.02, .055], C.ink, track)));
  line(track, [[-2.6, 1.02, .015], [2.6, 1.02, .015]], C.gray);
  const neighbors = [lineObject(2, C.gray, track), lineObject(2, C.gray, track)];
  const spot = own(kit.disk(1, .008, [0, 1.02, .12], C.red, track)); spot.material.transparent = true; spot.material.opacity = .20; spot.material.depthWrite = false;
  const spotRing = kit.ring(1, .013, [0, 1.02, .14], C.red, track), cursor = lineObject(2, C.red, track), levels = lineObject(128, C.blue, track);
  const dots = Array.from({ length: 64 }, () => kit.sphere(.022, [0, -.47, .12], C.gold, track));
  label(track, 'Ideal pit/land level; this is not analog detector voltage', 0, -.81, 5.8, .17);
  const bitsA = label(track, '', 0, -1.16, 5.8, .18), bitsB = label(track, '', 0, -1.46, 5.8, .18), trackResult = label(track, '', 0, -1.93, 5.8, .18);
  label(track, 'Data runs: 3T to 11T. The sync includes a distinctive 14T run.', 0, -2.42, 5.8, .17);

  const codec = panel('codec', 'Channel words into bytes', 'EFMplus uses four states to encode each eight-bit byte in sixteen channel cells. Some received words need the next word to resolve their byte value. No hidden encoder state is passed to the reader.', '16 CHANNEL CELLS BECOME AN 8-BIT BYTE');
  label(codec, 'One sector: 26 × (32 sync cells + 91 × 16 data cells)', 0, 2.01, 5.8, .19);
  label(codec, '38,688 channel cells carry 2,048 user bytes plus checks', 0, 1.65, 5.8, .19);
  const codeHeader = label(codec, '', 0, 1.20, 5.8, .17);
  const codeBits = Array.from({ length: 16 }, (_, i) => {
    const x = -2.60 + 5.20 * i / 15;
    return { box: flat(kit.box([.29, .36, .05], [x, .73, .03], C.pale, codec), C.pale), text: label(codec, '', x, .73, .26, .22) };
  });
  const receivedWord = label(codec, '', 0, .20, 5.8, .19), lookahead = label(codec, '', 0, -.26, 5.8, .18), byteResult = label(codec, '', 0, -.83, 5.8, .25);
  label(codec, 'Bytes → PI/PO repair → sector checks → MPEG-2 pictures', 0, -1.44, 5.8, .18);
  const codeProgress = label(codec, '', 0, -1.89, 5.8, .18);
  label(codec, 'Codeword choice also keeps the recorded digital sum small', 0, -2.43, 5.8, .17);

  const sectors = panel('sectors', 'Inside a DVD sector', 'Each 2,064-byte data frame contains a sector ID, ID parity, management bytes, 2,048 payload bytes and a four-byte EDC. Only main data is scrambled. Sixteen frames form a PI/PO error-correction block before parity rows are interleaved.', 'SECTOR CHECKS PROTECT THE COMPRESSED BYTES');
  label(sectors, 'DATA FRAME: 2,064 bytes before scrambling', 0, 2.00, 5.8, .20);
  const fields = [['ID', '4', .72], ['IED', '2', .72], ['Context', '6', .91], ['Main data', '2,048', 2.11], ['EDC', '4', .84]];
  let x = -2.65;
  for (const [name, count, width] of fields) {
    flat(kit.box([width - .04, .65, .04], [x + width / 2, 1.28, .03], C.pale, sectors), name === 'Main data' ? 0xbdd5d9 : 0xe6d6a8);
    label(sectors, name, x + width / 2, 1.37, width - .06, .16); label(sectors, count, x + width / 2, 1.09, width - .06, .17); x += width;
  }
  label(sectors, 'Field boxes are labeled, not drawn in byte-width proportion', 0, 0.72, 5.8, .16);
  label(sectors, '16 frames → 192 rows × 172 bytes', 0, .33, 5.8, .21);
  label(sectors, 'Add 16 outer-parity rows and 10 inner-parity columns', 0, -.08, 5.8, .18);
  label(sectors, 'Interleave: 12 data rows + 1 outer-parity row per sector', 0, -.50, 5.8, .18);
  const sectorId = label(sectors, '', 0, -1.02, 5.8, .21), sectorEdc = label(sectors, '', 0, -1.46, 5.8, .20), sectorProgress = label(sectors, '', 0, -1.93, 5.8, .18);
  label(sectors, 'A failed EDC keeps that sector out of the video decoder', 0, -2.43, 5.8, .17);

  const errors = panel('errors', 'PI and PO repair', 'Inner parity repairs up to ten known byte erasures per row. Outer parity repairs up to sixteen per column. This example injects unreadable channel words, not a calibrated physical scratch. A larger rectangle exceeds both limits.', 'TWO DIRECTIONS OF PARITY REPAIR MISSING BYTES');
  const errorHeader = label(errors, '', 0, 2.01, 5.8, .18);
  label(errors, 'RECEIVED', -1.42, 1.65, 2.55, .18); label(errors, 'AFTER PI + PO', 1.42, 1.65, 2.55, .18);
  const grids = [-1.42, 1.42].map(center => Array.from({ length: 238 }, (_, i) => {
    const col = i % 14, row = Math.floor(i / 14);
    return flat(kit.box([.153, .12, .035], [center + (col - 6.5) * .169, 1.32 - row * .133, .02], C.pale, errors), C.pale);
  }));
  label(errors, 'Rows 0–16 and columns 19–32 of one 208 × 182 block', 0, -1.10, 5.8, .17);
  const repairCounts = label(errors, '', 0, -1.53, 5.8, .19), failedCounts = label(errors, '', 0, -1.93, 5.8, .19);
  label(errors, 'Gray waiting · blue received · red missing · green repaired', 0, -2.43, 5.8, .16);

  const video = panel('video', 'Decoded video output', 'The screen displays actual recovered MPEG-2 frames at 25 Hz. This authored stream uses 720 by 576 progressive I-pictures made of flat 8 by 8 blocks, 4:2:0 color and no motion prediction. A picture with missing compressed bytes stays unavailable.', 'THE SCREEN USES ONLY RETRIEVED VIDEO BYTES');
  const videoHeader = label(video, '', 0, 2.02, 5.8, .17);
  kit.box([4.08, 3.08, .045], [0, .26, .01], C.ink, video);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ map: hardware.videoTexture })); screen.position.set(0, .26, .05); video.add(screen);
  const videoResult = label(video, '', 0, -1.51, 5.8, .19);
  const frameStrip = Array.from({ length: 50 }, (_, i) => flat(kit.box([.094, .14, .025], [-2.5 + (i + .5) * .1, -1.85, .04], C.pale, video), C.pale));
  const videoValues = label(video, '', 0, -2.12, 5.8, .16);
  label(video, 'Frame strip: green decoded · red unavailable · gray waiting', 0, -2.46, 5.8, .15);

  const layers = panel('layers', 'Cover layer and light cone', 'The comparison changes the diagram, while the player remains a DVD player. Numerical aperture defines the cone angle in air. Refraction narrows that angle in plastic. The transparent read layer is 1.2 mm for CD, 0.6 mm for DVD and 0.1 mm for Blu-ray.', 'WIDER APERTURE; THINNER TRANSPARENT READ LAYER');
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
  label(phase, 'Equal-wave intensity is not the standard’s I3/I14 detector test', 0, -2.43, 5.8, .16);

  const spin = panel('spin', 'Spindle speed and outward tracking', 'The player keeps 3.49 m/s reference track speed. An inner track needs more rpm. Actual radius and angle use the 0.74 micrometer pitch, with the thin-spiral approximation r² = r₀² + pvt/π. The large spiral drawing exaggerates turn spacing.', 'THE OUTER TRACK NEEDS FEWER REVOLUTIONS');
  kit.ring(1.27, .024, [-1.20, .60, .03], C.gray, spin); kit.ring(.164, .017, [-1.20, .60, .04], C.gray, spin);
  const spiral = lineObject(1601, C.blue, spin), spinMarker = kit.sphere(.055, [-1.20, .60, .12], C.red, spin), radiusGuide = lineObject(2, C.red, spin);
  fillLine(spiral, Array.from({ length: 1601 }, (_, i) => { const a = 16 * 2 * Math.PI * i / 1600, r = 1.27 * (24 + 34 * i / 1600) / 58; return [-1.20 + r * Math.cos(a), .60 + r * Math.sin(a), .06]; }));
  const spinReadouts = [1.55, 1.08, .61, .14, -.33].map(y => label(spin, '', 1.35, y, 2.50, .18));
  label(spin, 'Coarse spiral diagram', -1.2, -1.00, 2.7, .17);
  const spinProgress = label(spin, '', 0, -1.37, 5.8, .18);
  line(spin, [[-2.55, -1.77, .06], [2.55, -1.77, .06]], C.gray); const drift = kit.sphere(.054, [-2.55, -1.77, .12], C.gold, spin);
  const driftLabel = label(spin, '', 0, -2.09, 5.8, .18); label(spin, 'Rotation follows actual read time, shown with two stated slowdowns', 0, -2.44, 5.8, .16);

  const capacity = panel('capacity', 'From track length to useful capacity', 'This ideal geometric estimate uses a 24 to 58 mm data zone, 0.74 micrometer pitch and 3.49 m/s at 26.15625 million channel cells per second. Sector framing and parity reduce channel capacity to user capacity. It is not a claim about every disc’s exact sector count.', 'ONLY PART OF THE CHANNEL PATTERN IS USER DATA');
  const capacityLines = [1.92, 1.43, .94, .45, -.04, -.53, -1.02, -1.51].map(y => label(capacity, '', 0, y, 5.8, .21));
  label(capacity, 'Nominal single-layer capacity: 4.7 GB, using decimal gigabytes', 0, -2.03, 5.8, .18);
  label(capacity, 'Faster spinning changes read rate; it does not add stored sectors', 0, -2.43, 5.8, .16);
  return { details, panels, outgoing, returning, lightStatus, trackTitle, trackScale, pits, neighbors, spot, spotRing, cursor, levels, dots, bitsA, bitsB, trackResult,
    codeHeader, codeBits, receivedWord, lookahead, byteResult, codeProgress, sectorId, sectorEdc, sectorProgress, errorHeader, grids, repairCounts, failedCounts, errorKey: null,
    screen, frameStrip, videoHeader, videoResult, videoValues, layerHeader, backing, cover, dataLayer, layerLabel, lens, cones, layerAngles, columns, comparisonNote, phaseHeader, phaseLines, phaseResult,
    spinMarker, radiusGuide, spinReadouts, spinProgress, drift, driftLabel, capacityLines };
}

export function updateDvdDetails(g, s, p) {
  const lit = !!s.values.laser, beam = lit && s.reading;
  fillLine(g.outgoing, beam ? [[-1.75, -.55, .16], [-.47, -.55, .16], [.16, -.55, .16], [.92, -.55, .16], [.92, .65, .16], [.92, 1.62, .16]] : []);
  fillLine(g.returning, beam ? [[1.0, 1.62, .17], [1.0, .65, .17], [1.0, -.47, .17], [.16, -.47, .17], [-.39, -.47, .17], [-.39, -1.34, .17]] : []);
  set(g.lightStatus, !lit ? 'Laser off: there is no optical signal to decode' : s.reading ? 'Ideal transition detection feeds the sector decoder' : 'Reading finished; the buffer now supplies the video decoder');
  const total = p.disc.channel.bits.length, start = Math.min(total - 64, Math.floor(Math.min(s.cells, total - 1) / 64) * 64), width = 5.2 / 64;
  const levels = p.disc.levels.subarray(start, start + 64), bits = p.disc.channel.bits.subarray(start, start + 64), dvd = dvdComparison(1);
  let at = 0, used = 0;
  while (at < 64) { let end = at + 1; while (end < 64 && levels[end] === levels[at]) end++;
    if (levels[at] < 0) { const pit = g.pits[used++]; pit.visible = true; pit.position.x = -2.6 + (at + end) * width / 2; pit.scale.x = (end - at) * width; } at = end;
  }
  for (let i = used; i < g.pits.length; i++) g.pits[i].visible = false;
  const pitch = 740 / dvd.cellNm * width, spotRadius = dvd.diameterNm / dvd.cellNm * width / 2, x = -2.6 + Math.min(64, Math.max(0, s.cells - start)) * width;
  g.neighbors.forEach((o, i) => fillLine(o, [[-2.6, 1.02 + (i ? 1 : -1) * pitch, .025], [2.6, 1.02 + (i ? 1 : -1) * pitch, .025]]));
  g.spot.scale.setScalar(spotRadius); g.spot.position.x = x; g.spot.visible = lit;
  g.spotRing.scale.set(spotRadius, spotRadius, 1); g.spotRing.position.x = x; g.spotRing.visible = lit;
  fillLine(g.cursor, [[x, -.52, .14], [x, 1.52, .14]]);
  fillLine(g.levels, Array.from(levels, (value, i) => [[-2.6 + i * width, -.03 + value * .18, .12], [-2.6 + (i + 1) * width, -.03 + value * .18, .12]]).flat());
  g.dots.forEach((o, i) => { o.position.x = -2.6 + i * width; o.visible = !!bits[i]; });
  set(g.trackTitle, `Stored cells ${number(start)}–${number(start + 63)} · dark marks are one pit/land level`);
  set(g.trackScale, `Cell ${dvd.cellNm.toFixed(1)} nm · pitch 0.74 µm · spot reference ${(dvd.diameterNm / 1000).toFixed(2)} µm`);
  set(g.bitsA, Array.from(bits.subarray(0, 32)).join(' ')); set(g.bitsB, Array.from(bits.subarray(32)).join(' '));
  set(g.trackResult, !lit ? 'Stored pattern remains; no transitions reach the reader' : `${number(s.receivedCells)} channel cells retrieved; ones mark level changes`);

  const exampleBlock = p.read?.block ?? Math.floor(p.disc.sectors / 32), position = exampleBlock * 37856 + 20;
  const first = Math.floor(position / 91) * DVD_SYNC_BITS + 32 + (position % 91) * 16, arrived = s.receivedCells >= first + 32;
  const storedWord = p.disc.channel.bits.subarray(first, first + 16);
  g.codeBits.forEach(({ box, text }, i) => { box.material.color.set(storedWord[i] ? 0xe6d6a8 : C.pale); set(text, String(storedWord[i])); });
  set(g.codeHeader, `Example recording byte ${number(position)}: stored 16-cell word`);
  const received = arrived ? p.read.received.subarray(first, first + 16) : null, byte = arrived ? p.read.efm.recording[position] : null;
  set(g.receivedWord, received ? `Received: ${Array.from(received, x => x < 0 ? '?' : x).join('')}` : 'Received: waiting for this part of the track');
  set(g.lookahead, arrived ? `Next word: ${Array.from(p.read.received.subarray(first + 16, first + 32), x => x < 0 ? '?' : x).join('')}` : 'The next word resolves ambiguous table entries');
  set(g.byteResult, byte === null ? 'No retrieved byte yet' : byte < 0 ? 'Unreadable word → known erasure' : `16 cells → byte ${byte} (0x${hex(byte)})`);
  set(g.codeProgress, `${number(s.decodedSymbols)} recording symbols demodulated · ${s.availableFrames} frames available`);
  const sectorIndex = exampleBlock * 16, ready = s.blocks > exampleBlock, sector = ready ? p.read.recovered.sectors[sectorIndex] : null;
  set(g.sectorId, sector?.address !== null && sector ? `Example sector address: 0x${sector.address.toString(16).toUpperCase()}` : `Example sector ${sectorIndex}: ${ready ? 'ID unavailable' : 'waiting for complete ECC block'}`);
  set(g.sectorEdc, !ready ? 'ID parity and EDC: waiting' : sector.valid ? 'ID parity and EDC: both pass' : 'Sector check failed: its 2,048 bytes stay unavailable');
  set(g.sectorProgress, `${number(s.checkedBytes)} checked user bytes · ${s.stats.failedSectors} failed sectors so far`);

  set(g.errorHeader, DVD_LOSSES[s.values.loss]);
  const errorKey = `${p.disc.key}:${s.values.loss}:${s.values.laser}:${s.blocks}:${Math.floor(s.receivedCells / DVD_SYNC_BITS)}`;
  if (errorKey !== g.errorKey) {
    g.errorKey = errorKey;
    for (let i = 0; i < 238; i++) {
      const row = Math.floor(i / 14), col = 19 + i % 14, pos = exampleBlock * 37856 + (row + Math.floor(row / 12)) * 182 + col;
      const cellEnd = Math.floor(pos / 91) * DVD_SYNC_BITS + 32 + (pos % 91 + 2) * 16;
      const known = s.receivedCells >= cellEnd, before = known ? p.read.efm.recording[pos] : -1;
      const after = ready ? p.read.recovered.eccBlocks[exampleBlock][row * 182 + col] : -1;
      g.grids[0][i].material.color.set(!known ? C.pale : before < 0 ? C.red : C.blue);
      g.grids[1][i].material.color.set(!ready ? C.pale : after < 0 ? C.red : before < 0 ? C.green : C.blue);
    }
  }
  set(g.repairCounts, `Flagged ${s.stats.erased} · PI repaired ${s.stats.piRepaired} · PO repaired ${s.stats.poRepaired}`);
  set(g.failedCounts, `${s.stats.failedSectors} failed sectors; ${s.availableFrames} complete video frames available`);

  set(g.videoHeader, `${p.disc.name} · ${s.availableFrames} / 50 frames available · 720 × 576 → 4:3 display`);
  set(g.videoResult, !lit ? 'Laser off: no decoded picture' : !s.displaying ? 'Read and check the compressed bytes first' : !s.picture ? `Frame ${s.frameIndex + 1}: compressed data unavailable` : `Frame ${s.frameIndex + 1} · ${(s.frameIndex / 25).toFixed(2)} s · ${number(s.picture.end - s.picture.offset)} compressed bytes`);
  const center = s.picture?.blocks.subarray((18 * 45 + 22) * 6, (18 * 45 + 22) * 6 + 6);
  set(g.videoValues, center ? `Center tile: Y ${center[0]}, Cb ${center[4]}, Cr ${center[5]} · recovered DC values` : 'Each macroblock holds four luma blocks and two color blocks');
  g.frameStrip.forEach((cell, i) => {
    const frame = p.read?.video.frames.find(frame => frame.reference === i);
    const available = frame?.valid && frame.end <= s.availableBytes;
    cell.material.color.set(available ? C.green : s.readComplete ? C.red : C.pale);
    cell.scale.y = s.displaying && s.frameIndex === i ? 1.45 : 1;
  });

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
  set(g.comparisonNote, s.values.format === 1 ? 'A hypothetical 2T DVD run is below its coding minimum, not proven invisible' : `${f.name} highlighted; the live player still reads the DVD clip`);
  set(g.phaseHeader, `${f.name} reference: h = ${f.depthNm.toFixed(1)} nm · optical depth λ/${f.denominator}`);
  g.phaseLines.forEach((o, j) => fillLine(o, Array.from({ length: 181 }, (_, i) => {
    const angle = i / 180 * 4 * Math.PI, first = Math.sin(angle), second = Math.sin(angle + f.radians), value = j === 0 ? first : j === 1 ? second : (first + second) / 2;
    return [-2.70 + 5.4 * i / 180, [1.26, .20, -.86][j] + .25 * value, .12];
  })));
  set(g.phaseResult, `${(f.radians * 180 / Math.PI).toFixed(0)}° phase difference → ${(100 * f.intensity).toFixed(0)}% normalized intensity`);

  const radius = 1.27 * s.spiral.radiusMm / 58, angle = -s.spiral.angle, px = -1.20 + radius * Math.cos(angle), py = .60 + radius * Math.sin(angle);
  g.spinMarker.position.set(px, py, .13); fillLine(g.radiusGuide, [[-1.20, .60, .12], [px, py, .12]]);
  [`3.49 m/s track speed`, `${s.spiral.rpm.toFixed(1)} rpm here`, `${s.spiral.radiusMm.toFixed(4)} mm radius`, `At 24 mm: ${s.spiral.innerRpm.toFixed(1)} rpm`, `At 58 mm: ${s.spiral.outerRpm.toFixed(1)} rpm`].forEach((value, i) => set(g.spinReadouts[i], value));
  set(g.spinProgress, `Outward travel ${s.spiral.travelMicrometers.toFixed(3)} µm through ${s.spiral.turns.toFixed(3)} turns`);
  const end = Math.sqrt(p.disc.placement.start ** 2 + DVD_REFERENCE.pitch * DVD_REFERENCE.velocity * p.disc.seconds / Math.PI), travel = (end - p.disc.placement.start) * 1e6;
  g.drift.position.x = -2.55 + 5.10 * Math.min(1, s.spiral.travelMicrometers / travel);
  set(g.driftLabel, `Full bar represents ${travel.toFixed(3)} µm of real outward travel`);
  const placement = p.disc.placement, cells = placement.referenceLength / (DVD_REFERENCE.velocity / 26156250), efficiency = DVD_USER_BYTES * 8 / DVD_SECTOR_BITS;
  [
    `Reference recorded radii: 24 to 58 mm`,
    `Spiral length ≈ ${(placement.referenceLength / 1000).toFixed(2)} km at 0.74 µm pitch`,
    `Channel length ≈ ${(DVD_REFERENCE.velocity / 26156250 * 1e9).toFixed(1)} nm per cell`,
    `Track space ≈ ${(cells / 1e9).toFixed(2)} billion channel cells`,
    `One sector: 38,688 cells → 2,048 user bytes`,
    `Useful-data fraction: ${(100 * efficiency).toFixed(2)}% of channel cells`,
    `Estimated usable capacity: ${(placement.capacityBytes / 1e9).toFixed(3)} GB`,
    `This clip: ${number(p.disc.videoBytes)} MPEG-2 bytes in ${p.disc.sectors} sectors`,
  ].forEach((value, i) => set(g.capacityLines[i], value));
}

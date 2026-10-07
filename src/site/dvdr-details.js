import * as THREE from 'three';
import { fillLine, lineObject, textLabel } from './scene-kit.js';
import { DVDR_TIMING, DVDR_FILE_TRACE, DVDR_POWER } from './dvdr-physics.js';
import { dvdrRunAt, dvdrReferencePulses, DVDR_CHANNEL_CELLS } from './dvdr-medium.js';

const C = { paper: 0xfbf6e9, ink: 0x374736, pale: 0xe7dfce, dye: 0xd4b49c, mark: 0x705135, blue: 0x397b94, red: 0xc14f39, gold: 0xb08a38, green: 0x398064, gray: 0xa8b4a4 };
const label = (p, text, x, y, w = 5.8, h = .19, z = .14) => textLabel(p, text, { width: w, height: h, position: [x, y, z] });
const flat = (o, color) => { o.material = new THREE.MeshBasicMaterial({ color }); return o; };
const set = (o, text) => o.userData.setText(text);
const line = (p, points, color) => { const o = lineObject(points.length, color, p); fillLine(o, points); return o; };
const n = x => x.toLocaleString('en-US');
const bits = byte => byte.toString(2).padStart(8, '0');
const X = cell => -2.6 + (cell - DVDR_TIMING.windowStart) / 40 * 5.2;

export function createDvdrDetails(kit, hardware) {
  const details = [], panels = {};
  const panel = (id, name, description, title) => {
    const p = kit.part(id, name, description, [0, 0, 0], hardware.system);
    p.userData.inspectionOnly = id; p.userData.explosionExcluded = true; details.push(p); panels[id] = p;
    flat(kit.box([6.12, 5.45, .035], [0, -.04, -.08], C.paper, p), C.paper); label(p, title, 0, 2.42, 5.8, .25); return p;
  };
  const track = panel('track', 'Watch permanent dye marks form', 'This magnified 40-cell patch includes the actual channel word carrying byte 4,132 of the selected file, counting from zero. Recording completes dye marks; reading senses their boundaries without erasing them. A channel one means a transition, not a dark input bit. Mark formation and transition detection are idealized.', 'WRITE THE MATERIAL; READ ITS BOUNDARIES');
  const trackTitle = label(track, '', 0, 1.99, 5.8, .18);
  label(track, 'DYE LAYER · dark means permanently changed', 0, 1.60, 5.8, .18);
  const markCells = Array.from({ length: 40 }, (_, i) => flat(kit.box([.129, .38, .04], [X(DVDR_TIMING.windowStart + i + .5), 1.14, .03], C.dye, track), C.dye));
  const wordBand = flat(kit.box([16 * .13, .065, .03], [X(DVDR_FILE_TRACE.firstCell + 8), .83, .03], C.gold, track), C.gold);
  label(track, 'Gold underline: 16-cell word carrying one scrambled file byte', 0, .51, 5.8, .16);
  label(track, 'RECEIVED TRANSITIONS · a dot means channel 1', 0, .04, 5.8, .18);
  line(track, [[-2.6, -.36, .02], [2.6, -.36, .02]], C.gray);
  const readDots = Array.from({ length: 40 }, (_, i) => flat(kit.disk(.043, .012, [X(DVDR_TIMING.windowStart + i), -.36, .09], C.green, track), C.green));
  const readCells = Array.from({ length: 40 }, (_, i) => flat(kit.box([.09, .018, .025], [X(DVDR_TIMING.windowStart + i + .5), -.55, .04], C.gray, track), C.gray));
  const trackCursor = lineObject(2, C.red, track), spot = flat(kit.disk(.16, .008, [0, 1.14, .12], C.red, track), C.red);
  spot.material.transparent = true; spot.material.opacity = .45; spot.material.depthWrite = false;
  const trackStage = label(track, '', 0, -1.00, 5.8, .19), trackCounts = label(track, '', 0, -1.48, 5.8, .18), trackResult = label(track, '', 0, -1.95, 5.8, .18);
  label(track, 'Data runs: 3–11 cells; sync permits 14. Marks are not input bits.', 0, -2.43, 5.8, .16);

  const codec = panel('codec', 'Follow a file byte through coding', 'File byte 4,132 is in logical sector 26. Its data-frame position is 48 after the header. Scrambling, PI/PO coding and interleaving put it at recording-byte index 61,564; EFMplus maps it into a 16-cell word. Reading reverses these operations and checks the whole required file before playback.', 'FROM ONE FILE BYTE TO A CHANNEL WORD');
  const codeInput = label(codec, '', 0, 1.98, 5.8, .20);
  label(codec, 'File byte 4,132 → sector 26 → frame byte 48 → scrambling', 0, 1.53, 5.8, .17);
  const codeScrambled = label(codec, '', 0, 1.09, 5.8, .18);
  label(codec, 'WRITE PLAN · actual 16-cell EFMplus word', 0, .64, 5.8, .17);
  const codeBits = Array.from({ length: 16 }, (_, i) => ({ box: flat(kit.box([.29, .37, .04], [-2.55 + 5.10 * i / 15, .19, .03], C.pale, codec), C.pale), text: label(codec, '', -2.55 + 5.10 * i / 15, .19, .27, .22) }));
  const receivedWord = label(codec, '', 0, -.35, 5.8, .18), decodedWord = label(codec, '', 0, -.82, 5.8, .18), codeResult = label(codec, '', 0, -1.31, 5.8, .20);
  label(codec, 'Deinterleave → PI/PO checks → descramble → sector checks', 0, -1.84, 5.8, .17);
  label(codec, 'An occupied region can return an older file and a different byte', 0, -2.43, 5.8, .16);

  const pulsePanel = panel('pulses', 'Compare recording pulse strategies', 'The reference waveform uses the actual marked runs in this patch. A top pulse ends at 3T; longer marks add separated pulses ending at each later T. Three reference strategies change top and repeated-pulse widths. Actual power requires drive and medium calibration. This diagram is not a thermal solver.', 'A MARK CAN NEED SEVERAL LASER PULSES');
  label(pulsePanel, 'NOMINAL CODED MARKS · the same selected-file patch', 0, 1.96, 5.8, .17);
  const nominalCells = Array.from({ length: 40 }, (_, i) => flat(kit.box([.129, .26, .04], [X(DVDR_TIMING.windowStart + i + .5), 1.49, .03], C.dye, pulsePanel), C.dye));
  const pulseHeading = label(pulsePanel, '', 0, 1.01, 5.8, .17);
  const pulseLine = lineObject(300, C.red, pulsePanel), pulseCursor = lineObject(2, C.blue, pulsePanel);
  const pulseRun = label(pulsePanel, '', 0, -.51, 5.8, .20), pulseTiming = label(pulsePanel, '', 0, -.98, 5.8, .18), pulsePower = label(pulsePanel, '', 0, -1.44, 5.8, .18);
  label(pulsePanel, 'Cooling gaps separate pulses; complete marks remain in the dye', 0, -1.95, 5.8, .17);
  label(pulsePanel, 'Normalized write power; low bias schematic; no temperature prediction', 0, -2.43, 5.8, .15);

  const layers = panel('layers', 'Recording layer inside the disc', 'A single-sided DVD-R has a recording layer near its middle. Reading light passes through 0.6 mm of clear polycarbonate to organic dye next to a reflective layer. An adhesive bonds the second substrate above it. The thin recording stack is enlarged here; colors identify materials, not a particular product.', 'DYE NEAR THE MIDDLE OF A BONDED DISC');
  const layerSpecs = [[1.72, .63, 0xc6c8b6, 'Backing substrate · 0.6 mm'], [1.32, .10, 0xd9c8a5, 'Adhesive'], [1.16, .07, C.gold, 'Reflective metal'], [1.03, .10, C.dye, 'Organic dye'], [.63, .63, 0xbdd5d9, 'Clear substrate · 0.6 mm']];
  for (const [y, h, color, text] of layerSpecs) { flat(kit.box([2.7, h, .08], [-1.28, y, .01], color, layers), color); label(layers, text, 1.42, y, 2.70, .15); }
  const layerMark = flat(kit.box([.43, .10, .02], [-.72, 1.03, .065], C.mark, layers), C.mark);
  label(layers, 'Total: about 1.2 mm', 1.42, .15, 2.70, .17);
  label(layers, 'Thin recording stack enlarged', 1.42, -.21, 2.70, .14);
  flat(kit.box([.82, .13, .07], [-.72, -.72, .02], 0xbdd5d9, layers), 0xbdd5d9); label(layers, 'Objective', .78, -.72, 1.8, .18);
  const layerOutgoing = lineObject(3, C.red, layers), layerReturning = lineObject(3, C.gold, layers), layerStage = label(layers, '', 0, -1.38, 5.8, .18);
  label(layers, 'Both changed and unchanged material return some light', 0, -1.91, 5.8, .18);
  label(layers, 'DVD-R marks cannot be erased for reuse; DVD-RW uses different material', 0, -2.43, 5.8, .15);

  const groove = panel('pregroove', 'Guide groove and land pre-pits', 'The blank disc already has a wobbled spiral groove and pre-pits in the lands between groove turns. The groove guides recording; its wobble provides a timing reference. Land pre-pits carry address information. This enlarged schematic distinguishes those roles; it does not decode land pre-pits or simulate tracking servos.', 'A BLANK DISC ALREADY HAS GUIDES AND ADDRESSES');
  label(groove, 'Two adjacent groove turns · width and wobble exaggerated', 0, 1.96, 5.8, .17);
  for (const y of [1.30, .64]) {
    const guide = lineObject(321, C.blue, groove);
    fillLine(guide, Array.from({ length: 321 }, (_, i) => [-2.6 + 5.2 * i / 320, y + .10 * Math.sin(i / 320 * 16 * Math.PI), .07]));
  }
  for (const x of [-2.08, -.73, 1.33]) flat(kit.box([.13, .19, .06], [x, .97, .05], C.gold, groove), C.gold);
  const grooveSpot = flat(kit.disk(.08, .012, [0, 1.30, .13], C.red, groove), C.red);
  label(groove, 'Blue: guide groove · gold: pre-pits in the land between turns', 0, .20, 5.8, .17);
  const grooveSpeed = label(groove, '', 0, -.32, 5.8, .19), grooveRadius = label(groove, '', 0, -.80, 5.8, .18), grooveTime = label(groove, '', 0, -1.28, 5.8, .18);
  label(groove, 'Wobble gives timing; land pre-pits supply addresses', 0, -1.86, 5.8, .18);
  label(groove, '1×: 3.49 m/s · 0.74 µm pitch · no address decoder or servo simulation', 0, -2.43, 5.8, .15);

  const optics = panel('optics', 'Record with heat, retrieve with light', 'Focused recording pulses heat and permanently change dye. Lower reading exposure detects the resulting pattern without changing it. A splitter routes returned light toward a photodetector. The reference optical pickup uses a red wavelength near 650 nm and numerical aperture 0.60.', 'ONE OPTICAL PATH, TWO DIFFERENT EXPOSURES');
  flat(kit.box([4.6, .53, .06], [0, 1.11, .01], 0xbdd5d9, optics), 0xbdd5d9);
  flat(kit.box([4.6, .08, .05], [0, 1.42, .04], C.dye, optics), C.dye);
  flat(kit.box([4.6, .04, .05], [0, 1.50, .04], C.gold, optics), C.gold);
  label(optics, '0.6 mm clear substrate below the dye and reflector', 0, 1.99, 5.8, .17);
  kit.box([.72, .40, .10], [-2.15, -.65, .01], C.ink, optics); label(optics, 'Red laser', -2.15, -1.06, 1.4, .17);
  const opticalSplitter = kit.box([.50, .50, .08], [-.61, -.65, .01], C.pale, optics); line(optics, [[-.86, -.90, .10], [-.36, -.40, .10]], C.gray);
  label(optics, 'Splitter', .72, -.65, 1.25, .16);
  const opticalObjective = kit.box([.70, .14, .08], [-.61, .30, .01], 0xbdd5d9, optics); label(optics, 'Objective', .72, .30, 1.65, .17);
  const opticalDetector = kit.box([.72, .28, .08], [-.61, -1.46, .01], C.gold, optics); label(optics, 'Detector', .72, -1.46, 1.7, .18);
  const outgoing = lineObject(4, C.red, optics), returning = lineObject(4, C.gold, optics), opticalMode = label(optics, '', 0, -2.00, 5.8, .18);
  label(optics, 'Reference: 650 nm, NA 0.60 · schematic path, no analog voltage model', 0, -2.43, 5.8, .15);

  const files = panel('files', 'Find the recorded movie file', 'A small ISO 9660 volume gives the retrieved bytes a filename and location. Its primary volume descriptor at logical sector 16 points to root directory sector 20. The directory locates the movie at sector 24 and supplies its exact byte length. Required metadata and file sectors must validate before the recovered MPEG-2 file can play.', 'CHECKED SECTORS BECOME A USABLE FILE');
  const fileRequest = label(files, '', 0, 1.99, 5.8, .20);
  const fileRows = [];
  for (const [i, text] of ['Volume descriptor · sector 16 → root directory', 'Root directory · sector 20 → filename, location, size', 'Movie extent · starts at sector 24', 'MPEG-2 decoder → 50 pictures → displayed movie'].entries()) {
    const y = 1.37 - i * .70, box = flat(kit.box([5.45, .54, .04], [0, y, .01], C.pale, files), C.pale);
    const textObject = label(files, text, 0, y, 5.18, .17); fileRows.push({ box, text: textObject });
  }
  const fileStatus = label(files, '', 0, -1.62, 5.8, .18), fileBytes = label(files, '', 0, -2.02, 5.8, .17);
  label(files, '192 logical sectors · one ISO 9660 data file · not a DVD-Video title', 0, -2.43, 5.8, .15);

  const readback = panel('readback', 'Watch the retrieved movie', 'The screen plays pictures decoded from the recovered file. An occupied region keeps its original file even if another is requested. A blank region with insufficient writing exposure, or any read with light off, remains unavailable. Reset and changed controls prepare another experiment; they do not erase a physical DVD-R.', 'THE RECORDED FILE SUPPLIES THE MOVIE');
  const resultHeader = label(readback, '', 0, 1.99, 5.8, .18);
  flat(kit.box([4.78, 3.61, .045], [0, -.10, .01], C.ink, readback), C.ink);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.72, 3.54), new THREE.MeshBasicMaterial({ map: hardware.fileTexture, toneMapped: false })); screen.position.set(0, -.10, .05); readback.add(screen);
  const resultLine = label(readback, '', 0, -2.10, 5.8, .18);
  label(readback, 'Reset, replay and changed controls prepare another disc experiment', 0, -2.45, 5.8, .15);
  return { details, panels, markCells, wordBand, readDots, readCells, trackCursor, spot, trackTitle, trackStage, trackCounts, trackResult, codeInput, codeScrambled, codeBits, receivedWord, decodedWord, codeResult,
    nominalCells, pulseHeading, pulseLine, pulseCursor, pulseRun, pulseTiming, pulsePower, layerMark, layerOutgoing, layerReturning, layerStage, grooveSpot, grooveSpeed, grooveRadius, grooveTime,
    outgoing, returning, opticalSplitter, opticalObjective, opticalDetector, opticalMode, fileRequest, fileRows, fileStatus, fileBytes, resultHeader, resultLine, screen };
}

export function updateDvdrDetails(g, s, p) {
  const { windowStart, windowEnd } = DVDR_TIMING, f = DVDR_FILE_TRACE, position = s.writing ? s.writePosition : s.readPosition;
  const local = Math.max(windowStart, Math.min(windowEnd, position)), x = X(local), inPatch = (s.writing || s.reading) && position >= windowStart && position <= windowEnd;
  g.markCells.forEach((o, i) => o.material.color.set(s.windowMarks[i] ? C.mark : C.dye));
  g.readDots.forEach((o, i) => o.visible = s.windowReceived[i] === 1);
  g.readCells.forEach((o, i) => o.material.color.set(s.windowReceived[i] === null ? C.gray : C.blue));
  fillLine(g.trackCursor, inPatch ? [[x, -.69, .18], [x, 1.41, .18]] : []);
  g.spot.position.x = x; g.spot.visible = Boolean(inPatch && s.light); g.spot.material.color.set(s.exposing ? C.red : C.blue);
  set(g.trackTitle, `Actual cells ${n(windowStart)}–${n(windowEnd - 1)} · requested ${s.requestedName}`);
  set(g.trackStage, s.seeking ? 'Marks persist while the pickup returns' : s.time >= 11 ? s.storedMarks ? 'Reading finished; these marks remain' : 'Reading finished; the region remains blank' :
    s.writing ? s.canWrite ? 'Completed marks remain behind the writing spot' : 'No new marks: occupied region or no recording exposure' : s.values.readLight ? 'Reading boundaries without changing the dye' : 'Read light off: no transitions arrive');
  set(g.trackCounts, `${n(s.storedMarks)} marked cells · ${n(s.readReceived)} channel cells received`);
  set(g.trackResult, s.available ? `Checked file: ${s.storedName}` : s.time >= 11 ? 'No checked file available' : 'File output waits for metadata and file checks');

  const sourceByte = p.program.volume.file.bytes[f.fileByte], word = Array.from(p.program.channel.bits.subarray(f.firstCell, f.firstCell + 16)).join('');
  set(g.codeInput, `${s.requestedName} · byte 4,132 = ${bits(sourceByte)} (${sourceByte})`);
  set(g.codeScrambled, `Scrambled ${bits(p.program.recording[f.recordingByte])} → recording byte ${n(f.recordingByte)}`);
  g.codeBits.forEach(({ box, text }, i) => { box.material.color.set(word[i] === '1' ? 0xe6d6a8 : C.pale); set(text, word[i]); });
  set(g.receivedWord, s.receivedWord === null ? 'READ: this word has not arrived' : `READ: ${s.receivedWord.split('').join(' ')}`);
  set(g.decodedWord, s.decodedWordByte === null ? 'EFMplus waits for this word and its next-state information' : s.decodedWordByte < 0 ? 'No valid EFMplus byte recovered' : `EFMplus yields ${bits(s.decodedWordByte)}; still scrambled`);
  set(g.codeResult, s.available ? `${s.storedName} · checked byte ${bits(p.read.file.bytes[f.fileByte])}` : s.time >= 11 ? 'File unavailable; no source byte is substituted' : 'File byte waits for checked readback');

  g.nominalCells.forEach((o, i) => o.material.color.set(p.program.marks[windowStart + i] ? C.mark : C.dye));
  const points = [[X(windowStart), -.08, .10]], refs = []; let at = windowStart;
  while (at < windowEnd) {
    const run = dvdrRunAt(p.program, at), pulses = dvdrReferencePulses(run, s.values.pulseType); at = run.end;
    if (pulses.length) refs.push({ run, pulses });
    for (const pulse of pulses) {
      if (pulse.end <= windowStart || pulse.start >= windowEnd) continue;
      const start = Math.max(windowStart, pulse.start), end = Math.min(windowEnd, pulse.end);
      points.push([X(start), -.08, .10], [X(start), .50, .10], [X(end), .50, .10], [X(end), -.08, .10]);
    }
  }
  points.push([X(windowEnd), -.08, .10]); fillLine(g.pulseLine, points);
  fillLine(g.pulseCursor, s.writing && inPatch ? [[x, -.19, .15], [x, 1.68, .15]] : []);
  const ref = refs.find(({ run }) => s.writePosition >= run.start && s.writePosition < run.end) || refs.find(({ run }) => run.cells === 3) || refs[0];
  set(g.pulseHeading, `1× REFERENCE TYPE ${s.values.pulseType + 1} · normalized recording power`);
  set(g.pulseRun, `${ref.run.cells}T mark → ${ref.pulses.length} pulse${ref.pulses.length === 1 ? '' : 's'} · top ${ref.pulses[0].width.toFixed(2)}T`);
  set(g.pulseTiming, `Top: ${(ref.pulses[0].seconds * 1e9).toFixed(1)} ns · repeated width ${s.values.pulseType === 2 ? '0.60' : '0.65'}T`);
  set(g.pulsePower, `Experiment: ${p.initial.occupied ? 'occupied region; recording blocked' : DVDR_POWER[s.values.power].toLowerCase()}`);

  g.layerMark.visible = s.windowMarks.some(Boolean);
  fillLine(g.layerOutgoing, s.light ? [[-.86, -.65, .15], [-.77, .32, .15], [-.72, 1.16, .15]] : []);
  fillLine(g.layerReturning, s.light ? [[-.66, 1.16, .16], [-.60, .32, .16], [-.52, -.65, .16]] : []);
  g.layerOutgoing.material.color.set(s.exposing ? C.red : C.blue);
  set(g.layerStage, s.time >= 11 ? s.storedMarks ? 'Light is off; the dye retains the file' : 'The region is still blank' : s.seeking ? 'Moving the pickup does not erase material' : s.writing ? s.canWrite ? 'Focused recording exposure changes organic dye' : 'No new dye changes in this experiment' : s.values.readLight ? 'Low-power readout leaves the marks unchanged' : 'Dark readout retrieves nothing; any marks remain');
  const fraction = position / DVDR_CHANNEL_CELLS;
  g.grooveSpot.position.set(-2.6 + 5.2 * fraction, 1.30 + .10 * Math.sin(fraction * 16 * Math.PI), .13); g.grooveSpot.visible = s.writing || s.reading;
  set(g.grooveSpeed, s.seeking ? 'Returning to the region; motion is illustrative' : s.time >= 11 ? 'Disc passes finished; movie uses the retrieved file' : `1× ${s.writing ? 'write' : 'read'} pass: 3.49 m/s · ${s.spiral.rpm.toFixed(1)} rpm`);
  set(g.grooveRadius, `${s.spiral.radiusMm.toFixed(4)} mm radius · ${s.spiral.travelMicrometers.toFixed(3)} µm advance`);
  set(g.grooveTime, `Physical channel time: ${(s.writeSeconds * 1000).toFixed(3)} ms write · ${(s.readSeconds * 1000).toFixed(3)} ms read`);
  fillLine(g.outgoing, s.light ? [[-1.78, -.65, .14], [-.61, -.65, .14], [-.61, .30, .14], [-.61, 1.50, .14]] : []);
  fillLine(g.returning, s.light ? [[-.51, 1.50, .16], [-.51, .30, .16], [-.51, -.65, .16], [-.51, -1.32, .16]] : []);
  g.outgoing.material.color.set(s.exposing ? C.red : C.blue);
  set(g.opticalMode, !s.light ? 'Light off; existing marks remain' : s.exposing ? 'Recording pulse: energy changes the focused dye' : s.writing && s.canWrite ? 'Cooling gap between recording pulses' : 'Low-power exposure leaves the dye unchanged');

  set(g.fileRequest, `Requested file: ${s.requestedName}`);
  g.fileRows.forEach(({ box }) => box.material.color.set(s.available ? 0xd5e5d4 : C.pale));
  set(g.fileRows[1].text, s.available ? `Directory recovered: ${s.storedName}` : 'Root directory · sector 20 → filename, location, size');
  set(g.fileRows[2].text, s.available ? `Extent ${s.entry.extent} · ${s.entry.sectorCount} sectors · ${n(s.entry.size)} bytes` : 'Movie extent · starts at sector 24');
  set(g.fileStatus, s.available ? 'All required metadata and movie sectors validated' : s.time >= 11 ? 'No complete checked file; playback remains unavailable' : 'Readback must finish before the file is opened');
  set(g.fileBytes, s.available ? 'Decoded pictures come from retrieved file bytes' : `Writing plan: ${n(p.program.volume.file.bytes.length)} bytes in ${p.program.volume.file.sectorCount} file sectors`);
  set(g.resultHeader, s.available ? `Requested ${s.requestedName} → retrieved ${s.storedName}` : s.time >= 11 ? 'No movie recovered from this experiment' : 'Choose a file, write the region, then retrieve it');
  set(g.resultLine, s.available ? s.values.medium ? 'The original file survived the blocked replacement' : 'Permanent marks supplied the selected movie' : s.time >= 11 ? !s.values.readLight ? 'Read light off; any recorded file still remains on the disc' : 'Blank dye received no recording exposure' : 'The directory and file must be recovered before playback');
}

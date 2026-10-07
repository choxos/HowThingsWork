import * as THREE from 'three';
import { fillLine, lineObject, textLabel } from './scene-kit.js';
import { CDR_TIMING, CDR_POWER } from './cdr-physics.js';
import { cdrBits, cdrReferencePulse, CDR_BYTE_TRACE, CDR_CHANNEL_CELLS } from './cdr-medium.js';

const C = { paper: 0xfbf6e9, ink: 0x374736, pale: 0xe7dfce, dye: 0xdace9c, mark: 0x705135, blue: 0x397b94, red: 0xc14f39, gold: 0xb08a38, green: 0x398064, gray: 0xa8b4a4 };
const label = (p, text, x, y, w = 5.8, h = .19, z = .14) => textLabel(p, text, { width: w, height: h, position: [x, y, z] });
const flat = (o, color) => { o.material = new THREE.MeshBasicMaterial({ color }); return o; };
const set = (o, text) => o.userData.setText(text);
const line = (p, points, color) => { const o = lineObject(points.length, color, p); fillLine(o, points); return o; };
const n = x => x.toLocaleString('en-US');
const X = cell => -2.6 + (cell - CDR_TIMING.windowStart) / (CDR_TIMING.windowEnd - CDR_TIMING.windowStart) * 5.2;

export function createCdrDetails(kit, hardware) {
  const details = [], panels = {};
  const panel = (id, name, description, title) => {
    const p = kit.part(id, name, description, [0, 0, 0], hardware.system);
    p.userData.inspectionOnly = id; p.userData.explosionExcluded = true; details.push(p); panels[id] = p;
    flat(kit.box([6.12, 5.45, .035], [0, -.04, -.08], C.paper, p), C.paper); label(p, title, 0, 2.42, 5.8, .25); return p;
  };
  const track = panel('track', 'Watch the dye change', 'A magnified 40-cell patch contains the actual EFM word for your selected byte. Recording commits each completed dark run permanently. The read pass follows boundaries between marked and unmarked regions. A channel one means a transition, not a dark input bit. Mark formation and transition detection are idealized.', 'WRITE MARKS; LATER READ THEIR BOUNDARIES');
  const trackTitle = label(track, '', 0, 2.00, 5.8, .18);
  label(track, 'DYE LAYER · dark means permanently changed', 0, 1.62, 5.8, .18);
  const markCells = Array.from({ length: 40 }, (_, i) => flat(kit.box([.129, .38, .04], [X(CDR_TIMING.windowStart + i + .5), 1.15, .03], C.dye, track), C.dye));
  const wordBand = flat(kit.box([14 * .13, .065, .03], [X(CDR_BYTE_TRACE.firstCell + 7), .84, .03], C.gold, track), C.gold);
  label(track, 'Gold underline: 14-cell word carrying the selected byte', 0, .53, 5.8, .16);
  label(track, 'RECEIVED TRANSITIONS · a dot means channel 1', 0, .06, 5.8, .18);
  line(track, [[-2.6, -.36, .02], [2.6, -.36, .02]], C.gray);
  const readDots = Array.from({ length: 40 }, (_, i) => flat(kit.disk(.043, .012, [X(CDR_TIMING.windowStart + i), -.36, .09], C.green, track), C.green));
  const readCells = Array.from({ length: 40 }, (_, i) => flat(kit.box([.09, .018, .025], [X(CDR_TIMING.windowStart + i + .5), -.55, .04], C.gray, track), C.gray));
  const trackCursor = lineObject(2, C.red, track), spot = flat(kit.disk(.16, .008, [0, 1.15, .12], C.red, track), C.red);
  spot.material.transparent = true; spot.material.opacity = .45; spot.material.depthWrite = false;
  const trackStage = label(track, '', 0, -1.01, 5.8, .20), trackCounts = label(track, '', 0, -1.48, 5.8, .19), trackResult = label(track, '', 0, -1.93, 5.8, .18);
  label(track, 'Runs span 3–11 channel cells; marks are not one-to-one input bits', 0, -2.43, 5.8, .16);

  const codec = panel('codec', 'Follow your byte through coding', 'Your byte is the first of 2,048 user bytes in one Mode 1 sector. Sector checks, scrambling, CIRC and EFM produce its actual recorded word. CIRC moves this byte to channel frame 22, data symbol 5 in the finite excerpt. Reading reverses the real codes and validates the whole sector before releasing the user byte.', 'ONE CHOSEN BYTE TAKES A REAL CODING PATH');
  const codeInput = label(codec, '', 0, 1.96, 5.8, .23);
  label(codec, 'User byte 0 → sector byte 16 → scrambling → CIRC', 0, 1.49, 5.8, .18);
  const codeScrambled = label(codec, '', 0, 1.07, 5.8, .19);
  label(codec, 'WRITE: actual 14-cell EFM word', 0, .63, 5.8, .17);
  const codeBits = Array.from({ length: 14 }, (_, i) => ({ box: flat(kit.box([.32, .37, .04], [-2.53 + 5.06 * i / 13, .19, .03], C.pale, codec), C.pale), text: label(codec, '', -2.53 + 5.06 * i / 13, .19, .30, .23) }));
  const receivedWord = label(codec, '', 0, -.36, 5.8, .19), decodedWord = label(codec, '', 0, -.82, 5.8, .19), codeResult = label(codec, '', 0, -1.31, 5.8, .22);
  label(codec, 'Undo CIRC and scrambling; check sector address, EDC and P/Q', 0, -1.83, 5.8, .17);
  label(codec, '1 selected byte + 2,047 padding bytes; framing and parity also recorded', 0, -2.42, 5.8, .15);

  const pulsePanel = panel('pulses', 'Recording exposure and mark length', 'The reference diagram shows the standard 4× media-test write pulse for each actual marked run. A pulse begins half a cell after the nominal mark start, with another sixteenth-cell delay after a 3T land. A 3T pulse has 1.04 relative height. Actual power requires medium-specific calibration. This reference is not a thermal or mark-shape solver.', 'PULSE TIMING IS DIFFERENT FROM MARK LENGTH');
  label(pulsePanel, 'NOMINAL CODED MARKS · the same 40-cell patch', 0, 1.96, 5.8, .17);
  const nominalCells = Array.from({ length: 40 }, (_, i) => flat(kit.box([.129, .26, .04], [X(CDR_TIMING.windowStart + i + .5), 1.49, .03], C.dye, pulsePanel), C.dye));
  label(pulsePanel, '4× REFERENCE PULSES · write levels normalized to PW', 0, 1.01, 5.8, .17);
  const pulseLine = lineObject(200, C.red, pulsePanel), pulseCursor = lineObject(2, C.blue, pulsePanel);
  const pulseRun = label(pulsePanel, '', 0, -.50, 5.8, .20), pulseTiming = label(pulsePanel, '', 0, -.97, 5.8, .19), pulsePower = label(pulsePanel, '', 0, -1.43, 5.8, .19);
  label(pulsePanel, 'The real drive calibrates power for its dye, speed and laser', 0, -1.94, 5.8, .18);
  label(pulsePanel, 'Low read bias is schematic; this reference is not a thermal simulation', 0, -2.43, 5.8, .15);

  const layers = panel('layers', 'Dye, reflector and clear substrate', 'Light enters from the underside through the clear polycarbonate. The thin organic dye layer sits immediately below the reflective metal near the label side. Recording changes dye locally; the metal returns light toward the pickup. CD-R changes cannot be erased for reuse. Rewritable CD-RW instead uses a different phase-change layer.', 'THE RECORDABLE DYE SITS BESIDE THE REFLECTOR');
  const layerSpecs = [[1.70, .12, 0xa8b4a4, 'Protective coat / label'], [1.52, .10, 0xb08a38, 'Reflective metal'], [1.31, .14, C.dye, 'Organic dye'], [.64, 1.12, 0xbdd5d9, 'Clear polycarbonate']];
  for (const [y, h, color, text] of layerSpecs) { flat(kit.box([3.15, h, .08], [-1.05, y, .01], color, layers), color); label(layers, text, 1.73, y, 2.0, .17); }
  const layerMark = flat(kit.box([.43, .14, .02], [-.53, 1.31, .065], C.mark, layers), C.mark);
  label(layers, 'About 1.2 mm thick', 1.73, .20, 2.0, .17);
  label(layers, 'Thin upper layers enlarged', 1.73, -.19, 2.15, .14);
  flat(kit.box([.82, .13, .07], [-.55, -.74, .02], 0xbdd5d9, layers), 0xbdd5d9); label(layers, 'Objective', .82, -.74, 1.8, .18);
  const layerOutgoing = lineObject(3, C.red, layers), layerReturning = lineObject(3, C.gold, layers);
  const layerStage = label(layers, '', 0, -1.38, 5.8, .19);
  label(layers, 'Both marked and unmarked regions return light', 0, -1.89, 5.8, .19);
  label(layers, 'Color identifies layers; dye and reflector colors vary between products', 0, -2.42, 5.8, .15);

  const groove = panel('pregroove', 'Follow the preformed groove', 'A molded spiral pregroove exists before recording. Its wobble helps the drive control speed and contains absolute-time information used to locate recording positions. At 1×, nominal wobble is 22.05 kHz. This greatly enlarged groove shows its guiding role; it does not decode ATIP or simulate tracking servos.', 'A BLANK CD-R ALREADY HAS A GUIDE TRACK');
  label(groove, 'Preformed groove · width and wobble exaggerated', 0, 1.97, 5.8, .18);
  const grooveLine = lineObject(321, C.blue, groove);
  fillLine(grooveLine, Array.from({ length: 321 }, (_, i) => [-2.6 + 5.2 * i / 320, 1.10 + .16 * Math.sin(i / 320 * 16 * Math.PI), .07]));
  const grooveSpot = flat(kit.disk(.09, .012, [0, 1.10, .13], C.red, groove), C.red);
  label(groove, 'A guide exists before any user byte has been written', 0, .57, 5.8, .18);
  const grooveSpeed = label(groove, '', 0, .02, 5.8, .20), grooveRadius = label(groove, '', 0, -.47, 5.8, .19), grooveTime = label(groove, '', 0, -.96, 5.8, .19);
  label(groove, 'Wobble → speed reference + absolute-time information (ATIP)', 0, -1.47, 5.8, .18);
  label(groove, '1× reference: 1.2 m/s, 1.6 µm track pitch, 22.05 kHz wobble', 0, -1.95, 5.8, .17);
  label(groove, 'Finite sector excerpt; lead-in, lead-out, ATIP decoding and servos omitted', 0, -2.43, 5.8, .15);

  const optics = panel('optics', 'Write with heat, read with returned light', 'During recording, focused infrared light heats and changes the dye. During reading, a much lower exposure retrieves the pattern without changing it. A splitter routes returned light to a detector. The standard uses stated pickup conditions around 780 nm for reading and 786 nm for its recording test; actual calibrated drives vary.', 'THE SAME OPTICAL PATH DOES TWO DIFFERENT JOBS');
  flat(kit.box([4.6, .65, .06], [0, 1.2, .01], 0xbdd5d9, optics), 0xbdd5d9);
  flat(kit.box([4.6, .09, .05], [0, 1.58, .04], C.dye, optics), C.dye);
  flat(kit.box([4.6, .04, .05], [0, 1.66, .04], C.gold, optics), C.gold);
  label(optics, 'Dye and reflector above the clear substrate', 0, 1.99, 5.8, .18);
  kit.box([.72, .40, .10], [-2.15, -.65, .01], C.ink, optics); label(optics, 'IR laser', -2.15, -1.06, 1.4, .17);
  const opticalSplitter = kit.box([.50, .50, .08], [-.61, -.65, .01], C.pale, optics); line(optics, [[-.86, -.90, .10], [-.36, -.40, .10]], C.gray);
  label(optics, 'Splitter', .72, -.65, 1.25, .16);
  const opticalObjective = kit.box([.70, .14, .08], [-.61, .30, .01], 0xbdd5d9, optics); label(optics, 'Objective', .72, .30, 1.65, .17);
  const opticalDetector = kit.box([.72, .28, .08], [-.61, -1.46, .01], C.gold, optics); label(optics, 'Detector', .72, -1.46, 1.7, .18);
  const outgoing = lineObject(4, C.red, optics), returning = lineObject(5, C.gold, optics), opticalMode = label(optics, '', 0, -2.00, 5.8, .19);
  label(optics, 'False-color beam; path simplified, no calibrated temperature or read voltage', 0, -2.43, 5.8, .15);

  const readback = panel('readback', 'Compare requested and recovered bits', 'The monitor compares the requested byte with the byte decoded from actual stored marks. Only complete valid sector data becomes readback. Low writing exposure leaves a blank region unreadable. A previously recorded region keeps and returns its old byte; turning off reading light hides the byte without erasing marks.', 'THE COMPUTER COMPARES INPUT WITH CHECKED READBACK');
  const resultHeader = label(readback, '', 0, 2.00, 5.8, .18);
  flat(kit.box([4.78, 3.61, .045], [0, -.10, .01], C.ink, readback), C.ink);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.72, 3.54), new THREE.MeshBasicMaterial({ map: hardware.fileTexture, toneMapped: false })); screen.position.set(0, -.10, .05); readback.add(screen);
  const resultLine = label(readback, '', 0, -2.09, 5.8, .18);
  label(readback, 'Reset, replay and changed controls prepare another disc experiment', 0, -2.45, 5.8, .15);
  return { details, panels, markCells, wordBand, readDots, readCells, trackCursor, spot, trackTitle, trackStage, trackCounts, trackResult, codeInput, codeScrambled, codeBits, receivedWord, decodedWord, codeResult,
    nominalCells, pulseLine, pulseCursor, pulseRun, pulseTiming, pulsePower, layerMark, layerOutgoing, layerReturning, layerStage, grooveSpot, grooveSpeed, grooveRadius, grooveTime, outgoing, returning, opticalSplitter, opticalObjective, opticalDetector, opticalMode, resultHeader, resultLine, screen };
}

export function updateCdrDetails(g, s, p) {
  const { windowStart, windowEnd } = CDR_TIMING, position = s.writing ? s.writePosition : s.readPosition;
  const local = Math.max(windowStart, Math.min(windowEnd, position)), x = X(local), inPatch = position >= windowStart && position <= windowEnd && !s.seeking && !s.complete;
  g.markCells.forEach((o, i) => o.material.color.set(s.windowMarks[i] ? C.mark : C.dye));
  g.readDots.forEach((o, i) => o.visible = s.windowReceived[i] === 1);
  g.readCells.forEach((o, i) => o.material.color.set(s.windowReceived[i] === null ? C.gray : C.blue));
  fillLine(g.trackCursor, inPatch ? [[x, -.69, .18], [x, 1.42, .18]] : []);
  g.spot.position.x = x; g.spot.visible = Boolean(inPatch && s.light); g.spot.material.color.set(s.exposing ? C.red : C.blue);
  set(g.trackTitle, `Actual channel cells ${n(windowStart)}–${n(windowEnd - 1)} · requested ${s.inputBits}`);
  set(g.trackStage, s.seeking ? 'The dye stays unchanged while the pickup returns' : s.complete ? s.storedMarks ? 'Read finished; these marks remain' : 'Read finished; this region still has no recorded marks' : s.writing ? s.canWrite ? 'Recording: completed marks remain behind the spot' : 'No new marks: writing is blocked or exposure is too low' : s.values.readLight ? 'Reading: look for boundaries without changing the dye' : 'Read light off: no transitions arrive; the dye stays unchanged');
  set(g.trackCounts, `${n(s.storedMarks)} marked cells in the excerpt · ${n(s.readReceived)} cells received`);
  set(g.trackResult, s.available ? `Checked readback ${s.outputBits}` : s.complete ? 'No checked byte available' : 'Readback waits for the completed read and sector checks');

  set(g.codeInput, `Requested ${s.inputBits} · byte ${s.inputByte}`);
  set(g.codeScrambled, `Scrambled byte ${cdrBits(p.program.trace.scrambledByte)} → frame 22, symbol 5`);
  g.codeBits.forEach(({ box, text }, i) => { const bit = p.program.trace.word[i]; box.material.color.set(bit === '1' ? 0xe6d6a8 : C.pale); set(text, bit); });
  set(g.receivedWord, s.receivedWord === null ? 'READ: word has not arrived yet' : `READ: ${s.receivedWord.split('').join(' ')}`);
  set(g.decodedWord, s.decodedWordByte === null ? 'EFM decoding waits for this word' : s.decodedWordByte < 0 ? 'Invalid EFM word: no known byte' : `EFM recovers ${cdrBits(s.decodedWordByte)} (still scrambled)`);
  set(g.codeResult, s.available ? `Checked user byte ${s.outputBits} · ${s.outputByte}` : s.complete ? 'Sector unavailable; no user byte released' : 'User byte waits for full sector checks');

  g.nominalCells.forEach((o, i) => o.material.color.set(p.program.marks[windowStart + i] ? C.mark : C.dye));
  const points = [[X(windowStart), -.08, .10]], refs = [];
  for (let i = 0; i < p.program.runs.length; i++) {
    const run = p.program.runs[i]; if (run.start >= windowEnd) break; if (run.end <= windowStart) continue;
    const pulse = cdrReferencePulse(run, p.program.runs[i - 1]); if (!pulse) continue; refs.push({ run, pulse });
    const start = Math.max(windowStart, pulse.start), end = Math.min(windowEnd, pulse.end), y = -.08 + .58 * pulse.relativePower;
    points.push([X(start), -.08, .10], [X(start), y, .10], [X(end), y, .10], [X(end), -.08, .10]);
  }
  points.push([X(windowEnd), -.08, .10]); fillLine(g.pulseLine, points);
  fillLine(g.pulseCursor, s.writing && inPatch ? [[x, -.19, .15], [x, 1.69, .15]] : []);
  const ref = refs.find(({ run }) => s.writePosition >= run.start && s.writePosition < run.end) || refs[0];
  set(g.pulseRun, `${ref.run.cells}T nominal mark → ${ref.pulse.widthCells.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}T reference pulse`);
  set(g.pulseTiming, `${(ref.pulse.physicalSeconds * 1e9).toFixed(1)} ns at 4× · relative pulse height ${ref.pulse.relativePower.toFixed(2)}`);
  set(g.pulsePower, `This experiment: ${p.initial.occupied ? 'occupied region, write blocked' : CDR_POWER[s.values.power].toLowerCase()}`);

  // This section represents changed material already formed in the patch,
  // rather than the next cell underneath the moving recording spot.
  g.layerMark.visible = s.windowMarks.some(Boolean);
  fillLine(g.layerOutgoing, s.light ? [[-.68, -.67, .15], [-.59, .08, .15], [-.53, 1.50, .15]] : []);
  fillLine(g.layerReturning, s.light ? [[-.47, 1.50, .16], [-.41, .08, .16], [-.33, -.67, .16]] : []);
  g.layerOutgoing.material.color.set(s.exposing ? C.red : C.blue);
  set(g.layerStage, s.complete ? s.storedMarks ? 'Recorded dye stays changed after light turns off' : 'Light off; this region still has no recorded marks' : s.seeking ? s.storedMarks ? 'Marks persist while the pickup returns' : 'The pickup returns to an unrecorded region' : s.writing ? s.canWrite ? 'Recording exposure changes dye in the focused region' : 'No recording exposure: no new dye changes' : s.values.readLight ? 'Reading light probes the dye without changing it' : 'Read light off: no signal is retrieved; the dye stays unchanged');

  const fraction = position / CDR_CHANNEL_CELLS;
  g.grooveSpot.position.set(-2.6 + 5.2 * fraction, 1.10 + .16 * Math.sin(fraction * 16 * Math.PI), .13); g.grooveSpot.visible = !s.seeking;
  set(g.grooveSpeed, s.seeking ? 'Return motion is illustrative' : s.complete ? 'Passes finished' : `${s.writing ? '4× writing pass' : '1× reading pass'}: ${s.spiral.velocity.toFixed(1)} m/s · ${s.spiral.rpm.toFixed(1)} rpm`);
  set(g.grooveRadius, `${s.spiral.radiusMm.toFixed(4)} mm radius · ${s.spiral.travelMicrometers.toFixed(3)} µm advance per pass`);
  set(g.grooveTime, `Channel time: ${(s.writeSeconds * 1000).toFixed(3)} ms write · ${(s.readSeconds * 1000).toFixed(3)} ms read`);
  fillLine(g.outgoing, s.light ? [[-1.78, -.65, .14], [-.61, -.65, .14], [-.61, .30, .14], [-.61, 1.66, .14]] : []);
  fillLine(g.returning, s.light ? [[-.51, 1.66, .16], [-.51, .30, .16], [-.51, -.65, .16], [-.51, -1.32, .16]] : []);
  g.outgoing.material.color.set(s.exposing ? C.red : C.blue);
  set(g.opticalMode, !s.light ? 'Light off; any stored marks remain' : s.exposing ? 'Recording exposure: focused energy changes the dye' : s.writing && s.canWrite ? 'Between recording pulses: low-power bias' : 'Low-power light retrieves reflection without writing');
  set(g.resultHeader, s.available ? `Input ${s.inputBits} → checked readback ${s.outputBits}` : s.complete ? 'Readback unavailable; see why below' : 'Choose a byte, write the region, then read it');
  set(g.resultLine, s.values.medium ? 'An occupied region keeps its earlier recording' : s.available ? 'New marks supplied the requested byte' : s.complete && !s.values.readLight ? 'No read light; the material still retains any marks' : s.complete ? 'No recording exposure; the region remains blank' : 'Writing changes material; reading checks the recovered data');
}

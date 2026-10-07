import * as THREE from 'three';
import { houseModel, reading } from './house-model-kit.js';
import { DVDR_DEFAULTS, DVDR_DOMAINS, DVDR_MEDIA, DVDR_POWER, DVDR_FILE_TRACE, createDvdrController } from './dvdr-physics.js';
import { DVDR_FILE_LABELS } from './dvdr-files.js';
import { createDvdrHardware, updateDvdrHardware } from './dvdr-hardware.js';
import { createDvdrDetails, updateDvdrDetails } from './dvdr-details.js';

export function createDvdrModel() {
  const kit = houseModel('DVD-R'), hardware = createDvdrHardware(kit), details = createDvdrDetails(kit, hardware), controller = createDvdrController();
  const options = labels => labels.map((label, value) => ({ label, value }));
  const specs = {
    content: ['File to record', 'Choose a two-second movie file. The computer writes its directory and bytes into the selected region, then retrieves them for playback. Changing controls prepares another experiment.', options(DVDR_FILE_LABELS)],
    medium: ['Region at start', 'Start with blank dye or a region holding the named movie. An occupied region keeps its original file. Unused space elsewhere on a real disc could still accept additional recording.', options(DVDR_MEDIA)],
    power: ['Exposure during writing', 'Matched recording exposure forms permanent marks. Reading light alone leaves blank dye unchanged. Actual power depends on calibration for the medium, drive and speed.', options(DVDR_POWER)],
    readLight: ['Light during readback', 'Turn low-power reading light on or off. Off prevents file recovery without erasing recorded marks. A setting change prepares the entire comparison again.', options(['Off', 'On'])],
    pulseType: ['Reference pulse strategy', 'Inspect Recording pulse strategies to compare three reference waveforms for the actual file pattern. Their widths differ. Each represents matched recording when power is calibrated; this choice does not invent a different file or a thermal failure.', options(['Type 1', 'Type 2', 'Type 3'])],
  };
  for (const key of Object.keys(DVDR_DEFAULTS)) { const [label, help, choices] = specs[key]; kit.control(key, label, ...DVDR_DOMAINS[key], DVDR_DEFAULTS[key], '', help, choices); }
  const result = kit.finish(() => {
    const s = controller.getState(), p = controller.getPlan(); updateDvdrHardware(hardware, s); updateDvdrDetails(details, s, p);
    return { state: s, readings: [
      { ...reading('Your result', s.status, 'Stored dye marks supply ideal detected transitions, EFMplus, PI/PO and sector checks. The checked directory locates the file; its retrieved MPEG-2 bytes supply the movie.'), wide: true },
      { ...reading('Requested → retrieved file', `${s.requestedName} → ${s.storedName ?? (s.time >= 11 ? 'unavailable' : 'waiting')}`, s.values.medium ? 'An occupied region keeps its previous file even if the computer requests a different movie.' : 'This small ISO 9660 data volume contains one MPEG-2 elementary-stream file. It is not a DVD-Video title.'), wide: true },
      reading('Permanent material state', `${s.storedMarks.toLocaleString('en-US')} marked cells; ${s.addedMarks.toLocaleString('en-US')} newly formed`, 'Completed marks are irreversible dye changes in this ideal medium. Reading and return motion never remove them. Input bits do not map one-to-one to marks.'),
      reading('Writing condition', s.blocked ?? 'Matched recording exposure forms complete marks', 'Reference pulse strategy changes the pulse diagram. All three strategies assume correctly calibrated recording exposure; actual heat flow and mark growth are not simulated.'),
      reading('Received channel word', s.receivedWord ?? (!s.values.readLight && s.time >= 6 ? 'Unavailable: reading light is off' : 'Waiting for this word'), s.decodedWordByte === null ? `The magnified patch carries byte ${DVDR_FILE_TRACE.fileByte.toLocaleString('en-US')} of the selected file. Reading also needs next-state information to decode EFMplus.` :
        s.decodedWordByte < 0 ? 'No valid EFMplus byte can be recovered from this received word.' : `EFMplus yields scrambled byte ${s.decodedWordByte}. Deinterleaving, parity checks and descrambling restore sector data before file retrieval.`),
      reading('File and picture output', s.available ? `${s.entry.size.toLocaleString('en-US')} bytes · picture ${s.frameIndex + 1} / 50` : s.time >= 11 ? 'File unavailable; no movie output' : 'Waiting for checked directory and movie data', 'The retrieved movie has 720 × 576 samples, a 4:3 display shape and 25 pictures per second. This example uses independently coded flat-block pictures and no audio.'),
      reading('Following the groove', `${s.spiral.radiusMm.toFixed(4)} mm radius · ${s.spiral.rpm.toFixed(1)} rpm`, `At 1×, track velocity is 3.49 m/s and pitch is 0.74 µm. The excerpt advances ${s.spiral.travelMicrometers.toFixed(3)} µm per pass. Wobble supplies timing; land pre-pits supply addresses.`),
      reading('Display time and channel time', `${s.time.toFixed(2)} / ${s.duration.toFixed(2)} s on screen`, `${(s.writeSeconds * 1000).toFixed(3)} ms writing and ${(s.readSeconds * 1000).toFixed(3)} ms reading at the reference channel clock. Each pass slows the selected 40 cells for three seconds. Return motion takes one illustrative second; the recovered movie then plays for two seconds.`),
      { ...reading('Start another experiment', 'Reset, replay or changed controls prepare the selected starting region.', 'These controls do not erase an existing DVD-R. DVD-RW uses a different recording material. Real whole-disc sessions also need recording metadata and finalization beyond this data-zone excerpt.'), wide: true },
    ] };
  });
  const render = result.update, sync = () => render(controller.getState().values); let previousTime = 0;
  result.update = (values = {}) => { controller.update(values); return sync(); };
  result.reset = (initial = {}) => {
    if (!initial || typeof initial !== 'object' || Array.isArray(initial) || Object.keys(initial).some(k => !['settings', 'time'].includes(k))) throw new TypeError('Expected DVD-R starting state');
    controller.reset({ values: initial.settings ?? {}, time: initial.time ?? 0 }); previousTime = 0; return sync();
  };
  result.advance = seconds => { controller.advance(seconds); return sync(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - previousTime) : 0; if (Number.isFinite(time)) previousTime = time; return result.advance(dt); };
  result.replayState = () => { const start = controller.replayState(); return { settings: start.values, time: start.time }; };
  result.playback = { label: 'Write the DVD-R, retrieve the file, then play it', description: 'Record permanent dye marks, return with reading light, check the file and play its recovered movie.', stepLabel: 'Advance one slow channel cell, one short pass interval or one movie frame',
    advance: result.advance, step: () => { const t = controller.getState().time; return result.advance(t >= 1 && t < 4 || t >= 7 && t < 10 ? .075 : t >= 11 && t < 13 ? .04 : .05); }, complete: () => controller.getState().complete, blocked: () => false };
  result.actions = [['Inspect: complete writer and computer', 'player'], ['Inspect: permanent dye marks', 'track'], ['Inspect: follow a file byte', 'codec'], ['Inspect: recording pulse strategies', 'pulses'],
    ['Inspect: disc layers', 'layers'], ['Inspect: guide groove and addresses', 'pregroove'], ['Inspect: writing and reading light', 'optics'], ['Inspect: find the recorded file', 'files'], ['Inspect: play the retrieved movie', 'readback']]
    .map(([label, part]) => ({ label, part, isolate: true, cutaway: true, view: 'front', replay: false, run: sync }));
  result.resultPart = { id: 'readback', label: 'Inspect the retrieved movie', view: 'front', focusOnComplete: false, preserveOnReset: true, available: () => true };
  result.covers.push(hardware.lid, hardware.front, hardware.frontSlot, hardware.status, hardware.right, hardware.discFront);
  result.initialPart = 'player'; result.initialView = 'front'; result.initialIsolated = true; result.initialCutaway = true;
  result.frameVisibleOnly = true; result.framePadding = .64; result.selectionOutline = false; result.transparentBackground = true;
  const detailIds = details.details.map(p => p.userData.inspectionOnly), direction = [1, 1.6, 3.6]; result.viewDirections = { front: direction }; kit.root.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(hardware.player).getCenter(new THREE.Vector3());
  for (const panel of details.details) { panel.position.copy(center); panel.position.y += .04; }
  kit.root.updateMatrixWorld(true);
  const sceneSize = new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3()), size = new THREE.Box3().setFromObject(hardware.player).getSize(new THREE.Vector3());
  result.overviewZoom = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) * .7 / (Math.max(size.x, size.y, size.z) * result.framePadding);
  result.partViewDirections = Object.fromEntries(result.parts.map(p => [p.id, { front: detailIds.includes(p.id) || ['monitor', 'outputs', 'computer'].includes(p.id) ? [0, 0, 7] : direction }]));
  result.partViewDirections.detector = { front: [0, .7, -4] }; result.partViewDirections.electronics = { front: [1, 4, 2] };
  result.inspectionObjects = id => detailIds.includes(id) ? [details.panels[id]] : [];
  result.frameBoundsForPart = id => detailIds.includes(id) ? new THREE.Box3(new THREE.Vector3(-3.10, -2.82, -.12), new THREE.Vector3(3.10, 2.75, .3)).applyMatrix4(details.panels[id].matrixWorld) :
    id === 'pickup' ? new THREE.Box3(new THREE.Vector3(hardware.pickup.position.x - .11, -.19, -.16), new THREE.Vector3(hardware.pickup.position.x + .11, .14, .16)).applyMatrix4(kit.root.matrixWorld) : null;
  for (const part of result.parts) { part.framePadding = detailIds.includes(part.id) ? .57 : ['system', 'player'].includes(part.id) ? .64 : .68; part.maxZoom = 180; part.inspectionView = 'front'; }
  result.thumbnailOmit = details.details; result.catalogParts = result.parts.filter(p => !['system', 'player'].includes(p.id));
  result.topology = { ...hardware, details }; result.scientificPlan = controller.getPlan; result.duration = () => controller.getState().duration;
  const dispose = result.dispose; let disposed = false;
  result.dispose = () => { if (disposed) return; disposed = true; hardware.fileTexture.dispose(); dispose(); };
  return result;
}

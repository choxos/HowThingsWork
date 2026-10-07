import * as THREE from 'three';
import { houseModel, reading } from './house-model-kit.js';
import { CDR_DEFAULTS, CDR_DOMAINS, CDR_MEDIA, CDR_POWER, createCdrController } from './cdr-physics.js';
import { createCdrHardware, updateCdrHardware } from './cdr-hardware.js';
import { createCdrDetails, updateCdrDetails } from './cdr-details.js';

export function createCdrModel() {
  const kit = houseModel('CD-R'), hardware = createCdrHardware(kit), details = createCdrDetails(kit, hardware), controller = createCdrController();
  const options = labels => labels.map((label, value) => ({ label, value })), nibbles = Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, '0'));
  const specs = {
    high: ['First four input bits', 'Choose the first four bits of your eight-bit byte. Each control change prepares a new experiment with the selected starting region; it does not erase an existing CD-R.', options(nibbles)],
    low: ['Last four input bits', 'Choose the final four bits. Together the two controls can write any byte from 00000000 to 11111111. Sector and channel coding add many more recorded cells.', options(nibbles)],
    medium: ['Region at start', 'Start another experiment with blank dye or a region already holding the shown byte. An occupied region cannot be replaced; unused space elsewhere on a real disc could still be recorded.', options(CDR_MEDIA)],
    power: ['Exposure during writing', 'Matched recording exposure changes the dye. Reading light alone leaves it unchanged; Off supplies no light. Actual recording power depends on medium, speed and drive calibration.', options(CDR_POWER)],
    readLight: ['Light during readback', 'Turn low-power reading light on or off. Off prevents recovered data without erasing the stored marks. Changing this setting prepares the complete experiment again.', options(['Off', 'On'])],
  };
  for (const key of Object.keys(CDR_DEFAULTS)) { const [label, help, choices] = specs[key]; kit.control(key, label, ...CDR_DOMAINS[key], CDR_DEFAULTS[key], '', help, choices); }
  const result = kit.finish(() => {
    const s = controller.getState(), p = controller.getPlan(); updateCdrHardware(hardware, s); updateCdrDetails(details, s, p);
    return { state: s, readings: [
      { ...reading('Your result', s.status, 'The output comes from stored dye marks, ideal detected transitions, EFM, CIRC, descrambling and validated sector data. A requested byte is never substituted for failed readback.'), wide: true },
      { ...reading('Requested → recovered bits', `${s.inputBits} → ${s.outputBits ?? (s.complete ? 'unavailable' : 'waiting')}`, s.values.medium ? 'This region started with a previous recording. The requested byte cannot overwrite it.' : 'One chosen eight-bit byte is the first user byte of a real encoded Mode 1 sector. The remaining 2,047 user bytes are zero padding.'), wide: true },
      reading('Permanent material state', `${s.storedMarks.toLocaleString('en-US')} marked cells; ${s.addedMarks.toLocaleString('en-US')} newly formed`, 'A marked run is an irreversible dye change in this ideal medium. Reading and moving the pickup back never remove it. Input bits do not map one-to-one to dark cells.'),
      reading('Writing condition', s.blocked ?? 'Matched recording exposure can form new marks', 'A real writer calibrates for its medium and speed. This model assumes successful complete marks under matched recording exposure; low reading light cannot write.'),
      reading('Received channel word', s.receivedWord ?? (!s.values.readLight && (s.reading || s.complete) ? 'Unavailable: reading light is off' : 'Waiting for reading light to reach this word'), s.decodedWordByte === null ? 'The magnified patch contains the actual EFM word carrying the requested byte. An occupied region may return a different stored word.' : s.decodedWordByte < 0 ? 'No valid EFM byte can be decoded from this received word.' : `EFM yields scrambled byte ${s.decodedWordByte}. CIRC and descrambling must still restore the user byte before sector checks release it.`),
      reading('Following the groove', `${s.spiral.radiusMm.toFixed(4)} mm radius · ${s.spiral.rpm.toFixed(1)} rpm`, `The preformed groove guides recording. Reference track speed is 4.8 m/s during the 4× write pass and 1.2 m/s during 1× reading. This finite excerpt moves outward ${s.spiral.travelMicrometers.toFixed(3)} µm per pass.`),
      reading('Playback and channel time', `${s.time.toFixed(2)} / ${s.duration.toFixed(1)} s on screen`, `${(s.writeSeconds * 1000).toFixed(3)} ms of writing channel time and ${(s.readSeconds * 1000).toFixed(3)} ms of reading channel time. Each pass magnifies the selected 40-cell patch for three seconds. Return motion takes one illustrative second.`),
      { ...reading('Start another experiment', 'Reset, replay or changed controls prepare another starting region.', 'This is a fresh comparison with the selected blank or previously recorded medium. It does not make an existing CD-R erasable. CD-RW uses a different recording material.'), wide: true },
    ] };
  });
  const render = result.update, sync = () => render(controller.getState().values); let previousTime = 0;
  result.update = (values = {}) => { controller.update(values); return sync(); };
  result.reset = (initial = {}) => {
    if (!initial || typeof initial !== 'object' || Array.isArray(initial) || Object.keys(initial).some(k => !['settings', 'time'].includes(k))) throw new TypeError('Expected CD-R starting state');
    controller.reset({ values: initial.settings ?? {}, time: initial.time ?? 0 }); previousTime = 0; return sync();
  };
  result.advance = seconds => { controller.advance(seconds); return sync(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - previousTime) : 0; if (Number.isFinite(time)) previousTime = time; return result.advance(dt); };
  result.replayState = () => { const start = controller.replayState(); return { settings: start.values, time: start.time }; };
  result.playback = { label: 'Write the CD-R and read the byte back', description: 'Change blank dye, return to the region, then recover the stored byte with reading light.', stepLabel: 'Advance one slow channel cell or one short pass interval',
    advance: result.advance, step: () => { const t = controller.getState().time; return result.advance(t >= 1 && t < 4 || t >= 7 && t < 10 ? .075 : .05); }, complete: () => controller.getState().complete, blocked: () => false };
  result.actions = [['Inspect: complete writer and computer', 'player'], ['Inspect: watch the dye change', 'track'], ['Inspect: follow your byte', 'codec'], ['Inspect: recording pulses', 'pulses'],
    ['Inspect: disc layers', 'layers'], ['Inspect: preformed groove', 'pregroove'], ['Inspect: writing and reading light', 'optics'], ['Inspect: compare readback', 'readback']]
    .map(([label, part]) => ({ label, part, isolate: true, cutaway: true, view: 'front', replay: false, run: sync }));
  result.resultPart = { id: 'readback', label: 'Inspect requested and recovered bits', view: 'front', focusOnComplete: false, preserveOnReset: true, available: () => true };
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

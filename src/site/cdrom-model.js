import * as THREE from 'three';
import { houseModel, reading } from './house-model-kit.js';
import { CDROM_DEFAULTS, CDROM_DOMAINS, CDROM_LOSSES, CDROM_TIMING, createCdromController } from './cdrom-physics.js';
import { CDROM_FILE_LABELS } from './cdrom-files.js';
import { createCdromHardware, updateCdromHardware } from './cdrom-hardware.js';
import { createCdromDetails, updateCdromDetails } from './cdrom-details.js';

export function createCdromModel() {
  const kit = houseModel('CD-ROM'), hardware = createCdromHardware(kit), details = createCdromDetails(kit, hardware), controller = createCdromController();
  const options = labels => labels.map((label, value) => ({ label, value }));
  const specs = {
    content: ['Stored file', 'Choose a text file, a BMP picture or CSV data. The computer must recover the directory entry and every file sector before opening its bytes.', options(CDROM_FILE_LABELS)],
    location: ['Master files near', 'Build another sample volume with its file extents near the inner, middle or outer track. The metadata remains near the center. Reading seeks to the actual directory address; a pressed disc does not move its stored files.', options(['Inner track', 'Middle track', 'Outer track'])],
    loss: ['Unreadable channel words', 'Inject a stated pattern of invalid EFM words. CIRC and sector parity may repair the known losses. Failed file or directory checks keep the file unavailable; these are not calibrated scratches.', options(CDROM_LOSSES)],
    laser: ['Read laser', 'Off prevents transition detection, sector retrieval and file availability. The stored disc pattern remains.', options(['Off', 'On'])],
    format: ['Optical comparison', 'Highlight CD, DVD or Blu-ray in the separate format, layer and wave diagrams. The drive continues to read its CD-ROM recording.', options(['CD', 'DVD', 'Blu-ray'])],
    depth: ['Separate wave-depth example', 'Change optical height for two equal coherent waves. This changes the phase diagram only; it does not predict real detector contrast or alter the stored file.', options(['Quarter wavelength', 'Sixth wavelength', 'Eighth wavelength', 'Half wavelength'])],
  };
  for (const key of Object.keys(CDROM_DEFAULTS)) {
    const [label, help, choices] = specs[key];
    kit.control(key, label, ...CDROM_DOMAINS[key], CDROM_DEFAULTS[key], '', help, choices, ['format', 'depth'].includes(key) ? { replay: false } : undefined);
  }
  const result = kit.finish(() => {
    const s = controller.getState(), p = controller.getPlan(), f = p.comparison;
    updateCdromHardware(hardware, s); updateCdromDetails(details, s, p);
    const fileContents = s.output?.type === 'text' ? s.output.text.replace(/\r\n/g, '\n').trim() : s.output?.type === 'data' ?
      `${s.output.xLabel} → ${s.output.yLabel}: ${s.output.points.map(([x, y]) => `${x} → ${y}`).join('; ')}` :
      s.output?.type === 'picture' ? `${s.output.width} × ${s.output.height} decoded pixels. Select Inspect: recovered file to enlarge the picture.` :
      s.error || !s.values.laser ? 'No file contents available.' : 'Waiting for a complete, checked file.';
    return { state: s, readings: [
      { ...reading('Your result', s.status, 'The displayed file comes from retrieved channel data, CIRC, sector repair and checks, then the recovered ISO 9660 directory. Every required sector must pass before the file opens.'), wide: true },
      { ...reading('Opened file contents', fileContents, 'Text and plotted values are also available here at normal page size. They come from the same recovered file bytes as the computer screen and clear when a new read starts.'), wide: true },
      reading('From track to file', `${s.receivedCells.toLocaleString('en-US')} cells → ${s.checkedSectors} checked sectors → ${s.file?.length ?? 0} file bytes`, `${s.checkedBytes.toLocaleString('en-US')} valid user bytes include metadata and sector padding. The directory gives the exact file length; padding never becomes file content.`),
      reading('Recovered directory', s.entry ? `${s.entry.name} · sector ${s.entry.extent} · ${s.entry.size.toLocaleString('en-US')} bytes` : s.directoryReady ? 'Requested file absent' : 'File address not available yet', 'Sector 16 supplies the primary volume descriptor. Its root-directory address leads to recovered filenames, extent locations and byte counts.'),
      reading('Repair and loss', `C1 ${s.stats.c1Repaired} · C2 ${s.stats.c2Repaired} · P ${s.stats.pRepaired} · Q ${s.stats.qRepaired} repaired`, `${s.stats.erased} channel words flagged so far; ${s.stats.failedSectors} failed sectors. Counts refer to different decoding stages. Sector parity handles known erasures; a failed checksum or unresolved byte keeps its payload unavailable.`),
      reading('Spindle and file seek', `${s.spiral.rpm.toFixed(1)} rpm at ${s.spiral.radiusMm.toFixed(4)} mm`, `1.2 m/s reference track speed, 1.6 µm pitch and 75 sectors/s. Outward travel in this read: ${s.spiral.travelMicrometers.toFixed(3)} µm. Moving the file location changes the directory address and the pickup seek.`),
      reading('Sector and capacity', '2,352 raw bytes → 2,048 user bytes', 'At 1×, 75 sectors supply 153,600 bytes/s (150 KiB/s). This 74-minute volume contains 333,000 sectors or 681,984,000 user bytes (650.4 MiB), before filesystem use.'),
      reading('Read time and display time', `${s.time.toFixed(2)} / ${s.duration.toFixed(1)} s on screen · ${(s.readSeconds * 1000).toFixed(3)} ms of channel time`, 'First 64 cells take four on-screen seconds. The rest of the volume read takes one; the directory read takes one; the file read takes two. Two schematic seeks separate them. Reading rotation follows actual channel time; seek duration and rotation are illustrative.'),
      reading('Optical comparison', `${f.name}: ${(f.diameterNm / 1000).toFixed(2)} µm spot; ${f.cover.toFixed(1)} mm clear layer`, `Scalar first-dark-ring reference. Air half-angle ${f.airHalfAngle.toFixed(1)}°; plastic ${f.plasticHalfAngle.toFixed(1)}° at n = ${f.index.toFixed(2)}. This reference diagram does not change the CD-ROM format or determine whether its file can be read.`),
      reading('Separate two-wave result', `${(f.radians * 180 / Math.PI).toFixed(0)}° phase · ${(100 * f.intensity).toFixed(0)}% normalized intensity`, `Equal waves at height ${f.depthNm.toFixed(1)} nm for optical depth λ/${f.denominator}. This phase experiment is separate from the digital reader and is not a prediction of real disc contrast.`),
    ] };
  });
  const render = result.update, sync = () => render(controller.getState().values);
  let previousTime = 0;
  result.update = (values = {}) => { controller.update(values); return sync(); };
  result.reset = (initial = {}) => {
    if (!initial || typeof initial !== 'object' || Array.isArray(initial) || Object.keys(initial).some(k => !['settings', 'time'].includes(k))) throw new TypeError('Expected CD-ROM starting state');
    controller.reset({ values: initial.settings ?? {}, time: initial.time ?? 0 }); previousTime = 0; return sync();
  };
  result.advance = seconds => { controller.advance(seconds); return sync(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - previousTime) : 0; if (Number.isFinite(time)) previousTime = time; return result.advance(dt); };
  result.replayState = () => { const start = controller.replayState(); return { settings: start.values, time: start.time }; };
  result.playback = {
    label: 'Read the CD-ROM and open its file', description: 'Recover the volume, directory and requested file from the optical channel.', stepLabel: 'Advance one slow channel cell, then one read interval',
    advance: result.advance, step: () => result.advance(controller.getState().time < CDROM_TIMING.slowEnd ? 1 / 16 : .05), complete: () => controller.getState().complete, blocked: () => false,
  };
  result.actions = [
    ['Inspect: complete drive and computer', 'player'], ['Inspect: laser to detector', 'optics'], ['Inspect: stored marks and transitions', 'track'],
    ['Inspect: channel frame and EFM', 'codec'], ['Inspect: Mode 1 sector', 'sectors'], ['Inspect: repair missing bytes', 'errors'],
    ['Inspect: find the file', 'directory'], ['Inspect: recovered file', 'files'], ['Inspect: seek and spiral', 'spin'],
    ['Inspect: capacity', 'capacity'], ['Inspect: optical formats', 'comparison'], ['Inspect: disc layers', 'layers'], ['Inspect: two-wave example', 'phase'],
  ].map(([label, part]) => ({ label, part, isolate: true, cutaway: true, view: 'front', replay: false, run: sync }));
  result.resultPart = { id: 'files', label: 'Inspect the recovered file', view: 'front', focusOnComplete: false, preserveOnReset: true, available: () => true };
  result.covers.push(hardware.lid, hardware.front, hardware.frontSlot, hardware.status, hardware.right, hardware.discFront);
  result.initialPart = 'player'; result.initialView = 'front'; result.initialIsolated = true; result.initialCutaway = true;
  result.frameVisibleOnly = true; result.framePadding = .64; result.selectionOutline = false; result.transparentBackground = true;
  const detailIds = details.details.map(p => p.userData.inspectionOnly), direction = [1.0, 1.6, 3.6];
  result.viewDirections = { front: direction }; kit.root.updateMatrixWorld(true);
  const assemblyCenter = new THREE.Box3().setFromObject(hardware.player).getCenter(new THREE.Vector3());
  for (const panel of details.details) { panel.position.copy(assemblyCenter); panel.position.y += .04; }
  kit.root.updateMatrixWorld(true);
  const sceneSize = new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3()), playerSize = new THREE.Box3().setFromObject(hardware.player).getSize(new THREE.Vector3());
  result.overviewZoom = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) * .7 / (Math.max(playerSize.x, playerSize.y, playerSize.z) * result.framePadding);
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

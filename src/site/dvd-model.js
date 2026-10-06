import * as THREE from 'three';
import { houseModel, reading } from './house-model-kit.js';
import { DVD_DEFAULTS, DVD_DOMAINS, DVD_LOSSES, DVD_TIMING, createDvdController } from './dvd-physics.js';
import { DVD_CLIPS } from './dvd-video.js';
import { createDvdHardware, updateDvdHardware } from './dvd-hardware.js';
import { createDvdDetails, updateDvdDetails } from './dvd-details.js';

export function createDvdModel() {
  const kit = houseModel('DVD'), hardware = createDvdHardware(kit), details = createDvdDetails(kit, hardware), controller = createDvdController();
  const options = labels => labels.map((label, value) => ({ label, value }));
  const specs = {
    content: ['Stored video', 'Choose the two-second movie actually encoded in the DVD channel pattern. Recovered MPEG-2 bytes supply the screen.', options(DVD_CLIPS)],
    radius: ['Read radius', 'Place the excerpt near this radius in millimeters, aligned to a sixteen-sector block. At 58 mm it starts slightly inward so the full excerpt fits. The selected position changes sector IDs, spindle speed and real outward travel.'],
    loss: ['Unreadable channel words', 'The selected words are flagged as known erasures. PI and PO parity may repair them; failed sectors cannot supply video. This tests code limits, not a measured physical scratch.', options(DVD_LOSSES)],
    laser: ['Read laser', 'Off prevents transition detection, byte retrieval and video. The spindle can still turn.', options(['Off', 'On'])],
    format: ['Optical comparison', 'Highlight CD, DVD or Blu-ray in the format, layer and wave diagrams. This reference comparison leaves the DVD movie and reading clock unchanged.', options(['CD', 'DVD', 'Blu-ray'])],
    depth: ['Separate wave-depth example', 'Choose optical height for two equal coherent waves. This changes only the wave diagram and its intensity result; it does not predict real disc contrast or change the movie.', options(['Quarter wavelength', 'Sixth wavelength', 'Eighth wavelength', 'Half wavelength'])],
  };
  for (const key of Object.keys(DVD_DEFAULTS)) {
    const [label, help, choices] = specs[key];
    kit.control(key, label, ...DVD_DOMAINS[key], DVD_DEFAULTS[key], key === 'radius' ? 'mm' : '', help, choices, ['format', 'depth'].includes(key) ? { replay: false } : undefined);
  }
  const result = kit.finish(() => {
    const s = controller.getState(), p = controller.getPlan(), f = p.comparison;
    updateDvdHardware(hardware, s); updateDvdDetails(details, s, p);
    return { state: s, readings: [
      reading('Your result', s.status, 'The screen uses pictures decoded from retrieved MPEG-2 bytes. It never substitutes the intended source image for a damaged frame.'),
      reading('From track to screen', `${s.receivedCells.toLocaleString('en-US')} cells → ${s.sectors} checked sectors → ${s.availableFrames} complete frames`, 'EFMplus recovers recording bytes. PI/PO parity repairs known erasures, descrambling restores user bytes, and sector checks decide what can enter the video decoder.'),
      reading('Repair and loss', `${s.stats.erased} flagged · PI ${s.stats.piRepaired} repaired · PO ${s.stats.poRepaired} repaired`, `${s.stats.failedSectors} failed sectors so far. PI handles up to 10 known erasures per row, PO up to 16 per column. A lost word may also obscure the preceding word if it needed lookahead. Unresolved sectors produce missing video frames.`),
      reading('Spindle and outward travel', `${s.spiral.rpm.toFixed(1)} rpm at ${s.spiral.radiusMm.toFixed(4)} mm`, `3.49 m/s track speed and 0.74 µm pitch. The pickup moved outward ${s.spiral.travelMicrometers.toFixed(3)} µm through ${s.spiral.turns.toFixed(3)} turns. ${s.spiral.edgeAdjusted ? 'The excerpt starts slightly inside the outer edge.' : 'Placement is rounded to a sixteen-sector boundary.'}`),
      reading('Read clock and movie clock', `${s.time.toFixed(3)} / ${s.duration.toFixed(2)} s · video frame ${s.displaying ? s.frameIndex + 1 : 0} / 50`, `First 64 cells take four on-screen seconds. The rest of this ${p.disc.seconds.toFixed(3)}-second read takes two on-screen seconds. The buffered two-second video then plays at its original 25 frames/s. Rotation follows the corresponding actual read time.`),
      reading('Optical comparison', `${f.name}: ${(f.diameterNm / 1000).toFixed(2)} µm spot reference; ${f.cover.toFixed(1)} mm read layer`, `Air half-angle ${f.airHalfAngle.toFixed(1)}°; plastic half-angle ${f.plasticHalfAngle.toFixed(1)}° using reference n = ${f.index.toFixed(2)}. The circle is a scalar first-dark-ring diameter, not measured detector contrast or a hard reading threshold. The player remains a DVD player.`),
      reading('Separate two-wave result', `${(f.radians * 180 / Math.PI).toFixed(0)}° phase · ${(100 * f.intensity).toFixed(0)}% normalized intensity`, `Equal waves at optical depth λ/${f.denominator}; height ${f.depthNm.toFixed(1)} nm for the selected reference. This phase experiment leaves the stored bits and video unchanged.`),
    ] };
  });
  const render = result.update, sync = () => render(controller.getState().values);
  let previousTime = 0;
  result.update = (values = {}) => { controller.update(values); return sync(); };
  result.reset = (initial = {}) => {
    if (!initial || typeof initial !== 'object' || Array.isArray(initial) || Object.keys(initial).some(k => !['settings', 'time'].includes(k))) throw new TypeError('Expected DVD starting state');
    controller.reset({ values: initial.settings ?? {}, time: initial.time ?? 0 }); previousTime = 0; return sync();
  };
  result.advance = seconds => { controller.advance(seconds); return sync(); };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - previousTime) : 0; if (Number.isFinite(time)) previousTime = time; return result.advance(dt); };
  result.replayState = () => { const start = controller.replayState(); return { settings: start.values, time: start.time }; };
  result.playback = {
    label: 'Read the DVD and play its recovered video', description: 'Follow channel transitions, sector repair and the decoded two-second movie.', stepLabel: 'Advance one channel cell, then one video-frame interval',
    advance: result.advance, step: () => result.advance(controller.getState().time < DVD_TIMING.slowEnd ? 1 / 16 : 1 / 25),
    complete: () => controller.getState().complete, blocked: () => false,
  };
  result.actions = [
    ['Inspect: complete DVD player', 'player'], ['Inspect: laser to detector', 'optics'], ['Inspect: marks and transitions', 'track'],
    ['Inspect: parity repair', 'errors'], ['Inspect: decoded video', 'video'], ['Inspect: compare optical formats', 'comparison'],
  ].map(([label, part]) => ({ label, part, isolate: true, cutaway: true, view: 'front', replay: false, run: sync }));
  result.resultPart = { id: 'video', label: 'Inspect the recovered movie', view: 'front', focusOnComplete: false, preserveOnReset: true, available: () => true };
  result.covers.push(hardware.lid, hardware.front, hardware.frontSlot, hardware.status, hardware.right, hardware.discFront);
  result.initialPart = 'player'; result.initialView = 'front'; result.initialIsolated = true; result.initialCutaway = true;
  result.frameVisibleOnly = true; result.framePadding = .64; result.selectionOutline = false; result.transparentBackground = true;
  const detailIds = details.details.map(p => p.userData.inspectionOnly), direction = [1.0, 1.6, 3.6];
  result.viewDirections = { front: direction }; kit.root.updateMatrixWorld(true);
  // Keep hidden inspection panels centered around the physical assembly so
  // the viewer's whole-model Home target also centers the connected player.
  const assemblyCenter = new THREE.Box3().setFromObject(hardware.player).getCenter(new THREE.Vector3());
  for (const panel of details.details) { panel.position.copy(assemblyCenter); panel.position.y += .04; }
  kit.root.updateMatrixWorld(true);
  const sceneSize = new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3()), playerSize = new THREE.Box3().setFromObject(hardware.player).getSize(new THREE.Vector3());
  result.overviewZoom = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) * .7 / (Math.max(playerSize.x, playerSize.y, playerSize.z) * result.framePadding);
  result.partViewDirections = Object.fromEntries(result.parts.map(p => [p.id, { front: detailIds.includes(p.id) || p.id === 'monitor' || p.id === 'outputs' ? [0, 0, 7] : direction }]));
  result.partViewDirections.detector = { front: [0, .7, -4] };
  result.partViewDirections.electronics = { front: [1, 4, 2] };
  result.inspectionObjects = id => detailIds.includes(id) ? [details.panels[id]] : [];
  result.frameBoundsForPart = id => detailIds.includes(id) ? new THREE.Box3(new THREE.Vector3(-3.10, -2.82, -.12), new THREE.Vector3(3.10, 2.75, .3)).applyMatrix4(details.panels[id].matrixWorld) :
    id === 'pickup' ? new THREE.Box3(new THREE.Vector3(hardware.pickup.position.x - .11, -.19, -.16), new THREE.Vector3(hardware.pickup.position.x + .11, .14, .16)).applyMatrix4(kit.root.matrixWorld) : null;
  for (const part of result.parts) { part.framePadding = detailIds.includes(part.id) ? .57 : ['system', 'player'].includes(part.id) ? .64 : .68; part.maxZoom = 180; part.inspectionView = 'front'; }
  result.thumbnailOmit = details.details; result.catalogParts = result.parts.filter(p => !['system', 'player'].includes(p.id));
  result.topology = { ...hardware, details }; result.scientificPlan = controller.getPlan; result.duration = () => controller.getState().duration;
  const dispose = result.dispose; let disposed = false;
  result.dispose = () => { if (disposed) return; disposed = true; hardware.videoTexture.dispose(); dispose(); };
  return result;
}

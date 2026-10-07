import * as THREE from 'three';
import { createCdromHardware } from './cdrom-hardware.js';
import { fillLine } from './scene-kit.js';
import { PLAYER_MM } from './blu-ray-player-model.js';
import { paintDvdrScreen } from './dvdr-screen.js';
const mm = (x, y, z) => [x * PLAYER_MM, y * PLAYER_MM, z * PLAYER_MM];

export function createDvdrHardware(kit) {
  const hardware = createCdromHardware(kit);
  const descriptions = {
    system: ['DVD-R writer and computer', 'The computer sends a movie file to a writable DVD. Recording pulses permanently change dye; reading retrieves the marks, checks sectors, finds the file and decodes its pictures. Disc dimensions are nominal; the surrounding drive layout is illustrative.'],
    player: ['Complete writer and computer', 'A connected computer, encoding board, optical pickup and disc write and retrieve a small ISO 9660 volume. It contains one MPEG-2 elementary-stream file. This is a data-disc example, not a DVD-Video title or a whole-disc recording session.'],
    disc: ['Writable DVD and clamp', 'The 120 mm DVD-R has a 15 mm center hole. Its recording layer sits near the middle of the nominal 1.2 mm disc, behind a 0.6 mm clear substrate. A second substrate is bonded above it. Coarse rings indicate the recorded zone; actual track pitch is 0.74 micrometers.'],
    laser: ['Recording laser and collimator', 'A red laser near 650 nm provides recording pulses or low-power reading light. A real writer calibrates power for its medium and speed. The model assumes matched exposure forms complete marks; it does not assign a universal recording-power threshold.'],
    objective: ['Objective lens and actuator', 'The reference pickup uses a 0.60 numerical aperture and focuses through 0.6 mm of transparent substrate onto the recording layer. Lens motion for tracking and focus is represented by the holder, not a simulated servo.'],
    detector: ['Photodetector and read signal', 'Marked and unmarked material both return light. Changes in the collected reflection let the receiver detect the recorded pattern. This model uses ideal transitions; diffraction, equalization and clock recovery are outside its boundary.'],
    electronics: ['Encoding, checks and connections', 'The writer adds sector headers, error checks, scrambling, PI/PO parity, interleaving and EFMplus channel coding. Reading reverses those operations and validates sectors. Neither the chosen filename nor its original movie supplies the recovered output.'],
    outputs: ['Computer and recovered movie', 'Checked sectors supply a filesystem directory and file bytes. The computer then decodes the retrieved MPEG-2 stream into 50 pictures. Missing light or invalid required sectors leave the movie unavailable.'],
    monitor: ['Retrieved-file monitor', 'The monitor shows only pictures decoded from the recovered file. Its 720 by 576 samples are displayed at 4:3 and 25 frames per second. An occupied region returns its original movie even when a different file was requested.'],
    computer: ['Computer and file request', 'Choose a small movie file, write its volume into a blank region, then read it back. Writing is blocked if that region already holds a recording. Unused regions elsewhere on a real disc can still be recorded.'],
  };
  for (const [id, [name, description]] of Object.entries(descriptions)) {
    const part = kit.parts.find(part => part.id === id); part.name = name; part.description = description; part.object.name = name;
  }
  for (const disc of [hardware.discBack, hardware.discFront]) { disc.material = disc.material.clone(); disc.material.color.set(0xc5ad8e); }
  hardware.rings.forEach((ring, index) => {
    const radius = 24 + index * 5;
    fillLine(ring, Array.from({ length: 97 }, (_, i) => mm(radius * Math.cos(Math.PI * i / 96), 13.22, -radius * Math.sin(Math.PI * i / 96))));
  });
  ['EFM+', 'PI/PO', 'MPEG'].forEach((text, index) => hardware.boardLabels[index].userData.setText(text));
  for (const dot of hardware.lightDots) dot.material = dot.material.clone();
  return hardware;
}

export function updateDvdrHardware(p, s) {
  p.pickup.position.x = s.spiral.radiusMm * PLAYER_MM; p.screw.rotation.x = (s.spiral.radiusMm - 24) / 2 * 2 * Math.PI;
  const angle = -s.spiral.angle;
  p.clampMark.position.set(...mm(3.5 * Math.sin(angle), 17.075, 3.5 * Math.cos(angle))); p.clampMark.rotation.y = angle;
  p.rotorMark.position.set(...mm(-11.5 * Math.sin(angle), 11.95, -11.5 * Math.cos(angle))); p.rotorMark.rotation.y = angle;
  fillLine(p.outgoing, [mm(-5.5, -1, 0), mm(0, -1, 0), mm(0, 7.4, 0), mm(0, 12.6, 0)]);
  fillLine(p.returning, [mm(.12, 12.6, .12), mm(.12, -.88, .12), mm(-3, -.88, .12), mm(-3, -.88, 6)]);
  p.outgoing.visible = p.returning.visible = Boolean(s.light);
  p.outgoing.material.color.set(s.exposing ? 0xc14f39 : 0x397b94); p.returning.material.color.set(s.detectorMark ? 0xa07a42 : 0xd9b960);
  const paths = [[[0, -1, 0], [0, 12.6, 0]], [[0, 12.6, .12], [0, -.88, .12], [-3, -.88, .12], [-3, -.88, 6]]];
  p.lightDots.forEach((dot, index) => {
    dot.visible = Boolean(s.light) && s.time > 0; dot.material.color.set(index ? 0xd9b960 : s.exposing ? 0xc14f39 : 0x397b94);
    const points = paths[index].map(a => new THREE.Vector3(...mm(...a))), lengths = points.slice(1).map((a, i) => a.distanceTo(points[i])), total = lengths.reduce((a, b) => a + b, 0);
    let at = ((s.time * .8 + index * .35) % 1) * total, j = 0;
    while (j < lengths.length - 1 && at > lengths[j]) at -= lengths[j++];
    dot.position.copy(points[j]).lerp(points[j + 1], at / lengths[j]);
  });
  const cable = [[s.spiral.radiusMm + 6, -4, 9], [s.spiral.radiusMm + 6, -2, 14], [72, -18, 28], [77, -20, 18]], vertices = p.flex.geometry.attributes.position.array;
  cable.forEach(([x, y, z], i) => vertices.set([...mm(x - 2, y, z), ...mm(x + 2, y, z)], i * 6));
  p.flex.geometry.attributes.position.needsUpdate = true; p.flex.geometry.computeVertexNormals(); p.flex.geometry.computeBoundingSphere();
  p.status.material.color.set(s.time >= 11 ? s.available ? 0x398064 : 0xc14f39 : s.writing && s.canWrite ? 0xc39446 : 0x397b94);
  paintDvdrScreen(p.screenSurface, s);
  p.screenLabel.userData.setText(s.available ? `${s.storedName} · PICTURE ${s.frameIndex + 1} / 50` : s.time >= 11 ? 'FILE UNAVAILABLE' : s.seeking ? 'RETURN TO THE RECORDED REGION' :
    s.reading ? s.values.readLight ? 'CHECKING RETRIEVED FILE DATA' : 'READ LIGHT OFF: NO SIGNAL' : s.canWrite ? `RECORDING ${s.requestedName}` : s.values.medium ? 'OCCUPIED REGION: WRITE BLOCKED' : 'NO RECORDING EXPOSURE');
}

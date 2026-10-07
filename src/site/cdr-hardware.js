import * as THREE from 'three';
import { createCdromHardware } from './cdrom-hardware.js';
import { fillLine } from './scene-kit.js';
import { PLAYER_MM } from './blu-ray-player-model.js';
import { paintCdrScreen } from './cdr-screen.js';
const mm = (x, y, z) => [x * PLAYER_MM, y * PLAYER_MM, z * PLAYER_MM];

export function createCdrHardware(kit) {
  const hardware = createCdromHardware(kit);
  const descriptions = {
    system: ['CD-R writer and computer', 'The computer sends a chosen byte to a recordable-disc drive. Matched recording exposure changes dye permanently; low-power reading retrieves the resulting marks. The 120 mm disc has nominal dimensions. The drive layout is illustrative.'],
    player: ['Complete writer and computer', 'The connected computer, encoding board, pickup and disc write and read one guarded Mode 1 sector. The first user byte holds your chosen eight bits; the remaining 2,047 user bytes are zero padding. A real disc also needs format and recording metadata that this excerpt does not model.'],
    disc: ['Recordable disc and clamp', 'The 120 mm CD-R has a 15 mm center hole and nominal 1.2 mm thickness. A thin dye layer lies between the transparent polycarbonate and reflective metal near the label side. Recording changes that dye. Colors vary with dye and reflector; these colors identify layers rather than a particular product.'],
    laser: ['Recording laser and collimator', 'The laser supplies high recording exposure or low reading light. Correct exposure depends on the medium, drive, speed and calibration. This teaching model assumes a matched recording setup; it does not invent a universal power threshold. The infrared beam is shown in false color.'],
    detector: ['Photodetector and read signal', 'Both unrecorded and recorded material return some light. The changed material reduces the collected reflection in the prescribed read conditions. The receiver uses ideal detected transitions; diffraction, analog amplification and timing recovery are outside this model.'],
    electronics: ['Encoder, decoder and connections', 'Before writing, the board adds sector checks, scrambling, CIRC and EFM coding. The laser follows the resulting run pattern. During reading, the board reverses those steps and checks the recovered sector. Its result is derived from stored marks, never from the requested byte.'],
    outputs: ['Computer and byte display', 'The computer sends a requested byte and later displays the checked byte returned by the drive. An occupied region returns its previous recording even if a different new byte was requested.'],
    monitor: ['Requested byte and readback monitor', 'The upper row shows the chosen input. The lower row remains waiting until the read finishes and the sector passes its checks. A failed or dark read remains unavailable.'],
    computer: ['Computer and recording request', 'Two four-bit controls choose any of 256 possible bytes. The computer packages that byte in a sample data sector. It blocks rewriting an occupied region. Other unused regions of the disc could still be recorded.'],
  };
  for (const [id, [name, description]] of Object.entries(descriptions)) {
    const part = kit.parts.find(part => part.id === id); part.name = name; part.description = description; part.object.name = name;
  }
  for (const disc of [hardware.discBack, hardware.discFront]) { disc.material = disc.material.clone(); disc.material.color.set(0xc6b978); }
  for (const dot of hardware.lightDots) dot.material = dot.material.clone();
  return hardware;
}

export function updateCdrHardware(p, s) {
  p.pickup.position.x = s.spiral.radiusMm * PLAYER_MM; p.screw.rotation.x = (s.spiral.radiusMm - 25) / 2 * 2 * Math.PI;
  const angle = -s.spiral.angle;
  p.clampMark.position.set(...mm(3.5 * Math.sin(angle), 17.075, 3.5 * Math.cos(angle))); p.clampMark.rotation.y = angle;
  p.rotorMark.position.set(...mm(-11.5 * Math.sin(angle), 11.95, -11.5 * Math.cos(angle))); p.rotorMark.rotation.y = angle;
  fillLine(p.outgoing, [mm(-5.5, -1, 0), mm(0, -1, 0), mm(0, 7.4, 0), mm(0, 13.2, 0)]);
  fillLine(p.returning, [mm(.12, 13.2, .12), mm(.12, -.88, .12), mm(-3, -.88, .12), mm(-3, -.88, 6)]);
  p.outgoing.visible = p.returning.visible = Boolean(s.light);
  p.outgoing.material.color.set(s.exposing ? 0xc14f39 : 0x397b94);
  p.returning.material.color.set(s.detectorMark ? 0xa07a42 : 0xd9b960);
  const paths = [[[0, -1, 0], [0, 13.2, 0]], [[0, 13.2, .12], [0, -.88, .12], [-3, -.88, .12], [-3, -.88, 6]]];
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
  p.status.material.color.set(s.complete ? s.available ? 0x398064 : 0xc14f39 : s.writing && s.canWrite ? 0xc39446 : 0x397b94);
  paintCdrScreen(p.screenSurface, s);
  p.screenLabel.userData.setText(s.complete ? s.available ? `READ BACK ${s.outputBits}` : 'READBACK UNAVAILABLE' : s.seeking ? 'RETURN TO THE STORED REGION' : s.reading ? s.values.readLight ? 'READING AT LOW POWER' : 'READ LIGHT OFF: NO SIGNAL' : s.canWrite ? 'RECORDING THE CHOSEN BYTE' : s.values.medium ? 'RECORDED REGION: WRITE BLOCKED' : 'NO RECORDING EXPOSURE');
}

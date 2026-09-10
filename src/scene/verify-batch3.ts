/* Throwaway check for the five benches of part 3. Not part of the app. */
import * as THREE from 'three';
import {buildLightAndImages} from './mechanisms/light-and-images.ts';
import {buildPhotography} from './mechanisms/photography.ts';
import {buildPrinting} from './mechanisms/printing.ts';
import {buildSoundAndMusic} from './mechanisms/sound-and-music.ts';
import {buildTelecommunications} from './mechanisms/telecommunications.ts';
import {dotPitch, pipeFrequency, stringFrequency, thinLens, wavelength, SOUND_SPEED} from '../physics.ts';

let failures = 0;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
function check(ok: boolean, message: string) {
  if (!ok) {
    failures += 1;
    console.log('FAIL ' + message);
  }
}
const phases = Array.from({length: 11}, (_, i) => i / 10);

// ------------------------------------------------------- light and images
{
  const m = buildLightAndImages();
  // A check that never runs proves nothing, so count what it looked at.
  let rayChecks = 0;
  const perVariant = new Map<string, number>();
  const MM = 0.006;
  const AXIS = 1.5;
  const HEIGHT = 80 * MM;
  const rays = m.parts.rays as THREE.Group;
  const kinds: [string, number, boolean][] = [
    ['converging', 100, false],
    ['diverging', -100, false],
    ['concave-mirror', 100, true],
    ['convex-mirror', -100, true],
    ['plane-mirror', Infinity, true],
  ];
  // Each element must actually be shown when it is chosen, and nothing else
  // with it: five shapes stand on the bench and only one can be on it at a time.
  for (const [variant, , ] of kinds) {
    m.update({value: 250, variant, phase: 0, elapsed: 0});
    const standing = (m.parts.lens as THREE.Group).children.filter(
      node => node instanceof THREE.Mesh && kinds.some(([id]) => id === node.name) && node.visible,
    );
    check(standing.length === 1, `light: ${standing.length} elements on the bench for ${variant}`);
    check(standing[0]?.name === variant, `light: ${variant} put ${standing[0]?.name} on the bench`);
  }
  // A flat mirror has no focal point, so none is marked; the other four have two.
  for (const [variant, focal] of kinds) {
    m.update({value: 250, variant, phase: 0, elapsed: 0});
    const marks = (m.parts.lens as THREE.Group).children.filter(
      node => node.name === 'focus' && node.visible,
    );
    check(marks.length === (Number.isFinite(focal) ? 2 : 0), `light: ${marks.length} focal marks for ${variant}`);
  }
  // The focal length is a control too. Everything above runs at the one it is
  // cut for; this runs the whole slider and holds the drawing to the equation
  // at each setting, so a bench that quietly ignored the second slider would
  // look identical at every one of them and fail here.
  {
    let looked = 0;
    for (const [variant, focal, mirror] of kinds) {
      for (let f = 40; f <= 220; f += 5) {
        for (const distance of [60, 150, 250, 400]) {
          const signedF = Number.isFinite(focal) ? Math.sign(focal) * f : focal;
          m.update({value: distance, variant, phase: 0, elapsed: 0, extras: {focal: f}});
          m.group.updateMatrixWorld(true);
          const found = thinLens(signedF, distance);
          const fold = mirror ? -1 : 1;
          const drawable = Math.abs(found.distance) <= 450 && Math.abs(HEIGHT * found.magnification) < 3.2;
          const image = m.parts.image as THREE.Group;
          check(image.visible === drawable, `light: image shown wrongly at f ${f} ${variant}`);
          if (!drawable) continue;
          looked += 1;
          check(
            near(image.position.x, found.distance * MM * fold, 1e-9),
            `light: the image ignores the focal length at f ${f}, ${distance}, ${variant}`,
          );
          // The focal marks stand where the focal length is, so the rays aimed
          // at them and the marks themselves cannot disagree.
          const marks = (m.parts.lens as THREE.Group).children.filter(node => node.name === 'focus' && node.visible);
          check(marks.length === (Number.isFinite(focal) ? 2 : 0), `light: ${marks.length} focal marks at f ${f} ${variant}`);
          for (const mark of marks) {
            check(near(Math.abs(mark.position.x), f * MM, 1e-9), `light: a focal mark is not at f ${f}`);
          }
        }
      }
    }
    check(looked > 500, `light: only ${looked} focal length settings were checked`);
  }

  for (let distance = 40; distance <= 450; distance += 5) {
    for (const [variant, focal, mirror] of kinds) {
      m.update({value: distance, variant, phase: 0, elapsed: 0});
      m.group.updateMatrixWorld(true);
      const found = thinLens(focal, distance);
      const fold = mirror ? -1 : 1;
      // The two that spread light can never make anything a screen could catch,
      // and a flat mirror never changes the size of what it shows.
      if (focal < 0) check(!found.real, `light: ${variant} made a real image at ${distance}`);
      if (!Number.isFinite(focal)) {
        check(near(found.magnification, 1, 1e-12), `light: the flat mirror resized the object at ${distance}`);
        check(near(found.distance, -distance, 1e-12), `light: the flat mirror misplaced the image at ${distance}`);
      }
      // The object stands where the slider says, at the height it was given.
      check(near((m.parts.object as THREE.Group).position.x, -distance * MM, 1e-9), `light: object misplaced at ${distance}`);
      const drawable = Math.abs(found.distance) <= 450 && Math.abs(HEIGHT * found.magnification) < 3.2;
      const image = m.parts.image as THREE.Group;
      check(image.visible === drawable, `light: image shown when it should not be at ${distance}`);
      if (!drawable) continue;
      // The image is where the equation puts it, at the size it gives, the
      // right way up or upside down as the sign says.
      check(near(image.position.x, found.distance * MM * fold, 1e-9), `light: image at the wrong place, ${distance}`);
      const holder = image.children[0] as THREE.Group;
      const drawn = (holder.children[0] as THREE.Mesh).scale.y + (holder.children[1] as THREE.Mesh).scale.y * 0.26;
      check(near(drawn, Math.abs(HEIGHT * found.magnification), 1e-6), `light: image the wrong size at ${distance}`);
      check(
        near(holder.rotation.z, found.magnification < 0 ? Math.PI : 0, 1e-9),
        `light: image the wrong way up at ${distance}`,
      );
      // And the three outgoing rays all pass through the image tip.
      const tip = new THREE.Vector2(found.distance * MM * fold, AXIS + HEIGHT * found.magnification);
      const outbound = rays.children.slice(3, 6) as THREE.Mesh[];
      for (const segment of outbound) {
        if (!segment.visible) continue;
        const half = new THREE.Vector2(Math.cos(segment.rotation.z), Math.sin(segment.rotation.z)).multiplyScalar(
          segment.scale.x / 2,
        );
        const from = new THREE.Vector2(segment.position.x, segment.position.y).sub(half);
        const to = new THREE.Vector2(segment.position.x, segment.position.y).add(half);
        const line = to.clone().sub(from);
        const cross = line.x * (tip.y - from.y) - line.y * (tip.x - from.x);
        rayChecks += 1;
        perVariant.set(variant, (perVariant.get(variant) ?? 0) + 1);
        check(Math.abs(cross) / line.length() < 0.004, `light: a ray misses the image at ${distance}/${variant}`);
        // Passing through the image tip is not enough: a ray drawn the other way
        // along the same line would satisfy that and be light going backwards.
        // It leaves from the element and travels on, and for a mirror traveling
        // on means back the way it came.
        const near0 = Math.abs(from.x) < Math.abs(to.x) ? from : to;
        const far = near0 === from ? to : from;
        check(Math.abs(near0.x) < 1e-6, `light: a ray does not start at the element at ${distance}/${variant}`);
        check(far.x * fold > 1e-9, `light: a ray leaves backwards at ${distance}/${variant}`);
      }
    }
  }
  check(rayChecks > 1100, `light: only ${rayChecks} rays were actually checked`);
  // And no element was quietly skipped: a total is easy to reach with one
  // variant doing all the work.
  for (const [variant] of kinds) {
    check((perVariant.get(variant) ?? 0) > 150, `light: only ${perVariant.get(variant) ?? 0} rays checked for ${variant}`);
  }
  // The drawn glass has to be as wide as the aperture the rays are tested
  // against, or a ray can be accepted that misses it.
  const glass = (m.parts.lens as THREE.Group).getObjectByName('converging') as THREE.Mesh;
  glass.geometry.computeBoundingBox();
  const box = glass.geometry.boundingBox!;
  check(near(box.max.y, (210 / 2) * MM, 1e-6), `light: the glass reaches ${box.max.y.toFixed(3)}, not the aperture`);
  check(box.max.x < 0.25, `light: the glass is ${box.max.x.toFixed(3)} thick along the axis`);
}

// ------------------------------------------------------------ photography
{
  const m = buildPhotography();
  const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
  const MM = 0.022;
  const aperture = m.parts.aperture as THREE.Group;
  const blades = aperture.children.slice(1) as THREE.Mesh[];
  for (let i = 0; i < STOPS.length; i += 1) {
    m.update({value: i, variant: 'iso100', phase: 0, elapsed: 0});
    // The hole drawn is the hole the f number names: focal over f number.
    const wanted = ((50 / STOPS[i]) * MM) / 2;
    const reach = wanted + (30 * MM * 1.5) / 2;
    for (const blade of blades) {
      const at = Math.hypot(blade.position.y, blade.position.z);
      check(near(at, reach, 1e-9), `photography: blade at ${at.toFixed(4)} not ${reach.toFixed(4)} at f/${STOPS[i]}`);
    }
    // A smaller hole must mean a longer sharp band, every step of the way.
    if (i > 0) {
      const band = (m.parts.field as THREE.Group).children[1] as THREE.Mesh;
      const wide = band.scale.x;
      m.update({value: i - 1, variant: 'iso100', phase: 0, elapsed: 0});
      check(wide > (band.scale.x as number), `photography: the band did not deepen from f/${STOPS[i - 1]} to f/${STOPS[i]}`);
      m.update({value: i, variant: 'iso100', phase: 0, elapsed: 0});
    }
  }
}

// ---------------------------------------------------------------- printing
{
  const m = buildPrinting();
  const DRAWN = 4.4;
  const PER_MM = DRAWN / 6;
  const dots = m.parts.dots as THREE.Group;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  for (let ruling = 25; ruling <= 300; ruling += 5) {
    for (const variant of ['process', 'black']) {
      m.update({value: ruling, variant, phase: 0, elapsed: 0});
      const pitch = dotPitch(ruling) * PER_MM;
      for (const mesh of dots.children as THREE.InstancedMesh[]) {
        if (!mesh.visible) continue;
        check(mesh.count > 0, `printing: an ink laid no dots at ${ruling}`);
        // Nothing may be dropped for want of room in the pool, or the picture
        // quietly stops getting finer while the readout says it has.
        check(mesh.count < 5600, `printing: the dot pool ran out at ${ruling}`);
        for (let i = 0; i < mesh.count; i += Math.max(1, Math.floor(mesh.count / 40))) {
          mesh.getMatrixAt(i, matrix);
          position.setFromMatrixPosition(matrix);
          scale.setFromMatrixScale(matrix);
          const radius = scale.x / 2;
          // Every dot has to be solid ink of the right size, on the sheet.
          check(radius > 0 && radius < pitch, `printing: dot radius ${radius.toFixed(4)} against a pitch of ${pitch.toFixed(4)}`);
          check(
            Math.abs(position.x) + radius <= DRAWN / 2 + 1e-9 && Math.abs(position.z) + radius <= DRAWN / 2 + 1e-9,
            `printing: a dot hangs over the sheet at ${ruling}`,
          );
        }
      }
      const shown = (dots.children as THREE.InstancedMesh[]).filter(mesh => mesh.visible).length;
      check(shown === (variant === 'black' ? 1 : 4), `printing: ${shown} inks in ${variant}`);
      // A finer screen never lays fewer dots, and over any real step it lays
      // more. One step of five lines can land on the same lattice count, since
      // the count is whole dots.
      if (ruling > 75) {
        const finer = (dots.children[3] as THREE.InstancedMesh).count;
        m.update({value: ruling - 5, variant, phase: 0, elapsed: 0});
        check((dots.children[3] as THREE.InstancedMesh).count <= finer, `printing: ${ruling} lines laid fewer dots than ${ruling - 5}`);
        m.update({value: ruling - 50, variant, phase: 0, elapsed: 0});
        check((dots.children[3] as THREE.InstancedMesh).count < finer, `printing: ${ruling} lines laid no more dots than ${ruling - 50}`);
        m.update({value: ruling, variant, phase: 0, elapsed: 0});
      }
    }
  }
}

// --------------------------------------------------------- sound and music
{
  const m = buildSoundAndMusic();
  const METER = 3;
  const left = (-0.65 * METER) / 2;
  const string = m.parts.string as THREE.Group;
  const air = m.parts.air as THREE.Group;
  for (let length = 150; length <= 650; length += 5) {
    for (const variant of ['string', 'open', 'stopped']) {
      for (const phase of phases) {
        m.update({value: length, variant, phase, elapsed: phase * 4});
        m.group.updateMatrixWorld(true);
        // The stop stands at the end of the working length, exactly.
        const right = left + (length / 1000) * METER;
        check(near((m.parts.bridge as THREE.Group).position.x, right, 1e-9), `sound: stop misplaced at ${length}`);
        // The vibrating part reaches from one end to the other and no further.
        const pieces = string.children as THREE.Mesh[];
        const span = pieces.reduce((total, piece) => total + piece.scale.x, 0);
        check(span >= right - left - 1e-9, `sound: the string covers ${span.toFixed(3)} of ${(right - left).toFixed(3)}`);
      }
      // One swing of the string sends out exactly one wave. What that takes on
      // screen is not a fixed time any more: the drawing runs at the ratio of
      // this note to the one the bench opens on, so a higher note swings faster,
      // which is the only way a change of frequency at an unchanged wavelength
      // can be seen at all.
      const beadAt = (elapsed: number) => {
        m.update({value: length, variant, phase: 0, elapsed});
        return (air.children[0] as THREE.Mesh).position.y;
      };
      const note =
        variant === 'string'
          ? stringFrequency(length / 1000, 65.4, 0.0008)
          : pipeFrequency(length / 1000, variant === 'stopped');
      const rate = Math.min(4, 1.4 * (note / 264));
      const start = beadAt(0);
      check(near(beadAt(1 / rate), start, 1e-6), `sound: the wave is out of step with the string at ${length}`);

      m.update({value: length, variant, phase: 0, elapsed: 0});
      // One wavelength of air marked off, at the length the pitch gives it.
      const frequency =
        variant === 'string'
          ? stringFrequency(length / 1000, 65.4, 0.0008)
          : pipeFrequency(length / 1000, variant === 'stopped');
      const drawn = wavelength(SOUND_SPEED, frequency) * METER;
      const marks = air.children.filter(c => c instanceof THREE.Mesh && (c.geometry as THREE.BufferGeometry).type === 'CylinderGeometry') as THREE.Mesh[];
      check(marks.length === 2, 'sound: the wavelength is not marked at both ends');
      check(
        near(marks[1].position.x - marks[0].position.x, drawn, 1e-9),
        `sound: wavelength marked at ${(marks[1].position.x - marks[0].position.x).toFixed(3)} not ${drawn.toFixed(3)}`,
      );
      // The rule the marks stand on has to be long enough to hold them.
      check(drawn <= 8.2 + 1e-9, `sound: a wavelength of ${drawn.toFixed(2)} runs off an 8.2 rule at ${length}`);
    }
  }
}

// ----------------------------------------------------- telecommunications
{
  const m = buildTelecommunications();
  const RUN = 6.4;
  const antenna = m.parts.antenna as THREE.Group;
  const mast = antenna.children[0] as THREE.Mesh;
  for (let value = 5.3; value <= 9.3001; value += 0.05) {
    for (const variant of ['am', 'fm']) {
      m.update({value, variant, phase: 0, elapsed: 0});
      const cycles = 4 + ((value - 5.3) / 4) * 8;
      // The mast is a quarter of the wavelength drawn beside it, always.
      check(near(mast.scale.y, RUN / cycles / 4, 1e-9), `telecom: mast is not a quarter wave at ${value.toFixed(2)}`);
      const rule = antenna.children[2] as THREE.Mesh;
      check(near(rule.scale.x, RUN / cycles, 1e-9), `telecom: the wavelength rule is wrong at ${value.toFixed(2)}`);
    }
  }
  // Amplitude modulation moves the height and leaves the rate alone; frequency
  // modulation does the reverse.
  const heights = (variant: string) => {
    m.update({value: 7, variant, phase: 0, elapsed: 0});
    return ((m.parts.modulated as THREE.Group).children as THREE.Mesh[]).map(piece => piece.position.y);
  };
  const am = heights('am');
  const fm = heights('fm');
  const peak = (list: number[]) => Math.max(...list) - Math.min(...list);
  const crossings = (list: number[]) => {
    const middle = (Math.max(...list) + Math.min(...list)) / 2;
    let count = 0;
    for (let i = 1; i < list.length; i += 1) if (list[i - 1] < middle !== list[i] < middle) count += 1;
    return count;
  };
  check(peak(fm) < peak(am) - 0.05, 'telecom: frequency modulation is changing the height');
  check(crossings(fm) !== crossings(am), 'telecom: the two modulations look the same');
}

// The second sliders of part three.
{
  // A closer subject has a shallower depth of field at the same opening, and
  // the bench draws that band rather than only reporting it.
  const cam = buildPhotography();
  // The band itself is the second child of the group, drawn at the width of the
  // sharp zone; the rest is the scale it is measured against.
  const bandAt = (subject: number) => {
    cam.update({value: 3, variant: 'iso100', phase: 0, elapsed: 0, extras: {subject}});
    cam.group.updateMatrixWorld(true);
    return ((cam.parts.field as THREE.Group).children[1] as THREE.Mesh).scale.x;
  };
  check(bandAt(600) < bandAt(2000), `camera: a closer subject did not shrink the sharp band, ${bandAt(600)} against ${bandAt(2000)}`);
  check(bandAt(2000) < bandAt(9000), 'camera: a farther subject did not widen the sharp band');

  // More ink means bigger dots at the same screen ruling.
  const press = buildPrinting();
  // The dots are instanced, so their size lives in the instance matrix.
  const spare = new THREE.Vector3();
  const dotAt = (ink: number) => {
    press.update({value: 150, variant: 'process', phase: 0, elapsed: 0, extras: {ink}});
    press.group.updateMatrixWorld(true);
    const screen = (press.parts.dots as THREE.Group).children[0] as THREE.InstancedMesh;
    const at = new THREE.Matrix4();
    screen.getMatrixAt(0, at);
    at.decompose(new THREE.Vector3(), new THREE.Quaternion(), spare);
    return spare.x;
  };
  check(dotAt(10) < dotAt(100) && dotAt(100) < dotAt(180), `printing: the ink does not change the dots, ${dotAt(10).toFixed(4)} ${dotAt(100).toFixed(4)} ${dotAt(180).toFixed(4)}`);
  // Solid ink over the share of the area the tint asks for, so the diameter goes
  // with the square root of it: four times the ink is twice the dot.
  // Away from the cap, where a dot cannot exceed its own cell.
  check(
    near(dotAt(100) / dotAt(25), Math.sqrt(100 / 25), 1e-6),
    `printing: four times the ink gave ${(dotAt(100) / dotAt(25)).toFixed(4)} of the dot, not two`,
  );

  // A tighter string sounds higher, and a warm hall sharpens a pipe and not a
  // string, which is the whole reason each has a slider of its own.
  const sound = buildSoundAndMusic();
  // The drawn wavelength is the note, so it is what a second slider has to move.
  const waveAt = (variant: string, extras: Record<string, number>) => {
    sound.update({value: 650, variant, phase: 0.25, elapsed: 0.4, extras});
    sound.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sound.parts.air as THREE.Group);
    return box.max.x - box.min.x;
  };
  check(waveAt('string', {tension: 400}) < waveAt('string', {tension: 10}), 'sound: a tighter string did not sound higher');
  check(near(waveAt('string', {air: -10}), waveAt('string', {air: 45}), 1e-9), 'sound: the air temperature moved the string');
  check(near(waveAt('open', {tension: 10}), waveAt('open', {tension: 400}), 1e-9), 'sound: tension moved a pipe');
  // Warming the air sharpens a pipe without changing its wavelength at all,
  // because the speed and the frequency move together. What it does change is
  // how fast the wave runs, so that is where it has to show.
  const runAt = (variant: string, extras: Record<string, number>) => {
    sound.update({value: 650, variant, phase: 0.25, elapsed: 0.31, extras});
    sound.group.updateMatrixWorld(true);
    return ((sound.parts.air as THREE.Group).children[0] as THREE.Object3D).position.y;
  };
  check(near(waveAt('open', {air: 45}), waveAt('open', {air: -10}), 1e-9), 'sound: the air changed a pipe wavelength, which it must not');
  check(runAt('open', {air: 45}) !== runAt('open', {air: -10}), 'sound: a warm hall did not sharpen the pipe');

  // A carrier only a few times faster than its message is barely a carrier.
  const radio = buildTelecommunications();
  const wiggle = (message: number) => {
    radio.update({value: 8, variant: 'fm', phase: 0, elapsed: 0.3, extras: {message}});
    radio.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(radio.parts.signal as THREE.Group);
    return box.max.x - box.min.x;
  };
  check(wiggle(0.5) > 0 && wiggle(6) > 0, 'radio: the message trace is not drawn');
}

console.log(failures === 0 ? 'BATCH 3 CLEAN' : `${failures} failures`);

if (failures) process.exitCode = 1;

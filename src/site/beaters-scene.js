import * as THREE from 'three';
import {surface} from './scene-kit.js';
import {BEATER} from './beaters-physics.js';

// Pieces the egg whisk and the electric mixer both draw: the bowl and mixture,
// and a wire beater. Lengths in millimeters; each model passes its own scale.

export const BEATER_SHAPE = Object.freeze({radius: BEATER.diameter * 500, height: 60, wire: 0.9, spacing: 44.5, bottom: 10});
export const BOWL = Object.freeze({radius: 90, depth: 70, wall: 3, fill: 40});
const MIXTURE_COLORS = [0x7fb3d0, 0xe6d27a, 0xf2ead2, 0xfaf6ea, 0xb98a55];

export function bowlWithMixture(kit, parent, covers, MM) {
  const bowl = kit.part('bowl', 'Bowl and mixture', 'The mixture the beaters turn in. The bowl’s front half is cut away and the mixture is drawn see-through so the beaters show.', [0, 0, 0], parent);
  const profile = [[0, 0], [BOWL.radius + BOWL.wall, 0], [BOWL.radius + BOWL.wall, BOWL.depth], [BOWL.radius, BOWL.depth], [BOWL.radius, BOWL.wall], [0, BOWL.wall]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM));
  surface(kit, new THREE.LatheGeometry(profile, 48, Math.PI / 2, Math.PI), 'cream', bowl, true);
  covers.push(surface(kit, new THREE.LatheGeometry(profile, 48, -Math.PI / 2, Math.PI), 'cream', bowl, true));
  const mixture = kit.cylinder((BOWL.radius - 0.5) * MM, BOWL.fill * MM, [0, (BOWL.wall + BOWL.fill / 2) * MM, 0], 'cream', bowl);
  mixture.material = mixture.material.clone();
  mixture.material.transparent = true;
  mixture.material.opacity = 0.45;
  mixture.material.depthWrite = false;
  return {bowl, mixture, set: index => mixture.material.color.set(MIXTURE_COLORS[index])};
}

/** Radius of a beater's blades at height y above the bottom of its loops, in millimeters. */
export function bladeRadius(y) {
  const c = 2 * y / BEATER_SHAPE.height - 1;
  return Math.abs(c) >= 1 ? 0 : BEATER_SHAPE.radius * Math.sqrt(1 - c * c);
}

/**
 * A wire beater: two elliptical loops in perpendicular planes through its
 * shaft, so four blades at local angles 0, 90, 180 and 270 degrees. The group
 * turns about its own y axis; y = 0 is the bottom of the loops.
 */
export function beaterWire(kit, parent, MM) {
  const group = new THREE.Group();
  parent.add(group);
  for (const plane of [0, Math.PI / 2]) {
    const points = Array.from({length: 64}, (_, i) => {
      const u = i / 64 * Math.PI * 2, y = BEATER_SHAPE.height / 2 * (1 + Math.cos(u)), r = Math.sign(Math.sin(u)) * bladeRadius(y);
      return new THREE.Vector3(r * Math.cos(plane) * MM, y * MM, -r * Math.sin(plane) * MM);
    });
    surface(kit, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 128, BEATER_SHAPE.wire * MM, 6, true), 'metal', group);
  }
  return group;
}

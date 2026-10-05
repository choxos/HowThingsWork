import * as THREE from 'three';
import {surface} from './scene-kit.js';
import {STAPLER, magazineAngle} from './stapler-physics.js';
import {STAPLER_CYCLE} from './stapler-cycle.js';

/** Assigned magazine dimensions, mm; the spring is not a force solver. */
export const FEED = Object.freeze({rear: 8, radius: 2.5, wire: .175, turns: 32, follower: 6, railHalf: 4, railWidth: .8, railDepth: .5});

/** A constant-wire-radius helix whose length can change without allocation. */
function coil(kit, parent, scale) {
  const rings = FEED.turns * 20, sides = 8, geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((rings + 1) * (sides + 1) * 3), normals = new Float32Array(positions.length), indices = [];
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  geometry.setIndex(indices);
  const object = surface(kit, geometry, 'metal', parent);
  let lastLength;
  function setLength(length) {
    if (length === lastLength) return;
    lastLength = length;
    const winding = Math.PI * 2 * FEED.turns, tangentLength = Math.hypot(length, FEED.radius * winding);
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, angle = winding * t, c = Math.cos(angle), s = Math.sin(angle);
      // Radial normal N=(0,c,s); B=T cross N, with T along the helix.
      const bx = -FEED.radius * winding / tangentLength, by = -length * s / tangentLength, bz = length * c / tangentLength;
      for (let j = 0; j <= sides; j++) {
        const phi = j / sides * Math.PI * 2, u = Math.cos(phi), v = Math.sin(phi);
        const nx = v * bx, ny = u * c + v * by, nz = u * s + v * bz, index = i * (sides + 1) + j;
        geometry.attributes.position.setXYZ(index, (length * t + FEED.wire * nx) * scale, (FEED.radius * c + FEED.wire * ny) * scale, (FEED.radius * s + FEED.wire * nz) * scale);
        geometry.attributes.normal.setXYZ(index, nx, ny, nz);
      }
    }
    geometry.attributes.position.needsUpdate = geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  return {object, setLength, rings, sides};
}

/** Seven spare staples, their follower, support rails and the feed spring. */
export function createStaplerFeed(kit, magazine, magazinePivot, scale) {
  const strip = kit.part('strip', 'Staple strip and follower', 'Seven spare staples sit behind the one being driven. The gold staple is next; blue guide posts mark its delivery position. After the driver rises clear, the coil spring moves the follower and row forward by one wire width. Alternating gray shades distinguish adjacent staples.', [0, 0, 0], magazine);
  const box = (color, parent) => surface(kit, new THREE.BoxGeometry(1, 1, 1), color, parent);
  const setBox = (object, x0, x1, y0, y1, z0, z1) => {
    object.position.set((x0 + x1) * scale / 2, (y0 + y1) * scale / 2, (z0 + z1) * scale / 2);
    object.scale.set((x1 - x0) * scale, (y1 - y0) * scale, (z1 - z0) * scale);
  };
  const spares = Array.from({length: STAPLER_CYCLE.loaded - 1}, (_, i) => {
    const group = new THREE.Group(); strip.add(group);
    const color = i ? (i % 2 ? 0x8d989c : 'metal') : 'gold';
    return {group, crown: box(color, group), legs: [box(color, group), box(color, group)]};
  });
  const follower = new THREE.Group(); strip.add(follower);
  const bridge = box('ink', follower), stem = box('ink', follower);
  const rails = [-1, 1].map(() => box('metal', magazinePivot));
  const guides = [-1, 1].map(() => box('blue', strip));
  const spring = coil(kit, magazinePivot, scale), rearSeat = box('ink', magazinePivot);
  let key;
  function update(plan, motion) {
    const {wire, crown, leg, staple} = plan, pitch = staple.width;
    const angle = magazineAngle(motion.magazineDrop), height = STAPLER.recess + STAPLER.longest;
    if (key !== plan.values.staple) {
      key = plan.values.staple;
      for (const spare of spares) {
        setBox(spare.crown, -pitch / 2, pitch / 2, -wire, 0, -crown / 2, crown / 2);
        spare.legs.forEach((object, i) => {
          const center = (i ? 1 : -1) * (crown - wire) / 2;
          setBox(object, -pitch / 2, pitch / 2, -leg, -wire, center - wire / 2, center + wire / 2);
        });
      }
      setBox(bridge, -FEED.follower, 0, -wire, 0, -crown / 2, crown / 2);
      setBox(stem, -FEED.follower, 0, -wire - 6, -wire, -3, 3);
      rails.forEach((rail, i) => {
        const z = (i ? 1 : -1) * FEED.railHalf;
        setBox(rail, FEED.rear, STAPLER.blade - pitch / 2, height - wire - FEED.railDepth, height - wire, z - FEED.railWidth / 2, z + FEED.railWidth / 2);
      });
      guides.forEach((guide, i) => {
        const z = (i ? 1 : -1) * (crown / 2 + .7);
        setBox(guide, .3, 1.0, -leg, .6, z - .3, z + .3);
      });
      setBox(rearSeat, FEED.rear - 1, FEED.rear, height - wire - 6, height - wire, -3, 3);
    }
    strip.position.set(STAPLER.blade * scale, (STAPLER.gap + height - motion.magazineDrop) * scale, 0);
    strip.rotation.z = -angle;
    spares.forEach((spare, i) => { spare.group.position.x = (-(i + 1) * pitch + motion.feedTravel) * scale; });
    const followerFront = -spares.length * pitch - pitch / 2 + motion.feedTravel;
    follower.position.x = followerFront * scale;
    // The crown plane intersects the fixed vertical nose guide at x=blade.
    const frontOnRail = (STAPLER.blade - height * Math.sin(angle)) / Math.cos(angle);
    const followerBack = frontOnRail + followerFront - FEED.follower;
    // Account for the tilted end-ring normals so both end turns touch their
    // seats without a gap or penetration.
    const span = followerBack - FEED.rear, windingRadius = FEED.radius * 2 * Math.PI * FEED.turns;
    let axialRadius = FEED.wire;
    for (let i = 0; i < 8; i++) axialRadius = FEED.wire * windingRadius / Math.hypot(span - 2 * axialRadius, windingRadius);
    const springStart = FEED.rear + axialRadius, springEnd = followerBack - axialRadius;
    spring.object.position.set(springStart * scale, (height - wire - 3) * scale, 0);
    spring.setLength(springEnd - springStart);
    return {angle, frontOnRail, followerFront, followerBack, springStart, springEnd, springLength: springEnd - springStart, axialRadius, pitch};
  }
  return {strip, spares, follower, bridge, stem, rails, guides, spring, rearSeat, update};
}

import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, arrow, forceLengths, swell} from '../kit.ts';

// ---------------------------------------------------------------------------
// Pulleys. One rope threaded between a fixed block and a moving one, with the
// number of strands under the moving block as the single control.
//
// The rope is laid out on vertical lines spaced two sheave radii apart, so
// every wrap is exactly half a circle and every strand is exactly vertical.
// Strand k and strand k + 1 are joined at the top when (k + strands) is odd,
// and at the bottom otherwise, which puts the dead end on the fixed block for
// an even count and on the moving block for an odd one.
// ---------------------------------------------------------------------------

const SHEAVE = 0.3;
const ROPE = 0.045;
const BEAM_Y = 4;
const TOP_Y = BEAM_Y - 0.5;
/** Low enough to read, high enough that the crate never touches the floor. */
const BLOCK_REST = 1.52;
const LIFT = 0.35;
const CRATE = 0.62;
/** The load the crate is cut for, in kilograms, and the range the slider gives it. */
const CRATE_KG = 100;
const MAX_STRANDS = 6;
/** Where the hauling hand starts, before it pulls rope through. */
const HAND_REST = TOP_Y - 1.15;

const overTop = (k: number, strands: number) => (k + strands) % 2 === 1;

/** Half a wheel of rope: the top half by default, the bottom half when flipped. */
function wrap(parent: THREE.Object3D, under: boolean) {
  const mesh = add(parent, new THREE.TorusGeometry(SHEAVE, ROPE, 8, 28, Math.PI), mat('rope'));
  if (under) mesh.rotation.z = Math.PI;
  return mesh;
}

function sheave(parent: THREE.Object3D) {
  const wheel = new THREE.Group();
  const rim = cylinder(wheel, SHEAVE, 0.16, 'steel', 28);
  rim.rotation.x = Math.PI / 2;
  const groove = cylinder(wheel, SHEAVE - 0.05, 0.2, 'dark', 24);
  groove.rotation.x = Math.PI / 2;
  const pin = cylinder(wheel, 0.06, 0.3, 'dark', 12);
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0;
  parent.add(wheel);
  return wheel;
}

export function buildPulleys(): Mechanism {
  const group = new THREE.Group();

  // The gantry belongs with the fixed block: both are the part that stays put.
  const fixed = new THREE.Group();
  for (const side of [-1, 1]) {
    const post = box(fixed, [0.32, BEAM_Y, 0.32], 'timber');
    post.position.set(side * 2.7, BEAM_Y / 2, 0);
    const foot = box(fixed, [1, 0.22, 1], 'deck');
    foot.position.set(side * 2.7, 0.11, 0);
  }
  const beam = box(fixed, [5.8, 0.34, 0.42], 'timber');
  beam.position.y = BEAM_Y - 0.17;

  // A plate hung under the beam carries the upper sheaves.
  // Both plates are drawn one unit wide and stretched to span whatever sheaves
  // the current strand count puts under them.
  const fixedPlate = box(fixed, [1, 0.16, 0.5], 'dark');
  fixedPlate.name = 'plate';
  fixedPlate.position.y = TOP_Y + 0.34;
  const strap = box(fixed, [0.14, 0.4, 0.16], 'steel');
  strap.position.y = TOP_Y + 0.6;
  const upper = Array.from({length: 3}, () => sheave(fixed));
  for (const wheel of upper) wheel.position.y = TOP_Y;
  group.add(fixed);

  // The moving block: the same again, but hung on the rope and free to rise.
  const moving = new THREE.Group();
  const movingPlate = box(moving, [1, 0.16, 0.5], 'dark');
  movingPlate.name = 'plate';
  const hook = cylinder(moving, 0.05, 0.4, 'steel', 10);
  const lower = Array.from({length: 3}, () => sheave(moving));
  group.add(moving);

  const ropeGroup = new THREE.Group();
  const strandGeometry = new THREE.CylinderGeometry(ROPE, ROPE, 1, 8).translate(0, 0.5, 0);
  const strands = Array.from({length: MAX_STRANDS + 1}, () => add(ropeGroup, strandGeometry, mat('rope')));
  const wraps = Array.from({length: MAX_STRANDS}, () => wrap(ropeGroup, false));
  const grip = cylinder(ropeGroup, 0.1, 0.4, 'timber', 14);
  grip.rotation.z = Math.PI / 2;
  const effort = arrow(ropeGroup);
  effort.holder.rotation.z = Math.PI;
  group.add(ropeGroup);

  const load = new THREE.Group();
  const crate = box(load, [CRATE, CRATE, CRATE], 'timber');
  const lift = arrow(load, 'steel');
  group.add(load);

  const anchors = {
    fixed: new THREE.Vector3(),
    moving: new THREE.Vector3(),
    rope: new THREE.Vector3(),
    load: new THREE.Vector3(),
  };

  return {
    group,
    view: new THREE.Vector3(-0.3, 0.24, 1).normalize(),
    parts: {fixed, moving, rope: ropeGroup, load},
    anchors,
    update(state) {
      const {value, phase} = state;
      const count = Math.max(1, Math.min(MAX_STRANDS, Math.round(value)));
      // How many strands share the weight is one half of a hoist; how heavy the
      // weight is, is the other. The crate stands for its load by volume, so
      // twice the mass is twice the timber and not eight times it.
      const kilograms = dial(state, 'load', CRATE_KG);
      const side = CRATE * Math.cbrt(kilograms / CRATE_KG);
      crate.scale.setScalar(side / CRATE);
      const hauled = swell(phase) * LIFT;
      const blockY = BLOCK_REST + hauled;
      // A rope of fixed length: every supporting strand shortens by the lift,
      // so the free end has to take up that many times as much.
      const handY = HAND_REST - hauled * count;

      // Lines are spaced two radii apart and centered on the middle of the rig.
      const left = -count * SHEAVE;
      const lineX = (k: number) => left + k * 2 * SHEAVE;

      const upperXs: number[] = [];
      const lowerXs: number[] = [];
      let top = 0;
      let bottom = 0;
      for (let k = 0; k < MAX_STRANDS; k += 1) {
        const live = k < count;
        const piece = wraps[k];
        piece.visible = live;
        if (!live) continue;
        const above = overTop(k, count);
        piece.rotation.z = above ? 0 : Math.PI;
        piece.position.set(lineX(k) + SHEAVE, above ? TOP_Y : blockY, 0);
        const at = lineX(k) + SHEAVE;
        (above ? upperXs : lowerXs).push(at);
        const wheel = above ? upper[top++] : lower[bottom++];
        wheel.visible = true;
        wheel.position.x = at;
      }
      for (let i = top; i < upper.length; i += 1) upper[i].visible = false;
      for (let i = bottom; i < lower.length; i += 1) lower[i].visible = false;

      for (let k = 0; k <= MAX_STRANDS; k += 1) {
        const line = strands[k];
        line.visible = k <= count;
        if (!line.visible) continue;
        // Every strand but the last runs the full gap between the two blocks.
        const foot = k === count ? handY : blockY;
        line.position.set(lineX(k), foot, 0);
        line.scale.y = TOP_Y - foot;
      }

      // A plate has to reach both ends of the row of sheaves it carries.
      const span = (xs: number[]) => {
        const low = Math.min(...xs);
        const high = Math.max(...xs);
        return {middle: (low + high) / 2, width: high - low + 2 * SHEAVE + 0.24};
      };
      const above = span(upperXs);
      fixedPlate.scale.x = above.width;
      fixedPlate.position.x = above.middle;
      strap.position.x = above.middle;

      // The moving block only exists once there is something to hang it from.
      const hung = count > 1;
      const below = hung ? span(lowerXs) : {middle: lineX(0), width: 1};
      movingPlate.visible = hung;
      hook.visible = hung;
      movingPlate.scale.x = below.width;
      movingPlate.position.set(below.middle, blockY - 0.34, 0);
      hook.position.set(below.middle, blockY - 0.62, 0);
      for (const wheel of lower) wheel.position.y = blockY;

      grip.position.set(lineX(count), handY, 0);
      const forces = forceLengths(1 / count, 1);
      effort.set(forces.effort);
      effort.holder.position.set(lineX(count) + 0.34, handY - 0.12, 0);

      const crateTop = hung ? blockY - 0.82 : blockY;
      crate.position.set(below.middle, crateTop - side / 2, 0);
      lift.set(forces.load);
      lift.holder.position.set(left - 0.75, crateTop - side / 2, 0);

      anchors.fixed.set(above.middle, TOP_Y + 0.85, 0);
      anchors.moving.set(below.middle, blockY + 0.35, 0.4);
      anchors.rope.set(lineX(count) + 0.5, handY + 0.7, 0);
      anchors.load.set(below.middle, crateTop - side - 0.3, 0.4);
    },
  };
}

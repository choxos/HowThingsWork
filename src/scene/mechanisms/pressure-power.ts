import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {add, box, cylinder, dial, arrow, forceLengths, swell} from '../kit.ts';
import {ATMOSPHERE, boyleVolume, hydraulicPress, pistonArea} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Pressure power. Two cylinders joined at the bottom by a pipe, drawn to one
// scale: 0.011 scene units to the millimeter of bore. The pressure the small
// piston raises is the pressure the large one feels, so the force out is the
// force in multiplied by the ratio of the areas, and the travel is the volume
// pushed in divided by the area it arrives at.
// ---------------------------------------------------------------------------

/** Scene units per millimeter of bore. */
const MM = 0.011;
/** The small piston the bench opens with, in millimeters. */
const SMALL_BORE = 20;
const HAND_FORCE = 100;
const INPUT_STROKE = 50;
const GAS_COLUMN = 60;
const BED_Y = 0.28;
const PIPE_Y = BED_Y + 0.26;
const SMALL_X = -2.5;
const BARREL = 2.4;
const WALL = 0.07;

/**
 * A cylinder drawn in section: a floor and two walls, open toward the viewer,
 * built once at unit width and set to whatever bore is asked for.
 */
function barrel(parent: THREE.Object3D, height: number) {
  const shell = new THREE.Group();
  const floor = box(shell, [1, WALL, 1], 'dark');
  const walls = [-1, 1].map(side => {
    const wall = box(shell, [WALL, height, 1], 'dark');
    wall.position.y = height / 2;
    wall.userData.side = side;
    return wall;
  });
  const back = box(shell, [1, height, WALL], 'dark');
  back.position.y = height / 2;
  parent.add(shell);
  return {
    shell,
    set(radius: number) {
      floor.scale.set(radius * 2 + 2 * WALL, 1, radius * 2);
      floor.position.y = WALL / 2;
      for (const wall of walls) {
        wall.scale.z = radius * 2;
        wall.position.x = (wall.userData.side as number) * (radius + WALL / 2);
      }
      back.scale.x = radius * 2;
      back.position.z = -radius;
    },
  };
}

export function buildPressurePower(): Mechanism {
  const group = new THREE.Group();

  const bed = box(group, [7.4, BED_Y, 2.2], 'deck');
  bed.position.y = BED_Y / 2;
  // The conduit the cylinders stand on, open at the front so the fluid running
  // between them can be seen.
  const conduit = box(group, [6.6, BED_Y + 0.34, 0.1], 'dark');
  conduit.position.set(0, (BED_Y + 0.34) / 2, -0.3);
  const conduitFloor = box(group, [6.6, 0.06, 0.6], 'dark');
  conduitFloor.position.y = BED_Y + 0.03;

  const small = new THREE.Group();
  small.position.set(SMALL_X, PIPE_Y, 0);
  const smallBarrel = barrel(small, BARREL);
  const smallPiston = cylinder(small, 1, 0.16, 'steel', 24);
  const smallRod = cylinder(small, 0.05, 1.5, 'steel', 12);
  const handle = cylinder(small, 0.13, 0.6, 'accent', 16);
  handle.rotation.z = Math.PI / 2;
  group.add(small);

  const large = new THREE.Group();
  large.position.set(1.4, PIPE_Y, 0);
  const largeBarrel = barrel(large, BARREL);
  const largePiston = cylinder(large, 1, 0.18, 'steel', 32);
  // A ram carries the load clear of the bore, the way a jack does.
  // Slim enough to pass through the smallest bore on the slider.
  const ram = cylinder(large, ((20 / 2) * MM) / 2, 1.6, 'steel', 16);
  const platen = box(large, [1.5, 0.16, 1.3], 'dark');
  group.add(large);

  // The fluid: a column in each cylinder and the pipe that joins them.
  const fluidTone = new THREE.MeshStandardMaterial({color: 0x3f6f86, roughness: 0.2, metalness: 0.1});
  const fluid = new THREE.Group();
  const smallColumn = add(fluid, new THREE.CylinderGeometry(1, 1, 1, 24), fluidTone.clone());
  const largeColumn = add(fluid, new THREE.CylinderGeometry(1, 1, 1, 32), fluidTone.clone());
  const pipe = add(fluid, new THREE.BoxGeometry(1, 0.2, 0.5), fluidTone.clone());
  pipe.position.y = PIPE_Y - 0.1;
  group.add(fluid);

  const load = new THREE.Group();
  const slab = box(load, [1.9, 0.7, 1.5], 'stone');
  const lift = arrow(load, 'steel');
  group.add(load);

  const push = arrow(small);
  push.holder.rotation.z = Math.PI;

  const anchors = {
    small: new THREE.Vector3(),
    large: new THREE.Vector3(),
    fluid: new THREE.Vector3(-0.6, PIPE_Y - 0.5, 0.7),
    load: new THREE.Vector3(),
  };

  let drawnBore = 0;

  return {
    group,
    view: new THREE.Vector3(-0.12, 0.3, 1).normalize(),
    parts: {small, large, fluid, load},
    anchors,
    update(state) {
      const {value, variant, phase} = state;
      // Both bores, because the press is the ratio between them and one alone
      // is only ever half the machine.
      const smallBore = dial(state, 'small', SMALL_BORE);
      // The small piston is drawn at the bore the numbers use, so the ratio the
      // press works by can be read off the two cylinders.
      const smallRadius = (smallBore / 2) * MM;
      smallBarrel.set(smallRadius);
      smallPiston.scale.set(smallRadius - 0.01, 1, smallRadius - 0.01);
      const largeRadius = (value / 2) * MM;
      if (value !== drawnBore) {
        largeBarrel.set(largeRadius);
        largePiston.scale.set(largeRadius, 1, largeRadius);
        largeColumn.scale.x = largeRadius - 0.015;
        largeColumn.scale.z = largeRadius - 0.015;
        drawnBore = value;
      }
      large.position.x = 1.4 + largeRadius;

      const press = hydraulicPress(pistonArea(smallBore), pistonArea(value));
      const pressure = HAND_FORCE / pistonArea(smallBore);
      const bar = pressure * 10;

      // A gas squeezes before it shifts anything, so part of the stroke is
      // swallowed and only the rest reaches the far piston.
      const squeezed = variant === 'gas' ? GAS_COLUMN - boyleVolume(ATMOSPHERE, GAS_COLUMN, bar + ATMOSPHERE) : 0;

      const stroke = swell(phase);
      // Drawn at the same 0.011 units to the millimeter as the bores, so the
      // stroke on screen is the stroke the readout names.
      const downSmall = stroke * INPUT_STROKE * MM;
      const upLarge = (Math.max(0, stroke * INPUT_STROKE - squeezed) / press.distanceRatio) * MM;

      const smallTop = BARREL - 0.75 - downSmall;
      smallPiston.position.y = smallTop;
      smallRod.position.y = smallTop + 0.83;
      handle.position.y = smallTop + 1.75;
      smallColumn.scale.set(smallRadius - 0.015, Math.max(0.02, smallTop - 0.08), smallRadius - 0.015);
      smallColumn.position.set(SMALL_X, PIPE_Y + 0.07 + (smallTop - 0.08) / 2, 0);

      const largeTop = BARREL - 0.7 + upLarge;
      largePiston.position.y = largeTop;
      ram.position.y = largeTop + 0.85;
      platen.position.y = largeTop + 1.72;
      platen.scale.x = Math.max(1, (largeRadius * 2 + 0.3) / 1.5);
      largeColumn.scale.y = Math.max(0.02, largeTop - 0.09);
      largeColumn.position.set(large.position.x, PIPE_Y + 0.07 + (largeTop - 0.09) / 2, 0);
      pipe.scale.x = large.position.x - SMALL_X;
      pipe.position.x = (large.position.x + SMALL_X) / 2;

      load.position.set(large.position.x, PIPE_Y + largeTop + 1.8 + 0.35, 0);
      slab.scale.x = Math.max(1, (largeRadius * 2 + 0.3) / 1.9);

      // One arrow for the hand, one for what comes out, on a shared scale.
      const forces = forceLengths(1, press.forceRatio);
      push.set(forces.effort);
      push.holder.position.set(0, BARREL + 0.55 + forces.effort - downSmall, 0);
      lift.set(forces.load);
      // Alongside the load, starting at its underside, so the arrow reads as a
      // force on that block and not as a mast beside it.
      lift.holder.position.set(-(0.95 * slab.scale.x + 0.4), -0.35, 0);

      anchors.small.set(SMALL_X - 0.75, PIPE_Y + smallTop, 0);
      anchors.large.set(large.position.x + largeRadius + 0.6, PIPE_Y + largeTop, 0);
      anchors.load.set(large.position.x, PIPE_Y + largeTop + 2.5, 0);
    },
  };
}

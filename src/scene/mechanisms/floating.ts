import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {box, dial, arrow, forceLengths} from '../kit.ts';

// ---------------------------------------------------------------------------
// Floating. A rectangular hull in a tank, drawn in section so the cargo that
// sets its density can be seen. For a hull with vertical sides the share of
// the volume below the surface is the share of its depth below the surface, so
// the draft is the answer read straight off the side.
// ---------------------------------------------------------------------------

const TANK_WIDTH = 4.4;
const TANK_DEPTH = 1.9;
const WATER_TOP = 2.3;
const WATER_FLOOR = 0.28;
const HULL_LENGTH = 2.6;
const HULL_HEIGHT = 1.4;
const HULL_BEAM = 1.3;
const WALL = 0.11;
/** The empty hull's own density, and the density of what fills the hold. */
export const EMPTY_HULL = 120;
export const CARGO_DENSITY = 2600;
/** Share of the hull's volume the hold takes up. */
export const HOLD_SHARE = 0.72;
/** The deepest the hull may legally float, as a share of its depth. */
const LOAD_LINE = 0.75;

/** How full the hold has to be for the hull to average the given density. */
export const holdFill = (density: number) =>
  Math.max(0, Math.min(1, (density - EMPTY_HULL) / (CARGO_DENSITY * HOLD_SHARE)));

export function buildFloating(): Mechanism {
  const group = new THREE.Group();

  const water = new THREE.Group();
  const basin = box(water, [TANK_WIDTH + 0.5, WATER_FLOOR, TANK_DEPTH + 0.5], 'deck');
  basin.position.y = WATER_FLOOR / 2;
  // A single translucent body of water, so the hull inside it stays readable.
  const sea = new THREE.Mesh(
    new THREE.BoxGeometry(TANK_WIDTH, WATER_TOP - WATER_FLOOR, TANK_DEPTH),
    new THREE.MeshStandardMaterial({
      color: 0x3f6f86,
      transparent: true,
      opacity: 0.24,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );
  sea.position.y = (WATER_TOP + WATER_FLOOR) / 2;
  water.add(sea);
  // The surface drawn as an edge rather than a sheet, so it marks the waterline
  // on the hull without hiding what is under it.
  for (const side of [-1, 1]) {
    const edge = box(water, [TANK_WIDTH, 0.05, 0.05], 'steel');
    edge.position.set(0, WATER_TOP, (side * TANK_DEPTH) / 2);
  }
  group.add(water);

  // The hull, drawn as a section: the near side is left off so the hold shows.
  const hull = new THREE.Group();
  const keel = box(hull, [HULL_LENGTH, WALL, HULL_BEAM], 'steel');
  keel.position.y = -HULL_HEIGHT / 2 + WALL / 2;
  const farSide = box(hull, [HULL_LENGTH, HULL_HEIGHT, WALL], 'steel');
  farSide.position.z = -HULL_BEAM / 2 + WALL / 2;
  for (const end of [-1, 1]) {
    const bulkhead = box(hull, [WALL, HULL_HEIGHT, HULL_BEAM], 'steel');
    bulkhead.position.x = end * (HULL_LENGTH / 2 - WALL / 2);
  }
  const deck = box(hull, [HULL_LENGTH, WALL, HULL_BEAM * 0.32], 'dark');
  deck.position.set(0, HULL_HEIGHT / 2 - WALL / 2, -HULL_BEAM / 2 + HULL_BEAM * 0.16);
  group.add(hull);

  const ballast = new THREE.Group();
  const cargo = box(ballast, [HULL_LENGTH - 2 * WALL, 1, HULL_BEAM - 2 * WALL], 'stone');
  group.add(ballast);

  // The load line: the deepest this hull may sit, marked on its side.
  const line = new THREE.Group();
  const mark = box(line, [HULL_LENGTH * 0.5, 0.06, 0.04], 'accent');
  const arm = box(line, [0.5, 0.05, 0.04], 'accent');
  group.add(line);

  // Both forces act on the hull, so they belong with it: the water's upthrust
  // in steel, the hull's own weight in orange.
  const up = arrow(hull, 'steel');
  const down = arrow(hull);
  down.holder.rotation.z = Math.PI;

  const anchors = {
    hull: new THREE.Vector3(),
    ballast: new THREE.Vector3(),
    line: new THREE.Vector3(),
    water: new THREE.Vector3(-TANK_WIDTH / 2 + 0.5, WATER_TOP + 0.35, TANK_DEPTH / 2),
  };

  return {
    group,
    view: new THREE.Vector3(-0.42, 0.4, 1).normalize(),
    anchors,
    parts: {hull, ballast, line, water},
    update(state) {
      const {value, phase} = state;
      // What it floats in is the other half of floating. A hull unchanged in
      // every way rides higher in brine and sinks in alcohol, and with only the
      // body's density on a slider that could not be shown at all.
      const fluid = dial(state, 'fluid', 1000);
      const fraction = value / fluid;
      const floats = fraction <= 1;
      // A hull with vertical sides sits as deep, in share of its own depth, as
      // its density is a share of the water's.
      const draft = Math.min(1, fraction) * HULL_HEIGHT;
      // Once it cannot hold itself up it goes down and stays down; the cycle
      // puts it back only to run the descent again.
      const descent = Math.min(1, phase / 0.5);
      const sunk = floats
        ? WATER_TOP - draft + HULL_HEIGHT / 2
        : WATER_TOP - draft + HULL_HEIGHT / 2 - descent * (WATER_TOP - WATER_FLOOR - HULL_HEIGHT);
      hull.position.y = sunk;

      const fill = holdFill(value) * (HULL_HEIGHT - 2 * WALL);
      cargo.scale.y = Math.max(0.001, fill);
      cargo.position.set(0, sunk - HULL_HEIGHT / 2 + WALL + fill / 2, WALL / 2);
      ballast.visible = fill > 0.01;

      // The mark sits at the deepest draft allowed, measured up from the keel.
      const lineY = sunk - HULL_HEIGHT / 2 + LOAD_LINE * HULL_HEIGHT;
      mark.position.set(0, lineY, HULL_BEAM / 2 + 0.02);
      arm.position.set(HULL_LENGTH / 2 + 0.25, lineY, HULL_BEAM / 2 + 0.02);
      // Deeper than the mark allows is exactly what the mark is there to catch.
      const overloaded = fraction > LOAD_LINE;
      for (const piece of [mark, arm]) {
        (piece.material as THREE.MeshStandardMaterial).color.set(overloaded ? 0xd8542a : 0xf2905c);
      }

      // Upthrust is the weight of the water pushed aside; weight is the hull's
      // own. They match while it floats, and the weight wins once it does not.
      // Upthrust is the weight of the water actually displaced, which stops
      // growing once the hull is under; weight keeps going. No clamps: the
      // arrows carry the ratio the numbers do.
      const forces = forceLengths(Math.min(1, fraction), fraction);
      up.set(forces.effort);
      up.holder.position.set(-HULL_LENGTH / 2 - 0.45, -HULL_HEIGHT / 2 - forces.effort - 0.15, HULL_BEAM / 2);
      down.set(forces.load);
      down.holder.position.set(HULL_LENGTH / 2 + 0.45, HULL_HEIGHT / 2 + forces.load + 0.15, HULL_BEAM / 2);

      anchors.hull.set(0, sunk + HULL_HEIGHT / 2 + 0.5, 0);
      anchors.ballast.set(-HULL_LENGTH / 2 - 0.4, sunk - HULL_HEIGHT / 4, HULL_BEAM / 2);
      anchors.line.set(HULL_LENGTH / 2 + 0.8, lineY, HULL_BEAM / 2);
    },
  };
}

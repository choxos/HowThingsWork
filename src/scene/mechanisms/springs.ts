import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, TAU, swell} from '../kit.ts';

// ---------------------------------------------------------------------------
// Springs. The same 300 N load carried three ways, with the stiffness as the
// control and the deflection as the answer. Drawn at 0.008 scene units to the
// millimeter, so the scale beside the spring reads in real millimeters.
// ---------------------------------------------------------------------------

const MM = 0.008;
/** The load the bench opens with, in newtons, and the block cut for it. */
const LOAD = 300;
const SEAT_Y = 0.34;
const COIL_FREE = 1.7;
const COIL_RADIUS = 0.34;
const COIL_TURNS = 7;
const LEAF_HALF = 1.3;
const LEAF_SEGMENTS = 12;
const ARM = 1.05;
const BAR_LENGTH = 2.4;
const GAUGE_X = 1.85;
const WEIGHT = 0.62;

/** A wire wound into a helix one unit tall, so the group can be scaled to length. */
function coilGeometry() {
  const steps = COIL_TURNS * 24;
  const points = Array.from({length: steps + 1}, (_, i) => {
    const t = i / steps;
    const angle = t * COIL_TURNS * TAU;
    return new THREE.Vector3(Math.cos(angle) * COIL_RADIUS, t, Math.sin(angle) * COIL_RADIUS);
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, 0.055, 6, false);
}

/**
 * The shape a beam takes when it is propped at both ends and pressed in the
 * middle, measured from one support: three parts of the span less four parts
 * of its cube, which is exactly one at the middle.
 */
const beamShape = (u: number) => 3 * u - 4 * u ** 3;

/** Where the load block's own edge falls along the beam, as a share of the span. */
const EDGE_SHARE = 0.5 - WEIGHT / 2 / (2 * LEAF_HALF);

export function buildSprings(): Mechanism {
  const group = new THREE.Group();

  const seat = new THREE.Group();
  const bed = box(seat, [4.2, 0.22, 1.7], 'deck');
  bed.position.y = 0.11;
  const pad = box(seat, [0.9, 0.1, 0.9], 'dark');
  pad.position.y = SEAT_Y - 0.05;
  // Two piers for the leaf spring to rest on, and a clamp for the torsion bar.
  const piers = [-1, 1].map(side => {
    const pier = box(seat, [0.34, 0.5, 0.8], 'dark');
    pier.position.set(side * LEAF_HALF, SEAT_Y + 0.2, 0);
    return pier;
  });
  const clamp = box(seat, [0.5, 0.7, 0.5], 'dark');
  clamp.position.set(0, SEAT_Y + 0.45, -BAR_LENGTH / 2);
  group.add(seat);

  const spring = new THREE.Group();

  const coilHolder = new THREE.Group();
  coilHolder.position.y = SEAT_Y;
  // The wire lives in its own scaled group so the cap on top is not scaled too.
  const coilScale = new THREE.Group();
  add(coilScale, coilGeometry(), mat('steel'));
  coilHolder.add(coilScale);
  const capTop = cylinder(coilHolder, COIL_RADIUS + 0.08, 0.09, 'dark', 24);
  spring.add(coilHolder);

  const leafHolder = new THREE.Group();
  const leaves = Array.from({length: LEAF_SEGMENTS}, () =>
    add(leafHolder, new THREE.BoxGeometry(1, 0.1, 0.7), mat('steel')),
  );
  spring.add(leafHolder);

  const torsionHolder = new THREE.Group();
  torsionHolder.position.set(0, SEAT_Y + 0.8, 0);
  const bar = cylinder(torsionHolder, 0.11, BAR_LENGTH, 'steel', 20);
  bar.rotation.x = Math.PI / 2;
  // A painted line down the bar, twisted a little more at every station, which
  // is the only way to see that a torsion bar is working at all.
  const twists = Array.from({length: 9}, (_, i) => {
    const mark = box(torsionHolder, [0.05, 0.1, BAR_LENGTH / 9], 'accent');
    mark.position.set(0, 0.11, BAR_LENGTH / 2 - (i + 0.5) * (BAR_LENGTH / 9));
    return mark;
  });
  const armPivot = new THREE.Group();
  armPivot.position.z = BAR_LENGTH / 2;
  const armBar = box(armPivot, [ARM, 0.16, 0.24], 'steel');
  armBar.position.x = ARM / 2;
  torsionHolder.add(armPivot);
  spring.add(torsionHolder);

  group.add(spring);

  const load = new THREE.Group();
  box(load, [WEIGHT, WEIGHT, WEIGHT], 'stone');
  const hookPlate = box(load, [WEIGHT + 0.16, 0.08, WEIGHT + 0.16], 'dark');
  hookPlate.position.y = -WEIGHT / 2 - 0.04;
  group.add(load);

  const gauge = new THREE.Group();
  const column = box(gauge, [0.12, 2.1, 0.12], 'dark');
  column.position.set(GAUGE_X, SEAT_Y + 1.05, 0);
  // A tick every ten millimeters below the spring's free height, evenly spaced
  // because a spring answers evenly. The zero mark moves with whichever spring
  // is on the bench; the spacing never does.
  const ticks = new THREE.Group();
  for (let i = 0; i <= 10; i += 1) {
    const tick = box(ticks, [i % 5 === 0 ? 0.34 : 0.2, 0.03, 0.12], 'steel');
    tick.position.set(GAUGE_X + 0.2, -i * 10 * MM, 0);
  }
  gauge.add(ticks);
  const pointer = box(gauge, [0.44, 0.07, 0.14], 'accent');
  group.add(gauge);

  const anchors = {
    spring: new THREE.Vector3(),
    load: new THREE.Vector3(),
    gauge: new THREE.Vector3(GAUGE_X + 0.5, SEAT_Y + 1.6, 0),
    seat: new THREE.Vector3(-1.5, 0.4, 0.9),
  };

  return {
    group,
    view: new THREE.Vector3(-0.5, 0.36, 1).normalize(),
    parts: {spring, load, gauge, seat},
    anchors,
    update(state) {
      const {value, variant, phase} = state;
      // How stiff the spring is and how hard it is pressed are two different
      // questions, and the deflection is the second divided by the first.
      const newtons = dial(state, 'load', LOAD);
      // The load settles where the spring's own push matches it, and here it is
      // applied gradually so the settling can be watched.
      const settled = (newtons / value) * MM;
      const drop = swell(phase) * settled;

      coilHolder.visible = variant === 'coil';
      leafHolder.visible = variant === 'leaf';
      torsionHolder.visible = variant === 'torsion';
      pad.visible = variant === 'coil';
      for (const pier of piers) pier.visible = variant === 'leaf';
      clamp.visible = variant === 'torsion';

      let restY = 0;
      let freeY = 0;
      if (variant === 'coil') {
        const length = COIL_FREE - drop;
        coilScale.scale.y = length;
        capTop.position.y = length + 0.045;
        restY = SEAT_Y + length + 0.09;
        freeY = SEAT_Y + COIL_FREE + 0.09;
      } else if (variant === 'leaf') {
        const top = SEAT_Y + 0.5;
        for (let i = 0; i < LEAF_SEGMENTS; i += 1) {
          const at = (s: number) => {
            const x = -LEAF_HALF + s * 2 * LEAF_HALF;
            const u = Math.min(s, 1 - s);
            return new THREE.Vector2(x, top - drop * beamShape(u) / beamShape(EDGE_SHARE));
          };
          const a = at(i / LEAF_SEGMENTS);
          const b = at((i + 1) / LEAF_SEGMENTS);
          const piece = leaves[i];
          piece.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
          piece.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
          piece.scale.x = a.distanceTo(b);
        }
        // The block is rigid and the beam is curved, so contact is at the
        // block's own edges. Normalize the illustrative beam shape so stiffness
        // describes displacement at this load contact, as the readout does.
        restY = top - drop + 0.05;
        freeY = top + 0.05;
      } else {
        const angle = Math.asin(drop / ARM);
        armPivot.rotation.z = -angle;
        for (let i = 0; i < twists.length; i += 1) {
          // The twist builds along the bar, from nothing at the clamp to all of
          // it at the arm, which is what a torsion bar actually does. Mark zero
          // sits at the arm end, so the share runs the other way.
          const share = (1 - (i + 0.5) / twists.length) * -angle;
          twists[i].rotation.z = share;
          twists[i].position.set(-Math.sin(share) * 0.11, Math.cos(share) * 0.11, twists[i].position.z);
        }
        restY = SEAT_Y + 0.8 - drop + 0.08;
        freeY = SEAT_Y + 0.88;
      }

      // The weight stands for the load it applies, by volume.
      const bulk = Math.cbrt(newtons / LOAD);
      load.scale.setScalar(bulk);
      const loadX = variant === 'torsion' ? Math.sqrt(ARM ** 2 - drop ** 2) : 0;
      const loadZ = variant === 'torsion' ? BAR_LENGTH / 2 : 0;
      load.position.set(loadX, restY + (WEIGHT * bulk) / 2 + 0.08, loadZ);
      ticks.position.y = freeY;
      pointer.position.set(GAUGE_X - 0.02, restY, 0);

      anchors.spring.set(variant === 'torsion' ? -0.55 : -0.9, restY - 0.5, 0.4);
      anchors.load.set(loadX, restY + WEIGHT * bulk + 0.45, loadZ);
    },
  };
}

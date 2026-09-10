import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, arrow, forceLengths, TAU, swell} from '../kit.ts';

// ---------------------------------------------------------------------------
// The wheel and axle. A winch with both of its circles in the reader's hands:
// the handle it is turned by and the drum the rope winds onto. The advantage is
// the ratio between them and nothing else, so either slider alone would leave
// half of what decides it out of reach.
//
// Scale: 0.0026 scene units to the millimeter, so the drum the bench opens with
// is a hundred millimeters across the radius.
// ---------------------------------------------------------------------------

/** Scene units per millimeter. */
const MM = 0.0026;
/** The drum the flanges and the rope loop are built for, before scaling. */
const AXLE_RADIUS = 0.26;
const AXLE_Y = 2.2;
const CRATE = 0.56;
const LOAD_FLOOR = 0.32;

export function buildWheelAndAxle(): Mechanism {
  const group = new THREE.Group();

  const frame = new THREE.Group();
  // Two rails instead of a solid base, so the load has a gap to hang into.
  for (const side of [-1, 1]) {
    const rail = box(frame, [3, 0.24, 0.66], 'deck');
    rail.position.set(0, 0.12, side * 1);
    const post = box(frame, [0.3, AXLE_Y, 0.36], 'timber');
    post.position.set(0, AXLE_Y / 2 + 0.24, side * 1);
    const collar = cylinder(frame, 0.36, 0.22, 'steel');
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, AXLE_Y, side * 1);
  }
  group.add(frame);

  const spin = new THREE.Group();
  spin.position.set(0, AXLE_Y, 0);
  group.add(spin);

  const axle = new THREE.Group();
  const drum = cylinder(axle, AXLE_RADIUS, 3.3, 'steel', 40);
  drum.rotation.x = Math.PI / 2;
  const flanges = [-1, 1].map(side => {
    const flange = cylinder(axle, AXLE_RADIUS + 0.08, 0.07, 'dark');
    flange.rotation.x = Math.PI / 2;
    flange.position.z = side * 0.66;
    return flange;
  });

  const wheel = new THREE.Group();
  // The rim and spokes live in a scaled subgroup so the handle stays round at any size.
  const disc = new THREE.Group();
  disc.position.z = 1.62;
  wheel.add(disc);
  add(disc, new THREE.TorusGeometry(1, 0.06, 10, 60), mat('steel'));
  const spokeGeometry = new THREE.CylinderGeometry(0.045, 0.045, 1, 10).translate(0, 0.5, 0);
  for (let i = 0; i < 6; i += 1) {
    const spoke = add(disc, spokeGeometry, mat('steel'));
    spoke.rotation.z = (i / 6) * TAU;
  }
  const hub = cylinder(wheel, 0.16, 0.14, 'steel');
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 1.62;
  const grip = cylinder(wheel, 0.09, 0.44, 'timber', 16);
  grip.rotation.x = Math.PI / 2;
  wheel.add(grip);
  const gripArrow = arrow(wheel);

  spin.add(axle, wheel);

  // The rope leaves the drum on the side that is rising, so its pull turns the axle.
  const rope = new THREE.Group();
  rope.position.z = -0.35;
  const coil = add(rope, new THREE.TorusGeometry(AXLE_RADIUS + 0.035, 0.038, 8, 48), mat('rope'));
  coil.position.y = AXLE_Y;
  const line = cylinder(rope, 0.05, 1, 'rope', 10);
  const crate = box(rope, [CRATE, CRATE, CRATE], 'timber');
  const loadArrow = arrow(rope, 'steel');
  group.add(rope);

  const anchors = {
    wheel: new THREE.Vector3(),
    axle: new THREE.Vector3(0, AXLE_Y + 0.45, -1.5),
    rope: new THREE.Vector3(),
    frame: new THREE.Vector3(0, 0.5, 1.35),
  };

  return {
    group,
    view: new THREE.Vector3(-1.05, 0.58, 1).normalize(),
    parts: {wheel, axle, rope, frame},
    anchors,
    update(state) {
      const {value, phase} = state;
      const wheelRadius = value * MM;
      const axleRadius = dial(state, 'axle', AXLE_RADIUS / MM) * MM;
      // The drum is drawn at the radius the numbers use, flanges and rope loop
      // with it, so widening the drum really does show as a fatter drum.
      const drumScale = axleRadius / AXLE_RADIUS;
      drum.scale.set(drumScale, 1, drumScale);
      for (const flange of flanges) flange.scale.set(drumScale, 1, drumScale);
      coil.scale.set(drumScale, drumScale, 1);
      // Rotation is limited to the rope actually available, so the drum never
      // keeps turning while the load stands still.
      const ceiling = AXLE_Y - axleRadius - 0.5;
      const turns = swell(phase) * ((ceiling - LOAD_FLOOR) / axleRadius);
      const height = LOAD_FLOOR + turns * axleRadius;

      spin.rotation.z = turns;
      disc.scale.set(wheelRadius, wheelRadius, 1);
      // The handle sits on the rim itself, so the drawn radius is the one the numbers use.
      grip.position.set(wheelRadius, 0, 1.85);

      // One turn of the handle takes up one drum circumference of rope, so the
      // advantage is the ratio of the two circles and nothing else.
      const forces = forceLengths(axleRadius / wheelRadius, 1);
      gripArrow.set(forces.effort);
      gripArrow.holder.position.set(wheelRadius, 0, 2.12);

      // The rope hangs from the tangent point on the rising side of the drum.
      crate.position.set(axleRadius, height, 0);
      const span = Math.max(AXLE_Y - (height + CRATE / 2), 0.02);
      line.scale.y = span;
      line.position.set(axleRadius, height + CRATE / 2 + span / 2, 0);
      loadArrow.set(forces.load);
      // Clear of the drum and the posts, so its full length reads against the load it lifts.
      loadArrow.holder.position.set(axleRadius - 1, height + CRATE / 2 + 0.05, 0);

      anchors.wheel.set(0, AXLE_Y + wheelRadius + 0.3, 1.62);
      anchors.rope.set(axleRadius, height + 0.5, -0.35);
    },
  };
}

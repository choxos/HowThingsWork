import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, arrow, TAU} from '../kit.ts';

// ---------------------------------------------------------------------------
// Rotating wheels. One wheel on one shaft, held either at both ends, where it
// is a store of energy, or at one end, where gravity's pull on the overhang
// makes the axis swing level instead of tipping.
//
// The picture is not on the same clock as the readout. A wheel turning sixty
// times a second would strobe into a blur on a screen, and its axis would take
// minutes to come round once. Both are drawn at rates that can be watched, and
// both keep the relation the numbers describe: raise the spin and the axis
// swings more slowly, in proportion.
// ---------------------------------------------------------------------------

/** The wheel the rotor is cut for, before the slider resizes it. */
const WHEEL_RADIUS = 1;
/** That wheel's real radius, in millimeters, which the readouts work from. */
const WHEEL_MM = 120;
const AXIS_Y = 2;
const PIVOT_X = -1.5;
/** How far the wheel hangs from the single pivot when it is free to swing. */
const OVERHANG = 0.9;
const SHAFT_LENGTH = 3.2;
/** Drawn revolutions per second at one unit of the slider. */
const SPIN_SHOWN = 0.1;
/** Drawn precession revolutions per second, divided by the slider's value. */
const PRECESSION_SHOWN = 6;
/** Length of the inward arrow at the fastest spin on the slider. */
const ARROW_FULL = 1.4;

export function buildRotatingWheels(): Mechanism {
  const group = new THREE.Group();

  const mount = new THREE.Group();
  const bed = box(mount, [4.6, 0.26, 1.6], 'deck');
  bed.position.y = 0.13;
  const pillars = [PIVOT_X, -PIVOT_X].map(x => {
    const pillar = new THREE.Group();
    const column = box(pillar, [0.4, AXIS_Y - 0.26, 0.5], 'timber');
    column.position.set(x, (AXIS_Y - 0.26) / 2 + 0.26, 0);
    const collar = cylinder(pillar, 0.24, 0.3, 'dark', 20);
    collar.rotation.z = Math.PI / 2;
    collar.position.set(x, AXIS_Y, 0);
    mount.add(pillar);
    return pillar;
  });
  group.add(mount);

  // Everything above turns about the vertical line through the left pillar,
  // which is the only thing holding the wheel up when the right one goes.
  const swing = new THREE.Group();
  swing.position.set(PIVOT_X, AXIS_Y, 0);
  group.add(swing);
  const carrier = new THREE.Group();
  carrier.position.x = -PIVOT_X;
  swing.add(carrier);

  const spin = new THREE.Group();
  carrier.add(spin);

  const shaft = new THREE.Group();
  const bar = cylinder(shaft, 0.09, SHAFT_LENGTH, 'steel', 20);
  bar.rotation.z = Math.PI / 2;
  spin.add(shaft);

  const rotor = new THREE.Group();
  // Dark cast iron, so the steel arrow and the painted mark both read on it.
  const web = cylinder(rotor, WHEEL_RADIUS - 0.14, 0.12, 'deck', 48);
  web.rotation.z = Math.PI / 2;
  const rim = add(rotor, new THREE.TorusGeometry(WHEEL_RADIUS - 0.07, 0.14, 12, 56), mat('dark'));
  rim.rotation.y = Math.PI / 2;
  const hub = cylinder(rotor, 0.22, 0.34, 'dark', 20);
  hub.rotation.z = Math.PI / 2;
  // One painted spoke, so the direction and rate of spin can be read off.
  // A quarter turn away from the rim weight, so it never hides the arrow, and
  // on both faces, so it reads from either side.
  for (const face of [-1, 1]) {
    const stripe = box(rotor, [0.14, 0.1, WHEEL_RADIUS - 0.2], 'accent');
    stripe.position.set(face * 0.09, 0, (WHEEL_RADIUS - 0.2) / 2);
  }
  spin.add(rotor);

  const rimMass = new THREE.Group();
  const bolt = cylinder(rimMass, 0.15, 0.34, 'steel', 16);
  bolt.rotation.z = Math.PI / 2;
  bolt.position.y = WHEEL_RADIUS - 0.07;
  // The force on the bolt points inward, at the middle: nothing pulls it out.
  const pull = arrow(rimMass, 'steel');
  pull.holder.rotation.z = Math.PI;
  pull.holder.position.y = WHEEL_RADIUS - 0.24;
  pull.set(0.7);
  spin.add(rimMass);

  const anchors = {
    rotor: new THREE.Vector3(0, AXIS_Y + WHEEL_RADIUS + 0.4, 0),
    rim: new THREE.Vector3(0, AXIS_Y - WHEEL_RADIUS - 0.35, 0.6),
    shaft: new THREE.Vector3(1.15, AXIS_Y + 0.4, 0),
    mount: new THREE.Vector3(PIVOT_X, 0.75, 0.9),
  };

  return {
    group,
    view: new THREE.Vector3(-0.75, 0.4, 1).normalize(),
    parts: {rotor, rim: rimMass, shaft, mount},
    anchors,
    // The gyroscope carries the wheel and half a shaft right round the pivot.
    reach: Math.hypot(OVERHANG + SHAFT_LENGTH / 2, WHEEL_RADIUS * 2) + 0.2,
    update(state) {
      const {value, variant, elapsed} = state;
      const free = variant === 'gyroscope';
      // How big the wheel is decides everything the rate does not: the inertia
      // goes with the square of it, and the energy and the precession follow.
      // With the rate alone half of a flywheel was out of reach.
      const millimeters = dial(state, 'radius', WHEEL_MM);
      const size = millimeters / WHEEL_MM;
      rotor.scale.setScalar(size);
      bolt.position.y = (WHEEL_RADIUS - 0.07) * size;
      pull.holder.position.y = (WHEEL_RADIUS - 0.24) * size;
      // Held at one end, the wheel hangs off a single pivot; held at both, the
      // second pillar is what stops the axis going anywhere. The single pivot
      // moves to the middle so the wheel circles the center of the picture.
      pillars[1].visible = !free;
      pillars[0].position.x = free ? -PIVOT_X : 0;
      swing.position.x = free ? 0 : PIVOT_X;
      carrier.position.x = free ? OVERHANG : -PIVOT_X;
      swing.rotation.y = free ? elapsed * (PRECESSION_SHOWN / value) * TAU : 0;
      spin.rotation.x = elapsed * value * SPIN_SHOWN * TAU;

      // The inward pull grows with the square of the rate, and so does the arrow:
      // full length at the top of the slider, a ninth of it at the bottom.
      // The inward pull is the mass times the radius times the square of the
      // rate, so the arrow answers both sliders and not only one.
      pull.set(ARROW_FULL * (value / 60) ** 2 * size);

      // The wheel swings around the pivot, so its labels have to swing with it.
      const angle = swing.rotation.y;
      const arm = free ? OVERHANG : -PIVOT_X;
      const wheelX = swing.position.x + arm * Math.cos(angle);
      const wheelZ = -arm * Math.sin(angle);
      anchors.rotor.set(wheelX, AXIS_Y + WHEEL_RADIUS * size + 0.4, wheelZ);
      anchors.rim.set(wheelX, AXIS_Y - WHEEL_RADIUS * size - 0.35, wheelZ + 0.6);
      anchors.shaft.set(wheelX + (free ? -0.8 : 1.2), AXIS_Y + 0.42, wheelZ);
    },
  };
}

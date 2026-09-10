import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, arrow, forceLengths, TAU} from '../kit.ts';
import {motorTorque, forceOnWire} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Electric motors. A coil on a shaft between two poles, with an arrow on each
// long side showing the force that acts there.
//
// Scale. The coil is 40 mm across the shaft by 60 mm along it, drawn 1.6 by 2.4
// scene units, so one unit is 25 mm. Fifty turns are wound and four are drawn;
// the file says so and every number uses the fifty.
//
// The geometry has to be this way round. The field runs across the gap, the two
// long sides of the coil run along the shaft, and the force on a wire is at
// right angles to both, so the sides are pushed in opposite directions across
// the gap and the coil turns. A loop whose long sides ran across the shaft
// instead would be pushed along it and would never turn at all, however
// convincing the picture looked.
//
// The two arrows share one scale through forceLengths, so their lengths are in
// true proportion to each other and to the force in the readout. They are the
// forces on the wires, not the torque: the torque is those forces times their
// levers, which is why both arrows stay the same length as the coil turns while
// the twist falls away to nothing at the dead point.
//
// The turning rate is chosen for looking at, not predicted. Working out how
// fast this motor would actually run needs the load on the shaft, the inertia
// of the armature and the friction in the bearings, none of which this bench
// claims to know.
// ---------------------------------------------------------------------------

/** Scene units per millimeter. */
const MM = 0.04;
const COIL_W = 40 * MM;
const COIL_H = 60 * MM;
const TURNS = 50;
const DRAWN_TURNS = 4;
/** The magnet the bench opens with, in tesla, before its slider changes it. */
const FIELD = 0.25;
const AREA_M2 = 0.04 * 0.06;
const SIDE_M = 0.06;
const AXIS_Y = 2.2;
const GAP = 1.5;
/** The largest force the slider can make, which fixes the arrow scale. */
const FULL_FORCE = forceOnWire(0.6, 8, SIDE_M * TURNS);
/** The largest twist it can make, which fixes the scale of the bar below the shaft. */
const FULL_TWIST = motorTorque(TURNS, 0.6, 8, AREA_M2, 0);

export function buildElectricMotors(): Mechanism {
  const group = new THREE.Group();

  const bed = box(group, [GAP * 2 + 2.4, 0.24, 2.6], 'deck');
  bed.position.y = 0.12;

  const magnet = new THREE.Group();
  for (const side of [-1, 1]) {
    // A pole shoe curved to the arc the coil sweeps, which is what keeps the
    // field across the gap roughly even.
    // The shoe is curved about the shaft, which is the axis the coil sweeps
    // around, so the gap it leaves is the same width everywhere the coil goes.
    const shoe = add(
      magnet,
      new THREE.CylinderGeometry(GAP, GAP, COIL_H + 0.6, 24, 1, true, side < 0 ? Math.PI / 3 : -Math.PI * 2 / 3, Math.PI / 3),
      mat('stone'),
    );
    (shoe.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    shoe.rotation.x = Math.PI / 2;
    shoe.position.set(0, AXIS_Y, 0);
    // The back joins the shoe rather than floating clear of it.
    const backX = side * (GAP + 0.17);
    const back = box(magnet, [0.34, 2.4, COIL_H + 0.6], 'dark');
    back.position.set(backX, AXIS_Y, 0);
    const label = box(magnet, [0.2, 0.2, 0.2], side < 0 ? 'accent' : 'steel');
    label.position.set(backX, AXIS_Y + 1.4, 0);
  }
  group.add(magnet);

  // The two long sides run along the shaft, because only a wire lying across
  // the field and along the axis is pushed in a direction that turns anything.
  // A loop lying in the plane of the picture, with its long sides across the
  // shaft, would be pushed along the shaft instead and would never turn.
  const coil = new THREE.Group();
  const winding = new THREE.Group();
  // Four turns drawn for fifty wound, laid side by side across the slot the way
  // a real winding is, rather than nested inside one another. Each drawn turn is
  // the full 40 by 60 mm the model uses; they differ only in where they sit.
  for (let i = 0; i < DRAWN_TURNS; i += 1) {
    const offset = (i - (DRAWN_TURNS - 1) / 2) * 0.13;
    for (const side of [-1, 1]) {
      const long = box(winding, [0.07, 0.07, COIL_H], 'accent');
      long.position.set((side * COIL_W) / 2, offset, 0);
    }
    for (const end of [-1, 1]) {
      const short = box(winding, [COIL_W, 0.07, 0.07], 'accent');
      short.position.set(0, offset, (end * COIL_H) / 2);
    }
  }
  coil.add(winding);
  coil.position.set(0, AXIS_Y, 0);
  group.add(coil);

  const commutator = new THREE.Group();
  // The shaft comes out at both ends of the coil rather than running through
  // the middle of it, so nothing crosses the windings.
  for (const end of [-1, 1]) {
    const stub = cylinder(commutator, 0.09, 1.6, 'steel', 12);
    stub.rotation.x = Math.PI / 2;
    stub.position.set(0, AXIS_Y, end * (COIL_H / 2 + 0.8));
  }
  // The split ring, in two halves with a gap where the brushes hand over.
  const halves = [0, 1].map(i => {
    const half = add(
      commutator,
      new THREE.CylinderGeometry(0.3, 0.3, 0.34, 20, 1, false, i * Math.PI + 0.09, Math.PI - 0.18),
      mat('steel'),
    );
    half.rotation.x = Math.PI / 2;
    half.position.set(0, AXIS_Y, -(COIL_H / 2 + 1.1));
    return half;
  });
  // The brushes press on the ring: their inner faces sit on its radius, because
  // a brush that does not touch is not carrying any current.
  const splitBrushes = [-1, 1].map(side => {
    const brush = box(commutator, [0.14, 0.34, 0.2], 'dark');
    brush.position.set(side * 0.37, AXIS_Y, -(COIL_H / 2 + 1.1));
    return brush;
  });
  // And the other thing that can go on a shaft: two whole rings, one for each
  // end of the winding, set apart along it. No gap anywhere on either, so the
  // current through the coil never reverses. That is the whole difference
  // between the two settings, and leaving the split ring on the shaft while
  // teaching that the current is not reversed shows the reader the opposite of
  // what the words say.
  const plainRings = [0, 1].map(i => {
    const ring = cylinder(commutator, 0.3, 0.3, 'steel', 20);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, AXIS_Y, -(COIL_H / 2 + 0.8 + i * 0.5));
    return ring;
  });
  const plainBrushes = [0, 1].map(i => {
    const brush = box(commutator, [0.14, 0.34, 0.2], 'dark');
    brush.position.set((i === 0 ? 1 : -1) * 0.37, AXIS_Y, -(COIL_H / 2 + 0.8 + i * 0.5));
    return brush;
  });
  group.add(commutator);

  const forces = new THREE.Group();
  const near = arrow(forces, 'accent');
  const far = arrow(forces, 'steel');
  // A bar under the shaft whose length is the twist itself, on a fixed scale,
  // so the collapse at the dead point can be seen and not only inferred.
  const twistBar = box(forces, [1, 0.12, 0.12], 'steel');
  const twistFoot = box(forces, [0.1, 0.3, 0.1], 'dark');
  twistFoot.position.set(0, AXIS_Y - COIL_W / 2 - 0.9, 0);
  group.add(forces);

  const anchors = {
    coil: new THREE.Vector3(0, AXIS_Y + COIL_W / 2 + 0.6, 0),
    magnet: new THREE.Vector3(-(GAP + 0.35), AXIS_Y + 1.7, 0),
    commutator: new THREE.Vector3(0, AXIS_Y - 0.6, -(COIL_H / 2 + 1.1)),
    forces: new THREE.Vector3(0, AXIS_Y + 1.6, 0.6),
  };

  return {
    group,
    view: new THREE.Vector3(0.35, 0.26, 1).normalize(),
    parts: {coil, magnet, commutator, forces},
    anchors,
    reach: 4.4,
    update(state) {
      const {value, variant, phase} = state;
      const commutated = variant === 'commutator';
      // The push on a wire is the field times the current times the length in
      // it, so the magnet is as much of the machine as the current. A weak
      // magnet and a big current give the same push as the other way round, and
      // one of the two costs a great deal more in heat.
      const fieldT = dial(state, 'field', FIELD * 100) / 100;
      // The shaft carries whichever of the two the reader asked for, never both
      // and never the wrong one.
      for (const piece of [...halves, ...splitBrushes]) piece.visible = commutated;
      for (const piece of [...plainRings, ...plainBrushes]) piece.visible = !commutated;
      // With the commutator the coil turns on; without it, it swings toward the
      // dead point and settles there, because past that point the same current
      // pushes it back. The swing is drawn as a decaying oscillation about that
      // point, restarting each loop of the animation.
      const angle = commutated
        ? phase * TAU
        : Math.PI / 2 - (Math.PI / 2) * Math.exp(-3.2 * phase) * Math.cos(phase * TAU * 2.2);
      coil.rotation.z = angle;

      // The commutator halves turn with the shaft, so the handover really does
      // happen where the brushes are when the coil is at the dead point.
      for (let i = 0; i < halves.length; i += 1) halves[i].rotation.y = -angle;

      const force = forceOnWire(fieldT, value, SIDE_M * TURNS);
      const share = force / FULL_FORCE;
      const {effort} = forceLengths(share, share);
      // Both sides carry the same current in opposite directions, so the two
      // forces are equal and opposite whatever the angle: a pure couple.
      near.set(effort);
      far.set(effort);

      // The arrows sit on the wires, which have turned with the coil. The field
      // and the current both keep their directions, so the forces stay vertical
      // however far round the coil has gone: only the levers change.
      const armX = (COIL_W / 2) * Math.cos(angle);
      const armY = (COIL_W / 2) * Math.sin(angle);
      // Past half a turn the commutator has swapped the current, so the wire now
      // on the far side is pushed the other way and the couple keeps its sense.
      const swapped = commutated && armX < 0;
      near.holder.position.set(armX, AXIS_Y + armY, 0);
      near.holder.rotation.z = swapped ? Math.PI : 0;
      far.holder.position.set(-armX, AXIS_Y - armY, 0);
      far.holder.rotation.z = swapped ? 0 : Math.PI;

      // The twist is those forces times their levers, which is what falls to
      // nothing at the dead point even though the forces themselves do not.
      const twist = motorTorque(TURNS, fieldT, value, AREA_M2, (angle * 180) / Math.PI);
      // With the commutator the current swaps at the dead point, so the twist
      // never changes sign; without it, it does, and that is why the coil stops.
      const signed = commutated ? Math.abs(twist) : twist;
      const drawnTwist = (signed / FULL_TWIST) * 2;
      twistBar.scale.x = Math.max(0.001, Math.abs(drawnTwist));
      twistBar.visible = Math.abs(drawnTwist) > 0.01;
      twistBar.position.set(drawnTwist / 2, AXIS_Y - COIL_W / 2 - 0.9, 0);

      anchors.forces.set(armX, AXIS_Y + armY + effort + 0.4, 0);
      anchors.coil.set(0, AXIS_Y + COIL_W / 2 + 0.6, 0);
    },
  };
}

import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, TAU} from '../kit.ts';

// ---------------------------------------------------------------------------
// Friction. A plank tilted until the block on it lets go, which is the
// measurement itself: the tangent of that angle is the coefficient. Behind it,
// the same resistance put to work in a brake and designed out in a bearing.
// ---------------------------------------------------------------------------

const HINGE_X = -1.9;
const HINGE_Y = 0.62;
const PLANK = 4.2;
/**
 * A block topples rather than slides once the tangent of the tilt exceeds its
 * width divided by its height, so this one is low and broad enough to slide at
 * every coefficient on the slider, including the highest.
 */
/** The block the bench opens with, and the weight in newtons it stands for. */
const BLOCK = 0.76;
const BLOCK_NEWTONS = 981;
const BLOCK_HEIGHT = 0.42;
/** Deep enough to cover most of the plank, so the two read as touching. */
const BLOCK_DEPTH = 0.86;
const BLOCK_START = 3.1;
/** The block runs down until it meets the stop at the foot of the plank. */
const BLOCK_END = 0.14 + BLOCK / 2;
const BACK_Z = -2.5;
/** Where the brake and the bearing turn, high enough to clear the bed. */
const BACK_Y = 1.65;
const DISC_RADIUS = 0.72;
const BEARING_RADIUS = 0.6;
/** Races and balls sized so each ball touches both and neither cuts the other. */
const RACE_TUBE = 0.1;
const INNER_RACE = 0.32;
const BALL = (BEARING_RADIUS - RACE_TUBE - INNER_RACE) / 2;
const BALL_CIRCLE = INNER_RACE + BALL;
/** Phase at which the plank has reached the slip angle and the block goes. */
const SLIP_AT = 0.55;
const LANDED_AT = 0.82;

export function buildFriction(): Mechanism {
  const group = new THREE.Group();

  const surface = new THREE.Group();
  // The bed reaches back under the brake and the bearing, so nothing floats.
  const bed = box(surface, [5.6, 0.3, 4.6], 'deck');
  bed.position.set(0.2, 0.15, -1.2);
  const knuckle = cylinder(surface, 0.16, 1.1, 'dark', 16);
  knuckle.rotation.x = Math.PI / 2;
  knuckle.position.set(HINGE_X, HINGE_Y, 0);
  // A level bar left at the hinge, so the tilt can be read against something.
  const datum = box(surface, [PLANK, 0.05, 0.16], 'dark');
  datum.position.set(HINGE_X + PLANK / 2, HINGE_Y - 0.02, 0.62);

  const plank = new THREE.Group();
  plank.position.set(HINGE_X, HINGE_Y, 0);
  const deck = box(plank, [PLANK, 0.16, 1.05], 'timber');
  deck.position.x = PLANK / 2;
  const lip = box(plank, [0.14, 0.3, 1.05], 'timber');
  lip.position.set(0.07, 0.15, 0);
  surface.add(plank);
  group.add(surface);

  // The block is a part in its own right, so it rides the plank by arithmetic
  // rather than by parentage: isolating the surface must not take it away.
  const blockGroup = new THREE.Group();
  const slab = box(blockGroup, [BLOCK, BLOCK_HEIGHT, BLOCK_DEPTH], 'stone');
  slab.position.y = BLOCK_HEIGHT / 2;
  group.add(blockGroup);

  // Friction earning its keep: a disc and two pads that clamp it.
  const brake = new THREE.Group();
  brake.position.set(1.15, BACK_Y, BACK_Z);
  const spinner = new THREE.Group();
  const disc = cylinder(spinner, DISC_RADIUS, 0.1, 'steel', 40);
  disc.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i += 1) {
    const vent = cylinder(spinner, 0.09, 0.16, 'dark', 12);
    vent.rotation.x = Math.PI / 2;
    vent.position.set(Math.cos((i / 5) * TAU) * 0.44, Math.sin((i / 5) * TAU) * 0.44, 0);
  }
  brake.add(spinner);
  // The caliper is narrow enough that the pads show on either side of it.
  const caliper = box(brake, [0.5, 0.34, 0.24], 'dark');
  caliper.position.y = DISC_RADIUS - 0.18;
  const pads = [-1, 1].map(side => {
    const pad = box(brake, [0.36, 0.26, 0.12], 'accent');
    pad.position.set(0, DISC_RADIUS - 0.18, side * 0.2);
    return pad;
  });
  const stub = cylinder(brake, 0.14, BACK_Y - 0.3 - DISC_RADIUS + 0.1, 'dark', 14);
  stub.position.y = -DISC_RADIUS - (BACK_Y - 0.3 - DISC_RADIUS + 0.1) / 2 + 0.05;
  group.add(brake);

  // Friction designed out: rolling contact instead of sliding contact.
  const bearing = new THREE.Group();
  bearing.position.set(-1.85, BACK_Y, BACK_Z);
  add(bearing, new THREE.TorusGeometry(BEARING_RADIUS, RACE_TUBE, 12, 44), mat('dark'));
  const innerSpin = new THREE.Group();
  const inner = cylinder(innerSpin, INNER_RACE, 0.3, 'steel', 32);
  inner.rotation.x = Math.PI / 2;
  const key = box(innerSpin, [0.08, INNER_RACE - 0.02, 0.32], 'accent');
  key.position.y = (INNER_RACE - 0.02) / 2;
  bearing.add(innerSpin);
  const cage = new THREE.Group();
  for (let i = 0; i < 9; i += 1) {
    const ball = add(cage, new THREE.SphereGeometry(BALL, 16, 12), mat('steel'));
    ball.position.set(Math.cos((i / 9) * TAU) * BALL_CIRCLE, Math.sin((i / 9) * TAU) * BALL_CIRCLE, 0);
  }
  bearing.add(cage);
  const post = cylinder(bearing, 0.14, BACK_Y - 0.3 - BEARING_RADIUS + 0.1, 'dark', 14);
  post.position.y = -BEARING_RADIUS - (BACK_Y - 0.3 - BEARING_RADIUS + 0.1) / 2 + 0.05;
  group.add(bearing);

  const anchors = {
    block: new THREE.Vector3(),
    surface: new THREE.Vector3(HINGE_X - 0.3, HINGE_Y + 0.5, 0.7),
    brake: new THREE.Vector3(1.15, BACK_Y + DISC_RADIUS + 0.4, BACK_Z),
    bearing: new THREE.Vector3(-1.85, BACK_Y + BEARING_RADIUS + 0.4, BACK_Z),
  };

  let spun = 0;
  let seen = 0;

  return {
    group,
    view: new THREE.Vector3(-0.35, 0.34, 1).normalize(),
    parts: {block: blockGroup, surface, brake, bearing},
    anchors,
    update(state) {
      const {value, phase, elapsed} = state;
      // How heavy the block is, which changes every force on this bench and
      // pointedly does not change the angle it slips at: grip and weight both
      // scale with the weight, so they cancel. That is worth being able to try
      // rather than being told. The block stands for its weight by volume.
      const newtons = dial(state, 'weight', BLOCK_NEWTONS);
      slab.scale.setScalar(Math.cbrt(newtons / BLOCK_NEWTONS));
      slab.position.y = (BLOCK_HEIGHT * Math.cbrt(newtons / BLOCK_NEWTONS)) / 2;
      const slip = Math.atan(value);
      // Up to the slip angle, then the block goes, then everything resets.
      const rising = Math.min(1, phase / SLIP_AT);
      const tilt = slip * rising;
      plank.rotation.z = tilt;

      let along = BLOCK_START;
      if (phase > SLIP_AT && phase <= LANDED_AT) {
        const fall = (phase - SLIP_AT) / (LANDED_AT - SLIP_AT);
        // Once it lets go it accelerates, because the resistance while sliding
        // is 80% of the static coefficient in this example (not a universal
        // material law). The readouts use that same choice, which is why
        // something stuck goes with a jerk. Travel goes with the square.
        // The demonstration normalizes each slide to the same screen duration.
        along = BLOCK_START - (BLOCK_START - BLOCK_END) * fall * fall;
      } else if (phase > LANDED_AT) {
        along = BLOCK_END;
      }

      // The disc turns steadily and is slowed while the pads are on it.
      const step = Math.max(0, Math.min(0.1, elapsed - seen));
      seen = elapsed;
      const clamped = phase > 0.35 && phase < 0.75;
      spun += step * (clamped ? 0.35 : 1.9) * TAU;
      spinner.rotation.z = -spun;
      // Balls in a bearing roll, so the set of them comes round at about half
      // the rate of the shaft they carry.
      innerSpin.rotation.z = -spun * 1.6;
      cage.rotation.z = -spun * 0.8;
      for (const pad of pads) {
        pad.position.z = Math.sign(pad.position.z) * (clamped ? 0.09 : 0.2);
      }

      // Where the plank's own surface is, at the point the block sits on.
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      const seatY = 0.08;
      blockGroup.position.set(
        HINGE_X + along * cos - seatY * sin,
        HINGE_Y + along * sin + seatY * cos,
        0,
      );
      blockGroup.rotation.z = tilt;

      anchors.block.set(
        HINGE_X + along * cos - (BLOCK_HEIGHT + 0.6) * sin,
        HINGE_Y + along * sin + (BLOCK_HEIGHT + 0.6) * cos,
        0,
      );
    },
  };
}

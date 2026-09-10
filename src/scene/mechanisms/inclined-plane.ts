import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, dial, unitWedge, arrow, forceLengths, swell, shuttle} from '../kit.ts';

// ---------------------------------------------------------------------------
// The inclined plane. A ramp built from the two numbers a ramp actually has,
// how high it climbs and how far out it reaches, beside the vertical climb it
// replaces, with a wedge bench behind it.
//
// Scale: one scene unit is one meter, and the two sliders are in meters. The
// slope length is neither of them but the hypotenuse, so every pair of settings
// is a ramp that could be built. Given the slope length as a slider instead,
// most of it would be shorter than the rise and could not exist.
// ---------------------------------------------------------------------------

/** The height the drawn post and its notches are built for, before scaling. */
const RAMP_HEIGHT = 2;
/** How far out the ramp reaches when nothing has moved the second slider. */
const RUN = 3.5;
const RAMP_WIDTH = 1.7;
const BOULDER = 0.34;
const WEDGE_LENGTH = 1.5;
const WEDGE_THICKNESS = 0.44;
const SLAB_LENGTH = 2.3;
const GAUGE_Z = 0.62;
const HOIST_Z = GAUGE_Z + 0.44;
/** How far the facing plate stands off the bare ramp surface. */
const FACING_LIFT = 0.075;

export function buildInclinedPlane(): Mechanism {
  const group = new THREE.Group();

  const slope = new THREE.Group();
  const ramp = add(slope, unitWedge(), mat('earth'));
  const facing = box(slope, [1, 0.07, RAMP_WIDTH * 0.94], 'stone');

  const lift = new THREE.Group();
  const post = box(lift, [0.1, RAMP_HEIGHT, 0.1], 'steel');
  post.position.set(0, RAMP_HEIGHT / 2, GAUGE_Z);
  const [, topNotch] = [0, RAMP_HEIGHT].map(level => {
    const notch = box(lift, [0.5, 0.045, 0.46], 'steel');
    notch.position.set(0, level, GAUGE_Z - 0.28);
    return notch;
  });
  const liftArrow = arrow(lift, 'steel');

  const load = new THREE.Group();
  const boulder = add(load, new THREE.IcosahedronGeometry(BOULDER, 1), mat('stone'));
  const hoisted = add(load, new THREE.IcosahedronGeometry(BOULDER, 1), mat('stone'));
  const slopeArrow = arrow(load);

  // A doorstop bench: the wedge slides in tip first and pries up the free end of a slab.
  const wedge = new THREE.Group();
  // The bench sits in front of the ramp, where nothing hides it.
  wedge.position.set(0.2, 0, 2.7);
  wedge.scale.setScalar(0.72);
  const blade = add(wedge, unitWedge(), mat('steel'));
  blade.scale.set(WEDGE_LENGTH, WEDGE_THICKNESS, 0.9);
  const threshold = box(wedge, [0.34, 0.5, 1.2], 'stone');
  threshold.position.set(SLAB_LENGTH / 2 + 0.3, 0.25, 0);
  const slabHolder = new THREE.Group();
  // The slab lies flat on the ground and pivots at the end held by the threshold.
  slabHolder.position.set(SLAB_LENGTH / 2, 0.09, 0);
  wedge.add(slabHolder);
  const slab = box(slabHolder, [SLAB_LENGTH, 0.18, 1.1], 'timber');
  slab.position.x = -SLAB_LENGTH / 2;
  const wedgeArrow = arrow(wedge);
  wedgeArrow.set(0.8);
  wedgeArrow.holder.rotation.z = -Math.PI / 2;

  group.add(slope, lift, load, wedge);

  const anchors = {
    slope: new THREE.Vector3(),
    lift: new THREE.Vector3(),
    load: new THREE.Vector3(),
    wedge: new THREE.Vector3(0.2, 0.95, 2.7),
  };

  return {
    group,
    view: new THREE.Vector3(-0.4, 0.5, 1).normalize(),
    parts: {slope, lift, load, wedge},
    anchors,
    update(state) {
      const {value, phase} = state;
      // The two numbers a ramp has. The slope length follows from them, and is
      // never shorter than the rise, so there is no setting that is not a ramp.
      const rise = value;
      const base = dial(state, 'run', RUN);
      const slopeLength = Math.hypot(rise, base);
      const left = -base / 2;
      const alongX = -base / slopeLength;
      const alongY = rise / slopeLength;
      const normalX = rise / slopeLength;
      const normalY = base / slopeLength;

      ramp.scale.set(base, rise, RAMP_WIDTH);
      ramp.position.set(left, 0, 0);
      facing.scale.x = slopeLength;
      facing.rotation.z = Math.atan2(rise, -base);
      facing.position.set(left + base / 2 + normalX * 0.04, rise / 2 + normalY * 0.04, 0);

      // The bare climb the ramp replaces, drawn at the height actually climbed.
      lift.position.set(left - 0.5, 0, 0);
      post.scale.y = rise / RAMP_HEIGHT;
      post.position.y = rise / 2;
      topNotch.position.y = rise;

      // Both loads move at the same speed, so the ramp trip simply takes longer.
      // Time is the price the ramp charges for the smaller force.
      const along = shuttle(phase) * slopeLength;
      const climbed = Math.min(along, rise);
      const standoff = BOULDER + FACING_LIFT;
      boulder.position.set(
        left + base + alongX * along + normalX * standoff,
        alongY * along + normalY * standoff,
        0,
      );
      boulder.rotation.z = along / BOULDER;
      hoisted.position.set(left - 0.5, climbed + BOULDER, HOIST_Z);

      // The effort is the load's weight times the rise over the slope length.
      const forces = forceLengths(rise / slopeLength, 1);
      slopeArrow.set(forces.effort);
      // Drawn from the load up the slope, and set aside across the ramp so it is
      // neither buried in the boulder nor pushed under the deck on a shallow ramp.
      slopeArrow.holder.position.set(boulder.position.x, boulder.position.y, BOULDER + 0.12);
      slopeArrow.holder.rotation.z = Math.atan2(base, rise);
      liftArrow.set(forces.load);
      liftArrow.holder.position.set(0, climbed + BOULDER * 2, HOIST_Z);

      // The wedge starts with its tip clear of the slab, then thickens under the free end.
      const freeEnd = -SLAB_LENGTH / 2;
      const entry = swell(phase) * (WEDGE_LENGTH + 0.05);
      const wedgeX = freeEnd - WEDGE_LENGTH - 0.05 + entry;
      blade.position.set(wedgeX, 0, 0);
      // How thick the wedge is where it meets the free end of the slab.
      const thickness = (at: number) =>
        WEDGE_THICKNESS * THREE.MathUtils.clamp(1 - (at - wedgeX) / WEDGE_LENGTH, 0, 1);
      let tilt = Math.asin(Math.min(thickness(freeEnd) / SLAB_LENGTH, 1));
      // One correction is enough: the corner slides in by the cosine of that tilt.
      tilt = Math.asin(
        Math.min(thickness(SLAB_LENGTH / 2 - SLAB_LENGTH * Math.cos(tilt)) / SLAB_LENGTH, 1),
      );
      slabHolder.rotation.z = -tilt;
      wedgeArrow.holder.position.set(wedgeX - 0.34, WEDGE_THICKNESS / 2, 0);

      anchors.slope.set(left + base * 0.45, rise * 0.34, RAMP_WIDTH / 2);
      anchors.lift.set(left - 0.5, rise + 0.45, HOIST_Z);
      anchors.load.set(boulder.position.x, boulder.position.y + 0.5, 0);
    },
  };
}

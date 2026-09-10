import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, unitWedge, TAU, swell} from '../kit.ts';

// ---------------------------------------------------------------------------
// Screws. A threaded shaft turned by a wrench, driving a nut that is held
// against turning, with the same thread unrolled into the ramp it really is.
//
// The bench is drawn to one scale throughout: 0.008 scene units to the
// millimeter. The shaft is 40 mm across, the wrench reaches 120 mm from the
// axis, and the thread is whatever pitch the slider asks for, so the picture
// and the readout always describe the same screw.
// ---------------------------------------------------------------------------

/** Scene units per millimeter. */
const MM = 0.008;
const THREAD_RADIUS = 20 * MM;
/** The wrench the bar and grip are cut for, before the slider stretches them. */
const WRENCH_RADIUS = 120 * MM;
const SHAFT_TOP = 2.4;
const SHAFT_FOOT = 0.6;
const SHAFT_LENGTH = SHAFT_TOP - SHAFT_FOOT;
const CIRCUMFERENCE = TAU * THREAD_RADIUS;
/** Turns of the wrench in one cycle of the animation. */
const TURNS_PER_CYCLE = 4;
/** How many turns of thread the unrolled ramp lays out end to end. */
const UNROLLED_TURNS = 2;
const RAMP_Z = -2.1;
/** Where the nut meets the boss and can go no further. */
const NUT_FLOOR = 0.72;

/** A hexagonal prism, for a bolt head or a nut. */
const hex = (parent: THREE.Object3D, radius: number, height: number, tone: 'steel' | 'dark') =>
  add(parent, new THREE.CylinderGeometry(radius, radius, height, 6), mat(tone));

/**
 * How thick to draw the ridge. A fine thread has to be drawn with a fine one,
 * or each turn buries the next.
 */
const ridgeFor = (lead: number) => Math.min(0.035, lead * 0.4);

/** A ridge winding up a shaft: the thread itself, at whatever lead is asked for. */
function threadGeometry(lead: number, turns: number, baseY: number, pitch = lead) {
  const steps = Math.max(24, Math.round(turns * 16));
  const points = Array.from({length: steps + 1}, (_, i) => {
    const t = i / steps;
    const angle = t * turns * TAU;
    return new THREE.Vector3(
      Math.cos(angle) * THREAD_RADIUS,
      baseY + t * turns * lead,
      Math.sin(angle) * THREAD_RADIUS,
    );
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, ridgeFor(pitch), 5, false);
}

const shaftThread = (lead: number, pitch = lead) => threadGeometry(lead, SHAFT_LENGTH / lead, SHAFT_FOOT, pitch);

export function buildScrews(): Mechanism {
  const group = new THREE.Group();

  const bolt = new THREE.Group();
  // The core is drawn one unit wide and scaled to meet whatever ridge the
  // current pitch needs, so the thread never floats off the shaft.
  const core = cylinder(bolt, 1, SHAFT_LENGTH, 'steel', 24);
  core.position.y = SHAFT_FOOT + SHAFT_LENGTH / 2;
  const ridge = add(bolt, shaftThread(8 * MM), mat('steel'));
  const secondRidge = add(bolt, ridge.geometry, ridge.material);
  secondRidge.rotation.y = Math.PI;
  secondRidge.visible = false;
  const head = hex(bolt, 0.3, 0.26, 'dark');
  head.position.y = SHAFT_TOP + 0.13;
  group.add(bolt);

  const lever = new THREE.Group();
  const bar = box(lever, [1, 0.11, 0.16], 'steel');
  const jaw = box(lever, [0.34, 0.16, 0.34], 'steel');
  jaw.position.y = SHAFT_TOP + 0.13;
  const grip = cylinder(lever, 0.09, 0.34, 'accent', 14);
  grip.rotation.x = Math.PI / 2;

  group.add(lever);

  const nut = new THREE.Group();
  hex(nut, 0.29, 0.24, 'dark');
  cylinder(nut, 0.2, 0.28, 'steel', 20);
  // Ears riding the guide rails: this is what stops the nut turning with the thread.
  for (const side of [-1, 1]) {
    const ear = box(nut, [0.26, 0.16, 0.14], 'steel');
    ear.position.x = side * 0.44;
  }
  group.add(nut);

  // Everything the nut is held by, and the plate it clamps down onto.
  const seat = new THREE.Group();
  const plate = box(seat, [1.5, 0.24, 1.1], 'deck');
  plate.position.y = 0.12;
  const boss = cylinder(seat, 0.34, 0.32, 'dark', 20);
  boss.position.y = 0.44;
  for (const side of [-1, 1]) {
    const rail = box(seat, [0.1, SHAFT_LENGTH, 0.1], 'dark');
    rail.position.set(side * 0.56, SHAFT_FOOT + SHAFT_LENGTH / 2, 0);
  }
  group.add(seat);

  // One thread unrolled: two turns of circumference along the base,
  // two leads up the side, so the sloping edge is the thread itself.
  const unwrapped = new THREE.Group();
  // Far enough left that the wound post is not hidden behind the bolt.
  unwrapped.position.set(-(UNROLLED_TURNS * CIRCUMFERENCE + 1.6), 0.42, RAMP_Z);
  const bench = box(unwrapped, [UNROLLED_TURNS * CIRCUMFERENCE + 1.5, 0.2, 0.9], 'deck');
  bench.position.set((UNROLLED_TURNS * CIRCUMFERENCE + 0.6) / 2, -0.1, 0);
  const ramp = add(unwrapped, unitWedge(), mat('stone'));
  // The sloping edge marked out, because on a real thread it is a very long,
  // very shallow ramp and would otherwise be too flat to see.
  const edge = box(unwrapped, [1, 0.05, 0.56], 'accent');
  const POST_X = UNROLLED_TURNS * CIRCUMFERENCE + 0.6;
  const post = cylinder(unwrapped, 1, 0.95, 'steel', 24);
  post.position.set(POST_X, 0.48, 0);
  // The same two turns, wound back onto a shaft of the size they came off.
  const wound = add(unwrapped, threadGeometry(8 * MM, UNROLLED_TURNS, 0), mat('accent'));
  wound.position.x = POST_X;
  group.add(unwrapped);

  const anchors = {
    thread: new THREE.Vector3(),
    nut: new THREE.Vector3(),
    lever: new THREE.Vector3(),
    unwrapped: new THREE.Vector3(-0.2, 0.9, RAMP_Z),
  };

  let drawnLead = 8 * MM;
  let drawnPitch = 8 * MM;

  return {
    group,
    view: new THREE.Vector3(-0.55, 0.42, 1).normalize(),
    parts: {thread: bolt, nut, lever, unwrapped},
    anchors,
    update(state) {
      const {value, variant, phase} = state;
      const pitch = value * MM;
      // The wrench is a lever, and how far out you hold it is half of what
      // decides the force. With only the thread on a slider the other half of
      // the machine could not be reached.
      const reach = dial(state, 'reach', WRENCH_RADIUS / MM) * MM;
      bar.scale.x = reach;
      bar.position.set(reach / 2, SHAFT_TOP + 0.13, 0);
      grip.position.set(reach, SHAFT_TOP + 0.13, 0);
      anchors.lever.set(reach + 0.35, SHAFT_TOP + 0.55, 0);
      const lead = pitch * (variant === 'double' ? 2 : 1);
      secondRidge.visible = variant === 'double';
      const shank = THREAD_RADIUS - ridgeFor(pitch) * 0.9;
      core.scale.set(shank, 1, shank);
      post.scale.set(shank, 1, shank);
      if (lead !== drawnLead || pitch !== drawnPitch) {
        ridge.geometry.dispose();
        ridge.geometry = shaftThread(lead, pitch);
        secondRidge.geometry = ridge.geometry;
        wound.geometry.dispose();
        wound.geometry = threadGeometry(lead, UNROLLED_TURNS, 0, pitch);
        drawnLead = lead;
        drawnPitch = pitch;
      }
      // The wound turns are centered on the post, whatever height they climb.
      wound.position.y = 0.45 - (UNROLLED_TURNS * lead) / 2;

      // Limit the whole stroke at the boss so rotation and travel stay coupled.
      const rest = SHAFT_TOP - 0.4;
      const turns = swell(phase) * Math.min(TURNS_PER_CYCLE, (rest - NUT_FLOOR) / lead);
      const height = rest - turns * lead;

      bolt.rotation.y = -turns * TAU;
      lever.rotation.y = -turns * TAU;
      nut.position.y = height;
      // The ears stay square to the rails: the nut is the one piece that never turns.
      nut.rotation.y = 0;

      const base = UNROLLED_TURNS * CIRCUMFERENCE;
      const rise = UNROLLED_TURNS * lead;
      ramp.scale.set(base, rise, 0.5);
      // The marked edge runs from the foot of the ramp to its crest.
      edge.scale.x = Math.hypot(base, rise);
      edge.position.set(base / 2, rise / 2, 0);
      edge.rotation.z = Math.atan2(rise, -base);

      anchors.thread.set(THREAD_RADIUS + 0.3, SHAFT_TOP - 0.15, 0);
      anchors.nut.set(-0.7, height + 0.3, 0);
    },
  };
}

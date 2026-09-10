import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, dial, arrow} from '../kit.ts';
import {wingDrag, wingLift} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Flying. A wing section in a stream of air, tilted by the slider. The flow
// arrives level and leaves sloping downward, and the size of that slope is the
// whole of the lift: air sent down, wing pushed up.
//
// The wake angle drawn here is the standard induced result, twice the lift
// coefficient divided by pi times the slenderness of the wing, so a wing making
// more lift visibly throws the air further down.
// ---------------------------------------------------------------------------

const CHORD = 3;
const SPAN = 1.8;
const HINGE = 0.72;
const AXIS_Y = 2.1;
/** Where the flow starts and ends, measured from the wing's own pivot. */
const UPSTREAM = -3.4;
const DOWNSTREAM = 4;
const LINES = 7;
const STEPS = 44;
const SLENDERNESS = 9;
const CLEAN_STALL = 15;
const FLAPPED_STALL = 12;
const FLAP_LIFT = 0.8;
const FLAP_ANGLE = 35;
const ARROW_PER_LIFT = 1.15;
/** The speed the bench opens with, in km/h, which fixes the arrow scale. */
const CRUISE_KPH = 250;
/** How far a streamline stays off the surface it is following. */
const CLEARANCE = 0.1;
const FLOW_STEP = (DOWNSTREAM - UPSTREAM) / STEPS;

/** Half thickness of a twelve percent section, as a share of the chord. */
const thickness = (x: number) =>
  0.6 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);

/**
 * The section drawn here is symmetric, with no camber at all, because the lift
 * model behind it has none either: a cambered wing makes lift at zero degrees
 * and this one must not appear to. Camber is what a real wing adds to shift
 * the whole curve, and it changes nothing about how lift is made.
 */
const camber = (_x: number) => 0;

/** One piece of the section, from `from` to `to` along the chord. */
function sectionProfile(from: number, to: number) {
  const steps = 26;
  const upper: THREE.Vector2[] = [];
  const lower: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = from + (to - from) * (i / steps);
    const t = Math.max(thickness(x), 0.004);
    upper.push(new THREE.Vector2(x * CHORD, (camber(x) + t) * CHORD));
    lower.push(new THREE.Vector2(x * CHORD, (camber(x) - t) * CHORD));
  }
  return [...upper, ...lower.reverse()];
}

function sectionGeometry(profile: THREE.Vector2[]) {
  const shape = new THREE.Shape(profile);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: SPAN, bevelEnabled: false});
  geometry.translate(0, 0, -SPAN / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** Bound both mesh polygons over a whole flow step so connecting lines clear corners too. */
function surfaceAt(x: number, profiles: THREE.Vector2[][]) {
  let upper = -Infinity;
  let lower = Infinity;
  for (const profile of profiles) {
    for (let i = 0; i < profile.length; i += 1) {
      const a = profile[i];
      const b = profile[(i + 1) % profile.length];
      const ys: number[] = [];
      if (Math.abs(a.x - x) <= FLOW_STEP) ys.push(a.y);
      for (const boundary of [x - FLOW_STEP, x + FLOW_STEP]) {
        const t = (boundary - a.x) / (b.x - a.x);
        if (t >= 0 && t <= 1) ys.push(a.y + t * (b.y - a.y));
      }
      for (const y of ys) {
        upper = Math.max(upper, y);
        lower = Math.min(lower, y);
      }
    }
  }
  return Number.isFinite(upper) ? {upper, lower} : null;
}

export function buildFlying(): Mechanism {
  const group = new THREE.Group();

  // The wing turns about its quarter chord, which is where lift acts.
  const wing = new THREE.Group();
  wing.position.set(-0.25 * CHORD, AXIS_Y, 0);
  const profiles = [sectionProfile(0, HINGE), sectionProfile(HINGE, 1)];
  add(wing, sectionGeometry(profiles[0]), mat('steel')).position.x = -0.25 * CHORD;
  group.add(wing);

  const flap = new THREE.Group();
  flap.position.set((HINGE - 0.25) * CHORD, camber(HINGE) * CHORD, 0);
  const blade = add(flap, sectionGeometry(profiles[1]), mat('dark'));
  blade.position.set(-HINGE * CHORD, -camber(HINGE) * CHORD, 0);
  wing.add(flap);

  const flow = new THREE.Group();
  const lineGeometry = new THREE.BoxGeometry(1, 0.05, 0.05);
  // Each line gets a level twin behind it, marking where the air would have
  // gone if the wing were not there. The gap between them is the deflection.
  const datumGeometry = new THREE.BoxGeometry(1, 0.02, 0.02);
  const streams = Array.from({length: LINES}, () => ({
    segments: Array.from({length: STEPS}, () => add(flow, lineGeometry, mat('stone'))),
    datum: add(flow, datumGeometry, mat('dark')),
    bead: add(flow, new THREE.SphereGeometry(0.075, 12, 8), mat('accent')),
    points: Array.from({length: STEPS + 1}, () => new THREE.Vector2()),
  }));
  group.add(flow);

  const forces = new THREE.Group();
  const lift = arrow(forces, 'steel');
  const drag = arrow(forces);
  // Drag acts along the flow, which runs in +x, so its arrow lies on its side.
  drag.holder.rotation.z = -Math.PI / 2;
  group.add(forces);

  const anchors = {
    wing: new THREE.Vector3(0, AXIS_Y - 0.9, 0),
    flow: new THREE.Vector3(UPSTREAM + 0.6, AXIS_Y + 1.5, 0),
    forces: new THREE.Vector3(),
    flap: new THREE.Vector3(),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.22, 1).normalize(),
    parts: {wing, flow, forces, flap},
    anchors,
    update(state) {
      const {value, variant, elapsed} = state;
      const flapped = variant === 'flaps';
      // Lift goes with the square of the speed, so the same wing at the same
      // angle carries four times as much at twice the speed. That is why an
      // aircraft lands slowly with its flaps down and not fast with them up,
      // and with only the angle on a slider it could not be shown.
      const kph = dial(state, 'speed', CRUISE_KPH);
      const speedShare = (kph / CRUISE_KPH) ** 2;
      const stall = flapped ? FLAPPED_STALL : CLEAN_STALL;
      const cl = wingLift(value, stall, flapped ? FLAP_LIFT : 0);
      const cd = wingDrag(value, stall, cl, SLENDERNESS, flapped ? 0.07 : 0.02);
      const attack = (value * Math.PI) / 180;

      wing.rotation.z = -attack;
      flap.rotation.z = flapped ? (-FLAP_ANGLE * Math.PI) / 180 : 0;
      const outline = profiles.map((profile, part) => profile.map(point => {
        const p = point.clone();
        if (part === 1) {
          p.x -= HINGE * CHORD;
          p.rotateAround(new THREE.Vector2(), flap.rotation.z);
          p.x += HINGE * CHORD;
        }
        p.x -= 0.25 * CHORD;
        return p.rotateAround(new THREE.Vector2(), -attack)
          .add(new THREE.Vector2(wing.position.x, AXIS_Y));
      }));
      const surfaces = Array.from({length: STEPS + 1}, (_, s) =>
        surfaceAt(UPSTREAM + FLOW_STEP * s, outline));
      const separationX = wing.position.x - 0.1 * CHORD * Math.cos(attack);
      const separationY = surfaceAt(separationX, outline)!.upper + CLEARANCE;
      const separated = Math.min(1, Math.max(0, (value - stall) / 5));

      // The air leaves sloping down by the induced angle, and it takes the
      // width of the wing to turn: nothing changes far upstream.
      const wake = (2 * cl) / (Math.PI * SLENDERNESS);
      for (let i = 0; i < LINES; i += 1) {
        const stream = streams[i];
        const height = AXIS_Y + (i - (LINES - 1) / 2) * 0.68;
        let y = height;
        for (let s = 0; s <= STEPS; s += 1) {
          const x = UPSTREAM + ((DOWNSTREAM - UPSTREAM) * s) / STEPS;
          stream.points[s].set(x, y);
          // How far through the turn the flow is at this station.
          const t = Math.min(1, Math.max(0, (x - UPSTREAM * 0.45) / (CHORD * 1.5)));
          const share = t * t * (3 - 2 * t);
          // Lines close to the wing are turned most; distant ones barely at all.
          const near = 1 / (1 + ((height - AXIS_Y) / 1.5) ** 2);
          y -= Math.tan(wake) * share * near * ((DOWNSTREAM - UPSTREAM) / STEPS);
        }
        // Attached flow follows the surface: no streamline may run inside the
        // section, so any that would is pushed out to skim it instead.
        for (let s = 0; s <= STEPS; s += 1) {
          const point = stream.points[s];
          // A schematic separated upper wake opens progressively after stall.
          // Its shape illustrates separation; it is not a CFD prediction.
          if (height >= AXIS_Y && point.x > separationX && separated > 0) {
            const distance = point.x - separationX;
            const wakeY = separationY + 0.35 * (1 - Math.exp(-2 * distance)) - 0.04 * distance;
            point.y += separated * Math.max(0, wakeY - point.y);
          }
          const local = surfaces[s];
          if (!local) continue;
          const above = height >= AXIS_Y;
          if (above && point.y < local.upper + CLEARANCE) point.y = local.upper + CLEARANCE;
          if (!above && point.y > local.lower - CLEARANCE) point.y = local.lower - CLEARANCE;
        }
        for (let s = 0; s < STEPS; s += 1) {
          const a = stream.points[s];
          const b = stream.points[s + 1];
          const piece = stream.segments[s];
          piece.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
          piece.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
          piece.scale.x = a.distanceTo(b);
        }
        // The level twin runs from the wing back, so the divergence is visible.
        stream.datum.scale.x = DOWNSTREAM - 0.4;
        stream.datum.position.set((DOWNSTREAM - 0.4) / 2 - 0.4, height, -0.05);

        // A bead rides each line, so the direction of travel is never in doubt.
        const along = ((elapsed * 0.32 + i / LINES) % 1) * STEPS;
        const at = stream.points[Math.min(STEPS, Math.floor(along))];
        stream.bead.position.set(at.x, at.y, 0);
      }

      // Both act at the quarter chord, where the wing itself is pivoted.
      const center = -0.25 * CHORD;
      lift.set(cl * ARROW_PER_LIFT * speedShare);
      lift.holder.position.set(center, AXIS_Y + 0.45, 0);
      drag.set(cd * ARROW_PER_LIFT * speedShare);
      drag.holder.position.set(center + 0.28, AXIS_Y + 0.05, 0);

      anchors.forces.set(center, AXIS_Y + cl * ARROW_PER_LIFT * speedShare + 0.9, 0);
      const wingLabel = outline[0][13];
      const flapLabel = outline[1][13];
      anchors.wing.set(wingLabel.x, wingLabel.y - 0.85, 0);
      anchors.flap.set(flapLabel.x, flapLabel.y - 0.6, 0);
    },
  };
}

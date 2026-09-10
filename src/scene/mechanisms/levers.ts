import * as THREE from 'three';
import {leverGeometry, type LeverClass} from '../../physics.ts';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, dial, unitWedge, arrow, forceLengths, swell} from '../kit.ts';

// ---------------------------------------------------------------------------
// Levers. One bar on a movable fulcrum, switchable between the three classes.
// ---------------------------------------------------------------------------

/** The bar the bench opens with, in meters, and the crate it opens with, in kg. */
const BAR = 4.4;
const CRATE_KG = 60;
/** The crate's side at that weight, so its volume really is the mass it stands for. */
const CRATE_SIDE = 0.64;
const BAR_HEIGHT = 0.95;
const TILT = THREE.MathUtils.degToRad(9);

export function buildLever(): Mechanism {
  const group = new THREE.Group();

  const ground = box(group, [6.4, 0.14, 2.2], 'deck');
  ground.position.y = -0.07;

  // Everything that swings hangs off one pivot group placed at the fulcrum.
  const pivot = new THREE.Group();
  group.add(pivot);

  const bar = new THREE.Group();
  box(bar, [BAR, 0.17, 0.62], 'timber');
  for (const end of [-1, 1]) {
    const cap = box(bar, [0.07, 0.21, 0.66], 'steel');
    cap.position.x = (end * BAR) / 2;
  }

  const load = new THREE.Group();
  const crate = box(load, [CRATE_SIDE, CRATE_SIDE, CRATE_SIDE], 'stone');
  crate.position.y = 0.405;

  const effort = new THREE.Group();
  const pad = box(effort, [0.36, 0.11, 0.52], 'steel');
  pad.position.y = 0.14;

  pivot.add(bar, load, effort);

  // The force arrows stay upright in world space, because a weight and a pressing
  // hand both act vertically however far the bar has tipped.
  const loadArrow = arrow(group, 'steel');
  const effortArrow = arrow(group);

  const fulcrum = new THREE.Group();
  const stone = add(fulcrum, unitWedge(), mat('stone'));
  stone.scale.set(0.6, BAR_HEIGHT - 0.09, 0.9);
  const mirrored = add(fulcrum, unitWedge(), mat('stone'));
  mirrored.scale.set(-0.6, BAR_HEIGHT - 0.09, 0.9);
  group.add(fulcrum);

  const anchors = {
    bar: new THREE.Vector3(),
    fulcrum: new THREE.Vector3(),
    effort: new THREE.Vector3(),
    load: new THREE.Vector3(),
  };

  return {
    group,
    view: new THREE.Vector3(-0.12, 0.4, 1).normalize(),
    parts: {bar, fulcrum, effort, load},
    extras: {load: [loadArrow.holder], effort: [effortArrow.holder]},
    anchors,
    update(state) {
      const {value, variant, phase} = state;
      // The class and the fulcrum settle the ratio between the two forces; how
      // big the job is takes a control of its own. The crate stands for its
      // weight by volume, so twice the mass is twice the stone and not twice the
      // side, which would be eight times the rock.
      const kilograms = dial(state, 'load', CRATE_KG);
      const side = CRATE_SIDE * Math.cbrt(kilograms / CRATE_KG);
      crate.scale.setScalar(side / CRATE_SIDE);
      crate.position.y = 0.085 + side / 2;
      const leverClass = (['first', 'second', 'third'] as LeverClass[]).includes(variant as LeverClass)
        ? (variant as LeverClass)
        : 'first';
      const points = leverGeometry(leverClass, BAR, value * BAR);
      const toX = (position: number) => position - BAR / 2;
      const angle = TILT * swell(phase);

      pivot.position.set(toX(points.fulcrum), BAR_HEIGHT, 0);
      pivot.rotation.z = angle;
      // Children sit at their offset from the fulcrum, so the whole assembly swings as one.
      bar.position.x = -toX(points.fulcrum);
      load.position.set(points.load - points.fulcrum, 0, 0);
      effort.position.set(points.effort - points.fulcrum, 0, 0);
      fulcrum.position.x = toX(points.fulcrum);

      // Where a point on the bar has actually swung to, for arrows and labels.
      const swungX = (position: number) =>
        toX(points.fulcrum) + (position - points.fulcrum) * Math.cos(angle);
      const swungY = (position: number) => BAR_HEIGHT + (position - points.fulcrum) * Math.sin(angle);

      const effortArm = Math.abs(points.effort - points.fulcrum);
      const loadArm = Math.abs(points.load - points.fulcrum);
      const forces = forceLengths(loadArm / effortArm, 1);

      loadArrow.set(forces.load);
      loadArrow.holder.position.set(swungX(points.load), swungY(points.load) + 0.82, 0);

      const pushesDown = points.effort < points.fulcrum;
      effortArrow.set(forces.effort);
      effortArrow.holder.rotation.z = pushesDown ? Math.PI : 0;
      effortArrow.holder.position.set(
        swungX(points.effort),
        swungY(points.effort) + 0.26 + (pushesDown ? forces.effort : 0),
        0,
      );

      anchors.bar.set(toX(points.fulcrum) + BAR * 0.16, BAR_HEIGHT + 0.34, 0.4);
      anchors.fulcrum.set(toX(points.fulcrum), BAR_HEIGHT * 0.42, 0.62);
      anchors.effort.set(swungX(points.effort), swungY(points.effort) + 0.42 + forces.effort, 0);
      anchors.load.set(swungX(points.load), swungY(points.load) + 0.95 + forces.load, 0);
    },
  };
}

/* Throwaway check: run every new bench across its whole slider and every phase
   and assert the things a screenshot cannot prove. Not part of the app. */
import * as THREE from 'three';
import {buildPulleys} from './mechanisms/pulleys.ts';
import {buildScrews} from './mechanisms/screws.ts';
import {buildRotatingWheels} from './mechanisms/rotating-wheels.ts';
import {buildSprings} from './mechanisms/springs.ts';
import {buildFriction} from './mechanisms/friction.ts';

let failures = 0;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
function check(ok: boolean, message: string) {
  if (!ok) {
    failures += 1;
    console.log('FAIL ' + message);
  }
}
const world = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
};
/** Lowest point of a box mesh, taking its own rotation into account. */
function boxCorners(mesh: THREE.Mesh) {
  const g = mesh.geometry as THREE.BoxGeometry;
  const p = g.parameters;
  const out: THREE.Vector3[] = [];
  mesh.updateWorldMatrix(true, false);
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5])
        out.push(new THREE.Vector3(sx * p.width, sy * p.height, sz * p.depth).applyMatrix4(mesh.matrixWorld));
  return out;
}
const phases = Array.from({length: 41}, (_, i) => i / 40);

// --------------------------------------------------------------- pulleys
{
  const m = buildPulleys();
  const rope = m.parts.rope as THREE.Group;
  const load = m.parts.load as THREE.Group;
  const moving = m.parts.moving as THREE.Group;
  for (let strands = 1; strands <= 6; strands += 1) {
    for (const phase of phases) {
      m.update({value: strands, variant: '', phase, elapsed: phase * 6});
      m.group.updateMatrixWorld(true);
      // The first seven cylinders are the strands; the one after them is the grip.
      const lines = rope.children.slice(0, 7) as THREE.Mesh[];
      const live = lines.filter(l => l.visible && l.scale.y > 0.001);
      // One strand per unit of advantage, plus the one the hand pulls.
      check(live.length === strands + 1, `pulleys: ${strands} strands drew ${live.length} lines`);
      // Every strand hangs from the same height, and none is inverted.
      for (const line of live) check(line.scale.y > 0, `pulleys: strand of negative length at ${strands}`);
      const sheaves = [...(m.parts.fixed as THREE.Group).children, ...moving.children].filter(
        c => c instanceof THREE.Group && c.visible,
      );
      check(sheaves.length === strands, `pulleys: ${strands} strands used ${sheaves.length} sheaves`);
      // Nothing may end up below the floor the frame stands on.
      for (const mesh of load.children) {
        if (!(mesh instanceof THREE.Mesh) || !((mesh.geometry as THREE.BufferGeometry).type === 'BoxGeometry')) continue;
        const low = Math.min(...boxCorners(mesh).map(v => v.y));
        check(low >= -0.001, `pulleys: load ${low.toFixed(3)} under the ground at ${strands} strands`);
      }
    }
  }
  // The bargain itself: the hand travels the advantage times the lift.
  for (let strands = 1; strands <= 6; strands += 1) {
    m.update({value: strands, variant: '', phase: 0, elapsed: 0});
    const restBlock = world(moving).y || 0;
    const restHand = world(rope.children.at(-2) as THREE.Object3D).y;
    m.update({value: strands, variant: '', phase: 0.5, elapsed: 3});
    const topHand = world(rope.children.at(-2) as THREE.Object3D).y;
    void restBlock;
    check(near(restHand - topHand, 0.35 * strands, 1e-6), `pulleys: hand travel wrong at ${strands}`);
  }
}

// ---------------------------------------------------------------- screws
{
  const m = buildScrews();
  const MM = 0.008;
  for (let pitch = 4; pitch <= 40; pitch += 1) {
    for (const variant of ['single', 'double']) {
      for (const phase of phases) {
        m.update({value: pitch, variant, phase, elapsed: phase * 6});
        m.group.updateMatrixWorld(true);
        const nutY = world(m.parts.nut).y;
        check(nutY >= 0.72 - 1e-9, `screws: nut below the boss at ${pitch}/${variant}`);
        check(nutY <= 2.01, `screws: nut above the head at ${pitch}/${variant}`);
        // The unrolled ramp keeps the slope the thread actually has.
        const ramp = (m.parts.unwrapped as THREE.Group).children.find(
          c => c instanceof THREE.Mesh && (c.geometry as THREE.BufferGeometry).type === 'ExtrudeGeometry',
        ) as THREE.Mesh;
        const lead = pitch * (variant === 'double' ? 2 : 1) * MM;
        const slope = ramp.scale.y / ramp.scale.x;
        check(near(slope, lead / (Math.PI * 2 * 20 * MM), 1e-9), `screws: ramp slope wrong at ${pitch}/${variant}`);
      }
    }
  }
  // Four turns of the wrench must move the nut four leads, whatever the pitch.
  for (const pitch of [4, 12, 40]) {
    m.update({value: pitch, variant: 'single', phase: 0, elapsed: 0});
    const start = world(m.parts.nut).y;
    m.update({value: pitch, variant: 'single', phase: 0.5, elapsed: 3});
    const end = world(m.parts.nut).y;
    const expected = Math.min(4 * pitch * MM, start - 0.72);
    check(near(start - end, expected, 1e-9), `screws: travel ${(start - end).toFixed(4)} not ${expected.toFixed(4)}`);
  }
}

// ------------------------------------------------------- rotating wheels
{
  const m = buildRotatingWheels();
  const lengths: Record<number, number> = {};
  const swings: Record<number, number> = {};
  for (let rate = 20; rate <= 60; rate += 1) {
    m.update({value: rate, variant: 'gyroscope', phase: 0, elapsed: 1});
    const swing = (m.parts.rotor.parent!.parent!.parent as THREE.Group).rotation.y;
    swings[rate] = swing;
    const shaftMesh = (m.parts.rim as THREE.Group).children.find(
      c => c instanceof THREE.Group,
    ) as THREE.Group;
    const shaft = shaftMesh.children[0] as THREE.Mesh;
    lengths[rate] = shaft.scale.y + (shaftMesh.children[1] as THREE.Mesh).scale.y * 0.26;
  }
  // The arrow grows with the square of the rate, the swing falls with it.
  check(near(lengths[40] / lengths[20], 4, 0.02), `rotating: arrow not square in the rate`);
  check(near(lengths[60] / lengths[20], 9, 0.05), `rotating: arrow not square in the rate at the top`);
  check(near(swings[20] / swings[40], 2, 1e-9), `rotating: swing not inverse in the rate`);
  // Held at both ends, the axis does not move at all.
  m.update({value: 30, variant: 'flywheel', phase: 0, elapsed: 5});
  check((m.parts.rotor.parent!.parent!.parent as THREE.Group).rotation.y === 0, 'rotating: flywheel axis moved');
  // The spin only ever goes forward.
  let last = -Infinity;
  for (let t = 0; t < 40; t += 1) {
    m.update({value: 30, variant: 'flywheel', phase: (t / 40) % 1, elapsed: t * 0.1});
    const angle = (m.parts.rotor.parent as THREE.Group).rotation.x;
    check(angle >= last, 'rotating: spin went backward');
    last = angle;
  }
}

// --------------------------------------------------------------- springs
{
  const m = buildSprings();
  const MM = 0.008;
  const gauge = m.parts.gauge as THREE.Group;
  const pointer = gauge.children.at(-1) as THREE.Mesh;
  const ticks = gauge.children.find(c => c instanceof THREE.Group) as THREE.Group;
  for (let k = 4; k <= 40; k += 1) {
    for (const variant of ['coil', 'leaf', 'torsion']) {
      for (const phase of phases) {
        m.update({value: k, variant, phase, elapsed: phase * 5});
        m.group.updateMatrixWorld(true);
        const settled = (300 / k) * MM;
        const drop = (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)) * settled;
        // The pointer reads the travel of whatever the load rests on.
        const read = ticks.position.y - pointer.position.y;
        const expected = drop;
        check(near(read, expected, 1e-9), `springs: ${variant} pointer reads ${read.toFixed(4)} not ${expected.toFixed(4)}`);
        // The load never leaves the spring, and never sinks into it.
        const load = m.parts.load as THREE.Group;
        const plate = load.children.at(-1) as THREE.Mesh;
        const foot = Math.min(...boxCorners(plate).map(v => v.y));
        const springTop = variant === 'coil'
          ? 0.34 + (1.7 - drop) + 0.09
          : variant === 'leaf'
            ? 0.34 + 0.5 - drop + 0.05
            : 0.34 + 0.8 - drop + 0.08;
        check(near(foot, springTop, 1e-6), `springs: ${variant} load at ${foot.toFixed(4)} not ${springTop.toFixed(4)}`);
      }
      // Softest spring, deepest squeeze: the coil must not close solid.
      m.update({value: 4, variant, phase: 0.5, elapsed: 2.5});
      const holder = (m.parts.spring as THREE.Group).children[0] as THREE.Group;
      const scaled = holder.children.find(c => c instanceof THREE.Group) as THREE.Group;
      check(scaled.scale.y > 7 * 0.11, 'springs: the coil closed solid');
    }
  }
}

// -------------------------------------------------------------- friction
{
  const m = buildFriction();
  const block = m.parts.block as THREE.Group;
  const slab = block.children[0] as THREE.Mesh;
  const plank = ((m.parts.surface as THREE.Group).children.find(c => c instanceof THREE.Group)) as THREE.Group;
  const deck = plank.children[0] as THREE.Mesh;
  for (let mu = 0.05; mu <= 1.2001; mu += 0.05) {
    for (const phase of phases) {
      m.update({value: mu, variant: '', phase, elapsed: phase * 6});
      m.group.updateMatrixWorld(true);
      // The plank rises to exactly the angle at which this pair lets go.
      const tilt = plank.rotation.z;
      check(tilt <= Math.atan(mu) + 1e-9, `friction: over-tilted at mu ${mu.toFixed(2)}`);
      // The block's underside lies on the plank's top face, everywhere.
      const surface = new THREE.Vector3(0, 0.08, 0).applyMatrix4(deck.parent!.matrixWorld);
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(plank.quaternion);
      for (const corner of boxCorners(slab)) {
        const gap = corner.clone().sub(surface).dot(normal);
        check(gap >= -1e-6, `friction: block ${gap.toFixed(5)} into the plank at mu ${mu.toFixed(2)}`);
      }
      const bottom = boxCorners(slab)
        .map(v => v.clone().sub(surface).dot(normal))
        .sort((a, b) => a - b);
      check(near(bottom[0], 0, 1e-6), `friction: block floating ${bottom[0].toFixed(5)} above the plank`);
      // And it stays on the plank rather than running off either end.
      const along = block.position.clone().sub(new THREE.Vector3(-1.9, 0.62, 0)).dot(
        new THREE.Vector3(1, 0, 0).applyQuaternion(plank.quaternion),
      );
      check(along > 0.38 && along < 4.2 - 0.38, `friction: block at ${along.toFixed(2)} along a 4.2 plank`);
      // A block topples instead of sliding once the tilt passes its own shape.
      const g = slab.geometry as THREE.BoxGeometry;
      check(
        Math.tan(tilt) < g.parameters.width / g.parameters.height,
        `friction: block topples at mu ${mu.toFixed(2)} before it slides`,
      );
    }
  }
}

// --------------------------------------------- bearing races and pulley plates
{
  const m = buildFriction();
  m.update({value: 0.6, variant: '', phase: 0, elapsed: 0});
  m.group.updateMatrixWorld(true);
  const bearing = m.parts.bearing as THREE.Group;
  const outer = bearing.children[0] as THREE.Mesh;
  const torus = (outer.geometry as THREE.TorusGeometry).parameters;
  const innerRace = ((bearing.children[1] as THREE.Group).children[0] as THREE.Mesh).geometry as THREE.CylinderGeometry;
  const cage = bearing.children[2] as THREE.Group;
  const ball = cage.children[0] as THREE.Mesh;
  const ballR = (ball.geometry as THREE.SphereGeometry).parameters.radius;
  const circle = Math.hypot(ball.position.x, ball.position.y);
  check(
    near(circle + ballR, torus.radius - torus.tube, 1e-9),
    `bearing: balls reach ${(circle + ballR).toFixed(3)} against an outer race at ${(torus.radius - torus.tube).toFixed(3)}`,
  );
  check(
    near(circle - ballR, innerRace.parameters.radiusTop, 1e-9),
    `bearing: balls stop at ${(circle - ballR).toFixed(3)} against an inner race at ${innerRace.parameters.radiusTop}`,
  );
  const gap = 2 * circle * Math.sin(Math.PI / cage.children.length);
  check(gap > 2 * ballR, `bearing: balls ${gap.toFixed(3)} apart but ${(2 * ballR).toFixed(3)} across`);
}

{
  const m = buildPulleys();
  for (let strands = 1; strands <= 6; strands += 1) {
    m.update({value: strands, variant: '', phase: 0.25, elapsed: 1.5});
    m.group.updateMatrixWorld(true);
    // Every sheave has to be under the plate that is supposed to carry it.
    for (const [name, group] of [['fixed', m.parts.fixed], ['moving', m.parts.moving]] as const) {
      const plate = group.children.find(c => c.name === 'plate' && c.visible) as THREE.Mesh | undefined;
      if (!plate) continue;
      const half = ((plate.geometry as THREE.BoxGeometry).parameters.width * plate.scale.x) / 2;
      for (const wheel of group.children) {
        if (!(wheel instanceof THREE.Group) || !wheel.visible) continue;
        check(
          Math.abs(wheel.position.x - plate.position.x) <= half,
          `pulleys: ${name} sheave at ${wheel.position.x.toFixed(2)} hangs off a plate ${plate.position.x.toFixed(2)} +- ${half.toFixed(2)} at ${strands} strands`,
        );
      }
    }
  }
}

// The second sliders of part two: each has to move the drawing, not only the
// numbers beside it.
{
  const wheels = buildRotatingWheels();
  const rotor = wheels.parts.rotor as THREE.Group;
  const rimPart = wheels.parts.rim as THREE.Group;
  for (const radius of [50, 120, 260]) {
    for (const variant of ['flywheel', 'gyroscope']) {
      wheels.update({value: 40, variant, phase: 0, elapsed: 1.3, extras: {radius}});
      wheels.group.updateMatrixWorld(true);
      // The wheel is drawn at the radius the inertia is worked out from.
      check(near(rotor.scale.x, radius / 120, 1e-9), `flywheel: drawn at ${rotor.scale.x.toFixed(3)} for ${radius} mm`);
      // And the rim bolt rides the rim, wherever the rim now is.
      const bolt = rimPart.children[0] as THREE.Mesh;
      check(near(bolt.position.y, 0.93 * (radius / 120), 1e-9), `flywheel: the bolt is off the rim at ${radius} mm, at ${bolt.position.y.toFixed(3)}`);
    }
  }

  const spring = buildSprings();
  const seen: number[] = [];
  for (const newtons of [50, 300, 1200]) {
    spring.update({value: 12, variant: 'coil', phase: 0.5, elapsed: 0, extras: {load: newtons}});
    spring.group.updateMatrixWorld(true);
    // The coil's own drawn length, not a box around the whole assembly, which
    // includes the seat and never moves.
    const holder = (spring.parts.spring as THREE.Group).children[0] as THREE.Group;
    const scaled = holder.children.find(c => c instanceof THREE.Group) as THREE.Group;
    seen.push(scaled.scale.y);
  }
  // Heavier presses it shorter, at every step, or the load is not being felt.
  check(seen[0] > seen[1] + 1e-6 && seen[1] > seen[2] + 1e-6, `spring: the load does not compress it, ${seen.map(v => v.toFixed(3)).join(' ')}`);

  const rub = buildFriction();
  const slab = (rub.parts.block as THREE.Group).children[0] as THREE.Mesh;
  const angles: number[] = [];
  for (const newtons of [200, 981, 3000]) {
    rub.update({value: 0.6, variant: '', phase: 0.2, elapsed: 0, extras: {weight: newtons}});
    rub.group.updateMatrixWorld(true);
    check(near(slab.scale.x ** 3, newtons / 981, 1e-9), `friction: ${newtons} N drawn at a scale of ${slab.scale.x.toFixed(3)}`);
    angles.push(((rub.parts.surface as THREE.Group).children[0] as THREE.Object3D).rotation.z);
  }
  // And the angle it slips at does not move with the weight, which is the point.
  check(near(angles[0], angles[2], 1e-12), `friction: the weight changed the angle it slips at, ${angles.join(' ')}`);
}

console.log(failures === 0 ? 'BATCH 1 CLEAN' : `${failures} failures`);

if (failures) process.exitCode = 1;

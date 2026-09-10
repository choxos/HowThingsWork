/* Throwaway check for the five benches of part 1, which had none. Each of them
   now carries a second slider, and a second slider is worth nothing unless the
   drawing answers it: these assert that it does, and that the drawn thing agrees
   with the number the readout gives for it. Not part of the app. */
import * as THREE from 'three';
import {buildInclinedPlane} from './mechanisms/inclined-plane.ts';
import {buildLever} from './mechanisms/levers.ts';
import {buildWheelAndAxle} from './mechanisms/wheel-and-axle.ts';
import {buildGearsAndBelts} from './mechanisms/gears-and-belts.ts';
import {buildCamsAndCranks} from './mechanisms/cams-and-cranks.ts';
import {buildPulleys} from './mechanisms/pulleys.ts';
import {buildScrews} from './mechanisms/screws.ts';
import {ownershipFaults, strayParts} from './verify-shared.ts';
import {inclinedPlane, leverArms, wheelAndAxle, gearTrain, rodObliquity, screw, threadLead, type LeverClass} from '../physics.ts';

let failures = 0;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
function check(ok: boolean, message: string) {
  if (!ok) {
    failures += 1;
    console.log('FAIL ' + message);
  }
}
/** Counted so a loop that never ran cannot be mistaken for a loop that passed. */
let looked = 0;

const phases = [0, 0.17, 0.33, 0.5, 0.72, 0.91];

// ------------------------------------------------------------ inclined plane
{
  const m = buildInclinedPlane();
  const slope = m.parts.slope as THREE.Group;
  for (let rise = 0.4; rise <= 3.0001; rise += 0.2) {
    for (let run = 0.6; run <= 7.0001; run += 0.4) {
      for (const phase of phases) {
        m.update({value: rise, variant: '', phase, elapsed: phase * 3, extras: {run}});
        m.group.updateMatrixWorld(true);
        looked += 1;
        // The ramp really is as high and as long as the two sliders say. With
        // one slider the drawing could only ever be a line through the family of
        // ramps; with two it has to be the ramp asked for. The wedge is a unit
        // triangle, so its scale is its size and there is no box to be loose.
        const wedge = slope.children[0] as THREE.Mesh;
        check(near(wedge.scale.y, rise, 1e-9), `ramp: drawn ${wedge.scale.y.toFixed(2)} high, asked ${rise.toFixed(1)}`);
        check(near(wedge.scale.x, run, 1e-9), `ramp: drawn ${wedge.scale.x.toFixed(2)} long, asked ${run.toFixed(1)}`);
        // And the sloping face is the hypotenuse of those two.
        const facing = slope.children[1] as THREE.Mesh;
        check(near(facing.scale.x, Math.hypot(rise, run), 1e-9), 'ramp: the face is not the hypotenuse');
        // And the effort arrow is the load's weight times the rise over the
        // slope length, which is the only claim the bench makes.
        const advantage = inclinedPlane(Math.hypot(rise, run), rise).forceRatio;
        const load = m.parts.load as THREE.Group;
        const effort = load.children[2] as THREE.Group;
        const lengths = [effort.children[0] as THREE.Mesh, effort.children[1] as THREE.Mesh];
        const drawn = lengths[0].scale.y + lengths[1].scale.y * 0.26;
        check(drawn > 0, 'ramp: the effort arrow is not drawn');
        check(
          near(drawn * advantage, 1.35, 0.02),
          `ramp: the effort arrow is ${drawn.toFixed(3)} where the advantage is ${advantage.toFixed(2)}`,
        );
      }
    }
  }
  check(ownershipFaults(m).length === 0, `ramp: ${ownershipFaults(m).join(', ')}`);
  check(strayParts(m, 14).length === 0, `ramp: ${strayParts(m, 14).join(', ')}`);
}

// -------------------------------------------------------------------- levers
{
  const m = buildLever();
  const crate = (m.parts.load as THREE.Group).children[0] as THREE.Mesh;
  let smallest = Infinity;
  let largest = 0;
  for (const variant of ['first', 'second', 'third']) {
    for (let at = 0.08; at <= 0.9201; at += 0.04) {
      for (let kg = 5; kg <= 200; kg += 15) {
        m.update({value: at, variant, phase: 0, elapsed: 0, extras: {load: kg}});
        m.group.updateMatrixWorld(true);
        looked += 1;
        const box = new THREE.Box3().setFromObject(crate);
        const side = box.max.y - box.min.y;
        smallest = Math.min(smallest, side);
        largest = Math.max(largest, side);
        // The crate stands for its weight by volume, because a box drawn at
        // twice the side for twice the mass is eight times the stone.
        check(near(side ** 3 / 0.64 ** 3, kg / 60, 1e-6), `lever: ${kg} kg drawn as a side of ${side.toFixed(3)}`);
        // It sits on the bar rather than floating over it or sinking into it,
        // whatever size it is.
        // On the plank itself, not on the steel caps that stand proud of it.
        const plank = new THREE.Box3().setFromObject((m.parts.bar as THREE.Group).children[0]);
        check(near(box.min.y, plank.max.y, 0.01), `lever: the crate rests at ${box.min.y.toFixed(3)} on a plank topping ${plank.max.y.toFixed(3)}`);
        // The ratio is the class and the fulcrum, and the load does not touch it.
        const arms = leverArms(variant as LeverClass, 1, at);
        check(arms.forceRatio > 0, `lever: no ratio at ${variant} ${at}`);
      }
    }
  }
  check(largest / smallest > 3, `lever: the crate barely changes, ${smallest.toFixed(3)} to ${largest.toFixed(3)}`);
  check(ownershipFaults(m).length === 0, `lever: ${ownershipFaults(m).join(', ')}`);
}

// ------------------------------------------------------------ wheel and axle
{
  const m = buildWheelAndAxle();
  const MM = 0.0026;
  const drum = (m.parts.axle as THREE.Group).children[0] as THREE.Mesh;
  // The handle, by the geometry it is cut from: it is not placed until the
  // first update, so there is nothing to find it by before then.
  const grip = (m.parts.wheel as THREE.Group).children.find(
    node =>
      node instanceof THREE.Mesh &&
      node.geometry instanceof THREE.CylinderGeometry &&
      near(node.geometry.parameters.radiusTop, 0.09, 1e-9),
  ) as THREE.Mesh;
  check(Boolean(grip), 'winch: no handle on the wheel');
  for (let handle = 150; handle <= 600; handle += 30) {
    for (let axle = 40; axle <= 200; axle += 20) {
      for (const phase of phases) {
        m.update({value: handle, variant: '', phase, elapsed: phase * 3, extras: {axle}});
        m.group.updateMatrixWorld(true);
        looked += 1;
        // Both circles are drawn at the radius the numbers use, so the advantage
        // can be read off the picture and not only off the readout.
        check(near(grip.position.x, handle * MM, 1e-9), `winch: the handle is at ${(grip.position.x / MM).toFixed(0)} mm, asked ${handle}`);
        // From the geometry and its scale, not from a bounding box: the drum
        // turns, and a turning cylinder's box is the box of a turning square.
        const drawnDrum = (drum.geometry as THREE.CylinderGeometry).parameters.radiusTop * drum.scale.x;
        check(
          near(drawnDrum, axle * MM, 1e-9),
          `winch: the drum is drawn ${(drawnDrum / MM).toFixed(0)} mm, asked ${axle}`,
        );
        // The rope leaves the drum at its own surface, not at the surface some
        // other drum would have.
        const rope = m.parts.rope as THREE.Group;
        const line = rope.children[1] as THREE.Mesh;
        check(near(line.position.x, axle * MM, 1e-9), `winch: the rope hangs off the wrong radius at ${axle}`);
        check(wheelAndAxle(handle, axle).forceRatio > 0, 'winch: no ratio');
      }
    }
  }
  check(ownershipFaults(m).length === 0, `winch: ${ownershipFaults(m).join(', ')}`);
}

// ----------------------------------------------------------- gears and belts
{
  const m = buildGearsAndBelts();
  const teeth = m.parts.teeth as THREE.Group;
  for (let driven = 6; driven <= 36; driven += 2) {
    for (let driving = 6; driving <= 36; driving += 2) {
      m.update({value: driven, variant: 'gears', phase: 0, elapsed: 1.7, extras: {driver: driving}});
      m.group.updateMatrixWorld(true);
      looked += 1;
      // Both wheels are countable, and the count drawn is the count the ratio
      // is worked out from. A driving wheel stuck at twelve would make half the
      // second slider a lie.
      const shown = teeth.children.filter(node => node.visible).length;
      check(shown === driving + driven, `gears: ${shown} teeth drawn for ${driving} and ${driven}`);
      // Equal arcs at the rims: the wheels turn in the ratio of their counts.
      const a = (m.parts.driver as THREE.Group).children[0] as THREE.Group;
      const b = (m.parts.driven as THREE.Group).children[0] as THREE.Group;
      const turned = Math.abs(b.rotation.z / a.rotation.z);
      check(
        near(turned, driving / driven, 1e-9),
        `gears: turned in ${turned.toFixed(4)} where the teeth give ${(driving / driven).toFixed(4)}`,
      );
      check(near(gearTrain(driving, driven).forceRatio, driven / driving, 1e-12), 'gears: the readout ratio disagrees');
    }
  }
  check(ownershipFaults(m).length === 0, `gears: ${ownershipFaults(m).join(', ')}`);
}

// ----------------------------------------------------------- cams and cranks
{
  const m = buildCamsAndCranks();
  const beam = (m.parts.rod as THREE.Group).children[0] as THREE.Mesh;
  for (let thrown = 0.2; thrown <= 1.0001; thrown += 0.1) {
    for (let rod = 1.6; rod <= 6.0001; rod += 0.4) {
      let worst = 0;
      for (let i = 0; i <= 36; i += 1) {
        m.update({value: thrown, variant: '', phase: i / 36, elapsed: 0, extras: {rod}});
        m.group.updateMatrixWorld(true);
        looked += 1;
        worst = Math.max(worst, Math.abs(beam.rotation.z));
        check(near(beam.scale.x, rod * 0.62, 1e-9), `crank: the rod is drawn ${beam.scale.x.toFixed(3)} for ${rod} radii`);
      }
      // How far the rod leans is the whole of what the second slider is for, and
      // the drawn lean has to be the lean the readout reports.
      const wanted = (rodObliquity(thrown, rod) * Math.PI) / 180;
      check(
        near(worst, wanted, 2e-3),
        `crank: leans ${((worst * 180) / Math.PI).toFixed(2)} where the rod gives ${rodObliquity(thrown, rod).toFixed(2)}`,
      );
    }
  }
  check(ownershipFaults(m).length === 0, `crank: ${ownershipFaults(m).join(', ')}`);
}

// ------------------------------------------------------------------ pulleys
{
  const m = buildPulleys();
  const crate = (m.parts.load as THREE.Group).children.find(
    node => node instanceof THREE.Mesh && node.geometry instanceof THREE.BoxGeometry,
  ) as THREE.Mesh;
  check(Boolean(crate), 'hoist: no crate on the hook');
  for (let strands = 1; strands <= 6; strands += 1) {
    for (let kg = 20; kg <= 500; kg += 40) {
      for (const phase of phases) {
        m.update({value: strands, variant: '', phase, elapsed: phase * 3, extras: {load: kg}});
        m.group.updateMatrixWorld(true);
        looked += 1;
        // By volume, so the timber really stands for the weight.
        check(near(crate.scale.x ** 3, kg / 100, 1e-9), `hoist: ${kg} kg drawn at a scale of ${crate.scale.x.toFixed(3)}`);
        check(near(crate.scale.x, crate.scale.y, 1e-12) && near(crate.scale.y, crate.scale.z, 1e-12), 'hoist: the crate is not a cube');
      }
    }
  }
  check(ownershipFaults(m).length === 0, `hoist: ${ownershipFaults(m).join(', ')}`);
}

// ------------------------------------------------------------------- screws
{
  const m = buildScrews();
  const MM = 0.008;
  const lever = m.parts.lever as THREE.Group;
  const bar = lever.children.find(node => node instanceof THREE.Mesh && node.geometry instanceof THREE.BoxGeometry) as THREE.Mesh;
  const grip = lever.children.find(
    node => node instanceof THREE.Mesh && node.geometry instanceof THREE.CylinderGeometry,
  ) as THREE.Mesh;
  check(Boolean(bar) && Boolean(grip), 'screw: no wrench on the shaft');
  for (let pitch = 4; pitch <= 40; pitch += 2) {
    for (let reach = 40; reach <= 360; reach += 20) {
      for (const variant of ['single', 'double']) {
        for (const phase of phases) {
          m.update({value: pitch, variant, phase, elapsed: phase * 3, extras: {reach}});
          m.group.updateMatrixWorld(true);
          looked += 1;
          // The wrench is drawn as long as it is said to be, and the grip is at
          // its far end: a hand drawn short of where the numbers put it reports
          // a force nobody could apply there.
          check(near(bar.scale.x, reach * MM, 1e-9), `screw: the wrench is drawn ${(bar.scale.x / MM).toFixed(0)} mm, asked ${reach}`);
          check(near(grip.position.x, reach * MM, 1e-9), `screw: the grip is at ${(grip.position.x / MM).toFixed(0)} mm, asked ${reach}`);
          const lead = threadLead(pitch, variant === 'double' ? 2 : 1);
          check(screw(reach, lead).forceRatio > 1, `screw: no advantage at ${pitch}/${reach}`);
        }
      }
    }
  }
  check(ownershipFaults(m).length === 0, `screw: ${ownershipFaults(m).join(', ')}`);
}

check(looked > 4000, `only ${looked} settings were looked at`);
console.log(failures ? `${failures} failures` : 'BATCH 0 CLEAN');
if (failures) process.exitCode = 1;

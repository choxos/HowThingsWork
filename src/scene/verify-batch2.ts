/* Throwaway check for the five benches of part 2. Not part of the app. */
import * as THREE from 'three';
import {buildFloating} from './mechanisms/floating.ts';
import {buildFlying} from './mechanisms/flying.ts';
import {buildPressurePower} from './mechanisms/pressure-power.ts';
import {buildExploitingHeat} from './mechanisms/exploiting-heat.ts';
import {buildNuclearPower} from './mechanisms/nuclear-power.ts';
import {
  carnotEfficiency,
  coolingLimit,
  chainGrowth,
  dragCoefficient,
  hydraulicPress,
  pistonArea,
  wingLift,
} from '../physics.ts';

let failures = 0;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
function check(ok: boolean, message: string) {
  if (!ok) {
    failures += 1;
    console.log('FAIL ' + message);
  }
}
const phases = Array.from({length: 21}, (_, i) => i / 20);

// -------------------------------------------------------------- floating
{
  const m = buildFloating();
  const hull = m.parts.hull as THREE.Group;
  const water = m.parts.water as THREE.Group;
  const sea = water.children[1] as THREE.Mesh;
  const seaTop = sea.position.y + (sea.geometry as THREE.BoxGeometry).parameters.height / 2;
  const HULL_HEIGHT = 1.4;
  for (let density = 120; density <= 2000; density += 10) {
    m.update({value: density, variant: '', phase: 0, elapsed: 0});
    m.group.updateMatrixWorld(true);
    const deck = hull.position.y + HULL_HEIGHT / 2;
    const keel = hull.position.y - HULL_HEIGHT / 2;
    const submerged = Math.min(1, (seaTop - keel) / HULL_HEIGHT);
    if (density < 1000) {
      // A hull with vertical sides sits as deep in share of its depth as its
      // density is a share of the water's.
      check(near(submerged, density / 1000, 1e-6), `floating: draft ${submerged.toFixed(4)} not ${(density / 1000).toFixed(4)}`);
      check(deck > seaTop - 1e-9, `floating: deck under water at ${density}`);
    } else {
      check(deck <= seaTop + 1e-9, `floating: a hull denser than water still showing at ${density}`);
    }
    // The cargo stays inside the hull, and grows with the density it stands for.
    const cargo = (m.parts.ballast as THREE.Group).children[0] as THREE.Mesh;
    const top = cargo.position.y + cargo.scale.y / 2;
    check(top <= deck + 1e-9, `floating: cargo above the deck at ${density}`);
    check(cargo.position.y - cargo.scale.y / 2 >= keel - 1e-9, `floating: cargo below the keel at ${density}`);
  }
  // Equal density has no net force: it must not spontaneously sink.
  m.update({value: 1000, variant: '', phase: 0, elapsed: 0});
  const neutralHeight = hull.position.y;
  for (const phase of phases) {
    m.update({value: 1000, variant: '', phase, elapsed: phase * 5});
    check(near(hull.position.y, neutralHeight), 'floating: neutrally buoyant hull sinks');
  }
  // Once it cannot float, it goes down rather than hovering.
  m.update({value: 1400, variant: '', phase: 0, elapsed: 0});
  const high = (m.parts.hull as THREE.Group).position.y;
  m.update({value: 1400, variant: '', phase: 0.5, elapsed: 2});
  check((m.parts.hull as THREE.Group).position.y < high, 'floating: a sinking hull did not sink');
}

// ---------------------------------------------------------------- flying
{
  const m = buildFlying();
  const flow = m.parts.flow as THREE.Group;
  const forces = m.parts.forces as THREE.Group;
  const flap = (m.parts.wing as THREE.Group).children.find(c => c instanceof THREE.Group) as THREE.Group;
  const lengthOf = (holder: THREE.Group) => {
    const shaft = holder.children[0] as THREE.Mesh;
    const head = holder.children[1] as THREE.Mesh;
    return shaft.scale.y + head.scale.y * 0.26;
  };
  for (let angle = 0; angle <= 24; angle += 0.5) {
    for (const variant of ['clean', 'flaps']) {
      m.update({value: angle, variant, phase: 0, elapsed: 0});
      const flapped = variant === 'flaps';
      const cl = wingLift(angle, flapped ? 12 : 15, flapped ? 0.8 : 0);
      // The wing is tilted by exactly the angle the slider names.
      check(
        near((m.parts.wing as THREE.Group).rotation.z, (-angle * Math.PI) / 180, 1e-9),
        `flying: wing at the wrong angle for ${angle}`,
      );
      check(near(flap.rotation.z, flapped ? (-35 * Math.PI) / 180 : 0, 1e-9), 'flying: flap deflected wrongly');
      // The lift arrow is proportional to the lift coefficient, always.
      const holder = forces.children[0] as THREE.Group;
      check(holder.visible === cl * 1.15 > 0.02, `flying: lift arrow shown for no lift at ${angle}`);
      if (holder.visible) {
        check(near(lengthOf(holder), cl * 1.15, 1e-6), `flying: lift arrow off at ${angle}`);
      }
      // And drag is smaller than lift wherever the wing is still flying.
      const cd = dragCoefficient(cl, 9, flapped ? 0.07 : 0.02);
      check(cd < cl + 0.06, `flying: drag ${cd.toFixed(3)} above lift ${cl.toFixed(3)} at ${angle}`);
    }
  }
  // The wake slopes down by the induced angle, and the level twin does not.
  for (const angle of [0, 6, 12]) {
    m.update({value: angle, variant: 'clean', phase: 0, elapsed: 0});
    const stream = flow.children.filter(c => c instanceof THREE.Mesh) as THREE.Mesh[];
    void stream;
    const cl = wingLift(angle, 15);
    const wake = (2 * cl) / (Math.PI * 9);
    // The middle line's last segment must lie at the induced angle.
    const middle = 3;
    const segments = flow.children.slice(middle * 46, middle * 46 + 44) as THREE.Mesh[];
    const last = segments[segments.length - 1];
    check(near(Math.abs(last.rotation.z), wake, 0.02), `flying: wake ${Math.abs(last.rotation.z).toFixed(4)} not ${wake.toFixed(4)} at ${angle}`);
  }
}

// -------------------------------------------------------- pressure power
{
  const m = buildPressurePower();
  const MM = 0.011;
  const small = m.parts.small as THREE.Group;
  const large = m.parts.large as THREE.Group;
  for (let bore = 20; bore <= 200; bore += 2) {
    const press = hydraulicPress(pistonArea(20), pistonArea(bore));
    for (const variant of ['liquid', 'gas']) {
      m.update({value: bore, variant, phase: 0, elapsed: 0});
      const smallRest = (small.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh).position.y;
      const largeRest = (large.children.filter(c => c instanceof THREE.Mesh)[0] as THREE.Mesh).position.y;
      if (variant === 'gas') {
        m.update({value: bore, variant, phase: 0.25, elapsed: 1.25});
        const early = (large.children.filter(c => c instanceof THREE.Mesh)[0] as THREE.Mesh).position.y;
        check(near(early, largeRest), `press: gas moves load before reaching lifting pressure at ${bore}`);
      }
      m.update({value: bore, variant, phase: 0.5, elapsed: 2.5});
      const smallDown = smallRest - (small.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh).position.y;
      const largeUp = (large.children.filter(c => c instanceof THREE.Mesh)[0] as THREE.Mesh).position.y - largeRest;
      // Whatever leaves one cylinder arrives at the other, so travel is in the
      // inverse ratio of the areas. With a gas, part of the stroke is swallowed
      // first, so the far piston gets less, never more.
      const full = (50 / press.distanceRatio) * MM;
      if (variant === 'liquid') {
        check(near(largeUp, full, 1e-9), `press: travel ${largeUp.toFixed(5)} not ${full.toFixed(5)} at ${bore}`);
      } else {
        check(largeUp <= full + 1e-9, `press: gas delivered more than liquid at ${bore}`);
      }
      check(near(smallDown, 50 * MM, 1e-9), `press: input stroke wrong at ${bore}`);
    }
  }
}

// ------------------------------------------------------- exploiting heat
{
  const m = buildExploitingHeat();
  const working = m.parts.working as THREE.Group;
  const feed = working.children[0] as THREE.Mesh;
  const drain = working.children[1] as THREE.Mesh;
  const engine = m.parts.cylinder as THREE.Group;
  const work = engine.children.filter(c => c instanceof THREE.Group).at(-1) as THREE.Group;
  for (let gap = 40; gap <= 700; gap += 10) {
    for (const variant of ['engine', 'refrigerator']) {
      m.update({value: gap, variant, phase: 0.25, elapsed: 1});
      const share = variant === 'engine' ? carnotEfficiency(290 + gap, 290) : 1 / coolingLimit(290 + gap, 290);
      const expected = variant === 'engine' ? 10 * (1 - share) : 10 * (1 + share);
      // Ten units in on one duct; the other carries exactly what is left over.
      check(near(feed.scale.y, 10 * 0.05, 1e-9), `heat: feed duct wrong at ${gap}`);
      check(near(drain.scale.y, Math.max(0.06, expected * 0.05), 1e-9), `heat: drain duct wrong at ${gap}/${variant}`);
      // Nothing appears or vanishes: in plus work equals out, both ways round.
      const balance = variant === 'engine' ? 10 - share * 10 : 10 + share * 10;
      check(near(drain.scale.y / 0.05, balance, 1e-9), `heat: books do not balance at ${gap}/${variant}`);
      // Work out of an engine points up; work into a refrigerator points down.
      check(
        near(work.rotation.z, variant === 'engine' ? 0 : Math.PI, 1e-9),
        `heat: work arrow points the wrong way for a ${variant}`,
      );
    }
  }
}

// --------------------------------------------------------- nuclear power
{
  const m = buildNuclearPower();
  const control = m.parts.control as THREE.Group;
  const bank = control.children[0] as THREE.Group;
  const coolant = m.parts.coolant as THREE.Group;
  const CORE_HEIGHT = 2.6;
  const FLOOR = 0.5;
  for (let insertion = 0; insertion <= 100; insertion += 1) {
    for (const phase of phases) {
      m.update({value: insertion, variant: '', phase, elapsed: phase * 6});
      // The slider names penetration, so the rod feet have to be exactly that
      // far down the fuel: none of it at nothing, all of it at a hundred.
      const foot = bank.position.y;
      const wanted = FLOOR + CORE_HEIGHT * (1 - insertion / 100);
      check(near(foot, wanted, 1e-9), `nuclear: rods at ${foot.toFixed(3)} not ${wanted.toFixed(3)} at ${insertion}%`);
      // The neutron count follows the factor raised to the generations passed.
      const k = 1.02 - (insertion / 100) * 0.08;
      const alive = coolant.children.slice(10).filter(c => c.visible).length;
      const want = Math.max(0, Math.min(26, Math.round(9 * chainGrowth(k, 50 * phase))));
      check(alive === want, `nuclear: ${alive} neutrons drawn, ${want} expected at ${insertion}% phase ${phase}`);
    }
  }
  // Rods right in and the chain dies; right out and it grows.
  m.update({value: 100, variant: '', phase: 1, elapsed: 6});
  const dead = (m.parts.coolant as THREE.Group).children.slice(10).filter(c => c.visible).length;
  m.update({value: 0, variant: '', phase: 1, elapsed: 6});
  const alive = (m.parts.coolant as THREE.Group).children.slice(10).filter(c => c.visible).length;
  check(dead === 0, `nuclear: ${dead} neutrons left with the rods right in`);
  // The window is chosen so a full core fills the picture without overflowing
  // it, since a silent cap would stop reporting the growth.
  check(alive > 18 && alive < 26, `nuclear: ${alive} neutrons with the rods right out`);
}

// What a body floats in is the other half of floating: the same hull rides
// higher in brine and sinks in alcohol, and only the second slider can show it.
{
  const m = buildFloating();
  const hull = m.parts.hull as THREE.Group;
  let last = -Infinity;
  for (let fluid = 700; fluid <= 1300; fluid += 50) {
    m.update({value: 700, variant: '', phase: 0, elapsed: 0, extras: {fluid}});
    m.group.updateMatrixWorld(true);
    // A denser liquid holds the same hull higher, at every step of the slider.
    check(hull.position.y > last + 1e-9, `floating: a denser liquid did not lift the hull at ${fluid}`);
    last = hull.position.y;
    // And the draft is the ratio of the two densities: how deep it sits in its
    // own depth is how dense it is in the liquid's, measured the same way the
    // fresh water sweep above measures it.
    const keel = hull.position.y - 1.4 / 2;
    const under = Math.min(1, (2.3 - keel) / 1.4);
    check(near(under, Math.min(1, 700 / fluid), 1e-6), `floating: ${under.toFixed(4)} under, not ${(700 / fluid).toFixed(4)}, at ${fluid}`);
  }
  // A body denser than what it is in goes down whatever else is true.
  m.update({value: 1200, variant: '', phase: 1, elapsed: 0, extras: {fluid: 1000}});
  m.group.updateMatrixWorld(true);
  const sunk = hull.position.y;
  m.update({value: 1200, variant: '', phase: 1, elapsed: 0, extras: {fluid: 1300}});
  m.group.updateMatrixWorld(true);
  check(hull.position.y > sunk, 'floating: brine did not float what water sank');
}

// The other four second sliders of part two.
{
  // Lift goes with the square of the speed, and the arrow has to say so.
  const air = buildFlying();
  const forces = air.parts.forces as THREE.Group;
  const liftArrow = forces.children[0] as THREE.Group;
  const lengthOf = (holder: THREE.Group) =>
    (holder.children[0] as THREE.Mesh).scale.y + (holder.children[1] as THREE.Mesh).scale.y * 0.26;
  const at = (kph: number) => {
    air.update({value: 6, variant: 'clean', phase: 0, elapsed: 1, extras: {speed: kph}});
    air.group.updateMatrixWorld(true);
    return lengthOf(liftArrow);
  };
  const base = at(250);
  check(base > 0, 'flying: no lift arrow at all');
  check(near(at(500) / base, 4, 1e-6), `flying: doubling the speed gave ${(at(500) / base).toFixed(3)} of the lift, not four`);
  check(near(at(125) / base, 0.25, 1e-6), 'flying: halving the speed did not quarter the lift');

  // Both bores are drawn at the size the ratio is worked out from.
  const press = buildPressurePower();
  const MM = 0.011;
  const small = press.parts.small as THREE.Group;
  // The piston is the second mesh in the barrel, and it is the one the update
  // resizes; read its scale, which is the radius it is actually drawn at.
  const piston = small.children[1] as THREE.Mesh;
  check(piston instanceof THREE.Mesh, 'hydraulics: no small piston');
  for (const bore of [8, 20, 60]) {
    press.update({value: 100, variant: 'liquid', phase: 0.3, elapsed: 0, extras: {small: bore}});
    press.group.updateMatrixWorld(true);
    check(
      near(piston.scale.x, (bore / 2) * MM - 0.01, 1e-9),
      `hydraulics: the small piston is drawn at ${((piston.scale.x + 0.01) * 2 / MM).toFixed(1)} mm, asked ${bore}`,
    );
  }

  // Carnot is a ratio of two temperatures, and the cold one has to reach it.
  const heat = buildExploitingHeat();
  const shares: number[] = [];
  for (const cold of [250, 290, 420]) {
    heat.update({value: 300, variant: 'engine', phase: 0.5, elapsed: 1, extras: {cold}});
    heat.group.updateMatrixWorld(true);
    const work = new THREE.Box3().setFromObject(heat.parts.working as THREE.Group);
    shares.push(work.max.y - work.min.y);
  }
  check(shares[0] !== shares[1] && shares[1] !== shares[2], `heat: the cold side changes nothing, ${shares.map(v => v.toFixed(3)).join(' ')}`);

  // The rods can only take away what the fuel provides.
  const core = buildNuclearPower();
  const alive = (fuel: number, rods: number) => {
    core.update({value: rods, variant: '', phase: 1, elapsed: 2, extras: {fuel}});
    core.group.updateMatrixWorld(true);
    return (core.parts.coolant as THREE.Group).children.filter(node => node.visible).length;
  };
  // The neutrons are drawn from the chain, so livelier fuel has to leave more of
  // them alive, and the rods have to be able to take them away again.
  check(alive(108, 0) > alive(96, 0), 'nuclear: livelier fuel does not make more neutrons');
  check(alive(108, 100) < alive(108, 0), 'nuclear: the rods cannot damp the liveliest fuel');
}

console.log(failures === 0 ? 'BATCH 2 CLEAN' : `${failures} failures`);

if (failures) process.exitCode = 1;

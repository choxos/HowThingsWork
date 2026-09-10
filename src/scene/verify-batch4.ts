/* Throwaway check for the five benches of part 4. Not part of the app. */
import * as THREE from 'three';
import {buildElectricity} from './mechanisms/electricity.ts';
import {buildMagnetism} from './mechanisms/magnetism.ts';
import {buildElectricMotors} from './mechanisms/electric-motors.ts';
import {buildGeneratorsAndTransformers} from './mechanisms/generators-and-transformers.ts';
import {buildSensorsAndDetectors} from './mechanisms/sensors-and-detectors.ts';
import {
  compassDeflection,
  dividerVoltage,
  EARTH_FIELD,
  forceOnWire,
  inducedEmfPeak,
  ohmsCurrent,
  parallelResistance,
  rtdResistance,
  seebeckVoltage,
  solenoidAxisField,
  solenoidField,
  thermistorResistance,
  transformerVolts,
} from '../physics.ts';
import {controls} from '../studio-controls.ts';

import {ownershipFaults, strayParts} from './verify-shared.ts';
import type {TopicId} from '../topics.ts';

/** The topic id each bench in this batch belongs to. */
const idFor = (name: string): TopicId =>
  ({'electricity': 'electricity', 'magnetism': 'magnetism', 'electric motors': 'electric-motors', 'generators': 'generators-and-transformers', 'sensors': 'sensors-and-detectors', 'making bits': 'making-bits', 'storing bits': 'storing-bits', 'processing bits': 'processing-bits', 'sending bits': 'sending-bits', 'using bits': 'using-bits'} as Record<string, TopicId>)[name];

let failures = 0;
let looked = 0;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
function check(ok: boolean, message: string) {
  looked += 1;
  if (!ok) {
    failures += 1;
    console.log('FAIL ' + message);
  }
}
const phases = Array.from({length: 11}, (_, i) => i / 10);

/** The tip to tail length an arrow is actually drawing. */
function arrowLength(holder: THREE.Object3D): number {
  const shaft = holder.children[0] as THREE.Mesh;
  const head = holder.children[1] as THREE.Mesh;
  return shaft.scale.y + head.scale.y * 0.26;
}

// ------------------------------------------------------------ electricity
{
  const m = buildElectricity();
  const flow = m.parts.flow as THREE.Group;
  const lamp = m.parts.lamp as THREE.Group;
  // By name, not by position in the group: inserting a mesh must not silently
  // point this check at a different object.
  const glass = lamp.getObjectByName('glass') as THREE.Mesh;
  const filament = lamp.getObjectByName('filament') as THREE.Mesh;
  const halo = lamp.getObjectByName('halo') as THREE.Mesh;
  check(Boolean(glass && filament && halo), 'electricity: the lamp is missing one of its three lit parts');
  const brightness: number[] = [];
  // The loop's own bars: everything on the bench that is not the bed and not
  // one of the four named parts.
  const busBars = (m.group.children[1] as THREE.Group).children;
  for (let ohms = 2; ohms <= 40; ohms += 1) {
    for (const variant of ['single', 'parallel']) {
      for (const elapsed of [0, 0.7, 3.3, 11.9]) {
        m.update({value: ohms, variant, phase: 0, elapsed});
        m.group.updateMatrixWorld(true);
        const parallel = variant === 'parallel';
        const total = parallel ? parallelResistance([ohms, ohms]) : ohms;
        const current = ohmsCurrent(12, total);

        // Everything the current could be riding, as it stands this frame.
        const conductors: THREE.Box3[] = [];
        for (const part of [m.parts.supply, m.parts.resistor, m.parts.lamp] as THREE.Object3D[]) {
          part.traverse(node => {
            if (!(node instanceof THREE.Mesh) || !node.visible) return;
            conductors.push(new THREE.Box3().setFromObject(node).expandByScalar(0.09));
          });
        }
        for (const bar of busBars) conductors.push(new THREE.Box3().setFromObject(bar).expandByScalar(0.09));

        // Beads grouped by the conductor they ride: the loop, then each branch.
        const places: THREE.Vector3[][] = [];

        // Every bead sits on the loop, never off in space beside it. Depth
        // counts: a bead a whole unit in front of the board is nowhere near its
        // conductor and looks perfectly placed from straight on, so the two
        // families are separated and each is held to the plane it belongs in.
        const spot = new THREE.Vector3();
        flow.children.forEach((bead, index) => {
          if (!bead.visible) return;
          bead.getWorldPosition(spot);
          const onLeg =
            (near(spot.y, 0.75, 1e-6) || near(spot.y, 3.3, 1e-6) || near(spot.x, -3, 1e-6) || near(spot.x, 3, 1e-6)) &&
            spot.x >= -3.001 &&
            spot.x <= 3.001 &&
            spot.y >= 0.749 &&
            spot.y <= 3.301;
          check(onLeg, `electricity: a bead left the wire at ${ohms} ${variant}`);
          // On the wire in all three, not only in the two you happen to be
          // looking from. Every bead has to sit inside some conductor that is
          // actually drawn: a bead a unit in front of the board is nowhere near
          // its wire and looks perfectly placed from straight on.
          (places[index < 26 ? 0 : 1 + Math.floor((index - 26) / 3)] ??= []).push(spot.clone());
          check(
            conductors.some(bar => bar.containsPoint(spot)),
            `electricity: a bead at ${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${spot.z.toFixed(2)} is inside no conductor, at ${ohms} ${variant}`,
          );
        });

        // The same current passes everywhere on this bench, so the beads have to
        // be as far apart on a branch as on the loop. Measured against the loop's
        // own spacing rather than against a number typed here: a branch packed
        // tighter reads as a queue of touching balls rather than as a current,
        // and it says the branch is carrying more than it is.
        {
          const gap = (spots: THREE.Vector3[]) => {
            let least = Infinity;
            for (let i = 0; i < spots.length; i += 1) {
              for (let j = i + 1; j < spots.length; j += 1) {
                least = Math.min(least, spots[i].distanceTo(spots[j]));
              }
            }
            return least;
          };
          // Two streams passing near a junction may come close, and that is the
          // junction, not crowding. Each conductor is measured on its own.
          const onLoop = gap(places[0] ?? []);
          check(onLoop > 0.2, `electricity: the loop's own beads are only ${onLoop.toFixed(3)} apart`);
          for (let b = 1; b < places.length; b += 1) {
            const onBranch = gap(places[b] ?? []);
            check(
              onBranch > onLoop * 0.7,
              `electricity: a branch spaces its beads ${onBranch.toFixed(3)} where the loop spaces them ${onLoop.toFixed(3)}, at ${ohms} ${variant}`,
            );
          }
        }

        // The lamp answers to power, and power alone. All three of the things
        // that brighten read the same share of the full power, so the drawing
        // cannot disagree with itself about how bright the lamp is.
        const share = (12 * current) / 144;
        const glassMaterial = glass.material as THREE.MeshStandardMaterial;
        const filamentMaterial = filament.material as THREE.MeshStandardMaterial;
        const haloMaterial = halo.material as THREE.MeshBasicMaterial;
        check(
          near(filamentMaterial.emissiveIntensity, 3.4 * share, 1e-9),
          `electricity: the filament does not follow power at ${ohms} ${variant}`,
        );
        check(
          near(glassMaterial.emissiveIntensity, 0.55 * share, 1e-9) &&
            near(glassMaterial.opacity, 0.34 + 0.26 * share, 1e-9),
          `electricity: the envelope does not follow power at ${ohms} ${variant}`,
        );
        check(
          near(haloMaterial.opacity, 0.44 * share, 1e-9),
          `electricity: the throw of light does not follow power at ${ohms} ${variant}`,
        );
        // The bulb is always a bulb. A lamp turned right down that vanishes
        // altogether leaves the reader nothing to watch being dimmed.
        check(glassMaterial.opacity > 0.3, `electricity: the envelope faded away at ${ohms} ${variant}`);
        if (variant === 'single' && elapsed === 0) brightness.push(filamentMaterial.emissiveIntensity);
      }
    }
  }
  // The supply is a control too, and the lamp has to answer it. Power goes with
  // the square of the voltage, so halving the supply quarters the light: that
  // is the whole of what the second slider is for, and a bench that ignored it
  // would look exactly the same at every setting.
  {
    const litAt = (volts: number, ohms: number) => {
      m.update({value: ohms, variant: 'single', phase: 0, elapsed: 0, extras: {volts}});
      return (filament.material as THREE.MeshStandardMaterial).emissiveIntensity;
    };
    const full = litAt(12, 12);
    check(full > 0, 'electricity: the lamp is dark at the top of the supply');
    check(near(litAt(6, 12) / full, 0.25, 1e-9), 'electricity: halving the supply did not quarter the light');
    check(near(litAt(3, 12) / full, 1 / 16, 1e-9), 'electricity: the light does not follow the square of the supply');
    let last = 0;
    for (let volts = 3; volts <= 12; volts += 1) {
      const lit = litAt(volts, 12);
      check(lit > last + 1e-9, `electricity: the lamp did not brighten at ${volts} V`);
      last = lit;
    }
    // And the beads have to move faster on a bigger supply, because the current does.
    const bead = (m.parts.flow as THREE.Group).children[0];
    const advance = (volts: number) => {
      const at = new THREE.Vector3();
      m.update({value: 12, variant: 'single', phase: 0, elapsed: 0, extras: {volts}});
      m.group.updateMatrixWorld(true);
      const from = bead.getWorldPosition(at.clone());
      m.update({value: 12, variant: 'single', phase: 0, elapsed: 0.05, extras: {volts}});
      m.group.updateMatrixWorld(true);
      return bead.getWorldPosition(at).distanceTo(from);
    };
    check(near(advance(12) / advance(6), 2, 1e-6), 'electricity: the beads do not follow the supply');
  }

  // Turning the resistance up has to dim the lamp at every step, and the two
  // ends of the slider have to be as far apart as the power is: a fortieth of
  // the way down to a fiftieth is not a control anyone can see working.
  for (let i = 1; i < brightness.length; i += 1) {
    check(brightness[i] < brightness[i - 1], `electricity: the lamp did not dim between ${i + 1} and ${i + 2} ohms`);
  }
  check(
    near(brightness[0] / brightness[brightness.length - 1], 20, 1e-9),
    'electricity: the two ends of the slider are not twenty to one in brightness',
  );

  // Two branches in parallel really do draw twice the current of one, and the
  // beads have to show it. Read the beads rather than the arithmetic: over a
  // short enough step the chord a bead travels is its distance along the wire,
  // so the two variants can be compared where they both run straight.
  const beadAdvance = (variant: string) => {
    const bead = (m.parts.flow as THREE.Group).children[0];
    const at = new THREE.Vector3();
    m.update({value: 12, variant, phase: 0, elapsed: 0});
    m.group.updateMatrixWorld(true);
    const start = bead.getWorldPosition(at.clone());
    m.update({value: 12, variant, phase: 0, elapsed: 0.05});
    m.group.updateMatrixWorld(true);
    return bead.getWorldPosition(at).distanceTo(start);
  };
  const one = beadAdvance('single');
  const two = beadAdvance('parallel');
  check(one > 1e-4, 'electricity: the beads are not moving at all');
  check(near(two / one, 2, 1e-6), 'electricity: the beads do not show parallel branches drawing twice the current');
}

// -------------------------------------------------------------- magnetism
{
  const m = buildMagnetism();
  const compass = m.parts.compass as THREE.Group;
  const field = m.parts.field as THREE.Group;
  const needle = compass.children.find(node => node instanceof THREE.Group) as THREE.Group;
  const strength = compass.children[compass.children.length - 1] as THREE.Group;
  const MM = 0.02;
  const COMPASS_X = (200 * MM) / 2 + 1.6;
  let lastLines = 0;
  for (let amps = 0.2; amps <= 5.0001; amps += 0.1) {
    for (const variant of ['air', 'iron']) {
      m.update({value: amps, variant, phase: 0, elapsed: 0});
      m.group.updateMatrixWorld(true);
      const mu = variant === 'iron' ? 600 : 1;

      // The needle lies along the sum of the earth's field and the coil's, with
      // the coil's taken at the exact distance the compass is drawn at.
      const across = solenoidAxisField(400, 0.2, 0.026, amps, COMPASS_X / MM / 1000, mu);
      const wanted = -(compassDeflection(EARTH_FIELD, across) * Math.PI) / 180;
      check(near(needle.rotation.z, wanted, 1e-12), `magnetism: needle off the field at ${amps} ${variant}`);
      // Never past ninety degrees, which is where an infinite field would put it.
      check(Math.abs(needle.rotation.z) < Math.PI / 2, `magnetism: needle past the limit at ${amps} ${variant}`);

      // The arrow and the line count are both on the logarithm of the field, on
      // one scale shared by both cores, so an air core is drawn as something
      // rather than as nothing at all.
      const strengthT = solenoidField(400, 0.2, amps, mu);
      // The scale now spans both sliders: the fewest turns at the least current
      // in air, up to the most turns at the most current in iron.
      const faintest = solenoidField(80, 0.2, 0.2, 1);
      const decades = Math.log10(solenoidField(1200, 0.2, 5, 600) / faintest);
      const share = Math.min(1, Math.max(0, Math.log10(strengthT / faintest) / decades));
      check(near(arrowLength(strength), 0.25 + share * 1.5, 1e-6), `magnetism: field arrow wrong at ${amps} ${variant}`);
      check(strength.visible, `magnetism: the field arrow is invisible at ${amps} ${variant}`);

      // Line density stands for field strength, so it never falls as the field
      // rises, and it is always even so the picture stays symmetric.
      const lines = field.children.filter(node => node.visible).length;
      check(lines >= 4, `magnetism: too few field lines at ${amps} ${variant}`);
      check(lines % 2 === 0, `magnetism: ${lines} field lines cannot be drawn in pairs at ${amps} ${variant}`);
      if (variant === 'air') {
        check(lines >= lastLines, `magnetism: lines thinned out as the current rose at ${amps}`);
        lastLines = lines;
      }
    }
  }
  // The air core is not drawn with the same field as the iron one: the picture
  // has to change when the core does, or the variant means nothing.
  {
    const linesFor = (variant: string) => {
      m.update({value: 5, variant, phase: 0, elapsed: 0});
      return field.children.filter(node => node.visible).length;
    };
    check(linesFor('iron') > linesFor('air'), 'magnetism: iron draws no more field than air');
  }

  // The core is there only when it is asked for.
  m.update({value: 2, variant: 'air', phase: 0, elapsed: 0});
  check((m.parts.core as THREE.Group).visible === false, 'magnetism: an air core has iron in it');
  m.update({value: 2, variant: 'iron', phase: 0, elapsed: 0});
  check((m.parts.core as THREE.Group).visible === true, 'magnetism: the iron core went missing');
}

// -------------------------------------------------------- electric motors
{
  const m = buildElectricMotors();
  const forces = m.parts.forces as THREE.Group;
  const coil = m.parts.coil as THREE.Group;
  const near_ = forces.children[0] as THREE.Group;
  const far_ = forces.children[1] as THREE.Group;
  const twistBar = forces.children[2] as THREE.Mesh;
  const MM = 0.04;
  const HALF_W = (40 * MM) / 2;
  const FULL_FORCE = forceOnWire(0.6, 8, 0.06 * 50);
  const seenTwist: number[] = [];
  const twistRatios: number[] = [];
  const plainTwist: number[] = [];
  for (let amps = 0.5; amps <= 8.0001; amps += 0.1) {
    for (const variant of ['commutator', 'plain']) {
      for (const phase of phases) {
        m.update({value: amps, variant, phase, elapsed: phase * 4});
        m.group.updateMatrixWorld(true);

        // The two forces are equal, which is what makes the pair a pure couple.
        check(near(arrowLength(near_), arrowLength(far_), 1e-9), `motor: the two forces differ at ${amps} ${variant}`);
        const force = forceOnWire(0.25, amps, 0.06 * 50);
        check(
          near(arrowLength(near_), Math.max(0.02, force / FULL_FORCE * 1.35), 1e-6),
          `motor: arrow length does not follow the force at ${amps} ${variant}`,
        );

        // Each arrow sits on its own wire, which has turned with the coil.
        const angle = coil.rotation.z;
        check(near(near_.position.x, HALF_W * Math.cos(angle), 1e-9), `motor: near arrow off its wire at ${phase} ${variant}`);
        check(near(far_.position.x, -HALF_W * Math.cos(angle), 1e-9), `motor: far arrow off its wire at ${phase} ${variant}`);
        // They always point opposite ways: never both up, never both down.
        check(
          near(Math.abs(near_.rotation.z - far_.rotation.z), Math.PI, 1e-9),
          `motor: the two forces point the same way at ${phase} ${variant}`,
        );

        // With the commutator the twist never reverses; without it, it does.
        // Reading an absent bar as zero let a picture that drew no torque at
        // all pass for one that never reverses, so the bar is measured where it
        // stands rather than excused where it does not. The twist is the force
        // times its lever, and both of those are already on the bench: the
        // arrow is the force and the arrow's own x is the lever. So the ratio
        // between the bar and their product must be one number at every setting
        // and every angle, which says the bar is the torque without restating
        // the line that draws it.
        const lever = Math.cos(coil.rotation.z);
        const product = arrowLength(near_) * Math.abs(lever);
        if (product > 0.03) {
          check(twistBar.visible, `motor: the torque bar is missing at ${phase} ${variant}, force times lever ${product.toFixed(3)}`);
          twistRatios.push(twistBar.scale.x / product);
        }
        if (!twistBar.visible) continue;
        const drawn = twistBar.position.x;
        if (variant === 'commutator') {
          check(drawn >= -1e-9, `motor: commutated twist reversed at ${phase}`);
          seenTwist.push(drawn);
        } else {
          // Without the commutator the twist follows the lever's own sign, and
          // that reversal is the whole of what the variant is for.
          check(drawn * lever >= -1e-9, `motor: the plain twist does not follow its lever at ${phase}`);
          plainTwist.push(drawn);
        }
      }
    }
  }
  // The commutated bar must actually swing, and the plain one must actually
  // reverse: that reversal is the whole of what the variant is for, and nothing
  // above was looking at it.
  check(twistRatios.length > 500, `motor: only ${twistRatios.length} torque readings were taken`);
  check(
    Math.max(...twistRatios) - Math.min(...twistRatios) < 1e-9,
    `motor: the torque bar is not force times lever, ratios ${Math.min(...twistRatios).toFixed(6)} to ${Math.max(...twistRatios).toFixed(6)}`,
  );
  check(Math.max(...seenTwist) > 0.05, `motor: the commutated torque bar never grows, at most ${Math.max(...seenTwist).toFixed(4)}`);
  check(Math.min(...plainTwist) < -0.05, `motor: the plain torque bar never reverses, at least ${Math.min(...plainTwist).toFixed(4)}`);
  check(Math.max(...plainTwist) > 0.05, 'motor: the plain torque bar never turns the coil at all');

  // The shaft carries a split ring or two whole ones, and which of the two is
  // the whole of what the variant means. A picture that keeps the split ring on
  // the shaft while the words say the current is never reversed shows the
  // reader the opposite of what it is telling them.
  {
    const commutator = m.parts.commutator as THREE.Group;
    check(Boolean(commutator), 'motor: no commutator on the bench');
    const wheels = (variant: string) => {
      m.update({value: 4, variant, phase: 0, elapsed: 0});
      const rings = commutator.children.filter(
        node => node.visible && node instanceof THREE.Mesh && node.geometry instanceof THREE.CylinderGeometry &&
          (node.geometry as THREE.CylinderGeometry).parameters.radiusTop > 0.2,
      ) as THREE.Mesh<THREE.CylinderGeometry>[];
      return rings.map(ring => ring.geometry.parameters.thetaLength);
    };
    const split = wheels('commutator');
    check(split.length === 2 && split.every(arc => arc < Math.PI), `motor: the commutator setting shows ${split.length} pieces of ${split.map(a => a.toFixed(2))}`);
    const whole = wheels('plain');
    check(whole.length === 2 && whole.every(arc => arc > Math.PI * 1.99), `motor: the plain setting shows ${whole.length} pieces of ${whole.map(a => a.toFixed(2))}`);
  }

  // The two long sides must run along the shaft. A wire across the field and
  // along the axis is pushed sideways, which turns the coil; a wire lying the
  // other way is pushed along the shaft and turns nothing, and the picture would
  // look exactly the same.
  {
    const winding = coil.children[0] as THREE.Group;
    const longs = (winding.children as THREE.Mesh<THREE.BoxGeometry>[]).filter(
      piece => Math.abs(piece.position.x) > 0.01,
    );
    check(longs.length === 8, `motor: expected eight long sides, found ${longs.length}`);
    for (const side of longs) {
      const {width, height, depth} = side.geometry.parameters;
      check(depth > width && depth > height, 'motor: a long side of the coil does not run along the shaft');
    }
  }

  // Plain slip rings settle at the dead point rather than turning on.
  m.update({value: 3, variant: 'plain', phase: 1, elapsed: 0});
  check(Math.abs(coil.rotation.z - Math.PI / 2) < 0.06, 'motor: the plain coil did not settle at the dead point');
  m.update({value: 3, variant: 'commutator', phase: 1, elapsed: 0});
  check(near(coil.rotation.z, Math.PI * 2, 1e-9), 'motor: the commutated coil did not complete its turn');
}

// --------------------------------------------- generators and transformers
{
  const m = buildGeneratorsAndTransformers();
  const output = m.parts.output as THREE.Group;
  const traces = output.children[output.children.length - 1] as THREE.Group;
  const pieces = traces.children.filter(node => node instanceof THREE.Mesh) as THREE.Mesh[];
  // The rules come first, then the input trace, then the output trace.
  const height = (from: number, count: number) => {
    const slice = pieces.slice(from, from + count).filter(piece => piece.visible);
    const ys = slice.map(piece => piece.position.y);
    return (Math.max(...ys) - Math.min(...ys)) / 2;
  };
  const RULES = 2;
  const POINTS = 120;
  for (let turns = 50; turns <= 2000; turns += 50) {
    for (const variant of ['generator', 'transformer']) {
      m.update({value: turns, variant, phase: 0, elapsed: 0});
      m.group.updateMatrixWorld(true);
      const outHeight = height(RULES + POINTS, POINTS);
      if (variant === 'transformer') {
        const volts = transformerVolts(230, 1000, turns);
        const inHeight = height(RULES, POINTS);
        // Both traces on one scale, so their heights are in the turns ratio.
        check(inHeight > 0, `generator: the primary trace is flat at ${turns}`);
        check(
          Math.abs(outHeight / inHeight - volts / 230) < 0.02,
          `generator: secondary trace not at the turns ratio at ${turns}`,
        );
      } else {
        const peak = inducedEmfPeak(turns, 0.35, 0.008, 50);
        check(
          Math.abs(outHeight - peak / 2500) < 0.02,
          `generator: the output trace is not the voltage at ${turns}`,
        );
      }
      // Neither trace ever climbs into the row above it.
      check(outHeight < 1.6, `generator: the traces overlap at ${turns} ${variant}`);
    }
  }
  // Turning the coil has to change the flux through it. A coil spun about the
  // axis it faces along keeps its normal square to the field at every instant,
  // so nothing would generate however fast it turned, and the picture would give
  // no sign of it. Sample the face through a whole turn and insist it sweeps.
  {
    const coil = m.parts.coil as THREE.Group;
    const rotor = coil.children[0] as THREE.Group;
    const field = new THREE.Vector3(1, 0, 0);
    const normal = new THREE.Vector3();
    const along: number[] = [];
    for (let i = 0; i < 24; i += 1) {
      m.update({value: 500, variant: 'generator', phase: 0, elapsed: (i / 24) * (1 / 0.35)});
      m.group.updateMatrixWorld(true);
      normal.set(0, 0, 1).applyQuaternion(rotor.getWorldQuaternion(new THREE.Quaternion()));
      along.push(normal.dot(field));
    }
    const swing = Math.max(...along) - Math.min(...along);
    check(swing > 1.9, `generator: the coil's face barely sweeps the field, swing ${swing.toFixed(3)}`);

    // The two traces have to describe the coil that is actually turning. The
    // flux is the field through the face and the voltage is the rate that
    // changes, so at every instant the drawn flux must follow the face and the
    // drawn voltage must follow its derivative. Without this the coil can turn
    // correctly while both traces describe a different machine.
    const traces = (m.parts.output as THREE.Group).children[(m.parts.output as THREE.Group).children.length - 1] as THREE.Group;
    const pieces = traces.children.filter(node => node instanceof THREE.Mesh) as THREE.Mesh[];
    const edgeOf = (from: number, count: number) => {
      const slice = pieces.slice(from, from + count).filter(piece => piece.visible);
      const rightmost = slice.reduce((best, piece) => (piece.position.x > best.position.x ? piece : best), slice[0]);
      return rightmost.position.y;
    };
    for (let i = 0; i < 12; i += 1) {
      const elapsed = (i / 12) * (1 / 0.35);
      m.update({value: 500, variant: 'generator', phase: 0, elapsed});
      m.group.updateMatrixWorld(true);
      normal.set(0, 0, 1).applyQuaternion(rotor.getWorldQuaternion(new THREE.Quaternion()));
      const face = normal.dot(field);
      const fluxTrace = (edgeOf(2, 120) - 3.5) / 0.4;
      const voltTrace = (edgeOf(122, 120) - 1.9) / (inducedEmfPeak(500, 0.35, 0.008, 50) / 2500);
      check(Math.abs(fluxTrace - face) < 0.06, `generator: the flux trace disagrees with the coil at ${i}`);
      // The voltage is the rate the flux changes, a quarter turn ahead of it.
      const rate = Math.sin((i / 12) * Math.PI * 2);
      check(Math.abs(voltTrace - rate) < 0.06, `generator: the voltage trace is not the rate of change at ${i}`);
    }
  }

  // The slip rings have to be on the shaft the coil is on. Take the axis of
  // rotation from the coil's own motion rather than from any constant, then
  // insist each ring turns about that same axis and sits on it. A ring set
  // across the shaft looks like a slip ring and could not be one.
  {
    const coil = m.parts.coil as THREE.Group;
    const rotor = coil.children[0] as THREE.Group;
    const rings = (m.parts.output as THREE.Group).children[0] as THREE.Group;
    const quaternionAt = (elapsed: number) => {
      m.update({value: 500, variant: 'generator', phase: 0, elapsed});
      m.group.updateMatrixWorld(true);
      return rotor.getWorldQuaternion(new THREE.Quaternion());
    };
    const turned = quaternionAt(0.7).multiply(quaternionAt(0).invert());
    const axis = new THREE.Vector3(turned.x, turned.y, turned.z).normalize();
    check(axis.lengthSq() > 0.5, 'generator: the coil is not turning at all');
    const hub = rotor.getWorldPosition(new THREE.Vector3());
    const wheels = rings.children.filter(
      node => node instanceof THREE.Mesh && node.geometry instanceof THREE.CylinderGeometry &&
        (node.geometry as THREE.CylinderGeometry).parameters.radiusTop > 0.2,
    );
    check(wheels.length === 2, `generator: expected two slip rings, found ${wheels.length}`);
    for (const wheel of wheels) {
      const along = new THREE.Vector3(0, 1, 0).applyQuaternion(wheel.getWorldQuaternion(new THREE.Quaternion()));
      check(Math.abs(along.dot(axis)) > 0.999, 'generator: a slip ring is set across the shaft it should ride');
      const at = wheel.getWorldPosition(new THREE.Vector3()).sub(hub);
      const offAxis = at.clone().addScaledVector(axis, -at.dot(axis)).length();
      check(offAxis < 1e-6, `generator: a slip ring sits ${offAxis.toFixed(3)} off the shaft`);
    }
  }

  // A winding goes round the limb, in the window the iron leaves it. Every
  // turn has to clear both yokes: a turn whose wire runs through solid iron is
  // not a winding at all, and from the front it looks exactly like one. Measure
  // each turn's own bounding box against each yoke's, in world space, so the
  // check reads the geometry rather than the arithmetic that placed it.
  {
    m.update({value: 500, variant: 'transformer', phase: 0, elapsed: 0});
    m.group.updateMatrixWorld(true);
    const core = ((m.parts.field as THREE.Group).children[1]) as THREE.Group;
    // Two limbs, then two yokes: the yokes are the wide, flat pair.
    const yokes = core.children
      .map(node => new THREE.Box3().setFromObject(node))
      .filter(boxOf => boxOf.max.x - boxOf.min.x > boxOf.max.y - boxOf.min.y);
    check(yokes.length === 2, `transformer: expected two yokes, found ${yokes.length}`);
    const windings: [string, THREE.Group][] = [
      ['primary', (m.parts.coil as THREE.Group).children[1] as THREE.Group],
      ['secondary', (m.parts.output as THREE.Group).children[1] as THREE.Group],
    ];
    for (const [name, winding] of windings) {
      check(winding.children.length > 0, `transformer: the ${name} has no turns`);
      winding.children.forEach((node, i) => {
        const turn = new THREE.Box3().setFromObject(node);
        for (const yoke of yokes) {
          check(
            !turn.intersectsBox(yoke),
            `transformer: ${name} turn ${i} runs through a yoke`,
          );
        }
      });
    }
  }

  // Doubling the turns doubles the generated voltage, and the drawing with it.
  m.update({value: 500, variant: 'generator', phase: 0, elapsed: 0});
  const small = height(RULES + POINTS, POINTS);
  m.update({value: 1000, variant: 'generator', phase: 0, elapsed: 0});
  const large = height(RULES + POINTS, POINTS);
  check(Math.abs(large / small - 2) < 0.02, 'generator: doubling the turns did not double the wave');
}

// --------------------------------------------------- sensors and detectors
{
  const m = buildSensorsAndDetectors();
  const divider = m.parts.divider as THREE.Group;
  const meter = m.parts.meter as THREE.Group;
  const needle = meter.children[meter.children.length - 1] as THREE.Group;
  const upperBar = divider.children[divider.children.length - 3] as THREE.Mesh;
  const lowerBar = divider.children[divider.children.length - 2] as THREE.Mesh;
  const node = divider.children[divider.children.length - 1] as THREE.Mesh;
  // Three things about this bench that a picture hides completely.
  {
    const sensor = m.parts.sensor as THREE.Group;
    const reference = m.parts.reference as THREE.Group;
    m.update({value: 60, variant: 'thermocouple', phase: 0, elapsed: 0});
    m.group.updateMatrixWorld(true);
    // A thermocouple is a junction. Two legs leaning the wrong way meet in the
    // air above it and the junction hangs below touching neither, which looks
    // like a thermocouple and is not one.
    // Measured end to end, not box to box: a leaning bar has a wide upright
    // bounding box, and two legs leaning apart have boxes that overlap the
    // junction while the metal comes nowhere near it.
    const legs = (sensor.children[2] as THREE.Group).children;
    const tip = legs[2] as THREE.Mesh<THREE.SphereGeometry>;
    const tipAt = tip.getWorldPosition(new THREE.Vector3());
    const tipRadius = tip.geometry.parameters.radius;
    for (const leg of [legs[0], legs[1]] as THREE.Mesh<THREE.BoxGeometry>[]) {
      const half = leg.geometry.parameters.height / 2;
      const thickness = leg.geometry.parameters.width / 2;
      const ends = [half, -half].map(offset =>
        leg.localToWorld(new THREE.Vector3(0, offset, 0)).distanceTo(tipAt),
      );
      check(
        Math.min(...ends) <= tipRadius + thickness,
        `sensor: a thermocouple leg ends ${Math.min(...ends).toFixed(3)} from its junction, which is ${(tipRadius + thickness).toFixed(3)} across`,
      );
    }
    // The platinum turns are stacked closer together than one turn is wide, so
    // they have to lie across the direction they stack in or run through each
    // other. Lying in the plane they stack along, each turn passes through the
    // three above and below it.
    const turns = (sensor.children[1] as THREE.Group).children;
    check(turns.length > 4, `sensor: only ${turns.length} platinum turns`);
    for (let i = 1; i < turns.length; i += 1) {
      check(
        !new THREE.Box3().setFromObject(turns[i - 1]).intersectsBox(new THREE.Box3().setFromObject(turns[i])),
        `sensor: platinum turns ${i - 1} and ${i} run through each other`,
      );
    }
    // And the two bars that carry the reading must not be inside the heat
    // block. Most of a bar buried in solid metal is a reading nobody can take.
    for (const variant of ['thermistor', 'platinum']) {
      for (const celsius of [-20, 60, 200]) {
        m.update({value: celsius, variant, phase: 0, elapsed: 0});
        m.group.updateMatrixWorld(true);
        const blockBox = new THREE.Box3().setFromObject(reference.children[0]);
        for (const bar of [upperBar, lowerBar, node]) {
          if (!bar.visible) continue;
          check(
            !new THREE.Box3().setFromObject(bar).intersectsBox(blockBox),
            `sensor: a reading bar is inside the heat block at ${celsius} ${variant}`,
          );
        }
      }
    }
  }

  const SPAN = 4.2 - 0.5;
  for (let celsius = -20; celsius <= 200; celsius += 1) {
    for (const variant of ['thermistor', 'platinum', 'thermocouple']) {
      m.update({value: celsius, variant, phase: 0, elapsed: 0});
      m.group.updateMatrixWorld(true);
      if (variant === 'thermocouple') {
        // No divider at all, because the junction makes its own voltage.
        check(!lowerBar.visible && !upperBar.visible, `sensor: the thermocouple is using a divider at ${celsius}`);
        const volts = seebeckVoltage(41, celsius - 20);
        const coldest = seebeckVoltage(41, -40);
        const hottest = seebeckVoltage(41, 180);
        check(
          near(needle.rotation.z, -(2.2 * ((volts - coldest) / (hottest - coldest) - 0.5)), 1e-9),
          `sensor: thermocouple needle off its scale at ${celsius}`,
        );
        continue;
      }
      const ohms =
        variant === 'platinum'
          ? rtdResistance(100, 0.00385, celsius)
          : thermistorResistance(10000, 3950, celsius + 273.15);
      const fixed = variant === 'platinum' ? 120 : 10000;
      const share = dividerVoltage(5, fixed, ohms) / 5;

      // The two bars meet exactly at the node, and together they span the supply.
      const lowerTop = lowerBar.position.y + lowerBar.scale.y / 2;
      const upperBottom = upperBar.position.y - upperBar.scale.y / 2;
      check(near(lowerTop, upperBottom, 1e-6), `sensor: the bars do not meet at ${celsius} ${variant}`);
      check(near(lowerBar.scale.y + upperBar.scale.y, SPAN, 1e-6), `sensor: the bars do not span the supply at ${celsius} ${variant}`);
      check(near(node.position.y, 0.5 + share * SPAN, 1e-6), `sensor: the node is in the wrong place at ${celsius} ${variant}`);
      // The needle reads the same fraction the bars show.
      check(near(needle.rotation.z, -(2.2 * (share - 0.5)), 1e-9), `sensor: the needle disagrees with the divider at ${celsius} ${variant}`);
    }
  }
  // Warming a thermistor lowers its resistance, so its share of the supply falls.
  m.update({value: 0, variant: 'thermistor', phase: 0, elapsed: 0});
  const cold = lowerBar.scale.y;
  m.update({value: 100, variant: 'thermistor', phase: 0, elapsed: 0});
  check(lowerBar.scale.y < cold, 'sensor: warming the thermistor did not lower its share');
}

// --------------------------------------------------- invariants for all five
{
  const benches: [string, () => import('./kit.ts').Mechanism][] = [['electricity', buildElectricity], ['magnetism', buildMagnetism], ['electric motors', buildElectricMotors], ['generators', buildGeneratorsAndTransformers], ['sensors', buildSensorsAndDetectors]];
  for (const [name, build] of benches) {
    const bench = build();
    // A part inside another part cannot be isolated or hidden on its own.
    for (const fault of ownershipFaults(bench)) check(false, `${name}: ${fault}`);
    check(ownershipFaults(bench).length === 0, `${name}: parts own each other`);
    // Nothing wanders out of the frame at any setting the studio allows.
    for (const value of [controls[idFor(name)].min, controls[idFor(name)].initial, controls[idFor(name)].max]) {
      for (const option of controls[idFor(name)].variants?.options ?? [{id: ''}]) {
        for (const phase of [0, 0.37, 0.75]) {
          bench.update({value, variant: option.id, phase, elapsed: phase * 7});
          for (const fault of strayParts(bench, 9)) check(false, `${name}: ${fault} at ${value} ${option.id}`);
        }
      }
    }
  }
}

check(looked > 3000, `batch 4 only ran ${looked} checks, which is too few to mean anything`);

// The second sliders of part four.
{
  // The field is the turns per meter times the current, so winding more on has
  // to do exactly what turning the current up does.
  const mag = buildMagnetism();
  // The arrow beside the compass, which the sweep above already measures.
  const magCompass = mag.parts.compass as THREE.Group;
  const magArrow = magCompass.children[magCompass.children.length - 1] as THREE.Group;
  const fieldArrow = (turns: number, amps: number) => {
    mag.update({value: amps, variant: 'air', phase: 0, elapsed: 0, extras: {turns}});
    mag.group.updateMatrixWorld(true);
    return arrowLength(magArrow);
  };
  check(
    near(fieldArrow(800, 2), fieldArrow(400, 4), 1e-9),
    `magnetism: twice the turns is not twice the current, ${fieldArrow(800, 2).toFixed(4)} against ${fieldArrow(400, 4).toFixed(4)}`,
  );
  check(fieldArrow(1200, 2) > fieldArrow(80, 2), 'magnetism: more turns did not make more field');

  // The push on a wire is the field times the current, so the two sliders trade.
  const motor = buildElectricMotors();
  const forceAt = (field: number, amps: number) => {
    motor.update({value: amps, variant: 'commutator', phase: 0, elapsed: 0, extras: {field}});
    motor.group.updateMatrixWorld(true);
    return arrowLength((motor.parts.forces as THREE.Group).children[0] as THREE.Group);
  };
  check(near(forceAt(50, 2), forceAt(25, 4), 1e-9), 'motor: the magnet and the current do not trade');
  check(forceAt(60, 3) > forceAt(5, 3), 'motor: a stronger magnet did not push harder');

  // Doubling the rate doubles the voltage a coil makes.
  const gen = buildGeneratorsAndTransformers();
  const traceAt = (rate: number) => {
    gen.update({value: 500, variant: 'generator', phase: 0, elapsed: 0, extras: {rate}});
    gen.group.updateMatrixWorld(true);
    const traces = (gen.parts.output as THREE.Group).children[(gen.parts.output as THREE.Group).children.length - 1] as THREE.Group;
    const pieces = (traces.children.filter(node => node instanceof THREE.Mesh) as THREE.Mesh[]).slice(122, 242).filter(p => p.visible);
    const ys = pieces.map(p => p.position.y);
    return (Math.max(...ys) - Math.min(...ys)) / 2;
  };
  check(near(traceAt(100) / traceAt(50), 2, 0.02), `generator: doubling the rate gave ${(traceAt(100) / traceAt(50)).toFixed(3)} of the voltage`);

  // The fixed half decides where the reading sits: matched it sweeps, far off it pins.
  const sensor = buildSensorsAndDetectors();
  const barAt = (fixedShare: number) => {
    sensor.update({value: 60, variant: 'thermistor', phase: 0, elapsed: 0, extras: {fixed: fixedShare}});
    sensor.group.updateMatrixWorld(true);
    const divider = sensor.parts.divider as THREE.Group;
    return (divider.children[divider.children.length - 2] as THREE.Mesh).scale.y;
  };
  check(barAt(10) > barAt(100) && barAt(100) > barAt(1000), `sensor: the fixed half changes nothing, ${barAt(10)} ${barAt(100)} ${barAt(1000)}`);
}

console.log(failures === 0 ? 'BATCH 4 CLEAN' : `${failures} failures`);

if (failures) process.exitCode = 1;

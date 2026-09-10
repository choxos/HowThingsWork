import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, pool} from '../kit.ts';
import {ohmsCurrent, parallelResistance, electricalPower} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Electricity. A loop of bus bar with a supply at one end, a lamp at the top
// and a resistance at the other, and beads riding the wire to show the current.
//
// The lamp stands for the power the whole circuit turns into light and heat,
// which is the power the supply delivers. That is a deliberate simplification:
// a real lamp is a resistance in the loop with a share of the voltage across it,
// and this bench keeps the resistance on the slider and lets the lamp report.
//
// One thing here is deliberately not to scale, and it is the important one:
// the beads. Electrons in a wire carrying a few amps drift at well under a
// millimeter a second, so a bead moving at a true drift speed would sit
// motionless for the whole visit. The beads are drawn at a speed proportional
// to the current, which is the relation worth seeing, and the readout carries
// the real drift figure. Everything else, the loop, the branches and the
// brightness of the lamp, follows the arithmetic exactly.
//
// The lamp is drawn brightening in proportion to the power, on a scale fixed by
// the most this circuit can ever deliver: two branches of two ohms each, which
// is one ohm across twelve volts. So the dimmest setting on the slider really
// is a fortieth of the brightest, and looks it. Two things carry that: the
// filament, which goes from cold steel through dull red to nearly white, and
// the glass around it, which clouds with the light passing through it. A real
// filament brightens far more sharply than in proportion, roughly as the cube
// of the power and then some, and its color climbs with temperature for a
// physical reason this drawing only borrows. What is exact here is the ratio
// between one setting and another, and the watts in the readout.
// ---------------------------------------------------------------------------

/** The most the supply can be turned up to, which fixes the lamp's scale. */
const SUPPLY_VOLTS = 12;
const LEFT = -3;
const RIGHT = 3;
const BOTTOM = 0.75;
const TOP = 3.3;
/** How far apart the two branches sit when the second one is switched in. */
const BRANCH_Z = 0.5;
const BEADS = 26;
/** The straight run a branch gives its beads, between the two leads. */
const BRANCH_RUN = TOP - BOTTOM - 0.8;
/** Loops of the circuit a bead covers each second, for each amp of current. */
const LOOPS_PER_AMP = 0.09;
/**
 * The most power the lamp is drawn for, so its brightness has a fixed scale.
 * Two branches of the smallest resistance the slider offers is one ohm, and
 * nothing on this bench can draw more than that.
 */
const FULL_POWER = electricalPower(SUPPLY_VOLTS, ohmsCurrent(SUPPLY_VOLTS, 1));
/** A cold filament, and one at the top of the scale. */
const COLD = new THREE.Color(0x2a1109);
const HOT = new THREE.Color(0xfff2d2);

/** The four corners of the loop, and the distance round it. */
const CORNERS = [
  new THREE.Vector2(LEFT, BOTTOM),
  new THREE.Vector2(RIGHT, BOTTOM),
  new THREE.Vector2(RIGHT, TOP),
  new THREE.Vector2(LEFT, TOP),
];

const LEGS = CORNERS.map((corner, i) => {
  const next = CORNERS[(i + 1) % CORNERS.length];
  return {from: corner, to: next, length: corner.distanceTo(next)};
});
const PERIMETER = LEGS.reduce((total, leg) => total + leg.length, 0);
/**
 * Beads on a branch, counted so they sit as far apart as the beads on the loop.
 * The same current is passing, so the same density has to be drawn. Ten of them
 * over this run stood 0.175 apart with a diameter of 0.17, which reads as a
 * queue of touching balls rather than as a current.
 */
const BRANCH_BEADS = Math.max(2, Math.round(BRANCH_RUN / (PERIMETER / BEADS)));

/** A point at a given distance round the loop, measured from the bottom left corner. */
function aroundLoop(distance: number, into: THREE.Vector2) {
  let left = ((distance % PERIMETER) + PERIMETER) % PERIMETER;
  for (const leg of LEGS) {
    if (left <= leg.length) return into.lerpVectors(leg.from, leg.to, left / leg.length);
    left -= leg.length;
  }
  return into.copy(CORNERS[0]);
}

/** A straight bar of wire between two points in the plane of the board. */
function bar(parent: THREE.Object3D, from: THREE.Vector2, to: THREE.Vector2, z: number, tone: 'steel' | 'dark') {
  const length = from.distanceTo(to);
  const mesh = add(parent, new THREE.BoxGeometry(length, 0.09, 0.09), mat(tone));
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, z);
  mesh.rotation.z = Math.atan2(to.y - from.y, to.x - from.x);
  return mesh;
}

export function buildElectricity(): Mechanism {
  const group = new THREE.Group();

  const board = box(group, [RIGHT - LEFT + 1.6, 0.2, 2.6], 'deck');
  board.position.set(0, 0.1, 0);

  // The loop, stopping wherever a component takes over. Wire that ran straight
  // through the cell and the lamp would be a short circuit round both of them.
  const wiring = new THREE.Group();
  const CELL_HALF = 0.75;
  const LAMP_HALF = 0.24;
  bar(wiring, CORNERS[0], CORNERS[1], 0, 'steel');
  bar(wiring, new THREE.Vector2(LEFT, TOP), new THREE.Vector2(-LAMP_HALF, TOP), 0, 'steel');
  bar(wiring, new THREE.Vector2(LAMP_HALF, TOP), new THREE.Vector2(RIGHT, TOP), 0, 'steel');
  const MID = (BOTTOM + TOP) / 2;
  bar(wiring, new THREE.Vector2(LEFT, BOTTOM), new THREE.Vector2(LEFT, MID - CELL_HALF), 0, 'steel');
  bar(wiring, new THREE.Vector2(LEFT, MID + CELL_HALF), new THREE.Vector2(LEFT, TOP), 0, 'steel');
  group.add(wiring);

  const supply = new THREE.Group();
  const cell = box(supply, [0.5, 1.5, 0.7], 'dark');
  cell.position.set(LEFT, (BOTTOM + TOP) / 2, 0);
  for (const side of [-1, 1]) {
    const terminal = box(supply, [0.34, 0.12, 0.34], 'accent');
    terminal.position.set(LEFT, (BOTTOM + TOP) / 2 + side * 0.81, 0);
  }
  group.add(supply);

  // Two identical branches. The second is switched in only for the parallel case.
  const resistor = new THREE.Group();
  const branches = [-1, 1].map(side => {
    const branch = new THREE.Group();
    const z = (side * BRANCH_Z) / 2;
    const body = box(branch, [0.42, 1.1, 0.42], 'stone');
    body.position.set(RIGHT, (BOTTOM + TOP) / 2, z);
    // The current goes through the resistance, so it has to be seen going
    // through it. Left solid, the beads travel the whole branch and vanish for
    // most of it, which looks like beads bunching at each end of a block rather
    // than like charge passing through the thing that resists it.
    const bodyMaterial = body.material as THREE.MeshStandardMaterial;
    bodyMaterial.transparent = true;
    bodyMaterial.opacity = 0.55;
    bodyMaterial.depthWrite = false;
    for (const end of [-1, 1]) {
      const lead = cylinder(branch, 0.05, 0.72, 'steel', 10);
      lead.position.set(RIGHT, (BOTTOM + TOP) / 2 + end * 0.91, z);
    }
    // The link back to the corner post, so each branch is a complete path.
    const links = [-1, 1].map(end => {
      const y = end < 0 ? BOTTOM : TOP;
      const link = add(branch, new THREE.BoxGeometry(0.09, 0.09, Math.abs(z)), mat('steel'));
      link.position.set(RIGHT, y, z / 2);
      return link;
    });
    resistor.add(branch);
    return {branch, links, builtZ: z};
  });
  group.add(resistor);

  const lamp = new THREE.Group();
  // The envelope is drawn last of the three, so the filament inside it is not
  // sorted behind its own glass.
  const filament = cylinder(lamp, 0.03, 0.34, 'steel', 8);
  filament.name = 'filament';
  filament.position.set(0, TOP + 0.24, 0);
  const filamentMaterial = filament.material as THREE.MeshStandardMaterial;
  // The light the lamp throws, which is the part a reader sees from across the
  // room. It adds to whatever is behind it and writes no depth, so it reads as
  // light rather than as a ball of frosted plastic.
  const halo = add(lamp, new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshBasicMaterial({
    color: 0xffb774,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  halo.name = 'halo';
  halo.castShadow = false;
  halo.receiveShadow = false;
  halo.position.set(0, TOP + 0.34, 0);
  const haloMaterial = halo.material as THREE.MeshBasicMaterial;
  const glass = add(lamp, new THREE.SphereGeometry(0.42, 24, 16), mat('glass'));
  glass.name = 'glass';
  const glassMaterial = glass.material as THREE.MeshStandardMaterial;
  glassMaterial.transparent = true;
  glassMaterial.depthWrite = false;
  glass.castShadow = false;
  glass.position.set(0, TOP + 0.34, 0);
  const cap = cylinder(lamp, 0.2, 0.28, 'dark', 16);
  cap.position.set(0, TOP, 0);
  // The two terminals the top bus arrives at, so the lamp is in the loop rather
  // than bridged by a wire running past it.
  for (const side of [-1, 1]) {
    const terminal = box(lamp, [0.14, 0.12, 0.14], 'steel');
    terminal.position.set(side * 0.18, TOP, 0);
  }
  group.add(lamp);

  const flow = new THREE.Group();
  const beadGeometry = new THREE.SphereGeometry(0.085, 12, 8);
  const mainBeads = pool(BEADS, () => add(flow, beadGeometry, mat('accent')));
  const branchBeads = branches.map(() => pool(BRANCH_BEADS, () => add(flow, beadGeometry, mat('accent'))));
  group.add(flow);

  const at = new THREE.Vector2();
  const anchors = {
    supply: new THREE.Vector3(LEFT - 0.75, (BOTTOM + TOP) / 2, 0),
    resistor: new THREE.Vector3(RIGHT + 0.85, (BOTTOM + TOP) / 2, 0),
    lamp: new THREE.Vector3(0, TOP + 1.1, 0),
    flow: new THREE.Vector3(0, BOTTOM - 0.55, 0),
  };

  return {
    group,
    view: new THREE.Vector3(0.16, 0.22, 1).normalize(),
    parts: {supply, resistor, flow, lamp},
    anchors,
    update(state) {
      const {value, variant, elapsed} = state;
      // The supply is on a slider of its own now, so the bench is Ohm's law with
      // two of its three quantities in the reader's hands rather than one.
      const volts = dial(state, 'volts', SUPPLY_VOLTS);
      const parallel = variant === 'parallel';
      const total = parallel ? parallelResistance([value, value]) : value;
      const current = ohmsCurrent(volts, total);
      const power = electricalPower(volts, current);

      branches[1].branch.visible = parallel;
      // A single branch sits in the plane of the board; a pair straddles it.
      branches[0].branch.position.z = parallel ? 0 : BRANCH_Z / 2;
      // With one branch the leads meet the posts head on, so no link is needed.
      for (const link of branches[0].links) link.visible = parallel;

      // The lamp answers to power, not to current: that is what a load feels.
      // One share drives all three of the things that change, so they cannot
      // disagree about how bright the lamp is.
      const share = power / FULL_POWER;
      filamentMaterial.emissive.copy(COLD).lerp(HOT, share);
      filamentMaterial.emissiveIntensity = 3.4 * share;
      // The envelope carries a little of the light and clouds as it does, so
      // the lamp reads as lit rather than as a filament floating in clear air.
      glassMaterial.emissive.copy(HOT);
      glassMaterial.emissiveIntensity = 0.55 * share;
      // The envelope never fades out altogether: a lamp turned right down is
      // still a bulb, and a reader has to be able to see the thing being dimmed.
      glassMaterial.opacity = 0.34 + 0.26 * share;
      // The throw of light, which is what makes the difference visible at a
      // glance, and what makes the dim end read as genuinely dim. It stays
      // small enough to sit behind the glass rather than swallow it.
      haloMaterial.opacity = 0.44 * share;
      halo.scale.setScalar(0.62 + 0.4 * share);

      const traveled = elapsed * current * LOOPS_PER_AMP * PERIMETER;
      const shown = mainBeads.show(BEADS);
      for (let i = 0; i < shown; i += 1) {
        aroundLoop(traveled + (i * PERIMETER) / shown, at);
        // The right hand leg is made of the branches, so the loop has no beads
        // of its own there: the current has divided between them.
        const onBranch = at.x > RIGHT - 0.02 && at.y > BOTTOM + 0.02 && at.y < TOP - 0.02;
        mainBeads.items[i].visible = !onBranch;
        // In the conductor, not floating in front of it.
        mainBeads.items[i].position.set(at.x, at.y, 0);
      }

      // Each branch carries its own share, so with two of them the beads inside
      // one branch move at half the speed of the beads in the supply leg.
      const branchCurrent = parallel ? current / 2 : current;
      const runLength = BRANCH_RUN;
      for (let b = 0; b < branches.length; b += 1) {
        const beads = branchBeads[b];
        const count = beads.show(branches[b].branch.visible ? BRANCH_BEADS : 0);
        const z = branches[b].builtZ + branches[b].branch.position.z;
        const offset = ((elapsed * branchCurrent * LOOPS_PER_AMP * PERIMETER) % runLength) + runLength;
        for (let i = 0; i < count; i += 1) {
          const along = (offset + (i * runLength) / BRANCH_BEADS) % runLength;
          beads.items[i].position.set(RIGHT, BOTTOM + 0.4 + along, z);
        }
      }

      anchors.resistor.set(RIGHT + 0.85, (BOTTOM + TOP) / 2, parallel ? BRANCH_Z : BRANCH_Z / 2);
    },
  };
}

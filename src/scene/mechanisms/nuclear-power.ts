import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial} from '../kit.ts';
import {chainGrowth} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Nuclear power. A core of fuel rods with control rods driven down between
// them. Every neutron drawn stands for a population, and that population is
// the multiplication factor raised to the number of generations that have
// passed, which is the arithmetic the whole of reactor control is about.
// ---------------------------------------------------------------------------

const COLUMNS = 5;
const ROWS = 3;
const PITCH = 0.62;
const ROD_RADIUS = 0.14;
const CORE_HEIGHT = 2.6;
const FLOOR = 0.5;
/** The factor with the rods right out, and with them right in. */
/** What the fuel gives with the rods right out, before the second slider. */
const K_OPEN = 1.02;
const K_SHUT = 0.94;
/**
 * Generations the picture follows across one cycle. Chosen so the population
 * at the top of the slider fills the core without running past what can be
 * drawn, which would quietly stop reporting the growth.
 */
const GENERATIONS = 50;
/** Neutrons drawn at a steady reactor, and the most the picture will hold. */
const STEADY = 9;
const MOST = 26;

const gridX = (i: number) => (i - (COLUMNS - 1) / 2) * PITCH;
const gridZ = (j: number) => (j - (ROWS - 1) / 2) * PITCH;

export function buildNuclearPower(): Mechanism {
  const group = new THREE.Group();

  // The vessel and the concrete around it, drawn open at the front.
  const core = new THREE.Group();
  const base = cylinder(core, 2.5, 0.4, 'deck', 40);
  base.position.y = 0.2;
  const shield = add(core, new THREE.CylinderGeometry(2.4, 2.4, CORE_HEIGHT + 1.4, 40, 1, true), mat('stone'));
  shield.position.y = FLOOR + (CORE_HEIGHT + 1.4) / 2 - 0.4;
  (shield.material as THREE.MeshStandardMaterial).side = THREE.BackSide;
  const vessel = add(
    core,
    new THREE.CylinderGeometry(1.9, 1.9, CORE_HEIGHT + 0.8, 36, 1, true, Math.PI * 0.15, Math.PI * 1.7),
    mat('dark'),
  );
  vessel.position.y = FLOOR + (CORE_HEIGHT + 0.8) / 2 - 0.3;
  (vessel.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const plate = cylinder(core, 1.9, 0.16, 'dark', 36);
  plate.position.y = FLOOR - 0.08;
  group.add(core);

  const fuel = new THREE.Group();
  for (let i = 0; i < COLUMNS; i += 1) {
    for (let j = 0; j < ROWS; j += 1) {
      const rod = cylinder(fuel, ROD_RADIUS, CORE_HEIGHT, 'steel', 16);
      rod.position.set(gridX(i), FLOOR + CORE_HEIGHT / 2, gridZ(j));
    }
  }
  group.add(fuel);

  // Control rods drop into the gaps between the fuel, one fewer per row.
  const control = new THREE.Group();
  const bank = new THREE.Group();
  for (let i = 0; i < COLUMNS - 1; i += 1) {
    for (let j = 0; j < ROWS; j += 1) {
      const rod = cylinder(bank, ROD_RADIUS * 0.8, CORE_HEIGHT, 'accent', 12);
      rod.position.set(gridX(i) + PITCH / 2, CORE_HEIGHT / 2, gridZ(j));
    }
  }
  const yoke = box(bank, [COLUMNS * PITCH, 0.16, ROWS * PITCH], 'dark');
  yoke.position.y = CORE_HEIGHT + 0.08;
  control.add(bank);
  group.add(control);

  const coolant = new THREE.Group();
  const flowTone = new THREE.MeshStandardMaterial({color: 0x3f6f86, roughness: 0.2, metalness: 0.1});
  const streams = Array.from({length: 10}, () =>
    add(coolant, new THREE.SphereGeometry(0.075, 10, 8), flowTone.clone()),
  );
  const neutrons = Array.from({length: MOST}, () =>
    add(coolant, new THREE.SphereGeometry(0.06, 10, 8), mat('accent')),
  );
  group.add(coolant);

  const anchors = {
    fuel: new THREE.Vector3(0, FLOOR + CORE_HEIGHT + 0.5, 0),
    control: new THREE.Vector3(),
    coolant: new THREE.Vector3(1.5, FLOOR + CORE_HEIGHT * 0.6, 1.1),
    core: new THREE.Vector3(-2.1, FLOOR + CORE_HEIGHT + 0.9, 0),
  };

  return {
    group,
    view: new THREE.Vector3(-0.2, 0.3, 1).normalize(),
    parts: {fuel, control, coolant, core},
    anchors,
    update(state) {
      const {value, phase, elapsed} = state;
      const insertion = value / 100;
      // How lively the fuel is with the rods right out is the other half of
      // running a reactor: the rods can only take away what the fuel provides,
      // and a core that cannot be shut down by them is the thing to avoid.
      const open = dial(state, 'fuel', K_OPEN * 100) / 100;
      const k = open - insertion * (open - K_SHUT);
      // The percentage is penetration, not travel: at nothing the rod feet sit
      // level with the top of the fuel, at everything they reach the floor.
      const lift = FLOOR + CORE_HEIGHT * (1 - insertion);
      bank.position.y = lift;

      // The population after a cycle's worth of generations, drawn as neutrons.
      const grown = STEADY * chainGrowth(k, GENERATIONS * phase);
      const alive = Math.max(0, Math.min(MOST, Math.round(grown)));
      for (let i = 0; i < neutrons.length; i += 1) {
        neutrons[i].visible = i < alive;
        if (i >= alive) continue;
        // Each one darts about inside the core rather than following a path.
        const seed = i * 2.399963;
        const t = elapsed * 1.6 + seed;
        neutrons[i].position.set(
          Math.sin(t * 1.31 + seed) * (COLUMNS * PITCH) * 0.42,
          FLOOR + 0.3 + ((Math.sin(t * 0.97) + 1) / 2) * (CORE_HEIGHT - 0.6),
          Math.sin(t * 1.07 + seed * 2) * (ROWS * PITCH) * 0.36,
        );
      }

      // Coolant rises up the channels between the rods, starting at the floor
      // it is admitted through.
      for (let i = 0; i < streams.length; i += 1) {
        const lane = i % (COLUMNS - 1);
        const along = ((elapsed * 0.4 + i / streams.length) % 1) * CORE_HEIGHT;
        streams[i].position.set(
          gridX(lane) + PITCH / 2,
          FLOOR + along,
          gridZ(i < COLUMNS - 1 ? 0 : ROWS - 1) + PITCH / 2,
        );
      }

      anchors.control.set(0, lift + CORE_HEIGHT + 0.5, 0);
      anchors.fuel.set(-COLUMNS * PITCH * 0.5 - 0.4, FLOOR + CORE_HEIGHT * 0.5, 0.9);
    },
  };
}

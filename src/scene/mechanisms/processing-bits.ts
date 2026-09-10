import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, dial, pool} from '../kit.ts';
import {binaryString, lookaheadDelay, maxUnsigned, rippleCarryDelay} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Processing bits. Two rows of cells holding the numbers, a row of adder stages
// beneath them, the carry chain between the stages, and the sum below that.
//
// The numbers are not decoration. Each is a fixed fraction of the largest value
// the current width can hold, worked out and then written in binary by the same
// function the readout uses, so every lit cell is a real bit of a real number
// and the sum row is the real sum. When it will not fit, the carry out lights
// and the readout says so.
//
// The carry is animated at the model the readout reports. Ripple carry lights
// one stage every two gate delays, in order, because that is what a ripple
// carry does. Lookahead lights every stage at once after the delay of the tree.
// One gate delay is a nanosecond here, which no eye could follow, so the whole
// animation is slowed by a common factor: what is true is the ratio between the
// two, and between one width and another.
// ---------------------------------------------------------------------------

const MOST_BITS = 16;
const CELL = 0.42;
const GAP = 0.1;
const ROWS = {a: 3.9, b: 3.3, stage: 2.4, carry: 1.75, sum: 1.1};

/**
 * Where the cell for bit i sits. Index 0 is the most significant bit and it goes
 * on the left, the way a number is written, so the row reads left to right as
 * the binary in the readout does. Getting this backward draws a different number
 * from the one being added and nothing else in the picture gives it away.
 */
const cellX = (i: number, bits: number) => (i - (bits - 1) / 2) * (CELL + GAP);

export function buildProcessingBits(): Mechanism {
  const group = new THREE.Group();

  const bed = box(group, [MOST_BITS * (CELL + GAP) + 1.2, 0.24, 2.4], 'deck');
  bed.position.y = 0.12;

  const inputs = new THREE.Group();
  const rowA = pool(MOST_BITS, () => add(inputs, new THREE.BoxGeometry(CELL, CELL, 0.16), mat('dark')));
  const rowB = pool(MOST_BITS, () => add(inputs, new THREE.BoxGeometry(CELL, CELL, 0.16), mat('dark')));
  group.add(inputs);

  const gates = new THREE.Group();
  const stages = pool(MOST_BITS, () => add(gates, new THREE.BoxGeometry(CELL, 0.5, 0.3), mat('stone')));
  group.add(gates);

  const carry = new THREE.Group();
  const links = pool(MOST_BITS, () => add(carry, new THREE.BoxGeometry(CELL + GAP, 0.12, 0.12), mat('steel')));
  group.add(carry);

  const sum = new THREE.Group();
  const rowSum = pool(MOST_BITS + 1, () => add(sum, new THREE.BoxGeometry(CELL, CELL, 0.16), mat('dark')));
  group.add(sum);

  const anchors = {
    inputs: new THREE.Vector3(0, ROWS.a + 0.7, 0),
    gates: new THREE.Vector3(0, ROWS.stage, 0.8),
    carry: new THREE.Vector3(0, ROWS.carry - 0.5, 0.6),
    sum: new THREE.Vector3(0, ROWS.sum - 0.7, 0),
  };

  /** Light a cell for a one and leave it dark for a zero. */
  const setBit = (mesh: THREE.Mesh, on: boolean) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(on ? 0xf2905c : 0x171e25);
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.16, 1).normalize(),
    parts: {inputs, gates, carry, sum},
    anchors,
    update(state) {
      const {value, variant, phase} = state;
      // The second number being added. An adder's whole behaviour is in what it
      // is given: which cells light, how far the carry has to travel, and
      // whether the answer fits at all. Fixed at 45 percent of the largest, the
      // one thing an adder can do that nothing else can, overflow, could only
      // be reached by narrowing the word.
      const share = dial(state, 'addend', 45) / 100;
      const bits = Math.round(value);
      const largest = maxUnsigned(bits);
      // Two numbers that each fit the width, so the picture never claims the
      // machine is holding something it could not. Their sum often does not fit,
      // which is the point: that is where the carry out earns its cell.
      const a = Math.floor(largest * 0.6);
      const b = Math.min(largest, Math.round(largest * share));
      const total = a + b;
      const fits = total <= largest;
      const digitsA = binaryString(a, bits);
      const digitsB = binaryString(b, bits);
      const digitsSum = binaryString(fits ? total : total - largest - 1, bits);

      rowA.show(bits);
      rowB.show(bits);
      stages.show(bits);
      links.show(bits);
      rowSum.show(bits + 1);

      for (let i = 0; i < bits; i += 1) {
        const x = cellX(i, bits);
        rowA.items[i].position.set(x, ROWS.a, 0);
        rowB.items[i].position.set(x, ROWS.b, 0);
        setBit(rowA.items[i], digitsA[i] === '1');
        setBit(rowB.items[i], digitsB[i] === '1');
        stages.items[i].position.set(x, ROWS.stage, 0);
        // The link carries this stage's carry to the next one up in
        // significance, which is to its left, so the top bit sends nowhere.
        links.items[i].position.set(x - (CELL + GAP) / 2, ROWS.carry, 0);
        links.items[i].visible = i > 0;
        rowSum.items[i + 1].position.set(x, ROWS.sum, 0);
        setBit(rowSum.items[i + 1], digitsSum[i] === '1');
      }
      // The carry out sits one place beyond the most significant bit, which is
      // to the left of it, because that is where the next column would be.
      rowSum.items[0].position.set(cellX(0, bits) - (CELL + GAP), ROWS.sum, 0);
      setBit(rowSum.items[0], !fits);

      // The carry works its way along, or arrives everywhere at once.
      const gateDelay = 1e-9;
      const delay = variant === 'lookahead' ? lookaheadDelay(bits, gateDelay) : rippleCarryDelay(bits, gateDelay);
      // Both variants are drawn against the longest wait the bench can produce,
      // which is the slowest gate rippling across the widest word, so a faster
      // gate or a narrower word visibly finishes sooner rather than filling the
      // loop and looking the same as everything else.
      const longest = rippleCarryDelay(MOST_BITS, gateDelay);
      const settled = Math.min(1, (phase * longest) / delay);
      for (let i = 0; i < bits; i += 1) {
        // Index 0 is the most significant cell, so the carry starts at the far
        // right and works leftward: stage i is reached after bits - i of them.
        const reached = variant === 'lookahead' ? settled >= 1 : settled >= (bits - i) / bits;
        const material = links.items[i].material as THREE.MeshStandardMaterial;
        material.color.setHex(reached ? 0xf2905c : 0x9aa8b4);
        const stageMaterial = stages.items[i].material as THREE.MeshStandardMaterial;
        stageMaterial.color.setHex(reached ? 0x8a6f52 : 0x717d86);
      }

      anchors.gates.set(cellX(bits - 1, bits) + 0.9, ROWS.stage, 0.4);
      anchors.carry.set(0, ROWS.carry - 0.45, 0.5);
    },
  };
}

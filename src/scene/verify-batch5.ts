/* Throwaway check for the five benches of part 5. Not part of the app. */
/**
 * Where a drawn polyline actually sits at a given x. A chain of short boxes
 * carries no y as a property, so it has to be read back out of the one segment
 * that spans the x asked for. Null when nothing is drawn there.
 */
function heightAtOf(pieces: THREE.Mesh[], x: number): number | null {
  for (const piece of pieces) {
    const half = piece.scale.x / 2;
    const dx = Math.cos(piece.rotation.z) * half;
    const dy = Math.sin(piece.rotation.z) * half;
    const x0 = piece.position.x - dx;
    const x1 = piece.position.x + dx;
    const low = Math.min(x0, x1);
    const high = Math.max(x0, x1);
    if (x < low - 1e-9 || x > high + 1e-9) continue;
    if (Math.abs(x1 - x0) < 1e-12) return piece.position.y;
    const along = (x - x0) / (x1 - x0);
    return piece.position.y - dy + along * 2 * dy;
  }
  return null;
}
import * as THREE from 'three';
import {buildMakingBits} from './mechanisms/making-bits.ts';
import {buildStoringBits} from './mechanisms/storing-bits.ts';
import {buildProcessingBits} from './mechanisms/processing-bits.ts';
import {buildSendingBits} from './mechanisms/sending-bits.ts';
import {buildUsingBits} from './mechanisms/using-bits.ts';
import {
  aliasFrequency,
  aliasSigned,
  quantizationLevel,
  quantize,
  binaryString,
  frameBytes,
  maxUnsigned,
  nyquistRate,
  powerRatio,
  quantizationLevels,
  shannonCapacity,
} from '../physics.ts';
import {controls, trackCount} from '../studio-controls.ts';

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

// ------------------------------------------------------------ making bits
{
  const m = buildMakingBits();
  const samples = m.parts.samples as THREE.Group;
  const wave = m.parts.wave as THREE.Group;
  const levels = m.parts.levels as THREE.Group;
  const RUN = 6.6;
  const MID = 2.4;
  const HEIGHT = 1.35;
  const MOST = 96;
  for (let khz = 6; khz <= 96; khz += 1) {
    for (const variant of ['4', '8', '16']) {
      m.update({value: khz, variant, phase: 0, elapsed: 0});
      m.group.updateMatrixWorld(true);
      const bits = Number(variant);
      const count = Math.min(MOST, Math.round(khz * 1000 * 0.001));
      const dots = samples.children.filter(node => node.visible && node instanceof THREE.Mesh &&
        node.geometry instanceof THREE.SphereGeometry);
      check(dots.length === count, `making: ${dots.length} sample dots drawn for a rate of ${khz} thousand`);

      // Every stored value is one of the levels the depth allows, checked
      // against the ladder enumerated independently rather than against the
      // builder's own arithmetic, and the count of distinct values is the count
      // of levels and never one more.
      const ladder = Array.from({length: quantizationLevels(bits)}, (_, k) => quantizationLevel(k, bits));
      const used = new Set<number>();
      for (const dot of dots) {
        const level = (dot.position.y - MID) / HEIGHT;
        check(Math.abs(level) <= 1 + 1e-9, `making: a sample fell outside the range at ${khz} ${variant}`);
        check(
          ladder.some(rung => Math.abs(rung - level) < 1e-9),
          `making: a sample sits between levels at ${khz} ${variant}`,
        );
        used.add(Math.round(level * 1e9));
        check(dot.position.x >= -RUN / 2 - 1e-9 && dot.position.x <= RUN / 2 + 1e-9, `making: a sample left the window at ${khz}`);
      }
      check(used.size <= ladder.length, `making: ${used.size} distinct values for ${ladder.length} levels at ${khz} ${variant}`);

      // The drawn rules are the ladder, so a stored dot always lands on one.
      // Rules only: the pale band behind them is the same width and is not one.
      const ruleMeshes = levels.children.filter(node => node.visible && node instanceof THREE.Mesh &&
        node.geometry instanceof THREE.BoxGeometry && node.geometry.parameters.width === RUN &&
        node.geometry.parameters.height < 0.1) as THREE.Mesh[];
      for (const rule of ruleMeshes) {
        const level = (rule.position.y - MID) / HEIGHT;
        check(ladder.some(rung => Math.abs(rung - level) < 1e-9), `making: a rule is off the ladder at ${bits} bits`);
      }

      // The alias is drawn when, and only when, there is one to draw. Sampled at
      // exactly the tone or at half of it, the fold lands on zero: every sample
      // catches the same phase and what is stored is a constant, not a slower
      // tone, so there is no alias wave and the dots should all agree.
      const captured = khz * 1000 > nyquistRate(12000);
      const folded = aliasFrequency(12000, khz * 1000);
      const aliasPieces = (wave.children as THREE.Mesh[]).slice(260).filter(piece => piece.visible);
      check((captured || folded === 0) === (aliasPieces.length === 0), `making: alias drawn wrongly at ${khz} ${variant}`);

      // The alias has to pass through the samples, or it is not the wave they
      // describe. Measure the drawn line at each sample instant against the dot
      // that stands there, rather than merely noticing that a line exists.
      if (aliasPieces.length > 0) {
        const signed = aliasSigned(12000, khz * 1000);
        for (const dot of dots) {
          const seconds = ((dot.position.x + RUN / 2) / RUN) * 0.001;
          // The alias is the wave the samples describe, so rounding it must give
          // back the very value stored at that instant. Exact, not near: any
          // other alias frequency or sign fails this at once.
          const wanted = MID + quantize(Math.sin(seconds * signed * Math.PI * 2), bits) * HEIGHT;
          check(
            near(dot.position.y, wanted, 1e-9),
            `making: the alias misses a sample by ${(dot.position.y - wanted).toFixed(3)} at ${khz} ${variant}`,
          );
          // And the same of the line that is actually on the screen. Checking
          // the dots alone says nothing at all about the wave drawn through
          // them: the alias could be drawn at any frequency and the dots would
          // agree with themselves regardless.
          const drawnAt = heightAtOf(aliasPieces, dot.position.x);
          const onWave = MID + Math.sin(seconds * signed * Math.PI * 2) * HEIGHT;
          check(
            drawnAt !== null && Math.abs(drawnAt - onWave) < 0.02,
            `making: the drawn alias is at ${drawnAt === null ? 'nothing' : drawnAt.toFixed(3)}, not ${onWave.toFixed(3)}, at ${khz} ${variant}`,
          );
        }
      }
      if (!captured && folded === 0 && dots.length > 1) {
        const heights = dots.map(dot => dot.position.y);
        check(
          Math.max(...heights) - Math.min(...heights) < 1e-9,
          `making: sampling at the tone itself should store a constant, at ${khz} ${variant}`,
        );
      }

      // The ladder is drawn in full when it can be, and not at all when it cannot.
      const rules = ruleMeshes;
      const wanted = quantizationLevels(bits) <= 33 ? quantizationLevels(bits) : 0;
      check(rules.length === wanted, `making: ${rules.length} rules drawn for ${bits} bits, wanted ${wanted}`);
    }
  }
  // The fold keeps its sign, which is what makes the drawn wave meet the dots.
  check(aliasFrequency(12000, 16000) === 4000, 'making: the fold is not where it should be');
  check(aliasSigned(12000, 16000) === -4000, 'making: the fold lost its sign');
}

// ----------------------------------------------------------- storing bits
{
  const m = buildStoringBits();
  const tracks = m.parts.tracks as THREE.Group;
  const platter = m.parts.platter as THREE.Group;
  const head = m.parts.head as THREE.Group;
  const INNER = 15 * 0.08;
  const OUTER = 45 * 0.08;
  for (let density = 2; density <= 400; density += 2) {
    for (const variant of ['5400', '7200', '15000']) {
      for (const elapsed of [0, 1.4, 9.1]) {
        m.update({value: density, variant, phase: 0, elapsed});
        m.group.updateMatrixWorld(true);
        const real = trackCount(density);
        const rings = tracks.children.filter(node => node.visible && node instanceof THREE.Mesh &&
          node.geometry instanceof THREE.TorusGeometry);
        check(rings.length === Math.min(90, real), `storing: ${rings.length} rings for ${real} tracks`);
        // Every drawn ring lies inside the band, never off the platter, and no
        // two of them overlap in the plane the tracks occupy. Radius alone is
        // not enough: a ring drawn as wide as its neighbour's spacing is a
        // drawing of fewer tracks than it claims.
        const radii = (rings as THREE.Mesh<THREE.TorusGeometry>[]).map(ring => ring.geometry.parameters.radius);
        for (const ring of rings as THREE.Mesh<THREE.TorusGeometry>[]) {
          const radius = ring.geometry.parameters.radius;
          check(radius >= INNER - 1e-9 && radius <= OUTER + 1e-9, `storing: a ring left the band at ${density}`);
        }
        radii.sort((a, b) => a - b);
        const tube = (rings[0] as THREE.Mesh<THREE.TorusGeometry>).geometry.parameters.tube;
        for (let i = 1; i < radii.length; i += 1) {
          check(radii[i] - radii[i - 1] > 2 * tube - 1e-9, `storing: rings overlap at ${density}`);
        }
        // The platter and its tracks turn together, or the sectors would smear.
        check(near(platter.rotation.y, tracks.rotation.y, 1e-12), `storing: the tracks slipped on the platter at ${elapsed}`);
        // Faster spin means more turning in the same time, always.
        const arm = head.children[0] as THREE.Mesh;
        const reach = arm.position.x + (arm.scale.x * 2.8) / 2;
        check(near(reach, OUTER + 1.6, 1e-6), `storing: the arm does not reach its pivot at ${density}`);
      }
    }
  }
  // The drawing has to keep answering to the slider even after the ring count
  // reaches its limit, or the picture sits still while the numbers move.
  {
    let lastThin = Infinity;
    let coarsest = 0;
    for (let density = 2; density <= 400; density += 2) {
      m.update({value: density, variant: '7200', phase: 0, elapsed: 0});
      const ring = tracks.children.find(node => node.visible && node instanceof THREE.Mesh &&
        node.geometry instanceof THREE.TorusGeometry) as THREE.Mesh<THREE.TorusGeometry>;
      const thin = ring.geometry.parameters.tube;
      // Strictly narrower at every step. Allowing equality lets the picture
      // stand still for most of the slider and still pass: capping the density
      // the thickness is drawn from at 200 leaves every setting above it
      // identical, and the reader learns nothing by moving the control.
      check(
        density === 2 || thin < lastThin - 1e-9,
        `storing: the rings stopped thinning at ${density}, ${thin.toFixed(6)} against ${lastThin.toFixed(6)}`,
      );
      if (coarsest === 0) coarsest = thin;
      lastThin = thin;
    }
    // Each drawn ring stands for many real tracks once the count is capped, so
    // it cannot be drawn at the true single track width without vanishing. What
    // it must do is keep visibly narrowing across the whole slider.
    check(lastThin < coarsest / 3, `storing: the rings barely narrow, ${coarsest.toFixed(4)} to ${lastThin.toFixed(4)}`);
  }

  // Everything on this bench stands on the deck. A post ending in mid air
  // outside the bench holds nothing up, and from the front it looks like a post.
  {
    m.update({value: 200, variant: '7200', phase: 0, elapsed: 0});
    m.group.updateMatrixWorld(true);
    const deck = new THREE.Box3().setFromObject(m.group.children[0]);
    for (const part of Object.values(m.parts)) {
      part.traverse(node => {
        if (!(node instanceof THREE.Mesh) || !node.visible) return;
        const box = new THREE.Box3().setFromObject(node);
        // Only the things that reach down to the deck have to be over it.
        if (box.min.y > deck.max.y + 0.01) return;
        check(
          box.min.x > deck.min.x - 1e-6 && box.max.x < deck.max.x + 1e-6 &&
            box.min.z > deck.min.z - 1e-6 && box.max.z < deck.max.z + 1e-6,
          `storing: something standing on the deck reaches x ${box.min.x.toFixed(2)} to ${box.max.x.toFixed(2)}, past its edge at ${deck.max.x.toFixed(2)}`,
        );
      });
    }
  }

  const turnedAt = (rpm: string) => {
    m.update({value: 50, variant: rpm, phase: 0, elapsed: 1});
    return (m.parts.platter as THREE.Group).rotation.y;
  };
  check(near(turnedAt('15000') / turnedAt('5400'), 15000 / 5400, 1e-9), 'storing: the spin rates are not in true ratio');
}

// -------------------------------------------------------- processing bits
{
  const m = buildProcessingBits();
  const inputs = m.parts.inputs as THREE.Group;
  const sum = m.parts.sum as THREE.Group;
  const carry = m.parts.carry as THREE.Group;
  const lit = (mesh: THREE.Object3D) => ((mesh as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex() === 0xf2905c;
  for (let bits = 1; bits <= 16; bits += 1) {
    for (const variant of ['ripple', 'lookahead']) {
      for (const addend of [0, 20, 45, 80, 100]) {
        for (const phase of phases) {
        m.update({value: bits, variant, phase, elapsed: 0, extras: {addend}});
        m.group.updateMatrixWorld(true);
        const largest = maxUnsigned(bits);
        const a = Math.floor(largest * 0.6);
        const b = Math.min(largest, Math.round(largest * (addend / 100)));
        const total = a + b;
        const fits = total <= largest;

        // The cells hold the real numbers, written in binary by the same
        // function the readout uses.
        // Read the rows in the order they are actually drawn, left to right, so
        // a row laid out backward cannot pass by matching index for index.
        const byX = (nodes: THREE.Object3D[]) => [...nodes].sort((p, q) => p.position.x - q.position.x);
        const rowA = byX(inputs.children.slice(0, 16).filter(node => node.visible));
        const rowB = byX(inputs.children.slice(16, 32).filter(node => node.visible));
        check(rowA.length === bits && rowB.length === bits, `processing: wrong cell count at ${bits}`);
        const digitsA = binaryString(a, bits);
        const digitsB = binaryString(b, bits);
        for (let i = 0; i < bits; i += 1) {
          check(lit(rowA[i]) === (digitsA[i] === '1'), `processing: A bit ${i} wrong at ${bits}`);
          check(lit(rowB[i]) === (digitsB[i] === '1'), `processing: B bit ${i} wrong at ${bits}`);
        }
        // The sum row is the real sum, and the carry out says when it did not fit.
        const digitsSum = binaryString(fits ? total : total - largest - 1, bits);
        const rowSum = byX(sum.children.filter(node => node.visible));
        check(rowSum.length === bits + 1, `processing: wrong sum width at ${bits}`);
        check(lit(rowSum[0]) === !fits, `processing: the carry out is wrong at ${bits}`);
        for (let i = 0; i < bits; i += 1) {
          check(lit(rowSum[i + 1]) === (digitsSum[i] === '1'), `processing: sum bit ${i} wrong at ${bits}`);
        }
        // The carry never arrives at a stage before it has reached the one below.
        // The carry starts at the least significant end, which is drawn on the
        // right, and works leftward. Read the links in that order and insist
        // that no lit stage sits beyond an unlit one.
        const links = byX(carry.children.filter(node => node.visible));
        links.reverse();
        let seenUnreached = false;
        for (const link of links) {
          const reached = lit(link);
          if (!reached) seenUnreached = true;
          else check(!seenUnreached, `processing: the carry skipped a stage at ${bits} ${variant} ${phase}`);
        }
        }
      }
    }
  }
  // Lookahead settles sooner than ripple at every width past one bit.
  for (const bits of [4, 8, 16]) {
    // Measured on the stages, not the links: the top stage has no link out of
    // it, so a chain judged by links alone looks settled one stage early.
    const gates = m.parts.gates as THREE.Group;
    const reached = (mesh: THREE.Object3D) =>
      ((mesh as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex() === 0x8a6f52;
    const settledAt = (variant: string) => {
      for (const phase of phases) {
        m.update({value: bits, variant, phase, elapsed: 0});
        const stages = gates.children.filter(node => node.visible);
        if (stages.length === bits && stages.every(stage => reached(stage))) return phase;
      }
      return Infinity;
    };
    const fast = settledAt('lookahead');
    const slow = settledAt('ripple');
    // A carry that never settles is a failure, not a tie: without this the
    // whole comparison passes when neither variant ever completes.
    check(Number.isFinite(fast) && Number.isFinite(slow), `processing: a carry never settled at ${bits} bits`);
    check(fast < slow, `processing: lookahead was no faster at ${bits} bits`);
  }
}

// ----------------------------------------------------------- sending bits
{
  const m = buildSendingBits();
  const channel = m.parts.channel as THREE.Group;
  const signal = m.parts.signal as THREE.Group;
  const packets = m.parts.packets as THREE.Group;
  const band = signal.children[0] as THREE.Mesh;
  const RUN = 7;
  const FLOOR = 1;
  let widestSeen = 0;
  const seenWidth = new Map<string, number>();
  for (let db = 0; db <= 60; db += 1) {
    for (const variant of ['telephone', 'radio', 'fiber']) {
      for (const elapsed of [0, 2.2, 7.7]) {
        m.update({value: db, variant, phase: 0, elapsed});
        m.group.updateMatrixWorld(true);

        // The band stands above the floor by the decibels, on one scale.
        if (db > 1) check(near(band.position.y, FLOOR + db * 0.045, 1e-9), `sending: the band is not at ${db} dB`);

        // The pipe is wider for a wider channel, and both walls agree about it.
        const left = (channel.children[0] as THREE.Mesh).position.z;
        const right = (channel.children[1] as THREE.Mesh).position.z;
        check(near(left, -right, 1e-12), `sending: the channel is lopsided at ${variant}`);
        if (variant === 'fiber') widestSeen = right;
        seenWidth.set(variant, right);

        // And no block runs through the one in front of it. A stream of blocks
        // that overlap all the way down is a solid bar with seams drawn on it,
        // and it says the wrong thing about what is being carried.
        {
          const drawn = (packets.children as THREE.Mesh[])
            .filter(block => block.visible)
            .map(block => new THREE.Box3().setFromObject(block))
            .sort((a, b) => a.min.x - b.min.x);
          for (let i = 1; i < drawn.length; i += 1) {
            check(
              drawn[i].min.x > drawn[i - 1].max.x - 1e-9,
              `sending: two blocks overlap by ${(drawn[i - 1].max.x - drawn[i].min.x).toFixed(4)} at ${db} ${variant}`,
            );
          }
        }

        // Every block stays inside the channel it is traveling down.
        for (const block of packets.children) {
          if (!block.visible) continue;
          check(
            block.position.x >= -RUN / 2 - 1e-9 && block.position.x <= RUN / 2 + 1e-9,
            `sending: a block left the channel at ${db} ${variant}`,
          );
        }
      }
    }
  }
  check(widestSeen > 1, 'sending: the widest channel is not drawn wide');
  // Three channels, three widths, and each on the logarithm of its own
  // bandwidth. Symmetry and a wide fiber are satisfied by giving all three the
  // same width, which would make the choice of channel mean nothing.
  {
    const BANDWIDTHS: Record<string, number> = {telephone: 3100, radio: 2e5, fiber: 1e10};
    const telephone = seenWidth.get('telephone') ?? 0;
    const radio = seenWidth.get('radio') ?? 0;
    const fiber = seenWidth.get('fiber') ?? 0;
    check(telephone < radio && radio < fiber, `sending: the channels are not in bandwidth order, ${telephone}/${radio}/${fiber}`);
    // Where radio falls between the other two is fixed by the bandwidths and
    // nothing else, so this holds whatever widths the drawing chooses to spend.
    // A harness that restated the drawing's own two constants would agree with
    // any pair of them, including a pair that made all three channels alike.
    const wanted =
      (Math.log10(BANDWIDTHS.radio) - Math.log10(BANDWIDTHS.telephone)) /
      (Math.log10(BANDWIDTHS.fiber) - Math.log10(BANDWIDTHS.telephone));
    const drawnShare = (radio - telephone) / (fiber - telephone);
    check(
      near(drawnShare, wanted, 1e-9),
      `sending: radio sits ${drawnShare.toFixed(4)} of the way across, not ${wanted.toFixed(4)}`,
    );
  }
  // The capacity the bench works from is Shannon's, with decibels converted first.
  check(
    Math.abs(shannonCapacity(3100, powerRatio(30)) - 30898) < 2,
    'sending: the telephone limit is not where Shannon puts it',
  );
  // A channel with no signal above the noise carries nothing.
  m.update({value: 0, variant: 'telephone', phase: 0, elapsed: 0});
  check(near(shannonCapacity(3100, powerRatio(0)), 3100, 1e-9), 'sending: a one to one ratio should give one bit per hertz');
}

// ------------------------------------------------------------- using bits
{
  const m = buildUsingBits();
  const grid = m.parts.grid as THREE.Group;
  const depth = m.parts.depth as THREE.Group;
  const data = m.parts.data as THREE.Group;
  const bar = data.children[1] as THREE.Mesh;
  const PANEL_W = 4.2;
  const PANEL_H = (PANEL_W * 9) / 16;
  const PANEL_Y = 2.6;
  let lastSize = 0;
  let lastBar = 0;
  let lastColumns = 0;
  for (let across = 160; across <= 3840; across += 160) {
    for (const variant of ['2', '8', '10']) {
      m.update({value: across, variant, phase: 0, elapsed: 0});
      m.group.updateMatrixWorld(true);
      const bits = Number(variant);
      const down = Math.round((across * 9) / 16);

      // The panel shows one fortieth of the picture, so the rules really are the
      // pixel boundaries at the size asked for, and they keep answering to the
      // slider instead of sitting at the drawing limit the whole way along.
      const columns = grid.children.slice(1, 97).filter(node => node.visible);
      const inPatch = Math.max(1, Math.round(across / 40));
      // N pixels across the patch means N minus one boundaries inside it. The
      // count alone is not the claim: they have to fall at the multiples of one
      // over N, or the panel is ruled into cells of some other size than the
      // pixels the slider names.
      const cells = Math.min(97, inPatch);
      check(columns.length === cells - 1, `using: ${columns.length} rules for ${cells} pixels at ${across}`);
      const across_ = [...columns].sort((a, b) => a.position.x - b.position.x);
      across_.forEach((column, i) => {
        const wanted = -PANEL_W / 2 + ((i + 1) / cells) * PANEL_W;
        check(
          near(column.position.x, wanted, 1e-9),
          `using: rule ${i} is at ${column.position.x.toFixed(4)}, not ${wanted.toFixed(4)}, at ${across}`,
        );
      });
      const rows = grid.children.slice(97).filter(node => node.visible);
      const down_ = [...rows].sort((a, b) => a.position.y - b.position.y);
      const downCells = down_.length + 1;
      down_.forEach((row, i) => {
        const wanted = PANEL_Y - PANEL_H / 2 + ((i + 1) / downCells) * PANEL_H;
        check(near(row.position.y, wanted, 1e-9), `using: a row rule is off its multiple at ${across}`);
      });

      // The ramp is the same 64 strips at every depth, covering it exactly with
      // no gap and no overlap, running from black at one end to white at the
      // other, and holding exactly as many distinct grays as the depth allows.
      const bands = depth.children.filter(node => node.visible) as THREE.Mesh[];
      const steps = quantizationLevels(bits);
      check(bands.length === 64, `using: ${bands.length} bands drawn at ${bits} bits`);
      const width = PANEL_W / bands.length;
      const grays = new Set<number>();
      for (let i = 0; i < bands.length; i += 1) {
        check(near(bands[i].scale.x, width, 1e-9), `using: band ${i} is the wrong width at ${bits} bits`);
        check(near(bands[i].position.x, -PANEL_W / 2 + (i + 0.5) * width, 1e-9), `using: band ${i} is misplaced at ${bits} bits`);
        const tone = (bands[i].material as THREE.MeshStandardMaterial).color.r;
        grays.add(Math.round(tone * 1e6));
      }
      const ends = bands.map(band => (band.material as THREE.MeshStandardMaterial).color.r);
      check(near(ends[0], 0, 1e-9), `using: the ramp does not start at black at ${bits} bits`);
      check(near(ends[ends.length - 1], 1, 1e-9), `using: the ramp does not end at white at ${bits} bits`);
      check(grays.size === Math.min(64, steps), `using: ${grays.size} distinct grays for ${steps} levels`);

      // The grid gets finer as the picture does, at every step of the slider.
      if (variant === '8') {
        check(columns.length > lastColumns, `using: the grid stopped answering to the slider at ${across}`);
        lastColumns = columns.length;
      }

      // The data bar never runs off its rail, and never shrinks as the frame grows.
      const size = frameBytes(across * down, bits * 3);
      check(bar.scale.x <= 4.2 + 1e-9, `using: the data bar overran its rail at ${across} ${variant}`);
      // The bar has to grow with the frame, not merely be present: a bar wired
      // backward is still a positive length at every setting.
      if (variant === '8') {
        if (lastSize > 0) check(bar.scale.x > lastBar, `using: the data bar did not grow at ${across}`);
        lastSize = size;
        lastBar = bar.scale.x;
      }
    }
  }
}

// --------------------------------------------------- invariants for all five
{
  const benches: [string, () => import('./kit.ts').Mechanism][] = [['making bits', buildMakingBits], ['storing bits', buildStoringBits], ['processing bits', buildProcessingBits], ['sending bits', buildSendingBits], ['using bits', buildUsingBits]];
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

check(looked > 8000, `batch 5 only ran ${looked} checks, which is too few to mean anything`);

// The second sliders of part five.
{
  // Aliasing is the tone against the rate, so the tone has to be reachable: the
  // same rate catches one tone and folds another.
  const bits = buildMakingBits();
  const aliasDrawn = (tone: number, khz: number) => {
    bits.update({value: khz, variant: '8', phase: 0, elapsed: 0, extras: {tone}});
    bits.group.updateMatrixWorld(true);
    const wave = bits.parts.wave as THREE.Group;
    return (wave.children as THREE.Mesh[]).slice(260).filter(piece => piece.visible).length > 0;
  };
  check(!aliasDrawn(5, 44), 'making: a 5 kHz tone at 44 thousand a second should not fold');
  check(aliasDrawn(40, 44), 'making: a 40 kHz tone at 44 thousand a second must fold');
  // The same tone at two rates: caught at one, folded at the other. Sampled at
  // exactly a divisor of the tone the fold lands on zero and there is no alias
  // wave to draw, which is why 6 is not the rate to test this with.
  check(aliasDrawn(12, 20) && !aliasDrawn(12, 44), 'making: the same tone behaved the same at both rates');

  // A wider band of tracks is more tracks and a wider ring of them on the disc.
  const disc = buildStoringBits();
  const outermost = (band: number) => {
    disc.update({value: 50, variant: '7200', phase: 0, elapsed: 0, extras: {band}});
    disc.group.updateMatrixWorld(true);
    const rings = (disc.parts.tracks as THREE.Group).children.filter(
      node => node.visible && node instanceof THREE.Mesh && node.geometry instanceof THREE.TorusGeometry,
    ) as THREE.Mesh<THREE.TorusGeometry>[];
    return Math.max(...rings.map(ring => ring.geometry.parameters.radius));
  };
  check(outermost(5) < outermost(30) && outermost(30) < outermost(60), `storing: the band does not widen, ${outermost(5)} ${outermost(30)} ${outermost(60)}`);

  // What the adder is given is what it does: the cells, the carry and whether
  // the answer fits at all.
  const adder = buildProcessingBits();
  const sumOf = (addend: number) => {
    adder.update({value: 8, variant: 'ripple', phase: 1, elapsed: 0, extras: {addend}});
    adder.group.updateMatrixWorld(true);
    const rows = adder.parts.sum as THREE.Group;
    return rows.children.filter(node => node.visible &&
      ((node as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex() === 0xf2905c).length;
  };
  check(sumOf(0) !== sumOf(45) || sumOf(45) !== sumOf(100), 'processing: the second number changes nothing');
  // Adding nothing leaves the first number alone, and its bits are the ones lit.
  check(sumOf(0) === 4, `processing: adding nothing gave ${sumOf(0)} lit bits, not the four of 153`);

  // Taking a narrower slice of the same channel narrows the pipe drawn for it.
  const link = buildSendingBits();
  const wide = (share: number) => {
    link.update({value: 30, variant: 'radio', phase: 0, elapsed: 0, extras: {share}});
    link.group.updateMatrixWorld(true);
    return ((link.parts.channel as THREE.Group).children[1] as THREE.Mesh).position.z;
  };
  check(wide(10) < wide(50) && wide(50) < wide(100), `sending: the share of the band does not narrow the pipe, ${wide(10)} ${wide(50)} ${wide(100)}`);

  // The stream is the frame times how many a second, so the bar has to grow.
  const panel = buildUsingBits();
  const barAt = (fps: number) => {
    panel.update({value: 1920, variant: '8', phase: 0, elapsed: 0, extras: {fps}});
    panel.group.updateMatrixWorld(true);
    // The second mesh is the bar; the first is the track it runs along.
    return ((panel.parts.data as THREE.Group).children[1] as THREE.Mesh).scale.x;
  };
  check(barAt(24) < barAt(60) && barAt(60) < barAt(120), `using: the frame rate does not change the stream, ${barAt(24)} ${barAt(60)} ${barAt(120)}`);
}

console.log(failures === 0 ? 'BATCH 5 CLEAN' : `${failures} failures`);

if (failures) process.exitCode = 1;

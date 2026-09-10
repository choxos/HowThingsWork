import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, dial, polyline, pool, TAU} from '../kit.ts';
import {powerRatio, shannonCapacity} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Sending bits. A channel running left to right, drawn as wide as its bandwidth
// and carrying blocks of data at a rate set by its capacity, over a noise floor
// the signal has to stand clear of.
//
// Two things here are logarithmic, and both have to be, because the three
// channels differ by six decades of bandwidth and their capacities by eight.
// The width of the channel is the logarithm of its bandwidth, and the rate the
// blocks travel is the logarithm of the capacity. Neither is a linear picture
// of the number beside it, and the readout carries the real figures. A linear
// drawing would make the telephone line invisible next to the fiber, which
// would teach the reader less than the honest compression does.
//
// What is exactly true: the signal band sits above the noise floor by the ratio
// on the slider, drawn in decibels, which is a logarithmic scale by its own
// definition and so is no compression at all. And the capacity itself is
// Shannon's formula with the ratio converted from decibels to a power ratio
// before it goes into the logarithm, which is the one place this is easy to get
// wrong.
// ---------------------------------------------------------------------------

const RUN = 7;
const FLOOR_Y = 1;
/** Scene units per decibel, for the height of the signal band above the floor. */
const UNITS_PER_DB = 0.045;
const BLOCKS = 14;
/** The longest a block may be drawn without running into the one behind it. */
const LONGEST_BLOCK = (0.9 * RUN) / (0.34 * (BLOCKS + 1));
const POINTS = 140;
/** The channels, and the widest and narrowest the pipe is ever drawn. */
const BANDWIDTHS: Record<string, number> = {telephone: 3100, radio: 2e5, fiber: 1e10};
const NARROWEST = 0.25;
const WIDEST = 2.2;

export function buildSendingBits(): Mechanism {
  const group = new THREE.Group();

  const bed = box(group, [RUN + 1.4, 0.24, 3], 'deck');
  bed.position.y = 0.12;

  const noise = new THREE.Group();
  const floor = box(noise, [RUN, 0.06, 0.06], 'dark');
  floor.position.set(0, FLOOR_Y, 0);
  // The floor is not flat: it is drawn as the rough, always present hash it is.
  const hash = polyline(noise, 'stone', POINTS, 0.035);
  group.add(noise);

  const channel = new THREE.Group();
  const walls = [-1, 1].map(side => {
    const wall = box(channel, [RUN, 0.05, 0.05], 'steel');
    wall.position.set(0, FLOOR_Y, side);
    return wall;
  });
  const mouth = [-1, 1].map(end => {
    const post = box(channel, [0.12, 1, 0.12], 'dark');
    post.position.set((end * RUN) / 2, FLOOR_Y + 0.5, 0);
    return post;
  });
  group.add(channel);

  const signal = new THREE.Group();
  const band = box(signal, [RUN, 0.1, 1], 'accent');
  const level = box(signal, [RUN, 0.05, 0.05], 'accent');
  group.add(signal);

  const packets = new THREE.Group();
  const blocks = pool(BLOCKS, () => add(packets, new THREE.BoxGeometry(0.34, 0.24, 0.24), mat('steel')));
  group.add(packets);

  const noisePoints = Array.from({length: POINTS + 1}, () => new THREE.Vector2());

  const anchors = {
    channel: new THREE.Vector3(0, FLOOR_Y + 1.9, 0),
    signal: new THREE.Vector3(-RUN / 2 - 0.6, FLOOR_Y + 1, 0),
    noise: new THREE.Vector3(RUN / 2 + 0.6, FLOOR_Y - 0.4, 0),
    packets: new THREE.Vector3(0, FLOOR_Y - 0.7, 0),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.3, 1).normalize(),
    parts: {channel, signal, noise, packets},
    anchors,
    reach: 4.6,
    update(state) {
      const {value, variant, elapsed} = state;
      // A link rarely gets the whole of a channel. Capacity goes straight with
      // the bandwidth actually used, so taking a narrower slice of the same
      // channel costs exactly that share, which is a different question from
      // how clean the signal is.
      const share = dial(state, 'share', 100) / 100;
      const bandwidth = (BANDWIDTHS[variant] ?? BANDWIDTHS.telephone) * share;
      const capacity = shannonCapacity(bandwidth, powerRatio(value));

      // The width of the pipe is the logarithm of the bandwidth, mapped so that
      // the narrowest channel here is a quarter unit and the widest is 2.2.
      const widthShare =
        (Math.log10(bandwidth) - Math.log10(BANDWIDTHS.telephone * 0.1)) /
        (Math.log10(BANDWIDTHS.fiber) - Math.log10(BANDWIDTHS.telephone * 0.1));
      const halfWidth = (NARROWEST + widthShare * (WIDEST - NARROWEST)) / 2;
      walls[0].position.z = -halfWidth;
      walls[1].position.z = halfWidth;
      for (const post of mouth) post.scale.z = (halfWidth * 2) / 0.12;

      // The signal band stands above the floor by the decibels on the slider, on
      // a scale that is the same at every setting.
      const height = value * UNITS_PER_DB;
      band.scale.set(1, 1, halfWidth * 2);
      band.position.set(0, FLOOR_Y + height, 0);
      level.position.set(0, FLOOR_Y + height + 0.1, 0);
      // At nought decibels the signal equals the noise, which is a real state
      // with a real capacity, so the band sits on the floor rather than vanishing.
      band.visible = true;
      level.visible = true;

      // Noise, drawn as a rough line at the floor. It never goes away, which is
      // the whole reason there is a limit at all.
      for (let i = 0; i <= POINTS; i += 1) {
        const t = i / POINTS;
        const jitter =
          Math.sin((t * 37 + elapsed * 2.1) * TAU) * 0.5 + Math.sin((t * 91 - elapsed * 1.3) * TAU) * 0.5;
        noisePoints[i].set(-RUN / 2 + t * RUN, FLOOR_Y + jitter * 0.07);
      }
      hash(noisePoints);

      // The blocks move at the logarithm of the capacity, because the capacities
      // across these three channels span eight decades and no linear rate could
      // show both ends. The readout carries the real figure.
      const speed = capacity > 1 ? Math.log10(capacity) * 0.16 : 0;
      const shown = blocks.show(BLOCKS);
      for (let i = 0; i < shown; i += 1) {
        // A block can be no longer than the space between one block and the
        // next, or the stream is a solid bar with seams in it. Fourteen blocks
        // over the run leaves this much, with a tenth kept back as a gap.
        const size = Math.max(0.4, Math.min(LONGEST_BLOCK, halfWidth * 1.4));
        // A block turns round when its far face reaches the end, not when its
        // middle does, so nothing ever hangs out of the channel it travels in.
        const halfBlock = (0.34 * size) / 2;
        const travel = RUN - 2 * halfBlock;
        const along = ((elapsed * speed + i / BLOCKS) % 1) * travel;
        blocks.items[i].position.set(-RUN / 2 + halfBlock + along, FLOOR_Y + Math.max(0.2, height / 2), 0);
        blocks.items[i].scale.setScalar(size);
      }

      anchors.signal.set(-RUN / 2 - 0.6, FLOOR_Y + height + 0.4, 0);
      anchors.channel.set(0, FLOOR_Y + 1.9, halfWidth);
    },
  };
}

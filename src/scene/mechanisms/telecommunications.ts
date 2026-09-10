import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, TAU} from '../kit.ts';

// ---------------------------------------------------------------------------
// Telecommunications. Three traces stacked: the steady carrier, the signal to
// be sent, and the two joined. Amplitude modulation writes the signal into the
// height of the carrier; frequency modulation writes it into the rate instead.
//
// The mast beside them is exactly a quarter of the carrier's drawn wavelength,
// which is the relation that decides how large a real antenna has to be, and it
// shrinks with the wave as the frequency climbs. The carrier is drawn at a
// handful of cycles rather than the millions a real one fits into one cycle of
// speech, or there would be nothing to see.
// ---------------------------------------------------------------------------

const RUN = 6.4;
const POINTS = 150;
const TRACE_HEIGHT = 0.55;
const ROWS = [3.5, 2.3, 1.05];
/** Cycles of carrier drawn across the trace, at the ends of the slider. */
const FEWEST = 4;
const MOST = 12;
/** Cycles of message across the window, before its slider changes them. */
const SIGNAL_START = 1.5;
/** How deep the modulation runs, as a share of the carrier. */
const DEPTH = 0.55;

/**
 * A trace drawn as a chain of short segments, so a wave of any shape reads as
 * a line rather than a cloud.
 */
function trace(parent: THREE.Object3D, tone: 'accent' | 'steel' | 'stone') {
  const geometry = new THREE.BoxGeometry(1, 0.05, 0.05);
  const pieces = Array.from({length: POINTS}, () => add(parent, geometry, mat(tone)));
  const points = Array.from({length: POINTS + 1}, () => new THREE.Vector2());
  return (y: number, at: (t: number) => number) => {
    for (let i = 0; i <= POINTS; i += 1) {
      const t = i / POINTS;
      points[i].set(-RUN / 2 + t * RUN, y + at(t) * TRACE_HEIGHT);
    }
    for (let i = 0; i < POINTS; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      pieces[i].position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      pieces[i].rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      pieces[i].scale.x = a.distanceTo(b);
    }
  };
}

export function buildTelecommunications(): Mechanism {
  const group = new THREE.Group();

  const frame = new THREE.Group();
  for (const y of ROWS) {
    const rule = box(frame, [RUN + 0.4, 0.02, 0.02], 'dark');
    rule.position.set(0, y, -0.06);
  }
  const bed = box(frame, [RUN + 1.2, 0.24, 1.4], 'deck');
  bed.position.y = 0.12;
  group.add(frame);

  const carrier = new THREE.Group();
  const carrierTrace = trace(carrier, 'stone');
  group.add(carrier);

  const signal = new THREE.Group();
  const signalTrace = trace(signal, 'accent');
  group.add(signal);

  const modulated = new THREE.Group();
  const modulatedTrace = trace(modulated, 'steel');
  group.add(modulated);

  // The mast, cut to a quarter of the wavelength drawn above it.
  const antenna = new THREE.Group();
  const mast = cylinder(antenna, 0.07, 1, 'steel', 12);
  const plane = box(antenna, [1.4, 0.08, 1.4], 'dark');
  plane.position.set(0, 0.28, 0);
  // A bar the length of one drawn wavelength, for the mast to be read against.
  const rule = box(antenna, [1, 0.06, 0.06], 'accent');
  const feet = [-1, 1].map(side => {
    const foot = box(antenna, [0.05, 0.22, 0.05], 'accent');
    foot.position.set(0, 0.45, side * 0.02);
    return foot;
  });
  antenna.position.set(0, 0.24, 1.3);
  group.add(antenna);

  const anchors = {
    carrier: new THREE.Vector3(-RUN / 2 - 0.5, ROWS[0], 0),
    signal: new THREE.Vector3(-RUN / 2 - 0.5, ROWS[1], 0),
    modulated: new THREE.Vector3(-RUN / 2 - 0.5, ROWS[2], 0),
    antenna: new THREE.Vector3(0, 1.3, 1.3),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.2, 1).normalize(),
    parts: {carrier, signal, modulated, antenna},
    anchors,
    update(state) {
      const {value, variant, elapsed} = state;
      // The message has a rate of its own, and the whole point of a carrier is
      // that it is far faster than the thing it carries. Speeding the message
      // up widens the band the transmission takes and, past a point, makes the
      // carrier no longer worth the name.
      const SIGNAL_CYCLES = dial(state, 'message', SIGNAL_START);
      // Higher up the band, more cycles fit across the same stretch of trace.
      const share = (value - 5.3) / 4;
      const cycles = FEWEST + share * (MOST - FEWEST);
      const drift = elapsed * 0.25;

      const wave = (t: number) => Math.sin((t * cycles - drift) * TAU);
      const message = (t: number) => Math.sin((t * SIGNAL_CYCLES - drift * 0.4) * TAU);

      carrierTrace(ROWS[0], wave);
      signalTrace(ROWS[1], message);
      modulatedTrace(ROWS[2], t =>
        variant === 'fm'
          ? // The rate is pushed up and down by the message, so the phase is the
            // running total of it rather than the message itself.
            Math.sin(
              (t * cycles - drift) * TAU +
                ((DEPTH * cycles) / SIGNAL_CYCLES) * Math.cos((t * SIGNAL_CYCLES - drift * 0.4) * TAU),
            )
          : // The height is pushed up and down instead, and the rate never moves.
            (1 + DEPTH * message(t)) * wave(t),
      );

      // The mast is a quarter of one drawn wavelength, always.
      const drawnWavelength = RUN / cycles;
      const quarter = drawnWavelength / 4;
      mast.scale.y = quarter;
      mast.position.y = 0.32 + quarter / 2;
      rule.scale.x = drawnWavelength;
      rule.position.set(drawnWavelength / 2 + 0.35, 0.36, 0);
      feet[0].position.x = 0.35;
      feet[1].position.x = 0.35 + drawnWavelength;

      anchors.antenna.set(0, 0.4 + quarter + 0.45, 1.3);
    },
  };
}

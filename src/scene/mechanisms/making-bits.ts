import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, dial, polyline, pool, TAU} from '../kit.ts';
import {aliasSigned, nyquistRate, quantizationLevels, quantize, quantizationLevel} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Making bits. A window one millisecond wide with a 12 kHz tone crossing it,
// the sampling instants marked, the allowed levels ruled across, and the stored
// staircase drawn over the top.
//
// Scale, stated. The window is 1 ms drawn across 6.6 scene units, so a tone of
// 12 kHz shows twelve cycles and a sample rate of 44 thousand a second puts 44
// sticks across it. Both of those are counted, not chosen: change the slider
// and the sticks are recounted from the rate.
//
// Two things cannot be drawn at their true size and say so. The levels: 16 bits
// is 65,536 of them, and no more than 33 rules are ever drawn, so above 5 bits
// the ladder is a solid band and the readout carries the real count. And the
// staircase is what is stored, not what comes back out: reconstruction filters
// it back toward a smooth wave, and that filter is not drawn here.
//
// The alias is computed, not faked, and it is drawn with the sign the fold
// gives it. Where the fold comes out negative the tone comes back inverted, and
// which side of the sample rate it started on does not settle that: 12 kHz at
// 10 thousand a second folds to a positive 2 kHz and is not inverted at all.
// A wave drawn without the inversion would sit above the very samples it
// claims to explain. The drawn alias passes through every sample dot, which is
// the whole of its claim, and the harness measures that rather than merely
// noticing that a line is present.
//
// Rounding uses one saturating quantizer with exactly two to the n levels, and
// the ladder is ruled at those same levels, so a stored dot always sits on a
// rule and never between two of them.
// ---------------------------------------------------------------------------

const RUN = 6.6;
const MID_Y = 2.4;
const HEIGHT = 1.35;
const WINDOW_MS = 1;
/** The tone the bench opens with, before its slider changes it. */
const TONE_HZ = 12000;
const POINTS = 260;
const MOST_SAMPLES = 96;
const MOST_RULES = 33;

/** The tone, as a fraction of full scale, at a time given in milliseconds. */
const toneAt = (ms: number, hertz: number) => Math.sin((ms / 1000) * hertz * TAU);

export function buildMakingBits(): Mechanism {
  const group = new THREE.Group();

  const bed = box(group, [RUN + 1.2, 0.24, 2], 'deck');
  bed.position.y = 0.12;
  const axis = box(group, [RUN + 0.4, 0.02, 0.02], 'dark');
  axis.position.set(0, MID_Y, -0.12);

  const wave = new THREE.Group();
  const drawWave = polyline(wave, 'stone', POINTS, 0.05);
  const drawAlias = polyline(wave, 'accent', POINTS, 0.05);
  group.add(wave);

  const samples = new THREE.Group();
  const sticks = pool(MOST_SAMPLES, () => add(samples, new THREE.BoxGeometry(0.035, 1, 0.035), mat('dark')));
  const dots = pool(MOST_SAMPLES, () => add(samples, new THREE.SphereGeometry(0.075, 10, 8), mat('accent')));
  group.add(samples);

  const levels = new THREE.Group();
  const rules = pool(MOST_RULES, () => add(levels, new THREE.BoxGeometry(RUN, 0.018, 0.018), mat('steel')));
  const band = box(levels, [RUN, 2 * HEIGHT, 0.01], 'steel');
  group.add(levels);

  const staircase = new THREE.Group();
  const drawSteps = polyline(staircase, 'steel', MOST_SAMPLES * 2, 0.06);
  group.add(staircase);

  const anchors = {
    wave: new THREE.Vector3(-RUN / 2 - 0.4, MID_Y + HEIGHT, 0),
    samples: new THREE.Vector3(0, MID_Y - HEIGHT - 0.6, 0),
    levels: new THREE.Vector3(RUN / 2 + 0.5, MID_Y, 0),
    staircase: new THREE.Vector3(RUN / 2 + 0.5, MID_Y + HEIGHT * 0.6, 0),
  };

  const wavePoints = Array.from({length: POINTS + 1}, () => new THREE.Vector2());
  const stepPoints: THREE.Vector2[] = [];

  return {
    group,
    view: new THREE.Vector3(0, 0.18, 1).normalize(),
    parts: {wave, samples, levels, staircase},
    anchors,
    update(state) {
      const {value, variant} = state;
      // Aliasing is about the tone against the rate, and only the rate could be
      // moved. A tone below half the rate is caught whatever the rate is, and
      // one above it folds down to something slower: with one slider only half
      // of that comparison was in reach.
      const toneHz = dial(state, 'tone', TONE_HZ / 1000) * 1000;
      const tone = (ms: number) => toneAt(ms, toneHz);
      const bits = Number(variant);
      const rate = value * 1000;
      const count = Math.min(MOST_SAMPLES, Math.round(rate * (WINDOW_MS / 1000)));

      // The wave itself, at the tone's own frequency across the window.
      for (let i = 0; i <= POINTS; i += 1) {
        const t = i / POINTS;
        wavePoints[i].set(-RUN / 2 + t * RUN, MID_Y + tone(t * WINDOW_MS) * HEIGHT);
      }
      drawWave(wavePoints);

      // Below twice the tone, the samples describe a slower wave instead, and
      // that wave is the one the machine will play back.
      const captured = rate > nyquistRate(toneHz);
      const folded = aliasSigned(toneHz, rate);
      if (captured || folded === 0) {
        drawAlias([]);
      } else {
        // The signed fold is what passes through the samples: drawn with the
        // magnitude alone this wave would be upside down against them.
        const aliasPoints = Array.from({length: POINTS + 1}, (_, i) => {
          const t = i / POINTS;
          const ms = t * WINDOW_MS;
          return new THREE.Vector2(-RUN / 2 + t * RUN, MID_Y + Math.sin((ms / 1000) * folded * TAU) * HEIGHT);
        });
        drawAlias(aliasPoints);
      }

      // The allowed levels. Above five bits there are more of them than can be
      // ruled, so the ladder becomes a band and the readout carries the count.
      const drawnRules = quantizationLevels(bits) <= MOST_RULES ? quantizationLevels(bits) : 0;
      const shown = rules.show(drawnRules);
      for (let i = 0; i < shown; i += 1) {
        rules.items[i].position.set(0, MID_Y + quantizationLevel(i, bits) * HEIGHT, -0.06);
      }
      band.visible = drawnRules === 0;
      band.position.set(0, MID_Y, -0.08);
      (band.material as THREE.MeshStandardMaterial).transparent = true;
      (band.material as THREE.MeshStandardMaterial).opacity = 0.12;

      // Each sample, snapped to the nearest allowed level.
      const heldSteps = sticks.show(count);
      dots.show(count);
      stepPoints.length = 0;
      for (let i = 0; i < heldSteps; i += 1) {
        const ms = (i / count) * WINDOW_MS;
        const x = -RUN / 2 + (i / count) * RUN;
        const raw = tone(ms);
        // Rounded to the level the depth allows, by the same function that
        // places the rules, so a dot can never land between two of them.
        const stored = quantize(raw, bits);
        const y = MID_Y + stored * HEIGHT;
        const stick = sticks.items[i];
        stick.scale.y = Math.max(0.001, Math.abs(y - MID_Y));
        stick.position.set(x, (MID_Y + y) / 2, 0.05);
        dots.items[i].position.set(x, y, 0.12);
        // The staircase holds each stored value until the next tick arrives.
        const nextX = -RUN / 2 + ((i + 1) / count) * RUN;
        stepPoints.push(new THREE.Vector2(x, y), new THREE.Vector2(nextX, y));
      }
      drawSteps(stepPoints);

      anchors.samples.set(0, MID_Y - HEIGHT - 0.7, 0);
    },
  };
}

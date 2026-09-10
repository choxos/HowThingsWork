import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, TAU} from '../kit.ts';
import {pipeFrequency, SOUND_SPEED, stringFrequency, wavelength} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Sound and music. A string over a soundboard with a movable stop, and beside
// it the wave that leaves. String and wave are drawn to one scale, three units
// to the meter, so shortening the string visibly shortens the wave in the air.
//
// The vibration itself is drawn slowed: a note of a few hundred a second would
// be a blur. The shape is exact, and so is the length of the wave beside it.
// ---------------------------------------------------------------------------

/** Scene units per meter. */
const METER = 3;
const FULL = 0.65;
/** The tension the string is tuned at, in newtons, before its slider moves it. */
const TENSION = 65.4;
const LINEAR_DENSITY = 0.0008;
const BOARD_Y = 0.6;
const STRING_Y = BOARD_Y + 0.42;
const SEGMENTS = 40;
const SWING = 0.16;
const WAVE_Z = -2.4;
/** The wave rides above the string, clear of it. */
const WAVE_Y = STRING_Y + 1.5;
const WAVE_POINTS = 96;
/** Long enough for the longest wavelength on the slider, which is the stopped
 *  pipe at full length. */
const WAVE_RUN = 8.2;
/**
 * Drawn cycles of the string per second at the note this bench opens on, and
 * the reference that note is. A real string runs at hundreds of cycles a second
 * and no animation can hold that, so what is drawn is the ratio: a note twice
 * as high swings twice as fast on screen. Without this the picture stood still
 * while the frequency moved, and a warmer hall, which sharpens a pipe without
 * changing its wavelength at all, changed nothing a reader could see.
 */
const SHOWN_RATE = 1.4;
const REFERENCE_HZ = 264;
/** The fastest the drawing will go, so a high note does not become a blur. */
const FASTEST_SHOWN = 4;

export function buildSoundAndMusic(): Mechanism {
  const group = new THREE.Group();

  const body = new THREE.Group();
  const board = box(body, [FULL * METER + 0.9, 0.16, 1.1], 'timber');
  board.position.set(0, BOARD_Y, 0);
  const plinth = box(body, [FULL * METER + 1.3, BOARD_Y - 0.08, 1.4], 'deck');
  plinth.position.set(0, (BOARD_Y - 0.08) / 2, 0);
  const nut = box(body, [0.12, 0.34, 0.7], 'dark');
  nut.position.set((-FULL * METER) / 2, STRING_Y - 0.17, 0);
  const tail = box(body, [0.12, 0.34, 0.7], 'dark');
  tail.position.set((FULL * METER) / 2, STRING_Y - 0.17, 0);
  group.add(body);

  const string = new THREE.Group();
  const wire = Array.from({length: SEGMENTS}, () => add(string, new THREE.BoxGeometry(1, 0.035, 0.035), mat('steel')));
  // The other way of sounding a note: a tube of air, drawn in section with the
  // standing wave inside it. An open end is free to move, a stopped one is not.
  const tube = new THREE.Group();
  const bore = box(tube, [1, 0.06, 0.7], 'dark');
  const roof = box(tube, [1, 0.06, 0.7], 'dark');
  const cap = box(tube, [0.08, 0.5, 0.7], 'dark');
  const column = Array.from({length: SEGMENTS}, () =>
    add(tube, new THREE.BoxGeometry(1, 0.03, 0.03), mat('accent')),
  );
  string.add(tube);
  group.add(string);

  // The stop: a finger, a fret or the first open hole, wherever the working
  // length is cut off.
  const bridge = new THREE.Group();
  const stop = box(bridge, [0.16, 0.42, 0.6], 'accent');
  stop.position.y = STRING_Y - 0.16;
  group.add(bridge);

  // The wave that leaves, drawn at the length it really has in air.
  const air = new THREE.Group();
  const beads = Array.from({length: WAVE_POINTS}, () =>
    add(air, new THREE.SphereGeometry(0.05, 8, 6), mat('stone')),
  );
  const rule = box(air, [WAVE_RUN, 0.02, 0.02], 'dark');
  rule.position.set(WAVE_RUN / 2 - FULL * METER * 0.5, WAVE_Y, WAVE_Z);
  // The two ends of one wavelength, so its length can be read off the rule.
  const markers = [-1, 1].map(() => cylinder(air, 0.06, 0.5, 'accent', 10));
  group.add(air);

  const anchors = {
    string: new THREE.Vector3(0, STRING_Y + 0.55, 0),
    bridge: new THREE.Vector3(),
    body: new THREE.Vector3(0, BOARD_Y - 0.3, 0.9),
    air: new THREE.Vector3(0, STRING_Y + 2.1, WAVE_Z),
  };

  return {
    group,
    view: new THREE.Vector3(-0.15, 0.4, 1).normalize(),
    parts: {string, bridge, body, air},
    anchors,
    update(state) {
      const {value, variant, elapsed} = state;
      // A string is tuned by two things and only its length was reachable; a
      // pipe by two others, and only its length was reachable there too. Each
      // variant answers the slider that belongs to it, and says so on the one
      // that does not.
      const tension = dial(state, 'tension', TENSION);
      const celsius = dial(state, 'air', 20);
      const speedNow = SOUND_SPEED + 0.606 * (celsius - 20);
      const length = value / 1000;
      const left = (-FULL * METER) / 2;
      const right = left + length * METER;
      const frequency =
        variant === 'string'
          ? stringFrequency(length, tension, LINEAR_DENSITY)
          // Sound travels faster through warmer air, by about 0.6 m/s a degree,
          // and a pipe's note follows it: an organ goes sharp as the hall warms.
          : pipeFrequency(length, variant === 'stopped') * (speedNow / SOUND_SPEED);
      // On screen the note is a speed: the ratio to the note the bench opens on,
      // capped so a high one does not become a blur.
      const shownRate = Math.min(FASTEST_SHOWN, SHOWN_RATE * (frequency / REFERENCE_HZ));

      // One arch over the working length, swinging at a rate slow enough to
      // watch. A string is still at both ends; an open end of a pipe is free to
      // move and a stopped one is not, so the shape it takes up differs.
      const swing = Math.sin(elapsed * shownRate * TAU) * SWING;
      const piped = variant !== 'string';
      tube.visible = piped;
      for (const piece of wire) piece.visible = !piped;
      bore.scale.x = right - left;
      bore.position.set((left + right) / 2, STRING_Y - 0.3, 0);
      roof.scale.x = right - left;
      roof.position.set((left + right) / 2, STRING_Y + 0.3, 0);
      cap.visible = variant === 'stopped';
      cap.position.set(right, STRING_Y, 0);
      for (let i = 0; i < SEGMENTS; i += 1) {
        // A stopped pipe fits a quarter of a wave: still at the closed end,
        // free at the open one. An open pipe fits a half, free at both.
        const shape = (t: number) =>
          variant === 'stopped'
            ? Math.cos((t * Math.PI) / 2)
            : variant === 'open'
              ? Math.cos(t * Math.PI)
              : Math.sin(t * Math.PI);
        const at = (t: number) => {
          const x = left + t * (right - left);
          return new THREE.Vector2(x, STRING_Y + shape(t) * swing);
        };
        const a = at(i / SEGMENTS);
        const b = at((i + 1) / SEGMENTS);
        for (const piece of [wire[i], column[i]]) {
          piece.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
          piece.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
          piece.scale.x = a.distanceTo(b);
        }
      }
      bridge.position.x = right;

      // The wave in air, at the length the speed of sound and this rate give.
      const drawn = wavelength(variant === 'string' ? SOUND_SPEED : speedNow, frequency) * METER;
      // The string sends out one wave per swing, so the wave has to advance one
      // wavelength in the time the string takes to come round.
      const travel = (elapsed * shownRate) % 1;
      for (let i = 0; i < WAVE_POINTS; i += 1) {
        const along = (i / (WAVE_POINTS - 1)) * WAVE_RUN;
        const angle = ((along / drawn) - travel) * TAU;
        beads[i].position.set(left + along, WAVE_Y + Math.sin(angle) * 0.3, WAVE_Z);
      }
      // One wavelength marked off against the rule, so its length can be read.
      markers[0].position.set(left, WAVE_Y - 0.28, WAVE_Z);
      markers[1].position.set(left + drawn, WAVE_Y - 0.28, WAVE_Z);

      anchors.bridge.set(right, STRING_Y + 0.4, 0.5);
      anchors.air.set(left + drawn / 2, WAVE_Y + 0.65, WAVE_Z);
    },
  };
}

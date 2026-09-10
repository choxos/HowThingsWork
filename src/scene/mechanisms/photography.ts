import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, TAU} from '../kit.ts';
import {depthOfField} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Photography. A lens with an iris, a shutter behind it, and the ground in
// front marked with the band that comes out sharp. The opening is drawn at the
// diameter the f number actually names: focal length divided by f number.
// ---------------------------------------------------------------------------

const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const FOCAL = 50;
/** Where the subject stands, in millimeters, before its slider moves it. */
const SUBJECT = 2000;
/** Scene units per millimeter of lens, and per meter of ground. */
const MM = 0.022;
const METER = 0.9;
const AXIS_Y = 1.7;
const BLADES = 8;
/** Barrel radius: a fifty millimeter lens is about sixty across. */
const BARREL = 30 * MM;

export function buildPhotography(): Mechanism {
  const group = new THREE.Group();

  const bed = box(group, [3.2, 0.24, 1.7], 'deck');
  bed.position.set(-1.1, 0.12, 0);

  // The lens: a barrel with an iris of overlapping blades inside it.
  const aperture = new THREE.Group();
  aperture.position.set(-0.6, AXIS_Y, 0);
  const rim = add(aperture, new THREE.TorusGeometry(BARREL, 0.08, 10, 40), mat('dark'));
  rim.rotation.y = Math.PI / 2;
  // Thin plates lying across the axis, each pushed out until its edge stands
  // at the radius the f number asks for.
  const blades = Array.from({length: BLADES}, (_, i) => {
    const blade = box(aperture, [0.04, BARREL * 1.5, BARREL * 1.5], 'steel');
    blade.rotation.x = (i / BLADES) * TAU;
    return blade;
  });
  group.add(aperture);

  const shutter = new THREE.Group();
  shutter.position.set(-0.05, AXIS_Y, 0);
  const curtain = box(shutter, [0.05, BARREL * 2, BARREL * 2], 'accent');
  const frame = add(shutter, new THREE.TorusGeometry(BARREL * 1.05, 0.05, 8, 32), mat('dark'));
  frame.rotation.y = Math.PI / 2;
  group.add(shutter);

  const sensor = new THREE.Group();
  const plate = box(sensor, [0.09, BARREL * 1.9, BARREL * 1.9], 'dark');
  plate.position.set(0.35, AXIS_Y, 0);
  // A cutaway body: back, top and one side, so the sensor can be seen and the
  // light has somewhere to arrive from.
  const back = box(sensor, [0.09, BARREL * 2.4, BARREL * 2.4], 'steel');
  back.position.set(1.02, AXIS_Y, 0);
  const roof = box(sensor, [0.9, 0.09, BARREL * 2.4], 'steel');
  roof.position.set(0.62, AXIS_Y + BARREL * 1.2, 0);
  const floor = box(sensor, [0.9, 0.09, BARREL * 2.4], 'steel');
  floor.position.set(0.62, AXIS_Y - BARREL * 1.2, 0);
  const side = box(sensor, [0.9, BARREL * 2.4, 0.09], 'steel');
  side.position.set(0.62, AXIS_Y, -BARREL * 1.2);
  group.add(sensor);

  // The ground in front, with the band that comes out sharp marked on it.
  const field = new THREE.Group();
  const ground = box(field, [0.6, 0.06, 1.4], 'deck');
  const band = box(field, [1, 0.09, 0.9], 'accent');
  const posts = [0, 1, 2].map(i => {
    const post = cylinder(field, 0.07, 0.7, i === 1 ? 'stone' : 'dark', 12);
    post.position.y = 0.35;
    return post;
  });
  group.add(field);

  const anchors = {
    aperture: new THREE.Vector3(-0.6, AXIS_Y + BARREL + 0.45, 0),
    shutter: new THREE.Vector3(-0.05, AXIS_Y + BARREL + 0.9, 0),
    sensor: new THREE.Vector3(0.75, AXIS_Y + BARREL + 0.45, 0),
    field: new THREE.Vector3(),
  };

  return {
    group,
    view: new THREE.Vector3(-0.55, 0.34, 1).normalize(),
    parts: {aperture, shutter, sensor, field},
    anchors,
    update(state) {
      const {value, phase} = state;
      // How far away the subject is decides the depth of field as much as the
      // aperture does. Close up, almost nothing is sharp at any opening; far
      // off, everything beyond a certain point is. With only the f number on a
      // slider half of what a photographer actually changes was missing.
      const subject = dial(state, 'subject', SUBJECT);
      const fNumber = STOPS[Math.max(0, Math.min(STOPS.length - 1, Math.round(value)))];
      // The f number is the focal length divided by the width of the opening,
      // so the hole drawn here is the hole the number names.
      const opening = ((FOCAL / fNumber) * MM) / 2;
      for (let i = 0; i < BLADES; i += 1) {
        // Each blade is pushed out until its edge stands at the opening radius.
        const reach = opening + (BARREL * 1.5) / 2;
        const angle = (i / BLADES) * TAU;
        blades[i].position.set(0, Math.cos(angle) * reach, Math.sin(angle) * reach);
      }

      // The shutter opens and closes once a cycle. It is not drawn to the time
      // the readout names: those run from a thirty thousandth of a second to a
      // sixteenth, a range of two thousand to one that no animation can hold.
      const open = Math.min(1, Math.max(0, Math.sin(Math.min(1, phase / 0.4) * Math.PI)));
      curtain.scale.y = Math.max(0.02, 1 - open);
      curtain.position.y = (BARREL * 2 * (1 - curtain.scale.y)) / 2;

      const sharp = depthOfField(FOCAL, fNumber, subject);
      const near = (sharp.near / 1000) * METER;
      const far = (Number.isFinite(sharp.far) ? sharp.far / 1000 : 12) * METER;
      // The ground runs from the camera out to the far limit, or to the end of
      // the bench when everything past the near limit is sharp.
      // The ground has to reach past the far marker, and its mesh is 0.6 wide,
      // so the scale is the reach divided by that.
      const reach = Math.max(far + 0.8, 3);
      ground.scale.x = reach / 0.6;
      ground.position.set(-1.6 - reach / 2, 0.03, 0);
      band.scale.x = far - near;
      band.position.set(-1.6 - (near + far) / 2, 0.09, 0);
      const at = [near, (SUBJECT / 1000) * METER, far];
      for (let i = 0; i < 3; i += 1) {
        // Each post stands on the ground, whatever height it is given.
        posts[i].scale.y = i === 1 ? 1.3 : 0.8;
        posts[i].position.set(-1.6 - at[i], 0.06 + (0.7 * posts[i].scale.y) / 2, 0);
      }

      anchors.field.set(-1.6 - (near + far) / 2, 0.95, 0.8);
    },
  };
}

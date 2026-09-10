import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, TAU} from '../kit.ts';

// ---------------------------------------------------------------------------
// Cams and cranks. A cam lifting a sprung follower beside a crank driving a
// piston, both turned by the same shaft speed so the two motions can be compared.
// ---------------------------------------------------------------------------

const CAM_RADIUS = 0.62;
const CRANK_RADIUS = 0.62;
/** The rod the bench opens with, in crank radii. Long rods lean less. */
const ROD_RADII = 3;

export function buildCamsAndCranks(): Mechanism {
  const group = new THREE.Group();
  const deck = box(group, [7.4, 0.24, 2.6], 'deck');
  deck.position.y = 0.04;

  const camX = -2;
  const crankX = 1.15;
  const shaftY = 1;

  const cam = new THREE.Group();
  const camSpin = new THREE.Group();
  camSpin.position.set(camX, shaftY, 0);
  cam.add(camSpin);
  const lobe = new THREE.Mesh(new THREE.CylinderGeometry(CAM_RADIUS, CAM_RADIUS, 0.42, 44), mat('stone'));
  lobe.rotation.x = Math.PI / 2;
  lobe.castShadow = true;
  camSpin.add(lobe);
  const camHub = cylinder(cam, 0.14, 0.56, 'dark');
  camHub.rotation.x = Math.PI / 2;
  camHub.position.set(camX, shaftY, 0);
  group.add(cam);

  const follower = new THREE.Group();
  const stem = box(follower, [0.16, 1.5, 0.16], 'steel');
  const pad = box(follower, [0.95, 0.12, 0.5], 'steel');
  const valve = box(follower, [0.44, 0.12, 0.44], 'dark');
  const coils: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i += 1) {
    const coil = add(follower, new THREE.TorusGeometry(0.2, 0.032, 7, 22), mat('accent'));
    coil.rotation.x = Math.PI / 2;
    coils.push(coil);
  }
  const guide = box(group, [0.5, 0.34, 0.5], 'timber');
  guide.position.set(camX, shaftY + 1.95, 0);
  group.add(follower);

  const crank = new THREE.Group();
  const crankSpin = new THREE.Group();
  crankSpin.position.set(crankX, shaftY, 0);
  crank.add(crankSpin);
  const web = new THREE.Mesh(new THREE.CylinderGeometry(CRANK_RADIUS, CRANK_RADIUS, 0.2, 40), mat('steel'));
  web.rotation.x = Math.PI / 2;
  web.castShadow = true;
  crankSpin.add(web);
  const pin = cylinder(crankSpin, 0.11, 0.62, 'accent');
  pin.rotation.x = Math.PI / 2;
  group.add(crank);

  const rod = new THREE.Group();
  const beam = box(rod, [1, 0.14, 0.16], 'steel');
  const piston = box(rod, [0.42, 0.5, 0.5], 'timber');
  // The bore the piston runs in. It sits where the rod puts the piston, so a
  // longer rod carries the guide out with it rather than leaving the piston to
  // travel outside the thing that guides it.
  const rails = [1, -1].map(side => {
    const rail = box(group, [1.3, 0.09, 0.68], 'dark');
    rail.position.set(crankX, shaftY + side * 0.34, 0);
    return rail;
  });
  group.add(rod);

  const posts = [box(group, [0.24, shaftY, 0.24], 'timber'), box(group, [0.24, shaftY, 0.24], 'timber')];
  posts[0].position.set(camX, shaftY / 2, -0.36);
  posts[1].position.set(crankX, shaftY / 2, -0.36);

  const anchors = {
    cam: new THREE.Vector3(camX, shaftY - CAM_RADIUS - 0.35, 0.4),
    follower: new THREE.Vector3(),
    crank: new THREE.Vector3(crankX, shaftY - CRANK_RADIUS - 0.35, 0.4),
    rod: new THREE.Vector3(),
  };

  return {
    group,
    view: new THREE.Vector3(-0.16, 0.4, 1).normalize(),
    parts: {cam, follower, crank, rod},
    anchors,
    update(state) {
      const {value, phase} = state;
      const angle = phase * TAU;
      // The rod is a control of its own, because how far it leans is what makes
      // a crank's stroke uneven, and that is set by the rod against the throw
      // rather than by either of them alone.
      const ROD_LENGTH = dial(state, 'rod', ROD_RADII) * CRANK_RADIUS;
      for (const rail of rails) rail.position.x = crankX + ROD_LENGTH + 0.34;
      const eccentric = (value * CAM_RADIUS) / 2;

      // An eccentric disc is the simplest true cam: its lift is twice the offset.
      // The offset rides in the turning frame, so it is set once and carried round.
      lobe.position.set(eccentric, 0, 0);
      camSpin.rotation.z = angle;
      const seat = shaftY + CAM_RADIUS + Math.sin(angle) * eccentric;
      follower.position.set(camX, seat, 0);
      pad.position.y = 0.055;
      stem.position.y = 0.86;
      valve.position.y = 1.67;
      const reach = shaftY + 1.95 - seat;
      coils.forEach((coil, i) => {
        coil.position.y = 0.24 + (i / (coils.length - 1)) * Math.max(reach - 0.5, 0.2);
      });

      const pinX = crankX + Math.cos(angle) * value * CRANK_RADIUS;
      const pinY = shaftY + Math.sin(angle) * value * CRANK_RADIUS;
      // The pin sits at its throw in the turning frame, which then carries it round.
      pin.position.set(value * CRANK_RADIUS, 0, 0);
      crankSpin.rotation.z = angle;

      // Slider crank: the rod's far end runs along the bore at the shaft's height.
      const rise = pinY - shaftY;
      const along = Math.sqrt(Math.max(ROD_LENGTH ** 2 - rise ** 2, 0.0001));
      const slider = pinX + along;
      beam.scale.x = ROD_LENGTH;
      beam.position.set((pinX + slider) / 2 - crankX, (pinY + shaftY) / 2 - shaftY, 0);
      beam.rotation.z = Math.atan2(shaftY - pinY, slider - pinX);
      rod.position.set(crankX, shaftY, 0);
      beam.position.x = (pinX + slider) / 2 - crankX;
      beam.position.y = (pinY + shaftY) / 2 - shaftY;
      piston.position.set(slider - crankX, 0, 0);

      anchors.follower.set(camX, seat + 2.1, 0);
      anchors.rod.set(slider - 0.2, shaftY + 0.55, 0);
    },
  };
}

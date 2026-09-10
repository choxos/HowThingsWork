import * as THREE from 'three';
import type {Mechanism, Tone} from '../kit.ts';
import {mat, add, box, cylinder, dial, TAU} from '../kit.ts';

// ---------------------------------------------------------------------------
// Gears and belts. One pair of shafts linked either by teeth or by a belt, so
// the change of direction between the two is a single switch away.
// ---------------------------------------------------------------------------

const MODULE = 0.13;
const DRIVER_TEETH = 12;
/** The most teeth either wheel is drawn with, which is how many meshes exist. */
const MOST_TEETH = 36;
const GEAR_FACE = 0.34;
const SHAFT_Y = 1.6;
const pitchRadius = (count: number) => (MODULE * count) / 2;

export function buildGearsAndBelts(): Mechanism {
  const group = new THREE.Group();

  const deck = box(group, [7.6, 0.24, 2.4], 'deck');
  deck.position.y = 0.04;

  const driver = new THREE.Group();
  const driven = new THREE.Group();
  const teeth = new THREE.Group();
  const belt = new THREE.Group();
  group.add(driver, driven, teeth, belt);

  /** A wheel body: rim, hub and four spokes, scaled to whatever radius it needs. */
  function wheel(parent: THREE.Object3D, tone: Tone) {
    const spin = new THREE.Group();
    spin.position.y = SHAFT_Y;
    parent.add(spin);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, GEAR_FACE, 44), mat(tone));
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    spin.add(rim);
    const hub = cylinder(spin, 0.15, GEAR_FACE + 0.1, 'dark');
    hub.rotation.x = Math.PI / 2;
    const spokeGeometry = new THREE.BoxGeometry(0.11, 1, GEAR_FACE + 0.04).translate(0, 0.5, 0);
    const spokes = Array.from({length: 4}, (_, i) => {
      const spoke = add(spin, spokeGeometry, mat('dark'));
      spoke.rotation.z = (i / 4) * TAU;
      return spoke;
    });
    return {spin, rim, spokes};
  }

  const driverWheel = wheel(driver, 'steel');
  const drivenWheel = wheel(driven, 'steel');

  // Standard proportions: one module of tooth above the pitch circle, one and a
  // quarter below, which leaves a quarter module of clearance at the root.
  const toothGeometry = new THREE.BoxGeometry(MODULE * 0.66, MODULE * 2.25, GEAR_FACE * 0.92).translate(
    0,
    -MODULE * 0.125,
    0,
  );
  const driverTeeth = Array.from({length: MOST_TEETH}, () => add(teeth, toothGeometry, mat('steel')));
  const drivenTeeth = Array.from({length: MOST_TEETH}, () => add(teeth, toothGeometry, mat('steel')));

  const beltMaterial = mat('earth');
  let beltMesh: THREE.Mesh | null = null;
  let beltKey = '';

  const posts = [box(group, [0.24, SHAFT_Y, 0.24], 'timber'), box(group, [0.24, SHAFT_Y, 0.24], 'timber')];
  for (const post of posts) post.position.set(0, SHAFT_Y / 2, -GEAR_FACE - 0.14);

  const anchors = {
    driver: new THREE.Vector3(),
    driven: new THREE.Vector3(),
    teeth: new THREE.Vector3(),
    belt: new THREE.Vector3(),
  };

  return {
    group,
    view: new THREE.Vector3(-0.2, 0.42, 1).normalize(),
    parts: {driver, driven, teeth, belt},
    anchors,
    update(state) {
      const {value, variant, elapsed} = state;
      const belted = variant === 'belt';
      const count = Math.round(THREE.MathUtils.clamp(value, 6, MOST_TEETH));
      // Both wheels are countable now. The ratio is between them, so with only
      // the driven wheel on a slider half of what decides it was out of reach.
      const driving = Math.round(THREE.MathUtils.clamp(dial(state, 'driver', DRIVER_TEETH), 6, MOST_TEETH));
      const rDriver = pitchRadius(driving);
      const rDriven = pitchRadius(count);
      const span = rDriver + rDriven;
      const driverX = -span / 2;
      const drivenX = span / 2;
      // Driven off the clock rather than the looping phase: the driven wheel
      // returns to its start only after a whole number of its own turns.
      const angle = elapsed * 0.9;
      // Equal arcs at the rims: the bigger wheel turns by the ratio of the radii.
      const followed = angle * (rDriver / rDriven);
      // Shafts ride high enough that the biggest wheel still clears the deck.
      const shaftY = Math.max(SHAFT_Y, rDriven + 0.45, rDriver + 0.45);

      driverWheel.spin.position.set(driverX, shaftY, 0);
      drivenWheel.spin.position.set(drivenX, shaftY, 0);
      driverWheel.spin.rotation.z = angle;
      // Teeth cross over and reverse the driven wheel; a belt does not cross, so it does not.
      drivenWheel.spin.rotation.z = belted ? followed : -followed;

      // A geared wheel is drawn to its root circle, with the teeth standing proud
      // of it; a pulley is drawn just inside the belt that rides on it.
      const bodyDriver = rDriver - (belted ? 0.07 : MODULE * 1.25);
      const bodyDriven = rDriven - (belted ? 0.07 : MODULE * 1.25);
      driverWheel.rim.scale.set(bodyDriver, 1, bodyDriver);
      drivenWheel.rim.scale.set(bodyDriven, 1, bodyDriven);
      for (const spoke of driverWheel.spokes) spoke.scale.y = bodyDriver - 0.12;
      for (const spoke of drivenWheel.spokes) spoke.scale.y = bodyDriven - 0.12;

      teeth.userData.dormant = belted;
      belt.userData.dormant = !belted;

      const seat = (mesh: THREE.Mesh, centerX: number, radius: number, at: number) => {
        mesh.position.set(centerX + Math.cos(at) * radius, shaftY + Math.sin(at) * radius, 0);
        mesh.rotation.z = at - Math.PI / 2;
      };
      driverTeeth.forEach((mesh, i) => {
        mesh.visible = i < driving;
        if (i < driving) seat(mesh, driverX, rDriver, angle + (i / driving) * TAU);
      });
      // Half a step of offset, so a tooth on one wheel always meets a gap on the other.
      const stagger = Math.PI - Math.PI / count;
      drivenTeeth.forEach((mesh, i) => {
        mesh.visible = i < count;
        if (i < count) seat(mesh, drivenX, rDriven, -followed + stagger + (i / count) * TAU);
      });

      for (const [i, at] of [driverX, drivenX].entries()) {
        posts[i].position.set(at, shaftY / 2, -GEAR_FACE - 0.14);
        posts[i].scale.y = shaftY / SHAFT_Y;
      }

      const key = `${driving}/${count}`;
      if (key !== beltKey) {
        beltKey = key;
        if (beltMesh) {
          beltMesh.geometry.dispose();
          belt.remove(beltMesh);
        }
        beltMesh = new THREE.Mesh(beltCurve(span, rDriver, rDriven), beltMaterial);
        beltMesh.castShadow = true;
        belt.add(beltMesh);
      }
      belt.position.set(0, shaftY, 0);

      anchors.driver.set(driverX, shaftY + rDriver + 0.32, 0);
      anchors.driven.set(drivenX, shaftY + rDriven + 0.32, 0);
      anchors.teeth.set(0, shaftY - Math.min(rDriver, rDriven) - 0.4, 0.35);
      anchors.belt.set(0, shaftY + Math.max(rDriver, rDriven) + 0.4, 0);
    },
  };
}

/** The loop a belt takes over two pulleys: two outer tangents and two arcs. */
function beltCurve(span: number, rDriver: number, rDriven: number) {
  const lean = Math.asin(THREE.MathUtils.clamp((rDriven - rDriver) / span, -1, 1));
  const beta = Math.PI / 2 + lean;
  const points: THREE.Vector3[] = [];
  const arc = (centerX: number, radius: number, from: number, to: number) => {
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const at = from + ((to - from) * i) / steps;
      points.push(new THREE.Vector3(centerX + Math.cos(at) * radius, Math.sin(at) * radius, 0));
    }
  };
  arc(span / 2, rDriven, beta, -beta);
  arc(-span / 2, rDriver, -beta, beta - TAU);
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.2);
  return new THREE.TubeGeometry(curve, 180, 0.06, 8, true);
}

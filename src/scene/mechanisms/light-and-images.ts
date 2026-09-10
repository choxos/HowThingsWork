import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, arrow, dial} from '../kit.ts';
import {thinLens, OPTICAL_ELEMENTS} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Light and images. An optical bench drawn to one scale in both directions,
// so the size of the image is as true as its position. Three rays are laid in
// from the top of the object: one parallel that leaves through the far focus,
// one through the middle that carries straight on, and one through the near
// focus that leaves parallel. Where they meet is the image.
//
// Five elements stand on the bench in turn, and one equation covers all of
// them. Only the focal length changes: a hundred millimeters for the two that
// gather light, minus a hundred for the two that spread it, and no focal length
// at all for the flat mirror. Everything else follows. The two mirrors send the
// light back the way it came, so their half of the diagram is the same drawing
// with its x reversed.
//
// The three rays are not drawn from a rule about foci. Each leaves along the
// line from where it strikes the element to the image the equation gives, which
// is what an image is; where that image is virtual the ray leaves the other way
// and the line traced back behind the element is what the eye follows. That one
// rule is why the flat mirror needs no special case: it has no focus to build a
// construction on, and none is used.
// ---------------------------------------------------------------------------

/** Scene units per millimeter. */
const MM = 0.006;
/**
 * The focal length the glass and the dish are cut for, taken from the table the
 * readouts use. The slider moves the focal length itself; the shapes are drawn
 * for this one, so the drawn curvature stands for the family rather than the
 * particular setting, and the focal marks on the axis carry the setting.
 */
const FOCAL = OPTICAL_ELEMENTS.converging.focal;

const OBJECT_HEIGHT = 80;
const APERTURE = 210;
const AXIS_Y = 1.5;
/** How far along the bench the drawing will follow a runaway image. */
const REACH = 450;
/** Where the rail stands, and where a ray drawn downward has to stop. */
const RAIL_TOP = 0.2;

/**
 * A biconvex disc. The profile runs from the axis out to the rim on one face
 * and back on the other, and the lathe turns it about the axis, so the glass
 * really is as wide as the aperture the rays are checked against.
 */
function lensGeometry() {
  const half = (APERTURE / 2) * MM;
  const bulge = 26 * MM;
  const steps = 22;
  const face = (i: number) => {
    const r = (half * i) / steps;
    return bulge * Math.sqrt(Math.max(0, 1 - (r / half) ** 2));
  };
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i += 1) points.push(new THREE.Vector2((half * i) / steps, face(i)));
  for (let i = steps; i >= 0; i -= 1) points.push(new THREE.Vector2((half * i) / steps, -face(i)));
  const geometry = new THREE.LatheGeometry(points, 44);
  // Lathed about Y, then laid over so the optical axis runs along X.
  geometry.rotateZ(Math.PI / 2);
  return geometry;
}

/** A straight run of ray between two points in the plane of the bench. */
function ray(parent: THREE.Object3D, tone: 'accent' | 'dark') {
  const mesh = add(parent, new THREE.BoxGeometry(1, 0.045, 0.045), mat(tone));
  return (from: THREE.Vector2, to: THREE.Vector2) => {
    mesh.visible = from.distanceTo(to) > 0.004;
    if (!mesh.visible) return;
    mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    mesh.rotation.z = Math.atan2(to.y - from.y, to.x - from.x);
    mesh.scale.x = from.distanceTo(to);
  };
}

/**
 * A biconcave disc, which is the same lathe with the profile turned inside out:
 * thin along the axis and thick at the rim, so it spreads light instead of
 * gathering it. The waist keeps the glass from closing to nothing in the middle,
 * where a real one would still have a thickness.
 */
function divergingLensGeometry() {
  const half = (APERTURE / 2) * MM;
  const bulge = 22 * MM;
  const waist = 5 * MM;
  const steps = 22;
  const face = (i: number) => {
    const r = (half * i) / steps;
    return waist + bulge * (1 - Math.sqrt(Math.max(0, 1 - (r / half) ** 2)));
  };
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i += 1) points.push(new THREE.Vector2((half * i) / steps, face(i)));
  for (let i = steps; i >= 0; i -= 1) points.push(new THREE.Vector2((half * i) / steps, -face(i)));
  const geometry = new THREE.LatheGeometry(points, 44);
  geometry.rotateZ(Math.PI / 2);
  return geometry;
}

/**
 * A spherical cap of radius twice the focal length. Dished away from the light
 * it gathers, which is a concave mirror; turned about so it bulges toward the
 * light it spreads, which is a convex one, and the same cap serves for both.
 */
function mirrorGeometry(bulge: 1 | -1) {
  const half = (APERTURE / 2) * MM;
  const curvature = 2 * FOCAL * MM;
  const steps = 22;
  const points: THREE.Vector2[] = [];
  const sag = (r: number) => bulge * (curvature - Math.sqrt(Math.max(0, curvature * curvature - r * r)));
  for (let i = 0; i <= steps; i += 1) {
    const r = (half * i) / steps;
    points.push(new THREE.Vector2(r, sag(r)));
  }
  for (let i = steps; i >= 0; i -= 1) {
    const r = (half * i) / steps;
    points.push(new THREE.Vector2(r, sag(r) + bulge * 0.05));
  }
  const geometry = new THREE.LatheGeometry(points, 44);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

/** A flat silvered disc, which has no curvature and so no focal length at all. */
function planeMirrorGeometry() {
  const half = (APERTURE / 2) * MM;
  const geometry = new THREE.CylinderGeometry(half, half, 0.05, 44);
  geometry.rotateZ(Math.PI / 2);
  return geometry;
}


export function buildLightAndImages(): Mechanism {
  const group = new THREE.Group();

  const bench = box(group, [REACH * 2 * MM + 1.4, 0.16, 0.7], 'deck');
  bench.position.y = 0.08;
  const axis = box(group, [REACH * 2 * MM + 1, 0.02, 0.02], 'dark');
  axis.position.y = AXIS_Y;

  const lens = new THREE.Group();
  // The converging lens stays first in the group: it is the widest thing on the
  // bench and the aperture check reads it by name to be sure of that.
  const glass = add(lens, lensGeometry(), mat('steel'));
  glass.name = 'converging';
  const spread = add(lens, divergingLensGeometry(), mat('steel'));
  spread.name = 'diverging';
  for (const element of [glass, spread]) {
    const material = element.material as THREE.MeshStandardMaterial;
    material.transparent = true;
    material.opacity = 0.55;
  }
  // The other three: dishes that send the light back rather than passing it
  // through, of the same aperture, and a flat one with no curvature at all.
  const dish = add(lens, mirrorGeometry(1), mat('steel'));
  dish.name = 'concave-mirror';
  const dome = add(lens, mirrorGeometry(-1), mat('steel'));
  dome.name = 'convex-mirror';
  const flat = add(lens, planeMirrorGeometry(), mat('steel'));
  flat.name = 'plane-mirror';
  const shapes = [glass, spread, dish, dome, flat];
  for (const element of [dish, dome, flat]) {
    const material = element.material as THREE.MeshStandardMaterial;
    material.metalness = 0.95;
    material.roughness = 0.08;
    // Turning the cap about reverses the winding of its lathe, so both faces
    // are lit rather than one of them coming out inside out.
    material.side = THREE.DoubleSide;
  }
  lens.position.y = AXIS_Y;
  const post = box(lens, [0.14, AXIS_Y - 0.22, 0.14], 'dark');
  post.position.y = -(AXIS_Y - 0.22) / 2 - 0.1;
  // The two focal points, marked on the axis where they belong. A flat mirror
  // has none, so nothing is marked for it rather than a point that is not there.
  const foci = [-1, 1].map(side => {
    const focus = cylinder(lens, 0.055, 0.16, 'accent', 12);
    focus.rotation.x = Math.PI / 2;
    focus.position.x = side * FOCAL * MM;
    focus.name = 'focus';
    focus.userData.side = side;
    return focus;
  });
  group.add(lens);

  const object = new THREE.Group();
  const objectArrow = arrow(object, 'accent');
  objectArrow.set(OBJECT_HEIGHT * MM);
  const objectPost = box(object, [0.1, AXIS_Y - 0.22, 0.1], 'dark');
  objectPost.position.y = -(AXIS_Y - 0.22) / 2 - 0.1;
  group.add(object);

  const image = new THREE.Group();
  const imageArrow = arrow(image, 'steel');
  group.add(image);

  const rays = new THREE.Group();
  const inbound = [ray(rays, 'dark'), ray(rays, 'dark'), ray(rays, 'dark')];
  const outbound = [ray(rays, 'dark'), ray(rays, 'dark'), ray(rays, 'dark')];
  // Where a virtual image is concerned the rays are traced back, not drawn on.
  const traced = [ray(rays, 'accent'), ray(rays, 'accent'), ray(rays, 'accent')];
  group.add(rays);

  const anchors = {
    lens: new THREE.Vector3(0, AXIS_Y + APERTURE * MM * 0.5 + 0.35, 0),
    object: new THREE.Vector3(),
    rays: new THREE.Vector3(0, AXIS_Y + 1.1, 0),
    image: new THREE.Vector3(),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.26, 1).normalize(),
    parts: {lens, object, rays, image},
    anchors,
    update(state) {
      const {value, variant} = state;
      const element = OPTICAL_ELEMENTS[variant] ?? OPTICAL_ELEMENTS.converging;
      // The second slider is the element's own focal length, which with the
      // object distance is the whole of the lens equation. A flat mirror has
      // none and ignores it, which is the point of having it on the bench.
      const focalMm = Number.isFinite(element.focal)
        ? Math.sign(element.focal) * dial(state, 'focal', Math.abs(element.focal))
        : element.focal;
      const found = thinLens(focalMm, value);
      const f = focalMm * MM;
      const distance = value * MM;
      const height = OBJECT_HEIGHT * MM;
      const halfAperture = (APERTURE / 2) * MM;
      object.position.set(-distance, AXIS_Y, 0);

      // A mirror sends the light back the way it came, so everything on the
      // outgoing side is the same diagram with its x reversed.
      const fold = element.mirror ? -1 : 1;
      for (const shape of shapes) shape.visible = shape.name === (variant in OPTICAL_ELEMENTS ? variant : 'converging');
      for (const focus of foci) {
        focus.visible = Number.isFinite(element.focal);
        // The marks stand where the focal length actually is, so moving that
        // slider moves them and the rays that are aimed at them together.
        focus.position.x = (focus.userData.side as number) * Math.abs(focalMm) * MM;
      }
      const drawn = Math.max(-REACH, Math.min(REACH, found.distance)) * MM;
      const offBench = Math.abs(found.distance) > REACH;
      const imageHeight = height * found.magnification;
      const imageY = imageHeight;

      // An image too large or too far to draw is left out rather than drawn
      // at a size it does not have. The readout still names it.
      const drawable = !offBench && Number.isFinite(imageHeight) && Math.abs(imageHeight) < 3.2;
      image.visible = drawable;
      image.position.set(drawn * fold, AXIS_Y, 0);
      imageArrow.holder.rotation.z = imageHeight < 0 ? Math.PI : 0;
      imageArrow.set(drawable ? Math.abs(imageHeight) : 0);

      // Where each of the three rays crosses the element, measured from the
      // axis. The third comes in by way of a focus, so it climbs as the object
      // approaches that focus and eventually misses the element altogether. A
      // flat mirror has no focus to aim at, so its third ray is simply laid in
      // below the axis: three rays that all trace back to one point make the
      // case as well as three chosen ones would.
      const viaFocus = !Number.isFinite(f)
        ? -height * 0.7
        : f === distance
          ? Infinity
          : (height * f) / (f - distance);
      const crossings = [height, 0, viaFocus];
      const tip = new THREE.Vector2(-distance, AXIS_Y + height);
      const edge = REACH * MM * fold;
      const imageTip = new THREE.Vector2(drawn * fold, AXIS_Y + imageHeight);

      // Every outgoing ray runs along the line from where it struck the element
      // to the image, because that is what an image is. Where the image is
      // virtual the ray leaves the other way instead, and the line traced back
      // behind the element is the one that arrives there. With the object at the
      // focal point there is no image to aim at and every ray leaves parallel to
      // the one through the middle, which is the only direction still fixed.
      const imageX = found.distance * MM;
      const leavingAt = (y: number) => {
        if (!Number.isFinite(imageX)) return new THREE.Vector2(distance * fold, -height);
        const toward = new THREE.Vector2(imageX, imageY - y);
        if (!found.real) toward.negate();
        toward.x *= fold;
        return toward;
      };

      for (let i = 0; i < 3; i += 1) {
        const at = new THREE.Vector2(0, AXIS_Y + crossings[i]);
        // A ray that would strike outside the rim of the glass is not drawn,
        // because it is not a ray this lens ever handles.
        const caught = Math.abs(crossings[i]) <= halfAperture + 1e-9;
        inbound[i](caught ? tip : at, caught ? at : at);
        if (!caught) {
          outbound[i](at, at);
          traced[i](at, at);
          continue;
        }
        // Drawn until it reaches the end of the bench or dips to the rail,
        // whichever comes first: a ray does not carry on through the bench.
        const direction = leavingAt(crossings[i]);
        const alongX = direction.x === 0 ? Infinity : Math.abs(edge / direction.x);
        const alongY = direction.y === 0 ? Infinity : Math.abs((at.y - RAIL_TOP) / direction.y);
        const steps = Math.min(alongX, alongY);
        outbound[i](at, at.clone().addScaledVector(direction, steps));
        // For a virtual image the rays never cross: what meets is the line
        // traced back behind the glass, and that is what the eye follows.
        const back = !found.real && !offBench;
        traced[i](back ? at : at, back ? imageTip : at);
      }

      anchors.object.set(-distance, AXIS_Y + height + 0.45, 0);
      anchors.image.set(drawn * fold, AXIS_Y - Math.abs(imageHeight) - 0.45, 0.4);
      anchors.rays.set((-distance / 2) * fold, AXIS_Y + halfAperture + 0.8, 0);
    },
  };
}

import * as THREE from 'three';

/**
 * The shared workshop: the material palette, the drawing helpers and the two
 * easing curves every bench in this study is built from.
 */


export type MechanismState = {
  /** The topic's main control: slope ratio, fulcrum position, or wheel to axle ratio. */
  value: number;
  /** Lever class for the lever bench; ignored elsewhere. */
  variant: string;
  /** Animation position, 0 to 1 and wrapping. */
  phase: number;
  /** Seconds since the studio opened. Unlike phase, this never wraps. */
  elapsed: number;
  /**
   * Any further sliders the bench declares, by id. A bench that declares none
   * never sees this, and a bench that declares one reads it through `dial`, so
   * every builder keeps working whether the studio supplies it or not.
   */
  extras?: Record<string, number>;
};

/** One of the extra sliders, or the value to stand in for it when there is none. */
export const dial = (state: MechanismState, id: string, fallback: number) =>
  state.extras?.[id] ?? fallback;

export type Mechanism = {
  group: THREE.Group;
  /** Where the camera sits by default, as a direction from the model. */
  view: THREE.Vector3;
  /** One object per part id, used for isolating and highlighting. */
  parts: Record<string, THREE.Object3D>;
  /** Extra objects, such as force arrows, that belong to a part but live in world space. */
  extras?: Record<string, THREE.Object3D[]>;
  /** Where the floating label for each part should sit, in scene space. */
  anchors: Record<string, THREE.Vector3>;
  /**
   * How far the model reaches at its widest moment, when that is more than its
   * resting size. A bench whose parts travel has to be framed for the travel,
   * or they leave the picture halfway through the cycle.
   */
  reach?: number;
  update(state: MechanismState): void;
};

export const palette = {
  steel: {color: 0x9aa8b4, metalness: 0.85, roughness: 0.28},
  dark: {color: 0x171e25, metalness: 0.3, roughness: 0.42},
  timber: {color: 0x8a6f52, metalness: 0.05, roughness: 0.78},
  stone: {color: 0x717d86, metalness: 0.12, roughness: 0.72},
  earth: {color: 0x5d6b6a, metalness: 0.1, roughness: 0.85},
  accent: {color: 0xf2905c, metalness: 0.4, roughness: 0.36},
  rope: {color: 0xc7a677, metalness: 0.08, roughness: 0.82},
  deck: {color: 0x323b44, metalness: 0.12, roughness: 0.86},
  /** A lamp envelope: nearly colorless, so what is seen through it is the filament. */
  glass: {color: 0xd9e2e8, metalness: 0, roughness: 0.08},
} as const;

export type Tone = keyof typeof palette;

/** Every part gets its own material instances so highlighting one never bleeds into another. */
export const mat = (tone: Tone) => new THREE.MeshStandardMaterial(palette[tone]);

export function add(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export const box = (parent: THREE.Object3D, size: [number, number, number], tone: Tone) =>
  add(parent, new THREE.BoxGeometry(...size), mat(tone));

export const cylinder = (parent: THREE.Object3D, radius: number, length: number, tone: Tone, segments = 32) =>
  add(parent, new THREE.CylinderGeometry(radius, radius, length, segments), mat(tone));

/** A right triangle prism, thick at x = 0 and tapering to nothing at x = 1. */
export function unitWedge() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(0, 1);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false});
  geometry.translate(0, 0, -0.5);
  geometry.computeVertexNormals();
  return geometry;
}

export const HEAD = 0.26;

/**
 * An arrow along +Y whose overall tip to tail length is exactly what you ask
 * for. Orange is the force you apply; steel is the force the machine applies
 * to the load.
 */
export function arrow(parent: THREE.Object3D, tone: Tone = 'accent') {
  const holder = new THREE.Group();
  const material = mat(tone);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 1, 12), material);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.115, HEAD, 16), material);
  for (const mesh of [shaft, head]) {
    mesh.castShadow = true;
    holder.add(mesh);
  }
  parent.add(holder);
  const set = (length: number) => {
    // An arrow standing for nothing should not be drawn at all, or it reports a
    // force that is not there.
    holder.visible = length > 0.02;
    // Otherwise the drawn length is the length asked for, exactly, however
    // short: an arrow that quietly rounds up misreports the force it stands for.
    const total = Math.max(0.02, length);
    // A short arrow shrinks its head too, rather than overshooting the value it stands for.
    const headLength = Math.min(HEAD, total * 0.62);
    const shaftLength = Math.max(0.001, total - headLength);
    shaft.scale.y = shaftLength;
    shaft.position.y = shaftLength / 2;
    head.scale.setScalar(headLength / HEAD);
    head.position.y = total - headLength / 2;
  };
  set(1);
  return {holder, set};
}

/** Length of an arrow standing for the load's own weight, before any shared rescale. */
export const FORCE_UNIT = 1.35;
export const LONGEST_ARROW = 3;

/**
 * Both arrows in a scene share one scale, so their lengths stay in true
 * proportion to each other and to the numbers in the readout.
 */
export function forceLengths(effort: number, load: number) {
  const scale = Math.min(1, LONGEST_ARROW / (FORCE_UNIT * Math.max(effort, load)));
  return {effort: FORCE_UNIT * effort * scale, load: FORCE_UNIT * load * scale};
}

export const TAU = Math.PI * 2;
/** Ease the animation so every cycle starts and ends at rest. */
export const swell = (phase: number) => 0.5 - 0.5 * Math.cos(phase * TAU);
/** Out and back at one unchanging speed, for comparisons that are about time. */
export const shuttle = (phase: number) => (phase < 0.5 ? phase * 2 : 2 - phase * 2);

/** The nearest registered ancestor owns a hit, including separately selectable child parts. */
export function partOwner(mechanism: Mechanism, node: THREE.Object3D | null): string | undefined {
  while (node) {
    for (const [id, part] of Object.entries(mechanism.parts)) {
      if (part === node || mechanism.extras?.[id]?.includes(node)) return id;
    }
    node = node.parent;
  }
}

export function partVisible(node: THREE.Object3D | undefined): boolean {
  if (!node) return false;
  for (let ancestor: THREE.Object3D | null = node; ancestor; ancestor = ancestor.parent) {
    if (!ancestor.visible || ancestor.userData.dormant === true) return false;
  }
  return true;
}

const HIGHLIGHT = new THREE.Color(0xc1532f);
type TintState = {color: THREE.Color; intensity: number};
const presentationStates = new WeakMap<Mechanism, {
  hidden: THREE.Object3D[];
  tinted: Map<THREE.MeshStandardMaterial, TintState>;
  snapshots: WeakMap<THREE.MeshStandardMaterial, TintState>;
}>();

/** Apply a temporary presentation mask, then restore it before the next model update. */
export function presentMechanism(mechanism: Mechanism, selected: string, isolated: boolean) {
  const isolating = isolated && partVisible(mechanism.parts[selected]);
  let state = presentationStates.get(mechanism);
  if (!state) {
    state = {hidden: [], tinted: new Map(), snapshots: new WeakMap()};
    presentationStates.set(mechanism, state);
  }
  const {hidden, tinted, snapshots} = state;
  const owners = new Map<THREE.Object3D, string>();
  for (const [id, part] of Object.entries(mechanism.parts)) {
    owners.set(part, id);
    for (const extra of mechanism.extras?.[id] ?? []) owners.set(extra, id);
  }
  // Ownership follows the live tree, including meshes created by this frame's update.
  function visit(node: THREE.Object3D, inherited?: string) {
    const owner = owners.get(node) ?? inherited;
    if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points || node instanceof THREE.Sprite) {
      const absent = !partVisible(node) || (owner !== undefined && !partVisible(mechanism.parts[owner]));
      if (node.visible && ((isolating && owner !== selected) || absent)) {
        hidden.push(node);
        node.visible = false;
      }
      if (owner === selected && node instanceof THREE.Mesh) {
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!(material instanceof THREE.MeshStandardMaterial) || tinted.has(material)) continue;
          let snapshot = snapshots.get(material);
          if (!snapshot) {
            snapshot = {color: new THREE.Color(), intensity: 0};
            snapshots.set(material, snapshot);
          }
          snapshot.color.copy(material.emissive);
          snapshot.intensity = material.emissiveIntensity;
          tinted.set(material, snapshot);
          material.emissive.copy(HIGHLIGHT);
          material.emissiveIntensity = 0.09;
        }
      }
    }
    for (const child of node.children) visit(child, owner);
  }
  visit(mechanism.group);
  return {
    isolating,
    restore() {
      for (const node of hidden) node.visible = true;
      hidden.length = 0;
      for (const [material, {color, intensity}] of tinted) {
        material.emissive.copy(color);
        material.emissiveIntensity = intensity;
      }
      tinted.clear();
    },
  };
}

/**
 * A trace drawn as a chain of short segments, so a curve of any shape reads as
 * a line rather than a cloud of dots. The setter takes one more point than
 * there are segments, and hides the tail of the chain when given fewer.
 */
export function polyline(parent: THREE.Object3D, tone: Tone, segments: number, thickness = 0.05) {
  const geometry = new THREE.BoxGeometry(1, thickness, thickness);
  const pieces = Array.from({length: segments}, () => add(parent, geometry, mat(tone)));
  return (points: THREE.Vector2[]) => {
    for (let i = 0; i < segments; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const drawn = Boolean(a && b);
      pieces[i].visible = drawn;
      if (!drawn) continue;
      pieces[i].position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      pieces[i].rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      pieces[i].scale.x = Math.max(1e-4, a.distanceTo(b));
    }
  };
}

/** A pool of identical meshes, of which only the first few are shown at a time. */
export function pool<T extends THREE.Object3D>(count: number, make: () => T) {
  const items = Array.from({length: count}, make);
  return {
    items,
    /** Show the first n and hide the rest, so a count can change without rebuilding. */
    show(n: number) {
      for (let i = 0; i < items.length; i += 1) items[i].visible = i < n;
      return Math.min(n, items.length);
    },
  };
}

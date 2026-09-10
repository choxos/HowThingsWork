import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {box, dial} from '../kit.ts';
import {dotPitch, halftoneTint} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Printing. A patch of paper six millimeters across, magnified, with the four
// screens laid on it at their proper angles. Every dot is solid ink; only its
// size changes, and the size is set by the tint that ink carries.
// ---------------------------------------------------------------------------

/** The patch of sheet on show, in millimeters, and how large it is drawn. */
const PATCH = 6;
const DRAWN = 4.4;
const PER_MM = DRAWN / PATCH;
/** Enough for the finest screen on the slider to be drawn in full. */
const MOST_DOTS = 5600;
const SHEET_Y = 0.24;

/** The four inks, each with its own angle and the tint it carries here. */
const INKS = [
  {name: 'yellow', angle: 0, tint: 0.55, color: 0xe8c14a, lift: 0.004},
  {name: 'cyan', angle: 15, tint: 0.42, color: 0x3f9ec4, lift: 0.009},
  {name: 'magenta', angle: 75, tint: 0.3, color: 0xc25a92, lift: 0.014},
  {name: 'black', angle: 45, tint: 0.18, color: 0x1d242b, lift: 0.019},
];

export function buildPrinting(): Mechanism {
  const group = new THREE.Group();

  const sheet = new THREE.Group();
  const paper = box(sheet, [DRAWN + 0.5, SHEET_Y, DRAWN + 0.5], 'stone');
  (paper.material as THREE.MeshStandardMaterial).color.set(0xf2f1ec);
  paper.position.y = SHEET_Y / 2;
  group.add(sheet);

  // One instanced lattice per ink keeps draw calls fixed as the screen
  // gets finer; the number of vertices still grows with the dot count.
  const dots = new THREE.Group();
  const SIDES = 24;
  const disc = new THREE.CylinderGeometry(0.5, 0.5, 0.02, SIDES);
  /**
   * A drawn dot is a polygon, not a circle, so its area is a little short of
   * pi r squared. The radius is worked out from the polygon's own area, or the
   * coverage would not be the tint it claims.
   */
  const polygonArea = (SIDES / 2) * Math.sin((2 * Math.PI) / SIDES);
  const screens = INKS.map(ink => {
    const mesh = new THREE.InstancedMesh(
      disc,
      new THREE.MeshStandardMaterial({color: ink.color, roughness: 0.62, metalness: 0.05}),
      MOST_DOTS,
    );
    // Flat ink coverage should not add thousands of miniature shadow casters.
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    dots.add(mesh);
    return mesh;
  });
  group.add(dots);

  // A swatch of the tint the four of them make, for comparison.
  const angles = new THREE.Group();
  const swatch = box(angles, [1.5, 0.06, 1.5], 'stone');
  swatch.position.set(DRAWN / 2 + 1.3, SHEET_Y + 0.03, -1.2);
  for (let i = 0; i < INKS.length; i += 1) {
    const gauge = box(angles, [1.3, 0.05, 0.09], 'dark');
    (gauge.material as THREE.MeshStandardMaterial).color.set(INKS[i].color);
    gauge.rotation.y = (-INKS[i].angle * Math.PI) / 180;
    gauge.position.set(DRAWN / 2 + 1.3, SHEET_Y + 0.06 + i * 0.09, 1.1);
  }
  group.add(angles);

  const screenPart = new THREE.Group();
  for (const side of [-1, 1]) {
    const rail = box(screenPart, [DRAWN + 0.5, 0.1, 0.12], 'dark');
    rail.position.set(0, SHEET_Y + 0.05, (side * (DRAWN + 0.5)) / 2);
  }
  group.add(screenPart);

  const matrix = new THREE.Matrix4();
  let lastValue = NaN;
  let lastVariant: string | undefined;
  /** The ink strength the screens were last built for, so they rebuild when it moves. */
  let lastStrength = NaN;
  const anchors = {
    screen: new THREE.Vector3(0, SHEET_Y + 0.6, DRAWN / 2 + 0.4),
    dots: new THREE.Vector3(-DRAWN / 2 - 0.5, SHEET_Y + 0.5, 0),
    angles: new THREE.Vector3(DRAWN / 2 + 1.3, SHEET_Y + 0.7, 1.1),
    sheet: new THREE.Vector3(0, SHEET_Y + 0.35, -DRAWN / 2 - 0.5),
  };

  return {
    group,
    view: new THREE.Vector3(-0.25, 0.85, 0.9).normalize(),
    parts: {screen: screenPart, dots, angles, sheet},
    anchors,
    update(state) {
      const {value, variant} = state;
      // How much ink the picture asks for is a separate question from how fine
      // the screen is, and it is the one that decides how dark the patch comes
      // out. The ruling alone changes only how closely the dots are packed.
      const strength = dial(state, 'ink', 100) / 100;
      if (value === lastValue && variant === lastVariant && strength === lastStrength) return;
      lastValue = value;
      lastVariant = variant;
      lastStrength = strength;
      const pitch = dotPitch(value) * PER_MM;
      const across = Math.ceil(DRAWN / pitch) + 2;
      const live = INKS.map((_, i) => (variant === 'black' ? i === 3 : true));

      // The swatch is worked out the way the inks combine on paper: each one
      // takes its share of every channel away from what the sheet reflects.
      const mixed = [1, 1, 1];
      for (let i = 0; i < INKS.length; i += 1) {
        const mesh = screens[i];
        const ink = INKS[i];
        mesh.visible = live[i];
        if (!live[i]) continue;
        // Solid ink over the fraction of the area the tint asks for, so the
        // dot's own diameter follows the square root of that fraction.
        const tint = Math.min(0.98, ink.tint * strength);
        const radius = pitch * Math.sqrt(tint / polygonArea);
        const channels = [(ink.color >> 16) & 255, (ink.color >> 8) & 255, ink.color & 255];
        for (let c = 0; c < 3; c += 1) mixed[c] *= halftoneTint(tint, 1, channels[c] / 255);
        const angle = (ink.angle * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        let n = 0;
        for (let row = -across; row <= across && n < MOST_DOTS; row += 1) {
          for (let column = -across; column <= across && n < MOST_DOTS; column += 1) {
            // Laid out on the ink's own lattice, then turned to its own angle.
            const x = column * pitch * cos - row * pitch * sin;
            const z = column * pitch * sin + row * pitch * cos;
            // A dot whose edge would hang over the sheet is not printed at all.
            if (Math.abs(x) > DRAWN / 2 - radius || Math.abs(z) > DRAWN / 2 - radius) continue;
            matrix.makeScale(radius * 2, 1, radius * 2);
            matrix.setPosition(x, SHEET_Y + ink.lift, z);
            mesh.setMatrixAt(n, matrix);
            n += 1;
          }
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
      }

      // What those tints average to, which is the whole point of a halftone:
      // no pale ink anywhere, and every shade all the same.
      (swatch.material as THREE.MeshStandardMaterial).color.setRGB(
        Math.max(0.03, mixed[0]),
        Math.max(0.03, mixed[1]),
        Math.max(0.03, mixed[2]),
      );
    },
  };
}

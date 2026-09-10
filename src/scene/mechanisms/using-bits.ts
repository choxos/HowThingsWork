import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, dial, pool} from '../kit.ts';
import {frameBytes, quantizationLevels} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Using bits. A panel ruled into the pixel grid the slider asks for, one pixel
// blown up beside it to show the three colored elements inside, a ramp from
// black to white banded at the depth in play, and a bar for the data.
//
// The panel is a patch of the picture, not the whole of it: one fortieth of the
// width and one fortieth of the height. That is what lets the grid answer to
// the slider across its whole range. Ruling the entire picture would put 3,840
// columns in 4.2 scene units at the top of the slider and 160 at the bottom,
// and both would be finer than the panel can draw, so the picture would sit
// still while the numbers changed. Drawing a patch instead means the dots in it
// really do get smaller as the count rises, which is the thing to see. The
// readout gives the count for the whole picture.
//
// The ramp is drawn as 64 strips from black to white whatever the depth, each
// painted with the value the current depth would actually store for it. At two
// bits the 64 strips collapse into four visible plateaus, which is the banding
// itself rather than a picture of it; at eight or ten they run smoothly. Both
// ends are the same at every depth, so black is black and white is white and
// the only thing that changes is how many distinct grays lie between them.
//
// The bar is logarithmic, and says so here and in the reader-facing text. One
// frame runs from about eleven kilobytes to thirty megabytes across the slider
// and the depths, which is three decades; drawn in proportion, the small end
// would have no length at all.
// ---------------------------------------------------------------------------

const PANEL_W = 4.2;
const PANEL_H = (PANEL_W * 9) / 16;
const PANEL_Y = 2.6;
const MOST_COLUMNS = 96;
/** The share of the picture's width the panel shows, so the grid keeps responding. */
const PATCH = 1 / 40;
const MOST_BANDS = 64;
/** Where the ramp and the data bar sit, below the panel. */
const RAMP_Y = 1.15;
const BAR_Y = 0.55;
const BAR_RUN = 4.2;
/** The smallest and largest frame the bench can be asked for, in bytes. */
const SMALLEST = frameBytes(160 * 90, 2 * 3);
const LARGEST = frameBytes(3840 * 2160, 10 * 3);

const frameHeight = (across: number) => Math.round((across * 9) / 16);

export function buildUsingBits(): Mechanism {
  const group = new THREE.Group();

  const stand = box(group, [PANEL_W + 1.4, 0.24, 1.6], 'deck');
  stand.position.y = 0.12;

  const grid = new THREE.Group();
  const panel = box(grid, [PANEL_W, PANEL_H, 0.1], 'dark');
  panel.position.set(0, PANEL_Y, 0);
  const columns = pool(MOST_COLUMNS, () => add(grid, new THREE.BoxGeometry(0.012, PANEL_H, 0.02), mat('steel')));
  const rowsPool = pool(MOST_COLUMNS, () => add(grid, new THREE.BoxGeometry(PANEL_W, 0.012, 0.02), mat('steel')));
  group.add(grid);

  // One pixel, enlarged, with the three elements that make its color.
  const subpixels = new THREE.Group();
  const surround = box(subpixels, [1.15, 1.15, 0.08], 'dark');
  surround.position.set(PANEL_W / 2 + 1.05, PANEL_Y, 0);
  const elements = ([0xd0342c, 0x2f9e44, 0x2f6fd0] as const).map((hex, i) => {
    const strip = add(subpixels, new THREE.BoxGeometry(0.3, 0.95, 0.1), mat('dark'));
    (strip.material as THREE.MeshStandardMaterial).color.setHex(hex);
    (strip.material as THREE.MeshStandardMaterial).emissive.setHex(hex);
    strip.position.set(PANEL_W / 2 + 1.05 + (i - 1) * 0.35, PANEL_Y, 0.06);
    return strip;
  });
  group.add(subpixels);

  const depth = new THREE.Group();
  const bands = pool(MOST_BANDS, () => {
    const strip = add(depth, new THREE.BoxGeometry(1, 0.42, 0.06), mat('dark'));
    const material = strip.material as THREE.MeshStandardMaterial;
    material.metalness = 0;
    material.roughness = 1;
    return strip;
  });
  group.add(depth);

  const data = new THREE.Group();
  const rail = box(data, [BAR_RUN, 0.04, 0.04], 'dark');
  rail.position.set(0, BAR_Y - 0.24, 0);
  const bar = box(data, [1, 0.28, 0.28], 'accent');
  group.add(data);

  const anchors = {
    grid: new THREE.Vector3(0, PANEL_Y + PANEL_H / 2 + 0.5, 0),
    subpixels: new THREE.Vector3(PANEL_W / 2 + 1.05, PANEL_Y + 0.9, 0),
    depth: new THREE.Vector3(-PANEL_W / 2 - 0.6, RAMP_Y, 0),
    data: new THREE.Vector3(-PANEL_W / 2 - 0.6, BAR_Y, 0),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.12, 1).normalize(),
    parts: {grid, subpixels, depth, data},
    anchors,
    update(state) {
      const {value, variant} = state;
      // The stream is the frame times how many of them a second, and a frame
      // rate is chosen as deliberately as a resolution: it is the reason a
      // sixty frame picture costs twice a thirty frame one at the same size.
      const fps = dial(state, 'fps', 30);
      const bits = Number(variant);
      const across = Math.round(value);
      const down = frameHeight(across);

      // The patch holds this many of the picture's pixels, so the rules really
      // are the pixel boundaries at the size the slider asks for.
      const inPatch = Math.max(1, Math.round(across * PATCH));
      // N pixels across the patch have N minus one boundaries inside it, at the
      // multiples of one over N. Drawing N of them puts one pixel more on the
      // panel than the slider asked for, at every setting.
      const cellsAcross = Math.min(MOST_COLUMNS + 1, inPatch);
      const drawnColumns = columns.show(cellsAcross - 1);
      for (let i = 0; i < drawnColumns; i += 1) {
        const at = (i + 1) / cellsAcross;
        columns.items[i].position.set(-PANEL_W / 2 + at * PANEL_W, PANEL_Y, 0.06);
      }
      const cellsDown = Math.min(Math.round((MOST_COLUMNS * 9) / 16) + 1, Math.max(1, Math.round(down * PATCH)));
      const drawnRows = rowsPool.show(cellsDown - 1);
      for (let i = 0; i < drawnRows; i += 1) {
        const at = (i + 1) / cellsDown;
        rowsPool.items[i].position.set(0, PANEL_Y - PANEL_H / 2 + at * PANEL_H, 0.06);
      }

      // The three elements at the brightnesses that make one particular color,
      // quantized to the depth in play so the drawn color is a color the depth
      // can actually name.
      const levels = quantizationLevels(bits) - 1;
      const wanted = [0.85, 0.55, 0.3];
      for (let i = 0; i < elements.length; i += 1) {
        const step = levels === 0 ? wanted[i] : Math.round(wanted[i] * levels) / levels;
        (elements[i].material as THREE.MeshStandardMaterial).emissiveIntensity = step * 1.4;
      }

      // The ramp: always the same 64 strips, each painted with the gray the
      // current depth would store for it. Fewer bits means fewer distinct grays
      // among them, which shows up as visible plateaus rather than as a caption.
      const steps = quantizationLevels(bits);
      const shown = bands.show(MOST_BANDS);
      const width = PANEL_W / shown;
      for (let i = 0; i < shown; i += 1) {
        bands.items[i].scale.x = width;
        bands.items[i].position.set(-PANEL_W / 2 + (i + 0.5) * width, RAMP_Y, 0);
        const wanted = i / (shown - 1);
        // Rounded to the nearest level the depth allows, so both ends stay put:
        // nought is always black and one is always white.
        const stored = Math.round(wanted * (steps - 1)) / (steps - 1);
        const material = bands.items[i].material as THREE.MeshStandardMaterial;
        material.color.setRGB(stored, stored, stored);
        material.emissive.setRGB(stored, stored, stored);
        material.emissiveIntensity = 0.55;
      }

      // The data bar, on a logarithmic scale across the whole span the bench can
      // ask for, because that span is three decades wide.
      // The bar is the stream, not one frame: the frame times how many a second.
      const size = frameBytes(across * down, bits * 3) * (fps / 30);
      const share =
        (Math.log10(size) - Math.log10(SMALLEST)) / (Math.log10(LARGEST) - Math.log10(SMALLEST));
      const length = Math.max(0.08, share * BAR_RUN);
      bar.scale.x = length;
      bar.position.set(-BAR_RUN / 2 + length / 2, BAR_Y, 0);

      anchors.grid.set(0, PANEL_Y + PANEL_H / 2 + 0.5, 0);
    },
  };
}

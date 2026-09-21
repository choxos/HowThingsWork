import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {screenPlan, screenAt, rowStart, fieldsThrough, chromaticityXYZ, mixXYZ, drawnColor, SCREEN, TN, LCD_PANEL, OLED_PANEL, SRGB, EMITTERS, CHANNELS, BACKGROUND_OPTIONS, SCREEN_DEFAULTS, SCREEN_DOMAINS, PAGES} from './lcd-physics.js';

// ---------------------------------------------------------------------------
// LCD screen: a real TN module at true size with the row being written, its
// backlight pulled out from behind it, three of its pixels with their
// transistors and capacitors, the liquid crystal under a red, a green and a
// blue subpixel cut open with the light's polarization through it, the same
// pixels as light, an OLED module's pixels lit by their own currents, and
// charts of light against voltage, light through the frames and color.
//
// Scale: the module and its backlight are drawn at true size, 1 mm to 0.01
// scene units. The pixels, both the LCD's and the OLED's, are drawn 200 times
// larger, 1 μm to 0.002 units. The liquid crystal is cut open 15,000 times
// larger, 1 μm to 0.15 units; its electrodes, filters and polarizers are drawn
// thin and not to scale, and each column is a slice 1.5 μm wide from the middle
// of its subpixel. The charts are not to scale.
//
// Time: the panel is written 100 times slower than it is, said in the part text
// and a reading. The crystal turns on the same slowed clock; an OLED subpixel's
// 10 μs rise is 1 ms here, too quick to see.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const PIXEL = 0.002;
export const CELL = 0.15;

/** How many times larger than true size a scale per μm draws. */
export const timesLarger = perMicron => perMicron / (MM / 1000);

/** The module, mm: its center, the ring's radius around the pixels drawn close up, and the height the row being written is drawn. */
export const PANELVIEW = Object.freeze({origin: Object.freeze([-2.35, 0.95, 0]), ring: 3, scan: 0.6});
/** The backlight, mm: its center, each LED's size, how far below the light guide the LEDs sit, and the arrows showing light entering the guide. */
export const BACKLIGHTVIEW = Object.freeze({origin: Object.freeze([-2.35, 0.03, 0]), led: Object.freeze([3, 1.4]), below: 1.2, arrows: 4, arrow: 12, arrowGap: 3, thickness: 0.0025});
/** Three LCD pixels, μm: the black matrix's width, the strip at a pixel's foot holding the gate line, transistor and capacitor, and where each sits in it. */
export const MATRIXVIEW = Object.freeze({origin: Object.freeze([-0.95, 0.85, 0]), border: 8, strip: 34, gate: 6, gateAt: 10, data: 5, dataAt: 3, tft: 16, tftAt: 14, bar: 8, barAt: 24, barFrom: 26, barLong: 32});
/** The crystal cut open, μm: columns 3.6 apart and 1.5 wide, the electrode, gaps, filter and polarizer thicknesses as drawn, 9 rods each a share of the gap long, the slant of the depth axis, the polarization ellipses beside each column, and the light arrows. */
export const CELLVIEW = Object.freeze({origin: Object.freeze([0.55, 0.72, 0]), spacing: 3.6, slice: 1.5, ito: 0.3, space: 0.2, filter: 0.4, polarizer: 0.35, rods: 9, rodShare: 0.08, cabinet: 0.5, slant: 35 * Math.PI / 180, ellipseAt: 1.6, ellipse: 0.5, ellipsePoints: 24, depths: Object.freeze([0, 10, 20, 30, 40]), wing: 1.0, arrowIn: 0.8, arrowOut: 1.2, arrow: 0.006, axis: 0.8});
/** The pixels as light, μm for the black matrix, and the swatch of their mixture in scene units about the view's center. */
export const SUBPIXVIEW = Object.freeze({origin: Object.freeze([-1.05, -0.85, 0]), border: 8, swatch: Object.freeze([0.66, 1.02, -0.18, 0.18])});
/** The OLED view in scene units about its center: the swatch, the stack under each column, the current and light arrows' scales, and the power bars. */
export const OLEDVIEW = Object.freeze({origin: Object.freeze([2.45, 0.85, 0]), swatch: Object.freeze([0.69, 1.05, -0.18, 0.18]), column: 0.42, stackWidth: 0.3, anode: Object.freeze([-0.92, -0.89]), organic: Object.freeze([-0.89, -0.83]), cathode: Object.freeze([-0.83, -0.80]), currentScale: 200, currentLong: 0.3, lightScale: 3000, lightLong: 0.14, arrow: 0.006, bars: Object.freeze([[0.73, 0.83], [0.91, 1.01]]), barBase: -1.30, perWatt: 0.75, whiteTick: 0.03});
export const CURVES = Object.freeze({x: -2.95, y: -1.35, w: 1.2, h: 0.8, top: 0.9, z: 0, mark: 0.025, tick: 0.02});
export const FRAMES = Object.freeze({x: 0.12, y: -1.35, w: 1.55, h: 0.8, top: 0.9, z: 0, tick: 0.02, cursor: 0.02, samples: 241});
export const COLORCHART = Object.freeze({x: 1.85, y: -1.35, scale: 0.9, xMax: 0.8, yMax: 0.9, z: 0, mark: 0.015});
export const COLORS = Object.freeze({body: 0x2f3336, bezel: 0x1d2023, guide: 0xdfe8ee, led: 0xfff1c2, matrix: 0x16181a, gate: 0x7d6f60, data: 0x8b8f93, tft: 0x5b6770, plus: 0xd99a2b, minus: 0x2b5d9c, scan: 0xe08a1e, ito: 0x9fc3cf, polarizer: 0x7a8588, lc: 0xe6ecee, rod: 0x2f3a33, light: 0xf2d98a, chart: 0x374736, faint: 0x9aa39a, red: 0xc14f39, green: 0x3f8f4f, blue: 0x2b5d9c, oled: 0x101214, anode: 0xbfd3dc, organic: 0xd8c7e6, cathode: 0x8a8f94, current: 0xd99a2b, srgb: 0xb9c2b9, oledLine: 0x8a4fa3});

/** Where a voltage and a share of white fall on the light against voltage chart. */
export const curveX = volts => CURVES.x + Math.max(0, Math.min(1, volts / TN.black)) * CURVES.w;
export const curveY = share => CURVES.y + Math.max(0, Math.min(1, share)) * CURVES.top * CURVES.h;
/** Where a time, s, and a share of white fall on the frames chart. */
export const framesX = (plan, t) => FRAMES.x + Math.max(0, Math.min(1, t / plan.duration)) * FRAMES.w;
export const framesY = share => FRAMES.y + Math.max(0, Math.min(1, share)) * FRAMES.top * FRAMES.h;
/** Where a chromaticity falls on the color chart. */
export const colorX = x => COLORCHART.x + Math.max(0, Math.min(COLORCHART.xMax, x)) * COLORCHART.scale;
export const colorY = y => COLORCHART.y + Math.max(0, Math.min(COLORCHART.yMax, y)) * COLORCHART.scale;

/** The sRGB code to draw a subpixel of `panel`'s channel `c` shining at `level` of its own full light: its primary scaled so its brightest component is full. */
export function subpixelColor(panel, c, level) {
  const xyz = chromaticityXYZ([panel.red, panel.green, panel.blue][c]);
  const linear = SRGB.fromXYZ.map(row => row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2]), top = Math.max(...linear);
  return linear.map(value => {
    const light = Math.max(0, Math.min(1, value / top * Math.max(0, Math.min(1, level))));
    return light <= SRGB.linearThreshold ? SRGB.slope * light : SRGB.scale * light ** (1 / SRGB.exponent) - SRGB.offset;
  });
}

/** A rod through the director at tilt θ and twist φ, as a unit drawing direction: the twist's depth into the page slanted by the cabinet factor. */
export const rodDirection = (theta, phi) => [Math.cos(theta) * Math.cos(phi) + CELLVIEW.cabinet * Math.cos(theta) * Math.sin(phi) * Math.cos(CELLVIEW.slant), Math.sin(theta) + CELLVIEW.cabinet * Math.cos(theta) * Math.sin(phi) * Math.sin(CELLVIEW.slant)];

/** A value between the director's depths, at a share of the gap from the rear plate. */
export const atDepth = (values, share) => { const N = values.length - 1, x = share * N, i = Math.min(N - 1, Math.floor(x)); return values[i] + (values[i + 1] - values[i]) * (x - i); };

/** The pixel close ups' rectangles, μm about the block's center: pixel row 0 at the top, subpixel columns red, green, blue from the left. */
export function subpixelBox(pitch, pitchDown, row, column, sub) {
  const x0 = (column - 1.5) * pitch + sub * pitch / 3, y1 = (1.5 - row) * pitchDown;
  return {x0, x1: x0 + pitch / 3, y0: y1 - pitchDown, y1};
}

export function createLcdScreenModel() {
  const kit = houseModel('LCD screen'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const matrix4 = new THREE.Matrix4(), tint = new THREE.Color();
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const instanced = (count, parent) => { const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), unlit(0xffffff), count); mesh.frustumCulled = false; parent.add(mesh); return mesh; };
  const place = (mesh, i, x0, x1, y0, y1, z) => { matrix4.makeScale(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1).setPosition((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.setMatrixAt(i, matrix4); };
  const paint = (mesh, i, rgb) => { tint.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace); mesh.setColorAt(i, tint); };
  const settle = mesh => { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); };
  const frameLine = (line, x, y, w, h, z = 0) => fillLine(line, [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]]);
  const cross = (line, x, y, arm, z = 0) => fillLine(line, [[x - arm, y, z], [x + arm, y, z], [x, y - arm, z], [x, y + arm, z]]);
  const channelColor = [COLORS.red, COLORS.green, COLORS.blue];

  const pitch = LCD_PANEL.active[0] / LCD_PANEL.columns * 1000, pitchDown = LCD_PANEL.active[1] / LCD_PANEL.rows * 1000;
  const [aw, ah] = LCD_PANEL.active, closeRow = SCREEN.closeRows[0] + 1, closeColumn = SCREEN.closeColumns[0] + 1;
  const ringX = -aw / 2 + (closeColumn + 0.5) * pitch / 1000, ringY = ah / 2 - (closeRow + 0.5) * pitchDown / 1000;

  const system = part('system', 'LCD screen, close up', `An ${LCD_PANEL.name} LCD module and its backlight at true size, three of its pixels ${fixed(timesLarger(PIXEL), 0)} times larger with their transistors and capacitors, the liquid crystal under a red, a green and a blue subpixel cut open ${fixed(timesLarger(CELL), 0)} times larger, the same pixels as light, an OLED module’s pixels ${fixed(timesLarger(PIXEL), 0)} times larger, and charts. Press Play to write a patch over a black picture, ${SCREEN.slow} times slower than the panel writes it.`);

  // The module at true size.
  const panel = part('panel', 'The screen, true size', `The ${LCD_PANEL.name} module drawn at true size: ${LCD_PANEL.columns} by ${LCD_PANEL.rows} pixels on an active area ${fixed(aw, 2)} by ${fixed(ah, 2)} mm, normally white, lit from behind. The orange line is the row being written, drawn thicker than a row; the ring marks the pixels drawn close up. The module is drawn centered in its outline.`, PANELVIEW.origin, system);
  const body = flat(COLORS.body, panel), bezel = flat(COLORS.bezel, panel);
  rect(body, -LCD_PANEL.outline[0] / 2 * MM, LCD_PANEL.outline[0] / 2 * MM, -LCD_PANEL.outline[1] / 2 * MM, LCD_PANEL.outline[1] / 2 * MM, 0);
  rect(bezel, -LCD_PANEL.bezel[0] / 2 * MM, LCD_PANEL.bezel[0] / 2 * MM, -LCD_PANEL.bezel[1] / 2 * MM, LCD_PANEL.bezel[1] / 2 * MM, 0.0005);
  const bandCount = Math.ceil(LCD_PANEL.rows / SCREEN.band), bands = instanced(bandCount * 3, panel);
  const scanBar = flat(COLORS.scan, panel);
  const ring = lineObject(49, COLORS.scan, panel);
  fillLine(ring, Array.from({length: 49}, (_, i) => { const a = 2 * Math.PI * i / 48; return [(ringX + PANELVIEW.ring * Math.cos(a)) * MM, (ringY + PANELVIEW.ring * Math.sin(a)) * MM, 0.003]; }));
  const leaders = segmentLines(2, COLORS.faint, system);

  // The backlight at true size.
  const backlight = part('backlight', 'Backlight, true size', `The module’s backlight at true size, drawn pulled out from behind the screen: a light guide the size of the polarizer, ${fixed(LCD_PANEL.polarizer[0], 0)} by ${fixed(LCD_PANEL.polarizer[1], 1)} mm, with ${LCD_PANEL.backlight.strings * LCD_PANEL.backlight.perString} white LEDs along one edge in two strings of ${LCD_PANEL.backlight.perString}, as the datasheet’s circuit draws them. They take ${fixed(LCD_PANEL.backlight.current * 1000, 0)} mA at ${fixed(LCD_PANEL.backlight.voltage, 1)} V whatever the picture. The LEDs’ size is illustrative.`, BACKLIGHTVIEW.origin, system);
  const [gw, gh] = LCD_PANEL.polarizer, guide = flat(COLORS.guide, backlight);
  rect(guide, -gw / 2 * MM, gw / 2 * MM, -gh / 2 * MM, gh / 2 * MM, 0);
  const ledCount = LCD_PANEL.backlight.strings * LCD_PANEL.backlight.perString, leds = instanced(ledCount, backlight);
  for (let i = 0; i < ledCount; i++) {
    const x = -gw / 2 + (i + 0.5) * gw / ledCount, y = -gh / 2 - BACKLIGHTVIEW.below;
    place(leds, i, (x - BACKLIGHTVIEW.led[0] / 2) * MM, (x + BACKLIGHTVIEW.led[0] / 2) * MM, (y - BACKLIGHTVIEW.led[1] / 2) * MM, (y + BACKLIGHTVIEW.led[1] / 2) * MM, 0.001);
    paint(leds, i, [1, 0.945, 0.76]);
  }
  settle(leds);
  const glow = Array.from({length: BACKLIGHTVIEW.arrows}, (_, i) => {
    const arrow = solidArrow(kit, COLORS.light, backlight, BACKLIGHTVIEW.thickness);
    arrow.position.set((-gw / 2 + (i + 0.5) * gw / BACKLIGHTVIEW.arrows) * MM, (-gh / 2 + BACKLIGHTVIEW.arrowGap) * MM, 0.002);
    arrow.userData.setLength(BACKLIGHTVIEW.arrow * MM);
    return arrow;
  });

  // Three LCD pixels with their transistors and capacitors, 200 times larger.
  const matrixPart = part('matrix', 'Transistors and capacitors, close up', `Three by three pixels in the middle of the patch drawn ${fixed(timesLarger(PIXEL), 0)} times larger, ${fixed(pitch, 0)} μm apart: each subpixel’s window in its filter’s color, as bright as the light it lets through now; the transistor at the foot of its column’s data line on its row’s gate line; and a bar for the voltage its capacitor holds, orange for positive and blue for negative, full at ${fixed(TN.black, 0)} V. A gate line turns orange while its row is written. The black matrix, lines and transistors are drawn to a declared layout.`, MATRIXVIEW.origin, system);
  const matrixBack = flat(COLORS.matrix, matrixPart);
  rect(matrixBack, -1.5 * pitch * PIXEL, 1.5 * pitch * PIXEL, -1.5 * pitchDown * PIXEL, 1.5 * pitchDown * PIXEL, 0);
  const windows = instanced(27, matrixPart), tfts = instanced(27, matrixPart), bars = instanced(27, matrixPart);
  const dataLines = instanced(9, matrixPart);
  const gateLines = Array.from({length: 3}, () => flat(COLORS.gate, matrixPart));
  for (let column = 0; column < 3; column++) {
    for (let sub = 0; sub < 3; sub++) {
      const box = subpixelBox(pitch, pitchDown, 0, column, sub), x = box.x0 + MATRIXVIEW.dataAt;
      place(dataLines, column * 3 + sub, (x - MATRIXVIEW.data / 2) * PIXEL, (x + MATRIXVIEW.data / 2) * PIXEL, -1.5 * pitchDown * PIXEL, 1.5 * pitchDown * PIXEL, 0.0015);
      paint(dataLines, column * 3 + sub, [0.545, 0.561, 0.576]);
    }
  }
  settle(dataLines);
  gateLines.forEach((line, row) => { const y = (1.5 - row - 1) * pitchDown + MATRIXVIEW.gateAt; rect(line, -1.5 * pitch * PIXEL, 1.5 * pitch * PIXEL, (y - MATRIXVIEW.gate / 2) * PIXEL, (y + MATRIXVIEW.gate / 2) * PIXEL, 0.002); });
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      for (let sub = 0; sub < 3; sub++) {
        const i = (row * 3 + column) * 3 + sub, box = subpixelBox(pitch, pitchDown, row, column, sub);
        place(windows, i, (box.x0 + MATRIXVIEW.border) * PIXEL, (box.x1 - MATRIXVIEW.border) * PIXEL, (box.y0 + MATRIXVIEW.strip) * PIXEL, (box.y1 - MATRIXVIEW.border) * PIXEL, 0.001);
        const tx = box.x0 + MATRIXVIEW.tftAt, ty = box.y0 + MATRIXVIEW.gateAt;
        place(tfts, i, (tx - MATRIXVIEW.tft / 2) * PIXEL, (tx + MATRIXVIEW.tft / 2) * PIXEL, (ty - MATRIXVIEW.tft / 2) * PIXEL, (ty + MATRIXVIEW.tft / 2) * PIXEL, 0.003);
        paint(tfts, i, [0.357, 0.404, 0.439]);
      }
    }
  }
  settle(tfts);

  // The liquid crystal cut open, 15,000 times larger.
  const cell = part('cell', 'Liquid crystal, cut open', `The liquid crystal under the middle pixel’s red, green and blue subpixels cut open ${fixed(timesLarger(CELL), 0)} times larger, each a slice ${fixed(CELLVIEW.slice, 1)} μm wide between its transparent electrodes, lit from below through the rear polarizer and leaving through its color filter and the crossed front polarizer. The lines are the director at ${CELLVIEW.rods} depths, each drawn ${fixed(100 * CELLVIEW.rodShare, 0)}% of the gap long, with the direction into the page slanted up and to the right; the ellipses beside each column show the light’s polarization at ${CELLVIEW.depths.length} depths; the arrows above show how much light leaves each subpixel. The electrodes, filters and polarizers are drawn thin and not to scale. The Light room’s Liquid crystal display shows one segment’s polarizers.`, CELLVIEW.origin, system);
  const slices = CHANNELS.map((_, c) => {
    const lc = flat(COLORS.lc, cell), rearIto = flat(COLORS.ito, cell), frontIto = flat(COLORS.ito, cell), filter = flat(channelColor[c], cell), rear = flat(COLORS.polarizer, cell), front = flat(COLORS.polarizer, cell);
    filter.material.color.setRGB(...subpixelColor(LCD_PANEL, c, 1), THREE.SRGBColorSpace);
    const into = solidArrow(kit, COLORS.light, cell, CELLVIEW.arrow), out = solidArrow(kit, channelColor[c], cell, CELLVIEW.arrow);
    return {lc, rearIto, frontIto, filter, rear, front, into, out};
  });
  const rods = segmentLines(CHANNELS.length * CELLVIEW.rods, COLORS.rod, cell);
  const ellipses = segmentLines(CHANNELS.length * CELLVIEW.depths.length * CELLVIEW.ellipsePoints, COLORS.chart, cell);
  const axes = segmentLines(CHANNELS.length * 2, COLORS.chart, cell);

  // The pixels as light, 200 times larger.
  const subpixels = part('subpixels', 'RGB subpixels', `The same three by three pixels drawn as light, ${fixed(timesLarger(PIXEL), 0)} times larger: each subpixel in its filter’s color, as bright as its share of its own full light, with the black matrix between them drawn ${MATRIXVIEW.border} μm wide. The square beside them is the color they add up to, as an eye sees them from ${SCREEN.viewing} mm, where a subpixel spans less than the ${PAGES.acuity} arc minute an eye resolves.`, SUBPIXVIEW.origin, system);
  const lightBack = flat(COLORS.matrix, subpixels);
  rect(lightBack, -1.5 * pitch * PIXEL, 1.5 * pitch * PIXEL, -1.5 * pitchDown * PIXEL, 1.5 * pitchDown * PIXEL, 0);
  const lights = instanced(27, subpixels);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) for (let sub = 0; sub < 3; sub++) {
    const box = subpixelBox(pitch, pitchDown, row, column, sub), i = (row * 3 + column) * 3 + sub;
    place(lights, i, (box.x0 + SUBPIXVIEW.border) * PIXEL, (box.x1 - SUBPIXVIEW.border) * PIXEL, (box.y0 + SUBPIXVIEW.border) * PIXEL, (box.y1 - SUBPIXVIEW.border) * PIXEL, 0.001);
  }
  const lcdSwatch = flat(0xffffff, subpixels);
  rect(lcdSwatch, ...SUBPIXVIEW.swatch, 0.001);

  // The OLED module's pixels, 200 times larger, a subpixel's stack and the power.
  const oledPitch = OLED_PANEL.pitch * 1000, [ow, oh] = OLED_PANEL.subpixel.map(v => v * 1000), [gapAcross, gapDown] = OLED_PANEL.gaps.map(v => v * 1000);
  const oled = part('oled', 'OLED subpixels', `Three by three pixels of the ${OLED_PANEL.name} OLED module drawn ${fixed(timesLarger(PIXEL), 0)} times larger, ${fixed(oledPitch, 0)} μm apart with subpixels ${fixed(ow, 0)} by ${fixed(oh, 0)} μm as its drawing gives, each shining with its own current and dark with none. The square beside them is their mixture. Below each column, a subpixel’s stack of anode, organic layers and cathode, with the current density into it (full arrow ${fixed(OLEDVIEW.currentScale / 10, 0)} mA/cm²) and the light out of it (full arrow ${fixed(OLEDVIEW.lightScale, 0)} cd/m²), for the picture on an OLED as large and as bright as the LCD. The bars compare the LCD’s backlight power with that OLED’s, the tick marking a white screen.`, OLEDVIEW.origin, system);
  const oledBack = flat(COLORS.oled, oled);
  rect(oledBack, -1.5 * oledPitch * PIXEL, 1.5 * oledPitch * PIXEL, -1.5 * oledPitch * PIXEL, 1.5 * oledPitch * PIXEL, 0);
  const emitters = instanced(27, oled);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) for (let sub = 0; sub < 3; sub++) {
    const box = subpixelBox(oledPitch, oledPitch, row, column, sub), i = (row * 3 + column) * 3 + sub;
    place(emitters, i, (box.x0 + gapAcross / 2) * PIXEL, (box.x0 + gapAcross / 2 + ow) * PIXEL, (box.y0 + gapDown / 2) * PIXEL, (box.y0 + gapDown / 2 + oh) * PIXEL, 0.001);
  }
  const oledSwatch = flat(0xffffff, oled);
  rect(oledSwatch, ...OLEDVIEW.swatch, 0.001);
  const stacks = CHANNELS.map((_, c) => {
    const x = (c - 1) * OLEDVIEW.column, half = OLEDVIEW.stackWidth / 2, anode = flat(COLORS.anode, oled), organic = flat(COLORS.organic, oled), cathode = flat(COLORS.cathode, oled);
    rect(anode, x - half, x + half, ...OLEDVIEW.anode, 0.001);
    rect(organic, x - half, x + half, ...OLEDVIEW.organic, 0.001);
    rect(cathode, x - half, x + half, ...OLEDVIEW.cathode, 0.001);
    organic.material.color.setRGB(...subpixelColor(OLED_PANEL, c, 0.35), THREE.SRGBColorSpace);
    const current = solidArrow(kit, COLORS.current, oled, OLEDVIEW.arrow), shine = solidArrow(kit, channelColor[c], oled, OLEDVIEW.arrow);
    return {anode, organic, cathode, current, shine};
  });
  const powerBars = OLEDVIEW.bars.map((_, i) => flat(i ? COLORS.oledLine : COLORS.guide, oled));
  const powerBase = segmentLines(2, COLORS.chart, oled);
  fillLine(powerBase, [[OLEDVIEW.bars[0][0] - 0.03, OLEDVIEW.barBase, 0.001], [OLEDVIEW.bars[1][1] + 0.03, OLEDVIEW.barBase, 0.001]]);

  // Light against voltage.
  const curves = part('curves', 'Light against voltage', `How much light each channel lets through at every drive from 0 to ${fixed(TN.black, 0)} V, from its black at the bottom to its own white at the top, worked out from the director at rest and the light through it. The marks are the voltages the codes ask for; the tick below the chart marks where a cell with no pretilt starts to tilt.`, [0, 0, 0], system);
  const curvesFrame = lineObject(5, COLORS.chart, curves);
  frameLine(curvesFrame, CURVES.x, CURVES.y, CURVES.w, CURVES.h, CURVES.z);
  const curveLines = CHANNELS.map((_, c) => lineObject(Math.round(TN.black / TN.step) + 1, channelColor[c], curves));
  const driveMarks = CHANNELS.map((_, c) => segmentLines(2, channelColor[c], curves));
  const onsetTick = segmentLines(1, COLORS.chart, curves);

  // Light through the frames.
  const frames = part('frames', 'Light through the frames', `The light from the middle pixel’s red, green and blue subpixels through ${SCREEN.frames} frames: the LCD in full lines, rising only as its crystal turns, and the OLED in thin lines, lit the moment its row is written. Faint: the whole of each LCD curve. Ticks below the chart mark each frame.`, [0, 0, 0], system);
  const framesFrame = lineObject(5, COLORS.chart, frames);
  frameLine(framesFrame, FRAMES.x, FRAMES.y, FRAMES.w, FRAMES.h, FRAMES.z);
  const frameTicks = segmentLines(SCREEN.frames - 1, COLORS.chart, frames);
  const guides = CHANNELS.map(() => lineObject(FRAMES.samples, COLORS.faint, frames));
  const lcdLines = CHANNELS.map((_, c) => lineObject(FRAMES.samples + 1, channelColor[c], frames));
  const oledLines = CHANNELS.map(() => lineObject(4, COLORS.oledLine, frames));
  const framesCursor = segmentLines(2, COLORS.chart, frames);

  // Color.
  const color = part('color', 'Color mixing chart', `The CIE xy chart from 0 to ${fixed(COLORCHART.xMax, 1)} across and 0 to ${fixed(COLORCHART.yMax, 1)} up: the sRGB triangle faint, the LCD module’s red, green and blue at the corners of the dark triangle and the OLED module’s at the purple one. Every mixture of a panel’s three lies inside its triangle. The dark cross is where the LCD patch has got to, the plus signs where the LCD and the OLED patches settle.`, [0, 0, 0], system);
  const colorFrame = lineObject(5, COLORS.chart, color);
  frameLine(colorFrame, COLORCHART.x, COLORCHART.y, COLORCHART.xMax * COLORCHART.scale, COLORCHART.yMax * COLORCHART.scale, COLORCHART.z);
  const triangle = (panelLike, lineColor) => { const line = lineObject(4, lineColor, color); fillLine(line, [panelLike.red, panelLike.green, panelLike.blue, panelLike.red].map(([x, y]) => [colorX(x), colorY(y), COLORCHART.z])); return line; };
  const srgbTriangle = triangle(SRGB, COLORS.srgb), lcdTriangle = triangle(LCD_PANEL, COLORS.chart), oledTriangle = triangle(OLED_PANEL, COLORS.oledLine);
  const lcdNowMark = segmentLines(2, COLORS.chart, color), lcdMark = segmentLines(2, COLORS.chart, color), oledMark = segmentLines(2, COLORS.oledLine, color);

  const d = SCREEN_DEFAULTS, dom = SCREEN_DOMAINS;
  control('red', 'Red code', ...dom.red, d.red, '', 'The patch’s red value, 0 to 255, as a picture file stores it.');
  control('green', 'Green code', ...dom.green, d.green, '', 'The patch’s green value, 0 to 255.');
  control('blue', 'Blue code', ...dom.blue, d.blue, '', 'The patch’s blue value, 0 to 255.');
  control('background', 'Background', ...dom.background, d.background, '', 'What the rest of the screen shows around the patch.', BACKGROUND_OPTIONS);
  control('gap', 'Cell gap', ...dom.gap, d.gap, 'μm', 'How thick the liquid crystal layer is. The Liquid crystal page gives 4 μm as typical.');

  const result = finish(v => {
    const plan = screenPlan(v), now = screenAt(plan, clock), middle = now.middle;

    // The panel's bands of rows, each written at its own moment.
    now.bands.forEach((band, b) => {
      const y1 = ah / 2 - band.row * pitchDown / 1000, y0 = Math.max(-ah / 2, y1 - SCREEN.band * pitchDown / 1000);
      const back = drawnColor(mixXYZ(LCD_PANEL, band.back, plan.lcdShares), LCD_PANEL).rgb, patch = band.patch ? drawnColor(mixXYZ(LCD_PANEL, band.patch, plan.lcdShares), LCD_PANEL).rgb : back;
      const xs = [-aw / 2, -aw / 2 + SCREEN.patchColumns[0] * pitch / 1000, -aw / 2 + SCREEN.patchColumns[1] * pitch / 1000, aw / 2];
      for (let k = 0; k < 3; k++) {
        place(bands, b * 3 + k, xs[k] * MM, xs[k + 1] * MM, y0 * MM, y1 * MM, 0.001);
        paint(bands, b * 3 + k, k === 1 ? patch : back);
      }
    });
    settle(bands);
    const scanY = now.scanRow === null ? 0 : ah / 2 - (now.scanRow + 0.5) * pitchDown / 1000;
    rect(scanBar, -aw / 2 * MM, aw / 2 * MM, (scanY - PANELVIEW.scan / 2) * MM, (scanY + PANELVIEW.scan / 2) * MM, 0.002);
    scanBar.visible = now.scanRow !== null;
    fillLine(leaders, [[PANELVIEW.origin[0] + (ringX + PANELVIEW.ring) * MM, PANELVIEW.origin[1] + ringY * MM, 0], [MATRIXVIEW.origin[0] - 1.5 * pitch * PIXEL, MATRIXVIEW.origin[1], 0], [MATRIXVIEW.origin[0] + 1.5 * pitch * PIXEL, MATRIXVIEW.origin[1], 0], [CELLVIEW.origin[0] - (CELLVIEW.spacing + CELLVIEW.wing) * CELL, CELLVIEW.origin[1], 0]]);

    // The close up: windows, capacitors and gate lines.
    for (let row = 0; row < 3; row++) {
      const info = now.rows[row];
      gateLines[row].material.color.setHex(now.scanRow === info.row ? COLORS.scan : COLORS.gate);
      for (let column = 0; column < 3; column++) for (let sub = 0; sub < 3; sub++) {
        const i = (row * 3 + column) * 3 + sub, box = subpixelBox(pitch, pitchDown, row, column, sub), held = info.held[sub];
        paint(windows, i, subpixelColor(LCD_PANEL, sub, info.lcd[sub]));
        const x0 = box.x0 + MATRIXVIEW.barFrom, length = MATRIXVIEW.barLong * Math.abs(held) / TN.black, y = box.y0 + MATRIXVIEW.barAt;
        place(bars, i, x0 * PIXEL, (x0 + length) * PIXEL, (y - MATRIXVIEW.bar / 2) * PIXEL, (y + MATRIXVIEW.bar / 2) * PIXEL, 0.003);
        paint(bars, i, held >= 0 ? [0.851, 0.604, 0.169] : [0.169, 0.365, 0.612]);
        paint(lights, i, subpixelColor(LCD_PANEL, sub, info.lcd[sub]));
        paint(emitters, i, subpixelColor(OLED_PANEL, sub, info.oled[sub]));
      }
    }
    for (const mesh of [windows, bars, lights, emitters]) settle(mesh);
    lcdSwatch.material.color.setRGB(...drawnColor(now.lcdNow, LCD_PANEL).rgb, THREE.SRGBColorSpace);
    oledSwatch.material.color.setRGB(...drawnColor(now.oledNow, OLED_PANEL).rgb, THREE.SRGBColorSpace);

    // The crystal cut open.
    const gap = plan.gap, rodPairs = [], ellipsePairs = [], axisPairs = [];
    CHANNELS.forEach((_, c) => {
      const s = slices[c], X = (c - 1) * CELLVIEW.spacing, half = CELLVIEW.slice / 2, wing = CELLVIEW.wing, top = gap / 2, bottom = -gap / 2;
      rect(s.lc, (X - half) * CELL, (X + half) * CELL, bottom * CELL, top * CELL, 0);
      rect(s.rearIto, (X - wing) * CELL, (X + wing) * CELL, (bottom - CELLVIEW.ito) * CELL, bottom * CELL, 0.001);
      rect(s.frontIto, (X - wing) * CELL, (X + wing) * CELL, top * CELL, (top + CELLVIEW.ito) * CELL, 0.001);
      const filterBottom = top + CELLVIEW.ito + CELLVIEW.space, frontBottom = filterBottom + CELLVIEW.filter + CELLVIEW.space, rearTop = bottom - CELLVIEW.ito - CELLVIEW.space;
      rect(s.filter, (X - half) * CELL, (X + half) * CELL, filterBottom * CELL, (filterBottom + CELLVIEW.filter) * CELL, 0.001);
      rect(s.front, (X - wing) * CELL, (X + wing) * CELL, frontBottom * CELL, (frontBottom + CELLVIEW.polarizer) * CELL, 0.001);
      rect(s.rear, (X - wing) * CELL, (X + wing) * CELL, (rearTop - CELLVIEW.polarizer) * CELL, rearTop * CELL, 0.001);
      const rearMid = rearTop - CELLVIEW.polarizer / 2, frontMid = frontBottom + CELLVIEW.polarizer / 2, slantX = CELLVIEW.cabinet * Math.cos(CELLVIEW.slant), slantY = CELLVIEW.cabinet * Math.sin(CELLVIEW.slant);
      axisPairs.push([(X - CELLVIEW.axis) * CELL, rearMid * CELL, 0.002], [(X + CELLVIEW.axis) * CELL, rearMid * CELL, 0.002]);
      const reach = CELLVIEW.polarizer / 2 / slantY * 0.8;
      axisPairs.push([(X - reach * slantX) * CELL, (frontMid - reach * slantY) * CELL, 0.002], [(X + reach * slantX) * CELL, (frontMid + reach * slantY) * CELL, 0.002]);
      s.into.position.set(X * CELL, (rearTop - CELLVIEW.polarizer - CELLVIEW.space - CELLVIEW.arrowIn) * CELL, 0.003);
      s.into.userData.setLength(CELLVIEW.arrowIn * CELL);
      s.out.position.set(X * CELL, (frontBottom + CELLVIEW.polarizer + CELLVIEW.space) * CELL, 0.003);
      s.out.userData.setLength(CELLVIEW.arrowOut * Math.max(0, Math.min(1, middle.lcd[c])) * CELL);
      const {theta, phi} = now.directors[c], L = CELLVIEW.rodShare * gap;
      for (let k = 0; k < CELLVIEW.rods; k++) {
        const share = (k + 1) / (CELLVIEW.rods + 1), [dx, dy] = rodDirection(atDepth(theta, share), atDepth(phi, share)), y = bottom + share * gap;
        rodPairs.push([(X - L * dx) * CELL, (y - L * dy) * CELL, 0.002], [(X + L * dx) * CELL, (y + L * dy) * CELL, 0.002]);
      }
      const fields = fieldsThrough(theta, phi, gap, TN.wavelengths[c], CELLVIEW.depths), R = CELLVIEW.ellipse, cx = X + CELLVIEW.ellipseAt;
      fields.forEach((E, k) => {
        const y = bottom + CELLVIEW.depths[k] / (theta.length - 1) * gap;
        const point = m => { const w = 2 * Math.PI * m / CELLVIEW.ellipsePoints, ex = E[0] * Math.cos(w) - E[1] * Math.sin(w), ey = E[2] * Math.cos(w) - E[3] * Math.sin(w); return [(cx + R * (ex + ey * slantX)) * CELL, (y + R * ey * slantY) * CELL, 0.002]; };
        for (let m = 0; m < CELLVIEW.ellipsePoints; m++) ellipsePairs.push(point(m), point(m + 1));
      });
    });
    fillLine(rods, rodPairs);
    fillLine(ellipses, ellipsePairs);
    fillLine(axes, axisPairs);

    // The OLED stack and the power.
    stacks.forEach((stack, c) => {
      const x = (c - 1) * OLEDVIEW.column, J = plan.densities[c] * middle.oled[c] / Math.max(1e-12, plan.linear[c] || 1), L = plan.emitting[c] * middle.oled[c] / Math.max(1e-12, plan.linear[c] || 1);
      const currentLength = OLEDVIEW.currentLong * Math.min(1, J / OLEDVIEW.currentScale), lightLength = OLEDVIEW.lightLong * Math.min(1, L / OLEDVIEW.lightScale);
      stack.current.position.set(x, OLEDVIEW.anode[0] - currentLength, 0.002);
      stack.current.userData.setLength(currentLength);
      stack.shine.position.set(x, OLEDVIEW.cathode[1], 0.002);
      stack.shine.userData.setLength(lightLength);
    });
    const heights = [plan.backlightPower, plan.oledPower].map(watts => watts * OLEDVIEW.perWatt);
    powerBars.forEach((bar, i) => { rect(bar, OLEDVIEW.bars[i][0], OLEDVIEW.bars[i][1], OLEDVIEW.barBase, OLEDVIEW.barBase + heights[i], 0.001); bar.visible = heights[i] > 1e-9; });
    const whiteY = OLEDVIEW.barBase + plan.oledWhitePower * OLEDVIEW.perWatt;
    fillLine(powerBase, [[OLEDVIEW.bars[0][0] - 0.03, OLEDVIEW.barBase, 0.001], [OLEDVIEW.bars[1][1] + 0.03, OLEDVIEW.barBase, 0.001], [OLEDVIEW.bars[1][0] - OLEDVIEW.whiteTick, whiteY, 0.002], [OLEDVIEW.bars[1][1] + OLEDVIEW.whiteTick, whiteY, 0.002]]);

    // Light against voltage.
    plan.lcd.channels.forEach((channel, c) => {
      fillLine(curveLines[c], Array.from(channel.light, (T, i) => [curveX(plan.table.volts[i]), curveY((T - channel.blackT) / (channel.whiteT - channel.blackT)), CURVES.z]));
      const share = (plan.settled[c] * channel.whiteT - channel.blackT) / (channel.whiteT - channel.blackT);
      cross(driveMarks[c], curveX(plan.volts[c]), curveY(share), CURVES.mark, CURVES.z);
    });
    fillLine(onsetTick, [[curveX(plan.onset), CURVES.y, CURVES.z], [curveX(plan.onset), CURVES.y - CURVES.tick, CURVES.z]]);

    // Light through the frames.
    const start = rowStart(middle.row), lcdAt = (c, t) => (t < start ? plan.before[c] : seriesValue(plan.patchFlows[c], c, t - start) / plan.whites[c]);
    fillLine(frameTicks, Array.from({length: SCREEN.frames - 1}, (_, k) => { const x = framesX(plan, (k + 1) * plan.frame); return [[x, FRAMES.y, FRAMES.z], [x, FRAMES.y - FRAMES.tick, FRAMES.z]]; }).flat());
    CHANNELS.forEach((_, c) => {
      const samples = Array.from({length: FRAMES.samples}, (_, j) => plan.duration * j / (FRAMES.samples - 1));
      fillLine(guides[c], samples.map(t => [framesX(plan, t), framesY(lcdAt(c, t)), FRAMES.z]));
      const shown = samples.filter(t => t < now.t);
      fillLine(lcdLines[c], clock > 0 ? [...shown.map(t => [framesX(plan, t), framesY(lcdAt(c, t)), FRAMES.z]), [framesX(plan, now.t), framesY(middle.lcd[c]), FRAMES.z]] : []);
      fillLine(oledLines[c], clock <= 0 ? [] : now.t < start ? [[framesX(plan, 0), framesY(0), FRAMES.z], [framesX(plan, now.t), framesY(0), FRAMES.z]] : [[framesX(plan, 0), framesY(0), FRAMES.z], [framesX(plan, start), framesY(0), FRAMES.z], [framesX(plan, start), framesY(plan.linear[c]), FRAMES.z], [framesX(plan, now.t), framesY(middle.oled[c]), FRAMES.z]]);
    });
    cross(framesCursor, framesX(plan, now.t), framesY(middle.lcd[1]), FRAMES.cursor, FRAMES.z);

    // Color.
    const lcdNowXY = chromaticityOfDrawn(now.lcdNow);
    if (lcdNowXY) cross(lcdNowMark, colorX(lcdNowXY[0]), colorY(lcdNowXY[1]), COLORCHART.mark, COLORCHART.z); else fillLine(lcdNowMark, []);
    const plus = (line, xy) => (xy ? fillLine(line, [[colorX(xy[0]) - COLORCHART.mark, colorY(xy[1]) + COLORCHART.mark, COLORCHART.z], [colorX(xy[0]) + COLORCHART.mark, colorY(xy[1]) - COLORCHART.mark, COLORCHART.z], [colorX(xy[0]) - COLORCHART.mark, colorY(xy[1]) - COLORCHART.mark, COLORCHART.z], [colorX(xy[0]) + COLORCHART.mark, colorY(xy[1]) + COLORCHART.mark, COLORCHART.z]]) : fillLine(line, []));
    plus(lcdMark, plan.lcdPatchXY);
    plus(oledMark, plan.oledPatchXY);

    // Readings.
    const pct = (share, digits = 1) => `${fixed(100 * share, digits)}%`, ms = seconds => `${fixed(seconds * 1000, 1)} ms`;
    const names = ['red', 'green', 'blue'], codes = plan.codes.join(', ');
    const status = clock <= 0 ? `Ready · a black picture, every subpixel held at ${fixed(TN.black, 0)} V; press Play to write the patch ${codes}`
      : !now.done ? `Frame ${now.frame + 1} of ${plan.frames} · ${now.scanRow === null ? 'between frames' : `writing row ${now.scanRow + 1} of ${LCD_PANEL.rows}`} · ${middle.writes ? `LCD patch ${now.patchProgress === null ? 'unchanged' : `${pct(now.patchProgress, 0)} of the way to its color`}, OLED patch lit` : 'the patch’s rows not yet written'}`
      : `Written · after ${plan.frames} frames the LCD patch is ${now.patchProgress === null ? 'unchanged' : `${pct(now.patchProgress, 0)} of the way to its color`}; the OLED patch lit within ${fixed(OLED_PANEL.rise * 1e6, 0)} μs of its row`;
    const response = plan.responses.map((item, c) => (item ? `${names[c]} ${ms(item.span)}` : Math.abs(plan.settled[c] - plan.before[c]) < 0.005 ? `${names[c]} stays` : `${names[c]} more than ${plan.frames} frames`)).join(', ');
    const switching = plan.lcd.switching === null ? 'longer than the time followed' : `${ms(plan.lcd.toBlack.span)} to black and ${ms(plan.lcd.toWhite.span)} back, ${ms(plan.lcd.switching)} together`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Patch light', `R ${pct(plan.settled[0])}, G ${pct(plan.settled[1])}, B ${pct(plan.settled[2])} of white`, `sRGB turns the codes ${codes} into ${pct(plan.linear[0])}, ${pct(plan.linear[1])} and ${pct(plan.linear[2])} of full light: half the code is far less than half the light. The LCD cannot go below its black, ${pct(plan.blackLevel[1], 2)} of white, so each channel runs from there to its white. The OLED gives exactly the decoded shares.`),
        r('Drive', `R ${fixed(plan.volts[0], 2)} V, G ${fixed(plan.volts[1], 2)} V, B ${fixed(plan.volts[2], 2)} V`, `Each channel’s voltage is the one at which its column of crystal, at rest, lets through the light its code asks for, found on the curve of light against voltage. The crystal starts to tilt at ${fixed(plan.onset, 2)} V; black is ${fixed(TN.black, 0)} V. The panel is normally white: no voltage, most light.`),
        r('Crystal', `green tilts ${fixed(now.directors[1].theta[TN.layers >> 1] * 180 / Math.PI, 1)}° in the middle`, `The director at rest balances the Frank energy’s splay, twist and bend against the field in a ${fixed(plan.gap, 1)} μm layer of Merck’s mixture M-1, twisted ${PAGES.twist}° from plate to plate with a ${fixed(TN.pretilt * 180 / Math.PI, 0)}° pretilt, which is not from a source. At the green drive it settles at ${fixed(plan.directors[1].theta[TN.layers >> 1] * 180 / Math.PI, 1)}°.`),
        r('Contrast', `${fixed(plan.lcdContrast, 0)}:1`, `Two crossed sheets of Polaroid, each passing ${fixed(PAGES.polaroid * 100, 0)}% with an extinction ratio of 1:${fixed(1 / PAGES.extinction, 0)}, leak ${pct(plan.blackLevel[1], 2)} of white even when the crystal lets nothing turn, so this cell reaches ${fixed(plan.lcdContrast, 0)}:1. The module’s datasheet gives ${fixed(LCD_PANEL.contrast, 0)}:1, so its polarizers block better than Polaroid sheet. An OLED subpixel with no current gives no light at all.`),
        r('Response', response, `From the black picture to the patch, 10% to 90% of each subpixel’s change. Switching a green subpixel from white to black and back takes ${switching} in this cell, against the datasheet’s ${fixed(LCD_PANEL.response * 1000, 0)} ms: M-1, made for another kind of panel, turns more slowly than the module’s own mixture. An OLED rises in ${fixed(OLED_PANEL.rise * 1e6, 0)} μs.`),
        r('Row time', `${fixed(plan.line * 1e6, 2)} μs`, `The module’s clock runs at ${fixed(LCD_PANEL.clock / 1e6, 0)} MHz and a row takes ${LCD_PANEL.lineClocks} clock ticks, so each row of transistors is open for ${fixed(plan.line * 1e6, 2)} μs, ${fixed(plan.line / LCD_PANEL.sourceSettle, 1)} times the ${fixed(LCD_PANEL.sourceSettle * 1e6, 0)} μs its column driver needs to settle. ${LCD_PANEL.frameLines} rows make a frame of ${fixed(plan.frame * 1000, 2)} ms, ${fixed(plan.rate, 1)} frames a second. Between writes each capacitor holds its voltage, and every frame flips its polarity, since a steady part as small as ${fixed(PAGES.dcLimit * 1000, 0)} mV harms the cell.`),
        r('Backlight', `${fixed(plan.backlightPower, 2)} W, always on`, `${LCD_PANEL.backlight.strings * LCD_PANEL.backlight.perString} white LEDs take ${fixed(LCD_PANEL.backlight.current * 1000, 0)} mA at ${fixed(LCD_PANEL.backlight.voltage, 1)} V to light the ${fixed(LCD_PANEL.luminance, 0)} cd/m² white, whatever the screen shows: the crystal only blocks light.`),
        r('OLED power', `${fixed(plan.oledPower * 1000, 0)} mW`, `The same picture on an OLED as large as this LCD and as bright, each subpixel drawing only the current its light needs at ${fixed(EMITTERS.red.efficiency, 0)}, ${fixed(EMITTERS.green.efficiency, 0)} and ${fixed(EMITTERS.blue.efficiency, 1)} cd/A and dropping ${fixed(SCREEN.oledVoltage, 1)} V: ${fixed(plan.currents[0] * 1e9, 0)}, ${fixed(plan.currents[1] * 1e9, 0)} and ${fixed(plan.currents[2] * 1e9, 0)} nA in a pixel ${fixed(OLED_PANEL.pitch * 1000, 0)} μm across. An all white screen would take ${fixed(plan.oledWhitePower * 1000, 0)} mW, and a black one none.`),
        r('Color', plan.lcdPatchXY ? `x ${fixed(plan.lcdPatchXY[0], 3)}, y ${fixed(plan.lcdPatchXY[1], 3)}` : 'no light', `The LCD patch settles at ${plan.lcdPatchXY ? `x ${fixed(plan.lcdPatchXY[0], 3)}, y ${fixed(plan.lcdPatchXY[1], 3)} and ${fixed(plan.lcdPatchLuminance, 0)} cd/m²` : 'no light'}, mixed from the module’s own red, green and blue; the OLED patch at ${plan.oledPatchXY ? `x ${fixed(plan.oledPatchXY[0], 3)}, y ${fixed(plan.oledPatchXY[1], 3)} and ${fixed(plan.oledPatchLuminance, 0)} cd/m²` : 'no light'}. A mixture always lies inside its three primaries’ triangle.`),
        r('Subpixels', `${fixed(pitch / 3, 0)} μm wide`, `${LCD_PANEL.columns} by ${LCD_PANEL.rows} pixels over ${fixed(aw, 2)} by ${fixed(ah, 2)} mm put pixels ${fixed(pitch, 0)} μm apart, each three subpixels wide. From ${SCREEN.viewing} mm a subpixel spans ${fixed(plan.arcSubpixel, 2)} arc minutes, under the ${PAGES.acuity} arc minute an eye resolves, so the stripes merge into one color; a whole pixel spans ${fixed(plan.arcPixel, 2)}. Drawn ${fixed(timesLarger(PIXEL), 0)} times larger.`),
        r('Slowed', `${fixed(SCREEN.slow, 0)} times`, `The panel is written ${fixed(SCREEN.slow, 0)} times slower here than it is: ${plan.frames} frames of ${fixed(plan.duration * 1000, 1)} ms take ${fixed(plan.duration * SCREEN.slow, 1)} s. The module is drawn at true size and the crystal ${fixed(timesLarger(CELL), 0)} times larger.`),
      ],
    };
  });

  function seriesValue(flow, c, time) {
    const x = Math.max(0, Math.min(flow.count, time / flow.sample)), i = Math.min(flow.count - 1, Math.floor(x));
    return flow.light[c][i] + (flow.light[c][i + 1] - flow.light[c][i]) * (x - i);
  }
  function chromaticityOfDrawn([X, Y, Z]) { return X + Y + Z > 1e-12 ? [X / (X + Y + Z), Y / (X + Y + Z)] : null; }

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt / SCREEN.slow); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  const frame = () => result.getState().frame;
  result.actions = [
    {label: 'Inspect: the screen being written', part: 'panel', view: 'front', replay: false, run() { return inspect(rowStart(SCREEN.patchRows[1])); }},
    {label: 'Inspect: a row of capacitors written', part: 'matrix', view: 'front', replay: false, run() { return inspect(frame() + rowStart(closeRow) + result.getState().line / 2); }},
    {label: 'Inspect: the crystal turning', part: 'cell', view: 'front', replay: false, run() { return inspect(3 * frame()); }},
    {label: 'Inspect: RGB subpixels', part: 'subpixels', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: OLED subpixels', part: 'oled', view: 'front', replay: false, run() { return inspect(duration()); }},
  ];
  result.playback = {
    label: 'Write',
    description: `The panel writes its rows one after another for ${SCREEN.frames} frames, ${SCREEN.slow} times slower than it does.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'frames', label: 'Inspect the light through the frames', view: 'front', focusOnComplete: false, available: () => clock >= duration()};
  const cellEntry = result.parts.find(entry => entry.id === 'cell');
  cellEntry.route = '#machine/liquid-crystal-display';

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, panel, body, bezel, bands, scanBar, ring, leaders, backlight, guide, leds, glow, matrix: matrixPart, matrixBack, windows, tfts, bars, dataLines, gateLines, cell, slices, rods, ellipses, axes, subpixels, lightBack, lights, lcdSwatch, oled, oledBack, emitters, oledSwatch, stacks, powerBars, powerBase, curves, curvesFrame, curveLines, driveMarks, onsetTick, frames, framesFrame, frameTicks, guides, lcdLines, oledLines, framesCursor, color, colorFrame, srgbTriangle, lcdTriangle, oledTriangle, lcdNowMark, lcdMark, oledMark};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

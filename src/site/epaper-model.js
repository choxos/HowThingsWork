import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {paperPlan, paperAt, wettingOf, layoutOf, INK, WETTING, PTFE, RADIUS, SCREENS, PAGES, INK_OPTIONS, TARGET_OPTIONS, SCREEN_OPTIONS, PAPER_DEFAULTS, PAPER_DOMAINS, pitchOf} from './epaper-physics.js';

// ---------------------------------------------------------------------------
// Electronic paper: an e-reader, three of its pixels, the ink under one pixel
// cut open with the light it sends back, and an electrowetting pixel cut open.
//
// Scale: the e-reader is drawn at true size, 1 mm to 0.01 scene units; its
// body around the screen is illustrative. The pixels are drawn 200 times
// larger, 1 μm to 0.002 units. The ink is cut open 2,000 times larger, 1 μm to
// 0.02 units, as a slice one particle thick, and its particles are drawn at
// their true size against the gap. The electrowetting pixel is drawn 500 times
// larger, 1 μm to 0.005 units. The charts are not to scale.
//
// Time: the ink moves 100 times slower than it does, said in the part text and
// a reading. The electrowetting pixel is drawn as it settles, with no clock.
// ---------------------------------------------------------------------------

export const MM = 0.01;
export const PIXEL = 0.002;
export const CELL = 0.02;
export const WET = 0.005;

/** How many times larger than true size a scale per μm draws. */
export const timesLarger = perMicron => perMicron / (MM / 1000);

/** The reader, mm: its body, the screen's size from a 6 inch diagonal at 3 by 4, how far the screen sits above the body's middle, the text lines, and the ring marking the pixels drawn close up. */
export const READER = Object.freeze({origin: Object.freeze([-2.62, 0.02, 0]), body: Object.freeze([116, 158, 8.5]), screen: Object.freeze([6 * 25.4 * 3 / 5, 6 * 25.4 * 4 / 5]), raise: 5, margin: 7, lines: 22, lineGap: 4.9, lineHeight: 1.5, marker: Object.freeze([18, 12]), ring: 4});
export const PIXELS = Object.freeze({origin: Object.freeze([-1.28, 0.42, 0]), pattern: Object.freeze([1, 0, 1, 0, -1, 0, 1, 0, 1]), segments: 16, lift: 0.002});
export const CELLVIEW = Object.freeze({origin: Object.freeze([0.5, 0.92, 0]), electrode: 3, margin: 8, sign: 3, bar: 0.8, arrow: 0.004});
export const CHART = Object.freeze({x: -1.73, y: -1.02, w: 0.9, h: 0.42, top: 0.88, z: 0, tickEvery: 0.05, tick: 0.02, bar: 0.012, gap: 0.01, cursor: 0.02});
export const WETVIEW = Object.freeze({origin: Object.freeze([2.32, 0.42, 0]), substrate: 20, electrode: 2, water: 60, glass: 20, wall: 10, wallTall: 20, fan: 64, tangent: 22});
export const WETCHART = Object.freeze({x: 1.92, y: -1.02, w: 0.8, h: 0.42, top: 0.88, z: 0, volts: Object.freeze([0, 70]), samples: 97, tickEvery: 10, tick: 0.02, cursor: 0.02});
export const COLORS = Object.freeze({body: 0x2f3336, paper: 0xe4e0d4, text: 0x4a4a48, white: 0xf4f1e8, black: 0x2a2a2a, dye: 0x1f2a44, fluid: 0x93a8b1, binder: 0xc9cdbf, front: 0x9fc3cf, back: 0x8f989b, capsule: 0x5f6b66, chart: 0x374736, faint: 0x9aa39a, wave: 0x2b5d9c, field: 0xd99a2b, oil: 0xa8325e, water: 0xbfdcea, glass: 0xd7e7ef, fluoro: 0xd9d0ea, reflector: 0xf4f1e8, wall: 0xd9d2c3, breakdown: 0xc14f39});

/** Where a time, s, and a share of white fall on the light chart. */
export const chartX = (plan, t) => CHART.x + Math.max(0, Math.min(1, t / plan.duration)) * CHART.w;
export const chartY = share => CHART.y + Math.max(0, Math.min(1, share)) * CHART.top * CHART.h;
/** Where a voltage and a share of the pixel under oil fall on the electrowetting chart. */
export const wetX = volts => WETCHART.x + (volts - WETCHART.volts[0]) / (WETCHART.volts[1] - WETCHART.volts[0]) * WETCHART.w;
export const wetY = share => WETCHART.y + Math.max(0, Math.min(1, share)) * WETCHART.top * WETCHART.h;

/** The capsules over three pixels by three, μm about the middle pixel's center: circles packed in rows, each wholly inside. */
export function capsuleCircles(pitch, gap) {
  const half = 1.5 * pitch - gap / 2, circles = [], rise = gap * Math.sqrt(3) / 2;
  for (let row = 0; ; row++) {
    const y = -half + row * rise;
    if (y > half + 1e-9) break;
    for (let col = 0; ; col++) {
      const x = -half + (row % 2) * gap / 2 + col * gap;
      if (x > half + 1e-9) break;
      circles.push([x, y]);
    }
  }
  return circles;
}

/** The oil's outline in the electrowetting pixel, μm with the fluoropolymer's surface at y = 0: a flat film over the pixel, or a round drop at its contact angle. */
export function oilProfile(wet, count = WETVIEW.fan) {
  const P = WETTING.pixel;
  if (wet.film) return Array.from({length: count}, (_, j) => (j === 0 ? [-P / 2, 0] : j === count - 1 ? [P / 2, 0] : [-P / 2 + P * (j - 1) / (count - 3), WETTING.film]));
  const rho = wet.base / Math.sin(wet.alpha);
  return Array.from({length: count}, (_, j) => { const psi = -wet.alpha + 2 * wet.alpha * j / (count - 1); return [rho * Math.sin(psi), rho * Math.cos(psi) - rho * Math.cos(wet.alpha)]; });
}

/** Room for a fan of `count` outline points around a center; drawn by setting positions. */
function fanGeometry(count) {
  const geometry = new THREE.BufferGeometry(), index = [];
  for (let j = 1; j < count; j++) index.push(0, j + 1, j);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((count + 1) * 3), 3));
  geometry.setIndex(index);
  return geometry;
}

/** Text lines on the reader's screen, mm about the screen's center: [x0, x1, y0, y1]. */
export function textBars() {
  const [sw, sh] = READER.screen, bars = [];
  let seed = 7;
  const next = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let line = 0; line < READER.lines; line++) {
    const top = sh / 2 - READER.margin - line * READER.lineGap;
    if (line === 3 || line === 12) continue;
    const end = line === 2 || line === 11 || line === READER.lines - 1 ? 0.35 + 0.3 * next() : 0.9 + 0.1 * next();
    const x0 = -sw / 2 + READER.margin, x1 = x0 + (sw - 2 * READER.margin) * (line === 0 ? 0.55 : end);
    bars.push([x0, x1, top - (line === 0 ? 2.4 : READER.lineHeight), top]);
  }
  return bars;
}

export function createElectronicPaperModel() {
  const kit = houseModel('Electronic paper'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownCell = '', shownPixels = '';
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const frameLine = (line, x, y, w, h, z = 0) => fillLine(line, [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]]);

  const system = part('system', 'Electronic paper, close up', `An e-reader at true size, nine of its pixels ${fixed(timesLarger(PIXEL), 0)} times larger, the ink under a pixel cut open ${fixed(timesLarger(CELL), 0)} times larger with the light it sends back, and an electrowetting pixel cut open ${fixed(timesLarger(WET), 0)} times larger. Press Play to write the pixel: the ink moves ${INK.slow} times slower here than it does.`);

  // The reader at true size.
  const reader = part('reader', 'E-reader, true size', `A 6 inch e-reader drawn at true size, its screen ${fixed(READER.screen[0], 2)} mm by ${fixed(READER.screen[1], 2)} mm. The ring marks where the pixels drawn close up sit. The body around the screen is illustrative.`, READER.origin, system);
  const [bw, bh, bd] = READER.body, [sw, sh] = READER.screen;
  const body = kit.box([bw * MM, bh * MM, bd * MM], [0, 0, -bd * MM / 2], COLORS.body, reader);
  const screen = flat(COLORS.paper, reader);
  rect(screen, -sw / 2 * MM, sw / 2 * MM, (READER.raise - sh / 2) * MM, (READER.raise + sh / 2) * MM, 0.001);
  const bars = textBars(), barGeometry = new THREE.BufferGeometry(), barPositions = new Float32Array(bars.length * 12), barIndex = [];
  bars.forEach(([x0, x1, y0, y1], b) => {
    barPositions.set([x0, y0 + READER.raise, 0, x1, y0 + READER.raise, 0, x1, y1 + READER.raise, 0, x0, y1 + READER.raise, 0].map((value, i) => (i % 3 === 2 ? 0.002 : value * MM)), b * 12);
    barIndex.push(4 * b, 4 * b + 1, 4 * b + 2, 4 * b, 4 * b + 2, 4 * b + 3);
  });
  barGeometry.setAttribute('position', new THREE.BufferAttribute(barPositions, 3));
  barGeometry.setIndex(barIndex);
  const text = new THREE.Mesh(barGeometry, unlit(COLORS.text));
  reader.add(text);
  const marker = lineObject(49, COLORS.wave, reader);
  const [mx, my] = READER.marker;
  fillLine(marker, Array.from({length: 49}, (_, i) => { const a = 2 * Math.PI * i / 48; return [(mx + READER.ring * Math.cos(a)) * MM, (my + READER.raise + READER.ring * Math.sin(a)) * MM, 0.003]; }));
  const leaders = segmentLines(2, COLORS.faint, system);

  // Nine pixels, 200 times larger.
  const pixels = part('pixel', 'Pixels, close up', `Nine pixels drawn ${fixed(timesLarger(PIXEL), 0)} times larger, the middle one being written and the eight around it holding what was written before, with no drive. In capsule ink the circles are capsules, which do not line up with the pixels, so a capsule over an edge shows both.`, PIXELS.origin, system);
  const squares = Array.from({length: 9}, () => flat(COLORS.paper, pixels));
  const pixelGrid = segmentLines(8, COLORS.chart, pixels);
  const capsuleRoom = Math.max(...SCREENS.map(item => capsuleCircles(pitchOf(item), PAPER_DOMAINS.gap[0]).length)) * PIXELS.segments;
  const capsuleLines = segmentLines(capsuleRoom, COLORS.capsule, pixels);

  // The ink cut open, 2,000 times larger.
  const cell = part('cell', 'The ink, cut open', `The ink under the middle pixel cut open between its electrodes, drawn ${fixed(timesLarger(CELL), 0)} times larger as a slice one particle thick, the particles at their true size against the gap. Titania particles about ${fixed(2 * RADIUS, 0)} μm across in dark dyed oil, or white and black particles in a clear capsule, packed ${INK.layers} deep at a wall. The arrow shows the field while the drive is on. The particles move ${INK.slow} times slower than they do.`, CELLVIEW.origin, system);
  const frontElectrode = flat(COLORS.front, cell, {transparent: true, opacity: 0.75});
  const backElectrode = flat(COLORS.back, cell);
  const dye = flat(COLORS.dye, cell), binder = flat(COLORS.binder, cell);
  const capsuleFill = new THREE.Mesh(new THREE.CircleGeometry(1, 64), unlit(COLORS.fluid));
  cell.add(capsuleFill);
  const capsuleWall = lineObject(65, COLORS.capsule, cell);
  const roomOf = species => Math.max(...[0, 1].flatMap(ink => Array.from({length: (PAPER_DOMAINS.gap[1] - PAPER_DOMAINS.gap[0]) / PAPER_DOMAINS.gap[2] + 1}, (_, i) => layoutOf(ink, PAPER_DOMAINS.gap[0] + i * PAPER_DOMAINS.gap[2]).counts[species])));
  const particleGeometry = new THREE.CircleGeometry(1, 16);
  const whites = new THREE.InstancedMesh(particleGeometry, unlit(COLORS.white), roomOf(0)), blacks = new THREE.InstancedMesh(particleGeometry.clone(), unlit(COLORS.black), roomOf(1));
  for (const mesh of [whites, blacks]) { mesh.frustumCulled = false; mesh.count = 0; cell.add(mesh); }
  const arrow = solidArrow(kit, COLORS.field, cell, CELLVIEW.arrow);
  const plus = [flat(COLORS.chart, cell), flat(COLORS.chart, cell)], minus = flat(COLORS.chart, cell);

  // The light sent back through the write.
  const light = part('light', 'Light sent back', `How much light the middle pixel sends back through the write, from none at the bottom to the whitest this ink gets at the top: faint for the whole write, dark as far as the clock has run. Gray: how far the white particles have gone, on average. The gold bar marks the pulse, and a tick below the chart marks every ${fixed(CHART.tickEvery * 1000, 0)} ms.`, [0, 0, 0], system);
  const lightFrame = lineObject(5, COLORS.chart, light);
  frameLine(lightFrame, CHART.x, CHART.y, CHART.w, CHART.h, CHART.z);
  const pulseBar = flat(COLORS.field, light);
  const lightGuide = lineObject(INK.samples, COLORS.faint, light), lightCurve = lineObject(INK.samples + 1, COLORS.wave, light), progressCurve = lineObject(INK.samples + 1, COLORS.faint, light);
  const lightTicks = segmentLines(Math.round(0.25 / CHART.tickEvery) + 1, COLORS.chart, light), lightCursor = segmentLines(2, COLORS.chart, light);
  // The chart's words: the write's length under its right end changes with the settings.
  const TEXT = 0.035, css = color => `#${color.toString(16).padStart(6, '0')}`;
  const key = (parent, x, top, entries) => entries.forEach(([text, color], i) => textLabel(parent, text, {height: TEXT, align: 'left', color: css(color), position: [x, top - 0.035 - 0.05 * i, 0.001]}));
  chartText(light, (share, level) => [CHART.x + share * CHART.w, CHART.y + level * CHART.top * CHART.h, CHART.z], {
    title: 'Light sent back', size: TEXT,
    x: {min: 0, max: 1, title: `ms, a tick every ${fixed(CHART.tickEvery * 1000, 0)}`, ticks: [[0, '0']]},
    y: {min: 0, max: 1 / CHART.top, ticks: [[0, 'Dark'], [1, 'White']]},
  });
  const lightEnd = textLabel(light, '', {height: TEXT, width: TEXT * 3.5, color: css(COLORS.chart), position: [CHART.x + CHART.w, CHART.y - 1.1 * TEXT, 0.001]});
  // The light chart's key runs in a row under it; the ink's close up can reach down beside the chart.
  [['Light', COLORS.wave], ['White particles', COLORS.faint], ['Pulse', COLORS.field]].reduce((x, [text, color]) => {
    textLabel(light, text, {height: TEXT, align: 'left', color: css(color), position: [x, CHART.y - 3.4 * TEXT - CHART.gap - CHART.bar, 0.001]});
    return x + TEXT * (0.56 * text.length + 0.6) + 0.05;
  }, CHART.x);

  // The electrowetting pixel, 500 times larger.
  const wetting = part('wetting', 'Electrowetting pixel, cut open', `An electrowetting pixel cut open, drawn ${fixed(timesLarger(WET), 0)} times larger: colored oil on ${fixed(WETTING.thickness, 0)} μm of fluoropolymer over an electrode, under water, with a white surface beneath. With no voltage the oil lies flat over the pixel. The drive pulls the water down onto the fluoropolymer, and once a round drop of the oil fits inside the pixel the oil gathers into one, uncovering the white. The line at the drop's edge shows its contact angle. Below: how much of the pixel the oil covers at each voltage, up to ${fixed(PTFE.strength * WETTING.thickness * 1e-6, 0)} V, where the field reaches PTFE's dielectric strength.`, WETVIEW.origin, system);
  const P = WETTING.pixel, halfWide = P / 2 + WETVIEW.wall;
  const substrate = flat(COLORS.reflector, wetting), wetElectrode = flat(COLORS.back, wetting), fluoro = flat(COLORS.fluoro, wetting), water = flat(COLORS.water, wetting), glass = flat(COLORS.glass, wetting);
  const walls = [flat(COLORS.wall, wetting), flat(COLORS.wall, wetting)];
  rect(substrate, -halfWide * WET, halfWide * WET, -(WETTING.thickness + WETVIEW.electrode + WETVIEW.substrate) * WET, -(WETTING.thickness + WETVIEW.electrode) * WET);
  rect(wetElectrode, -halfWide * WET, halfWide * WET, -(WETTING.thickness + WETVIEW.electrode) * WET, -WETTING.thickness * WET);
  rect(fluoro, -halfWide * WET, halfWide * WET, -WETTING.thickness * WET, 0);
  rect(water, -halfWide * WET, halfWide * WET, 0, WETVIEW.water * WET, -0.001);
  rect(glass, -halfWide * WET, halfWide * WET, WETVIEW.water * WET, (WETVIEW.water + WETVIEW.glass) * WET);
  walls.forEach((wall, i) => rect(wall, (i ? P / 2 : -halfWide) * WET, (i ? halfWide : -P / 2) * WET, 0, WETVIEW.wallTall * WET, 0.0005));
  const oilGeometry = fanGeometry(WETVIEW.fan), oil = new THREE.Mesh(oilGeometry, unlit(COLORS.oil));
  wetting.add(oil);
  const oilOutline = lineObject(WETVIEW.fan, COLORS.chart, wetting), tangent = segmentLines(1, COLORS.chart, wetting);
  const wetChart = new THREE.Group();
  wetChart.position.set(-WETVIEW.origin[0], -WETVIEW.origin[1], -WETVIEW.origin[2]);
  wetting.add(wetChart);
  const wetFrame = lineObject(5, COLORS.chart, wetChart);
  frameLine(wetFrame, WETCHART.x, WETCHART.y, WETCHART.w, WETCHART.h, WETCHART.z);
  const breakdownVolts = PTFE.strength * WETTING.thickness * 1e-6, threshold = paperPlan(PAPER_DEFAULTS).threshold;
  const filmCurve = lineObject(2, COLORS.faint, wetChart), dropCurve = lineObject(WETCHART.samples, COLORS.wave, wetChart), breakdown = segmentLines(1, COLORS.breakdown, wetChart);
  fillLine(filmCurve, [[wetX(0), wetY(1), WETCHART.z], [wetX(threshold), wetY(1), WETCHART.z]]);
  fillLine(dropCurve, Array.from({length: WETCHART.samples}, (_, i) => { const volts = threshold + (breakdownVolts - threshold) * i / (WETCHART.samples - 1), wet = wettingOf(volts); return [wetX(volts), wetY(wet.film ? 1 : wet.coverage), WETCHART.z]; }));
  fillLine(breakdown, [[wetX(breakdownVolts), WETCHART.y, WETCHART.z], [wetX(breakdownVolts), WETCHART.y + WETCHART.h, WETCHART.z]]);
  const wetTicks = segmentLines((WETCHART.volts[1] - WETCHART.volts[0]) / WETCHART.tickEvery - 1, COLORS.faint, wetChart), wetCursor = segmentLines(2, COLORS.chart, wetChart);
  chartText(wetChart, (volts, share) => [wetX(volts), WETCHART.y + share * WETCHART.top * WETCHART.h, WETCHART.z], {
    title: 'Oil cover against voltage', size: TEXT,
    x: {min: WETCHART.volts[0], max: WETCHART.volts[1], title: 'Volts', ticks: [0, 20, 40, 60].map(volts => [volts, String(volts)])},
    y: {min: 0, max: 1 / WETCHART.top, ticks: [[0, '0%'], [1, '100%']]},
  });
  key(wetChart, WETCHART.x + WETCHART.w + 0.04, WETCHART.y + WETCHART.h, [['Oil cover', COLORS.wave], ['Breakdown', COLORS.breakdown]]);
  fillLine(wetTicks, Array.from({length: (WETCHART.volts[1] - WETCHART.volts[0]) / WETCHART.tickEvery - 1}, (_, i) => { const x = wetX((i + 1) * WETCHART.tickEvery); return [[x, WETCHART.y, WETCHART.z], [x, WETCHART.y - WETCHART.tick, WETCHART.z]]; }).flat());

  const d = PAPER_DEFAULTS, [inkDomain, gapDomain, voltDomain, pulseDomain, targetDomain, screenDomain, wetDomain] = ['ink', 'gap', 'voltage', 'pulse', 'target', 'screen', 'wetting'].map(key => PAPER_DOMAINS[key]);
  control('ink', 'Ink', ...inkDomain, d.ink, '', 'Titania particles in dark dyed oil between two plates, the simplest electrophoretic ink, or white and black particles in a clear capsule, as E Ink makes.', INK_OPTIONS);
  control('gap', 'Gap', ...gapDomain, d.gap, 'μm', 'How far apart the electrodes are: the plates, or a capsule as wide as the gap.');
  control('voltage', 'Drive', ...voltDomain, d.voltage, 'V', 'The voltage across the ink while the pulse lasts. Not from a source.');
  control('pulse', 'Pulse', ...pulseDomain, d.pulse, 'ms', 'How long the drive stays on before it turns off. A pulse too short to carry the particles across leaves the pixel gray.');
  control('target', 'Write', ...targetDomain, d.target, '', 'Which way the field points: toward white or toward black.', TARGET_OPTIONS);
  control('screen', 'Screen', ...screenDomain, d.screen, '', 'Three 6 inch screens, each packing more pixels into the same size.', SCREEN_OPTIONS);
  control('wetting', 'Electrowetting drive', ...wetDomain, d.wetting, 'V', 'The voltage across the electrowetting pixel’s fluoropolymer.');

  const matrix = new THREE.Matrix4();
  const result = finish(v => {
    const plan = paperPlan(v), now = paperAt(plan, clock), layout = plan.layout, gap = plan.gap, W = layout.width, H = W / 2 + CELLVIEW.margin;

    // The cell's walls, fill and electrodes change only with the ink and the gap.
    const cellKey = `${plan.ink}:${gap}`;
    if (shownCell !== cellKey) {
      shownCell = cellKey;
      rect(frontElectrode, -H * CELL, H * CELL, 0, CELLVIEW.electrode * CELL, 0.002);
      rect(backElectrode, -H * CELL, H * CELL, -(gap + CELLVIEW.electrode) * CELL, -gap * CELL);
      rect(dye, -H * CELL, H * CELL, -gap * CELL, 0, -0.001);
      rect(binder, -H * CELL, H * CELL, -gap * CELL, 0, -0.001);
      capsuleFill.position.set(0, -gap / 2 * CELL, -0.0005);
      capsuleFill.scale.setScalar(gap / 2 * CELL);
      fillLine(capsuleWall, Array.from({length: 65}, (_, i) => { const a = 2 * Math.PI * i / 64; return [gap / 2 * CELL * Math.cos(a), (-gap / 2 + gap / 2 * Math.sin(a)) * CELL, 0.0025]; }));
      dye.visible = plan.ink === 0;
      binder.visible = capsuleFill.visible = capsuleWall.visible = plan.ink === 1;
      arrow.position.set((W / 2 + CELLVIEW.margin / 2) * CELL, 0, 0.003);
    }

    // Every particle where the drive has carried it.
    let w = 0, b = 0;
    layout.particles.forEach((particle, i) => {
      const scale = RADIUS * CELL;
      matrix.makeScale(scale, scale, 1).setPosition(particle.x * CELL, -now.depths[i] * CELL, particle.species === 0 ? 0.004 : 0.0035);
      if (particle.species === 0) whites.setMatrixAt(w++, matrix); else blacks.setMatrixAt(b++, matrix);
    });
    whites.count = w;
    blacks.count = b;
    whites.instanceMatrix.needsUpdate = blacks.instanceMatrix.needsUpdate = true;
    whites.computeBoundingSphere();
    blacks.computeBoundingSphere();

    // The field and the electrodes' signs, only while the drive is on.
    const driving = clock > 0 && now.driving && plan.voltage > 0, frontPositive = plan.target === 0;
    arrow.userData.setLength(driving ? 0.8 * gap * CELL : 0);
    arrow.userData.setDirection(new THREE.Vector3(0, frontPositive ? -1 : 1, 0));
    arrow.position.y = frontPositive ? -0.1 * gap * CELL : -0.9 * gap * CELL;
    const signX = (H + CELLVIEW.sign) * CELL, plusY = frontPositive ? CELLVIEW.electrode / 2 : -gap - CELLVIEW.electrode / 2, minusY = frontPositive ? -gap - CELLVIEW.electrode / 2 : CELLVIEW.electrode / 2, arm = CELLVIEW.sign / 2;
    rect(plus[0], signX - arm * CELL, signX + arm * CELL, (plusY - CELLVIEW.bar / 2) * CELL, (plusY + CELLVIEW.bar / 2) * CELL, 0.003);
    rect(plus[1], signX - CELLVIEW.bar / 2 * CELL, signX + CELLVIEW.bar / 2 * CELL, (plusY - arm) * CELL, (plusY + arm) * CELL, 0.003);
    rect(minus, signX - arm * CELL, signX + arm * CELL, (minusY - CELLVIEW.bar / 2) * CELL, (minusY + CELLVIEW.bar / 2) * CELL, 0.003);
    for (const glyph of [...plus, minus]) glyph.visible = driving;

    // The pixels: their pitch, the capsules over them, and their shades.
    const pitch = plan.pitch, pixelKey = `${plan.values.screen}:${plan.ink}:${gap}`;
    if (shownPixels !== pixelKey) {
      shownPixels = pixelKey;
      const s = pitch * PIXEL, edge = 1.5 * s;
      squares.forEach((square, k) => { const row = Math.floor(k / 3), col = k % 3; rect(square, (col - 1.5) * s, (col - 0.5) * s, (1.5 - row - 1) * s, (1.5 - row) * s); });
      fillLine(pixelGrid, [[-edge, -0.5 * s], [edge, -0.5 * s], [-edge, 0.5 * s], [edge, 0.5 * s], [-0.5 * s, -edge], [-0.5 * s, edge], [0.5 * s, -edge], [0.5 * s, edge], [-edge, -edge], [edge, -edge], [edge, -edge], [edge, edge], [edge, edge], [-edge, edge], [-edge, edge], [-edge, -edge]].map(([x, y]) => [x, y, PIXELS.lift]));
      const segments = [];
      if (plan.ink === 1) {
        for (const [cx, cy] of capsuleCircles(pitch, gap)) {
          for (let k = 0; k < PIXELS.segments; k++) {
            const a0 = 2 * Math.PI * k / PIXELS.segments, a1 = 2 * Math.PI * (k + 1) / PIXELS.segments;
            segments.push([(cx + gap / 2 * Math.cos(a0)) * PIXEL, (cy + gap / 2 * Math.sin(a0)) * PIXEL, PIXELS.lift], [(cx + gap / 2 * Math.cos(a1)) * PIXEL, (cy + gap / 2 * Math.sin(a1)) * PIXEL, PIXELS.lift]);
          }
        }
      }
      fillLine(capsuleLines, segments);
      fillLine(leaders, [[READER.origin[0] + (mx + READER.ring) * MM, READER.origin[1] + (my + READER.raise) * MM, 0], [PIXELS.origin[0] - edge, PIXELS.origin[1], 0], [PIXELS.origin[0] + edge, PIXELS.origin[1], 0], [CELLVIEW.origin[0] - H * CELL, CELLVIEW.origin[1] - gap / 2 * CELL, 0]]);
    }
    const shade = (share, color) => color.setHex(COLORS.black).lerp(new THREE.Color(COLORS.white), Math.max(0, Math.min(1, share)));
    squares.forEach((square, k) => shade(PIXELS.pattern[k] < 0 ? now.light : PIXELS.pattern[k], square.material.color));

    // The light chart.
    fillLine(lightGuide, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.light), CHART.z]));
    const shown = plan.chart.filter(sample => sample.t < now.t);
    fillLine(lightCurve, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.light), CHART.z]), [chartX(plan, now.t), chartY(now.light), CHART.z]] : []);
    fillLine(progressCurve, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.progress), CHART.z]), [chartX(plan, now.t), chartY(now.progress), CHART.z]] : []);
    rect(pulseBar, CHART.x, chartX(plan, plan.pulse), CHART.y - CHART.gap - CHART.bar, CHART.y - CHART.gap, CHART.z);
    pulseBar.visible = plan.pulse > 0;
    const ticks = [];
    for (let t = CHART.tickEvery; t < plan.duration - 1e-9; t += CHART.tickEvery) ticks.push([chartX(plan, t), CHART.y, CHART.z], [chartX(plan, t), CHART.y - CHART.tick, CHART.z]);
    fillLine(lightTicks, ticks);
    lightEnd.userData.setText(fixed(plan.duration * 1000, 0));
    const cx = chartX(plan, now.t), cy = chartY(now.light);
    fillLine(lightCursor, [[cx - CHART.cursor, cy, CHART.z], [cx + CHART.cursor, cy, CHART.z], [cx, cy - CHART.cursor, CHART.z], [cx, cy + CHART.cursor, CHART.z]]);

    // The electrowetting pixel.
    const wet = plan.wet, profile = oilProfile(wet), positions = oilGeometry.attributes.position.array;
    positions.set([0, 0, 0.001], 0);
    profile.forEach(([x, y], j) => positions.set([x * WET, y * WET, 0.001], (j + 1) * 3));
    oilGeometry.attributes.position.needsUpdate = true;
    oilGeometry.boundingBox = null;
    oilGeometry.boundingSphere = null;
    fillLine(oilOutline, profile.map(([x, y]) => [x * WET, y * WET, 0.0015]));
    fillLine(tangent, wet.film ? [] : [[wet.base * WET, 0, 0.0015], [(wet.base - WETVIEW.tangent * Math.cos(wet.alpha)) * WET, WETVIEW.tangent * Math.sin(wet.alpha) * WET, 0.0015]]);
    const wx = wetX(plan.values.wetting), wy = wetY(wet.coverage);
    fillLine(wetCursor, [[wx - WETCHART.cursor, wy, WETCHART.z], [wx + WETCHART.cursor, wy, WETCHART.z], [wx, wy - WETCHART.cursor, WETCHART.z], [wx, wy + WETCHART.cursor, WETCHART.z]]);

    // Readings.
    const percent = share => `${fixed(100 * share, 0)}%`, where = plan.ink === 0 ? `between plates ${fixed(gap, 0)} μm apart` : `in a capsule ${fixed(gap, 0)} μm across`;
    const start = plan.target === 0 ? 'back' : 'front';
    const status = clock <= 0 ? `Ready · white particles at the ${start} ${where}; press Play`
      : now.driving ? (plan.voltage > 0 ? `Driving · white particles ${percent(now.progress)} of the way, light back ${percent(now.light)}` : 'No drive · at 0 V nothing moves')
      : !now.done ? `Drive off · every particle stays where it stopped, light back ${percent(now.light)}`
      : `Written · light back ${percent(now.light)} of white, held with the drive off`;
    const moving = plan.voltage > 0;
    const crossingText = moving
      ? `Hückel’s mobility 2εrε0ζ/(3η) in n-hexane is ${fixed(plan.mobility * 1e9, 2)} × 10⁻⁹ m²/(V·s) at 50 mV, so a particle crosses the ${fixed(plan.travel, 0)} μm from wall to wall in ${fixed(plan.crossing * 1000, 1)} ms: ${fixed(plan.slowest * 1000, 1)} ms at 40 mV and ${fixed(plan.fastest * 1000, 1)} ms at 60 mV. E Ink gives updates as short as ${PAGES.update} ms.`
      : 'With no voltage there is no field, and nothing crosses.';
    const lightText = plan.ink === 0
      ? `In each column the particle nearest you decides. The dye dims light by a factor e every 25 μm on its way in and out, so white particles at the back send back ${fixed(100 * plan.blackLevel, 1)}% of what they send from the front. The slice drawn holds ${fixed(layout.counts[0], 0)} particles, ${INK.layers} deep at a wall. Not from a source.`
      : `In each column the particle nearest you decides: white sends the light back and black sends none, so the capsule turns white once its white particles pass its black ones. The slice drawn holds ${fixed(layout.counts[0], 0)} white and ${fixed(layout.counts[1], 0)} black particles, ${INK.layers} deep at a wall; a whole capsule packed the same way would hold about ${fixed(Math.round(plan.capsuleCount / 100) * 100, 0)} of each. Not from a source.`;
    return {
      state: {...plan, now, clock, drawnParticles: w + b, profile},
      readings: [
        r('Your result', status),
        r('Field', `${fixed(plan.field / 1000, 0)} kV/m`, moving ? `${fixed(plan.voltage, 0)} V across ${fixed(gap, 0)} μm. The field pulls on each particle, carrying about ${fixed(plan.electrons, 0)} electron charges at a zeta potential of 50 mV, and the oil’s drag holds it to ${fixed(plan.speed, 0)} μm/s.` : `No voltage across ${fixed(gap, 0)} μm, so no field: each particle still carries about ${fixed(plan.electrons, 0)} electron charges at a zeta potential of 50 mV, but nothing pulls on it.`),
        r('Crossing', moving ? `${fixed(plan.crossing * 1000, 0)} ms` : 'never', crossingText),
        r('Light back', `${percent(now.light)} of white`, lightText),
        r('Sinking', `${fixed(plan.settling, 2)} μm/s`, `A bare titania particle this size would sink through n-hexane at ${fixed(plan.settling, 2)} μm/s, across the ${fixed(plan.travel, 0)} μm in ${fixed(plan.settleCross, 1)} s if the pixel lay flat.${moving ? ` The field pulls ${fixed(plan.forceRatio, 0)} times harder.` : ''} Real inks hold their image with the drive off, and how is left out: here the particles stay where the drive leaves them.`),
        r('Screen', `${fixed(plan.screen.ppi, 0)} ppi`, `${plan.screen.name}: ${fixed(plan.screen.width, 0)} by ${fixed(plan.screen.height, 0)} pixels on a 6 inch screen, ${fixed(pitch, 1)} μm apart${plan.ink === 1 ? `, ${fixed(plan.capsulesAcross, 1)} capsules of ${fixed(gap, 0)} μm across a pixel` : ''}. At 4 bits a pixel for ${PAGES.shades} shades of gray, a page is ${fixed(plan.pageBytes, 0)} bytes. The pixels are drawn ${fixed(timesLarger(PIXEL), 0)} times larger.`),
        r('Electrowetting', wet.film ? 'a film over the pixel' : `${percent(wet.coverage)} under oil`, `At ${fixed(plan.values.wetting, 0)} V over ${fixed(WETTING.thickness, 0)} μm of fluoropolymer with PTFE’s dielectric constant of ${fixed(PTFE.permittivity, 1)}, water meets the surface at ${fixed(wet.theta * 180 / Math.PI, 1)}° and the oil at ${fixed(wet.alpha * 180 / Math.PI, 1)}°. ${wet.film ? `A round drop at that angle would be ${fixed(2 * wet.base, 0)} μm across, too wide for the ${fixed(P, 0)} μm pixel, so the oil stays a film until ${fixed(plan.threshold, 1)} V.` : `The oil gathers into a drop ${fixed(2 * wet.base, 0)} μm across and ${fixed(wet.height, 1)} μm high.`} The field in the fluoropolymer is ${fixed(wet.field / 1e6, 0)} MV/m, against PTFE’s dielectric strength of ${fixed(PTFE.strength / 1e6, 0)} MV/m. Drawn ${fixed(timesLarger(WET), 0)} times larger.`),
        r('Slowed', `${fixed(INK.slow, 0)} times`, `The ink moves ${fixed(INK.slow, 0)} times slower here than it does: the write of ${fixed(plan.duration * 1000, 0)} ms takes ${fixed(plan.duration * INK.slow, 0)} s. The ink is cut open ${fixed(timesLarger(CELL), 0)} times larger.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt / INK.slow); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the ink, cut open', part: 'cell', view: 'front', replay: false, run() { return inspect(result.getState().pulse / 2); }},
    {label: 'Inspect: pixels close up', part: 'pixel', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the e-reader', part: 'reader', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: an electrowetting pixel', part: 'wetting', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Write',
    description: `The drive writes the middle pixel for its pulse and then turns off, ${INK.slow} times slower than the ink moves.`,
    stepLabel: 'Advance 0.5 s',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'light', label: 'Inspect the light sent back', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, reader, body, screen, text, marker, leaders, pixels, squares, pixelGrid, capsuleLines, cell, frontElectrode, backElectrode, dye, binder, capsuleFill, capsuleWall, whites, blacks, arrow, plus, minus, light, lightFrame, pulseBar, lightGuide, lightCurve, progressCurve, lightTicks, lightCursor, wetting, substrate, wetElectrode, fluoro, water, glass, walls, oil, oilOutline, tangent, wetChart, wetFrame, filmCurve, dropCurve, breakdown, wetTicks, wetCursor};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

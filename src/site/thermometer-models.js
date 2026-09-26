import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {sampleThermometer, sampleSix, LIQUIDS, MEDIA, BULB, SIX, THERMOMETER_DEFAULTS, THERMOMETER_DOMAINS, SIX_DEFAULTS, SIX_DOMAINS} from './thermometer-physics.js';

// ---------------------------------------------------------------------------
// Thermometers: a liquid-in-glass thermometer and Six's maximum-minimum
// thermometer.
//
// Scale: one millimeter is 0.004 scene units for every length along the tubes,
// so the column's rise per degree is drawn true. The bores, a fraction of a
// millimeter wide, are drawn wider so the liquid shows.
//
// Time: the liquid-in-glass thermometer's twenty minutes play forty times faster
// than real time; the maximum-minimum thermometer's day plays an hour a second.
// The breeze's streaks move at a pace chosen to be seen.
//
// Colors: the glass bulb tints from blue at -50 degrees to red at 50; mercury
// is silver and alcohol red.
//
// Charts, beside each: the reading against time, -50 to 50 degrees up (the
// liquid-in-glass thermometer, over 1,200 s) and -30 to 50 degrees up (the
// maximum-minimum thermometer, air in gold and bulb in red over 24 h, with the
// indices' readings). Not to the thermometers' scale.
// ---------------------------------------------------------------------------

const MM = 0.004;
const STEM = {bottom: 8, top: 300, twenty: 154};
const COLD = new THREE.Color(0x4f86c6), HOT = new THREE.Color(0xd23b1f);
const LIQUID_COLORS = [0x9aa7ad, 0xc14f39];
const SPEED = 40;
const TICKS = 11;
const GLASS_CHART = {left: 40, bottom: 20, width: 220, height: 200};
const ARM = {left: -15, right: 15, bottom: -215, top: 195};
const SIX_TICKS = 17;
const SIX_CHART = {left: 95, bottom: -200, width: 220, height: 380};

export const tempColor = T => COLD.clone().lerp(HOT, Math.max(0, Math.min(1, (T + 50) / 100)));
/** Where on the stem a temperature falls, in millimeters, before clamping to the stem. */
export const columnAt = (rise, T) => STEM.twenty + rise * 1000 * (T - 20);
export const glassChartPoint = (t, T) => [(GLASS_CHART.left + t / BULB.duration * GLASS_CHART.width) * MM, (GLASS_CHART.bottom + (Math.max(-50, Math.min(50, T)) + 50) / 100 * GLASS_CHART.height) * MM, 0];
export const sixChartPoint = (hours, T) => [(SIX_CHART.left + hours / 24 * SIX_CHART.width) * MM, (SIX_CHART.bottom + (Math.max(-30, Math.min(50, T)) + 30) / 80 * SIX_CHART.height) * MM, 0];
/** A 9 am start, so many hours later, as a time of day. */
export const timeOfDay = hours => { const minutes = Math.round((9 + hours) * 60) % 1440; return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };

const glassTube = (kit, radius, height, y, parent, opacity = 0.25) => {
  const tube = kit.cylinder(radius * MM, height * MM, [0, y * MM, 0], 'blue', parent);
  tube.material = tube.material.clone();
  tube.material.transparent = true;
  tube.material.opacity = opacity;
  tube.material.depthWrite = false;
  return tube;
};
const liquidRod = (kit, radius, parent) => { const rod = kit.cylinder(radius * MM, 1, [0, 0, 0], 'red', parent); rod.material = rod.material.clone(); return rod; };
const setSpan = (rod, bottom, top) => { const span = Math.max(1e-4, top - bottom); rod.scale.y = span * MM; rod.position.y = (bottom + span / 2) * MM; rod.visible = top - bottom > 1e-4; };

export function createLiquidThermometerModel() {
  const kit = houseModel('Liquid-in-glass thermometer'), {root, part, control, finish} = kit;
  const system = part('system', 'Liquid-in-glass thermometer', 'A glass bulb of liquid on a hair-thin bore. Warmth makes the liquid grow more than the glass, and the extra has nowhere to go but up the bore. Drawn at true length.');

  const bulbPart = part('bulb', 'Bulb', 'Holds 0.118 mL of liquid in glass 0.4 mm thick. Its tint shows its temperature; it must warm or cool before the column can move.', [0, 0, 0], system);
  const bulbGlass = glassTube(kit, 2.9, 6.8, 3.4, bulbPart, 0.45);
  const bulbLiquid = liquidRod(kit, 2.5, bulbPart);
  setSpan(bulbLiquid, 0.4, 6.4);

  const stem = part('stem', 'Stem and bore', 'A glass stem 292 mm long with a bore a fraction of a millimeter across, drawn wider than it is. The liquid column’s top is the reading.', [0, 0, 0], system);
  glassTube(kit, 3, STEM.top - STEM.bottom, (STEM.top + STEM.bottom) / 2, stem, 0.18);
  const column = liquidRod(kit, 0.7, stem);

  const scale = part('scale', 'Scale', 'Marks every 10 degrees, engraved for this bore, with 20 °C at the middle. A finer bore spreads the degrees out but fits fewer on the stem.', [5 * MM, 0, 0], system);
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: 0x374736}));
  ticks.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TICKS * 6), 3));
  ticks.frustumCulled = false;
  scale.add(ticks);
  const scaleNumbers = Array.from({length: TICKS}, (_, i) => textLabel(scale, String(-50 + 10 * i).replace('-', '−'), {height: 5 * MM, align: 'left'}));

  const surroundings = part('surroundings', 'Surroundings', 'Still air, a breeze, or a beaker of stirred water around the bulb. Water carries heat fifty times better than still air.', [0, 0, 0], system);
  const beaker = glassTube(kit, 22, 50, 22, surroundings, 0.3);
  beaker.material.color.set(0x2f6690);
  const streaks = [0, 1, 2].map(() => lineObject(2, 0x9aa7ad, surroundings));

  const chart = part('chart', 'Reading over time', 'The reading against time, 0 to 1,200 s across and -50 to 50 °C up; the gray line is the surroundings. Not to the thermometer’s scale.', [0, 0, 0], system);
  kit.rod(glassChartPoint(0, -50), glassChartPoint(BULB.duration, -50), 0.6 * MM, 'ink', chart);
  kit.rod(glassChartPoint(0, -50), glassChartPoint(0, 50), 0.6 * MM, 'ink', chart);
  const trace = lineObject(121, 0xd23b1f, chart), target = lineObject(2, 0x7a8b83, chart), cursor = lineObject(2, 0x374736, chart);
  chartText(chart, glassChartPoint, {
    title: 'Reading over time', size: 11 * MM,
    x: {min: 0, max: BULB.duration, title: 'Seconds after it is moved', ticks: [[0, '0'], [600, '600'], [1200, '1,200']]},
    y: {min: -50, max: 50, title: 'Temperature (°C)', ticks: [[-50, '−50'], [0, '0'], [50, '50']]},
    legend: [['Reading', 0xd23b1f], ['Surroundings', 0x7a8b83]],
  });

  const specs = {
    liquid: ['Liquid', '', LIQUIDS.map(({value, label}) => ({value, label})), 'Alcohol grows six times as much as mercury for each degree.'],
    bore: ['Bore diameter', 'mm', null, 'A narrower bore makes the same growth climb further.'],
    surroundings: ['Surroundings', '°C', null, 'The thermometer starts at 20 °C and is moved at once into this.'],
    medium: ['Around the bulb', '', MEDIA.map(({value, label}) => ({value, label})), 'How well the surroundings carry heat to the bulb.'],
  };
  for (const [name, [min, max, step]] of Object.entries(THERMOMETER_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, THERMOMETER_DEFAULTS[name], unit, help, options);
  }

  let clock = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleThermometer(values, clock), raw = columnAt(s.rise, s.reads), top = Math.max(STEM.bottom, Math.min(STEM.top, raw));
    setSpan(column, STEM.bottom, top);
    column.material.color.set(LIQUID_COLORS[values.liquid]);
    bulbLiquid.material.color.set(LIQUID_COLORS[values.liquid]);
    bulbGlass.material.color.copy(tempColor(s.bulb));
    beaker.visible = values.medium === 2;
    streaks.forEach((streak, i) => {
      const x = ((clock * 0.2 + i * 20) % 60) - 30;
      streak.geometry.attributes.position.array.set([(x - 8) * MM, (i * 3 + 1) * MM, 6 * MM, (x + 8) * MM, (i * 3 + 1) * MM, 6 * MM]);
      streak.geometry.attributes.position.needsUpdate = true;
      streak.visible = values.medium === 1;
    });

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      const marks = ticks.geometry.attributes.position.array;
      for (let i = 0; i < TICKS; i++) {
        const y = columnAt(s.rise, -50 + 10 * i), on = y >= STEM.bottom && y <= STEM.top, length = i === 5 ? 8 : 4;
        marks.set(on ? [0, y * MM, 0, length * MM, y * MM, 0] : [0, 0, 0, 0, 0, 0], i * 6);
        scaleNumbers[i].visible = on; scaleNumbers[i].userData.place((length + 2) * MM, y * MM, 0);
      }
      ticks.geometry.attributes.position.needsUpdate = true;
      ticks.geometry.computeBoundingSphere();
      const line = trace.geometry.attributes.position.array;
      for (let i = 0; i <= 120; i++) line.set(glassChartPoint(i * 10, sampleThermometer(values, i * 10).reads), i * 3);
      trace.geometry.attributes.position.needsUpdate = true;
      trace.geometry.computeBoundingSphere();
      target.geometry.attributes.position.array.set([...glassChartPoint(0, values.surroundings), ...glassChartPoint(BULB.duration, values.surroundings)]);
      target.geometry.attributes.position.needsUpdate = true;
    }
    cursor.geometry.attributes.position.array.set([...glassChartPoint(clock, -50), ...glassChartPoint(clock, 50)]);
    cursor.geometry.attributes.position.needsUpdate = true;

    const low = 20 - (STEM.twenty - STEM.bottom) / (s.rise * 1000), high = 20 + (STEM.top - STEM.twenty) / (s.rise * 1000);
    const offScale = raw < STEM.bottom ? 'below the scale' : raw > STEM.top ? 'above the scale' : null;
    const shown = s.frozen ? `frozen at ${fixed(s.freezes, 2)} °C` : offScale ?? `${fixed(s.reads, 1)} °C`;
    return {
      state: {...s, top, low, high, offScale},
      readings: [
        r('Your result', clock === 0 ? 'Ready · press Play to move it into the surroundings' : `${fixed(clock, 0)} s · reads ${shown}`),
        r('Bulb', `${fixed(s.bulb, 2)} °C`, `Heading for ${values.surroundings} °C.`),
        r('Column', `${fixed(s.rise * 1000, 3)} mm for each degree`, 'The bulb’s volume times the growth the glass does not match, over the bore’s area.'),
        r('Readable to', `${fixed(s.resolution, 3)} °C`, 'A fifth of a millimeter by eye.'),
        r('Scale covers', `${fixed(low, 1)} to ${fixed(high, 1)} °C`, high > LIQUIDS[values.liquid].boils ? `The stem is long enough for ${fixed(high, 1)} °C, but ${LIQUIDS[values.liquid].label.toLowerCase()} boils at ${LIQUIDS[values.liquid].boils} °C, so the marks above that are never used.` : undefined),
        r('Response', `time constant ${fixed(s.tau, 1)} s`, s.settle > 0 ? `Within 0.5 °C of the surroundings after ${fixed(s.settle, 1)} s.` : 'Already within 0.5 °C.'),
        r('Liquid', `${LIQUIDS[values.liquid].label}, freezing at ${Number(s.freezes.toFixed(2))} °C and boiling at ${LIQUIDS[values.liquid].boils} °C`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(BULB.duration, clock + dt * SPEED); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the column after a minute', part: 'stem', view: 'front', replay: false, run() { clock = 60; return render(); }},
    {label: 'Inspect: the bulb', part: 'bulb', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: twenty minutes on', part: 'chart', view: 'front', replay: false, run() { clock = BULB.duration; return render(); }},
  ];
  result.playback = {
    label: 'Move it into the surroundings',
    description: 'Twenty minutes, forty times faster than real time.',
    stepLabel: 'Advance twenty seconds',
    advance: result.advance,
    step: () => result.advance(20 / SPEED),
    complete: () => clock >= BULB.duration,
    blocked: () => false,
  };

  root.rotation.set(0.05, -0.2, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, bulbPart, bulbGlass, bulbLiquid, stem, column, scale, ticks, surroundings, beaker, streaks, chart, trace, target, cursor, MM, STEM, SPEED, LIQUID_COLORS};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

export function createSixThermometerModel() {
  const kit = houseModel('Maximum-minimum thermometer'), {root, part, control, finish} = kit;
  const system = part('system', 'Maximum-minimum thermometer', 'Six’s design: an alcohol bulb pushes a mercury thread round a U-tube, and the thread pushes two steel indices that stay at the day’s highest and lowest. Drawn at true length.');

  const tube = part('tube', 'U-tube', 'A glass U-tube with a 1 mm bore, drawn wider. Its left arm reads the minimum, with the scale rising downward; its right arm reads the maximum.', [0, 0, 0], system);
  for (const x of [ARM.left, ARM.right]) { const arm = glassTube(kit, 2.5, ARM.top - ARM.bottom, (ARM.top + ARM.bottom) / 2, tube, 0.2); arm.position.x = x * MM; }
  const bend = kit.ring(15 * MM, 1.2 * MM, [0, ARM.bottom * MM, 0], 'metal', tube);
  bend.geometry.dispose();
  bend.geometry = new THREE.TorusGeometry(15 * MM, 1.2 * MM, 8, 32, Math.PI);
  bend.rotation.z = Math.PI;
  bend.material = bend.material.clone();
  bend.material.color.set(LIQUID_COLORS[0]);

  const bulbs = part('bulbs', 'Alcohol bulb', 'The 3 mL bulb on the minimum side, full of alcohol, drawn at its true size. Its alcohol grows and shrinks with the temperature, pushing the mercury thread round the U-tube. The small bulb on the other side holds alcohol and its vapor, which make room.', [0, 0, 0], system);
  const mainBulb = glassTube(kit, SIX.radius * 1000, SIX.length * 1000, ARM.top + 12, bulbs, 0.5);
  mainBulb.position.x = ARM.left * MM;
  mainBulb.material.color.set(LIQUID_COLORS[1]);
  const spare = glassTube(kit, 4, 12, ARM.top + 8, bulbs, 0.35);
  spare.position.x = ARM.right * MM;

  const thread = part('thread', 'Mercury thread and alcohol', 'Mercury, silver, fills the bend and rises in each arm; red alcohol fills the tube above it on both sides.', [0, 0, 0], system);
  const arms = {};
  for (const [side, x] of [['left', ARM.left], ['right', ARM.right]]) {
    const mercury = liquidRod(kit, 1, thread), alcohol = liquidRod(kit, 1, thread);
    mercury.position.x = alcohol.position.x = x * MM;
    mercury.material.color.set(LIQUID_COLORS[0]);
    alcohol.material.color.set(LIQUID_COLORS[1]);
    arms[side] = {mercury, alcohol};
  }

  const indices = part('indices', 'Steel indices', 'A small steel pin in each arm, held by a light spring against the glass. The mercury pushes one up and leaves it there; a magnet slides both back down onto the mercury at the 9 am reset.', [0, 0, 0], system);
  const maxIndex = kit.cylinder(0.9 * MM, 8 * MM, [ARM.right * MM, 0, 0], 'ink', indices), minIndex = kit.cylinder(0.9 * MM, 8 * MM, [ARM.left * MM, 0, 0], 'ink', indices);

  const scales = part('scales', 'Scales', 'Marks every 5 degrees from -30 to 50 °C: rising up the maximum arm and down the minimum arm.', [0, 0, 0], system);
  const scaleLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: 0x374736}));
  scaleLines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SIX_TICKS * 12), 3));
  scaleLines.frustumCulled = false;
  scales.add(scaleLines);
  // Numbers every 10 degrees: up the maximum arm, and down the minimum arm, where cold pushes the mercury up.
  const sixNumbers = Array.from({length: 9}, (_, i) => [textLabel(scales, String(-30 + 10 * i).replace('-', '−'), {height: 7 * MM, align: 'left'}), textLabel(scales, String(-30 + 10 * i).replace('-', '−'), {height: 7 * MM, align: 'right'})]);

  const chart = part('chart', 'The day', 'Air in gold and the bulb in red over the 24 hours from the 9 am reset, -30 to 50 °C up; the gray lines are the indices’ readings so far. Not to the thermometer’s scale.', [0, 0, 0], system);
  kit.rod(sixChartPoint(0, -30), sixChartPoint(24, -30), 0.6 * MM, 'ink', chart);
  kit.rod(sixChartPoint(0, -30), sixChartPoint(0, 50), 0.6 * MM, 'ink', chart);
  const airLine = lineObject(97, 0xe3b45e, chart), bulbLine = lineObject(97, 0xd23b1f, chart), highLine = lineObject(2, 0x7a8b83, chart), lowLine = lineObject(2, 0x7a8b83, chart), cursor = lineObject(2, 0x374736, chart);
  chartText(chart, sixChartPoint, {
    title: 'The day', size: 16 * MM,
    x: {min: 0, max: 24, title: 'From the 9 am reset', ticks: [[0, '9 am'], [6, '3 pm'], [18, '3 am'], [24, '9 am']]},
    y: {min: -30, max: 50, title: 'Temperature (°C)', ticks: [[-30, '−30'], [0, '0'], [50, '50']]},
    legend: [['Air', 0xb8862f], ['Bulb', 0xd23b1f], ['Indices', 0x7a8b83]],
  });

  const specs = {
    mean: ['Day’s average', '°C', null, 'The middle of the day’s swing.'],
    swing: ['Swing either side', '°C', null, 'How far the air rises by 3 pm and falls by 3 am.'],
  };
  for (const [name, [min, max, step]] of Object.entries(SIX_DOMAINS)) {
    const [label, unit, , help] = specs[name];
    control(name, label, min, max, step, SIX_DEFAULTS[name], unit, help);
  }

  let hours = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleSix(values, hours), rightTop = s.maxArm * 1000, leftTop = s.minArm * 1000;
    setSpan(arms.right.mercury, ARM.bottom, rightTop);
    setSpan(arms.right.alcohol, rightTop, ARM.top);
    setSpan(arms.left.mercury, ARM.bottom, leftTop);
    setSpan(arms.left.alcohol, leftTop, ARM.top);
    maxIndex.position.y = (s.maxIndex * 1000 + 4) * MM;
    minIndex.position.y = (s.minIndex * 1000 + 4) * MM;

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      const marks = scaleLines.geometry.attributes.position.array;
      for (let i = 0; i < SIX_TICKS; i++) {
        const T = -30 + 5 * i, up = s.rise * 1000 * (T - SIX.reference);
        marks.set([(ARM.right + 3) * MM, up * MM, 0, (ARM.right + 7) * MM, up * MM, 0, (ARM.left - 3) * MM, -up * MM, 0, (ARM.left - 7) * MM, -up * MM, 0], i * 12);
        if (i % 2 === 0) { const [right, left] = sixNumbers[i / 2]; right.userData.place((ARM.right + 9) * MM, up * MM, 0); left.userData.place((ARM.left - 9) * MM, -up * MM, 0); }
      }
      scaleLines.geometry.attributes.position.needsUpdate = true;
      scaleLines.geometry.computeBoundingSphere();
      for (const [line, field] of [[airLine, 'air'], [bulbLine, 'bulb']]) {
        const array = line.geometry.attributes.position.array;
        for (let i = 0; i <= 96; i++) array.set(sixChartPoint(i / 4, sampleSix(values, i / 4)[field]), i * 3);
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
      }
    }
    highLine.geometry.attributes.position.array.set([...sixChartPoint(0, s.highest), ...sixChartPoint(24, s.highest)]);
    lowLine.geometry.attributes.position.array.set([...sixChartPoint(0, s.lowest), ...sixChartPoint(24, s.lowest)]);
    cursor.geometry.attributes.position.array.set([...sixChartPoint(hours, -30), ...sixChartPoint(hours, 50)]);
    for (const line of [highLine, lowLine, cursor]) line.geometry.attributes.position.needsUpdate = true;

    return {
      state: s,
      readings: [
        r('Your result', `${timeOfDay(hours)} · maximum ${fixed(s.highest, 1)} °C, minimum ${fixed(s.lowest, 1)} °C`),
        r('Air', `${fixed(s.air, 2)} °C`, 'Warmest at 3 pm, coolest at 3 am.'),
        r('Bulb', `${fixed(s.bulb, 2)} °C`, `The alcohol bulb lags the air by ${fixed(s.lag / 60, 1)} minutes, with a time constant of ${fixed(s.tau, 0)} s.`),
        r('Maximum index', `${fixed(s.highest, 2)} °C`, 'The highest the mercury has reached since 9 am.'),
        r('Minimum index', `${fixed(s.lowest, 2)} °C`, 'The lowest since 9 am.'),
        r('Mercury thread', `${fixed(Math.abs(s.maxArm) * 1000, 1)} mm ${s.maxArm >= 0 ? 'toward the maximum arm' : 'toward the minimum arm'}`, `It moves ${fixed(s.rise * 1000, 3)} mm for each degree.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) hours = Math.min(24, hours + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { hours = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: 3 pm', part: 'indices', view: 'front', replay: false, run() { hours = 6; return render(); }},
    {label: 'Inspect: 9 am the next day', part: 'chart', view: 'front', replay: false, run() { hours = 24; return render(); }},
    {label: 'Inspect: the alcohol bulb', part: 'bulbs', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Run the day',
    description: 'From the 9 am reset to 9 am the next day, an hour a second.',
    stepLabel: 'Advance an hour',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => hours >= 24,
    blocked: () => false,
  };

  root.rotation.set(0.05, -0.2, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, tube, bend, bulbs, mainBulb, thread, arms, indices, maxIndex, minIndex, scales, scaleLines, chart, airLine, bulbLine, highLine, lowLine, cursor, MM, ARM};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

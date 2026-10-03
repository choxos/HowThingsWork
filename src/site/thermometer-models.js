import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {sampleSix, SIX, SIX_DEFAULTS, SIX_DOMAINS} from './thermometer-physics.js';

const MM = 0.004;
const LIQUID_COLORS = [0x9aa7ad, 0xc14f39];
const ARM = {left: -15, right: 15, bottom: -215, top: 195};
const SIX_TICKS = 17;
const SIX_CHART = {left: 95, bottom: -200, width: 220, height: 380};

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

export {createLiquidThermometerModel} from './liquid-thermometer-model.js';

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

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, chartText} from './scene-kit.js';
import {sampleWaterClock, waterClockPlan, potRadius, DESIGNS, WATER, WATER_DEFAULTS, WATER_DOMAINS} from './water-clock-physics.js';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh'];

// ---------------------------------------------------------------------------
// Water clock: an outflow pot, straight or flaring, and Ctesibius's inflow
// clock with its constant-head tank, float and pointer.
//
// Scale: one millimeter is 0.003 scene units for every length: the 400 mm pot,
// the 30 mm jar, the level and the hour marks. The hole and tube, a millimeter
// or less across, are drawn wider so they show.
//
// Time: the twelve hours of a night play an hour a second.
//
// The water is tinted from dark blue at 5 degrees to pale blue at 35.
//
// A third of the pot is cut away toward the viewer; the water inside is drawn
// to its level, following the pot's shape.
//
// Chart, beside it: the water level (outflow) or float height (inflow) over
// twelve hours, 0 to 400 mm up, with a gray straight line for an even pace.
// Not to the clock's scale.
// ---------------------------------------------------------------------------

const MM = 0.003;
const TAU = Math.PI * 2;
const CUT = Math.PI / 3;
const H = WATER.height * 1000, JAR = {radius: WATER.jar * 1000, height: WATER.jarHeight * 1000};
const TANK = {x: -150, y: 470, width: 120, height: 60};
const POINTER = {x: 60, base: 440};
const CHART = {left: 260, bottom: 0, width: 300, height: 400};
const PROFILE_POINTS = 24;

export const waterTint = temperature => new THREE.Color(0x2f6690).lerp(new THREE.Color(0x83b4c1), (temperature - 5) / 30);
export const chartPoint = (hours, millimeters) => [(CHART.left + hours / WATER.duration * CHART.width) * MM, (CHART.bottom + Math.max(0, Math.min(H, millimeters)) / H * CHART.height) * MM, 0];
/** The pot's wall, or its water up to a level, as a profile of radius and height in millimeters. */
export const potProfile = (design, top, inset = 0) => Array.from({length: PROFILE_POINTS + 1}, (_, i) => { const y = top * i / PROFILE_POINTS; return [Math.max(0.5, potRadius(design, y / 1000) * 1000 - inset), y]; });
const lathe = (points, closed) => new THREE.LatheGeometry([...(closed ? [new THREE.Vector2(0, 0)] : []), ...points.map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), ...(closed ? [new THREE.Vector2(0, points.at(-1)[1] * MM)] : [])], 48, CUT, TAU - 2 * CUT);

export function createWaterClockModel() {
  const kit = houseModel('Water clock'), {root, part, control, finish} = kit;
  const system = part('system', 'Water clock', 'Water flowing at a known pace measures time: out of a pot whose falling level passes hour marks, or into a jar whose float lifts a pointer. Drawn at true size.');

  const pot = part('pot', 'Outflow pot', 'A pot 400 mm tall draining through a small hole in its floor, a third of it cut away. Straight-sided, its level falls fast at first and slowly later; flared as the Egyptians made them, it falls at an even pace.', [0, 0, 0], system);
  const wall = surface(kit, lathe(potProfile(0, H), false), 'clay', pot, true);
  wall.material.transparent = true;
  wall.material.opacity = 0.55;
  const potWater = surface(kit, lathe(potProfile(0, H, 3), true), 'blue', pot, true);
  const marks = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: 0x374736}));
  marks.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(13 * 6), 3));
  marks.frustumCulled = false;
  pot.add(marks);
  const stream = kit.cylinder(1.2 * MM, 1, [0, 0, 0], 'blue', pot);
  kit.cylinder(90 * MM, 20 * MM, [0, -70 * MM, 0], 'metal', pot);

  const inflow = part('inflow', 'Inflow clock', 'Ctesibius’s design. A tank kept brim-full by its overflow feeds a narrow tube at a steady head; the water fills a jar whose float lifts a pointer past hour marks on a column.', [0, 0, 0], system);
  kit.box([TANK.width * MM, TANK.height * MM, 60 * MM], [TANK.x * MM, (TANK.y + TANK.height / 2) * MM, 0], 'metal', inflow);
  const tankWater = kit.box([(TANK.width - 6) * MM, 50 * MM, 54 * MM], [TANK.x * MM, (TANK.y + 28) * MM, 0], 'blue', inflow);
  tankWater.material = tankWater.material.clone();
  kit.rod([(TANK.x + 40) * MM, (TANK.y + 55) * MM, 0], [(TANK.x + 40) * MM, (TANK.y - 60) * MM, 0], 2 * MM, 'metal', inflow);
  kit.rod([TANK.x * MM, TANK.y * MM, 0], [0, TANK.y * MM, 0], 1.2 * MM, 'gold', inflow);
  const drip = lineObject(2, 0x2f6690, inflow);
  const jar = kit.cylinder(JAR.radius * MM, JAR.height * MM, [0, JAR.height / 2 * MM, 0], 'blue', inflow);
  jar.material = jar.material.clone();
  jar.material.transparent = true;
  jar.material.opacity = 0.25;
  jar.material.depthWrite = false;
  const jarWater = kit.cylinder((JAR.radius - 1) * MM, 1, [0, 0, 0], 'blue', inflow);
  jarWater.material = jarWater.material.clone();
  const float = kit.cylinder((JAR.radius - 4) * MM, 8 * MM, [0, 0, 0], 'wood', inflow);
  const pointerRod = kit.cylinder(1.2 * MM, POINTER.base * MM, [0, 0, 0], 'ink', inflow);
  const pointerTip = kit.sphere(5 * MM, [0, 0, 0], 'red', inflow);
  kit.box([10 * MM, JAR.height * MM, 10 * MM], [POINTER.x * MM, (POINTER.base + JAR.height / 2) * MM, 0], 'cream', inflow);
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color: 0x374736}));
  ticks.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(13 * 6), 3));
  ticks.frustumCulled = false;
  inflow.add(ticks);

  const chart = part('chart', 'Level over the night', 'The water’s level, or the float’s height, over twelve hours, 0 to 400 mm up; the gray line is an even pace. Not to the clock’s scale.', [0, 0, 0], system);
  kit.rod(chartPoint(0, 0), chartPoint(WATER.duration, 0), 1 * MM, 'ink', chart);
  kit.rod(chartPoint(0, 0), chartPoint(0, H), 1 * MM, 'ink', chart);
  const trace = lineObject(49, 0x2f6690, chart), even = lineObject(2, 0x9aa7ad, chart), cursor = lineObject(2, 0x374736, chart);
  chartText(chart, chartPoint, {
    title: 'Level over the night', size: 22 * MM,
    x: {min: 0, max: WATER.duration, title: 'Hours', ticks: [[0, '0'], [6, '6'], [12, '12']]},
    y: {min: 0, max: H, title: 'Water level or float height (mm)', ticks: [[0, '0'], [200, '200'], [400, '400']]},
    legend: [['This clock', 0x2f6690], ['An even pace', 0x7a8b83]],
  });

  const specs = {
    design: ['Clock', '', DESIGNS.map(({value, label}) => ({value, label})), 'Two ways to measure time with water.'],
    bore: ['Hole', 'mm', null, 'The outflow pot’s hole; the inflow clock’s tube is half as wide.'],
    temperature: ['Water', '°C', null, 'Warm water is thinner and flows more easily through a narrow tube.'],
  };
  for (const [name, [min, max, step]] of Object.entries(WATER_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, WATER_DEFAULTS[name], unit, help, options);
  }

  let hours = 0, lastClock = 0, disposed = false, shapeKey = '', levelKey = '';
  const result = finish(values => {
    const s = sampleWaterClock(values, hours), design = values.design, outflow = design !== 2;
    pot.visible = outflow;
    inflow.visible = !outflow;
    const levelMM = s.level * 1000, tint = waterTint(values.temperature);
    for (const water of [potWater, jarWater, tankWater]) water.material.color.copy(tint);

    const key = JSON.stringify(values);
    if (key !== shapeKey) {
      shapeKey = key;
      wall.geometry.dispose();
      wall.geometry = lathe(potProfile(design === 1 ? 1 : 0, H), false);
      const markArray = marks.geometry.attributes.position.array, tickArray = ticks.geometry.attributes.position.array;
      s.marks.forEach((mark, i) => {
        const y = mark * 1000, x = outflow ? potRadius(design, mark) * 1000 : 0;
        markArray.set(outflow ? [(x + 2) * MM, y * MM, 0, (x + 14) * MM, y * MM, 0] : [0, 0, 0, 0, 0, 0], i * 6);
        tickArray.set(outflow ? [0, 0, 0, 0, 0, 0] : [(POINTER.x - 5) * MM, (POINTER.base + y) * MM, 6 * MM, (POINTER.x + 9) * MM, (POINTER.base + y) * MM, 6 * MM], i * 6);
      });
      marks.geometry.attributes.position.needsUpdate = true;
      ticks.geometry.attributes.position.needsUpdate = true;
      marks.geometry.computeBoundingSphere();
      ticks.geometry.computeBoundingSphere();
      const array = trace.geometry.attributes.position.array;
      for (let i = 0; i <= 48; i++) array.set(chartPoint(i / 4, sampleWaterClock(values, i / 4).level * 1000), i * 3);
      trace.geometry.attributes.position.needsUpdate = true;
      trace.geometry.computeBoundingSphere();
      even.geometry.attributes.position.array.set(outflow ? [...chartPoint(0, H), ...chartPoint(s.values.design === 1 ? s.empties : WATER.duration, 0)] : [...chartPoint(0, 0), ...chartPoint(WATER.duration, s.rise * 1000 * WATER.duration)]);
      even.geometry.attributes.position.needsUpdate = true;
    }
    const levelNow = JSON.stringify([key, fixed(levelMM, 3)]);
    if (levelNow !== levelKey) {
      levelKey = levelNow;
      potWater.geometry.dispose();
      potWater.geometry = lathe(potProfile(design === 1 ? 1 : 0, Math.max(0.5, levelMM), 3), true);
      potWater.visible = outflow && levelMM > 0.5;
    }
    stream.visible = outflow && levelMM > 0.5;
    stream.scale.y = 60 * MM;
    stream.position.y = -30 * MM;

    jarWater.scale.y = Math.max(1e-3, levelMM) * MM;
    jarWater.position.y = Math.max(1e-3, levelMM) / 2 * MM;
    float.position.y = (levelMM + 4) * MM;
    pointerRod.position.y = (levelMM + 8 + POINTER.base / 2) * MM;
    pointerTip.position.set(POINTER.x * MM, (POINTER.base + levelMM) * MM, 8 * MM);
    drip.geometry.attributes.position.array.set([0, TANK.y * MM, 0, 0, (levelMM + 10) * MM, 0]);
    drip.geometry.attributes.position.needsUpdate = true;
    drip.geometry.computeBoundingSphere();
    cursor.geometry.attributes.position.array.set([...chartPoint(hours, 0), ...chartPoint(hours, H)]);
    cursor.geometry.attributes.position.needsUpdate = true;

    // The eleventh hour, or the last full hour of a pot that empties sooner.
    const lastHour = Math.min(10, Math.max(0, Math.floor(s.empties ?? 11) - 1));
    const readings = outflow ? [
      r('Your result', `${fixed(hours, 1)} h · level ${fixed(levelMM, 1)} mm`),
      r('Falling', `${fixed(s.fallRate * 1000, 1)} mm an hour now`, design === 1 ? 'The flared pot’s level falls at the same pace all the way down.' : 'The straight pot falls fastest when full, as the water’s weight pushes harder.'),
      r('Hour marks', `${fixed((s.marks[0] - s.marks[1]) * 1000, 1)} mm apart at the top, ${fixed((s.marks[lastHour] - s.marks[lastHour + 1]) * 1000, 1)} mm in the ${ORDINALS[lastHour]} hour`, s.empties < 11 ? `The pot is empty ${fixed(s.empties, 2)} h in, so its ${ORDINALS[lastHour]} hour is the last it marks in full.` : undefined),
      r('Empties after', `${fixed(s.empties, 2)} h`, `${fixed(s.volume * 1000, 2)} L through a ${fixed(values.bore, 1)} mm hole.`),
      r('Water temperature', `${values.temperature} °C`, 'A sharp hole’s flow barely depends on it.'),
    ] : [
      r('Your result', `${fixed(hours, 1)} h · float ${fixed(levelMM, 1)} mm up`),
      r('Rising', `${fixed(s.rise * 1000, 2)} mm an hour`, 'Steady, because the tank’s overflow keeps the head the same.'),
      r('Flow', `${fixed(s.flow * 3.6e9, 1)} mL an hour`, `Through a ${fixed(values.bore / 2, 2)} mm tube, by Poiseuille’s law.`),
      r('Water', `${values.temperature} °C, ${fixed(s.viscosity * 1000, 3)} mPa·s`, 'Warmer water is thinner, so the clock runs faster.'),
      r('Jar full after', `${fixed(s.full, 2)} h`),
      r('Flow in the tube', `Reynolds number ${fixed(s.reynolds, 0)}`, 'Well under 2,000: smooth flow, as the law assumes.'),
    ];
    return {state: {...s, levelMM}, readings};
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) hours = Math.min(WATER.duration, hours + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { hours = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: after six hours', part: 'system', view: 'front', replay: false, run() { hours = 6; return render(); }},
    {label: 'Inspect: the hour marks', part: 'pot', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the night on the chart', part: 'chart', view: 'front', replay: false, run() { hours = WATER.duration; return render(); }},
  ];
  result.playback = {
    label: 'Run the night',
    description: 'Twelve hours, an hour a second.',
    stepLabel: 'Advance an hour',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => hours >= WATER.duration,
    blocked: () => false,
  };

  root.rotation.set(0.12, -0.25, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {tankWater, system, pot, wall, potWater, marks, stream, inflow, jarWater, float, pointerRod, pointerTip, ticks, drip, chart, trace, even, cursor, MM, POINTER, TANK, CUT};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

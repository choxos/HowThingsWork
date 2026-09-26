import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, chartText} from './scene-kit.js';
import {sampleWatch, balance, ALLOYS, WATCH, SPRING_LENGTH, WATCH_DEFAULTS as D, WATCH_DOMAINS} from './watch-physics.js';

// ---------------------------------------------------------------------------
// Mechanical watch: the movement seen from the back with its bridges removed.
//
// Scale: one millimeter is 0.04 scene units, so the 30 mm movement fills the
// view. The balance, escape wheel and lever are drawn at their true sizes; the
// hairspring's 12 turns are drawn spread evenly between 0.8 and 3.2 mm, as its
// real ones are, though far thicker than 0.03 mm so they can be seen.
//
// Time: slowed tenfold. Two seconds of the watch's time play in twenty; the
// balance swings through its true angle.
//
// Charts, beside the movement: the balance's swing against hours since
// winding, 0 to 46 h across and 0 to 360 degrees up, with the 110 degree line
// below which the watch stops; and the rate against temperature for steel
// (dark) and Nivarox (silver) hairsprings, 0 to 40 degrees across and 200 s a
// day either way up. Dots mark this watch. Not to the movement's scale.
// ---------------------------------------------------------------------------

const MM = 0.04;
const TAU = Math.PI * 2;
const BALANCE = [-2, -7, 2.4], ESCAPE = [8, -4, 1.4], LEVER = [5, -7, 1.9], BARREL = [-6, 5, 1.2], FOURTH = [5, 3, 1.4];
const SPIRAL = {inner: 0.8, outer: 3.2, turns: 12, stud: Math.PI / 2, points: 12 * 24 + 1};
const MAINSPRING = {inner: 1.2, outer: 5, points: 400};
const AMP = {left: 19, bottom: 2, width: 26, height: 12, max: 360};
const RATE = {left: 19, bottom: -18, width: 26, height: 12, spread: 200};
const ALLOY_COLORS = [0x2f3640, 0xb4c5b0];
const DURATION = 2;

/** The hairspring's centerline around the balance's axis: the outer end held at the stud, the inner end turned with the balance. */
export const hairspringPoints = angle => Array.from({length: SPIRAL.points}, (_, i) => {
  const s = i / (SPIRAL.points - 1), radius = SPIRAL.inner + (SPIRAL.outer - SPIRAL.inner) * s, phi = SPIRAL.stud - TAU * SPIRAL.turns * (1 - s) + angle * (1 - s);
  return [radius * Math.cos(phi), radius * Math.sin(phi)];
});
export const mainspringTurns = hours => 10 - 6 * Math.min(hours, 44) / 44;
export const mainspringPoints = hours => Array.from({length: MAINSPRING.points}, (_, i) => {
  const s = i / (MAINSPRING.points - 1), radius = MAINSPRING.inner + (MAINSPRING.outer - MAINSPRING.inner) * s, phi = TAU * mainspringTurns(hours) * s;
  return [radius * Math.cos(phi), radius * Math.sin(phi)];
});
export const ampPoint = (hours, degrees) => [(AMP.left + hours / 46 * AMP.width) * MM, (AMP.bottom + Math.min(degrees, AMP.max) / AMP.max * AMP.height) * MM, 0];
export const ratePoint = (temperature, rate) => [(RATE.left + temperature / 40 * RATE.width) * MM, (RATE.bottom + (Math.max(-RATE.spread, Math.min(RATE.spread, rate)) / RATE.spread + 1) / 2 * RATE.height) * MM, 0];

/** A 15-tooth escape wheel outline in millimeters. */
export function escapeShape(teeth = WATCH.teeth, root = 1.8, tip = 2.5) {
  const shape = new THREE.Shape(), at = (radius, angle) => [radius * Math.sin(angle), radius * Math.cos(angle)];
  for (let i = 0; i < teeth; i++) {
    const a = TAU * i / teeth, c = TAU * (i + 1) / teeth;
    if (i === 0) shape.moveTo(...at(root, a));
    shape.lineTo(...at(tip, a + 0.3 * (c - a)));
    shape.lineTo(...at(tip, a + 0.45 * (c - a)));
    shape.lineTo(...at(root, c));
  }
  shape.closePath();
  return shape;
}

export function createWatchModel() {
  const kit = houseModel('Mechanical watch'), {root, part, control, finish} = kit;
  const system = part('system', 'Mechanical watch', 'A mainspring turns the wheels; the lever escapement lets them move half a tooth at each swing of the balance and gives it a push; the balance and its hairspring set the pace. Seen from the back, bridges removed.');

  const plate = part('plate', 'Movement plate', 'The brass plate, 30 mm across, that carries the wheels’ pivots.', [0, 0, 0], system);
  kit.disk(15 * MM, 1 * MM, [0, 0, 0], 'metal', plate);

  const barrel = part('barrel', 'Mainspring and barrel', 'A coiled steel ribbon in a drum. Winding coils it tight around the arbor; as it unwinds over about 42 hours it turns the barrel and the wheels. Drawn with fewer coils as it runs down.', [BARREL[0] * MM, BARREL[1] * MM, BARREL[2] * MM], system);
  kit.ring(5.5 * MM, 0.35 * MM, [0, 0, 0], 'gold', barrel);
  kit.disk(1 * MM, 0.8 * MM, [0, 0, 0], 'ink', barrel);
  const mainspring = lineObject(MAINSPRING.points, 0x7a8b83, barrel);

  const train = part('train', 'Wheel train', 'The center, third and fourth wheels carry the barrel’s turning up to the escape wheel. The fourth wheel turns once a minute and carries the seconds hand. Drawn without teeth.', [0, 0, 0], system);
  for (const [x, y, radius] of [[0, 0, 4], [3.5, -0.5, 2.6], [FOURTH[0], FOURTH[1], 3]]) kit.disk(radius * MM, 0.3 * MM, [x * MM, y * MM, 1.2 * MM], 'gold', train);
  const secondsHand = new THREE.Group();
  secondsHand.position.set(FOURTH[0] * MM, FOURTH[1] * MM, 1.8 * MM);
  train.add(secondsHand);
  kit.box([0.3 * MM, 3.5 * MM, 0.2 * MM], [0, 1.75 * MM, 0], 'red', secondsHand);

  const escapement = part('escapement', 'Lever escapement', 'The 15-tooth escape wheel and the pallet lever. Each swing of the balance knocks the lever from one banking pin to the other: a pallet lets a tooth go, the tooth pushes the lever, and the lever’s fork pushes the balance. The lever moves 10 degrees between its pins.', [0, 0, 0], system);
  const wheelGeometry = new THREE.ExtrudeGeometry(escapeShape(), {depth: 0.25, bevelEnabled: false});
  wheelGeometry.scale(MM, MM, MM);
  const escapeWheel = surface(kit, wheelGeometry, 'ink', escapement);
  escapeWheel.position.set(ESCAPE[0] * MM, ESCAPE[1] * MM, ESCAPE[2] * MM);
  const lever = new THREE.Group();
  lever.position.set(LEVER[0] * MM, LEVER[1] * MM, LEVER[2] * MM);
  escapement.add(lever);
  const toBalance = [BALANCE[0] - LEVER[0], BALANCE[1] - LEVER[1]], toEscape = [ESCAPE[0] - LEVER[0], ESCAPE[1] - LEVER[1]];
  kit.rod([0, 0, 0], [toBalance[0] * 0.8 * MM, toBalance[1] * 0.8 * MM, 0], 0.18 * MM, 'gold', lever);
  kit.rod([0, 0, 0], [toEscape[0] * 0.6 * MM, toEscape[1] * 0.6 * MM, 0], 0.18 * MM, 'gold', lever);
  for (const side of [-1, 1]) kit.box([0.5 * MM, 0.8 * MM, 0.3 * MM], [(toEscape[0] * 0.6 + side * 0.9) * MM, (toEscape[1] * 0.6 - side * 0.4) * MM, 0], 'red', lever);
  for (const side of [-1, 1]) kit.cylinder(0.15 * MM, 1 * MM, [(LEVER[0] + toBalance[0] * 0.55 + side * 0.9) * MM, (LEVER[1] + toBalance[1] * 0.55 + 0.3) * MM, 1.5 * MM], 'ink', escapement).rotation.x = Math.PI / 2;

  const balancePart = part('balance', 'Balance wheel', 'A ring 9 mm across on a staff, drawn at its true size. It swings back and forth, turning the hairspring’s inner end with it, and its roller jewel meets the lever’s fork only near the middle of each swing.', [BALANCE[0] * MM, BALANCE[1] * MM, BALANCE[2] * MM], system);
  const wheel = new THREE.Group();
  balancePart.add(wheel);
  kit.ring(WATCH.radius * 1000 * MM, 0.35 * MM, [0, 0, 0], 'gold', wheel);
  for (const angle of [0, Math.PI]) kit.rod([0, 0, 0], [4.4 * Math.cos(angle) * MM, 4.4 * Math.sin(angle) * MM, 0], 0.15 * MM, 'gold', wheel);
  kit.disk(0.9 * MM, 0.3 * MM, [0, 0, -0.4 * MM], 'metal', wheel);
  kit.sphere(0.22 * MM, [0, -0.7 * MM, -0.4 * MM], 'red', wheel);

  const hairspring = part('hairspring', 'Hairspring', 'A spiral of special alloy, 84 mm long, 0.12 mm tall and 0.03 mm thick. Its outer end is pinned to the stud, its inner end to the balance. Twisting it one way coils it tighter, the other way looser, and either way it pushes back; the regulator’s curb pins set how much of it works.', [BALANCE[0] * MM, BALANCE[1] * MM, (BALANCE[2] + 0.5) * MM], system);
  const coil = lineObject(SPIRAL.points, ALLOY_COLORS[1], hairspring);
  kit.box([0.6 * MM, 0.6 * MM, 0.5 * MM], [SPIRAL.outer * Math.cos(SPIRAL.stud) * MM, (SPIRAL.outer + 0.3) * MM, 0], 'ink', hairspring);
  const regulator = new THREE.Group();
  hairspring.add(regulator);
  kit.rod([0, 0, 0.3 * MM], [0, -6 * MM, 0.3 * MM], 0.15 * MM, 'metal', regulator);
  kit.rod([0, 0, 0.3 * MM], [0.9 * MM, (SPIRAL.outer + 0.2) * MM, 0.3 * MM], 0.12 * MM, 'metal', regulator);

  const charts = part('charts', 'Charts', 'The swing against hours since winding, with the 110 degree line below which the watch stops; and the rate against temperature for steel and Nivarox hairsprings. Not to the movement’s scale.', [0, 0, 0], system);
  const axis = (a, b) => kit.rod(a, b, 0.08 * MM, 'ink', charts);
  axis(ampPoint(0, 0), ampPoint(46, 0));
  axis(ampPoint(0, 0), ampPoint(0, 360));
  axis(ratePoint(0, -200), ratePoint(40, -200));
  axis(ratePoint(0, -200), ratePoint(0, 200));
  axis(ratePoint(0, 0), ratePoint(40, 0));
  const stopLine = lineObject(2, 0xc14f39, charts);
  stopLine.geometry.attributes.position.array.set([...ampPoint(0, 110), ...ampPoint(46, 110)]);
  const ampLine = lineObject(47, 0x2f6690, charts);
  const rateLines = ALLOYS.map((_, i) => lineObject(41, ALLOY_COLORS[i], charts));
  const ampDot = kit.sphere(0.35 * MM, [0, 0, 0], 'red', charts), rateDot = kit.sphere(0.35 * MM, [0, 0, 0], 'red', charts);
  chartText(charts, ampPoint, {
    title: 'Swing as the mainspring runs down', size: 1.2 * MM,
    x: {min: 0, max: 46, title: 'Hours since winding', ticks: [[0, '0'], [24, '24'], [46, '46']]},
    y: {min: 0, max: 360, title: 'Swing each way (degrees)', ticks: [[0, '0'], [110, '110'], [360, '360']]},
    legend: [['Swing', 0x2f6690], ['Below this the lever stops', 0xc14f39]],
  });
  chartText(charts, ratePoint, {
    title: 'Rate against temperature', size: 1.2 * MM,
    x: {min: 0, max: 40, title: 'Temperature (°C)', ticks: [[0, '0'], [20, '20'], [40, '40']]},
    y: {min: -200, max: 200, title: 'Seconds a day, gained or lost', ticks: [[-200, '−200'], [0, '0'], [200, '+200']]},
    legend: [['Carbon steel', 0x2f3640], ['Nivarox', 0x7d8f7a]],
  });

  const specs = {
    index: ['Regulator', 'marks', null, 'Each mark toward fast shortens the hairspring’s working length by 0.02%.'],
    alloy: ['Hairspring alloy', '', ALLOYS.map(({value, label}) => ({value, label})), 'Steel softens as it warms; Nivarox is made not to.'],
    temperature: ['Temperature', '°C', null, 'The watch was set to time at 20 °C.'],
    hours: ['Since winding', 'h', null, 'The mainspring’s push fades as it unwinds.'],
  };
  for (const [name, [min, max, step]] of Object.entries(WATCH_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options);
  }

  let time = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleWatch(values, time);
    wheel.rotation.z = s.angle;
    const spiral = coil.geometry.attributes.position.array;
    hairspringPoints(s.angle).forEach(([x, y], i) => spiral.set([x * MM, y * MM, 0], i * 3));
    coil.geometry.attributes.position.needsUpdate = true;
    coil.geometry.computeBoundingSphere();
    coil.material.color.set(ALLOY_COLORS[values.alloy]);
    regulator.rotation.z = values.index * 3 * Math.PI / 180;
    lever.rotation.z = s.fork;
    escapeWheel.rotation.z = -s.escape;
    secondsHand.rotation.z = -s.seconds;
    const spring = mainspring.geometry.attributes.position.array;
    mainspringPoints(values.hours).forEach(([x, y], i) => spring.set([x * MM, y * MM, 0.4 * MM], i * 3));
    mainspring.geometry.attributes.position.needsUpdate = true;
    mainspring.geometry.computeBoundingSphere();

    const key = JSON.stringify({...values, hours: 0});
    if (key !== chartKey) {
      chartKey = key;
      const amps = ampLine.geometry.attributes.position.array;
      for (let hours = 0; hours <= 46; hours++) amps.set(ampPoint(hours, balance({...values, hours}).amplitude * 180 / Math.PI), hours * 3);
      ampLine.geometry.attributes.position.needsUpdate = true;
      ampLine.geometry.computeBoundingSphere();
      rateLines.forEach((line, alloy) => {
        const array = line.geometry.attributes.position.array;
        for (let temperature = 0; temperature <= 40; temperature++) array.set(ratePoint(temperature, balance({...values, alloy, temperature, hours: 0}).rate), temperature * 3);
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
      });
    }
    ampDot.position.set(...ampPoint(values.hours, s.amplitude * 180 / Math.PI));
    rateDot.position.set(...ratePoint(values.temperature, s.rate ?? 0));

    const degrees = x => x * 180 / Math.PI;
    const rateText = s.rate === null ? 'stopped' : Math.abs(s.rate) < 0.005 ? 'keeps perfect time' : `${s.rate > 0 ? 'gains' : 'loses'} ${fixed(Math.abs(s.rate), 2)} s a day`;
    return {
      state: s,
      readings: [
        r('Your result', s.running ? `Running · ${rateText}` : 'Stopped · the mainspring is spent'),
        r('Balance', `${fixed(s.frequency, 6)} Hz, ${fixed(s.beatsPerHour, 0)} beats an hour`, 'Set by the balance’s inertia and the hairspring’s stiffness alone.'),
        r('Swing', `${fixed(degrees(s.amplitude), 1)} degrees each way`, s.running ? 'Where each beat’s push balances what the swing loses.' : `Under the ${fixed(degrees(WATCH.minimum), 0)} degrees the lever needs.`),
        r('Rate', rateText),
        r('Hairspring', `${fixed(s.length * 1000, 2)} mm working, ${fixed(s.kappa * 1e6, 3)} µN·m per radian`, `${ALLOYS[values.alloy].label} at ${values.temperature} °C.`),
        r('Mainspring', `${fixed(s.torque * 1000, 2)} mN·m, ${values.hours} h after winding`),
        r('Energy', `${fixed(s.power * 1e6, 3)} µW reaches the balance; ${fixed(s.beatEnergy * 1e6, 3)} µJ a beat`, `The swing holds ${fixed(s.energy * 1e6, 2)} µJ.`),
        r('Balance now', `${fixed(degrees(s.angle), 1)} degrees`, s.running ? `${s.beats} beats so far.` : 'Still.'),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) time = Math.min(DURATION, time + dt / WATCH.slow); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { time = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the balance and hairspring', part: 'hairspring', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the lever escapement', part: 'escapement', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the mainspring', part: 'barrel', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Let the balance swing',
    description: 'Two seconds of the watch’s time, slowed tenfold: eight beats a second.',
    stepLabel: 'Advance one beat',
    advance: result.advance,
    step: () => result.advance(WATCH.slow * balance(result.getState().values).period / 2),
    complete: () => time >= DURATION,
    blocked: () => false,
  };

  root.rotation.set(0.25, -0.2, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, plate, barrel, mainspring, train, secondsHand, escapement, escapeWheel, lever, balancePart, wheel, hairspring, coil, regulator, charts, ampLine, rateLines, ampDot, rateDot, stopLine, MM, BALANCE, DURATION, ALLOY_COLORS};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

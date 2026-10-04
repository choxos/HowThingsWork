import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, solidArrow, chartText} from './scene-kit.js';
import {sampleQuartzClock, quartzClockPlan, crystalFrequency, dailyRate, tineLength, QUARTZ, QUARTZ_CLOCK_DEFAULTS, QUARTZ_CLOCK_DOMAINS} from './quartz-physics.js';

const TAU = Math.PI * 2;
const clampUnit = x => Math.max(-1, Math.min(1, x));
const START = 10 * 3600 + 10 * 60;

const CLOCK = {MM: 0.02, fork: [-14, -16, 6], plate: [18, -34, 6], motor: [12, 6, 6], lamps: [-26, 20, 6], battery: [-46, -6, 8], chart: {left: 80, bottom: -50, width: 130, height: 100, spread: 5}};
export const clockChartPoint = (temperature, rate) => [(CLOCK.chart.left + (temperature + 10) / 60 * CLOCK.chart.width) * CLOCK.MM, (CLOCK.chart.bottom + (clampUnit(rate / CLOCK.chart.spread) + 1) / 2 * CLOCK.chart.height) * CLOCK.MM, 0];
export const FORCE_SCALE = 0.5;
/** The tines' drawn sway, in millimeters: twice a second, 0.3 mm wide. */
export const tineSway = time => 0.3 * Math.sin(TAU * 2 * time);

export function createQuartzClockModel() {
  const MM = CLOCK.MM, kit = houseModel('Quartz clock'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Quartz clock', 'A quartz tuning fork rings 32,768 times a second; a chip halves that fifteen times to one pulse a second; each pulse turns a stepping motor half a turn, and gears move the seconds hand. The case and dial are cut back.');

  const movement = part('movement', 'Movement case', 'The plastic case behind the dial that holds the circuit, motor and gears. Its front is cut away.', [0, 0, 0], system);
  kit.box([64 * MM, 64 * MM, 2 * MM], [0, 0, 0], 'cream', movement);
  covers.push(kit.box([64 * MM, 64 * MM, 1 * MM], [0, 0, 16 * MM], 'cream', movement));

  const battery = part('battery', 'AA cell', 'A 1.5 V cell holding 2,400 mAh. The clock draws about 0.1 mA on average, mostly in the motor’s short pulses.', [CLOCK.battery[0] * MM, CLOCK.battery[1] * MM, CLOCK.battery[2] * MM], system);
  kit.cylinder(7.25 * MM, 50 * MM, [0, 0, 0], 'leaf', battery);
  kit.cylinder(2.5 * MM, 1.5 * MM, [0, 25.7 * MM, 0], 'metal', battery);

  const quartz = part('quartz', 'Quartz crystal', 'A tuning fork of quartz 2.59 mm long in a sealed can, beside a quartz plate squeezed in a clamp to show the piezoelectric effect: squeezing quartz frees electric charge, and a voltage makes it bend. The chip’s oscillator circuit uses both to keep the fork ringing.', [CLOCK.fork[0] * MM, CLOCK.fork[1] * MM, CLOCK.fork[2] * MM], system);
  // The fork and the squeezed plate are parts of their own, so each close-up can frame its subject.
  const fork = part('fork', 'Quartz tuning fork', 'Two tines of quartz 2.59 mm long in a sealed can. The circuit bends them with a voltage and feels them ring 32,768 times a second.', [0, 0, 0], quartz);
  const can = kit.cylinder(1.5 * MM, 8 * MM, [0, 2.5 * MM, 0], 'metal', fork);
  can.material = can.material.clone();
  can.material.transparent = true;
  can.material.opacity = 0.25;
  const L = tineLength() * 1000;
  kit.box([1.2 * MM, 0.8 * MM, 0.35 * MM], [0, -0.4 * MM, 0], 'cream', fork);
  const tines = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4 * MM, 0, 0);
    fork.add(pivot);
    kit.box([0.25 * MM, L * MM, 0.35 * MM], [0, L / 2 * MM, 0], 'cream', pivot);
    pivot.userData.side = side;
    return pivot;
  });
  const plateGroup = part('plate', 'Squeezed quartz plate', 'A quartz plate 1 cm square and 1 mm thick in a clamp. Squeezing it frees 2.31 pC of charge for each newton, which the meter reads as a voltage.', [(CLOCK.plate[0] - CLOCK.fork[0]) * MM, (CLOCK.plate[1] - CLOCK.fork[1]) * MM, 0], quartz);
  kit.box([10 * MM, 1 * MM, 10 * MM], [0, 0, 0], 'cream', plateGroup);
  for (const side of [-1, 1]) kit.box([12 * MM, 1.5 * MM, 12 * MM], [0, side * 1.3 * MM, 0], 'metal', plateGroup);
  const squeeze = solidArrow(kit, 0xd9822b, plateGroup, 0.4 * MM);
  squeeze.userData.setDirection(new THREE.Vector3(0, -1, 0));
  const meter = new THREE.Group();
  meter.position.set(12 * MM, 6 * MM, 0);
  plateGroup.add(meter);
  kit.disk(5 * MM, 1 * MM, [0, 0, -0.6 * MM], 'cream', meter);
  const needle = new THREE.Group();
  meter.add(needle);
  kit.box([0.4 * MM, 4.5 * MM, 0.3 * MM], [0, 2.25 * MM, 0], 'red', needle);

  const divider = part('divider', 'Divider chip', 'Fifteen flip-flops in a row, each flipping once for every two flips of the one before. The lamps show each stage’s state: the first flicker at thousands of times a second, the last once a second.', [CLOCK.lamps[0] * MM, CLOCK.lamps[1] * MM, CLOCK.lamps[2] * MM], system);
  kit.box([34 * MM, 6 * MM, 1 * MM], [15 * MM, 0, -0.6 * MM], 'ink', divider);
  const lamps = Array.from({length: QUARTZ.stages}, (_, k) => { const lamp = kit.sphere(0.9 * MM, [k * 2.1 * MM, 0, 0], 'ink', divider); lamp.material = lamp.material.clone(); return lamp; });

  const motor = part('motor', 'Stepping motor', 'A coil magnetizes a stator, and a small round magnet, the rotor, turns half a turn at each pulse, the pulses alternating in direction. Gears of 30 to 1 carry it to the seconds hand.', [CLOCK.motor[0] * MM, CLOCK.motor[1] * MM, CLOCK.motor[2] * MM], system);
  kit.box([4 * MM, 16 * MM, 3 * MM], [-9 * MM, 0, 0], 'gold', motor);
  kit.box([14 * MM, 3 * MM, 2 * MM], [-2 * MM, 6.5 * MM, 0], 'metal', motor);
  kit.box([14 * MM, 3 * MM, 2 * MM], [-2 * MM, -6.5 * MM, 0], 'metal', motor);
  const rotor = new THREE.Group();
  rotor.position.set(4 * MM, 0, 0);
  motor.add(rotor);
  for (const [start, color] of [[0, 'red'], [Math.PI, 'blue']]) {
    const half = kit.cylinder(1, 1, [0, 0, 0], color, rotor);
    half.geometry.dispose();
    half.geometry = new THREE.CylinderGeometry(3 * MM, 3 * MM, 2 * MM, 24, 1, false, start, Math.PI);
    half.rotation.x = Math.PI / 2;
  }

  const dial = part('dial', 'Hands', 'The seconds hand steps 6 degrees each second; the minute and hour hands follow through the gears.', [0, 0, 18 * MM], system);
  kit.ring(30 * MM, 0.5 * MM, [0, 0, 0], 'ink', dial);
  const hand = (length, width, color) => { const group = new THREE.Group(); dial.add(group); kit.box([width * MM, length * MM, 0.5 * MM], [0, length / 2 * MM, 0], color, group); return group; };
  const hourHand = hand(16, 2, 'ink'), minuteHand = hand(25, 1.3, 'ink'), secondsHand = hand(27, 0.5, 'red');

  const chart = part('chart', 'Rate against temperature', 'How many seconds a day the clock gains or loses at each temperature, from -10 to 50 °C across and 5 s either way up. Quartz runs fastest at 25 °C. The dot is this clock. Not to the clock’s scale.', [0, 0, 0], system);
  kit.rod(clockChartPoint(-10, -5), clockChartPoint(50, -5), 0.5 * MM, 'ink', chart);
  kit.rod(clockChartPoint(-10, -5), clockChartPoint(-10, 5), 0.5 * MM, 'ink', chart);
  kit.rod(clockChartPoint(-10, 0), clockChartPoint(50, 0), 0.25 * MM, 'ink', chart);
  const curve = lineObject(61, 0x2f6690, chart), dot = kit.sphere(2 * MM, [0, 0, 0], 'red', chart);
  chartText(chart, clockChartPoint, {
    title: 'Rate against temperature', size: 7 * MM,
    x: {min: -10, max: 50, title: 'Room temperature (°C)', ticks: [[-10, '−10'], [25, '25'], [50, '50']]},
    y: {min: -5, max: 5, title: 'Seconds a day, gained or lost', ticks: [[-5, '−5'], [0, '0'], [5, '+5']]},
    legend: [['This crystal', 0x2f6690], ['Now', 0xc14f39]], legendAt: [50, 5],
  });

  const specs = {
    temperature: ['Room', '°C', null, 'Quartz is cut to ring fastest at 25 °C and slows either side.'],
    trim: ['Trimming capacitor', 'ppm', null, 'Pulls the crystal’s frequency a few parts per million either way when the clock is made.'],
    squeeze: ['Squeeze on the quartz plate', 'N', null, 'The piezoelectric demonstration beside the crystal.'],
  };
  for (const [name, [min, max, step]] of Object.entries(QUARTZ_CLOCK_DOMAINS)) {
    const [label, unit, , help] = specs[name];
    control(name, label, min, max, step, QUARTZ_CLOCK_DEFAULTS[name], unit, help);
  }

  let time = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleQuartzClock(values, time);
    for (const tine of tines) tine.rotation.z = -tine.userData.side * tineSway(time) / L;
    s.dividers.forEach((on, k) => lamps[k].material.color.set(on ? 0xe3b45e : 0x374736));
    rotor.rotation.z = s.rotor;
    secondsHand.rotation.z = -s.secondsHand;
    minuteHand.rotation.z = -TAU * (START + s.steps) / 3600;
    hourHand.rotation.z = -TAU * (START + s.steps) / 43200;
    squeeze.userData.setLength(values.squeeze * FORCE_SCALE * MM);
    squeeze.position.set(0, (2.2 + values.squeeze * FORCE_SCALE) * MM, 0);
    needle.rotation.z = -Math.min(1, s.voltage / 30) * Math.PI / 2 + Math.PI / 4;

    const key = JSON.stringify({trim: values.trim});
    if (key !== chartKey) {
      chartKey = key;
      const array = curve.geometry.attributes.position.array;
      for (let i = 0; i <= 60; i++) array.set(clockChartPoint(i - 10, dailyRate(crystalFrequency(i - 10, values.trim))), i * 3);
      curve.geometry.attributes.position.needsUpdate = true;
      curve.geometry.computeBoundingSphere();
    }
    dot.position.set(...clockChartPoint(values.temperature, s.rate));

    const rateText = Math.abs(s.rate) < 0.0005 ? 'keeps perfect time' : `${s.rate > 0 ? 'gains' : 'loses'} ${fixed(Math.abs(s.rate), 3)} s a day`;
    return {
      state: s,
      readings: [
        r('Your result', `${rateText} · ${fixed(Math.abs(s.month), 2)} s ${s.rate >= 0 ? 'fast' : 'slow'} in a month`),
        r('Crystal', `${fixed(s.frequency, 4)} Hz`, `${fixed(s.ppm, 3)} parts per million from 32,768 Hz.`),
        r('Tuning fork', `tines ${fixed(s.tine * 1000, 2)} mm long`, `A ring would die away with a time constant of ${fixed(s.ringDown, 3)} s.`),
        r('Divider', `${s.steps} pulses so far`, 'After fifteen halvings the crystal’s ringing is one pulse a second.'),
        r('Stepping motor', `rotor at ${fixed((s.rotor % TAU) * 180 / Math.PI, 0)} degrees`, 'Half a turn each pulse.'),
        r('Battery', `${fixed(s.current * 1e6, 1)} µA on average`, `An AA cell lasts about ${fixed(s.life, 2)} years.`),
        r('Quartz plate', `${fixed(s.charge * 1e12, 2)} pC, ${fixed(s.voltage, 2)} V`, `From a squeeze of ${values.squeeze} N on a 1 cm square plate 1 mm thick, drawn with no leakage: a real plate’s voltage drains away once the squeeze stops changing.`),
      ],
    };
  });

  const render = result.update;
  // A minute of the clock's own time: sixty pulses of the divider, which a slow
  // crystal takes a few microseconds more than sixty real seconds to count.
  const clockMinute = () => { const v = result.getState().values; return 60 * QUARTZ.nominal / crystalFrequency(v.temperature, v.trim); };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) time = Math.min(clockMinute(), time + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { time = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the tuning fork', part: 'quartz', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the divider lamps', part: 'divider', view: 'front', replay: false, run() { time = 7.3; return render(); }},
    {label: 'Inspect: the stepping motor', part: 'motor', view: 'front', replay: false, run() { time = 3.5; return render(); }},
  ];
  result.playback = {
    label: 'Run a minute',
    description: 'One minute of the clock’s time, played in real time: sixty pulses, sixty steps of the seconds hand.',
    stepLabel: 'Advance a second',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => time >= clockMinute(),
    blocked: () => false,
  };

  root.rotation.set(0.1, -0.3, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, movement, battery, quartz, can, tines, plateGroup, squeeze, needle, divider, lamps, motor, rotor, dial, hourHand, minuteHand, secondsHand, chart, curve, dot, MM, START, L};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

export {createKineticWatchModel} from './kinetic-watch-model.js';

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject} from './scene-kit.js';
import {sampleClock, clockPlan, RODS, CARE, CLOCK, CLOCK_DEFAULTS as D, CLOCK_DOMAINS} from './pendulum-clock-physics.js';

// ---------------------------------------------------------------------------
// Pendulum clock: a wall regulator with its case and door cut away.
//
// Scale: one millimeter is 0.002 scene units for every length: the pendulum,
// the 3 kg lead weight, the escape wheel and the anchor.
//
// Time: real time. The pendulum swings at its true period, the escape wheel
// steps half a tooth at each beat, and the hands keep the clock's own time,
// which runs fast or slow by the ratio of the design period to the pendulum's.
// The swing is drawn at its true angle.
//
// The anchor's pallets are drawn to show which one holds the wheel; their
// working faces are not drawn to shape.
//
// Chart, beside the case: how much faster or slower the clock runs at each room
// temperature than at 20 degrees, for steel (gray), brass (gold) and invar
// (blue) rods, from 10 to 30 degrees across and 10 s a day either way up. The
// dot is this clock. Not to the clock's scale.
// ---------------------------------------------------------------------------

const MM = 0.002;
const TAU = Math.PI * 2;
const SUSPENSION = [0, 135, -30], ESCAPE = [0, 55, -8], ANCHOR = [0, 110, -8];
const START = 10 * 3600 + 8 * 60 + 30;
const LEAD = 11340, WEIGHT = {x: -120, radius: 25, top: -520, barrel: [-120, -40]};
const CHART = {left: 280, bottom: -560, width: 300, height: 260, spread: 10};
const ROD_COLORS = [0x7a8b83, 0xc9a227, 0x2f6690];
const DURATION = 60;

export const chartPoint = (temperature, change) => [(CHART.left + (temperature - 10) / 20 * CHART.width) * MM, (CHART.bottom + (Math.max(-CHART.spread, Math.min(CHART.spread, change)) / CHART.spread + 1) / 2 * CHART.height) * MM, 0];
/** Height of a lead cylinder of this mass and a 25 mm radius, in millimeters. */
export const weightHeight = mass => mass / (LEAD * Math.PI * (WEIGHT.radius / 1000) ** 2) * 1000;
/** The rate at a temperature less the rate at 20 degrees, for one rod. */
export const rateChange = (values, rod, temperature) => {
  const at = clockPlan({...values, rod, temperature}), base = clockPlan({...values, rod, temperature: 20});
  return at.running && base.running ? at.rate - base.rate : 0;
};

/** A 30-tooth escape wheel outline in millimeters: steep leading faces, sloping backs. */
export function escapeWheelShape(teeth = CLOCK.teeth, root = 22, tip = 28) {
  const shape = new THREE.Shape(), at = (radius, angle) => [radius * Math.sin(angle), radius * Math.cos(angle)];
  for (let i = 0; i < teeth; i++) {
    const a = TAU * i / teeth, c = TAU * (i + 1) / teeth;
    if (i === 0) shape.moveTo(...at(root, a));
    shape.lineTo(...at(tip, a + 0.12 * (c - a)));
    shape.lineTo(...at(root, a + 0.8 * (c - a)));
    shape.lineTo(...at(root, c));
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 3, 0, TAU, true);
  shape.holes.push(hole);
  return shape;
}

export function createPendulumClockModel() {
  const kit = houseModel('Mechanical clock'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Pendulum clock', 'A falling weight turns the wheels; the anchor escapement lets them move half a tooth at each swing and gives the pendulum a small push; the pendulum’s swing sets the pace. Drawn at true size.');

  const body = part('case', 'Case', 'A wooden wall case. Its sides and glass door are cut away.', [0, 0, 0], system);
  kit.box([380 * MM, 1500 * MM, 12 * MM], [0, -600 * MM, -90 * MM], 'wood', body);
  for (const side of [-1, 1]) covers.push(kit.box([12 * MM, 1500 * MM, 180 * MM], [side * 190 * MM, -600 * MM, 0], 'wood', body));
  const door = kit.box([380 * MM, 1500 * MM, 4 * MM], [0, -600 * MM, 90 * MM], 'blue', body);
  door.material = door.material.clone();
  door.material.transparent = true;
  door.material.opacity = 0.2;
  covers.push(door);

  const dial = part('dial', 'Dial and hands', 'An open chapter ring, so the escapement shows through. Hours and minutes come from the wheel train, and the seconds hand rides on the escape wheel’s arbor, which turns once a minute.', [0, 0, 0], system);
  const ring = surface(kit, new THREE.RingGeometry(90 * MM, 125 * MM, 72), 'cream', dial, true);
  ring.position.z = 33 * MM;
  for (let i = 0; i < 12; i++) { const mark = kit.box([4 * MM, 14 * MM, 2 * MM], [110 * Math.sin(TAU * i / 12) * MM, 110 * Math.cos(TAU * i / 12) * MM, 35 * MM], 'ink', dial); mark.rotation.z = -TAU * i / 12; }
  kit.ring(26 * MM, 1.2 * MM, [ESCAPE[0] * MM, ESCAPE[1] * MM, 35 * MM], 'ink', dial);
  const hand = (length, width, pivot, color) => { const group = new THREE.Group(); group.position.set(pivot[0] * MM, pivot[1] * MM, pivot[2] * MM); dial.add(group); kit.box([width * MM, length * MM, 2 * MM], [0, length / 2 * MM, 0], color, group); return group; };
  const hourHand = hand(65, 7, [0, 0, 38], 'ink'), minuteHand = hand(100, 4, [0, 0, 41], 'ink'), secondsHand = hand(22, 1.5, [ESCAPE[0], ESCAPE[1], 38], 'red');

  const train = part('train', 'Wheel train', 'The barrel, which the weight’s cord turns, drives the center wheel with the minute hand and the wheels up to the escape wheel. Drawn without teeth.', [0, 0, 0], system);
  for (const [x, y, radius] of [[WEIGHT.barrel[0], WEIGHT.barrel[1], 30], [0, 0, 40], [-45, 30, 26]]) kit.disk(radius * MM, 3 * MM, [x * MM, y * MM, -12 * MM], 'gold', train);

  const escapement = part('escapement', 'Anchor escapement', 'The escape wheel’s 30 teeth push on the anchor’s two pallets in turn. Each swing lets the wheel move half a tooth, and each tooth, sliding off a pallet, pushes the pendulum along. The crutch carries the anchor’s rocking down to the pendulum.', [0, 0, 0], system);
  const wheelGeometry = new THREE.ExtrudeGeometry(escapeWheelShape(), {depth: 2, bevelEnabled: false});
  wheelGeometry.scale(MM, MM, MM);
  const escapeWheel = surface(kit, wheelGeometry, 'gold', escapement);
  escapeWheel.position.set(ESCAPE[0] * MM, ESCAPE[1] * MM, ESCAPE[2] * MM);
  const anchor = new THREE.Group();
  anchor.position.set(ANCHOR[0] * MM, ANCHOR[1] * MM, (ANCHOR[2] + 3) * MM);
  escapement.add(anchor);
  const palletAt = side => [side * 28 * Math.sin(Math.PI / 4), ESCAPE[1] + 28 * Math.cos(Math.PI / 4) - ANCHOR[1]];
  for (const side of [-1, 1]) {
    const [x, y] = palletAt(side);
    kit.rod([0, 0, 0], [x * MM, y * MM, 0], 1.6 * MM, 'metal', anchor);
    const pallet = kit.box([5 * MM, 8 * MM, 3 * MM], [x * MM, (y - 2) * MM, 0], 'red', anchor);
    pallet.rotation.z = -side * Math.PI / 4;
  }
  kit.rod([0, 0, 0], [0, -95 * MM, -14 * MM], 1.2 * MM, 'metal', anchor);

  const pendulum = part('pendulum', 'Pendulum', 'A 1.5 kg bob on a rod about a meter long, hung from a thin spring, the rod colored by its metal as on the chart. Its length to the bob’s center sets the period; the rating nut under the bob moves it up or down.', [SUSPENSION[0] * MM, SUSPENSION[1] * MM, SUSPENSION[2] * MM], system);
  const rod = kit.cylinder(2.5 * MM, 1, [0, 0, 0], 'metal', pendulum);
  rod.material = rod.material.clone();
  const bob = kit.disk(60 * MM, 22 * MM, [0, 0, 0], 'gold', pendulum);
  const nut = kit.cylinder(7 * MM, 10 * MM, [0, 0, 0], 'ink', pendulum);

  const weight = part('weight', 'Driving weight', 'A lead weight on a cord wound round the barrel, drawn at its true size for its mass. It falls about 15 cm a day and gives the clock all its energy.', [0, 0, 0], system);
  const lead = kit.cylinder(WEIGHT.radius * MM, 1, [WEIGHT.x * MM, 0, -20 * MM], 'metal', weight);
  const cord = lineObject(2, 0x374736, weight);
  cord.geometry.attributes.position.array.set([WEIGHT.barrel[0] * MM, WEIGHT.barrel[1] * MM, -20 * MM, WEIGHT.x * MM, WEIGHT.top * MM, -20 * MM]);

  const chart = part('chart', 'Rate against temperature', 'How much faster or slower the clock runs than at 20 °C, from 10 to 30 °C across and 10 s a day either way up: steel in gray, brass in gold, invar in blue. The dot is this clock. Not to the clock’s scale.', [0, 0, 0], system);
  kit.rod(chartPoint(10, -CHART.spread), chartPoint(30, -CHART.spread), 0.8 * MM, 'ink', chart);
  kit.rod(chartPoint(10, -CHART.spread), chartPoint(10, CHART.spread), 0.8 * MM, 'ink', chart);
  kit.rod(chartPoint(10, 0), chartPoint(30, 0), 0.4 * MM, 'ink', chart);
  const lines = RODS.map((_, i) => lineObject(21, ROD_COLORS[i], chart));
  const marker = kit.sphere(6 * MM, [0, 0, 0], 'red', chart);

  const specs = {
    length: ['Pendulum length', 'mm', null, 'From the suspension to the bob’s center, set by the rating nut.'],
    rod: ['Pendulum rod', '', RODS.map(({value, label}) => ({value, label})), 'Metals grow as they warm, lengthening the pendulum.'],
    temperature: ['Room', '°C', null, 'The rod was cut for its length at 20 °C.'],
    weight: ['Driving weight', 'kg', null, 'More weight gives the pendulum a bigger push at each beat.'],
    care: ['Movement', '', CARE.map(({value, label}) => ({value, label})), 'Dirt and dry pivots waste more of the swing’s energy.'],
  };
  for (const [name, [min, max, step]] of Object.entries(CLOCK_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options);
  }

  let time = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleClock(values, time), L = values.length;
    pendulum.rotation.z = s.angle;
    rod.material.color.set(ROD_COLORS[values.rod]);
    rod.scale.set(1, L * MM, 1);
    rod.position.y = -L / 2 * MM;
    bob.position.y = -L * MM;
    nut.position.y = (-L - 24) * MM;
    anchor.rotation.z = s.angle;
    escapeWheel.rotation.z = -s.escape;
    secondsHand.rotation.z = -s.escape;
    const shown = START + s.clockSeconds;
    minuteHand.rotation.z = -TAU * shown / 3600;
    hourHand.rotation.z = -TAU * shown / 43200;
    const height = weightHeight(values.weight);
    lead.scale.y = height * MM;
    lead.position.y = (WEIGHT.top - height / 2) * MM;

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      lines.forEach((line, rodIndex) => {
        const array = line.geometry.attributes.position.array;
        for (let i = 0; i <= 20; i++) array.set(chartPoint(10 + i, rateChange(values, rodIndex, 10 + i)), i * 3);
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
      });
      marker.position.set(...chartPoint(values.temperature, rateChange(values, values.rod, values.temperature)));
    }

    const degrees = s.theta * 180 / Math.PI;
    const hms = seconds => { const whole = Math.floor(seconds); return `${Math.floor(whole / 3600) % 12 || 12}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`; };
    const rateText = s.rate === null ? 'stopped' : Math.abs(s.rate) < 0.005 ? 'keeps perfect time' : `${s.rate > 0 ? 'gains' : 'loses'} ${fixed(Math.abs(s.rate), 2)} s a day`;
    return {
      state: {...s, shown},
      readings: [
        r('Your result', s.running ? `Running · ${rateText}` : `Stopped · a swing of ${fixed(degrees, 2)} degrees cannot unlock the pallets`),
        r('Pendulum', `${fixed(L, 1)} mm, ${fixed(s.period, 5)} s there and back`, 'Each swing one way is one beat: the tick, then the tock.'),
        r('Swing', `${fixed(degrees, 2)} degrees each way`, s.running ? 'Where each beat’s push balances what the swing loses.' : 'Under the 1 degree the pallets need to let a tooth go.'),
        r('Rate', rateText, s.rate === null ? 'The weight hangs still.' : `${fixed(Math.abs(s.week), 1)} s ${s.rate >= 0 ? 'fast' : 'slow'} after a week.`),
        r('Rod', `${fixed(Math.abs(s.growth) * 1e6, 1)} µm ${s.growth >= 0 ? 'longer' : 'shorter'} than at 20 °C`, `${RODS[values.rod].label} grows ${fixed(RODS[values.rod].expansion * 1e6, 1)} millionths of its length a degree.`),
        r('Circular error', `${fixed((s.period / s.small - 1) * 1e6, 1)} parts per million slower than a tiny swing`, 'A wider swing takes a little longer.'),
        r('Dial', hms(shown), s.running ? `${s.beats} beats since the pendulum started.` : 'The hands have stopped.'),
        r('Energy', `${fixed(s.power * 1e6, 2)} µW reaches the pendulum; ${fixed(s.beatEnergy * 1e6, 2)} µJ a beat`, `The swing holds ${fixed(s.energy * 1000, 2)} mJ and loses 1 part in ${fixed(s.Q / (2 * Math.PI), 0)} of it each period.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) time = Math.min(DURATION, time + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { time = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the escapement', part: 'escapement', view: 'front', replay: false, run() { time = 0.25 * clockPlan(result.getState().values).period; return render(); }},
    {label: 'Inspect: the bob and rating nut', part: 'pendulum', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the rate chart', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Start the pendulum',
    description: 'One minute in real time: the pendulum beats once a second and the seconds hand goes once round.',
    stepLabel: 'Advance one beat',
    advance: result.advance,
    step: () => result.advance(clockPlan(result.getState().values).period / 2),
    complete: () => time >= DURATION,
    blocked: () => false,
  };

  root.rotation.set(0.08, -0.3, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, body, dial, hourHand, minuteHand, secondsHand, train, escapement, escapeWheel, anchor, pendulum, rod, bob, nut, weight, lead, cord, chart, lines, marker, MM, START, WEIGHT, DURATION, ESCAPE, ANCHOR, SUSPENSION};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

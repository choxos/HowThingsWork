import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject} from './scene-kit.js';
import {sampleSpin, spinPlan, shaking, omegaOf, SPIN, SPIN_DEFAULTS, SPIN_DOMAINS} from './spin-dryer-physics.js';

// ---------------------------------------------------------------------------
// Spin dryer: cabinet on springs, outer tub, perforated drum, laundry, motor
// and drain, with its front and side cut away.
//
// Scale: one millimeter is 0.004 scene units for every length, including the
// cabinet's shaking, drawn at its true amplitude.
//
// Time: the three-minute spin plays six times faster than real time. The drum
// is drawn turning once a second at 2,800 rpm and slower in proportion, not at
// its real speed; the cabinet is drawn swaying four times a second at
// its true amplitude, not at the drum's speed. The flying drops stand for water
// leaving the laundry and are more numerous the faster it leaves.
//
// Colors: the laundry goes from dark gray-blue, soaked, to cream, as dry as
// spinning can make it.
//
// Charts, beside the cabinet: the water left in the laundry over the spin, 0 to
// 185 s across and 0 to 160% up, with the level the speed allows in gray; and
// the cabinet's shaking against drum speed, 0 to 3,000 rpm across and 0 to 5
// mm up, with a dot for now. Not to the dryer's scale.
// ---------------------------------------------------------------------------

const MM = 0.004;
const TAU = Math.PI * 2;
const DRUM = {radius: SPIN.radius * 1000, height: 260, bottom: 200};
const LAYER = SPIN.layer * 1000;
const SPEED_UP = 6;
const DROPS = 48;
const WET = new THREE.Color(0x4f6272), DRY = new THREE.Color(0xf0dfaf);
const MOISTURE_CHART = {left: 470, bottom: 420, width: 240, height: 200};
const SHAKE_CHART = {left: 470, bottom: 120, width: 240, height: 200};
const JUG = {x: 330, radius: 90, height: 180};
const END = SPIN.duration + 5;

export const laundryColor = moisture => WET.clone().lerp(DRY, clamp01((SPIN.soaked - moisture) / (SPIN.soaked - SPIN.bound)));
const clamp01 = x => Math.max(0, Math.min(1, x));
export const moisturePoint = (t, moisture) => [(MOISTURE_CHART.left + t / END * MOISTURE_CHART.width) * MM, (MOISTURE_CHART.bottom + clamp01(moisture / 1.6) * MOISTURE_CHART.height) * MM, 0];
export const shakePoint = (rpm, amplitude) => [(SHAKE_CHART.left + rpm / 3000 * SHAKE_CHART.width) * MM, (SHAKE_CHART.bottom + clamp01(amplitude * 1000 / 5) * SHAKE_CHART.height) * MM, 0];
/** Drawn angle of the drum: a turn a second at 2,800 rpm, in proportion to its speed through the run-up. */
export const drawnDrumAngle = (rpm, time) => {
  const ramp = SPIN.ramp, t = Math.min(time, SPIN.duration), rate = TAU * rpm / 2800;
  return rate * (t <= ramp ? t * t / (2 * ramp) : ramp / 2 + (t - ramp));
};
export const swayAt = (amplitude, time) => amplitude * Math.sin(TAU * 4 * time);
/** Height of water in the jug, in millimeters, for this many kilograms. */
export const jugLevel = kilograms => kilograms / 1000 / (Math.PI * ((JUG.radius - 2) / 1000) ** 2) * 1000;

export function createSpinDryerModel() {
  const kit = houseModel('Spin dryer'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Spin dryer', 'A perforated drum spins wet laundry so fast that water is flung out through its holes. The drum hangs in a tub on springs, so an unbalanced load shakes the cabinet. Drawn at true size, front and side cut away.', [0, 0, 0]);

  const cabinet = part('cabinet', 'Cabinet', 'The steel case, 420 mm wide and 620 mm tall. It sways at its true amplitude when the load is unbalanced.', [0, 0, 0], system);
  const shell = new THREE.Group();
  cabinet.add(shell);
  kit.box([420 * MM, 20 * MM, 420 * MM], [0, 10 * MM, 0], 'cream', shell);
  kit.box([420 * MM, 620 * MM, 8 * MM], [0, 310 * MM, -206 * MM], 'cream', shell);
  kit.box([8 * MM, 620 * MM, 420 * MM], [-206 * MM, 310 * MM, 0], 'cream', shell);
  covers.push(kit.box([8 * MM, 620 * MM, 420 * MM], [206 * MM, 310 * MM, 0], 'cream', shell));
  covers.push(kit.box([420 * MM, 620 * MM, 8 * MM], [0, 310 * MM, 206 * MM], 'cream', shell));
  kit.box([420 * MM, 12 * MM, 420 * MM], [0, 626 * MM, 0], 'cream', shell);

  const springs = part('springs', 'Suspension springs', 'Four springs hold the tub and drum, 25 kg with the cabinet’s moving parts. They let the drum settle round its spinning load instead of shaking the floor.', [0, 0, 0], system);
  const coils = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => kit.spring([sx * 150 * MM, 20 * MM, sz * 150 * MM], 14 * MM, 150 * MM, 7, springs, 2.5 * MM));

  const tub = part('tub', 'Outer tub and drain', 'A plastic tub around the drum catches the flung water and runs it down the drain spout into the jug.', [0, 0, 0], system);
  const tubWall = kit.cylinder(185 * MM, 300 * MM, [0, (DRUM.bottom + 130) * MM, 0], 'blue', tub);
  tubWall.material = tubWall.material.clone();
  tubWall.material.transparent = true;
  tubWall.material.opacity = 0.2;
  tubWall.material.depthWrite = false;
  kit.rod([0, (DRUM.bottom - 20) * MM, 0], [JUG.x * MM, (JUG.height + 10) * MM, 0], 8 * MM, 'metal', tub);
  const jug = kit.cylinder(JUG.radius * MM, JUG.height * MM, [JUG.x * MM, JUG.height / 2 * MM, 0], 'blue', tub);
  jug.material = jug.material.clone();
  jug.material.transparent = true;
  jug.material.opacity = 0.25;
  jug.material.depthWrite = false;
  const collected = kit.cylinder((JUG.radius - 2) * MM, 1, [JUG.x * MM, 0, 0], 'blue', tub);

  const drum = part('drum', 'Perforated drum', 'A steel drum 300 mm across, pierced with holes. At 2,800 rpm its wall moves at 44 m/s, and the water feels over 1,300 times its weight.', [0, DRUM.bottom * MM, 0], system);
  const spinner = new THREE.Group();
  drum.add(spinner);
  const drumWall = kit.cylinder(DRUM.radius * MM, DRUM.height * MM, [0, DRUM.height / 2 * MM, 0], 'metal', spinner);
  drumWall.material = drumWall.material.clone();
  drumWall.material.transparent = true;
  drumWall.material.opacity = 0.3;
  drumWall.material.depthWrite = false;
  for (let row = 0; row < 6; row++) for (let i = 0; i < 18; i++) {
    const a = TAU * (i + row / 2) / 18;
    kit.sphere(4 * MM, [DRUM.radius * Math.sin(a) * MM, (30 + row * 40) * MM, DRUM.radius * Math.cos(a) * MM], 'ink', spinner);
  }
  kit.cylinder(20 * MM, 40 * MM, [0, -20 * MM, 0], 'ink', drum);

  const laundry = part('laundry', 'Laundry', 'Wet cotton pressed into a layer 40 mm thick against the drum wall. Its color shows how much water is left: dark when soaked, cream when spun as dry as the speed allows. The dark lump is the unbalanced part of the load.', [0, DRUM.bottom * MM, 0], system);
  const layerGeometry = new THREE.LatheGeometry([[DRUM.radius - LAYER, 10], [DRUM.radius - 2, 10], [DRUM.radius - 2, DRUM.height - 20], [DRUM.radius - LAYER, DRUM.height - 20], [DRUM.radius - LAYER, 10]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), 48);
  const layerMesh = kit.cylinder(1, 1, [0, 0, 0], 'cream', laundry);
  layerMesh.geometry.dispose();
  layerMesh.geometry = layerGeometry;
  layerMesh.material = layerMesh.material.clone();
  layerMesh.material.side = THREE.DoubleSide;
  const lumpHolder = new THREE.Group();
  laundry.add(lumpHolder);
  const lump = kit.sphere(1, [(DRUM.radius - 20) * MM, DRUM.height / 2 * MM, 0], 'ink', lumpHolder);

  const water = part('water', 'Flying water', 'Drops leaving the laundry through the drum’s holes, more of them the faster water leaves.', [0, DRUM.bottom * MM, 0], system);
  const drops = Array.from({length: DROPS}, (_, i) => { const drop = kit.sphere(3 * MM, [0, 0, 0], 'blue', water); drop.userData.angle = TAU * i / DROPS; drop.userData.height = 30 + (i * 37) % 200; return drop; });

  const motor = part('motor', 'Motor', 'Turns the drum through its shaft. Most of its work goes into stirring air and turning bearings: 150 W at full speed.', [0, 90 * MM, 0], system);
  kit.cylinder(60 * MM, 90 * MM, [0, 0, 0], 'gold', motor);
  kit.rod([0, 45 * MM, 0], [0, 110 * MM, 0], 10 * MM, 'metal', motor);

  const charts = part('charts', 'Charts', 'The water left in the laundry over the spin, and how much the cabinet shakes at each drum speed. Not to the dryer’s scale.', [0, 0, 0], system);
  const axis = (a, b) => kit.rod(a, b, 1 * MM, 'ink', charts);
  axis(moisturePoint(0, 0), moisturePoint(END, 0));
  axis(moisturePoint(0, 0), moisturePoint(0, 1.6));
  axis(shakePoint(0, 0), shakePoint(3000, 0));
  axis(shakePoint(0, 0), shakePoint(0, 0.005));
  const moistureLine = lineObject(Math.round(END / SPIN.every) + 1, 0x2f6690, charts), allowedLine = lineObject(Math.round(END / SPIN.every) + 1, 0x9aa7ad, charts);
  const shakeLine = lineObject(61, 0xc14f39, charts), moistureCursor = lineObject(2, 0x374736, charts), shakeDot = kit.sphere(6 * MM, [0, 0, 0], 'red', charts);

  const specs = {
    rpm: ['Drum speed', 'rpm', null, 'The top speed the drum reaches after its 20 s run-up.'],
    load: ['Laundry', 'kg dry', null, 'How much cotton, weighed dry. It starts soaked with 1.5 kg of water for each kilogram.'],
    imbalance: ['Unbalanced lump', 'kg', null, 'Wet laundry bunched on one side of the drum.'],
  };
  for (const [name, [min, max, step]] of Object.entries(SPIN_DOMAINS)) {
    const [label, unit, , help] = specs[name];
    control(name, label, min, max, step, SPIN_DEFAULTS[name], unit, help);
  }

  let clock = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleSpin(values, clock), fullRate = omegaOf(values.rpm);
    shell.position.x = swayAt(s.amplitude, clock) * 1000 * MM;
    spinner.rotation.y = drawnDrumAngle(values.rpm, clock);
    lumpHolder.rotation.y = spinner.rotation.y;
    lump.visible = values.imbalance > 0;
    lump.scale.setScalar(Math.max(1e-3, Math.cbrt(values.imbalance / 1000 * 3 / (4 * Math.PI)) * 1000) * MM);
    layerMesh.material.color.copy(laundryColor(s.moisture));
    const draining = Math.max(0, s.moisture - s.equilibriumNow), shown = Math.round(DROPS * clamp01(draining / 0.3));
    drops.forEach((drop, i) => {
      const travel = ((clock * 3 + i * 0.37) % 1), radius = DRUM.radius + travel * 30;
      drop.visible = i < shown && s.w > 0;
      drop.position.set(radius * Math.sin(drop.userData.angle + spinner.rotation.y) * MM, drop.userData.height * MM, radius * Math.cos(drop.userData.angle + spinner.rotation.y) * MM);
    });
    const removedNow = (SPIN.soaked - s.moisture) * values.load, level = Math.max(1e-3, Math.min(JUG.height - 2, jugLevel(removedNow)));
    collected.scale.y = level * MM;
    collected.position.y = (level / 2 + 1) * MM;

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      const moisture = moistureLine.geometry.attributes.position.array, allowed = allowedLine.geometry.attributes.position.array;
      s.samples.forEach((sample, i) => { moisture.set(moisturePoint(sample.t, sample.moisture), i * 3); allowed.set(moisturePoint(sample.t, sample.eq), i * 3); });
      for (const line of [moistureLine, allowedLine]) { line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere(); }
      const shake = shakeLine.geometry.attributes.position.array;
      for (let i = 0; i <= 60; i++) shake.set(shakePoint(i * 50, shaking(values.imbalance, omegaOf(i * 50)).amplitude), i * 3);
      shakeLine.geometry.attributes.position.needsUpdate = true;
      shakeLine.geometry.computeBoundingSphere();
    }
    moistureCursor.geometry.attributes.position.array.set([...moisturePoint(clock, 0), ...moisturePoint(clock, 1.6)]);
    moistureCursor.geometry.attributes.position.needsUpdate = true;
    shakeDot.position.set(...shakePoint(s.rpmNow, s.amplitude));

    const g = s.w * s.w * SPIN.radius / SPIN.g;
    const outcome = clock === 0 ? 'Ready · press Play to spin' : s.complete ? `Done · ${fixed(s.final * 100, 1)}% water left, ${fixed(s.removed, 3)} kg spun out` : `${fixed(s.rpmNow, 0)} rpm · laundry ${fixed(s.moisture * 100, 1)}% water`;
    return {
      state: {...s, removedNow, g},
      readings: [
        r('Your result', outcome),
        r('Drum', `${fixed(s.rpmNow, 0)} rpm, ${fixed(g, 0)} times gravity at the wall`, `Its wall moves at ${fixed(s.w * SPIN.radius, 1)} m/s.`),
        r('Pressing the water out', `${fixed(s.pressure / 1000, 1)} kPa at full speed`, `Pores wider than ${fixed(s.holding * 1e6, 2)} µm give up their water; narrower ones keep it.`),
        r('Laundry', `${fixed(s.moisture * 100, 1)}% water`, `Water for each kilogram of cotton. Spinning at ${values.rpm} rpm can bring it down to ${fixed(s.equilibrium * 100, 1)}%.`),
        r('Water spun out', `${fixed(removedNow, 3)} kg`),
        r('Shaking', `${fixed(s.amplitude * 1000, 2)} mm`, s.amplitude > 0 ? `The lump pulls with ${fixed(s.force, 0)} N. The cabinet’s own natural speed is ${fixed(s.natural * 60 / TAU, 0)} rpm; passing it on the way up, it shook ${fixed(s.peak.amplitude * 1000, 2)} mm.` : 'A balanced load does not shake the cabinet.'),
        r('Energy', `${fixed(s.energy / 1000, 1)} kJ used spinning`, `Evaporating the water it removes would take ${fixed(s.evaporationEnergy / 1e6, 2)} MJ.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(END, clock + dt * SPEED_UP); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; return render(result.defaults); };
  const resonance = () => { const plan = spinPlan(result.getState().values); return Math.min(SPIN.ramp, plan.natural / omegaOf(plan.values.rpm) * SPIN.ramp); };
  result.actions = [
    {label: 'Inspect: passing the shaking speed', part: 'cabinet', view: 'front', replay: false, run() { clock = resonance(); return render(); }},
    {label: 'Inspect: the drum at full speed', part: 'drum', view: 'front', replay: false, run() { clock = 40; return render(); }},
    {label: 'Inspect: the charts after the spin', part: 'charts', view: 'front', replay: false, run() { clock = END; return render(); }},
  ];
  result.playback = {
    label: 'Spin the laundry',
    description: 'A 20 s run-up, the spin, and the stop, six times faster than real time.',
    stepLabel: 'Advance ten seconds',
    advance: result.advance,
    step: () => result.advance(10 / SPEED_UP),
    complete: () => clock >= END,
    blocked: () => false,
  };

  root.rotation.set(0.25, -0.5, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {JUG, system, cabinet, shell, springs, coils, tub, collected, drum, spinner, laundry, layerMesh, lumpHolder, lump, water, drops, motor, charts, moistureLine, allowedLine, shakeLine, moistureCursor, shakeDot, MM, SPEED_UP, END, DROPS, DRUM};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

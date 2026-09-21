import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, surface} from './scene-kit.js';
import {sampleWasher, tumble, shake, omegaOf, DRUM, WASHER_DEFAULTS, WASHER_DOMAINS} from './washing-machine-physics.js';

// ---------------------------------------------------------------------------
// Washing machine: a front loader cut open, its tub hung on springs and
// dampers, the drum and its lifters, the laundry, the water, the heater and the
// drain pump, through one whole program, with its drum speed, temperature and
// shaking charted.
//
// Scale: one millimeter is 0.004 scene units for every length: the cabinet
// 600 mm wide and 850 mm tall, the tub 300 mm in radius, the drum 250 mm. The
// free water is drawn filling
// the bottom of the tub as a circular segment holding its volume, ignoring the
// drum and laundry it surrounds.
//
// Shaking: the tub, drum, laundry, water and heater hang together and sway
// sideways at their true amplitude, a few millimeters, lagging the drawn drum as
// the physics says; the shaking chart shows it better.
//
// Time: the program plays sixty times faster than real time. The drum is drawn
// turning at its true speed up to 120 rpm and at 120 rpm above that, so the
// spin does not blur; the tumbling laundry is drawn at its true pace, carried
// up the wall and falling along the path it really takes.
//
// Colors: the heater glows red while it heats.
//
// Charts, beside the cabinet, not to its scale: drum speed over the program
// (red), 0 to 1,400 rpm up, and water temperature (gold), 10 to 70 °C up, with a
// line for now; and the tub's shaking against drum speed for this load's
// unbalance at steady speeds (blue), 0 to 1,400 rpm across and 0 to 10 mm up,
// with a dot for the tub's largest swing in the latest second, which rides above
// the curve while the drum runs up through the tub's natural speed.
// ---------------------------------------------------------------------------

const MM = 0.004;
const TAU = Math.PI * 2;
const SPEED_UP = 60;
const CLUMPS = 8, SPRING_X = 250, DAMPER_X = 180;
export const DRAWN_CAP = 120;
export const CABINET = Object.freeze({width: 600, height: 850, depth: 600});
export const TUB = Object.freeze({radius: 300, depth: 400, x: 0, y: 450, z: -20});
export const TIME_CHART = Object.freeze({left: 380, bottom: 520, width: 320, height: 200, rpm: 1400, low: 10, high: 70});
export const SHAKE_CHART = Object.freeze({left: 380, bottom: 170, width: 320, height: 200, rpm: 1400, mm: 10});
const HEATER_COLD = new THREE.Color(0xb4c5b0), HEATER_HOT = new THREE.Color(0xc14f39);
const scaled = point => point.map(v => v * MM);
const clamp01 = x => Math.max(0, Math.min(1, x));

/** Depth of free water in the tub, in millimeters, from the circular segment its volume fills. */
export function waterDepth(liters) {
  const r = TUB.radius / 1000, area = liters / 1000 / (TUB.depth / 1000);
  if (area <= 0) return 0;
  let lo = 0, hi = 2 * r;
  for (let i = 0; i < 60; i++) {
    const h = (lo + hi) / 2, segment = r * r * Math.acos((r - h) / r) - (r - h) * Math.sqrt(Math.max(0, 2 * r * h - h * h));
    if (segment < area) lo = h; else hi = h;
  }
  return (lo + hi) / 2 * 1000;
}
export const timePoint = (seconds, value, low, high, duration) => [(TIME_CHART.left + seconds / duration * TIME_CHART.width) * MM, (TIME_CHART.bottom + clamp01((value - low) / (high - low)) * TIME_CHART.height) * MM, 0];
export const shakePoint = (rpm, amplitude) => [(SHAKE_CHART.left + rpm / SHAKE_CHART.rpm * SHAKE_CHART.width) * MM, (SHAKE_CHART.bottom + clamp01(amplitude * 1000 / SHAKE_CHART.mm) * SHAKE_CHART.height) * MM, 0];
/** The drum's drawn angle after each program second: its true speed capped at 120 rpm, slowed with the playback. */
export function drawnAngles(samples) {
  const angles = new Float64Array(samples.length + 1);
  for (let i = 0; i < samples.length; i++) angles[i + 1] = angles[i] + omegaOf(Math.min(DRAWN_CAP, samples[i].rpm)) / SPEED_UP;
  return angles;
}
export const clumpRadius = load => 55 * Math.cbrt(load / 5);

/**
 * Where clump i of the laundry is drawn, in millimeters from the drum's axis:
 * resting at the bottom when the drum is still, pinned and turning with it
 * above the critical speed, and otherwise carried up and falling freely along
 * its true path, at its true pace in playback seconds.
 */
export function clumpPlace(i, rpm, playSeconds, angle, load) {
  const R = DRUM.radius, inner = (DRUM.radius * 1000 - clumpRadius(load)) / (DRUM.radius * 1000);
  if (rpm <= 0) { const phi = (i - (CLUMPS - 1) / 2) * 0.16; return [inner * R * Math.sin(phi) * 1000, -inner * R * Math.cos(phi) * 1000]; }
  const path = tumble(rpm);
  if (path.pinned) { const phi = angle + i * TAU / CLUMPS; return [inner * R * Math.sin(phi) * 1000, -inner * R * Math.cos(phi) * 1000]; }
  const w = omegaOf(rpm), cycle = path.carry + path.flight, u = ((playSeconds + i * cycle / CLUMPS) % cycle + cycle) % cycle;
  if (u < path.carry) { const phi = path.landing + w * u; return [inner * R * Math.sin(phi) * 1000, -inner * R * Math.cos(phi) * 1000]; }
  const s = u - path.carry, x = R * Math.sin(path.release) + w * R * Math.cos(path.release) * s, y = -R * Math.cos(path.release) + w * R * Math.sin(path.release) * s - DRUM.g * s * s / 2;
  return [inner * x * 1000, inner * y * 1000];
}

export function createWashingMachineModel() {
  const kit = houseModel('Washing machine'), {root, part, control, finish, covers} = kit;
  const box = (size, center, color, parent) => kit.box(size.map(v => v * MM), scaled(center), color, parent);
  const system = part('system', 'Washing machine', 'A front loader: a drum that tumbles the laundry through warm water, spins it to press the water out, and rinses the detergent away, hung in a heavy tub on springs. Drawn at true size, cut open.', [0, 0, 0]);

  const cabinet = part('cabinet', 'Cabinet and door', 'The steel case, 600 mm wide and 850 mm tall, with the round door through which the drum is loaded.', [0, 0, 0], system);
  box([600, 10, 600], [0, 5, 0], 'cream', cabinet);
  box([600, 10, 600], [0, 845, 0], 'cream', cabinet);
  box([10, 850, 600], [-295, 425, 0], 'cream', cabinet);
  box([10, 850, 600], [295, 425, 0], 'cream', cabinet);
  box([600, 850, 10], [0, 425, -295], 'cream', cabinet);
  covers.push(box([600, 850, 10], [0, 425, 295], 'cream', cabinet));
  const door = kit.ring(230 * MM, 22 * MM, scaled([TUB.x, TUB.y, 310]), 'metal', cabinet);
  covers.push(door);

  const tubPart = part('tub', 'Tub, counterweight and suspension', 'The stationary outer tub, 300 mm in radius, that holds the water, weighted with concrete to 40 kg and hung from two springs with two dampers below. It shakes as the unbalanced load spins.', [0, 0, 0], system);
  const tub = new THREE.Group();
  tubPart.add(tub);
  const tubShell = kit.cylinder(TUB.radius * MM, TUB.depth * MM, [0, 0, 0], 'metal', tub);
  tubShell.rotation.x = Math.PI / 2;
  tubShell.position.set(...scaled([TUB.x, TUB.y, TUB.z]));
  tubShell.material = tubShell.material.clone();
  tubShell.material.transparent = true;
  tubShell.material.opacity = 0.2;
  tubShell.material.depthWrite = false;
  box([420, 70, 220], [0, TUB.y + TUB.radius + 40, TUB.z], 'ink', tub);
  const motor = kit.cylinder(150 * MM, 60 * MM, [0, 0, 0], 'gold', tub);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(...scaled([TUB.x, TUB.y, TUB.z - TUB.depth / 2 - 30]));
  const springTop = TUB.y + Math.sqrt(TUB.radius ** 2 - SPRING_X ** 2), damperTop = TUB.y - Math.sqrt(TUB.radius ** 2 - DAMPER_X ** 2);
  const springs = [-1, 1].map(side => kit.spring(scaled([side * SPRING_X, springTop, TUB.z]), 20 * MM, (CABINET.height - 10 - springTop) * MM, 8, tubPart, 3 * MM));
  const dampers = [-1, 1].map(side => kit.rod(scaled([side * DAMPER_X, damperTop, TUB.z]), scaled([side * (DAMPER_X + 60), 10, TUB.z]), 12 * MM, 'ink', tubPart));

  const drumPart = part('drum', 'Drum and lifters', 'The perforated steel drum, 250 mm in radius, with three lifters that carry the laundry up the wall. Its holes let water in and out.', [0, 0, 0], system);
  const drum = new THREE.Group();
  drum.position.set(...scaled([TUB.x, TUB.y, TUB.z]));
  drumPart.add(drum);
  const drumShell = kit.cylinder(DRUM.radius * 1000 * MM, DRUM.depth * 1000 * MM, [0, 0, 0], 'metal', drum);
  drumShell.rotation.x = Math.PI / 2;
  drumShell.material = drumShell.material.clone();
  drumShell.material.transparent = true;
  drumShell.material.opacity = 0.25;
  drumShell.material.depthWrite = false;
  const lifters = [0, 1, 2].map(k => {
    const angle = k * TAU / 3, lifter = box([40, 40, 280], [0, 0, 0], 'gold', drum);
    lifter.position.set(...scaled([(DRUM.radius * 1000 - 20) * Math.sin(angle), -(DRUM.radius * 1000 - 20) * Math.cos(angle), 0]));
    lifter.rotation.z = angle;
    return lifter;
  });
  for (const z of [-90, 0, 90]) for (let k = 0; k < 16; k++) { const angle = (k + (z === 0 ? 0.5 : 0)) * TAU / 16 + 0.13; kit.sphere(5 * MM, scaled([DRUM.radius * 1000 * Math.sin(angle), -DRUM.radius * 1000 * Math.cos(angle), z]), 'ink', drum); }

  const laundryPart = part('laundry', 'Laundry', 'Clumps of wet laundry: carried up the wall by the lifters and dropped through the water while the drum turns slowly, pinned to the wall once it turns fast.', [0, 0, 0], system);
  const clumps = Array.from({length: CLUMPS}, (_, i) => kit.sphere(MM, [0, 0, 0], i % 2 ? 'blue' : 'clay', laundryPart));

  const waterPart = part('water', 'Water', 'The free water in the bottom of the tub, filling a circular segment as deep as its volume needs.', [0, 0, 0], system);
  const pool = surface(kit, new THREE.BufferGeometry(), 'blue', waterPart);
  pool.material = pool.material.clone();
  pool.material.transparent = true;
  pool.material.opacity = 0.55;
  pool.material.depthWrite = false;

  const heaterPart = part('heater', 'Heater', 'A 2 kW element under the drum that warms the water; it glows here while it heats.', [0, 0, 0], system);
  const heater = kit.tube([[-150, TUB.y - 270, TUB.z + 150], [-150, TUB.y - 270, TUB.z - 150], [150, TUB.y - 270, TUB.z - 150], [150, TUB.y - 270, TUB.z + 150]].map(scaled), 6 * MM, 'metal', heaterPart);
  heater.material = heater.material.clone();

  const pumpPart = part('pump', 'Drain pump', 'Pumps the water out of the tub to the drain while it drains and spins.', scaled([200, 60, 150]), system);
  const impeller = new THREE.Group();
  pumpPart.add(impeller);
  for (let k = 0; k < 4; k++) { const blade = box([70, 8, 10], [0, 0, 0], 'gold', impeller); blade.rotation.z = k * Math.PI / 4; }
  kit.ring(45 * MM, 5 * MM, [0, 0, 0], 'clay', pumpPart);

  const charts = part('charts', 'Charts', 'Drum speed and water temperature over the program, and the steady shaking against drum speed with a dot for the tub’s swing now. Not to the machine’s scale.', [0, 0, 0], system);
  const axis = (a, b) => kit.rod(a, b, 1.2 * MM, 'ink', charts);
  axis(scaled([TIME_CHART.left, TIME_CHART.bottom, 0]), scaled([TIME_CHART.left + TIME_CHART.width, TIME_CHART.bottom, 0]));
  axis(scaled([TIME_CHART.left, TIME_CHART.bottom, 0]), scaled([TIME_CHART.left, TIME_CHART.bottom + TIME_CHART.height, 0]));
  axis(scaled([SHAKE_CHART.left, SHAKE_CHART.bottom, 0]), scaled([SHAKE_CHART.left + SHAKE_CHART.width, SHAKE_CHART.bottom, 0]));
  axis(scaled([SHAKE_CHART.left, SHAKE_CHART.bottom, 0]), scaled([SHAKE_CHART.left, SHAKE_CHART.bottom + SHAKE_CHART.height, 0]));
  const rpmLine = lineObject(5000, 0xc14f39, charts), temperatureLine = lineObject(5000, 0xe3b45e, charts), cursor = lineObject(2, 0x374736, charts);
  const shakeLine = lineObject(141, 0x2f6690, charts), shakeDot = kit.sphere(6 * MM, [0, 0, 0], 'red', charts);

  const specs = {
    temperature: ['Temperature', '°C', 'How warm the heater makes the wash; 15 °C is the cold supply.'],
    spin: ['Spin speed', 'rpm', 'The final spin’s top speed.'],
    rinses: ['Rinses', '', 'How many times fresh water dilutes the detergent.'],
    load: ['Laundry', 'kg dry', 'How much laundry, weighed dry.'],
    imbalance: ['Unbalanced lump', 'kg', 'Laundry bunched on one side of the drum.'],
  };
  for (const [key, [min, max, step]] of Object.entries(WASHER_DOMAINS)) {
    const [label, unit, help] = specs[key];
    control(key, label, min, max, step, WASHER_DEFAULTS[key], unit, help);
  }

  let clock = 0, lastClock = 0, disposed = false, chartKey = '', poolKey = '', angles = null;
  const result = finish(values => {
    const s = sampleWasher(values, clock), now = s.now, index = Math.max(0, Math.round(s.clock));
    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      angles = drawnAngles(s.samples);
      const rpms = rpmLine.geometry.attributes.position.array, temps = temperatureLine.geometry.attributes.position.array, count = Math.min(5000, s.samples.length);
      for (let i = 0; i < count; i++) {
        const sample = s.samples[Math.floor(i * s.samples.length / count)];
        rpms.set(timePoint(sample.t, sample.rpm, 0, TIME_CHART.rpm, s.duration), i * 3);
        temps.set(timePoint(sample.t, sample.T, TIME_CHART.low, TIME_CHART.high, s.duration), i * 3);
      }
      for (const line of [rpmLine, temperatureLine]) { line.geometry.setDrawRange(0, count); line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere(); }
      const response = shakeLine.geometry.attributes.position.array;
      for (let i = 0; i <= 140; i++) response.set(shakePoint(i * 10, shake(s.values.imbalance, omegaOf(i * 10)).amplitude), i * 3);
      shakeLine.geometry.attributes.position.needsUpdate = true;
      shakeLine.geometry.computeBoundingSphere();
    }
    const angle = angles[Math.min(angles.length - 1, index)];
    drum.rotation.z = angle;
    const sway = now.amplitude * Math.sin(angle - shake(s.values.imbalance, omegaOf(now.rpm)).phase) * 1000 * MM;
    for (const group of [tub, drumPart, laundryPart, waterPart, heaterPart]) group.position.x = sway;
    const load = s.values.load, radius = clumpRadius(load);
    clumps.forEach((clump, i) => {
      const [x, y] = clumpPlace(i, now.rpm, clock / SPEED_UP, angle, load);
      clump.position.set((TUB.x + x) * MM, (TUB.y + y) * MM, (TUB.z + (i % 3 - 1) * 70) * MM);
      clump.scale.setScalar(radius);
    });
    const depth = waterDepth(now.water), shape = depth.toFixed(1);
    if (shape !== poolKey) {
      poolKey = shape;
      pool.geometry.dispose();
      if (depth > 0.05) {
        const rr = TUB.radius, half = Math.acos((rr - depth) / rr), outline = new THREE.Shape();
        for (let k = 0; k <= 32; k++) { const phi = -half + 2 * half * k / 32; outline[k ? 'lineTo' : 'moveTo'](rr * Math.sin(phi) * MM, -rr * Math.cos(phi) * MM); }
        outline.closePath();
        pool.geometry = new THREE.ExtrudeGeometry(outline, {depth: TUB.depth * MM, bevelEnabled: false});
        pool.geometry.translate(TUB.x * MM, TUB.y * MM, (TUB.z - TUB.depth / 2) * MM);
      } else pool.geometry = new THREE.BufferGeometry();
    }
    const heating = now.stage === 'Heating';
    heater.material.color.copy(heating ? HEATER_HOT : HEATER_COLD);
    const pumping = /drain|spin/i.test(now.stage);
    impeller.rotation.z = pumping ? -TAU * 3 * (clock / SPEED_UP) : 0;
    cursor.geometry.attributes.position.array.set([...timePoint(s.clock, 0, 0, 1, s.duration), ...timePoint(s.clock, 1, 0, 1, s.duration)]);
    cursor.geometry.attributes.position.needsUpdate = true;
    shakeDot.position.set(...shakePoint(now.rpm, now.amplitude));

    const g = omegaOf(now.rpm) ** 2 * DRUM.radius / DRUM.g, path = tumble(Math.max(now.rpm, 1e-9));
    const drumHint = now.rpm <= 0 ? 'The drum is still.'
      : !path.pinned ? `Below ${fixed(s.critical, 1)} rpm the laundry tumbles: it leaves the wall ${fixed(180 - path.release * 180 / Math.PI, 1)}° before the top and drops ${fixed(path.drop * 1000, 0)} mm.`
      : 'Faster than the laundry can fall: it is pinned to the wall while water is pressed out through the holes.';
    return {
      state: {...s, heating, pumping, depth},
      readings: [
        r('Your result', clock === 0 ? `Ready · ${fixed(s.duration / 60, 1)} min program; press Play to run it` : `${now.stage} · ${fixed(s.clock / 60, 1)} of ${fixed(s.duration / 60, 1)} min`),
        r('Drum', `${fixed(now.rpm, 0)} rpm, ${fixed(g, g < 10 ? 2 : 0)} g at the wall`, drumHint),
        r('Water', `${fixed(now.water, 1)} L free in the tub at ${fixed(now.T, 1)} °C`, `${fixed(now.liquid, 1)} L in the tub and the laundry; ${fixed(now.used, 1)} L used so far.`),
        r('Detergent', `${fixed(now.concentration, 2)} g/L`, `${fixed(now.detergentInLaundry, 2)} g held in the laundry’s water.`),
        r('Laundry', `${fixed(now.moisture * 100, 1)}% water`, 'Water for each kilogram of dry laundry.'),
        r('Shaking', `${fixed(now.amplitude * 1000, 2)} mm, ${fixed(now.floor, 1)} N on the floor`, s.held ? 'Over 0.4 kg off balance: every spin is held to 600 rpm.' : `The tub’s natural speed is ${fixed(shake(0, 0).natural * 60 / TAU, 0)} rpm; far above it the springs pass on little force.`),
        r('Energy', `${fixed(now.energy / 3.6e6, 3)} kWh`, `${fixed(now.heaterEnergy / 3.6e6, 3)} kWh of it in the heater.`),
      ],
    };
  });

  const render = result.update;
  const stageTime = (name, offset) => { const stage = result.getState().stages.find(item => item.stage === name); return stage ? Math.min(stage.end, stage.start + offset) : 0; };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(result.getState().duration, clock + dt * SPEED_UP); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the tumbling laundry', part: 'laundry', view: 'front', replay: false, run() { clock = stageTime('Washing', 120); return render(); }},
    {label: 'Inspect: the heater', part: 'heater', view: 'front', replay: false, run() { clock = stageTime('Heating', 60); return render(); }},
    {label: 'Inspect: the final spin', part: 'tub', view: 'front', replay: false, run() { clock = stageTime('Final spin', 200); return render(); }},
    {label: 'Inspect: the charts', part: 'charts', view: 'front', replay: false, run() { clock = result.getState().duration; return render(); }},
  ];
  result.playback = {
    label: 'Start the program',
    description: 'The whole program, sixty times faster than real time.',
    stepLabel: 'Advance five minutes',
    advance: result.advance,
    step: () => result.advance(300 / SPEED_UP),
    complete: () => clock >= result.getState().duration,
    blocked: () => false,
  };

  root.rotation.set(0.1, -0.35, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {sway: () => tub.position.x, SPRING_X, DAMPER_X, system, cabinet, door, tubPart, tub, tubShell, motor, springs, dampers, drumPart, drum, drumShell, lifters, laundryPart, clumps, waterPart, pool, heaterPart, heater, pumpPart, impeller, charts, rpmLine, temperatureLine, cursor, shakeLine, shakeDot, MM, SPEED_UP, CLUMPS};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

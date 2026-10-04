import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {washerPlan, sampleWasher, tumble, shake, omegaOf, DRUM, WASHER_DEFAULTS, WASHER_DOMAINS} from './washing-machine-physics.js';
import {WASHER_PLAYBACK_RATE, WASHER_DRAWN_CAP} from './washing-machine-motion.js';
import {washerGeometry, moveWasherAssembly, showWasherFlow, MM, CABINET, TUB} from './washing-machine-geometry.js';
export {CABINET, TUB};
export const DRAWN_CAP = WASHER_DRAWN_CAP;
const TAU = Math.PI * 2, SPEED_UP = WASHER_PLAYBACK_RATE;
const point = p => p.map(v => v * MM), clamp01 = n => Math.max(0, Math.min(1, n));

export function waterDepth(liters) {
  if (!Number.isFinite(liters) || liters < 0) throw new RangeError('Water volume must be finite and nonnegative.');
  const radius = TUB.radius / 1000, area = liters / 1000 / (TUB.depth / 1000);
  if (area === 0) return 0;
  if (area > Math.PI * radius * radius) throw new RangeError('Water exceeds tub capacity.');
  let lo = 0, hi = 2 * radius;
  for (let i = 0; i < 60; i++) {
    const depth = (lo + hi) / 2, segment = radius * radius * Math.acos((radius - depth) / radius) - (radius - depth) * Math.sqrt(Math.max(0, 2 * radius * depth - depth * depth));
    if (segment < area) lo = depth; else hi = depth;
  }
  return (lo + hi) * 500;
}
export const clumpRadius = load => 30 * Math.cbrt(load / 5);

// During steady washing, a cloth marker follows exact ballistic free fall
// at its center radius. Ramps blend this path into resting or pinned poses;
// those transitions are explanatory animation, not a cloth simulation.
export function clumpPlace(i, rpm, angle, load, count = 8, markerRadius = clumpRadius(load)) {
  const radius = (250 - markerRadius) / 1000, path = tumble(DRUM.wash, radius), w = omegaOf(DRUM.wash);
  const cycle = path.carry + path.flight, time = angle / w;
  const u = ((time + i * cycle / count) % cycle + cycle) % cycle;
  let x, y;
  if (u < path.carry) {const phi = path.landing + w * u; x = radius * Math.sin(phi); y = -radius * Math.cos(phi);}
  else {const t = u - path.carry; x = radius * Math.sin(path.release) + w * radius * Math.cos(path.release) * t; y = -radius * Math.cos(path.release) + w * radius * Math.sin(path.release) * t - DRUM.g * t * t / 2;}
  const resting = (i - (count - 1) / 2) * 0.2, washShare = clamp01(rpm / DRUM.wash);
  x = radius * Math.sin(resting) * (1 - washShare) + x * washShare;
  y = -radius * Math.cos(resting) * (1 - washShare) + y * washShare;
  const pinShare = clamp01((rpm - DRUM.wash) / (Math.sqrt(DRUM.g / radius) * 60 / TAU - DRUM.wash)), phi = angle + i * TAU / count;
  return [(x * (1 - pinShare) + radius * Math.sin(phi) * pinShare) * 1000, (y * (1 - pinShare) - radius * Math.cos(phi) * pinShare) * 1000];
}

function chartsGeometry(kit, system) {
  const charts = kit.part('charts', 'Program and suspension charts', 'Separate close-up charts show the program and vibration response.', [7, 0, 0], system);
  charts.userData.explosionExcluded = true;
  const program = kit.part('program-chart', 'Program speed and temperature', 'The full program includes filling, heating, washing, draining, every spin, braking and settling.', [0, 2.5, 0], charts);
  const vibration = kit.part('shake-chart', 'Suspension response', 'Blue is steady displacement amplitude. The red marker pairs current speed with the recent one-second peak, including acceleration and braking transients.', [0, -1.3, 0], charts);
  const coord = (x, y) => [-1.7 + x * 3.4, -0.9 + y * 2.1, 0];
  for (const parent of [program, vibration]) {
    kit.box([4.5, 3.2, 0.03], [0, 0.15, -0.05], 'cream', parent);
    kit.rod(coord(0, 0), coord(1, 0), 0.008, 'ink', parent); kit.rod(coord(0, 0), coord(0, 1), 0.008, 'ink', parent);
  }
  chartText(program, coord, {title: 'The complete program', size: 0.28, x: {min: 0, max: 1, title: 'Program time · minutes', ticks: [[0, '0']]}, y: {min: 0, max: 1, title: 'Drum speed · rpm', ticks: [[0, '0'], [0.5, '700'], [1, '1,400']]}, legend: [['Speed', 0xc14f39], ['Temperature', 0xb8862f]], legendAt: [0.95, 0.97]});
  for (const temperature of [10, 40, 70]) textLabel(program, `${temperature} °C`, {height: 0.26, align: 'left', color: '#8f691e', position: [1.78, -0.9 + (temperature - 10) / 60 * 2.1, 0.02]});
  const endText = textLabel(program, '', {height: 0.26, width: 0.8, position: [1.7, -1.08, 0.03]});
  const midText = textLabel(program, '', {height: 0.26, width: 0.8, position: [0, -1.08, 0.03]});
  chartText(vibration, coord, {title: 'Why the tub shakes', size: 0.28, x: {min: 0, max: 1, title: 'Drum speed · rpm', ticks: [[0, '0'], [0.5, '700'], [1, '1,400']]}, y: {min: 0, max: 1, title: 'Peak tub swing · mm', ticks: [[0, '0'], [0.5, '6'], [1, '12']]}, legend: [['Steady swing', 0x2f6690], ['Recent peak', 0xc14f39]], legendAt: [0.95, 0.95]});
  const rpmLine = lineObject(8000, 0xc14f39, program), temperatureLine = lineObject(8000, 0xb8862f, program), cursor = lineObject(2, 0x374736, program);
  const shakeLine = lineObject(141, 0x2f6690, vibration), shakeDot = kit.sphere(0.035, [0, 0, 0], 'red', vibration);
  return {charts, program, vibration, coord, endText, midText, rpmLine, temperatureLine, cursor, shakeLine, shakeDot};
}

export function createWashingMachineModel() {
  const kit = houseModel('Washing machine'), {root, part, control, finish} = kit;
  const system = part('system', 'Washing machine and measurements', 'Follow a complete illustrative front-loader program, then inspect each connected mechanism.');
  const hardware = washerGeometry(kit, system), chart = chartsGeometry(kit, system);
  const specs = {
    temperature: ['Wash temperature', '°C', '15 °C selects an unheated wash with a 15 °C supply; the room starts at 20 °C.'],
    spin: ['Requested final spin', 'rpm', 'Higher spin removes more pore water. A large selected imbalance limits the achieved speed.'],
    rinses: ['Fresh-water rinses', '', 'Additional rinses dilute more retained detergent and use more water.'],
    load: ['Dry laundry mass', 'kg', 'A larger load needs more assigned fill water and heat.'],
    imbalance: ['Excess load on one side', 'kg', 'The gold cloth marker shows imbalance. Above 0.4 kg this teaching controller limits every spin to 600 rpm.'],
  };
  for (const [key, [min, max, step]] of Object.entries(WASHER_DOMAINS)) {
    const [label, unit, help] = specs[key]; control(key, label, min, max, step, WASHER_DEFAULTS[key], unit, help, undefined, {primary: ['temperature', 'spin'].includes(key)});
  }
  let clock = 0, lastClock = 0, key = '', restoring = false, disposed = false, poolKey = '';
  const dryColors = hardware.clumps.map((group, i) => new THREE.Color(i % 2 ? 0xce825f : 0xf0dfaf)), wetColor = new THREE.Color(0x719ca7);
  const result = finish(values => {
    const next = JSON.stringify(values);
    if (next !== key) {
      if (!restoring) clock = 0;
      key = next;
      const plan = washerPlan(values), count = Math.min(8000, plan.samples.length);
      chart.endText.userData.setText(fixed(plan.duration / 60, 1)); chart.midText.userData.setText(fixed(plan.duration / 120, 1));
      for (let i = 0; i < count; i++) {
        const s = plan.samples[Math.round(i * (plan.samples.length - 1) / (count - 1))];
        chart.rpmLine.geometry.attributes.position.array.set(chart.coord(s.t / plan.duration, s.rpm / 1400), i * 3);
        chart.temperatureLine.geometry.attributes.position.array.set(chart.coord(s.t / plan.duration, (s.T - 10) / 60), i * 3);
      }
      for (const line of [chart.rpmLine, chart.temperatureLine]) {line.geometry.setDrawRange(0, count); line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();}
      for (let i = 0; i <= 140; i++) chart.shakeLine.geometry.attributes.position.array.set(chart.coord(i / 140, shake(values.imbalance, omegaOf(i * 10)).amplitude / 0.012), i * 3);
      chart.shakeLine.geometry.attributes.position.needsUpdate = true; chart.shakeLine.geometry.computeBoundingSphere();
    }
    const s = sampleWasher(values, clock), now = s.now; clock = s.clock;
    const phase = shake(values.imbalance, omegaOf(now.rpm)).phase;
    const swayMm = now.amplitude * Math.sin(now.drawnAngle - phase) * 1000;
    moveWasherAssembly(hardware, swayMm);
    hardware.drum.rotation.z = hardware.rotor.rotation.z = now.drawnAngle;
    const radius = clumpRadius(values.load);
    hardware.clumps.forEach((group, i) => {
      const [x, y] = clumpPlace(i, now.rpm, now.drawnAngle, values.load);
      group.position.set(...point([x, TUB.y + y, TUB.z + (i % 3 - 1) * 80])); group.scale.setScalar(radius / 30);
      group.rotation.z = now.rpm > 65 ? now.drawnAngle + i * TAU / 8 : Math.sin(now.drawnAngle + i) * 0.35;
      group.userData.fabric.material.color.copy(dryColors[i]).lerp(wetColor, clamp01(now.moisture / 1.5) * 0.7);
    });
    const lumpScale = values.imbalance > 0 ? Math.cbrt(values.imbalance / 0.3) : 0.001;
    const [lumpX, lumpY] = clumpPlace(0, now.rpm, now.drawnAngle, values.load, 1, 30 * lumpScale);
    hardware.lump.position.set(...point([lumpX, TUB.y + lumpY, TUB.z + 112])); hardware.lump.scale.setScalar(lumpScale); hardware.lump.visible = values.imbalance > 0;
    hardware.lump.rotation.z = now.rpm > 65 ? now.drawnAngle : 0;
    const depth = waterDepth(now.water), shape = depth.toFixed(1);
    if (shape !== poolKey) {
      poolKey = shape; hardware.pool.geometry.dispose();
      if (depth > 0.05) {
        const half = Math.acos((TUB.radius - depth) / TUB.radius), outline = new THREE.Shape();
        for (let i = 0; i <= 64; i++) {const a = -half + 2 * half * i / 64; outline[i ? 'lineTo' : 'moveTo'](TUB.radius * Math.sin(a) * MM, -TUB.radius * Math.cos(a) * MM);}
        outline.closePath(); hardware.pool.geometry = new THREE.ExtrudeGeometry(outline, {depth: TUB.depth * MM, bevelEnabled: false});
        hardware.pool.geometry.translate(0, TUB.y * MM, (TUB.z - TUB.depth / 2) * MM);
      } else hardware.pool.geometry = new THREE.BufferGeometry();
    }
    let pumpSeconds = 0;
    for (const stage of s.stages) if (['drain', 'spin', 'brake'].includes(stage.kind)) pumpSeconds += Math.max(0, Math.min(clock, stage.end) - stage.start);
    hardware.impeller.rotation.z = -TAU * 2 * pumpSeconds / SPEED_UP;
    hardware.heater.material.color.set(now.heaterW > 0 ? 0xc14f39 : 0xb4c5b0);
    hardware.valveLamp.material.color.set(now.inletLps > 0 ? 0xe3b45e : 0x83b4c1);
    hardware.lockLamp.material.color.set(s.doorLocked ? 0xc14f39 : 0x91aa7e); hardware.lockPin.position.x = (s.doorLocked ? 210 : 226) * MM;
    hardware.detergent.scale.y = Math.max(0.001, 1 - now.dose / 60); hardware.detergent.visible = now.dose < 60 - 1e-8;
    const kind = s.stages[s.stageIndex].kind, active = s.complete ? 5 : kind === 'fill' ? 0 : kind === 'heat' ? 1 : kind === 'tumble' ? 2 : kind === 'drain' ? 3 : 4;
    hardware.statusLights.forEach((light, i) => light.material.color.set(clock > 0 && i === active ? 0xe3b45e : 0x374736));
    showWasherFlow(hardware, now, clock / SPEED_UP, swayMm);
    chart.cursor.geometry.attributes.position.array.set([...chart.coord(clock / s.duration, 0), ...chart.coord(clock / s.duration, 1)]); chart.cursor.geometry.attributes.position.needsUpdate = true; chart.cursor.geometry.computeBoundingSphere();
    chart.shakeDot.position.set(...chart.coord(now.rpm / 1400, now.amplitude / 0.012));
    const resultText = s.complete ? `Complete · ${fixed(now.moisture * 100, 1)}% retained water; door unlocked` : clock === 0 ? 'Ready to fill, wash, rinse and spin' : `${now.stage} · ${fixed(clock / 60, 1)} of ${fixed(s.duration / 60, 1)} min`;
    return {state: {...s, depth, swayMm, heating: now.heaterW > 0, pumping: now.pumpW > 0, pumpSeconds}, readings: [
      r('Your result', resultText, 'Changing a control restarts the program. Inspection views preserve its state.'),
      r('Drum motion', `${fixed(now.rpm, 0)} rpm · ${fixed(omegaOf(now.rpm) ** 2 * DRUM.radius / DRUM.g, now.rpm < 100 ? 2 : 0)} g at the wall`, now.rpm === 0 ? 'The drum is stopped.' : now.rpm <= 50 ? 'Slow turning lifts and drops the laundry.' : 'Increasing speed pins the laundry against the wall while water leaves through the holes.'),
      r('Bath and heater', `${fixed(now.water, 1)} L free water · ${fixed(now.T, 1)} °C`, now.heaterW > 0 ? `${fixed(now.heaterW, 0)} W heating power. Red marks electrical heating.` : 'Heater off. Water and fabric share an ideal well-mixed temperature.'),
      r('Water balance', `${fixed(now.used, 1)} L supplied · ${fixed(now.drained, 1)} L drained`, `${fixed(now.liquid, 2)} L remains in the tub and fabric. Supply minus drainage equals retained water.`),
      r('Detergent remaining', `${fixed(now.detergentInLaundry, 2)} g in the laundry`, `${fixed(now.concentration, 3)} g/L in the retained water. ${fixed(now.dose, 1)} g dosed, ${fixed(now.detergentOut, 2)} g drained.`),
      r('Retained water', `${fixed(now.moisture * 100, 1)}% of dry laundry mass`, `${fixed(now.moisture * values.load, 2)} kg of water remains in ${fixed(values.load, 0)} kg of dry fabric. This is not a measured dryness prediction.`),
      r('Suspension', `${fixed(now.amplitude * 1000, 2)} mm recent peak · ${fixed(now.floor, 1)} N peak floor force`, s.held ? `Selected ${fixed(values.imbalance, 1)} kg imbalance limits the spin to ${s.topSpin} rpm in this teaching program.` : 'Springs carry the tub; dampers dissipate vibration. The peaks include acceleration and braking.'),
      r('Door and drain', s.doorLocked ? 'Door locked' : s.complete ? 'Stopped, drained and unlocked' : 'Ready · door closed', now.pumpW > 0 ? `Drain pump on · ${fixed(now.drainLps * 60, 2)} L/min leaving the tub or fabric.` : now.inletLps > 0 ? `Inlet open · ${fixed(now.inletLps * 60, 1)} L/min filling.` : 'Inlet and pump off.'),
      r('Electrical energy', `${fixed(now.energy / 3.6e6, 3)} kWh`, `${fixed(now.heaterEnergy / 3.6e6, 3)} kWh heater; ${fixed((now.energy - now.heaterEnergy) / 3.6e6, 3)} kWh assigned motor and pump demand.`),
    ]};
  });
  const render = result.update;
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) clock += dt * SPEED_UP; return render();};
  result.animate = time => {const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt);};
  result.reset = (initial = {}) => {clock = Number.isFinite(initial.time) ? Math.max(0, initial.time) : 0; lastClock = 0; restoring = true; try {return render({...result.defaults, ...(initial.settings || {})});} finally {restoring = false;}};
  result.replayState = () => ({settings: result.getState().values, time: 0});
  const inspect = (label, id, view = 'front', isolate = false) => ({label, part: id, view, isolate, replay: false, run: () => result.update()});
  result.actions = [inspect('Inspect: complete washer', 'machine'), inspect('Inspect: drum and laundry', 'washing'), inspect('Inspect: motor and shaft', 'drive', 'back', true), inspect('Inspect: water circuit', 'water-circuit'), inspect('Inspect: suspension', 'suspension'), inspect('Inspect: door and lock', 'structure'), inspect('Read the program chart', 'program-chart', 'front', true), inspect('Read the suspension chart', 'shake-chart', 'front', true)];
  result.playback = {label: 'Run the wash program', description: 'Program time runs 60× faster. Drum rotation is capped at 120 rpm for legibility. Steady washing uses ballistic cloth-marker motion; transitions and the slowed suspension motion are illustrations.', stepLabel: 'Advance thirty program seconds', advance: result.advance, step: () => result.advance(0.5), complete: () => result.getState().complete, blocked: () => false};
  result.initialPart = result.autoFramePart = 'machine'; result.initialView = 'front'; result.initialCutaway = true;
  result.frameVisibleOnly = true; result.framePadding = 0.63; result.selectionOutline = false; result.transparentBackground = true;
  result.thumbnailOmit = [chart.charts]; result.partViewDirections = {};
  for (const entry of result.parts) result.partViewDirections[entry.id] = {front: [0.7, 0.4, 3], back: [-0.7, 0.4, -3], side: [3, 0.2, 0], top: [0, 3, 0], bottom: [0, -3, 0]};
  for (const id of ['charts', 'program-chart', 'shake-chart']) {result.partViewDirections[id] = {front: [0, 0, 3]}; Object.assign(result.parts.find(p => p.id === id), {framePadding: 0.43, maxZoom: 150});}
  result.topology = {system, ...hardware, ...chart, MM, SPEED_UP};
  const dispose = result.dispose; result.dispose = () => {if (!disposed) {disposed = true; dispose();}};
  return result;
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, stripGeometry, surface} from './scene-kit.js';
import {sampleAirCleaner, SIZES, FLOWS, METHOD_OPTIONS, FILTER, PRECIPITATOR, ROOM, AIR_CLEANER_DEFAULTS, AIR_CLEANER_DOMAINS} from './air-cleaner-physics.js';

// ---------------------------------------------------------------------------
// Air cleaner: a tower cut open, air entering at the left through a pre-filter,
// crossing a pleated HEPA-grade filter or a two-stage electrostatic cell, and
// blown out of the top by a centrifugal fan; or an ionizer's needle with no
// cell at all. Beside it, what gets through and how the room clears.
//
// Scale: one millimeter is 0.004 scene units for every length: the 340 mm by
// 600 mm tower, the 92 pleats whose faces add up to the filter's 1.85 m^2, the
// 50 collector plates 6 mm apart and 100 mm long. The ionizing wires, 0.1 mm
// across, are drawn 2 mm across so they show, and the particles, all under
// 10 um, as 8 mm dots.
//
// Time: the hour of running plays sixty times faster than real time. The dots
// are drawn crossing the tower at an illustrative pace, faster at higher fan
// speed, and as many of every 24 stop at the filter or a plate as its share
// caught says. The fan is drawn turning once a playback second for every 60 m^3
// an hour it moves.
//
// Colors: charged plates gold, grounded plates gray.
//
// Charts, beside the tower, not to its scale: the share of particles let
// through against their size, 0.01 to 10 um across on a log scale and 0.0001%
// to 100% up on a log scale, with a dot at the chosen size; and the particles
// left in the room over the hour, 0 to 60 minutes across and 0 to 100% up, with
// the cleaner (red) and without it (gray), and a dot for now.
// ---------------------------------------------------------------------------

const MM = 0.004;
const TAU = Math.PI * 2;
const SPEED_UP = 60;
const END = ROOM.minutes * 60;
const PARTICLES = 24;
export const BOX = Object.freeze({left: -170, right: 170, height: 600, depth: 240});
export const PANEL = Object.freeze({front: -110, low: 80, high: 380, width: 200, pleats: 92});
export const PITCH = (PANEL.high - PANEL.low) / PANEL.pleats;
/** Pleat depth that makes the folded mat's faces add up to the filter's area. */
export const PLEAT_DEPTH = Math.sqrt((FILTER.area * 1e6 / (2 * PANEL.pleats * PANEL.width)) ** 2 - (PITCH / 2) ** 2);
export const CELL = Object.freeze({charger: -110, zone: 25, collectorStart: -85, plates: 50, wires: 12});
export const FAN_CENTER = Object.freeze([100, 230, 0]);
export const THROUGH_CHART = Object.freeze({left: 230, bottom: 360, width: 300, height: 200});
export const ROOM_CHART = Object.freeze({left: 230, bottom: 60, width: 300, height: 200});
const clamp01 = x => Math.max(0, Math.min(1, x));
const scaled = point => point.map(v => v * MM);

export const throughPoint = (size, penetration) => [(THROUGH_CHART.left + (Math.log10(size) + 8) / 3 * THROUGH_CHART.width) * MM, (THROUGH_CHART.bottom + clamp01((Math.log10(Math.max(penetration, 1e-6)) + 6) / 6) * THROUGH_CHART.height) * MM, 0];
export const roomPoint = (seconds, fraction) => [(ROOM_CHART.left + seconds / END * ROOM_CHART.width) * MM, (ROOM_CHART.bottom + clamp01(fraction) * ROOM_CHART.height) * MM, 0];
export const plateY = k => PANEL.low + 3 + 6 * k;

/**
 * Where particle i is drawn, in millimeters, at a moment of playback. It enters
 * at the left, crosses the stage and the fan and leaves at the top, unless it
 * is one of the ones caught, which stops on the filter's face or on the nearest
 * plate.
 */
export function particlePlace(i, s, clock) {
  const y = 100 + (i * 37) % 260, z = -80 + (i * 53) % 160, caught = i < Math.round(PARTICLES * s.efficiency);
  const rate = 0.25 * s.hourly / FLOWS[2], u = ((clock / SPEED_UP) * rate + i / PARTICLES) % 1;
  let stop = null;
  if (caught && s.values.mode === 0) stop = [PANEL.front + (i % 5) * PLEAT_DEPTH / 5, y, z];
  if (caught && s.values.mode === 1) stop = [CELL.collectorStart + 100 * ((i % 7) + 0.5) / 7, plateY(Math.max(0, Math.min(CELL.plates - 1, Math.round((y - plateY(0)) / 6)))), z];
  const path = stop ? [[-230, y, z], [-120, y, z], stop] : [[-230, y, z], [-120, y, z], [15, y, z], [FAN_CENTER[0], FAN_CENTER[1], z], [FAN_CENTER[0], BOX.height, z], [FAN_CENTER[0], BOX.height + 100, z]];
  const lengths = path.slice(1).map((point, n) => Math.hypot(point[0] - path[n][0], point[1] - path[n][1]));
  let distance = u * lengths.reduce((sum, length) => sum + length, 0);
  for (let n = 0; n < lengths.length; n++) {
    if (distance <= lengths[n] || n === lengths.length - 1) { const f = Math.min(1, distance / lengths[n]); return path[n].map((v, c) => v + (path[n + 1][c] - v) * f); }
    distance -= lengths[n];
  }
  return path.at(-1);
}

export function createAirCleanerModel() {
  const kit = houseModel('Air cleaner'), {root, part, control, finish, covers} = kit;
  const box = (size, center, color, parent) => kit.box(size.map(v => v * MM), scaled(center), color, parent);
  const system = part('system', 'Air cleaner', 'A fan draws room air through a pre-filter and then a pleated HEPA-grade filter, a two-stage electrostatic cell, or past a bare ionizer, and blows it back into the room. Drawn at true size, cut open.', [0, 0, 0]);

  const body = part('body', 'Tower', 'The housing, 340 mm wide and 600 mm tall: air in through the grille on the left, out through the grille on top.', [0, 0, 0], system);
  box([340, 4, 240], [0, 2, 0], 'cream', body);
  box([340, 600, 4], [0, 300, -118], 'cream', body);
  covers.push(box([340, 600, 4], [0, 300, 118], 'cream', body));
  box([4, 600, 240], [BOX.right, 300, 0], 'cream', body);
  box([4, 60, 240], [BOX.left, 30, 0], 'cream', body);
  box([4, 200, 240], [BOX.left, 500, 0], 'cream', body);
  for (let k = 0; k < 34; k++) kit.rod(scaled([BOX.left, 65 + k * 10, -110]), scaled([BOX.left, 65 + k * 10, 110]), 1.5 * MM, 'ink', body);
  box([200, 4, 240], [-70, BOX.height, 0], 'cream', body);
  for (let k = 0; k < 13; k++) kit.rod(scaled([36 + k * 10, BOX.height, -110]), scaled([36 + k * 10, BOX.height, 110]), 1.5 * MM, 'ink', body);

  const prefilter = part('prefilter', 'Pre-filter', 'A coarse mesh that stops hair and lint before they clog the stage behind it.', [0, 0, 0], system);
  const mesh = box([3, 320, 220], [-145, 230, 0], 'leaf', prefilter);
  mesh.material = mesh.material.clone();
  mesh.material.transparent = true;
  mesh.material.opacity = 0.35;

  const filter = part('filter', 'HEPA-grade filter', `A mat of glass fibers 0.6 µm across, 4% solid and 0.4 mm thick, folded into ${PANEL.pleats} pleats so 1.85 m² of it fits a 300 by 200 mm frame. The air crosses the mat slowly, and fibers catch particles by diffusion, interception and impaction.`, [0, 0, 0], system);
  const folds = stripGeometry(2 * PANEL.pleats + 1), folded = folds.attributes.position.array;
  for (let k = 0; k <= 2 * PANEL.pleats; k++) {
    const x = PANEL.front + (k % 2) * PLEAT_DEPTH, y = PANEL.low + k * PITCH / 2;
    folded.set([x * MM, y * MM, -PANEL.width / 2 * MM, x * MM, y * MM, PANEL.width / 2 * MM], k * 6);
  }
  folds.computeVertexNormals();
  const pleats = surface(kit, folds, 'cream', filter, true);
  const carbon = part('carbon', 'Activated carbon', 'A thin bed of carbon granules whose huge inner surface holds some odor and gas molecules. It does nothing for particles and fills up in time.', [0, 0, 0], system);
  box([10, 300, 200], [-40, 230, 0], 'ink', carbon);

  const charger = part('charger', 'Ionizing wires', 'Thin wires 0.1 mm across at 7 kV between grounded plates. The intense field at a wire tears molecules into ions, which stick to passing particles and charge them. In the ionizer, a needle at the outlet does the same with no plates to follow.', [0, 0, 0], system);
  const wires = new THREE.Group(), needle = new THREE.Group();
  charger.add(wires, needle);
  for (let k = 0; k < CELL.wires; k++) kit.rod(scaled([CELL.charger, PANEL.low + CELL.zone / 2 + k * CELL.zone, -100]), scaled([CELL.charger, PANEL.low + CELL.zone / 2 + k * CELL.zone, 100]), 1 * MM, 'clay', wires);
  for (let k = 0; k <= CELL.wires; k++) box([24, 0.8, 200], [CELL.charger, PANEL.low + k * CELL.zone, 0], 'metal', wires);
  kit.rod(scaled([120, BOX.height - 30, 0]), scaled([150, BOX.height + 20, 0]), 1.2 * MM, 'clay', needle);
  kit.sphere(3 * MM, scaled([150, BOX.height + 20, 0]), 'gold', needle);

  const collector = part('collector', 'Collector plates', `Fifty plates ${fixed(PRECIPITATOR.gap * 1000, 0)} mm apart and ${fixed(PRECIPITATOR.length * 1000, 0)} mm long, alternately at 5 kV and grounded. Charged particles drift across the air stream onto them and stick.`, [0, 0, 0], system);
  const plates = Array.from({length: CELL.plates}, (_, k) => box([100, 0.8, 200], [CELL.collectorStart + 50, plateY(k), 0], k % 2 ? 'metal' : 'gold', collector));

  const fan = part('fan', 'Fan', 'A centrifugal fan: its curved blades fling air outward into the scroll, which leads it up and out of the top grille.', scaled(FAN_CENTER), system);
  const wheel = new THREE.Group();
  fan.add(wheel);
  for (let k = 0; k < 24; k++) { const blade = box([3, 18, 150], [0, 0, 0], 'gold', wheel); blade.geometry.translate(0, 60 * MM, 0); blade.rotation.z = k * TAU / 24; }
  const scroll = kit.ring(85 * MM, 3 * MM, [0, 0, 0], 'metal', fan);
  kit.cylinder(30 * MM, 40 * MM, [0, 0, -90 * MM], 'ink', fan).rotation.x = Math.PI / 2;

  const air = part('particles', 'Particles', 'Dots for particles in the air, drawn far larger than life. As many of every 24 stop on the filter or a plate as the stage catches; the rest go back into the room.', [0, 0, 0], system);
  const dots = Array.from({length: PARTICLES}, () => kit.sphere(4 * MM, [0, 0, 0], 'clay', air));

  const charts = part('charts', 'Charts', 'The share of particles let through against their size, on log scales, and the particles left in the room over an hour, with the cleaner and without. Not to the tower’s scale.', [0, 0, 0], system);
  const axis = (a, b) => kit.rod(a, b, 1.2 * MM, 'ink', charts);
  axis(throughPoint(1e-8, 1e-6), throughPoint(1e-5, 1e-6));
  axis(throughPoint(1e-8, 1e-6), throughPoint(1e-8, 1));
  axis(roomPoint(0, 0), roomPoint(END, 0));
  axis(roomPoint(0, 0), roomPoint(0, 1));
  const throughLine = lineObject(61, 0xc14f39, charts), sizeDot = kit.sphere(6 * MM, [0, 0, 0], 'red', charts);
  const roomLine = lineObject(61, 0xc14f39, charts), bareLine = lineObject(61, 0x9aa7ad, charts), nowDot = kit.sphere(6 * MM, [0, 0, 0], 'red', charts);

  const specs = {
    mode: ['How it catches particles', METHOD_OPTIONS.map(({value, label}) => ({value, label})), '', 'A fibrous filter, charged plates, or charging alone.'],
    size: ['Particle size', SIZES.map((size, value) => ({value, label: `${fixed(size * 1e6, size < 1e-7 ? 2 : size < 1e-6 ? 1 : 0)} µm`})), '', 'Smoke is mostly around 0.1 to 0.3 µm, pollen 10 µm and up.'],
    fan: ['Fan speed', FLOWS.map((flow, value) => ({value, label: `${['Low', 'Medium', 'High'][value]}, ${flow} m³/h`})), '', 'How much air the fan pushes through each hour.'],
  };
  for (const [key, [min, max, step]] of Object.entries(AIR_CLEANER_DOMAINS)) {
    const [label, options, unit, help] = specs[key];
    control(key, label, min, max, step, AIR_CLEANER_DEFAULTS[key], unit, help, options);
  }

  let clock = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleAirCleaner(values, clock), mode = values.mode;
    pleats.visible = mode === 0;
    carbon.visible = mode === 0;
    wires.visible = mode === 1;
    needle.visible = mode === 2;
    collector.visible = mode === 1;
    wheel.rotation.z = -TAU * s.hourly / 60 * (clock / SPEED_UP);
    dots.forEach((dot, i) => dot.position.set(...scaled(particlePlace(i, s, clock))));

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      s.curve.forEach((point, i) => throughLine.geometry.attributes.position.array.set(throughPoint(point.size, 1 - point.efficiency), i * 3));
      const bare = s.total - s.rates.cleaner - s.rates.drift;
      for (let i = 0; i <= 60; i++) {
        roomLine.geometry.attributes.position.array.set(roomPoint(i * 60, Math.exp(-s.total * i * 60)), i * 3);
        bareLine.geometry.attributes.position.array.set(roomPoint(i * 60, Math.exp(-bare * i * 60)), i * 3);
      }
      for (const line of [throughLine, roomLine, bareLine]) { line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere(); }
      sizeDot.position.set(...throughPoint(s.d, 1 - s.efficiency));
    }
    nowDot.position.set(...roomPoint(clock, s.remaining));

    const size = specs.size[1][values.size].label, percent = (x, digits) => `${fixed(x * 100, digits)}%`;
    const caught = mode === 2 ? 'The ionizer itself catches none' : `${mode === 0 ? 'The filter catches' : 'The plates catch'} ${percent(s.efficiency, 3)}`;
    const how = mode === 0
      ? r('How the fibers catch them', `diffusion ${percent(s.capture.diffusion, 1)}, interception ${percent(s.capture.interception, 1)}, impaction ${percent(s.capture.impaction, 1)}`, 'What one fiber catches of the particles heading for it. Small particles wander into fibers; large ones cannot follow the air around them.')
      : r('Charge they carry', `${fixed(s.charge.total, s.charge.total < 10 ? 2 : 1)} charges on average`, mode === 1 ? `Field charging gives ${fixed(s.charge.field, 1)} and diffusion charging ${fixed(s.charge.diffusion, 1)}; they drift across to the plates at ${fixed(s.plateDrift * 100, 2)} cm/s.` : `With no plates, they drift toward the walls at only ${fixed(s.roomDrift * 1e6, 2)} µm/s.`);
    return {
      state: s,
      readings: [
        r('Your result', clock === 0 ? `${caught} of the ${size} particles · press Play to run for an hour` : `${caught} of the ${size} particles · ${percent(s.remaining, 1)} left in the room after ${fixed(clock / 60, 0)} min`),
        r('Clean air delivered', `${fixed(s.cadr * 3600, 1)} m³ an hour`, `${s.hourly} m³ an hour pass through the ${['HEPA filter', 'electrostatic precipitator', 'ionizer'][mode]}, ${fixed(s.changes, 2)} times the room’s air each hour.`),
        how,
        r('Room air', `${percent(s.remaining, 1)} of the particles left`, `Without the cleaner, ${percent(s.withoutCleaner, 1)} would be.`),
        r('Half gone in', `${fixed(s.halfTime / 60, 1)} min`, `Per hour: the cleaner clears ${fixed(s.rates.cleaner * 3600, 2)} roomfuls, fresh air ${fixed(s.rates.ventilation * 3600, 2)}, settling ${fixed(s.rates.settling * 3600, 3)}${mode === 2 ? `, drift to the walls ${fixed(s.rates.drift * 3600, 3)}` : ''}.`),
        r('Resistance and power', `${fixed(s.drop, 0)} Pa, ${fixed(s.electrical, 1)} W`, mode === 0 ? `The pleated mat’s 1.85 m² lets the air cross it at only ${fixed(s.U * 100, 2)} cm/s.` : `The corona takes ${fixed(s.corona, 2)} W; open channels cost the fan little.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(END, clock + dt * SPEED_UP); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the pleated filter', part: 'filter', view: 'front', replay: false, run() { render({mode: 0}); clock = 30; return render(); }},
    {label: 'Inspect: the charged plates', part: 'collector', view: 'front', replay: false, run() { render({mode: 1}); clock = 30; return render(); }},
    {label: 'Inspect: the room after half an hour', part: 'charts', view: 'front', replay: false, run() { clock = END / 2; return render(); }},
  ];
  result.playback = {
    label: 'Run the cleaner for an hour',
    description: 'An hour in a 30 m³ room, sixty times faster than real time.',
    stepLabel: 'Advance five minutes',
    advance: result.advance,
    step: () => result.advance(300 / SPEED_UP),
    complete: () => clock >= END,
    blocked: () => false,
  };

  root.rotation.set(0.12, -0.35, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, body, prefilter, filter, pleats, carbon, charger, wires, needle, collector, plates, fan, wheel, scroll, air, dots, charts, throughLine, sizeDot, roomLine, bareLine, nowDot, MM, SPEED_UP, END, PARTICLES};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

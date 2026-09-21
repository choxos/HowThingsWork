import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, surface} from './scene-kit.js';
import {sampleAerosol, aerosolPlan, blendPressure, AEROSOL, LIQUEFIED, NITROGEN, PROPELLANT_OPTIONS, AEROSOL_DEFAULTS, AEROSOL_DOMAINS} from './aerosol-physics.js';

// ---------------------------------------------------------------------------
// Aerosol spray can: a steel can cut open, the liquid and the gas above it, the
// dip tube, the valve and its spring, the actuator, and the spray.
//
// Scale: one millimeter is 0.006 scene units for every length. The can is 65 mm
// across and its inside, domed bottom and sloping shoulder included, holds
// 500 mL brimful. The liquid is drawn at the level its volume fills.
//
// Time: the spray plays six times faster than real time, three minutes in 30 s.
// Drops are drawn crossing the plume twice a playback second, their number in
// proportion to the mass sprayed each second, shrinking as their propellant
// boils. Bubbles in the liquid stand for propellant boiling, more of them the
// faster it boils; dots in the gas stand for its pressure, more of them the
// higher it is. Upside down, the can is turned end over end toward the viewer,
// so its nozzle points the other way.
//
// Colors: the steel shell turns pale blue as the can cools, fully blue 15 °C
// below the room.
//
// Charts, above the can, not to its scale: the pressure over the three minutes
// (red), 0 to 180 s across and 0 to 12 bar above the room's up, with a line for
// now; and pressure against temperature, -10 to 50 °C across and 0 to 12 bar up,
// for the liquefied propellant (gold) and the nitrogen (blue) as filled, with a
// dot for the can now.
// ---------------------------------------------------------------------------

const MM = 0.006;
const K = 273.15;
const SPEED_UP = 6;
const END = AEROSOL.duration;
const DROPS = 40;
const BUBBLES = 24;
const MARKERS = 24;
export const CAN = Object.freeze({radius: 32.5, dome: 12, chine: 30, wallTop: 145.2, shoulderTop: 165, neck: 13.5, actuatorTop: 190});
export const PRESSURE_CHART = Object.freeze({left: -250, bottom: 240, width: 220, height: 140, seconds: 180, top: 1.2e6});
export const TEMPERATURE_CHART = Object.freeze({left: 30, bottom: 240, width: 220, height: 140, low: -10, high: 50, top: 1.2e6});
const STEEL = new THREE.Color(0xb4c5b0), FROST = new THREE.Color(0x9fd3e6);
const clamp01 = x => Math.max(0, Math.min(1, x));
const scaled = point => point.map(v => v * MM);

export const bottomAt = radius => (radius <= CAN.chine ? CAN.dome * (1 - (radius / CAN.chine) ** 2) : 0);
export const radiusAt = y => (y <= CAN.wallTop ? CAN.radius : y <= CAN.shoulderTop ? CAN.radius + (CAN.neck - CAN.radius) * (y - CAN.wallTop) / (CAN.shoulderTop - CAN.wallTop) : CAN.neck);
/** The can's inside volume below a height, in cubic millimeters. */
export function volumeBelow(height) {
  const {radius: R, dome: D, chine: C, wallTop: W, shoulderTop: S} = CAN, y = Math.max(0, Math.min(S, height));
  const low = Math.min(y, D), dome = Math.PI * (R * R * low - C * C * (low - low * low / (2 * D)));
  const wall = y > D ? Math.PI * R * R * (Math.min(y, W) - D) : 0;
  const shoulder = y > W ? Math.PI * (y - W) / 3 * (R * R + R * radiusAt(y) + radiusAt(y) ** 2) : 0;
  return dome + wall + shoulder;
}
export const BRIMFUL = volumeBelow(CAN.shoulderTop);
/** Height of the liquid's surface for a volume in cubic meters: standing, it fills from the bottom; upside down, from the valve end. */
export function levelFor(volume, upright) {
  const target = volume * 1e9;
  let lo = 0, hi = CAN.shoulderTop;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, filled = upright ? volumeBelow(mid) : BRIMFUL - volumeBelow(mid);
    if (upright ? filled < target : filled > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** The liquid's cross-section as a closed outline of [radius, height] in millimeters. */
export function liquidOutline(level, upright) {
  const {radius: R, dome: D, chine: C, wallTop: W, shoulderTop: S, neck} = CAN, points = [];
  if (upright) {
    const inner = level < D ? C * Math.sqrt(1 - level / D) : 0;
    if (level >= D) points.push([0, level]);
    for (let k = 0; k <= 12; k++) { const radius = inner + (C - inner) * k / 12; points.push([radius, bottomAt(radius)]); }
    points.push([R, 0]);
    if (level > W) points.push([R, W]);
    points.push([radiusAt(level), level]);
  } else {
    points.push([0, level], [radiusAt(level), level]);
    if (level < W) points.push([R, W]);
    points.push([neck, S], [0, S]);
  }
  points.push(points[0]);
  return points;
}
export const pressurePoint = (seconds, gauge) => [(PRESSURE_CHART.left + seconds / PRESSURE_CHART.seconds * PRESSURE_CHART.width) * MM, (PRESSURE_CHART.bottom + clamp01(gauge / PRESSURE_CHART.top) * PRESSURE_CHART.height) * MM, 0];
export const temperaturePoint = (celsius, gauge) => [(TEMPERATURE_CHART.left + (celsius - TEMPERATURE_CHART.low) / (TEMPERATURE_CHART.high - TEMPERATURE_CHART.low) * TEMPERATURE_CHART.width) * MM, (TEMPERATURE_CHART.bottom + clamp01(gauge / TEMPERATURE_CHART.top) * TEMPERATURE_CHART.height) * MM, 0];
/** A fixed scatter of places inside the can, as fractions of a region's height and radius and an angle in the cut-open sector. */
export const scatter = i => ({along: (i * 0.381 + 0.13) % 1, out: 0.3 + 0.6 * ((i * 0.53) % 1), angle: Math.PI / 4 + 0.3 + ((i * 0.618) % 1) * (Math.PI * 1.5 - 0.6)});
const lathe = (points, start = 0, length = Math.PI * 2) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), 48, start, length);
function seeThrough(mesh, opacity) {
  mesh.material = mesh.material.clone();
  mesh.material.transparent = true;
  mesh.material.opacity = opacity;
  mesh.material.depthWrite = false;
  return mesh;
}

export function createAerosolCanModel() {
  const kit = houseModel('Aerosol spray can'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Aerosol spray can', 'A steel can holding a liquid product and a propellant under pressure. Pressing the button opens a valve, and the pressure drives the liquid up a dip tube and out through a tiny hole as a spray. Drawn at true size, cut open.', [0, 0, 0]);
  const holder = new THREE.Group();
  system.add(holder);

  const can = part('can', 'Steel can', 'Tinplate steel 65 mm across, holding 500 mL brimful. Its domed bottom and sloping shoulder let thin steel hold several bar. It turns pale blue here as it cools.', [0, 0, 0], holder);
  const outline = [...Array.from({length: 13}, (_, k) => [CAN.chine * k / 12, bottomAt(CAN.chine * k / 12)]), [CAN.radius, 0], [CAN.radius, CAN.wallTop], [CAN.neck, CAN.shoulderTop]];
  const shell = surface(kit, lathe(outline, Math.PI / 4, Math.PI * 1.5), 'metal', can, true);
  const front = surface(kit, lathe(outline, -Math.PI / 4, Math.PI / 2), 'metal', can);
  front.material = shell.material;
  covers.push(front);
  const rim = kit.ring(CAN.radius * MM, 1.2 * MM, [0, 0.6 * MM, 0], 'metal', can);
  rim.rotation.x = Math.PI / 2;

  const valve = part('valve', 'Valve', 'A mounting cup crimped into the can’s 1 inch opening holds a plastic housing, a spring, and a stem pressed up against a rubber gasket. Pushing the stem down uncovers its side hole and lets liquid from the dip tube through.', [0, 0, 0], holder);
  kit.cylinder(CAN.neck * MM, 2 * MM, [0, (CAN.shoulderTop + 1) * MM, 0], 'metal', valve);
  const housing = seeThrough(kit.cylinder(4.5 * MM, 20 * MM, [0, 155 * MM, 0], 'cream', valve), 0.6);
  const spring = kit.spring([0, 147 * MM, 0], 2.8 * MM, 11 * MM, 6, valve, 0.35 * MM);
  const gasket = kit.ring(3 * MM, 0.8 * MM, [0, 166 * MM, 0], 'ink', valve);
  gasket.rotation.x = Math.PI / 2;
  const stem = kit.cylinder(1.8 * MM, 20 * MM, [0, 168 * MM, 0], 'metal', valve);

  const tube = part('dip-tube', 'Dip tube', 'A plastic tube from the valve down to the lowest corner of the can, where the last 6 mL of liquid collects. Whatever its open end sits in, liquid or gas, is what comes out.', [0, 0, 0], holder);
  const tubeEnd = levelFor(AEROSOL.residual, true);
  const tubePoints = [[0, 146, 0], [0, 100, 0], [0, 45, 0], [6, 20, 0], [17, 11, 0], [28, tubeEnd, 0]];
  const dipTube = seeThrough(kit.tube(tubePoints.map(scaled), 1.5 * MM, 'cream', tube), 0.7);

  const actuator = part('actuator', 'Actuator and nozzle', 'The button pressed onto the stem. The liquid turns a corner inside it and leaves through a hole 0.45 mm across, fast enough to tear into drops.', [0, 0, 0], holder);
  const button = new THREE.Group();
  actuator.add(button);
  kit.cylinder(13 * MM, 18 * MM, [0, 181 * MM, 0], 'red', button);
  const insert = kit.cylinder(2.5 * MM, 3 * MM, [13.5 * MM, 184 * MM, 0], 'ink', button);
  insert.rotation.z = Math.PI / 2;

  const liquidPart = part('liquid', 'Liquid', 'The product with the propellant dissolved in it, or the product alone in a nitrogen can, drawn at the level its volume fills. Bubbles show propellant boiling.', [0, 0, 0], holder);
  const liquid = seeThrough(surface(kit, new THREE.BufferGeometry(), 'gold', liquidPart, true), 0.55);
  const bubbles = Array.from({length: BUBBLES}, () => kit.sphere(1.5 * MM, [0, 0, 0], 'cream', liquidPart));

  const gasPart = part('gas', 'Gas above the liquid', 'Propellant vapor, or nitrogen, pressing on the liquid. The dots stand for its pressure: more dots, higher pressure.', [0, 0, 0], holder);
  const markers = Array.from({length: MARKERS}, () => kit.sphere(1.2 * MM, [0, 0, 0], 'ink', gasPart));
  const markerMaterial = markers[0].material.clone();
  markers.forEach(marker => { marker.material = markerMaterial; });

  const spray = part('spray', 'Spray', 'Drops leaving the nozzle, more of them the more liquid leaves each second, shrinking as their propellant boils away; or puffs of gas when only gas comes out.', [0, 0, 0], system);
  const drops = Array.from({length: DROPS}, () => kit.sphere(MM, [0, 0, 0], 'gold', spray));
  const puffs = Array.from({length: DROPS}, () => kit.sphere(MM, [0, 0, 0], 'metal', spray));
  const puffMaterial = seeThrough(puffs[0], 0.45).material;
  puffs.forEach(puff => { puff.material = puffMaterial; });

  const charts = part('charts', 'Charts', 'The pressure over the three minutes of spraying, and pressure against temperature for a liquefied propellant and for nitrogen, with the can marked. Not to the can’s scale.', [0, 0, 0], system);
  const axis = (a, b) => kit.rod(a, b, 0.8 * MM, 'ink', charts);
  axis(pressurePoint(0, 0), pressurePoint(PRESSURE_CHART.seconds, 0));
  axis(pressurePoint(0, 0), pressurePoint(0, PRESSURE_CHART.top));
  axis(temperaturePoint(TEMPERATURE_CHART.low, 0), temperaturePoint(TEMPERATURE_CHART.high, 0));
  axis(temperaturePoint(TEMPERATURE_CHART.low, 0), temperaturePoint(TEMPERATURE_CHART.low, TEMPERATURE_CHART.top));
  const pressureLine = lineObject(Math.round(END / AEROSOL.every) + 1, 0xc14f39, charts), cursor = lineObject(2, 0x374736, charts);
  const liquefiedLine = lineObject(61, 0xe3b45e, charts), nitrogenLine = lineObject(61, 0x2f6690, charts), dot = kit.sphere(4 * MM, [0, 0, 0], 'red', charts);
  const filledShare = aerosolPlan({propellant: 0, temperature: 20, orientation: 0}).startShare;
  for (let i = 0; i <= 60; i++) {
    const celsius = TEMPERATURE_CHART.low + i;
    liquefiedLine.geometry.attributes.position.array.set(temperaturePoint(celsius, filledShare * blendPressure(celsius + K) - AEROSOL.atmosphere), i * 3);
    nitrogenLine.geometry.attributes.position.array.set(temperaturePoint(celsius, NITROGEN.fillPressure * (celsius + K) / NITROGEN.fillTemperature - AEROSOL.atmosphere), i * 3);
  }
  for (const line of [liquefiedLine, nitrogenLine]) line.geometry.computeBoundingSphere();

  const specs = {
    propellant: ['Propellant', PROPELLANT_OPTIONS.map(({value, label}) => ({value, label})), '', 'What keeps the can under pressure.'],
    temperature: ['Temperature', null, '°C', 'The can’s temperature and the room’s.'],
    orientation: ['Held', [{value: 0, label: 'Upright'}, {value: 1, label: 'Upside down'}], '', 'Which way up the can is while spraying.'],
  };
  for (const [key, [min, max, step]] of Object.entries(AEROSOL_DOMAINS)) {
    const [label, options, unit, help] = specs[key];
    control(key, label, min, max, step, AEROSOL_DEFAULTS[key], unit, help, options);
  }

  let clock = 0, lastClock = 0, disposed = false, chartKey = '', liquidKey = '';
  const result = finish(values => {
    const s = sampleAerosol(values, clock), upright = s.upright, pressed = clock > 0 && clock < END, press = pressed ? 1.5 : 0;
    holder.rotation.z = upright ? 0 : Math.PI;
    holder.position.y = upright ? 0 : CAN.actuatorTop * MM;
    button.position.y = -press * MM;
    stem.position.y = (168 - press) * MM;
    spring.userData.setLength((11 - press) * MM);

    const level = levelFor(s.V, upright), shape = `${upright}:${level.toFixed(4)}`;
    if (shape !== liquidKey) {
      liquidKey = shape;
      liquid.geometry.dispose();
      liquid.geometry = lathe(liquidOutline(level, upright));
    }
    const boiling = s.liquefied ? clamp01(s.boilRate / 1.5e-4) : 0, shownBubbles = Math.round(BUBBLES * boiling);
    const liquidLow = upright ? CAN.dome + 2 : CAN.shoulderTop - 3, roomForBubbles = upright ? level > CAN.dome + 2 : level < CAN.shoulderTop - 3;
    bubbles.forEach((bubble, i) => {
      const {out, angle} = scatter(i), phase = ((clock / SPEED_UP) * 0.8 + i / BUBBLES) % 1, y = liquidLow + (level - liquidLow) * phase, radius = radiusAt(y) * out;
      bubble.position.set(radius * Math.sin(angle) * MM, y * MM, radius * Math.cos(angle) * MM);
      bubble.visible = pressed && roomForBubbles && i < shownBubbles;
    });
    const gasLow = upright ? level : CAN.dome + 1, gasHigh = upright ? CAN.shoulderTop - 1 : level, shownMarkers = Math.round(MARKERS * clamp01(s.P / 1.1e6));
    markerMaterial.color.set(s.liquefied ? 0xe3b45e : 0x2f6690);
    markers.forEach((marker, i) => {
      const {along, out, angle} = scatter(i + 7), y = gasLow + (gasHigh - gasLow) * along, radius = radiusAt(y) * out;
      marker.position.set(radius * Math.sin(angle) * MM, y * MM, radius * Math.cos(angle) * MM);
      marker.visible = gasHigh > gasLow + 2 && i < shownMarkers;
    });

    const side = upright ? 1 : -1, nozzle = [side * 15, upright ? 184 - press : CAN.actuatorTop - 184 + press];
    const length = Math.min(260, 6 * s.jet), spread = s.liquefied ? 0.27 : 0.12, playing = clock / SPEED_UP;
    const shownDrops = s.volumeRate > 0 ? Math.round(DROPS * clamp01(s.massRate / 4.5e-3)) : 0, shownPuffs = s.gasRate > 0 ? Math.round(DROPS * clamp01(s.gasRate / 3e-4)) : 0;
    drops.forEach((drop, i) => {
      const u = (playing * 2 + i / DROPS) % 1, up = Math.sin(i * 2.4), deep = Math.cos(i * 1.7);
      drop.position.set((nozzle[0] + side * u * length) * MM, (nozzle[1] + up * spread * u * length) * MM, deep * spread * u * length * MM);
      drop.scale.setScalar(s.liquefied ? 2 * (1 - 0.6 * u) : 2.5);
      drop.visible = pressed && i < shownDrops;
    });
    puffs.forEach((puff, i) => {
      const u = (playing * 2 + i / DROPS) % 1, up = Math.sin(i * 2.4), deep = Math.cos(i * 1.7);
      puff.position.set((nozzle[0] + side * u * 90) * MM, (nozzle[1] + up * 0.35 * u * 90) * MM, deep * 0.35 * u * 90 * MM);
      puff.scale.setScalar(3 * (1 + u));
      puff.visible = pressed && i < shownPuffs;
    });
    shell.material.color.copy(STEEL).lerp(FROST, clamp01((s.room - s.T) / 15));

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      const array = pressureLine.geometry.attributes.position.array;
      s.samples.forEach((sample, i) => array.set(pressurePoint(sample.t, sample.P - AEROSOL.atmosphere), i * 3));
      pressureLine.geometry.attributes.position.needsUpdate = true;
      pressureLine.geometry.computeBoundingSphere();
    }
    cursor.geometry.attributes.position.array.set([...pressurePoint(clock, 0), ...pressurePoint(clock, PRESSURE_CHART.top)]);
    cursor.geometry.attributes.position.needsUpdate = true;
    dot.position.set(...temperaturePoint(s.T - K, s.gauge));

    const bar = pascals => fixed(Math.max(0, pascals) / 1e5, 2), grams = kilograms => fixed(kilograms * 1000, 1);
    let outcome;
    if (clock === 0) outcome = 'Ready · press Play to hold the button down';
    else if (!pressed) outcome = `Button released after three minutes · ${grams(s.sprayedProduct)} g of product sprayed`;
    else if (s.volumeRate > 0) outcome = `Spraying ${fixed(s.massRate * 1000, 2)} g a second at ${bar(s.gauge)} bar · ${grams(s.product)} g of product left`;
    else if (s.gasRate > 0) outcome = `Only gas comes out: ${fixed(s.gasRate * 1000, 3)} g a second of ${s.liquefied ? 'propellant vapor' : 'nitrogen'}`;
    else outcome = `Nothing comes out · ${grams(s.product)} g of product left in the can`;
    const gasSpace = (AEROSOL.brimful - s.V) * 1e6;
    return {
      state: {...s, level, pressed},
      readings: [
        r('Your result', outcome),
        r('Pressure', `${bar(s.gauge)} bar above the room’s`, s.liquefied ? (s.propellant > 0.005 ? `The propellant’s vapor pressure at ${fixed(s.T - K, 1)} °C, however much liquid is left.` : 'The last of the propellant is boiling away, so the pressure falls.') : `Nitrogen spread through ${fixed(gasSpace, 0)} mL; its pressure falls as the liquid leaves.`),
        r('Inside the can', `${fixed(s.V * 1e6, 0)} mL of liquid, ${fixed(gasSpace, 0)} mL of gas`, s.liquefied ? `${grams(s.propellant)} g of propellant in the liquid and ${fixed(s.vapor * 1000, 2)} g as vapor.` : `${fixed(s.nitrogen * NITROGEN.molar * 1000, 2)} g of nitrogen.`),
        r('Spray', !pressed ? 'none' : s.volumeRate > 0 ? `${fixed(s.jet, 1)} m/s out of a 0.45 mm hole` : s.gasRate > 0 ? 'gas only' : 'none', !pressed ? (clock === 0 ? 'Hold the button down to spray.' : 'The button is released.') : s.volumeRate > 0 ? (s.liquefied ? `${fixed(s.flashing * 100, 0)}% of the propellant in it boils at once, tearing the liquid into mist.` : 'No propellant in it to boil, so it breaks into coarser drops.') : s.gasRate > 0 ? (upright ? 'The dip tube’s end is out of the liquid.' : 'Upside down, the dip tube’s open end sits in the gas.') : 'Nothing is flowing.'),
        r('Can temperature', `${fixed(s.T - K, 1)} °C`, s.liquefied ? `Boiling ${fixed(s.boiled * 1000, 2)} g of propellant has taken ${fixed(s.boiled * LIQUEFIED.latent / 1000, 2)} kJ; the room gives back ${fixed(s.heat, 2)} W.` : `The nitrogen’s work cools it a little; the room gives back ${fixed(s.heat, 2)} W.`),
        r('Sprayed so far', `${grams(s.sprayedProduct)} g of product`, `With ${grams(s.sprayedPropellant)} g of propellant${s.sprayedGas > 0 ? ` and ${fixed(s.sprayedGas * 1000, 2)} g of gas` : ''}.`),
        r('At 50 °C', `${bar(s.hotPressure - AEROSOL.atmosphere)} bar`, s.liquefied ? 'A liquefied propellant’s pressure climbs steeply with heat: never warm a can.' : 'A gas’s pressure rises only in proportion to its absolute temperature.'),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(END, clock + dt * SPEED_UP); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the valve and dip tube', part: 'valve', view: 'front', replay: false, run() { clock = 20; return render(); }},
    {label: 'Inspect: the spray', part: 'spray', view: 'front', replay: false, run() { clock = 10; return render(); }},
    {label: 'Inspect: the charts after the spray', part: 'charts', view: 'front', replay: false, run() { clock = END - 1; return render(); }},
  ];
  result.playback = {
    label: 'Hold the button down',
    description: 'Three minutes of spraying, six times faster than real time.',
    stepLabel: 'Advance ten seconds',
    advance: result.advance,
    step: () => result.advance(10 / SPEED_UP),
    complete: () => clock >= END,
    blocked: () => false,
  };

  root.rotation.set(0.15, -0.35, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, holder, can, shell, front, rim, valve, housing, spring, gasket, stem, tube, dipTube, tubePoints, tubeEnd, actuator, button, insert, liquidPart, liquid, bubbles, gasPart, markers, markerMaterial, spray, drops, puffs, charts, pressureLine, cursor, liquefiedLine, nitrogenLine, dot, filledShare, MM, SPEED_UP, END, DROPS, BUBBLES, MARKERS};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

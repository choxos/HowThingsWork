import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject} from './scene-kit.js';
import {sampleVacuum, losses, fanPressure, CREVICE, NOZZLE_OPTIONS, DEBRIS, PATHS, VACUUM_DEFAULTS, VACUUM_DOMAINS} from './vacuum-physics.js';

// ---------------------------------------------------------------------------
// Vacuum cleaners: a canister cleaner with its hose and wand, and a classic
// upright with its fan in the floor head and its bag on the handle, cut open.
//
// Scale: one millimeter is 0.002 scene units for every length: the slots, the
// 2.6 m of hose and wand, the 0.6 m of duct and fill tube, the bags and fans.
// The drawn hose and duct are fitted to exactly the lengths the physics uses.
// Grains are drawn larger than life so they show: sand 6 mm across, rice 10 mm,
// dust specks 3 mm.
//
// Time: real time, ten seconds of running. The fans are drawn turning twice a
// second and the brush roll three times, not at their real thousands of rpm.
// Dots stand for the air and move along its path at 15 mm a second for each
// meter a second of the air's true speed in that piece, so they crowd where
// the air is slow, as in the bag. Lifted grains are drawn rising into the slot,
// once a cycle, at an illustrative pace.
//
// Colors: hose, wand, duct and nozzles are drawn see-through so the air inside
// them shows. The exhaust filter, or the upright's cloth cover, goes from pale green
// when clean to gray when clogged. The dust in the bag fills it as far as the
// setting says. The upright's cloth cover is drawn swollen by a quarter of its
// width for each 10 kPa inside it, far more than real cloth stretches.
//
// Charts, beside each cleaner, not to its scale: the fan's pressure rise
// against flow (red) and the pressure the air path uses up (blue), 0 to 50 L/s
// across and 0 to 22 kPa up, crossing at the dot where the cleaner runs; and
// the pressure along the air's path (gold), from the room through each piece
// in turn and back to the room, from 22 kPa below the room's pressure to 12 kPa
// above it, with the room's pressure as the ink line.
// ---------------------------------------------------------------------------

const MM = 0.002;
const TAU = Math.PI * 2;
const PACE = 15;
const DOTS = 60;
const GRAINS = 12;
const END = 10;
const FAN_TURNS = 2;
const BRUSH_TURNS = 3;
const CREVICE_LENGTH = 180;
export const GRAIN_RADIUS = Object.freeze([3, 5, 1.5]);
const GRAIN_COLORS = Object.freeze([0xe3b45e, 0xf0dfaf, 0x5b5b55]);
export const FILTER_COLORS = Object.freeze([0xb4c5b0, 0x5b5b55]);
export const CHART = Object.freeze({width: 360, height: 280, flow: 0.05, top: 22000, low: -22000, high: 12000, stations: 6});
const clamp01 = x => Math.max(0, Math.min(1, x));
const scaled = point => point.map(v => v * MM);
const unit = vector => { const length = Math.hypot(...vector); return vector.map(v => v / length); };

export const flowPoint = (chart, Q, p) => [(chart.left + Q / CHART.flow * CHART.width) * MM, (chart.bottom + clamp01(p / CHART.top) * CHART.height) * MM, 0];
export const profilePoint = (chart, station, p) => [(chart.left + station / CHART.stations * CHART.width) * MM, (chart.bottom + clamp01((p - CHART.low) / (CHART.high - CHART.low)) * CHART.height) * MM, 0];
/** Width scale of the upright's cloth cover for the pressure inside it. */
export const swellOf = insideBag => 1 + 0.25 * clamp01(insideBag / 10000);

const curveOf = points => new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
/** The free parameter that makes the curve through pointsFor(x) `target` millimeters long, by bisection. */
function fitLength(pointsFor, target, lo, hi) {
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (curveOf(pointsFor(mid)).getLength() < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** A route's pieces with their lengths in millimeters and drawn air speeds at this flow. */
export function routeTiming(route, s) {
  let start = 0;
  return route.map(piece => {
    const area = piece.area === 'slot' ? s.slotArea : piece.area === 'hose' ? s.hoseArea : piece.area, lengths = [0];
    for (let i = 1; i < piece.points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(...piece.points[i].map((v, k) => v - piece.points[i - 1][k])));
    const speed = PACE * s.flow / area, timed = {points: piece.points, area, lengths, speed, start, duration: lengths.at(-1) / speed};
    start += timed.duration;
    return timed;
  });
}

/** Where a dot is, in millimeters, `tau` seconds after it entered its route. */
export function routePoint(timing, tau) {
  const piece = timing.find(candidate => tau < candidate.start + candidate.duration) ?? timing.at(-1);
  const distance = Math.max(0, Math.min(piece.lengths.at(-1), (tau - piece.start) * piece.speed));
  let i = 1;
  while (i < piece.lengths.length - 1 && piece.lengths[i] < distance) i++;
  const span = piece.lengths[i] - piece.lengths[i - 1], u = span > 0 ? (distance - piece.lengths[i - 1]) / span : 0;
  return piece.points[i - 1].map((v, k) => v + (piece.points[i][k] - v) * u);
}

/** A grain's drawn place in millimeters: at home, or rising into the mouth once a cycle while the air lifts it. */
export const grainPlace = (home, mouth, lifted, time, i) => {
  const rise = lifted ? ((time * 0.8 + i / GRAINS) % 1) ** 2 : 0;
  return home.map((v, k) => v + (mouth[k] - v) * rise);
};

const tipOf = ({base, direction}) => base.map((v, k) => v + direction[k] * CREVICE_LENGTH);
function drawCrevice(kit, {base, direction}, parent) {
  const tool = kit.box([CREVICE.width * 1000 * MM, CREVICE_LENGTH * MM, CREVICE.gap * 1000 * MM], scaled(base.map((v, k) => v + direction[k] * CREVICE_LENGTH / 2)), 'ink', parent);
  tool.rotation.z = Math.atan2(-direction[0], direction[1]);
  return seeThrough(tool, 0.5);
}
function seeThrough(mesh, opacity) {
  mesh.material = mesh.material.clone();
  mesh.material.transparent = true;
  mesh.material.opacity = opacity;
  mesh.material.depthWrite = false;
  return mesh;
}

function buildCleaner(spec) {
  const kind = spec.kind, path = PATHS[kind];
  const kit = houseModel(spec.name), {root, part, control, finish, covers} = kit;
  const system = part('system', spec.name, spec.summary, [0, 0, 0]);
  const drawn = spec.draw(kit, system, covers);

  const air = part('air', 'Moving air', 'Dots moving along the air’s path at 15 mm a second for each meter a second of air, so they crowd where the air slows. They stop when the nozzle is blocked.', [0, 0, 0], system);
  const dots = Array.from({length: DOTS}, () => kit.sphere(8 * MM, [0, 0, 0], 'blue', air));

  const floor = part('floor', 'Dirt on the floor', 'Grains in front of the nozzle, or dust in a patch of carpet, drawn larger than life. They rise into the slot only if the air there moves fast enough, and carpet dust only where a brush roll beats it loose.', [0, 0, 0], system);
  kit.box([spec.floor.width * MM, 6 * MM, 420 * MM], [spec.floor.x * MM, -3 * MM, 0], 'wood', floor);
  const carpet = kit.box([spec.floor.width * MM, 5 * MM, 420 * MM], [spec.floor.x * MM, 2.5 * MM, 0], 'clay', floor);
  const grains = Array.from({length: GRAINS}, (_, i) => {
    const grain = kit.sphere(MM, [0, 0, 0], 'gold', floor);
    grain.userData.home = [spec.floor.grains - (i % 4) * 30, 6, -90 + i * 16];
    return grain;
  });
  const grainMaterial = grains[0].material.clone();
  grains.forEach(grain => { grain.material = grainMaterial; });

  const charts = part('charts', 'Fan and air path', 'Fan pressure against flow in red and the pressure the air path uses up in blue, crossing where the cleaner runs; and the pressure along the path in gold, piece by piece, against the room’s pressure in ink. Not to the cleaner’s scale.', [0, 0, 0], system);
  const {fanChart, profileChart} = spec;
  const axis = (a, b) => kit.rod(a, b, 1.5 * MM, 'ink', charts);
  axis(flowPoint(fanChart, 0, 0), flowPoint(fanChart, CHART.flow, 0));
  axis(flowPoint(fanChart, 0, 0), flowPoint(fanChart, 0, CHART.top));
  axis(profilePoint(profileChart, 0, CHART.low), profilePoint(profileChart, 0, CHART.high));
  axis(profilePoint(profileChart, 0, 0), profilePoint(profileChart, CHART.stations, 0));
  const fanLine = lineObject(51, 0xc14f39, charts), pathLine = lineObject(51, 0x2f6690, charts), profileLine = lineObject(12, 0xe3b45e, charts);
  const point = kit.sphere(8 * MM, [0, 0, 0], 'red', charts);
  for (let i = 0; i <= 50; i++) fanLine.geometry.attributes.position.array.set(flowPoint(fanChart, path.fan.maxFlow * i / 50, fanPressure(path.fan, path.fan.maxFlow * i / 50)), i * 3);
  fanLine.geometry.computeBoundingSphere();

  const specs = {
    nozzle: ['Nozzle', NOZZLE_OPTIONS.map(({value, label}) => ({value, label})), '', 'What the air comes in through.'],
    bag: ['Dust bag', null, '% full', 'How full the bag is. Dirt in its pores makes the air harder to push through.'],
    filter: [spec.filterLabel, [{value: 0, label: 'Clean'}, {value: 1, label: 'Clogged'}], '', spec.filterHelp],
    debris: ['On the floor', DEBRIS.map(({value, label}) => ({value, label})), '', 'What the cleaner is picking up.'],
  };
  for (const [key, [min, max, step]] of Object.entries(VACUUM_DOMAINS)) {
    const [label, options, unitLabel, help] = specs[key];
    control(key, label, min, max, step, VACUUM_DEFAULTS[key], unitLabel, help, options);
  }

  let time = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleVacuum(values, time, kind), moving = s.flow > 0, fitted = values.nozzle === 1 ? 1 : 0;
    const timing = moving ? routeTiming(drawn.routes[fitted], s) : null, loop = timing ? timing.at(-1).start + timing.at(-1).duration : 0;
    dots.forEach((dot, i) => {
      dot.visible = moving;
      if (moving) dot.position.set(...scaled(routePoint(timing, (time + i * loop / DOTS) % loop)));
    });
    carpet.visible = values.debris === 2;
    grainMaterial.color.set(GRAIN_COLORS[values.debris]);
    grains.forEach((grain, i) => {
      grain.position.set(...scaled(grainPlace(grain.userData.home, drawn.mouths[fitted], s.lifted, time, i)));
      grain.scale.setScalar(GRAIN_RADIUS[values.debris]);
    });
    drawn.update(s, time);

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      const array = pathLine.geometry.attributes.position.array;
      let count = 51;
      for (let i = 0; i <= 50; i++) {
        const Q = CHART.flow * i / 50, pressure = s.opening.blocked ? CHART.top * i / 50 : losses(path, values, Q).total;
        array.set(flowPoint(fanChart, s.opening.blocked ? 0 : Q, pressure), i * 3);
        if (pressure > CHART.top && count === 51) count = i + 1;
      }
      pathLine.geometry.setDrawRange(0, count);
      const profile = profileLine.geometry.attributes.position.array;
      s.profile.forEach((station, k) => {
        profile.set(profilePoint(profileChart, k, station.pressure), k * 6);
        profile.set(profilePoint(profileChart, k + 1, station.pressure), k * 6 + 3);
      });
      for (const line of [pathLine, profileLine]) { line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere(); }
    }
    point.position.set(...flowPoint(fanChart, s.flow, s.pressure));

    const tube = kind === 'upright' ? 'duct' : 'hose', kPa = pascals => fixed(pascals / 1000, 2);
    const signed = pascals => (Math.abs(pascals) < 5 ? '0.00' : `${pascals > 0 ? '+' : '−'}${kPa(Math.abs(pascals))}`);
    const liftHint = values.debris === 2
      ? (path.brush === 0 ? 'Air alone cannot pull dust from carpet fibers, and this floor head has no brush.' : values.nozzle === 0 ? `The brush roll beats it loose; then it falls at only ${fixed(s.fall, 2)} m/s.` : 'The crevice tool holds the brush roll off the carpet, so nothing beats the dust loose.')
      : `One and a half times the ${fixed(s.fall, 2)} m/s a grain falls at through still air.`;
    const bagHint = kind === 'upright'
      ? (moving ? 'Above the room’s: the fan blows the dirty air in, and the bag swells as the air escapes through the cloth.' : 'At the room’s: with no air moving, the bag hangs limp.')
      : (moving ? 'Below the room’s: the fan sucks the air through the bag.' : 'Below the room’s, like the whole canister; with no air moving, the bag hangs limp.');
    return {
      state: {...s, loop},
      readings: [
        r('Your result', moving ? `${fixed(s.flow * 1000, 2)} L of air a second, ${fixed(s.slotSpeed, 1)} m/s at the nozzle · ${s.lifted ? 'picks up' : 'leaves'} the ${s.grain.noun}` : `Blocked · no air moves; the sock is held on with ${fixed(s.sockForce, 1)} N`),
        r('Air speed', moving ? `${fixed(s.slotSpeed, 1)} m/s in the slot, ${fixed(s.hoseSpeed, 1)} m/s in the ${tube}` : 'still', moving ? `A Reynolds number of ${fixed(s.reynolds, 0)} in the ${tube}: the air tumbles as it goes.` : 'Nothing flows past the sock.'),
        r('Suction', `${kPa(s.pressure)} kPa across the fan`, moving ? `${kPa(s.nozzle)} kPa of it is spent at the nozzle, moving the dirt.` : 'All of it holds the sock on.'),
        r('Where the suction goes', moving ? `nozzle ${kPa(s.nozzle)}, ${tube} ${kPa(s.hose)}, bag ${kPa(s.bag)}, ${kind === 'upright' ? 'cloth' : 'filter'} ${kPa(s.filter)} kPa` : `all ${kPa(s.pressure)} kPa across the sock`),
        r('Inside the bag', `${signed(s.insideBag)} kPa from the room’s pressure`, bagHint),
        r('Power', `${fixed(s.electrical, 0)} W from the socket`, moving ? `${fixed(s.airPower, 1)} W goes into the air, ${fixed(s.nozzlePower, 1)} W of it at the nozzle. The fan is ${fixed(s.efficiency * 100, 1)}% efficient here.` : `The fan only churns the air it holds, taking ${fixed(s.shaft, 0)} W; none of it reaches the room.`),
        r('Lifting it', `needs ${fixed(s.needed, 2)} m/s at the nozzle`, liftHint),
        r('Running', `${fixed(time, 1)} s, ${fixed(s.air * 1000, 0)} L of air moved`, `${fixed(s.energy / 1000, 1)} kJ of electricity used.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) time = Math.min(END, time + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { time = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the nozzle and the dirt', part: 'floor', view: 'front', replay: false, run() { time = 0.6; return render(); }},
    {label: 'Inspect: where the suction goes', part: 'charts', view: 'front', replay: false, run() { return render(); }},
    ...spec.actions.map(action => ({...action, view: 'front', replay: false, run() { time = 2; return render(); }})),
  ];
  result.playback = {
    label: 'Switch it on',
    description: 'Ten seconds of running, in real time.',
    stepLabel: 'Advance half a second',
    advance: result.advance,
    step: () => result.advance(0.5),
    complete: () => time >= END,
    blocked: () => false,
  };

  root.rotation.set(0.12, -0.3, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {...drawn.topology, routes: drawn.routes, mouths: drawn.mouths, system, air, dots, floor, carpet, grains, grainMaterial, charts, fanChart, profileChart, fanLine, pathLine, profileLine, point, MM, PACE, DOTS, END, FAN_TURNS, BRUSH_TURNS, kind};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

// The canister cleaner, drawn from the side with the floor head at the left.
const WAND_END = Object.freeze([-900, 180, 0]), HANDLE = Object.freeze([-650, 780, 0]);
export const WAND_LENGTH = Math.hypot(HANDLE[0] - WAND_END[0], HANDLE[1] - WAND_END[1]);
export const HOSE_RADIUS = 16;
const hosePoints = x => [HANDLE, [-610, 830, 0], [-545, 700, 0], [-480, 380, 0], [-440, 150, 0], [-400, 60, 0], [-340, 30, 0], [-260, 22, 0], [x - 300, 22, 0], [x - 190, 30, 0], [x - 100, 80, 0], [x - 40, 170, 0], [x, 200, 0]];
/** Where the canister's inlet sits: far enough along the floor that hose and wand make 2.6 m. */
export const CANISTER_X = fitLength(hosePoints, PATHS.canister.length * 1000 - WAND_LENGTH, 0, 2000);
const CANISTER_CREVICE = Object.freeze({base: WAND_END, direction: unit([WAND_END[0] - HANDLE[0], WAND_END[1] - HANDLE[1], 0])});
export const BAG_AREA = 0.04;

function drawCanister(kit, system, covers) {
  const X = CANISTER_X, box = (size, center, color, parent) => kit.box(size.map(v => v * MM), scaled(center), color, parent);
  const nozzle = kit.part('nozzle', 'Nozzle', 'The floor head, riding with its front lip 6 mm off the floor so the air rushes in along a 250 mm slot; the crevice tool, a slot 25 by 8 mm; or the floor head with a sock sucked over it.', [0, 0, 0], system);
  const head = seeThrough(box([70, 36, 250], [-930, 24, 0], 'ink', nozzle), 0.55);
  const neck = seeThrough(kit.rod(scaled([-930, 42, 0]), scaled(WAND_END), 14 * MM, 'ink', nozzle), 0.45);
  const tool = drawCrevice(kit, CANISTER_CREVICE, nozzle);
  const sock = box([90, 8, 270], [-930, 4, 0], 'red', nozzle);

  const hose = kit.part('hose', 'Hose and wand', `A ${fixed(WAND_LENGTH, 0)} mm metal wand and a flexible hose: 2.6 m of 32 mm tube from the nozzle to the canister. The air rushes along it at up to 44 m/s, and friction on its wall uses up part of the suction.`, [0, 0, 0], system);
  const wand = seeThrough(kit.rod(scaled(WAND_END), scaled(HANDLE), HOSE_RADIUS * MM, 'metal', hose), 0.45);
  const hoseTube = seeThrough(kit.tube(hosePoints(X).map(scaled), HOSE_RADIUS * MM, 'ink', hose), 0.4);

  const body = kit.part('canister', 'Canister: bag, filter and fan', 'The body, cut open. The air enters the paper dust bag, slows to under a meter a second and leaves its dirt behind, passes the fine exhaust filter, is flung out by the fan, and leaves past the motor, carrying its heat.', [0, 0, 0], system);
  box([420, 10, 280], [X + 210, 65, 0], 'leaf', body);
  box([420, 10, 280], [X + 210, 335, 0], 'leaf', body);
  box([420, 260, 8], [X + 210, 200, -136], 'leaf', body);
  covers.push(box([420, 260, 8], [X + 210, 200, 136], 'leaf', body));
  box([8, 260, 280], [X + 4, 200, 0], 'leaf', body);
  box([8, 260, 280], [X + 416, 200, 0], 'leaf', body);
  for (const [x, z] of [[70, 150], [350, 150], [70, -150], [350, -150]]) kit.disk(30 * MM, 20 * MM, scaled([X + x, 30, z]), 'ink', body);
  const bag = seeThrough(box([200, 200, 200], [X + 120, 200, 0], 'cream', body), 0.45);
  const dust = box([196, 1, 196], [X + 120, 100, 0], 'ink', body);
  const filter = box([12, 220, 220], [X + 238, 200, 0], 'metal', body);
  filter.material = filter.material.clone();
  const fan = new THREE.Group();
  fan.position.set(...scaled([X + 285, 200, 0]));
  body.add(fan);
  for (let i = 0; i < 7; i++) { const blade = box([8, 56, 18], [0, 0, 0], 'gold', fan); blade.geometry.translate(0, 30 * MM, 0); blade.rotation.x = i * TAU / 7; }
  kit.sphere(12 * MM, [0, 0, 0], 'ink', fan);
  const motor = kit.cylinder(55 * MM, 100 * MM, scaled([X + 350, 200, 0]), 'gold', body);
  motor.rotation.z = Math.PI / 2;

  const hoseSamples = curveOf(hosePoints(X)).getSpacedPoints(80).map(v => v.toArray());
  const shared = [
    {points: [WAND_END, HANDLE], area: 'hose'},
    {points: hoseSamples, area: 'hose'},
    {points: [hoseSamples.at(-1), [X + 232, 200, 0]], area: BAG_AREA},
    {points: [[X + 232, 200, 0], [X + 250, 200, 0]], area: BAG_AREA},
    {points: [[X + 250, 200, 0], [X + 285, 200, 0]], area: Math.PI * 0.025 ** 2},
    {points: [[X + 285, 200, 0], [X + 300, 285, 0], [X + 414, 285, 0]], area: 0.004},
    {points: [[X + 414, 285, 0], [X + 470, 285, 0]], area: 0.028},
  ];
  const routes = [
    [{points: [[-965, 3, 0], [-930, 10, 0]], area: 'slot'}, {points: [[-930, 10, 0], [-930, 42, 0], WAND_END], area: 'hose'}, ...shared],
    [{points: [tipOf(CANISTER_CREVICE), WAND_END], area: 'slot'}, ...shared],
  ];
  return {
    routes,
    mouths: [[-965, 3, 0], tipOf(CANISTER_CREVICE)],
    topology: {nozzle, head, neck, tool, sock, hose, wand, hoseTube, hoseSamples, body, bag, dust, filter, fan, motor, X},
    update(s, time) {
      const height = Math.max(1e-3, s.values.bag / 100 * 190);
      dust.scale.y = height;
      dust.position.y = (100 + height / 2) * MM;
      filter.material.color.set(FILTER_COLORS[s.values.filter]);
      fan.rotation.x = TAU * FAN_TURNS * time;
      head.visible = neck.visible = s.values.nozzle !== 1;
      tool.visible = s.values.nozzle === 1;
      sock.visible = s.values.nozzle === 2;
    },
  };
}

// The upright, drawn from the side moving left, its handle leaning back.
export const LEAN = 18 * Math.PI / 180;
const UP = Object.freeze([Math.sin(LEAN), Math.cos(LEAN), 0]), ACROSS = Object.freeze([Math.cos(LEAN), -Math.sin(LEAN), 0]);
const along = (start, length) => start.map((v, k) => v + UP[k] * length);
const PIVOT = Object.freeze([150, 125, 0]);
export const BAG_BOTTOM = Object.freeze(along(PIVOT, 100).map((v, k) => v - ACROSS[k] * 110));
export const DUCT_RADIUS = 20;
const ductPoints = fill => [[55, 50, 0], [100, 70, 0], [110, 150, 0], BAG_BOTTOM, along(BAG_BOTTOM, fill)];
/** How far the fill tube reaches up inside the bag: far enough that duct and tube make 0.6 m. */
export const FILL_TUBE = fitLength(ductPoints, PATHS.upright.length * 1000, 50, 800);
const UPRIGHT_CREVICE = Object.freeze({base: [-175, 60, 0], direction: unit([-3.6, -1, 0])});

function drawUpright(kit, system, covers) {
  const box = (size, center, color, parent) => kit.box(size.map(v => v * MM), scaled(center), color, parent);
  const nozzle = kit.part('nozzle', 'Nozzle', 'The 300 mm slot under the front of the floor head, where the brush roll turns; the crevice tool, drawn fitted straight to the inlet; or a sock sucked flat over the slot.', [0, 0, 0], system);
  const tool = drawCrevice(kit, UPRIGHT_CREVICE, nozzle);
  const sock = box([90, 8, 320], [-120, 4, 0], 'red', nozzle);

  const base = kit.part('base', 'Floor head, fan and motor', 'The low body on its wheels. The motor stands over a fan of six flat radial blades just behind the brush roll, so the dirty air goes straight through the fan.', [0, 0, 0], system);
  box([350, 10, 320], [0, 125, 0], 'leaf', base);
  box([10, 110, 320], [170, 70, 0], 'leaf', base);
  box([10, 100, 320], [-172, 75, 0], 'leaf', base);
  const walls = [box([350, 110, 8], [0, 70, -154], 'leaf', base), box([350, 110, 8], [0, 70, 154], 'leaf', base)];
  covers.push(walls[1]);
  for (const z of [165, -165]) kit.disk(25 * MM, 16 * MM, scaled([120, 25, z]), 'ink', base);
  const housing = kit.ring(65 * MM, 4 * MM, scaled([-10, 50, 0]), 'metal', base);
  housing.rotation.x = Math.PI / 2;
  const fan = new THREE.Group();
  fan.position.set(...scaled([-10, 50, 0]));
  base.add(fan);
  for (let i = 0; i < 6; i++) { const blade = box([56, 20, 6], [0, 0, 0], 'gold', fan); blade.geometry.translate(30 * MM, 0, 0); blade.rotation.y = i * TAU / 6; }
  const motor = kit.cylinder(45 * MM, 110 * MM, scaled([-10, 150, 0]), 'gold', base);
  kit.rod(scaled([-10, 60, 0]), scaled([-10, 95, 0]), 5 * MM, 'metal', base);

  const brush = kit.part('brush', 'Brush roll', 'A roller 290 mm long set with rows of stiff bristles and spun by a belt from the motor. It beats the carpet so dust clinging to the fibers comes loose into the air.', scaled([-120, 32, 0]), system);
  const roller = new THREE.Group();
  brush.add(roller);
  const core = kit.cylinder(12 * MM, 290 * MM, [0, 0, 0], 'metal', roller);
  core.rotation.x = Math.PI / 2;
  for (let row = 0; row < 8; row++) for (let j = 0; j < 12; j++) {
    const angle = TAU * row / 8 + j * 0.2, z = -132 + j * 24;
    kit.rod(scaled([12 * Math.cos(angle), 12 * Math.sin(angle), z]), scaled([26 * Math.cos(angle), 26 * Math.sin(angle), z]), 1.5 * MM, 'ink', roller);
  }

  const duct = kit.part('duct', 'Duct, bag and cloth cover', 'The fan blows the dirty air up a 40 mm duct and fill tube, 0.6 m in all, into a paper bag inside a cloth cover on the handle. The air leaves through paper and cloth; the dirt stays in the paper bag.', [0, 0, 0], system);
  const ductTube = seeThrough(kit.tube(ductPoints(FILL_TUBE).map(scaled), DUCT_RADIUS * MM, 'ink', duct), 0.4);
  const cover = seeThrough(box([160, 640, 160], along(BAG_BOTTOM, 320), 'metal', duct), 0.3);
  const bag = seeThrough(box([120, 560, 120], along(BAG_BOTTOM, 300), 'cream', duct), 0.45);
  const dust = box([116, 1, 116], along(BAG_BOTTOM, 21), 'ink', duct);
  for (const mesh of [cover, bag, dust]) mesh.rotation.z = -LEAN;
  const handleTop = along(PIVOT, 1100);
  const handle = kit.rod(scaled(PIVOT), scaled(handleTop), 12 * MM, 'metal', duct);
  kit.rod(scaled([handleTop[0], handleTop[1], -70]), scaled([handleTop[0], handleTop[1], 70]), 14 * MM, 'ink', duct);

  const ductSamples = curveOf(ductPoints(FILL_TUBE)).getSpacedPoints(60).map(v => v.toArray());
  const rest = [
    {points: [[-10, 30, 0], [-10, 50, 0], [55, 50, 0]], area: Math.PI * 0.03 ** 2},
    {points: ductSamples, area: 'hose'},
    {points: [ductSamples.at(-1), along(BAG_BOTTOM, FILL_TUBE + 100)], area: 0.0144},
  ];
  const routes = [
    [{points: [[-120, 3, 0], [-120, 28, 0]], area: 'slot'}, {points: [[-120, 28, 0], [-60, 30, 0], [-10, 30, 0]], area: 0.012}, ...rest],
    [{points: [tipOf(UPRIGHT_CREVICE), UPRIGHT_CREVICE.base], area: 'slot'}, {points: [UPRIGHT_CREVICE.base, [-60, 30, 0], [-10, 30, 0]], area: 0.012}, ...rest],
  ];
  return {
    routes,
    mouths: [[-120, 3, 0], tipOf(UPRIGHT_CREVICE)],
    topology: {nozzle, tool, sock, base, walls, fan, motor, housing, brush, roller, core, duct, ductTube, ductSamples, cover, bag, dust, handle},
    update(s, time) {
      const height = Math.max(1e-3, s.values.bag / 100 * 400);
      dust.scale.y = height;
      dust.position.set(...scaled(along(BAG_BOTTOM, 21 + height / 2)));
      cover.material.color.set(FILTER_COLORS[s.values.filter]);
      cover.scale.x = cover.scale.z = swellOf(s.insideBag);
      fan.rotation.y = TAU * FAN_TURNS * time;
      roller.rotation.z = -TAU * BRUSH_TURNS * time;
      tool.visible = s.values.nozzle === 1;
      sock.visible = s.values.nozzle === 2;
    },
  };
}

export function createVacuumCleanerModel() {
  return buildCleaner({
    kind: 'canister',
    name: 'Vacuum cleaner',
    summary: 'A fan in the canister lowers the pressure inside, so the room’s air rushes in through the nozzle, along the hose and wand, through a dust bag and a fine filter, and out past the motor. Drawn at true size, the canister cut open.',
    filterLabel: 'Exhaust filter',
    filterHelp: 'The fine filter between the bag and the fan.',
    floor: {x: -1000, width: 460, grains: -1000},
    fanChart: {left: CANISTER_X - 250, bottom: 470},
    profileChart: {left: CANISTER_X + 170, bottom: 470},
    actions: [{label: 'Inspect: the bag, filter and fan', part: 'canister'}],
    draw: drawCanister,
  });
}

export function createUprightVacuumModel() {
  return buildCleaner({
    kind: 'upright',
    name: 'Upright vacuum cleaner',
    summary: 'A classic upright: a brush roll beats the carpet, and a fan right behind it draws the loosened dirt in and blows it up a short duct into a bag on the handle. Drawn at true size, cut open.',
    filterLabel: 'Cloth cover',
    filterHelp: 'The cloth outer bag the air leaves through.',
    floor: {x: -120, width: 620, grains: -230},
    fanChart: {left: 600, bottom: 780},
    profileChart: {left: 600, bottom: 420},
    actions: [{label: 'Inspect: the brush roll and fan', part: 'base'}, {label: 'Inspect: the swollen bag', part: 'duct'}],
    draw: drawUpright,
  });
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, surface, solidArrow} from './scene-kit.js';
import {toyPlan, toyAt, TOY, FLOORS, RATIOS, GEARS, RATIO_OPTIONS, RELEASE_OPTIONS, TOY_DEFAULTS, TOY_DOMAINS} from './friction-drive-toy-physics.js';

// ---------------------------------------------------------------------------
// Friction-drive toy: a toy car cut open to show its gear train and flywheel,
// pushed along a floor that slides past beneath it, then let go.
//
// Scale: one millimeter is 0.02 scene units for every length: the toy 120 mm
// long on wheels 30 mm across, the gears (module 0.5 mm, 3 mm thick) and the
// flywheel 20 mm across and 4 mm thick. The toy stays put and the floor moves:
// 250 mm of it is drawn, its seams 50 mm apart, with a gold line on every half
// meter from where the pushes start. The shell below the cabin is cut away and
// the cabin drawn see-through. Lifted, the toy rises its true 20 mm.
//
// Time: the run plays at a quarter of real speed. Every wheel and gear is drawn
// at its true angle, geared to the wheels, which turn by how far their rims
// have run, so a skid shows as wheels turning faster or slower than the floor
// moves. A part turning more than ten times a second as drawn is shown as a
// blurred disk, since a screen cannot show it turning.
//
// Colors: the press is an orange arrow on the hand. Charts, above the toy, not
// to its scale: the toy's speed on the floor (red) and the flywheel's speed in
// toy terms (gold), 0 to 2.5 m/s up over the run, with a line for now; and one
// bar sharing out the work the hand has done: flywheel (gold), the toy's motion
// (red), skidding (clay), gears and bearings (gray), rolling (blue).
// ---------------------------------------------------------------------------

const MM = 0.02;
const TAU = Math.PI * 2;
const SLOW = 4;
const MODULE = 0.5;
const BLUR = 10;
export const AXLE = Object.freeze({rear: -35, front: 35, height: 15, track: 29});
export const LAYOUT = Object.freeze({first: Math.PI / 3, second: 0, frontZ: 0, backZ: -4.5, flywheelZ: 4, thickness: 3});
export const CHART = Object.freeze({left: 40, width: 140, bottom: 80, height: 60, top: 2.5, bar: 146, barHeight: 8, z: -60});
export const FLOOR = Object.freeze({half: 125, spacing: 50, width: 120, mark: 500});
export const FLOOR_COLORS = Object.freeze([0xd9d4c7, 0xb98b5a, 0x7f8f6a]);
export const SHARE_COLORS = Object.freeze([0xe3b45e, 0xc14f39, 0xb0735a, 0x6f7a73, 0x2f6690]);
export const pitchRadius = teeth => teeth * MODULE / 2;
const wrap = value => ((value + FLOOR.half) % (2 * FLOOR.half) + 2 * FLOOR.half) % (2 * FLOOR.half) - FLOOR.half;

/** Centers, in millimeters in the toy's side plane, of the rear axle, the middle shaft and the flywheel's shaft. */
export function shafts(ratio) {
  const [[T1, t1], [T2, t2]] = GEARS[ratio], axle = [AXLE.rear, AXLE.height], d1 = pitchRadius(T1) + pitchRadius(t1), d2 = pitchRadius(T2) + pitchRadius(t2);
  const middle = [axle[0] + d1 * Math.cos(LAYOUT.first), axle[1] + d1 * Math.sin(LAYOUT.first)];
  return {axle, middle, flywheel: [middle[0] + d2 * Math.cos(LAYOUT.second), middle[1] + d2 * Math.sin(LAYOUT.second)], d1, d2};
}

/** Drawn angles of the gear train for a wheel angle, each driven gear set so its teeth fall in its driver's gaps along their line of centers. */
export function trainAngles(ratio, wheel) {
  const [[T1, t1], [T2, t2]] = GEARS[ratio], a = LAYOUT.first, b = LAYOUT.second;
  const pinion = -(T1 / t1) * wheel + a + Math.PI - Math.PI / t1;
  const second = pinion - (a + Math.PI - Math.PI / t1) + b;
  return {axleGear: wheel + a, pinion, second, flywheel: -(T2 / t2) * (second - b) + b + Math.PI - Math.PI / t2};
}

/** How many turns a second a part turning with speed factor k times the wheels makes as drawn. */
export const drawnTurns = (rim, factor) => Math.abs(rim) / TOY.wheel * factor / SLOW / TAU;

function gearShape(teeth) {
  const R = pitchRadius(teeth) * MM, tip = R + MODULE * MM, root = R - 1.25 * MODULE * MM, step = TAU / teeth, shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    [[root, a - step / 2], [root, a - step / 4], [tip, a - step / 8], [tip, a + step / 8], [root, a + step / 4]].forEach(([radius, angle], j) => shape[i === 0 && j === 0 ? 'moveTo' : 'lineTo'](radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  shape.closePath();
  return shape;
}

export function createFrictionDriveToyModel() {
  const kit = houseModel('Friction-drive toy'), {root, part, control, finish, covers} = kit;
  const mm = value => value * MM, at = (x, y, z) => [mm(x), mm(y), mm(z)];
  const system = part('system', 'Friction-drive toy', 'A toy car whose rear wheels spin a small steel flywheel through gears. Pressed down and pushed along the floor, it stores energy in the flywheel; let go, the flywheel drives it on. Drawn at true size, cut open, with the floor sliding past beneath it.', [0, 0, 0]);

  const body = part('body', 'Body', 'The plastic body, 120 mm long and 50 mm wide. Its lower shell is cut away to show the gears and flywheel, and its cabin is drawn see-through.', [0, 0, 0], system);
  covers.push(kit.box([mm(120), mm(24), mm(50)], at(0, 28, 0), 'clay', body));
  const cabin = kit.box([mm(60), mm(14), mm(44)], at(-5, 47, 0), 'clay', body);
  cabin.material = cabin.material.clone();
  cabin.material.transparent = true;
  cabin.material.opacity = 0.25;
  cabin.material.depthWrite = false;
  for (const side of [-1, 1]) kit.box([mm(110), mm(3), mm(4)], at(0, 9.5, side * 20), 'wood', body);

  const wheelsPart = part('wheels', 'Wheels', 'Four wheels 30 mm across. The rear pair drive the gears, so a skid shows as the wheels turning faster or slower than the floor slides by.', [0, 0, 0], system);
  const wheels = [];
  for (const x of [AXLE.rear, AXLE.front]) {
    kit.rod(at(x, AXLE.height, -AXLE.track), at(x, AXLE.height, AXLE.track), mm(1.5), 'metal', wheelsPart);
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.position.set(...at(x, AXLE.height, side * AXLE.track));
      wheelsPart.add(wheel);
      kit.disk(mm(TOY.wheel * 1000), mm(8), [0, 0, 0], 'ink', wheel);
      kit.disk(mm(7), mm(9), [0, 0, 0], 'gold', wheel);
      kit.box([mm(2), mm(12), mm(9.5)], at(0, 6, 0), 'cream', wheel);
      wheels.push(wheel);
    }
  }

  const gearsPart = part('gears', 'Gear train', 'Two stages of gears, module 0.5 mm, that turn the flywheel 6, 12 or 24 times as fast as the wheels. Each driven gear turns the other way from its driver.', [0, 0, 0], system);
  const sets = Object.fromEntries(RATIOS.map(ratio => {
    const set = new THREE.Group(), [[T1, t1], [T2, t2]] = GEARS[ratio], centers = shafts(ratio);
    gearsPart.add(set);
    const gear = (teeth, center, z, color) => {
      const group = new THREE.Group();
      group.position.set(mm(center[0]), mm(center[1]), mm(z));
      set.add(group);
      const geometry = new THREE.ExtrudeGeometry(gearShape(teeth), {depth: mm(LAYOUT.thickness), bevelEnabled: false});
      geometry.translate(0, 0, -mm(LAYOUT.thickness) / 2);
      const sharp = surface(kit, geometry, color, group), blur = kit.disk(mm(pitchRadius(teeth) + MODULE), mm(LAYOUT.thickness), [0, 0, 0], color, group);
      blur.material = blur.material.clone();
      blur.material.transparent = true;
      blur.material.opacity = 0.45;
      blur.material.depthWrite = false;
      return {group, sharp, blur, teeth};
    };
    kit.rod(at(centers.middle[0], centers.middle[1], -7.5), at(centers.middle[0], centers.middle[1], 1.5), mm(0.8), 'metal', set);
    kit.rod(at(centers.flywheel[0], centers.flywheel[1], -7.5), at(centers.flywheel[0], centers.flywheel[1], 7.5), mm(0.8), 'metal', set);
    return [ratio, {set, centers, axleGear: gear(T1, centers.axle, LAYOUT.frontZ, 'gold'), pinion: gear(t1, centers.middle, LAYOUT.frontZ, 'metal'), second: gear(T2, centers.middle, LAYOUT.backZ, 'gold'), flywheelPinion: gear(t2, centers.flywheel, LAYOUT.backZ, 'metal')}];
  }));

  const flywheelPart = part('flywheel', 'Flywheel', 'A steel disk 20 mm across and 4 mm thick on the fastest shaft. At 12 to 1 it feels at the wheels like 316 g of extra mass, more than twice the whole toy.', [0, 0, 0], system);
  const flywheel = new THREE.Group();
  flywheelPart.add(flywheel);
  const flywheelDisk = kit.disk(mm(TOY.flywheel.radius * 1000), mm(TOY.flywheel.thickness * 1000), [0, 0, 0], 'metal', flywheel);
  const flywheelMarks = [0, 1].map(k => kit.box([mm(3), mm(3), mm(4.2)], at(6 * Math.cos(k * Math.PI), 6 * Math.sin(k * Math.PI), 0), 'ink', flywheel));
  const flywheelBlur = kit.disk(mm(TOY.flywheel.radius * 1000), mm(TOY.flywheel.thickness * 1000 + 0.2), [0, 0, 0], 'metal', flywheel);
  flywheelBlur.material = flywheelBlur.material.clone();
  flywheelBlur.material.transparent = true;
  flywheelBlur.material.opacity = 0.5;
  flywheelBlur.material.depthWrite = false;

  const handPart = part('hand', 'Hand and press', 'The hand that pushes the toy, pressing it onto the floor so its wheels grip, and lifts it back between pushes. The orange arrow is the press, 2.5 mm long for every newton.', [0, 0, 0], system);
  const palm = kit.box([mm(60), mm(12), mm(40)], at(-5, 60, 0), 'cream', handPart);
  const press = solidArrow(kit, 0xd9822b, handPart, mm(1.6));
  press.userData.setDirection(new THREE.Vector3(0, -1, 0));

  const floorPart = part('floor', 'Floor', 'The floor, sliding past beneath the toy: seams every 50 mm, and a gold line every half meter from where the pushes start.', [0, 0, 0], system);
  const base = kit.box([mm(2 * FLOOR.half), mm(2), mm(FLOOR.width)], at(0, -1, 0), 'cream', floorPart);
  base.material = base.material.clone();
  const seams = Array.from({length: 2 * FLOOR.half / FLOOR.spacing}, () => kit.box([mm(1.2), mm(0.3), mm(FLOOR.width)], at(0, 0.15, 0), 'ink', floorPart));
  const mark = kit.box([mm(4), mm(0.5), mm(FLOOR.width)], at(0, 0.25, 0), 'gold', floorPart);

  const charts = part('charts', 'Charts', 'The toy’s speed on the floor (red) and the flywheel’s speed in toy terms (gold) over the run, and a bar sharing out the work the hand has done. Not to the toy’s scale.', [0, 0, 0], system);
  const chartPoint = (seconds, speed, duration) => at(CHART.left + seconds / duration * CHART.width, CHART.bottom + Math.max(0, Math.min(1, speed / CHART.top)) * CHART.height, CHART.z);
  kit.rod(at(CHART.left, CHART.bottom, CHART.z), at(CHART.left + CHART.width, CHART.bottom, CHART.z), mm(0.6), 'ink', charts);
  kit.rod(at(CHART.left, CHART.bottom, CHART.z), at(CHART.left, CHART.bottom + CHART.height, CHART.z), mm(0.6), 'ink', charts);
  const toyLine = lineObject(600, 0xc14f39, charts), flywheelLine = lineObject(600, 0xe3b45e, charts), cursor = lineObject(2, 0x374736, charts);
  const shares = SHARE_COLORS.map(color => {
    const segment = kit.box([1, mm(CHART.barHeight), mm(2)], at(CHART.left, CHART.bar + CHART.barHeight / 2, CHART.z), 'cream', charts);
    segment.material = segment.material.clone();
    segment.material.color.set(color);
    return segment;
  });

  control('speed', 'Push speed', ...TOY_DOMAINS.speed, TOY_DEFAULTS.speed, 'm/s', 'How fast each push moves the toy by its end.');
  control('pushes', 'Pushes', ...TOY_DOMAINS.pushes, TOY_DEFAULTS.pushes, '', 'How many pushes before letting go.');
  control('press', 'Press down', ...TOY_DOMAINS.press, TOY_DEFAULTS.press, 'N', 'How hard the hand presses the toy onto the floor while pushing.');
  control('gearing', 'Gearing', ...TOY_DOMAINS.gearing, TOY_DEFAULTS.gearing, '', 'How many times faster than the wheels the flywheel turns.', RATIO_OPTIONS.map(({value, label}) => ({value, label})));
  control('floor', 'Floor', ...TOY_DOMAINS.floor, TOY_DEFAULTS.floor, '', 'Slippery tiles, a wooden floor, or carpet.', FLOORS.map(({value, label}) => ({value, label})));
  control('release', 'Letting go', ...TOY_DOMAINS.release, TOY_DEFAULTS.release, '', 'Set it down still after the last push, or let go of it moving.', RELEASE_OPTIONS.map(({value, label}) => ({value, label})));

  let clock = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const plan = toyPlan(values), now = toyAt(plan, clock), ratio = plan.ratio, released = clock >= plan.releaseAt.t && plan.releaseAt.t > 0 && clock > 0;
    const key = JSON.stringify(plan.values);
    if (key !== chartKey) {
      chartKey = key;
      const toyPoints = toyLine.geometry.attributes.position.array, flywheelPoints = flywheelLine.geometry.attributes.position.array;
      for (let i = 0; i < 600; i++) {
        const sample = toyAt(plan, plan.duration * i / 599);
        toyPoints.set(chartPoint(sample.clock, sample.phase.onFloor ? sample.v : 0, plan.duration), i * 3);
        flywheelPoints.set(chartPoint(sample.clock, sample.u, plan.duration), i * 3);
      }
      for (const line of [toyLine, flywheelLine]) { line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere(); }
      base.material.color.set(FLOOR_COLORS[plan.values.floor]);
    }

    // The toy: lifted or on the floor, its wheels turned by how far their rims have run.
    const lift = mm(now.height * 1000), wheel = -now.turned / TOY.wheel, angles = trainAngles(ratio, wheel);
    for (const group of [body, wheelsPart, gearsPart, flywheelPart, handPart]) group.position.y = lift;
    wheels.forEach(item => { item.rotation.z = wheel; });
    const [[T1, t1]] = GEARS[ratio];
    for (const [each, set] of Object.entries(sets)) {
      set.set.visible = Number(each) === ratio;
      if (Number(each) !== ratio) continue;
      const turning = {axleGear: [angles.axleGear, 1], pinion: [angles.pinion, T1 / t1], second: [angles.second, T1 / t1], flywheelPinion: [angles.flywheel, ratio]};
      for (const [name, [angle, factor]] of Object.entries(turning)) {
        const item = set[name], blurred = drawnTurns(now.u, factor) > BLUR;
        item.group.rotation.z = angle;
        item.sharp.visible = !blurred;
        item.blur.visible = blurred;
      }
      flywheel.position.set(mm(set.centers.flywheel[0]), mm(set.centers.flywheel[1]), mm(LAYOUT.flywheelZ));
    }
    flywheel.rotation.z = angles.flywheel;
    const spinning = drawnTurns(now.u, ratio) > BLUR;
    flywheelDisk.visible = !spinning;
    flywheelMarks.forEach(mark => { mark.visible = !spinning; });
    flywheelBlur.visible = spinning;

    // The hand holds the toy until it lets go, pressing while it pushes.
    const holding = !released, pressing = holding && (clock === 0 || now.kind === 'pushing');
    handPart.visible = holding;
    const arrow = pressing ? 2.5 * plan.values.press : 0;
    press.userData.setLength(mm(arrow));
    press.position.set(mm(-5), mm(66 + arrow), 0);

    // The floor slides back as the toy moves forward.
    const along = now.x * 1000;
    seams.forEach((seam, k) => seam.position.set(mm(wrap(k * FLOOR.spacing - along)), mm(0.15), 0));
    const markPlace = ((FLOOR.mark / 2 - along) % FLOOR.mark + FLOOR.mark) % FLOOR.mark - FLOOR.mark / 2;
    mark.visible = markPlace >= -FLOOR.half && markPlace < FLOOR.half;
    mark.position.set(mm(markPlace), mm(0.25), 0);

    // Charts.
    cursor.geometry.attributes.position.array.set([...chartPoint(now.clock, 0, plan.duration), ...chartPoint(now.clock, CHART.top, plan.duration)]);
    cursor.geometry.attributes.position.needsUpdate = true;
    const e = now.energy, parts = [now.flywheel, now.motion, e.skid, e.gears + e.bearing, e.rolling], total = parts.reduce((sum, value) => sum + value, 0);
    let left = CHART.left;
    shares.forEach((segment, k) => {
      const width = total > 1e-12 ? parts[k] / total * CHART.width : 0;
      segment.visible = width > 1e-9;
      segment.scale.x = mm(Math.max(width, 1e-6));
      segment.position.x = mm(left + width / 2);
      left += width;
    });

    const onFloor = now.phase.onFloor, grip = now.kind === 'lifted' ? 'In the air' : now.skidding ? 'Skidding' : clock === 0 || clock >= plan.duration ? 'At rest' : 'Gripping';
    const gripHint = plan.grips ? `A push needs ${fixed(plan.need, 2)} N of grip, and pressing with ${fixed(plan.values.press, 0)} N the floor gives up to ${fixed(plan.supply, 2)} N: the wheels grip once the hand catches up with them.` : `A push needs ${fixed(plan.need, 2)} N of grip, but pressing with ${fixed(plan.values.press, 0)} N the floor gives only ${fixed(plan.supply, 2)} N: the wheels skid.`;
    const rolledSoFar = Math.max(0, now.x - plan.releaseAt.x);
    return {
      state: {...plan, now, released, wheel, angles, blurred: spinning, lift, arrow, along},
      readings: [
        r('Your result', clock === 0 ? `Ready · ${plan.values.pushes} ${plan.values.pushes === 1 ? 'push' : 'pushes'}, then let go; press Play` : clock >= plan.duration ? `Rolled ${fixed(plan.rolled, 2)} m after letting go, stopping ${fixed(plan.duration - plan.releaseAt.t, 1)} s later` : `${now.stage} · ${fixed(now.clock, 2)} s`),
        r('Toy', `${fixed(onFloor ? now.v : 0, 2)} m/s on the floor`, released ? `${fixed(rolledSoFar, 2)} m since letting go.` : 'Held by the hand.'),
        r('Flywheel', `${fixed(now.rpm, 0)} rpm, ${fixed(now.u, 2)} m/s in toy terms`, `Feels like ${fixed(plan.felt * 1000, 0)} g of extra mass at the wheels; lifted, it would whirr for ${fixed(now.u * plan.felt / plan.bearing, 1)} s.`),
        r('Wheels', grip, gripHint),
        r('Energy', `${fixed(now.flywheel, 3)} J in the flywheel, ${fixed(now.motion, 3)} J in the toy’s motion`, `The hand has put in ${fixed(e.hand, 3)} J: ${fixed(e.skid, 3)} J lost skidding, ${fixed(e.gears + e.bearing, 3)} J in the gears and bearings, ${fixed(e.rolling, 3)} J rolling.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(result.getState().duration, clock + dt / SLOW); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the gear train', part: 'gears', view: 'front', replay: false, run() { clock = 0.08; return render(); }},
    {label: 'Inspect: the flywheel', part: 'flywheel', view: 'front', replay: false, run() { clock = result.getState().params.T; return render(); }},
    {label: 'Inspect: the skid as it starts', part: 'wheels', view: 'front', replay: false, run() { clock = result.getState().releaseAt.t + 0.05; return render(); }},
    {label: 'Inspect: the charts', part: 'charts', view: 'front', replay: false, run() { clock = result.getState().duration; return render(); }},
  ];
  result.playback = {
    label: 'Push and let go',
    description: 'The pushes and the run, at a quarter of real speed.',
    stepLabel: 'Advance half a second',
    advance: result.advance,
    step: () => result.advance(0.5 * SLOW),
    complete: () => clock >= result.getState().duration,
    blocked: () => false,
  };

  root.rotation.set(0.45, -0.55, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, body, cabin, wheelsPart, wheels, gearsPart, sets, flywheelPart, flywheel, flywheelDisk, flywheelMarks, flywheelBlur, handPart, palm, press, floorPart, base, seams, mark, charts, toyLine, flywheelLine, cursor, shares, MM, SLOW, BLUR, MODULE};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

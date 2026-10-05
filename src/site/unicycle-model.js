import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, solidArrow} from './scene-kit.js';
import {createUnicycleCharts} from './unicycle-charts.js';
export {CHARTS} from './unicycle-charts.js';
import {unicyclePlan, unicycleAt, RIDER, WHEELS, RUN, RIDER_OPTIONS, SEAT_OPTIONS, WHEEL_OPTIONS, UNICYCLE_DEFAULTS, UNICYCLE_DOMAINS} from './unicycle-physics.js';

// ---------------------------------------------------------------------------
// Unicycle: a rider on a unicycle seen from the side, the ground under them
// and three charts beside them.
//
// Scale: one meter is 2 scene units for the wheel, the frame, the cranks, the
// saddle heights and the rider's legs and center of mass. The rider's body,
// arms and head are drawn to rough proportions. The unicycle is held in the
// middle of the picture: the ground's marks slide back as the wheel rolls.
// The charts are not to any scale. Arrows: 1 m for every 1,000 N.
//
// Time: the run is 10 s, played at half speed. The wheel turns by its angle,
// the frame and the rider lean together about the axle, and the cranks turn
// with the wheel, one turn for one turn, directly or through a chain.
//
// Charts: the lean and the lean the rider has noticed; the wheel's speed and
// the speed wanted; the legs' torque on the wheel and the most they can give.
// ---------------------------------------------------------------------------

export const M = 2;
export const SLOW = 2;
const DEG = Math.PI / 180;

export const DRAW = Object.freeze({
  tire: 0.03, rim: 0.008, hub: 0.035, spokes: 32, valve: 0.03,
  fork: 0.055, forkRadius: 0.012, crown: 0.4, post: 0.016, saddle: Object.freeze([0.28, 0.05, 0.12]),
  bearing: 0.03, sprocket: 0.06, chainZ: 0.085,
  crankZ: 0.09, crankRadius: 0.012, pedal: Object.freeze([0.1, 0.02, 0.09]), pedalZ: 0.11,
  legZ: 0.1, thigh: RIDER.inseam / 2, shin: RIDER.inseam / 2, limb: 0.05,
  trunk: Object.freeze([0.22, 0.62, 0.34]), neck: 0.06, head: 0.11, headTop: 1.714 - RIDER.inseam,
  shoulder: Object.freeze([0, 0.54, 0.19]), elbow: Object.freeze([0.05, 0.36, 0.42]), hand: Object.freeze([0.12, 0.3, 0.6]), arm: 0.03,
  centerZ: 0.22, arrow: 0.012, perNewton: 0.001, arrowZ: 0.17, groundY: 0.03, groundZ: 0.15,
});
export const GROUND = Object.freeze({from: -1.2, to: 1.2, tick: 0.5, mark: 0.06});
export const COLORS = Object.freeze({truth: 0x374736, sensed: 0x2f6690, goal: 0xe3b45e, cap: 0xce825f, faint: 0x9aa39a, push: 0xd9822b, steel: 0x5f7380, tire: 0x2b2f2c, skin: 0xdcc3a8, shirt: 0x6f9fae, trousers: 0x44525a});

/** A point (x forward, y up) in the leaning body's frame, meters from the axle, as meters forward of and above the tire's contact. */
export const bodyToGround = (r, lean, [x, y]) => [x * Math.cos(lean) + y * Math.sin(lean), r - x * Math.sin(lean) + y * Math.cos(lean)];

/** The two pedals' centers in the body's frame, the right one first; the right crank points forward before the wheel turns. */
export const pedalsAt = (body, crank) => [1, -1].map(side => [side * body.crank * Math.cos(crank), body.crankAxle - body.r - side * body.crank * Math.sin(crank)]);

/** The knee of a leg from `hip` to `foot`, bending forward; a leg that cannot reach is drawn straight toward the foot. */
export function kneeAt(hip, foot, thigh = DRAW.thigh, shin = DRAW.shin) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  if (d >= thigh + shin) return [hip[0] + ux * thigh, hip[1] + uy * thigh];
  const a = Math.acos(Math.max(-1, Math.min(1, (thigh * thigh + d * d - shin * shin) / (2 * thigh * d))));
  return [hip[0] + thigh * (ux * Math.cos(a) - uy * Math.sin(a)), hip[1] + thigh * (ux * Math.sin(a) + uy * Math.cos(a))];
}

/**
 * The foot that pushes for a torque `torque` on the wheel, with the wheel at
 * angle `wheel`: 0 for the right pedal, 1 for the left, and the push's
 * direction on the ground. A push at right angles to the crank gives the
 * torque; of the two pedals, the one pushed downward is drawn.
 */
export function pedalPush(torque, wheel) {
  const sign = torque < 0 ? -1 : 1, right = [-sign * Math.sin(wheel), -sign * Math.cos(wheel)], pick = right[1] <= 0 ? 0 : 1;
  return {pick, direction: pick ? [-right[0], -right[1]] : right};
}

/** A point on the clockwise equal-sprocket chain path, in the frame plane. */
export function chainPoint(distance, height, radius = DRAW.sprocket) {
  const arc = Math.PI * radius, total = 2 * height + 2 * arc;
  let s = ((distance % total) + total) % total;
  if (s <= height) return [radius, height - s];
  s -= height;
  if (s <= arc) return [radius * Math.cos(s / radius), -radius * Math.sin(s / radius)];
  s -= arc;
  if (s <= height) return [-radius, s];
  s -= height;
  return [-radius * Math.cos(s / radius), height + radius * Math.sin(s / radius)];
}

export function createUnicycleModel() {
  const kit = houseModel('Unicycle'), {root, part, control, finish} = kit;
  const m = value => value * M, at = (x, y, z = 0) => [m(x), m(y), m(z)], Y = new THREE.Vector3(0, 1, 0);
  const paint = (meshes, color) => {
    const material = meshes[0].material.clone();
    material.color.set(color);
    meshes.forEach(mesh => { mesh.material = material; });
    return material;
  };
  const segments = (count, color, parent) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color}));
    object.frustumCulled = false;
    parent.add(object);
    return object;
  };
  const fill = (line, points) => {
    const array = line.geometry.attributes.position.array, room = array.length / 3, n = Math.min(points.length, room);
    line.visible = n > 0;
    for (let i = 0; i < room; i++) array.set(n ? at(...points[Math.min(i, n - 1)]) : [0, 0, 0], i * 3);
    line.geometry.setDrawRange(0, n);
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.boundingBox = null;
    line.geometry.boundingSphere = null;
    return n;
  };
  const rod = (radius, color, parent) => kit.cylinder(m(radius), 1, [0, 0, 0], color, parent);
  const stretch = (mesh, a, b) => {
    const A = new THREE.Vector3(...at(...a)), B = new THREE.Vector3(...at(...b)), d = B.clone().sub(A), length = d.length();
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.scale.set(1, Math.max(1e-6, length), 1);
    if (length > 1e-12) mesh.quaternion.setFromUnitVectors(Y, d.normalize());
  };

  const system = part('system', 'Unicycle and rider', 'Pedals turn the wheel under the leaning rider. The unicycle stays centered while half-meter ground marks move beneath it. Separate chart views retain every simulated sample. This is an assigned forward-and-back balance model.', [0, 0, 0]);

  // The ground and its marks.
  const ground = part('ground', 'Ground', `The ground, with a mark every ${fixed(GROUND.tick, 1)} m that slides back as the wheel rolls forward, and a deeper gold mark where the tire started.`, [0, 0, 0], system);
  fill(lineObject(2, COLORS.truth, ground), [[GROUND.from, 0, 0], [GROUND.to, 0, 0]]);
  const groundTicks = segments(10, COLORS.faint, ground), startMark = segments(1, COLORS.goal, ground);

  // One wheel of each size; the chosen one is shown.
  const wheel = part('wheel', 'Wheel', 'The wheel and its tire, 20, 24, 29 or 36 inches across, turning as it rolls without slipping. The red valve shows it turning. Drawn at true size.', [0, 0, 0], system);
  const wheels = WHEELS.map(inch => {
    const radius = inch * 0.0254 / 2, rim = radius - 2 * DRAW.tire - DRAW.rim, group = new THREE.Group();
    wheel.add(group);
    paint([kit.ring(m(radius - DRAW.tire), m(DRAW.tire), [0, 0, 0], 'ink', group)], COLORS.tire);
    kit.ring(m(rim), m(DRAW.rim), [0, 0, 0], 'metal', group);
    fill(segments(DRAW.spokes, COLORS.faint, group), Array.from({length: DRAW.spokes}, (_, i) => {
      const a = 2 * Math.PI * i / DRAW.spokes, z = (i % 2 ? 1 : -1) * 0.04;
      return [[DRAW.hub * Math.cos(a), DRAW.hub * Math.sin(a), z], [rim * Math.cos(a), rim * Math.sin(a), 0]];
    }).flat());
    kit.disk(m(DRAW.hub), m(0.1), [0, 0, 0], 'metal', group);
    kit.disk(m(.015), m(.21), [0, 0, 0], 'metal', group);
    kit.box([m(DRAW.valve), m(DRAW.valve), m(DRAW.valve)], at(0, rim - DRAW.valve, 0.02), 'red', group);
    return group;
  });

  // The frame, the cranks and the rider lean together about the axle.
  const body = new THREE.Group();
  system.add(body);
  const frame = part('frame', 'Frame and saddle', 'The fork, the seat post and the saddle, leaning with the rider. On a standard unicycle the cranks are fixed to the wheel’s axle; on a giraffe a chain carries their turning down to the wheel, one turn for one turn. Drawn at true size.', [0, 0, 0], body);
  const forks = [1, -1].map(() => rod(DRAW.forkRadius, 'metal', frame));
  const post = rod(DRAW.post, 'metal', frame);
  const crownBridge = rod(DRAW.forkRadius, 'metal', frame);
  const saddle = kit.box(DRAW.saddle.map(m), [0, 0, 0], 'ink', frame);
  const bearing = kit.disk(m(DRAW.bearing), m(0.2), [0, 0, 0], 'metal', frame);
  const sprockets = [0, 1].map(() => kit.ring(m(DRAW.sprocket), m(0.006), [0, 0, 0], 'metal', frame));
  for (const ring of sprockets) for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    kit.rod([0, 0, 0], at(DRAW.sprocket * Math.cos(a), DRAW.sprocket * Math.sin(a), 0), m(.004), 'metal', ring);
  }
  const chain = lineObject(131, COLORS.truth, frame);
  const chainMarker = kit.sphere(m(.012), [0, 0, 0], 'red', frame);

  const cranks = part('cranks', 'Cranks and pedals', 'Two cranks and their pedals on one axle. The legs push the pedals at right angles to the cranks, and the longer the crank, the more torque the same push gives. Drawn at true size.', [0, 0, 0], body);
  const crankArms = [1, -1].map(() => rod(DRAW.crankRadius, 'metal', cranks));
  const pedals = [1, -1].map(() => kit.box(DRAW.pedal.map(m), [0, 0, 0], 'ink', cranks));

  const rider = part('rider', 'Rider', `An assigned rider: ${fixed(RIDER.mass, 1)} kg, legs ${fixed(RIDER.inseam * 1000, 0)} mm from crotch to floor. The legs are drawn to that length, straight when a pedal is at the bottom; the body, arms and head are drawn to rough proportions.`, [0, 0, 0], body);
  const trunk = kit.box(DRAW.trunk.map(m), [0, 0, 0], 'blue', rider);
  const neck = kit.cylinder(m(0.045), m(DRAW.neck), [0, 0, 0], 'cream', rider);
  const head = kit.sphere(m(DRAW.head), [0, 0, 0], 'cream', rider);
  const arms = [1, -1].map(() => [rod(DRAW.arm, 'blue', rider), rod(DRAW.arm * 0.85, 'cream', rider)]);
  const legs = [1, -1].map(() => [rod(DRAW.limb, 'ink', rider), rod(DRAW.limb * 0.8, 'ink', rider)]);
  paint([trunk, ...arms.map(arm => arm[0])], COLORS.shirt);
  paint([neck, head, ...arms.map(arm => arm[1])], COLORS.skin);
  paint(legs.flat(), COLORS.trousers);

  // The center of mass, the pendulum it makes with the tire, and what the rider has noticed.
  const center = part('center', 'Center of mass', `Gold ring: the assigned point-mass location, ${fixed((RIDER.trochanter + RIDER.aboveTrochanter - RIDER.inseam) * 1000, 0)} mm above the saddle. Ink line: from the tire’s contact with the ground to the center of mass, the pendulum that must be kept up. Blue line: the same, leaning as far as the rider has noticed, one reaction delay late.`, [0, 0, 0], system);
  const centerRing = kit.ring(m(0.035), m(0.008), [0, 0, 0], 'gold', center);
  const pendulum = lineObject(2, COLORS.truth, center), noticed = lineObject(2, COLORS.sensed, center);

  const push = part('push', 'Pushes', `Orange: a foot’s push on a pedal, at right angles to the crank, ${fixed(DRAW.perNewton * 1000, 0)} m long for every 1,000 N. Steel: the ground’s push on the tire along the ground, on the same scale.`, [0, 0, 0], system);
  const pedalArrow = solidArrow(kit, COLORS.push, push, m(DRAW.arrow)), groundArrow = solidArrow(kit, COLORS.steel, push, m(DRAW.arrow));

  const plots = createUnicycleCharts(kit, system, M);

  control('rider', 'Rider', ...UNICYCLE_DOMAINS.rider, UNICYCLE_DEFAULTS.rider, '', 'Assigned controller or locked relative crank angle. Speed and delay settings do not affect the locked-crank mode.', RIDER_OPTIONS.map(({value, label}) => ({value, label})));
  control('lean', 'Starting lean', ...UNICYCLE_DOMAINS.lean, UNICYCLE_DEFAULTS.lean, '°', 'How far forward the rider leans as the run starts, before they notice it.');
  control('speed', 'Speed wanted', ...UNICYCLE_DOMAINS.speed, UNICYCLE_DEFAULTS.speed, 'm/s', 'The speed the rider sets out to ride at, from rest.');
  control('delay', 'Reaction delay', ...UNICYCLE_DOMAINS.delay, UNICYCLE_DEFAULTS.delay, 'ms', 'How long after the unicycle leans the legs answer it.');
  control('seat', 'Saddle', ...UNICYCLE_DOMAINS.seat, UNICYCLE_DEFAULTS.seat, '', 'Assigned saddle heights, with the crank axle kept within leg reach. Giraffe variants use an equal-sprocket chain drive.', SEAT_OPTIONS.map(({value, label}) => ({value, label})));
  control('wheel', 'Wheel', ...UNICYCLE_DOMAINS.wheel, UNICYCLE_DEFAULTS.wheel, '', 'Assigned outer tire diameter, not a manufacturer’s nominal size.', WHEEL_OPTIONS.map(({value, label}) => ({value, label})));
  control('crank', 'Crank length', ...UNICYCLE_DOMAINS.crank, UNICYCLE_DEFAULTS.crank, 'mm', 'From the axle to the pedal: the longer the crank, the more torque the same push gives.');

  // What changes only with the settings: the charts, the wheel shown, the frame and the rider's body.
  let chartKey = '';
  const redraw = plan => {
    const key = JSON.stringify(plan.values);
    if (key === chartKey) return;
    chartKey = key;
    const {values, body: b} = plan;
    wheels.forEach((group, i) => { group.visible = i === values.wheel; });
    const top = b.seat - b.r, crankY = b.crankAxle - b.r, crown = Math.min(DRAW.crown, top - 0.15);
    forks.forEach((fork, i) => { const z = (i ? -1 : 1) * DRAW.fork; stretch(fork, [0, 0, z], [0, crown, z]); });
    stretch(crownBridge, [0, crown, -DRAW.fork], [0, crown, DRAW.fork]);
    stretch(post, [0, crown, 0], [0, top - DRAW.saddle[1], 0]);
    saddle.position.set(...at(0.02, top - DRAW.saddle[1] / 2, 0));
    bearing.visible = b.giraffe;
    bearing.position.set(...at(0, crankY, 0));
    sprockets.forEach((ring, i) => { ring.visible = b.giraffe; ring.position.set(...at(0, i ? crankY : 0, DRAW.chainZ)); });
    const loop = 2 * crankY + 2 * Math.PI * DRAW.sprocket;
    fill(chain, b.giraffe ? Array.from({length: 131}, (_, i) => [...chainPoint(loop * i / 130, crankY), DRAW.chainZ]) : []);
    chainMarker.visible = b.giraffe;
    crankArms.forEach((arm, i) => { const side = i ? -1 : 1; stretch(arm, [0, 0, side * DRAW.crankZ], [side * b.crank, 0, side * DRAW.crankZ]); });
    pedals.forEach((pedal, i) => { const side = i ? -1 : 1; pedal.position.set(...at(side * b.crank, 0, side * DRAW.pedalZ)); });
    trunk.position.set(...at(0, top + DRAW.trunk[1] / 2, 0));
    neck.position.set(...at(0, top + DRAW.trunk[1] + DRAW.neck / 2, 0));
    head.position.set(...at(0, top + DRAW.headTop - DRAW.head, 0));
    arms.forEach(([upper, lower], i) => {
      const side = i ? -1 : 1, joint = ([x, y, z]) => [x, top + y, side * z];
      stretch(upper, joint(DRAW.shoulder), joint(DRAW.elbow));
      stretch(lower, joint(DRAW.elbow), joint(DRAW.hand));
    });
  };

  let clock = 0, lastClock = 0, disposed = false;
  const leanText = degrees => (Math.abs(degrees) < 0.005 ? 'upright' : `${fixed(Math.abs(degrees), 2)}° ${degrees > 0 ? 'forward' : 'back'}`);
  const speedText = speed => (Math.abs(speed) < 0.005 ? 'still' : `${fixed(Math.abs(speed), 2)} m/s ${speed > 0 ? 'forward' : 'backward'}`);
  const result = finish(values => {
    const plan = unicyclePlan(values);
    clock = Math.min(clock, plan.fell === null ? RUN.duration : Math.ceil(plan.fell / plan.dt) * plan.dt);
    const now = unicycleAt(plan, clock), b = plan.body, settings = plan.values, theta = now.lean * DEG;
    redraw(plan);

    wheel.position.set(...at(0, b.r, 0));
    wheel.rotation.z = -now.wheel;
    body.position.set(...at(0, b.r, 0));
    body.rotation.z = -theta;
    cranks.position.set(...at(0, b.crankAxle - b.r, 0));
    cranks.rotation.z = -now.crank;
    pedals.forEach(pedal => { pedal.rotation.z = now.wheel; });
    sprockets.forEach(ring => { ring.rotation.z = -now.crank; });
    chainMarker.position.set(...at(...chainPoint(DRAW.sprocket * now.crank, b.crankAxle - b.r), DRAW.chainZ));

    // The legs, from the hips on the saddle to the pedals.
    const hip = [0, b.seat - b.r], feet = pedalsAt(b, now.crank), knees = feet.map(foot => kneeAt(hip, foot));
    legs.forEach(([thigh, shin], i) => {
      const side = i ? -1 : 1;
      stretch(thigh, [hip[0], hip[1], side * DRAW.legZ], [knees[i][0], knees[i][1], side * DRAW.legZ]);
      stretch(shin, [knees[i][0], knees[i][1], side * DRAW.legZ], [feet[i][0], feet[i][1], side * DRAW.pedalZ]);
    });

    // The ground's marks slide back by the distance rolled.
    const ticks = [];
    for (let k = Math.ceil((GROUND.from + now.travel) / GROUND.tick - 1e-9); k * GROUND.tick - now.travel <= GROUND.to + 1e-9; k++) {
      const x = k * GROUND.tick - now.travel;
      ticks.push([x, 0, 0], [x, -GROUND.mark, 0]);
    }
    fill(groundTicks, ticks);
    const start = -now.travel;
    fill(startMark, start >= GROUND.from && start <= GROUND.to ? [[start, 0, 0], [start, -1.5 * GROUND.mark, 0]] : []);

    // The center of mass on its pendulum, and where the rider has noticed it.
    const com = bodyToGround(b.r, theta, [0, b.l]);
    centerRing.position.set(...at(com[0], com[1], DRAW.centerZ));
    fill(pendulum, [[0, 0, DRAW.centerZ], [com[0], com[1], DRAW.centerZ]]);
    const seen = now.sensed === null ? null : bodyToGround(b.r, now.sensed * DEG, [0, b.l]);
    fill(noticed, seen ? [[0, 0, DRAW.centerZ], [seen[0], seen[1], DRAW.centerZ]] : []);

    // The foot's push on a pedal and the ground's push on the tire, on one scale.
    const {pick, direction} = pedalPush(now.torque, now.wheel), force = Math.abs(now.torque) / b.crank, length = force * DRAW.perNewton;
    const tip = bodyToGround(b.r, theta, feet[pick]);
    pedalArrow.userData.setDirection(new THREE.Vector3(direction[0], direction[1], 0));
    pedalArrow.userData.setLength(m(length));
    pedalArrow.position.set(...at(tip[0] - direction[0] * length, tip[1] - direction[1] * length, DRAW.arrowZ));
    const shove = Math.abs(now.ground) * DRAW.perNewton, sign = now.ground < 0 ? -1 : 1;
    groundArrow.userData.setDirection(new THREE.Vector3(sign, 0, 0));
    groundArrow.userData.setLength(m(shove));
    groundArrow.position.set(...at(-sign * shove, DRAW.groundY, DRAW.groundZ));

    const chartRanges = plots.update(plan, now.t);

    const done = clock >= RUN.duration || now.fallen, crank = fixed(settings.crank, 0);
    const outcome = plan.fell !== null ? `Stopped at ${fixed(plan.fell, 2)} s · lean reached ${fixed(RUN.fall, 0)}°` : `Stayed up for 10 s · leaned at most ${fixed(Math.abs(plan.peakLean), 2)}° and rolled ${fixed(plan.endTravel, 2)} m`;
    return {
      state: {...plan, now, clock, chartRanges, com, seen, hip, feet, knees, pick, direction, force, tip, ticks: ticks.length / 2},
      readings: [
        r('Your result', clock <= 0 ? `Ready · ${RIDER_OPTIONS[settings.rider].label.toLowerCase()}; press Play` : done ? outcome : `${fixed(now.t, 2)} s · leaning ${leanText(now.lean)} · ${speedText(now.speed)}`),
        r('Lean', leanText(now.lean), `With locked cranks near upright, the characteristic growth time is ${fixed(1 / b.w, 2)} s. From rest the small-angle lean follows cosh(t / growth time), not a pure exponential. Assigned center of mass: ${fixed(b.height, 2)} m up.`),
        r('Rider', settings.rider === 1 ? 'Holds the cranks still' : now.fallen ? 'Reached lean limit' : now.t < settings.delay / 1000 ? 'Has noticed nothing yet' : `Senses ${leanText(now.sensed)}`, settings.rider === 1 ? 'The legs keep the cranks still against the body, so the wheel turns only as the whole unicycle tips.' : `The assigned controller uses readings ${fixed(settings.delay, 0)} ms old. Its linearized upright equilibrium loses stability near ${fixed(plan.critical * 1000, 0)} ms. This is a local, unsaturated calculation; a large lean can fail below that delay. Delay is a chosen whole-loop parameter, not a measured human response time.`),
        r('Pedals', now.fallen ? 'Not evaluated after stop' : `${fixed(Math.abs(now.torque), 1)} N·m of at most ${fixed(b.cap, 1)} N·m${now.clamped ? ' · at the limit' : ''}`, `${now.fallen ? 'The simulation has stopped; force arrows are hidden. ' : ''}The legs push with at most the rider’s weight, ${fixed(b.weight, 0)} N, at right angles to a ${crank} mm crank. The hardest moment of this run took ${fixed(plan.peakTorque, 1)} N·m${plan.clampTime > 0 ? `, and the legs were at their limit for ${fixed(plan.clampTime * 1000, 0)} ms` : ''}.`),
        r('Wheel', `${now.fallen ? 'Stopped at lean limit' : speedText(now.speed)} · ${Math.abs(now.travel) < 0.005 ? 'at the start' : `${fixed(Math.abs(now.travel), 2)} m ${now.travel > 0 ? 'ahead of' : 'behind'} the start`}`, `A ${fixed(WHEELS[settings.wheel], 0)}-inch wheel rolls ${fixed(b.perTurn, 3)} m per ground-frame wheel turn; at a steady 16 km/h they would turn ${fixed(16 / 3.6 / b.perTurn * 60, 0)} times a minute.${settings.speed > 0 ? ` Setting off, the wheel first rolled back ${fixed(-plan.rollback * 100, 1)} cm.` : ''}`),
        r('Unicycle', `${b.giraffe ? 'Giraffe' : 'Standard'} · saddle ${fixed(b.seat, 2)} m up`, `The rider’s center of mass is ${fixed(b.above * 1000, 0)} mm above the saddle, ${fixed(b.height, 2)} m above the ground. ${b.giraffe ? 'A chain carries the cranks’ turning down to the wheel.' : 'The cranks are fixed to the wheel’s axle.'}`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(RUN.duration, clock + dt / SLOW); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = (initial = {}) => { clock = Number.isFinite(initial.time) ? Math.max(0, initial.time) : 0; lastClock = 0; return render({...result.defaults, ...(initial.settings || {})}); };
  result.replayState = () => ({settings: result.getState().values, time: 0});
  result.actions = [['Inspect: complete experiment', 'system'], ['Inspect: wheel and axle', 'wheel'], ['Inspect: frame and saddle', 'frame'], ['Inspect: cranks and pedals', 'cranks'], ['Inspect: rider', 'rider'], ['Inspect: center of mass', 'center'], ['Inspect: forces', 'push'], ['Read: lean and delayed lean', 'lean'], ['Read: speed and target', 'speed'], ['Read: pedal torque', 'torque']].map(([label, part]) => ({label, part, view: 'front', isolate: true, replay: false, run: () => result.update()}));
  result.playback = {
    label: 'Ride',
    description: 'Up to 10 simulated seconds at half speed. Stops at the first sample crossing 45°; a crash or dismount is not simulated.',
    stepLabel: 'Advance 10 ms',
    advance: result.advance,
    step: () => result.advance(0.01 * SLOW),
    complete: () => { const state = result.getState(); return clock >= RUN.duration || (state.fell !== null && clock >= state.fell); },
    blocked: () => false,
  };

  root.rotation.set(0, 0, 0);
  result.initialPart = result.autoFramePart = 'system';
  result.initialIsolated = true;
  result.partViewDirections = {};
  for (const p of result.parts) {
    result.partViewDirections[p.id] = {front: ['lean', 'speed', 'torque'].includes(p.id) ? [0, 0, 3] : [.3, .25, 3]};
    p.framePadding = .7; p.maxZoom = 300;
  }
  for (const object of [ground, rider, center, push]) object.userData.explosionExcluded = true;
  for (const object of [wheel, frame, cranks]) object.userData.explosionCategory = true;
  result.controls.find(c => c.key === 'rider').primary = true;
  result.controls.find(c => c.key === 'seat').primary = true;
  result.thumbnailOmit = [ground, rider, center, push, ...Object.values(plots.charts).map(c => c.object)];
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  const {lean: leanPlot, speed: speedPlot, torque: torquePlot} = plots.charts;
  result.topology = {system, ground, groundTicks, startMark, wheel, wheels, body, frame, forks, post, crownBridge, saddle, bearing, sprockets, chain, chainMarker, cranks, crankArms, pedals, rider, trunk, neck, head, arms, legs, center, centerRing, pendulum, noticed, push, pedalArrow, groundArrow, plots, leanChart: leanPlot.object, leanLine: leanPlot.line, sensedLine: leanPlot.second, leanCursor: leanPlot.cursor, speedChart: speedPlot.object, speedLine: speedPlot.line, goalLine: speedPlot.second, speedCursor: speedPlot.cursor, torqueChart: torquePlot.object, torqueLine: torquePlot.line, capLines: torquePlot.second, torqueCursor: torquePlot.cursor, M, SLOW};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

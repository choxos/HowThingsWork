import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, solidArrow} from './scene-kit.js';
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
export const GROUND = Object.freeze({from: -1, to: 3.2, tick: 0.5, mark: 0.06});
export const CHARTS = Object.freeze({
  z: -0.5, every: 20,
  lean: Object.freeze({x: 1.3, y: 2, w: 1.8, h: 0.75, range: 20}),
  speed: Object.freeze({x: 1.3, y: 1.1, w: 1.8, h: 0.75, v0: -1, v1: 3}),
  torque: Object.freeze({x: 1.3, y: 0.2, w: 1.8, h: 0.75, range: 150}),
});
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

export const chartX = (box, t) => box.x + t / RUN.duration * box.w;
export const leanY = degrees => CHARTS.lean.y + CHARTS.lean.h / 2 + Math.max(-CHARTS.lean.range, Math.min(CHARTS.lean.range, degrees)) / CHARTS.lean.range * CHARTS.lean.h / 2;
export const speedY = speed => CHARTS.speed.y + (Math.max(CHARTS.speed.v0, Math.min(CHARTS.speed.v1, speed)) - CHARTS.speed.v0) / (CHARTS.speed.v1 - CHARTS.speed.v0) * CHARTS.speed.h;
export const torqueY = torque => CHARTS.torque.y + CHARTS.torque.h / 2 + Math.max(-CHARTS.torque.range, Math.min(CHARTS.torque.range, torque)) / CHARTS.torque.range * CHARTS.torque.h / 2;

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
  const chartLine = (line, points) => fill(line, points.map(([x, y]) => [x, y, CHARTS.z]));
  const rod = (radius, color, parent) => kit.cylinder(m(radius), 1, [0, 0, 0], color, parent);
  const stretch = (mesh, a, b) => {
    const A = new THREE.Vector3(...at(...a)), B = new THREE.Vector3(...at(...b)), d = B.clone().sub(A), length = d.length();
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.scale.set(1, Math.max(1e-6, length), 1);
    if (length > 1e-12) mesh.quaternion.setFromUnitVectors(Y, d.normalize());
  };

  const system = part('system', 'Unicycle, rider and charts', 'A rider on a unicycle seen from the side, with three charts. The unicycle stays in the middle of the picture while the ground slides back under it. Set a starting lean, a reaction delay or a speed and press Play.', [0, 0, 0]);

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
    kit.box([m(DRAW.valve), m(DRAW.valve), m(DRAW.valve)], at(0, rim - DRAW.valve, 0.02), 'red', group);
    return group;
  });

  // The frame, the cranks and the rider lean together about the axle.
  const body = new THREE.Group();
  system.add(body);
  const frame = part('frame', 'Frame and saddle', 'The fork, the seat post and the saddle, leaning with the rider. On a standard unicycle the cranks are fixed to the wheel’s axle; on a giraffe a chain carries their turning down to the wheel, one turn for one turn. Drawn at true size.', [0, 0, 0], body);
  const forks = [1, -1].map(() => rod(DRAW.forkRadius, 'metal', frame));
  const post = rod(DRAW.post, 'metal', frame);
  const saddle = kit.box(DRAW.saddle.map(m), [0, 0, 0], 'ink', frame);
  const bearing = kit.disk(m(DRAW.bearing), m(0.2), [0, 0, 0], 'metal', frame);
  const sprockets = [0, 1].map(() => kit.ring(m(DRAW.sprocket), m(0.006), [0, 0, 0], 'metal', frame));
  const chain = segments(2, COLORS.truth, frame);

  const cranks = part('cranks', 'Cranks and pedals', 'Two cranks and their pedals on one axle. The legs push the pedals at right angles to the cranks, and the longer the crank, the more torque the same push gives. Drawn at true size.', [0, 0, 0], body);
  const crankArms = [1, -1].map(() => rod(DRAW.crankRadius, 'metal', cranks));
  const pedals = [1, -1].map(() => kit.box(DRAW.pedal.map(m), [0, 0, 0], 'ink', cranks));

  const rider = part('rider', 'Rider', `A rider of the mean size of the 6,068 US Army personnel measured in ANSUR II: ${fixed(RIDER.mass, 1)} kg, legs ${fixed(RIDER.inseam * 1000, 0)} mm from crotch to floor. The legs are drawn to that length, straight when a pedal is at the bottom; the body, arms and head are drawn to rough proportions.`, [0, 0, 0], body);
  const trunk = kit.box(DRAW.trunk.map(m), [0, 0, 0], 'blue', rider);
  const neck = kit.cylinder(m(0.045), m(DRAW.neck), [0, 0, 0], 'cream', rider);
  const head = kit.sphere(m(DRAW.head), [0, 0, 0], 'cream', rider);
  const arms = [1, -1].map(() => [rod(DRAW.arm, 'blue', rider), rod(DRAW.arm * 0.85, 'cream', rider)]);
  const legs = [1, -1].map(() => [rod(DRAW.limb, 'ink', rider), rod(DRAW.limb * 0.8, 'ink', rider)]);
  paint([trunk, ...arms.map(arm => arm[0])], COLORS.shirt);
  paint([neck, head, ...arms.map(arm => arm[1])], COLORS.skin);
  paint(legs.flat(), COLORS.trousers);

  // The center of mass, the pendulum it makes with the tire, and what the rider has noticed.
  const center = part('center', 'Center of mass', `Gold ring: the rider’s center of mass, ${fixed((RIDER.trochanter + RIDER.aboveTrochanter - RIDER.inseam) * 1000, 0)} mm above the saddle. Ink line: from the tire’s contact with the ground to the center of mass, the pendulum that must be kept up. Blue line: the same, leaning as far as the rider has noticed, one reaction delay late.`, [0, 0, 0], system);
  const centerRing = kit.ring(m(0.035), m(0.008), [0, 0, 0], 'gold', center);
  const pendulum = lineObject(2, COLORS.truth, center), noticed = lineObject(2, COLORS.sensed, center);

  const push = part('push', 'Pushes', `Orange: a foot’s push on a pedal, at right angles to the crank, ${fixed(DRAW.perNewton * 1000, 0)} m long for every 1,000 N. Steel: the ground’s push on the tire along the ground, on the same scale.`, [0, 0, 0], system);
  const pedalArrow = solidArrow(kit, COLORS.push, push, m(DRAW.arrow)), groundArrow = solidArrow(kit, COLORS.steel, push, m(DRAW.arrow));

  // The charts, in a plane behind the unicycle.
  const chart = (id, label, description) => part(id, label, description, [0, 0, 0], system);
  const frameBox = (box, parent) => chartLine(lineObject(5, COLORS.truth, parent), [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h], [box.x, box.y]]);
  const L = CHARTS.lean, S = CHARTS.speed, T = CHARTS.torque, samples = Math.round(RUN.duration / RUN.step / CHARTS.every) + 1;

  const leanChart = chart('lean', 'Lean over time', `The lean over the ${fixed(RUN.duration, 0)} s run, from ${fixed(L.range, 0)}° back at the bottom to ${fixed(L.range, 0)}° forward at the top. Ink: the lean. Blue: the lean the rider has noticed, one reaction delay late. Faint line: upright.`);
  frameBox(L, leanChart);
  chartLine(lineObject(2, COLORS.faint, leanChart), [[L.x, leanY(0)], [L.x + L.w, leanY(0)]]);
  const leanLine = lineObject(samples, COLORS.truth, leanChart), sensedLine = lineObject(samples, COLORS.sensed, leanChart), leanCursor = lineObject(2, COLORS.truth, leanChart);

  const speedChart = chart('speed', 'Speed over time', `The wheel’s speed over the run, from ${fixed(-S.v0, 0)} m/s backward at the bottom to ${fixed(S.v1, 0)} m/s forward at the top. Ink: the speed. Gold: the speed the rider wants. Faint line: standing still.`);
  frameBox(S, speedChart);
  chartLine(lineObject(2, COLORS.faint, speedChart), [[S.x, speedY(0)], [S.x + S.w, speedY(0)]]);
  const speedLine = lineObject(samples, COLORS.truth, speedChart), goalLine = lineObject(2, COLORS.goal, speedChart), speedCursor = lineObject(2, COLORS.truth, speedChart);

  const torqueChart = chart('torque', 'Pedal torque over time', `The legs’ torque on the wheel over the run, ${fixed(T.range, 0)} N·m either way from the middle line, forward up. Ink: the torque. Clay lines: the most a push of the rider’s weight gives on these cranks, either way.`);
  frameBox(T, torqueChart);
  chartLine(lineObject(2, COLORS.faint, torqueChart), [[T.x, torqueY(0)], [T.x + T.w, torqueY(0)]]);
  const torqueLine = lineObject(samples, COLORS.truth, torqueChart), capLines = segments(2, COLORS.cap, torqueChart), torqueCursor = lineObject(2, COLORS.truth, torqueChart);

  control('rider', 'Rider', ...UNICYCLE_DOMAINS.rider, UNICYCLE_DEFAULTS.rider, '', 'Whether the rider pedals to stay upright or holds the cranks still.', RIDER_OPTIONS.map(({value, label}) => ({value, label})));
  control('lean', 'Starting lean', ...UNICYCLE_DOMAINS.lean, UNICYCLE_DEFAULTS.lean, '°', 'How far forward the rider leans as the run starts, before they notice it.');
  control('speed', 'Speed wanted', ...UNICYCLE_DOMAINS.speed, UNICYCLE_DEFAULTS.speed, 'm/s', 'The speed the rider sets out to ride at, from rest.');
  control('delay', 'Reaction delay', ...UNICYCLE_DOMAINS.delay, UNICYCLE_DEFAULTS.delay, 'ms', 'How long after the unicycle leans the legs answer it.');
  control('seat', 'Saddle', ...UNICYCLE_DOMAINS.seat, UNICYCLE_DEFAULTS.seat, '', 'A standard unicycle with its saddle set for the rider’s legs, or a taller giraffe driven by a chain.', SEAT_OPTIONS.map(({value, label}) => ({value, label})));
  control('wheel', 'Wheel', ...UNICYCLE_DOMAINS.wheel, UNICYCLE_DEFAULTS.wheel, '', 'The wheel’s size, across the tire.', WHEEL_OPTIONS.map(({value, label}) => ({value, label})));
  control('crank', 'Crank length', ...UNICYCLE_DOMAINS.crank, UNICYCLE_DEFAULTS.crank, 'mm', 'From the axle to the pedal: the longer the crank, the more torque the same push gives.');

  // What changes only with the settings: the charts, the wheel shown, the frame and the rider's body.
  let chartKey = '';
  const redraw = plan => {
    const key = JSON.stringify(plan.values);
    if (key === chartKey) return;
    chartKey = key;
    const {values, body: b, lean, torque, spin, fell, lag, dt} = plan;
    const last = fell === null ? plan.N : Math.min(plan.N, Math.floor(fell / dt));
    const steps = Array.from({length: Math.floor(last / CHARTS.every) + 1}, (_, i) => i * CHARTS.every);
    chartLine(leanLine, steps.map(k => [chartX(L, k * dt), leanY(lean[k] / DEG)]));
    chartLine(sensedLine, values.rider === 1 ? [] : steps.map(k => [chartX(L, k * dt), leanY(k >= lag ? lean[k - lag] / DEG : 0)]));
    chartLine(speedLine, steps.map(k => [chartX(S, k * dt), speedY(spin[k] * b.r)]));
    chartLine(goalLine, [[S.x, speedY(values.speed)], [S.x + S.w, speedY(values.speed)]]);
    chartLine(torqueLine, steps.map(k => [chartX(T, k * dt), torqueY(torque[k])]));
    chartLine(capLines, [[T.x, torqueY(b.cap)], [T.x + T.w, torqueY(b.cap)], [T.x, torqueY(-b.cap)], [T.x + T.w, torqueY(-b.cap)]]);

    wheels.forEach((group, i) => { group.visible = i === values.wheel; });
    const top = b.seat - b.r, crankY = b.crankAxle - b.r, crown = Math.min(DRAW.crown, top - 0.15);
    forks.forEach((fork, i) => { const z = (i ? -1 : 1) * DRAW.fork; stretch(fork, [0, 0, z], [0, crown, z]); });
    stretch(post, [0, crown, 0], [0, top - DRAW.saddle[1], 0]);
    saddle.position.set(...at(0.02, top - DRAW.saddle[1] / 2, 0));
    bearing.visible = b.giraffe;
    bearing.position.set(...at(0, crankY, 0));
    sprockets.forEach((ring, i) => { ring.visible = b.giraffe; ring.position.set(...at(0, i ? crankY : 0, DRAW.chainZ)); });
    fill(chain, b.giraffe ? [[-DRAW.sprocket, 0, DRAW.chainZ], [-DRAW.sprocket, crankY, DRAW.chainZ], [DRAW.sprocket, 0, DRAW.chainZ], [DRAW.sprocket, crankY, DRAW.chainZ]] : []);
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
    const plan = unicyclePlan(values), now = unicycleAt(plan, clock), b = plan.body, settings = plan.values, theta = now.lean * DEG;
    redraw(plan);

    wheel.position.set(...at(0, b.r, 0));
    wheel.rotation.z = -now.wheel;
    body.position.set(...at(0, b.r, 0));
    body.rotation.z = -theta;
    cranks.position.set(...at(0, b.crankAxle - b.r, 0));
    cranks.rotation.z = -now.crank;
    pedals.forEach(pedal => { pedal.rotation.z = now.wheel; });

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

    for (const [cursor, box] of [[leanCursor, L], [speedCursor, S], [torqueCursor, T]]) chartLine(cursor, [[chartX(box, now.t), box.y], [chartX(box, now.t), box.y + box.h]]);

    const done = clock >= RUN.duration || now.fallen, crank = fixed(settings.crank, 0);
    const outcome = plan.fell !== null ? `Fell ${fixed(plan.fell, 2)} s in, leaning past ${fixed(RUN.fall, 0)}°` : `Stayed up · leaned at most ${fixed(Math.abs(plan.peakLean), 2)}° and rolled ${fixed(plan.endTravel, 2)} m`;
    return {
      state: {...plan, now, clock, com, seen, hip, feet, knees, pick, direction, force, tip, ticks: ticks.length / 2},
      readings: [
        r('Your result', clock <= 0 ? `Ready · ${RIDER_OPTIONS[settings.rider].label.toLowerCase()}; press Play` : done ? outcome : `${fixed(now.t, 2)} s · leaning ${leanText(now.lean)} · ${speedText(now.speed)}`),
        r('Lean', leanText(now.lean), `Holding the cranks still, the lean would grow e times every ${fixed(1 / b.w, 2)} s: the unicycle and rider tip as one body on the tire, with the center of mass ${fixed(b.height, 2)} m up.`),
        r('Rider', settings.rider === 1 ? 'Holds the cranks still' : now.fallen ? 'Could not catch the lean' : now.t < settings.delay / 1000 ? 'Has noticed nothing yet' : `Senses ${leanText(now.sensed)}`, settings.rider === 1 ? 'The legs keep the cranks still against the body, so the wheel turns only as the whole unicycle tips.' : `The legs answer what the rider sensed ${fixed(settings.delay, 0)} ms ago. These reflexes keep this unicycle up for delays under ${fixed(plan.critical * 1000, 0)} ms, and no reflexes to the lean and its rate alone could keep it up with a delay of ${fixed(plan.limit * 1000, 0)} ms or more. A simple reaction to something seen takes about 190 ms.`),
        r('Pedals', `${fixed(Math.abs(now.torque), 1)} N·m of at most ${fixed(b.cap, 1)} N·m${now.clamped ? ' · at the limit' : ''}`, `The legs push with at most the rider’s weight, ${fixed(b.weight, 0)} N, at right angles to a ${crank} mm crank. The hardest moment of this run took ${fixed(plan.peakTorque, 1)} N·m${plan.clampTime > 0 ? `, and the legs were at their limit for ${fixed(plan.clampTime * 1000, 0)} ms` : ''}.`),
        r('Wheel', `${now.fallen ? 'Fell' : speedText(now.speed)} · ${Math.abs(now.travel) < 0.005 ? 'at the start' : `${fixed(Math.abs(now.travel), 2)} m ${now.travel > 0 ? 'ahead of' : 'behind'} the start`}`, `A ${fixed(WHEELS[settings.wheel], 0)}-inch wheel rolls ${fixed(b.perTurn, 3)} m for each turn of the cranks; at 16 km/h they would turn ${fixed(16 / 3.6 / b.perTurn * 60, 0)} times a minute.${settings.speed > 0 ? ` Setting off, the wheel first rolled back ${fixed(-plan.rollback * 100, 1)} cm.` : ''}`),
        r('Unicycle', `${b.giraffe ? 'Giraffe' : 'Standard'} · saddle ${fixed(b.seat, 2)} m up`, `The rider’s center of mass is ${fixed(b.above * 1000, 0)} mm above the saddle, ${fixed(b.height, 2)} m above the ground. ${b.giraffe ? 'A chain carries the cranks’ turning down to the wheel.' : 'The cranks are fixed to the wheel’s axle.'}`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(RUN.duration, clock + dt / SLOW); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the legs and cranks', part: 'cranks', view: 'front', replay: false, run() { clock = 0; return render(); }},
    {label: 'Inspect: the center of mass', part: 'center', view: 'front', replay: false, run() { clock = 0.3; return render(); }},
    {label: 'Inspect: the lean', part: 'lean', view: 'front', replay: false, run() { clock = RUN.duration; return render(); }},
    {label: 'Inspect: the pedal torque', part: 'torque', view: 'front', replay: false, run() { clock = RUN.duration; return render(); }},
  ];
  result.playback = {
    label: 'Ride',
    description: 'The rider rides for 10 s, played at half speed.',
    stepLabel: 'Advance 10 ms',
    advance: result.advance,
    step: () => result.advance(0.01 * SLOW),
    complete: () => { const state = result.getState(); return clock >= RUN.duration || (state.fell !== null && clock >= state.fell); },
    blocked: () => false,
  };

  root.rotation.set(0.12, -0.32, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, ground, groundTicks, startMark, wheel, wheels, body, frame, forks, post, saddle, bearing, sprockets, chain, cranks, crankArms, pedals, rider, trunk, neck, head, arms, legs, center, centerRing, pendulum, noticed, push, pedalArrow, groundArrow, leanChart, leanLine, sensedLine, leanCursor, speedChart, speedLine, goalLine, speedCursor, torqueChart, torqueLine, capLines, torqueCursor, M, SLOW};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

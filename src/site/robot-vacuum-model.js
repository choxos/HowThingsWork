import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, surface, chartText} from './scene-kit.js';
import {robotPlan, sampleRobot, ROBOT, ROOM, FURNITURE, START, STRATEGY_OPTIONS, ROOM_OPTIONS, ROBOT_DEFAULTS, ROBOT_DOMAINS, SPIN_RATE, RUN_WATTS, GRID} from './robot-vacuum-physics.js';

// ---------------------------------------------------------------------------
// Robot vacuum cleaner: a round robot in a 4 m by 3 m room seen from above,
// the floor shaded by where it has swept, with the three strategies' coverage
// raced side by side.
//
// Scale: one millimeter is 0.0008 scene units for every length: the room, the
// robot 340 mm across with wheels 230 mm apart, the sofa and table, the dock.
// The floor is shown in the same 20 mm cells the coverage counts. Walls are
// drawn 100 mm tall and the near wall is cut away so the floor shows.
//
// Time: the 20 minutes play sixty times faster than real time. The side brush
// is drawn turning twice a second; the wheels are drawn turning with the
// distance driven.
//
// Colors: floor cells gray while dust remains, light once swept, darker where
// the robot can never reach. The trail shows the robot's last minute of path.
//
// Chart, on the floor to the right of the room, not to its scale: the share of
// reachable floor swept against time, 0 to 20 minutes across and 0 to 100% up,
// for random bounce (gray), spiral (gold) and rows then edges (red) in this
// room, with a dot on the chosen strategy's curve for now.
// ---------------------------------------------------------------------------

const MM = 0.0008;
const TAU = Math.PI * 2;
const SPEED_UP = 60;
const END = ROOM.duration;
const TRAIL = 300;
const WHEEL = 0.035;
export const CHART = Object.freeze({left: 4.4, bottom: 0.5, width: 1.8, height: 2.0});
export const SHADES = Object.freeze({dust: Object.freeze([154, 167, 173]), swept: Object.freeze([222, 196, 150]), unreachable: Object.freeze([111, 123, 128])});
/** Scene position of a point on the room's floor, x and y in meters, at a height in meters. */
export const roomPoint = (x, y, height = 0) => [(x - ROOM.width / 2) * 1000 * MM, height * 1000 * MM, (ROOM.depth / 2 - y) * 1000 * MM];
export const chartPoint = (seconds, share) => roomPoint(CHART.left + seconds / END * CHART.width, CHART.bottom + Math.max(0, Math.min(1, share)) * CHART.height, 0.002);
const meters = value => value * 1000 * MM;
const DOING = Object.freeze({
  bounce: 'Straight on until it bumps, then a turn of 100 to 260 degrees chosen at random.',
  spiral: 'Winding outward, its path one lane wider each turn.',
  rows: 'Back and forth across the room, shifting one lane at each wall.',
  follow: 'Keeping the wall on its right to sweep the edges.',
});

export function createRobotVacuumModel() {
  const kit = houseModel('Robot vacuum cleaner'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Robot vacuum cleaner', 'A round robot on two driven wheels that sweeps a room by itself, steering by bumping into things or by following rows and walls. Drawn at true size in a 4 by 3 m room, seen from above.', [0, 0, 0]);

  const floorPart = part('floor', 'Floor', 'The room’s floor, 4 m by 3 m, in 20 mm cells: gray where dust remains, light where the robot has swept, darker where a round robot can never reach.', [0, 0, 0], system);
  const {columns: nx, rows: ny} = GRID, data = new Uint8Array(nx * ny * 4), texture = new THREE.DataTexture(data, nx, ny, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  const plane = new THREE.PlaneGeometry(meters(ROOM.width), meters(ROOM.depth));
  plane.rotateX(-Math.PI / 2);
  const floor = surface(kit, plane, 'cream', floorPart);
  floor.material = floor.material.clone();
  floor.material.map = texture;
  floor.material.color.set(0xffffff);
  const wall = (x0, y0, x1, y1) => kit.box([meters(Math.max(Math.abs(x1 - x0), 0.05)), meters(0.1), meters(Math.max(Math.abs(y1 - y0), 0.05))], roomPoint((x0 + x1) / 2, (y0 + y1) / 2, 0.05), 'cream', floorPart);
  wall(-0.025, 0, -0.025, ROOM.depth);
  wall(ROOM.width + 0.025, 0, ROOM.width + 0.025, ROOM.depth);
  wall(0, ROOM.depth + 0.025, ROOM.width, ROOM.depth + 0.025);
  covers.push(wall(0, -0.025, ROOM.width, -0.025));

  const furniture = part('furniture', 'Sofa and table', 'A sofa 2 m by 0.9 m against the far wall, too low for the robot to pass under, and a table it drives beneath, bumping into its four legs 50 mm across.', [0, 0, 0], system);
  const sofa = FURNITURE[0];
  kit.box([meters(sofa.x1 - sofa.x0), meters(0.42), meters(sofa.y1 - sofa.y0)], roomPoint((sofa.x0 + sofa.x1) / 2, (sofa.y0 + sofa.y1) / 2, 0.21), 'clay', furniture);
  kit.box([meters(sofa.x1 - sofa.x0), meters(0.4), meters(0.2)], roomPoint((sofa.x0 + sofa.x1) / 2, sofa.y1 - 0.1, 0.62), 'clay', furniture);
  const legs = FURNITURE.filter(item => item.kind === 'leg').map(leg => kit.cylinder(meters(leg.r), meters(0.45), roomPoint(leg.x, leg.y, 0.225), 'wood', furniture));
  const tableTop = kit.box([meters(1.0), meters(0.03), meters(0.9)], roomPoint(3.0, 1.35, 0.465), 'wood', furniture);
  tableTop.material = tableTop.material.clone();
  tableTop.material.transparent = true;
  tableTop.material.opacity = 0.35;
  tableTop.material.depthWrite = false;

  const dock = part('dock', 'Charging dock', 'A low charging plate the robot starts on, with its tower against the near wall.', [0, 0, 0], system);
  kit.box([meters(0.3), meters(0.012), meters(0.2)], roomPoint(START.x, 0.1, 0.006), 'ink', dock);
  kit.box([meters(0.3), meters(0.1), meters(0.04)], roomPoint(START.x, -0.02, 0.05), 'ink', dock);

  const robotPart = part('robot', 'Robot', 'A disk 340 mm across and 90 mm tall. Two wheels 230 mm apart drive and steer it, a bumper around it feels contact, and a side brush sweeps dirt from the edges into the path of its main brush, together sweeping a band 280 mm wide.', [0, 0, 0], system);
  const robot = new THREE.Group();
  robotPart.add(robot);
  kit.cylinder(meters(ROBOT.radius), meters(0.09), [0, meters(0.055), 0], 'cream', robot);
  const bumper = kit.ring(meters(ROBOT.radius), meters(0.012), [0, meters(0.05), 0], 'ink', robot);
  bumper.rotation.x = Math.PI / 2;
  const wheels = [-1, 1].map(side => {
    const axle = new THREE.Group();
    axle.position.set(0, meters(WHEEL), side * meters(ROBOT.wheelBase / 2));
    robot.add(axle);
    const tire = kit.cylinder(meters(WHEEL), meters(0.02), [0, 0, 0], 'ink', axle);
    tire.rotation.x = Math.PI / 2;
    return axle;
  });
  const brush = new THREE.Group();
  brush.position.set(meters(0.13), meters(0.012), meters(0.09));
  robot.add(brush);
  for (let k = 0; k < 3; k++) kit.rod([0, 0, 0], [meters(0.06) * Math.cos(k * TAU / 3), 0, meters(0.06) * Math.sin(k * TAU / 3)], meters(0.003), 'ink', brush);
  kit.cylinder(meters(0.012), meters(0.01), [0, meters(0.105), 0], 'gold', robot);

  const trail = part('trail', 'Recent path', 'Where the robot’s center has been over the last minute.', [0, 0, 0], system);
  const path = lineObject(TRAIL, 0x2f6690, trail);

  const charts = part('charts', 'Coverage race', 'The share of reachable floor swept over 20 minutes by each strategy in this room: random bounce in gray, spiral in gold, rows then edges in red, with a dot for now. Not to the room’s scale.', [0, 0, 0], system);
  kit.rod(chartPoint(0, 0), chartPoint(END, 0), meters(0.01), 'ink', charts);
  kit.rod(chartPoint(0, 0), chartPoint(0, 1), meters(0.01), 'ink', charts);
  const curves = [0x9aa7ad, 0xe3b45e, 0xc14f39].map(color => lineObject(121, color, charts));
  chartText(charts, chartPoint, {
    title: 'Coverage race', size: meters(0.12),
    x: {min: 0, max: END, title: 'Minutes', ticks: [[0, '0'], [END / 2, String(END / 120)], [END, String(END / 60)]]},
    y: {min: 0, max: 1, title: 'Reachable floor swept', ticks: [[0, '0%'], [0.5, '50%'], [1, '100%']]},
    legend: [['Random bounce', 0x7a8b83], ['Spiral first', 0xb8862f], ['Rows, then edges', 0xc14f39]], legendAt: [END, 0.45],
  });
  const dot = kit.sphere(meters(0.03), [0, 0, 0], 'red', charts);

  control('strategy', 'How it cleans', ...ROBOT_DOMAINS.strategy, ROBOT_DEFAULTS.strategy, '', 'Bounce at random, spiral out first, or sweep rows and then the edges.', STRATEGY_OPTIONS.map(({value, label}) => ({value, label})));
  control('room', 'Room', ...ROBOT_DOMAINS.room, ROBOT_DEFAULTS.room, '', 'An empty room, or one with a sofa and a table.', ROOM_OPTIONS.map(({value, label}) => ({value, label})));

  let clock = 0, lastClock = 0, disposed = false, chartRoom = null;
  const result = finish(values => {
    const s = sampleRobot(values, clock), now = s.now, first = s.first, sweep = s.reach.sweep;
    furniture.visible = values.room === 1;
    for (let index = 0; index < first.length; index++) {
      data.set(first[index] <= clock ? SHADES.swept : sweep[index] ? SHADES.dust : SHADES.unreachable, index * 4);
      data[index * 4 + 3] = 255;
    }
    texture.needsUpdate = true;
    robot.position.set(...roomPoint(now.x, now.y));
    robot.rotation.y = now.h;
    wheels.forEach(axle => { axle.rotation.z = -now.distance / WHEEL; });
    brush.rotation.y = -TAU * 2 * (clock / SPEED_UP);
    const last = Math.floor(clock / ROOM.every + 1e-9), from = Math.max(0, last - TRAIL), positions = path.geometry.attributes.position.array;
    for (let index = from; index < last; index++) positions.set(roomPoint(s.path[index].x, s.path[index].y, 0.004), (index - from) * 3);
    path.geometry.setDrawRange(0, last - from);
    path.geometry.attributes.position.needsUpdate = true;
    path.geometry.computeBoundingSphere();

    if (values.room !== chartRoom) {
      chartRoom = values.room;
      curves.forEach((line, strategy) => {
        const plan = robotPlan({strategy, room: values.room}), array = line.geometry.attributes.position.array;
        for (let i = 0; i <= 120; i++) array.set(chartPoint(i * 10, plan.coverage[i * 10]), i * 3);
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
      });
    }
    dot.position.set(...chartPoint(s.clock, s.coverage));

    const left = now.leftWheel, right = now.rightWheel, slow = Math.min(Math.abs(left), Math.abs(right)), fast = Math.max(Math.abs(left), Math.abs(right));
    const wheelHint = left === 0 && right === 0 ? 'Both wheels at rest.'
      : left === -right ? `Opposite speeds spin it on the spot at ${fixed(SPIN_RATE * 180 / Math.PI, 1)}° a second.`
      : left === right ? (left > 0 ? 'Equal speeds drive it straight.' : 'Both wheels reverse to back it off.')
      : `Unequal speeds curve its path: the outer wheel runs ${fixed(fast / slow, 2)} times as fast as the inner.`;
    return {
      state: (({first, ...rest}) => rest)(s),
      readings: [
        r('Your result', clock === 0 ? 'Ready at its dock · press Play to clean for 20 minutes' : `${fixed(s.coverage * 100, 1)}% of the floor it can reach swept after ${clock < 60 ? `${fixed(clock, 0)} s` : `${fixed(clock / 60, 1)} min`}`),
        r('Doing now', clock === 0 ? 'waiting at the dock' : now.doing, DOING[now.mode]),
        r('Wheels', `left ${fixed(left, 2)} m/s, right ${fixed(right, 2)} m/s`, wheelHint),
        r('Bumps and distance', `${now.bumps} bumps, ${fixed(now.distance, 1)} m driven`, clock > 0 ? `${fixed(now.distance / clock, 2)} m/s on average, turning and backing off included.` : 'Nothing driven yet.'),
        r('Out of reach', `${fixed((1 - s.reach.sweepCount / s.reach.floorCount) * 100, 1)}% of the open floor`, 'Corners a round robot cannot get into, and the 10 mm it keeps clear of walls and furniture.'),
        r('Battery', `${fixed(s.battery * 100, 1)}% left`, `About ${fixed(s.minutesLeft, 0)} more minutes at ${RUN_WATTS} W.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(END, clock + dt * SPEED_UP); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the robot', part: 'robot', view: 'front', replay: false, run() { clock = 60; return render(); }},
    {label: 'Inspect: the floor after five minutes', part: 'floor', view: 'front', replay: false, run() { clock = 300; return render(); }},
    {label: 'Inspect: the coverage race', part: 'charts', view: 'front', replay: false, run() { clock = END; return render(); }},
  ];
  result.playback = {
    label: 'Start cleaning',
    description: 'Twenty minutes of cleaning, sixty times faster than real time.',
    stepLabel: 'Advance one minute',
    advance: result.advance,
    step: () => result.advance(60 / SPEED_UP),
    complete: () => clock >= END,
    blocked: () => false,
  };

  root.rotation.set(0.8, -0.25, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, floorPart, floor, texture, data, furniture, legs, tableTop, dock, robotPart, robot, wheels, brush, trail, path, charts, curves, dot, MM, SPEED_UP, END, TRAIL, WHEEL};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; texture.dispose(); dispose(); } };
  return result;
}

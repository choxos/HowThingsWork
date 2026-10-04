import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, textLabel, surface} from './scene-kit.js';
import {robotGeometry} from './robot-vacuum-geometry.js';
import {ROBOT, ROOM, FURNITURE, DROP, START, GRID} from './robot-vacuum-room.js';
import {cleaningPlan, cleaningPose, STRATEGY_OPTIONS, ROOM_OPTIONS, ROBOT_DEFAULTS, ROBOT_DOMAINS, SESSION_MINUTES, INITIAL_CHARGE, RUN_WATTS} from './robot-vacuum-physics.js';
import {robotMission, sampleRobot, missionTime, missionPlayTime, MISSION} from './robot-vacuum-mission.js';

const SCALE = 7, TAU = 2 * Math.PI;
const meters = value => value * SCALE, p = xyz => xyz.map(meters);
export const SHADES = Object.freeze({unvisited: [190, 194, 169], passed: [226, 192, 120], excluded: [105, 115, 94]});
export const roomPoint = (x, y, height = 0) => [(x - ROOM.width / 2) * SCALE, height * SCALE, (ROOM.depth / 2 - y) * SCALE];

function roomGeometry(kit, system) {
  const floorPart = kit.part('floor', 'Room and coverage map', 'A 4 × 3 m room. Gold cells have passed under the main cleaning head; gray-green cells have not. This is path coverage, not measured dirt-removal efficiency. Missing floor and furniture footprints are excluded from the denominator.', [0, 0, 0], system);
  floorPart.userData.explosionExcluded = true;
  const data = new Uint8Array(GRID.columns * GRID.rows * 4), texture = new THREE.DataTexture(data, GRID.columns, GRID.rows, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  const plane = new THREE.PlaneGeometry(meters(ROOM.width), meters(ROOM.depth)); plane.rotateX(-Math.PI / 2);
  const floor = surface(kit, plane, 'cream', floorPart); floor.material = floor.material.clone();
  Object.assign(floor.material, {map: texture, transparent: true}); floor.material.color.set(0xffffff);
  for (const [size, at] of [[[.035, .12, 3], [-.02, 1.5]], [[.035, .12, 3], [4.02, 1.5]], [[4, .12, .035], [2, 3.02]]]) kit.box(p(size), roomPoint(...at, .06), 'cream', floorPart);
  const furniture = kit.part('furniture', 'Sofa and table', 'The sofa blocks the robot. A raised table permits travel beneath its top, but its four legs remain obstacles.', [0, 0, 0], floorPart);
  furniture.userData.explosionExcluded = true;
  const sofa = FURNITURE[0];
  kit.box(p([sofa.x1 - sofa.x0, .42, sofa.y1 - sofa.y0]), roomPoint(1.2, 2.55, .21), 'clay', furniture);
  kit.box(p([2, .4, .2]), roomPoint(1.2, 2.9, .62), 'clay', furniture);
  const legs = FURNITURE.slice(1).map(leg => kit.cylinder(meters(leg.r), meters(.45), roomPoint(leg.x, leg.y, .225), 'wood', furniture));
  const top = kit.box(p([1, .03, .9]), roomPoint(3, 1.35, .465), 'wood', furniture);
  top.material = top.material.clone(); Object.assign(top.material, {transparent: true, opacity: .18, depthWrite: false});
  const stairs = kit.part('stairs', 'Open stairwell', 'The floor ends at this opening. Downward sensors detect missing reflected light and stop the robot before a wheel crosses the edge.', [0, 0, 0], floorPart);
  stairs.userData.explosionExcluded = true;
  for (let i = 0; i < 4; i++) kit.box(p([DROP.x1 - DROP.x0, .035, .2]), roomPoint(2, DROP.y0 + .1 + i * .2, -.1 - i * .12), 'wood', stairs);
  const trailPart = kit.part('trail', 'Recent cleaning path', 'Blue shows the last minute of cleaning travel and stays fixed after cleaning ends. The separate red line shows the planned return route.', [0, 0, 0], floorPart);
  trailPart.userData.explosionExcluded = true;
  const trail = lineObject(302, 0x2f6690, trailPart);
  const routePart = kit.part('return-route', 'Planned return route', 'An ideal known-map planner checks clearance along every straight segment. It does not teleport through furniture. The final approach follows the dock beacon.', [0, 0, 0], floorPart);
  routePart.userData.explosionExcluded = true;
  const route = lineObject(100, 0xc14f39, routePart);
  return {floorPart, data, texture, floor, furniture, legs, top, stairs, trailPart, trail, routePart, route};
}
function coverageChart(kit, system) {
  const charts = kit.part('charts', 'Compare cleaning strategies', 'Main cleaning-head passes as a share of all exposed floor, using the same layout and 20 minute run for each controller. This comparison assumes enough battery; the actual mission can stop earlier.', [0, 0, 0], system);
  Object.assign(charts.userData, {inspectionOnly: 'charts', explosionExcluded: true});
  kit.box([3.6, 3.1, .012], [0, 0, -.025], 'cream', charts);
  const label = (text, x, y, width = 3.3, height = .28) => textLabel(charts, text, {position: [x, y, .03], height, width});
  label('Cleaning-head passes', 0, 1.3); label('Minutes of cleaning', 0, -1.13); label('Exposed floor', -1.05, 1.01, 1.25, .23);
  const point = (t, share) => [-1.12 + t / ROOM.duration * 2.4, -.76 + share * 1.55, .03];
  for (const share of [0, .5, 1]) {const grid = lineObject(2, 0xb1b49e, charts); grid.geometry.attributes.position.array.set([...point(0, share), ...point(ROOM.duration, share)]); label(`${share * 100}%`, -1.4, -.76 + share * 1.55, .5, .24);}
  for (const t of [0, 600, 1200]) label(String(t / 60), point(t, 0)[0], -.95, .5, .24);
  const colors = [0x5d7564, 0xab7e2b, 0xc14f39], curves = colors.map(color => lineObject(121, color, charts));
  for (let i = 0; i < 3; i++) {const line = lineObject(2, colors[i], charts); line.geometry.attributes.position.array.set([-1.58 + i * 1.12, -1.39, .03, -1.42 + i * 1.12, -1.39, .03]); label(['Bounce', 'Spiral first', 'Rows + edges'][i], -1.02 + i * 1.1, -1.39, .95, .23);}
  const cursor = kit.sphere(.03, [0, 0, .04], 'ink', charts);
  return {charts, point, curves, cursor};
}
export function createRobotVacuumModel() {
  const kit = houseModel('Robot vacuum cleaner'), {root, part, control, finish} = kit;
  const system = part('system', 'Robot vacuum and room', 'Follow the robot close up, inspect its mechanism, or zoom out to compare its path across the room.', [0, 0, 0]);
  const scene = roomGeometry(kit, system), hardware = robotGeometry(kit, system, SCALE), chart = coverageChart(kit, system);
  const dock = part('dock', 'Powered charging dock', 'An infrared beacon guides the final approach. Charging starts only when both underside contacts meet the powered dock pads.', [0, 0, 0], system);
  const dockPlate = kit.box(p([.16, .006, .19]), roomPoint(START.x, .095, .003), 'ink', dock);
  const dockTower = kit.box(p([.3, .12, .025]), roomPoint(START.x, -.0125, .06), 'ink', dock);
  const dockContacts = [-1, 1].map(side => kit.box(p([.018, .004, .025]), roomPoint(START.x + side * .05, .05, .008), 'gold', dock));
  const dockLight = kit.sphere(meters(.009), roomPoint(START.x, .004, .105), 'gold', dock); dockLight.material = dockLight.material.clone();
  const beacon = lineObject(2, 0xe3b45e, dock);
  const chargeDots = [-1, 1].map(side => kit.sphere(.004 * SCALE, roomPoint(START.x + side * .05, .05, .016), 'gold', dock));
  const specs = {
    strategy: ['Cleaning strategy', STRATEGY_OPTIONS, 'Three illustrative controllers. Results compare this fixed room and random seed, not commercial products.'],
    room: ['Room layout', ROOM_OPTIONS, 'Furniture obstructs travel; the stairwell removes floor for downward sensors to detect.'],
    session: ['Cleaning time', SESSION_MINUTES.map((n, value) => ({value, label: `${n} minutes`})), 'Return when this interval ends, even if some floor remains unvisited.'],
    charge: ['Starting battery', INITIAL_CHARGE.map((n, value) => ({value, label: `${n * 100}%`})), 'Return early at 15% reserve. The dock then restores the battery if powered.'],
    dockPower: ['Dock power', [{value: 1, label: 'Connected'}, {value: 0, label: 'Unplugged'}], 'An unplugged dock still has a known location, but its beacon and charging supply are off. Final alignment uses the ideal stored dock pose.'],
  };
  for (const [key, [min, max, step]] of Object.entries(ROBOT_DOMAINS)) {
    const [label, options, help] = specs[key]; control(key, label, min, max, step, ROBOT_DEFAULTS[key], '', help, options, key === 'strategy' || key === 'room' ? {primary: true} : undefined);
  }
  let playTime = 0, lastClock = 0, settingsKey = '', chartRoom = null, restoring = false, disposed = false;
  const result = finish(values => {
    const key = JSON.stringify(values);
    if (key !== settingsKey) {if (!restoring) playTime = 0; settingsKey = key;}
    const mission = robotMission(values); playTime = Math.min(mission.playEnd, Math.max(0, playTime));
    const clock = missionTime(mission, playTime), s = sampleRobot(values, clock), plan = mission.plan, now = s.now;
    scene.furniture.visible = values.room === 1; scene.stairs.visible = values.room === 2;
    for (let i = 0; i < plan.first.length; i++) {
      scene.data.set(plan.first[i] <= s.cleanTime + 1e-9 ? SHADES.passed : plan.reach.floor[i] ? SHADES.unvisited : SHADES.excluded, i * 4);
      const x = (i % GRID.columns + .5) * ROOM.cell, y = (Math.floor(i / GRID.columns) + .5) * ROOM.cell;
      scene.data[i * 4 + 3] = values.room === 2 && x > DROP.x0 && x < DROP.x1 && y > DROP.y0 ? 0 : 255;
    }
    scene.texture.needsUpdate = true;
    hardware.robot.position.set(...roomPoint(now.x, now.y)); hardware.robot.rotation.y = now.h;
    hardware.wheels[0].wheel.rotation.z = -now.leftTravel / ROBOT.wheelRadius; hardware.wheels[1].wheel.rotation.z = -now.rightTravel / ROBOT.wheelRadius;
    const vx = (now.leftWheel + now.rightWheel) / 2, omega = (now.rightWheel - now.leftWheel) / ROBOT.wheelBase;
    if (Math.abs(vx) + Math.abs(omega) > 1e-10) hardware.fork.rotation.y = Math.atan2(omega * .123, vx);
    // Slow illustrative brush/air motion. Wheel rotation alone is to rolling scale.
    const mechanismTime = s.cleanTime / MISSION.cleanRate;
    hardware.roller.rotation.z = -TAU * mechanismTime;
    hardware.sideBrush.rotation.y = -TAU * mechanismTime * .7; hardware.blower.rotation.z = TAU * mechanismTime * 1.3;
    hardware.airDots.forEach((dot, i) => {dot.visible = s.cleaning; dot.position.copy(hardware.airCurve.getPoint((mechanismTime * .35 + i / hardware.airDots.length) % 1));});
    hardware.batteryGauge.forEach((bar, i) => {bar.scale.x = Math.max(.001, Math.min(1, s.battery * 5 - i)); bar.material.color.set(s.battery < .2 ? 0xc14f39 : 0xe3b45e);});
    hardware.dust.forEach((dot, i) => {dot.visible = i < Math.floor(s.coverage * hardware.dust.length);});
    hardware.sensorMeshes.forEach((mesh, i) => mesh.material.color.set(!s.sensors[i].floor || s.event?.type === 'cliff' && s.event.points.some(point => point.index === i) ? 0xc14f39 : 0x83b4c1));
    hardware.obstacleLights.forEach(mesh => mesh.material.color.set(s.event?.type === 'obstacle' ? 0xc14f39 : 0x83b4c1));
    dockLight.material.color.set(values.dockPower ? s.charging ? 0xe3b45e : 0x91aa7e : 0x374736);
    beacon.visible = s.beacon && Boolean(values.dockPower);
    beacon.geometry.attributes.position.array.set([...roomPoint(START.x, .004, .105), ...roomPoint(now.x - .125 * Math.cos(now.h), now.y - .125 * Math.sin(now.h), .104)]); beacon.geometry.attributes.position.needsUpdate = true; beacon.geometry.computeBoundingSphere();
    chargeDots.forEach(dot => {dot.visible = s.charging; dot.scale.setScalar(.75 + .25 * Math.sin(playTime * TAU));});
    const to = Math.min(plan.path.length, Math.floor(s.cleanTime / ROOM.every)), from = Math.max(0, to - 300), positions = scene.trail.geometry.attributes.position.array;
    let count = 0;
    for (let i = from; i < to; i++) positions.set(roomPoint(plan.path[i].x, plan.path[i].y, .003), count++ * 3);
    const cleaningEndPose = cleaningPose(plan, s.cleanTime);
    positions.set(roomPoint(cleaningEndPose.x, cleaningEndPose.y, .003), count++ * 3); scene.trail.geometry.setDrawRange(0, count); scene.trail.geometry.attributes.position.needsUpdate = true; scene.trail.geometry.computeBoundingSphere();
    scene.routePart.visible = clock >= s.cleanEnd && clock < s.dockedAt;
    mission.route.forEach((point, i) => scene.route.geometry.attributes.position.array.set(roomPoint(point.x, point.y, .004), i * 3));
    scene.route.geometry.setDrawRange(0, mission.route.length); scene.route.geometry.attributes.position.needsUpdate = true; scene.route.geometry.computeBoundingSphere();
    if (chartRoom !== values.room) {
      chartRoom = values.room;
      chart.curves.forEach((line, strategy) => {
        const comparison = cleaningPlan({room: values.room, strategy});
        for (let i = 0; i <= 120; i++) line.geometry.attributes.position.array.set(chart.point(i * 10, comparison.coverage[i * 10]), i * 3);
        line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();
      });
    }
    chart.cursor.position.set(...chart.point(s.cleanTime, s.coverage));
    const left = now.leftWheel, right = now.rightWheel;
    const steering = Math.abs(left - right) < 1e-9 ? Math.abs(left) < 1e-9 ? 'Both wheels stopped.' : left > 0 ? 'Equal speeds drive straight.' : 'Equal reverse speeds back up.' : Math.abs(left + right) < 1e-9 ? 'Opposite speeds turn in place.' : 'Unequal speeds curve the path.';
    const resultText = clock === 0 ? 'Ready to clean, return and recharge' : s.phase === 'ready' ? 'Returned and fully recharged' : s.phase === 'dock unpowered' ? 'Docked, but power is disconnected' : s.phase === 'charging' ? 'Contacts engaged: recharging' : s.phase === 'cleaning' ? 'Cleaning the selected room' : `Returning: ${s.reason}`;
    return {state: {...s, playTime}, readings: [
      r('Your result', resultText, 'Changed controls restart this mission. Inspection views preserve its time and state.'),
      r('Mission phase', clock === 0 ? 'Ready at dock' : s.phase === 'cleaning' ? now.doing : s.phase, `${fixed(clock / 60, 2)} minutes elapsed in the simulated mission.`),
      r('Cleaning-head coverage', `${fixed(s.coverage * 100, 1)}% of exposed floor`, `${s.swept.toLocaleString('en-US')} of ${s.floorCount.toLocaleString('en-US')} floor cells. Main-head passes, not a guarantee of dirt removal. Return travel does not add coverage.`),
      r('Wheel speeds', `Left ${fixed(left, 3)} · right ${fixed(right, 3)} m/s`, steering),
      r('Obstacle and edge sensing', `${now.bumps} obstacle stops · ${now.cliffs} floor-edge stops`, s.event ? s.event.type === 'cliff' ? 'Missing floor detected. Stop, retreat, then turn.' : 'Solid obstacle detected. Stop, retreat, then turn.' : 'Blue sensors have floor return. Red highlights a recent stop.'),
      r('Battery', `${fixed(s.battery * 100, 1)}% · ${fixed(s.energy / 3600, 2)} Wh`, `Cleaning draws ${RUN_WATTS} W; return travel 8 W. A 15% reserve triggers early return.`),
      r('Dock connection', s.contacts ? values.dockPower ? 'Contacts engaged · supply connected' : 'Contacts engaged · supply unplugged' : s.beacon && values.dockPower ? 'Infrared guide acquired · contacts not yet engaged' : 'Contacts separated', values.dockPower ? '25 W charger input: 20 W stored in the battery, 5 W assigned to losses and docked electronics.' : 'No beacon and no charge. Ideal stored dock pose still permits docking in this teaching model.'),
      r('Energy balance', `${fixed(s.cleanEnergy / 3600, 2)} Wh cleaning + ${fixed(s.returnEnergy / 3600, 3)} Wh returning`, `${fixed(s.storedEnergy / 3600, 2)} Wh restored since contact. Initial − used + restored = current battery energy.`),
    ]};
  });
  const render = result.update;
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) playTime += dt; return render();};
  result.animate = time => {const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt);};
  result.reset = (initial = {}) => {
    const settings = {...result.defaults, ...(initial.settings || {})}, mission = robotMission(settings);
    playTime = missionPlayTime(mission, Number.isFinite(initial.time) ? Math.max(0, initial.time) : 0); lastClock = 0; restoring = true;
    try {return render(settings);} finally {restoring = false;}
  };
  result.replayState = () => ({settings: result.getState().values, time: 0});
  const inspect = (label, id, view = 'front', isolate = false) => ({label, part: id, view, isolate, replay: false, run: () => result.update()});
  result.actions = [inspect('Inspect: robot close up', 'robot'), inspect('Inspect: whole room', 'system', 'top'), inspect('Inspect: wheel drives', 'drive'), inspect('Inspect: cleaning path', 'cleaner'), inspect('Inspect: floor sensors', 'cliff-sensors', 'bottom', true), inspect('Inspect: charging dock', 'dock'), inspect('Compare cleaning strategies', 'charts', 'front', true)];
  result.playback = {label: 'Clean, return and recharge', description: 'Cleaning plays 30× real time, return travel 3× and charging 240×. Wheel rotation uses actual signed travel. Brush and airflow animation are slowed illustrations.', stepLabel: 'Advance one playback second', advance: result.advance, step: () => result.advance(1), complete: () => playTime >= result.getState().playEnd - 1e-9, blocked: () => false};
  result.initialPart = result.autoFramePart = 'robot'; result.initialView = 'front'; result.initialCutaway = true;
  result.frameVisibleOnly = true; result.framePadding = .65; result.selectionOutline = false; result.transparentBackground = true;
  result.followParts = kit.parts.filter(entry => entry.id === 'robot' || entry.object.parent !== root && hardware.robot.getObjectById(entry.object.id)).map(entry => entry.id);
  result.thumbnailOmit = [scene.floorPart, chart.charts, dock];
  result.partViewDirections = {};
  for (const entry of kit.parts) if (result.followParts.includes(entry.id)) result.partViewDirections[entry.id] = {front: [1.3, 1.8, -1.5], top: [0, 3, 0], bottom: [0, -3, 0]};
  Object.assign(result.parts.find(entry => entry.id === 'charts'), {framePadding: .5, maxZoom: 150});
  result.partViewDirections.charts = {front: [0, 0, 3]}; result.partViewDirections.dock = {front: [1, 2, -2]};
  result.topology = {system, ...scene, ...hardware, ...chart, dock, dockPlate, dockTower, dockContacts, dockLight, beacon, chargeDots, SCALE};
  const dispose = result.dispose; result.dispose = () => {if (!disposed) {disposed = true; scene.texture.dispose(); dispose();}};
  return result;
}

import {validateControls, validTime} from './physics-kit.js';
import {differentialStep} from './robot-vacuum-motion.js';
import {ROBOT, ROOM, START, routeBlocked, sensorReadings} from './robot-vacuum-room.js';
import {cleaningPlan, cleaningPose, ROBOT_DEFAULTS, ROBOT_DOMAINS, SESSION_MINUTES, INITIAL_CHARGE, SPIN_RATE, RUN_WATTS, BATTERY_JOULES} from './robot-vacuum-physics.js';
import {returnRoute} from './robot-vacuum-route.js';

export const MISSION = Object.freeze({reserve: .15, returnWatts: 8, chargeWatts: 20, chargerInputWatts: 25, dockSpeed: .12, cleanRate: 30, returnRate: 3, chargeRate: 240});
const cache = new Map();
const angle = radians => Math.atan2(Math.sin(radians), Math.cos(radians));

export function robotMission(input = {}) {
  const values = validateControls(input, ROBOT_DEFAULTS, ROBOT_DOMAINS, 'robot vacuum'), key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const plan = cleaningPlan({strategy: values.strategy, room: values.room});
  const initialEnergy = INITIAL_CHARGE[values.charge] * BATTERY_JOULES, requested = SESSION_MINUTES[values.session] * 60;
  const reserveTime = (initialEnergy - MISSION.reserve * BATTERY_JOULES) / RUN_WATTS;
  const cleanEnd = Math.floor(Math.min(requested, reserveTime) / ROOM.dt + 1e-9) * ROOM.dt;
  const reason = reserveTime < requested ? 'battery reserve reached' : 'selected cleaning time finished';
  let pose = cleaningPose(plan, cleanEnd), clock = cleanEnd;
  const segments = [];
  const append = (left, right, seconds, phase) => {
    if (seconds <= 1e-12) return;
    const start = {...pose}, end = differentialStep(start, left, right, seconds, ROBOT.wheelBase);
    segments.push({start: clock, end: clock + seconds, pose: start, left, right, phase});
    clock += seconds; pose = {...pose, ...end};
  };
  // A cleaning sensor can allow the shell to overhang a stair edge while wheels
  // remain supported. Retrace exact wheel increments until the more conservative
  // whole-body route planner has clearance. This does not erase cleaned cells.
  let rewind = Math.round(cleanEnd / ROOM.dt);
  while (routeBlocked(pose.x, pose.y, values.room) && rewind > 0) {
    append(-plan.ticks[rewind * 8 + 6], -plan.ticks[rewind * 8 + 7], ROOM.dt, 'retracing');
    rewind--;
  }
  const route = returnRoute(pose, values.room);
  const turnTo = heading => {
    const delta = angle(heading - pose.h), speed = Math.sign(delta) * ROBOT.speed / 2;
    append(-speed, speed, Math.abs(delta) / SPIN_RATE, 'aligning');
  };
  for (let i = 1; i < route.length; i++) {
    const target = route[i], dx = target.x - pose.x, dy = target.y - pose.y, distance = Math.hypot(dx, dy);
    if (distance < 1e-12) continue;
    turnTo(Math.atan2(dy, dx));
    append(ROBOT.speed, ROBOT.speed, distance / ROBOT.speed, 'returning');
  }
  // Dock is behind the robot. Align away from the wall, then reverse slowly
  // onto the two contacts. Beacon homing is idealized over this final approach.
  turnTo(START.heading);
  const approach = Math.hypot(pose.x - START.x, pose.y - START.y);
  append(-MISSION.dockSpeed, -MISSION.dockSpeed, approach / MISSION.dockSpeed, 'docking');
  const dockedAt = clock, dockEnergy = initialEnergy - cleanEnd * RUN_WATTS - (dockedAt - cleanEnd) * MISSION.returnWatts;
  if (dockEnergy <= 0) throw new Error('Battery reserve is insufficient for the return route.');
  const chargeDuration = values.dockPower ? (BATTERY_JOULES - dockEnergy) / MISSION.chargeWatts : 0;
  const end = dockedAt + chargeDuration;
  const playReturn = cleanEnd / MISSION.cleanRate, playCharge = playReturn + (dockedAt - cleanEnd) / MISSION.returnRate;
  const playEnd = playCharge + chargeDuration / MISSION.chargeRate;
  const mission = {values, plan, segments, route, initialEnergy, cleanEnd, reason, dockedAt, dockEnergy, end, dockPose: pose, playReturn, playCharge, playEnd};
  if (cache.size >= 36) cache.delete(cache.keys().next().value);
  cache.set(key, mission); return mission;
}
export function missionTime(mission, playTime) {
  validTime(playTime);
  if (playTime <= mission.playReturn) return playTime * MISSION.cleanRate;
  if (playTime <= mission.playCharge) return mission.cleanEnd + (playTime - mission.playReturn) * MISSION.returnRate;
  return Math.min(mission.end, mission.dockedAt + (playTime - mission.playCharge) * MISSION.chargeRate);
}
export function missionPlayTime(mission, physicalTime) {
  validTime(physicalTime);
  if (physicalTime <= mission.cleanEnd) return physicalTime / MISSION.cleanRate;
  if (physicalTime <= mission.dockedAt) return mission.playReturn + (physicalTime - mission.cleanEnd) / MISSION.returnRate;
  return Math.min(mission.playEnd, mission.playCharge + (physicalTime - mission.dockedAt) / MISSION.chargeRate);
}
export function sampleRobot(input = {}, time = 0) {
  validTime(time);
  const mission = robotMission(input), {plan, values, cleanEnd, dockedAt} = mission, clock = Math.min(mission.end, time), cleanTime = Math.min(clock, cleanEnd);
  let phase, now, energy;
  if (clock < cleanEnd) {
    phase = 'cleaning'; now = cleaningPose(plan, clock); energy = mission.initialEnergy - clock * RUN_WATTS;
  } else if (clock < dockedAt) {
    const segment = mission.segments.find(segment => clock < segment.end) || mission.segments.at(-1);
    phase = segment.phase;
    now = {...segment.pose, ...differentialStep(segment.pose, segment.left, segment.right, clock - segment.start, ROBOT.wheelBase), leftWheel: segment.left, rightWheel: segment.right};
    energy = mission.initialEnergy - cleanEnd * RUN_WATTS - (clock - cleanEnd) * MISSION.returnWatts;
  } else {
    phase = !values.dockPower ? 'dock unpowered' : clock < mission.end - 1e-8 ? 'charging' : 'ready';
    now = {...mission.dockPose, leftWheel: 0, rightWheel: 0};
    energy = Math.min(BATTERY_JOULES, mission.dockEnergy + (clock - dockedAt) * MISSION.chargeWatts);
  }
  let swept = 0;
  for (const t of plan.first) if (t <= cleanTime + 1e-9) swept++;
  const events = plan.events.filter(event => event.t <= cleanTime + 1e-9), lastEvent = events.at(-1) || null;
  const event = phase === 'cleaning' && lastEvent && clock - lastEvent.t <= 1.5 ? lastEvent : null;
  const bumps = events.filter(event => event.type === 'obstacle').length, cliffs = events.length - bumps;
  return {values, clock, cleanTime, cleanEnd, dockedAt, end: mission.end, playEnd: mission.playEnd, reason: mission.reason, phase, now: {...now, bumps, cliffs}, event, sensors: sensorReadings(now, values.room), cleaning: phase === 'cleaning' && clock > 0, contacts: clock === 0 || clock >= dockedAt, beacon: phase === 'docking', charging: phase === 'charging', energy, battery: energy / BATTERY_JOULES, initialEnergy: mission.initialEnergy, cleanEnergy: cleanTime * RUN_WATTS, returnEnergy: Math.max(0, Math.min(clock, dockedAt) - cleanEnd) * MISSION.returnWatts, storedEnergy: Math.max(0, clock - dockedAt) * MISSION.chargeWatts, swept, coverage: swept / plan.reach.floorCount, floorCount: plan.reach.floorCount, route: mission.route};
}

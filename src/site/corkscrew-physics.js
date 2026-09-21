import {validateControls, validTime, clamp} from './physics-kit.js';

// Corkscrews: a helix screwed into a cork, and the two ways of pulling it out.
//
// Units: millimeters, newtons, newton millimeters, seconds. Work in joules.
//
// The cork. A 44 mm natural cork squeezed into an 18.5 mm neck presses on the
// glass, and friction on that contact holds it. The pressure is taken as even
// along the cork, so the friction, and the force needed to slide the cork, is
// proportional to the length still inside the neck:
//   F(x) = F0 (1 - x / 44),   x = how far the cork has come out.
// The hardest pull is the first; the work to pull it out is F0 times 22 mm.
//
// The worm. Each turn screws the worm one 7 mm pitch deeper. To pull the cork,
// the worm must carry that force into it. If the cork gives first, it shears
// along the cylinder the worm sweeps, so the hold is the cork's shear strength
// times pi times the worm's outer diameter times its depth. An open helix 9 mm
// across grips a wider cylinder than a solid screw 6 mm across, which also
// splits cork by wedging it apart; the book's reason for the helix.
//
// Screwing in. Friction on the wire already buried resists turning. The torque
// grows with depth: a small torque to start the tip, plus a fixed torque per
// millimeter buried, larger for a solid screw whose whole shank rubs the cork.
// A worm driven more than 43 mm deep goes through the bottom of the cork.
//
// Pulling. The pull rises steadily to the most the hand gives. Nothing moves
// until it reaches the cork's grip; if the worm's hold is less than that grip,
// the worm tears a plug out of the cork instead. Once the cork moves, the force
// it needs only falls, so a cork that starts keeps coming. It is drawn out at
// a steady 25 mm a second.
//
// The winged corkscrew. Its central shaft is a rack meshed with a pinion on
// each wing, pitch radius 14 mm. Driving the worm down turns the wings up by
// depth over 14 mm radians. Pushing both wings down, square to the wings,
// lifts the rack with 2 F L / r, so the leverage is 2L / r. The rack can only
// rise as far as it went down, so a worm that went in less than the cork's
// length leaves the rest of the cork in the neck to pull out by hand.
//
// Not modeled: the extra grip of a cork freshly swollen by wine, stick-slip
// and the start-up jump above sliding friction, the worm compressing the cork,
// wing geometry beyond a square push, bending of the worm, and tilting.

export const CORK = Object.freeze({length: 44, bore: 18.5, pitch: 7, wormLength: 52, shear: 1.0, pierceMargin: 1, pullSpeed: 25, turnRate: 1});
export const WORMS = Object.freeze([
  Object.freeze({value: 0, label: 'Open helix, 9 mm across', diameter: 9, startTorque: 20, torquePerMm: 6.9}),
  Object.freeze({value: 1, label: 'Solid screw, 6 mm across', diameter: 6, startTorque: 30, torquePerMm: 14.1}),
]);
export const GRIPS = Object.freeze([
  Object.freeze({value: 0, label: 'Old, loose cork: 120 N', force: 120}),
  Object.freeze({value: 1, label: 'Natural cork: 300 N', force: 300}),
  Object.freeze({value: 2, label: 'Synthetic cork: 450 N', force: 450}),
]);

/** Force needed to slide the cork when it is x millimeters out. */
export const corkForce = (grip, x) => GRIPS[grip].force * clamp(1 - x / CORK.length);
/** Most force the worm can put into the cork before tearing a plug out. */
export const wormHold = (worm, depth) => CORK.shear * Math.PI * WORMS[worm].diameter * Math.min(depth, CORK.length);
/** Torque to keep screwing in at a depth. */
export const screwTorque = (worm, depth) => depth > 0 ? WORMS[worm].startTorque + WORMS[worm].torquePerMm * Math.min(depth, CORK.length) : 0;

/** The shared part of both trials: screw in for `turns`, then pull with a force rising to `limit` at `rise` per second. */
function extraction({worm, turns, grip}, limit, rise, liftLimit) {
  const depth = turns * CORK.pitch, pierced = depth > CORK.length - CORK.pierceMargin, need = GRIPS[grip].force, hold = wormHold(worm, depth);
  const screwTime = turns / CORK.turnRate;
  let outcome, startTime = null, tearTime = null;
  const reach = Math.min(limit, hold);
  if (need <= reach + 1e-9) { outcome = 'extracting'; startTime = screwTime + need / rise; }
  else if (hold < need && limit >= hold) { outcome = 'tears'; tearTime = screwTime + hold / rise; }
  else outcome = 'stalls';
  const travel = Math.min(CORK.length, liftLimit);
  const endTime = startTime === null ? null : startTime + travel / CORK.pullSpeed;
  return {depth, pierced, need, hold, screwTime, outcome, startTime, tearTime, travel, endTime, rampEnd: screwTime + limit / rise};
}

function state(plan, time) {
  const elapsed = Math.min(plan.duration, validTime(time));
  const turnsDone = Math.min(plan.values.turns, elapsed * CORK.turnRate), depthNow = turnsDone * CORK.pitch, screwing = elapsed < plan.screwTime;
  const pullTime = Math.max(0, elapsed - plan.screwTime);
  const out = plan.startTime === null || elapsed < plan.startTime ? 0 : Math.min(plan.travel, (elapsed - plan.startTime) * CORK.pullSpeed);
  const torn = plan.tearTime !== null && elapsed >= plan.tearTime;
  const needNow = corkForce(plan.values.grip, out);
  const moving = plan.startTime !== null && elapsed >= plan.startTime && out < plan.travel;
  const finished = torn || (plan.endTime !== null && out >= plan.travel);
  // Quasi-static: a sliding cork is pulled with exactly its grip, so it keeps a
  // steady pace; nothing pulls once the cork is out or the worm has torn free.
  const applied = screwing || finished ? 0 : moving ? needNow : Math.min(plan.limit, pullTime * plan.rise);
  const force = applied;
  const work = (GRIPS[plan.values.grip].force * out - GRIPS[plan.values.grip].force * out * out / (2 * CORK.length)) / 1000;
  const freed = out >= CORK.length - 1e-9;
  const done = plan.endTime !== null ? elapsed >= plan.endTime : elapsed >= plan.rampEnd || torn;
  const mode = elapsed === 0 ? 'ready' : screwing ? 'screwing' : torn ? 'torn' : freed ? 'freed' : out >= plan.travel && plan.endTime !== null ? 'lifted' : moving ? 'pulling' : plan.outcome === 'stalls' && elapsed >= plan.rampEnd ? 'stalled' : 'loading';
  return {
    ...plan, elapsed, turnsDone, depthNow, screwing, torque: screwing ? screwTorque(plan.values.worm, depthNow) : 0, applied, force, out, needNow, torn, freed, work, mode,
    remaining: CORK.length - out, handFinish: freed ? 0 : corkForce(plan.values.grip, out), complete: done,
  };
}

// ---------------------------------------------------------------------------
// Screw corkscrew: a T-handle, pulled straight up.

export const SCREW_DEFAULTS = Object.freeze({worm: 0, turns: 5, grip: 1, pull: 350, handle:40});
export const SCREW_DOMAINS = Object.freeze({worm: [0, 1, 1], turns: [1, 6.5, 0.5], grip: [0, 2, 1], pull: [100, 600, 25], handle:[20,60,5]});
export const T_HANDLE = Object.freeze({grip: 40, rise: 250});

export function screwCorkscrewPlan(input = {}) {
  const values = validateControls(input, SCREW_DEFAULTS, SCREW_DOMAINS, 'screw corkscrew');
  const core = extraction(values, values.pull, T_HANDLE.rise, CORK.length);
  const withdrawalEnd=core.tearTime===null?null:core.tearTime+core.depth/CORK.pullSpeed;
  const duration = Math.max(core.endTime ?? 0, core.rampEnd, withdrawalEnd ?? 0) + 0.5;
  return {...core, values, limit: values.pull, rise: T_HANDLE.rise, duration, withdrawalEnd, handleForce: screwTorque(values.worm, core.depth) / (2 * values.handle)};
}

export function sampleScrewCorkscrew(input = {}, time = 0) {
  validTime(time);
  const s = state(screwCorkscrewPlan(input), time);
  const withdrawal=s.torn?Math.min(s.depth,Math.max(0,s.elapsed-s.tearTime)*CORK.pullSpeed):0;
  const crumbFall=s.pierced?Math.max(0,s.elapsed-(CORK.length-CORK.pierceMargin)/CORK.pitch)*CORK.pullSpeed:0;
  return {...s, withdrawal, crumbFall, complete:s.torn?s.elapsed>=s.withdrawalEnd:s.complete, turningForce:s.torque/(2*s.values.handle)};
}

// ---------------------------------------------------------------------------
// Winged corkscrew: a rack between two pinion-ended wings.

export const WINGED_DEFAULTS = Object.freeze({worm: 0, turns: 6, grip: 1, wing: 25, length: 95});
export const WINGED_DOMAINS = Object.freeze({worm: [0, 1, 1], turns: [1, 6, 0.5], grip: [0, 2, 1], wing: [5, 60, 1], length: [60, 120, 5]});
// The knob is turned by a thumb and finger pinching opposite sides, 15 mm out.
export const WINGS = Object.freeze({pinionRadius: 14, knob: 15, rise: 12});

export function wingedCorkscrewPlan(input = {}) {
  const values = validateControls(input, WINGED_DEFAULTS, WINGED_DOMAINS, 'winged corkscrew');
  const leverage = 2 * values.length / WINGS.pinionRadius;
  const depth = values.turns * CORK.pitch;
  const core = extraction(values, values.wing * leverage, WINGS.rise * leverage, depth);
  const withdrawalEnd=core.tearTime===null?null:core.tearTime+depth/CORK.pullSpeed;
  const duration = Math.max(core.endTime ?? 0, core.rampEnd, withdrawalEnd ?? 0) + 0.5;
  return {...core, values, leverage, limit: values.wing * leverage, rise: WINGS.rise * leverage, duration, withdrawalEnd, wingRise: depth / WINGS.pinionRadius};
}

export function sampleWingedCorkscrew(input = {}, time = 0) {
  validTime(time);
  const plan = wingedCorkscrewPlan(input), s = state(plan, time);
  // The rack drops as the worm goes in and rises as the cork comes out.
  const withdrawal=s.torn?Math.min(s.depth,Math.max(0,s.elapsed-s.tearTime)*CORK.pullSpeed):0;
  const rackDrop = s.depthNow - s.out - withdrawal, wingAngle = rackDrop / WINGS.pinionRadius;
  return {
    ...s, withdrawal, rackDrop, wingAngle, complete:s.torn?s.elapsed>=plan.withdrawalEnd:s.complete, wingForce: s.force / plan.leverage, wingNeed: s.needNow / plan.leverage,
    wingTravel: 2 * plan.values.length * s.out / WINGS.pinionRadius, knobForce: s.torque / (2 * WINGS.knob),
  };
}

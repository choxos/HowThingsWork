import {validTime} from './physics-kit.js';
import {STAPLER, staplerAt, bladeForce, workTo, magazineNoseAt} from './stapler-physics.js';

/** Prescribed slow teaching motion, not a spring rebound or feed dynamics solver. */
export const STAPLER_CYCLE = Object.freeze({clearance: .3, hold: .6, release: 1.4, feed: .8, loaded: 8});

export const CYCLE_PHASES = Object.freeze({
  approach: 'Blade approaching the staple',
  holding: 'Press finished',
  releasing: 'Leaf spring raising the blade and magazine',
  feeding: 'Coil spring advancing the next staple',
  ready: 'Next staple ready',
  interference: 'Stopped where the inward tips meet',
});

const ease = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Stop the ideal planar fold before two flat-ended legs would overlap. */
export function staplerCyclePlan(plan) {
  const interference = plan.meet;
  const pressEnd = interference ? Math.min(plan.seat, plan.anvil + plan.half) : plan.seat;
  const pressStart = STAPLER_CYCLE.clearance / STAPLER.speed;
  const pressFinish = pressStart + pressEnd / STAPLER.speed;
  const releaseStart = pressFinish + STAPLER_CYCLE.hold;
  const releaseFinish = releaseStart + STAPLER_CYCLE.release;
  const feedFinish = releaseFinish + STAPLER_CYCLE.feed;
  const profile = plan.profile.filter(point => point.drop <= pressEnd).map(point => ({...point}));
  if (profile.at(-1).drop < pressEnd) profile.push({drop: pressEnd, force: bladeForce(plan, pressEnd)});
  const peak = Math.max(...profile.map(point => point.force));
  return Object.freeze({
    interference, pressEnd, pressStart, pressFinish, releaseStart, releaseFinish, feedFinish,
    duration: interference ? pressFinish : feedFinish,
    profile: Object.freeze(profile.map(Object.freeze)), peak, handPeak: peak * plan.ratio,
    work: workTo(plan, pressEnd),
  });
}

/** Keep the deposited staple still while the driver returns and the strip feeds. */
export function staplerCycleAt(plan, time) {
  const cycle = staplerCyclePlan(plan), t = Math.min(validTime(time), cycle.duration);
  const press = staplerAt(plan, Math.min(Math.max(0, t - cycle.pressStart), cycle.pressEnd / STAPLER.speed));
  if (cycle.interference) press.reach = Math.min(press.reach, plan.half);
  let phase, bladeDrop, feed = 0;
  if (t < cycle.pressStart) {
    phase = 'approach'; bladeDrop = -STAPLER_CYCLE.clearance + STAPLER.speed * t;
  } else if (t < cycle.pressFinish) {
    phase = press.phase; bladeDrop = press.drop;
  } else if (cycle.interference) {
    phase = 'interference'; bladeDrop = cycle.pressEnd;
  } else if (t < cycle.releaseStart) {
    phase = 'holding'; bladeDrop = cycle.pressEnd;
  } else if (t < cycle.releaseFinish) {
    phase = 'releasing';
    bladeDrop = cycle.pressEnd - (cycle.pressEnd + STAPLER_CYCLE.clearance) * ease((t - cycle.releaseStart) / STAPLER_CYCLE.release);
  } else {
    phase = t < cycle.feedFinish ? 'feeding' : 'ready';
    bladeDrop = -STAPLER_CYCLE.clearance;
    feed = ease((t - cycle.releaseFinish) / STAPLER_CYCLE.feed);
  }
  const driverBottom = STAPLER.gap + STAPLER.recess + STAPLER.longest - bladeDrop;
  const magazineDrop = Math.min(Math.max(bladeDrop, 0), plan.closed);
  return {
    cycle, t, phase, press, bladeDrop, driverBottom, magazineDrop,
    nose: magazineNoseAt(magazineDrop),
    feed, feedTravel: feed * plan.staple.width,
    remaining: STAPLER_CYCLE.loaded - (press.drop >= plan.broken ? 1 : 0),
    forceEvaluated: t >= cycle.pressStart && t < cycle.pressFinish,
    resultReady: t >= cycle.pressFinish,
    done: t >= cycle.duration,
  };
}

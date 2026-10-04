import {validateControls, validTime} from './physics-kit.js';

// Original canister teaching apparatus, not a product performance prediction.
// Constant-density, steady flow. The fan supplies total pressure; the plotted
// component differences are dissipative losses, not local static pressures.
// Fan, fitting and porous-media parameters are assigned illustrative values.
export const CLEANER = Object.freeze({
  density: 1.2, viscosity: 1.8e-5, atmosphere: 101325, soundSpeed: 343,
  shutoff: 7000, freeFlow: .035, hoseDiameter: .032, hoseLength: 2.6,
  bagResistance: 4e4, filterResistance: 1.8e4, loadedFilterFactor: 3,
  outletArea: .004, duration: 30, slowdown: 30, playbackSpeed: 2, step: 1,
  markerCount: 12,
});
export const CLEANER_DEFAULTS = Object.freeze({nozzle: 0, bag: 1, filter: 0, motor: 1});
export const CLEANER_DOMAINS = Object.freeze({nozzle: [0, 2, 1], bag: [1, 4, .5], filter: [0, 1, 1], motor: [0, 1, 1]});
export const CLEANER_NOZZLES = Object.freeze([
  Object.freeze({value: 0, label: 'Floor head', width: .25, gap: .006, loss: 2.5, sealed: false}),
  Object.freeze({value: 1, label: 'Crevice tool', width: .025, gap: .012, loss: 2, sealed: false}),
  Object.freeze({value: 2, label: 'Sealed floor head', width: .25, gap: .006, loss: 2.5, sealed: true}),
]);
export const cleanerHoseArea = Math.PI * CLEANER.hoseDiameter ** 2 / 4;

/** Darcy friction factor: laminar law, smooth-tube Blasius law, and an explicit
 * smooth interpolation in the transitional interval. Active lesson operating
 * points are turbulent; interpolation keeps the plotted origin well defined. */
export function cleanerFriction(reynolds) {
  if (!Number.isFinite(reynolds) || reynolds < 0) throw new RangeError('Reynolds number must be finite and nonnegative');
  if (reynolds === 0) return 0;
  const laminar = 64 / reynolds, turbulent = .3164 / reynolds ** .25;
  if (reynolds <= 2300) return laminar;
  if (reynolds >= 4000) return turbulent;
  const u = (reynolds - 2300) / 1700, mix = u * u * (3 - 2 * u);
  return laminar * (1 - mix) + turbulent * mix;
}

function validFlow(flow) {
  if (!Number.isFinite(flow) || flow < 0 || flow > CLEANER.freeFlow) throw new RangeError('Flow must lie between zero and the free-delivery flow');
}

/** Prescribed fan total-pressure characteristic at one fixed running speed. */
export function cleanerFanRise(flow) {
  validFlow(flow);
  return CLEANER.shutoff * (1 - (flow / CLEANER.freeFlow) ** 2);
}

/** Lumped head/adapter loss, pipe friction, porous media, and outlet jet mixing.
 * A sealed head permits Q=0 only. Its static holding pressure is treated in the
 * operating plan, never as an energy-dissipating loss at zero flow. */
export function cleanerLosses(values, flow) {
  validFlow(flow);
  const nozzle = CLEANER_NOZZLES[values.nozzle];
  if (!nozzle) throw new RangeError('Unknown nozzle');
  if (nozzle.sealed && flow > 0) throw new RangeError('A sealed nozzle cannot carry flow');
  const slotArea = nozzle.width * nozzle.gap, slotSpeed = flow / slotArea, hoseSpeed = flow / cleanerHoseArea;
  const reynolds = CLEANER.density * hoseSpeed * CLEANER.hoseDiameter / CLEANER.viscosity;
  const friction = cleanerFriction(reynolds), dynamic = speed => .5 * CLEANER.density * speed ** 2;
  const drops = {
    head: nozzle.loss * dynamic(slotSpeed),
    hose: friction * CLEANER.hoseLength / CLEANER.hoseDiameter * dynamic(hoseSpeed),
    bag: CLEANER.bagResistance * values.bag * flow,
    filter: CLEANER.filterResistance * (values.filter ? CLEANER.loadedFilterFactor : 1) * flow,
    outlet: dynamic(flow / CLEANER.outletArea),
  };
  return {drops, total: Object.values(drops).reduce((sum, drop) => sum + drop, 0), slotArea, slotSpeed, hoseSpeed, reynolds, friction};
}

export function cleanerPlan(input = {}) {
  const values = validateControls(input, CLEANER_DEFAULTS, CLEANER_DOMAINS, 'canister vacuum cleaner');
  const nozzle = CLEANER_NOZZLES[values.nozzle];
  let flow = 0;
  if (values.motor && !nozzle.sealed) {
    let lo = 0, hi = CLEANER.freeFlow;
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2;
      if (cleanerFanRise(mid) > cleanerLosses(values, mid).total) lo = mid; else hi = mid;
    }
    flow = (lo + hi) / 2;
  }
  const losses = cleanerLosses(values, flow), pressure = values.motor ? cleanerFanRise(flow) : 0;
  const sealPressure = values.motor && nozzle.sealed ? pressure : 0;
  return {values, nozzle, flow, pressure, ...losses, sealPressure,
    holdingForce: sealPressure * losses.slotArea, airPower: pressure * flow,
    maxMach: Math.max(losses.slotSpeed, losses.hoseSpeed, flow / CLEANER.outletArea) / CLEANER.soundSpeed,
    pressureFraction: pressure / CLEANER.atmosphere};
}

/** Clock is the displayed slow-motion trace, not a cleaning-duration claim.
 * The corresponding physical interval is clock/slowdown. Dust transport is
 * drawn separately along the actual model path, with no adhesion prediction. */
export function sampleCleaner(input = {}, time = 0) {
  validTime(time);
  const plan = cleanerPlan(input), clock = Math.min(CLEANER.duration, time), elapsed = clock / CLEANER.slowdown;
  const blocked = !plan.values.motor ? 'Motor off: no pressure rise or flow' : plan.nozzle.sealed ? 'Head sealed: pressure without airflow' : '';
  return {...plan, clock, elapsed, complete: clock >= CLEANER.duration,
    volume: plan.flow * elapsed, airEnergy: plan.airPower * elapsed,
    blocked, phase: blocked || (clock >= CLEANER.duration ? 'Trace complete: collected dust stays in the bag' : 'Air carries loose dust toward the bag')};
}

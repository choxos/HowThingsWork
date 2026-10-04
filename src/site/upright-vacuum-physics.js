import {validateControls, validTime} from './physics-kit.js';

// Original direct-air upright teaching apparatus. Assigned total-pressure
// characteristic and lumped losses, not measured product performance.
// Brush kinematics are an ideal nonslipping belt drive at prescribed speed.
// Marker release depicts selected brush encounters, not an adhesion model.
export const UPRIGHT = Object.freeze({
  density: 1.2, viscosity: 1.8e-5, atmosphere: 101325, soundSpeed: 343,
  shutoff: 5000, freeFlow: .035, width: .3, headLength: .35, workingGap: .006, raisedBy: .012,
  headLoss: 2.5, ductDiameter: .04, ductLength: .75, bendLoss: 1.5,
  bagResistance: 4e4, coverResistance: 2e4, loadedCoverFactor: 3,
  outletArea: .01, bagArea: .022, coverArea: .035,
  driverRadius: .008, drivenRadius: .024, motorRpm: 9000, eyeRadius: .028, shaftRadius: .005,
  slowdown: 300, duration: 90, playbackSpeed: 3, step: 1,
  markerCount: 12, looseCount: 6, brushRows: 4,
});
export const UPRIGHT_DEFAULTS = Object.freeze({belt: 1, height: 0, seal: 0, bag: 1, cover: 0, motor: 1});
export const UPRIGHT_DOMAINS = Object.freeze({belt: [0, 1, 1], height: [0, 1, 1], seal: [0, 1, 1], bag: [1, 4, .5], cover: [0, 1, 1], motor: [0, 1, 1]});
export const uprightDuctArea = Math.PI * UPRIGHT.ductDiameter ** 2 / 4;
const TAU = 2 * Math.PI;

/** Explicit smooth-pipe law; the selectable open-flow points are turbulent. */
export function uprightFriction(reynolds) {
  if (!Number.isFinite(reynolds) || reynolds < 0) throw new RangeError('Reynolds number must be finite and nonnegative');
  if (!reynolds) return 0;
  const laminar = 64 / reynolds, turbulent = .3164 / reynolds ** .25;
  if (reynolds <= 2300) return laminar;
  if (reynolds >= 4000) return turbulent;
  const u = (reynolds - 2300) / 1700, blend = u * u * (3 - 2 * u);
  return laminar * (1 - blend) + turbulent * blend;
}

function validFlow(flow) {
  if (!Number.isFinite(flow) || flow < 0 || flow > UPRIGHT.freeFlow) throw new RangeError('Flow must lie between zero and the free-delivery flow');
}

export function uprightFanRise(flow) {
  validFlow(flow);
  return UPRIGHT.shutoff * (1 - (flow / UPRIGHT.freeFlow) ** 2);
}

/** Total-pressure losses between still room air at inlet and outlet. The
 * entry/brush chamber is lumped into the assigned head coefficient. Raising
 * the head opens its side and rear skirts as well as the front slot. Entry
 * speed is an average over those openings, not a resolved floor flow field.
 * A closed fan-eye gate supports force at zero flow, not dissipative loss. */
export function uprightLosses(input, flow) {
  const values = validateControls(input, UPRIGHT_DEFAULTS, UPRIGHT_DOMAINS, 'upright vacuum cleaner');
  validFlow(flow);
  if (values.seal && flow > 0) throw new RangeError('A sealed fan inlet cannot carry flow');
  const gap = UPRIGHT.workingGap + values.height * UPRIGHT.raisedBy;
  const slotArea = UPRIGHT.width * UPRIGHT.workingGap + values.height * UPRIGHT.raisedBy * 2 * (UPRIGHT.width + UPRIGHT.headLength);
  const slotSpeed = flow / slotArea, ductSpeed = flow / uprightDuctArea;
  const reynolds = UPRIGHT.density * ductSpeed * UPRIGHT.ductDiameter / UPRIGHT.viscosity;
  const friction = uprightFriction(reynolds), dynamic = speed => .5 * UPRIGHT.density * speed ** 2;
  const drops = {
    head: UPRIGHT.headLoss * dynamic(slotSpeed),
    duct: (friction * UPRIGHT.ductLength / UPRIGHT.ductDiameter + UPRIGHT.bendLoss) * dynamic(ductSpeed),
    bag: UPRIGHT.bagResistance * values.bag * flow,
    cover: UPRIGHT.coverResistance * (values.cover ? UPRIGHT.loadedCoverFactor : 1) * flow,
    outlet: dynamic(flow / UPRIGHT.outletArea),
  };
  return {gap, slotArea, slotSpeed, ductSpeed, reynolds, friction, drops, total: Object.values(drops).reduce((sum, p) => sum + p, 0)};
}

export function uprightPlan(input = {}) {
  const values = validateControls(input, UPRIGHT_DEFAULTS, UPRIGHT_DOMAINS, 'upright vacuum cleaner');
  let flow = 0;
  if (values.motor && !values.seal) {
    let lo = 0, hi = UPRIGHT.freeFlow;
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2;
      if (uprightFanRise(mid) > uprightLosses(values, mid).total) lo = mid; else hi = mid;
    }
    flow = (lo + hi) / 2;
  }
  const losses = uprightLosses(values, flow), pressure = values.motor ? uprightFanRise(flow) : 0;
  const motorRpm = values.motor * UPRIGHT.motorRpm;
  const brushRpm = values.belt * motorRpm * UPRIGHT.driverRadius / UPRIGHT.drivenRadius;
  const brushContact = !values.height;
  const bagTotalPressure = losses.drops.bag + losses.drops.cover + losses.drops.outlet;
  const coverTotalPressure = losses.drops.cover + losses.drops.outlet;
  // In the broad bag/cover plenums, kinetic pressure is small. These explicit
  // corrections distinguish the section-average static estimate from total
  // pressure; no claim is made about the detailed jet or membrane field.
  const bagKineticPressure = .5 * UPRIGHT.density * (flow / UPRIGHT.bagArea) ** 2;
  const coverKineticPressure = .5 * UPRIGHT.density * (flow / UPRIGHT.coverArea) ** 2;
  return {values, ...losses, flow, pressure, motorRpm, brushRpm, brushContact,
    beltSpeed: motorRpm / 60 * TAU * UPRIGHT.driverRadius * values.belt,
    brushActive: brushRpm > 0 && brushContact,
    bagTotalPressure, coverTotalPressure, bagKineticPressure, coverKineticPressure,
    bagPressure: bagTotalPressure - bagKineticPressure, coverPressure: coverTotalPressure - coverKineticPressure,
    sealPressure: values.seal ? pressure : 0,
    holdingForce: values.seal ? pressure * Math.PI * (UPRIGHT.eyeRadius ** 2 - UPRIGHT.shaftRadius ** 2) : 0,
    airPower: pressure * flow, maxMach: Math.max(losses.slotSpeed, losses.ductSpeed) / UPRIGHT.soundSpeed,
    pressureFraction: pressure / UPRIGHT.atmosphere};
}

/** Six selected fiber-bound markers share brush lanes with four rows of
 * bristles. Each release is the first modeled bottom encounter in that lane.
 * This prescribed event is not a prediction of carpet cleaning efficiency. */
export const uprightLanePhase = lane => .12 + lane * .17;
export function uprightReleaseTime(plan, index) {
  if (!Number.isInteger(index) || index < 0 || index >= UPRIGHT.markerCount) throw new RangeError('Unknown dust marker');
  if (index < UPRIGHT.looseCount) return 0;
  if (!plan.brushActive) return null;
  const period = TAU / UPRIGHT.brushRows, phase = uprightLanePhase(index - UPRIGHT.looseCount);
  const angle = ((3 * Math.PI / 2 - phase) % period + period) % period;
  return angle / (plan.brushRpm / 60 * TAU / UPRIGHT.slowdown);
}

export function sampleUpright(input = {}, time = 0) {
  validTime(time);
  const plan = uprightPlan(input), clock = Math.min(time, UPRIGHT.duration), elapsed = clock / UPRIGHT.slowdown;
  const releaseTimes = Array.from({length: UPRIGHT.markerCount}, (_, i) => uprightReleaseTime(plan, i));
  const unreleased = releaseTimes.filter(t => t === null || t > clock).length;
  const motorAngle = plan.motorRpm / 60 * TAU * elapsed, brushAngle = plan.brushRpm / 60 * TAU * elapsed;
  return {...plan, clock, elapsed, motorAngle, brushAngle, releaseTimes, unreleased,
    volume: plan.flow * elapsed, airEnergy: plan.airPower * elapsed,
    complete: clock >= UPRIGHT.duration};
}

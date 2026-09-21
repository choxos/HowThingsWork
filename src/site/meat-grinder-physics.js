import {validateControls, validTime} from './physics-kit.js';

const TAU = Math.PI * 2;
export const PLATES = Object.freeze([
  Object.freeze({value: 0, label: 'Fine plate: 4.5 mm holes', hole: 0.0045}),
  Object.freeze({value: 1, label: 'Medium plate: 6 mm holes', hole: 0.006}),
  Object.freeze({value: 2, label: 'Coarse plate: 8 mm holes', hole: 0.008}),
]);
export const MEATS = Object.freeze([
  Object.freeze({value: 0, label: 'Low resistance paste', stress: 5000, viscosity: 100}),
  Object.freeze({value: 1, label: 'Medium resistance paste', stress: 10000, viscosity: 200}),
  Object.freeze({value: 2, label: 'High resistance paste', stress: 20000, viscosity: 600}),
]);
export const KNIVES = Object.freeze([
  Object.freeze({value: 0, label: 'Sharp knife', torque: 0.2}),
  Object.freeze({value: 1, label: 'Dull knife', torque: 0.7}),
]);
export const GRINDER = Object.freeze({
  crank: 0.12, pitch: 0.025, root: 0.010, flight: 0.025, bore: 0.026, plateThickness: 0.006, openShare: 0.25,
  fill: 0.3, friction: 0.3, density: 1050, duration: 8,
});
export const GRINDER_DEFAULTS = Object.freeze({rate: 1, plate: 1, meat: 1, knife: 0, force: 30});
export const GRINDER_DOMAINS = Object.freeze({rate: [0.25, 2, 0.25], plate: [0, 2, 1], meat: [0, 2, 1], knife: [0, 1, 1], force: [1, 60, 1]});

export const screwEfficiency = () => {
  const lead = Math.atan(GRINDER.pitch / (TAU * (GRINDER.root + GRINDER.flight) / 2));
  return Math.tan(lead) / Math.tan(lead + Math.atan(GRINDER.friction));
};

// Buckingham-Reiner flow through the plate's identical round holes. SI units.
// ponytail: fully developed Bingham flow omits short-hole entrance/cutting losses;
// measured pressure/flow and food rheology would be needed for appliance prediction.
export function grinderFlowAtPressure(pressure, hole, stress, viscosity, holes) {
  const threshold = 4 * stress * GRINDER.plateThickness / hole;
  if (pressure <= threshold) return 0;
  const a = threshold / pressure;
  // Factored form avoids subtracting nearly equal terms just above yield.
  return holes * Math.PI * (hole / 2) ** 4 * pressure / (8 * viscosity * GRINDER.plateThickness)
    * (1 - a) ** 2 * (a * a + 2 * a + 3) / 3;
}

export function grinderPlan(input = {}) {
  const values = validateControls(input, GRINDER_DEFAULTS, GRINDER_DOMAINS, 'meat grinder');
  const g = GRINDER, eta = screwEfficiency(), hole = PLATES[values.plate].hole;
  const {stress, viscosity} = MEATS[values.meat], barrelArea = Math.PI * g.bore ** 2;
  const perTurn = Math.PI * (g.flight ** 2 - g.root ** 2) * g.pitch * g.fill;
  const holes = Math.floor(g.openShare * barrelArea / (Math.PI * hole ** 2 / 4)), openArea = holes * Math.PI * hole ** 2 / 4;
  const knifeTorque = KNIVES[values.knife].torque, yieldPressure = 4 * stress * g.plateThickness / hole;
  const flowAt = pressure => grinderFlowAtPressure(pressure, hole, stress, viscosity, holes);
  const requestedFlow = perTurn * values.rate;
  let low = yieldPressure, high = yieldPressure * 2;
  while (flowAt(high) < requestedFlow) high *= 2;
  for (let i = 0; i < 64; i++) { const mid = (low + high) / 2; if (flowAt(mid) < requestedFlow) low = mid; else high = mid; }
  const requestedPressure = (low + high) / 2;
  // Work per turn closes explicitly: input = pressure*volume/eta + knife work.
  // The channel filling fraction is an imposed positive-displacement approximation.
  const demandedTorque = requestedPressure * perTurn / (TAU * eta) + knifeTorque;
  const handForce = demandedTorque / g.crank;
  const breakawayForce = (yieldPressure * perTurn / (TAU * eta) + knifeTorque) / g.crank;
  const availablePressure = Math.max(0, (values.force * g.crank - knifeTorque) * TAU * eta / perTurn);
  const stalled = availablePressure <= yieldPressure;
  const pressure = stalled ? 0 : Math.min(requestedPressure, availablePressure);
  const flow = stalled ? 0 : Math.min(requestedFlow, flowAt(pressure)), rate = flow / perTurn;
  const limited = !stalled && values.force < handForce;
  const augerTorque = pressure * perTurn / (TAU * eta), torque = stalled ? 0 : augerTorque + knifeTorque;
  const appliedForce = stalled ? values.force : torque / g.crank;
  const handPower = torque * TAU * rate, pressurePower = pressure * flow, knifePower = knifeTorque * TAU * rate;
  const screwLoss = pressurePower * (1 / eta - 1), massPerTurn = perTurn * g.density;
  return {values, eta, hole, stress, viscosity, holes, openArea, barrelArea, perTurn, massPerTurn,
    yieldPressure, requestedPressure, availablePressure, pressure, breakawayForce, handForce, appliedForce,
    demandedTorque, augerTorque, knifeTorque, torque, stalled, limited, turns: !stalled, rate, flow,
    massFlow: flow * g.density, strandSpeed: flow / openArea, handPower, pressurePower, knifePower, screwLoss,
    push: pressure * perTurn / g.pitch, plateLoad: pressure * (barrelArea - Math.PI * 0.003 ** 2),
    leverage: TAU * g.crank / g.pitch * eta, knifeShare: handPower ? knifePower / handPower : 0};
}

export function sampleGrinder(input = {}, time = 0) {
  validTime(time);
  const plan = grinderPlan(input), elapsed = Math.min(GRINDER.duration, time), angle = TAU * plan.rate * elapsed;
  const complete = elapsed >= GRINDER.duration, running = elapsed > 0 && !complete && !plan.stalled;
  return {...plan, elapsed, angle, crankTurns: angle / TAU, minced: plan.massFlow * elapsed,
    strand: plan.strandSpeed * elapsed, meatTravel: GRINDER.pitch * plan.rate * elapsed,
    work: plan.handPower * elapsed, pressureWork: plan.pressurePower * elapsed,
    knifeWork: plan.knifePower * elapsed, screwHeat: plan.screwLoss * elapsed,
    rateNow: running ? plan.rate : 0, pressureNow: running ? plan.pressure : 0,
    mode: elapsed === 0 ? 'ready' : complete ? 'complete' : plan.stalled ? 'stalled' : plan.limited ? 'limited' : 'mincing', complete};
}

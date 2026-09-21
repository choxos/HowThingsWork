import {validateControls, validTime} from './physics-kit.js';

// Vacuum cleaners: a fan that makes suction, the air path that uses it up, and
// the air speed at the nozzle that lifts dirt. Two layouts share the physics:
// a canister cleaner, whose bag and filter sit before its fan so only clean air
// reaches the fan, and a classic upright, whose fan sits in the floor head and
// blows the dirty air up into a bag on the handle.
//
// Units: SI inside. Readings convert to liters a second, kilopascals, watts.
//
// The fans. A fan's pressure rise falls as it moves more air:
// p = p_sealed (1 - x^2), with x = Q / Q_max. Its efficiency peaks halfway
// along and falls to nothing at either end, eta = 4 eta_peak x (1 - x), so the
// power it takes from the motor, p Q / eta, is p_sealed Q_max (1 + x) /
// (4 eta_peak): least when nothing flows. The canister's fan, a many-bladed
// high-speed stage, seals at 22 kPa, runs out at 45 L/s and peaks at 45%
// efficient. The upright's, with a few flat radial blades that grit can pass,
// seals at 12 kPa, runs out at 50 L/s and peaks at 35%. Each motor loses a
// further 60 W as heat, and the upright's belt and brush roll take 40 W more.
//
// The air path. The nozzle's slot, where the air speeds up to v = Q / A and the
// pressure drops by (1 + K) rho v^2 / 2, K being the slot's entry loss; the hose
// and wand, or the upright's duct and fill tube, losing f (L / D) rho u^2 / 2
// with Blasius's f = 0.316 / Re^0.25 for turbulent flow in a smooth tube; the
// dust bag, a porous layer losing pressure in proportion to the flow, four
// times as much when full; and the exhaust filter, likewise, three times as
// much when clogged. The fan and the path settle at the flow where the fan's
// pressure rise equals the path's losses.
//
// Pressure along the way, measured from the room's. The canister's air falls
// below the room's through every piece and its fan lifts it back, so its bag is
// sucked. The upright's air falls only through the slot; its fan lifts it above
// the room's and it falls back through duct, bag and filter, so its bag is
// blown up.
//
// A sock over the nozzle stops the flow. Every loss vanishes with the flow, so
// the fan's whole sealed pressure holds the sock against the slot.
//
// Lifting dirt. A grain is taken to lift when the air in the slot moves at one
// and a half times the speed it would fall at through still air. That speed
// balances the grain's weight, less its buoyancy, against drag C rho v^2 / 2
// on its cross-section, with Schiller and Naumann's drag coefficient
// C = 24 / Re (1 + 0.15 Re^0.687) up to Re = 1,000 and 0.44 beyond. Fine dust
// falls slowly but clings to carpet fibers; it comes up only where a brush roll
// beats it loose.
//
// Not modeled: the motor's speed changing with its load, leaks round the
// nozzle's edges, the bag filling as it works, the hose's corrugations,
// cyclone separation, carpet pile closing the slot, and a brush roll flicking
// large grains into the air.

export const AIR = Object.freeze({density: 1.2, viscosity: 1.8e-5, g: 9.81});
export const CREVICE = Object.freeze({width: 0.025, gap: 0.008, entry: 1});
export const NOZZLE_OPTIONS = Object.freeze([
  Object.freeze({value: 0, label: 'Floor head'}),
  Object.freeze({value: 1, label: 'Crevice tool'}),
  Object.freeze({value: 2, label: 'Sock over the floor head'}),
]);
export const DEBRIS = Object.freeze([
  Object.freeze({value: 0, label: 'Sand', noun: 'sand', diameter: 1e-3, density: 2600}),
  Object.freeze({value: 1, label: 'Rice', noun: 'rice', diameter: 5e-3, density: 1500}),
  Object.freeze({value: 2, label: 'Dust in carpet', noun: 'carpet dust', diameter: 5e-5, density: 2600}),
]);
export const PATHS = Object.freeze({
  canister: Object.freeze({
    fan: Object.freeze({sealed: 22000, maxFlow: 0.045, efficiency: 0.45}),
    head: Object.freeze({width: 0.25, gap: 0.006, entry: 1.5}),
    diameter: 0.032, length: 2.6, bag: 1.2e5, filter: 5e4, motorLoss: 60, brush: 0,
    order: Object.freeze(['nozzle', 'hose', 'bag', 'filter', 'fan']),
  }),
  upright: Object.freeze({
    fan: Object.freeze({sealed: 12000, maxFlow: 0.05, efficiency: 0.35}),
    head: Object.freeze({width: 0.3, gap: 0.006, entry: 1.5}),
    diameter: 0.04, length: 0.6, bag: 6e4, filter: 5e4, motorLoss: 60, brush: 40,
    order: Object.freeze(['nozzle', 'fan', 'hose', 'bag', 'filter']),
  }),
});
export const VACUUM_DEFAULTS = Object.freeze({nozzle: 0, bag: 0, filter: 0, debris: 0});
export const VACUUM_DOMAINS = Object.freeze({nozzle: [0, 2, 1], bag: [0, 100, 25], filter: [0, 1, 1], debris: [0, 2, 1]});

export const nozzleOf = (path, value) => (value === 1 ? {...CREVICE, blocked: false} : {...path.head, blocked: value === 2});
export const fanPressure = (fan, Q) => fan.sealed * (1 - (Q / fan.maxFlow) ** 2);
export const fanEfficiency = (fan, Q) => 4 * fan.efficiency * (Q / fan.maxFlow) * (1 - Q / fan.maxFlow);
/** Power the fan takes from its motor: p Q / eta, written so it holds when nothing flows. */
export const shaftPower = (fan, Q) => fan.sealed * fan.maxFlow * (1 + Q / fan.maxFlow) / (4 * fan.efficiency);
export const dragCoefficient = reynolds => (reynolds > 1000 ? 0.44 : 24 / reynolds * (1 + 0.15 * reynolds ** 0.687));

/** Speed a grain falls at through still air, where drag balances its weight less buoyancy. */
export function fallSpeed(grain) {
  const weight = Math.PI * grain.diameter ** 3 / 6 * (grain.density - AIR.density) * AIR.g, area = Math.PI * grain.diameter ** 2 / 4;
  let lo = 0, hi = 100;
  for (let i = 0; i < 100; i++) {
    const v = (lo + hi) / 2, reynolds = AIR.density * v * grain.diameter / AIR.viscosity;
    if (dragCoefficient(reynolds) * AIR.density * v * v / 2 * area < weight) lo = v; else hi = v;
  }
  return (lo + hi) / 2;
}

/** Pressure lost along a path at a flow, piece by piece. */
export function losses(path, values, Q) {
  const nozzle = nozzleOf(path, values.nozzle), slotArea = nozzle.width * nozzle.gap, slotSpeed = Q / slotArea;
  const area = Math.PI * path.diameter ** 2 / 4, hoseSpeed = Q / area, reynolds = AIR.density * hoseSpeed * path.diameter / AIR.viscosity;
  const friction = reynolds > 0 ? 0.316 / reynolds ** 0.25 : 0;
  const drops = {
    nozzle: (1 + nozzle.entry) * AIR.density * slotSpeed ** 2 / 2,
    hose: friction * path.length / path.diameter * AIR.density * hoseSpeed ** 2 / 2,
    bag: path.bag * (1 + 3 * values.bag / 100) * Q,
    filter: path.filter * (values.filter ? 3 : 1) * Q,
  };
  return {slotArea, slotSpeed, hoseArea: area, hoseSpeed, reynolds, friction, ...drops, total: drops.nozzle + drops.hose + drops.bag + drops.filter};
}

const cache = new Map();

export function vacuumPlan(input = {}, kind = 'canister') {
  const path = PATHS[kind];
  if (!path) throw new RangeError(`Unknown vacuum cleaner ${kind}`);
  const values = validateControls(input, VACUUM_DEFAULTS, VACUUM_DOMAINS, `${kind} vacuum cleaner`);
  const key = kind + JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const fan = path.fan, nozzle = nozzleOf(path, values.nozzle);
  let flow = 0;
  if (!nozzle.blocked) {
    let lo = 0, hi = fan.maxFlow;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (fanPressure(fan, mid) > losses(path, values, mid).total) lo = mid; else hi = mid; }
    flow = (lo + hi) / 2;
  }
  const loss = losses(path, values, flow), pressure = fanPressure(fan, flow);
  const drops = {nozzle: nozzle.blocked ? pressure : loss.nozzle, hose: loss.hose, bag: loss.bag, filter: loss.filter};
  const profile = [{piece: 'room', pressure: 0}];
  let level = 0;
  for (const piece of path.order) { level += piece === 'fan' ? pressure : -drops[piece]; profile.push({piece, pressure: level}); }
  const shaft = shaftPower(fan, flow), grain = DEBRIS[values.debris], fall = fallSpeed(grain), needed = 1.5 * fall;
  const beaten = values.debris !== 2 || (path.brush > 0 && values.nozzle === 0);
  const plan = {
    values, kind, path, opening: nozzle, flow, ...loss, ...drops, pressure, profile,
    insideBag: profile[path.order.indexOf('bag')].pressure,
    airPower: pressure * flow, nozzlePower: drops.nozzle * flow, efficiency: fanEfficiency(fan, flow), shaft,
    electrical: shaft + path.motorLoss + path.brush,
    sockForce: nozzle.blocked ? pressure * nozzle.width * nozzle.gap : 0,
    grain, fall, needed, beaten, lifted: flow > 0 && loss.slotSpeed >= needed && beaten,
  };
  if (cache.size > 48) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

/** The cleaner a while after switching on: the air it has moved and the energy it has used. */
export function sampleVacuum(input = {}, time = 0, kind = 'canister') {
  validTime(time);
  const plan = vacuumPlan(input, kind);
  return {...plan, time, air: plan.flow * time, energy: plan.electrical * time};
}

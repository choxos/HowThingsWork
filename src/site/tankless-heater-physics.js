// A direct, non-condensing tankless heater with an ideal temperature-priority
// controller. Capacity, volumes and timing are illustrative, not product data.
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const HEATER_DEFAULTS = freeze({flow: 8, set: 45, inlet: 10, pipe: 5});
export const HEATER_DOMAINS = freeze({flow: [0, 12, 1], set: [35, 55, 10], inlet: [5, 20, 5], pipe: [2, 10, 1]});
export const HEATER_OPTIONS = freeze({
  flow: [{value: 0, label: 'Closed'}, {value: 1, label: 'Trickle: 1 L/min'}, {value: 4, label: '4 L/min'}, {value: 8, label: '8 L/min'}, {value: 12, label: '12 L/min'}],
  set: [35, 45, 55].map(value => ({value, label: `${value} °C`})),
  inlet: [5, 10, 20].map(value => ({value, label: `${value} °C`})),
  pipe: [2, 5, 10].map(value => ({value, label: `${value} meters`})),
});
export const HEATER_PHYSICS = freeze({
  density: 1, specificHeat: 4186, capacity: 24000, waterShare: .8,
  activationFlow: 1.5, coilLiters: .5, pipeBore: .014,
  purgeTime: 2, ignitionTime: .5, steadyTime: 6, runOnTime: 2,
  unheatedTime: 8, closedTime: 4, playbackRate: 2,
});
export function heaterSettings(input = {}, base = HEATER_DEFAULTS) {
  const result = {...base};
  for (const key of Object.keys(HEATER_DEFAULTS)) {
    const value = input?.[key];
    if (Number.isFinite(value) && HEATER_OPTIONS[key].some(option => option.value === value)) result[key] = value;
  }
  return result;
}

const plans = new Map();
export function tanklessHeaterPlan(input = {}) {
  const values = heaterSettings(input), key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const P = HEATER_PHYSICS, rise = values.set - values.inlet, active = values.flow >= P.activationFlow;
  const capacityFlow = P.capacity * 60 / (P.density * P.specificHeat * rise);
  const flow = active ? Math.min(values.flow, capacityFlow) : values.flow;
  const heat = active ? flow / 60 * P.density * P.specificHeat * rise : 0;
  const pipeLiters = Math.PI * (P.pipeBore / 2) ** 2 * values.pipe * 1000;
  const coilTime = flow > 0 ? P.coilLiters * 60 / flow : 0, pipeTime = flow > 0 ? pipeLiters * 60 / flow : 0;
  const lightAt = P.purgeTime + P.ignitionTime;
  const warmAt = active ? lightAt + pipeTime : null, hotAt = active ? lightAt + coilTime + pipeTime : null;
  const closeAt = active ? hotAt + P.steadyTime : values.flow > 0 ? P.unheatedTime : P.closedTime;
  const duration = closeAt + (active ? P.runOnTime : values.flow > 0 ? 1 : 0);
  const plan = freeze({values, rise, active, capacityFlow, flow, heat, pipeLiters, coilTime, pipeTime,
    lightAt, warmAt, hotAt, closeAt, duration, limited: active && flow < values.flow - 1e-9});
  plans.set(key, plan);return plan;
}

const observedTime = (plan, time) => clamp(Number.isFinite(time) ? time : 0, 0, plan.closeAt);
// Integral of the unit outlet-temperature ramp. The ramp grows for one coil
// residence time, then remains at one. Its input is time since ignition.
function rampIntegral(time, residence) {
  const elapsed = Math.max(0, time);
  return elapsed < residence ? elapsed * elapsed / (2 * residence) : elapsed - residence / 2;
}
export function heaterCoilTemperature(plan, fraction, time) {
  if (!plan.active) return plan.values.inlet;
  const position = clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1);
  const elapsed = Math.max(0, observedTime(plan, time) - plan.lightAt);
  return plan.values.inlet + plan.rise * Math.min(position, elapsed / plan.coilTime);
}
export function heaterPipeTemperature(plan, fraction, time) {
  if (!plan.active) return plan.values.inlet;
  const position = clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1);
  return heaterCoilTemperature(plan, 1, observedTime(plan, time) - position * plan.pipeTime);
}
export function tanklessHeaterAt(plan, time) {
  const P = HEATER_PHYSICS, clock = clamp(Number.isFinite(time) ? time : 0, 0, plan.duration);
  const stoppedAt = Math.min(clock, plan.closeAt), elapsed = Math.max(0, stoppedAt - plan.lightAt);
  const tapOpen = clock > 0 && clock < plan.closeAt && plan.values.flow > 0;
  const lit = plan.active && clock >= plan.lightAt && clock < plan.closeAt;
  const fan = plan.active && clock > 0 && clock < plan.duration, complete = clock >= plan.duration;
  let phase = clock === 0 ? 'ready' : complete ? 'complete' : clock >= plan.closeAt ? (plan.active ? 'fan-run-on' : 'closed')
    : !plan.values.flow ? 'closed' : !plan.active ? 'trickle' : clock < P.purgeTime ? 'purging'
      : clock < plan.lightAt ? 'igniting' : clock < plan.warmAt ? 'pipe-transit' : clock < plan.hotAt ? 'warming' : 'hot';
  const outletIntegral = plan.active ? rampIntegral(elapsed, plan.coilTime) : 0;
  const tapIntegral = plan.active ? rampIntegral(elapsed - plan.pipeTime, plan.coilTime) : 0;
  const waterEnergy = plan.heat * elapsed, fuelEnergy = waterEnergy / P.waterShare;
  const coilEnergy = plan.heat * (elapsed - outletIntegral), pipeEnergy = plan.heat * (outletIntegral - tapIntegral);
  const deliveredEnergy = plan.heat * tapIntegral;
  const tapTemperature = heaterPipeTemperature(plan, 1, clock), coilTemperature = heaterCoilTemperature(plan, 1, clock);
  const flow = tapOpen ? plan.flow : 0, heat = lit ? plan.heat : 0, fuel = heat / P.waterShare;
  return {clock, phase, complete, tapOpen, lit, fan, spark: plan.active && clock >= P.purgeTime && clock < plan.lightAt + .12,
    flow, heat, fuel, loss: fuel - heat, coilTemperature, tapTemperature,
    deliveredLiters: plan.flow / 60 * stoppedAt, hotLiters: plan.active ? plan.flow / 60 * Math.max(0, stoppedAt - plan.hotAt) : 0,
    fuelValve: lit ? plan.heat / P.capacity : 0, waterValve: tapOpen ? plan.flow / plan.values.flow : 0,
    waterEnergy, fuelEnergy, lostEnergy: fuelEnergy - waterEnergy, coilEnergy, pipeEnergy, deliveredEnergy,
    energyResidual: waterEnergy - coilEnergy - pipeEnergy - deliveredEnergy};
}

export function createTanklessHeaterController() {
  let values = {...HEATER_DEFAULTS}, plan = tanklessHeaterPlan(values), clock = 0;
  const getState = () => ({values: {...values}, clock, duration: plan.duration, active: plan.active,
    actualFlow: plan.flow, capacityFlow: plan.capacityFlow, targetHeat: plan.heat, limited: plan.limited,
    coilTime: plan.coilTime, pipeTime: plan.pipeTime, pipeLiters: plan.pipeLiters, lightAt: plan.lightAt,
    warmAt: plan.warmAt, hotAt: plan.hotAt, closeAt: plan.closeAt, now: tanklessHeaterAt(plan, clock)});
  const update = (input = {}) => {
    const next = heaterSettings(input, values);
    if (Object.keys(values).some(key => values[key] !== next[key])) {values = next;plan = tanklessHeaterPlan(values);clock = 0;}
    return getState();
  };
  const reset = (initial = {}) => {values = heaterSettings(initial?.settings);plan = tanklessHeaterPlan(values);clock = 0;return getState();};
  const advance = seconds => {if (Number.isFinite(seconds) && seconds > 0) clock = Math.min(plan.duration, clock + seconds);return getState();};
  const replayState = () => ({settings: {...values}});
  return {getState, update, reset, advance, replayState};
}

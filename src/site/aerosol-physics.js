import {validateControls, validTime} from './physics-kit.js';
import {AE, AS, aerosolEquilibrium, aerosolFromEnergy, aerosolLiquidEnergy, aerosolVaporEnergy} from './aerosol-equilibrium.js';

// The vessel is rigid. Each species and vessel energy are conserved across
// withdrawal and re-equilibration. The outlet is an assigned, quasi-steady
// single-phase approximation; flashing and droplet breakup are not solved.
export const AEROSOL = Object.freeze({atmosphere: AE.atmosphere, R: AE.R, brimful: AE.volume, residual: 6e-6, orifice: 4.5e-4, discharge: 0.7, film: 10, area: 0.0475, duration: 180, dt: 0.1, every: 0.5, speed: 6});
export const AEROSOL_DEFAULTS = Object.freeze({propellant: 0, temperature: 20, orientation: 0, button: 1});
export const AEROSOL_DOMAINS = Object.freeze({propellant: [0, 1, 1], temperature: [0, 50, 5], orientation: [0, 1, 1], button: [0, 3, 1]});
export const PROPELLANT_OPTIONS = Object.freeze([{value: 0, label: 'Liquefied propane and isobutane'}, {value: 1, label: 'Compressed nitrogen'}]);
export const aerosolButtonDown = (values, time) => time < AEROSOL.duration && (values.button === 1 || (values.button === 2 && time < 10) || (values.button === 3 && time < 120));
export const holeArea = () => Math.PI * AEROSOL.orifice ** 2 / 4;
export const liquidFlow = (gauge, density) => gauge > 0 ? AEROSOL.discharge * holeArea() * Math.sqrt(2 * gauge / density) : 0;
export function gasFlow(P, T, molar, gamma) {
  if (P <= AE.atmosphere) return 0;
  const ratio = AE.atmosphere / P, base = AEROSOL.discharge * holeArea() * P * Math.sqrt(molar / (AE.R * T));
  if (ratio <= (2 / (gamma + 1)) ** (gamma / (gamma - 1))) return base * Math.sqrt(gamma) * (2 / (gamma + 1)) ** ((gamma + 1) / (2 * (gamma - 1)));
  return base * Math.sqrt(2 * gamma / (gamma - 1) * (ratio ** (2 / gamma) - ratio ** ((gamma + 1) / gamma)));
}
export function aerosolInitialAmounts(values) {
  if (values.propellant === 1) return [0.27 / AS[0].molar, 0, 0, 1e6 * 2e-4 / (AE.R * AE.reference)];
  const blendMolar = 0.4 * AS[1].molar + 0.6 * AS[2].molar, propellant = 0.13 / blendMolar;
  return [0.12 / AS[0].molar, 0.4 * propellant, 0.6 * propellant, 0];
}
export function aerosolRates(s, values, time) {
  const heat = AEROSOL.film * AEROSOL.area * (values.temperature + 273.15 - s.T);
  const down = aerosolButtonDown(values, time), drawsLiquid = values.orientation === 0 && s.V > AEROSOL.residual + 1e-11;
  let volumeRate = 0, gasRate = 0, enthalpy = 0;
  const out = [0, 0, 0, 0], outLiquid = [...out], outVapor = [...out];
  if (down && s.P > AE.atmosphere + 1e-5) {
    if (drawsLiquid) {
      volumeRate = liquidFlow(s.P - AE.atmosphere, s.density);
      for (let i = 0; i < 3; i++) {
        outLiquid[i] = out[i] = volumeRate * s.liquid[i] / s.V;
        enthalpy += out[i] * (aerosolLiquidEnergy(i, s.T) + s.P * AS[i].molar / AS[i].density);
      }
    } else {
      const total = s.vapor.reduce((a, b) => a + b, 0), molar = s.vaporMass / total;
      const cp = s.vapor.reduce((sum, n, i) => sum + (i > 0 ? n * AS[i].molar * AS[i].vaporHeat : 0), 0) / total;
      gasRate = gasFlow(s.P, s.T, molar, cp / (cp - AE.R));
      for (let i = 1; i < 4; i++) {
        outVapor[i] = out[i] = gasRate / molar * s.vapor[i] / total;
        enthalpy += out[i] * (aerosolVaporEnergy(i, s.T) + AE.R * s.T);
      }
    }
  }
  return {down, drawsLiquid, heat, volumeRate, gasRate, massRate: volumeRate * s.density, out, outLiquidRate: outLiquid, outVaporRate: outVapor, enthalpy};
}

// One conservative step. A bracketed flux limiter handles the liquid pickup
// level and ambient-pressure endpoint without inventing negative inventory or
// drawing below room pressure. Its reduced rate is included in every account.
function stepAerosol(state, rates, dt, values, liquidEvent = true) {
  const candidate = scale => {
    const amounts = state.amounts.map((n, i) => n - rates.out[i] * dt * scale);
    if (amounts.some(n => n < 0)) return null;
    const U = state.U + rates.heat * dt - rates.enthalpy * dt * scale;
    const next = aerosolFromEnergy(amounts, U, state.T);
    return {next, U, scale};
  };
  let scale = 1;
  for (let i = 0; i < 4; i++) if (rates.out[i] > 0) scale = Math.min(scale, state.amounts[i] / (rates.out[i] * dt));
  let result = candidate(scale);
  const invalid = result => !result || (rates.down && rates.out.some(n => n > 0) && result.next.P < AE.atmosphere) || (liquidEvent && rates.volumeRate > 0 && result.next.V < AEROSOL.residual);
  if (invalid(result)) {
    let lo = 0, hi = scale;
    for (let i = 0; i < 36; i++) {
      const mid = (lo + hi) / 2, trial = candidate(mid);
      if (invalid(trial)) hi = mid; else lo = mid;
    }
    result = candidate(lo);
  }
  return {...result.next, U: result.U, limited: result.scale < 1 - 1e-10, heatAdded: state.heatAdded + rates.heat * dt,
    energyOut: state.energyOut + rates.enthalpy * dt * result.scale,
    outLiquid: state.outLiquid.map((n, i) => n + rates.outLiquidRate[i] * dt * result.scale),
    outVapor: state.outVapor.map((n, i) => n + rates.outVaporRate[i] * dt * result.scale)};
}

const cache = new Map();
export function aerosolPlan(input = {}, options = {}) {
  const values = validateControls(input, AEROSOL_DEFAULTS, AEROSOL_DOMAINS, 'aerosol can');
  const dt = options.dt ?? AEROSOL.dt;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1 || Math.abs(0.5 / dt - Math.round(0.5 / dt)) > 1e-8) throw new RangeError('Invalid aerosol integration step');
  const key = JSON.stringify(values);
  if (dt === AEROSOL.dt && cache.has(key)) return cache.get(key);
  const amounts = aerosolInitialAmounts(values), initial = aerosolEquilibrium(amounts, values.temperature + 273.15);
  let state = {...initial, heatAdded: 0, energyOut: 0, outLiquid: [0, 0, 0, 0], outVapor: [0, 0, 0, 0]};
  const samples = [], steps = Math.round(AEROSOL.duration / dt), stride = Math.round(AEROSOL.every / dt);
  let emptied = null;
  for (let n = 0; n <= steps; n++) {
    const time = n * dt, rates = aerosolRates(state, values, time);
    if (n % stride === 0) samples.push({...state, ...rates, t: time});
    if (n === steps) break;
    if (values.orientation === 0 && !rates.drawsLiquid && emptied === null) emptied = time;
    const middle = stepAerosol(state, rates, dt / 2, values);
    // State at exactly t=10 belongs to the released interval. Evaluate the
    // preceding midpoint from its own time so the last open step is retained.
    const midRates = aerosolRates(middle, values, time + dt / 2);
    // Crossing a pickup/pressure event is a partial Euler step to its endpoint.
    // Using the post-event midpoint rate for the whole interval would strand
    // liquid just above the tube or stall gas discharge just above ambient.
    state = stepAerosol(state, middle.limited || rates.drawsLiquid !== midRates.drawsLiquid ? rates : midRates, dt, values);
  }
  const plan = {values, initial, amounts, samples, emptied, dt};
  if (dt === AEROSOL.dt) { if (cache.size >= 32) cache.delete(cache.keys().next().value); cache.set(key, plan); }
  return plan;
}

export function sampleAerosol(input = {}, time = 0) {
  validTime(time);
  const plan = aerosolPlan(input), clock = Math.min(AEROSOL.duration, time);
  const index = Math.min(plan.samples.length - 2, Math.floor(clock / AEROSOL.every + 1e-9));
  const a = plan.samples[index], b = plan.samples[index + 1], u = Math.max(0, Math.min(1, (clock - a.t) / (b.t - a.t)));
  const interpolate = name => a[name] + (b[name] - a[name]) * u;
  const array = name => a[name].map((v, i) => v + (b[name][i] - v) * u);
  const amounts = array('amounts'), U = interpolate('U');
  const s = aerosolFromEnergy(amounts, U, interpolate('T')), rates = aerosolRates(s, plan.values, clock);
  const outLiquid = array('outLiquid'), outVapor = array('outVapor');
  const massOut = amounts.map((n, i) => (plan.amounts[i] - n) * AS[i].molar);
  const molesLiquidPropellant = s.liquid[1] + s.liquid[2], molesVaporPropellant = s.vapor[1] + s.vapor[2];
  return {...s, ...rates, clock, values: plan.values, plan, outLiquid, outVapor,
    heatAdded: interpolate('heatAdded'), energyOut: interpolate('energyOut'), massOut,
    gauge: s.P - AE.atmosphere, liquefied: plan.values.propellant === 0, upright: plan.values.orientation === 0,
    product: amounts[0] * AS[0].molar, sprayedProduct: massOut[0],
    liquidPropaneFraction: molesLiquidPropellant > 0 ? s.liquid[1] / molesLiquidPropellant : 0,
    vaporPropaneFraction: molesVaporPropellant > 0 ? s.vapor[1] / molesVaporPropellant : 0,
    netBoiled: s.vapor.map((n, i) => (n - plan.initial.vapor[i] + outVapor[i]) * AS[i].molar),
    jet: rates.volumeRate > 0 ? rates.volumeRate / holeArea() : 0};
}

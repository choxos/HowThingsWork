import {validateControls, validTime} from './physics-kit.js';

// Aerosol spray can: pressure held by a liquefied propellant or by squeezed
// nitrogen, liquid driven up a dip tube and out through a tiny hole, and the can
// cooling as its propellant boils.
//
// Units: SI inside. Readings convert to bar above the room's pressure, grams,
// milliliters and degrees Celsius.
//
// The can holds 500 mL brimful. Its valve opens into an actuator whose exit
// hole, 0.45 mm across with a discharge coefficient of 0.7, sets the flow. A
// dip tube runs from the valve to within 6 mL of the bottom.
//
// Liquefied propellant. The can holds 120 g of product, a non-volatile oil of
// molar mass 300 g/mol, dissolved in 130 g of liquid propellant: propane and
// isobutane, 40% propane by moles. Each hydrocarbon's vapor pressure comes from
// NIST's Antoine fit, log10(P / bar) = A - B / (T + C): for propane A = 4.53678,
// B = 1149.36, C = 24.906 (fitted from 277.6 K, used here down to 273 K), and
// for isobutane A = 4.3281, B = 1132.108, C = 0.918. By Raoult's law the
// propellant blend's pressure is the mole-weighted sum, and the oil lowers it
// in proportion to the propellant's share of the liquid's moles. However much
// is left, the gas above the liquid stays at that pressure: as liquid leaves,
// propellant boils to fill the space, taking 335 kJ from the can for each
// kilogram. The propellant's boiling point at the room's pressure comes from
// NIST's colder fits: propane A = 3.98292, B = 819.296, C = -24.417; isobutane
// A = 3.94417, B = 912.141, C = -29.808.
//
// Compressed nitrogen. The can holds 300 mL of liquid product and 200 mL of
// nitrogen filled at 10 bar at 20 °C. As liquid leaves, the nitrogen spreads
// into more room and its pressure falls, P V = n R T, doing work that cools the
// can slightly.
//
// The spray. Liquid leaves through the hole at Q = Cd A sqrt(2 dp / rho). When
// the dip tube draws gas instead, upside down or once the liquid is gone, gas
// leaves at the compressible orifice flow, choked while the can's pressure is
// more than about twice the room's. In a liquefied spray the propellant boils
// the moment it leaves: the share that flashes to vapor at once is
// c (T - T_boil) / L, which shatters the liquid into a fine mist.
//
// Heat. The can, its steel shell 55 g at 470 J/(kg K), and its contents, at
// 1,900 J/(kg K) for the product and 2,400 for liquid propellant, gain heat from
// the room at 10 W/(m^2 K) over 0.0475 m^2.
//
// Not modeled: the propellant's propane boiling off faster than its isobutane,
// the liquid swelling as it warms, friction in the dip tube and valve, vapor
// forming inside the valve, nitrogen dissolving in the product, and the hand
// warming the can.

export const AEROSOL = Object.freeze({
  atmosphere: 101325, R: 8.314462618, brimful: 5e-4, residual: 6e-6, orifice: 4.5e-4, discharge: 0.7,
  film: 10, area: 0.0475, shellMass: 0.055, shellHeat: 470, duration: 180, dt: 0.05, every: 0.1,
});
export const LIQUEFIED = Object.freeze({
  product: 0.12, productDensity: 900, productMolar: 0.3, productHeat: 1900,
  propellant: 0.13, propane: 0.4, liquidDensity: 536, liquidHeat: 2400, latent: 335e3, gamma: 1.12,
});
export const NITROGEN = Object.freeze({product: 0.27, productDensity: 900, productHeat: 1900, space: 2e-4, fillPressure: 1e6, fillTemperature: 293.15, molar: 0.028, gamma: 1.4});
export const ANTOINE = Object.freeze({
  propane: Object.freeze({A: 4.53678, B: 1149.36, C: 24.906, molar: 0.0441}),
  isobutane: Object.freeze({A: 4.3281, B: 1132.108, C: 0.918, molar: 0.05812}),
  propaneCold: Object.freeze({A: 3.98292, B: 819.296, C: -24.417}),
  isobutaneCold: Object.freeze({A: 3.94417, B: 912.141, C: -29.808}),
});
export const PROPELLANT_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'Liquefied propane and isobutane'}), Object.freeze({value: 1, label: 'Compressed nitrogen'})]);
export const AEROSOL_DEFAULTS = Object.freeze({propellant: 0, temperature: 20, orientation: 0});
export const AEROSOL_DOMAINS = Object.freeze({propellant: [0, 1, 1], temperature: [0, 50, 5], orientation: [0, 1, 1]});

const L = LIQUEFIED, N = NITROGEN, K = 273.15;
/** Vapor pressure in pascals from an Antoine fit in bar and kelvin. */
export const antoine = ({A, B, C}, T) => 1e5 * 10 ** (A - B / (T + C));
export const blendPressure = T => L.propane * antoine(ANTOINE.propane, T) + (1 - L.propane) * antoine(ANTOINE.isobutane, T);
export const BLEND_MOLAR = L.propane * ANTOINE.propane.molar + (1 - L.propane) * ANTOINE.isobutane.molar;
/** Molar mass of the vapor over the blend, richer in propane than the liquid. */
export const vaporMolar = T => {
  const propane = L.propane * antoine(ANTOINE.propane, T), isobutane = (1 - L.propane) * antoine(ANTOINE.isobutane, T);
  return (propane * ANTOINE.propane.molar + isobutane * ANTOINE.isobutane.molar) / (propane + isobutane);
};
/** The propellant blend's boiling point at the room's pressure, in kelvin. */
export const BOILING_POINT = (() => {
  let lo = 200, hi = 290;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (L.propane * antoine(ANTOINE.propaneCold, mid) + (1 - L.propane) * antoine(ANTOINE.isobutaneCold, mid) < AEROSOL.atmosphere) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
})();
export const holeArea = () => Math.PI * AEROSOL.orifice ** 2 / 4;
export const liquidFlow = (gauge, density) => (gauge > 0 ? AEROSOL.discharge * holeArea() * Math.sqrt(2 * gauge / density) : 0);
/** Mass flow of gas through the hole, choked or not. */
export function gasFlow(P, T, molar, gamma) {
  const room = AEROSOL.atmosphere;
  if (P <= room) return 0;
  const base = AEROSOL.discharge * holeArea() * P * Math.sqrt(molar / (AEROSOL.R * T)), ratio = room / P;
  if (ratio <= (2 / (gamma + 1)) ** (gamma / (gamma - 1))) return base * Math.sqrt(gamma) * (2 / (gamma + 1)) ** ((gamma + 1) / (2 * (gamma - 1)));
  return base * Math.sqrt(2 * gamma / (gamma - 1) * (ratio ** (2 / gamma) - ratio ** ((gamma + 1) / gamma)));
}

const cache = new Map();

export function aerosolPlan(input = {}) {
  const values = validateControls(input, AEROSOL_DEFAULTS, AEROSOL_DOMAINS, 'aerosol can');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const a = AEROSOL, room = values.temperature + K, liquefied = values.propellant === 0, upright = values.orientation === 0, dt = a.dt;
  let T = room, product = liquefied ? L.product : N.product, propellant = liquefied ? L.propellant : 0, vapor = 0;
  let nitrogen = liquefied ? 0 : N.fillPressure * N.space / (a.R * N.fillTemperature);
  let sprayedProduct = 0, sprayedPropellant = 0, sprayedGas = 0, boiled = 0, emptied = null;
  const volumeOf = liquidPropellant => (liquefied ? product / L.productDensity + liquidPropellant / L.liquidDensity : product / N.productDensity);
  const shareOf = liquidPropellant => { const moles = liquidPropellant / BLEND_MOLAR; return moles > 0 ? moles / (moles + product / L.productMolar) : 0; };
  const pressure = () => (liquefied ? shareOf(propellant) * blendPressure(T) : nitrogen * a.R * T / (a.brimful - volumeOf(0)));
  /** Vapor mass in equilibrium when `total` kilograms of propellant share the can at a temperature, by bisection. */
  const split = (total, temp) => {
    const pb = blendPressure(temp), mv = vaporMolar(temp), rt = a.R * temp;
    let lo = 0, hi = total;
    for (let i = 0; i < 40; i++) { const v = (lo + hi) / 2, liquid = total - v; if (v < shareOf(liquid) * pb * (a.brimful - volumeOf(liquid)) * mv / rt) lo = v; else hi = v; }
    return (lo + hi) / 2;
  };
  if (liquefied) { vapor = split(L.propellant, room); propellant = L.propellant - vapor; }
  const startPressure = pressure(), startLiquid = volumeOf(propellant), startMass = product + propellant + vapor + nitrogen * N.molar, startShare = shareOf(propellant);
  const samples = [], every = Math.round(a.every / dt);
  for (let n = 0; ; n++) {
    const time = n * dt, P = pressure(), V = volumeOf(propellant), density = liquefied ? (product + propellant) / V : N.productDensity;
    const drawsLiquid = upright && V > a.residual + 1e-12;
    const volumeRate = drawsLiquid ? Math.min(liquidFlow(P - a.atmosphere, density), (V - a.residual) / dt) : 0;
    const gasRate = drawsLiquid ? 0 : Math.min(gasFlow(P, T, liquefied ? vaporMolar(T) : N.molar, liquefied ? L.gamma : N.gamma), (liquefied ? vapor : nitrogen * N.molar) / dt);
    const heat = a.film * a.area * (room - T);
    if (n % every === 0) samples.push({t: time, P, T, V, density, volumeRate, massRate: volumeRate * density, gasRate, product, propellant, vapor, nitrogen, sprayedProduct, sprayedPropellant, sprayedGas, boiled, heat});
    if (time >= a.duration - 1e-9) break;
    if (upright && emptied === null && !drawsLiquid) emptied = time;
    const capacity = a.shellMass * a.shellHeat + product * (liquefied ? L.productHeat : N.productHeat) + propellant * L.liquidHeat;
    let work = 0;
    if (volumeRate > 0) {
      const mass = volumeRate * dt * density, fraction = product / (product + propellant);
      product -= mass * fraction; propellant -= mass * (1 - fraction);
      sprayedProduct += mass * fraction; sprayedPropellant += mass * (1 - fraction);
      if (!liquefied) work += P * volumeRate;
    }
    if (gasRate > 0) {
      const mass = gasRate * dt;
      sprayedGas += mass;
      if (liquefied) vapor -= mass;
      else { nitrogen -= mass / N.molar; work += gasRate * a.R / N.molar * T; }
    }
    if (liquefied) {
      // Boiling and cooling settle together: the new temperature is the one at
      // which the heat taken by the propellant that boils balances the can's loss.
      const total = propellant + vapor, before = vapor, supplied = heat * dt;
      let lo = T - 5, hi = T + 5;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (capacity * (mid - T) - supplied + L.latent * (split(total, mid) - before) > 0) hi = mid; else lo = mid;
      }
      T = (lo + hi) / 2;
      vapor = split(total, T); propellant = total - vapor; boiled += vapor - before;
    } else {
      T += (heat - work) * dt / capacity;
    }
  }
  const plan = {
    values, liquefied, upright, room, samples, emptied, startPressure, startLiquid, startMass, startShare,
    hotPressure: liquefied ? startShare * blendPressure(50 + K) : samples[0].nitrogen * a.R * (50 + K) / (a.brimful - samples[0].V),
    flash: liquefied ? L.liquidHeat * (room - BOILING_POINT) / L.latent : 0,
  };
  if (cache.size > 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

const FIELDS = ['P', 'T', 'V', 'density', 'volumeRate', 'massRate', 'gasRate', 'product', 'propellant', 'vapor', 'nitrogen', 'sprayedProduct', 'sprayedPropellant', 'sprayedGas', 'boiled', 'heat'];

/** The can a while after the button went down. */
export function sampleAerosol(input = {}, time = 0) {
  validTime(time);
  const plan = aerosolPlan(input), clock = Math.min(AEROSOL.duration, time), step = AEROSOL.every;
  const index = Math.min(plan.samples.length - 2, Math.floor(clock / step + 1e-9)), a = plan.samples[index], b = plan.samples[index + 1];
  const u = Math.max(0, Math.min(1, (clock - a.t) / (b.t - a.t))), now = {...plan, clock};
  for (const field of FIELDS) now[field] = a[field] + (b[field] - a[field]) * u;
  now.gauge = now.P - AEROSOL.atmosphere;
  now.boilRate = (b.boiled - a.boiled) / (b.t - a.t);
  now.jet = now.volumeRate > 0 ? Math.sqrt(2 * now.gauge / now.density) : 0;
  now.flashing = now.liquefied && now.volumeRate > 0 ? L.liquidHeat * (now.T - BOILING_POINT) / L.latent : 0;
  return now;
}

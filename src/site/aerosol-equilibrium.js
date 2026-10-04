// Original ideal-mixture teaching model. SI units; amounts are moles.
// Raoult partial pressures and ideal vapor share a rigid, nominal 500 mL space.
// Liquid volumes are additive. Heat capacities and reference vaporization
// enthalpies are assigned approximations, not a real-fluid equation of state.
export const AE = Object.freeze({R: 8.314462618, volume: 5e-4, reference: 293.15, atmosphere: 101325, shellCapacity: 0.055 * 470});
export const AS = Object.freeze([
  Object.freeze({name: 'Product', molar: 0.3, density: 900, liquidHeat: 1900}),
  Object.freeze({name: 'Propane', molar: 0.0440956, density: 500, liquidHeat: 2600, vaporHeat: 1750, latent: 360000}),
  Object.freeze({name: 'Isobutane', molar: 0.0581222, density: 560, liquidHeat: 2400, vaporHeat: 1650, latent: 350000}),
  Object.freeze({name: 'Nitrogen', molar: 0.0280134, vaporHeat: 3.5 * AE.R / 0.0280134}),
]);

export const AEROSOL_ANTOINE = Object.freeze({
  propaneCold: Object.freeze({A: 3.98292, B: 819.296, C: -24.417, min: 230.6, max: 320.7}),
  propaneWarm: Object.freeze({A: 4.53678, B: 1149.36, C: 24.906, min: 277.6, max: 360.8}),
  isobutaneCold: Object.freeze({A: 3.94417, B: 912.141, C: -29.808, min: 188.06, max: 261.54}),
  isobutaneWarm: Object.freeze({A: 4.3281, B: 1132.108, C: 0.918, min: 261.31, max: 408.12}),
});
const logPressure = (fit, T) => {
  if (T < fit.min || T > fit.max) throw new RangeError('Temperature outside the vapor-pressure fit');
  return Math.log(1e5) + Math.LN10 * (fit.A - fit.B / (T + fit.C));
};
export function aerosolSaturation(species, T) {
  const propane = species === 1;
  if (species !== 1 && species !== 2) throw new RangeError('Only volatile species have a saturation curve');
  const cold = AEROSOL_ANTOINE[propane ? 'propaneCold' : 'isobutaneCold'];
  const warm = AEROSOL_ANTOINE[propane ? 'propaneWarm' : 'isobutaneWarm'];
  const lo = propane ? 280 : 261.31, hi = propane ? 285 : 261.54;
  if (T <= lo) return Math.exp(logPressure(cold, T));
  if (T >= hi) return Math.exp(logPressure(warm, T));
  // Smoothly join two measured fits only inside their overlapping ranges.
  const u = (T - lo) / (hi - lo), w = u * u * (3 - 2 * u);
  return Math.exp((1 - w) * logPressure(cold, T) + w * logPressure(warm, T));
}

export const aerosolLiquidEnergy = (i, T) => AS[i].molar * AS[i].liquidHeat * (T - AE.reference);
export function aerosolVaporEnergy(i, T) {
  const s = AS[i], sensible = (s.molar * s.vaporHeat - AE.R) * (T - AE.reference);
  if (i === 3) return sensible;
  const referenceOffset = s.molar * s.latent - AE.R * AE.reference + aerosolSaturation(i, AE.reference) * s.molar / s.density;
  return sensible + referenceOffset;
}

/** Solve the isochoric flash with one monotone scalar equation.
 * alpha = vapor volume / (R T total liquid moles).
 * l_i = total_i / (1 + alpha Psat_i). No species can change identity.
 */
export function aerosolEquilibrium(amounts, T) {
  if (!Array.isArray(amounts) || amounts.length !== 4 || amounts.some(n => !Number.isFinite(n) || n < 0) || !Number.isFinite(T)) throw new RangeError('Invalid aerosol inventory or temperature');
  const [product, propane, isobutane, nitrogen] = amounts, rt = AE.R * T;
  const pv = [0, aerosolSaturation(1, T), aerosolSaturation(2, T)];
  const vl = AS.slice(0, 3).map(s => s.molar / s.density);
  const liquidVolumeIfAll = product * vl[0] + propane * vl[1] + isobutane * vl[2];
  if (liquidVolumeIfAll >= AE.volume) throw new RangeError('No aerosol headspace remains');
  const evaluate = alpha => {
    let f = alpha * rt * product + product * vl[0] - AE.volume, df = rt * product;
    for (let i = 1; i <= 2; i++) {
      const divisor = 1 + alpha * pv[i];
      f += amounts[i] * (alpha * rt + vl[i]) / divisor;
      df += amounts[i] * (rt - vl[i] * pv[i]) / divisor ** 2;
    }
    return [f, df];
  };
  let lo = 0, hi = AE.volume / (rt * Math.max(product, 1e-12)), alpha = Math.min(1e-6, hi / 2);
  let liquid = [product, 0, 0, 0];
  if (evaluate(hi)[0] >= 0 && propane + isobutane > 0) {
    for (let iteration = 0; iteration < 50; iteration++) {
      const [f, df] = evaluate(alpha);
      if (Math.abs(f) < 1e-16) break;
      if (f > 0) hi = alpha; else lo = alpha;
      const next = alpha - f / df;
      alpha = Number.isFinite(next) && next > lo && next < hi ? next : (lo + hi) / 2;
    }
    liquid = [product, propane / (1 + alpha * pv[1]), isobutane / (1 + alpha * pv[2]), 0];
  }
  const vapor = amounts.map((n, i) => n - liquid[i]);
  const V = liquid.reduce((sum, n, i) => sum + (i < 3 ? n * vl[i] : 0), 0), gasVolume = AE.volume - V;
  const partial = vapor.map(n => n * rt / gasVolume), P = partial.reduce((a, b) => a + b, 0);
  const liquidMass = liquid.reduce((sum, n, i) => sum + n * AS[i].molar, 0);
  const vaporMass = vapor.reduce((sum, n, i) => sum + n * AS[i].molar, 0);
  let U = AE.shellCapacity * (T - AE.reference);
  for (let i = 0; i < 4; i++) U += (i < 3 ? liquid[i] * aerosolLiquidEnergy(i, T) : 0) + (i > 0 ? vapor[i] * aerosolVaporEnergy(i, T) : 0);
  return {T, amounts: [...amounts], liquid, vapor, V, gasVolume, partial, P, liquidMass, vaporMass, density: liquidMass / Math.max(V, 1e-30), U};
}

/** Recover temperature from conserved vessel energy, with a safeguarded solve. */
export function aerosolFromEnergy(amounts, energy, guess = AE.reference) {
  if (!Number.isFinite(energy)) throw new RangeError('Invalid aerosol energy');
  if (amounts[1] + amounts[2] === 0) {
    const capacity = AE.shellCapacity + amounts[0] * AS[0].molar * AS[0].liquidHeat + amounts[3] * (AS[3].molar * AS[3].vaporHeat - AE.R);
    const T = AE.reference + energy / capacity;
    if (T < 235 || T > 340) throw new RangeError('Aerosol energy outside the modeled temperature range');
    return aerosolEquilibrium(amounts, T);
  }
  let lo = 235, hi = 340, T = Math.max(lo, Math.min(hi, guess));
  const initial = aerosolEquilibrium(amounts, T);
  if (Math.abs(initial.U - energy) < 1e-8) return initial;
  if (aerosolEquilibrium(amounts, lo).U > energy || aerosolEquilibrium(amounts, hi).U < energy) throw new RangeError('Aerosol energy outside the modeled temperature range');
  for (let i = 0; i < 40; i++) {
    const s = aerosolEquilibrium(amounts, T), error = s.U - energy;
    if (Math.abs(error) < 1e-8) return s;
    if (error > 0) hi = T; else lo = T;
    const dT = 1e-3, derivative = (aerosolEquilibrium(amounts, T + dT).U - aerosolEquilibrium(amounts, T - dT).U) / (2 * dT);
    const next = T - error / derivative;
    T = next > lo && next < hi ? next : (lo + hi) / 2;
  }
  throw new Error('Aerosol temperature solve did not converge');
}

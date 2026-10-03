// Chemours, Freon 410A Thermodynamic Properties (SI Units), pp. 1–3, 5–6.
// https://www.chemours.com/en/-/media/files/freon/freon-410a-si-thermodynamic-properties.pdf
// Pressures are absolute Pa; enthalpies are J/kg. These are fluid properties,
// not a rated air conditioner or a compressor performance map.
export const R410A = Object.freeze({
  name: 'R-410A', molar: 0.07258, boiling: -51.58,
  criticalTemperature: 72.13, criticalPressure: 4926100,
  vaporPressure: 1652900, vaporPressureAt: 25,
  // Fixed vapor heat capacity is an explicit teaching-model approximation.
  gasHeat: 840,
});

const K = 273.15, criticalK = R410A.criticalTemperature + K;
const pressureCoefficients = Object.freeze({
  bubble: Object.freeze([-1.437600, -6.871500, -0.5362300, -3.826420, -4.068750, -1.233300]),
  dew: Object.freeze([-1.440004, -6.865265, -0.5354309, -3.749023, -3.521484, -7.750000]),
});
const polynomial = (x, coefficients) => coefficients.reduceRight((sum, coefficient) => sum * x + coefficient, 0);

/** Manufacturer's bubble/dew pressure correlation, not a constant-latent fit. */
export function saturationPressure(celsius, phase = 'bubble') {
  if (!Number.isFinite(celsius) || celsius < -100 || celsius > R410A.criticalTemperature) throw new RangeError('R-410A saturation temperature outside supported range');
  if (!Object.hasOwn(pressureCoefficients, phase)) throw new RangeError('R-410A phase must be bubble or dew');
  const reduced = (celsius + K) / criticalK;
  return R410A.criticalPressure * Math.exp(polynomial(1 - reduced - 0.2086902, pressureCoefficients[phase]) / reduced);
}

/** Inverse of the same correlation; pressure is absolute, not gauge. */
export function saturationTemperature(pascals, phase = 'bubble') {
  let low = -100, high = R410A.criticalTemperature;
  if (!Number.isFinite(pascals) || pascals < saturationPressure(low, phase) || pascals > saturationPressure(high, phase)) throw new RangeError('R-410A saturation pressure outside supported range');
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (saturationPressure(mid, phase) < pascals) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Manufacturer's saturated-liquid enthalpy correlation. */
export function liquidEnthalpy(celsius) {
  if (!Number.isFinite(celsius) || celsius < -100 || celsius > R410A.criticalTemperature) throw new RangeError('R-410A liquid temperature outside supported range');
  const x = Math.cbrt(1 - (celsius + K) / criticalK) - 0.5541498;
  return 1000 * polynomial(x, [221.1749, -514.9668, -631.6250, -262.2749, 1052, 1596]);
}

// Saturated-vapor enthalpy from Table 1, every 5 °C over the evaporator's
// supported range. Linear interpolation error is checked against intermediate
// manufacturer rows, which are not interpolation nodes.
const vaporEnthalpies = Object.freeze([415.7, 417.6, 419.4, 421.0, 422.5, 423.9, 425.1, 426.1, 426.8, 427.3, 427.6, 427.5]);
export function vaporEnthalpy(celsius) {
  if (!Number.isFinite(celsius) || celsius < -20 || celsius > 35) throw new RangeError('R-410A vapor enthalpy outside evaporator range');
  const place = (celsius + 20) / 5, low = Math.min(vaporEnthalpies.length - 2, Math.floor(place));
  return 1000 * (vaporEnthalpies[low] + (place - low) * (vaporEnthalpies[low + 1] - vaporEnthalpies[low]));
}

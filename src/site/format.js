// Numbers for readings: a fixed number of digits, US digit grouping, no
// exponent form and never a negative zero.
export function fixed(value, digits = 1) {
  if (!Number.isFinite(value)) return 'n/a';
  const rounded = Number(value.toFixed(digits));
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
}

// Three significant figures for a reading, as the newer models print them, but
// never in exponent form: anything smaller than a millionth of the unit is
// numerical dust left after the motion or the current has died away, and reads 0.
export function significant(value, digits = 3) {
  if (!Number.isFinite(value)) return 'n/a';
  if (Math.abs(value) < 1e-6) return '0';
  return String(Number(value.toPrecision(digits)));
}

// Time already observed in a run, cut rather than rounded, so the reading shows
// the run's full length only once it has finished (9.996 s reads 9.99, not 10.00).
export function elapsedTime(seconds, digits = 2) {
  const scale = 10 ** digits;
  return (Math.floor(seconds * scale + 1e-6) / scale).toFixed(digits);
}

// An energy balance residual in joules: what is left when every store and every
// loss is taken from the work supplied. Below a nanojoule it is rounding, not physics.
export function energyResidual(joules) {
  if (!Number.isFinite(joules)) return 'n/a';
  return Math.abs(joules) < 1e-9 ? '< 1 nJ' : `${significant(joules)} J`;
}

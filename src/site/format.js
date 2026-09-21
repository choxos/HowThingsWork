// Numbers for readings: a fixed number of digits, US digit grouping, no
// exponent form and never a negative zero.
export function fixed(value, digits = 1) {
  if (!Number.isFinite(value)) return 'n/a';
  const rounded = Number(value.toFixed(digits));
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
}

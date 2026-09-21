// Small pieces every physics module needs: refuse bad controls and bad times
// the same way everywhere, and ease a staged motion without inventing a curve.

/** Controls merged over defaults, each finite, inside its [min, max] and on its step. */
export function validateControls(input, defaults, domains, what) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`Expected ${what} controls`);
  for (const key of Object.keys(input)) if (!Object.hasOwn(domains, key)) throw new RangeError(`Unknown control ${key}`);
  const values = {...defaults, ...input};
  for (const [key, [lo, hi, step]] of Object.entries(domains)) {
    const n = values[key];
    if (!Number.isFinite(n) || n < lo || n > hi || Math.abs((n - lo) / step - Math.round((n - lo) / step)) > 1e-8) throw new RangeError(`Invalid ${key}`);
  }
  return values;
}

export function validTime(time) {
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Invalid trial time');
  return time;
}

export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/** Smoothstep from 0 to 1: zero speed at both ends, for staged inspection motions only. */
export const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };

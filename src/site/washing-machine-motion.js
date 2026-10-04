// Constant-acceleration drum segments. Seconds and radians are physical;
// the display angle integrates the same speed with an explicit visual cap.
const TAU = 2 * Math.PI;
export const WASHER_PLAYBACK_RATE = 60;
export const WASHER_DRAWN_CAP = 120;

function integral(from, to, ramp, elapsed, cap) {
  const t = Math.max(0, elapsed), moving = Math.min(t, ramp);
  if (ramp <= 0 || from === to) return Math.min(to, cap) * t;
  const slope = (to - from) / ramp;
  const crossing = (cap - from) / slope;
  const stops = [0, ...(crossing > 0 && crossing < moving ? [crossing] : []), moving];
  let area = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    area += (Math.min(cap, from + slope * a) + Math.min(cap, from + slope * b)) * (b - a) / 2;
  }
  return area + Math.max(0, t - ramp) * Math.min(to, cap);
}

export function drumSegment(from, to, ramp, elapsed) {
  if (![from, to, ramp, elapsed].every(Number.isFinite) || Math.min(from, to, ramp, elapsed) < 0) {
    throw new RangeError('Drum motion requires finite, nonnegative values.');
  }
  const rpm = ramp > 0 ? from + (to - from) * Math.min(1, elapsed / ramp) : to;
  return {
    rpm,
    acceleration: elapsed < ramp ? (to - from) / ramp * TAU / 60 : 0,
    angle: integral(from, to, ramp, elapsed, Infinity) * TAU / 60,
    drawnAngle: integral(from, to, ramp, elapsed, WASHER_DRAWN_CAP) * TAU / 60 / WASHER_PLAYBACK_RATE,
  };
}

export function stageMotion(stage, time) {
  const elapsed = Math.max(0, Math.min(stage.end - stage.start, time - stage.start));
  const motion = drumSegment(stage.rpmFrom, stage.rpmTo, stage.ramp, elapsed);
  return {...motion, angle: stage.angle + motion.angle, drawnAngle: stage.drawnAngle + motion.drawnAngle};
}

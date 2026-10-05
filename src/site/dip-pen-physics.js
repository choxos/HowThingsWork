import {validateControls, validTime} from './physics-kit.js';

// Original teaching pen. Retained loads, flex compliance, wet film and motion
// schedule are assigned; the model conserves ink but does not solve wetting.
export const DIP_WRITE = Object.freeze({
  nibLength: 30, nibWidth: 7, thickness: .25, slit: 9, ventAt: 10, ventRadius: 1,
  gap: .02, compliance: .1, hairline: .1, film: .01, stroke: 40, speed: 10,
  tilt: Math.PI / 4, dipDepth: 3, clearHeight: 25, paperX: 60,
  loadEnd: .5, liftEnd: 1, transferEnd: 1.5, lowerEnd: 2, writeStart: 2.2,
  duration: 6.2, surfaceTension: .0728, density: 1000, gravity: 9.81,
});
export const DIP_WRITE_DEFAULTS = Object.freeze({press: 0, load: 2});
export const DIP_WRITE_DOMAINS = Object.freeze({press: [0, 1, .1], load: [0, 2, 1]});
export const DIP_LOADS = Object.freeze([0, .020, .045]); // mm³ = μL
export const DIP_LOAD_OPTIONS = Object.freeze([
  Object.freeze({value: 0, label: 'Dry nib: skip dipping'}),
  Object.freeze({value: 1, label: 'Small load: 0.020 μL'}),
  Object.freeze({value: 2, label: 'Full load: 0.045 μL'}),
]);
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => {const u = clamp(x); return u * u * (3 - 2 * u);};

/** Width of the slit at distance s above the tip. Flex vanishes at its root. */
export const dipGap = (force, s) => DIP_WRITE.gap + DIP_WRITE.compliance * force * (1 - s / DIP_WRITE.slit);

/** Volume occupied from tip to length, in the extruded tapered slot, mm³. */
export function dipSlotVolume(force, length) {
  const L = Math.max(0, Math.min(DIP_WRITE.slit, length)), a = DIP_WRITE.compliance * force;
  return DIP_WRITE.thickness * ((DIP_WRITE.gap + a) * L - a * L * L / (2 * DIP_WRITE.slit));
}

/** Invert slot volume without subtracting nearly equal roots. */
export function dipInkLength(force, volume) {
  const v = Math.max(0, Math.min(dipSlotVolume(force, DIP_WRITE.slit), volume)) / DIP_WRITE.thickness;
  const a = DIP_WRITE.compliance * force, b = DIP_WRITE.gap + a;
  return 2 * v / (b + Math.sqrt(Math.max(0, b * b - 2 * a * v / DIP_WRITE.slit)));
}

export function dipWritingPlan(input = {}) {
  const values = validateControls(input, DIP_WRITE_DEFAULTS, DIP_WRITE_DOMAINS, 'dip pen');
  const load = DIP_LOADS[values.load], splay = DIP_WRITE.compliance * values.press;
  const lineWidth = DIP_WRITE.hairline + splay, area = lineWidth * DIP_WRITE.film;
  return Object.freeze({values, load, splay, lineWidth, area, capacity: dipSlotVolume(0, DIP_WRITE.slit),
    inkedLength: Math.min(DIP_WRITE.stroke, load / area), duration: DIP_WRITE.duration,
    tipGap: DIP_WRITE.gap + splay,
    capillaryPressure: 2 * DIP_WRITE.surfaceTension / ((DIP_WRITE.gap + splay) * .001),
    gravityHead: DIP_WRITE.density * DIP_WRITE.gravity * DIP_WRITE.slit * .001 * Math.cos(DIP_WRITE.tilt),
  });
}

export function dipWritingAt(plan, time) {
  const t = Math.min(plan.duration, validTime(time)), W = DIP_WRITE;
  const loaded = plan.load * clamp(t / W.loadEnd);
  const phase = t < W.loadEnd ? (plan.load ? 'loading' : 'dry-start') : t < W.liftEnd ? 'lifting' : t < W.transferEnd ? 'moving-to-paper' : t < W.lowerEnd ? 'lowering' : t < W.writeStart ? 'applying-force' : t < W.duration ? 'writing' : 'complete';
  const force = plan.values.press * smooth((t - W.lowerEnd) / (W.writeStart - W.lowerEnd));
  const travel = Math.max(0, Math.min(W.stroke, (t - W.writeStart) * W.speed));
  const inked = Math.min(travel, plan.inkedLength), deposited = inked * plan.area;
  const remaining = Math.max(0, loaded - deposited);
  const x = W.paperX * smooth((t - W.liftEnd) / (W.transferEnd - W.liftEnd));
  let height;
  if (t < W.liftEnd) height = plan.load ? -W.dipDepth + (W.clearHeight + W.dipDepth) * smooth((t - W.loadEnd) / (W.liftEnd - W.loadEnd)) : W.clearHeight;
  else height = W.clearHeight * (1 - smooth((t - W.transferEnd) / (W.lowerEnd - W.transferEnd)));
  return {t, phase, force, travel, inked, deposited, remaining, loaded, inkLength: dipInkLength(force, remaining), x, height,
    z: travel, touching: t >= W.lowerEnd, writing: t >= W.writeStart && t < W.duration,
    exhausted: t >= W.writeStart && remaining <= 1e-12, done: t >= W.duration};
}
export const sampleDipWriting = (input, time = 0) => dipWritingAt(dipWritingPlan(input), time);

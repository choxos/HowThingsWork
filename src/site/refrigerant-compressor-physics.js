import {validateControls, validTime} from './physics-kit.js';
import {cycle, indicator, piston, cylinderPressure, swept, FRIDGE} from './refrigerator-physics.js';

export const COMPRESSOR_DEFAULTS = Object.freeze({evaporating: -20, condensing: 40, clearance: 4, angle: 0});
export const COMPRESSOR_DOMAINS = Object.freeze({evaporating: [-25, -10, 5], condensing: [25, 50, 5], clearance: [2, 8, 2], angle: [0, 360, 1]});
export const COMPRESSOR_STAGES = Object.freeze(['Re-expansion', 'Suction', 'Compression', 'Discharge']);

/** One steady ideal cylinder cycle. Boundary pressures are imposed by the coils. */
export function sampleCompressor(input = {}, advance = 0) {
  const values = validateControls(input, COMPRESSOR_DEFAULTS, COMPRESSOR_DOMAINS, 'compressor');
  validTime(advance);
  const angle = Math.min(360, values.angle + advance), theta = angle * Math.PI / 180;
  const c = cycle(values.evaporating, values.condensing, values.clearance / 100);
  const ind = indicator(c), pose = piston(theta, c.clearance), pressure = cylinderPressure(c, theta);
  const down = angle < 180;
  const stage = down ? (pose.volume < ind.reexpandedAt ? 0 : 1) : (pose.volume > ind.compressedAt ? 2 : 3);
  const suctionOpen = stage === 1 && angle > 0 && angle < 180;
  const dischargeOpen = stage === 3 && angle < 360;
  const freshVolume = ind.Vb - ind.reexpandedAt, mass = c.density * freshVolume;
  const lostVolume = ind.reexpandedAt - ind.Vc;
  // Pressure-volume loop is reversible adiabatic; separate efficiencies give
  // cycle-average shaft and electrical work, not an invented cylinder trace.
  const idealWork = mass * c.work * FRIDGE.efficiency;
  return {values, angle, theta, ...pose, pressure, cycle: c, indicator: ind, stage, stageName: COMPRESSOR_STAGES[stage], suctionOpen, dischargeOpen, freshVolume, lostVolume, mass, idealWork, complete: angle >= 360};
}

/** Mid-stroke snapshots adapt to the selected pressure ratio and clearance. */
export function compressorStageAngle(stage, input = {}) {
  const s = sampleCompressor({...input, angle: 0}), ind = s.indicator;
  const ends = [[ind.Vc, ind.reexpandedAt], [ind.reexpandedAt, ind.Vb], [ind.Vb, ind.compressedAt], [ind.compressedAt, ind.Vc]][stage];
  const target = (ends[0] + ends[1]) / 2;
  let lo = 0, hi = Math.PI;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (piston(mid, s.cycle.clearance).volume < target) lo = mid; else hi = mid; }
  const downAngle = (lo + hi) / 2 * 180 / Math.PI;
  return Math.round(stage < 2 ? downAngle : 360 - downAngle);
}

export {swept};

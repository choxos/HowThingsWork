import {validateControls, validTime} from './physics-kit.js';

// X-cut quartz, a uniform longitudinal stress and field, and stress-free sides.
// Reference coefficients: Boston Piezo-Optics. Electrode orientation is chosen
// so positive compression produces positive open-circuit voltage. The scalar
// reduction retains longitudinal coupling, not the complete quartz tensor.
export const PIEZO = Object.freeze({d: 2.3e-12, compliance: 12.77e-12,
  relativePermittivity: 4.52, epsilon0: 8.8541878128e-12,
  area: 1e-4, thickness: 1e-3, duration: 8, releaseTime: 4});
export const PIEZO_DEFAULTS = Object.freeze({mode: 0, force: 10, rise: .25, load: 2, capacitance: 0, voltage: 50, blocked: 0});
export const PIEZO_DOMAINS = Object.freeze({mode: [0, 1, 1], force: [0, 50, 1], rise: [.05, 2, .05], load: [0, 3, 1], capacitance: [0, 100, 5], voltage: [-50, 50, 5], blocked: [0, 1, 1]});
export const PIEZO_MODES = Object.freeze([{value: 0, label: 'Force → voltage'}, {value: 1, label: 'Voltage → motion'}]);
export const PIEZO_LOADS = Object.freeze([{value: 0, label: 'Ideal open circuit', resistance: Infinity}, {value: 1, label: '1 GΩ load', resistance: 1e9}, {value: 2, label: '100 GΩ load', resistance: 1e11}, {value: 3, label: '1,000 GΩ load', resistance: 1e12}]);

export function piezoPlan(input = {}) {
  const values = validateControls(input, PIEZO_DEFAULTS, PIEZO_DOMAINS, 'piezoelectricity');
  const compliance = PIEZO.compliance * PIEZO.thickness / PIEZO.area;
  const crystalCapacitance = PIEZO.epsilon0 * PIEZO.relativePermittivity * PIEZO.area / PIEZO.thickness;
  const capacitance = crystalCapacitance + (values.mode ? 0 : values.capacitance * 1e-12);
  const resistance = values.mode ? Infinity : PIEZO_LOADS[values.load].resistance;
  return {values, compliance, crystalCapacitance, capacitance, resistance,
    // Only thickness is clamped; this is not the fully clamped tensor epsilon^S.
    blockedCapacitance: crystalCapacitance - PIEZO.d ** 2 / compliance,
    timeConstant: resistance * capacitance, duration: PIEZO.duration,
    magnification: values.mode ? 2e6 : 1e5};
}

export function piezoProtocol(time, rise) {
  validTime(time);
  if (!Number.isFinite(rise) || rise < .05 || rise > 2) throw new RangeError('Invalid rise time');
  if (time < rise) return {fraction: time / rise, rate: 1 / rise, phase: 'Applying'};
  if (time < PIEZO.releaseTime) return {fraction: 1, rate: 0, phase: 'Holding'};
  if (time < PIEZO.releaseTime + rise) return {fraction: 1 - (time - PIEZO.releaseTime) / rise, rate: -1 / rise, phase: 'Releasing'};
  return {fraction: 0, rate: 0, phase: 'Released'};
}

// Stable integrals of (1-exp(-u)) and its square. Direct subtraction loses
// precision close to zero, including the first animation frame after reset.
function exponentialIntegrals(u) {
  const a = -Math.expm1(-u), b = -.5 * Math.expm1(-2 * u);
  let ramp = u - a, square = u - 2 * a + b;
  if (u < .05) {
    ramp = square = 0;
    let term = u;
    for (let k = 2; k <= 14; k++) {
      term *= u / k;
      ramp += (k % 2 ? -1 : 1) * term;
      if (k >= 3) square += (k % 2 ? -1 : 1) * (2 - 2 ** (k - 1)) * term;
    }
  }
  return {a, b, ramp, square};
}

function forceSegment(plan, v0, f0, rate, dt) {
  const {capacitance: c, resistance: r, compliance: s, timeConstant: tau} = plan;
  const f = f0 + rate * dt;
  let voltage, integral, heat;
  if (!Number.isFinite(r)) {
    voltage = v0 + PIEZO.d * rate * dt / c;
    integral = (v0 + voltage) * dt / 2;
    heat = 0;
  } else {
    const u = dt / tau, {a, b, ramp, square} = exponentialIntegrals(u), w = PIEZO.d * rate * r;
    voltage = v0 * Math.exp(-u) + w * a;
    integral = tau * (v0 * a + w * ramp);
    heat = tau / r * (v0 * v0 * b + v0 * w * a * a + w * w * square);
  }
  // Work done by the force source: integral F dx, where x=sF-dV.
  const work = s * (f * f - f0 * f0) / 2 - PIEZO.d * (f * voltage - f0 * v0 - rate * integral);
  return {voltage, force: f, heat, work};
}

export function samplePiezoPlan(plan, time = 0) {
  validTime(time);
  const elapsed = Math.min(time, plan.duration), {values: v, compliance: s, capacitance: c} = plan;
  const protocol = piezoProtocol(elapsed, v.rise);
  let force, voltage, compression, heat = 0, mechanicalWork = 0, electricalWork = 0, current;
  if (v.mode === 0) {
    force = voltage = 0;
    const intervals = [[0, v.rise, v.force / v.rise], [v.rise, 4, 0], [4, 4 + v.rise, -v.force / v.rise], [4 + v.rise, plan.duration, 0]];
    for (const [start, end, rate] of intervals) {
      const dt = Math.max(0, Math.min(elapsed, end) - start);
      if (!dt) continue;
      const segment = forceSegment(plan, voltage, force, rate, dt);
      ({force, voltage} = segment); heat += segment.heat; mechanicalWork += segment.work;
    }
    // Force is a prescribed input, not an integrated state. Recover it from
    // the protocol so subtraction roundoff cannot leave a spurious load after
    // release (and a false force arrow in the drawing).
    force = v.force * protocol.fraction;
    compression = s * force - PIEZO.d * voltage;
    current = Number.isFinite(plan.resistance) ? voltage / plan.resistance : 0;
  } else {
    voltage = v.voltage * protocol.fraction;
    force = v.blocked ? PIEZO.d * voltage / s : 0;
    compression = v.blocked ? 0 : -PIEZO.d * voltage;
    const effectiveCapacitance = v.blocked ? plan.blockedCapacitance : c;
    current = effectiveCapacitance * v.voltage * protocol.rate;
    electricalWork = effectiveCapacitance * voltage * voltage / 2;
  }
  const charge = plan.crystalCapacitance * voltage - PIEZO.d * force;
  const totalCharge = c * voltage - PIEZO.d * force;
  const energy = s * force * force / 2 - PIEZO.d * force * voltage + c * voltage * voltage / 2;
  return {...plan, ...protocol, time: elapsed, force, voltage, compression, extension: -compression,
    charge, totalCharge, chargeThroughLoad: v.mode ? 0 : -totalCharge, current,
    energy, heat, mechanicalWork, electricalWork, energyResidual: mechanicalWork + electricalWork - energy - heat,
    displayThickness: PIEZO.thickness - compression * plan.magnification,
    complete: elapsed >= plan.duration};
}

export function samplePiezo(input = {}, time = 0) {
  return samplePiezoPlan(piezoPlan(input), time);
}

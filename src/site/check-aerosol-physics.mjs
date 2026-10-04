import assert from 'node:assert/strict';
import {AE, AS, aerosolEquilibrium, aerosolFromEnergy, aerosolSaturation} from './aerosol-equilibrium.js';
import {AEROSOL, aerosolPlan, sampleAerosol, gasFlow} from './aerosol-physics.js';

let checks = 0, settings = 0, states = 0, roots = 0;
const near = (a, b, tolerance, label) => {checks++;assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b} (±${tolerance})`);};
const ok = (value, label) => {checks++;assert.ok(value, label);};
const R = 8.314462618, V = .0005, T0 = 293.15;
// NIST coefficients and fitted ranges, independent of the runtime constants.
const coldP = T => 1e5 * 10 ** (3.98292 - 819.296 / (T - 24.417));
const warmP = T => 1e5 * 10 ** (4.53678 - 1149.36 / (T + 24.906));
const coldB = T => 1e5 * 10 ** (3.94417 - 912.141 / (T - 29.808));
const warmB = T => 1e5 * 10 ** (4.3281 - 1132.108 / (T + .918));
const psat = (i, T) => {
  const lo = i === 1 ? 280 : 261.31, hi = i === 1 ? 285 : 261.54, cold = i === 1 ? coldP : coldB, warm = i === 1 ? warmP : warmB;
  if (T <= lo) return cold(T);if (T >= hi) return warm(T);
  const x = (T - lo) / (hi - lo), w = x * x * (3 - 2 * x);
  return cold(T) ** (1 - w) * warm(T) ** w;
};
for (let T = 235; T <= 340; T += .05) for (const i of [1, 2]) {
  near(aerosolSaturation(i, T), psat(i, T), psat(i, T) * 1e-12, 'NIST saturation with valid overlap blend');
  ok(aerosolSaturation(i, T + .001) > aerosolSaturation(i, T), 'saturation rises with temperature');
}
assert.throws(() => aerosolSaturation(1, 200), RangeError);
assert.throws(() => aerosolSaturation(2, 420), RangeError);

// A separate nested solve: first solve total liquid moles at an assumed gas
// volume, then bisect the volume closure. No runtime alpha equation is used.
function referenceFlash(n, T) {
  const vm = [.3 / 900, .0440956 / 500, .0581222 / 560];
  const atVolume = gasV => {
    let lo = n[0], hi = n[0] + n[1] + n[2];
    for (let j = 0; j < 55; j++) {
      const L = (lo + hi) / 2, right = n[0] + n[1] * L / (L + psat(1, T) * gasV / (R * T)) + n[2] * L / (L + psat(2, T) * gasV / (R * T));
      if (right > L) lo = L; else hi = L;
    }
    const L = (lo + hi) / 2;
    const liquid = [n[0], n[1] * L / (L + psat(1, T) * gasV / (R * T)), n[2] * L / (L + psat(2, T) * gasV / (R * T)), 0];
    return {liquid, V: liquid.slice(0, 3).reduce((sum, amount, i) => sum + amount * vm[i], 0)};
  };
  let lo = 0, hi = V;
  for (let k = 0; k < 55; k++) {const gasV = (lo + hi) / 2, q = atVolume(gasV);if (gasV + q.V > V) hi = gasV;else lo = gasV;}
  return atVolume((lo + hi) / 2);
}
function referenceEnergy(s) {
  const dt = s.T - T0, M = [.3, .0440956, .0581222, .0280134], cpL = [1900, 2600, 2400], cpV = [0, 1750, 1650, 3.5 * R / M[3]], latent = [0, 360000, 350000], rho = [900, 500, 560];
  let energy = .055 * 470 * dt;
  for (let i = 0; i < 3; i++) energy += s.liquid[i] * M[i] * cpL[i] * dt;
  for (let i = 1; i < 4; i++) {
    const offset = i === 3 ? 0 : M[i] * latent[i] - R * T0 + psat(i, T0) * M[i] / rho[i];
    energy += s.vapor[i] * ((M[i] * cpV[i] - R) * dt + offset);
  }
  return energy;
}
for (const propellant of [0, 1]) for (let temperature = 0; temperature <= 50; temperature += 5) for (const orientation of [0, 1]) for (const button of [0, 1, 2, 3]) {
  settings++;
  const values = {propellant, temperature, orientation, button}, plan = aerosolPlan(values);
  let priorOut = [0, 0, 0, 0];
  for (const s of plan.samples) {
    states++;
    ok(s.amounts.every(n => n >= 0), 'nonnegative species inventory');
    ok(s.P >= AE.atmosphere - 2e-6, 'no numerical suction beyond ambient');
    ok(s.V >= 0 && s.V < V, 'liquid and headspace both fit');
    near(s.V + s.gasVolume, V, 1e-15, 'volume closure');
    near(s.U, referenceEnergy(s), 3e-8, 'caloric state reconstructed independently');
    near(s.U - plan.initial.U, s.heatAdded - s.energyOut, 1e-7, 'rigid-vessel energy account');
    const L = s.liquid.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 4; i++) {
      near(s.liquid[i] + s.vapor[i], s.amounts[i], 1e-12, 'phase inventory');
      near(s.amounts[i] + s.outLiquid[i] + s.outVapor[i], plan.amounts[i], 1e-11, 'each species conserved');
      const out = s.outLiquid[i] + s.outVapor[i];ok(out >= priorOut[i] - 1e-13, 'discharged species never return');priorOut[i] = out;
      if (i === 1 || i === 2) near(s.partial[i], s.liquid[i] / L * psat(i, s.T), 3e-5, 'Raoult partial pressure');
    }
    if (!s.down) {near(s.volumeRate, 0, 0, 'closed valve has no liquid flow');near(s.gasRate, 0, 0, 'closed valve has no gas flow');}
    if (orientation === 1) near(s.amounts[0], plan.amounts[0], 1e-12, 'inverted dip tube strands product');
    if (button === 0) {near(s.U, plan.initial.U, 1e-8, 'closed can at room stays unchanged');near(s.P, plan.initial.P, 1e-6, 'closed pressure holds');}
    if (button === 2 && s.t >= 10) near(s.outLiquid[0], plan.samples[20].outLiquid[0], 1e-12, 'release stops withdrawal');
    if (button === 3 && s.t >= 120) for (let i = 0; i < 4; i++) near(s.amounts[i], plan.samples[240].amounts[i], 1e-12, 'late release preserves all remaining species');
  }
  for (const index of [0, 120, 360]) {
    const s = plan.samples[index], q = referenceFlash(s.amounts, s.T);roots++;
    for (let i = 0; i < 4; i++) near(s.liquid[i], q.liquid[i], 3e-10, 'independent nested phase solve');
    near(s.V, q.V, 3e-13, 'independent phase volume');
    near(aerosolFromEnergy(s.amounts, s.U, s.T + 3).T, s.T, 2e-8, 'temperature recovered from energy');
  }
  for (const time of [.17, 9.99, 10, 45.33, 179.9, 180, 190]) {
    const s = sampleAerosol(values, time);near(s.U - plan.initial.U, s.heatAdded - s.energyOut, 2e-7, 'interpolated state energy closure');
    for (let i = 0; i < 4; i++) near(s.amounts[i] + s.outLiquid[i] + s.outVapor[i], plan.amounts[i], 1e-11, 'interpolated species closure');
  }
}

let convergenceCases = 0;
for (const propellant of [0, 1]) for (const temperature of [0, 20, 50]) for (const orientation of [0, 1]) {
  const values = {propellant, temperature, orientation}, coarse = aerosolPlan(values), fine = aerosolPlan(values, {dt: .025});convergenceCases++;
  for (let i = 0; i < coarse.samples.length; i++) {
    const a = coarse.samples[i], b = fine.samples[i];
    near(a.T, b.T, .07, 'fourfold temporal refinement temperature');
    near(a.P, b.P, .004 * coarse.initial.P, 'fourfold temporal refinement pressure');
    near(a.amounts[0] * .3, b.amounts[0] * .3, 2e-6, 'fourfold refinement delivered product');
  }
}
const early = sampleAerosol({}, 0), late = sampleAerosol({}, 90), inverted = sampleAerosol({orientation: 1}, 180);
ok(early.vaporPropaneFraction > early.liquidPropaneFraction, 'vapor enriched in propane');
ok(late.liquidPropaneFraction < early.liquidPropaneFraction, 'upright mixture composition changes');
ok(inverted.liquidPropaneFraction < early.liquidPropaneFraction - .03, 'inverted mixture loses propane preferentially');
const release10 = sampleAerosol({button: 2}, 10), release180 = sampleAerosol({button: 2}, 180);
ok(release180.T > release10.T && release180.P > release10.P, 'released can warms and pressure recovers');
near(release180.sprayedProduct, release10.sprayedProduct, 1e-12, 'warming adds no delivered product');
// Isentropic throat/end-state reconstruction independently checks both gas branches.
for (const P of [101325, 110000, 180000, 250000, 1e6]) for (const gamma of [1.1, 1.4]) {
  const T = 293.15, M = .0280134, ratio = Math.max(101325 / P, (2 / (gamma + 1)) ** (gamma / (gamma - 1)));
  const Te = T * ratio ** ((gamma - 1) / gamma), pe = P * ratio, velocity = Math.sqrt(Math.max(0, 2 * gamma / (gamma - 1) * R / M * (T - Te)));
  const expected = .7 * Math.PI * .00045 ** 2 / 4 * pe * M / (R * Te) * velocity;
  near(gasFlow(P, T, M, gamma), expected, 1e-15, 'compressible gas orifice');
}
for (const bad of [{button: 4}, {temperature: -5}, {temperature: 21}, {propellant: NaN}, {orientation: 2}]) assert.throws(() => aerosolPlan(bad));
assert.throws(() => sampleAerosol({}, -1));assert.throws(() => aerosolPlan({}, {dt: 0}));
console.log(`PASS aerosol physics: ${checks} checks; ${settings} settings; ${states} states; ${roots} independent phase roots; ${convergenceCases} fourfold refinements; species and energy conserved.`);

import assert from 'node:assert/strict';
import {PIEZO as P, PIEZO_DEFAULTS as D, PIEZO_DOMAINS, piezoPlan, piezoProtocol, samplePiezo, samplePiezoPlan} from './piezoelectricity-physics.js';

let checks = 0, integrations = 0;
function ok(condition, message) {checks++; assert.ok(condition, message);}
function near(actual, expected, absolute = 1e-20, relative = 1e-8) {ok(Number.isFinite(actual) && Math.abs(actual - expected) <= absolute + relative * Math.abs(expected), `${actual} != ${expected}`);}
const plan = piezoPlan(), C = 8.8541878128e-12 * 4.52 * .1, S = 12.77e-12 * 10;
near(plan.crystalCapacitance, C); near(plan.compliance, S);
near(plan.blockedCapacitance, C - (2.3e-12) ** 2 / S);
ok(plan.blockedCapacitance > 0, 'Positive energy quadratic');

// An independent time-domain integration of electrical KCL, mechanical power
// F*dx/dt, and resistor heating. It does not use the production segment solver,
// integrals, protocol function, or energy balance to compute work or heat.
function integrate(input, until) {
  const settings = {...D, ...input}, c = C + settings.capacitance * 1e-12;
  const resistance = [Infinity, 1e9, 1e11, 1e12][settings.load], tau = resistance * c;
  let y = [0, 0, 0], force = 0;
  const rhs = (state, f, rate) => {
    const dv = 2.3e-12 * rate / c - state[0] / tau;
    return [dv, f * (S * rate - 2.3e-12 * dv), state[0] ** 2 / resistance];
  };
  const plus = (a, b, scale) => a.map((v, i) => v + b[i] * scale);
  for (const [begin, end, rate] of [[0, settings.rise, settings.force / settings.rise], [settings.rise, 4, 0], [4, 4 + settings.rise, -settings.force / settings.rise], [4 + settings.rise, 8, 0]]) {
    const duration = Math.max(0, Math.min(end, until) - begin);
    if (!duration) continue;
    const steps = Math.max(128, Math.ceil(duration / Math.min(.002, tau / 32))), h = duration / steps;
    for (let i = 0; i < steps; i++) {
      const f = force + rate * h * i;
      const a = rhs(y, f, rate), b = rhs(plus(y, a, h / 2), f + rate * h / 2, rate);
      const c1 = rhs(plus(y, b, h / 2), f + rate * h / 2, rate), d = rhs(plus(y, c1, h), f + rate * h, rate);
      y = y.map((v, j) => v + h * (a[j] + 2 * b[j] + 2 * c1[j] + d[j]) / 6);
    }
    force += rate * duration;
  }
  integrations++;
  return {voltage: y[0], work: y[1], heat: y[2]};
}
for (const load of [0, 1, 2, 3]) for (const capacitance of [0, 100]) for (const rise of [.05, 2]) for (const time of [rise, 3, 4 + rise, 8]) {
  const values = {load, capacitance, rise, force: 50}, actual = samplePiezo(values, time), reference = integrate(values, time);
  near(actual.voltage, reference.voltage, 1e-10, 5e-8);
  near(actual.mechanicalWork, reference.work, 2e-17, 2e-7);
  near(actual.heat, reference.heat, 2e-17, 2e-7);
}

for (const force of [0, 1, 10, 50]) for (const capacitance of [0, 5, 100]) {
  const p = piezoPlan({force, capacitance, load: 0});
  for (const time of [0, 1e-10, .1, .25, 1, 3.9, 4, 4.1, 4.25, 8]) {
    const s = samplePiezoPlan(p, time), fraction = time < .25 ? time / .25 : time < 4 ? 1 : time < 4.25 ? (4.25 - time) / .25 : 0;
    near(s.force, force * fraction, 1e-12); near(s.voltage, P.d * force * fraction / p.capacitance, 1e-12);
    near(s.totalCharge, 0, 1e-25); near(s.heat, 0); near(s.energyResidual, 0, 1e-21);
  }
}
const peak = samplePiezo({}, .25), afterTau = samplePiezo({}, .25 + plan.timeConstant), released = samplePiezo({}, 4.25);
near(afterTau.voltage, peak.voltage / Math.E, 1e-12);
ok(released.voltage < 0, 'Release produces reverse voltage after charge leaked during hold');
ok(Math.abs(samplePiezo({rise: 2}, 2).voltage) < peak.voltage, 'Slow force ramp loses more charge before reaching peak force');
ok(samplePiezo({capacitance: 100}, .25).voltage < peak.voltage, 'Parallel capacitance lowers force-ramp voltage');
ok(samplePiezo({load: 1}, .25).voltage < peak.voltage, 'Lower resistance loads the sensor');
near(samplePiezo({force: 0}, 8).heat, 0);
for (let force = 0; force <= 50; force++) for (let k = 1; k <= 40; k++) {
  ok(samplePiezo({force, rise: k / 20}, 8).force === 0, 'Released prescribed force is exactly zero');
}

for (const voltage of [-50, -5, 0, 5, 50]) for (const blocked of [0, 1]) for (const time of [0, .05, .25, 2, 4, 4.1, 4.25, 8]) {
  const a = samplePiezo({mode: 1, voltage, blocked}, time), b = samplePiezo({mode: 1, voltage, blocked, force: 50, load: 0, capacitance: 100}, time);
  near(a.voltage, b.voltage); near(a.compression, b.compression);
  near(a.compression, blocked ? 0 : -2.3e-12 * a.voltage);
  near(a.force, blocked ? 2.3e-12 * a.voltage / S : 0, 1e-15);
  near(a.totalCharge, (blocked ? C - (2.3e-12) ** 2 / S : C) * a.voltage);
  near(a.energyResidual, 0, 1e-22); near(a.heat, 0); near(a.mechanicalWork, 0);
}

let seed = 124301;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
for (let i = 0; i < 1600; i++) {
  const values = Object.fromEntries(Object.entries(PIEZO_DOMAINS).map(([key, [lo, hi, step]]) => [key, Number((lo + step * Math.floor(random() * (1 + Math.round((hi - lo) / step)))).toFixed(8))]));
  const p = piezoPlan(values), times = [0, 1e-10, values.rise, 4, 4 + values.rise, random() * 8, 8];
  for (const time of times) {
    const s = samplePiezoPlan(p, time);
    for (const key of ['voltage', 'force', 'compression', 'energy', 'heat', 'mechanicalWork', 'electricalWork', 'current']) ok(Number.isFinite(s[key]), `${key} finite`);
    ok(s.energy >= -1e-22 && s.heat >= -1e-22, 'Stored energy and heat nonnegative');
    near(s.energyResidual, 0, 2e-21);
    ok(s.displayThickness > .0003 && s.displayThickness < .0013, 'Magnified plate stays positive and bounded');
    near(s.energy, s.compression ** 2 / (2 * p.compliance) + (p.capacitance - P.d ** 2 / p.compliance) * s.voltage ** 2 / 2, 1e-21);
  }
}
for (const invalid of [{mode: 2}, {force: NaN}, {force: -1}, {rise: .06}, {load: 4}, {voltage: 51}, {capacitance: 101}, {blocked: .5}, {extra: 0}, null, []]) assert.throws(() => piezoPlan(invalid));
for (const time of [-1, NaN, Infinity]) assert.throws(() => samplePiezo({}, time));
assert.throws(() => piezoProtocol(0, 0));
near(samplePiezo({}, 20).time, 8); ok(samplePiezo({}, 8).complete, 'Eight-second completion');
console.log(JSON.stringify({status: 'PASS', checks, independentRK4Integrations: integrations, capacitancePF: C * 1e12, complianceNmPerN: S * 1e9, defaultPeakV: peak.voltage, defaultReleaseV: released.voltage, timeConstant: plan.timeConstant}));

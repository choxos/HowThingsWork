import assert from 'node:assert/strict';
import {WATER as W, WATER_DOMAINS, WATER_DEFAULTS as D, sampleWaterClock, waterClockPlan, outflowLevel, emptyTime, potVolume, referenceFlow, floatDraft} from './water-clock-physics.js';
import {tally, checkRefusals} from './model-check-kit.mjs';

const t = tally();
// Independent differential integration uses sqrt(height) as the state. Its
// derivative stays finite at empty, unlike relative-error tests on height.
let integratedRuns = 0;
for (const design of [0, 1]) for (const bore of [.6, .8, 1, 1.3, 1.7, 2]) {
  const bottom = design ? .08 : .15, slope = design ? .175 : 0;
  const orificeArea = Math.PI * (bore * .0005) ** 2;
  const du = u => -.62 * orificeArea * Math.sqrt(2 * 9.81) / (2 * Math.PI * (bottom + slope * Math.max(0, u) ** 2) ** 2);
  let u = Math.sqrt(.4), elapsed = 0, crossing = null;
  for (let n = 0; n < 21600; n++) {
    if (u > 0) {
      const a = du(u), b = du(u + a), c = du(u + b), d = du(u + 2 * c), next = u + (a + 2 * b + 2 * c + d) / 3;
      if (next <= 0) crossing = (elapsed + 2 * u / (u - next)) / 3600;
      u = Math.max(0, next);
    }
    elapsed += 2;
    if (n % 180 === 179) t.near(outflowLevel(design, bore / 1000, elapsed / 3600), u * u, 1e-9, 'independent RK4 water level');
  }
  if (crossing !== null) t.near(emptyTime(design, bore / 1000), crossing, 1e-7, 'independent empty crossing');
  integratedRuns++;
}
// Volume quadrature is independent of the analytic polynomial used at runtime.
for (const design of [0, 1]) for (const h of [.001, .03, .1, .25, .4]) {
  let volume = 0; const dy = h / 20000;
  for (let i = 0; i < 20000; i++) {const y = (i + .5) * dy, radius = design ? .08 + .175 * y : .15; volume += Math.PI * radius ** 2 * dy;}
  t.near(potVolume(design, h), volume, 1e-11, 'quadrature volume');
}
let stateCases = 0;
for (const design of [0, 1, 2]) {
  const settings = design === 2 ? Array.from({length: 21}, (_, i) => ({design, rate: i * 10})) : Array.from({length: 15}, (_, i) => ({design, bore: Number((.6 + i * .1).toFixed(1))}));
  const calibration = waterClockPlan({design}).marks;
  for (const values of settings) for (let i = 0; i <= 120; i++) {
    const h = i / 10, s = sampleWaterClock(values, h); stateCases++;
    assert.deepEqual(s.marks, calibration); t.ok(true, 'calibration invariant under rate change');
    t.near(s.volume + s.collected, s.initialVolume + s.incoming, 2e-15, 'complete water balance');
    t.ok(s.volume >= 0 && s.collected >= 0 && s.level >= 0, 'nonnegative quantities');
    t.near(s.error, s.shows - h, 1e-12, 'indication and error distinct from real time');
    if (design === 2) {
      const area = Math.PI * .04 ** 2, supplied = referenceFlow * (values.rate / 100) * h * 3600, travel = Math.min(.24, supplied / area);
      t.near(s.travel, travel, 1e-15, 'rise from conserved added volume');
      t.near(s.shows, travel / (.036 * 2 * Math.PI) * 12, 1e-12, 'fixed twelve-hour gear calibration');
      t.near(s.handAngle, -travel / .036, 1e-12, 'rack travel equals pitch circle travel');
      t.near(s.buoyancy, 1000 * 9.81 * Math.PI * .024 ** 2 * s.floatDraft, 1e-12, 'buoyancy equals moving weight');
      t.ok(s.floatBottom >= 0 && s.floatBottom < s.level && s.floatTop > s.level, 'float partly submerged and clear of floor');
      t.near(s.level * area - 40e-6, s.volume, 2e-18, 'float volume excluded from water');
      t.ok(s.collected < Math.PI * .07 ** 2 * .1, 'overflow bowl contains every supplied drop');
      if (s.overflow > 1e-14) {t.near(s.level, .27, 1e-15, 'overflow crest holds level'); t.near(s.riseRate, 0, 0, 'overflow stops clock motion'); t.near(s.outflow, s.flow, 0, 'overflow passes incoming flow');}
    } else {
      const remainingFraction = s.volume / s.initialVolume;
      t.ok(remainingFraction <= 1 + 1e-14, 'pot only loses water');
      const expectedIndication = Math.min(emptyTime(design, .001), h * values.bore ** 2);
      t.near(s.shows, expectedIndication, 1e-12, 'changed orifice makes fixed scale run fast or slow');
      t.ok(s.collected < Math.PI * .22 ** 2 * .25, 'basin contains all pot water');
      if (s.level === 0) {t.near(s.flow, 0, 0, 'no flow after empty'); t.near(s.fallRate, 0, 0, 'no falling level after empty');}
      else {const dh = 1e-5, a = sampleWaterClock(values, h + dh), b = sampleWaterClock(values, h + 2 * dh); if (h + 2 * dh < Math.min(12, s.empties)) t.near((3 * s.level - 4 * a.level + b.level) / (2 * dh), s.fallRate, 1e-8, 'fall rate matches time derivative');}
    }
  }
}
t.near(referenceFlow * 3.6e9, 94.74820225045781, 1e-10, 'nominal volumetric rate');
t.near(floatDraft * 1000, 22.10485320720769, 1e-10, 'immersion depth');
t.near(sampleWaterClock({rate: 50}, 6).shows, 3, 1e-14, 'half-rate regression');
t.near(sampleWaterClock({rate: 0}, 6).shows, 0, 0, 'closed inlet regression');
t.near(sampleWaterClock({rate: 200}, 8).collected * 1e6, 309.59965702884455, 1e-8, 'overflow accounting regression');
t.near(sampleWaterClock({design: 1, bore: 2}, 12).fallRate, 0, 0, 'empty cone regression');
for (const design of [0, 1]) {const plan = waterClockPlan({design}); for (let h = 0; h < plan.marks.length; h++) t.near(sampleWaterClock({design}, h).level, plan.marks[h], 1e-14, 'fixed mark calibrated at reference opening');}
checkRefusals(sampleWaterClock, WATER_DOMAINS, t);
assert.deepEqual(sampleWaterClock({}, 99).values, D); t.near(sampleWaterClock({}, 99).clock, 12, 0, 'playback clamps at end');
console.log(`PASS water clock physics: ${t.count} checks, ${integratedRuns} independent RK4 runs, ${stateCases} balance/calibration cases`);

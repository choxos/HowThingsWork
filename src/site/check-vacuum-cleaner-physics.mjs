import assert from 'node:assert/strict';
import {CLEANER, CLEANER_DOMAINS, cleanerFanRise, cleanerFriction, cleanerLosses, cleanerPlan, sampleCleaner} from './vacuum-cleaner-physics.js';
import {checkRefusals} from './model-check-kit.mjs';

let checks = 0, operatingPoints = 0, states = 0;
const ok = (value, why) => {checks++; assert.ok(value, why);};
const near = (actual, expected, tolerance, why) => ok(Math.abs(actual - expected) <= tolerance, `${why}: ${actual} != ${expected}`);
const finite = value => {if (typeof value === 'number') ok(Number.isFinite(value), 'finite state'); else if (value && typeof value === 'object') Object.values(value).forEach(finite);};

// Independent turbulent-network equation. Expand pipe resistance as B Q^1.75
// and solve by Newton iteration, rather than calling the production loss or
// fan functions or repeating its bracketed solve.
function reference(nozzle, bag, filter) {
  const rho = 1.2, mu = 1.8e-5, diameter = .032, area = Math.PI * diameter ** 2 / 4;
  const slot = nozzle === 1 ? .025 * .012 : .25 * .006, K = nozzle === 1 ? 2 : 2.5;
  const headCoefficient = K * rho / (2 * slot ** 2), outletCoefficient = rho / (2 * .004 ** 2);
  const B = .3164 / (rho * diameter / (mu * area)) ** .25 * 2.6 / diameter * rho / (2 * area ** 2);
  const bagR = 40000 * bag, filterR = 18000 * (filter ? 3 : 1);
  const A = 7000 / .035 ** 2 + headCoefficient + outletCoefficient, R = bagR + filterR;
  let Q = .02;
  for (let i = 0; i < 25; i++) Q -= (A * Q * Q + B * Q ** 1.75 + R * Q - 7000) / (2 * A * Q + 1.75 * B * Q ** .75 + R);
  return {Q, slot, area, reynolds: rho * Q * diameter / (mu * area), drops: {
    head: headCoefficient * Q * Q, hose: B * Q ** 1.75, bag: bagR * Q,
    filter: filterR * Q, outlet: outletCoefficient * Q * Q,
  }};
}

for (const nozzle of [0, 1, 2]) for (let bag = 1; bag <= 4; bag += .5) for (const filter of [0, 1]) for (const motor of [0, 1]) {
  states++;
  const values = {nozzle, bag, filter, motor}, p = cleanerPlan(values);
  finite(p);
  if (!motor || nozzle === 2) {
    near(p.flow, 0, 0, 'no moving air through a sealed head or stopped fan');
    near(p.total, 0, 0, 'no dissipative path loss without flow');
    near(p.airPower, 0, 0, 'no fluid power without flow');
    near(p.pressure, motor ? 7000 : 0, 0, 'pressure at blocked or switched-off state');
    near(p.holdingForce, motor && nozzle === 2 ? 10.5 : 0, 1e-12, 'static force on the sealed opening');
  } else {
    const ref = reference(nozzle, bag, filter);operatingPoints++;
    near(p.flow, ref.Q, 1e-13, 'independent operating point');
    for (const [key, value] of Object.entries(ref.drops)) near(p.drops[key], value, 2e-9, `${key} pressure loss`);
    near(p.total, p.pressure, 3e-9, 'pressure budget closes');
    near(p.slotSpeed, ref.Q / ref.slot, 1e-10, 'head continuity');
    near(p.hoseSpeed, ref.Q / ref.area, 1e-10, 'hose continuity');
    near(p.airPower, ref.Q * (7000 - 7000 * (ref.Q / .035) ** 2), 1e-9, 'fluid power');
    ok(ref.reynolds > 36000 && ref.reynolds < 71000, 'all operating points in turbulent smooth-tube range');
    ok(p.maxMach < .17, 'selected design keeps flow speed below Mach 0.17');
    near(p.sealPressure, 0, 0, 'open head has no sealing plate pressure');
  }
  ok(p.pressureFraction < .07, 'assigned pressure scale below seven percent of atmospheric pressure');
  for (const time of [0, .125, 7.3, 15, 30, 100]) {
    const s = sampleCleaner(values, time);finite(s);
    near(s.clock, Math.min(time, 30), 0, 'trace ends at fixed boundary');
    near(s.elapsed, Math.min(time, 30) / 30, 0, 'physical interval behind slow trace');
    near(s.volume, p.flow * Math.min(time, 30) / 30, 1e-15, 'transported air volume');
    near(s.airEnergy, p.airPower * Math.min(time, 30) / 30, 1e-12, 'work transferred to air');
    ok(s.complete === (time >= 30), 'completion follows trace boundary');
    ok(Boolean(s.blocked) === (!motor || nozzle === 2), 'blocked reason follows physical state');
  }
}

// Curves include their origin and both transition boundaries; pressure loss
// remains monotone, so exactly one intersection exists for every open setup.
for (const nozzle of [0, 1]) for (let bag = 1; bag <= 4; bag += .5) for (const filter of [0, 1]) {
  const values = {nozzle, bag, filter, motor: 1};let previous = -1, previousResidual = Infinity;
  for (let i = 0; i <= 600; i++) {
    const flow = .035 * i / 600, loss = cleanerLosses(values, flow), residual = cleanerFanRise(flow) - loss.total;
    ok(loss.total > previous, 'system loss increases with flow');
    ok(residual < previousResidual, 'fan minus system strictly decreases');
    previous = loss.total;previousResidual = residual;
  }
}
for (const reynolds of [1, 100, 2300]) near(cleanerFriction(reynolds), 64 / reynolds, 0, 'laminar friction law');
for (const reynolds of [4000, 50000, 100000]) near(cleanerFriction(reynolds), .3164 / reynolds ** .25, 0, 'turbulent friction law');
for (const boundary of [2300, 4000]) near(cleanerFriction(boundary - 1e-5), cleanerFriction(boundary + 1e-5), 1e-8, 'continuous transition boundary');
near(cleanerFriction(0), 0, 0, 'zero-flow friction convention');

const clean = cleanerPlan(), loaded = cleanerPlan({bag: 4}), dirtyFilter = cleanerPlan({filter: 1}), crevice = cleanerPlan({nozzle: 1});
ok(loaded.flow < clean.flow && loaded.pressure > clean.pressure, 'greater pressure rise does not imply greater flow');
ok(loaded.slotSpeed < clean.slotSpeed, 'loaded bag slows the head air');
ok(dirtyFilter.flow < clean.flow && dirtyFilter.drops.filter > clean.drops.filter, 'loaded filter raises its loss and reduces flow');
ok(crevice.flow < clean.flow && crevice.slotSpeed > clean.slotSpeed, 'smaller opening concentrates a lower volume flow');
near(cleanerFanRise(0), 7000, 0, 'shutoff characteristic');
near(cleanerFanRise(CLEANER.freeFlow), 0, 0, 'free-delivery characteristic');
for (const bad of [-1, NaN, Infinity, .036]) for (const fn of [cleanerFanRise, flow => cleanerLosses(clean.values, flow)]) {assert.throws(() => fn(bad), RangeError);checks++;}
for (const bad of [-1, NaN, Infinity]) {assert.throws(() => cleanerFriction(bad), RangeError);checks++;}
assert.throws(() => cleanerLosses({...clean.values, nozzle: 2}, .01), RangeError);checks++;
checkRefusals(sampleCleaner, CLEANER_DOMAINS);
console.log(`PASS canister vacuum physics: ${checks} checks; ${states} settings; ${operatingPoints} independent operating-point solves; 28 monotone curves; invalid inputs refused.`);

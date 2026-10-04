import assert from 'node:assert/strict';
import {AIR, FILTER, PRECIPITATOR as P, ROOM, FAN, SIZES, FLOWS, AIR_CLEANER_DOMAINS, airCleanerPlan, sampleAirCleaner, slip, diffusivity, settling, fiberCapture, charging, driftSpeed, chargeDistribution, plateCatch} from './air-cleaner-physics.js';
let checks = 0, settings = 0, states = 0;
const near = (a, b, tolerance, label) => {checks++;assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b}`);};
const ok = (value, label) => {checks++;assert.ok(value, label);};
for (const [d, cc, D] of [[1e-8, 22.2, 5.24e-8], [1e-7, 2.85, 6.75e-10], [1e-6, 1.16, 2.74e-11]]) {
  near(slip(d), cc, cc * .04, 'reference particle slip correction');near(diffusivity(d), D, D * .05, 'reference Brownian diffusivity');
}
near(settling(1e-6), 3.5e-5, 7e-7, 'unit-density micron sphere settling');
near((P.plates - 1) * P.gap * P.width, P.open, 0, 'open area counts clear gaps, not plate center spacing');
near(P.plates * P.thickness + (P.plates - 1) * P.gap, .3, 1e-15, 'complete 300 mm collector height');
// Poisson recurrence checked against independently accumulated log-factorials,
// then moments, generating function and continuous quadrature of entry heights.
for (const mean of [0, .01, .125, 1, 24.4, 195, 1472, 3000]) {
  const distribution = chargeDistribution(mean);
  near(distribution.reduce((s, p) => s + p.probability, 0), 1, 4e-15, 'charge probabilities sum to one');
  near(distribution.reduce((s, p) => s + p.n * p.probability, 0), mean, 3e-11, 'charge mean');
  near(distribution.reduce((s, p) => s + (p.n - mean) ** 2 * p.probability, 0), mean, 3e-10, 'charge variance');
  near(distribution.reduce((s, p) => s + Math.exp(-.03 * p.n) * p.probability, 0), Math.exp(mean * Math.expm1(-.03)), 3e-15, 'Poisson generating function');
  let factorial = 0, index = 0;
  for (let n = 0; n <= distribution.at(-1).n; n++) {
    if (n > 0) factorial += Math.log(n);
    if (n === distribution[index]?.n) {
      const probability = mean === 0 ? Number(n === 0) : Math.exp(n * Math.log(mean) - mean - factorial);
      near(distribution[index].probability, probability, 5e-11, 'independent factorial probability');index++;
    }
  }
}
for (const d of SIZES) for (const Qh of [60, 120, 200]) {
  const U = Qh / 3600 / P.open, chargeU = Qh / 3600 / (12 * (.025 - .0008) * .2), c = charging(d, chargeU), residence = .025 / chargeU;
  const epsilon = 8.8541878128e-12, elementary = 1.602176634e-19, coulomb = 1 / (4 * Math.PI * epsilon), kT = 1.380649e-23 * 293.15;
  const field = 3 * 2.5 / 4.5 * Math.PI * epsilon * 560000 * d * d / elementary * residence / (residence + 4 * epsilon / (5e14 * elementary * 1.5e-4));
  const diffusion = d * kT / (2 * coulomb * elementary ** 2) * Math.log1p(Math.PI * coulomb * d * 240 * elementary ** 2 * 5e14 * residence / (2 * kT));
  near(c.field, field, 1e-10, 'field-charging SI reconstruction');near(c.diffusion, diffusion, 1e-11, 'diffusion-charging SI reconstruction');
  const distribution = chargeDistribution(c.total), bins = 10000;
  let caught = 0;
  for (const {n, probability} of distribution) {
    const driftDistance = driftSpeed(n, d, 3000 / .006) * .1 / U;
    // Midpoint quadrature of entry position, independent of the clipped formula.
    const count = Math.min(bins, Math.max(0, Math.ceil(driftDistance / .006 * bins - .5)));
    caught += probability * count / bins;
  }
  near(plateCatch(d, U), caught, 1 / bins, 'collector against uniform-entry quadrature');
  ok(plateCatch(d, U) <= -Math.expm1(-c.total) + 3e-15, 'uncharged particles cannot be electrically captured');
  near(plateCatch(d, U, false), 0, 0, 'unpowered collector does not invent capture');
  const f = fiberCapture(d, Qh / 3600 / 1.2);
  ok(f.R <= .3 && f.interception >= 0 && f.diffusion >= 0 && f.impaction >= 0, 'fiber correlation domain');
  // Integrate dP/dx = -attenuation*P with RK4, rather than the runtime exponential.
  const attenuation = 4 * .1 * f.single / (Math.PI * 1e-5 * .9), h = .002 / 4000;
  let remaining = 1;for (let j = 0; j < 4000; j++) {const z = -attenuation * h;remaining *= 1 + z + z*z/2 + z*z*z/6 + z**4/24;}
  near(1 - f.efficiency, remaining, 2e-11, 'mat penetration by layer integration');
}
// Full domain: every compartment remains physical and the particle account closes.
for (let mode = 0; mode < 3; mode++) for (let size = 0; size < 7; size++) for (let fan = 0; fan < 4; fan++) for (let voltage = 0; voltage < 2; voltage++) for (const room of [30, 60, 90]) {
  const values = {mode, size, fan, voltage, room}, plan = airCleanerPlan(values);settings++;
  near(plan.cadr, FLOWS[fan] / 3600 * plan.efficiency, 1e-15, 'CADR is flow times retained fraction');
  if(mode===1){near(plan.chargeU*(12*(.025-.0008)*.2),plan.Q,1e-15,'charging-grid flow continuity');near(plan.U*(44*.006*.2),plan.Q,1e-15,'collector flow continuity');}
  near(plan.changes, FLOWS[fan] / room, 1e-14, 'airflow per room volume');
  let previous = {remaining: 1, collected: 0, deposited: 0, ventilated: 0};
  for (let time = 0; time <= 3600; time += 60) {
    const s = sampleAirCleaner(values, time);states++;
    for (const key of ['neutral','charged','remaining','collected','settled','electricalDeposit','deposited','ventilated']) ok(s[key] >= -1e-14 && s[key] <= 1 + 1e-14, `${key} bounded`);
    near(s.remaining + s.collected + s.deposited + s.ventilated, 1, 2e-14, 'complete room particle account');
    near(s.neutral + s.charged, s.remaining, 0, 'charged and neutral airborne account');
    ok(s.remaining <= previous.remaining + 1e-14, 'no new particles appear');
    for (const key of ['collected','deposited','ventilated']) ok(s[key] >= previous[key] - 1e-14, 'removed particles do not return');
    if (fan === 0 || (mode !== 0 && voltage === 0)) near(s.remaining, s.withoutCleaner, 1e-14, 'inactive cleaner equals baseline');
    if (mode === 2) near(s.collected, 0, 0, 'charging only retains nothing in the cabinet');
    if (time === 0) near(s.charged, 0, 0, 'room starts neutral');
    previous = s;
  }
}
// Independent RK4 integration of five states, with no runtime eigensystem.
for (const values of [{}, {mode:0}, {mode:1,size:0,fan:1}, {mode:2}, {mode:2,size:0}, {mode:2,size:6,room:90}, {fan:0}, {voltage:0}]) {
  const plan = airCleanerPlan(values), r = plan.rates, h = .5;
  const derivative = ([n,c]) => [-(r.ventilation+r.settling+r.cleaner+r.charging)*n+r.relaxation*c, r.charging*n-(r.ventilation+r.settling+r.relaxation+r.drift)*c, r.cleaner*(n+c), r.settling*(n+c)+r.drift*c, r.ventilation*(n+c)];
  const add = (a,b,f) => a.map((v,i)=>v+f*b[i]);let state=[1,0,0,0,0];
  for(let time=h;time<=3600;time+=h){const k1=derivative(state),k2=derivative(add(state,k1,h/2)),k3=derivative(add(state,k2,h/2)),k4=derivative(add(state,k3,h));state=state.map((v,i)=>v+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));if(time%300===0){const s=sampleAirCleaner(values,time);['neutral','charged','collected','deposited','ventilated'].forEach((key,i)=>near(s[key],state[i],3e-12,'independent room integration'));}}
}
for (const [key,[min,max,step]] of Object.entries(AIR_CLEANER_DOMAINS)) for (const value of [min-step,max+step,min+step/3,NaN,Infinity]) assert.throws(()=>airCleanerPlan({[key]:value}));
for(const time of [-1,NaN,Infinity]) assert.throws(()=>sampleAirCleaner({},time));
assert.throws(()=>airCleanerPlan({extra:1}));assert.throws(()=>fiberCapture(10e-6,.03));
near(sampleAirCleaner({},7200).clock,3600,0,'clock stops at trial endpoint');
console.log(`PASS air-cleaner physics: ${checks} checks, ${settings} settings, ${states} states, 8 independent room integrations`);

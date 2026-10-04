import assert from 'node:assert/strict';
import {UPRIGHT, UPRIGHT_DEFAULTS as D, uprightFanRise, uprightFriction, uprightLosses, uprightPlan, sampleUpright, uprightReleaseTime} from './upright-vacuum-physics.js';

let checks = 0, settings = 0, roots = 0, curves = 0;
const ok = (condition, message) => {assert.ok(condition, message);checks++;};
const near = (actual, expected, tolerance = 1e-9, message = '') => {assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);checks++;};
const throws = action => {assert.throws(action, RangeError);checks++;};
// Independent expansion of the turbulent system curve. Newton iteration uses
// its analytic derivative; runtime uses a generic pressure-loss bisection.
function reference(height, bag, cover) {
  const rho = 1.2, diameter = .04, area = Math.PI * diameter ** 2 / 4;
  const slot = .3 * .006 + height * .012 * 2 * (.3 + .35), rePerFlow = rho * diameter / (1.8e-5 * area);
  const quadratic = rho / 2 * (2.5 / slot ** 2 + 1.5 / area ** 2 + 1 / .01 ** 2);
  const turbulent = .3164 * .75 / diameter * rho / (2 * area ** 2) / rePerFlow ** .25;
  const linear = 40000 * bag + 20000 * (cover ? 3 : 1);
  const a = quadratic + 5000 / .035 ** 2;
  let flow = .02;
  for (let i = 0; i < 30; i++) flow -= (a * flow ** 2 + turbulent * flow ** 1.75 + linear * flow - 5000) / (2 * a * flow + 1.75 * turbulent * flow ** .75 + linear);
  return {flow, quadratic, turbulent, linear, rePerFlow};
}
for (const height of [0, 1]) for (let bag = 1; bag <= 4; bag += .5) for (const cover of [0, 1]) {
  const expected = reference(height, bag, cover), active = uprightPlan({...D, height, bag, cover});
  near(active.flow, expected.flow, 2e-14, 'independent operating point');roots++;
  ok(expected.flow * expected.rePerFlow > 4000, 'independent reference lies in turbulent domain');
  let previous = -1;
  for (let i = 0; i <= 600; i++) {
    const q = .035 * i / 600, loss = uprightLosses({...D, height, bag, cover}, q);
    ok(loss.total >= previous, 'complete system curve rises monotonically');previous = loss.total;
    near(loss.total, Object.values(loss.drops).reduce((sum, p) => sum + p, 0), 1e-9, 'loss budget');
    if (loss.reynolds >= 4000) near(loss.total, expected.quadratic * q * q + expected.turbulent * q ** 1.75 + expected.linear * q, 1e-8, 'independent loss law');
  }
  curves++;
  for (const motor of [0, 1]) for (const seal of [0, 1]) for (const belt of [0, 1]) {
    const values = {...D, height, bag, cover, motor, seal}, p = uprightPlan({...values, belt});settings++;
    if (motor && !seal) {
      near(p.flow, expected.flow, 2e-14);near(p.pressure, p.total, 1e-9, 'energy balance');
      ok(p.bagPressure > p.coverPressure && p.coverPressure > 0, 'positive pressure drives air through both porous layers');
      ok(p.bagKineticPressure < 2 && p.coverKineticPressure < 1, 'broad plenum corrections stay small');
    } else {near(p.flow, 0);near(p.total, 0);near(p.bagPressure, 0);near(p.coverPressure, 0);}
    near(p.pressure, motor ? 5000 * (1 - (p.flow / .035) ** 2) : 0);
    near(p.motorRpm, 9000 * motor);near(p.brushRpm, 3000 * motor * belt);
    near(p.beltSpeed, p.brushRpm / 60 * 2 * Math.PI * .024, 1e-12, 'equal tangential pulley speeds');
    ok(p.brushActive === Boolean(motor && belt && !height), 'contact and transmitted drive both required');
    near(p.holdingForce, motor && seal ? 5000 * Math.PI * (.028 ** 2 - .005 ** 2) : 0);
    ok(p.maxMach < .07 && p.pressureFraction < .05, 'stated low-pressure incompressible range');
    near(p.bagPressure, p.drops.bag + p.drops.cover + p.drops.outlet - .6 * (p.flow / .022) ** 2);
    near(p.coverPressure, p.drops.cover + p.drops.outlet - .6 * (p.flow / .035) ** 2);
    for (const time of [0, .5, 1, 1.5, 3, 15, 89.99, 90, 110]) {
      const s = sampleUpright({...values, belt}, time), clock = Math.min(time, 90);
      near(s.clock, clock);near(s.elapsed, clock / 300);near(s.volume, p.flow * clock / 300);
      near(s.airEnergy, p.pressure * p.flow * clock / 300);near(s.motorAngle, p.motorRpm / 60 * 2 * Math.PI * clock / 300);
      near(s.brushAngle, p.brushRpm / 60 * 2 * Math.PI * clock / 300);
      ok(s.complete === (time >= 90), 'finite observation interval');
      let retainedByFibers = 0;
      for (let index = 0; index < 12; index++) {
        const release = uprightReleaseTime(p, index);
        if (index < 6) near(release, 0);
        else if (!p.brushActive) {ok(release === null, 'no brush encounter, no fabricated finite release');retainedByFibers++;}
        else {
          const phase = .12 + (index - 6) * .17, omega = p.brushRpm / 60 * 2 * Math.PI / 300;
          ok(release > 0 && release < (Math.PI / 2) / omega, 'first bottom encounter');
          const distanceToBottom = Math.min(...[0, 1, 2, 3].map(row => Math.abs(Math.sin(phase + row * Math.PI / 2 + omega * release) + 1)));
          near(distanceToBottom, 0, 1e-13, 'bristle reaches bottom at release');
          if (release > clock) retainedByFibers++;
        }
      }
      near(s.unreleased, retainedByFibers, 0, 'release count');
    }
  }
}
near(uprightFanRise(0), 5000);near(uprightFanRise(.035), 0);near(uprightFriction(0), 0);
near(uprightFriction(100), .64);near(uprightFriction(2300), 64 / 2300);
near(uprightFriction(4000), .3164 / 4000 ** .25);
for (const bad of [-1, NaN, Infinity, '1']) {
  throws(() => uprightFanRise(bad));throws(() => uprightFriction(bad));throws(() => sampleUpright(D, bad));
}
throws(() => uprightFanRise(.036));throws(() => uprightLosses({...D, seal: 1}, .01));
for (const [key, bad] of Object.entries({motor: 2, belt: -.1, height: 2, seal: 2, bag: 5, cover: 2})) throws(() => uprightPlan({...D, [key]: bad}));
for (const bad of [-1, 12, 1.5, NaN]) throws(() => uprightReleaseTime(uprightPlan(), bad));
ok(Object.values(UPRIGHT).every(Number.isFinite), 'finite assigned constants');
console.log(`PASS upright vacuum physics: ${checks} checks; ${settings} settings; ${roots} independent Newton roots; ${curves} monotone curves; brush release and belt speed verified.`);

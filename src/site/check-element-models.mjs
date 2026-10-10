// Shared resistance data, heater reference integration and wire appearance.
// Dedicated files check each appliance mechanism, lesson and energy balance.
import assert from 'node:assert/strict';
import {fixed} from './format.js';
import {tally, checkRefusals} from './model-check-kit.mjs';
import * as P from './element-physics.js';
import * as S from './element-scene.js';

const t = tally();
const counts = {steps: 0, plans: 0, poses: 0, points: 0, numbers: 0, solves: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2);

/** One fourth order Runge-Kutta step. */
function rk4(state, time, dt, derivative) {
  const k1 = derivative(time, state), k2 = derivative(time + dt / 2, state + dt / 2 * k1);
  const k3 = derivative(time + dt / 2, state + dt / 2 * k2), k4 = derivative(time + dt, state + dt * k3);
  counts.steps++;
  return state + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
}
/** The x where an increasing `fn` crosses zero, by bisection. */
function bisect(fn, lo, hi, steps = 200) {
  let a = lo, b = hi;
  for (let i = 0; i < steps; i++) { const mid = (a + b) / 2; if (fn(mid) > 0) b = mid; else a = mid; }
  return (a + b) / 2;
}

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  // Kanthal: Nikrothal 80 wire, material datasheet.
  nikrothal: {
    name: 'Nikrothal 80', chromium: [19.0, 21.0], resistivity: 1.09e-6, resistivityAt: 20,
    density: 8300, melting: 1400, continuous: 1200, emissivity: 0.88,
    ctFrom: 100, ctStep: 100, ct: [1.01, 1.02, 1.03, 1.04, 1.05, 1.04, 1.04, 1.04, 1.04, 1.05, 1.06, 1.07],
    thermalTemperatures: [20, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100], heat: [460, 460, 480, 500, 520, 540, 560, 600, 630, 650, 670, 700],
    conductivity: [15, 15, 15, 15, 17, 19, 21, 22, 24, 26, 28, 30],
    expansion: [14.1, 14.9, 16.0, 17.2], expansionTo: [250, 500, 750, 1000],
  },
  // Wikipedia: Nichrome, Draper point, Mains electricity, Kettle, Hair dryer,
  // Properties of water, Density of air, Table of specific heat capacities.
  nichrome: {resistivity: 1.12e-6, spread: [1.0e-6, 1.5e-6], copper: 16.78e-9, melting: 1400, density: 8300},
  draper: {celsius: 525, kelvin: 798, fahrenheit: 977, found: 1847},
  mains: {volts: 230, hertz: 50, americanVolts: 120, americanHertz: 60},
  rated: {kettle: [2000, 3000], kettleCurrent: 13, dryer: 2000, earlyDryer: 100},
  water: {heat: 4184, heatAt: 20, vaporization: 2257e3, boiling: 100, density: 1000, steamHeat: 2080},
  air: {density: 1.2041, densityAt: 20, heat: 1012},
  sigma: 5.670374419e-8,
  // Drawn sizes typed in again, so a mutated model constant cannot move both sides of the test.
  drawn: {heaterCase: [600, 260], heaterCoil: 28, kettleBody: [170, 230], dryerBarrel: [200, 78], beamFull: 1800, heaterFaster: 8, kettleFaster: 10, mmPerUnit: 0.002, coldWire: 0x6b6f66},
  // Wikipedia: Electric heating, for what a heat pump does that a wire cannot.
  heatPump: {efficiency: [150, 600], cop: [1.5, 6]},
};

assert.deepEqual(JSON.parse(JSON.stringify(P.NIKROTHAL)), SRC.nikrothal);
assert.deepEqual(JSON.parse(JSON.stringify(P.NICHROME)), SRC.nichrome);
assert.deepEqual(JSON.parse(JSON.stringify(P.DRAPER)), SRC.draper);
assert.deepEqual(JSON.parse(JSON.stringify(P.MAINS)), SRC.mains);
assert.deepEqual(JSON.parse(JSON.stringify(P.RATED)), SRC.rated);
assert.deepEqual(JSON.parse(JSON.stringify(P.WATER)), SRC.water);
assert.deepEqual(JSON.parse(JSON.stringify(P.AIR)), SRC.air);
assert.equal(P.SIGMA, SRC.sigma);
assert.deepEqual(JSON.parse(JSON.stringify(P.DECLARED)), {
  still: 15, reflected: 0.75, bare: 0.35,
  toWater: 400, toAir: 3, vesselLoss: 0.7, steamAt: 100, dryCutout: 220,
  step: 0.05, samples: 161, heaterRun: 120, heaterFaster: 8, kettleRun: 300,
});
assert.deepEqual({...P.HEATER_DEFAULTS}, {volts: 230, length: 6, reflector: 1, room: 20});
assert.deepEqual({...P.KETTLE_DEFAULTS}, {volts: 230, mass: 1, start: 15, filled: 1});
assert.deepEqual({...P.DRYER_DEFAULTS}, {volts: 230, airflow: 35, room: 20, blocked: 0});
t.ok(P.HEATER_DEFAULTS.volts === SRC.mains.volts && P.KETTLE_DEFAULTS.volts === SRC.mains.volts && P.DRYER_DEFAULTS.volts === SRC.mains.volts, 'all three start on the mains voltage the page gives');
t.ok(P.HEATER_DOMAINS.volts[1] >= SRC.mains.volts && P.HEATER_DOMAINS.volts.includes(SRC.mains.americanVolts) === false, 'the supply spans past the mains voltage');
t.ok(P.DRAPER.celsius < P.NIKROTHAL.continuous && P.NIKROTHAL.continuous < P.NIKROTHAL.melting, 'the wire glows well before its working limit, and melts well after it');

// The datasheet tables, read the way the datasheet tabulates them.
{
  SRC.nikrothal.ct.forEach((value, i) => t.near(P.ctAt(SRC.nikrothal.ctFrom + i * SRC.nikrothal.ctStep), value, 1e-12, `the temperature factor at ${SRC.nikrothal.ctFrom + i * 100} °C`));
  SRC.nikrothal.heat.forEach((value, i) => t.near(P.specificAt(SRC.nikrothal.thermalTemperatures[i]), value, 1e-12, `the specific heat at ${SRC.nikrothal.thermalTemperatures[i]} °C`));
  SRC.nikrothal.conductivity.forEach((value, i) => t.near(P.conductivityAt(SRC.nikrothal.thermalTemperatures[i]), value, 1e-12, 'the thermal conductivity'));
  t.near(P.ctAt(SRC.nikrothal.resistivityAt), 1, 1e-12, 'and the factor is one where the resistivity is quoted');
  t.near(P.ctAt(150), (SRC.nikrothal.ct[0] + SRC.nikrothal.ct[1]) / 2, 1e-12, 'halfway between two tabulated points is halfway between their values');
  t.ok(P.ctAt(2000) === SRC.nikrothal.ct.at(-1) && P.specificAt(-100) === SRC.nikrothal.heat[0], 'past either end the tables are held flat rather than run off');
  t.ok(SRC.nikrothal.ct.every(value => value >= 1 && value <= 1.1), 'this alloy barely changes resistance at all, which is why it is used');
}

// The wire: its resistance from its resistivity, and its power from Joule's law.
{
  for (const [length, diameter] of [[6, 0.0004], [3.05, 0.0004], [5.2, 0.00055], [12, 0.0004]]) {
    const wire = P.wireOf(length, diameter);
    t.near(wire.area, Math.PI * diameter ** 2 / 4, 1e-18, 'the section of a round wire');
    t.near(wire.surface, Math.PI * diameter * length, 1e-15, 'and the skin of a cylinder');
    t.near(wire.mass, SRC.nikrothal.density * wire.area * length, 1e-15, 'its mass is its volume times its density');
    const cold = P.resistanceAt(wire, SRC.nikrothal.resistivityAt);
    t.near(cold, SRC.nikrothal.resistivity * length / wire.area, 1e-12, 'resistance is resistivity times length over section');
    // Joule's law by the other two routes: P = I V and P = I squared R.
    for (const volts of [120, 230, 240]) {
      const current = P.currentAt(wire, volts, 20), power = P.powerAt(wire, volts, 20);
      t.near(current, volts / P.resistanceAt(wire, 20), 1e-12, 'the current is the voltage over its own resistance');
      for (const hot of [400, 800, 1100]) {
        t.near(P.currentAt(wire, volts, hot), volts / P.resistanceAt(wire, hot), 1e-12, 'and follows the resistance at temperature, not the cold one');
        t.ok(P.currentAt(wire, volts, hot) < P.currentAt(wire, volts, 20), 'so a hotter wire draws less current');
      }
      t.near(power, current * volts, 1e-9, 'the power is the current times the voltage');
      t.near(power, current ** 2 * P.resistanceAt(wire, 20), 1e-9, 'and the current squared times the resistance');
      counts.solves++;
    }
    // Twice the length is twice the resistance; twice the diameter is a quarter of it.
    t.near(P.resistanceAt(P.wireOf(2 * length, diameter), 20), 2 * cold, 1e-12, 'twice the wire is twice the resistance');
    t.near(P.resistanceAt(P.wireOf(length, 2 * diameter), 20), cold / 4, 1e-12, 'and twice the thickness is a quarter of it');
  }
  const ratio = SRC.nichrome.resistivity / SRC.nichrome.copper;
  t.ok(f0(ratio) === '67', `the Nichrome page's own numbers make it ${f0(ratio)} times copper, as the page says`);
  t.ok(P.NIKROTHAL.resistivity >= SRC.nichrome.spread[0] && P.NIKROTHAL.resistivity <= SRC.nichrome.spread[1], 'and the datasheet alloy sits inside the spread that page gives for nichrome');
}

// The Draper point, recovered from Wien's displacement law.
{
  const wien = 2.897771955e-3, red = 700e-9;
  const peak = wien / SRC.draper.kelvin;
  t.ok(peak > red, `at the Draper point Wien's law puts the peak at ${f1(peak * 1e6)} \u03bcm, well past the red end of what an eye can see, which is why the page says a body just below it radiates mostly in the infrared`);
  t.ok(peak < 10e-6 && wien / red > SRC.draper.kelvin, 'and a body whose peak really is red would have to be far hotter still');
  t.near(SRC.draper.kelvin - 273.15, SRC.draper.celsius, 0.2, 'and the page’s two figures are the same temperature');
  t.near((SRC.draper.celsius * 9 / 5) + 32, SRC.draper.fahrenheit, 0.1, 'as is its third');
}

// The heater: its warm up integrated again, and its settled point found by bisection.
{
  for (const values of [{}, {volts: 120}, {length: 12}, {length: 4}, {room: 30}]) {
    const plan = P.heaterPlan(values);
    counts.plans++;
    const wire = plan.wire, room = plan.values.room, volts = plan.values.volts;
    // Where it settles: the temperature at which what it loses equals what it takes.
    const balance = celsius => P.radiatedAt(wire, celsius, room) + P.convectedAt(wire, celsius, room) - P.powerAt(wire, volts, celsius);
    if (volts > 0) {
      const settled = bisect(balance, room, SRC.nikrothal.melting);
      t.ok(Math.abs(settled - plan.steady) < 0.5, `${JSON.stringify(values)}: bisecting the balance puts the element at ${f1(settled)} °C against the model's ${f1(plan.steady)} °C`);
    }
    // The way up, integrated again at a twentieth of the step with Runge-Kutta.
    const derivative = (time, celsius) => (P.powerAt(wire, volts, celsius) - P.radiatedAt(wire, celsius, room) - P.convectedAt(wire, celsius, room)) / P.capacityAt(wire, celsius);
    let celsius = room;
    const dt = P.DECLARED.step / 20;
    for (let i = 0; i * dt < P.DECLARED.heaterRun; i++) celsius = rk4(celsius, i * dt, dt, derivative);
    t.ok(Math.abs(celsius - plan.settled.celsius) < 2, `and integrating it again lands within ${f2(Math.abs(celsius - plan.settled.celsius))} °C of the model`);
    // Radiation and convection, each by its own formula.
    t.near(plan.radiated, SRC.nikrothal.emissivity * SRC.sigma * wire.surface * ((plan.steady + 273.15) ** 4 - (room + 273.15) ** 4), 1e-9, 'what it radiates is Stefan and Boltzmann');
    t.near(plan.convected, P.DECLARED.still * wire.surface * (plan.steady - room), 1e-9, 'and what the air takes is the stated coefficient');
    t.ok(Math.abs(plan.power - plan.radiated - plan.convected) < 0.5, 'and together they are what it takes in');
    t.near(plan.forward, plan.radiated * (plan.values.reflector ? P.DECLARED.reflected : P.DECLARED.bare), 1e-9, 'the share sent forward follows the reflector');
    t.near(plan.radiantShare, plan.radiated / plan.power, 1e-12, 'the radiant share is radiation over the whole output');
    t.ok(plan.glows === (plan.steady >= 525), 'it glows exactly when it passes the Draper point of 525 degrees');
    t.ok(P.heaterPlan({volts: 60, length: 12}).glows === false, 'and a wire that never reaches it is not said to glow');
    {
      // A setting that lands inside the fifty degrees below the point, where a threshold
      // carried a little low would read as glowing and the real one does not.
      const near = P.heaterPlan({volts: 100, length: 6});
      t.ok(near.steady > 475 && near.steady < 525, `a wire settling at ${f0(near.steady)} °C is inside fifty degrees of the point`);
      t.ok(near.glows === false, 'and is still not said to glow, because the point is 525 and not a little under it');
    }
    t.ok(plan.tooHot === (plan.steady > SRC.nikrothal.continuous), 'and is flagged too hot exactly past the datasheet’s limit');
    t.ok(plan.steady <= SRC.nikrothal.melting, 'and never past melting');
    for (let i = 1; i < plan.track.length; i++) t.ok(plan.track[i].celsius >= plan.track[i - 1].celsius - 1e-9, 'the element only warms while it is on');
  }
  // The fourth power decides the character: hotter elements radiate a larger share.
  let previous = 0;
  for (const length of [12, 10, 8, 6, 5, 4]) {
    const plan = P.heaterPlan({length});
    counts.plans++;
    t.ok(plan.radiantShare > previous, 'a shorter, hotter element sends a larger share out as radiation');
    previous = plan.radiantShare;
  }
  t.ok(P.heaterPlan({volts: 0}).power === 0 && P.heaterPlan({volts: 0}).steady === P.HEATER_DEFAULTS.room, 'with nothing across it the element stays at room temperature');
  const cold = P.heaterPlan({}).coldPower, hot = P.heaterPlan({}).power;
  t.ok(cold > hot && Math.abs(cold / hot - P.ctAt(P.heaterPlan({}).steady)) < 0.01, 'the power falls as it warms, by exactly the datasheet’s factor');
  checkRefusals(P.sampleHeater, P.HEATER_DOMAINS, t);
}

// The glow, and the plan caches.
{
  t.ok(S.glowShare(525) === 0 && S.glowShare(524) === 0 && S.glowShare(400) === 0, 'nothing glows below the Draper point of 525 °C');
  t.ok(S.glowShare(526) > 0, 'and something does just above it');
  t.ok(S.wireColor(524).getHex() === SRC.drawn.coldWire && S.wireColor(300).getHex() === SRC.drawn.coldWire && S.wireColor(20).getHex() === SRC.drawn.coldWire,
    'a wire below the Draper point is drawn its cold gray, at any temperature under it');
  t.ok(S.wireColor(526).getHex() !== S.wireColor(300).getHex(), 'and a wire just above it is not');
  t.ok(S.glowShare(SRC.nikrothal.continuous) === 1 && S.glowShare(2000) === 1, 'and the glow is full by the datasheet’s limit');
  t.ok(S.glowOpacity(SRC.draper.celsius) === 0 && S.glowOpacity(SRC.nikrothal.continuous) > 0, 'the halo follows it');
  const dark = S.wireColor(300), bright = S.wireColor(1200);
  t.ok(bright.r > dark.r && bright.g > dark.g, 'and a hotter wire is drawn brighter');
  for (const [plan, values] of [[P.heaterPlan, {volts: 210}]]) {
    const first = plan(values);
    t.ok(plan(values) === first, 'a run already worked out is handed back rather than worked out again');
    for (let i = 0; i < 70; i++) { plan({volts: 0 + (i % 25) * 10, length: 4 + (i % 9) * 0.5}); counts.plans++; }
    t.ok(plan(values) !== first, 'and past sixty four settings the cache is dropped rather than kept for ever');
  }
}

console.log(`PASS shared resistance physics: ${t.count} checks, ${counts.steps} reference steps, ${counts.plans} plans and ${counts.solves} power balances. Dedicated checks cover heater, kettle and dryer lessons/models.`);

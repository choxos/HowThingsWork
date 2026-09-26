// Checks the three resistance heaters, their shared physics and their lessons
// against the sources typed in again and the physics worked out by other
// routes: the wire's resistance rebuilt from its resistivity, length and
// section, its warm up integrated again with Runge-Kutta at a twentieth of the
// step, the radiation balance solved by bisection instead of by marching, the
// water's rise closed by its own energy balance, the air's rise closed by its
// mass flow, the Draper point recovered from Wien's law, and every drawn coil,
// arrow, contact and curve read back at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './element-physics.js';
import * as S from './element-scene.js';
import * as HM from './electric-heating-model.js';
import * as KM from './electric-kettle-model.js';
import * as DM from './hair-dryer-model.js';
import * as L from './element-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {previewEntryIds} from './published-catalog.js';

const t = tally();
const counts = {steps: 0, plans: 0, poses: 0, points: 0, numbers: 0, solves: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2);
const drawn = 2e-6;

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
    heatFrom: 20, heatStep: 100, heat: [460, 460, 480, 500, 520, 540, 560, 600, 630, 650, 670, 700],
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
  dryerCoefficient: 4300, dryerFlow: 0.035, spinUp: 1,
  dryerOpen: 200, dryerClose: 160,
  step: 0.05, dryerStep: 0.002, samples: 161, heaterRun: 120, heaterFaster: 8, kettleRun: 300, dryerRun: 30,
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
  SRC.nikrothal.heat.forEach((value, i) => t.near(P.specificAt(SRC.nikrothal.heatFrom + i * SRC.nikrothal.heatStep), value, 1e-12, `the specific heat at ${SRC.nikrothal.heatFrom + i * 100} °C`));
  SRC.nikrothal.conductivity.forEach((value, i) => t.near(P.conductivityAt(SRC.nikrothal.heatFrom + i * SRC.nikrothal.heatStep), value, 1e-12, 'the thermal conductivity'));
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

// The kettle: the water's rise closed by its own energy balance, and the dry element integrated again.
{
  for (const values of [{}, {mass: 0.2}, {mass: 1.7}, {start: 40}, {volts: 120}]) {
    const plan = P.kettlePlan(values);
    counts.plans++;
    const v = plan.values;
    t.near(plan.needed, v.mass * SRC.water.heat * (SRC.water.boiling - v.start), 1e-9, 'the energy to boiling is the mass times the heat capacity times the climb');
    // Integrate the water again at a twentieth of the step, with the same law.
    let water = v.start, delivered = 0, lost = 0;
    const dt = P.DECLARED.step / 20;
    for (let i = 0; water < SRC.water.boiling && i * dt < P.DECLARED.kettleRun; i++) {
      let element = water + plan.rating / P.DECLARED.toWater;
      for (let k = 0; k < 3; k++) element = water + P.powerAt(plan.wire, v.volts, element) / P.DECLARED.toWater;
      const power = P.powerAt(plan.wire, v.volts, element), leak = P.DECLARED.vesselLoss * (water - v.start);
      delivered += power * dt; lost += leak * dt;
      water += (power - leak) * dt / (v.mass * SRC.water.heat);
      counts.steps++;
    }
    if (plan.boils) {
      const mine = P.kettleAt(plan, plan.switched).water;
      t.ok(Math.abs(mine - SRC.water.boiling) < 0.5, 'the model says boiling exactly where its own track reaches boiling');
      t.ok(Math.abs(water - SRC.water.boiling) < 1, 'and a finer integration agrees that it gets there');
      // The energy balance over the climb: what went in, less what leaked, is what the water holds.
      t.ok(Math.abs((delivered - lost) - v.mass * SRC.water.heat * (SRC.water.boiling - v.start)) / Math.max(1, plan.needed) < 0.02, 'the water’s energy balance closes over the climb');
    } else {
      t.ok(plan.switched === null && plan.settled.water < SRC.water.boiling, 'a kettle that cannot get there says so');
    }
    t.ok(plan.track.every(point => point.water <= SRC.water.boiling + 1e-9), 'water never reads above boiling');
    for (let i = 1; i < plan.track.length; i++) t.ok(plan.track[i].water >= plan.track[i - 1].water - 1e-9, 'and never cools while it is on');
    t.ok(plan.boiled === 0, 'and the switch opens before any of it is boiled away');
    if (v.volts === SRC.mains.volts) t.ok(plan.withinRating && plan.withinCurrent, `on the mains this element is ${f0(plan.rating)} W and ${f1(plan.current)} A, inside what the Kettle page gives`);
  }
  // More water is more time, in proportion; a warmer start is less.
  const light = P.kettlePlan({mass: 0.5}), heavy = P.kettlePlan({mass: 1.5});
  counts.plans += 2;
  t.ok(Math.abs(heavy.switched / light.switched - 3) < 0.15, 'three times the water is close to three times the wait');
  t.ok(P.kettlePlan({start: 40}).switched < P.kettlePlan({start: 5}).switched, 'and a warmer start is a shorter one');
  // Dry: the element's own heat capacity is what runs away, integrated again.
  {
    const plan = P.kettlePlan({filled: 0});
    counts.plans++;
    t.ok(plan.trips && plan.switched === null, 'switched on dry it is the element’s own protector that stops it, not the steam switch');
    const wire = plan.wire, room = plan.values.start;
    const derivative = (time, celsius) => (P.powerAt(wire, plan.values.volts, celsius) - P.DECLARED.toAir * (celsius - room)) / P.capacityAt(wire, celsius);
    let celsius = room, seconds = 0;
    const dt = P.DECLARED.step / 20;
    while (celsius < P.DECLARED.dryCutout && seconds < 5) { celsius = rk4(celsius, seconds, dt, derivative); seconds += dt; }
    t.ok(Math.abs(seconds - plan.tripped) < 0.1, `a finer integration reaches the cutout at ${f2(seconds)} s against the model's ${f2(plan.tripped)} s`);
    t.ok(plan.tripped < 1, 'and it happens far too fast for anybody to act on');
  }
  checkRefusals(P.sampleKettle, P.KETTLE_DOMAINS, t);
}

// The dryer: the air's rise closed by its mass flow, and the cutout's cycle.
{
  for (const values of [{}, {airflow: 20}, {airflow: 45}, {volts: 120}, {room: 30}]) {
    const plan = P.dryerPlan(values);
    counts.plans++;
    const v = plan.values;
    t.near(plan.massFlow, SRC.air.density * v.airflow / 1000, 1e-15, 'the air moved each second is its volume times its density');
    t.near(plan.idealRise, plan.rating / (plan.massFlow * SRC.air.heat), 1e-9, 'and the rise it could give is the power over that times the heat capacity');
    t.ok(plan.opened === null, 'with air moving, the cutout never opens');
    // Where the wire settles: what the stream and the still air together carry off matches what it takes.
    const wire = plan.wire, total = P.dryerConductance(wire, v.airflow) + P.DECLARED.still * wire.surface;
    const settled = bisect(celsius => total * (celsius - v.room) - P.powerAt(wire, v.volts, celsius), v.room, 600);
    t.ok(Math.abs(settled - plan.steady) < 1.5, `${JSON.stringify(values)}: the balance puts the wire at ${f0(settled)} °C against the model's ${f0(plan.steady)} °C`);
    // The air leaving carries what the stream took, and no more.
    const carried = P.dryerConductance(wire, v.airflow) * (plan.steady - v.room);
    t.ok(Math.abs((plan.outlet - v.room) - carried / (plan.massFlow * SRC.air.heat)) < 1, 'the air leaves carrying exactly what the stream took off the wire');
    t.ok(plan.outlet <= plan.steady + 1e-9, 'and never leaves hotter than the wire that warmed it');
    t.ok(plan.steady < SRC.draper.celsius, 'a dryer element never reaches the temperature at which metal glows brightly');
  }
  // Less air is a hotter stream and a hotter wire, in that order.
  let lastOutlet = 0, lastWire = 0;
  for (const airflow of [45, 40, 35, 30, 25, 20]) {
    const plan = P.dryerPlan({airflow});
    counts.plans++;
    t.ok(plan.outlet > lastOutlet && plan.steady > lastWire, 'less air through the same element is hotter air and a hotter wire');
    lastOutlet = plan.outlet; lastWire = plan.steady;
  }
  // Blocked: it cycles rather than burning out.
  {
    const plan = P.dryerPlan({blocked: 1});
    counts.plans++;
    t.ok(plan.cycles && plan.opened !== null && plan.closed !== null && plan.closed > plan.opened, 'blocked, the switch opens and then closes again');
    t.ok(plan.track.every(point => point.celsius <= P.DECLARED.dryerOpen + 5), 'and the element never runs far past the temperature it opens at');
    const atOpen = plan.track.find(point => point.t >= plan.opened);
    t.ok(atOpen.celsius >= P.DECLARED.dryerOpen - 5 && !atOpen.on, 'it opens where it says it opens');
    t.ok(plan.track.some(point => point.on) && plan.track.some(point => !point.on), 'and it spends time both ways');
  }
  t.ok(P.dryerPlan({volts: 0}).steady === P.DRYER_DEFAULTS.room, 'with nothing across it the wire stays at room temperature');
  t.ok(P.dryerPlan({}).track[0].celsius === P.DRYER_DEFAULTS.room, 'and every run starts from the room');
  checkRefusals(P.sampleDryer, P.DRYER_DOMAINS, t);
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
  for (const [plan, values] of [[P.heaterPlan, {volts: 210}], [P.kettlePlan, {volts: 210}], [P.dryerPlan, {volts: 210}]]) {
    const first = plan(values);
    t.ok(plan(values) === first, 'a run already worked out is handed back rather than worked out again');
    for (let i = 0; i < 70; i++) { plan({volts: 0 + (i % 25) * 10, ...(plan === P.heaterPlan ? {length: 4 + (i % 9) * 0.5} : plan === P.kettlePlan ? {mass: 0.2 + (i % 15) * 0.1} : {airflow: 20 + (i % 26)})}); counts.plans++; }
    t.ok(plan(values) !== first, 'and past sixty four settings the cache is dropped rather than kept for ever');
  }
}

// ---------------------------------------------------------------------------
// 2. The drawings, read back from their geometry.
// ---------------------------------------------------------------------------

const pointsOf = line => {
  const array = line.geometry.attributes.position.array, count = line.geometry.drawRange.count, room = array.length / 3;
  const n = Number.isFinite(count) ? Math.min(count, room) : room;
  return Array.from({length: n}, (_, i) => [array[i * 3], array[i * 3 + 1], array[i * 3 + 2]]);
};
const extent = points => ({
  x: [Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0]))],
  y: [Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1]))],
});
const worldRectOf = object => { const box = new THREE.Box3().setFromObject(object); return {x: [box.min.x, box.max.x], y: [box.min.y, box.max.y]}; };
const inside = (a, b) => a.x[0] > b.x[0] - 1e-9 && a.x[1] < b.x[1] + 1e-9 && a.y[0] > b.y[0] - 1e-9 && a.y[1] < b.y[1] + 1e-9;
const apart = (a, b) => a.x[1] < b.x[0] || b.x[1] < a.x[0] || a.y[1] < b.y[0] || b.y[1] < a.y[0];
const sameColor = (color, other) => Math.abs(color.r - other.r) < 1e-6 && Math.abs(color.g - other.g) < 1e-6 && Math.abs(color.b - other.b) < 1e-6;

// The heater.
const heater = HM.createElectricHeatingModel(), HT = heater.topology;
const poseHeater = (values, time) => { heater.reset(); if (values) heater.update(values); if (time) heater.advance(time); heater.root.updateMatrixWorld(true); counts.poses++; return heater.getState(); };
{
  poseHeater(null, 0);
  const casing = extent(pointsOf(HT.caseLine));
  t.near(casing.x[1] - casing.x[0], SRC.drawn.heaterCase[0] * SRC.drawn.mmPerUnit, drawn, 'the heater is drawn its 600 mm wide');
  t.near(casing.y[1] - casing.y[0], SRC.drawn.heaterCase[1] * SRC.drawn.mmPerUnit, drawn, 'and its 260 mm tall');
  t.near(casing.y[1] - casing.y[0], HM.HEATER.casing[1] * HM.MM, drawn, 'and its 260 mm tall');
  t.ok(HM.MM * 1000 === 2 && HM.WIRE_TIMES === 25, 'at true size, with only the wire thickened');
  const coilBox = worldRectOf(HT.coil), caseBox = worldRectOf(HT.caseLine);
  t.ok(inside(coilBox, caseBox), 'the element sits inside the case');
  // Measured from the drawn points, not from a world box: the scene carries a small
  // rotation, which foreshortens a world box by a fraction of a percent.
  const coilDrawn = extent(pointsOf(HT.coil));
  t.near(coilDrawn.x[1] - coilDrawn.x[0], SRC.drawn.heaterCoil * SRC.drawn.mmPerUnit, drawn, 'and the coil is drawn its true 28 mm across');
  t.near(coilDrawn.y[1] - coilDrawn.y[0], 2 * HM.HEATER.element[2] * HM.MM, drawn, 'and as tall as it is wide, being a circle');
  t.ok(apart(worldRectOf(HT.bars), coilBox), 'the guard never touches the element');
  t.ok(worldRectOf(HT.bars).x[0] > coilBox.x[1], 'and stands in front of it');
  // The coil takes the color of its own temperature, and nothing glows cold.
  for (const values of [{}, {volts: 120}, {length: 4}, {volts: 0}]) {
    const state = poseHeater(values, 30);
    t.ok(sameColor(HT.coil.material.color, S.wireColor(state.now.celsius)), `the element is drawn at the ${f0(state.now.celsius)} °C it reached`);
    t.near(HT.halo.material.opacity, S.glowOpacity(state.now.celsius), 1e-9, 'and its halo follows the same glow');
  }
  poseHeater({volts: 0}, 30);
  t.ok(HT.halo.material.opacity === 0, 'a cold element has no glow at all');
  {
    const cold = poseHeater({volts: 60, length: 12}, 119), coldHex = HT.coil.material.color.getHex();
    t.ok(cold.now.celsius < 525, 'this setting keeps the wire below the Draper point');
    t.ok(coldHex === S.wireColor(300).getHex(), 'and the coil is drawn its cold color, not a glowing one');
    const warm = poseHeater(null, 119);
    t.ok(warm.now.celsius > 525 && HT.coil.material.color.getHex() !== coldHex, 'while a glowing wire is drawn differently');
  }
  // The reflector turns the rearward arrows round, and the arrows are on one fixed scale.
  const directions = () => HT.beams.map(arrow => new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion).x);
  poseHeater({reflector: 1}, 30);
  t.ok(HT.dish.visible && HT.dishFill.visible, 'the dish is drawn when it is fitted');
  t.ok(directions().every(x => x > -1e-9), 'with the reflector fitted every arrow points into the room');
  const withDish = HT.beams[0].userData.length;
  poseHeater({reflector: 0}, 30);
  t.ok(!HT.dish.visible && !HT.dishFill.visible, 'and not drawn when it is not');
  t.ok(directions().some(x => x < -1e-9), 'without it some point back at the wall');
  t.near(HT.beams[0].userData.length, withDish, 1e-12, 'and the arrows are the same length either way, since the reflector makes no heat');
  for (const [values, expected] of [[{}, null], [{volts: 120}, null], [{length: 4}, null]]) {
    const state = poseHeater(values, 30);
    t.ok(HM.BEAM_FULL === SRC.drawn.beamFull, 'the arrows reach full length at the stated 1,800 W');
    const wanted = HM.HEATER.beam[0] + HM.HEATER.beam[1] * Math.min(1, state.now.radiated / SRC.drawn.beamFull);
    for (const arrow of HT.beams) t.near(arrow.userData.length, wanted, 1e-9, `each arrow is drawn for the ${f0(state.now.radiated)} W it radiates, on the one scale`);
    counts.points += HT.beams.length;
  }
  // The chart.
  for (const values of [{}, {volts: 120}, {length: 4}]) {
    const state = poseHeater(values, 0);
    const guide = pointsOf(HT.guideCurve);
    t.ok(guide.length === P.DECLARED.samples, 'the whole warm up is drawn faintly');
    state.chart.forEach((sample, i) => {
      t.near(guide[i][0], HM.chartX(state, sample.t), drawn, 'each sample at its time');
      t.near(guide[i][1], HM.chartY(sample.celsius), drawn, 'and at its temperature');
    });
    counts.points += guide.length;
    t.ok(guide.every(point => point[1] >= HM.CHART.y - drawn && point[1] <= HM.CHART.y + HM.CHART.h + drawn), 'and stays inside its frame');
    t.near(pointsOf(HT.draperLine)[0][1], HM.chartY(SRC.draper.celsius), drawn, 'the Draper point is drawn where it falls');
    t.near(pointsOf(HT.limitLine)[0][1], HM.chartY(SRC.nikrothal.continuous), drawn, 'and so is the datasheet’s limit');
  }
  poseHeater(null, 0);
  t.ok(pointsOf(HT.curve).length === 0 && pointsOf(HT.cursor).length === 0, 'nothing is drawn dark before the run starts');
  const half = poseHeater(null, 5), grown = pointsOf(HT.curve).length;
  t.ok(grown > 1 && grown < P.DECLARED.samples, 'the dark curve grows with the clock');
  t.near(pointsOf(HT.curve).at(-1)[1], HM.chartY(half.now.celsius), drawn, 'and its last point is what the element reads now');
  t.ok(apart(extent(pointsOf(HT.chartFrame)), worldRectOf(HT.caseLine)), 'the chart is kept clear of the heater');
}

// The kettle.
const kettle = KM.createElectricKettleModel(), KT = kettle.topology;
const poseKettle = (values, time) => { kettle.reset(); if (values) kettle.update(values); if (time) kettle.advance(time / KM.FASTER); kettle.root.updateMatrixWorld(true); counts.poses++; return kettle.getState(); };
{
  poseKettle(null, 0);
  const bodyBox = extent(pointsOf(KT.bodyLine));
  t.near(bodyBox.x[1] - bodyBox.x[0], SRC.drawn.kettleBody[0] * SRC.drawn.mmPerUnit, drawn, 'the kettle is drawn its 170 mm across');
  t.near(bodyBox.y[1] - bodyBox.y[0], (KM.KETTLE.body[3] - KM.KETTLE.body[2]) * KM.MM, drawn, 'and its 230 mm tall');
  t.ok(inside(worldRectOf(KT.coil), worldRectOf(KT.bodyLine)), 'the element sits inside the body');
  // More water is drawn deeper, and the pool carries its own temperature.
  let lastDepth = 0;
  for (const mass of [0.2, 0.6, 1, 1.4, 1.7]) {
    const state = poseKettle({mass}, 0);
    const pool = worldRectOf(KT.pool);
    t.ok(pool.y[1] > lastDepth, 'more water is drawn deeper');
    lastDepth = pool.y[1];
    t.ok(inside(pool, worldRectOf(KT.bodyLine)), 'and never over the top of the kettle');
    t.ok(sameColor(KT.pool.material.color, KM.waterColor(state.now.water)), 'the water is drawn at its own temperature');
  }
  const warm = poseKettle(null, 160), coldStart = poseKettle(null, 0);
  t.ok(!sameColor(KM.waterColor(warm.now.water), KM.waterColor(coldStart.now.water)), 'and hot water is drawn differently from cold');
  // The switch, the steam, and the dry element.
  poseKettle(null, 0);
  const closed = KT.strip.position.y;
  t.ok(!KT.puffs[0].visible, 'no steam before it boils');
  const boiled = poseKettle(null, 1e4);
  t.ok(boiled.now.switched && KT.strip.position.y > closed, 'the strip moves when the switch is thrown');
  t.ok(KT.puffs[0].visible, 'and steam is drawn once it is boiling');
  const dry = poseKettle({filled: 0}, 1e4);
  t.ok(!KT.pool.visible && dry.now.tripped, 'switched on dry there is no water drawn, and the protector trips');
  t.ok(sameColor(KT.coil.material.color, S.wireColor(dry.now.celsius)), 'and the element is drawn at the temperature it reached');
  // The chart.
  for (const values of [{}, {mass: 0.2}, {volts: 120}]) {
    const state = poseKettle(values, 0);
    const guide = pointsOf(KT.guideWater);
    t.ok(guide.length === P.DECLARED.samples, 'the whole run is drawn faintly');
    state.chart.forEach((sample, i) => {
      t.near(guide[i][0], KM.chartX(state, sample.t), drawn, 'each sample at its time');
      t.near(guide[i][1], KM.chartY(sample.water), drawn, 'and at the water it reads');
    });
    counts.points += guide.length;
    t.near(pointsOf(KT.boilLine)[0][1], KM.chartY(SRC.water.boiling), drawn, 'boiling is drawn where it falls');
    t.ok(KT.switchMark.visible === ((state.switched ?? state.tripped) !== null), 'the mark is there only when something stops it');
  }
  poseKettle(null, 0);
  t.ok(pointsOf(KT.curveWater).length === 0 && pointsOf(KT.cursor).length === 0, 'nothing is drawn dark before the run starts');
}

// The dryer.
const dryer = DM.createHairDryerModel(), DT = dryer.topology;
const poseDryer = (values, time) => { dryer.reset(); if (values) dryer.update(values); if (time) dryer.advance(time); dryer.root.updateMatrixWorld(true); counts.poses++; return dryer.getState(); };
{
  poseDryer(null, 0);
  const barrel = extent(pointsOf(DT.barrelLine));
  t.near(barrel.x[1] - barrel.x[0], SRC.drawn.dryerBarrel[0] * SRC.drawn.mmPerUnit, drawn, 'the dryer is drawn its 200 mm long');
  t.near(barrel.y[1] - barrel.y[0], (DM.DRYER.barrel[3] - DM.DRYER.barrel[2]) * DM.MM, drawn, 'and its 78 mm across');
  t.ok(inside(worldRectOf(DT.coil), worldRectOf(DT.barrelLine)), 'the element sits inside the barrel');
  t.ok(apart(worldRectOf(DT.fanRing), worldRectOf(DT.coil)), 'and the fan stands clear of it, behind');
  t.ok(worldRectOf(DT.fanRing).x[1] <= worldRectOf(DT.coil).x[0] + 1e-9, 'so that the air reaches the element after the fan');
  // The air marks carry their own temperature, and the arrows follow the flow.
  for (const values of [{}, {airflow: 20}, {airflow: 45}]) {
    const state = poseDryer(values, 20);
    t.ok(DT.marks.every(mark => mark.visible), 'with the inlet clear the air is drawn moving');
    t.ok(DT.inletArrow.userData.length > 0 && DT.outletArrow.userData.length > 0, 'and both arrows are drawn');
    t.ok(sameColor(DT.coil.material.color, S.wireColor(state.now.celsius)), `the element is drawn at the ${f0(state.now.celsius)} °C it settled at`);
  }
  {
    // Swept across the whole control space the hottest this wire ever gets is 202.5 °C,
    // far under the Draper point, so it is always drawn the cold gray. The claim worth
    // making is that it never glows, not that its color moves.
    const cool = poseDryer({volts: 120}, 20);
    const coolC = cool.now.celsius, coolHex = DT.coil.material.color.getHex();
    const hot = poseDryer({airflow: 20}, 20);
    t.ok(hot.now.celsius > coolC, 'less air and more volts is a hotter wire');
    t.ok(hot.now.celsius < SRC.draper.celsius, `and the hottest of them, at ${f0(hot.now.celsius)} °C, is nowhere near the ${f0(SRC.draper.celsius)} °C at which metal glows`);
    t.ok(DT.coil.material.color.getHex() === SRC.drawn.coldWire && coolHex === SRC.drawn.coldWire, 'so the element is drawn the cold gray at either setting');
  }
  const slow = poseDryer({airflow: 20}, 20).now.outlet, fast = poseDryer({airflow: 45}, 20).now.outlet;
  t.ok(slow > fast, 'less air really does come out hotter');
  const blocked = poseDryer({blocked: 1}, 20);
  t.ok(!DT.marks[0].visible && DT.inletArrow.userData.length === 0, 'blocked, no air is drawn at all');
  t.ok(blocked.opened !== null, 'and the cutout has opened');
  poseDryer({blocked: 1}, 1.4);
  t.ok(DT.strip.material.color.getHex() === DM.COLORS.open, 'the strip is drawn open while it is open');
  poseDryer(null, 20);
  t.ok(DT.strip.material.color.getHex() === DM.COLORS.gold, 'and closed while it is closed');
  // The chart.
  for (const values of [{}, {airflow: 20}, {blocked: 1}]) {
    const state = poseDryer(values, 0);
    const guide = pointsOf(DT.guideOutlet);
    t.ok(guide.length === P.DECLARED.samples, 'the whole run is drawn faintly');
    state.chart.forEach((sample, i) => t.near(guide[i][1], DM.chartY(sample.outlet), drawn, 'each sample at the air it reads'));
    counts.points += guide.length;
    t.near(pointsOf(DT.openLine)[0][1], DM.chartY(P.DECLARED.dryerOpen), drawn, 'the cutout’s threshold is drawn where it falls');
    t.ok(DT.openMark.visible === (state.opened !== null), 'and the mark only where it opened');
  }
  poseDryer(null, 0);
  t.ok(pointsOf(DT.curveOutlet).length === 0 && pointsOf(DT.cursor).length === 0, 'nothing is drawn dark before the run starts');
}

// Nothing anywhere is left infinite, at any setting or time.
const heaterSettings = [{}, {volts: 0}, {volts: 120}, {length: 4}, {length: 12}, {reflector: 0}, {room: 30}];
const kettleSettings = [{}, {volts: 0}, {volts: 120}, {mass: 0.2}, {mass: 1.7}, {start: 40}, {filled: 0}];
const dryerSettings = [{}, {volts: 0}, {volts: 120}, {airflow: 20}, {airflow: 45}, {blocked: 1}, {room: 30}];
for (const [pose, settings] of [[poseHeater, heaterSettings], [poseKettle, kettleSettings], [poseDryer, dryerSettings]]) {
  for (const values of settings) for (const time of [0, 1, 10, 1e4]) { pose(values, time); }
}
for (const model of [heater, kettle, dryer]) checkFinite(model.root, t);

// ---------------------------------------------------------------------------
// 3. The lessons.
// ---------------------------------------------------------------------------

const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
function covered(text, expected, where) {
  checkQuotedText(text, expected, t);
  const spans = [];
  for (const snippet of Object.keys(expected)) for (let i = text.indexOf(snippet); i >= 0; i = text.indexOf(snippet, i + 1)) spans.push([i, i + snippet.length]);
  for (const match of text.matchAll(NUMBER)) {
    t.ok(spans.some(([a, b]) => a <= match.index && match.index + match[0].length <= b), `${where}: the number ${match[0]} in “${text.slice(Math.max(0, match.index - 40), match.index + 20)}” is checked`);
    counts.numbers++;
  }
}
const texts = item => [['simple', item.simple], ['overview', item.overview], ...item.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...item.parts.map((part, i) => [`part ${i + 1}`, part.role]), ['misconception', item.misconception], ['quiz', [item.quiz.question, ...item.quiz.options].join(' ')]];

const heaterDefault = P.heaterPlan({}), heaterBare = P.heaterPlan({reflector: 0});
const heaterLong = P.heaterPlan({length: 12}), heaterShort = P.heaterPlan({length: 4});
const heaterLow = P.heaterPlan({volts: 120}), heaterWarm = P.heaterPlan({room: 30});
checkTrialNumbers(L.electricHeatingLesson, {
  'Switch it on cold': s => ({959: s.steady, 972: s.power, 866: s.radiated}),
  'Take the reflector away': s => { t.ok(s.power === heaterDefault.power && s.steady === heaterDefault.steady, 'the element is untouched by the reflector'); return {649: heaterDefault.forward, 303: s.forward, 346: heaterDefault.radiated * (P.DECLARED.reflected - P.DECLARED.bare)}; },
  'Wind in more wire': s => ({'104.1': P.resistanceAt(s.wire, s.values.room), '52.0': P.resistanceAt(heaterDefault.wire, heaterDefault.values.room), 487: s.power, 564: s.steady}),
  'Cut the element short': s => { t.ok(s.tooHot, 'a short element runs past the datasheet limit'); return {'1,425': s.power, '1,246': s.steady, '1,200': P.NIKROTHAL.continuous}; },
  'Plug it in in America': s => ({266: s.power, 972: heaterDefault.power, 585: s.steady}),
  'Follow the heat out': s => ({866: s.radiated, 106: s.convected, 89: 100 * s.radiantShare, 11: 100 - 100 * s.radiantShare}),
  'Warm the room it stands in': s => ({960: s.steady, 105: s.convected, 106: heaterDefault.convected}),
}, values => P.heaterPlan(values), t);

const kettleDefault = P.kettlePlan({}), kettleSmall = P.kettlePlan({mass: 0.2}), kettleFull = P.kettlePlan({mass: 1.7});
const kettleWarm = P.kettlePlan({start: 40}), kettleLow = P.kettlePlan({volts: 120}), kettleDry = P.kettlePlan({filled: 0});
checkTrialNumbers(L.electricKettleLesson, {
  'Boil a kettleful': s => { t.ok(s.boils, 'the default kettle boils'); return {'2,217': s.rating, 164: s.switched, 356: s.needed / 1000}; },
  'Boil just a cupful': s => ({71: s.needed / 1000, 33: s.switched, 164: kettleDefault.switched}),
  'Fill it to the top': s => ({605: s.needed / 1000, 278: s.switched}),
  'Start with warm water': s => ({251: s.needed / 1000, 356: kettleDefault.needed / 1000, 115: s.switched}),
  'Plug it in in America': s => { t.ok(!s.boils, 'at 120 V it does not get there'); return {604: s.rating, 300: P.DECLARED.kettleRun, '57.1': s.settled.water}; },
  'Switch it on empty': s => { t.ok(s.trips, 'dry, the protector trips'); return {'0.6': s.tripped, 220: P.DECLARED.dryCutout}; },
  'Watch the switch, not the clock': s => ({164: s.switched, 100: P.WATER.boiling}),
}, values => P.kettlePlan(values), t);

const dryerDefault = P.dryerPlan({}), dryerSlow = P.dryerPlan({airflow: 20}), dryerFast = P.dryerPlan({airflow: 45});
const dryerBlocked = P.dryerPlan({blocked: 1}), dryerLow = P.dryerPlan({volts: 120}), dryerWarm = P.dryerPlan({room: 30});
checkTrialNumbers(L.hairDryerLesson, {
  'Switch it on': s => ({'2,000': s.rating, 139: s.steady, 66: s.outlet}),
  'Turn the fan down': s => ({'2,000': s.rating, '24.1': 1000 * s.massFlow, 100: s.outlet, 177: s.steady}),
  'Turn the fan up': s => ({'54.2': 1000 * s.massFlow, 56: s.outlet, 125: s.steady}),
  'Block the inlet': s => { t.ok(s.cycles, 'blocked, it cycles'); return {'1.1': s.opened, '8.0': s.closed}; },
  'Plug it in in America': s => ({544: s.rating, 33: s.outlet, 53: s.steady}),
  'Follow the air through': s => ({'42.1': 1000 * s.massFlow, '2,000': s.rating, 47: s.idealRise}),
  'Use it in a warm room': s => ({10: s.values.room - dryerDefault.values.room, 76: s.outlet}),
}, values => P.dryerPlan(values), t);

for (const lesson of [L.electricHeatingLesson, L.electricKettleLesson, L.hairDryerLesson]) {
  for (const [where, text] of texts(lesson)) covered(text, {}, `${lesson.simple.slice(0, 20)} ${where}`);
}

const sharedLimits = {
  [`carry ${f0(P.DECLARED.still)} W from each square meter`]: 'carry 15 W from each square meter',
};
covered(L.elementLimits, sharedLimits, 'element limits');
covered(L.electricHeatingLimits, {
  ...sharedLimits,
  [`send ${f0(100 * P.DECLARED.reflected)} percent of the radiation forward instead of ${f0(100 * P.DECLARED.bare)} percent`]: 'send 75 percent of the radiation forward instead of 35 percent',
}, 'heater limits');
covered(L.electricKettleLimits, {
  ...sharedLimits,
  [`pass ${f0(P.DECLARED.toWater)} W to the water for each degree`]: 'pass 400 W to the water for each degree',
  [`only ${f0(P.DECLARED.toAir)} W for each degree`]: 'only 3 W for each degree',
  [`lose ${f1(P.DECLARED.vesselLoss)} W for each degree`]: 'lose 0.7 W for each degree',
  [`protector to open at ${f0(P.DECLARED.dryCutout)} °C`]: 'protector to open at 220 °C',
  [`Boiling is fixed at ${f0(P.WATER.boiling)} °C`]: 'Boiling is fixed at 100 °C',
}, 'kettle limits');
// The deeper sections, whose numbers no mapping covered until now.
{
  const d = P.heaterPlan({}), dry = P.dryerPlan({});
  covered(L.electricHeatingLesson.deeper[1].body, {
    [`from ${f1(P.resistanceAt(d.wire, 20))} \u03a9 to ${f1(d.hot)} \u03a9`]: 'from 52.0 \u03a9 to 54.4 \u03a9',
    [`from ${f0(d.coldPower)} W the instant it is switched on to ${f0(d.power)} W once it is hot, ${f1(100 * (1 - d.drift))}% less`]: 'from 1,016 W the instant it is switched on to 972 W once it is hot, 4.4% less',
  }, 'heater deeper 2');
  covered(L.electricHeatingLesson.deeper[2].body, {
    [`weighs ${f1(1000 * d.wire.mass)} g`]: 'weighs 6.3 g',
    [`that is ${f1(d.wire.mass * P.specificAt(20))} J for each degree`]: 'that is 2.9 J for each degree',
  }, 'heater deeper 3');
  covered(L.electricHeatingLesson.deeper[3].body, {
    [`puts it at ${f0(SRC.draper.celsius)} \u00b0C, or ${f0(SRC.draper.kelvin)} K, established by John William Draper in ${SRC.draper.found}`]: 'puts it at 525 \u00b0C, or 798 K, established by John William Draper in 1847',
  }, 'heater deeper 4');
  covered(L.hairDryerLesson.deeper[1].body, {
    [`dry air ${f2(SRC.air.density)} kg/m\u00b3`]: 'dry air 1.20 kg/m\u00b3',
    [`give it ${f0(SRC.air.heat)} J for each kilogram and degree`]: 'give it 1,012 J for each kilogram and degree',
    [`so ${f0(dry.values.airflow)} L/s is ${f1(1000 * dry.massFlow)} g/s, and ${f0(dry.rating)} W spread over that is ${f0(dry.idealRise)} \u00b0C of rise`]: 'so 35 L/s is 42.1 g/s, and 2,000 W spread over that is 47 \u00b0C of rise',
    [`at ${f0(20)} L/s the same element sends out air at ${f0(P.dryerPlan({airflow: 20}).outlet)} \u00b0C`]: 'at 20 L/s the same element sends out air at 100 \u00b0C',
  }, 'dryer deeper 2');
}
covered(L.electricHeatingLesson.limits, {
  [`${f0(HM.WIRE_TIMES)} times thicker`]: '25 times thicker',
  [`lasts ${f0(P.DECLARED.heaterRun)} s`]: 'lasts 120 s',
  [`plays ${f0(P.DECLARED.heaterFaster)} times faster`]: 'plays 8 times faster',
  ...sharedLimits,
  [`send ${f0(100 * P.DECLARED.reflected)} percent of the radiation forward instead of ${f0(100 * P.DECLARED.bare)} percent`]: 'send 75 percent of the radiation forward instead of 35 percent',
}, 'heater lesson limits');
covered(L.electricKettleLesson.limits, {
  [`plays ${f0(KM.FASTER)} times faster`]: 'plays 10 times faster',
  ...sharedLimits,
  [`pass ${f0(P.DECLARED.toWater)} W to the water for each degree`]: 'pass 400 W to the water for each degree',
  [`only ${f0(P.DECLARED.toAir)} W for each degree`]: 'only 3 W for each degree',
  [`lose ${f1(P.DECLARED.vesselLoss)} W for each degree`]: 'lose 0.7 W for each degree',
  [`protector to open at ${f0(P.DECLARED.dryCutout)} °C`]: 'protector to open at 220 °C',
  [`Boiling is fixed at ${f0(P.WATER.boiling)} °C`]: 'Boiling is fixed at 100 °C',
}, 'kettle lesson limits');
covered(L.hairDryerLesson.limits, {
  ...sharedLimits,
  'reach its speed in one second': 'reach its speed in one second',
  [`open at ${f0(P.DECLARED.dryerOpen)} °C and close again at ${f0(P.DECLARED.dryerClose)} °C`]: 'open at 200 °C and close again at 160 °C',
}, 'dryer lesson limits');
covered(L.hairDryerLimits, {
  ...sharedLimits,
  [`reach its speed in one second`]: 'reach its speed in one second',
  [`open at ${f0(P.DECLARED.dryerOpen)} °C and close again at ${f0(P.DECLARED.dryerClose)} °C`]: 'open at 200 °C and close again at 160 °C',
}, 'dryer limits');

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

const machines = [
  ['Electric heating', heater, HT, L.electricHeatingLesson, P.HEATER_DOMAINS, P.HEATER_DEFAULTS, 'electric-heating',
    () => [HT.coil.material.color.getHex(), HT.halo.material.opacity, HT.dish.visible, HT.beams.map(a => [Number(a.userData.length.toFixed(5)), Number(a.quaternion.z.toFixed(5))]), pointsOf(HT.guideCurve).slice(0, 20), pointsOf(HT.curve).slice(-2)],
    model => model.advance(P.DECLARED.heaterRun)],
  ['Electric kettle', kettle, KT, L.electricKettleLesson, P.KETTLE_DOMAINS, P.KETTLE_DEFAULTS, 'electric-kettle',
    () => [KT.pool.material.color.getHex(), KT.pool.scale.y, KT.coil.material.color.getHex(), KT.strip.position.y, KT.puffs[0].visible, pointsOf(KT.guideWater).slice(0, 20), pointsOf(KT.curveWater).slice(-2)],
    model => model.advance(P.DECLARED.kettleRun)],
  ['Hair dryer', dryer, DT, L.hairDryerLesson, P.DRYER_DOMAINS, P.DRYER_DEFAULTS, 'hair-dryer',
    () => [DT.coil.material.color.getHex(), DT.glow.material.opacity, DT.strip.position.y, DT.strip.material.color.getHex(), DT.inletArrow.userData.length, DT.outletArrow.userData.length, DT.marks.map(m => m.material.color.getHex()), pointsOf(DT.guideOutlet).slice(0, 20), pointsOf(DT.curveOutlet).slice(-2)],
    model => model.advance(P.DECLARED.dryerRun)],
];

for (const [name, model, topology, lesson, domains, defaults, id, snapshot, settle] of machines) {
  for (const control of model.controls) {
    const [lo, hi, step] = domains[control.key];
    t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === defaults[control.key], `${name} ${control.key}: the control spans its domain from its default`);
    t.ok(control.help && !/[—–]| - |--/.test(control.help), `${name} ${control.key}: helped, without dashes`);
  }
  t.ok(model.controls.map(control => control.key).join() === Object.keys(domains).join(), `${name}: the controls are the domains`);
  checkControlsMove(model, snapshot, settle, t);
  model.reset();
  checkFinite(model.root, t);
  t.ok(!model.playback.complete() && !model.resultPart.available(), `${name}: nothing to inspect before the run`);
  if (name === 'Electric heating') { model.reset(); model.advance(1); t.near(model.getState().clock, SRC.drawn.heaterFaster, 1e-9, 'a second of heater playback is eight seconds of run'); model.reset(); }
  if (name === 'Electric kettle') { model.reset(); model.advance(1); t.near(model.getState().clock, SRC.drawn.kettleFaster, 1e-9, 'a second of kettle playback is ten seconds of run'); model.reset(); }
  t.ok(!model.playback.blocked(), 'and the run is ready to press');
  model.update({volts: 0});
  t.ok(model.playback.blocked(), `${name}: with nothing across the element there is nothing to run`);
  model.reset();
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.ok(JSON.stringify(model.getState().readings) !== before, `${name}: a step changes the readings`);
  model.animate(0);
  model.animate(1);
  model.advance(1e5);
  t.ok(model.playback.complete() && model.resultPart.available() && model.resultPart.id === 'chart', `${name}: the run done, with the chart to inspect`);
  model.reset();
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part), `${name}: ${action.label} returns readings`);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), `${name}: every part described, with no dashes, under the system`);
  t.ok(model.getState().readings[0].label === 'Your result', `${name}: the result comes first`);
  t.ok(model.getState().readings.slice(1).every(item => item.hint), 'and everything after it carries a hint');
  // The lesson's contract with the model.
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${name}: a quiz with its answer first`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `${name}: no dashes as punctuation: ${text.slice(0, 50)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|aluminium|vapour|sulphur)\b/i.test(text), `${name}: American spelling: ${text.slice(0, 50)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, `${name}: every source a link, none twice`);
  t.ok(lesson.sources.length >= 2, 'and there is more than one of them');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), `${name}: every trial on a part the model has`);
  t.ok(lesson.tryIt.every(item => item.part !== 'system'), 'each trial points at the part it is about, not at the whole machine');
  t.ok(new Set(lesson.tryIt.map(item => item.part)).size >= 4, 'and the trials are spread across the machine');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), `${name}: every part named is a part the model has`);
  t.ok(lesson.steps.length === 5 && lesson.deeper.length >= 5 && lesson.tryIt.length === 7 && lesson.parts.length >= 6, `${name}: five steps, at least five deeper sections, seven trials and at least six parts`);
  t.ok(heatingLessons[name] === lesson, `${name}: the heating lessons carry this lesson`);
  const routed = createHeatingModel(name);
  t.ok(routed && routed.controls.map(control => control.key).join() === Object.keys(domains).join(), `${name}: the heating models route it here`);
  routed.dispose();
  t.ok(previewEntryIds.includes(id), `${name}: routed into the preview as ${id}`);
  for (const values of (name === 'Electric heating' ? heaterSettings : name === 'Electric kettle' ? kettleSettings : dryerSettings)) {
    for (const time of [0, 2, 1e4]) {
      model.reset(); model.update(values); model.advance(time);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), `${name}: readings are all numbers`);
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')), `${name}: reading text without dashes: ${item.label}`);
    }
  }
}

const released = [
  checkDisposal((() => { const fresh = HM.createElectricHeatingModel(); fresh.advance(3); return fresh; })(), t),
  checkDisposal((() => { const fresh = KM.createElectricKettleModel(); fresh.advance(3); return fresh; })(), t),
  checkDisposal((() => { const fresh = DM.createHairDryerModel(); fresh.advance(3); return fresh; })(), t),
].reduce((sum, value) => sum + value, 0);
// A kettle switched on dry draws no water: fillLine shows any line it fills, so the order matters.
kettle.update({...kettle.getState().values, filled: 0}); t.ok(!KT.surface.visible && !KT.pool.visible, 'a dry kettle draws no water surface');
kettle.update({...kettle.getState().values, filled: 1}); t.ok(KT.surface.visible && KT.pool.visible, 'a filled kettle draws its water surface');
for (const model of [heater, kettle, dryer]) model.dispose();

console.log(`PASS resistance elements: ${t.count} checks, ${counts.steps} steps integrated, ${counts.plans} runs planned, ${counts.solves} balances solved, ${counts.poses} poses, ${counts.points} drawn points traced, ${counts.numbers} quoted numbers traced, 3 lessons, ${released} resources released exactly once.`);

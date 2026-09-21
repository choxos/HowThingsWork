// Checks the fire extinguisher model and its lesson against their sources typed
// in again and their physics worked out by other routes: the carbon dioxide's
// pressure as a root of the van der Waals cubic in molar volume, the cartridge's
// liquid and vapor from the saturation table typed in again, the body's volume
// and the levels in it by slices, the discharge timed again by quadrature of the
// time each liter takes, the jet's energy against the gas's isothermal work, the
// gas's escape timed again by quadrature and weighed again by integrating its
// flow, the jet's path found again from its hodograph, and every drawn level,
// arrow, pin, lever, needle, path and curve read back at swept settings and
// times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './extinguisher-physics.js';
import * as M from './extinguisher-model.js';
import * as L from './extinguisher-lessons.js';
import {readFileSync} from 'node:fs';
import {houseComponents} from './house-components.js';
import {createSafetyModel} from './safety-models.js';
import {previewEntryIds} from './published-catalog.js';
import {safetyLessons} from './safety-lessons.js';

const t = tally();
const counts = {plans: 0, liters: 0, moles: 0, paths: 0, poses: 0, points: 0, numbers: 0, slices: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const relative = (value, share) => Math.abs(value) * share + 1e-15;
const simpson = (fn, a, b, n = 2000) => { const h = (b - a) / n; let sum = 0; for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * fn(a + i * h); return sum * h / 3; };
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const bisect = (fn, lo, hi, steps = 200) => { const rising = fn(hi) > fn(lo); for (let i = 0; i < steps; i++) { const mid = (lo + hi) / 2; if ((fn(mid) > 0) === rising) hi = mid; else lo = mid; } return (lo + hi) / 2; };

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  R: 8.31446261815324, atm: 101325, bar: 100000, g: 9.80665, zero: -273.15, kgf: 9.80665,
  co2: {molar: 44.009, a: 363.96, b: 0.04267, gamma: 1.3, critical: [31.03, 7.38]},
  air: {molar: 0.0289652, gamma: 1.4, density20: 1.2041, ratio: '0.528'},
  saturation: [
    [5.00, 3953, 0.1128, 0.8850], [6.11, 4067, 0.1169, 0.8784], [7.22, 4182, 0.1213, 0.8716], [8.33, 4300, 0.1258, 0.8645], [9.44, 4420, 0.1306, 0.8571],
    [10.56, 4544, 0.1355, 0.8496], [11.67, 4670, 0.1408, 0.8418], [12.78, 4798, 0.1463, 0.8338], [13.89, 4929, 0.1521, 0.8254], [15.00, 5063, 0.1583, 0.8168],
    [16.11, 5200, 0.1648, 0.8076], [17.22, 5340, 0.1717, 0.7977], [18.33, 5482, 0.1791, 0.7871], [19.44, 5628, 0.1869, 0.7759], [20.56, 5776, 0.1956, 0.7639],
    [21.67, 5928, 0.2054, 0.7508], [22.78, 6083, 0.2151, 0.7367], [23.89, 6240, 0.2263, 0.7216], [25.00, 6401, 0.2387, 0.7058], [26.11, 6565, 0.2532, 0.6894],
    [27.22, 6733, 0.2707, 0.6720], [28.33, 6902, 0.2923, 0.6507], [29.44, 7081, 0.3204, 0.6209], [30.00, 7164, 0.3378, 0.5992], [30.56, 7253, 0.3581, 0.5661],
    [31.1, 7391, 0.4641, 0.4641],
  ],
  water: [[5, 0.99996], [10, 0.9997026], [15, 0.9991026], [20, 0.9982071], [22, 0.9977735], [25, 0.9970479], [30, 0.9956502], [35, 0.99403], [40, 0.99221], [45, 0.99022], [50, 0.98804], [55, 0.98570], [60, 0.98321]],
  buck: [0.61121, 18.678, 234.5, 257.14],
  vapor: [[0, 0.6113], [5, 0.8726], [10, 1.2281], [15, 1.7056], [20, 2.3388], [25, 3.1690], [30, 4.2455], [35, 5.6267], [40, 7.3814], [45, 9.5898], [50, 12.3440], [55, 15.7520], [60, 19.9320]],
  solubility: [[5, 0.2774], [6, 0.2681], [7, 0.2589], [8, 0.2492], [9, 0.2403], [10, 0.2318], [11, 0.2239], [12, 0.2165], [13, 0.2098], [14, 0.2032], [15, 0.1970], [16, 0.1903], [17, 0.1845], [18, 0.1789], [19, 0.1737], [20, 0.1688], [21, 0.1640], [22, 0.1590], [23, 0.1540], [24, 0.1493], [25, 0.1449], [26, 0.1406], [27, 0.1366], [28, 0.1327], [29, 0.1292], [30, 0.1257], [35, 0.1105], [40, 0.0973], [45, 0.0860], [50, 0.0761], [60, 0.0576]],
  drag: 0.47, tft: 29.7, inch: 25.4, foot: 0.3048, psi: 6894.757, gallon: 3.785411784, torricelli: [0.65, 0.9],
  kanex: {model: 'KFWCRQ-9', liters: 9, rating: '3A', height: 585, diameter: 180, discharge: 35, throw: 6, share: 95, temperatures: [5, 60], service: 14, maxService: 16, test: 35, cartridge: 60, full: 14.8, empty: 5.8},
  is940: {liters: 9, tolerance: 0.5, diameter: 175, shell: 1.4, skirt: 25, neck: 63, hose: [8, 600], closed: 1.5, normal: [27, 5], cartridge: 60, stroke: 7, test: 3.0, burst: 4.5, throw: 6, throwFor: 60, share: 95, within: 120},
  is4947: {ratio: 0.667, at: 27, sizes: [20, 40, 60, 90, 120, 180, 200, 250, 300], test: 250, burst: 650, leak: 75, seal: 12},
  is15683: {operating: [5, 55], service: [27, 5], maxService: [55, 5], share: 95, retained: 5, height: 1, rangeAt: 50, wait: 6, gauge: [150, 250, 120], lowPressure: 19},
  ratedTime: 13, ratedRange: 2,
  amerex: {model: 240, gallons: 2.5, psi: 100, seconds: 55, range: [45, 55], liters: 9.5},
};

t.ok(P.GAS_CONSTANT === SRC.R && P.ATMOSPHERE === SRC.atm && P.BAR === SRC.bar && P.GRAVITY === SRC.g && P.ABSOLUTE_ZERO === SRC.zero && P.KILOGRAM_FORCE === SRC.kgf, 'the gas constant, the standard atmosphere, the bar, standard gravity, absolute zero and the kilogram-force');
assert.deepEqual(JSON.parse(JSON.stringify(P.CO2)), SRC.co2);
t.ok(P.AIR.molar === SRC.air.molar && P.AIR.gamma === SRC.air.gamma, 'dry air: 0.0289652 kg/mol and a heat capacity ratio of 1.400 at 20 °C');
assert.deepEqual(P.SATURATION.map(row => [...row]), SRC.saturation);
assert.deepEqual(P.WATER_DENSITY.map(row => [...row]), SRC.water);
assert.deepEqual([P.BUCK.scale, P.BUCK.a, P.BUCK.b, P.BUCK.c], SRC.buck);
assert.deepEqual(P.SOLUBILITY.map(row => [...row]), SRC.solubility);
t.ok(P.SPHERE_DRAG === SRC.drag && P.TFT.gpm === SRC.tft && Math.abs(P.UNITS.inch * 1000 - SRC.inch) < 1e-12 && P.UNITS.foot === SRC.foot && P.UNITS.psi === SRC.psi && P.UNITS.gallon === SRC.gallon && P.TORRICELLI.hole === SRC.torricelli[0] && P.TORRICELLI.hose === SRC.torricelli[1], 'a sphere’s drag coefficient, TFT’s 29.7, the inch, foot, psi and gallon, and Torricelli’s coefficients');
assert.deepEqual(JSON.parse(JSON.stringify(P.KANEX)), SRC.kanex);
assert.deepEqual(JSON.parse(JSON.stringify(P.IS940)), SRC.is940);
assert.deepEqual(JSON.parse(JSON.stringify(P.IS4947)), SRC.is4947);
assert.deepEqual(JSON.parse(JSON.stringify(P.IS15683)), SRC.is15683);
assert.deepEqual(JSON.parse(JSON.stringify(P.AMEREX)), SRC.amerex);
assert.deepEqual(JSON.parse(JSON.stringify(P.DECLARED)), {ends: 0.5, strainer: 10, cartridge: {radius: 18.5, wall: 1.5}, tftWater: 1000, fast: 5, dial: 25, step: 0.05, samples: 241, path: 49});
assert.deepEqual({...P.EXTINGUISHER_DEFAULTS}, {cartridge: 60, temperature: 27, water: 9, aim: 0});
assert.deepEqual(JSON.parse(JSON.stringify(P.EXTINGUISHER_DOMAINS)), {cartridge: [20, 60, 20], temperature: [5, 55, 1], water: [6, 9.5, 0.5], aim: [0, 45, 5]});
assert.deepEqual(P.CARTRIDGE_OPTIONS.map(option => [option.value, option.label]), [[20, '20 g'], [40, '40 g'], [60, '60 g']]);
t.ok(P.CARTRIDGE_OPTIONS.every(option => SRC.is4947.sizes.includes(option.value) && option.value <= SRC.is940.cartridge) && P.CARTRIDGE_OPTIONS.at(-1).value === SRC.is940.cartridge, 'cartridges are IS 4947’s sizes up to the 60 g IS 940 allows');
t.ok(P.EXTINGUISHER_DOMAINS.temperature[0] === SRC.is15683.operating[0] && P.EXTINGUISHER_DOMAINS.temperature[1] === SRC.is15683.operating[1] && P.EXTINGUISHER_DEFAULTS.temperature === SRC.is15683.service[0] && P.EXTINGUISHER_DEFAULTS.water === SRC.kanex.liters && P.EXTINGUISHER_DEFAULTS.cartridge === SRC.kanex.cartridge, 'the temperature spans IS 15683’s operating range, starting from Kanex’s extinguisher at 27 °C');
t.ok(P.EXTINGUISHER_DOMAINS.water[0] < SRC.is940.liters - SRC.is940.tolerance && P.EXTINGUISHER_DOMAINS.water[1] === SRC.is940.liters + SRC.is940.tolerance, 'the water reaches past IS 940’s 9.0 ± 0.5 L on the low side and to its top');

// Water's vapor pressure, its density, and air's density, against the tables and values the pages give.
for (const [celsius, kpa] of SRC.vapor) { t.near(P.vaporPressure(celsius) / 1000, kpa, 0.002 * kpa, `Buck’s equation against the page’s table at ${celsius} °C`); }
t.near(P.airDensity(20), SRC.air.density20, 5e-4, 'dry air at 20 °C and 1 atm, against the 1.2041 kg/m³ its page gives');
t.ok(f3((2 / (SRC.air.gamma + 1)) ** (SRC.air.gamma / (SRC.air.gamma - 1))) === SRC.air.ratio, 'the critical pressure ratio of 0.528 the choked flow page gives for air');
t.ok(P.kelvinOf(0) === 273.15 && P.kelvinOf(27) === 300.15, 'degrees above absolute zero');
const waterAt = celsius => { const i = Math.max(1, SRC.water.findIndex(row => row[0] >= celsius)), [x0, y0] = SRC.water[i - 1], [x1, y1] = SRC.water[i]; return 1000 * (y0 + (y1 - y0) * (celsius - x0) / (x1 - x0)); };
for (const celsius of [5, 7, 20, 27, 33, 55]) t.near(P.waterDensity(celsius), waterAt(celsius), 1e-9, `water’s density at ${celsius} °C between the table’s rows`);
const litersPerMinute = Math.PI / 4 * (SRC.inch / 1000) ** 2 * Math.sqrt(2 * SRC.psi / 1000) * 60000;
t.near(P.DISCHARGE, SRC.tft * SRC.gallon / litersPerMinute, 1e-12, 'TFT’s 29.7 gallons a minute against Bernoulli’s flow through an inch opening at a psi');
t.ok(f3(P.DISCHARGE) === '0.996' && P.DISCHARGE > SRC.torricelli[1] && P.DISCHARGE < 1, 'a discharge coefficient of 0.996, over the 0.9 Torricelli’s law page gives through a hose');

// The van der Waals pressure, as a root of its cubic in molar volume.
const A_SI = SRC.co2.a * 1e-3, B_SI = SRC.co2.b * 1e-3, MOLAR = SRC.co2.molar / 1000;
const vdw = (molar, kelvin) => SRC.R * kelvin / (molar - B_SI) - A_SI / (molar * molar);
for (const [grams, liters, celsius] of [[44.009, 1, 0], [60, 2.28, 27], [20, 11.2, 5], [60, 1.78, 55], [18.3, 11.23, 27]]) {
  const moles = grams / SRC.co2.molar, volume = liters / 1000, kelvin = celsius - SRC.zero, molar = volume / moles, pressure = P.co2Pressure(moles, volume, celsius);
  t.near(pressure, vdw(molar, kelvin), relative(pressure, 1e-12), `${grams} g in ${liters} L at ${celsius} °C: the van der Waals pressure by the mole`);
  t.near((pressure * molar ** 3 - (pressure * B_SI + SRC.R * kelvin) * molar ** 2 + A_SI * molar - A_SI * B_SI) / (pressure * molar ** 3), 0, 1e-9, 'its molar volume a root of the van der Waals cubic');
  t.near(P.idealPressure(moles, volume, celsius), moles * SRC.R * kelvin / volume, relative(pressure, 1e-12), 'and the ideal gas for comparison');
}

// The cartridge: its volume from the filling ratio, its phases from the table.
const tableAt = (celsius, column) => { const i = Math.max(1, SRC.saturation.findIndex(row => row[0] >= celsius)), [a, b] = [SRC.saturation[i - 1], SRC.saturation[i]]; return a[column] + (b[column] - a[column]) * (celsius - a[0]) / (b[0] - a[0]); };
const fillDensity = SRC.is4947.ratio * waterAt(SRC.is4947.at);
const fullAt = bisect(celsius => 1000 * tableAt(celsius, 3) - fillDensity, 5.01, 30.9);
t.near(P.FULL_AT, fullAt, 1e-9, 'the temperature at which the table’s liquid is only as dense as the fill');
t.ok(f1(P.FULL_AT) === '27.6' && P.FULL_AT < SRC.co2.critical[0], 'liquid fills a cartridge from 27.6 °C, below the critical point');
const capsuleSlices = (radius, straight, height) => {
  const cuts = [0, radius, radius + straight, 2 * radius + straight].map(y => Math.min(y, height));
  const area = y => Math.PI * (y < radius ? radius ** 2 - (radius - y) ** 2 : y <= radius + straight ? radius ** 2 : radius ** 2 - (y - radius - straight) ** 2);
  let sum = 0;
  for (let k = 0; k < 3; k++) if (cuts[k + 1] > cuts[k]) { sum += simpson(area, cuts[k], cuts[k + 1], 20); counts.slices++; }
  return sum;
};
for (const grams of [20, 40, 60]) {
  const shape = P.cartridgeShape(grams), volume = grams / SRC.is4947.ratio / (waterAt(SRC.is4947.at) / 1000) * 1e-6;
  t.near(P.cartridgeVolume(grams), volume, relative(volume, 1e-12), `${grams} g at IS 4947’s filling ratio of 0.667`);
  t.near(capsuleSlices(shape.radius, shape.straight, shape.length), volume, relative(volume, 1e-9), 'a round ended tube of that volume, by slices');
  t.ok(shape.radius === P.DECLARED.cartridge.radius / 1000 && shape.straight > 0, 'every size the same across, as long as it needs');
  for (const celsius of [5, 12, 20, 27, 28, 40, 55]) {
    const cartridge = P.cartridgeOf(grams, celsius);
    t.near(cartridge.fill, fillDensity, 1e-9, 'every size filled to the same density');
    if (celsius < fullAt) {
      const liquid = 1000 * tableAt(celsius, 3), vapor = 1000 * tableAt(celsius, 2);
      t.near(cartridge.share * liquid + (1 - cartridge.share) * vapor, fillDensity, 1e-9, `${grams} g at ${celsius} °C: its liquid and its vapor weigh what it holds`);
      t.near(cartridge.pressure, 1000 * tableAt(celsius, 1), 1e-6, 'under the table’s vapor pressure');
      t.near(capsuleSlices(shape.radius, shape.straight, cartridge.level), cartridge.share * volume, relative(volume, 1e-9), 'its liquid level holds its share, by slices');
      t.ok(cartridge.liquidMass > cartridge.share && cartridge.liquidMass <= 1, 'more of its mass is liquid than of its room');
    } else t.ok(cartridge.full && cartridge.pressure === null && cartridge.share === 1 && cartridge.level === shape.length, `${grams} g at ${celsius} °C: liquid fills it`);
  }
}
t.ok(P.saturatedVapor(5) === 1000 * SRC.saturation[0][2] && P.saturatedVapor(SRC.co2.critical[0]) === null, 'the densest the vapor can be, and nothing above the critical point');

// The body: its volume and the levels in it, by slices.
const RADIUS = SRC.is940.diameter / 2000 - SRC.is940.shell / 1000, HEAD = RADIUS / 2;
t.near(P.BODY.radius, RADIUS, 1e-15, 'IS 940’s 175 mm body, less its 1.4 mm shell');
t.near(P.BODY.head, HEAD, 1e-15, 'with 2:1 ellipsoidal ends');
t.near(P.BODY.height, 2 * HEAD + P.BODY.straight, 1e-15, 'as tall inside as its ends and its straight part');
const bodySlices = height => {
  const cuts = [0, HEAD, HEAD + P.BODY.straight, P.BODY.height].map(y => Math.min(y, height));
  const area = y => Math.PI * (y < HEAD ? RADIUS ** 2 * (1 - ((HEAD - y) / HEAD) ** 2) : y <= HEAD + P.BODY.straight ? RADIUS ** 2 : RADIUS ** 2 * (1 - ((y - HEAD - P.BODY.straight) / HEAD) ** 2));
  let sum = 0;
  for (let k = 0; k < 3; k++) if (cuts[k + 1] > cuts[k]) { sum += simpson(area, cuts[k], cuts[k + 1], 20); counts.slices++; }
  return sum;
};
t.near(bodySlices(P.BODY.height), P.BODY.volume, relative(P.BODY.volume, 1e-9), 'the body’s volume by slices');
for (const height of [0.005, 0.01, 0.04, 0.2, 0.4, 0.46, 0.5]) t.near(P.volumeBelow(height), bodySlices(height), relative(P.BODY.volume, 1e-9), `what lies below ${height * 1000} mm, by slices`);
for (const liters of [0.05, 1, 6, 9, 9.5, 11]) t.near(bodySlices(P.levelOf(liters / 1000)), liters / 1000, relative(liters / 1000, 1e-9), `${liters} L stands where the model puts it`);
t.near(P.RESIDUAL, bodySlices(P.DECLARED.strainer / 1000), relative(P.RESIDUAL, 1e-9), 'the water below the strainer');
t.ok(P.RESIDUAL / (P.EXTINGUISHER_DOMAINS.water[0] / 1000) < SRC.is15683.retained / 100, 'less left behind than the 5% IS 15683 lets a trial keep');
t.ok(P.BODY.height * 1000 < SRC.kanex.height && P.BODY.volume * 1000 > SRC.kanex.liters, 'shorter inside than Kanex’s 585 mm, and roomier than its 9 L');
t.ok(SRC.is940.diameter / 360 + 0.7 < SRC.is940.shell && SRC.is940.diameter / 600 + 0.3 < SRC.is940.shell, 'the 1.4 mm shell is thicker than IS 940’s formulas ask for');

// The service pressure: Dalton's law over the space, worked out again.
const gaugeOf = (grams, celsius, liters) => {
  const kelvin = celsius - SRC.zero, vapor = P.vaporPressure(celsius), space = P.BODY.volume - liters / 1000, gas = space + P.cartridgeVolume(grams), moles = grams / SRC.co2.molar;
  return (SRC.atm - vapor) * space / gas + vapor + vdw(gas / moles, kelvin) - SRC.atm;
};
t.near(P.serviceGauge(SRC.kanex.cartridge, SRC.is15683.service[0], SRC.kanex.liters), SRC.kanex.service * SRC.bar, 1e-3, 'a 60 g cartridge over 9 L at 27 °C gives Kanex’s 14 bar, which sets the body’s volume');
for (const [grams, celsius, liters] of [[60, 27, 9], [20, 27, 9], [60, 55, 9], [60, 27, 9.5], [40, 5, 6]]) t.near(P.serviceGauge(grams, celsius, liters), gaugeOf(grams, celsius, liters), 1, `${grams} g at ${celsius} °C over ${liters} L: air, vapor and carbon dioxide added by Dalton’s law`);
t.ok(f1(gaugeOf(60, SRC.is15683.maxService[0], 9) / SRC.bar) === '15.4' && gaugeOf(60, SRC.is15683.maxService[0], 9) < SRC.kanex.maxService * SRC.bar, '15.4 bar at 55 °C, under Kanex’s 16 bar maximum service pressure');
for (const celsius of [22, 27, 32]) t.ok(gaugeOf(60, celsius, 9) < SRC.is940.closed * 1e6, `under IS 940’s 1.5 MN/m² with the nozzle closed at ${celsius} °C`);
t.ok(gaugeOf(60, 27, 9.5) > SRC.is940.closed * 1e6, 'overfilled to 9.5 L it passes that limit');

// The water leaving, timed again by quadrature, and its energy against the gas's work.
const waterSettings = [{}, {cartridge: 20}, {cartridge: 40}, {temperature: 5}, {temperature: 55}, {water: 9.5}, {water: 6}, {cartridge: 20, temperature: 5, water: 9.5}];
for (const values of waterSettings) {
  const plan = P.extinguisherPlan(values), all = plan.values, kelvin = all.temperature - SRC.zero, density = waterAt(all.temperature), vapor = P.vaporPressure(all.temperature);
  const water0 = all.water / 1000, space = P.BODY.volume - water0, cartridge = P.cartridgeVolume(all.cartridge), moles = all.cartridge / SRC.co2.molar;
  const air = (SRC.atm - vapor) * space / (SRC.R * kelvin), gasOf = left => P.BODY.volume - left + cartridge;
  const gaugeAt = left => air * SRC.R * kelvin / gasOf(left) + vapor + vdw(gasOf(left) / moles, kelvin) - SRC.atm;
  const flowAt = left => P.DISCHARGE * P.NOZZLE.area * Math.sqrt(2 * gaugeAt(left) / density);
  const timeTo = left => simpson(remaining => 1 / flowAt(remaining), left, water0, 2000);
  t.near(plan.service, gaugeAt(water0), relative(plan.service, 1e-9), `${JSON.stringify(values)}: the pressure the pierced cartridge gives`);
  t.near(plan.effective, timeTo(water0 * (1 - SRC.is15683.share / 100)), 1e-5, '95% of the water out, by quadrature of the time each liter takes');
  t.near(plan.outAt - plan.open, timeTo(P.RESIDUAL), 1e-5, 'the water down to the strainer, by quadrature');
  t.near(plan.speed, Math.sqrt(2 * plan.service / density), relative(plan.speed, 1e-12), 'Bernoulli’s speed at the opening');
  t.near(plan.flow, P.DISCHARGE * P.NOZZLE.area * plan.speed, relative(plan.flow, 1e-12), 'and the flow it carries');
  for (let k = 1; k < 16; k++) {
    const time = plan.open + (plan.outAt - plan.open) * k / 16, now = P.extinguisherAt(plan, time);
    t.near(timeTo(now.left), time - plan.open, 1e-5, 'the water left at a time, by quadrature');
    t.near(now.gauge, gaugeAt(now.left), relative(now.gauge, 1e-9), 'the gauge at a time');
    t.ok(now.stage === 'water' && Math.abs(now.co2Moles - moles) < 1e-12 && Math.abs(now.airMoles - air) < 1e-12, 'the gas keeps every mole while the water leaves');
    counts.liters++;
  }
  const first = gasOf(water0), last = gasOf(P.RESIDUAL);
  const work = moles * SRC.R * kelvin * Math.log((last - moles * B_SI) / (first - moles * B_SI)) + A_SI * moles ** 2 * (1 / last - 1 / first) + air * SRC.R * kelvin * Math.log(last / first) + vapor * (last - first);
  const energy = simpson(time => { const now = P.extinguisherAt(plan, time); return now.gauge * now.flow; }, plan.open, plan.outAt - 1e-6, 200);
  t.near(energy, work - SRC.atm * (last - first), relative(energy, 1e-4), 'the jet’s energy is the gas’s isothermal work less the work against the air outside');
}
t.ok(f1(P.extinguisherPlan({}).effective) === f1(SRC.kanex.discharge) && f2(P.NOZZLE.bore * 1000) === '3.22' && Math.abs(P.NOZZLE.area - Math.PI / 4 * P.NOZZLE.bore ** 2) < 1e-18, 'the opening of 3.22 mm set so 95% leaves in Kanex’s 35 s');

// The gas leaving: timed again by quadrature in the moles left, and weighed again by integrating its flow.
for (const values of waterSettings) {
  const plan = P.extinguisherPlan(values), all = plan.values, kelvin = all.temperature - SRC.zero, vapor = P.vaporPressure(all.temperature);
  const space = P.BODY.volume - all.water / 1000, cartridge = P.cartridgeVolume(all.cartridge), moles = all.cartridge / SRC.co2.molar;
  const air = (SRC.atm - vapor) * space / (SRC.R * kelvin), volume = P.BODY.volume - P.RESIDUAL + cartridge, total = moles + air, share = moles / total;
  const cp = gamma => gamma / (gamma - 1), mixed = share * cp(SRC.co2.gamma) + (1 - share) * cp(SRC.air.gamma);
  const gamma = mixed / (share * (cp(SRC.co2.gamma) - 1) + (1 - share) * (cp(SRC.air.gamma) - 1));
  const molarMass = share * MOLAR + (1 - share) * SRC.air.molar, critical = (2 / (gamma + 1)) ** (gamma / (gamma - 1));
  const pressureOf = n => (1 - share) * n * SRC.R * kelvin / volume + vapor + vdw(volume / (share * n), kelvin);
  const flowOf = n => {
    const upstream = pressureOf(n);
    if (upstream <= SRC.atm) return 0;
    const density = upstream * molarMass / (SRC.R * kelvin), ratio = SRC.atm / upstream, area = P.DISCHARGE * P.NOZZLE.area;
    return ratio <= critical
      ? area * Math.sqrt(gamma * density * upstream * (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1)))
      : area * Math.sqrt(2 * density * upstream * gamma / (gamma - 1) * (ratio ** (2 / gamma) - ratio ** ((gamma + 1) / gamma)));
  };
  const ending = bisect(n => pressureOf(n) - SRC.atm, 1e-6, total);
  const timeFrom = n => { const top = Math.sqrt(Math.max(0, n - ending)); return top === 0 ? 0 : simpson(s => { const step = Math.max(s, 1e-4 * top); return 2 * step * molarMass / flowOf(ending + step * step); }, 0, top, 4000); };
  t.near(plan.run.gamma, gamma, 1e-12, `${JSON.stringify(values)}: the mixture’s heat capacity ratio, its heats mixed by moles`);
  t.near(plan.run.critical, critical, 1e-12, 'and its critical pressure ratio');
  t.near(plan.run.molar, molarMass, 1e-15, 'and its molar mass');
  t.near(plan.run.remaining, ending, relative(ending, 1e-9), 'the moles left when the gauge reads zero');
  t.near(plan.gasTime, timeFrom(total), 2e-3, 'the gas away, by quadrature in the moles left');
  t.near(plan.vented, (total - ending) * molarMass, relative(plan.vented, 1e-9), 'the gas that left, weighed');
  const flowed = simpson(time => P.extinguisherAt(plan, time).gasFlow, plan.outAt, plan.outAt + plan.gasTime - 1e-6, 400);
  t.near(flowed, plan.vented, relative(plan.vented, 2e-3), 'and weighed again by integrating its flow in time');
  for (let k = 1; k < 8; k++) {
    const time = plan.outAt + plan.gasTime * k / 8, now = P.extinguisherAt(plan, time);
    t.near(timeFrom(now.moles), plan.gasTime - (time - plan.outAt), 2e-3, 'the moles left at a time in the gas phase');
    t.ok(now.stage === 'gas' && Math.abs(now.co2Moles / now.moles - share) < 1e-12, 'the mixture keeps its share');
    counts.moles++;
  }
  const choke = plan.outGauge + SRC.atm > SRC.atm / critical ? timeFrom(total) - timeFrom(bisect(n => pressureOf(n) - SRC.atm / critical, ending, total)) : 0;
  t.near(plan.chokedFor, choke, 3e-3, 'how long it leaves choked');
  const atCritical = SRC.atm / critical, both = [gamma * (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1)), 2 * gamma / (gamma - 1) * (critical ** (2 / gamma) - critical ** ((gamma + 1) / gamma))];
  t.near(both[0], both[1], relative(both[0], 1e-12), 'the choked and the unchoked flow agree at the critical ratio');
  t.ok(atCritical > SRC.atm && P.extinguisherAt(plan, plan.duration).gauge === 0, 'and the gauge reads zero at the end');
}

// Carbon dioxide in the water, by Henry's law.
{
  const plan = P.extinguisherPlan({}), grams = SRC.solubility.find(row => row[0] === 27)[1] * plan.partials.co2 / SRC.atm * plan.liters * 10;
  t.near(plan.dissolvable, grams, relative(grams, 1e-12), 'what 9 L of water could take up at the service pressure');
  t.ok(f0(grams) === '170' && f1(plan.partials.co2 / SRC.atm) === '13.9' && grams / SRC.kanex.cartridge > 2.5 && grams / SRC.kanex.cartridge < 3, 'nearly three times the whole charge, at 13.9 atmospheres');
}

// The jet: its path found again from its hodograph.
function hodograph(speed, aim, drop, celsius) {
  const length = 4 / 3 * waterAt(celsius) / (SRC.atm * SRC.air.molar / (SRC.R * (celsius - SRC.zero))) * drop / SRC.drag;
  const theta = aim * Math.PI / 180, F = psi => 0.5 * (Math.tan(psi) / Math.cos(psi) + Math.log(1 / Math.cos(psi) + Math.tan(psi)));
  const square = psi => 1 / (1 / (speed * Math.cos(theta)) ** 2 + 2 / (SRC.g * length) * (F(theta) - F(psi)));
  const forTime = psi => Math.sqrt(square(psi)) / (SRC.g * Math.cos(psi) ** 2), forX = psi => square(psi) / (SRC.g * Math.cos(psi) ** 2), forY = psi => square(psi) * Math.tan(psi) / (SRC.g * Math.cos(psi) ** 2);
  const steps = 40000, bottom = -Math.PI / 2 + 1e-3, h = (theta - bottom) / steps, rows = [[theta, 0, 0, SRC.is15683.height]];
  let time = 0, x = 0, y = SRC.is15683.height;
  for (let k = 0; k < steps && y > 0; k++) {
    const a = theta - k * h, b = a - h, mid = a - h / 2;
    time += h / 6 * (forTime(a) + 4 * forTime(mid) + forTime(b));
    x += h / 6 * (forX(a) + 4 * forX(mid) + forX(b));
    y += h / 6 * (forY(a) + 4 * forY(mid) + forY(b));
    rows.push([b, time, x, y]);
  }
  const [above, below] = rows.slice(-2), share = above[3] / (above[3] - below[3]);
  const between = (from, to, at) => from + (to - from) * at;
  const at = when => { let i = rows.findIndex(row => row[1] >= when); if (i <= 0) i = 1; const back = rows[i - 1], next = rows[i], on = (when - back[1]) / (next[1] - back[1]); return [between(back[2], next[2], on), between(back[3], next[3], on)]; };
  counts.paths++;
  return {length, reach: between(above[2], below[2], share), flight: between(above[1], below[1], share), peak: aim > 0 ? rows.find(row => row[0] <= 0)[3] : SRC.is15683.height, at};
}
t.near(P.dragLength(P.DROP, 27), hodograph(50, 0, P.DROP, 27).length, 1e-12, 'a drop’s drag length');
{
  const plan = P.extinguisherPlan({}), found = hodograph(plan.halfSpeed, 0, P.DROP, plan.celsius);
  t.near(found.reach, SRC.kanex.throw, 1e-5, 'the drops’ size set so the level jet at half the effective time lands Kanex’s 6 m away');
  t.near(plan.range, found.reach, 1e-5, 'and the model’s range agrees');
  t.ok(f2(P.DROP * 1000) === '1.49', 'drops of 1.49 mm');
}
for (const [values, aim, speedOf] of [[{}, 0, plan => plan.speed], [{}, 30, plan => plan.speed], [{}, 45, plan => plan.speed], [{cartridge: 20}, 0, plan => plan.halfSpeed], [{temperature: 55, water: 9.5}, 20, plan => plan.speed], [{water: 6}, 15, plan => plan.halfSpeed]]) {
  const plan = P.extinguisherPlan({...values, aim}), speed = speedOf(plan), path = P.jetPath(speed, aim, plan.celsius, P.DROP), found = hodograph(speed, aim, P.DROP, plan.celsius);
  t.near(path.reach, found.reach, 2e-4, `a jet of ${f1(speed)} m/s aimed ${aim}°: where it lands, by its hodograph`);
  t.near(path.flight, found.flight, 2e-4, 'how long it flies');
  t.ok(path.path.length === P.DECLARED.path && Math.abs(path.path[0][0]) < 1e-12 && Math.abs(path.path[0][1] - SRC.is15683.height) < 1e-12 && Math.abs(path.path.at(-1)[1]) < 1e-12, 'drawn from the nozzle 1 m up to the floor');
  path.path.forEach(([x, y], j) => {
    if (j === 0 || j === path.path.length - 1) return;
    const [hx, hy] = found.at(path.flight * j / (P.DECLARED.path - 1));
    t.ok(Math.abs(x - hx) < 3e-4 && Math.abs(y - hy) < 3e-4, 'every point along the way where the hodograph puts it');
    counts.points++;
  });
  if (aim > 0) t.near(Math.max(...path.path.map(point => point[1])), found.peak, 0.02, 'as high as it climbs');
  t.near(P.vacuumReach(speed, 0), speed * Math.sqrt(2 * SRC.is15683.height / SRC.g), relative(speed, 1e-12), 'and with no air it would fly level until it fell 1 m');
}

// Every setting in the domain: a run that finishes, inside what the standards ask.
for (const cartridge of [20, 40, 60]) for (let temperature = 5; temperature <= 55; temperature++) for (let water = 6; water <= 9.5 + 1e-9; water += 0.5) {
  const plan = P.extinguisherPlan({cartridge, temperature, water});
  counts.plans++;
  t.ok(!plan.stalled && plan.effective !== null && plan.effective > SRC.ratedTime && plan.effective < SRC.is940.within && plan.range > SRC.ratedRange && plan.retained < SRC.is15683.retained / 100
    && plan.duration < M.CHART.ticks * M.CHART.tickEvery && plan.service / SRC.bar < P.DECLARED.dial && plan.outGauge > 0 && Number.isFinite(plan.gasTime) && plan.chokedFor !== null
    && plan.chart.every(sample => Number.isFinite(sample.gauge) && Number.isFinite(sample.share) && sample.gauge >= 0 && sample.share > 0),
    `${cartridge} g, ${temperature} °C, ${water} L: 95% out between IS 15683’s 13 s and IS 940’s 120 s, a range past 2 m, less kept than 5%, and a gauge that reaches zero`);
  if (temperature % 25 === 5) t.ok(plan.co2Density < (P.saturatedVapor(temperature) ?? Infinity), 'the gas in the space is thinner than its saturated vapor, so none of it is liquid');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createFireExtinguisherModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const rectOf = mesh => ({x0: mesh.position.x - mesh.scale.x / 2, x1: mesh.position.x + mesh.scale.x / 2, y0: mesh.position.y - mesh.scale.y / 2, y1: mesh.position.y + mesh.scale.y / 2});
const stripRows = mesh => {
  const array = mesh.geometry.attributes.position.array, rows = [];
  for (let i = 0; i < array.length / 6; i++) {
    const row = [array[6 * i], array[6 * i + 1], array[6 * i + 3], array[6 * i + 4]];
    if (!rows.length || row.some((value, k) => value !== rows.at(-1)[k])) rows.push(row);
  }
  return rows;
};
// What a part covers in the system's own frame, counting only what is drawn.
const boxOf = (object, toSystem) => {
  const box = new THREE.Box3(), local = new THREE.Box3();
  object.traverse(child => {
    for (let node = child; node; node = node.parent) if (!node.visible) return;
    if (!child.geometry) return;
    child.geometry.computeBoundingBox();
    box.union(local.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld).applyMatrix4(toSystem));
  });
  return box;
};
const winding = mesh => {
  const array = mesh.geometry.attributes.position.array, index = mesh.geometry.index?.array;
  const count = index ? index.length : array.length / 3;
  let good = 0, bad = 0;
  for (let k = 0; k + 2 < count; k += 3) {
    const [i, j, l] = index ? [index[k], index[k + 1], index[k + 2]] : [k, k + 1, k + 2];
    const cross = (array[3 * j] - array[3 * i]) * (array[3 * l + 1] - array[3 * i + 1]) - (array[3 * j + 1] - array[3 * i + 1]) * (array[3 * l] - array[3 * i]);
    if (cross > 1e-12) good++; else if (cross < -1e-12) bad++;
  }
  return {good, bad};
};
const bodyRadiusAt = y => (y <= 0 || y >= P.BODY.height * 1000 ? 0 : 1000 * (y / 1000 < HEAD ? RADIUS * Math.sqrt(1 - ((HEAD - y / 1000) / HEAD) ** 2) : y / 1000 <= HEAD + P.BODY.straight ? RADIUS : RADIUS * Math.sqrt(1 - ((y / 1000 - HEAD - P.BODY.straight) / HEAD) ** 2)));
// A point drawn on the body's inside wall, mm: on one of its ellipsoidal ends, or out at the straight part's radius. Read back from a drawing kept as 32 bit numbers, so the ends are held to their ellipse rather than to a radius, which turns steeply there.
const onCapsule = (x, height, radius, straight) => {
  if (height <= radius) return Math.abs((x / radius) ** 2 + ((radius - height) / radius) ** 2 - 1) < 1e-5 || Math.abs(x) < 1e-3;
  if (height <= radius + straight) return Math.abs(Math.abs(x) - radius) < 1e-3;
  return Math.abs((x / radius) ** 2 + ((height - radius - straight) / radius) ** 2 - 1) < 1e-5 || Math.abs(x) < 1e-3;
};
const onProfile = (x, y) => {
  const a = RADIUS * 1000, c = HEAD * 1000, straight = P.BODY.straight * 1000;
  if (y <= c) return Math.abs((x / a) ** 2 + ((c - y) / c) ** 2 - 1) < 1e-5;
  if (y <= c + straight) return Math.abs(Math.abs(x) - a) < 1e-3;
  return Math.abs((x / a) ** 2 + ((y - c - straight) / c) ** 2 - 1) < 1e-5;
};

t.ok(T.bodyDraw.scale.x === M.BODY_MM && T.bodyDraw.scale.y === M.BODY_MM && T.siphonDraw.scale.x === M.BODY_MM && T.hoseDraw.scale.x === M.BODY_MM && T.cartDraw.scale.x === M.CAP_MM && T.gripDraw.scale.x === M.CAP_MM && T.valveDraw.scale.x === M.CAP_MM && T.jetDraw.scale.x === M.JET_M && T.jetDraw.scale.y === M.JET_M, 'one scale for each view');
t.ok(M.BODY_MM / M.TRUE_MM === 0.25 && M.CAP_MM === M.TRUE_MM && Math.abs(M.JET_M / 1000 / M.TRUE_MM - 0.01) < 1e-15 && M.sizeWords(M.BODY_MM) === 'a quarter of true size' && M.sizeWords(M.CAP_MM) === 'true size' && M.sizeWords(M.JET_M / 1000) === 'a hundredth of true size', 'the scales the text states');
t.ok(M.tipAt(false) - M.tipAt(true) === SRC.is940.stroke, 'the pin travels IS 940’s 7 mm stroke');
t.ok(Math.abs(M.CAP.shell[0] - (P.DECLARED.cartridge.radius + P.DECLARED.cartridge.wall)) < 1e-12 && M.CAP.neck[0] * 2 === 26.8, 'a cartridge drawn to its declared wall, its neck IS 4947’s thread across');
// The sizes the drawing declares for itself, typed in again and tied to what they stand for.
t.ok(M.SHELL.hose.width === 14 && M.SHELL.hose.width > SRC.is940.hose[0] && M.SHELL.hose.bend === 60 && M.SHELL.hose.turn === 40 && M.SHELL.hose.run === 40, 'a hose drawn 14 mm across, wider than IS 940’s 8 mm bore');
assert.deepEqual([...M.SHELL.arrows], [-60, 55]);
assert.deepEqual([...M.CAP.pivot], [-45, 66]);
t.ok(M.SHELL.perBar === 4 && M.SHELL.flow[1] === 200 && M.CAP.flow[1] === 60 && M.CAP.squeeze[0] === 25, 'the arrows’ scales as their part texts give them');
t.ok(M.CAP.lift === 4 && M.CAP.lift > M.CAP.bore / 2 && M.CAP.seat[1] + M.CAP.lift + M.CAP.disc[1] < M.CAP.valve[3], 'the disc lifts 4 mm, wide enough to open the way and still inside the valve');
t.ok(M.DIAL.start === 225 && M.DIAL.sweep === 270 && Math.abs(M.needleAngle(0) - 1.25 * Math.PI) < 1e-12 && Math.abs(M.needleAngle(P.DECLARED.dial) + Math.PI / 4) < 1e-12, 'a dial reading from the lower left round to the lower right');
t.ok(M.JETVIEW.floor[0] === -0.3 && M.JETVIEW.floor[1] === 12 && M.JETVIEW.nozzle[0] === 0.6 && M.JETVIEW.tick === 0.25, 'a floor 12 m long, its ticks a quarter meter tall, with a nozzle bar 0.6 m across');
{
  let farthest = 0;
  for (const cartridge of [20, 60]) for (const temperature of [5, 55]) for (const water of [6, 9.5]) for (let aim = P.EXTINGUISHER_DOMAINS.aim[0]; aim <= P.EXTINGUISHER_DOMAINS.aim[1]; aim += P.EXTINGUISHER_DOMAINS.aim[2]) farthest = Math.max(farthest, P.extinguisherPlan({cartridge, temperature, water, aim}).start.reach);
  t.ok(farthest < M.JETVIEW.floor[1] && farthest > M.JETVIEW.floor[1] - 2, `the floor reaches past the farthest jet the controls allow, ${f1(farthest)} m`);
}

{
  // What does not move: the shell, the inner wall, the hose, the strainer, the gauge's face and the chart's frame.
  const shell = winding(T.shell);
  t.ok(shell.bad === 0 && shell.good > 20, 'every triangle of the shell faces the viewer');
  const inner = pointsOf(T.innerWall);
  t.ok(inner.length > 30 && inner.every(([x, y]) => onProfile(x, y)) && Math.abs(inner[0][0] - inner.at(-1)[0]) < 1e-6, 'the inside wall drawn on the body’s own profile, closed');
  const centerline = M.hosePath(64), pairs = stripRows(T.hoseStrip);
  let length = 0;
  for (let i = 1; i < centerline.length; i++) length += Math.hypot(centerline[i][0] - centerline[i - 1][0], centerline[i][1] - centerline[i - 1][1]);
  t.near(length, SRC.is940.hose[1], 1, 'a hose as long as IS 940’s 600 mm');
  t.ok(pairs.length === 64 && pairs.every(([rx, ry, lx, ly], i) => Math.abs(Math.hypot(rx - lx, ry - ly) - M.SHELL.hose.width) < 1e-3 && Math.abs((rx + lx) / 2 - centerline[i][0]) < 1e-3 && Math.abs((ry + ly) / 2 - centerline[i][1]) < 1e-3), 'drawn 14 mm wide along that line');
  t.ok(pairs.every(([rx, ry, lx, ly]) => Math.min(ry, ly) > P.BODY.height * 1000 + SRC.is940.shell || Math.min(rx, lx) > 1000 * (RADIUS + SRC.is940.shell / 1000)), 'clear of the body all the way down');
  const hose = winding(T.hoseStrip);
  t.ok(hose.bad === 0 && hose.good > 100, 'and its triangles face the viewer');
  t.near(rectOf(T.strainer).y0, P.DECLARED.strainer, 1e-12, 'the strainer’s foot 10 mm above the bottom');
  const tube = rectOf(T.tube);
  t.ok(tube.x0 > M.SHELL.ring[0] * -1 && tube.x1 < M.SHELL.ring[0] && tube.x1 - tube.x0 === 2 * M.CAP.tube[1], 'the siphon tube passes through the neck ring');
  const ticks = pointsOf(T.dialTicks);
  t.ok(ticks.length === 2 * (P.DECLARED.dial / M.DIAL.minor + 1), 'a tick on the dial for every bar');
  for (let k = 0; k < ticks.length; k += 2) { const angle = M.needleAngle(k / 2 * M.DIAL.minor); t.ok(Math.abs(wrap(Math.atan2(ticks[k][1], ticks[k][0]) - angle)) < 1e-5 && Math.abs(Math.hypot(ticks[k + 1][0], ticks[k + 1][1]) - M.DIAL.ticks[1] * M.DIAL.radius) < 1e-6, 'each at its place around the dial'); counts.points++; }
  const limit = pointsOf(T.limitTick), limitAngle = M.needleAngle(SRC.is940.closed * 10);
  t.ok(limit.every(([x, y]) => Math.abs(wrap(Math.atan2(y, x) - limitAngle)) < 1e-5), 'the red tick at IS 940’s 15 bar');
  const floor = pointsOf(T.floorLine), meters = pointsOf(T.meterTicks);
  t.ok(Math.abs(floor[0][0] - M.JETVIEW.floor[0]) < 1e-6 && Math.abs(floor[1][0] - M.JETVIEW.floor[1]) < 1e-6 && meters.length === 2 * M.JETVIEW.floor[1] && meters.every(([x], i) => Math.abs(x - (Math.floor(i / 2) + 1)) < 1e-6), 'a floor with a tick at every meter');
  t.ok(Math.abs(pointsOf(T.post).at(-1)[1] - SRC.is15683.height) < 1e-6, 'the nozzle held 1 m above it');
  const limitLine = pointsOf(T.limitLine);
  t.ok(limitLine.every(([, y]) => Math.abs(y - M.chartY(SRC.is940.closed * 10 / P.DECLARED.dial)) < 1e-6), 'the chart’s red line at 15 bar');
}

const poses = [];
for (const values of [{}, {cartridge: 20, temperature: 5}, {temperature: 55, water: 9.5, aim: 45}, {cartridge: 40, water: 6, aim: 20}, {water: 8.5, temperature: 15, aim: 10}]) {
  const plan = P.extinguisherPlan(values);
  for (const time of [0, 3, plan.open + 0.01, (plan.open + plan.outAt) / 2, plan.outAt - 0.05, plan.outAt + plan.gasTime / 3, plan.duration, plan.duration + 5]) poses.push([values, time]);
}
for (const [values, time] of poses) {
  model.reset();
  model.update(values);
  model.advance(time / P.DECLARED.fast);
  model.root.updateMatrixWorld(true);
  // Read the drawing against the physics at the clock the model holds, and hold that clock to the time asked for.
  const plan = P.extinguisherPlan(values), state = model.getState(), clock = state.clock, now = P.extinguisherAt(plan, clock), stage = now.stage;
  const squeezing = stage === 'pierced' || stage === 'water' || stage === 'gas', flowing = stage === 'water', bar = now.gauge / SRC.bar;
  counts.poses++;
  t.near(clock, Math.min(time, plan.duration), 1e-9, 'the clock runs 5 times faster than the discharge');

  // The water and the space above it.
  const level = now.level * 1000, wet = stripRows(T.water), dry = stripRows(T.gas);
  t.ok(wet[0][1] === 0 && Math.abs(wet.at(-1)[1] - level) < 1e-3 && wet.every(([rx, ry, lx]) => onProfile(rx, ry) && onProfile(lx, ry) && rx >= 0 && Math.abs(rx + lx) < 1e-3), `${stage}: the water drawn from the bottom to its level, out to the wall`);
  t.ok(Math.abs(dry[0][1] - level) < 1e-3 && Math.abs(dry.at(-1)[1] - P.BODY.height * 1000) < 1e-3 && dry.every(([rx, ry, lx]) => onProfile(rx, ry) && rx >= 0 && Math.abs(rx + lx) < 1e-3), 'the space drawn from the level to the top');
  t.near(bodySlices(level / 1000), now.left, relative(now.left, 1e-5) + 1e-9, 'and the level holds the water the run has left');
  const tint = new THREE.Color(M.COLORS.air).lerp(new THREE.Color(M.COLORS.gas), Math.max(0, Math.min(1, bar / P.DECLARED.dial)));
  t.ok(Math.abs(T.gas.material.color.r - tint.r) < 1e-6 && Math.abs(T.gas.material.color.b - tint.b) < 1e-6, 'the space darkens with its pressure');
  const push = stage === 'pierced' || flowing ? bar * M.SHELL.perBar : 0;
  const room = Math.max(0, Math.min(bodyRadiusAt(level), bodyRadiusAt(level + push)) - 2.5 * M.SHELL.arrow - M.SHELL.clear);
  T.gasArrows.forEach((arrow, i) => {
    t.near(arrow.userData.length, push * M.BODY_MM, 1e-12, 'the gas presses on the water, 4 mm for each bar');
    t.ok(arrow.visible === push > 1e-6 && Math.abs(arrow.position.y - (level + push) * M.BODY_MM) < 1e-9 && Math.abs(arrow.position.x - Math.sign(M.SHELL.arrows[i]) * Math.min(Math.abs(M.SHELL.arrows[i]), room) * M.BODY_MM) < 1e-12, 'each arrow standing on the surface, drawn in from the wall where the body narrows');
    const pointing = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);
    t.ok(Math.abs(pointing.y + 1) < 1e-9, 'pointing down at it');
    t.ok(Math.abs(arrow.position.x) / M.BODY_MM + 2.5 * M.SHELL.arrow <= bodyRadiusAt(level) - M.SHELL.clear + 1e-9 && Math.abs(arrow.position.x) / M.BODY_MM + 2.5 * M.SHELL.arrow <= bodyRadiusAt(level + push) - M.SHELL.clear + 1e-9, 'clear of the wall');
  });

  // The siphon tube and the flow through it.
  t.ok(T.boreWater.visible === !(stage === 'gas' || stage === 'done'), 'water in the tube until the water is out');
  if (T.boreWater.visible) t.near(rectOf(T.boreWater).y1, stage === 'ready' ? level : P.BODY.height * 1000 + M.SHELL.neck[1] + M.CAP.valve[2], 1e-9, 'standing at the level before the squeeze, up to the valve after it');
  t.near(T.flowArrow.userData.length, flowing ? now.flow * 1000 * M.SHELL.flow[1] * M.BODY_MM : 0, 1e-12, 'the flow arrow grows with the flow, 200 mm for each liter a second');
  t.near(T.outletArrow.userData.length, flowing ? now.flow * 1000 * M.CAP.flow[1] * M.CAP_MM : 0, 1e-12, 'and so does the one at the outlet, 60 mm for each liter a second');

  // The grip: the pin, the spring, the lever and the hand's arrow.
  const tip = M.tipAt(squeezing), rod = rectOf(T.rod);
  t.ok(Math.abs(T.cone.position.y - tip) < 1e-12 && Math.abs(rod.y0 - (tip + M.CAP.rod[1])) < 1e-12 && Math.abs(rod.y1 - (tip + M.CAP.rod[2])) < 1e-12, 'the pin and its rod where the squeeze leaves them');
  t.ok(squeezing ? tip < -IS4947seal() - M.CAP.seal : tip > -IS4947seal() + 3, 'through the seal while squeezed, well clear of it before');
  const spring = pointsOf(T.spring);
  t.ok(Math.abs(spring[0][1] - M.CAP.holder[3]) < 1e-4 && Math.abs(spring.at(-1)[1] - (tip + M.CAP.collar[1])) < 1e-4 && spring.every(([x]) => Math.abs(x) <= M.CAP.spring[0] + 1e-4), 'the spring between the holder and the collar');
  const angle = T.lever.rotation.z, cx = T.lever.position.x, cy = T.lever.position.y;
  const underside = at => cy + (at - cx) * Math.tan(angle) - T.lever.scale.y / 2 / Math.cos(angle);
  t.near(underside(0), tip + M.CAP.rod[2], 1e-6, 'the lever resting on the rod’s top');
  t.ok(Math.abs((M.CAP.pivot[1] - cy) - (M.CAP.pivot[0] - cx) * Math.tan(angle)) < 1e-9, 'turning about its pivot');
  t.ok(underside(M.CAP.guide[1]) > M.CAP.guide[3] + 1 && underside(M.CAP.valve[0]) > M.CAP.valve[3] + 1 && underside(M.CAP.valve[1]) > M.CAP.valve[3] + 1, 'clear of the plunger’s guide and the valve below it');
  t.ok(T.squeezeArrow.visible === squeezing, 'the hand’s arrow while the grip is held');
  if (squeezing) {
    const at = M.CAP.lever - 2 * M.CAP.squeeze[1];
    t.near(T.squeezeArrow.position.y - T.squeezeArrow.userData.length, (M.CAP.pivot[1] + at * Math.sin(angle) + M.CAP.thickness / 2 / Math.cos(angle) + M.CAP.squeeze[1]) * M.CAP_MM, 1e-9, 'its point just above the lever');
    t.ok(Math.abs(new THREE.Vector3(0, 1, 0).applyQuaternion(T.squeezeArrow.quaternion).y + 1) < 1e-9, 'pressing down');
  }
  t.ok(Math.abs(T.bodyLever.rotation.z - angle) < 1e-12 && Math.abs(T.bodyLever.position.x - (M.SHELL.neck[0] + cx)) < 1e-9 && Math.abs(T.bodyLever.position.y - (P.BODY.height * 1000 + M.SHELL.neck[1] + cy)) < 1e-9, 'the same lever on the body, a quarter of the size');

  // The cartridge.
  const shown = T.closeCartridges.find(item => item.group.visible);
  t.ok(shown && shown.grams === plan.grams && T.closeCartridges.filter(item => item.group.visible).length === 1 && T.bodyCartridges.filter(group => group.visible).length === 1 && T.bodyCartridges.find(group => group.visible).userData.grams === plan.grams, 'the cartridge chosen, drawn twice and once only');
  const liquid = stripRows(T.liquid);
  if (stage === 'ready') {
    t.ok(T.liquid.visible && Math.abs(liquid[0][1] - shown.bottom) < 1e-4 && Math.abs(liquid.at(-1)[1] - (shown.bottom + plan.cartridge.level * 1000)) < 1e-4, 'liquid drawn to its level in the cartridge');
    t.ok(liquid.every(([rx, ry, lx]) => { const height = ry - shown.bottom; return onCapsule(rx, height, P.DECLARED.cartridge.radius, shown.straight) && rx >= 0 && Math.abs(rx + lx) < 1e-4; }), 'out to the cartridge’s wall');
    t.ok(T.seal.visible && !T.sealHalves[0].visible, 'its seal whole');
  } else t.ok(!T.liquid.visible && !T.seal.visible && T.sealHalves.every(half => half.visible), 'pierced: no liquid left and a hole in the seal');
  t.ok(Math.abs(shown.inner.material.color.getHex() - (stage === 'ready' ? new THREE.Color(M.COLORS.vapor) : tint).getHex()) < 2, 'the cartridge holding vapor before, the space’s gas after');

  // The valve.
  const lift = clock >= plan.open ? M.CAP.lift : 0, disc = rectOf(T.disc), stem = rectOf(T.stem);
  t.ok(Math.abs(disc.y0 - (M.CAP.seat[1] + lift)) < 1e-12 && Math.abs(stem.y0 - disc.y1) < 1e-12 && Math.abs(stem.y1 - M.CAP.valve[3]) < 1e-12, 'the disc off its seat once the valve opens, its stem reaching the top');
  t.ok(disc.x0 < M.CAP.tube[0] - M.CAP.bore && disc.x1 > M.CAP.tube[0] + M.CAP.bore, 'and wide enough to close the way');

  // The gauge.
  t.near(T.needle.rotation.z, M.needleAngle(bar), 1e-12, 'the needle at the gauge pressure');
  t.near(Math.hypot(T.needle.position.x, T.needle.position.y), M.DIAL.needle * M.DIAL.radius / 2, 1e-12, 'drawn from the middle of the dial');
  t.ok(M.DIAL.needle * M.DIAL.radius < M.DIAL.radius && bar <= P.DECLARED.dial, 'inside the dial, which reads past every pressure the model reaches');

  // The jet.
  const drawn = pointsOf(T.nowLine), guide = pointsOf(T.startLine);
  t.ok(guide.length === P.DECLARED.path && guide.every(([x, y], j) => Math.abs(x - plan.start.path[j][0]) < 1e-5 && Math.abs(y - plan.start.path[j][1]) < 1e-5), 'the jet as the valve opened, drawn faintly');
  if (flowing) {
    t.ok(drawn.length === P.DECLARED.path && drawn.every(([x, y], j) => Math.abs(x - now.path.path[j][0]) < 1e-5 && Math.abs(y - now.path.path[j][1]) < 1e-5), 'the jet now');
    t.near(pointsOf(T.landingTick)[0][0], now.reach, 1e-5, 'a tick where it lands');
  } else t.ok(!T.nowLine.visible && !T.landingTick.visible, 'no jet drawn when none flows');
  t.near(pointsOf(T.rangeTick)[0][0], plan.range, 1e-5, 'the gold tick at IS 15683’s range');
  t.near(T.nozzleBar.rotation.z, plan.aim * Math.PI / 180, 1e-12, 'the nozzle bar aimed where the control points it');
  t.ok(Math.abs(T.nozzleBar.position.x + Math.cos(plan.aim * Math.PI / 180) * M.JETVIEW.nozzle[0] / 2) < 1e-12 && Math.abs(T.nozzleBar.position.y - (SRC.is15683.height - Math.sin(plan.aim * Math.PI / 180) * M.JETVIEW.nozzle[0] / 2)) < 1e-12, 'its mouth where the jet starts');

  // The chart.
  const gaugeGuide = pointsOf(T.gaugeGuide), shareGuide = pointsOf(T.shareGuide);
  t.ok(gaugeGuide.length === P.DECLARED.samples && shareGuide.length === P.DECLARED.samples, 'the whole run drawn faintly');
  for (let j = 0; j < P.DECLARED.samples; j += 24) {
    const sample = plan.chart[j], at = plan.duration * j / (P.DECLARED.samples - 1), point = P.extinguisherAt(plan, at);
    t.near(sample.t, at, 1e-12, 'chart samples evenly through the run');
    t.near(sample.gauge, point.gauge, relative(point.gauge, 1e-12) + 1e-9, 'each at the gauge then');
    t.near(sample.share, point.share, 1e-12, 'and the water left then');
    t.near(gaugeGuide[j][0], M.chartX(plan, at), 1e-6, 'across in time');
    t.near(gaugeGuide[j][1], M.chartY(sample.gauge / SRC.bar / P.DECLARED.dial), 1e-6, 'up in pressure');
    t.near(shareGuide[j][1], M.chartY(sample.share), 1e-6, 'and in water left');
    counts.points++;
  }
  const curve = pointsOf(T.gaugeCurve);
  if (clock > 0) {
    const passed = plan.chart.filter(sample => sample.t < now.t).length;
    t.ok(curve.length === passed + 1, 'the dark curve as far as the clock has run');
    t.near(curve.at(-1)[0], M.chartX(plan, now.t), 1e-6, 'ending now');
    t.near(curve.at(-1)[1], M.chartY(now.gauge / SRC.bar / P.DECLARED.dial), 1e-6, 'at the gauge now');
  } else t.ok(!T.gaugeCurve.visible && !T.shareCurve.visible, 'nothing drawn dark before the squeeze');
  t.near(rectOf(T.effectiveBar).x0, M.chartX(plan, plan.open), 1e-9, 'the gold bar starts when the valve opens');
  t.near(rectOf(T.effectiveBar).x1, M.chartX(plan, plan.effectiveAt), 1e-9, 'and ends at the effective discharge time');
  let ticks = 0;
  for (let k = 1; k * M.CHART.tickEvery < plan.duration - 1e-9; k++) ticks++;
  t.ok(pointsOf(T.chartTicks).length === 2 * ticks, `a tick every 5 s: ${ticks}`);
  const cursor = pointsOf(T.cursor);
  t.near((cursor[0][0] + cursor[1][0]) / 2, M.chartX(plan, now.t), 1e-6, 'the cursor at now');

  // Nothing drawn where something else is drawn.
  const toSystem = new THREE.Matrix4().copy(T.system.matrixWorld).invert();
  const boxes = [['body', ['body', 'siphon', 'hose']], ['close up', ['cartridge', 'grip', 'valve']], ['gauge', ['gauge']], ['jet', ['jet']], ['chart', ['chart']]].map(([label, ids]) => {
    const box = new THREE.Box3();
    for (const id of ids) box.union(boxOf(model.parts.find(item => item.id === id).object, toSystem));
    return [label, box];
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, first] = boxes[i], [b, second] = boxes[j];
    t.ok(first.max.x + 0.04 <= second.min.x || second.max.x + 0.04 <= first.min.x || first.max.y + 0.04 <= second.min.y || second.max.y + 0.04 <= first.min.y, `the ${a} and the ${b} stay clear of each other`);
  }
  checkFinite(model.root, t);
}
function IS4947seal() { return SRC.is4947.seal; }

{
  // The cartridge hangs clear of the water, whatever its size and however full the body.
  for (const grams of [20, 40, 60]) {
    model.reset();
    model.update({cartridge: grams, water: P.EXTINGUISHER_DOMAINS.water[1]});
    model.root.updateMatrixWorld(true);
    const toSystem = new THREE.Matrix4().copy(T.system.matrixWorld).invert();
    const group = T.bodyCartridges.find(item => item.userData.grams === grams), box = boxOf(group, toSystem);
    const level = M.LAYOUT.body[1] + P.levelOf(P.EXTINGUISHER_DOMAINS.water[1] / 1000) * 1000 * M.BODY_MM;
    t.ok(box.min.y > level + 0.005, `the ${grams} g cartridge hangs above the fullest water`);
    t.ok(box.min.x > M.LAYOUT.body[0] + (M.SHELL.neck[0] - M.CAP.shell[0] - 1) * M.BODY_MM && box.max.x < M.LAYOUT.body[0] + (M.SHELL.neck[0] + M.CAP.shell[0] + 1) * M.BODY_MM, 'as wide as it is and no wider');
    const tube = rectOf(T.tube);
    t.ok(tube.x0 - (M.SHELL.neck[0] + M.CAP.shell[0]) > 1, 'with room between it and the siphon tube');
  }
}

// ---------------------------------------------------------------------------
// 3. The lesson: every number it quotes is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const bestAim = () => { let best = [0, 0]; for (let aim = P.EXTINGUISHER_DOMAINS.aim[0]; aim <= P.EXTINGUISHER_DOMAINS.aim[1]; aim += P.EXTINGUISHER_DOMAINS.aim[2]) { const reach = P.extinguisherPlan({aim}).start.reach; if (reach > best[0]) best = [reach, aim]; } return best; };
checkTrialNumbers(L.fireExtinguisherLesson, {
  'Squeeze the grip': s => { t.ok(s.now.stage === 'done' && s.clock === s.duration, 'the run ends empty'); return {60: s.grams, '14.0': s.service / SRC.bar, 6: s.open, '53.0': s.speed, '8.1': s.start.reach, '17.5': s.half, '3.8': s.halfGauge / SRC.bar, '6.0': s.range, 95: P.IS15683.share, '35.0': s.effective, '55.8': s.duration}; },
  'A small cartridge': s => { t.ok(s.grams * 3 === SRC.kanex.cartridge, 'a third of the gas'); return {'5.0': s.service / SRC.bar, '31.7': s.speed, '0.7': s.halfGauge / SRC.bar, '3.6': s.range, 95: P.IS15683.share, '76.2': s.effective, '35.0': P.extinguisherPlan({}).effective, 60: SRC.kanex.cartridge}; },
  'A cold morning': s => ({71: 100 * s.cartridge.share, '39.5': s.cartridge.pressure / SRC.bar, '12.9': s.service / SRC.bar, '14.0': P.extinguisherPlan({}).service / SRC.bar, 95: P.IS15683.share, '36.8': s.effective, '5.6': s.range}),
  'A hot day': s => { t.ok(s.cartridge.full && s.cartridge.pressure === null, 'liquid fills the cartridge'); return {'27.6': P.FULL_AT, '15.4': s.service / SRC.bar, 16: SRC.kanex.maxService, 95: P.IS15683.share, '32.7': s.effective}; },
  'Too much water': s => ({'1.78': s.run.gasVolume(s.run.water) * 1000, '2.28': P.extinguisherPlan({}).run.gasVolume(P.extinguisherPlan({}).run.water) * 1000, '17.6': s.service / SRC.bar, 15: SRC.is940.closed * 10, 16: SRC.kanex.maxService, 55: P.IS15683.maxService[0], '19.5': s.serviceAt.hot / SRC.bar, '6.0': s.range}),
  'Only 6 L of water': s => { t.ok(s.halfGauge / s.service > P.extinguisherPlan({}).halfGauge / P.extinguisherPlan({}).service, 'less of its pressure lost'); return {'5.28': s.run.gasVolume(s.run.water) * 1000, '6.3': s.service / SRC.bar, '35.5': s.speed, '3.6': s.halfGauge / SRC.bar, '5.9': s.range, 9: SRC.kanex.liters, 95: P.IS15683.share, '25.5': s.effective}; },
  'Aim up': s => ({30: s.aim, '4.1': s.start.peak, '10.1': s.start.reach, '8.1': s.startLevel.reach, 45: P.EXTINGUISHER_DOMAINS.aim[1], '9.0': P.extinguisherPlan({aim: 45}).start.reach, '10.3': bestAim()[0], 25: bestAim()[1]}),
}, run, t);

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
const texts = lesson => [['simple', lesson.simple], ['overview', lesson.overview], ...lesson.steps.map((step, i) => [`step ${i + 1}`, step.body]), ...lesson.parts.map((item, i) => [`part ${i + 1}`, item.role]), ['misconception', lesson.misconception], ['quiz', [lesson.quiz.question, ...lesson.quiz.options].join(' ')]];
for (const [where, text] of texts(L.fireExtinguisherLesson)) covered(text, {}, `lesson ${where}`);

const def = P.extinguisherPlan({}), cold = P.extinguisherPlan({temperature: 5}), atFull = P.saturationAt(P.FULL_AT);
covered(L.fireExtinguisherLesson.deeper[0].body, {
  'IS 4947': 'IS 4947',
  [`at most ${P.IS4947.ratio} times the mass of water that would fill it at ${P.IS4947.at} °C, so ${def.grams} g needs ${f1(def.cartridge.volume * 1e6)} mL inside, a fill of ${f0(def.cartridge.fill)} kg/m³`]: 'at most 0.667 times the mass of water that would fill it at 27 °C, so 60 g needs 90.3 mL inside, a fill of 665 kg/m³',
  [`At ${f0(def.celsius)} °C the saturation table puts liquid of ${f0(def.cartridge.liquid)} kg/m³ under vapor of ${f0(def.cartridge.vapor)} kg/m³ at ${f1(def.cartridge.pressure / SRC.bar)} bar absolute, so liquid fills ${f0(100 * def.cartridge.share)}%`]: 'At 27 °C the saturation table puts liquid of 675 kg/m³ under vapor of 267 kg/m³ at 67.0 bar absolute, so liquid fills 97%',
  [`At ${f1(P.FULL_AT)} °C`]: 'At 27.6 °C',
  [`the critical point, ${P.CO2.critical[0]} °C`]: 'the critical point, 31.03 °C',
}, 'deeper 1');
covered(L.fireExtinguisherLesson.deeper[1].body, {
  [`the ${def.grams} g spreads through the ${f2(def.run.space * 1000)} L above ${f0(def.liters)} L of water and the cartridge’s own ${f1(def.cartridge.volume * 1e6)} mL, ${f2(def.run.gasVolume(def.run.water) * 1000)} L in all, at ${f1(def.co2Density)} kg/m³: far short of the ${f0(def.saturated)} kg/m³ at which liquid would form at ${f0(def.celsius)} °C`]: 'the 60 g spreads through the 2.19 L above 9 L of water and the cartridge’s own 90.3 mL, 2.28 L in all, at 26.4 kg/m³: far short of the 267 kg/m³ at which liquid would form at 27 °C',
  [`pressure as ${f2(def.partials.co2 / SRC.bar)} bar where an ideal gas would give ${f2(def.partials.ideal / SRC.bar)}`]: 'pressure as 14.04 bar where an ideal gas would give 14.95',
  [`the air adds ${f2(def.partials.air / SRC.bar)} bar and the water vapor ${f3(def.partials.vapor / SRC.bar)} bar; less 1 atm outside, the gauge reads ${f1(def.service / SRC.bar)} bar`]: 'the air adds 0.94 bar and the water vapor 0.036 bar; less 1 atm outside, the gauge reads 14.0 bar',
  [`under the ${P.IS940.closed} MN/m² IS 940 allows`]: 'under the 1.5 MN/m² IS 940 allows',
  [`it has ${f2(def.run.gasVolume(def.halfLeft) * 1000)} L and the gauge reads ${f1(def.halfGauge / SRC.bar)} bar`]: 'it has 7.37 L and the gauge reads 3.8 bar',
}, 'deeper 2');
covered(L.fireExtinguisherLesson.deeper[2].body, {
  '√(2Δp/ρ)': '√(2Δp/ρ)',
  [`${f1(def.speed)} m/s at ${f1(def.service / SRC.bar)} bar and ${f1(def.halfSpeed)} m/s at ${f1(def.halfGauge / SRC.bar)} bar`]: '53.0 m/s at 14.0 bar and 27.8 m/s at 3.8 bar',
  [`${P.TFT.gpm} gallons a minute through a 1 inch opening at 1 psi, comes to ${f3(P.DISCHARGE)} of Bernoulli’s flow, so the model passes ${f3(P.DISCHARGE)} times`]: '29.7 gallons a minute through a 1 inch opening at 1 psi, comes to 0.996 of Bernoulli’s flow, so the model passes 0.996 times',
  [`${f2(def.flow * 1000)} L/s at first through its opening of ${f2(P.NOZZLE.bore * 1000)} mm, a size set so ${P.IS15683.share}% of ${P.KANEX.liters} L leaves in Kanex’s ${P.KANEX.discharge} s`]: '0.43 L/s at first through its opening of 3.22 mm, a size set so 95% of 9 L leaves in Kanex’s 35 s',
}, 'deeper 3');
covered(L.fireExtinguisherLesson.deeper[3].body, {
  'IS 15683': 'IS 15683',
  [`level ${P.IS15683.height} m above the floor`]: 'level 1 m above the floor',
  [`leaving at ${f1(def.halfSpeed)} m/s would land ${f1(def.vacuumRange)} m away`]: 'leaving at 27.8 m/s would land 12.5 m away',
  [`${f2(P.DROP * 1000)} mm across with a sphere’s drag coefficient of ${P.SPHERE_DRAG}, lose a factor e of their speed to the air every ${f2(P.dragLength(P.DROP, def.celsius))} m, and land ${f1(def.range)} m away`]: '1.49 mm across with a sphere’s drag coefficient of 0.47, lose a factor e of their speed to the air every 3.58 m, and land 6.0 m away',
  [`farthest at ${P.EXTINGUISHER_DOMAINS.aim[1]}° as in empty space: from the start, level reaches ${f1(def.start.reach)} m, ${bestAim()[1]}° reaches ${f1(bestAim()[0])} m and ${P.EXTINGUISHER_DOMAINS.aim[1]}° only ${f1(P.extinguisherPlan({aim: 45}).start.reach)} m`]: 'farthest at 45° as in empty space: from the start, level reaches 8.1 m, 25° reaches 10.3 m and 45° only 9.0 m',
}, 'deeper 4');
covered(L.fireExtinguisherLesson.deeper[4].body, {
  [`strainer ${f1(def.outAt - def.open)} s after the valve opens, leaving ${f2(P.RESIDUAL * 1000)} L below it, ${f1(100 * def.retained)}% of the water, where IS 15683 lets a trial keep ${P.IS15683.retained}%`]: 'strainer 37.3 s after the valve opens, leaving 0.05 L below it, 0.6% of the water, where IS 15683 lets a trial keep 5%',
  [`more than ${f2(1 / def.run.critical)} times the air’s outside, 1 over the critical ratio of ${f3(def.run.critical)} for a heat capacity ratio of ${f2(def.run.gamma)}`]: 'more than 1.84 times the air’s outside, 1 over the critical ratio of 0.545 for a heat capacity ratio of 1.30',
  [`choked for ${f1(def.chokedFor)} s, and ${f1(def.gasTime)} s after the water ran out`]: 'choked for 4.8 s, and 12.4 s after the water ran out',
  [`with ${f1(def.run.remaining * def.run.fraction * P.CO2.molar)} g of the carbon dioxide still inside at 1 atm`]: 'with 18.3 g of the carbon dioxide still inside at 1 atm',
  'IS 15683': 'IS 15683',
}, 'deeper 5');
covered(L.fireExtinguisherLesson.deeper[5].body, {
  [`model ${P.AMEREX.model} holds ${P.AMEREX.gallons} gallons, ${f2(P.AMEREX.gallons * P.UNITS.gallon)} L, pressurized to ${P.AMEREX.psi} psi, ${f1(P.AMEREX.psi * P.UNITS.psi / P.BAR)} bar, and discharges for ${P.AMEREX.seconds} s over ${P.AMEREX.range[0]} to ${P.AMEREX.range[1]} ft, ${f1(P.AMEREX.range[0] * P.UNITS.foot)} to ${f1(P.AMEREX.range[1] * P.UNITS.foot)} m`]: 'model 240 holds 2.5 gallons, 9.46 L, pressurized to 100 psi, 6.9 bar, and discharges for 55 s over 45 to 55 ft, 13.7 to 16.8 m',
  [`${f0(def.liters)} L of water at ${f0(def.celsius)} °C takes up ${f0(def.dissolvable)} g of it at ${f1(def.partials.co2 / P.ATMOSPHERE)} atm`]: '9 L of water at 27 °C takes up 170 g of it at 13.9 atm',
}, 'deeper 6');
covered(L.fireExtinguisherLesson.quiz.explanation, {
  [`With ${def.grams} g at ${f0(def.celsius)} °C the gauge falls from ${f1(def.service / SRC.bar)} bar to ${f1(def.halfGauge / SRC.bar)} bar`]: 'With 60 g at 27 °C the gauge falls from 14.0 bar to 3.8 bar',
  [`slows from ${f1(def.speed)} m/s to ${f1(def.halfSpeed)} m/s, landing ${f1(def.range)} m away instead of ${f1(def.start.reach)} m`]: 'slows from 53.0 m/s to 27.8 m/s, landing 6.0 m away instead of 8.1 m',
}, 'quiz');
covered(L.fireExtinguisherLimits, {
  'IS 940': 'IS 940',
  'IS 15683': 'IS 15683',
  [`drawn at ${M.sizeWords(M.BODY_MM)}, the cartridge, grip and valve at ${M.sizeWords(M.CAP_MM)} as a schematic, and the jet at ${M.sizeWords(M.JET_M / 1000)}; the clock runs ${P.DECLARED.fast} times faster`]: 'drawn at a quarter of true size, the cartridge, grip and valve at true size as a schematic, and the jet at a hundredth of true size; the clock runs 5 times faster',
  [`a body holding ${f2(P.BODY.volume * 1000)} L inside, set so a ${P.KANEX.cartridge} g cartridge gives Kanex’s ${P.KANEX.service} bar over ${P.KANEX.liters} L at ${P.IS15683.service[0]} °C, with ${f0(1 / P.DECLARED.ends)}:1 ellipsoidal ends and a strainer ${P.DECLARED.strainer} mm above the bottom`]: 'a body holding 11.19 L inside, set so a 60 g cartridge gives Kanex’s 14 bar over 9 L at 27 °C, with 2:1 ellipsoidal ends and a strainer 10 mm above the bottom',
  [`one opening of ${f2(P.NOZZLE.bore * 1000)} mm`]: 'one opening of 3.22 mm',
  [`set so ${P.IS15683.share}% of ${P.KANEX.liters} L leaves in Kanex’s ${P.KANEX.discharge} s`]: 'set so 95% of 9 L leaves in Kanex’s 35 s',
  [`drops of one size, ${f2(P.DROP * 1000)} mm across, set so the level jet lands Kanex’s ${P.KANEX.throw} m away`]: 'drops of one size, 1.49 mm across, set so the level jet lands Kanex’s 6 m away',
  [`water of ${f0(P.DECLARED.tftWater)} kg/m³`]: 'water of 1,000 kg/m³',
  [`a cartridge ${f0(2 * (P.DECLARED.cartridge.radius + P.DECLARED.cartridge.wall))} mm across`]: 'a cartridge 40 mm across',
  [`a test gauge reading to ${P.DECLARED.dial} bar`]: 'a test gauge reading to 25 bar',
  [`water from ${P.EXTINGUISHER_DOMAINS.water[0]} to ${P.EXTINGUISHER_DOMAINS.water[1]} L and aim up to ${P.EXTINGUISHER_DOMAINS.aim[1]}°`]: 'water from 6 to 9.5 L and aim up to 45°',
}, 'limits');

// The model's own words, where the reader sees them.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {
  [`the body at ${M.sizeWords(M.BODY_MM)}, its cartridge, squeeze grip and control valve close up at ${M.sizeWords(M.CAP_MM)}, a test gauge, the jet at ${M.sizeWords(M.JET_M / 1000)}`]: 'the body at a quarter of true size, its cartridge, squeeze grip and control valve close up at true size, a test gauge, the jet at a hundredth of true size',
  [`the clock runs ${P.DECLARED.fast} times faster`]: 'the clock runs 5 times faster',
}, 'system text');
covered(partText('body'), {
  [`a steel shell ${P.IS940.diameter} mm across and ${f1(P.IS940.shell)} mm thick`]: 'a steel shell 175 mm across and 1.4 mm thick',
  [`holding ${f2(P.BODY.volume * 1000)} L inside`]: 'holding 11.19 L inside',
  [`the ${P.KANEX.liters} L fill line`]: 'the 9 L fill line',
  [`${M.SHELL.perBar} mm for each bar`]: '4 mm for each bar',
  [`at ${M.sizeWords(M.BODY_MM)}`]: 'at a quarter of true size',
}, 'body text');
covered(partText('siphon'), {
  [`a strainer ${P.DECLARED.strainer} mm above the bottom, drawn at ${M.sizeWords(M.BODY_MM)}`]: 'a strainer 10 mm above the bottom, drawn at a quarter of true size',
  [`${M.SHELL.flow[1]} mm for each liter a second`]: '200 mm for each liter a second',
}, 'siphon text');
covered(partText('hose'), {
  [`A hose ${P.IS940.hose[1]} mm long`]: 'A hose 600 mm long',
  'IS 940': 'IS 940',
  [`drawn at ${M.sizeWords(M.BODY_MM)}`]: 'drawn at a quarter of true size',
  [`one opening of ${f2(P.NOZZLE.bore * 1000)} mm`]: 'one opening of 3.22 mm',
  [`so ${P.IS15683.share}% of ${P.KANEX.liters} L leaves in Kanex’s ${P.KANEX.discharge} s`]: 'so 95% of 9 L leaves in Kanex’s 35 s',
}, 'hose text');
covered(partText('cartridge'), {
  [`close up at ${M.sizeWords(M.CAP_MM)}`]: 'close up at true size',
  [`steel ${2 * M.CAP.shell[0]} mm across`]: 'steel 40 mm across',
  [`IS 4947’s filling ratio of ${P.IS4947.ratio}`]: 'IS 4947’s filling ratio of 0.667',
  [`from ${f1(P.FULL_AT)} °C liquid fills it`]: 'from 27.6 °C liquid fills it',
  [`sits ${P.IS4947.seal} mm down the neck`]: 'sits 12 mm down the neck',
}, 'cartridge text');
covered(partText('grip'), {
  [`close up at ${M.sizeWords(M.CAP_MM)}`]: 'close up at true size',
  [`IS 940’s ${P.IS940.stroke} mm stroke`]: 'IS 940’s 7 mm stroke',
}, 'grip text');
covered(partText('valve'), {
  [`close up at ${M.sizeWords(M.CAP_MM)}`]: 'close up at true size',
  [`${P.IS15683.wait} s after the cartridge is pierced, as IS 15683’s test waits`]: '6 s after the cartridge is pierced, as IS 15683’s test waits',
  [`${M.CAP.flow[1]} mm for each liter a second`]: '60 mm for each liter a second',
}, 'valve text');
covered(partText('gauge'), {
  'IS 15683': 'IS 15683',
  [`from 0 to ${P.DECLARED.dial} bar`]: 'from 0 to 25 bar',
  [`above 1 atm`]: 'above 1 atm',
  [`read to ${P.IS15683.gauge[0]} to ${P.IS15683.gauge[1]}% of the service pressure and at least ${P.IS15683.gauge[2]}% of the maximum service pressure: for Kanex’s ${P.KANEX.service} and ${P.KANEX.maxService} bar, ${f0(P.KANEX.service * P.IS15683.gauge[0] / 100)} to ${f0(P.KANEX.service * P.IS15683.gauge[1] / 100)} bar and at least ${f1(P.KANEX.maxService * P.IS15683.gauge[2] / 100)} bar`]: 'read to 150 to 250% of the service pressure and at least 120% of the maximum service pressure: for Kanex’s 14 and 16 bar, 21 to 35 bar and at least 19.2 bar',
  [`IS 940’s ${P.IS940.closed} MN/m², ${f0(P.IS940.closed * 10)} bar`]: 'IS 940’s 1.5 MN/m², 15 bar',
}, 'gauge text');
t.ok(P.DECLARED.dial >= P.KANEX.service * P.IS15683.gauge[0] / 100 && P.DECLARED.dial <= P.KANEX.service * P.IS15683.gauge[1] / 100 && P.DECLARED.dial >= P.KANEX.maxService * P.IS15683.gauge[2] / 100, 'the dial reads to what IS 15683 asks of a gauge');
covered(partText('jet'), {
  [`The jet at ${M.sizeWords(M.JET_M / 1000)}`]: 'The jet at a hundredth of true size',
  [`held ${P.IS15683.height} m above the floor`]: 'held 1 m above the floor',
  'IS 15683': 'IS 15683',
}, 'jet text');
covered(partText('chart'), {
  [`from 0 at the bottom to ${P.DECLARED.dial} bar at the top`]: 'from 0 at the bottom to 25 bar at the top',
  [`until ${P.IS15683.share}% of the water is out, and the red line ${f0(P.IS940.closed * 10)} bar`]: 'until 95% of the water is out, and the red line 15 bar',
  [`every ${M.CHART.tickEvery} s`]: 'every 5 s',
}, 'chart text');
covered(model.playback.description, {
  [`wait ${P.IS15683.wait} s as IS 15683’s test does`]: 'wait 6 s as IS 15683’s test does',
  [`runs ${P.DECLARED.fast} times faster`]: 'runs 5 times faster',
}, 'playback description');
for (const control of model.controls) {
  const expected = control.key === 'cartridge' ? {[`IS 4947’s sizes up to the ${P.IS940.cartridge} g IS 940 allows`]: 'IS 4947’s sizes up to the 60 g IS 940 allows'}
    : control.key === 'water' ? {[`IS 940 fills it to ${f1(P.IS940.liters)} L, give or take ${f1(P.IS940.tolerance)} L`]: 'IS 940 fills it to 9.0 L, give or take 0.5 L'}
    : control.key === 'temperature' ? {'IS 15683': 'IS 15683'} : {'IS 15683': 'IS 15683'};
  covered(control.help, expected, `${control.key} help`);
}

{
  // The readings: what they say at the start, partway and at the end.
  model.reset();
  const ready = model.getState().readings, find = (list, label) => list.find(item => item.label === label);
  t.ok(ready.map(item => item.label).join() === 'Your result,Gauge,Water left,Jet,Reach,Discharge time,Cartridge,Service pressure,Clock', 'nine readings');
  t.ok(find(ready, 'Gauge').value === '0.0 bar' && find(ready, 'Water left').value === '9.00 L' && find(ready, 'Jet').value === 'none' && find(ready, 'Reach').value === 'none' && find(ready, 'Discharge time').value === '35.0 s' && find(ready, 'Cartridge').value === '97% liquid' && find(ready, 'Service pressure').value === '14.0 bar' && find(ready, 'Clock').value === '5 times faster', 'the readings carry the lesson’s figures');
  covered(find(ready, 'Gauge').hint, {
    [`the space at the room’s pressure, ${f3(def.partials.vapor === undefined ? 0 : (P.ATMOSPHERE - def.partials.vapor) / SRC.bar)} bar of air and ${f3(def.partials.vapor / SRC.bar)} bar of water vapor`]: 'the space at the room’s pressure, 0.978 bar of air and 0.036 bar of water vapor',
    'above 1 atm': 'above 1 atm',
  }, 'ready gauge hint');
  covered(find(ready, 'Cartridge').hint, {
    [`${def.grams} g at IS 4947’s filling ratio of ${P.IS4947.ratio} needs ${f1(def.cartridge.volume * 1e6)} mL inside, a fill of ${f0(def.cartridge.fill)} kg/m³`]: '60 g at IS 4947’s filling ratio of 0.667 needs 90.3 mL inside, a fill of 665 kg/m³',
    [`At ${f0(def.celsius)} °C the saturation table gives liquid of ${f0(def.cartridge.liquid)} kg/m³ under vapor of ${f1(def.cartridge.vapor)} kg/m³ at ${f1(def.cartridge.pressure / SRC.bar)} bar absolute, so liquid fills ${f0(100 * def.cartridge.share)}% of it; from ${f1(P.FULL_AT)} °C it would fill it all`]: 'At 27 °C the saturation table gives liquid of 675 kg/m³ under vapor of 267.2 kg/m³ at 67.0 bar absolute, so liquid fills 97% of it; from 27.6 °C it would fill it all',
    [`spreads through ${f2(def.run.gasVolume(def.run.water) * 1000)} L at ${f1(def.co2Density)} kg/m³, short of the ${f1(def.saturated)} kg/m³`]: 'spreads through 2.28 L at 26.4 kg/m³, short of the 267.2 kg/m³',
  }, 'ready cartridge hint');
  covered(find(ready, 'Discharge time').hint, {
    'IS 15683': 'IS 15683',
    [`until ${P.IS15683.share}% of the water is out. Kanex gives ${P.KANEX.discharge} s, and IS 940 asks for ${P.IS940.share}% within ${P.IS940.within} s`]: 'until 95% of the water is out. Kanex gives 35 s, and IS 940 asks for 95% within 120 s',
    [`strainer ${f1(def.outAt - def.open)} s after the valve opens; then the gas escapes for ${f1(def.gasTime)} s, choked for the first ${f1(def.chokedFor)} s, until the gauge reads zero ${f1(def.duration)} s after the squeeze`]: 'strainer 37.3 s after the valve opens; then the gas escapes for 12.4 s, choked for the first 4.8 s, until the gauge reads zero 55.8 s after the squeeze',
  }, 'ready discharge hint');
  covered(find(ready, 'Service pressure').hint, {
    'IS 15683': 'IS 15683',
    'IS 940': 'IS 940',
    [`over ${f1(def.liters)} L settles at ${f1(def.serviceAt.normal / SRC.bar)} bar at ${P.IS15683.service[0]} °C and ${f1(def.serviceAt.hot / SRC.bar)} bar at ${P.IS15683.maxService[0]} °C`]: 'over 9.0 L settles at 14.0 bar at 27 °C and 15.4 bar at 55 °C',
    [`Kanex gives ${P.KANEX.service} and ${P.KANEX.maxService} bar`]: 'Kanex gives 14 and 16 bar',
    [`no more than ${P.IS940.closed} MN/m², ${f0(P.IS940.closed * 10)} bar, at ${P.IS940.normal[0]} °C`]: 'no more than 1.5 MN/m², 15 bar, at 27 °C',
    [`tests the body at ${f1(P.IS940.test)} MN/m²; Kanex tests at ${P.KANEX.test} bar`]: 'tests the body at 3.0 MN/m²; Kanex tests at 35 bar',
  }, 'ready service hint');
  covered(find(ready, 'Clock').hint, {
    [`runs ${P.DECLARED.fast} times faster than the discharge: the ${f1(def.duration)} s from squeeze to empty take ${f1(def.duration / P.DECLARED.fast)} s`]: 'runs 5 times faster than the discharge: the 55.8 s from squeeze to empty take 11.2 s',
    [`drawn at ${M.sizeWords(M.BODY_MM)}, the cartridge, grip and valve at ${M.sizeWords(M.CAP_MM)} and the jet at ${M.sizeWords(M.JET_M / 1000)}`]: 'drawn at a quarter of true size, the cartridge, grip and valve at true size and the jet at a hundredth of true size',
  }, 'ready clock hint');
  covered(find(ready, 'Reach').hint, {
    'IS 15683': 'IS 15683',
    [`Drops ${f2(P.DROP * 1000)} mm across`]: 'Drops 1.49 mm across',
    [`lands Kanex’s ${P.KANEX.throw} m away`]: 'lands Kanex’s 6 m away',
    [`every ${f2(P.dragLength(P.DROP, def.celsius))} m`]: 'every 3.58 m',
    [`the nozzle level ${P.IS15683.height} m up`]: 'the nozzle level 1 m up',
    [`${f1(def.range)} m here`]: '6.0 m here',
  }, 'ready reach hint');
  covered(find(ready, 'Water left').hint, {
    [`${f1(100 * 1)}% of the ${f1(def.liters)} L, standing ${f0(P.levelOf(def.run.water) * 1000)} mm deep in a body that holds ${f2(P.BODY.volume * 1000)} L`]: '100.0% of the 9.0 L, standing 401 mm deep in a body that holds 11.19 L',
    [`The last ${f2(P.RESIDUAL * 1000)} L lies below the strainer, ${P.DECLARED.strainer} mm above the bottom, and stays: ${f1(100 * def.retained)}% of the water, where IS 15683 lets a trial keep ${P.IS15683.retained}%`]: 'The last 0.05 L lies below the strainer, 10 mm above the bottom, and stays: 0.6% of the water, where IS 15683 lets a trial keep 5%',
  }, 'ready water hint');
  covered(find(ready, 'Jet').hint, {[`opens, ${f0(def.open)} s after the cartridge is pierced`]: 'opens, 6 s after the cartridge is pierced'}, 'ready jet hint');

  model.advance(16 / P.DECLARED.fast);
  const running = model.getState().readings, now = P.extinguisherAt(def, 16);
  t.ok(find(running, 'Jet').value === `${f1(now.speed)} m/s` && find(running, 'Reach').value === `${f1(now.reach)} m` && find(running, 'Gauge').value === `${f1(now.gauge / SRC.bar)} bar` && find(running, 'Cartridge').value === 'pierced, empty', 'partway through, the jet, the reach and the gauge');
  covered(find(running, 'Gauge').hint, {
    [`air ${f2(now.partials.air / SRC.bar)} bar, water vapor ${f3(now.partials.vapor / SRC.bar)} bar and carbon dioxide ${f2(now.partials.co2 / SRC.bar)} bar, which the van der Waals equation gives for ${f1(now.co2Moles * P.CO2.molar)} g in ${f2(now.volume * 1000)} L, where an ideal gas would give ${f2(now.partials.ideal / SRC.bar)} bar. Less 1 atm outside, the gauge reads ${f1(now.gauge / SRC.bar)} bar`]: 'air 0.39 bar, water vapor 0.036 bar and carbon dioxide 5.99 bar, which the van der Waals equation gives for 60.0 g in 5.54 L, where an ideal gas would give 6.14 bar. Less 1 atm outside, the gauge reads 5.4 bar',
  }, 'running gauge hint');
  covered(find(running, 'Jet').hint, {
    [`at ${f1(now.gauge / SRC.bar)} bar water of ${f1(def.run.density)} kg/m³ leaves at √(2Δp/ρ) = ${f1(now.speed)} m/s`]: 'at 5.4 bar water of 996.5 kg/m³ leaves at √(2Δp/ρ) = 32.9 m/s',
    [`gives ${f3(P.DISCHARGE)} of the flow`]: 'gives 0.996 of the flow',
    [`the ${f2(P.NOZZLE.bore * 1000)} mm opening passes ${f2(now.flow * 1000)} L/s`]: 'the 3.22 mm opening passes 0.27 L/s',
    [`so ${P.IS15683.share}% of ${P.KANEX.liters} L leaves in Kanex’s ${P.KANEX.discharge} s`]: 'so 95% of 9 L leaves in Kanex’s 35 s',
  }, 'running jet hint');
  covered(find(running, 'Reach').hint, {
    'IS 15683': 'IS 15683',
    [`Drops ${f2(P.DROP * 1000)} mm across`]: 'Drops 1.49 mm across',
    [`lands Kanex’s ${P.KANEX.throw} m away`]: 'lands Kanex’s 6 m away',
    [`every ${f2(P.dragLength(P.DROP, def.celsius))} m`]: 'every 3.58 m',
    [`Aimed ${f0(def.aim)}° up from ${P.IS15683.height} m, they land ${f1(now.reach)} m away, where with no air they would reach ${f1(P.vacuumReach(now.speed, def.aim))} m`]: 'Aimed 0° up from 1 m, they land 6.5 m away, where with no air they would reach 14.9 m',
    [`the nozzle level ${P.IS15683.height} m up`]: 'the nozzle level 1 m up',
    [`${f1(def.range)} m here`]: '6.0 m here',
  }, 'running reach hint');
  model.advance((def.outAt + def.gasTime / 2 - 16) / P.DECLARED.fast);
  const escaping = model.getState().readings, gas = P.extinguisherAt(def, def.outAt + def.gasTime / 2);
  t.ok(find(escaping, 'Jet').value === 'gas only' && find(escaping, 'Jet').hint.includes(`${f1(gas.gasFlow * 1000)} g/s`) && find(escaping, 'Jet').hint.includes(gas.choked ? 'choked' : 'no longer choked'), 'the gas leaving, and whether it is choked');
  model.advance(1e4);
  const ended = model.getState().readings;
  t.ok(find(ended, 'Gauge').value === '0.0 bar' && find(ended, 'Jet').value === 'none' && find(ended, 'Water left').value === `${f2(P.RESIDUAL * 1000)} L` && find(ended, 'Your result').value.startsWith('Empty'), 'and at the end');
}

for (const lesson of [L.fireExtinguisherLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, 'a quiz with its answer first');
  t.ok(lesson.steps.length >= 5 && lesson.parts.length >= 6 && lesson.tryIt.length >= 6 && lesson.deeper.length >= 5 && lesson.sources.length >= 2, 'as deep as the benchmark asks');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title), ...model.parts.map(item => item.description), ...model.controls.map(control => control.help), model.playback.description, model.playback.label, model.playback.stepLabel, ...model.actions.map(action => action.label)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|vapour)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(item => model.parts.some(part => part.id === item.part) && item.view === 'front' && item.reset === true && item.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part named is one the model draws');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [lo, hi, step] = P.EXTINGUISHER_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.EXTINGUISHER_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'cartridge,temperature,water,aim', 'four controls');
const drawing = () => [stripRows(T.water).length, stripRows(T.water).at(-1)[1], T.gas.material.color.getHex(), T.gasArrows[0].userData.length, T.flowArrow.userData.length, T.needle.rotation.z, T.nozzleBar.rotation.z, pointsOf(T.nowLine).slice(0, 6), pointsOf(T.gaugeGuide).slice(0, 8), rectOf(T.effectiveBar).x1, T.closeCartridges.findIndex(item => item.group.visible), stripRows(T.liquid).at(-1)[1]];
checkControlsMove(model, drawing, m => m.advance(3), t);
checkRefusals(P.sampleExtinguisher, P.EXTINGUISHER_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available() && model.resultPart.id === 'chart' && model.playback.stepLabel === 'Advance 0.5 s' && !model.playback.blocked(), 'nothing to inspect before the squeeze, and nothing blocking Play');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.5 * P.DECLARED.fast, 1e-12, 'a step of half a second runs the discharge 2.5 s');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no run to inspect partway through');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'and a step changes the readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, 1 * P.DECLARED.fast, 1e-12, 'animation runs on by the time that passed, 5 times faster');
  model.animate(1.5);
  t.near(model.getState().clock, 2 * P.DECLARED.fast, 1e-12, 'and on again by the time since the last frame, not by the time on the clock');
  model.advance(1e4);
  t.ok(model.playback.complete() && model.resultPart.available() && model.getState().clock === def.duration, 'the run over, with the chart to inspect');
  const held = JSON.stringify([stripRows(T.water), T.needle.rotation.z]);
  model.animate(1e5);
  model.advance(50);
  t.ok(JSON.stringify([stripRows(T.water), T.needle.rotation.z]) === held, 'and nothing moves after the gauge reads zero');
  checkFinite(model.root, t);
  for (const [action, at] of [[model.actions[0], 0], [model.actions[1], P.IS15683.wait / 2], [model.actions[2], def.halfAt], [model.actions[3], def.outAt + def.gasTime / 2]]) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length === 9 && Math.abs(model.getState().clock - at) < 1e-9 && model.parts.some(item => item.id === action.part) && action.view === 'front', `${action.label} sets the clock where it says`);
    checkFinite(model.root, t);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system') && model.parts.length === 10, 'ten parts described, every one under the system');
  for (const values of [{}, {cartridge: 20, water: 6}, {temperature: 55, water: 9.5, aim: 45}]) for (const time of [0, 1, 20, 1e4]) {
    model.reset();
    model.update(values);
    model.advance(time);
    t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'every reading a number or words');
    checkFinite(model.root, t);
  }
}
{
  // The plan cache lets go once it has passed 64 settings.
  const first = P.extinguisherPlan({});
  t.ok(P.extinguisherPlan({}) === first, 'the same setting gives the same plan');
  for (let i = 0; i < 65; i++) P.extinguisherPlan({temperature: 5 + (i % 51), water: 6 + 0.5 * (i % 8)});
  t.ok(P.extinguisherPlan({}) !== first, 'and a long session does not keep them all');
}
{
  // Wired in: the safety corner builds it, the preview catalog carries it, and this check runs with the others.
  model.reset();
  const restAngle = T.lever.rotation.z, restHandle = M.CAP.pivot[1] + M.CAP.lever * Math.sin(restAngle);
  model.advance(1);
  const pressedAngle = T.lever.rotation.z, pressedHandle = M.CAP.pivot[1] + M.CAP.lever * Math.sin(pressedAngle);
  t.ok(restAngle > pressedAngle && restHandle - pressedHandle > 15, 'squeezing swings the lever’s handle down more than 15 mm');
  t.ok(model.initialPart === 'system' && model.initialView === 'front' && model.frameVisibleOnly === true && model.framePadding === 0.62 && model.selectionOutline === false && model.transparentBackground === true && Object.keys(model.topology).length > 40, 'the bench opens on the whole system and frames what is drawn');
  const routed = createSafetyModel('Fire extinguisher');
  t.ok(routed && routed.root.userData.machine === 'Fire extinguisher' && routed.controls.length === 4, 'the safety corner builds this model');
  routed.dispose();
  t.ok(previewEntryIds.includes('fire-extinguisher'), 'the preview catalog carries the item');
  t.ok(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts['test:models'].includes('node src/site/check-extinguisher-model.mjs'), 'and the model checks run this one');
}
t.ok(safetyLessons['Fire extinguisher'] === L.fireExtinguisherLesson, 'the safety corner’s lesson is this one');
t.ok(!Object.values(houseComponents).some(component => component.machine === 'Fire extinguisher'), 'no component routes to it: the group holds the machine alone');
const released = checkDisposal((() => { const fresh = M.createFireExtinguisherModel(); fresh.advance(4); return fresh; })(), t);
model.dispose();

console.log(`PASS fire extinguisher: ${t.count} checks, ${counts.plans} settings swept, ${counts.liters} moments of the water timed by quadrature, ${counts.moles} of the gas, ${counts.paths} jet paths from their hodographs, ${counts.slices} slices, ${counts.poses} poses, ${counts.points} drawn points, ${counts.numbers} quoted numbers traced, 1 lesson, ${released} resources released exactly once.`);

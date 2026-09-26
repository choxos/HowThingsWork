// Checks the generator, the transformer and the transmission line against
// their sources typed in again and their physics worked out by other routes:
// Faraday's law differentiated numerically from the flux each model reports,
// the root mean square and the mean of both outputs integrated over a turn,
// the winding's resistance rebuilt from resistivity, length and area, the
// transformer's ampere turns and energy balanced at both ports, its flux found
// again from the universal EMF equation and its Peak Efficiency Index from the
// regulation's own definition, the line's loss found again from Joule's law and
// its conductor's resistance from the International Annealed Copper Standard,
// and the catenary held to its own differential equation and its arc length
// integrated. Then every drawn turn, disc, tower and curve is read back from
// the geometry at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './grid-physics.js';
import * as GM from './grid-generator-model.js';
import * as TM from './grid-transformer-model.js';
import * as LM from './grid-line-model.js';
import * as GL from './grid-generator-lessons.js';
import * as TL from './grid-transformer-lessons.js';
import * as LL from './grid-line-lessons.js';
import {generatorLimits, transformerLimits, lineLimits} from './grid-sources.js';
import {houseComponents} from './house-components.js';
import {dailyLifeLessons} from './daily-life-lessons.js';

const t = tally();
const counts = {steps: 0, poses: 0, points: 0, numbers: 0, turns: 0, discs: 0, integrals: 0};
const f0 = v => fixed(v, 0), f1 = v => fixed(v, 1), f2 = v => fixed(v, 2), f3 = v => fixed(v, 3), f4 = v => fixed(v, 4), f5 = v => fixed(v, 5);
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;
/** Simpson's rule over [a, b]. */
const simpson = (fn, a, b, n = 20000) => { const h = (b - a) / n; let sum = 0; for (let i = 0; i <= n; i++) { sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * fn(a + i * h); counts.integrals++; } return sum * h / 3; };

// ---------------------------------------------------------------------------
// 1. The sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  copper: 1.68e-8, aluminum: 2.82e-8, annealed: 1.72e-8, iacs: 61.2,
  air: 3, frequency: 50, grid: [400, 275, 132], distribution: 11, house: 400, phase: 230, station: [480, 22], stepUp: [100, 1000],
  poles: 2, fifty: 3000, sixty: 3600, hundredTwenty: 120,
  tier2: {rating: 400, load: 3250, noLoad: 387}, pei: {mid: 99.712, big: 99.770}, amorphous: 70, quoted: 1.5, steelLoss: [2, 10],
  levels: [11, 33, 132, 275, 400],
  drake: {kcmil: 795, stranding: '26/7', inch: 1.108, lbkft: 1094, rbs: 31500, dc: 0.0214, ac: 0.026, amps: 907},
  rook: {kcmil: 636, stranding: '24/7', inch: 0.977, lbkft: 819, rbs: 22600, dc: 0.0268, ac: 0.033, amps: 784},
  partridge: {kcmil: 266.8, stranding: '26/7', inch: 0.642, lbkft: 367, rbs: 11130, dc: 0.0637, ac: 0.078, amps: 475},
  disc: {leakageInch: 12.63, strengthLb: 22000, diameter: 0.25, length: 0.15, dry: 72, rated: [10, 12]},
  longRod: [[2164, 327, 295], [2401, 385, 340], [2629, 420, 370], [3380, 441, 395], [3700, 480, 455], [4350, 585, 545]],
  discTable: [[34.5, 3], [69, 4], [115, 6], [138, 8], [161, 11], [230, 14], [287, 15], [345, 18], [400, 24], [500, 34], [765, 60]],
  creepage: [20, 25], tower: [15, 55],
  inch: 0.0254, foot: 0.3048, pound: 0.45359237, poundForce: 4.4482216152605,
};

t.ok(P.RESISTIVITY.copper === SRC.copper && P.RESISTIVITY.aluminum === SRC.aluminum && P.RESISTIVITY.annealed === SRC.annealed, 'copper 1.68, aluminum 2.82 and annealed copper 1.72, each times 10 to the minus 8 ohm meters');
t.near(P.RESISTIVITY.iacs * 100, SRC.iacs, 1e-12, 'the sheet calculates its resistance at 61.2 percent IACS');
t.near(P.AIR_STRENGTH / 1e6, SRC.air, 1e-12, 'air breaks down at 3 MV per meter');
t.ok(P.SUPPLY.frequency === SRC.frequency && P.SUPPLY.distribution === SRC.distribution * 1000 && P.SUPPLY.house === SRC.house && P.SUPPLY.phase === SRC.phase, 'a 50 Hz grid, 11 kV distribution, 400 V between lines and 230 V to neutral');
assert.deepEqual([...P.SUPPLY.grid], SRC.grid.map(kv => kv * 1000));
assert.deepEqual([...P.SUPPLY.station], [SRC.station[0], SRC.station[1] * 1000]);
assert.deepEqual([...P.SUPPLY.stepUp], SRC.stepUp.map(kv => kv * 1000));
t.ok(P.SYNCHRONOUS.poles === SRC.poles && P.SYNCHRONOUS.fifty === SRC.fifty && P.SYNCHRONOUS.sixty === SRC.sixty && P.SYNCHRONOUS.constant === SRC.hundredTwenty, 'N = 120 f / P, so a 2 pole machine turns at 3,000 rpm for 50 Hz and 3,600 for 60');
t.ok(P.TIER_TWO.rating === SRC.tier2.rating * 1000 && P.TIER_TWO.loadLoss === SRC.tier2.load && P.TIER_TWO.noLoad === SRC.tier2.noLoad, 'the regulation allows a 400 kVA transformer 3,250 W of load loss and 387 W of no load loss');
t.near(P.PEI_MINIMUM['31.5'] * 100, SRC.pei.mid, 1e-12, 'and asks 99.712 percent of a 31.5 MVA machine');
t.near(P.PEI_MINIMUM['400'] * 100, SRC.pei.big, 1e-12, 'and 99.770 percent of one over 100 MVA');
t.near(P.CORE_STEEL.amorphous * 100, 100 - SRC.amorphous, 1e-12, 'amorphous steel cuts core loss by up to 70 percent');
t.ok(P.CORE_STEEL.quoted === SRC.quoted && P.CORE_STEEL.lossPerKg[0] === SRC.steelLoss[0] && P.CORE_STEEL.lossPerKg[1] === SRC.steelLoss[1], 'electrical steel loses 2 to 10 W per kg at 1.5 T');
assert.deepEqual([...P.LEVELS], SRC.levels.map(kv => kv * 1000));
t.ok(P.UNITS.inch === SRC.inch && P.UNITS.foot === SRC.foot && P.UNITS.pound === SRC.pound && P.UNITS.poundForce === SRC.poundForce, 'the inch, the foot, the pound and the pound force, exactly');
t.near(P.UNITS.kcmil, Math.PI / 4 * 25.4 ** 2 / 1000, 1e-12, 'a thousand circular mils is π/4 of a thousandth of a square inch');
t.ok(P.CREEPAGE.low === SRC.creepage[0] && P.CREEPAGE.high === SRC.creepage[1] && P.TOWER.low === SRC.tower[0] && P.TOWER.high === SRC.tower[1], 'creepage of 20 to 25 mm for every kV, and towers of 15 to 55 m');
t.ok(P.DISC.diameter === SRC.disc.diameter && P.DISC.length === SRC.disc.length && P.DISC.dryFlashover === SRC.disc.dry * 1000, 'a standard disc 25 cm across and 15 cm long, flashing over dry at about 72 kV');
t.near(P.DISC.leakage, SRC.disc.leakageInch * SRC.inch, 1e-15, 'a toughened glass 52-3H unit gives 12.63 inches of leakage distance');
t.near(P.DISC.strength, SRC.disc.strengthLb * SRC.poundForce, 1e-9, 'and is rated 22,000 lb mechanical and electrical');
assert.deepEqual(P.LONG_ROD.map(row => [...row]), SRC.longRod);
assert.deepEqual(P.DISC_TABLE.map(row => [...row]), SRC.discTable);

// The three conductors, from the sheet's units into SI by exact conversions.
for (const [i, row] of [SRC.drake, SRC.rook, SRC.partridge].entries()) {
  const wire = P.CONDUCTORS[i], sheet = P.SHEET[i];
  t.ok(sheet.kcmil === row.kcmil && sheet.stranding === row.stranding && sheet.inch === row.inch && sheet.poundsPerKft === row.lbkft && sheet.breaking === row.rbs && sheet.dc === row.dc && sheet.ac === row.ac && sheet.ampacity === row.amps, `${wire.name} as the sheet gives it`);
  t.near(wire.area, row.kcmil * Math.PI / 4 * (0.001 * SRC.inch) ** 2 * 1000, relative(wire.area, 1e-12), `${wire.name}: its aluminum in square meters`);
  t.near(wire.diameter, row.inch * SRC.inch, 1e-15, `${wire.name}: its diameter in meters`);
  t.near(wire.mass, row.lbkft * SRC.pound / (1000 * SRC.foot), 1e-12, `${wire.name}: its mass for every meter`);
  t.near(wire.weight, wire.mass * 9.80665, 1e-9, `${wire.name}: its weight for every meter`);
  t.near(wire.breaking, row.rbs * SRC.poundForce, 1e-9, `${wire.name}: what would break it, in newtons`);
  t.near(wire.ac * 1000, row.ac / SRC.foot, 1e-12, `${wire.name}: ohms for every km at 75 °C`);
  t.near(wire.dc * 1000, row.dc / SRC.foot, 1e-12, `${wire.name}: and at 20 °C direct`);
  // The sheet's own conductivity, by another route: resistivity over area.
  const byArea = SRC.annealed / (SRC.iacs / 100) / wire.area * 1000;
  t.ok(Math.abs(byArea - wire.dc * 1000) / (wire.dc * 1000) < 0.01, `${wire.name}: resistivity over area comes within 1 percent of the sheet`);
}

// Faraday's law, by differentiating the flux the model reports.
for (const values of [{}, {speed: 1500}, {field: 0.5}, {turns: 40}, {speed: 3600, turns: 6}]) {
  const plan = P.generatorPlan(values), h = 1e-7;
  for (const share of [0.05, 0.2, 0.37, 0.6, 0.9]) {
    const time = plan.period * share;
    const before = P.generatorAt(plan, time - h).flux, after = P.generatorAt(plan, time + h).flux;
    t.near(P.generatorAt(plan, time).coilEmf, -(after - before) / (2 * h), relative(plan.peak, 1e-4) + 1e-6, 'the coil voltage is minus the rate the flux changes at');
    counts.steps++;
  }
  t.near(plan.fluxPeak, plan.turns * plan.field * 0.2 * 0.1, 1e-15, 'the flux through N turns of a 200 by 100 mm loop');
  t.near(plan.peak, plan.turns * plan.field * 0.02 * 2 * Math.PI * plan.speed / 60, relative(plan.peak, 1e-12), 'the peak is N B A ω');
  t.near(plan.winding, plan.turns * 0.6 * SRC.copper / 2.5e-6, relative(plan.winding, 1e-12), 'the winding is ρ times its length over its area');
  t.near(plan.frequency, Math.abs(plan.speed) * SRC.poles / SRC.hundredTwenty, 1e-12, 'and the frequency follows N = 120 f / P');
}
t.ok(P.generatorPlan({speed: 0}).period === null && P.generatorPlan({speed: 0}).slow === null && P.generatorPlan({speed: 0}).turnEnergy === null, 'a shaft that is not turning has no turn, no slowing and no energy in one');
t.ok(P.generatorPlan({closed: 0}).circuit === null, 'and an open switch has no circuit');

// Both outputs integrated over a whole turn, against the shares the plan uses.
for (const values of [{}, {output: 1}, {output: 1, turns: 40}, {load: 1}]) {
  const plan = P.generatorPlan(values), T0 = plan.period;
  const terminal = time => P.generatorAt(plan, time).terminal;
  const meanSquare = simpson(time => terminal(time) ** 2, 0, T0, 4000) / T0;
  const mean = simpson(time => terminal(time), 0, T0, 4000) / T0;
  const heat = simpson(time => P.generatorAt(plan, time).loadPower, 0, T0, 4000) / T0;
  if (plan.alternating) {
    t.near(Math.sqrt(meanSquare), plan.rms, relative(plan.rms, 2e-6), 'the root mean square of the sine, integrated');
    t.near(mean, 0, relative(plan.peak, 1e-6) + 1e-9, 'whose mean over a whole turn is nothing');
  } else {
    t.near(mean, plan.mean, relative(plan.mean, 2e-4), 'the mean of the commutated output, integrated');
    t.near(plan.mean, plan.peak * 2 * Math.cos(P.BRIDGE) / Math.PI, relative(plan.mean, 1e-12), 'which is 2cos(bridge)/π of the peak');
  }
  t.near(heat, plan.loadPower, relative(plan.loadPower, 5e-4) + 1e-9, 'and the load power, integrated over the turn');
  t.near(plan.drivePower, plan.loadPower + plan.windingPower, relative(plan.drivePower, 1e-12), 'the shaft pays for the load and the winding together');
  t.near(P.commutatedMeanSquare() + P.bridgedMeanSquare(), 0.5, 1e-15, 'the conducting part and the bridged part of a half turn add to a half');
}

// The transformer: the identity, the balance, the flux and the index.
for (const values of [{}, {stage: 0, primaryTurns: 3, secondaryTurns: 60}, {stage: 2, primaryTurns: 55, secondaryTurns: 2}, {secondaryTurns: 17, load: 45}, {primaryTurns: 7, core: 1, winding: 1}]) {
  const plan = P.transformerPlan(values), place = P.STAGES[plan.stage];
  t.near(plan.secondaryVolts / plan.primaryVolts, plan.secondaryTurns / plan.primaryTurns, relative(plan.ratio, 1e-12), 'the voltages follow the turns');
  t.near(plan.primaryTurns, plan.drawnPrimary * 20, 1e-12, 'twenty real turns for every turn drawn');
  const reflected = plan.activeCurrent * plan.primaryVolts;
  t.near(reflected, plan.output + plan.copperLoss + plan.coreLoss, relative(reflected, 1e-9), 'what comes in pays for the load, the copper and the core');
  if (plan.secondaryCurrent > 0) {
    t.near(plan.primaryTurns * (plan.output / plan.primaryVolts), plan.secondaryTurns * plan.secondaryCurrent, relative(plan.output / plan.primaryVolts * plan.primaryTurns, 1e-9), 'ampere turns balance across the core');
    t.near(plan.reflected, plan.load / plan.ratio ** 2, relative(plan.reflected, 1e-12), 'the load referred through the square of the ratio');
  } else t.ok(plan.reflected === null && plan.load === null && plan.efficiency === null, 'with nothing drawn there is no load, no reflection and no efficiency');
  // The universal EMF equation, both ways round.
  t.near(plan.flux, Math.SQRT2 * plan.primaryVolts / (2 * Math.PI * SRC.frequency * plan.primaryTurns * place.area), relative(plan.flux, 1e-12), 'the flux from E = 2π f N A B over √2');
  t.near(plan.secondaryVolts, 2 * Math.PI * SRC.frequency * plan.secondaryTurns * place.area * plan.flux / Math.SQRT2, relative(plan.secondaryVolts, 1e-9), 'and the secondary voltage back out of it');
  // The flux is the voltage integrated over the turns, so its rate is the voltage.
  const h = 1e-8;
  for (const share of [0.1, 0.3, 0.55, 0.8]) {
    const time = plan.duration * share;
    const rate = (P.transformerAt(plan, time + h).core - P.transformerAt(plan, time - h).core) / (2 * h);
    t.near(rate * plan.primaryTurns, P.transformerAt(plan, time).primaryVoltage, relative(plan.primaryVolts, 1e-4), 'the primary voltage is the turns times the rate the core flux changes at');
    counts.steps++;
  }
  t.near(plan.coreLoss, place.noLoad * plan.coreFactor * (plan.flux / plan.nominalFlux) ** 2, relative(plan.coreLoss, 1e-12), 'the core loss follows the square of the flux');
  t.near(plan.copperLoss, place.loadLoss * plan.windingFactor * (plan.values.load / 100) ** 2, relative(plan.copperLoss, 1e-12), 'and the copper loss the square of the load');
  t.near(plan.windingFactor, plan.values.winding === 1 ? SRC.aluminum / SRC.copper : 1, 1e-12, 'aluminum wastes the ratio of the resistivities more');
}
for (const place of P.STAGES) {
  t.near(P.peakEfficiencyIndex(place.noLoad, place.loadLoss, place.rating), place.index, 1e-15, `${place.name}: its index from its own losses`);
  // The regulation's index is the efficiency at the load where it is highest.
  const best = Math.sqrt(place.noLoad / place.loadLoss);
  const at = share => share * place.rating / (share * place.rating + place.noLoad + share ** 2 * place.loadLoss);
  // The regulation's index is the first order form of that peak: 1 − x where
  // the true figure is 1/(1 + x), with x twice the geometric mean of the two
  // losses over the rating. A machine set from the index therefore just clears it.
  const x = 2 * Math.sqrt(place.noLoad * place.loadLoss) / place.rating;
  t.near(at(best), 1 / (1 + x), relative(1, 1e-12), `${place.name}: the true peak efficiency is 1/(1 + x)`);
  t.near(place.index, 1 - x, relative(1, 1e-12), `${place.name}: and the regulation's index is 1 − x`);
  t.ok(at(best) >= place.index && at(best) - place.index < x * x, `${place.name}: so it clears the index it was set from, by less than x squared`);
  for (const share of [best * 0.5, best * 0.8, best * 1.3, best * 2]) t.ok(at(share) <= at(best) + 1e-15, `${place.name}: and no other load beats that one`);
  t.near(place.secondaryTurns / place.primaryTurns, place.secondary / place.primary, relative(place.secondary / place.primary, 1e-12), `${place.name}: its nominal turns give its nominal voltage`);
}
t.ok(P.STAGES[2].noLoad === SRC.tier2.noLoad && P.STAGES[2].loadLoss === SRC.tier2.load && P.STAGES[2].rating === SRC.tier2.rating * 1000, 'the home supply stage is the regulation’s 400 kVA unit exactly');
for (const [i, key] of [[0, 'big'], [1, 'mid']]) {
  t.near(P.STAGES[i].index, SRC.pei[key] / 100, 1e-12, `${P.STAGES[i].name}: set to just reach the index the regulation asks`);
  t.near(P.STAGES[i].loadLoss / P.STAGES[i].noLoad, SRC.tier2.load / SRC.tier2.noLoad, relative(SRC.tier2.load / SRC.tier2.noLoad, 1e-12), 'keeping the 400 kVA unit’s ratio of one loss to the other');
}

// The line: Joule's law, the ladder, the string and the catenary.
for (const values of [{}, {voltage: 2}, {voltage: 0, power: 30}, {conductor: 2, length: 250}, {power: 600, voltage: 3}]) {
  const plan = P.linePlan(values), wire = P.CONDUCTORS[values.conductor ?? 0];
  t.near(plan.current, plan.delivered / (Math.sqrt(3) * plan.volts), relative(plan.current, 1e-12), 'three phase current is the power over √3 times the voltage');
  t.near(plan.loss, 3 * plan.current ** 2 * plan.resistance, relative(plan.loss, 1e-12), 'and the loss is 3I²R');
  t.near(plan.resistance, wire.ac * plan.length, relative(plan.resistance, 1e-12), 'the resistance is the sheet figure times the length');
  t.near(plan.lossFraction, plan.loss / (plan.delivered + plan.loss), relative(plan.lossFraction, 1e-12), 'the share lost is the loss over what was sent');
  t.near(plan.drop, Math.sqrt(3) * plan.current * plan.resistance, relative(plan.drop, 1e-12), 'and the drop is √3 I R');
  // The whole argument: the loss goes as the inverse square of the voltage.
  for (const [a, b] of [[0, 4], [1, 3], [2, 4]]) {
    const low = plan.ladder[a], high = plan.ladder[b];
    t.near(low.loss / high.loss, (high.volts / low.volts) ** 2, relative(low.loss / high.loss, 1e-9), 'raising the voltage cuts the loss by the square of the ratio');
    t.ok(low.fraction > high.fraction, 'and always leaves a smaller share behind');
  }
  // The catenary, held to its own differential equation and its length integrated.
  const {a, sag, arc} = plan, span = plan.span;
  // A second difference on a curve whose scale is a needs a step of that
  // scale: at h of a millimeter the cancellation swamps the curvature itself.
  const height = x => P.catenaryHeight(a, x), h = a * 1e-3;
  for (const x of [-span / 2, -span / 4, 0, span / 3, span / 2]) {
    const slope = (height(x + h) - height(x - h)) / (2 * h);
    const curve = (height(x + h) - 2 * height(x) + height(x - h)) / h ** 2;
    t.near(curve, Math.sqrt(1 + slope ** 2) / a, relative(1 / a, 1e-4) + 1e-9, 'the hanging curve obeys y″ = √(1 + y′²)/a');
    counts.steps++;
  }
  t.near(arc, simpson(x => Math.sqrt(1 + Math.sinh(x / a) ** 2), -span / 2, span / 2, 2000), relative(arc, 1e-9), 'its length, integrated along it');
  t.near(sag, height(span / 2), relative(sag, 1e-12), 'its sag is how far its ends stand above its middle');
  t.near(plan.vertical, plan.weight * arc / 2, relative(plan.vertical, 1e-9), 'each support carries half the weight of the wire');
  t.near(plan.endTension, Math.hypot(plan.tension, plan.vertical), relative(plan.endTension, 1e-9), 'and the pull where it meets the tower is the two pulls squared and added');
  t.near(plan.tension, plan.values.tension / 100 * wire.breaking, relative(plan.tension, 1e-12), 'the pull is the share of breaking strength asked for');
  t.near(plan.towerHeight, P.SITE.clearance + sag + plan.stringLength + P.SITE.headroom, 1e-12, 'the tower is clearance, sag, string and headroom');
  t.near(plan.airGap, Math.SQRT2 * plan.volts / Math.sqrt(3) / (SRC.air * 1e6), relative(plan.airGap, 1e-12), 'the bare air gap is the peak to earth over the strength of air');
  t.near(plan.creepage, plan.discs * SRC.disc.leakageInch * SRC.inch, 1e-12, 'the creepage is the discs times what one gives');
  t.ok(plan.creepage * 1000 >= SRC.creepage[0] * plan.volts / 1000 - 1e-9, 'and always reaches the 20 mm for every kV asked of it');
  t.ok(plan.discs === 1 || (plan.discs - 1) * SRC.disc.leakageInch * SRC.inch * 1000 < SRC.creepage[0] * plan.volts / 1000, 'with no disc to spare');
}
// The disc rule against the numbers real lines carry, where the rule applies.
for (const [kv, discs] of SRC.discTable) {
  const rule = Math.max(1, Math.ceil(SRC.creepage[0] * kv / (SRC.disc.leakageInch * SRC.inch * 1000)));
  if (kv <= 230) t.ok(Math.abs(rule - discs) <= 2, `${kv} kV: the creepage rule gives ${rule} against the ${discs} real lines carry`);
  else t.ok(rule > 0, `${kv} kV: above 230 kV the string is set by surges rather than creepage, and the rule gives ${rule} against ${discs}`);
}
// The straight line fitted to the maker's six units passes through them.
for (const [creepage, dry, wet] of SRC.longRod) {
  t.ok(Math.abs(P.FLASHOVER.dry.intercept + P.FLASHOVER.dry.slope * creepage - dry) < 40, `${creepage} mm: the fit is within 40 kV of the sheet's ${dry} kV dry`);
  t.ok(Math.abs(P.FLASHOVER.wet.intercept + P.FLASHOVER.wet.slope * creepage - wet) < 40, `and within 40 kV of its ${wet} kV wet`);
}
{
  const residual = rows => { const fit = P.fitLine(rows); return rows.reduce((sum, [x, y]) => sum + (fit.intercept + fit.slope * x - y) ** 2, 0); };
  const dry = SRC.longRod.map(row => [row[0], row[1]]);
  t.ok(residual(dry) < residual(dry.map(([x, y], i) => [x, y + (i % 2 ? 30 : -30)])), 'the least squares fit is better than any shifted copy of it');
  t.ok(P.FLASHOVER.wet.slope > 0 && P.FLASHOVER.wet.intercept < P.FLASHOVER.dry.intercept, 'and a wet insulator stands less than a dry one at every length');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back from the geometry.
// ---------------------------------------------------------------------------

const generator = GM.createGeneratorModel(), G = generator.topology;
const transformer = TM.createTransformerModel(), T2 = transformer.topology;
const lineModel = LM.createLineModel(), L = lineModel.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
// Positions come back out of a Float32Array, whose step near 1 is about 6e-8, so
// a point read back off the geometry can never agree with the arithmetic that put
// it there to better than that. Anything a drawing could get wrong is far larger.
const DRAWN = 1e-6;
const boxOf = object => {
  const box = new THREE.Box3();
  object.traverse(child => {
    for (let node = child; node; node = node.parent) if (!node.visible) return;
    if (!child.geometry) return;
    child.geometry.computeBoundingBox();
    box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
  });
  return box;
};
const clear = (model, ids, gap, what) => {
  model.root.updateMatrixWorld(true);
  const boxes = ids.map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
  for (const [id, box] of boxes) t.ok(!box.isEmpty(), `${what}: ${id} is drawn`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, A] = boxes[i], [b, B] = boxes[j];
    t.ok(A.max.x + gap <= B.min.x || B.max.x + gap <= A.min.x || A.max.y + gap <= B.min.y || B.max.y + gap <= A.min.y, `${what}: ${a} and ${b} stay clear of each other`);
  }
};

// The generator: every turn drawn, the coil clear of the poles, both traces.
const generatorSettings = [{}, {output: 1}, {turns: 2}, {turns: 40, load: 1}, {speed: 600, field: 0.2}, {closed: 0}, {output: 1, turns: 40, speed: 3600}, {speed: 0}, {field: 0}];
for (const values of generatorSettings) {
  const plan = P.generatorPlan(values);
  for (const share of [0, 0.125, 0.3, 0.5, 0.75, 1]) {
    generator.reset();
    generator.update(values);
    generator.advance(P.COIL.show * share);
    generator.root.updateMatrixWorld(true);
    const state = generator.getState(), now = state.now;
    counts.poses++;
    t.near(state.clock, plan.period === null ? 0 : plan.period * share, 1e-12, 'the clock runs one turn over the seconds the scale gives');
    t.near(G.spinner.rotation.x, now.theta, 1e-12, 'the coil drawn at the angle it has turned to');
    t.ok(Math.abs(G.ringSpinner.rotation.x - now.theta) < 1e-12 && Math.abs(G.barSpinner.rotation.x - now.theta) < 1e-12, 'and the rings and the split ring with it');

    // Every turn asked for, drawn, at its true size and pitch.
    const winding = pointsOf(G.windings);
    t.ok(winding.length === plan.turns * 8, `${plan.turns} turns drawn as ${plan.turns * 8} points`);
    for (let k = 0; k < plan.turns; k++) {
      const corners = GM.turnCorners(k, plan.turns);
      t.near(corners[0][1], (k - (plan.turns - 1) / 2) * GM.WIRE * GM.METER, 1e-12, 'each turn one wire diameter from the last');
      t.ok(Math.abs(Math.abs(corners[0][0]) - P.COIL.length / 2 * GM.METER) < 1e-12 && Math.abs(Math.abs(corners[0][2]) - P.COIL.width / 2 * GM.METER) < 1e-12, 'each turn the true size of the loop');
      for (let i = 0; i < 4; i++) { const drawn = winding[k * 8 + i * 2]; t.ok(Math.abs(drawn[0] - corners[i][0]) < DRAWN && Math.abs(drawn[1] - corners[i][1]) < DRAWN, 'drawn where the loop is'); }
      counts.turns++;
    }
    // The coil never touches a pole.
    const coilBox = boxOf(G.spinner);
    t.ok(coilBox.max.y - GM.MACHINE[1] < GM.BENCH.gap - 1e-3 && GM.MACHINE[1] - coilBox.min.y < GM.BENCH.gap - 1e-3, 'the coil stays clear of both poles');

    // The two traces and the cursor.
    const rings = pointsOf(G.ringTrace), bars = pointsOf(G.barTrace);
    t.ok(rings.length === P.GENERATOR_SAMPLES && bars.length === P.GENERATOR_SAMPLES, 'both outputs drawn over the whole turn');
    for (let i = 0; i < P.GENERATOR_SAMPLES; i += 20) {
      const theta = 2 * Math.PI * i / (P.GENERATOR_SAMPLES - 1);
      t.near(rings[i][0], GM.chartX(theta), DRAWN, 'the slip ring trace across in angle');
      t.near(rings[i][1], GM.chartY(plan.peak * Math.sin(theta)), DRAWN, 'and up in voltage');
      t.near(bars[i][1], GM.chartY(P.commutatedEmf(plan.peak, theta)), DRAWN, 'the split ring trace at the size of the same sine, notched');
      t.ok(bars[i][1] >= GM.chartY(0) - DRAWN, 'and never below zero');
      counts.points++;
    }
    const cursor = pointsOf(G.cursor);
    t.near((cursor[0][0] + cursor[1][0]) / 2, GM.chartX(now.theta), DRAWN, 'the cursor where the shaft is');
    t.near(cursor[0][1], GM.chartY(now.terminal), DRAWN, 'at the voltage the chosen contacts are handing out');
    // The leads go to whichever contacts are chosen.
    const tap = pointsOf(G.tapWires);
    t.near(tap[0][0], plan.alternating ? GM.MACHINE[0] + GM.BENCH.ringA : GM.MACHINE[0] + GM.BENCH.barX, DRAWN, 'the load wired to the rings or to the split ring');
    // The field arrows follow the field.
    t.near(G.fieldArrows[0].userData.length, plan.field > 0 ? 2 * GM.BENCH.gap * plan.field / 1.2 : 0, 1e-12, 'the field arrows as long as the field is strong');
  }
}
clear(generator, ['output', 'load'], 0.05, 'generator');
{
  generator.reset();
  generator.root.updateMatrixWorld(true);
  const machine = new THREE.Box3();
  for (const id of ['field', 'coil', 'rings', 'commutator']) machine.union(boxOf(generator.parts.find(item => item.id === id).object));
  for (const id of ['output', 'load']) {
    const other = boxOf(generator.parts.find(item => item.id === id).object);
    t.ok(machine.max.x + 0.05 <= other.min.x || other.max.x + 0.05 <= machine.min.x || machine.max.y + 0.05 <= other.min.y || other.max.y + 0.05 <= machine.min.y, `the machine stays clear of the ${id}`);
  }
  // Each brush touches its own ring, and the two rings never touch each other.
  t.ok(Math.abs(GM.BENCH.ringA - GM.BENCH.ringB) > GM.BENCH.ringWidth, 'the two slip rings stand apart');
  for (const brush of G.ringBrushes) t.near(Math.abs(brush.position.y) - GM.BENCH.brushSize / 2, GM.BENCH.ringRadius + GM.BENCH.brushGap, 1e-12, 'each brush face sits on its ring');
  for (const brush of G.barBrushes) t.near(Math.abs(brush.position.y) - GM.BENCH.brushSize / 2, GM.BENCH.barRadius + GM.BENCH.brushGap, 1e-12, 'and each split ring brush on the copper');
  t.ok(G.ringBrushes[0].position.x !== G.ringBrushes[1].position.x, 'the two ring brushes ride different rings');
}

// The transformer: the core, the windings, the curves and the bars.
const transformerSettings = [{}, {stage: 0, primaryTurns: 3, secondaryTurns: 60}, {stage: 2, primaryTurns: 55, secondaryTurns: 2}, {load: 0}, {load: 120, winding: 1}, {core: 1, primaryTurns: 72, secondaryTurns: 1}];
for (const values of transformerSettings) {
  const plan = P.transformerPlan(values), leg = Math.sqrt(plan.area);
  for (const share of [0, 0.2, 0.5, 0.95, 1]) {
    transformer.reset();
    transformer.update(values);
    transformer.advance(P.WINDING.show * share);
    transformer.root.updateMatrixWorld(true);
    const state = transformer.getState(), now = state.now;
    counts.poses++;
    t.near(state.clock, plan.duration * share, 1e-12, 'the clock runs two cycles over the seconds the scale gives');
    t.near(state.leg, leg, 1e-12, 'the core leg is the square root of its cross section');
    t.near(T2.limbs[0].scale.x, leg * TM.CORE_SCALE, 1e-12, 'and is drawn at true size');
    t.near(T2.limbs[2].scale.y, leg * TM.CORE_SCALE, 1e-12, 'the yoke as thick as the leg');
    // Every turn drawn on both legs.
    for (const [coil, turns, side] of [[T2.primaryCoil, plan.drawnPrimary, -1], [T2.secondaryCoil, plan.drawnSecondary, 1]]) {
      const points = pointsOf(coil);
      t.ok(points.length === turns * 2 * TM.WINDOW.segments, `${turns} turns drawn as ${turns * 2 * TM.WINDOW.segments} points`);
      const height = TM.WINDOW.height * TM.CORE_SCALE, pitch = height / (turns + 1);
      const x = side * (TM.WINDOW.width / 2 + leg / 2) * TM.CORE_SCALE, radius = (leg / 2 + TM.WINDOW.clearance) * TM.CORE_SCALE;
      for (let k = 0; k < turns; k++) {
        const point = points[k * 2 * TM.WINDOW.segments];
        t.near(point[1], -height / 2 + (k + 1) * pitch, DRAWN, 'each turn evenly up the window');
        t.near(Math.hypot(point[0] - x, point[2]), radius, DRAWN, 'and around its own leg');
        counts.turns++;
      }
    }
    // The three curves, each against its own peak.
    const drawn = share > 0 ? plan.chart.filter(sample => sample.t <= now.t) : plan.chart;
    for (const [curve, pick, peak] of [[T2.voltageCurve, s => s.primaryVoltage, Math.SQRT2 * plan.primaryVolts], [T2.fluxCurve, s => s.density, plan.flux], [T2.magnetizingCurve, s => s.magnetizing, Math.SQRT2 * plan.magnetizing]]) {
      const points = pointsOf(curve);
      t.ok(points.length === drawn.length, 'drawn as far as the clock has run');
      for (let i = 0; i < points.length; i += 17) {
        t.near(points[i][0], TM.cycleX(plan, drawn[i].t), DRAWN, 'across in time');
        t.near(points[i][1], TM.cycleY(peak > 0 ? pick(drawn[i]) / peak : 0), DRAWN, 'up against its own peak');
        counts.points++;
      }
    }
    // The flux runs a quarter cycle behind the voltage, in the drawing too.
    if (plan.flux > 0) {
      const quarter = P.transformerAt(plan, plan.duration / 8);
      t.ok(Math.abs(quarter.primaryVoltage) < 1e-6 * plan.primaryVolts && Math.abs(Math.abs(quarter.density) - plan.flux) < 1e-9, 'a quarter cycle in, the voltage is nothing and the flux is at its most');
      t.near(T2.fluxArrows[0].userData.length, Math.min(0.9, Math.abs(now.density / plan.flux) * 0.8), 1e-12, 'the flux arrows as long as the flux is');
      const pointing = new THREE.Vector3(0, 1, 0).applyQuaternion(T2.fluxArrows[0].quaternion);
      t.near(pointing.y, now.density >= 0 ? 1 : -1, 1e-9, 'and pointing the way it is running');
    }
    // The bars: the load, and the two losses magnified so they can be seen.
    const shares = [plan.output, plan.copperLoss * TM.BARS.magnify, plan.coreLoss * TM.BARS.magnify];
    T2.barMeshes.forEach((bar, i) => t.near(bar.scale.x, Math.max(1e-9, Math.max(0, Math.min(1, shares[i] / plan.rating)) * TM.BARS.w), 1e-9, 'each bar the share it stands for'));
    const mark = pointsOf(T2.bestMark);
    t.near(mark[0][0], TM.BARS.x + Math.min(1, plan.bestShare) * TM.BARS.w, DRAWN, 'the mark at the load the machine likes best');
  }
}
clear(transformer, ['cycle', 'losses', 'load'], 0.05, 'transformer');
{
  transformer.reset();
  transformer.root.updateMatrixWorld(true);
  const iron = boxOf(transformer.parts.find(item => item.id === 'core').object);
  for (const id of ['cycle', 'losses', 'load']) {
    const other = boxOf(transformer.parts.find(item => item.id === id).object);
    t.ok(iron.max.x + 0.05 <= other.min.x || other.max.x + 0.05 <= iron.min.x || iron.max.y + 0.05 <= other.min.y || other.max.y + 0.05 <= iron.min.y, `the core stays clear of the ${id}`);
  }
}

// The line: the span, the pylon, the string and the two charts.
const lineSettings = [{}, {voltage: 0}, {voltage: 2, weather: 1}, {span: 500, tension: 12}, {span: 200, tension: 30, conductor: 2}, {power: 600, length: 300}];
for (const values of lineSettings) {
  const plan = P.linePlan(values);
  for (const share of [0, 0.25, 0.6, 1]) {
    lineModel.reset();
    lineModel.update(values);
    lineModel.advance(P.SITE.show * share);
    lineModel.root.updateMatrixWorld(true);
    const state = lineModel.getState(), now = state.now;
    counts.poses++;
    t.near(state.clock, plan.duration * share, 1e-12, 'the clock runs one cycle over the seconds the scale gives');
    // The span, at true size and in true proportion.
    const curve = pointsOf(L.spanCurve), expected = LM.spanPoints(plan.a, plan.span);
    t.ok(curve.length === expected.length, 'the whole span drawn');
    curve.forEach(([x, y], i) => {
      t.near(x, expected[i][0] * LM.SPAN, DRAWN, 'across at true size');
      t.near(y, (plan.towerHeight - plan.sag + expected[i][1]) * LM.SPAN, DRAWN, 'and up at the same true size');
      counts.points++;
    });
    const lowest = Math.min(...curve.map(point => point[1]));
    t.near(lowest, (plan.towerHeight - plan.sag) * LM.SPAN, DRAWN, 'its lowest point a sag below its ends');
    t.ok(lowest > P.SITE.clearance * LM.SPAN - DRAWN, 'which stays above the clearance line');
    // The string, one disc at a time.
    const shown = L.discMeshes.filter(mesh => mesh.visible);
    t.ok(shown.length === plan.discs, `${plan.discs} discs drawn`);
    shown.forEach((mesh, k) => {
      t.near(mesh.position.y, -(k + 0.5) * P.DISC.length * LM.STRING, DRAWN, 'each disc a disc length below the last');
      t.ok(L.discCaps[k].visible && Math.abs(L.discCaps[k].position.y - mesh.position.y - P.DISC.length * 0.45 * LM.STRING) < DRAWN, 'each with its cap on top');
      counts.discs++;
    });
    t.ok(L.discMeshes.slice(plan.discs).every(mesh => !mesh.visible), 'and no disc drawn that the string does not have');
    t.near(L.conductorBall.position.y, -plan.discs * P.DISC.length * LM.STRING - 0.06, 1e-9, 'the conductor hanging at the bottom of the string');
    t.ok(shown.every(mesh => mesh.material.color.getHex() === (plan.wet ? LM.COLORS.wet : LM.COLORS.glass)), 'wet or dry, drawn as it is');
    // The pylon and the load it carries.
    const tower = pointsOf(L.towerBody);
    t.ok(tower.length > 0 && Math.max(...tower.map(point => point[1])) > plan.towerHeight * LM.PYLON - DRAWN, 'the pylon drawn to its full height');
    t.near(L.loadArrow.userData.length, Math.min(0.8, plan.vertical / 8000 * 0.6), 1e-12, 'the weight arrow as heavy as the load');
    // One cycle of the three phases, and the heat below them.
    const peak = Math.SQRT2 * plan.current;
    const drawnPhases = pointsOf(L.phaseCurves[0]);
    for (let i = 0; i < drawnPhases.length; i += 13) {
      const sample = P.lineAt(plan, plan.duration * i / (LM.FLOW_SAMPLES - 1));
      t.near(drawnPhases[i][0], LM.flowX(plan, sample.t), DRAWN, 'across in time');
      t.near(drawnPhases[i][1], LM.flowY(0.5 + (peak > 0 ? sample.phases[0] / peak : 0) * 0.42), DRAWN, 'up in current');
      counts.points++;
    }
    for (const time of [0, plan.duration / 3, plan.duration / 2]) {
      const sample = P.lineAt(plan, time);
      t.near(sample.phases[0] + sample.phases[1] + sample.phases[2], 0, relative(peak, 1e-9) + 1e-9, 'the three phases add to nothing at every instant');
      t.near(sample.heat, sample.phases.reduce((sum, i) => sum + i * i * plan.resistance, 0), relative(sample.heat, 1e-12) + 1e-12, 'and the heat is the sum of their squares through the resistance');
    }
    // The ladder of five voltages.
    L.ladderBars.forEach((bar, k) => t.near(bar.scale.x, Math.max(0.004, Math.min(1, plan.ladder[k].fraction) * LM.LADDER.w), DRAWN, 'each bar the share that voltage would lose'));
    const marked = pointsOf(L.ladderMark);
    t.near(marked[0][1], LM.ladderY(plan.values.voltage), DRAWN, 'the mark beside the voltage chosen');
  }
}
clear(lineModel, ['line', 'pylon', 'insulator', 'flow', 'ladder'], 0.05, 'line');

// ---------------------------------------------------------------------------
// 3. The lessons: every number quoted is one a model computes or a source gives.
// ---------------------------------------------------------------------------

const runGenerator = values => { generator.reset(); generator.update(values); generator.advance(1e4); return generator.getState(); };
const runTransformer = values => { transformer.reset(); transformer.update(values); transformer.advance(1e4); return transformer.getState(); };
const runLine = values => { lineModel.reset(); lineModel.update(values); lineModel.advance(1e4); return lineModel.getState(); };
const def = P.generatorPlan({}), dcDef = P.generatorPlan({output: 1});
const midDef = P.transformerPlan({}), upDef = P.transformerPlan({stage: 0, primaryTurns: 3, secondaryTurns: 60}), homeDef = P.transformerPlan({stage: 2, primaryTurns: 55, secondaryTurns: 2});
const lineDef = P.linePlan({});

checkTrialNumbers(GL.electricGeneratorLesson, {
  'Turn the shaft': s => ({'125.66': s.peak, '88.86': s.rms, '50': s.frequency, '777.0': s.loadPower, '783.3': s.drivePower}),
  'Turn half as fast': s => ({'62.83': s.peak, '25.00': s.frequency, '194.2': s.loadPower}),
  'Double the turns': s => ({'251.33': s.peak, '0.1613': s.winding, '24.0': s.turns * 2 * (P.COIL.length + P.COIL.width), '3,058.8': s.loadPower}),
  'Switch the field off': s => ({'0.000': s.fluxPeak * 1000, '0.00': s.peak}),
  'Open the switch': s => ({'125.66': s.peak, '0.00': s.currentPeak, '0.0': s.loadPower}),
  'A heavier load': s => ({'116.29': s.currentPeak, '6,761.3': s.loadPower, '545.228': s.windingPower, '7,306.5': s.drivePower}),
  'Hold the shaft still': s => ({'400.000': s.fluxPeak * 1000, '0.00': s.peak, '0.0': s.loadPower}),
}, runGenerator, t);
checkTrialNumbers(GL.acGeneratorLesson, {
  'Watch one whole turn': s => ({'125.66': s.peak, '88.86': s.rms, '50': s.frequency}),
  'Turn faster': s => ({'150.80': s.peak, '106.63': s.rms, '60.00': s.frequency}),
  'Turn slower': s => ({'62.83': s.peak, '25.00': s.frequency}),
  'Halve the field': s => ({'200.000': s.fluxPeak * 1000, '62.83': s.peak, '194.2': s.loadPower}),
  'A lighter load': s => ({'2.51': s.currentPeak, '157.4': s.loadPower, '0.254': s.windingPower}),
  'Open the switch': s => ({'125.66': s.peak, '0.00': s.currentPeak, '0.0': s.loadPower}),
}, runGenerator, t);
checkTrialNumbers(GL.dcGeneratorLesson, {
  'Watch the split ring': s => ({'125.66': s.peak, '79.95': s.mean}),
  'The brush bridges the gap': s => ({'0.1613': s.winding, '3.534': s.peak ** 2 * s.bridgeShare / s.winding, '52.866': s.windingPower}),
  'Open the switch': s => ({'0.0': s.loadPower, '1.767': s.windingPower}),
  'Turn slower': s => ({'62.83': s.peak, '39.98': s.mean}),
  'A lighter load': s => ({'157.4': s.loadPower}),
  'Halve the field': s => ({'39.98': s.mean, '194.2': s.loadPower}),
}, runGenerator, t);
checkTrialNumbers(GL.generatorSlipRingsLesson, {
  'Follow one ring': s => ({'125.66': s.peak}),
  'Open the switch': s => ({'125.66': s.peak, '0.00': s.currentPeak}),
  'More turns behind them': s => ({'251.33': s.peak}),
  'Turn slower': s => ({'62.83': s.peak, '25.00': s.frequency}),
  'A heavier load': s => ({'116.29': s.currentPeak}),
  'A lighter load': s => ({'2.51': s.currentPeak, '157.4': s.loadPower}),
}, runGenerator, t);

checkTrialNumbers(TL.transformerLesson, {
  'Run two cycles': s => ({'132': s.primaryVolts / 1000, '11': s.secondaryVolts / 1000, '239.8': s.primaryCurrent, '2,863.6': s.secondaryCurrent, '99.535': 100 * s.efficiency}),
  'More turns on the secondary': s => ({'22': s.secondaryVolts / 1000, '478.4': s.primaryCurrent, '239.8': midDef.primaryCurrent}),
  'Nothing drawn at all': s => ({'0.00': s.copperLoss / 1000, '15.65': s.coreLoss / 1000, '1.20': s.primaryCurrent}),
  'The load it likes best': s => ({'35': s.values.load, '16.10': s.copperLoss / 1000, '99.713': 100 * s.efficiency, '99.535': 100 * midDef.efficiency}),
  'An amorphous core': s => ({'15.65': midDef.coreLoss / 1000, '4.70': s.coreLoss / 1000, '99.570': 100 * s.efficiency}),
  'Aluminum windings': s => ({'131.45': midDef.copperLoss / 1000, '220.65': s.copperLoss / 1000, '99.255': 100 * s.efficiency}),
  'Too few turns': s => ({'3.301': s.flux, '1.5': P.CORE_STEEL.quoted, '62.61': s.coreLoss / 1000}),
}, runTransformer, t);
checkTrialNumbers(TL.transformerTurnsRatioLesson, {
  'Count what is there': s => ({'60': s.drawnPrimary, '5': s.drawnSecondary, '132': s.primaryVolts / 1000, '11': s.secondaryVolts / 1000}),
  'Twice the outgoing turns': s => ({'22': s.secondaryVolts / 1000}),
  'Four times the outgoing turns': s => ({'44': s.secondaryVolts / 1000, '955.7': s.primaryCurrent}),
  'The same on both sides': s => ({'132': s.secondaryVolts / 1000}),
  'Half the incoming turns': s => ({'22': s.secondaryVolts / 1000, '3.301': s.flux}),
  'Volts for every turn': s => ({'44': s.secondaryVolts / 1000, '220.00': s.primaryVolts / s.primaryTurns, '110.00': midDef.primaryVolts / midDef.primaryTurns, '3.301': s.flux}),
}, runTransformer, t);
checkTrialNumbers(TL.transmissionTransformerLesson, {
  'Step it up for the journey': s => ({'20': s.primaryVolts / 1000, '400': s.secondaryVolts / 1000, '20,074.8': s.primaryCurrent, '1,000.0': s.secondaryCurrent}),
  'Nothing drawn at all': s => ({'158.73': s.coreLoss / 1000, '100.31': s.primaryCurrent}),
  'The load it likes best': s => ({'35': s.values.load, '99.771': 100 * s.efficiency}),
  'An amorphous core': s => ({'158.73': upDef.coreLoss / 1000, '47.62': s.coreLoss / 1000, '99.656': 100 * s.efficiency}),
  'Half the outgoing turns': s => ({'200': s.secondaryVolts / 1000, '99.260': 100 * s.efficiency}),
  'Pushed past its rating': s => ({'120': s.values.load, '1,200.0': s.secondaryCurrent, '1,919.58': s.copperLoss / 1000, '99.569': 100 * s.efficiency}),
}, runTransformer, t);
checkTrialNumbers(TL.distributionTransformerLesson, {
  'Step it down for the town': s => ({'132': s.primaryVolts / 1000, '11': s.secondaryVolts / 1000, '239.8': s.primaryCurrent, '2,863.6': s.secondaryCurrent, '31.500': s.rating / 1e6}),
  'Nothing drawn at all': s => ({'15.65': s.coreLoss / 1000, '1.20': s.primaryCurrent}),
  'The load it likes best': s => ({'35': s.values.load, '16.10': s.copperLoss / 1000, '99.713': 100 * s.efficiency}),
  'An amorphous core': s => ({'15.65': midDef.coreLoss / 1000, '4.70': s.coreLoss / 1000, '99.570': 100 * s.efficiency}),
  'Aluminum windings': s => ({'131.45': midDef.copperLoss / 1000, '220.65': s.copperLoss / 1000, '99.255': 100 * s.efficiency}),
  'The worst hour of the year': s => ({'120': s.values.load, '3,436.4': s.secondaryCurrent, '189.29': s.copperLoss / 1000, '99.461': 100 * s.efficiency}),
}, runTransformer, t);
checkTrialNumbers(TL.homeSupplyTransformerLesson, {
  'The last step down': s => ({'11': s.primaryVolts / 1000, '400': s.secondaryVolts, '1,000.0': s.secondaryCurrent, '0.39': s.coreLoss / 1000, '3.25': s.copperLoss / 1000, '99.099': 100 * s.efficiency}),
  'The street at night': s => ({'0.39': s.coreLoss / 1000, '0.19': s.primaryCurrent}),
  'A quiet afternoon': s => ({'35': s.values.load, '0.40': s.copperLoss / 1000, '99.442': 100 * s.efficiency}),
  'Twice the outgoing turns': s => ({'800': s.secondaryVolts}),
  'Aluminum windings': s => ({'3.25': homeDef.copperLoss / 1000, '5.46': s.copperLoss / 1000, '98.560': 100 * s.efficiency}),
  'Everyone home at once': s => ({'120': s.values.load, '1,200.0': s.secondaryCurrent, '4.68': s.copperLoss / 1000, '98.955': 100 * s.efficiency}),
}, runTransformer, t);

checkTrialNumbers(LL.electricityTransmissionLesson, {
  'Send it at the top voltage': s => ({'200': s.delivered / 1e6, '400': s.volts / 1000, '289': s.current, '8.53': s.resistance, '2.133': s.loss / 1e6, '1.06': 100 * s.lossFraction}),
  'Drop to the middle grid voltage': s => ({'875': s.current, '19.583': s.loss / 1e6, '8.92': 100 * s.lossFraction}),
  'Down to the street voltage': s => ({'200': s.delivered / 1e6, '10,497': s.current, '1,157': 100 * s.ampacityShare, '93.38': 100 * s.lossFraction}),
  'Three times as far': s => ({'25.59': s.resistance, '6.398': s.loss / 1e6, '3.10': 100 * s.lossFraction}),
  'Three times the power': s => ({'866': s.current, '19.193': s.loss / 1e6, '3.10': 100 * s.lossFraction}),
  'A thinner conductor': s => ({'25.59': s.resistance, '6.398': s.loss / 1e6, '61': 100 * s.ampacityShare, '475': s.wire.ampacity}),
  'A quiet night': s => ({'72': s.current, '0.133': s.loss / 1e6, '0.27': 100 * s.lossFraction}),
}, runLine, t);
checkTrialNumbers(LL.powerLineInsulatorLesson, {
  'Count the discs': s => ({'25': s.discs, '8,020': s.creepage * 1000, '20.1': s.creepagePerKv}),
  'Rain': s => ({'903': s.withstand / 1000, '932': lineDef.withstand / 1000, '0.058': lineDef.leakage * 1e6, '57.591': s.leakage * 1e6}),
  'A lower voltage': s => ({'9': s.discs, '2,887': s.creepage * 1000, '1.35': s.stringLength}),
  'The lowest voltage': s => ({'321': s.creepage * 1000, '29.2': s.creepagePerKv}),
  'Rain at a lower voltage': s => ({'378': s.withstand / 1000, '418': P.linePlan({voltage: 2}).withstand / 1000, '52.791': s.leakage * 1e6}),
  'Against a bare gap of air': s => ({'18': s.discs, '2.70': s.stringLength, '158.8': s.earthVolts / 1000, '75': s.airGap * 1000, '36': s.stringLength / s.airGap}),
}, runLine, t);
checkTrialNumbers(LL.powerPylonLesson, {
  'How far it dips': s => ({'1,755': s.a, '400': s.span, '11.41': s.sag, '400.87': s.arc, '26.2': s.towerHeight, '3.20': s.vertical / 1000}),
  'A longer span, hung slack': s => ({'29.81': s.sag, '504.71': s.arc, '44.6': s.towerHeight, '4.03': s.vertical / 1000}),
  'A short span, pulled tight': s => ({'1.90': s.sag, '16.6': s.towerHeight, '42.1': s.endTension / 1000}),
  'Pull the same span tighter': s => ({'11.41': lineDef.sag, '7.60': s.sag, '26.2': lineDef.towerHeight, '22.3': s.towerHeight, '42.0': s.tension / 1000, '30': s.values.tension, '140.1': s.wire.breaking / 1000}),
  'A lighter conductor': s => ({'10.83': s.sag, '1.07': s.vertical / 1000, '3.20': lineDef.vertical / 1000}),
  'A longer span at the same pull': s => ({'17.83': s.sag, '32.6': s.towerHeight, '4.00': s.vertical / 1000}),
}, runLine, t);

// Free text: every number sits inside a snippet the model or a source computes.
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
const expectNone = (lesson, name) => { for (const [where, text] of texts(lesson)) covered(text, {}, `${name} ${where}`); };

covered(generatorLimits, {
  [`a single rectangular loop of ${f0(P.COIL.length * 1000)} by ${f0(P.COIL.width * 1000)} mm wound with ${f1(P.COIL.wire * 1e6)} mm² copper wire`]: 'a single rectangular loop of 200 by 100 mm wound with 2.5 mm² copper wire',
  [`a field of ${f0(P.GENERATOR_DOMAINS.field[0])} to ${f1(P.GENERATOR_DOMAINS.field[1])} T, loads of ${f0(P.GENERATOR_DOMAINS.load[0])} to ${f0(P.GENERATOR_DOMAINS.load[1])} Ω`]: 'a field of 0 to 1.2 T, loads of 1 to 50 Ω',
  [`gaps are ${f0(P.COIL.gap)}° wide and whose brush faces are ${f0(P.COIL.brush)}°`]: 'gaps are 6° wide and whose brush faces are 10°',
}, 'generator limits');
covered(transformerLimits, {
  [`the core areas of ${f1(P.STAGES[0].area)}, ${f1(P.STAGES[1].area)} and ${f2(P.STAGES[2].area)} m², the window drawn the same ${f1(TM.WINDOW.width)} by ${f1(TM.WINDOW.height)} m at every stage, and ${f0(P.WINDING.per)} real turns for every turn drawn`]: 'the core areas of 0.9, 0.3 and 0.03 m², the window drawn the same 1.2 by 1.8 m at every stage, and 20 real turns for every turn drawn',
  [`taken as ${f1(100 * P.WINDING.magnetizing)} percent of rated current`]: 'taken as 0.5 percent of rated current',
  [`that the ${f0(P.TIER_TWO.rating / 1000)} kVA unit has`]: 'that the 400 kVA unit has',
}, 'transformer limits');
covered(lineLimits, {
  [`a power factor of ${f0(1)}, a span of ${f0(P.LINE_DOMAINS.span[0])} to ${f0(P.LINE_DOMAINS.span[1])} m, a pull of ${f0(P.LINE_DOMAINS.tension[0])} to ${f0(P.LINE_DOMAINS.tension[1])} percent`]: 'a power factor of 1, a span of 200 to 500 m, a pull of 12 to 30 percent',
  [`${f0(P.SITE.clearance)} m of clearance under the lowest point and ${f0(P.SITE.headroom)} m of steel above the top crossarm`]: '8 m of clearance under the lowest point and 3 m of steel above the top crossarm',
  [`the sheet figure at ${f0(75)} °C`]: 'the sheet figure at 75 °C',
  [`whose creepage runs from ${f0(P.LONG_ROD[0][0])} to ${f0(P.LONG_ROD.at(-1)[0])} mm`]: 'whose creepage runs from 2,164 to 4,350 mm',
  [`${f0(P.SITE.dry / 1e6)} MΩ for every mm of creepage dry and ${f0(P.SITE.wet / 1000)} kΩ wet`]: '500 MΩ for every mm of creepage dry and 500 kΩ wet',
}, 'line limits');

for (const lesson of [GL.electricGeneratorLesson, GL.acGeneratorLesson, GL.dcGeneratorLesson, GL.generatorSlipRingsLesson]) expectNone(lesson, 'generator family');
for (const lesson of [TL.transformerLesson, TL.transformerTurnsRatioLesson, TL.transmissionTransformerLesson, TL.distributionTransformerLesson, TL.homeSupplyTransformerLesson]) expectNone(lesson, 'transformer family');
for (const lesson of [LL.electricityTransmissionLesson, LL.powerLineInsulatorLesson, LL.powerPylonLesson]) expectNone(lesson, 'line family');

covered(GL.electricGeneratorLesson.deeper[0].body, {
  [`${f0(def.turns)} turns of ${f2(P.COIL_AREA)} m² at ${f0(def.field)} T and ${f1(def.omega)} rad/s give ${f2(def.peak)} V`]: '20 turns of 0.02 m² at 1 T and 314.2 rad/s give 125.66 V',
}, 'generator deeper 1');
covered(GL.electricGeneratorLesson.deeper[1].body, {
  [`peaks at ${f2(def.peak)} V is not ${f2(def.peak)} V of useful voltage`]: 'peaks at 125.66 V is not 125.66 V of useful voltage',
  [`the peak divided by the square root of two: ${f2(def.rms)} V`]: 'the peak divided by the square root of two: 88.86 V',
  [`2/π of the peak, which here is ${f2(dcDef.mean)} V`]: '2/π of the peak, which here is 79.95 V',
}, 'generator deeper 2');
covered(GL.electricGeneratorLesson.deeper[2].body, {
  [`At ${f0(def.turns)} turns the loop carries ${f1(def.turns * 2 * (P.COIL.length + P.COIL.width))} m of ${f1(P.COIL.wire * 1e6)} mm² copper, whose resistivity of ${f2(P.RESISTIVITY.copper * 1e8)} × 10⁻⁸ Ω·m makes ${f4(def.winding)} Ω`]: 'At 20 turns the loop carries 12.0 m of 2.5 mm² copper, whose resistivity of 1.68 × 10⁻⁸ Ω·m makes 0.0806 Ω',
  [`${f3(def.windingPower)} W here, against ${f1(def.loadPower)} W delivered`]: '6.266 W here, against 777.0 W delivered',
}, 'generator deeper 3');
covered(GL.electricGeneratorLesson.deeper[3].body, {
  [`the speed divided by ${f0(60)}`]: 'the speed divided by 60',
  [`N = ${f0(P.SYNCHRONOUS.constant)} f / P`]: 'N = 120 f / P',
  [`a machine with ${f0(P.SYNCHRONOUS.poles)} poles has to turn at ${f0(def.synchronous.fifty)} rpm to make ${f0(P.SUPPLY.frequency)} Hz and ${f0(def.synchronous.sixty)} rpm to make ${f0(60)} Hz`]: 'a machine with 2 poles has to turn at 3,000 rpm to make 50 Hz and 3,600 rpm to make 60 Hz',
}, 'generator deeper 4');
covered(GL.electricGeneratorLesson.deeper[4].body, {
  [`${f1(def.loadPower)} W goes to the resistor, ${f3(def.windingPower)} W heats the winding, and the shaft supplies ${f1(def.drivePower)} W`]: '777.0 W goes to the resistor, 6.266 W heats the winding, and the shaft supplies 783.3 W',
}, 'generator deeper 5');
covered(GL.electricGeneratorLesson.deeper[5].body, {}, 'generator deeper 6');
covered(GL.electricGeneratorLesson.quiz.explanation, {}, 'generator quiz');

covered(GL.acGeneratorLesson.deeper[0].body, {}, 'ac deeper 1');
covered(GL.acGeneratorLesson.deeper[1].body, {
  [`the speed over ${f0(60)}`]: 'the speed over 60',
  [`N = ${f0(P.SYNCHRONOUS.constant)} f / P`]: 'N = 120 f / P',
  [`A machine with ${f0(P.SYNCHRONOUS.poles)} poles turns at ${f0(def.synchronous.fifty)} rpm for ${f0(P.SUPPLY.frequency)} Hz`]: 'A machine with 2 poles turns at 3,000 rpm for 50 Hz',
  [`and ${f0(def.synchronous.sixty)} rpm for the ${f0(60)} Hz`]: 'and 3,600 rpm for the 60 Hz',
}, 'ac deeper 2');
covered(GL.acGeneratorLesson.deeper[2].body, {
  [`${f2(def.rms)} V RMS here does the work of a steady ${f2(def.rms)} V, though the peak is ${f2(def.peak)} V`]: '88.86 V RMS here does the work of a steady 88.86 V, though the peak is 125.66 V',
}, 'ac deeper 3');
covered(GL.acGeneratorLesson.deeper[3].body, {
  [`half the speed gave ${f1(P.generatorPlan({speed: 1500}).loadPower)} W where full speed gave ${f1(def.loadPower)} W`]: 'half the speed gave 194.2 W where full speed gave 777.0 W',
}, 'ac deeper 4');
covered(GL.acGeneratorLesson.deeper[4].body, {}, 'ac deeper 5');
covered(GL.acGeneratorLesson.quiz.explanation, {}, 'ac quiz');

covered(GL.dcGeneratorLesson.deeper[0].body, {}, 'dc deeper 1');
covered(GL.dcGeneratorLesson.deeper[1].body, {
  [`zero up to ${f2(dcDef.peak)} V and back, twice a turn. Its average is 2/π of the peak, ${f2(dcDef.mean)} V`]: 'zero up to 125.66 V and back, twice a turn. Its average is 2/π of the peak, 79.95 V',
}, 'dc deeper 2');
covered(GL.dcGeneratorLesson.deeper[2].body, {
  [`that moment is ${f0(P.BRIDGE * 180 / Math.PI)}° either side of each crossing`]: 'that moment is 2° either side of each crossing',
  [`it still costs ${f3(dcDef.peak ** 2 * dcDef.bridgeShare / dcDef.winding)} W in the winding`]: 'it still costs 1.767 W in the winding',
}, 'dc deeper 3');
covered(GL.dcGeneratorLesson.deeper[3].body, {
  [`delivers ${f1(def.loadPower)} W through slip rings and ${f3(dcDef.loadPower)} W through a split ring`]: 'delivers 777.0 W through slip rings and 776.973 W through a split ring',
}, 'dc deeper 4');
covered(GL.dcGeneratorLesson.deeper[4].body, {}, 'dc deeper 5');
covered(GL.dcGeneratorLesson.quiz.explanation, {}, 'dc quiz');

for (const [i] of GL.generatorSlipRingsLesson.deeper.entries()) {
  if (i === 4) covered(GL.generatorSlipRingsLesson.deeper[i].body, {
    [`the current fall to ${f2(P.generatorPlan({closed: 0}).currentPeak)} A while the coil goes on making ${f2(def.peak)} V`]: 'the current fall to 0.00 A while the coil goes on making 125.66 V',
  }, 'slip rings deeper 5');
  else covered(GL.generatorSlipRingsLesson.deeper[i].body, {}, `slip rings deeper ${i + 1}`);
}
covered(GL.generatorSlipRingsLesson.quiz.explanation, {}, 'slip rings quiz');

covered(TL.transformerLesson.deeper[0].body, {}, 'transformer deeper 1');
covered(TL.transformerLesson.deeper[1].body, {[`lags the induced EMF by ${f0(90)} degrees`]: 'lags the induced EMF by 90 degrees'}, 'transformer deeper 2');
covered(TL.transformerLesson.deeper[2].body, {
  [`E = 2π f N A B over the square root of two, about ${f2(2 * Math.PI / Math.SQRT2)} f N A B`]: 'E = 2π f N A B over the square root of two, about 4.44 f N A B',
  [`from ${f3(midDef.flux)} T to ${f3(P.transformerPlan({primaryTurns: 30}).flux)} T and the core loss from ${f2(midDef.coreLoss / 1000)} kW to ${f2(P.transformerPlan({primaryTurns: 30}).coreLoss / 1000)} kW`]: 'from 1.651 T to 3.301 T and the core loss from 15.65 kW to 62.61 kW',
}, 'transformer deeper 3');
covered(TL.transformerLesson.deeper[3].body, {[`here at ${f1(100 * midDef.bestShare)} percent of rating`]: 'here at 34.5 percent of rating'}, 'transformer deeper 4');
covered(TL.transformerLesson.deeper[4].body, {
  [`Here ${f3(midDef.load)} Ω on the secondary looks like ${f2(midDef.reflected)} Ω`]: 'Here 3.841 Ω on the secondary looks like 553.14 Ω',
}, 'transformer deeper 5');
covered(TL.transformerLesson.deeper[5].body, {
  [`between about ${f0(98)} and ${f0(99)} percent`]: 'between about 98 and 99 percent',
  [`asks a ${f0(P.TIER_TWO.rating / 1000)} kVA unit for no more than ${f0(P.TIER_TWO.loadLoss)} W of load loss and ${f0(P.TIER_TWO.noLoad)} W of no load loss, and asks a machine of ${f0(100)} MVA or more to reach a Peak Efficiency Index of ${f3(100 * P.PEI_MINIMUM['400'])} percent`]: 'asks a 400 kVA unit for no more than 3,250 W of load loss and 387 W of no load loss, and asks a machine of 100 MVA or more to reach a Peak Efficiency Index of 99.770 percent',
}, 'transformer deeper 6');
covered(TL.transformerLesson.quiz.explanation, {}, 'transformer quiz');

covered(TL.transformerTurnsRatioLesson.deeper[0].body, {}, 'ratio deeper 1');
covered(TL.transformerTurnsRatioLesson.deeper[1].body, {}, 'ratio deeper 2');
covered(TL.transformerTurnsRatioLesson.deeper[2].body, {
  [`Two windings of ${f0(30)} and ${f0(10)} have the same ratio as ${f0(60)} and ${f0(20)}`]: 'Two windings of 30 and 10 have the same ratio as 60 and 20',
  [`from ${f3(midDef.flux)} T to ${f3(P.transformerPlan({primaryTurns: 30}).flux)} T here`]: 'from 1.651 T to 3.301 T here',
}, 'ratio deeper 3');
covered(TL.transformerTurnsRatioLesson.deeper[3].body, {
  [`A winding standing ${f0(midDef.primaryVolts / 1000)} kV needs more turns than can be drawn: at ${f3(midDef.flux)} T through a core of ${f1(midDef.area)} m² it needs ${f0(midDef.primaryTurns)} of them`]: 'A winding standing 132 kV needs more turns than can be drawn: at 1.651 T through a core of 0.3 m² it needs 1,200 of them',
  [`Every turn drawn here stands for ${f0(P.WINDING.per)} real turns, so ${f0(midDef.drawnPrimary)} drawn is ${f0(midDef.primaryTurns)} real`]: 'Every turn drawn here stands for 20 real turns, so 60 drawn is 1,200 real',
}, 'ratio deeper 4');
covered(TL.transformerTurnsRatioLesson.deeper[4].body, {
  [`here ${f3(midDef.load)} Ω becomes ${f2(midDef.reflected)} Ω`]: 'here 3.841 Ω becomes 553.14 Ω',
}, 'ratio deeper 5');
covered(TL.transformerTurnsRatioLesson.quiz.explanation, {}, 'ratio quiz');

covered(TL.transmissionTransformerLesson.deeper[0].body, {
  [`between about ${f0(P.SUPPLY.station[0])} V and ${f0(P.SUPPLY.station[1] / 1000)} kV`]: 'between about 480 V and 22 kV',
  [`between ${f0(P.SUPPLY.stepUp[0] / 1000)} kV and ${f0(P.SUPPLY.stepUp[1] / 1000)} kV`]: 'between 100 kV and 1,000 kV',
  [`The ${f0(upDef.primaryVolts / 1000)} kV here is inside that band, and ${f0(upDef.secondaryVolts / 1000)} kV is the top voltage`]: 'The 20 kV here is inside that band, and 400 kV is the top voltage',
}, 'up deeper 1');
covered(TL.transmissionTransformerLesson.deeper[1].body, {}, 'up deeper 2');
covered(TL.transmissionTransformerLesson.deeper[2].body, {
  [`${f3(100 * P.PEI_MINIMUM['400'])} percent for a liquid immersed large power transformer of ${f0(100)} MVA or more`]: '99.770 percent for a liquid immersed large power transformer of 100 MVA or more',
  [`at ${f0(upDef.rating / 1e6)} MVA it allows ${f2(upDef.place.noLoad / 1000)} kW of no load loss and ${f2(upDef.place.loadLoss / 1000)} kW of load loss, which sounds enormous until you set it against ${f0(upDef.output / 1e6)} MW`]: 'at 400 MVA it allows 158.73 kW of no load loss and 1,333.04 kW of load loss, which sounds enormous until you set it against 400 MW',
}, 'up deeper 3');
covered(TL.transmissionTransformerLesson.deeper[3].body, {
  [`To stand ${f0(upDef.secondaryVolts / 1000)} kV at ${f0(P.SUPPLY.frequency)} Hz through ${f0(upDef.secondaryTurns)} real turns, the core has to carry ${f3(upDef.flux)} T through ${f1(upDef.area)} m² of iron. That is a block of laminated steel about ${f0(Math.sqrt(upDef.area) * 1000)} mm square`]: 'To stand 400 kV at 50 Hz through 1,200 real turns, the core has to carry 1.667 T through 0.9 m² of iron. That is a block of laminated steel about 949 mm square',
}, 'up deeper 4');
covered(TL.transmissionTransformerLesson.deeper[4].body, {[`energized ${f0(24)} hours a day`]: 'energized 24 hours a day'}, 'up deeper 5');
covered(TL.transmissionTransformerLesson.quiz.explanation, {}, 'up quiz');

covered(TL.distributionTransformerLesson.deeper[0].body, {
  [`between ${f0(2)} kV and ${f0(33)} kV, and that ${f0(11)} kV and ${f0(33)} kV are common`]: 'between 2 kV and 33 kV, and that 11 kV and 33 kV are common',
  [`The ${f0(midDef.secondaryVolts / 1000)} kV here is that`]: 'The 11 kV here is that',
  [`gives ${f0(midDef.primaryVolts / 1000)} kV as the lowest of the grid voltages`]: 'gives 132 kV as the lowest of the grid voltages',
}, 'mid deeper 1');
covered(TL.distributionTransformerLesson.deeper[1].body, {[`take ${f0(midDef.secondaryVolts / 1000)} kV takes it`]: 'take 11 kV takes it'}, 'mid deeper 2');
covered(TL.distributionTransformerLesson.deeper[2].body, {
  [`${f2(midDef.coreLoss / 1000)} kW whether the town is drawing ${f3(midDef.rating / 1e6)} MVA or nothing at all`]: '15.65 kW whether the town is drawing 31.500 MVA or nothing at all',
}, 'mid deeper 3');
covered(TL.distributionTransformerLesson.deeper[3].body, {
  [`Copper is ${f2(P.RESISTIVITY.copper * 1e8)} × 10⁻⁸ Ω·m and aluminum is ${f2(P.RESISTIVITY.aluminum * 1e8)} × 10⁻⁸ Ω·m, so the same cross section of aluminum has ${f2(P.RESISTIVITY.aluminum / P.RESISTIVITY.copper)} times the resistance and wastes ${f2(P.RESISTIVITY.aluminum / P.RESISTIVITY.copper)} times as much`]: 'Copper is 1.68 × 10⁻⁸ Ω·m and aluminum is 2.82 × 10⁻⁸ Ω·m, so the same cross section of aluminum has 1.68 times the resistance and wastes 1.68 times as much',
}, 'mid deeper 4');
covered(TL.distributionTransformerLesson.deeper[4].body, {
  [`carries ${f1(midDef.secondaryCurrent)} A against the incoming winding’s ${f1(midDef.primaryCurrent)} A`]: 'carries 2,863.6 A against the incoming winding’s 239.8 A',
}, 'mid deeper 5');
covered(TL.distributionTransformerLesson.quiz.explanation, {[`Here that is ${f2(midDef.coreLoss / 1000)} kW`]: 'Here that is 15.65 kW'}, 'mid quiz');

covered(TL.homeSupplyTransformerLesson.deeper[0].body, {
  [`phase to phase voltage of ${f0(P.SUPPLY.house)} volts and a single phase voltage of ${f0(P.SUPPLY.phase)} volts`]: 'phase to phase voltage of 400 volts and a single phase voltage of 230 volts',
  [`The ${f0(homeDef.secondaryVolts)} V here is the first of those`]: 'The 400 V here is the first of those',
  [`gives ${f0(120)} and ${f0(240)} V instead`]: 'gives 120 and 240 V instead',
}, 'home deeper 1');
covered(TL.homeSupplyTransformerLesson.deeper[1].body, {
  [`whose ${f1(7.2)} kV phase to neutral primary is exactly ${f0(30)} times the ${f0(240)} V`]: 'whose 7.2 kV phase to neutral primary is exactly 30 times the 240 V',
}, 'home deeper 2');
covered(TL.homeSupplyTransformerLesson.deeper[2].body, {
  [`ratings less than ${f0(200)} kVA`]: 'ratings less than 200 kVA',
  [`The ${f0(homeDef.rating / 1000)} kVA machine here`]: 'The 400 kVA machine here',
  [`are ${f0(P.TIER_TWO.loadLoss)} W of load loss and ${f0(P.TIER_TWO.noLoad)} W of no load loss`]: 'are 3,250 W of load loss and 387 W of no load loss',
}, 'home deeper 3');
covered(TL.homeSupplyTransformerLesson.deeper[3].body, {
  [`energized ${f0(24)} hours a day`]: 'energized 24 hours a day',
  [`the best point is at ${f1(100 * homeDef.bestShare)} percent of rating`]: 'the best point is at 34.5 percent of rating',
}, 'home deeper 4');
covered(TL.homeSupplyTransformerLesson.deeper[4].body, {
  [`reaches ${f3(100 * homeDef.efficiency)} percent at full load where the grid machine reached ${f3(100 * upDef.efficiency)} percent`]: 'reaches 99.099 percent at full load where the grid machine reached 99.628 percent',
}, 'home deeper 5');
covered(TL.homeSupplyTransformerLesson.quiz.explanation, {}, 'home quiz');

covered(LL.electricityTransmissionLesson.deeper[0].body, {}, 'line deeper 1');
covered(LL.electricityTransmissionLesson.deeper[1].body, {
  [`a ${f0(160)} km span at ${f0(765)} kV carrying ${f0(1000)} MW can have losses of ${f1(0.5)} to ${f1(1.1)} percent, while a ${f0(345)} kV line`]: 'a 160 km span at 765 kV carrying 1,000 MW can have losses of 0.5 to 1.1 percent, while a 345 kV line',
  [`loses ${f1(4.2)} percent`]: 'loses 4.2 percent',
  [`loses ${f2(100 * lineDef.lossFraction)} percent over ${f0(lineDef.length / 1000)} km at ${f0(lineDef.volts / 1000)} kV, and ${f2(100 * P.linePlan({voltage: 2}).lossFraction)} percent at ${f0(P.LEVELS[2] / 1000)} kV`]: 'loses 1.06 percent over 100 km at 400 kV, and 8.92 percent at 132 kV',
  // Years are written as years, not as counts, so they carry no thousands separator.
  [`about ${f0(5)} percent of what was generated in the United States from 2013 to 2019`]: 'about 5 percent of what was generated in the United States from 2013 to 2019',
}, 'line deeper 2');
// The section spells its counts out, three phases and three conductors. The one
// numeral left is the root three that turns a line voltage into three phase power.
covered(LL.electricityTransmissionLesson.deeper[2].body, {[`√${f0(3)} times the voltage between lines`]: '√3 times the voltage between lines'}, 'line deeper 3');
covered(LL.electricityTransmissionLesson.deeper[3].body, {[`limited to ${f0(75)} °C`]: 'limited to 75 °C'}, 'line deeper 4');
covered(LL.electricityTransmissionLesson.deeper[4].body, {}, 'line deeper 5');
covered(LL.electricityTransmissionLesson.deeper[5].body, {[`above about ${f0(2000)} kV between conductor and ground`]: 'above about 2,000 kV between conductor and ground'}, 'line deeper 6');
covered(LL.electricityTransmissionLesson.quiz.explanation, {}, 'line quiz');

covered(LL.powerLineInsulatorLesson.deeper[0].body, {}, 'insulator deeper 1');
covered(LL.powerLineInsulatorLesson.deeper[1].body, {
  [`minimum creepage distances are ${f0(P.CREEPAGE.low)} to ${f0(P.CREEPAGE.high)} mm for every kV`]: 'minimum creepage distances are 20 to 25 mm for every kV',
  [`gives ${f1(P.DISC.leakage * 1000)} mm of it in ${f0(P.DISC.length * 1000)} mm of length`]: 'gives 320.8 mm of it in 150 mm of length',
}, 'insulator deeper 2');
covered(LL.powerLineInsulatorLesson.deeper[2].body, {[`reduced by more than ${f0(50)} percent when the insulator is wet`]: 'reduced by more than 50 percent when the insulator is wet'}, 'insulator deeper 3');
covered(LL.powerLineInsulatorLesson.deeper[3].body, {
  [`${f0(P.DISC_TABLE[0][1])} discs at ${f1(P.DISC_TABLE[0][0])} kV, ${f0(P.DISC_TABLE[3][1])} at ${f0(P.DISC_TABLE[3][0])} kV, ${f0(P.DISC_TABLE[5][1])} at ${f0(P.DISC_TABLE[5][0])} kV, ${f0(P.DISC_TABLE[8][1])} at ${f0(P.DISC_TABLE[8][0])} kV and ${f0(P.DISC_TABLE[10][1])} at ${f0(P.DISC_TABLE[10][0])} kV`]: '3 discs at 34.5 kV, 8 at 138 kV, 14 at 230 kV, 24 at 400 kV and 60 at 765 kV',
  [`gives ${f0(3)}, ${f0(9)}, ${f0(15)} and ${f0(25)} at the first four`]: 'gives 3, 9, 15 and 25 at the first four',
}, 'insulator deeper 4');
covered(LL.powerLineInsulatorLesson.deeper[4].body, {}, 'insulator deeper 5');
covered(LL.powerLineInsulatorLesson.quiz.explanation, {}, 'insulator quiz');

covered(LL.powerPylonLesson.deeper[0].body, {
  [`here ${f1(lineDef.tension / 1000)} kN against ${f2(lineDef.weight)} N for every meter gives ${f0(lineDef.a)} m`]: 'here 28.0 kN against 15.97 N for every meter gives 1,755 m',
}, 'pylon deeper 1');
covered(LL.powerPylonLesson.deeper[1].body, {
  [`${f0(lineDef.values.tension)} percent of ${f1(lineDef.wire.breaking / 1000)} kN here`]: '20 percent of 140.1 kN here',
}, 'pylon deeper 2');
covered(LL.powerPylonLesson.deeper[2].body, {
  [`${f2(lineDef.arc)} m of wire across a ${f0(lineDef.span)} m span`]: '400.87 m of wire across a 400 m span',
}, 'pylon deeper 3');
covered(LL.powerPylonLesson.deeper[3].body, {[`${f2(lineDef.vertical / 1000)} kN here`]: '3.20 kN here'}, 'pylon deeper 4');
covered(LL.powerPylonLesson.deeper[4].body, {
  [`range from ${f0(P.TOWER.low)} to ${f0(P.TOWER.high)} m`]: 'range from 15 to 55 m',
  [`is ${f0(4597)} m between two masts`]: 'is 4,597 m between two masts',
}, 'pylon deeper 5');
covered(LL.powerPylonLesson.quiz.explanation, {}, 'pylon quiz');

// The models' own words: the scales and the slowed clocks, where the reader sees them.
const partText = (model, id) => model.parts.find(item => item.id === id).description;
covered(partText(generator, 'system'), {[`1 m to ${f0(GM.METER)} scene units`]: '1 m to 10 scene units', [`drawn in ${f0(P.COIL.show)} seconds`]: 'drawn in 8 seconds'}, 'generator system text');
covered(partText(generator, 'field'), {[`${f0(2 * GM.BENCH.gap / GM.METER * 1000)} mm apart`]: '160 mm apart'}, 'generator field text');
covered(partText(generator, 'coil'), {[`A loop ${f0(P.COIL.length * 1000)} by ${f0(P.COIL.width * 1000)} mm, wound with ${f1(P.COIL.wire * 1e6)} mm² copper wire ${f2(GM.WIRE * 1000)} mm across`]: 'A loop 200 by 100 mm, wound with 2.5 mm² copper wire 1.78 mm across'}, 'generator coil text');
covered(partText(generator, 'commutator'), {[`gaps are ${f0(P.COIL.gap)}° wide and the brush faces ${f0(P.COIL.brush)}°`]: 'gaps are 6° wide and the brush faces 10°', [`bridges both halves for ${f0(P.BRIDGE * 180 / Math.PI)}° either side`]: 'bridges both halves for 2° either side'}, 'generator commutator text');
covered(partText(generator, 'output'), {[`fixed scale of ${f0(GM.CHART.volts)} V up and down`]: 'fixed scale of 400 V up and down'}, 'generator output text');
covered(partText(generator, 'load'), {[`fixed scale of ${f0(GM.LOAD.watts)} W`]: 'fixed scale of 1,400 W'}, 'generator load text');
covered(partText(generator, 'rings'), {}, 'generator rings text');
covered(partText(transformer, 'system'), {[`1 m to ${f1(TM.CORE_SCALE)} scene units`]: '1 m to 0.6 scene units', [`stands for ${f0(P.WINDING.per)} real turns`]: 'stands for 20 real turns', [`run ${f0(P.WINDING.cycles)} cycles, drawn in ${f0(P.WINDING.show)} seconds`]: 'run 2 cycles, drawn in 8 seconds'}, 'transformer system text');
covered(partText(transformer, 'core'), {[`the same ${f1(TM.WINDOW.width)} by ${f1(TM.WINDOW.height)} m at every stage`]: 'the same 1.2 by 1.8 m at every stage'}, 'transformer core text');
covered(partText(transformer, 'windings'), {[`standing for ${f0(P.WINDING.per)} real turns`]: 'standing for 20 real turns'}, 'transformer windings text');
covered(partText(transformer, 'losses'), {[`drawn ${f0(TM.BARS.magnify)} times larger`]: 'drawn 60 times larger'}, 'transformer losses text');
covered(partText(transformer, 'cycle'), {}, 'transformer cycle text');
covered(partText(transformer, 'load'), {}, 'transformer load text');
covered(partText(lineModel, 'system'), {[`1 m to ${f3(LM.SPAN)} scene units`]: '1 m to 0.012 scene units', [`one ${f0(P.SUPPLY.frequency)} Hz cycle, drawn in ${f0(P.SITE.show)} seconds`]: 'one 50 Hz cycle, drawn in 8 seconds'}, 'line system text');
covered(partText(lineModel, 'line'), {[`1 m to ${f3(LM.SPAN)} scene units`]: '1 m to 0.012 scene units', [`the ${f0(P.SITE.clearance)} m of clearance`]: 'the 8 m of clearance'}, 'line span text');
covered(partText(lineModel, 'pylon'), {[`1 m to ${f2(LM.PYLON)} scene units`]: '1 m to 0.05 scene units', [`stand ${f0(P.TOWER.low)} to ${f0(P.TOWER.high)} m tall`]: 'stand 15 to 55 m tall'}, 'line pylon text');
covered(partText(lineModel, 'insulator'), {[`1 m to ${f2(LM.STRING)} scene units`]: '1 m to 0.35 scene units', [`${f0(P.CREEPAGE.low)} to ${f0(P.CREEPAGE.high)} mm of it for every kV`]: '20 to 25 mm of it for every kV'}, 'line insulator text');
covered(partText(lineModel, 'flow'), {}, 'line flow text');
covered(partText(lineModel, 'ladder'), {}, 'line ladder text');

// The readings carry the lessons' figures.
{
  generator.reset();
  const readings = generator.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,Output,Frequency,Load,Winding heat,Shaft,Flux,Slowed', 'the generator has eight readings, its result first');
  t.ok(find('Output').value === `${f2(def.rms)} V RMS` && find('Frequency').value === `${f2(def.frequency)} Hz` && find('Load').value === `${f1(def.loadPower)} W` && find('Shaft').value === `${f1(def.drivePower)} W` && find('Slowed').value === `${f0(def.slow)} times`, 'and they carry the figures the lessons quote');
  generator.update({speed: 0});
  const still = generator.getState().readings;
  t.ok(still.find(item => item.label === 'Output').value === '0 V' && still.find(item => item.label === 'Frequency').value === 'not turning' && still.find(item => item.label === 'Slowed').value === 'not turning', 'and say so plainly when the shaft is not turning');
  transformer.reset();
  const trReadings = transformer.getState().readings, trFind = label => trReadings.find(item => item.label === label);
  t.ok(trReadings[0].label === 'Your result' && trReadings.length === 11, 'the transformer has eleven readings, its result first');
  t.ok(trFind('Out').value === '11 kV' && trFind('Core loss').value === `${f2(midDef.coreLoss / 1000)} kW` && trFind('Copper loss').value === `${f2(midDef.copperLoss / 1000)} kW` && trFind('Efficiency').value === `${f3(100 * midDef.efficiency)} percent`, 'carrying the figures its lessons quote');
  transformer.update({load: 0});
  t.ok(transformer.getState().readings.find(item => item.label === 'Efficiency').value === 'nothing delivered' && transformer.getState().readings.find(item => item.label === 'Reflected').value === 'nothing connected', 'and saying so when nothing is drawn');
  lineModel.reset();
  const lnReadings = lineModel.getState().readings, lnFind = label => lnReadings.find(item => item.label === label);
  t.ok(lnReadings[0].label === 'Your result' && lnReadings.length === 12, 'the line has twelve readings, its result first');
  t.ok(lnFind('Line loss').value === `${f2(100 * lineDef.lossFraction)} percent` && lnFind('Current').value === `${f0(lineDef.current)} A` && lnFind('Insulator').value === `${f0(lineDef.discs)} discs` && lnFind('Sag').value === `${f2(lineDef.sag)} m` && lnFind('Pylon').value === `${f1(lineDef.towerHeight)} m`, 'carrying the figures its lessons quote');
}

// Every lesson, and where it is routed from.
const lessons = [GL.electricGeneratorLesson, GL.acGeneratorLesson, GL.dcGeneratorLesson, GL.generatorSlipRingsLesson, TL.transformerLesson, TL.transformerTurnsRatioLesson, TL.transmissionTransformerLesson, TL.distributionTransformerLesson, TL.homeSupplyTransformerLesson, LL.electricityTransmissionLesson, LL.powerLineInsulatorLesson, LL.powerPylonLesson];
for (const lesson of lessons) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  t.ok(lesson.steps.length === 5 && lesson.parts.length >= 3 && lesson.tryIt.length >= 6 && lesson.deeper.length >= 5, `${lesson.simple}: five steps, six trials and five deeper sections at least`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.length >= 4 && lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources.map(source => source.url)).size === lesson.sources.length, 'four sources at least, each a link, none twice');
}
t.ok(dailyLifeLessons['Electric generator'] === GL.electricGeneratorLesson && dailyLifeLessons['Transformer'] === TL.transformerLesson && dailyLifeLessons['Electricity transmission'] === LL.electricityTransmissionLesson, 'the three machines are routed to their lessons');
for (const [name, machine, part, lesson, values] of [
  ['AC generator', 'Electric generator', 'output', GL.acGeneratorLesson, {output: 0}],
  ['DC generator', 'Electric generator', 'commutator', GL.dcGeneratorLesson, {output: 1}],
  ['Generator slip rings', 'Electric generator', 'rings', GL.generatorSlipRingsLesson, {output: 0}],
  ['Transformer turns ratio', 'Transformer', 'windings', TL.transformerTurnsRatioLesson, undefined],
  ['Transmission transformer', 'Transformer', 'core', TL.transmissionTransformerLesson, {stage: 0, primaryTurns: 3, secondaryTurns: 60}],
  ['Distribution transformer', 'Transformer', 'losses', TL.distributionTransformerLesson, {stage: 1, primaryTurns: 60, secondaryTurns: 5}],
  ['Home-supply transformer', 'Transformer', 'load', TL.homeSupplyTransformerLesson, {stage: 2, primaryTurns: 55, secondaryTurns: 2}],
  ['Power-line insulator', 'Electricity transmission', 'insulator', LL.powerLineInsulatorLesson, undefined],
  ['Power pylon', 'Electricity transmission', 'pylon', LL.powerPylonLesson, undefined],
]) {
  const component = houseComponents[name];
  t.ok(component && component.machine === machine && component.part === part && component.lesson === lesson && component.intro === lesson.simple && component.view === 'front' && component.isolate === false, `${name} routes to the ${machine}'s ${part} with its own lesson`);
  assert.deepEqual(component.values, values);
  // Every trial stays on the machine the page is about, which is what `stage` and
  // `output` pick out, and one trial sits exactly where the page opens. A trial is
  // still free to turn a knob: that is what a trial is for, and the turns ratio
  // pages exist to have their turns changed.
  if (values) {
    for (const key of Object.keys(values).filter(item => item === 'stage' || item === 'output')) {
      t.ok(lesson.tryIt.every(item => item.values[key] === values[key]), `${name}: every trial stays on ${key} = ${values[key]}`);
    }
    t.ok(lesson.tryIt.some(item => Object.entries(values).every(([key, value]) => item.values[key] === value)), `${name}: and one trial sits exactly where the page opens`);
  }
  t.ok(!dailyLifeLessons[name], `${name} is a component and not a machine of its own`);
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const [model, domains, defaults, keys, what] of [
  [generator, P.GENERATOR_DOMAINS, P.GENERATOR_DEFAULTS, 'output,speed,field,turns,load,closed', 'generator'],
  [transformer, P.TRANSFORMER_DOMAINS, P.TRANSFORMER_DEFAULTS, 'stage,primaryTurns,secondaryTurns,load,core,winding', 'transformer'],
  [lineModel, P.LINE_DOMAINS, P.LINE_DEFAULTS, 'voltage,conductor,length,power,span,tension,weather', 'line'],
]) {
  t.ok(model.controls.map(control => control.key).join() === keys, `${what}: its controls, in order`);
  for (const control of model.controls) {
    const [lo, hi, step] = domains[control.key];
    t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === defaults[control.key], `${what}: ${control.key} spans its domain from its default`);
    t.ok(typeof control.label === 'string' && control.label.length > 0 && !/[—–]| - |--/.test(control.help || ''), `${what}: ${control.key} is labeled and free of dashes`);
  }
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description)), `${what}: every part described, with no dashes`);
  t.ok(model.parts.every(item => item.id === 'system' || item.parentId === 'system'), `${what}: every part a child of the system`);
  t.ok(model.initialPart === 'system' && model.frameVisibleOnly === true && typeof model.framePadding === 'number', `${what}: frames what is visible, from the system`);
  t.ok(model.topology && Object.keys(model.topology).length > 10, `${what}: its topology is exported`);
}
checkRefusals(P.sampleGenerator, P.GENERATOR_DOMAINS, t);
checkRefusals(P.sampleTransformer, P.TRANSFORMER_DOMAINS, t);
checkRefusals(P.sampleLine, P.LINE_DOMAINS, t);

generator.reset();
checkControlsMove(generator, () => [pointsOf(G.windings).length, G.spinner.rotation.x, G.fieldArrows[0].userData.length, G.switchPivot.rotation.z, G.powerBar.scale.x, G.currentArrows[0].userData.length, G.effort.userData.length, pointsOf(G.ringTrace).slice(0, 8), pointsOf(G.cursor), pointsOf(G.tapWires)], m => m.advance(3), t);
transformer.reset();
checkControlsMove(transformer, () => [pointsOf(T2.primaryCoil).length, pointsOf(T2.secondaryCoil).length, T2.limbs[0].scale.x, T2.limbs[0].material.color.getHex(), T2.primaryCoil.material.color.getHex(), T2.fluxArrows[0].userData.length, T2.barMeshes.map(bar => bar.scale.x), pointsOf(T2.bestMark), T2.loadBox.scale.x, T2.drawArrow.userData.length, pointsOf(T2.voltageCurve).slice(0, 6)], m => m.advance(2), t);
lineModel.reset();
checkControlsMove(lineModel, () => [pointsOf(L.spanCurve).slice(0, 8), pointsOf(L.towers[0]).slice(0, 4), L.discMeshes.filter(mesh => mesh.visible).length, L.discMeshes[0].material.color.getHex(), L.marginBar.scale.x, pointsOf(L.phaseCurves[0]).slice(0, 6), L.ladderBars.map(bar => bar.scale.x), pointsOf(L.ladderMark), L.loadArrow.userData.length, pointsOf(L.pylonWire).slice(0, 4)], m => m.advance(2), t);

for (const [model, settings, what] of [[generator, generatorSettings, 'generator'], [transformer, transformerSettings, 'transformer'], [lineModel, lineSettings, 'line']]) {
  model.reset();
  checkFinite(model.root, t);
  for (const values of settings) for (const time of [0, 1, 4, 9, 1e4]) {
    model.reset();
    model.update(values);
    model.advance(time);
    t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|null/.test(String(item.value) + (item.hint || ''))), `${what}: every reading is a number or a plain word`);
    checkFinite(model.root, t);
  }
  model.reset();
  t.ok(!model.playback.complete() && !model.resultPart.available(), `${what}: nothing to inspect before it runs`);
  model.playback.step();
  t.ok(model.getState().clock > 0, `${what}: a step moves the clock`);
  model.animate(0);
  model.animate(2);
  t.ok(model.getState().clock > 0, `${what}: and so does the animation`);
  model.advance(1e4);
  t.ok(model.playback.complete() && model.resultPart.available(), `${what}: a finished run has a result to inspect`);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0, `${what}: ${action.label} returns readings`); checkFinite(model.root, t); }
  t.ok(model.parts.some(item => item.id === model.resultPart.id), `${what}: its result part exists`);
}
generator.reset();
generator.update({speed: 0});
t.ok(generator.playback.blocked() && !generator.playback.complete(), 'a shaft that is not turning blocks its own playback');
generator.advance(1e4);
t.near(generator.getState().clock, 0, 1e-15, 'and its clock never moves');

const released = [
  checkDisposal((() => { const fresh = GM.createGeneratorModel(); fresh.advance(2); return fresh; })(), t),
  checkDisposal((() => { const fresh = TM.createTransformerModel(); fresh.advance(2); return fresh; })(), t),
  checkDisposal((() => { const fresh = LM.createLineModel(); fresh.advance(2); return fresh; })(), t),
];
generator.dispose();
transformer.dispose();
lineModel.dispose();

console.log(`PASS grid: ${t.count} checks, ${counts.poses} poses, ${counts.turns} drawn turns read back, ${counts.discs} discs, ${counts.points} chart and span points, ${counts.steps} derivatives taken, ${counts.integrals} integration points, ${counts.numbers} quoted numbers traced, 12 lessons, ${released.join(', ')} resources released exactly once.`);

// Checks the three thermostats, their shared physics and their lessons against
// the sources typed in again and the physics worked out by other routes: the
// bimetal's curvature rebuilt from Timoshenko's full formula instead of
// Villarceau's short one, its switching band rebuilt from the overtravel and
// the tip's movement a degree, the differential expansion of tube and rod
// rebuilt from raw coefficients, the rod's shut point rebuilt from the valve's
// travel and its linkage, the wax's stroke rebuilt from volume over area, each
// regulating loop's resting place found by bisecting its own heat balance
// instead of by marching, and every drawn strip, tube, piston, valve and curve
// read back at swept settings and times.
import assert from 'node:assert/strict';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './thermostat-physics.js';
import * as BM from './bimetal-thermostat-model.js';
import * as RM from './rod-thermostat-model.js';
import * as WM from './wax-thermostat-model.js';
import * as L from './thermostat-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {createHeatingModel} from './heating-models.js';
import {previewEntryIds} from './published-catalog.js';

const t = tally();
const counts = {steps: 0, plans: 0, poses: 0, points: 0, numbers: 0, solves: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2);
const drawn = 2e-6;

/** The x where an increasing `fn` crosses zero, by bisection. */
function bisect(fn, lo, hi, steps = 200) {
  let a = lo, b = hi;
  for (let i = 0; i < steps; i++) { const mid = (a + b) / 2; if (fn(mid) > 0) b = mid; else a = mid; }
  counts.solves++;
  return (a + b) / 2;
}
const pointsOf = object => {
  // A flat rectangle keeps its unit square whatever size it is drawn at, so reading
  // its vertices measures the placeholder; those are measured by scale instead.
  assert.ok(!object.isMesh, 'pointsOf reads a line, not a drawn rectangle');
  const array = object.geometry.attributes.position.array, out = [];
  for (let i = 0; i < array.length; i += 3) out.push([array[i], array[i + 1], array[i + 2]]);
  counts.points += out.length;
  return out;
};

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and the physics by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  // Wikipedia: Thermal expansion, and the Engineering ToolBox table for company.
  expansion: {brass: 19e-6, iron: 11.8e-6, carbonSteel: 10.8e-6, steel: [11.0e-6, 13.0e-6], copper: 17e-6, invar: 1.2e-6, aluminum: 23.1e-6},
  expansionOther: {brass: [18e-6, 19e-6], ironForged: 11.3e-6, ironPure: 12.0e-6, steel: [10.8e-6, 12.5e-6], copper: [16e-6, 16.7e-6], invar: 1.5e-6},
  // Wikipedia: Young's modulus, and Brass.
  modulus: {brass: 106e9, wroughtIron: 193e9, steel: 200e9, copper: 110e9},
  brass: {density: [8400, 8730], melting: [900, 940]},
  // Wikipedia: Wax motor, Wax thermostatic element, Paraffin wax.
  wax: {
    growth: [0.05, 0.20], bias: [0.20, 0.30],
    paraffinMelting: [46, 68], paraffinDensity: 900,
    automotive: [70, 90], modernEngine: 80, halfStroke: 0.5,
    strokes: [1.5, 16], range: [-15, 120],
    patent: 2115501, patentFiled: 1934, patentIssued: 1938,
  },
  // Wikipedia: Orifice plate, and the Ideal Vogue sheet's gas supply.
  orifice: {discharge: [0.6, 0.85], supply: 2000, supplyMbar: 20},
  gas: {density: 0.657, densityAt: 25, calorific: 38.7e6},
  coolant: {density: 1000, heat: 4184},
  // Wikipedia: Bimetallic strip, for the formula and who published it.
  villarceau: {year: 1863},
  // Drawn sizes typed in again, so a mutated model constant cannot move both sides of a test.
  drawn: {
    stripLength: 50, stripThickness: 0.6, segments: 28, bendTimes: 12, mmBimetal: 0.01,
    tubeLength: 200, moveTimes: 200, mmRod: 0.004,
    capsuleAcross: 18, pistonBore: 4, mmWax: 0.02,
    slower: 120,
  },
};

assert.deepEqual(JSON.parse(JSON.stringify(P.EXPANSION)), SRC.expansion);
assert.deepEqual(JSON.parse(JSON.stringify(P.EXPANSION_OTHER)), SRC.expansionOther);
assert.deepEqual(JSON.parse(JSON.stringify(P.MODULUS)), SRC.modulus);
assert.deepEqual(JSON.parse(JSON.stringify(P.BRASS)), SRC.brass);
assert.deepEqual(JSON.parse(JSON.stringify(P.WAX)), SRC.wax);
assert.deepEqual(JSON.parse(JSON.stringify(P.ORIFICE)), SRC.orifice);
assert.deepEqual(JSON.parse(JSON.stringify(P.GAS)), SRC.gas);
assert.deepEqual(JSON.parse(JSON.stringify(P.COOLANT)), SRC.coolant);
t.add(8);

// Every expansion coefficient sits inside the company the other table keeps.
t.ok(SRC.expansion.brass >= SRC.expansionOther.brass[0] && SRC.expansion.brass <= SRC.expansionOther.brass[1], 'brass expands as both tables say');
t.ok(SRC.expansion.iron > SRC.expansionOther.ironForged && SRC.expansion.iron < SRC.expansionOther.ironPure, 'the iron taken lies between forged and pure');
t.ok(SRC.expansion.carbonSteel >= SRC.expansionOther.steel[0] && SRC.expansion.carbonSteel <= SRC.expansionOther.steel[1], 'and carbon steel inside the steel spread');
t.ok(SRC.expansion.brass > SRC.expansion.iron && SRC.expansion.iron > SRC.expansion.carbonSteel && SRC.expansion.invar < SRC.expansion.carbonSteel / 5,
  'brass outgrows iron, iron outgrows carbon steel, and invar hardly grows at all');

// --- The bimetal, by Timoshenko instead of Villarceau ------------------------
{
  // Villarceau's a, for two layers of equal thickness, is 1 + (E1 − E2)²/(16 E1 E2);
  // put that into 3/(2a) and the whole thing collapses to Timoshenko's curvature,
  // 6 Δα ΔT (1 + m)² / (h[3(1 + m)² + (1 + mn)(m² + 1/(mn))]), at m = 1. The two
  // formulas are derived differently and must agree to the last bit.
  const h = P.DECLARED.stripThickness, m = 1, n = SRC.modulus.brass / SRC.modulus.wroughtIron;
  const dAlpha = SRC.expansion.brass - SRC.expansion.iron;
  for (const celsius of [-20, 0, 10, 20, 20.5, 35, 60, 120]) {
    const dT = celsius - P.DECLARED.stripAt;
    const timoshenko = 6 * dAlpha * dT * (1 + m) ** 2 / (h * (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n))));
    t.near(P.curvatureAt(celsius), timoshenko, 1e-12, `the curvature at ${f0(celsius)} °C is the same by Timoshenko as by Villarceau`);
    // And the same again by hand, straight off the page's own statement of it.
    const a = 1 + (SRC.modulus.brass - SRC.modulus.wroughtIron) ** 2 / (16 * SRC.modulus.brass * SRC.modulus.wroughtIron);
    t.near(P.curvatureAt(celsius), 3 / (2 * a) * dAlpha * dT / h, 1e-12, 'and by the formula as the page writes it');
  }
  t.ok(P.villarceauA(SRC.modulus.brass, 1e-3, SRC.modulus.brass, 1e-3) === 1, 'two layers of the same metal recover the textbook three halves exactly');
  t.ok(P.villarceauA(SRC.modulus.brass, 3e-4, SRC.modulus.wroughtIron, 3e-4) > 1, 'and two different metals need more than that');
  t.near(P.curvatureAt(P.DECLARED.stripAt), 0, 1e-15, 'the strip is flat where it was made flat');
  t.ok(P.curvatureAt(60) > 0 && P.curvatureAt(0) < 0, 'it curls one way warmed and the other way cooled');
  // The tip of a cantilever, and its movement a degree.
  const perDegree = P.stripTipAt(P.DECLARED.stripAt + 1) - P.stripTipAt(P.DECLARED.stripAt);
  t.near(P.stripTipAt(60), P.curvatureAt(60) * P.DECLARED.stripLength ** 2 / 2, 1e-18, 'the tip stands at half the curvature times the length squared');
  t.near(perDegree, 3 / (2 * P.villarceauA(SRC.modulus.brass, P.DECLARED.stripThickness / 2, SRC.modulus.wroughtIron, P.DECLARED.stripThickness / 2))
    * dAlpha / P.DECLARED.stripThickness * P.DECLARED.stripLength ** 2 / 2, 1e-18, 'and moves that far for each degree');
  t.ok(P.temperatureForTip(P.stripTipAt(37)) - 37 < 1e-9, 'and the temperature for a tip position inverts it');
}

// --- The bimetal's band, and the room it keeps -------------------------------
{
  const perDegree = P.stripTipAt(P.DECLARED.stripAt + 1) - P.stripTipAt(P.DECLARED.stripAt);
  for (const setting of [10, 14, 20, 23, 26]) {
    const plan = P.bimetalPlan({setting});
    counts.plans++;
    t.near(plan.band, P.DECLARED.snap / perDegree, 1e-9, `the band at ${f0(setting)} °C is the overtravel divided by how far the tip moves a degree`);
    t.near(plan.opensAt, setting, 1e-12, 'the contacts part exactly at the setting');
    t.near(plan.closesAt, setting - plan.band, 1e-9, 'and meet again one band below it');
    t.near(plan.tipAtOpen - plan.tipAtClose, P.DECLARED.snap, 1e-15, 'which is the overtravel, measured at the tip');
    t.near(plan.capacity, 1.2041 * P.DECLARED.roomVolume * 1012 * P.DECLARED.roomFurnishings, 1e-9, 'the room holds its air times its furnishings');
    t.near(plan.needed, P.DECLARED.roomLoss * (setting - plan.values.outdoor), 1e-12, 'and needs its loss times the difference it stands above outside');
  }
  // The loop really cycles, which is what the room-and-heater run was added for.
  const plan = P.bimetalPlan({});
  t.ok(plan.holds && plan.switches >= 2, `the default room cycles, ${plan.switches} times in the run`);
  t.ok(plan.track.some(point => point.on) && plan.track.some(point => !point.on), 'the heater is both on and off during it');
  const crossedUp = plan.track.some((point, i) => i > 0 && point.celsius >= plan.opensAt && plan.track[i - 1].celsius < plan.opensAt);
  const crossedDown = plan.track.some((point, i) => i > 0 && point.celsius <= plan.closesAt && plan.track[i - 1].celsius > plan.closesAt);
  t.ok(crossedUp && crossedDown, 'and the room crosses the band in both directions');
  t.ok(plan.track.every(point => point.on || point.celsius > plan.closesAt - 1), 'it is never left off far below the band');
  // Marched again by hand, one step at a time, with the switching done here.
  let celsius = plan.values.start, on = true, switches = 0;
  for (let step = 1; step * P.DECLARED.step <= P.DECLARED.roomRun + 1e-9; step++) {
    const heat = on ? plan.values.power : 0;
    const next = celsius + (heat - P.DECLARED.roomLoss * (celsius - plan.values.outdoor)) * P.DECLARED.step / plan.capacity;
    const was = on;
    if (on && next >= plan.opensAt) on = false; else if (!on && next <= plan.closesAt) on = true;
    if (on !== was) switches++;
    celsius = next;
    counts.steps++;
  }
  t.near(celsius, plan.settled.celsius, 1e-9, 'marching the room again by hand lands where the model left it');
  t.ok(switches === plan.switches, `and counts the same ${plan.switches} switches`);
  // A heater too small for the weather can never part the contacts.
  const small = P.bimetalPlan({power: 500});
  counts.plans++;
  t.ok(!small.holds && small.switches === 0, 'too small a heater never parts the contacts at all');
  t.near(small.settled.celsius, small.values.outdoor + small.values.power / P.DECLARED.roomLoss, 0.2, 'and the room stalls where its losses balance the heater');
  // The duty cycle is what the room needs over what the heater gives.
  for (const values of [{}, {setting: 24}, {outdoor: -10}, {power: 3000}]) {
    const it = P.bimetalPlan(values);
    counts.plans++;
    t.near(it.dutyCycle, P.DECLARED.roomLoss * (it.values.setting - it.values.outdoor) / it.values.power, 1e-12, 'the duty cycle is the need over the supply');
  }
}
checkRefusals(P.sampleBimetal, P.BIMETAL_DOMAINS, t);

// --- The rod, its valve and the oven -----------------------------------------
{
  for (const celsius of [0, 20, 100, 200, 300]) {
    t.near(P.differentialAt(celsius), P.DECLARED.rodLength * (SRC.expansion.brass - SRC.expansion.carbonSteel) * (celsius - P.DECLARED.rodAt), 1e-15,
      `the tube outgrows the rod by length times the mismatch at ${f0(celsius)} °C`);
    // The same by growing each metal separately and subtracting, which is what it is.
    const tube = P.DECLARED.rodLength * (1 + SRC.expansion.brass * (celsius - P.DECLARED.rodAt));
    const rod = P.DECLARED.rodLength * (1 + SRC.expansion.carbonSteel * (celsius - P.DECLARED.rodAt));
    t.near(P.differentialAt(celsius), tube - rod, 1e-15, 'and it is simply one length less the other');
  }
  t.near(P.differentialAt(1, P.DECLARED.rodLength, 0), P.DECLARED.rodLength * (SRC.expansion.brass - SRC.expansion.carbonSteel), 1e-18, 'a degree of it is the mismatch over the length');
  for (const values of [{}, {setting: 120}, {setting: 260}, {supply: 10}, {bypass: 0}, {start: 60}]) {
    const plan = P.rodPlan(values);
    counts.plans++;
    const band = P.DECLARED.valveTravel / (P.DECLARED.lever * P.DECLARED.rodLength * (SRC.expansion.brass - SRC.expansion.carbonSteel));
    t.near(plan.shutsAt, plan.values.setting + band / 2, 1e-9, 'the valve shuts half a band above the setting');
    t.near(P.valveOpenAt(plan.values.setting - band / 2, plan.values.setting), 1, 1e-9, 'and is wide open half a band below it');
    t.near(P.valveOpenAt(plan.values.setting, plan.values.setting), 0.5, 1e-9, 'so the setting itself sits in the middle of the band');
    t.ok(P.valveOpenAt(plan.shutsAt + 1, plan.values.setting) === 0, 'past the top of the band it is shut');
    // The orifice equation, by hand.
    const area = Math.PI * (P.DECLARED.valveBore / 2) ** 2;
    t.near(plan.mainArea, area, 1e-18, 'the seat is its bore');
    t.near(plan.fullFlow, SRC.orifice.discharge[0] * area * Math.sqrt(2 * plan.values.supply * 100 / SRC.gas.density), 1e-15, 'and passes what the orifice equation says');
    t.near(plan.fullPower, plan.fullFlow * SRC.gas.calorific * P.DECLARED.burnerEfficiency, 1e-9, 'which is that much gas burned at the stated efficiency');
    t.ok(plan.bypassFlow > 0 === Boolean(plan.values.bypass), 'the bypass flows only when it is fitted');
    // Where it comes to rest, by bisecting the oven's own balance instead of marching.
    const flowAt = celsius => P.throughOrifice(area * P.valveOpenAt(celsius, plan.values.setting), plan.values.supply * 100, SRC.gas.density)
      + P.throughOrifice(plan.bypassArea, plan.values.supply * 100, SRC.gas.density);
    const surplus = celsius => P.DECLARED.ovenLoss * (celsius - P.DECLARED.ovenAmbient) - flowAt(celsius) * SRC.gas.calorific * P.DECLARED.burnerEfficiency;
    const rest = bisect(surplus, P.DECLARED.ovenAmbient, 600);
    t.near(plan.settled.celsius, rest, 0.6, `the oven rests where its balance says, ${f1(rest)} °C`);
    t.ok(plan.holds, 'and that is within ten degrees of the setting it was asked for');
    t.ok(plan.settled.celsius > plan.values.setting, 'a proportional valve rests above its setting, never on it');
    t.ok(plan.settled.celsius < plan.shutsAt, 'but below the point that would shut it completely');
    const open = P.valveOpenAt(plan.settled.celsius, plan.values.setting);
    t.ok(open > 0 && open < 0.15, `and holds it on a small opening, ${f1(100 * open)}%, because the burner is far larger than the oven's loss`);
  }
  // Without a bypass a valve that shut completely would put the flame out.
  t.ok(P.rodPlan({bypass: 0}).bypassFlow === 0 && P.rodPlan({bypass: 1}).bypassFlow > 0, 'the bypass is the only thing flowing when the main valve is shut');
  t.ok(P.throughOrifice(0, 2000, SRC.gas.density) === 0 && P.throughOrifice(-1, 2000, SRC.gas.density) === 0, 'nothing gets through nothing');
  // More pressure is more gas, as the square root of it.
  const low = P.rodPlan({supply: 10}), high = P.rodPlan({supply: 25});
  counts.plans += 2;
  t.near(high.fullFlow / low.fullFlow, Math.sqrt(25 / 10), 1e-12, 'flow follows the square root of the pressure');
  t.ok(Math.abs(high.settled.celsius - low.settled.celsius) < 2, 'but a starved supply shows up as a slow oven, not a cool one');
  t.ok(low.reached > high.reached, 'it simply takes longer to get there');
}
checkRefusals(P.sampleRod, P.ROD_DOMAINS, t);

// --- The wax, its piston and the engine --------------------------------------
{
  t.ok(P.meltedAt(P.DECLARED.meltFrom) === 0 && P.meltedAt(P.DECLARED.meltTo) === 1, 'the wax is unmelted at the bottom of its range and melted at the top');
  t.ok(P.meltedAt(P.DECLARED.meltFrom - 40) === 0 && P.meltedAt(P.DECLARED.meltTo + 40) === 1, 'and stays that way outside it');
  t.near(P.meltedAt((P.DECLARED.meltFrom + P.DECLARED.meltTo) / 2), 0.5, 1e-12, 'with half of it gone halfway across');
  for (const growth of [0.05, 0.12, 0.20]) {
    const area = Math.PI * (P.DECLARED.pistonBore / 2) ** 2;
    t.near(P.pistonAt(P.DECLARED.meltTo, growth), P.DECLARED.pelletVolume * growth / area, 1e-18, `a wax growing ${f0(100 * growth)} percent pushes its volume over the piston's area`);
    t.ok(P.pistonAt(P.DECLARED.meltFrom, growth) === 0, 'and pushes nothing at all before it melts');
    const stroke = 1000 * P.pistonAt(P.DECLARED.meltTo, growth);
    t.ok(stroke >= SRC.wax.strokes[0] && stroke <= SRC.wax.strokes[1], `its ${f2(stroke)} mm stroke is a size the page gives, between ${f1(SRC.wax.strokes[0])} and ${f0(SRC.wax.strokes[1])} mm`);
  }
  t.ok(P.DECLARED.meltFrom >= SRC.wax.automotive[0] && P.DECLARED.meltTo <= SRC.wax.automotive[1] + 5, 'the melting range is where automotive elements are made to work');
  t.ok(P.DECLARED.meltFrom > SRC.wax.modernEngine, 'and above the temperature a modern engine is meant to run over');
  t.ok(P.DECLARED.meltFrom > SRC.wax.paraffinMelting[1], 'a thermostat wax melts higher than ordinary paraffin, and far more narrowly');
  t.ok(P.DECLARED.meltTo - P.DECLARED.meltFrom < (SRC.wax.paraffinMelting[1] - SRC.wax.paraffinMelting[0]) / 1.5, 'which is the whole point of blending it');
  for (const values of [{}, {growth: 5}, {growth: 20}, {load: 4}, {load: 30}, {ambient: -10}, {ambient: 40}]) {
    const plan = P.waxPlan(values);
    counts.plans++;
    t.near(plan.power, plan.values.load * 1000, 1e-12, 'the load is what the engine puts into its coolant');
    t.near(plan.fullStroke, P.pistonAt(P.DECLARED.meltTo, plan.values.growth / 100), 1e-18, 'the full stroke is the piston at full melt');
    t.ok(plan.strokeAtOpen === 0, 'and nothing has moved at the temperature it starts melting');
    t.ok(plan.withinStrokes && plan.withinRange, 'the element is a real size working over a real range');
    t.ok(plan.boils === (plan.settled.celsius >= 100), 'the boiling flag is exactly the engine having passed 100 °C');
    // Where it comes to rest, by bisecting the engine's balance instead of marching.
    const surplus = celsius => P.DECLARED.radiatorLoss * P.coolantOpenAt(celsius, plan.values.growth) * (celsius - plan.values.ambient)
      + 12 * (celsius - plan.values.ambient) - plan.power;
    const rest = bisect(surplus, plan.values.ambient, 400);
    const rate = (plan.track.at(-1).celsius - plan.track.at(-2).celsius) / P.DECLARED.step;
    t.ok(plan.climbing === (rate > 0.001), 'the climbing flag is exactly the engine still rising as the run ends');
    if (plan.climbing) {
      t.ok(plan.settled.celsius < rest - 0.5, `this setting has no resting place inside the run: ${f1(plan.settled.celsius)} °C at the end against a balance of ${f1(rest)} °C`);
      t.ok(rate > 0, 'and the engine is still on its way up');
    } else {
      t.near(plan.settled.celsius, rest, 0.6, `the engine rests where its balance says, ${f1(rest)} °C`);
    }
    counts.solves++;
  }
  // The valve sits about halfway along its travel in normal running, as its page says.
  const plan = P.waxPlan({});
  t.ok(plan.halfOpen, 'in normal running the valve sits near half its stroke, with room either way');
  t.ok(!plan.boils, 'and a properly cooled engine never reaches boiling at all');
  t.ok(plan.settled.celsius > P.DECLARED.meltFrom && plan.settled.celsius < P.DECLARED.meltTo, 'and the engine settles inside the melting range');
  t.ok(plan.opened !== null && plan.opened > 0, 'the valve is shut for a while at the start, which is how an engine warms quickly');
  const cold = P.waxPlan({load: 4});
  t.ok(cold.opened === null && cold.settled.open === 0, 'and at a light enough load it never opens at all');
  t.ok(cold.settled.celsius < P.DECLARED.meltFrom, 'because the engine never reaches the melting range inside this run');
  t.ok(cold.climbing, 'though it is still warming when the run ends, and given long enough it would reach it');
  const hard = P.waxPlan({load: 30});
  t.ok(hard.settled.open > plan.settled.open && hard.settled.celsius > plan.settled.celsius, 'worked harder it opens further and still runs hotter');
  const freer = P.waxPlan({growth: 20}), meaner = P.waxPlan({growth: 5});
  counts.plans += 4;
  t.ok(freer.settled.celsius < plan.settled.celsius && plan.settled.celsius < meaner.settled.celsius, 'a wax that grows more holds the engine cooler');
  t.ok(freer.fullStroke > plan.fullStroke && plan.fullStroke > meaner.fullStroke, 'because it pushes the piston further for the same melting');
  t.ok(meaner.boils && hard.boils && !freer.boils, 'a wax that hardly grows and a heavy load both drive the engine past boiling, a freer wax does not');
  // The spring is a share of what the wax can push, as its page says.
  const at = P.sampleWax({}, P.DECLARED.engineRun);
  t.near(at.spring, P.DECLARED.springRate * at.stroke, 1e-9, 'the spring pushes back in proportion to how far it is compressed');
  t.ok(at.toRadiator <= P.DECLARED.pumpFlow && at.toRadiator > 0, 'and the coolant to the radiator is the share of the pump the valve lets by');
  t.ok(P.sampleWax({}, 0).toRadiator === 0, 'with none of it going there while the valve is shut');
}
checkRefusals(P.sampleWax, P.WAX_DOMAINS, t);

// ---------------------------------------------------------------------------
// 2. The drawing, read back from the scene.
// ---------------------------------------------------------------------------

const bimetal = BM.createBimetalThermostatModel(), BT = bimetal.topology;
const rod = RM.createRodThermostatModel(), RT = rod.topology;
const wax = WM.createWaxThermostatModel(), WT = wax.topology;

const poseOf = model => (values, runSeconds) => {
  model.reset();
  if (values) model.update(values);
  model.advance(runSeconds / P.DECLARED.slower);
  model.root.updateMatrixWorld(true);
  counts.poses++;
  return model.getState();
};
const poseBimetal = poseOf(bimetal), poseRod = poseOf(rod), poseWax = poseOf(wax);

// --- The strip is drawn its true length, and its bend magnified --------------
{
  const cold = poseBimetal({start: 5}, 0), coldTip = pointsOf(BT.spine).at(-1);
  const warm = poseBimetal({start: 25}, 0), warmTip = pointsOf(BT.spine).at(-1);
  t.near(cold.now.celsius, 5, 1e-9, 'at the start of the run the room is where it was started');
  t.near(warm.now.celsius, 25, 1e-9, 'at either setting');
  const spine = pointsOf(BT.spine);
  t.ok(spine.length === SRC.drawn.segments + 1, `the strip is drawn in ${f0(SRC.drawn.segments)} pieces, as one part`);
  // The strip is bent, and drawn bent twelve times over, so its chord is shorter than
  // it is. What cannot change is its length along itself: metal bends, it does not stretch.
  const arcOf = points => points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0);
  t.near(arcOf(spine), SRC.drawn.stripLength * SRC.drawn.mmBimetal, 2e-5, `and is drawn its true ${f0(SRC.drawn.stripLength)} mm long, measured along the strip`);
  // The ratio kills the convention: however the bend is signed, the drawn movement
  // must be the real movement times the magnification and the millimeter scale.
  const drawnMove = warmTip[1] - coldTip[1];
  const realMove = P.stripTipAt(25) - P.stripTipAt(5);
  t.near(drawnMove / realMove, 1000 * SRC.drawn.mmBimetal * SRC.drawn.bendTimes, 1e-4,
    `the bend is drawn exactly ${f0(SRC.drawn.bendTimes)} times larger than it is`);
  t.ok(Math.abs(drawnMove) > 1e-4, 'and it is large enough to see at all');
  {
    const flat = poseBimetal({start: P.DECLARED.stripAt}, 0), flatSpine = pointsOf(BT.spine);
    t.near(flat.now.celsius, P.DECLARED.stripAt, 1e-9, 'posed at the temperature the strip was made flat');
    t.near(Math.abs(flatSpine.at(-1)[0] - flatSpine[0][0]), SRC.drawn.stripLength * SRC.drawn.mmBimetal, drawn, 'it reaches straight across its whole length');
    t.near(flatSpine.at(-1)[1] - flatSpine[0][1], 0, 1e-12, 'with no bend in it at all');
    for (const start of [5, 15, 25]) {
      poseBimetal({start}, 0);
      t.near(arcOf(pointsOf(BT.spine)), SRC.drawn.stripLength * SRC.drawn.mmBimetal, 2e-5, `and keeps that length bent at ${f0(start)} °C`);
    }
  }
  t.ok(BT.brassFace.length === SRC.drawn.segments && BT.ironFace.length === SRC.drawn.segments, 'both metals are drawn along the whole length');
  t.ok(bimetal.parts.filter(item => item.name === 'Bonded bimetal strip').length === 1, 'the strip is one part, not one for each piece');
  t.ok(bimetal.parts.length === 6, 'and there are six parts in all, not thirty');
}
// --- The contacts say what the model says ------------------------------------
{
  const on = poseBimetal({}, 0);
  t.ok(on.now.on && BT.spark.visible, 'closed, the contacts are drawn carrying current');
  let parted = null;
  for (let time = 0; time <= P.DECLARED.roomRun; time += 60) {
    const state = poseBimetal({}, time);
    t.ok(BT.spark.visible === state.now.on, `at ${f0(time)} s the drawn contact agrees with the model`);
    if (!state.now.on && parted === null) parted = state.now.celsius;
  }
  t.ok(parted !== null && parted >= P.bimetalPlan({}).closesAt, 'and they are drawn parted only at or above the bottom of the band');
}
// --- The tube and rod, drawn true, with their difference magnified ------------
{
  const cold = poseRod({start: 15}, 0), coldMove = RT.move.position.x;
  const warm = poseRod({start: 60}, 0), warmMove = RT.move.position.x;
  t.near(cold.now.celsius, 15, 1e-9, 'the oven starts where it was started');
  // The tube is drawn cut open, as its two walls. Each is a flat rectangle, so
  // its drawn length is its scale and not its geometry, which stays a unit square.
  const walls = [RT.tubeWall[0], RT.tubeWall[1]];
  for (const wall of walls) t.near(wall.scale.x, SRC.drawn.tubeLength * SRC.drawn.mmRod, drawn, `the tube is drawn its true ${f0(SRC.drawn.tubeLength)} mm long`);
  t.near(walls[0].position.x, walls[1].position.x, 1e-12, 'and both its walls start and end together');
  const drawnMove = warmMove - coldMove;
  const realMove = P.differentialAt(60) - P.differentialAt(15);
  t.near(Math.abs(drawnMove / realMove), 1000 * SRC.drawn.mmRod * SRC.drawn.moveTimes, 1e-4,
    `and the movement between them exactly ${f0(SRC.drawn.moveTimes)} times larger`);
  t.ok(realMove > 0 && drawnMove < 0, 'the warmer oven grows the tube past the rod, which pulls the rod end back toward the valve');
}
// --- The valve, the bypass and the burner ------------------------------------
{
  for (const time of [0, 300, 900, 2400]) {
    const state = poseRod({}, time);
    t.ok(RT.flames.children.length > 0 || RT.flames.visible !== undefined, 'the burner has flames to show');
    t.ok(state.now.open >= 0 && state.now.open <= 1, `at ${f0(time)} s the valve is somewhere between shut and open`);
  }
  const lit = poseRod({}, 0), late = poseRod({}, P.DECLARED.ovenRun);
  t.ok(lit.now.open > late.now.open, 'the valve closes as the oven arrives');
  t.ok(RT.bypassHole.visible, 'the bypass is drawn when it is fitted');
  poseRod({bypass: 0}, 0);
  t.ok(!RT.bypassHole.visible, 'and not drawn when it is not');
}
// --- The wax element, drawn at true size throughout ---------------------------
{
  // The capsule is a flat rectangle, so how far across it is drawn is its scale.
  t.near(WT.shell.scale.x, SRC.drawn.capsuleAcross * SRC.drawn.mmWax, drawn, `the capsule is drawn its true ${f0(SRC.drawn.capsuleAcross)} mm across`);
  // The piston stands in the capsule's mouth and is pushed out by growing, so
  // how far it has travelled is how much taller its rod is drawn.
  const shut = poseWax({}, 0), shutOut = WT.rod.scale.y, shutArrow = WT.travel.userData.length;
  const open = poseWax({}, P.DECLARED.engineRun), openOut = WT.rod.scale.y, openArrow = WT.travel.userData.length;
  t.ok(open.now.stroke > shut.now.stroke, 'the piston is further out once the wax has melted');
  t.ok(openOut > shutOut, 'and drawn further out with it');
  t.near((openOut - shutOut) / (open.now.stroke - shut.now.stroke), 1000 * SRC.drawn.mmWax, 1e-4,
    'and the piston is drawn at true size, with nothing magnified at all');
  for (const [state, arrow] of [[shut, shutArrow], [open, openArrow]]) {
    t.near(arrow, 1000 * state.now.stroke * SRC.drawn.mmWax, 1e-9, 'the travel arrow is exactly the stroke long, on the same true scale');
  }
  t.ok(WT.spring !== undefined && WT.springCoil !== undefined, 'the return spring is its own part, drawn');
  t.ok(wax.parts.some(item => item.id === 'spring' && item.name === 'Return spring'), 'and named as one');
  t.ok(open.now.toRadiator > 0 && WT.toRadiator.userData.length > 0, 'coolant reaching the radiator is drawn as an arrow');
  t.ok(poseWax({load: 4}, P.DECLARED.engineRun).now.toRadiator === 0 && WT.toRadiator.userData.length === 0, 'and no arrow at all when the valve never opens');
}
// Nothing anywhere is left infinite, at any setting or time.
const bimetalSettings = [{}, {setting: 10}, {setting: 26}, {outdoor: -10}, {outdoor: 15}, {power: 500}, {power: 3000}, {start: 5}, {start: 25}];
const rodSettings = [{}, {setting: 120}, {setting: 260}, {start: 15}, {start: 60}, {supply: 10}, {supply: 25}, {bypass: 0}];
const waxSettings = [{}, {growth: 5}, {growth: 20}, {load: 4}, {load: 30}, {ambient: -10}, {ambient: 40}, {start: -10}, {start: 40}];
for (const [pose, settings] of [[poseBimetal, bimetalSettings], [poseRod, rodSettings], [poseWax, waxSettings]]) {
  for (const values of settings) for (const time of [0, 60, 600, 1e5]) pose(values, time);
}
for (const model of [bimetal, rod, wax]) checkFinite(model.root, t);

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

const perDegree = P.stripTipAt(P.DECLARED.stripAt + 1) - P.stripTipAt(P.DECLARED.stripAt);
const bimetalDefault = P.bimetalPlan({}), bimetalWarm = P.bimetalPlan({setting: 24});
const bimetalCold = P.bimetalPlan({outdoor: -10}), bimetalSmall = P.bimetalPlan({power: 500}), bimetalBig = P.bimetalPlan({power: 3000});
checkTrialNumbers(L.bimetalThermostatLesson, {
  'Switch the heating on': s => ({[`${s.switches}`]: s.switches, 41: 100 * s.dutyCycle}),
  'Watch the band, not the setting': s => ({'20.0': s.opensAt, '19.1': s.closesAt, '0.91': s.band}),
  'Ask for more': s => ({52: 100 * s.dutyCycle, 41: 100 * bimetalDefault.dutyCycle, 12: s.switches, 15: bimetalDefault.switches}),
  'A cold night': s => ({'1,650': s.needed, 83: 100 * s.dutyCycle, 5: s.switches}),
  'Too small a heater': s => ({'14.1': s.settled.celsius}),
  'Too large a heater': s => ({21: s.switches, 28: 100 * s.dutyCycle}),
  'How far it actually bends': () => ({'22.0': 1e6 * perDegree, 20: 1e6 * P.DECLARED.snap}),
}, values => P.bimetalPlan(values), t);

const rodDefault = P.rodPlan({}), rodCool = P.rodPlan({setting: 120}), rodHot = P.rodPlan({setting: 260});
const rodWeak = P.rodPlan({supply: 10}), rodBare = P.rodPlan({bypass: 0});
checkTrialNumbers(L.rodThermostatLesson, {
  'Light the oven': s => ({'13.9': s.reached / 60, '207.0': s.settled.celsius}),
  'Watch the valve, not a switch': s => ({'207.6': s.shutsAt}),
  'How little the metals differ': s => ({19: 1e6 * P.EXPANSION.brass, '10.8': 1e6 * P.EXPANSION.carbonSteel, '1.64': 1e6 * s.differentialPerDegree, '0.15': 1000 * P.DECLARED.valveTravel}),
  'A cooler oven': s => ({'7.7': s.reached / 60, '127.4': s.settled.celsius}),
  'A hotter oven': s => ({'18.6': s.reached / 60, '266.8': s.settled.celsius}),
  'Weaker gas': s => ({'6,538': s.fullPower, '9,247': rodDefault.fullPower, '19.9': s.reached / 60}),
  'Take the bypass away': s => ({'206.8': s.settled.celsius}),
}, values => P.rodPlan(values), t);

const waxDefault = P.waxPlan({}), waxMean = P.waxPlan({growth: 5}), waxFree = P.waxPlan({growth: 20});
const waxIdle = P.waxPlan({load: 4}), waxHard = P.waxPlan({load: 30});
checkTrialNumbers(L.waxThermostatLesson, {
  'Start the engine cold': s => ({'6.8': s.opened / 60, '90.0': s.settled.celsius, 59: 100 * s.settled.open}),
  'Watch the wax, not a switch': () => ({}),
  'How far melting pushes it': s => ({900: 1e9 * P.DECLARED.pelletVolume, 12: s.values.growth, 4: 1000 * P.DECLARED.pistonBore, '8.59': 1000 * s.fullStroke}),
  'A wax that hardly grows': s => ({'3.58': 1000 * s.fullStroke, '105.2': s.settled.celsius}),
  'A wax that grows freely': s => ({'14.32': 1000 * s.fullStroke, '87.0': s.settled.celsius}),
  'Idling in the cold': s => ({'57.7': s.settled.celsius}),
  'Working hard': s => ({96: 100 * s.settled.open, '112.0': s.settled.celsius}),
}, values => P.waxPlan(values), t);

for (const lesson of [L.bimetalThermostatLesson, L.rodThermostatLesson, L.waxThermostatLesson]) {
  for (const [where, text] of texts(lesson)) covered(text, {}, `${lesson.simple.slice(0, 20)} ${where}`);
}

// The deeper sections.
covered(L.bimetalThermostatLesson.deeper[0].body, {
  [`expands ${f0(1e6 * P.EXPANSION.brass)} millionths of its length for each degree and iron ${f1(1e6 * P.EXPANSION.iron)}`]: 'expands 19 millionths of its length for each degree and iron 11.8',
  [`only ${f1(1e6 * (P.EXPANSION.brass - P.EXPANSION.iron))} millionths`]: 'only 7.2 millionths',
}, 'bimetal deeper 1');
covered(L.bimetalThermostatLesson.deeper[1].body, {
  [`published in ${SRC.villarceau.year}`]: 'published in 1863',
  [`brass at ${f0(P.MODULUS.brass / 1e9)} GPa and wrought iron at ${f0(P.MODULUS.wroughtIron / 1e9)} GPa, a comes to ${fixed(P.villarceauA(P.MODULUS.brass, P.DECLARED.stripThickness / 2, P.MODULUS.wroughtIron, P.DECLARED.stripThickness / 2), 3)}`]:
    'brass at 106 GPa and wrought iron at 193 GPa, a comes to 1.023',
  [`close to the ${f0(P.villarceauA(P.MODULUS.brass, 1e-3, P.MODULUS.brass, 1e-3))} the page says`]: 'close to the 1 the page says',
}, 'bimetal deeper 2');
covered(L.bimetalThermostatLesson.deeper[2].body, {
  [`this ${f0(1000 * P.DECLARED.stripLength)} mm strip the tip moves ${f1(1e6 * perDegree)} micrometers for each degree`]: 'this 50 mm strip the tip moves 22.0 micrometers for each degree',
}, 'bimetal deeper 3');
covered(L.bimetalThermostatLesson.deeper[3].body, {
  [`${f0(1e6 * P.DECLARED.snap)} micrometers of it here, which at ${f1(1e6 * perDegree)} micrometers a degree is a band of ${f2(bimetalDefault.band)} °C`]:
    '20 micrometers of it here, which at 22.0 micrometers a degree is a band of 0.91 °C',
}, 'bimetal deeper 4');
covered(L.bimetalThermostatLesson.deeper[4].body, {
  [`Ask for ${f0(bimetalWarm.values.setting)} °C instead of ${f0(bimetalDefault.values.setting)} °C against the same weather and the heater has to run ${f0(100 * bimetalWarm.dutyCycle)}% of the time instead of ${f0(100 * bimetalDefault.dutyCycle)}%`]:
    'Ask for 24 °C instead of 20 °C against the same weather and the heater has to run 52% of the time instead of 41%',
  [`drop the outside to ${f0(-bimetalCold.values.outdoor)} below zero and the same setting needs ${f0(100 * bimetalCold.dutyCycle)}%`]:
    'drop the outside to 10 below zero and the same setting needs 83%',
}, 'bimetal deeper 5');
covered(L.bimetalThermostatLesson.deeper[5].body, {
  [`At ${f0(bimetalSmall.values.power)} W this room cannot be held at all: the contacts never part and it stalls at ${f1(bimetalSmall.settled.celsius)} °C. At ${f0(bimetalBig.values.power)} W`]:
    'At 500 W this room cannot be held at all: the contacts never part and it stalls at 14.1 °C. At 3,000 W',
  [`the contacts work ${bimetalBig.switches} times instead of ${bimetalDefault.switches}`]: 'the contacts work 21 times instead of 15',
}, 'bimetal deeper 6');

covered(L.rodThermostatLesson.deeper[0].body, {
  [`A ${f0(1000 * P.DECLARED.rodLength)} mm brass tube grows about ${f1(1000 * P.DECLARED.rodLength * P.EXPANSION.brass * (P.ROD_DEFAULTS.setting - P.DECLARED.rodAt))} millimeters`]:
    'A 200 mm brass tube grows about 0.7 millimeters',
  [`grows about ${f1(1000 * P.DECLARED.rodLength * P.EXPANSION.carbonSteel * (P.ROD_DEFAULTS.setting - P.DECLARED.rodAt))}`]: 'grows about 0.4',
  [`it is the ${f1(1000 * P.differentialAt(P.ROD_DEFAULTS.setting))} or so millimeters of difference`]: 'it is the 0.3 or so millimeters of difference',
  [`per degree that is ${f2(1e6 * rodDefault.differentialPerDegree)} micrometers`]: 'per degree that is 1.64 micrometers',
  [`brass ${f0(1e6 * P.EXPANSION.brass)} millionths a degree and carbon steel ${f1(1e6 * P.EXPANSION.carbonSteel)}`]: 'brass 19 millionths a degree and carbon steel 10.8',
}, 'rod deeper 1');
covered(L.rodThermostatLesson.deeper[2].body, {
  [`between ${f1(P.ORIFICE.discharge[0])} and ${f2(P.ORIFICE.discharge[1])}`]: 'between 0.6 and 0.85',
  [`At ${f0(P.ROD_DEFAULTS.supply)} mbar this seat passes enough gas for ${f0(rodDefault.fullPower)} W`]: 'At 20 mbar this seat passes enough gas for 9,247 W',
  [`at ${f0(rodWeak.values.supply)} mbar only ${f0(rodWeak.fullPower)} W`]: 'at 10 mbar only 6,538 W',
}, 'rod deeper 3');
covered(L.rodThermostatLesson.deeper[3].body, {
  [`${f1(rodDefault.settled.celsius)} °C for a setting of ${f0(rodDefault.values.setting)}`]: '207.0 °C for a setting of 200',
}, 'rod deeper 4');

covered(L.waxThermostatLesson.deeper[0].body, {
  [`by ${f0(100 * P.WAX.growth[0])} to ${f0(100 * P.WAX.growth[1])} percent`]: 'by 5 to 20 percent',
}, 'wax deeper 1');
covered(L.waxThermostatLesson.deeper[1].body, {
  [`between ${f0(P.WAX.paraffinMelting[0])} and ${f0(P.WAX.paraffinMelting[1])} °C`]: 'between 46 and 68 °C',
  [`between ${f0(P.WAX.automotive[0])} and ${f0(P.WAX.automotive[1])} °C`]: 'between 70 and 90 °C',
  [`run over ${f0(P.WAX.modernEngine)} °C`]: 'run over 80 °C',
}, 'wax deeper 2');
covered(L.waxThermostatLesson.deeper[2].body, {
  [`growing ${f0(waxDefault.values.growth)} percent makes about ${f0(1e9 * P.DECLARED.pelletVolume * waxDefault.values.growth / 100)} cubic millimeters`]:
    'growing 12 percent makes about 108 cubic millimeters',
  [`through a ${f0(1000 * P.DECLARED.pistonBore)} mm rod that is ${f2(1000 * waxDefault.fullStroke)} mm of travel`]: 'through a 4 mm rod that is 8.59 mm of travel',
  [`strokes of ${f1(P.WAX.strokes[0])} to ${f0(P.WAX.strokes[1])} mm`]: 'strokes of 1.5 to 16 mm',
}, 'wax deeper 3');
covered(L.waxThermostatLesson.deeper[3].body, {
  [`at ${f0(100 * P.WAX.bias[0])} to ${f0(100 * P.WAX.bias[1])} percent of the operating force`]: 'at 20 to 30 percent of the operating force',
}, 'wax deeper 4');
covered(L.waxThermostatLesson.deeper[4].body, {
  [`shut for the first ${f1(waxDefault.opened / 60)} minutes`]: 'shut for the first 6.8 minutes',
}, 'wax deeper 5');
covered(L.waxThermostatLesson.deeper[5].body, {
  [`${f1(waxDefault.settled.celsius)} °C at ${f0(waxDefault.values.load)} kW, ${f1(waxFree.settled.celsius)} °C with a freer wax, ${f1(waxHard.settled.celsius)} °C worked hard`]:
    '90.0 °C at 14 kW, 87.0 °C with a freer wax, 112.0 °C worked hard',
}, 'wax deeper 6');

// The limits, which are where everything declared has to be admitted.
const sharedLimits = {};
covered(L.thermostatLimits, sharedLimits, 'thermostat limits');
covered(L.bimetalLimits, {
  ...sharedLimits,
  [`brass and iron ${f0(1000 * P.DECLARED.stripLength)} mm long and ${f1(1000 * P.DECLARED.stripThickness)} mm thick`]: 'brass and iron 50 mm long and 0.6 mm thick',
  [`taken as ${f0(1e6 * P.DECLARED.snap)} micrometers`]: 'taken as 20 micrometers',
}, 'bimetal limits');
covered(L.rodLimits, {
  ...sharedLimits,
  [`taken as ${f0(1000 * P.DECLARED.rodLength)} mm of brass`]: 'taken as 200 mm of brass',
  [`multiplies their difference ${f0(P.DECLARED.lever)} times`]: 'multiplies their difference 6 times',
  [`close over ${f2(1000 * P.DECLARED.valveTravel)} mm of travel, which is what turns ${f2(1e6 * rodDefault.differentialPerDegree)} micrometers a degree`]:
    'close over 0.15 mm of travel, which is what turns 1.64 micrometers a degree',
  [`put ${f0(100 * P.DECLARED.burnerEfficiency)} percent of it into the oven`]: 'put 45 percent of it into the oven',
}, 'rod limits');
covered(L.waxLimits, {
  ...sharedLimits,
  [`taken as ${f0(1e9 * P.DECLARED.pelletVolume)} cubic millimeters of wax melting evenly between ${f0(P.DECLARED.meltFrom)} and ${f0(P.DECLARED.meltTo)} °C, driving a ${f0(1000 * P.DECLARED.pistonBore)} mm piston`]:
    'taken as 900 cubic millimeters of wax melting evenly between 82 and 95 °C, driving a 4 mm piston',
}, 'wax limits');
covered(L.bimetalThermostatLesson.limits, {
  [`its bend ${f0(BM.BEND_TIMES)} times larger`]: 'its bend 12 times larger',
  [`covers ${f0(P.DECLARED.roomRun / 60)} minutes and plays ${f0(P.DECLARED.slower)} times faster`]: 'covers 90 minutes and plays 120 times faster',
  [`brass and iron ${f0(1000 * P.DECLARED.stripLength)} mm long and ${f1(1000 * P.DECLARED.stripThickness)} mm thick`]: 'brass and iron 50 mm long and 0.6 mm thick',
  [`taken as ${f0(1e6 * P.DECLARED.snap)} micrometers`]: 'taken as 20 micrometers',
}, 'bimetal lesson limits');
covered(L.rodThermostatLesson.limits, {
  [`between them ${f0(RM.MOVE_TIMES)} times larger`]: 'between them 200 times larger',
  [`covers ${f0(P.DECLARED.ovenRun / 60)} minutes and plays ${f0(P.DECLARED.slower)} times faster`]: 'covers 40 minutes and plays 120 times faster',
  [`taken as ${f0(1000 * P.DECLARED.rodLength)} mm of brass`]: 'taken as 200 mm of brass',
  [`multiplies their difference ${f0(P.DECLARED.lever)} times`]: 'multiplies their difference 6 times',
  [`close over ${f2(1000 * P.DECLARED.valveTravel)} mm of travel, which is what turns ${f2(1e6 * rodDefault.differentialPerDegree)} micrometers a degree`]:
    'close over 0.15 mm of travel, which is what turns 1.64 micrometers a degree',
  [`put ${f0(100 * P.DECLARED.burnerEfficiency)} percent of it into the oven`]: 'put 45 percent of it into the oven',
}, 'rod lesson limits');
covered(L.waxThermostatLesson.limits, {
  [`covers ${f0(P.DECLARED.engineRun / 60)} minutes and plays ${f0(P.DECLARED.slower)} times faster`]: 'covers 15 minutes and plays 120 times faster',
  [`taken as ${f0(1e9 * P.DECLARED.pelletVolume)} cubic millimeters of wax melting evenly between ${f0(P.DECLARED.meltFrom)} and ${f0(P.DECLARED.meltTo)} °C, driving a ${f0(1000 * P.DECLARED.pistonBore)} mm piston`]:
    'taken as 900 cubic millimeters of wax melting evenly between 82 and 95 °C, driving a 4 mm piston',
}, 'wax lesson limits');

// The three lessons are three lessons, not one copied twice. This is the review's
// finding about the rod and wax pages carrying the bimetal page's text verbatim.
{
  const lessons = [L.bimetalThermostatLesson, L.rodThermostatLesson, L.waxThermostatLesson];
  const names = ['bimetal', 'rod', 'wax'];
  for (let i = 0; i < lessons.length; i++) for (let j = i + 1; j < lessons.length; j++) {
    for (const field of ['simple', 'overview', 'misconception', 'limits']) {
      t.ok(lessons[i][field] !== lessons[j][field], `${names[i]} and ${names[j]} do not share their ${field}`);
    }
    t.ok(lessons[i].quiz.question !== lessons[j].quiz.question, `${names[i]} and ${names[j]} ask different questions`);
    t.ok(lessons[i].steps.every((step, k) => step.title !== lessons[j].steps[k].title), `and walk through different steps`);
    t.ok(lessons[i].deeper.every((item, k) => item.title !== lessons[j].deeper[k].title), 'and go deeper in different directions');
  }
  // The rod and wax pages describe their own actuator, not the bimetal one.
  t.ok(!/bimetal/i.test(L.rodThermostatLesson.overview), 'the rod overview never mentions a bimetal strip');
  t.ok(/tube/i.test(L.rodThermostatLesson.overview) && /rod/i.test(L.rodThermostatLesson.overview), 'it names the tube and rod that actually move its valve');
  t.ok(/melt/i.test(L.waxThermostatLesson.overview), 'the wax overview is about melting');
  t.ok(/odd one out/.test(L.waxThermostatLesson.overview), 'and mentions the others only to say wax is the odd one out');
  // The bimetal page keeps its own subject: its deeper sections are about bending,
  // not about the rod, the wax or a gas bypass, which belong to the sibling pages.
  const deeper = L.bimetalThermostatLesson.deeper.map(item => item.title).join(' | ');
  t.ok(/Villarceau/.test(deeper), 'the bimetal page explains the curvature it depends on');
  t.ok(!/wax/i.test(deeper) && !/bypass/i.test(deeper) && !/rod thermostat/i.test(deeper), 'and does not pad itself with its siblings');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

const machines = [
  ['Bimetal thermostat', bimetal, BT, L.bimetalThermostatLesson, P.BIMETAL_DOMAINS, P.BIMETAL_DEFAULTS, 'bimetal-thermostat', bimetalSettings,
    // The bimetal is drawn at the one cut where it shows five components; there is
    // no sixth thing in a snap action room thermostat at this section.
    5,
    () => [BT.spark.visible, pointsOf(BT.spine).slice(0, 20), BT.moving.position.y, BT.post.position.y, BT.pointer.rotation.z, pointsOf(BT.curve).slice(-2)],
    model => model.advance(P.DECLARED.roomRun / P.DECLARED.slower)],
  ['Rod thermostat', rod, RT, L.rodThermostatLesson, P.ROD_DOMAINS, P.ROD_DEFAULTS, 'rod-thermostat', rodSettings, 6,
    () => [RT.move.position.x, RT.plug.position.x, RT.bypassHole.visible, RT.flames.scale.x, pointsOf(RT.curve).slice(-2), pointsOf(RT.openGuide).slice(0, 20)],
    // Halfway, not the whole run: an oven that has arrived has forgotten where it
    // started, so the readings at the end cannot show what `start` did.
    model => model.advance(P.DECLARED.ovenRun / 2 / P.DECLARED.slower)],
  ['Wax thermostat', wax, WT, L.waxThermostatLesson, P.WAX_DOMAINS, P.WAX_DEFAULTS, 'wax-thermostat', waxSettings, 6,
    () => [WT.piston.position.x, WT.disc.position.x, WT.toRadiator.userData.length, WT.waxBody.material.color.getHex(), pointsOf(WT.curve).slice(-2), pointsOf(WT.openGuide).slice(0, 20)],
    // Halfway, for the same reason as the oven.
    model => model.advance(P.DECLARED.engineRun / 2 / P.DECLARED.slower)],
];

for (const [name, model, topology, lesson, domains, defaults, id, settings, leastParts, snapshot, settle] of machines) {
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
  model.reset();
  model.advance(1);
  t.near(model.getState().clock, SRC.drawn.slower, 1e-9, `${name}: a second of playback is ${f0(SRC.drawn.slower)} seconds of run`);
  model.reset();
  // Every one of these three runs whatever it is set to: there is no setting at
  // which a thermostat has nothing to show, so nothing ever blocks the run.
  t.ok(!model.playback.blocked(), `${name}: the run is ready to press`);
  for (const values of settings) { model.update(values); t.ok(!model.playback.blocked(), `${name}: and still ready at every setting`); }
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
  t.ok(model.getState().readings.length >= 8, `${name}: at least eight readings`);
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
  t.ok(lesson.parts.length === model.parts.length - 1, `${name}: and every part the model has, except the whole thing, is named`);
  t.ok(lesson.steps.length === 5 && lesson.deeper.length >= 5 && lesson.tryIt.length === 7 && lesson.parts.length >= leastParts,
    `${name}: five steps, at least five deeper sections, seven trials and at least ${f0(leastParts)} parts`);
  t.ok(heatingLessons[name] === lesson, `${name}: the heating lessons carry this lesson`);
  const routed = createHeatingModel(name);
  t.ok(routed && routed.controls.map(control => control.key).join() === Object.keys(domains).join(), `${name}: the heating models route it here`);
  routed.dispose();
  t.ok(previewEntryIds.includes(id), `${name}: routed into the preview as ${id}`);
  for (const values of settings) {
    for (const time of [0, 2, 1e4]) {
      model.reset(); model.update(values); model.advance(time);
      const readings = model.getState().readings;
      t.ok(readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), `${name}: readings are all numbers`);
      for (const item of readings) t.ok(!/[—–]| - |--/.test(item.value + ' ' + (item.hint || '')), `${name}: reading text without dashes: ${item.label}`);
    }
  }
}

const released = [
  checkDisposal((() => { const fresh = BM.createBimetalThermostatModel(); fresh.advance(3); return fresh; })(), t),
  checkDisposal((() => { const fresh = RM.createRodThermostatModel(); fresh.advance(3); return fresh; })(), t),
  checkDisposal((() => { const fresh = WM.createWaxThermostatModel(); fresh.advance(3); return fresh; })(), t),
].reduce((sum, value) => sum + value, 0);
for (const model of [bimetal, rod, wax]) model.dispose();

console.log(`PASS thermostats: ${t.count} checks, ${counts.steps} steps integrated, ${counts.plans} runs planned, ${counts.solves} balances solved, ${counts.poses} poses, ${counts.points} drawn points traced, ${counts.numbers} quoted numbers traced, 3 lessons, ${released} resources released exactly once.`);

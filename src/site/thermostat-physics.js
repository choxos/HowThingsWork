import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Thermostats: three ways of turning a temperature into a movement, and the
// movement into a switch. A bimetal strip bends because two bonded metals want
// to be different lengths; a rod thermostat works on the difference between a
// brass tube and the steel rod inside it; a wax pellet melts and pushes a
// piston. Each one then regulates something, so the point is not the movement
// but the cycle it drives.
//
// Exact within the model: linear two-layer bimetal curvature, equivalent to
// equation 1 in the Kanthal handbook, (3/2a)(α2 − α1)(T − T0)/h, with
// the dimensionless a built from both metals' moduli and thicknesses, and the
// tip of a cantilever of that curvature at κL²/2; the differential expansion of
// a tube and the rod inside it, L(α_tube − α_rod)(T − T0); the share of a wax
// pellet melted across its melting range and the volume that adds; the piston
// that volume drives through a known bore; the gas or coolant through an
// opening from the orifice equation. Rod and wax loops are integrated step by
// step; the bimetal room uses exact exponential segments between switch events.
//
// Sourced: the bimetal handbook curvature and loaded-beam relations, with the
// higher expanding metal outside a free heated bend; the book's brass and iron.
// BIMETAL_MATERIAL uses the reviewed primary-source properties. Shared linear expansion
// coefficients for brass, iron, carbon steel, copper and invar, from the
// Thermal expansion page and checked against the Engineering ToolBox table;
// Young's moduli for brass, wrought iron and steel; brass's density and melting
// range; that a wax expands 5 to 20 percent on melting and that the biasing
// spring is 20 to 30 percent of the operating force; paraffin's melting range
// of 46 to 68 °C and density of about 900 kg/m³; that automotive wax
// thermostats are made to open between 70 and 90 °C, that modern engines run
// over 80 °C, that such an element sits at about half its stroke in normal
// running, that strokes run from 1.5 to 16 mm and elements cover −15 to
// +120 °C; that while the thermostat is shut the coolant is sent back through
// the engine instead of the radiator; the orifice equation and its discharge
// coefficient of 0.6 to 0.85; and the Ideal Vogue sheet's 20 mbar gas supply.
//
// Not from a source, each said in the lessons' limits: every dimension of every
// strip, rod, tube, pellet, piston, valve and contact; magnetic contact retention
// taken as a fixed release travel and zero-gap recapture; a room
// of stated size and loss, an oven of stated size and loss, and an engine of
// stated heat capacity and heat output, each treated as one stirred volume at
// one temperature; natural gas taken at the density of methane with the
// calorific value the boiler sheet gives; a bypass of stated area that keeps a
// pilot flow while the main valve is shut, and a seat sized so the oven reaches
// its setting in the ten to fifteen minutes a real one takes, which means the
// burner is deliberately far larger than the oven's steady loss and the valve
// throttles down to a few percent to hold it, as a real oven thermostat does; and the wax taken to melt evenly
// across its range, with no hysteresis of its own beyond the thermal lag the
// loop already has. The rod's valve is taken to close over 0.15 mm of travel,
// which is what turns 1.6 micrometers of differential a degree into a
// proportional band an oven can be set by, and the bimetal's snap is taken as
// 20 micrometers of overtravel, which is what makes its switching band about a
// degree wide.
// ---------------------------------------------------------------------------

/** Linear expansion coefficients, per kelvin, from the Thermal expansion page. */
export const EXPANSION = Object.freeze({brass: 19e-6, iron: 11.8e-6, carbonSteel: 10.8e-6, steel: Object.freeze([11.0e-6, 13.0e-6]), copper: 17e-6, invar: 1.2e-6, aluminum: 23.1e-6});
/** The same metals in the Engineering ToolBox table, for company. */
export const EXPANSION_OTHER = Object.freeze({brass: Object.freeze([18e-6, 19e-6]), ironForged: 11.3e-6, ironPure: 12.0e-6, steel: Object.freeze([10.8e-6, 12.5e-6]), copper: Object.freeze([16e-6, 16.7e-6]), invar: 1.5e-6});
/** Young's moduli, Pa, from the Young's modulus page. */
export const MODULUS = Object.freeze({brass: 106e9, wroughtIron: 193e9, steel: 200e9, copper: 110e9});
/** Representative near-room expansion (OpenStax) and elastic moduli (CDA and ARMCO), not a calibrated alloy pair. */
export const BIMETAL_MATERIAL = Object.freeze({brassAlpha: 19e-6, ironAlpha: 12e-6, brassYoung: 110e9, ironYoung: 207e9});
/** Brass, from the Brass page. */
export const BRASS = Object.freeze({density: Object.freeze([8400, 8730]), melting: Object.freeze([900, 940])});

/** What the wax pages give: how much it grows on melting, what a spring has to be, and where these elements work. */
export const WAX = Object.freeze({
  growth: Object.freeze([0.05, 0.20]), bias: Object.freeze([0.20, 0.30]),
  paraffinMelting: Object.freeze([46, 68]), paraffinDensity: 900,
  automotive: Object.freeze([70, 90]), modernEngine: 80, halfStroke: 0.5,
  strokes: Object.freeze([1.5, 16]), range: Object.freeze([-15, 120]),
  patent: 2115501, patentFiled: 1934, patentIssued: 1938,
});

/** The orifice equation's discharge coefficient, from the Orifice plate page, and the gas supply the boiler sheet gives. */
export const ORIFICE = Object.freeze({discharge: Object.freeze([0.6, 0.85]), supply: 2000, supplyMbar: 20});
/** Methane, for the gas the rod thermostat lets through: density at 25 °C and gross calorific value, from the gas boiler's own sources. */
export const GAS = Object.freeze({density: 0.657, densityAt: 25, calorific: 38.7e6});
/** Water, for the coolant the wax thermostat lets through. */
export const COOLANT = Object.freeze({density: 1000, heat: 4184});

/** Not from a source, each said in the lessons' limits. */
export const DECLARED = Object.freeze({
  // The bimetal strip, its contact and the room it keeps.
  stripLength: 0.05, stripThickness: 0.0006, stripWidth: 0.006, stripAt: 20,
  snap: 0.00002,
  roomVolume: 40, roomLoss: 55, roomCapacity: 300000,
  // The rod thermostat, its valve and the oven it keeps.
  rodLength: 0.2, rodAt: 20, valveBore: 0.0038, valveTravel: 0.00015, bypassBore: 0.00045, lever: 6,
  ovenCapacity: 42000, ovenLoss: 2.6, ovenAmbient: 20, burnerEfficiency: 0.45,
  // The wax element, its valve and the engine it keeps.
  pelletVolume: 0.9e-6, pistonBore: 0.004, meltFrom: 82, meltTo: 95,
  springRate: 9000, valveArea: 0.00045, pumpFlow: 0.0011,
  engineCapacity: 90000, enginePower: 14000, radiatorLoss: 320, engineAmbient: 20,
  // How the runs are marched and drawn.
  step: 0.5, samples: 161, roomRun: 5400, ovenRun: 2400, engineRun: 900, slower: 120,
});

const K = 273.15;

/** The dimensionless a of the Villarceau formula, from both metals' moduli and thicknesses. */
export function villarceauA(e1, h1, e2, h2) {
  const h = h1 + h2;
  return 1 + (e1 * h1 ** 2 - e2 * h2 ** 2) ** 2 / (4 * e1 * h1 * e2 * h2 * h ** 2);
}

/**
 * The curvature a bimetal strip takes at `celsius`, 1/m, counted from flat at
 * `from`: Villarceau's 1/R − 1/R0 = (3/2a)(α2 − α1)(T − T0)/h.
 */
export function curvatureAt(celsius, from = DECLARED.stripAt) {
  const h1 = DECLARED.stripThickness / 2, h2 = h1, h = h1 + h2;
  const a = villarceauA(BIMETAL_MATERIAL.brassYoung, h1, BIMETAL_MATERIAL.ironYoung, h2);
  return 3 / (2 * a) * (BIMETAL_MATERIAL.brassAlpha - BIMETAL_MATERIAL.ironAlpha) * (celsius - from) / h;
}

/** Where the tip of a cantilever of length L and curvature κ stands, m: κL²/2 for a gentle bend. */
export const tipOf = curvature => curvature * DECLARED.stripLength ** 2 / 2;
/** How far the strip's tip has moved at `celsius`, m. */
export const stripTipAt = celsius => tipOf(curvatureAt(celsius));

const layer = DECLARED.stripThickness / 2;
const neutralAxis = layer / 2 * (BIMETAL_MATERIAL.ironYoung - BIMETAL_MATERIAL.brassYoung) / (BIMETAL_MATERIAL.ironYoung + BIMETAL_MATERIAL.brassYoung);
const bendingRigidity = DECLARED.stripWidth * (BIMETAL_MATERIAL.brassYoung * (layer ** 3 / 12 + layer * (-layer / 2 - neutralAxis) ** 2) + BIMETAL_MATERIAL.ironYoung * (layer ** 3 / 12 + layer * (layer / 2 - neutralAxis) ** 2));
export const BIMETAL_BEAM = Object.freeze({neutralAxis, bendingRigidity, tipStiffness: 3 * bendingRigidity / DECLARED.stripLength ** 3});

/** Small-deflection thermal cantilever plus endpoint load, with brass on its lower face. */
export function bimetalBeamAt(plan, now, x = DECLARED.stripLength) {
  const q = clamp(x / DECLARED.stripLength), distance = q * DECLARED.stripLength;
  const free = now.curvature * distance ** 2 / 2;
  const displacement = now.closed ? plan.tipAtClose - now.tip : 0;
  return {x: distance, free, y: free + displacement * q ** 2 * (3 - q) / 2,
    slope: now.curvature * distance + displacement * 3 * q * (2 - q) / (2 * DECLARED.stripLength),
    force: displacement * BIMETAL_BEAM.tipStiffness};
}

/** How much longer a tube of `length` is than the rod inside it at `celsius`, m. */
export const differentialAt = (celsius, length = DECLARED.rodLength, from = DECLARED.rodAt) =>
  length * (EXPANSION.brass - EXPANSION.carbonSteel) * (celsius - from);

/** The share of a wax pellet melted at `celsius`, taken evenly across its melting range. */
export const meltedAt = celsius => clamp((celsius - DECLARED.meltFrom) / (DECLARED.meltTo - DECLARED.meltFrom));
/** How far the wax pushes its piston at `celsius`, m: the volume the melt adds, over the piston's area. */
export function pistonAt(celsius, growth = (WAX.growth[0] + WAX.growth[1]) / 2) {
  const area = Math.PI * (DECLARED.pistonBore / 2) ** 2;
  return DECLARED.pelletVolume * growth * meltedAt(celsius) / area;
}

/** What flows through an opening of `area` under `pressure`, m³/s: the orifice equation. */
export const throughOrifice = (area, pressure, density, discharge = ORIFICE.discharge[0]) =>
  area <= 0 ? 0 : discharge * area * Math.sqrt(2 * pressure / density);

const rooms = new Map(), ovens = new Map(), engines = new Map();

// ---------------------------------------------------------------------------
// Bimetal thermostat: a strip that bends until its contact opens, and the room
// it keeps while it does it.
// ---------------------------------------------------------------------------

export const BIMETAL_DEFAULTS = Object.freeze({setting: 20, outdoor: 5, power: 2000, start: 14});
export const BIMETAL_DOMAINS = Object.freeze({setting: Object.freeze([10, 26, 1]), outdoor: Object.freeze([-10, 15, 1]), power: Object.freeze([500, 3000, 100]), start: Object.freeze([5, 25, 1])});

/** The temperature at which the strip's tip has moved `travel` from where it was flat. */
export function temperatureForTip(travel) {
  const perDegree = stripTipAt(DECLARED.stripAt + 1) - stripTipAt(DECLARED.stripAt);
  return DECLARED.stripAt + travel / perDegree;
}

export function bimetalPlan(input = {}) {
  const values = validateControls(input, BIMETAL_DEFAULTS, BIMETAL_DOMAINS, 'bimetal thermostat');
  const key = JSON.stringify(values);
  if (rooms.has(key)) return rooms.get(key);
  // shortcut: fixed magnetic release force and zero-gap recapture; use a measured force-gap law for hardware prediction.
  const opensAt = values.setting;
  const closesAt = temperatureForTip(stripTipAt(opensAt) - DECLARED.snap);
  const capacity = DECLARED.roomCapacity, tau = capacity / DECLARED.roomLoss;
  const equilibrium = values.outdoor + values.power / DECLARED.roomLoss;
  const segments = [{t: 0, celsius: values.start, closed: values.start < opensAt, onTime: 0}];
  const events = [];
  while (segments.at(-1).t < DECLARED.roomRun) {
    const segment = segments.at(-1);
    const target = segment.closed ? opensAt : closesAt;
    const limit = segment.closed ? equilibrium : values.outdoor;
    const canCross = segment.closed ? limit > target : limit < target;
    const until = canCross ? -tau * Math.log1p((target - segment.celsius) / (segment.celsius - limit)) : Infinity;
    const remaining = DECLARED.roomRun - segment.t;
    segment.end = segment.t + Math.min(until, remaining);
    if (until > remaining) break;
    const next = {t: segment.end, celsius: target, closed: !segment.closed, onTime: segment.onTime + (segment.closed ? until : 0)};
    events.push({t: next.t, celsius: target, closed: next.closed});
    segments.push(next);
  }
  segments.at(-1).end = DECLARED.roomRun;
  const plan = {
    values, opensAt, closesAt, band: opensAt - closesAt, capacity, tau, equilibrium, segments, events,
    duration: DECLARED.roomRun, canCycle: equilibrium > opensAt && values.outdoor < closesAt,
    limit: equilibrium <= opensAt ? 'insufficientHeat' : values.outdoor >= closesAt ? 'noCooling' : 'cyclingPossible',
    tipAtOpen: stripTipAt(opensAt), tipAtClose: stripTipAt(closesAt),
    curvatureAtOpen: curvatureAt(opensAt),
    needed: Math.max(0, DECLARED.roomLoss * (values.setting - values.outdoor)),
  };
  const times = [...new Set([...Array.from({length: DECLARED.samples}, (_, i) => plan.duration * i / (DECLARED.samples - 1)), ...events.map(event => event.t)])].sort((a, b) => a - b);
  plan.chart = times.map(t => { const now = bimetalAt(plan, t); return {t, celsius: now.celsius, closed: now.closed}; });
  if (rooms.size >= 8) rooms.delete(rooms.keys().next().value);
  rooms.set(key, plan);
  return plan;
}

/** The room and the strip at a time in the run. */
export function bimetalAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  let low = 0, high = plan.segments.length - 1;
  while (low < high) { const middle = Math.ceil((low + high) / 2); if (plan.segments[middle].t <= t) low = middle; else high = middle - 1; }
  const segment = plan.segments[low], elapsed = t - segment.t;
  const limit = plan.values.outdoor + (segment.closed ? plan.values.power / DECLARED.roomLoss : 0);
  const celsius = segment.celsius + (limit - segment.celsius) * -Math.expm1(-elapsed / plan.tau);
  const onTime = segment.onTime + (segment.closed ? elapsed : 0), inputEnergy = onTime * plan.values.power;
  const storedEnergy = plan.capacity * (celsius - plan.values.start);
  const mainOn = t > 0, on = mainOn && segment.closed;
  return {time, t, celsius, closed: segment.closed, mainOn, on, power: on ? plan.values.power : 0,
    switches: low, onTime, duty: t > 0 ? onTime / t : 0, inputEnergy, storedEnergy, environmentEnergy: inputEnergy - storedEnergy,
    heatLoss: DECLARED.roomLoss * (celsius - plan.values.outdoor), tip: stripTipAt(celsius), curvature: curvatureAt(celsius), done: t >= plan.duration};
}

export const sampleBimetal = (input = {}, time = 0) => bimetalAt(bimetalPlan(input), time);

// ---------------------------------------------------------------------------
// Rod thermostat: a brass tube that grows more than the steel rod inside it,
// and the gas valve that difference closes.
// ---------------------------------------------------------------------------

export const ROD_DEFAULTS = Object.freeze({setting: 200, start: 20, supply: 20, bypass: 1});
export const ROD_DOMAINS = Object.freeze({setting: Object.freeze([120, 260, 10]), start: Object.freeze([15, 60, 5]), supply: Object.freeze([10, 25, 1]), bypass: Object.freeze([0, 1, 1])});
export const BYPASSES = Object.freeze([Object.freeze({value: 0, label: 'No bypass'}), Object.freeze({value: 1, label: 'Bypass fitted'})]);

/** How far the valve is open at `celsius` for a given setting, as a share of its full bore. */
export function valveOpenAt(celsius, setting) {
  // The seat is placed so that the band straddles the setting: wide open half a
  // band below it, shut half a band above, and part open at the setting itself.
  const band = DECLARED.valveTravel / (DECLARED.lever * DECLARED.rodLength * (EXPANSION.brass - EXPANSION.carbonSteel));
  const closing = DECLARED.lever * differentialAt(celsius, DECLARED.rodLength, setting - band / 2);
  return clamp(1 - closing / DECLARED.valveTravel);
}

export function rodPlan(input = {}) {
  const values = validateControls(input, ROD_DEFAULTS, ROD_DOMAINS, 'rod thermostat');
  const key = JSON.stringify(values);
  if (ovens.has(key)) return ovens.get(key);
  const pressure = values.supply * 100;
  const mainArea = Math.PI * (DECLARED.valveBore / 2) ** 2;
  const bypassArea = values.bypass ? Math.PI * (DECLARED.bypassBore / 2) ** 2 : 0;
  const flowAt = celsius => throughOrifice(mainArea * valveOpenAt(celsius, values.setting), pressure, GAS.density) + throughOrifice(bypassArea, pressure, GAS.density);
  const track = [{t: 0, celsius: values.start, flow: flowAt(values.start), open: valveOpenAt(values.start, values.setting)}];
  let celsius = values.start, reached = null;
  for (let step = 1; step * DECLARED.step <= DECLARED.ovenRun + 1e-9; step++) {
    const previous = track[step - 1], t = step * DECLARED.step;
    const heat = previous.flow * GAS.calorific * DECLARED.burnerEfficiency;
    const lost = DECLARED.ovenLoss * (previous.celsius - DECLARED.ovenAmbient);
    celsius = previous.celsius + (heat - lost) * DECLARED.step / DECLARED.ovenCapacity;
    const open = valveOpenAt(celsius, values.setting);
    if (reached === null && celsius >= values.setting - 1) reached = t;
    track.push({t, celsius, flow: flowAt(celsius), open});
  }
  const settled = track.at(-1);
  const plan = {
    values, pressure, mainArea, bypassArea, track, settled, reached,
    duration: DECLARED.ovenRun,
    fullFlow: throughOrifice(mainArea, pressure, GAS.density),
    bypassFlow: throughOrifice(bypassArea, pressure, GAS.density),
    fullPower: throughOrifice(mainArea, pressure, GAS.density) * GAS.calorific * DECLARED.burnerEfficiency,
    shutsAt: values.setting + DECLARED.valveTravel / (DECLARED.lever * DECLARED.rodLength * (EXPANSION.brass - EXPANSION.carbonSteel)) / 2,
    differentialPerDegree: differentialAt(1, DECLARED.rodLength, 0),
    holds: settled.celsius > values.setting - 10,
    goesOut: !values.bypass && valveOpenAt(settled.celsius, values.setting) <= 0,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1), now = rodAt(plan, t);
    return {t, celsius: now.celsius, open: now.open};
  });
  if (ovens.size >= 64) ovens.clear();
  ovens.set(key, plan);
  return plan;
}

/** The oven and its valve at a time in the run. */
export function rodAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  const place = clamp(t / DECLARED.step, 0, plan.track.length - 1);
  const low = Math.floor(place), high = Math.min(low + 1, plan.track.length - 1), part = place - low;
  const between = key => plan.track[low][key] + part * (plan.track[high][key] - plan.track[low][key]);
  const celsius = between('celsius');
  return {
    time, t, celsius, flow: between('flow'), open: between('open'),
    differential: differentialAt(celsius, DECLARED.rodLength, plan.values.setting),
    power: between('flow') * GAS.calorific * DECLARED.burnerEfficiency,
    lit: between('flow') > 0, done: t >= plan.duration,
  };
}

export const sampleRod = (input = {}, time = 0) => rodAt(rodPlan(input), time);

// ---------------------------------------------------------------------------
// Wax thermostat: a pellet that melts, a piston it pushes, and the coolant it
// lets through to the radiator.
// ---------------------------------------------------------------------------

export const WAX_DEFAULTS = Object.freeze({growth: 12, load: 14, ambient: 20, start: 20});
export const WAX_DOMAINS = Object.freeze({growth: Object.freeze([5, 20, 1]), load: Object.freeze([4, 30, 1]), ambient: Object.freeze([-10, 40, 5]), start: Object.freeze([-10, 40, 5])});

/** How far the valve is open at `celsius`, as a share of its full travel, against the spring. */
export function coolantOpenAt(celsius, growth) {
  const stroke = pistonAt(celsius, growth / 100);
  return clamp(stroke / pistonAt(DECLARED.meltTo, (WAX.growth[0] + WAX.growth[1]) / 2));
}

export function waxPlan(input = {}) {
  const values = validateControls(input, WAX_DEFAULTS, WAX_DOMAINS, 'wax thermostat');
  const key = JSON.stringify(values);
  if (engines.has(key)) return engines.get(key);
  const power = values.load * 1000;
  const track = [{t: 0, celsius: values.start, open: coolantOpenAt(values.start, values.growth)}];
  let celsius = values.start, opened = null, reached = null;
  for (let step = 1; step * DECLARED.step <= DECLARED.engineRun + 1e-9; step++) {
    const previous = track[step - 1], t = step * DECLARED.step;
    // Shut, the coolant goes round the engine and only the block loses heat;
    // open, the radiator carries off what it can at that opening.
    const lost = DECLARED.radiatorLoss * previous.open * (previous.celsius - values.ambient) + 12 * (previous.celsius - values.ambient);
    celsius = previous.celsius + (power - lost) * DECLARED.step / DECLARED.engineCapacity;
    const open = coolantOpenAt(celsius, values.growth);
    if (opened === null && open > 0) opened = t;
    if (reached === null && open >= WAX.halfStroke) reached = t;
    track.push({t, celsius, open});
  }
  const settled = track.at(-1);
  const plan = {
    values, power, track, settled, opened, reached, duration: DECLARED.engineRun,
    fullStroke: pistonAt(DECLARED.meltTo, values.growth / 100),
    strokeAtOpen: pistonAt(DECLARED.meltFrom, values.growth / 100),
    withinStrokes: pistonAt(DECLARED.meltTo, values.growth / 100) * 1000 >= WAX.strokes[0],
    withinRange: DECLARED.meltFrom >= WAX.automotive[0] && DECLARED.meltTo <= WAX.automotive[1] + 5,
    // Some settings have no resting place inside the run: an undersized wax cannot
    // open far enough, so the engine is still on its way up when the run ends.
    climbing: (track.at(-1).celsius - track.at(-2).celsius) / DECLARED.step > 0.001,
    boils: settled.celsius >= 100,
    halfOpen: settled.open >= WAX.halfStroke * 0.5 && settled.open <= 1,
  };
  plan.chart = Array.from({length: DECLARED.samples}, (_, i) => {
    const t = plan.duration * i / (DECLARED.samples - 1), now = waxAt(plan, t);
    return {t, celsius: now.celsius, open: now.open};
  });
  if (engines.size >= 64) engines.clear();
  engines.set(key, plan);
  return plan;
}

/** The engine and its thermostat at a time in the run. */
export function waxAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  const place = clamp(t / DECLARED.step, 0, plan.track.length - 1);
  const low = Math.floor(place), high = Math.min(low + 1, plan.track.length - 1), part = place - low;
  const between = key => plan.track[low][key] + part * (plan.track[high][key] - plan.track[low][key]);
  const celsius = between('celsius'), open = between('open');
  return {
    time, t, celsius, open,
    melted: meltedAt(celsius),
    stroke: pistonAt(celsius, plan.values.growth / 100),
    spring: DECLARED.springRate * pistonAt(celsius, plan.values.growth / 100),
    toRadiator: open * DECLARED.pumpFlow,
    done: t >= plan.duration,
  };
}

export const sampleWax = (input = {}, time = 0) => waxAt(waxPlan(input), time);

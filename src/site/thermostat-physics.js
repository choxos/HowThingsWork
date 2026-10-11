import {validateControls, validTime, clamp} from './physics-kit.js';

// The bimetal and rod loops use exact exponential segments between mechanism events.
// The wax loop retains its separate numerical model. Each lesson states its own
// material sources, dimensions, thermal assumptions and geometry exaggerations.

/** Linear expansion coefficients, per kelvin, from the Thermal expansion page. */
export const EXPANSION = Object.freeze({brass: 19e-6, iron: 11.8e-6, carbonSteel: 10.8e-6, steel: Object.freeze([11.0e-6, 13.0e-6]), copper: 17e-6, invar: 1.2e-6, aluminum: 23.1e-6});
/** The same metals in the Engineering ToolBox table, for company. */
export const EXPANSION_OTHER = Object.freeze({brass: Object.freeze([18e-6, 19e-6]), ironForged: 11.3e-6, ironPure: 12.0e-6, steel: Object.freeze([10.8e-6, 12.5e-6]), copper: Object.freeze([16e-6, 16.7e-6]), invar: 1.5e-6});
/** Young's moduli, Pa, from the Young's modulus page. */
export const MODULUS = Object.freeze({brass: 106e9, wroughtIron: 193e9, steel: 200e9, copper: 110e9});
/** Representative near-room expansion (OpenStax) and elastic moduli (CDA and ARMCO), not a calibrated alloy pair. */
export const BIMETAL_MATERIAL = Object.freeze({brassAlpha: 19e-6, ironAlpha: 12e-6, brassYoung: 110e9, ironYoung: 207e9});
/** Representative linear expansion coefficients from OpenStax, held constant for this lesson. */
export const ROD_MATERIAL = Object.freeze({brassAlpha: 19e-6, steelAlpha: 12e-6});
/** Brass, from the Brass page. */
export const BRASS = Object.freeze({density: Object.freeze([8400, 8730]), melting: Object.freeze([900, 940])});

/** The orifice equation's discharge coefficient, from the Orifice plate page, and the gas supply the boiler sheet gives. */
export const ORIFICE = Object.freeze({discharge: Object.freeze([0.6, 0.85]), supply: 2000, supplyMbar: 20});
/** Legacy gas reference retained for the unrevised draft source checks. */
export const GAS = Object.freeze({density: 0.657, densityAt: 25, calorific: 38.7e6});
/** Dow 50%-by-volume ethylene glycol data at 90 °C, held constant in the wax lesson. */
export const COOLANT = Object.freeze({density: 1032.15, heat: 3554, glycolVolumeFraction: 0.5,
  referenceCelsius: 90, minimumPressure: 200000, minCelsius: -10, maxCelsius: 120, saturationAtMax: 155300});

/** Not from a source, each said in the lessons' limits. */
export const DECLARED = Object.freeze({
  // The bimetal strip, its contact and the room it keeps.
  stripLength: 0.05, stripThickness: 0.0006, stripWidth: 0.006, stripAt: 20,
  snap: 0.00002,
  roomVolume: 40, roomLoss: 55, roomCapacity: 300000,
  // The rod thermostat, its valve and the oven it keeps.
  rodLength: 0.2, rodAt: 20, valveBore: 0.012, bypassBore: 0.00045,
  ovenCapacity: 12000, ovenLoss: 5, ovenAmbient: 20, burnerEfficiency: 0.45,
  // How the runs are marched and drawn.
  samples: 161, roomRun: 5400, ovenRun: 2400, slower: 120,
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
  length * (ROD_MATERIAL.brassAlpha - ROD_MATERIAL.steelAlpha) * (celsius - from);

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
export const ROD_DOMAINS = Object.freeze({setting: Object.freeze([120, 260, 10]), start: Object.freeze([15, 300, 5]), supply: Object.freeze([10, 25, 1]), bypass: Object.freeze([0, 1, 1])});
export const BYPASSES = Object.freeze([Object.freeze({value: 0, label: 'No bypass'}), Object.freeze({value: 1, label: 'Bypass fitted'})]);

/** Pure methane: NIST molar mass and gross combustion heat; OpenStax gas constant. Inlet conditions and Cd are declared. */
export const ROD_GAS = Object.freeze({molarMass: 0.0160425, molarHeat: 890350, constant: 8.31, inletKelvin: 298.15, atmosphere: 101325, discharge: 0.6});

function rodSupply(supply) {
  const pressure = supply * 100, absolute = ROD_GAS.atmosphere + pressure;
  const molarDensity = absolute / (ROD_GAS.constant * ROD_GAS.inletKelvin);
  const density = molarDensity * ROD_GAS.molarMass;
  const speed = ROD_GAS.discharge * Math.sqrt(2 * pressure / density);
  const flowPerLift = speed * Math.PI * DECLARED.valveBore;
  const bypassFlow = speed * Math.PI * (DECLARED.bypassBore / 2) ** 2;
  const energyPerVolume = molarDensity * ROD_GAS.molarHeat;
  return {pressure, absolute, density, molarDensity, flowPerLift, bypassFlow, energyPerVolume,
    powerPerDegree: flowPerLift * differentialAt(1, DECLARED.rodLength, 0) * energyPerVolume * DECLARED.burnerEfficiency};
}

export function rodPlan(input = {}) {
  const values = validateControls(input, ROD_DEFAULTS, ROD_DOMAINS, 'rod thermostat');
  const key = JSON.stringify(values);
  if (ovens.has(key)) return ovens.get(key);
  const nominal = rodSupply(20), supply = rodSupply(values.supply);
  const nominalBypassPower = nominal.bypassFlow * nominal.energyPerVolume * DECLARED.burnerEfficiency;
  // The dial is calibrated once with its bypass fitted at 20 mbar, not readjusted as controls change.
  const shutsAt = values.setting + (DECLARED.ovenLoss * (values.setting - DECLARED.ovenAmbient) - nominalBypassPower) / nominal.powerPerDegree;
  const differentialPerDegree = differentialAt(1, DECLARED.rodLength, 0);
  const bypassFlow = values.bypass ? supply.bypassFlow : 0;
  const bypassPower = bypassFlow * supply.energyPerVolume * DECLARED.burnerEfficiency;
  const initialLift = Math.max(0, differentialPerDegree * (shutsAt - values.start));
  // shortcut: one ignition attempt and ideal flame retention; add measured flame stability and safety hardware for appliance prediction.
  const ignites = initialLift > 0 || bypassFlow > 0;
  const plan = {values, ...supply, shutsAt, differentialPerDegree, bypassFlow, bypassPower, ignites,
    duration: DECLARED.ovenRun, dialExtension: differentialAt(shutsAt), segments: [], events: []};
  const addSegment = (t, celsius, mainOpen) => {
    const gain = ignites && mainOpen ? supply.powerPerDegree : 0;
    const loss = DECLARED.ovenLoss + gain;
    const limit = (DECLARED.ovenLoss * DECLARED.ovenAmbient + (ignites ? bypassPower : 0) + gain * shutsAt) / loss;
    return {t, celsius, mainOpen, limit, tau: DECLARED.ovenCapacity / loss, end: plan.duration};
  };
  const first = addSegment(0, values.start, values.start <= shutsAt);
  plan.segments.push(first);
  if (!first.mainOpen && first.limit < shutsAt) {
    const crossing = -first.tau * Math.log1p((shutsAt - first.celsius) / (first.celsius - first.limit));
    if (crossing < plan.duration) {
      first.end = crossing;
      plan.events.push({t: crossing, celsius: shutsAt, mainOpen: true});
      plan.segments.push(addSegment(crossing, shutsAt, true));
    }
  }
  plan.equilibrium = addSegment(0, values.start, true).limit;
  const times = [...new Set([...Array.from({length: DECLARED.samples}, (_, i) => plan.duration * i / (DECLARED.samples - 1)), ...plan.events.map(event => event.t)])].sort((a, b) => a - b);
  plan.chart = times.map(t => { const now = rodAt(plan, t); return {t, celsius: now.celsius}; });
  plan.settled = rodAt(plan, plan.duration);
  if (ovens.size >= 8) ovens.delete(ovens.keys().next().value);
  ovens.set(key, plan);
  return plan;
}

/** Exact exponential temperature and integrated flow over each open or closed valve segment. */
export function rodAt(plan, time) {
  const t = Math.min(validTime(time), plan.duration);
  let celsius = plan.values.start, mainVolume = 0, temperatureIntegral = 0;
  for (const segment of plan.segments) {
    if (t < segment.t) break;
    const elapsed = Math.min(t, segment.end) - segment.t;
    const rise = -Math.expm1(-elapsed / segment.tau);
    celsius = segment.celsius + (segment.limit - segment.celsius) * rise;
    const integral = segment.limit * elapsed + (segment.celsius - segment.limit) * segment.tau * rise;
    temperatureIntegral += integral;
    if (segment.mainOpen) mainVolume += plan.flowPerLift * plan.differentialPerDegree * Math.max(0, plan.shutsAt * elapsed - integral);
  }
  const mainOn = t > 0, lit = mainOn && plan.ignites;
  const lift = Math.max(0, plan.differentialPerDegree * (plan.shutsAt - celsius));
  const mainFlow = mainOn ? plan.flowPerLift * lift : 0, bypassFlow = mainOn ? plan.bypassFlow : 0;
  const flow = mainFlow + bypassFlow, volume = mainVolume + plan.bypassFlow * t;
  const chemicalEnergy = lit ? volume * plan.energyPerVolume : 0;
  const inputEnergy = chemicalEnergy * DECLARED.burnerEfficiency;
  const storedEnergy = DECLARED.ovenCapacity * (celsius - plan.values.start);
  const environmentEnergy = DECLARED.ovenLoss * (temperatureIntegral - DECLARED.ovenAmbient * t);
  const power = lit ? flow * plan.energyPerVolume * DECLARED.burnerEfficiency : 0;
  const heatLoss = DECLARED.ovenLoss * (celsius - DECLARED.ovenAmbient);
  return {time, t, celsius, mainOn, lit, lift, gap: Math.max(0, plan.differentialPerDegree * (celsius - plan.shutsAt)),
    differential: differentialAt(celsius), brassExpansion: DECLARED.rodLength * ROD_MATERIAL.brassAlpha * (celsius - DECLARED.rodAt),
    steelExpansion: DECLARED.rodLength * ROD_MATERIAL.steelAlpha * (celsius - DECLARED.rodAt),
    mainFlow, bypassFlow, flow, volume, mainVolume, chemicalEnergy, inputEnergy, storedEnergy, environmentEnergy,
    power, heatLoss, rate: mainOn ? (power - heatLoss) / DECLARED.ovenCapacity : 0, done: t >= plan.duration};
}

export const sampleRod = (input = {}, time = 0) => rodAt(rodPlan(input), time);

// ---------------------------------------------------------------------------
// Wax thermostat: a fixed piston, moving capsule and valve, and a connected cooling loop.
// ---------------------------------------------------------------------------

export const WAX_DEFAULTS = Object.freeze({growth: 12, load: 14, ambient: 20, start: 20});
export const WAX_DOMAINS = Object.freeze({growth: Object.freeze([5, 20, 1]), load: Object.freeze([0, 24, 2]), ambient: Object.freeze([-10, 40, 5]), start: Object.freeze([-10, 120, 5])});
/** Declared teaching parameters, not a calibrated commercial wax element or engine. */
export const WAX_SPEC = Object.freeze({
  volume: 0.9e-6, pistonBore: 0.004, capsuleDiameter: 0.013, seatDiameter: 0.040,
  springRate: 9000, springPreload: 30, sensibleCapacity: 7.32, phaseEnergy: 162,
  meltFrom: 82, freezeFrom: 78, phaseSpan: 13, thermalContact: 0.6,
  engineCapacity: 90000, blockLoss: 12, radiatorUA: 400,
  pumpFlow: 0.0008, bypassArea: 0.0014, duration: 1200, slower: 60, step: 0.125, samples: 161,
});

const springEnergy = stroke => WAX_SPEC.springPreload * stroke + WAX_SPEC.springRate * stroke ** 2 / 2;
export const waxEnergyAt = (celsius, melted, fullStroke) => WAX_SPEC.sensibleCapacity * celsius + WAX_SPEC.phaseEnergy * melted + springEnergy(fullStroke * melted);

/** Hysteretic phase return map: retain the fraction between the heating and cooling boundaries. */
export function waxPhaseAt(energy, previous, fullStroke) {
  const S = WAX_SPEC, capacity = S.sensibleCapacity;
  const free = (energy - S.phaseEnergy * previous - springEnergy(fullStroke * previous)) / capacity;
  const heating = free > S.meltFrom + S.phaseSpan * previous;
  const cooling = free < S.freezeFrom + S.phaseSpan * previous;
  let melted = previous;
  if (heating || cooling) {
    const excess = Math.max(0, energy - capacity * (heating ? S.meltFrom : S.freezeFrom));
    const a = S.springRate * fullStroke ** 2 / 2;
    const b = capacity * S.phaseSpan + S.phaseEnergy + S.springPreload * fullStroke;
    melted = clamp(2 * excess / (b + Math.sqrt(b * b + 4 * a * excess)));
  }
  return {melted, waxCelsius: (energy - S.phaseEnergy * melted - springEnergy(fullStroke * melted)) / capacity};
}

function waxRates(plan, state) {
  const S = WAX_SPEC, stroke = plan.fullStroke * state.melted;
  const area = Math.min(Math.PI * S.seatDiameter * stroke, plan.portArea);
  const toRadiator = S.pumpFlow * area / (area + S.bypassArea), toBypass = S.pumpFlow - toRadiator;
  const capacityRate = toRadiator * COOLANT.density * COOLANT.heat;
  // shortcut: fixed-temperature reservoir; use a finite-air crossflow model for radiator design.
  const conductance = capacityRate > 0 ? -capacityRate * Math.expm1(-S.radiatorUA / capacityRate) : 0;
  const radiatorHeat = conductance * (state.celsius - plan.values.ambient);
  const radiatorOutlet = capacityRate > 0 ? state.celsius - radiatorHeat / capacityRate : plan.values.ambient;
  const returnCelsius = (toRadiator * radiatorOutlet + toBypass * state.celsius) / S.pumpFlow;
  const blockHeat = S.blockLoss * (state.celsius - plan.values.ambient);
  const waxHeat = S.thermalContact * (state.celsius - state.waxCelsius);
  return {stroke, area, toRadiator, toBypass, radiatorHeat, radiatorOutlet, returnCelsius, blockHeat, waxHeat,
    rate: (plan.power - radiatorHeat - blockHeat - waxHeat) / S.engineCapacity};
}

function waxStep(plan, state, dt) {
  const before = waxRates(plan, state), midEnergy = state.energy + before.waxHeat * dt / 2;
  const middle = {...state, celsius: state.celsius + before.rate * dt / 2, ...waxPhaseAt(midEnergy, state.melted, plan.fullStroke)};
  const flux = waxRates(plan, middle), energy = state.energy + flux.waxHeat * dt;
  return {t: state.t + dt, celsius: state.celsius + flux.rate * dt, energy,
    ...waxPhaseAt(energy, state.melted, plan.fullStroke),
    radiatorEnergy: state.radiatorEnergy + flux.radiatorHeat * dt,
    blockEnergy: state.blockEnergy + flux.blockHeat * dt,
    radiatorVolume: state.radiatorVolume + flux.toRadiator * dt};
}

export function waxPlan(input = {}) {
  const values = validateControls(input, WAX_DEFAULTS, WAX_DOMAINS, 'wax thermostat'), key = JSON.stringify(values);
  if (engines.has(key)) return engines.get(key);
  const S = WAX_SPEC, fullStroke = S.volume * values.growth / 100 / (Math.PI * S.pistonBore ** 2 / 4);
  const melted = clamp((values.start - S.meltFrom) / S.phaseSpan), initialEnergy = waxEnergyAt(values.start, melted, fullStroke);
  const plan = {values, power: values.load * 1000, duration: S.duration, fullStroke, initialEnergy,
    portArea: Math.PI * (S.seatDiameter ** 2 - S.capsuleDiameter ** 2) / 4};
  plan.track = [{t: 0, celsius: values.start, waxCelsius: values.start, melted, energy: initialEnergy, radiatorEnergy: 0, blockEnergy: 0, radiatorVolume: 0}];
  for (let i = 1; i <= S.duration / S.step; i++) plan.track.push(waxStep(plan, plan.track.at(-1), S.step));
  plan.chart = Array.from({length: S.samples}, (_, i) => {
    const now = waxAt(plan, S.duration * i / (S.samples - 1));
    return {t: now.t, celsius: now.celsius, waxCelsius: now.waxCelsius};
  });
  if (engines.size >= 8) engines.delete(engines.keys().next().value);
  engines.set(key, plan);
  return plan;
}

/** Current state, including a partial numerical step when time lies between stored nodes. */
export function waxAt(plan, time) {
  const S = WAX_SPEC, t = Math.min(validTime(time), plan.duration);
  const low = Math.min(Math.floor(t / S.step), plan.track.length - 1), base = plan.track[low];
  const now = t > base.t ? waxStep(plan, base, t - base.t) : base;
  const flow = waxRates(plan, now), mainOn = t > 0, stroke = flow.stroke;
  const inputEnergy = plan.power * t, storedEnergy = S.engineCapacity * (now.celsius - plan.values.start);
  const actuatorEnergy = now.energy - plan.initialEnergy, pumpVolume = S.pumpFlow * t;
  return {...now, ...flow, time, t, mainOn, done: t >= plan.duration,
    power: mainOn ? plan.power : 0, pumpFlow: mainOn ? S.pumpFlow : 0,
    toRadiator: mainOn ? flow.toRadiator : 0, toBypass: mainOn ? flow.toBypass : 0,
    radiatorOutlet: mainOn ? flow.radiatorOutlet : now.celsius, returnCelsius: mainOn ? flow.returnCelsius : now.celsius,
    radiatorHeat: mainOn ? flow.radiatorHeat : 0, blockHeat: mainOn ? flow.blockHeat : 0,
    waxHeat: mainOn ? flow.waxHeat : 0, rate: mainOn ? flow.rate : 0,
    spring: S.springPreload + S.springRate * stroke, springEnergy: springEnergy(stroke),
    waxVolume: S.volume * (1 + plan.values.growth / 100 * now.melted),
    inputEnergy, storedEnergy, actuatorEnergy, pumpVolume, bypassVolume: pumpVolume - now.radiatorVolume,
    energyResidual: inputEnergy - storedEnergy - actuatorEnergy - now.radiatorEnergy - now.blockEnergy};
}

export const sampleWax = (input = {}, time = 0) => waxAt(waxPlan(input), time);

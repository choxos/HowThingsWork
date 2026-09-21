import {validateControls, validTime, clamp} from './physics-kit.js';

// Refrigerator: a vapor-compression cycle of isobutane (R-600a), a thermostat,
// and an insulated cabinet that heat keeps leaking into.
//
// Units: SI inside. Readings convert to watts, bar, degrees Celsius, grams.
//
// An illustrative fluid with isobutane's molar mass and normal boiling point.
// Constant vapor/liquid heat capacities imply L(T) = L0 + (cp_v-cp_l)(T-T0).
// Integrating d(ln P)/dT = L(T)/(R_specific*T²) gives saturation() below.
// Using the same L(T) in the enthalpy chart and throttle keeps the compressor's
// temperature rise consistent with its work. This is not a real-fluid EOS.
// Liquid volume, pressure dependence of liquid enthalpy and vapor nonideality
// are neglected. L0 = 375 kJ/kg at the normal boiling point is illustrative.
//
// The compressor. A piston of 20 mm bore and 16 mm stroke at 2,900 rpm. The
// gas left in its 4% clearance re-expands before new vapor can enter, so it
// fills only 1 - c ((Pc/Pe)^(1/gamma) - 1) of its stroke. The mass it moves is
// that share of its swept volume times the suction vapor's density. Its motor
// is 80% efficient.
//
// The coils. The evaporator takes in 4 W per degree between the cabinet and the
// boiling refrigerant; the condenser gives out 8 W per degree between the
// refrigerant and the room, half that when dusty. The evaporating and
// condensing temperatures settle where the compressor's flow matches both.
//
// The cabinet. Its air, shelves and food hold 20 kJ per degree. Heat leaks in
// through 5 cm of foam at 1.76 W per degree, and 0.8 W per degree more past a
// worn door seal. The thermostat starts the compressor 1 degree above the
// setting and stops it 1 degree below.
//
// Not modeled: a separate freezer, defrosting, the refrigerant's real
// properties beyond these fits, pressure drops in the pipes, heat from the
// compressor's shell temperature, and door openings. Motor losses are counted
// as heat delivered directly to the room, separately from condenser heat.

export const FRIDGE = Object.freeze({
  gas: 8.314, molar: 0.05812, boiling: 261.4, atmosphere: 101325, clapeyron: 2620, gamma: 1.1, liquidHeat: 2400, superheat: 10,
  bore: 0.02, stroke: 0.016, rod: 0.03, rpm: 2900, clearance: 0.04, efficiency: 0.6, motor: 0.8,
  evaporator: 4, condenser: 8, dusty: 0.5, leak: 1.76, worn: 0.8,
  cabinet: 20000, band: 1, duration: 6 * 3600, step: 1, every: 10, speedUp: 720, table: 0.05,
});
export const COILS = Object.freeze([Object.freeze({value: 0, label: 'Clean'}), Object.freeze({value: 1, label: 'Dusty'})]);
export const SEALS = Object.freeze([Object.freeze({value: 0, label: 'Sound'}), Object.freeze({value: 1, label: 'Worn'})]);
export const STARTS = Object.freeze([Object.freeze({value: 0, label: 'Already cold'}), Object.freeze({value: 1, label: 'Just switched on, warm'})]);
export const FRIDGE_DEFAULTS = Object.freeze({setting: 4, room: 22, coils: 0, seal: 0, start: 0});
export const FRIDGE_DOMAINS = Object.freeze({setting: [2, 8, 1], room: [16, 32, 2], coils: [0, 1, 1], seal: [0, 1, 1], start: [0, 1, 1]});

const K = 273.15;
export const latentHeat = (T = FRIDGE.boiling - K) => FRIDGE.clapeyron * FRIDGE.gas / FRIDGE.molar + (vaporHeat() - FRIDGE.liquidHeat) * (T + K - FRIDGE.boiling);
export const vaporHeat = () => FRIDGE.gamma / (FRIDGE.gamma - 1) * FRIDGE.gas / FRIDGE.molar;
export const saturation = T => {
  const kelvin = T + K, reference = FRIDGE.boiling, deltaCp = vaporHeat() - FRIDGE.liquidHeat, specificR = FRIDGE.gas / FRIDGE.molar;
  return FRIDGE.atmosphere * Math.exp(((latentHeat() - deltaCp * reference) * (1 / reference - 1 / kelvin) + deltaCp * Math.log(kelvin / reference)) / specificR);
};
export const swept = () => Math.PI * (FRIDGE.bore / 2) ** 2 * FRIDGE.stroke;

/** The cycle between an evaporating temperature Te and a condensing temperature Tc, in degrees Celsius. */
export function cycle(Te, Tc, clearance = FRIDGE.clearance) {
  const f = FRIDGE, L = latentHeat(Te), cp = vaporHeat(), Pe = saturation(Te), Pc = saturation(Tc), ratio = Pc / Pe;
  const suction = Te + K + f.superheat, density = Pe * f.molar / (f.gas * suction);
  const volumetric = Math.max(0, 1 - clearance * (ratio ** (1 / f.gamma) - 1));
  const flow = swept() * f.rpm / 60 * density * volumetric;
  const lift = ratio ** ((f.gamma - 1) / f.gamma) - 1;
  const work = cp * suction * lift / f.efficiency, cooling = L - f.liquidHeat * (Tc - Te) + cp * f.superheat;
  return {
    Te, Tc, Pe, Pc, ratio, density, volumetric, flow, lift, work, cooling, clearance,
    suction: suction - K, discharge: suction * (1 + lift / f.efficiency) - K, flash: f.liquidHeat * (Tc - Te) / L,
    capacity: flow * cooling, shaft: flow * work, electric: flow * work / f.motor, rejected: flow * (cooling + work),
    cop: cooling / work, electricCop: cooling / (work / f.motor),
    motorLoss: flow * work * (1 / f.motor - 1), roomHeat: flow * (cooling + work / f.motor),
    carnot: (Te + K) / (Tc - Te),
  };
}

/** The cycle running with the cabinet at cabinetT: both coils' heat flows matched by halving. */
export function running(cabinetT, room, coils) {
  const f = FRIDGE, condenser = f.condenser * (coils ? f.dusty : 1);
  const condensing = Te => {
    let lo = room + 1e-3, hi = room + 90;
    for (let i = 0; i < 45; i++) { const mid = (lo + hi) / 2; if (cycle(Te, mid).rejected > condenser * (mid - room)) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  let lo = cabinetT - 70, hi = cabinetT - 1e-3;
  for (let i = 0; i < 45; i++) { const mid = (lo + hi) / 2; if (cycle(mid, condensing(mid)).capacity > f.evaporator * (cabinetT - mid)) hi = mid; else lo = mid; }
  const Te = (lo + hi) / 2;
  return cycle(Te, condensing(Te));
}

/** The piston's indicator loop: clearance volume, the stroke's end, and where compression and re-expansion finish. */
export function indicator(c) {
  const f = FRIDGE, Vs = swept(), Vc = (c.clearance ?? f.clearance) * Vs, Vb = Vc + Vs;
  return {Vc, Vb, compressedAt: Vb * (1 / c.ratio) ** (1 / f.gamma), reexpandedAt: Vc * c.ratio ** (1 / f.gamma), Pe: c.Pe, Pc: c.Pc};
}

/** Piston position below its top and cylinder volume at crank angle theta (0 at the top). */
export function piston(theta, clearance = FRIDGE.clearance) {
  const f = FRIDGE, r = f.stroke / 2, l = f.rod, x = r * Math.cos(theta) + Math.sqrt(l * l - (r * Math.sin(theta)) ** 2);
  const drop = r + l - x;
  return {drop, volume: clearance * swept() + Math.PI * (f.bore / 2) ** 2 * drop};
}

const cache = new Map();
const coilTables = new Map();

// The same coil solution serves every thermostat, seal and starting state.
// Eighteen room/coil combinations bound this cache for the declared controls.
function coilTable(room, coils) {
  const key = `${room}:${coils}`;
  if (!coilTables.has(key)) {
    const low = FRIDGE_DOMAINS.setting[0] - FRIDGE.band - 2;
    const high = FRIDGE_DOMAINS.room[1] + 1, entries = [];
    for (let i = 0; low + i * FRIDGE.table <= high + 1e-9; i++) entries.push(running(low + i * FRIDGE.table, room, coils));
    coilTables.set(key, {low, step: FRIDGE.table, entries});
  }
  return coilTables.get(key);
}

function tableCycle(table, T) {
  const x = clamp((T - table.low) / table.step, 0, table.entries.length - 1 - 1e-9), i = Math.floor(x), u = x - i;
  const a = table.entries[i], b = table.entries[i + 1];
  return Object.fromEntries(['capacity', 'electric', 'rejected', 'motorLoss'].map(key => [key, a[key] + (b[key] - a[key]) * u]));
}

function sampleAt(samples, time) {
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].t <= time) lo = mid; else hi = mid; }
  if (Math.abs(time - samples[hi].t) < 1e-8) return {...samples[hi], t: time};
  const a = samples[lo], b = samples[hi], u = clamp((time - a.t) / (b.t - a.t));
  const result = {t: time, on: a.on};
  for (const key of ['T', 'energy', 'removed', 'released', 'leaked', 'motorHeat']) result[key] = a[key] + (b[key] - a[key]) * u;
  return result;
}

export function fridgePlan(input = {}) {
  const values = validateControls(input, FRIDGE_DEFAULTS, FRIDGE_DOMAINS, 'refrigerator');
  const key = JSON.stringify(values);
  if (cache.has(key)) return cache.get(key);
  const f = FRIDGE, leak = f.leak + (values.seal ? f.worn : 0), table = coilTable(values.room, values.coils);
  let T = values.start ? values.room : values.setting + f.band, on = true, energy = 0, removed = 0, released = 0, leaked = 0, motorHeat = 0;
  const samples = [], switches = [];
  const save = t => samples.push({t, T, on, energy, removed, released, leaked, motorHeat});
  const steps = Math.round(f.duration / f.step);
  for (let n = 0; n <= steps; n++) {
    const t = n * f.step, q = on ? tableCycle(table, T) : {capacity: 0, electric: 0, rejected: 0, motorLoss: 0}, inflow = leak * (values.room - T);
    if (n % f.every === 0 && samples.at(-1)?.t !== t) save(t);
    if (n === steps) break;
    energy += q.electric * f.step; removed += q.capacity * f.step; released += q.rejected * f.step; leaked += inflow * f.step;
    motorHeat += q.motorLoss * f.step;
    T += (inflow - q.capacity) * f.step / f.cabinet;
    const previous = on;
    if (on && T <= values.setting - f.band) on = false;
    else if (!on && T >= values.setting + f.band) on = true;
    if (previous !== on) { switches.push({t: t + f.step, on}); save(t + f.step); }
  }
  const starts = switches.filter(s => s.on).map(s => s.t), stops = switches.filter(s => !s.on).map(s => s.t);
  const duty = runningTime({samples, switches}, f.duration) / f.duration;
  let cycleDuty = null, period = null, daily;
  if (starts.length >= 2) {
    const a = starts.at(-2), b = starts.at(-1), stop = stops.find(s => s > a && s < b), energyAt = t => sampleAt(samples, t).energy;
    period = b - a; cycleDuty = (stop - a) / period;
    daily = (energyAt(b) - energyAt(a)) / period * 86400;
  } else daily = (energy - sampleAt(samples, f.duration - 3600).energy) / 3600 * 86400;
  const pulledDown = values.start ? (stops[0] ?? null) : null;
  const plan = {values, leak, table, samples, switches, duty, cycleDuty, period, daily, pulledDown, reaches: stops.length > 0, typical: running(values.setting, values.room, values.coils)};
  if (cache.size > 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

export function sampleFridge(input = {}, time = 0) {
  validTime(time);
  const plan = fridgePlan(input), clock = Math.min(FRIDGE.duration, time);
  const now = {...plan, ...sampleAt(plan.samples, clock), clock, complete: clock >= FRIDGE.duration};
  now.cycle = running(now.T, plan.values.room, plan.values.coils);
  return now;
}

/** Pressure in the cylinder at crank angle theta: re-expansion then suction on the way down, compression then discharge on the way up. */
export function cylinderPressure(c, theta) {
  const ind = indicator(c), {volume} = piston(theta, c.clearance), g = FRIDGE.gamma, down = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) < Math.PI;
  if (down) return volume <= ind.reexpandedAt ? c.Pc * (ind.Vc / volume) ** g : c.Pe;
  return volume >= ind.compressedAt ? c.Pe * (ind.Vb / volume) ** g : c.Pc;
}

/** Seconds the compressor has run by this time. */
export function runningTime(plan, time) {
  let total = 0, since = plan.samples[0].on ? 0 : null;
  for (const change of plan.switches) {
    if (change.t > time) break;
    if (change.on) since = change.t; else { total += change.t - since; since = null; }
  }
  return total + (since === null ? 0 : Math.max(0, time - since));
}

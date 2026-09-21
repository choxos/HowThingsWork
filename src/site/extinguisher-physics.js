import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Fire extinguisher: a 9 liter water extinguisher driven by a cartridge of
// carbon dioxide, as India's standards IS 940 and IS 15683 describe it and as
// Kanex sells it, model KFWCRQ-9. Squeezing the grip drives a pin through the
// cartridge's seal and the gas fills the space above the water; when the
// control valve opens, the gas pushes the water up the siphon tube and out of
// the nozzle, and then escapes itself until the gauge reads zero.
//
// Exact within the model: the cartridge before it is pierced, liquid under its
// vapor read from the carbon dioxide saturation table at the filling ratio IS
// 4947 allows; the gas over the water by Dalton's law, the carbon dioxide's own
// pressure from the van der Waals equation and the air's and the water vapor's
// as ideal gases, all at the water's temperature; the water leaving through the
// nozzle at Bernoulli's speed √(2Δp/ρ) times a discharge coefficient,
// integrated in time with fourth order Runge-Kutta steps as the space grows;
// then the gas leaving through the same opening, choked or not, integrated in
// time until the gauge reads zero; and a drop of the jet under gravity and
// quadratic drag, integrated in time until it meets the floor.
//
// Sourced: carbon dioxide's saturation table, van der Waals constants, molar
// mass, critical point, heat capacity ratio and solubility in water; dry air's
// molar mass and heat capacity ratio; water's density and its vapor pressure by
// the Buck equation; the gas constant, the atmosphere, the bar, the kilogram
// force and standard gravity; a sphere's drag coefficient; Task Force Tips'
// smooth bore flow rule, which gives the discharge coefficient; the orifice
// flow of a gas, choked and not; IS 940's 175 mm body, 9.0 ± 0.5 L, 1.4 mm
// shell, 60 g largest cartridge, 7 mm stroke, 1.5 MN/m² with the nozzle closed
// and 3.0 MN/m² test; IS 4947's filling ratio of 0.667 at 27 °C and its
// cartridge sizes; IS 15683's 6 s wait, effective discharge at 95%, nozzle 1 m
// up and range at half that time; Kanex's 14 bar service pressure, 16 bar
// maximum, 35 s and 6 m.
//
// Declared, not from a source: the body's inside volume, set so a 60 g
// cartridge gives Kanex's 14 bar over 9 L at 27 °C; 2:1 ellipsoidal ends; the
// strainer 10 mm above the bottom; one opening standing in for the valve, the
// siphon tube, the hose and the nozzle, with no other losses, its area set so
// 95% of the water leaves in Kanex's 35 s; drops of one size, set so the jet
// reaches Kanex's 6 m at half that time; the charge released at once, all of
// it gas at the water's temperature, where the gas stays; none of it
// dissolving; the water vapor staying saturated and leaving with the gas as if
// it were the same mixture of carbon dioxide and air, whose heat capacities mix
// by moles; water of 1,000 kg/m³ in TFT's rule; a cartridge 40 mm across; a
// test gauge reading up to 25 bar; water from 6 to 9.5 L and aim from 0 to 45°;
// and a clock running 5 times faster than the discharge.
// ---------------------------------------------------------------------------

export const GAS_CONSTANT = 8.31446261815324;
export const ATMOSPHERE = 101325;
export const BAR = 100000;
export const GRAVITY = 9.80665;
export const ABSOLUTE_ZERO = -273.15;
/** One kilogram-force, N: IS 4947 gives its test pressures in kgf/cm². */
export const KILOGRAM_FORCE = 9.80665;

/** Carbon dioxide: molar mass g/mol; van der Waals a in L² kPa/mol² and b in L/mol; heat capacity ratio at 20 °C; critical temperature °C and pressure MPa. */
export const CO2 = Object.freeze({molar: 44.009, a: 363.96, b: 0.04267, gamma: 1.300, critical: Object.freeze([31.03, 7.38])});
/** Dry air: molar mass kg/mol and heat capacity ratio at 20 °C. */
export const AIR = Object.freeze({molar: 0.0289652, gamma: 1.400});

/** Liquid and vapor carbon dioxide in equilibrium, from the CRC Handbook on the data page: °C, vapor pressure kPa, vapor density and liquid density g/cm³. */
export const SATURATION = Object.freeze([
  [5.00, 3953, 0.1128, 0.8850], [6.11, 4067, 0.1169, 0.8784], [7.22, 4182, 0.1213, 0.8716], [8.33, 4300, 0.1258, 0.8645], [9.44, 4420, 0.1306, 0.8571],
  [10.56, 4544, 0.1355, 0.8496], [11.67, 4670, 0.1408, 0.8418], [12.78, 4798, 0.1463, 0.8338], [13.89, 4929, 0.1521, 0.8254], [15.00, 5063, 0.1583, 0.8168],
  [16.11, 5200, 0.1648, 0.8076], [17.22, 5340, 0.1717, 0.7977], [18.33, 5482, 0.1791, 0.7871], [19.44, 5628, 0.1869, 0.7759], [20.56, 5776, 0.1956, 0.7639],
  [21.67, 5928, 0.2054, 0.7508], [22.78, 6083, 0.2151, 0.7367], [23.89, 6240, 0.2263, 0.7216], [25.00, 6401, 0.2387, 0.7058], [26.11, 6565, 0.2532, 0.6894],
  [27.22, 6733, 0.2707, 0.6720], [28.33, 6902, 0.2923, 0.6507], [29.44, 7081, 0.3204, 0.6209], [30.00, 7164, 0.3378, 0.5992], [30.56, 7253, 0.3581, 0.5661],
  [31.1, 7391, 0.4641, 0.4641],
].map(Object.freeze));

/** Water's density, g/cm³, at °C. */
export const WATER_DENSITY = Object.freeze([[5, 0.99996], [10, 0.9997026], [15, 0.9991026], [20, 0.9982071], [22, 0.9977735], [25, 0.9970479], [30, 0.9956502], [35, 0.99403], [40, 0.99221], [45, 0.99022], [50, 0.98804], [55, 0.98570], [60, 0.98321]].map(Object.freeze));

/** The Buck equation for water's vapor pressure, kPa, with T in °C: P = 0.61121 exp((18.678 − T/234.5)(T/(257.14 + T))). */
export const BUCK = Object.freeze({scale: 0.61121, a: 18.678, b: 234.5, c: 257.14});

/** Grams of carbon dioxide dissolved in 100 mL of water under 1 atm of it, at °C. */
export const SOLUBILITY = Object.freeze([[5, 0.2774], [6, 0.2681], [7, 0.2589], [8, 0.2492], [9, 0.2403], [10, 0.2318], [11, 0.2239], [12, 0.2165], [13, 0.2098], [14, 0.2032], [15, 0.1970], [16, 0.1903], [17, 0.1845], [18, 0.1789], [19, 0.1737], [20, 0.1688], [21, 0.1640], [22, 0.1590], [23, 0.1540], [24, 0.1493], [25, 0.1449], [26, 0.1406], [27, 0.1366], [28, 0.1327], [29, 0.1292], [30, 0.1257], [35, 0.1105], [40, 0.0973], [45, 0.0860], [50, 0.0761], [60, 0.0576]].map(Object.freeze));

/** A smooth sphere's drag coefficient in turbulent flow. */
export const SPHERE_DRAG = 0.47;
/** Task Force Tips' smooth bore rule: gallons a minute = 29.7 × D² × √NP, D in inches and NP in psi. */
export const TFT = Object.freeze({gpm: 29.7});
/** The inch and foot in m, the psi in Pa and the US gallon in L. */
export const UNITS = Object.freeze({inch: 0.0254, foot: 0.3048, psi: 6894.757, gallon: 3.785411784});
/** Torricelli's law page: a discharge coefficient of about 0.65 through a round hole, and over 0.9 through a tube or hose. */
export const TORRICELLI = Object.freeze({hole: 0.65, hose: 0.9});

/** Kanex KFWCRQ-9: liters, mm, s, m, percent, °C and bar, a 60 g cartridge and kg full and empty. */
export const KANEX = Object.freeze({model: 'KFWCRQ-9', liters: 9, rating: '3A', height: 585, diameter: 180, discharge: 35, throw: 6, share: 95, temperatures: Object.freeze([5, 60]), service: 14, maxService: 16, test: 35, cartridge: 60, full: 14.8, empty: 5.8});
/** IS 940:2003: liters and tolerance, mm, the hose's bore and length mm, MN/m² with the nozzle closed, °C and tolerance, g, mm, MN/m² test and burst, and m for s with 95% out within s. */
export const IS940 = Object.freeze({liters: 9, tolerance: 0.5, diameter: 175, shell: 1.4, skirt: 25, neck: 63, hose: Object.freeze([8, 600]), closed: 1.5, normal: Object.freeze([27, 5]), cartridge: 60, stroke: 7, test: 3.0, burst: 4.5, throw: 6, throwFor: 60, share: 95, within: 120});
/** IS 4947:2006: the filling ratio at °C, nominal sizes g, the test and burst pressures kgf/cm², the leak test °C, and the sealing disc's depth mm. */
export const IS4947 = Object.freeze({ratio: 0.667, at: 27, sizes: Object.freeze([20, 40, 60, 90, 120, 180, 200, 250, 300]), test: 250, burst: 650, leak: 75, seal: 12});
/** IS 15683:2006: operating °C, service and maximum service °C with tolerance, percent out for water, percent a trial may keep, the nozzle's height m, range at percent of the effective time, the wait s, the gauge's full scale as percents, and the low pressure line bar. */
export const IS15683 = Object.freeze({operating: Object.freeze([5, 55]), service: Object.freeze([27, 5]), maxService: Object.freeze([55, 5]), share: 95, retained: 5, height: 1, rangeAt: 50, wait: 6, gauge: Object.freeze([150, 250, 120]), lowPressure: 19});
/** Amerex's stored pressure model 240, for comparison: US gallons, psi, s, feet and liters. */
export const AMEREX = Object.freeze({model: 240, gallons: 2.5, psi: 100, seconds: 55, range: Object.freeze([45, 55]), liters: 9.5});

/** Declared, each said in the lesson's limits: the ends' depth over the inside radius, the strainer's height mm, the cartridge's inside radius and wall mm, water's density in TFT's rule, how many times faster the clock runs, the test gauge's full scale bar, the integration step s, chart samples and points along the jet. */
export const DECLARED = Object.freeze({ends: 0.5, strainer: 10, cartridge: Object.freeze({radius: 18.5, wall: 1.5}), tftWater: 1000, fast: 5, dial: 25, step: 0.05, samples: 241, path: 49});

export const CARTRIDGE_OPTIONS = Object.freeze(IS4947.sizes.filter(grams => grams <= IS940.cartridge).map(grams => Object.freeze({value: grams, label: `${grams} g`})));
export const EXTINGUISHER_DEFAULTS = Object.freeze({cartridge: 60, temperature: 27, water: 9, aim: 0});
export const EXTINGUISHER_DOMAINS = Object.freeze({cartridge: Object.freeze([20, 60, 20]), temperature: Object.freeze([5, 55, 1]), water: Object.freeze([6, 9.5, 0.5]), aim: Object.freeze([0, 45, 5])});

/** Straight-line reading between the rows of a table sorted on its first column, held at its ends. */
function interpolate(table, x, column = 1) {
  const last = table.length - 1;
  if (x <= table[0][0]) return table[0][column];
  if (x >= table[last][0]) return table[last][column];
  let i = 1;
  while (table[i][0] < x) i++;
  const a = table[i - 1], b = table[i];
  return a[column] + (b[column] - a[column]) * (x - a[0]) / (b[0] - a[0]);
}

/** The height, 0 to `top`, below which `below(height)` holds `volume`. */
function heightOf(below, volume, top) {
  let lo = 0, hi = top;
  for (let i = 0; i < 90; i++) { const mid = (lo + hi) / 2; if (below(mid) < volume) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

export const kelvinOf = celsius => celsius - ABSOLUTE_ZERO;
/** Water's density, kg/m³. */
export const waterDensity = celsius => 1000 * interpolate(WATER_DENSITY, celsius);
/** Water's vapor pressure, Pa. */
export const vaporPressure = celsius => 1000 * BUCK.scale * Math.exp((BUCK.a - celsius / BUCK.b) * (celsius / (BUCK.c + celsius)));
/** Dry air's density at 1 atm, kg/m³, as an ideal gas. */
export const airDensity = celsius => ATMOSPHERE * AIR.molar / (GAS_CONSTANT * kelvinOf(celsius));
/** Grams of carbon dioxide 100 mL of water holds under 1 atm of it. */
export const solubilityOf = celsius => interpolate(SOLUBILITY, celsius);

const VDW_A = CO2.a * 1e-3, VDW_B = CO2.b * 1e-3, CO2_MOLAR = CO2.molar / 1000;
/** The pressure, Pa, of `moles` of carbon dioxide alone in `volume` m³ at °C, from the van der Waals equation. */
export const co2Pressure = (moles, volume, celsius) => moles * GAS_CONSTANT * kelvinOf(celsius) / (volume - moles * VDW_B) - VDW_A * (moles / volume) ** 2;
/** The same as an ideal gas. */
export const idealPressure = (moles, volume, celsius) => moles * GAS_CONSTANT * kelvinOf(celsius) / volume;

/** The discharge coefficient in TFT's rule: 29.7 gallons a minute against Bernoulli's flow through a 1 inch opening at 1 psi, for water of 1,000 kg/m³. */
export const DISCHARGE = TFT.gpm * UNITS.gallon / 1000 / 60 / (Math.PI / 4 * UNITS.inch ** 2 * Math.sqrt(2 * UNITS.psi / DECLARED.tftWater));

/** A cartridge's inside volume, m³: its grams at IS 4947's filling ratio, over the density of water at 27 °C. */
export const cartridgeVolume = grams => grams / IS4947.ratio / (waterDensity(IS4947.at) / 1000) * 1e-6;

/** The temperature, °C, at which the table's liquid is only as dense as a cartridge's fill, so liquid fills it; the same for every size. */
export const FULL_AT = (() => {
  const fill = IS4947.ratio * waterDensity(IS4947.at) / 1000, i = SATURATION.findIndex(row => row[3] < fill), a = SATURATION[i - 1], b = SATURATION[i];
  return a[0] + (b[0] - a[0]) * (a[3] - fill) / (a[3] - b[3]);
})();

/** A cartridge's shape inside, m: a tube of the declared radius with round ends, as long as its volume needs. */
export function cartridgeShape(grams) {
  const volume = cartridgeVolume(grams), radius = DECLARED.cartridge.radius / 1000, straight = (volume - 4 / 3 * Math.PI * radius ** 3) / (Math.PI * radius ** 2);
  return {grams, volume, radius, straight, length: 2 * radius + straight};
}

/** The volume, m³, inside a round ended tube below `height` from its bottom. */
export function tubeVolumeBelow(shape, height) {
  const {radius: r, straight: l} = shape, cap = h => Math.PI * h * h * (3 * r - h) / 3;
  if (height <= 0) return 0;
  if (height <= r) return cap(height);
  if (height <= r + l) return cap(r) + Math.PI * r * r * (height - r);
  if (height >= 2 * r + l) return shape.volume;
  return shape.volume - cap(2 * r + l - height);
}

/** The saturation table read at °C: vapor pressure Pa, vapor and liquid density kg/m³; null above the critical point, where no liquid forms. */
export const saturationAt = celsius => (celsius < CO2.critical[0] ? {pressure: 1000 * interpolate(SATURATION, celsius, 1), vapor: 1000 * interpolate(SATURATION, celsius, 2), liquid: 1000 * interpolate(SATURATION, celsius, 3)} : null);

/** The cartridge before it is pierced: liquid under its vapor at the table's pressure, or liquid filling it from FULL_AT up, when the table no longer gives its pressure. */
export function cartridgeOf(grams, celsius) {
  const shape = cartridgeShape(grams), fill = grams / 1000 / shape.volume;
  if (celsius >= FULL_AT) return {...shape, fill, full: true, pressure: null, vapor: null, liquid: null, share: 1, liquidMass: 1, level: shape.length};
  const {pressure, vapor, liquid} = saturationAt(celsius), share = (fill - vapor) / (liquid - vapor);
  return {...shape, fill, full: false, pressure, vapor, liquid, share, liquidMass: share * liquid / fill, level: heightOf(h => tubeVolumeBelow(shape, h), share * shape.volume, shape.length)};
}

/** The saturated vapor's density, kg/m³, the densest the gas can be before liquid forms; null above the critical point. */
export const saturatedVapor = celsius => saturationAt(celsius)?.vapor ?? null;

/** The gauge pressure, Pa, once a cartridge's gas has filled the space in a body of `volume` m³ holding `liters` at °C: air at 1 atm less the vapor, squeezed into the space and the cartridge, plus the vapor and the carbon dioxide. */
function gaugeOver(volume, grams, celsius, liters) {
  const vapor = vaporPressure(celsius), space = volume - liters / 1000, gas = space + cartridgeVolume(grams);
  return (ATMOSPHERE - vapor) * space / gas + vapor + co2Pressure(grams / CO2.molar, gas, celsius) - ATMOSPHERE;
}

/** The body's inside, m: IS 940's outside diameter less its 1.4 mm shell, 2:1 ellipsoidal ends, and the volume at which a 60 g cartridge gives Kanex's 14 bar over 9 L at 27 °C. */
export const BODY = (() => {
  const radius = (IS940.diameter / 2 - IS940.shell) / 1000, head = radius * DECLARED.ends, disc = Math.PI * radius ** 2, ends = 4 / 3 * disc * head;
  let lo = KANEX.liters / 1000, hi = 3 * KANEX.liters / 1000;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (gaugeOver(mid, KANEX.cartridge, IS15683.service[0], KANEX.liters) > KANEX.service * BAR) lo = mid; else hi = mid; }
  const volume = (lo + hi) / 2, straight = (volume - ends) / disc;
  return Object.freeze({radius, head, straight, volume, height: 2 * head + straight});
})();

/** The service gauge pressure, Pa, in this body. */
export const serviceGauge = (grams, celsius, liters) => gaugeOver(BODY.volume, grams, celsius, liters);

/** The volume, m³, inside the body below `height` m from the inside of its bottom. */
export function volumeBelow(height, body = BODY) {
  const {radius, head, straight, volume} = body, disc = Math.PI * radius ** 2, cap = h => disc * h * h * (3 * head - h) / (3 * head * head);
  if (height <= 0) return 0;
  if (height <= head) return cap(height);
  if (height <= head + straight) return cap(head) + disc * (height - head);
  if (height >= body.height) return volume;
  return volume - cap(body.height - height);
}

/** How high, m, water of `volume` m³ stands in the body. */
export const levelOf = (volume, body = BODY) => heightOf(h => volumeBelow(h, body), volume, body.height);

/** The water the strainer cannot reach, m³: what lies below it. */
export const RESIDUAL = volumeBelow(DECLARED.strainer / 1000);

/** How far, m, a drop `drop` m across goes through air at °C while drag alone slows it by a factor e. */
export const dragLength = (drop, celsius) => 4 / 3 * waterDensity(celsius) / airDensity(celsius) * drop / SPHERE_DRAG;

/** How far a jet from a nozzle 1 m up would reach with no air. */
export function vacuumReach(speed, aim, height = IS15683.height) {
  const angle = aim * Math.PI / 180, across = speed * Math.cos(angle), up = speed * Math.sin(angle);
  return across * (up + Math.sqrt(up * up + 2 * GRAVITY * height)) / GRAVITY;
}

/**
 * A drop leaving the nozzle 1 m above the floor at `speed` m/s, `aim` degrees
 * up, slowed by quadratic drag and pulled down by gravity, stepped in time
 * until it meets the floor: its flight, its reach and `points` places along
 * the way, evenly spaced in time, the last where it lands.
 */
export function jetPath(speed, aim, celsius, drop, points = DECLARED.path) {
  const length = dragLength(drop, celsius), angle = aim * Math.PI / 180, height = IS15683.height;
  const derive = (x, y, u, w) => { const s = Math.hypot(u, w); return [u, w, -s * u / length, -s * w / length - GRAVITY]; };
  const step = ([x, y, u, w], h) => {
    const k1 = derive(x, y, u, w), k2 = derive(x + h / 2 * k1[0], y + h / 2 * k1[1], u + h / 2 * k1[2], w + h / 2 * k1[3]);
    const k3 = derive(x + h / 2 * k2[0], y + h / 2 * k2[1], u + h / 2 * k2[2], w + h / 2 * k2[3]), k4 = derive(x + h * k3[0], y + h * k3[1], u + h * k3[2], w + h * k3[3]);
    return [x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), u + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), w + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])];
  };
  const start = [0, height, speed * Math.cos(angle), speed * Math.sin(angle)], dt = Math.min(2e-3, length / speed / 40);
  let state = start, time = 0;
  for (let next = step(state, dt); next[1] > 0; next = step(state, dt)) { state = next; time += dt; }
  let lo = 0, hi = dt;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (step(state, mid)[1] > 0) lo = mid; else hi = mid; }
  const last = (lo + hi) / 2, landing = step(state, last), flight = time + last;
  const intervals = points - 1, sub = Math.max(1, Math.ceil(flight / intervals / dt)), h = flight / intervals / sub, path = [[0, height]];
  let s = start, peak = height;
  for (let j = 1; j < intervals; j++) { for (let k = 0; k < sub; k++) s = step(s, h); path.push([s[0], s[1]]); peak = Math.max(peak, s[1]); }
  path.push([landing[0], 0]);
  return {speed, aim, drop, length, flight, reach: landing[0], peak, landing: Math.hypot(landing[2], landing[3]), path};
}

/**
 * The discharge at an opening of `area` m²: the water phase stepped from the
 * valve's opening until the water reaches the strainer, then the gas phase
 * until the gauge reads zero, each sample one step apart.
 */
function runOf(values, area) {
  const {cartridge: grams, temperature: celsius, water: liters} = values;
  const kelvin = kelvinOf(celsius), density = waterDensity(celsius), vapor = vaporPressure(celsius), dt = DECLARED.step;
  const water = liters / 1000, space = BODY.volume - water, shape = cartridgeShape(grams);
  const co2 = grams / CO2.molar, air = (ATMOSPHERE - vapor) * space / (GAS_CONSTANT * kelvin);
  const gasVolume = left => BODY.volume - left + shape.volume;
  const gauge = left => { const volume = gasVolume(left); return air * GAS_CONSTANT * kelvin / volume + vapor + co2Pressure(co2, volume, celsius) - ATMOSPHERE; };
  const flowOf = left => { const dp = gauge(left); return dp > 0 ? DISCHARGE * area * Math.sqrt(2 * dp / density) : 0; };
  const waterStep = (left, h) => { const k1 = -flowOf(left), k2 = -flowOf(left + h / 2 * k1), k3 = -flowOf(left + h / 2 * k2), k4 = -flowOf(left + h * k3); return left + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); };
  const crossing = (left, target) => { let lo = 0, hi = dt; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (waterStep(left, mid) > target) lo = mid; else hi = mid; } return (lo + hi) / 2; };

  // The water: stepped until it reaches the strainer, or, were the gas ever too weak, until it stops.
  const target = water * (1 - IS15683.share / 100), lefts = [water];
  let effective = null, out = null, stalled = false;
  for (let k = 0; out === null; k++) {
    const left = lefts[k], next = waterStep(left, dt);
    if (effective === null && next <= target) effective = k * dt + crossing(left, target);
    if (next <= RESIDUAL) out = k * dt + crossing(left, RESIDUAL);
    else if (flowOf(left) === 0) { out = k * dt; stalled = true; } else lefts.push(next);
  }
  const leftAtOut = stalled ? lefts.at(-1) : RESIDUAL, volume = gasVolume(leftAtOut);

  // The gas: carbon dioxide and air leaving together, the vapor held at saturation.
  const moles = co2 + air, fraction = co2 / moles, kind = fraction * CO2.gamma / (CO2.gamma - 1) + (1 - fraction) * AIR.gamma / (AIR.gamma - 1);
  const gamma = kind / (kind - 1), molar = fraction * CO2_MOLAR + (1 - fraction) * AIR.molar, critical = (2 / (gamma + 1)) ** (gamma / (gamma - 1));
  const gaugeOfMoles = n => (1 - fraction) * n * GAS_CONSTANT * kelvin / volume + vapor + co2Pressure(fraction * n, volume, celsius) - ATMOSPHERE;
  let lo = 0, hi = moles;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (gaugeOfMoles(mid) > 0) hi = mid; else lo = mid; }
  const remaining = (lo + hi) / 2;
  const massFlow = n => {
    const upstream = gaugeOfMoles(n) + ATMOSPHERE;
    if (upstream <= ATMOSPHERE) return 0;
    const ratio = Math.max(ATMOSPHERE / upstream, critical), gasDensity = upstream * molar / (GAS_CONSTANT * kelvin);
    return DISCHARGE * area * Math.sqrt(2 * gasDensity * upstream * gamma / (gamma - 1) * (ratio ** (2 / gamma) - ratio ** ((gamma + 1) / gamma)));
  };
  // Stepped in u = √(n − remaining), whose rate stays finite as the gauge falls to zero.
  const u0 = stalled ? 0 : Math.sqrt(moles - remaining), floor = 1e-6 * u0;
  const rate = u => { const v = Math.max(u, floor); return -massFlow(remaining + v * v) / (molar * 2 * v); };
  const gasStep = (u, h) => { const k1 = rate(u), k2 = rate(u + h / 2 * k1), k3 = rate(u + h / 2 * k2), k4 = rate(u + h * k3); return u + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); };
  const roots = [u0];
  let gasTime = 0;
  if (!stalled) {
    for (let k = 0; ; k++) {
      const u = roots[k], next = gasStep(u, dt);
      if (next <= 0) { let a = 0, b = dt; for (let i = 0; i < 60; i++) { const mid = (a + b) / 2; if (gasStep(u, mid) > 0) a = mid; else b = mid; } gasTime = k * dt + (a + b) / 2; break; }
      roots.push(next);
    }
  }
  const open = IS15683.wait;
  return {values, kelvin, density, vapor, water, space, shape, co2, air, gasVolume, gauge, flowOf, waterStep, lefts, effective, out, stalled, leftAtOut, volume, fraction, gamma, molar, critical, gaugeOfMoles, remaining, massFlow, gasStep, roots, gasTime, open, outAt: open + out, completeAt: open + out + gasTime};
}

/** The water left, m³, `since` seconds after the valve opened: a part step from the sample before. */
function waterAt(run, since) {
  if (since >= run.out) return run.leftAtOut;
  const k = Math.min(run.lefts.length - 1, Math.floor(since / DECLARED.step));
  return run.waterStep(run.lefts[k], since - k * DECLARED.step);
}

/** Moles of gas left, `since` seconds after the water ran out. */
function molesAt(run, since) {
  if (since >= run.gasTime) return run.remaining;
  const k = Math.min(run.roots.length - 1, Math.floor(since / DECLARED.step)), u = Math.max(0, run.gasStep(run.roots[k], since - k * DECLARED.step));
  return run.remaining + u * u;
}

/** The opening's area and bore: set so 95% of 9 L leaves in Kanex's 35 s, the time scaling as one over the area. */
export const NOZZLE = (() => {
  let area = 1e-5;
  for (let i = 0; i < 3; i++) area *= runOf(EXTINGUISHER_DEFAULTS, area).effective / KANEX.discharge;
  return Object.freeze({area, bore: Math.sqrt(4 * area / Math.PI)});
})();

/** The drops' size, m: set so the jet leaving level at half the effective time lands Kanex's 6 m away. */
export const DROP = (() => {
  const run = runOf(EXTINGUISHER_DEFAULTS, NOZZLE.area), speed = Math.sqrt(2 * run.gauge(waterAt(run, run.effective / 2)) / run.density);
  let lo = 1e-6, hi = 1e-2;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (jetPath(speed, 0, EXTINGUISHER_DEFAULTS.temperature, mid).reach < KANEX.throw) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
})();

/** Where the run stands at `time` s after the squeeze; `withPath` adds the jet's path. */
function stateAt(plan, time, withPath) {
  const run = plan.run, {temperature: celsius, aim} = plan.values, t = Math.min(time, plan.duration);
  const stage = t <= 0 ? 'ready' : t < run.open ? 'pierced' : t < run.outAt ? 'water' : t < run.completeAt ? 'gas' : 'done';
  const left = stage === 'ready' || stage === 'pierced' ? run.water : stage === 'water' ? waterAt(run, t - run.open) : run.leftAtOut;
  const late = stage === 'gas' || stage === 'done', moles = stage === 'gas' ? molesAt(run, t - run.outAt) : stage === 'done' ? run.remaining : run.co2 + run.air;
  const volume = stage === 'ready' ? run.space : late ? run.volume : run.gasVolume(left);
  const co2Moles = stage === 'ready' ? 0 : late ? run.fraction * moles : run.co2, airMoles = late ? (1 - run.fraction) * moles : run.air;
  const partials = {air: airMoles * GAS_CONSTANT * run.kelvin / volume, vapor: run.vapor, co2: co2Pressure(co2Moles, volume, celsius), ideal: idealPressure(co2Moles, volume, celsius)};
  const gauge = stage === 'ready' || stage === 'done' ? 0 : stage === 'gas' ? Math.max(0, run.gaugeOfMoles(moles)) : run.gauge(left);
  const flowing = stage === 'water', speed = flowing ? Math.sqrt(2 * gauge / run.density) : 0, flow = flowing ? DISCHARGE * NOZZLE.area * speed : 0;
  const path = withPath && flowing ? jetPath(speed, aim, celsius, DROP) : null;
  const gasFlow = stage === 'gas' ? run.massFlow(moles) : 0;
  return {time, t, stage, pierced: t > 0, open: t >= run.open, left, share: left / run.water, level: levelOf(left), moles, co2Moles, airMoles, volume, partials, gauge, speed, flow, path, reach: path ? path.reach : null, gasFlow, choked: stage === 'gas' && ATMOSPHERE / (gauge + ATMOSPHERE) <= run.critical, done: time >= plan.duration};
}

const plans = new Map();

/** Everything about a discharge that does not change as the clock runs. */
export function extinguisherPlan(input) {
  const values = validateControls(input, EXTINGUISHER_DEFAULTS, EXTINGUISHER_DOMAINS, 'fire extinguisher');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const {cartridge: grams, temperature: celsius, water: liters, aim} = values, run = runOf(values, NOZZLE.area);
  const service = run.gauge(run.water), gasAtStart = run.gasVolume(run.water), speed = Math.sqrt(2 * service / run.density);
  const half = run.effective === null ? null : run.effective / 2, halfLeft = half === null ? null : waterAt(run, half), halfGauge = half === null ? null : run.gauge(halfLeft), halfSpeed = half === null ? null : Math.sqrt(2 * halfGauge / run.density);
  const co2Start = co2Pressure(run.co2, gasAtStart, celsius);
  const plan = {
    values, run, grams, celsius, liters, aim, duration: run.completeAt, open: run.open, fast: DECLARED.fast,
    cartridge: cartridgeOf(grams, celsius), service, serviceAt: Object.freeze({normal: serviceGauge(grams, IS15683.service[0], liters), hot: serviceGauge(grams, IS15683.maxService[0], liters)}),
    partials: {air: run.air * GAS_CONSTANT * run.kelvin / gasAtStart, vapor: run.vapor, co2: co2Start, ideal: idealPressure(run.co2, gasAtStart, celsius)},
    co2Density: grams / 1000 / gasAtStart, saturated: saturatedVapor(celsius), dissolvable: solubilityOf(celsius) * co2Start / ATMOSPHERE * liters * 10,
    speed, flow: DISCHARGE * NOZZLE.area * speed, start: jetPath(speed, aim, celsius, DROP), startLevel: jetPath(speed, 0, celsius, DROP),
    effective: run.effective, effectiveAt: run.effective === null ? null : run.open + run.effective, half, halfAt: half === null ? null : run.open + half, halfLeft, halfGauge, halfSpeed,
    range: half === null ? null : jetPath(halfSpeed, 0, celsius, DROP).reach, vacuumRange: half === null ? null : vacuumReach(halfSpeed, 0),
    outAt: run.outAt, outGauge: run.gauge(run.leftAtOut), gasTime: run.gasTime, retained: run.leftAtOut / run.water, stalled: run.stalled,
    vented: (run.co2 + run.air - run.remaining) * run.molar, chokedFor: null,
  };
  // How long the gas leaves choked: until its pressure falls to 1 atm over the critical ratio.
  if (!run.stalled) {
    const unchoke = ATMOSPHERE / run.critical;
    if (plan.outGauge + ATMOSPHERE <= unchoke) plan.chokedFor = 0;
    else { let lo = 0, hi = run.gasTime; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (run.gaugeOfMoles(molesAt(run, mid)) + ATMOSPHERE > unchoke) lo = mid; else hi = mid; } plan.chokedFor = (lo + hi) / 2; }
  }
  plan.chart = Object.freeze(Array.from({length: DECLARED.samples}, (_, j) => { const t = plan.duration * j / (DECLARED.samples - 1), now = stateAt(plan, t, false); return Object.freeze({t, gauge: now.gauge, share: now.share}); }));
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The extinguisher `time` seconds after the grip is squeezed. */
export function extinguisherAt(plan, time) {
  validTime(time);
  return stateAt(plan, time, true);
}

export const sampleExtinguisher = (input, time = 0) => extinguisherAt(extinguisherPlan(input), time);

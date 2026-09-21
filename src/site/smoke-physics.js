import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Smoke detector: an americium source firing alpha particles across an air
// gap, the ion pairs they leave, the current a small voltage draws from them,
// the same current with smoke particles catching ions, an infrared beam
// scattered by those particles onto a photodiode off the beam, the same beam
// dimmed along its path, and the two comparators that decide to sound a horn.
//
// Exact within the model: an alpha's energy after a gold cover and after any
// distance of air, read from ASTAR's tables of stopping power and CSDA range;
// the ion pairs one alpha leaves in a chamber, its energy lost there over the
// 33.97 eV air takes for a pair, averaged over the directions it can leave in;
// the saturation current e × pairs per second; the steady ion density of a
// uniform chamber, q = αn² + (2μV/g² + β)n, and the current e·Vol·n·2μV/g²
// it carries, which goes to the saturation current at a high voltage and to
// Hosemann's ionization signal at a low one; Mie scattering by a sphere, by
// Bohren and Huffman's series; Beer and Lambert's law along a path.
//
// Sourced: americium-241's half-life, its specific activity, the three alpha
// energies and their shares, the 37 kBq and 0.29 μg of a smoke detector, and
// the button's 5.1 mm, 0.2 mm and gold cover of about one percent of that;
// 33.97 eV for an ion pair in dry air; ASTAR's tables for air and gold; air's
// density and the mobility of its ions; the Einstein relation between mobility
// and diffusion, and the 4πDR a sphere catches by diffusion; the MC14467-1's
// set point, hysteresis, low battery window, sampling periods and horn; the
// RE46C190's sampling periods, three detections, pulse and programmable limit;
// the TSAL6200's wavelength, beam angle and radiant intensity; the BPW34's
// area and current in a known irradiance; NIST's alarm thresholds in percent
// obscuration a meter, its smoke sizes and masses, and its measuring chamber.
//
// Declared, not from a source: the chamber drawn as two halves of one cylinder
// over one source, 10 mm in radius, the open half 15 mm tall and the sealed
// half 24.7 mm, which is where calibration puts it; a quarter of the decays
// into each half, the silver backing taking the rest; the recombination
// coefficient 1.6 × 10⁻¹² m³/s; the low battery trip at 7.5 V inside the
// datasheet's window; the optical chamber's 12 mm from the emitter to the
// smoke and 12 mm on to the photodiode, a scattering volume 6 mm across and
// 10 mm long, a direct beam 30 mm long and a projected beam 10 m long; smoke
// of one size at a time, of refractive index 1.5 and density 1,000 kg/m³,
// growing at a steady rate in the room and entering both chambers with a 20 s
// lag; and a run of 10 minutes.
// ---------------------------------------------------------------------------

export const ELEMENTARY = 1.602176634e-19;
export const BOLTZMANN = 1.380649e-23;
export const FOOT = 0.3048;

/** Americium-241: half-life in years, specific activity in Bq/g, the mass and activity of a detector's source, its gamma in keV and share, the button in mm, the gold cover's share of its thickness, and the neptunium in it after 19 and 32 years. */
export const AMERICIUM = Object.freeze({halfLife: 432.6, specific: 126.91e9, mass: 0.29e-6, activity: 37e3, gamma: 59.5409, gammaShare: 0.36, diameter: 5.1, thickness: 0.2, coverShare: 0.01, aged: Object.freeze([Object.freeze([19, 3]), Object.freeze([32, 5])])});
/** The alpha energies in MeV and the share of decays each takes. */
export const LINES = Object.freeze([Object.freeze([5.486, 0.85]), Object.freeze([5.443, 0.13]), Object.freeze([5.388, 0.02])]);
/** Energy, eV, that making one ion pair in dry air takes. */
export const PAIR_ENERGY = 33.97;
/** Dry air near sea level: density in kg/m³ at 20 °C, the mobility of its ions in m²/(V·s), and that temperature in K. */
export const AIR = Object.freeze({density: 1.2041, mobility: 1.5e-4, temperature: 293.15});
/** Gold's density in g/cm³. */
export const GOLD_DENSITY = 19.3;

/** ASTAR for alpha particles in air: kinetic energy in MeV, total stopping power in MeV cm²/g, CSDA range in g/cm². */
export const ASTAR_AIR = Object.freeze([
  [0.001, 221.5, 5.377e-06], [0.0015, 234.2, 7.562e-06], [0.002, 244.4, 9.651e-06], [0.0025, 253.6, 1.166e-05], [0.003, 262.2, 1.36e-05], [0.004, 278.4, 1.73e-05], [0.005, 293.7, 2.079e-05], [0.006, 308.4, 2.411e-05], [0.007, 322.5, 2.728e-05], [0.008, 336.2, 3.032e-05], [0.009, 349.5, 3.324e-05], [0.01, 362.5, 3.605e-05],
  [0.0125, 393.3, 4.266e-05], [0.015, 422.5, 4.879e-05], [0.0175, 450.1, 5.452e-05], [0.02, 476.5, 5.992e-05], [0.0225, 501.8, 6.503e-05], [0.025, 526.0, 6.989e-05], [0.0275, 549.4, 7.454e-05], [0.03, 572.0, 7.9e-05], [0.035, 615.0, 8.743e-05], [0.04, 655.7, 9.53e-05], [0.045, 694.2, 0.0001027], [0.05, 731.0, 0.0001097],
  [0.055, 766.1, 0.0001164], [0.06, 799.8, 0.0001228], [0.065, 832.3, 0.0001289], [0.07, 863.6, 0.0001348], [0.075, 893.8, 0.0001405], [0.08, 923.0, 0.000146], [0.085, 951.4, 0.0001513], [0.09, 978.8, 0.0001565], [0.095, 1006.0, 0.0001616], [0.1, 1031.0, 0.0001665], [0.125, 1151.0, 0.0001894], [0.15, 1257.0, 0.0002101],
  [0.175, 1352.0, 0.0002293], [0.2, 1437.0, 0.0002472], [0.225, 1513.0, 0.0002642], [0.25, 1582.0, 0.0002803], [0.275, 1643.0, 0.0002958], [0.3, 1698.0, 0.0003108], [0.35, 1792.0, 0.0003394], [0.4, 1866.0, 0.0003667], [0.45, 1923.0, 0.0003931], [0.5, 1964.0, 0.0004188], [0.55, 1993.0, 0.0004441], [0.6, 2012.0, 0.000469],
  [0.65, 2020.0, 0.0004938], [0.7, 2021.0, 0.0005186], [0.75, 2016.0, 0.0005433], [0.8, 2005.0, 0.0005682], [0.85, 1989.0, 0.0005932], [0.9, 1970.0, 0.0006185], [0.95, 1948.0, 0.000644], [1.0, 1924.0, 0.0006698], [1.25, 1776.0, 0.0008049], [1.5, 1626.0, 0.000952], [1.75, 1495.0, 0.001112], [2.0, 1383.0, 0.001287],
  [2.25, 1288.0, 0.001474], [2.5, 1206.0, 0.001675], [2.75, 1134.0, 0.001889], [3.0, 1072.0, 0.002116], [3.5, 969.3, 0.002607], [4.0, 886.5, 0.003147], [4.5, 818.6, 0.003734], [5.0, 761.2, 0.004368], [5.486, 713.5, 0.005028], [5.5, 712.2, 0.005048], [6.0, 670.0, 0.005772], [6.5, 633.1, 0.00654], [7.0, 600.5, 0.007351],
  [7.5, 571.6, 0.008205], [8.0, 545.6, 0.0091],
].map(Object.freeze));

/** ASTAR for alpha particles in gold, the same three columns. */
export const ASTAR_GOLD = Object.freeze([
  [0.001, 17.28, 9.597e-05], [0.0015, 20.88, 0.000122], [0.002, 23.86, 0.0001444], [0.0025, 26.46, 0.0001642], [0.003, 28.8, 0.0001823], [0.004, 32.94, 0.0002147], [0.005, 36.58, 0.0002435], [0.006, 39.87, 0.0002697], [0.007, 42.9, 0.0002938], [0.008, 45.73, 0.0003164], [0.009, 48.4, 0.0003376], [0.01, 50.94, 0.0003578],
  [0.0125, 56.83, 0.0004042], [0.015, 62.21, 0.0004462], [0.0175, 67.2, 0.0004848], [0.02, 71.9, 0.0005208], [0.0225, 76.36, 0.0005545], [0.025, 80.61, 0.0005863], [0.0275, 84.68, 0.0006166], [0.03, 88.59, 0.0006455], [0.035, 96.04, 0.0006996], [0.04, 103.0, 0.0007499], [0.045, 109.7, 0.0007969], [0.05, 116.0, 0.0008412],
  [0.055, 122.1, 0.0008832], [0.06, 127.9, 0.0009232], [0.065, 133.5, 0.0009614], [0.07, 139.0, 0.0009981], [0.075, 144.2, 0.001033], [0.08, 149.3, 0.001068], [0.085, 154.3, 0.0011], [0.09, 159.1, 0.001132], [0.095, 163.8, 0.001163], [0.1, 168.3, 0.001193], [0.125, 189.7, 0.001333], [0.15, 208.8, 0.001459],
  [0.175, 226.2, 0.001574], [0.2, 242.0, 0.00168], [0.225, 256.6, 0.001781], [0.25, 269.9, 0.001876], [0.275, 282.2, 0.001966], [0.3, 293.4, 0.002053], [0.35, 313.3, 0.002218], [0.4, 330.1, 0.002373], [0.45, 344.1, 0.002521], [0.5, 355.7, 0.002664], [0.55, 365.1, 0.002803], [0.6, 372.7, 0.002938],
  [0.65, 378.7, 0.003071], [0.7, 383.2, 0.003203], [0.75, 386.5, 0.003332], [0.8, 388.8, 0.003461], [0.85, 390.0, 0.00359], [0.9, 390.5, 0.003718], [0.95, 390.3, 0.003846], [1.0, 389.5, 0.003974], [1.25, 385.1, 0.004619], [1.5, 376.3, 0.005275], [1.75, 363.1, 0.005951], [2.0, 347.3, 0.006655],
  [2.25, 331.0, 0.007392], [2.5, 316.8, 0.008165], [2.75, 304.4, 0.00897], [3.0, 293.4, 0.009807], [3.5, 274.4, 0.01157], [4.0, 258.7, 0.01345], [4.5, 245.3, 0.01543], [5.0, 233.6, 0.01752], [5.486, 223.6, 0.01965], [5.5, 223.4, 0.01971], [6.0, 214.2, 0.022], [6.5, 206.0, 0.02438], [7.0, 198.6, 0.02685],
  [7.5, 191.8, 0.02942], [8.0, 185.6, 0.03207],
].map(Object.freeze));

/** The MC14467-1 ionization detector IC: supply window in V, set point and its window as shares of the supply, hysteresis in V, low battery window in V, seconds between checks with and without smoke, the horn's on and off times in s, seconds between battery checks, the chirp in s, the detect input's leakage in A, the guard's window in V, and the supply current in A. */
export const IONIZATION_IC = Object.freeze({name: 'MC14467-1', supply: Object.freeze([6, 12]), set: 0.5, setWindow: Object.freeze([0.47, 0.53]), hysteresis: 0.1, lowWindow: Object.freeze([7.2, 7.8]), period: 1.67, smokePeriod: 0.04, hornOn: 0.16, hornOff: 0.08, batteryEvery: 40, chirp: 0.01, leak: 1e-12, guard: 0.1, draw: 5e-6, load: 0.01});
/** The RE46C190 photoelectric detector ASIC: seconds between checks in standby, after one detection and after two, how many in a row sound the alarm, the emitter pulse in s and its window, the emitter current in A and its window, the largest current its limit can be set to in A, the steps that limit is stored in, seconds between chamber checks, and the chirp in s. */
export const PHOTO_IC = Object.freeze({name: 'RE46C190', period: 10.7, afterOne: 2, afterTwo: 1, needed: 3, pulse: 100e-6, pulseWindow: Object.freeze([100e-6, 400e-6]), emitter: 0.1, emitterWindow: Object.freeze([0.05, 0.2]), limitFull: 58e-9, steps: 31, chamberEvery: 43, chirp: 0.01});
/** The TSAL6200 emitter: peak wavelength in m, radiant intensity in W/sr at 100 mA with its window, radiant power in W, the angle of half intensity in degrees, and the forward voltage in V. */
export const EMITTER = Object.freeze({name: 'TSAL6200', wavelength: 940e-9, intensity: 0.072, intensityWindow: Object.freeze([0.04, 0.2]), power: 0.04, half: 17, forward: 1.35});
/** The BPW34 photodiode: its area in m², the current it gives in an irradiance of 1 mW/cm² at 950 nm, that irradiance in W/m², the angle of half sensitivity in degrees, and its dark current in A. */
export const DIODE = Object.freeze({name: 'BPW34', area: 7.5e-6, current: 50e-6, irradiance: 10, half: 65, dark: 2e-9});

/** What the pages and NIST give about alarms and smoke: the disk in mm, the sounder in Hz and dB at 3 ft, a 9 V battery in mm, the sizes of flaming and smoldering smoke in μm, obscuration ratings in %/ft, NIST's low, middle and high alarm thresholds in %/m, the sensitivities two ionization alarms and one photoelectric alarm were listed at in %/m, the average of all alarms tested, and how much sooner each kind answered its own fire in seconds and minutes. */
export const RATED = Object.freeze({
  disk: 125, thick: 25, tone: Object.freeze([2900, 3500]), loud: 95, loudAt: 3, battery: Object.freeze([48.5, 26.5, 17.5]),
  flaming: Object.freeze([0.01, 0.3]), smoldering: Object.freeze([0.3, 10]),
  ionRating: Object.freeze([0.8, 1.5]), photoRating: Object.freeze([0.2, 4]),
  ionization: Object.freeze([2.6, 4.3, 5.9]), photoelectric: Object.freeze([3.3, 6.6, 9.8]),
  listedIon: Object.freeze([4.13, 4.23]), listedPhoto: 6.76, average: 5.1, averageBand: 1,
  flamingFaster: Object.freeze([57, 62]), smolderingFaster: Object.freeze([47, 53]),
});
/** NIST's measuring ionization chamber: its voltage in V, its flow in L/min, its clean air current in A, and its current in A at 1.0, 1.3, 2.4 and 2.9 %/m. */
export const MEASURING_CHAMBER = Object.freeze({volts: 18, flow: 30, clean: 95e-12, band: 5e-12, rows: Object.freeze([Object.freeze([1, 85.2e-12]), Object.freeze([1.3, 77.1e-12]), Object.freeze([2.4, 68.3e-12]), Object.freeze([2.9, 63.5e-12])])});
/** Smoke NIST caught in a cascade impactor: its mass median diameter in μm, the spread of that distribution, and its mass concentration in kg/m³. */
export const IMPACTOR = Object.freeze([
  Object.freeze({name: 'Flaming chair', diameter: 0.32, spread: 4, mass: 78.3e-6}),
  Object.freeze({name: 'Cooking oil', diameter: 1, spread: 2.5, mass: 41.3e-6}),
  Object.freeze({name: 'Smoldering chair', diameter: 2.3, spread: 1.7, mass: 11.5e-6}),
]);

/** The ionization chamber as this model declares it: the radius and the two gaps in mm, the gold cover in μm, the share of decays entering each half, the recombination coefficient in m³/s, and the low battery trip in V. */
export const CHAMBER = Object.freeze({radius: 10, sensing: 15, reference: 24.7, cover: 2, share: 0.25, recombination: 1.6e-12, lowBattery: 7.5, steps: 2000});
/** The optical chamber as this model declares it: mm from the emitter to the smoke it lights, mm from that smoke to the photodiode off the beam, the lit volume's width and length in mm, the direct beam's path in mm, a projected beam's path in m, and smoke's refractive index. */
export const OPTICS = Object.freeze({source: 12, sensor: 12, beam: 6, length: 10, direct: 30, room: 10, index: 1.5, limitSteps: 30});
/** The run as this model declares it: smoke's density in kg/m³, the seconds a chamber lags the room, the seconds the run lasts, and how many times faster than real time it is drawn. */
export const SMOKE = Object.freeze({density: 1000, lag: 20, duration: 600, speed: 20, samples: 121});

export const SIZE_OPTIONS = Object.freeze([
  Object.freeze({value: 0.1, label: '0.1 μm, from flames'}),
  Object.freeze({value: 0.3, label: '0.3 μm, the boundary'}),
  Object.freeze({value: 1, label: '1 μm, cooking oil'}),
  Object.freeze({value: 3, label: '3 μm, smoldering'}),
]);
export const SMOKE_DEFAULTS = Object.freeze({size: 0.3, growth: 10, battery: 9, angle: 21});
export const SMOKE_DOMAINS = Object.freeze({size: Object.freeze([0.1, 3, 0.1]), growth: Object.freeze([1, 50, 1]), battery: Object.freeze([6.5, 9.5, 0.1]), angle: Object.freeze([15, 165, 1])});

/** The diffusion coefficient of an air ion, m²/s, from its mobility by the Einstein relation D = μ kT / e. */
export const DIFFUSION = AIR.mobility * BOLTZMANN * AIR.temperature / ELEMENTARY;
/** The photodiode's responsivity, A/W, from the current it gives in a known irradiance over its area. */
export const RESPONSIVITY = DIODE.current / (DIODE.irradiance * DIODE.area);
/** The limit the photoelectric IC holds, A: whole steps of its resolution, stored at calibration. */
export const PHOTO_LIMIT = PHOTO_IC.limitFull * OPTICS.limitSteps / PHOTO_IC.steps;
/** The alphas that leave the gold face of the source each second. */
export const OUTWARD = AMERICIUM.activity / 2;

const between = (lowX, highX, lowY, highY, x) => Math.exp(Math.log(lowY) + (Math.log(x) - Math.log(lowX)) / (Math.log(highX) - Math.log(lowX)) * (Math.log(highY) - Math.log(lowY)));

/** A column of an ASTAR table read at an energy, between rows on a logarithm, and proportionally below the table's first row. */
export function astarAt(table, energy, column) {
  if (!(energy > 0)) return 0;
  if (energy <= table[0][0]) return table[0][column] * (column === 2 ? energy / table[0][0] : 1);
  if (energy >= table[table.length - 1][0]) return table[table.length - 1][column];
  let low = 0, high = table.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (table[mid][0] <= energy) low = mid; else high = mid; }
  return between(table[low][0], table[high][0], table[low][column], table[high][column], energy);
}

/** The energy, MeV, whose CSDA range in that table is `range` g/cm². */
export function energyAt(table, range) {
  if (!(range > 0)) return 0;
  if (range <= table[0][2]) return table[0][0] * range / table[0][2];
  if (range >= table[table.length - 1][2]) return table[table.length - 1][0];
  let low = 0, high = table.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (table[mid][2] <= range) low = mid; else high = mid; }
  return between(table[low][2], table[high][2], table[low][0], table[high][0], range);
}

/** The range of an alpha of `energy` MeV in air, cm. */
export const airRange = energy => astarAt(ASTAR_AIR, energy, 2) / (AIR.density * 1e-3);
/** The energy, MeV, of an alpha with `centimeters` of air left to go. */
export const airEnergy = centimeters => energyAt(ASTAR_AIR, centimeters * AIR.density * 1e-3);
/** The range of an alpha of `energy` MeV in gold, cm. */
export const goldRange = energy => astarAt(ASTAR_GOLD, energy, 2) / GOLD_DENSITY;
/** What is left of an alpha of `energy` MeV after `microns` of gold, MeV; zero where the gold stops it. */
export const afterGold = (energy, microns) => energyAt(ASTAR_GOLD, Math.max(0, goldRange(energy) - microns * 1e-4) * GOLD_DENSITY);
/** Ion pairs an alpha leaves in each millimeter of air at `energy` MeV: its stopping power over the energy a pair takes. */
export const pairsPerMillimeter = energy => (energy > 0 ? astarAt(ASTAR_AIR, energy, 1) * AIR.density * 1e-3 / 10 / (PAIR_ENERGY * 1e-6) : 0);
/** The energy, MeV, left in an alpha that started at `energy` and has gone `millimeters` through air. */
export const airEnergyAfter = (energy, millimeters) => airEnergy(Math.max(0, airRange(energy) - millimeters / 10));

/**
 * Where an alpha leaving the source at cos θ = `mu` ends, mm from the source,
 * and what it deposits on the way: the gold cover it crosses first is
 * `cover` μm thick, the chamber is `gap` mm tall and `radius` mm wide, and
 * the alpha stops at the plate, the wall, or the end of its range.
 */
export function trackOf(energy, mu, gap = CHAMBER.sensing, radius = CHAMBER.radius, cover = CHAMBER.cover) {
  const start = afterGold(energy, cover / Math.max(mu, 1e-9));
  if (!(start > 0)) return {mu, start: 0, length: 0, range: 0, deposit: 0, stopped: true};
  const range = airRange(start) * 10, sine = Math.sqrt(Math.max(0, 1 - mu * mu));
  const wall = sine > 1e-9 ? radius / sine : Infinity, plate = mu > 1e-9 ? gap / mu : Infinity;
  const length = Math.min(range, wall, plate);
  return {mu, start, length, range, deposit: start - airEnergyAfter(start, length), stopped: length >= range - 1e-12};
}

/**
 * The ion pairs one decay leaves in a chamber `gap` mm tall and `radius` mm
 * wide: every alpha energy in its share, averaged over the directions it can
 * leave the face in, by the midpoint rule over cos θ.
 */
export function pairsPerAlpha(gap = CHAMBER.sensing, radius = CHAMBER.radius, cover = CHAMBER.cover, steps = CHAMBER.steps) {
  let total = 0;
  for (const [energy, share] of LINES) {
    let deposit = 0;
    for (let i = 0; i < steps; i++) deposit += trackOf(energy, (i + 0.5) / steps, gap, radius, cover).deposit;
    total += share * deposit / steps;
  }
  return total / (PAIR_ENERGY * 1e-6);
}

/** Everything about one half chamber that no control changes: its size in meters, the pairs one decay leaves in it, the pairs a second, its volume, the pairs each cubic meter gets a second, and the current it would carry if every ion reached an electrode. */
export function chamberOf(gapMillimeters, radiusMillimeters = CHAMBER.radius) {
  const gap = gapMillimeters / 1000, radius = radiusMillimeters / 1000;
  const pairs = pairsPerAlpha(gapMillimeters, radiusMillimeters);
  const rate = AMERICIUM.activity * CHAMBER.share * pairs, volume = Math.PI * radius * radius * gap / 2;
  return Object.freeze({gapMillimeters, radiusMillimeters, gap, radius, pairs, rate, volume, q: rate / volume, saturation: ELEMENTARY * rate});
}

export const SENSING = chamberOf(CHAMBER.sensing);
export const REFERENCE = chamberOf(CHAMBER.reference);

/** How fast a chamber sweeps its ions out at `volts`, per second: both ions cross g/2 on average at μV/g. */
export const sweepRate = (chamber, volts) => 2 * AIR.mobility * volts / (chamber.gap * chamber.gap);
/** The steady ion density, per m³, of each sign in a chamber at `volts` whose smoke catches ions at `capture` per second. */
export function ionDensity(chamber, volts, capture = 0) {
  const loss = sweepRate(chamber, volts) + capture;
  return 2 * chamber.q / (loss + Math.sqrt(loss * loss + 4 * CHAMBER.recombination * chamber.q));
}
/** The current, A, a chamber carries at `volts` with smoke catching ions at `capture` per second. */
export const chamberCurrent = (chamber, volts, capture = 0) => ELEMENTARY * chamber.volume * ionDensity(chamber, volts, capture) * sweepRate(chamber, volts);

/**
 * The voltage at the detect input, V: the sealed half carries the same current
 * from the battery's positive side into the node as the open half carries out
 * of it, and smoke, which only the open half sees, pushes the node up.
 */
export function nodeVolts(supply, capture = 0, sensing = SENSING, reference = REFERENCE) {
  let low = 0, high = supply;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (chamberCurrent(reference, supply - middle) > chamberCurrent(sensing, middle, capture)) low = middle; else high = middle;
  }
  return (low + high) / 2;
}

const mies = new Map();

/**
 * Mie scattering by a sphere of size parameter `x` and real refractive index
 * `index`, by Bohren and Huffman's series: the efficiencies for extinction and
 * scattering, and |S1|² + |S2|² at each angle in radians.
 */
export function mie(x, index, angles) {
  const stop = Math.floor(x + 4 * Math.cbrt(x) + 2), terms = Math.floor(Math.max(stop, index * x) + 16);
  const derivative = new Float64Array(terms + 1);
  for (let n = terms; n > 0; n--) { const ratio = n / (index * x); derivative[n - 1] = ratio - 1 / (derivative[n] + ratio); }
  let psiBack = Math.cos(x), psiLast = Math.sin(x), chiBack = -Math.sin(x), chiLast = Math.cos(x), extinction = 0, scattering = 0;
  const cosines = angles.map(Math.cos), s1r = angles.map(() => 0), s1i = angles.map(() => 0), s2r = angles.map(() => 0), s2i = angles.map(() => 0);
  const piLast = angles.map(() => 0), piNow = angles.map(() => 1);
  for (let n = 1; n <= stop; n++) {
    // Riccati-Bessel functions of order n, and of order n - 1 from the step before.
    const psi = (2 * n - 1) * psiLast / x - psiBack, chi = (2 * n - 1) * chiLast / x - chiBack, ratio = n / x;
    const aFactor = derivative[n] / index + ratio, bFactor = index * derivative[n] + ratio;
    const aTop = aFactor * psi - psiLast, aBottomR = aTop, aBottomI = -(aFactor * chi - chiLast);
    const bTop = bFactor * psi - psiLast, bBottomR = bTop, bBottomI = -(bFactor * chi - chiLast);
    const aSize = aBottomR * aBottomR + aBottomI * aBottomI, bSize = bBottomR * bBottomR + bBottomI * bBottomI;
    const aR = aTop * aBottomR / aSize, aI = -aTop * aBottomI / aSize, bR = bTop * bBottomR / bSize, bI = -bTop * bBottomI / bSize;
    extinction += (2 * n + 1) * (aR + bR);
    scattering += (2 * n + 1) * (aR * aR + aI * aI + bR * bR + bI * bI);
    const weight = (2 * n + 1) / (n * (n + 1));
    for (let j = 0; j < angles.length; j++) {
      const tau = n * cosines[j] * piNow[j] - (n + 1) * piLast[j];
      s1r[j] += weight * (aR * piNow[j] + bR * tau);
      s1i[j] += weight * (aI * piNow[j] + bI * tau);
      s2r[j] += weight * (aR * tau + bR * piNow[j]);
      s2i[j] += weight * (aI * tau + bI * piNow[j]);
      const next = ((2 * n + 1) * cosines[j] * piNow[j] - (n + 1) * piLast[j]) / n;
      piLast[j] = piNow[j];
      piNow[j] = next;
    }
    psiBack = psiLast; psiLast = psi; chiBack = chiLast; chiLast = chi;
  }
  return {
    qext: 2 * extinction / (x * x), qsca: 2 * scattering / (x * x),
    intensity: angles.map((_, j) => s1r[j] * s1r[j] + s1i[j] * s1i[j] + s2r[j] * s2r[j] + s2i[j] * s2i[j]),
  };
}

/** Everything about a smoke particle `diameter` μm across seen at `angle` degrees: its mass, how much light it takes out of a beam, how much it sends toward the photodiode in each steradian, and how fast it catches ions. */
export function particleOf(diameter, angle) {
  const key = `${diameter}:${angle}`;
  if (mies.has(key)) return mies.get(key);
  const meters = diameter * 1e-6, x = Math.PI * meters / EMITTER.wavelength, wave = 2 * Math.PI / EMITTER.wavelength;
  const {qext, qsca, intensity} = mie(x, OPTICS.index, [angle * Math.PI / 180]);
  const area = Math.PI * meters * meters / 4;
  const particle = Object.freeze({
    diameter, meters, x, qext, qsca, angle,
    extinction: qext * area, scattering: qsca * area, differential: intensity[0] / (2 * wave * wave),
    mass: SMOKE.density * Math.PI * meters ** 3 / 6, capture: 2 * Math.PI * DIFFUSION * meters,
  });
  if (mies.size >= 64) mies.clear();
  mies.set(key, particle);
  return particle;
}

/** The share of a beam left after `meters` of smoke that takes `extinction` out of it per meter. */
export const transmission = (extinction, meters) => Math.exp(-extinction * meters);
/** Obscuration in percent per meter, and per foot, of smoke with that extinction coefficient. */
export const obscurationMeter = extinction => (1 - Math.exp(-extinction)) * 100;
export const obscurationFoot = extinction => (1 - Math.exp(-extinction * FOOT)) * 100;
/** The extinction coefficient, per meter, that reads as `percent` obscuration a meter. */
export const extinctionOf = percent => -Math.log(1 - percent / 100);

/** The photodiode current, A, from `number` particles a cubic meter lit by the emitter and seen off the beam. */
export function scatteredCurrent(particle, number) {
  const source = OPTICS.source / 1000, sensor = OPTICS.sensor / 1000;
  const volume = Math.PI * (OPTICS.beam / 2000) ** 2 * (OPTICS.length / 1000);
  const dimming = transmission(number * particle.extinction, source + sensor);
  return RESPONSIVITY * EMITTER.intensity / (source * source) * dimming * number * volume * particle.differential * DIODE.area / (sensor * sensor);
}

/** The photodiode current, A, in a beam `meters` long through `number` particles a cubic meter, the beam spreading as it goes. */
export function beamCurrent(particle, number, meters = OPTICS.direct / 1000) {
  return RESPONSIVITY * EMITTER.intensity / (meters * meters) * DIODE.area * transmission(number * particle.extinction, meters);
}

/** The mass of smoke in each cubic meter of a chamber `time` seconds into a run that fills the room at `growth` kg/m³ a second, the chamber lagging the room by SMOKE.lag seconds. */
export const massInside = (growth, time) => growth * (time - SMOKE.lag * (1 - Math.exp(-time / SMOKE.lag)));

/** The first time, s, at or before `limit` at which `rising` reaches zero, or null if it never does. */
function crossing(rising, limit) {
  if (rising(limit) < 0) return null;
  let low = 0, high = limit;
  for (let i = 0; i < 60; i++) { const middle = (low + high) / 2; if (rising(middle) < 0) low = middle; else high = middle; }
  return (low + high) / 2;
}

const plans = new Map();

/** Everything about the two chambers, the smoke and the two comparators that the clock does not change. */
export function smokePlan(input) {
  const values = validateControls(input, SMOKE_DEFAULTS, SMOKE_DOMAINS, 'smoke detector');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const particle = particleOf(values.size, values.angle), supply = values.battery;
  const setPoint = supply * IONIZATION_IC.set, growth = values.growth * 1e-6 / 60, duration = SMOKE.duration;
  const captureOf = mass => mass / particle.mass * particle.capture;
  const cleanNode = nodeVolts(supply), cleanCurrent = chamberCurrent(SENSING, cleanNode);
  const nodeAt = mass => nodeVolts(supply, captureOf(mass));
  const scatteredAt = mass => scatteredCurrent(particle, mass / particle.mass);
  const ionCross = crossing(time => nodeAt(massInside(growth, time)) - setPoint, duration);
  const photoCross = crossing(time => scatteredAt(massInside(growth, time)) - PHOTO_LIMIT, duration);
  const ionSample = ionCross === null ? null : Math.ceil(ionCross / IONIZATION_IC.period) * IONIZATION_IC.period;
  const photoFirst = photoCross === null ? null : Math.ceil(photoCross / PHOTO_IC.period) * PHOTO_IC.period;
  const photoSample = photoFirst === null ? null : photoFirst + PHOTO_IC.afterOne + PHOTO_IC.afterTwo;
  const ionAlarm = ionSample !== null && ionSample <= duration ? ionSample : null;
  const photoAlarm = photoSample !== null && photoSample <= duration ? photoSample : null;
  const lowBattery = supply < CHAMBER.lowBattery;
  const alarmMass = ionCross === null ? null : massInside(growth, ionCross), photoMass = photoCross === null ? null : massInside(growth, photoCross);
  const massFor = crossingMass => (crossingMass === null ? null : crossingMass / particle.mass * particle.extinction);
  const plan = {
    values, particle, supply, setPoint, growth, duration, captureOf, nodeAt, scatteredAt,
    sensing: SENSING, reference: REFERENCE, cleanNode, cleanCurrent, cleanRatio: cleanCurrent / SENSING.saturation,
    cleanScattered: scatteredAt(0), cleanBeam: beamCurrent(particle, 0), photoLimit: PHOTO_LIMIT,
    ionCross, photoCross, ionAlarm, photoAlarm, first: ionAlarm === null ? photoAlarm : photoAlarm === null ? ionAlarm : Math.min(ionAlarm, photoAlarm),
    ionMass: alarmMass, photoMass, ionObscuration: alarmMass === null ? null : obscurationMeter(massFor(alarmMass)), photoObscuration: photoMass === null ? null : obscurationMeter(massFor(photoMass)),
    lowBattery, chirpEvery: IONIZATION_IC.batteryEvery,
    slow: SMOKE.speed, lag: SMOKE.lag,
  };
  plan.chart = Object.freeze(Array.from({length: SMOKE.samples}, (_, i) => {
    const time = duration * i / (SMOKE.samples - 1), mass = massInside(growth, time), number = mass / particle.mass;
    const node = nodeAt(mass), scattered = scatteredAt(mass);
    return Object.freeze({time, mass, number, node, scattered, ionShare: (node - cleanNode) / (setPoint - cleanNode), photoShare: scattered / PHOTO_LIMIT, obscuration: obscurationMeter(number * particle.extinction)});
  }));
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The two chambers `time` seconds into the run. */
export function smokeAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), mass = massInside(plan.growth, t), number = mass / plan.particle.mass;
  const capture = plan.captureOf(mass), extinction = number * plan.particle.extinction;
  const node = plan.nodeAt(mass), current = chamberCurrent(plan.sensing, node, capture);
  const referenceCurrent = chamberCurrent(plan.reference, plan.supply - node);
  const scattered = plan.scatteredAt(mass), beam = beamCurrent(plan.particle, number);
  const ionSounding = plan.ionAlarm !== null && t >= plan.ionAlarm, photoSounding = plan.photoAlarm !== null && t >= plan.photoAlarm;
  const sounding = ionSounding || photoSounding;
  const chirps = plan.lowBattery && !sounding ? Math.floor(t / plan.chirpEvery) : 0;
  return {
    time, t, mass, number, capture, extinction, node, current, referenceCurrent,
    density: ionDensity(plan.sensing, node, capture), cleanDensity: ionDensity(plan.sensing, plan.cleanNode),
    ratio: current / plan.sensing.saturation, share: current / plan.cleanCurrent,
    signal: plan.cleanCurrent / current - current / plan.cleanCurrent,
    obscuration: obscurationMeter(extinction), obscurationFoot: obscurationFoot(extinction),
    scattered, beam, beamShare: transmission(extinction, OPTICS.direct / 1000), roomShare: transmission(extinction, OPTICS.room),
    ionSounding, photoSounding, sounding, chirps, done: time >= plan.duration,
  };
}

export const sampleSmoke = (input, time = 0) => smokeAt(smokePlan(input), time);

import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Remote control: two AAA cells drive an infrared LED through a resistor in
// bursts of a 38 kHz carrier, one NEC frame for the key pressed. The light
// spreads over the room and falls on a receiver module's PIN photodiode as the
// inverse square of the distance, and the module turns each burst into a
// pulse the TV decodes. Beside them: the handset's indicator LED, red or a
// yellow one in its place, and a 1N4148 signal diode probed across its
// junction.
//
// Exact within the model: the Shockley equation with a resistance in series,
// solved by Newton's method from above its root; kT/q at 25 °C; photon energy
// hc/λ; irradiance as radiant intensity over the distance squared;
// photocurrent as responsivity times the power on the sensitive area; shot
// noise √(2qIΔf) and the noise equivalent power it gives; quantum efficiency
// from responsivity; NEC pulse distance coding and the frame's timing; the
// receiver's delayed output and the TV's decoding of its falling edges; an
// abrupt junction's depletion width growing as √(Vbi − V).
//
// Sourced: the TSAL6200's forward voltages, radiant intensities and power,
// 940 nm and ±17°; the TLHR5400's and TLHY5400's forward voltages and 635 and
// 585 nm; the TSOP38438's 38 kHz, its NEC and RC5 thresholds, its output
// timing, band and data format limits; the BPW34's area, dark current,
// reverse light current, short circuit current, open circuit voltage and NEP;
// Nexperia's SPICE model of the 1N4148 and its sheet's limits; Vishay's NEC
// timing and example word; the E92 cell's resistance and voltages; silicon's
// band gap; the exact SI constants.
//
// Declared, not from a source: the LEDs' ideality of 2, with the TSAL6200's
// saturation current and series resistance solved through its two typical
// forward voltages (the 100 mA point is a 20 ms pulse, the 1 A point a 100 μs
// one) and the indicators' saturation currents through their one; radiant
// intensity as a power of the current through the sheet's two typical points,
// and radiant power in proportion; a 15 Ω transmitter resistor, a 100 Ω
// indicator resistor, 225 mΩ in each cell and a switch with no drop; the
// receiver's NEC threshold taken as sharp; its output delayed 10 carrier
// cycles and as long as each burst; the TV splitting a 0 from a 1 at
// 1.6875 ms; a closing burst; bits in the order the note prints them; the
// BPW34 standing in for the module's PIN diode at 5 V reverse bias, its 950 nm
// responsivity used at 940 nm and its 10 V dark current at 5 V; its diode law
// as two exponentials; the light path straight and facing, nothing absorbed;
// 25 °C throughout; a depletion region drawn as an abrupt junction's with the
// SPICE junction potential as its built-in potential; a clock 150 times
// slower.
// ---------------------------------------------------------------------------

/** The exact SI constants: elementary charge C, Boltzmann's constant J/K, Planck's constant J·s and the speed of light m/s. */
export const CHARGE = 1.602176634e-19;
export const BOLTZMANN = 1.380649e-23;
export const PLANCK = 6.62607015e-34;
export const LIGHT = 299792458;

/** The sheets' ambient of 25 °C in kelvin, and kT/q there, V. */
export const KELVIN = 298.15;
export const thermalVoltage = (kelvin = KELVIN) => BOLTZMANN * kelvin / CHARGE;
export const VT = thermalVoltage();

/** A photon's energy, eV, at a wavelength in nm; and the wavelength, nm, of a photon of an energy in eV. */
export const photonEv = nm => PLANCK * LIGHT / (CHARGE * nm * 1e-9);
export const wavelengthOf = ev => PLANCK * LIGHT / (CHARGE * ev) * 1e9;

/** Vishay TSAL6200 (doc 81010), 940 nm GaAlAs: typical and most forward voltage, V, at 100 mA for 20 ms and at 1 A for 100 μs; radiant intensity, mW/sr, at both; radiant power, mW, at 100 mA; spectral width nm; half angle °; ratings in A, mW, °C, K/W and V, with the peak current's pulse μs and duty and the surge's pulse μs; rise and fall ns; package mm. */
export const TSAL6200 = Object.freeze({
  name: 'TSAL6200', material: 'GaAlAs', peak: 940, bandwidth: 30, halfAngle: 17,
  vf: 1.35, vfMax: 1.6, at: 0.1, vfPulse: 2.2, vfPulseMax: 3, pulse: 1,
  intensity: 72, intensityMin: 40, intensityMax: 200, intensityPulse: 600, intensityPulseMin: 340, power: 40,
  ifMax: 0.1, ifmMax: 0.2, ifmPulse: 100, ifmDuty: 0.5, surge: 1.5, surgePulse: 100, dissipation: 160, junctionMax: 100, thermal: 230, reverse: 5, rise: 15, fall: 15,
  flange: 5.8, body: 5, height: 8.7, dome: 2.49, pitch: 2.54,
});

/** Vishay TLHR5400 and TLHY5400 (doc 83012), 5 mm indicators of GaAsP on GaP: peak and dominant wavelengths, nm, at 10 mA; typical and most forward voltage, V, at 20 mA; least and typical luminous intensity, mcd, at 10 mA; half angle °; DC current limit A; reverse voltage V. */
export const TLHR5400 = Object.freeze({name: 'TLHR5400', color: 'red', material: 'GaAsP on GaP', peak: 635, dominant: Object.freeze([612, 630]), vf: 2, vfMax: 3, at: 0.02, luminous: 10, luminousMin: 1.6, luminousAt: 0.01, halfAngle: 30, ifMax: 0.03, reverse: 6, body: 5});
export const TLHY5400 = Object.freeze({name: 'TLHY5400', color: 'yellow', material: 'GaAsP on GaP', peak: 585, dominant: Object.freeze([581, 594]), vf: 2.4, vfMax: 3, at: 0.02, luminous: 10, luminousMin: 1.6, luminousAt: 0.01, halfAngle: 30, ifMax: 0.03, reverse: 6, body: 5});

/** Vishay TSOP38438 (doc 82491): carrier Hz; least irradiance, mW/m², for NEC and RC5 test signals, typical and most; most irradiance W/m²; transmission distance m with a TSAL6200 at A; half angle °; output delay in carrier cycles, width tolerance and recommended burst in cycles; carrier pull and band as shares of f0; data format limits in cycles and bursts a second; supply V and mA; package mm. */
export const TSOP38438 = Object.freeze({
  name: 'TSOP38438', carrier: 38000, nec: 0.12, necMax: 0.25, rc5: 0.08, rc5Max: 0.15, saturation: 30,
  distance: 30, distanceCurrent: 0.05, halfAngle: 45,
  delay: Object.freeze([7, 13]), widthTolerance: 5, recommended: 10, pull: 0.05, band: 0.1,
  minBurst: 10, shortBurst: 70, minGap: 12, longGap: 5, burstsPerSecond: 1700,
  supply: Object.freeze([2, 5.5]), supplyCurrent: Object.freeze([0.25, 0.35, 0.45]), supplyAt: 3.3, size: Object.freeze([5, 6.95, 4.8]),
});

/** Vishay BPW34 (doc 81521), silicon PIN photodiode: sensitive area mm²; package mm; half angle °; typical and most dark current, A, at V; typical and least reverse light current, A, under 1 mW/cm² at 950 nm with 5 V; short circuit current, A, and open circuit voltage, V, under the same light; capacitance pF at 0 and 3 V; peak and range of sensitivity nm; NEP W/√Hz; rise and fall ns; breakdown V. */
export const BPW34 = Object.freeze({
  name: 'BPW34', area: 7.5, size: Object.freeze([5.4, 4.3, 3.2]), halfAngle: 65,
  dark: 2e-9, darkMax: 30e-9, darkBias: 10, light: 50e-6, lightMin: 40e-6, lightBias: 5, test: 1, testWavelength: 950,
  shortCircuit: 47e-6, openCircuit: 0.35, capacitance: 70, capacitance3: 25, peak: 900, range: Object.freeze([430, 1100]), nep: 4e-14, rise: 100, fall: 100, breakdown: 60,
});

/** Nexperia's PSPICE model of the 1N4148: saturation current A, emission coefficient, breakdown V at A, series resistance Ω, zero bias capacitance F, junction potential V, grading and forward bias coefficients, transit time s, and R1, Ω, beside the diode. */
export const SPICE_1N4148 = Object.freeze({IS: 4.352e-9, N: 1.906, BV: 110, IBV: 1e-4, RS: 0.6458, CJO: 7.048e-13, VJ: 0.869, M: 0.03, FC: 0.5, TT: 3.48e-9, R1: 5.827e9});

/** Nexperia's 1N4148 sheet: most forward voltage V at A, most reverse current A at V, capacitance pF, recovery ns, reverse V, current A and power mW limits; the 1N4448's forward voltage window V at A; the most reverse current A at a junction temperature °C; the SOD27 (DO-35) outline mm: lead and body diameter, body length, lead length. */
export const SHEET_1N4148 = Object.freeze({vf: 1, at: 0.01, leak: 25e-9, leakAt: 20, capacitance: 4, recovery: 4, reverse: 100, ifMax: 0.2, dissipation: 500, window: Object.freeze([0.62, 0.72]), windowAt: 0.005, leakHot: 50e-6, hot: 150, lead: 0.56, body: 1.85, length: 4.25, leadLength: 25.4});

/** Vishay's Data Formats for IR Remote Control (doc 80071), NEC: carrier Hz; pulses in a bit's burst with their width and period, μs; leader burst and pause, the pulse distances of a 0 and a 1, the word, a byte and its inverse, the leader code and the repeat slot, ms; and the example address, command and bits sent. */
export const NEC = Object.freeze({carrier: 38000, pulses: 22, pulseWidth: 8.77, period: 26.3, leader: 9, pause: 4.5, zero: 1.125, one: 2.25, word: 67.5, pair: 27, lead: 13.5, slot: 108, address: '00110111', command: '00011010', sent: '00110111110010000001101011100101'});
/** The same note, RC5: carrier Hz, pulses in a half bit, bit, word and repeat ms, bits in a word, and the half bit its figure labels, μs; with Wikipedia's RC-5 page, carrier periods in a bit and between repeats. */
export const RC5 = Object.freeze({carrier: 36000, pulses: 32, bit: 1.78, word: 24.9, repeat: 114, bits: 14, halfLabel: 868, periodsPerBit: 64, repeatPeriods: 4096});

/** Energizer E92, an AAA alkaline cell: nominal V, fresh resistance Ω, diameter and length mm, the capacity test's end V; and Wikipedia's most for a new cell at no load, V. */
export const E92 = Object.freeze({nominal: 1.5, resistance: Object.freeze([0.15, 0.3]), diameter: Object.freeze([9.5, 10.5]), length: Object.freeze([43.3, 44.5]), cutoff: 0.8, fresh: 1.65});

/** Wikipedia: silicon's band gap, eV at 300 K; infrared from about 780 nm; the thermal voltage's example, mV at 300 K; the inverse square law within 1% once the distance is five times the source's size; and the forward threshold a silicon p–n diode is often simplified to, V, and the Diode page's thresholds for infrared GaAs, red and violet LEDs, V; and consumer infrared's wavelengths, nm. */
export const PAGES = Object.freeze({siliconGap: 1.12, infrared: 780, thermal: 25.852, thermalKelvin: 300, inverseSquare: 5, threshold: Object.freeze([0.6, 0.7]), ledThresholds: Object.freeze({infrared: 1.2, red: 1.6, violet: 4}), consumer: Object.freeze([870, 930, 950])});

/** Declared, not from a source: the LEDs' ideality; the transmitter's and indicator's resistors Ω; each cell's resistance Ω and the cells in series; the photodiode's reverse bias V; the receiver's output delay in carrier cycles; the TV's split between a 0 and a 1, ms; the carrier's lit share; the clock's slowing; the charts' lowest current A; the lowest current carriers are drawn for, A, and the decades above it; the least share² of the zero bias depletion width drawn; chart samples. */
export const DECLARED = Object.freeze({ideality: 2, resistor: 15, indicatorResistor: 100, cellResistance: 0.225, cells: 2, bias: 5, delay: 10, split: 1.6875, duty: 1 / 3, slow: 150, floor: 1e-12, dotFloor: 1e-9, decades: 9, depletionFloor: 0.02, samples: 121});

export const EMITTER_OPTIONS = Object.freeze([{value: 0, label: 'Infrared transmitter, TSAL6200'}, {value: 1, label: 'Red indicator, TLHR5400'}, {value: 2, label: 'Yellow in its place, TLHY5400'}].map(Object.freeze));
export const PATH_OPTIONS = Object.freeze([{value: 0, label: 'Clear path'}, {value: 1, label: 'Hand in the beam'}].map(Object.freeze));
export const REMOTE_DEFAULTS = Object.freeze({command: 26, distance: 5, battery: 3, blocked: 0, emitter: 0, probe: 0.7});
export const REMOTE_DOMAINS = Object.freeze({command: Object.freeze([0, 255, 1]), distance: Object.freeze([1, 30, 1]), battery: Object.freeze([1.6, 3.3, 0.1]), blocked: Object.freeze([0, 1, 1]), emitter: Object.freeze([0, 2, 1]), probe: Object.freeze([-20, 0.9, 0.01])});

/**
 * Current and junction voltage of a diode law I = IS(e^(Vj/(n·VT)) − 1)
 * carrying a total voltage V with a resistance R in series: Newton's method
 * on Vj. Forward, it starts where the junction alone would pass V/R, above
 * the root on a curve that bends up, so it closes in from one side.
 */
export function seriesDiode(IS, n, R, V) {
  const nvt = n * VT;
  let junction = V > 0 ? nvt * Math.log1p(V / (R * IS)) : V;
  for (let k = 0; k < 200; k++) {
    const grow = Math.expm1(junction / nvt), step = (junction + R * IS * grow - V) / (1 + R * IS * (grow + 1) / nvt);
    junction -= step;
    if (!(Math.abs(step) > 1e-15)) break;
  }
  return {junction, current: IS * Math.expm1(junction / nvt)};
}

/** The saturation current and series resistance that put a diode law of ideality n through two forward voltages at two currents. */
export function fitTwoPoints(n, [v1, i1], [v2, i2]) {
  const nvt = n * VT;
  let IS = 0, RS = 0;
  for (let k = 0; k < 60; k++) {
    IS = i1 / Math.expm1((v1 - i1 * RS) / nvt);
    RS = (v2 - nvt * Math.log1p(i2 / IS)) / i2;
  }
  return {IS, RS};
}

/** The saturation current that puts a diode law of ideality n and series resistance RS through one forward voltage at one current. */
export const fitOnePoint = (n, RS, [v, i]) => ({IS: i / Math.expm1((v - i * RS) / (n * VT)), RS});

const IR_FIT = fitTwoPoints(DECLARED.ideality, [TSAL6200.vf, TSAL6200.at], [TSAL6200.vfPulse, TSAL6200.pulse]);

/** The three LEDs as the model runs them: each sheet, the diode law fitted to it, and the resistor in its loop. */
export const LEDS = Object.freeze([
  Object.freeze({sheet: TSAL6200, ...IR_FIT, resistor: DECLARED.resistor}),
  Object.freeze({sheet: TLHR5400, ...fitOnePoint(DECLARED.ideality, IR_FIT.RS, [TLHR5400.vf, TLHR5400.at]), resistor: DECLARED.indicatorResistor}),
  Object.freeze({sheet: TLHY5400, ...fitOnePoint(DECLARED.ideality, IR_FIT.RS, [TLHY5400.vf, TLHY5400.at]), resistor: DECLARED.indicatorResistor}),
]);

/** An LED's voltage at a current. */
export const ledVoltage = (led, current) => DECLARED.ideality * VT * Math.log1p(current / led.IS) + current * led.RS;

/** An LED in its loop: two cells with their resistance, its resistor, and a switch with no drop. */
export function ledLoop(index, battery) {
  const led = LEDS[index], cells = DECLARED.cells * DECLARED.cellResistance;
  const {junction, current} = seriesDiode(led.IS, DECLARED.ideality, led.RS + led.resistor + cells, battery), voltage = junction + current * led.RS;
  return {index, led, battery, current, junction, voltage, resistorDrop: current * led.resistor, cellDrop: current * cells, ledPower: voltage * current, supplied: battery * current, photon: photonEv(led.sheet.peak)};
}

/** The power of the current that radiant intensity follows through the sheet's two typical points. */
export const INTENSITY_SLOPE = Math.log(TSAL6200.intensityPulse / TSAL6200.intensity) / Math.log(TSAL6200.pulse / TSAL6200.at);
/** Radiant intensity on the axis, mW/sr, at a current in A. */
export const intensityAt = current => TSAL6200.intensity * (current / TSAL6200.at) ** INTENSITY_SLOPE;
/** Radiant power, mW, in proportion to the intensity, from the sheet's 40 mW at 100 mA. */
export const radiantPower = current => TSAL6200.power * intensityAt(current) / TSAL6200.intensity;
/** How far, m, an intensity in mW/sr reaches before its irradiance falls to the receiver's NEC threshold. */
export const rangeOf = intensity => Math.sqrt(intensity / TSOP38438.nec);

/** The sheet's transmission distance tried against the NEC threshold: the intensity at its 50 mA, mW/sr, the reach it gives, m, and the irradiance its 30 m would need, mW/m². */
export const SHEET_DISTANCE = Object.freeze({intensity: intensityAt(TSOP38438.distanceCurrent), reach: rangeOf(intensityAt(TSOP38438.distanceCurrent)), needed: intensityAt(TSOP38438.distanceCurrent) / TSOP38438.distance ** 2});

/** The BPW34's responsivity, A/W: its reverse light current over the power its test light puts on the sensitive area. */
export const RESPONSIVITY = BPW34.light / (BPW34.test * 10 * BPW34.area * 1e-6);
/** Photocurrent, A, from an irradiance in mW/m². */
export const photocurrentOf = irradiance => RESPONSIVITY * irradiance * 1e-3 * BPW34.area * 1e-6;
/** Shot noise, A/√Hz, of a steady current in A. */
export const shotDensity = current => Math.sqrt(2 * CHARGE * current);
/** The dark current's noise equivalent power, W/√Hz; the receiver's band, Hz; and the dark current's shot noise in that band, A. */
export const NEP = shotDensity(BPW34.dark) / RESPONSIVITY;
export const BAND = TSOP38438.carrier * TSOP38438.band;
export const NOISE = shotDensity(BPW34.dark) * Math.sqrt(BAND);
/** The irradiance, mW/m², whose photocurrent equals the dark current. */
export const DARK_IRRADIANCE = BPW34.dark / (RESPONSIVITY * BPW34.area * 1e-6) * 1000;
/** Electrons out for each photon in at the sheet's 950 nm; and the longest wavelength, nm, silicon's band gap absorbs. */
export const QUANTUM_EFFICIENCY = RESPONSIVITY * photonEv(BPW34.testWavelength);
export const SILICON_EDGE = wavelengthOf(PAGES.siliconGap);

/** The photodiode's diode law as two exponentials: a diffusion current of ideality 1 and a generation current of ideality 2 whose reverse currents add to the dark current, the first fitted so the sheet's short circuit current gives its open circuit voltage. */
export const PHOTODIODE = (() => {
  const x = BPW34.openCircuit / VT;
  let diffusion = 0;
  for (let k = 0; k < 60; k++) diffusion = (BPW34.shortCircuit - (BPW34.dark - diffusion) * Math.expm1(x / 2)) / Math.expm1(x);
  return Object.freeze({diffusion, generation: BPW34.dark - diffusion});
})();

/** Current into the photodiode's anode, A, at a voltage across it, V, while light makes a photocurrent in A. */
export const photodiodeCurrent = (voltage, light) => PHOTODIODE.diffusion * Math.expm1(voltage / VT) + PHOTODIODE.generation * Math.expm1(voltage / (2 * VT)) - light;

/** The voltage the photodiode makes with nothing connected: Newton's method from above the root. */
export function openCircuitVoltage(light) {
  let voltage = VT * Math.log1p(light / PHOTODIODE.diffusion);
  for (let k = 0; k < 200; k++) {
    const step = photodiodeCurrent(voltage, light) / (PHOTODIODE.diffusion * Math.exp(voltage / VT) / VT + PHOTODIODE.generation * Math.exp(voltage / (2 * VT)) / (2 * VT));
    voltage -= step;
    if (!(Math.abs(step) > 1e-15)) break;
  }
  return voltage;
}

/** The 1N4148 as Nexperia's SPICE model runs it at 25 °C with a voltage across it: the diode with its series resistance, and R1 beside it. */
export function diodeAt(voltage) {
  const s = SPICE_1N4148, {junction, current} = seriesDiode(s.IS, s.N, s.RS, voltage), leak = voltage / s.R1;
  return {voltage, junction, diodeCurrent: current, leak, current: current + leak, power: voltage * (current + leak)};
}

/** The voltage across the 1N4148 at a forward current in A: Newton's method on the model, from above. */
export function diodeVoltageAt(target) {
  const s = SPICE_1N4148, nvt = s.N * VT;
  let voltage = nvt * Math.log1p(target / s.IS) + target * s.RS;
  for (let k = 0; k < 200; k++) {
    const now = diodeAt(voltage), step = (now.current - target) / (1 / (s.RS + nvt / (now.diodeCurrent + s.IS)) + 1 / s.R1);
    voltage -= step;
    if (!(Math.abs(step) > 1e-15)) break;
  }
  return voltage;
}

/** The 1N4148 at its sheet's test points: the voltage at 10 mA and at 5 mA, and the current at 20 V reversed. */
export const DIODE_TEST = Object.freeze({at: diodeVoltageAt(SHEET_1N4148.at), windowAt: diodeVoltageAt(SHEET_1N4148.windowAt), leak: -diodeAt(-SHEET_1N4148.leakAt).current});

/** The share of its zero bias width an abrupt junction's depletion region has at a voltage: √(1 − V/VJ), never under √0.02. */
export const depletionShare = voltage => Math.sqrt(Math.max(1 - voltage / SPICE_1N4148.VJ, DECLARED.depletionFloor));
/** How fast carriers are drawn crossing a junction, 0 to 1: the current on a log scale from 1 nA to 1 A. */
export const currentShare = current => clamp(Math.log10(Math.max(Math.abs(current), DECLARED.dotFloor) / DECLARED.dotFloor) / DECLARED.decades);

const flip = bits => [...bits].map(bit => (bit === '1' ? '0' : '1')).join('');
/** A number from 0 to 255 as 8 bits, most significant first. */
export const byteOf = value => value.toString(2).padStart(8, '0');
/** The 32 bits a key sends, in the order Vishay's note prints them: the address, its inverse, the command, its inverse. */
export const necBits = (command, address = NEC.address) => address + flip(address) + byteOf(command) + flip(byteOf(command));

/** Each burst's start and end, s: the leader, a burst opening each bit's pulse distance, and a closing burst ending the last. */
export function necBursts(bits) {
  const burst = NEC.pulses / NEC.carrier, bursts = [[0, NEC.leader / 1000]];
  let start = NEC.lead / 1000;
  for (const bit of bits) {
    bursts.push([start, start + burst]);
    start += (bit === '1' ? NEC.one : NEC.zero) / 1000;
  }
  bursts.push([start, start + burst]);
  return bursts;
}

/** The receiver's output, low while active: each burst delayed 10 carrier cycles and as long as the burst; nothing while the light is under the threshold. */
export const receiverOutput = (bursts, received) => (received ? bursts.map(([start, end]) => [start + DECLARED.delay / TSOP38438.carrier, end + DECLARED.delay / TSOP38438.carrier]) : []);

/** The TV's decoding: the time between falling edges, a 1 when longer than the split, the first gap being the leader's; then each byte checked against its inverse. */
export function decodeOutput(output) {
  const edges = output.map(([fall]) => fall), gaps = edges.slice(1).map((edge, k) => edge - edges[k]);
  if (edges.length !== 34) return {bits: '', address: null, command: null, valid: false, gaps};
  const bits = gaps.slice(1).map(gap => (gap * 1000 > DECLARED.split ? '1' : '0')).join(''), byte = at => parseInt(bits.slice(at, at + 8), 2);
  return {bits, address: byte(0), command: byte(16), valid: (byte(0) ^ byte(8)) === 255 && (byte(16) ^ byte(24)) === 255, gaps};
}

/** The frame against the receiver's data format, in carrier cycles: a bit's burst, the leader and its pause, the quiet after a 0's burst, the quiet the leader would need at five times its length, and the quiet left in the repeat slot after the frame; and the most bursts a second, in a run of zeros. */
export const FORMAT = (() => {
  const frameEnd = (NEC.word + 1000 * NEC.pulses / NEC.carrier) / 1000, leader = NEC.leader / 1000 * NEC.carrier;
  return Object.freeze({burst: NEC.pulses, leader, pause: NEC.pause / 1000 * NEC.carrier, gap: NEC.zero / 1000 * NEC.carrier - NEC.pulses, leaderNeeds: TSOP38438.longGap * leader, slotQuiet: (NEC.slot / 1000 - frameEnd) * NEC.carrier, perSecond: 1000 / NEC.zero});
})();

const logSpace = (a, b, n) => Array.from({length: n}, (_, j) => a * (b / a) ** (j / (n - 1)));

/** Each LED's curve as [V, A], from 1 μA to the most its sheet rates: 1 A in 100 μs pulses for the TSAL6200, 30 mA for the indicators. */
export const LED_CURVES = Object.freeze(LEDS.map((led, i) => Object.freeze(logSpace(1e-6, i === 0 ? TSAL6200.pulse : led.sheet.ifMax, DECLARED.samples).map(current => Object.freeze([ledVoltage(led, current), current])))));

/** The 1N4148's current, A, at reverse voltages from −20 V to 0 and forward ones from 0 to its sheet's 1 V. */
export const DIODE_CURVE = Object.freeze({
  reverse: Object.freeze(Array.from({length: 81}, (_, j) => { const voltage = REMOTE_DOMAINS.probe[0] + (0 - REMOTE_DOMAINS.probe[0]) * j / 80; return Object.freeze([voltage, diodeAt(voltage).current]); })),
  forward: Object.freeze(Array.from({length: 201}, (_, j) => { const voltage = SHEET_1N4148.vf * j / 200; return Object.freeze([voltage, diodeAt(voltage).current]); })),
});

/** A loop's line on the LED chart, [V, A]: the voltage the cells and resistor leave for the LED, at currents from 1 μA until they take it all. */
export function loadLineOf(index, battery) {
  const resistance = LEDS[index].resistor + DECLARED.cells * DECLARED.cellResistance;
  return logSpace(1e-6, battery / resistance, DECLARED.samples).map(current => [Math.max(0, battery - current * resistance), current]);
}

/** Irradiance, mW/m², against distance, m, log spaced over the distance control's range. */
export const irradianceCurve = intensity => logSpace(REMOTE_DOMAINS.distance[0], REMOTE_DOMAINS.distance[1], DECLARED.samples).map(distance => [distance, intensity / distance ** 2]);

const plans = new Map();

/** Everything about the handset, the room, the receiver and the diodes that does not change as the clock runs. */
export function remotePlan(input) {
  const values = validateControls(input, REMOTE_DEFAULTS, REMOTE_DOMAINS, 'remote control');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const {command, distance, battery, blocked, emitter, probe} = values;
  const transmitter = ledLoop(0, battery), indicator = ledLoop(emitter === 2 ? 2 : 1, battery), shown = emitter === 0 ? transmitter : indicator;
  const intensity = intensityAt(transmitter.current), power = radiantPower(transmitter.current);
  const reach = intensity / distance ** 2, irradiance = blocked ? 0 : reach, received = irradiance >= TSOP38438.nec, light = photocurrentOf(irradiance);
  const bits = necBits(command), bursts = necBursts(bits), output = receiverOutput(bursts, received), decoded = decodeOutput(output);
  const frameEnd = bursts.at(-1)[1], delay = DECLARED.delay / TSOP38438.carrier, onTime = bursts.reduce((sum, [start, end]) => sum + end - start, 0) * DECLARED.duty;
  const diode = diodeAt(probe);
  const plan = {
    values, command, distance, battery, blocked: blocked === 1, emitter, probe, slow: DECLARED.slow,
    transmitter, indicator, shown,
    efficiency: power / 1000 / transmitter.ledPower, photonsPerElectron: power / 1000 / (transmitter.photon * transmitter.current),
    intensity, power, range: rangeOf(intensity), reach, irradiance, received, margin: reach / TSOP38438.nec,
    light, dark: BPW34.dark, noise: NOISE, signalToNoise: light / NOISE, openCircuit: openCircuitVoltage(light),
    bits, bursts, output, decoded, bitStarts: bursts.slice(1, -1).map(([start]) => start), decisions: output.slice(2).map(([fall]) => fall),
    burst: NEC.pulses / NEC.carrier, frameEnd, delay, duration: frameEnd + delay, onTime, charge: transmitter.current * onTime, average: transmitter.current * onTime / frameEnd,
    diode, depletion: depletionShare(probe), carriers: currentShare(diode.current),
    loadLine: loadLineOf(shown.index, battery), irradianceCurve: irradianceCurve(intensity),
  };
  // One plan for each setting visited, all dropped at once past 64 so a long session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The handset, the light and the receiver `time` seconds after the key is pressed. */
export function remoteAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), burst = plan.bursts.findIndex(([start, end]) => t >= start && t < end), bursting = burst >= 0;
  let bit = -1;
  for (const start of plan.bitStarts) if (start <= t) bit++;
  if (t >= plan.bursts.at(-1)[0]) bit = 32;
  const cycles = bursting ? (t - plan.bursts[burst][0]) * NEC.carrier : 0, decodedCount = plan.decisions.filter(at => at <= t).length;
  const litTime = plan.bursts.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(t, end) - start), 0) * DECLARED.duty;
  return {
    time, t, sending: t < plan.frameEnd, burst, bursting, bit, cycles, lit: bursting && cycles % 1 < DECLARED.duty, litTime,
    ledCurrent: bursting ? plan.transmitter.current : 0, irradiance: bursting ? plan.irradiance : 0, photocurrent: BPW34.dark + (bursting ? plan.light : 0),
    low: plan.output.some(([start, end]) => t >= start && t < end), decodedCount, decodedBits: plan.decoded.bits.slice(0, decodedCount),
    indicatorCurrent: t < plan.frameEnd ? plan.indicator.current : 0, done: time >= plan.duration,
  };
}

export const sampleRemote = (input, time = 0) => remoteAt(remotePlan(input), time);

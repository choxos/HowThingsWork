// Checks the remote control model and its infrared signaling, diode,
// light-emitting diode and photodiode lessons against their sources typed in
// again and their physics worked out by other routes: every diode law solved
// again by bisection, the loop's power balanced, the NEC frame rebuilt from the
// note's timing for all 256 commands and decoded again from the output drawn,
// the note's example word sent again, quantum efficiency counted from photons
// and electrons, and every drawn carrier, pair, curve, burst and mark read back
// at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './remote-physics.js';
import * as M from './remote-model.js';
import * as L from './remote-lessons.js';

const t = tally();
const counts = {bisections: 0, frames: 0, poses: 0, points: 0, carriers: 0, numbers: 0};
const f0 = value => fixed(value, 0), f1 = value => fixed(value, 1), f2 = value => fixed(value, 2), f3 = value => fixed(value, 3);
const relative = (value, share = 1e-12) => Math.abs(value) * share + 1e-18;
const clamp01 = x => Math.max(0, Math.min(1, x));
function bisect(fn, lo, hi, steps = 200) {
  let low = fn(lo) > 0;
  for (let k = 0; k < steps; k++) {
    const mid = (lo + hi) / 2;
    if ((fn(mid) > 0) === low) lo = mid; else hi = mid;
  }
  counts.bisections++;
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and what follows from them.
// ---------------------------------------------------------------------------

const SRC = {
  q: 1.602176634e-19, k: 1.380649e-23, h: 6.62607015e-34, c: 299792458,
  tsal: {peak: 940, vf: [1.35, 1.6], at: 100, vfPulse: [2.2, 3], pulse: 1, ie: [40, 72, 200], iePulse: [340, 600], power: 40, halfAngle: 17, bandwidth: 30, ifMax: 100, ifm: 200, ifmPulse: 100, ifmDuty: 0.5, surge: 1.5, surgePulse: 100, pv: 160, tj: 100, rth: 230, vr: 5, rise: 15, fall: 15, flange: 5.8, body: 5, height: 8.7, dome: 2.49, pitch: 2.54},
  red: {peak: 635, dominant: [612, 630], vf: [2, 3], at: 20, iv: [1.6, 10], ivAt: 10, halfAngle: 30, ifMax: 30, vr: 6},
  yellow: {peak: 585, dominant: [581, 594], vf: [2.4, 3], at: 20, iv: [1.6, 10], ivAt: 10, halfAngle: 30, ifMax: 30, vr: 6},
  tsop: {carrier: 38, nec: [0.12, 0.25], rc5: [0.08, 0.15], max: 30, distance: 30, current: 50, halfAngle: 45, delay: [7, 13], width: 5, recommended: 10, pull: 5, band: 10, minBurst: 10, shortBurst: 70, minGap: 12, longGap: 5, perSecond: 1700, supply: [2.0, 5.5], supplyCurrent: [0.25, 0.35, 0.45], supplyAt: 3.3, size: [5.0, 6.95, 4.8]},
  bpw34: {area: 7.5, size: [5.4, 4.3, 3.2], halfAngle: 65, dark: [2, 30], darkAt: 10, light: [40, 50], lightAt: 5, test: 1, wavelength: 950, isc: 47, voc: 350, cap: [70, 25], peak: 900, range: [430, 1100], nep: 4e-14, rise: 100, fall: 100, breakdown: 60},
  spice: '.MODEL 1N4148 D IS=4.352E-9 N=1.906 BV=110 IBV=0.0001 RS=0.6458 CJO=7.048E-13 VJ=0.869 M=0.03 FC=0.5 TT=3.48E-9', r1: 'R1 1 2 5.827E+9',
  diode: {vf: 1, at: 10, leak: 25, leakAt: 20, cd: 4, trr: 4, vrrm: 100, ifMax: 200, ptot: 500, window: [0.62, 0.72], windowAt: 5, hot: [50, 150], outline: [0.56, 1.85, 4.25, 25.4]},
  nec: {carrier: 38, pulses: 22, width: 8.77, period: 26.3, leader: 9, pause: 4.5, zero: 1.125, one: 2.25, word: 67.5, pair: 27, lead: 13.5, slot: 108, address: '00110111', command: '00011010', sent: '00110111\'11001000\'00011010\'11100101'},
  rc5: {carrier: 36, pulses: 32, bit: 1.78, word: 24.9, repeat: 114, bits: 14, half: 868, periods: 64, repeats: 4096},
  e92: {nominal: 1.5, ir: [150, 300], diameter: [9.5, 10.5], length: [43.3, 44.5], cutoff: 0.8}, alkaline: {fresh: [1.5, 1.65]},
  pages: {siliconGap: 1.12, infrared: 780, thermal: 25.852, thermalKelvin: 300, threshold: [0.6, 0.7], leds: [1.2, 1.6, 4], consumer: [870, 930, 950], inverseSquare: 5},
};
const D = P.DECLARED, N = P.NEC, TS = P.TSOP38438, B = P.BPW34, T6 = P.TSAL6200, TR = P.TLHR5400, TY = P.TLHY5400, S1 = P.SPICE_1N4148, H1 = P.SHEET_1N4148, PG = P.PAGES;
const mA = value => value / 1000, sameArray = (a, b) => a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) < 1e-12);

t.ok(P.CHARGE === SRC.q && P.BOLTZMANN === SRC.k && P.PLANCK === SRC.h && P.LIGHT === SRC.c, 'the exact SI constants');
t.near(P.VT, SRC.k * 298.15 / SRC.q, 1e-15, 'kT/q at 25 °C');
t.ok(f3(P.thermalVoltage(SRC.pages.thermalKelvin) * 1000) === f3(SRC.pages.thermal) && PG.thermal === SRC.pages.thermal && PG.thermalKelvin === SRC.pages.thermalKelvin, 'kT/q at 300 K is the Shockley page’s 25.852 mV');
t.ok(T6.name === 'TSAL6200' && T6.material === 'GaAlAs' && T6.peak === SRC.tsal.peak && T6.vf === SRC.tsal.vf[0] && T6.vfMax === SRC.tsal.vf[1] && Math.abs(T6.at - mA(SRC.tsal.at)) < 1e-15 && T6.vfPulse === SRC.tsal.vfPulse[0] && T6.vfPulseMax === SRC.tsal.vfPulse[1] && T6.pulse === SRC.tsal.pulse, 'TSAL6200: 940 nm, 1.35 V at 100 mA and 2.2 V at 1 A');
t.ok(sameArray([T6.intensityMin, T6.intensity, T6.intensityMax], SRC.tsal.ie) && sameArray([T6.intensityPulseMin, T6.intensityPulse], SRC.tsal.iePulse) && T6.power === SRC.tsal.power, 'TSAL6200: 40, 72 and 200 mW/sr at 100 mA, 340 and 600 at 1 A, 40 mW');
t.ok(T6.halfAngle === SRC.tsal.halfAngle && T6.bandwidth === SRC.tsal.bandwidth && Math.abs(T6.ifMax - mA(SRC.tsal.ifMax)) < 1e-15 && Math.abs(T6.ifmMax - mA(SRC.tsal.ifm)) < 1e-15 && T6.ifmPulse === SRC.tsal.ifmPulse && T6.ifmDuty === SRC.tsal.ifmDuty && T6.surge === SRC.tsal.surge && T6.surgePulse === SRC.tsal.surgePulse && T6.dissipation === SRC.tsal.pv && T6.junctionMax === SRC.tsal.tj && T6.thermal === SRC.tsal.rth && T6.reverse === SRC.tsal.vr && T6.rise === SRC.tsal.rise && T6.fall === SRC.tsal.fall, 'TSAL6200: ratings, ±17° and 15 ns');
t.ok(T6.flange === SRC.tsal.flange && T6.body === SRC.tsal.body && T6.height === SRC.tsal.height && T6.dome === SRC.tsal.dome && T6.pitch === SRC.tsal.pitch, 'TSAL6200: its package');
for (const [led, src, name, color] of [[TR, SRC.red, 'TLHR5400', 'red'], [TY, SRC.yellow, 'TLHY5400', 'yellow']]) {
  t.ok(led.name === name && led.color === color && led.material === 'GaAsP on GaP' && led.peak === src.peak && sameArray(led.dominant, src.dominant) && led.vf === src.vf[0] && led.vfMax === src.vf[1] && Math.abs(led.at - mA(src.at)) < 1e-15, `${name}: ${src.peak} nm and ${src.vf[0]} V at 20 mA`);
  t.ok(led.luminousMin === src.iv[0] && led.luminous === src.iv[1] && Math.abs(led.luminousAt - mA(src.ivAt)) < 1e-15 && led.halfAngle === src.halfAngle && Math.abs(led.ifMax - mA(src.ifMax)) < 1e-15 && led.reverse === src.vr && led.body === 5, `${name}: 10 mcd at 10 mA, ±30°, 30 mA and 6 V`);
}
t.ok(TS.name === 'TSOP38438' && TS.carrier === SRC.tsop.carrier * 1000 && TS.nec === SRC.tsop.nec[0] && TS.necMax === SRC.tsop.nec[1] && TS.rc5 === SRC.tsop.rc5[0] && TS.rc5Max === SRC.tsop.rc5[1] && TS.saturation === SRC.tsop.max, 'TSOP38438: 38 kHz and its thresholds');
t.ok(TS.distance === SRC.tsop.distance && Math.abs(TS.distanceCurrent - mA(SRC.tsop.current)) < 1e-15 && TS.halfAngle === SRC.tsop.halfAngle && sameArray(TS.delay, SRC.tsop.delay) && TS.widthTolerance === SRC.tsop.width && TS.recommended === SRC.tsop.recommended && Math.abs(TS.pull * 100 - SRC.tsop.pull) < 1e-12 && Math.abs(1 / TS.band - SRC.tsop.band) < 1e-12, 'TSOP38438: 30 m at 50 mA, ±45°, output timing and band');
t.ok(TS.minBurst === SRC.tsop.minBurst && TS.shortBurst === SRC.tsop.shortBurst && TS.minGap === SRC.tsop.minGap && TS.longGap === SRC.tsop.longGap && TS.burstsPerSecond === SRC.tsop.perSecond && sameArray(TS.supply, SRC.tsop.supply) && sameArray(TS.supplyCurrent, SRC.tsop.supplyCurrent) && TS.supplyAt === SRC.tsop.supplyAt && sameArray(TS.size, SRC.tsop.size), 'TSOP38438: data format, supply and package');
t.ok(B.name === 'BPW34' && B.area === SRC.bpw34.area && sameArray(B.size, SRC.bpw34.size) && B.halfAngle === SRC.bpw34.halfAngle && Math.abs(B.dark * 1e9 - SRC.bpw34.dark[0]) < 1e-9 && Math.abs(B.darkMax * 1e9 - SRC.bpw34.dark[1]) < 1e-9 && B.darkBias === SRC.bpw34.darkAt, 'BPW34: 7.5 mm² and 2 nA at 10 V');
t.ok(Math.abs(B.light * 1e6 - SRC.bpw34.light[1]) < 1e-9 && Math.abs(B.lightMin * 1e6 - SRC.bpw34.light[0]) < 1e-9 && B.lightBias === SRC.bpw34.lightAt && B.test === SRC.bpw34.test && B.testWavelength === SRC.bpw34.wavelength && Math.abs(B.shortCircuit * 1e6 - SRC.bpw34.isc) < 1e-9 && Math.abs(B.openCircuit * 1000 - SRC.bpw34.voc) < 1e-9, 'BPW34: 50 μA reversed, 47 μA shorted and 350 mV open under 1 mW/cm²');
t.ok(B.capacitance === SRC.bpw34.cap[0] && B.capacitance3 === SRC.bpw34.cap[1] && B.peak === SRC.bpw34.peak && sameArray(B.range, SRC.bpw34.range) && B.nep === SRC.bpw34.nep && B.rise === SRC.bpw34.rise && B.fall === SRC.bpw34.fall && B.breakdown === SRC.bpw34.breakdown, 'BPW34: capacitance, spectrum, NEP and speed');
{
  const typed = Object.fromEntries([...SRC.spice.matchAll(/(\w+)=([\dE.+-]+)/g)].map(([, key, value]) => [key, Number(value)]));
  t.ok(Object.keys(typed).length === 10 && Object.entries(typed).every(([key, value]) => S1[key] === value) && S1.R1 === Number(SRC.r1.split(' ').at(-1)), 'the 1N4148 as Nexperia’s SPICE model writes it');
}
t.ok(H1.vf === SRC.diode.vf && Math.abs(H1.at - mA(SRC.diode.at)) < 1e-15 && Math.abs(H1.leak * 1e9 - SRC.diode.leak) < 1e-9 && H1.leakAt === SRC.diode.leakAt && H1.capacitance === SRC.diode.cd && H1.recovery === SRC.diode.trr && H1.reverse === SRC.diode.vrrm && Math.abs(H1.ifMax - mA(SRC.diode.ifMax)) < 1e-15 && H1.dissipation === SRC.diode.ptot, 'the 1N4148 sheet’s limits');
t.ok(sameArray(H1.window, SRC.diode.window) && Math.abs(H1.windowAt - mA(SRC.diode.windowAt)) < 1e-15 && Math.abs(H1.leakHot * 1e6 - SRC.diode.hot[0]) < 1e-9 && H1.hot === SRC.diode.hot[1] && sameArray([H1.lead, H1.body, H1.length, H1.leadLength], SRC.diode.outline), 'the 1N4448’s window, 50 μA at 150 °C and the DO-35 outline');
t.ok(N.carrier === SRC.nec.carrier * 1000 && N.pulses === SRC.nec.pulses && N.pulseWidth === SRC.nec.width && N.period === SRC.nec.period && N.leader === SRC.nec.leader && N.pause === SRC.nec.pause && N.zero === SRC.nec.zero && N.one === SRC.nec.one && N.word === SRC.nec.word && N.pair === SRC.nec.pair && N.lead === SRC.nec.lead && N.slot === SRC.nec.slot, 'NEC as Vishay’s note times it');
t.ok(N.address === SRC.nec.address && N.command === SRC.nec.command && N.sent === SRC.nec.sent.replaceAll('\'', ''), 'the note’s example address, command and word');
t.ok(P.RC5.carrier === SRC.rc5.carrier * 1000 && P.RC5.pulses === SRC.rc5.pulses && P.RC5.bit === SRC.rc5.bit && P.RC5.word === SRC.rc5.word && P.RC5.repeat === SRC.rc5.repeat && P.RC5.bits === SRC.rc5.bits && P.RC5.halfLabel === SRC.rc5.half && P.RC5.periodsPerBit === SRC.rc5.periods && P.RC5.repeatPeriods === SRC.rc5.repeats, 'RC5 from the note and the RC-5 page');
t.ok(P.E92.nominal === SRC.e92.nominal && sameArray(P.E92.resistance.map(value => value * 1000), SRC.e92.ir) && sameArray(P.E92.diameter, SRC.e92.diameter) && sameArray(P.E92.length, SRC.e92.length) && P.E92.cutoff === SRC.e92.cutoff && P.E92.fresh === SRC.alkaline.fresh[1], 'the E92 cell and a new alkaline cell’s 1.65 V');
t.ok(PG.siliconGap === SRC.pages.siliconGap && PG.infrared === SRC.pages.infrared && sameArray(PG.threshold, SRC.pages.threshold) && sameArray([PG.ledThresholds.infrared, PG.ledThresholds.red, PG.ledThresholds.violet], SRC.pages.leds) && sameArray(PG.consumer, SRC.pages.consumer) && PG.inverseSquare === SRC.pages.inverseSquare, 'the Wikipedia figures');
assert.deepEqual({...D}, {ideality: 2, resistor: 15, indicatorResistor: 100, cellResistance: 0.225, cells: 2, bias: 5, delay: 10, split: 1.6875, duty: 1 / 3, slow: 150, floor: 1e-12, dotFloor: 1e-9, decades: 9, depletionFloor: 0.02, samples: 121});
assert.deepEqual(JSON.parse(JSON.stringify(P.REMOTE_DOMAINS)), {command: [0, 255, 1], distance: [1, 30, 1], battery: [1.6, 3.3, 0.1], blocked: [0, 1, 1], emitter: [0, 2, 1], probe: [-20, 0.9, 0.01]});
assert.deepEqual({...P.REMOTE_DEFAULTS}, {command: 26, distance: 5, battery: 3, blocked: 0, emitter: 0, probe: 0.7});
assert.deepEqual(P.EMITTER_OPTIONS.map(option => [option.value, option.label]), [[0, 'Infrared transmitter, TSAL6200'], [1, 'Red indicator, TLHR5400'], [2, 'Yellow in its place, TLHY5400']]);
assert.deepEqual(P.PATH_OPTIONS.map(option => [option.value, option.label]), [[0, 'Clear path'], [1, 'Hand in the beam']]);
t.ok(P.REMOTE_DEFAULTS.command === parseInt(SRC.nec.command, 2), 'the default command is the note’s example');
t.near(P.REMOTE_DOMAINS.battery[0], 2 * SRC.e92.cutoff, 1e-12, 'two cells run down to the E92 test’s 0.8 V');
t.near(P.REMOTE_DOMAINS.battery[1], 2 * SRC.alkaline.fresh[1], 1e-12, 'two new cells at no load');
t.near(D.cellResistance * 1000, (SRC.e92.ir[0] + SRC.e92.ir[1]) / 2, 1e-9, 'each cell’s resistance the middle of 150 to 300 mΩ');
t.near(D.split, (SRC.nec.zero + SRC.nec.one) / 2, 1e-15, 'the TV splits a 0 from a 1 halfway');
t.ok(D.delay > SRC.tsop.delay[0] && D.delay < SRC.tsop.delay[1], 'the declared output delay inside the sheet’s 7 to 13 cycles');
t.ok(Math.abs(SRC.nec.width / SRC.nec.period - D.duty) < 0.001 && f1(1e6 / (SRC.nec.carrier * 1000)) === f1(SRC.nec.period), 'the note’s 8.77 μs of 26.3 μs is a third of a 38 kHz cycle');
t.ok(P.REMOTE_DOMAINS.distance[0] * 1000 >= SRC.pages.inverseSquare * SRC.tsal.flange, 'the nearest receiver is five times farther than the LED is wide, so the inverse square law holds within 1%');

// Photon energies and silicon's edge from E = hc/λ.
const photonOf = nm => SRC.h * SRC.c / (nm * 1e-9) / SRC.q;
for (const nm of [585, 635, 900, 940, 950, 1100]) t.near(P.photonEv(nm), photonOf(nm), 1e-12, `${nm} nm: hc/λ`);
t.near(P.SILICON_EDGE, SRC.h * SRC.c / (SRC.pages.siliconGap * SRC.q) * 1e9, 1e-6, 'silicon’s 1.12 eV edge');
t.ok(f0(P.SILICON_EDGE) === '1,107' && P.SILICON_EDGE > SRC.bpw34.range[1], 'the edge at 1,107 nm, past the sheet’s 1,100 nm');

// The LEDs' diode laws, and their loops by bisection.
const ledVolts = (led, current) => 2 * P.VT * Math.log(current / led.IS + 1) + current * led.RS;
t.near(ledVolts(P.LEDS[0], mA(SRC.tsal.at)), SRC.tsal.vf[0], 1e-9, 'the TSAL6200’s law passes 1.35 V at 100 mA');
t.near(ledVolts(P.LEDS[0], SRC.tsal.pulse), SRC.tsal.vfPulse[0], 1e-9, 'and 2.2 V at 1 A');
t.near(ledVolts(P.LEDS[1], mA(SRC.red.at)), SRC.red.vf[0], 1e-9, 'the red indicator’s law passes 2 V at 20 mA');
t.near(ledVolts(P.LEDS[2], mA(SRC.yellow.at)), SRC.yellow.vf[0], 1e-9, 'the yellow’s passes 2.4 V at 20 mA');
t.ok(P.LEDS[1].RS === P.LEDS[0].RS && P.LEDS[2].RS === P.LEDS[0].RS && P.LEDS[0].sheet === T6 && P.LEDS[1].sheet === TR && P.LEDS[2].sheet === TY, 'the indicators share the infrared LED’s series resistance');
t.ok(P.LEDS[0].resistor === 15 && P.LEDS[1].resistor === 100 && P.LEDS[2].resistor === 100 && f2(P.LEDS[0].RS) === '0.81' && f2(P.LEDS[0].IS * 1e12) === '1.89', 'the TSAL6200 fits 0.81 Ω and 1.89 pA');
for (const [index, led] of P.LEDS.entries()) {
  for (let k = 0; k <= 17; k++) {
    const battery = 1.6 + 0.1 * k, loop = P.ledLoop(index, battery), external = led.resistor + 2 * D.cellResistance;
    const current = bisect(i => ledVolts(led, i) + i * external - battery, 0, battery / external);
    t.near(loop.current, current, relative(current, 1e-9) + 1e-15, `LED ${index} at ${f1(battery)} V: the loop current by bisection`);
    t.near(loop.voltage + loop.resistorDrop + loop.cellDrop, battery, 1e-9, 'the voltages around the loop add to the cells’');
    t.near(loop.supplied, loop.ledPower + loop.current ** 2 * external, relative(loop.supplied, 1e-9), 'the cells’ power goes into the LED, the resistor and the cells');
    t.near(loop.photon, photonOf(led.sheet.peak), 1e-12, 'its photons’ energy');
  }
}

// Radiant intensity, irradiance and the photocurrent it makes.
t.near(P.intensityAt(mA(SRC.tsal.at)), SRC.tsal.ie[1], 1e-9, '72 mW/sr at 100 mA');
t.near(P.intensityAt(SRC.tsal.pulse), SRC.tsal.iePulse[1], 1e-9, '600 mW/sr at 1 A');
for (const current of [0.01, 0.025, 0.05, 0.106, 0.3]) t.near(Math.log(P.intensityAt(current) / SRC.tsal.ie[1]) / Math.log(current / mA(SRC.tsal.at)), Math.log(SRC.tsal.iePulse[1] / SRC.tsal.ie[1]) / Math.log(10), 1e-9, 'a straight line on log axes through both points');
t.near(P.radiantPower(mA(SRC.tsal.at)), SRC.tsal.power, 1e-9, '40 mW at 100 mA');
const responsivity = mA(SRC.bpw34.light[1]) / 1000 / (SRC.bpw34.test * 1e-3 / 1e-4 * SRC.bpw34.area * 1e-6);
t.near(P.RESPONSIVITY, responsivity, 1e-12, '50 μA from 1 mW/cm² on 7.5 mm²');
{
  const electrons = mA(SRC.bpw34.light[1]) / 1000 / SRC.q, photons = SRC.bpw34.test * 1e-3 / 1e-4 * SRC.bpw34.area * 1e-6 / (SRC.h * SRC.c / (SRC.bpw34.wavelength * 1e-9));
  t.near(P.QUANTUM_EFFICIENCY, electrons / photons, 1e-12, 'quantum efficiency as electrons out over photons in');
  t.ok(f2(P.QUANTUM_EFFICIENCY) === '0.87', '0.87 electrons for each photon');
}
const density = Math.sqrt(2 * SRC.q * SRC.bpw34.dark[0] * 1e-9), band = SRC.tsop.carrier * 1000 / SRC.tsop.band, thresholdLight = SRC.tsop.nec[0] * 1e-3 * SRC.bpw34.area * 1e-6 * responsivity;
t.near(P.NEP, density / responsivity, 1e-24, 'NEP as the dark current’s shot noise over the responsivity');
t.ok(Math.abs(P.NEP / SRC.bpw34.nep - 1) < 0.06, 'within 6% of the sheet’s 4 × 10⁻¹⁴ W/√Hz');
t.near(P.BAND, band, 1e-9, 'the band f0/10');
t.near(P.NOISE, density * Math.sqrt(band), 1e-24, 'the noise in the band');
t.near(P.DARK_IRRADIANCE, SRC.bpw34.dark[0] * 1e-9 / (responsivity * SRC.bpw34.area * 1e-6) * 1000, 1e-12, 'the irradiance that makes as much as the dark current');
t.near(P.photocurrentOf(SRC.tsop.nec[0]), thresholdLight, 1e-21, 'the photocurrent at the threshold');
for (const values of [{}, {distance: 1}, {distance: 10}, {distance: 25}, {distance: 30, battery: 1.6}, {battery: 3.3}]) {
  const plan = P.remotePlan(values), intensity = P.intensityAt(plan.transmitter.current), meters = plan.distance;
  const far = P.remotePlan({...values, distance: Math.min(30, 2 * meters)});
  t.near(plan.irradiance, intensity / meters ** 2, relative(plan.irradiance, 1e-12), `${JSON.stringify(values)}: irradiance over the distance squared`);
  if (2 * meters <= 30) t.near(plan.irradiance / far.irradiance, 4, 1e-12, 'twice as far, a quarter of the light');
  t.near(plan.light, plan.irradiance * 1e-3 * SRC.bpw34.area * 1e-6 * responsivity, 1e-21, 'the photocurrent');
  t.near(intensity / plan.range ** 2, SRC.tsop.nec[0], 1e-12, 'the range is where the irradiance falls to the threshold');
  t.ok(plan.received === (plan.irradiance >= SRC.tsop.nec[0]) && plan.margin === plan.reach / SRC.tsop.nec[0], 'received at or above the threshold');
  t.near(plan.signalToNoise, plan.light / P.NOISE, 1e-6, 'signal to noise');
}
t.near(P.SHEET_DISTANCE.intensity, P.intensityAt(mA(SRC.tsop.current)), 1e-12, 'the intensity at the sheet’s 50 mA');
t.near(P.SHEET_DISTANCE.reach ** 2 * SRC.tsop.nec[0], P.SHEET_DISTANCE.intensity, 1e-9, 'its reach at the threshold');
t.ok(P.SHEET_DISTANCE.reach < SRC.tsop.distance && f1(P.SHEET_DISTANCE.reach) === '17.8' && f3(P.SHEET_DISTANCE.needed) === '0.042', 'short of the sheet’s 30 m: 17.8 m, and 30 m would need 0.042 mW/m²');

// The photodiode's two exponentials, its open circuit voltage by bisection.
const photodiode = (volts, light) => P.PHOTODIODE.diffusion * (Math.exp(volts / P.VT) - 1) + P.PHOTODIODE.generation * (Math.exp(volts / (2 * P.VT)) - 1) - light;
t.near(bisect(volts => photodiode(volts, SRC.bpw34.isc * 1e-6), 0, 1), SRC.bpw34.voc / 1000, 1e-9, 'the fit gives 350 mV at the sheet’s 47 μA');
t.near(P.PHOTODIODE.diffusion + P.PHOTODIODE.generation, SRC.bpw34.dark[0] * 1e-9, 1e-21, 'its two reverse currents make the 2 nA dark current');
t.near(-P.photodiodeCurrent(-D.bias, 0), SRC.bpw34.dark[0] * 1e-9, 1e-12, 'at 5 V reversed, the dark current');
for (const light of [1e-12, 6e-10, 15.2e-9, 380e-9, 47e-6]) t.near(P.openCircuitVoltage(light), bisect(volts => photodiode(volts, light), 0, 1), 1e-9, `the open circuit voltage with ${light} A of light`);
t.ok(P.openCircuitVoltage(0) === 0, 'no light, no voltage');

// The 1N4148 solved again: the junction by bisection, then R1 beside it.
const nvt = S1.N * P.VT;
const diodeBranch = volts => { const junction = bisect(x => x + S1.RS * S1.IS * (Math.exp(x / nvt) - 1) - volts, Math.min(volts, 0) - 1, Math.max(volts, 0) + 1); return S1.IS * (Math.exp(junction / nvt) - 1); };
const diodeCurrent = volts => diodeBranch(volts) + volts / S1.R1;
for (const volts of [-20, -5, -0.3, -0.01, 0, 0.01, 0.3, 0.6, 0.7, 0.72, 0.8, 0.9, 1]) {
  const expected = diodeCurrent(volts), now = P.diodeAt(volts);
  t.near(now.current, expected, relative(expected, 1e-9) + 1e-15, `the 1N4148 at ${volts} V by bisection`);
  t.near(now.leak, volts / S1.R1, 1e-24, 'R1’s share');
  t.near(now.power, volts * now.current, relative(now.power, 1e-12), 'its power');
}
for (const amps of [1e-4, 5e-3, 1e-2, 0.1]) t.near(P.diodeVoltageAt(amps), bisect(volts => diodeCurrent(volts) - amps, 0, 1.2), 1e-9, `the voltage at ${amps} A by bisection`);
t.ok(P.DIODE_TEST.at < SRC.diode.vf && P.DIODE_TEST.leak < SRC.diode.leak * 1e-9 && P.DIODE_TEST.windowAt > SRC.diode.window[0] && P.DIODE_TEST.windowAt < SRC.diode.window[1], 'inside the sheet: under 1 V at 10 mA, under 25 nA at 20 V, and in the 1N4448’s window at 5 mA');
t.ok(f3(P.DIODE_TEST.at) === '0.724' && f2(P.DIODE_TEST.leak * 1e9) === '7.78' && f3(P.DIODE_TEST.windowAt) === '0.687', '0.724 V, 7.78 nA and 0.687 V');
for (const [volts, amps] of [...P.DIODE_CURVE.reverse, ...P.DIODE_CURVE.forward]) { t.near(amps, diodeCurrent(volts), relative(amps, 1e-9) + 1e-15, 'a point on the diode’s chart'); counts.points++; }
t.ok(P.DIODE_CURVE.reverse[0][0] === -20 && P.DIODE_CURVE.reverse.at(-1)[0] === 0 && P.DIODE_CURVE.forward[0][0] === 0 && P.DIODE_CURVE.forward.at(-1)[0] === SRC.diode.vf, 'the chart from −20 V to 0 and 0 to 1 V');
for (const volts of [-20, -5, 0, 0.3, 0.7, 0.85, 0.869, 0.9]) t.near(P.depletionShare(volts), Math.sqrt(Math.max((S1.VJ - volts) / S1.VJ, D.depletionFloor)), 1e-15, `an abrupt junction’s width at ${volts} V`);
t.ok(Math.sqrt(1 + 20 / S1.VJ) / (1 + 20 / S1.VJ) ** S1.M > 4, 'the SPICE capacitance law would move the width far less than the abrupt junction drawn');
for (const amps of [0, 1e-10, 1e-9, 7.78e-9, 6.45e-3, 1, 10, -7.78e-9]) t.near(P.currentShare(amps), clamp01(Math.log10(Math.max(Math.abs(amps), 1e-9) / 1e-9) / 9), 1e-15, 'carriers on a log scale of the current');

// Curves on the LED chart, the load lines and the irradiance against distance.
P.LED_CURVES.forEach((curve, i) => {
  t.ok(curve.length === D.samples && Math.abs(curve[0][1] - 1e-6) < 1e-18 && Math.abs(curve.at(-1)[1] - (i === 0 ? SRC.tsal.pulse : mA(SRC.red.ifMax))) < 1e-15, `LED ${i}: from 1 μA to its sheet’s most`);
  curve.forEach(([volts, amps], j) => { t.near(volts, ledVolts(P.LEDS[i], amps), 1e-12, 'a point on the LED’s law'); if (j) t.ok(amps > curve[j - 1][1] && volts > curve[j - 1][0], 'rising'); counts.points++; });
});
for (const index of [0, 1, 2]) for (const battery of [1.6, 3, 3.3]) {
  const line = P.loadLineOf(index, battery), external = P.LEDS[index].resistor + 2 * D.cellResistance;
  line.forEach(([volts, amps]) => t.near(volts, Math.max(0, battery - amps * external), 1e-12, 'the cells and resistor leave the rest'));
  t.near(line.at(-1)[1], battery / external, 1e-15, 'until they take it all');
}
P.irradianceCurve(76).forEach(([meters, irradiance]) => t.near(irradiance * meters ** 2, 76, 1e-9, 'irradiance times distance squared is the intensity'));

// The NEC frame rebuilt from the note for every command, and decoded again.
const invert = bits => bits.replace(/[01]/g, bit => (bit === '1' ? '0' : '1'));
t.ok(P.necBits(parseInt(SRC.nec.command, 2)) === SRC.nec.sent.replaceAll('\'', ''), 'the note’s example word sent again');
for (let command = 0; command < 256; command++) {
  const byte = command.toString(2).padStart(8, '0'), bits = P.necBits(command), bursts = P.necBursts(bits), plan = P.remotePlan({command});
  t.ok(bits === SRC.nec.address + invert(SRC.nec.address) + byte + invert(byte), `command ${command}: address, inverse, command, inverse`);
  t.ok(bursts.length === 34 && bursts[0][0] === 0 && Math.abs(bursts[0][1] - SRC.nec.leader / 1000) < 1e-15, 'a leader of 9 ms first');
  let start = (SRC.nec.leader + SRC.nec.pause) / 1000;
  [...bits].forEach((bit, k) => {
    t.near(bursts[k + 1][0], start, 1e-15, 'each bit’s burst where the pulse distances so far put it');
    t.near(bursts[k + 1][1] - bursts[k + 1][0], SRC.nec.pulses / (SRC.nec.carrier * 1000), 1e-15, '22 cycles of 38 kHz');
    start += (bit === '1' ? SRC.nec.one : SRC.nec.zero) / 1000;
  });
  t.near(bursts[33][0], (SRC.nec.lead + 2 * SRC.nec.pair) / 1000, 1e-14, 'the closing burst after 13.5 ms and two 27 ms pairs, at 67.5 ms');
  t.near(plan.frameEnd, SRC.nec.word / 1000 + SRC.nec.pulses / (SRC.nec.carrier * 1000), 1e-14, 'every frame the same length');
  const falls = plan.output.map(([fall]) => fall), back = falls.slice(2).map((fall, k) => (fall - falls[k + 1] > (SRC.nec.zero + SRC.nec.one) / 2000 ? '1' : '0')).join('');
  t.ok(back === bits && parseInt(back.slice(16, 24), 2) === command && plan.decoded.command === command && plan.decoded.address === parseInt(SRC.nec.address, 2) && plan.decoded.valid, 'decoded again from the falling edges');
  plan.output.forEach(([a, b], k) => { t.near(a - bursts[k][0], D.delay / (SRC.nec.carrier * 1000), 1e-15, 'the output falls 10 cycles after each burst begins'); t.near(b - a, bursts[k][1] - bursts[k][0], 1e-15, 'and stays low as long as the burst'); });
  counts.frames++;
}
{
  const bits = P.necBits(26), flipped = bits.slice(0, 19) + invert(bits[19]) + bits.slice(20), byte = at => parseInt(flipped.slice(at, at + 8), 2);
  t.ok((byte(16) ^ byte(24)) !== 255, 'one flipped bit fails its inverse');
  t.ok(P.decodeOutput([]).command === null && !P.decodeOutput([]).valid && P.decodeOutput(P.remotePlan({blocked: 1}).output).address === null, 'nothing heard, nothing decoded');
}
t.ok(SRC.nec.pulses >= SRC.tsop.minBurst && SRC.nec.pulses <= SRC.tsop.shortBurst && P.FORMAT.burst === SRC.nec.pulses, 'a bit’s 22 cycles is a short burst the receiver takes');
t.near(P.FORMAT.gap, (SRC.nec.zero / 1000 - SRC.nec.pulses / (SRC.nec.carrier * 1000)) * SRC.nec.carrier * 1000, 1e-9, 'the shortest quiet, after a 0');
t.ok(P.FORMAT.gap >= SRC.tsop.minGap && P.FORMAT.perSecond <= SRC.tsop.perSecond && f0(P.FORMAT.perSecond) === '889', 'at least 12 cycles of quiet, and 889 bursts a second at most');
t.ok(P.FORMAT.leader === 342 && P.FORMAT.pause === 171 && P.FORMAT.leaderNeeds === 5 * 342 && f0(P.FORMAT.slotQuiet) === '1,517' && P.FORMAT.slotQuiet < P.FORMAT.leaderNeeds, 'the leader’s 342 cycles would ask for 1,710 of quiet, more than the 1,517 the slot leaves');
t.ok(f3(SRC.rc5.periods / (SRC.rc5.carrier * 1000) * 1000) === '1.778' && f3(SRC.rc5.bits * SRC.rc5.periods / (SRC.rc5.carrier * 1000) * 1000) === '24.889' && f3(SRC.rc5.repeats / (SRC.rc5.carrier * 1000) * 1000) === '113.778' && SRC.rc5.periods === 2 * SRC.rc5.pulses, 'RC5: 1.778 ms, 24.889 ms and 113.778 ms from its carrier');
t.ok(f2(SRC.rc5.periods / SRC.rc5.carrier) === f2(SRC.rc5.bit) && f1(SRC.rc5.bits * SRC.rc5.periods / SRC.rc5.carrier) === f1(SRC.rc5.word) && f0(SRC.rc5.repeats / SRC.rc5.carrier) === f0(SRC.rc5.repeat), 'which the note rounds');

// The frame against the clock, found again.
for (const values of [{}, {blocked: 1}, {distance: 30}, {command: 170, battery: 1.6}]) {
  const plan = P.remotePlan(values);
  for (let j = 0; j <= 500; j++) {
    const time = plan.duration * j / 500 + (j % 7) * 3e-7, now = P.remoteAt(plan, time), at = Math.min(time, plan.duration);
    const inside = plan.bursts.findIndex(([a, b]) => at >= a && at < b), lit = plan.bursts.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(at, b) - a), 0) / 3;
    t.ok(now.bursting === (inside >= 0) && now.burst === inside && now.low === plan.output.some(([a, b]) => at >= a && at < b), 'bursting and the output at a time');
    t.near(now.litTime, lit, 1e-15, 'lit a third of the bursts so far');
    t.ok(now.decodedCount === plan.output.slice(2).filter(([fall]) => fall <= at).length && now.decodedBits === plan.decoded.bits.slice(0, now.decodedCount), 'bits decided so far');
    t.ok(now.ledCurrent === (inside >= 0 ? plan.transmitter.current : 0) && now.photocurrent === B.dark + (inside >= 0 ? plan.light : 0) && now.indicatorCurrent === (at < plan.frameEnd ? plan.indicator.current : 0) && now.done === (time >= plan.duration), 'the currents at a time');
    t.ok(now.bit === (at >= plan.bursts[33][0] ? 32 : plan.bursts.slice(1, 33).filter(([a]) => a <= at).length - 1), 'which bit is being sent');
  }
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createRemoteControlModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const instancesOf = mesh => Array.from({length: mesh.count}, (_, i) => { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); const e = matrix.elements; return {x: e[12], y: e[13], s: e[0]}; });
const S = M.SIGNAL, C = M.LEDCHART, PV = M.PINVIEW, R = M.RXCHART, J = M.JUNCTION, DC = M.DIODECHART, LV = M.LEDVIEW, HS = M.HANDSET;
const rowY = k => S.y + S.bits + S.gap + k * (S.row + S.gap);
const lightRowY = amps => rowY(1) + clamp01(Math.log10(amps / S.light[0]) / Math.log10(S.light[1] / S.light[0])) * S.row;
const ledChartX = volts => C.x + clamp01(volts / C.volts) * C.w, ledChartY = amps => C.y + clamp01(Math.log10(Math.max(amps, C.amps[0]) / C.amps[0]) / 6) * C.h;
const distanceX = meters => R.x + clamp01(Math.log10(meters) / Math.log10(30)) * R.w, irradianceY = value => R.y + clamp01(Math.log10(Math.max(value, 0.01) / 0.01) / 4) * R.h;
const reverseX = volts => DC.x + (volts + 20) / 20 * DC.reverse, diodeX = volts => (volts < 0 ? reverseX(volts) : DC.x + DC.reverse + DC.gap + Math.min(volts, 1) * DC.forward), diodeY = amps => DC.y + clamp01(Math.log10(Math.max(Math.abs(amps), 1e-12) / 1e-12) / 12) * DC.h;
const crossAt = (points, x, y, size) => points.length === 4 && Math.abs(points[0][0] - (x - size)) < 1e-6 && Math.abs(points[1][0] - (x + size)) < 1e-6 && Math.abs(points[0][1] - y) < 1e-6 && Math.abs(points[2][0] - x) < 1e-6 && Math.abs(points[2][1] - (y - size)) < 1e-6 && Math.abs(points[3][1] - (y + size)) < 1e-6;
const frac = x => x - Math.floor(x);
t.ok(M.MM === 0.01 && Math.abs(M.timesSmaller(M.METER) - 250) < 1e-9 && Math.abs(M.timesLarger(M.BIG) - 10) < 1e-9, 'the scales the text states: true size, 250 times smaller and 10 times larger');
t.ok(M.signed(-20, 0) === '−20' && M.signed(0.7, 2) === '0.70' && M.ampsText(-7.784e-9) === '−7.78 nA' && M.ampsText(6.45e-3) === '6.45 mA' && M.ampsText(11.17e-6) === '11.17 μA' && M.ampsText(0) === '0.00 pA', 'readings with a true minus sign, in a unit that suits');

// Reads the edges of a step drawn on the chart: rises and falls as times.
function edgesOf(points, plan, threshold) {
  const rises = [], falls = [];
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i][0] - points[i - 1][0]) > 1e-9) continue;
    const time = (points[i][0] - S.x) / S.w * plan.duration;
    if (points[i - 1][1] < threshold && points[i][1] > threshold) rises.push(time);
    if (points[i - 1][1] > threshold && points[i][1] < threshold) falls.push(time);
  }
  return {rises, falls};
}

const settings = [{}, {distance: 30}, {distance: 1, battery: 3.3}, {blocked: 1}, {emitter: 1, battery: 1.6}, {emitter: 2}, {emitter: 2, battery: 1.6}, {probe: -20}, {probe: 0}, {probe: 0.9, command: 255}, {command: 170, distance: 26}, {probe: -5, emitter: 1, distance: 12}];
for (const values of settings) {
  const plan = P.remotePlan(values);
  for (const time of [0, 0.004, 0.0137, 0.02, plan.bitStarts[16] + 3e-4, 0.0676, plan.duration, 1]) {
    model.reset();
    model.update(values);
    model.advance(time * D.slow);
    model.root.updateMatrixWorld(true);
    const state = model.getState(), now = state.now, running = time > 0, at = Math.min(time, plan.duration);
    counts.poses++;
    t.near(state.clock, at, 1e-12, 'the clock drawn 150 times slower');
    t.ok(state.values.command === plan.command && state.duration === plan.duration, 'the state is the plan’s');

    // The handset.
    const sending = running && at < plan.frameEnd, bursting = running && plan.bursts.some(([a, b]) => at >= a && at < b);
    const indicatorColors = plan.emitter === 2 ? [M.COLORS.yellow, M.COLORS.yellowOff] : [M.COLORS.red, M.COLORS.redOff];
    t.ok(T.indicatorLed.material.color.getHex() === (sending && plan.indicator.current >= 1e-3 ? indicatorColors[0] : indicatorColors[1]), sending ? 'the indicator lit while the frame is sent, if it passes a milliampere' : 'the indicator dark');
    t.ok(T.irDome.material.color.getHex() === (bursting ? M.COLORS.infrared : M.COLORS.irBody) && T.handBeam.visible === bursting, 'the infrared LED’s glow and beam only in a burst');
    t.ok(T.keys.every((key, k) => key.material.color.getHex() === (sending && k === HS.pressed ? M.COLORS.pressed : M.COLORS.pad)), 'the key held while the frame is sent');

    // The room.
    const dm = plan.distance * M.METER, spread = Math.tan(SRC.tsal.halfAngle * Math.PI / 180), edges = pointsOf(T.beamEdges), reach = (plan.blocked ? plan.distance / 2 : plan.distance) * M.METER;
    t.ok(edges.length === 4 && Math.abs(edges[1][0] - dm) < 1e-6 && Math.abs(edges[1][1] + dm * spread) < 1e-6 && Math.abs(edges[3][1] - dm * spread) < 1e-6, `the beam’s edges ±17° out to the TV at ${plan.distance} m`);
    const fill = T.beamFill.geometry.attributes.position.array;
    t.ok(Math.abs(fill[3] - reach) < 1e-6 && Math.abs(fill[4] + reach * spread) < 1e-6 && Math.abs(fill[7] - reach * spread) < 1e-6 && T.beamFill.visible === bursting, plan.blocked ? 'the beam stopped at the hand, drawn in a burst' : 'the beam to the TV, drawn in a burst');
    t.near(T.tv.position.x - T.tv.scale.x / 2, dm, 1e-9, 'the TV at its distance, 250 times smaller');
    t.ok(T.hand.visible === plan.blocked && Math.abs(T.hand.position.x - dm / 2) < 1e-9, 'a hand halfway when blocked');
    const rangeTick = pointsOf(T.rangeTick);
    t.ok(plan.range <= 30 ? rangeTick.length === 2 && Math.abs(rangeTick[0][0] - plan.range * M.METER) < 1e-6 : rangeTick.length === 0, 'the range tick where the light falls to the threshold');
    t.ok(T.tvDot.material.color.getHex() === (running && now.low ? M.COLORS.light : M.COLORS.tvOff), 'the TV’s dot lit while the output is low');
    t.ok(T.tv.material.color.getHex() === (now.decodedCount === 32 && plan.decoded.valid ? M.COLORS.tvOn : M.COLORS.tv), 'the screen lit once the command is decoded');

    // The chart: guides, decoded again from what is drawn.
    const ledGuide = pointsOf(T.ledGuide), lightGuide = pointsOf(T.lightGuide), outputGuide = pointsOf(T.outputGuide), high = rowY(2) + plan.transmitter.current / S.amps * S.row;
    const ledEdges = edgesOf(ledGuide, plan, rowY(2) + 1e-4);
    t.ok(ledEdges.rises.length === 34 && ledEdges.falls.length === 34 && ledEdges.rises.every((rise, k) => Math.abs(rise - plan.bursts[k][0]) < 2e-8 && Math.abs(ledEdges.falls[k] - plan.bursts[k][1]) < 2e-8), 'the LED row rises and falls with every burst');
    t.ok(ledGuide.every(([, y]) => Math.abs(y - rowY(2)) < 1e-6 || Math.abs(y - high) < 1e-6), `the LED row’s bursts at ${f0(plan.transmitter.current * 1000)} mA`);
    t.ok(lightGuide.every(([, y]) => Math.abs(y - lightRowY(B.dark)) < 1e-6 || Math.abs(y - lightRowY(B.dark + plan.light)) < 1e-6), 'the photodiode row between its dark current and each burst, on a log scale');
    t.near(pointsOf(T.darkLevel)[0][1], lightRowY(B.dark), 1e-6, 'the dark current’s line');
    const outEdges = edgesOf(outputGuide, plan, rowY(0) + S.row / 2);
    if (plan.received) {
      const bits = outEdges.falls.slice(2).map((fall, k) => (fall - outEdges.falls[k + 1] > D.split / 1000 ? '1' : '0')).join('');
      t.ok(outEdges.falls.length === 34 && bits === plan.bits && parseInt(bits.slice(16, 24), 2) === plan.command, `command ${plan.command} decoded again from the output drawn`);
    } else t.ok(outEdges.falls.length === 0 && outputGuide.every(([, y]) => Math.abs(y - (rowY(0) + S.high * S.row)) < 1e-6), 'nothing received: the output drawn high throughout');
    const bitGuide = pointsOf(T.bitGuide), bitTrace = pointsOf(T.bitTrace);
    t.ok(bitGuide.length === 2 * plan.decisions.length && plan.decisions.every((decision, k) => Math.abs(bitGuide[2 * k][0] - (S.x + decision / plan.duration * S.w)) < 1e-6 && Math.abs(bitGuide[2 * k + 1][1] - (S.y + (plan.bits[k] === '1' ? 1 : S.short) * S.bits)) < 1e-6), 'a mark for each bit where the TV decides it, tall for a 1');
    t.ok(bitTrace.length === 2 * (running ? now.decodedCount : 0), 'dark marks as far as the clock');
    const ticks = Math.floor(plan.duration / S.tickEvery - 1e-9);
    t.ok(pointsOf(T.timeTicks).length === 2 * ticks, `a tick every 10 ms: ${ticks}`);
    t.near(pointsOf(T.signalCursor)[0][0], S.x + (running ? at : 0) / plan.duration * S.w, 1e-6, 'the cursor at the clock');
    const ledTrace = pointsOf(T.ledTrace), outputTrace = pointsOf(T.outputTrace);
    if (running) {
      t.near(ledTrace.at(-1)[0], S.x + at / plan.duration * S.w, 1e-6, 'the LED row drawn as far as the clock');
      t.near(ledTrace.at(-1)[1], now.bursting ? high : rowY(2), 1e-6, 'at the current now');
      t.near(outputTrace.at(-1)[1], rowY(0) + (now.low ? S.low : S.high) * S.row, 1e-6, 'and the output now');
      t.near(pointsOf(T.lightTrace).at(-1)[1], lightRowY(now.photocurrent), 1e-6, 'and the photocurrent now');
    } else t.ok(!T.ledTrace.visible && !T.lightTrace.visible && !T.outputTrace.visible, 'nothing sent before Play');
    const carrierTrace = pointsOf(T.carrierTrace), [mx, my, mw, mh] = S.magnifier;
    if (bursting) {
      const cycles = Math.min((at - plan.bursts[now.burst][0]) * N.carrier, N.pulses);
      t.near(carrierTrace.at(-1)[0], mx + cycles / N.pulses * mw, 1e-6, 'the burst’s flashes as far as the clock');
      t.ok(carrierTrace.every(([x, y], i) => Math.abs(y - (my + S.low * mh)) < 1e-6 || Math.abs(y - (my + S.high * mh)) < 1e-6) && carrierTrace.filter(([, y], i) => i && Math.abs(y - (my + S.high * mh)) < 1e-6).length >= 1, 'on and off');
    } else t.ok(carrierTrace.length === 0, 'no flashes between bursts');
    {
      const guide = pointsOf(T.carrierGuide), highs = [];
      for (let i = 1; i < guide.length; i++) if (Math.abs(guide[i][1] - guide[i - 1][1]) < 1e-9 && guide[i][1] > my + mh / 2) highs.push((guide[i][0] - guide[i - 1][0]) / mw * N.pulses);
      t.ok(highs.length === N.pulses && highs.every(width => Math.abs(width - D.duty) < 1e-5), '22 flashes, each lit a third of its cycle');
    }

    // The LED's junction and chart.
    const shown = plan.shown, ledLit = running && (plan.emitter === 0 ? bursting : sending), share = clamp01(Math.log10(Math.max(shown.current, 1e-9) / 1e-9) / 9);
    const litTime = plan.emitter === 0 ? plan.bursts.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(at, b) - a), 0) / 3 : Math.min(at, plan.frameEnd);
    const phase = LV.speed * share * litTime, span = LV.half - LV.active / 2 - 2 * LV.radius;
    const holes = instancesOf(T.ledHoles), electrons = instancesOf(T.ledElectrons);
    t.ok(holes.length === LV.carriers && electrons.length === LV.carriers, '12 holes and 12 electrons');
    holes.forEach((hole, k) => { t.ok(Math.abs(hole.x - (-LV.half + LV.radius + frac(k / LV.carriers + phase / span) * span)) < 1e-6 && hole.x < -LV.active / 2 && hole.x > -LV.half && Math.abs(hole.s - LV.radius) < 1e-9, 'a hole in the p side, carried on while current flows'); counts.carriers++; });
    electrons.forEach((electron, k) => { t.ok(Math.abs(electron.x - (LV.half - LV.radius - frac(k / LV.carriers + phase / span) * span)) < 1e-6 && electron.x > LV.active / 2 && electron.x < LV.half, 'an electron in the n side'); counts.carriers++; });
    const photons = pointsOf(T.ledPhotons);
    t.ok(photons.length === 6 * (ledLit ? Math.round(LV.photons * share) : 0) && photons.every(([, y]) => y >= LV.tall / 2 - 1e-6 && y <= LV.tall / 2 + LV.reach + 3 * LV.step + 1e-6), ledLit ? 'photons leaving the junction while lit' : 'no photons while dark');
    t.ok(T.ledPhotons.material.color.getHex() === M.LED_COLORS[plan.emitter], 'drawn in the LED’s color');
    t.ok(crossAt(pointsOf(T.ledCursor), ledChartX(ledLit ? shown.voltage : 0), ledChartY(ledLit ? shown.current : 1e-6), C.cursor), 'the cross at the LED’s current and voltage while lit, at the corner while dark');
    const load = pointsOf(T.loadLine), external = P.LEDS[shown.index].resistor + 2 * D.cellResistance;
    t.ok(load.length === D.samples && load.every(([x, y]) => { const amps = 1e-6 * 10 ** ((y - C.y) / C.h * 6), volts = (x - C.x) / C.w * C.volts; return y < C.y + 1e-6 || Math.abs(volts - Math.max(0, plan.battery - amps * external)) < 2e-4; }), 'the load line: what the cells and resistor leave');
    const crossing = bisect(amps => ledVolts(P.LEDS[shown.index], amps) + amps * external - plan.battery, 0, plan.battery / external);
    t.near(shown.current, crossing, relative(crossing, 1e-9) + 1e-15, 'the LED’s current where its curve meets the load line');

    // The photodiode and the receiver's chain.
    const current = running ? now.photocurrent : B.dark, pairCount = Math.min(PV.pairs, Math.round(current / 1e-9));
    const layers = PV.p + PV.i + PV.n, iLeft = -layers / 2 + PV.p, iRight = iLeft + PV.i, pairElectrons = instancesOf(T.pairElectrons), pairHoles = instancesOf(T.pairHoles);
    t.ok(pairElectrons.length === pairCount && pairHoles.length === pairCount, `${pairCount} pairs for ${f1(current * 1e9)} nA`);
    pairElectrons.forEach((electron, k) => {
      const slot = M.PAIR_SLOTS[k], x = iLeft + 2 * PV.radius + slot.x * (PV.i - 4 * PV.radius), age = frac(slot.offset + at / PV.sweep * (running ? 1 : 0));
      t.ok(Math.abs(electron.x - (x + age * (iRight - PV.radius - x))) < 1e-6 && Math.abs(pairHoles[k].x - (x - age * (x - iLeft - PV.radius))) < 1e-6 && electron.x >= x - 1e-9 && pairHoles[k].x <= x + 1e-9, 'an electron swept to the n side and its hole to the p side');
      t.ok(electron.x <= iRight && pairHoles[k].x >= iLeft, 'inside the intrinsic layer');
      counts.carriers++;
    });
    const arriving = running && now.irradiance > 0 ? Math.min(PV.photons, Math.round((now.photocurrent - B.dark) / 1e-9)) : 0;
    t.ok(pointsOf(T.pinPhotons).length === 6 * arriving, `${arriving} photons arriving`);
    t.ok(T.blocks.every((block, k) => block.material.color.getHex() === ((k === 0 ? running && now.irradiance > 0 : k === 3 ? running && now.low : running && now.irradiance > 0 && plan.received) ? M.COLORS.blockLit : M.COLORS.block)), 'the chain lit as far as the burst gets');
    const curve = pointsOf(T.receiverCurve);
    t.ok(curve.length === D.samples && curve.every(([x, y], j) => { const meters = 30 ** (j / (D.samples - 1)); return Math.abs(x - distanceX(meters)) < 1e-6 && Math.abs(y - irradianceY(plan.intensity / meters ** 2)) < 1e-6; }), 'the irradiance against distance on log scales');
    t.ok(crossAt(pointsOf(T.receiverCursor), distanceX(plan.distance), irradianceY(plan.irradiance), R.cursor), 'the cross at the receiver');
    const rangeLine = pointsOf(T.rangeLine);
    t.ok(plan.range <= 30 ? rangeLine.length === 2 && Math.abs(rangeLine[0][0] - distanceX(plan.range)) < 1e-6 : rangeLine.length === 0, 'the range marked on the chart');

    // The 1N4148's junction.
    const width = J.width * Math.sqrt(Math.max(1 - plan.probe / S1.VJ, D.depletionFloor));
    t.near(T.depletion.scale.x, width, 1e-9, `the depletion region at ${plan.probe} V`);
    const majorityHoles = instancesOf(T.majorityHoles), majorityElectrons = instancesOf(T.majorityElectrons);
    t.ok(majorityHoles.length === J.columns * J.rows && majorityHoles.every(hole => hole.x <= -width / 2 - J.radius + 1e-6 && hole.x >= -J.half) && majorityElectrons.every(electron => electron.x >= width / 2 + J.radius - 1e-6 && electron.x <= J.half), 'holes and electrons outside the depletion region, on their own sides');
    const sign = Math.sign(plan.probe);
    t.ok(T.jLeft[0].visible === (sign !== 0) && T.jLeft[1].visible === (sign > 0) && T.jRight[1].visible === (sign < 0) && T.jRight[0].visible === (sign !== 0), sign > 0 ? 'plus on the p side, forward' : sign < 0 ? 'plus on the n side, reversed' : 'no signs with no voltage');
    const crossingCount = Math.round(J.crossing * clamp01(Math.log10(Math.max(Math.abs(plan.diode.current), 1e-9) / 1e-9) / 9)), crossHoles = instancesOf(T.crossingHoles), crossElectrons = instancesOf(T.crossingElectrons), jPhase = (running ? at : 0) / J.sweep;
    if (plan.probe > 0) {
      t.ok(crossHoles.length === crossingCount && crossElectrons.length === crossingCount, `${crossingCount} carriers crossing each way, forward`);
      crossHoles.forEach((hole, k) => { t.ok(Math.abs(hole.x - (-0.8 * J.half + frac(k / crossingCount + jPhase) * 1.6 * J.half)) < 1e-6 && Math.abs(crossElectrons[k].x - (0.8 * J.half - frac(k / crossingCount + jPhase) * 1.6 * J.half)) < 1e-6, 'holes crossing to the n side and electrons to the p side'); counts.carriers++; });
    } else if (plan.probe < 0) {
      t.ok(crossHoles.length === crossingCount && crossingCount <= 1, 'a pair made by heat now and then, reversed');
      crossHoles.forEach((hole, k) => t.ok(hole.x <= 0 && hole.x >= -(width / 2 + J.reach) - 1e-9 && crossElectrons[k].x >= 0 && crossElectrons[k].x <= width / 2 + J.reach + 1e-9 && Math.abs(hole.x + crossElectrons[k].x) < 1e-9, 'swept out of the depletion region, the hole to p and the electron to n'));
    } else t.ok(crossHoles.length === 0 && crossElectrons.length === 0, 'nothing crosses with no voltage');
    t.ok(crossAt(pointsOf(T.diodeCursor), diodeX(plan.probe), diodeY(plan.diode.current), DC.cursor), 'the cross at the probe on the diode’s chart');
  }
}
{
  // What does not move: the handset at true size, the curves, the lines and the package.
  model.reset();
  model.root.updateMatrixWorld(true);
  t.ok(Math.abs(T.shell.scale.x - 45 * M.MM) < 1e-12 && Math.abs(T.shell.scale.y - 160 * M.MM) < 1e-12, 'a handset 45 mm by 160 mm');
  t.ok(T.cells.every(cell => Math.abs(cell.scale.x - SRC.e92.diameter[1] * M.MM) < 1e-12 && Math.abs(cell.scale.y - SRC.e92.length[1] * M.MM) < 1e-12), 'two AAA cells at the E92’s largest size');
  t.ok(Math.abs(T.irBody.scale.x - SRC.tsal.body * M.MM) < 1e-12 && Math.abs(T.irFlange.scale.x - SRC.tsal.flange * M.MM) < 1e-12 && Math.abs(T.irDome.scale.x - SRC.tsal.dome * M.MM) < 1e-12, 'the infrared LED’s body, flange and dome');
  t.near(T.irDome.position.y + SRC.tsal.dome * M.MM - (T.irFlange.position.y - T.irFlange.scale.y / 2), SRC.tsal.height * M.MM, 1e-12, 'the LED 8.7 mm tall from its base');
  t.near(T.indicatorLed.scale.x, SRC.red.vf.length && 5 / 2 * M.MM, 1e-12, 'the indicator 5 mm across');
  const handBeam = pointsOf(T.handBeam);
  t.near(Math.atan2(Math.abs(handBeam[1][0] - handBeam[0][0]), handBeam[1][1] - handBeam[0][1]) * 180 / Math.PI, SRC.tsal.halfAngle, 1e-4, 'the handset’s beam lines at 17°');
  M.LED_COLORS.forEach((color, i) => {
    const drawn = pointsOf(T.ledCurves[i]);
    t.ok(drawn.length === P.LED_CURVES[i].length && drawn.every(([x, y], j) => Math.abs(x - ledChartX(P.LED_CURVES[i][j][0])) < 1e-6 && Math.abs(y - ledChartY(P.LED_CURVES[i][j][1])) < 1e-6) && T.ledCurves[i].material.color.getHex() === color, `LED ${i}’s curve on the chart`);
    t.near(pointsOf(T.photonTicks[i])[0][0], ledChartX(photonOf(P.LEDS[i].sheet.peak)), 1e-6, `its photons’ energy in volts, ${f2(photonOf(P.LEDS[i].sheet.peak))}`);
    t.ok(ledVolts(P.LEDS[i], P.LEDS[i].sheet.at) > photonOf(P.LEDS[i].sheet.peak), 'each typical forward voltage above its photons’ energy');
  });
  t.ok(pointsOf(T.reverseCurve).every(([x, y], j) => Math.abs(x - reverseX(P.DIODE_CURVE.reverse[j][0])) < 1e-6 && Math.abs(y - diodeY(P.DIODE_CURVE.reverse[j][1])) < 1e-6) && pointsOf(T.forwardCurve).every(([x, y], j) => Math.abs(x - diodeX(P.DIODE_CURVE.forward[j][0])) < 1e-6 && Math.abs(y - diodeY(P.DIODE_CURVE.forward[j][1])) < 1e-6), 'the 1N4148’s curve, reverse and forward');
  t.near(pointsOf(T.fixedDrop)[0][0], diodeX(SRC.pages.threshold[1]), 1e-6, 'the fixed drop at 0.7 V');
  const limits = pointsOf(T.sheetLimits);
  t.ok(crossAt(limits.slice(0, 4), diodeX(-SRC.diode.leakAt), diodeY(SRC.diode.leak * 1e-9), DC.cursor) && crossAt(limits.slice(4), diodeX(SRC.diode.vf), diodeY(mA(SRC.diode.at)), DC.cursor), 'the sheet’s limits: 25 nA at 20 V reversed and 1 V at 10 mA');
  t.near(pointsOf(T.thresholdLine)[0][1], irradianceY(SRC.tsop.nec[0]), 1e-6, 'the NEC threshold line');
  t.near(pointsOf(T.darkLine)[0][1], irradianceY(P.DARK_IRRADIANCE), 1e-6, 'the dark current’s irradiance line');
  t.ok(Math.abs(T.glass.scale.x - SRC.diode.outline[2] * M.BIG) < 1e-12 && Math.abs(T.glass.scale.y - SRC.diode.outline[1] * M.BIG) < 1e-12 && T.leads.every(lead => Math.abs(lead.scale.y - SRC.diode.outline[0] * M.BIG) < 1e-12), 'the DO-35 glass body, 4.25 by 1.85 mm, and 0.56 mm leads, 10 times larger');
  t.ok(T.band.position.x > 0 && Math.abs(T.band.position.x + T.band.scale.x / 2 - T.glass.scale.x / 2) < 1e-12, 'the cathode band at one end');
  t.ok(T.field.userData.length > 0 && new THREE.Vector3(0, 1, 0).applyQuaternion(T.field.quaternion).x < -0.999, 'the photodiode’s field from n to p');
  t.ok(T.pinMinus[0].visible && !T.pinMinus[1].visible && T.pinPlus[1].visible && T.pinMinus[0].position.x < T.pinPlus[0].position.x, 'reverse bias: minus on the p side, plus on the n side');
}
{
  // Changing only the distance redraws the room and the charts, with no reset between.
  model.reset();
  model.update({distance: 5});
  model.update({distance: 24});
  const plan = P.remotePlan({distance: 24});
  t.near(T.tv.position.x - T.tv.scale.x / 2, 24 * M.METER, 1e-9, 'the TV moved after only the distance changed');
  t.ok(crossAt(pointsOf(T.receiverCursor), distanceX(24), irradianceY(plan.irradiance), R.cursor), 'and the receiver’s cross');
}
{
  // No part runs into another, whatever the settings.
  const toSystem = new THREE.Matrix4(), local = new THREE.Box3(), matrix = new THREE.Matrix4();
  const boxOf = object => {
    const box = new THREE.Box3();
    object.traverse(child => {
      for (let node = child; node; node = node.parent) if (!node.visible) return;
      if (!child.geometry) return;
      child.geometry.computeBoundingBox();
      const n = child.isInstancedMesh ? child.count : 1;
      for (let i = 0; i < n; i++) {
        local.copy(child.geometry.boundingBox);
        if (child.isInstancedMesh) { child.getMatrixAt(i, matrix); local.applyMatrix4(matrix); }
        box.union(local.applyMatrix4(child.matrixWorld).applyMatrix4(toSystem));
      }
    });
    return box;
  };
  for (const values of [{}, {distance: 30}, {distance: 1, battery: 3.3}, {blocked: 1, probe: -20}, {emitter: 2, probe: 0.9}]) {
    for (const time of [0.004, 0.02, 1]) {
      model.reset();
      model.update(values);
      model.advance(time * D.slow);
      model.root.updateMatrixWorld(true);
      toSystem.copy(T.system.matrixWorld).invert();
      const boxes = ['handset', 'room', 'signal', 'led', 'receiver', 'junction'].map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
      t.ok(boxes.every(([, box]) => !box.isEmpty()), 'every part drawn');
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, A] = boxes[i], [b, BB] = boxes[j];
        t.ok(A.max.x + 0.05 <= BB.min.x || BB.max.x + 0.05 <= A.min.x || A.max.y + 0.05 <= BB.min.y || BB.max.y + 0.05 <= A.min.y, `the ${a} and the ${b} clear of each other with ${JSON.stringify(values)} at ${time} s`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e4); return model.getState(); };
const def = P.remotePlan({}), defaultProbe = P.REMOTE_DEFAULTS.probe, decade = mV => f0(mV);
checkTrialNumbers(L.remoteControlLesson, {
  'Send a key': s => { t.ok(s.received && s.decoded.valid && s.now.decodedCount === 32, 'decoded at 5 m'); return {9: N.leader, '4.5': N.pause, 32: s.bits.length, 22: N.pulses, 38: N.carrier / 1000, '1.125': N.zero, 0: 0, '2.25': N.one, 1: 1, '68.08': s.frameEnd * 1000, 26: s.decoded.command, 55: s.decoded.address}; },
  'Move the TV away': s => { t.ok(s.received && s.decoded.valid, 'still decoded at 20 m'); return {20: s.distance, 16: (s.distance / P.REMOTE_DEFAULTS.distance) ** 2, 5: P.REMOTE_DEFAULTS.distance, '0.19': s.irradiance, '0.12': TS.nec, 26: s.decoded.command}; },
  'Too far': s => { t.ok(!s.received && s.decoded.command === null && s.output.length === 0, 'nothing decoded at 26 m'); return {26: s.distance, '0.11': s.irradiance, '0.12': TS.nec, '0.6': s.light * 1e9}; },
  'A hand in the beam': s => { t.ok(s.blocked && !s.received && s.irradiance === 0 && s.light === 0, 'nothing past the hand'); return {106: s.transmitter.current * 1000, 2: s.dark * 1e9}; },
  'Tired cells': s => { t.ok(s.received, 'still decoded at 1.6 V'); return {'24.8': s.transmitter.current * 1000, 106: def.transmitter.current * 1000, 76: def.intensity, 20: s.intensity, '12.9': s.range, 5: s.distance, 26: s.decoded.command}; },
  'Another key': s => { t.ok(s.bits.slice(16, 24) === '11111111' && s.bits.slice(24) === '00000000' && [...s.bits].filter(bit => bit === '1').length === 16, 'eight ones, eight zeros, and as many ones as zeros'); return {255: s.decoded.command, '68.08': s.frameEnd * 1000}; },
  'The indicator': s => { t.ok(s.now.done && s.indicator.led.sheet === TR, 'the red indicator'); return {'10.4': s.indicator.current * 1000, 100: D.indicatorResistor, '1.96': s.indicator.voltage, '1.95': s.indicator.photon, '1.32': s.transmitter.photon}; },
}, run, t);
checkTrialNumbers(L.infraredSignalingLesson, {
  'Watch a frame': s => ({9: N.leader, 342: P.FORMAT.leader, '4.5': N.pause, 579: s.burst * 1e6, 263: s.delay * 1e6}),
  'Read the address': s => { t.ok([...s.bits.slice(0, 8)].map(bit => (bit === '1' ? 'tall' : 'short')).join(', ') === 'short, short, tall, tall, short, tall, tall, tall' && s.bits.slice(8, 16) === invert(s.bits.slice(0, 8)), 'the address’s marks, then turned over'); return {55: s.decoded.address}; },
  'A different command': s => { t.ok(s.bits.slice(16, 24) === '10101010' && s.bits.slice(24) === '01010101', 'alternating marks'); return {170: s.decoded.command, '68.08': s.frameEnd * 1000}; },
  'Out of range': s => { t.ok(!s.received && s.output.length === 0 && s.now.decodedCount === 0, 'no mark'); return {30: s.distance, '0.4': s.light * 1e9, 2: s.dark * 1e9}; },
  'Blocked': s => { t.ok(s.output.length === 0 && s.light === 0, 'the output stays high'); return {106: s.transmitter.current * 1000}; },
  'Tired cells': s => { t.ok(s.received && s.bitStarts.every((start, k) => start === def.bitStarts[k]), 'timed the same'); return {'24.8': s.transmitter.current * 1000, '4.0': s.light * 1e9, 26: s.decoded.command}; },
}, run, t);
checkTrialNumbers(L.diodeLesson, {
  'Forward': s => ({'0.70': s.probe, '6.45': s.diode.current * 1000, '0.44': s.depletion}),
  'Its test point': s => ({'0.72': s.probe, '9.34': s.diode.current * 1000, 10: H1.at * 1000, '0.724': P.DIODE_TEST.at, 1: H1.vf}),
  'A little more voltage': s => ({'0.80': s.probe, '34.40': s.diode.current * 1000, '5.3': s.diode.current / P.diodeAt(defaultProbe).current, '0.70': defaultProbe, '0.6458': S1.RS, 113: S1.N * P.VT * Math.log(10) * 1000}),
  'Reverse bias': s => { t.ok(s.carriers > 0 && Math.round(J.crossing * s.carriers) === 1, 'a pair made by heat crossing'); return {20: -s.probe, '7.78': -s.diode.current * 1e9, 25: H1.leak * 1e9, '4.90': s.depletion}; },
  'No voltage': s => { t.ok(s.diode.current === 0 && s.carriers === 0 && s.depletion === 1, 'nothing flows'); return {}; },
  'Below the fixed drop': s => ({'0.7': PG.threshold[1], '0.60': s.probe, '0.90': s.diode.current * 1000, '0.1': 0.1, '0.49': P.diodeVoltageAt(1e-4)}),
}, run, t);
checkTrialNumbers(L.lightEmittingDiodeLesson, {
  'The transmitter': s => ({'106.3': s.transmitter.current * 1000, '1.36': s.transmitter.voltage, 940: T6.peak, '1.32': s.transmitter.photon}),
  'Light out, power in': s => ({144: s.transmitter.ledPower * 1000, '42.3': s.power, 29: 100 * s.efficiency, '0.30': s.photonsPerElectron}),
  'The red indicator': s => ({'10.4': s.shown.current * 1000, 100: D.indicatorResistor, '1.96': s.shown.voltage, 635: TR.peak, '1.95': s.shown.photon}),
  'Yellow in its place': s => { t.ok(s.shown.voltage > P.remotePlan({emitter: 1}).shown.voltage, 'more voltage than the red'); return {'2.12': s.shown.photon, 585: TY.peak, 100: D.indicatorResistor, '6.6': s.shown.current * 1000, '2.33': s.shown.voltage}; },
  'Red on tired cells': s => { const share = s.shown.current / P.remotePlan({emitter: 1}).shown.current; t.ok(share > 0.0007 && share < 0.0015, 'about a thousandth'); return {'1.6': s.battery, '11.17': s.shown.current * 1e6}; },
  'Yellow on tired cells': s => { t.ok(s.shown.photon > s.battery && s.shown.current < 1e-8, 'photons needing more than the cells give, and dark'); return {'1.6': s.battery, '4.75': s.shown.current * 1e9, '2.12': s.shown.photon}; },
}, run, t);
checkTrialNumbers(L.photodiodeLesson, {
  'Light in, current out': s => ({'3.05': s.irradiance, '7.5': B.area, '15.2': s.light * 1e9, 2: s.dark * 1e9}),
  'Twice as far': s => { t.near(4 * s.light, def.light, 1e-18, 'a quarter of the photocurrent at 5 m'); return {10: s.distance, '0.76': s.irradiance, '3.8': s.light * 1e9, '15.2': def.light * 1e9, 5: def.distance}; },
  'Close up': s => ({1: s.distance, '380.7': s.light * 1e9, 190: s.light / s.dark}),
  'In the dark': s => { t.ok(s.light === 0 && !s.received, 'no light'); return {2: s.dark * 1e9}; },
  'Weaker than the dark current': s => { t.ok(s.received && s.light < s.dark, 'decoded though under the dark current'); return {25: s.distance, '0.6': s.light * 1e9, 38: N.carrier / 1000, 26: s.decoded.command}; },
  'Past its reach': s => { t.ok(!s.received, 'not decoded at 27 m'); return {27: s.distance, '0.10': s.irradiance, '0.12': TS.nec}; },
}, run, t);

// Free text: each snippet computed, and every number in the text inside a checked snippet.
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
const celsius = f0(P.KELVIN - 273.15), thresholdPhotocurrent = P.photocurrentOf(TS.nec);
const transmitterSnippets = {
  [`a ${D.resistor} Ω resistor in the infrared LED's loop, ${f0(D.cellResistance * 1000)} mΩ in each cell`]: 'a 15 Ω resistor in the infrared LED\'s loop, 225 mΩ in each cell',
  [`ideality taken as ${D.ideality}`]: 'ideality taken as 2',
  [`everything at ${celsius} °C`]: 'everything at 25 °C',
};
const receiverSnippets = {
  [`delayed ${D.delay} carrier cycles`]: 'delayed 10 carrier cycles',
  [`splitting a ${0} from a ${1} at ${D.split} ms`]: 'splitting a 0 from a 1 at 1.6875 ms',
};
const photodiodeSnippets = {
  [`reverse biased by ${D.bias} V, with its dark current taken from ${B.darkBias} V and its ${B.testWavelength} nm responsivity used at ${T6.peak} nm`]: 'reverse biased by 5 V, with its dark current taken from 10 V and its 950 nm responsivity used at 940 nm',
  [`one pair drawn for each ${f0(PV.perPair * 1e9)} nA, up to ${PV.pairs}`]: 'one pair drawn for each 1 nA, up to 40',
};
const scaleSnippets = {
  [`the room ${f0(M.timesSmaller(M.METER))} times smaller and the 1N4148's package ${f0(M.timesLarger(M.BIG))} times larger`]: 'the room 250 times smaller and the 1N4148\'s package 10 times larger',
  [`${D.slow} times slower`]: '150 times slower',
};
covered(L.transmitterLimits, transmitterSnippets, 'transmitter limits');
covered(L.receiverLimits, receiverSnippets, 'receiver limits');
covered(L.photodiodeLimits, photodiodeSnippets, 'photodiode limits');
covered(L.ledLimits, {[`a ${D.indicatorResistor} Ω resistor for the indicator`]: 'a 100 Ω resistor for the indicator'}, 'LED limits');
const diodeSnippets = {
  [`the 1N4148 as Nexperia's SPICE model runs it at ${celsius} °C, with the breakdown it puts at ${S1.BV} V`]: 'the 1N4148 as Nexperia\'s SPICE model runs it at 25 °C, with the breakdown it puts at 110 V',
  [`the model's ${S1.VJ} V junction potential`]: 'the model\'s 0.869 V junction potential',
  [`never under ${f2(Math.sqrt(D.depletionFloor))} of its width`]: 'never under 0.14 of its width',
  [`from ${f0(D.dotFloor * 1e9)} nA to ${f0(D.dotFloor * 10 ** D.decades)} A`]: 'from 1 nA to 1 A',
};
covered(L.diodeLimits, diodeSnippets, 'diode limits');
t.ok(-P.REMOTE_DOMAINS.probe[0] < S1.BV, 'breakdown beyond the probe’s reach');

// Remote control.
expectNone(L.remoteControlLesson, 'Remote control');
{
  const ones = [...P.necBits(26).slice(16)].filter(bit => bit === '1').length, total = [...P.necBits(26)].filter(bit => bit === '1').length, zeros = 32 - total, bitsMs = total * N.one + zeros * N.zero;
  t.ok(N.lead + bitsMs === N.word, 'the leader and 54 ms of bits make the 67.5 ms word');
  covered(L.remoteControlLesson.deeper[0].body, {
    [`a ${N.leader} ms leader burst and ${N.pause} ms of quiet, then ${N.address.length} address bits and ${N.command.length} command bits`]: 'a 9 ms leader burst and 4.5 ms of quiet, then 8 address bits and 8 command bits',
    [`hold ${ones} ones between them, so every frame has ${total} ones at ${N.one} ms and ${zeros} zeros at ${N.zero} ms, ${f0(bitsMs)} ms of bits, and the word always takes ${N.word} ms`]: 'hold 8 ones between them, so every frame has 16 ones at 2.25 ms and 16 zeros at 1.125 ms, 54 ms of bits, and the word always takes 67.5 ms',
    [`address ${SRC.nec.address} and command ${SRC.nec.command}, goes out as ${SRC.nec.sent.replaceAll('\'', ' ')}, which is what the model sends for command ${parseInt(SRC.nec.command, 2)}`]: 'address 00110111 and command 00011010, goes out as 00110111 11001000 00011010 11100101, which is what the model sends for command 26',
  }, 'Remote control deeper 1');
}
covered(L.remoteControlLesson.deeper[1].body, {
  [`${SRC.nec.pulses} pulses of ${SRC.nec.width} μs every ${SRC.nec.period} μs`]: '22 pulses of 8.77 μs every 26.3 μs',
  [`at ${f0(N.carrier / 1000)} kHz. It also calls the burst half of the ${N.zero} ms bit, ${f1(N.zero / 2 * 1000)} μs, while ${N.pulses} cycles at ${f0(N.carrier / 1000)} kHz last ${f1(N.pulses / N.carrier * 1e6)} μs; the model sends the ${N.pulses} cycles`]: 'at 38 kHz. It also calls the burst half of the 1.125 ms bit, 562.5 μs, while 22 cycles at 38 kHz last 578.9 μs; the model sends the 22 cycles',
  [`averages ${f1(def.transmitter.current * def.bursts.reduce((sum, [a, b]) => sum + b - a, 0) / 3 / def.frameEnd * 1000)} mA over a frame, and one key press draws ${f2(def.transmitter.current * def.bursts.reduce((sum, [a, b]) => sum + b - a, 0) / 3 * 1000)} mC`]: 'averages 14.6 mA over a frame, and one key press draws 1.00 mC',
}, 'Remote control deeper 2');
covered(L.remoteControlLesson.deeper[2].body, {
  [`at least ${SRC.tsop.minBurst} cycles with at least ${SRC.tsop.minGap} cycles of quiet after each, and no more than ${f0(SRC.tsop.perSecond)} short bursts a second`]: 'at least 10 cycles with at least 12 cycles of quiet after each, and no more than 1,700 short bursts a second',
  [`bursts are ${P.FORMAT.burst} cycles, its shortest quiet ${f2(P.FORMAT.gap)} cycles, and even a run of zeros sends only ${f0(P.FORMAT.perSecond)} bursts a second`]: 'bursts are 22 cycles, its shortest quiet 20.75 cycles, and even a run of zeros sends only 889 bursts a second',
  [`longer than ${SRC.tsop.shortBurst} cycles would ask for ${f0(P.FORMAT.leaderNeeds)} cycles of quiet after the ${f0(P.FORMAT.leader)} cycle leader, more than the ${f0(P.FORMAT.slotQuiet)} left in the note's ${N.slot} ms slot`]: 'longer than 70 cycles would ask for 1,710 cycles of quiet after the 342 cycle leader, more than the 1,517 left in the note\'s 108 ms slot',
}, 'Remote control deeper 3');
covered(L.remoteControlLesson.deeper[3].body, {
  [`needs ${SRC.tsop.nec[0]} mW/m² for an NEC signal, and at most ${SRC.tsop.nec[1]} mW/m². At ${f0(def.transmitter.current * 1000)} mA the LED's ${f0(def.intensity)} mW/sr stays above ${SRC.tsop.nec[0]} mW/m² out to ${f1(def.range)} m`]: 'needs 0.12 mW/m² for an NEC signal, and at most 0.25 mW/m². At 106 mA the LED\'s 76 mW/sr stays above 0.12 mW/m² out to 25.2 m',
  [`a typical ${SRC.tsop.distance} m with a TSAL6200 at ${SRC.tsop.current} mA; this model's ${f1(P.SHEET_DISTANCE.intensity)} mW/sr at ${SRC.tsop.current} mA would reach only ${f1(P.SHEET_DISTANCE.reach)} m, and ${SRC.tsop.distance} m would need ${f3(P.SHEET_DISTANCE.needed)} mW/m²`]: 'a typical 30 m with a TSAL6200 at 50 mA; this model\'s 38.0 mW/sr at 50 mA would reach only 17.8 m, and 30 m would need 0.042 mW/m²',
}, 'Remote control deeper 4');
covered(L.remoteControlLesson.deeper[4].body, {
  [`At ${def.distance} m the photodiode makes ${f1(def.light * 1e9)} nA in each burst, on top of its ${f0(SRC.bpw34.dark[0])} nA dark current. At the threshold it makes only ${f1(thresholdLight * 1e9)} nA`]: 'At 5 m the photodiode makes 15.2 nA in each burst, on top of its 2 nA dark current. At the threshold it makes only 0.6 nA',
  [`flash at ${f0(N.carrier / 1000)} kHz. In the receiver's band of ${f1(band / 1000)} kHz the dark current's shot noise is ${f2(density * Math.sqrt(band) * 1e12)} pA, ${f0(thresholdLight / (density * Math.sqrt(band)))} times smaller than that ${f1(thresholdLight * 1e9)} nA`]: 'flash at 38 kHz. In the receiver\'s band of 3.8 kHz the dark current\'s shot noise is 1.56 pA, 384 times smaller than that 0.6 nA',
}, 'Remote control deeper 5');
covered(L.remoteControlLesson.deeper[5].body, {
  [`${D.slow} times slower here: its ${f2(def.frameEnd * 1000)} ms and the receiver's ${f0(def.delay * 1e6)} μs delay take ${f1(def.duration * D.slow)} s`]: '150 times slower here: its 68.08 ms and the receiver\'s 263 μs delay take 10.3 s',
  [`repeats in ${N.slot} ms slots`]: 'repeats in 108 ms slots',
}, 'Remote control deeper 6');
covered(L.remoteControlLesson.limits, {...scaleSnippets, ...transmitterSnippets, ...receiverSnippets, ...photodiodeSnippets}, 'Remote control limits');
covered(L.remoteControlLesson.quiz.explanation, {[`bursts of the ${f0(N.carrier / 1000)} kHz carrier`]: 'bursts of the 38 kHz carrier'}, 'Remote control quiz');

// Infrared signaling.
expectNone(L.infraredSignalingLesson, 'Infrared signaling');
covered(L.infraredSignalingLesson.deeper[0].body, {[`a ${0} is a pulse distance of ${SRC.nec.zero} ms and a ${1} of ${SRC.nec.one} ms. The model's TV splits them at ${D.split} ms, halfway, so a pulse could arrive ${f1((SRC.nec.one - SRC.nec.zero) / 2 * 1000)} μs early or late`]: 'a 0 is a pulse distance of 1.125 ms and a 1 of 2.25 ms. The model\'s TV splits them at 1.6875 ms, halfway, so a pulse could arrive 562.5 μs early or late'}, 'Infrared signaling deeper 1');
{
  const all = P.necBits(0), total = [...all].filter(bit => bit === '1').length;
  covered(L.infraredSignalingLesson.deeper[1].body, {
    [`The address ${SRC.nec.address} goes out and then ${all.slice(8, 16)}`]: 'The address 00110111 goes out and then 11001000',
    [`holds ${total} ones and ${32 - total} zeros, and always takes ${N.word} ms`]: 'holds 16 ones and 16 zeros, and always takes 67.5 ms',
  }, 'Infrared signaling deeper 2');
}
{
  const hz = SRC.rc5.carrier * 1000, bit = SRC.rc5.periods / hz, word = SRC.rc5.bits * bit, repeat = SRC.rc5.repeats / hz;
  covered(L.infraredSignalingLesson.deeper[2].body, {
    [`uses a ${SRC.rc5.carrier} kHz carrier and bi-phase coding: each of its ${SRC.rc5.bits} bits is half quiet and half a burst of ${SRC.rc5.pulses} pulses, so a bit lasts ${SRC.rc5.periods} carrier periods, ${f3(bit * 1000)} ms, a word ${f3(word * 1000)} ms, and the word repeats every ${f0(SRC.rc5.repeats)} periods, ${f3(repeat * 1000)} ms`]: 'uses a 36 kHz carrier and bi-phase coding: each of its 14 bits is half quiet and half a burst of 32 pulses, so a bit lasts 64 carrier periods, 1.778 ms, a word 24.889 ms, and the word repeats every 4,096 periods, 113.778 ms',
    [`rounds these to ${SRC.rc5.bit} ms, ${SRC.rc5.word} ms and ${SRC.rc5.repeat} ms, and labels a half bit ${SRC.rc5.half} μs, where ${SRC.rc5.pulses} cycles of ${SRC.rc5.carrier} kHz last ${f1(SRC.rc5.pulses / hz * 1e6)} μs`]: 'rounds these to 1.78 ms, 24.9 ms and 114 ms, and labels a half bit 868 μs, where 32 cycles of 36 kHz last 888.9 μs',
    [`RC5, ${SRC.tsop.rc5[0]} mW/m² against ${SRC.tsop.nec[0]} mW/m² for NEC`]: 'RC5, 0.08 mW/m² against 0.12 mW/m² for NEC',
  }, 'Infrared signaling deeper 3');
}
covered(L.infraredSignalingLesson.deeper[3].body, {
  [`as f0/${SRC.tsop.band} wide at half power, ${f1(band / 1000)} kHz at ${SRC.tsop.carrier} kHz`]: 'as f0/10 wide at half power, 3.8 kHz at 38 kHz',
  [`between ${SRC.tsop.delay[0]} and ${SRC.tsop.delay[1]} carrier cycles after a burst begins; the model takes ${D.delay}, ${f0(D.delay / (SRC.tsop.carrier * 1000) * 1e6)} μs`]: 'between 7 and 13 carrier cycles after a burst begins; the model takes 10, 263 μs',
}, 'Infrared signaling deeper 4');
covered(L.infraredSignalingLesson.deeper[4].body, {
  [`NEC's ${SRC.nec.carrier} kHz code`]: 'NEC\'s 38 kHz code',
  [`${D.slow} times slower here: with the receiver's delay its ${f2(def.duration * 1000)} ms take ${f1(def.duration * D.slow)} s`]: '150 times slower here: with the receiver\'s delay its 68.34 ms take 10.3 s',
}, 'Infrared signaling deeper 5');
covered(L.infraredSignalingLesson.limits, {[`${D.slow} times slower`]: '150 times slower', ...transmitterSnippets, ...receiverSnippets}, 'Infrared signaling limits');
covered(L.infraredSignalingLesson.quiz.explanation, {[`a burst of ${SRC.nec.pulses} cycles. A ${0} is a pulse distance of ${SRC.nec.zero} ms and a ${1} of ${SRC.nec.one} ms, and the TV splits them at ${D.split} ms`]: 'a burst of 22 cycles. A 0 is a pulse distance of 1.125 ms and a 1 of 2.25 ms, and the TV splits them at 1.6875 ms'}, 'Infrared signaling quiz');

// Diode.
expectNone(L.diodeLesson, 'Diode');
covered(L.diodeLesson.deeper[0].body, {
  'I = Is(e^(V/(nVT)) − 1)': 'I = Is(e^(V/(nVT)) − 1)',
  [`VT = kT/q is ${f2(SRC.k * 298.15 / SRC.q * 1000)} mV at ${celsius} °C; the Shockley page gives ${SRC.pages.thermal} mV at ${SRC.pages.thermalKelvin} K`]: 'VT = kT/q is 25.69 mV at 25 °C; the Shockley page gives 25.852 mV at 300 K',
  [`the 1N4148 gives Is = ${f3(S1.IS * 1e9)} nA and n = ${S1.N}, so the current grows tenfold every ${f0(nvt * Math.log(10) * 1000)} mV`]: 'the 1N4148 gives Is = 4.352 nA and n = 1.906, so the current grows tenfold every 113 mV',
}, 'Diode deeper 1');
covered(L.diodeLesson.deeper[1].body, {
  [`puts ${S1.RS} Ω in series, which at ${f2(0.9)} V takes ${f3(diodeBranch(0.9) * S1.RS)} V of the drop`]: 'puts 0.6458 Ω in series, which at 0.90 V takes 0.068 V of the drop',
  [`R1 of ${f3(S1.R1 / 1e9)} GΩ`]: 'R1 of 5.827 GΩ',
  [`at ${SRC.diode.leakAt} V reversed it carries ${f2(SRC.diode.leakAt / S1.R1 * 1e9)} nA of the ${f2(-diodeCurrent(-SRC.diode.leakAt) * 1e9)} nA`]: 'at 20 V reversed it carries 3.43 nA of the 7.78 nA',
}, 'Diode deeper 2');
covered(L.diodeLesson.deeper[2].body, {
  [`at most ${SRC.diode.vf} V at ${SRC.diode.at} mA and ${SRC.diode.leak} nA at ${SRC.diode.leakAt} V reversed; the model gives ${f3(bisect(volts => diodeCurrent(volts) - mA(SRC.diode.at), 0, 1.2))} V and ${f2(-diodeCurrent(-SRC.diode.leakAt) * 1e9)} nA`]: 'at most 1 V at 10 mA and 25 nA at 20 V reversed; the model gives 0.724 V and 7.78 nA',
  [`The 1N4448 on the same sheet is held to ${SRC.diode.window[0]} to ${SRC.diode.window[1]} V at ${SRC.diode.windowAt} mA, and the model's 1N4148 gives ${f3(P.DIODE_TEST.windowAt)} V there`]: 'The 1N4448 on the same sheet is held to 0.62 to 0.72 V at 5 mA, and the model\'s 1N4148 gives 0.687 V there',
  [`at a junction of ${SRC.diode.hot[1]} °C the sheet allows ${SRC.diode.hot[0]} μA`]: 'at a junction of 150 °C the sheet allows 50 μA',
}, 'Diode deeper 3');
covered(L.diodeLesson.deeper[3].body, {
  [`junction potential of ${S1.VJ} V as that voltage with nothing applied, the region is ${f2(Math.sqrt(1 + 20 / S1.VJ))} times as wide at ${20} V reversed and ${f2(Math.sqrt(1 - 0.7 / S1.VJ))} times as wide at ${f2(0.7)} V forward`]: 'junction potential of 0.869 V as that voltage with nothing applied, the region is 4.90 times as wide at 20 V reversed and 0.44 times as wide at 0.70 V forward',
  [`the 1N4148's capacitance with a grading coefficient of ${S1.M}`]: 'the 1N4148\'s capacitance with a grading coefficient of 0.03',
}, 'Diode deeper 4');
covered(L.diodeLesson.deeper[4].body, {
  [`threshold as ${SRC.pages.threshold[0]} to ${SRC.pages.threshold[1]} V`]: 'threshold as 0.6 to 0.7 V',
  [`from ${f1(0.1)} mA to ${f0(10)} mA, a hundredfold change, the model's voltage moves only from ${f3(bisect(volts => diodeCurrent(volts) - 1e-4, 0, 1.2))} to ${f3(bisect(volts => diodeCurrent(volts) - 1e-2, 0, 1.2))} V`]: 'from 0.1 mA to 10 mA, a hundredfold change, the model\'s voltage moves only from 0.492 to 0.724 V',
}, 'Diode deeper 5');
t.ok(f2(-diodeBranch(-5) * 1e9) === f2(-diodeBranch(-20) * 1e9), 'the diode’s own reverse current the same at 5 V and 20 V');
covered(L.diodeLesson.deeper[5].body, {[`passes ${f2(-diodeBranch(-5) * 1e9)} nA of it at ${5} V reversed and at ${20} V alike`]: 'passes 4.35 nA of it at 5 V reversed and at 20 V alike'}, 'Diode deeper 6');
covered(L.diodeLesson.limits, {[`The 1N4148's package is drawn ${f0(M.timesLarger(M.BIG))} times larger`]: 'The 1N4148\'s package is drawn 10 times larger', ...diodeSnippets}, 'Diode limits');
covered(L.diodeLesson.quiz.explanation, {[`At ${20} V reversed the model's 1N4148 passes ${f2(-diodeCurrent(-20) * 1e9)} nA, against ${f2(diodeCurrent(0.7) * 1000)} mA at ${f2(0.7)} V forward`]: 'At 20 V reversed the model\'s 1N4148 passes 7.78 nA, against 6.45 mA at 0.70 V forward'}, 'Diode quiz');

// Light-emitting diode.
expectNone(L.lightEmittingDiodeLesson, 'Light-emitting diode');
covered(L.lightEmittingDiodeLesson.deeper[0].body, {
  [`${f2(photonOf(940))} eV at ${940} nm, ${f2(photonOf(635))} eV at ${635} nm and ${f2(photonOf(585))} eV at ${585} nm`]: '1.32 eV at 940 nm, 1.95 eV at 635 nm and 2.12 eV at 585 nm',
  [`${SRC.tsal.vf[0]} V at ${SRC.tsal.at} mA for the TSAL6200, ${SRC.red.vf[0]} V at ${SRC.red.at} mA for the TLHR5400 and ${SRC.yellow.vf[0]} V at ${SRC.yellow.at} mA for the TLHY5400`]: '1.35 V at 100 mA for the TSAL6200, 2 V at 20 mA for the TLHR5400 and 2.4 V at 20 mA for the TLHY5400',
  [`about ${SRC.pages.leds[0]} V for infrared GaAs, and from ${SRC.pages.leds[1]} V for red up to ${SRC.pages.leds[2]} V for violet`]: 'about 1.2 V for infrared GaAs, and from 1.6 V for red up to 4 V for violet',
}, 'LED deeper 1');
t.ok(SRC.tsal.vf[0] > photonOf(940) && SRC.red.vf[0] > photonOf(635) && SRC.yellow.vf[0] > photonOf(585), 'each typical forward voltage a little above its photons’ energy');
{
  const sheetPhotons = SRC.tsal.power / 1000 / (SRC.h * SRC.c / (SRC.tsal.peak * 1e-9)), sheetElectrons = mA(SRC.tsal.at) / SRC.q, sheetIn = SRC.tsal.vf[0] * SRC.tsal.at;
  covered(L.lightEmittingDiodeLesson.deeper[1].body, {
    [`At ${SRC.tsal.at} mA the TSAL6200's sheet gives ${SRC.tsal.power} mW of light for ${f0(sheetIn)} mW in at ${SRC.tsal.vf[0]} V: ${f0(100 * SRC.tsal.power / sheetIn)}%, or ${f2(sheetPhotons / sheetElectrons)} photons for each electron`]: 'At 100 mA the TSAL6200\'s sheet gives 40 mW of light for 135 mW in at 1.35 V: 30%, or 0.30 photons for each electron',
    [`at ${f1(def.transmitter.current * 1000)} mA, the model gives ${f1(def.power)} mW of ${f0(def.transmitter.voltage * def.transmitter.current * 1000)} mW, ${f0(100 * def.power / (def.transmitter.voltage * def.transmitter.current * 1000))}%`]: 'at 106.3 mA, the model gives 42.3 mW of 144 mW, 29%',
  }, 'LED deeper 2');
}
{
  const cells = 2 * D.cellResistance, noResistor = bisect(amps => ledVolts(P.LEDS[0], amps) + amps * cells - def.battery, 0, def.battery / cells);
  covered(L.lightEmittingDiodeLesson.deeper[2].body, {
    [`tenfold for every ${f0(2 * P.VT * Math.log(10) * 1000)} mV`]: 'tenfold for every 118 mV',
    [`The handset's ${D.resistor} Ω resistor takes ${f2(def.transmitter.current * D.resistor)} V and sets the current at ${f0(def.transmitter.current * 1000)} mA; with no resistor the cells' ${f1(def.battery)} V would push ${f2(noResistor)} A through the LED, ${f0(noResistor / mA(SRC.tsal.ifMax))} times its ${SRC.tsal.ifMax} mA rating`]: 'The handset\'s 15 Ω resistor takes 1.59 V and sets the current at 106 mA; with no resistor the cells\' 3.0 V would push 1.27 A through the LED, 13 times its 100 mA rating',
  }, 'LED deeper 3');
}
{
  const onTime = def.bursts.reduce((sum, [a, b]) => sum + b - a, 0) / 3;
  t.ok(SRC.tsal.ifmDuty === 0.5, 'half duty');
  covered(L.lightEmittingDiodeLesson.deeper[3].body, {
    [`allows ${SRC.tsal.ifMax} mA steady, ${SRC.tsal.ifm} mA in pulses of ${SRC.tsal.ifmPulse} μs at half duty, and ${SRC.tsal.surge} A in a surge of ${SRC.tsal.surgePulse} μs`]: 'allows 100 mA steady, 200 mA in pulses of 100 μs at half duty, and 1.5 A in a surge of 100 μs',
    [`${f2(onTime * 1000)} ms in a ${f2(def.frameEnd * 1000)} ms frame, so it averages ${f1(def.transmitter.current * onTime / def.frameEnd * 1000)} mA and one key press draws ${f2(def.transmitter.current * onTime * 1000)} mC`]: '9.37 ms in a 68.08 ms frame, so it averages 14.6 mA and one key press draws 1.00 mC',
  }, 'LED deeper 4');
}
covered(L.lightEmittingDiodeLesson.deeper[4].body, {
  [`about ${SRC.pages.infrared} nm, so the ${SRC.tsal.peak} nm light`]: 'about 780 nm, so the 940 nm light',
  [`about ${SRC.pages.consumer[0]} nm or ${SRC.pages.consumer[1]} to ${SRC.pages.consumer[2]} nm`]: 'about 870 nm or 930 to 950 nm',
}, 'LED deeper 5');
t.ok(SRC.red.iv[1] === SRC.yellow.iv[1] && SRC.red.ivAt === SRC.yellow.ivAt && SRC.red.halfAngle === SRC.yellow.halfAngle, 'the red and yellow alike');
covered(L.lightEmittingDiodeLesson.deeper[5].body, {
  [`${SRC.red.iv[1]} mcd at ${SRC.red.ivAt} mA for both`]: '10 mcd at 10 mA for both',
  [`to ±${SRC.red.halfAngle}° at half intensity, where the transmitter keeps to ±${SRC.tsal.halfAngle}°`]: 'to ±30° at half intensity, where the transmitter keeps to ±17°',
}, 'LED deeper 6');
covered(L.lightEmittingDiodeLesson.limits, {[`a ${D.indicatorResistor} Ω resistor for the indicator`]: 'a 100 Ω resistor for the indicator', ...transmitterSnippets}, 'LED limits');
covered(L.lightEmittingDiodeLesson.quiz.explanation, {[`A ${SRC.yellow.peak} nm photon carries ${f2(photonOf(585))} eV and a ${SRC.tsal.peak} nm photon ${f2(photonOf(940))} eV. The TLHY5400's sheet gives ${SRC.yellow.vf[0]} V at ${SRC.yellow.at} mA, and the TSAL6200's ${SRC.tsal.vf[0]} V at ${SRC.tsal.at} mA`]: 'A 585 nm photon carries 2.12 eV and a 940 nm photon 1.32 eV. The TLHY5400\'s sheet gives 2.4 V at 20 mA, and the TSAL6200\'s 1.35 V at 100 mA'}, 'LED quiz');

// Photodiode.
expectNone(L.photodiodeLesson, 'Photodiode');
{
  const power = SRC.bpw34.test * 1e-3 / 1e-4 * SRC.bpw34.area * 1e-6, qe = responsivity * photonOf(SRC.bpw34.wavelength);
  covered(L.photodiodeLesson.deeper[0].body, {[`passes ${SRC.bpw34.light[1]} μA in reverse under ${SRC.bpw34.test} mW/cm² of ${SRC.bpw34.wavelength} nm light. On its ${SRC.bpw34.area} mm² that light is ${f0(power * 1e6)} μW, so its responsivity is ${f3(responsivity)} A/W. A ${SRC.bpw34.wavelength} nm photon carries ${f2(photonOf(SRC.bpw34.wavelength))} eV, so ${f3(responsivity)} A/W is ${f2(qe)} electrons for each photon`]: 'passes 50 μA in reverse under 1 mW/cm² of 950 nm light. On its 7.5 mm² that light is 75 μW, so its responsivity is 0.667 A/W. A 950 nm photon carries 1.31 eV, so 0.667 A/W is 0.87 electrons for each photon'}, 'Photodiode deeper 1');
}
covered(L.photodiodeLesson.deeper[1].body, {
  [`band gap of ${SRC.pages.siliconGap} eV matches a photon of ${f0(SRC.h * SRC.c / (SRC.pages.siliconGap * SRC.q) * 1e9)} nm`]: 'band gap of 1.12 eV matches a photon of 1,107 nm',
  [`from ${SRC.bpw34.range[0]} to ${f0(SRC.bpw34.range[1])} nm, peaking at ${SRC.bpw34.peak} nm, but only as a plot, so the model uses its ${SRC.bpw34.wavelength} nm responsivity at the remote's ${SRC.tsal.peak} nm`]: 'from 430 to 1,100 nm, peaking at 900 nm, but only as a plot, so the model uses its 950 nm responsivity at the remote\'s 940 nm',
}, 'Photodiode deeper 2');
covered(L.photodiodeLesson.deeper[2].body, {
  [`passes ${SRC.bpw34.dark[0]} nA at ${SRC.bpw34.darkAt} V reversed, and at most ${SRC.bpw34.dark[1]} nA`]: 'passes 2 nA at 10 V reversed, and at most 30 nA',
  [`the same ${SRC.bpw34.dark[0]} nA at ${D.bias} V. Light of ${f1(SRC.bpw34.dark[0] * 1e-9 / (responsivity * SRC.bpw34.area * 1e-6) * 1000)} mW/m²`]: 'the same 2 nA at 5 V. Light of 0.4 mW/m²',
}, 'Photodiode deeper 3');
covered(L.photodiodeLesson.deeper[3].body, {
  'shot noise √(2qIΔf)': 'shot noise √(2qIΔf)',
  [`For the ${SRC.bpw34.dark[0]} nA dark current that is ${f2(density * 1e14)} × 10⁻¹⁴ A/√Hz, and divided by the responsivity a noise equivalent power of ${f2(density / responsivity * 1e14)} × 10⁻¹⁴ W/√Hz, against the ${f0(SRC.bpw34.nep * 1e14)} × 10⁻¹⁴ W/√Hz on the sheet`]: 'For the 2 nA dark current that is 2.53 × 10⁻¹⁴ A/√Hz, and divided by the responsivity a noise equivalent power of 3.80 × 10⁻¹⁴ W/√Hz, against the 4 × 10⁻¹⁴ W/√Hz on the sheet',
  [`In the receiver's ${f1(band / 1000)} kHz band it is ${f2(density * Math.sqrt(band) * 1e12)} pA, so even the ${f1(thresholdLight * 1e9)} nA at the threshold stands ${f0(thresholdLight / (density * Math.sqrt(band)))} times above it`]: 'In the receiver\'s 3.8 kHz band it is 1.56 pA, so even the 0.6 nA at the threshold stands 384 times above it',
}, 'Photodiode deeper 4');
covered(L.photodiodeLesson.deeper[4].body, {
  [`the sheet gives ${SRC.bpw34.voc} mV under ${SRC.bpw34.test} mW/cm²`]: 'the sheet gives 350 mV under 1 mW/cm²',
  [`a diffusion current of ${f1(P.PHOTODIODE.diffusion * 1e12)} pA and a generation current of ${f2(P.PHOTODIODE.generation * 1e9)} nA, and gives ${f0(bisect(volts => photodiode(volts, def.light), 0, 1) * 1000)} mV at ${def.distance} m`]: 'a diffusion current of 54.9 pA and a generation current of 1.95 nA, and gives 102 mV at 5 m',
}, 'Photodiode deeper 5');
covered(L.photodiodeLesson.deeper[5].body, {[`draws ${SRC.tsop.supplyCurrent[1]} mA at ${SRC.tsop.supplyAt} V, needs ${SRC.tsop.nec[0]} mW/m² for the NEC code and at most ${SRC.tsop.nec[1]}, and still times its pulses right up to ${SRC.tsop.max} W/m²`]: 'draws 0.35 mA at 3.3 V, needs 0.12 mW/m² for the NEC code and at most 0.25, and still times its pulses right up to 30 W/m²'}, 'Photodiode deeper 6');
covered(L.photodiodeLesson.limits, {...transmitterSnippets, ...receiverSnippets, ...photodiodeSnippets}, 'Photodiode limits');
covered(L.photodiodeLesson.quiz.explanation, {[`passes ${SRC.bpw34.dark[0]} nA in the dark and ${f1(def.light * 1e9)} nA more in each burst at ${def.distance} m: its ${f3(responsivity)} A/W`]: 'passes 2 nA in the dark and 15.2 nA more in each burst at 5 m: its 0.667 A/W'}, 'Photodiode quiz');
t.ok(thresholdPhotocurrent === P.photocurrentOf(TS.nec), 'the threshold’s photocurrent');

// The model's own words: its scales and slowed clock, said where the reader sees them.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {[`seen from above ${f0(M.timesSmaller(M.METER))} times smaller`]: 'seen from above 250 times smaller', 'a 1N4148 diode\'s': 'a 1N4148 diode\'s', [`${D.slow} times slower`]: '150 times slower'}, 'system text');
covered(partText('handset'), {[`${M.HANDSET.body[0]} mm by ${M.HANDSET.body[1]} mm`]: '45 mm by 160 mm', [`two AAA cells ${f1(SRC.e92.diameter[1])} mm across and ${f1(SRC.e92.length[1])} mm long`]: 'two AAA cells 10.5 mm across and 44.5 mm long', [`The ${SRC.tsal.body} mm infrared LED`]: 'The 5 mm infrared LED'}, 'handset text');
covered(partText('room'), {[`${f0(M.timesSmaller(M.METER))} times smaller than true size, with a tick every ${M.ROOM.tickEvery} m out to ${P.REMOTE_DOMAINS.distance[1]} m`]: '250 times smaller than true size, with a tick every 5 m out to 30 m', [`leave the LED ${SRC.tsal.halfAngle}° either side`]: 'leave the LED 17° either side'}, 'room text');
covered(partText('signal'), {[`${D.slow} times slower`]: '150 times slower', [`standing for ${f0(S.amps * 1000)} mA`]: 'standing for 150 mA', [`from ${f1(S.light[0] * 1e9)} nA to ${f0(S.light[1] * 1e6)} μA`]: 'from 0.1 nA to 1 μA', [`tall for a ${1} and short for a ${0}`]: 'tall for a 1 and short for a 0', [`${N.pulses} flashes of the ${f0(N.carrier / 1000)} kHz carrier`]: '22 flashes of the 38 kHz carrier', [`every ${f0(S.tickEvery * 1000)} ms`]: 'every 10 ms'}, 'signal text');
covered(partText('led'), {[`from ${0} to ${f1(C.volts)} V, on a log scale from ${f0(C.amps[0] * 1e6)} μA to ${f0(C.amps[1])} A`]: 'from 0 to 3.4 V, on a log scale from 1 μA to 1 A'}, 'LED text');
covered(partText('receiver'), {[`reverse biased by ${D.bias} V`]: 'reverse biased by 5 V', [`One pair is drawn for each ${f0(PV.perPair * 1e9)} nA of current, up to ${PV.pairs}, so the dark current alone keeps ${f0(SRC.bpw34.dark[0] * 1e-9 / PV.perPair)} pairs moving`]: 'One pair is drawn for each 1 nA of current, up to 40, so the dark current alone keeps 2 pairs moving', [`from ${f2(R.irradiance[0])} to ${f0(R.irradiance[1])} mW/m² and ${f0(R.meters[0])} to ${f0(R.meters[1])} m`]: 'from 0.01 to 100 mW/m² and 1 to 30 m'}, 'receiver text');
covered(partText('junction'), {[`A 1N4148 signal diode, its glass package drawn ${f0(M.timesLarger(M.BIG))} times larger`]: 'A 1N4148 signal diode, its glass package drawn 10 times larger', [`from ${f0(DC.amps[0] * 1e12)} pA to ${f0(DC.amps[1])} A, reverse from ${M.signed(DC.volts[0], 0)} V to ${0} on the left and forward from ${0} to ${f0(DC.volts[1])} V on the right`]: 'from 1 pA to 1 A, reverse from −20 V to 0 on the left and forward from 0 to 1 V on the right', [`the fixed ${f1(SRC.pages.threshold[1])} V drop`]: 'the fixed 0.7 V drop'}, 'junction text');
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label);
  t.ok(readings.map(item => item.label).join() === 'Your result,LED current,Radiant intensity,At the receiver,Photocurrent,Frame,Decoded,Carrier,LED close up,Diode,Slowed', 'eleven readings');
  t.ok(find('LED current').value === '106 mA' && find('Radiant intensity').value === '76 mW/sr' && find('At the receiver').value === '3.05 mW/m²' && find('Photocurrent').value === '15.2 nA' && find('Frame').value === '68.08 ms' && find('Decoded').value === 'nothing yet' && find('Carrier').value === '38 kHz' && find('LED close up').value === '1.32 eV photons' && find('Diode').value === '6.45 mA at 0.70 V' && find('Slowed').value === '150 times', 'the readings carry the lessons’ figures');
  checkQuotedText(find('LED current').hint, {'a 15 Ω resistor and the cells\' own 0.45 Ω': `a ${D.resistor} Ω resistor and the cells' own ${f2(2 * D.cellResistance)} Ω`, 'averages 14.6 mA over a frame': `averages ${f1(def.average * 1000)} mA over a frame`}, t);
  checkQuotedText(find('Photocurrent').hint, {'shot noise is 1.56 pA': `shot noise is ${f2(density * Math.sqrt(band) * 1e12)} pA`}, t);
  checkQuotedText(find('Slowed').hint, {'take 10.3 s here': `take ${f1(def.duration * D.slow)} s here`, 'the room 250 times smaller and the diode\'s package 10 times larger': `the room ${f0(M.timesSmaller(M.METER))} times smaller and the diode's package ${f0(M.timesLarger(M.BIG))} times larger`}, t);
  checkQuotedText(find('Diode').hint, {'where the model gives 0.724 V': `where the model gives ${f3(P.DIODE_TEST.at)} V`, 'where it gives 7.8 nA': `where it gives ${f1(P.DIODE_TEST.leak * 1e9)} nA`, 'grows tenfold every 113 mV': `grows tenfold every ${decade(nvt * Math.log(10) * 1000)} mV`}, t);
  model.update({blocked: 1, emitter: 2, battery: 1.6, probe: -20});
  model.advance(1e4);
  const off = model.getState().readings, offFind = label => off.find(item => item.label === label);
  t.ok(offFind('Your result').value.startsWith('Not received · the hand') && offFind('Decoded').value === 'nothing' && offFind('Diode').value === '−7.78 nA at −20.00 V' && offFind('LED close up').hint.includes('4.75 nA') && offFind('At the receiver').hint.startsWith('A hand in the beam'), 'blocked, a dark yellow LED and a reversed diode, said as such');
}

for (const lesson of [L.remoteControlLesson, L.infraredSignalingLesson, L.diodeLesson, L.lightEmittingDiodeLesson, L.photodiodeLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3 && lesson.quiz.explanation, `${lesson.simple}: a quiz with its answer first`);
  t.ok(lesson.steps.length === 5 && lesson.parts.length === 6 && lesson.tryIt.length >= 6 && lesson.deeper.length >= 5 && lesson.sources.length >= 8, 'five steps, six parts, at least six trials, five deeper sections and eight sources');
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/(^|[\s(])-\d/.test(text), `negative numbers with a true minus sign: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(trial => model.parts.some(item => item.id === trial.part) && trial.view === 'front' && trial.reset === true && trial.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part the lesson names is drawn');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [lo, hi, step] = P.REMOTE_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.REMOTE_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'command,distance,battery,blocked,emitter,probe', 'six controls');
t.ok(model.controls.find(control => control.key === 'emitter').options === P.EMITTER_OPTIONS && model.controls.find(control => control.key === 'blocked').options === P.PATH_OPTIONS, 'the two choices');
const drawing = () => [pointsOf(T.ledGuide).slice(0, 60), pointsOf(T.lightGuide).slice(0, 60), pointsOf(T.bitGuide), T.tv.position.x, T.hand.visible, pointsOf(T.loadLine).slice(0, 20), T.depletion.scale.x, pointsOf(T.diodeCursor), T.ledPhotons.material.color.getHex(), pointsOf(T.ledCursor), pointsOf(T.receiverCursor)];
checkControlsMove(model, drawing, m => m.advance(3), t);
checkRefusals(P.sampleRemote, P.REMOTE_DOMAINS, t);
{
  // The plans are cached for the settings visited, and all dropped at once past 64.
  const kept = {...P.REMOTE_DEFAULTS, distance: 29};
  const first = P.remotePlan(kept);
  t.ok(P.remotePlan(kept) === first, 'a setting visited twice is planned once');
  for (let command = 100; command < 170; command++) P.remotePlan({...P.REMOTE_DEFAULTS, command});
  t.ok(P.remotePlan(kept) !== first, 'past 64 settings every plan is dropped, so a long session does not keep them');
}
{
  // The frame's edges, where an off by one would hide.
  const plan = P.remotePlan(P.REMOTE_DEFAULTS);
  t.ok(plan.bitStarts.length === 32 && plan.bursts.length === 34, 'the leader and the closing burst apart, the frame has 32 bit starts');
  t.near(P.remoteAt(plan, 1e3).t, plan.duration, 1e-15, 'the clock stops at the end of the frame');
  t.ok(P.remoteAt(plan, plan.frameEnd).sending === false && P.remoteAt(plan, plan.frameEnd - 1e-9).sending === true, 'the handset stops sending at the end of the frame');
  t.ok(P.remoteAt(plan, plan.bursts[0][1]).bursting === false && P.remoteAt(plan, plan.bursts[0][1] - 1e-9).bursting === true, 'a burst is over at the moment it ends');
  t.ok(P.remoteAt(plan, plan.bursts[1][0]).lit === true && P.remoteAt(plan, plan.bursts[1][0] + 0.5 / N.carrier).lit === false, 'the carrier is lit for the first third of its cycle and dark for the rest');
}
{
  // Reversed, the carriers drawn crossing start at the depletion region's edge, and the indicator needs a milliamp.
  model.reset();
  model.update({probe: -5});
  model.advance(0.3);
  const out = J.width * P.depletionShare(-5) / 2 + J.reach, crossing = Math.round(J.crossing * P.currentShare(P.diodeAt(-5).current));
  const phase = model.getState().clock / J.sweep, holes = instancesOf(T.crossingHoles);
  t.ok(crossing > 0 && holes.length === crossing, 'a carrier drawn for each decade of reverse current');
  t.near(holes[0].x, -(phase - Math.floor(phase)) * out, 1e-6, 'the reverse carriers set out from the depletion region’s edge, not from the middle');
  t.ok(model.playback.blocked() === false, 'the key can always be pressed');
  t.ok(model.getState().readings.find(item => item.label === 'Decoded').hint.includes(`longer than ${D.split} ms is a 1, shorter a 0`), 'the decoded reading states the rule the TV decodes by');
  model.reset();
  model.update({battery: 1.8, emitter: 1});
  model.advance(3);
  t.ok(P.ledLoop(1, 1.8).current < 1e-3 && T.indicatorLed.material.color.getHex() === M.COLORS.redOff, 'under a milliamp the indicator is drawn dark');
  model.update({battery: 3});
  t.ok(P.ledLoop(1, 3).current > 1e-3 && T.indicatorLed.material.color.getHex() === M.COLORS.red, 'fresh cells light it');
}
{
  // The leader runs 342 carrier cycles, far more than a bit's burst: the magnifier still shows only a bit's worth.
  model.reset();
  model.advance(0.5);
  const geometry = T.carrierTrace.geometry, count = geometry.drawRange.count, array = geometry.attributes.position.array;
  const drawn = Number.isFinite(count) ? Math.min(count, array.length / 3) : array.length / 3;
  let farthest = -Infinity;
  for (let i = 0; i < drawn; i++) farthest = Math.max(farthest, array[i * 3]);
  t.ok(model.getState().now.cycles > N.pulses, 'the leader is longer than a bit’s burst');
  t.ok(drawn > 0 && farthest <= S.magnifier[0] + S.magnifier[2] + 1e-9, 'the magnifier draws at most one bit’s burst, however long the burst runs');
}
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available(), 'nothing to inspect before the key is pressed');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 1 / D.slow, 1e-15, 'a step of a second sends 6.67 ms');
  t.ok(!model.playback.complete() && !model.resultPart.available() && JSON.stringify(model.getState().readings) !== before, 'partway through the leader, with new readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, 1.5 / D.slow, 1e-15, 'animation sends on by the time that passed, 150 times slower');
  model.advance(1e3);
  t.ok(model.playback.complete() && model.resultPart.available() && model.getState().now.decodedCount === 32, 'the frame sent and decoded, with a result to inspect');
  const held = JSON.stringify([pointsOf(T.outputTrace), pointsOf(T.bitTrace), T.tv.material.color.getHex(), instancesOf(T.ledHoles)]);
  model.animate(10);
  model.advance(50);
  t.ok(JSON.stringify([pointsOf(T.outputTrace), pointsOf(T.bitTrace), T.tv.material.color.getHex(), instancesOf(T.ledHoles)]) === held, 'once decoded, the frame holds');
  checkFinite(model.root, t);
  for (const action of model.actions) { const readings = action.run(); t.ok(Array.isArray(readings) && readings.length > 0 && model.parts.some(item => item.id === action.part) && action.replay === false, `${action.label} returns readings`); checkFinite(model.root, t); }
  t.ok(model.actions.find(action => action.part === 'signal').run() && model.getState().now.bit === 16, 'the first command bit inspected on its own burst');
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description) && !/(^|[\s(])-\d/.test(item.description) && !/\b(centre|colour|metre|grey|modelling)\b/i.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes, under the system');
  const routes = Object.fromEntries(model.parts.filter(item => item.route).map(item => [item.id, item.route]));
  assert.deepEqual(routes, {led: '#machine/light-emitting-diode', receiver: '#machine/photodiode', junction: '#machine/diode'});
  t.ok(model.initialPart === 'system' && model.initialView === 'front' && model.frameVisibleOnly && model.selectionOutline === false && model.transparentBackground && model.resultPart.id === 'signal', 'the viewer’s settings');
  for (const values of settings) for (const time of [0, 1, 5, 100]) {
    model.reset();
    model.update(values);
    model.advance(time);
    for (const item of model.getState().readings) {
      const text = item.value + (item.hint || '');
      t.ok(!/NaN|undefined|Infinity|null/.test(text) && !/[—–]| - |--/.test(text) && !/(^|[\s(])-\d/.test(text) && !/\b(centre|colour|metre|grey|modelling)\b/i.test(text), `${item.label}: numbers, no dashes, a true minus sign and American spelling`);
    }
    checkFinite(model.root, t);
  }
}
const released = checkDisposal((() => { const fresh = M.createRemoteControlModel(); fresh.advance(2); return fresh; })(), t);

// Last, the routes: the remote control's lesson and its four components.
const {houseComponents} = await import('./house-components.js');
const {studyLessons} = await import('./study-lessons.js');
t.ok(studyLessons['Remote control'] === L.remoteControlLesson, 'the remote control’s lesson');
for (const [name, lesson, part] of [['Infrared signaling', L.infraredSignalingLesson, 'signal'], ['Diode', L.diodeLesson, 'junction'], ['Light-emitting diode', L.lightEmittingDiodeLesson, 'led'], ['Photodiode', L.photodiodeLesson, 'receiver']]) {
  const component = houseComponents[name];
  t.ok(component && component.machine === 'Remote control' && component.part === part && component.lesson === lesson && component.intro === lesson.simple && component.view === 'front' && component.isolate === false, `${name} routes to the remote control’s ${part} with its own lesson`);
  assert.equal(component.values, undefined);
}
model.dispose();

console.log(`PASS remote control: ${t.count} checks, ${counts.bisections} bisections, ${counts.frames} frames rebuilt and decoded, ${counts.poses} poses, ${counts.carriers} carriers and pairs placed, ${counts.points} curve points, ${counts.numbers} quoted numbers traced, 5 lessons, ${released} resources released exactly once.`);

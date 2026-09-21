// Checks the LCD screen model and its RGB subpixels and OLED display lessons
// against their sources typed in again and their physics worked out by other
// routes: the twisted cell's onset against the linearized torque balance, its
// director tested as a least energy of a Frank energy written again, the light
// through it against Gooch and Tarry's closed form and a Jones product of its
// own, the crystal's first move under a new voltage from that energy's slope,
// primaries mixed again by elimination, OLED currents counted pixel by pixel,
// the scan worked out again from the timing table, and every band, window, bar,
// rod, ellipse, emitter, arrow and curve read back at swept settings and times.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './lcd-physics.js';
import * as M from './lcd-screen-model.js';
import * as L from './lcd-lessons.js';
import {houseComponents} from './house-components.js';
import {studyLessons} from './study-lessons.js';

const t = tally();
const counts = {energies: 0, layers: 0, poses: 0, points: 0, instances: 0, numbers: 0, pixels: 0, steps: 0};
const deg = radians => radians * 180 / Math.PI;
const f0 = v => fixed(v, 0), f1 = v => fixed(v, 1), f2 = v => fixed(v, 2), f3 = v => fixed(v, 3), f4 = v => fixed(v, 4);
const rel = (value, share) => Math.abs(value) * share + 1e-300;

// ---------------------------------------------------------------------------
// 1. Sources, typed in again, and what follows from them.
// ---------------------------------------------------------------------------

const SRC = {
  e0: 8.8541878188e-12,
  m1: {k11: 12.0, k22: 6.5, k33: 14.0, epsParallel: 20.5, epsPerpendicular: 14.0, deltaEps: 6.5, epsAverage: 16.2, gamma1: 342, ne: 1.5927, deltaN: 0.1147, clearing: 78.0, v0: 1.42},
  pages: {gap: 4, twist: 90, threshold1972: 0.9, opaque1972: 1.4, dc: 50, polaroid: 38, extinction: 500, response: [10, 90], subpixels1080p: 6e6, acuity: 1, amoled: [0.3, 0.7, 0.35], lg: 10, singlet: 25, triplet: 75, srgbHalf: 22},
  nhd43: {name: 'NHD-4.3-480272EF-ASXN', columns: 480, rows: 272, active: [95.04, 53.86], polarizer: [98, 56.2], bezel: [98.7, 57], outline: [105.5, 67.2], luminance: [800, 1000], contrast: [400, 500], response: [20, 30], red: [0.573, 0.347], green: [0.310, 0.613], blue: [0.143, 0.097], white: [0.273, 0.321], led: {current: [40, 50], voltage: [22.4, 25.6, 27.2], strings: 2, perString: 8, listed: 12, lifetime: 50000}, clock: 12, th: 525, thdisp: 480, thbp: 43, thfp: 2, thw: 1, tv: 285, tvdisp: 272, tvbp: 12, tvfp: 1, tvw: 1, hsync: [50, 60, 65], settle: 12, gate: 6, supply: 3.3, supplyCurrent: 25},
  nhd15: {name: 'NHD-1.5-128128UGC3', columns: 128, rows: 128, active: [26.855, 26.864], viewArea: 28, pitch: 0.21, subpixelPitch: 0.07, subpixel: [0.045, 0.194], gaps: [0.025, 0.016], contrast: 10000, rise: 10, fall: 10, luminance: [70, 90], lifetime: 10000, red: [0.64, 0.34], green: [0.31, 0.62], blue: [0.14, 0.16], white: [0.30, 0.33], supply: 3.3, supplyCurrent: 160},
  udc: {red: [0.66, 0.34, 29, 600000], green: [0.31, 0.63, 85, 400000]},
  idemitsu: {blue: [0.143, 0.078, 6.5], voltage: 3.8, eqe: 8.6, density: 10, peak: 452, lifetime: 9000, eqe2022: 14},
  srgb: {threshold: 0.04045, linear: 0.0031308, slope: 12.92, offset: 0.055, scale: 1.055, exponent: 2.4, red: [0.64, 0.33], green: [0.30, 0.60], blue: [0.15, 0.06], white: [0.3127, 0.3290], Y: [0.2126, 0.7152, 0.0722], toXYZ: [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], fromXYZ: [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]], luminance: 80},
};
const sameList = (a, b, tolerance = 1e-12) => a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) <= tolerance);

t.ok(P.EPSILON_0 === SRC.e0, 'CODATA’s vacuum permittivity');
for (const key of ['k11', 'k22', 'k33']) t.near(P.M1[key], SRC.m1[key] * 1e-12, 1e-24, `M-1’s ${key} of ${SRC.m1[key]} pN`);
for (const key of ['epsParallel', 'epsPerpendicular', 'epsAverage', 'ne', 'deltaN', 'clearing', 'v0']) t.ok(P.M1[key] === SRC.m1[key], `M-1’s ${key} as the patent gives it`);
t.ok(P.M1.deltaEpsilon === SRC.m1.deltaEps && SRC.m1.epsParallel - SRC.m1.epsPerpendicular === SRC.m1.deltaEps, 'M-1: Δε = ε∥ − ε⊥ = 6.5');
t.near(P.M1.gamma1, SRC.m1.gamma1 / 1000, 1e-15, 'M-1: γ1 of 342 mPa·s');
t.near(P.ORDINARY, SRC.m1.ne - SRC.m1.deltaN, 1e-15, 'the ordinary index, ne − Δn');
t.ok(f4(P.ORDINARY) === '1.4780' && f1((SRC.m1.epsParallel + 2 * SRC.m1.epsPerpendicular) / 3) === f1(SRC.m1.epsAverage), 'no = 1.4780, and εav = (ε∥ + 2ε⊥)/3 = 16.2');
t.ok(P.PAGES.gap === SRC.pages.gap && P.PAGES.twist === SRC.pages.twist && P.PAGES.threshold1972 === SRC.pages.threshold1972 && P.PAGES.opaque1972 === SRC.pages.opaque1972, 'a layer typically 4 μm thick, twisted 90°, and 1972’s 0.9 V and 1.4 V');
t.near(P.PAGES.dcLimit * 1000, SRC.pages.dc, 1e-9, 'a DC part as small as 50 mV');
t.ok(P.PAGES.polaroid * 100 === SRC.pages.polaroid && P.PAGES.extinction === 1 / SRC.pages.extinction, 'Polaroid: about 38% and 1:500');
t.ok(sameList(P.PAGES.response.map(v => v * 100), SRC.pages.response, 1e-9) && P.PAGES.subpixels1080p === SRC.pages.subpixels1080p && P.PAGES.acuity === SRC.pages.acuity, 'response from 10% to 90%, six million subpixels and 1 arc minute');
t.ok(P.PAGES.amoled.whiteText === SRC.pages.amoled[0] && P.PAGES.amoled.blackText === SRC.pages.amoled[1] && P.PAGES.amoled.lcd === SRC.pages.amoled[2], 'the AMOLED page’s 0.3 W, 0.7 W and 0.35 W');
t.near(P.PAGES.oledResponse * 1e6, SRC.pages.lg, 1e-9, 'LG’s under 10 μs');
t.ok(P.PAGES.singlet * 100 === SRC.pages.singlet && 100 - SRC.pages.singlet === SRC.pages.triplet && P.PAGES.srgbHalf * 100 === SRC.pages.srgbHalf, '25% singlets, 75% triplets, and sRGB’s 22%');
assert.deepEqual(JSON.parse(JSON.stringify(P.TN)), {twist: Math.PI / 2, pretilt: 2 * Math.PI / 180, layers: 40, black: 5, step: 0.05, wavelengths: [630e-9, 550e-9, 460e-9], stability: 0.4});
assert.deepEqual(JSON.parse(JSON.stringify(P.SCREEN)), {slow: 100, frames: 12, patchColumns: [120, 360], patchRows: [72, 200], closeRows: [134, 137], closeColumns: [238, 241], band: 8, sample: 0.25e-3, snapshot: 1e-3, oledVoltage: 3.8, viewing: 300, darken: 0.1, lighten: 0.4, previousPolarity: -1});
assert.deepEqual(JSON.parse(JSON.stringify(P.SCREEN_DOMAINS)), {red: [0, 255, 1], green: [0, 255, 1], blue: [0, 255, 1], background: [0, 1, 1], gap: [3, 6, 0.5]});
assert.deepEqual({...P.SCREEN_DEFAULTS}, {red: 255, green: 128, blue: 0, background: 0, gap: 4});
assert.deepEqual(P.BACKGROUND_OPTIONS.map(option => [option.value, option.label]), [[0, 'Black'], [1, 'White']]);
t.ok(P.SCREEN_DOMAINS.gap[0] < SRC.pages.gap && P.SCREEN_DOMAINS.gap[1] > SRC.pages.gap && P.SCREEN_DEFAULTS.gap === SRC.pages.gap, 'gaps around the Liquid crystal page’s typical 4 μm, starting there');

// The LCD module.
const N43 = SRC.nhd43, LP = P.LCD_PANEL;
t.ok(LP.name === N43.name && LP.columns === N43.columns && LP.rows === N43.rows && sameList(LP.active, N43.active) && sameList(LP.polarizer, N43.polarizer) && sameList(LP.bezel, N43.bezel) && sameList(LP.outline, N43.outline), 'the module’s 480 by 272 pixels, active area, polarizer, bezel and outline');
t.ok(LP.luminance === N43.luminance[1] && LP.luminanceMin === N43.luminance[0] && LP.contrast === N43.contrast[1] && LP.contrastMin === N43.contrast[0], '1000 cd/m² (800 at least) and 500:1 (400 at least)');
t.near(LP.response * 1000, N43.response[0], 1e-9, 'rise and fall together 20 ms');
t.near(LP.responseMax * 1000, N43.response[1], 1e-9, 'and at most 30 ms');
for (const key of ['red', 'green', 'blue', 'white']) t.ok(sameList(LP[key], N43[key]), `the module’s ${key} chromaticity`);
t.near(LP.backlight.current * 1000, N43.led.current[0], 1e-9, 'the backlight’s 40 mA');
t.near(LP.backlight.currentMax * 1000, N43.led.current[1], 1e-9, 'and 50 mA at most');
t.ok(LP.backlight.voltage === N43.led.voltage[1] && sameList(LP.backlight.voltageRange, [N43.led.voltage[0], N43.led.voltage[2]]) && LP.backlight.strings === N43.led.strings && LP.backlight.perString === N43.led.perString && LP.backlight.listed === N43.led.listed && LP.backlight.lifetime === N43.led.lifetime, '25.6 V (22.4 to 27.2), two strings of eight in the circuit, 12 in the feature list, 50,000 h');
t.near(N43.led.voltage[1] / N43.led.perString, 3.2, 1e-12, 'eight white LEDs in series at 3.2 V each make 25.6 V: the circuit’s count, not the feature list’s');
t.ok(N43.led.strings * N43.led.perString !== N43.led.listed, 'a conflict noted: sixteen LEDs drawn against twelve listed');
t.ok(LP.clock === N43.clock * 1e6 && LP.lineClocks === N43.th && LP.activeClocks === N43.thdisp && LP.hBack === N43.thbp && LP.hFront === N43.thfp && LP.hSync === N43.thw && LP.frameLines === N43.tv && LP.activeLines === N43.tvdisp && LP.vBack === N43.tvbp && LP.vFront === N43.tvfp && LP.vSync === N43.tvw, 'the parallel RGB timing table’s typical values');
t.ok(N43.thdisp + N43.thbp + N43.thfp === N43.th && N43.tvdisp + N43.tvbp + N43.tvfp === N43.tv, '480 + 43 + 2 = 525 and 272 + 12 + 1 = 285: each back porch includes its sync pulse');
t.ok(sameList(LP.hsyncPeriod.map(v => v * 1e6), N43.hsync, 1e-9) && N43.hsync[0] * 1e-6 > N43.th / (N43.clock * 1e6) && N43.th / 9e6 * 1e6 > N43.hsync[0] && N43.th / 9e6 * 1e6 < N43.hsync[2], 'a conflict noted: the Hsync period of 50 to 65 μs is longer than 525 clocks at 12 MHz, though 525 at 9 MHz falls inside it');
t.near(LP.sourceSettle * 1e6, N43.settle, 1e-9, 'the column driver settles in 12 μs');
t.near(LP.gateEdge * 1e6, N43.gate, 1e-9, 'the gate driver’s edges take 6 μs');
t.ok(LP.supply === N43.supply && Math.abs(LP.supplyCurrent * 1000 - N43.supplyCurrent) < 1e-9, '3.3 V at 25 mA');
t.near(P.LINE, N43.th / (N43.clock * 1e6), 1e-18, 'a row lasts 525 clocks at 12 MHz');
t.near(P.FRAME, N43.tv * N43.th / (N43.clock * 1e6), 1e-15, 'a frame 285 rows');
t.ok(f2(P.LINE * 1e6) === '43.75' && f2(P.FRAME * 1000) === '12.47' && f1(1 / P.FRAME) === '80.2' && f1(P.LINE / (N43.settle * 1e-6)) === '3.6', '43.75 μs, 12.47 ms, 80.2 frames a second, 3.6 times the settling');
t.near(N43.active[0] / N43.columns, 0.198, 1e-12, '95.04 mm over 480 pixels: 0.198 mm');
t.ok(Math.abs(N43.rows * 0.198 - N43.active[1]) < 0.005, '272 pixels of 0.198 mm make the 53.86 mm down, to the datasheet’s rounding');
t.near(N43.led.voltage[1] * N43.led.current[0] / 1000, 1.024, 1e-12, 'the backlight takes 25.6 V × 40 mA = 1.024 W');

// The OLED module.
const N15 = SRC.nhd15, OP = P.OLED_PANEL;
t.ok(OP.name === N15.name && OP.columns === N15.columns && OP.rows === N15.rows && sameList(OP.active, N15.active) && OP.viewArea === N15.viewArea && OP.pitch === N15.pitch && OP.subpixelPitch === N15.subpixelPitch && sameList(OP.subpixel, N15.subpixel) && sameList(OP.gaps, N15.gaps), 'the OLED module’s drawing: 128 by 128, its active area, pitches, subpixels and gaps');
t.ok(OP.contrast === N15.contrast && Math.abs(OP.rise * 1e6 - N15.rise) < 1e-9 && Math.abs(OP.fall * 1e6 - N15.fall) < 1e-9 && OP.luminance === N15.luminance[1] && OP.luminanceMin === N15.luminance[0] && OP.lifetime === N15.lifetime && OP.supply === N15.supply && Math.abs(OP.supplyCurrent * 1000 - N15.supplyCurrent) < 1e-9, 'above 10,000:1, 10 μs each way, 90 cd/m² (70 at least), 10,000 h, 3.3 V and 160 mA');
for (const key of ['red', 'green', 'blue', 'white']) t.ok(sameList(OP[key], N15[key]), `the OLED module’s ${key} chromaticity`);
t.near(N15.columns * N15.pitch - N15.gaps[0], N15.active[0], 1e-9, '128 × 0.21 mm less one gap of 0.025 mm: the active area across');
t.near(N15.rows * N15.pitch - N15.gaps[1], N15.active[1], 1e-9, 'and less 0.016 mm down');
t.near(N15.subpixelPitch * 3, N15.pitch, 1e-12, 'three subpixels of 0.07 mm to a pixel');
t.near(N15.subpixelPitch - N15.subpixel[0], N15.gaps[0], 1e-12, 'a 0.045 mm subpixel and a 0.025 mm gap');
t.near(N15.pitch - N15.subpixel[1], N15.gaps[1], 1e-12, 'a 0.194 mm subpixel and a 0.016 mm gap');

// Emitters and sRGB.
const E = P.EMITTERS;
t.ok(E.red.x === SRC.udc.red[0] && E.red.y === SRC.udc.red[1] && E.red.efficiency === SRC.udc.red[2] && E.red.lifetime === SRC.udc.red[3], 'Universal Display’s red: (0.66, 0.34), 29 cd/A, 600,000 h');
t.ok(E.green.x === SRC.udc.green[0] && E.green.y === SRC.udc.green[1] && E.green.efficiency === SRC.udc.green[2] && E.green.lifetime === SRC.udc.green[3], 'and its green: (0.31, 0.63), 85 cd/A, 400,000 h');
t.ok(E.blue.x === SRC.idemitsu.blue[0] && E.blue.y === SRC.idemitsu.blue[1] && E.blue.efficiency === SRC.idemitsu.blue[2] && E.blue.voltage === SRC.idemitsu.voltage && Math.abs(E.blue.eqe * 100 - SRC.idemitsu.eqe) < 1e-9 && E.blue.density === SRC.idemitsu.density * 10 && Math.abs(E.blue.peak * 1e9 - SRC.idemitsu.peak) < 1e-6 && E.blue.lifetime === SRC.idemitsu.lifetime, 'Idemitsu Kosan’s deep blue: (0.143, 0.078), 6.5 cd/A at 3.8 V and 10 mA/cm², 8.6%, 452 nm, 9000 h');
const S = P.SRGB, SR = SRC.srgb;
t.ok(S.threshold === SR.threshold && S.linearThreshold === SR.linear && S.slope === SR.slope && S.offset === SR.offset && S.scale === SR.scale && S.exponent === SR.exponent && S.luminance === SR.luminance, 'sRGB’s curve and its 80 cd/m²');
for (const key of ['red', 'green', 'blue', 'white']) t.ok(sameList(S[key], SR[key]), `sRGB’s ${key} chromaticity`);
t.ok(sameList(S.shares, SR.Y) && S.toXYZ.every((row, i) => sameList(row, SR.toXYZ[i])) && S.fromXYZ.every((row, i) => sameList(row, SR.fromXYZ[i])), 'sRGB’s Y shares and both matrices');
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) t.near(SR.fromXYZ[i].reduce((sum, value, k) => sum + value * SR.toXYZ[k][j], 0), i === j ? 1 : 0, 1e-3, 'the two matrices invert each other to their 4 digits');
{
  const white = [0, 1, 2].map(i => SR.toXYZ[i].reduce((a, b) => a + b, 0)), sum = white[0] + white[1] + white[2];
  t.near(white[0] / sum, SR.white[0], 1e-4, 'sRGB full on is D65 across');
  t.near(white[1] / sum, SR.white[1], 1e-4, 'and up');
  t.ok(sameList(SR.toXYZ[1], SR.Y), 'the matrix’s middle row is the Y shares');
}
const ownDecode = code => (code <= SR.threshold ? code / SR.slope : ((code + SR.offset) / SR.scale) ** SR.exponent);
t.near(SR.threshold / SR.slope, ((SR.threshold + SR.offset) / SR.scale) ** SR.exponent, 1e-7, 'the two pieces of sRGB’s curve meet at 0.04045');
for (let code = 0; code <= 255; code++) {
  t.near(P.srgbDecode(code / 255), ownDecode(code / 255), 1e-15, `code ${code} decoded`);
  t.near(P.srgbEncode(P.srgbDecode(code / 255)), code / 255, 1e-9, `and encoded back`);
}
t.ok(f2(100 * ownDecode(128 / 255)) === '21.59' && f0(100 * ownDecode(128 / 255)) === '22' && f1(100 * ownDecode(188 / 255)) === '50.3' && f3(128 / 255) === '0.502', 'code 128 gives 21.6%, about the RGB page’s 22%, and 188 gives 50.3%');
t.near(P.arcMinutes(0.066), 0.066 / 300 * 180 / Math.PI * 60, 1e-6, 'a subpixel’s arc minutes from its size over the distance');

// The twisted cell’s onset, by the linearized torque balance.
const Kt = (SRC.m1.k11 + (SRC.m1.k33 - 2 * SRC.m1.k22) / 4) * 1e-12, VTH = Math.PI * Math.sqrt(Kt / (SRC.e0 * SRC.m1.deltaEps)), VSPLAY = Math.PI * Math.sqrt(SRC.m1.k11 * 1e-12 / (SRC.e0 * SRC.m1.deltaEps));
const table = P.staticTable();
t.near(table.onset, VTH, 2e-3, 'the onset by bisection on the energy’s curvature against π√((K11 + (K33 − 2K22)/4)/(ε0Δε))');
t.ok(Math.abs(P.onsetVoltage(160) - VTH) < Math.abs(table.onset - VTH), 'closer still with 160 layers');
t.ok(f2(VTH) === '1.45' && f2(table.onset) === '1.45' && f2(VSPLAY) === '1.43' && Math.abs(VSPLAY - SRC.m1.v0) / SRC.m1.v0 < 0.02, 'a threshold of 1.45 V, and 1.43 V from the splay constant against the patent’s 1.42 V');
t.ok(SRC.pages.threshold1972 < VTH && SRC.pages.opaque1972 < 2 * VTH, 'M-1 switches at a higher voltage than 1972’s best mixtures');

// The director at rest: a least energy of the Frank energy written again.
function ownEnergy(theta, phi, volts, gap) {
  const N = theta.length - 1, h = gap * 1e-6 / N, {k11, k22, k33, epsPerpendicular: ep, deltaEps: de} = SRC.m1;
  let F = 0, I = 0;
  for (let j = 0; j < N; j++) {
    const m = (theta[j] + theta[j + 1]) / 2, c2 = Math.cos(m) ** 2, s2 = 1 - c2, dt = (theta[j + 1] - theta[j]) / h, dp = (phi[j + 1] - phi[j]) / h;
    F += (0.5 * (k11 * c2 + k33 * s2) * dt * dt + 0.5 * c2 * (k22 * c2 + k33 * s2) * dp * dp) * 1e-12 * h;
    I += h / (ep + de * s2);
  }
  counts.energies++;
  return F - 0.5 * SRC.e0 * volts * volts / I;
}
const ownB = m => { const c2 = Math.cos(m) ** 2; return c2 * (SRC.m1.k22 * c2 + SRC.m1.k33 * (1 - c2)); };
for (const volts of [0, 1.2, 1.45, 1.6, 2, 3, 5]) {
  const {theta, phi} = P.restingDirector(volts), N = theta.length - 1, base = ownEnergy(theta, phi, volts, 4), delta = 1e-4;
  t.ok(theta[0] === P.TN.pretilt && theta[N] === P.TN.pretilt && phi[0] === 0 && Math.abs(phi[N] - Math.PI / 2) < 1e-15, `${volts} V: held at the plates, 2° up, twisted 90°`);
  for (let k = 1; k < N; k += 3) {
    for (const sign of [1, -1]) {
      const bent = Float64Array.from(theta); bent[k] += sign * delta;
      t.ok(ownEnergy(bent, phi, volts, 4) >= base - rel(base, 1e-12), `${volts} V: tilting depth ${k} does not lower the energy`);
      const turned = Float64Array.from(phi); turned[k] += sign * delta;
      t.ok(ownEnergy(theta, turned, volts, 4) >= base - rel(base, 1e-12), `${volts} V: twisting depth ${k} does not lower the energy`);
    }
  }
  for (const sign of [1, -1]) {
    const smooth = theta.map((value, k) => value + sign * 1e-3 * Math.sin(Math.PI * k / N));
    t.ok(ownEnergy(smooth, phi, volts, 4) >= base - rel(base, 1e-12), `${volts} V: a smooth bend either way raises the energy`);
  }
  const flux = Array.from({length: N}, (_, j) => ownB((theta[j] + theta[j + 1]) / 2) * (phi[j + 1] - phi[j]));
  t.ok(Math.max(...flux) / Math.min(...flux) - 1 < 1e-10, `${volts} V: b(θ)φ′ the same at every depth, the twist’s first integral`);
  const field = P.fieldProfile(theta, volts, 4), h = 4e-6 / N;
  t.near(field.reduce((sum, value) => sum + value * h, 0), volts, rel(volts, 1e-12), `${volts} V: the field adds up to the voltage`);
  const D = field.map((value, j) => SRC.e0 * (SRC.m1.epsPerpendicular + SRC.m1.deltaEps * Math.sin((theta[j] + theta[j + 1]) / 2) ** 2) * value);
  t.ok(volts === 0 || Math.max(...D) / Math.min(...D) - 1 < 1e-12, `${volts} V: the displacement the same at every depth`);
  if (volts >= 2) {
    const flat = new Float64Array(N + 1).fill(P.TN.pretilt);
    t.ok(ownEnergy(flat, P.twistProfile(flat), volts, 4) > base, `${volts} V: lying flat costs more than the tilt found`);
  }
}
t.ok(deg(P.restingDirector(2 * VTH).theta[20]) > 30, 'at twice the threshold the middle stands more than 30° up: the pretilt got the tilt started');
t.ok(table.middles.every((value, i) => i === 0 || value >= table.middles[i - 1] - 1e-12) && table.thetas.every(theta => theta.every(value => value >= 0 && value < Math.PI / 2)), 'the middle tilts further at every step of the drive, and never past upright or below the plate');
t.ok(f1(deg(table.middles[Math.round(5 / P.TN.step)])) === '88.9', 'at 5 V the middle stands 88.9° up');
{
  const parts = P.reducedEnergyParts(P.restingDirector(2).theta, 2);
  t.ok(parts.g[0] === 0 && parts.g[parts.g.length - 1] === 0, 'both plates hold the director, so the energy’s slope is set aside at each end');
  t.ok(parts.g.slice(1, -1).every(value => Math.abs(value) < 1e-6), 'and between them the solved tilt leaves no slope');
}

// The light: a Jones product of this check’s own, and Gooch and Tarry’s closed form.
const ownRetarder = (axis, retardance) => {
  const c = Math.cos(axis), s = Math.sin(axis), p = [Math.cos(retardance / 2), Math.sin(retardance / 2)], q = [p[0], -p[1]];
  return [[p[0] * c * c + q[0] * s * s, p[1] * c * c + q[1] * s * s], [(p[0] - q[0]) * c * s, (p[1] - q[1]) * c * s], [(p[0] - q[0]) * c * s, (p[1] - q[1]) * c * s], [p[0] * s * s + q[0] * c * c, p[1] * s * s + q[1] * c * c]];
};
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const ownIndex = tilt => { const no = SRC.m1.ne - SRC.m1.deltaN; return 1 / Math.sqrt(Math.sin(tilt) ** 2 / no ** 2 + Math.cos(tilt) ** 2 / SRC.m1.ne ** 2); };
function ownFields(theta, phi, gap, wavelength) {
  const N = theta.length - 1, thickness = gap * 1e-6 / N, out = [[[1, 0], [0, 0]]];
  let ex = [1, 0], ey = [0, 0];
  for (let j = 0; j < N; j++) {
    const tilt = (theta[j] + theta[j + 1]) / 2, [a, b, c, d] = ownRetarder((phi[j] + phi[j + 1]) / 2, 2 * Math.PI * (ownIndex(tilt) - (SRC.m1.ne - SRC.m1.deltaN)) * thickness / wavelength);
    [ex, ey] = [cadd(cmul(a, ex), cmul(b, ey)), cadd(cmul(c, ex), cmul(d, ey))];
    out.push([ex, ey]);
    counts.layers++;
  }
  return out;
}
const k1 = 2 * SRC.pages.polaroid / 100 / (1 + 1 / SRC.pages.extinction), k2 = k1 / SRC.pages.extinction;
/** Unpolarized light through a rear sheet along x, the cell, and a crossed front sheet: each input polarization in turn, each sheet passing k1 along and k2 across. */
function ownTransmission(theta, phi, gap, wavelength, sheets = [k1, k2]) {
  const N = theta.length - 1, thickness = gap * 1e-6 / N, [s1, s2] = sheets.map(Math.sqrt);
  let total = 0;
  for (const input of [[1, 0], [0, 1]]) {
    let ex = [s1 * input[0], 0], ey = [s2 * input[1], 0];
    for (let j = 0; j < N; j++) {
      const [a, b, c, d] = ownRetarder((phi[j] + phi[j + 1]) / 2, 2 * Math.PI * (ownIndex((theta[j] + theta[j + 1]) / 2) - (SRC.m1.ne - SRC.m1.deltaN)) * thickness / wavelength);
      [ex, ey] = [cadd(cmul(a, ex), cmul(b, ey)), cadd(cmul(c, ex), cmul(d, ey))];
    }
    total += s2 * s2 * (ex[0] ** 2 + ex[1] ** 2) + s1 * s1 * (ey[0] ** 2 + ey[1] ** 2);
  }
  return total / 2;
}
t.near(P.POLAROID[0], k1, 1e-15, 'Polaroid’s k1 from 38% and 1:500');
t.near(P.POLAROID[1], k2, 1e-15, 'and its k2');
t.near((k1 + k2) / 2, 0.38, 1e-15, 'one sheet passes 38% of unpolarized light');
{
  const parallel = P.unpolarizedThrough(P.multiplyMatrices(P.polarizerMatrix(0, k1, k2), P.polarizerMatrix(0, k1, k2)));
  const crossed = P.unpolarizedThrough(P.multiplyMatrices(P.polarizerMatrix(Math.PI / 2, k1, k2), P.polarizerMatrix(0, k1, k2)));
  t.near(parallel, (k1 * k1 + k2 * k2) / 2, 1e-15, 'two parallel sheets pass (k1² + k2²)/2');
  t.near(crossed, k1 * k2, 1e-15, 'two crossed sheets still pass k1·k2');
  t.ok(f0(parallel / crossed) === '250' && f3(parallel) === '0.288', 'a contrast of 250:1 at best from Polaroid, 28.8% through two parallel sheets');
}
for (let angle = 0; angle <= 180; angle += 15) {
  const a = angle * Math.PI / 180, out = P.applyMatrix(P.polarizerMatrix(a), Float64Array.of(1, 0, 0, 0));
  t.near(P.intensityOf(out), Math.cos(a) ** 2, 1e-15, `Malus at ${angle}°: the projection’s intensity`);
  t.near(P.malus(1, a), Math.cos(a) ** 2, 1e-15, `and Malus’s law`);
  t.near(P.unpolarizedThrough(P.polarizerMatrix(a)), 0.5, 1e-15, 'an ideal polarizer passes half of unpolarized light');
  const quarter = P.applyMatrix(P.retarderMatrix(a, Math.PI / 2), Float64Array.of(1, 0, 0, 0));
  t.near(P.intensityOf(quarter), 1, 1e-12, `a quarter-wave plate at ${angle}° turns the light elliptical and loses none of it`);
  const half = P.applyMatrix(P.retarderMatrix(a / 2, Math.PI), Float64Array.of(1, 0, 0, 0));
  t.near(Math.hypot(half[0], half[1]), Math.abs(Math.cos(a)), 1e-12, `a half-wave plate at ${angle / 2}° turns x-polarized light to ${angle}°`);
  t.near(Math.hypot(half[2], half[3]), Math.abs(Math.sin(a)), 1e-12, 'across as well');
  t.near(half[0] * half[3] - half[1] * half[2], 0, 1e-12, 'still linearly polarized');
  const turned = P.applyMatrix(P.rotationMatrix(a), Float64Array.of(1, 0, 0, 0));
  t.near(turned[0], Math.cos(a), 1e-15, 'a rotation turns the polarization');
  t.near(turned[2], Math.sin(a), 1e-15, 'and carries its y part the same way round');
}
t.near(P.unpolarizedThrough(P.multiplyMatrices(P.polarizerMatrix(Math.PI / 2), P.polarizerMatrix(0))), 0, 1e-30, 'ideal crossed polarizers pass nothing');
for (let volts = 0; volts <= 5; volts += 0.25) {
  const i = Math.round(volts / P.TN.step), theta = table.thetas[i], phi = table.phis[i], M0 = P.cellMatrix(theta, phi, 4, 550e-9);
  t.near(M0[0] ** 2 + M0[1] ** 2 + M0[4] ** 2 + M0[5] ** 2, 1, 1e-12, `${volts} V: the cell loses no light, its matrix unitary`);
  for (const gap of [3, 4.5, 6]) for (const [c, wavelength] of P.TN.wavelengths.entries()) {
    t.near(P.cellTransmission(theta, phi, gap, wavelength), ownTransmission(theta, phi, gap, wavelength), 1e-12, `${volts} V, ${gap} μm, ${wavelength * 1e9} nm: the light by this check’s own Jones product`);
    if (gap === 4.5 && volts === 0) t.near(P.opticsTable(gap).channels[c].light[i], ownTransmission(theta, phi, gap, wavelength), 1e-12, 'the table’s light too');
  }
}
{
  const layered = layers => { const flat = new Float64Array(layers + 1).fill(P.TN.pretilt); return [flat, Float64Array.from({length: layers + 1}, (_, j) => Math.PI / 2 * j / layers)]; };
  const coarse = layered(P.TN.layers), fine = layered(8 * P.TN.layers);
  for (const gap of [3, 4, 5, 6]) for (const wavelength of P.TN.wavelengths) {
    const u = 2 * (ownIndex(P.TN.pretilt) - (SRC.m1.ne - SRC.m1.deltaN)) * gap * 1e-6 / wavelength, X = Math.PI / 2 * Math.sqrt(1 + u * u), gooch = 1 - Math.sin(X) ** 2 / (1 + u * u);
    const near = 2 * P.cellTransmission(...coarse, gap, wavelength, [1, 0]), finer = 2 * P.cellTransmission(...fine, gap, wavelength, [1, 0]);
    t.near(near, gooch, 1.5e-3, `${gap} μm at ${wavelength * 1e9} nm: forty twisted layers against Gooch and Tarry's formula, u = ${f3(u)}`);
    t.near(finer, gooch, 3e-5, 'and three hundred and twenty layers closer still');
    t.ok(Math.abs(finer - gooch) < Math.abs(near - gooch), 'the layered product converging on the closed form');
    counts.layers += 9 * P.TN.layers;
  }
  const u4 = 2 * SRC.m1.deltaN * 4e-6 / 550e-9;
  t.ok(f2(u4) === '1.67' && u4 < Math.sqrt(3) && f2(Math.sqrt(3) * 550e-9 / (2 * SRC.m1.deltaN) * 1e6) === '4.15', 'at 4 μm, 2Δnd/λ = 1.67 at 550 nm, just short of √3, which 4.15 μm would reach');
  const rest0 = P.restingDirector(0);
  t.ok(f1(100 * 2 * P.cellTransmission(rest0.theta, rest0.phi, 4, 550e-9, [1, 0])) === '99.8', 'the twisted cell at rest passes 99.8% of what parallel polarizers would');
}

// Each channel’s white and black, and the drive that asks for a share of the way.
for (const gap of [3, 3.5, 4, 4.5, 5, 5.5, 6]) {
  const optics = P.opticsTable(gap);
  optics.channels.forEach((ch, c) => {
    t.ok(ch.falling, `${gap} μm, channel ${c}: the light only falls above its white`);
    let falls = true;
    for (let i = 1; i < ch.light.length; i++) if (table.volts[i] > ch.whiteVolts && table.volts[i - 1] >= ch.whiteVolts && ch.light[i] > ch.light[i - 1] + 1e-12) falls = false;
    t.ok(falls && Math.max(...ch.light) <= ch.whiteT + 1e-12, 'counted again step by step, and no step brighter than its white');
    const white = P.restingDirector(ch.whiteVolts);
    t.near(ownTransmission(white.theta, white.phi, gap, ch.wavelength), ch.whiteT, 1e-11, 'the white’s light by this check’s product');
    for (const dv of [-0.004, 0.004]) if (ch.whiteVolts + dv > 0) { const near = P.restingDirector(ch.whiteVolts + dv); t.ok(ownTransmission(near.theta, near.phi, gap, ch.wavelength) <= ch.whiteT + 1e-9, 'and no brighter a little either side'); }
    t.near(ch.contrast, ch.whiteT / ch.blackT, rel(ch.contrast, 1e-12), 'contrast as white over black');
    t.ok(ch.contrast < 250.01 && ch.contrast > 180, `${gap} μm: under Polaroid’s 250:1`);
  });
  t.ok(optics.toBlack.span > 0 && optics.toWhite.span > 0 && optics.switching === optics.toBlack.span + optics.toWhite.span, `${gap} μm: switching to black and back`);
}
t.ok([3, 4, 5, 6].map(gap => P.opticsTable(gap).toBlack.span).every((span, i, list) => i === 0 || span > list[i - 1]), 'a thicker cell darkens more slowly');
for (const values of [{}, {green: 188}, {red: 180, blue: 64}, {gap: 6, red: 20, green: 240}]) {
  const plan = P.screenPlan(values);
  plan.volts.forEach((volts, c) => {
    const ch = plan.lcd.channels[c], share = ownDecode(plan.codes[c] / 255), target = ch.blackT + share * (ch.whiteT - ch.blackT), director = P.restingDirector(volts);
    t.near(plan.linear[c], share, 1e-15, 'the code decoded');
    t.near(ownTransmission(director.theta, director.phi, plan.gap, ch.wavelength), target, rel(target, 1e-7) + 1e-12, `${JSON.stringify(values)}: channel ${c} at ${f3(volts)} V lets through its share by this check’s product`);
    t.ok(volts >= ch.whiteVolts - 1e-12 && volts <= P.TN.black, 'between its white and black voltages');
  });
}

// The crystal turning: its first step from this check’s own energy slope, its energy falling, its end at rest.
{
  const gap = 4, volts = P.screenPlan({}).volts[1], last = table.volts.length - 1, start = {theta: table.thetas[last], phi: table.phis[last]};
  const N = start.theta.length - 1, h = gap * 1e-6 / N, tau = SRC.m1.gamma1 / 1000 * (gap * 1e-6) ** 2 / (SRC.m1.k11 * 1e-12), dt = 0.4 * (1 / N) ** 2 / (2 * SRC.m1.k33 / SRC.m1.k11) * tau / 2;
  const one = P.relax(start, volts, gap, dt, {sample: dt, snapshot: dt, wavelengths: [550e-9]});
  t.ok(one.count === 1 && one.thetas.length === 2 && Math.abs(one.dt - dt) < 1e-18, 'one step of the flow');
  // The energy holds a large electric term, so the difference either side of a
  // depth is taken over a step wide enough to leave the subtraction its digits.
  const slope = (array, k, other, isTheta, d) => {
    const plus = Float64Array.from(array), minus = Float64Array.from(array);
    plus[k] += d; minus[k] -= d;
    return ((isTheta ? ownEnergy(plus, other, volts, gap) : ownEnergy(other, plus, volts, gap)) - (isTheta ? ownEnergy(minus, other, volts, gap) : ownEnergy(other, minus, volts, gap))) / (2 * d);
  };
  for (let k = 2; k < N; k += 4) {
    const expectTheta = start.theta[k] - dt / (SRC.m1.gamma1 / 1000 * h) * slope(start.theta, k, start.phi, true, 1e-5);
    const expectPhi = start.phi[k] - dt / (SRC.m1.gamma1 / 1000 * h * Math.cos(start.theta[k]) ** 2) * slope(start.phi, k, start.theta, false, 1e-4);
    // Where a depth barely moves in one step, the difference of two energies
    // cannot resolve it; there the check only asks that it stay put.
    const moves = (drawn, expected, from, what) => (Math.abs(expected - from) > 1e-8 ? t.near(drawn, expected, Math.abs(expected - from) * 1e-3, what) : t.ok(Math.abs(drawn - from) < 1e-8, `${what}: barely moves`));
    moves(one.thetas[1][k], expectTheta, start.theta[k], `depth ${k}: γ1·θ̇ = −δF/δθ from this check’s energy`);
    moves(one.phis[1][k], expectPhi, start.phi[k], `depth ${k}: γ1·cos²θ·φ̇ = −δF/δφ, the twist energy being square in it`);
    counts.steps++;
  }
  for (const values of [{}, {gap: 3}, {gap: 6, red: 90}]) {
    const plan = P.screenPlan(values);
    plan.patchFlows.forEach((flow, c) => {
      let falls = true, previous = Infinity;
      flow.thetas.forEach((theta, i) => { const energy = ownEnergy(theta, flow.phis[i], flow.volts, plan.gap); if (energy > previous + rel(previous, 1e-11)) falls = false; previous = energy; });
      t.ok(falls, `${JSON.stringify(values)}, channel ${c}: the energy never rises as the crystal turns`);
      t.ok(flow.energy.every((value, i) => i === 0 || value <= flow.energy[i - 1] + Math.abs(value) * 1e-11), 'nor by the flow’s own count');
      const every = Math.round(flow.snapshot / flow.sample), unit = SRC.m1.k11 * 1e-12 / (plan.gap * 1e-6);
      flow.thetas.forEach((theta, i) => { if (i % 5) return; const own = ownEnergy(theta, flow.phis[i], flow.volts, plan.gap); t.near(flow.energy[i * every] * unit, own, rel(own, 1e-9), `${JSON.stringify(values)}, channel ${c}: the energy the flow counts against this check’s own`); });
    });
  }
  const long = P.relax(start, volts, gap, 1.0, {wavelengths: [550e-9], snapshot: 1.0}), rest = P.restingDirector(volts);
  t.near(deg(long.thetas.at(-1)[N >> 1]), deg(rest.theta[N >> 1]), 0.02, 'left a second, the crystal ends where the least energy puts it');
  t.near(long.light[0].at(-1), P.cellTransmission(rest.theta, rest.phi, gap, 550e-9), 2e-5, 'letting through the same light');
  const lighten = P.opticsTable(4).lighten, i1 = Math.round(0.2 / lighten.sample), i2 = Math.round(0.35 / lighten.sample);
  const decay = (i2 - i1) * lighten.sample / Math.log((lighten.middle[i1] - table.middles[0]) / (lighten.middle[i2] - table.middles[0]));
  const tauK11 = SRC.m1.gamma1 / 1000 * 16e-12 / (SRC.m1.k11 * 1e-12 * Math.PI ** 2), tauK33 = SRC.m1.gamma1 / 1000 * 16e-12 / (SRC.m1.k33 * 1e-12 * Math.PI ** 2);
  t.ok(decay > tauK33 && decay < tauK11, `relaxing at 4 μm the middle’s tilt decays with a time of ${f1(decay * 1000)} ms, between γ1d²/(K33π²) and γ1d²/(K11π²)`);
  t.ok(f1(tauK11 * 1000) === '46.2', 'τoff = γ1d²/(kπ²) with the splay constant: 46.2 ms at 4 μm');
}

// Colors mixed again by elimination.
const ownXYZ = ([x, y], Y = 1) => [x / y * Y, Y, (1 - x - y) / y * Y];
function ownShares(panel) {
  const cols = [panel.red, panel.green, panel.blue].map(xy => ownXYZ(xy)), w = ownXYZ(panel.white);
  const A = [0, 1, 2].map(i => [cols[0][i], cols[1][i], cols[2][i], w[i]]);
  for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < 3; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k]; } }
  return [0, 1, 2].map(i => A[i][3] / A[i][i]);
}
const inside = (p, a, b, c) => { const side = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]); const s = [side(a, b, p), side(b, c, p), side(c, a, p)]; return s.every(v => v >= 0) || s.every(v => v <= 0); };
for (const [name, panel] of [['LCD', LP], ['OLED', OP]]) {
  const shares = ownShares(panel);
  P.primaryShares(panel).forEach((share, c) => t.near(share, shares[c], 1e-12, `${name}: the white’s luminance share of channel ${c} by elimination`));
  t.near(shares.reduce((a, b) => a + b, 0), 1, 1e-12, `${name}: the shares add to the white’s luminance`);
  const white = P.chromaticityOf(P.mixXYZ(panel, [1, 1, 1]));
  t.ok(Math.abs(white[0] - panel.white[0]) < 1e-12 && Math.abs(white[1] - panel.white[1]) < 1e-12, `${name}: all three full make the datasheet’s white`);
  for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) {
    const levels = [0, 0, 0]; levels[a] = 1; levels[b] = 0.37;
    const mix = P.chromaticityOf(P.mixXYZ(panel, levels)), A = [panel.red, panel.green, panel.blue][a], B = [panel.red, panel.green, panel.blue][b];
    t.near((B[0] - A[0]) * (mix[1] - A[1]) - (B[1] - A[1]) * (mix[0] - A[0]), 0, 1e-12, `${name}: two primaries mix on the straight line between them`);
  }
  for (let k = 0; k < 20; k++) {
    const levels = [(k * 0.37) % 1, (k * 0.61) % 1, (k * 0.83) % 1], mix = P.chromaticityOf(P.mixXYZ(panel, levels));
    if (mix) t.ok(inside(mix, panel.red, panel.green, panel.blue) && P.insideTriangle(mix, panel.red, panel.green, panel.blue), `${name}: a mixture inside its triangle`);
  }
  const drawn = P.drawnColor(P.mixXYZ(panel, [0.3, 0.8, 0.1]), panel), xyz = P.mixXYZ(panel, [0.3, 0.8, 0.1]);
  const lin = v => SR.fromXYZ.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]), scale = 1 / Math.max(...lin(ownXYZ(panel.white)));
  lin(xyz).forEach((value, i) => { const light = Math.max(0, Math.min(1, value * scale)); t.near(drawn.rgb[i], light <= SR.linear ? SR.slope * light : SR.scale * light ** (1 / SR.exponent) - SR.offset, 1e-12, `${name}: a mixture drawn in sRGB, its white at the top`); });
}
t.ok(inside(LP.red, SR.red, SR.green, SR.blue) && !inside(LP.green, SR.red, SR.green, SR.blue) && !inside(LP.blue, SR.red, SR.green, SR.blue) && [OP.red, OP.green, OP.blue].every(xy => !inside(xy, SR.red, SR.green, SR.blue)), 'the LCD’s green and blue and all three of the OLED’s outside sRGB, the LCD’s red inside');
t.ok(f3(P.primaryShares(LP)[1]) === '0.677' && f3(P.primaryShares(LP)[0]) === '0.178' && f3(P.primaryShares(LP)[2]) === '0.145', 'the LCD’s white: 67.7% green, 17.8% red, 14.5% blue');

// OLED currents, counted pixel by pixel.
for (const values of [{}, {background: 1}, {red: 0, green: 0, blue: 255}, {red: 255, green: 255, blue: 255, background: 1}, {red: 40, green: 200, blue: 90}]) {
  const plan = P.screenPlan(values), shares = ownShares(OP), eff = [SRC.udc.red[2], SRC.udc.green[2], SRC.idemitsu.blue[2]], pixel = (SRC.nhd15.pitch * 1e-3) ** 2, emitter = SRC.nhd15.subpixel[0] * SRC.nhd15.subpixel[1] * 1e-6;
  const levels = plan.codes.map(code => ownDecode(code / 255));
  levels.forEach((level, c) => {
    const I = shares[c] * N43.luminance[1] * level * pixel / eff[c];
    t.near(plan.currents[c], I, rel(I, 1e-12), `${JSON.stringify(values)}: channel ${c} draws what its light needs over its efficiency`);
    t.near(plan.densities[c], I / emitter, rel(I / emitter, 1e-12), 'over an emitter 0.045 by 0.194 mm');
    t.near(plan.emitting[c], I / emitter * eff[c], rel(I / emitter * eff[c], 1e-12) + 1e-12, 'which shines at J times its efficiency');
    t.near(plan.moduleCurrents[c], shares[c] * SRC.nhd15.luminance[1] * level * pixel / eff[c], 1e-18, 'and at the module’s own 90 cd/m²');
  });
  const lcdPixel = N43.active[0] / N43.columns * 1e-3 * N43.active[1] / N43.rows * 1e-3, patchPixels = (P.SCREEN.patchColumns[1] - P.SCREEN.patchColumns[0]) * (P.SCREEN.patchRows[1] - P.SCREEN.patchRows[0]), otherPixels = N43.columns * N43.rows - patchPixels;
  let amps = 0;
  for (let c = 0; c < 3; c++) amps += shares[c] * N43.luminance[1] * lcdPixel / eff[c] * (levels[c] * patchPixels + plan.background * otherPixels);
  t.near(plan.oledPower, amps * SRC.idemitsu.voltage, rel(plan.oledPower, 1e-12) + 1e-15, `${JSON.stringify(values)}: the OLED’s power counted pixel by pixel`);
  counts.pixels += N43.columns * N43.rows;
  t.near(plan.aperture, 3 * emitter / pixel, 1e-12, 'three emitters cover 59.4% of a pixel');
  t.ok(plan.backlightPower === N43.led.voltage[1] * N43.led.current[0] / 1000, 'the LCD’s backlight the same whatever the picture');
}
{
  const white = P.screenPlan({red: 255, green: 255, blue: 255, background: 1}), shares = ownShares(OP), eff = [29, 85, 6.5];
  const split = shares.map((share, c) => share / eff[c]), blue = split[2] / split.reduce((a, b) => a + b, 0);
  t.ok(blue > 0.5 && f0(white.oledPower * 1000) === f0(white.oledWhitePower * 1000), `a white screen’s power ${f0(100 * blue)}% blue`);
  t.ok(f3(P.screenPlan({}).aperture) === '0.594', 'an aperture of 59.4%');
}

// The scan, worked out again from the timing table.
{
  const plan = P.screenPlan({}), rows = [134, 135, 136];
  for (let k = 0; k <= 400; k++) {
    const time = plan.duration * k / 400 + (k % 7) * 1e-7, now = P.screenAt(plan, time), T = Math.min(time, plan.duration);
    const frame = Math.min(plan.frames - 1, Math.floor(T / P.FRAME)), line = Math.min(N43.tv - 1, Math.floor((T - frame * P.FRAME) / P.LINE + 1e-9));
    const scan = time > 0 && time < plan.duration && line >= N43.tvbp && line < N43.tvbp + N43.tvdisp ? line - N43.tvbp : null;
    t.ok(now.scanRow === scan, `${f3(time * 1000)} ms: the row being written`);
    rows.forEach((row, i) => {
      const start = (N43.tvbp + row) * P.LINE, writes = time > 0 && T >= start ? Math.min(plan.frames, Math.floor((T - start) / P.FRAME + 1e-9) + 1) : 0;
      const polarity = writes ? (writes % 2 ? 1 : -1) : -1, info = now.rows[i];
      t.ok(info.writes === writes && info.polarity === polarity && info.held.every((v, c) => v === (writes ? plan.volts[c] : P.TN.black) * polarity), `row ${row}: ${writes} writes, polarity ${polarity}`);
      const age = T - start;
      info.oled.forEach((value, c) => t.near(value, writes ? plan.linear[c] * (1 - Math.exp(-age * Math.log(9) / (SRC.nhd15.rise * 1e-6))) : 0, 1e-12, 'an OLED subpixel rising with its 10 μs'));
      info.lcd.forEach((value, c) => t.near(value, writes ? P.seriesAt(plan.patchFlows[c].light[c], plan.patchFlows[c].sample, age) / plan.whites[c] : plan.before[c], 1e-15, 'an LCD subpixel following its crystal'));
    });
  }
  const at = seconds => P.screenAt(plan, seconds).rows[1];
  const first = at(P.rowStart(135) + P.LINE / 2), second = at(P.rowStart(135) + P.FRAME + P.LINE / 2);
  t.ok(first.polarity === 1 && second.polarity === -1 && first.held[1] + second.held[1] === 0, 'each frame flips the held voltage: over two frames it averages to nothing');
  const rise = P.OLED_TAU * Math.log(9);
  t.near(rise, SRC.nhd15.rise * 1e-6, 1e-18, 'an OLED’s 10% to 90% is its 10 μs');
  const flow = plan.patchFlows[0];
  for (let i = 0; i < flow.count; i += 37) t.near(P.seriesAt(flow.light[0], flow.sample, i * flow.sample), flow.light[0][i], 1e-15, 'the light read at its own samples');
}

// ---------------------------------------------------------------------------
// 2. The drawing, read back.
// ---------------------------------------------------------------------------

const model = M.createLcdScreenModel(), T = model.topology;
const pointsOf = line => { const array = line.geometry.attributes.position.array, n = line.geometry.drawRange.count; return Array.from({length: Number.isFinite(n) ? Math.min(n, array.length / 3) : array.length / 3}, (_, i) => [array[3 * i], array[3 * i + 1], array[3 * i + 2]]); };
const instanceOf = (mesh, i) => { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); const e = matrix.elements; counts.instances++; return {x: e[12], y: e[13], z: e[14], sx: e[0], sy: e[5]}; };
const colorAt = (mesh, i) => { const color = new THREE.Color(); mesh.getColorAt(i, color); return color; };
const srgb = rgb => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
const same = (a, b, tolerance = 1e-6) => Math.abs(a.r - b.r) < tolerance && Math.abs(a.g - b.g) < tolerance && Math.abs(a.b - b.b) < tolerance;
// Instance matrices and line points are kept as 32 bit floats, so everything
// read back from them is compared to about a part in ten million.
const FLOAT32 = 2e-6;
const boxAt = (item, x0, x1, y0, y1, scale, tolerance = FLOAT32) => Math.abs(item.x - (x0 + x1) / 2 * scale) < tolerance && Math.abs(item.y - (y0 + y1) / 2 * scale) < tolerance && Math.abs(item.sx - (x1 - x0) * scale) < tolerance && Math.abs(item.sy - (y1 - y0) * scale) < tolerance;
const MM = 0.01, PIX = 0.002, CELL = 0.15;
t.ok(M.MM === MM && M.PIXEL === PIX && M.CELL === CELL && M.timesLarger(PIX) === 200 && Math.abs(M.timesLarger(CELL) - 15000) < 1e-9 && M.timesLarger(MM / 1000) === 1, 'the scales the text states: true size, 200 and 15,000 times larger');
const pitch = N43.active[0] / N43.columns * 1000, pitchDown = N43.active[1] / N43.rows * 1000, [aw, ah] = N43.active;
const ownSubpixelColor = (panel, c, level) => {
  const xyz = ownXYZ([panel.red, panel.green, panel.blue][c]), linear = SR.fromXYZ.map(row => row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2]), top = Math.max(...linear);
  return linear.map(value => { const light = Math.max(0, Math.min(1, value / top * Math.max(0, Math.min(1, level)))); return light <= SR.linear ? SR.slope * light : SR.scale * light ** (1 / SR.exponent) - SR.offset; });
};
for (const panel of [LP, OP]) for (let c = 0; c < 3; c++) for (const level of [0, 0.2, 1]) t.ok(sameList(M.subpixelColor(panel, c, level), ownSubpixelColor(panel, c, level), 1e-12), 'a subpixel’s drawn color: its primary, brightest component full, at its level');

const settingsList = [{}, {background: 1}, {gap: 3}, {gap: 6, red: 180}, {red: 0, green: 0, blue: 0}, {red: 255, green: 255, blue: 255, background: 1}, {red: 0, green: 255, blue: 0}];
for (const values of settingsList) {
  const plan = P.screenPlan(values), gap = plan.gap;
  for (const time of [0, P.rowStart(135) + P.LINE / 2, 2.5 * P.FRAME + 0.0003, plan.duration]) {
    model.reset();
    model.update(values);
    model.advance(time * P.SCREEN.slow);
    model.root.updateMatrixWorld(true);
    const state = model.getState(), now = P.screenAt(plan, state.clock), middle = now.middle;
    counts.poses++;
    t.near(state.clock, time, 1e-12, 'the clock drawn 100 times slower');

    // The module at true size: its bands of rows, the row being written and the ring.
    t.ok(Math.abs(T.body.scale.x - N43.outline[0] * MM) < 1e-12 && Math.abs(T.body.scale.y - N43.outline[1] * MM) < 1e-12 && Math.abs(T.bezel.scale.x - N43.bezel[0] * MM) < 1e-12 && Math.abs(T.bezel.scale.y - N43.bezel[1] * MM) < 1e-12, 'the outline and bezel at true size');
    t.ok(T.bands.count === 34 * 3, '34 bands of rows, three pieces each');
    for (let b = 0; b < 34; b++) {
      const top = ah / 2 - b * 8 * pitchDown / 1000, bottom = Math.max(-ah / 2, top - 8 * pitchDown / 1000), edges = [-aw / 2, -aw / 2 + 120 * pitch / 1000, -aw / 2 + 360 * pitch / 1000, aw / 2], band = now.bands[b], inPatch = b * 8 >= 72 && b * 8 < 200;
      t.ok(band.row === b * 8 && band.inPatch === inPatch, `band ${b}: rows ${b * 8} on, ${inPatch ? 'through the patch' : 'background'}`);
      for (let k = 0; k < 3; k++) {
        const item = instanceOf(T.bands, b * 3 + k), lights = k === 1 && inPatch ? band.patch : band.back;
        t.ok(boxAt(item, edges[k], edges[k + 1], bottom, top, MM), 'placed on its rows and columns');
        t.ok(same(colorAt(T.bands, b * 3 + k), srgb(P.drawnColor(P.mixXYZ(LP, lights, plan.lcdShares), LP).rgb)), 'colored by the light its subpixels let through now');
      }
    }
    t.ok(T.scanBar.visible === (now.scanRow !== null), now.scanRow === null ? 'no row being written' : `row ${now.scanRow} marked`);
    if (now.scanRow !== null) t.ok(Math.abs(T.scanBar.position.y - (ah / 2 - (now.scanRow + 0.5) * pitchDown / 1000) * MM) < 1e-12 && Math.abs(T.scanBar.scale.x - aw * MM) < 1e-12, 'across the screen at its row');
    const ringX = -aw / 2 + 239.5 * pitch / 1000, ringY = ah / 2 - 135.5 * pitchDown / 1000;
    t.ok(pointsOf(T.ring).every(([x, y]) => Math.abs(Math.hypot(x / MM - ringX, y / MM - ringY) - M.PANELVIEW.ring) < 1e-4), 'a ring 3 mm around the pixels drawn close up');

    // The backlight at true size.
    t.ok(Math.abs(T.guide.scale.x - N43.polarizer[0] * MM) < 1e-12 && Math.abs(T.guide.scale.y - N43.polarizer[1] * MM) < 1e-12 && T.leds.count === 16, 'a light guide the polarizer’s size, and sixteen LEDs');
    for (let i = 0; i < 16; i++) {
      const item = instanceOf(T.leds, i), x = -N43.polarizer[0] / 2 + (i + 0.5) * N43.polarizer[0] / 16, y = -N43.polarizer[1] / 2 - M.BACKLIGHTVIEW.below;
      t.ok(boxAt(item, x - 1.5, x + 1.5, y - 0.7, y + 0.7, MM) && y + 0.7 < -N43.polarizer[1] / 2, i < 8 ? 'the first string of eight along the bottom edge' : 'the second string');
    }
    t.ok(T.glow.every(arrow => Math.abs(arrow.userData.length - 12 * MM) < 1e-12 && arrow.visible), 'the LEDs always shining into the guide');

    // Transistors and capacitors.
    for (let row = 0; row < 3; row++) {
      const info = now.rows[row];
      t.ok(T.gateLines[row].material.color.getHex() === (now.scanRow === info.row ? M.COLORS.scan : M.COLORS.gate), now.scanRow === info.row ? `gate line ${info.row} lit while written` : 'a gate line resting');
      t.ok(Math.abs(T.gateLines[row].position.y - ((0.5 - row) * pitchDown + 10) * PIX) < 1e-12 && Math.abs(T.gateLines[row].scale.x - 3 * pitch * PIX) < 1e-12, 'along the foot of its row');
      for (let column = 0; column < 3; column++) for (let sub = 0; sub < 3; sub++) {
        const i = (row * 3 + column) * 3 + sub, x0 = (column - 1.5) * pitch + sub * pitch / 3, x1 = x0 + pitch / 3, y1 = (1.5 - row) * pitchDown, y0 = y1 - pitchDown;
        t.ok(boxAt(instanceOf(T.windows, i), x0 + 8, x1 - 8, y0 + 34, y1 - 8, PIX), 'a window inside its subpixel, above the strip');
        t.ok(same(colorAt(T.windows, i), srgb(ownSubpixelColor(LP, sub, info.lcd[sub]))), 'as bright as its light now');
        const held = info.held[sub], bar = instanceOf(T.bars, i);
        t.ok(Math.abs(bar.sx - 32 * Math.abs(held) / 5 * PIX) < FLOAT32 && Math.abs(bar.x - (x0 + 26 + 16 * Math.abs(held) / 5) * PIX) < FLOAT32 && Math.abs(bar.y - (y0 + 24) * PIX) < FLOAT32, `a bar for ${f2(held)} V`);
        t.ok(same(colorAt(T.bars, i), srgb(held >= 0 ? [0.851, 0.604, 0.169] : [0.169, 0.365, 0.612]), 1e-6), held >= 0 ? 'orange for positive' : 'blue for negative');
        t.ok(boxAt(instanceOf(T.tfts, i), x0 + 6, x0 + 22, y0 + 2, y0 + 18, PIX) && x0 + 26 + 32 <= x1 - 8 + 1e-9, 'its transistor on the gate line, clear of a full bar');
        t.ok(same(colorAt(T.lights, i), srgb(ownSubpixelColor(LP, sub, info.lcd[sub]))) && boxAt(instanceOf(T.lights, i), x0 + 8, x1 - 8, y0 + 8, y1 - 8, PIX), 'the pixels as light');
        const ox0 = (column - 1.5) * 210 + sub * 70;
        t.ok(boxAt(instanceOf(T.emitters, i), ox0 + 12.5, ox0 + 57.5, (1.5 - row) * 210 - 210 + 8, (1.5 - row) * 210 - 8, PIX) && same(colorAt(T.emitters, i), srgb(ownSubpixelColor(OP, sub, info.oled[sub]))), 'an OLED emitter 45 by 194 μm lit by its current');
        counts.points += 4;
      }
    }
    t.ok(same(T.lcdSwatch.material.color, srgb(P.drawnColor(P.mixXYZ(LP, middle.lcd, plan.lcdShares), LP).rgb)) && same(T.oledSwatch.material.color, srgb(P.drawnColor(P.mixXYZ(OP, middle.oled, plan.oledShares), OP).rgb)), 'the swatches the middle pixel’s mixtures');
    for (let k = 0; k < 9; k++) { const item = instanceOf(T.dataLines, k), x = (Math.floor(k / 3) - 1.5) * pitch + (k % 3) * pitch / 3 + 3; t.ok(Math.abs(item.x - x * PIX) < FLOAT32 && Math.abs(item.sx - 5 * PIX) < FLOAT32 && Math.abs(item.sy - 3 * pitchDown * PIX) < FLOAT32, 'a data line down each column'); }

    // The crystal cut open.
    const V = P.CHANNELS.map((_, c) => ownFields(now.directors[c].theta, now.directors[c].phi, gap, P.TN.wavelengths[c]));
    const rodPoints = pointsOf(T.rods), ellipsePoints = pointsOf(T.ellipses);
    t.ok(rodPoints.length === 2 * 27 && ellipsePoints.length === 2 * 3 * 5 * 24, '27 rods and 15 ellipses');
    P.CHANNELS.forEach((_, c) => {
      const s = T.slices[c], X = (c - 1) * 3.6;
      t.ok(Math.abs(s.lc.scale.y - gap * CELL) < 1e-12 && Math.abs(s.lc.position.y) < 1e-12 && Math.abs(s.lc.scale.x - 1.5 * CELL) < 1e-12 && Math.abs(s.lc.position.x - X * CELL) < 1e-12, `a column ${gap} μm tall and 1.5 μm wide`);
      t.ok(Math.abs(s.rearIto.position.y - (-gap / 2 - 0.15) * CELL) < 1e-12 && Math.abs(s.frontIto.position.y - (gap / 2 + 0.15) * CELL) < 1e-12, 'electrodes against both faces');
      t.ok(same(s.filter.material.color, srgb(ownSubpixelColor(LP, c, 1))) && s.filter.position.y > s.frontIto.position.y && s.front.position.y > s.filter.position.y && s.rear.position.y < s.rearIto.position.y, 'its filter over the front electrode, under the front polarizer, and the rear polarizer below');
      t.near(s.out.userData.length, 1.2 * Math.max(0, Math.min(1, middle.lcd[c])) * CELL, 1e-12, 'the arrow out as long as the light that leaves');
      t.ok(Math.abs(s.into.userData.length - 0.8 * CELL) < 1e-12 && s.into.position.y + s.into.userData.length <= s.rear.position.y - s.rear.scale.y / 2 + 1e-9, 'the backlight’s arrow up to the rear polarizer');
      const {theta, phi} = now.directors[c], Lr = 0.08 * gap;
      for (let k = 0; k < 9; k++) {
        const share = (k + 1) / 10, x = share * 40, i = Math.min(39, Math.floor(x)), th = theta[i] + (theta[i + 1] - theta[i]) * (x - i), ph = phi[i] + (phi[i + 1] - phi[i]) * (x - i);
        const dx = Math.cos(th) * Math.cos(ph) + 0.5 * Math.cos(th) * Math.sin(ph) * Math.cos(35 * Math.PI / 180), dy = Math.sin(th) + 0.5 * Math.cos(th) * Math.sin(ph) * Math.sin(35 * Math.PI / 180), y = -gap / 2 + share * gap;
        const [a, b] = [rodPoints[2 * (c * 9 + k)], rodPoints[2 * (c * 9 + k) + 1]];
        t.ok(Math.abs(a[0] - (X - Lr * dx) * CELL) < 1e-6 && Math.abs(a[1] - (y - Lr * dy) * CELL) < 1e-6 && Math.abs(b[0] - (X + Lr * dx) * CELL) < 1e-6 && Math.abs(b[1] - (y + Lr * dy) * CELL) < 1e-6, `rod ${k}: along the director, ${f1(deg(th))}° up and ${f1(deg(ph))}° round`);
        t.ok([a, b].every(([px, py]) => Math.abs(px / CELL - X) <= 0.75 + 1e-9 && Math.abs(py / CELL) <= gap / 2 + 1e-9), 'inside its column of crystal');
        counts.points += 2;
      }
      [0, 10, 20, 30, 40].forEach((node, k) => {
        const [ex, ey] = V[c][node], y = -gap / 2 + node / 40 * gap;
        for (let m = 0; m < 24; m++) {
          const point = mm => { const w = 2 * Math.PI * mm / 24, fx = ex[0] * Math.cos(w) - ex[1] * Math.sin(w), fy = ey[0] * Math.cos(w) - ey[1] * Math.sin(w); return [(X + 1.6 + 0.5 * (fx + 0.5 * Math.cos(35 * Math.PI / 180) * fy)) * CELL, (y + 0.5 * 0.5 * Math.sin(35 * Math.PI / 180) * fy) * CELL]; };
          const [p, q] = [ellipsePoints[2 * ((c * 5 + k) * 24 + m)], ellipsePoints[2 * ((c * 5 + k) * 24 + m) + 1]], [px, py] = point(m), [qx, qy] = point(m + 1);
          t.ok(Math.abs(p[0] - px) < 1e-6 && Math.abs(p[1] - py) < 1e-6 && Math.abs(q[0] - qx) < 1e-6 && Math.abs(q[1] - qy) < 1e-6, `the polarization at depth ${node} of ${c}, by this check’s Jones product`);
          t.ok(p[0] / CELL > X + 1.0 && p[0] / CELL < X + 3.6 - 1.0, 'beside its column, clear of the next');
          counts.points++;
        }
      });
    });
    const rest = P.restingDirector(P.TN.black), blueExit = ownFields(rest.theta, rest.phi, gap, 460e-9).at(-1);
    t.ok(blueExit[1][0] ** 2 + blueExit[1][1] ** 2 < 2e-3, 'at 5 V the light leaves the crystal polarized nearly as it came in');

    // The OLED stack and the power.
    T.stacks.forEach((stack, c) => {
      const level = plan.linear[c], ratio = level > 0 ? middle.oled[c] / level : 0, J = plan.densities[c] * ratio, Lum = plan.emitting[c] * ratio;
      t.near(stack.current.userData.length, 0.3 * Math.min(1, J / 200), 1e-12, 'the current arrow as long as the current density, full at 20 mA/cm²');
      t.near(stack.shine.userData.length, 0.14 * Math.min(1, Lum / 3000), 1e-12, 'the light arrow as long as the emitter’s luminance, full at 3,000 cd/m²');
      t.ok(Math.abs(stack.current.position.y + stack.current.userData.length - (-0.92)) < 1e-12 && Math.abs(stack.shine.position.y - (-0.80)) < 1e-12, 'current in at the anode, light out above the cathode');
      t.ok(stack.shine.position.y + stack.shine.userData.length < -0.63, 'the light arrow clear of the pixels');
    });
    t.ok(Math.abs(T.powerBars[0].scale.y - plan.backlightPower * 0.75) < 1e-12 && (plan.oledPower === 0 ? !T.powerBars[1].visible : Math.abs(T.powerBars[1].scale.y - plan.oledPower * 0.75) < 1e-12), 'power bars 0.75 units a watt: the backlight, then the OLED');
    t.near(pointsOf(T.powerBase)[2][1], -1.30 + plan.oledWhitePower * 0.75, FLOAT32, 'the tick at a white OLED screen’s power');

    // Light against voltage.
    plan.lcd.channels.forEach((ch, c) => {
      const points = pointsOf(T.curveLines[c]);
      t.ok(points.length === table.volts.length, 'a point at every step of the drive');
      for (let i = 0; i < points.length; i += 10) {
        const light = i % 20 === 0 ? ownTransmission(table.thetas[i], table.phis[i], gap, ch.wavelength) : ch.light[i];
        t.ok(Math.abs(points[i][0] - (M.CURVES.x + table.volts[i] / 5 * M.CURVES.w)) < FLOAT32 && Math.abs(points[i][1] - (M.CURVES.y + Math.max(0, Math.min(1, (light - ch.blackT) / (ch.whiteT - ch.blackT))) * 0.9 * M.CURVES.h)) < FLOAT32, `${f2(table.volts[i])} V: the share of the way from black to white`);
        counts.points++;
      }
      const mark = pointsOf(T.driveMarks[c]);
      t.ok(Math.abs((mark[0][0] + mark[1][0]) / 2 - (M.CURVES.x + plan.volts[c] / 5 * M.CURVES.w)) < FLOAT32 && Math.abs(mark[0][1] - (M.CURVES.y + ownDecode(plan.codes[c] / 255) * 0.9 * M.CURVES.h)) < 1e-5, 'the mark at the drive and the code’s share');
    });
    t.ok(Math.abs(pointsOf(T.onsetTick)[0][0] - (M.CURVES.x + table.onset / 5 * M.CURVES.w)) < FLOAT32, 'the onset tick');

    // Light through the frames.
    const start = (N43.tvbp + 135) * P.LINE, guideAt = (c, time) => (time < start ? plan.before[c] : P.seriesAt(plan.patchFlows[c].light[c], plan.patchFlows[c].sample, time - start) / plan.whites[c]);
    P.CHANNELS.forEach((_, c) => {
      const guide = pointsOf(T.guides[c]);
      t.ok(guide.length === 241, 'the whole curve faintly');
      for (let j = 0; j < 241; j += 24) {
        const time = plan.duration * j / 240;
        t.ok(Math.abs(guide[j][0] - (M.FRAMES.x + time / plan.duration * M.FRAMES.w)) < FLOAT32 && Math.abs(guide[j][1] - (M.FRAMES.y + Math.max(0, Math.min(1, guideAt(c, time))) * 0.9 * M.FRAMES.h)) < FLOAT32, 'across in time, up in light');
      }
      const line = pointsOf(T.lcdLines[c]), oled = pointsOf(T.oledLines[c]);
      if (state.clock > 0) {
        t.ok(line.length === Array.from({length: 241}, (_, j) => plan.duration * j / 240).filter(time => time < now.t).length + 1 && Math.abs(line.at(-1)[1] - (M.FRAMES.y + Math.max(0, Math.min(1, middle.lcd[c])) * 0.9 * M.FRAMES.h)) < FLOAT32, 'the LCD curve as far as the clock');
        t.ok(Math.abs(oled.at(-1)[1] - (M.FRAMES.y + middle.oled[c] * 0.9 * M.FRAMES.h)) < FLOAT32 && oled.length === (now.t < start ? 2 : 4), 'the OLED line dark until its row, then at its level');
        if (now.t >= start) t.ok(Math.abs(oled[2][0] - (M.FRAMES.x + start / plan.duration * M.FRAMES.w)) < FLOAT32 && Math.abs(oled[2][1] - (M.FRAMES.y + ownDecode(plan.codes[c] / 255) * 0.9 * M.FRAMES.h)) < FLOAT32, 'and steps up, where its row is written, to the share of full light its code asks for');
      } else t.ok(line.length === 0 && oled.length === 0, 'nothing drawn before Play');
    });
    t.ok(pointsOf(T.frameTicks).length === 2 * 11 && pointsOf(T.frameTicks).every(([x], k) => k % 2 || Math.abs(x - (M.FRAMES.x + (k / 2 + 1) * P.FRAME / plan.duration * M.FRAMES.w)) < FLOAT32), 'a tick at every frame');

    // Color.
    const corners = panel => [panel.red, panel.green, panel.blue, panel.red].map(([x, y]) => [M.COLORCHART.x + x * 0.9, M.COLORCHART.y + y * 0.9]);
    for (const [line, panel] of [[T.srgbTriangle, SR], [T.lcdTriangle, LP], [T.oledTriangle, OP]]) t.ok(pointsOf(line).every(([x, y], k) => Math.abs(x - corners(panel)[k][0]) < FLOAT32 && Math.abs(y - corners(panel)[k][1]) < FLOAT32), 'a triangle on its primaries');
    const lcdXY = plan.lcdPatchXY, markAt = (line, xy) => { const points = pointsOf(line); return xy ? Math.abs((points[0][0] + points[1][0]) / 2 - (M.COLORCHART.x + xy[0] * 0.9)) < FLOAT32 && Math.abs((points[0][1] + points[1][1]) / 2 - (M.COLORCHART.y + xy[1] * 0.9)) < FLOAT32 : points.length === 0; };
    t.ok(markAt(T.lcdMark, lcdXY) && markAt(T.oledMark, plan.oledPatchXY) && markAt(T.lcdNowMark, P.chromaticityOf(P.mixXYZ(LP, middle.lcd, plan.lcdShares))), 'the marks where the patches settle and where the LCD patch is now');
  }
}
{
  // Everything drawn faces the viewer, and no part runs into another.
  model.reset();
  model.root.updateMatrixWorld(true);
  const normal = new THREE.Vector3();
  model.root.traverse(object => {
    if (!object.isMesh || object.geometry.type !== 'PlaneGeometry') return;
    normal.set(0, 0, 1).transformDirection(object.matrixWorld);
    t.ok(normal.z > 0.99, 'a flat piece faces the viewer');
    if (object.isInstancedMesh) for (let i = 0; i < object.count; i++) { const item = instanceOf(object, i); t.ok(item.sx > 0 && item.sy > 0, 'and so does every copy of it'); }
    t.ok(object.material.isMeshBasicMaterial, 'drawn unlit');
  });
  const toSystem = new THREE.Matrix4(), local = new THREE.Box3(), matrix = new THREE.Matrix4();
  const boxOf = object => {
    const box = new THREE.Box3();
    object.traverse(child => {
      for (let node = child; node; node = node.parent) if (!node.visible) return;
      if (!child.geometry) return;
      child.geometry.computeBoundingBox();
      const n = child.isInstancedMesh ? child.count : 1;
      for (let i = 0; i < n; i++) { local.copy(child.geometry.boundingBox); if (child.isInstancedMesh) { child.getMatrixAt(i, matrix); local.applyMatrix4(matrix); } box.union(local.applyMatrix4(child.matrixWorld).applyMatrix4(toSystem)); }
    });
    return box;
  };
  for (const values of [{gap: 3}, {gap: 6, background: 1, red: 255, green: 255, blue: 255}, {red: 0, green: 0, blue: 255}]) {
    model.reset();
    model.update(values);
    model.advance(5);
    model.root.updateMatrixWorld(true);
    toSystem.copy(T.system.matrixWorld).invert();
    const boxes = ['panel', 'backlight', 'matrix', 'cell', 'subpixels', 'oled', 'curves', 'frames', 'color'].map(id => [id, boxOf(model.parts.find(item => item.id === id).object)]);
    t.ok(boxes.every(([, box]) => !box.isEmpty()), 'every part drawn');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, A] = boxes[i], [b, B] = boxes[j];
      t.ok(A.max.x + 0.02 <= B.min.x || B.max.x + 0.02 <= A.min.x || A.max.y + 0.02 <= B.min.y || B.max.y + 0.02 <= A.min.y, `the ${a} and the ${b} clear of each other at ${JSON.stringify(values)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The lessons: every number they quote is one the model computes or a source gives.
// ---------------------------------------------------------------------------

const run = values => { model.reset(); model.update(values); model.advance(1e5); return model.getState(); };
const def = P.screenPlan({}), thin = P.screenPlan({gap: 3}), whiteBack = P.screenPlan({background: 1});
checkTrialNumbers(L.lcdScreenLesson, {
  'Write the patch': s => {
    const early = P.screenAt(s, P.rowStart(135) + 1e-4).middle;
    t.ok(early.oled[0] > 0.99 && early.lcd[0] < 0.01, 'a tenth of a millisecond after its row, the OLED is lit and the LCD has not moved');
    return {10: 100 * P.PAGES.response[0], 90: 100 * P.PAGES.response[1], '52.8': s.responses[0].span * 1000, '92.0': s.responses[1].span * 1000, '12.47': s.frame * 1000, 12: s.frames, 94: 100 * s.now.patchProgress};
  },
  'Row by row': s => {
    const a = P.screenAt(s, P.rowStart(135) + P.LINE / 2).middle, b = P.screenAt(s, P.rowStart(135) + P.FRAME + P.LINE / 2).middle;
    t.ok(a.held[1] === s.volts[1] && b.held[1] === -s.volts[1], 'positive one frame, negative the next');
    return {'43.75': s.line * 1e6, 285: N43.tv, '12.47': s.frame * 1000, '2.02': s.volts[1]};
  },
  'Three columns of crystal': s => {
    const blue = P.restingDirector(s.volts[2]), exit = ownFields(blue.theta, blue.phi, s.gap, 460e-9).at(-1);
    t.ok(exit[1][0] ** 2 + exit[1][1] ** 2 < 2e-3 && s.now.middle.lcd[2] < 0.005, 'blue keeps its polarization and is blocked');
    return {'61.7': deg(s.directors[1].theta[20]), '2.02': s.volts[1], 5: s.volts[2], '88.9': deg(s.directors[2].theta[20])};
  },
  'Half the code is not half the light': s => { t.ok(s.blackLevel.every(level => level < 0.005), 'by 5 V nearly everything blocked'); return {128: s.codes[1], '21.6': 100 * s.linear[1], '2.02': s.volts[1], '1.45': s.onset, 5: P.TN.black}; },
  'A thinner cell': s => { t.ok(s.responses[0].span < def.responses[0].span && s.responses[1].span < def.responses[1].span, 'faster in a thinner layer'); return {'35.4': s.responses[0].span * 1000, 10: 100 * P.PAGES.response[0], 90: 100 * P.PAGES.response[1], '58.1': s.responses[1].span * 1000, '52.8': def.responses[0].span * 1000, '92.0': def.responses[1].span * 1000, 4: def.gap}; },
  'A white background': s => { t.ok(s.now.bands[0].back.every(level => level > 0.9) && s.backlightPower === def.backlightPower, 'the background lightens and the backlight stays the same'); return {'1.02': s.backlightPower, 802: s.oledPower * 1000, 43: def.oledPower * 1000}; },
  'Black is not black': s => { t.ok(s.volts.every(volts => volts === 5), 'every subpixel at 5 V'); return {5: P.TN.black, '0.40': 100 * s.blackLevel[1], 248: s.lcdContrast, 1: 1, 500: N43.contrast[1]}; },
}, run, t);
checkTrialNumbers(L.rgbSubpixelsLesson, {
  'Orange from three stripes': s => ({255: s.codes[0], 128: s.codes[1], 0: s.codes[2], 100: 100 * s.linear[0], '21.6': 100 * s.linear[1], '0.486': s.lcdPatchXY[0], '0.430': s.lcdPatchXY[1], 327: s.lcdPatchLuminance, '1,000': N43.luminance[1]}),
  'Half the light': s => ({188: s.codes[1], '50.3': 100 * s.linear[1], 128: P.SCREEN_DEFAULTS.green, '21.6': 100 * def.linear[1], '0.434': s.lcdPatchXY[0], '0.483': s.lcdPatchXY[1]}),
  'Full green': s => {
    const W = N43.white, dist = xy => Math.hypot(xy[0] - W[0], xy[1] - W[1]);
    t.ok(dist(s.lcdPatchXY) < dist(N43.green) && f3(N43.green[0]) === f3(s.lcdPatchXY[0]), 'pulled toward white by the dark stripes’ leak');
    return {'0.310': s.lcdPatchXY[0], '0.610': s.lcdPatchXY[1], '0.613': N43.green[1]};
  },
  'Yellow': s => {
    const [A, B, p] = [N43.red, N43.green, s.lcdPatchXY], off = Math.abs((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) / Math.hypot(B[0] - A[0], B[1] - A[1]);
    t.ok(off > 0 && off < 0.01, 'just off the red and green line, by blue’s leak');
    return {'0.393': s.lcdPatchXY[0], '0.527': s.lcdPatchXY[1]};
  },
  'White': s => { const shares = ownShares(LP); t.ok(Math.abs(s.lcdPatchXY[0] - N43.white[0]) < 1e-9 && Math.abs(s.lcdPatchXY[1] - N43.white[1]) < 1e-9, 'the datasheet’s white'); return {'0.273': s.lcdPatchXY[0], '0.321': s.lcdPatchXY[1], '0.3127': SR.white[0], '0.3290': SR.white[1], '67.7': 100 * shares[1], '17.8': 100 * shares[0], '14.5': 100 * shares[2]}; },
  'Too small to see apart': s => ({480: N43.columns, 272: N43.rows, '95.04': N43.active[0], '53.86': N43.active[1], 198: s.lcdPitch * 1000, 66: s.lcdPitch * 1000 / 3, 300: P.SCREEN.viewing, '0.76': s.arcSubpixel, 1: SRC.pages.acuity, '2.27': s.arcPixel}),
}, run, t);
checkTrialNumbers(L.oledDisplayLesson, {
  'Currents for orange': s => { t.ok(s.currents[2] === 0 && s.now.middle.oled[2] === 0, 'blue dark'); return {'1,000': N43.luminance[1], 255: s.codes[0], 128: s.codes[1], 0: s.codes[2], 351: s.currents[0] * 1e9, 59: s.currents[1] * 1e9, 210: SRC.nhd15.pitch * 1000, '4.02': s.densities[0] / 10, '0.68': s.densities[1] / 10}; },
  'Lit at once': s => { t.ok(100 * P.PAGES.response[0] === 10 && SRC.nhd15.rise * 1e-6 < s.line, 'a 10 μs rise inside a row'); return {10: SRC.nhd15.rise, '43.75': s.line * 1e6, '52.8': s.responses[0].span * 1000, 90: 100 * P.PAGES.response[1]}; },
  'A white background': s => ({802: s.oledPower * 1000, 43: def.oledPower * 1000, '1.02': s.backlightPower}),
  'Blue costs the most': s => { t.ok(s.densities[2] / 10 > SRC.idemitsu.density, 'more than the test current'); return {'1,625': s.currents[2] * 1e9, '18.61': s.densities[2] / 10, 10: SRC.idemitsu.density, '6.5': SRC.idemitsu.blue[2], 85: SRC.udc.green[2], 169: s.oledPower * 1000}; },
  'A white screen': s => { const shares = ownShares(OP), split = shares.map((share, c) => share / [29, 85, 6.5][c]); t.ok(split[2] / split.reduce((a, b) => a + b, 0) > 0.5, 'most of it to blue'); return {993: s.oledPower * 1000, '1.02': s.backlightPower}; },
  'A deeper orange': s => { const W = N15.white, dist = xy => Math.hypot(xy[0] - W[0], xy[1] - W[1]); t.ok(dist(s.oledPatchXY) > Math.hypot(s.lcdPatchXY[0] - N43.white[0], s.lcdPatchXY[1] - N43.white[1]), 'further from its white'); return {'0.64': N15.red[0], '0.34': N15.red[1], '0.573': N43.red[0], '0.347': N43.red[1], '0.570': s.oledPatchXY[0], '0.400': s.oledPatchXY[1], '0.486': s.lcdPatchXY[0], '0.430': s.lcdPatchXY[1]}; },
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
const mixName = P.M1.name.split(' ').at(-1);
const limitSnippets = {
  [`a pretilt of ${f0(deg(P.TN.pretilt))}°`]: 'a pretilt of 2°',
  [`solved in ${P.TN.layers} layers`]: 'solved in 40 layers',
  [`one wavelength, ${P.TN.wavelengths.map(w => f0(w * 1e9)).join(', ').replace(/, (?=[^,]*$)/, ' and ')} nm`]: 'one wavelength, 630, 550 and 460 nm',
  [`a drive of 0 to ${f0(P.TN.black)} V, black at ${f0(P.TN.black)} V`]: 'a drive of 0 to 5 V, black at 5 V',
  [`Merck’s mixture ${mixName}`]: 'Merck’s mixture M-1',
  [`a patch of ${P.SCREEN.patchColumns[1] - P.SCREEN.patchColumns[0]} by ${P.SCREEN.patchRows[1] - P.SCREEN.patchRows[0]} pixels`]: 'a patch of 240 by 128 pixels',
  [`for ${P.SCREEN.frames} frames`]: 'for 12 frames',
  [`each dropping ${f1(P.SCREEN.oledVoltage)} V`]: 'each dropping 3.8 V',
};
covered(L.screenLimits, limitSnippets, 'screen limits');

// LCD screen.
expectNone(L.lcdScreenLesson, 'LCD screen');
{
  const D = L.lcdScreenLesson.deeper, u4 = 2 * SRC.m1.deltaN * 4e-6 / 550e-9, rest0 = P.restingDirector(0), passes = 2 * P.cellTransmission(rest0.theta, rest0.phi, 4, 550e-9, [1, 0]);
  covered(D[0].body, {[`typically ${SRC.pages.gap} μm thick`]: 'typically 4 μm thick', [`twisted ${SRC.pages.twist}°`]: 'twisted 90°', [`For ${mixName}, with a birefringence of ${SRC.m1.deltaN}, a ${SRC.pages.gap} μm layer gives 2Δnd/λ = ${f2(u4)} at ${550} nm`]: 'For M-1, with a birefringence of 0.1147, a 4 μm layer gives 2Δnd/λ = 1.67 at 550 nm', 'the √3 at which': 'the √3 at which', [`passes ${f1(100 * passes)}% of what`]: 'passes 99.8% of what'}, 'LCD deeper 1');
  covered(D[1].body, {[`constants, ${f1(SRC.m1.k11)}, ${f1(SRC.m1.k22)} and ${f1(SRC.m1.k33)} pN for ${mixName}`]: 'constants, 12.0, 6.5 and 14.0 pN for M-1', [`anisotropy of ${f1(SRC.m1.deltaEps)}`]: 'anisotropy of 6.5', [`π√((K11 + (K33 − 2K22)/4)/(ε0Δε)) = ${f2(VTH)} V`]: 'π√((K11 + (K33 − 2K22)/4)/(ε0Δε)) = 1.45 V', [`threshold is ${f2(SRC.m1.v0)} V, against ${f2(VSPLAY)} V`]: 'threshold is 1.42 V, against 1.43 V'}, 'LCD deeper 2');
  covered(D[2].body, {[`runs at ${N43.clock} MHz and every row takes ${N43.th} of its ticks, ${N43.thdisp} for`]: 'runs at 12 MHz and every row takes 525 of its ticks, 480 for', [`open for ${f2(P.LINE * 1e6)} μs`]: 'open for 43.75 μs', [`Frames of ${N43.tv} rows, ${N43.tvdisp} of them visible, come ${f1(1 / P.FRAME)} times`]: 'Frames of 285 rows, 272 of them visible, come 80.2 times'}, 'LCD deeper 3');
  covered(D[3].body, {[`as small as ${SRC.pages.dc} mV`]: 'as small as 50 mV'}, 'LCD deeper 4');
  const opt = P.opticsTable(4), tauK11 = SRC.m1.gamma1 / 1000 * 16e-12 / (SRC.m1.k11 * 1e-12 * Math.PI ** 2);
  covered(D[4].body, {'τoff = γ1d²/(kπ²)': 'τoff = γ1d²/(kπ²)', [`${mixName}’s rotational viscosity of ${SRC.m1.gamma1} mPa·s gives ${f1(tauK11 * 1000)} ms at ${SRC.pages.gap} μm`]: 'M-1’s rotational viscosity of 342 mPa·s gives 46.2 ms at 4 μm', [`takes ${f1(opt.toWhite.span * 1000)} ms from ${SRC.pages.response[0]}% to ${SRC.pages.response[1]}%`]: 'takes 44.4 ms from 10% to 90%', [`takes ${f1(opt.switching * 1000)} ms here, against the module’s ${N43.response[0]} ms`]: 'takes 51.3 ms here, against the module’s 20 ms'}, 'LCD deeper 5');
  covered(D[5].body, {[`about ${SRC.pages.polaroid}% of unpolarized light and an extinction ratio of about 1:${SRC.pages.extinction}`]: 'about 38% of unpolarized light and an extinction ratio of about 1:500', '(k1² + k2²)/2': '(k1² + k2²)/2', [`a contrast of ${f0((k1 * k1 + k2 * k2) / (2 * k1 * k2))}:1 at best`]: 'a contrast of 250:1 at best', [`standing at ${f0(P.TN.black)} V this cell reaches ${f0(def.lcdContrast)}:1`]: 'standing at 5 V this cell reaches 248:1', [`gives ${N43.contrast[1]}:1`]: 'gives 500:1'}, 'LCD deeper 6');
  covered(L.lcdScreenLesson.limits, {[`its pixels ${f0(M.timesLarger(PIX))} times larger and the liquid crystal ${f0(M.timesLarger(CELL))} times larger`]: 'its pixels 200 times larger and the liquid crystal 15,000 times larger', [`${P.SCREEN.slow} times slower`]: '100 times slower', ...limitSnippets}, 'LCD limits');
  covered(L.lcdScreenLesson.quiz.explanation, {[`At ${f0(P.TN.black)} V the crystal stands ${f1(deg(table.middles.at(-1)))}° up`]: 'At 5 V the crystal stands 88.9° up', [`only ${f2(100 * def.blackLevel[1])}% of white`]: 'only 0.40% of white'}, 'LCD quiz');
}

// RGB subpixels.
expectNone(L.rgbSubpixelsLesson, 'RGB subpixels');
{
  const D = L.rgbSubpixelsLesson.deeper, shares = ownShares(LP), pair = xy => `${xy[0].toFixed(3)}, ${xy[1].toFixed(3)}`;
  covered(D[0].body, {'a code C from 0 to 1 as C/12.92 up to 0.04045 and ((C + 0.055)/1.055)^2.4': `a code C from 0 to 1 as C/${SR.slope} up to ${SR.threshold} and ((C + ${SR.offset})/${SR.scale})^${SR.exponent}`, [`Code 128 of 255 is ${f3(128 / 255)} of the range and gives ${f1(100 * ownDecode(128 / 255))}% of full light`]: 'Code 128 of 255 is 0.502 of the range and gives 21.6% of full light', [`about ${SRC.pages.srgbHalf}% for half intensity on a 2.2 gamma display`]: 'about 22% for half intensity on a 2.2 gamma display', [`Code 188 gives ${f1(100 * ownDecode(188 / 255))}%`]: 'Code 188 gives 50.3%'}, 'RGB deeper 1');
  covered(D[1].body, {'CIE 1931': 'CIE 1931', [`green carries ${f1(100 * shares[1])}% of the luminance, red ${f1(100 * shares[0])}% and blue ${f1(100 * shares[2])}%`]: 'green carries 67.7% of the luminance, red 17.8% and blue 14.5%'}, 'RGB deeper 2');
  covered(D[2].body, {[`red at x ${f3(N43.red[0])}, y ${f3(N43.red[1])}, green at ${pair(N43.green)} and blue at ${pair(N43.blue)}`]: 'red at x 0.573, y 0.347, green at 0.310, 0.613 and blue at 0.143, 0.097', [`red at ${f2(N15.red[0])}, ${f2(N15.red[1])}, green at ${f2(N15.green[0])}, ${f2(N15.green[1])} and blue at ${f2(N15.blue[0])}, ${f2(N15.blue[1])}`]: 'red at 0.64, 0.34, green at 0.31, 0.62 and blue at 0.14, 0.16'}, 'RGB deeper 3');
  covered(D[3].body, {}, 'RGB deeper 4');
  const plan = def;
  covered(D[4].body, {[`a gap of ${SRC.pages.acuity} arc minute`]: 'a gap of 1 arc minute', [`From ${P.SCREEN.viewing} mm, ${f0(plan.lcdPitch * 1000 / 3)} μm spans ${f2(plan.arcSubpixel)} arc minutes and ${f0(plan.lcdPitch * 1000)} μm spans ${f2(plan.arcPixel)}`]: 'From 300 mm, 66 μm spans 0.76 arc minutes and 198 μm spans 2.27', [`${f0(N15.pitch * 1000)} μm apart, span ${f2(plan.arcOledPixel)} arc minutes`]: '210 μm apart, span 2.41 arc minutes'}, 'RGB deeper 5');
  covered(D[5].body, {[`drawn ${M.MATRIXVIEW.border} μm wide`]: 'drawn 8 μm wide'}, 'RGB deeper 6');
  covered(L.rgbSubpixelsLesson.limits, {[`drawn ${f0(M.timesLarger(PIX))} times larger`]: 'drawn 200 times larger', [`a black matrix ${M.SUBPIXVIEW.border} μm wide`]: 'a black matrix 8 μm wide', ...limitSnippets}, 'RGB limits');
  covered(L.rgbSubpixelsLesson.quiz.explanation, {[`From ${P.SCREEN.viewing} mm a subpixel ${f0(plan.lcdPitch * 1000 / 3)} μm wide spans ${f2(plan.arcSubpixel)} arc minutes, finer than the ${SRC.pages.acuity} arc minute`]: 'From 300 mm a subpixel 66 μm wide spans 0.76 arc minutes, finer than the 1 arc minute'}, 'RGB quiz');
}

// OLED display.
expectNone(L.oledDisplayLesson, 'OLED display');
{
  const D = L.oledDisplayLesson.deeper, whiteScreen = P.screenPlan({red: 255, green: 255, blue: 255, background: 1});
  covered(D[0].body, {[`red emitter ${SRC.udc.red[2]} cd/A at x ${f2(SRC.udc.red[0])}, y ${f2(SRC.udc.red[1])} and its green ${SRC.udc.green[2]} cd/A at ${f2(SRC.udc.green[0])}, ${f2(SRC.udc.green[1])}`]: 'red emitter 29 cd/A at x 0.66, y 0.34 and its green 85 cd/A at 0.31, 0.63', [`at x ${f3(SRC.idemitsu.blue[0])}, y ${f3(SRC.idemitsu.blue[1])} of ${f1(SRC.idemitsu.blue[2])} cd/A at ${f1(SRC.idemitsu.voltage)} V and ${SRC.idemitsu.density} mA/cm², an external quantum efficiency of ${f1(SRC.idemitsu.eqe)}%`]: 'at x 0.143, y 0.078 of 6.5 cd/A at 3.8 V and 10 mA/cm², an external quantum efficiency of 8.6%'}, 'OLED deeper 1');
  covered(D[1].body, {[`singlets ${SRC.pages.singlet}% of the time and triplets ${SRC.pages.triplet}%`]: 'singlets 25% of the time and triplets 75%', [`Kosan’s ${2022} blue reached an external quantum efficiency of ${SRC.idemitsu.eqe2022}%`]: 'Kosan’s 2022 blue reached an external quantum efficiency of 14%'}, 'OLED deeper 2');
  covered(D[2].body, {[`The ${N15.name} module`]: 'The NHD-1.5-128128UGC3 module'}, 'OLED deeper 3');
  covered(D[3].body, {[`display ${SRC.pages.amoled[0]} W for white text on black and more than ${SRC.pages.amoled[1]} W`]: 'display 0.3 W for white text on black and more than 0.7 W', [`a constant ${SRC.pages.amoled[2]} W`]: 'a constant 0.35 W', [`on black takes ${f0(def.oledPower * 1000)} mW, on white ${f0(whiteBack.oledPower * 1000)} mW, and a white screen ${f0(whiteScreen.oledPower * 1000)} mW`]: 'on black takes 43 mW, on white 802 mW, and a white screen 993 mW', [`takes ${f2(def.backlightPower)} W`]: 'takes 1.02 W'}, 'OLED deeper 4');
  covered(D[4].body, {[`above ${f0(N15.contrast)}:1 and a rise and a fall of ${N15.rise} μs each`]: 'above 10,000:1 and a rise and a fall of 10 μs each', [`under ${SRC.pages.lg} μs`]: 'under 10 μs', [`gives ${N43.contrast[1]}:1, and ${N43.response[0]} ms`]: 'gives 500:1, and 20 ms'}, 'OLED deeper 5');
  covered(D[5].body, {[`pixels ${f2(N15.pitch)} mm apart with subpixels ${f3(N15.subpixel[0])} by ${f3(N15.subpixel[1])} mm`]: 'pixels 0.21 mm apart with subpixels 0.045 by 0.194 mm', [`cover ${f1(100 * def.aperture)}%`]: 'cover 59.4%', [`Its ${N15.columns} pixels of ${f2(N15.pitch)} mm, less one gap of ${f3(N15.gaps[0])} mm, make its active area of ${f3(N15.active[0])} mm`]: 'Its 128 pixels of 0.21 mm, less one gap of 0.025 mm, make its active area of 26.855 mm'}, 'OLED deeper 6');
  covered(L.oledDisplayLesson.limits, {[`drawn ${f0(M.timesLarger(PIX))} times larger`]: 'drawn 200 times larger', ...limitSnippets}, 'OLED limits');
  covered(L.oledDisplayLesson.quiz.explanation, {[`takes ${f0(def.oledPower * 1000)} mW`]: 'takes 43 mW', [`on white ${f0(whiteBack.oledPower * 1000)} mW`]: 'on white 802 mW', [`takes ${f2(def.backlightPower)} W`]: 'takes 1.02 W'}, 'OLED quiz');
}

// The model’s own words: its scales and slowed clock, said where the reader sees them.
const partText = id => model.parts.find(item => item.id === id).description;
covered(partText('system'), {[`An ${N43.name} LCD module`]: 'An NHD-4.3-480272EF-ASXN LCD module', [`three of its pixels ${f0(M.timesLarger(PIX))} times larger`]: 'three of its pixels 200 times larger', [`cut open ${f0(M.timesLarger(CELL))} times larger`]: 'cut open 15,000 times larger', [`pixels ${f0(M.timesLarger(PIX))} times larger, and charts`]: 'pixels 200 times larger, and charts', [`${P.SCREEN.slow} times slower`]: '100 times slower'}, 'system text');
covered(partText('panel'), {[`The ${N43.name} module drawn at true size: ${N43.columns} by ${N43.rows} pixels on an active area ${f2(aw)} by ${f2(ah)} mm`]: 'The NHD-4.3-480272EF-ASXN module drawn at true size: 480 by 272 pixels on an active area 95.04 by 53.86 mm'}, 'panel text');
covered(partText('backlight'), {[`${f0(N43.polarizer[0])} by ${f1(N43.polarizer[1])} mm, with ${N43.led.strings * N43.led.perString} white LEDs along one edge in two strings of ${N43.led.perString}`]: '98 by 56.2 mm, with 16 white LEDs along one edge in two strings of 8', [`take ${N43.led.current[0]} mA at ${f1(N43.led.voltage[1])} V`]: 'take 40 mA at 25.6 V'}, 'backlight text');
covered(partText('matrix'), {[`drawn ${f0(M.timesLarger(PIX))} times larger, ${f0(pitch)} μm apart`]: 'drawn 200 times larger, 198 μm apart', [`full at ${f0(P.TN.black)} V`]: 'full at 5 V'}, 'matrix text');
covered(partText('cell'), {[`cut open ${f0(M.timesLarger(CELL))} times larger, each a slice ${f1(M.CELLVIEW.slice)} μm wide`]: 'cut open 15,000 times larger, each a slice 1.5 μm wide', [`at ${M.CELLVIEW.rods} depths, each drawn ${f0(100 * M.CELLVIEW.rodShare)}% of the gap long`]: 'at 9 depths, each drawn 8% of the gap long', [`at ${M.CELLVIEW.depths.length} depths`]: 'at 5 depths'}, 'cell text');
covered(partText('subpixels'), {[`drawn as light, ${f0(M.timesLarger(PIX))} times larger`]: 'drawn as light, 200 times larger', [`drawn ${M.MATRIXVIEW.border} μm wide`]: 'drawn 8 μm wide', [`from ${P.SCREEN.viewing} mm`]: 'from 300 mm', [`less than the ${SRC.pages.acuity} arc minute`]: 'less than the 1 arc minute'}, 'subpixels text');
covered(partText('oled'), {[`of the ${N15.name} OLED module drawn ${f0(M.timesLarger(PIX))} times larger, ${f0(N15.pitch * 1000)} μm apart with subpixels ${f0(N15.subpixel[0] * 1000)} by ${f0(N15.subpixel[1] * 1000)} μm`]: 'of the NHD-1.5-128128UGC3 OLED module drawn 200 times larger, 210 μm apart with subpixels 45 by 194 μm', [`(full arrow ${f0(M.OLEDVIEW.currentScale / 10)} mA/cm²)`]: '(full arrow 20 mA/cm²)', [`(full arrow ${f0(M.OLEDVIEW.lightScale)} cd/m²)`]: '(full arrow 3,000 cd/m²)'}, 'oled text');
covered(partText('curves'), {[`from 0 to ${f0(P.TN.black)} V`]: 'from 0 to 5 V'}, 'curves text');
covered(partText('frames'), {[`through ${P.SCREEN.frames} frames`]: 'through 12 frames'}, 'frames text');
covered(partText('color'), {[`from 0 to ${f1(M.COLORCHART.xMax)} across and 0 to ${f1(M.COLORCHART.yMax)} up`]: 'from 0 to 0.8 across and 0 to 0.9 up'}, 'color text');
for (const control of model.controls) {
  const [lo, hi] = P.SCREEN_DOMAINS[control.key];
  covered(control.help, control.key === 'gap' ? {[`gives ${SRC.pages.gap} μm as typical`]: 'gives 4 μm as typical'} : ['red', 'green', 'blue'].includes(control.key) ? {[`${lo} to ${hi}`]: '0 to 255'} : {}, `${control.key} help`);
}
covered(model.playback.description, {[`for ${P.SCREEN.frames} frames, ${P.SCREEN.slow} times slower`]: 'for 12 frames, 100 times slower'}, 'playback');
{
  model.reset();
  const readings = model.getState().readings, find = label => readings.find(item => item.label === label), codes = [255, 128, 0].join(', ');
  t.ok(readings.map(item => item.label).join() === 'Your result,Patch light,Drive,Crystal,Contrast,Response,Row time,Backlight,OLED power,Color,Subpixels,Slowed' && readings.filter(item => item.hint).length === 11, 'twelve readings, eleven explained');
  const opt = P.opticsTable(4), rest = P.restingDirector(def.volts[1]);
  covered(find('Your result').value, {[`held at ${f0(P.TN.black)} V`]: 'held at 5 V', [`the patch ${codes}`]: 'the patch 255, 128, 0'}, 'status');
  covered(find('Patch light').value, {[`R ${f1(100 * def.settled[0])}%, G ${f1(100 * def.settled[1])}%, B ${f1(100 * def.settled[2])}%`]: 'R 100.0%, G 21.9%, B 0.4%'}, 'patch light');
  covered(find('Patch light').hint, {[`the codes ${codes} into ${f1(100 * ownDecode(1))}%, ${f1(100 * ownDecode(128 / 255))}% and ${f1(0)}%`]: 'the codes 255, 128, 0 into 100.0%, 21.6% and 0.0%', [`its black, ${f2(100 * def.blackLevel[1])}% of white`]: 'its black, 0.40% of white'}, 'patch light hint');
  covered(find('Drive').value, {[`R ${f2(def.volts[0])} V, G ${f2(def.volts[1])} V, B ${f2(def.volts[2])} V`]: 'R 0.00 V, G 2.02 V, B 5.00 V'}, 'drive');
  covered(find('Drive').hint, {[`starts to tilt at ${f2(table.onset)} V; black is ${f0(P.TN.black)} V`]: 'starts to tilt at 1.45 V; black is 5 V'}, 'drive hint');
  covered(find('Crystal').value, {[`tilts ${f1(deg(table.middles.at(-1)))}°`]: 'tilts 88.9°'}, 'crystal');
  covered(find('Crystal').hint, {[`in a ${f1(SRC.pages.gap)} μm layer of Merck’s mixture ${mixName}, twisted ${SRC.pages.twist}° from plate to plate with a ${f0(deg(P.TN.pretilt))}° pretilt`]: 'in a 4.0 μm layer of Merck’s mixture M-1, twisted 90° from plate to plate with a 2° pretilt', [`settles at ${f1(deg(rest.theta[20]))}°`]: 'settles at 61.7°'}, 'crystal hint');
  covered(find('Contrast').value, {[`${f0(def.lcdContrast)}:1`]: '248:1'}, 'contrast');
  covered(find('Contrast').hint, {[`each passing ${SRC.pages.polaroid}% with an extinction ratio of 1:${SRC.pages.extinction}, leak ${f2(100 * def.blackLevel[1])}% of white`]: 'each passing 38% with an extinction ratio of 1:500, leak 0.40% of white', [`reaches ${f0(def.lcdContrast)}:1`]: 'reaches 248:1', [`gives ${N43.contrast[1]}:1`]: 'gives 500:1'}, 'contrast hint');
  covered(find('Response').value, {[`red ${f1(def.responses[0].span * 1000)} ms, green ${f1(def.responses[1].span * 1000)} ms`]: 'red 52.8 ms, green 92.0 ms'}, 'response');
  covered(find('Response').hint, {[`${SRC.pages.response[0]}% to ${SRC.pages.response[1]}%`]: '10% to 90%', [`takes ${f1(opt.toBlack.span * 1000)} ms to black and ${f1(opt.toWhite.span * 1000)} ms back, ${f1(opt.switching * 1000)} ms together`]: 'takes 6.9 ms to black and 44.4 ms back, 51.3 ms together', [`datasheet’s ${N43.response[0]} ms: ${mixName}`]: 'datasheet’s 20 ms: M-1', [`rises in ${N15.rise} μs`]: 'rises in 10 μs'}, 'response hint');
  covered(find('Row time').value, {[`${f2(P.LINE * 1e6)} μs`]: '43.75 μs'}, 'row time');
  covered(find('Row time').hint, {[`runs at ${N43.clock} MHz and a row takes ${N43.th} clock ticks, so each row of transistors is open for ${f2(P.LINE * 1e6)} μs, ${f1(P.LINE / (N43.settle * 1e-6))} times the ${N43.settle} μs`]: 'runs at 12 MHz and a row takes 525 clock ticks, so each row of transistors is open for 43.75 μs, 3.6 times the 12 μs', [`${N43.tv} rows make a frame of ${f2(P.FRAME * 1000)} ms, ${f1(1 / P.FRAME)} frames a second`]: '285 rows make a frame of 12.47 ms, 80.2 frames a second', [`as small as ${SRC.pages.dc} mV`]: 'as small as 50 mV'}, 'row time hint');
  covered(find('Backlight').value, {[`${f2(def.backlightPower)} W`]: '1.02 W'}, 'backlight');
  covered(find('Backlight').hint, {[`${N43.led.strings * N43.led.perString} white LEDs take ${N43.led.current[0]} mA at ${f1(N43.led.voltage[1])} V to light the ${f0(N43.luminance[1])} cd/m² white`]: '16 white LEDs take 40 mA at 25.6 V to light the 1,000 cd/m² white'}, 'backlight hint');
  covered(find('OLED power').value, {[`${f0(def.oledPower * 1000)} mW`]: '43 mW'}, 'oled power');
  covered(find('OLED power').hint, {[`at ${SRC.udc.red[2]}, ${SRC.udc.green[2]} and ${f1(SRC.idemitsu.blue[2])} cd/A and dropping ${f1(SRC.idemitsu.voltage)} V: ${f0(def.currents[0] * 1e9)}, ${f0(def.currents[1] * 1e9)} and ${f0(def.currents[2] * 1e9)} nA in a pixel ${f0(N15.pitch * 1000)} μm across`]: 'at 29, 85 and 6.5 cd/A and dropping 3.8 V: 351, 59 and 0 nA in a pixel 210 μm across', [`would take ${f0(def.oledWhitePower * 1000)} mW`]: 'would take 993 mW'}, 'oled power hint');
  covered(find('Color').value, {[`x ${f3(def.lcdPatchXY[0])}, y ${f3(def.lcdPatchXY[1])}`]: 'x 0.486, y 0.430'}, 'color');
  covered(find('Color').hint, {[`at x ${f3(def.lcdPatchXY[0])}, y ${f3(def.lcdPatchXY[1])} and ${f0(def.lcdPatchLuminance)} cd/m²`]: 'at x 0.486, y 0.430 and 327 cd/m²', [`at x ${f3(def.oledPatchXY[0])}, y ${f3(def.oledPatchXY[1])} and ${f0(def.oledPatchLuminance)} cd/m²`]: 'at x 0.570, y 0.400 and 345 cd/m²'}, 'color hint');
  covered(find('Subpixels').value, {[`${f0(pitch / 3)} μm`]: '66 μm'}, 'subpixels');
  covered(find('Subpixels').hint, {[`${N43.columns} by ${N43.rows} pixels over ${f2(aw)} by ${f2(ah)} mm put pixels ${f0(pitch)} μm apart`]: '480 by 272 pixels over 95.04 by 53.86 mm put pixels 198 μm apart', [`From ${P.SCREEN.viewing} mm a subpixel spans ${f2(def.arcSubpixel)} arc minutes, under the ${SRC.pages.acuity} arc minute`]: 'From 300 mm a subpixel spans 0.76 arc minutes, under the 1 arc minute', [`a whole pixel spans ${f2(def.arcPixel)}`]: 'a whole pixel spans 2.27', [`Drawn ${f0(M.timesLarger(PIX))} times larger`]: 'Drawn 200 times larger'}, 'subpixels hint');
  covered(find('Slowed').value, {[`${P.SCREEN.slow} times`]: '100 times'}, 'slowed');
  covered(find('Slowed').hint, {[`${P.SCREEN.slow} times slower`]: '100 times slower', [`${P.SCREEN.frames} frames of ${f1(def.duration * 1000)} ms take ${f1(def.duration * P.SCREEN.slow)} s`]: '12 frames of 149.6 ms take 15.0 s', [`crystal ${f0(M.timesLarger(CELL))} times larger`]: 'crystal 15,000 times larger'}, 'slowed hint');
  model.advance(4.2);
  const playing = model.getState(), status = playing.readings[0].value, now = playing.now;
  covered(status, {[`Frame ${now.frame + 1} of ${P.SCREEN.frames}`]: `Frame 4 of 12`, [`writing row ${now.scanRow + 1} of ${N43.rows}`]: 'writing row 94 of 272', [`${f0(100 * now.patchProgress)}%`]: '17%'}, 'status while writing');
  model.advance(1e5);
  covered(model.getState().readings[0].value, {[`after ${P.SCREEN.frames} frames`]: 'after 12 frames', [`${f0(100 * model.getState().now.patchProgress)}%`]: '94%', [`within ${N15.rise} μs`]: 'within 10 μs'}, 'status when written');
  model.update({red: 0, green: 0, blue: 0});
  const dark = model.getState().readings, darkFind = label => dark.find(item => item.label === label);
  t.ok(darkFind('Color').value === 'x 0.275, y 0.321' && darkFind('Color').hint.includes('the OLED patch at no light') && darkFind('OLED power').value === '0 mW' && darkFind('Response').value === 'red stays, green stays, blue stays', 'a black patch: the LCD’s leak for a color, the OLED dark and drawing nothing, and nothing to switch');
}

for (const lesson of [L.lcdScreenLesson, L.rgbSubpixelsLesson, L.oledDisplayLesson]) {
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${lesson.simple}: a quiz with its answer first`);
  t.ok(lesson.simple.endsWith('?') && lesson.steps.length === 5 && lesson.tryIt.length >= 6 && lesson.tryIt.length <= 7 && lesson.deeper.length >= 5 && lesson.deeper.length <= 6 && lesson.parts.length >= 4, `${lesson.simple}: a question, 5 steps, 6 or 7 trials, 5 or 6 deeper sections`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `no dashes as punctuation: ${text.slice(0, 60)}`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|polarise|polarising|aluminium)\b/i.test(text), `American spelling: ${text.slice(0, 60)}`);
  t.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, 'every source a link, none twice');
  t.ok(lesson.tryIt.every(trial => model.parts.some(item => item.id === trial.part) && trial.view === 'front' && trial.reset === true && trial.isolate === false), 'every trial on a part the model has');
  t.ok(lesson.parts.every(item => model.parts.some(part => part.name === item.name)), 'every part the lesson names is one the model draws');
}

// ---------------------------------------------------------------------------
// 4. What every model owes the viewer.
// ---------------------------------------------------------------------------

for (const control of model.controls) { const [lo, hi, step] = P.SCREEN_DOMAINS[control.key]; t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === P.SCREEN_DEFAULTS[control.key], `${control.key}: the control spans its domain from its default`); }
t.ok(model.controls.map(control => control.key).join() === 'red,green,blue,background,gap' && model.controls.find(control => control.key === 'background').options === P.BACKGROUND_OPTIONS, 'five controls, the background a choice');
const drawing = () => [Array.from(T.bands.instanceColor.array.slice(0, 102 * 3)), T.slices[1].lc.scale.y, pointsOf(T.rods).slice(0, 18), Array.from(T.windows.instanceColor.array.slice(0, 27)), Array.from(T.emitters.instanceColor.array.slice(0, 27)), T.powerBars[1].scale.y, T.lcdSwatch.material.color.getHex(), pointsOf(T.lcdMark)];
checkControlsMove(model, drawing, m => m.advance(3), t);
checkRefusals(P.sampleScreen, P.SCREEN_DOMAINS, t);
model.reset();
checkFinite(model.root, t);
t.ok(!model.playback.complete() && !model.resultPart.available() && model.resultPart.id === 'frames', 'nothing to inspect before writing');
{
  const before = JSON.stringify(model.getState().readings);
  model.playback.step();
  t.near(model.getState().clock, 0.005, 1e-12, 'a step of half a second writes 5 ms');
  t.ok(!model.playback.complete() && !model.resultPart.available(), 'no result partway through');
  t.ok(JSON.stringify(model.getState().readings) !== before, 'a step changes the readings');
  model.animate(0);
  model.animate(0.5);
  t.near(model.getState().clock, 0.01, 1e-12, 'animation writes on by the time that passed, 100 times slower');
  model.advance(1e4);
  t.ok(model.playback.complete() && model.resultPart.available() && model.playback.blocked() === false, 'written, with a result to inspect');
  const held = JSON.stringify(model.getState().readings);
  model.advance(50);
  t.ok(JSON.stringify(model.getState().readings) === held, 'the clock stops at the end of the playback');
  checkFinite(model.root, t);
  const expectClock = {'Inspect: the screen being written': P.rowStart(200), 'Inspect: a row of capacitors written': P.FRAME + P.rowStart(135) + P.LINE / 2, 'Inspect: the crystal turning': 3 * P.FRAME, 'Inspect: RGB subpixels': def.duration, 'Inspect: OLED subpixels': def.duration};
  t.ok(model.actions.map(action => action.part).join() === 'panel,matrix,cell,subpixels,oled' && model.actions.every(action => action.view === 'front' && action.replay === false), 'five inspections, each on its part');
  for (const action of model.actions) {
    const readings = action.run();
    t.ok(Array.isArray(readings) && readings.length === 12, `${action.label} returns readings`);
    t.near(model.getState().clock, expectClock[action.label], 1e-15, `${action.label} at its moment`);
    checkFinite(model.root, t);
  }
  model.actions[1].run();
  t.ok(model.getState().now.scanRow === 135 && T.gateLines[1].material.color.getHex() === M.COLORS.scan && model.getState().now.rows[1].polarity === -1, 'the capacitors’ inspection catches row 135 being written again, its polarity flipped');
  t.ok(model.parts.every(item => item.description && !/[—–]| - |--/.test(item.description) && !/\b(centre|colour|metre|grey|polarise)\b/i.test(item.description)) && model.parts.every(item => item.id === 'system' || item.parentId === 'system'), 'every part described, with no dashes and American spelling, under the system');
  const extraTexts = [...model.controls.flatMap(control => [control.label, control.help]), model.playback.label, model.playback.description, model.playback.stepLabel, model.resultPart.label, ...model.actions.map(action => action.label)];
  t.ok(extraTexts.every(text => !/[—–]| - |--/.test(text)), 'controls, playback and actions without dashes');
  t.ok(model.parts.find(item => item.id === 'cell').route === '#machine/liquid-crystal-display', 'the cell opens the Light room’s Liquid crystal display');
  for (const values of [{}, {gap: 3, background: 1}, {red: 0, green: 0, blue: 0}, {red: 255, green: 255, blue: 255}]) for (const time of [0, 1, 7, 100]) {
    model.reset();
    model.update(values);
    model.advance(time);
    t.ok(model.getState().readings.every(item => !/NaN|undefined|Infinity|null/.test(item.value + (item.hint || ''))), 'readings are all numbers');
    for (const item of model.getState().readings) t.ok(!/[—–]| - |--/.test(item.value + (item.hint || '')) && !/\b(centre|colour|metre|grey|polarise)\b/i.test(item.value + (item.hint || '')), 'readings without dashes, in American spelling');
    checkFinite(model.root, t);
  }
  const numbersIn = value => (value === null || typeof value !== 'object' ? [value] : ArrayBuffer.isView(value) ? Array.from(value) : Object.values(value).flatMap(numbersIn));
  for (const values of [{}, {gap: 6, red: 3}]) t.ok(numbersIn(P.screenPlan(values)).every(value => typeof value !== 'number' || Number.isFinite(value)) && numbersIn(P.screenAt(P.screenPlan(values), 0.05)).every(value => typeof value !== 'number' || Number.isFinite(value)), 'no Infinity or NaN anywhere in the plan or the moment');
}

// Component routing: the two components open the screen’s parts with their own lessons.
t.ok(studyLessons['LCD screen'] === L.lcdScreenLesson, 'the LCD screen’s lesson');
for (const [name, lesson, part] of [['RGB subpixels', L.rgbSubpixelsLesson, 'subpixels'], ['OLED display', L.oledDisplayLesson, 'oled']]) {
  const component = houseComponents[name];
  t.ok(component.machine === 'LCD screen' && component.part === part && component.lesson === lesson && component.intro === lesson.simple && component.view === 'front' && component.isolate === false, `${name} routes to the screen’s ${part} with its own lesson`);
  assert.equal(component.values, undefined);
}
const released = checkDisposal((() => { const fresh = M.createLcdScreenModel(); fresh.advance(2); return fresh; })(), t);
model.dispose();

console.log(`PASS LCD screen: ${t.count} checks, ${counts.energies} energies of the crystal compared, ${counts.layers} layers of light worked through, ${counts.steps} first steps of the flow, ${counts.poses} poses, ${counts.instances} drawn pieces and ${counts.points} rod, ellipse and chart points read back, ${counts.pixels} pixels counted for power, ${counts.numbers} quoted numbers traced, 3 lessons, ${released} resources released exactly once.`);

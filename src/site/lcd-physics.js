import {validateControls, validTime, clamp} from './physics-kit.js';

// ---------------------------------------------------------------------------
// LCD screen: a twisted nematic cell that turns polarized light between crossed
// polarizers, the voltage that decides how much gets through, the rows of
// transistors and capacitors that hold every subpixel's voltage until it is
// written again, the red, green and blue light that adds up to one color, and
// an OLED subpixel that makes its own light from a current.
//
// Exact within the model: Malus's law and the Jones matrices of polarizers and
// retarders; the director of a twisted cell as the least of the Frank energy's
// three elastic terms and the dielectric energy at a fixed voltage, with the
// displacement the same at every depth, found by Newton's method for the tilt
// while the twist follows from its first integral; the crystal turning in time
// against its rotational viscosity, with no backflow; the light through the
// cell as a stack of thin retarders, each layer's index from the index
// ellipsoid; sRGB's decoding of a code into light; the mixture of three
// primaries in CIE XYZ; an OLED subpixel's luminance as its current efficiency
// times its current density.
//
// Sourced: M-1's elastic constants, permittivities, rotational viscosity and
// indices from Merck's patent US10072210B2; the 90° twist, a layer typically 4
// μm thick and AC drive; Polaroid sheet passing 38% with an extinction ratio of
// 1:500; the Newhaven NHD-4.3-480272EF-ASXN module, 480 by 272 pixels on 95.04
// by 53.86 mm, normally white, with its luminance, contrast, response time,
// chromaticities, backlight and line and frame timing; the Newhaven
// NHD-1.5-128128UGC3 OLED module's pixel drawing, chromaticities, brightness
// and 10 μs response; red and green emitters of 29 and 85 cd/A (Universal
// Display) and a deep blue one of 6.5 cd/A at 3.8 V (Idemitsu Kosan); sRGB's
// curve, primaries and matrices; acuity of 1 arc minute.
//
// Declared, not from a source: a pretilt of 2° at both plates and no chiral
// dopant; the cell cut into 40 layers; each color filter taken as one
// wavelength, 630, 550 and 460 nm, with M-1's birefringence the same at all
// three; a drive of 0 to 5 V, black at 5 V and each channel's white where it
// passes the most light; a capacitor that holds its voltage perfectly and
// flips polarity every frame; the picture, a patch of 240 by 128 pixels in the
// middle of the screen, written over a black picture; time 100 times slower
// over 12 frames; the OLED module's emitters as efficient as the published ones
// nearest their colors, every one dropping 3.8 V, with no circular polarizer;
// an OLED compared at the LCD's size and white; a viewing distance of 300 mm.
// ---------------------------------------------------------------------------

export const EPSILON_0 = 8.8541878188e-12;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value) && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

/** Merck mixture M-1 at 20 °C: elastic constants in N, permittivities at 1 kHz, rotational viscosity in Pa·s, indices at 589 nm, clearing point in °C and the patent's threshold V0 in volts. */
export const M1 = deepFreeze({name: 'Merck mixture M-1', k11: 12.0e-12, k22: 6.5e-12, k33: 14.0e-12, epsParallel: 20.5, epsPerpendicular: 14.0, deltaEpsilon: 6.5, epsAverage: 16.2, gamma1: 0.342, ne: 1.5927, deltaN: 0.1147, clearing: 78.0, v0: 1.42});
/** M-1's ordinary index, ne − Δn. */
export const ORDINARY = M1.ne - M1.deltaN;

/** Figures from the pages: the typical layer in μm and its twist in degrees; the 1972 mixtures' threshold and the voltage for 90% opacity, V rms; the DC part that harms a cell, V; Polaroid's transmission and extinction ratio; response timed from 10% to 90%; a 1080p television's subpixels; acuity in arc minutes; the AMOLED page's watts; LG's OLED response in s; the singlet share; sRGB's 22%. */
export const PAGES = deepFreeze({gap: 4, twist: 90, threshold1972: 0.9, opaque1972: 1.4, dcLimit: 0.05, polaroid: 0.38, extinction: 1 / 500, response: [0.1, 0.9], subpixels1080p: 6e6, acuity: 1, amoled: {whiteText: 0.3, blackText: 0.7, lcd: 0.35}, oledResponse: 10e-6, singlet: 0.25, srgbHalf: 0.22});

/** Declared cell: twist in radians, pretilt at both plates in radians, layers, the black drive and the table's step in volts, each filter's wavelength in m (red, green, blue), and the share of the stable time step the crystal's clock takes. */
export const TN = deepFreeze({twist: Math.PI / 2, pretilt: 2 * Math.PI / 180, layers: 40, black: 5, step: 0.05, wavelengths: [630e-9, 550e-9, 460e-9], stability: 0.4});

/** Newhaven NHD-4.3-480272EF-ASXN: pixels, mm sizes, luminance in cd/m², contrast, response in s, chromaticities, backlight, and the parallel RGB timing in clocks and lines. */
export const LCD_PANEL = deepFreeze({
  name: 'NHD-4.3-480272EF-ASXN', columns: 480, rows: 272, active: [95.04, 53.86], polarizer: [98, 56.2], bezel: [98.7, 57], outline: [105.5, 67.2],
  luminance: 1000, luminanceMin: 800, contrast: 500, contrastMin: 400, response: 0.020, responseMax: 0.030,
  red: [0.573, 0.347], green: [0.310, 0.613], blue: [0.143, 0.097], white: [0.273, 0.321],
  backlight: {current: 0.040, currentMax: 0.050, voltage: 25.6, voltageRange: [22.4, 27.2], strings: 2, perString: 8, listed: 12, lifetime: 50000},
  clock: 12e6, lineClocks: 525, activeClocks: 480, hBack: 43, hFront: 2, hSync: 1, frameLines: 285, activeLines: 272, vBack: 12, vFront: 1, vSync: 1,
  hsyncPeriod: [50e-6, 60e-6, 65e-6], sourceSettle: 12e-6, gateEdge: 6e-6, supply: 3.3, supplyCurrent: 0.025,
});

/** Newhaven NHD-1.5-128128UGC3: pixels, mm sizes from its drawing, contrast, response in s, brightness in cd/m², lifetime in h and chromaticities. */
export const OLED_PANEL = deepFreeze({
  name: 'NHD-1.5-128128UGC3', columns: 128, rows: 128, active: [26.855, 26.864], viewArea: 28, pitch: 0.21, subpixelPitch: 0.07, subpixel: [0.045, 0.194], gaps: [0.025, 0.016],
  contrast: 10000, rise: 10e-6, fall: 10e-6, luminance: 90, luminanceMin: 70, lifetime: 10000,
  red: [0.64, 0.34], green: [0.31, 0.62], blue: [0.14, 0.16], white: [0.30, 0.33], supply: 3.3, supplyCurrent: 0.160,
});

/** Published emitters: chromaticity, current efficiency in cd/A and lifetime in h; the blue device's voltage, external quantum efficiency, current density in A/m² and peak in m. */
export const EMITTERS = deepFreeze({
  red: {x: 0.66, y: 0.34, efficiency: 29, lifetime: 600000, maker: 'Universal Display'},
  green: {x: 0.31, y: 0.63, efficiency: 85, lifetime: 400000, maker: 'Universal Display'},
  blue: {x: 0.143, y: 0.078, efficiency: 6.5, voltage: 3.8, eqe: 0.086, density: 100, peak: 452e-9, lifetime: 9000, maker: 'Idemitsu Kosan'},
});

/** sRGB: the decode's threshold, the encode's threshold, slope, offset, scale and exponent; primaries and white; the Y shares; the two matrices; the screen luminance level in cd/m². */
export const SRGB = deepFreeze({
  threshold: 0.04045, linearThreshold: 0.0031308, slope: 12.92, offset: 0.055, scale: 1.055, exponent: 2.4,
  red: [0.64, 0.33], green: [0.30, 0.60], blue: [0.15, 0.06], white: [0.3127, 0.3290], shares: [0.2126, 0.7152, 0.0722],
  toXYZ: [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]],
  fromXYZ: [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]], luminance: 80,
});

/** Declared picture and clock: how much slower the clock runs, frames played, the patch's columns and rows [first, past last], the close up's rows and columns, rows to a band of the panel drawn, seconds between light samples and between director snapshots, the OLED subpixels' voltage, the viewing distance in mm, how long the black and white switch is followed, s, and the polarity the black picture was last written with. */
export const SCREEN = deepFreeze({slow: 100, frames: 12, patchColumns: [120, 360], patchRows: [72, 200], closeRows: [134, 137], closeColumns: [238, 241], band: 8, sample: 0.25e-3, snapshot: 1e-3, oledVoltage: 3.8, viewing: 300, darken: 0.1, lighten: 0.4, previousPolarity: -1});

export const CHANNELS = Object.freeze(['red', 'green', 'blue']);
export const BACKGROUND_OPTIONS = deepFreeze([{value: 0, label: 'Black'}, {value: 1, label: 'White'}]);
export const SCREEN_DEFAULTS = Object.freeze({red: 255, green: 128, blue: 0, background: 0, gap: 4});
export const SCREEN_DOMAINS = deepFreeze({red: [0, 255, 1], green: [0, 255, 1], blue: [0, 255, 1], background: [0, 1, 1], gap: [3, 6, 0.5]});

// ---------------------------------------------------------------------------
// Polarized light: clean functions another model can reuse.
// A Jones vector is [xRe, xIm, yRe, yIm]; a 2 by 2 complex matrix is
// [aRe, aIm, bRe, bIm, cRe, cIm, dRe, dIm] for [a b; c d].
// ---------------------------------------------------------------------------

/** Malus's law: what a polarizer passes of `intensity` when its axis sits `angle` radians from the light's polarization. */
export const malus = (intensity, angle) => intensity * Math.cos(angle) ** 2;

/** A polarizer with its transmission axis `angle` radians from x, passing intensity k1 along the axis and k2 across it; k1 = 1, k2 = 0 is the ideal one. */
export function polarizerMatrix(angle, k1 = 1, k2 = 0) {
  const t1 = Math.sqrt(k1), t2 = Math.sqrt(k2), c = Math.cos(angle), s = Math.sin(angle);
  return Float64Array.of(t1 * c * c + t2 * s * s, 0, (t1 - t2) * c * s, 0, (t1 - t2) * c * s, 0, t1 * s * s + t2 * c * c, 0);
}

/** A retarder with its slow axis `axis` radians from x, putting `retardance` radians between the component along that axis and the one across it. */
export function retarderMatrix(axis, retardance) {
  const C = Math.cos(retardance / 2), S = Math.sin(retardance / 2), c2 = Math.cos(2 * axis), s2 = Math.sin(2 * axis);
  return Float64Array.of(C, S * c2, 0, S * s2, 0, S * s2, C, -S * c2);
}

/** A rotation of the polarization by `angle` radians. */
export function rotationMatrix(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return Float64Array.of(c, 0, -s, 0, s, 0, c, 0);
}

/** The product A·B of two complex 2 by 2 matrices: B acts first. */
export function multiplyMatrices(A, B) {
  const mul = (i, j) => [A[i] * B[j] - A[i + 1] * B[j + 1], A[i] * B[j + 1] + A[i + 1] * B[j]];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  return Float64Array.from([...add(mul(0, 0), mul(2, 4)), ...add(mul(0, 2), mul(2, 6)), ...add(mul(4, 0), mul(6, 4)), ...add(mul(4, 2), mul(6, 6))]);
}

/** A matrix applied to a Jones vector. */
export function applyMatrix(M, E) {
  const [xr, xi, yr, yi] = E;
  return Float64Array.of(M[0] * xr - M[1] * xi + M[2] * yr - M[3] * yi, M[0] * xi + M[1] * xr + M[2] * yi + M[3] * yr, M[4] * xr - M[5] * xi + M[6] * yr - M[7] * yi, M[4] * xi + M[5] * xr + M[6] * yi + M[7] * yr);
}

/** A Jones vector's intensity. */
export const intensityOf = E => E[0] * E[0] + E[1] * E[1] + E[2] * E[2] + E[3] * E[3];

/** The share of unpolarized light a matrix passes: half the sum of its entries' squared sizes. */
export function unpolarizedThrough(M) {
  let sum = 0;
  for (const value of M) sum += value * value;
  return sum / 2;
}

/** The index an extraordinary wave meets where the director tilts `tilt` radians out of the plane of the cell, from the index ellipsoid: 1/n² = sin²/no² + cos²/ne². */
export const extraordinaryIndex = (tilt, no = ORDINARY, ne = M1.ne) => 1 / Math.sqrt(Math.sin(tilt) ** 2 / (no * no) + Math.cos(tilt) ** 2 / (ne * ne));

/** A sheet's principal transmittances [k1, k2] from the share of unpolarized light it passes and its extinction ratio k2/k1. */
export function sheetTransmittances(single = PAGES.polaroid, extinction = PAGES.extinction) {
  const k1 = 2 * single / (1 + extinction);
  return Object.freeze([k1, k1 * extinction]);
}
export const POLAROID = sheetTransmittances();

// ---------------------------------------------------------------------------
// The twisted cell. Depth z runs from the rear plate (0) to the front plate (1)
// in units of the gap; energy is per K11/d; the director tilts θ out of the
// plate and turns φ in it, φ = 0 along the rear plate's rubbing.
// ---------------------------------------------------------------------------

const K22 = M1.k22 / M1.k11, K33 = M1.k33 / M1.k11;

/** The dielectric energy's weight against the elastic energy at `volts`: ε0V²/K11. */
export const kappaOf = volts => EPSILON_0 * volts * volts / M1.k11;

/**
 * For tilts at N + 1 depths (radians, both ends held), the energy of the cell
 * per K11/d with its twist relaxed and its voltage fixed, E = Σ a(θ̄)Δθ²/2h +
 * Φ²/2J − κ/2I with J = Σ h/b(θ̄) and I = Σ h/ε(θ̄); its gradient; and its
 * Hessian as a tridiagonal part plus F2·u·uᵀ + U2·v·vᵀ.
 */
export function reducedEnergyParts(theta, volts, twist = TN.twist) {
  const N = theta.length - 1, h = 1 / N, kappa = kappaOf(volts), ep = M1.epsPerpendicular, de = M1.deltaEpsilon;
  const g = new Float64Array(N + 1), diag = new Float64Array(N + 1), off = new Float64Array(N + 1), u = new Float64Array(N + 1), v = new Float64Array(N + 1);
  let J = 0, I = 0, elastic = 0;
  for (let j = 0; j < N; j++) {
    const C = Math.cos(theta[j] + theta[j + 1]);
    J += h / (K22 * (1 + C) ** 2 / 4 + K33 * (1 - C * C) / 4);
    I += h / (ep + de * (1 - C) / 2);
  }
  const F1 = -twist * twist / (2 * J * J), F2 = twist * twist / (J * J * J), U1 = kappa / (2 * I * I), U2 = -kappa / (I * I * I);
  for (let j = 0; j < N; j++) {
    const m = (theta[j] + theta[j + 1]) / 2, C = Math.cos(2 * m), S = Math.sin(2 * m), D = theta[j + 1] - theta[j];
    const a = (1 + C) / 2 + K33 * (1 - C) / 2, a1 = (K33 - 1) * S, a2 = 2 * (K33 - 1) * C;
    const b = K22 * (1 + C) ** 2 / 4 + K33 * (1 - C * C) / 4, bC = K22 * (1 + C) / 2 - K33 * C / 2, bCC = (K22 - K33) / 2;
    const b1 = -2 * S * bC, b2 = 4 * S * S * bCC - 4 * C * bC;
    const e = ep + de * (1 - C) / 2, e1 = de * S, e2 = 2 * de * C;
    const w1 = -h * b1 / (b * b), w2 = h * (2 * b1 * b1 / (b * b * b) - b2 / (b * b));
    const v1 = -h * e1 / (e * e), v2 = h * (2 * e1 * e1 / (e * e * e) - e2 / (e * e));
    elastic += a * D * D / (2 * h);
    const common = a1 * D * D / (4 * h) + F1 * w1 / 2 + U1 * v1 / 2, lin = a * D / h;
    g[j] += common - lin;
    g[j + 1] += common + lin;
    const glob = (F1 * w2 + U1 * v2) / 4, curv = a2 * D * D / (8 * h);
    diag[j] += curv - a1 * D / h + a / h + glob;
    diag[j + 1] += curv + a1 * D / h + a / h + glob;
    off[j] += curv - a / h + glob;
    u[j] += w1 / 2; u[j + 1] += w1 / 2;
    v[j] += v1 / 2; v[j + 1] += v1 / 2;
  }
  g[0] = g[N] = 0;
  return {energy: elastic + twist * twist / (2 * J) - kappa / (2 * I), g, diag, off, u, v, F2, U2, J, I, kappa};
}

/** Solves the tridiagonal part plus μ on the interior depths 1..N − 1; null if a pivot vanishes. */
function tridiagonalSolve(diag, off, rhs, mu) {
  const N = diag.length - 1, c = new Float64Array(N + 1), d = new Float64Array(N + 1), x = new Float64Array(N + 1);
  for (let k = 1; k < N; k++) {
    const lower = k > 1 ? off[k - 1] : 0, beta = diag[k] + mu - lower * c[k - 1];
    if (!(Math.abs(beta) > 1e-300)) return null;
    c[k] = off[k] / beta;
    d[k] = (rhs[k] - lower * d[k - 1]) / beta;
  }
  for (let k = N - 1; k >= 1; k--) x[k] = d[k] - (k < N - 1 ? c[k] * x[k + 1] : 0);
  return x;
}

const interiorDot = (p, q) => { let sum = 0; for (let k = 1; k < p.length - 1; k++) sum += p[k] * q[k]; return sum; };

/** The tilt at every depth at rest under `volts`, by damped Newton steps from `start` (a profile at a lower voltage keeps the tilt on its side of the plate). */
export function tiltProfile(volts, start) {
  let theta = Float64Array.from(start), parts = reducedEnergyParts(theta, volts), mu = 0;
  for (let iteration = 0; iteration < 80; iteration++) {
    const minus = parts.g.map(value => -value);
    let accepted = false, size = Infinity;
    for (let attempt = 0; attempt < 48 && !accepted; attempt++) {
      const y = tridiagonalSolve(parts.diag, parts.off, minus, mu), zu = tridiagonalSolve(parts.diag, parts.off, parts.u, mu), zv = tridiagonalSolve(parts.diag, parts.off, parts.v, mu);
      if (y && zu && zv) {
        const du = 1 + parts.F2 * interiorDot(parts.u, zu), uy = interiorDot(parts.u, y), uzv = interiorDot(parts.u, zv);
        const y1 = y.map((value, k) => value - parts.F2 * zu[k] * uy / du), zv1 = zv.map((value, k) => value - parts.F2 * zu[k] * uzv / du);
        const dv = 1 + parts.U2 * interiorDot(parts.v, zv1), vy = interiorDot(parts.v, y1);
        const step = y1.map((value, k) => value - parts.U2 * zv1[k] * vy / dv);
        step[0] = 0;
        step[step.length - 1] = 0;
        size = 0;
        for (const value of step) size = Math.max(size, Math.abs(value));
        const trial = theta.map((value, k) => value + step[k]), next = Number.isFinite(size) ? reducedEnergyParts(trial, volts) : null;
        if (next && Number.isFinite(next.energy) && next.energy <= parts.energy + 1e-13 * (1 + Math.abs(parts.energy))) {
          theta = trial;
          parts = next;
          mu /= 4;
          accepted = true;
        }
      }
      if (!accepted) mu = mu ? mu * 8 : 1e-3;
    }
    if (!accepted || size < 1e-12) break;
  }
  return theta;
}

/** The twist at every depth for tilts `theta`: b(θ)φ′ is the same at every depth, so φ grows as Σ h/b and reaches the full twist at the front plate. */
export function twistProfile(theta, twist = TN.twist) {
  const N = theta.length - 1, h = 1 / N, weights = new Float64Array(N), phi = new Float64Array(N + 1);
  let J = 0;
  for (let j = 0; j < N; j++) {
    const C = Math.cos(theta[j] + theta[j + 1]);
    weights[j] = h / (K22 * (1 + C) ** 2 / 4 + K33 * (1 - C * C) / 4);
    J += weights[j];
  }
  for (let j = 0; j < N; j++) phi[j + 1] = phi[j] + twist * weights[j] / J;
  phi[N] = twist;
  return phi;
}

/** The field in each layer, V/m, when `volts` sit across a cell `gap` μm thick: the displacement is the same at every depth, so E = V/(d·ε(θ)·Σ h/ε). */
export function fieldProfile(theta, volts, gap) {
  const N = theta.length - 1, h = 1 / N, eps = new Float64Array(N);
  let I = 0;
  for (let j = 0; j < N; j++) { eps[j] = M1.epsPerpendicular + M1.deltaEpsilon * Math.sin((theta[j] + theta[j + 1]) / 2) ** 2; I += h / eps[j]; }
  return eps.map(value => volts / (gap * 1e-6 * value * I));
}

/** The onset of tilt in a cell with no pretilt: the voltage at which the flat state stops being the least energy, by bisection on the Hessian's pivots. */
export function onsetVoltage(layers = TN.layers) {
  const flat = new Float64Array(layers + 1);
  const stable = volts => {
    const {diag, off} = reducedEnergyParts(flat, volts);
    let pivot = 1;
    for (let k = 1; k < layers; k++) {
      pivot = diag[k] - (k > 1 ? off[k - 1] * off[k - 1] / pivot : 0);
      if (!(pivot > 0)) return false;
    }
    return true;
  };
  let lo = 0, hi = TN.black;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (stable(mid)) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** The cell's Jones matrix for light entering at the rear plate: one retarder a layer, its slow axis along the layer's twist and its retardance 2π(n − no)·thickness/λ. */
export function cellMatrix(theta, phi, gap, wavelength) {
  const N = theta.length - 1, thickness = gap * 1e-6 / N;
  let a0 = 1, a1 = 0, b0 = 0, b1 = 0, c0 = 0, c1 = 0, d0 = 1, d1 = 0;
  for (let j = 0; j < N; j++) {
    const tilt = (theta[j] + theta[j + 1]) / 2, azimuth = (phi[j] + phi[j + 1]) / 2;
    const G = 2 * Math.PI * (extraordinaryIndex(tilt) - ORDINARY) * thickness / wavelength;
    const C = Math.cos(G / 2), S = Math.sin(G / 2), p = S * Math.cos(2 * azimuth), q = S * Math.sin(2 * azimuth);
    // This layer is [C + ip, iq; iq, C − ip], applied after the layers before it.
    const na0 = C * a0 - p * a1 - q * c1, na1 = C * a1 + p * a0 + q * c0;
    const nb0 = C * b0 - p * b1 - q * d1, nb1 = C * b1 + p * b0 + q * d0;
    const nc0 = -q * a1 + C * c0 + p * c1, nc1 = q * a0 + C * c1 - p * c0;
    const nd0 = -q * b1 + C * d0 + p * d1, nd1 = q * b0 + C * d1 - p * d0;
    a0 = na0; a1 = na1; b0 = nb0; b1 = nb1; c0 = nc0; c1 = nc1; d0 = nd0; d1 = nd1;
  }
  return Float64Array.of(a0, a1, b0, b1, c0, c1, d0, d1);
}

/** The share of unpolarized backlight leaving the front polarizer: the rear polarizer along the rear rubbing, the front one crossed, both Polaroid sheet unless `sheets` says otherwise. */
export function cellTransmission(theta, phi, gap, wavelength, sheets = POLAROID) {
  const inner = multiplyMatrices(cellMatrix(theta, phi, gap, wavelength), polarizerMatrix(0, sheets[0], sheets[1]));
  return unpolarizedThrough(multiplyMatrices(polarizerMatrix(Math.PI / 2, sheets[0], sheets[1]), inner));
}

/** The Jones vector of light polarized along x as it reaches each of `nodes` (depth indices 0..N). */
export function fieldsThrough(theta, phi, gap, wavelength, nodes) {
  const N = theta.length - 1, thickness = gap * 1e-6 / N, out = [];
  let E = Float64Array.of(1, 0, 0, 0);
  for (let j = 0; j <= N; j++) {
    if (nodes.includes(j)) out.push(Float64Array.from(E));
    if (j === N) break;
    const tilt = (theta[j] + theta[j + 1]) / 2, azimuth = (phi[j] + phi[j + 1]) / 2;
    E = applyMatrix(retarderMatrix(azimuth, 2 * Math.PI * (extraordinaryIndex(tilt) - ORDINARY) * thickness / wavelength), E);
  }
  return out;
}

/**
 * The crystal turning under `volts` from `start` ({theta, phi}): the elastic
 * and dielectric torques against the rotational viscosity, γ1·θ̇ and
 * γ1·cos²θ·φ̇, stepped at a share of the stable step. Returns the light at each
 * of `wavelengths` every `sample` seconds, the tilt at the middle, the energy
 * per K11/d, and the director every `snapshot`.
 */
export function relax(start, volts, gap, duration, {sample = SCREEN.sample, snapshot = SCREEN.snapshot, stability = TN.stability, wavelengths = TN.wavelengths, sheets = POLAROID} = {}) {
  const theta = Float64Array.from(start.theta), phi = Float64Array.from(start.phi), N = theta.length - 1, h = 1 / N, kappa = kappaOf(volts);
  const tau = M1.gamma1 * (gap * 1e-6) ** 2 / M1.k11, stable = stability * h * h / (2 * Math.max(1, K33)) * tau;
  const perSample = Math.max(1, Math.ceil(sample / stable)), dt = sample / perSample, ds = dt / tau;
  const count = Math.round(duration / sample), every = Math.max(1, Math.round(snapshot / sample));
  const light = wavelengths.map(() => new Float64Array(count + 1)), middle = new Float64Array(count + 1), energy = new Float64Array(count + 1), thetas = [], phis = [];
  const gT = new Float64Array(N + 1), gP = new Float64Array(N + 1), ep = M1.epsPerpendicular, de = M1.deltaEpsilon;
  const energyNow = () => {
    let elastic = 0, I = 0;
    for (let j = 0; j < N; j++) {
      const C = Math.cos(theta[j] + theta[j + 1]), D = theta[j + 1] - theta[j], P = phi[j + 1] - phi[j];
      elastic += ((1 + C) / 2 + K33 * (1 - C) / 2) * D * D / (2 * h) + (K22 * (1 + C) ** 2 / 4 + K33 * (1 - C * C) / 4) * P * P / (2 * h);
      I += h / (ep + de * (1 - C) / 2);
    }
    return elastic - kappa / (2 * I);
  };
  for (let s = 0; s <= count; s++) {
    wavelengths.forEach((wavelength, w) => { light[w][s] = cellTransmission(theta, phi, gap, wavelength, sheets); });
    middle[s] = theta[N >> 1];
    energy[s] = energyNow();
    if (s % every === 0) { thetas.push(Float64Array.from(theta)); phis.push(Float64Array.from(phi)); }
    if (s === count) break;
    for (let step = 0; step < perSample; step++) {
      let I = 0;
      for (let j = 0; j < N; j++) I += h / (ep + de * (1 - Math.cos(theta[j] + theta[j + 1])) / 2);
      const U1 = kappa / (2 * I * I);
      gT.fill(0);
      gP.fill(0);
      for (let j = 0; j < N; j++) {
        const C = Math.cos(theta[j] + theta[j + 1]), S = Math.sin(theta[j] + theta[j + 1]), D = theta[j + 1] - theta[j], P = phi[j + 1] - phi[j];
        const a = (1 + C) / 2 + K33 * (1 - C) / 2, a1 = (K33 - 1) * S;
        const b = K22 * (1 + C) ** 2 / 4 + K33 * (1 - C * C) / 4, b1 = -2 * S * (K22 * (1 + C) / 2 - K33 * C / 2);
        const e = ep + de * (1 - C) / 2, v1 = -h * de * S / (e * e);
        const common = a1 * D * D / (4 * h) + b1 * P * P / (4 * h) + U1 * v1 / 2, lin = a * D / h, twist = b * P / h;
        gT[j] += common - lin;
        gT[j + 1] += common + lin;
        gP[j] -= twist;
        gP[j + 1] += twist;
      }
      for (let k = 1; k < N; k++) {
        const flat = Math.cos(theta[k]) ** 2;
        theta[k] -= ds * gT[k] / h;
        phi[k] -= ds * gP[k] / (h * flat);
      }
    }
  }
  return {volts, gap, dt, sample, snapshot: every * sample, count, light, middle, energy, thetas, phis};
}

/** A sampled series read at `time` seconds, held at its ends. */
export function seriesAt(series, sample, time) {
  const x = clamp(time / sample, 0, series.length - 1), i = Math.min(series.length - 2, Math.floor(x)), f = x - i;
  return series.length === 1 ? series[0] : series[i] + (series[i + 1] - series[i]) * f;
}

/** The director `time` seconds into a relaxation, between its snapshots. */
export function directorAt(flow, time) {
  const x = clamp(time / flow.snapshot, 0, flow.thetas.length - 1), i = Math.min(flow.thetas.length - 2, Math.floor(x)), f = x - i;
  const mix = (list) => list[i].map((value, k) => value + (list[i + 1][k] - value) * f);
  return flow.thetas.length === 1 ? {theta: Float64Array.from(flow.thetas[0]), phi: Float64Array.from(flow.phis[0])} : {theta: mix(flow.thetas), phi: mix(flow.phis)};
}

/** Seconds between the 10% and the 90% points of a series going from `from` to `to`: {start, end, span}, or null when it does not change or does not get there. */
export function responseOf(series, sample, from, to) {
  if (!(Math.abs(to - from) > 1e-9)) return null;
  const cross = share => {
    const level = from + (to - from) * share;
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1] - level, b = series[i] - level;
      if (a === 0) return (i - 1) * sample;
      if (a * b < 0) return (i - 1 + a / (a - b)) * sample;
    }
    return series.length && series[series.length - 1] === level ? (series.length - 1) * sample : null;
  };
  const start = cross(PAGES.response[0]), end = cross(PAGES.response[1]);
  return start === null || end === null ? null : {start, end, span: end - start};
}

// ---------------------------------------------------------------------------
// Tables: the director at rest does not depend on the gap, only the light does.
// ---------------------------------------------------------------------------

let statics = null;

/** The director at rest at every step of the drive from 0 to 5 V, each solved from the one before, and the onset voltage. */
export function staticTable() {
  if (statics) return statics;
  const count = Math.round(TN.black / TN.step), volts = new Float64Array(count + 1), thetas = [], phis = [], middles = new Float64Array(count + 1);
  let theta = new Float64Array(TN.layers + 1).fill(TN.pretilt);
  for (let i = 0; i <= count; i++) {
    volts[i] = i * TN.step;
    theta = tiltProfile(volts[i], theta);
    thetas.push(theta);
    phis.push(twistProfile(theta));
    middles[i] = theta[TN.layers >> 1];
  }
  statics = Object.freeze({volts, thetas, phis, middles, onset: onsetVoltage()});
  return statics;
}

/** The director at rest under any drive, solved from the table's step below it. */
export function restingDirector(volts) {
  const table = staticTable(), i = Math.max(0, Math.min(table.volts.length - 1, Math.floor(volts / TN.step + 1e-9)));
  const theta = tiltProfile(volts, table.thetas[i]);
  return {theta, phi: twistProfile(theta)};
}

const restingLight = (volts, gap, wavelength) => { const {theta, phi} = restingDirector(volts); return cellTransmission(theta, phi, gap, wavelength); };

const optics = new Map();

/** For a gap: each channel's light at every step of the table, its white (the most light and its voltage), its black at 5 V and its contrast; and a green subpixel switched from white to black and back. */
export function opticsTable(gap) {
  if (optics.has(gap)) return optics.get(gap);
  const table = staticTable(), count = table.volts.length - 1;
  const channels = TN.wavelengths.map(wavelength => {
    const light = Float64Array.from(table.thetas, (theta, i) => cellTransmission(theta, table.phis[i], gap, wavelength));
    let best = 0;
    for (let i = 1; i <= count; i++) if (light[i] > light[best]) best = i;
    let whiteVolts = table.volts[best], whiteT = light[best];
    if (best > 0 && best < count) {
      let lo = table.volts[best - 1], hi = table.volts[best + 1];
      const ratio = (Math.sqrt(5) - 1) / 2;
      let x1 = hi - ratio * (hi - lo), x2 = lo + ratio * (hi - lo), f1 = restingLight(x1, gap, wavelength), f2 = restingLight(x2, gap, wavelength);
      for (let i = 0; i < 40; i++) {
        if (f1 > f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - ratio * (hi - lo); f1 = restingLight(x1, gap, wavelength); }
        else { lo = x1; x1 = x2; f1 = f2; x2 = lo + ratio * (hi - lo); f2 = restingLight(x2, gap, wavelength); }
      }
      const volts = (lo + hi) / 2, peak = restingLight(volts, gap, wavelength);
      if (peak > whiteT) { whiteVolts = volts; whiteT = peak; }
    }
    let falling = true;
    for (let i = 1; i <= count; i++) if (table.volts[i] > whiteVolts && light[i] > (table.volts[i - 1] > whiteVolts ? light[i - 1] : whiteT) + 1e-12) falling = false;
    return Object.freeze({wavelength, light, whiteVolts, whiteT, blackT: light[count], contrast: whiteT / light[count], falling});
  });
  const green = channels[1], white = restingDirector(green.whiteVolts), black = {theta: table.thetas[count], phi: table.phis[count]};
  const darken = relax(white, TN.black, gap, SCREEN.darken, {wavelengths: [green.wavelength], snapshot: SCREEN.darken});
  const lighten = relax(black, green.whiteVolts, gap, SCREEN.lighten, {wavelengths: [green.wavelength], snapshot: SCREEN.lighten});
  const toBlack = responseOf(darken.light[0], darken.sample, green.whiteT, green.blackT), toWhite = responseOf(lighten.light[0], lighten.sample, green.blackT, green.whiteT);
  const result = Object.freeze({gap, channels: Object.freeze(channels), darken, lighten, toBlack, toWhite, switching: toBlack && toWhite ? toBlack.span + toWhite.span : null});
  if (optics.size >= 64) optics.clear();
  optics.set(gap, result);
  return result;
}

/** The drive that lets a channel pass `share` of the way from its black to its white, by bracketing on the table and false position on the director at rest. */
export function driveVolts(gap, channel, share) {
  const table = staticTable(), ch = opticsTable(gap).channels[channel], wavelength = TN.wavelengths[channel];
  if (share >= 1) return ch.whiteVolts;
  if (share <= 0) return TN.black;
  const target = ch.blackT + share * (ch.whiteT - ch.blackT);
  let lo = ch.whiteVolts, hi = TN.black, flo = ch.whiteT - target, fhi = ch.blackT - target;
  for (let i = 0; i < table.volts.length; i++) {
    if (table.volts[i] <= lo) continue;
    const f = ch.light[i] - target;
    if (f <= 0) { hi = table.volts[i]; fhi = f; break; }
    lo = table.volts[i];
    flo = f;
  }
  let side = 0;
  for (let i = 0; i < 80 && hi - lo > 1e-9; i++) {
    const x = hi - fhi * (hi - lo) / (fhi - flo), f = restingLight(x, gap, wavelength) - target;
    if (Math.abs(f) < 1e-13) return x;
    if (f > 0) { lo = x; flo = f; if (side === 1) fhi /= 2; side = 1; }
    else { hi = x; fhi = f; if (side === -1) flo /= 2; side = -1; }
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Color.
// ---------------------------------------------------------------------------

/** sRGB's decode: the light a code between 0 and 1 stands for. */
export const srgbDecode = code => (code <= SRGB.threshold ? code / SRGB.slope : ((code + SRGB.offset) / SRGB.scale) ** SRGB.exponent);
/** sRGB's encode: the code for linear light between 0 and 1. */
export const srgbEncode = light => (light <= SRGB.linearThreshold ? SRGB.slope * light : SRGB.scale * light ** (1 / SRGB.exponent) - SRGB.offset);

/** The XYZ of a chromaticity at luminance Y. */
export const chromaticityXYZ = ([x, y], Y = 1) => [x / y * Y, Y, (1 - x - y) / y * Y];

/** How the white's luminance splits between a panel's red, green and blue: solves [R G B]·s = W with each primary at Y = 1, by Cramer's rule. */
export function primaryShares(panel) {
  const [r, g, b] = [panel.red, panel.green, panel.blue].map(xy => chromaticityXYZ(xy)), w = chromaticityXYZ(panel.white);
  const det3 = (p, q, s) => p[0] * (q[1] * s[2] - q[2] * s[1]) - q[0] * (p[1] * s[2] - p[2] * s[1]) + s[0] * (p[1] * q[2] - p[2] * q[1]);
  const D = det3(r, g, b);
  return Object.freeze([det3(w, g, b) / D, det3(r, w, b) / D, det3(r, g, w) / D]);
}

/** XYZ of red, green and blue at `levels` of a panel's white (white's Y = 1). */
export function mixXYZ(panel, levels, shares = primaryShares(panel)) {
  const out = [0, 0, 0];
  [panel.red, panel.green, panel.blue].forEach((xy, c) => chromaticityXYZ(xy, shares[c] * levels[c]).forEach((value, k) => { out[k] += value; }));
  return out;
}

/** Chromaticity of XYZ, or null for no light. */
export const chromaticityOf = ([X, Y, Z]) => (X + Y + Z > 1e-12 ? [X / (X + Y + Z), Y / (X + Y + Z)] : null);

/** The sRGB color to draw for XYZ, scaled so the panel's own white reaches the screen's brightest, clamped and encoded: [r, g, b] between 0 and 1, and whether it had to be clamped. */
export function drawnColor(XYZ, panel) {
  const toLinear = v => SRGB.fromXYZ.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  const white = toLinear(chromaticityXYZ(panel.white)), scale = 1 / Math.max(...white), linear = toLinear(XYZ).map(value => value * scale);
  return {rgb: linear.map(value => srgbEncode(clamp(value))), clamped: linear.some(value => value < -1e-9 || value > 1 + 1e-9)};
}

/** Whether a chromaticity lies inside the triangle of three others. */
export function insideTriangle(point, a, b, c) {
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const s1 = side(a, b, point), s2 = side(b, c, point), s3 = side(c, a, point);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

/** Seconds from the start of a frame to the start of visible row `row`'s line: the back porch counts its sync pulse. */
export const rowStart = row => (LCD_PANEL.vBack + row) * LCD_PANEL.lineClocks / LCD_PANEL.clock;
export const LINE = LCD_PANEL.lineClocks / LCD_PANEL.clock;
export const FRAME = LCD_PANEL.frameLines * LINE;
/** An OLED's first order rise time constant: 10% to 90% takes ln 9 of them. */
export const OLED_TAU = OLED_PANEL.rise / Math.log(9);

const flows = new Map(), plans = new Map();

/** A subpixel turning from the black picture (5 V) toward `volts`, followed for the whole playback. */
function flowFor(gap, volts) {
  const key = `${gap}:${volts}`;
  if (flows.has(key)) return flows.get(key);
  const table = staticTable(), last = table.volts.length - 1, flow = relax({theta: table.thetas[last], phi: table.phis[last]}, volts, gap, SCREEN.frames * FRAME);
  if (flows.size >= 64) flows.clear();
  flows.set(key, flow);
  return flow;
}

/** Arc minutes a length of `size` mm spans at `distance` mm. */
export const arcMinutes = (size, distance = SCREEN.viewing) => 2 * Math.atan(size / (2 * distance)) * 180 / Math.PI * 60;

/** Everything about the screen that does not change as the clock runs. */
export function screenPlan(input) {
  const values = validateControls(input, SCREEN_DEFAULTS, SCREEN_DOMAINS, 'LCD screen');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const {gap, background} = values, codes = [values.red, values.green, values.blue];
  const table = staticTable(), lcd = opticsTable(gap), count = table.volts.length - 1;
  const linear = codes.map(code => srgbDecode(code / 255));
  const volts = linear.map((share, c) => driveVolts(gap, c, share));
  const backVolts = CHANNELS.map((_, c) => (background ? lcd.channels[c].whiteVolts : TN.black));
  const whites = lcd.channels.map(ch => ch.whiteT);
  const before = lcd.channels.map((ch, c) => ch.blackT / whites[c]);
  const directors = volts.map(restingDirector);
  const settled = directors.map((director, c) => cellTransmission(director.theta, director.phi, gap, TN.wavelengths[c]) / whites[c]);
  const backSettled = backVolts.map((v, c) => restingLight(v, gap, TN.wavelengths[c]) / whites[c]);
  const patchFlows = volts.map(v => flowFor(gap, v)), backFlows = backVolts.map(v => flowFor(gap, v));
  const responses = patchFlows.map((flow, c) => (Math.abs(settled[c] - before[c]) < 0.005 ? null : responseOf(flow.light[c], flow.sample, before[c] * whites[c], settled[c] * whites[c])));
  const lcdShares = primaryShares(LCD_PANEL), oledShares = primaryShares(OLED_PANEL);
  const blackLevel = lcd.channels.map((ch, c) => ch.blackT / whites[c]);
  const lcdContrast = 1 / lcdShares.reduce((sum, share, c) => sum + share * blackLevel[c], 0);
  const lcdPatch = mixXYZ(LCD_PANEL, settled, lcdShares), lcdBack = mixXYZ(LCD_PANEL, backSettled, lcdShares);
  const oledLevels = linear, oledBackLevels = [background, background, background];
  const oledPatch = mixXYZ(OLED_PANEL, oledLevels, oledShares), oledBack = mixXYZ(OLED_PANEL, oledBackLevels, oledShares);
  const efficiencies = [EMITTERS.red.efficiency, EMITTERS.green.efficiency, EMITTERS.blue.efficiency];
  const pixelArea = OLED_PANEL.pitch ** 2 * 1e-6, subpixelArea = OLED_PANEL.subpixel[0] * OLED_PANEL.subpixel[1] * 1e-6;
  const screenArea = LCD_PANEL.active[0] * LCD_PANEL.active[1] * 1e-6;
  const patchPixels = (SCREEN.patchColumns[1] - SCREEN.patchColumns[0]) * (SCREEN.patchRows[1] - SCREEN.patchRows[0]), patchShare = patchPixels / (LCD_PANEL.columns * LCD_PANEL.rows);
  const subLuminance = oledShares.map((share, c) => share * LCD_PANEL.luminance * oledLevels[c]);
  const currents = subLuminance.map((L, c) => L * pixelArea / efficiencies[c]);
  const densities = currents.map(I => I / subpixelArea);
  const emitting = densities.map((J, c) => J * efficiencies[c]);
  const ampsPerWhite = oledShares.reduce((sum, share, c) => sum + share * LCD_PANEL.luminance * screenArea / efficiencies[c], 0);
  const oledAmps = oledShares.reduce((sum, share, c) => sum + share * LCD_PANEL.luminance * screenArea / efficiencies[c] * (oledLevels[c] * patchShare + oledBackLevels[c] * (1 - patchShare)), 0);
  const moduleCurrents = oledShares.map((share, c) => share * OLED_PANEL.luminance * oledLevels[c] * pixelArea / efficiencies[c]);
  const backlightPower = LCD_PANEL.backlight.voltage * LCD_PANEL.backlight.current;
  const lcdPatchLuminance = LCD_PANEL.luminance * lcdPatch[1], oledPatchLuminance = LCD_PANEL.luminance * oledPatch[1];
  const duration = SCREEN.frames * FRAME;
  const plan = {
    values, codes, gap, background, linear, volts, backVolts, whites, before, settled, backSettled, directors, patchFlows, backFlows, responses,
    table, lcd, onset: table.onset, blackLevel, lcdContrast, lcdShares, oledShares,
    lcdPatch, lcdBack, lcdPatchXY: chromaticityOf(lcdPatch), lcdBackXY: chromaticityOf(lcdBack), oledPatch, oledBack, oledPatchXY: chromaticityOf(oledPatch), oledBackXY: chromaticityOf(oledBack),
    lcdPatchColor: drawnColor(lcdPatch, LCD_PANEL), lcdBackColor: drawnColor(lcdBack, LCD_PANEL), oledPatchColor: drawnColor(oledPatch, OLED_PANEL), oledBackColor: drawnColor(oledBack, OLED_PANEL),
    lcdPatchLuminance, lcdBackLuminance: LCD_PANEL.luminance * lcdBack[1], oledPatchLuminance, oledBackLuminance: LCD_PANEL.luminance * oledBack[1],
    efficiencies, pixelArea, subpixelArea, aperture: 3 * subpixelArea / pixelArea, subLuminance, currents, densities, emitting, moduleCurrents,
    screenArea, patchPixels, patchShare, oledAmps, oledPower: oledAmps * SCREEN.oledVoltage, oledWhitePower: ampsPerWhite * SCREEN.oledVoltage, backlightPower,
    line: LINE, frame: FRAME, rate: 1 / FRAME, frames: SCREEN.frames, duration, slow: SCREEN.slow,
    lcdPitch: LCD_PANEL.active[0] / LCD_PANEL.columns, lcdPitchDown: LCD_PANEL.active[1] / LCD_PANEL.rows,
    arcPixel: arcMinutes(LCD_PANEL.active[0] / LCD_PANEL.columns), arcSubpixel: arcMinutes(LCD_PANEL.active[0] / LCD_PANEL.columns / 3), arcOledPixel: arcMinutes(OLED_PANEL.pitch), arcOledSubpixel: arcMinutes(OLED_PANEL.subpixelPitch),
    oledTau: OLED_TAU, maxVolts: TN.black, count,
  };
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** How far a subpixel's light has gone from the black picture toward where it settles, 0 to 1; null when there is nothing to go. */
const progressOf = (now, from, to) => (Math.abs(to - from) < 0.005 ? null : clamp((now - from) / (to - from)));

/** The screen `time` seconds into the playback: the row being written, and the close up's capacitors, crystal and light. */
export function screenAt(plan, time) {
  validTime(time);
  const t = Math.min(time, plan.duration), started = time > 0, done = time >= plan.duration;
  const frame = Math.min(plan.frames - 1, Math.floor(t / plan.frame)), into = t - frame * plan.frame, lineIndex = Math.min(LCD_PANEL.frameLines - 1, Math.floor(into / plan.line + 1e-9));
  const visible = lineIndex >= LCD_PANEL.vBack && lineIndex < LCD_PANEL.vBack + LCD_PANEL.rows;
  const scanRow = started && !done && visible ? lineIndex - LCD_PANEL.vBack : null;
  const writes = row => (started ? Math.max(0, Math.min(plan.frames, Math.floor((t - rowStart(row)) / plan.frame + 1e-9) + 1)) : 0);
  const lightOf = (flows, c, row) => (writes(row) ? seriesAt(flows[c].light[c], flows[c].sample, t - rowStart(row)) / plan.whites[c] : plan.before[c]);
  const oledOf = (level, row) => (writes(row) ? level * (1 - Math.exp(-(t - rowStart(row)) / plan.oledTau)) : 0);
  const rows = [];
  for (let row = SCREEN.closeRows[0]; row < SCREEN.closeRows[1]; row++) {
    const n = writes(row), polarity = n ? (n % 2 ? 1 : -1) : SCREEN.previousPolarity;
    rows.push({row, writes: n, polarity, held: plan.volts.map(v => (n ? v : TN.black) * polarity), lcd: CHANNELS.map((_, c) => lightOf(plan.patchFlows, c, row)), oled: CHANNELS.map((_, c) => oledOf(plan.linear[c], row))});
  }
  const bands = [];
  for (let b = 0; b * SCREEN.band < LCD_PANEL.rows; b++) {
    const row = b * SCREEN.band, inPatch = row >= SCREEN.patchRows[0] && row < SCREEN.patchRows[1];
    bands.push({row, inPatch, written: writes(row) > 0, back: CHANNELS.map((_, c) => lightOf(plan.backFlows, c, row)), patch: inPatch ? CHANNELS.map((_, c) => lightOf(plan.patchFlows, c, row)) : null, oledBack: CHANNELS.map(() => oledOf(plan.background, row)), oledPatch: inPatch ? CHANNELS.map((_, c) => oledOf(plan.linear[c], row)) : null});
  }
  const middle = rows[1], age = t - rowStart(middle.row);
  const last = plan.table.volts.length - 1;
  const directors = CHANNELS.map((_, c) => (middle.writes ? directorAt(plan.patchFlows[c], age) : {theta: Float64Array.from(plan.table.thetas[last]), phi: Float64Array.from(plan.table.phis[last])}));
  const progress = CHANNELS.map((_, c) => progressOf(middle.lcd[c], plan.before[c], plan.settled[c]));
  const moving = progress.filter(value => value !== null);
  return {
    time, t, started, done, frame: started ? frame : null, line: lineIndex, scanRow, rows, bands, middle, directors, progress,
    patchProgress: moving.length ? Math.min(...moving) : null,
    lcdNow: mixXYZ(LCD_PANEL, middle.lcd, plan.lcdShares), oledNow: mixXYZ(OLED_PANEL, middle.oled, plan.oledShares),
  };
}

export const sampleScreen = (input, time = 0) => screenAt(screenPlan(input), time);

import {validateControls, validTime, clamp} from './physics-kit.js';
import {POLAROID, sheetTransmittances, malus, polarizerMatrix, retarderMatrix, multiplyMatrices, applyMatrix, intensityOf, unpolarizedThrough, M1, TN, PAGES as LCD_PAGES} from './lcd-physics.js';
import {dielectricReflection} from './polarized-light-optics.js';

// ---------------------------------------------------------------------------
// The optics behind four pages in the light room and the park: a polarizing
// filter, the liquid crystal between two of them, polarizing sunglasses on
// glare off water or a road, and the pair of prisms in a binocular.
//
// Almost nothing here is new. Malus's law, the Jones matrices of a polarizer
// and of a retarder, and a Polaroid sheet's principal transmittances already
// live in lcd-physics.js; the Fresnel coefficients and Brewster's angle live in
// polarized-light-optics.js; the Porro prisms' rays live in binoculars-optics.js.
// This module adds only what those three do not have: the two glasses a Porro
// prism is really made of, a real sheet polarizer's pair transmission rather
// than an ideal one's, and the retardance of a birefringent layer.
//
// Exact within the model: the critical angle arcsin(n2/n1) and Brewster's angle
// arctan(n2/n1); the reflectance ((n1 - n2)/(n1 + n2))^2 at normal incidence;
// the Abbe number (nd - 1)/(nF - nC); two sheets of a real polarizer passing
// ((k1^2 + k2^2)cos^2 + 2 k1 k2 sin^2)/2 of unpolarized light; the retardance
// 2*pi*dn*L/lambda of a birefringent layer and the Jones vector partway
// through it.
//
// Sourced: SCHOTT's own data sheets for N-BK7 and N-BAK4; the glass codes
// 517642 and 569560 from the Crown glass page, which also says a good
// binocular's prisms are BaK4; a Polaroid sheet passing 38% with an extinction
// ratio of 1:500, and an ideal polarizer passing half; the critical angles of
// water and common glass; Brewster's angles for water and glass; 4% off one
// glass face at normal incidence; the four reflections and 180 degree turn of a
// double Porro prism; Merck's mixture M-1 through lcd-physics.js.
//
// Declared, not from a source: 550 nm as the wavelength the retardance figures
// are quoted at, since the pages give no wavelength for them; the sunglasses
// taken as one Polaroid sheet with no coating and no absorption of its own
// beyond the 38% and the 1:500; the reflecting surface taken as one smooth
// lossless boundary, as polarized-light-optics.js already takes it.
// ---------------------------------------------------------------------------

const DEGREE = Math.PI / 180;
const finite = (...values) => values.every(Number.isFinite);

/** SCHOTT's data sheets, read from the 2025 datasheet collection: the glass code, the index and Abbe number at the d line, nF and nC, and the density in g/cm3. */
export const GLASSES = Object.freeze([
  Object.freeze({key: 'bk7', name: 'N-BK7', code: '517642', nd: 1.51680, vd: 64.17, nF: 1.52238, nC: 1.51432, dispersion: 0.008054, density: 2.51}),
  Object.freeze({key: 'bak4', name: 'N-BAK4', code: '569560', nd: 1.56883, vd: 55.98, nF: 1.57591, nC: 1.56575, dispersion: 0.010162, density: 3.05}),
]);
export const [BK7, BAK4] = GLASSES;

/**
 * Indices the pages give for the things light reflects off. Brewster's angle
 * page puts an air to water boundary at 1.33, which is the water the polarized
 * light bench already reflects off; the Total internal reflection page uses
 * 1.333 for the critical angle it quotes, so that water is kept apart.
 */
export const MEDIA = Object.freeze({water: 1.33, waterCritical: 1.333, commonGlass: 1.5});

/** Calcite, the strongest common birefringence, from the Birefringence page's table. */
export const CALCITE = Object.freeze({no: 1.658, ne: 1.486});

/**
 * Figures typed from the pages: what a Polaroid sheet and a prism polarizer
 * pass, Polaroid's extinction ratio, what an ideal polarizer passes of
 * unpolarized light, the critical angles of water, common glass and diamond,
 * Brewster's angles of water and glass, the reflectance of one glass face at
 * normal incidence and of both faces of a pane, the reflections, turn, glass to
 * air faces and groove of a double Porro prism, the angles of its corners, and
 * the years the sheets and the room temperature liquid crystals arrived.
 */
export const PAGES = Object.freeze({
  polaroid: LCD_PAGES.polaroid, extinction: LCD_PAGES.extinction, prismPolarizer: 0.499, ideal: 0.5,
  waterCritical: 48.6, glassCritical: 41.8,
  waterBrewster: 53, glassBrewster: 56, normalGlass: 0.04, paneGlass: 0.08,
  reflections: 4, turn: 180, faces: 4, groove: 1.5, corner: Object.freeze([45, 90, 45]),
  jSheet: 1929, hSheet: 1938, polarizedGlasses: 1936, mbba: 1969, cyanobiphenyls: 1973,
  nematicRange: Object.freeze([22, 105]), azoxyanisole: 116, williams: 125, williamsYear: 1962, firstMixture: 1966,
});

/** Declared: the wavelength the retardance figures are quoted at, m, and the layer the light is followed through, um. */
export const LIGHT = Object.freeze({wavelength: 550e-9, layer: LCD_PAGES.gap});

export const POLARIZERS_DEFAULTS = Object.freeze({surface: 0, incidence: 55, axis: 0, glass: 1, filters: 2, between: 45, layer: 4});
export const POLARIZERS_DOMAINS = Object.freeze({
  surface: Object.freeze([0, 1, 1]), incidence: Object.freeze([0, 85, 5]), axis: Object.freeze([0, 90, 15]),
  glass: Object.freeze([0, 1, 1]), filters: Object.freeze([1, 3, 1]), between: Object.freeze([0, 90, 15]), layer: Object.freeze([1, 6, 1]),
});

/** The largest angle from the normal at which light still leaves a medium of index `index` for one of index `outer`, in degrees. */
export function criticalAngle(index, outer = 1) {
  if (!finite(index, outer) || outer <= 0 || index <= outer) throw new RangeError('A critical angle needs an index above the one outside it');
  return Math.asin(outer / index) / DEGREE;
}

/** The incidence at which nothing p polarized reflects, in degrees. */
export function brewsterAngle(index, outer = 1) {
  if (!finite(index, outer) || outer <= 0 || index <= 0) throw new RangeError('Brewster needs two positive indices');
  return Math.atan(index / outer) / DEGREE;
}

/** The share of light reflected straight back off one boundary. */
export function normalReflectance(index, outer = 1) {
  if (!finite(index, outer) || outer <= 0 || index <= 0) throw new RangeError('A reflectance needs two positive indices');
  return ((index - outer) / (index + outer)) ** 2;
}

/** A glass's Abbe number worked out from its own three indices. */
export function abbeNumber(glass) {
  if (!glass || !finite(glass.nd, glass.nF, glass.nC) || glass.nF <= glass.nC) throw new RangeError('An Abbe number needs nd, nF and nC');
  return (glass.nd - 1) / (glass.nF - glass.nC);
}

/** What a stack of `count` boundaries passes when each reflects `reflectance`. */
export function throughFaces(reflectance, count = PAGES.faces) {
  if (!finite(reflectance, count) || reflectance < 0 || reflectance >= 1 || !Number.isInteger(count) || count < 0) throw new RangeError('Faces need a reflectance below one and a whole count');
  return (1 - reflectance) ** count;
}

/** A sheet polarizer's principal transmittances [k1, k2], from what it passes of unpolarized light and its extinction ratio. */
export const sheetOf = (single = PAGES.polaroid, extinction = PAGES.extinction) => sheetTransmittances(single, extinction);

/**
 * What two sheets of the same polarizer pass of unpolarized light with `angle`
 * degrees between their axes: ((k1^2 + k2^2)cos^2 + 2 k1 k2 sin^2)/2, which is
 * Malus's law with the sheet's own two transmittances in place of 1 and 0.
 */
export function sheetPair(angle, sheet = POLAROID) {
  const [k1, k2] = sheet ?? [];
  if (!finite(angle, k1, k2) || k1 <= 0 || k2 < 0 || k2 > k1) throw new RangeError('A sheet pair needs an angle and a sheet that passes more along its axis than across it');
  const radians = angle * DEGREE;
  return ((k1 * k1 + k2 * k2) * Math.cos(radians) ** 2 + 2 * k1 * k2 * Math.sin(radians) ** 2) / 2;
}

/** How much brighter the brightest a real pair gets is than the darkest: its contrast ceiling. */
export function pairContrast(sheet = POLAROID) {
  const [k1, k2] = sheet;
  if (!finite(k1, k2) || k2 <= 0) throw new RangeError('A contrast needs a sheet that leaks something');
  return (k1 * k1 + k2 * k2) / (2 * k1 * k2);
}

/** The phase a birefringent layer `thickness` um thick puts between its two axes, in radians. */
export function retardance(deltaN = M1.deltaN, thickness = LIGHT.layer, wavelength = LIGHT.wavelength) {
  if (!finite(deltaN, thickness, wavelength) || thickness < 0 || wavelength <= 0) throw new RangeError('A retardance needs a thickness and a wavelength');
  return 2 * Math.PI * deltaN * thickness * 1e-6 / wavelength;
}

/** How thick a layer has to be, um, for `waves` of retardance: a quarter wave at 0.25, a half wave at 0.5. */
export function waveThickness(waves, deltaN = M1.deltaN, wavelength = LIGHT.wavelength) {
  if (!finite(waves, deltaN, wavelength) || deltaN <= 0 || wavelength <= 0 || waves < 0) throw new RangeError('A wave thickness needs a positive birefringence');
  return waves * wavelength / deltaN * 1e6;
}

/**
 * Light linearly polarized at `angle` degrees to the layer's slow axis, after
 * `depth` um of a layer whose birefringence is `deltaN`: its Jones vector, the
 * share of it a polarizer crossed with the input would pass, and how round it
 * has become (0 linear, 1 circular).
 */
export function throughLayer(depth, angle = 45, deltaN = M1.deltaN, wavelength = LIGHT.wavelength) {
  const phase = retardance(deltaN, depth, wavelength);
  if (!finite(angle)) throw new RangeError('A layer needs an angle');
  const radians = angle * DEGREE;
  const field = applyMatrix(retarderMatrix(0, phase), Float64Array.of(Math.cos(radians), 0, Math.sin(radians), 0));
  const crossed = intensityOf(applyMatrix(polarizerMatrix(radians + Math.PI / 2), field));
  const along = intensityOf(applyMatrix(polarizerMatrix(radians), field));
  // The roundness of the ellipse: how far the two axes' amplitudes and their
  // quarter turn of phase have taken it from a straight line.
  const roundness = Math.abs(Math.sin(2 * radians) * Math.sin(phase));
  return {depth, phase, waves: phase / (2 * Math.PI), field, crossed, along, roundness, total: intensityOf(field)};
}

/**
 * Glare off one smooth boundary at `incidence` degrees, seen through a sheet
 * polarizer whose axis lies `axis` degrees from the vertical p direction.
 * Unpolarized light of unit power comes in; s and p are followed separately.
 */
export function glareThrough(index, incidence, axis = 0, sheet = POLAROID) {
  if (!finite(axis)) throw new RangeError('Sunglasses need an axis');
  const fresnel = dielectricReflection(index, incidence);
  const [k1, k2] = sheet;
  const s = fresnel.Rs / 2, p = fresnel.Rp / 2, reflected = s + p;
  const radians = axis * DEGREE, along = Math.cos(radians) ** 2, across = Math.sin(radians) ** 2;
  const ideal = p * along + s * across;
  const real = p * (k1 * along + k2 * across) + s * (k1 * across + k2 * along);
  return {
    ...fresnel, index, s, p, reflected, ideal, real,
    polarization: reflected > 0 ? (s - p) / reflected : 0,
    rejected: reflected > 0 ? 1 - ideal / reflected : 0,
    rejectedReal: reflected > 0 ? 1 - real / reflected : 0,
  };
}

/** A Porro prism of `glass`: its critical angle, whether its 45 degree faces beat it, and what its four glass to air faces pass. */
export function prismOf(glass = BAK4) {
  const critical = criticalAngle(glass.nd);
  const face = normalReflectance(glass.nd);
  return {glass, critical, face, margin: PAGES.corner[0] - critical, reflects: PAGES.corner[0] > critical, through: throughFaces(face), abbe: abbeNumber(glass)};
}

const plans = new Map();

/** Everything about the filters, the surface, the layer and the prism that the controls decide. */
export function polarizersPlan(input) {
  const values = validateControls(input, POLARIZERS_DEFAULTS, POLARIZERS_DOMAINS, 'polarizers');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const index = values.surface === 0 ? MEDIA.water : MEDIA.commonGlass;
  const glass = GLASSES[values.glass];
  const sheet = POLAROID;
  // The train: one sheet passes 38% of unpolarized light, and each sheet after
  // it passes Malus's law with this sheet's own two transmittances.
  const angles = values.filters === 3 ? [0, values.between, 90] : values.filters === 2 ? [0, 90] : [0];
  let train = unpolarizedThrough(polarizerMatrix(0, sheet[0], sheet[1]));
  let matrix = polarizerMatrix(0, sheet[0], sheet[1]);
  for (let i = 1; i < angles.length; i++) {
    matrix = multiplyMatrices(polarizerMatrix(angles[i] * DEGREE, sheet[0], sheet[1]), matrix);
    train = unpolarizedThrough(matrix);
  }
  const plan = {
    values, index, glass, sheet, angles, train,
    ideal: values.filters === 3 ? Math.cos(values.between * DEGREE) ** 2 * Math.cos((90 - values.between) * DEGREE) ** 2 / 2 : values.filters === 2 ? 0 : PAGES.ideal,
    single: (sheet[0] + sheet[1]) / 2, parallel: sheetPair(0, sheet), crossed: sheetPair(90, sheet), contrast: pairContrast(sheet),
    glare: glareThrough(index, values.incidence, values.axis, sheet),
    brewster: brewsterAngle(index), surfaceCritical: criticalAngle(index),
    prism: prismOf(glass), layer: values.layer,
    quarter: waveThickness(0.25), half: waveThickness(0.5), full: retardance(M1.deltaN, values.layer),
  };
  // One plan for each setting visited, all dropped at once past 64 so a long
  // session does not keep them.
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The plan, with the light followed `depth` um into the birefringent layer. */
export function polarizersAt(plan, depth) {
  validTime(depth);
  const into = clamp(depth, 0, plan.layer);
  return {depth, into, done: depth >= plan.layer, layer: throughLayer(into), whole: throughLayer(plan.layer)};
}

export const samplePolarizers = (input, depth = 0) => {
  const plan = polarizersPlan(input);
  return {...plan, now: polarizersAt(plan, depth)};
};

export {malus, POLAROID, M1, TN};

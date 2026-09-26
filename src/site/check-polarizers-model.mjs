// Checks the four pages that stand beside published ones in the light room and
// the park: the polarizing filter, the liquid crystals, the polarizing
// sunglasses and the binocular prisms. Each runs on a published bench, so this
// file checks three things: that the sources are what the module says they are,
// worked out again by other routes; that the benches really draw what the
// lessons describe at the preset each page opens with; and that every number
// any of the four lessons quotes is one a bench computes or a source gives.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fixed} from './format.js';
import {tally, checkTrialNumbers, checkQuotedText, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import * as P from './polarizers-physics.js';
import * as L from './polarizers-lessons.js';
import {samplePolarizedLight, dielectricReflection, POLARIZED_LIGHT_DEFAULTS, POLARIZED_LIGHT_DOMAINS, polarizedControlEnabled} from './polarized-light-optics.js';
import {sampleLCD, LCD_DEFAULTS, LCD_DOMAINS, lcdControlEnabled} from './lcd-optics.js';
import {sampleBinoculars, BINOCULARS_DEFAULTS} from './binoculars-optics.js';
import {createPolarizedLightModel} from './polarized-light-model.js';
import {createLCDModel} from './lcd-model.js';
import {createBinocularsModel} from './binoculars-model.js';
import {houseComponents} from './house-components.js';

const t = tally();
const counts = {angles: 0, orientations: 0, layers: 0, poses: 0, rays: 0, numbers: 0};
const DEGREE = Math.PI / 180;
const deg = radians => radians / DEGREE;
const f0 = v => fixed(v, 0), f1 = v => fixed(v, 1), f2 = v => fixed(v, 2), f3 = v => fixed(v, 3), f4 = v => fixed(v, 4), f6 = v => fixed(v, 6);
const near = (a, b, tol, what) => t.near(a, b, tol, what);

// ---------------------------------------------------------------------------
// 1. The sources, typed in again, and the physics worked out by other routes.
// ---------------------------------------------------------------------------

const SRC = {
  polaroid: 0.38, extinction: 1 / 500, prismPolarizer: 0.499, ideal: 0.5,
  waterCritical: 48.6, glassCritical: 41.8, waterBrewster: 53, glassBrewster: 56,
  normalGlass: 0.04, paneGlass: 0.08, water: 1.33, waterForCritical: 1.333, commonGlass: 1.5,
  reflections: 4, turn: 180, faces: 4, groove: 1.5, corner: [45, 90, 45],
  jSheet: 1929, hSheet: 1938, polarizedGlasses: 1936, mbba: 1969, cyanobiphenyls: 1973,
  nematicRange: [22, 105], azoxyanisole: 116, williams: 125, williamsYear: 1962, firstMixture: 1966,
  calcite: {no: 1.658, ne: 1.486},
  bk7: {code: '517642', nd: 1.51680, vd: 64.17, nF: 1.52238, nC: 1.51432, dispersion: 0.008054, density: 2.51},
  bak4: {code: '569560', nd: 1.56883, vd: 55.98, nF: 1.57591, nC: 1.56575, dispersion: 0.010162, density: 3.05},
  m1: {deltaN: 0.1147, ne: 1.5927, v0: 1.42}, tn: {gap: 4, twist: 90}, wavelength: 550e-9,
};

t.ok(P.PAGES.polaroid === SRC.polaroid && P.PAGES.extinction === SRC.extinction, 'the Polarizer page: a Polaroid sheet passes about 38% with an extinction ratio of about 1:500');
t.ok(P.PAGES.prismPolarizer === SRC.prismPolarizer && P.PAGES.ideal === SRC.ideal, 'and some birefringent prism polarizers pass more than 49.9%, against an ideal half');
t.ok(P.PAGES.waterCritical === SRC.waterCritical && P.PAGES.glassCritical === SRC.glassCritical, 'the Total internal reflection page: 48.6 degrees from water and 41.8 from common glass');
t.ok(P.PAGES.waterBrewster === SRC.waterBrewster && P.PAGES.glassBrewster === SRC.glassBrewster, 'the Brewster page: about 53 degrees for water and 56 for glass');
t.ok(P.PAGES.normalGlass === SRC.normalGlass && P.PAGES.paneGlass === SRC.paneGlass, 'the Fresnel page: about 4% off one glass face and 8% off a pane');
t.ok(P.PAGES.reflections === SRC.reflections && P.PAGES.turn === SRC.turn && P.PAGES.faces === SRC.faces && P.PAGES.groove === SRC.groove, 'the Porro page: four reflections, a turn of 180 degrees, four glass to air faces and a groove about 1.5 mm deep');
assert.deepEqual([...P.PAGES.corner], SRC.corner);
assert.deepEqual([...P.PAGES.nematicRange], SRC.nematicRange);
t.ok(P.PAGES.jSheet === SRC.jSheet && P.PAGES.hSheet === SRC.hSheet && P.PAGES.polarizedGlasses === SRC.polarizedGlasses, 'the sheets of 1929 and 1938, and polarized sunglasses from 1936');
t.ok(P.PAGES.mbba === SRC.mbba && P.PAGES.cyanobiphenyls === SRC.cyanobiphenyls && P.PAGES.azoxyanisole === SRC.azoxyanisole && P.PAGES.williams === SRC.williams && P.PAGES.williamsYear === SRC.williamsYear && P.PAGES.firstMixture === SRC.firstMixture, 'MBBA in 1969, the cyanobiphenyls in 1973, the 116 and 125 degrees before them, and the years 1962 and 1966');
t.ok(P.MEDIA.water === SRC.water && P.MEDIA.waterCritical === SRC.waterForCritical && P.MEDIA.commonGlass === SRC.commonGlass, 'water at 1.33 for Brewster and 1.333 for the critical angle, and common glass at 1.5');
t.ok(P.CALCITE.no === SRC.calcite.no && P.CALCITE.ne === SRC.calcite.ne, 'calcite at 1.658 and 1.486');
t.ok(P.LIGHT.wavelength === SRC.wavelength && P.LIGHT.layer === SRC.tn.gap, 'a declared 550 nm and the 4 um layer the LCD pages use');
t.ok(P.M1.deltaN === SRC.m1.deltaN && P.M1.ne === SRC.m1.ne && P.M1.v0 === SRC.m1.v0 && P.TN.twist === SRC.tn.twist * DEGREE, 'Merck M-1: a birefringence of 0.1147, ne of 1.5927, a threshold of 1.42 V and a quarter turn');
for (const [glass, src] of [[P.BK7, SRC.bk7], [P.BAK4, SRC.bak4]]) {
  t.ok(glass.code === src.code && glass.nd === src.nd && glass.vd === src.vd && glass.nF === src.nF && glass.nC === src.nC && glass.dispersion === src.dispersion && glass.density === src.density, `SCHOTT's sheet for ${glass.name}: code ${src.code}, nd ${src.nd}, Abbe ${src.vd}`);
  // The glass code packs the index and the Abbe number: 517642 is 1.517 and 64.2.
  near(Number(src.code.slice(0, 3)) / 1000 + 1, Number(glass.nd.toFixed(3)), 1e-12, `${glass.name}: the code's first three digits are its index`);
  near(Number(src.code.slice(3)) / 10, Number(glass.vd.toFixed(1)), 1e-12, `${glass.name}: the code's last three are its Abbe number`);
  // The Abbe number by its own definition, from the sheet's nd and its stated dispersion, and again from its own nF and nC.
  near((glass.nd - 1) / glass.dispersion, glass.vd, 0.005, `${glass.name}: (nd - 1) over nF - nC is the sheet's Abbe number`);
  near(P.abbeNumber(glass), glass.vd, 0.06, `${glass.name}: and so are its own five decimal nF and nC, to the rounding`);
  near(glass.nF - glass.nC, glass.dispersion, 1e-5, `${glass.name}: nF - nC agrees with the sheet`);
}

// The critical angle, found again by solving Snell's law rather than by arcsin.
for (const index of [1.33, 1.333, 1.4, 1.5, P.BK7.nd, 1.56, P.BAK4.nd, 1.6, 1.9]) {
  let lo = 0, hi = 90;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (index * Math.sin(mid * DEGREE) < 1) lo = mid; else hi = mid; }
  near(P.criticalAngle(index), (lo + hi) / 2, 1e-9, `the critical angle of ${index} by bisection on Snell's law`);
  // Past it nothing is refracted; just short of it something still is.
  t.ok(index * Math.sin((P.criticalAngle(index) + 0.01) * DEGREE) > 1 && index * Math.sin((P.criticalAngle(index) - 0.01) * DEGREE) < 1, `${index}: the angle is the boundary`);
  counts.angles++;
}
near(P.criticalAngle(SRC.waterForCritical), SRC.waterCritical, 0.05, 'water gives the page 48.6 degrees');
near(P.criticalAngle(SRC.commonGlass), SRC.glassCritical, 0.02, 'common glass gives the page 41.8 degrees');

// Brewster's angle: where the reflected and the refracted beam are square to
// one another, and where the module's own Fresnel p reflectance vanishes.
for (const index of [1.33, 1.5, P.BK7.nd, P.BAK4.nd]) {
  const angle = P.brewsterAngle(index), fresnel = dielectricReflection(index, Number(angle.toFixed(9)));
  near(angle + fresnel.refracted, 90, 1e-6, `${index}: at Brewster the reflected and refracted beams are square`);
  near(fresnel.Rp, 0, 1e-12, `${index}: and nothing p polarized reflects`);
  near(Math.tan(angle * DEGREE), index, 1e-12, `${index}: the angle is the arctangent of the index`);
  counts.angles++;
}
near(P.brewsterAngle(SRC.water), SRC.waterBrewster, 0.07, 'water gives the page about 53 degrees');
near(P.brewsterAngle(SRC.commonGlass), SRC.glassBrewster, 0.32, 'glass gives the page about 56 degrees');

// Reflectance straight on, against the bench's own Fresnel at zero incidence,
// and the Fresnel page's identity Rp = Rs squared at 45 degrees.
for (const index of [1.33, 1.5, P.BK7.nd, P.BAK4.nd]) {
  const straight = dielectricReflection(index, 0), slanted = dielectricReflection(index, 45);
  near(P.normalReflectance(index), straight.Rs, 1e-12, `${index}: ((n - 1)/(n + 1)) squared is the Fresnel reflectance straight on`);
  near(straight.Rs, straight.Rp, 1e-12, `${index}: straight on the two directions are the same`);
  near(slanted.Rp, slanted.Rs ** 2, 1e-12, `${index}: at 45 degrees the p reflectance is the square of the s one`);
  near(straight.Rs + straight.Ts, 1, 1e-12, `${index}: nothing is lost straight on`);
  counts.angles++;
}
near(P.normalReflectance(SRC.commonGlass), SRC.normalGlass, 1e-12, 'common glass reflects the page 4% straight on');
near(2 * P.normalReflectance(SRC.commonGlass), SRC.paneGlass, 1e-12, 'and twice that, the 8% the page gives for both faces of a pane');
t.ok(1 - (1 - P.normalReflectance(SRC.commonGlass)) ** 2 < SRC.paneGlass, 'though the second face sees only what the first let through, so a pane reflects a little less than twice one face');

// A real sheet: its two transmittances from the page's two numbers, and a pair
// of them rebuilt by averaging over every direction of an unpolarized input
// instead of by the closed form.
const [k1, k2] = P.POLAROID;
near((k1 + k2) / 2, SRC.polaroid, 1e-12, 'the sheet passes 38% of unpolarized light');
near(k2 / k1, SRC.extinction, 1e-15, 'and leaks one five hundredth of what it passes');
for (const angle of [0, 15, 22.5, 30, 45, 60, 75, 90, 120, 180]) {
  const radians = angle * DEGREE;
  let sum = 0;
  const steps = 2880;
  for (let i = 0; i < steps; i++) {
    const phi = 2 * Math.PI * (i + 0.5) / steps;
    // After the first sheet the field is (sqrt(k1) cos phi, sqrt(k2) sin phi);
    // the second sheet keeps k1 of what lies along its axis and k2 of the rest.
    const along = Math.sqrt(k1) * Math.cos(phi) * Math.cos(radians) + Math.sqrt(k2) * Math.sin(phi) * Math.sin(radians);
    const across = -Math.sqrt(k1) * Math.cos(phi) * Math.sin(radians) + Math.sqrt(k2) * Math.sin(phi) * Math.cos(radians);
    sum += k1 * along * along + k2 * across * across;
    counts.orientations++;
  }
  near(P.sheetPair(angle), sum / steps, 1e-12, `two sheets at ${angle} degrees, averaged over every input direction`);
  // Malus's law is the same thing with a perfect sheet.
  near(P.sheetPair(angle, [1, 0]), Math.cos(radians) ** 2 / 2, 1e-15, `${angle} degrees: a perfect pair is half Malus's law`);
  near(P.sheetPair(angle), P.sheetPair(angle + 180), 1e-15, `${angle} degrees: an axis turned through half a turn is the same axis`);
}
near(P.pairContrast(), P.sheetPair(0) / P.sheetPair(90), 1e-12, 'the contrast ceiling is the parallel pair over the crossed pair');
t.ok(f1(100 * P.sheetPair(0)) === '28.8' && f3(100 * P.sheetPair(90)) === '0.115' && f0(P.pairContrast()) === '250' && f1(100 * P.sheetPair(45)) === '14.4', 'a real pair: 28.8% parallel, 0.115% crossed, 14.4% at 45 degrees and a ceiling of 250:1');
t.ok(P.sheetPair(0) < 0.5 && P.sheetPair(90) > 0, 'a real pair passes less than an ideal one and never reaches black');
near(P.sheetOf(SRC.polaroid, SRC.extinction)[0], k1, 1e-15, 'the sheet is built from the page’s two numbers');

// The birefringent layer: the closed form against a stack of thin retarders,
// and the thickness a quarter and a half wave need.
for (const um of [1, 2, 3, 4, 5, 6]) {
  const phase = P.retardance(P.M1.deltaN, um);
  near(phase, 2 * Math.PI * P.M1.deltaN * um * 1e-6 / P.LIGHT.wavelength, 1e-15, `${um} um: the Waveplate page's 2 pi dn L over lambda`);
  const whole = P.throughLayer(um);
  // The same layer cut into forty slices, multiplied one at a time.
  let field = Float64Array.of(Math.cos(45 * DEGREE), 0, Math.sin(45 * DEGREE), 0);
  const slices = 40;
  for (let i = 0; i < slices; i++) {
    const step = P.retardance(P.M1.deltaN, um / slices), c = Math.cos(step / 2), s = Math.sin(step / 2);
    const [xr, xi, yr, yi] = field;
    field = Float64Array.of(c * xr - s * xi, c * xi + s * xr, c * yr + s * yi, c * yi - s * yr);
    counts.layers++;
  }
  near(field[0] ** 2 + field[1] ** 2 + field[2] ** 2 + field[3] ** 2, 1, 1e-12, `${um} um: a retarder loses nothing`);
  near(whole.total, 1, 1e-12, `${um} um: and neither does the module's`);
  near(whole.crossed + whole.along, 1, 1e-12, `${um} um: what a crossed filter stops and what it passes add up`);
  near(whole.waves, phase / (2 * Math.PI), 1e-15, `${um} um: the retardance in waves`);
}
near(P.waveThickness(0.25), P.LIGHT.wavelength / (4 * P.M1.deltaN) * 1e6, 1e-12, 'a quarter wave is lambda over four times the birefringence');
near(P.retardance(P.M1.deltaN, P.waveThickness(0.5)), Math.PI, 1e-12, 'and a half wave layer puts half a turn between the two directions');
near(P.throughLayer(P.waveThickness(0.5)).crossed, 1, 1e-12, 'a half wave layer at 45 degrees sends everything to the crossed filter');
near(P.throughLayer(P.waveThickness(0.25)).roundness, 1, 1e-12, 'a quarter wave layer at 45 degrees makes the light perfectly round');
t.ok(f1(P.waveThickness(0.25)) === '1.2' && f1(P.waveThickness(0.5)) === '2.4' && f2(P.retardance()) === '5.24' && f2(P.retardance() / (2 * Math.PI)) === '0.83' && f0(deg(P.retardance())) === '300', 'M-1 at 550 nm: 1.2 um a quarter wave, 2.4 um a half, and 4 um giving 0.83 of a wave, 300 degrees');

// Glare: the module's own numbers against the bench's, and what a real sheet
// leaves behind where an ideal one reaches nothing.
for (const [surface, index] of [[0, P.MEDIA.water], [1, P.MEDIA.commonGlass]]) {
  for (let incidence = 0; incidence <= 80; incidence += 5) {
    for (const axis of [0, 15, 45, 90]) {
      const mine = P.glareThrough(index, incidence, axis), theirs = samplePolarizedLight({mode: 1, material: surface, incidence, analyzer: axis, glasses: 1});
      near(mine.s, theirs.sPower, 1e-15, `${index} at ${incidence} degrees: the s half matches the bench`);
      near(mine.p, theirs.pPower, 1e-15, 'and so does the p half');
      near(mine.reflected, theirs.reflectedPower, 1e-15, 'and the whole reflection');
      near(mine.ideal, theirs.glareOutput, 1e-15, `axis ${axis}: an ideal filter passes what the bench says`);
      near(mine.polarization, theirs.degree, 1e-12, 'and the reflection is as polarized as the bench says');
      t.ok(mine.real <= mine.reflected + 1e-15 && mine.real >= 0 && mine.ideal >= 0, 'a filter never passes more than it is given');
      near(mine.Rs + mine.Ts, 1, 1e-12, 'nothing is lost at the boundary');
      counts.angles++;
    }
  }
}
{
  const brewster = P.brewsterAngle(P.MEDIA.water);
  const ideal = P.glareThrough(P.MEDIA.water, Number(brewster.toFixed(9)), 0), real = ideal;
  near(ideal.ideal, 0, 1e-12, 'at Brewster an ideal upright filter passes nothing');
  t.ok(real.real > 0 && f3(100 * real.real) === '0.006', 'a real sheet still leaks 0.006% of the source there');
  near(ideal.polarization, 1, 1e-12, 'because everything reflected is polarized along the surface');
}

// The prisms.
for (const glass of P.GLASSES) {
  const prism = P.prismOf(glass);
  near(prism.critical, P.criticalAngle(glass.nd), 1e-15, `${glass.name}: the prism's critical angle`);
  near(prism.margin, P.PAGES.corner[0] - prism.critical, 1e-15, `${glass.name}: its margin under the 45 degrees its faces are struck at`);
  t.ok(prism.reflects, `${glass.name}: a Porro face reflects`);
  near(prism.through, (1 - prism.face) ** 4, 1e-15, `${glass.name}: four faces pass (1 - R) to the fourth`);
  let through = 1;
  for (let i = 0; i < P.PAGES.faces; i++) through *= 1 - prism.face;
  near(prism.through, through, 1e-15, `${glass.name}: and the same one face at a time`);
}
t.ok(f1(P.prismOf(P.BK7).critical) === '41.2' && f1(P.prismOf(P.BAK4).critical) === '39.6', 'N-BK7 stops letting light out at 41.2 degrees and N-BAK4 at 39.6');
t.ok(f1(P.prismOf(P.BK7).margin) === '3.8' && f1(P.prismOf(P.BAK4).margin) === '5.4', 'so their margins under 45 degrees are 3.8 and 5.4 degrees');
t.ok(f1(100 * P.prismOf(P.BK7).face) === '4.2' && f1(100 * P.prismOf(P.BAK4).face) === '4.9', 'one face reflects 4.2% and 4.9%');
t.ok(f1(100 * P.prismOf(P.BK7).through) === '84.2' && f1(100 * P.prismOf(P.BAK4).through) === '81.8', 'and four of them pass 84.2% and 81.8%');
t.ok(P.prismOf(P.BAK4).through < P.prismOf(P.BK7).through && P.prismOf(P.BAK4).margin > P.prismOf(P.BK7).margin, 'the denser glass wins on margin and loses on transmission');
t.ok(!(P.PAGES.corner[0] > P.criticalAngle(1.4)), 'a glass of 1.4 cannot make a Porro prism reflect');

// Refusals: bad controls, bad depths, and indices that have no critical angle.
checkRefusals(P.samplePolarizers, P.POLARIZERS_DOMAINS, t);
for (const bad of [1, 0.9, 0, -1, NaN, Infinity]) assert.throws(() => P.criticalAngle(bad), RangeError, `no critical angle at ${bad}`);
for (const bad of [0, -1, NaN, Infinity]) assert.throws(() => P.brewsterAngle(bad), RangeError);
for (const bad of [NaN, Infinity]) assert.throws(() => P.normalReflectance(bad), RangeError);
assert.throws(() => P.sheetPair(NaN), RangeError);
assert.throws(() => P.sheetPair(0, [0.5, 0.9]), RangeError, 'a sheet may not pass more across its axis than along it');
assert.throws(() => P.sheetPair(0, null), RangeError);
assert.throws(() => P.retardance(0.1, -1), RangeError);
assert.throws(() => P.retardance(0.1, 1, 0), RangeError);
assert.throws(() => P.waveThickness(0.25, 0), RangeError);
assert.throws(() => P.throughLayer(1, NaN), RangeError);
assert.throws(() => P.abbeNumber({nd: 1.5, nF: 1.5, nC: 1.5}), RangeError);
assert.throws(() => P.throughFaces(1), RangeError);
assert.throws(() => P.throughFaces(0.04, 1.5), RangeError);
assert.throws(() => P.glareThrough(1.5, 45, NaN), RangeError);
{
  const state = P.samplePolarizers({}, 0);
  const finiteEverywhere = value => {
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value) || ArrayBuffer.isView(value)) return [...value].every(finiteEverywhere);
    if (value && typeof value === 'object') return Object.values(value).every(finiteEverywhere);
    return true;
  };
  t.ok(finiteEverywhere(state), 'nothing in the state is NaN or Infinity');
}

// ---------------------------------------------------------------------------
// 2. The benches, read back at the presets these four pages open with.
// ---------------------------------------------------------------------------

const PRESETS = {
  'Polarizing filter': {machine: 'Polarized light', part: 'first', values: {mode: 0, insert: 1, middle: 45, first: 0, analyzer: 90}},
  'Liquid crystals': {machine: 'Liquid crystal display', part: 'molecules', values: {mode: 0, drive: 0, battery: 1}},
  'Polarizing sunglasses': {machine: 'Polarized light', part: 'glasses', values: {mode: 1, brewster: 1, material: 0, glasses: 1, analyzer: 0}},
  'Binocular prisms': {machine: 'Binoculars', part: 'probe', values: {mode: 1, index: 1.5, angle: 0}},
};

const pol = createPolarizedLightModel(), lcd = createLCDModel(), bino = createBinocularsModel();
const models = {'Polarized light': pol, 'Liquid crystal display': lcd, Binoculars: bino};
const settle = model => { model.actions[model.actions.length - 1].run(); model.root.updateMatrixWorld(true); };
const drive = (model, values) => { model.reset(); model.update(values); settle(model); counts.poses++; return model.getState(); };

for (const [name, preset] of Object.entries(PRESETS)) {
  const model = models[preset.machine], part = model.parts.find(item => item.id === preset.part);
  t.ok(part, `${name}: the bench has a ${preset.part} to open on`);
  // Every part hangs under the system part, through however many steps.
  let node = part, depth = 0;
  while (node && node.parentId && depth < 8) { node = model.parts.find(item => item.id === node.parentId); depth++; }
  t.ok(node && node.id === 'system', `${name}: its part tree reaches the system part`);
  drive(model, {...model.defaults, ...preset.values});
  t.ok(part.object.visible, `${name}: the part it opens on is drawn at its preset`);
  checkFinite(model.root, t);
}

// The filter train: each filter turned to its own angle, and the meter bars as
// long as the powers the optics give.
for (const middle of [0, 30, 45, 60, 90]) {
  for (const analyzer of [0, 45, 90]) {
    const values = {...POLARIZED_LIGHT_DEFAULTS, mode: 0, insert: 1, middle, analyzer};
    const state = drive(pol, values), optics = samplePolarizedLight(values);
    near(pol.topology.first.rotation.x, 0, 1e-12, 'the first filter sits at its own angle');
    near(pol.topology.middle.rotation.x, middle * DEGREE, 1e-12, `the middle filter turned to ${middle} degrees`);
    near(pol.topology.analyzer.rotation.x, analyzer * DEGREE, 1e-12, `the analyzer turned to ${analyzer} degrees`);
    t.ok(pol.topology.middle.visible && pol.topology.train.visible && !pol.topology.glare.visible, 'the train is the one drawn');
    const powers = [1, optics.stages[1].power, optics.stages[2].power, optics.output];
    pol.topology.meterBars.forEach((bar, i) => near(bar.scale.x, Math.max(0.00001, powers[i]), 1e-9, `bar ${i} as long as its power`));
    near(state.output, optics.output, 1e-15, 'the state carries the optics');
  }
}
{
  // With the middle filter out, the train has no third stage to draw.
  const values = {...POLARIZED_LIGHT_DEFAULTS, mode: 0, insert: 0, analyzer: 90};
  drive(pol, values);
  t.ok(!pol.topology.middle.visible, 'the middle filter is gone when it is removed');
}

// The glare bench: the glasses and the eye turn with the reflected beam, and
// the glasses' axis always lies across it.
for (const material of [0, 1]) {
  for (const incidence of [0, 25, 45, 55, 80]) {
    for (const axis of [0, 45, 90]) {
      const values = {...POLARIZED_LIGHT_DEFAULTS, mode: 1, material, incidence, analyzer: axis, glasses: 1};
      drive(pol, values);
      const optics = samplePolarizedLight(values), beam = new THREE.Vector3(...optics.reflection.reflected).normalize();
      const axisVector = new THREE.Vector3(0, 1, 0).applyQuaternion(pol.topology.glasses.quaternion);
      const normal = new THREE.Vector3(1, 0, 0).applyQuaternion(pol.topology.glasses.quaternion);
      near(axisVector.dot(beam), 0, 1e-9, 'the glasses axis lies across the reflected beam');
      near(normal.dot(beam), 1, 1e-9, 'and the glasses face along it');
      const gaze = new THREE.Vector3(-1, 0, 0).applyQuaternion(pol.topology.eye.quaternion);
      near(gaze.dot(beam), -1, 1e-9, 'the eye looks back down the beam');
      t.ok(pol.topology.glare.visible && !pol.topology.train.visible, 'the glare bench is the one drawn');
      t.ok(pol.topology.glasses.visible, 'the glasses are in the beam');
      const bars = pol.topology.glareBars;
      // The reflection before the glasses is the meter's 100 % reference; the
      // second bar is the share of it the glasses pass.
      near(bars[0].scale.x, optics.reflectedPower > 0 ? 1 : 0.00001, 1e-9, 'the first bar is the whole reflection');
      near(bars[1].scale.x, optics.reflectedPower > 0 ? Math.max(0.00001, optics.glareOutput / optics.reflectedPower) : 0.00001, 1e-9, 'the second is the share the glasses pass');
      t.ok(bars[1].scale.x <= bars[0].scale.x + 1e-9, 'and the second is never the longer');
      counts.rays++;
    }
  }
}
{
  const values = {...POLARIZED_LIGHT_DEFAULTS, mode: 1, brewster: 1, glasses: 0};
  drive(pol, values);
  t.ok(!pol.topology.glasses.visible, 'taking the glasses off takes them out of the drawing');
}

// The cell: the rods twisted through a quarter turn, or all along the beam.
for (const driveOn of [0, 1]) {
  for (const battery of [0, 1]) {
    drive(lcd, {...LCD_DEFAULTS, drive: driveOn, battery});
    const driven = Boolean(driveOn && battery), axis = new THREE.Vector3();
    for (const {rod, fraction} of lcd.topology.directors) {
      axis.set(0, 1, 0).applyQuaternion(rod.quaternion);
      if (driven) near(Math.abs(axis.x), 1, 1e-9, 'a driven rod points along the beam');
      else {
        const turn = fraction * Math.PI / 2;
        near(axis.x, 0, 1e-9, 'an undriven rod lies across the beam');
        near(Math.abs(axis.y * Math.cos(turn) + axis.z * Math.sin(turn)), 1, 1e-9, 'and turns with its depth through the cell');
      }
      counts.orientations++;
    }
    const state = lcd.getState();
    t.ok(state.driven === driven, `drive ${driveOn} with the battery ${battery}: the cell knows whether it is driven`);
    near(state.output, sampleLCD({...LCD_DEFAULTS, drive: driveOn, battery}).output, 1e-15, 'and passes what the optics say');
  }
}
{
  const twisted = drive(lcd, {...LCD_DEFAULTS, drive: 0}), stood = drive(lcd, {...LCD_DEFAULTS, drive: 1});
  near(twisted.path.twist, 90, 1e-12, 'the undriven cell turns the light through a quarter turn');
  near(stood.path.twist, 0, 1e-12, 'and the driven one turns it through nothing');
  t.ok(twisted.output > stood.output, 'so between crossed filters the undriven cell is the bright one');
}

// The prisms: the traced beam, its reflections, and the orientation symbols.
for (const index of [1.4, 1.5, 1.6]) {
  for (const angle of [-6, -4, 0, 4, 6]) {
    const values = {...BINOCULARS_DEFAULTS, mode: 1, index, angle};
    drive(bino, values);
    const optics = sampleBinoculars(values), probe = optics.probe;
    t.ok(bino.topology.probe.visible && !bino.topology.optics.visible, 'the prism closeup is the one drawn');
    // Every reflection is at a face and past the critical angle; every escape is short of it.
    for (const event of probe.events) {
      if (event.tir) t.ok(event.incidence > probe.criticalAngle - 1e-9, `${index} at ${angle}: a reflection only past the critical angle`);
      else if (event.kind === 'Exit glass') t.ok(event.incidence < probe.criticalAngle + 1e-9, `${index} at ${angle}: light leaves only short of it`);
      counts.rays++;
    }
    near(probe.criticalAngle, P.criticalAngle(index), 1e-12, `${index}: the bench's critical angle is the module's`);
    t.ok(probe.reflections === probe.events.filter(event => event.tir).length, 'the reflections are counted from the trace');
    // The drawn beam follows the traced points, in order, as far as it goes.
    const drawn = bino.topology.probeRays.filter(ray => ray.set);
    t.ok(drawn.length >= probe.points.length - 1, 'there is a segment for every leg of the path');
    const orientation = bino.parts.find(item => item.id === 'orientation').object;
    t.ok(orientation.visible === probe.intended, `${index} at ${angle}: the orientation symbols appear only on the intended route`);
    if (index === 1.4 && angle === 0) t.ok(probe.reflections === 0 && !probe.complete, 'glass at 1.4 lets an axial beam straight out of the first sloping face');
    if (index >= 1.5 && angle === 0) t.ok(probe.reflections === 4 && probe.intended, `glass at ${index} straight on makes the four reflections`);
    counts.poses++;
  }
}

// ---------------------------------------------------------------------------
// 3. The lessons: every number quoted is one a bench computes or a source gives.
// ---------------------------------------------------------------------------

const runPol = values => drive(pol, values);
const runLcd = values => drive(lcd, values);
const runBino = values => drive(bino, values);

checkTrialNumbers(L.polarizingFilterLesson, {
  'Pass one filter': s => ({50: 100 * s.stages[1].power, 38: 100 * P.PAGES.polaroid}),
  'Cross the two filters': s => ({0: 100 * s.output, 0.115: 100 * P.sheetPair(90)}),
  'Turn the analyzer halfway': s => ({25: 100 * s.output, 14.4: 100 * P.sheetPair(45)}),
  'Slip a third filter between crossed ones': s => ({50: 100 * s.stages[1].power, 25: 100 * s.stages[2].power, 12.5: 100 * s.output}),
  'Turn the middle filter nearer the first': s => ({9.375: 100 * s.output}),
  'Turn it nearer the analyzer instead': s => ({9.375: 100 * s.output}),
  'Line the middle filter up with the first': s => ({0: 100 * s.output}),
}, runPol, t);

checkTrialNumbers(L.liquidCrystalsLesson, {
  'Look at the undriven twist': s => ({90: s.path.twist, 50: 100 * s.output}),
  'Switch the voltage on': s => ({0: 100 * s.output}),
  'Take the driver away': s => ({50: 100 * s.output}),
  'Reverse the field': s => ({0: 100 * s.output}),
  'Turn the rear filter parallel': s => ({0: 100 * s.output}),
  'Take the rear filter away': s => ({50: 100 * s.output}),
  'Write a digit': s => ({50: 100 * s.background.output}),
}, runLcd, t);

checkTrialNumbers(L.polarizingSunglassesLesson, {
  'Look at water at the angle where the glare is purest': s => ({53.1: s.reflection.brewster, 3.9: 100 * s.reflectedPower, 0: 100 * s.glareOutput, 0.006: 100 * P.glareThrough(P.MEDIA.water, Number(P.brewsterAngle(P.MEDIA.water).toFixed(9)), 0).real}),
  'Turn your head sideways': s => ({3.9: 100 * s.glareOutput, 0: 100 * s.glareRejected}),
  'Look at a road instead of water': s => ({56.3: s.reflection.brewster, 7.4: 100 * s.reflectedPower, 0: 100 * s.glareOutput}),
  'Look a little off that angle': s => ({8.6: 100 * s.reflection.Rs, 0.026: 100 * s.reflection.Rp, 99.7: 100 * s.glareRejected, 0.013: 100 * s.glareOutput}),
  'Look straight down into the water': s => ({'2.0': 100 * s.reflection.Rs, '1.0': 100 * s.glareOutput}),
  'Look right along the water': s => ({34.7: 100 * s.reflectedPower, 65.6: 100 * s.glareRejected, 11.9: 100 * s.glareOutput}),
  'Take the glasses off': s => ({3.9: 100 * s.glareOutput}),
}, runPol, t);

checkTrialNumbers(L.binocularPrismsLesson, {
  'Trace the four reflections': s => ({4: s.probe.reflections, 45: s.probe.minimumIncidence, 41.8: s.probe.criticalAngle, 160: 40 * s.probe.glassLength, 40: 40 * s.probe.airLength}),
  'Use glass that is not dense enough': s => ({45.6: s.probe.criticalAngle, 45: s.probe.minimumIncidence, 0: s.probe.reflections}),
  'Use denser glass': s => ({38.7: s.probe.criticalAngle, 296: 40 * s.probe.opticalLength, 280: 40 * sampleBinoculars({...BINOCULARS_DEFAULTS, mode: 1}).probe.opticalLength}),
  'Tilt the beam until a reflection fails': s => ({'41.0': s.probe.minimumIncidence}),
  'Find the stray reflection': s => ({5: s.probe.reflections}),
  'Watch the image turn': () => ({180: P.PAGES.turn}),
  'See what the prisms hand over': s => ({9: s.received, 8: s.magnification}),
}, runBino, t);

// Free text: every number sits inside a snippet the check computes.
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

const sheetSnippets = {
  [`the ${f0(100 * P.PAGES.polaroid)}% it passes and the 1:${f0(1 / P.PAGES.extinction)} it leaks`]: 'the 38% it passes and the 1:500 it leaks',
  [`quoted at, ${f0(P.LIGHT.wavelength * 1e9)} nm`]: 'quoted at, 550 nm',
};
covered(L.sheetLimits, sheetSnippets, 'shared limits');

// The polarizing filter.
expectNone(L.polarizingFilterLesson, 'Polarizing filter');
covered(L.polarizingFilterLesson.deeper[0].body, {}, 'filter deeper 1');
covered(L.polarizingFilterLesson.deeper[1].body, {
  [`"around ${f0(100 * P.PAGES.polaroid)}% for Polaroid-type polarizers"`]: '"around 38% for Polaroid-type polarizers"',
  [`"around 1:${f0(1 / P.PAGES.extinction)} for Polaroid"`]: '"around 1:500 for Polaroid"',
  [`passes ${f6(k1)} of the light polarized along its axis and ${f6(k2)} of the light across it`]: 'passes 0.758483 of the light polarized along its axis and 0.001517 of the light across it',
  [`pass ${f1(100 * P.sheetPair(0))}% of unpolarized light with their axes parallel and ${f3(100 * P.sheetPair(90))}% crossed`]: 'pass 28.8% of unpolarized light with their axes parallel and 0.115% crossed',
  [`better than ${f0(P.pairContrast())}:1`]: 'better than 250:1',
}, 'filter deeper 2');
covered(L.polarizingFilterLesson.deeper[2].body, {
  'cos²θ·sin²θ/2': 'cos²θ·sin²θ/2',
  [`At 45 degrees that is ${f1(100 * 0.125)}%, and at 30 or 60 degrees ${fixed(9.375, 3)}%`]: 'At 45 degrees that is 12.5%, and at 30 or 60 degrees 9.375%',
}, 'filter deeper 3');
covered(L.polarizingFilterLesson.deeper[3].body, {
  [`patented in ${P.PAGES.jSheet} and developed in 1932`]: 'patented in 1929 and developed in 1932',
  [`H-sheet of ${P.PAGES.hSheet}`]: 'H-sheet of 1938',
}, 'filter deeper 4');
covered(L.polarizingFilterLesson.deeper[4].body, {[`more than ${f1(100 * P.PAGES.prismPolarizer)}% of unpolarized light`]: 'more than 49.9% of unpolarized light'}, 'filter deeper 5');
covered(L.polarizingFilterLesson.deeper[5].body, {}, 'filter deeper 6');
covered(L.polarizingFilterLesson.limits, sheetSnippets, 'filter limits');
covered(L.polarizingFilterLesson.quiz.explanation, {[`the train passes ${f1(12.5)}% of the source`]: 'the train passes 12.5% of the source', 'middle filter at 45 degrees': 'middle filter at 45 degrees'}, 'filter quiz');

// The liquid crystals.
expectNone(L.liquidCrystalsLesson, 'Liquid crystals');
covered(L.liquidCrystalsLesson.deeper[0].body, {}, 'crystals deeper 1');
covered(L.liquidCrystalsLesson.deeper[1].body, {
  [`at RCA in ${P.PAGES.williamsYear} was nematic only above ${P.PAGES.azoxyanisole} °C, and he applied his field at ${P.PAGES.williams} °C`]: 'at RCA in 1962 was nematic only above 116 °C, and he applied his field at 125 °C',
  [`in ${P.PAGES.firstMixture} first reached a nematic range of ${P.PAGES.nematicRange[0]} to ${P.PAGES.nematicRange[1]} °C, MBBA followed in ${P.PAGES.mbba}`]: 'in 1966 first reached a nematic range of 22 to 105 °C, MBBA followed in 1969',
  [`cyanobiphenyls of ${P.PAGES.cyanobiphenyls}`]: 'cyanobiphenyls of 1973',
}, 'crystals deeper 2');
covered(L.liquidCrystalsLesson.deeper[2].body, {
  'as 2π·Δn·L/λ': 'as 2π·Δn·L/λ',
  [`mixture M-1, whose patent gives Δn as ${P.M1.deltaN}, a layer ${f0(P.LIGHT.layer)} μm thick puts ${f2(P.retardance() / (2 * Math.PI))} of a wave between them at ${f0(P.LIGHT.wavelength * 1e9)} nm, which is ${f0(deg(P.retardance()))} degrees`]: 'mixture M-1, whose patent gives Δn as 0.1147, a layer 4 μm thick puts 0.83 of a wave between them at 550 nm, which is 300 degrees',
}, 'crystals deeper 3');
covered(L.liquidCrystalsLesson.deeper[3].body, {
  'λ/(4Δn)': 'λ/(4Δn)',
  [`is ${f1(P.waveThickness(0.25))} μm for M-1 at ${f0(P.LIGHT.wavelength * 1e9)} nm, and half a wave needs ${f1(P.waveThickness(0.5))} μm`]: 'is 1.2 μm for M-1 at 550 nm, and half a wave needs 2.4 μm',
}, 'crystals deeper 4');
covered(L.liquidCrystalsLesson.deeper[4].body, {[`with ${P.CALCITE.no} for one direction and ${P.CALCITE.ne} for the other`]: 'with 1.658 for one direction and 1.486 for the other'}, 'crystals deeper 5');
covered(L.liquidCrystalsLesson.deeper[5].body, {[`a threshold of ${f2(P.M1.v0)} V`]: 'a threshold of 1.42 V'}, 'crystals deeper 6');
covered(L.liquidCrystalsLesson.limits, {...sheetSnippets, [`patent at ${f0(P.LIGHT.wavelength * 1e9)} nm`]: 'patent at 550 nm'}, 'crystals limits');
covered(L.liquidCrystalsLesson.quiz.explanation, {[`falls to ${f0(0)}%`]: 'falls to 0%'}, 'crystals quiz');

// The sunglasses.
expectNone(L.polarizingSunglassesLesson, 'Polarizing sunglasses');
covered(L.polarizingSunglassesLesson.deeper[0].body, {
  [`about ${f0(100 * P.PAGES.normalGlass)}% for common glass, and which comes to ${f1(100 * P.normalReflectance(P.MEDIA.water))}% for water`]: 'about 4% for common glass, and which comes to 2.0% for water',
}, 'sunglasses deeper 1');
covered(L.polarizingSunglassesLesson.deeper[1].body, {
  [`approximately ${P.PAGES.glassBrewster} degrees for glass and ${P.PAGES.waterBrewster} degrees for water`]: 'approximately 56 degrees for glass and 53 degrees for water',
}, 'sunglasses deeper 2');
covered(L.polarizingSunglassesLesson.deeper[2].body, {}, 'sunglasses deeper 3');
covered(L.polarizingSunglassesLesson.deeper[3].body, {
  'notes that at 45 degrees the reflectance': 'notes that at 45 degrees the reflectance',
  [`On water at 45 degrees the bench gives ${f4(100 * dielectricReflection(P.MEDIA.water, 45).Rs)}% along the surface, and ${f6(dielectricReflection(P.MEDIA.water, 45).Rs)} squared is ${f6(dielectricReflection(P.MEDIA.water, 45).Rs ** 2)}, which is the ${f4(100 * dielectricReflection(P.MEDIA.water, 45).Rp)}%`]: 'On water at 45 degrees the bench gives 5.2307% along the surface, and 0.052307 squared is 0.002736, which is the 0.2736%',
}, 'sunglasses deeper 4');
covered(L.polarizingSunglassesLesson.deeper[4].body, {
  [`the Polarizer page’s ${f0(100 * P.PAGES.polaroid)}% transmission and 1:${f0(1 / P.PAGES.extinction)} extinction, an upright sheet still passes ${f3(100 * P.glareThrough(P.MEDIA.water, Number(P.brewsterAngle(P.MEDIA.water).toFixed(9)), 0).real)}% of the source at that angle, and it dims the rest of the scene to ${f0(100 * P.PAGES.polaroid)}%`]: 'the Polarizer page’s 38% transmission and 1:500 extinction, an upright sheet still passes 0.006% of the source at that angle, and it dims the rest of the scene to 38%',
  [`polarized lenses to ${P.PAGES.polarizedGlasses}`]: 'polarized lenses to 1936',
}, 'sunglasses deeper 5');
covered(L.polarizingSunglassesLesson.deeper[5].body, {}, 'sunglasses deeper 6');
covered(L.polarizingSunglassesLesson.limits, sheetSnippets, 'sunglasses limits');
{
  const brewsterWater = samplePolarizedLight({mode: 1, brewster: 1, material: 0, glasses: 1, analyzer: 90});
  covered(L.polarizingSunglassesLesson.quiz.explanation, {
    [`pass ${f0(0)}% of it and glasses turned to ${90} degrees pass all ${f1(100 * brewsterWater.glareOutput)}% of it`]: 'pass 0% of it and glasses turned to 90 degrees pass all 3.9% of it',
  }, 'sunglasses quiz');
}

// The binocular prisms.
expectNone(L.binocularPrismsLesson, 'Binocular prisms');
covered(L.binocularPrismsLesson.deeper[0].body, {
  [`about ${P.PAGES.waterCritical} degrees from water to air and about ${P.PAGES.glassCritical} degrees from common glass to air`]: 'about 48.6 degrees from water to air and about 41.8 degrees from common glass to air',
  [`cut ${P.PAGES.corner[0]}, ${P.PAGES.corner[1]} and ${P.PAGES.corner[2]} degrees, so its sloping faces are met at ${P.PAGES.corner[0]} degrees`]: 'cut 45, 90 and 45 degrees, so its sloping faces are met at 45 degrees',
}, 'prisms deeper 1');
covered(L.binocularPrismsLesson.deeper[1].body, {
  [`glass code ${P.BK7.code}`]: 'glass code 517642',
  [`that BAK-4 barium crown, code ${P.BAK4.code}`]: 'that BAK-4 barium crown, code 569560',
  [`N-BK7 at ${P.BK7.nd} and N-BAK4 at ${P.BAK4.nd}`]: 'N-BK7 at 1.5168 and N-BAK4 at 1.56883',
  [`critical angles of ${f1(P.prismOf(P.BK7).critical)} and ${f1(P.prismOf(P.BAK4).critical)} degrees`]: 'critical angles of 41.2 and 39.6 degrees',
  [`the ${P.PAGES.corner[0]} degrees the faces are struck at, that is a margin of ${f1(P.prismOf(P.BK7).margin)} degrees for the one and ${f1(P.prismOf(P.BAK4).margin)} degrees for the other`]: 'the 45 degrees the faces are struck at, that is a margin of 3.8 degrees for the one and 5.4 degrees for the other',
}, 'prisms deeper 2');
covered(L.binocularPrismsLesson.deeper[2].body, {}, 'prisms deeper 3');
covered(L.binocularPrismsLesson.deeper[3].body, {
  [`${f1(100 * P.prismOf(P.BK7).face)}% for N-BK7 and ${f1(100 * P.prismOf(P.BAK4).face)}% for N-BAK4`]: '4.2% for N-BK7 and 4.9% for N-BAK4',
  [`which pass ${f1(100 * P.prismOf(P.BK7).through)}% and ${f1(100 * P.prismOf(P.BAK4).through)}% of the light`]: 'which pass 84.2% and 81.8% of the light',
}, 'prisms deeper 4');
covered(L.binocularPrismsLesson.deeper[4].body, {
  'is (nd − 1)/(nF − nC)': 'is (nd − 1)/(nF − nC)',
  [`gives ${P.BK7.vd} for N-BK7 and ${P.BAK4.vd} for N-BAK4`]: 'gives 64.17 for N-BK7 and 55.98 for N-BAK4',
}, 'prisms deeper 5');
covered(L.binocularPrismsLesson.deeper[5].body, {[`about ${P.PAGES.groove} mm deep`]: 'about 1.5 mm deep'}, 'prisms deeper 6');
covered(L.binocularPrismsLesson.limits, {}, 'prisms limits');
covered(L.binocularPrismsLesson.quiz.explanation, {
  [`struck at ${P.PAGES.corner[0]} degrees`]: 'struck at 45 degrees',
  [`Glass at ${1.5} stops letting light out past ${f1(P.criticalAngle(1.5))} degrees`]: 'Glass at 1.5 stops letting light out past 41.8 degrees',
  [`glass at ${1.4} does not stop until ${f1(P.criticalAngle(1.4))} degrees`]: 'glass at 1.4 does not stop until 45.6 degrees',
}, 'prisms quiz');

// What every lesson here owes the reader.
const LESSONS = [['Polarizing filter', L.polarizingFilterLesson], ['Liquid crystals', L.liquidCrystalsLesson], ['Polarizing sunglasses', L.polarizingSunglassesLesson], ['Binocular prisms', L.binocularPrismsLesson]];
for (const [name, lesson] of LESSONS) {
  const preset = PRESETS[name], model = models[preset.machine];
  t.ok(lesson.steps.length === 5, `${name}: five steps`);
  t.ok(lesson.parts.length >= 4, `${name}: a row for every part it names`);
  t.ok(lesson.tryIt.length >= 6 && lesson.tryIt.length <= 7, `${name}: six or seven trials`);
  t.ok(lesson.deeper.length >= 5 && lesson.deeper.length <= 6, `${name}: five or six deeper sections`);
  t.ok(lesson.quiz.answer === 0 && lesson.quiz.options.length === 3, `${name}: a quiz of three with its answer first`);
  t.ok(lesson.sources.length >= 5 && lesson.sources.every(source => /^https:\/\//.test(source.url)) && new Set(lesson.sources).size === lesson.sources.length, `${name}: five or more sources, each a link, none twice`);
  const all = [lesson.simple, lesson.overview, lesson.misconception, lesson.limits, lesson.quiz.question, lesson.quiz.explanation, ...lesson.quiz.options, ...lesson.steps.flatMap(step => [step.title, step.body]), ...lesson.parts.flatMap(item => [item.name, item.role]), ...lesson.deeper.flatMap(item => [item.title, item.body]), ...lesson.tryIt.flatMap(item => [item.title, item.instruction, item.observe]), ...lesson.sources.map(source => source.title)];
  for (const text of all) t.ok(!/[—–]| - |--/.test(text), `${name}: no dashes as punctuation in “${text.slice(0, 50)}”`);
  for (const text of all) t.ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|favour|fibre|polariser|polarised)\b/i.test(text), `${name}: American spelling in “${text.slice(0, 50)}”`);
  // A source's own title may carry a patent or part number; the teaching text may not.
  for (const text of all.filter(item => !lesson.sources.some(source => source.title === item))) t.ok(!/[A-Za-z]\d/.test(text.replace(/N-BK7|N-BAK4|BAK-4|BK7|BaK4|M-1|nF|nC|nd|n1|n2|I0|sRGB/g, '')), `${name}: no number fused to a word in “${text.slice(0, 50)}”`);
  for (const item of lesson.tryIt) {
    t.ok(item.reset === true && item.isolate === false && item.view === 'front', `${name}: every trial resets, does not isolate and faces front`);
    t.ok(model.parts.some(part => part.id === item.part), `${name}: every trial names a part the bench has`);
    assert.deepEqual(Object.keys(item.values).sort(), Object.keys(model.defaults).sort(), `${name}: every trial sets the whole bench`);
  }
}

// The routing: each id is a component of its published bench, opening on its
// own part with the preset its name asks for.
for (const [name, preset] of Object.entries(PRESETS)) {
  const component = houseComponents[name];
  t.ok(component, `${name}: the house routes it`);
  t.ok(component.machine === preset.machine && component.part === preset.part, `${name}: to the ${preset.part} of the ${preset.machine}`);
  t.ok(component.isolate === false && component.view === 'front', `${name}: not isolated, facing front`);
  const lesson = LESSONS.find(([title]) => title === name)[1];
  t.ok(component.lesson === lesson && component.intro === lesson.simple, `${name}: with its own lesson and its own question`);
  for (const [key, value] of Object.entries(component.values || {})) {
    const control = models[preset.machine].controls.find(item => item.key === key);
    t.ok(control && value >= control.min && value <= control.max, `${name}: the preset's ${key} is a real control`);
  }
  assert.deepEqual(component.values, preset.values, `${name}: the preset is the one this check drives`);
}
t.ok(houseComponents['Polarizing filter'].values.insert === 1 && houseComponents['Polarizing filter'].values.mode === 0, 'the filter page opens on the three filter train, not the parent default');
t.ok(houseComponents['Polarizing sunglasses'].values.mode === 1 && houseComponents['Polarizing sunglasses'].values.brewster === 1, 'the sunglasses page opens on reflected glare at the Brewster angle');
t.ok(houseComponents['Binocular prisms'].values.mode === 1, 'the prism page opens inside the Porro pair');
t.ok(houseComponents['Liquid crystals'].machine === 'Liquid crystal display', 'the liquid crystals page opens on the display, which is where they are');

// ---------------------------------------------------------------------------
// 4. What the benches owe these four pages.
// ---------------------------------------------------------------------------

// The controls each page's preset touches are the ones its bench enables there.
for (const [name, preset] of Object.entries(PRESETS)) {
  const model = models[preset.machine], values = {...model.defaults, ...preset.values};
  const enabled = preset.machine === 'Polarized light' ? key => polarizedControlEnabled(key, values) : preset.machine === 'Liquid crystal display' ? key => lcdControlEnabled(key, values) : key => key === 'mode' || (key === 'index' ? values.mode < 2 : key === 'angle' ? values.mode === 1 : ['baseline', 'distance'].includes(key) ? values.mode === 2 : values.mode === 0);
  for (const key of Object.keys(preset.values)) t.ok(enabled(key), `${name}: the preset only sets controls the bench enables, and ${key} is one`);
  // Each enabled control still moves both the readings and the drawing there.
  const snapshot = () => {
    model.root.updateMatrixWorld(true);
    const rows = [];
    model.root.traverse(object => {
      const position = object.geometry?.attributes?.position;
      const round = list => list.map(value => Math.round(value * 1e6));
      rows.push([object.visible, round(object.position.toArray()), round(object.quaternion.toArray()), round(object.scale.toArray()), position ? [Number.isFinite(object.geometry.drawRange.count) ? object.geometry.drawRange.count : -1, round([position.array[0], position.array[1], position.array[2]])] : null]);
    });
    return JSON.stringify(rows);
  };
  for (const control of model.controls) {
    if (!enabled(control.key)) continue;
    const other = control.options ? control.options.find(option => option.value !== values[control.key])?.value : values[control.key] === control.max ? control.min : control.max;
    if (other === undefined) continue;
    const before = drive(model, values), beforeDrawing = snapshot();
    const after = drive(model, {...values, [control.key]: other}), afterDrawing = snapshot();
    const moved = JSON.stringify(before.readings) !== JSON.stringify(after.readings), redrawn = beforeDrawing !== afterDrawing;
    if (moved || redrawn) { t.ok(true, `${name}: ${control.key} changes what the reader sees, in the readings or in the drawing`); continue; }
    // One control can switch another off: the display's battery does nothing to a
    // cell nobody has addressed, which is the physics and not a dead control. Then
    // it has to move the page as soon as the control it waits on is turned on.
    let gate = null;
    for (const gating of model.controls) {
      if (gating.key === control.key || !enabled(gating.key)) continue;
      const lifted = {...values, [gating.key]: values[gating.key] === gating.max ? gating.min : gating.max};
      const shut = drive(model, lifted), shutDrawing = snapshot();
      const open = drive(model, {...lifted, [control.key]: other}), openDrawing = snapshot();
      if (JSON.stringify(shut.readings) !== JSON.stringify(open.readings) || shutDrawing !== openDrawing) { gate = gating.key; break; }
    }
    t.ok(gate !== null, `${name}: ${control.key} changes what the reader sees once ${gate || 'some other control'} lets it`);
  }
}

// The result to inspect after playing: every one of these four pages has one,
// in the mode its preset opens in.
for (const [name, preset] of Object.entries(PRESETS)) {
  const model = models[preset.machine];
  model.reset();
  model.update({...model.defaults, ...preset.values});
  t.ok(!model.playback.complete(), `${name}: nothing to inspect before playing`);
  model.advance(20);
  t.ok(model.playback.complete(), `${name}: the trace finishes`);
  t.ok(model.resultPart.available(), `${name}: and leaves a result to inspect at its own preset`);
  const part = model.parts.find(item => item.id === model.resultPart.id);
  t.ok(part, `${name}: the result part is a part of the bench`);
  model.root.updateMatrixWorld(true);
  t.ok(part.object.visible, `${name}: and it is drawn in this mode`);
  checkFinite(model.root, t);
}

// Readings never say NaN, and the benches keep their published domains.
for (const [name, preset] of Object.entries(PRESETS)) {
  const model = models[preset.machine];
  for (const trial of LESSONS.find(([title]) => title === name)[1].tryIt) {
    const state = drive(model, trial.values);
    t.ok(state.readings.every(item => !/NaN|undefined|Infinity|null/.test(String(item.value) + (item.hint || ''))), `${name}: ${trial.title} leaves no reading unsaid`);
  }
}
for (const [key, [lo, hi, step]] of Object.entries(POLARIZED_LIGHT_DOMAINS)) {
  const control = pol.controls.find(item => item.key === key);
  t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === POLARIZED_LIGHT_DEFAULTS[key], `the polarized light bench keeps its published ${key}`);
}
for (const [key, [lo, hi, step]] of Object.entries(LCD_DOMAINS)) {
  const control = lcd.controls.find(item => item.key === key);
  t.ok(control.min === lo && control.max === hi && control.step === step && control.initial === LCD_DEFAULTS[key], `the display bench keeps its published ${key}`);
}
for (const [key, value] of Object.entries(BINOCULARS_DEFAULTS)) {
  const control = bino.controls.find(item => item.key === key);
  t.ok(control.initial === value, `the binocular bench keeps its published ${key}`);
}

for (const model of [pol, lcd, bino]) model.dispose();
const released = checkDisposal(createPolarizedLightModel(), t) + checkDisposal(createLCDModel(), t) + checkDisposal(createBinocularsModel(), t);

console.log(`PASS polarizers: ${t.count} checks, ${counts.angles} angles worked out again, ${counts.orientations} input directions and drawn rods read back, ${counts.layers} slices of a birefringent layer multiplied, ${counts.rays} rays and reflections traced, ${counts.poses} poses, ${counts.numbers} quoted numbers traced, 4 lessons on 3 published benches, ${released} resources released exactly once.`);

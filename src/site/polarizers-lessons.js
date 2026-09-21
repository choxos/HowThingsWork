import {POLARIZED_LIGHT_DEFAULTS} from './polarized-light-optics.js';
import {LCD_DEFAULTS} from './lcd-optics.js';
import {BINOCULARS_DEFAULTS} from './binoculars-optics.js';

// Four pages that stand beside published ones: the filter itself, the liquid
// crystal between two filters, the sunglasses on reflected glare, and the pair
// of prisms in a binocular. Each runs on the published bench its subject
// belongs to, opens on its own part, and says what that bench does not.

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  polarizer: {title: 'Wikipedia: Polarizer', url: 'https://en.wikipedia.org/wiki/Polarizer'},
  polaroid: {title: 'Wikipedia: Polaroid (polarizer)', url: 'https://en.wikipedia.org/wiki/Polaroid_(polarizer)'},
  polarization: {title: 'Wikipedia: Polarization (waves)', url: 'https://en.wikipedia.org/wiki/Polarization_(waves)'},
  fresnel: {title: 'Wikipedia: Fresnel equations', url: 'https://en.wikipedia.org/wiki/Fresnel_equations'},
  brewster: {title: 'Wikipedia: Brewster’s angle', url: 'https://en.wikipedia.org/wiki/Brewster%27s_angle'},
  sunglasses: {title: 'Wikipedia: Sunglasses', url: 'https://en.wikipedia.org/wiki/Sunglasses'},
  birefringence: {title: 'Wikipedia: Birefringence', url: 'https://en.wikipedia.org/wiki/Birefringence'},
  waveplate: {title: 'Wikipedia: Waveplate', url: 'https://en.wikipedia.org/wiki/Waveplate'},
  liquidCrystal: {title: 'Wikipedia: Liquid crystal', url: 'https://en.wikipedia.org/wiki/Liquid_crystal'},
  tn: {title: 'Wikipedia: Twisted nematic field effect', url: 'https://en.wikipedia.org/wiki/Twisted_nematic_field_effect'},
  merck: {title: 'Merck Patent: US10072210B2, a liquid-crystalline medium (Google Patents)', url: 'https://patents.google.com/patent/US10072210B2/en'},
  porro: {title: 'Wikipedia: Porro prism', url: 'https://en.wikipedia.org/wiki/Porro_prism'},
  tir: {title: 'Wikipedia: Total internal reflection', url: 'https://en.wikipedia.org/wiki/Total_internal_reflection'},
  prism: {title: 'Wikipedia: Prism (optics)', url: 'https://en.wikipedia.org/wiki/Prism_(optics)'},
  crown: {title: 'Wikipedia: Crown glass (optics)', url: 'https://en.wikipedia.org/wiki/Crown_glass_(optics)'},
  schott: {title: 'SCHOTT: optical glass datasheet collection', url: 'https://www.schott.com/en-gb/products/optical-glass-p1000267/downloads'},
};

/** What every page here takes without a source, and what the bench underneath it idealizes. */
export const sheetLimits = 'Not from a source: the wavelength the retardance figures are quoted at, 550 nm, since the pages give none for them, and the sunglasses taken as one Polaroid sheet with no coating and no absorption of its own beyond the 38% it passes and the 1:500 it leaks. Manufacturers’ own polarizer sheets could not be read, so the sheet is the Polarizer page’s Polaroid throughout. The bench draws ideal filters, which pass exactly half of unpolarized light and nothing at all when crossed; wherever a real sheet differs, this lesson says so and gives both numbers.';

// ---------------------------------------------------------------------------
// Polarizing filter: the published polarizer train, opened on the first filter.
// ---------------------------------------------------------------------------

const filterFirst = trial(POLARIZED_LIGHT_DEFAULTS, 'first'), filterAnalyzer = trial(POLARIZED_LIGHT_DEFAULTS, 'analyzer'), filterMiddle = trial(POLARIZED_LIGHT_DEFAULTS, 'middle'), filterMeter = trial(POLARIZED_LIGHT_DEFAULTS, 'meter');

export const polarizingFilterLesson = {
  simple: 'How does a sheet of plastic block light that is vibrating the wrong way?',
  overview: 'Light is a wave whose electric field vibrates across the direction it travels. A polarizing filter has a marked axis, and it passes the part of that field lying along the axis while absorbing the part across it. Because the light that gets through is the projection of the field, and not just the rays that happened to be aligned already, a second filter turned across the first can stop the beam completely, and a third slipped between them can let some of it out again. Open the filter train, turn the axes, and watch the meter.',
  steps: [
    {title: 'Find the vibration', body: 'The red arrows are the electric field. They lie across the beam, never along it, so the beam has a direction of vibration as well as a direction of travel.'},
    {title: 'Project onto the axis', body: 'The double arrow on the filter marks its transmission axis. The filter keeps the part of the field along that axis and absorbs the rest, so a field leaning at an angle is partly passed, not rejected outright.'},
    {title: 'Lose half of an unpolarized beam', body: 'Ordinary light arrives with its vibration in every direction at once. Whatever angle the first filter is set to, it passes half of an ideal beam, and what leaves it is polarized along its axis.'},
    {title: 'Cross the second filter', body: 'Turn the analyzer square to the first axis and the projection onto it vanishes, so the meter reads nothing. This is the crossed pair that every polarizing instrument starts from.'},
    {title: 'Slip a third filter between them', body: 'A filter set at an angle between the two projects the beam onto a new direction, which then has a part along the last axis. Adding a filter makes the output brighter, without any stage giving out more than it took in.'},
  ],
  parts: [
    {name: 'First polarizer', role: 'The sheet that turns ordinary light into polarized light. Its axis can point anywhere; what leaves it is always polarized along that axis.'},
    {name: 'Inserted polarizer', role: 'The removable middle sheet. It is the one that shows that a filter changes the state of the light rather than merely sorting it.'},
    {name: 'Analyzer', role: 'The last sheet, which reveals the polarization of what reaches it by how much it passes as it turns.'},
    {name: 'Source ensemble', role: 'The fan of red arrows standing for unpolarized light: many directions of vibration whose powers add, not one field swinging around.'},
    {name: 'Transmitted-light meter', role: 'The bars and the disk, which compare the power at the source, after each filter, and at the end, on one scale.'},
  ],
  tryIt: [
    filterFirst('Pass one filter', 'Remove the middle filter and line the analyzer up with the first.', 'The first filter passes 50% of the ideal source, and the aligned analyzer passes all of that. A real Polaroid sheet would pass 38%, because it absorbs some of the light it is supposed to transmit.', {insert: 0, analyzer: 0}),
    filterAnalyzer('Cross the two filters', 'Turn the analyzer to 90 degrees, square to the first.', 'The meter falls to 0% of the source. Two real Polaroid sheets crossed would still leak 0.115%, so a crossed pair is dark rather than black.', {insert: 0, analyzer: 90}),
    filterAnalyzer('Turn the analyzer halfway', 'Set the analyzer to 45 degrees.', 'It passes half of what the first filter sent, so 25% of the source arrives. Two real sheets at this angle would pass 14.4%.', {insert: 0, analyzer: 45}),
    filterMiddle('Slip a third filter between crossed ones', 'Insert the middle filter at 45 degrees while the outer two stay crossed.', 'Light returns: 50% after the first, 25% after the middle and 12.5% at the end. Nothing was added; the middle filter changed the direction the last filter is asked about.', {insert: 1, middle: 45}),
    filterMiddle('Turn the middle filter nearer the first', 'Set the middle filter to 30 degrees.', 'The end reads 9.375%, less than the best the middle filter can do.', {insert: 1, middle: 30}),
    filterMiddle('Turn it nearer the analyzer instead', 'Set the middle filter to 60 degrees.', 'The end reads 9.375% again. The two stages trade places, and their product is the same.', {insert: 1, middle: 60}),
    filterMeter('Line the middle filter up with the first', 'Set the middle filter to 0 degrees, along the first axis.', 'The output falls back to 0%. A filter aligned with the light reaching it changes nothing, so the crossed pair is crossed again.', {insert: 1, middle: 0}),
  ],
  deeper: [
    {title: 'Malus’s law is a projection', body: 'The Polarizer page gives Malus’s law as I = I0 cos²θ, for a perfect polarizer in an already polarized beam. It follows from projecting the field: a field at θ to the axis keeps an amplitude E cos θ, and power goes as amplitude squared. The same projection is why an ideal filter passes half of unpolarized light, since the average of cos²θ over all directions is one half.'},
    {title: 'What a real sheet costs', body: 'The Polarizer page says the transmission is "around 38% for Polaroid-type polarizers", against the ideal half, and that the extinction ratio, the unwanted transmission over the wanted, is "around 1:500 for Polaroid". Those two numbers fix the sheet: it passes 0.758483 of the light polarized along its axis and 0.001517 of the light across it. Two such sheets pass 28.8% of unpolarized light with their axes parallel and 0.115% crossed, so no pair of them can show a contrast better than 250:1, whatever the bench’s ideal filters do.'},
    {title: 'The third filter gives nothing away', body: 'With the outer filters crossed and the middle one at θ, an ideal train passes cos²θ·sin²θ/2 of the source. At 45 degrees that is 12.5%, and at 30 or 60 degrees 9.375%, the same on either side because the two stages swap roles. Every stage passes less than it received; the brighter output comes from comparing it with a different arrangement, not from energy appearing.'},
    {title: 'How the sheet is made', body: 'The Polaroid page says the first sheet, patented in 1929 and developed in 1932, held aligned crystals of herapathite in a film, and that the H-sheet of 1938 that replaced it is a stretched polyvinyl alcohol film doped with iodine, conducting along the chains. Light polarized along the chains is absorbed and light across them is transmitted, so the transmission axis runs across the molecules, not along them.'},
    {title: 'Other ways to do it', body: 'Absorbing one direction is only one way. The Polarizer page notes that some birefringent prism polarizers pass more than 49.9% of unpolarized light, close to the ideal half, because they send the unwanted direction off in another direction instead of turning it into heat. The Prism page puts their extinction far beyond a sheet’s.'},
    {title: 'An axis, not an arrow', body: 'The filter’s axis is a line, not a direction along that line, so turning it through half a turn gives the same filter back. That is why the angles here matter only as differences between axes, and why the train’s first filter can sit anywhere without changing what an unpolarized source delivers to the next one.'},
  ],
  misconception: 'A polarizing filter does not act as a sieve that lets through the rays already lined up with it and stops the rest. It takes the part of every field that lies along its axis, which is why light leaning at an angle is dimmed rather than blocked, and why a third filter can brighten a crossed pair.',
  limits: `The bench draws ideal absorbing filters with perfect extinction and no loss along the axis, and represents unpolarized light by a fan of eight equally weighted directions whose powers are added. It does not model the sheet’s molecules, the spectrum, the angle of view, or any wavelength dependence: the real sheet enters this lesson only as the two numbers its page gives. ${sheetLimits}`,
  sources: [sources.polarizer, sources.polaroid, sources.polarization, sources.prism, sources.birefringence],
  quiz: {
    question: 'Why does slipping a third filter between two crossed filters let light through?',
    options: ['The middle filter projects the light onto a new direction, which has a part along the last axis.', 'The middle filter adds energy to the beam as it passes.', 'The middle filter reopens the rays that the first filter had already blocked.'],
    answer: 0,
    explanation: 'Each filter passes at most what it receives. With the middle filter at 45 degrees the train passes 12.5% of the source, against nothing for the crossed pair alone, because the state reaching the last filter is not the same state.',
  },
};

// ---------------------------------------------------------------------------
// Liquid crystals: the published liquid crystal display, opened on its directors.
// ---------------------------------------------------------------------------

const crystalMolecules = trial(LCD_DEFAULTS, 'molecules'), crystalResult = trial(LCD_DEFAULTS, 'result'), crystalRear = trial(LCD_DEFAULTS, 'rear');

export const liquidCrystalsLesson = {
  simple: 'How can a liquid turn the direction light vibrates in, and then stop doing it when you switch on a voltage?',
  overview: 'A liquid crystal flows like a liquid, but its rod-shaped molecules line up like a crystal. Rubbed surfaces at the front and back of a thin cell hold the rods in different directions, so the direction of alignment turns steadily from one face to the other, and polarized light entering the cell is carried around with it. A voltage across the cell stands the rods on end instead, and the turning stops. Between crossed filters, that is the difference between bright and dark. Open the cell and drive it.',
  steps: [
    {title: 'Line the rods up', body: 'In the nematic state the molecules have no ordered positions, but their long axes point roughly the same way. That shared direction is the director, and it is what the optics follow.'},
    {title: 'Twist the alignment', body: 'The two inside faces are rubbed in different directions, and the layer bridges them, so the director turns steadily through the thickness of the cell.'},
    {title: 'Carry the polarization around', body: 'Light polarized along the rods at the entrance is carried around by the twist, so it leaves vibrating in a different direction from the one it arrived in.'},
    {title: 'Stand the rods up', body: 'A voltage across the transparent electrodes pulls the rods into line with the field, along the beam. A director pointing at the viewer has no sideways direction to carry the polarization around, so the turning stops.'},
    {title: 'Read it with a second filter', body: 'The cell only changes the direction of vibration. It is the filter behind it that turns that change into bright or dark, which is why the rear filter can invert the whole picture.'},
  ],
  parts: [
    {name: 'Liquid-crystal directors', role: 'The green rods, one for each depth through the cell, showing the twisted state and the field-aligned state.'},
    {name: 'Front and rear polarizers', role: 'The pair the cell sits between. Crossed, they make the twisted cell bright and the driven cell dark; parallel, they swap the two.'},
    {name: 'Transparent electrodes', role: 'The conducting layers that put the field across the liquid without standing in the way of the light.'},
    {name: 'Alternating driver', role: 'The circuit that swaps the two electrode levels every half cycle, so the cell sees no steady voltage in one direction.'},
    {name: 'Display face', role: 'The assembled face, where each region carries the light its own cell passed.'},
  ],
  tryIt: [
    crystalMolecules('Look at the undriven twist', 'Leave the cell unaddressed and press Play.', 'The rods turn through 90 degrees from face to face, the polarization is carried around with them, and the cell passes 50% of the source through crossed filters.', {drive: 0}),
    crystalMolecules('Switch the voltage on', 'Address the cell while the driver is connected.', 'The rods swing into line with the field, along the beam. Nothing turns the polarization now, so the crossed rear filter blocks it and the cell passes 0%.', {drive: 1}),
    crystalMolecules('Take the driver away', 'Leave the cell addressed but disconnect the driver.', 'Without a voltage difference the rubbed faces take charge again, the twist returns, and the cell is back to 50%.', {drive: 1, battery: 0}),
    crystalMolecules('Reverse the field', 'Keep the cell addressed and choose the second half cycle.', 'The electrodes swap and the field points the other way, but the cell still passes 0%. The director is an axis, so turning it end for end is no change at all.', {drive: 1, polarity: 1}),
    crystalResult('Turn the rear filter parallel', 'Set the rear polarizer parallel to the front one, with the cell unaddressed.', 'Now the twisted cell is the dark one, at 0%, and addressing it makes it bright. The liquid crystal did not change; the question the last filter asks did.', {analyzer: 1}),
    crystalRear('Take the rear filter away', 'Remove the rear polarizer and address the cell.', 'Both states pass 50%. Turning the direction of vibration changes nothing at all unless something downstream cares which direction it is.', {analyzer: 2, drive: 1}),
    crystalResult('Write a digit', 'Choose the seven-segment digit and press Play.', 'Five of the seven regions are addressed and go dark against a background at 50%, each one the same switch as the single cell.', {mode: 1, digit: 3}),
  ],
  deeper: [
    {title: 'What a nematic is', body: 'The Liquid crystal page describes the nematic phase as rod-like molecules that "lack a crystalline positional order, but do self-align with their long axes roughly parallel", and notes that aligned nematics have the optical properties of uniaxial crystals, which is what makes them useful in displays. Order without fixed positions is the whole trick: the rods can be turned by a field because they are still free to flow.'},
    {title: 'Getting one to work at room temperature', body: 'The same page tells how long that took. The material Williams and Heilmeier used at RCA in 1962 was nematic only above 116 °C, and he applied his field at 125 °C. A mixture found in 1966 first reached a nematic range of 22 to 105 °C, MBBA followed in 1969, and the stable cyanobiphenyls of 1973 brought displays into products.'},
    {title: 'A twisted layer is not a perfect rotator', body: 'The bench draws two ideal endpoints: a quarter turn, or nothing. A real layer is birefringent, so the two directions across it travel at different speeds and the light leaves elliptical rather than simply turned. The Waveplate page gives the phase between them as 2π·Δn·L/λ. For Merck’s mixture M-1, whose patent gives Δn as 0.1147, a layer 4 μm thick puts 0.83 of a wave between them at 550 nm, which is 300 degrees, not a quarter turn.'},
    {title: 'How thick for a quarter turn', body: 'Turning that formula around, the thickness that puts a quarter of a wave between the two directions is λ/(4Δn), which is 1.2 μm for M-1 at 550 nm, and half a wave needs 2.4 μm. A half-wave layer is the one that mirrors the direction of vibration, turning it through twice the angle between the light and the layer’s axis.'},
    {title: 'What birefringence looks like in a solid', body: 'The Birefringence page’s strongest common example is calcite, with 1.658 for one direction and 1.486 for the other, which is why a calcite crystal laid on a page shows two images of it. A liquid crystal does the same thing much more weakly, and its advantage is that a small voltage can change it.'},
    {title: 'What actually switches it', body: 'The rods turn because the field pulls harder on one axis of the molecule than the other, so there is a voltage below which nothing moves at all. Merck’s patent gives its mixture a threshold of 1.42 V. The LCD screen page carries that fuller model, with the director solved depth by depth and the light followed through the layer; this page stops at the two endpoints the bench draws.'},
  ],
  misconception: 'The liquid crystal is not a shutter and does not darken. It only changes the direction the light vibrates in, and the filter behind it decides whether that counts as bright or dark, which is why taking that filter away makes the whole display disappear.',
  limits: `The bench draws the two ideal endpoints only: a layer that turns the polarization through a quarter turn, or a field-aligned layer that leaves it alone. It computes no threshold, no gray level, no response time and no wavelength dependence, and the rods are drawn at a spacing chosen for the picture. The real layer’s retardance is quoted here from the mixture in Merck’s patent at 550 nm, which is not the mixture in any particular display. ${sheetLimits}`,
  sources: [sources.liquidCrystal, sources.tn, sources.birefringence, sources.waveplate, sources.merck, sources.polarizer],
  related: ['LCD screen'],
  quiz: {
    question: 'What does the voltage actually change inside the cell?',
    options: ['It turns the molecules into line with the field, so they no longer carry the polarization around.', 'It makes the liquid crystal itself go dark and absorb the light.', 'It reverses the direction the light travels through the cell.'],
    answer: 0,
    explanation: 'With the rods along the beam nothing turns the polarization, so the crossed filter behind the cell blocks it and the reading falls to 0%.',
  },
};

// ---------------------------------------------------------------------------
// Polarizing sunglasses: the published glare bench, opened on the glasses.
// ---------------------------------------------------------------------------

const glareGlasses = trial(POLARIZED_LIGHT_DEFAULTS, 'glasses'), glareSurface = trial(POLARIZED_LIGHT_DEFAULTS, 'surface'), glareMeter = trial(POLARIZED_LIGHT_DEFAULTS, 'glare-result');

export const polarizingSunglassesLesson = {
  simple: 'Why do sunglasses cut the glare off water and a wet road, but not the brightness of everything else?',
  overview: 'Light reflected off a smooth surface comes back partly polarized. The part vibrating along the surface reflects far more strongly than the part in the plane of the beam, so glare off anything horizontal is mostly horizontal. A filter with its axis upright blocks it and passes the rest, which is why polarized sunglasses kill the shine on water while an ordinary tinted lens only dims everything equally. Open the glare bench and change the angle, the surface and the axis.',
  steps: [
    {title: 'Split the reflection in two', body: 'At a surface the field is divided into the part along the surface and the part in the plane of the incoming and reflected beams. The two reflect by different amounts.'},
    {title: 'Watch them separate with angle', body: 'Straight on, the two are reflected equally and the glare is not polarized at all. As the beam slants, the part along the surface pulls away and the reflection becomes strongly polarized.'},
    {title: 'Find the angle where one vanishes', body: 'At one particular slant the part in the plane of the beam is not reflected at all, and everything coming back is polarized along the surface.'},
    {title: 'Stand the filter upright', body: 'The glasses carry a sheet whose axis is upright. Horizontal glare has no part along it, so the glare is absorbed while light from the scene, which is not polarized, is merely dimmed.'},
    {title: 'Turn your head and it returns', body: 'Turn the axis to lie along the surface instead and the glasses now pass exactly what they were blocking, which is why tilting your head sideways brings the shine back.'},
  ],
  parts: [
    {name: 'Polarizing sunglasses', role: 'The sheet in the reflected beam. Its axis turns with the beam, so it always lies across the direction the light travels.'},
    {name: 'Water or glass surface', role: 'One smooth boundary, taken as lossless. Choosing between them changes how much comes back and at what angle the vanishing happens.'},
    {name: 'Reflected-field arrows', role: 'The two colored arrows for the two directions of vibration, drawn separately because they are separate contributions and not one field.'},
    {name: 'Glare meter', role: 'The two bars comparing the reflected power before and after the glasses, on the same scale.'},
    {name: 'Observer', role: 'The eye the reflected beam is aimed at, which turns with the beam as the angle changes.'},
  ],
  tryIt: [
    glareGlasses('Look at water at the angle where the glare is purest', 'Lock the incidence to the Brewster angle of water and keep the glasses upright.', 'The angle settles at 53.1 degrees. Everything reflected is polarized along the surface, 3.9% of the source, and the upright glasses pass 0% of it. A real Polaroid sheet would still leak 0.006%.', {mode: 1, brewster: 1, glasses: 1, analyzer: 0}),
    glareGlasses('Turn your head sideways', 'Keep the same water and angle, and turn the glasses axis to 90 degrees.', 'The glasses now pass the glare they were blocking: 3.9% of the source reaches the eye, and the rejection falls to 0%.', {mode: 1, brewster: 1, glasses: 1, analyzer: 90}),
    glareSurface('Look at a road instead of water', 'Choose the glass surface and keep the incidence locked to its Brewster angle.', 'Denser material, steeper angle: the vanishing moves to 56.3 degrees and the glare grows to 7.4%, all of it polarized along the surface, and the upright glasses still pass 0%.', {mode: 1, brewster: 1, material: 1, glasses: 1, analyzer: 0}),
    glareGlasses('Look a little off that angle', 'Unlock the angle and set the incidence to 55 degrees on water.', 'Now 8.6% of the source comes back along the surface and 0.026% in the other direction. The glasses cut 99.7% of the glare and pass 0.013%, so the shine is reduced but not gone.', {mode: 1, incidence: 55, glasses: 1, analyzer: 0}),
    glareSurface('Look straight down into the water', 'Set the incidence to 0 degrees, square to the surface.', 'Both directions reflect 2.0% and the glare is not polarized at all. The glasses pass 1.0%, exactly half, and no turn of the head helps.', {mode: 1, incidence: 0, glasses: 1, analyzer: 0}),
    glareMeter('Look right along the water', 'Set the incidence to 80 degrees, close to grazing.', 'The surface turns mirror-like: 34.7% of the source comes back. The glasses still cut 65.6% of it, but 11.9% gets through, far more than at the Brewster angle.', {mode: 1, incidence: 80, glasses: 1, analyzer: 0}),
    glareMeter('Take the glasses off', 'Remove the filter from the beam at the Brewster angle of water.', 'All 3.9% of the reflected light reaches the eye. The glare was never removed from the scene; the glasses simply do not pass it.', {mode: 1, brewster: 1, glasses: 0}),
  ],
  deeper: [
    {title: 'Why the two directions differ', body: 'The Fresnel equations give a separate reflectance for the part of the field along the surface and the part in the plane of the beam. Straight on there is no difference between them and the reflectance is ((n1 − n2)/(n1 + n2))², which the page gives as about 4% for common glass, and which comes to 2.0% for water. Away from straight on, the two curves part company, and the one along the surface always rises faster.'},
    {title: 'The angle where one of them vanishes', body: 'The Brewster page gives that angle as arctan(n2/n1), and says it is approximately 56 degrees for glass and 53 degrees for water. There the reflected and refracted beams are exactly square to one another, and the reflection is completely polarized along the surface. It is the best case for a pair of sunglasses, and the bench reaches it exactly.'},
    {title: 'Why upright is the right way round', body: 'A road and a lake are horizontal, so the direction along their surface is horizontal too. The Brewster page puts it plainly: reflected light from horizontal surfaces is strongly s polarized, and polarized sunglasses use a sheet to block horizontally polarized light. An upright axis therefore blocks the glare and passes the upright half of everything else.'},
    {title: 'A check on the numbers', body: 'The Fresnel page notes that at 45 degrees the reflectance in the plane of the beam is exactly the square of the other one. On water at 45 degrees the bench gives 5.2307% along the surface, and 0.052307 squared is 0.002736, which is the 0.2736% it gives in the plane of the beam. The two halves of the calculation agree where the page says they must.'},
    {title: 'What a real lens cannot do', body: 'The bench’s filter is ideal, so at the Brewster angle it reaches exactly zero. A real sheet leaks: with the Polarizer page’s 38% transmission and 1:500 extinction, an upright sheet still passes 0.006% of the source at that angle, and it dims the rest of the scene to 38% as well. The Sunglasses page dates the first polarized lenses to 1936.'},
    {title: 'Where this stops', body: 'One smooth boundary is not a lake in the wind, a wet road, or a painted car. Metals reflect quite differently and do not polarize glare this way, which is why a polarized lens does little for the flash off chrome. Light scattered by the sky is partly polarized too, which is the other thing these glasses change.'},
  ],
  misconception: 'Polarized sunglasses do not work by being darker. They reject one direction of vibration, which is most of the glare off a horizontal surface and only half of everything else, and that difference is what makes the water look transparent rather than merely dim.',
  limits: `The bench reflects off one smooth, lossless, flat boundary between air and water or air and glass, with fixed indices, and follows one beam to one eye. It leaves out rough and wet surfaces, metals, coatings, several reflections in a row, the polarization of skylight, color, and the eye’s own response. The glasses are drawn as an ideal filter; the real sheet’s figures are quoted in the text alongside. ${sheetLimits}`,
  sources: [sources.brewster, sources.fresnel, sources.sunglasses, sources.polarizer, sources.polarization],
  quiz: {
    question: 'Why does turning your head sideways bring the glare back?',
    options: ['The glasses’ axis then lies along the surface, which is the direction the glare is polarized in.', 'Tilting the lens makes it thinner, so it absorbs less light.', 'The reflection changes direction when the observer moves.'],
    answer: 0,
    explanation: 'At the Brewster angle of water the reflection is entirely polarized along the surface: upright glasses pass 0% of it and glasses turned to 90 degrees pass all 3.9% of it.',
  },
};

// ---------------------------------------------------------------------------
// Binocular prisms: the published binoculars, opened inside the Porro pair.
// ---------------------------------------------------------------------------

const prismProbe = trial(BINOCULARS_DEFAULTS, 'probe'), prismOrientation = trial(BINOCULARS_DEFAULTS, 'orientation'), prismImage = trial(BINOCULARS_DEFAULTS, 'image');

export const binocularPrismsLesson = {
  simple: 'How does a lump of glass with no silvering on it reflect a beam four times without losing it?',
  overview: 'The objective lens of a telescope makes an image that is upside down and the wrong way round. A binocular fixes it with two prisms set square to one another, which fold the beam back on itself four times and hand the image back the right way up. The reflections need no mirror coating: beyond a certain angle, glass will not let light out at all, and the sloping faces of the prism are cut to be struck well beyond it. Trace a beam through the pair, change the glass and tilt the beam until the reflections fail.',
  steps: [
    {title: 'Enter square to the face', body: 'The beam meets the large face head on, so it passes straight in without bending. Nothing is spread into colors, because nothing is refracted at an angle.'},
    {title: 'Meet a sloping face from inside', body: 'Inside the glass the beam arrives at a sloping face at an angle. A beam trying to leave dense glass for air bends away from the normal, and past a certain angle it cannot leave at all.'},
    {title: 'Turn the beam twice', body: 'The two sloping faces of one prism send the beam back the way it came, offset to one side, with one of the two image directions reversed.'},
    {title: 'Turn it twice more', body: 'The second prism, set square to the first, does the same to the other direction. Four reflections in all turn the image through half a turn, which is exactly what the objective did to it.'},
    {title: 'Leave with the image upright', body: 'The beam leaves parallel to the way it came in, and the eyepiece looks at an image that is finally the right way up and the right way round.'},
  ],
  parts: [
    {name: 'Inside the Porro pair', role: 'One beam traced through real glass: entering, reflecting at each face it meets, and leaving. The reflections happen only where the angle allows them.'},
    {name: 'Image erection', role: 'The symbols marking the orientation at each stage, shown only when the beam actually completes the four-reflection route.'},
    {name: 'Two optical channels', role: 'The whole instrument the prisms sit in, with the objective and the eyepiece that the folded path connects.'},
    {name: 'Real images', role: 'The upright image the prisms hand to the eyepiece, once the reflections have done their work.'},
  ],
  tryIt: [
    prismProbe('Trace the four reflections', 'Open the prism closeup with the beam straight down the axis.', 'The beam reflects 4 times and every face is struck at 45 degrees, well past the 41.8 degrees at which this glass stops letting light out. It travels 160 mm in glass and 40 mm in air.', {mode: 1, index: 1.5, angle: 0}),
    prismProbe('Use glass that is not dense enough', 'Set the refractive index to 1.4.', 'Its limit rises to 45.6 degrees, just past the 45 degrees the faces are struck at, so the beam refuses to reflect and leaves through the first sloping face. The count falls to 0.', {mode: 1, index: 1.4, angle: 0}),
    prismProbe('Use denser glass', 'Set the refractive index to 1.6.', 'The limit drops to 38.7 degrees and the four reflections come back. The beam takes longer in optical terms, 296 mm against 280 mm, because denser glass slows it more.', {mode: 1, index: 1.6, angle: 0}),
    prismProbe('Tilt the beam until a reflection fails', 'Tilt the probe as far as it will go toward the first face.', 'The smallest angle of incidence drops to 41.0 degrees, just under the limit, and that face lets the beam out instead of turning it. One bad angle costs the whole path.', {mode: 1, index: 1.5, angle: -6}),
    prismProbe('Find the stray reflection', 'Tilt the probe to 4 degrees.', 'The beam now reflects 5 times, picking up an extra bounce off a side wall. It comes out, but not with the orientation the design intended, so the orientation symbols are withheld.', {mode: 1, index: 1.5, angle: 4}),
    prismOrientation('Watch the image turn', 'Trace the straight beam again and look at the orientation symbols.', 'Each pair of reflections reverses one of the two image directions, and the pair of prisms together turns the image through 180 degrees.', {mode: 1, index: 1.5, angle: 0}),
    prismImage('See what the prisms hand over', 'Open the two-channel view.', 'Every one of the 9 sampled rays gets through both prisms, and the eyepiece is given an upright image magnified 8 times.', {mode: 0, index: 1.5}),
  ],
  deeper: [
    {title: 'The angle past which glass will not let go', body: 'The Total internal reflection page gives the critical angle as arcsin(n2/n1), and says it is about 48.6 degrees from water to air and about 41.8 degrees from common glass to air. A Porro prism is cut 45, 90 and 45 degrees, so its sloping faces are met at 45 degrees, safely past the glass figure and comfortably short of the water one. Below the critical angle the light simply leaves, which is what the failing settings on this page show.'},
    {title: 'The glass a good binocular uses', body: 'The Crown glass page says BK7 is the common crown, glass code 517642, and that BAK-4 barium crown, code 569560, "has a higher index of refraction than BK7, and is used for prisms in high-end binoculars", where it gives better image quality and a round exit pupil. SCHOTT’s own data sheets put N-BK7 at 1.5168 and N-BAK4 at 1.56883 in the middle of the spectrum, which give critical angles of 41.2 and 39.6 degrees. Against the 45 degrees the faces are struck at, that is a margin of 3.8 degrees for the one and 5.4 degrees for the other.'},
    {title: 'Four reflections, and why four', body: 'The Porro page says one prism reflects the beam twice and sends it back "in the opposite direction offset from its entry point", and that a pair of them gives four reflections. An even number of reflections leaves the image the right way round rather than mirrored, and the two prisms set square to one another reverse one image direction each, which is the half turn that cancels the objective’s.'},
    {title: 'What the faces cost', body: 'Total internal reflection is free, but getting in and out is not. Each glass to air face reflects some light straight back: 4.2% for N-BK7 and 4.9% for N-BAK4 at normal incidence. The Porro page notes that a pair with an air gap has four such surfaces, which pass 84.2% and 81.8% of the light between them. The denser glass loses slightly more here, so its advantage is the wider margin over the critical angle, not brightness.'},
    {title: 'What the Abbe number says', body: 'A glass code carries two numbers: the index and the Abbe number, which is (nd − 1)/(nF − nC) and says how little the glass spreads colors. SCHOTT gives 64.17 for N-BK7 and 55.98 for N-BAK4, so the denser prism glass disperses more. It matters less than it might, because the beam enters and leaves the Porro faces square, and a prism used that way does not disperse.'},
    {title: 'The groove across the hypotenuse', body: 'The Porro page warns that rays off the axis can catch the long face and come out after a third reflection, adding stray light and washing out contrast. The cure is mechanical: good prisms carry a groove about 1.5 mm deep ground across the middle of that face to swallow those rays. The stray path this page finds when the beam is tilted is the same defect in miniature.'},
  ],
  misconception: 'The prism faces are not mirrors and carry no silvering. They reflect only because the beam inside the glass meets them beyond the critical angle, which is why a prism cut from glass that is not dense enough, or a beam tilted too far, simply leaks the light away instead of reflecting it.',
  limits: 'The beam is traced through real prism solids with refraction and total internal reflection at every face, but only the transmitted branch is drawn where a reflection fails: the partial reflection that always accompanies refraction is not modeled, nor the phase shift that total internal reflection adds, nor coatings, nor absorption in the glass. The objective and eyepiece are ideal thin lenses, the sampled rays are a narrow pencil rather than a full aperture, and the index is a control rather than a dispersion curve, so the two glasses named in the text are quoted from their data sheets rather than set on the bench. Colors, diffraction and the eye are all left out.',
  sources: [sources.porro, sources.tir, sources.crown, sources.schott, sources.prism],
  quiz: {
    question: 'What makes the sloping faces of a Porro prism reflect without any coating?',
    options: ['The beam meets them from inside the glass at an angle past the one beyond which light cannot leave.', 'The polished glass surface reflects everything that reaches it, at any angle.', 'The prism is silvered on its sloping faces during manufacture.'],
    answer: 0,
    explanation: 'The faces are struck at 45 degrees. Glass at 1.5 stops letting light out past 41.8 degrees, so the reflection is total; glass at 1.4 does not stop until 45.6 degrees, and there the beam escapes instead.',
  },
};

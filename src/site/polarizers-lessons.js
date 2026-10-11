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
// Polarizing filter: keep the whole optical path in each comparison.
// ---------------------------------------------------------------------------

const filterTrial = trial({power: 100, input: 0, inputAngle: 0, first: 0, analyzer: 90, middle: 45, insert: 1, magnetic: 0}, 'train');

export const polarizingFilterLesson = {
  simple: 'Why can adding a third polarizing filter make a dark beam brighter?',
  overview: 'Follow light from the gold source through the marked filter axes to the disk on the right. Each sheet transmits the electric-field component along its axis and absorbs the perpendicular component. A crossed pair leaves no transmitted field. Insert a filter between them and the field reaching the last sheet can change direction, allowing some light through. Press Play to reveal the path, then compare the power bars.',
  steps: [
    {title: 'Find the field', body: 'Red arrows show electric-field directions across the beam. The source fan represents separate waves with unrelated phases. Their powers add; the fan is not one rotating field.'},
    {title: 'Read the first filter', body: 'The blue double arrow marks the transmission axis. The red field leaving the sheet lies along that axis. For unpolarized input, the first ideal filter transmits half the source power.'},
    {title: 'Turn the analyzer', body: 'The last filter tests the field that reaches it. Parallel axes pass the whole incoming polarized beam; a right angle blocks it. Intermediate angles transmit only a component.'},
    {title: 'Insert the middle filter', body: 'Keep the outer axes crossed and put the middle axis halfway between them. The surviving field now has a component along the last axis, so the detector brightens.'},
    {title: 'Account for the energy', body: 'Compare every bar on the same full-source scale. No filter increases the power it receives. The three-filter output is brighter only compared with the crossed two-filter arrangement.'},
  ],
  parts: [
    {name: 'Input light', role: 'The gold source and red field markers. Choose an unpolarized ensemble or a single linear polarization.'},
    {name: 'First polarizer', role: 'The first sheet prepares light along its transmission axis.'},
    {name: 'Inserted polarizer', role: 'The removable middle sheet projects the incoming field onto a different axis.'},
    {name: 'Analyzer', role: 'The final sheet transmits the component along its own axis.'},
    {name: 'Transmitted light meter', role: 'The right-hand disk brightens with transmitted power once the trace reaches it.'},
    {name: 'Power comparison', role: 'Bars compare input and transmitted powers on a fixed full-source scale. The readings also report absorbed power.'},
  ],
  tryIt: [
    filterTrial('Align two filters', 'Press Play with the middle filter removed and both remaining axes vertical.', 'The first filter passes 50% of the unpolarized source. The aligned ideal analyzer passes all of that, so the detector also reads 50%.', {insert: 0, analyzer: 0}),
    filterTrial('Cross the two filters', 'Press Play with the first axis vertical and the analyzer horizontal.', 'The first filter still passes 50%, but no field remains after the analyzer. Detected power is 0%.', {insert: 0, analyzer: 90}),
    filterTrial('Turn the analyzer halfway', 'Press Play with the analyzer at 45 degrees.', 'The analyzer passes half of what reaches it, leaving 25% of the original source.', {insert: 0, analyzer: 45}),
    filterTrial('Slip a third filter between crossed ones', 'Press Play with the middle axis at 45 degrees and the outer axes crossed.', 'Power falls from 50% after the first filter to 25% after the middle and 12.5% at the detector. The added filter changes the field reaching the analyzer.', {insert: 1, middle: 45}),
    filterTrial('Turn the middle filter nearer the first', 'Press Play with the middle axis at 30 degrees.', 'The middle filter leaves 37.5% of the source; the analyzer leaves 9.375%, displayed as 9.38%.', {insert: 1, middle: 30}),
    filterTrial('Turn it nearer the analyzer instead', 'Press Play with the middle axis at 60 degrees.', 'The middle filter leaves 12.5% of the source; the analyzer again leaves 9.375%. The two projection factors exchange places.', {insert: 1, middle: 60}),
    filterTrial('Line the middle filter up with the first', 'Press Play with the first and middle axes vertical and the analyzer horizontal.', 'The middle filter leaves the field unchanged. The last filter blocks it, so detected power returns to 0%.', {insert: 1, middle: 0}),
    filterTrial('Send in aligned polarized light', 'Press Play with vertical linear input and two vertical filters.', 'Both filters pass the whole incident field. Detected power is 100%; the half-power rule applies to unpolarized input.', {input: 1, inputAngle: 0, insert: 0, analyzer: 0}),
    filterTrial('Project an angled input field', 'Press Play with linear input at 45 degrees and both filters vertical.', 'The first sheet changes the field direction and halves its power. The aligned analyzer makes no further change, so detected power is 50%.', {input: 1, inputAngle: 45, insert: 0, analyzer: 0}),
  ],
  deeper: [
    {title: 'Malus’s law is a projection', body: 'For a linearly polarized beam, the transmitted field amplitude is E cos θ, where θ is measured from the filter axis. Power follows amplitude squared: I = I0 cos²θ. Unpolarized input averages over orientations, giving one half for the first ideal filter.'},
    {title: 'A real film has loss and leakage', body: 'Edmund Optics lists 44.2 ±1.5% single-sheet transmission, 38.6% parallel-pair transmission and less than 0.02% crossed-pair transmission for its high-transmission polymer film. These product specifications illustrate real loss and finite rejection; they are not this model’s coefficients or universal values for plastic polarizers. Performance depends on the product, wavelength and incidence angle.'},
    {title: 'The third filter supplies no energy', body: 'With unpolarized input, crossed outer axes and middle angle θ from the first axis, the final source fraction is cos²θ·sin²θ/2. At 45 degrees this gives 12.5%; at 30 or 60 degrees it gives 9.375%. Each multiplication reduces the incoming power.'},
    {title: 'Why an absorbing sheet has an axis', body: 'Aligned molecules respond more strongly to one electric-field direction than another. In the long-molecule picture described by OpenStax, the parallel component drives charge motion and is absorbed. The transmission axis is perpendicular to the molecular alignment. The model marks that optical axis; it does not draw literal slits or molecules.'},
    {title: 'Other polarizers redirect light', body: 'This bench represents absorbing sheets. Other polarizers separate the unwanted polarization by reflection or by sending it along another path. A missing transmitted component does not always mean absorption in those devices.'},
    {title: 'An axis has no preferred end', body: 'Rotating an axis by 180 degrees gives the same power transmission. With unpolarized input, rotating all filter axes together also leaves every power reading unchanged. With linear input, its angle relative to the first filter matters too.'},
  ],
  misconception: 'A polarizing filter does not merely pick out rays already aligned with it. It transmits a component of each incoming field. That projection can change the polarization presented to the next filter.',
  limits: 'The bench uses ideal absorbing linear polarizers: perfect rejection across each axis and no loss along it. Eight equally weighted, incoherent orientations represent unpolarized input. Red fields, optional blue cB fields and gold propagation arrows use illustrative scales; eight seconds reveal a teaching construction, not light travel time. Power readings predict the completed arrangement even before the trace reaches the detector. Real-film specifications are a separate comparison. Molecules, spectra, wavelength dependence, scattering, reflections at film surfaces and heating are not simulated.',
  sources: [
    {title: 'OpenStax: University Physics, Polarization', url: 'https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization'},
    {title: 'Edmund Optics: Polarizer Selection Guide', url: 'https://www.edmundoptics.com/knowledge-center/application-notes/optics/polarizer-selection-guide/'},
    {title: 'Edmund Optics: High Transmission Linear Polarizing Film (XP44-40)', url: 'https://www.edmundoptics.com/p/50mm-dia-high-transmission-linear-polarizing-film-xp44-40/45831/'},
  ],
  quiz: {
    question: 'Why does slipping a third filter between two crossed filters let light through?',
    options: ['The middle filter projects the light onto a new direction, which has a component along the last axis.', 'The middle filter adds energy to the beam as it passes.', 'The middle filter restores energy absorbed by the first filter.'],
    answer: 0,
    explanation: 'The middle filter changes the field reaching the last filter. With the middle axis at 45 degrees, the ideal train passes 12.5% of the source. Every sheet still absorbs or transmits only the power it receives.',
  },
};

// ---------------------------------------------------------------------------
// Liquid crystals: the published liquid crystal display, opened on its directors.
// ---------------------------------------------------------------------------

const crystalTrial = trial(LCD_DEFAULTS, 'system');

export const liquidCrystalsLesson = {
  simple: 'How can a liquid change the way light vibrates, and let a voltage write a dark digit?',
  overview: 'This twisted-nematic cell uses a liquid whose molecules share a preferred alignment. The green rods show that local direction at different depths. Surface treatments turn the alignment from one face to the other, so suitable polarized light follows the twist. A strong electric field changes the bulk alignment and stops that rotation. The surrounding polarizers turn this change into a bright or dark region. Keep the expanded cell and its assembled display face in view, then trace the light with Play.',
  steps: [
    {title: 'Find the local alignment', body: 'The rods represent the director, the average molecular axis in a small region. Molecules can flow without occupying fixed crystal positions. These rods are orientation markers, not a spiral pipe that light travels along.'},
    {title: 'Twist the cell between its faces', body: 'The alignment layers at the two faces hold the director in perpendicular directions. In the undriven cell, the alignment changes gradually across the gap. This is the twisted-nematic arrangement used here, not a property of every liquid crystal.'},
    {title: 'Follow the polarization', body: 'The first polarizer prepares a linear electric-field direction, marked in red. Under polarization-following conditions, that direction turns with the director through the undriven layer. It then matches the crossed second polarizer and passes through.'},
    {title: 'Apply an electric field', body: 'The driver applies different voltages to the transparent SEGMENT and COMMON electrodes. This conventional material favors alignment along the field axis. The ideal strongly driven bulk rods point along the optical path, leaving the polarization unchanged. The crossed analyzer then blocks the light.'},
    {title: 'Return light from the mirror', body: 'With ambient illumination, gold arrows trace the outward path to the rear reflector. Blue arrows trace the return toward the observer at the left. In the undriven cell, the reverse passage undoes the outward polarization turn so light can exit the front polarizer. The separate face on the right shows the resulting appearance.'},
    {title: 'Use a separate backlight', body: 'Switch Illumination to Backlight. The reflector is replaced by a light source behind the cell. Light now travels from the rear filter through the liquid crystal and out through the front filter. Available light controls that illumination independently of the segment driver.'},
    {title: 'Write with separate regions', body: 'In Seven-segment digit mode, each region uses the same optical switch. The blue outline identifies the region expanded on the left. Select a different segment to inspect its own command and alignment, then change Digit to write another number.'},
  ],
  parts: [
    {name: 'Liquid-crystal directors', role: 'Green rods show the twisted undriven arrangement or the ideal field-aligned bulk endpoint.'},
    {name: 'Front and rear polarizers', role: 'Blue axis markers show the directions each filter transmits. Crossing or aligning the filters changes which molecular state looks bright.'},
    {name: 'Transparent electrodes and connections', role: 'Conducting layers on opposite sides of the liquid establish the electric field. Their voltage difference matters, not either electrode potential alone.'},
    {name: 'Alternating driver and waveform rows', role: 'The rows show COMMON, SEGMENT, and their difference. Gold markers select one electrical half-cycle; the purple arrow shows the signed field. Vd denotes a sufficient drive amplitude, not a device rating.'},
    {name: 'Rear reflector or backlight', role: 'The reflector returns outside light. The backlight supplies light from behind. The liquid crystal produces neither source.'},
    {name: 'Display face and power bars', role: 'The face shows the selected region or complete digit. Input and Output bars share one full-source scale. Readings predict the finished output while playback reveals the path.'},
  ],
  tryIt: [
    crystalTrial('Look at the undriven twist', 'Press Play with the cell unaddressed and the filters crossed.', 'The director turns through 90 degrees. Light reaches the mirror and returns through the cell, giving 50% of the full source at the observer.'),
    crystalTrial('Switch the voltage on', 'Press Play with an addressed cell and a connected driver.', 'The bulk rods align with the field. The rear crossed filter blocks the outward beam before it reaches the mirror, leaving 0% output.', {drive: 1}),
    crystalTrial('Take the driver away', 'Press Play with the addressed command retained but its driver disconnected.', 'No voltage difference remains. The twist returns and output becomes 50%, even though the command still says Addressed.', {drive: 1, battery: 0}),
    crystalTrial('Reverse the field', 'Press Play with an addressed cell in the second electrical half-cycle.', 'The electrode levels swap and the purple field arrow reverses. The molecular axis and 0% output remain unchanged.', {drive: 1, polarity: 1}),
    crystalTrial('Turn the rear filter parallel', 'Press Play with parallel filters and an unaddressed cell.', 'The twisted cell now presents the wrong polarization to the rear filter. Output is 0%, despite the unchanged director twist.', {analyzer: 1}),
    crystalTrial('Take the rear filter away', 'Press Play with the rear filter removed and the cell addressed.', 'Output is 50%. Change Cell command to Unaddressed and it stays the same: without the analyzer, the two ideal states no longer produce contrast.', {analyzer: 2, drive: 1}),
    crystalTrial('Write a digit', 'Press Play to write three and expand its top segment a.', 'Five regions, a, b, c, d and g, go dark against a background at 50%. The blue outline links the top region to its expanded field-aligned cell.', {mode: 1, digit: 3}),
    crystalTrial('Make the parallel cell bright', 'Press Play with parallel filters and the cell addressed.', 'The field-aligned bulk leaves polarization unchanged. It now matches both filters, giving 50% output.', {analyzer: 1, drive: 1}),
    crystalTrial('Light the cell from behind', 'Press Play with a backlight and the cell unaddressed.', 'Light enters from the rear, follows the reverse director twist and exits the front filter. Output is 50%; there is no mirror round trip.', {lighting: 1}),
    crystalTrial('Block the backlight', 'Press Play with the backlit cell addressed.', 'Without the polarization turn, light cannot pass the crossed front filter. Output is 0%.', {lighting: 1, drive: 1}),
    crystalTrial('Remove the illumination', 'Press Play with no available light and a commanded digit.', 'The electrical drive still addresses five regions, but the face and background both have 0% optical output. The LCD cannot illuminate itself.', {mode: 1, power: 0}),
    crystalTrial('Raise both electrodes together', 'Press Play with the unaddressed cell in the second half-cycle.', 'COMMON and SEGMENT both read +Vd. Their difference is zero, so the twist remains and output stays at 50%.', {polarity: 1}),
    crystalTrial('Inspect an unaddressed segment', 'Press Play to write three while expanding upper-left segment f.', 'The other five commanded regions darken. Segment f remains twisted, has no field, and returns 50%, matching the background.', {mode: 1, digit: 3, segment: 5}),
  ],
  deeper: [
    {title: 'Order without fixed positions', body: 'Nematic order describes an average axis, with equivalent opposite directions. It does not require each molecule to point identically or to occupy a fixed site. Boundary alignment and elasticity organize the bulk; a liquid crystal is not automatically twisted just because it is liquid.'},
    {title: 'When light follows the twist', body: 'The ideal quarter-turn picture is a useful operating limit. Birefringence, thickness and wavelength determine how closely the optical polarization follows the changing director. Outside that limit, the emerging polarization can be elliptical and transmission varies with wavelength. The LCD screen lesson explores a more detailed layer calculation.'},
    {title: 'Phase delay is different from rotation', body: 'For a uniform retarder of thickness d, the phase delay is δ = 2πΔn·d/λ, where Δn is the refractive-index difference and λ the vacuum wavelength. A quarter-wave plate has a quarter-cycle phase delay, not a quarter-turn rotation of linear polarization. With equal field components along its fast and slow axes, it converts linear input to circular output. Its thickness λ/(4Δn) is not a design formula for the twisted cell shown here.'},
    {title: 'Why field reversal preserves alignment', body: 'In the positive dielectric-anisotropy material assumed here, either field polarity favors the same director axis. Reversing the purple arrow need not turn the rods end for end. A real driven cell retains surface anchoring and a continuous profile near its faces. The rods shown here represent two ideal bulk states.'},
    {title: 'What the electrical cycle means', body: 'COMMON alternates between zero and Vd. An unaddressed SEGMENT follows it; an addressed SEGMENT uses the opposite levels. The addressed difference therefore alternates between +Vd and −Vd, with zero cycle mean and RMS Vd. Practical LCD drivers avoid a sustained DC component. Here the half-cycle selector inspects the waveform; Play reveals the optical path.'},
    {title: 'What sets a real display’s contrast', body: 'A real cell has a material-dependent threshold and an optical response that varies with temperature, voltage and viewing direction. Polarizers, electrodes, glass and reflectors also lose light. This model’s bright state preserves half the unpolarized input after the first ideal polarizer; it is not a measured efficiency or a calibrated voltage-to-brightness curve.'},
  ],
  misconception: 'In this ideal TN switch, the liquid crystal does not become black. It changes the polarization delivered to a filter, which can then reject the light. Removing the analyzer removes the modeled contrast between the two states.',
  limits: 'Ideal normally bright twisted-nematic endpoints at normal incidence. The undriven layer follows the director twist; the strongly driven bulk leaves polarization unchanged. Surface anchoring, birefringent phase, partial alignment, thresholds, gray levels, absorption, wavelength dependence and molecular response time are not computed. Polarizers and mirror are ideal, with a reciprocal return on the same axis. The green rods, layer spacing, field arrows and display shade are schematic. Red input directions represent incoherent light whose powers add. Vd is a symbolic sufficient drive amplitude. The waveform shows balanced static drive, not multiplex addressing. Eight-second playback constructs the light path; it is not light travel or switching time. This monochrome example does not represent every liquid-crystal technology.',
  sources: [
    {title: 'Texas Instruments: Software Glass LCD Driver, operation and static-drive waveforms', url: 'https://www.ti.com/tw/lit/pdf/slaa516'},
    {title: 'Gheorghiu and Panasyuk: light transmission through a twisted nematic slab', url: 'https://arxiv.org/abs/1705.02683'},
    {title: 'Newport: Polarization and Polarization Control, wave plates', url: 'https://www.newport.com/medias/sys_master/images/images/hd2/h68/8797241704478/Polarization-and-Polarization-Control-App-Note-3.pdf'},
    {title: 'Ansys Optics: twisted-nematic director and polarization endpoints', url: 'https://optics.ansys.com/hc/en-us/articles/49648372943635-Polarization-properties-of-twisted-nematic-liquid-crystal'},
  ],
  related: ['Liquid crystal display', 'LCD screen'],
  quiz: {
    question: 'Why does the addressed cell become dark between crossed polarizers?',
    options: ['Its field-aligned bulk stops turning polarization, so the crossed filter blocks the light.', 'The liquid crystal turns black and absorbs the light itself.', 'The electrode voltage switches off the external light source.'],
    answer: 0,
    explanation: 'The field changes molecular alignment. In this ideal endpoint, light no longer receives the polarization turn needed to pass the crossed analyzer.',
  },
};

// ---------------------------------------------------------------------------
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

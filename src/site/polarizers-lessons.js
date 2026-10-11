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

const glareTrial = trial({power: 100, analyzer: 0, incidence: 55, brewster: 1, material: 0, glasses: 1, magnetic: 0}, 'glare');

export const polarizingSunglassesLesson = {
  simple: 'Why do polarized sunglasses reduce reflected glare more than ordinary unpolarized light?',
  overview: 'Follow the gold source to the flat surface, then follow the reflected ray through the glasses toward the eye. Reflection treats two electric-field directions differently. Near the Brewster angle, almost all reflected power has the horizontal s direction. The glasses can reject that glare while still passing half of unpolarized light in this ideal model. Press Play to reveal the connected paths, then compare the bars and power readings.',
  steps: [
    {title: 'Start with unpolarized light', body: 'The source supplies equal average power in s and p polarization. Long arrows trace ray paths; short arrows across the reflected ray show electric-field directions. The green s field is perpendicular to the incidence plane and parallel to the flat surface. The red p field lies in the incidence plane. They are separate incoherent contributions, not one combined electric-field arrow.'},
    {title: 'Reflect unequal shares', body: 'The surface reflects a different fraction of each incident contribution. The rest refracts into the material. At normal incidence the reflected shares are equal. At oblique incidence, s reflection is stronger.'},
    {title: 'Find the Brewster angle', body: 'At this incidence the reflected p contribution vanishes. All reflected power is s polarized, and the reflected and refracted rays meet at a right angle. Choosing water or glass changes this angle.'},
    {title: 'Select the transmission axis', body: 'The blue double arrow on the lens marks the direction it transmits. Zero selects p polarization, perpendicular to the reflected ray within its incidence plane, and blocks the horizontal s glare. At the Brewster angle the ideal filter therefore leaves no light for the eye.'},
    {title: 'Compare the same reflected beam', body: 'Turn the axis sideways and the rejected glare returns. The bars compare power before and after the glasses relative to that reflected beam. The numerical detected-power reading uses the full-source reference, so a small reflected beam is not mistaken for the whole source.'},
  ],
  parts: [
    {name: 'Unpolarized source', role: 'The gold source shines on one smooth surface. Its power setting scales every optical power without changing reflectance or ray direction.'},
    {name: 'Water or glass surface', role: 'One flat, lossless boundary. The incident ray, surface normal, reflected ray, and refracted ray remain connected as incidence changes.'},
    {name: 'Polarizing sunglasses', role: 'The blue lens arrow marks its transmission axis. One traced ray passes through one lens; the second ring gives context. Removing the glasses leaves the reflection itself unchanged.'},
    {name: 'Reflected-field arrows', role: 'Short transverse green s and red p arrows show separate reflected contributions. Long arrows trace the rays. Optional short blue arrows show their magnetic-field directions, perpendicular to both the electric field and propagation.'},
    {name: 'Observer and glare meter', role: 'The eye follows the reflected ray. Both bars use the before-glasses beam as their reference; absolute power appears in the readings.'},
  ],
  tryIt: [
    glareTrial('Look at water at the angle where the glare is purest', 'Use water at its Brewster angle with the transmission axis set to zero.', 'Incidence is 53.1 degrees. The surface reflects 3.86% of full-source power, entirely s polarized. The ideal glasses pass 0% and reject 100% of that reflected beam.'),
    glareTrial('Turn your head sideways', 'Keep water at its Brewster angle and turn the transmission axis to 90 degrees.', 'All 3.86% of full-source power in the reflected beam now reaches the eye. Glare rejection falls to 0%.', {analyzer: 90}),
    glareTrial('Choose a glass surface', 'Replace water with a smooth glass boundary and keep Brewster incidence.', 'The angle rises to 56.3 degrees. Glass reflects 7.40% of full-source power here, all s polarized. The zero-degree transmission axis still passes 0%. This models glass, not a wet road.', {material: 1}),
    glareTrial('Look a little off that angle', 'Use water at a manual incidence of 55 degrees with the zero-degree transmission axis.', 'The reflected s contribution is 4.2773% of full-source power and the p contribution is 0.0130%. Together they give 4.2903%. The glasses pass only the p contribution and reject 99.7% of the reflected beam.', {brewster: 0, incidence: 55}),
    glareTrial('Look straight down into the water', 'Set manual incidence to zero, square to the water surface.', 'Water reflects 2.01% of full-source power, split equally between s and p. The ideal glasses pass 1.00%, half the reflected beam. Turning the transmission axis cannot improve that rejection. The incident and reflected rays overlap in this diagram.', {brewster: 0, incidence: 0}),
    glareTrial('Look right along the water', 'Set manual incidence to 80 degrees, close to grazing.', 'The surface reflects 34.69% of full-source power. The glasses reject 65.6% of that beam, but 11.93% of full-source power still reaches the eye.', {brewster: 0, incidence: 80}),
    glareTrial('Take the glasses off', 'Remove the glasses while keeping water at its Brewster angle.', 'All 3.86% of full-source power in the reflection reaches the eye. The surface reflection stays the same; filtering had removed power farther along its path.', {glasses: 0}),
    glareTrial('Turn the axis halfway', 'Keep Brewster incidence on water and set the transmission axis to 45 degrees.', 'The ideal filter transmits 1.93% of full-source power, half the reflected beam, and rejects the other 50%.', {analyzer: 45}),
    glareTrial('Remove the illumination', 'Turn source power off while retaining the Brewster arrangement.', 'Incident, reflected, and detected powers are 0%. No optical field arrows or power bars remain. Polarization and rejection read unavailable because there is no reflected beam to compare.', {power: 0}),
    glareTrial('Halve the source with the axis sideways', 'Set source power to 50% and turn the transmission axis to 90 degrees.', 'The reflected and detected powers both fall to 1.93% of the fixed full-source reference. The before and after bars still match because the glasses transmit the entire reflected beam.', {power: 50, analyzer: 90}),
    glareTrial('Compare electric and magnetic directions', 'Show magnetic-field arrows for water at a manual incidence of 55 degrees.', 'The blue arrows are perpendicular to the electric fields and reflected ray. Showing them does not change power: the glasses still transmit 0.0130% of full-source power.', {brewster: 0, incidence: 55, magnetic: 1}),
  ],
  deeper: [
    {title: 'Reflectance is not total-source power', body: 'A reflectance coefficient applies only to its own incident polarization. An unpolarized source divides power equally between s and p, so each reflected contribution is its coefficient times half the selected source power. Add those contributions to obtain total reflected power. This distinction explains why the s reflectance reading is twice the reflected s contribution when source power is at its full setting.'},
    {title: 'Where the special angle comes from', body: 'Snell’s law relates incidence and refraction. The Fresnel equations then give s and p reflection from the refractive indices and those angles. The p coefficient vanishes when the tangent of incidence equals the second index divided by the first. At this Brewster angle, the reflected and refracted rays are perpendicular.'},
    {title: 'Project each contribution through the lens', body: 'Malus’s law multiplies linearly polarized power by the squared cosine of its angle to the transmission axis. Apply it separately to the incoherent s and p contributions, then add their transmitted powers. Turning the axis changes the field projection after reflection; it does not change how much the surface reflected.'},
    {title: 'Why the surroundings also become dimmer', body: 'An ideal polarizer passes half of unpolarized incident power at every axis angle. Strongly s-polarized glare can lose a much larger fraction when its field is perpendicular to the transmission axis. Light from an actual scene need not be unpolarized, so the change varies across the view. Only one reflected beam is drawn here.'},
    {title: 'What a real lens changes', body: 'Real polarizers have finite extinction and transmission loss, so they need not reach the ideal dark state or transmit all power aligned with their axis. Absorptive polarizers dissipate the rejected component. Actual sunglasses add material, tint, and coatings; this experiment supplies no product-specific transmission or protective rating.'},
    {title: 'Read the construction as a diagram', body: 'The rays show directions and the field arrows show orientations with illustrative lengths. They do not show the travel time of light or the physical size of a wave. The source, interface, lens, eye, and meter stay in view while the construction is revealed. The source-off case has no reflected-power reference, so its bars vanish. The calculation starts with unpolarized light at the surface and filters only the returning beam. At normal incidence the two ray paths overlap; source and eye are diagram markers, and their obstruction or illumination through the lens is not modeled.'},
  ],
  misconception: 'Polarized sunglasses still dim unpolarized surroundings. Their advantage for suitable reflected glare comes from rejecting its preferred field direction by a larger fraction.',
  limits: 'One unpolarized beam meets one smooth, flat, lossless air-to-water or air-to-glass boundary with fixed refractive indices. The lens is an ideal linear polarizer applied only to the returning ray. Illumination at the surface is assumed unpolarized; source and eye are diagram markers. Obstruction and illumination through the lens are omitted. Rough surfaces, wet roads, metals, coatings, multiple reflections, wavelength dependence, and the visual response of an eye are outside this model. The source setting uses a fixed full-power reference; the bars instead normalize to the reflected beam when that beam exists. Playback reveals a ray construction and does not simulate optical flight time.',
  sources: [
    {title: 'MIT OpenCourseWare: Electromagnetic waves, reflection and refraction', url: 'https://ocw.mit.edu/courses/6-007-electromagnetic-energy-from-motors-to-lasers-spring-2011/4c2d4e2527151fd840c3a725bae3d13a_MIT6_007S11_lec34.pdf'},
    {title: 'Newport: Polarization Control with Optics', url: 'https://www.newport.com/n/polarization-control-with-optics'},
    {title: 'Edmund Optics: Introduction to Polarization', url: 'https://www.edmundoptics.com/knowledge-center/application-notes/optics/introduction-to-polarization'},
  ],
  quiz: {
    question: 'Why does turning the glasses sideways restore the glare at the Brewster angle?',
    options: ['The transmission axis becomes parallel to the reflected s field, so the filter passes it.', 'The lens becomes thinner and absorbs less light.', 'Turning the glasses creates a stronger surface reflection.'],
    answer: 0,
    explanation: 'The reflected beam stays the same. A perpendicular transmission axis blocks its s field; a parallel axis transmits it. Rotation changes the projection at the glasses, not the reflection at the surface.',
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

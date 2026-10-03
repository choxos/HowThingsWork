import {LIQUID_GLASS_DEFAULTS} from './liquid-thermometer-physics.js';

const trial = (title, instruction, observe, values = {}, time = 60, part = 'system', view = 'front') => ({title, instruction, observe, values: {...LIQUID_GLASS_DEFAULTS, ...values}, reset: true, initialState: {time}, part, isolate: ['chart', 'bulb', 'chamber'].includes(part), view});

export const liquidThermometerLesson = {
  simple: 'How does a tiny change in liquid volume become a visible temperature reading? Change the surroundings, compare the bore, and watch where the liquid goes.',
  overview: 'A sealed glass reservoir joins a narrow capillary and a small upper chamber. Warming expands the liquid more than the glass, so the liquid surface rises. Cooling reverses the movement. The scale is calibrated for the chosen liquid and bore. The instrument takes time to approach the temperature around it; its column shows its own temperature during that wait. This illustrative model lets you choose the response time directly.',
  steps: [
    {title: 'Start with one continuous liquid', body: 'The lower bulb and the filled part of the capillary share a connected cavity. Liquid in both regions contributes to the total volume.'},
    {title: 'Change the surroundings', body: 'The target temperature changes at the start. The instrument approaches it gradually. A shorter chosen time constant makes this comparison respond faster.'},
    {title: 'Expand relative to the glass', body: 'Glass expands too, including the space inside it. The liquid expands more, displacing the surface upward. Cooling makes the surface retreat.'},
    {title: 'Read a calibrated level', body: 'The scale converts height into temperature. A thinner bore gives more movement for the same displaced volume, but fits a smaller temperature span along the stem.'},
    {title: 'Recognize a limit', body: 'A surface inside either reservoir has no capillary reading. At mercury’s freezing boundary, this liquid-only model stops; it does not simulate a frozen column.'},
  ],
  parts: [
    {name: 'Lower bulb', role: 'Holds most of the liquid and joins the capillary continuously.'},
    {name: 'Capillary and column', role: 'Turn a small volume change into a large height change.'},
    {name: 'Upper expansion chamber', role: 'Receives liquid above the calibrated capillary span.'},
    {name: 'Liquid surface', role: 'Provides the level to compare with the scale.'},
    {name: 'Calibrated scale', role: 'Matches the selected liquid and bore and expands with the glass.'},
    {name: 'Temperature response', role: 'Compares liquid temperature with the surroundings over time. This is an explanatory chart, not a physical part.'},
  ],
  tryIt: [
    trial('A minute in the cold', 'Open the state after one minute in surroundings at 0 °C.', 'The column reads 7.36 °C. The instrument is still warmer than its surroundings.'),
    trial('A minute in the warmth', 'Compare the same elapsed minute with surroundings at 60 °C.', 'The column reads 45.28 °C. A 14.72 °C gap remains.', {surroundings: 60}),
    trial('A faster response', 'Choose a 15 s time constant and inspect the same minute.', 'The reading is 0.37 °C. A shorter chosen time constant closes the gap sooner.', {response: 15}),
    trial('A slower response', 'Choose a 120 s time constant and inspect the same minute.', 'The reading is still 12.13 °C. The bore and liquid have not changed.', {response: 120}),
    trial('Already at equilibrium', 'Set the surroundings to the initial 20 °C.', 'The liquid stays at 20.00 °C. No temperature gap means no change in volume.', {surroundings: 20}),
    trial('Start colder', 'Start at −20 °C and inspect a minute of warming toward 0 °C.', 'The reading is −7.36 °C. The liquid is now colder than its surroundings.', {initial: -20}),
    trial('Mercury comparison', 'Keep the same bore and response, but choose mercury.', 'The reading is still 7.36 °C. Height sensitivity at the reference temperature falls to 0.291 mm/°C because mercury expands less.', {liquid: 0}),
    trial('A finer bore', 'Choose a 0.15 mm bore and inspect the minute in the cold.', 'The reading is still 7.36 °C, but sensitivity rises to 7.091 mm/°C. The calibrated capillary span is only 5.90 to 33.68 °C.', {bore: .15}),
    trial('Where excess liquid goes', 'Warm the fine-bore instrument toward 60 °C and inspect after five minutes.', 'Liquid enters the upper chamber. Its modeled temperature is 59.73 °C, but the capillary reading is unavailable.', {bore: .15, surroundings: 60}, 300, 'chamber', 'iso'),
    trial('Where a low column goes', 'Cool the fine-bore instrument toward −50 °C and inspect after five minutes.', 'The surface retreats into the lower bulb. The modeled liquid temperature is −49.53 °C; the capillary is empty and has no reading.', {bore: .15, surroundings: -50}, 300, 'bulb', 'iso'),
    trial('Mercury reaches a phase boundary', 'Choose mercury and surroundings at −50 °C, then open the end of this comparison.', 'The run stops after 110.17 s at −38.84 °C. The reading becomes unavailable because solidification is outside this liquid-only model.', {liquid: 0, surroundings: -50}, 900),
    trial('Alcohol can stay liquid', 'Choose colored ethanol with a wider 0.5 mm bore in surroundings at −50 °C.', 'After five minutes, the reading is −49.53 °C. This is above ethanol’s approximate freezing point, and the surface remains inside this wider capillary.', {bore: .5, surroundings: -50}, 300),
    trial('A wider bore trades sensitivity for span', 'Warm the 0.5 mm bore toward 60 °C and inspect after five minutes.', 'The reading is 59.73 °C. Sensitivity is only 0.737 mm/°C, but the surface still fits in the capillary.', {bore: .5, surroundings: 60}, 300),
    trial('Five time constants', 'Open the response chart after five chosen time constants.', 'The liquid is at 0.13 °C. Only about 0.674% of the initial temperature gap remains.', {}, 300, 'chart'),
    trial('The instant the surroundings change', 'Open the initial state with surroundings at 60 °C.', 'The instrument still reads 20.00 °C. The target changed; the liquid has not yet warmed.', {surroundings: 60}, 0),
    trial('A finer bore for mercury', 'Choose mercury in the 0.15 mm bore and inspect five minutes of warming toward 60 °C.', 'The reading is 59.73 °C and sensitivity is 1.111 mm/°C. This liquid and bore use their own calibrated marks.', {liquid: 0, bore: .15, surroundings: 60}, 300),
  ],
  deeper: [
    {title: 'Volume becomes height', body: 'Within the capillary, a displaced volume ΔV makes a height change Δh = ΔV/A. Halving bore diameter quarters its area. Here the initial stem fill also changes with the bore, so sensitivity is not exactly quadrupled when diameter is halved.'},
    {title: 'The glass cavity expands', body: 'At the reference temperature, height sensitivity is V₀(βliquid − βglass)/A. The full calculation divides expanded liquid volume by the glass volume factor, then finds the level that encloses that volume. Scale marks expand with the same glass geometry.'},
    {title: 'Response is not resolution', body: 'A narrow bore spreads the scale but does not automatically make a thermometer faster or more accurate. This comparison holds response time independent of bore and liquid so you can separate these effects. Real response depends on heat transfer and construction; accuracy also depends on calibration, reading technique and other errors.'},
    {title: 'One time constant', body: 'The chosen first-order law is T(t) = Tsurroundings + (Tinitial − Tsurroundings) exp(−t/τ). After one τ, about 63.2% of the original gap has closed. Exact equality is approached gradually; a small displayed rounded gap does not mean instantaneous equilibration.'},
    {title: 'There is space beyond the scale', body: 'The upper chamber receives expansion beyond the capillary. Cooling can pull the surface into the lower bulb. The model conserves liquid volume in both cases instead of clamping it to the last mark. A temperature calculated from the response law is then different from a usable instrument reading.'},
    {title: 'Liquid and solid are different models', body: 'Mercury reaches its freezing boundary near −38.8 °C under ordinary pressure. Predicting subsequent solidification would require latent heat and solid-phase properties. This comparison stops at that boundary. Ethanol’s approximate freezing point is far below the offered temperatures.'},
  ],
  misconception: 'The column shows the instrument’s own liquid temperature. It can lag behind the surroundings, run beyond its calibrated capillary, or reach a phase boundary. A computed liquid temperature is not always a valid thermometer reading.',
  limits: 'An illustrative sealed vertical thermometer, not a specified commercial instrument. All physical lengths share one scale in millimeters; use the part inspections to enlarge small details. The reference temperature is 20 °C; the lower cavity radius is 3 mm, the upper radius is 2.3 mm, and the capillary ends at height 200 mm above the lower bulb center. The capillary fill at the 20 °C reference temperature is 100 mm. Scale marks are drawn beside the stem for clarity. Circular frusta approximate the curved reservoirs. Constant representative volumetric expansion coefficients are 1,100 millionths per kelvin for ethanol, 180 for mercury and 9 for borosilicate glass. These are approximate reference values, not a precision calibration over the entire range. One prescribed exponential temperature applies uniformly to liquid and glass. The chosen time constant is not a prediction for air, water or a real bath. Menisci are flat; wetting, capillary pressure, hydrostatic compression, refraction, thermal gradients, evaporation, gas pressure, glass creep and phase-change dynamics are omitted. The last liquid-only state is shown at the mercury freezing boundary; no frozen volume or later temperature is predicted. The base animation rate is 45 modeled seconds per playback second; the playback-speed selector applies an additional multiplier. Changing liquid or bore selects a recalibrated instrument. Decimal readouts expose the calculation and do not imply measurement accuracy.',
  sources: [
    {title: 'OpenStax College Physics 2e: thermal expansion of solids and liquids', url: 'https://openstax.org/books/college-physics-2e/pages/13-2-thermal-expansion-of-solids-and-liquids'},
    {title: 'NIST Chemistry WebBook: mercury phase-change data', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7439976&Units=SI&Mask=4'},
    {title: 'NIST Chemistry WebBook: ethanol phase-change data', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Units=SI&Mask=4'},
  ],
  quiz: {question: 'Why can a finer bore show more movement yet measure a smaller temperature span?', options: ['The same displaced volume moves farther, reaching the ends of the capillary sooner.', 'A finer bore makes the liquid freeze sooner.', 'A finer bore prevents the glass from expanding.'], answer: 0, explanation: 'Height change is displaced volume divided by bore area. More height per degree means fewer degrees fit along a fixed stem.'},
};

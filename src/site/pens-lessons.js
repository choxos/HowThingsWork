import {BALLPOINT_DEFAULTS, FELT_DEFAULTS} from './pens-physics.js';
import {DIP_WRITE_DEFAULTS} from './dip-pen-physics.js';
import {CAPILLARY_DEFAULTS} from './capillary-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  ballpoint: {title: 'Wikipedia: Ballpoint pen', url: 'https://en.wikipedia.org/wiki/Ballpoint_pen'},
  spacePen: {title: 'Wikipedia: Space Pen', url: 'https://en.wikipedia.org/wiki/Space_Pen'},
  rollerball: {title: 'Wikipedia: Rollerball pen', url: 'https://en.wikipedia.org/wiki/Rollerball_pen'},
  marker: {title: 'Wikipedia: Marker pen', url: 'https://en.wikipedia.org/wiki/Marker_pen'},
  dipPen: {title: 'Wikipedia: Dip pen', url: 'https://en.wikipedia.org/wiki/Dip_pen'},
  nib: {title: 'Wikipedia: Nib (pen)', url: 'https://en.wikipedia.org/wiki/Nib_(pen)'},
  fountain: {title: 'Wikipedia: Fountain pen', url: 'https://en.wikipedia.org/wiki/Fountain_pen'},
  washburn: {title: 'Wikipedia: Washburn’s equation', url: 'https://en.wikipedia.org/wiki/Washburn%27s_equation'},
  capillary: {title: 'Wikipedia: Capillary action', url: 'https://en.wikipedia.org/wiki/Capillary_action'},
  jurin: {title: 'Wikipedia: Jurin’s law', url: 'https://en.wikipedia.org/wiki/Jurin%27s_law'},
  capillaryLength: {title: 'Wikipedia: Capillary length', url: 'https://en.wikipedia.org/wiki/Capillary_length'},
  meniscus: {title: 'Wikipedia: Meniscus (liquid)', url: 'https://en.wikipedia.org/wiki/Meniscus_(liquid)'},
  wetting: {title: 'Wikipedia: Wetting', url: 'https://en.wikipedia.org/wiki/Wetting'},
  contactAngle: {title: 'Wikipedia: Contact angle', url: 'https://en.wikipedia.org/wiki/Contact_angle'},
  tension: {title: 'Wikipedia: Surface tension', url: 'https://en.wikipedia.org/wiki/Surface_tension'},
  viscosity: {title: 'Wikipedia: Viscosity', url: 'https://en.wikipedia.org/wiki/Viscosity'},
  ethanol: {title: 'Wikipedia: Ethanol', url: 'https://en.wikipedia.org/wiki/Ethanol'},
  mercury: {title: 'Wikipedia: Mercury (element)', url: 'https://en.wikipedia.org/wiki/Mercury_(element)'},
};

// ---------------------------------------------------------------------------
// Ballpoint pen.
// ---------------------------------------------------------------------------

const ballTrial = (title, observe, values = {}, part = 'system', time = 5) => {
  const settings = {...BALLPOINT_DEFAULTS, ...values};
  return {title, instruction: 'The settings and observation time are applied. Press Play to continue or replay the stroke.', observe, values: settings, initialState: {settings, time}, reset: true, part, isolate: true, view: part === 'paper' ? 'top' : 'front'};
};

export const ballpointLimits = 'Original fixed-tip teaching pen, not a commercial product. Assigned dimensions include a 2 mm refill bore, a 60 mm ink column, a 50 mm stroke and a speed of 10 mm/s. One scene unit represents 100 mm; the separate tip view is enlarged 40 times. The ball rolls without slipping, perpendicular to the paper. The primed starting condition writes immediately. The clean-ball experiment starts with no surface ink, and the blocked-channel experiment starts with film but no replacement supply. Film pickup is idealized at the top and complete transfer at the bottom; neither the true wetted area nor ink thickness is solved. Line width is drawn as half the ball diameter; ink consumption, paper absorption, friction, drying, leakage and capillary flow are not calculated. Orientation changes only geometry and the hydrostatic term ρgh cos θ, using an assigned density of 1,000 kg/m³ and g = 9.81 m/s². The gas comparison adds an assigned 200 kPa gauge pressure; it is not a cartridge specification. The model does not predict air entry or how long an ordinary pen can write upside down. Free fall neglects hydrostatic head, not Earth’s gravity. Retraction and cap mechanisms are outside this fixed-tip lesson.';

export const ballpointLesson = {
  simple: 'How can a rolling ball carry ink from a narrow channel onto paper?',
  overview: 'The socket holds a tiny ball while leaving its bottom exposed. Ink reaches the ball through a narrow channel; friction with the paper turns the ball and carries a film out of the tip. Start with a primed pen, watch ink arrive on a deliberately clean ball, or block the feed and use up its remaining film. Look inside exposes the reservoir; the enlarged tip shows the contact and rotation.',
  steps: [
    {title: 'Supply the tip', body: 'A narrow channel connects the ink reservoir to the socket. Wetting and pressure help supply ink, but the exact flow depends on the ink and tip design.'},
    {title: 'Roll against paper', body: 'Paper contact turns the exposed ball. In the ideal no-slip model, distance traveled equals ball radius times angle turned.'},
    {title: 'Transfer a film', body: 'The rotating surface brings ink from inside the socket to the paper. A ready, primed ball can write from the beginning of its stroke.'},
    {title: 'Keep the supply connected', body: 'A blocked channel prevents replacement ink from reaching the ball. Pressurizing a refill helps feed it at different orientations, but does not remove a physical blockage.'},
  ],
  parts: [
    {name: 'Barrel and rear plug', role: 'Supports the refill; the front half can be hidden to expose it.'},
    {name: 'Ink reservoir', role: 'Stores ink. The sealed comparison adds a separator, gas chamber and rear seal.'},
    {name: 'Ball, socket and ink channel', role: 'Retains the ball, supplies ink and transfers it through rolling contact.'},
    {name: 'Ball, close up', role: 'A separate enlarged inspection. Blue dots mark ink-bearing surface positions.'},
    {name: 'Paper and line', role: 'Records where ink reached the contact point, including any initial blank or early stop.'},
    {name: 'Weight along the refill', role: 'Compares downward weight with its component along the pen. Arrows represent gravity only, not total feed pressure.'},
  ],
  tryIt: [
    ballTrial('Write with a primed pen', 'The 0.7 mm ball has turned 22.74 times during a 50.0 mm stroke. Ink covers all 50.000 mm because the ball was already primed.'),
    ballTrial('A fine ball', 'The 0.3 mm ball makes 53.05 turns in the same 50.0 mm, one turn per 0.942 mm.', {ball: .3}, 'ball'),
    ballTrial('A broad ball', 'The 1.4 mm ball makes 11.37 turns, half as many as the 0.7 mm ball. Ball diameter alone does not determine real line width.', {ball: 1.4}, 'ball'),
    ballTrial('Before the first ink arrives', 'The deliberately clean ball has moved 0.500 mm. Ink has not yet crossed the half-turn path to the paper, so the line remains blank.', {condition: 1}, 'ball', .05),
    ballTrial('Clean ball, completed stroke', 'The chosen clean start leaves 1.100 mm blank, followed by 48.900 mm of ink. A primed pen does not have this obligatory delay.', {condition: 1}, 'paper'),
    ballTrial('Blocked channel, film still present', 'The ball has moved 0.500 mm and is still writing from its initial film. The dark plug prevents fresh ink from replacing that film.', {condition: 2}, 'ball', .05),
    ballTrial('Blocked channel, film spent', 'Only the first 1.100 mm received ink. The ball continued rolling to 50.0 mm, but no replacement ink could pass the imposed blockage.', {condition: 2}, 'paper'),
    ballTrial('Point sideways', 'The hydrostatic component along the horizontal refill is 0.0 Pa. The assumed primed, connected supply still writes a 50.000 mm line.', {place: 1}),
    ballTrial('Point upward', 'Gravity contributes −588.6 Pa toward the tip, opposing supply. This short-stroke model keeps the tip primed; it does not invent an instant failure or predict air entry.', {place: 2}),
    ballTrial('Add gas pressure', 'With the pen pointing up, the assigned 200 kPa gas pressure and opposing hydrostatic term combine to 199.411 kPa. The sealed refill shows gas, separator and ink.', {place: 2, refill: 1}, 'refill'),
    ballTrial('A block still blocks', 'Added gas pressure does not remove the imposed plug. This schematic still leaves only 1.100 mm of ink from the film already on the ball.', {condition: 2, refill: 1}, 'ball'),
    ballTrial('Write in free fall', 'The hydrostatic term is neglected because pen and ink fall together. The primed pen writes 50.000 mm. An ESA astronaut documented an ordinary ballpoint writing in orbit.', {place: 3}),
  ],
  deeper: [
    {title: 'The source mechanism', body: 'The source book places the ballpoint beside other pens on page 141. Its essential connection is reservoir, narrow ink channel, ball in socket and paper. The cutaway retains that path; the enlarged duplicate is an inspection view rather than another working part.'},
    {title: 'Count turns from travel', body: 'For ideal rolling, x = rθ, so turns = x/(πd). Across 50 mm, a 0.3 mm ball makes 53.05 turns and a 1.4 mm ball makes 11.37. The diameter sets the rotation count, while ink properties, paper and contact also affect the written line.'},
    {title: 'A chosen starting condition matters', body: 'The clean-ball trial illustrates transport time from an ideal pickup point at the top to paper at the bottom. Half a turn takes πd/2 of travel. A primed pen already has ink there; the default therefore starts without a blank. The blocked trial demonstrates residual film, not a measured clogging distance.'},
    {title: 'Upward is different from free fall', body: 'PILOT explains that continued upward writing can draw ink away and admit air. It gives no universal failure time. In orbit, pen and ink fall together; Earth’s gravity still acts, but the usual hydrostatic column is absent in their freely falling frame. Pedro Duque reported writing with an ordinary ballpoint aboard Soyuz in 2003.'},
    {title: 'What pressurization adds', body: 'Fisher describes a sealed, gas-pressurized cartridge that supplies specially formulated ink at different orientations. The lesson uses an assigned pressure and schematic separator to illustrate that added push. It does not reproduce a specific product’s pressure, gas expansion or ink rheology.'},
    {title: 'Viscosity is not drying speed', body: 'Resistance to flow and the processes that dry or set ink are different properties. This lesson calculates neither. It therefore makes no general claim that thicker ink dries faster.'},
  ],
  misconception: 'Gravity is only one contribution to ink supply. A ballpoint’s writing cannot be decided from orientation alone, and a primed ball does not need an obligatory blank half-turn.',
  limits: ballpointLimits,
  sources: [
    {title: 'PILOT: upward writing, ink channels and tip damage', url: 'https://www.pilot.co.jp/media_english/008/'},
    {title: 'Fisher Space Pen: sealed and pressurized cartridges', url: 'https://www.spacepen.com/faqs'},
    {title: 'ESA: Pedro Duque writes with an ordinary ballpoint in orbit', url: 'https://www.esa.int/Space_in_Member_States/Spain/Pedro_Duque_s_diary_from_space'},
    {title: 'BIC: examples of ballpoint tip sizes', url: 'https://nam.bic.com/en-us/stationery/bic-ballpoint-pens'},
  ],
  quiz: {
    question: 'Why can the primed pen write immediately while the deliberately clean ball leaves an initial blank?',
    options: ['The primed ball already carries ink at the paper contact; the clean ball must first rotate fresh ink there.', 'A clean ball has a different circumference.', 'Gravity switches off until the ball completes one turn.'],
    answer: 0,
    explanation: 'Both balls roll by the same x = rθ relation. The difference is their initial ink film. For the clean 0.7 mm ball, the schematic half-turn path is 1.100 mm; the primed ball already has ink at the contact.',
  },
};

// ---------------------------------------------------------------------------
// Felt-tip pen.
// ---------------------------------------------------------------------------

const feltTrial = (title, observe, values = {}, part = 'system', time = 4) => {
  const settings = {...FELT_DEFAULTS, ...values};
  return {title, instruction: 'Settings and observation time are applied. Press Play to continue or replay.', observe, values: settings, initialState: {settings, time}, reset: true, part, isolate: true, view: part === 'paper' ? 'top' : 'front'};
};

export const feltTipLimits = 'Original primed marker with assigned geometry: a barrel reaching 80 mm above the paper, a 10 mm path from reservoir contact to paper, a 1 mm square footprint and a 40 mm stroke. One scene unit represents 100 mm; pore samples are enlarged 200 times. The writing nib starts wet. Separate ideal dry-pore estimates use cylindrical pores, complete wetting and Washburn flow without gravity or inertia. Assigned water reference: 72.8 mN/m and 1.0016 mPa·s; ethanol reference: 22.27 mN/m and 1.2 mPa·s. These values are comparisons, not commercial ink specifications. Core pore radius is 50 μm; nib radius can be 5 to 25 μm. Paper uses an assigned transverse spread coefficient of 0.5 mm/√s for water, scaled by √(γ/η) for ethanol. Every row spreads sideways only while the square tip feeds it; initial contact immediately colors the footprint. No spreading along the stroke, redistribution after contact, drying, depletion, leakage, pressure squeezing, paper anisotropy, or through-thickness flow is solved. Supply is assumed sufficient at every nib setting. The pore comparison does not calculate coupled reservoir, nib and paper flow. The storage cap is removed and omitted.';

export const feltTipLesson = {
  simple: 'How can a porous nib carry ink without a rolling ball or a pump?',
  overview: 'Ink fills connected spaces among the reservoir fibers. The wet nib touches that reservoir and passes ink to paper. Surface tension and wetting create capillary pressure; viscous resistance limits the flow. Watch a primed marker write, slow it down, or hold it at the end. Then compare ideal pores to see why stronger suction does not always mean faster filling.',
  steps: [
    {title: 'Store ink among fibers', body: 'A porous reservoir holds ink inside the barrel and remains in contact with the nib.'},
    {title: 'Keep a connected wet path', body: 'Wetting and curved liquid surfaces help draw ink through the nib. Real flow also depends on resistance and air replacement.'},
    {title: 'Touch the paper', body: 'The already wet tip transfers ink where it touches. Rows farther along the page remain dry until the tip reaches them.'},
    {title: 'Give ink time to spread', body: 'In this assigned paper example, longer feeding lets ink spread farther sideways. Holding at the end widens the final stain.'},
  ],
  parts: [
    {name: 'Barrel and rear plug', role: 'Support and protection, with a replacement-air vent.'},
    {name: 'Porous ink reservoir', role: 'Stores ink among fibers and touches the nib.'},
    {name: 'Porous writing nib', role: 'A connected 10 mm path from reservoir to paper.'},
    {name: 'Paper and ink', role: 'Each row records its own contact and feeding history.'},
    {name: 'Pores and capillary pressure', role: 'Enlarged local menisci compare pressure and ideal filling time.'},
    {name: 'Paper contact-time chart', role: 'The cross follows the marked end row’s sideways spread.'},
  ],
  tryIt: [
    feltTrial('Write a line', 'The primed marker travels 40 mm in 2 s, then holds for 2 s. A fully passed interior row is 1.22 mm wide. The marked end row is fed for 2.025 s and reaches 2.42 mm.', {}, 'paper'),
    feltTrial('Before the tip arrives', 'After 0.5 s the marker has traveled 10 mm. The middle and end rows are still dry. Ink appears only where the tip has reached.', {}, 'system', .5),
    feltTrial('Write slowly', 'At 5 mm/s an interior row is fed for 0.200 s. Sideways spread is 0.224 mm per side and total width is 1.45 mm. Four times the feeding time gives twice the spread.', {speed: 5}, 'paper', 10),
    feltTrial('Write fast', 'At 40 mm/s an interior row is fed for 0.025 s and finishes 1.16 mm wide. The square contact itself still contributes 1 mm.', {speed: 40}, 'paper', 3),
    feltTrial('No hold at the end', 'The marker stops after 2 s. The end center has received only 0.025 s of ink, half a transit time, so its width is 1.16 mm. The interior has already reached 1.22 mm.', {hold: 0}, 'paper', 2),
    feltTrial('Hold for four seconds', 'The end row is fed for 4.025 s and reaches 3.01 mm. Interior rows stay at 1.22 mm because this example stops their sideways spread when the tip leaves.', {hold: 4}, 'paper', 6),
    feltTrial('Compare the reference fluids', 'With the assigned ethanol properties and identical wetting, paper spread is 0.51 times the water reference. Interior width is 1.11 mm and final end width is 1.72 mm. Real marker formulations need not follow that ordering.', {ink: 1}, 'paper'),
    feltTrial('Smaller pore, slower filling', 'A 5 μm nib pore gives 29.12 kPa of capillary pressure but takes 0.550 s to fill an initially dry 10 mm ideal channel. Higher pressure does not cancel the increased flow resistance.', {pore: 5}, 'pores', 0),
    feltTrial('Larger pore, faster filling', 'A 25 μm nib pore gives only 5.82 kPa, yet its ideal 10 mm filling time is 0.110 s. Radius is five times larger than in the small-pore trial; pressure and filling time are both one fifth as large.', {pore: 25}, 'pores', 0),
    feltTrial('One second of local feeding', 'The cross follows the end row after exactly 1 s of feeding. Water-reference spread is 0.500 mm on each side, giving a 2.00 mm width including the tip.', {hold: 4}, 'chart', 2.975),
    feltTrial('Four seconds of local feeding', 'After 4 s of feeding, sideways spread is 1.000 mm and end-row width is 3.00 mm. Four times the time gives twice the spread, not twice the total line width.', {hold: 4}, 'chart', 5.975),
    feltTrial('Trace the connected nib', 'The square contact touches the paper. The nib widens to its supporting shank and meets the porous core 10 mm above the page. Inspection preserves the current time and settings.', {}, 'nib', 1),
  ],
  deeper: [
    {title: 'A matched porous system', body: 'Manufacturers tune fiber density, porosity, reservoir wrapping and nib shape together. Real inks include ingredients that affect viscosity and wetting. A pair of pore sizes alone cannot predict a marker’s delivery or leakage.'},
    {title: 'Pressure and resistance', body: 'For a cylindrical pore that the liquid wets completely, capillary pressure is 2γ/r. Washburn filling gives L² = γrt/(2η). Reducing radius increases pressure but also increases resistance enough to slow the advancing wet front.'},
    {title: 'A paper example with a clear boundary', body: 'The drawn square footprint gives each interior row contact time equal to tip length divided by speed. Assigned sideways spread is C√t during that contact. It illustrates exposure time; a real stain can keep redistributing after the pen leaves and can spread in several directions.'},
    {title: 'Why a cap matters', body: 'A storage cap reduces exposure of the wet tip to air. Drying and solvent loss change a real marker’s behavior. This short primed writing experiment omits the cap and evaporation rather than inventing a drying deadline.'},
  ],
  misconception: 'Stronger capillary suction does not guarantee faster flow. Pressure, viscous resistance, wetting and the connected porous structure all matter. A simple pore comparison cannot prove that a real marker never leaks.',
  limits: feltTipLimits,
  sources: [
    {title: 'Porex: Permanent marker nibs and reservoirs', url: 'https://www.porex.com/consumer-goods/writing-instruments/permanent-marker-nibs-and-reservoirs/'},
    {title: 'Washburn: The Dynamics of Capillary Flow (1921)', url: 'https://journals.aps.org/pr/abstract/10.1103/PhysRev.17.273'},
  ],
  quiz: {
    question: 'In this paper example, what happens to sideways spread when feeding time becomes four times longer?',
    options: ['It doubles, because spread grows with the square root of feeding time.', 'It becomes four times larger.', 'It stays unchanged because the nib has no moving parts.'],
    answer: 0,
    explanation: 'At 5 mm/s an interior row receives 0.200 s of ink and spread is 0.224 mm per side. At 20 mm/s it receives 0.050 s and spread is 0.112 mm. The fixed 1 mm tip width is added afterward.',
  },
};

// ---------------------------------------------------------------------------
// Dip pen, and capillary action on its bench.
// ---------------------------------------------------------------------------

const dipTrial = (title, observe, values = {}, part = 'system', time = 6.2) => {
  const settings = {...DIP_WRITE_DEFAULTS, ...values};
  return {title, instruction: 'Settings and observation time are applied. Press Play to continue or replay the sequence.', observe, values: settings, initialState: {settings, time}, reset: true, part, isolate: true, view: part === 'paper' ? 'top' : 'front'};
};

export const dipPenLimits = 'Original flat steel teaching nib, 30 mm long and 7 mm wide, with a 0.25 mm thickness. A 9 mm narrow slot reaches the lower edge of a 2 mm vent centered 10 mm above the tip. The resting gap is 0.020 mm; assigned extra force spreads the tip by 0.1 mm/N, decreasing linearly to zero spread at the slot root. The pen is tilted 45°. Retained loads are chosen as 0, 0.020 or 0.045 μL. The full load equals the resting narrow-slot volume. Loading, retention near the tip, lifting and transfer are imposed teaching stages, not predictions of wetting, capture or drainage. A dry nib skips the ink. Writing travels 40 mm at 10 mm/s after a 2.2 s preparation sequence. Assigned line width equals tip span and wet-film thickness is 10 μm. Deposited volume is width × thickness × inked length; the same volume is removed from the tapered slot. Ink flow is assumed sufficient until the chosen supply is exhausted. No ink is deposited during the stationary contact stage. Actual nib curvature, nonlinear elasticity, contact forces, finite-width channel resistance, drop storage outside the slit, evaporation, blotting, paper absorption and breaking of the ink bridge are not solved. The 40× tip inspection uses the same force and ink state. Capillary pressure is only a local ideal parallel-face comparison with complete wetting and assigned water-like surface tension of 72.8 mN/m; it does not predict net flow or guarantee against leaks.';

export const dipPenLesson = {
  simple: 'How do a split nib, a small ink load and flexible tines make a written stroke?',
  overview: 'Dipping wets the nib and loads ink into its narrow spaces. Capillary effects help retain that ink; the slit connects it to the paper. The pen lifts, moves to the page and writes. Extra force spreads the pointed tines, widening the line. This example tracks a chosen volume so you can see why a wider stroke uses the retained ink sooner.',
  steps: [
    {title: 'Load the nib', body: 'Ink enters narrow spaces around the nib. Here the chosen load occupies only the slit; real nibs also retain ink around the vent and on their undersides.'},
    {title: 'Carry it to the page', body: 'The holder lifts the nib clear of the well and moves it onto paper. A dry comparison skips the ink.'},
    {title: 'Spread the tines', body: 'Extra force on the pointed nib spreads its two tips. The enlarged view shows the same gap as the complete pen.'},
    {title: 'Spend the retained ink', body: 'A moving wet tip leaves a line. Every bit deposited is removed from the nib; once this assigned supply runs out, the pen leaves dry travel.'},
  ],
  parts: [
    {name: 'Wooden holder and nib socket', role: 'Supports the steel shank without storing ink inside the handle.'},
    {name: 'Steel nib and flexing tines', role: 'One connected sheet splits into two flexible tips around the slit.'},
    {name: 'Ink retained in the slit', role: 'A finite volume remains connected to the writing point and is consumed by the stroke.'},
    {name: 'Inkwell', role: 'Supplies the chosen initial load; its cutaway exposes the immersed nib.'},
    {name: 'Paper and written stroke', role: 'Records where the moving tip still has ink.'},
    {name: 'Writing tip, enlarged', role: 'Shows the same tine spread, retained ink and wet or dry contact at 40× scale.'},
  ],
  tryIt: [
    dipTrial('Complete a light stroke', 'The full 0.045 μL load writes all 40 mm at the assigned 0.10 mm width. It deposits 0.040 μL and retains 0.005 μL.', {}, 'paper'),
    dipTrial('Watch the assigned loading', 'Halfway through the illustrative loading stage, the slot contains 0.0225 μL. No ink has reached the paper. This loading schedule is imposed, not a predicted capillary filling rate.', {}, 'nib', .25),
    dipTrial('Lift without writing', 'The nib now holds 0.045 μL and its point is 25 mm above the ink surface. Deposited volume is still zero; moving through air does not draw a line.', {}, 'system', 1),
    dipTrial('Apply force without creating ink', 'The tines are halfway through applying 1 N of extra force. Their tip gap has reached 0.070 mm. The retained volume is still 0.045 μL, but it occupies a shorter length of the wider slot.', {press: 1}, 'detail', 2.1),
    dipTrial('A broader downstroke', 'With 0.5 N of extra force, the assigned width is 0.15 mm. The same 0.045 μL load writes 30.00 mm, then the final 10.00 mm of travel is dry.', {press: .5}, 'paper'),
    dipTrial('Spread the tines farther', 'At 1 N of extra force the tip gap is 0.120 mm and line width is 0.20 mm. The full load writes 22.50 mm before running out.', {press: 1}, 'paper'),
    dipTrial('A smaller retained load', 'The 0.020 μL load writes 20.00 mm at light contact. The remaining 20.00 mm of travel leaves no new ink.', {load: 1}, 'paper'),
    dipTrial('Small load, wide stroke', 'The same 0.020 μL now supplies a 0.20 mm wide line for only 10.00 mm. Doubling assigned width halves the length possible from a fixed volume and film thickness.', {load: 1, press: 1}, 'paper'),
    dipTrial('Skip dipping', 'The nib stays above the ink, moves to paper and completes its motion. With no retained supply, the entire 40 mm travel is dry.', {load: 0}, 'system'),
    dipTrial('Inspect a wet writing point', 'The wide tip has traveled 8.00 mm and deposited 0.016 μL. The remaining 0.029 μL still connects to the point, and its blue trail reaches the moving tip.', {press: 1}, 'detail', 3),
    dipTrial('Inspect a dry writing point', 'The tip has traveled 30.00 mm, beyond the 22.50 mm supplied by its load. The slit is empty and no new blue trail follows the tip.', {press: 1}, 'detail', 5.2),
    dipTrial('Compare the light contact', 'At light contact the tip gap is 0.020 mm and assigned line width is 0.10 mm. After 10.00 mm of writing, 0.035 μL remains in the slot.', {}, 'detail', 3.2),
  ],
  deeper: [
    {title: 'Capillary retention and gravity', body: 'Wetting and curved liquid surfaces create pressure differences that help ink remain in narrow spaces. Gravity also contributes along an inclined nib. Neither effect by itself determines delivery: the liquid surfaces, resistance, paper and available ink all matter.'},
    {title: 'Why a tapered slit is not one uniform channel', body: 'The selected force opens the tip most and leaves the root almost unchanged. A formula for one uniform gap cannot be applied to the entire nib using only its tip width. This model shows the geometry and conserves ink volume; it does not claim a measured flow multiplier.'},
    {title: 'Flex makes the stroke wider', body: 'Pointed nibs can spread under pressure, unlike rigid broad-edge nibs whose line also depends strongly on their angle. The assigned compliance here illustrates flexible tines; actual stiffness depends on metal, curvature, thickness and construction.'},
    {title: 'A finite load', body: 'For the assigned wet film, volume equals line width times thickness times inked length. A wider stroke spends the same retained load over a shorter distance. Real ink delivery and spreading need measurements of both nib and paper.'},
    {title: 'Wetting changes the result', body: 'Manufacturers note that a protective nib coating, excess ink, ink consistency and paper choice can all affect writing. The ideal load here does not simulate cleaning, drying, leakage or skipped tracks.'},
  ],
  misconception: 'A dip pen is not fed from inside its wooden holder. It carries a limited amount on the nib. Capillary effects help retain and deliver that ink, while gravity, resistance, wetting and contact with paper also matter.',
  limits: dipPenLimits,
  sources: [
    {title: 'Speedball: Calligraphy and illustration, pointed pen mechanics', url: 'https://www.speedballart.com/shop/calligraphy-illustration/'},
    {title: 'Manuscript: Dip nib, ink and paper guidance', url: 'https://calligraphy.co.uk/pages/faq'},
  ],
  quiz: {
    question: 'In this model, why does the same ink load write a shorter line with more extra force?',
    options: ['The tines spread, so each millimeter of the wider stroke uses more ink at the assigned film thickness.', 'The wooden holder absorbs the extra ink.', 'Opening the slit destroys ink before it reaches the paper.'],
    answer: 0,
    explanation: 'At 0.10 mm width a full load can complete the 40 mm stroke. At 0.20 mm width it is exhausted after 22.50 mm. Deposited plus retained volume always equals the loaded volume.',
  },
};

const capTrial = (title, observe, values = {}, part = 'capillary', time = 6) => {
  const settings = {...CAPILLARY_DEFAULTS, ...values};
  return {title, instruction: 'Settings and guide stage are applied. Levels show equilibrium immediately; Play explains the balance without predicting filling time.', observe, values: settings, initialState: {settings, time}, reset: true, part, isolate: true, view: 'front'};
};

export const capillaryLimits = 'Ideal equilibrium in an open circular tube of radius 0.10–0.50 mm and a slowly opening plate wedge with a 0.10–1.00 mm gap across 40 mm. Both glass channels are 220 mm long and immersed 5–60 mm in a reservoir whose level is fixed. Physical apparatus dimensions use one scale; the meniscus cross-section is uniformly enlarged and its magnification is labeled. Signed height is 2γ cos θ/(ρ g r) for the tube and 2γ cos θ/(ρ g b) for a local plate gap b, with g = 9.81 m/s². The small-tube approximation neglects meniscus volume; the separate spherical-cap drawing also neglects gravity across the curved surface. The wedge treats local slices as parallel plates and neglects curvature along the wedge. Rounded textbook references use surface tensions 72.8, 22.3 and 465 mN/m, densities 1000, 790 and 13600 kg/m³, and reference glass contact angles 0°, 0° and 140° for water, ethanol and mercury. These are reference values, not a calibrated common-temperature property set. Assigned angles of 60°, 90° and 120° are comparisons, not measured coatings. A required depressed level below the immersed opening is marked inaccessible for an initially dry channel; entrance shape and pinning are not calculated. The six-second playback guides the explanation only. There is no predicted filling time, transient flow, inertia, dynamic contact angle, overshoot, evaporation, bath depletion, outside-glass wetting or contamination model.';

export const capillaryActionLesson = {
  simple: 'Why does water stand higher inside narrow glass, while a nonwetting liquid can stand lower?',
  overview: 'An open tube and two glass plates share one bath. Where liquid meets glass, the contact angle sets the surface curvature. That curvature changes the pressure below the surface. The liquid level balances this pressure against gravity. Change radius, liquid, contact angle or immersion and compare the equilibrium immediately. Play walks through the explanation; it does not simulate how long filling takes.',
  steps: [
    {title: 'Meet the glass', body: 'The contact angle is measured through the liquid. An angle below 90° gives a concave surface; above 90° gives a convex one. Surface condition and contamination can change real contact angles.'},
    {title: 'Compare the pressures', body: 'Both open air spaces have the same ambient pressure. For the ideal tube, air pressure minus liquid pressure just below the meniscus is 2γ cos θ/r. Its sign changes at 90°.'},
    {title: 'Balance against gravity', body: 'A raised surface has lower liquid pressure than the bath surface; a depressed surface has higher liquid pressure. Hydrostatic pressure balances the curved-surface pressure at the signed Jurin height.'},
    {title: 'Check the immersed mouth', body: 'The required level must lie above the bottom opening to exist inside the tube. A shallow mouth can prevent entry of a nonwetting liquid in this initially dry-channel model. Greater immersion can make the depressed level accessible.'},
  ],
  parts: [
    {name: 'Stand and adjustable clamps', role: 'Holds the glass and lowers the tube and plates together into the bath.'},
    {name: 'Open liquid bath', role: 'Sets the outside zero-height reference and supplies liquid at the immersed openings.'},
    {name: 'Open glass tube', role: 'Provides the selected circular bore, drawn at its actual radius.'},
    {name: 'Wedge of glass plates', role: 'Compares local plate gaps from 0.10 to 1.00 mm.'},
    {name: 'Meniscus, enlarged', role: 'Shows the contact angle and spherical-cap reference on a readable uniform scale.'},
    {name: 'Pressure-balance height chart', role: 'Compares signed required height with size and marks the immersed mouth.'},
  ],
  tryIt: [
    capTrial('Water in the reference tube', 'Water stands 74.2 mm above the bath in the 0.20 mm-radius tube. The ideal air-minus-liquid pressure is 728 Pa.'),
    capTrial('Half the radius', 'At 0.10 mm radius, the ideal water height doubles to 148.4 mm. This is an equilibrium comparison, not a claim about filling speed.', {radius:.1}),
    capTrial('A wider tube', 'At 0.50 mm radius, water stands only 29.7 mm above the bath. The smaller curvature supports a smaller pressure difference.', {radius:.5}),
    capTrial('Compare the glass wedge', 'The ideal required water height falls from 148.4 mm at the 0.10 mm gap to 14.8 mm at the 1.00 mm gap. At a gap of 0.20 mm it matches the selected tube’s 74.2 mm height.', {}, 'wedge'),
    capTrial('See the water meniscus', 'The reference 0° contact angle gives a concave surface with vertical tangents where it meets the walls. The enlarged diagram uses one scale in both directions.', {}, 'meniscus', 1),
    capTrial('Change to ethanol', 'The reference ethanol height is 28.8 mm with a 223 Pa surface-pressure difference. Its lower surface tension outweighs its lower density in this comparison.', {liquid:1}),
    capTrial('Mercury cannot enter', 'For reference mercury and a 0.20 mm radius, the required level is 26.7 mm below the bath. The opening is only 15 mm deep, so that interior equilibrium is inaccessible.', {liquid:2}),
    capTrial('Let mercury enter a wider tube', 'At 0.50 mm radius, the required mercury depression is 10.7 mm. The 15 mm immersion is enough to contain that level inside the tube.', {liquid:2,radius:.5}),
    capTrial('Immerse the narrow tube farther', 'At 30 mm immersion, mercury can enter the 0.20 mm-radius tube and stand 26.7 mm below the bath. Immersion changes accessibility, not the required height.', {liquid:2,depth:30}),
    capTrial('Assign a 60° contact angle', 'For water at 60°, cos θ is one half. Required height is 37.1 mm, half the fully wetting value, while radius, density and surface tension stay unchanged.', {wetting:1}, 'meniscus'),
    capTrial('Remove the height difference', 'At an assigned 90° contact angle, the ideal surface is flat. Surface-pressure difference and height relative to the bath are both zero.', {wetting:2}, 'meniscus'),
    capTrial('Reverse wetting', 'At an assigned 120° contact angle, water stands 37.1 mm below the bath. A 60 mm immersion keeps that depressed level above the mouth.', {wetting:3,depth:60}),
    capTrial('Read the inaccessible region', 'The mercury curve gives required height. The gold mouth line is −15 mm; curve points below it cannot be realized inside an initially dry tube at that immersion.', {liquid:2}, 'chart'),
  ],
  deeper: [
    {title: 'Force around the rim', body: 'The upward component of surface tension around a circular contact line is 2πrγ cos θ. Balancing it against the signed column weight ρgπr²h gives h = 2γ cos θ/(ρgr). For a nonwetting liquid, both the vertical component and the signed height are negative.'},
    {title: 'One ambient pressure, different liquid pressures', body: 'The bath and tube are open to the same air. A curved interface creates the liquid pressure difference; a vacuum above the tube is not required. Moving down from the meniscus adds hydrostatic pressure until it matches the connected bath at the same height.'},
    {title: 'Why plates use gap, not half-gap', body: 'For a narrow pair of parallel plates, two contact lines supply 2γ cos θ per unit width. The signed liquid weight per unit width is ρg b h, so h = 2γ cos θ/(ρg b). A gap equal to the tube radius gives the same ideal height.'},
    {title: 'Wedge approximation', body: 'The plates open slowly across their width. Treating each narrow strip as parallel gives a height proportional to one over the local gap. The rendered sheet uses this local approximation; it is not a full three-dimensional free-surface solution.'},
    {title: 'Height is not speed', body: 'Viscosity resists flow but drops out of the static balance. In the restricted early viscous regime, with gravity and inertia negligible, Washburn’s law gives penetration squared proportional to radius times time for a wetting circular tube. It does not say a tube twice as wide always fills four times faster. Entry and inertia can matter before that regime.'},
    {title: 'Where the approximation ends', body: 'The tube radii are small compared with each liquid’s capillary length, supporting a small-meniscus approximation. Even so, a spherical cap omits gravity across the curved surface. Real contact angles, pinning, cleanliness and dynamic motion require more information than these four controls provide.'},
  ],
  misconception: 'A narrower tube does not squeeze liquid upward, and capillary action does not require lower air pressure above the tube. Wetting and surface curvature create a liquid-pressure difference; gravity sets the equilibrium height.',
  limits: capillaryLimits,
  sources: [
    {title: 'OpenStax: Surface tension, contact angles and capillary action', url: 'https://openstax.org/books/college-physics-2e/pages/11-8-cohesion-and-adhesion-in-liquids-surface-tension-and-capillary-action'},
    {title: 'OpenStax: Reference densities', url: 'https://openstax.org/books/college-physics-2e/pages/11-2-density'},
    {title: 'Washburn: The Dynamics of Capillary Flow (1921)', url: 'https://journals.aps.org/pr/abstract/10.1103/PhysRev.17.273'},
    {title: 'Yelkhovsky and Pinczewski: Inertial effects in capillary flow (2018)', url: 'https://journals.aps.org/prfluids/abstract/10.1103/PhysRevFluids.3.044003'},
  ],
  quiz: {
    question: 'For the same liquid and contact angle in this equilibrium model, what happens when the tube radius is halved?',
    options: ['The signed height relative to the bath doubles, provided that level is accessible inside the tube.', 'The equilibrium height stays unchanged because air pressure is unchanged.', 'The liquid always reaches its new level four times faster.'],
    answer: 0,
    explanation: 'Jurin height is inversely proportional to radius. Reference water rises from 74.2 to 148.4 mm when radius changes from 0.20 to 0.10 mm. This equilibrium equation does not predict filling time.',
  },
};

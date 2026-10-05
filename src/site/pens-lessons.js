import {BALLPOINT_DEFAULTS, DIP_DEFAULTS, FELT_DEFAULTS} from './pens-physics.js';

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

const feltSystem = trial(FELT_DEFAULTS, 'system'), feltPaper = trial(FELT_DEFAULTS, 'paper', 'top'), feltPores = trial(FELT_DEFAULTS, 'pores'), feltChart = trial(FELT_DEFAULTS, 'chart');

export const feltTipLimits = 'A felt-tip pen drawn at true size, writing a 40 mm line at a steady speed and then resting 2 s where it stops. Water stands in for a water-based ink and ethanol for an alcohol-based one, both at 20 °C and both taken to wet the fibers completely: water with a surface tension of 72.8 mN/m and a viscosity of 1.0016 mPa·s, ethanol with 22.27 mN/m and 1.2 mPa·s. Illustrative: a tip touching the paper across 1.0 mm; pores 50 μm in radius in the core and 10 μm in the nib, which is 10 mm long; and paper that soaks up the water-based ink 0.5 mm in its first second, at a pace that grows with the square root of time and, for another ink, with the square root of its surface tension over its viscosity, as Washburn’s equation has it. Ink soaks sideways only while the tip is over it, and the blot grows out from under the resting tip. Not modeled: evaporation, the ink running low, paper fibers that lie one way, and ink soaking through to the back of the page.';

export const feltTipLesson = {
  simple: 'How does a felt-tip pen get ink onto the paper with no moving parts?',
  overview: 'Nothing pushes the ink out of a felt-tip pen. Its ink soaks a core of fibers, a nib of pressed fibers touches that core, and the paper touches the nib. Each is finer than the one before, and finer pores pull harder, so ink moves on from core to nib to paper. Change the ink and how fast you write to see how wide the line comes out and how the ink keeps soaking out where the pen stops.',
  steps: [
    {title: 'Soak the core', body: 'The ink sits in a core of loose fibers inside the barrel.'},
    {title: 'Pull it into the nib', body: 'The nib’s pores are narrower, so they pull harder and draw the ink out of the core.'},
    {title: 'Touch the paper', body: 'The paper’s fibers draw ink out of the nib wherever the tip touches.'},
    {title: 'Soak outward', body: 'Ink keeps spreading into the paper for as long as the tip stays over it: the longer, the wider.'},
  ],
  parts: [
    {name: 'Marker', role: 'The barrel, the ink-soaked core and the nib of pressed fibers.'},
    {name: 'Paper and ink', role: 'The line, and the blot where the pen stops.'},
    {name: 'Pores, close up', role: 'A pore of the core and a pore of the nib, and how hard each pulls.'},
    {name: 'Soaking in over time', role: 'How far ink soaks into the paper, against how long it has been there.'},
  ],
  tryIt: [
    feltSystem('Write a line', 'Keep the water-based ink at 20 mm/s and press Play.', 'The tip writes 40 mm in 2 s. Each spot spends 0.050 s under the 1.0 mm tip, and the ink soaks 0.112 mm past it on each side, so the line is 1.22 mm wide. Where the pen stops the ink keeps soaking out, and after resting there the blot is 2.43 mm across.'),
    feltPaper('Write slowly', 'Set the writing speed to 5 mm/s and press Play.', 'Each spot now spends 0.200 s under the tip, four times as long, but the ink soaks only twice as far past it: 0.224 mm on each side, for a line 1.45 mm wide.', {speed: 5}),
    feltPaper('Write fast', 'Set the writing speed to 40 mm/s and press Play.', 'Each spot spends only 0.025 s under the tip, and the line narrows to 1.16 mm: most of its width is the tip itself.', {speed: 40}),
    feltPaper('Alcohol-based ink', 'Choose the alcohol-based ink and press Play.', 'Ethanol pulls more weakly than water and flows a little less easily, so it soaks in 0.51 times as fast. The line is 1.11 mm wide, and the blot only 1.72 mm across, against 2.43 mm with the water-based ink.', {ink: 1}),
    feltPores('Narrow pores pull harder', 'Look at the two pores.', 'The nib’s 10 μm pores pull the ink with 14.6 kPa, 5 times as hard as the core’s 50 μm pores at 2.91 kPa. Ink moves toward the harder pull: out of the core, along the nib in 0.28 s, and into the paper.'),
    feltPores('Whichever way it points', 'Keep the water-based ink and look at the nib’s pore.', 'A pore 10 μm in radius could hold this ink up a column 1.48 m tall, and the alcohol-based ink 0.58 m. A pen is far shorter, so the ink’s own weight cannot drain the nib, whichever way the pen points.'),
    feltChart('The square root of time', 'Look at the chart.', 'The water-based ink soaks 0.500 mm into the paper in its first 1 s, but needs 4 s to soak 1.000 mm: soaking twice as far takes four times as long.'),
  ],
  deeper: [
    {title: 'A pen of fibers', body: 'A marker pen is a pen with its own ink source and a tip of porous, pressed fibers such as felt. Its container holds a core of absorbent material that holds the ink; the tip is usually made of highly compressed synthetic fibers or porous ceramics; and a cap keeps the marker from drying out.'},
    {title: 'Why narrow pores pull harder', body: 'Ink that wets the fibers curves its surface inward in each pore, and a curved surface pulls with twice the surface tension over the pore’s radius. A pore one fifth as wide pulls 5 times as hard, so the finest pores win: ink leaves the loose core for the pressed nib, and the nib for the paper.'},
    {title: 'The square root of time', body: 'Washburn’s equation says a liquid soaks into a pore a distance that grows with the square root of time, and with the square root of the pore’s radius and of the liquid’s surface tension over its viscosity. In inkjet printing that last ratio, the page notes, stands for the speed at which ink soaks into the paper. A brick behaves the same way: with a sorptivity of 5.0 mm for every square root of a minute and a porosity of 0.25, its wet edge climbs 20 mm in the first minute and only 40 mm by the fourth.'},
    {title: 'What the ink is made on', body: 'Until the early 1990s the inks in permanent markers were mostly made on toluene and xylene, which are harmful and smell strongly. Today the ink is usually made on alcohols such as 1-propanol and 1-butanol, and its water content can be up to 10%. Water and ethanol stand in for the two kinds here.'},
  ],
  misconception: 'Ink is not pushed out of a felt-tip pen, and gravity does not pour it. Ever finer pores pull it along: from the core to the nib, and from the nib into the paper.',
  limits: feltTipLimits,
  sources: [sources.marker, sources.washburn, sources.capillary, sources.tension, sources.viscosity, sources.ethanol],
  quiz: {
    question: 'Why does writing slowly with a felt-tip pen make a wider line?',
    options: ['Each spot stays under the tip longer, and ink soaks farther into the paper the longer it has.', 'Pressing longer squeezes more ink out of the core.', 'A slow tip is wetter, because gravity has more time to pour the ink down.'],
    answer: 0,
    explanation: 'At 5 mm/s each spot spends 0.200 s under the tip and the ink soaks 0.224 mm past it each side; at 20 mm/s it spends 0.050 s and soaks 0.112 mm. Four times as long soaks twice as far.',
  },
};

// ---------------------------------------------------------------------------
// Dip pen, and capillary action on its bench.
// ---------------------------------------------------------------------------

const dipSystem = trial(DIP_DEFAULTS, 'system'), dipNib = trial(DIP_DEFAULTS, 'nib'), dipTip = trial(DIP_DEFAULTS, 'tip'), dipBench = trial(DIP_DEFAULTS, 'capillary');

export const dipPenLimits = 'A steel nib drawn at true size and flat, 30 mm long and 7 mm wide, with a slit 0.02 mm wide at rest running 10 mm from the tip to a vent hole 2 mm across. It is dipped 3 mm into water-based ink, taken as water at 20 °C that wets the steel completely. The slit starts empty and fills from the tip as the gap between two plates, by Poiseuille’s law with the ink’s weight and no inertia, and stops at the vent hole. The nib is dipped with its tines at rest and pressed in the close up. Illustrative: the tines splay 0.1 mm for every newton, hinged at the vent hole, and the line is 0.1 mm wide with no press, widening by the splay. Time runs on a log scale from 1 ms to 1,000 s. Not modeled: the curve of a real nib, the drop held under it, the paper drawing ink out, and the ink running out.';

export const dipPenLesson = {
  simple: 'How does a dip pen hold ink with no reservoir, and why does pressing harder make a thicker line?',
  overview: 'A dip pen is a metal nib split down the middle. The slit between its two tines is a very narrow gap, and ink climbs into it and stays there by capillary action, the same pull that lifts water up a glass tube on the bench beside it. Pressing the nib splays the tines, widening the slit so far more ink flows. Press Play to dip the nib, and change the press to see the tip open and the line widen.',
  steps: [
    {title: 'Dip', body: 'The nib goes into the ink, and the ink wets the steel.'},
    {title: 'Climb the slit', body: 'The slit is a gap between two plates, and ink climbs it to the vent hole.'},
    {title: 'Touch the paper', body: 'At the tip, the paper draws ink out of the slit.'},
    {title: 'Press for a thick line', body: 'Pushing down splays the tines: the slit widens, much more ink flows, and the line widens.'},
  ],
  parts: [
    {name: 'Nib and inkwell', role: 'The steel nib with its slit and vent hole, dipped into ink.'},
    {name: 'Tip on the paper, close up', role: 'The tines, the ink between them and the line they leave.'},
    {name: 'Capillary bench', role: 'A glass tube and a wedge of two plates, showing the same pull.'},
    {name: 'Rise over time', role: 'The level in the tube and the wedge after dipping.'},
  ],
  tryIt: [
    dipNib('Dip the nib', 'Press Play and watch the nib.', 'The slit between the tines is a gap 0.02 mm wide. Ink climbs it from the tip and reaches the vent hole 10 mm up in 207 ms.'),
    dipNib('Why it holds', 'Look at the nib.', 'A slit 0.02 mm wide could hold water-based ink 742 mm up, far above the vent hole, so gravity does not drain the slit.'),
    dipTip('Press for a downstroke', 'Press the nib with 0.5 N.', 'The tines splay and the tip opens from 0.02 mm to 0.07 mm, 3.5 times as wide. Ink flows between plates with the cube of their gap, so the slit now lets ink through 43 times as easily, and the line widens to 0.15 mm.', {press: 0.5}),
    dipTip('Press hard', 'Press the nib with 1 N.', 'The tip opens to 0.12 mm and the line to 0.20 mm, twice as wide as with no press, and the slit lets ink through 216 times as easily. Even this wide, it could hold ink 124 mm up.', {press: 1}),
    dipTip('A hairline', 'Press the nib with 0.1 N.', 'Light pressure barely flexes the tines: the tip opens only to 0.03 mm and the line is 0.11 mm wide.', {press: 0.1}),
    dipBench('A slit is a pair of plates', 'Press Play and look at the wedge on the bench.', 'Between two plates the gap times the height stays the same. Where the wedge is 0.10 mm wide the water stands 148.4 mm high, and where it is 1.00 mm wide only 14.8 mm: ten times the gap, a tenth of the height.'),
  ],
  deeper: [
    {title: 'A slit for a reservoir', body: 'A dip pen is usually a metal nib with a central slit that acts as a capillary channel, like a fountain pen’s, mounted in a holder, often of wood. Most have no reservoir but a small hole, indent or pocket where a drop of ink is held by capillary action, so the writer must dip again often.'},
    {title: 'Thick and thin', body: 'Pushing down on a pointed nib splays its tines and lets more ink flow through the widened slit, so thick lines come on downstrokes. Lighter pressure flexes the tines less and makes thinner strokes, and the finest hairlines come on upstrokes and sideways strokes. Pressed too hard on an upstroke, the tines are likely to dig into the paper.'},
    {title: 'The cube of the gap', body: 'Ink squeezing between two plates is held back by its viscosity along both of them. At a given pull the flow grows with the cube of the gap, so a slit opened to 3.5 times its width lets 43 times as much ink through.'},
    {title: 'How flexible a nib is', body: 'A nib’s flexibility depends on how springy its metal is, how thick it is and its shape: longer tines flex more than short ones, and a more curved nib is stiffer.'},
    {title: 'The vent hole', body: 'The hole at the top of the slit ends it and relieves the metal, keeping the nib from cracking along the slit after it has flexed many times.'},
  ],
  misconception: 'A dip pen’s ink does not run down the nib under its own weight. Capillary action could hold it hundreds of millimeters up the slit; the paper draws it out at the tip.',
  limits: dipPenLimits,
  sources: [sources.dipPen, sources.nib, sources.fountain, sources.capillary],
  quiz: {
    question: 'Why does pressing a dip pen harder make a thicker line?',
    options: ['The tines splay and widen the slit, and far more ink flows through a wider gap.', 'Pressing squeezes ink out of the holder.', 'Paper soaks up ink faster when it is pressed.'],
    answer: 0,
    explanation: 'At 0.5 N the tip opens from 0.02 mm to 0.07 mm, and because flow grows with the cube of the gap the slit lets ink through 43 times as easily.',
  },
};

const capBench = trial(DIP_DEFAULTS, 'capillary'), capMeniscus = trial(DIP_DEFAULTS, 'meniscus'), capChart = trial(DIP_DEFAULTS, 'chart');

export const capillaryLimits = 'A glass tube and a wedge of two glass plates dipped 15 mm into a dish, drawn with heights at true size and widths 10 times wider. Water and ethanol at 20 °C, both taken to wet clean glass completely; mercury meeting glass at 140°, with its surface tension at 20 °C, its density near room temperature and its viscosity at 25 °C. Gravity 9.81 m/s². The rise follows Poiseuille’s law with the column’s weight and no inertia, starting as the empty tube is dipped; each strip of the wedge rises on its own, from a gap of 0.1 mm to one of 1.0 mm across 40 mm. Jurin’s law leaves out the liquid in the meniscus itself. Time runs on a log scale from 1 ms to 1,000 s. Not modeled: liquid climbing the outside of the glass, the dish’s level falling, evaporation, and dirt on the glass, to which contact angles are extremely sensitive.';

export const capillaryActionLesson = {
  simple: 'Why does water climb a narrow glass tube, and why does mercury sink in one?',
  overview: 'Where a liquid meets glass its surface curves. Water wets glass, so its surface curves up the walls and pulls the water up the tube until the weight of the column balances the pull. Mercury does not wet glass: its surface bulges and pushes it down. Change the liquid and the tube’s radius, press Play, and watch the tube and a wedge of two plates fill.',
  steps: [
    {title: 'Meet the glass', body: 'Where the liquid touches the glass it either spreads over it or draws back from it, which sets the angle at which its surface meets the wall.'},
    {title: 'Curve the surface', body: 'In a narrow tube the whole surface curves, and a curved surface pulls with twice the surface tension over the tube’s radius.'},
    {title: 'Climb', body: 'The pull drives the liquid up, held back by its viscosity along the walls.'},
    {title: 'Balance', body: 'The liquid stops where the weight of the column balances the pull.'},
  ],
  parts: [
    {name: 'Capillary bench', role: 'A glass tube and a wedge of two plates standing in a dish.'},
    {name: 'Meniscus, close up', role: 'The curved top of the liquid in the tube.'},
    {name: 'Rise over time', role: 'The level in the tube and between the plates after dipping.'},
    {name: 'Nib and inkwell', role: 'A dip pen’s slit, filling by the same pull.'},
  ],
  tryIt: [
    capBench('Water in a narrow tube', 'Keep water and a 0.2 mm tube, and press Play.', 'Water climbs the tube and settles 74.2 mm above the water outside, getting 90% of the way in 2.56 s. The capillary action page rounds this rise to 70 mm.'),
    capBench('Half the radius', 'Set the tube radius to 0.1 mm and press Play.', 'In a tube half as wide the water stands twice as high, 148.4 mm, but it takes 18.72 s to get 90% of the way: 7.3 times as long.', {radius: 0.1}),
    capChart('Plates rise as high, more slowly', 'Keep the 0.2 mm tube, press Play and watch the chart.', 'Where the wedge’s gap is 0.20 mm the water stands exactly as high as in the tube, 74.2 mm, but the faint line lags behind: 90% of the way takes 3.83 s, 1.5 times as long.'),
    capMeniscus('The pull of a curved surface', 'Press Play and look at the meniscus.', 'Water wets glass, so its surface meets the wall straight along it and dips into a bowl in the middle. That curved surface pulls with 728 Pa, just what a column of water 74.2 mm tall weighs.'),
    capBench('Ethanol', 'Choose ethanol and press Play.', 'Ethanol’s surface tension is less than a third of water’s, and it is lighter too, so it climbs only 28.8 mm, getting 90% of the way in 1.90 s.', {liquid: 1}),
    capBench('Mercury stays out', 'Choose mercury and press Play.', 'Mercury does not wet glass: its surface bulges up and pushes down with 3.73 kPa. The 15 mm of mercury around the tube pushes up with only 1.99 kPa, so none gets in.', {liquid: 2}),
    capBench('Mercury pushed down', 'Choose mercury, set the tube radius to 0.5 mm and press Play.', 'In the wider tube mercury gets in, but its bulging surface holds it 11.2 mm below the level outside.', {liquid: 2, radius: 0.5}),
  ],
  deeper: [
    {title: 'Jurin’s law', body: 'The height a liquid climbs in a tube is twice its surface tension times the cosine of its contact angle, over its density, gravity and the tube’s radius. The narrower the tube, the higher the liquid. The law holds only in tubes narrower than the capillary length, 2.72 mm for water.'},
    {title: 'Rounded on the page', body: 'For water in a glass tube, with a surface tension of 0.0728 N/m, a density of 1,000 kg/m³ and gravity of 9.81 m/s², the capillary action page gives a rise of 70 mm in a tube 0.2 mm in radius. The formula gives 74.2 mm, which the page rounds. Its 0.7 mm for a tube 2 cm in radius is 0.742 mm, though a tube that wide is far beyond the capillary length, where Jurin’s law no longer holds.'},
    {title: 'Two plates', body: 'Between two glass plates the gap times the height of the liquid stays the same. Tilt two plates into a wedge and the water’s edge between them traces a hyperbola, highest where they are closest.'},
    {title: 'Rising over time', body: 'A liquid climbing a narrow tube is held back by its viscosity along the walls, and the narrower the tube, the harder it is held back: a tube twice as wide lets it climb four times as fast, though only half as high. Early on, while the column hardly weighs anything, the length climbed grows with the square root of time, as Washburn’s equation has it; later the weight slows it, and it creeps up to the height where it balances.'},
    {title: 'Mercury', body: 'With some pairs, such as mercury and glass, the liquid holds itself together more strongly than it holds the solid, so its surface bulges and capillary action works in reverse, as in barometers and thermometers. A tube dipped 15 mm lets mercury in only if the depression is shallower than the dip: here, from a radius of 0.4 mm.'},
  ],
  misconception: 'Capillary action is not suction from the top of the tube. The liquid’s curved surface pulls it up, and it stops where the weight of the column balances that pull.',
  limits: capillaryLimits,
  sources: [sources.capillary, sources.jurin, sources.capillaryLength, sources.meniscus, sources.wetting, sources.contactAngle, sources.washburn, sources.tension, sources.viscosity, sources.ethanol, sources.mercury],
  quiz: {
    question: 'Why does water climb higher in a narrower tube?',
    options: ['Its curved surface pulls with twice the surface tension over the radius, so a narrower tube pulls harder and holds up a taller column.', 'A narrow tube squeezes the water upward.', 'The air pressure is lower inside a narrow tube.'],
    answer: 0,
    explanation: 'The pull balances the column’s weight, so the height grows as the radius shrinks: 74.2 mm in a 0.2 mm tube, 148.4 mm in a 0.1 mm one.',
  },
};

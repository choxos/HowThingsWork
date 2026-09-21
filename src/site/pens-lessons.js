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

const ballSystem = trial(BALLPOINT_DEFAULTS, 'system'), ballDetail = trial(BALLPOINT_DEFAULTS, 'ball'), ballRefill = trial(BALLPOINT_DEFAULTS, 'refill');

export const ballpointLimits = 'A ballpoint pen drawn at true size, writing a 50 mm line at 10 mm a second with its refill square to the paper. The ball rolls without slipping and starts clean, and ink touches it only at its top. Where it writes only turns the pen and the paper together. Illustrative: a refill bore 2.0 mm across holding a 60 mm column of ink, weighed as water of 1,000 kg/m³ under gravity of 9.81 m/s²; a line drawn half as wide as the ball; and an ordinary refill’s ink drawn pulled 5 mm back from the ball when it points up. Whether an ordinary refill writes follows the source: pointed up, gravity pulls its ink away from the tip and it stops, while pointed down, sideways or in orbit it writes. Not modeled: how the ink wets the ball and the socket, how much ink a line uses, how hard the pen is pressed, and the ink drying.';

export const ballpointLesson = {
  simple: 'How does a ballpoint pen roll ink onto the paper?',
  overview: 'A ballpoint pen has a hard ball held in a socket at the end of a tube of thick ink. As the pen moves, the ball rolls: its top turns through the ink inside the socket and its bottom lays that ink on the paper. In most pens gravity keeps the ink down against the ball. Change the ball, which way the pen points and the refill to see how often the ball turns and when the ink stops reaching it.',
  steps: [
    {title: 'Ink against the ball', body: 'The ink sits in the refill’s tube, resting on the ball’s top inside its brass socket.'},
    {title: 'Roll the ball', body: 'Moving the pen rolls the ball along the paper without slipping.'},
    {title: 'Carry the ink round', body: 'Each point on the ball picks up ink at the top and turns round to the paper at the bottom.'},
    {title: 'Keep it fed', body: 'Gravity, or gas pressure in a sealed refill, keeps the ink pressed down onto the ball.'},
  ],
  parts: [
    {name: 'Refill', role: 'The tube of ink, the brass socket and the ball.'},
    {name: 'Ball, close up', role: 'The ball turning in its socket, carrying ink round to the paper.'},
    {name: 'Paper and line', role: 'The line the ball lays.'},
    {name: 'Weight along the refill', role: 'The ink’s weight, and how much of it pushes the ink toward the ball.'},
  ],
  tryIt: [
    ballSystem('Write a line', 'Keep the 0.7 mm ball on a desk and press Play.', 'The ball rolls along the paper and turns 22.74 times in the 50 mm. Its ink reaches the paper only after 1.100 mm, half a turn after the ball starts rolling, so the line is 48.9 mm long.'),
    ballDetail('A fine ball', 'Choose the 0.3 mm ball and press Play.', 'A smaller ball must turn more often: 53.05 times in the same 50 mm, once every 0.942 mm, and its ink reaches the paper after only 0.471 mm.', {ball: 0.3}),
    ballDetail('A broad ball', 'Choose the 1.4 mm ball and press Play.', 'This ball turns only 11.37 times in 50 mm, once every 4.398 mm: twice as wide as the 0.7 mm ball, it turns half as often.', {ball: 1.4}),
    ballSystem('On a wall', 'Write on a wall.', 'Pointing sideways, none of the ink’s weight acts along the refill: gravity neither brings the ink to the ball nor pulls it away, as in orbit, where the ink’s capillary forces alone hold it at the ball.', {place: 1}),
    ballSystem('On the ceiling', 'Write on the ceiling and press Play.', 'Pointing up, all of the ink’s weight, 588.6 Pa on the ball’s end of the refill, now pulls the ink away from the ball. Most ordinary ballpoints stop writing like this, and the ball rolls on dry.', {place: 2}),
    ballRefill('A pressurized refill', 'Keep writing on the ceiling, choose the pressurized refill and press Play.', 'Nitrogen presses a float onto the ink at nearly 310 kPa, 527 times what the column of ink weighs, so the ink stays on the ball and the pen writes its 48.9 mm line pointing up.', {place: 2, refill: 1}),
    ballSystem('In orbit', 'Take the ordinary refill into orbit and press Play.', 'Nothing weighs, so gravity neither feeds the ink nor takes it away. The capillary forces in the ink still hold it at the ball, and a regular ballpoint writes pointed any way.', {place: 3}),
  ],
  deeper: [
    {title: 'A ball in a socket', body: 'A ballpoint pen dispenses ink, usually a paste, over a hard ball rolling in its point. The ball is steel, brass or tungsten carbide, housed in a brass socket. Early inventors found that if the socket was too tight or the ink too thick, the ink never reached the paper; too loose or too thin, and the pen leaked or smeared.'},
    {title: 'Rolling without slipping', body: 'Where a rolling ball touches the paper it does not slide, so it turns once for every π times its diameter of line. A 0.7 mm ball turns 454,728 times in a kilometer of writing, and every point on the ball’s middle passes through the ink and onto the paper once a turn.'},
    {title: 'Ball sizes', body: 'Ballpoint tips hold balls from 0.28 mm to 1.6 mm across. Standard sizes include 0.3, 0.38, 0.4 and 0.5 mm; 0.7 mm, called fine; 0.8 mm; 1.0 mm, called medium; and 1.2 and 1.4 mm, called broad. The ball’s diameter is not the width of the line, which also depends on the ink and on how hard you press.'},
    {title: 'Gravity and orbit', body: 'In most ballpoints gravity brings the ink down to the ball. Most do not work upside down, because gravity pulls the ink inside the pen away from the tip. In orbit a regular ballpoint still writes pointed any way, because the capillary forces in its ink are stronger than a weight that is not there; ESA astronaut Pedro Duque confirmed it in 2003.'},
    {title: 'The Space Pen', body: 'The Space Pen seals a thixotropic ink in a pressurized reservoir. Compressed nitrogen at nearly 310 kPa pushes a sliding float against the ink, so the pen writes at any angle, in zero gravity and underwater, from −34 to 121 °C.'},
    {title: 'Thick ink', body: 'Ballpoint ink is oil-based and viscous. The more viscous the ink, the faster it dries, but the harder you must press to lay it down. Rollerball pens use the same rolling ball with water-based inks that flow more easily.'},
  ],
  misconception: 'A ballpoint pen does not squeeze ink out of its tip. The ball rolls, and its surface carries the ink round from the refill to the paper.',
  limits: ballpointLimits,
  sources: [sources.ballpoint, sources.spacePen, sources.rollerball],
  quiz: {
    question: 'Over the same line, why does a 0.3 mm ball turn more often than a 1.4 mm ball?',
    options: ['It rolls without slipping, so it turns once for every π times its diameter of line, and a smaller ball has less far to go round.', 'Smaller balls are pressed harder against the paper.', 'The ink pushes a small ball round faster.'],
    answer: 0,
    explanation: 'In 50 mm the 0.3 mm ball turns 53.05 times and the 1.4 mm ball 11.37 times: once every 0.942 mm against once every 4.398 mm.',
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

import {PAPER_DEFAULTS} from './epaper-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  electronicPaper: {title: 'Wikipedia: Electronic paper', url: 'https://en.wikipedia.org/wiki/Electronic_paper'},
  eInk: {title: 'Wikipedia: E Ink', url: 'https://en.wikipedia.org/wiki/E_Ink'},
  eInkHow: {title: 'E Ink: Electronic ink technology', url: 'https://www.eink.com/tech/detail/How_it_works'},
  eInkChinese: {title: 'E Ink, in Chinese: Electronic ink technology', url: 'https://cn.eink.com/tech/detail/How_it_works'},
  eReader: {title: 'Wikipedia: E-reader', url: 'https://en.wikipedia.org/wiki/E-reader'},
  kindle: {title: 'Wikipedia: Amazon Kindle', url: 'https://en.wikipedia.org/wiki/Amazon_Kindle'},
  electrophoresis: {title: 'Wikipedia: Electrophoresis', url: 'https://en.wikipedia.org/wiki/Electrophoresis'},
  zeta: {title: 'Wikipedia: Zeta potential', url: 'https://en.wikipedia.org/wiki/Zeta_potential'},
  stokes: {title: 'Wikipedia: Stokes’s law', url: 'https://en.wikipedia.org/wiki/Stokes%27s_law'},
  reynolds: {title: 'Wikipedia: Reynolds number', url: 'https://en.wikipedia.org/wiki/Reynolds_number'},
  hexane: {title: 'Wikipedia: Hexane', url: 'https://en.wikipedia.org/wiki/Hexane'},
  permittivity: {title: 'Wikipedia: Relative permittivity', url: 'https://en.wikipedia.org/wiki/Relative_permittivity'},
  vacuum: {title: 'Wikipedia: Vacuum permittivity', url: 'https://en.wikipedia.org/wiki/Vacuum_permittivity'},
  charge: {title: 'Wikipedia: Elementary charge', url: 'https://en.wikipedia.org/wiki/Elementary_charge'},
  gravity: {title: 'Wikipedia: Standard gravity', url: 'https://en.wikipedia.org/wiki/Standard_gravity'},
  titania: {title: 'Wikipedia: Titanium dioxide', url: 'https://en.wikipedia.org/wiki/Titanium_dioxide'},
  beerLambert: {title: 'Wikipedia: Beer-Lambert law', url: 'https://en.wikipedia.org/wiki/Beer%E2%80%93Lambert_law'},
  electrowetting: {title: 'Wikipedia: Electrowetting', url: 'https://en.wikipedia.org/wiki/Electrowetting'},
  contactAngle: {title: 'Wikipedia: Contact angle', url: 'https://en.wikipedia.org/wiki/Contact_angle'},
  surfaceTension: {title: 'Wikipedia: Surface tension', url: 'https://en.wikipedia.org/wiki/Surface_tension'},
  ptfe: {title: 'Wikipedia: Polytetrafluoroethylene', url: 'https://en.wikipedia.org/wiki/Polytetrafluoroethylene'},
};

/** What every lesson on the ink leaves out or takes without a source. */
export const paperLimits = 'Not from a source: n-hexane standing in for the pages’ hydrocarbon oil, a drive of 0 to 30 V, and the particles’ zeta potentials, spread evenly across the 40 to 60 mV of a stable colloid. The titania is taken to carry a negative charge, like E Ink’s white particles, since the page does not give its sign. The field is taken as uniform, with the capsule’s wall, the binder and the electrodes taking none of the voltage. The light sent back is illustrative: in each column the particle nearest the viewer decides, a dye dims light by a factor e every 25 μm, and particles pack 3 deep at a wall. The particles do not push on one another, and the waveforms real screens use to write shades of gray are left out. Here the particles stay where the drive leaves them; how real inks keep them from sinking is left out.';

/** What the electrowetting pixel takes without a source. */
export const wettingLimits = 'Not from a source: a pixel 150 μm wide holding an oil film 5 μm thick on 1 μm of fluoropolymer with PTFE’s dielectric constant and strength, an oil and water tension of 50 mN/m, and a contact angle of 170° through the water with no voltage. The oil is drawn as it settles: a film until a round drop at its contact angle fits inside the pixel, then that drop, centered. How fast the oil moves, where in the pixel it gathers, and the contact angle saturation the Electrowetting page describes are left out.';

// ---------------------------------------------------------------------------
// Electronic paper.
// ---------------------------------------------------------------------------

const paperCell = trial(PAPER_DEFAULTS, 'cell'), paperLight = trial(PAPER_DEFAULTS, 'light');

export const electronicPaperLimits = `The e-reader is drawn at true size with an illustrative body, its pixels 200 times larger, the ink 2,000 times larger and the electrowetting pixel 500 times larger. The ink moves 100 times slower than it does. ${paperLimits} ${wettingLimits}`;

export const electronicPaperLesson = {
  simple: 'How does electronic paper change its image without shining?',
  overview: 'Electronic paper sends back the light that falls on it, like ink on paper. In its simplest kind, white titania particles about 1 μm across float in dark dyed oil between two plates. A voltage across the plates pulls the charged particles to the front, where they send the light back, or to the back, where the dye hides them, and with the voltage off they stay where they are. Press Play to write a pixel, then change the gap, the drive, the pulse and the ink.',
  steps: [
    {title: 'Charge the particles', body: 'Surfactants and charging agents in the oil give the titania particles an electric charge.'},
    {title: 'Apply a field', body: 'Transistors select a pixel, and its electrodes put a voltage across the ink under it.'},
    {title: 'Pull the particles through the oil', body: 'The field pulls on the charged particles and the oil drags on them, so they move at a steady speed.'},
    {title: 'Turn the drive off', body: 'With the field gone nothing moves the particles, so the image stays with no power.'},
    {title: 'Send the light back', body: 'White particles at the front send light back to the reader; behind the dye they send back little.'},
  ],
  parts: [
    {name: 'E-reader, true size', role: 'The screen whose pixels the ink makes.'},
    {name: 'Pixels, close up', role: 'The pixel being written among neighbors that hold their shades.'},
    {name: 'The ink, cut open', role: 'Charged particles carried across the gap by the field.'},
    {name: 'Light sent back', role: 'How bright the pixel is as the particles move.'},
    {name: 'Electrowetting pixel, cut open', role: 'A different way to make paper-like pixels, with colored oil.'},
  ],
  tryIt: [
    paperCell('Write a white pixel', 'Press Play and watch the ink.', 'A field of 375 kV/m carries each titania particle across 39 μm of dyed oil at about 697 μm/s. A particle at 50 mV crosses in 56 ms and the slowest in 70 ms, and the pixel goes from sending back 5% of its light to 100%.'),
    paperLight('The drive turns off', 'Press Play and watch the light after the gold bar ends.', 'The pulse ends at 80 ms and the drive stays off for 50 ms more. Every particle stays where the drive left it, so the light stays at 100% with no drive at all.'),
    paperCell('Halve the gap', 'Set the gap to 20 μm and press Play.', 'The same 15 V makes a field twice as strong over half the distance, so a particle crosses in 14 ms, about four times faster. But white particles at the back now sit behind only 17 μm of dye, and the pixel sends back 26% of its light before it is written.', {gap: 20}),
    paperLight('A weaker drive', 'Set the drive to 5 V and press Play.', 'A particle now needs 168 ms to cross, so the 80 ms pulse carries the white particles only 50% of the way and the pixel stops at 25% of its light: a shade of gray that stays with the drive off.', {voltage: 5}),
    paperLight('A shorter pulse', 'Set the pulse to 30 ms and press Play.', 'The drive stops before any particle arrives. The white particles have gone 57% of the way and the pixel holds 31% of its light. Pulses of different lengths give different shades; a Kindle shows 16.', {pulse: 30}),
    paperCell('Write black', 'Choose Write black and press Play.', 'The field points the other way and the white particles sink to the back, behind 37 μm of dye, so the pixel falls from 100% of its light to 5%.', {target: 1}),
    paperCell('Black and white in a capsule', 'Choose black and white in capsules and press Play.', 'In a clear capsule the black particles sink as the white ones rise, and the pixel turns white as soon as the white particles pass the black: 36% of its light at 20 ms and 99% at 30 ms, before a particle at 50 mV has crossed at 56 ms.', {ink: 1}),
  ],
  deeper: [
    {title: 'Pulled through oil', body: 'A charged particle in a field feels a steady pull, and the oil drags on it harder the faster it goes, so it moves at a steady speed: the field times its mobility. For a particle whose cloud of screening charge is much larger than itself, which the Electrophoresis page says suits non-polar fluids, Hückel’s mobility is 2εrε0ζ/(3η). In n-hexane, with a relative permittivity of 1.89 and a viscosity of 0.3 mPa·s, a particle at 50 mV has a mobility of 1.86 × 10⁻⁹ m²/(V·s), so 15 V across 40 μm moves it at 697 μm/s.'},
    {title: 'A few dozen electrons', body: 'Hückel’s mobility is what a sphere carrying a charge of 4πεrε0Rζ reaches when Stokes’s drag, 6πηRv, balances the field’s pull. For a titania particle 1 μm across at 50 mV that charge is 5.26 × 10⁻¹⁸ C, about 33 electron charges. The radius cancels: a larger particle carries more charge and meets more drag in the same proportion, so its speed depends on its zeta potential and not on its size.'},
    {title: 'No coasting', body: 'At 697 μm/s a particle 1 μm across in n-hexane has a Reynolds number of 0.0015, deep in the slow flow Stokes’s law describes. Rutile’s density of 4.23 g/cm³ gives it so little mass that it comes within a factor e of full speed in 0.78 μs, having gone 0.55 nm, so it starts and stops with the field.'},
    {title: 'Why it does not sink here', body: 'Titania of 4.23 g/cm³ in n-hexane of 0.6606 g/mL would sink at 6.48 μm/s, across 39 μm in 6.0 s with the pixel lying flat, while the field pulls 108 times harder than gravity. The Electronic paper page says particle displays have intrinsic bistability and keep their contents after the voltage stops; how real inks hold their particles against gravity is left out, and here they stay where the drive leaves them.'},
    {title: 'Thin is fast, thick is dark', body: 'At the same voltage a thinner gap makes a stronger field and a shorter way across, so the crossing time grows as the gap squared: 3.2 ms at 10 μm and 355 ms at 100 μm, the ends of the page’s range. But a thin layer of dye hides little: white particles at the back of a 10 μm gap still send back 57% of their light, and at 100 μm only 0.04%.'},
    {title: 'A slowed clock', body: 'The ink moves 100 times slower here than it does: the write of 130 ms, an 80 ms pulse and 50 ms with the drive off, takes 13 s. E Ink gives updates as short as 120 ms.'},
  ],
  misconception: 'Electronic paper does not glow. It sends back the light that falls on it, and a front light, when there is one, lights the page from the front.',
  limits: electronicPaperLimits,
  sources: [sources.electronicPaper, sources.eInk, sources.eInkHow, sources.electrophoresis, sources.zeta, sources.stokes, sources.reynolds, sources.hexane, sources.permittivity, sources.titania, sources.beerLambert, sources.vacuum, sources.charge, sources.gravity, sources.electrowetting, sources.ptfe, sources.kindle],
  quiz: {
    question: 'Why does a pulse too short to carry the particles across leave the pixel gray?',
    options: ['The particles stop partway, behind some of the dye, and stay there with the drive off.', 'The pixel is only half powered, and it dims as the battery drains.', 'The particles change color partway across.'],
    answer: 0,
    explanation: 'At 15 V a 30 ms pulse leaves the white particles 57% of the way across, and the pixel holds 31% of its light until it is written again.',
  },
};

// ---------------------------------------------------------------------------
// Electronic ink.
// ---------------------------------------------------------------------------

const INK_DEFAULTS = {...PAPER_DEFAULTS, ink: 1};
const inkCell = trial(INK_DEFAULTS, 'cell'), inkLight = trial(INK_DEFAULTS, 'light'), inkPixel = trial(INK_DEFAULTS, 'pixel');

export const electronicInkLesson = {
  simple: 'How does electronic ink hold an image with no power?',
  overview: 'E Ink’s ink is a sheet of tiny capsules, each holding negatively charged white particles and positively charged black particles in a clear fluid, between two electrodes. A field across a capsule pulls one color to the top and pushes the other to the bottom, and with the field off both stay where they are. Press Play to write a capsule white, then change the drive, the pulse and the capsule’s size.',
  steps: [
    {title: 'Two kinds of particle', body: 'White particles carry a negative charge and black particles a positive one.'},
    {title: 'Apply a field', body: 'The electrode above the capsule turns positive to write white, or negative to write black.'},
    {title: 'Move opposite ways', body: 'The field pulls one color up and pushes the other down, and the two pass through each other.'},
    {title: 'Stop', body: 'When the drive turns off, nothing moves the particles, and the capsule keeps its color.'},
    {title: 'Look from above', body: 'The reader sees whichever particles are nearest the top.'},
  ],
  parts: [
    {name: 'The ink, cut open', role: 'A capsule between its electrodes, with its white and black particles.'},
    {name: 'Light sent back', role: 'How bright the capsule looks as the particles move.'},
    {name: 'Pixels, close up', role: 'Capsules over the pixels, which they do not line up with.'},
  ],
  tryIt: [
    inkCell('Write white', 'Press Play and watch the capsule.', 'The top electrode turns positive: it pulls the negatively charged white particles up and pushes the positively charged black ones down. The middle ones meet at 28 ms, and the capsule sends back 99% of its light by 30 ms.'),
    inkCell('Write black', 'Choose Write black and press Play.', 'The field points the other way, so the black particles rise. The capsule still sends back 65% of its light at 20 ms and none by 30 ms.', {target: 1}),
    inkLight('A shorter pulse', 'Set the pulse to 20 ms and press Play.', 'The drive stops at 20 ms with the white particles 51% of the way, and the capsule holds 36% of its light, a shade of gray, with no drive.', {pulse: 20}),
    inkCell('A smaller capsule', 'Set the gap to 20 μm and press Play.', 'Across a capsule 20 μm wide the same 15 V makes a field of 750 kV/m, and a particle crosses in 14 ms.', {gap: 20}),
    inkPixel('Capsules over pixels', 'Choose the Carta HD screen.', 'Its pixels lie 84.7 μm apart, so only 2.1 capsules of 40 μm fit across one, and a capsule over the edge between two pixels shows both of their colors.', {screen: 2}),
    inkLight('A capsule 100 μm across', 'Set the gap to 100 μm and the pulse to 200 ms, and press Play.', 'A particle at 50 mV now needs 355 ms to cross, yet the capsule turns white within the 200 ms pulse, once its white particles pass its black ones; the drive stops with them 73% of the way.', {gap: 100, pulse: 200}),
  ],
  deeper: [
    {title: 'Which particle is which', body: 'E Ink’s page on its Carta ink gives the white particles a negative charge and the black a positive one, and so does its page in Chinese. A later paragraph on the English page says the reverse. The model follows the first: a positive top electrode writes white.'},
    {title: 'Capsules and cups', body: 'The Electronic paper page gives E Ink’s microcapsules as 0.04 mm across, and an early sheet’s capsules as about 40 μm, laminated to 80 μm thick, twice ordinary paper. SiPix used sealed cups 0.15 mm across instead.'},
    {title: 'White halfway across', body: 'Looking down on a capsule you see whichever particles are nearest the top. White and black particles pass one another halfway, so a capsule written white brightens most in the middle of the write: at 15 V across 40 μm the middle ones meet at 28 ms.'},
    {title: 'How many particles', body: 'The slice drawn is one particle thick. Packed 3 deep at the wall in the same way, a whole capsule 40 μm across would hold about 6,500 particles of each color.'},
    {title: 'Shades of gray', body: 'The first Kindle, in 2007, showed 4 levels of gray, and Kindles from 2009 showed 16. Sixteen levels take 4 bits a pixel.'},
    {title: 'Updates and power', body: 'E Ink gives updates as short as 120 ms and says constant updates reduce the power efficiency of its inks: the ink takes power only to change.'},
  ],
  misconception: 'The image does not stay because the screen keeps a charge on the ink. The field is off, and the particles stay because nothing moves them.',
  limits: `The capsule is cut open 2,000 times larger, as a slice through its middle as wide as the gap, and the ink moves 100 times slower than it does. ${paperLimits}`,
  sources: [sources.eInkHow, sources.eInkChinese, sources.eInk, sources.electronicPaper, sources.kindle, sources.electrophoresis, sources.zeta, sources.stokes],
  quiz: {
    question: 'Why does a capsule keep its color with the power off?',
    options: ['Nothing moves the particles once the field is gone, so they stay where it left them.', 'A battery keeps the field on between pages.', 'The particles are magnetic and cling to the electrode.'],
    answer: 0,
    explanation: 'The field moves the particles only while it is on. The Electronic paper page calls this bistability: only changing the image takes power.',
  },
};

// ---------------------------------------------------------------------------
// Electrowetting display.
// ---------------------------------------------------------------------------

const wet = trial(PAPER_DEFAULTS, 'wetting');

export const electrowettingLesson = {
  simple: 'How does an electrowetting display move colored oil?',
  overview: 'An electrowetting pixel holds a film of colored oil on a water-repelling coating over an electrode, under water. With no voltage the oil lies flat and the pixel shows its color. A voltage between the electrode and the water makes the water wet the coating, and the water pushes the oil aside into a drop, uncovering a white surface beneath. Change the electrowetting drive and watch the oil gather.',
  steps: [
    {title: 'A film of colored oil', body: 'The oil wets the water-repelling coating better than water does, so it spreads over the pixel.'},
    {title: 'Apply a voltage', body: 'A voltage between the electrode and the water charges the coating like a capacitor.'},
    {title: 'The water wets the coating', body: 'The stored energy lowers the water’s tension against the coating, so the water meets it at a lower angle.'},
    {title: 'The oil gathers', body: 'Once a drop at the oil’s steeper angle fits inside the pixel, the water pushes the oil into it.'},
    {title: 'The white shows', body: 'The pixel looks as bright as the share of its white surface the oil uncovers.'},
  ],
  parts: [
    {name: 'Electrowetting pixel, cut open', role: 'The oil, the water, the coating and the electrode, with a chart of how much of the pixel the oil covers.'},
  ],
  tryIt: [
    wet('Pull the oil aside', 'Look at the electrowetting pixel.', 'At 40 V the water meets the fluoropolymer at 133.4° and the oil at 46.6°. The oil gathers into a drop 108 μm across, covering 41% of the pixel and uncovering 59% of the white beneath.'),
    wet('No voltage', 'Set the electrowetting drive to 0 V.', 'With no voltage the water meets the surface at 170°, and the oil lies flat, 5 μm thick, over the whole pixel, which shows the oil’s color.', {wetting: 0}),
    wet('Just below the threshold', 'Set the electrowetting drive to 14 V.', 'At 14 V a round drop at the oil’s angle would be 152 μm across, wider than the 150 μm pixel, so the oil stays a film.', {wetting: 14}),
    wet('Just past it', 'Set the electrowetting drive to 15 V.', 'At 15 V the drop fits, 149 μm across, and the oil suddenly covers only 78% of the pixel: past 14.6 V it pulls back all at once.', {wetting: 15}),
    wet('Full drive', 'Set the electrowetting drive to 50 V.', 'At 50 V the drop is 97 μm across and covers 33% of the pixel. The field in the fluoropolymer is 50 MV/m, close to PTFE’s dielectric strength of 60 MV/m.', {wetting: 50}),
  ],
  deeper: [
    {title: 'Why a voltage changes wetting', body: 'The Electrowetting page writes the contact angle as cos θ = (γs − γws⁰ + CV²/2)/γw: the voltage stores energy CV²/2 in the capacitor the insulating coating makes, which lowers the water’s tension against it. Over 1 μm with PTFE’s dielectric constant of 2.1, C is 18.6 μF/m², so at 40 V the stored energy is 14.9 mJ/m². Against an oil and water tension of 50 mN/m it raises cos θ by 0.298, from −0.985 to −0.687.'},
    {title: 'Two angles at one edge', body: 'Where water, oil and coating meet, the angle through the water and the angle through the oil add to 180°. With no voltage the water meets the coating at 170°, so the oil spreads at 10°; at 40 V the oil stands at 46.6°.'},
    {title: 'A drop of fixed volume', body: 'The oil keeps its volume: a film 5 μm thick over a 150 μm pixel is 112,500 μm³. A round drop meeting the surface at α with base radius a stands h = a·tan(α/2) high and holds πh(3a² + h²)/6, so the steeper its angle, the narrower the drop. At 40 V it is 108 μm across and 23.2 μm high.'},
    {title: 'Why not a higher voltage', body: 'The field in the coating is the voltage over its thickness: 40 MV/m at 40 V over 1 μm. PTFE breaks down at 60 MV/m, which 1 μm reaches at 60 V. A thinner coating needs less voltage for the same change in angle but breaks down at a lower voltage too: at PTFE’s strength, a coating 1 μm thick can raise cos θ by at most 0.67.'},
    {title: 'Brighter colors', body: 'The Electronic paper page says electrowetting lets one sub-pixel switch two colors instead of using red, green and blue filters, switches fast enough for video, and can be four times brighter than reflective LCDs. An electrofluidic variant hides its pigment in a reservoir under 5 to 10% of the pixel, could reflect over 85% of the light in its white state, and is less than 15 μm thick.'},
  ],
  misconception: 'The voltage does not push the oil itself. It changes how well the water wets the coating, and the water pushes the oil aside.',
  limits: `The pixel is drawn 500 times larger. ${wettingLimits}`,
  sources: [sources.electronicPaper, sources.electrowetting, sources.contactAngle, sources.ptfe, sources.surfaceTension, sources.vacuum],
  quiz: {
    question: 'What does the voltage change in an electrowetting pixel?',
    options: ['How well the water wets the coating, so the water pushes the oil aside.', 'The color of the oil.', 'How far charged particles travel through the oil.'],
    answer: 0,
    explanation: 'At 40 V the stored energy raises cos θ by 0.298, the water meets the coating at 133.4° instead of 170°, and the oil gathers to cover 41% of the pixel.',
  },
};

// ---------------------------------------------------------------------------
// E-reader.
// ---------------------------------------------------------------------------

const readerPixel = trial(INK_DEFAULTS, 'pixel'), readerBody = trial(INK_DEFAULTS, 'reader'), readerLight = trial(INK_DEFAULTS, 'light');

export const eReaderLesson = {
  simple: 'How does an e-reader show a page?',
  overview: 'An e-reader’s screen sends back the room’s light, like paper, instead of shining its own. Under each pixel an electrode puts a field across a sheet of capsules, and the page stays with the drive off, so power goes only into changing it. Choose a screen to see how its pixels and capsules compare, and press Play to write a pixel.',
  steps: [
    {title: 'Store the page', body: 'The page is held as a shade of gray for every pixel.'},
    {title: 'Address the pixels', body: 'Transistors behind the screen select the pixels to change.'},
    {title: 'Write each pixel', body: 'A pulse across the ink under a pixel moves its particles as far as that pixel’s shade needs.'},
    {title: 'Leave the page', body: 'With the drive off the particles stay, and so does the page.'},
    {title: 'Light the page', body: 'Room light, or a front light shining from the front, reflects off the page to the reader.'},
  ],
  parts: [
    {name: 'E-reader, true size', role: 'The screen, 6 inches across its diagonal.'},
    {name: 'Pixels, close up', role: 'Nine pixels and the capsules over them.'},
    {name: 'The ink, cut open', role: 'The capsule under the middle pixel.'},
    {name: 'Light sent back', role: 'How bright that pixel is as it is written.'},
  ],
  tryIt: [
    readerPixel('A Carta screen', 'Look at the pixels close up.', 'An E Ink Carta screen has 768 by 1,024 pixels at 212 ppi, 119.8 μm apart, so 3.0 capsules of 40 μm fit across a pixel. Its diagonal of 1,280 pixels over 6 inches gives 213 ppi.'),
    readerPixel('A basic Kindle', 'Choose the Kindle screen.', 'For 15 years a basic Kindle had 600 by 800 pixels at 167 ppi, 152.1 μm apart, with 3.8 capsules across a pixel. A diagonal of 1,000 pixels over 6 inches gives 166.7 ppi.', {screen: 0}),
    readerPixel('A Carta HD screen', 'Choose the Carta HD screen.', 'At 300 ppi the pixels lie 84.7 μm apart, with 2.1 capsules across each, and a diagonal of 1,800 pixels over 6 inches gives exactly 300 ppi.', {screen: 2}),
    readerBody('A page in memory', 'Look at the e-reader.', 'Its screen is 91.44 mm by 121.92 mm. With 16 shades of gray each pixel needs 4 bits, so a Carta page is 393,216 bytes and a Carta HD page 777,600.'),
    readerLight('Write a pixel', 'Press Play and watch the light sent back.', 'At 15 V a capsule 40 μm across turns white within 30 ms, and a particle at 50 mV crosses in 56 ms, inside the 120 ms E Ink gives as its fastest updates.'),
    readerPixel('Leave the page', 'Press Play and wait for the drive to turn off.', 'The middle pixel stays white with no drive, as its eight neighbors hold what was written before: only changing a page takes power.'),
  ],
  deeper: [
    {title: 'Light from the room', body: 'The E-reader page says electronic paper reflects light like ordinary paper, without the need for a backlight. The Kindle Paperwhite, announced in September 2012, added an LED front light that lights the page from the front.'},
    {title: 'Pixels per inch', body: 'The pixels per inch set the pitch: 25.4 mm over 212 is 119.8 μm. A screen’s diagonal in pixels over its 6 inches gives its density: the 1,280 pixels of Carta’s 768 by 1,024 give 213.3 ppi, against the 212 its page gives, and the 1,800 of Carta HD give 300.0.'},
    {title: 'Capsules do not line up', body: 'Capsules are coated on as a sheet, not placed one to a pixel. At 212 ppi about 3.0 capsules of 40 μm fit across a pixel and at 300 ppi only 2.1, so a capsule over the edge of two pixels shows both of their shades.'},
    {title: 'A page of gray', body: 'Sixteen shades take 4 bits a pixel. A Kindle page of 600 by 800 pixels is 240,000 bytes, a Carta page 393,216 and a Carta HD page 777,600.'},
    {title: 'Power only for changes', body: 'The E-reader page says the battery can last several weeks, because the screen needs power only to change what it shows. Here the pixels around the one being written hold their shades with no drive at all.'},
  ],
  misconception: 'A page on an e-reader does not need power to stay on the screen, only to change.',
  limits: `The e-reader is drawn at true size with an illustrative body, and its pixels 200 times larger. ${paperLimits} How the transistors behind the screen address its rows of pixels is left out.`,
  sources: [sources.eReader, sources.kindle, sources.eInk, sources.electronicPaper, sources.eInkHow],
  quiz: {
    question: 'Why can an e-reader’s battery last for weeks?',
    options: ['The page stays with the drive off, so power goes only into changing it.', 'Its screen is smaller than a phone’s.', 'Its front light turns off when no one is reading.'],
    answer: 0,
    explanation: 'The particles stay where the last pulse left them. Writing a pixel white at 15 V takes a pulse of tens of milliseconds, and then nothing more until the page turns.',
  },
};

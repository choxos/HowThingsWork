import {SCREEN_DEFAULTS} from './lcd-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  lcd: {title: 'Wikipedia: Liquid-crystal display', url: 'https://en.wikipedia.org/wiki/Liquid-crystal_display'},
  tn: {title: 'Wikipedia: Twisted nematic field effect', url: 'https://en.wikipedia.org/wiki/Twisted_nematic_field_effect'},
  liquidCrystal: {title: 'Wikipedia: Liquid crystal', url: 'https://en.wikipedia.org/wiki/Liquid_crystal'},
  nematic: {title: 'Wikipedia: Nematic', url: 'https://en.wikipedia.org/wiki/Nematic'},
  tft: {title: 'Wikipedia: Thin-film-transistor liquid-crystal display', url: 'https://en.wikipedia.org/wiki/Thin-film-transistor_liquid-crystal_display'},
  amlcd: {title: 'Wikipedia: Active-matrix liquid-crystal display', url: 'https://en.wikipedia.org/wiki/Active-matrix_liquid-crystal_display'},
  polarizer: {title: 'Wikipedia: Polarizer', url: 'https://en.wikipedia.org/wiki/Polarizer'},
  waveplate: {title: 'Wikipedia: Waveplate', url: 'https://en.wikipedia.org/wiki/Waveplate'},
  jones: {title: 'Wikipedia: Jones calculus', url: 'https://en.wikipedia.org/wiki/Jones_calculus'},
  birefringence: {title: 'Wikipedia: Birefringence', url: 'https://en.wikipedia.org/wiki/Birefringence'},
  ellipsoid: {title: 'Wikipedia: Index ellipsoid', url: 'https://en.wikipedia.org/wiki/Index_ellipsoid'},
  frank: {title: 'Wikipedia: Distortion free energy density', url: 'https://en.wikipedia.org/wiki/Distortion_free_energy_density'},
  lcdGerman: {title: 'Wikipedia, in German: Flüssigkristallanzeige', url: 'https://de.wikipedia.org/wiki/Fl%C3%BCssigkristallanzeige'},
  schadt: {title: 'Wikipedia, in German: Schadt-Helfrich-Zelle', url: 'https://de.wikipedia.org/wiki/Schadt-Helfrich-Zelle'},
  merck: {title: 'Merck Patent: US10072210B2, a liquid-crystalline medium (Google Patents)', url: 'https://patents.google.com/patent/US10072210B2/en'},
  nhd43: {title: 'Newhaven Display: NHD-4.3-480272EF-ASXN datasheet', url: 'https://newhavendisplay.com/content/specs/NHD-4.3-480272EF-ASXN.pdf'},
  nhd15: {title: 'Newhaven Display: NHD-1.5-128128UGC3 datasheet', url: 'https://newhavendisplay.com/content/specs/NHD-1.5-128128UGC3.pdf'},
  responseTime: {title: 'Wikipedia: Response time (technology)', url: 'https://en.wikipedia.org/wiki/Response_time_(technology)'},
  contrast: {title: 'Wikipedia: Contrast ratio', url: 'https://en.wikipedia.org/wiki/Contrast_ratio'},
  srgb: {title: 'Wikipedia: sRGB', url: 'https://en.wikipedia.org/wiki/SRGB'},
  rgb: {title: 'Wikipedia: RGB color model', url: 'https://en.wikipedia.org/wiki/RGB_color_model'},
  additive: {title: 'Wikipedia: Additive color', url: 'https://en.wikipedia.org/wiki/Additive_color'},
  cie: {title: 'Wikipedia: CIE 1931 color space', url: 'https://en.wikipedia.org/wiki/CIE_1931_color_space'},
  pixelGeometry: {title: 'Wikipedia: Pixel geometry', url: 'https://en.wikipedia.org/wiki/Pixel_geometry'},
  subpixelRendering: {title: 'Wikipedia: Subpixel rendering', url: 'https://en.wikipedia.org/wiki/Subpixel_rendering'},
  acuity: {title: 'Wikipedia: Visual acuity', url: 'https://en.wikipedia.org/wiki/Visual_acuity'},
  oled: {title: 'Wikipedia: OLED', url: 'https://en.wikipedia.org/wiki/OLED'},
  amoled: {title: 'Wikipedia: AMOLED', url: 'https://en.wikipedia.org/wiki/AMOLED'},
  pholed: {title: 'Wikipedia: Phosphorescent organic light-emitting diode', url: 'https://en.wikipedia.org/wiki/Phosphorescent_organic_light-emitting_diode'},
  udc: {title: 'Universal Display: new red, green and yellow phosphorescent emitters, 2012', url: 'https://s21.q4cdn.com/428849097/files/doc_news/2012/726870.pdf'},
  idemitsu2014: {title: 'Idemitsu Kosan: Blue fluorescent OLED materials and their application for high-performance devices, 2014', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5090514/'},
  idemitsu2022: {title: 'Idemitsu Kosan: a blue OLED with a new light emission system, 2022', url: 'https://www.idemitsu.com/en/news/2022/220516.html'},
};

/** What every lesson on the screen takes without a source. */
export const screenLimits = 'Not from a source: a pretilt of 2° at both plates and no chiral dopant; the cell solved in 40 layers, with no backflow and no fringe fields at a subpixel’s edges; each color filter taken as passing one wavelength, 630, 550 and 460 nm, with the birefringence the same at all three; a drive of 0 to 5 V, black at 5 V and each channel’s white where it lets the most light through; and a capacitor that holds its voltage perfectly between writes and flips polarity every frame. Merck’s mixture M-1, made for another kind of panel, stands in for the module’s own mixture, which is not published. The codes are turned into light with the sRGB curve. The picture is a patch of 240 by 128 pixels written over a black picture, played for 12 frames. The OLED module’s emitters are taken to be as efficient as the published emitters nearest their colors, each dropping 3.8 V, with no circular polarizer, and the OLED is compared at the LCD’s size and white.';

// ---------------------------------------------------------------------------
// LCD screen.
// ---------------------------------------------------------------------------

const screenPanel = trial(SCREEN_DEFAULTS, 'panel'), screenMatrix = trial(SCREEN_DEFAULTS, 'matrix'), screenCell = trial(SCREEN_DEFAULTS, 'cell'), screenCurves = trial(SCREEN_DEFAULTS, 'curves'), screenFrames = trial(SCREEN_DEFAULTS, 'frames');

export const lcdScreenLesson = {
  simple: 'How does an LCD screen make a picture from light it does not make?',
  overview: 'An LCD screen lets a steady white backlight through two crossed polarizers only where a thin layer of twisted liquid crystal turns the light’s polarization to fit the second one. Behind every red, green and blue subpixel a transistor charges a tiny capacitor, one row after another, and the voltage it holds stands the molecules up, so less light is turned and less gets through. Press Play to write a colored patch over a black picture, then change the codes, the background and the thickness of the crystal.',
  steps: [
    {title: 'Light from one edge', body: 'White LEDs along one edge shine into a light guide that spreads their light behind the whole screen, and they stay on whatever the picture.'},
    {title: 'Polarize it', body: 'The rear polarizer passes only the light vibrating along the rubbing of the plate behind the crystal.'},
    {title: 'Write a row', body: 'The driver opens one row of transistors at a time, and each column’s data line charges its subpixel’s capacitor to the voltage its code asks for.'},
    {title: 'Twist or stand up', body: 'With little voltage the twisted crystal turns the light a quarter turn to fit the crossed front polarizer; a higher voltage stands the molecules up, so less light is turned and less gets out.'},
    {title: 'Filter and mix', body: 'A red, a green or a blue filter over each subpixel colors its light, and from a normal distance the three add up to one color.'},
  ],
  parts: [
    {name: 'The screen, true size', role: 'The module, with the row being written.'},
    {name: 'Backlight, true size', role: 'The LEDs and light guide that light the screen from behind.'},
    {name: 'Transistors and capacitors, close up', role: 'The gate and data lines that write each subpixel, and the capacitors that hold its voltage.'},
    {name: 'Liquid crystal, cut open', role: 'The twisted layer between the polarizers that turns the light, or does not.'},
    {name: 'Light against voltage', role: 'How much light each channel lets through at each voltage.'},
    {name: 'Light through the frames', role: 'How slowly the crystal turns, next to an OLED.'},
  ],
  tryIt: [
    screenFrames('Write the patch', 'Press Play and watch the light through the frames.', 'The red subpixel goes from 10% to 90% of its change in 52.8 ms and the green in 92.0 ms, several frames of 12.47 ms each, while the thin OLED lines jump up the moment their row is written. After 12 frames the LCD patch is 94% of the way to its color.'),
    screenMatrix('Row by row', 'Press Play and watch the capacitor bars and the gate lines.', 'Each row of transistors is open for 43.75 μs, and 285 rows make a frame of 12.47 ms. As its row is written, a bar flips between orange and blue: the green subpixel holds 2.02 V, positive one frame and negative the next.'),
    screenCell('Three columns of crystal', 'Press Play and look at the liquid crystal.', 'Green’s column settles with its middle tilted 61.7° at 2.02 V. Blue’s stays standing at 5 V, 88.9° in the middle: its light keeps the polarization it came in with, and the crossed front polarizer blocks it.'),
    screenCurves('Half the code is not half the light', 'Look at the light against voltage chart.', 'Code 128 asks for 21.6% of full light, and the green curve comes down to it at 2.02 V. The crystal starts to tilt at 1.45 V, and by 5 V it blocks nearly everything.'),
    screenCell('A thinner cell', 'Set the cell gap to 3 μm and press Play.', 'The red subpixel now takes 35.4 ms from 10% to 90% of its change and the green 58.1 ms, against 52.8 and 92.0 ms at 4 μm: a thinner layer of crystal turns faster.', {gap: 3}),
    screenPanel('A white background', 'Choose the white background and press Play.', 'Now the background lightens from black too, and the backlight still takes 1.02 W. The same picture on an OLED as large and as bright would take 802 mW, against 43 mW on black.', {background: 1}),
    screenCurves('Black is not black', 'Set all three codes to 0.', 'Every subpixel is held at 5 V, yet the crossed Polaroid sheets still leak 0.40% of white: a contrast of 248:1, where the module’s datasheet gives 500:1.', {red: 0, green: 0, blue: 0}),
  ],
  deeper: [
    {title: 'A quarter turn of light', body: 'The Liquid crystal page puts a layer typically 4 μm thick between crossed polarizers, twisted 90° by its alignment layers. Light entering along the rear rubbing is carried round with the twist when the layer is thick enough for its birefringence. For M-1, with a birefringence of 0.1147, a 4 μm layer gives 2Δnd/λ = 1.67 at 550 nm, close to the √3 at which Gooch and Tarry’s formula lets no light leak: this twisted cell passes 99.8% of what two parallel polarizers would.'},
    {title: 'Where the crystal starts to tilt', body: 'The Frank energy’s splay, twist and bend constants, 12.0, 6.5 and 14.0 pN for M-1, resist the tilt that the field’s pull on its dielectric anisotropy of 6.5 favors. With no pretilt the flat layer gives way at π√((K11 + (K33 − 2K22)/4)/(ε0Δε)) = 1.45 V, whatever the gap. The patent’s own threshold is 1.42 V, against 1.43 V from its splay constant alone. A pretilt lets the tilt start gently below that.'},
    {title: 'Rows, frames and a steady charge', body: 'The module’s clock runs at 12 MHz and every row takes 525 of its ticks, 480 for the row’s pixels and the rest between rows, so a row is open for 43.75 μs. Frames of 285 rows, 272 of them visible, come 80.2 times a second. The Active-matrix liquid-crystal display page says each pixel acts as a capacitor holding its charge until the next refresh, so between writes only the capacitor keeps the crystal turned.'},
    {title: 'Why the polarity flips', body: 'The Twisted nematic field effect page warns that a steady part as small as 50 mV in the drive may cause electrochemical reactions that shorten a cell’s life, and the Liquid-crystal display page says panels avoid it by reversing the field’s polarity as they address the pixels. The crystal feels only the square of the field, so the flip changes nothing it does.'},
    {title: 'Slow to relax', body: 'The German LCD page gives τoff = γ1d²/(kπ²) for a crystal relaxing with the voltage off. M-1’s rotational viscosity of 342 mPa·s gives 46.2 ms at 4 μm with its splay constant, and this cell takes 44.4 ms from 10% to 90% to go from black back to white. Switching to black and back takes 51.3 ms here, against the module’s 20 ms: its own mixture turns faster. The page’s times grow as the gap squared.'},
    {title: 'Black is not black', body: 'The Polarizer page gives Polaroid sheet about 38% of unpolarized light and an extinction ratio of about 1:500. Two crossed sheets still pass k1·k2 while two parallel ones pass (k1² + k2²)/2, a contrast of 250:1 at best, and with its crystal standing at 5 V this cell reaches 248:1. The module’s datasheet gives 500:1, so its polarizers must block better than Polaroid sheet. The OLED page notes that an LCD cannot show true black.'},
  ],
  misconception: 'The liquid crystal does not make the light or the color. The backlight makes the light, the filters color it, and the crystal only turns its polarization so the front polarizer passes it or blocks it.',
  limits: `The module and its backlight are drawn at true size, its pixels 200 times larger and the liquid crystal 15,000 times larger, and the panel is written 100 times slower than it is. ${screenLimits}`,
  sources: [sources.lcd, sources.tn, sources.liquidCrystal, sources.nematic, sources.tft, sources.amlcd, sources.polarizer, sources.waveplate, sources.jones, sources.birefringence, sources.ellipsoid, sources.frank, sources.lcdGerman, sources.schadt, sources.merck, sources.nhd43, sources.srgb, sources.responseTime, sources.contrast, sources.oled],
  quiz: {
    question: 'Why does a subpixel of a normally white LCD go dark when its capacitor holds a high voltage?',
    options: ['The field stands the molecules up, so the light is no longer turned and the crossed front polarizer blocks it.', 'The voltage switches off the part of the backlight behind that subpixel.', 'The voltage turns the color filter opaque.'],
    answer: 0,
    explanation: 'At 5 V the crystal stands 88.9° up in the middle, the light keeps its polarization, and the front polarizer lets through only 0.40% of white.',
  },
};

// ---------------------------------------------------------------------------
// RGB subpixels.
// ---------------------------------------------------------------------------

const subTrial = trial(SCREEN_DEFAULTS, 'subpixels'), colorTrial = trial(SCREEN_DEFAULTS, 'color');

export const rgbSubpixelsLesson = {
  simple: 'How do red, green and blue subpixels make every color?',
  overview: 'Each pixel of a color screen is three thin stripes side by side, one red, one green and one blue, too small to tell apart from a normal distance, so the eye adds their light into a single color. A picture keeps a code for each stripe, and the screen turns each code into light along the sRGB curve. Change the three codes and watch the stripes, the swatch beside them and the color chart.',
  steps: [
    {title: 'Three codes a pixel', body: 'A picture file keeps a red, a green and a blue code for every pixel.'},
    {title: 'Codes into light', body: 'The sRGB curve turns each code into a share of full light, so half the code gives much less than half the light.'},
    {title: 'Three stripes of light', body: 'Each subpixel lets through, or makes, its share of its own primary’s light.'},
    {title: 'Too small to see apart', body: 'From arm’s length a subpixel spans less than the finest detail an eye can resolve.'},
    {title: 'The eye adds them', body: 'The three lights add, so the color lands inside the triangle of the three primaries on the color chart.'},
  ],
  parts: [
    {name: 'RGB subpixels', role: 'The three by three pixels as light, and the color they add up to.'},
    {name: 'Color mixing chart', role: 'Where the panel’s primaries and their mixture sit among all colors.'},
    {name: 'Transistors and capacitors, close up', role: 'The windows the light comes through, and what sets each one’s share.'},
    {name: 'OLED subpixels', role: 'The same codes as light an OLED makes itself.'},
  ],
  tryIt: [
    subTrial('Orange from three stripes', 'Press Play, then look at the subpixels and the swatch.', 'The codes 255, 128 and 0 ask for 100%, 21.6% and 0% of full light. On this LCD they settle at x 0.486, y 0.430 on the color chart, an orange of 327 cd/m² against the white’s 1,000.'),
    subTrial('Half the light', 'Set the green code to 188 and press Play.', 'Code 188 asks for 50.3% of full light, where 128 asked for only 21.6%. The green stripes brighten and the mixture moves to x 0.434, y 0.483, toward the green corner.', {green: 188}),
    colorTrial('Full green', 'Set the red and blue codes to 0 and the green code to 255, then press Play.', 'Only the green stripes shine, and the patch settles at x 0.310, y 0.610, beside the module’s green corner at 0.310, 0.613: the little light the dark red and blue stripes leak pulls it toward white.', {red: 0, green: 255, blue: 0}),
    colorTrial('Yellow', 'Set the green code to 255.', 'Red and green at full light add up to yellow at x 0.393, y 0.527, on the line between the red and green corners but for the light the dark blue stripes leak.', {green: 255}),
    colorTrial('White', 'Set all three codes to 255.', 'The LCD’s white settles at x 0.273, y 0.321, the datasheet’s white, bluer than sRGB’s x 0.3127, y 0.3290. Its green carries 67.7% of the white’s luminance, red 17.8% and blue 14.5%.', {red: 255, green: 255, blue: 255}),
    subTrial('Too small to see apart', 'Press Play, then look at the subpixels.', 'The module’s 480 by 272 pixels on 95.04 by 53.86 mm lie 198 μm apart, so a subpixel is 66 μm wide. From 300 mm it spans 0.76 arc minutes, under the 1 arc minute an eye resolves, while a whole pixel spans 2.27.'),
  ],
  deeper: [
    {title: 'Half the code, a fifth of the light', body: 'sRGB decodes a code C from 0 to 1 as C/12.92 up to 0.04045 and ((C + 0.055)/1.055)^2.4 above it. Code 128 of 255 is 0.502 of the range and gives 21.6% of full light; the RGB color model page gives about 22% for half intensity on a 2.2 gamma display. Code 188 gives 50.3%.'},
    {title: 'Adding light', body: 'The CIE 1931 color space page says a mixture of two colors lies on the straight line between them. Lights add their X, Y and Z, so a screen’s colors fill the triangle of its red, green and blue. Mixed to the datasheet’s white, this module’s green carries 67.7% of the luminance, red 17.8% and blue 14.5%.'},
    {title: 'Two real panels', body: 'The LCD module’s datasheet gives red at x 0.573, y 0.347, green at 0.310, 0.613 and blue at 0.143, 0.097. The OLED module’s gives red at 0.64, 0.34, green at 0.31, 0.62 and blue at 0.14, 0.16. The LCD’s green and blue and all three of the OLED’s lie outside the sRGB triangle, so a screen made for sRGB cannot show them exactly.'},
    {title: 'Stripes a third of a pixel', body: 'The Pixel geometry page says a pixel is typically three subpixels arranged left to right as red, green and blue, and the Subpixel rendering page notes that the three are shifted by a third of a pixel, which text on screens uses to place edges more finely.'},
    {title: 'Finer than the eye', body: 'The Visual acuity page defines normal acuity by a gap of 1 arc minute. From 300 mm, 66 μm spans 0.76 arc minutes and 198 μm spans 2.27, so this module’s stripes merge while its pixels can just be told apart. The OLED module’s pixels, 210 μm apart, span 2.41 arc minutes.'},
    {title: 'The black matrix', body: 'The Liquid-crystal display page says a black grid called the black matrix separates the subpixels, raising contrast and keeping light from leaking into neighbors. In the close up it is drawn 8 μm wide, which is not from a source.'},
  ],
  misconception: 'Screens do not mix colors like paint. Red and green light add up to yellow, because the eye adds the lights, while red and green paint together make a dull brown.',
  limits: `The pixels are drawn 200 times larger, each subpixel as bright as its share of its own full light, with a black matrix 8 μm wide that is not from a source. The colors are the modules’ own, drawn in sRGB and clamped where they fall outside it. ${screenLimits}`,
  sources: [sources.pixelGeometry, sources.subpixelRendering, sources.srgb, sources.rgb, sources.additive, sources.cie, sources.acuity, sources.lcd, sources.nhd43, sources.nhd15],
  quiz: {
    question: 'Why can three stripes of colored light look like a single color?',
    options: ['From a normal distance they are too small to tell apart, so the eye adds their light.', 'The color filters blend the three colors inside the screen.', 'The liquid crystal changes the color of the light.'],
    answer: 0,
    explanation: 'From 300 mm a subpixel 66 μm wide spans 0.76 arc minutes, finer than the 1 arc minute an eye resolves.',
  },
};

// ---------------------------------------------------------------------------
// OLED display.
// ---------------------------------------------------------------------------

const oledTrial = trial(SCREEN_DEFAULTS, 'oled'), oledFrames = trial(SCREEN_DEFAULTS, 'frames'), oledColor = trial(SCREEN_DEFAULTS, 'color');

export const oledDisplayLesson = {
  simple: 'How does an OLED screen make its own light?',
  overview: 'In an OLED screen every subpixel is a thin stack of organic layers between two electrodes that glows when a current flows through it: more current, more light, and none at all with no current. Two transistors and a capacitor behind each subpixel keep its current steady between writes, so no backlight is needed. Change the codes and the background, and compare the currents, the light and the power with the LCD beside it.',
  steps: [
    {title: 'Hold a voltage', body: 'While its row is written, a switching transistor charges the subpixel’s storage capacitor.'},
    {title: 'Set a current', body: 'A second transistor turns the held voltage into a steady current through the subpixel.'},
    {title: 'Charges meet', body: 'Holes from the anode and electrons from the cathode meet in the emissive layer and form excitons.'},
    {title: 'Light in proportion', body: 'The excitons give up their energy as light, so the brightness grows with the current, by the emitter’s efficiency in candelas per ampere.'},
    {title: 'Off means black', body: 'With no current a subpixel gives no light and takes no power, so black is truly black.'},
  ],
  parts: [
    {name: 'OLED subpixels', role: 'The module’s pixels, a subpixel’s stack with its current and light, and the power.'},
    {name: 'Light through the frames', role: 'How fast an OLED lights next to a liquid crystal.'},
    {name: 'Color mixing chart', role: 'The OLED module’s primaries against the LCD’s.'},
    {name: 'Backlight, true size', role: 'What an LCD needs and an OLED does not.'},
  ],
  tryIt: [
    oledTrial('Currents for orange', 'Press Play, then look at the OLED subpixels.', 'At the LCD’s white of 1,000 cd/m², the codes 255, 128 and 0 need 351 nA through each red subpixel and 59 nA through each green one, in a pixel 210 μm across: 4.02 and 0.68 mA/cm² in their emitters. Blue draws nothing and stays dark.'),
    oledFrames('Lit at once', 'Press Play and watch the thin lines.', 'Each OLED subpixel lights within 10 μs of its row being written, less than the 43.75 μs its row is open, while the LCD’s red subpixel takes 52.8 ms between 10% and 90% of its change.'),
    oledTrial('A white background', 'Choose the white background and press Play.', 'The same patch on a white screen takes 802 mW on an OLED as large and as bright as the LCD, against 43 mW on black. The LCD’s backlight takes 1.02 W either way.', {background: 1}),
    oledTrial('Blue costs the most', 'Set the red and green codes to 0 and the blue code to 255, then press Play.', 'Full blue needs 1,625 nA a subpixel, 18.61 mA/cm² in its emitter, more than the blue device’s test current of 10 mA/cm², because its emitter gives only 6.5 cd/A against green’s 85. The patch alone takes 169 mW.', {red: 0, green: 0, blue: 255}),
    oledTrial('A white screen', 'Set all three codes to 255, choose the white background and press Play.', 'An OLED as large as the LCD and as bright, all white, takes 993 mW, close to the LCD’s 1.02 W backlight, and most of it goes to blue.', {red: 255, green: 255, blue: 255, background: 1}),
    oledColor('A deeper orange', 'Look at the color chart.', 'The OLED module’s red sits at x 0.64, y 0.34, beyond the LCD’s 0.573, 0.347, so the same codes land at x 0.570, y 0.400 on the OLED, a deeper orange than the LCD’s x 0.486, y 0.430.'),
  ],
  deeper: [
    {title: 'Candelas per ampere', body: 'An OLED’s luminance is its current efficiency times its current density. Universal Display gives its red emitter 29 cd/A at x 0.66, y 0.34 and its green 85 cd/A at 0.31, 0.63; Idemitsu Kosan gives a deep blue at x 0.143, y 0.078 of 6.5 cd/A at 3.8 V and 10 mA/cm², an external quantum efficiency of 8.6%. The model takes the module’s three to be as efficient as these, which is not from a source.'},
    {title: 'Why blue is hard', body: 'The Phosphorescent organic light-emitting diode page says charges meeting form singlets 25% of the time and triplets 75%. Phosphorescent emitters, like Universal Display’s red and green, give light from both; the deep blue here is fluorescent and gives it mostly from singlets, which is why its efficiency is so much lower. Idemitsu Kosan’s 2022 blue reached an external quantum efficiency of 14%.'},
    {title: 'Two transistors and a capacitor', body: 'The AMOLED page says each pixel has at least two transistors: one to start and stop the charging of a storage capacitor, and one to keep a steady current through the pixel. The NHD-1.5-128128UGC3 module itself is driven as a passive matrix, with no transistors in its pixels; the model draws the active matrix pixel instead.'},
    {title: 'Power follows the picture', body: 'The AMOLED page gives an old OLED display 0.3 W for white text on black and more than 0.7 W for black text on white, while an LCD took a constant 0.35 W. Here the patch on black takes 43 mW, on white 802 mW, and a white screen 993 mW, while the LCD’s backlight takes 1.02 W for all three.'},
    {title: 'True black, fast light', body: 'The OLED module’s datasheet gives a contrast ratio above 10,000:1 and a rise and a fall of 10 μs each; the OLED page quotes LG as putting OLED response under 10 μs. The LCD module gives 500:1, and 20 ms for its rise and fall together.'},
    {title: 'A real OLED pixel', body: 'The OLED module’s drawing puts its pixels 0.21 mm apart with subpixels 0.045 by 0.194 mm, so its three emitters cover 59.4% of each pixel. Its 128 pixels of 0.21 mm, less one gap of 0.025 mm, make its active area of 26.855 mm.'},
  ],
  misconception: 'An OLED screen has no backlight shining through its pixels: a black pixel is switched off, not covered up.',
  limits: `The OLED pixels are drawn 200 times larger, and their stacks not to scale. ${screenLimits}`,
  sources: [sources.oled, sources.amoled, sources.pholed, sources.udc, sources.idemitsu2014, sources.idemitsu2022, sources.nhd15, sources.nhd43, sources.lcd],
  quiz: {
    question: 'Why does an OLED screen use less power for a dark picture?',
    options: ['Each subpixel draws only the current its own light needs, and a black one draws none.', 'Its backlight dims when the picture is dark.', 'Its polarizers block more light when the picture is dark.'],
    answer: 0,
    explanation: 'The orange patch on black takes 43 mW on an OLED as large and as bright as the LCD, and on white 802 mW, while the LCD’s backlight takes 1.02 W for both.',
  },
};

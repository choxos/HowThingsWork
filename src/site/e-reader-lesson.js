import {READER_DEFAULTS, READER_PAGE, readerAt, readerPlan, readerRequested} from './e-reader-physics.js';

const blank = Array(READER_PAGE.cells).fill(0);
const page = (book, number) => readerRequested({book, page: number});
const interrupted = readerAt(readerPlan({book: 1}, page(0, 0)), 1.6).pixels;
const trial = (title, instruction, observe, settings = {}, pixels = blank) => ({
  title, instruction, observe, values: {...READER_DEFAULTS, ...settings}, reset: true,
  initialState: {settings: {...READER_DEFAULTS, ...settings}, pixels: [...pixels], time: 0},
  part: 'reader', isolate: true, view: 'front',
});

export const eReaderLesson = {
  simple: 'How does an e-reader turn a stored book into a readable page?',
  overview: 'Choose a book and page, then press Play. The reader retrieves stored text, prepares a pixel image and changes the electronic ink row by row. Read the resulting miniature page, turn to another page, or select another title. Disconnecting power leaves the current pigment image in place. In darkness, the front light sends light through a guide above the ink so the page can reflect it toward you.',
  steps: [
    {title: 'Choose stored text', body: 'Nonvolatile memory holds the books. Your book and page controls represent a reading command. The processor retrieves the selected text; choosing a title does not immediately repaint the screen.'},
    {title: 'Prepare the page image', body: 'The processor lays out letters and stores their black-and-white pixel pattern in a framebuffer. The displayed page is a separate physical image that may still show the preceding page.'},
    {title: 'Address the display', body: 'A display driver sends row selections and column data to the transistor backplane. The highlighted row shows which region is being updated. This teaching schedule moves only pixels that differ from the new image.'},
    {title: 'Move the ink', body: 'Electric drive rearranges black and white charged pigments inside the ink layer. Black at the viewing side makes a dark mark; white returns more light. Inspect the selected pixel to connect the page update to opposed pigment motion.'},
    {title: 'Keep the material image', body: 'After writing, pixel drive stops and the bistable ink retains its state. A power interruption can retain a partly written page too. The battery still powers active electronics and any front-light LEDs; image retention does not make the whole reader power-free.'},
    {title: 'Illuminate the page from the front', body: 'Ambient light can make the reflective page visible. In darkness, edge LEDs feed a transparent guide above the display. Internal reflections spread light along the guide, and extraction features direct some of it down onto the ink. Reflected light returns toward the reader.'},
  ],
  parts: [
    {name: 'Case, battery and circuit board', role: 'Hold the display stack and supply the electronics and LEDs.'},
    {name: 'Book storage', role: 'Keep the original miniature books Light, Rain and Seeds even when device power is off.'},
    {name: 'Processor and framebuffer', role: 'Retrieve text and prepare a pixel pattern for the requested page.'},
    {name: 'Driver and TFT backplane', role: 'Connect that image to individually controlled screen pixels.'},
    {name: 'Reflective electronic-ink page', role: 'Show current pigment positions, including intermediate or retained images.'},
    {name: 'Touch surface', role: 'Represent the input layer used for reading commands; detailed touch sensing is outside this lesson.'},
    {name: 'E-reader front-light panel', role: 'Guide light from edge LEDs onto the ink without putting a backlight behind it.'},
    {name: 'Selected pigment cell and light-path views', role: 'Enlarge the two mechanisms while keeping them connected to the reader state.'},
  ],
  tryIt: [
    trial('Open Light', 'Press Play from a blank display.', 'Stored text becomes Light, page 1. The row marker advances through changed regions, then disappears when pixel drive stops.'),
    trial('Turn the page', 'Light, page 1 is already stored in the ink. Press Play for page 2.', 'The title remains Light while the page number and body text change. The final page describes reading with the front light.', {page: 1}, page(0, 0)),
    trial('Choose another book', 'Start from Light, page 2. Press Play with Rain selected.', 'The reader retrieves a different stored title and writes Rain, page 1, including its new text.', {book: 1}, page(0, 1)),
    trial('Open Seeds, page 2', 'Start from Rain, page 1, then press Play.', 'Both the requested title and page are used. The completed display reads Seeds, page 2.', {book: 2, page: 1}, page(1, 0)),
    trial('Request a page without power', 'Seeds, page 1 is retained with device power Off. Page 2 is requested.', 'The readable page stays on Seeds, page 1, and the new request waits. Turn Device power On and press Play to write page 2.', {book: 2, page: 1, power: 0}, page(2, 0)),
    trial('Write in darkness', 'Press Play with both light sources off. Then turn Ambient light On.', 'The reader writes Rain, page 2, but the page stays dark. Restoring ambient light reveals the stored page immediately, without another write.', {book: 1, page: 1, ambient: 0}),
    trial('Read by the front light', 'Light, page 2 is already retained. Ambient light is Off and Front light is Bright.', 'Edge LEDs illuminate the page through the guide. Inspect the light path, compare Low and Off, then disconnect device power to see the LEDs go out while the material image remains stored.', {page: 1, ambient: 0, frontlight: 2}, page(0, 1)),
    trial('Redirect a partial update', 'Start from a partly changed Light-to-Rain page. Press Play for Seeds, page 1.', 'The new update begins from the existing mixed pigment image. It finishes as Seeds, page 1, without inventing a completed prior page.', {book: 2}, interrupted),
  ],
  deeper: [
    {title: 'Book files, framebuffer and ink are different', body: 'Stored text can be laid out into a new framebuffer while the screen still shows an older page. Pixel drive then changes the material display. A request, an electronic image buffer and visible pigment positions are three different states.'},
    {title: 'Why a retained page needs light', body: 'The ink is reflective. Removing drive can leave its image intact, but seeing that image requires illumination. Device power can be off while ambient light still reveals the page. A front light needs electrical power even when the ink is holding still.'},
    {title: 'How light leaves the guide', body: 'Light entering a thin guide can reflect internally along it. Small extraction features redirect some light toward the ink below. The cross-section enlarges that path. Its arrows explain direction and connections; they do not calculate scattering efficiency, brightness uniformity or a real optical prescription.'},
    {title: 'Page updates are more complicated in a real reader', body: 'Commercial display controllers use waveforms that depend on ink platform, temperature, previous state and update mode. Some updates include clearing phases or flashing. This lesson uses a simple staged row schedule and does not imply that every real page turn follows it.'},
    {title: 'What the selected cell means', body: 'The enlarged cell represents ink under the indicated screen pixel. Real capsules do not form a one-capsule-per-pixel grid. The labeled pigment signs use the current E Ink Carta description: positive black and negative white. Other descriptions, including older source material, use the opposite convention.'},
    {title: 'Six original miniature pages', body: 'This teaching reader contains three short original texts, each split into two pages. Its 72 by 96 bitmap keeps the update visible. It does not represent a commercial screen resolution, ebook format, storage capacity or typeface rendering engine.'},
  ],
  misconception: 'A retained ink image and a powered device are different. Ink can hold a page without continuing pixel drive; the processor and front-light LEDs still need power when operating.',
  limits: 'A qualitative reader with original miniature books and an enlarged 72 by 96 monochrome teaching display. Retrieval, composition and row timings are illustrative scene time, not commercial performance. Pigment motion and image retention are imposed behaviors, not a fluid or material-lifetime solution. Intermediate gray represents motion, not measured reflectance. Device power removal assumes immediate drive and LED shutdown. No electrical power, battery duration, voltage, capsule count, optical efficiency, eye-health benefit or fabrication dimension is predicted. Front-light arrows show selected paths without a full ray or scattering solver. Touch sensing, ebook decoding, communications, temperature effects, ghosting and commercial multiphase waveforms are omitted. Hardware and enlarged views remain independently lit for inspection. Part inspections preserve the current experiment.',
  sources: [
    {title: 'E Ink: FAQ, matrix addressing, image retention and partial updates', url: 'https://www.eink.com/tech/detail/FAQ'},
    {title: 'E Ink: how two-pigment Carta displays work', url: 'https://www.eink.com/tech/detail/How_it_works'},
    {title: 'E Ink: edge LEDs and front-light guides', url: 'https://www.eink.com/tech/detail/Front_Light'},
  ],
  quiz: {
    question: 'A page has finished writing. Device power is disconnected in a well-lit room. What happens?',
    options: ['The ink page remains readable in ambient light, but the front-light LEDs turn off.', 'The pigment image disappears immediately because the LEDs lost power.', 'The retained ink image supplies electricity to the processor and LEDs.'],
    answer: 0,
    explanation: 'Bistable ink can retain its material image without continuing drive. Ambient light makes that image visible. The LED front light and active electronics still require electrical power.',
  },
};

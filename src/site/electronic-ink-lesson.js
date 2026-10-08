import {INK_DEFAULTS, INK_WORDS, inkAt, inkPlan} from './electronic-ink-physics.js';

const trial = (title, instruction, observe, settings = {}, pixels, part = 'assembly', time = 0) => ({
  title, instruction, observe, values: {...INK_DEFAULTS, ...settings}, reset: true,
  initialState: {settings: {...INK_DEFAULTS, ...settings}, ...(pixels ? {pixels: [...pixels]} : {}), time},
  part, isolate: true, view: 'front',
});
const INK = INK_WORDS[0].pixels, CAT = INK_WORDS[1].pixels;
const interrupted = inkAt(inkPlan({word: 2}, CAT), 1.2).pixels;

export const electronicInkLesson = {
  simple: 'How do moving pigments form a word that stays after power is removed?',
  overview: 'Press Play to write INK into this enlarged electronic-ink patch. Drivers select pixel electrodes beneath a layer of tiny capsules. Their electric fields move black and white pigment in opposite directions, choosing which color faces the viewer. The same pigment states form the word on the patch and move inside the enlarged capsule view. Change the requested word, remove power or turn off the light to see what changes and what stays.',
  steps: [
    {title: 'Choose a word', body: 'The controller turns a three-letter word into a pattern for 119 enlarged pixels. Drivers select rows and apply commands through thin-film transistors. Only pixels that differ from the requested pattern need to change in this teaching update.'},
    {title: 'Apply a field across the ink', body: 'The transparent common electrode above the capsules is labeled 0 V. A positive pixel electrode below them makes the field point toward the viewing side. A negative pixel electrode reverses the field. The reference ±15 V labels illustrate polarity, not a complete commercial waveform.'},
    {title: 'Move opposite pigments', body: 'This example follows the current Carta convention: black pigment is positive and white pigment is negative. Positive black pigment moves with the electric field; negative white pigment moves against it. A capsule inspection follows the highlighted pixel without changing the experiment.'},
    {title: 'Form the visible letters', body: 'Black pigment at the front absorbs more incident light; white pigment at the front reflects more. Selected dark pixels form letters against a pale background. Reverse the requested contrast to write pale letters on a dark background. The word shown on the patch comes from its pigment states.'},
    {title: 'Remove drive, keep the image', body: 'After writing, the modeled electrodes return to zero while the bistable ink retains its optical state. Disconnecting power does not erase the image. A new request waits until power returns. Bistability is an engineered material property; it does not mean that gravity, Brownian motion and other interactions disappear.'},
    {title: 'Provide light to see it', body: 'Electronic ink reflects light; it does not emit its own. Turn off Light on page and the stored word becomes invisible. Turn light back on and it reappears without rewriting. A real reader can use a powered front light, which is covered in the parent lesson.'},
  ],
  parts: [
    {name: 'Display module', role: 'Connect the supply, controller, drivers and reflective ink patch.'},
    {name: 'Power supply and switch', role: 'Supply writes and disconnect the modeled drive without erasing the ink.'},
    {name: 'Image controller', role: 'Hold the requested word and select the pixels that still need to change.'},
    {name: 'Row and column drivers', role: 'Send row selection and pixel commands to the backplane.'},
    {name: 'TFT backplane and electrodes', role: 'Address the ink above individual pixel regions.'},
    {name: 'Reflective pigment layer', role: 'Form the word from the color facing the viewing side.'},
    {name: 'Transparent common electrode', role: 'Provide the reference potential across the ink layer.'},
    {name: 'Selected capsule, enlarged', role: 'Show the highlighted pixel’s field, opposite pigment motion and retained state.'},
  ],
  tryIt: [
    trial('Write INK', 'Press Play, then inspect the highlighted capsule.', 'The blank patch becomes INK. Positive black pigment moves toward the front in the dark letter pixels. At completion every modeled drive voltage is zero and the word stays.'),
    trial('Change CAT to CAR', 'Start from CAT and press Play.', 'The first two letters remain unchanged. Only the changed pixels of T move to form R. A full blanking flash is not required by every real update mode.', {word: 2}, CAT),
    trial('Write white letters', 'Press Play from a dark starting patch. Inspect the highlighted capsule to follow the reversed motion.', 'The letter pixels receive a negative bottom drive. Black pigment moves away from the viewing side while white pigment moves forward, producing white INK on black.', {contrast: 1}, Array(119).fill(1)),
    trial('Erase INK', 'Press Play toward Blank.', 'Only the dark letter pixels need to turn white. The patch ends blank with zero continuing drive.', {word: 3}, INK),
    trial('Keep INK, queue CAR', 'Power is disconnected and CAR is requested. Reconnect power, then press Play.', 'INK stays visible until power returns. The disconnected supply cannot write CAR, but it also does not erase INK. Reconnection writes the queued word from the retained image.', {word: 2, power: 0}, INK),
    trial('Write in darkness', 'Press Play with Light on page off, then restore the light.', 'The pixel states change while the patch stays dark. Restoring light reveals INK immediately, without another write.', {light: 0}),
    trial('Resume an interrupted update', 'Press Play from a partly written CAR.', 'The starting patch already contains CAT’s first two letters and a partly changed last letter. The remaining pigment motion finishes CAR; the first two letters stay put.', {word: 2}, interrupted),
    trial('Hold an unfinished word', 'Inspect the partly written last letter with power disconnected.', 'The modeled pigment positions stay where the interrupted update left them, with zero field. Reconnect power and press Play to finish CAR. Intermediate shading shows illustrative motion, not a calibrated gray level.', {word: 2, power: 0}, interrupted, 'capsule'),
  ],
  deeper: [
    {title: 'Follow the labeled charge signs', body: 'The electric field points from higher potential toward lower potential. Force is F = qE, so positive and negative charges feel opposite forces. E Ink’s current Carta description and current FAQ label white pigment negative and black positive. The book and an older FAQ embedded on the manufacturer’s page use the opposite labels. Pigment color alone does not define a universal charge sign; this lesson states which convention it uses.'},
    {title: 'A pixel is not one capsule', body: 'The TFT backplane defines the addressed pixel regions. The ink film contains many small capsules that need not align with those boundaries. The patch shows the average optical state of each addressed region. The enlarged capsule represents pigment motion within the highlighted region; it is not a one-capsule-per-pixel construction.'},
    {title: 'Retention is not a vanished force', body: 'A formulated electrophoretic display can retain an optical state after electrical drive is removed. That macroscopic behavior is called bistability. This lesson preserves the state as an ideal boundary condition. It does not calculate the material interactions responsible for retention, their dependence on temperature or the length of time an image lasts.'},
    {title: 'Why only some pixels change', body: 'When CAT changes to CAR, the first two letters and unchanged parts of the last letter already have the requested state. In this teaching schedule, drivers act only on the differences. Real displays offer multiple update modes, including partial updates and cleaning refreshes; there is no rule that every page change must erase the entire screen.'},
    {title: 'Real driving is more involved', body: 'Each changed row takes 0.8 scene seconds so its field and motion can be inspected. This is not real refresh time. Commercial controllers use multiphase waveforms adapted to the material, previous image, temperature and desired gray level. Their charge balancing, ghosting control and electrical storage are outside this model.'},
    {title: 'Compare the request with the stored image', body: 'The controller can ask for a new word before the ink has changed. Compare Requested image with Stored pattern while writing, or after disconnecting power. A request for CAR can coexist with a retained image of INK. Only pigment motion changes the image that incident light reveals.'},
  ],
  misconception: 'Removing pixel drive does not erase a bistable ink image, and it does not make the image glow. You still need incident light to see it. Operating electronics and lighting can still consume power.',
  limits: 'A qualitative 119-pixel teaching patch, not a product specification or commercial waveform. Capsule count, particle paths, geometry, layer thickness and the 0.8 scene-second row schedule are illustrative. Charges follow the stated current Carta convention. Reference ±15 V commands are not universal drive requirements. Intermediate positions and shades show progress; they do not predict optical reflectance or calibrated gray levels. Bistability is imposed as retained state, including interrupted updates, without predicting material interactions or retention lifetime. Power removal immediately sets modeled electrodes to 0 V; discharge transients are omitted. No solvent, mobility, switching speed, ghosting, temperature response or power consumption is calculated. Enlarged inspections remain lit for teaching when Light on page is off. The patch averages capsules within pixel regions and does not model fringing fields at their boundaries. The readback recognizes only this lesson’s fixed glyphs, not arbitrary text. All inspections preserve state.',
  sources: [
    {title: 'E Ink: current FAQ on pigment charge, TFT addressing, bistability and partial updates', url: 'https://www.eink.com/tech/detail/FAQ'},
    {title: 'E Ink: Carta two-pigment system and differing older charge labels', url: 'https://www.eink.com/tech/detail/How_it_works'},
    {title: 'E Ink: ink film, TFT backplane and display module layers', url: 'https://www.eink.com/tech/detail/Electronic_Ink_Film'},
  ],
  quiz: {
    question: 'INK is stored, power is disconnected and CAR is requested. What happens under room light?',
    options: ['INK stays visible until power returns and the new word is written.', 'The ink immediately erases itself to save power.', 'CAR appears because the requested word alone moves the pigment.'],
    answer: 0,
    explanation: 'The bistable material retains the old image without continuing drive. A new request needs a powered update to move pigment. Available light makes the retained word visible.',
  },
};

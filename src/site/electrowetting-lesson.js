import {WET_DEFAULTS} from './electrowetting-physics.js';

const trial = (title, instruction, observe, settings = {}, openings = [0, 0, 0]) => ({
  title, instruction, observe, values: {...WET_DEFAULTS, ...settings}, reset: true,
  initialState: {settings: {...WET_DEFAULTS, ...settings}, openings: [...openings], time: 0},
  part: 'assembly', isolate: true, view: 'front',
});

export const electrowettingLesson = {
  simple: 'How can moving oil reveal or hide a reflective color pixel?',
  overview: 'Press Play to reveal red. Voltage changes how conducting water wets an insulating surface, pushing black oil into a smaller area. The exposed white base reflects light through a red filter. Three neighboring cells have red, green and blue filters; their reflected contributions form the combined-color sample. Change the channel commands, remove power or switch off the light to follow the whole chain.',
  steps: [
    {title: 'Start with a dark oil film', body: 'Without applied voltage, oil spreads over the water-repellent coating and hides the white reflector. Conducting water sits above the oil. Walls keep the liquids within each subpixel.'},
    {title: 'Apply voltage through an insulator', body: 'A transparent pixel electrode lies below the thin insulating coating. A common contact touches the conducting water. Voltage between them changes the wetting balance at the coated surface. Water advances and the oil contracts toward one side.'},
    {title: 'Reveal the white reflector', body: 'Oil remains inside the cell as its footprint shrinks and its height grows. The newly uncovered area lets light reach the white base. This scene conserves both oil and water volume throughout that motion.'},
    {title: 'Filter the returning light', body: 'Each cell has a red, green or blue filter on the viewing side. Incident light passes through a filter, reflects from the exposed base, then passes through the filter again. The arrows show simplified paths; black oil blocks the modeled return where it covers the base.'},
    {title: 'Mix three subpixels', body: 'When neighboring subpixels are too small to resolve, their reflected contributions combine. Red and green make the sample yellow. All three give white in this ideal RGB model. The sample follows current open areas, including partly completed movements, rather than the requested settings.'},
    {title: 'Keep voltage applied to stay open', body: 'In this example, an open cell needs maintained voltage. Disconnect power and press Play: water retreats and oil spreads back over the reflector. This behavior differs from the bistable electronic ink in the previous lesson.'},
  ],
  parts: [
    {name: 'Supply, switch and drivers', role: 'Apply separate channel commands between pixel electrodes and the common water contact.'},
    {name: 'White reflectors', role: 'Return incident light where oil has uncovered the base.'},
    {name: 'Transparent pixel electrodes', role: 'Apply voltage beneath an insulating coating without blocking the reflective base.'},
    {name: 'Water-repellent insulating coating', role: 'Separate the electrode electrically from the liquids and provide the wetting surface.'},
    {name: 'Black oil', role: 'Hide the reflector as a film or gather to one side to reveal it.'},
    {name: 'Conducting water and common contacts', role: 'Complete the electrode arrangement and displace the oil as wetting changes.'},
    {name: 'RGB filters and clear covers', role: 'Select the reflected color of each enclosed subpixel.'},
    {name: 'Combined-color sample', role: 'Represent the ideal mixture seen when the three neighboring subpixels are unresolved.'},
  ],
  tryIt: [
    trial('Reveal red', 'Press Play from three closed cells.', 'Oil in the red cell gathers to the left. Its reflector becomes visible through the red filter. Green and blue stay covered; the combined sample turns red.'),
    trial('Mix yellow', 'Press Play with red and green commanded fully open.', 'Red and green oil films contract together. Their reflected contributions make the sample yellow while blue stays covered.', {green: 2}),
    trial('Make white', 'Press Play with all three channels at Full.', 'All three reflectors become exposed by equal amounts. Their ideal RGB mixture is white. The open cells still have voltage applied after movement stops.', {green: 2, blue: 2}),
    trial('Make orange', 'Press Play with red Full and green Intermediate.', 'Green exposes half as much area as red in this teaching model. Their unequal contributions make the ideal sample orange; blue remains covered.', {green: 1}),
    trial('Close green from yellow', 'Start with red and green open, then press Play to remove the green command.', 'Green oil spreads back across its reflector. Red oil stays gathered. The sample changes from yellow to red.', {}, [.8, .8, 0]),
    trial('Remove power from white', 'Power starts disconnected. Press Play from three open cells.', 'All three drive commands are zero. Oil spreads back over every reflector and the sample becomes dark. An electrowetting cell does not retain this open state without voltage.', {green: 2, blue: 2, power: 0}, [.8, .8, .8]),
    trial('Open blue in darkness', 'Press Play with light Off. After movement ends, turn Light on display On.', 'Blue oil contracts in darkness, but no reflected color is visible. Restoring light reveals blue immediately without moving the oil again.', {red: 0, blue: 2, light: 0}),
    trial('Reverse an interrupted opening', 'Start from a partly open red cell. Press Play with green requested instead.', 'Red oil spreads back as green oil gathers. Movement starts from the existing liquid positions. The sample passes through mixed colors and ends green.', {red: 0, green: 2}, [.4, 0, 0]),
  ],
  deeper: [
    {title: 'Why voltage changes wetting', body: 'Electrowetting changes the energetic balance of a conducting liquid on an insulated electrode. Applied voltage can make water wet more of a surface that is otherwise water-repellent. In an oil-filled display cell, advancing water displaces the oil. This model illustrates the resulting geometry; it does not calculate contact angle from voltage.'},
    {title: 'A film changes shape, not amount', body: 'The scene uses an enlarged oil film and a rounded side bead. The bead grows taller as its footprint shrinks, conserving volume. Water fills the remaining space below a fixed cover. Real film rupture, corner gathering and liquid motion depend on the surface, cell shape and driving history.'},
    {title: 'Three filters, one color pixel', body: 'The book shows red, green and blue filtered compartments. This lesson follows that arrangement with black oil and a white reflecting base. Other electrowetting displays can use colored oils or different optical stacks. The combined sample is a viewing aid, not an extra emitting component inside the display.'},
    {title: 'Commands are not voltage measurements', body: 'Off, Intermediate and Full select illustrative uncovered fractions of 0%, 40% and 80%. These are not equal voltage steps or device specifications. Real electrowetting response can saturate and depend on hysteresis, pinning and geometry. The 1.6 scene-second transition is slowed teaching motion.'},
    {title: 'Voltage is not a power reading', body: 'After oil reaches an open state, the modeled command remains applied. A maintained voltage does not by itself specify electrical power consumption. Leakage, refresh circuitry and drive waveforms are outside this model. Disconnecting the supply assumes immediate removal of electrode voltage, followed by the illustrated oil relaxation.'},
    {title: 'Reflective color needs light', body: 'Turning off incident light immediately darkens both the subpixels and their combined result, while oil can still move. The surrounding apparatus remains lit so it can be inspected. Ideal RGB weights ignore real filter spectra, double-pass losses, reflectance, scattering, viewing angle and human color matching.'},
  ],
  misconception: 'Moving oil reveals reflected light; it does not create light. In this example an open cell also needs maintained voltage. Removing voltage lets oil cover the reflector again.',
  limits: 'A qualitative, enlarged three-subpixel teaching module. Oil and water volumes are conserved by a chosen geometric profile, not a fluid-dynamics solution. Cell dimensions, layer thicknesses, side gathering, command-to-opening mapping and 1.6 scene-second timing are illustrative. No calibrated voltage, contact angle, switching speed or power consumption is predicted. Film rupture, fringing fields, saturation, hysteresis, pinning, backflow, charge trapping and dielectric failure are omitted. Wiring uses schematic sealed feedthroughs without detailed packaging. Ideal black oil, transparent conductors and RGB filters simplify the optical stack. The combined-color sample uses current uncovered fractions and incident light; it does not predict physical reflectance, spectrum, luminance or color gamut. Arrows mark selected light paths without ray tracing. Hardware remains lit for inspection when incident light is off. Part inspections preserve the experiment.',
  sources: [
    {title: 'Hayes and Feenstra: Video-speed electronic paper based on electrowetting (2003 abstract)', url: 'https://www.nature.com/articles/nature01988'},
    {title: 'Hayes and Feenstra: Figure 1, oil-film contraction and reflective cell layers', url: 'https://www.nature.com/articles/nature01988/figures/1'},
    {title: 'Mugele and Baret: Electrowetting: from basics to applications (2005 abstract)', url: 'https://research.utwente.nl/en/publications/electrowetting-from-basics-to-applications/'},
  ],
  quiz: {
    question: 'All three subpixels are open under room light. What happens after their voltage is removed?',
    options: ['Oil spreads across the reflectors and the pixel becomes dark.', 'The open oil shape is retained indefinitely, like bistable electronic ink.', 'The RGB filters keep emitting white light without electricity.'],
    answer: 0,
    explanation: 'In this electrowetting example, voltage maintains the open state. Removing it lets oil spread over the white base. The filters only select colors from incident light; they do not emit their own.',
  },
};

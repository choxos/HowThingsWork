import {SIX_DEFAULTS} from './thermometer-physics.js';

const trial = (defaults, part, view) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});
const sixTrial = trial(SIX_DEFAULTS, 'system', 'front');
const indexTrial = trial(SIX_DEFAULTS, 'indices', 'front');
const dayTrial = trial(SIX_DEFAULTS, 'chart', 'front');

const limits = 'Illustrative thermometers. Mercury grows 181 millionths of its volume a degree, colored alcohol 1,090, and glass 10. The liquid-in-glass thermometer has a 0.118 mL bulb with a 0.4 mm glass wall on a 292 mm stem, a scale engraved for its bore with 20 °C at the middle, and heat reaching its bulb at 10 W per square meter per degree in still air, 40 in a breeze and 500 in stirred water; it starts at 20 °C. The maximum-minimum thermometer has a 3 mL alcohol bulb and a 1 mm U-tube in still air, in a daily cosine of air temperature warmest at 3 pm. Not modeled: heat along the stem, the thread’s weight and surface tension, sunshine on the bulb, and the slow creep of glass. The liquid-in-glass thermometer runs forty times faster than real time and the maximum-minimum thermometer an hour a second.';
const sources = [
  {title: 'OpenStax College Physics 2e: thermal expansion of solids and liquids', url: 'https://openstax.org/books/college-physics-2e/pages/13-2-thermal-expansion-of-solids-and-liquids'},
  {title: 'Liquid-in-glass thermometer', url: 'https://en.wikipedia.org/wiki/Thermometer'},
];

export {liquidThermometerLesson} from './liquid-thermometer-lesson.js';

export const sixThermometerLesson = {
  simple: 'How does a maximum-minimum thermometer remember the day’s hottest and coldest moments?',
  overview: 'James Six’s thermometer of 1780 records extremes with no one watching. An alcohol bulb on one side does the sensing: as it warms, its alcohol pushes a thread of mercury round a U-shaped tube, and as it cools the thread moves back. The mercury carries a small steel index ahead of it on each side. Friction holds each index where it was left, so one marks the highest temperature since the reset and the other the lowest.',
  steps: [
    {title: 'Sense with alcohol', body: 'The large alcohol bulb above the minimum arm grows and shrinks with the temperature.'},
    {title: 'Push the mercury', body: 'Its alcohol pushes the mercury thread round the U: warming drives it up the maximum arm, cooling up the minimum arm.'},
    {title: 'Shove an index', body: 'Each end of the thread pushes a steel index up its arm. When the mercury retreats, a light spring holds the index in place.'},
    {title: 'Read the bottoms', body: 'The bottom of the right index shows the highest temperature; the bottom of the left index, on its upside-down scale, the lowest.'},
    {title: 'Reset', body: 'A magnet slides each index back down onto the mercury, ready for the next day.'},
  ],
  parts: [
    {name: 'Alcohol bulb', role: 'Senses the temperature and pushes the thread.'},
    {name: 'U-tube', role: 'Carries the mercury thread between the two arms.'},
    {name: 'Mercury thread and alcohol', role: 'Moves with the bulb’s alcohol and pushes the indices.'},
    {name: 'Steel indices', role: 'Stay at the highest and lowest points the mercury reached.'},
    {name: 'Scales', role: 'Rise up the maximum arm and down the minimum arm.'},
    {name: 'The day', role: 'Air and bulb over the day, with the indices’ readings.'},
  ],
  tryIt: [
    sixTrial('Record a day', 'Run the day from the morning reset with an average of 12 °C and a swing of 8 degrees.', 'By 9 am the next day the maximum index reads 19.99 °C and the minimum 4.01 °C, a hair inside the air’s 20 °C and 4 °C because the bulb lags behind.'),
    dayTrial('The lag', 'Compare the bulb with the air in mid-afternoon.', 'The 3 mL alcohol bulb follows the air 10.7 minutes behind, so at the air’s 20.00 °C peak it reads 19.98 °C.'),
    indexTrial('How far the thread moves', 'Watch the mercury move.', 'Each degree moves the mercury 4.125 mm along the tube, pushing the indices just as far.'),
    indexTrial('Read at noon', 'Look at the indices at noon.', 'Three hours after the reset the maximum index has already reached 17.38 °C, while the minimum still shows the morning’s 11.63 °C.'),
    sixTrial('A winter day', 'Set a winter day, five below zero on average with a swing of 3 degrees.', 'The minimum index stops at 8.00 degrees below zero and the maximum at 2.00 below.', {mean: -5, swing: 3}),
    sixTrial('A hot summer day', 'Set an average of 25 °C with a swing of 12 degrees.', 'The maximum index is pushed up to 36.99 °C and the minimum to 13.01 °C.', {mean: 25, swing: 12}),
    indexTrial('A steady day', 'Set the swing to 0 degrees.', 'The air never changes, so the indices never leave the mercury: both read 12.00 °C.', {swing: 0}),
    dayTrial('When the extremes came', 'Look at the day the next morning.', 'The maximum of 19.99 °C came at about 3 pm and the minimum of 4.01 °C at about 3 am: one reading covers the whole day and night.'),
  ],
  deeper: [
    {title: 'Why alcohol senses and mercury pushes', body: 'Alcohol grows far more for each degree, so a bulb of it moves the thread a long way. Mercury is dense, does not wet the glass, and stays in one piece, making a good piston and a clean edge to push the indices.'},
    {title: 'Why the lag hardly matters', body: 'The bulb takes about 11 minutes to follow the air, but the day changes over hours. The lag shaves only 0.01 °C off an 8 degree swing.'},
    {title: 'Reading at 9 am', body: 'Weather observers read and reset at the same hour each morning, so each reading covers one afternoon’s warmth and one night’s cold.'},
  ],
  misconception: 'The indices are not moved by magnets or springs toward the extremes. The mercury pushes them there; the springs only stop them sliding back.',
  limits,
  sources: [...sources, {title: 'Six’s thermometer', url: 'https://en.wikipedia.org/wiki/Six%27s_thermometer'}],
  quiz: {
    question: 'Why does the minimum arm’s scale read upside down?',
    options: ['Cooling pulls the mercury up that arm, so lower temperatures sit higher.', 'The glass bends light on that side.', 'The alcohol bulb is heavier than the mercury.'],
    answer: 0,
    explanation: 'When the alcohol shrinks, the mercury moves back round the U and climbs the minimum arm, so the colder it gets the higher the thread and index go there.',
  },
};

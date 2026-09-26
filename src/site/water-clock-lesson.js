import {WATER_DEFAULTS} from './water-clock-physics.js';

const trial = (part, view) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...WATER_DEFAULTS, ...values}, reset: true, part, isolate: false, view});
const clockTrial = trial('system', 'front');
const potTrial = trial('pot', 'front');
const inflowTrial = trial('inflow', 'front');
const chartTrial = trial('chart', 'front');

export const waterClockLesson = {
  simple: 'How did people tell the time at night with nothing but flowing water, and why was it so hard to keep even?',
  overview: 'A water clock measures time by how much water has flowed. The simplest is a pot with a small hole: the level falls past marks on the inside. But water leaves faster when the pot is full, so the marks can’t be evenly spaced, unless the pot is shaped to make up for it, as the Egyptians did. Ctesibius of Alexandria turned the idea around, filling a jar from a tank whose level never changes, so a float rose at a steady pace. Try both, and see what a cold night does to each.',
  steps: [
    {title: 'Let it drain', body: 'Water leaves a hole in the floor of a pot at a speed set by the depth above it: the deeper the water, the faster it goes.'},
    {title: 'Mark the hours', body: 'Marks inside the pot show where the level stands after each hour. In a straight pot they crowd together toward the bottom.'},
    {title: 'Shape the pot', body: 'A pot flaring toward its rim has more water to lose at the top, where it drains fastest, so the level falls at an even pace.'},
    {title: 'Or fill instead', body: 'A tank kept brim-full by an overflow feeds a narrow tube at a steady depth, so water trickles into a jar at a steady rate.'},
    {title: 'Read the float', body: 'A float in the jar lifts a pointer past hour marks on a column.'},
  ],
  parts: [
    {name: 'Outflow pot', role: 'Drains through a hole in its floor; its level passes the hour marks.'},
    {name: 'Inflow clock', role: 'A constant-head tank, a narrow tube, a jar, a float and a pointer.'},
    {name: 'Level over the night', role: 'Shows how evenly each design keeps time.'},
  ],
  tryIt: [
    potTrial('A straight pot', 'Play the night with the straight-sided pot and a 1.0 mm hole.', 'The level falls 66.5 mm in the first hour but only 6.1 mm in the eleventh, so the hour marks crowd toward the bottom, and the pot is empty after 11.51 h.'),
    potTrial('The Egyptian shape', 'Choose the flaring Egyptian pot with a 0.7 mm hole.', 'Its level falls the same 34.0 mm every hour, so the marks are evenly spaced, and it lasts 11.75 h.', {design: 1, bore: 0.7}),
    chartTrial('A wider hole', 'Set the hole to 1.5 mm.', 'Half as wide again is 2.25 times the area, and the pot is empty after 5.12 h.', {bore: 1.5}),
    inflowTrial('Ctesibius’s clock', 'Choose Ctesibius’s inflow clock.', 'The tank’s steady head pushes 54.1 mL an hour through the narrow tube, and the float rises a steady 19.13 mm every hour.', {design: 2}),
    inflowTrial('A winter night', 'Cool the inflow clock’s water to 5 °C.', 'Cold water is thicker, 1.501 mPa·s against 1.002 at 20 °C, so the float rises only 12.76 mm an hour and the clock runs slow.', {design: 2, temperature: 5}),
    chartTrial('A summer night', 'Warm the inflow clock’s water to 35 °C.', 'Thinner water flows faster: 26.67 mm an hour, 2.09 times the winter pace.', {design: 2, temperature: 35}),
    clockTrial('A plain hole ignores the cold', 'Cool the straight pot’s water to 5 °C.', 'Flow through a sharp hole barely depends on how thick the water is, so the pot still empties after 11.51 h.', {temperature: 5}),
    inflowTrial('A wider tube', 'Choose the inflow clock with a 2.0 mm hole.', 'The tube, now 1 mm wide, passes 16.00 times the water and fills the jar in 1.31 h, yet its flow is still smooth, with a Reynolds number of 305.', {design: 2, bore: 2}),
  ],
  deeper: [
    {title: 'Torricelli’s law', body: 'Water falls out of a hole as fast as if it had dropped from the surface: from a full pot 400 mm deep, at 2.80 m/s. As the level drops, so does the speed, which is why a straight pot slows down.'},
    {title: 'The Egyptian answer', body: 'If a round pot’s radius grows as the fourth root of the height, its area grows as the square root, exactly canceling the square root in the outflow speed. The water clock from Karnak, over three thousand years old, flares upward with straight sloping sides, an approximation to that curve.'},
    {title: 'A constant head', body: 'Ctesibius kept his supply tank overflowing, so the depth pushing water through the tube never changed. That made the flow steady, and his clocks could drive pointers, bells and moving figures.'},
    {title: 'Why a narrow tube feels the cold', body: 'Smooth flow through a narrow tube goes as the fourth power of its width and inversely as the water’s viscosity. Water at 5 °C is about twice as thick as at 35 °C, so an inflow clock needed adjusting with the seasons.'},
  ],
  misconception: 'A water clock does not measure time by weight or by the speed of the water. It measures how much water has moved, which is steady only if the flow is kept steady.',
  limits: 'Illustrative water clocks. A 400 mm pot of 150 mm radius at the rim, straight or with its radius growing as the fourth root of height, draining through a sharp hole passing 0.62 of its area by Torricelli’s law. An inflow clock with a 50 mm steady head over a 50 mm tube half as wide as the hole, smooth flow by Poiseuille’s law, a viscosity that follows water’s own curve with temperature, and a 30 mm jar. Not modeled: evaporation, the tube’s entry and exit losses, surface tension at a tiny hole, and the float’s own displacement. The night plays an hour a second.',
  sources: [
    {title: 'OpenStax College Physics 2e: flow rate and Poiseuille’s law', url: 'https://openstax.org/books/college-physics-2e/pages/12-4-viscosity-and-laminar-flow-poiseuilles-law'},
    {title: 'Water clock: outflow, inflow and Ctesibius', url: 'https://en.wikipedia.org/wiki/Water_clock'},
    {title: 'Torricelli’s law', url: 'https://en.wikipedia.org/wiki/Torricelli%27s_law'},
  ],
  quiz: {
    question: 'Why do the hour marks in a straight-sided outflow pot crowd toward the bottom?',
    options: ['Water leaves faster when the pot is full, so the level falls more in the early hours.', 'The pot is narrower at the bottom.', 'Water gets colder as the night goes on.'],
    answer: 0,
    explanation: 'The outflow speed goes as the square root of the depth. Full, the pot drains quickly; nearly empty, it trickles, so each hour moves the level less.',
  },
};

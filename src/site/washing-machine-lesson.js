import {WASHER_DEFAULTS} from './washing-machine-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...WASHER_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const laundryTrial = trial('laundry'), heaterTrial = trial('heater'), chartTrial = trial('charts'), waterTrial = trial('water'), tubTrial = trial('tub');

export const washingMachineLesson = {
  simple: 'How does a washing machine clean laundry, rinse the soap out, and spin it nearly dry without shaking itself apart?',
  overview: 'A front loader turns its drum slowly so lifters carry the laundry up and drop it through warm, soapy water: the pounding loosens dirt. Then it drains and spins fast, pinning the laundry to the wall while water is pressed out through the holes. Rinses dilute the detergent left in the laundry. All the while the heavy tub hangs on springs and dampers, so an unbalanced load shakes the tub instead of the floor. Try the temperature, the rinses, the spin, and a lopsided load.',
  steps: [
    {title: 'Fill', body: 'Water flows in until it covers the bottom of the drum and soaks the laundry.'},
    {title: 'Heat', body: 'A heater under the drum warms the water while the drum turns slowly.'},
    {title: 'Tumble', body: 'Lifters carry the laundry up; it falls back through the water again and again.'},
    {title: 'Drain and spin', body: 'A pump empties the tub, then the drum spins fast to press water out of the laundry.'},
    {title: 'Rinse', body: 'Fresh water dilutes the detergent left in the laundry, and another spin presses it out.'},
  ],
  parts: [
    {name: 'Cabinet and door', role: 'The case and the loading door.'},
    {name: 'Tub, counterweight and suspension', role: 'Holds the water; hangs on springs and dampers.'},
    {name: 'Drum and lifters', role: 'Turns the laundry and lets water through.'},
    {name: 'Laundry', role: 'Tumbled at low speed, pinned at high speed.'},
    {name: 'Water', role: 'Fills the bottom of the tub.'},
    {name: 'Heater', role: 'Warms the wash water.'},
    {name: 'Drain pump', role: 'Empties the tub.'},
    {name: 'Charts', role: 'Speed and temperature over the program, and the shaking.'},
  ],
  tryIt: [
    laundryTrial('Tumble the wash', 'Watch the laundry during the wash.', 'At 50 rpm the drum swings the laundry round with only 0.70 g, less than gravity, so it leaves the wall 45.7° before the top, drops 358 mm and lands at 2.95 m/s: the pounding that loosens dirt.'),
    laundryTrial('Pinned to the wall', 'Watch the final spin begin.', 'Past 59.8 rpm the wall can hold the laundry all the way round, so it stops falling; at 1,200 rpm the wall pushes on it with 402 times its weight.'),
    heaterTrial('Heating the water', 'Watch the heater at 40 °C.', 'Warming 17.5 L of water, 5 kg of laundry and the steel from 15.7 °C to 40 °C takes 17.5 min and 0.584 kWh; keeping it warm through the wash brings the heater to 0.609 kWh of the program’s 0.751 kWh.'),
    chartTrial('Wash cold', 'Set the temperature to 15 °C.', 'With nothing to heat, the program takes 42.0 min and 0.113 kWh, 15% of the energy of a 40 °C wash.', {temperature: 15}),
    waterTrial('Rinsing', 'Follow the detergent through both rinses.', 'Each rinse mixes the water left in the spun laundry with 15 L of fresh water, so of the 60 g of detergent only 0.28 g stays in the laundry; with one rinse 1.55 g would stay, with three 0.05 g.'),
    chartTrial('Spin speed', 'Set the spin to 800 rpm.', 'At 800 rpm the laundry comes out holding 63.5% of its dry weight in water, against 50.7% at 1,200 rpm and 48.3% at 1,400.', {spin: 800}),
    tubTrial('Through resonance', 'Watch the tub as the final spin speeds up.', 'Running up past the tub’s natural speed of 203 rpm, the 0.2 kg lump shakes it 3.27 mm at 221 rpm; at 1,200 rpm only 1.28 mm, and the springs and dampers pass just 59.5 N of the lump’s 789.6 N to the floor.'),
    tubTrial('A lopsided load', 'Bunch 0.5 kg of laundry on one side.', 'More than 0.4 kg off balance, the machine holds every spin to 600 rpm: the tub still shakes 8.07 mm on the way up, and the laundry comes out holding 79.3% of its dry weight in water.', {imbalance: 0.5}),
  ],
  deeper: [
    {title: 'Tumbling or pinned', body: 'To keep laundry on a circle the wall must push it inward. At the top, gravity already pulls inward, and if the drum turns slowly the wall has nothing to push: the laundry falls. For this 500 mm drum, turning faster than 59.8 rpm keeps it against the wall all the way round.'},
    {title: 'Rinsing is dilution', body: 'A rinse does not scrub detergent out; it dilutes what the laundry kept. Each rinse cuts the detergent by the share of old water in the new mix, so a harder spin before a rinse, leaving less old water, works like part of an extra rinse.'},
    {title: 'Why the tub is heavy', body: 'Concrete makes the tub assembly heavy, 40 kg here, so the unbalanced load moves it less, and soft springs keep its natural speed, 203 rpm, far below the spin. Far above that speed the tub barely follows the lump and the floor feels little. Running up through that speed in a minute, the tub never quite settles: it swings 3.27 mm, more than the 3.18 mm it would settle to at a steady 211 rpm.'},
    {title: 'Heat is most of the energy', body: 'Warming water takes 4,186 J for every liter and degree. The motor and pump use a small part of the program’s energy; the heater uses most of it.'},
  ],
  misconception: 'A washing machine does not clean mainly by spinning fast. Cleaning happens in the slow tumble, where laundry is lifted and dropped through the water; the fast spin only presses water out.',
  limits: 'Illustrative front loader: a drum 250 mm in radius washing at 50 rpm; 2.5 L of wash water a kilogram and 2 L a rinse, plus 5 L, from a 15 °C supply into a machine that starts in a room at 20 °C; a 2 kW heater; 60 g of detergent; fabric water held in pores around 5 µm, 1.5 kg a kilogram when drained, 0.45 kg of it inside the fibers; a 40 kg tub on 18 kN/m springs and 340 N·s/m dampers; spins held to 600 rpm above 0.4 kg off balance. Not modeled: the drum reversing, foam and soil chemistry, laundry sliding on the lifters, heater cycling, and water left in the sump. The program plays sixty times faster than real time; the tumbling laundry moves at its true pace.',
  sources: [
    {title: 'OpenStax University Physics Volume 1: centripetal force', url: 'https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force'},
    {title: 'OpenStax University Physics Volume 1: forced oscillations', url: 'https://openstax.org/books/university-physics-volume-1/pages/15-6-forced-oscillations'},
    {title: 'OpenStax College Physics 2e: temperature change and heat capacity', url: 'https://openstax.org/books/college-physics-2e/pages/14-2-temperature-change-and-heat-capacity'},
  ],
  quiz: {
    question: 'Why does laundry fall back down while washing but stay against the drum wall during a spin?',
    options: ['Above about 60 rpm the wall can hold it all the way round.', 'Water makes the laundry too heavy to fall.', 'The drum changes shape when it spins.'],
    answer: 0,
    explanation: 'At the top of the drum gravity already supplies inward force. Turning slowly, the laundry needs less than gravity gives, so it falls; turning fast, the wall must push, and holds it.',
  },
};

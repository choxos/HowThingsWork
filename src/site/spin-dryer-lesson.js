import {SPIN_DEFAULTS} from './spin-dryer-physics.js';

const trial = (part, view) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...SPIN_DEFAULTS, ...values}, reset: true, part, isolate: false, view});
const dryerTrial = trial('system', 'front');
const laundryTrial = trial('laundry', 'front');
const cabinetTrial = trial('cabinet', 'front');
const chartTrial = trial('charts', 'front');

export const spinDryerLesson = {
  simple: 'How does spinning wet laundry get the water out, and why can’t it get all of it?',
  overview: 'A spin dryer whirls laundry in a drum full of holes. The drum wall keeps pushing the laundry round in a circle, but water that slips into a hole has nothing pushing it and flies out. The faster the spin, the harder the water is pressed through the fabric, and the finer the pores it can empty. Some water always stays, in pores too fine to empty and inside the fibers themselves. Try the speed, and watch what an unbalanced load does to the cabinet.',
  steps: [
    {title: 'Speed up the drum', body: 'The motor brings the drum up to speed over about 20 s.'},
    {title: 'Press the laundry outward', body: 'The drum wall pushes the laundry round in a circle, pressing it into a layer against the wall.'},
    {title: 'Let the water go', body: 'Water in the fabric is pressed toward the holes. Where that pressure beats the grip of a pore, the pore empties and the water flies out.'},
    {title: 'Catch it', body: 'The water hits the outer tub and runs down the drain.'},
    {title: 'Ride out the shake', body: 'An unbalanced load tugs the drum round as it spins. Springs let the drum settle, but passing the cabinet’s natural speed on the way up makes it shake.'},
  ],
  parts: [
    {name: 'Perforated drum', role: 'Spins the laundry and lets the water out through its holes.'},
    {name: 'Laundry', role: 'A layer of wet cotton whose color shows its water.'},
    {name: 'Flying water', role: 'Drops leaving through the holes.'},
    {name: 'Outer tub and drain', role: 'Catch the water and run it to the jug.'},
    {name: 'Suspension springs', role: 'Let the drum settle round an unbalanced load.'},
    {name: 'Motor', role: 'Spins the drum.'},
    {name: 'Cabinet', role: 'Sways when the load is unbalanced.'},
    {name: 'Charts', role: 'Water left over the spin, and shaking against speed.'},
  ],
  tryIt: [
    dryerTrial('Spin a load', 'Spin 2 kg of laundry at 2,800 rpm.', 'The water feels 1,315 times its own weight. In 30 s the laundry is down from 150% water to 46.8%, and after three minutes 45.9%: 2.081 kg of water spun out.'),
    laundryTrial('Why it stops at 46%', 'Look at the laundry at full speed.', 'At 447.1 kPa every pore wider than 0.29 µm empties; what is left sits in narrower pores and inside the fibers, 45 kg for every 100 kg of cotton.'),
    chartTrial('A washing machine’s spin', 'Set the drum to 1,400 rpm.', 'At only 329 times gravity the laundry ends at 56.7% water, and 1.866 kg comes out.', {rpm: 1400}),
    chartTrial('A gentle spin', 'Set the drum to 800 rpm.', 'At 107 times gravity the water drains slowly and stops at 86.9%, leaving 1.738 kg of water in the load.', {rpm: 800}),
    chartTrial('Spinning beats heating', 'Compare the energy.', 'Spinning out 2.081 kg took 29.6 kJ; boiling it away would take 4.70 MJ, 159 times as much.'),
    cabinetTrial('The shake on the way up', 'Watch the cabinet as the drum speeds up.', 'Near 386 rpm the drum matches the cabinet’s natural speed of 382 rpm, and the 0.1 kg lump shakes it 3.01 mm; at full speed only 0.61 mm.'),
    cabinetTrial('A badly balanced load', 'Bunch 0.3 kg of wet laundry on one side.', 'It pulls with 3,869 N at full speed, and shakes the cabinet 9.04 mm as it passes 386 rpm.', {imbalance: 0.3}),
    cabinetTrial('A balanced load', 'Spread the laundry evenly.', 'With nothing off-center, nothing shakes: 0.00 mm, though the water comes out just the same.', {imbalance: 0}),
  ],
  deeper: [
    {title: 'Nothing pulls the water outward', body: 'At 2,800 rpm the drum wall moves at 44 m/s. It keeps turning the laundry’s path inward, round the circle. Water that reaches a hole is no longer turned, so it carries straight on, out of the drum.'},
    {title: 'The grip of a pore', body: 'Water in a narrow gap is held by surface tension, and the narrower the gap the harder it holds. Spinning faster empties finer pores, but each doubling of the speed empties less than the last.'},
    {title: 'Water you cannot spin out', body: 'Cotton fibers soak up water inside themselves, where no pore pressure can reach it. That water must be evaporated, which is why even the fastest spin leaves laundry damp.'},
    {title: 'Above the shaking speed', body: 'A mass on springs has a speed at which it shakes most. The drum passes the cabinet’s on the way up and runs far above it, where the heavy cabinet barely follows the quick tugs. Washing machines slow their run-up through that speed for the same reason.'},
  ],
  misconception: 'Spinning does not throw water outward by a centrifugal pull. The drum pushes the laundry inward to keep it on its circle; the water that escapes through a hole simply stops being pushed and flies off in a straight line.',
  limits: 'Illustrative spin dryer: a 300 mm drum with the laundry in a 40 mm layer at its wall. Cotton soaked with 1.5 kg of water a kilogram, 0.45 kg of it held inside the fibers, and pores spread around 5 µm, held by surface tension of 0.072 N/m; water drains with a time constant of 15 s at 100 kPa, shorter as the pressure rises. A 20 s run-up, windage and bearing drag of 150 W at 2,800 rpm, and a 25 kg cabinet on 40 kN/m springs damped at a tenth of critical. Not modeled: re-wetting, the layer’s changing thickness, the motor’s electrical losses, and the shaking’s effect on the drum. The spin plays six times faster than real time.',
  sources: [
    {title: 'OpenStax College Physics 2e: centripetal force', url: 'https://openstax.org/books/college-physics-2e/pages/6-3-centripetal-force'},
    {title: 'OpenStax College Physics 2e: surface tension and capillary action', url: 'https://openstax.org/books/college-physics-2e/pages/11-8-cohesion-and-adhesion-in-liquids-surface-tension-and-capillary-action'},
    {title: 'Resonance of a driven, damped oscillator', url: 'https://openstax.org/books/college-physics-2e/pages/16-8-forced-oscillations-and-resonance'},
  ],
  quiz: {
    question: 'Why does a spin dryer shake most while it is speeding up, not at full speed?',
    options: ['On the way up the drum passes the cabinet’s natural shaking speed.', 'The motor pushes hardest at the start.', 'The laundry is wettest and heaviest at full speed.'],
    answer: 0,
    explanation: 'Every mass on springs has a speed at which a steady tug makes it swing most. Far above that speed the cabinet is too heavy to follow the quick tugs.',
  },
};

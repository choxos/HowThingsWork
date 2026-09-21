import {VACUUM_DEFAULTS} from './vacuum-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...VACUUM_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const cleanerTrial = trial('system'), nozzleTrial = trial('nozzle'), floorTrial = trial('floor'), chartTrial = trial('charts');
const canisterTrial = trial('canister'), brushTrial = trial('brush'), baseTrial = trial('base'), ductTrial = trial('duct');

const sources = [
  {title: 'OpenStax College Physics 2e: power in fluid flow, pressure times flow rate', url: 'https://openstax.org/books/college-physics-2e/pages/12-3-the-most-general-applications-of-bernoullis-equation'},
  {title: 'OpenStax University Physics Volume 1: viscosity and turbulence', url: 'https://openstax.org/books/university-physics-volume-1/pages/14-7-viscosity-and-turbulence'},
  {title: 'OpenStax College Physics 2e: drag forces', url: 'https://openstax.org/books/college-physics-2e/pages/5-2-drag-forces'},
];

export const vacuumCleanerLesson = {
  simple: 'How does a vacuum cleaner pick up dirt, and why does a full bag make it worse?',
  overview: 'A fan in the canister flings air out, leaving the air inside below the room’s pressure. The room’s air pushes in through the only way open: the nozzle, the hose, a dust bag and a filter. Fast air sweeping across the floor drags grains along and carries them into the bag. Every piece of that path uses up some of the fan’s pressure, so what cleans the floor is how fast the air moves there, not how hard the fan pulls. Try a full bag, the crevice tool and a sock over the nozzle.',
  steps: [
    {title: 'Lower the pressure', body: 'The motor spins a fan tens of thousands of times a minute. It flings air out of the canister, leaving the air inside below the room’s pressure.'},
    {title: 'Let the room push air in', body: 'The room’s air pushes in through the nozzle’s narrow slot, speeding up to squeeze through.'},
    {title: 'Drag the dirt along', body: 'Air rushing across a grain drags on it. Fast enough, the drag beats the grain’s weight and the air carries it off up the hose.'},
    {title: 'Catch it in the bag', body: 'The bag is far wider than the hose, so the air slows to under a meter a second, drops its grains and passes through the paper.'},
    {title: 'Clean the air and let it out', body: 'A fine filter catches what got through the bag. The air passes the fan and leaves past the motor, warmed by its losses.'},
  ],
  parts: [
    {name: 'Nozzle', role: 'The floor head’s slot, the crevice tool, or a blocked opening.'},
    {name: 'Hose and wand', role: 'Carry the fast air and its dirt to the canister.'},
    {name: 'Dust bag', role: 'Slows the air and keeps the dirt.'},
    {name: 'Exhaust filter', role: 'Catches fine dust the bag lets through.'},
    {name: 'Fan and motor', role: 'Make the pressure difference that drives the air.'},
    {name: 'Moving air', role: 'Dots moving at the air’s speed in each piece.'},
    {name: 'Dirt on the floor', role: 'Sand, rice or carpet dust, lifted or left.'},
    {name: 'Charts', role: 'The fan against the path, and the pressure along the way.'},
  ],
  tryIt: [
    cleanerTrial('Clean up sand', 'Switch it on with the floor head over sand.', 'The fan draws 35.24 L of air a second in through the slot at 23.5 m/s. A 1 mm grain of sand falls through still air at 7.01 m/s, so air at 10.5 m/s lifts it, and this air carries it off.'),
    chartTrial('Where the suction goes', 'Watch the pressure along the path.', 'The fan lowers the pressure by 8.51 kPa, but only 0.83 kPa of it works at the slot: the hose uses 1.69, the bag 4.23 and the filter 1.76.'),
    chartTrial('A full bag', 'Fill the bag to 100%.', 'The fan now pulls 14.92 kPa instead of 8.51, yet the flow falls to 25.52 L/s and only 0.43 kPa works at the slot: 11.1 W of air power there instead of 29.2 W. More suction, less cleaning.', {bag: 100}),
    floorTrial('Rice and a full bag', 'Try rice with the bag 100% full.', 'A 5 mm grain of rice needs air at 20.4 m/s. The full bag leaves 17.0 m/s at the slot, and the rice stays put; an empty bag gives 23.5 m/s and lifts it.', {bag: 100, debris: 1}),
    nozzleTrial('The crevice tool', 'Fit the crevice tool.', 'Its slot is a tenth as wide, but the flow falls only to 20.86 L/s, so the air rushes in at 104.3 m/s and 13.05 kPa works at the tip: 272.2 W of air power where the floor head had 29.2 W.', {nozzle: 1}),
    nozzleTrial('Block the nozzle', 'Put a sock over the floor head.', 'The flow stops, and the fan’s whole 22.00 kPa holds the sock on with 33.0 N. The motor draws 610 W instead of 1,041 W: with no air to move, the fan does less work.', {nozzle: 2}),
    canisterTrial('A clogged filter', 'Clog the exhaust filter.', 'It now uses 4.82 kPa instead of 1.76, and the flow falls to 32.11 L/s. The slot’s 21.4 m/s still lifts sand.', {filter: 1}),
    floorTrial('Dust in carpet', 'Try dust in carpet.', 'Specks 0.05 mm across fall at only 0.18 m/s, but they cling to the fibers. Air at 23.5 m/s slides past and leaves them: a plain floor head cannot beat the carpet.', {debris: 2}),
  ],
  deeper: [
    {title: 'Suction is not cleaning', body: 'The fan’s pressure is greatest when nothing moves: 22 kPa with a sock over the nozzle, and nothing is picked up. Dirt moves only where air moves fast across it, so what matters at the floor is the air power there, pressure times flow.'},
    {title: 'Why the bag is big', body: 'Air rushing along the hose slows to under a meter a second in the bag, whose cross-section is nearly 50 times the hose’s. Most grains drop out, and the paper catches the rest.'},
    {title: 'Turbulent air in the hose', body: 'At 43.8 m/s in a 32 mm hose, the Reynolds number is about 93,000. The air tumbles, and friction on the wall uses up 1.69 kPa over the 2.6 m.'},
    {title: 'Less work, not more, when blocked', body: 'A blocked fan only churns the air trapped in it. The motor has less to do, so it speeds up and its note rises: the opposite of straining.'},
  ],
  misconception: 'A vacuum cleaner does not pull dirt up by suction. Its fan lowers the pressure inside, the room’s air pushes in through the nozzle, and that fast-moving air drags the dirt along. More suction with less air, as with a full bag, cleans worse.',
  limits: 'Illustrative canister cleaner: a fan that seals at 22 kPa and runs out at 45 L/s, 45% efficient at best, with 60 W of motor losses; a floor head with a 250 mm slot 6 mm high; a crevice tool 25 by 8 mm; 2.6 m of 32 mm hose and wand, treated as smooth; a bag and filter losing 120 and 50 Pa for each liter a second. A grain lifts when the slot’s air moves one and a half times as fast as the grain falls. Not modeled: the motor slowing under load, leaks at the head, the bag filling as it works, the hose’s corrugations, and brush heads. Dots move 15 mm a second for each meter a second of air; grains are drawn larger than life.',
  sources,
  quiz: {
    question: 'Why does a vacuum cleaner with a full bag pick up less, even though its fan pulls harder?',
    options: ['The bag uses up most of the pressure, so less air moves through the nozzle.', 'A full bag is too heavy for the fan to lift.', 'Dirt in the bag leaks back out of the nozzle.'],
    answer: 0,
    explanation: 'A fan’s pressure rises as its flow falls. With the bag taking most of that pressure, the air at the slot slows below what the dirt needs.',
  },
};

export const uprightVacuumLesson = {
  simple: 'How does an upright vacuum cleaner get dust out of carpet?',
  overview: 'A classic upright puts its fan low in the floor head, right behind a spinning brush roll. The brush beats dust loose from the carpet, the fan draws it in through the slot and blows it up a short duct into a bag on the handle, which swells with the air pushed into it. Its path is short, so little pressure is lost on the way. Try carpet dust, a full bag and the crevice tool.',
  steps: [
    {title: 'Beat the carpet', body: 'A belt from the motor spins the brush roll. Its bristles flick the carpet’s fibers and shake loose the dust clinging to them.'},
    {title: 'Draw the air in', body: 'The fan lowers the pressure in the brush chamber, and the room’s air rushes in under the slot, carrying what the brush threw up.'},
    {title: 'Blow it up to the bag', body: 'The dirty air passes straight through the fan, whose flat blades grit cannot jam, and is blown up the duct into the bag.'},
    {title: 'Filter it out', body: 'The air escapes through the paper bag and its cloth cover, leaving the dirt behind.'},
  ],
  parts: [
    {name: 'Nozzle', role: 'The slot under the floor head, the crevice tool, or a blocked opening.'},
    {name: 'Brush roll', role: 'Beats dust loose from the carpet.'},
    {name: 'Floor head, fan and motor', role: 'Draw the air in and blow it on to the bag.'},
    {name: 'Duct, bag and cloth cover', role: 'Carry the dirty air up and keep its dirt.'},
    {name: 'Moving air', role: 'Dots moving at the air’s speed in each piece.'},
    {name: 'Dirt on the floor', role: 'Sand, rice or carpet dust, lifted or left.'},
    {name: 'Charts', role: 'The fan against the path, and the pressure along the way.'},
  ],
  tryIt: [
    cleanerTrial('Clean up sand', 'Switch it on over sand.', 'The fan draws 38.13 L of air a second in along its 300 mm slot at 21.2 m/s, twice the 10.5 m/s that lifts sand.'),
    brushTrial('Dust in carpet', 'Try dust in carpet.', 'The brush roll beats the specks loose from the fibers. Free, they fall at only 0.18 m/s, and the slot’s 21.2 m/s carries them off.', {debris: 2}),
    ductTrial('A swollen bag', 'Look at the bag on the handle.', 'The fan leaves the air 4.35 kPa above the room’s pressure, and it is still 4.19 kPa above inside the bag, so the air pushes out through paper and cloth and the bag swells.'),
    chartTrial('A short path', 'Watch the pressure along the path.', 'Its 0.6 m duct uses only 0.16 kPa, where the canister’s hose uses 1.69. So with 5.02 kPa across its fan, against 8.51 in the canister, it moves 38.13 L/s to the canister’s 35.24.'),
    floorTrial('Rice and a full bag', 'Try rice with the bag 100% full.', 'The flow falls to 27.43 L/s, and 15.2 m/s at the slot is too slow for rice, which needs 20.4 m/s.', {bag: 100, debris: 1}),
    nozzleTrial('The crevice tool on carpet', 'Fit the crevice tool and try dust in carpet.', 'Air rushes in at 85.1 m/s, yet the dust stays: with the brush roll lifted off the carpet, nothing beats it loose.', {nozzle: 1, debris: 2}),
    nozzleTrial('Block the slot', 'Put a sock over the floor head.', 'The fan’s whole 12.00 kPa holds the sock on with 21.6 N, the bag goes limp at the room’s pressure, and the motor draws 529 W instead of 855 W.', {nozzle: 2}),
    baseTrial('Where the power goes', 'Look at the fan and motor.', 'It draws 855 W: 755 W turns the fan, 40 W the brush roll and 60 W heats the motor. Only 191.5 W reaches the air, for flat radial blades are 25.3% efficient here.'),
  ],
  deeper: [
    {title: 'Dirty air through the fan', body: 'Putting the fan before the bag keeps the path short, but every grain passes through the fan. Flat radial blades survive that, at a price: they seal at 12 kPa and are 35% efficient at best, where the canister’s sheltered fan reaches 22 kPa and 45%.'},
    {title: 'Why the bag swells', body: 'Air moves from higher pressure to lower. The fan leaves the air in the upright’s bag above the room’s, so it pushes out through the cloth and fills the bag like a sail. A canister’s bag sits in air its fan has already pulled below the room’s.'},
    {title: 'The brush does the carpet’s work', body: 'Dust caught among carpet fibers clings far harder than its weight. Air fast enough to tear it free would need an impractical fan; a spinning brush that flicks the fibers frees it for a few tens of watts.'},
  ],
  misconception: 'An upright does not clean carpet by stronger suction; its fan seals at about half a canister’s pressure. It cleans carpet because the brush roll beats the dust loose, right where the air can carry it away.',
  limits: 'Illustrative upright cleaner: a radial fan that seals at 12 kPa and runs out at 50 L/s, 35% efficient at best; 60 W of motor losses and 40 W for belt and brush roll; a 300 mm slot 6 mm high; 0.6 m of 40 mm duct and fill tube, treated as smooth; a paper bag and cloth cover losing 60 and 50 Pa for each liter a second. A grain lifts when the slot’s air moves one and a half times as fast as the grain falls, and carpet dust only where the brush roll touches the carpet. Not modeled: the motor slowing under load, carpet pile closing the slot, the brush flicking grains into the air, and the bag filling as it works. The crevice tool is drawn fitted straight to the inlet; a real upright takes it on a hose. Dots move 15 mm a second for each meter a second of air; grains are drawn larger than life.',
  sources,
  quiz: {
    question: 'Why does an upright’s bag swell up while it runs?',
    options: ['Its fan blows air into the bag, above the room’s pressure.', 'The dirt in the bag expands as it warms.', 'Suction from the fan pulls the cloth outward.'],
    answer: 0,
    explanation: 'The fan sits before the bag and leaves the air in it above the room’s pressure, so the air pushes out through the cloth and fills it.',
  },
};

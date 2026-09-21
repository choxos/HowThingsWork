import {AEROSOL_DEFAULTS} from './aerosol-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...AEROSOL_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const canTrial = trial('system'), chartTrial = trial('charts'), tubeTrial = trial('dip-tube'), sprayTrial = trial('spray'), shellTrial = trial('can');

export const aerosolLesson = {
  simple: 'Why does a spray can keep spraying just as hard until it is nearly empty, and why must it never get hot?',
  overview: 'A spray can holds a liquid product and a propellant under pressure. Press the button and the gas above the liquid drives it up a dip tube and out through a tiny hole. Most cans use a liquefied gas: however much is left, it boils just enough to keep the same pressure, cooling the can as it goes, and the propellant in the jet boils the instant it leaves, tearing the product into mist. Compare a can pressurized with nitrogen, try it cold, hot and upside down.',
  steps: [
    {title: 'Press the button', body: 'The actuator pushes the valve stem down against its spring, uncovering a small hole in the stem.'},
    {title: 'Let the pressure push', body: 'The gas above the liquid presses on it, driving it up the dip tube, through the valve and out of the nozzle.'},
    {title: 'Boil to keep the pressure', body: 'As liquid leaves, liquefied propellant boils to fill the growing gas space. The pressure stays up, and the boiling cools the can.'},
    {title: 'Flash into mist', body: 'Outside, the propellant in the jet is far above its boiling point. It boils almost at once, tearing the product into fine drops.'},
  ],
  parts: [
    {name: 'Steel can', role: 'Holds the pressure; turns blue as it cools.'},
    {name: 'Liquid', role: 'Product with dissolved propellant, drawn at its level.'},
    {name: 'Gas above the liquid', role: 'Propellant vapor or nitrogen, pressing on the liquid.'},
    {name: 'Dip tube', role: 'Draws from the bottom corner, liquid or gas.'},
    {name: 'Valve', role: 'Spring, stem and gasket that open when pressed.'},
    {name: 'Actuator and nozzle', role: 'The button and the tiny exit hole.'},
    {name: 'Spray', role: 'Drops or puffs of gas leaving the nozzle.'},
    {name: 'Charts', role: 'Pressure over the spray, and pressure against temperature.'},
  ],
  tryIt: [
    canTrial('Spray the can', 'Hold the button down.', 'At 3.42 bar the liquid leaves the 0.45 mm hole at 32.0 m/s, 2.38 g a second. In the jet, 35% of the propellant boils at once, tearing the liquid into a mist.'),
    chartTrial('Pressure that holds', 'Watch the pressure while the can empties.', 'Half empty after 52 s, it still sprays at 3.26 bar. The pressure sags only because boiling propellant cools the can, to 16.2 °C when the liquid runs out at 105 s.'),
    chartTrial('A nitrogen can', 'Switch to compressed nitrogen.', 'It starts at 8.99 bar, but the nitrogen spreads as the liquid leaves: 4.69 bar half empty and 3.02 bar at the end, 81 s in. The spray weakens all the way down.', {propellant: 1}),
    sprayTrial('A cold can', 'Cool the can to 0 °C.', 'The propellant’s pressure falls to 1.45 bar: the jet slows to 20.9 m/s, only 21% of the propellant flashes, and the can takes 161 s to empty.', {temperature: 0}),
    chartTrial('A hot can', 'Warm the can to 50 °C.', 'The pressure climbs to 8.40 bar, 2.46 times its pressure at 20 °C, while a nitrogen can would only go from 8.99 to 10.01 bar. That steep climb is why cans warn against heat.', {temperature: 50}),
    tubeTrial('Upside down', 'Turn the can upside down.', 'The dip tube’s open end now sits in the gas, so only propellant vapor escapes, 0.140 g a second, and no product at all. Boiling to replace it, the propellant cools the can to 15.4 °C in a minute and wastes 7.86 g.', {orientation: 1}),
    tubeTrial('Nitrogen upside down', 'Turn a nitrogen can upside down.', 'The nitrogen rushes out, and in 22 s the can is down to the room’s pressure, having lost 2.06 g of gas. Its 270.0 g of product is stranded with nothing to push it out.', {propellant: 1, orientation: 1}),
    shellTrial('The last of it', 'Keep holding the button after the liquid runs out.', 'Once the dip tube’s end is uncovered only vapor sputters out. The last propellant boils in the bottom and chills the can to 6.1 °C, and the pressure is spent at 178 s.'),
  ],
  deeper: [
    {title: 'Why the pressure holds', body: 'Above a liquid, its vapor settles at a pressure set by temperature alone. Spray out liquid and a little more propellant boils to fill the space, so the can keeps its pressure until the liquid is nearly gone.'},
    {title: 'Flashing into mist', body: 'At the room’s pressure this propellant boils at 29 degrees below freezing. Leaving a can at 20 °C, it is 49 degrees too hot to stay liquid, and part of it boils within a millimeter or two, shattering the product into fine drops.'},
    {title: 'Heat is the danger', body: 'Warmed to 50 °C, a can filled at 20 °C holds 8.42 bar, about two and a half times as much. Hotter still, the liquid also swells into the gas space and the pressure climbs faster; cans are made to survive well above their warning temperature, but a fire or a hot car can burst one.'},
    {title: 'Why nitrogen cans need room', body: 'Squeezed gas loses pressure as it spreads, so a nitrogen can needs a big gas space and a high starting pressure, and it still weakens as it empties. With no propellant in its jet to boil, its spray is coarser.'},
  ],
  misconception: 'A spray can is not full of compressed air that gets used up. Most hold a liquefied gas that stays at the same pressure however much is left, boiling a little more each time you spray, until the liquid runs out.',
  limits: 'Illustrative can: 500 mL brimful, holding 120 g of an oily product of molar mass 300 g/mol dissolved in 130 g of propane and isobutane, 40% propane by moles, with vapor pressures from NIST’s Antoine fits and a latent heat of 335 kJ/kg; or 300 mL of product under 200 mL of nitrogen filled at 10 bar absolute. A hole 0.45 mm across with a discharge coefficient of 0.7, and a dip tube reaching the last 6 mL. The can gains heat from still air at 10 W/(m²K) over 0.0475 m². Not modeled: propane boiling off faster than isobutane, the liquid swelling as it warms, friction in the dip tube and valve, vapor forming inside the valve, nitrogen dissolving in the product, and a hand warming the can. The spray plays six times faster than real time.',
  sources: [
    {title: 'NIST Chemistry WebBook: propane phase change data and Antoine fits', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C74986&Mask=4'},
    {title: 'NIST Chemistry WebBook: isobutane phase change data and Antoine fits', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C75285&Mask=4'},
    {title: 'OpenStax College Physics 2e: humidity, evaporation and boiling', url: 'https://openstax.org/books/college-physics-2e/pages/13-6-humidity-evaporation-and-boiling'},
    {title: 'OpenStax College Physics 2e: Bernoulli’s equation', url: 'https://openstax.org/books/college-physics-2e/pages/12-2-bernoullis-equation'},
  ],
  quiz: {
    question: 'Why does a spray can keep spraying strongly until it is nearly empty?',
    options: ['Its liquefied propellant boils to keep the same pressure.', 'The steel can squeezes inward as it empties.', 'The valve opens wider as the pressure drops.'],
    answer: 0,
    explanation: 'The vapor above a liquid settles at a pressure set by temperature. As liquid leaves, a little more propellant boils to fill the space, so the pressure holds until the liquid runs out.',
  },
};

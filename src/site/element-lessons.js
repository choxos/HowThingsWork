import {HEATER_DEFAULTS, KETTLE_DEFAULTS, DRYER_DEFAULTS} from './element-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  nikrothal: {title: 'Kanthal: Nikrothal 80 wire, material datasheet', url: 'https://www.kanthal.com/en/products/material-datasheets/wire/resistance-heating-wire-and-resistance-wire/nikrothal-80/'},
  nichrome: {title: 'Wikipedia: Nichrome', url: 'https://en.wikipedia.org/wiki/Nichrome'},
  joule: {title: 'Wikipedia: Joule heating', url: 'https://en.wikipedia.org/wiki/Joule_heating'},
  electricHeating: {title: 'Wikipedia: Electric heating', url: 'https://en.wikipedia.org/wiki/Electric_heating'},
  mains: {title: 'Wikipedia: Mains electricity', url: 'https://en.wikipedia.org/wiki/Mains_electricity'},
  kettle: {title: 'Wikipedia: Kettle', url: 'https://en.wikipedia.org/wiki/Kettle'},
  hairDryer: {title: 'Wikipedia: Hair dryer', url: 'https://en.wikipedia.org/wiki/Hair_dryer'},
  thermalCutoff: {title: 'Wikipedia: Thermal cutoff', url: 'https://en.wikipedia.org/wiki/Thermal_cutoff'},
  water: {title: 'Wikipedia: Properties of water', url: 'https://en.wikipedia.org/wiki/Properties_of_water'},
  latent: {title: 'Wikipedia: Latent heat', url: 'https://en.wikipedia.org/wiki/Latent_heat'},
  airDensity: {title: 'Wikipedia: Density of air', url: 'https://en.wikipedia.org/wiki/Density_of_air'},
  heatCapacities: {title: 'Wikipedia: Table of specific heat capacities', url: 'https://en.wikipedia.org/wiki/Table_of_specific_heat_capacities'},
  draper: {title: 'Wikipedia: Draper point', url: 'https://en.wikipedia.org/wiki/Draper_point'},
  incandescence: {title: 'Wikipedia: Incandescence', url: 'https://en.wikipedia.org/wiki/Incandescence'},
  emissivity: {title: 'Wikipedia: Emissivity', url: 'https://en.wikipedia.org/wiki/Emissivity'},
  thermalRadiation: {title: 'Wikipedia: Thermal radiation', url: 'https://en.wikipedia.org/wiki/Thermal_radiation'},
  stefan: {title: 'NIST: Stefan-Boltzmann constant, CODATA 2022', url: 'https://physics.nist.gov/cgi-bin/cuu/Value?sigma'},
  resistivity: {title: 'Wikipedia: Electrical resistivity and conductivity', url: 'https://en.wikipedia.org/wiki/Electrical_resistivity_and_conductivity'},
};

/** What all three machines take without a source. */
export const elementLimits = 'Not from a source: every dimension of every element and of the case, vessel or barrel around it, chosen so that each machine comes out at the power its own page gives; a room that never warms, however long the machine runs; and still air taken to carry 15 W from each square meter of wire for each degree it stands above that room, which is a stated figure rather than a measured one. The wire is taken as one temperature all through, with no allowance for the ends being cooler, and its datasheet tables are read straight between their tabulated points.';

const heaterTrial = {
  element: trial(HEATER_DEFAULTS, 'element'), reflector: trial(HEATER_DEFAULTS, 'reflector'),
  beam: trial(HEATER_DEFAULTS, 'beam'), chart: trial(HEATER_DEFAULTS, 'chart'), guard: trial(HEATER_DEFAULTS, 'guard'),
};

export const electricHeatingLimits = `${elementLimits} The reflector is taken to send 75 percent of the radiation forward instead of 35 percent, both stated shares rather than measured ones, and it moves heat about rather than making any. The element's glow is drawn from its temperature through a chosen ramp of color, not a calculated spectrum, and the heater is drawn from the side with the room in front of it rather than around it.`;

export const electricHeatingLesson = {
  simple: 'How does a wire give a room its warmth just by carrying a current?',
  overview: 'A bar heater is the simplest machine in the house: a length of wire, a dish behind it, and a guard in front. Current forced through the wire gives up its energy as heat, and with nowhere to put that heat the wire climbs until it is losing as fast as it is taking. By then it is glowing, and most of what it gives out leaves as radiation, which crosses the room without warming the air on the way. Change the voltage, change how much wire is in the coil, take the reflector away, and press Play to switch it on cold.',
  steps: [
    {title: 'Push a current through the wire', body: 'A complete circuit across the element drives charge through it, and the wire resists that passage.'},
    {title: 'Turn the resistance into heat', body: 'The moving charge jostles the metal as it goes, so every bit of electrical energy taken from the supply ends up as heat in the wire.'},
    {title: 'Climb until the losses catch up', body: 'The wire has almost nothing to store heat in, so it warms quickly, and it keeps warming until what it radiates and what the air carries off together match what it is taking in.'},
    {title: 'Glow, and radiate', body: 'Past a certain temperature a hot solid emits enough visible light to be seen, and by then it is throwing out far more than the air beside it can carry away.'},
    {title: 'Aim it into the room', body: 'The dish behind the element turns the radiation that would have gone into the wall round and sends it forward instead, so more of the same heat lands where somebody is sitting.'},
  ],
  parts: [
    {name: 'Case and feet', role: 'Holds the element clear of everything and stands the heater on the floor.'},
    {name: 'Reflector', role: 'Turns the radiation that would go backward round and sends it into the room.'},
    {name: 'Resistance element', role: 'The wire that turns the electricity into heat and glows while it does.'},
    {name: 'Guard', role: 'Keeps anything in the room from touching the element.'},
    {name: 'Heat leaving the element', role: 'Where the element sends its heat, and how much goes each way.'},
    {name: 'The element warming up', role: 'The element’s temperature from the moment it is switched on.'},
  ],
  tryIt: [
    heaterTrial.chart('Switch it on cold', 'Press Play and watch the element.', 'The wire climbs to 959 °C and settles there, taking 972 W and radiating 866 W of it.'),
    heaterTrial.reflector('Take the reflector away', 'Choose no reflector.', 'Nothing changes about the element at all, but what it sends into the room falls from 649 W to 303 W; the other 346 W now warms the wall behind it.', {reflector: 0}),
    heaterTrial.element('Wind in more wire', 'Set the element length to 12 m.', 'Twice the wire is twice the resistance, 104.1 Ω instead of 52.0 Ω cold, so the power halves to 487 W and the wire settles cooler, at 564 °C.', {length: 12}),
    heaterTrial.element('Cut the element short', 'Set the element length to 4 m.', 'Less wire is less resistance and more power: 1,425 W, and the wire settles at 1,246 °C, above the 1,200 °C its datasheet allows it to run at continuously.', {length: 4}),
    heaterTrial.element('Plug it in in America', 'Set the supply to 120 V.', 'Power goes with the square of the voltage, so a little over half the voltage gives 266 W instead of 972 W, and the wire settles at 585 °C.', {volts: 120}),
    heaterTrial.beam('Follow the heat out', 'Press Play and look at the arrows.', 'At its settled temperature the element radiates 866 W and the air carries off only 106 W: 89% of its output leaves as radiation and 11% as warm air.'),
    heaterTrial.guard('Warm the room it stands in', 'Set the room temperature to 30 °C.', 'A warmer room takes back less, so the same element settles a degree hotter, at 960 °C, and the air carries off 105 W instead of 106 W.', {room: 30}),
  ],
  deeper: [
    {title: 'Why this wire', body: 'The datasheet gives Nikrothal 80 a resistivity of 1.09 Ω·mm²/m, and the Nichrome page puts nichrome at about 1.12 μΩ·m, some 67 times copper’s 16.78 nΩ·m. That is the whole point: a wire you can hold in one hand has enough resistance to turn kilowatts into heat, where the same length of copper would have almost none. The Nichrome page adds the other half of the trick: heated red hot in air, the alloy grows a skin of chromium oxide that oxygen cannot get through, so it does not burn away. Its datasheet lets it work at 1,200 °C continuously, against a melting point of 1,400 °C.'},
    {title: 'Resistance that will not sit still', body: 'A heating element is not quite the fixed resistor of a textbook. The datasheet tabulates a temperature factor of resistivity, and following it up from cold this element goes from 52.0 Ω to 54.4 Ω by the time it settles. The power falls with it, from 1,016 W the instant it is switched on to 972 W once it is hot, 4.4% less. That is small for this alloy, which is exactly why it is used: an element whose resistance ran away with temperature would be far harder to build around.'},
    {title: 'Why it comes up so fast', body: 'There is almost nothing there to heat. The whole element weighs 6.3 g, and at the specific heat its datasheet gives near room temperature that is 2.9 J for each degree, so a kilowatt moves it hundreds of degrees a second. A bar heater is warm the moment you switch it on and cold the moment you switch it off, and no amount of leaving it running stores anything up.'},
    {title: 'When metal begins to glow', body: 'The Draper point is the temperature above which almost every solid glows visibly, and the Draper point page puts it at 525 °C, or 798 K, established by John William Draper in 1847. Below it a body is radiating hard, but almost all of it in the infrared. This element passes that point on its way up and settles well above it, which is why a bar heater is something you can see working from across the room.'},
    {title: 'The fourth power', body: 'Radiation does not grow in proportion to temperature; it grows with the fourth power of it. Stefan and Boltzmann give the power off a surface as its emissivity times 5.670e-8 W/(m²·K⁴) times its area times that fourth power, less what comes back from the room. The datasheet gives fully oxidized wire an emissivity of 0.88, and this coil offers 75 cm² of surface. It is the fourth power that decides the character of the machine: at 585 °C radiation is 76% of the output, but by 1,246 °C it is 94%, and the air has almost stopped mattering.'},
    {title: 'Efficient, and still not the best way', body: 'The Electric heating page says the efficiency of electric space heating is 100% for the customer, because every unit bought becomes heat in the room. Nothing is lost up a flue and nothing is wasted. But the same page points out that a heat pump reaches 150% to 600%, a coefficient of performance of 1.5 to 6, because it moves heat that is already there instead of making it. A resistance element cannot beat 1, and the air conditioner in this same room, run backward, would.'},
  ],
  misconception: 'A reflector does not make a heater more powerful. The element takes exactly the same electricity and gives out exactly the same heat with it or without it; all the dish does is decide how much of that heat goes toward you rather than into the wall.',
  limits: `The heater is drawn at true size from the side, and only the element’s wire is drawn thicker than it is, 25 times thicker, so that it can be seen. The run lasts 120 s, long enough for even the coolest element here to stop climbing, and plays 8 times faster than the real thing. ${electricHeatingLimits}`,
  sources: [sources.nikrothal, sources.nichrome, sources.joule, sources.electricHeating, sources.mains, sources.draper, sources.incandescence, sources.emissivity, sources.thermalRadiation, sources.stefan, sources.resistivity],
  quiz: {
    question: 'Fitting a reflector behind the element changes which of these?',
    options: [
      'Where the heat goes, and nothing else.',
      'How much heat the element makes.',
      'How much current the element draws.',
    ],
    answer: 0,
    explanation: 'The element settles at the same temperature and takes the same power either way; only the share sent forward changes, from 303 W to 649 W.',
  },
};

const kettleTrial = {
  water: trial(KETTLE_DEFAULTS, 'water'), element: trial(KETTLE_DEFAULTS, 'element'),
  steamSwitch: trial(KETTLE_DEFAULTS, 'switch'), chart: trial(KETTLE_DEFAULTS, 'chart'),
  steam: trial(KETTLE_DEFAULTS, 'steam'), body: trial(KETTLE_DEFAULTS, 'body'),
};

export const electricKettleLimits = `${elementLimits} The element is taken to pass 400 W to the water for each degree it stands above it, and only 3 W for each degree when there is no water there at all; the body is taken to lose 0.7 W for each degree the water stands above the room, and the room is taken to be wherever the water started. The steam switch is taken to open the instant the water reaches boiling, with no delay for the steam to travel, and the element's own protector to open at 220 °C; both thresholds are stated, not measured. Boiling is fixed at 100 °C, so nothing here changes with the weather or the altitude, and scale, the lid being left open and the water's own heat capacity changing with temperature are all left out.`;

export const electricKettleLesson = {
  simple: 'How does a kettle know when to stop?',
  overview: 'A kettle is a heating element with water sitting on top of it and a switch that answers to the water rather than to a clock. Water is stubborn stuff to heat: it takes more energy for each degree than almost anything else, which is why a kettle needs kilowatts where a lamp needs watts. While there is water there, the element can shed its heat as fast as it makes it and runs only a few degrees above the water. When the water finally boils, steam climbs to a small bimetal disc, the disc snaps, and the element goes off. Pour in more or less, start warmer or colder, change the supply, or switch it on empty and see what saves it.',
  steps: [
    {title: 'Put the element under the water', body: 'The element sits in the base with the water directly above it, so everything it makes goes straight into what is being heated.'},
    {title: 'Pour the energy in', body: 'The water climbs at a rate set by the power going in and by how much water there is, since every kilogram has to be carried the whole way.'},
    {title: 'Let the water hold the element down', body: 'Water carries heat off the sheath so readily that the element sits only a few degrees above the water, which is why a kettle element never glows.'},
    {title: 'Reach boiling and make steam', body: 'At boiling the water stops getting hotter and starts turning to steam instead, and the steam has one way out, past the switch.'},
    {title: 'Let the steam throw the switch', body: 'A bimetal disc in the path of that steam snaps when it arrives, the contacts open, and the element goes off without anybody watching it.'},
  ],
  parts: [
    {name: 'Body, spout and handle', role: 'Holds the water over the element and gives the steam one way out, past the switch.'},
    {name: 'The water', role: 'What is being heated, and what decides how long it takes.'},
    {name: 'Heating element', role: 'Turns the electricity into heat and hands it straight to the water.'},
    {name: 'Steam switch', role: 'Opens the circuit when steam reaches it, which is to say when the water has actually boiled.'},
    {name: 'Steam', role: 'What the water makes once it is at boiling, and the signal the switch is waiting for.'},
    {name: 'The run', role: 'The water’s temperature and the element’s from the moment it is switched on.'},
  ],
  tryIt: [
    kettleTrial.chart('Boil a kettleful', 'Press Play and watch the water.', 'At 2,217 W the water climbs steadily and reaches boiling after 164 s, having taken 356 kJ to get there.'),
    kettleTrial.water('Boil just a cupful', 'Pour in 0.2 kg of water.', 'A fifth of the water is a fifth of the energy, 71 kJ, so it boils in 33 s instead of 164 s.', {mass: 0.2}),
    kettleTrial.water('Fill it to the top', 'Pour in 1.7 kg of water.', 'Now it takes 605 kJ and 278 s, because every kilogram has to be carried the whole way whatever else you do.', {mass: 1.7}),
    kettleTrial.water('Start with warm water', 'Start the water at 40 °C.', 'There is less of the journey left, 251 kJ instead of 356 kJ, so it boils in 115 s.', {start: 40}),
    kettleTrial.element('Plug it in in America', 'Set the supply to 120 V.', 'The same element gives only 604 W at that voltage, and in the 300 s this run lasts the water gets no further than 57.1 °C.', {volts: 120}),
    kettleTrial.element('Switch it on empty', 'Choose to switch it on with no water in it.', 'With nothing to carry its heat away the element runs straight up and its own protector opens after 0.6 s, at 220 °C.', {filled: 0}),
    kettleTrial.steamSwitch('Watch the switch, not the clock', 'Press Play and look at the switch.', 'The contacts stay closed the whole way up and open at 164 s, the moment the water is actually at 100 °C, not at any time set in advance.'),
  ],
  deeper: [
    {title: 'Why a kettle needs kilowatts', body: 'The Properties of water page gives water a specific heat capacity of 4,184 J for each kilogram and each degree, and calls it the second highest of any compound of more than one element. Carrying one kilogram from 15 °C to boiling is therefore 356 kJ, and to do that in under three minutes takes better than two kilowatts. The Kettle page says exactly that: an electric kettle element is typically 2 to 3 kW, which draws up to 13 A, a serious share of what a house can supply through one socket.'},
    {title: 'Why the element never glows', body: 'Put the same wire in air and it would settle near a thousand degrees. Put it under water and it settles a few degrees above the water, because water will take heat off a surface hundreds of times faster than still air will. The element never comes near the Draper point of 525 °C, so there is nothing to see, and the only sign that anything is happening is the water itself.'},
    {title: 'What happens if the water is not there', body: 'Take the water away and the same element has nothing to give its heat to. It climbs at hundreds of degrees a second and would reach its melting point in seconds. That is why the book says the thermostat also cuts off the power if the kettle is switched on without water: a second protector, watching the element rather than the steam, opens at 220 °C in this model, 0.6 s in. Nobody could do that by hand.'},
    {title: 'Boiling is a wall, not a step', body: 'Once the water is at 100 °C it stops getting hotter. Everything more goes into turning liquid into steam, and the Properties of water page gives that as 2,257 kJ for each kilogram, over six times what it took to warm that same kilogram from 15 °C. A kettle left boiling is pouring energy into the air at full power for nothing, which is the whole reason it is worth switching itself off the instant boiling begins.'},
    {title: 'A switch that answers the water', body: 'A timer would have to guess: how much water, how warm it started, what the supply is doing. The steam switch guesses nothing. Steam only appears when the water has really boiled, so the same disc gives the right answer for a cupful and for a full kettle, from cold or from warm, at 230 V or at 120 V. It is a small, cheap piece of bimetal doing what a thermometer and a controller would otherwise have to do.'},
    {title: 'Two hundred and thirty volts, or a hundred and twenty', body: 'The Mains electricity page gives 230 V and 50 Hz in much of the world and 120 V and 60 Hz in North America, both listed in IEC 60038. Power goes with the square of the voltage, so the same element that gives 2,217 W on one supply gives 604 W on the other. That is why American kettles are rated by their own standard and why a kettle carried across the Atlantic disappoints its owner.'},
  ],
  misconception: 'A kettle does not switch off after a set time, and it is not counting anything. It is waiting for steam, which cannot arrive until the water has actually reached boiling, so it gives the right answer whatever you poured in and however warm it started.',
  limits: `The kettle is drawn at true size and cut open, with the element’s wire thickened to be visible, and the run plays 10 times faster than the real thing. ${electricKettleLimits}`,
  sources: [sources.kettle, sources.water, sources.latent, sources.joule, sources.nikrothal, sources.nichrome, sources.electricHeating, sources.mains, sources.thermalCutoff, sources.draper, sources.heatCapacities],
  quiz: {
    question: 'What actually tells an electric kettle to switch off?',
    options: [
      'Steam from water that has really boiled, reaching a bimetal switch.',
      'A timer started when the kettle was switched on.',
      'The element reaching a temperature of its own.',
    ],
    answer: 0,
    explanation: 'The switch opens at 164 s here because that is when this water boiled; with 0.2 kg in it the same switch opens at 33 s instead.',
  },
};

const dryerTrial = {
  fan: trial(DRYER_DEFAULTS, 'fan'), element: trial(DRYER_DEFAULTS, 'element'),
  cutout: trial(DRYER_DEFAULTS, 'cutout'), air: trial(DRYER_DEFAULTS, 'air'),
  chart: trial(DRYER_DEFAULTS, 'chart'), body: trial(DRYER_DEFAULTS, 'body'),
};

export const hairDryerLimits = `${elementLimits} The wire is taken to pass its heat to the air stream in proportion to the square root of the airflow, set so that it settles where a real dryer does, which is a stated rule rather than a measured one; the fan is taken to reach its speed in one second, with the element interlocked so that it is not let on until it has; and the thermal switch is taken to open at 200 °C and close again at 160 °C, both stated thresholds. The air is taken as dry, so nothing here is spent evaporating water out of hair, which is most of what a real dryer is doing, and the fan motor's own power and the pressure it has to work against are left out.`;

export const hairDryerLesson = {
  simple: 'Why does a hair dryer need a fan as much as it needs a heater?',
  overview: 'A hair dryer is a long coil of thin wire with a fan behind it, and the two cannot be separated. The wire turns electricity into heat; the air is the only thing that takes that heat anywhere. Push more air past and each kilogram is warmed less, so the stream is cooler and the wire sits cooler too. Stop the air and the wire has nowhere to send anything, climbs in seconds, and a bimetal switch opens to save it. Turn the fan up and down, change the supply, block the inlet, and press Play to switch it on.',
  steps: [
    {title: 'Start the fan first', body: 'The fan comes up to speed before the element is allowed on, so there is never heat in the barrel with no air to carry it.'},
    {title: 'Draw room air in at the back', body: 'Air is pulled in through the grille behind the fan and pushed forward along the barrel.'},
    {title: 'Take it past the element', body: 'The air crosses a long coil of bare wire, and heat passes from the wire into the air as it goes.'},
    {title: 'Share the heat among the air', body: 'The rise in temperature is the power divided by the air going past each second and its heat capacity, so more air means cooler air.'},
    {title: 'Open the switch if the air stops', body: 'A bimetal switch beside the element opens if it ever gets too hot, and closes again once it has cooled, so a blocked dryer cycles instead of burning out.'},
  ],
  parts: [
    {name: 'Barrel, handle and nozzle', role: 'Makes the air take one path, in at the back and out of the nozzle.'},
    {name: 'Fan', role: 'Moves the air that carries the element’s heat away, and without which nothing works.'},
    {name: 'Heating element', role: 'A long coil of bare wire sitting right in the airflow.'},
    {name: 'Thermal cutout', role: 'Opens if the element gets too hot and closes again once it cools.'},
    {name: 'The air', role: 'What carries the heat out of the nozzle, and what decides how hot it is.'},
    {name: 'The run', role: 'The element’s temperature and the air leaving the nozzle, from the moment it is switched on.'},
  ],
  tryIt: [
    dryerTrial.chart('Switch it on', 'Press Play and watch the run.', 'The fan comes up first, then the element: 2,000 W settles the wire at 139 °C and sends air out of the nozzle at 66 °C.'),
    dryerTrial.fan('Turn the fan down', 'Set the airflow to 20 L/s.', 'The same 2,000 W now has only 24.1 g of air a second to warm, so it leaves at 100 °C and the wire behind it sits at 177 °C.', {airflow: 20}),
    dryerTrial.fan('Turn the fan up', 'Set the airflow to 45 L/s.', 'Now 54.2 g of air a second carries the same heat, so it leaves at only 56 °C and the wire cools to 125 °C.', {airflow: 45}),
    dryerTrial.cutout('Block the inlet', 'Choose a blocked inlet.', 'With no air at all the wire runs straight up, the switch opens 1.1 s in, and as the wire cools the switch closes again at 8.0 s, ready to do it all over again.', {blocked: 1}),
    dryerTrial.element('Plug it in in America', 'Set the supply to 120 V.', 'A little over half the voltage is about a quarter of the power, 544 W, so the air leaves at 33 °C and the wire never passes 53 °C.', {volts: 120}),
    dryerTrial.air('Follow the air through', 'Press Play and watch the marks.', 'The fan moves 42.1 g of air every second, and 2,000 W spread over that much air is a rise of 47 °C above the room it came from.'),
    dryerTrial.body('Use it in a warm room', 'Set the room temperature to 30 °C.', 'Everything the element does is added on top of whatever came in, so air entering 10 degrees warmer leaves 10 degrees warmer, at 76 °C.', {room: 30}),
  ],
  deeper: [
    {title: 'A very long coil of thin wire', body: 'The Hair dryer page describes the element as a bare, coiled nichrome wire wrapped around mica insulators, chosen for its high resistivity and its refusal to corrode when heated. Thin and long is how you get resistance into a small space: this element is 3.05 m of 0.4 mm wire, which at the datasheet’s 1.09 Ω·mm²/m is 26.5 Ω, and 26.5 Ω across the mains is 2,000 W. The same page puts a dryer today at up to 2,000 W, against the 100 W the first ones managed.'},
    {title: 'Why the fan decides the temperature', body: 'The heat the air carries away is its mass each second times its heat capacity times how much it warms. The Density of air page gives dry air 1.20 kg/m³ and the heat capacity tables give it 1,012 J for each kilogram and degree, so 35 L/s is 42.1 g/s, and 2,000 W spread over that is 47 °C of rise. Halve the air and you double the rise: at 20 L/s the same element sends out air at 100 °C. Nothing about the element changed; only how many kilograms had to share its heat.'},
    {title: 'The wire has to sit above the air', body: 'Heat only moves down a temperature difference, so the wire has to run hotter than the air it is heating. It settles where what the air carries off matches what it takes: at 35 L/s that is 139 °C, and at 20 L/s it is 177 °C. A dryer run slow is hotter everywhere, not just at the nozzle, which is why the switch that protects it matters most at the low setting.'},
    {title: 'A switch that resets itself', body: 'The Thermal cutoff page separates two devices that look alike. A thermal fuse opens once and has to be replaced, like an electrical fuse. A thermal switch, often a bimetallic strip, opens hot and closes again as it cools. A dryer wants the second: block the inlet and the switch opens 1.1 s in and closes again at 8.0 s, and it will keep cycling for as long as the blockage lasts without ever needing a repair.'},
    {title: 'Hot, but not glowing', body: 'At 139 °C this element is nowhere near the Draper point of 525 °C, so there is nothing to see. Run one in the dark at its lowest fan setting and you may catch a dull red, because the Incandescence page puts the first visible glow right at that point, but a dryer that glows brightly is a dryer whose air has stopped.'},
    {title: 'What the heat is really for', body: 'Warm air does not dry hair by being warm; it dries hair by carrying water away, and that takes far more energy than warming the air did. The Latent heat page gives water 2,257 kJ for each kilogram turned to vapor at boiling. This model heats dry air and stops there, so it shows where the heat goes but not what it finally accomplishes; that is why a dryer on its cool setting still works, only slowly.'},
  ],
  misconception: 'The heater is not the part that dries anything on its own. The air is what carries heat to the hair and moisture away from it, which is why a blocked dryer stops working entirely rather than simply getting hotter, and why the fan is interlocked so the element can never run without it.',
  limits: `The dryer is drawn at true size and cut open, with the element’s wire thickened to be visible, and the run plays at life size. ${hairDryerLimits}`,
  sources: [sources.hairDryer, sources.nichrome, sources.nikrothal, sources.joule, sources.thermalCutoff, sources.airDensity, sources.heatCapacities, sources.mains, sources.draper, sources.incandescence, sources.latent],
  quiz: {
    question: 'Why does turning the fan up make the air leaving a dryer cooler?',
    options: [
      'The same heat is shared among more air each second.',
      'The element is switched to a lower power.',
      'The moving air cools the element below the room temperature.',
    ],
    answer: 0,
    explanation: 'The element gives 2,000 W either way; at 20 L/s that warms the air 82 °C and at 45 L/s only 36 °C.',
  },
};

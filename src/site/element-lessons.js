import {HEATER_DEFAULTS, KETTLE_DEFAULTS, DRYER_DEFAULTS} from './element-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  nikrothal: {title: 'Kanthal: Nikrothal 80 wire, material datasheet', url: 'https://www.kanthal.com/products/datasheets/material-datasheets/wire/resistance-heating-wire-and-resistance-wire/nikrothal-80/'},
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
  stefan: {title: 'NIST: Stefan-Boltzmann constant, CODATA 2022', url: 'https://physics.nist.gov/cuu/Constants/Table/allascii.txt'},
  resistivity: {title: 'Wikipedia: Electrical resistivity and conductivity', url: 'https://en.wikipedia.org/wiki/Electrical_resistivity_and_conductivity'},
};

/** What all three machines take without a source. */
export const elementLimits = 'Not from a source: every dimension of every element and of the case, vessel or barrel around it, chosen so that each machine comes out at the power its own page gives; a room that never warms, however long the machine runs; and still air taken to carry 15 W from each square meter of wire for each degree it stands above that room, which is a stated figure rather than a measured one. The wire is taken as one temperature all through, with no allowance for the ends being cooler, and its datasheet tables are read straight between their tabulated points.';

const heaterTrial = {
  element: trial(HEATER_DEFAULTS, 'element', 'reset'), reflector: trial(HEATER_DEFAULTS, 'reflector', 'reset'),
  beam: trial(HEATER_DEFAULTS, 'beam', 'reset'), chart: trial(HEATER_DEFAULTS, 'chart', 'reset'), guard: trial(HEATER_DEFAULTS, 'guard', 'reset'),
};

export const electricHeatingLimits = 'This is an illustrative heater and tile, not a measured appliance. The wire and room each have one temperature. Wire dimensions are chosen; electrical resistance, heat capacity and emissivity use the Nikrothal 80 datasheet. Tables are interpolated at their actual temperature knots and held constant beyond their endpoints, including specific heat above 1,100 °C and resistivity factor above 1,200 °C. Convection uses 15 W/(m²·K). Radiation treats the surrounding room as a fixed-temperature reservoir and ignores coil self-shielding, housing absorption and reflected energy returning to the wire. The reflector redirects a declared 75% of radiation forward instead of 35%; geometry does not calculate those shares. The test tile absorbs a declared 10% of forward radiation, has heat capacity 500 J/K, and loses 1.5 W/K above room temperature. Its energy is included in the emitted radiation, never added to it. Glow color and arrow paths are explanatory; arrows are not rays and their widths have a small visibility floor. No thermal expansion, local hot spots, cooling run, fuse or thermostat is simulated.';

export const electricHeatingLesson = {
  simple: 'How can current in a wire warm an object without touching it?',
  overview: 'Close the switch and current flows through a coil of resistance wire. Electrical energy increases the wire’s internal energy, so its temperature rises. The hot wire transfers energy to moving air and emits radiation. Some radiation reaches the separate test tile, making it warmer. Change the voltage or wire length, or remove the reflector, then compare the same length of heating time.',
  steps: [
    {title: 'Complete the circuit', body: 'The switch joins the supply, coil and return lead. Before it closes, the wire carries no current and draws no power.'},
    {title: 'Transfer energy to the metal', body: 'An electric field drives charge through the wire. Interactions with the metal transfer electrical energy to its internal energy, warming the wire.'},
    {title: 'Warm until heat loss catches up', body: 'At first, much of the input stays in the wire. Radiation and convection grow as it warms. Its temperature stops rising when heat leaving matches electrical input.'},
    {title: 'Heat a separate object', body: 'Radiation crosses the gap to the test tile. The tile warms as it absorbs energy, while also losing some energy to the surrounding room.'},
    {title: 'Redirect the radiation', body: 'The reflector sends a larger share forward. The tile receives more energy, even though the wire draws the same electrical power.'},
  ],
  parts: [
    {name: 'Case and feet', role: 'Supports the coil and its surrounding parts.'},
    {name: 'Supply and switch', role: 'Makes or breaks the electrical circuit through the coil.'},
    {name: 'Resistance element', role: 'Converts electrical energy to internal energy and transfers heat to its surroundings.'},
    {name: 'Reflector', role: 'Directs more of the radiation forward in this model.'},
    {name: 'Guard', role: 'Separates the exposed hot coil from the front of the heater; a real guard can also become hot.'},
    {name: 'Heat leaving the element', role: 'Shows radiation toward the tile and other surfaces, plus heat transferred to air.'},
    {name: 'Absorbing test tile', role: 'Warms without touching the coil, using energy it absorbs from radiation.'},
    {name: 'The element warming up', role: 'Records the wire temperature as this experiment runs.'},
  ],
  tryIt: [
    heaterTrial.chart('Switch it on cold', 'Press Play and watch the switch, wire and tile.', 'After 120 s, the wire is 959 °C and draws 972 W. The tile has warmed from 20 °C to 32.8 °C.'),
    heaterTrial.reflector('Take the reflector away', 'Run the heater without its reflector.', 'The wire still draws 972 W. Forward radiation falls from 649 W to 303 W, and the tile reaches 26.0 °C instead of 32.8 °C.', {reflector: 0}),
    heaterTrial.element('Wind in more wire', 'Run with 12 m of wire and compare the denser coil.', 'Cold resistance doubles to 104.1 Ω. The wire reaches 564 °C and draws 487 W; the tile reaches 25.2 °C.', {length: 12}),
    heaterTrial.element('Cut the element short', 'Run the shorter 4 m coil.', 'The wire draws 1,425 W and reaches 1,246 °C, above the datasheet’s 1,200 °C continuous operating temperature. The tile reaches 39.9 °C.', {length: 4}),
    heaterTrial.element('Lower the supply voltage', 'Run the same coil at 120 V.', 'The wire draws 266 W and reaches 585 °C. The tile reaches only 22.9 °C after the same 120 s.', {volts: 120}),
    heaterTrial.beam('Follow the heat out', 'Compare the radiation, convection and stored-energy readings.', 'At the end, 866 W leaves the wire as radiation and 106 W by convection. The wire also holds 3.22 kJ above its starting internal energy.'),
    heaterTrial.guard('Warm the room it stands in', 'Start the wire and tile in a room at 30 °C.', 'The wire reaches 960 °C. The tile starts warmer and finishes at 42.8 °C; its rise above room temperature remains close to the default run.', {room: 30}),
  ],
  deeper: [
    {title: 'Why resistance wire works', body: 'At a fixed voltage, power equals voltage squared divided by resistance. Wire resistance increases with length and decreases with cross-sectional area. This is why adding more of the same thin wire reduces the power here. A manufactured heating element must choose wire size, length and material together.'},
    {title: 'Resistance changes with temperature', body: 'The manufacturer tabulates a temperature factor for electrical resistance. This model applies that factor as the wire warms, so current and power change during the run. Voltage is an effective AC value; individual alternating-current cycles are not animated.'},
    {title: 'A hot wire stores energy', body: 'Electrical input does not all leave the wire immediately. During warm-up, some energy raises the wire’s temperature. The stored amount uses the wire’s mass and temperature-dependent specific heat. Once temperature is steady, input and outgoing heat match, but the hot wire still contains stored energy. A real wire therefore takes time to cool after power is removed.'},
    {title: 'Radiation does not require a visible glow', body: 'The wire emits thermal radiation even when it looks dark. Its emission grows strongly with absolute temperature, and a sufficiently hot wire also emits visible light. The drawn color is an illustrative temperature cue. It does not calculate a spectrum or predict when a particular observer would first see a glow.'},
    {title: 'Why the tile warms slowly', body: 'Only part of the forward radiation reaches and is absorbed by this tile. Its temperature depends on that input, its heat capacity, and its heat loss to the room. A tile can keep warming after the wire has reached an almost constant temperature. The two objects have different energy balances.'},
    {title: 'Where all the energy goes', body: 'Electrical input equals energy stored in the wire plus radiation and convection leaving it, within numerical integration accuracy. The tile receives part of that radiation. Counting its absorbed energy again as extra heater output would double-count the same transfer. A reflector redistributes energy; it does not create any.'},
  ],
  misconception: 'A reflector does not increase electrical power. In this model it changes where radiation goes, so an object in front can warm more while the wire draws the same power.',
  limits: `The 600 mm by 260 mm enclosure is illustrative. The coil’s centerline is 14 mm across and spans 460 mm; its 0.4 mm wire is drawn 2 times thicker. A run records 120 simulated seconds at 8 times normal speed. Pause freezes time, and changing a setting starts a new cold run. ${electricHeatingLimits}`,
  sources: [
    sources.nikrothal, sources.stefan,
    {title: 'OpenStax: Electrical energy and power', url: 'https://openstax.org/books/university-physics-volume-2/pages/9-5-electrical-energy-and-power'},
    {title: 'OpenStax: Mechanisms of heat transfer', url: 'https://openstax.org/books/university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer'},
    {title: 'Australian Government: Electric resistance and radiant heating', url: 'https://www.energy.gov.au/households/heating-and-cooling'},
  ],
  quiz: {
    question: 'Why does the tile become warmer with the reflector fitted?',
    options: ['More of the same radiation is directed toward it.', 'The reflector makes the wire draw more current.', 'The reflector creates extra energy.'],
    answer: 0,
    explanation: 'The declared forward share increases, so the tile absorbs more energy. The wire’s electrical power and temperature are unchanged.',
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
    dryerTrial.cutout('Block the inlet', 'Choose a blocked inlet.', 'With no air at all the wire runs straight up, the switch opens 1.1 s in, and as the wire cools the switch closes again at 7.9 s, ready to do it all over again.', {blocked: 1}),
    dryerTrial.element('Plug it in in America', 'Set the supply to 120 V.', 'A little over half the voltage is about a quarter of the power, 544 W, so the air leaves at 33 °C and the wire never passes 53 °C.', {volts: 120}),
    dryerTrial.air('Follow the air through', 'Press Play and watch the marks.', 'The fan moves 42.1 g of air every second, and 2,000 W spread over that much air is a rise of 47 °C above the room it came from.'),
    dryerTrial.body('Use it in a warm room', 'Set the room temperature to 30 °C.', 'Everything the element does is added on top of whatever came in, so air entering 10 degrees warmer leaves 10 degrees warmer, at 76 °C.', {room: 30}),
  ],
  deeper: [
    {title: 'A very long coil of thin wire', body: 'The Hair dryer page describes the element as a bare, coiled nichrome wire wrapped around mica insulators, chosen for its high resistivity and its refusal to corrode when heated. Thin and long is how you get resistance into a small space: this element is 3.05 m of 0.4 mm wire, which at the datasheet’s 1.09 Ω·mm²/m is 26.5 Ω, and 26.5 Ω across the mains is 2,000 W. The same page puts a dryer today at up to 2,000 W, against the 100 W the first ones managed.'},
    {title: 'Why the fan decides the temperature', body: 'The heat the air carries away is its mass each second times its heat capacity times how much it warms. The Density of air page gives dry air 1.20 kg/m³ and the heat capacity tables give it 1,012 J for each kilogram and degree, so 35 L/s is 42.1 g/s, and 2,000 W spread over that is 47 °C of rise. Halve the air and you double the rise: at 20 L/s the same element sends out air at 100 °C. Nothing about the element changed; only how many kilograms had to share its heat.'},
    {title: 'The wire has to sit above the air', body: 'Heat only moves down a temperature difference, so the wire has to run hotter than the air it is heating. It settles where what the air carries off matches what it takes: at 35 L/s that is 139 °C, and at 20 L/s it is 177 °C. A dryer run slow is hotter everywhere, not just at the nozzle, which is why the switch that protects it matters most at the low setting.'},
    {title: 'A switch that resets itself', body: 'The Thermal cutoff page separates two devices that look alike. A thermal fuse opens once and has to be replaced, like an electrical fuse. A thermal switch, often a bimetallic strip, opens hot and closes again as it cools. A dryer wants the second: block the inlet and the switch opens 1.1 s in and closes again at 7.9 s, and it will keep cycling for as long as the blockage lasts without ever needing a repair.'},
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

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
  water: trial(KETTLE_DEFAULTS, 'water', 'reset'), element: trial(KETTLE_DEFAULTS, 'element', 'reset'),
  steamSwitch: trial(KETTLE_DEFAULTS, 'switch', 'reset'), protector: trial(KETTLE_DEFAULTS, 'protector', 'reset'),
};

export const electricKettleLimits = 'This is an illustrative immersed-element kettle, not a measured appliance or a construction design. Its wire is 5.2 m long and 0.55 mm in diameter; the material tables use Kanthal Nikrothal 80, interpolated at their stated temperatures and held at endpoint values beyond the tables. Wire, sheath, well-mixed water and steam sensor each have one temperature. The room stays at 20 °C. Chosen values: sheath heat capacity 30 J/K; wire-to-sheath conductance 12 W/K; sheath-to-water conductance 400 W/K or sheath-to-air conductance 3 W/K when dry; vessel loss 0.7 W/K. The sensor receives at most 2.5% of the produced vapor’s latent energy after a 2 s delay, with conductance limited to 2 W/K, heat capacity 1 J/K and room loss 0.05 W/K. It opens at 85 °C; the separate dry protector opens at a sheath temperature of 220 °C. Both latch for the run. These thresholds and timings are teaching assumptions. Constant water properties are 4,186 J/(kg K), 2,256 kJ/kg latent heat and 1,000 kg/m³ density; boiling is fixed at 100 °C at one atmosphere. Level uses a 140 mm internal diameter and main-tube displacement; spout liquid and small fittings are omitted. Cutaways reveal hidden parts, and the separate tube section is straightened and enlarged five times. Vapor dots, water color and circulation arrows are explanatory, not fluid or optical calculations. Preboiling evaporation, scale, open-lid faults, altitude changes, earth wiring, backup protection and contact arcing are omitted. The on-screen empty trial is not an instruction to run a real kettle dry.';

export const electricKettleLesson = {
  simple: 'How does a kettle know when to stop?',
  overview: 'Current heats a coiled wire inside an electrically insulated metal tube. Heat crosses the tube into the water. At boiling, some vapor travels through a duct and warms a bimetal disc. The disc snaps, releases the switch, and opens the circuit. Change the water amount or starting temperature: the time changes, but the same sensing mechanism stops the kettle. A separate protector responds to an overheating element when the model is empty.',
  steps: [
    {title: 'Close the circuit', body: 'Press Play. Current flows from the supply through both sets of contacts and the resistance wire, then returns to the supply.'},
    {title: 'Heat across the insulation', body: 'The hot wire transfers energy through electrical insulation to the metal sheath. Water touches the sheath and remains outside the intended current path.'},
    {title: 'Warm the water', body: 'Heat spreads through the water. More water needs more energy for the same temperature rise. The small arrows suggest circulation; the calculation treats the water as well mixed.'},
    {title: 'Make boiling vapor', body: 'At 100 °C in this model, further net heat turns some liquid into vapor. The water can evaporate below boiling too, but only boiling vapor is displayed.'},
    {title: 'Warm the disc and open the contacts', body: 'Some vapor travels through the duct. It warms the bimetal disc until the disc snaps and opens the steam switch. This takes time after boiling begins.'},
    {title: 'Keep track of stored heat', body: 'Current stops immediately when a contact pair opens. The wire and sheath remain hot, so heat transfer and a little boiling continue before the water cools.'},
  ],
  parts: [
    {name: 'Body, spout and handle', role: 'Contains the water, provides an open spout and supports the insulated handle.'},
    {name: 'The water', role: 'Receives heat; its mass sets both the level and the energy needed to reach boiling.'},
    {name: 'Heating element', role: 'Contains the coiled resistance wire inside an insulated metal tube.'},
    {name: 'Insulation close-up', role: 'Separates the conducting wire, electrical insulation and water-facing sheath.'},
    {name: 'Steam switch', role: 'Uses a heated bimetal disc to release the contacts and interrupt current.'},
    {name: 'Dry protector', role: 'Opens a separate contact pair when the sheath becomes too hot without water.'},
    {name: 'Steam path', role: 'Guides some boiling vapor from the headspace toward the disc.'},
    {name: 'Supply and current path', role: 'Connects both switches and the wire in one series circuit.'},
    {name: 'The run', role: 'Records elapsed water, sheath and internal-wire temperatures.'},
  ],
  tryIt: [
    kettleTrial.water('Boil a kettleful', 'Start with 1.0 kg at 15 °C and press Play.', 'The water first boils near 168 s. Vapor warms the disc, which opens the contacts near 172 s. Stored heat continues moving after current stops.'),
    kettleTrial.water('Boil just a cupful', 'Use the preset 0.2 kg fill and press Play.', 'The water level drops but still covers the tube. First boiling is near 35 s. The same element and sensor still need time to heat, so the full run is not exactly one fifth as long.', {mass: 0.2}),
    kettleTrial.water('Fill it to the top', 'Use 1.7 kg and press Play.', 'The higher water level needs about 605 kJ just for the liquid’s temperature rise. First boiling is near 285 s, followed by the same steam-triggered shutoff.', {mass: 1.7}),
    kettleTrial.water('Start with warm water', 'Start the water and immersed element at 40 °C.', 'The room remains at 20 °C. The liquid needs about 251 kJ to reach boiling, which happens near 120 s.', {start: 40}),
    kettleTrial.element('Try the same element at 120 V', 'Apply 120 V to this unchanged model element.', 'Cold power falls from about 2,217 W to 604 W. After 300 s the water reaches about 56.7 °C and the steam switch has not tripped. Real appliances can use different element resistances.', {volts: 120}),
    kettleTrial.protector('Try the empty model', 'Remove the water in this on-screen experiment and press Play.', 'There is no boiling vapor. The sheath instead heats to 220 °C and the separate dry protector opens near 4.16 s. It stays open while stored heat cools.', {filled: 0}),
    kettleTrial.steamSwitch('Watch the steam switch', 'Watch the duct, disc and contacts during the standard run.', 'Boiling begins before shutoff. Vapor must travel and warm the disc; the contacts open only when the sensor reaches its threshold.'),
  ],
  deeper: [
    {title: 'Why water amount changes the time', body: 'The sensible heat needed is mass × specific heat × temperature rise. For 1.0 kg from 15 °C to 100 °C, that is 355.8 kJ. The supply also warms the element and replaces heat lost to the room, so dividing that number by cold electrical power is only an estimate of boiling time.'},
    {title: 'Two different element temperatures', body: 'Heat flows because the internal wire is hotter than the sheath, and the sheath is hotter than the water. During the standard boiling phase the model wire is near 285 °C while its sheath is near 105 °C. Electrical insulation keeps the live wire separate from the water but still allows heat to cross it.'},
    {title: 'What boiling uses energy for', body: 'At one atmosphere, boiling water stays near 100 °C while net heat converts some of it into vapor. That phase change takes about 2,256 kJ per kilogram. The model produces several grams of vapor before and shortly after shutoff; cooling does not undo the vapor already produced.'},
    {title: 'How the disc knows', body: 'Two bonded metals expand differently as they warm. In a snap-action disc, that change eventually flips the curvature and moves a release mechanism. Steam-controlled kettles guide vapor toward this temperature-sensitive part. The duct and disc introduce a delay, so first boiling and switch opening are separate events.'},
    {title: 'Why a dry kettle needs another sensor', body: 'An empty kettle produces no steam to operate the boiling control. A separate protector senses the heating assembly. In this model it opens when the sheath reaches 220 °C. Real kettles use differing sensor arrangements and backup protection; this illustration shows the two distinct sensing jobs.'},
    {title: 'Why voltage matters', body: 'For this same resistance wire at the same temperature, power is voltage squared divided by resistance. Reducing 230 V to 120 V gives about 27% of the power. This comparison holds the element fixed; it does not claim that all 120 V kettles have this model’s power rating.'},
  ],
  misconception: 'The steam switch responds to its disc heating up. It does not detect the first instant any water molecule evaporates. Vapor is produced below boiling too; the strong vapor flow during boiling supplies the shutoff signal in this illustrated design.',
  limits: `The run plays 10 times faster than real time. ${electricKettleLimits}`,
  sources: [
    {title: 'Strix: kettle control diagram, printed page 15', url: 'https://strix.com/docs/2022/ketl-aim-admission-document-08-08-17_e81e9e5e49.pdf'},
    {title: 'Kettle Solutions patent GB2374730A: bimetal controls and dry protection', url: 'https://patents.google.com/patent/GB2374730A/en'},
    {title: 'OpenStax: specific heat and calorimetry', url: 'https://openstax.org/books/university-physics-volume-2/pages/1-4-heat-transfer-specific-heat-and-calorimetry'},
    {title: 'OpenStax: phase changes', url: 'https://openstax.org/books/university-physics-volume-2/pages/1-5-phase-changes'},
    {title: 'OpenStax: electrical energy and power', url: 'https://openstax.org/books/university-physics-volume-2/pages/9-5-electrical-energy-and-power'},
    sources.nikrothal,
  ],
  quiz: {
    question: 'What opens the normal boiling switch in this model?',
    options: ['Vapor heats a bimetal disc until it snaps.', 'A fixed timer runs out.', 'The dry protector reaches its overheat threshold.'],
    answer: 0,
    explanation: 'Boiling vapor travels to the disc and warms it to its threshold. The dry protector is a separate control for an overheating sheath.',
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

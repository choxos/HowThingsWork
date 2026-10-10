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
  system: trial(DRYER_DEFAULTS, 'system', 'iso'),
  cutout: trial(DRYER_DEFAULTS, 'cutout'),
  hair: trial(DRYER_DEFAULTS, 'hair'),
};

export const hairDryerLimits = 'This is an illustrative 30-second experiment with a small test lock, not a prediction for a full head of hair. The 3.05 m wire has a calculated diameter of 0.4 mm and a drawn diameter enlarged three times. Dimensions, couplings and sensor response are assumptions, not measurements of an appliance. The fan reaches its set airflow in one second and has an independent supply; its power and control electronics are omitted. Wire-to-air conductance scales with the square root of airflow. The wire and sensor store heat separately; the illustrated cutout opens at a sensor temperature of 120 °C and resets at 90 °C. Stored heat can keep warming the sensor after opening. Contact motion is schematic; elastic curvature and snap-spring geometry are omitted. A secondary thermal fuse is omitted, so this model cannot establish safe blocked operation. The test lock starts with 0.35 g of surface water, a 4 J/K dry heat capacity and room air at 50% relative humidity. Heat and vapor transfer coefficients are declared teaching values. Latent heat is held at 2.43 MJ/kg, approximately its value near body temperature. Natural evaporation without forced flow, bound water inside hair, radiation onto hair and changing room humidity are omitted. Air density follows the ideal-gas law at one atmosphere with constant heat capacity. The outlet calculation ignores travel time and mixing after the nozzle; its brief startup temperature peak is not calibrated. Wire material tables are interpolated; the wire is treated as one temperature.';

export const hairDryerLesson = {
  simple: 'How do moving air and heat remove water from hair?',
  overview: 'A motor turns a fan behind a coil of resistance wire. The air carries heat from the coil to a small wet test lock, where liquid water evaporates. Follow the shrinking blue water markers and compare warmer air with more airflow. A separate heated bimetal sensor opens the heater circuit if it gets too hot. Press Play to start a fresh 30-second experiment.',
  steps: [
    {title: 'Close the main switch', body: 'The motor and heater branches receive power together. The fan takes one second to reach speed; the wire starts warming immediately. Heater voltage and fan airflow are independent in this schematic. The startup jet briefly gets hotter while the fan speeds up.'},
    {title: 'Send air through the barrel', body: 'The shaft turns pitched fan blades. Room air enters through the rear grille, passes the coil on its insulating supports, and leaves through the nozzle.'},
    {title: 'Transfer heat from the wire', body: 'Electrical resistance turns energy into heat. The wire warms the passing air and also loses heat to the sensor and surroundings. A faster stream shares the transferred heat among more air each second.'},
    {title: 'Evaporate surface water', body: 'The air warms the wet lock and carries vapor away. Evaporation uses energy and cools the lock. Blue water markers shrink; small departing markers represent invisible water vapor, not steam droplets.'},
    {title: 'Notice when the water is gone', body: 'Once the modeled surface water is gone, evaporation stops. The dry lock can warm closer to the air temperature. Compare the two elapsed temperature traces.'},
    {title: 'See the overheat response', body: 'In the blocked-inlet trial, the fan still turns but no air passes through. The wire and sensor heat up until the bimetal contacts open the heater branch. Never block a real dryer; follow its manual if it overheats.'},
  ],
  parts: [
    {name: 'Barrel, grip and grilles', role: 'Guide air through the appliance and support its switch.'},
    {name: 'Motor and shaft', role: 'Drive the fan independently of the heater setting.'},
    {name: 'Axial fan', role: 'Push air along the barrel with pitched rotating blades.'},
    {name: 'Mica supports', role: 'Support the bare coil while leaving passages for air.'},
    {name: 'Resistance coil', role: 'Turn electrical energy into heat and transfer some of it to the stream.'},
    {name: 'Bimetal cutout', role: 'Open the heater circuit when its own sensor becomes hot.'},
    {name: 'Switch and current paths', role: 'Show the main switch and separate motor and heater branches.'},
    {name: 'Air and heat flow', role: 'Carry heat from the wire toward the wet lock.'},
    {name: 'Wet test lock', role: 'Show remaining surface water and the result of evaporation.'},
    {name: 'Elapsed temperatures', role: 'Compare outlet air with the cooler evaporating lock, using only time already played.'},
  ],
  tryIt: [
    dryerTrial.system('Dry the test lock', 'Press Play with the default settings.', 'The nozzle settles near 65 °C. The small sample loses its surface water around 15 seconds, then warms as evaporative cooling stops.'),
    dryerTrial.system('Turn the fan down', 'Run the preset at 20 L/s.', 'Less air shares the heater output. The jet approaches 97 °C, and this sample dries sooner despite slower vapor transfer.', {airflow: 20}),
    dryerTrial.system('Turn the fan up', 'Run the preset at 45 L/s.', 'The jet approaches 55 °C. More flow increases heat and vapor transfer coefficients, but the cooler jet makes this sample dry later.', {airflow: 45}),
    dryerTrial.cutout('Block the inlet on screen', 'Press Play and watch the sensor and contacts.', 'The fan turns without through-flow. The sensor opens the heater branch; heat already stored in the wire continues warming it. Water stays on the lock. Never block a real dryer grille.', {blocked: 1}),
    dryerTrial.system('Reduce heater voltage', 'Run this same coil at an effective 120 V.', 'Heater power falls to about 0.54 kW and the jet approaches 32 °C. Some water remains after 30 seconds. This control models heater power, not plugging an appliance into another supply.', {volts: 120}),
    dryerTrial.hair('Dry with cool air', 'Run the fan with zero heater voltage.', 'Water still evaporates into the moving room air, and the wet lock cools below room temperature. Less water is removed than in the heated trial.', {volts: 0}),
    dryerTrial.system('Use warmer room air', 'Run the preset with a 30 °C room.', 'The nozzle approaches 76 °C and this sample dries sooner. The room also changes air density and ambient vapor pressure, so it is more than a fixed temperature offset.', {room: 30}),
  ],
  deeper: [
    {title: 'A long wire fits inside a short barrel', body: 'The coil wraps around crossed insulating supports. Kanthal gives this nickel chromium alloy a resistivity of 1.09 Ω·mm²/m at 20 °C. With 3.05 m of 0.4 mm wire, resistance is about 26.5 Ω and initial heater power at 230 V is about 2.00 kW. Resistance increases slightly as the wire heats, so its power changes too.'},
    {title: 'Follow heat, not just electrical power', body: 'Heat transferred to the stream equals its mass flow times its heat capacity times its temperature rise. Some electrical energy first warms the wire and sensor or goes to the surroundings. The model uses 1,004.5 J/(kg·K) for air and calculates density from room temperature. The air cannot leave this heater hotter than the wire supplying its heat.'},
    {title: 'Why airflow can change drying in two directions', body: 'More flow lowers the jet temperature for a given heater setting, while increasing transfer of heat and vapor at the wet surface. Those effects compete. In these trials, the hotter low-flow jet dries this small sample sooner. That result is specific to the declared transfer model and does not establish the fastest or safest setting for real hair.'},
    {title: 'Water does not need to boil', body: 'Evaporation occurs below the boiling point. Its rate depends here on the difference between saturation vapor pressure at the wet surface and the water-vapor pressure in the room air. Liquid becoming vapor takes latent heat. With the heater off, that energy comes from the wet lock and room air, so the lock cools as water leaves.'},
    {title: 'Temperature sensing takes time', body: 'The wire and sensor have separate heat capacities and temperatures. Opening the contacts stops new electrical heating but does not remove stored energy. The sensor can keep warming before it cools enough to reset. The US4196343A circuit includes both a heater thermostat and a separate thermal fuse; this lesson shows only the resettable switch. Follow the appliance manual after real overheating.'},
    {title: 'Two branches make the cool-air trial possible', body: 'The patent describes separate controls for the motor and heater. A manufacturer manual likewise describes airflow, temperature and cool-air controls. In this schematic, setting heater voltage to zero leaves the fan powered. Blocking the inlet removes through-flow without electrically disconnecting that motor branch.'},
  ],
  misconception: 'Hotter air alone does not determine drying speed. Evaporation needs energy and removal of vapor, and moving air affects both. Cool moving air can dry a wet surface too; the surface may cool while supplying the energy.',
  limits: hairDryerLimits,
  sources: [
    sources.nikrothal,
    {title: 'US4196343A: hair dryer construction and independent motor/heater circuit', url: 'https://patents.google.com/patent/US4196343A/en'},
    {title: 'Philips: hair dryer controls, air grilles and overheating instructions', url: 'https://www.documents.philips.com/assets/20220415/dc6cd391f25f4227ad65ae7800d3b2d2.pdf'},
    {title: 'OpenStax: electric power and energy', url: 'https://openstax.org/books/college-physics-2e/pages/20-4-electric-power-and-energy'},
    {title: 'OpenStax: humidity, evaporation and vapor pressure', url: 'https://openstax.org/books/college-physics-2e/pages/13-6-humidity-evaporation-and-boiling'},
    {title: 'OpenStax: phase change and latent heat', url: 'https://openstax.org/books/college-physics-2e/pages/14-3-phase-change-and-latent-heat'},
    {title: 'NASA: perfect-gas air constants', url: 'https://www.grc.nasa.gov/www/winddocs/user/testopts.html'},
  ],
  quiz: {
    question: 'Why can the wet lock cool below room temperature in the cool-air trial?',
    options: [
      'Evaporation takes energy from the wet lock while moving air carries vapor away.',
      'The fan refrigerates the air entering the barrel.',
      'Water can evaporate only after reaching its boiling point.',
    ],
    answer: 0,
    explanation: 'Water can evaporate below boiling. With no heater input, the required energy comes from the wet lock and its surroundings. The lock cools until heat reaching it balances evaporative cooling.',
  },
};

import {BIMETAL_DEFAULTS, ROD_DEFAULTS, WAX_DEFAULTS} from './thermostat-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  bimetallic: {title: 'Wikipedia: Bimetallic strip', url: 'https://en.wikipedia.org/wiki/Bimetallic_strip'},
  bimetal: {title: 'Wikipedia: Bimetal', url: 'https://en.wikipedia.org/wiki/Bimetal'},
  thermostat: {title: 'Wikipedia: Thermostat', url: 'https://en.wikipedia.org/wiki/Thermostat'},
  expansion: {title: 'Wikipedia: Thermal expansion', url: 'https://en.wikipedia.org/wiki/Thermal_expansion'},
  toolbox: {title: 'The Engineering ToolBox: linear thermal expansion coefficients', url: 'https://www.engineeringtoolbox.com/linear-expansion-coefficients-d_95.html'},
  modulus: {title: 'Wikipedia: Young’s modulus', url: 'https://en.wikipedia.org/wiki/Young%27s_modulus'},
  brass: {title: 'Wikipedia: Brass', url: 'https://en.wikipedia.org/wiki/Brass'},
  waxElement: {title: 'Wikipedia: Wax thermostatic element', url: 'https://en.wikipedia.org/wiki/Wax_thermostatic_element'},
  waxMotor: {title: 'Wikipedia: Wax motor', url: 'https://en.wikipedia.org/wiki/Wax_motor'},
  paraffin: {title: 'Wikipedia: Paraffin wax', url: 'https://en.wikipedia.org/wiki/Paraffin_wax'},
  radiator: {title: 'Wikipedia: Radiator (engine cooling)', url: 'https://en.wikipedia.org/wiki/Radiator_(engine_cooling)'},
  orifice: {title: 'Wikipedia: Orifice plate', url: 'https://en.wikipedia.org/wiki/Orifice_plate'},
  gasStove: {title: 'Wikipedia: Gas stove', url: 'https://en.wikipedia.org/wiki/Gas_stove'},
  oven: {title: 'Wikipedia: Oven', url: 'https://en.wikipedia.org/wiki/Oven'},
  water: {title: 'Wikipedia: Properties of water', url: 'https://en.wikipedia.org/wiki/Properties_of_water'},
  trv: {title: 'Wikipedia: Thermostatic radiator valve', url: 'https://en.wikipedia.org/wiki/Thermostatic_radiator_valve'},
};

/** What all three thermostats take without a source. */
export const thermostatLimits = 'Not from a source: every dimension of every strip, rod, tube, pellet, piston, valve and contact, chosen so that each one works over the range its own page gives; the snap action taken as a fixed overtravel at the contact rather than a modeled buckling disc; and a room, an oven and an engine each treated as one stirred volume at a single temperature, with stated heat capacities and stated losses, so none of them has a cold corner or a warm spot. Nothing here models the lag between the thing being measured and the sensor feeling it, which in a real thermostat is a large part of why it overshoots.';

// ---------------------------------------------------------------------------
// Bimetal thermostat.
// ---------------------------------------------------------------------------

const bimetalTrial = trial(BIMETAL_DEFAULTS, 'system');

export const bimetalLimits = 'The book shows a brass and iron strip opening and closing a heating circuit. The visible magnet and room calculation extend that explanation. This illustrative strip is 50 × 6 × 0.6 mm, with two equal layers, flat at 20 °C. Generic near-room expansion coefficients are 19 and 12 millionths per kelvin; representative elastic moduli are 110 and 207 GPa. These properties are not a calibrated material pair. Linear small-deflection beam theory combines thermal curvature with contact force. A fixed magnetic release load corresponds to 20 micrometers of free-tip travel; cooling recaptures the contact at zero gap. A real magnet has a force that changes with gap. The 40 m³ room has a declared effective heat capacity of 300 kJ/K and loss conductance of 55 W/K. Room and strip share one temperature, with no sensor lag, heater heat storage, cold corners, or prediction of real thermostat performance.';

export const bimetalThermostatLesson = {
  simple: 'How can two metals keep a room warm?',
  overview: 'Brass expands more than iron as it warms. Bond the two face to face and the free strip curves, with brass on the outside of the heated bend. Here that strip carries an electrical contact. When it pulls away from a fixed pad, the heater switches off. Cooling brings the contact back and switches the heater on again. A visible magnet gives the switch different opening and closing temperatures. Turn the setting screw, change the weather or heater, then watch what happens to the room.',
  steps: [
    {title: 'Bond brass to iron', body: 'The metals cannot slide apart. The lower brass layer wants to expand more than the upper iron layer, so a free warmed strip bends upward.'},
    {title: 'Close a complete circuit', body: 'Press Play to close the main switch. If the strip contact touches its pad, current has a route through the heater and back to the supply.'},
    {title: 'Let the room warm the strip', body: 'The heater supplies energy while heat also flows between the room and outdoors. The room temperature determines the strip’s free bend.'},
    {title: 'Pull free of the magnet', body: 'While the contacts touch, their force constrains the strip tip. At the opening temperature, the strip overcomes the modeled magnetic retention and opens the heater circuit.'},
    {title: 'Cool until contact returns', body: 'With the heater off and colder air outside, the room cools. At a slightly lower temperature the moving contact touches the pad again. The gap between thresholds is hysteresis.'},
    {title: 'Move the setting, observe the room', body: 'The dial moves the contact and magnet together. A higher position needs a warmer strip to open. Regulation succeeds only when the heater can warm the room through the band and the surroundings can cool it back.'},
  ],
  parts: [
    {name: 'Mounting plate and clamp', role: 'Hold the strip root fixed and support the moving carriage.'},
    {name: 'Bonded brass and iron', role: 'Convert temperature into a free bend, modified by force while the contact is held.'},
    {name: 'Moving and fixed contacts', role: 'Make or break the electrical route through the heater.'},
    {name: 'Magnetic contact retention', role: 'Hold the contact until the strip can pull free, creating a switching band.'},
    {name: 'Setting screw and dial', role: 'Move the fixed contact and magnet to change the opening temperature.'},
    {name: 'Room and thermometer', role: 'Show the useful result: the room temperature after heat input and loss.'},
    {name: 'Switched resistance heater', role: 'Supply the selected power while both switches are closed.'},
    {name: 'Main switch and heater circuit', role: 'Connect the supply, strip, contact and heater in one complete route.'},
    {name: 'Elapsed room temperature', role: 'Record the temperature and switching levels up to the current time.'},
  ],
  tryIt: [
    bimetalTrial('Warm a cool room', 'Press Play. Follow the strip, heater and room through 90 simulated minutes.', 'The heater first switches off after about 22.5 minutes. It then regulates between 19.06 and 20.00 °C. The chart draws only time already observed.'),
    bimetalTrial('Ask for 24 °C', 'Press Play with the higher setting already selected.', 'The screw has raised the contact carriage. First opening takes about 41.3 minutes. The room ends near 23.64 °C, warmer than in the default trial.', {setting: 24}),
    bimetalTrial('A cold night', 'Press Play with outdoors at −10 °C.', 'The larger temperature difference increases heat loss. The first opening now takes about 60.4 minutes, and the heater is on for about 93.6% of this whole trial, including the initial warm-up.', {outdoor: -10}),
    bimetalTrial('Too little heater power', 'Press Play with a 500 W heater.', 'The contacts stay touching. The room ends near 14.06 °C and cannot reach 20 °C, because the full-power heat balance is only about 14.09 °C.', {power: 500}),
    bimetalTrial('More power, earlier opening', 'Press Play with a 3,000 W heater.', 'The first opening comes after about 12.8 minutes. The room does not overshoot the opening temperature in this ideal model because the sensor has no lag and the heater stores no heat.', {power: 3000}),
    bimetalTrial('Start with a warm room', 'Press Play with the room already at 25 °C.', 'The thermostat contact begins open. The heater stays off while the room cools, first switching on near 19.06 °C after about 32.0 minutes.', {start: 25}),
    bimetalTrial('Can a heater make a room cooler?', 'Press Play with a 10 °C setting, 15 °C outdoors, and a room starting at 14 °C.', 'The heater remains off. Heat enters from the warmer outdoors and the room rises to about 14.63 °C. A heating-only thermostat cannot supply cooling.', {setting: 10, outdoor: 15, start: 14}),
  ],
  deeper: [
    {title: 'Why brass goes outside the warm bend', body: 'Near room temperature, the representative expansion coefficients are 19 millionths per kelvin for brass and 12 for iron. The bonded strip must accommodate that mismatch. Above the declared 20 °C flat reference, the longer brass face is outside the free curve. Below that reference, the free bend reverses. Contact forces can change either shape while the switch is held shut.'},
    {title: 'From tiny expansion to visible motion', body: 'The bimetal handbook relates curvature to the two layer thicknesses, expansion coefficients and elastic moduli. For this equal-layer strip, the free cantilever tip moves about 21.3 micrometers per kelvin. Its deflection is enlarged 100 times in the drawing, and its thickness three times. The calculated physical travel is not enlarged.'},
    {title: 'A touching contact changes the beam', body: 'The closed strip cannot pass through its pad. The calculation adds the deflection of a point-loaded cantilever to its free thermal bend, holding the tip exactly at the contact. As the room warms, the required holding force changes. At about 7.64 mN of magnetic pull in this model, the strip releases and springs to its free shape.'},
    {title: 'Where hysteresis comes from', body: 'Bare bimetal expansion alone does not create the switching band shown here. Magnetic retention delays release until the free tip would be 20 micrometers above the touching position. Cooling closes the contact at zero free gap. Those two positions correspond to temperatures about 0.938 °C apart. Real magnetic force varies with gap; this is a declared idealization.'},
    {title: 'Heat in, stored heat, heat out', body: 'The room obeys C dT/dt = P − G(T − Tout) while the heater is on, and the same equation with P = 0 while it is off. Here C is 300 kJ/K and G is 55 W/K. Each interval is solved as an exponential until the next exact switch event. Supplied heater energy equals the change stored in the room plus net outward heat transfer.'},
    {title: 'Why regulation sometimes fails', body: 'A weak heater can stay on without reaching the opening temperature. Warmer surroundings can prevent cooling through the closing temperature, even with the heater off. More heater power reduces warming time, but this no-lag model has no temperature overshoot at its opening threshold. Real sensors and heaters can store heat and respond with delay.'},
  ],
  misconception: 'This thermostat controls its heater by switching it on and off. That does not mean every thermostat or heater works only that way: real systems can also modulate power. Nor can this heating-only model cool a room below warm surroundings.',
  limits: `Deflection is drawn 100 times larger, thickness three times larger; the room and chart use separate schematic scales. The 90-minute trial plays 120 times faster. ${bimetalLimits}`,
  sources: [
    {title: 'OpenStax: thermal expansion and bimetal strips', url: 'https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion'},
    {title: 'Kanthal: Thermostatic Bimetal Handbook, curvature and loaded cantilevers', url: 'https://cdn.thomasnet.com/ccp/10021079/106138.pdf'},
    {title: 'Copper Development Association: C26000 elastic properties', url: 'https://alloys.copper.org/alloy/C26000'},
    {title: 'ARMCO Pure Iron: manufacturer property data', url: 'https://www.aksteel.nl/files/downloads/clf_productdata__armco_pure_iron_pdb_euro_final_072022_92.pdf'},
    {title: 'Honeywell patent US3171003A: magnetic retention in a thermostat', url: 'https://patents.google.com/patent/US3171003A/en'},
    {title: 'OpenStax: the first law of thermodynamics', url: 'https://openstax.org/books/college-physics-2e/pages/15-1-the-first-law-of-thermodynamics'},
  ],
  quiz: {
    question: 'What gives this model different opening and closing temperatures?',
    options: [
      'The magnet retains the touching contact until the strip can pull free; cooling closes the gap at a lower temperature.',
      'Brass naturally stops expanding between two temperatures.',
      'The heater keeps running through an open contact.',
    ],
    answer: 0,
    explanation: 'The declared magnetic retention corresponds to 20 micrometers of free-tip travel. That creates a band of about 0.938 °C. The bare strip’s thermal expansion alone would not supply this hysteresis.',
  },
};

// ---------------------------------------------------------------------------
// Rod thermostat.
// ---------------------------------------------------------------------------

const rodTrial = trial(ROD_DEFAULTS, 'system');

export const rodLimits = 'This is an illustrative direct rod and poppet mechanism, not a calibrated appliance. Tube and rod are each 200 mm at 20 °C; constant representative expansion coefficients are 19 and 12 millionths per kelvin. Thermal extensions and valve travel are enlarged 100 times. Metal stress, sensor lag and valve friction are omitted. The seat diameter is 12 mm and the bypass diameter 0.45 mm. Flow uses a fixed coefficient of 0.6 and an incompressible low-pressure approximation, without pipe losses or interaction between restrictions. Pure methane enters at 25 °C; absolute inlet pressure is 101325 Pa plus the selected gauge pressure. Its molar mass is 16.0425 g/mol and gross combustion heat is 890.35 kJ/mol; the ideal gas constant is rounded to 8.31 J/(mol K). The oven retains 45% of that gross energy, stores 12 kJ/K and loses 5 W/K to a 20 °C kitchen. These dimensions and thermal values are teaching choices. The dial is calibrated at 20 mbar with the bypass fitted. Ignition is tried once when playback starts, and any resulting flame is assumed stable while fed. Flame failure, real safety shutoff, food and uneven oven temperatures are omitted. No result is a specification or instruction for a real gas appliance.';

export const rodThermostatLesson = {
  simple: 'How can two expanding metals control the heat of a gas oven?',
  overview: 'A brass tube reaches into the oven with a steel rod joined to its far end. Both lengthen as they warm, but brass grows more. That pulls the rod’s free end away from the valve, letting a spring move the poppet toward its seat. Less gas burns, so less heat enters the oven. Cooling moves the rod back to push the valve open. Turn the dial, change supply pressure, then compare the two hot-start trials to see what the separate bypass changes.',
  steps: [
    {title: 'Begin with an oven temperature', body: 'Before playback the gas cock is shut. The tube and rod already share the chosen starting temperature, which determines whether the main valve is open or seated.'},
    {title: 'Open the cock and try ignition', body: 'Play opens the gas supply and attempts ignition once. A cool oven usually has an open main valve. A hot oven may need the separate bypass to supply gas at this instant.'},
    {title: 'Move both metals together', body: 'The tube’s far cap stays joined to the steel rod. Brass expands more, so warming pulls the free rod end away from the valve even though the steel also lengthens.'},
    {title: 'Let the spring reduce the opening', body: 'The spring moves the poppet toward its seat as the rod retreats. The shrinking annular opening reduces gas flow. Further retreat after seating leaves a visible gap between rod and adjustable stem.'},
    {title: 'Watch the oven respond', body: 'Burning gas adds heat while the oven loses heat to the kitchen. The valve can remain partly open where those rates balance. Cooling brings the rod back toward the valve; returning gas does not ignite itself.'},
  ],
  parts: [
    {name: 'Valve housing and tube support', role: 'Fixes the valve seat and the near end of the sensing tube.'},
    {name: 'Brass sensing tube', role: 'Carries the far cap away from the valve as it expands.'},
    {name: 'Steel rod and far-end joint', role: 'Expands less than the tube, so its free end retreats as the joined pair warms.'},
    {name: 'Poppet valve and closing spring', role: 'Turns rod contact or retreat into an annular gas opening or a seated valve.'},
    {name: 'Threaded setting adjustment', role: 'Changes how far the rod must retreat before the valve seats.'},
    {name: 'Separate gas bypass', role: 'Can feed the burner while the main valve is seated; it does not guarantee a flame.'},
    {name: 'Oven and thermometer', role: 'Shows the temperature produced by burner heat and heat loss.'},
    {name: 'Gas burner', role: 'Adds heat only when flowing gas is burning.'},
    {name: 'Gas cock and connected pipes', role: 'Connects the supply, valve and bypass to the burner after playback starts.'},
    {name: 'Elapsed oven temperature', role: 'Plots only the part of the temperature history already observed.'},
  ],
  tryIt: [
    rodTrial('Warm the oven', 'Press Play for the standard cold start.', 'The rod retreats, the spring reduces valve lift, and the oven reaches about 200.0 °C after 40 min. The main valve remains partly open to replace heat loss.'),
    rodTrial('Choose a cooler setting', 'Run the prepared 120 °C setting.', 'The shorter threaded adjustment seats the valve at a lower temperature. The oven ends near 120.0 °C.', {setting: 120}),
    rodTrial('Choose a hotter setting', 'Run the prepared 260 °C setting.', 'The longer adjustment needs more rod retreat. More gas initially reaches the burner, and the oven ends near 260.0 °C.', {setting: 260}),
    rodTrial('Lower the supply pressure', 'Run the prepared 10 mbar supply.', 'Less gas crosses the same opening. With the dial still at 200 °C, the oven ends near 191.9 °C because its calibration has not changed.', {supply: 10}),
    rodTrial('Raise the supply pressure', 'Run the prepared 25 mbar supply.', 'More gas crosses the same opening. The unchanged 200 °C dial now gives about 202.1 °C at the end.', {supply: 25}),
    rodTrial('Start hot with the bypass', 'Press Play with the oven at 220 °C and the dial at 120 °C.', 'The main valve starts seated, but bypass gas is available for ignition. The oven cools, the rod returns to open the main valve, and the run ends near 120.8 °C with a flame.', {setting: 120, start: 220}),
    rodTrial('Start hot without the bypass', 'Run the same hot start with no bypass in this model.', 'No gas reaches the initial ignition attempt. The valve later opens as the oven cools, but that gas stays unlit. With no burner heat the oven falls to about 93.6 °C.', {setting: 120, start: 220, bypass: 0}),
  ],
  deeper: [
    {title: 'Subtract two growing lengths', body: 'For each metal, growth is its original length times its expansion coefficient times temperature change. From 20 to 200 °C, this 200 mm brass tube grows 0.684 mm and the steel rod grows 0.432 mm. Their 0.252 mm difference moves the rod tip. That is 1.4 micrometers per degree. The scene enlarges both extensions 100 times, preserving their difference and the far-end joint.'},
    {title: 'A direct push can move a small valve', body: 'The rod can push the adjustable stem directly. Warming removes that push, allowing the spring to move the poppet toward its seat. Once seated, the poppet stops while the rod can retreat farther. The model neglects the small elastic compression from spring and gas forces. Its dimensions illustrate direct rod contact rather than a calibrated valve design.'},
    {title: 'The dial changes the geometry', body: 'A longer threaded extension requires more rod retreat before the spring can seat the poppet. The dial marks are calibrated to the heat balance at 20 mbar with the bypass fitted. The setting is therefore a calibration, not the exact temperature at which the main valve becomes completely closed. Changing pressure or removing the bypass can shift the balance.'},
    {title: 'Valve lift controls gas flow', body: 'For a small poppet lift, the opening is approximately the seat circumference times the lift. The model multiplies this area by a fixed discharge coefficient and the square root of twice pressure difference divided by gas density. Density and combustion energy per inlet volume both use the same upstream absolute pressure. Real valve flow also depends on shape, other restrictions and compressibility.'},
    {title: 'The oven balances energy', body: 'Burning gas supplies heat; the oven stores part of it and transfers heat to the cooler kitchen. The declared heat-loss rule is proportional to temperature difference. An exact exponential solution joins the periods before and after the rod touches the valve stem. There is no sensor delay here, so this result cannot establish whether a real oven overshoots or cycles.'},
    {title: 'Gas flow and flame are different states', body: 'The book’s bypass maintains a small gas supply when the main valve closes. That can sustain a flame under suitable conditions, but cannot guarantee one. In the hot-start comparison, the bypass makes gas available for the single ignition attempt. Without it, gas returns later with no flame. Real flame-failure valves use a separate flame signal to shut off gas; that protection is outside this model.'},
  ],
  misconception: 'The steel rod does not stay the same length. Both metals expand, and their difference moves the valve. A bypass supplies gas; it cannot make gas ignite itself or guarantee flame safety.',
  limits: `The run covers 40 minutes and plays 120 times faster. The oven and graph use separate schematic scales. ${rodLimits}`,
  sources: [
    {title: 'US1938187A: direct rod, tube, valve and bypass mechanism', url: 'https://patents.google.com/patent/US1938187A/en'},
    {title: 'OpenStax: linear thermal expansion and representative brass and steel values', url: 'https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion'},
    {title: 'Colorado State University: valve curtain area and discharge coefficient', url: 'https://www.engr.colostate.edu/~allan/fluids/page4/page4.html'},
    {title: 'OpenStax: Bernoulli equation and its flow assumptions', url: 'https://openstax.org/books/university-physics-volume-1/pages/14-6-bernoullis-equation'},
    {title: 'OpenStax: ideal gas law and absolute pressure', url: 'https://openstax.org/books/university-physics-volume-2/pages/2-1-molecular-model-of-an-ideal-gas'},
    {title: 'NIST Chemistry WebBook: methane molecular mass and combustion enthalpy', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C74828&Units=SI&Mask=1'},
    {title: 'OpenStax: first law of thermodynamics', url: 'https://openstax.org/books/college-physics-2e/pages/15-1-the-first-law-of-thermodynamics'},
    {title: 'Robertshaw TS11: separate thermocouple flame-failure shutoff', url: 'https://www.robertshaw.com/wp-content/uploads/2026/04/352-00324-001-Robertshaw-TS11-Series-Automatic-Safety-Valve-J-or-K-versions-Install.pdf'},
  ],
  quiz: {
    question: 'Why does warming the joined tube and rod let the spring close the valve?',
    options: ['Brass expands more than steel, pulling the free rod end away from the valve stem.', 'Steel does not expand at all, so it stays fixed in space.', 'Hot gas raises the supply pressure until the poppet closes.'],
    answer: 0,
    explanation: 'Both metals lengthen, but the brass tube grows more. Because their far ends are joined, the free rod end retreats, reducing its push on the spring-loaded valve.',
  },
};

// ---------------------------------------------------------------------------
// Wax thermostat.
// ---------------------------------------------------------------------------

const wax = {
  capsule: trial(WAX_DEFAULTS, 'capsule'), piston: trial(WAX_DEFAULTS, 'piston'),
  valve: trial(WAX_DEFAULTS, 'valve'), flow: trial(WAX_DEFAULTS, 'flow'),
  chart: trial(WAX_DEFAULTS, 'chart'),
};

export const waxLimits = `${thermostatLimits} The pellet is taken as 900 cubic millimeters of wax melting evenly between 82 and 95 °C, driving a 4 mm piston, with no hysteresis of its own beyond the thermal lag the engine already has; its page says a real element always has some, because melting and freezing do not retrace the same path. The engine is taken as one stirred volume of stated heat capacity losing heat through the radiator in proportion to how far the valve is open, so nothing here models the pump, the hoses, the heater core or the second valve many engines have.`;

export const waxThermostatLesson = {
  simple: 'How does a lump of wax keep a car engine at the right temperature?',
  overview: 'Wax is the odd one out among thermostats. A bimetal strip and a rod thermostat both work on ordinary expansion, which is small and smooth. Wax works on melting: a solid packs more tightly than a liquid, so when a wax pellet melts it takes up sharply more room, and the jump is large enough to push a piston several millimeters with no amplification at all. Seal that pellet in a brass capsule with a rod through the top and you have a motor that runs on temperature. Put it in an engine’s cooling water and it holds the engine in the narrow band where the wax is melting: shut while the engine warms, opening as it gets hot, closed again by a spring as it cools. Change the wax, the load and the weather, and press Play.',
  steps: [
    {title: 'Seal a wax pellet in a capsule', body: 'The wax is packed into a brass cup with a piston through a flexible seal at the top, and it is chosen for the temperature at which it melts.'},
    {title: 'Keep the valve shut while it is cold', body: 'Solid wax takes up no more room than it did, so nothing pushes the piston and the water goes round the engine alone, which is how it warms up quickly.'},
    {title: 'Melt, and take up more room', body: 'As the engine reaches the wax’s melting range the wax turns liquid, and a liquid needs more room than the solid it came from.'},
    {title: 'Push the piston out', body: 'The capsule cannot grow, so all that extra volume drives the piston out, and the piston opens a valve in the water on its way to the radiator.'},
    {title: 'Let the spring close it again', body: 'Melting wax can push but frozen wax cannot pull, so a return spring pushes the piston home as the engine cools and the wax sets.'},
  ],
  parts: [
    {name: 'Wax capsule', role: 'Holds the wax whose melting does all the work.'},
    {name: 'Piston and seal', role: 'Turns the extra volume of melted wax into a movement.'},
    {name: 'Valve disc', role: 'Lifts off its seat as the piston pushes, opening the way to the radiator.'},
    {name: 'Return spring', role: 'Closes the valve again as the wax freezes, because melting wax can push but frozen wax cannot pull.'},
    {name: 'Where the coolant goes', role: 'Round the engine while the valve is shut, and through the radiator once it opens.'},
    {name: 'The engine through the run', role: 'What the engine reads from the moment it is started cold.'},
  ],
  tryIt: [
    wax.chart('Start the engine cold', 'Press Play and watch the engine.', 'The valve stays shut for the first 6.8 min while the engine warms, then opens as the wax melts, and the engine settles at 90.0 °C with the valve 59% open.'),
    wax.capsule('Watch the wax, not a switch', 'Press Play and watch the capsule.', 'Nothing at all happens until the wax starts to melt, and then the piston moves steadily: this is a motor driven by melting, not a switch tripped by temperature.'),
    wax.piston('How far melting pushes it', 'Look at the piston.', 'A pellet of 900 cubic millimeters growing 12% makes enough extra room to drive a 4 mm piston 8.59 mm, which is why nothing here has to be drawn larger than it is.'),
    wax.capsule('A wax that hardly grows', 'Set the growth to 5%.', 'The piston only manages 3.58 mm, so the valve cannot open far enough: the engine is still climbing through 105.2 °C when the run ends, on its way past boiling.', {growth: 5}),
    wax.capsule('A wax that grows freely', 'Set the growth to 20%.', 'Now the piston travels 14.32 mm, the valve opens further for the same melting, and the engine settles cooler, at 87.0 °C.', {growth: 20}),
    wax.flow('Idling in the cold', 'Set the load to 4 kW.', 'The engine never reaches the melting range in the whole quarter hour: the valve stays shut throughout and it has only got to 57.7 °C by the end, with everything still going round the engine.', {load: 4}),
    wax.valve('Working hard', 'Set the load to 30 kW.', 'The valve is driven to 96% open and the engine is at 112.0 °C and still rising when the run ends, which is what a thermostat at the end of its travel looks like.', {load: 30}),
  ],
  deeper: [
    {title: 'Melting, not expanding', body: 'The Wax motor page gives the key number: during melting, wax typically expands in volume by 5 to 20 percent. That is enormous next to ordinary thermal expansion, and it happens across a narrow range of temperature rather than gradually. The Wax thermostatic element page says the same thing in the language of the part: these use a solid to liquid transition, which for waxes is accompanied by a large increase in volume, rather than the liquid to vapor transition the older bellows thermostats used.'},
    {title: 'Why a narrow wax', body: 'The Paraffin wax page gives ordinary paraffin a melting point anywhere between 46 and 68 °C, which would make a hopelessly vague thermostat. A thermostat wax is blended so that its carbon chains are all of similar length and it melts across a narrow band, and the band is chosen for the job: the Wax thermostatic element page says automotive thermostats are made to open between 70 and 90 °C, and that modern engines run over 80 °C to burn cleanly.'},
    {title: 'Volume into travel', body: 'The piston is what converts the extra volume into a useful distance, and a narrow piston converts it into a long one. This pellet growing 12 percent makes about 108 cubic millimeters of new volume, and pushed through a 4 mm rod that is 8.59 mm of travel. The same page gives real elements strokes of 1.5 to 16 mm, so that is a real size, and it is why a wax element needs no levers where a rod thermostat needs a linkage.'},
    {title: 'The spring does the closing', body: 'Melting wax pushes hard, but frozen wax cannot pull anything back. Every wax element therefore needs a bias to return it, and the Wax motor page puts that biasing force at 20 to 30 percent of the operating force, enough to overcome the friction of the seal that keeps the wax in. It is the spring, not the wax, that shuts the valve as the engine cools.'},
    {title: 'Why the engine warms up shut', body: 'The Radiator page says that while the thermostat is closed there is no flow in the radiator loop and the coolant is redirected through the engine instead. That is deliberate: a cold engine wears faster, burns richer and pollutes more, so the fastest possible warm up is worth having. Here the valve stays shut for the first 6.8 minutes, and at a light enough load it never opens at all.'},
    {title: 'Holding a band, not a point', body: 'Because the valve opens across the melting range rather than at a single temperature, the engine settles inside that range wherever the load puts it: 90.0 °C at 14 kW, 87.0 °C with a freer wax, 112.0 °C worked hard with the valve almost fully open and still climbing. Its page describes exactly this, saying such an element normally sits at about half its stroke, with room to open further or close back as conditions change.'},
  ],
  misconception: 'A wax thermostat is not a switch that opens at one temperature. It is a small motor run by melting, and because wax melts across a range rather than at a point, it opens gradually and holds the engine somewhere inside that range rather than at one fixed number.',
  limits: `Everything in the element is drawn at true size, because a wax motor moves far enough to see. The run covers 15 minutes and plays 120 times faster. ${waxLimits}`,
  sources: [sources.waxElement, sources.waxMotor, sources.paraffin, sources.thermostat, sources.radiator, sources.water, sources.trv],
  quiz: {
    question: 'Why does a wax thermostat move so much further than a bimetal strip of the same size?',
    options: [
      'Melting changes a wax’s volume far more than warming changes a metal’s length.',
      'Wax is much lighter than metal.',
      'The spring adds to the movement the wax makes.',
    ],
    answer: 0,
    explanation: 'A wax grows 5 to 20 percent on melting, which drives this piston 8.59 mm, where the bimetal strip’s tip moves 22.0 micrometers for each degree.',
  },
};

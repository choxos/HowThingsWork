import {BOILER_DEFAULTS} from './boiler-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  vogue: {title: 'Ideal: Vogue combination boiler C26, C32, C40, Installation and Servicing', url: 'https://www.freeboilermanuals.com/assets/pdf/ideal/Combi-installation.pdf'},
  tankless: {title: 'Wikipedia: Tankless water heating', url: 'https://en.wikipedia.org/wiki/Tankless_water_heating'},
  condensing: {title: 'Wikipedia: Condensing boiler', url: 'https://en.wikipedia.org/wiki/Condensing_boiler'},
  boiler: {title: 'Wikipedia: Boiler', url: 'https://en.wikipedia.org/wiki/Boiler'},
  combustion: {title: 'Wikipedia: Heat of combustion', url: 'https://en.wikipedia.org/wiki/Heat_of_combustion'},
  methane: {title: 'Wikipedia: Methane', url: 'https://en.wikipedia.org/wiki/Methane'},
  flame: {title: 'Wikipedia: Adiabatic flame temperature', url: 'https://en.wikipedia.org/wiki/Adiabatic_flame_temperature'},
  buck: {title: 'Wikipedia: Arden Buck equation', url: 'https://en.wikipedia.org/wiki/Arden_Buck_equation'},
  dewPoint: {title: 'Wikipedia: Dew point', url: 'https://en.wikipedia.org/wiki/Dew_point'},
  atmosphere: {title: 'Wikipedia: Atmosphere of Earth', url: 'https://en.wikipedia.org/wiki/Atmosphere_of_Earth'},
  airDensity: {title: 'Wikipedia: Density of air', url: 'https://en.wikipedia.org/wiki/Density_of_air'},
  water: {title: 'Wikipedia: Properties of water', url: 'https://en.wikipedia.org/wiki/Properties_of_water'},
  heatCapacities: {title: 'Wikipedia: Table of specific heat capacities', url: 'https://en.wikipedia.org/wiki/Table_of_specific_heat_capacities'},
  airFuel: {title: 'Wikipedia: Air–fuel ratio', url: 'https://en.wikipedia.org/wiki/Air%E2%80%93fuel_ratio'},
  flueGas: {title: 'Wikipedia: Flue gas', url: 'https://en.wikipedia.org/wiki/Flue_gas'},
  flow: {title: 'Wikipedia: Flow measurement', url: 'https://en.wikipedia.org/wiki/Flow_measurement'},
  flameDetector: {title: 'Wikipedia: Flame detector', url: 'https://en.wikipedia.org/wiki/Flame_detector'},
  copper: {title: 'Wikipedia: Copper tubing', url: 'https://en.wikipedia.org/wiki/Copper_tubing'},
  exchanger: {title: 'Wikipedia: Heat exchanger', url: 'https://en.wikipedia.org/wiki/Heat_exchanger'},
  carbonDioxide: {title: 'Wikipedia: Carbon dioxide', url: 'https://en.wikipedia.org/wiki/Carbon_dioxide'},
};

const whole = trial(BOILER_DEFAULTS, 'system'), burner = trial(BOILER_DEFAULTS, 'burner'), water = trial(BOILER_DEFAULTS, 'water');
const controlKnob = trial(BOILER_DEFAULTS, 'control'), valve = trial(BOILER_DEFAULTS, 'valve'), pipe = trial(BOILER_DEFAULTS, 'pipe');

/** What this boiler takes without a source. */
export const boilerLimits = 'Not from a source: the gas taken as methane, though the sheet works its gas volumes out with a calorific value higher than pure methane’s; dry air taken as nitrogen, oxygen and argon in the Atmosphere of Earth page’s proportions, with the Density of air page’s molar mass covering the rest of it; the same excess air, the one the sheet’s flue mass flow implies at full output, and the same flue temperature of 73 °C at every firing rate; the lowest firing for hot water taken as the heating table’s 3.7 kW, and the gross efficiency taken as 26.0 over 29.0 at every rate; water at 1 kg/L and 4,184 J/(kg·K); the boiler’s 0.5 L treated as one well stirred volume, with the heat the metal itself takes left out; air and gas entering at the 25 °C the heats of combustion are given at; a fan purge of 3 s and a spark of 2 s before the flame is proven, with the burner reaching its firing rate at once; a 15 mm copper pipe with a bore of 13.6 mm, its water moving as a plug and losing no heat on the way; and the boiler and the pipe standing at the mains temperature when the tap opens. The sheet’s boiler passes its heat to the tap water through a plate heat exchanger; this model heats the tap water in the flame’s own exchanger, as the book’s tankless boiler does. Nothing here works out how much steam condenses on the cooler parts of that exchanger, what the boiler does when the tap closes, or what it costs to run.';

export const gasBoilerLesson = {
  simple: 'How does a boiler heat water only while the hot tap is running?',
  overview: 'A tankless gas boiler keeps no hot water waiting. Open the hot tap and the water running through it spins a small turbine, which tells the control that someone wants hot water. The fan clears the combustion chamber, the gas valve opens, a spark lights the burner, and the flame’s gases give their heat to the water winding through the exchanger above it on their way to the flue. The control watches the temperature of the water leaving and turns the burner up or down to hold what the knob asks for. Open the tap wider, turn the knob, change the mains temperature, and move the tap farther away.',
  steps: [
    {title: 'Open the tap', body: 'Water running into the boiler spins a turbine, and the control counts its turns to know how much is flowing.'},
    {title: 'Light the burner', body: 'The fan clears the chamber, the valve lets gas to the burner, a spark lights it, and an electrode in the flame proves it is burning before the valve is allowed to stay open.'},
    {title: 'Pass the heat to the water', body: 'The hot gases climb through the exchanger, where the water runs the other way, so the water leaves at the hot end and the gases leave at the cold one.'},
    {title: 'Hold the temperature', body: 'The control compares the water leaving with what the knob asks for and modulates the burner, which can only turn down so far and can only give so much.'},
    {title: 'Send the rest up the flue', body: 'The carbon dioxide and steam the flame makes leave by the flue, carrying away the heat the water did not take.'},
  ],
  parts: [
    {name: 'Boiler casing', role: 'Holds the burner, the exchanger, the fan and the controls.'},
    {name: 'Gas burner', role: 'Burns the gas the valve lets through, harder or softer as the control asks.'},
    {name: 'Heat exchanger', role: 'Carries the water through the flame’s gases.'},
    {name: 'Fan and flue', role: 'Pulls the gases through the exchanger and out, and brings the air for the flame back in.'},
    {name: 'Gas valve and supply pipe', role: 'Lets gas to the burner only while the flame is proven.'},
    {name: 'Water pipes and flow turbine', role: 'Brings the cold water in past the turbine that senses the draw, and takes the hot water out.'},
    {name: 'Control and its knob', role: 'Decides when to fire and how hard, from the flow, the outlet temperature and your setting.'},
    {name: 'What goes up the flue', role: 'The gases the flame makes, and the temperature at which their steam would condense.'},
    {name: 'Pipe to the tap', role: 'The water standing between the boiler and the tap, which has to be pushed out first.'},
    {name: 'Temperatures through the run', role: 'What the water leaving the boiler and the water at the tap read from the moment the tap opens.'},
  ],
  tryIt: [
    whole('Run the hot tap', 'Press Play and watch the boiler and the tap.', 'The burner settles at 25.9 kW, holds the water leaving at 45.0 °C, and the tap runs hot 19 s after it opens.'),
    burner('Open it wider', 'Set the tap flow to 14 L/min and press Play.', 'The tap now asks for 34.2 kW, more than this boiler has: the burner sits at its full 26.0 kW, that heat raises the water only 26.6 °C, and the tap settles at 36.6 °C.', {flow: 14}),
    water('A trickle', 'Set the tap flow to 1.5 L/min and press Play.', 'Below the 2 L/min the sheet gives, the turbine never has the control fire, so the tap runs at the mains temperature of 10 °C.', {flow: 1.5}),
    burner('Turned down as far as it goes', 'Set the flow to 2 L/min, the setting to 35 °C and the mains to 20 °C, then press Play.', 'That asks for only 2.1 kW, less than the 3.7 kW this burner turns down to, so it fires at 3.7 kW anyway and the water leaves at 46.5 °C, 11.5 °C above the setting.', {flow: 2, set: 35, inlet: 20}),
    controlKnob('The sheet’s own check', 'Set the flow to 3 L/min and the setting to 65 °C, then press Play.', 'The burner modulates to 11.5 kW and holds 65.0 °C. The sheet has the installer check exactly this: about 64 °C with the knob at its maximum and about 3 L/min drawn off.', {flow: 3, set: 65}),
    valve('Summer water', 'Set the mains temperature to 20 °C and press Play.', 'Warmer water needs less heat for the same 45 °C, so the burner settles at 18.5 kW instead of 25.9 kW and the gas falls from 2.68 to 1.92 m³/h.', {inlet: 20}),
    pipe('A tap farther away', 'Set the pipe to the tap to 15 m and press Play.', 'That pipe holds 2.18 L of standing water, 12.3 s of it at this flow, so the tap comes up to temperature 27 s after it opens instead of 19 s.', {pipe: 15}),
  ],
  deeper: [
    {title: 'Flow and rise', body: 'Heat carried away by water is its mass each second times its heat capacity times how much it warms, and the Properties of water page gives that capacity as 4,184 J/(kg·K). The sheet rates this boiler at 10.6 L/min with a rise of 35 °C, which at 1 kg/L works out as 25.9 kW against the 26.0 kW of output it claims, half a percent apart. The Tankless water heating page puts it plainly: the wider the temperature rise, the less flow from the unit, and it gives combination boilers of 24 to 54 kW flows of 9 to 23 L/min.'},
    {title: 'Turning down', body: 'A boiler that only fires flat out would boil a trickle, so the gas valve modulates. This one runs from the heating table’s lowest 3.7 kW to 26.0 kW, a turndown of 7.0 to 1, and the sheet says it works down to 2 L/min drawn off and limits the hot water to 65 °C. Ask for less heat than its lowest firing and it cannot oblige: at 2 L/min raised to 35 °C it needs 2.1 kW and gives 3.7 kW, so the water leaves 11.5 °C too hot. A real boiler then switches off and relights, which this model does not do.'},
    {title: 'Burning methane', body: 'The Methane page gives the reaction as CH4 + 2 O2 → CO2 + 2 H2O. Two moles of oxygen come with the nitrogen and argon around them, 9.5 moles of dry air for every mole of methane, which by the Density of air page’s molar mass is 17.2 kg of air for each kilogram of gas. The sheet’s flue carries 11 g/s at full output, and since the fuel is 0.52 g/s of that, the air is 16% more than the flame needs, an air to fuel equivalence ratio of 1.16. The Adiabatic flame temperature page gives methane burning in air 1,963 °C.'},
    {title: 'Gross and net', body: 'The Heat of combustion page gives methane 55.52 MJ/kg with the water in the exhaust condensed and 50.00 MJ/kg with it left as steam, so 9.9% of the heat is locked up in steam. The sheet keeps both books the same way, working its gas rate out at 38.7 MJ/m³ gross and 34.9 MJ/m³ net, a ratio of 1.109 against methane’s 1.110. Its 29.0 kW gross at 38.7 MJ/m³ is 2.70 m³/h, and the sheet prints 2.695. Of that gross input 26.0 kW reaches the water, 89.7% of it.'},
    {title: 'When the steam condenses', body: 'Every methane molecule makes two of water, so steam is 16.5% of this flue gas by volume, a partial pressure of 16.7 kPa, and the Arden Buck equation puts its dew point at 56 °C. The sheet’s flue runs at 73 °C, above that, so in hot water mode the steam leaves as steam. Where a boiler does condense is against cool returning water: the Condensing boiler page asks for about 55 °C or below and reports 10 to 12% more heat for it, with condensate at a pH of 3 to 5. The sheet shows it in its heating table, where the same boiler gives 18.0 kW into water at 70 °C and 19.3 kW into water at 40 °C.'},
    {title: 'Waiting at the tap', body: 'Three waits add up. The fan purge and the spark take 5 s before the flame lights. The 0.5 L of water inside the boiler is replaced every 2.8 s at 10.6 L/min, and a stirred volume closes on its steady temperature by that much each time. Then the 15 mm pipe, 0.15 L for each meter, has to be pushed out: 0.73 L over 5 m, another 4.1 s. That is the start-up delay the Tankless water heating page warns about, and why a tap far from the boiler runs cold for so long.'},
  ],
  misconception: 'A combination boiler keeps no hot water waiting for you. It makes hot water only while a tap is drawing it, which is why the tap runs cold at first, why too small a draw will not light it at all, and why nothing is stored to run out.',
  limits: `The boiler is drawn at true size and cut open, everything inside it illustrative in size and place, with the pipe to the tap drawn 20 times smaller and the flue gas bar and chart not to scale. The run plays 5 times faster than the real thing. ${boilerLimits}`,
  sources: [sources.vogue, sources.tankless, sources.condensing, sources.boiler, sources.combustion, sources.methane, sources.flame, sources.buck, sources.dewPoint, sources.atmosphere, sources.airDensity, sources.water, sources.heatCapacities, sources.airFuel, sources.flueGas, sources.flow, sources.flameDetector, sources.copper, sources.exchanger, sources.carbonDioxide],
  quiz: {
    question: 'Why does the water come out cooler when the hot tap is opened all the way?',
    options: [
      'The burner is already firing as hard as it can, so the same heat is shared among more water each second.',
      'The control turns the burner down whenever more water flows.',
      'Cold water leaks into the hot pipe on the way to the tap.',
    ],
    answer: 0,
    explanation: 'At 14 L/min the tap asks for 34.2 kW; the burner can give 26.0 kW, which raises that much water only 26.6 °C, so it arrives at 36.6 °C.',
  },
};

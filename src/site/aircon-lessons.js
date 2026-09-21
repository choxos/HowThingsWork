import {AIRCON_DEFAULTS} from './aircon-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  airConditioning: {title: 'Wikipedia: Air conditioning', url: 'https://en.wikipedia.org/wiki/Air_conditioning'},
  vaporCompression: {title: 'Wikipedia: Vapor-compression refrigeration', url: 'https://en.wikipedia.org/wiki/Vapor-compression_refrigeration'},
  r410a: {title: 'Wikipedia: R-410A', url: 'https://en.wikipedia.org/wiki/R-410A'},
  psychrometrics: {title: 'Wikipedia: Psychrometrics', url: 'https://en.wikipedia.org/wiki/Psychrometrics'},
  humidity: {title: 'Wikipedia: Humidity', url: 'https://en.wikipedia.org/wiki/Humidity'},
  buck: {title: 'Wikipedia: Arden Buck equation', url: 'https://en.wikipedia.org/wiki/Arden_Buck_equation'},
  latent: {title: 'Wikipedia: Latent heat', url: 'https://en.wikipedia.org/wiki/Latent_heat'},
  clapeyron: {title: 'Wikipedia: Clausius-Clapeyron relation', url: 'https://en.wikipedia.org/wiki/Clausius%E2%80%93Clapeyron_relation'},
  cop: {title: 'Wikipedia: Coefficient of performance', url: 'https://en.wikipedia.org/wiki/Coefficient_of_performance'},
  ton: {title: 'Wikipedia: Ton of refrigeration', url: 'https://en.wikipedia.org/wiki/Ton_of_refrigeration'},
  expansionValve: {title: 'Wikipedia: Thermal expansion valve', url: 'https://en.wikipedia.org/wiki/Thermal_expansion_valve'},
  airDensity: {title: 'Wikipedia: Density of air', url: 'https://en.wikipedia.org/wiki/Density_of_air'},
  water: {title: 'Wikipedia: Properties of water', url: 'https://en.wikipedia.org/wiki/Properties_of_water'},
  heatCapacities: {title: 'Wikipedia: Table of specific heat capacities', url: 'https://en.wikipedia.org/wiki/Table_of_specific_heat_capacities'},
  dewPoint: {title: 'Wikipedia: Dew point', url: 'https://en.wikipedia.org/wiki/Dew_point'},
  heatPump: {title: 'Wikipedia: Heat pump and refrigeration cycle', url: 'https://en.wikipedia.org/wiki/Heat_pump_and_refrigeration_cycle'},
};

const room = trial(AIRCON_DEFAULTS, 'chart'), coil = trial(AIRCON_DEFAULTS, 'evaporator');
const air = trial(AIRCON_DEFAULTS, 'psychro'), fan = trial(AIRCON_DEFAULTS, 'fan');
const pump = trial(AIRCON_DEFAULTS, 'compressor'), outside = trial(AIRCON_DEFAULTS, 'condenser');

/** What this air conditioner takes without a source. */
export const airconLimits = 'Not from a source: a rotary compressor of 11 cm³ turning at 2,900 rpm with 4 percent clearance, 55 percent efficient against the ideal compression, a figure chosen so that the unit lands inside the 3.5 to 5 its page gives for most air conditioners; the refrigerant vapor taken as an ideal gas with one latent heat at every temperature and the liquid heat capacity fixed at the table’s 30 °C value; vapor leaving the cold coil 5 °C superheated and liquid leaving the hot coil at the condensing temperature, with no pressure lost in the pipes; the coil’s surface taken to sit at the temperature the refrigerant boils at, with 85 percent of the air brought to it and the rest slipping past unchanged, which can leave the mixture a shade above saturation, where the model reads it as saturated; an outdoor coil that sheds 450 W for each degree it stands above the outdoor air; a room whose air, furnishings and surfaces hold 6 times what its air alone holds, for moisture as well as heat, and which lets 60 W back in for each degree it is cooler than outdoors, with no moisture coming back in and nobody in it; the run stopped after half an hour; the refrigerant drawn going round once every 7 s of the run; and standard atmospheric pressure everywhere. Nothing here works out what happens when the thermostat switches the compressor off and on again, how the coil ices up and defrosts, what the fans themselves add to the air, or what it costs to run.';

export const airConditionerLesson = {
  simple: 'How does a machine make a room colder than the air outside it?',
  overview: 'An air conditioner does not make cold. It moves heat out of the room and dumps it outdoors, and it does that by boiling a liquid indoors and squeezing it back to a liquid outdoors. The indoor fan pulls room air across a coil the refrigerant is boiling in, so the coil is the coldest thing in the room and heat runs into it. If the coil is colder than the air’s dew point, water condenses on it too and drains away. The compressor then squeezes that vapor until it is hotter than the outdoor air, the outdoor coil sheds everything the room lost plus everything the compressor put in, and the expansion valve drops the liquid back to the cold side. Change the room, the humidity, the airflow, the weather outside and the size of the room, and press Play to cool it down.',
  steps: [
    {title: 'Pull room air across a cold coil', body: 'The indoor fan draws air in at the top of the unit, over a coil that is colder than the room, and blows it back out at the bottom.'},
    {title: 'Take the water out with the heat', body: 'Air can only hold so much water at a given temperature, so any coil below the air’s dew point takes water out of it as well as heat, and the water runs off into a pan and out through a pipe.'},
    {title: 'Boil the refrigerant to keep the coil cold', body: 'A liquid boiling at low pressure stays at its boiling temperature however much heat it swallows, so the coil holds a steady low temperature while it takes the room’s heat in.'},
    {title: 'Squeeze it hot enough to shed the heat outdoors', body: 'The compressor lifts the vapor to a pressure at which it will condense against the outdoor air, and the outdoor coil gives back everything the room lost and everything the compressor added.'},
    {title: 'Drop it back to the cold side', body: 'The expansion valve is a narrow way between the high pressure side and the low pressure side: liquid squeezing through it falls straight back to the boiling pressure of the cold coil, and part of it flashes to vapor, which is what chills the rest.'},
  ],
  parts: [
    {name: 'Indoor unit, cut open', role: 'Holds the cold coil, the fan and the drain, and sits in the room being cooled.'},
    {name: 'Cold coil', role: 'The coil the refrigerant boils in, and the coldest thing in the room.'},
    {name: 'Indoor fan', role: 'Pushes room air over the cold coil and decides how much of the coil’s work is cooling and how much is drying.'},
    {name: 'Drain pan and pipe', role: 'Catches the water that condenses on the cold coil and carries it outside.'},
    {name: 'Outdoor unit, cut open', role: 'Holds the compressor and the hot coil, and stands in the outdoor air.'},
    {name: 'Hot coil', role: 'The coil the refrigerant condenses in, giving its heat to the outdoor air.'},
    {name: 'Compressor', role: 'Lifts the vapor from the pressure it boils at indoors to the pressure it condenses at outdoors.'},
    {name: 'Expansion valve', role: 'Drops the liquid back to the low pressure side, flashing part of it to vapor and chilling the rest.'},
    {name: 'Refrigerant loop', role: 'The one closed circuit the refrigerant runs round, carrying heat from the room to the outdoor air.'},
    {name: 'What the air does crossing the coil', role: 'Where the room’s air sits, where the coil drags it, and where it leaves.'},
    {name: 'The room through the run', role: 'What the room’s temperature and relative humidity read from the moment the unit is switched on.'},
  ],
  tryIt: [
    room('Cool the room down', 'Press Play and watch the room.', 'The unit takes 3,904 W out of the room, 2,217 W of it cooling the air and 1,687 W drying it, and the room reaches the setting after 12.8 min.'),
    air('Dry air', 'Set the relative humidity to 20%.', 'Nothing condenses: the coil sits at 7.7 °C, above the air’s dew point of 3.0 °C, so all 3,159 W goes into cooling and the room arrives in 8.0 min.', {humidity: 20}),
    air('Damp air', 'Set the relative humidity to 90%.', 'Now the coil takes 4.55 kg of water an hour out of the air; 3,107 W of the 4,578 W goes into drying rather than cooling, and the room takes 21.0 min to arrive.', {humidity: 90}),
    fan('Starve it of air', 'Set the indoor airflow to 0.05 m³/s.', 'The coil falls to 2.3 °C and the air leaves at 6.1 °C, but the unit moves only 2,584 W in all, so the room takes 26.0 min.', {flow: 0.05}),
    fan('Open it up', 'Set the indoor airflow to 0.3 m³/s.', 'The coil rises to 17.6 °C, cooling takes 73% of the work instead of 57%, the water taken out falls to 1.79 kg/h, and the room arrives in 8.5 min.', {flow: 0.3}),
    pump('A hot day', 'Set the outdoor air temperature to 45 °C.', 'The hot coil now has to run at 55.7 °C to shed its heat, so the compressor takes 1,204 W instead of 949 W and the coefficient of performance falls from 4.11 to 3.01.', {outdoor: 45}),
    room('A bigger room', 'Set the room volume to 80 m³.', 'The unit works exactly as hard, 3,904 W, but twice the room holds twice the heat, so it takes 25.3 min to arrive instead of 12.8 min.', {volume: 80}),
  ],
  deeper: [
    {title: 'Two jobs, one coil', body: 'A cooling coil does two separate things at once. Sensible cooling lowers the air’s temperature: the air’s mass each second times its heat capacity times the drop. Latent cooling condenses its water: the water removed each second times the heat that water gives up turning back into liquid, which the Latent heat page’s fit puts at 2,469 J/g at this coil. At the settings this page opens on, 2,217 W of the 3,904 W is sensible and 1,687 W is latent, so 57% of the work is cooling and 43% is drying. The Air conditioning page notes that running less air over the coil raises the share that goes into drying, and warns that too little airflow can ice the coil up.'},
    {title: 'Why cold air drips', body: 'The Humidity page calls the water in air its humidity ratio, the grams of water riding with each kilogram of dry air, and the Arden Buck equation gives the most air can hold at a temperature. At 28 °C and 60% the room’s air carries 14.25 g/kg and would be full at 19.5 °C, its dew point. Anything colder than that cannot keep it, so a coil at 13.7 °C takes water out until the air leaving carries 10.46 g/kg. Cooling air without drying it raises its relative humidity, which is why air leaves this coil at 93% while the room it came from was at 60%, and why the room ends the run at 67% even though it is cooler.'},
    {title: 'Boiling on purpose', body: 'The trick of the whole machine is that a boiling liquid holds its temperature. R-410A boils at 48.5 °C below zero under one atmosphere and needs 1.383 MPa to stay liquid at 21.1 °C. Clausius and Clapeyron drawn through those two points give 2,482 K, which says the same boiling curve extrapolates to 4.88 MPa at the critical point the table gives as 4.90 MPa, and which implies a latent heat of 284 kJ/kg. Let it boil at 11.14 bar and the coil sits at 13.7 °C whatever the room throws at it.'},
    {title: 'What the compressor is really for', body: 'Heat only runs downhill, so to give the room’s heat to air that is hotter than the room, the refrigerant has to be lifted above the outdoor air first. The compressor swallows vapor at 11.14 bar and pushes it out at 26.57 bar, a pressure ratio of 2.39. It never fills completely: the vapor left behind in its clearance has to expand again before any new vapor can come in, so an 11 cm³ swept volume turning 2,900 times a minute fills 95.5% of the way and moves 16.92 g of refrigerant a second.'},
    {title: 'Where the heat goes', body: 'Nothing is destroyed on the way. Everything taken out of the room plus everything the compressor put in has to leave through the outdoor coil: 3,904 W and 949 W make 4,854 W blowing out of the outdoor unit. That coil sheds its heat only by standing above the outdoor air, so a hotter day pushes the condensing temperature up, the pressure ratio up and the work up with it: from 35 °C outdoors to 45 °C the compressor goes from 949 W to 1,204 W while the cooling it delivers falls from 3,904 W to 3,623 W.'},
    {title: 'How good can it get', body: 'The measure is the coefficient of performance, cooling over the work it takes, and this unit gives 4.11: it moves four units of heat for each unit of electricity, which no heater can do. The Coefficient of performance page gives most air conditioners 3.5 to 5, and a perfect machine working across the same 32.1 °C would reach 8.9, so this one is 46% of the best there is. Its capacity, 3,904 W, is 1.11 tons of refrigeration, a ton being exactly 12,000 BTU an hour, and the Air conditioning page puts residential systems at 1 to 5 tons.'},
  ],
  misconception: 'An air conditioner does not make cold and it does not throw the room’s heat away. It moves that heat outdoors and pays for the move, so the outdoor unit always sheds more than the room lost, and a unit left running with its window open heats the house.',
  limits: `Both units are drawn at true size and cut open, everything inside them illustrative in size and place, and the two charts are not to scale. The run plays 60 times faster than the real thing. ${airconLimits}`,
  sources: [sources.airConditioning, sources.vaporCompression, sources.r410a, sources.psychrometrics, sources.humidity, sources.buck, sources.latent, sources.clapeyron, sources.cop, sources.ton, sources.expansionValve, sources.airDensity, sources.water, sources.heatCapacities, sources.dewPoint, sources.heatPump],
  quiz: {
    question: 'Why does the outdoor unit blow out more heat than the room loses?',
    options: [
      'The work the compressor puts in has to leave through the outdoor coil as well.',
      'The outdoor coil is larger than the indoor one, so it gives out more.',
      'Some of the room’s heat is created again outdoors by the fan.',
    ],
    answer: 0,
    explanation: 'The room loses 3,904 W and the compressor adds 949 W, so 4,854 W has to leave through the outdoor coil.',
  },
};

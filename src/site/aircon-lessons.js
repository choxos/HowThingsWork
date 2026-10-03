import {AIRCON_DEFAULTS} from './aircon-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  airConditioning: {title: 'Wikipedia: Air conditioning', url: 'https://en.wikipedia.org/wiki/Air_conditioning'},
  vaporCompression: {title: 'Wikipedia: Vapor-compression refrigeration', url: 'https://en.wikipedia.org/wiki/Vapor-compression_refrigeration'},
  r410a: {title: 'Chemours: Freon 410A thermodynamic properties, SI units', url: 'https://www.chemours.com/en/-/media/files/freon/freon-410a-si-thermodynamic-properties.pdf'},
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
export const airconLimits = 'This is an illustrative split air conditioner, not a rated commercial product. The compressor has an assumed displacement of 11 cm³, speed of 2,900 rpm, clearance of 4 percent and ideal-compression efficiency of 55 percent. Compressor mass flow and work use an ideal gas with a fixed heat capacity of 840 J/(kg·K). Refrigerant saturation pressure and liquid enthalpy follow the manufacturer’s correlations; saturated-vapor enthalpy uses its table with linear interpolation every 5 °C. Vapor leaves the evaporator 5 °C above saturation, liquid leaves the condenser saturated, and piping pressure losses are omitted. The coil contacts 85 percent of the air; the rest bypasses it. Any mist formed by mixing is assumed to drain, with its latent heat warming the mixture. The outdoor coil transfers 450 W per degree above outdoor air. The room stores 6 times the heat and moisture of its air alone and gains 60 W per degree difference from outdoors. These equipment and room constants are assumptions. There are no occupants or incoming moisture. Playback stops at the thermostat setting or after 30 simulated minutes. Fan power, coil cooldown, thermostat cycling, frost growth and defrost are omitted. Below-freezing coil temperatures are flagged, not a prediction of sustained operation. Flow markers show direction rather than molecule speed.';

export const airConditionerLesson = {
  simple: 'How does a machine make a room colder than the air outside it?',
  overview: 'An air conditioner does not make cold. It moves heat out of the room and dumps it outdoors, and it does that by evaporating refrigerant indoors and condensing it outdoors at a higher pressure. The indoor fan pulls room air across a coil the refrigerant is boiling in, so the coil is colder than room air and heat runs into it. If the coil is colder than the air’s dew point, water condenses on it too and drains away. The compressor then squeezes that vapor until it is hotter than the outdoor air, the outdoor coil sheds everything the room lost plus everything the compressor put in, and the expansion valve drops the liquid back to the cold side. Change the room, the humidity, the airflow, the weather outside and the size of the room, and press Play to cool it down.',
  steps: [
    {title: 'Pull room air across a cold coil', body: 'The indoor fan draws air in at the top of the unit, over a coil that is colder than the room, and blows it back out at the bottom.'},
    {title: 'Take the water out with the heat', body: 'When humid air meets a surface below its dew point, some water vapor condenses into liquid. That water releases heat to the cold coil, then runs into a pan and out through a drain pipe.'},
    {title: 'Boil the refrigerant to keep the coil cold', body: 'Low pressure lets refrigerant boil below room temperature. While liquid and vapor coexist, incoming heat mostly changes liquid into vapor. The evaporating temperature shifts as the compressor, airflow and room conditions find a new balance.'},
    {title: 'Squeeze it hot enough to shed the heat outdoors', body: 'The compressor lifts the vapor to a pressure at which it will condense against the outdoor air, and the outdoor coil gives back everything the room lost and everything the compressor added.'},
    {title: 'Drop it back to the cold side', body: 'The expansion valve is a narrow way between the high pressure side and the low pressure side: liquid squeezing through it falls straight back to the boiling pressure of the cold coil, and part of it flashes to vapor, which is what chills the rest.'},
  ],
  parts: [
    {name: 'Indoor unit, cut open', role: 'Holds the cold coil, the fan and the drain, and sits in the room being cooled.'},
    {name: 'Cold coil', role: 'The coil where refrigerant boils and absorbs heat from room air.'},
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
    room('Cool the room down', 'Press Play. Watch the room temperature, drain and outdoor heat reading.', 'The room reaches the thermostat setting. Both heat and water leave the room, and the compressor switches off at the target.'),
    air('Dry air', 'Run the same room with relative humidity at 20%.', 'The coil is above the dew point, so no water drains. All the cooling is sensible heat, and the room reaches the setting sooner.', {humidity: 20}),
    air('Damp air', 'Run the same room with relative humidity at 90%.', 'More water drains, and latent cooling exceeds sensible cooling. The room is still above the setting when the half-hour preview ends.', {humidity: 90}),
    fan('Starve it of air', 'Reduce indoor airflow to 0.05 m³/s, then play.', 'Air leaves colder, but much less air crosses the coil. Total cooling falls and the room does not reach the setting during this preview.', {flow: 0.05}),
    fan('Open it up', 'Increase indoor airflow to 0.3 m³/s, then play.', 'Each parcel of air leaves warmer, but more air crosses the coil. Total cooling and its sensible share rise, and the room reaches the setting sooner.', {flow: 0.3}),
    pump('A hot day', 'Set outdoor air to 45 °C, then play.', 'The condenser pressure and compressor power rise. Cooling capacity and coefficient of performance fall; the room stays above the setting through the preview.', {outdoor: 45}),
    room('A bigger room', 'Double room volume to 80 m³, then play.', 'Initial cooling capacity stays the same, but twice the room stores twice the heat. It is still above the setting at the end of the half-hour preview.', {volume: 80}),
  ],
  deeper: [
    {title: 'Two jobs, one coil', body: 'Sensible cooling lowers the air temperature. Latent cooling turns water vapor into liquid without that part of the heat removal directly lowering the air temperature. The cooling reading adds both contributions. Compare dry and damp presets: a larger total cooling rate need not mean a faster temperature drop, because more of that rate can be spent condensing water.'},
    {title: 'Why cold air drips', body: 'Humidity ratio measures water vapor mass per mass of dry air. Relative humidity compares vapor pressure with saturation pressure at the same temperature. Cooling without removing water raises relative humidity, even though humidity ratio stays fixed. The dew point is where that air reaches saturation. A colder coil condenses water and lowers humidity ratio. On the chart, cooling moves left and drying moves down. The leaving state mixes air cooled by the coil with air that bypassed it; if that mixture would be supersaturated, the model condenses the excess as mist and includes the warming caused by its released latent heat. It assumes the drain captures that mist.'},
    {title: 'Boiling on purpose', body: 'The manufacturer gives R-410A a normal boiling point of −51.58 °C. At 25 °C, its bubble pressure is 1.6529 MPa absolute and its dew pressure is 1.6474 MPa absolute. The small difference comes from its blend of two refrigerants. Lowering pressure makes evaporation possible in the indoor coil; raising pressure makes condensation possible outdoors. Throttling preserves enthalpy. Some of the warm liquid flashes into vapor, leaving a cold mixture that absorbs heat in the evaporator. The model uses manufacturer phase properties, rather than treating latent heat as constant.'},
    {title: 'What the compressor is for', body: 'The compressor takes low-pressure vapor from the evaporator and delivers higher-pressure, hotter vapor to the condenser. It does not squeeze vapor directly into liquid: the condenser must then remove heat. Clearance gas expands before each fresh intake, reducing the amount pumped. This model estimates mass flow and compression work with an ideal gas and a fixed efficiency, so these readings explain trends rather than predict a specific compressor.'},
    {title: 'Where the heat goes', body: 'The outdoor heat rate equals indoor cooling plus compressor work. The condenser must be warmer than outdoor air for heat to flow out. On a hotter day, the condenser runs hotter, the pressure ratio rises, and compression costs more work. Compare the indoor cooling, compressor and outdoor heat readings at the same instant. After the thermostat is satisfied, modeled power and flow stop; the final temperature chart remains available to inspect.'},
    {title: 'How good can it get', body: 'Coefficient of performance is cooling divided by compressor work. It can exceed one because the machine transports heat instead of converting all its input into the heat removed. The displayed Carnot comparison is an ideal upper bound between the evaporating and condensing temperatures. Fan power and auxiliary losses are omitted, so the compressor-only ratio is not a whole-system or seasonal efficiency rating. Larger airflow, hotter weather and humidity change both heat transfer and the pressure lift.'},
  ],
  misconception: 'An air conditioner does not make cold and it does not throw the room’s heat away. It moves that heat outdoors and pays for the move, so the outdoor unit always sheds more than the room lost, and a portable unit with both its cold and hot outlets left inside one closed room warms that room overall.',
  limits: `Both units are cutaway 3D teaching models with representative dimensions. Internal layout is simplified and the charts have separate scales. The run plays 60 times faster than the real thing. ${airconLimits}`,
  sources: [sources.airConditioning, sources.vaporCompression, sources.r410a, sources.psychrometrics, sources.humidity, sources.buck, sources.latent, sources.clapeyron, sources.cop, sources.ton, sources.expansionValve, sources.airDensity, sources.water, sources.heatCapacities, sources.dewPoint, sources.heatPump],
  quiz: {
    question: 'Why does the outdoor unit blow out more heat than the room loses?',
    options: [
      'The work the compressor puts in has to leave through the outdoor coil as well.',
      'The outdoor coil is larger than the indoor one, so it gives out more.',
      'Some of the room’s heat is created again outdoors by the fan.',
    ],
    answer: 0,
    explanation: 'Energy conservation requires the condenser to reject indoor heat plus compressor work. Check those three rates together during playback.',
  },
};

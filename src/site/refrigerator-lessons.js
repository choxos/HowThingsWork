import {COMPRESSOR_DEFAULTS, compressorStageAngle} from './refrigerant-compressor-physics.js';
import {FRIDGE_DEFAULTS} from './refrigerator-physics.js';

const trial = (part, view) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...FRIDGE_DEFAULTS, ...values}, reset: true, part, isolate: ['charts', 'cycle-chart', 'indicator'].includes(part), cutaway: true, view});
const fridgeTrial = trial('system', 'front');
const partTrial = part => trial(part, 'front');

const fridgeLimits = 'Illustrative refrigerator: an idealized fluid with isobutane’s molar mass and normal boiling point, 375 kJ/kg latent heat at that point, ideal-gas vapor with gamma 1.1, and liquid holding 2.4 kJ/kg/K. Latent heat varies consistently with these heat capacities, and saturation pressure comes from integrating the Clausius–Clapeyron equation. A 5.03 cm³ piston compressor at 2,900 rpm with 4% clearance, 60% compression efficiency and an 80% efficient motor. Evaporator coils pass 4 W per degree and condenser coils 8 W per degree, half when dusty. A 20 kJ per degree cabinet leaking 1.76 W per degree, 0.8 more past a worn seal, and a thermostat switching 1 degree either side of its setting. Not modeled: a separate freezer, defrosting, door openings, pressure drops in the pipes, the refrigerant’s real properties beyond these approximate fits, and pressure equalization or stored heat in stopped coils. Constant heat capacities and ideal-gas vapor approximate this limited range; this is not a real-fluid property calculation or a product energy rating. Motor loss goes directly to the room in the model. The clock runs 720 times faster than real time, while the piston and flow markers move at a separate readable pace. Drawn markers and valve lifts are enlarged; phase-zone lengths are schematic rather than computed boiling fronts. Charts show the full selected trial, including future results.';

const fridgeSources = [
  {title: 'Danfoss: how a refrigerator works', url: 'https://www.danfoss.com/en-in/about-danfoss/our-businesses/cooling/the-fridge-how-it-works/'},
  {title: 'OpenStax: refrigerators and heat pumps', url: 'https://openstax.org/books/university-physics-volume-2/pages/4-3-refrigerators-and-heat-pumps'},
  {title: 'NIST Chemistry WebBook: isobutane', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C75285&Mask=37'},
];

export const refrigeratorLesson = {
  simple: 'How does a refrigerator move heat out of a cold box into a warm kitchen?',
  overview: 'Heat flows by itself only from hot to cold, yet a refrigerator sends heat from its cold cabinet into the warmer kitchen. It does it with a fluid that boils easily. Kept at low pressure inside the cabinet, the refrigerant boils far below freezing and soaks up heat. A compressor squeezes the vapor until it is hot enough to give that heat to the kitchen as it condenses in the coils at the back. The liquid then squeezes through a narrow tube back to low pressure, and the loop begins again. A thermostat switches the compressor on and off.',
  steps: [
    {title: 'Boil at low pressure', body: 'In the evaporator, the low pressure lets refrigerant boil below the cabinet temperature. Boiling takes heat, and the colder evaporator draws it from the cabinet.'},
    {title: 'Squeeze the vapor', body: 'The compressor raises the vapor’s pressure several times over. Squeezing it also heats it, well above the kitchen’s temperature.'},
    {title: 'Condense at high pressure', body: 'At the higher pressure the refrigerant condenses above the kitchen temperature. As it turns back to liquid in the coils at the back, it gives its heat, and the compressor’s work, to the kitchen.'},
    {title: 'Drop the pressure', body: 'The liquid is forced through a long, narrow capillary tube. Its pressure falls, part of it flashes to vapor, and that chills the rest ready to boil again.'},
    {title: 'Keep the leak in check', body: 'Heat leaks into the cabinet through its insulation and door seal. The thermostat starts the compressor when the cabinet warms a degree too far, and stops it a degree below.'},
  ],
  parts: [
    {name: 'Insulated cabinet', role: 'Foam walls that slow the heat leaking in.'},
    {name: 'Evaporator', role: 'Where the refrigerant boils and takes heat from the cabinet.'},
    {name: 'Refrigerant compressor', role: 'Squeezes the vapor to a pressure where it condenses above room temperature.'},
    {name: 'Condenser', role: 'Coils at the back where the refrigerant gives its heat to the room.'},
    {name: 'Capillary tube', role: 'A narrow tube that holds back the pressure and chills the liquid.'},
    {name: 'Refrigerant circuit', role: 'The sealed loop the refrigerant travels.'},
    {name: 'Heat and power arrows', role: 'Heat leaking in, taken, given out, and the power used.'},
    {name: 'Thermostat and sensor', role: 'Switches the motor off at the lower threshold and on at the upper threshold.'},
    {name: 'Door gasket', role: 'Limits heat leakage around the closed door; worn mode opens its top segment.'},
    {name: 'Inspection charts', role: 'Separate views show cabinet temperature, the running refrigerant cycle, and ideal cylinder pressure.'},
  ],
  tryIt: [
    fridgeTrial('Keep the cabinet cold', 'Play six hours at 4 °C in a 22 °C kitchen.', 'The cabinet cycles between 3 and 5 °C. Flow stops during each rest, then starts again as the cabinet warms.'),
    partTrial('evaporator')('Boil below freezing', 'Inspect the evaporator with Look inside enabled, then play.', 'Refrigerant boils below the cabinet temperature. Its tube takes heat from the cabinet while the compressor runs.'),
    partTrial('condenser')('Squeeze and condense', 'Follow the colored markers down the outside coils.', 'Hot vapor enters, a liquid-vapor mixture condenses, and liquid leaves for the capillary. Markers show order and direction, not molecular spacing.'),
    partTrial('heat-flow')('Account for every watt', 'Compare the two heat outputs with cooling and electrical input.', 'Condenser heat plus motor loss equals cabinet cooling plus electrical input. Shaft work is smaller than electrical power.'),
    fridgeTrial('A hot kitchen', 'Run the same refrigerator in a 32 °C kitchen.', 'Warmer surroundings increase heat leakage and condensing pressure. The compressor spends more time running.', {room: 32}),
    partTrial('condenser')('Dusty coils', 'Choose dusty condenser coils and play.', 'The visible dust layer halves the chosen heat-transfer conductance. Higher condensing temperature and pressure reduce cooling per electrical watt.', {coils: 1}),
    partTrial('door-seal')('A worn door seal', 'Inspect the missing gasket segment, then play.', 'More heat leaks in through the worn seal. The compressor runs longer between rests.', {seal: 1}),
    partTrial('charts')('Cool a warm cabinet', 'Start at room temperature and play the six-hour chart.', 'The temperature falls toward the target band before normal cycling begins. Gold intervals show when the compressor runs.', {start: 1}),
    partTrial('cycle-chart')('Follow the four cycle stages', 'Inspect pressure against enthalpy while the compressor runs.', 'Compression raises pressure and enthalpy; condensation removes energy; throttling drops pressure at constant enthalpy; evaporation absorbs energy.'),
    fridgeTrial('Ask for a colder cabinet', 'Lower the thermostat to 2 °C, then play.', 'The target band moves to 1–3 °C. A larger temperature difference makes heat leak in faster and increases running time.', {setting: 2}),
    fridgeTrial('When cooling cannot reach the target', 'Choose a 2 °C setting in a 32 °C kitchen, with dusty coils and a worn seal.', 'The cabinet never reaches the 1 °C switch-off threshold. The compressor runs throughout all six hours; asking to inspect switch-off reports this limit rather than inventing a rest.', {setting: 2, room: 32, coils: 1, seal: 1}),
  ],
  deeper: [
    {title: 'A pump for heat', body: 'Moving heat from cold to hot takes work, just as pumping water uphill does. Cooling COP divides heat removed by energy supplied. The electrical COP includes motor losses, so it is lower than cooling per shaft watt. The displayed ideal limit uses the evaporating and condensing temperatures in kelvins. All values change with the selected conditions.'},
    {title: 'Boiling point depends on pressure', body: 'Isobutane boils near −12 °C at ordinary air pressure. Lower pressure permits colder boiling; higher pressure allows hotter condensation. The model integrates this relation for an illustrative fluid with simplified heat capacities, so its displayed pressures are teaching estimates rather than refrigerant service data.'},
    {title: 'The thermostat', body: 'The compressor does not run all the time. It starts when the cabinet warms a degree above the setting and stops a degree below, so the cabinet swings gently while the compressor rests about two thirds of the time.'},
    {title: 'Why the kitchen gets warmer', body: 'Everything the refrigerator takes from its cabinet, plus all the electrical energy it uses, ends up in the kitchen. Leaving the door open to cool a kitchen only warms it.'},
    {title: 'Refrigerants then and now', body: 'Early refrigerators used ammonia or sulfur dioxide, which are toxic. Chlorofluorocarbons replaced them, until they were found to destroy the ozone layer. Isobutane is one refrigerant used in household appliances. This lesson uses an approximate isobutane property model; the substance and charge depend on the appliance. Refrigerant handling is outside this model.'},
  ],
  misconception: 'A refrigerator does not make cold or pump cold in. It moves heat out, and the heat it moves plus the work it uses both end up in the room.',
  limits: fridgeLimits,
  sources: fridgeSources,
  quiz: {
    question: 'You leave the refrigerator door open in a closed kitchen. What happens to the kitchen?',
    options: ['It slowly warms, because the refrigerator gives out the heat it moves plus its own work.', 'It cools, because cold air pours out.', 'Its temperature stays the same.'],
    answer: 0,
    explanation: 'With the door open the refrigerator just moves kitchen heat round in a loop, and the electrical energy it uses becomes more heat in the kitchen.',
  },
};

const compressorTrial = (title, instruction, observe, values = {}, stage, part = stage === undefined ? 'system' : 'pump') => ({title, instruction, observe, values: {...COMPRESSOR_DEFAULTS, ...values, ...(stage === undefined ? {} : {angle: compressorStageAngle(stage, values)})}, reset: true, part, isolate: part === 'indicator', cutaway: true, view: 'front'});

export const refrigerantCompressorLesson = {
  simple: 'How do two automatic valves let a piston pump vapor, and why does clearance reduce its fresh intake?',
  overview: 'Inside the sealed shell, an electric motor turns a crank. A connecting rod makes the piston slide back and forth. Pressure changes open two one-way valves in turn: one admits cool vapor, the other sends compressed vapor toward the condenser. Watch a single turn slowly, then change the pressure ratio or clearance to see how much fresh vapor enters.',
  steps: [
    {title: 'Expand gas left behind', body: 'Start at the top of the stroke. Gas trapped in the clearance is still at discharge pressure. As the piston retreats, this gas expands. Both valves remain closed until its pressure reaches the inlet pressure.'},
    {title: 'Admit fresh vapor', body: 'The blue inlet valve opens. Continued piston travel draws in vapor at suction pressure. The blue arrow marks intake; the red valve stays shut.'},
    {title: 'Compress with both valves shut', body: 'After the piston reverses, the inlet closes. The shrinking chamber raises the gas pressure. The rod keeps the piston connected to the turning crank.'},
    {title: 'Deliver through the outlet', body: 'At discharge pressure, the red outlet valve opens. Further piston travel pushes gas out. A small clearance remains at the top; both valves close as the next turn begins.'},
  ],
  parts: [
    {name: 'Sealed shell and supports', role: 'Encloses the motor and pump, with spring supports.'},
    {name: 'Electric motor and shaft', role: 'Turns the crank; rotation is slowed for inspection.'},
    {name: 'Crank and eccentric pin', role: 'An offset pin produces the piston stroke.'},
    {name: 'Connecting rod', role: 'Connects the crank pin to the piston wrist pin.'},
    {name: 'Piston and wrist pin', role: 'Changes cylinder volume without touching the head.'},
    {name: 'Cylinder and clearance space', role: 'Guides the piston and leaves room for trapped gas.'},
    {name: 'Suction reed valve and inlet', role: 'Admits fresh vapor during intake.'},
    {name: 'Discharge reed valve and outlet', role: 'Delivers vapor after compression.'},
    {name: 'Cylinder pressure-volume chart', role: 'Connects each visible stroke to pressure and volume.'},
  ],
  tryIt: [
    compressorTrial('Follow one complete turn', 'Play from 0° to 360°, then replay.', 'Re-expansion, suction, compression and discharge follow in order. Only the appropriate flow arrow appears; neither valve stays open at completion.'),
    compressorTrial('Re-expand trapped gas', 'Inspect the first part of the downstroke.', 'Volume grows and pressure falls, but both valves remain closed. Fresh intake has not begun.', {}, 0),
    compressorTrial('Open the inlet', 'Inspect the intake stage, then step forward.', 'The blue valve opens at suction pressure. The piston continues away from the head while fresh vapor enters.', {}, 1),
    compressorTrial('Squeeze with valves closed', 'Inspect the return stroke, then step forward.', 'Volume shrinks while pressure rises; both valves are closed.', {}, 2),
    compressorTrial('Open the outlet', 'Inspect the final part of the return stroke.', 'The red valve opens at discharge pressure. Hot vapor leaves, then the turn ends with both valves closed.', {}, 3),
    compressorTrial('Read the pressure-volume loop', 'Play with the cylinder chart open.', 'The dot follows the same piston motion. Curved paths have both valves closed; horizontal paths exchange vapor at fixed boundary pressure.', {}, undefined, 'indicator'),
    compressorTrial('Leave more clearance', 'Compare 8% clearance with the 4% default.', 'The head moves farther from the piston. Re-expansion occupies more of the stroke, leaving less fresh intake and less mass pumped per turn.', {clearance: 8}, 0),
    compressorTrial('Leave less clearance', 'Compare 2% clearance with the 4% default.', 'A smaller trapped volume leaves more swept volume for fresh intake. The piston still has a positive gap at the top.', {clearance: 2}, 0),
    compressorTrial('Raise discharge pressure', 'Set the condensing point to 50 °C.', 'A higher pressure ratio reduces fresh intake and raises compression work per kilogram. Watch the longer re-expansion path on the chart.', {condensing: 50}, undefined, 'indicator'),
    compressorTrial('Lower suction pressure', 'Set the evaporating point to −25 °C.', 'A colder evaporator lowers suction pressure and density. Pressure ratio rises, reducing both the intake share and the mass admitted.', {evaporating: -25}, 1),
    compressorTrial('Combine high ratio and clearance', 'Use −25 °C evaporation, 50 °C condensation and 8% clearance.', 'Fresh intake falls below half the swept volume. Gas still occupies the cylinder throughout; much of it is leftover gas expanding again.', {evaporating: -25, condensing: 50, clearance: 8}, undefined, 'indicator'),
  ],
  deeper: [
    {title: 'Swept volume and clearance', body: 'For the chosen bore D = 20 mm and stroke L = 16 mm, swept volume is πD²L/4 = 5.03 cm³. Clearance is the remaining chamber volume at the top. It is additional to swept volume, not an unfilled pocket.'},
    {title: 'Fresh intake from the pressure ratio', body: 'Let c be clearance divided by swept volume and r be discharge pressure divided by suction pressure. With PV^γ constant during expansion, trapped gas grows from cVs to cVs r^(1/γ). Fresh intake is therefore Vs[1 + c − c r^(1/γ)]. Here γ = 1.1. Pressures must be absolute, not gauge pressures.'},
    {title: 'Work from the loop', body: 'Integrating pressure over the changing volume gives ideal indicated work per turn. Compression and re-expansion recover different amounts; their net loop area is positive work input. The displayed shaft and electrical powers separately include chosen 60% compression and 80% motor efficiencies.'},
    {title: 'Two time scales', body: 'The model assumes steady operation at 2,900 rpm for average flow and power. One displayed turn takes eight seconds. Pausing the drawing freezes inspection; it does not simulate shutting off the refrigerator or equalizing its pressures.'},
  ],
  misconception: 'The cylinder does not stay partly empty. Residual vapor occupies the clearance and expands before fresh vapor can enter. Fresh intake is smaller than the swept volume.',
  limits: 'Illustrative reciprocating compressor, not a replica or service calculation. The 20 mm bore, 16 mm stroke, 30 mm rod and adjustable 2–8% clearance are chosen. Coil temperatures impose constant suction and discharge pressures using the refrigerator lesson’s idealized fluid: isobutane molar mass and normal boiling point, constant heat capacities and γ = 1.1. Ideal valves have no leakage or pressure drop; their prescribed lift is enlarged. The pressure-volume loop uses reversible adiabatic compression and expansion. Separate 60% compression and 80% motor efficiencies estimate average power and outlet temperature. Motor windings and supports are schematic; electromagnetic forces, valve dynamics, oil, mufflers, startup, wear and thermostat cycling are not simulated. Motion is slowed independently of the chosen operating speed.',
  sources: [
    {title: 'Secop: hermetic compressor components', url: 'https://www.secop.com/products/hermetic-compressors-basics'},
    {title: 'Copeland: refrigeration system components, compressor operation and clearance', url: 'https://webapps.copeland.com/online-product-information/Publication/LaunchPDF?Index=aem&PDF=ae102.pdf'},
    ...fridgeSources,
  ],
  quiz: {
    question: 'Why does fresh vapor wait before entering at the start of the downstroke?',
    options: ['Trapped gas must expand until cylinder pressure falls to suction pressure.', 'The motor has not started turning.', 'The cylinder is empty and needs time to fill.'],
    answer: 0,
    explanation: 'Gas left in the clearance starts at discharge pressure. Its expansion uses part of the stroke before the inlet can admit fresh vapor.',
  },
};

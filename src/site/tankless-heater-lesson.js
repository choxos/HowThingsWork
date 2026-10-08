import {HEATER_DEFAULTS} from './tankless-heater-physics.js';

const trial=(title,instruction,observe,settings={})=>({title,instruction,observe,
  values:{...HEATER_DEFAULTS,...settings},reset:true,initialState:{settings:{...HEATER_DEFAULTS,...settings}},
  part:'system',isolate:true,view:'front'});

export const tanklessHeaterLesson={
  simple:'How does a tankless gas heater deliver hot water only when a tap draws it?',
  overview:'Press Play to open the tap and follow three separate paths: water through the coil, fuel through the gas valve, and combustion air through the fan and flue. The flame heats the water, but hot water takes time to travel down the outlet pipe. This model prioritizes the chosen temperature: it turns the burner up as demand grows, then restricts water flow if maximum heat output is reached. The tap closes at the end and the fan briefly runs on.',
  steps:[
    {title:'Detect water demand',body:'Opening the tap draws water through the inlet and turns the flow turbine. The controller detects that flow. A closed tap creates no demand; a very small trickle can remain below the ignition threshold.'},
    {title:'Start air flow, then ignition',body:'The fan clears the combustion path before ignition. The spark starts the flame as the gas valve admits fuel to the burner. A flame sensor reports combustion to the controller. The startup timing shown here is illustrative.'},
    {title:'Keep water and combustion gases separate',body:'Hot gases rise around the water tube. Heat crosses its metal wall into the flowing water. The water stays liquid inside the tube; it does not mix with the flame or exhaust. Look inside removes selected walls so the route remains visible.'},
    {title:'Match heating to the required rise',body:'The required heat rate increases with water flow and with the difference between inlet and desired temperature. The ideal controller modulates the gas supply. If the 24 kW water-heating limit is reached, it restricts the water flow to preserve the chosen temperature.'},
    {title:'Displace the water in the outlet pipe',body:'The tap first delivers water already in the pipe. Warmer water arrives later, followed by steady hot water. A longer pipe holds more water and increases this delay. Blue and orange colors track the local temperatures along the continuous tube.'},
    {title:'Stop heating when demand ends',body:'At the end of the demonstration the tap closes, water stops and the gas valve shuts. The flame goes out. The fan continues briefly to clear the combustion path, then stops. The last delivered temperature remains visible for comparison.'},
  ],
  parts:[
    {name:'Casing and removable cover',role:'Encloses the heater; Look inside reveals its connected paths.'},
    {name:'Flow sensor and water valve',role:'Detect water demand and restrict flow when heat capacity is reached.'},
    {name:'Water tube and heat exchanger',role:'Transfer heat from combustion gases through the metal wall into the separate water flow.'},
    {name:'Fuel valve and gas supply',role:'Admit and modulate fuel while the burner is firing.'},
    {name:'Burner, spark and flame sensor',role:'Start combustion, release heat and detect the flame.'},
    {name:'Combustion-air fan',role:'Supply combustion air and clear the gas path before and after firing.'},
    {name:'Combustion chamber and flue',role:'Guide gases around the water tube and out of the heater.'},
    {name:'Temperature control',role:'Relate flow and temperature demand to fuel supply and water restriction.'},
    {name:'Outlet pipe to the tap',role:'Carry water to the tap while adding transport delay.'},
    {name:'Tap and delivered water',role:'Show the arriving temperature and actual flow, with a draining sink.'},
  ],
  tryIt:[
    trial('Follow a complete hot-water cycle','Press Play with an 8 L/min request, a 45 °C setting, 10 °C inlet water and a 5 m outlet pipe.','The burner transfers 19.53 kW to water. The tap reaches 45 °C after 12.0 model seconds, then closes after steady delivery. The fan is the last moving part to stop.'),
    trial('Keep the tap closed','Press Play with Tap demand set to Closed.','No water flows, so the flow sensor, gas valve, burner and fan remain inactive.',{flow:0}),
    trial('Open only a trickle','Press Play with the 1 L/min trickle.','Cool water flows through the complete route, but it does not activate the burner. The water stays at 10 °C.',{flow:1}),
    trial('Ask for more water','Press Play with a 12 L/min request and the same 45 °C setting.','The burner reaches 24 kW. The ideal water valve limits delivery to 9.83 L/min so the water can still reach 45 °C.',{flow:12}),
    trial('Choose hotter water','Press Play with an 8 L/min request and a 55 °C setting.','The required temperature rise is larger. Full heat output supplies 7.64 L/min at 55 °C, below the requested flow.',{set:55}),
    trial('Try cold winter inlet water','Press Play with a 12 L/min request and inlet water at 5 °C. Compare with Ask for more water.','At the same 24 kW limit and 45 °C setting, colder inlet water reduces delivery from 9.83 to 8.60 L/min.',{flow:12,inlet:5}),
    trial('Use less heat','Press Play with 4 L/min, a 35 °C setting, 20 °C inlet water and a short outlet pipe.','Only 4.19 kW is needed. The smaller flame supplies all 4 L/min at 35 °C, with no forced overheating.',{flow:4,set:35,inlet:20,pipe:2}),
    trial('Use a short outlet pipe','Press Play with a 2 m pipe and the usual 8 L/min request.','The tap reaches 45 °C after 8.6 model seconds. It has less cool pipe water to clear.',{pipe:2}),
    trial('Use a long outlet pipe','Press Play with a 10 m pipe and the same 8 L/min request. Compare with Use a short outlet pipe.','The tap reaches 45 °C after 17.8 model seconds. Burner power and steady flow are unchanged; more water is delivered before it becomes fully hot.',{pipe:10}),
  ],
  deeper:[
    {title:'Flow times temperature rise',body:'Heating 1 kg of water by 1 °C takes about 4.186 kJ in this model. At 8 L/min and a 35 °C rise, water carries 19.53 kW once conditions settle. Doubling flow or temperature rise doubles the required heat rate. The illustrative 24 kW limit cannot supply every requested combination.'},
    {title:'A chosen control strategy',body:'This demonstration uses an ideal temperature-priority controller. At maximum heat output it reduces water flow enough to hold the chosen temperature. Real heaters differ in sensing, minimum firing rate, flow control and temperature behavior. The model is not a performance prediction for a particular product.'},
    {title:'Why hot water is not instant',body:'There is no large storage tank, but there is still water inside the coil and outlet pipe. The coil must warm while water moves through it. Each portion of heated water then needs one pipe-transit time to reach the tap. A pipe holds more water when it is longer or wider.'},
    {title:'Where the energy goes during startup',body:'Heat entering the water does not all reach the tap immediately. Some increases the internal energy of water still in the coil and pipe. The model balances those stored amounts with energy delivered at the tap. It assigns 80% of fuel energy to water heating and the remaining 20% to exhaust and surroundings as an illustrative constant split.'},
    {title:'Combustion and the separate flue',body:'Fuel combines with oxygen and releases energy. Complete combustion of methane forms carbon dioxide and water vapor; the exhaust also includes gases carried in with the air. Those products leave through the flue. Domestic hot water comes from the water supply and remains inside its own tube.'},
    {title:'Heated liquid water',body:'This tankless arrangement delivers heated liquid water at a tap. The model does not boil that water, store steam, heat radiators or include the separate primary circuit of a combination boiler.'},
  ],
  misconception:'A tankless heater does not keep a large store of hot water ready, and “on demand” does not mean instant arrival. Heating takes energy and water already in the pipe must move out first.',
  limits:'A schematic direct gas water heater with an ideal temperature-priority controller, not a manufacturer simulation or operating guide. The 24 kW water-heating capacity, 80% energy split, 1.5 L/min activation threshold, 0.5 L coil, 14 mm pipe bore and startup/shutdown timings are illustrative. Active flow choices avoid below-minimum firing cases; burner cycling and real minimum-fire behavior are not predicted. Water density is fixed at 1 kg/L and heat capacity at 4186 J/(kg·K). The coil uses plug flow with uniform heat input per water volume; the outlet pipe adds transport delay. Metal thermal mass, pipe heat loss, axial mixing, pressure drop, flow inertia, detailed control transients, condensation and exhaust chemistry are omitted. No flame or exhaust temperature is calculated. Internals are enlarged and outlet-pipe length compressed. Colors, route markers, valve displacement and fan speed explain state rather than reproduce material appearance, particles or calibrated motion. The tap closes after six model seconds of steady hot delivery; the fan then runs for two more model seconds. Retained water stays at its closing temperature because cooling is omitted. Playback runs at twice model time. Changing a control prepares a fresh cold start; inspection preserves the current state.',
  sources:[
    {title:'Rinnai: demand heating, flame modulation and shutdown',url:'https://www.rinnai.us/tankless-101'},
    {title:'Rinnai RE model documentation: non-condensing components, flow servo, ignition and sensing',url:'https://www.rinnai.us/residential/product-detail/re140in'},
    {title:'Rinnai FAQ: minimum flow, pipe delay, fan run-on and temperature rise',url:'https://www.rinnai.us/residential/faq'},
    {title:'OpenStax: heat transfer, water heat capacity and Q = mcΔT',url:'https://openstax.org/books/university-physics-volume-2/pages/1-4-heat-transfer-specific-heat-and-calorimetry'},
  ],
  quiz:{question:'The heater is already at its maximum heat output. In this temperature-priority model, what happens when inlet water becomes colder?',options:['Delivered flow falls so each liter can still reach the chosen temperature.','Fuel supplies unlimited extra heat without changing anything.','The water mixes with hotter exhaust gas.'],answer:0,explanation:'Colder inlet water needs more energy per liter. At fixed maximum heat output, the ideal control reduces water flow to supply that larger temperature rise.'},
};

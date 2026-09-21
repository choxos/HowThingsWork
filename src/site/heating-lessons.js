import {gasBoilerLesson} from './boiler-lessons.js';
import {airConditionerLesson} from './aircon-lessons.js';
import {electricHeatingLesson, electricKettleLesson, hairDryerLesson} from './element-lessons.js';
import {bimetalThermostatLesson, rodThermostatLesson, waxThermostatLesson} from './thermostat-lessons.js';
const steps=rows=>rows.map(([title,body])=>({title,body})),parts=rows=>rows.map(([name,role])=>({name,role}));
const exp=(title,instruction,observe,values)=>({title,instruction,observe,values});
const quiz=(question,options,answer,explanation)=>({question,options,answer,explanation});
const electrical={
 simple:'Current passing through resistance wire transfers electrical energy into heat.',
 overview:'A resistance element converts electrical power to thermal energy. In the constant-resistance approximation, current is voltage divided by resistance and power is V²/R. The red element glow and outward energy markers respond to that calculated power.',
 steps:steps([['Apply voltage','A complete circuit lets charge flow through the element.'],['Dissipate electrical power','The element transfers electrical energy into thermal energy.'],['Transfer heat outward','Radiation and convection carry energy from the hot element to its surroundings.']]),
 parts:parts([['Resistance wire','Dissipates electrical power.'],['Support','Keeps the hot element in position.'],['Reflector or housing','Shapes the heat-transfer environment.'],['Control','Switches or regulates the supplied power.']]),
 tryIt:[exp('Heat the element','Use 120 V across 60 Ω.','Current is 2 A and element power is 240 W.',{voltage:120,resistance:60}),exp('Increase resistance at fixed voltage','Keep 120 V and use 120 Ω.','Current and power halve; the element glow decreases.',{voltage:120,resistance:120}),exp('Increase voltage','Use 240 V across 120 Ω.','Current becomes 2 A and power rises to 480 W.',{voltage:240,resistance:120})],
 deeper:[{title:'Electric radiant heater',body:'A hot element emits thermal radiation toward nearby surfaces. A reflector can direct more of it toward the intended area. Air also receives heat by convection. These are energy-transfer mechanisms, not a flow of a material called heat.'},{title:'Constant resistance is an approximation',body:'Many metal elements change resistance as they warm. The simple formula isolates the electrical relationship while holding resistance fixed. A full warm-up model would couple electrical resistance to temperature and heat loss.'}],
 misconception:'At fixed voltage, increasing the element’s resistance decreases its power. At fixed current, the relationship would be different.',limits:'The element has constant resistance and its glow encodes power. Wire temperature, warm-up time, heat distribution, and real mains wiring are not modeled.',sources:[{title:'OpenStax: electric power',url:'https://openstax.org/books/college-physics-2e/pages/20-4-electric-power-and-energy'}],quiz:quiz('At fixed resistance, doubling voltage makes electrical power…',['Four times as large.','Twice as large.','Half as large.'],0,'P = V²/R, so doubling voltage multiplies power by four.')};

export const heatingLessons={
 'Gas boiler':gasBoilerLesson,
 'Electric heating':electricHeatingLesson,
 'Electric kettle':electricKettleLesson,
 'Hair dryer':hairDryerLesson,
 'Air conditioner':airConditionerLesson,
 'Bimetal thermostat':bimetalThermostatLesson,
 'Rod thermostat':rodThermostatLesson,
 'Wax thermostat':waxThermostatLesson,
};

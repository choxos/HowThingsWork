import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {THERMOMETRIC_LIQUIDS} from './liquid-thermometer-physics.js';
import {WATER} from './water-clock-physics.js';
import {SPIN} from './spin-dryer-physics.js';
const families=[["electronic","electronicLessons","createElectronicModel"],['daily-life','dailyLifeLessons','createDailyLifeMachine'],['kitchen','kitchenLessons','createKitchenModel'],['time','timeLessons','createTimeModel'],['utility','utilityLessons','createUtilityModel'],['safety','safetyLessons','createSafetyModel'],['cleaning','cleaningLessons','createCleaningModel'],['heating','heatingLessons','createHeatingModel'],['study','studyLessons','createStudyModel'],['play','playLessons','createPlayModel']];
const {houseComponents}=await import("./house-components.js");
const lessons={},factories=[];
for(const [file,dataName,factoryName] of families){Object.assign(lessons,(await import(`./${file}-lessons.js`))[dataName]);factories.push((await import(`./${file}-models.js`))[factoryName]);}
const create=name=>{for(const factory of factories){const model=factory(name);if(model)return model;}return null;};
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function finite(value,path='state'){if(typeof value==='number')assert.ok(Number.isFinite(value),path);else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))finite(item,`${path}.${key}`);}
function finiteState(model,name=model.root.userData.machine){
 const state=model.getState();
 if(model.root.userData.machine==='Protective earth wire'){
  const {timeToTrip,loopResistance,...rest}=state;
  assert.equal(timeToTrip,state.tripped?0:state.total>1.5?Math.max(0,.5-state.exposure):Infinity,`${name}: trip delay follows threshold and latch`);
  assert.equal(loopResistance,state.values.fault&&state.values.earth&&!state.tripped?.4+state.values.resistance:Infinity,`${name}: fault loop is closed or intentionally open`);
  finite(rest,`${name}.state`);
 }else if(['Fuse','Consumer unit'].includes(model.root.userData.machine)){
  const {timeToMelt,...rest}=state;
  const currents=state.currents||[state.current],heat=Array.isArray(state.heat)?state.heat:[state.heat],open=state.blown||[state.melted];
  const delays=currents.map((current,i)=>open[i]?0:current*current>1?4*Math.log((current*current-heat[i])/(current*current-1)):Infinity);
  assert.ok(delays.every(delay=>delay>=0),`${name}: remaining melt delays cannot be negative or NaN`);
  assert.deepEqual(Array.isArray(timeToMelt)?timeToMelt:[timeToMelt],delays,`${name}: melt delay follows temperature, current and open elements`);
  finite(rest,`${name}.state`);
 }else if(model.root.userData.machine==='Liquid-in-glass thermometer'){
  const {phaseTime,...rest}=state,{initial,surroundings,response,liquid}=state.values;
  const freezing=THERMOMETRIC_LIQUIDS[liquid].freezing;
  const expected=surroundings<freezing?response*Math.log((initial-surroundings)/(freezing-surroundings)):Infinity;
  assert.ok(phaseTime>=0,`${name}: freezing time cannot be negative or NaN`);
  assert.equal(phaseTime,expected,`${name}: freezing occurs only when the surroundings are below the phase boundary`);
  finite(rest,`${name}.state`);
 }else if(model.root.userData.machine==='Water clock'&&state.values.design===2){
  const {full,...rest}=state;
  assert.ok(state.rise>=0,`${name}: inflow rise cannot be negative or NaN`);
  assert.equal(state.rise===0,state.values.rate===0,`${name}: the receiver rises only with an open inlet`);
  assert.equal(full,state.rise?(WATER.overflowLevel-WATER.initialLevel)/state.rise:Infinity,`${name}: a closed inlet never fills the receiver`);
  finite(rest,`${name}.state`);
 }else if(model.root.userData.machine==='Spin dryer'){
  const {holding,...rest}=state;
  assert.ok(state.pressure>=0&&state.w>=0,`${name}: pressure and angular speed cannot be negative or NaN`);
  assert.equal(state.pressure===0,state.w===0,`${name}: rotational pressure vanishes only at rest`);
  assert.equal(holding,state.pressure>0?2*SPIN.tension*SPIN.wetting/state.pressure:Infinity,`${name}: finite capillary threshold requires rotational pressure`);
  finite(rest,`${name}.state`);
 }else finite(state,`${name}.state`);
}
// Only documented sentinels are accepted, in their valid physical states.
{
 const state={tripped:false,total:.5,exposure:0,timeToTrip:Infinity,loopResistance:Infinity,values:{fault:0,earth:1,resistance:.2}};
 const model={root:{userData:{machine:'Protective earth wire'}},getState:()=>state};
 finiteState(model);
 for(const field of ['timeToTrip','loopResistance'])for(const invalid of [NaN,-Infinity,0]){
  assert.throws(()=>finiteState({...model,getState:()=>({...state,[field]:invalid})}),assert.AssertionError);
 }
 for(const invalid of [NaN,Infinity,-Infinity]){
  assert.throws(()=>finiteState({...model,getState:()=>({...state,unexpected:invalid})}),assert.AssertionError);
  assert.throws(()=>finite([1,invalid], 'transform'),assert.AssertionError);
 }
 assert.throws(()=>finiteState({root:{userData:{machine:'Another model'}},getState:()=>state}),assert.AssertionError);
 assert.throws(()=>finiteState({...model,getState:()=>({...state,total:2,values:{fault:1,earth:1,resistance:.2}})}),assert.AssertionError);
}
for(const machine of ['Fuse','Consumer unit']){
 const state=machine==='Fuse'?{current:.5,heat:0,melted:false,timeToMelt:Infinity}:{currents:[.5,.5],heat:[0,0],blown:[false,false],timeToMelt:[Infinity,Infinity]};
 const model={root:{userData:{machine}},getState:()=>state};finiteState(model);
 for(const invalid of [NaN,-Infinity,0])assert.throws(()=>finiteState({...model,getState:()=>({...state,timeToMelt:machine==='Fuse'?invalid:[Infinity,invalid]})}),assert.AssertionError);
 for(const invalid of [NaN,Infinity,-Infinity])assert.throws(()=>finiteState({...model,getState:()=>({...state,unexpected:invalid})}),assert.AssertionError);
 assert.throws(()=>finiteState({...model,getState:()=>({...state,...(machine==='Fuse'?{current:2}:{currents:[.5,2]})})}),assert.AssertionError);
 assert.throws(()=>finiteState({...model,getState:()=>({...state,...(machine==='Fuse'?{melted:true}:{blown:[false,true]})})}),assert.AssertionError);
}
const sentinelCases=[
 {machine:'Liquid-in-glass thermometer',field:'phaseTime',
  state:{values:{liquid:1,initial:20,surroundings:0,response:60},phaseTime:Infinity},
  active:{values:{liquid:0,initial:20,surroundings:-50,response:60},phaseTime:60*Math.log(70/(-38.84+50))},
  invalid:[{values:{liquid:0,initial:20,surroundings:-50,response:60}}]},
 {machine:'Water clock',field:'full',
  state:{values:{design:2,rate:0},rise:0,full:Infinity},
  active:{values:{design:2,rate:100},rise:.02,full:(WATER.overflowLevel-WATER.initialLevel)/.02},
  invalid:[{values:{design:0,rate:0}},{values:{design:2,rate:100}},{rise:.02},{rise:-.02}]},
 {machine:'Spin dryer',field:'holding',
  state:{w:0,pressure:0,holding:Infinity},
  active:{w:100,pressure:52000,holding:2*SPIN.tension*SPIN.wetting/52000},
  invalid:[{w:100},{pressure:52000},{pressure:-1},{w:-1}]},
];
let sentinelChecks=0;
for(const {machine,field,state,active,invalid} of sentinelCases){
 const check=value=>{sentinelChecks++;finiteState({root:{userData:{machine}},getState:()=>value});};
 check(state);check(active);
 for(const value of [NaN,-Infinity,-1,0,42])assert.throws(()=>check({...state,[field]:value}),assert.AssertionError);
 for(const value of [NaN,Infinity,-Infinity,-1,0])assert.throws(()=>check({...active,[field]:value}),assert.AssertionError);
 for(const value of [NaN,Infinity,-Infinity]){
  assert.throws(()=>check({...state,unexpected:{nested:[value]}}),assert.AssertionError);
  assert.throws(()=>check({...active,unexpected:{nested:[value]}}),assert.AssertionError);
 }
 for(const change of invalid)assert.throws(()=>check({...state,...change}),assert.AssertionError);
 assert.throws(()=>finiteState({root:{userData:{machine:'Another model'}},getState:()=>state}),assert.AssertionError);
 sentinelChecks++;
}
console.log(`PASS: ${sentinelChecks} thermometer, water-clock and spin-dryer sentinel contract probes.`);
for(const [name,lesson] of Object.entries(lessons)){
 const model=create(name);assert.ok(model,`Missing model: ${name}`);assert.ok(lesson.steps.length&&lesson.parts.length&&lesson.tryIt.length&&lesson.limits,`Incomplete lesson: ${name}`);
 for(const e of lesson.tryIt)model.update(e.values);
 for(const c of model.controls){for(const value of [c.min,c.max,c.initial]){model.update({[c.key]:value});finiteState(model,name);}}
 for(const t of [0,.25,.5,.75,1,100]){model.animate?.(t);finiteState(model,name);model.root.updateMatrixWorld(true);model.root.traverse(o=>finite(o.matrixWorld.elements,`${name}.${o.name}.transform`));}
 model.dispose();
}
for(const [name,c] of Object.entries(houseComponents)){const m=c.createModel?.()||create(c.machine);assert.ok(m, name);assert.ok(m.parts.some(p=>p.id===c.part), `Missing component ${name}: ${c.part}`);m.update(c.values);finiteState(m,name);m.dispose();}
const catalogContext={};vm.createContext(catalogContext);vm.runInContext(fs.readFileSync(new URL('./catalog-data.js',import.meta.url),'utf8').replace(/export \{neighborhoodCatalog\};/, '')+';globalThis.data=neighborhoodCatalog',catalogContext);
const catalog=catalogContext.data;let routes=0;
for(const group of catalog.groups.filter(g=>g.place==='home'))for(const name of group.items){assert.ok(catalog.entries.some(e=>e.name===name),`Missing entry ${name}`);assert.ok(lessons[name]||houseComponents[name],`Missing explicit lesson route ${name}`);routes++;}
const lamp=create('Two-way light switch');lamp.update({voltage:12,resistance:0,first:0,second:0,protect:0});near(lamp.getState().current,1);lamp.update({resistance:36});near(lamp.getState().current,.25);lamp.update({voltage:24});near(lamp.getState().current,.5);lamp.update({second:1});near(lamp.getState().current,0);lamp.dispose();
const kettle=create('Electric kettle');kettle.update({volts:230,mass:1,start:15,filled:1});const kettleFull=kettle.getState();assert.ok(kettleFull.boils,'a kettleful boils');near(kettleFull.needed,1*4184*85,1);kettle.update({mass:.2});assert.ok(kettle.getState().switched<kettleFull.switched/4,'a fifth of the water boils in well under a quarter of the time');kettle.update({mass:1,filled:0});assert.ok(kettle.getState().trips&&kettle.getState().tripped<1,'switched on dry the element trips in under a second');kettle.dispose();
const heater=create('Electric heating');heater.update({volts:230,length:6,reflector:1,room:20});const heaterHot=heater.getState();assert.ok(heaterHot.glows&&heaterHot.power<heaterHot.coldPower,'the element glows, and its power falls as its resistance rises');near(heaterHot.radiated+heaterHot.convected,heaterHot.power,1);heater.update({reflector:0});assert.ok(Math.abs(heater.getState().radiated-heaterHot.radiated)<1e-6&&heater.getState().forward<heaterHot.forward,'a reflector moves heat about rather than making any');heater.dispose();
const dryer=create('Hair dryer');dryer.update({volts:230,airflow:35,room:20,blocked:0});const dryerOn=dryer.getState();assert.ok(dryerOn.opened===null&&dryerOn.outlet>20,'with air moving the cutout never opens');dryer.update({airflow:20});assert.ok(dryer.getState().outlet>dryerOn.outlet,'less air through the same element is hotter air');dryer.update({airflow:35,blocked:1});assert.ok(dryer.getState().cycles,'blocked, the cutout opens and closes again');dryer.dispose();
const thermostat=create('Bimetal thermostat');thermostat.update({setting:20,outdoor:5,power:2000,start:14});thermostat.advance(1e5);assert.ok(thermostat.getState().switches>=2,'the room cycles');assert.ok(thermostat.getState().holds,'and the heater holds it');thermostat.dispose();
const rodStat=create('Rod thermostat');rodStat.update({setting:200,start:20,supply:20,bypass:1});rodStat.advance(1e5);assert.ok(rodStat.getState().settled.celsius>200,'a proportional valve rests above its setting');assert.ok(rodStat.getState().settled.open>0&&rodStat.getState().settled.open<0.15,'on a small opening');rodStat.dispose();
const waxStat=create('Wax thermostat');waxStat.update({growth:12,load:14,ambient:20,start:20});waxStat.advance(1e5);assert.ok(waxStat.getState().halfOpen,'the wax valve sits near half its stroke');assert.ok(!waxStat.getState().boils,'and the engine never boils');waxStat.dispose();
const dip=houseComponents['Capillary action'].createModel();const h=dip.getState().height;dip.update({radius:.1});near(dip.getState().height,2*h);dip.update({liquid:2,radius:.2});assert.equal(dip.getState().enters,false,"mercury stays out of a 0.2 mm tube dipped 15 mm");dip.dispose();const ballpoint=create('Ballpoint pen');near(ballpoint.getState().turns,50/(Math.PI*.7));ballpoint.update({place:2});assert.equal(ballpoint.getState().feeds,true,"orientation alone does not impose an invented failure threshold");near(ballpoint.getState().head,-588.6);ballpoint.update({condition:2});ballpoint.advance(5);near(ballpoint.getState().now.line,Math.PI*.7/2);ballpoint.dispose();const felt=create('Felt-tip pen');const spread=felt.getState().spread;felt.update({speed:5});near(felt.getState().spread,2*spread);felt.dispose();
const dipWriter=create('Dip pen');dipWriter.advance(6.2);near(dipWriter.getState().now.inked,40);near(dipWriter.getState().now.remaining,.005);dipWriter.reset({settings:{press:1,load:2},time:6.2});near(dipWriter.getState().now.inked,22.5);near(dipWriter.getState().now.remaining,0);dipWriter.dispose();
const player=create('Blu-ray player');
player.update({format:0,radius:25});
const innerSpin=player.getState().rpm,cdSpot=player.getState().spotDiameter;
player.update({radius:58});near(player.getState().rpm/innerSpin,25/58);
player.update({format:2});near(cdSpot/player.getState().spotDiameter,(780/.45)/(405/.85));
near(player.getState().cellLength,74.5);near(player.getState().channelRate,66000000);
player.advance(7);assert.equal(player.getState().now.complete,true);
assert.equal(player.getState().now.count,42);assert.equal(player.getState().now.ones,10);assert.equal(player.getState().now.zeros,32);
player.reset({settings:{format:2,radius:25,speed:4,phase:180},time:0});
near(player.getState().duration,1.75);near(player.getState().channelRate,264000000);
player.advance(1.75);assert.equal(player.getState().now.count,42);
player.update({phase:0});near(player.getState().interference.intensity,1);
player.update({phase:180});near(player.getState().interference.intensity,0);
player.dispose();
const paper=create('Electronic paper');paper.advance(20);assert.equal(paper.getState().now.matchedCells,35);const heldInk=paper.getState().now.pixels;paper.update({power:0,pattern:1});assert.deepEqual(paper.getState().now.pixels,heldInk,'disconnected ink retains the image while a new page is queued');paper.reset({settings:{technology:1,pattern:2,power:0},pixels:Array(35).fill(0)});paper.advance(.8);assert.deepEqual(paper.getState().now.pixels,Array(35).fill(1),'oil spreads passively without electrical power');paper.dispose();
const lcd=create('LCD screen');
lcd.reset({settings:{gap:6},time:10});const thickRed=lcd.getState().center.light[0];
lcd.reset({settings:{gap:3},time:10});assert.ok(lcd.getState().center.light[0]>thickRed,'The assigned thinner cell has transmitted more red light at 100 ms');
lcd.reset({settings:{red:0,green:0,blue:0},time:19.95});assert.ok(lcd.getState().center.held.every(v=>Math.abs(v)===5),'Written black uses the full drive magnitude');
lcd.reset({settings:{addressing:1},time:19.95});assert.equal(lcd.getState().center.writes,1);const heldLight=lcd.getState().center.light;
lcd.reset({time:19.95});assert.equal(lcd.getState().center.writes,12);assert.deepEqual(lcd.getState().center.light,heldLight,'Ideal voltage storage preserves optical response between writes');
lcd.reset({settings:{backlight:0},time:19.95});assert.deepEqual(lcd.getState().center.illuminated,[0,0,0],'Backlight loss removes light without stopping row addressing');assert.equal(lcd.getState().center.writes,12);lcd.dispose();
const phone=create('Smartphone');
phone.reset({settings:{scenario:1,support:2}});near(phone.getState().now.force.y,2);
phone.update({support:1});assert.deepEqual(phone.getState().now.force,{x:0,y:0,z:0});
phone.reset({settings:{scenario:1,roll:90}});phone.advance(2.4);assert.equal(phone.getState().orientation,1);
phone.update({support:1});phone.advance(2.4);assert.equal(phone.getState().orientation,1,'free fall preserves orientation history');
phone.reset({settings:{scenario:2},time:2});const radial=phone.getState().now.motor.relativeForce;
phone.reset({settings:{scenario:2,speed:2},time:2});near(phone.getState().now.motor.relativeForce/radial,4);
phone.update({balance:1});phone.advance(2);assert.equal(phone.getState().now.motor.relativeForce,0);
phone.reset({settings:{touchX:1.5,touchY:2.5}});phone.advance(3.6);assert.deepEqual(phone.getState().registered,{x:1.5,y:2.5});
phone.reset({settings:{scenario:3,network:0}});phone.advance(20);assert.equal(phone.getState().now.voiceDelivered,false);
phone.update({network:1});phone.advance(6.4);assert.equal(phone.getState().now.voiceDelivered,true);phone.dispose();
const accelerometer=houseComponents.Accelerometer.createModel();
accelerometer.update({support:1});assert.deepEqual(accelerometer.getState().force,{x:0,y:0,z:0});
accelerometer.reset({settings:{experiment:3},time:6});near(accelerometer.getState().voltage.x,1.175);near(accelerometer.getState().voltage.y,2.125);near(accelerometer.getState().voltage.z,2.050);
accelerometer.update({power:0});assert.deepEqual(accelerometer.getState().voltage,{x:null,y:null,z:null});accelerometer.dispose();
const vibration=houseComponents['Vibration motor'].createModel();
vibration.reset({settings:{program:1},time:20});const coast=vibration.getState().rpm;assert.equal(vibration.getState().current,0);
vibration.reset({settings:{program:2},time:20});assert(vibration.getState().rpm<coast&&vibration.getState().current<0,'Shorting brakes the spinning motor faster than coasting');
vibration.reset({settings:{balance:1},time:20});assert.equal(vibration.getState().radialForce,0);assert(vibration.topology.counterweight.parent===vibration.topology.rotor);vibration.dispose();
const rod=create('Lightning conductor');
rod.reset({settings:{stroke:1,peak:50,paths:2},time:3});const sharedPulse=rod.getState();
assert(sharedPulse.current>0);near(sharedPulse.leftCurrent,sharedPulse.current/2);near(sharedPulse.rightCurrent,sharedPulse.current/2);
rod.reset({settings:{stroke:1,peak:50,paths:1},time:3});const singlePulse=rod.getState();
near(singlePulse.leftCurrent,sharedPulse.current);near(singlePulse.rightCurrent,0);near(singlePulse.gap,2*sharedPulse.gap);
rod.reset({settings:{stroke:0,peak:200},time:rod.duration});near(rod.getState().charge,100,.5);
assert.ok(rod.getState().enhancement>1000,'A 0.5 mm tip on an ideal 2 m semiellipsoid multiplies the storm field more than a thousandfold');
assert.equal('threshold' in rod.getState(),false,'Average gap stress is not a fitted flashover threshold');rod.dispose();
const speech=houseComponents.Phonemes.createModel();
assert.equal(speech.getState().framesArrived,0,'Phoneme spectra wait for actual samples');speech.advance(3);assert.equal(speech.getState().heard,2);assert.equal(speech.getState().framesArrived,208);
speech.reset({settings:{first:4,second:4,pitch:6},time:2.1});const pair=speech.scientificPlan().tokens;assert.deepEqual(pair[0].parameters.formants,pair[1].parameters.formants);near(pair[1].parameters.f0/pair[0].parameters.f0,Math.SQRT2);
speech.reset({settings:{first:10,second:11},time:2.1});assert(speech.getState().bandResults[0].low<.001&&speech.getState().bandResults[1].low>.3,'Approximate voiced frication adds low-frequency energy');
speech.update({airflow:0});speech.advance(3);assert(speech.getState().bandResults.every(b=>b.total===0&&b.centroid===null),'No airflow produces silence with no invented centroid');speech.dispose();
const recording=create('Speech recognition');assert.equal(recording.getState().word,null);recording.advance(3);assert.equal(recording.getState().word,'up');assert.deepEqual(recording.getState().position,[0,1]);recording.reset({settings:{word:4,context:0},time:3});assert.equal(recording.getState().word,null);recording.reset({settings:{word:4,context:2,application:1},time:3});assert.equal(recording.getState().dictation,'write');recording.reset({settings:{word:4,voice:1},time:3});assert.equal(recording.getState().word,'left');assert.equal(recording.getState().matchesRecording,false);recording.reset({settings:{microphone:0},time:3});assert.equal(recording.getState().word,null);recording.dispose();
const calc=create('Calculator');
assert.equal(calc.getState().now.readback,'0');assert.deepEqual(calc.getState().now.acceptedKeys,[]);
calc.update({first:25,second:9});calc.advance(1e4);assert.equal(calc.getState().now.readback,'34');
assert.deepEqual(calc.getState().now.acceptedKeys,['2','5','+','9','=']);
const completedCalculation=calc.getState();for(const action of calc.actions){action.run();assert.deepEqual(calc.getState(),completedCalculation,'Inspection preserves the whole calculator state');}
calc.update({ambient:0});assert.equal(calc.getState().now.readback,'34');assert.equal(calc.getState().readings[0].value,'Screen dark');
calc.update({ambient:1});assert.deepEqual(calc.getState(),completedCalculation,'Light reveals the existing calculation without repeating it');
calc.update({first:99,second:99});assert.equal(calc.getState().now.readback,'0');calc.advance(1e4);assert.equal(calc.getState().now.readback,'198');
calc.update({power:0});assert.equal(calc.getState().now.readback,'Blank');assert(calc.playback.blocked()&&!calc.playback.complete());
calc.update({power:1});assert.equal(calc.getState().now.readback,'0');assert.deepEqual(calc.getState().now.acceptedKeys,[]);
const beforeInvalidOperand=calc.getState();assert.throws(()=>calc.update({first:100}));assert.deepEqual(calc.getState(),beforeInvalidOperand);calc.dispose();
const extinguisher=create('Fire extinguisher');
extinguisher.advance(1e4);const fullDischarge=extinguisher.getState();
assert.equal(fullDischarge.now.phase,'pickup-exposed');near(fullDischarge.now.delivered+fullDischarge.now.water,.009);
assert.equal(fullDischarge.now.flow,0);assert(fullDischarge.now.gauge>0,'Pickup exposure can leave residual pressure');
for(const action of extinguisher.actions){action.run();assert.deepEqual(extinguisher.getState(),fullDischarge,'Inspection keeps the completed water balance');}
extinguisher.update({charge:.25});assert.equal(extinguisher.getState().clock,0);assert.equal(extinguisher.getState().now.delivered,0);
extinguisher.advance(1e4);const reducedDischarge=extinguisher.getState();assert.equal(reducedDischarge.now.phase,'pressure-balance');assert(reducedDischarge.now.pickupWet);assert(reducedDischarge.now.delivered<fullDischarge.now.delivered);
extinguisher.update({charge:1,pickup:1});extinguisher.advance(1e4);assert.equal(extinguisher.getState().now.phase,'pickup-exposed');assert(extinguisher.getState().now.water>.006);
extinguisher.update({pickup:2});extinguisher.advance(1e4);assert.equal(extinguisher.getState().now.phase,'dry-pickup');assert.equal(extinguisher.getState().now.delivered,0);
extinguisher.update({pickup:0,charge:0});extinguisher.advance(1e4);assert.equal(extinguisher.getState().now.phase,'no-charge');assert.equal(extinguisher.getState().now.water,.009);
extinguisher.dispose();
const magneticAlarm=create('Magnetic burglar alarm');magneticAlarm.advance(100);
const alarmDone=magneticAlarm.getState();assert(alarmDone.complete&&alarmDone.closed&&alarmDone.alarm);near(alarmDone.senseCurrent,.001);near(alarmDone.sounderCurrent,.1);
for(const action of magneticAlarm.actions.filter(action=>action.part)){action.run();assert.deepEqual(magneticAlarm.getState(),alarmDone,'Inspection preserves the alarm history');}
magneticAlarm.actions.at(-1).run();assert(!magneticAlarm.getState().alarm);
magneticAlarm.update({cable:0});assert(magneticAlarm.getState().alarm);near(magneticAlarm.getState().senseCurrent,0);
magneticAlarm.update({power:0});assert(!magneticAlarm.getState().alarm);near(magneticAlarm.getState().sounderCurrent,0);
magneticAlarm.dispose();
const boiler=create('Gas boiler');boiler.update({flow:12});boiler.advance(6);
const fullHeat=boiler.getState();near(fullHeat.now.heat,24000);near(fullHeat.now.tapTemperature,45);
assert(fullHeat.now.flow<12,'The temperature-priority controller restricts water at full heat output');
for(const action of boiler.actions){action.run();assert.deepEqual(boiler.getState(),fullHeat,'Inspection preserves the heating cycle');}
boiler.update({inlet:5});assert.equal(boiler.getState().clock,0);boiler.advance(6);
assert(boiler.getState().now.flow<fullHeat.now.flow,'Colder water reduces available flow at the chosen temperature');
boiler.update({flow:1});boiler.advance(1e4);assert.equal(boiler.getState().now.tapTemperature,5);assert.equal(boiler.getState().now.waterEnergy,0);
boiler.reset();boiler.advance(1e4);const heaterDone=boiler.getState();assert(heaterDone.now.complete);assert.equal(heaterDone.now.fan,false);assert.equal(heaterDone.now.flow,0);near(heaterDone.now.tapTemperature,45);
near(heaterDone.now.waterEnergy,heaterDone.now.coilEnergy+heaterDone.now.pipeEnergy+heaterDone.now.deliveredEnergy,1e-7);boiler.dispose();
const aircon=create('Air conditioner');aircon.update({humidity:20});assert.ok(aircon.getState().steady.air.condensate===0,'dry enough air gives the cold coil no water to take out');aircon.update({humidity:90});const damp=aircon.getState().steady;assert.ok(damp.air.latent>damp.air.sensible,'damp air spends more of the coil on drying than on cooling');aircon.update({humidity:60,outdoor:25});const coolDay=aircon.getState().steady.cop;aircon.update({outdoor:45});const hotDay=aircon.getState().steady;assert.ok(hotDay.cop<coolDay,'a hotter day costs more work for the same room');near(hotDay.outdoorHeat,hotDay.cooling+hotDay.compressor.work,1e-9);assert.ok(hotDay.cop<hotDay.carnot,'and no cycle beats Carnot');aircon.dispose();
const toy=create('Friction-drive toy');toy.update({press:8});near(toy.getState().pushSpeeds[0],1.5);toy.update({press:0});assert.ok(toy.getState().pushSpeeds[0]<1.5,"a light press lets the wheels skid");near(toy.getState().felt,.5*7850*Math.PI*1e-8*.004*144/2.25e-4,1e-9);toy.dispose();
const vr=create('Virtual reality headset');vr.update({prediction:0});assert.ok(Math.abs(vr.getState().worstSlip.slip)>2,"without prediction a turning head outruns the picture");vr.update({prediction:1});assert.ok(Math.abs(vr.getState().worstSlip.slip)<.1,"prediction keeps the picture on the room");vr.update({motion:2,offset:.5,correction:0});near(vr.getState().endDrift,1.5,1e-9);near(vr.getState().image.focus,1000/1995,1e-12);vr.dispose();
const uni=create('Unicycle');assert.equal(uni.getState().fell,null,"a rider who pedals under the lean stays up");uni.update({rider:1});assert.ok(uni.getState().fell>1&&uni.getState().fell<2,"cranks held still, the unicycle falls over in under two seconds");uni.update({rider:0,delay:350});assert.ok(uni.getState().fell>0,"reactions far too slow let it fall");uni.update({delay:190,lean:0,speed:1.5});assert.ok(uni.getState().rollback<-0.03,"setting off, the wheel first rolls back");assert.equal(uni.getState().fell,null,"and then carries the rider off");uni.dispose();
const stapler=create('Stapler');assert.ok(stapler.getState().through>0&&stapler.getState().meet===false,"ten sheets leave leg to fold, and short legs do not meet");stapler.update({sheets:60});assert.ok(stapler.getState().through<=0,"sixty sheets are thicker than the legs are long");stapler.update({sheets:2,staple:2});assert.equal(stapler.getState().meet,true,"long legs on two sheets run into each other");stapler.update({staple:0,sheets:10,hand:80});near(stapler.getState().handPeak,2*stapler.getState().peak.force);stapler.dispose();
const joy=create('Games controller');joy.update({release:2,deadzone:20});assert.ok(joy.getState().rest.creep>0,"a stick resting outside a small dead zone creeps");joy.update({deadzone:24});near(joy.getState().rest.creep,0);near(joy.getState().latency.parts.render,1/60,1e-12);joy.dispose();
const toilet=create('Toilet tank');const emptied=values=>{toilet.reset();toilet.update(values);toilet.advance(1e4);return toilet.getState();};
const narrowFlush=emptied({level:.18,bore:.025,pressure:0,stroke:.1}),wideFlush=emptied({level:.18,bore:.045,pressure:0,stroke:.1});
near(narrowFlush.outlet,wideFlush.outlet,1e-10);assert.ok(wideFlush.flushEnded<narrowFlush.flushEnded*.6,'with supply isolated, a wider siphon empties the same stored charge sooner');
const tallFlush=emptied({level:.215,bore:.032,pressure:0,stroke:.1});near(tallFlush.outlet,.072*(.215-.04),1e-10);
const connectedFlush=emptied({level:.18,bore:.032,pressure:5,stroke:.1});assert.ok(connectedFlush.outlet>narrowFlush.outlet,'ordinary concurrent refill adds to delivery');near(connectedFlush.inlet,connectedFlush.outlet,1e-10);
const failedFlush=emptied({level:.16,bore:.045,pressure:2,stroke:.1});assert.ok(!failedFlush.primed&&failedFlush.outlet===0,'insufficient piston displacement fails to prime');
toilet.dispose();
console.log(`PASS: ${Object.keys(lessons).length} house models, ${routes} house routes, control endpoints, finite transforms, and numerical regressions.`);

// The door closer spends everything the hand gave it: on the oil, on friction, on the bolt, on the stop,
// on the bang at the strike, and on whatever the spring is still holding if the door stopped short.
const closer=create("Door closer");const swing=values=>{closer.update(values);return closer.getState();};
const shut=swing({door:3,size:3,sweep:.3,latch:.45,backcheck:1,open:80,push:60});
near(shut.handWork,shut.oilHeat+shut.frictionHeat+shut.latchWork+shut.stopLoss+shut.arrivalEnergy+shut.residual,.05);
assert.ok(shut.latched&&shut.sweepTime>5,"at its opening settings the door latches and takes more than five seconds from 90 to 12 degrees");
const slow=swing({sweep:.15});assert.ok(slow.sweepTime>3.5*shut.sweepTime,"halving the sweep orifice makes the door about four times slower");
const weak=swing({sweep:.3,size:1});assert.ok(!weak.latched&&weak.ajar>0,"a closer too weak for the bolt leaves the door ajar");
const heavy=swing({size:7});assert.ok(!heavy.opens,"a closer stronger than the hand never opens at all");closer.dispose();
const washer=create("Washing machine");washer.update({imbalance:.2,spin:1200});near(washer.getState().top.force,.2*.25*(1200*Math.PI/30)**2,1e-6);washer.update({spin:600});near(washer.getState().top.force,.2*.25*(600*Math.PI/30)**2,1e-6);washer.update({imbalance:0});near(washer.getState().top.amplitude,0);washer.dispose();
const microwave=create("Microwave oven");microwave.update({level:100,seconds:120,mass:.1});microwave.advance(1e4);const mw=microwave.getState();
assert.ok(mw.limitTime>0&&mw.limitTime<120,'the first hot volume reaches the model boundary before the requested timer');near(mw.atEnd.maxT,100);
assert.ok(mw.maxT<=mw.atEnd.maxT&&mw.minT>=mw.atEnd.minT,'standing narrows the temperature range');
near(mw.temperatures.reduce((heat,T,i)=>heat+mw.grid.cells[i].mass*4186*(T-20),0),mw.absorbed);
near(.1*4186*(mw.meanT-20),mw.absorbed);near(mw.absorbed,mw.made*mw.share);microwave.dispose();
const toast=create("Toaster");toast.update({setting:4});toast.advance(1e3);const hot=toast.getState();near(hot.triggered,146,.02);near(hot.powerOff,146.15,.02);near(hot.popped,147.1,.02);assert.ok(!hot.on&&hot.carriage===1,"completed toaster is raised and switched off");assert.ok(hot.atPop.browning>.4&&hot.atPop.browning<2,"golden at setting 4");assert.ok(hot.atPop.energy>hot.atPop.bread&&hot.atPop.bread>0,"the bread takes only part of the energy");toast.update({start:1,timer:1});toast.advance(1e3);assert.ok(toast.getState().atPop.browning>8,"a hot toaster on a plain timer burns the second slice");toast.dispose();
console.log("PASS: explicit component targets, thermal energy boundaries, door energy, and washer speed scaling.");

const remote=create("Remote control");remote.update({distance:5});const near5=remote.physicalPlan().light;remote.update({distance:10});near(near5/remote.physicalPlan().light,4,1e-9);for(const command of [0,255]){remote.update({command});near(remote.physicalPlan().frameEnd,.0680625,1e-12);}remote.update({probe:.72});const probed=remote.physicalPlan();assert.ok(probed.diagnosticDiode.current>.009&&probed.diagnosticDiode.current<.01&&probed.values.probe<1,"the 1N4148 passes about 10 mA below the 1 V its sheet allows there");remote.reset();remote.advance(100);assert.equal(remote.getState().tv.channel,3);remote.reset({settings:{fault:1}});remote.advance(100);assert.equal(remote.getState().tv.channel,2);assert.equal(remote.getState().accepted,false);remote.dispose();
const multiplier=create("Voltage multiplier");multiplier.update({stages:4,peak:20,frequency:50,capacitance:.5,load:0});near(multiplier.getState().late.mean,2*4*(20-.7),.05);near(multiplier.getState().late.ripple,0,.05);assert.equal(multiplier.getState().late.cycle,400);multiplier.update({stages:4,peak:100,capacitance:.5,load:500});assert.ok(multiplier.getState().late.mean<600&&multiplier.getState().estimate<0,"a heavy load sags the ladder past the small-load formula");multiplier.dispose();
console.log("PASS: the remote control's inverse-square light, complete 68.0625 ms frame, accepted/rejected TV commands, 1N4148 probe, and multiplier loaded/no-load boundaries.");

const smoke=create("Smoke detector");
smoke.reset({settings:{size:.1}});smoke.advance(30);const fine=smoke.getState();
assert.ok(fine.complete&&fine.photoSeen===null&&fine.ionSeen>0&&fine.ionSeen<60,"assigned small spheres trigger only the ionization path during this observation");
smoke.reset({settings:{size:3}});smoke.advance(30);const coarse=smoke.getState();
assert.ok(coarse.ionSeen===null&&coarse.photoSeen>120&&coarse.photoSeen<140,"assigned large spheres trigger only the optical path during this observation");
smoke.reset({settings:{growth:50,program:1}});smoke.advance(30);const cleared=smoke.getState();
assert.ok(cleared.ionSeen!==null&&cleared.photoSeen!==null&&!cleared.active&&cleared.events.some(event=>!event.active),"fresh air releases both alarm requests while preserving their recorded onsets");
smoke.reset({settings:{power:0}});smoke.advance(30);assert.equal(smoke.getState().events.length,0,"disconnected battery cannot request the horn");smoke.dispose();
console.log("PASS: the smoke detector's assigned particle-size comparison, sampled alarm history, fresh-air release and disconnected-power behavior.");

const intruder=create('Active burglar alarm');intruder.advance(1);near(intruder.getState().doppler,2*24.125e9/299792458,1e-10);assert.ok(intruder.getState().active,'changing reflected phase requests the powered alarm');
intruder.reset({settings:{path:3}});intruder.advance(intruder.duration());assert.equal(intruder.getState().active,false,'constant-radius point motion gives no Doppler');
intruder.reset({settings:{mode:1}});intruder.advance(intruder.duration());near(intruder.getState().blockedFor,.25,1e-12);near(intruder.getState().onset,.925,1e-12);
intruder.reset({settings:{mode:1,hold:500}});intruder.advance(intruder.duration());assert.equal(intruder.getState().active,false,'a 250 ms blockage cannot qualify for 500 ms');
intruder.reset({settings:{mode:2}});intruder.advance(12);assert.ok(intruder.getState().active,'changing warm-zone inputs cross the assigned threshold');
intruder.reset({settings:{mode:2,speed:0}});intruder.advance(12);assert.equal(intruder.getState().output,0,'settled warm input gives zero changing output');intruder.dispose();
console.log('PASS: active Doppler reflection, constant-radius motion, timed beam interruption and the separate passive thermal comparison.');

const stage3d=create('Three-axis positioning');stage3d.update({targetX:6,targetY:4,targetZ:4,microsteps:16,play:0,roundTrip:0});stage3d.advance(1e4);
const positioned=stage3d.getState(),beltIncrement=2*Math.PI*1.2/(200*16);assert.ok(positioned.complete);near(positioned.position.x,Math.round(6/beltIncrement)*beltIncrement);near(positioned.position.y,Math.round(4/beltIncrement)*beltIncrement);near(positioned.position.z,4);near(positioned.plan.pitch.z,2/(200*16));near(positioned.extrudedVolume,0);
stage3d.update({play:.5,roundTrip:1});stage3d.advance(1e4);const returned3d=stage3d.getState();assert.ok(returned3d.complete);near(returned3d.drive.x,0);near(returned3d.position.x,.5);near(returned3d.position.y,0);near(returned3d.position.z,.2);stage3d.dispose();
const cad3d=create('Computer-aided design');cad3d.update({facets:8});const coarse3d=cad3d.getState().outerError;cad3d.update({facets:128});assert.ok(cad3d.getState().outerError<coarse3d/200,"more facets fall far closer to the curve");near(cad3d.getState().bytes,84+50*cad3d.getState().triangles,1e-9);cad3d.dispose();
const scan3d=create('Laser scanning of 3D objects');scan3d.update({standoff:53.5});const nearRes3d=scan3d.getState().resolutionMicrons;scan3d.update({standoff:78.5});near(scan3d.getState().resolutionMicrons/nearRes3d,(78.5/53.5)**2,1e-6);scan3d.update({ridge:0});assert.ok(scan3d.getState().missing===0,"a flat target hides nothing from the receiver");scan3d.dispose();
console.log("PASS: coordinated XYZ commands, visible X coupling play on return, a file's bytes from its triangles, and the depth one pixel is worth growing as the square of the distance.");

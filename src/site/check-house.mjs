import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const families=[["electronic","electronicLessons","createElectronicModel"],['daily-life','dailyLifeLessons','createDailyLifeMachine'],['kitchen','kitchenLessons','createKitchenModel'],['time','timeLessons','createTimeModel'],['utility','utilityLessons','createUtilityModel'],['safety','safetyLessons','createSafetyModel'],['cleaning','cleaningLessons','createCleaningModel'],['heating','heatingLessons','createHeatingModel'],['study','studyLessons','createStudyModel'],['play','playLessons','createPlayModel']];
const {houseComponents}=await import("./house-components.js");
const lessons={},factories=[];
for(const [file,dataName,factoryName] of families){Object.assign(lessons,(await import(`./${file}-lessons.js`))[dataName]);factories.push((await import(`./${file}-models.js`))[factoryName]);}
const create=name=>{for(const factory of factories){const model=factory(name);if(model)return model;}return null;};
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function finite(value,path='state'){if(typeof value==='number')assert.ok(Number.isFinite(value),path);else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))finite(item,`${path}.${key}`);}
for(const [name,lesson] of Object.entries(lessons)){
 const model=create(name);assert.ok(model,`Missing model: ${name}`);assert.ok(lesson.steps.length&&lesson.parts.length&&lesson.tryIt.length&&lesson.limits,`Incomplete lesson: ${name}`);
 for(const e of lesson.tryIt)model.update(e.values);
 for(const c of model.controls){for(const value of [c.min,c.max,c.initial]){model.update({[c.key]:value});finite(model.getState());}}
 for(const t of [0,.25,.5,.75,1,100]){model.animate?.(t);finite(model.getState());model.root.updateMatrixWorld(true);model.root.traverse(o=>finite(o.matrixWorld.elements,`${name}.${o.name}.transform`));}
 model.dispose();
}
for(const [name,c] of Object.entries(houseComponents)){const m=create(c.machine);assert.ok(m, name);assert.ok(m.parts.some(p=>p.id===c.part), `Missing component ${name}: ${c.part}`);m.update(c.values);finite(m.getState());m.dispose();}
const catalogContext={};vm.createContext(catalogContext);vm.runInContext(fs.readFileSync(new URL('./catalog-data.js',import.meta.url),'utf8').replace(/export \{neighborhoodCatalog\};/, '')+';globalThis.data=neighborhoodCatalog',catalogContext);
const catalog=catalogContext.data;let routes=0;
for(const group of catalog.groups.filter(g=>g.place==='home'))for(const name of group.items){assert.ok(catalog.entries.some(e=>e.name===name),`Missing entry ${name}`);assert.ok(lessons[name]||houseComponents[name],`Missing explicit lesson route ${name}`);routes++;}
const lamp=create('Two-way light switch');lamp.update({voltage:12,resistance:0,first:0,second:0,protect:0});near(lamp.getState().current,1);lamp.update({resistance:36});near(lamp.getState().current,.25);lamp.update({voltage:24});near(lamp.getState().current,.5);lamp.update({second:1});near(lamp.getState().current,0);lamp.dispose();
const kettle=create('Electric kettle');kettle.update({voltage:240,resistance:60,mass:.2,seconds:60});near(kettle.getState().temperature,20+960*60/(.2*4180));kettle.update({seconds:90});near(kettle.getState().temperature,100);near(kettle.getState().power,0);kettle.dispose();
const thermostat=create('Bimetal thermostat');thermostat.update({setpoint:30,temperature:32});assert.equal(thermostat.getState().demand,false);thermostat.update({temperature:30});assert.equal(thermostat.getState().demand,false);thermostat.update({temperature:28});assert.equal(thermostat.getState().demand,true);thermostat.update({temperature:30});assert.equal(thermostat.getState().demand,true);thermostat.dispose();
const pen=create('Ballpoint pen');pen.update({radius:.08,angle:30});const h=pen.getState().height;pen.update({radius:.04});near(pen.getState().height,2*h);pen.update({angle:110});assert.ok(pen.getState().height<0);pen.dispose();
const calc=create('Calculator');for(let a=0;a<=15;a++)for(let b=0;b<=15;b++)for(let operation=0;operation<3;operation++){calc.update({a,b,operation});assert.equal(calc.getState().result,operation===0?a+b:operation===1?a*b:Math.max(0,a-b));}calc.update({a:3.7,b:4,operation:0});assert.equal(calc.getState().result,8);calc.dispose();
const toy=create('Friction-drive toy');toy.update({speed:.3,inertia:.00004});const energy=toy.getState().energy;toy.update({speed:.6});near(toy.getState().energy,energy*4);toy.dispose();
const vr=create('Virtual reality headset');vr.update({rate:20,seconds:1,latency:100});near(vr.getState().error,2);vr.dispose();
const joy=create('Games controller');joy.update({x:.1,y:0,deadzone:.15});near(joy.getState().magnitude,0);joy.update({x:1,y:1});near(joy.getState().magnitude,1);joy.dispose();
const toilet=create('Toilet tank');toilet.update({flush:1,seconds:2});const s1=toilet.getState();toilet.update({seconds:3});near(toilet.getState().liters-s1.liters,s1.inflow-s1.outflow);toilet.dispose();
console.log(`PASS: ${Object.keys(lessons).length} house models, ${routes} house routes, control endpoints, finite transforms, and numerical regressions.`);

const closer=create("Door closer");closer.update({seconds:0});const initial=closer.getState().energy;closer.update({seconds:5});near(closer.getState().energy+closer.getState().dissipated,initial);assert.ok(closer.getState().angle>0&&closer.getState().rate<0);closer.dispose();
const washer=create("Washing machine");washer.update({stage:3,spinRpm:400,imbalance:.1});const accel=washer.getState().acceleration,force=washer.getState().force;washer.update({spinRpm:800});near(washer.getState().acceleration,4*accel);near(washer.getState().force,4*force);washer.update({imbalance:0});near(washer.getState().amplitude,0);washer.dispose();
const microwave=create("Microwave oven");microwave.update({power:1000,seconds:120,mass:.1});const mw=microwave.getState();near(mw.temperature,100);near(.1*4180*80+mw.evaporated*2260000,mw.energy);near(mw.remaining+mw.evaporated,.1);microwave.dispose();
const toast=create("Toaster");toast.update({power:200,seconds:90,mass:.06,duration:90});const hot=toast.getState();near(hot.energy,18000);assert.ok(hot.loss>0);near(.06*1700*(hot.temperature-20)+hot.loss,hot.energy);toast.update({seconds:180});assert.ok(toast.getState().temperature<hot.temperature);near(toast.getState().energy,hot.energy);toast.update({power:0});near(toast.getState().temperature,20);toast.dispose();
console.log("PASS: explicit component targets, thermal energy boundaries, door energy, and washer speed scaling.");

const diode=create("Diode");diode.update({voltage:3,resistance:500});near(diode.getState().current,.0046);near(3*diode.getState().current,diode.getState().junctionPower+diode.getState().resistorPower);diode.update({voltage:-2});near(diode.getState().current,0);diode.dispose();
const photo=create("Photodiode");photo.update({opticalPower:1,loadResistance:10});near(photo.getState().outputVoltage,4);near(photo.getState().reverseBias,1);photo.dispose();
const multiplier=create("Voltage multiplier");multiplier.update({stages:4,peak:20,frequency:50,capacitance:.5,load:2});near(multiplier.getState().sag,4);near(multiplier.getState().ripple,.8);near(multiplier.getState().outputVoltage,156);multiplier.update({load:0});near(multiplier.getState().outputVoltage,160);near(multiplier.getState().ripple,0);multiplier.dispose();
console.log("PASS: diode power balance, reverse blocking, photodiode bias, and multiplier loaded/no-load boundaries.");

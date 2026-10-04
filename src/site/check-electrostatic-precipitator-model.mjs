import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElectrostaticPrecipitatorModel} from './electrostatic-precipitator-model.js';
import {AIR_CLEANER_DEFAULTS as D, sampleAirCleaner} from './air-cleaner-physics.js';
import {electrostaticPrecipitatorLesson as lesson} from './air-cleaner-lessons.js';
import {houseComponents} from './house-components.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
import {fixed} from './format.js';
const t=tally(),m=createElectrostaticPrecipitatorModel();
const core=s=>[s.clock,s.values,s.remaining,s.collected,s.deposited,s.ventilated,s.cohort];
const reset=(values={},time=0)=>{const settings={...D,...values};m.reset({settings,time});m.update(settings);return m.getState();};
assert.deepEqual(m.controls.map(c=>c.key),['size','fan','voltage','room']);
t.ok(m.controls.find(c=>c.key==='voltage').primary,'high voltage visible above scene');
t.ok(houseComponents['Electrostatic precipitator'].createModel===createElectrostaticPrecipitatorModel,'route uses focused model');
t.ok(houseComponents['Electrostatic precipitator'].part==='stage','opening includes charging and collection');
let poses=0;
for(let size=0;size<7;size++)for(let fan=0;fan<4;fan++)for(let voltage=0;voltage<2;voltage++)for(const room of[30,60,90])for(const time of[0,300,900,1200,3600]){
 const values={...D,size,fan,voltage,room},s=reset(values,time),ref=sampleAirCleaner(values,time);poses++;
 for(const key of['efficiency','remaining','collected','deposited','ventilated','chargeU','U'])t.near(s[key],ref[key],1e-14,'component preserves validated physical account');
 t.ok(m.topology.collector.visible&&m.topology.wires.visible&&!m.topology.filter.visible&&!m.topology.needle.visible,'both stages remain installed');
 t.near(s.remaining+s.collected+s.deposited+s.ventilated,1,2e-13,'room mass account');
 const readings=s.readings;assert.equal(readings.length,11);const value=label=>readings.find(r=>r.label===label).value;
 const Q=[0,60,120,200][fan]/3600;
 assert.equal(value('Time in charging grid'),Q?`${fixed(.025*.05808/Q*1000,2)} ms`:'No passage');
 assert.equal(value('Time between collecting plates'),Q?`${fixed(.1*.0528/Q*1000,2)} ms`:'No passage');
 assert.equal(value('Collecting electric field'),`${fan&&voltage?500:0} kV/m`);
 if(!voltage||!fan)t.near(s.efficiency,0,0,'unpowered cell has no assigned electrical capture');
 for(const marker of s.cohort)if(marker.captured){t.ok(marker.target!==undefined,'captured marker has collection surface');t.ok(marker.n>0,'uncharged particles are not electrically captured');}
}
let checkpoints=0;
for(const trial of lesson.tryIt)for(const prior of[{fan:0,voltage:0},{size:0,fan:1,room:90}]){
 reset(prior,3500);m.reset(trial.initialState);m.update(trial.values);assert.deepEqual(m.getState().values,{...D,...trial.values});assert.equal(m.getState().clock,trial.initialState.time);checkpoints++;
 for(const action of m.actions){const before=core(m.getState());const readings=action.run();assert.deepEqual(core(m.getState()),before,'inspection preserves trial');assert.equal(readings.length,11);t.ok(m.parts.some(p=>p.id===action.part),'inspection target exists');}
}
reset({},1800);const before=core(m.getState());for(const mode of[0,2,NaN,Infinity]){assert.throws(()=>m.update({mode}),RangeError);assert.throws(()=>m.reset({settings:{...D,mode}}),RangeError);assert.deepEqual(core(m.getState()),before,'refused replacement leaves trial unchanged');}
for(const time of[-1,3601,NaN,Infinity])assert.throws(()=>m.reset({time}),RangeError);
reset({},1200);m.update({fan:1});assert.equal(m.getState().clock,0);assert.equal(m.getState().remaining,1);
reset();assert.equal(m.playback.step().length,11);assert.equal(m.getState().clock,300);assert.equal(m.advance(1).length,11);assert.equal(m.getState().clock,360);m.advance(100);assert.ok(m.playback.complete());m.reset(m.replayState());assert.equal(m.getState().clock,0);
assert.equal(m.animate(1).length,11,'animate delegates to the enriched advance exactly once');assert.equal(m.getState().readings.length,11);assert.equal(m.getState().clock,60);checkFinite(m.root,t);
let layouts=0;
for(const aspect of[1,1.24]){reset({},1200);const before=core(m.getState()),{camera}=frameModel(m,aspect),explosion=createPartExplosion(m,camera,aspect);explosion.update(1);const inverse=camera.quaternion.clone().invert(),boxes=explosion.items.map(unit=>{const box=new THREE.Box3();for(const x of[unit.bounds.min.x,unit.bounds.max.x])for(const y of[unit.bounds.min.y,unit.bounds.max.y])for(const z of[unit.bounds.min.z,unit.bounds.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).add(unit.group.position).applyQuaternion(inverse));return box;});for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)t.ok(boxes[i].max.x<=boxes[j].min.x||boxes[j].max.x<=boxes[i].min.x||boxes[i].max.y<=boxes[j].min.y||boxes[j].max.y<=boxes[i].min.y,'separated units do not overlap');explosion.update(0);explosion.dispose();assert.deepEqual(core(m.getState()),before);layouts++;}
const resources=checkDisposal(m,t);
console.log(`PASS electrostatic precipitator: ${t.count} checks; ${poses} poses; ${checkpoints} preset checkpoints; ${layouts} separated layouts; ${resources} resources`);

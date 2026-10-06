import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createPassiveInfraredModel} from './passive-infrared-model.js';
import {reviewedPassiveInfraredLesson as lesson} from './passive-infrared-lesson.js';
import {PIR_DEFAULTS as D,PIR_KEYS,pirPlan,pirAt,pirSharedSettings} from './passive-infrared-physics.js';
import {BURGLAR_SCIENCE as C,BURGLAR_LENSLETS,burglarZone} from './burglar-alarm-physics.js';
import {burglarRoomScale} from './burglar-alarm-geometry.js';
import {tally,checkFinite,checkDisposal,checkTrialNumbers} from './model-check-kit.mjs';
import {createSafetyModel} from './safety-models.js';
import {houseComponents} from './house-components.js';
const t=tally(),m=createPassiveInfraredModel(),g=m.topology,outcomes=[],controlCases=[];
const expected=[true,true,true,false,true,false,false,false,false,false,false,false];
const vector=p=>new THREE.Vector3(...p),ends=object=>[-1,1].map(sign=>object.localToWorld(vector([0,sign*object.geometry.parameters.height/2,0])));
assert.deepEqual(m.controls.map(c=>c.key),PIR_KEYS);assert.deepEqual(Object.keys(m.defaults),PIR_KEYS);t.add(2);
assert.deepEqual(Object.keys(m.partViewDirections),m.parts.map(part=>part.id));t.add();
const run=values=>{const plan=pirPlan(values);return {start:pirAt(plan,0),end:pirAt(plan,12),plan};};
checkTrialNumbers(lesson,{
 'Walk across the zones':({end})=>({'5':end.values.range,'1':end.values.speed,'154.66':end.peak*1e6,'2.594':end.onset}),
 'Follow a direction onto an element':({end})=>({'12.5':C.focal*1000,'1':C.elementWidth*1000,'0.400':end.values.range*C.elementWidth/C.focal,'5':end.values.range}),
 'Come closer':({end})=>({'0.240':end.values.range*C.elementWidth/C.focal,'236.41':end.peak*1e6,'1.384':end.onset}),
 'Try a farther path':()=>({}),
 'Double the temperature difference':({end})=>({'167.66':end.peak*1e6,'3.206':end.onset}),
 'Stand still in a zone':({end})=>({'34.75':end.plus*1e9}),
 'Warm the whole view':()=>({}),
 'Run past':({end})=>({'60.13':end.peak*1e6}),
 'Match the room temperature':()=>({}),
 'Mismatch the two elements':({end})=>({'15.62':end.output*1e6,'12':end.time,'100':end.threshold*1e6}),
 'Creep through slowly':({end})=>({'12':end.time,'78.41':end.peak*1e6}),
 'Disconnect the supply':()=>({}),
},run,t,m);
for(const [index,trial]of lesson.tryIt.entries()){
 assert.deepEqual(Object.keys(trial.values),PIR_KEYS);assert.deepEqual(trial.initialState.settings,trial.values);t.add(2);
 t.ok(trial.reset&&trial.isolate&&trial.cutaway&&m.parts.some(p=>p.id===trial.part),'Prepared state has a real inspectable target');
 m.reset({settings:{...D,speed:0,power:0},time:3});m.reset(trial.initialState);assert.deepEqual(m.getState().values,trial.values);t.near(m.getState().time,0,0,'Each trial restores its own clock');
 for(const time of [0,.001,.05,.6,3,12]){
  m.reset({...trial.initialState,time});m.root.updateMatrixWorld(true);const s=m.getState(),scale=burglarRoomScale(pirSharedSettings(s.values));
  t.near(g.walker.position.x,s.x*scale,1e-12,'Scaled surface position x');t.near(g.walker.position.y,s.z*scale,1e-12,'Scaled path depth');t.near(g.walker.scale.x,scale,1e-12,'Uniform surface scale');
  t.ok(!g.radarHead.visible&&!g.beamPosts.visible&&!g.chair.visible&&!g.reference.visible,'No active hardware is shown');t.ok(g.pirHead.visible&&g.fanRoot.visible,'Thermal head and optical fields are shown');
  t.ok(g.outgoing.geometry.drawRange.count===0&&g.waveDots.every(o=>!o.visible),'No outgoing sensing beam');
  for(const id of ['return-reference','reference-power','reference-mixers','sensor-reference'])t.ok(g.paths.find(p=>p.id===id).objects.every(o=>!o.visible),'No active reference wiring remains visible');
  for(const route of g.paths)for(const [i,object]of route.objects.entries())if(object.visible){const actual=ends(object),a=g.wires.localToWorld(vector(route.points[i])),b=g.wires.localToWorld(vector(route.points[i+1]));t.ok(actual.some(p=>p.distanceTo(a)<1e-6)&&actual.some(p=>p.distanceTo(b)<1e-6),'Visible conductor reaches routed endpoints');}
  const blade=ends(g.blade),positive=g.contact.localToWorld(vector(g.positive)),contact=g.contact.localToWorld(vector(g.contactEnd));t.ok(blade.some(p=>p.distanceTo(positive)<1e-8),'Blade stays attached');t.ok(s.values.power?blade.some(p=>p.distanceTo(contact)<1e-8):blade.every(p=>p.distanceTo(contact)>.2),'Supply opening is physical');
  for(const [i,zone]of g.zones.entries()){const field=burglarZone(BURGLAR_LENSLETS[Math.floor(i/2)],i%2,s.values.range),p=zone.geometry.attributes.position;t.near(p.getX(1),field.x0*scale,2e-7,'Drawn field left boundary');t.near(p.getX(2),field.x1*scale,2e-7,'Drawn field right boundary');}
  for(const [i,line]of g.rayLines.entries()){const p=line.geometry.attributes.position,lenslet=BURGLAR_LENSLETS[i];t.near(p.getX(2),(lenslet-C.focal*(s.x-lenslet)/s.values.range)*g.opticalScale,2e-7,'Same optical mapping in ray drawing');t.near(p.getY(2),-C.focal*g.opticalScale,2e-7,'Common image plane');}
  const curve=g.recordCurve.geometry.attributes.position,last=g.recordCurve.geometry.drawRange.count-1;t.near(curve.getX(last),-2.25+4.5*s.time/s.duration,2e-7,'Observed trace ends at clock');t.ok(g.recordEvent.visible===(s.onset!==null),'Only observed alarm is marked');
  t.near(s.output,s.outputA-s.outputB,1e-18,'Element contributions explain differential output');t.ok(g.hornWaves.every(o=>o.visible===s.hornPulse),'Horn motion follows request');
  t.ok(s.readings.every(r=>!/(undefined|NaN|Infinity|microwave|Doppler|Optex|beam mode|sensing method)/i.test(r.value+' '+r.hint)),'Only finite passive readings');
  const before=structuredClone(s);for(const action of m.actions.filter(a=>a.label.startsWith('Inspect:'))){action.run();assert.deepEqual(m.getState(),before);t.add();}
  checkFinite(m.root,t);
 }
 const s=m.getState();t.ok(s.active===expected[index],'Experiment result matches its question');outcomes.push({title:trial.title,onset:s.onset,active:s.active,peak:s.peak,output:s.output});
 m.reset(trial.initialState);m.advance(12);m.reset(m.replayState());assert.deepEqual(m.getState().values,{...trial.values,sound:0});t.near(m.getState().time,0,0,'Replay restores prepared settings');
}

// Every exposed discrete value, including intermediate slider stops.
for(const control of m.controls){
 const values=control.options?.map(o=>o.value)??Array.from({length:Math.round((control.max-control.min)/control.step)+1},(_,i)=>Number((control.min+i*control.step).toFixed(6)));
 for(const value of values){m.reset();m.advance(.75);m.update({[control.key]:value});const s=m.getState();t.near(s.values[control.key],value,1e-12,'Exposed value is applied');t.near(s.time,['pace','sound'].includes(control.key)||value===D[control.key]?.75:0,1e-12,'Only changed physical settings restart');m.playback.step();checkFinite(m.root,t);controlCases.push({key:control.key,value});}
}
for(const range of [1,10])for(const speed of [0,.1,6])for(const contrast of [0,12])for(const power of [0,1]){m.reset({settings:{...D,range,speed,contrast,power},time:3});checkFinite(m.root,t);t.ok(m.scientificPlan().values.mode===2,'Boundary settings remain passive');}
m.reset();m.playback.step();t.near(m.getState().time,.05,1e-12,'50 ms step');m.actions.find(a=>a.label==='Advance one millisecond').run();t.near(m.getState().time,.051,1e-12,'1 ms fine step');m.update({pace:.25});m.playback.advance(1);t.near(m.getState().time,.301,1e-12,'Quarter pace');m.actions.find(a=>a.label==='Finish observation').run();t.ok(m.playback.complete(),'Finish reaches 12 s');
for(const bad of [{mode:0},{span:10},{path:1},{balance:2},{pace:.75}]){assert.throws(()=>m.update(bad));t.add();}
for(const bad of [null,[],{extra:1},{time:-1},{time:13},{settings:{mode:2}}]){assert.throws(()=>m.reset(bad));t.add();}
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' has geometry');
assert.equal(houseComponents['Passive infrared movement detector'],undefined);const registered=createSafetyModel('Passive infrared movement detector');t.ok(registered.root.name===m.root.name,'Whole detector factory is registered');registered.dispose();
const resources=checkDisposal(m,t),report={passed:true,checks:t.count,parts:m.parts.map(p=>p.id),catalogParts:m.catalogParts.map(p=>p.id),resources,outcomes,controlCases};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS passive infrared model: ${t.count} checks; ${report.parts.length} parts; ${outcomes.length} trials; ${controlCases.length} exposed values; ${resources} resources`);

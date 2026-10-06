import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createBurglarAlarmModel} from './burglar-alarm-model.js';
import {reviewedBurglarAlarmLesson as lesson} from './burglar-alarm-lesson.js';
import {BURGLAR_DEFAULTS as D,BURGLAR_SCIENCE as C,BURGLAR_LENSLETS,burglarAt,burglarPlan,burglarMotion,burglarRadar,burglarZone} from './burglar-alarm-physics.js';
import {burglarRoomScale} from './burglar-alarm-geometry.js';
import {tally,checkFinite,checkDisposal,checkTrialNumbers} from './model-check-kit.mjs';
const t=tally(),m=createBurglarAlarmModel(),g=m.topology,outcomes=[],controlCases=[];
const vector=p=>new THREE.Vector3(...p),ends=object=>[-1,1].map(sign=>object.localToWorld(vector([0,sign*object.geometry.parameters.height/2,0])));
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
const expectedAlarm=[true,true,true,false,false,true,false,true,false,false,true,true,true,false,false,false,false];
const run=values=>{const plan=burglarPlan(values);return {start:burglarAt(plan,0),moving:burglarAt(plan,.6),end:burglarAt(plan,plan.duration),plan};};
checkTrialNumbers(lesson,{
 'Walk toward the detector':({moving})=>({'1':moving.speed,'160.94':moving.doppler}),
 'Walk away':({moving})=>({'160.94':Math.abs(moving.doppler)}),
 'Double the radial speed':({moving})=>({'321.89':moving.doppler,'2':moving.length}),
 'Move without changing range':({moving})=>({'1':moving.speed}),
 'Keep the reflector still':()=>({}),
 'Cross in a straight line':()=>({}),
 'Motion without power':()=>({}),
 'Walk through a beam':({end})=>({'0.25':C.targetWidth,'250':end.blockedFor*1000,'1':end.values.speed,'50':end.values.hold}),
 'Wait longer before alarming':({end})=>({'250':end.blockedFor*1000}),
 'Run through quickly':({end})=>({'83.3':end.blockedFor*1000}),
 'Stand in the beam':({end})=>({'50':end.onset*1000}),
 'Bring the posts closer':({end})=>({'10.2':end.clearCurrent*1e9,'1.133':C.beamIntensity*C.beamResponse/30**2*1e9,'250':end.blockedFor*1000}),
 'Walk across thermal zones':()=>({'100':C.pirThreshold*1e6}),
 'Stand in a thermal zone':({end})=>({'34.75':end.plus*1e9}),
 'Remove thermal contrast':()=>({}),
 'Warm everything together':()=>({}),
 'Let the elements mismatch':({end})=>({'15.62':end.output*1e6,'12':end.time,'100':C.pirThreshold*1e6}),
},run,t,m);
for(const [index,trial]of lesson.tryIt.entries()){
 assert.deepEqual(Object.keys(trial.values),Object.keys(D));assert.deepEqual(trial.initialState.settings,trial.values);t.add(2);
 t.ok(trial.reset&&trial.isolate&&trial.cutaway&&m.parts.some(p=>p.id===trial.part),'Each trial prepares its own state and inspection');
 m.reset({settings:{...D,mode:1,speed:0,power:0},time:3});m.reset(trial.initialState);assert.deepEqual(m.getState().values,trial.values);t.add();
 const duration=m.duration(),times=[0,.001,.05,.6,Math.min(duration,1),duration];
 for(const time of times){
  m.reset({...trial.initialState,time});m.root.updateMatrixWorld(true);const s=m.getState(),scale=burglarRoomScale(s.values);
  const position=g.walker.position;t.near(position.x,s.values.mode===1?0:s.x*scale,1e-12,'Scaled target x');t.near(position.y,s.values.mode===1?2+s.x*scale:s.z*scale,1e-12,'Scaled target depth');
  t.near(g.walker.scale.x,scale,1e-12,'Uniform room scale');t.near(g.walker.scale.y,scale,1e-12,'Uniform width scale');t.near(g.walker.scale.z,scale,1e-12,'Uniform height scale');
  t.near(g.target.geometry.parameters.width,C.targetWidth,1e-12,'Physical target width');t.near(g.target.geometry.parameters.depth,C.targetHeight,1e-12,'Physical target height');
  for(const route of g.paths)for(const [i,object]of route.objects.entries()){
   const actual=ends(object),a=g.wires.localToWorld(vector(route.points[i])),b=g.wires.localToWorld(vector(route.points[i+1]));t.ok(actual.some(p=>p.distanceTo(a)<1e-6)&&actual.some(p=>p.distanceTo(b)<1e-6),'Conductors reach both routed endpoints');
  }
  const blade=ends(g.blade),a=g.contact.localToWorld(vector(g.positive)),b=g.contact.localToWorld(vector(g.contactEnd));t.ok(blade.some(p=>p.distanceTo(a)<1e-8),'Supply blade attached to positive');t.ok(s.values.power?blade.some(p=>p.distanceTo(b)<1e-8):blade.every(p=>p.distanceTo(b)>.2),'Open contact has a real visible gap');
  if(s.values.mode===0&&s.values.power){const p=g.outgoing.geometry.attributes.position;t.near(p.getX(2),s.x*scale,2e-7,'Echo guide meets target x');t.near(p.getY(2),s.z*scale,2e-7,'Echo guide meets target depth');}
  if(s.values.mode===1){const a=g.outgoing.geometry.attributes.position;for(const p of g.posts){const optic=p.optic.getWorldPosition(new THREE.Vector3());t.near(optic.z,.9*scale,1e-12,'Both beam optics share target-center height');}if(s.values.power)t.near(a.getX(1),s.blocked?-.001*scale:2.58,2e-7,'Beam stops at target or receiver');const half=g.crossingBody.geometry.parameters.height/2;t.ok(Math.abs(g.crossingBody.position.y)+half<1.58&&(Math.abs(g.crossingBody.position.y)<=half+1e-12)===s.blocked,'Crossing target stays clear of captions and intersects the ray exactly when blocked');}
  if(s.values.mode===2){
   for(const [i,zone]of g.zones.entries()){const field=burglarZone(BURGLAR_LENSLETS[Math.floor(i/2)],i%2,s.values.range),p=zone.geometry.attributes.position;t.near(p.getX(1),field.x0*scale,2e-7,'Drawn thermal field left edge');t.near(p.getX(2),field.x1*scale,2e-7,'Drawn thermal field right edge');}
   for(const [i,line]of g.rayLines.entries()){const p=line.geometry.attributes.position,s0=BURGLAR_LENSLETS[i],expected=(s0-C.focal*(s.x-s0)/s.values.range)*g.opticalScale;t.near(p.getX(2),expected,2e-7,'Image ray shares calculated focal plane');t.near(p.getY(2),-C.focal*g.opticalScale,2e-7,'Ray image plane depth');}
  }
  const curve=g.recordCurve.geometry.attributes.position,last=g.recordCurve.geometry.drawRange.count-1;t.near(curve.getX(last),-2.25+4.5*s.time/s.duration,2e-7,'Record stops at present clock');t.ok(g.recordEvent.visible===(s.onset!==null),'Alarm event appears only after observed');
  t.ok(g.hornWaves.every(o=>o.visible===s.hornPulse),'Sound motion matches powered alarm');
  const before=structuredClone(m.getState());for(const action of m.actions.filter(a=>a.label.startsWith('Inspect:'))){action.run();assert.deepEqual(m.getState(),before);t.add();}
  checkFinite(m.root,t);
 }
 const s=m.getState();t.ok(s.active===expectedAlarm[index],'Prepared experiment answers its question');outcomes.push({title:trial.title,duration:s.duration,onset:s.onset,active:s.active,output:s.output??s.current});
 m.reset(trial.initialState);m.advance(m.duration());m.reset(m.replayState());assert.deepEqual(m.getState().values,{...trial.values,sound:0});t.near(m.getState().time,0,0,'Completion replay restores own start');
}
for(const control of m.controls){
 const mode=['span','hold'].includes(control.key)?1:['contrast','warming','balance'].includes(control.key)?2:0;
 for(const value of control.options?.map(o=>o.value)??[control.min,control.initial,control.max]){
  m.reset({settings:{...D,mode}});m.advance(.75);const before=m.getState();m.update({[control.key]:value});const after=m.getState();
  t.near(after.values[control.key],value,1e-12,'Every declared option is usable');t.near(after.time,['pace','sound'].includes(control.key)||before.values[control.key]===value?.75:0,1e-12,'Only physical changes reset clock');
  m.playback.step();checkFinite(m.root,t);controlCases.push({key:control.key,value,mode:after.values.mode});
 }
}
for(const mode of [0,1,2])for(const range of [1,10])for(const speed of [0,6]){
 m.reset({settings:{...D,mode,range,speed}});m.advance(m.duration()/2);m.root.updateMatrixWorld(true);checkFinite(m.root,t);
 for(const [route,pin]of [[g.sensorPower,[-.48,-.70]],[g.sensorReturn,[.48,-.70]],[g.sensorSignal,[.16,-.70]],[g.sensorReference,[-.16,-.70]]]){const point=route.points[route===g.sensorPower||route===g.sensorReference?3:0],world=g.wires.localToWorld(vector(point));t.near(world.x,pin[0],1e-12,'Separate head pin x');t.near(world.y,pin[1],1e-12,'Head pin rear endpoint');t.near(world.z,.9*burglarRoomScale(m.getState().values),1e-12,'Head conductor follows scaled sensor height');}
}
m.reset();m.playback.step();t.near(m.getState().time,.05,1e-12,'Step advances 50 ms');m.actions.find(a=>a.label==='Advance one millisecond').run();t.near(m.getState().time,.051,1e-12,'Fine step advances 1 ms');m.update({pace:.25});m.playback.advance(1);t.near(m.getState().time,.301,1e-12,'Quarter pace preserves state and changes playback');m.actions.find(a=>a.label==='Finish observation').run();t.ok(m.playback.complete(),'Finish reaches endpoint');
for(const p of m.parts)t.ok(!new THREE.Box3().setFromObject(p.object).isEmpty(),p.id+' has physical or explanatory geometry');
const resources=checkDisposal(m,t),report={passed:true,checks:t.count,parts:m.parts.map(p=>p.id),resources,outcomes,controlCases};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS burglar alarm model: ${t.count} checks; ${report.parts.length} parts; ${outcomes.length} trials; ${controlCases.length} control options`);

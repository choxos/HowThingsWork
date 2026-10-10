import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createThreeAxisModel} from './three-axis-model.js';
import {threeAxisLesson as lesson} from './three-axis-lesson.js';
import {positioningDefaults, positioningDomains} from './three-axis-physics.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {createDailyLifeMachine} from './daily-life-models.js';
import {checkDisposal, tally} from './model-check-kit.mjs';

const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`),axes=['x','y','z'];
const model=createThreeAxisModel(),object=id=>model.parts.find(part=>part.id===id).object;
let poses=0,controlValues=0;const outcomes=[];
function geometry() {
  const s=model.getState();model.root.updateMatrixWorld(true);
  const nozzle=object('nozzle').localToWorld(new THREE.Vector3(0,-.95,0)),relative=object('bed').worldToLocal(nozzle.clone());
  near(relative.x/.1,s.position.x);near(relative.z/.1,s.position.y);near((relative.y-1)/.1,s.position.z);
  near(object('bed').position.z,-s.position.y*.1);near(object('x-carriage').position.x,s.position.x*.1);near(object('gantry').position.y,1+.95+s.position.z*.1);
  near(object('x-belt').userData.travel,s.drive.x*.1);near(object('y-belt').userData.travel,-s.position.y*.1);
  near(object('x-pulley-drive').rotation.z,-s.drive.x*.1/.12);near(object('y-pulley-drive').rotation.z,s.position.y*.1/.12);
  near(object('z-screw').rotation.y,(s.position.z-.2)*2*Math.PI/2);
  const pin=object('x-coupling-pin'),pinWorld=pin.getWorldPosition(new THREE.Vector3());near(pinWorld.x,s.drive.x*.1+.21);near(pin.position.x,-s.gap*.1);
  const clamp=pin.children[2].getWorldPosition(new THREE.Vector3());near(clamp.x,s.drive.x*.1+.21);near(clamp.y,object('gantry').position.y+.12);near(clamp.z,-.185);assert(pinWorld.y>object('gantry').position.y+.13+.035+.018,'The pin arm clears the upper guide rail');
  const coupling=object('x-coupling'),stops=coupling.children.filter(child=>child.isMesh);near(stops[0].position.x-.018,.018);near(stops[1].position.x+.018,-s.values.play*.1-.018);
  assert(coupling.position.y-.062>.13+.035&&Math.abs(clamp.z+.45)>.018+.035,'Slot and lowered belt clamp clear the guide rail');
  assert(pin.position.x>=-s.values.play*.1-1e-9&&pin.position.x<=1e-9);
  const target=object('target').position;near(target.x,s.requested.x*.1);near(target.y,1+s.requested.z*.1);near(target.z,s.requested.y*.1);
  near(object('target-projection').position.x,target.x);near(object('target-projection').position.z,target.z);near(object('target-height-guide').scale.y,s.requested.z*.1);
  const reached=s.distanceError<1e-9;for(const child of object('target').children)assert.equal(child.material.color.getHex(),reached?0x91aa7e:0xe3b45e);
  const path=object('coordinate-path').children[0].geometry.attributes.position,leg=s.plan.legs[s.leg];
  for(const [i,p]of [leg.from,leg.end].entries()){near(path.getX(i),p.x*.1,2e-7);near(path.getY(i),1+p.z*.1,2e-7);near(path.getZ(i),p.y*.1,2e-7);}
  const grid=object('step-grid'),gridLines=grid.children.filter(child=>child.isLine||child.isLineSegments),scale=3.2/(8*s.plan.pitch.x);
  const ticks=gridLines[0].geometry.attributes.position;for(let i=0;i<gridLines[0].geometry.drawRange.count;i+=2){const implied=ticks.getX(i)/scale+s.requested.x;near(implied/s.plan.pitch.x,Math.round(implied/s.plan.pitch.x),1e-5);}
  near(gridLines[1].geometry.attributes.position.getX(0),0);near(gridLines[2].geometry.attributes.position.getX(0),(leg.end.x-s.requested.x)*scale,1e-7);
  const chart=object('motion-profile').children.filter(child=>child.isLine),speedLine=chart[0].geometry.attributes.position,cursor=chart[2].geometry.attributes.position;
  for(let i=0;i<speedLine.count;i++){assert(speedLine.getY(i)>=-.450001&&speedLine.getY(i)<=.550001);near(speedLine.getX(i),-1.5+3*i/80,1e-7);}
  near(cursor.getX(0),-1.5+3*(leg.profile.time>0?(s.time-leg.startTime)/leg.profile.time:1),2e-7);
  assert.equal(s.extrudedVolume,0);assert.equal(s.filamentConsumed,0);assert.equal(s.temperature,25);near(s.supplySpan,42,1e-6);
  const [x0,x1]=[-1.9,1.9];assert(object('x-carriage').position.x-.29>x0&&object('x-carriage').position.x+.29<x1);
  assert(Math.abs(object('bed').position.z)+.275<2.3);assert(object('gantry').position.y-.16>.3&&object('gantry').position.y+.16<3.95);
  for(const row of s.readings)assert(!/NaN|Infinity|undefined/.test(String(row.value)));
  poses++;
}

assert.deepEqual(model.defaults,positioningDefaults);assert.deepEqual(model.controls.map(c=>c.key),Object.keys(positioningDomains));
assert(model.followParts.every(id=>model.parts.some(part=>part.id===id)));
for(const id of ['x-coupling','x-coupling-pin'])assert.equal(model.parts.find(part=>part.id===id).inspectionView,'back');
assert.equal(model.parts.find(part=>part.id==='y-motor').inspectionView,'back');
for(const id of ['y-drive','y-belt','y-pulley-drive']){assert.equal(model.parts.find(part=>part.id===id).inspectionView,'side');assert.deepEqual(model.partViewDirections[id].side,[-2.7,.15,0]);}
assert.equal(dailyLifeLessons['Three-axis positioning'],lesson);const routed=createDailyLifeMachine('Three-axis positioning');assert(routed.parts.some(p=>p.id==='x-coupling'));routed.dispose();
for(const trial of lesson.tryIt){
  model.reset();model.update(trial.values);assert.deepEqual(model.getState().position,{x:0,y:0,z:.2});assert.equal(model.getState().clock,0);assert(model.parts.some(p=>p.id===trial.part));geometry();
  const duration=model.getState().duration;
  for(let i=0;i<4;i++){model.advance(duration/2);geometry();}
  assert(model.playback.complete());assert(model.resultPart.available());outcomes.push({title:trial.title,position:model.getState().position,error:model.getState().error,duration});
}
near(outcomes[4].error.x*1000,8.84901332317689);near(outcomes[5].error.x*1000,-.57576463759279);near(outcomes[6].position.x,0);near(outcomes[7].position.x,.5);assert(outcomes[8].duration>outcomes[9].duration*2);
for(const control of model.controls){
  const choices=control.options?control.options.map(option=>option.value):Array.from({length:Math.round((control.max-control.min)/control.step)+1},(_,i)=>Number((control.min+i*control.step).toFixed(10)));
  for(const value of choices){model.reset();model.update({[control.key]:value});model.advance(1e4);geometry();controlValues++;}
  model.reset();model.update({[control.key]:NaN});assert.equal(model.getState().values[control.key],model.defaults[control.key]);
  model.update({[control.key]:control.min-1});assert.equal(model.getState().values[control.key],control.min);
  model.update({[control.key]:control.max+1});assert.equal(model.getState().values[control.key],control.max);
}
for(const x of [-10,10])for(const y of [-10,10])for(const z of [.2,10])for(const microsteps of [1,16])for(const play of [0,.5]){
  model.reset();model.update({targetX:x,targetY:y,targetZ:z,microsteps,play,roundTrip:1});const duration=model.getState().duration;model.advance(duration);geometry();model.advance(duration);geometry();
}
for(const key of ['targetX','targetY','targetZ','speed','acceleration']){
  model.reset();model.update({roundTrip:1,play:.5});model.advance(model.getState().duration*1.3);const before=model.getState();
  model.update({[key]:key==='targetX'?-8:key==='targetY'?-6:key==='targetZ'?2:key==='speed'?1:9});const after=model.getState();assert.deepEqual(after.position,before.position);assert.deepEqual(after.drive,before.drive);assert.equal(after.clock,0);geometry();model.advance(1e4);geometry();
}
for(const [key,value]of [['microsteps',1],['play',.5],['roundTrip',1]]){model.reset();model.advance(2);model.update({[key]:value});assert.deepEqual(model.getState().position,{x:0,y:0,z:.2});assert.equal(model.getState().clock,0);geometry();}
model.reset();for(const seconds of [-1,0,NaN,Infinity]){const before=model.getState();model.advance(seconds);assert.deepEqual(model.getState(),before);}
const frameStates=[];for(const fps of [24,60,144]){model.reset();for(let i=0;i<fps*3;i++)model.advance(1/fps);frameStates.push(model.getState());}for(const state of frameStates.slice(1)){assert.deepEqual(state.drive,frameStates[0].drive);assert.deepEqual(state.position,frameStates[0].position);near(state.time,frameStates[0].time);}
model.reset();model.update({roundTrip:1,play:.5});model.actions[1].run();const turn=model.getState();model.advance(.3);const slack=model.getState();assert(slack.drive.x<turn.drive.x);near(slack.position.x,turn.position.x);geometry();
for(const index of [2,3]){const before=model.getState();model.actions[index].run();assert.deepEqual(model.getState(),before);assert(model.inspectionObjects(model.actions[index].part).length===1);}
model.update({targetX:0,targetY:0,targetZ:.2,roundTrip:0,play:0});model.reset();model.update({targetX:0,targetY:0,targetZ:.2});assert(model.playback.complete());assert.match(model.getState().readings[0].value,/No move needed/);geometry();
const before=model.getState();assert.throws(()=>model.renderPositioning({position:{x:NaN,y:0,z:.2},target:{x:0,y:0,z:.2}}),RangeError);assert.deepEqual(model.getState(),before);
const released=checkDisposal(model,tally());
console.log(JSON.stringify({passed:true,presets:outcomes,poses,controlValues,released,checks:'Nozzle/plate coordinates, actual belt and screw rotations, physical slot/pin contact, target and diagram geometry, cold-state conservation, envelope, retargeting, mode resets, frame schedules and disposal'},null,2));

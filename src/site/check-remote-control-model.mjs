import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInfraredRemoteModel} from './remote-control-model.js';
import {infraredRemoteLesson as lesson} from './remote-control-lesson.js';
import {REMOTE_CONTROL_DEFAULTS as D,TV_INITIAL,REMOTE_KEYS} from './remote-control-physics.js';
import {studyLessons} from './study-lessons.js';
import {createStudyModel} from './study-models.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal,checkControlsMove} from './model-check-kit.mjs';

const t=tally(),m=createInfraredRemoteModel(),g=m.topology;
const near=(a,b,why,tolerance=1e-7)=>t.near(a,b,tolerance,why);
const points=line=>{const a=line.geometry.attributes.position,n=Math.min(a.count,line.geometry.drawRange.count);return Array.from({length:n},(_,i)=>[a.getX(i),a.getY(i),a.getZ(i)]);};
const distance=(a,b)=>new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));
assert.deepEqual(m.controls.find(c=>c.key==='address').options.map(o=>o.value),[55,56]);
for(const settings of [{command:1},{address:0},{address:255},{blocked:.5},{emitter:3},{carrier:39},{fault:2}]){
 const before=m.getState();assert.throws(()=>m.update(settings),RangeError);assert.deepEqual(m.getState(),before);
 assert.throws(()=>m.reset({settings}),RangeError);assert.deepEqual(m.getState(),before);t.add(4);
}

for(const [name,vertices] of Object.entries(g.wires)){
 const meshes=g.wireMeshes[name];t.ok(meshes.length===vertices.length-1,`${name}: every path segment has a conductor`);
 for(let i=0;i<meshes.length;i++){
  const mesh=meshes[i],length=mesh.geometry.parameters.height;
  const ends=[-length/2,length/2].map(y=>new THREE.Vector3(0,y,0).applyQuaternion(mesh.quaternion).add(mesh.position).toArray());
  near(Math.min(distance(ends[0],vertices[i])+distance(ends[1],vertices[i+1]),distance(ends[1],vertices[i])+distance(ends[0],vertices[i+1])),0,`${name}: conductor geometry reaches both intended terminals`);
 }
}
near(distance(g.wires.indicatorFeed.at(-1),g.indicatorPins.anode),0,'Indicator feed reaches anode');
near(distance(g.wires.indicatorReturn[0],g.indicatorPins.cathode),0,'Indicator return reaches separate cathode');
t.ok(distance(g.indicatorPins.anode,g.indicatorPins.cathode)>.08,'Indicator leads cannot share one external node');
const pins=new Set();
for(const [i,key] of g.keys.entries()){
 const route=g.keyRoutes[i];near(distance(route.input[0],key.contacts[0].position.toArray()),0,'Key input reaches left pad');near(distance(route.return[0],key.contacts[1].position.toArray()),0,'Key return reaches right pad');
 near(distance(route.input.at(-1),g.inputPins[i]),0,'Each key reaches its own input pin');pins.add(JSON.stringify(route.input.at(-1)));
 near(distance(route.return.at(-1),g.wires.ground[2]),0,'Each key shares the cell return');
 m.reset({settings:{command:key.code}});m.root.updateMatrixWorld(true);
 const released=new THREE.Box3().setFromObject(key.bridge),pads=key.contacts.map(c=>new THREE.Box3().setFromObject(c));
 t.ok(pads.every(p=>released.min.z>p.max.z+.06),'Released key cannot bridge contact pads');
 m.advance(.3);m.root.updateMatrixWorld(true);const pressed=new THREE.Box3().setFromObject(key.bridge);
 t.ok(pads.every(p=>pressed.intersectsBox(p)),'Selected pressed key physically bridges both pads');
 for(const other of g.keys.filter(k=>k!==key))near(other.body.position.z,other.rest.z,'Only selected key depresses');
}
t.ok(pins.size===7,'Seven distinct keys have seven distinct encoder inputs');
m.root.updateMatrixWorld(true);
for(const routes of g.keyRoutes)for(const path of Object.values(routes))for(let i=1;i<path.length;i++)for(const cell of g.cellBodies){
 const [a,b]=[path[i-1],path[i]].map(p=>cell.worldToLocal(g.board.localToWorld(new THREE.Vector3(...p)))),d=b.clone().sub(a),half=cell.geometry.parameters.height/2+.006;
 let lo=0,hi=1;
 if(Math.abs(d.y)<1e-12){if(Math.abs(a.y)>half)continue;}
 else{const ends=[(-half-a.y)/d.y,(half-a.y)/d.y].sort((x,y)=>x-y);lo=Math.max(lo,ends[0]);hi=Math.min(hi,ends[1]);if(lo>hi)continue;}
 const radialSpeed=d.x*d.x+d.z*d.z,time=radialSpeed?Math.max(lo,Math.min(hi,-(a.x*d.x+a.z*d.z)/radialSpeed)):lo;
 const radius=Math.hypot(a.x+time*d.x,a.z+time*d.z);
 t.ok(radius>=cell.geometry.parameters.radiusTop+.006,'Every signal/return trace clears the actual battery cylinder, including wire thickness');
}
for(const part of m.parts){const bounds=new THREE.Box3().setFromObject(part.object);t.ok(!bounds.isEmpty()&&bounds.min.toArray().every(Number.isFinite)&&bounds.max.toArray().every(Number.isFinite),`${part.id}: nonempty inspectable geometry`);}

let poses=0;const final=new Map();
for(const trial of lesson.tryIt){
 assert.deepEqual(trial.values,trial.initialState.settings);assert.deepEqual(Object.keys(trial.values),Object.keys(D));t.ok(m.parts.some(p=>p.id===trial.part),'Prepared trial has a real inspection target');
 m.reset(trial.initialState);const plan=m.physicalPlan();
 for(const time of [trial.initialState.time,.75,6,plan.run]){
  m.reset({...trial.initialState,time});m.root.updateMatrixWorld(true);const s=m.getState();poses++;
  near(g.blocker.position.y,s.values.blocked?-.30:-1.02,'Hand moves into or out of the direct path');t.ok(g.blocker.visible,'Hand remains inspectable outside the beam');
  const beam=points(g.beamLine),start=g.emitterLens.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.115,0,0));
  near(distance(beam[0],start.toArray()),0,'Visible beam starts at emitter tip');
  const lens=g.receiverLens.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-.10,0,0));
  near(beam.at(-1)[0],s.values.blocked?g.blocker.position.x:lens.x,'Beam ends at hand or receiver');
  near(g.television.position.x,.37+(trial.values.distance-5)*.022,'Whole receiving assembly moves with distance');
  t.ok(g.beamLine.visible===s.bursting&&g.currentMarkers.every(x=>x.visible===s.bursting),'Envelope markers follow burst state');
  assert.deepEqual(g.pictures.map(x=>x.visible),[1,2,3,4].map(channel=>s.tv.on&&s.tv.channel===channel));t.add();
  t.ok(g.volumeBars.every(x=>x.visible===s.tv.on),'Volume bars disappear with power off');
  t.ok(g.volumeText.userData.labelText===(s.tv.on?s.tv.muted?'MUTED':`VOLUME ${s.tv.volume}`:''),'Screen text follows volume, mute and power');
  t.ok(g.bits.every(({word},i)=>word.userData.labelText===String(plan.bits[i])),'Bit cells show the actual chronological word');
  near(points(g.signalCursor)[0][0],-2.25+4.5*s.physicalTime/plan.duration,'Code cursor follows the same physical clock');
  t.ok(s.readings.every(r=>r.label&&r.value&&r.hint&&!/NaN|undefined|Infinity/.test(r.value)),'All learner readings stay finite and explained');
  const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before,'Inspection preserves clock, controls, charge and TV result');t.add();}
  checkFinite(m.root,t);
 }
 final.set(trial.title,structuredClone(m.getState()));
}
const effects=new Map([['Change the channel',{channel:3}],['Previous channel',{channel:1}],['Turn the volume up',{volume:5}],['Turn the volume down',{volume:3}],['Mute the television',{muted:true}],['Switch the television off',{on:false}]]);
for(const [name,effect]of effects){assert.deepEqual(final.get(name).tv,{...TV_INITIAL,...effect});t.ok(final.get(name).accepted,'Each valid TV effect completes');}
for(const name of ['A code with no assigned key action','A message for another device','Corrupt one inverse bit','Use the wrong carrier','A hand in the beam','Move beyond the model range','Tired cells across the room']){assert.deepEqual(final.get(name).tv,TV_INITIAL);t.ok(!final.get(name).accepted,`${name}: TV unchanged`);}
for(const name of ['Move the receiver to 20 meters','Tired cells nearby'])t.ok(final.get(name).accepted,`${name}: enough model irradiance`);
m.reset(lesson.tryIt.find(x=>x.title==='An unfinished message').initialState);t.ok(m.getState().decodedCount>0&&!m.getState().validated&&m.getState().tv.channel===2,'Mid-frame trial starts partly decoded without changing the channel');
const snapshot=()=>({hand:g.blocker.position.toArray(),tv:g.television.position.toArray(),keys:g.keys.map(k=>[k.body.position.z,k.cap.material.color.getHex()]),bits:g.bits.map(k=>k.word.userData.labelText),led:points(g.ledCross),diode:points(g.diodeCross),carrier:points(g.carrierTrace),detector:g.photoResult.userData.labelText});
checkControlsMove(m,snapshot,model=>model.advance(.75),t);
for(const control of m.controls)for(const value of control.options?.map(o=>o.value)??[control.min,control.max]){m.reset();m.advance(1);m.update({[control.key]:value});const s=m.getState();near(s.values[control.key],value,'Model and UI agree on every offered value');near(s.time,value===D[control.key]?1:0,'Changed settings restart; unchanged settings preserve time');}
for(const key of REMOTE_KEYS){m.reset({settings:{command:key.value}});m.advance(100);const replay=m.replayState();m.reset(replay);t.ok(!m.getState().complete&&m.getState().values.command===key.value,'Replay preserves selected key and starts over');m.playback.step();near(m.getState().time,.5,'Step advances the visible clock');}
assert.equal(studyLessons['Remote control'],lesson);const routed=createStudyModel('Remote control');t.ok(routed.controls.length===9,'Whole-machine registry uses reviewed model');routed.dispose();
for(const name of ['Infrared signaling','Diode','Light-emitting diode','Photodiode'])t.ok(typeof houseComponents[name].createModel==='function','Separate child draft retains explicit independent factory');
const resources=checkDisposal(m,t);console.log(`PASS remote control model: ${t.count} checks, ${poses} poses, ${lesson.tryIt.length} causal presets, ${resources} resources`);

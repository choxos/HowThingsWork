import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {createWaterMeterModel} from './water-meter-model.js';
import {meterResponse,sampleWaterMeter,meterDigitPosition,METER_DEFAULTS as D} from './water-meter-physics.js';
import {waterMeterLesson as lesson} from './water-meter-lesson.js';
let checks=0,settings=0,geometryStates=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const near=(a,b,t=1e-9,message='quantity')=>ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${message}: ${a} vs ${b}`);
const oracle=(flow,size,bias)=>{const q1=size?2/3:25/96,start=size?.12:.06,u=Math.min(1,Math.max(0,(flow-start)/(q1-start)));return flow*u*u*(3-2*u)*(1+bias/100);};
for(const size of [0,1])for(const flow of [0,.005,.06,.09,.12,.2,25/96,.3,5/12,.5,2/3,16/15,3,6,125/3,52,625/12,60,200/3,80,250/3,90])for(const bias of [-4,-2,0,2,4]){
 const s=meterResponse(flow,size,bias);settings++;
 near(s.registered,oracle(flow,size,bias),1e-10,'independent chosen response');
 near(s.q1,size?2/3:25/96);near(s.q2,size?16/15:5/12);near(s.q3,size?200/3:125/3);near(s.q4,size?250/3:625/12);
 if(flow)near(s.error,s.registered/flow-1,1e-12,'signed relative error');else{assert.equal(s.error,null);checks++;}
 assert.equal(s.starWheel,s.turning);checks++;assert.equal(s.turning,s.registered>0);checks++;
 assert.equal(s.limit,flow<s.q1||flow>s.q4?null:flow<s.q2?.05:.02);checks++;
 near(s.drop,(size?.16:.25)*(flow/(size?200/3:125/3))**2,1e-12,'chosen pressure curve');
 near(s.registered+s.unregistered,flow,1e-11,'signed volume difference');
 if(s.limit!==null)assert.equal(s.withinBand,Math.abs(bias)<=100*s.limit);checks++;
}
assert.equal(meterResponse(.005).starWheel,false);assert.equal(meterResponse(.09,1).starWheel,false);assert.equal(meterResponse(.09,0).starWheel,true);checks+=3;
for(const [liters,place,position]of [[8,10,0],[9,10,0],[9.5,10,.5],[10,10,1],[90,100,0],[99,100,0],[99.5,100,.5],[100,100,1],[999.5,1000,.5],[1000,1000,1],[99.5,10,9.5],[999.5,10,99.5]])near(meterDigitPosition(liters,place),position,1e-12,'literal decimal carry table');
for(const duration of [20,1800,86400])for(const bias of [-2,0,2])for(const clock of [0,5,10,20]){
 const s=sampleWaterMeter({...D,duration,bias},clock),delivered=6*duration*clock/1200;
 near(s.deliveredVolume,delivered,1e-8);near(s.registeredVolume,delivered*(1+bias/100),1e-8);near(s.impellerTurns,40*s.registeredVolume,1e-8);near(s.indicatorTurns,2*s.registeredVolume,1e-8);assert.equal(s.complete,clock===20);checks++;
}
const m=createWaterMeterModel(),t=m.topology,MM=t.MM,TAU=2*Math.PI;
const literalDelivered=[1,1/6,1,1,1,0,7.2,2.7,2.7,9,2,2,2,20,20,270];
const literalRegistered=[1,1/6,1,1,1,0,0,.1633814247556408,0,9,2.04,1.96,2.08,20,20,270];
const literalDisplay=['0000001','0000000','0000010','0001000','0000000','0000000','0000000','0000000','0000000','0000009','0000002','0000001','0000002','0000020','0000020','0000270'];
const observations=[];
for(const [index,preset]of lesson.tryIt.entries()){
 const values=preset.values;assert.deepEqual(Object.keys(values).sort(),Object.keys(D).sort());checks++;ok(preset.reset&&preset.part==='system'&&preset.cutaway===true,'every preset fully prepares its comparison');
 for(const clock of [0,5,10,15,20]){
  m.reset();m.update(values);m.advance(clock);const s=m.getState(),volume=oracle(values.flow+values.leak,values.size,values.bias)*values.duration*clock/1200;geometryStates++;
  near(s.registeredVolume,volume,1e-9,'independent integrated registration');near(s.deliveredVolume,(values.flow+values.leak)*values.duration*clock/1200,1e-9);
  near(t.impeller.rotation.z,(40*volume%1)*TAU,1e-8);near(t.shaftB.rotation.y,(2*volume%1)*TAU,1e-8);near(t.pointerDrive.rotation.y,-(volume%1)*TAU,1e-8);near(t.counterDrive.rotation.y,(2*volume%1)*TAU,1e-8);near(t.counterWheel.rotation.x,-(volume/10%1)*TAU,1e-8);
  for(let i=0;i<7;i++)near(t.drums[i].rotation.x,-(s.positions[i]/10%1)*TAU,1e-8,'drawn rollers match decimal carry');
  for(let i=0;i<6;i++)near(t.transfers[i].rotation.x,(s.positions[i+1]/4%1)*TAU,1e-8,'transfer advances one quarter turn per digit');
  near(t.dial.rotation.y,0,0,'dial stays fixed');near(t.window.rotation.x,0,0,'register aperture stays fixed');
  ok(s.readings.every(r=>!/(?:NaN|Infinity|undefined)/.test(r.value)),'finite learner readings');
  m.root.updateMatrixWorld(true);
  const position=o=>o.getWorldPosition(new THREE.Vector3());
  near(position(t.spurB).distanceTo(position(t.spurC))/MM,21,1e-9,'20:40 centers match pitch radii');near(position(t.spurC).distanceTo(position(t.spurD))/MM,21,1e-9,'40:20 centers match pitch radii');
  near(position(t.worm1).distanceTo(position(t.wheel1))/MM,22.25,1e-9,'first worm center distance');near(position(t.worm2).distanceTo(position(t.wheel2))/MM,22.25,1e-9,'second worm center distance');
 }
 const end=m.getState();near(end.deliveredVolume,literalDelivered[index],1e-9,'published trial delivery');near(end.registeredVolume,literalRegistered[index],1e-9,'published trial registration');assert.equal(end.display,literalDisplay[index]);checks++;
 const held=JSON.stringify(end.readings);m.advance(50);ok(JSON.stringify(m.getState().readings)===held,'completion holds the result');m.update(values);ok(JSON.stringify(m.getState().readings)===held,'unchanged controls preserve result');
 for(const action of m.actions.filter(a=>a.group==='Look closer')){action.run();ok(JSON.stringify(m.getState().readings)===held,'inspection preserves result');}
 m.reset();m.update(values);for(const dt of [.13,.71,2.9,.005,7,9.255])m.advance(dt);near(m.getState().registeredVolume,literalRegistered[index],1e-9,'frame partition independent');
 observations.push({title:preset.title,delivered:end.deliveredVolume,registered:end.registeredVolume,display:end.display,rollovers:end.rollovers});
}
m.reset();m.update({flow:3,initial:9999999});m.advance(20);assert.equal(m.getState().rollovers,1);checks++;
m.reset();m.update({flow:0,leak:.005,duration:86400});m.advance(20);ok(m.getState().deliveredVolume===7.2&&m.getState().registeredVolume===0&&!m.getState().starWheel,'tiny leak stops the entire connected drive');
m.reset();m.update({flow:1e8,leak:-1,size:1.5,bias:NaN,duration:100,initial:4});assert.deepEqual(m.getState().values,{flow:80,leak:0,size:1,bias:0,duration:20,initial:0});checks++;
m.reset();m.advance(10);const held=m.getState().clock;for(const dt of [-1,NaN,Infinity,0])m.advance(dt);near(m.getState().clock,held,0,'invalid time ignored');m.update({bias:2});near(m.getState().clock,0,0,'changed control resets');m.reset();m.playback.step();near(m.getState().clock,.1,1e-12,'step advances');
// Actual bores in the chamber walls and pipes, with the moving rotor excluded.
m.reset();m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);
for(const [side,y]of [[-1,-13],[1,13]]){
 const ray=new THREE.Raycaster(new THREE.Vector3(side*70*MM,y*MM,-40*MM),new THREE.Vector3(-side,0,0),0,47*MM);
 ok(ray.intersectObjects([...t.pipeShells,...t.walls],false).length===0,'open inlet/outlet and chamber port');
 ray.ray.origin.z+=7*MM;ok(ray.intersectObjects(t.walls,false).length>0,'wall remains around port');
}
const bore=new THREE.Raycaster(new THREE.Vector3(0,0,-20*MM),new THREE.Vector3(0,0,-1),0,20*MM);ok(bore.intersectObject(t.wetCover,false).length===0,'shaft passes through a real cover bore');
ok(m.covers.includes(t.wetCover)&&!m.covers.includes(t.chamber),'cutaway retains chamber walls');
for(const [mesh,y,holes]of [[t.roof,150,[[-22.25,0],[-1.25,0],[-30,-22],[29,-22]]],[t.floor,40,[[-22.25,0],[-30,-22],[29,-22]]]]){
 for(const [x,z]of holes){const ray=new THREE.Raycaster(new THREE.Vector3(x*MM,y*MM,z*MM),new THREE.Vector3(0,-1,0));ok(ray.intersectObject(mesh,false).length===0,'casing plate clears its supported shaft');}
 const solid=new THREE.Raycaster(new THREE.Vector3(-50*MM,y*MM,0),new THREE.Vector3(0,-1,0));ok(solid.intersectObject(mesh,false).length>0,'casing remains solid between holes');
}

// Orthogonal worm axes and actual supports preserve a connected train.
const axis=(object,vector)=>vector.transformDirection(object.matrixWorld);
near(Math.abs(axis(t.worm1,new THREE.Vector3(0,0,1)).dot(axis(t.wheel1,new THREE.Vector3(0,1,0)))),0,1e-12,'first worm axes perpendicular');
near(Math.abs(axis(t.worm2,new THREE.Vector3(0,1,0)).dot(axis(t.wheel2,new THREE.Vector3(1,0,0)))),0,1e-12,'second worm axes perpendicular');
near(t.drums[0].position.x/MM,10);for(let i=1;i<7;i++)near((t.drums[i-1].position.x-t.drums[i].position.x)/MM,14,1e-12,'roller pitch gives real carry space');
const geometries=new Set(),materials=new Set(),textures=new Set(t.textures);
m.root.traverse(o=>{if(o.geometry){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))ok(Array.from(a.array).every(Number.isFinite),'finite geometry');}if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material]){materials.add(mat);if(mat.gradientMap)textures.add(mat.gradientMap);if(mat.map)textures.add(mat.map);}});
const resources=[...geometries,...materials,...textures];let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);m.dispose();m.dispose();near(disposed,resources.length,0,'resources including digit textures disposed once');
const report={result:'PASS',settings,trials:observations.length,geometryStates,checks,resources:resources.length,observations};if(process.env.EVIDENCE_FILE)writeFileSync(process.env.EVIDENCE_FILE,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,observations:undefined}));

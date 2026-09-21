import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {sampleNutcracker,NUTCRACKER_DOMAINS} from './nutcracker-physics.js';
import {createNutcrackerModel} from './nutcracker-model.js';
import {nutcrackerLesson as lesson} from './nutcracker-lesson.js';
const near=(a,b,tol=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,`${a} != ${b}`);
const limits=[2,0,0,0,1,1.9,2,1.6428571428571428,2,2,1.25,2,2,1.25,2,2,2,2];
let samples=0,integrals=0,poses=0,framedPoses=0,contactPoses=0;
for(const effort of [0,4,5,15,24,25,30,45,60])for(const arm of [10,14,20])for(const seat of [3.5,4.5,6])for(const stiffness of [20,40,80])for(const diameter of [24,30,36])for(const time of [0,.08,2,3.3,4,8]){
 const v={effort,arm,seat,stiffness,diameter},s=sampleNutcracker(v,time),a=seat/100,L=arm/100,D=diameter/1000,k=stiffness*1000,ratio=L/a,capacity=effort*ratio;
 const maximum=Math.min(.002,Math.max(0,(capacity-20)/k)),initial=Math.asin((D+.008)/(2*a)),final=Math.asin((D-maximum+.008)/(2*a)),angle=Math.max(final,initial-.01*time),q=Math.min(maximum,Math.max(0,D+.008-2*a*Math.sin(angle)));
 near(s.angle,angle);near(s.compression,q);near(s.maxCompression,maximum);near(s.mechanicalAdvantage,ratio);near(s.inputWork,20*q+.5*k*q*q);near(s.shellDeformationWork,s.inputWork);near(s.handTravelEach,ratio*q/2);near(s.handArcLengthEach,L*(initial-angle));near(s.totalHandTravel,ratio*q);near(s.actualForceEach*L*Math.cos(angle),s.jawCompression*a*Math.cos(angle));near(s.hingeReactionEach+s.actualForceEach,s.jawCompression);assert.ok(s.actualForceEach<=effort+1e-9);assert.equal(s.complete,time>=8);if(!s.cracked){near(s.jawGap,D-q);near(s.shellRemoval,0);near(s.jawWithdrawal,0);}else{near(s.actualForceEach,0);near(s.jawCompression,0);}samples++;
}
for(let i=0;i<lesson.tryIt.length;i++){
 const v=lesson.tryIt[i].values,s=sampleNutcracker(v,8);near(s.compression*1000,limits[i],1e-9);
 const n=4000,da=(s.initialAngle-s.angle)/n,L=v.arm/100,a=v.seat/100,k=v.stiffness*1000,D=v.diameter/1000;
 let work=0;for(let j=0;j<n;j++){const theta=s.initialAngle-(j+.5)*da,q=D+.008-2*a*Math.sin(theta),F=(20+k*q)*a/L;work+=2*F*L*Math.cos(theta)*da;}near(s.inputWork,work,2e-10);integrals++;
 for(const key of Object.keys(NUTCRACKER_DOMAINS))assert.ok(Object.hasOwn(v,key));assert.equal(lesson.tryIt[i].reset,true);assert.equal(lesson.tryIt[i].part,'system');
}
near(sampleNutcracker({},8).inputWork,.12);near(sampleNutcracker({effort:15},8).inputWork,.04);near(sampleNutcracker({stiffness:80,effort:45},8).inputWork,.2);
const short=sampleNutcracker({arm:10,effort:40},2),long=sampleNutcracker({arm:20,effort:20},2);near(short.actualForceEach,2*long.actualForceEach);near(long.handTravelEach,2*short.handTravelEach);near(long.inputWork,short.inputWork);
for(const [key,[lo,hi,step]] of Object.entries(NUTCRACKER_DOMAINS))for(const bad of [NaN,Infinity,lo-step,hi+step,lo+step/3])assert.throws(()=>sampleNutcracker({[key]:bad}));for(const bad of [null,[],{wrong:1}])assert.throws(()=>sampleNutcracker(bad));for(const bad of [-1,NaN,Infinity])assert.throws(()=>sampleNutcracker({},bad));
const m=createNutcrackerModel();
for(const trial of lesson.tryIt){m.reset();m.update(trial.values);for(let i=0;i<4;i++){m.actions[i].run();const s=m.getState(),ref=sampleNutcracker(trial.values,[0,2,6,8][i]);for(const [key,value] of Object.entries(ref))assert.deepEqual(s[key],value);assert.equal(s.readings.length,18);assert.ok(s.readings.every(r=>r.hint?.length>15));m.root.updateMatrixWorld(true);m.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});poses++;}}
const crackTime=(Math.asin(.038/.07)-Math.asin(.036/.07))/.01;m.reset();m.advance(crackTime-1e-7);assert.equal(m.getState().cracked,false);m.advance(2e-7);assert.equal(m.getState().cracked,true);m.reset();m.advance(crackTime+.25);near(m.getState().jawWithdrawal,0);near(m.getState().shellRemoval,0);m.advance(.75);near(m.getState().jawWithdrawal,1);near(m.getState().shellRemoval,0);m.advance(.375);near(m.getState().shellRemoval,.5);near(m.getState().inputWork,.12);
m.reset();m.playback.step();near(m.getState().elapsed,.08);m.advance(30);assert.equal(m.playback.complete(),true);assert.equal(m.resultPart.available(),true);m.reset();assert.equal(m.playback.complete(),false);assert.equal(m.resultPart.available(),false);m.actions[3].run();m.update({effort:0});near(m.getState().compression,0);assert.equal(m.getState().cracked,false);assert.equal(m.resultPart.available(),false);
m.root.position.set(3,-2,4);m.root.rotation.set(.3,-.6,.2);
for(const arm of [10,14,20])for(const seat of [3.5,6])for(const diameter of [24,36])for(const effort of [0,30,60])for(const t of [0,2,4,5,8]){
 m.reset();m.update({arm,seat,diameter,effort});m.advance(t);m.root.updateMatrixWorld(true);const bounds=m.frameBoundsForPart('system');
 for(const object of [m.topology.handles,m.topology.hinge,m.topology.jaws])object.traverse(o=>{if(!o.geometry||!o.visible)return;const points=o.geometry.attributes.position;for(let i=0;i<points.count;i++)assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld)),'Framing contains both full moving handles and the hinge');});framedPoses++;
}
assert.equal(m.frameBoundsForPart('kernel'),null);
for(const trial of lesson.tryIt)for(const time of [0,2,3,8]){
 m.reset();m.update(trial.values);m.advance(time);const held=m.getState();
 for(const action of m.actions.slice(4)){assert.equal(action.replay,false);action.run();assert.deepEqual(m.getState(),held);}
 const {nut,jaws,bosses,shellMeshes,scale}=m.topology,detail=m.frameBoundsForPart('nut');
 for(const object of [nut,jaws])object.traverse(o=>{if(o.geometry){const points=o.geometry.attributes.position;for(let i=0;i<points.count;i++)assert.ok(detail.containsPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld)));}});
 if(!held.cracked){const points=shellMeshes[0].geometry.attributes.position;let top=-Infinity,bottom=Infinity;for(let i=0;i<points.count;i++){top=Math.max(top,points.getY(i));bottom=Math.min(bottom,points.getY(i));}near(bosses[0].position.y-.004*scale,top,1e-7);near(bosses[1].position.y+.004*scale,bottom,1e-7);near(nut.position.x,bosses[0].position.x);near(nut.position.x,bosses[1].position.x);contactPoses++;}
}
assert.deepEqual(m.catalogParts.map(p=>p.id),['hinge','handles','jaws','shell','kernel']);assert.equal(m.topology.forceGuide.userData.explosionExcluded,true);assert.ok(m.topology.levers.every(l=>l.handDot.userData.explosionExcluded));
const resources=new Set();m.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(mat);if(mat.gradientMap)resources.add(mat.gradientMap);}});const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));m.dispose();m.dispose();assert.ok([...counts.values()].every(n=>n===1));
const result={passed:true,samples,integrals,poses,framedPoses,contactPoses,presets:lesson.tryIt.length,resources:resources.size,crackTime,finalCompressionMillimeters:limits,anchors:['independent force-limit solution','two actual hand-force integrals','paired torque balance','partial stalls and exact cracking boundary','separate manual inspection stages','preset resampling and reset','finite full geometry','full-handle framing','resource disposal']};await writeFile(new URL('../../documentation/audit/evidence/nutcracker/model-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

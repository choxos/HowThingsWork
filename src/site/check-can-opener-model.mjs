import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {sampleCanOpener,CAN_OPENER_DOMAINS} from './can-opener-physics.js';
import {createCanOpenerModel} from './can-opener-model.js';
import {canOpenerLesson as lesson} from './can-opener-lesson.js';
const near=(a,b,tol=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,`${a} != ${b}`);
let samples=0,poses=0;
// Independent force balance and circumference/work anchors, including the two equality boundaries.
for(const clamp of [0,1])for(const normal of [0,20,40,80,120,160])for(const effort of [0,1,2,3,4,6,12])for(const arm of [2,4,5,7,8])for(const edge of [0,1])for(const diameter of [50,80,120])for(const t of [0,.16,4,8,12,16]){
 const v={clamp,normal,effort,arm,edge,diameter},s=sampleCanOpener(v,t),load=edge?28:12,grip=clamp*.35*normal,capacity=effort*arm;
 const operation=!clamp?'open':!effort||capacity+1e-10<Math.min(load,grip)?'stall':grip+1e-10<load?'slip':'cutting';
 const turns=effort&&operation!=='stall'?.5*(operation==='cutting'?Math.min(t,diameter/10):t):0;
 const length=operation==='cutting'?Math.min(Math.PI*diameter/1000,turns*2*Math.PI*.01):0;
 assert.equal(s.operation,operation);near(s.crankTurns,turns);near(s.cutLength,length);near(s.canAngle,length/(diameter/2000));near(s.driverAngle,2*Math.PI*turns);near(s.feedAngle,clamp?-s.driverAngle:0);near(s.cutterAngle,s.driverAngle);
 near(s.driveForceAvailable,capacity);near(s.tractionCapacity,grip);near(s.workInput,s.cuttingWork+s.slidingWork);near(s.cuttingWork,load*length);near(s.slidingWork,operation==='slip'?grip*turns*2*Math.PI*.01:0);
 assert.equal(s.lidReleased,operation==='cutting'&&t>=diameter/10);assert.equal(s.complete,t>=16);if(s.moving)assert.ok(s.actualHandForce<=effort+1e-10);if(!s.lidReleased)near(s.lidLift,0);samples++;
}
near(sampleCanOpener({},16).workInput,12*Math.PI*.08);near(sampleCanOpener({arm:8},4).actualHandForce,1.5);near(sampleCanOpener({arm:8},16).workInput,sampleCanOpener({},16).workInput);
for(const values of [{effort:3,arm:4},{edge:1,arm:7}])assert.equal(sampleCanOpener(values,16).mode,'released');
for(const [key,[lo,hi,step]] of Object.entries(CAN_OPENER_DOMAINS))for(const bad of [NaN,Infinity,lo-step,hi+step,lo+step/3])assert.throws(()=>sampleCanOpener({[key]:bad}));for(const bad of [null,[],{wrong:1}])assert.throws(()=>sampleCanOpener(bad));for(const bad of [-1,NaN,Infinity])assert.throws(()=>sampleCanOpener({},bad));
const m=createCanOpenerModel(),p=m.topology,pos=o=>o.getWorldPosition(new THREE.Vector3());
for(const trial of lesson.tryIt){
 m.reset();m.update(trial.values);
 for(let i=0;i<4;i++){
  m.actions[i].run();const s=m.getState();assert.deepEqual(s.values,trial.values);assert.equal(s.readings.length,16);assert.ok(s.readings.every(r=>r.hint?.length>15));assert.ok(!s.readings.some(r=>/residual|Mechanism state|Trial progress/.test(r.label)));near(s.elapsed,[0,4,12,16][i]);m.root.updateMatrixWorld(true);
  near(p.driverGear.rotation.z,s.driverAngle);near(p.drivenGear.rotation.z,s.feedAngle);near(p.feed.rotation.z,s.feedAngle);near(p.cutter.rotation.z,s.cutterAngle);near(p.can.rotation.y,s.canAngle);
  const gap=pos(p.driverGear).distanceTo(pos(p.drivenGear));if(s.clamped&&!s.openerWithdrawal)near(gap,.62);else if(!s.clamped||s.openerWithdrawal===1)assert.ok(gap>.74);
  near(pos(p.feed).distanceTo(pos(p.drivenGear)),.23);near(pos(p.cutter).distanceTo(pos(p.driverGear)),.34);
  const withdrawal=s.clamped?s.openerWithdrawal:1;near(p.head.position.z,s.canRadius*30+.12*withdrawal);near(p.head.position.y,.18*withdrawal);near(p.grip.position.x,s.armRadius*30);assert.equal(p.cutterFaces[trial.values.edge].visible,true);assert.equal(p.cutterFaces[1-trial.values.edge].visible,false);
  assert.equal(p.metalBridge.visible,!s.lidReleased);assert.equal(p.cutLine.visible,s.cutLength>0);near(p.lid.position.y,.68*s.lidLift);
  m.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});poses++;
 }
}
// Use the actual extruded outlines, rather than pitch circles or stock tooth boxes.
m.reset();m.root.rotation.set(0,0,0);
const profile=p.driverMesh.children[0].geometry.parameters.shapes.getPoints();assert.equal(p.driverMesh.userData.toothCount,20);assert.equal(p.drivenMesh.userData.toothCount,20);
const transform=(angle,y)=>profile.map(v=>({x:v.x*Math.cos(angle)-v.y*Math.sin(angle),y:v.x*Math.sin(angle)+v.y*Math.cos(angle)+y}));
const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const edges=poly=>poly.slice(0,-1).map((a,i)=>[a,poly[i+1]]).filter(([a,b])=>Math.max(a.y,b.y)>=-.061001&&Math.min(a.y,b.y)<=.001001);
let gearPhases=0;
for(let i=0;i<=64;i++){
 const angle=i*2*Math.PI/20/64,A=edges(transform(angle,.28)),B=edges(transform(-angle+Math.PI/20,-.34));
 for(const [a,b] of A)for(const [c,d] of B)assert.ok(!(area(a,b,c)*area(a,b,d)<-1e-18&&area(c,d,a)*area(c,d,b)<-1e-18),'Actual gear outlines intersect');gearPhases++;
}
// The annulus joins the lid top, and the open head withdraws both cutting and feeding surfaces.
const bridge=p.metalBridge.geometry.attributes.position.array;for(let i=0;i<bridge.length;i+=18){near(bridge[i+1],-.0125,1e-8);near(bridge[i+4],0);near(bridge[i+10],-.0125,1e-8);near(bridge[i+16],-.0125,1e-8);}
for(const edge of [0,1]){
 m.reset();m.update({edge});m.root.updateMatrixWorld(true);
 const feedBox=new THREE.Box3().setFromObject(p.feedMesh),cutterCenter=pos(p.cutter),feedCenter=pos(p.feed);near(feedCenter.z-m.getState().canRadius*30,.07);
 const toothEnvelope=Math.hypot(.291+.018,.025/2),minCutterRadius=.62-toothEnvelope,points=p.cutterFaces[edge].geometry.parameters.points;
 const shoulder=points[1],tip=points[2],maxHalfWidth=-tip.y+(tip.x-minCutterRadius)/(tip.x-shoulder.x)*(-shoulder.y+tip.y),clearance=feedCenter.z-.145/2-(cutterCenter.z+maxHalfWidth);
 assert.ok(clearance>.01,'Working wheel axial clearance');assert.ok(feedBox.min.z>=m.getState().canRadius*30-1e-8,'Feed body clears can wall');
 m.update({clamp:0});m.root.updateMatrixWorld(true);const cutterBox=new THREE.Box3().setFromObject(p.cutterFaces[edge]);assert.ok(cutterBox.min.y>0);const openFeed=new THREE.Box3().setFromObject(p.feedMesh);assert.ok(openFeed.min.z>m.getState().canRadius*30+.025);
}
m.reset();m.advance(8-1e-7);assert.equal(m.getState().lidReleased,false);assert.equal(p.metalBridge.visible,true);m.advance(1e-7);assert.equal(m.getState().lidReleased,true);assert.equal(p.metalBridge.visible,false);m.advance(.25);near(m.getState().openerWithdrawal,1);near(m.getState().lidLift,0);m.advance(.25);near(m.getState().lidLift,7/27);
m.reset();m.playback.step();near(m.getState().elapsed,.16);m.advance(30);assert.equal(m.playback.complete(),true);m.reset();assert.equal(m.playback.complete(),false);near(m.getState().cutLength,0);
m.actions[3].run();m.update({effort:0});assert.equal(m.getState().mode,'stall');near(m.getState().cutLength,0);assert.equal(m.resultPart.available(),false);
let framedPoses=0;m.root.position.set(4,-3,2);m.root.rotation.set(.35,-.5,0);
for(const diameter of [50,120])for(const arm of [2,8])for(const effort of [0,12])for(const clamp of [0,1])for(const t of [0,.16,.48,.8,.96,1.12,1.6,diameter/10+.125,diameter/10+.5,diameter/10+1]){
 m.reset();m.update({diameter,arm,effort,clamp});m.advance(t);m.root.updateMatrixWorld(true);const bounds=m.frameBoundsForPart('system');
 p.crank.traverse(o=>{if(!o.geometry||!o.visible)return;const points=o.geometry.attributes.position;for(let i=0;i<points.count;i++)assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld)),'Framing must contain the actual crank sweep');});framedPoses++;
}
assert.equal(m.frameBoundsForPart('lid'),null);
assert.equal(m.catalogParts.length,11);assert.ok([p.forceGuide,p.handArrow,...p.clampArrows,p.cutArrow,p.status].every(o=>o.userData.explosionExcluded));assert.deepEqual(p.labels.map(o=>o.userData.labelText),['Rim force · 0 to 100 N','Drive limit','Grip limit','Cut load']);
m.reset();m.update({normal:0,effort:0});assert.equal(p.bars[0].visible,false);assert.equal(p.bars[1].visible,false);assert.equal(p.bars[2].visible,true);
const resources=new Set();m.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(mat);if(mat.gradientMap)resources.add(mat.gradientMap);if(mat.map)resources.add(mat.map);}});const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));m.dispose();m.dispose();assert.ok([...counts.values()].every(n=>n===1));
const result={passed:true,samples,poses,gearPhases,framedPoses,presets:lesson.tryIt.length,resources:resources.size,anchors:['force and traction boundaries','zero force and open clamp','equal opposite gears with connected shafts','rim travel and full circumference','remaining metal connection','manual inspection lift','actual force and work balance','preset reset and deterministic resampling','finite geometry and resource disposal']};await writeFile(new URL('../../documentation/audit/evidence/can-opener/model-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

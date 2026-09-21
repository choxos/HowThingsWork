import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {sampleBottleOpener,BOTTLE_OPENER_DOMAINS} from './bottle-opener-physics.js';
import {createBottleOpenerModel} from './bottle-opener-model.js';
import {bottleOpenerLesson as lesson} from './bottle-opener-lesson.js';
const near=(a,b,tol=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,`${a} != ${b}`);
// Independent solution in hook displacement, with an analytic inverse for the lever angle.
const angleAt=q=>Math.atan2(.004,.027)+Math.asin((q-.004)/Math.hypot(.027,.004));
const releaseAngle=angleAt(.003),releaseTime=releaseAngle/.035;
function reference(v,t){
 const alpha=v.direction*Math.PI/180,L=v.arm/100,k=v.stiffness*1000;
 const force=q=>{const a=angleAt(q),moment=L*Math.cos(a+alpha);return moment>1e-12?(20+k*q)*(.027*Math.cos(a)+.004*Math.sin(a))/moment:Infinity;};
 let qmax=.003;if(v.effort<force(0))qmax=0;else if(v.effort<force(.003)){let lo=0,hi=.003;for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(force(mid)>v.effort)hi=mid;else lo=mid;}qmax=(lo+hi)/2;}
 const a=v.placement?v.effort>0&&v.direction<90?Math.min(.035*t,.28,Math.PI/2-alpha):0:Math.min(.035*t,angleAt(qmax));
 const q=v.placement?0:Math.min(qmax,.027*Math.sin(a)+.004*(1-Math.cos(a)));
 const released=!v.placement&&qmax===.003&&t>=releaseTime;
 const mode=v.placement?'missed':released?'released':qmax<.003&&t>=angleAt(qmax)/.035?'stall':'lifting';
 return {qmax,a,q,force,mode,released,work:20*q+.5*k*q*q};
}
let samples=0,integrals=0;
for(const placement of [0,1])for(const effort of [0,4,8,12,13,16,20,30])for(const arm of [5,10,12,20])for(const direction of [0,15,30,45,60,75,90])for(const stiffness of [4,12,20])for(const t of [0,.08,2,3.2,4.2,8]){
 const v={placement,effort,arm,direction,stiffness},s=sampleBottleOpener(v,t),r=reference(v,t);
 near(s.releaseAngle,releaseAngle);near(s.angle,r.a);near(s.hookLift,r.q);assert.equal(s.mode,r.mode);assert.equal(s.released,r.released);near(s.inputWork,r.work);near(s.capWork,r.work);near(s.handTravel,arm/100*r.a);assert.equal(s.complete,t>=8);
 if(Number.isFinite(r.force(.003)))near(s.peakRequiredHandForce,r.force(.003));else assert.equal(s.peakRequiredHandForce,null);
 assert.ok(s.actualHandForce<=effort+1e-9);near(s.supportHorizontal+s.actualHandForce*Math.sin(s.direction),0);near(s.supportVertical+s.actualHandForce*Math.cos(s.direction)-s.hookForce,0);
 if(s.engaged&&!s.released)near(s.hookForce*s.hookX,s.actualHandForce*Math.max(0,arm/100*Math.cos(s.angle+s.direction)));else near(s.hookForce,0);
 if(!s.released){near(s.openerWithdrawal,0);near(s.capRemoval,0);}samples++;
}
// Integrate actual F dot ds, independently of the production work expression.
for(const p of lesson.tryIt){
 const s=sampleBottleOpener(p.values,8);if(p.values.placement||!s.angle)continue;
 const n=4000,da=s.angle/n,L=p.values.arm/100,alpha=p.values.direction*Math.PI/180,k=p.values.stiffness*1000;
 let work=0;for(let i=0;i<n;i++){const a=(i+.5)*da,q=.027*Math.sin(a)+.004*(1-Math.cos(a)),R=20+k*q,F=R*(.027*Math.cos(a)+.004*Math.sin(a))/(L*Math.cos(a+alpha));work+=F*L*Math.cos(a+alpha)*da;}
 near(s.inputWork,work,2e-10);integrals++;
}
const finalLifts=[3,0,0,1.275748257418957,2.712746291662297,3,.7918065510463929,3,3,3,1.076047838386165,0,3,2.5074228778020573,3,0,3];
for(let i=0;i<lesson.tryIt.length;i++)near(sampleBottleOpener(lesson.tryIt[i].values,8).hookLift*1000,finalLifts[i],1e-9);
near(sampleBottleOpener({},8).capWork,.114);near(sampleBottleOpener({stiffness:4},8).capWork,.078);near(sampleBottleOpener({stiffness:20,effort:20},8).capWork,.15);
const short=sampleBottleOpener({arm:10},2),long=sampleBottleOpener({arm:20,effort:8},2);near(short.actualHandForce,2*long.actualHandForce);near(long.handTravel,2*short.handTravel);near(short.capWork,long.capWork);
for(const [key,[lo,hi,step]] of Object.entries(BOTTLE_OPENER_DOMAINS))for(const bad of [NaN,Infinity,lo-step,hi+step,lo+step/3])assert.throws(()=>sampleBottleOpener({[key]:bad}));for(const bad of [null,[],{wrong:1}])assert.throws(()=>sampleBottleOpener(bad));for(const bad of [-1,NaN,Infinity])assert.throws(()=>sampleBottleOpener({},bad));
const m=createBottleOpenerModel();let poses=0;
for(const trial of lesson.tryIt){m.reset();m.update(trial.values);for(let i=0;i<4;i++){m.actions[i].run();const s=m.getState(),r=reference(trial.values,[0,2,6,8][i]);assert.deepEqual(s.values,trial.values);assert.equal(s.readings.length,17);assert.ok(s.readings.every(r=>r.hint?.length>15));near(s.elapsed,[0,2,6,8][i]);near(s.angle,r.a);near(s.hookLift,r.q);m.root.updateMatrixWorld(true);m.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});poses++;}}
m.reset();m.advance(releaseTime-1e-7);assert.equal(m.getState().released,false);m.advance(2e-7);assert.equal(m.getState().released,true);m.reset();m.advance(releaseTime+.25);near(m.getState().openerWithdrawal,1);near(m.getState().capRemoval,0);m.advance(.25);near(m.getState().capRemoval,7/27);
m.reset();m.playback.step();near(m.getState().elapsed,.08);m.advance(30);assert.equal(m.playback.complete(),true);m.reset();assert.equal(m.playback.complete(),false);near(m.getState().hookLift,0);m.actions[3].run();m.update({effort:0});assert.equal(m.getState().mode,'stall');near(m.getState().hookLift,0);assert.equal(m.resultPart.available(),false);
// The modeled force points must lie on the actual rendered contacting surfaces.
function surfaceDistance(mesh,world){
 const point=mesh.worldToLocal(world.clone()),positions=mesh.geometry.attributes.position,index=mesh.geometry.index,triangle=new THREE.Triangle(),nearest=new THREE.Vector3();let distance=Infinity;
 for(let i=0;i<(index?index.count:positions.count);i+=3){for(const [j,key] of ['a','b','c'].entries())triangle[key].fromBufferAttribute(positions,index?index.getX(i+j):i+j);triangle.closestPointToPoint(point,nearest);distance=Math.min(distance,nearest.distanceTo(point));}return distance;
}
let contactPoses=0,maxHookContactGap=0,maxSupportContactGap=0;m.reset();m.update({effort:30,arm:20});
for(let i=0;i<=256;i++){
 m.reset();m.update({effort:30,arm:20});m.advance((releaseTime-1e-7)*i/256);m.root.updateMatrixWorld(true);const p=m.topology;
 const hook=p.lever.localToWorld(new THREE.Vector3(.81,-.12,0)),support=p.support.localToWorld(new THREE.Vector3());
 const hookGap=surfaceDistance(p.crownMesh,hook),supportGap=surfaceDistance(p.roof,support);maxHookContactGap=Math.max(maxHookContactGap,hookGap);maxSupportContactGap=Math.max(maxSupportContactGap,supportGap);assert.ok(hookGap<1e-7,'Nominal hook force point remains on the connected crown');assert.ok(supportGap<1e-7,'Fulcrum remains on the crown top');contactPoses++;
}
let framedPoses=0;m.root.position.set(3,-2,4);m.root.rotation.set(.3,-.6,.2);
for(const arm of [5,12,20])for(const placement of [0,1])for(const direction of [0,75,90])for(const effort of [0,30])for(const t of [0,1,2,3.2,3.3,3.6,4.2,8]){
 m.reset();m.update({arm,placement,direction,effort});m.advance(t);m.root.updateMatrixWorld(true);const bounds=m.frameBoundsForPart('system');
 m.topology.opener.traverse(o=>{if(!o.geometry||!o.visible)return;const points=o.geometry.attributes.position;for(let i=0;i<points.count;i++)assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld)),'Framing contains the complete moving opener');});framedPoses++;
}
assert.equal(m.frameBoundsForPart('cap'),null);
m.reset();m.update({effort:8});m.actions[3].run();const beforeInspect=m.getState();m.actions[4].run();assert.deepEqual(m.getState(),beforeInspect);m.actions[5].run();assert.deepEqual(m.getState(),beforeInspect);
assert.equal(m.actions[4].part,'hook');assert.equal(m.actions[5].part,'system');assert.equal(m.catalogParts.length,8);assert.equal(m.topology.forceGuide.userData.explosionExcluded,true);
for(const placement of [0,1])for(const effort of [0,8,30])for(const time of [0,2,8]){m.reset();m.update({placement,effort});m.advance(time);const bounds=m.frameBoundsForPart('hook');for(const part of [m.topology.cap,m.topology.bead,m.topology.support,m.topology.hook])assert.ok(bounds.containsBox(new THREE.Box3().setFromObject(part)),'Contact inspection contains the actual surfaces');}

const resources=new Set();m.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(mat);if(mat.gradientMap)resources.add(mat.gradientMap);}});const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));m.dispose();m.dispose();assert.ok([...counts.values()].every(n=>n===1));
const result={passed:true,samples,integrals,poses,contactPoses,maxHookContactGap,maxSupportContactGap,framedPoses,presets:lesson.tryIt.length,resources:resources.size,releaseAngleDegrees:releaseAngle*180/Math.PI,releaseTime,finalLifts,anchors:['independent displacement solution','partial stalls and release','oblique effort and reaction balance','actual hand-work quadrature','force-travel tradeoff','missed contact and zero force','preset reset and deterministic resampling','finite geometry and resource disposal']};await writeFile(new URL('../../documentation/audit/evidence/bottle-opener/model-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

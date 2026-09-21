import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {ROBERVAL_BALANCE_DEFAULTS as defaults,sampleRobervalBalance as sample,robervalBalanceGeometry as geometry} from './roberval-balance-physics.js';
import {createRobervalBalanceModel} from './roberval-balance-model.js';
import {robervalBalanceLesson as lesson} from './roberval-balance-lesson.js';
const near=(a,b,tol=2e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} != ${b}`);
const vector=(a,b,tol=2e-8)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>near(x,b[i],tol));};
const anchors=JSON.parse(await readFile(new URL('../../documentation/audit/evidence/roberval-balance/independent-review/preset-anchors.json',import.meta.url),'utf8')).cases;
const a=.45,h=.35,e=.30,J=.03375,c=.8;
let controlTrials=0,referenceSamples=0,geometryPoses=0,eventBoundaries=0,renderedStates=0;
function verify(s,v){
 const g=[9.81,1.62][v.gravity],I=J+a*a*(v.leftMass+v.rightMass),q=s.angle,w=s.speed,alpha=s.acceleration;
 near(s.inertia,I);near(s.gravity,g);near(s.gravityTorque,g*a*(v.leftMass-v.rightMass)*Math.cos(q));near(s.damperTorque,-c*w);
 near(I*alpha,s.gravityTorque-c*w+s.stopTorque);near(s.kineticEnergy,.5*I*w*w);near(s.potentialEnergy,g*a*(v.rightMass-v.leftMass)*(Math.sin(q)-Math.sin(v.initialAngle)));
 near(s.kineticEnergy+s.potentialEnergy+s.damperHeat+s.impactHeat,0);near(s.energyResidual,0);near(s.torqueResidual,0);assert.ok(s.damperHeat>=0&&s.impactHeat>=0);
 assert.ok(q>=-.2-1e-12&&q<=.2+1e-12);assert.equal(s.neutralBalance,v.leftMass===v.rightMass);
 for(const [key,sigma] of [['left',-1],['right',1]]){
  const side=s[key],m=v[key+'Mass'],delta=v[key+'Offset'],ax=sigma*a*(-Math.cos(q)*w*w-Math.sin(q)*alpha),ay=sigma*a*(-Math.sin(q)*w*w+Math.cos(q)*alpha),fx=m*ax,N=m*(g+ay),C=delta*N-e*fx;
  vector(side.top,[sigma*a*Math.cos(q),h/2+sigma*a*Math.sin(q),0]);vector(side.bottom,[sigma*a*Math.cos(q),-h/2+sigma*a*Math.sin(q),0]);vector(side.payload,[sigma*a*Math.cos(q)+delta,sigma*a*Math.sin(q)+e,0]);
  vector(side.acceleration,[ax,ay,0]);vector(side.force,[fx,N,0]);near(side.supportForce,N);near(side.panCouple,C);near(side.topHorizontalForce,fx/2-C/h);near(side.bottomHorizontalForce,fx/2+C/h);
  near(side.topHorizontalForce+side.bottomHorizontalForce,fx);near(h/2*(side.bottomHorizontalForce-side.topHorizontalForce),C);
  if(s.atStop){vector(side.stoppingImpulse,[m*sigma*a*Math.sin(q)*s.lastIncomingSpeed,-m*sigma*a*Math.cos(q)*s.lastIncomingSpeed,0]);}
 }
 near(s.fixedBearingCouple,s.left.panCouple+s.right.panCouple);
 if(v.leftMass===v.rightMass){near(q,v.initialAngle);near(w,0);near(alpha,0);near(s.stopTorque,0);near(s.damperHeat+s.impactHeat,0);assert.equal(s.atStop,0);}
 if(s.atStop){near(Math.abs(q),.2);near(w,0);near(alpha,0);assert.equal(s.stoppedImbalance,true);near(s.stopLeftForce+s.stopRightForce,0);near(.30*Math.cos(q)*(s.stopRightForce-s.stopLeftForce),s.stopTorque);near(s.stopGeneralizedImpulse,-I*s.lastIncomingSpeed);near(s.stopLeftImpulse+s.stopRightImpulse,0);near(.30*Math.cos(q)*(s.stopRightImpulse-s.stopLeftImpulse),s.stopGeneralizedImpulse);}
}
for(let i=0;i<=80;i++){
 const q=-.2+.4*i/80,pose=geometry(q,-.18,.18);for(const [key,sigma] of [['left',-1],['right',1]]){const side=pose[key];vector(side.top,[sigma*a*Math.cos(q),h/2+sigma*a*Math.sin(q),0]);vector(side.bottom,[sigma*a*Math.cos(q),-h/2+sigma*a*Math.sin(q),0]);near(new THREE.Vector3(...side.top).distanceTo(new THREE.Vector3(...side.bottom)),h);}geometryPoses++;
}
// Every selectable control combination at release, including arbitrary offsets.
for(let l=0;l<=8;l++)for(let r=0;r<=8;r++)for(let lo=0;lo<=6;lo++)for(let ro=0;ro<=6;ro++)for(const initialAngle of [-.12,0,.12])for(const gravity of [0,1]){
 const v={leftMass:l/4,rightMass:r/4,leftOffset:Number((-.18+.06*lo).toFixed(2)),rightOffset:Number((-.18+.06*ro).toFixed(2)),initialAngle,gravity};verify(sample(v,0),v);controlTrials++;
}
assert.equal(anchors.length,lesson.tryIt.length);
const scalarKeys=['angle','speed','acceleration','inertia','gravityTorque','damperTorque','stopTorque','kineticEnergy','potentialEnergy','damperHeat','impactHeat'];
for(let i=0;i<lesson.tryIt.length;i++){
 const v=lesson.tryIt[i].values;assert.deepEqual(anchors[i].values,v);assert.deepEqual(Object.keys(v).sort(),Object.keys(defaults).sort());assert.equal(lesson.tryIt[i].reset,true);
 for(const ref of anchors[i].snapshots){const s=sample(v,ref.elapsed);verify(s,v);for(const k of scalarKeys)near(s[k],ref[k],3e-8);referenceSamples++;}
}
// Offset invariance and exact impact-side convention for all 486 motion trials.
for(let l=0;l<=8;l++)for(let r=0;r<=8;r++)for(const initialAngle of [-.12,0,.12])for(const gravity of [0,1]){
 const v={...defaults,leftMass:l/4,rightMass:r/4,initialAngle,gravity},end=sample(v,8),shifted=sample({...v,leftOffset:-.18,rightOffset:.18},8);verify(end,v);for(const k of scalarKeys)near(end[k],shifted[k],1e-12);
 if(end.atStop){const t=end.lastImpactTime,before=sample(v,t-1e-9),at=sample(v,t),after=sample(v,t+1e-9);assert.equal(before.atStop,0,'Immediately before impact is free');assert.notEqual(before.speed,0);assert.notEqual(at.atStop,0,'Own reported impact time is post-impact');near(at.speed,0);near(at.impactHeat,end.impactHeat);assert.equal(after.atStop,at.atStop);eventBoundaries++;}
}
for(const bad of [null,[],false,'mass',1])assert.throws(()=>sample(bad,0));
for(const bad of [{extra:1},{leftMass:NaN},{leftMass:Infinity},{leftMass:-.25},{rightMass:2.25},{leftMass:.1},{leftOffset:-.24},{rightOffset:.24},{leftOffset:.01},{initialAngle:.06},{gravity:.5},{gravity:2}])assert.throws(()=>sample(bad,0));
for(const t of [NaN,Infinity,-Infinity,'1'])assert.throws(()=>sample(defaults,t));
const model=createRobervalBalanceModel();assert.deepEqual(model.defaults,defaults);assert.equal(model.controls.length,6);
const geometries=new Set(),materials=new Set(),textures=new Set();model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
for(const t of lesson.tryIt){for(const elapsed of [0,.08,.6,2,6,8]){
 model.reset();model.update(t.values);model.advance(elapsed);const s=model.getState();verify(s,t.values);const reference=sample(t.values,elapsed);for(const k of scalarKeys)near(s[k],reference[k]);assert.equal(s.readings.length,29);assert.ok(s.readings.every(r=>r.hint?.length>15));
 model.root.updateMatrixWorld(true);model.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});assert.equal(new THREE.Box3().setFromObject(model.root).isEmpty(),false);
 const top=model.topology,local=(object,point)=>top.system.worldToLocal(object.localToWorld(new THREE.Vector3(...point)));
 for(const [key,sigma] of [['left',-1],['right',1]]){
  const side=top.sides[key];near(side.carrier.rotation.z,0);near(side.pan.rotation.z,0);near(local(side.load,[0,0,0]).distanceTo(new THREE.Vector3(...s[key].payload)),0);
  for(const [i,beam] of [[0,top.lower],[1,top.upper]])near(local(side.carrier,side.joints[i].local).distanceTo(local(beam,[sigma*.45,0,0])),0);
  const actual=local(side.load,[0,0,0]).sub(local(side.carrier,[0,0,0]));near(actual.x*s[key].supportForce-actual.y*s[key].force[0],s[key].panCouple);assert.equal(side.arrow.userData.explosionExcluded,true);
 }
 for(let i=0;i<2;i++){const lug=top.stopLugs[i],sigma=i===0?-1:1;assert.equal(lug.parent,top.upper);const actual=local(lug,[0,0,0]);near(actual.x,sigma*.30*Math.cos(s.angle));near(actual.y,.175+sigma*.30*Math.sin(s.angle));if(s.atStop)near(Math.abs(actual.y-.175)+top.stopBallRadius,top.stopFace);}
 const whole=model.frameBoundsForPart('system');top.system.traverse(o=>{if(!o.geometry)return;const pts=o.geometry.attributes.position;for(let i=0;i<pts.count;i++)assert.ok(whole.containsPoint(new THREE.Vector3().fromBufferAttribute(pts,i).applyMatrix4(o.matrixWorld)),'whole geometry framed');});
 const detail=model.frameBoundsForPart('pointer');for(const object of [top.pointerBody,top.pointerHub,top.pointerKey,top.arcBody,top.arcMarks]){const pts=object.geometry.attributes.position;for(let i=0;i<pts.count;i++)assert.ok(detail.containsPoint(new THREE.Vector3().fromBufferAttribute(pts,i).applyMatrix4(object.matrixWorld)),'pointer and arc framed');}
 const held=structuredClone(model.getState());for(const label of ['Inspect balance pointer','Inspect whole balance']){model.actions.find(a=>a.label===label).run();assert.deepEqual(model.getState(),held);}
 renderedStates++;
}}
assert.equal(model.catalogParts.length,13);assert.ok(model.catalogParts.every(p=>p.id!=='system'));
model.reset();assert.deepEqual(model.getState().values,defaults);near(model.getState().elapsed,0);
const resources=[...geometries,...materials,...textures],counts=new Map(resources.map(r=>[r,0]));resources.forEach(r=>r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1)));model.dispose();model.dispose();for(const [r,count] of counts)assert.equal(count,1,`Exactly one disposal for ${r.type||'texture'}`);
console.log(JSON.stringify({passed:true,controlTrials,referenceSamples,geometryPoses,eventBoundaries,renderedStates,presets:lesson.tryIt.length,disposedResources:resources.length}));

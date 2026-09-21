import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {samplePlatformScale,platformScaleGeometry,PLATFORM_SCALE_DOMAINS} from './platform-scale-physics.js';
import {createPlatformScaleModel} from './platform-scale-model.js';
import {platformScaleLesson as lesson} from './platform-scale-lesson.js';
const near=(a,b,tol=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,`${a} != ${b}`);
let settings=0,referenceSamples=0,poses=0,framedPoses=0;
// At level, derive acceleration and rod forces directly from the chosen lever arms.
for(let mass=0;mass<=150;mass+=5)for(let k=0;k<=30;k++)for(const poiseMass of [4,5,6])for(const gravity of [0,1]){
 const poise=k*.04,g=[9.81,1.62][gravity],s=samplePlatformScale({mass,poise,poiseMass,gravity}),I=.05+.04*mass+25*poiseMass*poise**2,acc=-g*(.2*mass-5*poiseMass*poise)/I,T2=(poiseMass*g*poise-5*poiseMass*poise**2*acc)/.4;
 near(s.lowerAcceleration,acc);near(s.firstRodForce,2*T2);near(s.secondRodForce,T2);near(s.payloadForce,mass*(g+.2*acc));near(s.indicatedMass,125*poise);near(s.balancedMass,25*poiseMass*poise);near(s.inertia,I);near(s.energyResidual,0);near(s.shaftResidual,0);assert.equal(s.atStop,0);settings++;
}
const anchors=JSON.parse(await readFile(new URL('../../documentation/audit/evidence/platform-scale/independent-review/preset-anchors.json',import.meta.url),'utf8')).cases;
const referenceKeys=['lowerAngle','upperAngle','beamAngle','lowerSpeed','lowerAcceleration','beamSpeed','beamAcceleration','platformTravel','firstRodForce','secondRodForce','payloadForce','stopTorque','kineticEnergy','potentialEnergy','damperHeat','impactHeat','payloadStoppingImpulse','stopGeneralizedImpulse'];
assert.equal(anchors.length,lesson.tryIt.length);
for(let i=0;i<lesson.tryIt.length;i++){
 const trial=lesson.tryIt[i];assert.deepEqual(trial.values,anchors[i].values);assert.equal(trial.reset,true);assert.equal(trial.part,'system');assert.equal(trial.isolate,false);
 for(const ref of anchors[i].snapshots){const s=samplePlatformScale(trial.values,ref.elapsed);for(const key of referenceKeys)near(s[key],ref[key],2e-7);near(s.energyResidual,0,2e-7);near(s.shaftResidual,0);assert.equal(s.complete,ref.elapsed>=8);assert.equal(s.equilibrium,Math.abs(trial.values.mass-25*trial.values.poiseMass*trial.values.poise)<1e-10);if(s.atStop)assert.ok(Math.abs(s.stopTorque)>0);referenceSamples++;}
 const final=samplePlatformScale(trial.values,8);
 if(final.stopHits){
  const before=samplePlatformScale(trial.values,final.lastImpactTime-1e-9);assert.equal(before.stopHits,0);assert.notEqual(before.lowerSpeed,0);
  for(const offset of [0,1e-9]){const stopped=samplePlatformScale(trial.values,final.lastImpactTime+offset);assert.equal(stopped.stopHits,1);assert.equal(stopped.lowerSpeed,0);assert.equal(stopped.atStop,final.atStop);near(stopped.payloadStoppingImpulse,final.payloadStoppingImpulse,2e-7);near(stopped.energyResidual,0,2e-7);}
 }
}
for(let i=0;i<=400;i++){
 const q=-.02+i*.0001,s=platformScaleGeometry(q);near(Math.hypot(s.upperInput[0]-s.lowerOutput[0],s.upperInput[1]-s.lowerOutput[1]),1);near(Math.hypot(s.upperOutput[0]-s.beamInput[0],s.upperOutput[1]-s.beamInput[1]),.5);near(s.platformTravel,.2*Math.sin(q));
 if(i>0&&i<400){const h=1e-6,a=platformScaleGeometry(q-h),b=platformScaleGeometry(q+h);near(s.upperDerivative,(b.upperAngle-a.upperAngle)/(2*h),2e-7);near(s.beamDerivative,(b.beamAngle-a.beamAngle)/(2*h),2e-7);near(s.beamSecondDerivative,(b.beamDerivative-a.beamDerivative)/(2*h),2e-7);}
}
for(const [key,[lo,hi,step]] of Object.entries(PLATFORM_SCALE_DOMAINS))for(const bad of [NaN,Infinity,lo-step,hi+step,lo+step/3])assert.throws(()=>samplePlatformScale({[key]:bad}));for(const key of ['gravity','poiseMass'])for(const bad of [1e-10,-1e-10])assert.throws(()=>samplePlatformScale({[key]:(key==='gravity'?1:5)+bad}));for(const bad of [null,[],{wrong:1}])assert.throws(()=>samplePlatformScale(bad));for(const bad of [-1,NaN,Infinity])assert.throws(()=>samplePlatformScale({},bad));for(const bad of [-.0201,.0201,NaN,Infinity])assert.throws(()=>platformScaleGeometry(bad));
const m=createPlatformScaleModel(),top=m.topology;
for(const trial of lesson.tryIt)for(const t of [0,.08,.6,2,6,8]){
 m.reset();m.update(trial.values);m.advance(t);const s=m.getState(),ref=samplePlatformScale(trial.values,t);for(const [key,value] of Object.entries(ref))assert.deepEqual(s[key],value);assert.equal(s.readings.length,25);assert.ok(s.readings.every(r=>r.hint?.length>15));m.root.updateMatrixWorld(true);m.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 near(top.lower.rotation.z,s.lowerAngle);near(top.upper.rotation.z,s.upperAngle);near(top.beam.rotation.z,s.beamAngle);near(top.platform.position.y,s.platformTravel);near(top.poise.position.x,trial.values.poise);assert.equal(top.payload.visible,trial.values.mass>0);assert.deepEqual(top.graduations.rotation.toArray().slice(0,3),[0,0,0]);
 const local=(object,point)=>top.system.worldToLocal(object.localToWorld(new THREE.Vector3(...point)));
 for(const [rod,length,start,end] of [[top.rodOne,1,[...s.lowerOutput,.18],[...s.upperInput,.18]],[top.rodTwo,.5,[...s.beamInput,-.18],[...s.upperOutput,-.18]]]){near(local(rod,[0,0,0]).distanceTo(new THREE.Vector3(...start)),0);near(local(rod,[0,length,0]).distanceTo(new THREE.Vector3(...end)),0);}
 const actualRoller=local(top.roller,[0,0,0]),actualLoad=local(top.load,[0,0,0]);near((actualLoad.x-actualRoller.x)*s.payloadForce,s.guideCouple[2]);near((actualRoller.z-actualLoad.z)*s.payloadForce,s.guideCouple[0]);const actualLug=local(top.stopLug,[0,0,0]);near(actualLug.x,.9*Math.cos(s.lowerAngle));near(actualLug.y,.9*Math.sin(s.lowerAngle));near(actualRoller.distanceTo(new THREE.Vector3(...s.rollerPosition)),0);if(s.atStop)near(Math.abs(actualLug.y)+top.stopRadius,top.stopFace);poses++;
}
m.root.position.set(3,-2,4);m.root.rotation.set(.3,-.6,.2);
for(const trial of lesson.tryIt)for(const t of [0,.6,8]){m.reset();m.update(trial.values);m.advance(t);m.root.updateMatrixWorld(true);const bounds=m.frameBoundsForPart('system');top.system.traverse(o=>{if(!o.geometry)return;const points=o.geometry.attributes.position;for(let i=0;i<points.count;i++)assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld)),`Whole-model framing contains ${o.name||o.type}`);});framedPoses++;}
assert.equal(top.roller.parent,top.lower);assert.equal(top.stopLug.parent,top.lower);assert.equal(top.level.parent,top.base);
for(const object of [top.loadArrow,top.poiseArrow])assert.equal(object.userData.explosionExcluded,true);
assert.deepEqual(m.catalogParts.map(p=>p.id),m.parts.filter(p=>!['system','graduations'].includes(p.id)).map(p=>p.id));
for(const trial of lesson.tryIt)for(const t of [0,.6,8]){
 m.reset();m.update(trial.values);m.advance(t);m.root.updateMatrixWorld(true);const before=structuredClone(m.getState());
 for(const [id,objects] of [['stops',[...top.stopMeshes,top.stopSupport,top.stopLug,top.lugStem]],['level',[top.levelDatum,top.datumTie]]]){
  const bounds=m.frameBoundsForPart(id);for(const object of objects){const points=object.geometry.attributes.position;for(let i=0;i<points.count;i++)assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(object.matrixWorld)),id+' contains physical contact');}
  if(id==='level'){const tip=top.beam.localToWorld(new THREE.Vector3(1.25,0,0));assert.ok(bounds.containsPoint(tip),'level view contains moving beam end');}
 }
 for(const label of ['Inspect travel stop','Inspect level reference','Inspect whole scale']){m.actions.find(a=>a.label===label).run();assert.deepEqual(m.getState(),before,'inspection preserves full state');}
}
m.reset();m.playback.step();near(m.getState().elapsed,.08);m.advance(30);assert.equal(m.playback.complete(),true);m.reset();assert.equal(m.playback.complete(),false);m.actions[1].run();m.update({poise:.8});near(m.getState().elapsed,2);near(m.getState().lowerAngle,0);near(m.getState().stopTorque,0);m.update({poiseMass:4});assert.equal(m.getState().atStop,-1);near(m.getState().indicatedMass,100);m.reset();near(m.getState().elapsed,0);near(m.getState().indicatedMass,75);assert.equal(m.resultPart.context,'system');
const resources=new Set();m.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(mat);if(mat.gradientMap)resources.add(mat.gradientMap);if(mat.map)resources.add(mat.map);}});const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));m.dispose();m.dispose();assert.ok([...counts.values()].every(n=>n===1));
const result={passed:true,settings,referenceSamples,geometrySamples:401,poses,framedPoses,presets:lesson.tryIt.length,resources:resources.size,anchors:['independent Cartesian and DOP853 trajectories','level acceleration and rod-force derivation','rigid connecting rods and differential constraints','fixed graduation with alternate poises','stop impulse and energy','actual guide reaction couple','preset state, playback and current-time resampling','complete transformed model framing','input validation and exactly-once resource disposal']};await writeFile(new URL(process.env.PLATFORM_SCALE_MODEL_EVIDENCE||'../../documentation/audit/evidence/platform-scale/model-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

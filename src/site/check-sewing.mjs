import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';

const machine=createSewingModel();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let previousFeed=null,previousCloth=null;
for(let i=0;i<1000;i++){
 machine.advance(.005);
 const state=machine.getState();
 assert.equal(state.readings.length,10);assert.ok(state.readings.every(row=>row.hint));
 assert.equal(state.readings.find(row=>row.label==='Fabric progress').value,`${(state.distance+state.feedDistance).toFixed(1)} / 40 mm advanced`);
 if(state.feeding)assert.ok(state.needleTip>1.04,'Cloth must only feed with needle clear');
 const feed=machine.parts.find(p=>p.id==='feed-bar').object.position.z,clothPosition=machine.parts.find(p=>p.id==='cloth').object.position.z;
 if(state.feeding&&previousFeed!==null){assert.ok((feed-previousFeed)*(clothPosition-previousCloth)>=-1e-12,'Feed teeth and cloth must travel in the same direction');}
 previousFeed=feed;previousCloth=clothPosition;
 const bar=machine.parts.find(p=>p.id==='connecting-rod').object.children[0];
 near(bar.scale.y,.70);
 machine.root.updateMatrixWorld(true);
 machine.root.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite),object.name));
}
machine.reset();machine.update({length:5});machine.advance(100);
assert.equal(machine.getState().stitches.length,8);near(machine.getState().sewn,40);
assert.equal(machine.getState().complete,true);
const completed=machine.getState().stitches;machine.advance(10);assert.deepEqual(machine.getState().stitches,completed);
machine.reset();machine.update({length:1});machine.advance(100);
assert.equal(machine.getState().stitches.length,40);
machine.reset();machine.update({foot:0});machine.advance(20);near(machine.getState().distance,0);
machine.update({foot:1,threaded:0});machine.advance(10);assert.equal(machine.getState().stitches.length,0);
const gap=machine.getState().distance;machine.update({threaded:1});machine.advance(2);
assert.equal(machine.getState().stitches[0].from,gap,'Restoring thread must not sew over the earlier gap');
machine.update({template:1,length:3});near(machine.getState().distance,0);machine.advance(100);
const corner=machine.getState();near(corner.sewn,40);
assert.ok(corner.stitches.some(s=>s.to===20),'A stitch must end at the corner before the cloth turns');
assert.ok(corner.stitches.every(s=>s.to-s.from<=3));
machine.reset();machine.update({template:0,rate:2});machine.advance(.25);near(machine.getState().phase,.5);
machine.playback.step();near(machine.getState().phase,0);near(machine.getState().distance,3);
const cloth=machine.parts.find(p=>p.id==='cloth').object;
const seam=machine.parts.find(p=>p.id==='seam').object;
assert.equal(seam.parent,cloth);
assert.ok(new THREE.Box3().setFromObject(seam).getSize(new THREE.Vector3()).length()>0,'Completed output must have visible geometry');
machine.reset();
const {takeCam,takeFollower,takeup}=machine.topology;
const grooveWalls=takeCam.children.filter(mesh=>mesh.geometry?.parameters?.path).map(mesh=>mesh.geometry.parameters.path.points);
assert.equal(grooveWalls.length,2);
for(const mesh of [takeCam.children[0],takeFollower.children[0]])near(Math.abs(new THREE.Vector3(0,1,0).applyQuaternion(mesh.quaternion).x),1);
let previousLift=Infinity,previousRecovery=-Infinity;
for(let i=0;i<720;i++){
 if(i)machine.advance(1/720);
 const state=machine.getState(),c=i/720;
 machine.root.updateMatrixWorld(true);
 const follower=takeFollower.children[0].getWorldPosition(new THREE.Vector3());
 const center=grooveWalls[0][i].clone().add(grooveWalls[1][i]).multiplyScalar(.5);
 takeCam.localToWorld(center);
 assert.ok(follower.distanceTo(center)<1e-8,'the rigid rocker follower remains between the drawn cam groove walls');
 const eye=takeup.localToWorld(new THREE.Vector3(0,.45,0));
 near(eye.distanceTo(takeup.getWorldPosition(new THREE.Vector3())),.45);
 if(c>=.45&&c<=.88)near(state.takeUpHeight,2.13+.45*Math.cos(1.05));
 if(c<.45){assert.ok(state.takeUpHeight<=previousLift+1e-10);previousLift=state.takeUpHeight;}
 if(c>=.88){assert.ok(state.takeUpHeight>=previousRecovery-1e-10);previousRecovery=state.takeUpHeight;}
}
machine.reset({phase:.7});machine.root.updateMatrixWorld(true);
const formation=machine.parts.find(p=>p.id==='stitch-formation').object;
const hookAssembly=machine.parts.find(p=>p.id==='hook-assembly').object;
const needleBar=machine.parts.find(p=>p.id==='needle').object;
assert.equal(needleBar.parent,formation);assert.equal(hookAssembly.parent,formation);
const loop=hookAssembly.children.find(object=>object.isInstancedMesh);
assert.ok(loop?.count>90,'the isolated hook assembly retains the upper loop at carry');
const instance=new THREE.Matrix4();loop.getMatrixAt(0,instance);
const threadStart=new THREE.Vector3(0,-.5,0).applyMatrix4(instance);loop.localToWorld(threadStart);
const needleEye=needleBar.localToWorld(new THREE.Vector3(-.85,-.30,.15));
assert.ok(threadStart.distanceTo(needleEye)<1e-6,'reparented thread remains connected to the actual needle eye');
machine.reset();assert.equal(new Set(machine.parts.map(p=>p.name)).size,machine.parts.length,'every labeled part has a distinct name');
const object=id=>machine.parts.find(p=>p.id===id).object;
machine.advance(.5);machine.root.updateMatrixWorld(true);const lowEye=object('needle').children.find(p=>p.geometry?.type==='TorusGeometry').getWorldPosition(new THREE.Vector3());
machine.advance(.05);machine.root.updateMatrixWorld(true);const catchEye=object('needle').children.find(p=>p.geometry?.type==='TorusGeometry').getWorldPosition(new THREE.Vector3());assert.ok(catchEye.y>lowEye.y&&catchEye.y<1.04,'catch occurs during early needle rise below cloth');
const hookTip=object('hook').children.find(p=>p.geometry?.type==='CylinderGeometry'),point=hookTip.localToWorld(new THREE.Vector3(0,hookTip.geometry.parameters.height/2,0)),thread=object('hook-assembly').children.find(p=>p.isInstancedMesh),pose=new THREE.Matrix4();thread.getMatrixAt(0,pose);const caught=thread.localToWorld(new THREE.Vector3(0,.5,0).applyMatrix4(pose));assert.ok(point.distanceTo(caught)<1e-6,'actual hook nose meets the red loop, not the needle itself');assert.ok(point.x<catchEye.x&&point.y>catchEye.y);
for(const phase of [.55,.70,.84]){machine.reset({phase});near(object('hook').rotation.x,phase*4*Math.PI-2*.55*2*Math.PI);near(object('hook-pulley').rotation.x,2*object('upper-pulley').rotation.x);near(object('feed-input-pulley').rotation.x,object('feed-output-pulley').rotation.x);}
for(const rate of [.5,1,3]){machine.reset();machine.update({rate});machine.advance(.25/rate);near(machine.getState().phase,.25);assert.equal(machine.getState().readings.find(row=>row.label==='Sewing pace').value,`${rate*60} cycles/min`);}
machine.reset();const stages=[];for(let i=0;i<7;i++){machine.actions[0].run();stages.push(machine.getState().phase);}stages.forEach((p,i)=>near(p,[.14,.50,.55,.70,.84,.94,0][i]));assert.equal(machine.getState().stitches.length,1);
machine.reset();machine.advance(.3);machine.update({length:5});machine.advance(.7);near(machine.getState().distance,3);machine.playback.step();near(machine.getState().distance,8);
assert.ok(machine.covers.includes(machine.topology.takeCam.children[0]),'Look inside reveals the rocker behind its backing disk');
machine.reset();machine.update({threaded:0});machine.playback.step();machine.update({threaded:1});machine.playback.step();machine.root.updateMatrixWorld(true);const resultBounds=machine.frameBoundsForPart('seam');for(const z of [-.5,0,.5])assert.ok(resultBounds.containsPoint(cloth.localToWorld(new THREE.Vector3(0,0,z))),'result frame keeps the whole marked straight template, including unsewn gaps');assert.equal(machine.frameBoundsForPart('needle'),null);
for(const phase of [.01,.08,.14,.5,.94]){machine.reset();machine.advance(phase);const before={position:cloth.position.toArray(),phase:machine.getState().phase,progress:machine.getState().feedDistance};machine.update({foot:0});machine.advance(2);assert.deepEqual({position:cloth.position.toArray(),phase:machine.getState().phase,progress:machine.getState().feedDistance},before,'raising the foot freezes existing feed progress');machine.update({foot:1});assert.deepEqual(cloth.position.toArray(),before.position,'lowering the foot does not jump the fabric');}
machine.dispose();
console.log('PASS sewing: fixed needle rod, feed clearance, 1/5 mm results, completion, missing-thread gaps, foot interlock, corner guidance, pace and single-step output.');

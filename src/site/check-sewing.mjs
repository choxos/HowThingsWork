import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';

const machine=createSewingModel();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let previousFeed=null,previousCloth=null;
for(let i=0;i<1000;i++){
 machine.advance(.005);
 const state=machine.getState();
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
machine.dispose();
console.log('PASS sewing: fixed needle rod, feed clearance, 1/5 mm results, completion, missing-thread gaps, foot interlock, corner guidance, pace and single-step output.');

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMachine} from './machine-models.js';
const model=createMachine('Differential');
const outputs=['Left output wheel','Right output wheel'].map(name=>model.root.getObjectByName(name));
assert.ok(outputs.every(Boolean));
const centers=outputs.map(w=>w.position.clone());
for(const phase of [0,.13,.37,.5,1]){
 model.animate(phase);model.root.updateMatrixWorld(true);
 outputs.forEach((wheel,i)=>{assert.ok(wheel.position.equals(centers[i]));const axis=new THREE.Vector3(0,0,1).applyQuaternion(wheel.quaternion);assert.ok(axis.distanceTo(new THREE.Vector3(1,0,0))<1e-8,'output wheels keep their axle direction');});
 assert.equal(outputs[0].rotation.x,2*outputs[1].rotation.x,'the illustrated outputs turn at different speeds');
 if(phase>0)assert.ok(outputs.every(w=>Math.abs(w.rotation.x)>0),'both output wheels turn');
}
model.dispose();
// The differential is no longer a catalog item: #machine/differential is not a route and the old
// slider viewer is mounted by no page, so only the model itself is checked here.
console.log('PASS Differential model: both output wheels turn at the illustrated different speeds and stay on their axles.');

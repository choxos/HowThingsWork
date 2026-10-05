import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAccelerometerModel} from './accelerometer-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createAccelerometerModel();let inventories=0;
for(const roll of [0,90,180])for(const aspect of [.55,1.3,2]){
 m.reset({settings:{roll},time:1});m.root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(.18,.1,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
 const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
 const ids=['board','frame','mass','electrodes','springs','electronics','channel-x','channel-y','channel-z','supply'];
 assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(ids));t.ok(explosion.items.length===10,'Ten physical assemblies; each output capacitor stays near its terminal');
 const inverse=camera.quaternion.clone().invert();
 const projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
 for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated screen bounds do not overlap');}
 explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Exact reassembly'));inventories++;
}
for(const id of ['capacitive-detail','response-detail']){const p=m.parts.find(p=>p.id===id);t.ok(p.object.userData.inspectionOnly===id&&p.object.userData.explosionExcluded,'Enlarged diagram is not a loose machine part');t.ok(m.thumbnailOmit.includes(p.object),'Room thumbnails omit concepts');}
const resources=checkDisposal(m,t);console.log(`PASS accelerometer inspection: ${t.count} checks, ${inventories} inventories, ${resources} resources`);

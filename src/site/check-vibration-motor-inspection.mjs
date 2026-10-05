import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVibrationMotorModel} from './vibration-motor-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createVibrationMotorModel();let inventories=0;
for(const mount of [0,1,2])for(const balance of [0,1])for(const aspect of [.55,1.3,2]){
 m.reset({settings:{mount,balance},time:10});m.root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(1.8,2.5,3.8);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
 const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
 const physical=['fixture','carriage','housing','bearings','stator','shaft','armature','windings','commutator','brushes','weight','counterweight','mount','drive','leads'];
 assert.deepEqual(new Set(explosion.items.map(i=>i.id)),new Set(physical));t.ok(explosion.items.length===15,'15 coherent physical units with no diagram fragments');
 const inverse=camera.quaternion.clone().invert(),projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
 for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated projected bounds do not overlap');}
 explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Exact reassembly'));inventories++;
}
for(const id of ['circuit-detail','response-detail','energy-detail']){const part=m.parts.find(p=>p.id===id);t.ok(part.object.userData.inspectionOnly===id&&part.object.userData.explosionExcluded,'Diagram stays outside physical inventory');t.ok(m.thumbnailOmit.includes(part.object),'Diagram excluded from room thumbnail');}
const resources=checkDisposal(m,t);console.log(`PASS vibration motor inspection: ${t.count} checks, ${inventories} inventories, ${resources} resources`);

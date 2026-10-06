import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhonemesModel} from './phonemes-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createPhonemesModel();let inventories=0;
for(const time of [0,.55,1.55,2.1])for(const second of [0,10,11,12])for(const aspect of [.55,1.3,2]){
 m.reset({time,settings:{second}});m.root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(0,0,7);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));const e=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});e.update(1);
 assert.deepEqual(new Set(e.items.map(i=>i.id)),new Set(['source','filters','output','system']));t.add();
 const inverse=camera.quaternion.clone().invert(),bounds=e.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
 for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated diagram groups have distinct space');}
 e.update(0);e.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Exact diagram reassembly'));inventories++;
}
for(const id of ['spectrum','spectrogram','vowels','comparison']){const p=m.parts.find(p=>p.id===id);t.ok(p.object.userData.inspectionOnly===id&&p.object.userData.explosionExcluded,'Detail excluded from separated assembly');t.ok(m.thumbnailOmit.includes(p.object),'Detail excluded from room thumbnail');t.ok(m.frameBoundsForPart(id).containsBox(new THREE.Box3().setFromObject(p.object)),'Authored bounds contain complete diagram');}
const resources=checkDisposal(m,t);console.log(`PASS phonemes inspection: ${t.count} checks; ${inventories} inventories; ${resources} resources`);

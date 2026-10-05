import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSmartphoneLearningModel} from './smartphone-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createSmartphoneLearningModel(),p=m.topology;let inventories=0;
for(const scenario of [0,1,2,3])for(const aspect of [.55,1.3,2]){
  m.reset({settings:{scenario},time:.4});m.root.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(.18,.09,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
  const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['case','battery','board','display','touch','antenna','speaker','microphone','motor','camera']));
  t.ok(explosion.items.length===10,'Ten physical assemblies; no empty groups or inspection diagrams');
  const inverse=camera.quaternion.clone().invert();
  const projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Full separation has disjoint screen bounds');}
  explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Reassembly preserves original pose'));inventories++;
}
t.ok(p.board.userData.explosionRigid,'Populated board stays assembled');
for(const part of m.parts.filter(x=>x.parentId==='board'))t.ok(part.object.parent===p.board,'Named chips remain board children');
for(const group of [p.details.touch,p.details.sensor,p.details.motor,p.details.voice])t.ok(m.thumbnailOmit.includes(group),'Room thumbnails exclude enlarged concepts');
const resources=checkDisposal(m,t);console.log(`PASS smartphone inspection: ${t.count} checks, ${inventories} inventories, ${resources} resources`);

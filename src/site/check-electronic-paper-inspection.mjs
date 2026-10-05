import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElectronicPaperDisplayModel} from './electronic-paper-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createElectronicPaperDisplayModel(),p=m.topology;
let inventories=0;
for(const technology of [0,1])for(const aspect of [.55,1.3,2]){
  m.reset({settings:{technology},time:.4});m.root.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(.35,.16,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
  const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['case','battery','controller','driver','backplane','ink','frontlight']));
  t.ok(explosion.items.length===7,'Seven physical assemblies; enlarged diagrams excluded');
  const inverse=camera.quaternion.clone().invert();
  const projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),p=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])p.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return p;});
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated assemblies have disjoint screen bounds');}
  explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Reassembly restores original pose'));inventories++;
}
t.ok(m.thumbnailOmit.length===5&&m.thumbnailOmit.every(o=>o.userData.inspectionOnly&&o.userData.explosionExcluded&&o.parent===p.system),'Room thumbnails omit every enlarged diagram');
t.ok(p.batteryLeads.every(o=>o.parent===p.battery)&&p.lightFeed.every(o=>o.parent===p.frontlight),'Wires stay with their rigid assemblies');
t.ok(p.powerIndicator.parent===p.casing,'Power indicator stays with case');
const resources=checkDisposal(m,t);console.log(`PASS electronic paper inspection: ${t.count} checks, ${inventories} inventories, ${resources} resources`);

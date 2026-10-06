import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCdModel} from './cd-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),model=createCdModel(),g=model.topology;
let inventories=0;
for(const radius of [25,41,58])for(const aspect of [.55,1.3,2]){
  model.reset({settings:{radius},time:5.2});model.root.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(1.1,2.2,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const before=new Map();model.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
  const explosion=createPartExplosion(model,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['chassis','spindle','disc','traverse','pickup','electronics','left-output','right-output']));t.add();
  t.ok(explosion.items.length===8,'Eight supported physical assemblies, with diagrams excluded');
  const inverse=camera.quaternion.clone().invert(),projected=explosion.items.map(item=>{
    const b=item.bounds.clone().translate(item.group.position),p=new THREE.Box3();
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])p.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return p;
  });
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){
    const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated assemblies have disjoint screen rectangles');
  }
  explosion.update(0);explosion.dispose();model.root.updateMatrixWorld(true);model.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Reassembly restores every transform'));inventories++;
}
t.ok(model.thumbnailOmit.length===8&&model.thumbnailOmit.every(o=>o.userData.inspectionOnly),'All authored diagrams stay out of room thumbnail');
t.ok(model.thumbnailOmit.every(o=>o.parent===g.system),'Inspection panels remain owned for disposal');
t.ok(model.covers.includes(g.status)&&model.covers.includes(g.frontSlot),'Removed wall takes indicator and slot with it');
const flex=g.flex.geometry;model.update({radius:25});t.ok(g.flex.geometry===flex,'Flex buffer updates without creating disposable geometry each frame');
for(const radius of [25,41,58]){
  model.reset({settings:{radius},time:6});model.root.updateMatrixWorld(true);
  const p=model.getState().spiral.radiusMm,position=g.flex.geometry.attributes.position;
  t.near(model.frameBoundsForPart('pickup').getCenter(new THREE.Vector3()).x,g.pickup.getWorldPosition(new THREE.Vector3()).x,1e-12,'Pickup inspection centers its current radius');
  t.near(position.getX(0),(p+4)*.01,1e-7,'Flexible cable stays on moving pickup');t.near(position.getX(6),.75,1e-7,'Other end remains at circuit board');
  t.ok(g.pickup.position.x-.07>=.16-1e-9&&g.pickup.position.x+.07<=.74+1e-9,'Both pickup bearing pairs remain on supported rails');
}
for(const panel of g.details.details){
  const box=new THREE.Box3().setFromObject(panel),bounds=model.frameBoundsForPart(panel.userData.inspectionOnly);
  t.ok(bounds.containsBox(box),panel.userData.inspectionOnly+' framing encloses authored geometry');
}
const resources=checkDisposal(model,t);
console.log(JSON.stringify({passed:true,checks:t.count,inventories,resources}));

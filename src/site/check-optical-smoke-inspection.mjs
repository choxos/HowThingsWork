import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOpticalSmokeModel} from './optical-smoke-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';

const t=tally(),m=createOpticalSmokeModel();let inventories=0;
const physical=['base','board','battery','contact','controller','reservoir','horn','shell','cover','emitter','receiver','wires'];
for(const time of [0,40,600])for(const aspect of [.55,1.3,2]){
  m.reset({time,settings:{power:time===600?0:1}});m.root.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(-1.8,1.4,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
  const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
  assert.deepEqual(new Set(explosion.items.map(i=>i.id)),new Set(physical));t.ok(explosion.items.length===12,'Twelve physical pieces; diagrams and cues excluded');
  const inverse=camera.quaternion.clone().invert(),projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated parts have distinct projected space');}
  explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Exact reassembly'));inventories++;
}
for(const id of ['pulse','beam','pattern','chart']){const p=m.parts.find(p=>p.id===id);t.ok(p.object.userData.inspectionOnly===id&&p.object.userData.explosionExcluded,'Conceptual view stays outside physical separation');t.ok(m.thumbnailOmit.includes(p.object),'Conceptual view stays outside room thumbnail');}
t.ok(m.includeCoversInSeparation&&m.topology.flowRoot.userData.explosionExcluded,'Shells are physical; current cues are not');
const resources=checkDisposal(m,t);console.log(`PASS optical smoke inspection: ${t.count} checks; ${inventories} inventories; 12 physical pieces; ${resources} resources`);

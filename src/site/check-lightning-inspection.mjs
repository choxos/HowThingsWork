import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLightningConductorModel} from './lightning-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';

const t=tally(),m=createLightningConductorModel();let inventories=0;
t.ok(m.includeCoversInSeparation,'Viewer includes the removed house covers in the separated inventory');
const physical=['walls','roof','foundation','air-terminal','left-route','right-route','right-connection','bonding-bar','bonded-pipe','earth-termination','soil','step-probes'];
for(const time of [0,5,11])for(const aspect of [.55,1.3,2]){
 m.reset({time});m.root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(.7,.38,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
 const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
 assert.deepEqual(new Set(explosion.items.map(i=>i.id)),new Set(physical));t.ok(explosion.items.length===12,'Twelve physical assemblies, with explanatory diagrams and sky excluded');
 const inverse=camera.quaternion.clone().invert(),projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
 for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated projected assemblies do not overlap');}
 explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Exact reassembly'));inventories++;
}
for(const id of ['tip-detail','gap-detail','pulse-detail','earth-detail']){const part=m.parts.find(p=>p.id===id);t.ok(part.object.userData.inspectionOnly===id&&part.object.userData.explosionExcluded,'Inspection diagram stays outside physical separation');t.ok(m.thumbnailOmit.includes(part.object),'Inspection diagram stays outside room thumbnail');}
t.ok(m.topology.guides.userData.explosionExcluded&&m.thumbnailOmit.includes(m.topology.guides),'Direction captions stay outside physical inventory and thumbnails');
const resources=checkDisposal(m,t);console.log(`PASS lightning inspection: ${t.count} checks, ${inventories} inventories, 12 physical assemblies, ${resources} resources`);

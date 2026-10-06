import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInfraredSignalingModel} from './infrared-signaling-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';

const t=tally(),m=createInfraredSignalingModel();let inventories=0;
const physical=['shell','board','cover','keys','cells','encoder','transistor','emitter-resistor','indicator-resistor','emitter','indicator','capacitor','tv-chassis','tv-stand','tv-board','screen','receiver-module','decoder','tv-supply','blocker'];
for(const time of [0,.75,10])for(const aspect of [.55,1.3,2]){
 m.reset({time});m.root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(1.4,1.4,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
 const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
 assert.deepEqual(new Set(explosion.items.map(i=>i.id)),new Set(physical));t.ok(explosion.items.length===20,'Twenty physical assemblies, excluding explanatory panels and light markers');
 const inverse=camera.quaternion.clone().invert(),projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
 for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated physical assemblies have distinct projected space');}
 explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Exact reassembly'));inventories++;
}
for(const id of ['signal','bit','photo']){const part=m.parts.find(p=>p.id===id);t.ok(part.object.userData.inspectionOnly===id&&part.object.userData.explosionExcluded,'Diagram stays outside physical separation');t.ok(m.thumbnailOmit.includes(part.object),'Diagram stays outside room thumbnail');}
t.ok(m.includeCoversInSeparation&&m.topology.guides.userData.explosionExcluded&&m.thumbnailOmit.includes(m.topology.guides),'Covers stay in inventory; captions stay out');
const resources=checkDisposal(m,t);console.log(`PASS infrared signaling inspection: ${t.count} checks, ${inventories} inventories, 20 physical assemblies, ${resources} resources`);

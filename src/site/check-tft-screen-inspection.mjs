import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTftScreenModel} from './tft-screen-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createTftScreenModel();let inventories=0;
const physical=['frame','reflector','leds','light-guide','diffuser','rear-polarizer','rear-glass','pixel-electrodes','rear-alignment','liquid-crystal','seal','front-alignment','common-electrode','color-filters','front-glass','front-polarizer','board','source-driver','gate-driver','backlight-feed'];
for(const time of [0,10,19.95])for(const aspect of [.55,1.3,2]){
 m.reset({time});m.root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(1.25,.6,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const before=new Map();m.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
 const explosion=createPartExplosion(m,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
 assert.deepEqual(new Set(explosion.items.map(i=>i.id)),new Set(physical));t.ok(explosion.items.length===20,'Twenty coherent physical units, no optical or circuit diagrams');
 const inverse=camera.quaternion.clone().invert(),projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),out=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return out;});
 for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'Separated projected bounds do not overlap');}
 explosion.update(0);explosion.dispose();m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'Exact reassembly'));inventories++;
}
for(const id of ['optics-detail','matrix-detail','rgb-detail','response-detail']){const part=m.parts.find(p=>p.id===id);t.ok(part.object.userData.inspectionOnly===id&&part.object.userData.explosionExcluded,'Inspection diagram stays outside physical inventory');t.ok(m.thumbnailOmit.includes(part.object),'Diagram excluded from room thumbnail');}
const resources=checkDisposal(m,t);console.log(`PASS TFT screen inspection: ${t.count} checks, ${inventories} inventories, ${resources} resources`);

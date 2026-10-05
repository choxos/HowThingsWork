import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCapillaryModel, MM, APPARATUS as A} from './capillary-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),model=createCapillaryModel(),B=model.topology;
let inventories=0,contacts=0;
const bounds=o=>new THREE.Box3().setFromObject(o);
const reset=settings=>{model.reset({settings,time:3});model.root.updateMatrixWorld(true);};
for(const depth of [5,15,60])for(const radius of [.1,.5]){
  reset({depth,radius});
  t.near(bounds(B.base).max.y/MM,bounds(B.floor).min.y/MM,3e-5,'bath floor rests on base');
  t.near(bounds(B.rail).min.y/MM,bounds(B.base).max.y/MM,3e-5,'stand rail meets base');
  t.near(bounds(B.clampTop).min.y/MM,bounds(B.plates[0]).max.y/MM,3e-5,'plate clamp top meets actual plate top');
  for(const side of [-1,1])for(const x of [58.5,60,61.5]){
    const start=new THREE.Vector3(x*MM,(205-depth)*MM,side*.1),direction=new THREE.Vector3(0,0,-side);
    const ray=new THREE.Raycaster(start,direction),pad=ray.intersectObject(B.pads[side<0?0:1]),plate=ray.intersectObject(B.plates[side<0?0:1]);
    t.ok(pad.length>=2&&plate.length>=2,'clamp and plate have solid inner and outer faces');
    const edge=side*(.1+.9*(x-40)/40)/2+side*.5;
    const padZ=pad.map(h=>h.point.z/MM),plateZ=plate.map(h=>h.point.z/MM);
    t.near(side<0?Math.max(...padZ):Math.min(...padZ),edge,3e-6,'clamp pad follows sloping outer glass face');
    t.near(side<0?Math.min(...plateZ):Math.max(...plateZ),edge,3e-6,'plate meets pad without a gap or intrusion');contacts++;
  }
  const beam=bounds(B.arm);for(const plate of B.plates)t.ok(!beam.intersectsBox(bounds(plate)),'crossbar stays behind both plates');
  for(const aspect of [.55,1.3,2]){
    reset({depth,radius});
    const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(0,.2,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const before=new Map();model.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
    const explosion=createPartExplosion(model,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
    assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['stand','bath','tube','wedge']));
    t.ok(explosion.items.length===4,'liquid stays with its apparatus during separation');
    const inverse=camera.quaternion.clone().invert();
    const projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),p=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])p.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return p;});
    for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'inventory occupies disjoint screen rectangles');}
    explosion.update(0);explosion.dispose();model.root.updateMatrixWorld(true);model.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'reassembly restores apparatus'));inventories++;
  }
}
reset({});const changing=[B.tubeBack,B.tubeFront,B.column,B.sheet,B.menLiquid,B.lowerTube,B.lowerWedge],old=changing.map(m=>m.geometry),counts=old.map(()=>0);old.forEach((g,i)=>g.addEventListener('dispose',()=>counts[i]++));model.update({radius:.5});assert.deepEqual(counts,old.map(()=>1),'all replaced geometries released exactly once');
const resources=checkDisposal(model,t),clone=THREE.Material.prototype.clone,copies=[];let fresh;
try{THREE.Material.prototype.clone=function(){const material=clone.call(this),record={disposed:0};copies.push(record);material.addEventListener('dispose',()=>record.disposed++);return material;};fresh=createCapillaryModel();}finally{THREE.Material.prototype.clone=clone;}
fresh.dispose();fresh.dispose();t.ok(copies.every(c=>c.disposed===1),'construction-time material copies all released once');
console.log(JSON.stringify({passed:true,checks:t.count,inventories,contacts,resources}));

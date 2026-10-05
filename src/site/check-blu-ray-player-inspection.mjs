import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBluRayPlayerModel} from './blu-ray-player-model.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),model=createBluRayPlayerModel(),T=model.topology;
let inventories=0;
function outward(mesh){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index,count=index?index.count:p.count;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);const cross=b.sub(a).cross(c.sub(a));if(cross.lengthSq()>1e-22){normal.fromBufferAttribute(n,ids[0]);t.ok(cross.dot(normal)>0,'winding agrees with outward shading normal');}}
}
for(const mesh of [T.discBack,T.discFront,...T.bearings,...T.railSupports,...T.screwSupports,T.nut,T.lensHolder])outward(mesh);
for(const format of [0,1,2])for(const radius of [25,58])for(const aspect of [.55,1.3,2]){
  model.reset({settings:{format,radius},time:.75});model.root.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(40,aspect,.01,200);camera.position.set(1.1,1.9,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const before=new Map();model.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
  const explosion=createPartExplosion(model,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['chassis','spindle','disc','traverse','pickup','electronics']));
  t.ok(explosion.items.length===6,'six rigid physical assemblies; diagrams excluded');
  const inverse=camera.quaternion.clone().invert();
  const projected=explosion.items.map(item=>{const b=item.bounds.clone().translate(item.group.position),p=new THREE.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])p.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));return p;});
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'separated assemblies occupy disjoint screen rectangles');}
  explosion.update(0);explosion.dispose();model.root.updateMatrixWorld(true);model.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'reassembly restores mechanism'));inventories++;
}
const old=T.flex.geometry;let releasedFlex=0;old.addEventListener('dispose',()=>releasedFlex++);model.update({radius:41});t.ok(releasedFlex===1,'changing cable geometry is released once');
t.ok(T.status.material!==T.board.material,'status light never changes board color');
t.ok(model.covers.includes(T.frontSlot)&&model.covers.includes(T.status),'trim leaves with removed front panel');
t.ok(T.output.parent===T.chassis,'rear socket stays with its mounting panel during separation');
t.ok(T.status.parent===T.chassis,'front indicator stays with its mounting panel during separation');
t.ok(model.thumbnailOmit.length===5&&model.thumbnailOmit.every(o=>o.userData.inspectionOnly),'room thumbnails omit every enlarged inspection diagram');
t.ok(model.thumbnailOmit.every(o=>o.parent===T.system),'omitted diagrams stay attached for lesson inspection and disposal');
const resources=checkDisposal(model,t);
console.log(JSON.stringify({passed:true,checks:t.count,inventories,resources}));

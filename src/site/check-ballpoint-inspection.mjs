import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBallpointModel, MM, SPECK_RING} from './ballpoint-model.js';
import {BALL_SIZES} from './pens-physics.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkDisposal} from './model-check-kit.mjs';
const t = tally(), model = createBallpointModel(), B = model.topology;
let poses = 0, inventories = 0, vertexSamples = 0;
const localBox = object => {object.geometry.computeBoundingBox(); return object.geometry.boundingBox.clone().applyMatrix4(object.matrix);};
for (const ball of BALL_SIZES) for (const refill of [0,1]) for (const condition of [0,1,2]) {
  model.reset({settings:{ball,refill,condition},time:2.5}); model.root.updateMatrixWorld(true); const radius = ball / 2;
  const socket = localBox(B.socket), collar = localBox(B.collar), channel = localBox(B.channelInk);
  t.near(socket.max.y, collar.min.y, 2e-9, 'socket and reservoir collar join');
  t.near(collar.max.y, 4 * MM, 2e-9, 'collar joins reservoir at assigned height');
  t.near(channel.min.y, 2 * radius * MM, 2e-9, 'ink channel reaches top of rolling ball');
  t.near(channel.max.y, 4 * MM, 2e-9, 'ink channel joins reservoir');
  t.near(B.ink.position.y - B.ink.scale.y / 2, 4 * MM, 1e-12, 'reservoir ink reaches channel');
  t.near(B.ink.position.y + B.ink.scale.y / 2, B.float.position.y - B.float.scale.y / 2, 1e-12, 'separator touches ink');
  t.near(B.float.position.y + B.float.scale.y / 2, B.gas.position.y - B.gas.scale.y / 2, 1e-12, 'gas touches separator');
  t.near(B.gas.position.y + B.gas.scale.y / 2, B.seal.position.y - B.seal.scale.y / 2, 1e-12, 'gas chamber meets rear seal');
  const nose = localBox(B.noseBack), body = localBox(B.bodyBack);
  t.near(nose.max.y, body.min.y, 2e-9, 'barrel nose joins body');
  t.ok(nose.min.y <= collar.max.y + 2e-9, 'barrel nose supports the tip shoulder');
  t.ok(SPECK_RING.radius + SPECK_RING.size < 1, 'surface markers do not enter the close-up paper at bottom crossing');
  for (const object of [B.socket, B.collar, B.channelInk, B.noseBack, B.noseFront, B.rearPlug]) {
    const attr = object.geometry.attributes.position;
    for (let i=0;i<attr.count;i++) {t.ok([attr.getX(i),attr.getY(i),attr.getZ(i)].every(Number.isFinite), 'finite drawn vertex');vertexSamples++;}
  }
  poses++;
}
for (const ball of [.3,1.4]) for (const place of [0,1,2,3]) for (const aspect of [.7,1.3,2]) {
  model.reset({settings:{ball,place,refill:1},time:5}); model.root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(40, aspect, .01, 200);camera.position.set(0,.35,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const before = new Map();model.root.traverse(o=>before.set(o.uuid,o.matrixWorld.clone()));
  const explosion = createPartExplosion(model,camera,aspect,{width:600*aspect,height:600});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['barrel','refill','tip']));
  const inverse = camera.quaternion.clone().invert();
  const projected = explosion.items.map(item=>{
    const b=item.bounds.clone().translate(item.group.position),p=new THREE.Box3();
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])p.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));
    return p;
  });
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){
    const a=projected[i],b=projected[j];t.ok(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y,'inventory parts do not overlap');
  }
  explosion.update(0);explosion.dispose();model.root.updateMatrixWorld(true);
  model.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,before.get(o.uuid).elements,'explosion never mutates the working mechanism'));
  inventories++;
}
const resources=checkDisposal(model,t);
console.log(JSON.stringify({passed:true,checks:t.count,poses,vertexSamples,inventories,resources}));

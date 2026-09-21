import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMirrorsModel,sampleCatConstruction,MIRRORS_DEFAULTS} from './mirrors-model.js';
import {CAT_SHAPES,mirrorCatPose,intersectCatEllipsoid} from './mirror-cat.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const model=createMirrorsModel();let rays=0;
for(const mode of [0,1,2,3])for(const bearing of [-60,0,60])for(const offset of [-.3,0,.3]){
 const values={...MIRRORS_DEFAULTS,mode,bearing,offset};model.update(values);model.actions[3].run();model.root.updateMatrixWorld(true);
 const {sourceCat,eyeBody,reflectors,imageCat}=model.topology,pose=mirrorCatPose(values);
 assert.ok(sourceCat.visible);sourceCat.position.toArray().forEach((x,i)=>near(x,pose.position[i]));
 const gaze=new THREE.Vector3(1,0,0).applyQuaternion(sourceCat.quaternion),target=new THREE.Vector3(0,mode===3?1.2:0,0).sub(sourceCat.position).normalize();near(gaze.dot(target),1);
 if(mode!==2){const eyeGaze=new THREE.Vector3(0,0,1).applyQuaternion(eyeBody.quaternion),eyeTarget=new THREE.Vector3(0,mode===3?-1.2:0,0).sub(eyeBody.position).normalize();near(eyeGaze.dot(eyeTarget),1);}
 assert.equal(reflectors[0].mesh.material.type,'ShaderMaterial');
 if(mode===0){near(sourceCat.position.y,0);near(sourceCat.position.z,0);near(imageCat.position.x,-sourceCat.position.x);near(imageCat.scale.x,-sourceCat.scale.x);}
 if(mode===3){near(imageCat.position.x,-5.4);near(imageCat.position.y,-1.2);near(imageCat.scale.x,sourceCat.scale.x);}
 for(const ray of sampleCatConstruction(values)){
  const incoming=new THREE.Vector2(...ray.hit).sub(new THREE.Vector2(...ray.source)).normalize(),normal=new THREE.Vector2(...ray.normal),out=new THREE.Vector2(...ray.reflected);
  near(incoming.dot(normal),-out.dot(normal));near(incoming.clone().sub(normal.clone().multiplyScalar(incoming.dot(normal))).distanceTo(out.clone().sub(normal.clone().multiplyScalar(out.dot(normal)))),0);
  if(ray.virtual){const hit=ray.extensionStart||ray.hit,back=new THREE.Vector2(...ray.virtual).sub(new THREE.Vector2(...hit)).normalize(),direction=new THREE.Vector2(...(ray.secondReflected||ray.reflected));near(back.dot(direction),-1);}
  rays++;
 }
}
// Test positive roots, misses, non-unit directions and rays starting inside.
for(const [center,radius] of CAT_SHAPES){
 const o=[center[0]+3*radius[0],center[1],center[2]];
 near(intersectCatEllipsoid(o,[-2,0,0],center,radius),radius[0]);
 near(intersectCatEllipsoid(center,[0,1,0],center,radius),radius[1]);
 assert.equal(intersectCatEllipsoid(o,[1,0,0],center,radius),null);
 assert.equal(intersectCatEllipsoid(o,[0,1,0],center,radius),null);
}
model.update({...MIRRORS_DEFAULTS,mode:0});model.actions[3].run();
const p=model.topology.reflectors[0].mesh.geometry.attributes.position;
assert.ok([...Array(p.count).keys()].some(i=>p.getZ(i)>.7),'Default surface includes the positive-Z half');
assert.ok([...Array(p.count).keys()].some(i=>p.getZ(i)<-.7),'Default surface includes the negative-Z half');
model.actions[5].run();assert.ok([...Array(p.count).keys()].every(i=>p.getZ(i)<=1e-8),'Cutaway is explicit');
model.dispose();console.log(JSON.stringify({passed:true,poses:36,catConstructionRays:rays,ellipsoidCases:CAT_SHAPES.length*4,fullMirrorDefault:true}));

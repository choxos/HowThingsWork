import assert from 'node:assert/strict';
import * as THREE from 'three';
import {frameModel} from './machine-viewer.js';
import {createPowerPylonModel as model,powerPylonStatics as statics,powerPylonHeight as heightAt} from './power-pylon-model.js';
import {powerPylonLesson as lesson} from './power-pylon-lesson.js';
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const near=(a,b,tol=1e-9)=>ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const defaults={height:3,span:12,tension:18};
const states=[];for(let height=3;height<=6;height++)for(let span=8;span<=16;span+=2)for(let tension=12;tension<=36;tension+=6)states.push({height,span,tension});

function checkExactStatics(){
 for(const v of states){
  const e=statics(v),L=v.span,H=v.tension;
  near(heightAt(v,-L/2),v.height);near(heightAt(v,L/2),v.height);near(heightAt(v,0),e.minimumHeight);near(e.minimumHeight+e.sag,v.height);near(2*e.verticalSupportLoad,e.cableWeight);near(e.cableWeight,e.cableLength);near(Math.hypot(H,e.verticalSupportLoad),e.endpointTension);ok(e.minimumHeight>0,'all free cable centerlines above reference plane');
  let length=0;const N=10000,dx=L/N;for(let i=0;i<N;i++)length+=Math.hypot(1,Math.sinh((-L/2+(i+.5)*dx)/H))*dx;near(length,e.cableLength,2e-8);
  const higher=statics({...v,height:v.height+1});near(higher.sag,e.sag);near(higher.minimumHeight,e.minimumHeight+1);near(higher.cableLength,e.cableLength);near(higher.endpointTension,e.endpointTension);
  ok(statics({...v,span:L+1}).sag>e.sag,'wider span increases sag');ok(statics({...v,tension:H+1}).sag<e.sag,'greater horizontal tension reduces sag');ok(statics({...v,tension:H+1}).endpointTension>e.endpointTension,'greater horizontal tension increases support force in envelope');
 }
 const oracle=statics({height:2,span:10,tension:20});near(oracle.sag,.6282619975914643);near(oracle.cableLength,10.104492672326732);near(oracle.verticalSupportLoad,5.052246336163366);near(oracle.endpointTension,20.628261997591463);
 const worst=statics({height:3,span:16,tension:12});near(worst.minimumHeight,3-12*(Math.cosh(2/3)-1));ok(worst.minimumHeight>.23&&worst.minimumHeight<.24,'worst span is geometrically above plane');
}

function checkActualGeometry(){
 const m=model(),T=m.topology,S=T.scale;
 for(const v of states){
  m.update(v);m.root.updateMatrixWorld(true);const curve=T.cable.geometry.parameters.path,e=m.getState();
  for(const [tower,t,sign] of [[T.left,0,-1],[T.right,1,1]]){
   const clamp=tower.clamp.getWorldPosition(new THREE.Vector3()),endpoint=curve.getPoint(t).applyMatrix4(T.cable.matrixWorld);near(clamp.distanceTo(endpoint),0);near(tower.group.position.x,sign*v.span*S/2);near(tower.attachment.position.y,v.height*S);
   const bottom=new THREE.Box3().setFromObject(tower.bottomFitting),top=new THREE.Box3().setFromObject(tower.topFitting),body=new THREE.Box3().setFromObject(tower.dielectric);ok(!bottom.intersectsBox(top),'metal fittings electrically separated');ok(body.intersectsBox(bottom)&&body.intersectsBox(top),'dielectric physically joins both fittings');ok(top.intersectsBox(new THREE.Box3().setFromObject(tower.bars.at(-1))),'top fitting contacts actual crossarm');for(const bar of tower.bars)ok(!bottom.intersectsBox(new THREE.Box3().setFromObject(bar)),'tower bars do not bypass insulation');
   const direction=new THREE.Vector3(-sign*v.tension,-e.verticalSupportLoad,0).normalize();near(new THREE.Vector3(0,1,0).applyQuaternion(tower.arrow.quaternion).distanceTo(direction),0);const tangent=curve.getTangent(t).normalize().multiplyScalar(sign===-1?1:-1);near(tangent.distanceTo(direction),0,2e-5);
  }
  for(let i=0;i<=256;i++){const p=curve.getPoint(i/256),x=(i/256-.5)*v.span;near(p.x,x*S);near(p.y,heightAt(v,x)*S);near(p.z,.15);ok(p.y>0,'actual cable centerline above reference');near(p.y,curve.getPoint(1-i/256).y);}
  ok(m.framingBounds.containsBox(new THREE.Box3().setFromObject(m.root)),'declared maximum envelope contains every configuration');
 }
 m.dispose();
}

function checkInspectionAndPresets(){
 const m=model();assert.deepEqual(m.defaults,defaults);checks++;ok(m.controls.length===3,'three static configuration controls');ok(m.getState().measuredMinimum===null,'no measurement before inspection');
 for(const v of states){m.reset();m.update(v);const geometry=m.topology.cable.geometry;m.advance(1.2);const first=m.getState();near(first.progress,.2);near(first.scanX,-.3*v.span);near(first.measuredMinimum,heightAt(v,-.3*v.span));m.advance(2.4);const past=m.getState();near(past.progress,.6);near(past.measuredMinimum,statics(v).minimumHeight);ok(m.topology.cable.geometry===geometry,'inspection never animates/rebuilds static cable');m.advance(2.4);const done=m.getState();ok(done.complete,'six seconds completes sweep');near(done.scanX,0);near(done.scanHeight,done.minimumHeight);near(done.measuredMinimum,done.minimumHeight);}
 ok(lesson.tryIt.length===5,'five actual presets');const expected=[{height:3,span:12,tension:18},{height:5,span:12,tension:18},{height:3,span:16,tension:18},{height:3,span:12,tension:36},{height:3,span:16,tension:12}];
 for(const [i,p] of lesson.tryIt.entries())for(const history of [0,1,2]){m.reset();if(history){m.update({height:6,span:8,tension:12});m.advance(history===1?1.7:6);}m.reset();m.update(p.values);assert.deepEqual(m.getState().values,expected[i]);checks++;ok(m.getState().measuredMinimum===null,'preset resets measurement');m.advance(6);near(m.getState().measuredMinimum,statics(expected[i]).minimumHeight);ok(m.resultPart.available(),'finished result available');}
 m.reset();m.playback.step();near(m.getState().progress,.01);const paused=JSON.stringify(m.getState());m.advance(0);m.update();ok(JSON.stringify(m.getState())===paused,'pause stable');m.update({height:5});ok(m.getState().measuredMinimum===null,'edit clears measurement immediately');near(m.getState().height,5);m.actions[0].run();near(m.getState().values.height,5);m.advance(6);const done=JSON.stringify(m.getState());m.advance(100);ok(JSON.stringify(m.getState())===done,'completed result freezes');m.reset();const n=model();m.advance(6);for(let i=0;i<600;i++)n.advance(.01);near(m.getState().measuredMinimum,n.getState().measuredMinimum);m.dispose();n.dispose();
}

function checkDisposal(){
 const m=model(),resources=new Map();function watch(){m.root.traverse(o=>{if(o.geometry&&!resources.has(o.geometry)){resources.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>resources.set(o.geometry,resources.get(o.geometry)+1));}});}watch();for(const v of [{height:6,span:16,tension:12},{height:4,span:8,tension:36},defaults]){m.update(v);watch();m.advance(3);}m.dispose();for(const count of resources.values())ok(count===1,'static and replaced tower/cable geometry disposed once');
}

function checkVisibility(){
 let poses=0;
 for(const aspect of [1,1.16]){
  const m=model(),{camera}=frameModel(m,aspect);camera.zoom=1.15;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  for(const v of [{height:3,span:8,tension:12},{height:6,span:16,tension:36},{height:3,span:16,tension:12},defaults])for(const time of [1.2,3,6]){
   m.reset();m.update(v);m.advance(time);m.root.updateMatrixWorld(true);const T=m.topology,meshes=[];m.root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;meshes.push(o);});
   function seen(mesh){const a=mesh.geometry.attributes.position,index=mesh.geometry.index;const hit=p=>{p.applyMatrix4(mesh.matrixWorld).project(camera);const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);return Math.abs(p.x)<1&&Math.abs(p.y)<1&&ray.intersectObjects(meshes)[0]?.object===mesh;};for(let i=0;i<a.count;i+=4)if(hit(new THREE.Vector3().fromBufferAttribute(a,i)))return true;if(index)for(let i=0;i<index.count;i+=3){const p=new THREE.Vector3();for(let j=0;j<3;j++)p.add(new THREE.Vector3().fromBufferAttribute(a,index.getX(i+j)));if(hit(p.divideScalar(3)))return true;}return false;}
   for(const tower of [T.left,T.right])for(const mesh of [tower.clamp,tower.topFitting,tower.bottomFitting,tower.dielectric,tower.arrow.cone])ok(seen(mesh),'actual support fitting/insulation/force visible');for(const mesh of [T.marker,T.measureLine,T.foot,T.cable])ok(seen(mesh),'actual cable and inspection measurement visible');
   for(const mesh of meshes){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i+=36){const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).project(camera);ok(Math.abs(p.x)<.98&&Math.abs(p.y)<.98,'stable framing contains actual support/cable/marker geometry');}}poses++;
  }m.dispose();
 }
 return poses;
}
checkExactStatics();checkActualGeometry();checkInspectionAndPresets();checkDisposal();const poses=checkVisibility();
console.log(`Power pylon: ${checks} checks passed;100staticstates,exact endpoints/symmetry/lengthquadrature/forcebalance/tangentdirection;actualclamps/towerheight/dielectricattachment/no bypass/fixedmaxbounds;inspectionminimum/pause/step/edits/freeze,5presets×3histories,disposal and${poses}two-aspect visible configurations.`);

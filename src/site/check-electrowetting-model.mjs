import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElectrowettingModel} from './electrowetting-model.js';
import {electrowettingLesson} from './electrowetting-lesson.js';

const model=createElectrowettingModel(), g=model.topology;
const near=(a,b,tolerance=1e-7)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const snapshot=()=>JSON.stringify(model.getState());
const bounds=mesh=>new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).translate(mesh.position);
const overlap=(a,b)=>{const size=bounds(a).intersect(bounds(b)).getSize(new THREE.Vector3());return size.x*size.y*size.z;};
const volume=mesh=>{
  const p=mesh.geometry.attributes.position;let total=0;
  for(let i=0;i<p.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    total+=a.dot(b.cross(c))/6;
  }
  return total;
};
assert.equal(model.controls.length,5);assert.equal(model.parts.length,14);assert.equal(model.catalogParts.length,12);
assert.equal(electrowettingLesson.tryIt.length,8);assert.deepEqual(model.covers,[g.filters,g.water]);
for(const mesh of [g.battery,g.switchBase,g.controller,...g.chips,...g.bases])near(bounds(g.board).max.z,bounds(mesh).min.z);
for(let i=0;i<3;i++){
  const stack=[g.bases[i],g.electrodeSheets[i],g.coatings[i],g.oils[i]];
  for(let j=1;j<stack.length;j++)near(bounds(stack[j-1]).max.z,bounds(stack[j]).min.z);
  near(bounds(g.oils[i]).max.z,.13);near(bounds(g.waters[i]).max.z,bounds(g.lids[i]).min.z);
  for(const wall of g.walls)assert(overlap(g.bases[i],wall)<1e-8,'Reflecting base fits between cell walls');
  for(const hardware of [g.battery,g.switchBase,g.controller,...g.chips])assert(overlap(g.waters[i],hardware)<1e-8,'Hardware stays outside liquid cells');
  const contact=bounds(g.commonContacts[i]);assert(bounds(g.waters[i]).containsBox(contact),'Common contact lies inside conducting water');
  assert.equal(g.filterSheets[i].material.blending,THREE.MultiplyBlending);
  assert.equal(g.filterSheets[i].material.premultipliedAlpha,true);
}
let combinations=0,meshSamples=0;
const geometryIds=[...g.oils,...g.waters].map(mesh=>mesh.geometry.uuid);
for(let red=0;red<=2;red++)for(let green=0;green<=2;green++)for(let blue=0;blue<=2;blue++)for(const power of [0,1])for(const light of [0,1]){
  const settings={red,green,blue,power,light};
  for(const openings of [[0,0,0],[.8,.8,.8],[.15,.64,.3]]){
    model.reset({settings,openings});
    for(const dt of [0,.2,.4,.5,2]){
      model.advance(dt);const state=model.getState(),{now}=state;assert.deepEqual(state.values,settings);
      g.oils.forEach((mesh,i)=>{
        const oilBounds=bounds(mesh),waterBounds=bounds(g.waters[i]),x=[-1.55,0,1.55][i];
        near(volume(mesh),1.3*1.5*.03);near(volume(g.waters[i]),1.3*1.5*(.44-.03));
        near(oilBounds.min.x,x-.65);near(oilBounds.max.x,x+.65-1.3*now.open[i]);near(oilBounds.min.z,.10);
        assert(oilBounds.max.z<.54);near(waterBounds.min.x,x-.65);near(waterBounds.max.x,x+.65);near(waterBounds.max.z,.54);
        assert([...mesh.geometry.attributes.position.array,...g.waters[i].geometry.attributes.position.array].every(Number.isFinite));
        near(g.swatch.material.color[['r','g','b'][i]],now.open[i]/.8*light);
        assert.equal(g.reflected[i].visible,Boolean(light&&now.open[i]>1e-9));assert.equal(g.incident[i].visible,Boolean(light));
        near(g.reflected[i].userData.length===0?0:1,light&&now.open[i]>1e-9?1:0);
        if(g.reflected[i].visible){assert(g.reflected[i].position.x>oilBounds.max.x);assert(g.reflected[i].position.x<waterBounds.max.x);near(g.reflected[i].position.z,.041);}
        assert(g.chipTexts[i].userData.labelText.includes(['off','mid','full'][now.drive[i]]));meshSamples++;
      });
    }
    assert(model.playback.complete());
    assert.deepEqual(model.getState().now.drive,power?[red,green,blue]:[0,0,0]);
    assert.deepEqual(model.getState().now.open,power?[red*.4,green*.4,blue*.4]:[0,0,0]);
    const before=snapshot();for(const action of model.actions){action.run();assert.equal(snapshot(),before,'Inspection preserves state');}
  }
  combinations++;
}
assert.deepEqual([...g.oils,...g.waters].map(mesh=>mesh.geometry.uuid),geometryIds,'Liquid movement reuses geometry');
const outcomes=[];
for(const trial of electrowettingLesson.tryIt){
  assert.deepEqual(trial.values,trial.initialState.settings);assert(trial.reset&&trial.isolate&&trial.view==='front');
  assert(model.parts.some(part=>part.id===trial.part));model.reset(trial.initialState);
  const initial=model.getState();model.advance(100);const final=model.getState();outcomes.push(final.now.color.name);
  model.reset(model.replayState());assert.deepEqual(model.getState().now.open,initial.now.open);
  model.advance(100);assert.deepEqual(model.getState().now,final.now);
}
assert.deepEqual(outcomes,['Red','Yellow','White','Orange','Red','Dark','No incident light','Green']);
model.reset();model.advance(.4);const beforeLight=model.getState(),beforeOil=g.oils.map(mesh=>[...mesh.geometry.attributes.position.array]);
model.update({light:0});assert.deepEqual(g.oils.map(mesh=>[...mesh.geometry.attributes.position.array]),beforeOil);near(model.getState().clock,beforeLight.clock);
model.update({light:1});assert.deepEqual(model.getState().now.open,beforeLight.now.open);model.update({power:0});
assert.deepEqual(model.getState().now.open,beforeLight.now.open);model.advance(.4);assert(model.getState().now.open[0]<beforeLight.now.open[0]);
const partial=model.getState().now.open;model.update({power:1,red:0,green:2});assert.deepEqual(model.getState().now.open,partial);model.advance(100);assert.equal(model.getState().now.color.name,'Green');
model.reset();model.playback.step();near(model.getState().clock,.2);const before=snapshot();
for(const action of model.actions){action.run();assert.equal(snapshot(),before);assert.equal(action.replay,false);}
for(const bad of [{red:3},{green:.5},{blue:NaN},{power:2},{light:Infinity},{wetting:2},null,[]]){assert.throws(()=>model.update(bad));assert.equal(snapshot(),before);}
model.reset();model.root.updateMatrixWorld(true);
const closedEnd=new THREE.Vector3(.34,0,0).applyMatrix4(g.switchPivot.matrixWorld),contact=g.switchContacts[1].getWorldPosition(new THREE.Vector3());
near(closedEnd.distanceTo(contact),0);model.update({power:0});model.root.updateMatrixWorld(true);
assert(new THREE.Vector3(.34,0,0).applyMatrix4(g.switchPivot.matrixWorld).distanceTo(contact)>.1);
for(const {mesh,a,b} of g.wires){
  const length=mesh.geometry.parameters.height;
  const ends=[new THREE.Vector3(0,-length/2,0).applyMatrix4(mesh.matrixWorld),new THREE.Vector3(0,length/2,0).applyMatrix4(mesh.matrixWorld)];
  near(ends[0].distanceTo(new THREE.Vector3(...a)),0);near(ends[1].distanceTo(new THREE.Vector3(...b)),0);
}
const resources=new Set();model.root.traverse(object=>{
  if(object.geometry){resources.add(object.geometry);assert([...object.geometry.attributes.position.array].every(Number.isFinite));}
  for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
});
const disposed=new Map([...resources].map(resource=>[resource,0]));for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
model.dispose();model.dispose();assert([...disposed.values()].every(count=>count===1));
console.log(`PASS: ${combinations} control combinations, ${meshSamples} oil/water mesh samples, 8 complete trials, 14 parts, layer contacts, cell bounds, return motion, light preservation, replay, wiring and ${resources.size} singly disposed resources.`);

import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {houseComponents} from './house-components.js';
import {createBathroomScaleModel} from './bathroom-scale-model.js';
import {scaleCalibratingPlateLesson as lesson} from './scale-calibrating-plate-lesson.js';
import {componentParentIds,groupCatalogEntries} from './catalog-hierarchy.js';

const base=new URL('../../documentation/audit/evidence/scale-calibrating-plate/',import.meta.url);
const reference=JSON.parse(await readFile(new URL('independent-review/preset-anchors.json',base),'utf8'));
const hash=async path=>createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex');
assert.equal(reference.files['src/site/scale-calibrating-plate-lesson.js'],await hash('./scale-calibrating-plate-lesson.js'));
const near=(a,b,tol=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} != ${b}`);
const vector=(a,b)=>a.forEach((x,i)=>near(x,b[i]));
const component=houseComponents['Scale calibrating plate'],m=component.createModel(),parent=createBathroomScaleModel();
assert.equal(componentParentIds['scale-calibrating-plate'],'bathroom-scale');
const parentEntry={id:'bathroom-scale'},partEntry={id:'scale-calibrating-plate'};
assert.deepEqual(groupCatalogEntries([parentEntry,partEntry],[partEntry]),[{entry:parentEntry,components:[partEntry]}]);
assert.equal(component.lesson,lesson);assert.equal(component.isolate,false);assert.equal(m.initialPart,'calibration');assert.equal(m.autoFramePart,'calibration');assert.equal(m.resultPart.id,'calibration');assert.equal(m.resultPart.context,'system');assert.equal(parent.topology.plateTeaching,false);assert.equal(parent.topology.plateForceOverlay,null);assert.equal(m.initialCutaway,true);assert.equal(parent.initialCutaway,false);
const top=m.topology;let snapshots=0,numericComparisons=0,arrowContacts=0,framedVertices=0;
for(const [i,trial] of lesson.tryIt.entries()){
 const anchor=reference.cases[i];assert.deepEqual(trial.values,anchor.values);assert.equal(trial.reset,true);assert.equal(trial.part,'calibration');assert.equal(trial.isolate,false);assert.equal(trial.view,'front');
 for(const r of anchor.snapshots){
  m.reset();m.update(trial.values);m.advance(r.elapsed);parent.reset();parent.update(trial.values);parent.advance(r.elapsed);m.root.updateMatrixWorld(true);const s=m.getState(),p=parent.getState();
  for(const [key,expected] of Object.entries(r)){
   if(key==='physicalTime')continue;
   if(typeof expected==='number'){near(s[key],expected);numericComparisons++;}
   else if(['loadShares','plateShares'].includes(key)){vector(s[key],expected);numericComparisons+=expected.length;}
  }
  for(const [key,value] of Object.entries(p))if(key!=='readings')assert.deepEqual(s[key],value,'Component preserves parent '+key);
  assert.equal(s.readings.length,29);assert.ok(s.readings.every(r=>r.hint?.length>15));const readings=Object.fromEntries(s.readings.map(r=>[r.label,r.value]));
  for(const [j,name] of ['Left-front','Left-back','Right-front','Right-back'].entries()){
   const arrow=top.plateForceArrows[j],contact=top.system.worldToLocal(arrow.localToWorld(new THREE.Vector3(0,arrow.cone.position.y,0)));
   vector(contact.toArray(),r.plateContacts[j]);vector(new THREE.Vector3(0,1,0).applyQuaternion(arrow.quaternion).toArray(),[0,-1,0]);assert.equal(arrow.visible,r.plateShares[j]>0);near(parseFloat(readings[name+' plate force']),Number(r.plateShares[j].toFixed(2)),.00000051);arrowContacts++;
  }
  const mainContact=top.system.worldToLocal(top.mainPlateArrow.getWorldPosition(new THREE.Vector3())),crankContact=top.system.worldToLocal(top.crankPlateArrow.localToWorld(new THREE.Vector3(0,top.crankPlateArrow.cone.position.y,0)));
  vector(mainContact.toArray(),r.forcePositions[4]);vector(crankContact.toArray(),r.forcePositions[5]);vector(new THREE.Vector3(0,1,0).applyQuaternion(top.mainPlateArrow.quaternion).toArray(),[0,1,0]);assert.equal(top.mainPlateArrow.visible,true);assert.equal(top.crankPlateArrow.visible,true);arrowContacts+=2;
  assert.equal(top.plateForceOverlay.parent,top.calibration);assert.ok(top.contactArrows.every(a=>!a.visible));assert.equal(top.loadArrow.visible,false);assert.equal(top.operatorArrow.visible,false);
  const bounds=m.frameBoundsForPart('calibration').clone().expandByScalar(1e-8);
  for(const object of top.plateContextObjects)object.traverse(mesh=>{const positions=mesh.geometry?.attributes.position;if(!positions)return;for(let j=0;j<positions.count;j++){assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld)));framedVertices++;}});
  snapshots++;
 }
}
parent.dispose();
// Component playback, actions and direct updates preserve the parent time contract.
m.reset();m.playback.step();near(m.getState().elapsed,.08);m.advance(.92);near(m.getState().loadFraction,.5);m.advance(6);near(m.getState().loadFraction,.5);m.advance(1);assert.ok(m.playback.complete());near(m.getState().plateTravel,0);near(m.getState().inputWork,0);
for(const [i,t] of [0,2,6,8].entries()){assert.equal(m.actions[i].part,'calibration');m.actions[i].run();near(m.getState().elapsed,t);}
m.reset();m.actions[1].run();const loaded=m.getState();m.update({zero:5});near(m.getState().plateTravel,loaded.plateTravel);near(m.getState().indicatedMass,loaded.indicatedMass+5);m.update({position:-.75});near(m.getState().plateTravel,loaded.plateTravel);assert.ok(m.getState().guideMoment<0);m.reset();near(m.getState().elapsed,0);assert.equal(m.playback.complete(),false);
const resources=new Set();m.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(mat);if(mat.gradientMap)resources.add(mat.gradientMap);}});const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));m.dispose();m.dispose();assert.ok([...counts.values()].every(n=>n===1));
const files={};for(const name of ['bathroom-scale-model.js','bathroom-scale-physics.js','scale-calibrating-plate-lesson.js','house-components.js','check-scale-calibrating-plate-model.mjs'])files['src/site/'+name]=await hash('./'+name);
const result={passed:true,presets:lesson.tryIt.length,snapshots,numericComparisons,arrowContacts,framedVertices,resources:resources.size,files,checks:['independent preset references including partial loading and unloading','component-parent state parity','actual arrow contact positions and force directions','context geometry containment','playback actions and reset','zero and load-position invariance','one-time resource disposal']};await writeFile(new URL('model-results.json',base),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

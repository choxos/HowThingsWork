import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCalculatorAdditionModel} from './calculator-addition-model.js';
import {calculatorAdditionLesson as lesson} from './calculator-addition-lesson.js';
import {ADD_DEFAULTS, ADD_KEYS, additionPlan} from './calculator-addition-physics.js';
import {createStudyModel} from './study-models.js';
import {studyLessons} from './study-lessons.js';

const model=createCalculatorAdditionModel(),g=model.topology;
const near=(a,b,tolerance=1e-7)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const bounds=mesh=>{mesh.updateMatrix();return new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).applyMatrix4(mesh.matrix);};
const distance=(a,b)=>Math.hypot(...[0,1,2].map(axis=>{
  const first=a.userData.ends.map(point=>point[axis]),second=b.userData.ends.map(point=>point[axis]);
  return Math.max(0,Math.min(...first)-Math.max(...second),Math.min(...second)-Math.max(...first));
}));
const rows=g.rows.map((net,index)=>[...net,...g.pads.filter(pad=>pad.row===index).flatMap(pad=>pad.rowLead)]);
const columns=g.columns.map((net,index)=>[...net,...g.pads.filter(pad=>pad.column===index).flatMap(pad=>pad.columnLead)]);
const nets=[...rows,...columns];let conductorPairs=0,minClearance=Infinity;
for(let first=0;first<nets.length;first++)for(let second=first+1;second<nets.length;second++)for(const a of nets[first])for(const b of nets[second]){const clearance=distance(a,b)-.014;assert(clearance>0,'Different matrix nets must not touch');minClearance=Math.min(minClearance,clearance);conductorPairs++;}
assert.deepEqual(model.controls.map(control=>control.key),Object.keys(ADD_DEFAULTS));assert.equal(model.parts.length,16);assert.equal(model.catalogParts.length,14);assert.equal(lesson.tryIt.length,8);
assert.deepEqual(model.covers,[g.keys,g.facegrid,g.display]);assert.deepEqual(model.thumbnailOmit,[g.matrixview,g.adder,g.decoder,g.optics]);
for(const id of ['matrixview','adder','decoder','optics']){assert.equal(g[id].userData.inspectionOnly,id);assert.equal(g[id].userData.explosionExcluded,true);assert.deepEqual(model.inspectionObjects(id),[g[id]]);}
near(bounds(g.rear).max.z,bounds(g.substrate).min.z);near(bounds(g.substrate).max.z,bounds(g.cell).min.z);near(bounds(g.substrate).max.z,bounds(g.packageMesh).min.z);
for(let index=1;index<g.layers.length;index++)near(bounds(g.layers[index]).min.z,bounds(g.layers[index-1]).max.z);
assert(bounds(g.screen).min.z>=bounds(g.layers.at(-1)).max.z-1e-7);
assert(bounds(g.ribbon[0]).min.y<=bounds(g.packageMesh).max.y+1e-7);assert(bounds(g.ribbon[0]).min.z<bounds(g.packageMesh).max.z);
assert(bounds(g.ribbon[1]).max.z>bounds(g.layers[0]).min.z);assert(bounds(g.ribbon[1]).max.y>bounds(g.layers[0]).min.y);
for(const pad of g.pads){near(pad.left.position.x,pad.x-.065);near(pad.right.position.x,pad.x+.065);assert(bounds(pad.right).min.x-bounds(pad.left).max.x>.0299);}
for(const cap of g.caps){near(cap.group.position.z+bounds(cap.contact).min.z,.15);near(cap.group.position.z-.07+bounds(cap.contact).min.z,bounds(g.pads.find(pad=>pad.key===cap.key).left).max.z);}
model.root.updateMatrixWorld(true);
for(const lead of [...nets.flat(),...g.powerLeads,...g.rowLines.flat(),...g.columnLines.flat()]){
  const height=lead.geometry.parameters.height;for(const [index,sign] of [-1,1].entries())near(new THREE.Vector3(0,sign*height/2,0).applyMatrix4(lead.matrixWorld).distanceTo(new THREE.Vector3(...lead.userData.ends[index]).applyMatrix4(lead.parent.matrixWorld)),0);
}
for(const paths of g.lightPaths){const down=new THREE.Vector3(0,1,0).applyQuaternion(paths.towardMirror.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(paths.reflected.quaternion);near(down.x,up.x);near(down.y,-up.y);near(paths.reflected.position.y,bounds(g.opticalLayers[3]).max.y+.01);}
const originalGeometry=[g.screen,...g.digits.flatMap(digit=>Object.values(digit)),...g.caps.map(cap=>cap.cap)].map(mesh=>mesh.geometry.uuid);
let combinations=0,segments=0;
for(let first=0;first<100;first++)for(let second=0;second<100;second++)for(const power of [0,1])for(const ambient of [0,1]){
  const settings={first,second,power,ambient};model.reset({settings});model.advance(100);const {now,values,readings}=model.getState();assert.deepEqual(values,settings);assert.equal(now.result,power?first+second:null);
  assert.equal(g.screen.material.color.getHex(),ambient?0xc6d1ba:0);
  for(let digit=0;digit<3;digit++)for(const segment of 'abcdefg'){
    const on=now.digits[digit].mask.includes(segment);assert.equal(g.digits[digit][segment].material.color.getHex(),ambient?on?0x1c241a:0xc6d1ba:0);assert.equal(g.decoderDigits[digit][segment].material.color.getHex(),on?0x374736:0xe2e2cb);segments++;
  }
  for(const [index,paths] of g.lightPaths.entries()){
    assert.equal(paths.incident.visible,Boolean(ambient));const visible=Boolean(ambient&&!(index===0&&now.digits[2].mask.includes('a')));assert.equal(paths.towardMirror.visible,visible);assert.equal(paths.reflected.visible,visible);
  }
  assert.equal(readings[0].value,!ambient?'Screen dark':!power?'Blank display':`${first+second} · result`);
  assert(readings.every(reading=>!/(NaN|undefined|Infinity|null)/.test(reading.value+' '+reading.hint)));assert.equal(model.playback.complete(),Boolean(power));assert.equal(model.playback.blocked(),!power);combinations++;
}
assert.deepEqual([g.screen,...g.digits.flatMap(digit=>Object.values(digit)),...g.caps.map(cap=>cap.cap)].map(mesh=>mesh.geometry.uuid),originalGeometry);
const allKeys=new Set();let scanSamples=0;
for(const first of [0,1,2,3,4,5,6,7,8,9]){
  const plan=additionPlan({first,second:0});for(const event of plan.keys){allKeys.add(event.key);for(const time of [event.start+.01,event.start+.15,event.start+.27,event.start+.39,event.accept-.01,event.accept]){
    model.reset({settings:plan.values,time});const {now}=model.getState();for(const cap of g.caps)near(cap.group.position.z,now.pressed===cap.key?.23:.30);
    g.rows.forEach((net,index)=>net.forEach(mesh=>assert.equal(mesh.material.color.getHex(),index===now.scanRow?0xe3b45e:0xb4c5b0)));
    g.columns.forEach((net,index)=>net.forEach(mesh=>assert.equal(mesh.material.color.getHex(),index===now.columnLow?0xe3b45e:0xb4c5b0)));
    assert.equal(g.acceptedLabel.userData.labelText,`Accepted: ${now.acceptedKeys.join(' ')||'none'}`);
    const before=JSON.stringify(model.getState());for(const action of model.actions){action.run();assert.equal(JSON.stringify(model.getState()),before);assert.equal(action.replay,false);}scanSamples++;
  }}
}
assert.deepEqual([...allKeys].sort(),[...ADD_KEYS].sort());
const outcomes=[];
for(const trial of lesson.tryIt){assert.deepEqual(trial.values,trial.initialState.settings);assert(trial.reset&&trial.isolate&&trial.view==='front');model.reset(trial.initialState);const before=model.getState();model.advance(100);const after=model.getState();outcomes.push([after.now.result,after.readings[0].value]);model.reset(model.replayState());assert.deepEqual(model.getState().now,before.now);model.advance(100);assert.deepEqual(model.getState().now,after.now);}
assert.deepEqual(outcomes,[[34,'34 · result'],[37,'37 · result'],[100,'100 · result'],[198,'198 · result'],[0,'0 · result'],[9,'9 · result'],[null,'Blank display'],[34,'Screen dark']]);
model.reset();assert(!model.getState().readings.some(reading=>reading.value.includes('34')));assert.equal(model.getState().now.result,null);model.playback.step();near(model.getState().clock,.12);model.animate(.4);near(model.getState().clock,.52);model.animate(.7);near(model.getState().clock,.82);
const saved=JSON.stringify(model.getState());for(const input of [null,[],{first:-1},{second:100},{power:2},{ambient:NaN},{unknown:1}]){assert.throws(()=>model.update(input));assert.equal(JSON.stringify(model.getState()),saved);}
for(const seconds of [null,-1,NaN,Infinity]){assert.throws(()=>model.advance(seconds));assert.equal(JSON.stringify(model.getState()),saved);}
const exposed=model.getState();exposed.now.acceptedKeys.push('bad');exposed.values.first=100;exposed.readings[0].value='bad';assert.equal(JSON.stringify(model.getState()),saved);
model.advance(100);const lit=JSON.stringify(model.getState().now);model.update({ambient:0});assert.equal(model.getState().now.result,34);model.update({ambient:1});assert.equal(JSON.stringify(model.getState().now),lit);model.update({second:1});assert.equal(model.getState().now.result,null);assert.equal(model.getState().now.readback,'0');
assert.equal(studyLessons.Calculator,lesson);const routed=createStudyModel('Calculator');assert.deepEqual(routed.controls,model.controls);routed.advance(100);assert.equal(routed.getState().now.result,34);routed.dispose();
const text=JSON.stringify(lesson)+model.parts.map(part=>part.name+part.description).join('')+model.controls.map(control=>control.label+control.help).join('');assert(!/[—–]| - |--/.test(text));assert(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|fibre|aluminium)\b/i.test(text));
const resources=new Set();model.root.traverse(object=>{
  assert([...object.position.toArray(),...object.scale.toArray(),...object.quaternion.toArray()].every(Number.isFinite));
  if(object.geometry){resources.add(object.geometry);assert([...object.geometry.attributes.position.array].every(Number.isFinite));}
  for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
});
const disposed=new Map([...resources].map(resource=>[resource,0]));for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));model.dispose();model.dispose();assert([...disposed.values()].every(count=>count===1));
console.log(JSON.stringify({status:'PASS',combinations,segments,scanSamples,conductorPairs,minClearance,parts:16,trials:8,disposed:resources.size}));

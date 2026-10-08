import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOpticalReadoutModel} from './optical-readout-model.js';
import {opticalReadoutLesson as lesson} from './optical-readout-lesson.js';
import {READOUT,READOUT_DEFAULTS as D,readoutPlan,readoutAt} from './optical-readout-physics.js';
import {houseComponents} from './house-components.js';
const model=createOpticalReadoutModel(),g=model.topology;
assert.equal(houseComponents['Optical-disc readout'].createModel,createOpticalReadoutModel);
assert.equal(houseComponents['Optical-disc readout'].lesson,lesson);
assert.equal(model.initialPart,'assembly');assert.equal(model.parts.length,new Set(model.parts.map(p=>p.id)).size);
assert.deepEqual(model.inspectionObjects('signal'),[g.signal]);assert.equal(g.track.parent,g.pickup,'pickup inspection retains the illuminated track');
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
model.root.updateMatrixWorld(true);
const sceneBounds=new THREE.Box3().setFromObject(model.root),assemblyBounds=new THREE.Box3().setFromObject(g.assembly);
assert(sceneBounds.getCenter(new THREE.Vector3()).distanceTo(assemblyBounds.getCenter(new THREE.Vector3()))<1e-7,'Reset view centers the connected assembly, not the hidden signal panel');
const span=box=>Math.max(...box.getSize(new THREE.Vector3()).toArray());
close(span(assemblyBounds)*(model.overviewZoom??1.15)/(span(sceneBounds)*.7),1/.52);
const rows=()=>Object.fromEntries(model.getState().readings.map(r=>[r.label,r.value]));
function geometryCheck(){
  model.root.updateMatrixWorld(true);
  model.root.traverse(o=>{
    assert(o.matrixWorld.elements.every(Number.isFinite),o.name+': finite transform');
    const p=o.geometry?.attributes?.position;if(p)assert([...p.array].every(Number.isFinite),o.name+': finite vertices');
  });
  const s=model.getState();assert.equal(g.outgoing.visible,s.values.power>0);assert.equal(g.returning.visible,s.values.power>0);
  assert.equal(g.flow.visible,s.signalPresent);close(g.blade.position.y,s.values.blocked?-.65:.15);
  assert.equal(g.outgoing.geometry.attributes.position.getY(3),Math.fround(1.55-(s.track.levels[Math.floor(s.travel)]===0?.08:.16)));
  assert.equal(g.sampleDots.filter(x=>x.visible).length,s.sampleCount);
  assert.equal(g.estimated.map(x=>x.userData.labelText).join('').replaceAll('·',''),s.bits.join(''));
  assert.equal(g.known.map(x=>x.userData.labelText).join(''),s.track.bits.join(''));
  close(g.currentLabel.userData.labelText.match(/([\d.]+) μA/)[1]*1e-6,Number((s.current*1e6).toFixed(2))*1e-6);
  assert(!Object.values(rows()).some(x=>/undefined|NaN|Infinity/.test(x)));
}
let combinations=0;
for(const pattern of [0,1])for(let power=0;power<=100;power+=5)for(const blocked of [0,1])for(const noise of [0,1,2])for(const decoder of [0,1]){
  const settings={pattern,power,blocked,noise,decoder};model.reset({settings});model.advance(100);
  const p=readoutPlan(settings),expected=readoutAt(p,p.duration),s=model.getState();
  assert.deepEqual(s.bits,expected.bits);assert.deepEqual(s.received,expected.received);assert(s.complete);
  geometryCheck();combinations++;
}
const expectedErrors=[0,0,0,0,2,10,0,0,8];
for(const [i,e] of lesson.tryIt.entries()){
  assert(e.reset);assert.deepEqual(e.values,e.initialState.settings);assert.deepEqual(Object.keys(e.values),Object.keys(D));
  model.reset(e.initialState);assert.equal(model.getState().time,0);assert.deepEqual(model.getState().values,e.values);
  for(let step=0;step<31;step++)model.playback.step();
  const s=model.getState();assert(s.complete);assert.equal(s.errors,expectedErrors[i],e.title);
  const before={time:s.time,bits:s.bits,rows:rows()};
  for(const a of model.actions){a.run();assert.equal(model.getState().time,before.time);assert.deepEqual(model.getState().bits,before.bits);assert.deepEqual(rows(),before.rows);}
  model.reset(model.replayState());assert.equal(model.getState().time,0);assert.deepEqual(model.getState().values,e.values);geometryCheck();
}
model.reset();model.playback.step();close(model.getState().time,1/READOUT.cellsPerSecond);
model.advance(.1);const time=model.getState().time;model.update({noise:0});assert.equal(model.getState().time,time);
model.update({noise:1});assert.equal(model.getState().time,0);
const normal=new THREE.Vector3(1,0,0).applyQuaternion(g.fold.quaternion),incoming=new THREE.Vector3(1,0,0);
assert(incoming.clone().reflect(normal).distanceTo(new THREE.Vector3(0,1,0))<1e-12,'fold mirror directs horizontal ray upward');
const splitNormal=new THREE.Vector3(1,0,0).applyQuaternion(g.splitterFace.quaternion);
assert(new THREE.Vector3(-1,0,0).reflect(splitNormal).distanceTo(new THREE.Vector3(0,0,1))<1e-12,'return reflection goes to detector');
model.root.updateMatrixWorld(true);
const bounds=o=>new THREE.Box3().setFromObject(o);
const nearGeometry=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} does not meet ${b}`);
nearGeometry(bounds(g.foldBacking).min.y,bounds(g.foldSupport).max.y);
nearGeometry(bounds(g.foldSupport).min.y,bounds(g.base).max.y);
nearGeometry(bounds(g.detectorPost).min.y,bounds(g.detectorBracket).max.y);
nearGeometry(bounds(g.detectorPost).max.y,bounds(g.detectorFrame).min.y);
nearGeometry(bounds(g.board).min.y,bounds(g.boardStand).max.y);
// Each receiving area must be exposed to the returning beam, not hidden by its support.
for(const cell of g.cells){
  const origin=new THREE.Vector3(cell.position.x,cell.position.y,.64),ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,1));
  const hits=ray.intersectObjects([g.detectorFrame,...g.cells],true);
  assert(hits[0]?.object===cell,'return light reaches silicon before the detector frame');
}
// Beam reaches the exposed detector plane, or the inserted blade, not beyond it.
for(const blocked of [0,1]){model.update({blocked});const p=g.returning.geometry.attributes.position;assert.equal(p.getZ(3),Math.fround(blocked?.58:1.08));}
const before=model.getState();assert.throws(()=>model.update({power:-1}));assert.deepEqual(model.getState(),before);
let disposed=0;const geometries=new Set();model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposed++);
model.dispose();assert.equal(disposed,geometries.size);model.dispose();assert.equal(disposed,geometries.size);
console.log(`PASS: ${combinations} model/control combinations, 9 prepared experiments, optical routing, sampled output, inspection preservation, replay, finite geometry and disposal.`);

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPrinterModel,planPrinterJob,printerConstants as C} from './printer-model.js';
import {printerReelLesson as lesson} from './printer-reel-lesson.js';
import {houseComponents} from './house-components.js';
import {neighborhoodCatalog as catalog} from './catalog-data.js';
const mapping=houseComponents['Printer filament reel'];assert.equal(mapping.machine,'3D printer');assert.equal(mapping.part,'filament');assert.equal(mapping.lesson,lesson);assert.equal(mapping.isolate,false);assert.equal(catalog.entries.filter(e=>e.name==='Printer filament reel').length,1);
const m=createPrinterModel(),part=id=>m.parts.find(p=>p.id===id).object,close=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),TAU=2*Math.PI,perRadian=Math.hypot(C.reelRadius,C.filamentDiameter*C.scale/TAU),initialLength=C.reelTurns*TAU*perRadian/C.scale;
const prepare=i=>{const p=lesson.tryIt[i];m.reset(p.initialState);m.update(p.values);assert.ok(m.parts.some(x=>x.id===p.part));return m.getState();};
const finish=()=>{m.advance(150);return m.getState();};
const check=()=>{const s=m.getState();close(s.reelRemaining+s.filamentConsumed,initialLength);close(s.reelUnwound,s.filamentConsumed*C.scale/(TAU*perRadian));close(s.supplySpan,42);assert.ok(s.reelRemaining>0);close(part('spool').rotation.z,-s.reelUnwound*TAU);const path=part('reel').children.find(x=>x.geometry?.type==='TubeGeometry').geometry.parameters.path;assert.ok(path.getTangent(1).x>0);const start=path.getPoint(0),original=new THREE.Vector3(C.reelRadius*Math.cos(Math.PI/2+C.reelTurns*TAU),C.reelRadius*Math.sin(Math.PI/2+C.reelTurns*TAU),-.31);original.applyAxisAngle(new THREE.Vector3(0,0,1),part('spool').rotation.z);close(start.distanceTo(original),0);return s;};
try{
 prepare(0);check();m.advance(1);assert.equal(check().reelUnwound,0);m.advance(8);const job=planPrinterJob(.2);let traveled=false;
 for(let i=0;i<2000;i++){const s=m.getState(),segment=job.segments[s.segmentIndex];if(segment&&!segment.deposit&&segment.length-s.segmentDistance>m.getState().values.speed*1.5*C.step+1e-8){const before=check(),entry=[...part('filament').userData.entry];m.advance(C.step/C.clockScale);const after=check();assert.notDeepEqual(after.position,before.position);assert.notDeepEqual(part('filament').userData.entry,entry);assert.equal(after.filamentConsumed,before.filamentConsumed);assert.equal(after.reelRemaining,before.reelRemaining);assert.equal(after.reelUnwound,before.reelUnwound);assert.equal(before.plasticFlow,0);traveled=true;break;}m.advance(C.step/C.clockScale);}assert.ok(traveled,'Observe actual nondepositing head travel without reel payout');
 const normal=finish();check();assert.ok(normal.complete);close(normal.filamentConsumed,47.7149897372);close(normal.reelRemaining,92.6123180179);close(normal.reelUnwound,1.1900924115);assert.equal(normal.plasticFlow,0);
 for(const i of [1,2]){prepare(i);const done=finish();check();assert.ok(done.complete);close(done.reelRemaining,normal.reelRemaining);close(done.reelUnwound,normal.reelUnwound);if(i===1)assert.ok(done.elapsed>normal.elapsed);else assert.equal(done.layerCount,6);}
 prepare(3);assert.ok(finish().blocked);assert.equal(check().reelUnwound,0);m.update({temperature:200});assert.ok(finish().complete);check();
 const partial=prepare(4);assert.ok(partial.reelUnwound>0&&partial.reelUnwound<normal.reelUnwound);assert.ok(finish().blocked);assert.equal(check().reelUnwound,partial.reelUnwound);assert.equal(part('filament').children[0].visible,false);m.update({loaded:1});assert.equal(part('filament').children[0].visible,true);assert.ok(finish().complete);close(check().reelUnwound,normal.reelUnwound);
 m.reset();close(check().reelRemaining,initialLength);assert.equal(m.getState().filamentConsumed,0);
 console.log('PASS five reel presets, correct payout/core/winding phase, actual nondepositing head travel with constant supply and unchanged reel, winding conservation, equal final fine/coarse/slow usage, cold and interrupted recovery.');
}finally{m.dispose();}

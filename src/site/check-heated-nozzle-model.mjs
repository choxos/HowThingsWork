import assert from 'node:assert/strict';
import {createPrinterModel,planPrinterJob,printerConstants as C} from './printer-model.js';
import {heatedNozzleLesson as lesson} from './heated-nozzle-lesson.js';
import {houseComponents} from './house-components.js';
import {neighborhoodCatalog as catalog} from './catalog-data.js';
const mapping=houseComponents['Heated extrusion nozzle'];
assert.equal(mapping.machine,'3D printer');assert.equal(mapping.part,'extruder');assert.equal(mapping.lesson,lesson);assert.equal(mapping.isolate,false);
assert.equal(catalog.entries.filter(e=>e.name==='Heated extrusion nozzle').length,1);
const m=createPrinterModel(),part=id=>m.parts.find(p=>p.id===id).object;
const prepare=i=>{const p=lesson.tryIt[i];m.reset(p.initialState);m.update(p.values);assert.ok(m.parts.some(x=>x.id===p.part));return m.getState();};
const flow=()=>{for(let i=0;i<4000;i++){const s=m.getState();if(s.plasticFlow>0)return s;m.advance(.02);}assert.fail('No deposition');};
const finish=()=>{for(let i=0;i<5000;i++){const s=m.getState();if(s.complete||s.blocked)return s;m.advance(.05);}assert.fail('No terminal state');};
try{
 assert.equal(part('hotend').parent,part('extruder'));assert.equal(part('nozzle').parent,part('hotend'));assert.equal(part('material-in-head').parent,part('hotend'));assert.equal(part('feed-gears').parent,part('extruder'));
 prepare(0);assert.equal(m.getState().plasticFlow,0);m.advance(.1);assert.equal(m.getState().plasticFlow,0);assert.ok(m.getState().temperature>C.ambient);
 const normal=flow();assert.equal(normal.plasticFlow,2.4);assert.ok(Math.abs(normal.filamentFeed-2.4/(Math.PI*1.75**2/4))<1e-12);
 const before=m.getState();m.advance(.005);const after=m.getState();assert.ok(Math.abs((after.extrudedVolume-before.extrudedVolume)/(.005*C.clockScale)-2.4)<1e-8);assert.ok(Math.abs((after.filamentConsumed-before.filamentConsumed)/(.005*C.clockScale)-normal.filamentFeed)<1e-8);
 let travel=false;for(let i=0;i<2000;i++){m.advance(.005);const s=m.getState(),seg=planPrinterJob(.2).segments[s.segmentIndex];if(seg&&!seg.deposit){assert.equal(s.plasticFlow,0);assert.equal(s.filamentFeed,0);travel=true;break;}}assert.ok(travel);
 const done=finish();assert.ok(done.complete);assert.equal(done.plasticFlow,0);assert.equal(done.filamentFeed,0);
 prepare(1);const cold=finish();assert.ok(cold.blocked);assert.equal(cold.extrudedVolume,0);assert.equal(cold.plasticFlow,0);m.update({temperature:200});assert.ok(flow().plasticFlow>0);assert.ok(finish().complete);
 const partial=prepare(2);assert.ok(partial.temperature>=170);assert.ok(partial.extrudedVolume>0);assert.equal(partial.plasticFlow,0);assert.equal(finish().extrudedVolume,partial.extrudedVolume);m.update({loaded:1});assert.ok(flow().plasticFlow>0);assert.ok(Math.abs(finish().extrudedVolume-done.extrudedVolume)<1e-8);
 prepare(3);const slow=flow();assert.equal(slow.plasticFlow,normal.plasticFlow/2);assert.equal(slow.filamentFeed,normal.filamentFeed/2);assert.ok(Math.abs(finish().extrudedVolume-done.extrudedVolume)<1e-8);
 prepare(4);const thick=flow();assert.equal(thick.plasticFlow,normal.plasticFlow*2);assert.equal(thick.filamentFeed,normal.filamentFeed*2);const coarse=finish();assert.ok(Math.abs(coarse.extrudedVolume-done.extrudedVolume)<1e-8);assert.equal(coarse.layerCount,6);
 m.reset();assert.equal(m.getState().plasticFlow,0);assert.equal(m.getState().extrudedVolume,0);
 console.log('PASS nozzle mapping, connected bore/feed geometry, five exact presets, actual deposition derivative and travel/heat/interlock/completion zero flow, recovery, half/double rates and preserved total volume.');
}finally{m.dispose();}

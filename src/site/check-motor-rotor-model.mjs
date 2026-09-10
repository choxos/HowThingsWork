import assert from 'node:assert/strict';
import {createUniversalMotorModel} from './universal-motor-model.js';
import {motorRotorLesson as lesson} from './motor-rotor-lesson.js';
import {houseComponents} from './house-components.js';
import {neighborhoodCatalog as catalog} from './catalog-data.js';

const mapping=houseComponents['Motor rotor'];
assert.equal(mapping.machine,'Universal motor');assert.equal(mapping.part,'rotor');
assert.equal(mapping.lesson,lesson);assert.equal(mapping.isolate,false);
assert.equal(catalog.entries.filter(e=>e.name==='Motor rotor').length,1);
const model=createUniversalMotorModel(),part=id=>model.parts.find(p=>p.id===id).object;
const prepare=index=>{const experiment=lesson.tryIt[index];model.reset(experiment.initialState);model.update(experiment.values);assert.ok(model.parts.some(p=>p.id===experiment.part));return model.getState();};
const run=()=>{for(let i=0;i<2000;i++){const s=model.getState();if(s.complete||s.blocked)return s;model.advance(.05);}assert.fail('Rotor action did not finish');};
try{
 prepare(0);const signs=new Set();let previousAngle=model.getState().theta;
 for(let i=0;i<100;i++){
  model.playback.step();const s=model.getState();signs.add(Math.sign(s.branchCurrents[0]));assert.ok(s.theta>=previousAngle);previousAngle=s.theta;
  assert.equal(part('rotor').rotation.z,s.theta);assert.equal(part('coil-0').parent,part('armature-windings'));assert.equal(part('armature-windings').parent,part('rotor'));assert.equal(part('fan').parent,part('rotor'));assert.notEqual(part('brushes').parent,part('rotor'));
 }
 assert.ok(signs.has(1)&&signs.has(-1),'Branch current reverses while body keeps rotating');const normal=run();assert.ok(normal.rpm>0&&normal.fanPower>0);
 prepare(1);assert.deepEqual(model.getState().shortedCoils,[1]);model.playback.step();const handover=model.getState();assert.deepEqual(handover.shortedCoils,[1]);assert.ok(handover.omega>0);assert.ok(Math.abs(handover.branchCurrents[1])>0);assert.ok(run().complete);
 prepare(2);const loaded=run();assert.ok(loaded.rpm>0&&loaded.rpm<normal.rpm);
 prepare(3);const reversed=run();assert.ok(reversed.rpm>0&&reversed.seriesCurrent<0&&reversed.fieldB<0);assert.ok(Math.abs(reversed.rpm-normal.rpm)<1e-8);
 const coasting=prepare(4);assert.ok(coasting.omega>0);assert.equal(coasting.seriesCurrent,0);assert.equal(coasting.torque,0);const stopped=run();assert.equal(stopped.omega,0);assert.ok(stopped.complete);
 prepare(5);const blocked=run();assert.equal(blocked.omega,0);assert.ok(blocked.blocked);assert.equal(blocked.seriesCurrent,0);
 console.log('PASS six rotor presets, winding-current reversal with continuous forward motion, overlapping brush start, heavier load, series reversal, prepared coast, zero-voltage block and connected fan.');
}finally{model.dispose();}

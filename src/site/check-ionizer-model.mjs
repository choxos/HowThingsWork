import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createIonizerModel} from './ionizer-model.js';
import {AIR_CLEANER_DEFAULTS, sampleAirCleaner} from './air-cleaner-physics.js';
import {point, MM} from './air-cleaner-geometry.js';
import {ionizerLesson as lesson} from './air-cleaner-lessons.js';
import {houseComponents} from './house-components.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
import {fixed} from './format.js';
const D={...AIR_CLEANER_DEFAULTS,mode:2},t=tally(),m=createIonizerModel(),p=m.topology;
const core=s=>[s.clock,s.values,s.neutral,s.charged,s.collected,s.deposited,s.ventilated,s.cohort];
const reset=(values={},time=0)=>{const settings={...D,...values};m.reset({settings,time});m.update(settings);m.root.updateMatrixWorld(true);return m.getState();};
assert.deepEqual(m.defaults,D);assert.deepEqual(m.controls.map(c=>c.key),['size','fan','voltage','room']);
t.ok(m.controls.find(c=>c.key==='voltage').primary,'needle voltage visible immediately');
t.ok(houseComponents.Ionizer.createModel===createIonizerModel,'route uses focused ionizer');
t.ok(houseComponents.Ionizer.part==='fan','opening frames emitter with the outlet');
t.ok(p.charger.parent===p.fan&&m.parts.find(p=>p.id==='charger').parentId==='fan','emitter belongs to outlet assembly');
for(const id of['stage','filter','collector','positive-plates','grounded-plates','size-chart'])t.ok(!m.parts.some(p=>p.id===id),'absent collector has no selectable descriptor');
for(const id of Object.keys(m.partViewDirections))t.ok(m.parts.some(p=>p.id===id),'every camera target is a selectable part');
let poses=0;
for(let size=0;size<7;size++)for(let fan=0;fan<4;fan++)for(let voltage=0;voltage<2;voltage++)for(const room of[30,60,90])for(const time of[0,300,600,1200,3600]){
 const values={...D,size,fan,voltage,room},s=reset(values,time),ref=sampleAirCleaner(values,time);poses++;
 for(const key of['neutral','charged','remaining','collected','deposited','ventilated','electricalDeposit'])t.near(s[key],ref[key],1e-14,'dedicated route preserves independently checked room physics');
 t.ok(p.needle.visible&&!p.stage.visible&&!p.wires.visible&&!p.collector.visible&&!p.filter.visible,'needle remains installed and internal collectors stay absent');
 t.near(s.neutral+s.charged+s.collected+s.deposited+s.ventilated,1,2e-13,'room particle account closes');t.near(s.collected,0,0,'no mass retained inside cabinet');
 t.near(p.tip.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...point([279,295,0]))),0,1e-12,'reparenting preserves physical emitter location');
 assert.equal(s.readings.length,11);const value=label=>s.readings.find(r=>r.label===label).value,pct=v=>`${fixed(v*100,2)}%`;
 assert.equal(value('Stored inside the device'),'0.00%');assert.equal(value('Airborne charge states'),`${pct(s.neutral)} neutral + ${pct(s.charged)} charged`);
 assert.equal(value('Charge transfer now'),`${fixed(s.rates.charging*s.neutral*6000,2)}%/min gain charge · ${fixed(s.rates.relaxation*s.charged*6000,2)}%/min lose charge`);
 assert.equal(value('Electrical deposition on room surfaces'),pct(s.electricalDeposit));
 for(const i of[0,10,20,60]){const ref=sampleAirCleaner(values,i*60);t.near(p.neutralLine.geometry.attributes.position.getY(i)/MM,-95+190*ref.neutral,2e-5,'neutral chart matches room state');t.near(p.chargedLine.geometry.attributes.position.getY(i)/MM,-95+190*ref.charged,2e-5,'charged chart matches room state');}
 t.near(p.chargeCursor.geometry.attributes.position.getX(0)/MM,-140+time/3600*280,2e-5,'charge chart cursor matches checkpoint');
 for(const marker of s.cohort){t.ok(!marker.captured&&marker.status!=='captured','ionizer cohort is never retained');if(marker.charged){t.ok(s.enabled&&marker.n>0,'blue marker carries a negative charge');t.ok(marker.position[0]>=285,'charge acquired beyond the outlet near the needle');}}
 if(!fan||!voltage){t.near(s.charged,0,0,'fresh unpowered trial stays neutral');t.near(s.electricalDeposit,0,0,'unpowered trial has no extra electrical deposition');t.near(s.remaining,s.withoutCleaner,1e-14,'unpowered room follows baseline');}
}
let checkpoints=0;
for(const trial of lesson.tryIt)for(const prior of[{fan:0,voltage:0},{size:0,fan:1,room:90}]){
 reset(prior,3500);m.reset(trial.initialState);m.update(trial.values);assert.deepEqual(m.getState().values,{...D,...trial.values});assert.equal(m.getState().clock,trial.initialState.time);t.ok(m.parts.some(p=>p.id===trial.part),'preset target exists');checkpoints++;
 for(const action of m.actions){const before=core(m.getState());assert.equal(action.run().length,11);assert.deepEqual(core(m.getState()),before,'inspection preserves charge and removal accounts');t.ok(m.parts.some(p=>p.id===action.part),'inspection target exists');}
}
t.near(reset({},1200).charged,.5047352069967282,1e-12,'default twenty-minute charged fraction');t.near(reset({},3600).electricalDeposit,.006380261136516864,1e-12,'one-hour electrical deposition');
t.near(reset({size:0},1200).chargedFraction,.08636404059275077,1e-12,'tiny particle per-pass charge probability');
reset({},1800);const before=core(m.getState());for(const mode of[0,1,NaN,Infinity]){assert.throws(()=>m.update({mode}),RangeError);assert.throws(()=>m.reset({settings:{...D,mode}}),RangeError);assert.deepEqual(core(m.getState()),before);}
reset({},1200);m.update({fan:1});assert.equal(m.getState().clock,0);assert.equal(m.getState().neutral,1);assert.equal(m.getState().charged,0);
reset();assert.equal(m.playback.step().length,11);assert.equal(m.getState().clock,300);assert.equal(m.advance(1).length,11);assert.equal(m.getState().clock,360);m.advance(100);assert.ok(m.playback.complete());m.reset(m.replayState());assert.equal(m.getState().clock,0);assert.equal(m.getState().neutral,1);assert.equal(m.animate(1).length,11);assert.equal(m.getState().clock,60);checkFinite(m.root,t);
let layouts=0;
for(const aspect of[1,1.24]){reset({},1200);const before=core(m.getState()),{camera}=frameModel(m,aspect),explosion=createPartExplosion(m,camera,aspect);explosion.update(1);const inverse=camera.quaternion.clone().invert(),boxes=explosion.items.map(unit=>{const box=new THREE.Box3();for(const x of[unit.bounds.min.x,unit.bounds.max.x])for(const y of[unit.bounds.min.y,unit.bounds.max.y])for(const z of[unit.bounds.min.z,unit.bounds.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).add(unit.group.position).applyQuaternion(inverse));return box;});for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)t.ok(boxes[i].max.x<=boxes[j].min.x||boxes[j].max.x<=boxes[i].min.x||boxes[i].max.y<=boxes[j].min.y||boxes[j].max.y<=boxes[i].min.y,'separated units do not overlap');explosion.update(0);explosion.dispose();assert.deepEqual(core(m.getState()),before);layouts++;}
const resources=checkDisposal(m,t);
console.log(`PASS ionizer: ${t.count} checks; ${poses} poses; ${checkpoints} preset checkpoints; ${layouts} separated layouts; ${resources} resources`);

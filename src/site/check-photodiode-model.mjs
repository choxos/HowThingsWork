import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createPhotodiodeModel} from './photodiode-model.js';
import {PHOTODIODE_DEFAULTS as D} from './photodiode-physics.js';
import {photodiodeLesson as lesson} from './photodiode-lesson.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal,checkControlsMove} from './model-check-kit.mjs';

const t=tally(),m=createPhotodiodeModel(),g=m.topology,outcomes=[];
const v3=p=>new THREE.Vector3(...p),world=o=>o.getWorldPosition(new THREE.Vector3());
const near=(a,b,why,tolerance=1e-10)=>t.near(a,b,tolerance,why);
const endpoints=object=>[-1,1].map(sign=>object.localToWorld(new THREE.Vector3(0,sign*object.geometry.parameters.height/2,0)));
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
for(const trial of lesson.tryIt){
  assert.deepEqual(Object.keys(trial.values),Object.keys(D));assert.deepEqual(trial.values,trial.initialState.settings);t.add(2);
  t.ok(trial.reset&&trial.isolate&&trial.cutaway===false&&m.parts.some(p=>p.id===trial.part),'Trial owns all settings and inspection state');
  m.reset({settings:{mode:2,intensity:0,background:2,blocked:1,distance:30,drive:0},time:12,initialVoltage:.1});m.reset(trial.initialState);
  near(m.getState().time,0,'Trial owns zero clock',0);near(m.getState().photoCharge,0,'Trial clears inherited photocharge',0);
  for(const time of [0,1/12,1/6,4.25,12]){
    m.reset({...trial.initialState,time});const s=m.getState();assert.deepEqual(s.values,trial.values);t.add();m.root.updateMatrixWorld(true);
    for(const wire of g.wires){const ends=endpoints(wire.object);t.ok(ends.some(e=>e.distanceTo(v3(wire.a))<1e-7)&&ends.some(e=>e.distanceTo(v3(wire.b))<1e-7),'Every conductor reaches its authored contacts');}
    for(const item of g.switches){const gap=world(item.tip).distanceTo(world(item.endObject));t.ok(item.mode===s.values.mode?gap<1e-7:gap>.25,'Both selector blades match instrument continuity');near(world(item.startObject).distanceTo(item.lever.getWorldPosition(new THREE.Vector3())),0,'Blade pivot meets bus contact');}
    for(const [index,point] of [[0,g.anodePoints[0]],[1,g.cathodePoints[0]]])near(g.detector.localToWorld(v3(point)).distanceTo(world(g.socketObjects[index])),0,'Package lead meets socket');
    near(g.detector.localToWorld(v3(g.bondPoints[0])).distanceTo(g.detector.localToWorld(v3(g.anodePoints.at(-1)))),0,'Bond joins anode lead');
    near(g.bondPoints.at(-1)[2],.06,'Bond reaches front pad upper face');
    t.ok(new THREE.Box3().setFromObject(g.cathode).intersectsBox(new THREE.Box3().setFromObject(g.die)),'Back contact touches sensing die');
    for(const branch of g.branches)for(let side=0;side<2;side++){const pin=world(branch.pins[side]);near(pin.x,branch.ends[side].end[0],'Branch contact x');near(pin.y,-.67,'Branch contact y');near(pin.z,.18,'Branch contact depth');}
    const beamEnd=g.beam.localToWorld(v3([0,.5,0]));near(beamEnd.distanceTo(s.values.blocked?g.shutterPoint:g.detectorPoint),0,'Beam reaches detector or blocker');
    near(g.source.position.x,-1.8-(s.values.distance-1)*1.2/29,'Distance physically moves source');
    near(g.sourcePoint.clone().sub(g.detector.position).cross(g.detectorPoint.clone().sub(g.detector.position)).length(),0,'Source stays on detector normal');
    t.ok(g.photons.every(p=>p.visible===(s.gate&&s.values.intensity>0)),'Source photon cue follows pulse and intensity');
    t.ok(g.backgroundPhotons.every(p=>p.visible===(s.values.background>0)),'Background cue is independent of source shutter');
    t.ok(g.flow.every(p=>p.visible===(s.values.mode!==2&&s.externalCurrent>0)),'Open voltmeter never shows external current flow');
    const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before);t.add();}checkFinite(m.root,t);
  }
  const s=m.getState();outcomes.push({title:trial.title,values:s.values,initialVoltage:s.initialVoltage,signalCurrent:s.signalCurrent,meanExternalCurrent:s.meanExternalCurrent,voltage:s.voltage,photoCharge:s.photoCharge,externalCharge:s.externalCharge,capacitorChargeChange:s.capacitorChargeChange,internalDiodeCharge:s.internalDiodeCharge,time:s.time});
}
const get=title=>outcomes.find(x=>x.title===title);
near(get('Double the distance').signalCurrent,get('Measure light at 5 m').signalCurrent/4,'Distance trial quarters signal',1e-22);
near(get('Compare steady light').photoCharge,3*get('Measure light at 5 m').photoCharge,'Steady light triples photocharge',1e-24);
near(get('Block the source but leave background').meanExternalCurrent,11.9996e-9,'Blocked background trial',1e-22);
near(get('Detect light with no applied bias').signalCurrent,14.288e-9,'Zero bias keeps separate reference',1e-22);
t.ok(get('Watch voltage under fast flashes').voltage<get('Let steady light build a voltage').voltage,'Pulses build less voltage');
t.ok(get('Discharge after the light stops').voltage<.1&&get('Discharge after the light stops').internalDiodeCharge>0,'Prepared dark state discharges internally');
m.reset({settings:{mode:0}});const reverseWidth=g.depletedLayer.scale.x;m.reset({settings:{mode:1}});t.ok(g.depletedLayer.scale.x<reverseWidth,'Zero bias retains a narrower qualitative depletion region');
m.reset({settings:{mode:2}});t.ok(g.storedCharge.every(p=>!p.visible),'Initially uncharged open detector has no stored-charge cue');m.advance(12);t.ok(g.storedCharge.every(p=>p.visible&&p.scale.x>0),'Collected charge makes the open-voltage storage cue visible');
m.reset({settings:{mode:2,blocked:1},initialVoltage:.1});const chargedSize=g.storedCharge[0].scale.x;m.advance(12);t.ok(g.storedCharge[0].scale.x<chargedSize,'Storage cue shrinks as the prepared detector discharges');
checkControlsMove(m,()=>({source:g.source.position.x,intensity:g.sourceText.userData.labelText,background:g.backgroundPhotons[0].visible,blocked:g.blade.position.y,drive:g.sourceTiming.userData.labelText,mode:g.switches.map(s=>s.lever.rotation.z)}),model=>model.advance(.25),t);
m.reset();m.playback.step();near(m.getState().time,1/12,'One-sixth-cycle step');m.playback.step();t.ok(!m.getState().gate,'Second step reaches pulse off');
m.reset();for(let i=0;i<144;i++){m.playback.step();t.ok(m.getState().gate===((i+1)%6<2),'Repeated steps retain pulse boundaries');}
for(const value of [-1,NaN,Infinity]){const before=m.getState();m.advance(value);assert.deepEqual(m.getState(),before);t.add();}
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' contains inspectable geometry');
assert.equal(houseComponents.Photodiode.createModel,createPhotodiodeModel);assert.equal(houseComponents.Photodiode.lesson,lesson);t.add(2);
const parts=m.parts.map(p=>p.id),resources=checkDisposal(m,t),report={passed:true,checks:t.count,trials:outcomes,parts,resources};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS photodiode model: ${t.count} checks; ${outcomes.length} complete-state trials; ${parts.length} parts; ${resources} resources`);

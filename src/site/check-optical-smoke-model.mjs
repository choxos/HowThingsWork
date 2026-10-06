import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createOpticalSmokeModel} from './optical-smoke-model.js';
import {reviewedOpticalSmokeLesson as lesson} from './optical-smoke-lesson.js';
import {OPTICAL_SMOKE_DEFAULTS as D,OPTICAL_SMOKE_RUN as R,opticalSmokePlan,opticalSmokeAt} from './optical-smoke-physics.js';
import {SMOKE_SCIENCE as C} from './smoke-detector-science.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal,checkControlsMove,checkTrialNumbers} from './model-check-kit.mjs';

const t=tally(),m=createOpticalSmokeModel(),g=m.topology,vector=p=>new THREE.Vector3(...p),outcomes=[];
const ends=object=>[-1,1].map(sign=>object.localToWorld(vector([0,sign*object.geometry.parameters.height/2,0])));
const baseline=opticalSmokePlan(),baseEnd=opticalSmokeAt(baseline,600),high=baseline.samples.filter(s=>s.hit);
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
checkTrialNumbers(lesson,{
 'Watch the light arrive':({end})=>({'128.4':high[0].time,'130.4':high[1].time,'131.4':end.onset,'600':end.time,'13.38':end.current*1e9,'2.323':end.trigger*1e9}),
 'The beam itself hardly dims':({end})=>({'600':end.time,'30':C.beamDistance*1000,'99.59':end.beamShare*100,'10':C.roomDistance,'25.17':end.roomShare*100}),
 'Around to the side':({end})=>({'600':end.time,'0.205':end.current*1e9,'13.38':baseEnd.current*1e9}),
 'Forward, but not far forward':({end})=>({'1.246':end.current*1e9,'600':end.time,'2.323':end.trigger*1e9,'90':opticalSmokeAt(opticalSmokePlan({...D,angle:90}),0).values.angle,'21':baseEnd.values.angle}),
 'Smaller particles':({end})=>({'3.605':end.current*1e9,'600':end.time,'398.9':end.onset}),
 'Much smaller particles':({end})=>({'0.103':end.current*1e9,'600':end.time}),
 'A faster smoke input':({end})=>({'45.8':end.onset,'131.4':baseEnd.onset}),
 'Clear the air':({end})=>({'197.4':end.events.find(e=>!e.active).time,'1.626':end.release*1e9}),
 'Smoke without power':()=>({}),
 'Clean air, no signal':()=>({}),
 'One high check is not enough':(_,trial)=>{const p=opticalSmokePlan(trial.values,{mass:trial.initialState.mass});return {'10.7':p.samples[0].time,'2.442':p.samples[0].current*1e9,'12.7':p.samples[1].time,'2.209':p.samples[1].current*1e9};},
},values=>{const plan=opticalSmokePlan(values);return {start:opticalSmokeAt(plan,0),end:opticalSmokeAt(plan,600)};},t,m);

for(const trial of lesson.tryIt){
 assert.deepEqual(Object.keys(trial.values),Object.keys(D));assert.deepEqual(trial.initialState.settings,trial.values);t.add(2);
 t.ok(trial.reset&&trial.isolate&&trial.cutaway&&m.parts.some(p=>p.id===trial.part),'Complete prepared settings and inspection target');
 m.reset({settings:{...D,size:.1,power:0,angle:165},time:600,mass:500});m.reset(trial.initialState);assert.deepEqual(m.getState().values,trial.values);t.add();
 for(const time of [0,10.7,12.7,128.4,131.4,197.4,600]){
  m.reset({...trial.initialState,time});m.root.updateMatrixWorld(true);const s=m.getState(),plan=m.scientificPlan();
  t.near(s.mass,plan.massAt(time),1e-16,'Prepared mass is preserved throughout run');
  const source=g.emitter.getWorldPosition(new THREE.Vector3()),receiver=g.receiver.getWorldPosition(new THREE.Vector3());
  t.near(source.distanceTo(receiver),Math.hypot(...plan.optical.receiver.map((x,i)=>x-plan.optical.source[i]))*1000*g.scale,1e-9,'Visible optical separation matches integrated geometry');
  for(const path of g.paths)for(const [i,object]of path.objects.entries()){
   const actual=ends(object),a=vector(path.points[i]),b=vector(path.points[i+1]);t.ok(actual.some(p=>p.distanceTo(a)<1e-6)&&actual.some(p=>p.distanceTo(b)<1e-6),'Every conductor reaches its routed endpoints');
  }
  const blade=ends(g.blade),start=vector(g.powerStart),end=vector(g.powerEnd);t.ok(blade.some(p=>p.distanceTo(start)<1e-8),'Contact stays attached to battery positive');t.ok(s.values.power?blade.some(p=>p.distanceTo(end)<1e-8):blade.every(p=>p.distanceTo(end)>.4),'Power switch has a visible open gap');
  for(const path of g.paths.filter(p=>p.id==='controller-supply'||p.id==='supply-reservoir'))for(let i=1;i<path.points.length;i++)t.ok(new THREE.Line3(vector(path.points[i-1]),vector(path.points[i])).closestPointToPoint(start,true,new THREE.Vector3()).distanceTo(start)>.2,'Supply conductor does not bridge open contact');
  for(const [i,ray]of g.rays.entries())if(ray.visible){
   const a=ray.geometry.attributes.position;
   const expected=[plan.optical.source,plan.optical.positions[g.rayIndices[i]],plan.optical.receiver];
   expected.forEach((point,j)=>{t.ok(new THREE.Vector3().fromBufferAttribute(a,j).distanceTo(vector(point).multiplyScalar(1000))<2e-6,'Representative path follows actual integration node');});
  }
  t.ok(g.beamRoot.visible===!!s.values.power&&g.waves.every(w=>w.visible===s.hornPulse),'Light and sound cues respect powered state');
  t.ok(g.checks.every((check,i)=>check.material.color.getHex()===(i<s.count?0xe3b45e:0xb4c5b0)),'Confirmation lamps show actual count');
  t.ok(g.curve.geometry.drawRange.count===plan.chart.filter(p=>p.time<s.time).length+1,'Current curve shows elapsed history only');
  t.ok(g.eventMarks.geometry.drawRange.count===s.events.length*2,'Event marks include only observed events');
  const before=structuredClone(m.getState());for(const action of m.actions.filter(a=>a.label.startsWith('Inspect:'))){action.run();assert.deepEqual(m.getState(),before);t.add();}
  checkFinite(m.root,t);
 }
 outcomes.push({title:trial.title,time:m.getState().time,onset:m.getState().onset,current:m.getState().current});
}
for(let angle=15;angle<=165;angle++){
 m.reset({settings:{...D,angle},time:300});m.root.updateMatrixWorld(true);
 t.near(g.receiver.position.length(),12,1e-12,'Receiver remains on assigned radius');
 const center=g.chamber.getWorldPosition(new THREE.Vector3());
 for(const guide of [g.field,g.beam])for(let i=0;i<guide.geometry.attributes.position.count;i++){
  const point=guide.localToWorld(new THREE.Vector3().fromBufferAttribute(guide.geometry.attributes.position,i));t.ok(point.distanceTo(center)/g.scale<=23.000003,'Light guides stop at actual spherical wall at every angle');
 }
 const emitterAxis=new THREE.Line3(vector([-16,0,0]),vector([-12,0,0]));
 for(let j=0;j<=40;j++){const p=vector([12+j/10,0,0]).applyAxisAngle(new THREE.Vector3(0,0,1),angle*Math.PI/180),nearest=emitterAxis.closestPointToPoint(p,true,new THREE.Vector3());t.ok(p.distanceTo(nearest)>2.5,'Emitter and receiver bodies remain separated across full angle domain');}
 for(const path of g.opticalPaths){const rim=path.points[1],low=path.points[2];t.ok(Math.hypot(rim[0]-g.chamber.position.x,rim[1]-g.chamber.position.y)>23*g.scale,'Optical leads descend outside chamber rim');t.near(rim[0],low[0],0,'Vertical rim return x');t.near(rim[1],low[1],0,'Vertical rim return y');}
}
t.ok(g.chamber.position.z-23*g.scale>.04,'Spherical chamber clears board');t.ok(g.coverMesh.geometry.index.count<48*23*6,'Cover has actual air-entry openings');
t.ok(m.covers.includes(g.tube),'Cutaway exposes receiver lens, field stop and photodiode');
checkControlsMove(m,()=>({receiver:g.receiver.position.toArray(),status:g.status.userData.labelText,footer:g.footer.userData.labelText,contact:g.blade.quaternion.toArray()}),model=>model.playback.advance(12),t);
m.reset();m.playback.step();t.near(m.getState().time,5,0,'Step advances five simulated seconds');m.update({pace:.25});m.playback.advance(1);t.near(m.getState().time,10,0,'Quarter pace changes rate without reset');m.playback.step();t.near(m.getState().time,15,0,'Step does not depend on pace');
m.reset();m.actions.find(a=>a.label==='Advance to next sample').run();t.near(m.getState().time,10.7,1e-12,'Next sample lands on real check');m.actions.find(a=>a.label==='Finish observation').run();t.ok(m.playback.complete(),'Finish reaches completion');m.reset(m.replayState());t.near(m.getState().time,0,0,'Replay restores prepared start');
m.reset({time:150});const mass=m.getState().mass;m.actions.find(a=>a.label==='Clear smoke now').run();t.near(m.getState().mass,mass,1e-16,'Manual clear keeps current mass');m.advance(5);t.ok(m.getState().mass<mass&&!m.getState().active,'Manual clear removes smoke and releases alarm');
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' has inspectable geometry');
assert.equal(houseComponents['Optical smoke detector'].createModel,createOpticalSmokeModel);assert.equal(houseComponents['Optical smoke detector'].lesson,lesson);t.add(2);
const parts=m.parts.map(p=>p.id),resources=checkDisposal(m,t),report={passed:true,checks:t.count,parts,resources,outcomes};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS optical model: ${t.count} checks; ${parts.length} parts; ${resources} resources; ${outcomes.length} trials`);

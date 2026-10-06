import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createReviewedSmokeDetectorModel} from './smoke-detector-model.js';
import {reviewedSmokeDetectorLesson as lesson} from './smoke-detector-lesson.js';
import {SMOKE_DETECTOR_DEFAULTS as D,SMOKE_DETECTOR_RUN as R} from './smoke-detector-physics.js';
import {SMOKE_SCIENCE as C} from './smoke-detector-science.js';
import {createSafetyModel} from './safety-models.js';
import {safetyLessons} from './safety-lessons.js';
import {houseComponents} from './house-components.js';
import {createSmokeDetectorModel} from './smoke-model.js';
import {tally,checkFinite,checkDisposal,checkControlsMove} from './model-check-kit.mjs';

const t=tally(),m=createReviewedSmokeDetectorModel(),g=m.topology,outcomes=[];
const v3=p=>new THREE.Vector3(...p),world=o=>o.getWorldPosition(new THREE.Vector3());
const ends=o=>[-1,1].map(sign=>o.localToWorld(v3([0,sign*o.geometry.parameters.height/2,0])));
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
m.root.updateMatrixWorld(true);
t.ok(new THREE.Box3().setFromObject(g.bowl).min.z>new THREE.Box3().setFromObject(g.board).max.z,'Optical bowl clears the circuit board and rear housing');
t.ok(v3(g.emitterPins[0]).distanceTo(v3(g.emitterPins[1]))>.08,'Emitter supply and return terminals remain physically separate');
for(const [i,lead] of g.emitterLeads.entries()){
  const pin=v3(g.emitterPins[i]);t.ok(ends(lead).some(end=>end.distanceTo(pin)<1e-7),'Emitter lead reaches its supply connection');
  t.ok(g.paths.some(path=>path.points.some(point=>v3(point).distanceTo(pin)<1e-7)),'Emitter terminal connects to a routed conductor');
}
t.ok(g.cover.position.z-.06>g.ions.position.z+g.ionScale*(g.gasBase+C.referenceGap+.6),'Closed cover clears highest chamber electrode and outline');
for(let angle=15;angle<=165;angle++){
  const theta=angle*Math.PI/180,half=C.receiverHalfAngle*Math.PI/180,axial=12+12*Math.cos(theta),perpendicular=12*Math.sin(theta);
  t.ok(perpendicular*Math.cos(half)-axial*Math.sin(half)>g.emitterLens.geometry.parameters.radius,'Drawn luminous lens stays wholly outside receiver cone');
}
for(const trial of lesson.tryIt){
  assert.deepEqual(Object.keys(trial.values),Object.keys(D));assert.deepEqual(trial.values,trial.initialState.settings);t.add(2);
  t.ok(trial.reset&&trial.isolate&&trial.cutaway&&m.parts.some(p=>p.id===trial.part),'Preset owns full settings and inspection state');
  m.reset({settings:{size:3,angle:165,power:0,battery:6.5},time:600,mass:500});m.reset(trial.initialState);
  t.near(m.getState().time,0,0,'Preset starts at its own clock');t.near(m.getState().mass,trial.initialState.mass*1e-6,1e-18,'Preset replaces inherited chamber smoke');
  for(const time of [0,10.7,12.7,100,220,600]){
    m.reset({...trial.initialState,time});const s=m.getState();assert.deepEqual(s.values,trial.values);t.add();m.root.updateMatrixWorld(true);
    for(const path of g.paths)for(const [i,object] of path.objects.entries()){
      const endpoints=ends(object),a=g.wires.localToWorld(v3(path.points[i])),b=g.wires.localToWorld(v3(path.points[i+1]));
      t.ok(endpoints.some(p=>p.distanceTo(a)<1e-7)&&endpoints.some(p=>p.distanceTo(b)<1e-7),'Every conductor reaches both assigned endpoints');
    }
    const blade=ends(g.switchBlade);t.ok(blade.some(p=>p.distanceTo(world(g.positive))<1e-7),'Battery contact blade stays attached to positive terminal');
    const distance=Math.min(...blade.map(p=>p.distanceTo(v3(g.powerEnd))));t.ok(s.values.power?distance<1e-7:distance>.2,'Contact continuity matches power selection');
    for(const half of g.ionHalves){
      t.near(half.plate.position.z-g.gasBase,half.gap,1e-12,'Drawn electrode uses modeled air gap from foil surface');
      for(const track of half.tracks){
        t.near(track.start[2],g.gasBase,1e-12,'Alpha starts at top of foil');
        t.ok(track.end[2]<=half.gap+g.gasBase+1e-10&&half.side*track.end[0]>=-1e-10,'Drawn alpha obeys electrode and partition stops');
        t.near(Math.hypot(track.end[0],track.end[1]),Math.hypot(track.path.end[0],track.path.end[1]),1e-12,'Mirroring preserves physical track geometry');
      }
    }
    const theta=s.values.angle*Math.PI/180;t.near(g.receiver.position.x,1000*C.receiverDistance*Math.cos(theta),1e-10,'Receiver moves around chamber x');t.near(g.receiver.position.y,12*Math.sin(theta),1e-10,'Receiver moves around chamber y');
    const receiverPins=[1,-1].map(side=>g.receiver.localToWorld(v3([6,side,0])));
    for(const [i,wire] of g.receiverWires.entries()){const point=v3([...wire.geometry.attributes.position.array.slice(0,3)]);t.ok(wire.localToWorld(point).distanceTo(receiverPins[i])<1e-6,'Signal and return wires reach distinct rotating photodiode pins');}
    for(const [i,lead] of g.receiverLeads.entries())t.ok(ends(lead).some(end=>end.distanceTo(receiverPins[i])<1e-7),'Receiver pin geometry reaches its signal or return wire');
    t.ok(receiverPins[0].distanceTo(receiverPins[1])>.08,'Photodiode terminals remain physically separate');
    t.ok(g.beam.visible===!!s.values.power&&g.scatterRays.every(ray=>ray.visible===(!!s.values.power&&s.scattered>0)),'Optical rays require powered source and smoke');
    t.ok(g.hornWaves.every(w=>w.visible===s.hornPulse),'Pressure cue follows horn drive and silent gaps');
    if(!s.values.power)t.ok(g.flow.every(dot=>!dot.visible),'Disconnected battery has no conductor current cues');
    const before=structuredClone(s);for(const action of m.actions.filter(a=>a.label.startsWith('Inspect:'))){action.run();assert.deepEqual(m.getState(),before);t.add();}
    checkFinite(m.root,t);
  }
  const s=m.getState();outcomes.push({title:trial.title,time:s.time,values:s.values,ion:s.ionSeen,photo:s.photoSeen,active:s.active,chirps:s.chirps.length});
}
m.reset({settings:{growth:50}});m.actions.find(a=>a.label==='Finish observation').run();t.ok(m.getState().complete&&m.getState().ionSeen!==null&&m.getState().photoSeen!==null,'Finish advances whole configured observation');
m.reset(lesson.tryIt[10].initialState);m.actions.find(a=>a.label==='Advance to next optical check').run();t.near(m.getState().time,10.7,1e-12,'Advance action reaches actual first sample');t.near(m.getState().photoCount,1,0,'Puff first hit visible');
m.actions.find(a=>a.label==='Advance to next optical check').run();t.near(m.getState().time,12.7,1e-12,'Advance action reaches accelerated check');t.near(m.getState().photoCount,0,0,'Failed second check clears visible count');
m.reset();m.advance(15);const smoke=m.getState().mass;m.actions.find(a=>a.label==='Clear smoke now').run();t.near(m.getState().time,300,0,'Clear action retains clock');t.near(m.getState().mass,smoke,1e-16,'Clear action retains current concentration');m.advance(1);t.ok(m.getState().mass<smoke,'Clear action changes following smoke evolution');
checkControlsMove(m,()=>({smoke:g.opticalSmoke.map(d=>d.visible),battery:g.batteryText.userData.labelText,receiver:g.receiver.rotation.z,status:g.status.userData.labelText,footer:g.footer.userData.labelText,ions:g.ionReading.userData.labelText,light:g.opticalReading.userData.labelText}),model=>model.advance(12),t);
m.reset();m.playback.step();t.near(m.getState().time,5,0,'Step advances five simulated seconds');m.advance(100);t.ok(m.playback.complete(),'Completion gate');m.reset(m.replayState());t.near(m.getState().time,0,0,'Replay starts prepared state');
m.reset();m.playback.advance(1);m.update({pace:.25});t.near(m.getState().time,20,0,'Pace change preserves clock');m.playback.advance(1);t.near(m.getState().time,25,0,'Quarter pace advances one quarter as far');m.playback.step();t.near(m.getState().time,30,0,'Step remains five seconds at slow pace');m.reset(m.replayState());t.near(m.getState().values.pace,.25,0,'Replay keeps selected pace');
for(const invalid of [-1,NaN,Infinity]){const state=m.getState();m.advance(invalid);assert.deepEqual(m.getState(),state);t.add();}
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' has inspectable geometry');
assert.equal(safetyLessons['Smoke detector'],lesson);const routed=createSafetyModel('Smoke detector');assert.deepEqual(routed.controls.map(c=>c.key),Object.keys(D));routed.dispose();
assert.notEqual(houseComponents['Ionization smoke detector'].createModel,createReviewedSmokeDetectorModel,'Reviewed ionization child has its own model');
assert.equal(houseComponents['Optical smoke detector'].createModel,createSmokeDetectorModel,'Unreviewed optical child retains its preserved draft');t.add(4);
const parts=m.parts.map(p=>p.id),resources=checkDisposal(m,t),report={passed:true,checks:t.count,parts,resources,outcomes};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS smoke detector model: ${t.count} checks; ${outcomes.length} trials; ${parts.length} parts; ${resources} resources`);

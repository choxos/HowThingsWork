import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLightningConductorModel} from './lightning-model.js';
import {lightningLesson as lesson} from './lightning-lesson.js';
import {LIGHTNING_DEFAULTS as D,LIGHTNING_DOMAINS,RUN,clockOfTime,potentialAt} from './lightning-physics.js';
import {safetyLessons} from './safety-lessons.js';
import {createSafetyModel} from './safety-models.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createLightningConductorModel(),g=m.topology,near=(a,b,why,tol=1e-7)=>t.near(a,b,tol,why);
const points=line=>{const a=line.geometry.attributes.position,n=Math.min(a.count,line.geometry.drawRange.count);return Array.from({length:n},(_,i)=>[a.getX(i),a.getY(i),a.getZ(i)]);};
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));
for(const control of m.controls){assert.deepEqual([control.min,control.max,control.step],LIGHTNING_DOMAINS[control.key]);t.ok(control.help.length>40,'Every control explains its causal consequence and scope');}
let poses=0;const final=new Map();
for(const trial of lesson.tryIt){
 assert.deepEqual(trial.values,trial.initialState.settings);assert.deepEqual(Object.keys(trial.values),Object.keys(D));assert.ok(m.parts.some(p=>p.id===trial.part));
 const plan=(m.reset(trial.initialState),m.physicalPlan());
 for(const time of [trial.initialState.time,clockOfTime(plan.steepestTime),clockOfTime(plan.peakTime),clockOfTime(100e-6),RUN]){
  m.reset({...trial.initialState,time});m.update(trial.values);m.root.updateMatrixWorld(true);const s=m.getState();poses++;
  near(g.contactPivot.rotation.z,s.values.paths===2?0:.45,'Physical connection opens only for one-route setting');
  near(g.pipeAssembly.position.x+1.63,s.values.gap*.65,'Whole installation pipe moves with chosen gap');
  const gapPoints=points(g.gapMeasure);near(gapPoints[0][1],1.30,'Gap measure starts at the upper conductor endpoint');near(gapPoints[1][1],1.30,'Gap measure ends at the upper pipe endpoint');t.ok(g.gapMeasure.material.isLineDashedMaterial,'Dashed gap indicator is distinguishable from a metal bond');near(gapPoints[1][0]-gapPoints[0][0],s.values.gap*1.5,'Gap close-up uses selected physical separation');
  const bond=points(g.pipeBond);near(bond[0][0],g.pipeAssembly.position.x,'Pipe bond reaches the pipe');near(bond[1][0],0,'Pipe bond reaches the common bar');
  near(g.detailProbes[0].position.x,s.values.distance*g.earthScale,'Near ground probe moves to its selected distance');near(g.detailProbes[1].position.x-g.detailProbes[0].position.x,g.earthScale,'Ground probes remain one physical meter apart');
  near(g.contactShape.scale.x,s.values.radius*g.earthScale,'Assigned ground contact changes size');
  for(const [i,beads]of g.beads.entries())t.ok(beads.every(b=>b.visible===(s.current>plan.top*1e-6&&(i===0||s.values.paths===2))),'Only connected current-carrying routes show negative charge markers');
  for(const arrow of g.arrows)t.ok(new THREE.Vector3(0,1,0).applyQuaternion(arrow.quaternion).y>.999,'Conventional current arrows point upward for a negative strike');
  for(const [j,line]of g.contours.entries()){
   t.ok(line.visible===Boolean(plan.contours[j]),'Only existing pre-discharge equipotentials appear');if(!line.visible)continue;
   for(const [x,y]of points(line)){const r=Math.abs(x/g.tipScale),z=(y+.2)/g.tipScale+plan.spheroid.c;near(potentialAt(plan.spheroid,plan.ambient,r,z),-plan.contours[j].volts,'Drawn contour buffers reproduce the calculated potential',Math.max(.08,plan.contours[j].volts*2e-6));}
  }
  for(const [x,y]of points(g.tipSurface)){const r=x/g.tipScale,z=(y+.2)/g.tipScale+plan.spheroid.c;near(r*r/(plan.spheroid.b**2)+z*z/(plan.spheroid.c**2),1,'Drawn tip lies on the selected semiellipsoid',2e-7);t.ok(y>=-1.101&&y<=-.199,'Tip profile stays inside its close-up window');}
  const current=points(g.currentCurve),voltage=points(g.voltageCurve);
  for(let j=0;j<current.length;j+=17){near(current[j][1],.42+1.3*plan.samples[j].current/200000,'Current plot uses fixed 200 kA scale');near(voltage[j][1],-.70+.56*plan.samples[j].gap/plan.gapMax,'Voltage plot preserves signed voltage on labeled scale');}
  t.ok(s.readings.every(r=>r.label&&r.value&&r.hint&&!/NaN|undefined|Infinity/.test(r.value)),'All learner readings are finite and explained');
  const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before,'Inspection preserves physical time, controls, current and accumulated energy');t.add();}
  checkFinite(m.root,t);
 }
 t.ok(m.getState().complete,'Each authored experiment completes');final.set(trial.title,structuredClone(m.getState()));
}
const at=title=>final.get(title),base=at('Follow the connected path');
near(at('Leave one route disconnected').record.gapMax,base.record.gapMax*2,'One-route preset doubles peak route voltage');near(at('Leave one route disconnected').record.copperEnergy,base.record.copperEnergy*2,'One-route preset doubles copper heating');
near(at('Same peak, much faster rise').record.peakCurrent,at('A slower 50 kA pulse').record.peakCurrent,'Equal-peak comparison actually uses equal peaks');t.ok(at('Same peak, much faster rise').record.gapMax>40*at('A slower 50 kA pulse').record.gapMax,'Fast-pulse preset changes voltage strongly');
near(at('Move the pipe close').record.gapField,6*at('Move the pipe farther away').record.gapField,'Prepared air-gap comparison has sixfold stress ratio');
near(at('Raise soil resistivity').record.stepMax,20*at('Lower soil resistivity').record.stepMax,'Prepared soil comparison changes probe voltage twentyfold');
near(at('Larger effective earth contact').record.earthMax,base.record.earthMax/2,'Larger contact halves contact potential');near(at('Larger effective earth contact').record.stepMax,base.record.stepMax,'Larger contact leaves outside probe difference unchanged');
near(at('Probes close to the contact').record.stepMax,13*at('Probes farther from the contact').record.stepMax,'Prepared probe positions give their promised difference ratio');
t.ok(at('Inspect a sharp tip').aboveOnset&&!at('Round the tip').aboveOnset&&!at('Weaken the ambient field').aboveOnset,'Tip comparisons cross the stated historical onset reference');
t.ok(at('Remove the ambient field').tipField===0,'Zero-field trial removes the field');
m.reset(lesson.tryIt.find(q=>q.title==='Catch the falling tail').initialState);t.ok(m.getState().current>0&&m.getState().gap>0&&m.getState().phase==='The current is decaying','Tail preset begins at the named state');
const plan=m.physicalPlan();m.reset({time:clockOfTime(plan.peakTime)});const bead=g.beads[0][0].position.clone();m.advance(.02);t.ok(bead.distanceTo(g.beads[0][0].position)>0,'Play moves negative-charge markers');
m.reset();for(let j=0;j<24;j++)m.playback.step();t.ok(m.getState().complete,'Step reaches completion');m.reset(m.replayState());near(m.getState().time,0,'Replay starts over');m.playback.step();near(m.getState().time,.5,'Step advances the visible playback clock');
assert.equal(safetyLessons['Lightning conductor'],lesson);assert.equal(houseComponents['Lightning conductor'],undefined);const routed=createSafetyModel('Lightning conductor');t.ok(routed.controls.length===9,'Published factory reaches the dedicated whole model');routed.dispose();
const resources=checkDisposal(m,t);console.log(`PASS lightning model: ${t.count} checks, ${poses} poses, ${lesson.tryIt.length} causal presets, ${resources} resources`);

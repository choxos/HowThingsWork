import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createIonizationSmokeModel} from './ionization-smoke-model.js';
import {reviewedIonizationSmokeLesson as lesson} from './ionization-smoke-lesson.js';
import {ION_SMOKE_DEFAULTS as D} from './ionization-smoke-physics.js';
import {SMOKE_SCIENCE as C} from './smoke-detector-science.js';
import {houseComponents} from './house-components.js';
import {createOpticalSmokeModel} from './optical-smoke-model.js';
import {tally,checkFinite,checkDisposal,checkControlsMove,checkTrialNumbers} from './model-check-kit.mjs';
import {ionSmokePlan,ionSmokeAt,ionNormalAlpha} from './ionization-smoke-physics.js';
import {smokeParticle} from './smoke-detector-science.js';

const t=tally(),m=createIonizationSmokeModel(),g=m.topology,outcomes=[],vector=p=>new THREE.Vector3(...p);
const ends=object=>[-1,1].map(sign=>object.localToWorld(vector([0,sign*object.geometry.parameters.height/2,0])));
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
const baseline=ionSmokeAt(ionSmokePlan(),0),normal=ionNormalAlpha();
checkTrialNumbers(lesson,{
  'Watch the ions thin out':({start,end})=>({'0.1':start.values.size,'9.73':start.current*1e12,'0.86':end.current*1e12,'600':end.time}),
  'Where the alarm point is':({start,end})=>({'9':start.supply,'4.50':start.trigger,'38.41':end.onset,'4.40':start.release}),
  'Bigger particles, same mass':({start,end})=>({'27,000':smokeParticle(3).mass/smokeParticle(.1).mass,'0.1':D.size,'30':smokeParticle(3).capture/smokeParticle(.1).capture,'900':smokeParticle(.1).capture/smokeParticle(.1).mass/(smokeParticle(3).capture/smokeParticle(3).mass),'99.3':100*end.current/start.current}),
  'A weaker battery':({start,end})=>({'6.5':start.supply,'7.34':start.current*1e12,'9.73':baseline.current*1e12,'3.25':start.trigger,'38.41':end.onset}),
  'What one alpha leaves':()=>({'4.586':normal.energy,'47,714':normal.pairs,'15':C.sensingGap,'31.90':normal.range}),
  'The ceiling on the current':({start})=>({'10.19':start.current*1e12,'29.9':start.open.collectionShare*100,'34.10':start.saturation*1e12}),
  'A slower smoke input':({end})=>({'225.45':end.onset,'38.41':ionSmokeAt(ionSmokePlan(),600).onset}),
  'Clear the air':({end})=>({'223.78':end.events.find(e=>!e.active).time,'4.40':end.release}),
  'Ions without battery power':()=>({}),
  'Clean air, no smoke alarm':({start})=>({'9.73':start.current*1e12}),
  'Low battery in clean air':({end})=>({'600':end.time}),
},values=>{const plan=ionSmokePlan(values);return {start:ionSmokeAt(plan,0),end:ionSmokeAt(plan,600)};},t,m);
for(const experiment of lesson.tryIt){
  assert.deepEqual(Object.keys(experiment.values),Object.keys(D));assert.deepEqual(experiment.initialState.settings,experiment.values);t.add(2);
  t.ok(experiment.reset&&experiment.isolate&&experiment.cutaway&&m.parts.some(p=>p.id===experiment.part),'Preset defines its own settings and camera');
  m.reset({settings:{...D,size:3,battery:6.5,power:0},time:600,mass:500});m.reset(experiment.initialState);assert.deepEqual(m.getState().values,experiment.values);t.add();
  for(const time of [0,1.67,38.41,100,223.78,600]){
    m.reset({...experiment.initialState,time});const s=m.getState();m.root.updateMatrixWorld(true);
    t.near(s.mass,time?m.scientificPlan().massAt(time):experiment.initialState.mass*1e-6,1e-15,'Prepared starting mass and subsequent input');
    for(const path of g.paths)for(const [i,object]of path.objects.entries()){
      const a=vector(path.points[i]),b=vector(path.points[i+1]),actual=ends(object);
      t.ok(actual.some(p=>p.distanceTo(a)<1e-7)&&actual.some(p=>p.distanceTo(b)<1e-7),'Every routed conductor reaches its assigned endpoints');
    }
    const blade=ends(g.blade),start=vector(g.powerStart),end=vector(g.powerEnd);
    t.ok(blade.some(p=>p.distanceTo(start)<1e-8),'Contact blade remains attached to battery terminal');
    const distance=Math.min(...blade.map(p=>p.distanceTo(end)));t.ok(s.values.power?distance<1e-8:distance>.4,'Open contact has a visible physical gap');
    const supply=g.paths.find(p=>p.id==='reference-supply');
    for(let i=1;i<supply.points.length;i++){const a=vector(supply.points[i-1]),b=vector(supply.points[i]),segment=new THREE.Line3(a,b),closest=segment.closestPointToPoint(start,true,new THREE.Vector3());t.ok(closest.distanceTo(start)>.25,'Reference conductor does not bypass switch contact');}
    for(const half of g.halves){
      t.near(half.electrode.position.z-g.gasBase,half.gap,1e-12,'Visible air gap matches science geometry');
      for(const track of half.tracks){
        t.near(track.start[2],g.gasBase,0,'Alpha originates on source foil surface');
        t.ok(track.end[2]<=g.gasBase+half.gap+1e-10&&half.side*track.end[0]>=-1e-10&&Math.hypot(track.end[0],track.end[1])<=C.radius+1e-10,'Tracks stop inside their actual half-cylinder');
        t.near(vector(track.start).distanceTo(vector(track.end)),track.path.length,1e-10,'Drawn track length matches deposited-energy calculation');
      }
      for(const charge of half.charges){
        for(const object of [charge.plus,charge.minus])t.ok(object.position.z>=g.gasBase&&object.position.z<=g.gasBase+half.gap,'Illustrative ion remains between electrodes');
      }
      if(half.side<0)t.ok(half.particles.length===0&&half.captures.length===0,'Smoke does not enter reference geometry');
    }
    for(const [i,budget]of [s.open,s.closed].entries()){
      const widths=g.balanceRows[i].bars.map(b=>b.visible?b.scale.x:0);t.near(widths.reduce((a,b)=>a+b,0),4.5,1e-10,'Visible balance fills fixed full-generation width');
      t.near(widths[0]/4.5,budget.collectionShare,1e-12,'Collection bar encodes actual charge-balance fraction');
    }
    t.ok(g.waves.every(w=>w.visible===s.hornPulse),'Sound pressure cues follow powered drive');
    if(!s.values.power)t.ok(g.flow.every(o=>!o.visible)&&g.halves.every(h=>h.tracks.every(track=>track.alpha.visible)),'Unpowered scene stops wire current but retains source activity');
    const before=structuredClone(s);for(const action of m.actions.filter(a=>a.label.startsWith('Inspect:'))){action.run();assert.deepEqual(m.getState(),before);t.add();}
    checkFinite(m.root,t);
  }
  outcomes.push({title:experiment.title,time:m.getState().time,onset:m.getState().onset,active:m.getState().active});
}
m.reset({time:100});const captures=g.halves[1].captures.filter(c=>c.ion.visible);t.ok(captures.length>0,'Smoky state has explicit capture examples');
const capture=g.halves[1].captures[0];m.reset({time:24});const attachedBefore=capture.ion.position.clone();m.advance(.1);const attachedAfter=capture.ion.position.clone();t.ok(attachedBefore.distanceTo(attachedAfter)<.04,'Captured ion moves slowly with its smoke particle');
m.reset({time:1});const ref=g.halves[0],open=g.halves[1],refPlus=ref.charges[0].plus.position.z,openPlus=open.charges[0].plus.position.z;m.advance(.001);
t.ok(ref.charges[0].plus.position.z<refPlus&&open.charges[0].plus.position.z>openPlus,'Positive ions drift toward lower potential in each half');
m.reset({settings:{...D,power:0},time:1});const fixed=g.halves[1].charges[0].plus.position.clone(),alpha=g.halves[1].tracks[0].alpha.position.clone();m.advance(.1);t.near(fixed.distanceTo(g.halves[1].charges[0].plus.position),0,0,'Zero field has no directional drift');t.ok(alpha.distanceTo(g.halves[1].tracks[0].alpha.position)>0,'Alpha animation continues without battery');
checkControlsMove(m,()=>({battery:g.batteryText.userData.labelText,status:g.status.userData.labelText,footer:g.footer.userData.labelText,balance:g.balanceRows.map(row=>row.text.userData.labelText),contact:g.blade.quaternion.toArray()}),model=>model.playback.advance(12),t);
m.reset();m.playback.step();t.near(m.getState().time,5,0,'Step is five simulated seconds');m.update({pace:.25});m.playback.advance(1);t.near(m.getState().time,10,0,'Quarter pace retains state then advances five seconds');m.playback.step();t.near(m.getState().time,15,0,'Step is unchanged at slow pace');
m.reset();m.actions.find(a=>a.label==='Advance to next sample').run();t.near(m.getState().time,1.67,1e-12,'Next sample action lands on actual check');m.actions.find(a=>a.label==='Finish observation').run();t.ok(m.playback.complete(),'Finish reaches completion');m.reset(m.replayState());t.near(m.getState().time,0,0,'Replay restores start');
m.reset({time:150});const mass=m.getState().mass;m.actions.find(a=>a.label==='Clear smoke now').run();t.near(m.getState().mass,mass,1e-16,'Clear action preserves present concentration');m.advance(5);t.ok(m.getState().mass<mass&&!m.getState().active,'Clear action changes subsequent behavior and releases alarm');
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' has inspectable geometry');
assert.equal(houseComponents['Ionization smoke detector'].createModel,createIonizationSmokeModel);assert.equal(houseComponents['Ionization smoke detector'].lesson,lesson);assert.equal(houseComponents['Optical smoke detector'].createModel,createOpticalSmokeModel);t.add(3);
const parts=m.parts.map(p=>p.id),resources=checkDisposal(m,t),report={passed:true,checks:t.count,parts,resources,outcomes};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS ionization model: ${t.count} checks; ${parts.length} parts; ${resources} resources; ${outcomes.length} trials`);

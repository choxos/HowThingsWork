import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createDiodeModel} from './diode-model.js';
import {diodeCircuit,diodeCurve,createDiodeController,thermalState,DIODE_DEFAULTS as D,DIODE_DOMAINS,LOAD} from './diode-physics.js';
import {diodeLesson as lesson} from './diode-lesson.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal,checkControlsMove} from './model-check-kit.mjs';

const t=tally(),near=(a,b,why,tolerance=1e-10)=>t.near(a,b,tolerance,why),nvt=1.906*1.380649e-23*298.15/1.602176634e-19;
function oracle(source,resistance){
  if(source===0)return {current:0,voltage:0};
  let lo=-20.1,hi=1.1;
  for(let i=0;i<90;i++){
    const v=(lo+hi)/2,ij=4.352e-9*Math.expm1(v/nvt),vd=v+.6458*ij;
    if(vd+resistance*(ij+vd/5.827e9)>source)hi=v;else lo=v;
  }
  const v=(lo+hi)/2,ij=4.352e-9*Math.expm1(v/nvt),voltage=v+.6458*ij;
  return {current:ij+voltage/5.827e9,voltage};
}
const fixtures=[
  [6,220,.0237500733161874555,.774983870438759784],[-6,220,-5.38168917385076055e-9,-5.99999881602838175],
  [20,220,.0869122567538054917,.879303514162791829],[-20,220,-7.78429762956144182e-9,-19.9999982874545215],
  [6,2200,.00243199087557507378,.649620073734837692],[2.12,220,.00645447445841765767,.700015619148115313],
  [2.78,220,.00936313099600881115,.720111180878061548],[8.37,220,.0344089901121302909,.800022175331336002],[.8,220,.000907454862109845311,.600359930335834032],
];
for(const [voltage,resistance,current,vd] of fixtures){const s=diodeCircuit({voltage,resistance});near(s.current,current,'65-digit decimal reference current',Math.abs(current)*1e-12);near(s.diodeVoltage,vd,'65-digit decimal reference voltage',1e-13);}
let combinations=0,oracleCases=0;
for(let volts=-80;volts<=80;volts++)for(let resistance=220;resistance<=2200;resistance+=10)for(const orientation of [-1,1])for(const closed of [0,1]){
  const voltage=volts/4,s=diodeCircuit({voltage,resistance,orientation,closed});
  near(voltage,s.loadVoltage+orientation*s.diodeVoltage+s.switchVoltage,'Complete circuit KVL',2e-12);
  near(s.diodeCurrent,s.junctionCurrent+s.leak,'Parallel branch KCL',1e-16);near(s.diodeVoltage,s.junctionVoltage+.6458*s.junctionCurrent,'Internal series drop',1e-15);
  near(s.sourcePower,s.power+s.diodePower,'Electrical energy conservation',2e-12);
  t.ok(s.power>=0&&s.diodePower>=0&&s.sourcePower>=0,'Passive load and diode absorb nonnegative power');
  t.ok(Math.abs(s.current)<.09&&Math.abs(s.diodeVoltage)<=20,'Configured operating range stays bounded');
  if([220,470,1000,1500,2200].includes(resistance)){
    const ref=closed?oracle(orientation*voltage,resistance):{current:0,voltage:0};near(s.current,orientation*ref.current,'Independent bisection current',Math.max(1e-19,Math.abs(ref.current)*1e-11));near(s.diodeVoltage,ref.voltage,'Independent bisection voltage',3e-12);oracleCases++;
  }
  combinations++;
}
for(const voltage of [-20,-5,-.1,-.001,0,.1,.3,.49,.6,.7,.72,.8,.9,1]){const s=diodeCurve(voltage),ref=oracle(voltage,0);near(s.current,ref.current,'Isolated curve current',Math.max(1e-19,Math.abs(ref.current)*1e-11));near(s.junction+.6458*s.diodeCurrent,voltage,'Diode terminal voltage',2e-13);}
for(const power of [0,.001,.1,1.7])for(const initialTemperature of [25,100,200]){
  let temperature=initialTemperature,loss=0;const dt=.001;
  for(let i=0;i<12000;i++){
    const rate=x=>(power-(x-25)/80)/.12,a=rate(temperature),b=rate(temperature+a*dt/2),c=rate(temperature+b*dt/2),d=rate(temperature+c*dt);
    const next=temperature+dt*(a+2*b+2*c+d)/6;loss+=power*dt-.12*(next-temperature);temperature=next;
  }
  const exact=thermalState(power,initialTemperature,12);near(exact.temperature,temperature,'Independent RK4 temperature',2e-10);near(exact.energyOut,loss,'Independent heat-loss integral',2e-10);near(exact.stored+exact.energyOut,.12*(initialTemperature-25)+exact.energyIn,'Thermal energy balance',1e-12);
}
const controller=createDiodeController();controller.advance(8);const warm=controller.getState().temperature;controller.update({closed:0});near(controller.getState().temperature,warm,'Opening preserves stored heat');near(controller.getState().time,0,'Changed settings start a new run');controller.advance(12);t.ok(controller.getState().temperature<warm&&controller.getState().temperature>25,'Open warm load cools continuously');
const replay=controller.replayState();near(replay.temperature,warm,'Replay owns the warm starting condition');controller.reset(replay);near(controller.getState().temperature,warm,'Replay restores its initial temperature');
for(const [key,[lo,hi,step]] of Object.entries(DIODE_DOMAINS))for(const value of [lo-step,hi+step,lo+step/3,NaN,Infinity]){
  const old=controller.getState();assert.throws(()=>controller.update({[key]:value}));assert.deepEqual(controller.getState(),old);assert.throws(()=>controller.reset({settings:{[key]:value}}));assert.deepEqual(controller.getState(),old);t.add(4);
}
for(const initial of [null,[],{time:-1},{time:13},{temperature:24},{temperature:201},{temperature:NaN},{settings:{voltage:6},extra:0}]){const old=controller.getState();assert.throws(()=>controller.reset(initial));assert.deepEqual(controller.getState(),old);t.add(2);}
for(const value of [-1,NaN,Infinity])assert.throws(()=>controller.advance(value));
for(const chunks of [[12],[1,2,3,6],Array(120).fill(.1),Array(48).fill(.25)]){
  const c=createDiodeController({settings:{voltage:20}});for(const dt of chunks)c.advance(dt);near(c.getState().temperature,119.85621239847515,'Frame partition independence',1e-11);near(c.getState().time,12,'Twelve-second completion',1e-12);t.ok(c.getState().complete,'Partitioned elapsed duration completes the experiment');
}

const m=createDiodeModel(),g=m.topology,outcomes=[],v3=p=>new THREE.Vector3(...p),world=o=>o.getWorldPosition(new THREE.Vector3());
assert.deepEqual(m.controls.map(x=>x.key),Object.keys(D));t.add();
const endpoints=rod=>[-1,1].map(sign=>rod.localToWorld(new THREE.Vector3(0,sign*rod.geometry.parameters.height/2,0)));
for(const trial of lesson.tryIt){
  assert.deepEqual(trial.values,trial.initialState.settings);assert.deepEqual(Object.keys(trial.values),Object.keys(D));t.add(2);
  t.ok(trial.reset&&trial.isolate&&m.parts.some(p=>p.id===trial.part),'Every trial owns its complete circuit, temperature, clock and view');
  m.reset({settings:{voltage:20,orientation:-1,closed:0,resistance:2200},temperature:150,time:12});m.reset(trial.initialState);near(m.getState().temperature,trial.initialState.temperature,'Preset clears inherited heat');
  for(const time of [0,2.5,7,12]){
    m.reset({...trial.initialState,time});const s=m.getState();assert.deepEqual(s.values,trial.values);near(s.time,time,'Preset clock');m.root.updateMatrixWorld(true);
    for(const w of g.wires){const ends=endpoints(w.object);t.ok(ends.some(e=>e.distanceTo(v3(w.a))<1e-7)&&ends.some(e=>e.distanceTo(v3(w.b))<1e-7),'Each wire reaches both authored junctions');}
    for(const lead of [g.anode,g.cathode]){const ends=endpoints(lead.children[0]);t.ok(g.socketEnds.some(socket=>ends.some(end=>end.distanceTo(world(socket))<1e-7)),'Rotating the diode preserves physical socket contact');}
    const switchTip=g.lever.localToWorld(v3([.65,0,0]));t.ok(s.values.closed?switchTip.distanceTo(world(g.switchEnds[1]))<1e-7:switchTip.distanceTo(world(g.switchEnds[1]))>.3,'Switch continuity matches physical blade position');
    near(world(g.meterEnds[0]).distanceTo(v3([-.695,-1.23,.17])),0,'Meter lead contact',1e-10);near(world(g.meterEnds[1]).distanceTo(v3([.755,-1.23,.17])),0,'Meter return contact',1e-10);
    t.ok(g.thermometer.parent===g.load,'Load inspection includes its thermometer');t.ok(g.flow.every(p=>p.visible===(s.values.closed&&s.current!==0)),'No current markers in open or zero-bias circuit');
    t.ok(g.cursor.visible===(s.diodeCurrent!==0),'Zero current is not plotted on a logarithmic axis');near(g.needle.position.distanceTo(v3([0,-.04,.205])),0,'Meter needle keeps its pivot',1e-14);
    const state=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),state);t.add();}checkFinite(m.root,t);
  }
  const s=m.getState();outcomes.push({title:trial.title,values:s.values,current:s.current,diodeVoltage:s.diodeVoltage,power:s.power,temperature:s.temperature,time:s.time});
}
const get=title=>outcomes.find(x=>x.title===title);
near(get('Power the load').temperature,get('Reverse both').temperature,'Double reversal restores power and heating');near(get('Power the load').current,-get('Reverse both').current,'Double reversal reverses loop current');
t.ok(get('Reverse the source').temperature<25.000001&&get('Twenty volts reversed').power<2e-14,'Leakage does not visibly heat the load');t.ok(get('Ten times the load resistance').temperature<get('Power the load').temperature,'Increasing resistance at fixed source reduces this load power');
near(get('Let a warm load cool').temperature,46.48785976451426,'Prepared cooling result',1e-12);
checkControlsMove(m,()=>({diode:g.diode.rotation.z,switch:g.lever.rotation.z,needle:g.needle.rotation.z,column:g.mercury.scale.y,depletion:g.depleted.scale.x}),model=>model.advance(4),t);
m.reset();m.advance(3);for(const delta of [-1,NaN,Infinity]){const state=m.getState();m.advance(delta);assert.deepEqual(m.getState(),state);t.add();}
m.reset();m.playback.step();near(m.getState().time,.25,'Quarter-second step');m.advance(20);t.ok(m.playback.complete(),'Completion is explicit');m.reset(m.replayState());t.ok(!m.getState().complete&&m.getState().temperature===25,'Completed experiment replays from its prepared start');
for(const part of m.parts){const b=new THREE.Box3().setFromObject(part.object);t.ok(!b.isEmpty(),part.id+' has inspectable geometry');}
t.ok(m.parts.length===19&&m.catalogParts.length===17,'Nineteen parts and seventeen bookmarks');assert.equal(houseComponents.Diode.createModel,createDiodeModel);assert.equal(houseComponents.Diode.lesson,lesson);t.add(2);
const resources=checkDisposal(m,t),report={passed:true,checks:t.count,combinations,oracleCases,decimalFixtures:fixtures.length,trials:outcomes,resources};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS diode: ${t.count} checks; ${combinations} circuit combinations; ${oracleCases} independent oracles; ${outcomes.length} full-state trials; ${resources} resources`);

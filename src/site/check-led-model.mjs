import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createLedModel} from './led-model.js';
import {ledCircuit,ledOnTime,createLedController,LED_DEFAULTS as D,LED_DOMAINS,LED_EXPERIMENT as E} from './led-physics.js';
import {lightEmittingDiodeLesson as lesson} from './led-lesson.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal,checkControlsMove} from './model-check-kit.mjs';

const t=tally(),near=(a,b,why,tolerance=1e-11)=>t.near(a,b,tolerance,why);
const nvt=2*1.380649e-23*298.15/1.602176634e-19,rs=.812979222923678871425209935,
  saturation=[1.893424260396379410088651e-12,3.42730747838314892549135e-19,1.4264393026476302021650638e-22];
function oracle(voltage,resistance,emitter){
  let lo=0,hi=voltage;
  for(let k=0;k<100;k++){const junction=(lo+hi)/2,current=saturation[emitter]*Math.expm1(junction/nvt);if(junction+current*(rs+resistance+.45)>voltage)hi=junction;else lo=junction;}
  const junction=(lo+hi)/2,current=saturation[emitter]*Math.expm1(junction/nvt);return {current,voltage:junction+rs*current};
}
const fixtures=[
  [0,3,15,.106264401399822357915,1.35821499837274457021],[0,1.6,15,.02477947880559301813,1.21715705245358786985],
  [1,3,100,.01036918136123054480,1.95841573226439177487],[1,1.6,100,.000011173502301182021789,1.59887762169384626591],
  [2,3,100,.00664487822991981160,2.33252198180455492477],[2,1.6,100,4.75388111217950161249e-9,1.59999952247264228157],
];
for(const [emitter,voltage,resistance,current,vd] of fixtures){const s=ledCircuit({emitter,voltage,resistance});near(s.current,current,'75-digit Decimal bisection current',current*2e-13);near(s.voltage,vd,'75-digit Decimal bisection voltage',2e-14);}
let combinations=0,oracles=0;
for(let v=0;v<=33;v++)for(let resistance=15;resistance<=330;resistance+=5)for(const emitter of [0,1,2])for(const closed of [0,1]){
  const voltage=v/10,s=ledCircuit({voltage,resistance,emitter,closed}),ref=closed&&voltage?oracle(voltage,resistance,emitter):{current:0,voltage:0};
  near(s.current,ref.current,'Independent junction-voltage bisection',Math.max(1e-30,ref.current*2e-12));near(s.voltage,ref.voltage,'Independent LED terminal voltage',2e-12);oracles++;
  near(voltage,s.resistorVoltage+s.sourceDrop+s.voltage+s.switchVoltage,'Complete loop KVL',4e-12);
  near(s.sourcePower,s.ledPower+s.resistorPower+s.sourceLoss,'Source energy balance',2e-12);
  near(s.current,saturation[emitter]*Math.expm1(s.junctionVoltage/nvt),'Fitted diode equation',Math.max(1e-30,s.current*2e-12));
  t.ok(s.current>=0&&s.ledPower>=0&&s.target>=0,'Nonnegative forward current and light');
  t.ok(s.aboveDcRating===(s.current>s.dcLimit*(1+1e-12)),'DC rating flag never clamps predicted current');
  if(s.infrared){near(s.radiantPower+s.nonRadiantPower,s.ledPower,'LED optical and nonradiative energy balance',1e-15);t.ok(s.radiantPower<=s.ledPower,'Assigned IR conversion stays below electrical input');}
  else for(const field of ['radiantPower','nonRadiantPower','photonsPerSecond','externalQuantumEfficiency']){assert.equal(s[field],null);t.add();}
  combinations++;
}
for(const emitter of [0,1,2])for(const distance of Array.from({length:20},(_,i)=>(i+1)/10)){
  const s=ledCircuit({emitter,distance}),reference=ledCircuit({emitter,distance:1});near(s.current,reference.current,'Distance does not change electrical current',0);near(s.target*distance**2,reference.target,'Inverse-square on-axis target',1e-15);
  near(s.photonEnergy,6.62607015e-34*299792458/(s.wavelength*1e-9),'Exact SI photon energy',1e-33);
}
for(const [wavelength,ev] of [[940,1.3189808343957474],[635,1.9525070619401614],[585,2.119388007405133]])near(ledCircuit({emitter:[940,635,585].indexOf(wavelength)}).photonEv,ev,'Fixed photon energy reference',1e-14);
for(const drive of [0,1])for(let k=0;k<=1200;k++){
  const time=k/100,real=time/19000;let oracleTime=0;
  if(!drive)oracleTime=real;
  else for(let cycle=0;cycle<24;cycle++)oracleTime+=Math.max(0,Math.min(real,(cycle+1/3)/38000)-cycle/38000);
  near(ledOnTime(time,drive),oracleTime,'Independent sum of clipped pulse intervals',2e-18);
}
for(const time of [0,1/6,.5,.5+1/6,11.5+1/6,12]){
  const c=createLedController({time});const s=c.getState();near(s.onTime,ledOnTime(time,1),'Pulse integration at boundaries',1e-18);
  assert.equal(Boolean(s.gate),Math.abs(time*2-Math.round(time*2))<1e-12);t.add();
}
for(const chunks of [[12],[1,2,3,6],Array(120).fill(.1),Array(144).fill(1/12)]){
  const c=createLedController();for(const dt of chunks)c.advance(dt);const s=c.getState();near(s.time,12,'Frame partition endpoint',1e-12);t.ok(s.complete,'Partitioned elapsed duration completes');near(s.onTime,24/3/38000,'Exact 24-cycle on-time',1e-18);near(s.exposure,.000016205462879925936,'Fixed completed exposure',1e-17);
  near(s.sourceEnergy,s.ledEnergy+s.resistorEnergy+s.sourceLossEnergy,'Integrated electrical energy balance',1e-18);near(s.ledEnergy,s.opticalEnergy+s.nonRadiantEnergy,'Integrated LED energy balance',1e-18);
  const replay=c.replayState();c.reset(replay);near(c.getState().time,0,'Replay owns its starting time',0);near(c.getState().exposure,0,'Replay clears prior accumulated light',0);
}
const controller=createLedController();controller.advance(7);const unchanged=controller.getState();controller.update({});assert.deepEqual(controller.getState(),unchanged);t.add();controller.update({distance:2});near(controller.getState().time,0,'Physical controls begin a new measurement',0);
for(const [key,[lo,hi,step]] of Object.entries(LED_DOMAINS))for(const value of [lo-step,hi+step,lo+step/3,NaN,Infinity]){
  const before=controller.getState();assert.throws(()=>controller.update({[key]:value}));assert.deepEqual(controller.getState(),before);assert.throws(()=>controller.reset({settings:{[key]:value}}));assert.deepEqual(controller.getState(),before);t.add(4);
}
for(const input of [null,[],{time:-1},{time:13},{time:NaN},{settings:{voltage:3},extra:0}]){const before=controller.getState();assert.throws(()=>controller.reset(input));assert.deepEqual(controller.getState(),before);t.add(2);}
for(const step of [-1,NaN,Infinity])assert.throws(()=>controller.advance(step));

const m=createLedModel(),g=m.topology,outcomes=[],v3=p=>new THREE.Vector3(...p),world=o=>o.getWorldPosition(new THREE.Vector3());
const endpoints=rod=>[-1,1].map(sign=>rod.localToWorld(new THREE.Vector3(0,sign*rod.geometry.parameters.height/2,0)));
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
for(const trial of lesson.tryIt){
  assert.deepEqual(Object.keys(trial.values),Object.keys(D));assert.deepEqual(trial.values,trial.initialState.settings);t.add(2);
  t.ok(trial.reset&&trial.isolate&&trial.cutaway===false&&m.parts.some(p=>p.id===trial.part),'Every trial owns complete settings and inspection state');
  m.reset({settings:{voltage:0,closed:0,distance:2,emitter:2,resistance:330,drive:0},time:12});m.reset(trial.initialState);near(m.getState().exposure,0,'Trial clears inherited exposure',0);
  for(const time of [0,1/12,1/6,4.25,12]){
    m.reset({...trial.initialState,time});const s=m.getState();assert.deepEqual(s.values,trial.values);t.add();m.root.updateMatrixWorld(true);
    for(const w of g.wires){const ends=endpoints(w.object);t.ok(ends.some(e=>e.distanceTo(v3(w.a))<1e-7)&&ends.some(e=>e.distanceTo(v3(w.b))<1e-7),'Each wire reaches both authored contacts');}
    for(const lead of [g.anodeRod,g.cathodeRod]){const ends=endpoints(lead);t.ok(g.socketEnds.some(socket=>ends.some(end=>end.distanceTo(world(socket))<1e-7)),'Both package leads meet their sockets');}
    const tip=g.lever.localToWorld(v3([.56,0,0]));t.ok(s.values.closed?tip.distanceTo(world(g.switchEnds[1]))<1e-7:tip.distanceTo(world(g.switchEnds[1]))>.3,'Manual switch geometry matches continuity');
    near(world(g.driverEnds[0]).distanceTo(v3([-1.125,-.9,.15])),0,'Driver input contact',1e-14);near(world(g.driverEnds[1]).distanceTo(v3([-.275,-.9,.15])),0,'Driver output contact',1e-14);
    for(const [i,p] of [[0,[-.165,-1.2,.15]],[1,[1.105,-1.2,.15]]])near(world(g.meterEnds[i]).distanceTo(v3(p)),0,'Meter contact',1e-14);
    const bondStart=g.bond.localToWorld(v3(g.bondPoints[0])),bondEnd=g.bond.localToWorld(v3(g.bondPoints.at(-1)));
    t.ok(endpoints(g.anodeRod).some(end=>end.distanceTo(bondStart)<1e-7),'Bond wire begins on anode lead');near(bondEnd.distanceTo(g.die.localToWorld(v3([0,.04,0]))),0,'Bond wire reaches die top',1e-14);
    const cathodeBounds=new THREE.Box3().setFromObject(g.cathodeRod),cupBounds=new THREE.Box3().setFromObject(g.cup),dieBounds=new THREE.Box3().setFromObject(g.die);t.ok(cathodeBounds.intersectsBox(cupBounds)&&cupBounds.intersectsBox(dieBounds),'Cathode cup and die remain mechanically connected');
    t.ok(g.flow.every(p=>p.visible===(s.instantaneousCurrent>0)),'Current markers stop in gaps and open circuits');t.ok(g.beamRoot.visible===(s.instantaneousTarget>0),'No driven beam when target input is zero');
    near(g.target.position.x,1.55+.6*s.values.distance,'Distance moves physical target',1e-14);
    const beamEnd=g.beam.localToWorld(v3([0,.5,0]));near(beamEnd.x,g.target.position.x-.075,'Beam ends at target face',1e-14);
    const state=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),state);t.add();}checkFinite(m.root,t);
  }
  const s=m.getState();outcomes.push({title:trial.title,values:s.values,current:s.current,voltage:s.voltage,meanCurrent:s.meanCurrent,photonEv:s.photonEv,ledPower:s.ledPower,radiantPower:s.radiantPower,intensity:s.intensity,target:s.target,exposure:s.exposure,time:s.time});
}
for(const [resistance,colors] of [[15,[0x805b3b,0x54884e,0x252821,0xe3b45e,0xe3b45e]],[100,[0x805b3b,0x252821,0x252821,0x252821,0xe3b45e]],[105,[0x805b3b,0x252821,0x54884e,0x252821,0xe3b45e]],[330,[0xe17c32,0xe17c32,0x252821,0x252821,0xe3b45e]]]){m.reset({settings:{resistance}});assert.deepEqual(g.resistorBands.map(b=>b.material.color.getHex()),colors);t.add();}
const get=title=>outcomes.find(x=>x.title===title);
near(get('Compare steady infrared drive').exposure,3*get('Drive the infrared transmitter').exposure,'Steady drive accumulates triple exposure',1e-18);
near(get('Move the target twice as far').exposure,get('Drive the infrared transmitter').exposure/4,'Double distance quarters exposure',1e-18);
near(get('Bring the visible target closer').exposure,4*get('Try the red indicator').exposure,'Half distance quadruples visible exposure',1e-18);
t.ok(get('Red with a tired source').current>get('Yellow with a tired source').current&&get('Yellow with a tired source').current>0,'Both low-bias currents stay positive');
checkControlsMove(m,()=>({gate:g.beamRoot.visible,color:g.barrel.material.color.getHex(),target:g.target.position.x,switch:g.lever.rotation.z,source:g.sourceText.userData.labelText,resistor:g.resistorText.userData.labelText,exposure:g.exposureBar.scale.x}),model=>model.advance(4.25),t);
m.reset();m.playback.step();near(m.getState().time,1/12,'One-sixth-cycle step',1e-15);m.playback.step();t.ok(!m.getState().gate,'Second step reaches the off boundary');
m.reset();for(let i=0;i<144;i++){m.playback.step();const phase=(i+1)%6;t.ok(Boolean(m.getState().gate)===(phase<2),'Repeated steps preserve half-open pulse boundaries');}
for(const value of [-1,NaN,Infinity]){const before=m.getState();m.advance(value);assert.deepEqual(m.getState(),before);t.add();}
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' contains inspectable geometry');
t.ok(m.parts.length===23&&m.catalogParts.length===21,'Twenty-three parts and twenty-one bookmarks');assert.equal(houseComponents['Light-emitting diode'].createModel,createLedModel);assert.equal(houseComponents['Light-emitting diode'].lesson,lesson);t.add(2);
const resources=checkDisposal(m,t),report={passed:true,checks:t.count,combinations,oracles,decimalFixtures:fixtures.length,trials:outcomes,resources};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS LED: ${t.count} checks; ${combinations} circuits; ${oracles} independent oracles; ${outcomes.length} full-state trials; ${resources} resources`);

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createDishwasherModel,armNozzles} from './dishwasher-model.js';
import {rotatingSprayArmLesson as lesson} from './dishwasher-lessons.js';
import {sampleWasher,BEARINGS} from './dishwasher-physics.js';
import {tally,checkControlsMove,checkFinite,checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {componentParentIds,catalogMachineComponents,groupCatalogEntries} from './catalog-hierarchy.js';
const t=tally(),m=createDishwasherModel({sprayArmLesson:true}),p=m.topology;
const dir=process.env.EVIDENCE_DIR||'documentation/audit/evidence/rotating-spray-arm-20260921';await mkdir(dir,{recursive:true});
const seen=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
assert.deepEqual(m.controls.map(c=>c.key),['pump','tilt','nozzle','bearing']);assert.equal(m.covers.length,0);
assert.equal(m.initialPart,'system');assert.equal(m.initialView,'front');assert.equal(m.parts.length,10);
assert.ok(['cabinet','rack','water','heater','filter','softener','inlet','drain','cycle'].every(id=>!m.parts.some(part=>part.id===id)));
let states=0,trajectoryPoints=0;
for(const trial of lesson.tryIt){
 assert.deepEqual(Object.keys(trial.values).sort(),Object.keys(m.defaults).sort());assert.ok(trial.reset);assert.equal(trial.part,'system');assert.equal(trial.view,'front');
 m.reset();m.update(trial.values);
 for(const time of [0,.1,.5,1,3,6]){
  m.advance(time-m.getState().elapsed);const s=m.getState(),ref=sampleWasher(trial.values,.25+time),run=s.operating;
  t.near(s.elapsed,time,1e-14,'Mechanical clock starts at pump startup');t.near(s.duration,6,0,'Six-second observation');assert.equal(s.complete,time===6);assert.equal(s.pumping,true);if(time>0)assert.ok(p.pipeRoutes.find(route=>route.active==='pump').dots.every(dot=>dot.visible),'Pump-on snapshot retains flow markers');
  t.near(s.armSpeed,ref.armSpeed,1e-12,'Shared startup dynamics');t.near(s.armAngle,ref.armAngle,1e-12,'Continuous startup angle');
  t.near(s.tipTorque-s.uprightBrake-s.resistance,run.net,2e-16,'Visible torque balance');
  const area=2*Math.PI*(trial.values.nozzle/2000)**2+6*Math.PI*.0008**2,p0=trial.values.pump*1000,pressure=p0/(1+2*p0/1000*(area/(40/60000))**2);
  if(time===0)t.near(run.pressure,pressure,1e-6,'Independent closed-form stationary pressure');
  if(trial.values.bearing===2){t.near(s.armSpeed,0,0,'Spoon holds arm');t.near(s.resistance,run.jetTorque,0,'Spoon balances water torque');}
  if(s.stuck){t.near(s.armAngle,0,0,'No phantom reverse spin');assert.ok(run.flow>0);}
  if(s.stuck&&trial.values.bearing!==2)t.near(s.resistance,Math.min(BEARINGS[trial.values.bearing].torque,run.jetTorque),0,'Static friction is only the required torque');
  assert.equal(p.spoon.visible,trial.values.bearing===2);assert.ok(seen(p.arm)&&seen(p.pump));assert.ok(!seen(p.cabinet)&&!seen(p.rack)&&!seen(p.cycle));
  m.root.updateMatrixWorld(true);
  p.tipNozzles.forEach((nozzle,i)=>{
   const local=new THREE.Vector3(0,12/Math.cos(trial.values.tilt*Math.PI/180)*p.MM,0).applyMatrix4(nozzle.matrixWorld);p.spray.worldToLocal(local);
   const start=new THREE.Vector3().fromArray(p.jetLines[i].geometry.attributes.position.array);t.near(start.distanceTo(local),0,1e-6,'Jet begins at actual open bore');
  });
  if(time>=.035)armNozzles().forEach((n,i)=>{
   const line=p.jetLines[i];assert.equal(line.geometry.drawRange.count,32);
   for(let j=0;j<32;j++){
    const age=j*.035/31,h=sampleWasher(trial.values,.25+time-age),theta=h.armAngle,r=n.x/1000,jet=h.operating.jets[i],v=h.armSpeed*r-(n.tip?Math.sign(r)*jet.speed*Math.sin(trial.values.tilt*Math.PI/180):0);
    const expected=[(r*Math.cos(theta)-Math.sin(theta)*v*age)*5,(.17+jet.up*age-4.905*age*age)*5,(-r*Math.sin(theta)-Math.cos(theta)*v*age)*5];
    for(let k=0;k<3;k++)t.near(line.geometry.attributes.position.array[j*3+k],expected[k],2e-7,'Moving-outlet free-flight trail');trajectoryPoints++;
   }
  });
  states++;
 }
 const held=m.getState();for(const action of m.actions.filter(a=>a.group==='Look closer')){action.run();assert.deepEqual(m.getState().readings,held.readings);t.near(m.getState().elapsed,6,0,'Inspection never seeks');}
 const nozzle=p.tipNozzles[0];m.actions.find(a=>a.label==='See a tip nozzle').run();m.root.updateMatrixWorld(true);const axis=new THREE.Vector3(0,1,0).applyQuaternion(nozzle.getWorldQuaternion(new THREE.Quaternion()));t.near(axis.distanceTo(new THREE.Vector3(0,1,0)),0,1e-12,'Running nozzle bore faces inspection camera');
}
const snapshot=()=>[p.arm.rotation.y,p.tipNozzles[0].rotation.x,Array.from(p.tipNozzles[0].geometry.attributes.position.array).slice(0,18),p.jetLines.map(x=>Array.from(x.geometry.attributes.position.array)),p.spoon.visible];
checkControlsMove(m,snapshot,model=>model.advance(1),t);
for(const control of m.controls)for(const value of control.options?control.options.map(o=>o.value):[control.min,control.max]){
 m.reset();m.advance(.5);m.update({[control.key]:value});t.near(m.getState().elapsed,value===control.initial?.5:0,0,'Changed control restarts, no-op preserves time');m.advance(1);checkFinite(m.root,t);
}
for(const fps of [15,60,144]){m.reset();for(let i=0;i<=6*fps;i++)m.advance(1/fps);assert.equal(m.getState().elapsed,6);assert.ok(m.playback.complete());const held=m.getState().readings;m.advance(1);assert.deepEqual(m.getState().readings,held);}
m.reset();m.playback.step();t.near(m.getState().elapsed,.1,0,'Step advances a tenth of a second');for(const dt of [-1,NaN,Infinity,0])m.advance(dt);t.near(m.getState().elapsed,.1,0,'Invalid deltas ignored');
for(const action of m.actions.filter(a=>a.group==='Run')){action.run();assert.equal(m.getState().elapsed,{'Pump startup':0,'After half a second':.5,'After one second':1,'Finish the trial':6}[action.label]);}
m.reset();m.update({bearing:2});m.advance(1);const camera=new THREE.PerspectiveCamera(40,1,.01,100);camera.position.set(0,2,8);camera.lookAt(0,1,0);camera.updateMatrixWorld();const explosion=createPartExplosion(m,camera,1.2);explosion.update(1);const categories=explosion.categories.map(x=>x.id);assert.deepEqual(new Set(categories),new Set(['pump','spray-arm','spoon']));explosion.dispose();
assert.equal(componentParentIds['rotating-spray-arm'],'dishwasher');const entries=[{id:'dishwasher',name:'Dishwasher'},{id:'rotating-spray-arm',name:'Rotating spray arm'}],families=groupCatalogEntries(entries);assert.equal(families.length,1);assert.equal(catalogMachineComponents(families[0].components)[0].id,'rotating-spray-arm');
const resources=checkDisposal(m,t),report={result:'PASS',trials:lesson.tryIt.length,states,trajectoryPoints,checks:t.count,resources,categories,scope:'Focused pump-on startup. Parent checker independently verifies hydraulics, angular-impulse quadratures and every numeric preset claim.'};await writeFile(dir+'/model.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

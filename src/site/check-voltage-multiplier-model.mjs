import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVoltageMultiplierModel, capacitorSize, COLUMNS} from './voltage-multiplier-model.js';
import {sampleLadder, MULTIPLIER_DEFAULTS as D, LADDER} from './voltage-multiplier-physics.js';
import {voltageMultiplierLesson as lesson} from './voltage-multiplier-lesson.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
import {fixed} from './format.js';

const t=tally(),m=createVoltageMultiplierModel(),p=m.topology,MM=p.MM;
const defaults={window:0,...D};
const core=()=>{const s=m.getState();return [s.values,s.window,s.cycle,s.now.nodes,s.now.on];};
const reset=(settings={},cycle=0)=>{m.reset({settings:{...defaults,...settings},cycle});m.root.updateMatrixWorld(true);return m.getState();};
assert.deepEqual(m.defaults,defaults);assert.equal(m.parts.length,26);
assert.deepEqual(m.controls.map(c=>c.key),['window','stages','peak','frequency','capacitance','load']);
t.ok(m.controls.find(c=>c.key==='window').primary,'time window control is immediately visible');
for(const id of Object.keys(m.partViewDirections))t.ok(m.parts.some(part=>part.id===id),'camera target exists');
for(const group of m.thumbnailOmit){t.ok(group.userData.inspectionOnly&&group.userData.explosionExcluded,'charts do not shrink the normal board or separated inventory');}
let poses=0;
for(const settings of [{},{stages:1,capacitance:.5},{stages:3,peak:20,frequency:500,load:0},{stages:4,capacitance:5},{stages:4,peak:100,frequency:1000,capacitance:5,load:0},{stages:4,peak:100,capacitance:.5,load:500}]){
 for(const window of[0,1])for(const cycle of window?[399,399.25,399.75,400]:[0,.75,1.25,10,40]){
  const s=reset({...settings,window},cycle),{window:_,...physical}=s.values,ref=sampleLadder(physical,cycle,window?'late':'startup');poses++;
  assert.equal(s.window,window?'late':'startup');assert.equal(s.cycle,cycle);assert.deepEqual(s.now.nodes,ref.now.nodes);assert.equal(s.readings.length,9);
  t.near(s.top,2*s.N*s.values.peak,1e-12,'ideal voltage follows stages and peak');
  const size=capacitorSize(s.values.capacitance);
  for(const c of p.capacitors){
   assert.equal(c.group.visible,c.k<=s.N);
   const bottom=p.BASE+p.PITCH*(c.k-1),top=p.BASE+p.PITCH*c.k,middle=(bottom+top)/2;
   const length=c.low.geometry.parameters.height*c.low.scale.y/MM;
   t.near(c.low.position.y/MM-length/2,bottom,1e-8,'lower lead meets node');
   t.near(c.low.position.y/MM+length/2,middle-size[1]/2,1e-8,'lower lead meets changing package');
   t.near(c.high.position.y/MM-length/2,middle+size[1]/2,1e-8,'upper lead meets changing package');
   t.near(c.high.position.y/MM+length/2,top,1e-8,'upper lead meets node');
   if(!c.group.visible)continue;
   const box=new THREE.Box3(new THREE.Vector3(COLUMNS[c.column]-size[0]/2,middle-size[1]/2,0),new THREE.Vector3(COLUMNS[c.column]+size[0]/2,middle+size[1]/2,size[2])).expandByScalar(.4);
   for(const d of p.diodes)if(d.k<=s.N)for(const [a,b] of d.routes){
    const delta=b.clone().sub(a),ray=new THREE.Ray(a,delta.clone().normalize()),hit=ray.intersectBox(box,new THREE.Vector3());
    t.ok(!hit||hit.distanceTo(a)>delta.length()+1e-8,'rectifier wiring does not pass through a capacitor package');
   }
  }
  for(const d of p.diodes){assert.equal(d.group.visible,d.k<=s.N);assert.equal(d.body.material.color.getHex(),d.k<=s.N&&s.now.on[d.index]?0xc14f39:0x374736);assert.deepEqual(d.routes[0][0].toArray(),d.anode.toArray());assert.deepEqual(d.routes.at(-1)[1].toArray(),d.cathode.toArray());}
  for(let i=0;i<p.loads.length;i++){assert.equal(p.loads[i].group.visible,i+1===s.N);assert.equal(p.loads[i].branch.visible,s.values.load>0);}
  const value=label=>s.readings.find(r=>r.label===label).value;
  assert.equal(value('Load and delivered power'),`${fixed(s.late.current*1e6,1)} µA · ${fixed(s.late.loadPower*1000,3)} mW`);
  assert.equal(value('Still settling?'),s.late.repeating?'Repeats within 0.001 V per cycle':'Yes: cycle 400 still differs');
  for(let node=0;node<9;node++){
   const bar=p.plots.bars[node];assert.equal(bar.visible,node<=2*s.N);if(!bar.visible)continue;
   const zero=p.plots.nodePoint(node,0,s),at=p.plots.nodePoint(node,s.now.nodes[node],s);
   t.near(bar.position.y,(zero[1]+at[1])/2,1e-10,'node bar starts at zero');t.near(bar.scale.y,Math.max(.001,Math.abs(at[1]-zero[1])/MM),1e-10,'node bar matches signed voltage');
  }
  const output=p.plots.outputLine.geometry.attributes.position;
  for(const i of[0,60,600,2400]){const ref=p.plots.outputPoint(i/LADDER.kept,i?s.samples[i-1].output:0,s);t.near(output.getY(i),ref[1],1e-5,'startup chart matches retained sample');}
  const ripple=p.plots.rippleLine.geometry.attributes.position,limits=p.plots.getLimits();
  for(const i of[0,60,120,240]){const volts=i?s.lastCycle[i-1].output:s.previousCycle.at(-1).output,ref=p.plots.ripplePoint(i/240,volts,limits);t.near(ripple.getY(i),ref[1],1e-5,'late chart matches full-resolution sample');}
  assert.equal(p.plots.startupCursor.visible,!window);assert.equal(p.plots.rippleCursor.visible,Boolean(window));
  checkFinite(m.root,t);
 }
}
let checkpoints=0;
for(const trial of lesson.tryIt)for(const prior of[{window:0,stages:4,load:0},{window:1,peak:100,load:500}]){
 reset(prior,prior.window?399.9:39);m.reset(trial.initialState);m.animate(0);
 // Match the viewer's reset, control synchronization, then experiment apply.
 m.update({...Object.fromEntries(m.controls.map(c=>[c.key,c.initial])),...trial.initialState.settings});m.update(trial.values);
 assert.deepEqual(m.getState().values,trial.values);assert.equal(m.getState().cycle,trial.initialState.cycle);checkpoints++;
 for(const action of m.actions){const before=core();assert.equal(action.run().length,9);assert.deepEqual(core(),before,'inspection cannot change experiment time');t.ok(m.parts.some(part=>part.id===action.part),'inspection target exists');}
 t.ok(m.parts.some(part=>part.id===trial.part),'preset target exists');
}
reset({},10);m.update({load:0});assert.equal(m.getState().cycle,0);
m.update({window:1});assert.equal(m.getState().cycle,399);m.playback.step();assert.equal(m.getState().cycle,399.25);
m.advance(100);assert.ok(m.playback.complete());m.reset(m.replayState());assert.equal(m.getState().cycle,399);assert.equal(m.getState().values.load,0);
m.update({window:0});m.playback.step();assert.equal(m.getState().cycle,1);m.advance(100);assert.ok(m.playback.complete());m.reset(m.replayState());assert.equal(m.getState().cycle,0);m.animate(.5);assert.equal(m.getState().cycle,1);
let layouts=0;
for(const stages of[1,4])for(const aspect of[1,1.24]){
 reset({stages},10);const before=core(),{camera}=frameModel(m,aspect),explosion=createPartExplosion(m,camera,aspect);explosion.update(1);
 const inverse=camera.quaternion.clone().invert(),boxes=explosion.items.map(unit=>{const box=new THREE.Box3();for(const x of[unit.bounds.min.x,unit.bounds.max.x])for(const y of[unit.bounds.min.y,unit.bounds.max.y])for(const z of[unit.bounds.min.z,unit.bounds.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).add(unit.group.position).applyQuaternion(inverse));return box;});
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)t.ok(boxes[i].max.x<=boxes[j].min.x||boxes[j].max.x<=boxes[i].min.x||boxes[i].max.y<=boxes[j].min.y||boxes[j].max.y<=boxes[i].min.y,'separated groups do not overlap');
 explosion.update(0);explosion.dispose();assert.deepEqual(core(),before);layouts++;
}
const resources=checkDisposal(m,t);
console.log(`PASS voltage-multiplier model: ${t.count} checks; ${poses} poses; ${checkpoints} preset checkpoints; ${layouts} separated layouts; ${resources} resources`);

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSiphonModel} from './siphon-model.js';
import {createToiletTankModel} from './toilet-tank-model.js';
import {siphonLesson} from './siphon-lesson.js';
import {createPartExplosion} from './part-explosion.js';
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const model=createSiphonModel(),parent=createToiletTankModel(),rows=[];
const defaults={level:.18,bore:.032,pressure:0,stroke:.1,fault:0};
assert.deepEqual(model.defaults,defaults);assert.deepEqual(model.getState().values,defaults);
assert.deepEqual(model.controls.map(c=>c.key),['level','bore','pressure','stroke','fault']);
assert.equal(parent.getState().values.pressure,2);assert.equal(parent.controls.length,6);
const ignored=()=>assert.ok(!model.getState().readings.some(r=>r.label==='Annual repeated use'||r.label==='Cycle total'));
let states=0;
function inspect(){
  const s=model.getState(),t=model.topology,scale=t.MM,crest=.2775;
  near(s.drivingHead,s.level+.25);near(s.crestLift,crest-s.level);
  near(t.headArrow.position.y,s.level*1000*scale);
  near(t.headArrow.position.y-t.headArrow.cone.position.y,-.25*1000*scale,1e-7);
  near(t.liftArrow.position.y,s.level*1000*scale);
  near(s.inlet-s.outlet-.072*(s.level-s.values.level)-s.pipe,0,2e-10);
  assert.ok(s.outlet>=-1e-12);assert.ok(s.pipe>=-1e-12);
  const expected=s.stage==='siphoning'?`${(0.7*Math.sqrt(2*9.81*(s.level+.25))).toFixed(3)} m/s`:'No full siphoning column';
  assert.equal(s.readings.find(r=>r.label==='Full-column speed').value,expected);
  ignored();states++;return s;
}
for(const experiment of siphonLesson.tryIt){
  model.reset();model.update(experiment.values);assert.deepEqual(model.getState().values,experiment.values);inspect();
  const initial={...model.getState()};
  for(const action of model.actions){const readings=action.run();assert.deepEqual(readings,model.getState().readings);inspect();}
  model.reset();model.update(experiment.values);
  while(!model.getState().complete){model.advance(.037);inspect();}
  const s=model.getState();
  if(s.values.pressure===0){near(s.inlet,0);near(s.outlet,s.primed?.072*(initial.level-.04):0,1e-10);near(s.level,s.primed?.04:initial.level);}
  if(s.primed){near(s.primeVolume,Math.PI*.06**2*s.values.stroke*s.primeAt/.6,1e-10);assert.ok(s.primeAt<=.6);}
  rows.push({title:experiment.title,primed:s.primed,liters:s.outlet*1000,seconds:s.screenDuration});
}
assert.equal(rows[4].primed,false);assert.equal(rows[5].primed,false);assert.equal(rows[6].primed,false);
near(rows[0].liters,10.08);near(rows[1].liters,8.64);near(rows[2].liters,12.6);near(rows[3].liters,rows[0].liters);assert.ok(rows[3].seconds<rows[0].seconds);
assert.ok(rows[8].liters>rows[0].liters);assert.ok(rows[9].liters>0);assert.equal(rows[9].primed,false);
model.reset();model.actions.find(a=>a.label==='Inspect air entering').run();const air=inspect();
assert.equal(air.stage,'rundown');near(air.level,.04);assert.ok(air.flow>0&&air.pipe>0);
const retained=air.pipe,outlet=air.outlet;model.advance(1e4);near(model.getState().outlet-outlet,retained);
model.reset();model.animate(.2);near(model.getState().screen,.2);inspect();model.playback.advance(.1);near(model.getState().screen,.3);inspect();model.playback.step();near(model.getState().screen,.4);inspect();
for(const control of model.controls)for(const value of control.options?control.options.map(o=>o.value):[control.min,control.max]){
 model.reset();model.update({[control.key]:value});assert.equal(model.getState().values[control.key],value);model.actions.find(a=>a.label==='Inspect the falling level').run();inspect();model.advance(1e4);inspect();
}
model.reset();model.update({level:NaN,bore:Infinity,pressure:-2,stroke:2,fault:1.2});assert.deepEqual(model.getState().values,defaults);
const t=model.topology;assert.equal(t.guides.userData.explosionExcluded,true);
const camera=new THREE.PerspectiveCamera(45,1,.01,100);camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const explosion=createPartExplosion(model,camera);const guideGeometry=new Set();t.guides.traverse(o=>{if(o.geometry)guideGeometry.add(o.geometry);});
explosion.root.traverse(o=>{assert.ok(!guideGeometry.has(o.geometry));});explosion.dispose();
for(const action of model.actions){action.run();const box=model.frameBoundsForPart('system');assert.ok(box.containsPoint(t.headArrow.getWorldPosition(new THREE.Vector3())));assert.ok(box.containsPoint(t.liftArrow.getWorldPosition(new THREE.Vector3())));}
const geometryCounts=new Map(),materialCounts=new Map();t.guides.traverse(o=>{if(o.geometry&&!geometryCounts.has(o.geometry)){geometryCounts.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>geometryCounts.set(o.geometry,geometryCounts.get(o.geometry)+1));}if(o.material&&!materialCounts.has(o.material)){materialCounts.set(o.material,0);o.material.addEventListener('dispose',()=>materialCounts.set(o.material,materialCounts.get(o.material)+1));}});
model.dispose();model.dispose();assert.ok([...geometryCounts.values(),...materialCounts.values()].every(n=>n===1));parent.dispose();
console.log(JSON.stringify({passed:true,experiments:rows,states,guideResources:geometryCounts.size+materialCounts.size},null,2));

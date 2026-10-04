import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFrictionDriveToyModel, SLOW, BLUR, drawnTurns} from './friction-drive-toy-model.js';
import {MM, shafts, trainAngles, contactRatio, PRESSURE_ANGLE, AXLE, LAYOUT, FLOOR} from './friction-drive-toy-geometry.js';
import {TOY, TOY_DEFAULTS, TOY_DOMAINS, RATIOS, GEARS, toyPlan, toyAt} from './friction-drive-toy-physics.js';
import {frictionDriveToyLesson as lesson} from './friction-drive-toy-lesson.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';

const t=tally(),model=createFrictionDriveToyModel(),p=model.topology,near=(a,b,label,eps=1e-8)=>t.near(a,b,eps,label);
const state=()=>JSON.stringify(model.getState()),categories=['structure','running-gear','transmission','storage'];
assert.equal(model.parts.length,30);assert.equal(new Set(model.parts.map(p=>p.id)).size,30);assert.equal(model.controls.length,6);
assert.equal(model.initialPart,'machine');assert.equal(model.initialCutaway,true);
for(const id of categories)assert(model.parts.find(p=>p.id===id).object.userData.explosionCategory);
const range=key=>{const [lo,hi,step]=TOY_DOMAINS[key];return Array.from({length:Math.round((hi-lo)/step)+1},(_,i)=>lo+i*step);};
const controls=Object.keys(TOY_DOMAINS).flatMap(key=>range(key).map(value=>({...TOY_DEFAULTS,[key]:value})));
let poses=0,meshes=0,holes=0;
function pose(values,time){
  model.reset({settings:values,time});model.root.updateMatrixWorld(true);const s=model.getState(),expected=toyAt(toyPlan(values),time);poses++;
  near(s.clock,expected.clock,'prepared physical time');assert.equal(s.now.stage,expected.stage);
  near(p.machine.position.y,expected.height*1000*MM,'body lift');near(p.hand.position.y,p.machine.position.y,'hand remains on roof');
  const roof=new THREE.Box3().setFromObject(p.roof),palm=new THREE.Box3().setFromObject(p.palm);
  near(palm.min.y,roof.max.y,'palm touches roof without penetrating it');
  for(const finger of p.fingers){
    const b=new THREE.Box3().setFromObject(finger);
    t.ok(b.min.y>=roof.max.y-1e-8||b.min.z>=roof.max.z-1e-8,'fingers rest on roof or curl outside its edge');
  }
  for(const wheel of p.wheels){
    near(wheel.group.rotation.z,-(wheel.front?expected.frontTurned:expected.turned)/TOY.wheel,'independent axle rotation');
    near(wheel.group.getWorldPosition(new THREE.Vector3()).y/MM,15+expected.height*1000,'wheel center follows lift');
    wheel.tire.geometry.computeBoundingSphere();near(wheel.tire.geometry.parameters.radiusTop/MM,15,'30 mm tire');
  }
  for(const ratio of RATIOS){
    const set=p.sets[ratio];for(const node of set.nodes)assert.equal(node.visible,ratio===s.ratio,'only selected gear set');
    if(ratio!==s.ratio)continue;
    const a=trainAngles(ratio,s.wheel),first=GEARS[ratio][0][0]/GEARS[ratio][0][1];
    for(const [key,angle,factor]of [['axleGear',a.axleGear,1],['pinion',a.pinion,first],['second',a.second,first],['flywheelPinion',a.flywheel,ratio]]){
      const gear=set[key];near(gear.group.rotation.z,angle,'gear angle from shaft ratio');
      assert.equal(gear.blur.visible,drawnTurns(expected.u,factor)>BLUR);assert.equal(gear.sharp.visible,!gear.blur.visible);
      const center=gear.group.getWorldPosition(new THREE.Vector3());near(center.z/MM,key==='second'||key==='flywheelPinion'?-4.5:0,'gear axial plane');
    }
    near(set.flywheel.rotation.z,a.flywheel,'disk fixed to final pinion');near(set.flywheel.position.z/MM,4,'disk separated axially from first mesh');
    const length=mesh=>mesh.geometry.parameters.height/MM;
    near(length(set.fixedPinMesh),24,'middle pin spans both plates');near(length(set.flywheelShaftMesh),24,'flywheel shaft spans both bearings');
  }
  assert.equal(p.hand.visible,!s.released,'hand leaves at release');
  const pressing=!s.released&&(s.clock===0||s.now.kind==='pushing');
  near(p.press.userData.length/MM,pressing?values.press*2.5:0,'press arrow');
  p.seams.forEach((seam,i)=>{
    const raw=i*FLOOR.spacing-s.now.x*1000,wrapped=((raw+125)%250+250)%250-125;
    near(seam.position.x/MM,wrapped,'floor travel follows body');
  });
  const energy=[s.now.flywheel,s.now.motion,s.now.potential,s.now.energy.skid,s.now.energy.gears+s.now.energy.bearing,s.now.energy.rolling],total=energy.reduce((a,b)=>a+b,0);
  near(total,s.now.energy.hand,'drawn energy shares close ledger',1e-10);
  p.shares.forEach((bar,i)=>{if(energy[i]>1e-9)near(bar.scale.x,3.4*energy[i]/total,'energy bar exact share');});
}
for(const values of controls){
  const plan=toyPlan(values);
  for(const time of [0,plan.params.T*.75,plan.releaseAt.t+.02,plan.duration/2,plan.duration])pose(values,time);
}
for(const values of [{},{speed:2.5,pushes:6,press:0,gearing:2,floor:0},{speed:.5,pushes:1,press:20,gearing:0,floor:2}]){
  const v={...TOY_DEFAULTS,...values},plan=toyPlan(v);
  for(const phase of plan.phases)for(const f of [0,.5,1])pose(v,phase.t0+phase.d*f);
}
model.reset();model.root.updateMatrixWorld(true);
// Actual emitted tooth polygons must pass each other over a complete tooth period.
const inside=(point,poly)=>{let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
const polygon=gear=>{
  const shape=gear.sharp.geometry.parameters.shapes;
  return shape.getPoints().map(v=>{const p=gear.group.localToWorld(new THREE.Vector3(v.x,v.y,0));return [p.x,p.y];});
};
for(const [index,ratio]of RATIOS.entries()){
  model.reset({settings:{...TOY_DEFAULTS,gearing:index}});const set=p.sets[ratio],centers=shafts(ratio),pairs=GEARS[ratio];
  for(const [n,m]of pairs){t.ok(contactRatio(n,m)>1.2,'at least one gear tooth pair remains in contact');t.ok(m+1e-12>=2/Math.sin(PRESSURE_ANGLE)**2,'pinion avoids standard rack undercut');}
  near(Math.hypot(centers.middle[0]-AXLE.rear,centers.middle[1]-AXLE.height),pairs[0].reduce((a,b)=>a+b)*.25,'first pitch centers');
  near(centers.flywheel[0]-centers.middle[0],pairs[1].reduce((a,b)=>a+b)*.25,'second pitch centers');
  for(let frame=0;frame<96;frame++){
    const wheel=frame*2*Math.PI/(pairs[0][0]*96),a=trainAngles(ratio,wheel);
    for(const [key,angle]of [['axleGear',a.axleGear],['pinion',a.pinion],['second',a.second],['flywheelPinion',a.flywheel]])set[key].group.rotation.z=angle;
    model.root.updateMatrixWorld(true);
    for(const [a,b]of [[set.axleGear,set.pinion],[set.second,set.flywheelPinion]]){
      const A=polygon(a),B=polygon(b);t.ok(!A.some(v=>inside(v,B))&&!B.some(v=>inside(v,A)),'emitted tooth flanks do not interpenetrate');meshes++;
    }
    for(const gear of [set.axleGear,set.pinion,set.second,set.flywheelPinion]){
      const poly=polygon(gear);
      for(const post of set.posts){
        const center=post.getWorldPosition(new THREE.Vector3()),radius=post.geometry.parameters.radiusTop;
        t.ok(poly.every(v=>Math.hypot(v[0]-center.x,v[1]-center.y)>radius-1e-8),'teeth clear gearbox pillars');
      }
      for(const foot of set.feet){
        const b=new THREE.Box3().setFromObject(foot);
        t.ok(poly.every(v=>v[0]<=b.min.x||v[0]>=b.max.x||v[1]<=b.min.y||v[1]>=b.max.y),'teeth clear mounting feet');
      }
    }
  }
  model.reset({settings:{...TOY_DEFAULTS,gearing:index}});model.root.updateMatrixWorld(true);
  const hoodBottom=new THREE.Box3().setFromObject(p.hoodPanels[1]).min.y;
  for(const node of set.nodes){
    const bounds=new THREE.Box3().setFromObject(node);
    t.ok(bounds.max.y<=hoodBottom-MM+.000001,'complete gear train clears the hood underside by at least 1 mm');
    t.ok(bounds.min.x>-58*MM&&bounds.max.x<58*MM,'gear train stays inside the end panels');
    t.ok(bounds.min.z>=-23.5*MM&&bounds.max.z<=23.5*MM,'gear train stays between the side panels');
  }
  for(const plate of set.plates)for(const center of [centers.axle,centers.middle,centers.flywheel]){
    const ray=new THREE.Raycaster(new THREE.Vector3(center[0]*MM,center[1]*MM,.4),new THREE.Vector3(0,0,-1));
    t.ok(ray.intersectObject(plate,false).length===0,'shaft passes through a real plate bore');holes++;
    const solid=new THREE.Raycaster(new THREE.Vector3(center[0]*MM,(center[1]+3)*MM,.4),new THREE.Vector3(0,0,-1));
    t.ok(solid.intersectObject(plate,false).length>0,'material surrounds shaft bore');
  }
}
// The curved body sides contain actual wheel arches.
for(const panel of p.bodyPanels)for(const x of [-35,35]){
  const ray=new THREE.Raycaster(new THREE.Vector3(x*MM,15*MM,1),new THREE.Vector3(0,0,-1));
  t.ok(ray.intersectObject(panel,false).length===0,'body does not block wheel arch');holes++;
}
const expected=[
 s=>s.clock===0,
 s=>s.now.kind==='pushing'&&s.now.drive==='floor'&&s.now.skidding,
 s=>s.now.kind==='lifted'&&s.now.height>.019&&s.now.v<0&&s.now.u>0,
 s=>s.now.skidding&&s.now.u>s.now.frontRimSpeed,
 s=>s.grips&&s.values.press===8&&s.now.u>0,
 s=>s.now.skidding&&s.values.release===0&&s.now.v>0,
 s=>s.values.release===1&&s.now.v>1,
 s=>s.clock===0&&s.ratio===12,
 s=>s.complete&&s.ratio===24&&s.values.pushes===6,
 s=>s.complete&&s.ratio===6,
 s=>s.values.floor===0&&s.now.skidding,
 s=>s.complete&&s.values.floor===2,
 s=>s.complete&&s.values.speed===.5,
 s=>s.complete&&s.values.speed===2.5,
 s=>s.complete,
 s=>s.now.kind==='lifted'&&s.now.potential>0&&s.now.motion>0,
 s=>s.complete&&s.now.force===0&&s.now.drive==='none',
];
assert.equal(expected.length,lesson.tryIt.length);
for(const [i,trial]of lesson.tryIt.entries()){
  assert.deepEqual(trial.values,trial.initialState.settings);model.reset(trial.initialState);
  t.ok(expected[i](model.getState()),trial.title+' prepares exact named state');
  const before=state();model.animate(0);assert.equal(state(),before);
  for(const action of model.actions){action.run();assert.equal(state(),before,'inspection preserves full state');}
  checkFinite(model.root,t);
}
for(const values of controls){
  model.reset({settings:values,time:1e6});assert(model.playback.complete());const replay=model.replayState();model.reset(replay);
  assert.deepEqual(model.getState().values,values);near(model.getState().clock,0,'replay preserves settings and resets clock');
}
model.reset();model.advance(4);const one=model.getState();model.reset();for(let i=0;i<16;i++)model.advance(.25);assert.deepEqual(model.getState(),one,'frame partition independent');
model.advance(1);model.update({speed:2});near(model.getState().clock,0,'control change starts a new experiment');
for(const [width,height]of [[760,620],[360,620]]){
  const camera=new THREE.OrthographicCamera(-3,3,3,-3,.01,100);camera.position.set(.55,1.1,3);camera.lookAt(0,.4,0);camera.updateMatrixWorld();
  const before=state(),explosion=createPartExplosion(model,camera,width/height,{width,height});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(categories));
  t.ok(!explosion.items.some(p=>['floor','hand','charts','speed-chart','energy-chart'].includes(p.id)),'context remains outside machine inventory');
  const inverse=camera.quaternion.clone().invert(),bounds=item=>{
    const box=new THREE.Box3();for(const x of [item.bounds.min.x,item.bounds.max.x])for(const y of [item.bounds.min.y,item.bounds.max.y])for(const z of [item.bounds.min.z,item.bounds.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).add(item.group.position).applyQuaternion(inverse));return box;
  };
  for(let i=0;i<explosion.items.length;i++)for(let j=i+1;j<explosion.items.length;j++){
    const a=bounds(explosion.items[i]),b=bounds(explosion.items[j]);t.ok(a.max.x<=b.min.x||b.max.x<=a.min.x||a.max.y<=b.min.y||b.max.y<=a.min.y,'separated parts do not overlap');
  }
  explosion.dispose();assert.equal(state(),before,'separation preserves state');
}
const resources=checkDisposal(model,t);
console.log('PASS friction-drive toy model: '+t.count+' checks; '+poses+' poses; '+meshes+' mesh poses; '+holes+' through-opening rays; '+lesson.tryIt.length+' exact presets; '+model.actions.length+' state-preserving inspections; 2 separated layouts; '+resources+' resources');

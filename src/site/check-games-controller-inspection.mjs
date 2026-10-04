import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGamesControllerModel, MODULE, CONTROLLER, STICK_AT, leverDirection} from './games-controller-model.js';
import {PAD_DEFAULTS, PAD_DOMAINS, CLOCKS, gatePoint, padPlan, padAt} from './games-controller-physics.js';
import {gamesControllerLesson as lesson} from './games-controller-lessons.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';

const t=tally(),model=createGamesControllerModel(),p=model.topology,mm=p.MM;
const near=(a,b,label,tolerance=1e-9)=>t.near(a,b,tolerance,label);
const state=()=>JSON.stringify(model.getState()),bounds=o=>new THREE.Box3().setFromObject(o);
const expected=[
  s=>s.clock===CLOCKS.start&&!s.now.contact,
  s=>s.now.stick.s<0&&Math.abs(s.now.stick.speed)<1e-10,
  s=>s.values.release===2&&!s.now.stick.moving&&s.rest.creep===0,
  s=>!s.now.stick.moving&&s.now.shown.velocity[0]>0&&s.values.deadzone===20,
  s=>s.clock===0&&s.values.gate===0&&s.full.share>1&&s.full.mapped.normalized===1,
  s=>s.clock===0&&s.values.gate===1&&s.full.share>1.4&&s.full.mapped.normalized===1,
  s=>!s.now.stick.moving&&s.now.sample.volts[0]<1.65&&s.now.sample.codes[0]===463,
  s=>s.bits===8&&!s.now.stick.moving,
  s=>s.bits===12&&!s.now.stick.moving,
  s=>s.travel===1&&s.gap>0&&!s.now.contact&&!s.now.firmware&&s.now.buttonVolts===3.3,
  s=>s.values.debounce===1&&s.now.heard===2&&s.now.onScreen===2,
  s=>s.now.onScreen===1&&Math.abs(s.press.latency-.06166666666666666)<1e-12,
  s=>s.rate===1000&&s.latency.mean<padPlan().latency.mean&&s.press.photon===padPlan().press.photon,
  s=>s.values.debounce===8&&s.press.frame>padPlan().press.frame&&s.now.onScreen===1,
  s=>s.values.display===80&&s.now.heard===1&&s.now.onScreen===0&&s.now.motors[0].speed>0,
  s=>s.now.motors[0].frequency===80&&s.now.motors[1].frequency===150,
  s=>s.values.rumble===0&&s.now.motors.every(m=>m.speed===0&&m.magnitude===0),
  s=>s.clock===CLOCKS.duration&&s.now.firmware&&!s.now.stick.moving&&s.now.motors.every(m=>m.speed===0),
];
assert.equal(expected.length,lesson.tryIt.length);
for(const [i,trial]of lesson.tryIt.entries()){
  assert.deepEqual(trial.values,trial.initialState.settings);
  model.reset({time:.31,settings:{release:2,bits:0,deadzone:0,rumble:0}});
  model.reset(trial.initialState);model.update(trial.values);
  t.ok(expected[i](model.getState()),trial.title+' prepares its named state');
  near(model.getState().clock,CLOCKS.start+trial.initialState.time,'preset restores elapsed time');
  const before=state();model.animate(0);assert.equal(state(),before,'initial animation call preserves preset');
  for(const action of model.actions){action.run();assert.equal(state(),before,'inspection never rewinds or changes settings');}
  checkFinite(model.root,t);
}
const controls=Object.entries(PAD_DOMAINS).flatMap(([key,[lo,hi,step]])=>Array.from({length:Math.round((hi-lo)/step)+1},(_,i)=>({...PAD_DEFAULTS,[key]:lo+i*step})));
for(const values of controls){
  model.reset({settings:values,time:1e6});assert(model.playback.complete());
  model.reset(model.replayState());assert.deepEqual(model.getState().values,values);near(model.getState().clock,CLOCKS.start,'replay retains all selected settings');
}
model.reset();model.advance(5);const once=state();model.reset();for(let i=0;i<20;i++)model.advance(.25);assert.equal(state(),once,'frame partition does not change outcome');
model.update({bits:0});near(model.getState().clock,CLOCKS.start,'control change restarts');model.advance(1);const before=state();model.update({bits:0});assert.equal(state(),before,'unchanged control preserves time');
model.playback.step();near(model.getState().clock,.005,'step advances exactly 5 ms');

// Rendered solids, not only the ideal formulas: finite lid, hollow cavity,
// supported board, real potentiometer bores and eccentric-weight clearances.
model.reset();model.root.updateMatrixWorld(true);
near(bounds(p.bottomShell).max.y/mm,2,'shell floor is 2 mm thick',1e-5);
near(bounds(p.topShell).min.y/mm,30,'roof underside',1e-5);near(bounds(p.topShell).max.y/mm,32,'roof top',1e-5);
for(const support of p.boardSupports){near(bounds(support).min.y/mm,2,'board support rests on floor',1e-5);near(bounds(support).max.y,bounds(p.board).min.y,'support reaches board underside',1e-7);}
for(const point of [[-25,20,40],[-70,20,70],[25,20,70]]){
  const ray=new THREE.Raycaster(new THREE.Vector3(point[0]*mm,point[1]*mm,point[2]*mm),new THREE.Vector3(0,1,0));
  t.ok(ray.intersectObject(p.bottomShell,false).length===0&&ray.intersectObject(p.walls,false).length===0,'hollow interior has no solid fill');
  t.ok(ray.intersectObject(p.topShell,false).length>0,'a roof encloses the cavity');
}
for(const pot of [p.potA,p.potB]){
  const casing=pot.children.find(o=>o.geometry?.type==='ExtrudeGeometry'),origin=pot.localToWorld(new THREE.Vector3(0,0,5*mm));
  const direction=new THREE.Vector3(0,0,-1).transformDirection(pot.matrixWorld),ray=new THREE.Raycaster(origin,direction);
  t.ok(ray.intersectObject(casing,false).length===0,'potentiometer shaft passes through a real bore');
  ray.set(pot.localToWorld(new THREE.Vector3(2*mm,0,5*mm)),direction);t.ok(ray.intersectObject(casing,false).length>0,'solid housing surrounds the shaft');
}
for(const motor of p.feedback.motors){
  for(const bearing of motor.bearings){
    const center=bearing.getWorldPosition(new THREE.Vector3()),ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(2*mm,0,0)),new THREE.Vector3(-1,0,0));
    t.ok(ray.intersectObject(bearing,false).length===0,'motor shaft passes through end-bearing bore');
    ray.ray.origin.y+=2*mm;t.ok(ray.intersectObject(bearing,false).length>0,'bearing supports shaft');
  }
  t.ok(motor.spec.eccentricity-motor.spec.radius>.00075,'dense weight clears shaft throughout rotation');
  near(bounds(motor.casing).min.y/mm,2,'motor mounting feet meet shell floor',1e-5);
}

// At every offered release path, actual foot vertices meet the plate; closed
// spring end turns meet their supports and the carbon pill meets its pads.
let contactPoses=0;
for(const release of [0,1,2])for(const gate of [0,1])for(let i=0;i<=80;i++){
  model.reset({settings:{release,gate},time:.32*i/80});model.root.updateMatrixWorld(true);
  const vertices=p.foot.geometry.attributes.position;let lowest=Infinity;
  for(let k=0;k<vertices.count;k++)lowest=Math.min(lowest,p.joystick.worldToLocal(new THREE.Vector3().fromBufferAttribute(vertices,k).applyMatrix4(p.foot.matrixWorld)).y/mm);
  near(lowest,p.springPlate.position.y/mm+.25,'actual lever foot touches spring plate',.002);
  near(bounds(p.springGroup).max.y,bounds(p.springPlate).min.y,'spring end meets plate',1e-7);
  near(bounds(p.springGroup).min.y/mm,STICK_AT.y+MODULE.springBottom,'spring rests on base',1e-5);
  near(bounds(p.buttonStem).max.y,bounds(p.cap).min.y,'stem meets cap',1e-7);
  near(bounds(p.buttonStem).min.y,bounds(p.pill).max.y,'stem meets carbon pill',1e-7);
  if(model.getState().now.contact)near(bounds(p.pill).min.y,bounds(p.pads[0]).max.y,'pill touches pads',1e-7);
  contactPoses++;
}

// Both gate shapes, every 5 degrees around the rim: the complete cap mesh
// stays above the lid, even at the square gate's larger diagonal tilt.
const cap=p.lever.children.find(o=>o.geometry?.parameters?.radiusTop===MODULE.capRadius*mm),vertices=cap.geometry.attributes.position;
let capPoses=0,minimumCap=Infinity;
for(const gate of [0,1])for(let j=0;j<72;j++){
  p.lever.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),leverDirection(gatePoint(gate,j*Math.PI/36)));model.root.updateMatrixWorld(true);
  for(let k=0;k<vertices.count;k++){const point=new THREE.Vector3().fromBufferAttribute(vertices,k).applyMatrix4(cap.matrixWorld);minimumCap=Math.min(minimumCap,point.y/mm);t.ok(point.y>CONTROLLER.top*mm,'cap clears roof at every rim direction');}
  capPoses++;
}
model.reset();
assert.equal(new Set(model.parts.map(part=>part.id)).size,model.parts.length);
for(const id of ['timeline','map','adc','bounce','latency'])assert.equal(model.parts.find(part=>part.id===id).object.userData.inspectionOnly,id,'charts appear only in their own inspection');
assert(model.thumbnailOmit.includes(p.charts));

const categories=['body','stick-mechanism','buttons','electronics','feedback'];
for(const [width,height]of [[760,620],[360,620]]){
  const camera=new THREE.OrthographicCamera(-3,3,3,-3,.01,100);camera.position.set(.65,1.6,3);camera.lookAt(0,.4,0);camera.updateMatrixWorld();
  const before=state(),explosion=createPartExplosion(model,camera,width/height,{width,height});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(categories));
  t.ok(!explosion.items.some(item=>['cable','console','screen','timeline','map','adc','bounce','latency'].includes(item.id)),'context and charts stay out of physical parts inventory');
  const inverse=camera.quaternion.clone().invert(),rectangle=item=>{
    const b=new THREE.Box3();for(const x of [item.bounds.min.x,item.bounds.max.x])for(const y of [item.bounds.min.y,item.bounds.max.y])for(const z of [item.bounds.min.z,item.bounds.max.z])b.expandByPoint(new THREE.Vector3(x,y,z).add(item.group.position).applyQuaternion(inverse));return b;
  };
  for(let i=0;i<explosion.items.length;i++)for(let j=i+1;j<explosion.items.length;j++){
    const a=rectangle(explosion.items[i]),b=rectangle(explosion.items[j]);t.ok(a.max.x<=b.min.x||b.max.x<=a.min.x||a.max.y<=b.min.y||b.max.y<=a.min.y,'separated units do not overlap');
  }
  explosion.dispose();assert.equal(state(),before,'separation preserves experiment state');
}
const resources=checkDisposal(model,t);
console.log(`PASS controller inspection: ${t.count} checks, ${lesson.tryIt.length} exact presets, ${model.actions.length} preserving actions, ${contactPoses} contact poses, ${capPoses} cap-clearance poses, minimum cap height ${minimumCap.toFixed(3)} mm, ${resources} resources released once.`);

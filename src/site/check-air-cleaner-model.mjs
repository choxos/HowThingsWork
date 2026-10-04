import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAirCleanerModel} from './air-cleaner-model.js';
import {AIR_CLEANER_DEFAULTS as D, PRECIPITATOR as P, FILTER, ROOM, sampleAirCleaner} from './air-cleaner-physics.js';
import {MM, point, CELL, PARTICLES, PANEL, PLEAT_DEPTH, particleRoute} from './air-cleaner-geometry.js';
import {airCleanerLesson as lesson, electrostaticPrecipitatorLesson, ionizerLesson} from './air-cleaner-lessons.js';
import {tally,checkFinite,checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
const t=tally(),m=createAirCleanerModel(),p=m.topology;
const reset=(values={},time=0)=>{const settings={...D,...values};m.reset({settings,time});m.update(settings);m.root.updateMatrixWorld(true);return m.getState();};
const core=s=>[s.clock,s.values,s.neutral,s.charged,s.collected,s.deposited,s.ventilated,s.cohort];
const vec=a=>new THREE.Vector3(...point(a));
const world=a=>m.root.localToWorld(vec(a));
let rays=0,poses=0;
function ray(a,b,objects,expected,label){const from=world(a),delta=world(b).sub(from);const hits=new THREE.Raycaster(from,delta.clone().normalize(),1e-8,delta.length()-1e-8).intersectObjects(objects,true);t.ok(Boolean(hits.length)===expected,`${label}: ${hits[0]?.object.parent?.name??'clear'}`);rays++;}
reset();
// Match the viewer's visible-surface picking rules. A cutaway seal must not
// steal a pointer hit from the plate the learner can see behind it.
for(const index of[20,21]){
  const y=80+.4+6.8*index,origin=vec([-50,y,300]);
  const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1)).intersectObject(m.root,true).filter(hit=>{
    for(let o=hit.object;o;o=o.parent)if(!o.visible||o.userData.inspectionOnly)return false;
    return !(hit.object.material.transparent&&hit.object.material.opacity===0);
  });
  let owner;for(let o=hits[0]?.object;o&&!owner;o=o.parent)owner=m.parts.find(part=>part.object===o)?.id;
  t.ok(owner===(index%2?'positive-plates':'grounded-plates'),'visible plate receives direct pointer ownership through cutaway');
}
// Geometry, not constants alone, must provide the modeled open area.
const plateBounds=p.plates.map(plate=>{plate.geometry.computeBoundingBox();return plate.geometry.boundingBox.clone().translate(plate.position);});
let area=0;
for(let i=1;i<plateBounds.length;i++) {const gap=(plateBounds[i].min.y-plateBounds[i-1].max.y)/MM,width=plateBounds[i].getSize(new THREE.Vector3()).z/MM;t.near(gap,6,3e-5,'actual clear gap');area+=gap*width*1e-6;}
t.near(area,P.open,3e-8,'actual clear flow area');t.near(plateBounds.length,45,0,'45 plates');
p.hub.geometry.computeBoundingBox();t.near(p.hub.geometry.boundingBox.getSize(new THREE.Vector3()).x/MM,54,1e-5,'54 mm impeller hub matches assigned flow obstruction');
for(const b of plateBounds)t.near(b.getSize(new THREE.Vector3()).x/MM,100,3e-5,'actual collection length');
const g=p.pleats.geometry,pos=g.attributes.position,index=g.index,a=new THREE.Vector3(),b=a.clone(),c=a.clone();let matArea=0;
for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(pos,index.getX(i));b.fromBufferAttribute(pos,index.getX(i+1));c.fromBufferAttribute(pos,index.getX(i+2));matArea+=b.sub(a).cross(c.sub(a)).length()/2/MM**2*1e-6;}
t.near(matArea,FILTER.area,3e-6,'actual folded mat area');
// Rays through openings and their neighboring walls detect capped ducts/sheets.
for(const angle of [.23,.8,1.5,2.5,4,5.8]){const y=230+80*Math.cos(angle),z=80*Math.sin(angle);ray([171,y,z],[233,y,z],[p.shroud],false,'fan bore is open');ray([180,230,0],[180,230+120*Math.cos(angle),120*Math.sin(angle)],[p.shroud],true,'fan shroud has a real wall');}
for(const y of [98.75,148.75,248.75,373.75])for(const z of[-87.5,-12.5,87.5]){ray([-210,y,z],[-190,y,z],[p.prefilter],false,'coarse screen opening');ray([15,y,z],[45,y,z],[p.carbon],false,'porous carbon opening');}
ray([-210,130,0],[-190,130,0],[p.prefilter],true,'screen mesh has strands');ray([15,130,0],[45,130,0],[p.carbon],true,'carbon support is not a transparent solid panel');
// Per-marker paths are checked against actual meshes and independently solved
// drift distances. Captured endpoint belongs to a grounded plate, never gold.
for(const values of [{},{size:0},{size:6},{fan:1},{voltage:0},{mode:0},{mode:0,size:0},{mode:0,size:6},{mode:2}]){
  const s=reset(values,3600);
  for(let i=0;i<PARTICLES;i++){
    const q=particleRoute(i,s),end=q.points.at(-1);
    for(let k=1;k<q.points.length;k++){
      const previous=q.points[k-1],next=q.points[k];
      const obstacles=[p.prefilter,p.carbon,p.shroud,p.motorBody,p.outlet,p.reducer];
      if(s.values.mode===1)obstacles.push(...p.plates,p.wires);
      // Stop just short of a collecting endpoint to test free approach.
      const stop=q.captured&&k===q.points.length-1?previous.map((v,j)=>v+(next[j]-v)*.9999):next;
      ray(previous,stop,obstacles,false,`particle route clears solid walls ${JSON.stringify(values)} marker ${i} segment ${k}: ${previous} to ${stop}`);
    }
    if(q.captured&&s.values.mode===1){
      const groundIndex=q.gap%2===0?q.gap:q.gap+1;
      t.ok(groundIndex%2===0,'positive particle targets grounded parity');
      const face=q.gap%2===0?plateBounds[groundIndex].max.y:plateBounds[groundIndex].min.y;
      t.near(end[1]*MM,face,2e-8,'retained marker meets actual plate face');
      const elementary=1.602176634e-19,mu=1.81e-5,d=s.d,slip=1+66e-9/d*(2.34+1.05*Math.exp(-.39*d/66e-9));
      const velocity=q.n*elementary*500000*slip/(3*Math.PI*mu*d),expected=(Math.abs(q.target-q.y)/1000)/velocity*s.U;
      t.near((end[0]-CELL.start)/1000,expected,2e-14,'plate hit position from independent drift');
    }
    if(q.captured&&s.values.mode===0){
      const hit=q.filterHit,from=[PANEL.front-1,hit[1],hit[2]],to=[PANEL.front+PLEAT_DEPTH+1,hit[1],hit[2]],origin=world(from),delta=world(to).sub(origin),hits=new THREE.Raycaster(origin,delta.normalize()).intersectObject(p.pleats);
      t.ok(hits.length>0,'fiber trajectory meets actual pleated surface');t.near(hits[0].point.distanceTo(world(hit)),0,3e-6,'capture uses true pleat intersection within Float32 mesh precision');
    }
    if(!q.captured)t.ok(end[0]>235,'uncaptured particle leaves cabinet');
  }
}
for(let mode=0;mode<3;mode++)for(let size=0;size<7;size++)for(let fan=0;fan<4;fan++)for(let voltage=0;voltage<2;voltage++)for(const room of[30,60,90]){
  const values={mode,size,fan,voltage,room};
  for(const clock of[0,300,1200,3600]){
    const s=reset(values,clock),ref=sampleAirCleaner(values,clock);poses++;
    for(const key of['remaining','charged','collected','deposited','ventilated','efficiency'])t.near(s[key],ref[key],1e-14,'rendered state uses physical account');
    t.near(s.retained+s.returned+s.inTransit,32,0,'finite cohort account');
    t.ok(s.cohort.every(q=>q.travel===null||Number.isFinite(q.travel)),'no-hit travel is explicit null, never Infinity');
    assert.equal(p.filter.visible,mode===0);assert.equal(p.collector.visible,mode===1);assert.equal(p.needle.visible,mode===2);assert.equal(p.flow.visible,fan>0);
    t.near(p.impeller.rotation.x,-clock/60*s.hourly/60*2*Math.PI,1e-12,'fan stops when flow stops');
    for(let i=0;i<32;i++){
      const q=s.cohort[i],dot=p.dots[i];t.near(dot.position.distanceTo(vec(q.position)),0,1e-12,'marker position matches current cohort');assert.equal(dot.visible,q.visible);
      if(q.status==='captured'){t.ok(q.captured,'only captured marker retained');t.near(q.progress,1,0,'retained marker completed passage');}
      if(fan===0)t.near(q.progress,0,0,'fan off freezes upstream cohort');
    }
    for(const index of[0,20,60]){const ref=sampleAirCleaner(values,index*60);t.near(p.roomLine.geometry.attributes.position.getY(index)/MM,-95+190*ref.remaining,2e-5,'room chart ordinate');t.near(p.bareLine.geometry.attributes.position.getY(index)/MM,-95+190*ref.withoutCleaner,2e-5,'baseline chart ordinate');}
    t.near(p.cursor.geometry.attributes.position.getX(0)/MM,-140+clock/3600*280,2e-5,'chart time cursor');
  }
}
for(const mode of[0,1,2]){reset({mode},2400);const positions=p.dots.map(d=>d.position.toArray());m.advance(10);assert.deepEqual(p.dots.map(d=>d.position.toArray()),positions,'finished markers cannot respawn');checkFinite(m.root,t);}
let trials=0;
for(const l of[lesson,electrostaticPrecipitatorLesson,ionizerLesson])for(const trial of l.tryIt)for(const prior of[{mode:0,fan:0},{mode:2,size:6,voltage:0,room:90}]){
  reset(prior,3500);m.reset(trial.initialState);m.update(trial.values);const s=m.getState();assert.equal(s.clock,trial.initialState.time);assert.deepEqual(s.values,trial.values);t.ok(m.parts.some(p=>p.id===trial.part),'valid trial target');trials++;
}
t.near(reset({},1200).remaining,.11678354436949636,1e-12,'default twenty-minute result');t.near(reset({mode:0},1200).efficiency,.3407447459562568,1e-12,'34 percent filter lesson answer');t.near(reset({size:0}).efficiency,.1180500784809761,1e-12,'12 percent tiny-particle answer');
t.ok(reset({fan:1},1200).remaining>reset({},1200).remaining,'slower flow leaves more in room despite better retention');
t.ok(reset({room:90},1200).remaining>reset({},1200).remaining,'larger room clears more slowly');
for(const mode of[0,1,2])for(const action of m.actions){reset({mode},1200);const before=core(m.getState());action.run();assert.deepEqual(core(m.getState()),before,'inspection preserves time and account');t.ok(m.parts.some(p=>p.id===action.part),'valid action target');}
reset({},1200);m.update({fan:1});assert.equal(m.getState().clock,0);assert.equal(m.getState().remaining,1);
reset();m.playback.step();assert.equal(m.getState().clock,300);m.advance(1);assert.equal(m.getState().clock,360);m.advance(100);assert.equal(m.playback.complete(),true);const final=core(m.getState());m.advance(1);assert.deepEqual(core(m.getState()),final);
const replay=m.replayState();m.reset(replay);m.update(replay.settings);assert.equal(m.getState().clock,0);assert.equal(m.getState().remaining,1);
for(const time of[-1,3601,NaN,Infinity])assert.throws(()=>m.reset({time}),RangeError);
t.ok(m.controls.find(c=>c.key==='mode').primary,'method selector appears immediately');
for(const chart of[p.roomChart,p.sizeChart])t.ok(chart.userData.inspectionOnly&&chart.userData.explosionExcluded,'charts excluded from physical inventory');
let layouts=0;const counts=[];
for(const mode of[0,1,2])for(const aspect of[1,1.24]){
  const model=createAirCleanerModel();model.reset({settings:{...D,mode},time:1200});model.update({...D,mode});const before=JSON.stringify(core(model.getState())),{camera}=frameModel(model,aspect),explosion=createPartExplosion(model,camera,aspect);explosion.update(1);
  const inverse=camera.quaternion.clone().invert(),boxes=explosion.items.map(unit=>{const b=new THREE.Box3();for(const x of[unit.bounds.min.x,unit.bounds.max.x])for(const y of[unit.bounds.min.y,unit.bounds.max.y])for(const z of[unit.bounds.min.z,unit.bounds.max.z])b.expandByPoint(new THREE.Vector3(x,y,z).add(unit.group.position).applyQuaternion(inverse));return b;});
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)t.ok(boxes[i].max.x<=boxes[j].min.x||boxes[j].max.x<=boxes[i].min.x||boxes[i].max.y<=boxes[j].min.y||boxes[j].max.y<=boxes[i].min.y,'separated groups do not overlap');
  counts.push(boxes.length);explosion.update(0);explosion.dispose();assert.equal(JSON.stringify(core(model.getState())),before);model.dispose();layouts++;
}
const resources=checkDisposal(m,t);
console.log(`PASS air-cleaner model: ${t.count} checks; ${poses} poses; ${rays} passage rays; ${trials} preset checkpoints; ${layouts} separated layouts (${counts.join(',')} parts); ${resources} resources`);

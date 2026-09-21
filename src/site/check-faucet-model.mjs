import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {createFaucetModel} from './faucet-model.js';
import {faucetConstants as C, FAUCET_DEFAULTS as D, faucetFlow, faucetPlan, sampleFaucet} from './faucet-physics.js';
import {faucetLesson} from './faucet-lesson.js';
let checks=0,settings=0,geometryStates=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const near=(actual,expected,tolerance=1e-9,message='quantity')=>{ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${message}: ${actual} vs ${expected}`);};
assert.equal(C.pitch,.0015);assert.equal(C.seatDiameter,.012);assert.equal(C.pipeDiameter,.015);
const pipeArea=Math.PI*.015**2/4,bore=Math.PI*.012**2/4;
const oracle=v=>{const gap=Math.PI*.012*v.turns*.0015,leak=[0,.0007,.007][v.washer]*1e-6,A=Math.max(leak,Math.min(gap,bore));return A?Math.sqrt(v.pressure*1e5/(500*(1/(.62*A)**2+(200+(v.aerator?60:0))/pipeArea**2+1/bore**2))):0;};
for(let i=0;i<=16;i++)for(let j=1;j<=12;j++)for(const washer of [0,1,2])for(const aerator of [0,1]){
 const v={...D,turns:i/4,pressure:j/2,washer,aerator},s=faucetFlow(v);settings++;
 near(s.lift,i*.0015/4,1e-12,'literal screw pitch');near(s.flow,oracle(v),1e-14,'independent SI flow');
 near(s.pipeSpeed*pipeArea,s.flow,1e-14,'pipe continuity');near(s.spoutSpeed*bore,s.flow,1e-14,'spout continuity');
 near(s.seatDrop+s.pipeDrop+s.aeratorDrop+s.outletHead,v.pressure,1e-10,'pressure energy budget');
 near(s.fullSurge,1000*1200*s.pipeSpeed/1e5,1e-10,'pipe-based Joukowsky reference');
 if(s.flow)near(s.fillTime*s.flow*1000,10,1e-10,'ten-liter forecast');else ok(s.fillTime===null&&s.sealed,'sound seal does not fill');
 for(const closing of [.05,1,2]){const final=sampleFaucet({...v,closing},100);ok(final.complete&&final.filled<10&&final.filled>=0,'finite trial within bucket capacity');near(final.turns,0,1e-12,'trial closes handle');near(final.flow,oracle({...v,turns:0}),1e-14,'final leak remains physical');}
}
for(const turns of [.25,1,2,4]){
 near(faucetFlow({...D,turns,pressure:2}).flow/faucetFlow({...D,turns,pressure:.5}).flow,2,1e-10,'square-root pressure response');
 ok(faucetFlow({...D,turns,aerator:0}).flow>faucetFlow({...D,turns}).flow,'screen resistance changes flow');
}
near(faucetFlow({...D,turns:2}).flow,faucetFlow({...D,turns:4}).flow,1e-14,'bore cap');
const m=createFaucetModel(),t=m.topology,MM=t.MM;
ok(!m.covers.includes(t.spoutShell)&&m.covers.includes(t.spoutFront),'cutaway removes only the front spout wall');
for(const [mesh,sign]of [[t.spoutShell,-1],[t.spoutFront,1]]){const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++)ok(sign*positions.getZ(i)>=-1e-7,'longitudinal spout halves remain on opposite sides');}

ok(m.controls.length===5&&m.actions.length===9&&m.parts.length>=10,'complete lesson controls and inspection');
const expectedFlow=[12.499,8.199,12.934,12.934,22.403,14.049,12.499,12.499,.005208,.0005208,0,6.249,12.499];
const expectedCollected=[4.3269,2.8098,4.4983,4.5127,7.8162,4.8584,4.4875,4.1743,.001736,.0001736,0,2.1635,4.3271];
const observations=[];
for(const [index,preset]of faucetLesson.tryIt.entries()){
 const v=preset.values;assert.deepEqual(Object.keys(v).sort(),Object.keys(D).sort());ok(preset.reset&&preset.part==='system'&&preset.cutaway===true,'complete initial preset');
 const initial=sampleFaucet(v,0),plan=faucetPlan(v);
 near(initial.flow*60000,expectedFlow[index],index===8?5e-7:index===9?5e-8:.00051,'published starting-flow claim');
 const N=20000;let sum=0;
 for(let k=0;k<=N;k++){const flow=oracle({...v,turns:v.turns*(1-k/N)});sum+=flow*(k===0||k===N?1:k%2?4:2);}
 const closure=plan.closing*sum/(3*N),expected=20*oracle(v)+closure+(v.turns?2*oracle({...v,turns:0}):0);
 const end=sampleFaucet(v,100);
 near(end.collected,expected,2e-11,'independent closure quadrature');near(end.closureCollected,closure*1e6,2e-5,'closure volume uses milliliters');near(end.filled,expectedCollected[index],index===8?5e-7:index===9?5e-8:.000051,'published collected-volume claim');
 near(end.bucketLevel*Math.PI*.125**2,end.collected,1e-12,'bucket volume and level');
 for(const time of [0,10,20,20+plan.closing/2,plan.duration]){
  m.reset();m.update(v);m.advance(time);const s=m.getState();geometryStates++;
  near(s.collected,sampleFaucet(v,time).collected,1e-12,'model uses sampled collection');
  near(t.spindle.position.y,s.lift*t.M,1e-12,'drawn lift has no exaggeration');near(t.spindle.rotation.y,s.turns*2*Math.PI,1e-10,'opening rotation matches helix');
  m.root.updateMatrixWorld(true);
  const bottom=t.washerMesh.localToWorld(new THREE.Vector3(0,-1.5*MM,0)),seat=t.seat.localToWorld(new THREE.Vector3(0,94*MM,0));near(bottom.distanceTo(seat),s.lift*t.M,2e-7,'washer-to-seat gap');
  const inverse=m.root.matrixWorld.clone().invert(),position=t.maleThread.geometry.attributes.position;
  for(let n=0;n<position.count;n++){
   const p=new THREE.Vector3().fromBufferAttribute(position,n).applyMatrix4(t.maleThread.matrixWorld).applyMatrix4(inverse).divideScalar(MM);
   if(p.y<138||p.y>162)continue;
   const phase=(p.y-124-.75+1.5*Math.atan2(p.z,p.x)/(2*Math.PI))/1.5;
   const distance=Math.abs(phase-Math.round(phase))*1.5;
   const femaleRadius=4.45-.8*Math.max(0,1-distance/.5);
   ok(Math.hypot(p.x,p.z)<=femaleRadius-.1499,'male thread clears mating female profile');
  }
  if(t.jet.visible){near(t.jet.position.x,1.6,1e-12,'jet aligned with outlet');const positions=t.jet.geometry.attributes.position;for(let n=0;n<positions.count;n+=11){const y=positions.getY(n)/MM,radius=Math.hypot(positions.getX(n),positions.getZ(n))/t.M,velocity=Math.sqrt(s.spoutSpeed**2+2*9.81*((v.aerator?70:76)-y)/1000);near(Math.PI*radius*radius*velocity,s.flow,2e-10,'rendered jet conserves flow under gravity');}}
  near(t.water.position.y-t.water.scale.y*MM/2,t.BUCKET.bottom*MM,1e-9,'water remains on bucket floor');
  ok(t.aerator.visible===Boolean(v.aerator),'aerator control changes assembly');
  ok(t.spout.visible&&t.spoutShell.visible,'solid spout persists even when flow stops');
  ok(s.readings.every(r=>!/(?:NaN|Infinity|undefined)/.test(r.value)),'finite visible readings');
 }
 m.reset();m.update(v);for(const dt of [.137,.023,.4,1.7,.003])m.advance(dt);const time=m.getState().elapsed;near(m.getState().collected,sampleFaucet(v,time).collected,1e-12,'frame partition independence');
 m.advance(100);near(m.getState().elapsed,plan.duration,1e-12,'exact completion time');m.advance(1);near(m.getState().collected,end.collected,1e-12,'completed trial holds');
 const prior=m.getState();m.update({...v});near(m.getState().elapsed,prior.elapsed,1e-12,'no-op controls preserve result');
 for(const action of m.actions.filter(a=>a.group==='Look closer')){action.run();near(m.getState().elapsed,prior.elapsed,1e-12,'inspection preserves clock');}
 observations.push({title:preset.title,initialFlow:initial.litersPerMinute,collectedLiters:end.filled,closingMilliliters:end.closureCollected,duration:end.duration});
}
m.reset();m.update({turns:0});m.advance(100);ok(m.getState().readings[0].value==='Sealed · no water collected'&&m.getState().filled===0,'zero-flow regression');
m.reset();m.update({turns:0,washer:2});m.advance(100);ok(m.getState().elapsed===20&&m.getState().filled>0&&m.getState().flow>0,'finite leak trial preserves continuing leak');
const saved=m.getState();for(const dt of [NaN,Infinity,-1,0])m.advance(dt);near(m.getState().elapsed,saved.elapsed,0,'invalid advances ignored');
m.reset();m.update({turns:20,pressure:-10,washer:1.4,aerator:NaN,closing:99});assert.deepEqual(m.getState().values,{turns:4,pressure:.5,washer:0,aerator:1,closing:2});checks++;
m.reset();assert.deepEqual(m.getState().values,D);checks++;m.playback.step();near(m.getState().elapsed,.1,1e-12,'single step');
m.update({pressure:3});near(m.getState().elapsed,0,0,'changed control restarts observation');
m.reset();m.update({turns:.25});m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);
const openingMark=t.handleMark.getWorldPosition(new THREE.Vector3());near(openingMark.x,0,1e-10,'quarter turn points off positive X');near(openingMark.z,-45*MM,1e-10,'opening is counterclockwise from above');

const ray=new THREE.Raycaster(new THREE.Vector3(0,110*MM,0),new THREE.Vector3(0,-1,0));ok(ray.intersectObject(t.seatMesh,false).length===0,'seat center is an open bore');ray.ray.origin.x=9*MM;ok(ray.intersectObject(t.seatMesh,false).length>0,'seat ring supports washer');
const crest=t.maleThread.geometry.attributes.position;for(let i=1;i+64*3<crest.count;i+=64*3)near((crest.getY(i+64*3)-crest.getY(i))/MM,1.5,2e-5,'drawn thread lead');
near(Math.PI*.125**2*t.BUCKET.height/1000*1000,10,1e-10,'actual bucket capacity');
near(m.getState().idealForceRatio,2*Math.PI*.045/.0015,1e-10,'lossless screw work balance');
const geometries=new Set(),materials=new Set(),textures=new Set();m.root.traverse(o=>{if(o.geometry){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))ok(Array.from(a.array).every(Number.isFinite),'finite geometry attributes');}if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material]){materials.add(mat);if(mat.gradientMap)textures.add(mat.gradientMap);}});
const resources=[...geometries,...materials,...textures];let disposals=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposals++);m.dispose();m.dispose();near(disposals,resources.length,0,'owned resources released once');
const report={result:'PASS',settings,trials:observations.length,geometryStates,checks,resources:resources.length,observations};
if(process.env.EVIDENCE_FILE)writeFileSync(process.env.EVIDENCE_FILE,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,observations:undefined}));

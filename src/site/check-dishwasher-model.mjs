import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {sampleWasher,washerPlan,armAt,stageTemperature,BEARINGS,WASHER,WASHER_DEFAULTS as D,WASHER_DOMAINS} from './dishwasher-physics.js';
import {createDishwasherModel,armNozzles,jetFlight} from './dishwasher-model.js';
import {dishwasherLesson as lesson,rotatingSprayArmLesson} from './dishwasher-lessons.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkTrialNumbers,checkControlsMove,checkFinite,checkDisposal,checkRefusals} from './model-check-kit.mjs';
const t=tally(),TAU=2*Math.PI,dir=process.env.EVIDENCE_DIR||'documentation/audit/evidence/dishwasher-20260921';await mkdir(dir,{recursive:true});
// Independent flow-domain root (the production code solves pressure).
function balance(v,w){
 const ports=[[.19,Math.PI*(v.nozzle/2000)**2,Math.sin(v.tilt*Math.PI/180)],[.19,Math.PI*(v.nozzle/2000)**2,Math.sin(v.tilt*Math.PI/180)],...[.06,.06,.12,.12,.17,.17].map(r=>[r,Math.PI*.0008**2,0])];
 let lo=0,hi=40/60000;
 for(let n=0;n<55;n++){const q=(lo+hi)/2,p=v.pump*1000*(1-(q/(40/60000))**2),wanted=ports.reduce((s,[r,a])=>s+a*Math.sqrt(2*p/1000+w*w*r*r),0);if(q>wanted)hi=q;else lo=q;}
 const flow=(lo+hi)/2,pressure=v.pump*1000*(1-(flow/(40/60000))**2);
 const jets=ports.map(([radius,area,share])=>{const speed=Math.sqrt(2*pressure/1000+w*w*radius*radius);return{radius,flow:area*speed,speed,back:speed*share-w*radius};});
 return{flow,pressure,torque:jets.reduce((s,n)=>s+1000*n.flow*n.radius*n.back,0)};
}
let configurations=0;
for(let pump=20;pump<=60;pump+=5)for(let tilt=0;tilt<=60;tilt+=5)for(const nozzle of [1.5,2,2.5,3])for(const bearing of [0,1,2]){
 const v={...D,pump,tilt,nozzle,bearing},p=washerPlan(v),ref=balance(v,p.speed),friction=BEARINGS[bearing].torque;
 t.near(p.run.flow,ref.flow,1e-14,'Independent flow-domain operating point');t.near(p.run.pressure,ref.pressure,1e-6,'Independent pressure');t.near(p.run.jetTorque,ref.torque,1e-11,'Angular momentum of all eight jets');
 const area=2*Math.PI*(nozzle/2000)**2+6*Math.PI*.0008**2,p0=pump*1000;
 t.near(p.rest.pressure,p0/(1+2*p0/1000*(area/(40/60000))**2),1e-6,'Closed-form stationary operating pressure');
 t.ok(p.stuck===(balance(v,0).torque<=friction),'Static bearing threshold');
 if(!p.stuck){t.near(ref.torque-friction-.002*p.speed,0,1e-10,'Steady torque balance');t.ok(balance(v,p.speed*.99).torque-friction-.002*p.speed*.99>0,'Restoring acceleration below steady speed');}
 for(const time of [0,.125,1,4,8,16,100]){const s=sampleWasher(v,time);t.near(s.waterUsed-s.drained,s.stored,2e-14,'Fresh water minus drain equals stored volume');t.ok(s.stored>=-1e-12&&s.stored<=3+1e-12,'Bounded inventory');t.ok(s.armSpeed>=0&&s.armSpeed<=p.speed+1e-12,'Bounded angular speed');t.ok([s.temperature,s.energyUsed,s.armAngle,s.armSpeed].every(Number.isFinite),'Finite cycle state');if(p.stuck)t.near(s.armAngle,0,0,'Blocked or zero-torque arm never turns');}
 let previousAngle=0;for(const point of p.motion){t.ok(point.angle>=previousAngle-1e-12,'No angle reset at pump transitions');previousAngle=point.angle;}
 configurations++;
}
// Independent angular impulse quadrature for 90% startup.
let quadratures=0;
for(const patch of [{},{pump:20},{pump:60},{nozzle:3},{bearing:1},{tilt:15},{tilt:60}]){
 const v={...D,...patch},p=washerPlan(v),n=1024,h=.9*p.speed/n;
 const f=w=>.0027/(balance(v,w).torque-BEARINGS[v.bearing].torque-.002*w);
 let integral=f(0)+f(.9*p.speed);for(let i=1;i<n;i++)integral+=(i%2?4:2)*f(i*h);
 t.near(p.spinUp,integral*h/3,.0001,'Startup from torque quadrature, independent of time integration');quadratures++;
}
// Integrate the first law independently. Fill carries inlet enthalpy; draining
// removes water at the mixed temperature. The ceramic load stays in the tub.
let thermalCases=0;
for(let temperature=45;temperature<=70;temperature+=5){
 const plan=washerPlan({temperature});let T=20,lossEnergy=0,inletEnergy=0,outletEnergy=0,heaterEnergy=0;
 for(const stage of plan.stages){
  t.near(stage.initialTemperature,T,2e-7,'Continuous thermal state across stages');
  const n=Math.ceil(stage.duration/.1),dt=stage.duration/n;
  const rate=(time,temp)=>{const fill=stage.name==='fill'?4/60:0,drain=stage.name==='drain'?3/60:0,mass=stage.name==='fill'?fill*time:stage.name==='drain'?3-drain*time:stage.name==='dry'?0:3,C=2.4*840+mass*4186,P=stage.name==='heat'?1800:stage.hold?8*(stage.hold-20):0;return{dT:(P-8*(temp-20)+fill*4186*(15-temp))/C,loss:8*(temp-20),incoming:fill*4186*(15-20),outgoing:drain*4186*(temp-20),P};};
  for(let i=0;i<n;i++){
   const time=i*dt,a=rate(time,T),b=rate(time+dt/2,T+dt*a.dT/2),c=rate(time+dt/2,T+dt*b.dT/2),d=rate(time+dt,T+dt*c.dT);
   const integrate=key=>dt*(a[key]+2*b[key]+2*c[key]+d[key])/6;
   T+=integrate('dT');lossEnergy+=integrate('loss');inletEnergy+=integrate('incoming');outletEnergy+=integrate('outgoing');heaterEnergy+=integrate('P');
   if(i===Math.floor(n/2))t.near(stageTemperature(stage,(i+1)*dt),T,2e-7,'Midstage temperature from independent first-law integration');
  }
  t.near(stage.endTemperature,T,2e-7,'End temperature from independent integration');
  const s=sampleWasher({temperature},(stage.start+stage.duration)/180),stored=s.stored;
  t.near((2016+stored*4186)*(T-20),inletEnergy+heaterEnergy-lossEnergy-outletEnergy,.002,'Thermal energy accounting closes through filling and draining');
 }
 const end=sampleWasher({temperature},100);t.near(end.energyUsed,heaterEnergy+plan.pumpPower*plan.pumpTime,1e-5,'Metered energy matches heater and steady pump');t.near(end.waterUsed,6,1e-12,'Two complete fills');t.near(end.drained,6,1e-12,'Two complete drains');t.ok(end.temperature>20,'Load retains some heat after drying interval');thermalCases++;
}
const defaults=washerPlan();t.near(defaults.stages[0].duration,45,0,'Fill is 45 seconds, not 0.045');t.near(sampleWasher().stored,0,0,'Ready sump is empty');
for(const stage of defaults.stages.slice(1)){
 const before=sampleWasher({},(stage.start-1e-8)/180),after=sampleWasher({},(stage.start+1e-8)/180);
 t.near(after.armAngle,before.armAngle,2e-7,'Continuous angle at every stage boundary');t.near(after.armSpeed,before.armSpeed,2e-7,'Continuous speed at every stage boundary');t.near(after.temperature,before.temperature,2e-7,'Continuous temperature at every stage boundary');
}
checkRefusals(sampleWasher,WASHER_DOMAINS,t);

const m=createDishwasherModel(),p=m.topology;
function vertices(mesh,ancestor=p.system){mesh.updateWorldMatrix(true,false);ancestor.updateWorldMatrix(true,false);const matrix=ancestor.matrixWorld.clone().invert().multiply(mesh.matrixWorld);return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix).divideScalar(p.MM));}
for(const tilt of [0,35,60])for(const nozzle of [1.5,2,3]){
 m.reset();m.update({tilt,nozzle});m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);
 for(const [i,mesh]of p.tipNozzles.entries()){
  const side=i?-1:1,L=12/Math.cos(tilt*Math.PI/180)*p.MM,exit=new THREE.Vector3(0,L,0).applyMatrix4(mesh.matrixWorld);p.arm.worldToLocal(exit);
  t.near(exit.x/p.MM,side*190,1e-6,'Actual nozzle outlet radius');t.near(exit.y/p.MM,20,1e-6,'Outlet height');t.near(exit.z,0,1e-12,'Outlet tangential coordinate');
  const direction=new THREE.Vector3(0,1,0).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
  const worldExit=mesh.localToWorld(new THREE.Vector3(0,L,0)),ray=new THREE.Raycaster(worldExit.clone().addScaledVector(direction,.01),direction.clone().negate());
  t.near(ray.intersectObject(mesh).length,0,0,'Driving nozzle has an open bore');
  const local=mesh.geometry.attributes.position;let min=Infinity,max=0;for(let j=0;j<local.count;j++){const radius=Math.hypot(local.getX(j),local.getZ(j))/p.MM;min=Math.min(min,radius);max=Math.max(max,radius);}
  t.near(min,nozzle/2,1e-5,'Bore equals selected diameter');t.near(max,nozzle/2+.8,1e-5,'Wall surrounds bore');
 }
 for(const mesh of p.cleanNozzles){const ray=new THREE.Raycaster(mesh.localToWorld(new THREE.Vector3(0,20*p.MM,0)),new THREE.Vector3(0,-1,0));t.near(ray.intersectObject(mesh).length,0,0,'Cleaning nozzles open');}
 for(const [i,mesh]of p.plates.entries()){const v=vertices(mesh),bounds=new THREE.Box3().setFromPoints(v);t.near(bounds.max.x-bounds.min.x,4,1e-4,'Plates stand vertically with axis X');t.near(bounds.max.y-bounds.min.y,210,1e-4,'Plate vertical diameter');if(i)t.ok(bounds.min.x>p.PLATES[i-1].x+2,'Plates do not overlap');}
 m.actions.find(a=>a.label==='Run the wash').run();const s=m.getState();
 t.near(p.arm.rotation.y,s.armAngle,0,'Rendered continuous arm angle');t.near(p.impeller.rotation.y,s.impellerAngle,0,'Pump rotation preserves stopped pose');
 t.near(p.pool.scale.y/1000*Math.PI*((.23)**2-(.10)**2)*1000,s.stored,1e-12,'Actual pool geometry holds exactly the stated volume');
 t.near(p.element.position.y/p.MM+4,46,1e-12,'Heater touches underside of sump floor');t.near(p.sumpFloor.position.y/p.MM,46,1e-12,'Floor receives heat');
 p.jetLines.forEach((line,i)=>{if(line.geometry.drawRange.count){const a=new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position,0),radius=armNozzles()[i].x;t.near(a.y/p.MM,170,1e-3,'Trail begins at actual outlet height');t.near(Math.hypot(a.x,a.z)/p.MM,Math.abs(radius),1e-3,'Trail begins at actual radius');}});
 m.actions.find(a=>a.part==='right-tip-nozzle').run();m.root.updateMatrixWorld(true);const boreAxis=new THREE.Vector3(0,1,0).applyQuaternion(p.tipNozzles[0].getWorldQuaternion(new THREE.Quaternion()));t.near(boreAxis.distanceTo(new THREE.Vector3(0,1,0)),0,1e-12,'Inspection looks along the bore after any arm rotation');
 checkFinite(m.root,t);
}
// Analytic projectile probes independent of displayed mesh sampling.
t.near(jetFlight([0,.17,0],[0,10,0]),(10-Math.sqrt(100-2*9.81*(.808-.17)))/9.81,1e-12,'Ceiling intercept includes gravity');
t.near(jetFlight([0,.47,0],[2,0,0]),.028/2,1e-12,'First plate face clips jet');t.near(jetFlight([0,.17,0],[0,1,0]),.09,0,'Short unobstructed trail');
for(const patch of [{},{bearing:2},{tilt:0},{pump:60,nozzle:3}])for(const share of [0,.125,.25,.5,.8,1]){
 m.reset();m.update(patch);m.advance(washerPlan({...D,...patch}).total/180*share);const before=m.getState();
 for(const action of m.actions.filter(a=>a.group==='Look closer')){action.run();assert.deepEqual(m.getState().readings,before.readings);t.near(m.getState().elapsed,before.elapsed,0,'Inspection never seeks');}
 assert.equal(p.spoon.visible,patch.bearing===2);t.add();
}
const snap=()=>[p.arm.rotation.y,p.tipNozzles[0].rotation.x,p.tipNozzles[0].geometry.attributes.position.array.slice(0,12),p.spoon.visible,p.pool.material.color.toArray(),p.segments.map(m=>m.scale.x),p.jetLines.map(m=>Array.from(m.geometry.attributes.position.array).slice(0,12))];
checkControlsMove(m,snap,model=>model.actions.find(a=>a.label==='Run the wash').run(),t);
const run=values=>{m.reset();m.update(values);m.advance(100);return m.getState();};
checkTrialNumbers(lesson,{
 'Follow a full cycle':s=>({'48.0':s.total/60,'6.00':s.waterUsed,'0.482':s.energy/3.6e6,'22.4':s.temperature}),
 'Account for every fill':s=>({'1.50':sampleWasher({},.125).stored,'22.5':sampleWasher({},.125).clock,'3.00':sampleWasher({},(s.stages[3].start+30)/180).waterUsed,'4.50':sampleWasher({},(s.stages[4].start+22.5)/180).waterUsed}),
 'Reuse the same water':s=>({'9.7':s.run.flow*60000,'313.8':s.recirculated,'6.00':s.waterUsed}),
 'Wash cooler':s=>({'4.1':s.heatTime/60,'0.364':s.energy/3.6e6,'0.482':defaults.energy/3.6e6}),
 'Wash hotter':s=>({'8.2':s.heatTime/60,'75.0':s.rinseTemperature,'0.640':s.energy/3.6e6}),
 'Weaken the pump':s=>({'48.0':s.rpm,'6.9':s.run.flow*60000}),
 'Strengthen the pump':s=>({'110.6':s.rpm,'54.9':s.run.pressure/1000,'11.7':s.run.flow*60000}),
 'Block the arm':s=>(t.near(s.armAngle,0,0,'Blocked arm'),{'9.6':s.run.flow*60000}),
 'Remove the driving tilt':s=>(t.near(s.stallTorque,0,0,'No driving torque'),{'9.6':s.run.flow*60000}),
 'Open wider tip bores':s=>({'136.2':s.rpm,'13.7':s.run.flow*60000,'35.3':s.run.pressure/1000}),
 'Add bearing friction':s=>({'20.0':BEARINGS[s.values.bearing].torque*1000,'55.0':s.rpm}),
 'Keep heat after draining':s=>(t.ok(s.stages[4].initialTemperature>50&&s.stages[4].endTemperature<s.stages[4].initialTemperature,'Retained load heat warms refill'),{}),
},run,t,m);
// Retain shared draft-child numeric coverage, without promoting that route.
checkTrialNumbers(rotatingSprayArmLesson,{
 'Spin the arm':s=>({'51.6':s.stallTorque*1000,'83.5':s.rpm,'1.16':s.spinUp}),
 'No tilt, no turn':s=>(t.near(s.speed,0,0,'No tilt'),{}),
 'A gentle tilt':s=>({'23.3':s.stallTorque*1000,'33.0':s.rpm}),
 'A steep tilt':s=>({'135.0':s.rpm,'4.5':s.tipAbsolute.up}),
 'A stiff bearing':s=>({'20.0':BEARINGS[s.values.bearing].torque*1000,'55.0':s.rpm}),
 'Hold the arm still':s=>({'5.0':s.rest.tipSpeed*Math.sin(s.values.tilt*Math.PI/180)}),
 'Watch the jets leave':s=>({'8.8':s.run.tipSpeed,'3.4':s.tipAbsolute.sideways,'1.7':s.speed*.19}),
 'Raise the pressure':s=>({'110.6':s.rpm,'1.02':s.spinUp}),
 'Use smaller tip bores':s=>({'51.8':s.rpm,'8.2':s.run.flow*60000,'38.3':s.run.pressure/1000}),
 'Use wider tip bores':s=>({'136.2':s.rpm,'13.7':s.run.flow*60000,'35.3':s.run.pressure/1000}),
 'Weaken the pump':s=>({'48.0':s.rpm,'6.9':s.run.flow*60000,'1.40':s.spinUp}),
 'Find the friction threshold':s=>({'7.85':s.stallTorque*1000,'20.0':BEARINGS[s.values.bearing].torque*1000,'9.6':s.run.flow*60000}),
},run,t,m);
for(const trial of lesson.tryIt){t.ok(trial.reset,'Preset resets previous experiment');assert.deepEqual(Object.keys(trial.values).sort(),Object.keys(D).sort());}
m.reset();m.advance(1);m.update({pump:60});t.near(m.getState().elapsed,0,0,'Changed control restarts empty machine');m.advance(1);m.update({pump:60});t.near(m.getState().elapsed,1,0,'No-op keeps time');for(const dt of [-1,NaN,Infinity,0])m.advance(dt);t.near(m.getState().elapsed,1,0,'Invalid deltas ignored');
for(const dt of [1/15,1/60,1/144]){m.reset();const total=washerPlan().total/180;for(let time=0;time<total;time+=dt)m.advance(dt);const s=m.getState();t.near(s.elapsed,total,0,'Exact completion at every frame rate');t.near(s.armAngle,sampleWasher({},100).armAngle,1e-12,'Frame-independent final pose');const before=s.readings;m.advance(1);assert.deepEqual(m.getState().readings,before);}
m.reset();m.actions.find(a=>a.label==='Run the wash').run();m.covers.forEach(x=>x.visible=false);const camera=new THREE.PerspectiveCamera(40,1,.01,100);camera.position.set(0,2,8);camera.lookAt(0,2,0);camera.updateMatrixWorld();const explosion=createPartExplosion(m,camera,1.2);explosion.update(1);const categories=explosion.categories.map(x=>x.id);t.ok(!categories.some(x=>['cycle','spray','reaction'].includes(x)),'Diagram overlays excluded from parts inventory');t.ok(categories.includes('arm')||categories.includes('spray-arm'),'Spray assembly remains grouped');explosion.dispose();
const resources=checkDisposal(m,t),report={result:'PASS',configurations,quadratures,thermalCases,checks:t.count,trials:lesson.tryIt.length,draftChildTrials:rotatingSprayArmLesson.tryIt.length,resources,categories,limits:'Illustrative ideal nozzle, lumped thermal and prescribed cycle model. No cleanliness, chemical or dryness prediction.'};await writeFile(dir+'/model.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

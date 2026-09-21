import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createToiletTankModel} from './toilet-tank-model.js';
import {cisternConstants as C,CISTERN_DEFAULTS as D,CISTERN_DOMAINS,createCisternTrial,sampleCistern,siphonStorage,risingArea,siphonDischarge,fillRate,overflowRate} from './toilet-tank-physics.js';
import {toiletTankLesson as lesson} from './toilet-tank-lesson.js';
let checks=0,settings=0;
const ok=(x,message)=>{assert.ok(x,message);checks++;};
const close=(x,y,tol,message)=>ok(Math.abs(x-y)<=tol,`${message}: ${x} vs ${y}`);
const area=bore=>Math.PI*bore*bore/4;
const upper=(h,bore)=>Math.max(0,.155-h)*Math.PI*.061**2+Math.max(0,.22-Math.max(h,.155))*area(bore)+area(bore)*(Math.PI*.0575+.47);
const inlet=(h,v)=>.00008*Math.sqrt(v.pressure)*Math.max(0,Math.min(1,(v.level-h)/.03));
const outlet=(h,v)=>.7*area(v.bore)*Math.sqrt(2*9.81*(.25+h));
function simpson(f,a,b,n=2000){if(b<=a)return 0;const dx=(b-a)/n;let sum=f(a)+f(b);for(let i=1;i<n;i++)sum+=f(a+i*dx)*(i%2?4:2);return sum*dx/3;}
function independent(v){
 const pump=v.fault===1?0:Math.PI*.06**2*v.stroke/.6,k=.00008*Math.sqrt(v.pressure)/.03;
 const level=t=>v.level-(k>0?pump/k*(-Math.expm1(-k*t/.072)):pump*t/.072);
 let t=.6;if(pump*t<upper(level(t),v.bore))return {primed:false};
 let lo=0,hi=.6;for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(pump*mid>=upper(level(mid),v.bore))hi=mid;else lo=mid;}t=hi;
 const h=level(t),bounds=[.04,.155,v.level-.03,h].filter(x=>x>=.04&&x<=h).sort((a,b)=>a-b);
 let duration=0,added=0;
 for(let i=1;i<bounds.length;i++){
  const a=bounds[i-1],b=bounds[i],effective=.072-((a+b)/2<.155?Math.PI*.061**2:area(v.bore));
  const dt=x=>effective/(outlet(x,v)-inlet(x,v));duration+=simpson(dt,a,b);added+=simpson(x=>inlet(x,v)*dt(x),a,b);
 }
 const duringPrime=.072*(h-v.level)+pump*t;
 return {primed:true,time:t,airAt:t+duration,delivered:.072*(v.level-.04)+duringPrime+added};
}
for(const bore of [.025,.032,.045])for(const h of [.04,.08,.155,.17,.21,.215]){
 close(siphonStorage(h,bore),upper(h,bore),1e-13,'independent stored passage volume');
 close(risingArea(h,bore),h<.155?Math.PI*.061**2:area(bore),1e-14,'rising cross-section');
 if(h>.04)close(siphonDischarge(h,bore),outlet(h,{bore}),1e-14,'independent head discharge');
}
for(const pressure of [0,.5,2,5])for(const delta of [0,.015,.05])close(fillRate(.18-delta,.18,pressure),.00008*Math.sqrt(pressure)*Math.min(1,delta/.03),1e-14,'float closure');
const cases=[...lesson.tryIt.map(t=>t.values)];
for(const [key,[min,max,step]]of Object.entries(CISTERN_DOMAINS))for(let x=min;x<=max+step/4;x+=step)cases.push({...D,[key]:Number(x.toPrecision(12))});
for(const level of [.16,.18,.215])for(const bore of [.025,.032,.045])for(const pressure of [0,.5,5])for(const stroke of [.03,.1])cases.push({...D,level,bore,pressure,stroke});
for(const v of cases){
 const t=createCisternTrial(v),f=t.final;settings++;ok(f.complete,'finite completion');ok(f.time<700,'bounded trial');
 let previous={inlet:0,outlet:0,time:0};
 for(const s of t.states){
  ok(s.level>=.04-1e-10&&s.level<.3,'bounded tank level');ok(s.pipe>=-1e-10,'nonnegative pipe storage');ok(s.inlet>=previous.inlet-1e-12&&s.outlet>=previous.outlet-1e-12,'cumulative volumes cannot reverse');
  close(s.inlet-s.outlet,.072*(s.level-v.level)+s.pipe,1e-11,'water balance');
  if(s.stage==='siphoning')close(s.pipe,upper(s.level,v.bore),1e-10,'full passage matches height');previous=s;
 }
 if(v.fault!==2){const expected=independent(v);assert.equal(f.primed,expected.primed);checks++;if(expected.primed){close(f.primeAt,expected.time,2e-7,'analytic pumping threshold');close(f.flushEnded,expected.airAt,1e-5,'independent head integration '+JSON.stringify(v));close(f.outlet,expected.delivered,2e-8,'independent total discharge');if(v.pressure>0)close(f.level,v.level,1e-12,'refill closes');else close(f.outlet,.072*(v.level-.04),1e-12,'isolated stored charge');}else close(f.outlet,0,1e-12,'failed priming delivers nothing');}
 else{close(f.inlet,.00008*Math.sqrt(v.pressure)*120,1e-11,'fault inlet over two minutes');const s=sampleCistern(t,t.duration);close(s.fill,.00008*Math.sqrt(v.pressure),1e-12,'observation ending does not repair inlet');close(s.flow,overflowRate(s.level,v.bore),1e-12,'final ongoing overflow');}
 for(const screen of [0,t.duration/4,t.duration/2,t.duration]){const s=sampleCistern(t,screen);close(s.balance,0,1e-11,'sampled conservation');ok(Number.isFinite(s.lift)&&s.lift>=0&&s.lift<=v.stroke+1e-10,'valid piston stroke');if(v.fault===2)close(s.lift,0,0,'fault observation does not press handle');}
}
const m=createToiletTankModel(),top=m.topology,geometryStates=[];
for(const trial of lesson.tryIt){assert.deepEqual(Object.keys(trial.values).sort(),Object.keys(D).sort());ok(trial.reset&&trial.cutaway&&!trial.isolate,'full preset reset');
 m.reset();m.update(trial.values);const duration=m.getState().screenDuration;
 for(const time of [0,.15,duration*.25,duration*.75,duration]){
  m.reset();m.update(trial.values);m.advance(time);const s=m.getState();m.root.updateMatrixWorld(true);
  m.root.traverse(o=>{if(o.isMesh){for(const n of o.matrixWorld.elements)ok(Number.isFinite(n),'finite transforms');}});
  close(top.piston.position.y/top.MM,45+s.lift*1000,1e-9,'piston follows physical lift');close(top.crosshead.position.y/top.MM,320+s.lift*1000,1e-9,'crosshead stays attached');
  const pin=top.leverPin.getWorldPosition(new THREE.Vector3()),rod=top.crosshead.getWorldPosition(new THREE.Vector3());pin.applyMatrix4(m.root.matrixWorld.clone().invert());rod.applyMatrix4(m.root.matrixWorld.clone().invert());close(pin.y,rod.y,1e-9,'handle pin stays in slot');
  const y=trial.values.fault===2?trial.values.level*1000-30:s.level*1000;close(top.floatBall.getWorldPosition(new THREE.Vector3()).applyMatrix4(m.root.matrixWorld.clone().invert()).y/top.MM,y+4,1e-8,'float or jammed arm follows declared height');
  const upperDisk=45+s.lift*1000+.5;ok(upperDisk<155,'piston never hits roof');ok(30-(trial.values.bore*500+3)>-20+3,'rod clears bend behind it');
  ok(Math.hypot(150-60,30-10)>65+trial.values.bore*500+3,'falling leg clears bell');
  geometryStates.push({title:trial.title,time,stage:s.stage});
 }
}
m.reset();m.update({stroke:0});for(const time of [0,.15,.65,1]){m.reset();m.update({stroke:0});m.advance(time);for(const {flap}of m.topology.flaps)close(flap.rotation.x,0,0,'no-flow diaphragm remains seated');}
m.reset();m.advance(1e4);for(const {flap}of m.topology.flaps)close(flap.rotation.x,0,0,'completed diaphragm settles closed');
m.reset();m.root.rotation.set(0,0,0);m.covers.forEach(o=>o.visible=false);m.root.updateMatrixWorld(true);
const supplyRay=new THREE.Raycaster(new THREE.Vector3(230,256,-64).multiplyScalar(top.MM),new THREE.Vector3(-1,0,0));
ok(supplyRay.intersectObject(top.right).length===0,'supply bore passes through cistern wall');
ok(supplyRay.intersectObject(m.root,true)[0]?.object===top.stem,'supply reaches valve chamber through assembled tank');
const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
const hits=new THREE.Raycaster(new THREE.Vector3(60,44,200).multiplyScalar(top.MM),new THREE.Vector3(0,0,-1)).intersectObject(m.root,true).filter(hit=>visible(hit.object));
ok(hits[0]?.object===top.disk,'transparent water does not block submerged disk picking');
const tail=createCisternTrial(D).states.find(s=>s.stage==='rundown');m.reset();m.advance(tail.screen+.1);const dotsBefore=top.dots.map(dot=>dot.position.clone());m.advance(.1);
ok(top.dots.some((dot,i)=>dot.visible&&dot.position.distanceTo(dotsBefore[i])>1e-4),'direction markers advance during retained-water rundown');
const tailState=m.getState(),retained=tailState.pipe/tailState.drainStart;
for(let i=0;i<top.dots.length;i++){const u=((tailState.outlet+tailState.primeVolume)*180+i/top.dots.length)%1;assert.equal(top.dots[i].visible,u>=1-retained);checks++;}
m.covers.forEach(o=>o.visible=true);
m.reset();m.advance(1);const held=m.getState().screen;m.update({...D});close(m.getState().screen,held,0,'no-op update preserves time');m.update({pressure:5});close(m.getState().screen,0,0,'changed setting resets');
for(const invalid of [NaN,Infinity,-Infinity]){const before=m.getState().values.pressure;m.update({pressure:invalid});close(m.getState().values.pressure,before,0,'invalid input ignored');}
m.reset();m.advance(1e4);const ended=JSON.stringify(m.getState().readings);m.advance(10);assert.equal(JSON.stringify(m.getState().readings),ended);checks++;
const geometries=new Set(),materials=new Set();m.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const a of Array.isArray(o.material)?o.material:[o.material])materials.add(a);});let disposed=0;for(const x of [...geometries,...materials])x.addEventListener('dispose',()=>disposed++);m.dispose();m.dispose();close(disposed,geometries.size+materials.size,0,'each owned resource disposed once');
console.log(JSON.stringify({result:'PASS',settings,trials:lesson.tryIt.length,geometryStates:geometryStates.length,checks,resources:disposed},null,2));

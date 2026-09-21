import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {sampleStraw,strawPlan,strawFlow,frictionFactor,DRINKS,STRAW,STRAW_DEFAULTS as D,STRAW_DOMAINS} from './drinking-straw-physics.js';
import {createDrinkingStrawModel} from './drinking-straw-model.js';
import {drinkingStrawLesson as lesson} from './drinking-straw-lesson.js';
import {createPartExplosion} from './part-explosion.js';
import {tally,checkTrialNumbers,checkQuotedText,checkControlsMove,checkFinite,checkRefusals,checkDisposal} from './model-check-kit.mjs';
const dir=process.env.EVIDENCE_DIR||'documentation/audit/evidence/drinking-straw-20260921';await mkdir(dir,{recursive:true});const t=tally();
// Independent velocity-domain solve and volume/time quadrature. This does not
// reuse the model's flow solver or its time-domain RK4 integration.
function referenceFactor(re){
 if(!re)return 0;if(re<1000)return 64/re;
 const logA=16*Math.log(Math.abs(2.457*.9*Math.log(re/7))),logB=16*Math.log(37530/re),largest=Math.max(logA,logB);
 const logSum=largest+Math.log(Math.exp(logA-largest)+Math.exp(logB-largest));
 return 8*Math.exp(Math.log(Math.exp(12*Math.log(8/re))+Math.exp(-1.5*logSum))/12);
}
function referenceFlow(dp,rho,mu,radius,length,height){
 const remaining=dp-rho*9.81*height;if(remaining<=0)return 0;
 let a=0,b=Math.sqrt(2*remaining/rho);
 for(let i=0;i<64;i++){const v=(a+b)/2,re=rho*v*2*radius/mu,loss=(referenceFactor(re)*length/(2*radius)+1.5)*rho*v*v/2;if(loss>remaining)b=v;else a=v;}
 return Math.PI*radius*radius*(a+b)/2;
}
function timeIntegral(values,endVolume){
 const {density,viscosity}=DRINKS[values.drink],r=values.diameter/2000,area=Math.PI*r*r,reservoir=Math.PI*(.04*.04-(r+.0004)**2),fill=area*values.lift/100;
 const f=v=>{const y=.12+Math.min(v/area,values.lift/100),level=.12-v/reservoir;return 1/referenceFlow(values.suction*1000,density,viscosity,r,y-.06,y-level);};
 function segment(a,b){if(b<=a)return 0;const n=2048,h=(b-a)/n;let sum=f(a)+f(b);for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(a+i*h);return sum*h/3;}
 return segment(0,Math.min(fill,endVolume))+segment(fill,endVolume);
}
for(const re of [1e-6,.1,1,100,999.999,1000,1000.001,1500,2000,2300,3000,4000,1e4,1e5,1e6])t.near(frictionFactor(re),referenceFactor(re),Math.max(1e-13,referenceFactor(re)*1e-12),'Churchill factor across low-Re branch and transition');
let configurations=0,quadratures=0;
for(const suction of [0,.5,1,1.5,5,20])for(const diameter of [3,6,9,12])for(const lift of [5,15,25,30])for(const drink of [0,1,2,3])for(const hole of [0,1]){
 const values={suction,diameter,lift,drink,hole},p=strawPlan(values);let previous=0;
 for(const time of [0,.04,.2,2,12,20]){
  const s=sampleStraw(values,time),rho=DRINKS[drink].density;
  t.ok(s.drunk>=0&&s.drunk<=20e-6+1e-18,'Sip never exceeds target');t.ok(s.volume>=previous-1e-18,'Transferred volume increases monotonically');previous=s.volume;
  t.near(s.reservoirArea*(.12-s.level),s.area*(s.columnTop-.12)+s.drunk,1e-18,'Finite glass, column and sip conserve volume');
  t.near(s.height,s.columnTop-s.level,1e-15,'Lift measured from current surface');t.ok(s.level>.06&&s.columnTop<=.12+lift/100+1e-14,'Inlet remains immersed and column does not pass mouth');
  t.near(s.liftPressure+s.frictionPressure+s.kineticPressure,s.dp,2e-8,'Pressure budget closes including before arrival');
  if(time===0||s.complete||s.arrivedAt===null||s.elapsed<s.arrivedAt)t.near(s.mouthFlow,0,0,'No premature or post-completion output');
  if(s.complete)t.near(s.elapsed,p.endTime,1e-12,'Clock clamps exactly to completion');
  if(hole||!suction)t.near(s.volume,0,0,'No flow without pressure difference');
  t.ok([s.volume,s.height,s.level,s.reynolds,s.operatingFlow].every(Number.isFinite),'Finite sampled state');
 }
 const s=sampleStraw(values,12),q=referenceFlow(s.dp,s.drink.density,s.drink.viscosity,s.radius,s.columnTop-.06,s.height);
 t.near(s.operatingFlow,q,Math.max(1e-16,q*2e-11),'Independent pressure solve');
 if(s.sipped){t.near(s.drunk,20e-6,1e-18,'Exact sip event');t.ok(s.sipTime<=12,'Sip event belongs to trial');}
 configurations++;
}
for(const experiment of lesson.tryIt){const s=sampleStraw(experiment.values,12);if(s.volume&&s.operatingFlow>1e-10){t.near(timeIntegral(experiment.values,s.volume),s.elapsed,3e-5,'Independent quadrature reproduces integrated time');quadratures++;}if(s.arrivedAt!==null){t.near(timeIntegral(experiment.values,s.fillVolume),s.arrivedAt,3e-5,'Independent arrival quadrature');quadratures++;}}
const thick=strawPlan({drink:2}),wide=strawPlan({drink:2,diameter:12});t.near(wide.initialFlow/thick.initialFlow,16,.01,'Laminar fourth-power comparison at identical surface and length');
const threshold=sampleStraw({suction:1.5},12);t.ok(threshold.drunk<20e-6&&threshold.arrivedAt!==null,'Can start drinking yet never reach target');t.near((threshold.equilibriumVolume-threshold.fillVolume)*1e6,10.2564641774,1e-8,'Finite-reservoir long-time limit');
checkRefusals(sampleStraw,STRAW_DOMAINS,t);

const m=createDrinkingStrawModel(),p=m.topology;
function vertices(mesh,ancestor){mesh.updateWorldMatrix(true,false);ancestor.updateWorldMatrix(true,false);const matrix=ancestor.matrixWorld.clone().invert().multiply(mesh.matrixWorld);return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix).divideScalar(p.MM));}
for(const diameter of [3,6,12])for(const lift of [5,15,30])for(const hole of [0,1]){
 m.reset();m.update({diameter,lift,hole});m.advance(.04);m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);const s=m.getState(),inner=diameter/2,outer=inner+.4;
 const axis=new THREE.Raycaster(new THREE.Vector3(p.STRAW_X*p.MM,(s.top+15)*p.MM,0),new THREE.Vector3(0,-1,0));
 t.near(axis.intersectObjects([...p.tubeSections,p.ventBack,p.ventFront,p.lips]).length,0,0,'Tube and lip bore remain open on axis');
 const wall=new THREE.Raycaster(new THREE.Vector3((p.STRAW_X+inner+.2)*p.MM,(s.top+15)*p.MM,0),new THREE.Vector3(0,-1,0));t.ok(wall.intersectObjects(p.tubeSections).length>0,'Actual tube has a wall around the bore');
 const ventRay=new THREE.Raycaster(new THREE.Vector3(p.STRAW_X*p.MM,s.ventY*p.MM,20*p.MM),new THREE.Vector3(0,0,-1));
 const hits=ventRay.intersectObjects([p.ventBack,...(hole?[]:[p.ventFront])]);t.ok(hits.length>0,'Vent retains back wall');t.ok(hole?hits[0].point.z<0:hits[0].point.z>0,'Opening removes front wall rather than covering it with a cube');
 const lips=vertices(p.lips,p.mouth);t.ok(lips.every(v=>Math.hypot(v.x,v.z)>=outer-1e-4),'Lip vertices clear outer wall');
 const lo=vertices(p.tubeSections[0],p.straw),hi=vertices(p.tubeSections[1],p.straw);t.near(Math.min(...lo.map(v=>v.y)),60,1e-4,'Tube inlet depth');t.near(Math.max(...hi.map(v=>v.y)),s.top,1e-4,'Tube ends at mouth');
 const fluid=vertices(p.columnMesh,p.column);t.near(Math.min(...fluid.map(v=>v.y)),60,1e-4,'Column starts at inlet');t.near(Math.max(...fluid.map(v=>v.y)),s.columnTop*1000,1e-4,'Actual column top follows state');
 const reservoir=vertices(p.drinkBody,p.reservoir);t.near(Math.max(...reservoir.map(v=>v.y)),s.level*1000,1e-4,'Drawn free surface follows conserved volume');
 t.near(p.push.userData.length,s.dp/1000*p.KPA,1e-12,'Pressure arrow scale');t.near(p.weight.userData.length,s.liftPressure/1000*p.KPA,1e-12,'Gravity arrow uses same scale');
 const shape=p.drinkBody.geometry.parameters.shapes;t.near(shape.holes.length,1,0,'Reservoir has actual off-axis tube void');
 checkFinite(m.root,t);
}
for(const experiment of lesson.tryIt)for(const time of [0,.04,.25,2,12]){
 m.reset();m.update(experiment.values);m.advance(time);const s=m.getState();
 t.near(p.drinkBody.scale.y/p.M,s.level-.06,1e-12,'Liquid body stays at correct level');
 for(const dot of p.tracers)if(dot.visible){const radius=dot.scale.x/p.M;t.ok(dot.position.y/p.M-radius>=.06-1e-12&&dot.position.y/p.M+radius<=s.columnTop+1e-12,'Entire tracer remains in column');t.ok(radius<s.radius,'Tracer fits bore');}
 const before=s;m.actions.filter(a=>a.group==='Look closer').forEach(action=>{action.run();assert.deepEqual(m.getState().readings,before.readings);});
}
// The claimed slowed drift must not inherit motion from changing marker spacing.
m.reset();m.advance(.04);const driftStart=m.getState(),markerStart=p.tracers.map(dot=>dot.position.y);m.advance(.001);const driftEnd=m.getState();
for(let i=0;i<p.tracers.length;i++)t.near(p.tracers[i].position.y-markerStart[i],(driftEnd.volume-driftStart.volume)/driftStart.area*p.SLOW*p.M,1e-12,'Every unwrapped tracer moves at exactly one tenth of mean volume displacement');
checkControlsMove(m,()=>[p.columnMesh.scale.toArray(),p.push.userData.length,p.weight.userData.length,p.ventFront.visible,p.lips.position.y,p.tubeSections[1].geometry.attributes.position.array.slice(0,12),p.lips.geometry.attributes.position.array.slice(0,12),p.columnMesh.material.color.toArray(),p.drinkBody.scale.y],model=>model.advance(.04),t);
const run=values=>{m.reset();m.update(values);m.advance(12);return m.getState();};
checkTrialNumbers(lesson,{
 'Sip a thin liquid':s=>({'0.04':.04,'8.60':sampleStraw({},.04).height*100,'0.076':s.arrivedAt,'20':s.drunk*1e6,'0.506':s.sipTime,'4.86':(.12-s.level)*1000}),
 'Not enough pressure':s=>(t.near(s.drunk,0,0,'No sip'),{'10.19':s.height*100}),
 'A sip that slows itself':s=>({'9.82':s.drunk*1e6,'10.26':(s.equilibriumVolume-s.fillVolume)*1e6}),
 'Open the side vent':s=>(t.near(s.volume,0,0,'Vent stops all rise'),{}),
 'A thick liquid needs time':s=>({'9.028':s.arrivedAt,'0.76':s.drunk*1e6}),
 'Give thick liquid a wide bore':s=>({'2.270':s.arrivedAt,'20':s.drunk*1e6,'7.240':s.sipTime,'6':D.diameter}),
 'Narrow the thin-liquid straw':s=>({'20':s.drunk*1e6,'2.331':s.sipTime,'0.506':strawPlan().sipTime,'6':D.diameter}),
 'Raise the mouth':s=>({'0.858':s.sipTime,'60':s.liftShare*100}),
 'Too high for this pressure':s=>(t.near(s.drunk,0,0,'High mouth stays dry'),{'25.48':s.height*100}),
 'Compare a very thick liquid':s=>({'1.899':s.arrivedAt,'5.518':s.sipTime,'91':s.frictionShare*100}),
 'Remove the pressure difference':s=>(t.near(s.volume,0,0,'No pressure no rise'),{}),
 'Change both density and viscosity':s=>({'0.534':s.sipTime,'48.77':s.holdHeight*100}),
},run,t,m);
checkQuotedText(lesson.deeper.map(x=>x.body).join(' '),{'50.97 cm':`${(5000/(1000*9.81)*100).toFixed(2)} cm`,'10.26 mL':`${((threshold.equilibriumVolume-threshold.fillVolume)*1e6).toFixed(2)} mL`,'10.33 m':`${(101325/(1000*9.81)).toFixed(2)} m`},t);
for(const experiment of lesson.tryIt){assert(experiment.reset);assert.deepEqual(Object.keys(experiment.values).sort(),Object.keys(D).sort());m.update({suction:0});m.advance(12);m.reset();m.update(experiment.values);t.near(m.getState().elapsed,0,0,'Independent preset reset');}
for(const hz of [15,60,144])for(const values of [{},{suction:1},{drink:2,diameter:12}]){m.reset();m.update(values);while(!m.playback.complete())m.advance(1/hz);const expected=sampleStraw(values,12);t.near(m.getState().drunk,expected.drunk,1e-18,'Frame-independent output');t.near(m.getState().elapsed,expected.elapsed,0,'Exact event at all frame rates');}
m.reset();m.advance(.04);m.update({diameter:12});t.near(m.getState().elapsed,0,0,'Changing control starts fresh');m.advance(.04);m.update({diameter:12});t.near(m.getState().elapsed,.04,0,'No-op control preserves trial');for(const dt of [-1,NaN,Infinity,0])m.advance(dt);t.near(m.getState().elapsed,.04,0,'Invalid frame deltas ignored');m.update({drink:NaN,diameter:Infinity});t.ok(Number.isFinite(m.getState().drunk),'Nonfinite UI input ignored');
m.reset();m.advance(.04);m.covers.forEach(x=>x.visible=false);const camera=new THREE.PerspectiveCamera(40,1,.01,100);camera.position.set(0,1.5,7);camera.lookAt(0,1.5,0);camera.updateMatrixWorld();const explosion=createPartExplosion(m,camera,1.2);explosion.update(1);const categories=explosion.categories.map(x=>x.id);assert.deepEqual(categories,['glass','reservoir','straw','vent','column','mouth']);t.ok(explosion.items.every(x=>!['pressure','atmosphere','system'].includes(x.id)),'Diagram arrows excluded from separated machine inventory');explosion.dispose();
const resources=checkDisposal(m,t),report={result:'PASS',configurations,quadratures,checks:t.count,trials:lesson.tryIt.length,resources,categories,limits:'Quasi-steady Newtonian teaching closure with illustrative parameters; sampled geometry and ray checks, not manufacturing or physiological validation.'};await writeFile(dir+'/model.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

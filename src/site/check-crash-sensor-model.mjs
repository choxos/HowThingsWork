import assert from 'node:assert/strict';
import * as THREE from 'three';
import {crashSensorConstants as C,crashSensorBridge,sampleCrashSensor,createCrashSensorModel} from './crash-sensor-model.js';
const started=performance.now();
const near=(a,b,tol=1e-10,context='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${context}: ${a} vs ${b} tol ${tol}`);
// Independent impulse convolution: physical constants and kernels are written
// here, not obtained from the production derivative, cache or bridge helper.
const mp=2330*1e-6*40e-6,mbs=4*2330*.001*50e-6*5e-6,me=mp+13/35*mbs,base=mp+mbs/2,k=4,wn=Math.sqrt(k/me),gain=4702.5;
const gx=[.09501250983763744,.2816035507792589,.4580167776572274,.6178762444026438,.755404408355003,.8656312023878318,.9445750230732326,.9894009349916499];
const gw=[.1894506104550685,.1826034150449236,.16915651939500254,.14959598881657673,.12462897125553387,.09515851168249278,.06225352393864789,.027152459411754095];
function integrate(fn,end,panels=32){let sum=0;for(let j=0;j<panels;j++){const h=end/panels/2,mid=(j+.5)*end/panels;for(let i=0;i<8;i++)sum+=h*gw[i]*(fn(mid-h*gx[i])+fn(mid+h*gx[i]));}return sum;}
function ref(v,t){
  const alpha=v.damping*wn,beta=wn*Math.sqrt(Math.max(0,1-v.damping*v.damping)),d=500,lambda=alpha-d;
  function kernels(s){
    if(beta===0){const e=Math.exp(-wn*s);return [s*e,(1-wn*s)*e,gain/.002*Math.exp(-d*s)*(-Math.expm1(-lambda*s)-lambda*s*Math.exp(-lambda*s))/(lambda*lambda)];}
    const e=Math.exp(-alpha*s),sin=Math.sin(beta*s),cos=Math.cos(beta*s);
    return [e*sin/beta,e*(cos-alpha*sin/beta),gain/.002*(Math.exp(-d*s)-e*(cos+lambda*sin/beta))/(lambda*lambda+beta*beta)];
  }
  return [0,1,2].map(index=>base/me*v.deceleration*(index===2?v.supply:1)*integrate(s=>Math.sin(Math.PI*s/v.pulseDuration)**2*kernels(t-s)[index],Math.min(t,v.pulseDuration)));
}
const tuples=[];for(const deceleration of [-20,-10,0,10,20])for(const pulseDuration of [.001,.002,.004,.008])for(const damping of [.25,.7,1])for(const supply of [0,1])tuples.push({deceleration,pulseDuration,damping,supply});
let samples=0,maxQ=0,maxV=0,maxZ=0,latchedCount=0;
for(const values of tuples){
  const T=values.pulseDuration;
  for(const t of [0,T/2,3*T/4,T,T+.001,T+.004,.025]){
    const r=ref(values,t),s=sampleCrashSensor(values,t);maxQ=Math.max(maxQ,Math.abs(s.relative-r[0]));maxV=Math.max(maxV,Math.abs(s.relativeVelocity-r[1]));maxZ=Math.max(maxZ,Math.abs(s.filterState-r[2]));
    near(s.relative,r[0],2e-15,'q convolution');near(s.relativeVelocity,r[1],2e-11,'velocity convolution');near(s.filterState,r[2],2e-11,'filter convolution');
    near(s.energyError,0,3e-21,'modal energy');assert.ok(s.dampingLoss>=0&&s.mechanicalEnergy>=0);assert.ok(Math.abs(s.relative)<.65e-6);
    const epsilon=14.25*s.relative;near(s.padStrains[0],-epsilon,1e-19);near(s.padStrains[1],epsilon,1e-19);
    const [r1,r2,r3,r4]=s.resistances;near(s.leftVoltage/ r2,(s.supplyVoltage-s.leftVoltage)/r1,1e-17,'left KCL');near(s.rightVoltage/r4,(s.supplyVoltage-s.rightVoltage)/r3,1e-17,'right KCL');near(s.bridgeVoltage,s.leftVoltage-s.rightVoltage,8e-16,'full bridge');
    if(!values.supply){assert.equal(s.filteredVoltage,null);assert.equal(s.latched,false);assert.equal(s.comparison,false);assert.equal(s.supplyCurrent,0);}else assert.equal(s.comparison,s.filterState>=.001);
    if(values.deceleration<=0)assert.ok(s.filterState<=1e-15);
    if(t===.025){near(s.frameVelocityChange,-values.deceleration*T/2,1e-16);near(s.frameDisplacementChange,-values.deceleration*T*.025/2+values.deceleration*T*T/4,1e-16);if(s.latched)latchedCount++;assert.equal(s.latched,values.supply===1&&values.deceleration===20&&T>=.004);}
    samples++;
  }
  const a=sampleCrashSensor(values,.001234567);sampleCrashSensor(values,.024);assert.deepEqual(sampleCrashSensor(values,.001234567),a,'absolute sampling and backward causality');
}
assert.equal(latchedCount,6);
const baseline=sampleCrashSensor({},.025);near(baseline.firstCrossing,.0024688088705109236,1e-11,'independent source crossing');
assert.equal(sampleCrashSensor({},baseline.firstCrossing-1e-9).latched,false);assert.equal(sampleCrashSensor({},baseline.firstCrossing+1e-9).latched,true);
assert.equal(sampleCrashSensor({},.003).comparison,true);assert.equal(sampleCrashSensor({},.004).comparison,false);assert.equal(sampleCrashSensor({},.004).latched,true);
for(const values of [{},{pulseDuration:.001,damping:.25},{supply:0}]){
  const v={...C.defaults,...values},t=.007,s=sampleCrashSensor(v,t);
  const work=integrate(u=>base*v.deceleration*Math.sin(Math.PI*u/v.pulseDuration)**2*ref(v,u)[1],v.pulseDuration,24);
  const loss=integrate(u=>2*v.damping*Math.sqrt(k*me)*ref(v,u)[1]**2,t,96);
  near(s.baseWork,work,2e-21,'independent work quadrature');near(s.dampingLoss,loss,2e-21,'independent loss quadrature');
}
for(const [r,vs]of [[[100,200,300,400],5],[[1,20,300,4],0],[[12,8,4,16],3]]){const b=crashSensorBridge(r,vs);near(b.leftVoltage,vs*r[1]/(r[0]+r[1]),1e-15);near(b.rightVoltage,vs*r[3]/(r[2]+r[3]),1e-15);near(b.supplyCurrent,vs/(r[0]+r[1])+vs/(r[2]+r[3]),1e-15);}
for(const t of [-1,NaN,Infinity,.0250001])assert.throws(()=>sampleCrashSensor({},t));
for(const v of [{deceleration:1},{pulseDuration:.003},{damping:.5},{supply:2},{unknown:0}])assert.throws(()=>sampleCrashSensor(v));
assert.throws(()=>crashSensorBridge(new Array(4),3.3));assert.throws(()=>crashSensorBridge([1,0,1,1],3.3));assert.throws(()=>crashSensorBridge([1,1,1,1],NaN));
const model=createCrashSensorModel(),top=model.topology;assert.equal(model.parts.length,18);assert.equal(model.controls.length,4);assert.equal(model.actions.length,14);
assert.equal(model.initialPart,'chip');assert.equal(model.initialView,'iso');assert.equal(model.initialIsolated,true);
assert.ok(model.actions.slice(0,8).every(a=>!a.part&&!a.view&&a.replay===false),'Time actions preserve inspection without becoming replay setup');
assert.ok(model.actions.slice(8).every(a=>a.isolate&&a.view),'Diagram inspections have explicit isolated views');
function checkReadingPresentation(){
  const rows=model.getState().readings;assert.equal(rows.length,35);assert.ok(rows.every(r=>r.hint),'Every reading explains its physical meaning');
  for(const r of rows){assert.doesNotMatch(r.value,/[eE][+-]\d+/,'No exponent noise in display');assert.doesNotMatch(r.value,/^-0\.0+(?: |$)/,'No negative zero');}
}
checkReadingPresentation();model.actions[7].run();checkReadingPresentation();
assert.ok(model.getState().mechanicalEnergy>0&&model.getState().filterState>0,'Rounding does not zero physical residuals');
assert.equal(model.getState().readings.find(r=>r.label==='Conditioned voltage').value,'0.000 mV');
assert.equal(model.getState().readings.find(r=>r.label==='First threshold crossing').value,'2.469 ms');
model.reset();
const ids=top.histories.map(h=>[h.geometry,h.positions,h.times,h.exact,h.distances]);
const local=(object,p)=>new THREE.Vector3(...p).applyMatrix4(object.matrixWorld);
let geometryPoses=0,historyPoses=0;
function geometry(q=model.getState().relative){
  model.root.updateMatrixWorld(true);near(top.squarePart.position.z,q*1e6,1e-13,'true declared deflection mapping');
  for(const beam of top.beams){const p=beam.geometry.attributes.position;
    for(const j of [0,20,40,60,80]){
      const u=j/80,center=[0,0,0];for(let c=0;c<4;c++)for(let d=0;d<3;d++)center[d]+=p.array[(j*4+c)*3+d]/4;
      near(center[0],beam.config.start[0]+2*u*beam.config.d[0],3e-7);near(center[1],beam.config.start[1]+2*u*beam.config.d[1],3e-7);near(center[2],q*1e6*(3*u*u-2*u*u*u),1e-7);
      if(j===0||j===80){near(p.getZ(j*4+2)-p.getZ(j*4),.01,1e-7,'clamped end normal');near(center[2],j===0?0:top.squarePart.position.z,1e-7,'actual endpoint attachment');}
    }
  }
  for(const g of top.gauges){
    const [lo,hi]=g.config.interval;near(hi-lo,.05,1e-15);near(integrate(u=>3*5e-6*q/.001**2*(2*(lo+u)-1),hi-lo,1)/(hi-lo),(g.config.id===1||g.config.id===4?-1:1)*.95*15*q,1e-18,'finite pad integral');
    for(let j=0;j<5;j++)for(let side=0;side<2;side++){const expected=top.surface(g.config,lo+(hi-lo)*j/4,side?.03:-.03,.005,q);for(let d=0;d<3;d++)near(g.positions[(j*2+side)*3+d],expected[d],2e-7,'pad attached surface');const beam=top.beams.find(b=>b.config.id===g.config.id),row=Math.round((lo+(hi-lo)*j/4)*80),alpha=side?.8:.2;for(let d=0;d<3;d++)near(g.positions[(j*2+side)*3+d],beam.positions[(row*4+3)*3+d]*(1-alpha)+beam.positions[(row*4+2)*3+d]*alpha,3e-7,'pad on actual tessellated beam face');}
    for(const lead of g.leads){const p=lead.object.geometry.attributes.position;const endpoint=top.surface(g.config,lead.terminal?hi:lo,0,.005,q);for(let d=0;d<3;d++){near(p.array[d],endpoint[d],2e-7,'electrode end');near(p.array[(p.count-1)*3+d],lead.pad.position.toArray()[d],2e-7,'package termination');}}
  }
  for(const mount of top.mounts){near(mount.object.position.z-mount.height/2,-.07,1e-15,'board mount foot');near(mount.object.position.z+mount.height/2,mount.back,1e-15,'case mount contact');}
  for(const pad of top.packagePads)near(pad.object.position.z-.0075,.04,1e-15,'package pad frame contact');
  for(const post of top.posts){near(post.position.z+.705,-.04,1e-14,'post/frame contact');near(post.position.z-.705,-1.45,1e-14,'post/board contact');}
  assert.ok(top.squarePart.position.z-.04>-1.45,'moving square clears board');
  for(const connection of top.connections){const p=connection.object.geometry.attributes.position,a=local(connection.pad.object,[0,0,0]);near(p.getX(0),a.x,2e-7);near(p.getY(0),a.y,2e-7);near(p.getZ(0),a.z,2e-7);assert.equal(connection.object.userData.net,connection.net);}
  model.root.traverse(o=>{if(!o.geometry)return;for(let a=o;a;a=a.parent)if(!a.visible)return;const p=o.geometry.attributes.position,n=Math.min(p.count,o.geometry.drawRange.count);for(let i=0;i<n;i++){const v=local(o,[p.getX(i),p.getY(i),p.getZ(i)]);assert.ok(v.toArray().every(Number.isFinite));assert.ok(model.framingBounds.clone().expandByScalar(1e-6).containsPoint(v),'framing '+o.name+' '+v.toArray());}});geometryPoses++;
}
function history(){
  const s=model.getState();for(const h of top.histories){const n=h.geometry.drawRange.count;assert.equal(n,s.elapsed>0?Math.floor(s.elapsed/C.traceStep+1e-9)+1+(s.elapsed%C.traceStep>1e-15&&Math.abs(s.elapsed/C.traceStep-Math.round(s.elapsed/C.traceStep))>1e-9?1:0):0);
    for(let i=0;i<n;i+=Math.max(1,Math.floor(n/31))){assert.ok(h.times[i]<=s.elapsed+1e-15);const r=sampleCrashSensor(s.values,h.times[i]),p=h.transform(r);p.forEach((v,j)=>near(h.positions[i*3+j],v,3e-7,'retained actual prefix'));if(h.dashed&&i>0)assert.ok(h.distances[i]>=h.distances[i-1]);}
    if(n){near(h.times[n-1],s.elapsed,1e-14,'fractional last time');h.transform(s).forEach((v,j)=>near(h.positions[(n-1)*3+j],v,3e-7,'fractional endpoint'));}
  }assert.equal(top.unavailable.visible,!s.signalAvailable);for(const h of [top.signalRecord.first,top.signalRecord.other])assert.equal(h.object.visible,s.signalAvailable);historyPoses++;
}
for(const values of [{},{deceleration:-20,pulseDuration:.001,damping:.25},{deceleration:0},{supply:0}]){model.reset();model.update({...model.defaults,...values});for(let i=1;i<=7;i++){model.actions[i].run();geometry();history();}}
for(const q of [-C.genericRelativeBound,-C.relativeBound,0,C.relativeBound,C.genericRelativeBound]){top.setDisplacementForCheck(q);geometry(q);}model.update({});near(top.squarePart.position.z,model.getState().relative*1e6,1e-13,'normal render restores diagnostic span');
model.reset();for(const dt of [.03123,.07311,.00017,.10001,.2134]){model.advance(dt);history();}
const before=model.getState();for(const action of model.actions.slice(8,13)){action.run();assert.deepEqual(model.getState(),before,'inspection preserves state');}
const early=model.actions.find(a=>a.label==='Inspect early signal (0–5 ms)'),full=model.actions.find(a=>a.label==='Inspect the signal record');
model.actions[7].run();const finalState=model.getState();early.run();assert.deepEqual(model.getState(),finalState);near(top.recordDuration,.005,0);for(const h of top.histories){assert.equal(h.marker.visible,false);assert.ok(h.marker.position.x>=-2.18-1e-10&&h.marker.position.x<=2.72+1e-10,'hidden marker cannot inflate active-window selection');const n=h.geometry.drawRange.count;near(h.times[n-1],.005,1e-15);for(let i=0;i<n;i++)assert.ok(h.times[i]<=.005+1e-15);}
for(const p of [top.accelerationRecord,top.displacementRecord,top.signalRecord,top.frameRecord])assert.ok(p.tickLabels.every(t=>t.early.visible&&!t.full.visible));full.run();assert.deepEqual(model.getState(),finalState);near(top.recordDuration,.025,0);history();
model.reset();model.advance(.6);const shortState=model.getState();early.run();assert.deepEqual(model.getState(),shortState);assert.ok(top.histories.every(h=>h.marker.visible));full.run();history();early.run();model.update({deceleration:10});near(top.recordDuration,.025,0);assert.equal(model.getState().elapsed,0);
model.actions[2].run();history();model.update({supply:0});assert.equal(model.getState().elapsed,0);assert.equal(model.getState().latched,false);history();model.playback.step();near(model.getState().elapsed,.00025,1e-15);model.advance(20);assert.equal(model.playback.complete(),true);assert.notEqual(model.getState().frameVelocityChange,0);model.actions[0].run();assert.equal(model.getState().values.supply,0);assert.equal(model.playback.complete(),false);model.reset();assert.deepEqual(model.getState().values,model.defaults);
for(let i=0;i<ids.length;i++)assert.deepEqual([top.histories[i].geometry,top.histories[i].positions,top.histories[i].times,top.histories[i].exact,top.histories[i].distances],ids[i]);
const resources=new Set(top.textures);model.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);if(m.gradientMap)resources.add(m.gradientMap);}});const disposed=new Map();for(const r of resources){disposed.set(r,0);r.addEventListener('dispose',()=>disposed.set(r,disposed.get(r)+1));}model.dispose();model.dispose();for(const n of disposed.values())assert.equal(n,1,'exactly-once disposal');
const mechanics=createCrashSensorModel({mechanicsLesson:true});
assert.equal(mechanics.getState().readings.length,37,'mechanical lesson adds force sum and relative acceleration');
assert.deepEqual(mechanics.getState().readings.slice(0,6).map(r=>r.label),['Your result','Observation time','Square relative displacement','Square relative velocity','Relative acceleration','Relative force sum']);
assert.equal(mechanics.actions.length,16);assert.equal(mechanics.resultPart.id,'displacement-record');
const displacementActions=mechanics.actions.filter(a=>a.label.startsWith('Inspect displacement record'));
assert.equal(displacementActions.length,2);
for(const [i,action] of displacementActions.entries()){
  mechanics.actions[2].run();const held=mechanics.getState();action.run();assert.deepEqual(mechanics.getState(),held);
  assert.equal(action.part,'displacement-record');assert.equal(action.view,'front');assert.equal(action.isolate,true);assert.equal(action.replay,false);
  near(mechanics.topology.recordDuration,i===0?.005:.025,0);mechanics.actions[4].run();near(mechanics.topology.recordDuration,i===0?.005:.025,0,'stage keeps mechanical chart window');
  const state=mechanics.getState();near(state.relative,sampleCrashSensor(state.values,state.elapsed).relative,0,'presentation preserves solver');
}
mechanics.dispose();
console.log(JSON.stringify({status:'PASS',tuples:tuples.length,numericalSamples:samples,independentReference:'16-point composite Gaussian convolution of analytical oscillator/filter impulses',maxQError:maxQ,maxVelocityError:maxV,maxFilterError:maxZ,latchedTuples:latchedCount,geometryPoses,historyPoses,persistentHistories:top.histories.length,resourcesDisposed:resources.size,mechanicalPresentation:true,elapsedSeconds:(performance.now()-started)/1000,note:'Physical numerical and actual mesh checks; real Canvas2D raster and native readability are separate worker/root checks.'},null,2));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {autopilotConstants as C,autopilotController,sampleAutopilot,createAutopilotModel} from './autopilot-model.js';

const started=performance.now(),RAD=Math.PI/180,DEG=180/Math.PI;
const near=(actual,expected,tolerance=1e-9,context='value')=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${context}: ${actual} versus ${expected}, tolerance ${tolerance}`);
const stages=[0,.15,1,3,10,20,30],tuples=[];
for(const headingError of [-10,-5,0,5,10])for(const heightError of [-20,-10,0,10,20])for(const crosswind of [-5,0,5])for(const feedback of [0,1])tuples.push({headingError,heightError,crosswind,feedback});
// Independent ordering: actuator, roll rate, bank, heading, actuator, pitch rate,
// pitch, flight path, relative altitude, east, north. No production numerical helper.
function rhs(y,on,wind){
  const [a,p,b,psi,e,q,theta,gamma,h]=y;
  const requestA=on?-(psi+b+.8*p):0,requestE=on?-(.002*h+theta+.8*q):0;
  return [(requestA-a)/.15,4*a-2*p,p,9.80665*Math.tan(b)/50,(requestE-e)/.15,4*e-2*q,q,(theta-gamma)/2,50*Math.sin(gamma),50*Math.cos(gamma)*Math.sin(psi)+wind,50*Math.cos(gamma)*Math.cos(psi)];
}
function step(y,h,on,wind){const a=rhs(y,on,wind),b=rhs(y.map((v,j)=>v+h*a[j]/2),on,wind),c=rhs(y.map((v,j)=>v+h*b[j]/2),on,wind),d=rhs(y.map((v,j)=>v+h*c[j]),on,wind);return y.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);}
const order=['aileronRad','bankRateRadPerS','bankRad','headingRad','elevatorRad','pitchRateRadPerS','pitchRad','flightPathRad','heightM','eastM','northM'];
const maxError=Array(11).fill(0);let numericalSamples=0;
// Fifty independent trajectories; each checked at all three winds using exact
// kinematic advection, which is separately verified below. All150 tuples covered.
for(const headingError of [-10,-5,0,5,10])for(const heightError of [-20,-10,0,10,20])for(const feedback of [0,1]){
  let y=[0,0,0,headingError*RAD,0,0,0,0,heightError,0,0],time=0;
  for(const target of stages){
    while(time<target-1e-12){const h=Math.min(.001,target-time);y=step(y,h,feedback,0);time+=h;}
    for(const crosswind of [-5,0,5]){
      const v={headingError,heightError,crosswind,feedback},s=sampleAutopilot(v,target),expected=y.slice();expected[9]+=crosswind*target;
      order.forEach((key,j)=>{maxError[j]=Math.max(maxError[j],Math.abs(s[key]-expected[j]));near(s[key],expected[j],j>=8?1e-6:1e-8,key);});
      near(s.aileronCommandRad,feedback?-y[3]-y[2]-.8*y[1]:0,1e-8,'aileron command');near(s.elevatorCommandRad,feedback?-.002*y[8]-y[6]-.8*y[5]:0,1e-8,'elevator command');
      near(s.eastSpeedMPerS,50*Math.cos(y[7])*Math.sin(y[3])+crosswind,1e-7,'east speed');near(s.groundTrackRad,Math.atan2(s.eastSpeedMPerS,s.northSpeedMPerS),1e-12,'ground track');
      assert.ok(Math.abs(s.aileronRad*DEG)<12&&Math.abs(s.aileronCommandRad*DEG)<12&&Math.abs(s.elevatorRad*DEG)<3&&Math.abs(s.elevatorCommandRad*DEG)<3);
      assert.ok(Math.abs(s.eastM)<450&&s.northM>=0&&s.northM<=1500+1e-7);numericalSamples++;
    }
  }
}
for(const v of tuples){
  const a=sampleAutopilot(v,.32741),b=sampleAutopilot(v,27.123),again=sampleAutopilot(v,.32741);assert.deepEqual(a,again);
  if(!v.feedback){near(a.headingRad,v.headingError*RAD,0);near(b.heightM,v.heightError,0);near(b.eastM,(50*Math.sin(v.headingError*RAD)+v.crosswind)*27.123,1e-6);assert.equal(b.bankCommandRad,null);assert.equal(b.pitchCommandRad,null);}
  assert.equal(a.values.feedback,v.feedback);
}
const baseline=sampleAutopilot({},30),early=sampleAutopilot({},.15),three=sampleAutopilot({},3);
near(baseline.eastM,44.215614896,1e-7);near(baseline.heightM,.109792590986,1e-8);assert.ok(baseline.verticalSpeedMPerS<-.03&&baseline.aileronRad!==0);
assert.ok(early.aileronRad<0&&Math.abs(early.aileronRad)<Math.abs(sampleAutopilot({},0).aileronCommandRad));
assert.ok(three.aileronRad>0&&three.bankRad<0&&three.bankRateRadPerS>0,'Right-roll control reduces existing left bank');
assert.ok(Math.abs(early.pitchRad)>Math.abs(early.flightPathRad));
for(const t of [0,.0001,.15,3,13.123,30]){
  const calm=sampleAutopilot({},t),wind=sampleAutopilot({crosswind:5},t),reflected=sampleAutopilot({headingError:-10,heightError:-20},t);
  near(wind.eastM-calm.eastM,5*t,1e-7);near(wind.northM,calm.northM,1e-8);
  for(const key of ['headingRad','bankRad','aileronRad','heightM','pitchRad','elevatorRad','flightPathRad']){near(wind[key],calm[key],1e-12);near(reflected[key],-calm[key],1e-12);}
  near(reflected.northM,calm.northM,1e-8);
}
const quiet=sampleAutopilot({headingError:0,heightError:0,crosswind:5},30);near(quiet.eastM,150,1e-7);near(quiet.northM,1500,1e-7);near(quiet.groundTrackRad,Math.atan(.1),1e-12);assert.equal(quiet.aileronRad,0);
assert.equal(sampleAutopilot({heightError:0},3).elevatorRad,0);assert.equal(sampleAutopilot({headingError:0},3).aileronRad,0);
const measurement={heading:.2,bank:-.1,bankRate:.3,height:12,pitch:.1,pitchRate:-.2};
const command=autopilotController(measurement,1);near(command.aileronCommandRad,-.34,1e-14);near(command.elevatorCommandRad,.036,1e-14);
for(const key of Object.keys(measurement)){const changed=autopilotController({...measurement,[key]:measurement[key]+.01},1);assert.notDeepEqual(changed,command);}
assert.deepEqual(autopilotController(measurement,0),{bankCommandRad:null,pitchCommandRad:null,aileronCommandRad:0,elevatorCommandRad:0});
for(const key of ['time','wind','eastM','northM','truth','headingError'])assert.throws(()=>autopilotController({...measurement,[key]:999},1));
for(const time of [-1,30.00001,NaN,Infinity])assert.throws(()=>sampleAutopilot({},time));
for(const v of [{headingError:2},{heightError:NaN},{crosswind:1},{feedback:.5},{wind:0}])assert.throws(()=>sampleAutopilot(v,0));
const returned=sampleAutopilot({},3);returned.values.feedback=0;returned.measurements.heading=99;assert.equal(sampleAutopilot({},3).values.feedback,1);assert.notEqual(sampleAutopilot({},3).measurements.heading,99);

const model=createAutopilotModel(),T=model.topology;
assert.equal(model.parts.length,18);assert.equal(model.covers.length,0);assert.equal(model.controls.find(c=>c.key==='feedback').options.length,2);
const expectedLabels=['Heading error','Height error','Commanded bank','Actual aileron','Actual elevator','Ground track','Observation time','Observation progress'];
for(const label of expectedLabels)assert.ok(model.getState().readings.some(r=>r.label===label),label);
const partIds=new Set(model.parts.map(p=>p.id));for(const action of model.actions)if(action.part)assert.ok(partIds.has(action.part));
assert.equal(model.actions.find(a=>a.part==='aircraft').view,'iso','Aircraft inspection restores its angle without clearing selection');
assert.equal(model.initialPart,'aircraft');assert.equal(model.initialIsolated,true);assert.equal(model.actions.length,7);
assert.equal(model.getState().readings.length,29);assert.ok(model.getState().readings.every(r=>r.hint));
assert.ok(T.labels.every(l=>l.userData.labelText&&l.geometry.attributes.position.count===4));
const resourceIds=T.histories.map(h=>[h.geometry.uuid,h.positions,h.times,h.exact,h.distances]);
const localPoint=(object,p)=>object.localToWorld(new THREE.Vector3(...p));
function validateHistory(){
  const s=model.getState();
  for(const h of T.histories){
    const count=h.geometry.drawRange.count;assert.ok(count<=h.capacity);assert.equal(count===0,s.elapsed===0);
    for(let i=0;i<count;i++){
      assert.ok(h.times[i]<=s.elapsed+1e-12);if(i)assert.ok(h.times[i]>h.times[i-1]);
      const point=h.transform(sampleAutopilot(s.values,h.times[i]));point.forEach((v,j)=>near(h.positions[i*3+j],v,2e-6,'retained actual vertex'));
      if(h.dashed&&i){near(h.distances[i]-h.distances[i-1],Math.hypot(...point.map((v,j)=>v-h.exact[(i-1)*3+j])),1e-10,'cumulative dash length');near(h.geometry.attributes.lineDistance.array[i],h.distances[i],2e-5);}
    }
    if(s.elapsed>0)near(h.times[count-1],s.elapsed,1e-12,'exact current endpoint');
  }
}
let geometryPoses=0;
function validateGeometry(){
  model.root.updateMatrixWorld(true);const s=model.getState();
  const aircraftInverse=T.aircraft.matrixWorld.clone().invert(),fwd=localPoint(T.bank,[0,0,-1]).applyMatrix4(aircraftInverse),right=localPoint(T.bank,[1,0,0]).applyMatrix4(aircraftInverse);
  near(fwd.x,Math.sin(s.headingRad)*Math.cos(s.pitchRad));near(fwd.y,Math.sin(s.pitchRad));near(fwd.z,-Math.cos(s.headingRad)*Math.cos(s.pitchRad));near(right.y,-Math.cos(s.pitchRad)*Math.sin(s.bankRad));
  for(const h of T.hinges){
    near(h.group.rotation.x,-h.side*s.aileronRad,0);near(h.servo.rotor.rotation.x,h.group.rotation.x,0);
    const endpoint=localPoint(h.group,[h.side*.85,0,.69]).applyMatrix4(T.bank.matrixWorld.clone().invert());near(endpoint.y,h.side*Math.sin(s.aileronRad)*.69,1e-12,'actual trailing edge');
  }
  near(T.elevatorGroup.rotation.x,-s.elevatorRad,0);near(T.elevatorServo.rotor.rotation.x,-s.elevatorRad,0);
  near(T.mapMarker.position.x,s.eastM*C.mapScale,1e-12);near(T.mapMarker.position.y,s.northM*C.mapScale,1e-12);near(T.mapMarker.rotation.z,-s.headingRad,0);
  const d=T.airDirection.geometry.attributes.position;near(d.getX(1),1.5*Math.cos(s.flightPathRad)*Math.sin(s.headingRad),1e-7);near(d.getY(1),1.5*Math.sin(s.flightPathRad),1e-7);assert.equal(d.count,6,'shaft and arrowhead');
  for(const g of T.gauges){assert.equal(g.group.visible,s[g.first]!==null);if(g.group.visible)near(g.actual.position.x,s[g.first]*(g.first.endsWith('Rad')?DEG:1)*g.width/(2*g.max),1e-12);}
  model.root.traverse(object=>{
    if(!object.geometry)return;
    for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return;
    const p=object.geometry.attributes.position;if(!p)return;const count=Math.min(p.count,object.geometry.drawRange.count===Infinity?p.count:object.geometry.drawRange.count);
    for(let i=0;i<count;i++){const v=localPoint(object,[p.getX(i),p.getY(i),p.getZ(i)]);assert.ok(v.toArray().every(Number.isFinite));assert.ok(model.framingBounds.clone().expandByScalar(1e-6).containsPoint(v),'actual geometry inside framing: '+object.name+' '+v.toArray());}
  });
  geometryPoses++;
}
for(const values of [{},{headingError:-10,heightError:-20,crosswind:-5},{headingError:0,heightError:0,crosswind:5},{feedback:0}]){
  model.reset();model.update({...model.defaults,...values});
  for(let i=0;i<stages.length;i++){if(i)model.actions[1].run();near(model.getState().elapsed,stages[i],1e-12);validateGeometry();validateHistory();}
  model.actions[1].run();assert.equal(model.getState().elapsed,0,'stage after completion wraps to the start');
}
// Irregular updates exercise fraction restoration, then backward stage seeks and fresh controls.
model.reset();for(const dt of [.0047,.0123,.0031,.061,.7001,.0079,.2173]){model.advance(dt);validateHistory();}
const before=model.getState();for(const action of model.actions.slice(2)){action.run();assert.deepEqual(model.getState(),before,'Inspection preserves state');assert.equal(action.isolate,true);}
model.actions[0].run();model.actions[1].run();validateHistory();model.update({crosswind:5});assert.equal(model.getState().elapsed,0);validateHistory();
model.playback.step();near(model.getState().elapsed,.3,1e-12);model.advance(100);assert.equal(model.getState().elapsed,30);assert.equal(model.playback.complete(),true);assert.notEqual(model.getState().verticalSpeedMPerS,0);
assert.equal(model.getState().readings.find(r=>r.label==='Heading error').value,'0.0017 °','tiny residual remains visible instead of rounding to zero');
model.actions[0].run();assert.equal(model.getState().elapsed,0);assert.equal(model.getState().values.crosswind,5);assert.equal(model.playback.complete(),false);model.reset();assert.deepEqual(model.getState().values,model.defaults);
T.histories.forEach((h,i)=>assert.deepEqual([h.geometry.uuid,h.positions,h.times,h.exact,h.distances],resourceIds[i]));
// Actual shaft/encoder geometry. All axes must remain coaxial even at finite deflection.
for(const srv of T.servos){
  assert.ok(srv.shaftStart<srv.sign*.16&&srv.shaftEnd>srv.sign*.16,'rotor collar lies on actual shaft');
  for(const theta of [-12,-3,0,3,12].map(x=>x*RAD)){
    srv.rotor.rotation.x=theta;model.root.updateMatrixWorld(true);
    const inverse=srv.holder.matrixWorld.clone().invert(),axis=localPoint(srv.shaft,[0,1,0]).sub(localPoint(srv.shaft,[0,0,0])).transformDirection(inverse);near(Math.abs(axis.x),1,1e-12);
    const marker=srv.marker.geometry.attributes.position;
    for(let i=0;i<marker.count;i++){const v=localPoint(srv.marker,[marker.getX(i),marker.getY(i),marker.getZ(i)]).applyMatrix4(inverse);assert.ok(Math.hypot(v.y,v.z)<.075-1e-5,'pointer clears encoder bore');assert.ok(Math.abs(v.x)>.2325,'pointer plane clears encoder face');}
  }
}
model.reset();model.root.updateMatrixWorld(true);
for(const h of T.hinges)for(const angle of [-12,0,12].map(v=>v*RAD)){
  h.group.rotation.x=angle;model.root.updateMatrixWorld(true);const inverse=T.bank.matrixWorld.clone().invert(),p=h.surface.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const v=localPoint(h.surface,[p.getX(i),p.getY(i),p.getZ(i)]).applyMatrix4(inverse);assert.ok(v.z>.45+.15,'aileron clears fixed wing trailing edge');}
}
// Rotation about span leaves these exact axial clearances invariant, including
// the full rounded plate thickness. The outboard bearings cannot enter the plate.
model.reset();model.root.updateMatrixWorld(true);
for(const side of [-1,1]){
  const bearing=T.supports.find(o=>o.geometry?.type==='ExtrudeGeometry'&&Math.abs(o.position.x-side*1.48)<1e-12&&o.position.y===.42);
  assert.ok(bearing,'outboard supported elevator bearing');
  const plate=T.elevatorSurfaces[side<0?0:1],inv=T.bank.matrixWorld.clone().invert();
  const span=o=>{const p=o.geometry.attributes.position,values=[];for(let i=0;i<p.count;i++)values.push(localPoint(o,[p.getX(i),p.getY(i),p.getZ(i)]).applyMatrix4(inv).x);return [Math.min(...values),Math.max(...values)];};
  const a=span(plate),b=span(bearing);assert.ok(side>0?b[0]-a[1]>.04:a[0]-b[1]>.04,'actual elevator/bearing axial clearance');
}
for(const srv of T.servos){
  assert.equal(srv.encoderMount.parent,srv.holder,'encoder support fixed to case, not rotor');
  const p=srv.encoderMount.geometry.attributes.position,inv=srv.holder.matrixWorld.clone().invert();
  for(let i=0;i<p.count;i++){const v=localPoint(srv.encoderMount,[p.getX(i),p.getY(i),p.getZ(i)]).applyMatrix4(inv);assert.ok(Math.hypot(v.y,v.z)>.09,'stator mount clears complete rotating collar/pointer envelope');}
}
for(const w of T.wires){assert.equal(w.object.geometry.attributes.position.count,w.points.length);w.points.forEach((p,i)=>p.forEach((v,j)=>near(w.object.geometry.attributes.position.array[i*3+j],v,1e-7)));for(const endpoint of [w.points[0],w.points.at(-1)])assert.ok(T.terminals.some(t=>t.position.distanceTo(new THREE.Vector3(...endpoint))<1e-12),'signal route meets a terminal');}
const geometries=new Set(),materials=new Set(),disposed=new Map();model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
const resources=new Set([...geometries,...materials,...T.textures,...[...materials].map(m=>m.gradientMap).filter(Boolean)]);for(const r of resources){disposed.set(r,0);r.addEventListener('dispose',()=>disposed.set(r,disposed.get(r)+1));}
model.dispose();for(const [resource,count]of disposed)assert.equal(count,1,'exactly one resource disposal '+resource.type);
console.log(JSON.stringify({status:'PASS',tuples:tuples.length,numericalSamples,referenceTrajectories:50,maxStateError:Object.fromEntries(order.map((key,j)=>[key,maxError[j]])),geometryPoses,causalHistories:T.histories.length,resourcesDisposed:resources.size,elapsedSeconds:(performance.now()-started)/1000,note:'Node label quads are checked; real CanvasTexture glyph readability requires browser/native QA.'},null,2));

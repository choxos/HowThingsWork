import assert from 'node:assert/strict';
import {tally} from './model-check-kit.mjs';
import {VIBRATION as C,VIBRATION_DEFAULTS as D,VIBRATION_DOMAINS as domains,vibrationWeight,vibrationParameters,vibrationMotorPlan,createVibrationMotorController} from './vibration-motor-physics.js';
const t=tally();let analyticCases=0,weightCases=0;

// Independent polar midpoint quadrature verifies volume, centroid and inertia.
for(const grams of [.1,.3,.6])for(const mm of [1.5,2,2.5,3]){
 const shape=vibrationWeight(grams/1000,mm/1000),nr=128,na=256,dr=(shape.outer-shape.inner)/nr,da=Math.PI/na;
 let mass=0,mx=0,my=0,inertia=0;
 for(let i=0;i<nr;i++)for(let j=0;j<na;j++){
  const r=shape.inner+(i+.5)*dr,angle=-Math.PI/2+(j+.5)*da,dm=C.density*shape.thickness*r*dr*da;
  mass+=dm;mx+=dm*r*Math.cos(angle);my+=dm*r*Math.sin(angle);inertia+=dm*r*r;
 }
 t.near(mass,grams/1000,1e-15,'Mass from weight volume');
 t.near(mx/mass,mm/1000,2e-8,'Weight centroid from polar quadrature');
 t.near(my/mass,0,1e-17,'Weight is symmetric about its centerline');
 t.near(inertia,shape.inertia,1e-12,'Polar moment from quadrature');
 t.ok(shape.outer<.0075&&shape.thickness>0&&shape.inertia>shape.mass*shape.eccentricity**2,'Weight fits the declared radial envelope and has positive centroidal inertia');weightCases++;
}

// Exact exponential solution, independently composed across ideal switch times.
function exact(v,time){
 const p=vibrationParameters(v),inertia=v.mount===1?p.effectiveInertia:p.inertia;
 let omega=0,angle=0,start=0;
 for(const end of [Math.min(time,C.switchTime),time]){
  const duration=end-start;if(duration<=0)continue;
  const after=start>=C.switchTime,connected=Boolean(v.power)&&!(after&&v.program===1);
  const voltage=!v.power||after&&(v.program===1||v.program===2)?0:v.voltage*v.direction*(after&&v.program===3?-1:1);
  const rate=(C.rotorDrag+(connected?C.constant**2/C.resistance:0))/inertia;
  const terminal=connected?C.constant*voltage/(C.resistance*inertia*rate):0;
  angle+=terminal*duration+(omega-terminal)*(-Math.expm1(-rate*duration))/rate;
  omega=terminal+(omega-terminal)*Math.exp(-rate*duration);start=end;
 }
 return {omega,angle,p};
}

function energy(s){
 const p=s.parameters,v2=s.vx*s.vx+s.vy*s.vy;
 let result=s.values.bodyMass*.001*v2/2+C.rotorInertia*s.omega*s.omega/2;
 const central=p.weight.inertia-p.weight.mass*p.weight.eccentricity**2;
 for(let i=0;i<p.weights;i++){
  const angle=s.angle+i*Math.PI,wx=s.vx-s.omega*p.weight.eccentricity*Math.sin(angle),wy=s.vy+s.omega*p.weight.eccentricity*Math.cos(angle);
  result+=p.weight.mass*(wx*wx+wy*wy)/2+central*s.omega*s.omega/2;
 }
 return result+p.stiffness*(s.x*s.x+s.y*s.y)/2;
}
function laws(s){
 const p=s.parameters;
 t.near(s.energy,energy(s),1e-14,'Energy equals sum of body and weight energies');
 t.near(s.work,s.energy+s.copperLoss+s.rotorLoss+s.mountLoss,1e-8,'Source work accounts for stored energy and three losses');
 t.ok(s.energy>=-1e-15&&s.copperLoss>=0&&s.rotorLoss>=0&&s.mountLoss>=0,'Storage and dissipative losses are nonnegative');
 t.near(p.inertia*s.alpha+p.moment*(-Math.sin(s.angle)*s.ax+Math.cos(s.angle)*s.ay),C.constant*s.current-C.rotorDrag*s.omega,1e-15,'Rotor angular momentum balance');
 if(s.values.mount!==0){
  t.near(s.values.bodyMass*.001*s.ax,s.weightReaction.x+s.mountForce.x,1e-11,'Carriage x force balance');
  t.near(s.values.bodyMass*.001*s.ay,s.weightReaction.y+s.mountForce.y,1e-11,'Carriage y force balance');
 }
 t.near(s.current,s.connected?(s.voltage-s.backEmf)/C.resistance:0,1e-15,'Connected circuit voltage balance or open circuit');
 t.near(s.radialForce,p.moment*s.omega*s.omega,1e-15,'Radial unbalance law');
 t.ok(s.maxDisplacement+1e-9>=Math.hypot(s.x,s.y),'Record envelope contains the current carriage');
}

for(const mount of [0,1])for(const program of [0,1,2,3])for(const voltage of [0,.5,3,4.5])for(const direction of [-1,1])for(const balance of [0,1]){
 const values={...D,mount,program,voltage,direction,balance};
 for(const time of [0,.0000137,.0393375,.074999999,.075,.075000001,.1133333,.2]){
  const s=vibrationMotorPlan(values,time*C.slowdown),reference=exact(values,time),p=reference.p;
  t.near(s.omega,reference.omega,2e-7,'Speed follows independently composed exponential solution');
  t.near(s.angle,reference.angle,2e-9,'Angle follows integrated exponential solution');
  if(mount===1){
   t.near(s.x,p.moment/p.mass*(1-Math.cos(reference.angle)),2e-10,'Free horizontal center of mass remains fixed');
   t.near(s.y,-p.moment/p.mass*Math.sin(reference.angle),2e-10,'Free vertical-plane coordinate preserves center of mass');
   t.near(p.mass*s.vx-p.moment*s.omega*Math.sin(s.angle),0,1e-9,'Free x linear momentum');
   t.near(p.mass*s.vy+p.moment*s.omega*Math.cos(s.angle),0,1e-9,'Free y linear momentum');
  }else t.ok(s.x===0&&s.y===0&&s.ax===0&&s.ay===0,'Clamp keeps the housing fixed');
  if(balance)t.ok(s.radialForce===0&&s.x===0&&s.y===0,'Balanced pair rotates without translational excitation');
  laws(s);analyticCases++;
 }
}

const compliant=[];
for(const program of [0,1,2,3])for(const [voltage,mass,offset,bodyMass,stiffness,damping]of [[3,.3,2,50,2000,2],[4.5,.6,3,50,10000,.5],[1.5,.6,3,50,10000,.5],[.5,.1,1.5,200,500,5]]){
 const values={...D,mount:2,program,voltage,mass,offset,bodyMass,stiffness,damping},s=vibrationMotorPlan(values,20);
 for(const point of s.trace)laws({...point,values,parameters:s.parameters,maxDisplacement:s.maxDisplacement});
 compliant.push({values,rpm:s.rpm,residual:s.energyResidual,maximumDisplacement:s.maxDisplacement});
}
const coast=vibrationMotorPlan({program:1},20),brake=vibrationMotorPlan({program:2},20),reverse=vibrationMotorPlan({program:3},20);
t.ok(brake.omega>0&&brake.omega<coast.omega&&brake.copperLoss>coast.copperLoss,'Short-circuit braking removes rotor energy through winding resistance');
t.ok(reverse.omega<0&&reverse.current<0,'Reverse drive changes actual rotation direction');
t.near(coast.work,brake.work,1e-12,'Coasting and braking receive identical work before disconnection');
const low=vibrationMotorPlan({voltage:1.5},20),high=vibrationMotorPlan({voltage:3},20);
t.near(high.omega,2*low.omega,1e-9,'Linear clamped model gives twice the speed for twice the voltage');
t.near(high.radialForce,4*low.radialForce,1e-12,'Twice the instantaneous speed gives four times the radial force');

for(const [key,[lo,hi,step]]of Object.entries(domains))for(const invalid of [lo-step,hi+step,NaN,Infinity,'1']){
 assert.throws(()=>vibrationMotorPlan({[key]:invalid}));t.add();
}
assert.throws(()=>vibrationMotorPlan({unknown:1}));assert.throws(()=>vibrationMotorPlan({},-1));assert.throws(()=>vibrationMotorPlan({},Infinity));t.add(3);
const controller=createVibrationMotorController();controller.advance(8);const before=controller.getState();
for(const invalid of [{voltage:100},{mass:NaN},{noSuchControl:1}]){assert.throws(()=>controller.update(invalid));assert.deepEqual(controller.getState(),before);t.add(2);}
for(const invalid of [{time:-1},{settings:{offset:0}},{bad:true}]){assert.throws(()=>controller.reset(invalid));assert.deepEqual(controller.getState(),before);t.add(2);}
const copy=controller.getState();copy.values.voltage=0;copy.parameters.weight.mass=1;copy.trace[0].x=999;assert.deepEqual(controller.getState(),before);t.add();
controller.update({mount:2});t.ok(controller.getState().clock===0,'Changed controls start a new record');
controller.advance(30);t.ok(controller.getState().clock===20&&controller.getState().complete,'Record ends exactly');
const replay=controller.replayState();t.ok(replay.time===0&&replay.settings.mount===2,'Replay preserves settings and restarts from rest');
controller.reset({settings:{power:0}});controller.advance(20);t.ok(controller.getState().clock===0&&controller.getState().blocked&&controller.getState().omega===0,'Disconnected supply holds the unpowered trial');
console.log(`PASS vibration motor physics: ${t.count} checks, ${analyticCases} exact rigid/free samples, ${weightCases} weight quadratures, ${compliant.length} compliant trials`);
console.log(JSON.stringify({compliant}));

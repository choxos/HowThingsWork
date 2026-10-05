import {validateControls,validTime} from './physics-kit.js';

export const VIBRATION_DEFAULTS=Object.freeze({program:0,power:1,voltage:3,direction:1,balance:0,mass:.3,offset:2,mount:0,bodyMass:50,stiffness:2000,damping:2});
export const VIBRATION_DOMAINS=Object.freeze(Object.fromEntries(Object.entries({program:[0,3,1],power:[0,1,1],voltage:[0,4.5,.5],direction:[-1,1,2],balance:[0,1,1],mass:[.1,.6,.1],offset:[1.5,3,.5],mount:[0,2,1],bodyMass:[50,200,25],stiffness:[500,10000,500],damping:[.5,5,.5]}).map(([key,range])=>[key,Object.freeze(range)])));
// Assigned teaching parameters, not measurements of a commercial actuator.
export const VIBRATION=Object.freeze({resistance:20,constant:.002,rotorDrag:1e-7,rotorInertia:8e-9,innerRadius:.0008,density:15630,duration:.2,slowdown:100,switchTime:.075,step:.00002});
export const VIBRATION_DURATION=VIBRATION.duration*VIBRATION.slowdown;
const count=Math.round(VIBRATION.duration/VIBRATION.step),width=10,cache=new Map();
const controls=input=>validateControls(input,VIBRATION_DEFAULTS,VIBRATION_DOMAINS,'vibration motor');

/** Uniform half-annulus: solve its centroid for the requested eccentricity. */
export function vibrationWeight(mass,eccentricity){
  if(!Number.isFinite(mass)||mass<=0||!Number.isFinite(eccentricity)||eccentricity<=2*VIBRATION.innerRadius/Math.PI)throw new RangeError('Invalid eccentric weight');
  const inner=VIBRATION.innerRadius,a=3*Math.PI*eccentricity/4;
  const outer=(a-inner+Math.sqrt(a*a+2*a*inner-3*inner*inner))/2;
  const area=Math.PI*(outer*outer-inner*inner)/2;
  return {mass,eccentricity,inner,outer,thickness:mass/(VIBRATION.density*area),inertia:mass*(outer*outer+inner*inner)/2};
}

function parameters(values){
  const weight=vibrationWeight(values.mass*.001,values.offset*.001),weights=1+values.balance;
  const mass=values.bodyMass*.001+weights*weight.mass,inertia=VIBRATION.rotorInertia+weights*weight.inertia;
  const moment=values.balance?0:weight.mass*weight.eccentricity;
  const stiffness=values.mount===2?values.stiffness:0,damping=values.mount===2?values.damping:0;
  return {weight,weights,mass,inertia,moment,stiffness,damping,effectiveInertia:inertia-moment*moment/mass,naturalFrequency:Math.sqrt(stiffness/mass)/(2*Math.PI),dampingRatio:stiffness?damping/(2*Math.sqrt(stiffness*mass)):0};
}
export function vibrationParameters(input={}){return parameters(controls(input));}

function drive(values,time){
  if(!values.power)return {connected:false,voltage:0,circuit:'Supply disconnected'};
  const switched=time>=VIBRATION.switchTime;
  if(switched&&values.program===1)return {connected:false,voltage:0,circuit:'Open circuit: coasting'};
  if(switched&&values.program===2)return {connected:true,voltage:0,circuit:'Shorted terminals: braking'};
  const voltage=values.voltage*values.direction*(switched&&values.program===3?-1:1);
  return {connected:true,voltage,circuit:switched&&values.program===3?'Reverse drive':'Connected DC supply'};
}

function dynamics(values,p,state,supply){
  const [angle,omega,x,vx,y,vy]=state,sin=Math.sin(angle),cos=Math.cos(angle);
  const current=supply.connected?(supply.voltage-VIBRATION.constant*omega)/VIBRATION.resistance:0;
  const torque=VIBRATION.constant*current-VIBRATION.rotorDrag*omega;
  const rx=p.moment*cos*omega*omega-p.stiffness*x-p.damping*vx;
  const ry=p.moment*sin*omega*omega-p.stiffness*y-p.damping*vy;
  const alpha=values.mount===0?torque/p.inertia:(torque+p.moment*(sin*rx-cos*ry)/p.mass)/p.effectiveInertia;
  const ax=values.mount===0?0:(rx+p.moment*sin*alpha)/p.mass;
  const ay=values.mount===0?0:(ry-p.moment*cos*alpha)/p.mass;
  const excitation={x:p.moment*(cos*omega*omega+sin*alpha),y:p.moment*(sin*omega*omega-cos*alpha)};
  return {current,alpha,ax,ay,excitation,weightReaction:{x:excitation.x-p.weights*p.weight.mass*ax,y:excitation.y-p.weights*p.weight.mass*ay},mountForce:{x:-p.stiffness*x-p.damping*vx,y:-p.stiffness*y-p.damping*vy},electromagneticTorque:VIBRATION.constant*current,backEmf:VIBRATION.constant*omega};
}

function derivative(values,p,state,supply){
  const d=dynamics(values,p,state,supply),[,omega,,vx,,vy]=state;
  return [omega,d.alpha,vx,d.ax,vy,d.ay,supply.voltage*d.current,VIBRATION.resistance*d.current*d.current,VIBRATION.rotorDrag*omega*omega,p.damping*(vx*vx+vy*vy)];
}

function step(values,p,state,time,h){
  // The fixed grid contains the switching instant. All stages in this step
  // therefore use the same side of the ideal circuit discontinuity.
  const supply=drive(values,time+h/2),a=derivative(values,p,state,supply);
  const b=derivative(values,p,state.map((n,i)=>n+h*a[i]/2),supply);
  const c=derivative(values,p,state.map((n,i)=>n+h*b[i]/2),supply);
  const d=derivative(values,p,state.map((n,i)=>n+h*c[i]),supply);
  return state.map((n,i)=>n+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
}

function trajectory(values){
  const key=JSON.stringify(values);
  if(cache.has(key)){const found=cache.get(key);cache.delete(key);cache.set(key,found);return found;}
  const p=parameters(values),samples=new Float64Array((count+1)*width);
  let state=Array(width).fill(0),maxDisplacement=0,maxSpeed=0;
  for(let i=0;i<count;i++){
    state=step(values,p,state,i*VIBRATION.step,VIBRATION.step);samples.set(state,(i+1)*width);
    maxDisplacement=Math.max(maxDisplacement,Math.hypot(state[2],state[4]));maxSpeed=Math.max(maxSpeed,Math.abs(state[1]));
  }
  const result={p,samples,maxDisplacement,maxSpeed};cache.set(key,result);if(cache.size>8)cache.delete(cache.keys().next().value);return result;
}

function sample(values,record,time){
  const index=Math.min(count,Math.floor(time/VIBRATION.step+1e-9)),start=index*VIBRATION.step;
  let state=Array.from(record.samples.subarray(index*width,(index+1)*width));
  if(time-start>1e-12)state=step(values,record.p,state,start,time-start);
  const [angle,omega,x,vx,y,vy,work,copperLoss,rotorLoss,mountLoss]=state,p=record.p,supply=drive(values,time);
  const d=dynamics(values,p,state,supply),cross=p.moment*omega*(-vx*Math.sin(angle)+vy*Math.cos(angle));
  const kinetic=p.mass*(vx*vx+vy*vy)/2+p.inertia*omega*omega/2+cross,potential=p.stiffness*(x*x+y*y)/2;
  const loss=copperLoss+rotorLoss+mountLoss,energy=kinetic+potential;
  return {time,angle,omega,rpm:omega*60/(2*Math.PI),frequency:Math.abs(omega)/(2*Math.PI),x,y,vx,vy,...d,...supply,radialForce:p.moment*omega*omega,tangentialForce:-p.moment*d.alpha,kinetic,potential,energy,work,copperLoss,rotorLoss,mountLoss,loss,energyResidual:work-energy-loss};
}

export function vibrationMotorPlan(input={},sceneTime=0){
  const values=controls(input),clock=Math.min(validTime(sceneTime),VIBRATION_DURATION),time=Number((clock/VIBRATION.slowdown).toFixed(12));
  const record=trajectory(values),current=sample(values,record,time),recentStart=Math.max(0,time-.02);
  const trace=Array.from({length:201},(_,i)=>sample(values,record,time*i/200));
  const recent=Array.from({length:201},(_,i)=>sample(values,record,recentStart+(time-recentStart)*i/200));
  const complete=clock>=VIBRATION_DURATION,blocked=!values.power;
  const phase=blocked?'Supply disconnected':complete?'Record complete':clock===0?'Ready to start':current.circuit;
  const steadyOmega=values.voltage*values.direction*VIBRATION.constant/(VIBRATION.resistance*VIBRATION.rotorDrag+VIBRATION.constant*VIBRATION.constant);
  return {values,clock,complete:complete||blocked,blocked,phase,...current,parameters:{...record.p,weight:{...record.p.weight}},trace,recent,maxDisplacement:record.maxDisplacement,maxSpeed:record.maxSpeed,clampedSteadyOmega:steadyOmega,clampedSteadyRadialForce:record.p.moment*steadyOmega*steadyOmega};
}

export function createVibrationMotorController(initial={}){
  let values,clock,origin;
  function reset(next={}){
    if(!next||typeof next!=='object'||Array.isArray(next))throw new TypeError('Expected vibration motor initial state');
    for(const key of Object.keys(next))if(!['settings','time'].includes(key))throw new RangeError(`Unknown initial field ${key}`);
    const plan=vibrationMotorPlan(next.settings??{},next.time??0);
    values=plan.values;clock=plan.clock;origin={settings:{...values},time:0};return getState();
  }
  function update(changes={}){
    const next=validateControls(changes,values,VIBRATION_DOMAINS,'vibration motor');
    if(Object.keys(next).some(key=>next[key]!==values[key])){clock=0;origin={settings:{...next},time:0};}
    values=next;return getState();
  }
  function advance(dt){validTime(dt);if(values.power)clock=Math.min(VIBRATION_DURATION,Number((clock+dt).toFixed(12)));return getState();}
  function getState(){return vibrationMotorPlan(values,clock);}
  reset(initial);return {reset,update,advance,getState,replayState:()=>structuredClone(origin)};
}

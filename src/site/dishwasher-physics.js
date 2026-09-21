import {validateControls, validTime, clamp} from './physics-kit.js';

// SI mechanics; cycle volume in liters. This is an illustrative single-arm
// machine, not a calibrated appliance. Water and a 2.4 kg ceramic load share
// one temperature. Fill/drain include advected heat; the load retains heat.
// No cleanliness, evaporation rate, chemistry, or final dryness is predicted.
export const BEARINGS = Object.freeze([
  Object.freeze({value: 0, label: 'Smooth bearing', torque: .004}),
  Object.freeze({value: 1, label: 'Stiff bearing', torque: .02}),
  Object.freeze({value: 2, label: 'Blocked by a spoon', torque: Infinity}),
]);
export const WASHER = Object.freeze({
  density: 1000, tipRadius: .19, cleanRadii: [.06,.06,.12,.12,.17,.17], cleanDiameter: .0016,
  maxFlow: 40/60000, drag: .002, inertia: .0027, pumpEfficiency: .4,
  fill: 3, fillRate: 4/60, heater: 1800, loss: 8, room: 20, inlet: 15, specificHeat: 4186,
  loadMass: 2.4, loadSpecificHeat: 840, washTime: 900, rinseTime: 300, drainTime: 60,
  dryTime: 720, rinseBoost: 10, speedUp: 180,
});
export const WASHER_DEFAULTS = Object.freeze({pump:40,tilt:35,nozzle:2,bearing:0,temperature:55});
export const WASHER_DOMAINS = Object.freeze({pump:[20,60,5],tilt:[0,60,5],nozzle:[1.5,3,.5],bearing:[0,2,1],temperature:[45,70,5]});
const TAU=2*Math.PI, LOAD=WASHER.loadMass*WASHER.loadSpecificHeat, FULL=LOAD+WASHER.fill*WASHER.specificHeat;

/** Pump curve meets all eight ideal nozzles. Euler torque uses room-frame
 * tangential velocity, including the braking from the six upright jets.
 * Relative exit speed includes centrifugal pressure rise in the rotating arm. */
export function armAt(values,w) {
  const tipArea=Math.PI*(values.nozzle/2000)**2, cleanArea=Math.PI*(WASHER.cleanDiameter/2)**2;
  const list=[...Array.from({length:2},()=>({radius:WASHER.tipRadius,area:tipArea,sideways:Math.sin(values.tilt*Math.PI/180),tip:true})),...WASHER.cleanRadii.map(radius=>({radius,area:cleanArea,sideways:0,tip:false}))];
  const flowAt=p=>list.reduce((sum,n)=>sum+n.area*Math.sqrt(2*p/WASHER.density+(w*n.radius)**2),0), p0=values.pump*1000;
  let lo=0,hi=p0;
  for(let i=0;i<40;i++){const p=(lo+hi)/2;if(p>p0*(1-(flowAt(p)/WASHER.maxFlow)**2))hi=p;else lo=p;}
  const pressure=(lo+hi)/2;
  const jets=list.map(n=>{const speed=Math.sqrt(2*pressure/WASHER.density+(w*n.radius)**2),flow=n.area*speed;return {...n,speed,flow,backward:speed*n.sideways-w*n.radius,up:speed*Math.sqrt(1-n.sideways*n.sideways)};});
  const flow=jets.reduce((s,n)=>s+n.flow,0),jetTorque=jets.reduce((s,n)=>s+WASHER.density*n.flow*n.radius*n.backward,0);
  const bearing=BEARINGS[values.bearing].torque;
  const net=values.bearing===2?0:w>0?jetTorque-bearing-WASHER.drag*w:Math.max(0,jetTorque-bearing);
  return {pressure,flow,jetTorque,net,jets,tipSpeed:jets[0].speed,cleanSpeed:jets.at(-1).speed,cleanFlow:jets.at(-1).flow};
}

// Exact solutions of C dT/dt = inlet enthalpy + heater - room loss,
// with C(t)=load capacity + water mass times specific heat.
export function stageTemperature(stage,t) {
  t=clamp(t,0,stage.duration);
  const {loss:G,room:R,inlet:I,specificHeat:cp,fill,fillRate,heater:P,drainTime}=WASHER;
  if(stage.name==='fill'){
    const k=fillRate*cp,equilibrium=(k*I+G*R)/(k+G);
    return equilibrium+(stage.initialTemperature-equilibrium)*(LOAD/(LOAD+k*t))**(1+G/k);
  }
  if(stage.name==='drain'){
    const k=fill*cp/drainTime;
    return R+(stage.initialTemperature-R)*((FULL-k*t)/FULL)**(G/k);
  }
  if(stage.name==='heat'){const top=R+P/G;return top-(top-stage.initialTemperature)*Math.exp(-G*t/FULL);}
  if(stage.hold)return stage.hold;
  return R+(stage.initialTemperature-R)*Math.exp(-G*t/LOAD);
}

// One time history crosses pump transitions without changing angle or speed.
// The cycle is compressed 180x; rotational dynamics use playback seconds.
// Pump pressure is quasi-steady, so only the arm has rotational inertia.
function integrateArm(values,stages,steady) {
  const points=[{t:0,w:0,angle:0,pumpTime:0}];let w=0,angle=0,pumpTime=0;
  const friction=BEARINGS[values.bearing].torque;
  for(const stage of stages){
    const start=stage.start/WASHER.speedUp,end=(stage.start+stage.duration)/WASHER.speedUp;
    const steps=Math.max(1,Math.ceil((end-start)/.01)),dt=(end-start)/steps;
    const accel=x=>values.bearing===2?0:stage.pump?armAt(values,Math.max(0,x)).net/WASHER.inertia: x>0?-(friction+WASHER.drag*x)/WASHER.inertia:0;
    for(let i=1;i<=steps;i++){
      if(stage.pump){
        const a=accel(w),b=accel(w+dt*a/2),c=accel(w+dt*b/2),d=accel(w+dt*c);
        angle+=dt*(w+2*(w+dt*a/2)+2*(w+dt*b/2)+(w+dt*c))/6;
        w=clamp(w+dt*(a+2*b+2*c+d)/6,0,steady);pumpTime+=dt;
      }else if(w>0){
        // Exact Coulomb plus linear-drag coast, stopping within the step.
        const stop=WASHER.inertia/WASHER.drag*Math.log1p(WASHER.drag*w/friction),h=Math.min(dt,stop),offset=friction/WASHER.drag;
        angle+=(w+offset)*WASHER.inertia/WASHER.drag*(1-Math.exp(-WASHER.drag*h/WASHER.inertia))-offset*h;
        w=dt>=stop?0:(w+offset)*Math.exp(-WASHER.drag*h/WASHER.inertia)-offset;
      }
      points.push({t:start+i*dt,w,angle,pumpTime});
    }
  }
  return points;
}
const cache=new Map();
export function washerPlan(input={}) {
  const values=validateControls(input,WASHER_DEFAULTS,WASHER_DOMAINS,'dishwasher'),key=JSON.stringify(values);
  if(cache.has(key))return cache.get(key);
  const rest=armAt(values,0),bearing=BEARINGS[values.bearing].torque,stuck=rest.jetTorque<=bearing;
  let speed=0;
  if(!stuck){let lo=0,hi=100;for(let i=0;i<55;i++){const w=(lo+hi)/2;if(armAt(values,w).net>0)lo=w;else hi=w;}speed=(lo+hi)/2;}
  const run=armAt(values,speed),rinseTemperature=Math.min(75,values.temperature+WASHER.rinseBoost);
  const stages=[
    {name:'fill',label:'Filling through the softener',duration:WASHER.fill/WASHER.fillRate,pump:false},
    {name:'heat',label:'Heating the wash water and load',pump:true,target:values.temperature},
    {name:'wash',label:'Washing and filtering',duration:WASHER.washTime,pump:true,hold:values.temperature},
    {name:'drain',label:'Draining the wash water',duration:WASHER.drainTime,pump:false},
    {name:'fill',label:'Filling with fresh rinse water',duration:WASHER.fill/WASHER.fillRate,pump:false},
    {name:'heat',label:'Heating the rinse water and load',pump:true,target:rinseTemperature},
    {name:'rinse',label:'Rinsing and filtering',duration:WASHER.rinseTime,pump:true,hold:rinseTemperature},
    {name:'drain',label:'Draining the rinse water',duration:WASHER.drainTime,pump:false},
    {name:'dry',label:'Cooling during the drying phase',duration:WASHER.dryTime,pump:false},
  ];
  let clock=0,temperature=WASHER.room;
  for(const stage of stages){
    stage.initialTemperature=temperature;stage.start=clock;
    if(stage.name==='heat'){const top=WASHER.room+WASHER.heater/WASHER.loss;stage.duration=-FULL/WASHER.loss*Math.log((top-stage.target)/(top-temperature));}
    temperature=stageTemperature(stage,stage.duration);stage.endTemperature=temperature;clock+=stage.duration;
  }
  const pumpPower=run.pressure*run.flow/WASHER.pumpEfficiency;
  const pumpTime=stages.reduce((s,n)=>s+(n.pump?n.duration:0),0);
  const heaterEnergy=stages.reduce((s,n)=>s+(n.name==='heat'?WASHER.heater*n.duration:n.hold?WASHER.loss*(n.hold-WASHER.room)*n.duration:0),0);
  const motion=integrateArm(values,stages,speed),spin=motion.filter(p=>p.t>=stages[1].start/WASHER.speedUp&&p.t<=stages[3].start/WASHER.speedUp).map(p=>({t:p.t-stages[1].start/WASHER.speedUp,w:p.w}));
  const after=spin.findIndex(p=>p.w>=.9*speed),spinUp=speed>0&&after>0?spin[after-1].t+(spin[after].t-spin[after-1].t)*(.9*speed-spin[after-1].w)/(spin[after].w-spin[after-1].w):null;
  const plan={values,rest,run,speed,rpm:speed*60/TAU,stuck,stallTorque:rest.jetTorque,spin,spinUp,motion,stages,total:clock,pumpPower,pumpTime,heaterEnergy,energy:heaterEnergy+pumpPower*pumpTime,water:2*WASHER.fill,rinseTemperature,heatTime:stages[1].duration,tipAbsolute:{sideways:run.jets[0].backward,up:run.jets[0].up},cleanImpact:WASHER.density*run.cleanFlow*run.cleanSpeed};
  if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,plan);return plan;
}
export function sampleWasher(input={},time=0) {
  validTime(time);
  const plan=washerPlan(input),duration=plan.total/WASHER.speedUp,elapsed=Math.min(time,duration),clock=Math.min(plan.total,elapsed*WASHER.speedUp),complete=elapsed>=duration;
  let stageIndex=plan.stages.findIndex(s=>clock<s.start+s.duration);if(stageIndex<0)stageIndex=plan.stages.length-1;
  const stage=plan.stages[stageIndex],inStage=clamp(clock-stage.start,0,stage.duration),temperature=stageTemperature(stage,inStage);
  const stored=stage.name==='fill'?WASHER.fillRate*inStage:stage.name==='drain'?WASHER.fill*(1-inStage/stage.duration):stage.name==='dry'?0:WASHER.fill;
  let energyUsed=0,waterUsed=0,drained=0,pumpSeconds=0;
  for(const s of plan.stages){const t=clamp(clock-s.start,0,s.duration);if(s.name==='heat')energyUsed+=WASHER.heater*t;if(s.hold)energyUsed+=WASHER.loss*(s.hold-WASHER.room)*t;if(s.pump)pumpSeconds+=t;if(s.name==='fill')waterUsed+=WASHER.fillRate*t;if(s.name==='drain')drained+=WASHER.fill*t/s.duration;}
  energyUsed+=plan.pumpPower*pumpSeconds;
  const points=plan.motion;let lo=0,hi=points.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(points[mid].t<=elapsed)lo=mid;else hi=mid;}
  const a=points[lo],b=points[hi],f=clamp((elapsed-a.t)/(b.t-a.t)),lerp=key=>a[key]+(b[key]-a[key])*f;
  const armSpeed=lerp('w'),pumping=stage.pump&&!complete,operating=pumping?armAt(plan.values,armSpeed):null;
  return {...plan,elapsed,duration,clock,complete,stage:stage.name,stageLabel:stage.label,stageIndex,inStage,temperature,stored,waterUsed,drained,pumping,spinning:armSpeed>1e-8,armSpeed,armAngle:lerp('angle'),impellerAngle:lerp('pumpTime')*TAU*2,operating,energyUsed,recirculated:plan.run.flow*pumpSeconds*1000,remaining:Math.max(0,plan.total-clock)};
}

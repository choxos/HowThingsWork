import {validateControls, validTime} from './physics-kit.js';

export const BURGLAR_DEFAULTS=Object.freeze({mode:0,path:0,speed:1,range:5,span:30,hold:50,contrast:4,warming:0,balance:0,power:1,sound:0,pace:1});
export const BURGLAR_DOMAINS=Object.freeze({mode:[0,2,1],path:[0,3,1],speed:[0,6,.1],range:[1,10,.5],span:[5,30,1],hold:[50,500,50],contrast:[0,12,.5],warming:[0,30,1],balance:[0,10,1],power:[0,1,1],sound:[0,1,1],pace:[.25,1,.25]});
export const BURGLAR_SCIENCE=Object.freeze({c:299792458,h:6.62607015e-34,k:1.380649e-23,sigma:5.670374419e-8,
  carrier:24.125e9,referenceRange:5,radarThreshold:.08,radarHighPass:2,radarLowPass:1000,radarEnvelope:.01,radarStep:1/16000,
  fixedI:.6,fixedQ:.2,confirmation:.05,delay:.5,supply:12,radarSupply:3.3,beamSupply:5,pirSupply:10,
  beamIntensity:.17,beamResponse:60e-6/10,beamThreshold:.3e-9,pulseCurrent:.1,pulseWidth:100e-6,pulseRate:1000,
  targetWidth:.25,targetHeight:.7,roomKelvin:298.15,emissivity:.98,
  focal:.0125,elementWidth:.001,elementHeight:.002,elementGap:.001,pupilArea:1e-6,
  bandLow:5e-6,bandHigh:14e-6,thermal:.1,electrical:1,responsivity:4200,pirThreshold:100e-6,pirStep:.001,pirDuration:12});
export const BURGLAR_LENSLETS=Object.freeze([-.008,-.004,0,.004,.008]);
const C=BURGLAR_SCIENCE,TAU=2*Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const BURGLAR_WAVELENGTH=C.c/C.carrier;

function settings(input){
  const v=validateControls(input,BURGLAR_DEFAULTS,BURGLAR_DOMAINS,'burglar alarm');
  if(![50,100,250,500].includes(v.hold))throw new RangeError('Unsupported interruption setting');
  if(![0,1,10].includes(v.balance))throw new RangeError('Unsupported element mismatch');
  if(![.25,.5,1].includes(v.pace))throw new RangeError('Unsupported playback pace');
  return v;
}

/** A finite prescribed path. Position is an experiment input, never a CW range measurement. */
export function burglarMotion(v,time){
  validTime(time);
  let length,startX=0,startZ=v.range,endX=0,endZ=v.range;
  const arc=Math.atan2(2,v.range);
  if(v.mode===0){
    length=v.path<2?2:v.path===2?4:2*arc*v.range;
    if(v.path===0){startZ=v.range+2;endZ=v.range;}
    if(v.path===1)endZ=v.range+2;
    if(v.path===2){startX=-2;endX=2;}
  }else if(v.mode===1){length=1;startX=-.5;endX=.5;startZ=endZ=0;}
  else{startX=-(v.range*.76+.008+C.targetWidth/2+.15);endX=-startX;length=endX-startX;}
  const travel=v.speed>0?length/v.speed:0,stop=v.speed>0?C.delay+travel:null;
  const duration=v.mode===2?C.pirDuration:v.speed>0?stop+1.5:4;
  const fraction=v.speed>0?clamp((time-C.delay)/travel,0,1):0;
  const moving=v.speed>0&&time>=C.delay&&time<stop;
  let x=startX+(endX-startX)*fraction,z=startZ+(endZ-startZ)*fraction,vx=0,vz=0;
  if(v.mode===0&&v.path===3){
    const angle=-arc+2*arc*fraction;x=v.range*Math.sin(angle);z=v.range*Math.cos(angle);
    if(moving){vx=v.speed*Math.cos(angle);vz=-v.speed*Math.sin(angle);}
  }else if(moving){vx=(endX-startX)/length*v.speed;vz=(endZ-startZ)/length*v.speed;}
  if(!v.speed){x=v.mode===1?0:v.mode===2?v.range*.08:0;z=v.mode===1?0:v.range;}
  const distance=v.mode===0&&v.path===3?v.range:Math.hypot(x,z),radial=v.mode===0&&v.path===3?0:distance>0?(x*vx+z*vz)/distance:0;
  return {x,z,vx,vz,distance,radial,moving,stop,duration,length,fraction,speed:moving?v.speed:0};
}

/** Homodyne I/Q after ideal RF mixing and removal of the sum-frequency term. */
export function burglarRadar(v,time){
  const motion=burglarMotion(v,time),amplitude=v.power?(C.referenceRange/motion.distance)**2:0;
  // A constant-radius point reflector has exactly constant path length.
  const distance=v.path===3||v.speed===0?v.range:motion.distance;
  const phase=-4*Math.PI*distance/BURGLAR_WAVELENGTH;
  const doppler=v.power?-2*motion.radial/BURGLAR_WAVELENGTH:0;
  return {...motion,phase,amplitude,doppler,i:amplitude*Math.cos(phase)+(v.power?C.fixedI:0),q:amplitude*Math.sin(phase)+(v.power?C.fixedQ:0)};
}

/** Exact first-order response to a linearly interpolated input over dt. */
export function burglarLag(state,p,q,dt,tau){
  if(dt===0)return state;
  const a=-Math.expm1(-dt/tau),r=dt/tau;
  const ramp=r<1e-4?r/2-r*r/6+r*r*r/24:1-a/r;
  return state+(p-state)*a+(q-p)*ramp;
}

export function burglarBandGain(frequency,thermal=C.thermal,electrical=C.electrical){
  const w=TAU*frequency;return w*electrical/Math.hypot(1,w*electrical)/Math.hypot(1,w*thermal);
}
const pirGain=C.responsivity/burglarBandGain(1)*C.electrical/(C.electrical-C.thermal);
const radarFast=1/(TAU*C.radarLowPass),radarSlow=1/(TAU*C.radarHighPass),radarGain=radarSlow/(radarSlow-radarFast);

/** Black-body exitance below lambda, computed by the convergent Planck series. */
export function burglarExitanceBelow(kelvin,lambda){
  const z=C.h*C.c/(lambda*C.k*kelvin);let sum=0;
  for(let n=1;n<=400;n++){
    const term=Math.exp(-n*z)/n*(z**3+3*z*z/n+6*z/n**2+6/n**3);sum+=term;
    if(term<=Math.abs(sum)*1e-17)break;
  }
  return C.sigma*kelvin**4*15/Math.PI**4*sum;
}
export const burglarExitance=kelvin=>burglarExitanceBelow(kelvin,C.bandHigh)-burglarExitanceBelow(kelvin,C.bandLow);

/** Integral of z²/(z²+x²+y²)² over a rectangle, from the 2D divergence theorem.
 * It includes both the emitting surface projection and entrance-pupil cosine. */
export function burglarProjectedAngle(x0,x1,y0,y1,z){
  if(x1<=x0||y1<=y0)return 0;
  const edge=(a,b0,b1)=>{const r=Math.hypot(z,a);return a/r*(Math.atan(b1/r)-Math.atan(b0/r));};
  return Math.max(0,.5*(edge(x1,y0,y1)-edge(x0,y0,y1)+edge(y1,x0,x1)-edge(y0,x0,x1)));
}

/** The same ideal common focal plane defines displayed rays and collected power. */
export function burglarZone(lenslet,element,depth){
  const center=element===0?-.001:.001,lo=center-C.elementWidth/2,hi=center+C.elementWidth/2;
  return {lenslet,element,image:[lo,hi],x0:lenslet+(lenslet-hi)*depth/C.focal,x1:lenslet+(lenslet-lo)*depth/C.focal,y:C.elementHeight/2*depth/C.focal};
}

export function burglarPIR(v,time){
  const motion=burglarMotion(v,time),room=C.roomKelvin+v.warming*time/60,body=room+v.contrast;
  const radiance=C.emissivity*(burglarExitance(body)-burglarExitance(room))/Math.PI;
  const warming=(burglarExitance(room)-burglarExitance(C.roomKelvin))/Math.PI;
  const collected=[0,0],shared=[0,0],fields=[];
  for(const s of BURGLAR_LENSLETS)for(let element=0;element<2;element++){
    const field=burglarZone(s,element,v.range),x0=Math.max(motion.x-C.targetWidth/2,field.x0),x1=Math.min(motion.x+C.targetWidth/2,field.x1),y=Math.min(C.targetHeight/2,field.y);
    const solid=burglarProjectedAngle(x0-s,x1-s,-y,y,v.range);
    const common=burglarProjectedAngle(field.x0-s,field.x1-s,-field.y,field.y,v.range);
    const power=C.pupilArea*radiance*solid;
    collected[element]+=power;shared[element]+=C.pupilArea*warming*common;
    fields.push({...field,x0Hit:x0,x1Hit:x1,halfHeight:y,solid,power});
  }
  const mismatch=v.balance/100,plus=collected[0]+shared[0],minus=collected[1]+shared[1];
  return {...motion,room,body,radiance,bandContrast:Math.PI*radiance,plus,minus,
    responsePlus:plus*(1+mismatch/2),responseMinus:minus*(1-mismatch/2),shared:shared[0],collected,fields};
}

function beamPlan(v){
  const motion=burglarMotion(v,0),current=v.power?C.beamIntensity*C.beamResponse/v.span**2:0;
  const start=v.speed>0?C.delay+(.5-C.targetWidth/2)/v.speed:0,end=v.speed>0?C.delay+(.5+C.targetWidth/2)/v.speed:motion.duration;
  const wait=v.hold/1000,alarmAt=v.power&&end-start+1e-12>=wait?start+wait:null;
  return {duration:motion.duration,current,start,end,wait,alarmAt,blockedFor:v.speed>0?C.targetWidth/v.speed:null};
}

function signalPlan(v,step){
  const radar=v.mode===0,duration=burglarMotion(v,0).duration,count=Math.ceil(duration/step),dt=duration/count;
  const signal=radar?burglarRadar:burglarPIR,first=signal(v,0);
  const aKey=radar?'i':'responsePlus',bKey=radar?'q':'responseMinus',fast=radar?radarFast:C.thermal,slow=radar?radarSlow:C.electrical,gain=radar?radarGain:pirGain;
  const arrays=Object.fromEntries(['aFast','aSlow','bFast','bSlow','energy','above','peak'].map(k=>[k,new Float64Array(count+1)]));
  let a=first[aKey],b=first[bKey],af=a,as=a,bf=b,bs=b,held=0,peak=0,alarmAt=null,wasAbove=false,energy=0,previousEnergy=0;
  arrays.aFast[0]=af;arrays.aSlow[0]=as;arrays.bFast[0]=bf;arrays.bSlow[0]=bs;
  const threshold=radar?C.radarThreshold:C.pirThreshold;
  for(let k=1;k<=count;k++){
    const now=signal(v,k*dt),an=now[aKey],bn=now[bKey];
    af=burglarLag(af,a,an,dt,fast);as=burglarLag(as,a,an,dt,slow);bf=burglarLag(bf,b,bn,dt,fast);bs=burglarLag(bs,b,bn,dt,slow);
    const ai=gain*(af-as),bi=gain*(bf-bs),instantEnergy=ai*ai+bi*bi;
    if(radar)energy=burglarLag(energy,previousEnergy,instantEnergy,dt,C.radarEnvelope);
    const level=v.power?(radar?Math.sqrt(Math.max(0,energy)):Math.abs(ai-bi)):0,over=level>=threshold;
    held=over?(wasAbove?held+dt:0):0;wasAbove=over;peak=Math.max(peak,level);
    if(alarmAt===null&&held+1e-12>=C.confirmation)alarmAt=k*dt;
    arrays.aFast[k]=af;arrays.aSlow[k]=as;arrays.bFast[k]=bf;arrays.bSlow[k]=bs;arrays.energy[k]=energy;arrays.above[k]=held;arrays.peak[k]=peak;a=an;b=bn;previousEnergy=instantEnergy;
  }
  return {duration,dt,count,arrays,threshold,alarmAt};
}

const cache=new Map();
export function burglarPlan(input=BURGLAR_DEFAULTS,options={}){
  const v=settings(input),step=options.step??(v.mode===0?C.radarStep:C.pirStep);
  if(!Number.isFinite(step)||step<=0||step>.005)throw new RangeError('Invalid integration step');
  const key=JSON.stringify({...v,sound:0,pace:1,step});
  let physical=cache.get(key);
  if(!physical){physical=v.mode===1?beamPlan(v):signalPlan(v,step);if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(key,physical);}
  return {values:v,...physical};
}

function filteredAt(plan,time){
  const v=plan.values,radar=v.mode===0,signal=radar?burglarRadar:burglarPIR;
  const k=Math.min(plan.count,Math.floor(time/plan.dt)),rest=time-k*plan.dt,a=plan.arrays,now=signal(v,time);
  let af=a.aFast[k],as=a.aSlow[k],bf=a.bFast[k],bs=a.bSlow[k],energy=a.energy[k];
  if(rest>1e-12){
    const from=signal(v,k*plan.dt),to=signal(v,Math.min(plan.duration,(k+1)*plan.dt)),share=rest/plan.dt;
    const ak=radar?'i':'responsePlus',bk=radar?'q':'responseMinus',pa=from[ak],pb=from[bk],qa=pa+(to[ak]-pa)*share,qb=pb+(to[bk]-pb)*share;
    af=burglarLag(af,pa,qa,rest,radar?radarFast:C.thermal);as=burglarLag(as,pa,qa,rest,radar?radarSlow:C.electrical);
    bf=burglarLag(bf,pb,qb,rest,radar?radarFast:C.thermal);bs=burglarLag(bs,pb,qb,rest,radar?radarSlow:C.electrical);
    if(radar){
      const next=Math.min(plan.count,k+1),e0=radarGain**2*((a.aFast[k]-a.aSlow[k])**2+(a.bFast[k]-a.bSlow[k])**2),e1=radarGain**2*((a.aFast[next]-a.aSlow[next])**2+(a.bFast[next]-a.bSlow[next])**2);
      energy=burglarLag(energy,e0,e0+(e1-e0)*share,rest,C.radarEnvelope);
    }
  }
  const gain=radar?radarGain:pirGain,outputA=v.power?gain*(af-as):0,outputB=v.power?gain*(bf-bs):0;
  const output=radar?(v.power?Math.sqrt(Math.max(0,energy)):0):outputA-outputB,level=Math.abs(output);
  return {...now,outputA,outputB,output,level,threshold:plan.threshold,over:level>=plan.threshold,held:a.above[k],peak:Math.max(a.peak[k],level)};
}

export function burglarAt(plan,time){
  validTime(time);const v=plan.values,t=Math.min(time,plan.duration),motion=burglarMotion(v,t);
  let now;
  if(v.mode===1){
    const blocked=t>=plan.start&&t<=plan.end,current=blocked?0:plan.current;
    now={...motion,blocked,current,clearCurrent:plan.current,level:current,threshold:C.beamThreshold,over:v.power&&current<C.beamThreshold,
      held:v.power&&blocked?Math.max(0,t-plan.start):0,blockedFor:plan.blockedFor,pulseOn:!!v.power&&(t*C.pulseRate)%1<C.pulseWidth*C.pulseRate};
  }else now=filteredAt(plan,t);
  const onset=plan.alarmAt!==null&&plan.alarmAt<=t+1e-12?plan.alarmAt:null,active=!!v.power&&onset!==null;
  const complete=time>=plan.duration;
  const status=!v.power?'Power disconnected: the target still moves, but the detector and sounder have no supply.':active?'ALARM: the qualified signal latched the powered sounder.':complete?'Observation complete: no alarm was requested.':t===0?'Ready: press Play to follow the signal from the room to the sounder.':v.mode===1?(now.blocked?'Beam blocked: the interruption timer is running.':'Beam reaches the receiver; the interruption timer is clear.'):now.over?'Signal is above threshold; confirmation is still pending.':v.mode===0?(now.moving?'Mixing the changing return with the transmitted reference.':'Steady reflections remain; the filter rejects their DC signal.'):'Thermal radiation reaches the elements; only changing imbalance drives the output.';
  return {...now,values:{...v},time:t,duration:plan.duration,complete,active,onset,supply:v.power?C.supply:0,sensorSupply:v.power?[C.radarSupply,C.beamSupply,C.pirSupply][v.mode]:0,hornPulse:active&&(t-onset)%1<.5,status};
}

export function createBurglarController(input=BURGLAR_DEFAULTS){
  let plan=burglarPlan(input),time=0,replay={settings:{...plan.values,sound:0},time:0};
  const state=()=>burglarAt(plan,time);
  return {getState:state,getPlan:()=>plan,replayState:()=>({...replay,settings:{...replay.settings,pace:plan.values.pace}}),
    reset(initial={}){
      if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['settings','time'].includes(k)))throw new TypeError('Invalid burglar alarm starting state');
      const next=burglarPlan(initial.settings??BURGLAR_DEFAULTS),nextTime=initial.time??0;validTime(nextTime);
      if(nextTime>next.duration)throw new RangeError('Starting clock exceeds observation');
      plan=next;time=nextTime;replay={settings:{...plan.values,sound:0},time};return state();
    },
    update(next={}){
      const v=settings({...plan.values,...next});
      if(Object.keys(v).some(k=>!['pace','sound'].includes(k)&&v[k]!==plan.values[k])){plan=burglarPlan(v);time=0;replay={settings:{...v,sound:0},time:0};}
      else{plan.values.sound=v.sound;plan.values.pace=v.pace;}return state();
    },
    advance(seconds){if(Number.isFinite(seconds)&&seconds>0)time=Math.min(plan.duration,time+seconds);return state();},
  };
}

import {validateControls,validTime} from './physics-kit.js';
import {SMOKE_SCIENCE as C,smokeOptics} from './smoke-detector-science.js';
import {smokeMassAt,smokeRoom} from './smoke-detector-physics.js';
import {mie} from './smoke-physics.js';

export const OPTICAL_SMOKE_DEFAULTS=Object.freeze({size:3,angle:21,growth:10,program:0,power:1,sound:0,pace:1});
export const OPTICAL_SMOKE_DOMAINS=Object.freeze({size:[.1,3,.1],angle:[15,165,1],growth:[0,50,1],program:[0,2,1],power:[0,1,1],sound:[0,1,1],pace:[.25,1,.25]});
export const OPTICAL_SMOKE_RUN=Object.freeze({duration:600,speed:20,lag:20,clearAt:180,standby:10.7,afterOne:2,afterTwo:1,alarmPeriod:1,supply:3,pulse:100e-6,emitterCurrent:.1,fullRange:7.2e-9,steps:31,triggerCode:10,releaseCode:7});
const D=OPTICAL_SMOKE_DEFAULTS,R=OPTICAL_SMOKE_RUN,epsilon=1e-8;
export const OPTICAL_SMOKE_TRIGGER=R.fullRange*R.triggerCode/R.steps;
export const OPTICAL_SMOKE_RELEASE=R.fullRange*R.releaseCode/R.steps;

function settings(input){
  const values=validateControls(input,D,OPTICAL_SMOKE_DOMAINS,'optical smoke detector');
  if(![.1,.3,1,3].includes(values.size))throw new RangeError('Unsupported particle diameter');
  if(![.25,.5,1].includes(values.pace))throw new RangeError('Unsupported playback pace');
  return values;
}

export function opticalSmokeSignals(values,mass,optical=smokeOptics(values.size,values.angle)){
  const particle=optical.particle,number=mass/particle.mass,extinction=number*particle.extinction;
  const current=values.power?optical.current(number):0,charge=current*R.pulse;
  return {mass,particle,number,extinction,current,charge,electrons:charge/C.charge,supply:values.power?R.supply:0,
    volume:optical.volume,beamShare:Math.exp(-extinction*C.beamDistance),roomShare:Math.exp(-extinction*C.roomDistance),obscuration:-Math.expm1(-extinction)*100};
}

const angularPatterns=new Map();
export function opticalSmokePattern(size){
  if(!angularPatterns.has(size)){
    const angles=Array.from({length:181},(_,i)=>i*Math.PI/180),x=Math.PI*size*1e-6/C.wavelength,wave=2*Math.PI/C.wavelength;
    const values=mie(x,C.index,angles).intensity.map(value=>value/(2*wave*wave));
    angularPatterns.set(size,values.map((crossSection,angle)=>Object.freeze({angle,crossSection,relative:crossSection/values[0]})));
  }
  return angularPatterns.get(size);
}

export function opticalSmokePlan(input=D,initial={}){
  const values=settings(input);
  if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['mass','clearingAt'].includes(k)))throw new TypeError('Invalid optical starting state');
  const initialMass=initial.mass??0,clearingAt=initial.clearingAt??null;
  if(!Number.isFinite(initialMass)||initialMass<0||initialMass>500)throw new RangeError('Invalid initial smoke mass');
  if(clearingAt!==null&&(!Number.isFinite(clearingAt)||clearingAt<0||clearingAt>R.duration))throw new RangeError('Invalid clearing time');
  const optical=smokeOptics(values.size,values.angle),particle=optical.particle,massAt=time=>smokeMassAt(values,time,initialMass*1e-6,clearingAt);
  const samples=[],events=[];let active=false,count=0;
  if(values.power)for(let time=R.standby;time<=R.duration+epsilon;){
    const current=optical.current(massAt(time)/particle.mass),threshold=active?OPTICAL_SMOKE_RELEASE:OPTICAL_SMOKE_TRIGGER,hit=current>=threshold,before=active;
    if(active){if(!hit){active=false;count=0;}}
    else{count=hit?count+1:0;if(count===3)active=true;}
    if(active!==before)events.push({time,active,current});
    const interval=active?R.alarmPeriod:count===1?R.afterOne:count===2?R.afterTwo:R.standby;
    samples.push({time,current,charge:current*R.pulse,threshold,hit,count,active,interval});time+=interval;
  }
  const chart=Array.from({length:121},(_,i)=>{const time=i*5;return {time,current:values.power?optical.current(massAt(time)/particle.mass):0};});
  return {values,initialMass,clearingAt,optical,particle,massAt,samples,events,chart,pattern:opticalSmokePattern(values.size)};
}

export function opticalSmokeAt(plan,time){
  validTime(time);const t=Math.min(time,R.duration),v=plan.values,signals=opticalSmokeSignals(v,plan.massAt(t),plan.optical);
  const sample=plan.samples.findLast(e=>e.time<=t+epsilon)??null,events=plan.events.filter(e=>e.time<=t+epsilon),active=sample?.active??false;
  const onset=events.find(e=>e.active)?.time??null,alarmStart=active?events.at(-1).time:null,phase=alarmStart===null?0:(t-alarmStart)%4;
  const clearingAt=plan.clearingAt??(v.program===1?R.clearAt:null),clearing=clearingAt!==null&&t>=clearingAt,complete=t===R.duration,count=sample?.count??0;
  const status=!v.power?'Battery disconnected: no light pulses, optical measurements or powered horn.':active?'ALARM: three consecutive smoke checks requested the powered horn.':complete?(onset===null?'Observation complete: no optical alarm was requested.':'Observation complete: the optical alarm released after clearing.'):count>0?`Check ${count} of 3: confirmation is still pending.`:clearing?'Fresh air enters; scattered light falls as smoke leaves.':t===0?'Ready: follow light from the emitter, through smoke, to the off-axis receiver.':'Sampling: smoke redirects some light into the receiver.';
  return {values:{...v},time:t,displayTime:t/R.speed,complete,...signals,roomMass:clearing?0:smokeRoom(v,t),initialMass:plan.initialMass,clearingAt,clearing,
    active,onset,alarmStart,hornPulse:active&&phase<2.5&&phase%1<.5,sample,events,count,nextSample:plan.samples.find(e=>e.time>t+epsilon)?.time??null,
    samplesSeen:plan.samples.filter(e=>e.time<=t+epsilon).length,trigger:OPTICAL_SMOKE_TRIGGER,release:OPTICAL_SMOKE_RELEASE,
    threshold:active?OPTICAL_SMOKE_RELEASE:OPTICAL_SMOKE_TRIGGER,pulseOn:!!sample&&t-sample.time<R.pulse,status};
}

/** A prepared chamber puff crosses the trigger between the first two checks.
 * The root is solved on the low-concentration, rising branch of the response. */
export function opticalSmokePuff(){
  const optical=smokeOptics(D.size,D.angle);let lo=0,hi=100e-6;
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(optical.current(mid/optical.particle.mass)<OPTICAL_SMOKE_TRIGGER)lo=mid;else hi=mid;}
  return (lo+hi)/2*1e6*Math.exp((R.standby+R.afterOne/2)/R.lag);
}

export function createOpticalSmokeController(input=D){
  let plan=opticalSmokePlan(input),time=0,replay={settings:{...plan.values,sound:0},time:0,mass:0};
  const state=()=>opticalSmokeAt(plan,time);
  return {getState:state,getPlan:()=>plan,replayState:()=>({...replay,settings:{...replay.settings,pace:plan.values.pace}}),
    reset(initial={}){
      if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['settings','time','mass','clearingAt'].includes(k)))throw new TypeError('Invalid optical starting state');
      const nextTime=initial.time??0;validTime(nextTime);if(nextTime>R.duration)throw new RangeError('Invalid starting clock');
      const next=opticalSmokePlan(initial.settings??D,{mass:initial.mass??0,clearingAt:initial.clearingAt??null});
      plan=next;time=nextTime;replay={settings:{...plan.values,sound:0},time,mass:plan.initialMass,clearingAt:plan.clearingAt};return state();
    },
    update(next={}){
      const values=settings({...plan.values,...next});
      if(Object.keys(values).some(k=>!['sound','pace'].includes(k)&&values[k]!==plan.values[k])){plan=opticalSmokePlan(values);time=0;replay={settings:{...values,sound:0},time:0,mass:0};}
      else{plan.values.sound=values.sound;plan.values.pace=values.pace;}
      return state();
    },
    advance(seconds){if(Number.isFinite(seconds)&&seconds>0)time=Math.min(R.duration,time+seconds*R.speed);return state();},
    clear(){if(time<R.duration&&time<(plan.clearingAt??(plan.values.program===1?R.clearAt:Infinity)))plan=opticalSmokePlan(plan.values,{mass:plan.initialMass,clearingAt:time});return state();},
  };
}

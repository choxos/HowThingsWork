import {validateControls,validTime} from './physics-kit.js';
import {SMOKE_SCIENCE as C,smokeChambers,smokeNode,smokeParticle,smokeSweep,smokeIonDensity,smokeChamberCurrent,smokeAfterGold,smokeAirRange,smokeAirEnergy} from './smoke-detector-science.js';
import {smokeMassAt,smokeRoom} from './smoke-detector-physics.js';

export const ION_SMOKE_DEFAULTS=Object.freeze({size:.1,growth:10,battery:9,program:0,power:1,sound:0,pace:1});
export const ION_SMOKE_DOMAINS=Object.freeze({size:[.1,3,.1],growth:[0,50,1],battery:[6.5,9.5,.1],program:[0,2,1],power:[0,1,1],sound:[0,1,1],pace:[.25,1,.25]});
export const ION_SMOKE_RUN=Object.freeze({duration:600,speed:20,lag:20,clearAt:180,sample:1.67,hysteresis:.1,lowBattery:7.5,batteryPeriod:40,chirp:.01});
const D=ION_SMOKE_DEFAULTS,R=ION_SMOKE_RUN,epsilon=1e-8;

function settings(input){
  const values=validateControls(input,D,ION_SMOKE_DOMAINS,'ionization smoke detector');
  if(![.1,.3,1,3].includes(values.size))throw new RangeError('Unsupported particle diameter');
  if(![.25,.5,1].includes(values.pace))throw new RangeError('Unsupported playback pace');
  return values;
}

/** Rates are per polarity in the uniform small-ion population. Attachment
 * leaves this population; the subsequent heavy-particle current is omitted. */
export function ionChargeBalance(chamber,volts,capture=0){
  const density=smokeIonDensity(chamber,volts,capture),sweep=smokeSweep(chamber,volts);
  const collected=sweep*density,recombined=C.recombination*density*density,attached=capture*density;
  return {density,sweep,collected,recombined,attached,generated:chamber.q,
    collectionShare:collected/chamber.q,recombinationShare:recombined/chamber.q,attachmentShare:attached/chamber.q,
    current:C.charge*chamber.volume*collected,volts,field:volts/chamber.gapMeters,collectionTime:sweep>0?1/sweep:null};
}

export function ionSmokeSignals(values,mass){
  const particle=smokeParticle(values.size),number=mass/particle.mass,capture=number*particle.capture,supply=values.power?values.battery:0;
  const {sensing,reference}=smokeChambers(),node=smokeNode(supply,capture),cleanNode=smokeNode(supply);
  const open=ionChargeBalance(sensing,node,capture),closed=ionChargeBalance(reference,supply-node);
  const cleanCurrent=smokeChamberCurrent(sensing,cleanNode),obscuration=-Math.expm1(-number*particle.extinction)*100;
  return {mass,particle,number,capture,supply,node,cleanNode,open,closed,current:open.current,cleanCurrent,
    currentShare:cleanCurrent>0?open.current/cleanCurrent:null,saturation:sensing.saturation,obscuration};
}

export function ionNormalAlpha(){
  const emitted=5.48556,energy=smokeAfterGold(emitted,C.coverMicrons),range=smokeAirRange(energy);
  const after=smokeAirEnergy(Math.max(0,range-C.sensingGap));
  return {emitted,energy,range,after,deposited:energy-after,pairs:(energy-after)*1e6/C.pairEnergy,freePairs:energy*1e6/C.pairEnergy};
}

export function ionSmokePlan(input=D,initial={}){
  const values=settings(input);
  if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['mass','clearingAt'].includes(k)))throw new TypeError('Invalid ionization starting state');
  const initialMass=initial.mass??0,clearingAt=initial.clearingAt??null;
  if(!Number.isFinite(initialMass)||initialMass<0||initialMass>500)throw new RangeError('Invalid initial smoke mass');
  if(clearingAt!==null&&(!Number.isFinite(clearingAt)||clearingAt<0||clearingAt>R.duration))throw new RangeError('Invalid clearing time');
  const massAt=time=>smokeMassAt(values,time,initialMass*1e-6,clearingAt),particle=smokeParticle(values.size),threshold=values.battery/2,release=threshold-R.hysteresis;
  const samples=[],events=[],chirps=[];let active=false;
  if(values.power){
    for(let n=1;n*R.sample<=R.duration+epsilon;n++){
      const time=n*R.sample,node=smokeNode(values.battery,massAt(time)/particle.mass*particle.capture),limit=active?release:threshold,next=node>=limit;
      if(next!==active)events.push({time,active:next,node});
      active=next;samples.push({time,node,threshold:limit,active});
    }
    if(values.battery<R.lowBattery)for(let time=R.batteryPeriod;time<=R.duration+epsilon;time+=R.batteryPeriod){
      if(!(events.findLast(e=>e.time<=time+epsilon)?.active??false))chirps.push(time);
    }
  }
  const chart=Array.from({length:121},(_,i)=>{const time=i*5;return {time,node:values.power?smokeNode(values.battery,massAt(time)/particle.mass*particle.capture):0};});
  return {values,initialMass,clearingAt,massAt,particle,threshold,release,samples,events,chirps,chart};
}

export function ionSmokeAt(plan,time){
  validTime(time);const t=Math.min(time,R.duration),v=plan.values,signals=ionSmokeSignals(v,plan.massAt(t));
  const sample=plan.samples.findLast(e=>e.time<=t+epsilon)??null,events=plan.events.filter(e=>e.time<=t+epsilon),chirps=plan.chirps.filter(at=>at<=t+epsilon);
  const active=sample?.active??false,onset=events.find(e=>e.active)?.time??null,lastEvent=events.at(-1),alarmStart=active?lastEvent.time:null;
  const phase=alarmStart===null?0:(t-alarmStart)%4,hornPulse=active&&phase<2.5&&phase%1<.5;
  const clearingAt=plan.clearingAt??(v.program===1?R.clearAt:null),clearing=clearingAt!==null&&t>=clearingAt,complete=t===R.duration;
  const status=!v.power?'Source still makes ions; disconnected battery cannot collect them or sound the horn.':active?'ALARM: the sampled chamber voltage requests the powered horn.':complete?(onset===null?'Observation complete: no smoke alarm was requested.':'Observation complete: smoke alarm released after the air cleared.'):clearing?'Fresh air enters; capture falls and the current recovers.':t===0?'Ready: follow ions through the two series chambers.':'Sampling: smoke changes the current and shared-plate voltage.';
  return {values:{...v},time:t,displayTime:t/R.speed,complete,...signals,roomMass:clearing?0:smokeRoom(v,t),clearingAt,clearing,initialMass:plan.initialMass,
    active,onset,alarmStart,hornPulse,sample,events,chirps,nextSample:plan.samples.find(e=>e.time>t+epsilon)?.time??null,samplesSeen:plan.samples.filter(e=>e.time<=t+epsilon).length,
    threshold:active?plan.release:plan.threshold,trigger:plan.threshold,release:plan.release,status,alpha:ionNormalAlpha()};
}

export function createIonSmokeController(input=D){
  let plan=ionSmokePlan(input),time=0,replay={settings:{...plan.values,sound:0},time:0,mass:0};
  const state=()=>ionSmokeAt(plan,time);
  return {getState:state,getPlan:()=>plan,replayState:()=>({...replay,settings:{...replay.settings,pace:plan.values.pace}}),
    reset(initial={}){
      if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['settings','time','mass','clearingAt'].includes(k)))throw new TypeError('Invalid ionization starting state');
      const nextTime=initial.time??0;validTime(nextTime);if(nextTime>R.duration)throw new RangeError('Invalid starting clock');
      const next=ionSmokePlan(initial.settings??D,{mass:initial.mass??0,clearingAt:initial.clearingAt??null});
      plan=next;time=nextTime;replay={settings:{...plan.values,sound:0},time,mass:plan.initialMass,clearingAt:plan.clearingAt};return state();
    },
    update(next={}){
      const values=settings({...plan.values,...next});
      if(Object.keys(values).some(k=>!['sound','pace'].includes(k)&&values[k]!==plan.values[k])){plan=ionSmokePlan(values);time=0;replay={settings:{...values,sound:0},time:0,mass:0};}
      else{plan.values.sound=values.sound;plan.values.pace=values.pace;}
      return state();
    },
    advance(seconds){if(Number.isFinite(seconds)&&seconds>0)time=Math.min(R.duration,time+seconds*R.speed);return state();},
    clear(){if(time<R.duration&&time<(plan.clearingAt??(plan.values.program===1?R.clearAt:Infinity)))plan=ionSmokePlan(plan.values,{mass:plan.initialMass,clearingAt:time});return state();},
  };
}

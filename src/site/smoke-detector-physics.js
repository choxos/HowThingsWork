import {validateControls,validTime} from './physics-kit.js';
import {smokeSignals,smokeOptics,smokeNode,SMOKE_SCIENCE} from './smoke-detector-science.js';

export const SMOKE_DETECTOR_DEFAULTS=Object.freeze({size:.3,growth:10,battery:9,angle:21,program:0,power:1,sound:0,pace:1});
export const SMOKE_DETECTOR_DOMAINS=Object.freeze({size:[.1,3,.1],growth:[0,50,1],battery:[6.5,9.5,.1],angle:[15,165,1],program:[0,2,1],power:[0,1,1],sound:[0,1,1],pace:[.25,1,.25]});
export const SMOKE_DETECTOR_RUN=Object.freeze({duration:600,speed:20,lag:20,clearAt:180,ionPeriod:1.67,ionHysteresis:.1,photoPeriod:10.7,photoAfterOne:2,photoAfterTwo:1,photoAlarmPeriod:1,
  photoFull:7.2e-9,photoCode:10,photoClearCode:7,photoSteps:31,lowBattery:7.5,batteryPeriod:40,chirpDuration:.01,opticalSupply:3,emitterPulse:100e-6,emitterCurrent:.1});
const R=SMOKE_DETECTOR_RUN;
export const SMOKE_PHOTO_THRESHOLD=R.photoFull*R.photoCode/R.photoSteps;
export const SMOKE_PHOTO_CLEAR=R.photoFull*R.photoClearCode/R.photoSteps;
const epsilon=1e-8;

export function smokeRoom(values,time){return values.program===2?0:values.growth*1e-6*time/60;}
export function smokeMassAt(values,time,initialMass=0,clearingAt=null){
  const clear=clearingAt??(values.program===1?R.clearAt:Infinity),t=Math.min(time,clear),growth=values.program===2?0:values.growth*1e-6/60;
  const mass=initialMass*Math.exp(-t/R.lag)+growth*(t+R.lag*Math.expm1(-t/R.lag));
  return Math.max(0,mass*Math.exp(-Math.max(0,time-clear)/R.lag));
}

export function smokeDetectorPlan(input=SMOKE_DETECTOR_DEFAULTS,initial={}){
  const values=validateControls(input,SMOKE_DETECTOR_DEFAULTS,SMOKE_DETECTOR_DOMAINS,'smoke detector');
  if(![.1,.3,1,3].includes(values.size))throw new RangeError('Unsupported particle size');
  if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['mass','clearingAt'].includes(k)))throw new TypeError('Invalid smoke starting state');
  const initialMass=initial.mass??0,clearingAt=initial.clearingAt??null;
  if(!Number.isFinite(initialMass)||initialMass<0||initialMass>500)throw new RangeError('Invalid initial smoke mass');
  if(clearingAt!==null&&(!Number.isFinite(clearingAt)||clearingAt<0||clearingAt>R.duration))throw new RangeError('Invalid clearing time');
  const massAt=time=>smokeMassAt(values,time,initialMass*1e-6,clearingAt),optical=smokeOptics(values.size,values.angle),particle=optical.particle;
  const ionThreshold=values.battery/2,ionClear=ionThreshold-R.ionHysteresis;
  const ionSamples=[],photoSamples=[],changes=[],chirps=[];let ion=false,photo=false,count=0;
  if(values.power){
    for(let n=1;n*R.ionPeriod<=R.duration+epsilon;n++){
      const time=n*R.ionPeriod,mass=massAt(time),node=smokeNode(values.battery,mass/particle.mass*particle.capture),threshold=ion?ionClear:ionThreshold,next=node>=threshold;
      if(next!==ion)changes.push({time,sensor:'ion',active:next});ion=next;ionSamples.push({time,value:node,threshold,active:ion});
    }
    for(let time=R.photoPeriod;time<=R.duration+epsilon;){
      const value=optical.current(massAt(time)/particle.mass),threshold=photo?SMOKE_PHOTO_CLEAR:SMOKE_PHOTO_THRESHOLD,hit=value>=threshold;
      const before=photo;
      if(photo){if(!hit){photo=false;count=0;}}
      else{count=hit?count+1:0;if(count===3)photo=true;}
      if(photo!==before)changes.push({time,sensor:'photo',active:photo});
      photoSamples.push({time,value,threshold,hit,count,active:photo});
      time+=photo?R.photoAlarmPeriod:count===1?R.photoAfterOne:count===2?R.photoAfterTwo:R.photoPeriod;
    }
    changes.sort((a,b)=>a.time-b.time||a.sensor.localeCompare(b.sensor));
    if(values.battery<R.lowBattery)for(let time=R.batteryPeriod;time<=R.duration+epsilon;time+=R.batteryPeriod){
      let ionActive=false,photoActive=false;for(const event of changes){if(event.time>time+epsilon)break;if(event.sensor==='ion')ionActive=event.active;else photoActive=event.active;}
      if(!ionActive&&!photoActive)chirps.push(time);
    }
  }
  const first=sensor=>changes.find(e=>e.sensor===sensor&&e.active)?.time??null;
  const chart=Array.from({length:121},(_,i)=>{const time=i*5,number=massAt(time)/particle.mass;return {time,node:values.power?smokeNode(values.battery,number*particle.capture):0,scattered:values.power?optical.current(number):0};});
  return {values,initialMass,clearingAt,particle,optical,massAt,ionThreshold,ionClear,ionSamples,photoSamples,changes,chirps,chart,ionAlarm:first('ion'),photoAlarm:first('photo')};
}

function atOrBefore(events,time){let lo=0,hi=events.length;while(lo<hi){const mid=(lo+hi)>>1;if(events[mid].time<=time+epsilon)lo=mid+1;else hi=mid;}return lo?events[lo-1]:null;}
export function smokeDetectorAt(plan,time){
  validTime(time);const t=Math.min(time,R.duration),{values}=plan,signals=smokeSignals(values,plan.massAt(t));
  const ionLast=atOrBefore(plan.ionSamples,t),photoLast=atOrBefore(plan.photoSamples,t),ionActive=ionLast?.active??false,photoActive=photoLast?.active??false;
  const events=plan.changes.filter(e=>e.time<=t+epsilon),chirps=plan.chirps.filter(at=>at<=t+epsilon),active=ionActive||photoActive;
  let alarmStart=null,ion=false,photo=false;
  for(const event of events){const was=ion||photo;if(event.sensor==='ion')ion=event.active;else photo=event.active;if(!was&&(ion||photo))alarmStart=event.time;if(!(ion||photo))alarmStart=null;}
  const phase=alarmStart===null?0:(t-alarmStart)%4,hornPulse=active&&phase<2.5&&phase%1<.5;
  const clear=plan.clearingAt??(values.program===1?R.clearAt:null),clearing=clear!==null&&t>=clear,roomMass=clearing?0:smokeRoom(values,t);
  const complete=t>=R.duration,ionSeen=events.find(e=>e.sensor==='ion'&&e.active)?.time??null,photoSeen=events.find(e=>e.sensor==='photo'&&e.active)?.time??null;
  const mode=!values.power?'No power':active?'ALARM':chirps.at(-1)!==undefined&&t-chirps.at(-1)<R.chirpDuration?'Low-battery chirp':clearing?'Clearing':signals.mass>1e-12?'Sampling smoke':'Clean air';
  const status=!values.power?'Battery disconnected: sensing circuits and horn have no power.':active?`${ionActive&&photoActive?'Both sensors request':ionActive?'Ionization sensor requests':'Optical sensor requests'} the horn.`:complete?`${events.some(e=>e.active)?'Alarm history recorded; both sensors are quiet now.':'Neither sensor alarmed in this observation.'}`:photoLast?.count>0?`Optical check ${photoLast.count} of 3. Confirmation is still pending.`:clearing?'Fresh air is entering. Watch the signals fall and the alarm release.':t===0?'Ready. Run the observation to watch smoke change both signals.':'Sampling. Neither sensor requests the horn now.';
  return {values:{...values},time:t,displayTime:t/R.speed,complete,...signals,roomMass,clearing,clearingAt:clear,initialMass:plan.initialMass,
    ionActive,photoActive,active,hornPulse,alarmStart,ionLast,photoLast,events,chirps,ionSeen,photoSeen,ionSamplesSeen:plan.ionSamples.filter(e=>e.time<=t+epsilon).length,
    photoSamplesSeen:plan.photoSamples.filter(e=>e.time<=t+epsilon).length,ionThreshold:ionActive?plan.ionClear:plan.ionThreshold,photoThreshold:photoActive?SMOKE_PHOTO_CLEAR:SMOKE_PHOTO_THRESHOLD,
    photoCount:photoLast?.count??0,opticalSupply:values.power?R.opticalSupply:0,mode,status,ionPrediction:plan.ionAlarm,photoPrediction:plan.photoAlarm,
    nextIon:plan.ionSamples.find(e=>e.time>t+epsilon)?.time??null,nextPhoto:plan.photoSamples.find(e=>e.time>t+epsilon)?.time??null,
    particle:plan.particle,opticalVolume:plan.optical.volume,sourceActivity:SMOKE_SCIENCE.activity};
}

export function createSmokeDetectorController(input={}){
  let plan=smokeDetectorPlan(input),time=0,replay={settings:{...plan?.values},mass:0};
  const state=()=>smokeDetectorAt(plan,time);
  function reset(initial={}){
    if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['settings','time','mass','clearingAt'].includes(k)))throw new TypeError('Invalid smoke starting state');
    const nextTime=initial.time??0;validTime(nextTime);if(nextTime>R.duration)throw new RangeError('Invalid starting clock');
    plan=smokeDetectorPlan(initial.settings??SMOKE_DETECTOR_DEFAULTS,{mass:initial.mass??0,clearingAt:initial.clearingAt??null});time=nextTime;
    replay={settings:{...plan.values,sound:0},mass:initial.mass??0,clearingAt:initial.clearingAt??null,time:nextTime};return state();
  }
  return {getState:state,getPlan:()=>plan,replayState:()=>({...replay,settings:{...replay.settings,pace:plan.values.pace}}),reset,
    update(next={}){const values=validateControls({...plan.values,...next},SMOKE_DETECTOR_DEFAULTS,SMOKE_DETECTOR_DOMAINS,'smoke detector');const changed=Object.keys(values).some(k=>!['sound','pace'].includes(k)&&values[k]!==plan.values[k]);if(changed){plan=smokeDetectorPlan(values);time=0;replay={settings:{...values,sound:0},mass:0};}else{plan.values.sound=values.sound;plan.values.pace=values.pace;}return state();},
    advance(seconds){if(Number.isFinite(seconds)&&seconds>0)time=Math.min(R.duration,time+seconds*R.speed);return state();},
    clear(){if(time<R.duration){const effective=plan.clearingAt??(plan.values.program===1?R.clearAt:Infinity);if(time<effective)plan=smokeDetectorPlan(plan.values,{mass:plan.initialMass,clearingAt:time});}return state();},
  };
}

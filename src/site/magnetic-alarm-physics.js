export const MAGNETIC_ALARM_PHYSICS = Object.freeze({duration:10, openingTime:4, holdTime:2, barTravel:1, springRate:.1, referenceDistance:12, voltage:12, senseResistance:12000, sounderResistance:120});
export const MAGNETIC_ALARM_DEFAULTS = Object.freeze({opening:16, gap:8, magnet:1, spring:1, cable:1, armed:1, power:1, sound:0});
export const MAGNETIC_ALARM_DOMAINS = Object.freeze(Object.fromEntries(Object.entries({opening:[0,16,.25],gap:[8,16,4],magnet:[.8,1.2,.2],spring:[.8,1.2,.2],cable:[0,1,1],armed:[0,1,1],power:[0,1,1],sound:[0,1,1]}).map(([key,value])=>[key,Object.freeze(value)])));
export const MAGNETIC_ALARM_OPTIONS = Object.freeze(Object.fromEntries(Object.entries({gap:[[8,'Near: 8 mm'],[12,'Farther: 12 mm'],[16,'Too far: 16 mm']],magnet:[[.8,'Weaker'],[1,'Medium'],[1.2,'Stronger']],spring:[[.8,'Light preload'],[1,'Medium preload'],[1.2,'Firm preload']],cable:[[1,'Intact'],[0,'Broken']],armed:[[1,'Armed'],[0,'Disarmed']],power:[[1,'Connected'],[0,'Disconnected']],sound:[[0,'Off'],[1,'On']]}).map(([key,rows])=>[key,Object.freeze(rows.map(([value,label])=>Object.freeze({value,label})))])));
const P=MAGNETIC_ALARM_PHYSICS, clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

function settings(input={},fallback=MAGNETIC_ALARM_DEFAULTS) {
  const next={...fallback};
  for(const [key,[low,high,step]] of Object.entries(MAGNETIC_ALARM_DOMAINS)) {
    const value=input?.[key];
    if(!Number.isFinite(value))continue;
    if(MAGNETIC_ALARM_OPTIONS[key]&&!MAGNETIC_ALARM_OPTIONS[key].some(option=>option.value===value))continue;
    next[key]=Number((low+Math.round((clamp(value,low,high)-low)/step)*step).toPrecision(12));
  }
  return next;
}

// A small induced dipole is attracted along the gradient of the source field squared.
export function magneticAlarmPull(distance,height,strength=1) {
  if(![distance,height,strength].every(Number.isFinite)||distance<=0||strength<=0)throw new RangeError('Magnetic geometry must be finite, with positive distance and strength.');
  return strength*strength*P.referenceDistance**7*distance**3/(distance*distance+height*height)**5;
}

export function magneticAlarmThresholds(input={}) {
  const v=settings(input);
  const height=travel=>{
    const distance=v.gap-travel, spring=v.spring+P.springRate*travel;
    const ratio=magneticAlarmPull(distance,0,v.magnet)/spring;
    return ratio<1?null:distance*Math.sqrt(Math.max(0,ratio**.2-1));
  };
  return {pickup:height(0),release:height(P.barTravel)};
}

export function magneticAlarmOpening(clock,peak) {
  if(!Number.isFinite(clock)||!Number.isFinite(peak))return 0;
  const time=clamp(clock,0,P.duration), opening=clamp(peak,0,16);
  return opening*(time<P.openingTime?time/P.openingTime:time<P.openingTime+P.holdTime?1:(P.duration-time)/P.openingTime);
}

export function createMagneticAlarmController() {
  let values={...MAGNETIC_ALARM_DEFAULTS}, clock=0, closed=false, latched=false, firstTrip=null;
  let senseCharge=0, sounderEnergy=0, resetBlocked=false;
  function settle() {
    const height=magneticAlarmOpening(clock,values.opening), limits=magneticAlarmThresholds(values);
    if(closed&&(limits.release===null||height>=limits.release-1e-10))closed=false;
    else if(!closed&&limits.pickup!==null&&height<=limits.pickup+1e-10)closed=true;
    const loopClosed=closed&&values.cable===1;
    if(!values.power||!values.armed){latched=false;firstTrip=null;resetBlocked=false;}
    else if(!loopClosed){
      if(!latched)firstTrip={clock,opening:height,cause:values.cable?'contacts':'cable'};
      latched=true;
    }
    if(loopClosed)resetBlocked=false;
  }
  function getState() {
    const opening=magneticAlarmOpening(clock,values.opening), travel=closed?P.barTravel:0, distance=values.gap-travel;
    const loopClosed=closed&&values.cable===1, voltage=values.power?P.voltage:0;
    const senseCurrent=loopClosed?voltage/P.senseResistance:0, alarm=Boolean(values.power&&values.armed&&latched);
    return {values:{...values},clock,complete:clock>=P.duration,opening,barTravel:travel,closed,loopClosed,
      magneticPull:magneticAlarmPull(distance,opening,values.magnet),springPull:values.spring+P.springRate*travel,
      separation:Math.hypot(distance,opening),thresholds:magneticAlarmThresholds(values),
      voltage,senseCurrent,senseVoltage:loopClosed?0:voltage,sounderCurrent:alarm?voltage/P.sounderResistance:0,
      alarm,latched,firstTrip:firstTrip?{...firstTrip}:null,senseCharge,sounderEnergy,resetBlocked};
  }
  function update(input={}) {
    values=settings(input,values);settle();return getState();
  }
  function advance(seconds) {
    if(!Number.isFinite(seconds)||seconds<=0)return getState();
    const end=Math.min(P.duration,clock+seconds), limits=magneticAlarmThresholds(values);
    const stops=[P.openingTime,P.openingTime+P.holdTime,end];
    if(values.opening>0)for(const height of Object.values(limits))if(height!==null&&height<=values.opening) {
      stops.push(P.openingTime*height/values.opening,P.duration-P.openingTime*height/values.opening);
    }
    for(const next of [...new Set(stops)].filter(time=>time>clock+1e-12&&time<=end).sort((a,b)=>a-b)) {
      const now=getState(), duration=next-clock;
      senseCharge+=now.senseCurrent*duration;sounderEnergy+=now.voltage*now.sounderCurrent*duration;
      clock=next;settle();
    }
    if(end-clock<1e-12)clock=end;
    return getState();
  }
  function reset(initial={}) {
    values=settings(initial?.settings);clock=0;closed=false;latched=false;firstTrip=null;
    senseCharge=0;sounderEnergy=0;resetBlocked=false;settle();
    if(Number.isFinite(initial?.clock)&&initial.clock>0)advance(Math.min(P.duration,initial.clock));
    return getState();
  }
  function clearAlarm() {
    latched=false;firstTrip=null;resetBlocked=Boolean(values.power&&values.armed&&!(closed&&values.cable));
    settle();return getState();
  }
  reset();
  return {getState,update,advance,reset,clearAlarm,replayState:()=>({settings:{...values,sound:0}})};
}
